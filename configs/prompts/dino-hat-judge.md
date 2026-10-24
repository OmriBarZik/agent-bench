Score only the offline dinosaur game (components/neterror/resources/dino_game).

Give 1 only when every item below is true. Lower the score for each item that is missing or only partly done. Give 0 when there is no hat, or the edit is outside the dino game. The score is a decimal from 0 to 1, such as 0.2 or 0.743, not only 0 or 1.

- A hat is drawn on the dinosaur in every state: waiting, running, jumping, ducking, and crashed.
- The hat is visible at both sprite scales (1x and 2x).
- During a jump the hat lifts off above the head and lands back on the head when the dinosaur lands. While running or ducking the hat stays still on the head.
- Collision boxes and the rest of the game behavior are unchanged.
- The change is in the existing dino game sources and would be picked up by the current build targets. A full Chromium build is not required.
