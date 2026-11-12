# zoekt

[baseline](../baseline/readme.md) plus [Zoekt](https://github.com/sourcegraph/zoekt), a trigram-index code search. `zoekt` and `zoekt-index` are ordinary commands. The agent runs `zoekt` through Bash. There is no MCP server. With `strictMcpConfig` and no `mcpConfig`, the session does not load MCP servers from `~/.claude.json`. `allowedTools` includes `Bash(grep *)` and `Bash(zoekt *)`, so a headless session can run those searches without a permission prompt. `zoekt-index` is not in that list.

[tools.md](tools.md) is appended to the session prompt. It tells the agent it must search with `zoekt`, and how to write a query. The checkout is indexed before the run, so that prompt tells the agent not to index it again.

Install the [shared requirements](../../../docs/setup.md#requirements) first, then the binaries and the index below.

```sh
bun run start --only-config zoekt
```

Commands in this page run from the agent-bench repo root.

## Install the binaries

macOS and Linux. Go 1.26 or newer:

```sh
bun run setup:zoekt
```

That runs `go install` for `github.com/sourcegraph/zoekt/cmd/zoekt@latest` and `github.com/sourcegraph/zoekt/cmd/zoekt-index@latest`. They land in `GOBIN`, or in `$(go env GOPATH)/bin` (usually `~/go/bin`) when `GOBIN` is unset. If that directory is not on `PATH`, the command prints the `export` to add and exits with an error. Open a new shell after changing `PATH`, then run the command again. The bench process inherits the `PATH` of the shell that launches `bun run start`. The agent runs `zoekt` with no directory prefix, so the command has to resolve there.

## Index the checkout first

Building the index during a session spends the run's timeout on indexing. Index the Chromium tree once before the first `zoekt` run:

```sh
bun run setup:zoekt-index
```

`setup:zoekt-index` runs `zoekt-index -index ~/.zoekt -ignore_dirs .git,.hg,.svn,out -disable_ctags` on the checkout. `zoekt` reads `~/.zoekt` when `-index_dir` is not passed, and it has no environment variable for another directory. The shards are named after the checkout directory, so a second run replaces them. Keep other repositories out of `~/.zoekt`: `zoekt` searches every shard in it. The directory is outside the checkout, so `git clean` does not delete it.

- `-ignore_dirs` matches a directory name at any depth, so a nested directory named `out` is skipped too.
- `-disable_ctags` leaves symbol data out. The index is the same on a machine with and without Universal Ctags, and the session prompt tells the agent not to use `sym:`.
- A file larger than 2 MiB is not indexed.

`CHROMIUM_SRC` overrides the path when it is not `../src`. Check the task's `chromiumSha` out, then index, when you want the index to match the commit the agent will see. Unlike `csearch`, `zoekt` answers from the index alone: a file the agent edits is searched as it was at index time. A rebuild takes about 10 minutes and 20 GB, so the index is built once and reused across tasks at other SHAs. The session prompt tells the agent that the index is a snapshot that can come from another commit, that it has to read a file before it relies on a result, and that `grep` is allowed for files the index does not hold or holds out of date.
