---
name: code-styling
description: Fundamental code style rules for agent-bench, covering file size and splitting, entry files (main.ts), types in *.types.ts files, one object parameter per function, explicit names (no single-letter variables), comments, braces on every if, and blank-line spacing. Use when writing new code, adding to an existing file, refactoring, or reviewing a change, and whenever a file is getting long or mixes several jobs.
---

# Code styling

These rules cover how code is organised and written, not where things live. For the project layout and what each file does, see `docs/overview.md`. For Bun APIs, the DB, tooling and the before-you-finish checks, see the `bun` skill.

## Rule 1: one job per file, split when it grows

A file does **one job** that you can describe in a single line. Split a file when any of these are true:

- **It's over ~150 lines.** Treat this as a smell, not a hard cap. A file of many small helpers that all do the same job, such as a module of query helpers, may be longer.
- **It mixes jobs.** Examples are CLI parsing, git operations, process spawning, DB writes and file I/O.
- **A function is over ~50 lines,** or a loop body is doing its own unit of work. Move it into a named function, usually in its own file.
- **A new feature would add a second job** to an existing file. Create a new file instead of appending.

How to split:

- **Group a feature's helpers in a folder named after the feature**, next to the code that uses them.
- **A source directory holds at most 8 files.** Count every file directly in the directory: modules, `*.types.ts` files, and tests. Subdirectories do not count toward the parent. The cap covers `src/` and `hooks/`. Generated directories such as `.husky/_`, and the project files at the repo root, sit outside it.
- **A ninth file means a new folder**, named after that part and placed next to the code that uses it. A file in `BASELINE_HASH_FILES`, or an entry script named in `hooks/settings.example.json`, stays at its current path because that path is part of `config_hash`. Its helpers move into the new folder.
- **Constants shared across features go in one shared module.** Don't redefine them per file.
- **Pass in what a module needs.** A module must not read the entry file's CLI args; pass values as parameters or an options object.
- **No import-time side effects in library modules.** That means no global state changes (e.g. `$.cwd()`), no top-level `await`, and no `process.exit`. Only entry files may run code at import.
- **Keep the dependency direction one-way:** entry → feature modules → shared modules. No cycles.

## Rule 2: the program's entry file is `main.ts`

- The file you run to start the program is called `main.ts`, so it's obvious where execution begins.
- It holds argument parsing and a short `main()` that calls into the feature modules. No business logic goes there. The usage block (command line, input file shapes, what a run does) is the JSDoc on `main()`.
- Never import `main.ts` from another module or a test. It's a CLI entry point that's only run with `bun main.ts`. It guards `main()` with `if (import.meta.main)`, so an import won't run it, but code that others need belongs in a feature module.
- A script that a _tool_ invokes by path, such as a Claude Code hook, keeps a name that describes it. It must guard its entry point with `if (import.meta.main)` when anything imports it.

## Rule 3: types live in a `*.types.ts` file next to their module

- Every named `type` goes in a file with the same name plus `.types.ts`, in the same folder: `db.ts` has `db.types.ts`, and `run-one.ts` has `run-one.types.ts`.
- A `.types.ts` file holds only types, no values or logic. Each type gets a JSDoc (see Comments).
- Import types with `import type { X } from "./x.types"` straight from the types file. Don't re-export them through the module.
- Inline object types in a single function signature (`{ runId, outDir }: { runId: string; outDir: string }`) may stay inline. Once a type is named or reused, it moves to the types file.
- Use `type`, not `interface`.

## Naming

- Files are `kebab-case.ts`, and types files are `kebab-case.types.ts`. Folders are named after their feature.
- Use `camelCase` for functions and variables, `PascalCase` for types, and `UPPER_SNAKE` for module-level constants and env-derived config.
- Functions are named with a verb (`resetCheckout`, `loadSelection`). Boolean helpers read as questions (`hasUncommittedChanges`).
- Types that mirror DB rows match the table. Shapes from external tools keep their source's field names, even when that's snake_case.
- See Rule 8: no single-letter or abbreviated names.

## Functions

- Export only what another file uses. Keep the rest module-private.
- Prefer early returns and `?? null` / `?.` over nested `if`s.
- Mark optional fields with `?`, and let `null` represent "absent in the DB".
- A function with more than one parameter takes a single object (see Rule 7).
- Throw `Error` with a message that tells the user what to do (`"... has uncommitted changes; commit/stash them or pass --force"`). Catch errors only in `main().catch` or where you can recover.
- Don't swallow errors silently. Any exception, such as a hook that must never fail its caller, needs a comment saying why.

## Comments

- **No file-level comments.** A file starts with its imports (after the shebang, if any), never a header comment. Put the description on the thing it describes.
- **Exported types and functions** get a one-line `/** ... */` saying what they are or do. A function whose name already says everything may skip it; add detail when there are side effects, something it never does, or an order that matters. `main()` in an entry file carries the usage block: command line, input file shapes, what a run does.
- **Exported constants** get a JSDoc when their meaning isn't obvious from the name.
- **Inline `//` comments** explain _why_, never _what_. Put one where the code would otherwise look wrong.
- Don't leave commented-out code or TODOs without context.

## Rule 4: every `if` gets braces

Always write the body of an `if` / `else if` / `else` in a `{ }` block on its own lines, even when it's a single statement such as `return`, `continue` or `throw`.

```ts
// ✅ always
if (!runId) {
  return;
}
```

```txt
// ❌ never (txt block so bun fmt keeps both forms)
if (!runId) return;
if (!runId)
  return;
```

