# typescript

[baseline](../baseline/readme.md) plus the [TypeScript language server](https://github.com/typescript-language-server/typescript-language-server) for JavaScript and TypeScript. The plugin is [`plugins/typescript-lsp`](../../../plugins/typescript-lsp/.claude-plugin/plugin.json). The runner passes it with `--plugin-dir`. Nothing is written to `~/.claude.json`.

After the agent edits a JavaScript or TypeScript file, Claude Code feeds it that file's diagnostics. [tools.md](tools.md) tells the agent to read those diagnostics and to use the `LSP` tool for definitions, references, and types. C and C++ files have no language server in this config. [`clangd-typescript`](../clangd-typescript/readme.md) loads both.

With `strictMcpConfig` and no `mcpConfig`, the session does not load MCP servers from `~/.claude.json`.

Install the [shared requirements](../../../docs/setup.md#requirements) first, then the binary below.

```sh
bun run start --only-config typescript
```

Commands in this page run from the agent-bench repo root.

## Install the language server

macOS and Linux. Node.js and npm:

```sh
bun install -g typescript-language-server typescript@6
```

That installs `typescript-language-server` and `tsserver`. The pin is `@6` because TypeScript 7's `typescript` package ships `tsc` and does not install `tsserver`, and `typescript-language-server` still runs the TypeScript 6 server. The same install puts TypeScript 6's `tsc` on `PATH`. The bench process inherits the `PATH` of the shell that launches `bun run start`. The plugin runs `typescript-language-server` with no directory prefix, so both commands have to resolve there. Open a new shell after installing, then check:

```sh
bun run setup:typescript
```

`setup:typescript` only checks that both binaries are on `PATH`. It does not install them.
