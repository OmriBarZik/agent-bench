# dino_decision.tflite: model contract

`dino_decision.tflite` is a float32 TFLite flatbuffer (schema version 3, file
identifier `TFL3`), 4256 bytes,
sha256 `f7278499b90f3323bbfad6685ecf304077b7ae92e64000eb2048397baeafb691`.
It uses builtin TFLite ops only (`FULLY_CONNECTED`, `RELU`, `SOFTMAX`), so any
TFLite runtime with the builtin op resolver runs it. One call takes one game
state and returns the probabilities of the three decisions.

## Graph

|            |                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| input      | tensor 0 `game_state`, float32, shape `[1, 21]`                                                                                |
| output     | tensor 8 `probabilities`, float32, shape `[1, 3]`, sums to 1                                                                   |
| ops        | `FULLY_CONNECTED` (21 -> 32), `RELU`, `FULLY_CONNECTED` (32 -> 3), `SOFTMAX` (beta 1.0); all op version 1, no fused activation |
| parameters | 803 float32 (dense1 weights 32x21 + bias 32, dense2 weights 3x32 + bias 3), all constant tensors in the file                   |

## Output

Index 0 = `jump`, 1 = `duck`, 2 = `nothing`. The decision is the argmax (on a
tie, the lower index). Return the three probabilities as given; they are the
model's own softmax output.

## The state passed to `decide(state)`

