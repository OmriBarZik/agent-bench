# clangd-typescript

[baseline](../baseline/readme.md) plus both language servers: [clangd](../clangd/readme.md) for C and C++, and the [TypeScript language server](../typescript/readme.md) for JavaScript and TypeScript. The runner passes both plugins with `--plugin-dir`. A session gets diagnostics for whichever of those files the agent edits.

[tools.md](tools.md) tells the agent which server covers which extension, and to read the diagnostics after an edit. `clangd` and `typescript` are the same servers one at a time, so a run of all three configs compares C++ diagnostics, JavaScript diagnostics, and both.

Install the [shared requirements](../../../docs/setup.md#requirements) first, then both setup steps:

```sh
bun run setup:clangd
bun run setup:typescript
bun run start --only-config clangd-typescript
```

The clangd step needs the checkout binary and `compile_commands.json`. The typescript step checks that `typescript-language-server` is on `PATH`. The details are in the two readmes linked above.
