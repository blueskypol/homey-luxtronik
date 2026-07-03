'use strict';

const COMMANDS = Object.freeze({
  READ_PARAMETERS: 3003,
  READ_CALCULATED: 3004,
});

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
  parseInt32ArrayResponse,
  parseCalculatedResponse,
};