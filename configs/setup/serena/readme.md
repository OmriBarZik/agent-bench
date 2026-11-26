# serena

[baseline](../baseline/readme.md) plus [Serena](https://github.com/oraios/serena). [`mcp.json`](mcp.json) is what starts the server: `serena start-mcp-server` on stdio, in the session directory, with `--agent-interface tools` and the context in [`context.yml`](context.yml) (`../agent-bench/configs/setup/serena/context.yml`, relative to the checkout). The context's `fixed_tools` limits the server to `initial_instructions`, `get_symbols_overview`, `find_symbol`, `find_referencing_symbols`, `find_declaration`, `find_implementations` and `get_diagnostics_for_file`. There is no shell, file, edit or memory tool. Serena's default REPL interface (`serena_repl`) is not used: it runs arbitrary Python, so its `s.shell` facade, or a plain `import subprocess`, went around the baseline guard and `allowedTools`. The `serena` entry in [`benchmark-setup.json`](../../benchmark-setup.json) allows `mcp__serena__*`. Nothing is written to `~/.claude.json`.

[tools.md](tools.md) is appended to the session prompt. It tells the agent it must use Serena's MCP tools before Grep, Glob, or Read.

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

## Configure the checkout

```sh
bun run setup:serena
```

That copies [`project.yml`](project.yml) to `CHROMIUM_SRC/.serena/project.yml` and adds `/.serena/` to the checkout's `info/exclude`, so the runner's `git clean -fd` keeps it and the end of a run does not commit it. The project file:

- starts two language servers: `typescript` (Serena installs `typescript-language-server` with TypeScript 5.9 through `npm` on first start, under `~/.serena/language_servers`) and `cpp`. With `language_servers: []`, every symbol call failed with `Active language servers: []`.
- runs `cpp` as the checkout's own `third_party/llvm-build/Release+Asserts/bin/clangd` with `--background-index=false`, through `ls_specific_settings`. Serena's default is a downloaded clangd 19 with `--background-index`, which would index all of Chromium during the run. Without the index, C++ references and implementations are found only in the files clangd has opened. clangd reads the checkout's `compile_commands.json` (`bun run setup:clangd`).
- turns `ignore_all_files_in_gitignore` off and lists `out`, `.serena`, `node_modules` and `.git` in `ignored_paths` instead. Serena walks every source file before each `find_referencing_symbols`, `find_declaration`, `find_implementations` and `get_diagnostics_for_file` call. Matching about 320,000 files against Chromium's `.gitignore` files made that walk take over 5 minutes, longer than the tool timeout; without the matching it takes about 9 seconds.
- sets `read_only: true`.

Serena applies a project's `ls_specific_settings` only when the project is trusted. `~/.serena/serena_config.yml` must list the checkout under `trusted_project_path_patterns`; `setup:serena` fails until it does:

```yaml
trusted_project_path_patterns:
  - /Users/you/Projects/chromium/src
```

Serena rewrites `.serena/project.yml` in its own layout on every start. The Setups tab compares the values of the keys in `configs/setup/serena/project.yml` with that file, so the rewrite passes and `language_servers: []` fails.

## Keep Serena's folder out of the run

Serena stores the project index in `.serena/` at the checkout root. The runner's `git clean -fd` deletes untracked files, and the end of a run commits whatever is left. Add the folder to the checkout's exclude list once so it survives the reset and stays out of `changed_files`:

```sh
exclude="$(git -C "${CHROMIUM_SRC:-../src}" rev-parse --git-path info/exclude)"
grep -qxF '/.serena/' "$exclude" || echo '/.serena/' >> "$exclude"
```

Serena caches document symbols in `.serena/cache/`. It builds them file by file as the agent asks, not up front. The first call of a session waits about 15 seconds for the language servers and the first walk of the tree.
