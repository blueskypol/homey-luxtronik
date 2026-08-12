'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  COMMANDS,
  createWriteParameterBuffer,
  parseWriteParameterResponse,
} = require('../lib/LuxtronikProtocol');

test('encodes the verified parameter 110 write packet as signed int32 big-endian', () => {
  const packet = createWriteParameterBuffer(110, 220);
  assert.equal(packet.toString('hex'), '00000bba0000006e000000dc');
  assert.equal(packet.readInt32BE(0), COMMANDS.WRITE_PARAMETER);
});

test('parses the verified parameter 110 write response', () => {
  const response = parseWriteParameterResponse(Buffer.from('00000bba0000006e', 'hex'));
  assert.deepEqual(response, { command: 3002, parameterIndex: 110 });
});

test('rejects partial and oversized write responses', () => {
  assert.throws(() => parseWriteParameterResponse(Buffer.alloc(4)), /exactly 8/);
  assert.throws(() => parseWriteParameterResponse(Buffer.alloc(12)), /exactly 8/);
});
