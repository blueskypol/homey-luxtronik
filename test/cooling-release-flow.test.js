'use strict';

const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');
const appManifest = require('../app.json');

const originalModuleLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === 'homey') {
    return { Device: function Device() {} };
  }
  return originalModuleLoad.call(this, request, parent, isMain);
};
const LuxtronikDevice = require('../drivers/luxtronik-2/device');

Module._load = originalModuleLoad;

function createDevice(currentRawValue = 190) {
  const device = new LuxtronikDevice();
  const store = new Map();
  const writes = [];
  device.coolingReleaseTemperatureTestOriginalRaw = null;
  device.log = () => {};
  device.error = () => {};
  device.getStoreValue = (key) => store.get(key);
  device.setStoreValue = async (key, value) => store.set(key, value);
  device.unsetStoreValue = async (key) => store.delete(key);
  device.readParameters = async () => {
    const parameters = [];
    parameters[110] = currentRawValue;
    return parameters;
  };
  device.writeParameter = async (index, rawValue) => {
    writes.push({ index, rawValue });
    return { parameterIndex: index, rawValue, readBackValue: rawValue };
  };
  return { device, store, writes };
}

test('sets cooling release temperature and saves the current value first', async () => {
  const { device, store, writes } = createDevice(190);
  const result = await device.setCoolingReleaseTemperature(20);

  assert.equal(store.get('coolingReleaseTemperatureTestOriginalRaw'), 190);
  assert.deepEqual(writes, [{ index: 110, rawValue: 200 }]);
  assert.equal(result.readBackValue, 200);
});

test('preserves the first original value across repeated set actions', async () => {
  const { device, store, writes } = createDevice(200);
  store.set('coolingReleaseTemperatureTestOriginalRaw', 190);

  await device.setCoolingReleaseTemperature(20.5);

  assert.equal(store.get('coolingReleaseTemperatureTestOriginalRaw'), 190);
  assert.deepEqual(writes, [{ index: 110, rawValue: 205 }]);
});

test('rejects invalid values before saving or writing', async () => {
  for (const value of ['not-a-number', 9.5, 35.5, 20.1]) {
    const { device, store, writes } = createDevice();
    await assert.rejects(device.setCoolingReleaseTemperature(value));
    assert.equal(store.size, 0);
    assert.equal(writes.length, 0);
  }
});

test('keeps the original value when restore fails', async () => {
  const { device, store } = createDevice(200);
  store.set('coolingReleaseTemperatureTestOriginalRaw', 190);
  device.coolingReleaseTemperatureTestOriginalRaw = 190;
  device.writeParameter = async () => {
    throw new Error('read-back failed');
  };

  await assert.rejects(device.restoreCoolingReleaseTemperature(), /read-back failed/);
  assert.equal(store.get('coolingReleaseTemperatureTestOriginalRaw'), 190);
  assert.equal(device.coolingReleaseTemperatureTestOriginalRaw, 190);
});

test('Flow metadata exposes guarded set and restore actions', () => {
  const setAction = appManifest.flow.actions.find(({ id }) => id === 'set_cooling_release_temperature');
  const restoreAction = appManifest.flow.actions.find(({ id }) => id === 'restore_cooling_release_temperature');
  const temperature = setAction.args.find(({ name }) => name === 'temperature');

  assert.ok(setAction);
  assert.ok(restoreAction);
  assert.equal(temperature.min, 10);
  assert.equal(temperature.max, 35);
  assert.equal(temperature.step, 0.5);
});
