# agent-bench

Benchmarks Claude Code on real tasks in a Chromium checkout under different tool setups (MCP servers, skills, allowed tools, model). Each task × config × repeat resets Chromium to a fixed commit, runs one headless `claude -p` session, and records the result and every tool call in a local SQLite DB. You compare configs in the dashboard, and remove runs from the Runs tab of the `bun run start` TUI.

## Setup

Requires [Bun](https://bun.com) 1.4.4 and the `claude` CLI. Clone this repo as `agent-bench` next to the Chromium `src/` folder:

```
chromium/
  src/           # Chromium checkout
  agent-bench/   # this repo
```

```sh
bun install
```

What each config needs installed is in [docs/setup.md](docs/setup.md). Building a run on another Mac is in [docs/remote-build.md](docs/remote-build.md).

## Usage

Put `benchmark-tasks.json` and `benchmark-setup.json` in `configs/` (shapes in [docs/overview.md](docs/overview.md#input-files)), then:

```sh
bun run start                                 # on a terminal: a TUI with Start, Runs, and Setups tabs; tab / shift-tab switch
bun run start --cli                           # every task × config, no TUI
bun run start --only-task t1,t2 --repeats 3   # flags skip the TUI (add -i to open it with these preset)
bun run start:inspect                         # the same TUI, opened on the Runs tab (= bun run start --runs); enter opens an action menu, ctrl-o the transcript, ctrl-g checks out
bun run start:setups                          # the same TUI, opened on the Setups tab (= bun run start --setups); which setups are missing, and which configs have been run
bun run start --checkout <branch>             # check out that run's branch, no TUI
bun run start:dashboard                       # view results in Grafana at http://localhost:3000
```

> ⚠️ Each run wipes uncommitted work in `chromium/src` (`git reset --hard` + `git clean -fd`), including checked-out submodules. The runner refuses to start if tracked files are modified, unless you pass `--force` or answer yes when asked to delete those changes.
>
> Each run also checks out a branch named after its run id at the task SHA, then commits the agent's edits onto that branch when the session ends, including files inside submodules. The Runs tab of `bun run start` (or `bun run start:inspect`, which opens on it) lists those runs from the database. Enter opens a menu of everything you can do to the highlighted run, with submenus for building and removing, so you can do it all with ↑↓ and enter; esc goes back. Left and right arrows do nothing. The shortcuts below do the same things directly. Ctrl-o opens the run's transcript in the browser, and ctrl-e the judge's. Ctrl-b asks where to build: `l` builds chrome in `chromium/src`, and `r` checks the build Mac, builds that branch, and copies the app back. Ctrl-p starts that run's Chromium.app when a build left one on disk (a queued build does not open it). Ctrl-f opens the four judge decisions (`failed`, `partially-failed`, `partially-pass`, `pass`); 1–4 or enter sets the highlighted one. Ctrl-x twice removes the run from the database. Ctrl-g checks the branch out in `chromium/src` without building and exits. Ctrl-r reloads the runs from the database, so new runs show without restarting the TUI. Ignored build output is left in place. `--force` discards uncommitted tracked changes that block the switch.

| Flag                  | Default                        | Description                                               |
| --------------------- | ------------------------------ | --------------------------------------------------------- |
| `--tasks <path>`      | `configs/benchmark-tasks.json` | Tasks file                                                |
| `--configs <path>`    | `configs/benchmark-setup.json` | Configs file                                              |
| `--repeats <n>`       | `1`                            | Runs per task × config                                    |
| `--only-task <id>`    | all                            | Run only these tasks (comma-separated or repeated)        |
| `--only-config <id>`  | all                            | Run only these configs (comma-separated or repeated)      |
| `--timeout-min <n>`   | `60`                           | Kill a `claude` session after this many minutes           |
| `--sync`              | off                            | Run `gclient sync -D` after each checkout                 |
| `--force`             | off                            | Wipe uncommitted changes in `chromium/src` without asking |
| `-i`, `--interactive` | off                            | Open the picker even when selection flags are passed      |
| `--cli`               | off                            | Never open the picker                                     |

See [docs/overview.md](docs/overview.md) for how a run works, the data model, and the dashboard.
