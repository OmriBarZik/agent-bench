# typescript

[baseline](../baseline/readme.md) plus a TypeScript language server for JavaScript and TypeScript. The plugin is [`plugins/typescript-lsp`](../../../plugins/typescript-lsp/.claude-plugin/plugin.json). It runs `typescript-language-server --stdio` on the TypeScript 6.0.2 `tsserver` the checkout ships in `third_party/devtools-frontend/src/node_modules/typescript` (the same version Chromium builds with; the copy in `third_party/node` has no `_tsserver.js`). The plugin passes that path in `initializationOptions`, relative to the checkout root. The runner passes the plugin with `--plugin-dir`. Nothing is written to `~/.claude.json`.

TypeScript 7's `tsc --lsp` is not used. It only answers pull diagnostics (`textDocument/diagnostic`) and never sends `textDocument/publishDiagnostics`, and Claude Code only reads published diagnostics, so runs on that server got no diagnostics at all.

After the agent edits a JavaScript or TypeScript file, Claude Code feeds it that file's diagnostics. [tools.md](tools.md) tells the agent to read those diagnostics and to use the `LSP` tool for definitions, references, and types. C and C++ files have no language server in this config. [`clangd-typescript`](../clangd-typescript/readme.md) loads both.

With `strictMcpConfig` and no `mcpConfig`, the session does not load MCP servers from `~/.claude.json`.

Install the [shared requirements](../../../docs/setup.md#requirements) first, then the binary below.

```sh
bun run start --only-config typescript
```

Commands in this page run from the agent-bench repo root.

## Install the language server

macOS and Linux. Node.js is required, because `typescript-language-server` is a Node.js script:

```sh
bun install -g typescript-language-server
bun run setup:typescript
```

The bench process inherits the `PATH` of the shell that launches `bun run start`. The plugin runs `typescript-language-server` with no directory prefix, so that command and `node` have to resolve there. `setup:typescript` checks both and the checkout's `tsserver`. It does not install anything.

Web UI sources in Chromium have no `tsconfig.json` next to them (the build generates one under `out/`), so the server used to check them as an inferred project without the build's path mappings: `chrome://resources/js/assert.js` was not found, and a pristine `offline.ts` showed 155 diagnostics, 144 of them errors. The config's `checkoutFiles` now copies [`checkout/tsconfig.json`](checkout/tsconfig.json) to the checkout root before every run (git-ignored through `info/exclude`, so the run never commits it). It extends Chromium's `tools/typescript/tsconfig_base.json`, includes `components/*/resources/**/*.ts`, and maps `chrome://resources/*` and `//resources/*` to `ui/webui/resources`, Lit to `third_party/lit/v3_0/lit.ts`, and `/strings.m.js` to its definitions file. A pristine `offline.ts` now shows no errors, only 11 deprecation hints. DevTools frontend files resolve their relative imports and come back clean, as before. `clangd-typescript` uses the same file. [tools.md](tools.md) tells the agent to read the diagnostics on the lines it changed.
