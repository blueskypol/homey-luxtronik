# Cooling Research

## Objective

Understand how Luxtronik cooling works so Homey can safely optimise cooling on
hot sunny days.

Target installation context:

- Alpha Innotec heat pump.
- Luxtronik controller.
- Ground source / brine.
- Passive or active floor cooling.
- Heavy concrete floor.
- PV installation.

Preferred strategy: intelligent pre-cooling with PV surplus. Homey should
choose when to request cooling; Luxtronik must remain responsible for safety,
release conditions and protecting the installation.

No controller writes or Flow cards are part of this research step.

## Sources Searched

Complete local reference project: `research/python-luxtronik`.

Search terms included: `cooling`, `Kuehl`, `Kühl`, `Freigabe`, `Soll`,
`Sollwert`, `MC`, `Mischkreis`, `Vorlauf`, `Ruecklauf`, `Offset`,
`Kennlinie`, `CoolingMode`, `cooling curve`, `release`, `target`.

Primary files used:

- `luxtronik/definitions/parameters.py`
- `luxtronik/definitions/inputs.py`
- `luxtronik/definitions/calculations.py`
- `luxtronik/definitions/holdings.py`
- `luxtronik/datatypes.py`
- `tests/test_compatibility.py`
- generated docs under `research/python-luxtronik/docs/`

## Verified Facts

- CFI parameter write command is `3002`; this research does not change it.
- CFI parameter `108`, `ID_Einst_BA_Kuehl_akt`, is writable and uses
  `CoolingMode`.
- `CoolingMode` has exactly two values: `0 = Off`, `1 = Automatic`.
- CFI parameter `110`, `ID_Einst_KuehlFreig_akt`, is writable, Celsius,
  `°C/10`.
- CFI parameters `132`, `133`, `134`, `135`, `966`, and `967` are writable
  Celsius values with cooling-like names, but python-luxtronik contains no
  descriptions that explain their behaviour.
- Several target-like CFI parameters are explicitly not writable or unknown.
- SHI holdings define writable mixing-circuit cooling setpoints and offsets,
  but those are Smart Home Interface holdings, not current CFI parameter writes.

## CFI Parameter Candidates

