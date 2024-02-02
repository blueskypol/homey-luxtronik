'use strict';

const { Device } = require('homey');
const net = require("net");
const LuxtronikOperationMode = require("../../includes/luxtronik_operationmode");



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
      if (this.parametersArray !== null) await this.setCapabilityValue('meter_power.heat2', this.parametersArray[1059] / 10).catch(this.error);

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

      if (this.energyCurrent !== null) await this.setCapabilityValue('measure_power.current', this.energyCurrent).catch(this.error);

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
                this.log("PARAM HEAT_ENERGY_INPUT" + array_parameter[1136]);
                this.log("PARAM WATER_ENERGY_INPUT" + array_parameter[1137]);
                this.log("PARAM POOL_ENERGY_INPUT" + array_parameter[1138]);
                this.log("PARAM COOL_ENERGY_INPUT" + array_parameter[1139]);
                this.log("PARAM SECOND_ENERGY_INPUT" + array_parameter[1140]);
                let energyInputTotal = array_parameter[1136] + array_parameter[1137] + array_parameter[1138] + array_parameter[1139] + array_parameter[1140]
                this.log("PARAM TOTAL_ENERGY_INPUT" + energyInputTotal);

                this.energyInputHeat = (array_parameter[1136]);
                this.energyInputCool = (array_parameter[1139]);
                this.energyInputWater = (array_parameter[1137]);
                this.energyInputPool = (array_parameter[1138]);
                this.energyInputTotal = (array_parameter[1136] + array_parameter[1137] + array_parameter[1138] + array_parameter[1139] + array_parameter[1140]);

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


                this.energyCurrent = (array_calculated[257]);

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
      } catch (error) {
        this.log("This happens almost never.")
      }
    };

    // Start executing commands sequentially
    executeCommands();


  }
}

module.exports = LuxtronikDevice;
