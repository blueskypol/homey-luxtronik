# Heating Research

## Objective

Understand how Luxtronik heating-curve control works so Homey can safely
preheat the underfloor heating circuit using PV surplus earlier in the day,
mirroring the pre-cooling strategy already researched in
`docs/COOLING_RESEARCH.md`.

Target installation context:

- Alpha Innotec heat pump (SWC 102K3).
- Luxtronik controller.
- Ground source / brine.
- Underfloor heating on the **direct (unmixed) heating circuit** — verified
  live (see "Verified Facts"), not on Mixing Circuit 1.
- Heavy concrete floor (high thermal mass, slow response).
- PV installation (36 panels, Fronius Symo 8.2-3-M).

Preferred strategy: intelligent preheat with PV surplus. Homey should choose
when to request extra heating; Luxtronik must remain responsible for safety
and comfort limits.

No controller writes are part of this research step.

## Sources Searched

Complete local reference project: `research/python-luxtronik`.

Search terms included: `heating`, `Heizkurve`, `Heiz`, `WK`, `HKE`, `ANH`,
`ABS`, `Parallelverschiebung`, `Raumsoll`, `RBE`, `MK`, `Mischkreis`,
`Vorlauf`, `Ruecklauf`, `Offset`, `Kennlinie`, `HeatingMode`.

Primary files used:

- `luxtronik/definitions/parameters.py`
- `luxtronik/definitions/calculations.py`
- `luxtronik/definitions/holdings.py`
- `luxtronik/datatypes.py`
- generated docs under `research/python-luxtronik/docs/`

Additional, external corroboration (new compared to the cooling research,
which had no equivalent second source): the independent, actively-maintained,
MIT-licensed Homey app **"Luxtronik Heat Pump Manager"**
(`github.com/andiwirz/com.luxtronik.heatpump`), which credits Robin
Flikkema's app as its foundation and already ships a working, shipped Flow
card for the same primary candidate parameter identified below.

## Verified Facts

- CFI parameter write command is `3002`; this research does not change it.
- Live, read-only session on the real controller (2026-10-22) confirmed:
  - `ID_Einst_MK1Typ_akt` (parameter 42, read-only) = `0`.
  - `ID_WEB_Sollwert_TVL_MK1` (calculation 22, MK1 live setpoint) = `0.0 °C`.
  - `ID_WEB_Sollwert_TRL_HZ` (calculation 12, direct-circuit live setpoint) =
    `23.2 °C` (non-zero, actively computing).
  - Actual flow/return temperatures (calculations 10/11) = `31.3 / 25.8 °C`,
    consistent with an active low-temperature (underfloor) circuit.
  - **Conclusion: this installation's floor heating runs on the direct
    circuit. Mixing Circuit 1 is unconfigured/unused.**
- `ID_Einst_WK_akt` (parameter 1) is writable, `Celsius`, `°C/10`. Live value
  at time of research: `0.0 °C` (clean baseline, no correction applied).
- `ID_Einst_HzHwHKE_akt` / `ID_Einst_HzHKRANH_akt` / `ID_Einst_HzHKRABS_akt`
  (parameters 11/12/13) are writable, `Celsius`, `°C/10` — direct-circuit
  endpoint / level(parallel-shift) / night-setback. Live endpoint value:
  `32.0 °C`.
- `ID_Einst_HzMK1E_akt` / `ID_Einst_HzMK1ANH_akt` / `ID_Einst_HzMK1ABS_akt`
  (parameters 14/15/16) are writable, same types — **not relevant** for this
  installation (MK1 unused, see above). Live endpoint value: `34.0 °C`, but
  inert since MK1 has no active setpoint.
- `ID_Einst_HzMK2E_akt`/`ANH`/`ABS` (141/142/143) and
  `ID_Einst_HzMK3E_akt`/`ANH`/`ABS` (774/775/776): same types, writable,
  lower confidence (not cross-validated, not relevant to this installation).
- `HEATING_TARGET_TEMP_ROOM_THERMOSTAT` (parameter 1148, a `python-luxtronik`
  entry that supersedes a previously-unnamed `Unknown_Parameter_1148`):
  `Celsius`, `°C/10`, writable — medium confidence only, not cross-validated
  by any shipped app.
