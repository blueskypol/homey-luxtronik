'use strict';

const { Device } = require('homey');
const net = require("net");
const LuxtronikOperationMode = require("../../includes/luxtronik_operationmode");
const {
  COMMANDS,
  createWriteParameterBuffer,
  parseWriteParameterResponse,
} = require('../../lib/LuxtronikProtocol');
const {
  VERIFIED_LUXTRONIK_PARAMETERS,
  getWritableParameter,
  validateTemperatureRawValue,
} = require('../../lib/LuxtronikWriteSupport');
const {
  readCurrentPower,
  readEnergyInputs,
} = require('../../lib/LuxtronikEnergySupport');

const COOLING_RELEASE_TEST_ORIGINAL_STORE_KEY = 'coolingReleaseTemperatureTestOriginalRaw';

const COOLING_DIAGNOSTIC_FIELDS = Object.freeze({
  COOLING_MODE: Object.freeze({
    index: 108,
    luxtronikName: 'ID_Einst_BA_Kuehl_akt',
  }),
  COOLING_RELEASE_TEMPERATURE: Object.freeze({
    index: 110,
    luxtronikName: 'ID_Einst_KuehlFreig_akt',
  }),
  COOLING_RELEASE_ACTIVE: Object.freeze({
    index: 146,
    luxtronikName: 'ID_WEB_FreigabKuehl',
    source: 'calculation',
  }),
  OPERATION_MODE: Object.freeze({
    index: 80,
    source: 'calculation',
  }),
});



class LuxtronikDevice extends Device {

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('LuxtronikDevice has been initialized');

    // This if statement is needed to automatically add missing capabilities for people who
    // already had the app setup, as new capabilities aren't added pro-actively.
    if (this.hasCapability('measure_power.current') === false) {
      this.log('measure_power.current has not been added yet, adding...');
      await this.addCapability('measure_power.current');
    }
    if (this.hasCapability('meter_power.heat2') === false) {
      this.log('meter_power.heat2 has not been added yet, adding...');
      await this.addCapability('meter_power.heat2');
    }
    if (this.hasCapability('measure_temperature.heating_feedback_calculated') === false) {
      this.log('measure_temperature.heating_feedback_calculated has not been added yet, adding...');
      await this.addCapability('measure_temperature.heating_feedback_calculated');
    }
    if (this.hasCapability('measure_temperature.heating_feedback_external') === false) {
      this.log('measure_temperature.heating_feedback_external has not been added yet, adding...');
      await this.addCapability('measure_temperature.heating_feedback_external');
    }

    this.energyTotal = null;
    this.energyHeat = null;
    this.energyWater = null;
    this.energyPool = null;

    this.energyInputTotal = null;
    this.energyInputHeat = null;
    this.energyInputHeat2 = null;
    this.energyInputCool = null;
    this.energyInputWater = null;
    this.energyInputPool = null;

    this.energyCurrent = null;

    this.temperatureHotGas = null;
    this.temperatureOutdoor = null;
    this.temperatureRoomCurrent = null;
    this.temperatureRoomTarget = null;
    this.temperatureWaterCurrent = null;
    this.temperatureWaterTarget = null;
    this.temperatureSourceIn = null;
    this.temperatureSourceOut = null;
    this.temperatureHeatingSupply = null;
    this.temperatureHeatingFeedback = null;
    this.temperatureHeatingFeedbackExt = null;
    this.temperatureHeatingFeedbackCalc = null;

    this.water = null;

    this.operationMode = new LuxtronikOperationMode();

    this.parametersArray = null;
    this.calulationsArray = null;
    this.previousCoolingDiagnosticState = null;
    this.coolingReleaseTemperatureTestOriginalRaw = this.getStoreValue(COOLING_RELEASE_TEST_ORIGINAL_STORE_KEY);
    this.coolingReleaseOperationQueue = Promise.resolve();

