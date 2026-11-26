"""Seeded episodes: data collection (expert or model driven) and evaluation."""

import random

import dino_sim as sim
import label as labeler
from mlp import forward


def new_game(rng, random_start):
    game = sim.Game(rng, trex_x=rng.randint(20, 50))
    if random_start:
        # Drop in at a random speed with obstacles already on.
        game.speed = rng.uniform(sim.START_SPEED, sim.MAX_SPEED)
        game.running_time = sim.CLEAR_TIME
        game.distance = 0.0
    return game


def _should_record(game, rng, near_rate, far_rate):
    upcoming = game.upcoming()
    near = game.jumping or game.ducking or (
        upcoming and upcoming[0].x - game.trex_x < 350)
    return rng.random() < (near_rate if near else far_rate)


def collect(job):
    """job = (seed, mode, params, max_frames). Returns (samples, stats).

    mode 'expert': the labeler drives, with random action bursts mixed in.
    mode 'model' : the given MLP drives (argmax), with 0-2 frames of latency.
    Every recorded sample is (features, label) with the label from label.py.
    """
    seed, mode, params, max_frames = job
    rng = random.Random(seed)
    game = new_game(rng, random_start=rng.random() < 0.7)
    samples = []
    burst_action, burst_left = sim.NOTHING, 0
    latency = rng.choice((0, 0, 1, 1, 2))
    pending = []
    doomed = 0
    while game.frames < max_frames:
        record = _should_record(game, rng, 0.35, 0.03)
        need_label = mode == 'expert' or record
        if need_label:
            action, survived, _ = labeler.label(game)
            if record:
                if survived:
                    samples.append((sim.features(game), action))
                else:
                    doomed += 1
        if mode == 'expert':
            if burst_left == 0 and rng.random() < 0.02:
                burst_action, burst_left = rng.randrange(3), rng.randint(1, 12)
            if burst_left:
                action = burst_action
                burst_left -= 1
            game.apply(action)
        else:
            probs = forward(*params, sim.features(game))
            pending.append(probs.index(max(probs)))
            if len(pending) > latency:
                game.apply(pending.pop(0))
        if not game.step(sim.frame_dt(rng)):
            break
    return samples, (game.distance, game.crashed, doomed)
