Score whether the offline dinosaur game can be played from Chrome DevTools.

Give 1 only when every item below is true. Lower the score for each item that is missing or only partly done. Give 0 when DevTools has no way to open the game. The score is a decimal from 0 to 1, such as 0.2 or 0.743, not only 0 or 1.

- DevTools has a UI entry (a panel or a drawer view) that hosts the game, registered the way other DevTools panels or views are registered.
- The game reuses the existing dino_game sources instead of copying them wholesale.
- Keyboard input for jump, duck, and restart reaches the game while it is open in DevTools.
- BUILD.gn and grd resources are updated so the new code is part of the existing build. A full Chromium build is not required.
