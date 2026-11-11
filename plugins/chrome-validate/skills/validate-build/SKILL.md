---
name: validate-build
description: Build your Chromium change and check it in the real browser with the chrome-validate MCP tools (start_build, wait_build, run_chrome). You must use these tools after a change that should compile, before you say you are done, and again after every fix.
---

# Build and check your change

You cannot build Chromium on this machine. Do not run `gn`, `ninja`, `autoninja` or `siso` yourself. You must
use the `chrome-validate` MCP tools (`start_build`, `wait_build`, `run_chrome`) to build your working tree on a
separate build Mac and run the result here. If they are not in your tool list yet, load them with tool search.
Do not finish while the change is unbuilt.

The build target depends on the task: a full `chrome` binary, the offline dino TypeScript only, or the DevTools
frontend only. `wait_build` tells you which output is ready and how to open it.

## The loop

1. Finish a coherent change first. A build takes time even when it only rebuilds what you touched, so don't build
   after every small edit.
2. `start_build`: snapshots the working tree as it is now (new files and submodule edits included) and starts
   building this task's target. It returns right away with a build number.
3. `wait_build`: pauses you until that build ends. You use no time or tokens while it waits, and the wait
   does not count toward your session. You are resumed when the build finishes. The build has its own time limit.
   - **Failed**: you get only the compiler errors, including when the build ran out of time. Fix them, then go
     back to step 2.
   - **ok**: the result names the build number, snapshot, and how to check the change with `run_chrome`.
4. `run_chrome`: starts Chromium headless with a fresh profile, opens a URL and runs your actions:
   - `{"key": "Space"}`, `{"key": "ArrowDown", "hold_ms": 400}` press keys like a user would.
   - `{"click": {"x": 400, "y": 300}}` clicks at a point in the viewport, for example to focus the game.
   - `{"wait_ms": 300}` pauses, for at most 30000 ms per wait. For a longer run, chain several waits. A longer
     value is cut to 30000 and the result says so.
   - `{"eval": "document.title"}` or `{"eval": "const r = await foo(); return r;"}` runs JavaScript in the page.
     Not for dino or DevTools tasks.
   - `{"state": true}` returns the dino game state on the dino harness, `chrome://dino`, or a DevTools panel: playing, crashed,
     speed, distance, playCount (it goes up when a game starts after its intro animation, and on every restart), and the T-Rex status, position, jumping,
     and ducking. Read it twice with a wait between to see the game move or restart.
   - `{"screenshot": true}` returns an image (at most 8 per call). Look at it.
   - `flags` adds Chromium switches, such as `["--enable-features=MyFeature"]` for code behind a feature flag.
   - Console messages and page exceptions come back too.
5. If something looks wrong, edit, then go back to step 2. You can build as many times as you need. Every build is
   recorded.

`run_chrome` always runs the newest **successful** build. It warns you when the tree has changed since that build:
then you are testing old code, so build again first.

## Task modes

- **Full chrome** (cross-module / built-in AI work): `start_build` builds `chrome`. `run_chrome` launches that
  Chromium.app. Useful pages include `chrome://dino`, which always opens as an error page
  (`net::ERR_INTERNET_DISCONNECTED`): that is the game page, and `eval`, keys, and `state` all work on it.
- **Dino** (offline game TypeScript only): `start_build` builds the neterror/dino TypeScript. `run_chrome` with
  url `"dino"` opens a harness that boots your rebuilt game with Chromium's own sprites and sounds. Check it the
  way a player sees it: key presses, waits, screenshots, and `{"state": true}`. `eval` and other URLs are refused,
  so don't load or patch the game yourself; if it does not start, the console and exceptions say why, so fix the
  source and build again. For the 2x sprites, pass `flags: ["--force-device-scale-factor=2"]`. Do not expect a
  full Chromium rebuild.
- **DevTools**: `start_build` builds `devtools_frontend_resources`. `run_chrome` launches a stock Chromium with
  `--custom-devtools-frontend` pointed at that front_end. Open `devtools://devtools/bundled/devtools_app.html`
  and click your panel's tab (`?panel=` only accepts Chromium's built-in panel ids; a new id is an invalid URL).
  Pass a wider `width`, such as 1600, if the tab is hidden behind the » overflow menu. Then use it as a user does:
  `{"click": {"x": …, "y": …}}` into the game (pick the point from a screenshot), key presses, screenshots, and
  `{"state": true}`, which finds the game in the page or any of its frames. `eval` and pages outside DevTools are
  refused. After you stop, the benchmark itself checks the final tree: copied sprites and sounds byte for byte
  against `components/neterror/resources`, that every new file is in the build lists, that the final tree was
  the one that built, and that the game plays in your panel.

## Tips

- `run_chrome` calls run one at a time. Calls sent together just wait their turn, so send them one by one.
- Edits keep going into the working tree while a build runs. That build compiles the snapshot taken at
  `start_build`, and only one build runs at a time.
- `start_build` on an unchanged tree returns the previous build instead of rebuilding.
- Prefer an `eval` (or `state` on a dino or DevTools task) that returns the exact state you need over many screenshots. A
  screenshot costs far more tokens than a short JSON value.
- A failed build means your change does not compile. Do not finish with a build that fails.
