# agent-bench overview

agent-bench measures how well Claude Code does real tasks in a Chromium checkout under different tool setups. These setups are called **configs**; examples are MCP servers, skills, allowed tools and the model. For every combination of **task × config × repeat**, it does the following:

1. Resets Chromium to a fixed commit.
2. Runs one headless `claude -p` session.
3. Records the result and every tool call the agent made in a local SQLite database.

You then compare configs in the dashboard, and remove runs from the inspect TUI.

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
bun install                        # @types/bun + husky (installs the pre-commit hook)
bun run start                      # reads configs/benchmark-tasks.json + configs/benchmark-setup.json
bun run start --only-task t1 --repeats 3
bun run start:inspect              # pick a run: enter opens its transcript, ctrl-b builds it on the other Mac, ctrl-x twice removes it, tab checks out its branch
bun run start:dashboard            # view results in Grafana at http://localhost:3000
```

> ⚠️ The runner **wipes uncommitted work** in the Chromium checkout (`git reset --hard` + `git clean -fd`), including every checked-out submodule, before every run. It refuses to start if tracked files are modified, unless you pass `--force` or answer yes when asked to delete those changes.

Flags: `--tasks`, `--configs`, `--repeats`, `--only-task`, `--only-config`, `--timeout-min` (default 60), `--sync` (run `gclient sync -D` after each checkout) and `--force`. What to install for each config is in [setup.md](setup.md).

## How a run works

```
src/main.ts
  ├─ loadSelection        benchmark-tasks.json × benchmark-setup.json, filtered by --only-*
  ├─ uncommittedStatus → ask to delete them; refuse unless --force or the user says yes
  ├─ upsertTask / upsertConfig (config_hash = sha256 of the shared baseline + MCP configs + tool prompt + extraFiles)
  └─ for each task × config × repeat → runOne
        1. resetChromium(sha)          git reset/clean/checkout, then the same in each submodule [+ gclient sync]
        2. createRunBranch(runId)      branch at that SHA, named after the run id
        3. startRun                    insert the runs row (status = running)
        4. runClaude                   claude -p … --append-system-prompt (baseline, then the config tool prompt) --settings hooks/settings.example.json
        │     ├─ hooks/tool-log.ts        PreToolUse/PostToolUse → tool_calls rows (only when BENCH_RUN_ID is set)
        │     └─ hooks/baseline-guard.ts  PreToolUse Bash: deny cd and shell file edits for every config
        5. copyTranscript              ~/.claude/projects/**/<session>.jsonl → runs/<run_id>/
        6. commitRunChanges            commit submodule checkouts, then the superproject
        7. finishRun                   duration, turns, cost, tokens, denials, changed files, raw result
        8. judgeRun                    read-only claude -p, copies judge-transcript.jsonl, picks a decision, reports blockers
        9. saveJudgeRun                judge_runs row: cost, tokens, decision, success, blocked, blockers
