# Training dino_decision.tflite

Pure Python 3 standard library (tested with 3.11, no numpy). The only things
used from outside this folder are in the Chromium checkout next to agent-bench
(`../src`, or set `CHROMIUM_SRC`): the built `out/Default/flatc`, TFLite's
`schema.fbs` and the vendored flatbuffers Python library.

Reproduce the shipped model bit-for-bit (about 6 minutes with --jobs 10):

```sh
cd configs/tasks/dino-ai-player/model/training
python3 build_model.py --jobs 10          # writes ../dino_decision.tflite and build_report.json
shasum -a 256 ../dino_decision.tflite     # compare with the hash in ../SPEC.md
python3 evaluate.py --jobs 10             # the simulated-play tables in ../EVAL.md
python3 tflite_reader.py ../dino_decision.tflite   # dump the graph
```

Every random choice comes from a `random.Random` seeded from `SEED` in
`build_model.py`. Episode results are collected with an ordered `Pool.map`, so
`--jobs` changes the speed but not the output.

| file               | job                                                                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dino_sim.py`      | the game simulator (constants from the game's TS sources at 920e1e66e67c), the decision contract `Game.apply`, and the feature vector `features()` |
| `label.py`         | outcome labels: simulates every candidate plan ahead and returns the first action of the best one                                                  |
| `episodes.py`      | seeded data-collection episodes (expert-driven with random action bursts, then model-driven DAgger rounds)                                         |
| `mlp.py`           | the MLP, its reference forward pass and hand-written Adam training                                                                                 |
| `build_model.py`   | the pipeline: collect, train, DAgger x2, final train, export, verify                                                                               |
| `tflite_export.py` | writes the flatbuffer with classes that `flatc --python` generates from TFLite's `schema.fbs` (into a temp dir)                                    |
| `tflite_reader.py` | an independent hand-written flatbuffer parser and interpreter; `build_model.py` checks it matches the training forward pass exactly                |
| `evaluate.py`      | simulated games driven by the exported file through `tflite_reader.py`                                                                             |