- There is a literal, configurable weekly time-switch (`Schaltuhr`) construct
  for the heating circuit (`ID_Einst_SuHkr_akt`, parameter 222, type
  `TimerProgram`: `0 = week`, `1 = 5+2`, `2 = days`) with associated
  `TimeOfDay`-typed slot parameters (`ID_Einst_SuHkrW0_zeit_*`, etc.). Live
  read: schedule mode = `week`, and all `week`-profile time slots currently
  read `0:00–0:00` (i.e. unconfigured/empty). **This means the recurring
  "mostly at night" heating/DHW pattern observed in
  `homey-climate-toolkit/docs/HEAT_PUMP_ENERGY_RESEARCH.md` is very likely
  demand/temperature-threshold-driven (heating curve + outdoor temperature,
  and for DHW a tank-temperature hysteresis), not an active clock-schedule
  block.** A global heating-curve correction should therefore create real,
  additional demand during PV-surplus hours rather than fighting an
  inflexible schedule.
- An equivalent `Schaltuhr`-family for DHW exists in the `python-luxtronik`
  definitions (`ID_Einst_SUBW_akt`, `ID_Einst_SuBwWO_zeit_*`, parameter
  indices ≥ 4113), but these indices are **beyond this controller's live
  parameter array length (1086 entries)** — this specific firmware/model does
  not expose them, so they could not be read-only verified here. Not a
  blocker for the heating-curve-correction work (parameter 1 is within
  range), but a known gap if DHW scheduling is investigated later.
- `ID_Ba_Hz_akt` (parameter 3, `HeatingMode`: Automatic/Second
  heatsource/Party/Holidays/Off) is the heating-circuit operating mode
  setting, writable — live value: `Automatic`. Not a candidate for this
  round (changing the mode is a bigger lever than a curve correction, and is
  out of scope).

## CFI Parameter Candidates

| Luxtronik name | Index | Writable | Data type | Unit | Possible values | Confidence | Expected behaviour |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| `ID_Einst_WK_akt` | 1 | yes | `Celsius` | `°C/10` | −5.0…+5.0 °C (test-guard; controller may allow more) | **High** | Global heating-curve parallel-shift correction. Independently corroborated: the shipped `com.luxtronik.heatpump` Flow card "Set heating temperature correction" writes this exact parameter, same range, documented as "shifts the heating curve up or down... does not change the heating mode." |
| `ID_Einst_HzHwHKE_akt` | 11 | yes | `Celsius` | `°C/10` | 20–70 °C | Medium-High | Direct-circuit heating-curve endpoint (design-day flow temperature reference point). Corroborated by the independent app as a device setting (not a Flow card). |
| `ID_Einst_HzHKRANH_akt` | 12 | yes | `Celsius` | `°C/10` | 5–35 °C | Medium-High | Direct-circuit heating-curve level/parallel-shift point. Same corroboration as above. |
| `ID_Einst_HzHKRABS_akt` | 13 | yes | `Celsius` | `°C/10` | not independently ranged | Medium | Direct-circuit night-setback temperature. Named but not wired into the independent app's settings UI — behaviour not independently confirmed. |
| `ID_Einst_HzMK1E_akt` / `ANH` / `ABS` | 14/15/16 | yes | `Celsius` | `°C/10` | 20–70 / 5–35 °C | High (as parameters), **not relevant** | Same triad for Mixing Circuit 1. MK1 is unconfigured on this installation (verified live, setpoint 0.0 °C) — do not use for this installation. |
| `ID_Einst_HzMK2E_akt` / `ANH` / `ABS` | 141/142/143 | yes | `Celsius` | `°C/10` | not cross-validated | Low | MK2 triad. Not relevant unless MK2 exists on this installation (not verified). |
| `ID_Einst_HzMK3E_akt` / `ANH` / `ABS` | 774/775/776 | yes | `Celsius` | `°C/10` | not cross-validated | Low | MK3 triad. Not relevant unless MK3 exists on this installation (not verified). |
| `HEATING_TARGET_TEMP_ROOM_THERMOSTAT` | 1148 | yes | `Celsius` | `°C/10` | not cross-validated | Medium | RBE room-thermostat target. Recently relabeled in `python-luxtronik` from an unknown parameter; not cross-validated by any shipped app. Do not use before independent live verification. |
| `ID_Ba_Sw_akt` | 119 | yes | `PoolMode` | enum | Automatic/Party/Holidays/Off | High / **do not use for PV** | The independent app's internal code labels this `P0119_MODE_PV`, but `Sw`/`Swb` naming elsewhere in `python-luxtronik` (`ID_Einst_SuSwbWo_zeit...`) strongly indicates `Sw` = *Schwimmbad* (swimming pool), not Photovoltaik. Treat that label as a likely misnomer. Do not use. |
| `ID_Einst_SuHkr_akt` + `zeit_*` slots | 222+ | yes (mode-selector), varies (slots) | `TimerProgram` / `TimeOfDay` | enum / time | week / 5+2 / days; slot times | High (existence), low (as a lever) | Literal weekly schedule for the heating circuit. Confirmed to exist and be readable; currently empty/unconfigured on this installation. Editing this schedule is a plausible alternative strategy but materially more complex (multi-slot time encoding, mode-dependent active group) and not pursued in this round — see "Current Recommendation". |

