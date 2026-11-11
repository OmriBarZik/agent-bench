# Remote builds

This Mac runs the agents and keeps the results database. A second Mac checks out the run branch and builds Chrome. In the Runs tab of `bun run start` (`bun run start:inspect`), Ctrl-B asks where to build the highlighted run. `l` builds on this Mac. `r` sends the branch to the build Mac, builds `chrome` there, and copies `Chromium.app` back here.

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
5. Install ccache (`brew install ccache`). The build wraps the compiler with it. A non-interactive ssh session does not load Homebrew's PATH; the build appends `/opt/homebrew/bin` and `/usr/local/bin` when `ccache` is not already visible.

Note the address you will put in `hostName`: the IP of the interface you want the copy to use, or the Mac's Bonjour name (`Name.local`). A Thunderbolt address uses the cable. A Wi-Fi address uses Wi-Fi. Either one is fine.

When the two Macs are joined by a Thunderbolt cable, you can skip the address and set `connection: Thunderbolt Bridge` instead. A Thunderbolt Bridge address is self-assigned (`169.254.x.x`) and can change after a reboot or a re-plug. With `connection`, SSH looks the build Mac up on that link every time it connects: it pings the IPv6 all-nodes address on the bridge, and the one reply that isn't from this Mac is the build Mac. If no other machine answers, or more than one does, the connection fails with a message saying so.

The build runs under `caffeinate`, so the build Mac stays awake while `chrome` compiles.

## On this Mac

```sh
bun run setup:remote-build
```

The first run copies [configs/builder/remote.yaml.example](../configs/builder/remote.yaml.example) to `configs/builder/remote.yaml` and stops. That copy is gitignored. Fill it in:

| Field            | Where     | Meaning                                                                                               |
| ---------------- | --------- | ----------------------------------------------------------------------------------------------------- |
| `host`           | SSH alias | Name the Runs tab uses, as in `ssh builder`.                                                          |
| `hostName`       | Build Mac | Its current IP, or a name such as `Mac-mini.local`. Set this, `connection`, or both.                  |
| `connection`     | This Mac  | Port name (`Thunderbolt Bridge`) or device (`bridge0`) that links only the two Macs.                  |
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

Set both `connection` and `hostName` to keep building when the cable is out. `hostName` is then the build Mac's Wi-Fi address (System Settings → Wi-Fi → Details on the build Mac, or its `Name.local`). SSH tries the cable first. When nobody answers on it, which takes about two seconds to find out, SSH connects to `hostName`, and the build log has a line saying so. Setup prints whether `hostName` answers on the SSH port. A Wi-Fi IP from DHCP can change; the `.local` name does not. Copying `Chromium.app` back is slower over Wi-Fi.

With `connection`, the Host block has a `ProxyCommand` (`src/builder/peer/peer-proxy.ts`) instead of a `HostName`, and `known_hosts` stores the build Mac's key under the alias (`builder`), not under an IP. After you switch from `hostName` to `connection`, run `ssh builder` once by hand and accept the key. Builds run SSH in batch mode, which cannot answer that prompt.

## Each run

```sh
bun run start:inspect
```

Highlight a run and press Ctrl-B. The list asks where to build:

- `l` checks the branch out in this Mac's Chromium tree and runs `autoninja -C out/Default chrome`. `autoninja` has to be on `PATH` in the shell that started the TUI. The build writes [configs/builder/args.gn](../configs/builder/args.gn) into `out/Default` when that file is missing or differs, then runs `gn gen`. Those args are Chromium's faster Mac build: a release component build, no symbols, Apple's linker (`use_lld = false`), and ccache. ccache has to be installed (`brew install ccache`). When its ceiling is below 50 GiB, the build raises it. The app opens from `out/Default/Chromium.app` in the checkout, with the quiet switches from `src/chromium-flags.ts` (`--use-mock-keychain`, `--no-first-run`, `--no-default-browser-check`, `--disable-features=DialMediaRouteProvider`), so macOS never asks for the keychain password and no first-run dialog appears. Uncommitted tracked changes block the checkout unless the TUI was started with `--force`.
- `r` checks that the build Mac answers and that `source` is a git checkout, then:

  1. Sends the run branch, and any submodule commits that branch added.
  2. Checks that branch out on the build Mac and runs `autoninja --fast_local -C out/Default chrome`. SSH has no tty, and siso turns fast local off unless the flag is passed. The ccache wrapper also sets `modules` sloppiness and depend mode, because Chromium compiles with `-fmodules` and ccache otherwise refuses those calls.
  3. Copies `Chromium.app` and the libraries beside it back to `buildDirectory/<run id>/` and opens the app with the same quiet switches. A queue copies each app back and leaves it closed.

Object files stay on the build Mac. The build writes [configs/builder/args.gn](../configs/builder/args.gn) into `out/Default` when that file is missing or differs, then runs `gn gen`. Later builds reuse `out/`, so only the branch's changes compile. A non-interactive ssh session does not load Homebrew's PATH. When `ccache` is not already visible, the build appends `/opt/homebrew/bin` and `/usr/local/bin`.

Ctrl-C cancels the check or the build and returns to the list. Enter after a finished build returns to the list as well. The app stays open.

## When the build Mac's toolchain changes

Every object file depends on Xcode, the macOS SDK, and Chromium's clang. When one of them changes, such as an Xcode update from the App Store, the next `chrome` build recompiles everything (about 60,000 steps, over an hour), and ccache cannot reuse its old entries because the headers differ. Turn off automatic Xcode updates on the build Mac to choose when that happens.

A finished `chrome` build records the three versions in `out/Default/.agent-bench-toolchain` on the build Mac. A lighter target does not, because it leaves the object files stale. Before each build the script compares them, and the build log says so when they differ. The Setups tab asks the build Mac the same question in the background and shows the answer on the shared line as `build mac`: `toolchain unchanged`, `toolchain changed` with the old and new values, `no chrome build recorded`, or `unreachable`. `r` asks again. The entry is absent when `configs/builder/remote.yaml` does not exist.

The build Mac's checkout is switched with `git switch --force`, which discards tracked edits there. `out/` is left in place.
