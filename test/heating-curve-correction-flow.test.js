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

function createDevice(currentRawValue = 0) {
  const device = new LuxtronikDevice();
  const store = new Map();
  const writes = [];
  device.heatingCurveCorrectionTestOriginalRaw = null;
  device.log = () => {};
  device.error = () => {};
  device.getStoreValue = (key) => store.get(key);
  device.setStoreValue = async (key, value) => store.set(key, value);
  device.unsetStoreValue = async (key) => store.delete(key);
  device.readParameters = async () => {
    const parameters = [];
    parameters[1] = currentRawValue;
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

test('sets heating curve correction and saves the current value first', async () => {
  const { device, store, writes } = createDevice(0);
  const result = await device.setHeatingCurveCorrection(1);

  assert.equal(store.get('heatingCurveCorrectionTestOriginalRaw'), 0);
  assert.deepEqual(writes, [{ index: 1, rawValue: 10 }]);
  assert.equal(result.readBackValue, 10);
});

test('preserves the first original value across repeated set actions', async () => {
  const { device, store, writes } = createDevice(10);
  store.set('heatingCurveCorrectionTestOriginalRaw', 0);

  await device.setHeatingCurveCorrection(1.5);

  assert.equal(store.get('heatingCurveCorrectionTestOriginalRaw'), 0);
  assert.deepEqual(writes, [{ index: 1, rawValue: 15 }]);
});

test('rejects invalid values before saving or writing', async () => {
  for (const value of ['not-a-number', -5.5, 5.5, 1.1]) {
    const { device, store, writes } = createDevice();
    await assert.rejects(device.setHeatingCurveCorrection(value));
    assert.equal(store.size, 0);
    assert.equal(writes.length, 0);
  }
});

test('keeps the original value when restore fails', async () => {
  const { device, store } = createDevice(10);
  store.set('heatingCurveCorrectionTestOriginalRaw', 0);
  device.heatingCurveCorrectionTestOriginalRaw = 0;
  device.writeParameter = async () => {
    throw new Error('read-back failed');
  };

  await assert.rejects(device.restoreHeatingCurveCorrection(), /read-back failed/);
  assert.equal(store.get('heatingCurveCorrectionTestOriginalRaw'), 0);
  assert.equal(device.heatingCurveCorrectionTestOriginalRaw, 0);
});

test('serializes concurrent set actions and preserves the first original value', async () => {
  let currentRawValue = 0;
  const { device, store, writes } = createDevice();
  const firstWriteStarted = deferred();
  const releaseFirstWrite = deferred();
  device.readParameters = async () => {
    const parameters = [];
    parameters[1] = currentRawValue;
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

  const firstSet = device.setHeatingCurveCorrection(1);
  await firstWriteStarted.promise;
  const secondSet = device.setHeatingCurveCorrection(-1);
  await Promise.resolve();

  assert.deepEqual(writes, [{ index: 1, rawValue: 10 }]);
  releaseFirstWrite.resolve();
  await Promise.all([firstSet, secondSet]);

  assert.deepEqual(writes, [{ index: 1, rawValue: 10 }, { index: 1, rawValue: -10 }]);
  assert.equal(store.get('heatingCurveCorrectionTestOriginalRaw'), 0);
});

test('serializes restore after an in-flight set and cannot lose the original', async () => {
  let currentRawValue = 0;
  const { device, store, writes } = createDevice();
  const setWriteStarted = deferred();
  const releaseSetWrite = deferred();
  device.readParameters = async () => {
    const parameters = [];
    parameters[1] = currentRawValue;
    return parameters;
  };
  device.writeParameter = async (index, rawValue) => {
    writes.push({ index, rawValue });
    if (rawValue === 10) {
      setWriteStarted.resolve();
      await releaseSetWrite.promise;
    }
    currentRawValue = rawValue;
    return { readBackValue: rawValue };
  };

  const setOperation = device.setHeatingCurveCorrection(1);
  await setWriteStarted.promise;
  const restoreOperation = device.restoreHeatingCurveCorrection();
  await Promise.resolve();

  assert.deepEqual(writes, [{ index: 1, rawValue: 10 }]);
  assert.equal(store.get('heatingCurveCorrectionTestOriginalRaw'), 0);
  releaseSetWrite.resolve();
  await Promise.all([setOperation, restoreOperation]);

  assert.deepEqual(writes, [{ index: 1, rawValue: 10 }, { index: 1, rawValue: 0 }]);
  assert.equal(currentRawValue, 0);
  assert.equal(store.has('heatingCurveCorrectionTestOriginalRaw'), false);
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

  await assert.rejects(device.setHeatingCurveCorrection(1), /first write failed/);
  await device.setHeatingCurveCorrection(-1);

  assert.deepEqual(writes, [{ index: 1, rawValue: -10 }]);
});

test('Flow metadata exposes guarded set and restore actions', () => {
  const setAction = appManifest.flow.actions.find(({ id }) => id === 'set_heating_curve_correction');
  const restoreAction = appManifest.flow.actions.find(({ id }) => id === 'restore_heating_curve_correction');
  const correction = setAction.args.find(({ name }) => name === 'correction');

  assert.ok(setAction);
  assert.ok(restoreAction);
  assert.equal(correction.min, -5);
  assert.equal(correction.max, 5);
  assert.equal(correction.step, 0.5);
});
