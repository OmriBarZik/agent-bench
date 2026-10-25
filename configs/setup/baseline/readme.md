# baseline

Plain Claude Code. No MCP servers, default tools, `permissionMode` `acceptEdits`, model `claude-sonnet-5-5`.

Install the [shared requirements](../../../docs/setup.md#requirements) first. This config adds nothing else. With `strictMcpConfig` and no `mcpConfig`, the session does not load MCP servers from `~/.claude.json`.

```sh
bun run start --only-config baseline
```