## Monitoring Fields

These are useful for diagnostics and live-test observation, not CFI write
targets.

| Source | Name | Index | Writable | Data type | Unit | Confidence | Expected behaviour |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| Calculation | `ID_WEB_Temperatur_TVL` | 10 | no | `Celsius` | `°C/10` | High | Actual flow temperature. |
| Calculation | `ID_WEB_Temperatur_TRL` | 11 | no | `Celsius` | `°C/10` | High | Actual return temperature. |
| Calculation | `ID_WEB_Sollwert_TRL_HZ` | 12 | no | `Celsius` | `°C/10` | High | **Live computed return-temperature setpoint for the direct/unmixed heating circuit — the field to watch after writing parameter 1/11/12.** Verified non-zero and active on this installation. |
| Calculation | `ID_WEB_Sollwert_TVL_MK1` | 22 | no | `Celsius` | `°C/10` | High | Live computed setpoint for MK1 — verified `0.0 °C` (inert) on this installation. |
| Calculation | `ID_WEB_Sollwert_TVL_MK2` | 25 | no | `Celsius` | `°C/10` | High | Same for MK2, not relevant here. |
| Calculation | `ID_WEB_Sollwert_TVL_MK3` | 136 | no | `Celsius` | `°C/10` | High | Same for MK3, not relevant here. |
| Calculation | `ID_WEB_RBE_RT_Ist` / `_Soll` | 227/228 | no | `Celsius` | `°C/10` | Medium | RBE actual/setpoint room temperature. Live read returned `0.0 °C` for `RT_Ist` — likely no RBE room-control unit reporting on this installation; do not rely on this field. |
| Calculation | `ID_WEB_WP_BZ_akt` | 80 | no | `OperationMode` | enum | High | Current heat-pump operating state (`heating`/`hot water`/`evu`/`defrost`/`no request`/`cooling`/etc.) — useful to confirm the compressor is genuinely idle/active around a test write. |
| Calculation | `ID_WEB_SH_HZ` / `ID_WEB_SH_BWW` | — | no | `Bool` | bool | High | Live "is this circuit's demand currently being serviced" flags. Despite the name resembling a schedule flag, the empty `Schaltuhr` slots (see Verified Facts) suggest these more likely reflect live demand/threshold state than a clock-based block. Re-confirm alongside any live test. |
| Calculation | `ID_WEB_Mitteltemperatur` | 16 | no | `Celsius` | `°C/10` | High | Damped/averaged outdoor temperature. Not a heating-curve monitoring field per se, but relevant context (heating curves are typically computed against this, not instantaneous outdoor temperature). |

## Smart Home Interface Holdings

These are not CFI parameters. They are SHI holdings, requiring the Smart Home
Interface / Modbus-TCP path (port 502, not port 8889). Documented here for
completeness, exactly as the cooling research deferred the equivalent
cooling holdings:

| Luxtronik/SHI name | Holding index | Writable | Data type | Unit | Possible values | Confidence | Expected behaviour |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| `heating_mode` | 0 | yes | enum | enum | `0` no influence, `1` setpoint, `2` offset, `3` level | High (documented, firmware-gated) | Selects how SHI influences the direct heating circuit. |
| `heating_setpoint` | 1 | yes | `CelsiusUInt16` | `°C/10` | 15.0–75.0 °C (default 35.0) | High | Overrides the direct-circuit return-temperature setpoint. Firmware ≥ 3.90.1. |
| `heating_offset` | 2 | yes | `KelvinInt16` | `K/10` | −20.0…+20.0 K | High | Offset on the direct-circuit return-temperature setpoint. Firmware ≥ 3.90.1. |
| `mc1_heat_setpoint` / `mc1_heat_offset` | 11/12 | yes | `CelsiusUInt16` / `KelvinInt16` | `°C/10` / `K/10` | 20.0–65.0 °C / −5.0…+5.0 K | High | Same for MK1 — not relevant to this installation. |

