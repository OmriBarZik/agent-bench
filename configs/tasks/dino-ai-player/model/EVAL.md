# dino_decision.tflite: evaluation

All numbers come from the scripts in `training/` (seeded, so they are
reproducible). They were measured in the Python simulator, not in Chrome.

## Held-out accuracy

The held-out set is whole episodes (every 7th episode in each collection
round), so no test state comes from a game that was trained on.

|                       | value                                                 |
| --------------------- | ----------------------------------------------------- |
| training samples      | 129,620 (jump 18,148 / duck 10,946 / nothing 100,526) |
| held-out samples      | 22,781 (jump 3,168 / duck 2,382 / nothing 17,231)     |
| training accuracy     | 97.14%                                                |
| **held-out accuracy** | **96.80%**                                            |

Held-out confusion (rows are the simulated-outcome label, columns the model's argmax):

| label \ predicted | jump | duck | nothing |
| ----------------- | ---- | ---- | ------- |
| jump              | 2999 | 0    | 169     |
| duck              | 46   | 2105 | 231     |
| nothing           | 253  | 30   | 16948   |

Nearly all errors are one or two frames early or late around a take-off or a
duck. They seldom matter, since the window that clears an obstacle is usually
several frames wide (see the play results below).

Data: round 0 has 240 episodes driven by the simulated-outcome labeler with
random 1-12 frame action bursts mixed in, so it covers recoveries and
mistimed jumps (323 states that no plan could survive were dropped). Then two
DAgger rounds of 60 episodes each are driven by the current model, with 0-2
frames of decision latency, and every recorded state is labelled by
simulation. Model-driven collection episodes (2400 frames each) crashed 0 of
120 times.

## Simulated play

`python3 training/evaluate.py --episodes 200`. Each episode starts like the
real game: Space starts a jump at speed 6, obstacles appear after 3 s, and the
T-Rex x position is random in 20-50. Frame time is 1000/hz ms with Gaussian
jitter (sd 0.25 ms) and 0.5% dropped frames. Every decision runs the
**exported .tflite** through `training/tflite_reader.py` and takes the argmax.
Episodes stop at a crash or at distanceRan 100,000 (speed reaches its maximum
of 13 at about 70,000, and pterodactyls appear from speed 8.5, about 20,000).
`distanceRan` is the game's internal unit; the on-screen score is
`round(distanceRan * 0.025)`.

| scenario                                    | episodes | crashed    | median distanceRan | p10    | reach 6000 | mean top prob | top prob > 0.9999 | actions j/d/n    |
| ------------------------------------------- | -------- | ---------- | ------------------ | ------ | ---------- | ------------- | ----------------- | ---------------- |
| no input (baseline)                         | 200      | 200 (100%) | 1668               | 1653   | 0%         | -             | -                 | 0.0%/0.0%/100.0% |
| model, benchmark: 30 s from start           | 200      | 0 (0%)     | 12415              | 12410  | 100%       | 0.979         | 50.6%             | 10.4%/0.0%/89.6% |
| model, 60 Hz, 0 frames latency              | 200      | 0 (0%)     | 100007 (cap)       | 100002 | 100%       | 0.977         | 39.6%             | 11.0%/8.2%/80.9% |
| model, 60 Hz, 1 frame latency               | 200      | 3 (2%)     | 100006 (cap)       | 100001 | 100%       | 0.977         | 39.0%             | 12.4%/8.0%/79.6% |
| model, 60 Hz, 2 frames latency              | 200      | 15 (8%)    | 100006 (cap)       | 100000 | 100%       | 0.976         | 38.5%             | 13.7%/7.9%/78.4% |
| model, 120 Hz, 2 frames latency             | 200      | 0 (0%)     | 100003 (cap)       | 100001 | 100%       | 0.976         | 37.6%             | 11.9%/9.0%/79.0% |
| model, 60 Hz, `nothing` never calls endJump | 200      | 2 (1%)     | 100007 (cap)       | 100001 | 100%       | 0.977         | 39.1%             | 12.4%/8.2%/79.4% |

- With no input, the dinosaur always hits the first obstacle, at distanceRan
  of about 1650-1690 (score about 42).
- The model never crashed in 30 s from the start, and reached a median
  distanceRan of 12,415 (score about 310). It also never crashed in 200 runs
  to distanceRan 100,000 at full speed with pterodactyls and no latency.
  With 1-2 frames of latency at 60 Hz, a few runs crash late in the
  high-speed phase. Even those runs pass 6000 (p10 is at the cap).
- The probabilities are not saturated: the chosen action's mean probability is
  about 0.98, and it is above 0.9999 on only 40-50% of frames.
  Near decisions the values sit between, for example 0.63 / 0.37 at take-off (see the SPEC test vectors).

## Not verified

- No run against the real game in Chrome. The simulator follows the game's TS
  sources, but it leaves out the intro animation (the T-Rex x position is
  randomised instead), the alt game mode, and the mobile and slow-speed configs.
- The labels assume 60 fps and immediate application. Real requestAnimationFrame
  timing and an async API round trip are approximated by the jitter, the
  120 Hz runs and the latency runs above.
