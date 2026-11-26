You are working in a Chromium source checkout. Chrome has an offline game where a T-Rex dinosaur runs, jumps and ducks over obstacles. Make the dinosaur play the game by itself, driven by a small machine-learning model that is built into the browser and offered to the page as a built-in AI API.

**The model is supplied.** You do not design or train it. Two files are already in the checkout:

- `bench_inputs/dino_decision_model/dino_decision.tflite`: a trained TFLite model. It takes the game state as 21 numbers and returns three probabilities, for `jump`, `duck` and `nothing`.
- `bench_inputs/dino_decision_model/SPEC.md`: its contract. It gives the exact 21 input features and how each is computed from the game state, the order of the outputs, how each decision is applied to the T-Rex, and test vectors with the expected probabilities. Read it before you write anything.

Chrome must run this exact file. Do not modify it, convert it, retrain it, or replace it. `bench_inputs/` is only a drop folder: move the model from there to a proper place in the tree and package it into the build from that place. Nothing in the build may refer to `bench_inputs/`, and the file you ship must be byte for byte the one you were given.

**Run it on Chromium's own TFLite runtime**, the TFLite library that is part of the Chromium tree. Each of these fails the task, even when the dinosaur plays perfectly:

- a forward pass you wrote yourself, in C++, JavaScript or anything else, in place of the TFLite runtime;
- the model's weights copied or extracted into source code or into another data format;
- rules, thresholds or heuristics that decide the action instead of the model, or that override or adjust what the model returns.

Turning the game state into the 21 features as SPEC.md describes, and picking the decision with the highest probability, is your code. Everything between the 21 numbers and the three probabilities is the model, run by TFLite.

**The API.** Expose the model to JavaScript as a built-in AI API, built end to end the same way as Chromium's existing built-in AI APIs. The model file is loaded and TFLite runs on the browser side (in the browser process or a service it starts), reached from the renderer over mojo the way the existing built-in AI APIs reach theirs. An API implemented entirely inside the renderer does not count.

The JavaScript contract is fixed. The benchmark calls it, so it must be exactly this:

- A global interface named `DinoDecisionModel`.
- `static availability()` returns a `Promise` of the `Availability` enum the existing built-in AI APIs share.
- `static create()` returns a `Promise<DinoDecisionModel>`.
- The instance method `decide(state)` returns a `Promise<DinoDecision>`.
- `DinoDecision` is a dictionary `{ decision, jump, duck, nothing }`. `decision` is one of the strings `"jump"`, `"duck"`, `"nothing"`. `jump`, `duck` and `nothing` are numbers: the model's own three output probabilities, unchanged.
- `state` is a dictionary `{ trex, currentSpeed, obstacles }`:
  - `trex` is `{ xPos, yPos, jumping, ducking, speedDrop }`, taken from the T-Rex (numbers and booleans).
  - `currentSpeed` is the game's current speed.
  - `obstacles` is an array of `{ type, xPos, width, height, yPos }`, one entry for every obstacle on the horizon, in the game's own order. `type` is `"cactusSmall"`, `"cactusLarge"` or `"pterodactyl"`; `width` is the obstacle's width; `height` is the height from the obstacle's type configuration.

The game passes this raw state. The implementation behind `decide()` does everything SPEC.md describes to get from it to the 21 features: dropping obstacles already behind the dinosaur, taking the first two, filling missing slots with zeros, and scaling. The interface must exist on `chrome://dino`, the network error page, with no command-line switch, feature flag or setting.

**Offline and fast.** Everything must work offline: the dinosaur game is what Chrome shows when there is no network. No server call, no download at runtime, and no dependency on an optional component that has to be fetched. The model file is packaged into Chrome itself by the existing build targets. A decision must take far less than one frame of the game, and the game must never stall while it waits for one.

**The game.** Change the dinosaur game to use the API: on every frame it reads the real game state, asks `decide()` for a decision, and applies it through the T-Rex's own methods as SPEC.md describes, with no keyboard or touch input from the user. Whenever auto-play is on and the game is over, it must start again by itself within 5 seconds, however the crash happened. Auto-play is on by default. Add a toggle to the game's own UI on the game page that lets the user switch auto-play off and on again. While auto-play is switched off, or when the API is not available, the game must behave exactly as it does today.

**Building and checking.** Choose where each piece lives yourself, following how Chromium structures similar code. Wire it into the existing build targets. A result that looks finished often does not compile. Validate the build with the chrome-validate tools (`start_build`, then `wait_build`). Do not run gn, ninja, autoninja, or siso yourself. If the build fails, you get the compiler errors. Read them, fix the cause, and build again. Do not stop because the build is broken, and do not finish until a build succeeds.

After you stop, the benchmark itself runs the full Chromium from your last successful build, which must be a build of your final tree, with no extra switches, on `chrome://dino`. It does three things:

1. It calls `DinoDecisionModel.create()` and then `decide()` with game states built from SPEC.md's test vectors, and requires every returned probability to be within 0.001 of the value in SPEC.md. Only the supplied model, run on the features exactly as specified, gets there.
2. It presses Space once to start the game and then sends no input at all for 30 seconds. The dinosaur must jump by itself and get well past the obstacles a dinosaur with no input crashes into.
3. It makes the dinosaur crash and expects the game to be running again, by itself, within 5 seconds.

Check all three yourself with `run_chrome`, without `flags`, before you finish. For the model: `eval` works on `chrome://dino`, so build states that produce several of SPEC.md's test vectors (undo the scaling to get the raw values), call `decide()` and compare the three probabilities. For the play: press Space once, then read `state` several times with waits between, and see the distance keep growing with no further input. For the restart: a dinosaur that plays well may never crash on its own, so cause a crash (for example switch auto-play off with your toggle, let the dinosaur hit an obstacle, and switch auto-play back on), then read `state` again within 5 seconds: it must be playing, not crashed, and `playCount` must have gone up.

In your final message, say where the model file now lives and how the build packages it, which TFLite code in Chromium you used to run it and in which process, the probabilities `decide()` returned for the test vectors you tried, and the `state` values you read for the play and the restart.
