# Project Goal

## Overall Goal

Evolve the existing Homey Luxtronik app so Homey automations can safely control
an Alpha Innotec Luxtronik heat pump based on:

- PV surplus / excess solar production.
- Dynamic electricity prices.
- Future household energy strategy, such as preheating before expensive periods
  or charging thermal mass instead of exporting solar power.

The first controlled write use cases are intentionally small:

1. Boost domestic hot water by temporarily raising the DHW target temperature.
2. Enable extra cooling, or adjust a cooling-related setting, only after the
   exact parameter is verified.

This project is not currently about broad cleanup or refactoring. The app should
evolve in small verified steps.

## Current Hardware Setup

Known:

- The target system is an Alpha Innotec heat pump using a Luxtronik controller.
- The app communicates with the controller locally over LAN.
- The current Homey app uses the Luxtronik config interface on TCP port `8889`.

Unknown / not documented yet:

- Exact heat pump model.
- Exact Luxtronik firmware version.
- Whether cooling is installed and enabled on the controller.
- Current DHW target range and maximum safe DHW target on the real controller.
- Whether Smart Home Interface / Modbus TCP is enabled. The current app does not
  depend on it.

## Current App Architecture

This is a Homey SDK v3 app.

Important files:

- `app.js`: minimal Homey app bootstrap.
- `app.json`: generated Homey app manifest.
- `.homeycompose/`: Homey Compose source for app metadata and custom capability.
- `drivers/luxtronik-2/driver.js`: pairing flow and manual IP validation.
- `drivers/luxtronik-2/device.js`: active device runtime and polling logic.
- `includes/luxtronik_operationmode.js`: maps numeric operation mode values to
  strings.
- `lib/LuxtronikProtocol.js`: small read-protocol helper, currently not wired
  into `device.js`.
- `lib/LuxtronikClient.js`: experimental/unfinished client helper, currently
  not wired into `device.js`.
- `research/python-luxtronik/`: copied reference implementation used to verify
  Luxtronik protocol details before adding write support.

Current runtime flow:

```text
Homey pair flow
  -> user enters device name and IP address
  -> Homey stores IP in device setting `host`

Homey device init
  -> adds missing capabilities for existing users
  -> starts scan loop

scan loop
  -> reads parameters command 3003
  -> reads calculations command 3004
  -> maps selected array indexes to Homey capabilities
  -> schedules next scan
```

## Safety Rules

- Existing read functionality must never break.
- Do not refactor unrelated code.
- Do not rewrite app architecture before the first safe write is proven.
- Every write command must first be verified against `python-luxtronik`.
- Never guess protocol commands.
- Never guess parameter IDs.
- Every write action must be tested against a real controller before exposing it
  as a normal automation feature.
- Every write must log:
  - command
  - parameter index
  - value sent, in raw controller units
  - controller response command
  - controller response value
- Writes must be serialized with reads so the controller never receives
  overlapping socket operations from this app.
- Start with an allowlist of known-safe parameter IDs.

## Verified Starting Point

Verified from `python-luxtronik`:

- Config interface port: `8889`.
- Read parameters command: `3003`.
- Read calculations command: `3004`.
- Write parameters command: `3002`.
- Parameter `105` is `ID_Soll_BWS_akt`.
- `ID_Soll_BWS_akt` is the DHW target temperature.
- Unit is `C/10`; for example `50.0 C` is raw value `500`.
- Python marks parameter `105` writeable.

Not verified:

- Dedicated DHW boost command or flag.
- Safe DHW target range for this real controller.
- Cooling enable behavior on this real controller.
- Writeable cooling target parameter.

## Next Session Checklist

- [ ] Re-read `docs/LUXTRONIK_WRITE_RESEARCH.md`.
- [ ] Re-read `docs/NEXT_STEPS.md`.
- [ ] Confirm no application-code refactoring is needed for the next small step.
- [ ] Implement only a minimal write helper and local fake test if write work is
      resumed.
- [ ] Do not expose a Homey flow action until a real-controller test confirms
      the packet and response.
