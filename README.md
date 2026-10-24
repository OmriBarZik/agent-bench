# agent-bench

Benchmarks Claude Code on real tasks in a Chromium checkout under different tool setups (MCP servers, skills, allowed tools, model). Each task × config × repeat resets Chromium to a fixed commit, runs one headless `claude -p` session, and records the result and every tool call in a local SQLite DB. You compare configs with plain SQL.

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

## Usage

Put `benchmark-tasks.json` and `benchmark-setup.json` in `configs/` (shapes in [docs/overview.md](docs/overview.md#input-files)), then:

```sh
bun src/main.ts                               # every task × config
bun src/main.ts --only-task t1 --repeats 3    # one task, 3 repeats
bun run db:shell                              # query data/bench.sqlite
bun run inspect                               # list runs; enter opens the transcript, tab checks out the branch
bun run inspect -- <branch>                   # check out that run's branch
```

> ⚠️ Each run wipes uncommitted work in `chromium/src` (`git reset --hard` + `git clean -fd`). The runner refuses to start if tracked files are modified, unless you pass `--force`.
>
> Each run also checks out a branch named after its run id at the task SHA, then commits the agent's edits onto that branch when the session ends. `bun run inspect` lists those runs from the database. Enter opens the run's transcript in the browser, and Tab checks the branch out in `chromium/src` so you can build it. Ignored build output is left in place. `bun run inspect -- --force` discards uncommitted tracked changes that block the switch.

| Flag                 | Default                        | Description                                                     |
| -------------------- | ------------------------------ | --------------------------------------------------------------- |
| `--tasks <path>`     | `configs/benchmark-tasks.json` | Tasks file                                                      |
| `--configs <path>`   | `configs/benchmark-setup.json` | Configs file                                                    |
| `--repeats <n>`      | `1`                            | Runs per task × config                                          |
| `--only-task <id>`   | all                            | Run only this task                                              |
| `--only-config <id>` | all                            | Run only this config                                            |
| `--timeout-min <n>`  | `60`                           | Kill a `claude` session after this many minutes                 |
| `--sync`             | off                            | Run `gclient sync -D` after each checkout                       |
| `--force`            | off                            | Run even if `chromium/src` has uncommitted changes (wipes them) |

See [docs/overview.md](docs/overview.md) for how a run works, the data model and example queries.
