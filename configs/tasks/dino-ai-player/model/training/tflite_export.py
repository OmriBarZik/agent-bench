"""Write the MLP as a float32 TFLite flatbuffer.

Uses Python classes that Chromium's own flatc generates from TFLite's
schema.fbs, plus Chromium's vendored flatbuffers Python library.
Graph: input[1,21] -FULLY_CONNECTED-> [1,32] -RELU-> [1,32]
       -FULLY_CONNECTED-> [1,3] -SOFTMAX(beta=1)-> output[1,3]
"""

import os
import struct
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
CHROMIUM_SRC = os.environ.get(
    'CHROMIUM_SRC', os.path.normpath(os.path.join(HERE, '..', '..', '..', '..', '..', '..', 'src')))
FLATC = os.path.join(CHROMIUM_SRC, 'out', 'Default', 'flatc')
SCHEMA = os.path.join(CHROMIUM_SRC, 'third_party', 'tflite', 'src', 'tensorflow',
                      'compiler', 'mlir', 'lite', 'schema', 'schema.fbs')
FLATBUFFERS_PY = os.path.join(CHROMIUM_SRC, 'third_party', 'flatbuffers', 'src', 'python')


def _load_schema():
    generated = tempfile.mkdtemp(prefix='tflite_schema_py_')
    subprocess.check_call([FLATC, '--python', '-o', generated, SCHEMA])
    sys.path.insert(0, FLATBUFFERS_PY)
    sys.path.insert(0, generated)


def _floats(values):
    return struct.pack('<%df' % len(values), *values)


def _int_vector(builder, start_fn, values):
    start_fn(builder, len(values))
    for value in reversed(values):
        builder.PrependInt32(value)
    return builder.EndVector()


def _data_vector(builder, data):
    builder.StartVector(1, len(data), 16)
    builder.head = builder.head - len(data)
    builder.Bytes[builder.head:builder.head + len(data)] = data
    builder.vectorNumElems = len(data)
    return builder.EndVector()


