# codesearch

[baseline](../baseline/readme.md) plus [Code Search](https://github.com/google/codesearch): `cindex`, `csearch`, and `cgrep`, the trigram-index tools from [Regular Expression Matching with a Trigram Index](https://swtch.com/~rsc/regexp/regexp4.html). They are ordinary commands. The agent runs `csearch` and `cgrep` through Bash. There is no MCP server. With `strictMcpConfig` and no `mcpConfig`, the session does not load MCP servers from `~/.claude.json`.

[tools.md](tools.md) is appended to the session prompt. It names these commands and when to use them. The checkout is indexed before the run, so that prompt tells the agent not to index it again.

Install the [shared requirements](../../../docs/setup.md#requirements) first, then the binaries and the index below.

```sh
bun run start --only-config codesearch
```

Commands in this page run from the agent-bench repo root.

## Install the binaries

macOS and Linux. Go 1.23 or newer:

```sh
bun run setup:codesearch
```

That runs `go install github.com/google/codesearch/cmd/...@latest`, which installs `cindex`, `csearch`, and `cgrep`. They land in `GOBIN`, or in `$(go env GOPATH)/bin` (usually `~/go/bin`) when `GOBIN` is unset. If that directory is not on `PATH`, the command prints the `export` to add and exits with an error. Open a new shell after changing `PATH`, then run the command again. The bench process inherits the `PATH` of the shell that launches `bun run start`. The agent runs `csearch` with no directory prefix, so the command has to resolve there.

## Index the checkout first

Building the index during a session spends the run's timeout on indexing. Index the Chromium tree once before the first `codesearch` run:

```sh
bun run setup:codesearch-index
```

`setup:codesearch-index` runs `cindex -reset` on the checkout. It skips hidden names and build directories named `out` or `out_*`. The index is `$CSEARCHINDEX`, or `~/.csearchindex` when that variable is unset. This command and `bun run start` both use the environment of the shell that launches them. Set `CSEARCHINDEX` when you want a file other than `~/.csearchindex`. `cindex -reset` replaces the index it writes. The file is outside the checkout, so `git clean` does not delete it.

`CHROMIUM_SRC` overrides the path when it is not `../src`. Check the task's `chromiumSha` out, then index, when you want the indexed paths to match the commit the agent will see. A later task at another SHA needs its own index. `csearch` reads current file contents, but a file that did not exist at index time stays invisible.
