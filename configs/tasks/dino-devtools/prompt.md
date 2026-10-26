You are working in a Chromium source checkout. Chrome's offline dinosaur game normally only runs on the network error page. Make it playable inside Chrome DevTools (the DevTools frontend, e.g. as a panel or drawer tab), so a user can open DevTools, pick the game, and play it with the keyboard while online.

It must be the real dinosaur game, not a recreation. Do not rewrite the game logic, redraw or regenerate the sprites, or synthesize replacement sounds. Use the game's actual code and its actual assets (the sprite sheets at both display scales and the sound effects). Copying the real files into DevTools is fine, but every copy must be the original file or its build output, unchanged except for what is needed to load it.

Before wiring anything, find out how the dinosaur game is built today: where its sources live, which build steps turn them into what the error page loads, what the final output of that build is, and how the images and sounds reach the page. Then bake the game into DevTools from that final output (or from the same sources through the same kind of build steps), so DevTools gets the same game the error page gets and would pick up future changes to it.

Follow how the DevTools frontend registers panels or views and how it bundles and ships its own resources. Keyboard input for jump, duck and restart must reach the game while it is open in DevTools.

Do not run a full Chromium build; make the change so it would build with the existing targets.
