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

    // Heating curve correction (parameter 1, ID_Einst_WK_akt) write support
    // exists on LuxtronikDevice (setHeatingCurveCorrection/
    // restoreHeatingCurveCorrection/testWriteHeatingCurveCorrectionNoop), but
    // is intentionally NOT yet exposed as a Flow action here. Per this
    // project's own established process (see
    // docs/LIVE_VALIDATION_PARAMETER_110.md), a new writable parameter gets
    // a Flow card only AFTER live no-op + small reversible validation on a
    // real controller — see docs/HEATING_RESEARCH.md "Recommended Safe Live
    // Test Order". Add the two action-card registrations here once that
    // validation has been recorded.
  }

}

module.exports = MyApp;
