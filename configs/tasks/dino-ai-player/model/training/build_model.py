"""Generate data, train, export and verify dino_decision.tflite (seeded).

Usage (from this directory):
    python3 build_model.py [--out ../dino_decision.tflite] [--jobs 8]
"""

import argparse
import json
import multiprocessing
import os
import sys
import time

import dino_sim as sim
import episodes
import mlp

SEED = 20261126
HIDDEN = 32
ROUND0_EPISODES = 240
DAGGER_ROUNDS = 2
DAGGER_EPISODES = 60
MAX_FRAMES = 2400
EPOCHS = 30
TEST_EVERY = 7          # every 7th episode is held out


def collect(pool, jobs, log):
    started = time.time()
    results = pool.map(episodes.collect, jobs, chunksize=1)
    train_set, test_set = [], []
    doomed = 0
    for (seed, _, _, _), (samples, stats) in zip(jobs, results):
        (test_set if seed % TEST_EVERY == 0 else train_set).extend(samples)
        doomed += stats[2]
    crashes = sum(1 for _, stats in results if stats[1])
    log('  %d episodes, %d samples, %d doomed states dropped, %d crashes, %.0fs' % (
        len(jobs), sum(len(r[0]) for r in results), doomed, crashes, time.time() - started))
    return train_set, test_set


def fit(train_set, log):
    model = mlp.MLP(sim.NUM_FEATURES, HIDDEN, 3, seed=SEED)
    xs = [x for x, _ in train_set]
    ys = [y for _, y in train_set]
    mlp.train(model, xs, ys, epochs=EPOCHS, seed=SEED + 1, log=log)
    model.round_to_f32()
    return model


def accuracy(model, data):
    confusion = [[0] * 3 for _ in range(3)]
    for x, y in data:
        probs = mlp.predict(model, x)
        confusion[y][probs.index(max(probs))] += 1
    correct = sum(confusion[i][i] for i in range(3))
    return correct / max(1, len(data)), confusion


def main():
    parser = argparse.ArgumentParser()
    here = os.path.dirname(os.path.abspath(__file__))
    parser.add_argument('--out', default=os.path.join(here, '..', 'dino_decision.tflite'))
    parser.add_argument('--jobs', type=int, default=8)
    parser.add_argument('--report', default=os.path.join(here, 'build_report.json'))
    args = parser.parse_args()
    log = lambda *a: print(*a, flush=True)

    with multiprocessing.get_context('fork').Pool(args.jobs) as pool:
        log('round 0: expert-driven episodes with random action bursts')
        jobs = [(SEED * 1000 + i, 'expert', None, MAX_FRAMES) for i in range(ROUND0_EPISODES)]
        train_set, test_set = collect(pool, jobs, log)
        model = None
        for round_index in range(1, DAGGER_ROUNDS + 1):
            log('training on %d samples' % len(train_set))
            model = fit(train_set, log)
            acc, _ = accuracy(model, test_set)
            log('  held-out accuracy %.4f on %d' % (acc, len(test_set)))
            log('round %d: model-driven episodes, states labeled by simulation' % round_index)
            params = (model.w1, model.b1, model.w2, model.b2)
            base = SEED * 1000 + round_index * 100000
            jobs = [(base + i, 'model', params, MAX_FRAMES) for i in range(DAGGER_EPISODES)]
            more_train, more_test = collect(pool, jobs, log)
            train_set += more_train
            test_set += more_test
    log('final training on %d samples' % len(train_set))
    model = fit(train_set, log)
    acc, confusion = accuracy(model, test_set)
    train_acc, _ = accuracy(model, train_set)
    log('train accuracy %.4f, held-out accuracy %.4f on %d samples' % (train_acc, acc, len(test_set)))
    log('confusion (rows = label jump/duck/nothing, cols = predicted): %s' % confusion)
    if acc < 0.95:
        sys.exit('held-out accuracy too low')

    import tflite_export
    tflite_export.write(model, args.out)
    import tflite_reader
    tflite_reader.verify(args.out, model, [x for x, _ in test_set[:2000]], log)
    with open(args.report, 'w') as handle:
        json.dump({'train_samples': len(train_set), 'test_samples': len(test_set),
                   'train_accuracy': train_acc, 'test_accuracy': acc,
                   'confusion': confusion, 'parameters': model.count(),
                   'labels_train': [sum(1 for _, y in train_set if y == k) for k in range(3)],
                   'labels_test': [sum(1 for _, y in test_set if y == k) for k in range(3)]},
                  handle, indent=1)
    log('wrote %s (%d bytes)' % (args.out, os.path.getsize(args.out)))


if __name__ == '__main__':
    main()
