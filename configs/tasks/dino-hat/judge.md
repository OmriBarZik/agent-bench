Judge only the offline dinosaur game (components/neterror/resources/dino_game).

- A hat is drawn on the dinosaur in every state: waiting, running, jumping, ducking, and crashed.
- The hat is visible at both sprite scales (1x and 2x).
- During a jump the hat lifts off above the head and lands back on the head when the dinosaur lands. While running or ducking the hat stays still on the head.
- Collision boxes and the rest of the game behavior are unchanged.
- The change is in the existing dino game sources and would be picked up by the current build targets. A full Chromium build is not required.
