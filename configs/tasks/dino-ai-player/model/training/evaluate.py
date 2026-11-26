"""Play simulated games with the exported .tflite (via tflite_reader) and report.

Usage: python3 evaluate.py [../dino_decision.tflite] [--episodes 200] [--jobs 8]
"""

import argparse
import multiprocessing
import os
import random
import statistics

import dino_sim as sim
import tflite_reader

GRAPH = None


def _init(path):
    global GRAPH
    GRAPH = tflite_reader.load(path)


def play(job):
    """job = (seed, use_model, hz, latency, release_ends_jump, max_distance, max_seconds)."""
    seed, use_model, hz, latency, release_ends_jump, max_distance, max_seconds = job
    rng = random.Random(seed)
    game = sim.Game(rng, trex_x=rng.randint(20, 50))
    game.start_jump()            # the Space press that starts the game
    pending = []
    counts = [0, 0, 0]
    top_sum = 0.0
    saturated = 0
    elapsed = 0.0
    while game.distance < max_distance and elapsed < max_seconds * 1000:
        if use_model:
            probs = tflite_reader.run(GRAPH, sim.features(game))
            action = probs.index(max(probs))
            top_sum += probs[action]
            saturated += probs[action] > 0.9999
        else:
            action = sim.NOTHING
        counts[action] += 1
        pending.append(action)
        if len(pending) > latency:
            game.apply(pending.pop(0), release_ends_jump=release_ends_jump)
        dt = sim.frame_dt(rng, hz)
        elapsed += dt
        if not game.step(dt):
            break
    frames = max(1, sum(counts))
    return game.distance, game.crashed, counts, top_sum / frames, saturated / frames


SCENARIOS = [
    # name, use_model, hz, latency, release_ends_jump, max_distance, max_seconds
    ('no input (baseline)', False, 60, 0, True, 1e9, 1e9),
    ('model, benchmark: 30 s from start', True, 60, 0, True, 1e9, 30),
    ('model, 60 Hz, 0 frames latency', True, 60, 0, True, 100000, 1e9),
    ('model, 60 Hz, 1 frame latency', True, 60, 1, True, 100000, 1e9),
    ('model, 60 Hz, 2 frames latency', True, 60, 2, True, 100000, 1e9),
    ('model, 120 Hz, 2 frames latency', True, 120, 2, True, 100000, 1e9),
    ('model, 60 Hz, nothing never calls endJump', True, 60, 1, False, 100000, 1e9),
]


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    parser = argparse.ArgumentParser()
    parser.add_argument('model', nargs='?', default=os.path.join(here, '..', 'dino_decision.tflite'))
    parser.add_argument('--episodes', type=int, default=200)
    parser.add_argument('--jobs', type=int, default=8)
    args = parser.parse_args()
    print('| scenario | episodes | crashed | median distanceRan | p10 | reach 6000 | mean top prob | top prob > 0.9999 | actions j/d/n |')
    print('|---|---|---|---|---|---|---|---|---|')
    with multiprocessing.get_context('fork').Pool(args.jobs, initializer=_init, initargs=(args.model,)) as pool:
        for index, (name, use_model, hz, latency, release, max_distance, max_seconds) in enumerate(SCENARIOS):
            jobs = [(7000000 + index * 10000 + i, use_model, hz, latency, release, max_distance, max_seconds)
                    for i in range(args.episodes)]
            results = pool.map(play, jobs, chunksize=1)
            distances = sorted(r[0] for r in results)
            crashed = sum(1 for r in results if r[1])
            counts = [sum(r[2][k] for r in results) for k in range(3)]
            total = sum(counts)
            reach = sum(1 for d in distances if d >= 6000)
            print('| %s | %d | %d (%.0f%%) | %.0f | %.0f | %.0f%% | %s | %s | %s |' % (
                name, len(results), crashed, 100.0 * crashed / len(results), statistics.median(distances),
                distances[len(distances) // 10], 100.0 * reach / len(results),
                '%.3f' % statistics.mean(r[3] for r in results) if use_model else '-',
                '%.1f%%' % (100 * statistics.mean(r[4] for r in results)) if use_model else '-',
                '/'.join('%.1f%%' % (100.0 * c / total) for c in counts)), flush=True)


if __name__ == '__main__':
    main()