**Deliberately out of scope for this round**: no app (not this fork, not the
independent one) implements an SHI/Modbus client, and it is unverified
whether this controller's firmware/configuration even has SHI enabled.
Building this would require a brand-new protocol client — materially more
work than extending the existing, working CFI write infrastructure. Revisit
only if the CFI-based `ID_Einst_WK_akt` correction proves insufficient.

## Heating Strategy In Luxtronik

### What Is The Heating Curve Correction?

`ID_Einst_WK_akt` is a **global** parallel-shift correction applied on top
of whatever heating curve is otherwise configured (endpoint + level, see
below), for whichever circuit(s) are active. A positive value raises the
computed flow/return-temperature setpoint (warmer); negative lowers it
(cooler). It does not change the heating *mode* (Automatic/Off/etc.) and does
not target a specific circuit by itself — on this installation, since only
the direct circuit is active, its effect should show up directly in
`ID_WEB_Sollwert_TRL_HZ` (calculation 12).

### What Are The Endpoint/Level/Night-Setback Parameters?

`ID_Einst_HzHwHKE_akt` (endpoint), `ID_Einst_HzHKRANH_akt` (level/parallel
shift), and `ID_Einst_HzHKRABS_akt` (night setback) together define the
direct circuit's heating curve shape more granularly than the single global
correction. They are circuit-specific (there is a separate, currently-inert
MK1/MK2/MK3 triad for each mixing circuit). These are **secondary**
candidates for this round — more precise, but more ways to get wrong on a
first live test, and the independent app itself only exposes the single
global correction as a Flow card, not these.

### Does A Real PV/SmartGrid Signal Exist On The Controller?

