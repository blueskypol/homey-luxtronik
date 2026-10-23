# Project Goal

## Overall Goal

Build a safe and reliable Homey integration for Luxtronik heat pumps.

The app should expose simple Homey Flow cards that let users optimise comfort,
energy consumption and solar self-consumption without requiring knowledge of
Luxtronik parameters.

The project should evolve in small verified steps. Existing read functionality
must never break, and write support must only be added for verified parameters.

## Current Priority

The current development focus is cooling research.

The objective is to understand how Luxtronik cooling can safely be influenced
from Homey.

The preferred optimisation strategy is intelligent pre-cooling for buildings
with high thermal mass using excess photovoltaic production.

Research comes before implementation.

No cooling Flow cards will be added until every cooling-related parameter has
been verified on a real controller.

## Safety First

The app should never try to outsmart or bypass the Luxtronik controller.

Homey provides automation, timing and scheduling. Luxtronik remains responsible
for protecting the heat pump, DHW tank and wider heating installation.

Default behaviour should always be conservative and safe. The app must not
disable, replace or work around controller safety features. Legionella
protection remains the responsibility of the Luxtronik controller and must never
be disabled or replaced by Homey automation.

## Homey Owns The Automation

The app should expose building blocks, not business logic.

Homey Flows, Advanced Flows and HomeyScript should contain the automation logic.
The app itself should not implement timers, schedules, solar logic, weather
logic or optimisation algorithms.

Examples of suitable Flow cards:

- Temporarily raise DHW target temperature.
- Restore DHW target temperature.
- Enable cooling.
- Disable cooling.
- Future: change heating target.

## Safe Defaults

Version 1 should use conservative limits.

DHW target temperature should initially be limited to `45-60 °C`. These limits
are chosen to avoid unsafe configurations while still allowing useful energy
automation.

The app should not allow arbitrary temperatures.

## Future Device Awareness

A future version may detect controller capabilities and supported value ranges.

Possible improvements:

- Detect available controller capabilities.
- Detect supported minimum and maximum temperatures.
- Adapt Flow card validation automatically.

This should only be implemented after the limits are verified from the
controller. Until then, conservative hard-coded limits are preferred.

## Current Architecture

This is a Homey SDK v3 app with three layers:

1. Luxtronik TCP protocol.
2. Homey device abstraction.
3. Homey Flow cards.

Important files:

- `app.js`: Homey app bootstrap and Flow card registration.
- `app.json`: generated Homey app manifest.
- `.homeycompose/`: Homey Compose app metadata.
- `drivers/luxtronik-2/device.js`: active device runtime, polling and safe
  write helpers.
- `drivers/luxtronik-2/driver.flow.compose.json`: driver-scoped Flow cards.
- `research/python-luxtronik/`: reference implementation used to verify
  protocol details.

## Verified Starting Point

Verified from `python-luxtronik`:

- Config interface port: `8889`.
- Read parameters command: `3003`.
- Read calculations command: `3004`.
- Write parameters command: `3002`.
- Parameter `105` is `ID_Soll_BWS_akt`.
- `ID_Soll_BWS_akt` is the DHW target temperature.
- Unit is `C/10`; for example `50.0 °C` is raw value `500`.
- Python marks parameter `105` writeable.

Not verified yet:

- Dedicated DHW boost command or flag.
- Controller-reported DHW target min/max range.
- Cooling enable behaviour on this real controller.
- Writeable cooling target parameter.