The page sends one plain dictionary per decision, read on the frame it decides
for (`runner` is the game's `Runner`):

```
{
  trex: { xPos, yPos, jumping, ducking, speedDrop },   // runner.tRex fields
  currentSpeed,                                        // runner.currentSpeed
  obstacles: [                                         // runner.horizon.obstacles, in array order
    { type, xPos, width, height, yPos }                // type = typeConfig.type, height = typeConfig.height
  ]
}
```

`obstacles` holds every obstacle on the horizon, behind the dinosaur or not;
picking the upcoming ones is part of turning the state into features, below.

## Input features

From `state`: take `state.obstacles` in array order, keep only those with
`obstacle.xPos + obstacle.width > state.trex.xPos` (not yet fully behind the
dinosaur), and use the first two as `o1` and `o2`. If there are fewer than
two, every feature of the missing slot is 0 (including `present` and `dx`).

| index | name            | value                                                                                                       |
| ----- | --------------- | ----------------------------------------------------------------------------------------------------------- |
| 0     | trex_y          | `trex.yPos / 150` (0.62 when running on the ground, yPos 93; smaller when higher)                           |
| 1     | trex_jumping    | `trex.jumping ? 1 : 0`                                                                                      |
| 2     | trex_ducking    | `trex.ducking ? 1 : 0`                                                                                      |
| 3     | trex_speed_drop | `trex.speedDrop ? 1 : 0`                                                                                    |
| 4     | speed           | `currentSpeed / 13` (13 is maxSpeed)                                                                        |
| 5     | o1_present      | 1 if `o1` exists, else 0                                                                                    |
| 6     | o1_cactus_small | 1 if `o1.type === 'cactusSmall'`                                                                            |
| 7     | o1_cactus_large | 1 if `o1.type === 'cactusLarge'`                                                                            |
| 8     | o1_pterodactyl  | 1 if `o1.type === 'pterodactyl'`                                                                            |
| 9     | o1_dx           | `(o1.xPos - trex.xPos) / 600` (can be slightly negative while overlapping, and above 1 just after spawning) |
| 10    | o1_width        | `o1.width / 100` (the obstacle's `width`, already `typeConfig.width * size`)                                |
| 11    | o1_height       | `o1.height / 50` (`typeConfig.height`)                                                                      |
| 12    | o1_y            | `o1.yPos / 150`                                                                                             |
| 13-20 | o2_*            | the same eight values for `o2`, in the same order                                                           |

The one-hot type is all zeros for any other obstacle type (there is none in the
normal game). Units are canvas pixels and the game's speed units; nothing else
is normalised.

## Applying the decision

Treat the decision as "which key is held during this frame" and apply it before
the frame's update, through the game's own T-Rex methods:

- `jump`: if `tRex.ducking || tRex.speedDrop` then `tRex.speedDrop = false; tRex.setDuck(false)`. Then if `!tRex.jumping`, `tRex.startJump(runner.currentSpeed)`.
- `duck`: if `tRex.jumping`, call `tRex.setSpeedDrop()` once (only when `!tRex.speedDrop`); else if `!tRex.ducking`, `tRex.setDuck(true)`.
- `nothing`: if `tRex.jumping`, `tRex.endJump()` (releasing Space). If `tRex.ducking || tRex.speedDrop`, `tRex.speedDrop = false; tRex.setDuck(false)`.

The model keeps answering `jump` while it wants a full-height jump, so it
also plays well when `nothing` does not call `endJump()`. One or two frames of
latency between the state and the applied decision is expected and fine: an
async `decide()` answered on a later frame still plays well.

## Test vectors

Feature vector (21 values) -> expected `[jump, duck, nothing]` to 4 decimals. All are
states from a simulated game.

| state                                         | input                                                                                                                             | expected                           |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| on the ground, no obstacles, speed 6          | `[0.62, 0, 0, 0, 0.461538, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]`                                                       | `[0.0000, 0.0000, 1.0000]` nothing |
| large cactus close: take off                  | `[0.62, 0.0, 0.0, 0.0, 0.485308, 1.0, 0.0, 1.0, 0.0, 0.181667, 0.25, 1.0, 0.6, 1.0, 1.0, 0.0, 0.0, 0.798333, 0.17, 0.7, 0.7]`     | `[0.6319, 0.0000, 0.3681]` jump    |
| next frame, rising: keep holding              | `[0.546667, 1.0, 0.0, 0.0, 0.485385, 1.0, 0.0, 1.0, 0.0, 0.171667, 0.25, 1.0, 0.6, 1.0, 1.0, 0.0, 0.0, 0.788333, 0.17, 0.7, 0.7]` | `[0.9478, 0.0126, 0.0396]` jump    |
| high above the cactus                         | `[0.006667, 1.0, 0.0, 0.0, 0.486538, 1.0, 0.0, 1.0, 0.0, 0.011667, 0.25, 1.0, 0.6, 1.0, 1.0, 0.0, 0.0, 0.628333, 0.17, 0.7, 0.7]` | `[0.0000, 0.0018, 0.9982]` nothing |
| small cactus far away                         | `[0.62, 0.0, 0.0, 0.0, 0.487923, 1.0, 1.0, 0.0, 0.0, 0.448333, 0.17, 0.7, 0.7, 1.0, 1.0, 0.0, 0.0, 0.828333, 0.34, 0.7, 0.7]`     | `[0.0000, 0.0000, 1.0000]` nothing |
| small cactus close: take off                  | `[0.62, 0.0, 0.0, 0.0, 0.489692, 1.0, 1.0, 0.0, 0.0, 0.218333, 0.17, 0.7, 0.7, 1.0, 1.0, 0.0, 0.0, 0.598333, 0.34, 0.7, 0.7]`     | `[0.7708, 0.0000, 0.2292]` jump    |
| low pterodactyl (y 100) close                 | `[0.62, 0.0, 0.0, 0.0, 0.660846, 1.0, 0.0, 0.0, 1.0, 0.263333, 0.46, 0.8, 0.666667, 0, 0, 0, 0, 0, 0, 0, 0]`                      | `[0.5858, 0.0000, 0.4142]` jump    |
| airborne, high pterodactyl coming: speed drop | `[0.333333, 1.0, 0.0, 0.0, 0.669769, 1.0, 0.0, 0.0, 1.0, 1.036667, 0.46, 0.8, 0.333333, 0, 0, 0, 0, 0, 0, 0, 0]`                  | `[0.0000, 0.9178, 0.0822]` duck    |
| ducking under a high pterodactyl              | `[0.62, 0.0, 1.0, 0.0, 0.675077, 1.0, 0.0, 0.0, 1.0, 0.195, 0.46, 0.8, 0.333333, 0, 0, 0, 0, 0, 0, 0, 0]`                         | `[0.0000, 0.9995, 0.0005]` duck    |

A float32 runtime matches these to about 1e-6. The bench calls `decide(state)`
with each state below and accepts each probability within 0.001 of the expected
value, with `decision` equal to the argmax.

## Test states

The same nine states as `decide(state)` input, in the same order.

- on the ground, no obstacles, speed 6: `{"trex":{"xPos":50,"yPos":93,"jumping":false,"ducking":false,"speedDrop":false},"currentSpeed":6,"obstacles":[]}`
- large cactus close: take off: `{"trex":{"xPos":50,"yPos":93,"jumping":false,"ducking":false,"speedDrop":false},"currentSpeed":6.309,"obstacles":[{"type":"cactusLarge","xPos":159,"width":25,"height":50,"yPos":90},{"type":"cactusSmall","xPos":529,"width":17,"height":35,"yPos":105}]}`
- next frame, rising: keep holding: `{"trex":{"xPos":50,"yPos":82,"jumping":true,"ducking":false,"speedDrop":false},"currentSpeed":6.31,"obstacles":[{"type":"cactusLarge","xPos":153,"width":25,"height":50,"yPos":90},{"type":"cactusSmall","xPos":523,"width":17,"height":35,"yPos":105}]}`
- high above the cactus: `{"trex":{"xPos":50,"yPos":1,"jumping":true,"ducking":false,"speedDrop":false},"currentSpeed":6.325,"obstacles":[{"type":"cactusLarge","xPos":57,"width":25,"height":50,"yPos":90},{"type":"cactusSmall","xPos":427,"width":17,"height":35,"yPos":105}]}`
- small cactus far away: `{"trex":{"xPos":50,"yPos":93,"jumping":false,"ducking":false,"speedDrop":false},"currentSpeed":6.343,"obstacles":[{"type":"cactusSmall","xPos":319,"width":17,"height":35,"yPos":105},{"type":"cactusSmall","xPos":547,"width":34,"height":35,"yPos":105}]}`
- small cactus close: take off: `{"trex":{"xPos":50,"yPos":93,"jumping":false,"ducking":false,"speedDrop":false},"currentSpeed":6.366,"obstacles":[{"type":"cactusSmall","xPos":181,"width":17,"height":35,"yPos":105},{"type":"cactusSmall","xPos":409,"width":34,"height":35,"yPos":105}]}`
- low pterodactyl (y 100) close: `{"trex":{"xPos":50,"yPos":93,"jumping":false,"ducking":false,"speedDrop":false},"currentSpeed":8.591,"obstacles":[{"type":"pterodactyl","xPos":208,"width":46,"height":40,"yPos":100}]}`
- airborne, high pterodactyl coming: speed drop: `{"trex":{"xPos":50,"yPos":50,"jumping":true,"ducking":false,"speedDrop":false},"currentSpeed":8.707,"obstacles":[{"type":"pterodactyl","xPos":672,"width":46,"height":40,"yPos":50}]}`
- ducking under a high pterodactyl: `{"trex":{"xPos":50,"yPos":93,"jumping":false,"ducking":true,"speedDrop":false},"currentSpeed":8.776,"obstacles":[{"type":"pterodactyl","xPos":167,"width":46,"height":40,"yPos":50}]}`

## How it was made

A small MLP trained by imitation on states from a simulated game, labelled by
which action survives the next obstacle with the most clearance.
