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
   - `{"wait_ms": 300}` pauses.
   - `{"eval": "document.title"}` or `{"eval": "const r = await foo(); return r;"}` runs JavaScript in the page.
   - `{"screenshot": true}` returns an image (at most 8 per call). Look at it.
   - `flags` adds Chromium switches, such as `["--enable-features=MyFeature"]` for code behind a feature flag.
   - Console messages and page exceptions come back too.
5. If something looks wrong, edit, then go back to step 2. You can build as many times as you need. Every build is
   recorded.

`run_chrome` always runs the newest **successful** build. It warns you when the tree has changed since that build:
then you are testing old code, so build again first.

## Task modes

- **Full chrome** (cross-module / built-in AI work): `start_build` builds `chrome`. `run_chrome` launches that
  Chromium.app. Useful pages include `chrome://dino`.
- **Dino** (offline game TypeScript only): `start_build` builds the neterror/dino TypeScript. `run_chrome` with
  url `"dino"` (or `chrome://dino`) opens a harness that loads your rebuilt game with the real sprites and sounds
  so you can press keys, eval, and screenshot it. Do not expect a full Chromium rebuild.
- **DevTools**: `start_build` builds `devtools_frontend_resources`. `run_chrome` launches a stock Chromium with
  `--custom-devtools-frontend` pointed at that front_end. Open
  `devtools://devtools/bundled/devtools_app.html` (or your new panel URL) and interact with it there.

## Tips

- Edits keep going into the working tree while a build runs. That build compiles the snapshot taken at
  `start_build`, and only one build runs at a time.
- `start_build` on an unchanged tree returns the previous build instead of rebuilding.
- Prefer an `eval` that returns the exact state you need over many screenshots. A screenshot costs far more tokens
  than a short JSON value.
- A failed build means your change does not compile. Do not finish with a build that fails.
