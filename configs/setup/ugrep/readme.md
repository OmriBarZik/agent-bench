# ugrep

[baseline](../baseline/readme.md) plus [ugrep](https://ugrep.com), a grep alternative. It is an ordinary command. The agent runs `ugrep` through Bash. There is no MCP server and no index. With `strictMcpConfig` and no `mcpConfig`, the session does not load MCP servers from `~/.claude.json`. `allowedTools` includes `Bash(ugrep *)`, so a headless session can run those searches without a permission prompt. `ug`, the variant that loads a `.ugrep` config file, is not in that list.

[tools.md](tools.md) is appended to the session prompt. It tells the agent it must search with `ugrep` instead of Grep. Each search reads the checkout, so there is nothing to build beforehand.

Install the [shared requirements](../../../docs/setup.md#requirements) first, then the binary below.

```sh
bun run start --only-config ugrep
```

Commands in this page run from the agent-bench repo root.

## Install the binary

macOS:

```sh
brew install ugrep
```

On Linux, install the `ugrep` package of the distribution. The bench process inherits the `PATH` of the shell that launches `bun run start`. The agent runs `ugrep` with no directory prefix, so the command has to resolve there.

This config does not use `ugrep-indexer`. The session prompt tells the agent to pass `--ignore-files`, so gitignored build output such as `out/` stays out of the search, and `--no-config`, so a `.ugrep` file does not change the run.
