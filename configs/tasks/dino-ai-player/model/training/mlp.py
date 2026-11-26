"""A tiny MLP (dense -> ReLU -> dense -> softmax) trained with Adam, pure Python."""

import math
import random
import struct


def to_f32(value):
    return struct.unpack('<f', struct.pack('<f', value))[0]


class MLP:
    def __init__(self, n_in, n_hidden, n_out, seed):
        rng = random.Random(seed)
        scale1 = math.sqrt(2.0 / n_in)
        scale2 = math.sqrt(1.0 / n_hidden)
        self.w1 = [[rng.gauss(0, scale1) for _ in range(n_in)] for _ in range(n_hidden)]
        self.b1 = [0.0] * n_hidden
        self.w2 = [[rng.gauss(0, scale2) for _ in range(n_hidden)] for _ in range(n_out)]
        self.b2 = [0.0] * n_out

    def params(self):
        return [self.w1, self.b1, self.w2, self.b2]

    def round_to_f32(self):
        self.w1 = [[to_f32(v) for v in row] for row in self.w1]
        self.b1 = [to_f32(v) for v in self.b1]
        self.w2 = [[to_f32(v) for v in row] for row in self.w2]
        self.b2 = [to_f32(v) for v in self.b2]

    def count(self):
        return (len(self.w1) * len(self.w1[0]) + len(self.b1) +
                len(self.w2) * len(self.w2[0]) + len(self.b2))


def forward(w1, b1, w2, b2, x):
    """Reference forward pass: probabilities in output order."""
    hidden = []
    for row, bias in zip(w1, b1):
        total = bias
        for weight, value in zip(row, x):
            total += weight * value
        hidden.append(total if total > 0.0 else 0.0)
    logits = []
    for row, bias in zip(w2, b2):
        total = bias
        for weight, value in zip(row, hidden):
            total += weight * value
        logits.append(total)
    top = max(logits)
    exps = [math.exp(v - top) for v in logits]
    norm = sum(exps)
    return [v / norm for v in exps]


def predict(model, x):
    return forward(model.w1, model.b1, model.w2, model.b2, x)


def train(model, xs, ys, epochs, seed, lr=0.003, batch=64, weights=None, log=print):
    """Minibatch Adam on softmax cross-entropy."""
    rng = random.Random(seed)
    n_hidden = len(model.b1)
    n_out = len(model.b2)
    n_in = len(model.w1[0])
    flat = model.params()
    moments = [[_zeros_like(p), _zeros_like(p)] for p in flat]
    beta1, beta2, eps = 0.9, 0.999, 1e-8
    step = 0
    order = list(range(len(xs)))
    for epoch in range(epochs):
        rng.shuffle(order)
        rate = lr * (0.5 * (1 + math.cos(math.pi * epoch / epochs)))
        total_loss = 0.0
        for start in range(0, len(order), batch):
            idx = order[start:start + batch]
            g_w1 = [[0.0] * n_in for _ in range(n_hidden)]
            g_b1 = [0.0] * n_hidden
            g_w2 = [[0.0] * n_hidden for _ in range(n_out)]
            g_b2 = [0.0] * n_out
            for i in idx:
                x = xs[i]
                y = ys[i]
                sample_weight = weights[y] if weights else 1.0
                nz = [(j, v) for j, v in enumerate(x) if v != 0.0]
                pre = []
                for row, bias in zip(model.w1, model.b1):
                    total = bias
                    for j, v in nz:
                        total += row[j] * v
                    pre.append(total)
                hidden = [v if v > 0.0 else 0.0 for v in pre]
                logits = []
                for row, bias in zip(model.w2, model.b2):
                    total = bias
                    for weight, value in zip(row, hidden):
                        total += weight * value
                    logits.append(total)
                top = max(logits)
                exps = [math.exp(v - top) for v in logits]
                norm = sum(exps)
                probs = [v / norm for v in exps]
                total_loss += -math.log(max(probs[y], 1e-12)) * sample_weight
                d_logits = [(p - (1.0 if k == y else 0.0)) * sample_weight for k, p in enumerate(probs)]
                d_hidden = [0.0] * n_hidden
                for k, dl in enumerate(d_logits):
                    g_b2[k] += dl
                    row_g = g_w2[k]
                    row_w = model.w2[k]
                    for h in range(n_hidden):
                        row_g[h] += dl * hidden[h]
                        d_hidden[h] += dl * row_w[h]
                for h in range(n_hidden):
                    if pre[h] <= 0.0:
                        continue
                    dh = d_hidden[h]
                    g_b1[h] += dh
                    row_g = g_w1[h]
                    for j, v in nz:
                        row_g[j] += dh * v
            step += 1
            scale = 1.0 / len(idx)
            grads = [g_w1, g_b1, g_w2, g_b2]
            corr1 = 1 - beta1 ** step
            corr2 = 1 - beta2 ** step
            for param, grad, (m, v) in zip(flat, grads, moments):
                _adam(param, grad, m, v, scale, rate, beta1, beta2, eps, corr1, corr2)
        log('  epoch %2d  lr %.5f  loss %.4f' % (epoch + 1, rate, total_loss / len(xs)))


def _zeros_like(param):
    if isinstance(param[0], list):
        return [[0.0] * len(row) for row in param]
    return [0.0] * len(param)


def _adam(param, grad, m, v, scale, rate, beta1, beta2, eps, corr1, corr2):
    if isinstance(param[0], list):
        for p_row, g_row, m_row, v_row in zip(param, grad, m, v):
            _adam(p_row, g_row, m_row, v_row, scale, rate, beta1, beta2, eps, corr1, corr2)
        return
    for i in range(len(param)):
        g = grad[i] * scale
        m[i] = beta1 * m[i] + (1 - beta1) * g
        v[i] = beta2 * v[i] + (1 - beta2) * g * g
        param[i] -= rate * (m[i] / corr1) / (math.sqrt(v[i] / corr2) + eps)