| Luxtronik name | Index | Writable | Data type | Unit | Possible values | Confidence | Expected behaviour |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| `ID_Einst_BA_Kuehl_akt` | 108 | yes | `CoolingMode` | enum | `0 = Off`, `1 = Automatic` | High | Cooling operating mode. Likely enables/disables controller-managed cooling. |
| `ID_Sollwert_Kuehl1_akt` | 109 | no | `Unknown` | none | Not defined | High | Looks like a cooling setpoint by name, but is not writable or typed. Do not use. |
| `ID_Einst_KuehlFreig_akt` | 110 | yes | `Celsius` | `°C/10` | Numeric Celsius | High | Cooling release temperature. Likely threshold for allowing cooling, not a room/floor target. |
| `ID_Sollwert_KuCft1_akt` | 132 | yes | `Celsius` | `°C/10` | Numeric Celsius | Medium | Cooling-related setpoint candidate. Behaviour not described; do not expose before live testing. |
| `ID_Sollwert_KuCft2_akt` | 133 | yes | `Celsius` | `°C/10` | Numeric Celsius | Medium | Cooling-related setpoint candidate. Behaviour not described; do not expose before live testing. |
| `ID_Sollwert_AtDif1_akt` | 134 | yes | `Celsius` | `°C/10` | Numeric Celsius | Medium | Cooling-related outside-temperature-difference candidate by name. Behaviour not described. |
| `ID_Sollwert_AtDif2_akt` | 135 | yes | `Celsius` | `°C/10` | Numeric Celsius | Medium | Cooling-related outside-temperature-difference candidate by name. Behaviour not described. |
| `ID_Einst_Kuhl_Zeit_Ein_akt` | 850 | yes | `Hours` | `h/10` | Numeric hours | Medium | Cooling timing parameter by name. Exact role unknown. |
| `ID_Einst_Kuhl_Zeit_Aus_akt` | 851 | yes | `Hours` | `h/10` | Numeric hours | Medium | Cooling timing parameter by name. Exact role unknown. |
| `ID_Einst_Akt_Kuehlung_akt` | 884 | no | `Unknown` | none | Not defined | High | Active cooling setting by name, but not writable/typed. Do not use. |
| `ID_Einst_Akt_Kuehl_Speicher_min_akt` | 887 | no | `Unknown` | none | Not defined | High | Cooling storage/minimum setting by name, but not writable/typed. Do not use. |
| `ID_Einst_Akt_Kuehl_Freig_WQE_akt` | 888 | no | `Unknown` | none | Not defined | High | Source-side cooling release candidate by name, but not writable/typed. Do not use. |
| `ID_Sollwert_KuCft3_akt` | 966 | yes | `Celsius` | `°C/10` | Numeric Celsius | Medium | Third cooling-related setpoint candidate. Behaviour not described. |
| `ID_Sollwert_AtDif3_akt` | 967 | yes | `Celsius` | `°C/10` | Numeric Celsius | Medium | Third outside-temperature-difference candidate by name. Behaviour not described. |
| `ID_Einst_Sollwert_TRL_Kuehlen` | 974 | no | `Unknown` | none | Not defined | High | Looks like return-line cooling target, but is not writable/typed. Do not use. |
| `ID_Einst_PKuehlTime_akt` | 978 | no | `Unknown` | none | Not defined | High | Cooling time parameter by name, but not writable/typed. Do not use. |
| `ID_Einst_Minimale_Ruecklaufsolltemperatur` | 979 | yes | `Celsius` | `°C/10` | Numeric Celsius | Medium | Minimum return-line target temperature. May constrain cooling comfort/safety. Not proven cooling-only. |
| `ID_RBE_Freigabe_Kuehlung_akt` | 981 | no | `Unknown` | none | Not defined | High | Room control cooling release candidate, not writable/typed. Do not use. |
| `ID_Einst_Freigabe_Zeit_ZWE` | 992 | yes | `Minutes` | `min` | Numeric minutes | Low | Release time for auxiliary heat source by name; not cooling-specific despite search term. |
| `ID_Einst_min_VL_Kuehl` | 993 | no | `Unknown` | none | Not defined | High | Looks like minimum cooling flow temperature, but is not writable/typed. Do not use. |
| `ID_Einst_Kuhl_Zeit_Ein_RT` | 1021 | no | `Unknown` | none | Not defined | High | Cooling time/room-thermostat candidate by name, not writable/typed. |
| `ID_Einst_P155_PumpCool_RPM` | 1038 | no | `Unknown` | none | Not defined | Medium | Cooling pump RPM candidate by name, not writable/typed. |
| `ID_Einst_Vorl_akt_Kuehl` | 1053 | no | `Unknown` | none | Not defined | High | Looks like cooling supply temperature setting, but is not writable/typed. Do not use. |
| `THERMAL_POWER_LIMIT_COOLING` | 1178 | no | `Unknown` | none | Not defined | Medium | Cooling power-limit candidate by name, not writable/typed. |

## Monitoring Fields

These are useful for diagnostics and live-test observation, not CFI write
targets.

| Source | Name | Index | Writable | Data type | Unit | Confidence | Expected behaviour |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| Input | `operation_mode` | 2 | no | enum | enum | High | `7 = Cooling` indicates cooling operating state. |
| Input | `cooling_status` | 6 | no | enum | enum | High | `0 = Off`, `1 = No demand`, `2 = Demand`, `3 = Active`. |
| Input | `mc1_target` | 141 | no | `CelsiusInt16` | `°C/10` | High | Desired target temperature of mixing circuit 1. Read-only monitor. |
| Input | `mc2_target` | 151 | no | `CelsiusInt16` | `°C/10` | High | Desired target temperature of mixing circuit 2. Read-only monitor. |
| Input | `mc3_target` | 161 | no | `CelsiusInt16` | `°C/10` | High | Desired target temperature of mixing circuit 3. Read-only monitor. |
| Input | `cooling_configured` | 205 | no | `OnOffMode` | bool | High | Whether cooling is configured: `0 = no`, `1 = yes`. |
| Input | `cooling_release` | 207 | no | `OnOffMode` | bool | High | Whether cooling release condition is fulfilled; only valid if cooling is enabled. |
| Calculation | `ID_WEB_FreigabKuehl` | 146 | no | `Bool` | bool | High | Controller-calculated cooling release flag. |
| Input | `electric_energy_cooling` | 316 | no | `Energy` | `kWh/10` | High | Cooling electrical energy counter. |
| Input | `thermal_energy_cooling` | 326 | no | `Energy` | `kWh/10` | High | Cooling thermal energy counter. |

## Smart Home Interface Holdings

These are not CFI parameters. They are SHI holdings, requiring the Smart Home
Interface / Modbus-style path. They are still important because they document a
clear controller-supported model for mixing-circuit cooling setpoints and
offsets.

