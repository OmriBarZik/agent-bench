Judge whether a decision model built into the browser plays the offline dinosaur game by itself through a new JavaScript built-in AI API.

- A decision model lives in the browser's own sources and is built as part of the product. It takes structured game state (dinosaur position and jump/duck state, upcoming obstacle type, distance, size and y-position, current speed) and returns exactly one of `jump`, `duck` or `nothing`, with a probability for each.
- It works fully offline: no network call, no runtime download of weights, and no dependency on an optional component that has to be fetched.
- The model is exposed to JavaScript as a built-in AI API that follows how the existing built-in AI APIs are defined, wired and gated (for example IDL, bindings, and renderer-to-browser plumbing where needed), extending or sitting alongside them rather than inventing a separate mechanism. It is reachable from the page that hosts the dinosaur game.
- The dinosaur game reads real game state, calls the new API, and applies the decision through its existing jump and duck code paths with no user input, including restarting after a crash.
- Auto-play can be turned on and off and is off by default, the API is behind a feature flag, and the game behaves as before when the API is unavailable.
- BUILD.gn, IDL lists, grd resources, and feature registration are updated so the change is part of the existing build. A full Chromium build is not required.
