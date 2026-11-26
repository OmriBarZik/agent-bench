You are working in a Chromium source checkout. Chrome has an offline game where a T-Rex dinosaur runs, jumps and ducks over obstacles. Find where that dinosaur is implemented and give it a hat.

This is what a player must see when you are done:

- The dinosaur wears a hat that anyone would recognize as a hat, sitting on its head, in every state: waiting (before the game starts), running, jumping, ducking and crashed. When the dinosaur ducks, its head moves forward and down, and the hat must move with the head.
- The hat is there at both display scales, the 1x sprites and the 2x sprites.
- The hat bounces when the dinosaur jumps: it lifts off above the dinosaur's head during the jump and lands back on the head when the dinosaur lands. It does not bounce at other times; while the dinosaur is waiting, running or ducking the hat sits still on its head.
- The whole hat stays inside the game canvas at every moment. At the top of a jump the dinosaur's head is already close to the top edge of the canvas, so a hat that lifts off there is cut off or disappears unless you leave room for it.
- Nothing else changes. The hat is drawing only: the game's behavior, its timing and its collision boxes stay exactly as they are.

Do not run a full Chromium build. Validate with the chrome-validate tools (`start_build`, then `wait_build`, then `run_chrome` with url `"dino"`). That rebuilds the offline-game TypeScript and opens a harness that boots your rebuilt game with Chromium's own sprites and sounds. Check it by pressing keys, taking screenshots, and reading the game state with the `state` action; `eval` is not available for this task, so do not load or patch the game yourself. Do not run gn, ninja, autoninja, or siso yourself. If the build fails, read the errors, fix them, and build again.

The proof of this task is screenshots. The reviewer opens the screenshots from your final build and looks at them; a description of what they show counts for nothing. On your final build (the last successful build, with no edits after it), capture all five of these at 1x, then all five again at 2x (`flags: ["--force-device-scale-factor=2"]`):

1. Waiting: the page before any key is pressed.
2. Running: after Space has started the game and the dinosaur is back on the ground.
3. Jumping, near the top of the jump: press Space, then take two or three screenshots spread over the next 150 to 400 ms, and read `state` next to them to confirm the dinosaur is in the air. The hat must be lifted off the head and completely inside the canvas.
4. Ducking, while the key is held: send `{"key_down": "ArrowDown"}`, then take the screenshot and read `state` (it must say the dinosaur is ducking), and only then send `{"key_up": "ArrowDown"}`. A `{"key": "ArrowDown"}` step releases the key before the next step runs, so a screenshot after it shows a running dinosaur and proves nothing about ducking.
5. Crashed: let the dinosaur run into an obstacle, confirm `state` says it crashed, then take the screenshot.

One `run_chrome` call returns at most 8 screenshots, so use at least one call per scale. The reviewer sees only the last 24 screenshots of the final build, so keep the whole set within that. Look at every screenshot yourself. If the hat is missing, cut off, detached from the head in a state where it should sit still, or hard to recognize as a hat in any of the ten, fix the source, build again, and capture the whole set again: screenshots of an older build do not count.

Do not finish until a build succeeds and you have the ten screenshots from that build. End your final message with a list of them in the order you took them: state, scale, and one line on what the hat looks like there.
