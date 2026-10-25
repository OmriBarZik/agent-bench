You are working in a Chromium source checkout. Chrome has an offline game where a T-Rex dinosaur runs, jumps and ducks over obstacles. Find where that dinosaur is implemented and give it a hat.

The hat must bounce when the dinosaur jumps: it lifts off above the dinosaur's head during the jump and lands back on its head when the dinosaur lands, so it looks bouncy. It must not bounce at other times; while the dinosaur is running or ducking the hat sits still on its head.

The hat must be visible in every state (waiting, running, jumping, ducking, crashed) and at both display scales (1x and 2x sprites), without changing the game's behavior or collision boxes.

Do not run a full Chromium build; make the change so it would build with the existing targets.
