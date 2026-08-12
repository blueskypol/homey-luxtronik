'use strict';

const VERIFIED_LUXTRONIK_PARAMETERS = Object.freeze({
  DHW_TARGET: Object.freeze({
    name: 'DHW_TARGET',
    index: 105,
    luxtronikName: 'ID_Soll_BWS_akt',
    unit: '°C/10',
    validationMinCelsius: 45,
    validationMaxCelsius: 60,
  }),
  COOLING_RELEASE_TEMPERATURE: Object.freeze({
    name: 'COOLING_RELEASE_TEMPERATURE',
    index: 110,
    luxtronikName: 'ID_Einst_KuehlFreig_akt',
    unit: '°C/10',
    // Live-validated 2026-08-12: 19.0 -> 20.0 -> 19.0 °C, with exact read-back.
    // Deliberately conservative test-only guard until controller limits are known.
    validationMinCelsius: 10,
    validationMaxCelsius: 35,
  }),
});

const PARAMETERS_BY_INDEX = Object.freeze(Object.values(VERIFIED_LUXTRONIK_PARAMETERS)
  .reduce((parameters, parameter) => {
    parameters[parameter.index] = parameter;
    return parameters;
  }, {}));

function getWritableParameter(index) {
  return PARAMETERS_BY_INDEX[index] || null;
}

function validateTemperatureRawValue(parameter, rawValue) {
  if (!Number.isInteger(rawValue)) {
    throw new Error(`Refusing to write non-integer raw Luxtronik value ${rawValue}`);
  }

  const minRawValue = parameter.validationMinCelsius * 10;
  const maxRawValue = parameter.validationMaxCelsius * 10;
  if (rawValue < minRawValue || rawValue > maxRawValue) {
    throw new Error(`${parameter.name} raw value ${rawValue} is outside the test range ${minRawValue}-${maxRawValue} (${parameter.validationMinCelsius}-${parameter.validationMaxCelsius} °C).`);
  }

  return rawValue;
}

module.exports = {
  VERIFIED_LUXTRONIK_PARAMETERS,
  getWritableParameter,
  validateTemperatureRawValue,
};