```

Ctrl+C stops the benchmark. The first press kills the `claude` session in progress and does not start another run. The open `runs` row is stored as `cancelled`: `finished_at`, the wall-clock duration, and any turns, cost, and tokens the session had already reported. Whatever the agent changed is still committed onto the run branch. A judge that had started is stored as `cancelled` with no decision. A second press exits immediately. The process exits with code 130.

The runner creates the branch and the commit. The agent is not asked to: it only edits the tree. Edits inside a checked-out submodule are committed there first, and the superproject records the new gitlink. `changed_files` lists those paths with the submodule directory prefixed. `git clean` does not pass `-x`, so ignored build output (`out/`) survives a checkout and switching runs does not force a full rebuild. It also does not pass a second `-f`, so a nested git directory that is not a submodule is left in place.

The `runs` row is inserted **before** Claude starts, so the hook's `tool_calls` rows always have a parent. After the agent finishes, a second read-only session decides the checkout. That session is its own `judge_runs` row: model, duration, turns, cost, token counts, a `decision` (`failed`, `partially-failed`, `partially-pass`, or `pass`), and `success` (1 for `pass` and `partially-pass`). The agent's metrics stay on `runs`.

The judge is also shown the agent's tool calls that never ran (refused by a permission rule or the baseline guard) or ran and failed, read from `tool_calls`. It reports `blocked` (1 when a missing, denied, or failing tool or program stopped the agent from doing part of the task) and `blockers`, a JSON list of `{ kind, tool, detail }` where `kind` is `missing-tool`, `denied`, or `exec-failed` and `detail` is a plain-language sentence or two. A call the agent worked around is not a blocker. The runner prints `BLOCKED` on the run's log line, followed by one line per blocker.

To inspect a run, `bun run start:inspect` lists runs from the database. Enter opens that run's transcript in the browser (`uvx claude-code-transcripts` on `runs/<run_id>/transcript.jsonl`). Right arrow opens the judge session (`judge-transcript.jsonl`) the same way. Ctrl-b checks the build Mac from `configs/builder/remote.yaml`, and only then sends that run's branch, builds chrome there, and copies `Chromium.app` back. Ctrl-x twice removes the highlighted run from the database; the Chromium branch and the files under `runs/<run_id>/` stay. Tab checks the branch out in the Chromium tree. Pass a branch name to skip the list and check it out (`bun run start:inspect <branch>`). `--force` discards uncommitted tracked changes that block the switch. `commit_sha` is NULL when the tree still matches the task SHA. Setting up the build Mac is in [remote-build.md](remote-build.md).

## Project layout

| Path                           | Job                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `src/main.ts`                  | Entry point: CLI args, task/config selection, the run loop, progress output                                              |
| `src/inspect/main.ts`          | Pick a run from the database, open its transcript or the judge session, check out its branch, or build it on another Mac |
| `src/paths.ts`                 | Shared filesystem locations (`BENCH_DIR`, `CHROMIUM_SRC`, `HOOK_SETTINGS`, `RUNS_DIR`)                                   |
| `src/db/db.ts` / `db.types.ts` | Opens SQLite, applies the schema, and holds every query helper / row types                                               |
| `src/runner/bench-config/`     | Load and filter `benchmark-tasks.json`/`benchmark-setup.json`, and build a config's DB row and hash                      |
| `src/runner/chromium/`         | git/gclient on the Chromium checkout: reset, run branch, submodules, artifact commit, changed files                      |
| `src/runner/claude/claude.ts`  | Build `claude` args, spawn it, parse its JSON result, and copy the transcript                                            |
| `src/runner/judge/`            | Read-only judge session: judge prompt, worktree diff, and the decision                                                   |
| `src/runner/run-one/`          | One run end to end (the steps above)                                                                                     |
| `hooks/tool-log.ts`            | Claude Code hook that writes one `tool_calls` row per tool call (one per program for Bash pipelines)                     |
| `hooks/baseline-guard.ts`      | Baseline PreToolUse guard. Parses Bash with unbash and denies `cd` and shell file edits. Part of every config            |
| `hooks/settings.example.json`  | Hook registration and the `cd` deny rules, passed to `claude --settings`. Part of `config_hash`                          |
| `db/schema.sql`                | SQLite schema, applied idempotently on every open                                                                        |
| `data/bench.sqlite`            | The results DB (gitignored)                                                                                              |
| `configs/setup/<configId>/`    | One folder per config: its `readme.md`, optional `tools.md`, and any MCP config or other files it needs                  |
| `configs/tasks/<taskId>/`      | One folder per task: `prompt.md` and `judge.md`                                                                          |
| `runs/<run_id>/`               | Per-run artifacts: agent `transcript.jsonl`, judge `judge-transcript.jsonl`, command and result logs (gitignored)        |
| `.claude/skills/`              | Agent skills: `bun` (tooling and APIs) and `code-styling` (style rules)                                                  |

## Input files

`configs/benchmark-tasks.json`:

```json
[
  {
    "taskId": "t1",
    "promptFile": "tasks/t1/prompt.md",
    "judgePromptFile": "tasks/t1/judge.md",
    "chromiumSha": "abc123",
    "title": "…",
    "difficulty": "simple",
    "scoring": {}
  }
]
```

`promptFile` and `judgePromptFile` are relative to the tasks file. Each task is a folder under `configs/tasks/<taskId>/` with `prompt.md` and `judge.md`. Leading and trailing whitespace is trimmed. Each prompt's version is the first 8 hex characters of the sha256 of its trimmed text, so editing a prompt gives it a new version with nothing to bump by hand. Every run stores the `prompt_version` and `judge_prompt_version` it was given, and the dashboard's Prompt versions panel groups runs by them. The judge returns one decision: `failed`, `partially-failed`, `partially-pass`, or `pass`. `success` is stored for `pass` and `partially-pass`.

`configs/benchmark-setup.json`:

```json
[
  {
    "configId": "codebase-memory",
    "description": "…",
    "model": "claude-opus-5-5",
    "mcpConfig": ["configs/setup/codebase-memory/mcp.json"],
    "toolPromptFile": "configs/setup/codebase-memory/tools.md",
    "strictMcpConfig": true,
    "allowedTools": ["Bash", "Read"],
    "disallowedTools": [],
    "permissionMode": "acceptEdits",
    "extraFiles": ["skills/foo/SKILL.md"]
  }
]
```

Each config is a folder under `configs/setup/<configId>/`. That folder holds the config's setup notes and any file the config needs, such as an MCP server definition. `toolPromptFile` is optional markdown, relative to the repo root, that tells the agent which tools that config adds and when to use them. The runner appends it after the baseline prompt. Paths in `mcpConfig`, `toolPromptFile`, and `extraFiles` are relative to the repo root. Their contents are hashed into `config_hash`, along with the shared baseline (hook settings, the Bash guard, and its prompt). Editing any of them shows up as a new config version. The baseline guard is not a config in `benchmark-setup.json`: every config gets the same `cd` ban, the same shell-edit ban, and the same baseline prompt. A config adds its own tool prompt only when `toolPromptFile` is set.

## Data model

| Table / view           | One row per            | Notes                                                                                                                                              |
| ---------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tasks`                | task                   | `scoring` is JSON text. `prompt_version` / `judge_prompt_version` are the current prompts' versions                                                |
| `configs`              | config                 | `tools` / `permissions` are JSON text, and `config_hash` identifies the exact setup                                                                |
| `runs`                 | task × config × repeat | status `running` / `done` / `crashed` / `cancelled`, plus the agent's metrics. `branch` equals `run_id`; `changed_files` and `raw_result` are JSON |
| `judge_runs`           | judge session          | one row per run. The judge's own cost, tokens, duration, `decision`, `success`, `blocked`, and `blockers`. `cancelled` has no decision             |
| `tool_calls`           | hook event             | `phase` is `pre` / `post`. For Bash, `program` is the executable the parsed script runs (`git`, `rg`, `head`), one row per program                 |
| `tool_attempts` (view) | attempted tool call    | joins pre ↔ post on `tool_use_id`. `ran = 0` means it was blocked or denied                                                                        |

