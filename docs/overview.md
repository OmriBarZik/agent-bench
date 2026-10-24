# agent-bench overview

agent-bench measures how well Claude Code does real tasks in a Chromium checkout under different tool setups. These setups are called **configs**; examples are MCP servers, skills, allowed tools and the model. For every combination of **task × config × repeat**, it does the following:

1. Resets Chromium to a fixed commit.
2. Runs one headless `claude -p` session.
3. Records the result and every tool call the agent made in a local SQLite database.

You then compare configs with plain SQL.

There's no server and no Docker. Everything runs on [Bun](https://bun.com) 1.4.4 with no runtime npm dependencies.

## Expected layout

This repo must be cloned as `agent-bench`, next to the `src/` folder of a Chromium checkout (a `gclient` root):

```
chromium/
  .gclient
  src/           # the Chromium checkout the agent works in (CHROMIUM_SRC)
  agent-bench/   # this repo
```

The runner defaults `CHROMIUM_SRC` to `../src`. The hooks in `hooks/settings.example.json` run as `bun "$CLAUDE_PROJECT_DIR"/../agent-bench/hooks/tool-log.ts`, where `$CLAUDE_PROJECT_DIR` is `src/`, so the folder name `agent-bench` matters.

## Quick start

```sh
bun install                  # @types/bun + husky (installs the pre-commit hook)
bun src/main.ts              # reads configs/benchmark-tasks.json + configs/benchmark-setup.json
bun src/main.ts --only-task t1 --repeats 3
bun run db:shell             # sqlite3 shell on data/bench.sqlite
```

> ⚠️ The runner **wipes uncommitted work** in the Chromium checkout (`git reset --hard` + `git clean -fd`) before every run. It refuses to start if tracked files are modified, unless you pass `--force`.

Flags: `--tasks`, `--configs`, `--repeats`, `--only-task`, `--only-config`, `--timeout-min` (default 60), `--sync` (run `gclient sync -D` after each checkout) and `--force`.

## How a run works

```
src/main.ts
  ├─ loadSelection        benchmark-tasks.json × benchmark-setup.json, filtered by --only-*
  ├─ hasUncommittedChanges → refuse unless --force
  ├─ upsertTask / upsertConfig (config_hash = sha256 of hook settings + MCP configs + extraFiles)
  └─ for each task × config × repeat → runOne
        1. resetChromium(sha)          git reset/clean/checkout --detach [+ gclient sync]
        2. createRunBranch(runId)      branch at that SHA, named after the run id
        3. startRun                    insert the runs row (status = running)
        4. runClaude                   claude -p … --output-format json --settings hooks/settings.example.json
        │     └─ hooks/tool-log.ts     PreToolUse/PostToolUse → tool_calls rows (only when BENCH_RUN_ID is set)
        5. copyTranscript              ~/.claude/projects/**/<session>.jsonl → runs/<run_id>/
        6. commitRunChanges            commit the checkout onto the run branch
        7. finishRun                   duration, turns, cost, tokens, denials, changed files, raw result
```

The runner creates the branch and the commit. The agent is not asked to: it only edits the tree. `git clean` does not pass `-x`, so ignored build output (`out/`) survives a checkout and switching runs does not force a full rebuild.

The `runs` row is inserted **before** Claude starts, so the hook's `tool_calls` rows always have a parent. Scoring isn't done yet, so `success` and `score` stay `NULL` for now.

To inspect a run, check out its branch in the Chromium tree (`git switch <run_id>`). `commit_sha` is NULL when the tree still matches the task SHA.

## Project layout

| Path                                       | Job                                                                                                            |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `src/main.ts`                              | Entry point: CLI args, task/config selection, the run loop, progress output                                    |
| `src/paths.ts`                             | Shared filesystem locations (`BENCH_DIR`, `CHROMIUM_SRC`, `HOOK_SETTINGS`, `RUNS_DIR`)                         |
| `src/db.ts` / `db.types.ts`                | Opens SQLite, applies the schema, and holds every query helper / row types                                     |
| `src/runner/bench-config.ts` / `.types.ts` | Load and filter `benchmark-tasks.json`/`benchmark-setup.json`, and build a config's DB row and hash            |
| `src/runner/chromium.ts`                   | git/gclient on the Chromium checkout: reset, run branch, artifact commit                                       |
| `src/runner/claude.ts`                     | Build `claude` args, spawn it, parse its JSON result, and copy the transcript                                  |
| `src/runner/run-one.ts` / `.types.ts`      | One run end to end (the steps above)                                                                           |
| `hooks/tool-log.ts`                        | Claude Code hook that writes one `tool_calls` row per tool call (one per program for Bash pipelines)           |
| `hooks/settings.example.json`              | The hook registration passed to `claude --settings`. It's part of `config_hash`                                |
| `db/schema.sql`                            | SQLite schema, applied idempotently on every open                                                              |
| `data/bench.sqlite`                        | The results DB (gitignored)                                                                                    |
| `runs/<run_id>/`                           | Per-run artifacts: `command.json`, `result.json`, `stderr.log`, `transcript.jsonl` and `session/` (gitignored) |
| `.claude/skills/`                          | Agent skills: `bun` (tooling and APIs) and `code-styling` (style rules)                                        |

