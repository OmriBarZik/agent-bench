Judge whether the offline dinosaur game can be played from Chrome DevTools.

- DevTools has a UI entry (a panel or a drawer view) that hosts the game, registered the way other DevTools panels or views are registered.
- The game reuses the existing dino_game sources instead of copying them wholesale.
- Keyboard input for jump, duck, and restart reaches the game while it is open in DevTools.
- BUILD.gn and grd resources are updated so the new code is part of the existing build. A full Chromium build is not required.