`openDb()` creates `data/bench.sqlite` with `bun:sqlite`. View the results with `bun run start:dashboard`. Remove a run with `bun run start:inspect`: Ctrl-x twice deletes the highlighted row. The Chromium branch and the files under `runs/<run_id>/` stay.

## Environment variables

| Variable          | Default                      | Used by                                                                       |
| ----------------- | ---------------------------- | ----------------------------------------------------------------------------- |
| `CHROMIUM_SRC`    | `../src` (next to this repo) | runner: the checkout that gets reset                                          |
| `BENCH_DB_PATH`   | `data/bench.sqlite`          | runner and hook                                                               |
| `BENCH_RUN_ID`    | — (the runner sets it)       | hook: logs only when it's set, so normal Claude Code sessions aren't recorded |
| `BENCH_HOOK_DUMP` | —                            | hook: appends raw hook payloads to this file, for debugging                   |

## Design choices

- **SQLite in WAL mode** lets many short-lived hook processes write while the runner holds the DB open, with no Docker or server to start.
- **tool-log never blocks a tool.** It always exits 0, and if the DB write fails it appends the row to `~/.claude/bench-hook-fallback.jsonl` instead.
- **The baseline guard denies `cd` and shell file edits** on every config, then exits 0. The agent uses absolute paths or `git -C`, and Edit or Write for file contents. `cd`, `pushd`, and `popd` are also in the settings deny list.
- **Bun built-ins only**: `bun:sqlite`, Bun Shell (`$`), `Bun.spawn`, `Bun.file` and `Bun.CryptoHasher`. Type checking is `bun check` and formatting is `bun fmt` (120 columns).

## Dashboard

`bun run start:dashboard` starts Grafana in Docker at <http://localhost:3000> with the [SQLite plugin](https://grafana.com/grafana/plugins/frser-sqlite-datasource/). `bun run start:dashboard:stop` stops it and the snapshot loop. No login is needed (anonymous admin, bound to localhost only).

Grafana reads `dashboard/snapshot/bench.sqlite`, a copy of `data/bench.sqlite` that `dashboard/snapshot.sh` refreshes every 5 seconds (`SNAPSHOT_SECONDS` changes it). The script shells out to the `sqlite3` CLI, which is preinstalled on macOS. It doesn't read the live DB because Docker can't share SQLite's WAL index with the host, which causes `database is locked (261)` errors when panels query at once. The dashboard is therefore up to 5 seconds behind.

The setup lives in `dashboard/`: `docker-compose.yml`, `provisioning/` (datasource and dashboard provider) and `dashboards/overview.json` (the panels, task, config and run filters, auto-refresh every 30s). The Blockers section, below the summary charts, counts blocked runs, charts blockers by config and kind, and lists each blocker with the judge's explanation in a wrapped `what happened` column. The Prompt versions table has one row per task and prompt version, with when that version was first and last run and how it scored. The runs table includes each run's prompt versions, branch, short commit, file count, and the tools it called. Bash is listed by the program the script ran (`git ×4, grep ×2, Edit ×5`). The Tools by run table uses that same split, and Bash commands lists each script with those programs. The Changed files table lists every path that differs from the task commit. Edit panels in the Grafana UI, then export the JSON back into `dashboards/` to keep the change.
