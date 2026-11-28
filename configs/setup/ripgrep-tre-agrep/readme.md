# ripgrep-tre-agrep

[baseline](../baseline/readme.md) plus both [ripgrep](../ripgrep/readme.md) (`rg`) and [TRE agrep](../tre-agrep/readme.md) (`agrep`) in the same session. It measures whether the two search commands together do better than each alone. Both are ordinary commands that the agent runs through Bash. There is no MCP server and no index. With `strictMcpConfig` and no `mcpConfig`, the session does not load MCP servers from `~/.claude.json`. `allowedTools` includes `Bash(rg *)` and `Bash(agrep *)`, so a headless session can run those searches without a permission prompt.

[tools.md](tools.md) is appended to the session prompt. It splits the work: `rg` for every search across the tree or for a known spelling, `agrep` on a directory's files for a name `rg` did not find or whose spelling is a guess. Like `ripgrep`, it tells the agent not to use `grep`. When the agent greps anyway, [reminder.md](reminder.md) names both commands.

The reminder hook counts a call to either command as using the setup, so a run that uses only `rg` gets no nudge toward `agrep`, and the run's setup tool count sums both. To see how much each command was used, count `tool_calls.program` for `rg` and `agrep`.

Install the [shared requirements](../../../docs/setup.md#requirements) first, then both binaries as their own pages describe.

```sh
brew install ripgrep tre
bun run start --only-config ripgrep-tre-agrep
```

Commands in this page run from the agent-bench repo root.