No. `ID_Einst_Photovoltaik_akt`, `ID_Einst_SmartGrid`, and
`ID_Einst_EvuTyp_akt` all read `0` on this installation (verified live,
2026-10-22, see `homey-climate-toolkit/docs/HEAT_PUMP_ENERGY_RESEARCH.md`
§4d) — the controller has no native PV-awareness. All PV-aware timing must
live in Homey (Advanced Flow + HomeyScript), consistent with this project's
own stated design philosophy (`docs/ROADMAP.md`: "Homey should contain the
automation logic. The app should provide the reliable interface to the heat
pump.").

### Is The "Mostly At Night" Pattern A Schedule Or A Threshold?

Investigated specifically for this research (see Verified Facts): the
literal `Schaltuhr` time-slot parameters for the heating circuit exist but
are empty/unconfigured on this controller. Combined with the already-
documented DHW temperature-hysteresis behaviour (boiler cooling to ~47.8 °C,
reheating to ~55.6 °C — `homey-climate-toolkit/docs/HEAT_PUMP_ENERGY_RESEARCH.md`
§4a), the evidence points to **demand/threshold-driven** behaviour rather
than a fixed clock block. This is favourable for the preheat strategy: there
is no inflexible schedule to fight against.

## Recommended Safe Live Test Order

**Status: steps 1–4 completed on 2026-10-22 — see
docs/LIVE_VALIDATION_PARAMETER_1.md for the full recorded result.** Summary:
write + read-back confirmed exact at every step (no-op, +1.0 °C, restore to
0.0 °C); `ID_WEB_Sollwert_TRL_HZ` did not visibly change within the test
window, which ran with no active heat demand — the effect on real heat
output during an active cycle is still unconfirmed.

No live test should write a new parameter until packet format, allowed
values, read-back verification and restore strategy are prepared — all of
which already exist generically in `lib/LuxtronikWriteSupport.js` and
`drivers/luxtronik-2/device.js` (mirrored from the cooling-release pattern).

1. Read-only baseline.
   - Record current `ID_Einst_WK_akt` (parameter 1), `ID_WEB_Sollwert_TRL_HZ`
     (calculation 12), outdoor temperature, `ID_WEB_SH_HZ`/`SH_BWW`, and
     `ID_WEB_WP_BZ_akt` (confirm the compressor is not mid-cycle).
2. No-op write for parameter 1.
   - `testWriteHeatingCurveCorrectionNoop()` — read current raw value, write
     it back unchanged, confirm read-back matches exactly.
3. Small reversible test.
   - `setHeatingCurveCorrection(1.0)` (chosen starting value: **+1.0 °C**,
     well inside the independently-corroborated ±5 °C range and a single
     0.5 °C step beyond the minimum).
   - Observe `ID_WEB_Sollwert_TRL_HZ` and actual flow temperature for
     30–60 minutes (long enough for the slow-responding floor circuit to
     show *some* signal, short enough to bound exposure).
4. Restore.
   - `restoreHeatingCurveCorrection()` — write back the saved original,
     confirm read-back matches `0.0 °C`.
5. Investigate, but do not automate, parameters 11/12/13 (direct circuit) and
   1148 (RBE room target) — only after their behaviour is independently
   confirmed on this controller, exactly as the cooling research deferred
   132-135/966-967/979.
6. Do not pursue MK1/MK2/MK3 triads (14-16, 141-143, 774-776) for this
   installation — MK1 is verified inert, MK2/MK3 presence is unverified.
7. SHI/Modbus research — only if the CFI-based correction proves
   insufficient; not part of this round.

## Strong Evidence

- The global heating-curve correction (`ID_Einst_WK_akt`, parameter 1) is
  strongly supported by: consistent presence as `writeable: True, Celsius,
  °C/10` with no superseding/renamed entry; independent corroboration by a
  second, unrelated, shipped Homey app assigning the same index the same
  role and a sane bounded range; and a live-confirmed, non-zero, actively
  computed downstream monitoring field (`ID_WEB_Sollwert_TRL_HZ`) to verify
  against.
- The installation's circuit identity (direct, not MK1) is strongly
  supported by a direct live read: MK1's setpoint and type both read as
  inert (`0.0 °C` / `0`), while the direct circuit's setpoint is non-zero and
  consistent with the actually-measured flow/return temperatures.
- The absence of an active weekly schedule, and the DHW temperature-
  hysteresis evidence, together support a demand/threshold-driven
  interpretation of the "mostly at night" pattern — favourable for this
  strategy.

## Assumptions

- `ID_Einst_WK_akt`'s exact write semantics (immediate effect vs. next
  recalculation cycle, interaction with other corrections, whether it
  affects all circuits simultaneously) have **not** been confirmed by an
  actual write-and-observe test on this controller — only by static
  code/name inspection across two independent open-source projects, exactly
  the same caution already applied to the PV/SmartGrid parameters in
  `homey-climate-toolkit/docs/HEAT_PUMP_ENERGY_RESEARCH.md` §4d.
- The empty `Schaltuhr` slots are assumed to mean "unconfigured/no
  restriction," not some other sentinel value — not independently confirmed
  against the Luxtronik's own on-screen menu.
- `ID_WEB_SH_HZ`/`SH_BWW` are assumed to reflect live demand rather than a
  clock schedule, based on the empty `Schaltuhr` slots — a reasonable but not
  airtight inference.

## Current Recommendation

For the current Homey CFI integration, the safest Flow-card candidate for
this round is:

1. `set_heating_curve_correction` / `restore_heating_curve_correction`,
   writing `ID_Einst_WK_akt` (parameter 1), range −5…+5 °C, step 0.5 °C.
   Implemented following the exact save/queue/set/restore pattern already
   used for `COOLING_RELEASE_TEMPERATURE`, and **live-validated** on
   2026-10-22 (docs/LIVE_VALIDATION_PARAMETER_1.md) before the Flow card was
   added, per this project's own precedent
   (docs/LIVE_VALIDATION_PARAMETER_110.md). Remaining open item: the
   validation ran with no active heat demand, so the correction's effect on
   the computed setpoint and on real heat output during an active cycle is
   still unconfirmed — verify this once the PV-aware Advanced Flow is live
   (see `homey-climate-toolkit/docs/HEAT_PUMP_ENERGY_RESEARCH.md` §6).

Do not expose the circuit-specific endpoint/level/night-setback parameters
(11/12/13), the RBE room target (1148), or the MK2/MK3 triads as Flow cards
until their exact behaviour is independently verified on this controller via
the Recommended Safe Live Test Order above.
