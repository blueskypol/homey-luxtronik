# Roadmap

## Vision

Build the best Homey integration for Luxtronik heat pumps.

The app should expose safe, reliable Homey Flow cards that allow users to
optimize comfort, energy consumption and self-consumption of solar power,
without requiring knowledge of Luxtronik parameters.

Homey should contain the automation logic.
The app should provide the reliable interface to the heat pump.

---

# Design Principles

All write operations must:

- only write verified writable parameters
- validate values before writing
- verify the controller response
- log every write operation
- prevent concurrent writes to the same parameter
- fail safely on communication errors
- never overwrite a stored restore value while a temporary override is active

---

# Phase 1 – Safe Write Infrastructure

Goal:
Create a reliable and well-tested write layer.

Tasks:

- verify Luxtronik write protocol
- implement private write helper
- add packet tests
- perform live no-op write test
- document verified writable parameters

Result:

A safe internal API that can write verified Luxtronik parameters.

---

# Phase 2 – Domestic Hot Water (DHW)

Goal:

Use excess solar energy to temporarily store heat in the DHW tank.

Flow cards:

- Set DHW target temperature
- Start DHW Boost
- Restore previous DHW target

Notes:

- store the original target temperature once
- restore only when explicitly requested
- Homey controls timing (wait 30 min / 2 hours / etc.)

---

# Phase 3 – Cooling

Goal:

Enable intelligent pre-cooling for buildings with high thermal mass.

The preferred strategy is not maximum cooling capacity, but using excess PV
production to cool the building earlier, allowing the concrete floor and other
building mass to store "coolth" before the hottest part of the day.

Research:

- identify every cooling-related parameter
- classify each parameter
- determine which parameters are writable
- understand cooling enable/disable behaviour
- understand cooling release temperature
- determine whether a true cooling target exists
- investigate cooling curves and offsets
- determine whether MC (mixing circuit) targets are writable
- test verified writable parameters on a real controller
- document observed behaviour

Deliverable:

A documented cooling strategy describing how Homey can safely optimise cooling
without bypassing Luxtronik safety logic.

Only after the research is complete should new Flow cards be implemented.

---

# Phase 4 – Heating

Goal:

Investigate temporary heating optimisation using excess solar energy.

Status: write support and Flow cards done; live validation complete;
Advanced Flow not yet built.

- Research complete: docs/HEATING_RESEARCH.md. Verified circuit identity
  (direct circuit, not Mixing Circuit 1) and identified the primary
  candidate parameter (`ID_Einst_WK_akt`, global heating-curve correction,
  index 1), independently corroborated by a second open-source Homey app.
- Device write/restore/no-op-test methods implemented
  (`setHeatingCurveCorrection`, `restoreHeatingCurveCorrection`,
  `testWriteHeatingCurveCorrectionNoop`).
- Live-validated on the real controller 2026-10-22 (0.0 -> 1.0 -> 0.0 °C,
  exact read-back at every step — see docs/LIVE_VALIDATION_PARAMETER_1.md).
  Important caveat recorded there: the computed setpoint did not visibly
  react within the test window, which had no active heat demand — the
  effect on actual heat output during a real cycle is still unconfirmed.
- Flow cards added after validation: **Set heating curve correction** and
  **Restore original heating curve correction** (same pattern as parameter
  110's cooling-release actions).
- Still pending: the Homey-side Advanced Flow that ties this to PV surplus
  (lives in the `homey-climate-toolkit` project, not in this app), and
  confirming the correction's effect during a real active heating cycle.

---

# Phase 5 – Diagnostics & Monitoring

Improve visibility and reliability.

Possible additions:

- communication diagnostics
- write history
- protocol logging
- controller information
- firmware detection
- writable parameter detection

---

# Future Ideas

- Dynamic electricity price optimisation
- Weather forecast integration
- PV surplus optimisation
- Battery integration
- Heat storage optimisation
- Adaptive comfort strategies
- Generic parameter read/write service for advanced users
