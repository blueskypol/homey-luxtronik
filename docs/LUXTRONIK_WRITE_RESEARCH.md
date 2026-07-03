# Luxtronik Write Research

Status: research only. No Homey application code has been changed for write
support yet.

Scope:

- Boost domestic hot water by temporarily raising the DHW target.
- Enable extra cooling, or lower a cooling-related setpoint, only where the
  parameter can be verified from `python-luxtronik`.

Safety stance:

- Existing read polling must remain unchanged until write support is added in a
  small verified step.
- No protocol command or parameter may be guessed.
- Every write must log command, parameter index, raw value sent, and controller
  response.
- Every real write action still needs testing against an actual controller.

## Sources Checked

- Current Homey read implementation:
  - `drivers/luxtronik-2/device.js`
  - `lib/LuxtronikProtocol.js`
  - `lib/LuxtronikClient.js`
- Reference implementation:
  - `research/python-luxtronik/luxtronik/cfi/constants.py`
  - `research/python-luxtronik/luxtronik/cfi/interface.py`
  - `research/python-luxtronik/luxtronik/definitions/parameters.py`
  - `research/python-luxtronik/luxtronik/datatypes.py`
  - `research/python-luxtronik/tests/fake/fake_socket.py`
  - `research/python-luxtronik/tests/test_socket_interaction.py`

## Current Homey Protocol Behavior

The current Homey device polls the controller over TCP on port `8889`.

The active polling implementation is in `drivers/luxtronik-2/device.js`.
`lib/LuxtronikProtocol.js` and `lib/LuxtronikClient.js` contain helper code, but
the active Homey device does not currently use them for its scan loop.

Read parameters:

```text
client -> controller:
  int32be command = 3003
  int32be value   = 0

controller -> client:
  int32be command = 3003
  int32be length
  int32be values[length]
```

Read calculations:

```text
client -> controller:
  int32be command = 3004
  int32be value   = 0

controller -> client:
  int32be command = 3004
  int32be status
  int32be length
  int32be values[length]
```

This matches `python-luxtronik` for reads. The current Homey code has no
finished write support. `sendCommand(command, host, port)` sends only command
plus zero, which is correct for reads but insufficient for parameter writes.
`sendRequest()` appears unused and uses a length-prefixed little-endian framing
that does not match the verified CFI packets.

## Verified Python Write Protocol

`python-luxtronik` defines the CFI constants:

```text
port:                    8889
LUXTRONIK_PARAMETERS_WRITE: 3002
LUXTRONIK_PARAMETERS_READ:  3003
LUXTRONIK_CALCULATIONS_READ: 3004
LUXTRONIK_VISIBILITIES_READ: 3005
```

The write implementation only writes `Parameters`, not calculations or
visibilities.

For each pending writable parameter, Python does:

```text
client -> controller:
  int32be command         = 3002
  int32be parameter_index
  int32be raw_value

controller -> client:
  int32be response_command
  int32be response_value
```

The fake socket used by the Python tests verifies the response as:

```text
response_command = 3002
response_value   = parameter_index
```

Important limitation: the Python code logs the response but does not validate
that `response_command === 3002` and `response_value === parameter_index`.
The Homey implementation should validate those values before reporting success.

Python waits one second after parameter writes:

```text
WAIT_TIME_AFTER_PARAMETER_WRITE = 1
```

### Verified Packet Examples

All integers are signed 32-bit big-endian.

Write DHW target `ID_Soll_BWS_akt` at index `105` to `50.0 C`.
`Celsius.to_heatpump()` uses scale `0.1`, so `50.0 C` becomes raw `500`.

```text
decimal ints:
  3002, 105, 500

hex bytes:
  00 00 0B BA  00 00 00 69  00 00 01 F4

expected response:
  00 00 0B BA  00 00 00 69
```

Enable cooling mode `ID_Einst_BA_Kuehl_akt` at index `108`.
`CoolingMode` maps `0 = Off`, `1 = Automatic`.

```text
decimal ints:
  3002, 108, 1

hex bytes:
  00 00 0B BA  00 00 00 6C  00 00 00 01

expected response:
  00 00 0B BA  00 00 00 6C
```

Write cooling release temperature `ID_Einst_KuehlFreig_akt` at index `110` to
`22.0 C`. `Celsius.to_heatpump()` uses scale `0.1`, so `22.0 C` becomes raw
`220`.

