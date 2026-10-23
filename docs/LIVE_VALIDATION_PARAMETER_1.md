# Live validation: heating curve correction (parameter 1)

Status: successfully live-validated on 2026-10-22. This remains
developer-only test support at the time of writing; see "Homey Flow
actions" below for what was added immediately afterward.

## Recorded live result

The following sequence was observed on the real controller
(`192.168.180.15:8889`), using a standalone script implementing the same
CFI write/read protocol as `LuxtronikDevice` (commands `3002` write,
`3003`/`3004` read) — not the Homey app itself, which was not deployed to
the live Homey for this test.

1. Baseline read: `ID_Einst_WK_akt` (parameter 1) raw `0` (`0.0 °C`).
   Context at the time: `ID_WEB_WP_BZ_akt` (operating state) `5` ("no
   request" — compressor idle), `ID_WEB_FreigabKuehl` `0` (cooling not
   released), outdoor temperature `9.1 °C`, `ID_WEB_Sollwert_TRL_HZ`
   (direct-circuit computed setpoint) `23.7 °C`.
2. No-op write: parameter `1` to raw `0` (unchanged).
3. Controller response: command `3002`, parameter `1`.
4. Read-back: raw `0`; verification succeeded.
5. Reversible test: raw `0` to raw `10` (`+1.0 °C`).
6. Controller response: command `3002`, parameter `1`.
7. Read-back: raw `10`; verification succeeded.
8. **`ID_WEB_Sollwert_TRL_HZ` remained `23.7 °C` immediately after the
   write** — no visible change in the computed setpoint within the same
   read cycle.
9. Explicit restore: raw `10` to the original raw `0` (`0.0 °C`).
10. Final read-back: raw `0`; verification succeeded.

This confirms the parameter index, signed int32 `°C/10` encoding, write
response, read-back behavior, and recovery path — the same protocol-level
guarantees validated for parameter 110. The controller was left at its
original `0.0 °C` setting.

## Important finding: no immediate setpoint effect observed

Unlike the parameter 110 test (where the physical display showed the new
value immediately), `ID_WEB_Sollwert_TRL_HZ` did **not** change within the
same read cycle after writing parameter 1. The most likely explanation:
the heating curve is only recalculated when there is active heat demand
(`ID_WEB_WP_BZ_akt` was `5`, "no request", throughout this test — the
compressor was idle). This test did not run long enough, and did not occur
during an active heating/DHW cycle, to observe the correction's effect on
the computed setpoint or on actual delivered heat.

**Consequence for the Advanced Flow design**: the write-and-verify
mechanism itself is proven reliable, but whether/when the correction
actually changes heat output still needs to be confirmed during a real
active cycle. Treat this as an open item for the validation phase once the
Advanced Flow is live (see `homey-climate-toolkit/docs/HEAT_PUMP_ENERGY_RESEARCH.md`
§6) — do not assume the correction takes effect instantly just because the
parameter write succeeds.

## Safety gates (same as parameter 110)

- Obtained separate, explicit permission immediately before this live
  write, including an explicit confirmation of how success would be
  verified (read-back only, no physical-display check requested).
- Confirmed the controller address and that parameter 1 currently read
  normally (`0.0 °C`) before starting.
- Confirmed no active compressor cycle and cooling not released before
  writing, to avoid interfering with any in-progress operation.
- Kept the write exposure window short: write → immediate read-back →
  immediate restore, no extended "wait and observe" period, since there
  was no active demand to observe anyway.

## Homey Flow actions

After this live validation, two manual Flow actions were added (mirroring
parameter 110's `set_cooling_release_temperature`/
`restore_cooling_release_temperature`):

- **Set heating curve correction** accepts `-5…+5 °C` in `0.5 °C` steps.
  Before the first change it reads and persistently stores the controller
  value. Every write requires an exact read-back.
- **Restore original heating curve correction** writes the first stored
  value back and removes it only after an exact read-back succeeds.

No live Homey Flow run has been performed yet (only the standalone-script
test recorded above) — the Flow cards exist and are covered by automated
tests, but have not themselves been triggered against the real controller.
