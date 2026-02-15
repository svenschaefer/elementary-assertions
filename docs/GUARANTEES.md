# Guarantees

This file defines core behavior guarantees for `elementary-assertions`.

## Core Guarantees

- Deterministic behavior:
  - identical input + options produce identical output within the same version, under documented determinism scope.
- Fail-fast validation:
  - malformed input is rejected explicitly.
- Clear authority boundary:
  - persisted output is authoritative.
  - view/tooling outputs are derived and non-authoritative.
- Stable error surface:
  - validation failures use stable error codes for consumer branching.

## Non-Goals

`elementary-assertions` does not implicitly provide:
- hidden retries
- silent auto-repair of invalid input
- implicit mutation of persisted state from read-only commands
- undocumented public API surfaces

## Design Rule

Prefer small, explicit mechanics over broad abstractions.
If behavior is important, make it contract-tested.
