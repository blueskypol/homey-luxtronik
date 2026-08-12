'use strict';

const Homey = require('homey');

class MyApp extends Homey.App {

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('MyApp has been initialized');

    this.homey.flow
      .getActionCard('set_dhw_target_temperature')
      .registerRunListener(async (args) => {
        return args.device.setDhwTargetTemperature(args.temperature);
      });

    this.homey.flow
      .getActionCard('set_cooling_release_temperature')
      .registerRunListener(async (args) => {
        return args.device.setCoolingReleaseTemperature(args.temperature);
      });

    this.homey.flow
      .getActionCard('restore_cooling_release_temperature')
      .registerRunListener(async (args) => {
        return args.device.restoreCoolingReleaseTemperature();
      });
  }

}

module.exports = MyApp;