| Luxtronik/SHI name | Holding index | Writable | Data type | Unit | Possible values | Confidence | Expected behaviour |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| `mc1_cool_mode` | 15 | yes | `ControlMode` | enum | `0 Off`, `1 Setpoint`, `2 Offset`, `3 Level` | High | Selects how SHI influences MC1 cooling. |
| `mc1_cool_setpoint` | 16 | yes | `CelsiusUInt16` | `°C/10` | Raw `50-250` = `5.0-25.0 °C` | High | Overrides current MC1 cooling flow target when `mc1_cool_mode = Setpoint`. Limited by controller settings. |
| `mc1_cool_offset` | 17 | yes | `KelvinInt16` | `K/10` | Raw `-50..50` = `-5.0..5.0 K` | High | Offsets current MC1 cooling flow target when `mc1_cool_mode = Offset`. |
| `mc2_cool_mode` | 25 | yes | `ControlMode` | enum | `0 Off`, `1 Setpoint`, `2 Offset`, `3 Level` | High | Same as MC1 for circuit 2. |
| `mc2_cool_setpoint` | 26 | yes | `CelsiusUInt16` | `°C/10` | Raw `50-250` = `5.0-25.0 °C` | High | Overrides current MC2 cooling flow target when enabled. |
| `mc2_cool_offset` | 27 | yes | `KelvinInt16` | `K/10` | Raw `-50..50` = `-5.0..5.0 K` | High | Offsets current MC2 cooling flow target. |
| `mc3_cool_mode` | 35 | yes | `ControlMode` | enum | `0 Off`, `1 Setpoint`, `2 Offset`, `3 Level` | High | Same as MC1 for circuit 3. |
| `mc3_cool_setpoint` | 36 | yes | `CelsiusUInt16` | `°C/10` | Raw `50-250` = `5.0-25.0 °C` | High | Overrides current MC3 cooling flow target when enabled. |
| `mc3_cool_offset` | 37 | yes | `KelvinInt16` | `K/10` | Raw `-50..50` = `-5.0..5.0 K` | High | Offsets current MC3 cooling flow target. |
| `lock_cooling` | 52 | yes | `LockMode` | enum | `0 Off`, `1 On` | High | Cooling operation lock. Docs warn frequent switching may cause wear. |

## Cooling Strategy In Luxtronik

### What Is Cooling Mode?

`ID_Einst_BA_Kuehl_akt` is the CFI cooling operating mode. It is writable and
uses `CoolingMode` with only `Off` and `Automatic`.

Interpretation: Homey can probably request "controller-managed cooling allowed"
by setting `Automatic`, or disable cooling by setting `Off`. This does not mean
forcing compressor/pump operation; Luxtronik still evaluates release conditions,
demands and installation protections.

### What Is Cooling Release Temperature?

`ID_Einst_KuehlFreig_akt` is writable Celsius, `°C/10`. The name and the
monitoring fields `cooling_release` / `ID_WEB_FreigabKuehl` strongly indicate
that this is a release threshold: it affects whether cooling is permitted.

It is not verified as a comfort target, room target or flow target.

### Does A Real Cooling Target Exist?

For the current CFI parameter path, no verified writable real cooling target was
found.

Several names look target-like, especially `ID_Sollwert_Kuehl1_akt`,
`ID_Einst_Sollwert_TRL_Kuehlen`, `ID_Einst_min_VL_Kuehl`, and
`ID_Einst_Vorl_akt_Kuehl`, but python-luxtronik marks these as `Unknown` and
not writable.

The SHI holdings do contain real MC cooling setpoints (`mc*_cool_setpoint`),
but those are not CFI parameters and require separate SHI support.

### Does A Cooling Curve Exist?

No explicit cooling curve parameter was verified from python-luxtronik.

The CFI parameters `ID_Sollwert_KuCft1/2/3_akt` and
`ID_Sollwert_AtDif1/2/3_akt` are writable Celsius values and may be related to
cooling curve or outdoor-temperature-difference behaviour, but this is not
described in python-luxtronik. Treat any curve interpretation as an assumption
until tested on a real controller.

### Does A Cooling Offset Exist?

No CFI cooling offset was verified.

SHI holdings do define explicit cooling offsets for MC1/2/3:
`mc1_cool_offset`, `mc2_cool_offset`, `mc3_cool_offset`. They apply only when
the matching `mc*_cool_mode = Offset`.

### Does MC1 Have Its Own Cooling Target?

