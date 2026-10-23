'use strict';

const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

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
  device.heatingCurveCorrectionTestOriginalRaw = null;
  device.testStore = store;
  device.log = () => {};
  device.error = () => {};
  device.getStoreValue = (key) => store.get(key);
  device.setStoreValue = async (key, value) => store.set(key, value);
  device.unsetStoreValue = async (key) => store.delete(key);
  device.waitForWriteSettle = async () => {};
  device.readParameters = async () => {
    const parameters = [];
    parameters[1] = currentRawValue;
    return parameters;
  };
  device.writeParameter = async (index, rawValue) => ({ index, rawValue });
  return device;
}

test('no-op test saves the fresh value, writes it, and verifies read-back', async () => {
  const device = createDevice(10);
  const writes = [];
  device.writeParameter = async (index, rawValue) => {
    writes.push({ index, rawValue });
    return { readBackValue: rawValue, writeResponse: { responseCommand: 3002, responseValue: index } };
  };

  const result = await device.testWriteHeatingCurveCorrectionNoop();

  assert.equal(device.heatingCurveCorrectionTestOriginalRaw, 10);
  assert.equal(device.testStore.get('heatingCurveCorrectionTestOriginalRaw'), 10);
  assert.deepEqual(writes, [{ index: 1, rawValue: 10 }]);
  assert.equal(result.readBackValue, 10);
});

test('no-op test rejects unsafe current values before writing', async () => {
  const device = createDevice(51);
  let writeCalled = false;
  device.writeParameter = async () => {
    writeCalled = true;
  };

  await assert.rejects(device.testWriteHeatingCurveCorrectionNoop(), /outside the test range/);
  assert.equal(writeCalled, false);
  assert.equal(device.heatingCurveCorrectionTestOriginalRaw, null);
});

test('explicit restore writes the saved original and clears it after verification', async () => {
  const device = createDevice(15);
  device.heatingCurveCorrectionTestOriginalRaw = 15;
  const writes = [];
  device.writeParameter = async (index, rawValue) => {
    writes.push({ index, rawValue });
    return { readBackValue: rawValue, writeResponse: { responseCommand: 3002, responseValue: index } };
  };

  const result = await device.restoreHeatingCurveCorrection();

  assert.deepEqual(writes, [{ index: 1, rawValue: 15 }]);
  assert.equal(result.readBackValue, 15);
  assert.equal(device.heatingCurveCorrectionTestOriginalRaw, null);
  assert.equal(device.testStore.has('heatingCurveCorrectionTestOriginalRaw'), false);
});

test('explicit restore survives an app restart by using the persistent original', async () => {
  const device = createDevice(15);
  await device.setStoreValue('heatingCurveCorrectionTestOriginalRaw', 15);
  device.heatingCurveCorrectionTestOriginalRaw = null;
  const writes = [];
  device.writeParameter = async (index, rawValue) => {
    writes.push({ index, rawValue });
    return { readBackValue: rawValue };
  };

  await device.restoreHeatingCurveCorrection();

  assert.deepEqual(writes, [{ index: 1, rawValue: 15 }]);
  assert.equal(device.testStore.has('heatingCurveCorrectionTestOriginalRaw'), false);
});

test('restore refuses to guess when no original value is saved', async () => {
  const device = createDevice();
  await assert.rejects(device.restoreHeatingCurveCorrection(), /no original test value/);
});
