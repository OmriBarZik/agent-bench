# sift

[baseline](../baseline/readme.md) plus [sift](https://github.com/svent/sift), a grep alternative. It is an ordinary command. The agent runs `sift` through Bash. There is no MCP server and no index. With `strictMcpConfig` and no `mcpConfig`, the session does not load MCP servers from `~/.claude.json`.

[tools.md](tools.md) is appended to the session prompt. It names `sift` and when to use it. Each search reads the checkout, so there is nothing to build beforehand.

Install the [shared requirements](../../../docs/setup.md#requirements) first, then the binary below.

```sh
bun run start --only-config sift
```

Commands in this page run from the agent-bench repo root.

## Install the binary

macOS and Linux. Go 1.23 or newer:

```sh
bun run setup:sift
```

That runs `go install github.com/svent/sift@latest`. The `sift` binary lands in `GOBIN`, or in `$(go env GOPATH)/bin` (usually `~/go/bin`) when `GOBIN` is unset. If that directory is not on `PATH`, the command prints the `export` to add and exits with an error. Open a new shell after changing `PATH`, then run the command again. The bench process inherits the `PATH` of the shell that launches `bun run start`. The agent runs `sift` with no directory prefix, so the command has to resolve there.

`sift` does not keep an index. The session prompt tells the agent to pass `--git`, so gitignored build output such as `out/` stays out of the search, and `--no-conf`, so `~/.sift.conf` does not change the run.
