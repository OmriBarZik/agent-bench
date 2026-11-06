---
name: validate-build
description: Build your Chromium change and check it in the real browser with the chrome-validate MCP tools (start_build, wait_build, run_chrome). You must use these tools after a change that should compile, before you say you are done, and again after every fix.
---

# Build and check your change

You cannot build Chromium on this machine. Do not run `gn`, `ninja`, `autoninja` or `siso` yourself. You must
use the `chrome-validate` MCP tools (`start_build`, `wait_build`, `run_chrome`) to build your working tree on a
separate build Mac and run the result here. If they are not in your tool list yet, load them with tool search.
Do not finish while the change is unbuilt.

## The loop

1. Finish a coherent change first. A build takes minutes even when it only rebuilds what you touched, so don't build
   after every small edit.
2. `start_build`: snapshots the working tree as it is now (new files and submodule edits included) and starts
   building `chrome`. It returns right away with a build number.
3. `wait_build`: blocks until that build ends. You use no time or tokens while it waits.
   - **Failed**: you get only the compiler errors. Fix them, then go back to step 2.
   - **Still running** after the wait limit: call `wait_build` again.
   - **ok**: the local Chromium is now that build. The result names the build number and snapshot.
4. `run_chrome`: starts that build headless with a fresh profile, opens a URL and runs your actions:
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

## Tips

- Edits keep going into the working tree while a build runs. That build compiles the snapshot taken at
  `start_build`, and only one build runs at a time.
- `start_build` on an unchanged tree returns the previous build instead of rebuilding.
- Useful pages: `chrome://dino` (the offline dinosaur game; press Space to start), and
  `devtools://devtools/bundled/devtools_app.html` (the DevTools frontend in a tab).
- Prefer an `eval` that returns the exact state you need over many screenshots. A screenshot costs far more tokens
  than a short JSON value.
- A failed build means your change does not compile. Do not finish with a build that fails.
