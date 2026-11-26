"""Independent pure-Python .tflite reader and interpreter for this model.

Parses the flatbuffer by hand (struct only, no generated code), checks the
graph is FULLY_CONNECTED -> RELU -> FULLY_CONNECTED -> SOFTMAX in float32,
and runs it. Usage: python3 tflite_reader.py ../dino_decision.tflite [f0 ... f20]
"""

import math
import struct
import sys

FULLY_CONNECTED, RELU, SOFTMAX = 9, 19, 25


class Table:
    def __init__(self, buf, pos):
        self.buf = buf
        self.pos = pos
        vtable = pos - struct.unpack_from('<i', buf, pos)[0]
        self.vtable = vtable
        self.vsize = struct.unpack_from('<H', buf, vtable)[0]

    def _field(self, slot):
        offset_pos = 4 + 2 * slot
        if offset_pos >= self.vsize:
            return 0
        return struct.unpack_from('<H', self.buf, self.vtable + offset_pos)[0]

    def scalar(self, slot, fmt, default=0):
        off = self._field(slot)
        return struct.unpack_from('<' + fmt, self.buf, self.pos + off)[0] if off else default

    def _indirect(self, slot):
        off = self._field(slot)
        if not off:
            return None
        at = self.pos + off
        return at + struct.unpack_from('<I', self.buf, at)[0]

    def table(self, slot):
        at = self._indirect(slot)
        return Table(self.buf, at) if at is not None else None

    def vector(self, slot):
        """(start, length) of a vector field."""
        at = self._indirect(slot)
        if at is None:
            return None, 0
        return at + 4, struct.unpack_from('<I', self.buf, at)[0]

    def ints(self, slot):
        start, length = self.vector(slot)
        return list(struct.unpack_from('<%di' % length, self.buf, start)) if length else []

    def tables(self, slot):
        start, length = self.vector(slot)
        out = []
        for i in range(length):
            at = start + 4 * i
            out.append(Table(self.buf, at + struct.unpack_from('<I', self.buf, at)[0]))
        return out

    def string(self, slot):
        start, length = self.vector(slot)
        return self.buf[start:start + length].decode() if start is not None else None


def load(path):
    with open(path, 'rb') as handle:
        buf = handle.read()
    assert buf[4:8] == b'TFL3', 'missing TFL3 identifier'
    model = Table(buf, struct.unpack_from('<I', buf, 0)[0])
    version = model.scalar(0, 'I')
    codes = []
    for code in model.tables(1):
        builtin = max(code.scalar(0, 'b'), code.scalar(3, 'i'))
        codes.append(builtin)
    buffers = []
    for buffer in model.tables(4):
        start, length = buffer.vector(0)
        buffers.append(buf[start:start + length] if length else b'')
    subgraphs = model.tables(2)
    assert len(subgraphs) == 1
    graph = subgraphs[0]
    tensors = []
    for tensor in graph.tables(0):
        assert tensor.scalar(1, 'b') == 0, 'tensor is not FLOAT32'
        data = buffers[tensor.scalar(2, 'I')]
        values = list(struct.unpack('<%df' % (len(data) // 4), data)) if data else None
        tensors.append({'name': tensor.string(3), 'shape': tensor.ints(0), 'data': values})
    ops = []
    for op in graph.tables(3):
        code = codes[op.scalar(0, 'I')]
        entry = {'op': code, 'inputs': op.ints(1), 'outputs': op.ints(2)}
        options = op.table(4)
        if code == FULLY_CONNECTED:
            entry['activation'] = options.scalar(0, 'b') if options else 0
        if code == SOFTMAX:
            entry['beta'] = options.scalar(0, 'f') if options else 0.0
        ops.append(entry)
    return {'version': version, 'description': model.string(3), 'codes': codes,
            'tensors': tensors, 'ops': ops, 'inputs': graph.ints(1),
            'outputs': graph.ints(2), 'size': len(buf)}


def run(graph, features):
    values = {graph['inputs'][0]: list(features)}
    for op in graph['ops']:
        if op['op'] == FULLY_CONNECTED:
            x = values[op['inputs'][0]]
            weights = graph['tensors'][op['inputs'][1]]
            bias = graph['tensors'][op['inputs'][2]]['data']
            rows, cols = weights['shape']
            data = weights['data']
            assert op['activation'] == 0
            out = []
            for r in range(rows):
                total = bias[r]
                for weight, value in zip(data[r * cols:(r + 1) * cols], x):
                    total += weight * value
                out.append(total)
        elif op['op'] == RELU:
            out = [v if v > 0.0 else 0.0 for v in values[op['inputs'][0]]]
        elif op['op'] == SOFTMAX:
            logits = values[op['inputs'][0]]
            top = max(logits)
            exps = [math.exp((v - top) * op['beta']) for v in logits]
            norm = sum(exps)
            out = [v / norm for v in exps]
        else:
            raise ValueError('unsupported op %d' % op['op'])
        values[op['outputs'][0]] = out
    return values[graph['outputs'][0]]


def verify(path, model, samples, log=print):
    """Check the file matches the trained model exactly on `samples`."""
    from mlp import predict
    graph = load(path)
    assert [op['op'] for op in graph['ops']] == [FULLY_CONNECTED, RELU, FULLY_CONNECTED, SOFTMAX]
    worst = 0.0
    for x in samples:
        expected = predict(model, x)
        got = run(graph, x)
        worst = max(worst, max(abs(a - b) for a, b in zip(expected, got)))
    log('verify: %s parsed (%d bytes, ops %s), max |diff| vs training forward = %g over %d inputs' % (
        path, graph['size'], graph['codes'], worst, len(samples)))
    assert worst == 0.0, 'reader output differs from the training forward pass'


if __name__ == '__main__':
    graph = load(sys.argv[1])
    print('version', graph['version'], '|', graph['description'])
    for tensor in graph['tensors']:
        print('  tensor %-16s %s%s' % (tensor['name'], tensor['shape'], ' const' if tensor['data'] else ''))
    print('  ops', [op['op'] for op in graph['ops']])
    if len(sys.argv) > 2:
        print(['%.4f' % p for p in run(graph, [float(v) for v in sys.argv[2:]])])
