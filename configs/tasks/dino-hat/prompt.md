You are working in a Chromium source checkout. Chrome has an offline game where a T-Rex dinosaur runs, jumps and ducks over obstacles. Find where that dinosaur is implemented and give it a hat.

The hat must bounce when the dinosaur jumps: it lifts off above the dinosaur's head during the jump and lands back on its head when the dinosaur lands, so it looks bouncy. It must not bounce at other times; while the dinosaur is running or ducking the hat sits still on its head.

The hat must be visible in every state (waiting, running, jumping, ducking, crashed) and at both display scales (1x and 2x sprites), without changing the game's behavior or collision boxes.

Do not run a full Chromium build. Validate with the chrome-validate tools (`start_build`, then `wait_build`, then `run_chrome` with url `"dino"`). That rebuilds the offline-game TypeScript and opens a harness so you can press keys, take screenshots, and eval the running game. Do not run gn, ninja, autoninja, or siso yourself. If the build fails, read the errors, fix them, and build again. Do not finish until a build succeeds and you have checked the hat in the harness.
