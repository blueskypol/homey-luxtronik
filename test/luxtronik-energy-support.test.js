'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  readCurrentPower,
  readEnergyInputs,
} = require('../lib/LuxtronikEnergySupport');

test('treats current power as unavailable when calculation 257 is absent', () => {
  assert.equal(readCurrentPower(new Array(249).fill(0)), null);
});

test('reads current power when calculation 257 is available', () => {
  const calculations = [];
  calculations[257] = 1234;
  assert.equal(readCurrentPower(calculations), 1234);
});

test('does not produce NaN when energy input parameters are absent', () => {
  assert.equal(readEnergyInputs(new Array(1100).fill(0)), null);
});

test('reads and totals complete energy input parameters', () => {
  const parameters = [];
  parameters[1136] = 10;
  parameters[1137] = 20;
  parameters[1138] = 30;
  parameters[1139] = 40;
  parameters[1140] = 50;

  assert.deepEqual(readEnergyInputs(parameters), {
    heat: 10,
    water: 20,
    pool: 30,
    cool: 40,
    second: 50,
    total: 150,
  });
});

test('rejects non-finite energy input values', () => {
  const parameters = new Array(1141).fill(0);
  parameters[1138] = NaN;
  assert.equal(readEnergyInputs(parameters), null);
});
