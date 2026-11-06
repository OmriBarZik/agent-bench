# typescript

[baseline](../baseline/readme.md) plus TypeScript 7's language server for JavaScript and TypeScript. The plugin is [`plugins/typescript-lsp`](../../../plugins/typescript-lsp/.claude-plugin/plugin.json). It runs `tsc --lsp --stdio`, the native server, not the TypeScript 6 `tsserver` wrapper. The runner passes it with `--plugin-dir`. Nothing is written to `~/.claude.json`.

After the agent edits a JavaScript or TypeScript file, Claude Code feeds it that file's diagnostics. [tools.md](tools.md) tells the agent to read those diagnostics and to use the `LSP` tool for definitions, references, and types. C and C++ files have no language server in this config. [`clangd-typescript`](../clangd-typescript/readme.md) loads both.

With `strictMcpConfig` and no `mcpConfig`, the session does not load MCP servers from `~/.claude.json`.

Install the [shared requirements](../../../docs/setup.md#requirements) first, then the binary below.

```sh
bun run start --only-config typescript
```

Commands in this page run from the agent-bench repo root.

## Install the language server

macOS and Linux. Node.js is required, because the `tsc` command on `PATH` is a small launcher for the native binary:

```sh
bun install -g typescript
```

That installs TypeScript 7's `tsc`. The bench process inherits the `PATH` of the shell that launches `bun run start`. The plugin runs `tsc` with no directory prefix, so that command has to resolve there, and `tsc --version` has to report 7 or newer. A TypeScript 6 `tsc` has no `--lsp` flag. Open a new shell after installing, then check:

```sh
bun run setup:typescript
```

`setup:typescript` only checks that `tsc` is on `PATH` and is TypeScript 7. It does not install it.
