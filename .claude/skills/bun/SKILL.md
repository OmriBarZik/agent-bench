---
name: bun
description: Rules for writing, checking and running TypeScript in agent-bench with Bun 1.4.4 (bun check, bun fmt, bun:sqlite results DB, Bun.spawn, Claude Code hooks). Use before editing src/ or hooks/, adding dependencies, touching db/schema.sql or bunfig.toml, writing tests, or running typecheck/format.
---

# Bun in agent-bench

For the project layout and how a run works, see `docs/overview.md`.

agent-bench runs Claude Code sessions against a Chromium checkout and stores the results in a local SQLite file (`data/bench.sqlite`). There's no Docker and no DB server. It uses **Bun 1.4.4** for everything. There is no Node, no `tsc`, no Prettier, and no ESLint. The only runtime dependency is `unbash`, which the baseline guard uses to parse Bash. Ask before adding another.

## Before you finish any change

```sh
bun run typecheck      # = bun check (uses tsconfig.json: src/ + hooks/)
bun run format:check   # = bun fmt --check (exits 1 if anything needs formatting)
bun fmt                # fix formatting; or `bun fmt --changed` / `bun fmt --staged`
```

Both checks must pass. `bun check` only checks files that `tsconfig.json` `include`s (`src`, `hooks`), so add a new top-level code folder to `include`. To check a single file and its imports, run `bun check path/to/file.ts`.

## Tooling facts (Bun 1.4.x, verified Oct 2026)

- **`bun check`** (added in 1.4.3) is a built-in type checker ported from typescript-go and reports the same errors as `tsc`. It never emits JS or `.d.ts` files. Don't add `typescript` back as a dependency or run `tsc`/`npx tsc`.
  - Other forms: `bun run --check file.ts` type-checks and then runs, and `bun test --check` does the same for tests.
- **`bun fmt`** (added in 1.4.4) is a Prettier-compatible formatter for TS, JSON, YAML, Markdown, TOML and more.
  - `bunfig.toml` `[fmt]` sets `printWidth = 120`, and everything else is a Prettier default (double quotes, semicolons, trailing commas). Change formatting options there, not with CLI flags or a `.prettierrc`. `.editorconfig` mirrors these settings for editors (and `bun fmt` reads it too), so change both together. Don't hand-format; run `bun fmt`.
  - `bun format` runs the package.json `format` script, while `bun fmt` is the formatter itself. Both work here.
- **`bun lint` is canary-only.** It isn't in 1.4.4 stable (`bun lint` prints `Script not found "lint"`). The `[lint.rules]` section in `bunfig.toml` is therefore inert on stable Bun. Also, `"bun/format"` is not a documented rule: formatting is `bun fmt`, not a lint rule.
  - Don't add a lint script or CI step unless the user moves to canary (`bun upgrade --canary`).
  - Rule names follow ESLint, e.g. `"no-console" = "warn"`.
- The only devDependencies are `@types/bun` and `husky`, and `tsconfig.json` sets `"types": ["bun"]`.
- `bun install` runs the `prepare` script, which installs the husky hooks. `.husky/pre-commit` runs `bun fmt --staged` (it formats staged files and stages them again) and then `bun run typecheck`.

## Bun conventions

For file structure, naming, comments and when to split a file, see the `code-styling` skill.

- **Prefer Bun built-ins over packages:**
  - `bun:sqlite` instead of `better-sqlite3` or a DB server.
  - `Bun.spawn`/`Bun.spawnSync` instead of `execa`.
  - `Bun.file(p).json()/.text()/.arrayBuffer()` and `Bun.write` instead of `fs.readFile`.
  - `Bun.CryptoHasher`, `Bun.sleep`, `Bun.argv` and `Bun.stdin.text()`.
  - `node:util` `parseArgs` for CLI flags.
  - Ask the user before adding any dependency.
- Import Node modules with the `node:` prefix (`node:fs`, `node:path`, `node:os`).
- Repo paths come from `src/paths.ts` (built on `import.meta.path`). Never use `__dirname` or redefine them.
- Entry scripts (`src/main.ts`, `hooks/tool-log.ts`) are ESM TypeScript run directly with `bun file.ts`, with a `#!/usr/bin/env bun` shebang and a usage JSDoc on `main()`.
  - A file that is both imported and executed must guard its entry point with `if (import.meta.main)`. `bashPrograms` lives in `hooks/bash-programs.ts`; `hooks/tool-log.ts` imports it there and does not re-export it.
  - `src/main.ts` is a CLI entry point that's only run with `bun src/main.ts`. It guards `await main()` with `if (import.meta.main)`, so an import won't start a benchmark, but never import it from other modules or tests.
- Read env config with `process.env.X ?? default`. The variables are `BENCH_DB_PATH`, `BENCH_RUN_ID`, `BENCH_HOOK_DUMP` and `CHROMIUM_SRC`.

## SQLite (`bun:sqlite`) rules

`src/db/db.ts` owns every query. Add new queries there as small exported **synchronous** `function x(db: Database, ...)` helpers. `bun:sqlite` is synchronous, so don't make them `async`.

- Always open the DB through `openDb(path = DB_PATH)`, never with `new Database()` elsewhere. It does the following:
  - creates `data/` and the file if needed;
  - sets `journal_mode = WAL`, `busy_timeout = 5000` and `foreign_keys = ON`;
  - applies `db/schema.sql`.
