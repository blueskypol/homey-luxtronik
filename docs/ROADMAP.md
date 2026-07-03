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

Investigate how Luxtronik cooling can be controlled to increase cooling on hot,
sunny days and use excess PV power.

Research:

- identify all cooling-related writable parameters
- determine whether cooling uses:
  - enable/disable
  - room temperature target
  - cooling curve
  - cooling offset
  - supply temperature
  - other mechanisms
- test each verified writable parameter on a real controller
- document the observed behaviour

Deliverable:

A documented cooling strategy that can later be exposed as simple Homey Flow
cards.

No user-facing implementation is planned until the research is complete.

---

# Phase 4 – Heating

Goal:

Investigate temporary heating optimisation using excess solar energy.

Possible Flow cards:

- Enable Solar Heating
- Disable Solar Heating

Implementation depends on verified writable heating parameters.

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