## Input files

`configs/benchmark-tasks.json`:

```json
[
  {
    "taskId": "t1",
    "promptFile": "prompts/t1.md",
    "chromiumSha": "abc123",
    "title": "…",
    "difficulty": "simple",
    "scoring": {}
  }
]
```

`promptFile` is relative to the tasks file and holds the whole prompt as plain text (leading/trailing whitespace is trimmed). Editing it changes the prompt stored for that task on the next run.

`configs/benchmark-setup.json`:

```json
[
  {
    "configId": "baseline",
    "description": "…",
    "model": "claude-opus-5-5",
    "mcpConfig": ["mcp/chromium.json"],
    "strictMcpConfig": true,
    "allowedTools": ["Bash", "Read"],
    "disallowedTools": [],
    "permissionMode": "acceptEdits",
    "extraFiles": ["skills/foo/SKILL.md"]
  }
]
```

Paths in `mcpConfig` and `extraFiles` are relative to the repo root. Their contents are hashed into `config_hash`, so editing one of them shows up as a new config version.

## Data model

| Table / view           | One row per            | Notes                                                                                                                    |
| ---------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `tasks`                | task                   | `scoring` is JSON text                                                                                                   |
| `configs`              | config                 | `tools` / `permissions` are JSON text, and `config_hash` identifies the exact setup                                      |
| `runs`                 | task × config × repeat | status `running` / `done` / `crashed`, plus metrics. `branch` equals `run_id`; `changed_files` and `raw_result` are JSON |
| `tool_calls`           | hook event             | `phase` is `pre` / `post`. `program` is the actual binary for Bash (`rg`, `head`, …)                                     |
| `tool_attempts` (view) | attempted tool call    | joins pre ↔ post on `tool_use_id`. `ran = 0` means it was blocked or denied                                              |

Example: the average cost and turns per config.

```sql
SELECT config_id, count(*) runs, avg(cost_usd) cost, avg(num_turns) turns
FROM runs WHERE status = 'done' GROUP BY config_id;
```

Example: the files a run committed, relative to the task SHA.

```sql
SELECT run_id, commit_sha, json_extract(file.value, '$.status') AS status,
       json_extract(file.value, '$.path') AS path
FROM runs, json_each(changed_files) AS file
WHERE run_id = ?;
```

Example: the most-used Bash programs in one run.

```sql
SELECT program, count(*) FROM tool_calls
WHERE run_id = ? AND phase = 'pre' AND tool = 'Bash' GROUP BY program ORDER BY 2 DESC;
```

## Environment variables

| Variable          | Default                      | Used by                                                                       |
| ----------------- | ---------------------------- | ----------------------------------------------------------------------------- |
| `CHROMIUM_SRC`    | `../src` (next to this repo) | runner: the checkout that gets reset                                          |
| `BENCH_DB_PATH`   | `data/bench.sqlite`          | runner and hook                                                               |
| `BENCH_RUN_ID`    | — (the runner sets it)       | hook: logs only when it's set, so normal Claude Code sessions aren't recorded |
| `BENCH_HOOK_DUMP` | —                            | hook: appends raw hook payloads to this file, for debugging                   |

## Design choices

- **SQLite in WAL mode** lets many short-lived hook processes write while the runner holds the DB open, with no Docker or server to start.
- **The hook never blocks a tool.** It always exits 0, and if the DB write fails it appends the row to `~/.claude/bench-hook-fallback.jsonl` instead.
- **Bun built-ins only**: `bun:sqlite`, Bun Shell (`$`), `Bun.spawn`, `Bun.file` and `Bun.CryptoHasher`. Type checking is `bun check` and formatting is `bun fmt` (120 columns).

## Dashboard

`bun run dashboard` starts Grafana in Docker at <http://localhost:3000> with the [SQLite plugin](https://grafana.com/grafana/plugins/frser-sqlite-datasource/). `bun run dashboard:stop` stops it and the snapshot loop. No login is needed (anonymous admin, bound to localhost only).

Grafana reads `dashboard/snapshot/bench.sqlite`, a copy of `data/bench.sqlite` that `dashboard/snapshot.sh` refreshes every 5 seconds (`SNAPSHOT_SECONDS` changes it). It doesn't read the live DB because Docker can't share SQLite's WAL index with the host, which causes `database is locked (261)` errors when panels query at once. The dashboard is therefore up to 5 seconds behind.

The setup lives in `dashboard/`: `docker-compose.yml`, `provisioning/` (datasource and dashboard provider) and `dashboards/overview.json` (the panels, task and config filters, auto-refresh every 30s). Edit panels in the Grafana UI, then export the JSON back into `dashboards/` to keep the change.
