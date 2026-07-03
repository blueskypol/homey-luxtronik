# Next Steps

This is the handoff checklist for the next session. The next work should be a
small implementation step, not a broad cleanup.

## Current State

- App code now has the first private write helper, but no automatic writes, UI,
  or Homey Flow cards.
- Documentation now captures the verified read/write protocol and known
  parameter IDs.
- The current Homey app already reads values from the Luxtronik controller.
- The current Homey app does not have completed user-facing write support.
- The only verified initial write target for DHW boost is parameter `105`,
  `ID_Soll_BWS_akt`, DHW target temperature, unit `C/10`.
- `drivers/luxtronik-2/device.js` now contains:
  - `writeParameter(index, rawValue)`, allowlisted to parameter `105` only.
  - `testWriteDhwTargetNoop()`, a developer-only helper that writes the current
    raw parameter `105` value back to the controller.

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
- Is not called automatically.

## Remaining Implementation Steps

1. Add a tiny local test or script using a fake socket.
   - Verify bytes for `[3002, 105, 500]`.
   - Verify parsing `[3002, 105]`.
   - Do not require a real controller for this first test.

2. Only after the fake/local test passes, do a live no-op write test when the
   user is ready.
   - Start the app on Homey.
   - Wait for a successful parameter scan so `parametersArray[105]` exists.
   - Manually call `testWriteDhwTargetNoop()` from a developer-only context.
   - Confirm logs include command, index, raw value, response command, and
     response value.
   - Read parameter `105` again.
   - Confirm the value did not unexpectedly change.

3. After the no-op live test succeeds, implement temporary DHW target boost.
   - Read/store current parameter `105`.
   - Write a higher user-provided target to parameter `105`.
   - Restore after a configured duration.
   - Add a guard so restore behavior is explicit if someone changed the target
     during the boost.

4. Do not implement cooling target yet.
   - No writeable cooling target parameter has been verified.

5. Cooling mode may be considered later using parameter `108` only after a
   separate real-controller test.
   - `ID_Einst_BA_Kuehl_akt`
   - `0 = Off`
   - `1 = Automatic`

## Protocol Reminder

The write helper sends this verified packet:

   ```text
   int32be command = 3002
   int32be index
   int32be raw_value
   ```

The helper reads exactly this verified response shape:

   ```text
   int32be response_command
   int32be response_value
   ```

## Known Good Packet Examples

Write DHW target parameter `105` to `50.0 C`:

```text
decimal: 3002, 105, 500
hex:     00 00 0B BA  00 00 00 69  00 00 01 F4
```

Expected response shape:

```text
decimal: 3002, 105
hex:     00 00 0B BA  00 00 00 69
```

## Do Not Do Yet

- [ ] Do not add public Homey flow actions before a real-controller write test.
- [ ] Do not write to `ID_Einst_Warmwasser_extra`; it is not verified writeable.
- [ ] Do not write to guessed cooling target IDs.
- [ ] Do not move the whole socket implementation into `lib/`.
- [ ] Do not fix broad lint issues as part of write support.
- [ ] Do not change existing read capability mappings unless a write test proves
      a direct conflict.

## Next Session Checklist

- [ ] Open `docs/PROJECT_GOAL.md`.
- [ ] Open `docs/LUXTRONIK_WRITE_RESEARCH.md`.
- [ ] Confirm the next task is local/fake verification of the private write
      helper.
- [ ] Add fake/local verification for packet bytes and response parsing.
- [ ] Run the local verification.
- [ ] Stop before live-controller testing unless explicitly requested.
