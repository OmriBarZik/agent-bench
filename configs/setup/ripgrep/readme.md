# ripgrep

[baseline](../baseline/readme.md) plus [ripgrep](https://github.com/BurntSushi/ripgrep). It is an ordinary command. The agent runs `rg` through Bash. There is no MCP server and no index. With `strictMcpConfig` and no `mcpConfig`, the session does not load MCP servers from `~/.claude.json`. `allowedTools` includes `Bash(rg *)`, so a headless session can run those searches without a permission prompt.

[tools.md](tools.md) is appended to the session prompt. It tells the agent it must search with `rg` instead of Grep. Each search reads the checkout, so there is nothing to build beforehand.

Install the [shared requirements](../../../docs/setup.md#requirements) first, then the binary below.

```sh
bun run start --only-config ripgrep
```

Commands in this page run from the agent-bench repo root.

## Install the binary

macOS:

```sh
brew install ripgrep
```

On Linux, install the `ripgrep` package of the distribution, or run `cargo install ripgrep`. The bench process inherits the `PATH` of the shell that launches `bun run start`. The agent runs `rg` with no directory prefix, so the command has to resolve there.

`rg` does not keep an index. It skips files that `.gitignore` ignores, so build output such as `out/` stays out of the search. The session prompt tells the agent to pass `--no-config`, so a file named by `RIPGREP_CONFIG_PATH` does not change the run.
