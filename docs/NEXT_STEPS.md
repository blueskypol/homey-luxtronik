# Next Steps

This is the handoff checklist for the next session. The next work should be a
small implementation step, not a broad cleanup.

## Current State

- App code now has the first private write helper and one user-facing Homey
  Flow action for setting the DHW target temperature.
- Documentation now captures the verified read/write protocol and known
  parameter IDs.
- The current Homey app already reads values from the Luxtronik controller.
- The current Homey app has limited user-facing write support for DHW target
  temperature only.
- The polling cycle now logs read-only cooling diagnostics only when one of the
  tracked cooling values changes.
- Cooling diagnostics currently include CFI parameter `108`, CFI parameter
  `110`, calculation `146`, operation mode and outdoor temperature.
- SHI-only monitoring fields such as `cooling_status`, `cooling_configured`
  and `mc1_target` are explicitly logged as unavailable because the current app
  does not read SHI inputs yet.
- The only verified initial write target for DHW boost is parameter `105`,
  `ID_Soll_BWS_akt`, DHW target temperature, unit `C/10`.
- `drivers/luxtronik-2/device.js` now contains:
  - `VERIFIED_LUXTRONIK_PARAMETERS.DHW_TARGET`, the named registry entry for
    parameter `105` / `ID_Soll_BWS_akt`.
  - `writeParameter(index, rawValue)`, allowlisted to parameter `105` only.
  - `setDhwTargetTemperature(value)`, validates `45-60 C`, converts Celsius to
    raw `C/10` with `Math.round(value * 10)`, logs both values, waits for
    `writeParameter(105, rawValue)`, then verifies parameter `105` by reading
    parameters back without running the full scan/capability update path.
  - `readParameters()`, a small read-back helper for command `3003` that updates
    `parametersArray` without updating Homey capabilities.
  - `testWriteDhwTargetNoop()`, a developer-only helper that writes the current
    raw parameter `105` value back to the controller.
- `drivers/luxtronik-2/driver.flow.compose.json` now contains one action card:
  - `set_dhw_target_temperature`, "Set DHW target temperature".
- `app.js` registers that action card and delegates to the selected device.

## Before Writing Code

- [ ] Confirm the working tree state.
- [ ] Confirm the real controller IP is available only when the user explicitly
      wants a live test.
- [ ] Re-read `docs/LUXTRONIK_WRITE_RESEARCH.md`.
- [ ] Keep the first implementation limited to write plumbing and tests.
- [ ] Do not refactor unrelated code.

## Implemented First Step

The smallest write helper has been added.

Implemented behavior:

- Sends command `3002`.
- Allows only parameter `105`.
- Sends three signed int32 big-endian values: `3002`, `index`, `rawValue`.
- Connects to the device host on port `8889`.
- Times out after 5 seconds.
- Parses exactly 8 response bytes.
- Requires `response_command === 3002`.
- Requires `response_value === index`.
- Logs command, index, raw value, and response.
- Rejects on errors.
- User-facing DHW writes wait briefly after success, read parameter `105` back,
  and reject if the read-back raw value does not match the requested raw value.

## Remaining Implementation Steps

Phase 2 (Domestic Hot Water) is considered complete.

The next milestone is Phase 3: observe cooling state transitions using
event-based logging.

Objectives:

1. Observe the cooling diagnostics log during idle, cooling-requested and
   cooling-active conditions.

2. Compare CFI parameter `108` (Cooling Mode), CFI parameter `110` (Cooling
   Release Temperature), calculation `146` (`ID_WEB_FreigabKuehl`), operation
   mode and outdoor temperature.

3. Record whether operation mode becomes `7 (Cooling)` when the controller is
   actively cooling.

4. Decide whether a separate SHI input read path is needed for
   `cooling_status`, `cooling_configured` and `mc1_target`.

5. Do not add cooling Flow cards until the observed controller behaviour has
   been reviewed.

The long-term objective is intelligent pre-cooling using Homey automation and PV surplus rather than forcing maximum cooling.

## Do Not Do Yet

- [ ] Do not implement new cooling Flow cards yet.
- [ ] Do not write to any cooling parameter before it has been verified.
- [ ] Do not guess cooling targets or offsets.
- [ ] Do not refactor unrelated read logic.
- [ ] Do not move the socket implementation into `lib/`.
- [ ] Do not implement automatic cooling strategies before the controller behaviour is understood.


## Next Session Checklist

- [ ] Open `docs/PROJECT_GOAL.md`.
- [ ] Open `docs/ROADMAP.md`.
- [ ] Open `docs/LUXTRONIK_WRITE_RESEARCH.md`.
- [ ] Open `docs/COOLING_RESEARCH.md`.
- [ ] Observe cooling state transitions using event-based logging.
- [ ] Review the read-only cooling diagnostic logs.
- [ ] Decide whether SHI input monitoring should be implemented separately.
- [ ] Do not write to the controller until the research has been reviewed.
