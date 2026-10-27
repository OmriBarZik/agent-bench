# agent-bench

Benchmarks Claude Code on real tasks in a Chromium checkout under different tool setups (MCP servers, skills, allowed tools, model). Each task × config × repeat resets Chromium to a fixed commit, runs one headless `claude -p` session, and records the result and every tool call in a local SQLite DB. You compare configs in the dashboard, and remove runs from the inspect TUI.

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
bun run start                                 # every task × config
bun run start --only-task t1 --repeats 3      # one task, 3 repeats
bun run start:inspect                         # list runs; enter opens the transcript, ctrl-b builds it on the other Mac, ctrl-x twice removes the run, tab checks out the branch
bun run start:inspect <branch>                # check out that run's branch
bun run start:dashboard                       # view results in Grafana at http://localhost:3000
```

> ⚠️ Each run wipes uncommitted work in `chromium/src` (`git reset --hard` + `git clean -fd`), including checked-out submodules. The runner refuses to start if tracked files are modified, unless you pass `--force` or answer yes when asked to delete those changes.
>
> Each run also checks out a branch named after its run id at the task SHA, then commits the agent's edits onto that branch when the session ends, including files inside submodules. `bun run start:inspect` lists those runs from the database. Enter opens the run's transcript in the browser, Ctrl-b checks the build Mac and then builds that branch and copies the app back, and Tab checks the branch out in `chromium/src` so you can build it locally. Ignored build output is left in place. `bun run start:inspect --force` discards uncommitted tracked changes that block the switch.

| Flag                 | Default                        | Description                                               |
| -------------------- | ------------------------------ | --------------------------------------------------------- |
| `--tasks <path>`     | `configs/benchmark-tasks.json` | Tasks file                                                |
| `--configs <path>`   | `configs/benchmark-setup.json` | Configs file                                              |
| `--repeats <n>`      | `1`                            | Runs per task × config                                    |
| `--only-task <id>`   | all                            | Run only this task                                        |
| `--only-config <id>` | all                            | Run only this config                                      |
| `--timeout-min <n>`  | `60`                           | Kill a `claude` session after this many minutes           |
| `--sync`             | off                            | Run `gclient sync -D` after each checkout                 |
| `--force`            | off                            | Wipe uncommitted changes in `chromium/src` without asking |

See [docs/overview.md](docs/overview.md) for how a run works, the data model, and the dashboard.