```text
decimal ints:
  3002, 110, 220

hex bytes:
  00 00 0B BA  00 00 00 6E  00 00 00 DC

expected response:
  00 00 0B BA  00 00 00 6E
```

## Verified Parameter IDs

### Domestic Hot Water

Verified writable:

| Purpose | Python name | Index | Type | Raw unit | Writable |
| --- | --- | ---: | --- | --- | --- |
| DHW target/current setpoint | `ID_Soll_BWS_akt` | `105` | `Celsius` | `C/10`, signed int32 | yes |

This is the only parameter currently verified for the first DHW implementation.
It can support a temporary DHW target increase, but it is not a dedicated
"boost" flag.

Not verified as safe for boost:

| Candidate | Index | Python type | Writable | Notes |
| --- | ---: | --- | --- | --- |
| `ID_Einst_Warmwasser_extra` | `1052` | `Unknown` | no | Name suggests extra hot water, but python-luxtronik marks it not writeable and unknown. Do not write. |
| `ID_Einst_Warmwasser_Nachheizung` | `994` | `Bool` in definition, but compatibility test records `Unknown` | unclear/no | Needs deeper version-specific verification before use. Do not use for initial boost. |

Conclusion: the only verified DHW write operation is temporarily changing
`ID_Soll_BWS_akt` at parameter index `105`. A "boost" should therefore be
implemented as a guarded temporary target override: read/store current target,
write a higher target, later restore the original target. No dedicated "DHW
boost" protocol command has been verified.

### Cooling

Verified writable:

| Purpose | Python name | Index | Type | Raw unit | Writable |
| --- | --- | ---: | --- | --- | --- |
| Cooling operating mode | `ID_Einst_BA_Kuehl_akt` | `108` | `CoolingMode` | enum: `0 = Off`, `1 = Automatic` | yes |
| Cooling release temperature | `ID_Einst_KuehlFreig_akt` | `110` | `Celsius` | `C/10`, signed int32 | yes |

Not verified as safe for cooling target:

| Candidate | Index | Python type | Writable | Notes |
| --- | ---: | --- | --- | --- |
| `ID_Sollwert_Kuehl1_akt` | `109` | `Unknown` | no | Name suggests cooling setpoint, but not writeable. |
| `ID_Einst_Sollwert_TRL_Kuehlen` | `974` | `Unknown` | no | Name suggests return target cooling; not writeable. |
| `ID_Einst_Akt_Kuehlung_akt` | `884` | `Unknown` | no | Name suggests active cooling; not writeable. |
| `ID_Einst_Akt_Kuehl_Speicher_min_akt` | `887` | `Unknown` | no | Not writeable. |
| `ID_Einst_Akt_Kuehl_Freig_WQE_akt` | `888` | `Unknown` | no | Not writeable. |
| `ID_Einst_min_VL_Kuehl` | `993` | `Unknown` | no | Not writeable. |
| `ID_Einst_Vorl_akt_Kuehl` | `1053` | `Unknown` | no | Not writeable. |
| `ID_WEB_FreigabKuehl` | calculation `146` | `Bool` | no | Calculation, not a parameter. Do not write. |

Conclusion: enabling cooling can be mapped to parameter `108 = Automatic` if the
controller supports cooling and the user has explicitly enabled this behavior.
"Lower cooling setpoint" is not yet verified. Parameter `110` may be useful as a
cooling release temperature, but it is not the same as a room/circuit cooling
target. Treat it as a separate later feature until tested on a real controller.

For now, only parameter `105` should be treated as ready for the first
implementation step. Cooling is documented here as research, not as the next
write target.

## Protocol Diagrams

Read cycle currently used by Homey:

```text
Homey device scan()
  |
  +-- open TCP socket to host:8889
  |     send int32be [3003, 0]
  |     receive [3003, length, parameter values...]
  |
  +-- open TCP socket to host:8889
        send int32be [3004, 0]
        receive [3004, status, length, calculated values...]
```

Verified write cycle from python-luxtronik:

```text
Homey write action
  |
  +-- validate parameter is in local allowlist
  |     validate value range/type
  |     convert display value to raw controller value
  |
  +-- open TCP socket to host:8889
        send int32be [3002, parameter_index, raw_value]
        receive exactly 8 bytes:
          int32be response_command
          int32be response_value
        require response_command == 3002
        require response_value == parameter_index
        log command, index, raw value, response command, response value
```

Temporary DHW boost shape:

```text
read parameter 105
store original raw value
write parameter 105 = boost raw value
wait configured duration
read parameter 105 again
if still safe to restore:
  write parameter 105 = original raw value
```