def build(model):
    _load_schema()
    import flatbuffers
    from tflite import (Buffer, BuiltinOperator, BuiltinOptions, FullyConnectedOptions,
                        Model, Operator, OperatorCode, SoftmaxOptions, SubGraph, Tensor,
                        TensorType)

    n_in = len(model.w1[0])
    n_hidden = len(model.b1)
    n_out = len(model.b2)
    blobs = [b'',                                               # 0: sentinel
             _floats([v for row in model.w1 for v in row]),     # 1: fc1 weights
             _floats(model.b1),                                 # 2: fc1 bias
             _floats([v for row in model.w2 for v in row]),     # 3: fc2 weights
             _floats(model.b2)]                                 # 4: fc2 bias
    # (name, shape, buffer)
    tensors = [('game_state', [1, n_in], 0),
               ('dense1/weights', [n_hidden, n_in], 1),
               ('dense1/bias', [n_hidden], 2),
               ('dense1/out', [1, n_hidden], 0),
               ('relu1/out', [1, n_hidden], 0),
               ('dense2/weights', [n_out, n_hidden], 3),
               ('dense2/bias', [n_out], 4),
               ('logits', [1, n_out], 0),
               ('probabilities', [1, n_out], 0)]
    opcodes = [BuiltinOperator.BuiltinOperator.FULLY_CONNECTED,
               BuiltinOperator.BuiltinOperator.RELU,
               BuiltinOperator.BuiltinOperator.SOFTMAX]
    # (opcode index, inputs, outputs, options kind)
    operators = [(0, [0, 1, 2], [3], 'fc'),
                 (1, [3], [4], None),
                 (0, [4, 5, 6], [7], 'fc'),
                 (2, [7], [8], 'softmax')]

    builder = flatbuffers.Builder(4096)
    description = builder.CreateString('dino_decision: T-Rex runner action model [jump, duck, nothing]')
    buffer_offsets = []
    for blob in blobs:
        data = _data_vector(builder, blob) if blob else None
        Buffer.Start(builder)
        if data is not None:
            Buffer.AddData(builder, data)
        buffer_offsets.append(Buffer.End(builder))
    tensor_offsets = []
    for name, shape, buffer_index in tensors:
        name_offset = builder.CreateString(name)
        shape_offset = _int_vector(builder, Tensor.StartShapeVector, shape)
        Tensor.Start(builder)
        Tensor.AddShape(builder, shape_offset)
        Tensor.AddType(builder, TensorType.TensorType.FLOAT32)
        Tensor.AddBuffer(builder, buffer_index)
        Tensor.AddName(builder, name_offset)
        tensor_offsets.append(Tensor.End(builder))
    operator_offsets = []
    for opcode_index, inputs, outputs, kind in operators:
        options = None
        if kind == 'fc':
            FullyConnectedOptions.Start(builder)
            FullyConnectedOptions.AddFusedActivationFunction(builder, 0)   # NONE
            options = FullyConnectedOptions.End(builder)
            options_type = BuiltinOptions.BuiltinOptions.FullyConnectedOptions
        elif kind == 'softmax':
            SoftmaxOptions.Start(builder)
            SoftmaxOptions.AddBeta(builder, 1.0)
            options = SoftmaxOptions.End(builder)
            options_type = BuiltinOptions.BuiltinOptions.SoftmaxOptions
        inputs_offset = _int_vector(builder, Operator.StartInputsVector, inputs)
        outputs_offset = _int_vector(builder, Operator.StartOutputsVector, outputs)
        Operator.Start(builder)
        Operator.AddOpcodeIndex(builder, opcode_index)
        Operator.AddInputs(builder, inputs_offset)
        Operator.AddOutputs(builder, outputs_offset)
        if options is not None:
            Operator.AddBuiltinOptionsType(builder, options_type)
            Operator.AddBuiltinOptions(builder, options)
        operator_offsets.append(Operator.End(builder))

    def table_vector(start_fn, offsets):
        start_fn(builder, len(offsets))
        for offset in reversed(offsets):
            builder.PrependUOffsetTRelative(offset)
        return builder.EndVector()

    subgraph_name = builder.CreateString('main')
    sg_tensors = table_vector(SubGraph.StartTensorsVector, tensor_offsets)
    sg_inputs = _int_vector(builder, SubGraph.StartInputsVector, [0])
    sg_outputs = _int_vector(builder, SubGraph.StartOutputsVector, [8])
    sg_operators = table_vector(SubGraph.StartOperatorsVector, operator_offsets)
    SubGraph.Start(builder)
    SubGraph.AddTensors(builder, sg_tensors)
    SubGraph.AddInputs(builder, sg_inputs)
    SubGraph.AddOutputs(builder, sg_outputs)
    SubGraph.AddOperators(builder, sg_operators)
    SubGraph.AddName(builder, subgraph_name)
    subgraph = SubGraph.End(builder)

    opcode_offsets = []
    for code in opcodes:
        OperatorCode.Start(builder)
        OperatorCode.AddDeprecatedBuiltinCode(builder, code)
        OperatorCode.AddBuiltinCode(builder, code)
        OperatorCode.AddVersion(builder, 1)
        opcode_offsets.append(OperatorCode.End(builder))

    model_opcodes = table_vector(Model.StartOperatorCodesVector, opcode_offsets)
    model_subgraphs = table_vector(Model.StartSubgraphsVector, [subgraph])
    model_buffers = table_vector(Model.StartBuffersVector, buffer_offsets)
    Model.Start(builder)
    Model.AddVersion(builder, 3)
    Model.AddOperatorCodes(builder, model_opcodes)
    Model.AddSubgraphs(builder, model_subgraphs)
    Model.AddDescription(builder, description)
    Model.AddBuffers(builder, model_buffers)
    root = Model.End(builder)
    builder.Finish(root, file_identifier=b'TFL3')
    return bytes(builder.Output())


def write(model, path):
    data = build(model)
    with open(path, 'wb') as handle:
        handle.write(data)
    return data
