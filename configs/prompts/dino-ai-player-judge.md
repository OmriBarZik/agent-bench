Score whether an AI module inside the browser plays the offline dinosaur game by itself.

Give 1 only when every item below is true. Lower the score for each item that is missing or only partly done. Give 0 when nothing plays the game without user input. The score is a decimal from 0 to 1, such as 0.2 or 0.743, not only 0 or 1.

- The AI reads real game state from the dino game: dinosaur position, upcoming obstacle type, distance, and size, and current speed.
- It jumps, ducks, and restarts from that state with no user input, including restarting after a crash.
- It can be turned on and off, it is off by default, and it is behind a feature flag.
- BUILD.gn, grd resources, and feature registration are updated so the module is part of the existing build. A full Chromium build is not required.