- WAL mode and `busy_timeout` let many short-lived hook processes write while the runner holds the DB open. Don't remove them.
- The DB is opened with `strict: true`.
  - Use named `$params` in SQL and pass the keys **without** the `$`, e.g. `.run({ runId })`.
  - A missing key throws instead of silently binding `NULL`.
- Never interpolate values into SQL strings. Always bind parameters.
- Use `db.query(sql)` (a cached statement) with `.run()`, `.get()` or `.all()`. `.get()` returns `null` when no row matches.
- Bind `?? null` for optional fields. The code does this everywhere, so keep it consistent.
- Booleans bind as `1/0` and come back as numbers.
- JSON columns are `TEXT`.
  - Write them with the `j()` helper (`JSON.stringify`; `null` stays `NULL`).
  - Read them with `JSON.parse`, or in SQL with `json_extract(col, '$.x')` or `col->>'x'`.
- Timestamps are ISO-8601 UTC text from `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`.
- Use `db.transaction(fn)` for multi-statement writes. `fn` must be synchronous, because anything after an `await` runs outside the transaction.
- Always `db.close()` when a script is done (the runner and hook do).

## Database schema

- `db/schema.sql` is applied on **every** `openDb()`, so each statement must be idempotent (`CREATE TABLE/INDEX/VIEW IF NOT EXISTS`). SQLite has no `CREATE OR REPLACE VIEW`.
- To add a table or index, add it to `schema.sql`.
- To change an existing table, also give the user the `ALTER TABLE` to run with `bun run db:shell`, because `CREATE ... IF NOT EXISTS` won't alter it. `db:shell` needs the `sqlite3` CLI, which is preinstalled on macOS.
- **Never delete `data/` or `data/bench.sqlite*` without asking**, because they hold the benchmark results. The `-wal`/`-shm` sidecar files belong to the DB; don't delete them while anything has it open.
- For ad-hoc queries, use `bun run db:shell` or `sqlite3 -readonly data/bench.sqlite "SELECT ..."`.

## Hooks (`hooks/tool-log.ts`)

- These are Claude Code PreToolUse/PostToolUse hooks. The input is JSON on stdin (`Bun.stdin.text()`) and the phase is `Bun.argv[2]` (`pre`/`post`).
- **tool-log must never block or fail a tool.** Keep all three of these behaviours in any change to `hooks/tool-log.ts`:
  - it always ends with `process.exit(0)`;
  - it does nothing unless `BENCH_RUN_ID` is set;
  - it falls back to `~/.claude/bench-hook-fallback.jsonl` when the DB write fails.
- `hooks/baseline-guard.ts` may deny a Bash call (no `cd`, no shell file edits). That guard is the shared baseline, and it still exits 0: the deny decision is JSON on stdout. It parses Bash with `unbash` rather than a handwritten tokenizer.
- `tool_calls.run_id` is a foreign key, so the `runs` row must exist before the hook fires. The runner calls `startRun` before spawning `claude`.
- The baseline files (`hooks/settings.example.json`, the guard sources, and `src/baseline-policy.ts`) are part of `config_hash`, so editing them changes every config's hash.
- Set `BENCH_HOOK_DUMP=/path/file.jsonl` to capture the raw hook payloads when debugging.

## Runner (`src/main.ts` + `src/runner/`)

- **It is destructive.** It runs `git reset --hard`, `git clean -fdq` and `checkout --detach` in `CHROMIUM_SRC` (default `../src`). Never run it for a quick test without the user's go-ahead.
- Short commands (git, gclient, `claude --version` in `src/runner/chromium/chromium.ts` and `src/runner/claude/claude.ts`) use Bun Shell with an explicit `.cwd(...)` on each call. Never use a global `$.cwd()`, because it leaks across modules. A non-zero exit throws a `ShellError` that carries stderr.
  - Use `.text()` (implies quiet; `.trim()` it) or `.quiet()`. Interpolated values like `${sha}` are escaped. Don't add a `spawnSync` wrapper back.
- `runClaude` in `src/runner/claude/claude.ts` spawns `claude -p ... --output-format json` with `Bun.spawn({ timeout, env: { ...process.env, BENCH_RUN_ID } })` and reads stdout/stderr with `new Response(proc.stdout).text()` in parallel with `proc.exited`.
- Run artifacts go to `runs/<run_id>/` (gitignored).

## Tests

There are no tests yet. When adding them, use `bun test`:

- Files are `*.test.ts`, with `import { test, expect, describe, mock } from "bun:test"`.
- Use `bun test --check` to type-check first.
- Pure helpers like `bashPrograms` are the first candidates.
- Tests that need the DB should call `openDb(tmpPath)` with a fresh temp file, never the real `data/bench.sqlite`.
- Never import `src/main.ts` in a test (see above).

## Docs

When unsure about an API, read the current docs instead of relying on memory. Bun changed a lot in 1.4.x.

- Index for agents: https://bun.com/docs/llms.txt
- Key pages: https://bun.com/docs/runtime/sqlite.md, https://bun.com/docs/runtime/child-process.md, https://bun.com/docs/runtime/bunfig.md, https://bun.com/docs/test/index.md
- Release notes: https://bun.com/blog/bun-v1.4.4 (`bun fmt`) and https://bun.com/blog/bun-v1.4.3 (`bun check`)
