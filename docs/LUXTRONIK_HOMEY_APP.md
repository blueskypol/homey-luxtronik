# Luxtronik Homey App

## Purpose

This document describes the current capabilities of the Homey Luxtronik app.

It is intended as developer documentation and should always reflect the
current implementation.

---

# Supported Hardware

Current verified installation:

- Alpha Innotec ground source heat pump
- Luxtronik controller
- Homey Pro (Early 2023)

Communication:

- TCP
- Port 8889
- Luxtronik CFI protocol

---

# Current Features

## Read

The app periodically polls the Luxtronik controller.

Current polling interval:

- 36 seconds

Communication:

- Command 3003 (parameters)
- Command 3004 (calculated values)

---

## Write

Currently verified write support:

| Parameter | Index | Description | Status |
|-----------|------:|-------------|--------|
| ID_Soll_BWS_akt | 105 | DHW target temperature | ✅ Implemented |
| ID_Einst_KuehlFreig_akt | 110 | Cooling release temperature | ✅ Implemented |
| ID_Einst_WK_akt | 1 | Heating curve correction | ⏳ Device write/restore methods implemented; no Flow card yet (not yet live-validated, see docs/HEATING_RESEARCH.md) |

Current write safety:

- allowlist
- read-after-write verification
- timeout handling
- response validation

---

# Homey Capabilities

## Temperatures

- Outdoor temperature
- Supply temperature
- Return temperature
- Hot water temperature
- Source temperature
- Heating temperature

## Energy

- Power consumption
- Thermal energy
- Electrical energy
- Cooling energy
- Heating energy

## Heating

- COP
- Flow
- Compressor status
- Operation mode

## Other

- Luxtronik operation mode

---

# Flow Cards

## Action Cards

### Set DHW target temperature

Purpose:

Temporarily or permanently change the DHW target temperature.

Range:

45–60 °C

Implementation:

- converts °C → Luxtronik raw value
- writes parameter 105
- waits
- reads parameter 105 back
- verifies successful write

---

### Set/Restore cooling release temperature

Purpose:

Temporarily adjust (and later restore) the outdoor-average-temperature
threshold that releases controller-managed cooling.

Range:

10–35 °C

---

---

## Trigger Cards

### Operation mode changed

Triggers when the Luxtronik operation mode changes.

---

# Internal Safety

Current safeguards:

- Only verified writable parameters may be written.
- Every write uses protocol validation.
- Every write is read back and verified.
- Invalid responses are rejected.
- Timeouts abort writes.
- Unknown parameters cannot be written.

---

# Cooling Support

Current status:

Research phase.

Implemented:

- Cooling diagnostics
- Change-based logging
- Event logging

Not yet implemented:

- Cooling Flow cards
- Cooling parameter writes
- Cooling optimisation

Research document:

docs/COOLING_RESEARCH.md

---

# Heating Support

Current status:

Research complete, device write/restore support implemented, Flow card
intentionally not yet added.

Implemented (developer-only, not exposed as a Flow card yet):

- `LuxtronikDevice#setHeatingCurveCorrection(value)` — writes parameter 1
  (`ID_Einst_WK_akt`, °C/10, range −5…+5 °C), saves the original value once.
- `LuxtronikDevice#restoreHeatingCurveCorrection()` — restores the saved
  original and clears it.
- `LuxtronikDevice#testWriteHeatingCurveCorrectionNoop()` — the required
  first live-test step (read current value, write it back unchanged, verify
  read-back) before any real change.

Not yet implemented:

- Heating curve correction Flow cards (deliberately deferred — see
  docs/LIVE_VALIDATION_PARAMETER_110.md for why this project adds a Flow
  card only after live validation on a real controller, not before)
- Circuit-specific endpoint/level/night-setback parameters (11/12/13)
- Heating optimisation / PV-aware Advanced Flow logic (lives in the
  `homey-climate-toolkit` project, not in this app)

Research document:

docs/HEATING_RESEARCH.md

---

# Diagnostics

Current diagnostics:

## DHW

- write request
- protocol response
- read-back verification

## Cooling

Event based.

Events include:

- Cooling mode changed
- Cooling release changed
- Operation mode changed
- Outdoor temperature changes

Multiple changes are grouped into one event.

---

# Future Roadmap

Phase 2

✅ DHW target temperature

Phase 3

Cooling research

Future candidates:

- Cooling enable/disable
- Cooling release temperature
- Cooling optimisation using PV surplus
- Intelligent pre-cooling
- Additional diagnostics

---

# Design Principles

The Homey app should:

- remain protocol-focused
- expose verified Luxtronik functionality
- never guess writable parameters
- validate every write
- keep Homey Flow responsible for automation logic

Complex behaviour (PV, weather forecasts, ComfoConnect integration,
pre-cooling logic, timers, etc.) belongs in Homey Flows rather than inside
the app.