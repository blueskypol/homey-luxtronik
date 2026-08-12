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

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
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

test('serializes concurrent set actions and preserves the first original value', async () => {
  let currentRawValue = 190;
  const { device, store, writes } = createDevice();
  const firstWriteStarted = deferred();
  const releaseFirstWrite = deferred();
  device.readParameters = async () => {
    const parameters = [];
    parameters[110] = currentRawValue;
    return parameters;
  };
  device.writeParameter = async (index, rawValue) => {
    writes.push({ index, rawValue });
    if (writes.length === 1) {
      firstWriteStarted.resolve();
      await releaseFirstWrite.promise;
    }
    currentRawValue = rawValue;
    return { readBackValue: rawValue };
  };

  const firstSet = device.setCoolingReleaseTemperature(20);
  await firstWriteStarted.promise;
  const secondSet = device.setCoolingReleaseTemperature(15);
  await Promise.resolve();

  assert.deepEqual(writes, [{ index: 110, rawValue: 200 }]);
  releaseFirstWrite.resolve();
  await Promise.all([firstSet, secondSet]);

  assert.deepEqual(writes, [{ index: 110, rawValue: 200 }, { index: 110, rawValue: 150 }]);
  assert.equal(store.get('coolingReleaseTemperatureTestOriginalRaw'), 190);
});

test('serializes restore after an in-flight set and cannot lose the original', async () => {
  let currentRawValue = 190;
  const { device, store, writes } = createDevice();
  const setWriteStarted = deferred();
  const releaseSetWrite = deferred();
  device.readParameters = async () => {
    const parameters = [];
    parameters[110] = currentRawValue;
    return parameters;
  };
  device.writeParameter = async (index, rawValue) => {
    writes.push({ index, rawValue });
    if (rawValue === 200) {
      setWriteStarted.resolve();
      await releaseSetWrite.promise;
    }
    currentRawValue = rawValue;
    return { readBackValue: rawValue };
  };

  const setOperation = device.setCoolingReleaseTemperature(20);
  await setWriteStarted.promise;
  const restoreOperation = device.restoreCoolingReleaseTemperature();
  await Promise.resolve();

  assert.deepEqual(writes, [{ index: 110, rawValue: 200 }]);
  assert.equal(store.get('coolingReleaseTemperatureTestOriginalRaw'), 190);
  releaseSetWrite.resolve();
  await Promise.all([setOperation, restoreOperation]);

  assert.deepEqual(writes, [{ index: 110, rawValue: 200 }, { index: 110, rawValue: 190 }]);
  assert.equal(currentRawValue, 190);
  assert.equal(store.has('coolingReleaseTemperatureTestOriginalRaw'), false);
});

test('continues the queue after a failed operation', async () => {
  const { device, writes } = createDevice();
  let attempt = 0;
  device.writeParameter = async (index, rawValue) => {
    attempt += 1;
    if (attempt === 1) {
      throw new Error('first write failed');
    }
    writes.push({ index, rawValue });
    return { readBackValue: rawValue };
  };

  await assert.rejects(device.setCoolingReleaseTemperature(20), /first write failed/);
  await device.setCoolingReleaseTemperature(15);

  assert.deepEqual(writes, [{ index: 110, rawValue: 150 }]);
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
