'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const Module = require('node:module');
const net = require('node:net');
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

function createDevice(currentRawValue = 220) {
  const device = new LuxtronikDevice();
  const store = new Map();
  device.coolingReleaseTemperatureTestOriginalRaw = null;
  device.testStore = store;
  device.log = () => {};
  device.error = () => {};
  device.getStoreValue = (key) => store.get(key);
  device.setStoreValue = async (key, value) => store.set(key, value);
  device.unsetStoreValue = async (key) => store.delete(key);
  device.waitForWriteSettle = async () => {};
  device.readParameters = async () => {
    const parameters = [];
    parameters[110] = currentRawValue;
    return parameters;
  };
  device.writeParameter = async (index, rawValue) => ({ index, rawValue });
  return device;
}

async function withFakeSocket(onWrite, action) {
  const OriginalSocket = net.Socket;

  class FakeSocket extends EventEmitter {

    setTimeout(timeout) {
      this.timeout = timeout;
    }

    connect(port, host, callback) {
      this.port = port;
      this.host = host;
      callback();
    }

    write(packet) {
      onWrite(this, packet);
    }

    destroy() {
      this.destroyed = true;
    }

  }

  net.Socket = FakeSocket;
  try {
    return await action();
  } finally {
    net.Socket = OriginalSocket;
  }
}

function createSocketDevice() {
  const device = createDevice();
  delete device.writeParameter;
  device.getHost = () => 'fake-luxtronik.local';
  return device;
}

test('socket write sends parameter 110 packet and accepts a fragmented response', async () => {
  const device = createSocketDevice();

  const result = await withFakeSocket((socket, packet) => {
    assert.equal(socket.port, 8889);
    assert.equal(socket.host, 'fake-luxtronik.local');
    assert.equal(socket.timeout, 5000);
    assert.equal(packet.toString('hex'), '00000bba0000006e000000dc');
    socket.emit('data', Buffer.from('00000bba', 'hex'));
    socket.emit('data', Buffer.from('0000006e', 'hex'));
  }, () => device.writeParameter(110, 220));

  assert.equal(result.writeResponse.responseCommand, 3002);
  assert.equal(result.writeResponse.responseValue, 110);
  assert.equal(result.readBackValue, 220);
});

test('socket write rejects a mismatched response command', async () => {
  const device = createSocketDevice();
  await assert.rejects(
    withFakeSocket((socket) => socket.emit('data', Buffer.from('00000bbb0000006e', 'hex')),
      () => device.writeParameter(110, 220)),
    /response command 3003 did not match 3002/,
  );
});

test('socket write rejects a mismatched response parameter', async () => {
  const device = createSocketDevice();
  await assert.rejects(
    withFakeSocket((socket) => socket.emit('data', Buffer.from('00000bba00000069', 'hex')),
      () => device.writeParameter(110, 220)),
    /response value 105 did not match parameter 110/,
  );
});

test('socket write propagates connection errors', async () => {
  const device = createSocketDevice();
  await assert.rejects(
    withFakeSocket((socket) => socket.emit('error', new Error('connection refused')),
      () => device.writeParameter(110, 220)),
    /connection refused/,
  );
});

test('socket write rejects on timeout', async () => {
  const device = createSocketDevice();
  await assert.rejects(
    withFakeSocket((socket) => socket.emit('timeout'), () => device.writeParameter(110, 220)),
    /timed out after 5000ms/,
  );
});

test('no-op test saves the fresh value, writes it, and verifies read-back', async () => {
  const device = createDevice(220);
  const writes = [];
  device.writeParameter = async (index, rawValue) => {
    writes.push({ index, rawValue });
    return { readBackValue: rawValue, writeResponse: { responseCommand: 3002, responseValue: index } };
  };

  const result = await device.testWriteCoolingReleaseTemperatureNoop();

  assert.equal(device.coolingReleaseTemperatureTestOriginalRaw, 220);
  assert.equal(device.testStore.get('coolingReleaseTemperatureTestOriginalRaw'), 220);
  assert.deepEqual(writes, [{ index: 110, rawValue: 220 }]);
  assert.equal(result.readBackValue, 220);
});

test('no-op test rejects unsafe current values before writing', async () => {
  const device = createDevice(99);
  let writeCalled = false;
  device.writeParameter = async () => {
    writeCalled = true;
  };

  await assert.rejects(device.testWriteCoolingReleaseTemperatureNoop(), /outside the test range/);
  assert.equal(writeCalled, false);
  assert.equal(device.coolingReleaseTemperatureTestOriginalRaw, null);
});

test('write verification rejects a read-back mismatch', async () => {
  const device = createDevice(221);
  delete device.writeParameter;
  device.getHost = () => 'fake-luxtronik.local';

  await assert.rejects(
    withFakeSocket((socket) => socket.emit('data', Buffer.from('00000bba0000006e', 'hex')),
      () => device.writeParameter(110, 220)),
    /expected raw value 220, got 221/,
  );
});

test('explicit restore writes the saved original and clears it after verification', async () => {
  const device = createDevice(215);
  device.coolingReleaseTemperatureTestOriginalRaw = 215;
  const writes = [];
  device.writeParameter = async (index, rawValue) => {
    writes.push({ index, rawValue });
    return { readBackValue: rawValue, writeResponse: { responseCommand: 3002, responseValue: index } };
  };

  const result = await device.restoreCoolingReleaseTemperature();

  assert.deepEqual(writes, [{ index: 110, rawValue: 215 }]);
  assert.equal(result.readBackValue, 215);
  assert.equal(device.coolingReleaseTemperatureTestOriginalRaw, null);
  assert.equal(device.testStore.has('coolingReleaseTemperatureTestOriginalRaw'), false);
});

test('explicit restore survives an app restart by using the persistent original', async () => {
  const device = createDevice(215);
  await device.setStoreValue('coolingReleaseTemperatureTestOriginalRaw', 215);
  device.coolingReleaseTemperatureTestOriginalRaw = null;
  const writes = [];
  device.writeParameter = async (index, rawValue) => {
    writes.push({ index, rawValue });
    return { readBackValue: rawValue };
  };

  await device.restoreCoolingReleaseTemperature();

  assert.deepEqual(writes, [{ index: 110, rawValue: 215 }]);
  assert.equal(device.testStore.has('coolingReleaseTemperatureTestOriginalRaw'), false);
});

test('restore refuses to guess when no original value is saved', async () => {
  const device = createDevice();
  await assert.rejects(device.restoreCoolingReleaseTemperature(), /no original test value/);
});