The restore guard needs product design. For example, if a human changed the
target during the boost, blindly restoring the old value may be surprising.

## Required Protocol Changes In `device.js`

These are implementation notes only; no code has been changed.

1. Add a write-specific packet sender that sends three signed 32-bit big-endian
   integers: command `3002`, parameter index, raw value.
2. Add an exact 8-byte response parser for parameter writes.
3. Validate response command and response value before reporting success.
4. Keep read commands `3003` and `3004` behavior intact.
5. Avoid overlapping read and write socket operations. Python uses a per-host
   lock because the controller appears unstable with concurrent operations.
   Homey should serialize scan and write operations per device.
6. Add explicit logging for every write:
   - command
   - parameter index
   - raw value sent
   - controller response command
   - controller response value
7. For Celsius values, convert Homey/display degrees C to raw controller value
   with `Math.round(celsius / 0.1)`, equivalent to `Math.round(celsius * 10)`.
8. Add a small local allowlist for initial write parameters:
   - `105` for DHW target
   - `108` for cooling mode
   - optionally `110` only after the UI/behavior is clearly named as cooling
     release temperature, not "cooling target"

## Existing Unfinished Write Support

Found:

- `drivers/luxtronik-2/device.js` has `sendCommand(command, host, port)`, but it
  only sends `[command, 0]`. This is read-compatible and not enough for writes.
- `drivers/luxtronik-2/device.js` has `sendRequest(request, callback)`, but it
  appears unused and uses length-prefixed little-endian framing. That does not
  match the verified CFI write protocol.
- `lib/LuxtronikProtocol.js` defines only read constants `3003` and `3004`.
- `lib/LuxtronikClient.js` has read methods only and currently uses port `8888`,
  which conflicts with the verified CFI port `8889` and the active Homey device
  code.

No Homey flow action, capability listener, or completed write path was found.

## Remaining Unknowns

- Real-controller response semantics beyond the Python fake socket are not yet
  verified. Python expects/logs two int32 values after a write; fake tests return
  `[3002, parameter_index]`.
- Exact current hardware details are not yet documented beyond Alpha Innotec /
  Luxtronik over LAN.
- Valid/safe value ranges for parameter `105` DHW target are not defined in the
  checked Python metadata.
- Whether writing `ID_Soll_BWS_akt` immediately triggers DHW production depends
  on controller mode, schedules, hysteresis, maximum DHW temperature, compressor
  state, and safety limits. This still needs real-controller testing.
- There is no verified dedicated "DHW boost" command. `ID_Einst_Warmwasser_extra`
  exists but is not writeable in python-luxtronik.
- There is no verified writeable cooling target setpoint. The likely-looking
  target names found in python-luxtronik are not writeable/unknown.
- Parameter `110` is verified writeable as a Celsius value, but its practical
  behavior as "cooling release temperature" needs real-controller testing before
  being exposed as an automation action.
- Homey UX and flow-card design for temporary override duration, restore policy,
  and conflict handling is not yet specified.

## Implementation Proposal

Small verified steps:

1. Add a non-user-facing write helper in `device.js` for one allowlisted
   parameter, initially guarded by a local test/fake socket. Do not touch read
   mapping.
2. Add a local test or script that proves packet bytes for `[3002, index, value]`
   and parses `[3002, index]`.
3. Test against a real controller with a harmless read-back flow:
   write a value equal to the current parameter value, log response, read back
   parameter `105`.
4. Add a developer-only/manual DHW target write path for parameter `105`, with
   explicit logs.
5. Add the real "temporary DHW boost" behavior:
   read original, write boosted target, restore after duration with a clear
   restore guard.
6. Add cooling mode write for parameter `108`, first as a manual/test action,
   then as a Homey flow action after real-controller validation.
7. Defer "lower cooling setpoint" until a writeable parameter is verified and
   tested. Do not use the non-writeable unknown candidates.

## Next Session Checklist

- [ ] Do not refactor.
- [ ] Do not write JavaScript beyond the smallest write-helper step.
- [ ] Keep existing read behavior unchanged.
- [ ] Add command `3002` write support only behind a local helper/test.
- [ ] Allowlist parameter `105` first.
- [ ] Verify packet bytes locally before any live-controller write.
- [ ] Do not implement DHW boost UI or Homey flow cards until a no-op live write
      to parameter `105` has succeeded.
- [ ] Do not implement cooling target writes; the parameter is still unknown.
