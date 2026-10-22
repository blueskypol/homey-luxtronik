'use strict';

const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

const listeners = new Map();
const originalModuleLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === 'homey') {
    return {
      App: class App {

        constructor() {
          this.log = () => {};
          this.homey = {
            flow: {
              getActionCard: (id) => ({
                registerRunListener: (listener) => listeners.set(id, listener),
              }),
            },
          };
        }

      },
    };
  }
  return originalModuleLoad.call(this, request, parent, isMain);
};
const LuxtronikApp = require('../app');

Module._load = originalModuleLoad;

test('registers and delegates cooling release Flow actions', async () => {
  listeners.clear();
  const app = new LuxtronikApp();
  await app.onInit();

  assert.ok(listeners.has('set_cooling_release_temperature'));
  assert.ok(listeners.has('restore_cooling_release_temperature'));

  const calls = [];
  const device = {
    setCoolingReleaseTemperature: async (value) => calls.push(['set', value]),
    restoreCoolingReleaseTemperature: async () => calls.push(['restore']),
  };

  await listeners.get('set_cooling_release_temperature')({ device, temperature: 20 });
  await listeners.get('restore_cooling_release_temperature')({ device });

  assert.deepEqual(calls, [['set', 20], ['restore']]);
});

test('registers and delegates heating curve correction Flow actions', async () => {
  listeners.clear();
  const app = new LuxtronikApp();
  await app.onInit();

  assert.ok(listeners.has('set_heating_curve_correction'));
  assert.ok(listeners.has('restore_heating_curve_correction'));

  const calls = [];
  const device = {
    setHeatingCurveCorrection: async (value) => calls.push(['set', value]),
    restoreHeatingCurveCorrection: async () => calls.push(['restore']),
  };

  await listeners.get('set_heating_curve_correction')({ device, correction: 1 });
  await listeners.get('restore_heating_curve_correction')({ device });

  assert.deepEqual(calls, [['set', 1], ['restore']]);
});
