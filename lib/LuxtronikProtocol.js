'use strict';

const COMMANDS = Object.freeze({
  WRITE_PARAMETER: 3002,
  READ_PARAMETERS: 3003,
  READ_CALCULATED: 3004,
});

function createWriteParameterBuffer(index, rawValue) {
  const buffer = Buffer.alloc(12);

  buffer.writeInt32BE(COMMANDS.WRITE_PARAMETER, 0);
  buffer.writeInt32BE(index, 4);
  buffer.writeInt32BE(rawValue, 8);

  return buffer;
}

function parseWriteParameterResponse(buffer) {
  if (buffer.length !== 8) {
    throw new Error(`Expected exactly 8 write response bytes, received ${buffer.length}`);
  }

  return {
    command: buffer.readInt32BE(0),
    parameterIndex: buffer.readInt32BE(4),
  };
}

function createCommandBuffer(command) {
  const buffer = Buffer.alloc(8);

  buffer.writeInt32BE(command, 0);
  buffer.writeInt32BE(0, 4);

  return buffer;
}

function parseInt32ArrayResponse(buffer) {
  const responseCommand = buffer.readInt32BE(0);
  const length = buffer.readInt32BE(4);

  const values = [];

  let offset = 8;
  for (let i = 0; i < length; i += 1) {
    values.push(buffer.readInt32BE(offset));
    offset += 4;
  }

  return {
    command: responseCommand,
    length,
    values,
  };
}

function parseCalculatedResponse(buffer) {
  const responseCommand = buffer.readInt32BE(0);
  const status = buffer.readInt32BE(4);
  const length = buffer.readInt32BE(8);

  const values = [];

  let offset = 12;
  for (let i = 0; i < length; i += 1) {
    values.push(buffer.readInt32BE(offset));
    offset += 4;
  }

  return {
    command: responseCommand,
    status,
    length,
    values,
  };
}

module.exports = {
  COMMANDS,
  createCommandBuffer,
  createWriteParameterBuffer,
  parseWriteParameterResponse,
  parseInt32ArrayResponse,
  parseCalculatedResponse,
};
