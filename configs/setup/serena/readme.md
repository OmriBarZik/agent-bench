# serena

[baseline](../baseline/readme.md) plus [Serena](https://github.com/oraios/serena). [`mcp.json`](mcp.json) is what starts the server: `serena start-mcp-server` on stdio, in the session directory. The `serena` entry in [`benchmark-setup.json`](../../benchmark-setup.json) allows `mcp__serena__*`, so the agent can call every tool that server exposes. Nothing is written to `~/.claude.json`.

[tools.md](tools.md) is appended to the session prompt. It names these tools and when to use them instead of Grep and Read.

Install the [shared requirements](../../../docs/setup.md#requirements) first, then the binary below. The same binary is what you point at another repo. This config does not hardcode the Chromium checkout: the runner starts `claude` in `CHROMIUM_SRC`, and `--project-from-cwd` activates that tree.

```sh
bun run start --only-config serena
```

Commands in this page run from the agent-bench repo root.

## Install the binary

macOS and Linux. `uv` installs the `serena` command and leaves `~/.claude.json` unchanged. This config starts the server from `configs/setup/serena/mcp.json`.

```sh
curl -LsSf https://astral.sh/uv/install.sh | sh
uv tool install -p 3.13 serena-agent
serena init
```

`uv tool install` puts the binary on `PATH`, usually `~/.local/bin`. The bench process inherits the `PATH` of the shell that launches `bun run start`. `mcp.json` runs `serena` with no directory prefix, so the command has to resolve there.

```sh
command -v serena
serena --version
```

`serena init` writes Serena's own config under `~/.serena`. The bench config is the Claude Code connection.

## Keep Serena's folder out of the run

Serena stores the project index in `.serena/` at the checkout root. The runner's `git clean -fd` deletes untracked files, and the end of a run commits whatever is left. Add the folder to the checkout's exclude list once so it survives the reset and stays out of `changed_files`:

```sh
exclude="$(git -C "${CHROMIUM_SRC:-../src}" rev-parse --git-path info/exclude)"
grep -qxF '/.serena/' "$exclude" || echo '/.serena/' >> "$exclude"
```

The first session downloads language servers and builds the symbol index. Later sessions reuse `.serena/`. A C++ tree the size of Chromium can spend the run's timeout on that first index. For precise C++ references, generate `compile_commands.json` in the checkout. JavaScript, TypeScript, and the other languages Serena detects do not need one.
