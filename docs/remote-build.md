# Remote builds

This Mac runs the agents and keeps the results database. A second Mac checks out the run branch and builds Chrome. Ctrl-B in `bun run start:inspect` sends that branch, builds `chrome`, and copies `Chromium.app` back here.

Each Mac keeps its own Chromium checkout. The runner resets the one on this Mac. The checkout on the build Mac is only for building.

Leave both computers on the addresses they already have. The build Mac's current address goes in the config below.

## On the build Mac

1. Turn on Remote Login (System Settings → General → Sharing).
2. In Terminal on the build Mac, print the account name SSH uses:

```sh
whoami
```

That value is `user` in the config, and it is the name of the home folder (`/Users/<that name>`). The title in System Settings → Users & Groups is the display name.

3. Clone depot_tools wherever you want it. `fetch` needs that directory on `PATH` while you create the checkout. The build itself uses the `depotTools` path from the config, because an SSH session does not load your shell profile:

```sh
git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git ~/src/depot_tools
```

4. Check out Chromium with `fetch chromium`. The path of that `src/` directory is `source` in the config.

Note the address you will put in `hostName`: the IP of the interface you want the copy to use, or the Mac's Bonjour name (`Name.local`). A Thunderbolt address uses the cable. A Wi-Fi address uses Wi-Fi. Either one is fine.

The build runs under `caffeinate`, so the build Mac stays awake while `chrome` compiles.

## On this Mac

```sh
bun run setup:remote-build
```

The first run copies [configs/builder/remote.yaml.example](../configs/builder/remote.yaml.example) to `configs/builder/remote.yaml` and stops. That copy is gitignored. Fill it in:

| Field            | Where     | Meaning                                                                                               |
| ---------------- | --------- | ----------------------------------------------------------------------------------------------------- |
| `host`           | SSH alias | Name the inspect list uses, as in `ssh builder`.                                                      |
| `hostName`       | Build Mac | Its current IP, or a name such as `Mac-mini.local`.                                                   |
| `user`           | Build Mac | Output of `whoami` there. The example value `your-user` is rejected until you replace it.             |
| `source`         | Build Mac | Absolute path of the Chromium `src/` checkout.                                                        |
| `depotTools`     | Build Mac | Absolute path of `depot_tools`, wherever it is cloned. The directory that contains `autoninja`.       |
| `buildDirectory` | This Mac  | Where each run's app is copied, in a folder named after the run id. Omit it to use `~/chrome-builds`. |
| `identityFile`   | This Mac  | SSH key. `~` is expanded by ssh. Omit it to use the default key.                                      |

Run setup again:

```sh
bun run setup:remote-build
```

That writes `configs/builder/ssh_config` (gitignored) and adds an `Include` line for it at the top of `~/.ssh/config`. Run it again after any change to `remote.yaml`. If another `Include` in `~/.ssh/config` has to stay first, move the new line to just under that one.

Copy the key once, using the `host` name from the file:

```sh
ssh-copy-id builder
ssh builder
```

`ssh builder` should open a shell on the build Mac with no password. The build refuses a password prompt.

## Each run

```sh
bun run start:inspect
```

Highlight a run and press Ctrl-B. The list checks that the build Mac answers and that `source` is a git checkout, then:

1. Sends the run branch, and any submodule commits that branch added.
2. Checks that branch out on the build Mac and runs `autoninja -C out/Default chrome`.
3. Copies `Chromium.app` and the libraries beside it back to `buildDirectory/<run id>/` and opens the app.

Object files stay on the build Mac. The first build writes [configs/builder/args.gn](../configs/builder/args.gn) into `out/Default` when that directory has no `args.gn` yet. Later builds reuse `out/`, so only the branch's changes compile.

Ctrl-C cancels the check or the build and returns to the list. Enter after a finished build returns to the list as well. The app stays open.

The build Mac's checkout is switched with `git switch --force`, which discards tracked edits there. `out/` is left in place.