- This also applies to guard clauses, early returns, and conditions that `bun fmt` wraps over several lines.
- `bun fmt` won't add braces for you, so write them yourself and check with `grep -nE '^\s*(\} )?(else )?if \(' <files> | grep -v '{\s*$'`. The only hits should be the first line of a multi-line condition.
- Ternaries (`a ? b : c`) and `&&`/`??` expressions are fine for _values_. Don't use `cond && doSomething()` as a statement to dodge this rule.

## Rule 5: a blank line after every `if` block

Leave one empty line between an `if` block's closing `}` and the next statement in the same scope, whether that's another `if`, a `return` or anything else. Consecutive `if`s must never touch.

```ts
// ✅ always
if (c.model) {
  a.push("--model", c.model);
}

if (c.strictMcpConfig) {
  a.push("--strict-mcp-config");
}

return a;
```

```txt
// ❌ never
if (c.model) {
  a.push("--model", c.model);
}
if (c.strictMcpConfig) {
  a.push("--strict-mcp-config");
}
return a;
```

- No blank line is needed when the `}` is followed by `else`, by the closing `}` of the enclosing block, or when it's the last line of the file.
- Exactly one blank line, never two. `bun fmt` keeps single blank lines and collapses extras, but it won't add the missing ones for you.
- Always put a space between `if` and `(`, and between `)` and `{` (`if (x) {`). `bun fmt` enforces this, so run it.

## Rule 6: a blank line before every `return`

Put one empty line before a `return` statement. The only exception is when the `return` is the first statement in its block, i.e. right after the `{`.

```ts
// ✅ always
if (resp.error) {
  return true;
}

return false;
```

```txt
// ❌ never
if (resp.error) {
  return true;
}
return false;

const db = new Database(path);
db.run(SCHEMA);
return db;
```

- This applies to every `return`: at the end of a function, inside loops, and in `if` blocks that have other statements before the `return`.
- A comment that belongs to the `return` stays directly above it, and the blank line goes above the comment.
- One-expression arrow functions (`(x) => x + 1`) have no `return` statement and aren't affected.
- `bun fmt` won't add these blank lines, so write them yourself.

## Rule 7: more than one parameter → one destructured object

Any function that takes **more than one** parameter takes a single object instead, destructured in the signature. You can then add, remove or reorder a parameter without touching every call site, and calls read as named arguments.

```ts
// ✅ always
export async function runOne({
  db,
  task,
  config,
  repeat,
  options,
}: {
  db: Database;
  task: Task;
  config: BenchConfig;
  repeat: number;
  options: RunOptions;
}) {}

await runOne({ db, task, config, repeat, options });
```

```txt
// ❌ never
export async function runOne(db: Database, task: Task, config: BenchConfig, repeat: number, options: RunOptions) {}

await runOne(db, task, config, repeat, options);
```

- A function with exactly one parameter keeps a plain one: `openDb(path)`, `toConfigRow(config)`, `bashPrograms(command)`.
- The top-level parameter object may be typed inline in the signature, as above. **Every type inside it must be a name, never a nested inline object.** The same goes for return types: a function returning an object returns a named type (`Promise<RunOneResult>`, not `Promise<{ runId: string; … }>`).

```ts
// ✅ always
}: {
  db: Database;
  score?: Score;
}) {}
```

```txt
// ❌ never
}: {
  db: Database;
  score?: { success?: boolean; score?: number; details?: unknown };
}) {}
```

- Put the named type in the module's `.types.ts` file (Rule 3), with a one-line JSDoc saying what it is. Inside `.types.ts` files, nested shapes get their own named type too (`usage?: ClaudeUsage`).
- Defaults go in the destructuring (`{ sha, sync = false }: { sha: string; sync?: boolean }`), and optional props are marked with `?` in the type.
- Use shorthand at call sites when the names match (`{ db, task }`). That's one more reason to name variables after the parameter they feed.
- This doesn't apply to callbacks whose signature is fixed by someone else, such as `.map((path) => …)`, `.filter(…)` or event handlers.

## Rule 8: explicit names, never single letters

Name every variable, parameter, callback argument and function after what it holds or does. Never use single letters or abbreviations.

```ts
// ✅ always
export function startRun({ db, run }: { db: Database; run: RunStart }) {}
for (const filePath of [...paths].sort()) {
}
words.filter((word) => !/^\w+=/.test(word));
const hasher = new Bun.CryptoHasher("sha256");
```

```txt
// ❌ never
export function startRun({ db, r }: { db: Database; r: RunStart }) {}
for (const p of [...paths].sort()) {}
words.filter((w) => !/^\w+=/.test(w));
const h = new Bun.CryptoHasher("sha256");
```

- This includes loop variables and arrow-function arguments: `task`, `config`, `path`, `word`, `projectDir`, not `t`, `c`, `p`, `w`, `proj`.
- Don't abbreviate either: `config` not `cfg`, `options` not `opts`, `command` not `cmd`, `response` not `resp`, `payload` not `inp`, `selectedTasks` not `selTasks`.
- The only allowed exceptions are names that are the conventional full name of the thing: `db` for the database handle, and loop counters like `repeat`. `i` for a plain index counter is also allowed when nothing more specific fits.
- When two variables would get the same name, name both by role instead of shadowing (`benchConfig` → `upsertConfig({ config: toConfigRow(benchConfig) })`).

## Formatting

Run `bun run lint:fmt:fix` (or `bun fmt`) and never hand-format (`printWidth = 120` from `bunfig.toml` `[fmt]`, otherwise Prettier defaults: double quotes, semicolons, trailing commas). Import order is:

1. `bun` / `bun:*`
2. `node:*`
3. project modules, by relative path (a module's `.types.ts` import sits next to it)

Inside braces, list names alphabetically.