Yes, but only verified in SHI:

- `mc1_cool_setpoint` is writable.
- It overrides the current flow temperature for MC1 cooling.
- It requires `mc1_cool_mode = Setpoint`.
- It may be limited by heat pump controller settings.

For the current CFI path, MC1 target is read-only via input `mc1_target`, and no
CFI writable MC1 cooling target was verified.

### Which Parameters Affect Comfort The Most?

Highest-confidence comfort levers:

1. `ID_Einst_BA_Kuehl_akt` (`108`): enables/disables controller-managed cooling.
2. `ID_Einst_KuehlFreig_akt` (`110`): likely changes when cooling is released.
3. SHI `mc*_cool_setpoint` / `mc*_cool_offset`: direct MC flow-target influence,
   but not available through the current CFI write path.

Medium-confidence comfort candidates:

- `ID_Einst_Minimale_Ruecklaufsolltemperatur` (`979`): may constrain cooling by
  return temperature, but it is not proven cooling-only.
- `ID_Sollwert_KuCft*` and `ID_Sollwert_AtDif*`: possible cooling curve /
  outdoor-difference parameters, but behaviour is undocumented.

Low-confidence or unsafe for writes:

- Unknown/non-writable target-like parameters such as `109`, `974`, `993`,
  `1053`.
- Pump RPM and power-limit fields; these are not typed/writable and may be
  installation-protection related.

## Recommended Safe Live Test Order

No live test should write a new parameter until packet format, allowed values,
read-back verification and restore strategy are prepared.

1. Read-only baseline.
   - Record `cooling_configured`, `cooling_release`, `cooling_status`,
     `operation_mode`, `mc*_target`, current `108`, current `110`, outdoor
     temperature and current room/floor behaviour.

2. No-op write for `108`.
   - Read current `ID_Einst_BA_Kuehl_akt`.
   - Write the same raw value.
   - Read back `108`.
   - Confirm no mode change.

3. Controlled write for `108`.
   - If current state is safe, test `Off -> Automatic` or `Automatic -> Off`.
   - Immediately read back and monitor `cooling_status` / `cooling_release`.
   - Restore original mode manually via a second verified write.

4. No-op write for `110`.
   - Read current cooling release temperature.
   - Write the same raw value.
   - Read back `110`.

5. Small reversible `110` test.
   - Change release temperature by a small amount.
   - Observe `cooling_release`, `ID_WEB_FreigabKuehl`, and comfort impact.
   - Restore original value.

6. Investigate, but do not automate, `132-135`, `966-967`, and `979`.
   - Start with read-only observation during cooling.
   - Only no-op write after their meaning is better understood.

7. SHI research.
   - Only after deciding to support SHI/holdings separately.
   - Test MC cooling setpoint/offset in no-op form first.

Do not test `lock_cooling` as an optimisation primitive. It is a lockout and
the upstream docs warn that frequent switching may cause wear.

## Strong Evidence

- Cooling enable/disable through `108` is strongly supported by name,
  writability and `CoolingMode` options.
- Cooling release through `110` is strongly supported by name, Celsius type and
  the existence of read-only release indicators.
- MC cooling setpoints and offsets are strongly supported in SHI holdings, but
  not through CFI parameters.
- A direct CFI cooling comfort target is not verified; the most obvious names
  are not writable or not typed.

## Assumptions

- `ID_Einst_KuehlFreig_akt` likely controls the outdoor or controller condition
  under which cooling is released, but python-luxtronik does not describe the
  exact threshold semantics.
- `ID_Sollwert_KuCft*` and `ID_Sollwert_AtDif*` may relate to cooling curve or
  outdoor-difference logic, but python-luxtronik does not verify that meaning.
- On a heavy concrete floor, lowering/releasing cooling earlier may pre-cool
  the building effectively, but the safe limits and comfort response must be
  learned from real-controller observation.

## Current Recommendation

For the current Homey CFI integration, the safest future Flow-card candidates
are:

1. Enable cooling by setting `ID_Einst_BA_Kuehl_akt = Automatic`.
2. Disable cooling by setting `ID_Einst_BA_Kuehl_akt = Off`.
3. Possibly adjust cooling release temperature `ID_Einst_KuehlFreig_akt`, only
   after live no-op and small reversible tests.

Do not expose cooling target, cooling curve, cooling offset or MC controls as
Flow cards until their exact behaviour is verified. For MC setpoint/offset, the
evidence points to SHI holdings rather than the current CFI parameter path.
