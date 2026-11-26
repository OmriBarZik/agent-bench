You are working in a Chromium source checkout. Chrome's offline dinosaur game normally only runs on the network error page. Make it playable inside Chrome DevTools, as its own tab, so a user can open DevTools, pick the game, and play it with the keyboard while online.

The game in DevTools must be the same code the error page runs. Not a recreation, and not a copy. The point is that the two can never drift apart: after your change, an edit to any of the game's source files must change the game in DevTools on the next build, with nothing else touched.

So the game's code has to reach DevTools at build time, from the game's own sources or from the output of the game's existing build.

Do not commit a copy of the game's code anywhere outside the component the game belongs to. That covers every one of the game's source files and anything derived from them: the source files, a transpiled or bundled version, a renamed file, a file with small edits, and a file that is byte for byte the same. A copy fails this task even when the game then works perfectly, and the benchmark checks the final tree for copies by file name and by content. Do not rewrite the game logic either. You may add new files next to the game, in its own component (for example an entry point or a build target that DevTools depends on), and glue code in DevTools, as long as the game on the error page behaves exactly as before.

Use the game's real images and sounds, the ones the error page uses. Do not redraw or regenerate the sprites or synthesize replacement sounds. Prefer build rules that take the assets from where they are. If you do commit a copy of an image or sound, it must be byte-identical to the original.

Wire everything into the existing DevTools frontend build.

Do not run a full Chromium build. Validate with the chrome-validate tools (`start_build`, then `wait_build`, then `run_chrome`). That rebuilds the DevTools frontend only and launches a stock Chromium with `--custom-devtools-frontend` pointed at it. Open `devtools://devtools/bundled/devtools_app.html`, click your game's tab, and click into the game. `eval` is off for this task. Do not run gn, ninja, autoninja, or siso yourself. If the build fails, read the errors, fix them, and build again.

Keyboard input must reach the game while it is open in DevTools. On your final build (the last successful build, with no edits after it), prove each of these inside DevTools with the game state, not with a guess from a picture. Read `{"state": true}` and take a screenshot at each step:

1. Jump: press Space to start, then Space again, and read `state` while the dinosaur is in the air: it must say it is jumping.
2. Duck, while the key is held: send `{"key_down": "ArrowDown"}`, read `state` (it must say the dinosaur is ducking) and take a screenshot, and only then send `{"key_up": "ArrowDown"}`. A `{"key": "ArrowDown"}` step releases the key before the next step runs, so a `state` read after it proves nothing.
3. Restart: let the dinosaur run into an obstacle and read `state` (crashed). Wait about two seconds, press Space, and read `state` again: it must be playing, not crashed, and `playCount` must have gone up.

Do not finish until a build succeeds and all three have passed on that build. In your final message, say how the game's code gets from where the game lives into DevTools (targets and files), and give the `state` values you read for jump, duck and restart.
