v1.0.7

Added

- DHW target Flow card
- Verified parameter registry
- Read-after-write verification
- Cooling diagnostics
- Event-based cooling logging

Changed

- DHW validation range changed to 45–60 °C

Fixed

- Flow card formatting

Unreleased

Added

- Manual Flow action for setting the live-validated cooling release temperature.
- Manual Flow action for restoring its persistently saved original value.
- Strict `10-35 °C` validation in `0.5 °C` increments and mandatory read-back.

Fixed

- Skip firmware-specific current-power and energy-input fields when their array
  indices are unavailable, preventing `undefined` capability values and `NaN`
  totals.

Not included

- Automatic or predictive cooling control.
