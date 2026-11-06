# clangd

[baseline](../baseline/readme.md) plus [clangd](https://clangd.llvm.org/), the language server Chromium uses for C and C++. The plugin is [`plugins/clangd-lsp`](../../../plugins/clangd-lsp/.claude-plugin/plugin.json). The runner passes it with `--plugin-dir` and puts the checkout's clangd first on `PATH` for this config and for [`clangd-typescript`](../clangd-typescript/readme.md). Nothing is written to `~/.claude.json`.

After the agent edits a C or C++ file, Claude Code feeds it that file's diagnostics. That is the compile hint. Background indexing is off, so clangd only checks files the agent opens and does not spend the run indexing the tree. [tools.md](tools.md) tells the agent to read those diagnostics and to use the `LSP` tool for definitions, references, and types.

With `strictMcpConfig` and no `mcpConfig`, the session does not load MCP servers from `~/.claude.json`.

Install the [shared requirements](../../../docs/setup.md#requirements) first, then clangd and the compilation database below.

```sh
bun run start --only-config clangd
```

Commands in this page run from the agent-bench repo root.

## Install clangd from the checkout

A system clangd reports the wrong errors. Use the binary that matches Chromium's compiler. In the `.gclient` next to `src/`, set `custom_vars.checkout_clangd` to `True` on the `src` solution, then sync. Chromium's [clangd.md](https://chromium.googlesource.com/chromium/src/+/main/docs/clangd.md) has the full snippet.

```sh
gclient sync
```

The binary is `third_party/llvm-build/Release+Asserts/bin/clangd` inside the checkout. The runner prepends that directory to `PATH` for a `clangd` or `clangd-typescript` session, so the shell that launches `bun run start` does not have to.

## Write the compilation database

clangd needs `compile_commands.json` at the checkout root. Without it, every diagnostic says the file has no compile command, and that is not a compile result. The current tasks share one SHA. Check that SHA out, make sure `out/Default` exists (`gn gen out/Default` when it does not), then:

```sh
bun run setup:clangd
```

That runs `tools/clang/scripts/generate_compdb.py -p out/Default`. The file it writes is gitignored, so `git clean` keeps it. Regenerate it when the task SHA changes or the build files change. A full chrome build makes generated headers exist. clangd still runs without that build, and a missing generated header is then a pre-existing diagnostic, not proof the edit failed to compile.
