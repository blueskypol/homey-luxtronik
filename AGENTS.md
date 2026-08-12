# AGENTS.md

## Project

This project extends the Homey Luxtronik application.

The app is intentionally simple.

Its responsibility is ONLY to expose safe functionality of the Luxtronik controller to Homey.

All automation logic belongs in Homey Flows, Advanced Flows or HomeyScript.

---

## Principles

- Never guess protocol commands.
- Never write undocumented parameters.
- Verify everything against python-luxtronik.
- Keep changes small.
- Existing read functionality must never break.
- Avoid unnecessary refactoring.
- Prefer many small commits over one large commit.
- Update documentation whenever protocol knowledge improves.

---

## Architecture

The app consists of three layers:

1. Luxtronik TCP protocol
2. Homey device abstraction
3. Homey Flow cards

Business logic should NOT be implemented inside the app.

---

## Current milestone

Implement safe parameter writing.

Initial supported parameters:

- 105 — DHW target

Future candidates:

- 108 — Cooling mode
- 110 — Cooling release temperature

No other parameters should be written until verified.

---

## Testing Strategy

Every new writable parameter follows exactly this sequence:

1. Research
2. Packet verification
3. Local fake test
4. Live no-op write
5. Read-back verification
6. Homey Flow card
7. Documentation update

Never skip steps.

---

## Long-term goal

The app should become a reliable Homey integration that enables users to build their own energy automations.

Examples:

- PV surplus → heat DHW
- Cheap electricity → preheat house
- Hot weather → enable cooling
- Battery integration
- Dynamic tariffs

These automations belong in Homey, not in this app.
