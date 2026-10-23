'use strict';

const ENERGY_INPUT_PARAMETER_INDICES = Object.freeze([1136, 1137, 1138, 1139, 1140]);
const CURRENT_POWER_CALCULATION_INDEX = 257;

function finiteValueOrNull(values, index) {
  const value = values[index];
  return Number.isFinite(value) ? value : null;
}

function readEnergyInputs(parameters) {
  const values = ENERGY_INPUT_PARAMETER_INDICES.map((index) => finiteValueOrNull(parameters, index));
  if (values.some((value) => value === null)) {
    return null;
  }

  const [heat, water, pool, cool, second] = values;
  return {
    heat,
    water,
    pool,
    cool,
    second,
    total: values.reduce((sum, value) => sum + value, 0),
  };
}

function readCurrentPower(calculations) {
  return finiteValueOrNull(calculations, CURRENT_POWER_CALCULATION_INDEX);
}

module.exports = {
  CURRENT_POWER_CALCULATION_INDEX,
  ENERGY_INPUT_PARAMETER_INDICES,
  finiteValueOrNull,
  readCurrentPower,
  readEnergyInputs,
};
