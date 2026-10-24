# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

agent-bench benchmarks Claude Code on real tasks in a Chromium checkout under different tool setups ("configs"). For every task × config × repeat it resets Chromium to a fixed SHA, runs one headless `claude -p` session, and records the result plus every tool call in a local SQLite DB (`data/bench.sqlite`). Configs are compared with plain SQL.

The repo expects to live at `chromium/agent-bench/`, next to the Chromium checkout at `chromium/src/`. `CHROMIUM_SRC` defaults to `../src`, and the hook commands in `hooks/settings.example.json` resolve `"$CLAUDE_PROJECT_DIR"/../agent-bench/hooks/tool-log.ts`, so don't rename the folder or hardcode absolute paths.

Read `docs/overview.md` for the full layout, data model and input file shapes. Load the `bun` skill before editing `src/`, `hooks/`, `db/schema.sql` or `bunfig.toml`, and the `code-styling` skill before writing or reviewing code. Both are in `.claude/skills/`.

## Commands

Bun 1.4.4 only: no Node, `tsc`, Prettier, ESLint or runtime npm dependencies. Ask before adding any dependency.

```sh
bun run typecheck        # bun check (src/ + hooks/ per tsconfig include); bun check path/to/file.ts for one file
bun run format:check     # bun fmt --check; fix with bun fmt (printWidth 120 in bunfig.toml [fmt])
bun run db:shell         # sqlite3 on data/bench.sqlite; read-only: sqlite3 -readonly data/bench.sqlite "SELECT ..."
bun src/main.ts [--tasks f] [--configs f] [--repeats n] [--only-task id] [--only-config id] [--timeout-min 60] [--sync] [--force]
```

Both typecheck and format:check must pass before finishing a change. The husky pre-commit hook (`.husky/pre-commit`, installed by `bun install`) runs `bun fmt --staged` and `bun run typecheck`. `bun lint` doesn't exist on stable 1.4.4, so the `[lint.rules]` in `bunfig.toml` is inert. There are no tests yet; when adding them use `bun test` with `*.test.ts`, and give DB tests a temp file via `openDb(tmpPath)`.

## Things that will bite you

- **The runner is destructive.** `bun src/main.ts` runs `git reset --hard`, `git clean -fdq` and `checkout --detach` in `CHROMIUM_SRC` (default `../src`), and it spawns real, billed `claude` sessions. Never run it without the user's go-ahead. `tasks.json` / `configs.json` aren't in the repo; the user supplies them at the repo root.
- **Never import `src/main.ts`.** It's a CLI entry point, so it's only ever run with `bun src/main.ts`. An `if (import.meta.main)` guard means importing it won't start a benchmark, but don't rely on that: put anything another module or a test needs into `src/runner/` or another module.
- **Never delete `data/` or `data/bench.sqlite*`** (including the `-wal`/`-shm` files). They hold the results.
- **`db/schema.sql` runs on every `openDb()`**, so every statement must be idempotent (`IF NOT EXISTS`). To change an existing table, also give the user the `ALTER TABLE` to run.
- **The hook must never block a tool.** `hooks/tool-log.ts` must always exit 0, do nothing unless `BENCH_RUN_ID` is set, and fall back to `~/.claude/bench-hook-fallback.jsonl` when the DB write fails.
- **Editing `hooks/settings.example.json` changes every config's `config_hash`.** The hash also covers each config's `mcpConfig` and `extraFiles` contents, so editing those files creates a new config version.

## Architecture

The dependency direction is `src/main.ts` (CLI and run loop) → `src/runner/*` → `src/db.ts` / `src/paths.ts`. `hooks/tool-log.ts` is a separate process that also imports `src/db.ts`.

- `runOne` (`src/runner/run-one.ts`) inserts the `runs` row with `startRun` **before** spawning `claude`. The hook processes then insert `tool_calls` rows whose `run_id` foreign key must already exist. The runner passes `BENCH_RUN_ID` to them through the environment and `--settings hooks/settings.example.json`.
- SQLite runs in WAL mode with `busy_timeout`, so the many short-lived hook processes can write while the runner holds the DB open. Don't remove either setting.
- `src/db.ts` owns every query, as small **synchronous** helpers. Always open the DB with `openDb()`, which uses `strict: true`: use named `$params` in SQL, bind keys without the `$`, and bind `?? null` for optional fields.
- `runClaude` never throws on a failed session. A crash, timeout or unparseable output becomes a result with `is_error: true`, and the run is stored with status `crashed`. Scoring doesn't exist yet, so `success` and `score` stay `NULL`.
- The `tool_attempts` view joins `pre` and `post` hook rows on `tool_use_id`; `ran = 0` means the call was blocked or denied. For Bash, the `pre` phase writes one row per program in a pipeline (`bashPrograms`).
- Shell commands use Bun Shell with an explicit `.cwd(...)` on every call, never a global `$.cwd()`. Repo paths come from `src/paths.ts`.

## Style highlights (full rules in the `code-styling` skill)

- Each file does one job, stated in its one-line header comment. Split a file at ~150 lines or when it mixes jobs.
- Named types go in a sibling `*.types.ts` file. Use `type`, not `interface`.
- A function with more than one parameter takes a single destructured object, and every type nested inside it is a named type.
- No single-letter or abbreviated names (`config`, not `c` or `cfg`). `db` and `i` are the exceptions.
- Every `if` gets braces, with a blank line after each `if` block and before each `return` (unless it's the first statement in its block). `bun fmt` won't add these for you.
