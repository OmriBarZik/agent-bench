# tre-agrep

[baseline](../baseline/readme.md) plus `agrep` from [TRE](https://github.com/laurikari/tre), a search that matches a regular expression approximately, within a number of character errors. Some systems package the same program as `tre-agrep`. It is an ordinary command. The agent runs `agrep` through Bash. There is no MCP server and no index. With `strictMcpConfig` and no `mcpConfig`, the session does not load MCP servers from `~/.claude.json`. `allowedTools` includes `Bash(agrep *)`, so a headless session can run those searches without a permission prompt.

[tools.md](tools.md) is appended to the session prompt. It tells the agent it must try `agrep` before it gives up on a name `grep` did not find, and how to set the error limit. The baseline `grep` rule stays, because `agrep` reads only the files it is given and does not walk a directory.

Install the [shared requirements](../../../docs/setup.md#requirements) first, then the binary below.

```sh
bun run start --only-config tre-agrep
```

Commands in this page run from the agent-bench repo root.

## Install the binary

macOS:

```sh
brew install tre
```

The `tre` formula installs the library and the `agrep` command. On Debian and Ubuntu the package is `tre-agrep`, and so is the command, so link it to `agrep` on `PATH`. The bench process inherits the `PATH` of the shell that launches `bun run start`. The agent runs `agrep` with no directory prefix, so the command has to resolve there.

The Setups tab only checks that a command named `agrep` is on `PATH`. Another program with that name, such as the Wu-Manber `agrep`, passes the check but takes other flags. `agrep -V` names TRE when the right one is installed.
