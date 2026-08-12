# Live validation: cooling release temperature (parameter 110)

Status: successfully live-validated on 2026-08-12. This remains developer-only
test support; there is no Homey Flow card or automatic cooling control.

## Recorded live result

The following sequence was observed on the real controller:

1. Initial read: raw `190` (`19.0 °C`).
2. No-op write: parameter `110` to raw `190`.
3. Controller response: command `3002`, parameter `110`.
4. Read-back: raw `190`; verification succeeded.
5. Reversible test: raw `190` to raw `200` (`20.0 °C`).
6. The physical heat-pump display showed `20.0 °C`.
7. Explicit restore: raw `200` to the original raw `190` (`19.0 °C`).
8. Final read-back: raw `190`; verification succeeded.

This confirms the parameter index, signed int32 `°C/10` encoding, write response,
read-back behavior, visible controller effect, and recovery path. The controller
was left at its original `19.0 °C` setting.

## Safety gates

- Obtain separate, explicit permission immediately before any live write.
- Confirm the controller address and that parameter 110 currently reads normally.
- Do not proceed if the current raw value is outside `100-350` (`10.0-35.0 °C`).
- Keep the heat-pump UI available and stop if it reports a fault or unexpected mode.
- Do not run concurrent Flows or tools that can change cooling settings.

## No-op validation

1. Run the automated tests locally with `npm test`; these do not contact a controller.
2. Record the current cooling mode, cooling release state, outdoor temperature,
   parameter 110, and any active controller alarms.
3. After explicit permission, invoke the developer helper
   `testWriteCoolingReleaseTemperatureNoop()` exactly once.
4. The helper performs a fresh parameter read, validates and saves the original
   raw value persistently in the Homey device store, writes that same value with
   command 3002, waits 1.5 seconds, reads
   all parameters with command 3003, and requires an exact read-back match.
5. Review logs for the parameter index, raw/Celsius value, write response, and
   read-back value. A timeout, malformed response, mismatch, or socket error is a
   failed test; do not retry automatically.

## Explicit restore

Call `restoreCoolingReleaseTemperature()` only as a deliberate recovery action.
It writes the saved original raw value and performs the same read-back check. On
success the persistent and in-memory values are cleared. The persistent value
survives an app restart, so the explicit restore remains available afterwards.

The no-op test does not change the effective setting. Any future live write still
requires separate explicit permission and must use read-back verification.

## Homey Flow actions

After live validation, two manual Flow actions were added:

- **Set cooling release temperature** accepts `10-35 °C` in `0.5 °C` steps.
  It is explicitly labelled as a release threshold, not a room target. Before
  the first change it reads and persistently stores the controller value. Every
  write requires an exact read-back.
- **Restore original cooling release temperature** writes the first stored value
  back and removes it only after an exact read-back succeeds.

Repeated set actions preserve the first saved value, so restore returns to the
setting from before the sequence rather than to the most recent intermediate
value. No timer or automatic cooling strategy is implemented.

### Homey Flow live result (2026-08-12)

The Flow actions were run against the physical controller:

1. Set `19.0 -> 20.0 °C`: command `3002` acknowledged parameter `110`; exact
   raw `200` read-back succeeded.
2. Set `20.0 -> 15.0 °C`: the first original raw `190` remained stored; command
   `3002` and exact raw `150` read-back succeeded.
3. Restore original: `15.0 -> 19.0 °C`; command `3002` and exact raw `190`
   read-back succeeded, after which the saved original was cleared.

The polling diagnostics independently observed both `20 -> 15 °C` and
`15 -> 19 °C`. The controller was left at its original `19.0 °C` setting.