    this.scan();

  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('LuxtronikDevice has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('LuxtronikDevice settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.log('LuxtronikDevice was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('LuxtronikDevice has been deleted');
  }

  clearScanTimer() {
    if (this.scanTimer) {
      this.homey.clearTimeout(this.scanTimer);
      this.scanTimer = undefined;
    }
  }

  scheduleScans(interval) {
    if (this._deleted) {
      return;
    }
    this.clearScanTimer();
    this.scanTimer = this.homey.setTimeout(this.scan.bind(this), interval);
  }

  getHost() {
    return this.getSettings().host;
  }

  /**
   * 
   */
  async scan() {
    const host = this.getHost();
    const port = "8889";
    const interval = 36000;
    const timeout = 36000;
    this.log(host, port, interval, timeout)
    try {
      this.scanDevice(host, port, timeout);

      this.log("Triggering setCapabilityValue")

      // if (this.energyTotal !== null) await this.setCapabilityValue('meter_power.total', this.energyTotal / 10).catch(this.error);

      // This should only apply when firmware >x.88 is active; For now this is fixed by checking the energyTotal
      // TODO: This should check a version variable;
      if (this.calulationsArray !== null && this.calulationsArray[154] === 0) {
        if (this.energyHeat !== null && this.parametersArray !== null) await this.setCapabilityValue('meter_power.heat', (this.energyHeat + this.parametersArray[1059]) / 10).catch(this.error);
      } else {
        if (this.energyHeat !== null) await this.setCapabilityValue('meter_power.heat', (this.energyHeat) / 10).catch(this.error);
      }
      if (this.energyWater !== null) await this.setCapabilityValue('meter_power.water', this.energyWater / 10).catch(this.error);
      if (this.energyPool !== null) await this.setCapabilityValue('meter_power.pool', this.energyPool / 10).catch(this.error);
      if (Number.isFinite(this.parametersArray?.[1059])) await this.setCapabilityValue('meter_power.heat2', this.parametersArray[1059] / 10).catch(this.error);

      if (this.parametersArray !== null && this.calulationsArray !== null && this.energyTotal !== null) {
        this.log("Not null")
        if (this.calulationsArray[154] === 0) {
          this.log("Zero in energyTotal; Assuming newer firmware")
          this.log(this.calulationsArray[151], this.calulationsArray[152], this.calulationsArray[153], this.parametersArray[1059])
          this.energyTotal = (this.calulationsArray[151] + this.calulationsArray[152] + this.calulationsArray[153] + this.parametersArray[1059]);
        } else {
          this.log("Amount in energyTotal; Assuming older firmware")
        }
        await this.setCapabilityValue('meter_power.total', this.energyTotal / 10).catch(this.error);
      } else {
        this.log(this.parametersArray !== null, this.calulationsArray !== null, this.energyTotal !== null)
      }


      // if (this.energyInputTotal !== null) await this.setCapabilityValue('meter_power.total', this.energyTotal / 100).catch(this.error);
      // if (this.energyInputHeat !== null) await this.setCapabilityValue('meter_power.heat', this.energyHeat / 100).catch(this.error);
      // if (this.energyInputCool !== null) await this.setCapabilityValue('meter_power.heat', this.energyCool / 100).catch(this.error);
      // if (this.energyInputWater !== null) await this.setCapabilityValue('meter_power.water', this.energyWater / 100).catch(this.error);
      // if (this.energyInputPool !== null) await this.setCapabilityValue('meter_power.pool', this.energyPool / 100).catch(this.error);

      if (Number.isFinite(this.energyCurrent)) await this.setCapabilityValue('measure_power.current', this.energyCurrent).catch(this.error);

      if (this.temperatureOutdoor !== null) await this.setCapabilityValue('measure_temperature.outdoor', this.temperatureOutdoor / 10).catch(this.error);
      if (this.temperatureHotGas !== null) await this.setCapabilityValue('measure_temperature.hotgas', this.temperatureHotGas / 10).catch(this.error);
      if (this.temperatureRoomCurrent !== null) await this.setCapabilityValue('measure_temperature.room', this.temperatureRoomCurrent / 10).catch(this.error);
      if (this.temperatureRoomTarget !== null) await this.setCapabilityValue('measure_temperature.room_target', this.temperatureRoomTarget / 10).catch(this.error);
      if (this.temperatureWaterCurrent !== null) await this.setCapabilityValue('measure_temperature.water', this.temperatureWaterCurrent / 10).catch(this.error);
      if (this.temperatureWaterTarget !== null) await this.setCapabilityValue('measure_temperature.water_target', this.temperatureWaterTarget / 10).catch(this.error);
      if (this.temperatureSourceIn !== null) await this.setCapabilityValue('measure_temperature.source_in', this.temperatureSourceIn / 10).catch(this.error);
      if (this.temperatureSourceOut !== null) await this.setCapabilityValue('measure_temperature.source_out', this.temperatureSourceOut / 10).catch(this.error);
      if (this.temperatureHeatingSupply !== null) await this.setCapabilityValue('measure_temperature.heating_supply', this.temperatureHeatingSupply / 10).catch(this.error);
      if (this.temperatureHeatingFeedback !== null) await this.setCapabilityValue('measure_temperature.heating_feedback', this.temperatureHeatingFeedback / 10).catch(this.error);
      if (this.temperatureHeatingFeedbackExt !== null) await this.setCapabilityValue('measure_temperature.heating_feedback_external', this.temperatureHeatingFeedbackExt / 10).catch(this.error);
      if (this.temperatureHeatingFeedbackCalc !== null) await this.setCapabilityValue('measure_temperature.heating_feedback_calculated', this.temperatureHeatingFeedbackCalc / 10).catch(this.error);

      if (this.water !== null) await this.setCapabilityValue('measure_water', this.water).catch(this.error);

      if (this.operationMode.getOperationMode() !== null) await this.setCapabilityValue('luxtronik_operationmode', this.operationMode.getOperationMode()).catch(this.error);

    } finally {
      this.scheduleScans(interval);
    }


  }

  destroyClient() {
    if (this.client) {
      this.client.destroy();
      this.client = undefined;
    }
    if (this.cancelCheck) {
      this.homey.clearTimeout(this.cancelCheck);
      this.cancelCheck = undefined;
    }
  }

  sendRequest(request, callback) {
    const header = Buffer.alloc(4);
    header.writeInt32LE(request.length, 0);
    this.client.write(Buffer.concat([header, request]));
    this.receivedData = Buffer.alloc(0);

    const onData = data => {
      this.receivedData = Buffer.concat([this.receivedData, data]);
      while (this.receivedData.length >= 4) {
        const messageLength = this.receivedData.readInt32LE(0);
        if (this.receivedData.length >= messageLength + 4) {
          const message = this.receivedData.slice(4, messageLength + 4);
          callback(message);
          this.receivedData = this.receivedData.slice(messageLength + 4);
        } else {
          break;
        }
      }
    };

    this.client.on('data', onData);

    const onceEndOrError = () => {
      this.client.off('data', onData);
      this.client.off('end', onceEndOrError);
      this.client.off('error', onceEndOrError);
    };

    this.client.once('end', onceEndOrError);
    this.client.once('error', onceEndOrError);
  }

  #writeParameterRaw(index, rawValue) {
    const command = COMMANDS.WRITE_PARAMETER;
    const port = 8889;
    const timeout = 5000;
    const host = this.getHost();

    const parameter = getWritableParameter(index);
    if (!parameter) {
      return Promise.reject(new Error(`Refusing to write unsupported Luxtronik parameter ${index}`));
    }

    try {
      validateTemperatureRawValue(parameter, rawValue);
    } catch (error) {
      return Promise.reject(error);
    }

    this.log('Luxtronik writeParameter request', {
      command,
      parameterName: parameter.name,
      index,
      rawValue,
    });

    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let receivedData = Buffer.alloc(0);
      let settled = false;

      const finish = (error, result) => {
        if (settled) {
          return;
        }
        settled = true;
        socket.destroy();
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      };

      socket.setTimeout(timeout);

      socket.once('timeout', () => {
        finish(new Error(`Luxtronik writeParameter timed out after ${timeout}ms`));
      });

      socket.once('error', (error) => {
        finish(error);
      });

      socket.on('data', (data) => {
        receivedData = Buffer.concat([receivedData, data]);
        if (receivedData.length < 8) {
          return;
        }

        let parsedResponse;
        try {
          parsedResponse = parseWriteParameterResponse(receivedData);
        } catch (error) {
          finish(error);
          return;
        }
        const responseCommand = parsedResponse.command;
        const responseValue = parsedResponse.parameterIndex;
        const response = {
          command,
          parameterName: parameter.name,
          index,
          rawValue,
          responseCommand,
          responseValue,
        };

        this.log('Luxtronik writeParameter response', response);

        if (responseCommand !== command) {
          finish(new Error(`Luxtronik writeParameter response command ${responseCommand} did not match ${command}`));
          return;
        }

        if (responseValue !== index) {
          finish(new Error(`Luxtronik writeParameter response value ${responseValue} did not match parameter ${index}`));
          return;
        }

        finish(null, response);
      });

      socket.connect(port, host, () => {
        socket.write(createWriteParameterBuffer(index, rawValue));
      });
    });
  }

  writeParameter(index, rawValue) {
    const parameter = getWritableParameter(index);
    if (!parameter) {
      return Promise.reject(new Error(`Refusing to write unsupported Luxtronik parameter ${index}`));
    }

    return this.writeAndVerifyParameter(parameter, rawValue, `parameter ${index}`);
  }

  readParameters() {
    const command = 3003;
    const port = 8889;
    const timeout = 5000;
    const host = this.getHost();

    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let receivedData = Buffer.alloc(0);
      let settled = false;

      const finish = (error, result) => {
        if (settled) {
          return;
        }
        settled = true;
        socket.destroy();
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      };

      socket.setTimeout(timeout);

      socket.once('timeout', () => {
        finish(new Error(`Luxtronik readParameters timed out after ${timeout}ms`));
      });

      socket.once('error', (error) => {
        finish(error);
      });

      socket.on('data', (data) => {
        receivedData = Buffer.concat([receivedData, data]);
        if (receivedData.length < 8) {
          return;
        }

        const responseCommand = receivedData.readInt32BE(0);
        const length = receivedData.readInt32BE(4);
        const expectedLength = 8 + length * 4;

        if (receivedData.length < expectedLength) {
          return;
        }

        if (responseCommand !== command) {
          finish(new Error(`Luxtronik readParameters response command ${responseCommand} did not match ${command}`));
          return;
        }

        const parameters = [];
        let offset = 8;

        for (let i = 0; i < length; i++) {
          parameters.push(receivedData.readInt32BE(offset));
          offset += 4;
        }

        this.parametersArray = parameters;
        finish(null, parameters);
      });

      socket.connect(port, host, () => {
        const request = Buffer.alloc(8);
        request.writeInt32BE(command, 0);
        request.writeInt32BE(0, 4);
        socket.write(request);
      });
    });
  }

  waitForWriteSettle(timeout) {
    return new Promise((resolve) => {
      this.homey.setTimeout(resolve, timeout);
    });
  }

  async setDhwTargetTemperature(value) {
    const parameter = VERIFIED_LUXTRONIK_PARAMETERS.DHW_TARGET;
    const temperature = Number(value);

    if (!Number.isFinite(temperature)) {
      throw new Error(`DHW target temperature must be a number, received '${value}'.`);
    }

    if (temperature < parameter.validationMinCelsius || temperature > parameter.validationMaxCelsius) {
      throw new Error(`DHW target temperature ${temperature} °C is outside the allowed range of ${parameter.validationMinCelsius}-${parameter.validationMaxCelsius} °C.`);
    }

    const rawValue = Math.round(temperature * 10);

    this.log('Luxtronik set DHW target temperature requested', {
      parameterName: parameter.name,
      parameterIndex: parameter.index,
      luxtronikName: parameter.luxtronikName,
      temperature,
      rawValue,
    });

    const result = await this.writeParameter(parameter.index, rawValue);

    this.log('Luxtronik set DHW target temperature verified', {
      parameterName: parameter.name,
      parameterIndex: parameter.index,
      luxtronikName: parameter.luxtronikName,
      temperature,
      rawValue,
      writeResponse: result.writeResponse,
      readBackValue: result.readBackValue,
    });

    return {
      parameterName: parameter.name,
      parameterIndex: parameter.index,
      luxtronikName: parameter.luxtronikName,
      temperature,
      rawValue,
      writeResponse: result.writeResponse,
      readBackValue: result.readBackValue,
    };
  }

  async testWriteDhwTargetNoop() {
    const parameter = VERIFIED_LUXTRONIK_PARAMETERS.DHW_TARGET;

    if (!Array.isArray(this.parametersArray) || this.parametersArray[parameter.index] === undefined) {
      throw new Error(`Cannot run DHW no-op write test: current parameter ${parameter.index} (${parameter.name}) is not available. Wait for a successful parameter scan first.`);
    }

    const currentRawValue = this.parametersArray[parameter.index];

    if (!Number.isInteger(currentRawValue)) {
      throw new Error(`Cannot run DHW no-op write test: current parameter ${parameter.index} (${parameter.name}) value '${currentRawValue}' is not an integer.`);
    }

    this.log('Luxtronik DHW target no-op write test starting', {
      parameterName: parameter.name,
      parameterIndex: parameter.index,
      luxtronikName: parameter.luxtronikName,
      currentRawValue,
    });

    const result = await this.writeParameter(parameter.index, currentRawValue);

    this.log('Luxtronik DHW target no-op write test completed', result);

    return result;
  }

  async writeAndVerifyParameter(parameter, rawValue, operation) {
    validateTemperatureRawValue(parameter, rawValue);
    this.log(`Luxtronik ${operation} write starting`, {
      parameterName: parameter.name,
      parameterIndex: parameter.index,
      luxtronikName: parameter.luxtronikName,
      rawValue,
      temperature: rawValue / 10,
    });

    try {
      const writeResponse = await this.#writeParameterRaw(parameter.index, rawValue);
      await this.waitForWriteSettle(1500);
      const parameters = await this.readParameters();
      const readBackValue = parameters[parameter.index];

      this.log(`Luxtronik ${operation} read-back`, {
        parameterName: parameter.name,
        parameterIndex: parameter.index,
        rawValue,
        writeResponse,
        readBackValue,
      });

      if (readBackValue !== rawValue) {
        throw new Error(`${parameter.name} read-back verification failed for parameter ${parameter.index}: expected raw value ${rawValue}, got ${readBackValue}.`);
      }

      return {
        parameterName: parameter.name,
        parameterIndex: parameter.index,
        rawValue,
        readBackValue,
        writeResponse,
      };
    } catch (error) {
      this.error(`Luxtronik ${operation} failed`, {
        parameterName: parameter.name,
        parameterIndex: parameter.index,
        rawValue,
        message: error.message,
      });
      throw error;
    }
  }

  testWriteCoolingReleaseTemperatureNoop() {
    return this.queueCoolingReleaseOperation(() => this.testWriteCoolingReleaseTemperatureNoopQueued());
  }

  async testWriteCoolingReleaseTemperatureNoopQueued() {
    const parameter = VERIFIED_LUXTRONIK_PARAMETERS.COOLING_RELEASE_TEMPERATURE;
    const parameters = await this.readParameters();
    const currentRawValue = parameters[parameter.index];
    validateTemperatureRawValue(parameter, currentRawValue);

    await this.saveCoolingReleaseTemperatureOriginal(currentRawValue);
    this.log('Luxtronik cooling release test original value saved', {
      parameterIndex: parameter.index,
      rawValue: currentRawValue,
      temperature: currentRawValue / 10,
    });

    return this.writeParameter(parameter.index, currentRawValue);
  }

  async saveCoolingReleaseTemperatureOriginal(currentRawValue) {
    const savedRawValue = this.coolingReleaseTemperatureTestOriginalRaw
      ?? this.getStoreValue(COOLING_RELEASE_TEST_ORIGINAL_STORE_KEY);

    if (savedRawValue !== undefined && savedRawValue !== null) {
      validateTemperatureRawValue(
        VERIFIED_LUXTRONIK_PARAMETERS.COOLING_RELEASE_TEMPERATURE,
        savedRawValue,
      );
      this.coolingReleaseTemperatureTestOriginalRaw = savedRawValue;
      return savedRawValue;
    }

    await this.setStoreValue(COOLING_RELEASE_TEST_ORIGINAL_STORE_KEY, currentRawValue);
    this.coolingReleaseTemperatureTestOriginalRaw = currentRawValue;
    return currentRawValue;
  }

  queueCoolingReleaseOperation(operation) {
    const previousOperation = this.coolingReleaseOperationQueue || Promise.resolve();
    const currentOperation = previousOperation.catch(() => {}).then(operation);

    this.coolingReleaseOperationQueue = currentOperation.catch(() => {});
    return currentOperation;
  }

  setCoolingReleaseTemperature(value) {
    return this.queueCoolingReleaseOperation(() => this.setCoolingReleaseTemperatureQueued(value));
  }

  async setCoolingReleaseTemperatureQueued(value) {
    const parameter = VERIFIED_LUXTRONIK_PARAMETERS.COOLING_RELEASE_TEMPERATURE;
    const temperature = Number(value);

    if (!Number.isFinite(temperature)) {
      throw new Error(`Cooling release temperature must be a number, received '${value}'.`);
    }
    if (!Number.isInteger(temperature * 2)) {
      throw new Error(`Cooling release temperature ${temperature} °C must use 0.5 °C increments.`);
    }

    const rawValue = temperature * 10;
    validateTemperatureRawValue(parameter, rawValue);

    const parameters = await this.readParameters();
    const currentRawValue = parameters[parameter.index];
    validateTemperatureRawValue(parameter, currentRawValue);
    const originalRawValue = await this.saveCoolingReleaseTemperatureOriginal(currentRawValue);

    this.log('Luxtronik set cooling release temperature requested', {
      parameterIndex: parameter.index,
      luxtronikName: parameter.luxtronikName,
      originalRawValue,
      currentRawValue,
      rawValue,
      temperature,
    });

    return this.writeParameter(parameter.index, rawValue);
  }

  restoreCoolingReleaseTemperature() {
    return this.queueCoolingReleaseOperation(() => this.restoreCoolingReleaseTemperatureQueued());
  }

  async restoreCoolingReleaseTemperatureQueued() {
    const parameter = VERIFIED_LUXTRONIK_PARAMETERS.COOLING_RELEASE_TEMPERATURE;
    const originalRawValue = this.coolingReleaseTemperatureTestOriginalRaw
      ?? this.getStoreValue(COOLING_RELEASE_TEST_ORIGINAL_STORE_KEY);

    if (!Number.isInteger(originalRawValue)) {
      throw new Error('Cannot restore cooling release temperature: no original test value has been saved.');
    }

    const result = await this.writeParameter(parameter.index, originalRawValue);
    await this.unsetStoreValue(COOLING_RELEASE_TEST_ORIGINAL_STORE_KEY);
    this.coolingReleaseTemperatureTestOriginalRaw = null;
    this.log('Luxtronik cooling release original value restored', result);
    return result;
  }


  /**
   * Send Commands to Luxtronik Devices. 
   *
   * This function can send commands to Luxtronik devices over TCP-sockets.
   *
   *
   * @param {integer}  command      The command to send to the Luxtronik Controller.
   * @param {string}   host         The IP of the Luxtronik Controller.
   * @param {string}   [port=8889]  The port of the Luxtronik Controller. Default to the default Luxtronik port
   *
   */
  sendCommand(command, host, port = 8889) {
    try {
      this.log("Trying to connect...");
      this.client.connect(port, host, () => {
        this.log("Connected!");
        const buffer = Buffer.alloc(4);
        buffer.writeInt32BE(command);
        this.client.write(buffer);

        buffer.writeInt32BE(0);
        this.client.write(buffer);
        this.log("Data sent!");
      });
    } catch (error) {
      console.error(`Error: connection failed ${error}`);
      this.destroyClient();
    }
  }

  decodeCoolingMode(value) {
    switch (value) {
      case 0:
        return 'Off';
      case 1:
        return 'Automatic';
      default:
        return 'Unknown';
    }
  }

  decodeCoolingStatus(value) {
    switch (value) {
      case 0:
        return 'Off';
      case 1:
        return 'No demand';
      case 2:
        return 'Demand';
      case 3:
        return 'Active';
      default:
        return 'Unknown';
    }
  }

  decodeOperationMode(value) {
    switch (value) {
      case 0:
        return 'Heating';
      case 1:
        return 'Hot Water';
      case 2:
        return 'Swimming Pool/Solar';
      case 3:
        return 'EVU';
      case 4:
        return 'Defrost';
      case 5:
        return 'No Request';
      case 6:
        return 'Heating External';
      case 7:
        return 'Cooling';
      default:
        return 'Unknown';
    }
  }

  formatEnumValue(value, decodedValue) {
    if (value === undefined || value === null) {
      return 'unavailable';
    }

    return `${value} (${decodedValue})`;
  }

  formatBooleanValue(value) {
    if (value === undefined || value === null) {
      return 'unavailable';
    }

    if (value === 0) {
      return '0 (No)';
    }

    if (value === 1) {
      return '1 (Yes)';
    }

    return `${value} (Unknown)`;
  }

  formatRawCelsius(value) {
    if (value === undefined || value === null) {
      return 'unavailable';
    }

    return `${value / 10} °C (raw ${value})`;
  }

  formatDecodedEnum(value, decodedValue) {
    if (value === undefined || value === null) {
      return 'unavailable';
    }

    return `${decodedValue} (${value})`;
  }

  getCoolingDiagnosticState() {
    return {
      coolingMode: this.parametersArray?.[COOLING_DIAGNOSTIC_FIELDS.COOLING_MODE.index],
      coolingReleaseTemperature: this.parametersArray?.[COOLING_DIAGNOSTIC_FIELDS.COOLING_RELEASE_TEMPERATURE.index],
      coolingReleaseActive: this.calulationsArray?.[COOLING_DIAGNOSTIC_FIELDS.COOLING_RELEASE_ACTIVE.index],
      operationMode: this.calulationsArray?.[COOLING_DIAGNOSTIC_FIELDS.OPERATION_MODE.index],
      outdoorTemperature: this.temperatureOutdoor,
    };
  }

  hasCoolingDiagnosticChanges(previousState, currentState) {
    return previousState.coolingMode !== currentState.coolingMode
      || previousState.coolingReleaseTemperature !== currentState.coolingReleaseTemperature
      || previousState.coolingReleaseActive !== currentState.coolingReleaseActive
      || previousState.operationMode !== currentState.operationMode
      || previousState.outdoorTemperature !== currentState.outdoorTemperature;
  }

  logCoolingChanges(previousState, currentState) {
    if (!this.hasCoolingDiagnosticChanges(previousState, currentState)) {
      return;
    }

    this.log('==================================================');
    this.log('COOLING EVENT');
    this.log('==================================================');

    if (previousState.coolingMode !== currentState.coolingMode) {
      this.log('');
      this.log('Cooling mode changed');
      this.log(`Old : ${this.formatDecodedEnum(previousState.coolingMode, this.decodeCoolingMode(previousState.coolingMode))}`);
      this.log(`New : ${this.formatDecodedEnum(currentState.coolingMode, this.decodeCoolingMode(currentState.coolingMode))}`);
    }

    if (previousState.coolingReleaseTemperature !== currentState.coolingReleaseTemperature) {
      this.log('');
      this.log('Cooling release temperature changed');
      this.log(`Old : ${this.formatRawCelsius(previousState.coolingReleaseTemperature)}`);
      this.log(`New : ${this.formatRawCelsius(currentState.coolingReleaseTemperature)}`);
    }

    if (previousState.coolingReleaseActive !== currentState.coolingReleaseActive) {
      this.log('');
      if (currentState.coolingReleaseActive === 1) {
        this.log('Cooling release became ACTIVE');
        this.log(`Outdoor temperature : ${this.formatRawCelsius(currentState.outdoorTemperature)}`);
        this.log(`Release temperature : ${this.formatRawCelsius(currentState.coolingReleaseTemperature)}`);
      } else if (currentState.coolingReleaseActive === 0) {
        this.log('Cooling release became INACTIVE');
        this.log(`Outdoor temperature : ${this.formatRawCelsius(currentState.outdoorTemperature)}`);
        this.log(`Release temperature : ${this.formatRawCelsius(currentState.coolingReleaseTemperature)}`);
      } else {
        this.log('Cooling release active changed');
        this.log(`Old : ${this.formatBooleanValue(previousState.coolingReleaseActive)}`);
        this.log(`New : ${this.formatBooleanValue(currentState.coolingReleaseActive)}`);
      }
    }

    if (previousState.operationMode !== currentState.operationMode) {
      this.log('');
      this.log('Operation mode changed');
      this.log(`Previous : ${this.formatDecodedEnum(previousState.operationMode, this.decodeOperationMode(previousState.operationMode))}`);
      this.log(`Current  : ${this.formatDecodedEnum(currentState.operationMode, this.decodeOperationMode(currentState.operationMode))}`);
    }

    if (previousState.outdoorTemperature !== currentState.outdoorTemperature) {
      this.log('');
      this.log('Outdoor temperature changed');
      this.log(`Old : ${this.formatRawCelsius(previousState.outdoorTemperature)}`);
      this.log(`New : ${this.formatRawCelsius(currentState.outdoorTemperature)}`);
    }

    this.log('');
    this.log(`Timestamp : ${new Date().toISOString()}`);
    this.log('==================================================');
  }

  logCoolingStatus() {
    const currentState = this.getCoolingDiagnosticState();

    if (this.previousCoolingDiagnosticState !== null) {
      this.logCoolingChanges(this.previousCoolingDiagnosticState, currentState);
    }

    this.previousCoolingDiagnosticState = currentState;
  }

  scanDevice(host, port, timeout) {
    // This is just here if a client already existed
    this.destroyClient();

    const sendCommands = async (command) => {
      return new Promise((resolve, reject) => {

        this.client = new net.Socket();
        let receivedData = Buffer.alloc(0);

        // This cancels the check if for some reason the check takes too long.
        this.cancelCheck = this.homey.setTimeout(() => {
          this.destroyClient();
          this.log("TIMEOUT");
        }, timeout);

        // This handles error if there are any, it is important to reject the promise here if needed.
        this.client.on('error', (err) => {
          this.destroyClient();
          if (err && (err.errno === "ECONNREFUSED" || err.code === "ECONNREFUSED")) {
            this.log("Error on Socket")
            reject(err);
          } else {
            this.log("No Error on Socket")
            reject(err);
          }
        });

        this.client.on('data', (data) => {
          receivedData = Buffer.concat([receivedData, data]);
          if (receivedData.length >= 12) {
            const reqCalculatedCmd = receivedData.readInt32BE(0);
            if (reqCalculatedCmd == 3003) {
              const array_parameter = [];
              const len = receivedData.readInt32BE(4);
              let expectedLength = 8 + len * 4;
              if (receivedData.length >= expectedLength) {
                let offset = 8;
                for (let i = 0; i < len; i++) {
                  array_parameter.push(receivedData.readInt32BE(offset));
                  offset += 4;
                }
                // for (const [i, value] of array_parameter.entries()) {
                //   this.log(i, value);
                // }
                const energyInputs = readEnergyInputs(array_parameter);
                if (energyInputs === null) {
                  this.energyInputHeat = null;
                  this.energyInputCool = null;
                  this.energyInputWater = null;
                  this.energyInputPool = null;
                  this.energyInputTotal = null;
                  this.log('Energy input parameters 1136-1140 are unavailable on this firmware');
                } else {
                  this.energyInputHeat = energyInputs.heat;
                  this.energyInputCool = energyInputs.cool;
                  this.energyInputWater = energyInputs.water;
                  this.energyInputPool = energyInputs.pool;
                  this.energyInputTotal = energyInputs.total;
                  this.log('Luxtronik energy input values', energyInputs);
                }

                this.parametersArray = array_parameter;

                this.destroyClient();
                resolve(); // Resolve the promise once response is handled
              }
            } else if (reqCalculatedCmd == 3004) {

              const array_calculated = [];
              const stat = receivedData.readInt32BE(4);
              const len = receivedData.readInt32BE(8);
              let expectedLength = 12 + len * 4;
              if (receivedData.length >= expectedLength) {
                let offset = 12;
                for (let i = 0; i < len; i++) {
                  array_calculated.push(receivedData.readInt32BE(offset));
                  offset += 4;
                }
                this.log("Received calculated data with Length ", len)

                this.energyHeat = (array_calculated[151]);
                this.energyWater = (array_calculated[152]);
                this.energyPool = (array_calculated[153]);
                this.energyTotal = (array_calculated[154]);


                this.energyCurrent = readCurrentPower(array_calculated);

                this.temperatureOutdoor = (array_calculated[15]);
                this.temperatureHotGas = (array_calculated[14]);
                this.temperatureRoomCurrent = (array_calculated[227]);
                this.temperatureRoomTarget = (array_calculated[228]);
                this.temperatureWaterCurrent = (array_calculated[17]);
                this.temperatureWaterTarget = (array_calculated[18]);
                this.temperatureSourceIn = (array_calculated[19]);
                this.temperatureSourceOut = (array_calculated[20]);
                this.temperatureHeatingSupply = (array_calculated[10]);
                this.temperatureHeatingFeedback = (array_calculated[11]);
                this.temperatureHeatingFeedbackCalc = (array_calculated[12]);
                this.temperatureHeatingFeedbackExt = (array_calculated[13]);


                this.water = (array_calculated[173]);

                this.calulationsArray = array_calculated;

                this.operationMode.setOperationMode(array_calculated[80]);

                this.destroyClient();

                resolve(); // Resolve the promise once response is handled
              }
            } else {
              this.log('Error: Received unknown command');

              reject(); // Resolve the promise once response is handled
            }
          }
        });

        this.sendCommand(command, host, port);

      });
    };

    const executeCommands = async () => {
      try {
        await sendCommands(3003);
        await sendCommands(3004);
        this.logCoolingStatus();
      } catch (error) {
        this.log("This happens almost never.")
      }
    };

    // Start executing commands sequentially
    executeCommands();


  }
}

module.exports = LuxtronikDevice;
