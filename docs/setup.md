# Setup

Every config shares the baseline guard: the shell stays at the checkout root, and file edits go through the Edit and Write tools. `strictMcpConfig` is on for every config, so a session loads only the MCP servers named in that config. A config can also set `toolPromptFile`. That markdown is appended to the session prompt. It names the tools that config adds and tells the agent it must use them. `baseline` adds no tools, so it has no file. How a run works is in [overview.md](overview.md).

Install the [shared requirements](#requirements) first. The steps for a config live in that config's folder.

| Config              | Setup                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------- |
| `baseline`          | [configs/setup/baseline/readme.md](../configs/setup/baseline/readme.md)                   |
| `codebase-memory`   | [configs/setup/codebase-memory/readme.md](../configs/setup/codebase-memory/readme.md)     |
| `serena`            | [configs/setup/serena/readme.md](../configs/setup/serena/readme.md)                       |
| `codesearch`        | [configs/setup/codesearch/readme.md](../configs/setup/codesearch/readme.md)               |
| `sift`              | [configs/setup/sift/readme.md](../configs/setup/sift/readme.md)                           |
| `clangd`            | [configs/setup/clangd/readme.md](../configs/setup/clangd/readme.md)                       |
| `typescript`        | [configs/setup/typescript/readme.md](../configs/setup/typescript/readme.md)               |
| `clangd-typescript` | [configs/setup/clangd-typescript/readme.md](../configs/setup/clangd-typescript/readme.md) |

`bun run start:setups` opens the TUI on the Setups tab. The tab lists every config, how many runs that config has in the database, and whether each check in `configs/setup/<configId>/setup.json` passes. `r` reloads both. A config with no `setup.json` shows `no file`, so a new config stays visible until its checks are declared. `setup.json` is not part of `config_hash`. A check is a `command` on `PATH`, a `file`, or a `directory`. `target` may use `${CHROMIUM_SRC}`, `${HOME}`, `${CSEARCHINDEX}`, or `${CBM_CACHE_DIR}`. `fix` is the command the tab prints when the check fails. `nonEmpty` on a directory check fails when the directory is empty.

## Requirements

These are required for every config.

| Requirement                  | Check                            | Notes                                                                                           |
| ---------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------- |
| [Bun](https://bun.com) 1.4.4 | `bun --version`                  | `bun install` in this repo installs the pre-commit hook                                         |
| `claude` CLI, logged in      | `claude --version`               | The runner and the judge both call it                                                           |
| Chromium checkout            | `CHROMIUM_SRC`, default `../src` | Clone this repo as `agent-bench` next to `src/`. See [overview.md](overview.md#expected-layout) |

The model named on a config has to be available on the Claude account that `claude` uses. Every config uses `claude-sonnet-5-5`.

The judge is a second `claude` session after the agent finishes. It uses `--judge-model`, which defaults to `claude-sonnet-5-5`. It needs the same `claude` CLI and no extra packages.

## Building on another Mac

A second Mac can build the highlighted run and copy `Chromium.app` back here. The same list can build on this Mac. The steps are in [remote-build.md](remote-build.md).
