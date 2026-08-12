'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  VERIFIED_LUXTRONIK_PARAMETERS,
  getWritableParameter,
  validateTemperatureRawValue,
} = require('../lib/LuxtronikWriteSupport');

const coolingRelease = VERIFIED_LUXTRONIK_PARAMETERS.COOLING_RELEASE_TEMPERATURE;

test('allowlists only the explicitly verified parameters', () => {
  assert.equal(getWritableParameter(105).name, 'DHW_TARGET');
  assert.equal(getWritableParameter(110), coolingRelease);
  assert.equal(getWritableParameter(108), null);
  assert.equal(getWritableParameter(109), null);
});

test('defines cooling release temperature as Celsius tenths', () => {
  assert.equal(coolingRelease.index, 110);
  assert.equal(coolingRelease.unit, '°C/10');
  assert.equal(validateTemperatureRawValue(coolingRelease, 220), 220);
});

test('strictly rejects invalid or out-of-range cooling release values', () => {
  assert.throws(() => validateTemperatureRawValue(coolingRelease, 99), /outside the test range/);
  assert.throws(() => validateTemperatureRawValue(coolingRelease, 351), /outside the test range/);
  assert.throws(() => validateTemperatureRawValue(coolingRelease, 220.5), /non-integer/);
  assert.throws(() => validateTemperatureRawValue(coolingRelease, NaN), /non-integer/);
});
