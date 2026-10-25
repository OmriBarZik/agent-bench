# codebase-memory

[baseline](../baseline/readme.md) plus the [codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) graph. [`mcp.json`](mcp.json) starts the `codebase-memory-mcp` binary on stdio. `allowedTools` includes `mcp__codebase-memory-mcp__*`, so a headless session can call every tool from that server without a permission prompt.

Install the [shared requirements](../../../docs/setup.md#requirements) first, then the binary and the index below.

```sh
bun run start --only-config codebase-memory
```

Commands in this page run from the agent-bench repo root.

## Install the binary

macOS and Linux:

```sh
curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash -s -- --skip-config
```

`--skip-config` installs the binary and leaves `~/.claude.json` unchanged. This config starts the server from `configs/setup/codebase-memory/mcp.json`. The binary is `~/.local/bin/codebase-memory-mcp`. If that directory is not on `PATH`, add it and open a new shell:

```sh
export PATH="$HOME/.local/bin:$PATH"
command -v codebase-memory-mcp
codebase-memory-mcp --version
```

On Windows, pass the same flag to `install.ps1`. The binary is installed under `%LOCALAPPDATA%\Programs\codebase-memory-mcp`, and the installer adds that directory to the user `PATH`.

```powershell
Invoke-WebRequest -Uri https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.ps1 -OutFile install.ps1
Unblock-File .\install.ps1
.\install.ps1 --skip-config
```

The bench process inherits the `PATH` of the shell that launches `bun run start`. `mcp.json` runs `codebase-memory-mcp` with no directory prefix, so the command has to resolve there.

## Index the checkout first

`auto_index` is off. Building the graph during a session spends the run's timeout on indexing. Index the Chromium tree once before the first `codebase-memory` run:

```sh
bun run setup:codebase-memory-mcp
```

Pass the absolute path of `CHROMIUM_SRC` when it is not `../src`. The graph is stored in `~/.cache/codebase-memory-mcp` (override with `CBM_CACHE_DIR`), outside the checkout, so `git clean` does not delete it.

A command-line index is a snapshot of that tree. Check the task's `chromiumSha` out, then index, when you want the graph to match the commit the agent will see. A later task at another SHA needs its own index.

## Include the experiment's third_party

The DevTools task needs `third_party/devtools-frontend`, where panels and drawer views are registered. The dinosaur game itself is in `components/neterror/resources/dino_game`. The indexer skips `.gitignore`, then `.cbmignore` at the checkout root. `out/` is already gitignored. Write a `.cbmignore` that keeps the DevTools frontend and skips the rest of `third_party/`:

```sh
cat > ../src/.cbmignore << 'EOF'
third_party/*
!third_party/devtools-frontend/
!third_party/devtools-frontend/**
out/
EOF
exclude="$(git -C ../src rev-parse --git-path info/exclude)"
grep -qx '.cbmignore' "$exclude" || echo '.cbmignore' >> "$exclude"
```

`.git/info/exclude` is local to the Chromium clone. `git clean -fd` keeps ignored files, so the exclude entry is what preserves `.cbmignore` across runs. Re-run `bun run setup:codebase-memory-mcp` after writing `.cbmignore` so the graph includes `third_party/devtools-frontend`.
