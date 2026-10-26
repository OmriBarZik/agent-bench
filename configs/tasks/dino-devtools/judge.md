Judge whether the real offline dinosaur game can be played from Chrome DevTools.

- DevTools has a UI entry (a panel or a drawer view) that hosts the game, registered the way other DevTools panels or views are registered.
- The game is the real one, not a recreation. The game logic is not rewritten, and the sprite sheets and sounds are the original assets from components/neterror/resources, not redrawn, regenerated, or replaced. Copies are acceptable only if they are the original files or their build output, unchanged except for what is needed to load them.
- The change shows the agent understood how the game is built: it consumes the game's build output (the compiled and bundled game script, plus the 1x and 2x sprite sheets and the sounds) or runs the same sources through equivalent build steps. It does not hand-write a parallel copy of the game.
- Keyboard input for jump, duck, and restart reaches the game while it is open in DevTools.
- BUILD.gn and resource or grd lists are updated so the game and its assets are part of the existing DevTools build. A full Chromium build is not required.
