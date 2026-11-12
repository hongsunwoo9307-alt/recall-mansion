# Design Document — Recall Mansion Study Core

Originally authored by Kiro. Codex reviewed and corrected implementation details
in this document on 2026-11-13; this review did not change code or tests.

## Overview

The study core is three pure-function modules plus a localStorage adapter that together
implement every invariant in `docs/CORE-CONTRACT.md`.  No DOM, no global state, no
`Date.now()` inside pure functions.  All time is passed in explicitly so tests are
deterministic.

```
dist/lib/
  validation.js   – shared limit constants + field validators
  scheduler.js    – computeNext(rating, at, previousStep) → {nextDueAt, nextStep}
  core.js         – state mutators, query helpers, export/import
  store.js        – createStore(storage) → {load, save}
```

The UI (`dist/app.js`) imports from `dist/lib/core.js` and `dist/lib/store.js` only;
it never touches the internal modules directly.

---

## State shape

```js
{
  schemaVersion: 1,       // integer
  rooms:        [],       // Room[]
  cards:        [],       // Card[]
  reviewEvents: []        // ReviewEvent[]
}
```

Arrays and state records are ordinary, unfrozen JavaScript objects. Mutators create
a new top-level state and copy the affected arrays and records without changing
the input. Unchanged arrays and records may remain shared; callers must not mutate
them in place.

### Room
```js
{ id, title, note, createdAt, isSample? }
```

### Card
```js
{ id, roomId, noteSnapshot, start, end, dueAt, step, createdAt }
```
`start`/`end` are UTF-16 code-unit offsets into `noteSnapshot`.

### ReviewEvent
```js
{ id, cardId, at, confidence, rating,
  previousDueAt, nextDueAt, previousStep, nextStep }
```

---

## Limits (single source: validation.js)

| Field       | Limit                  |
|-------------|------------------------|
| title       | 200 UTF-16 code units  |
| note        | 20 000 UTF-16 code units |
| ID          | 128 UTF-16 code units  |
| rooms       | 100 records            |
| cards       | 3 000 records          |
| reviewEvents| 20 000 records         |
| import JSON | 4 MiB (4 194 304 bytes)|

---

## Scheduler (scheduler.js)

Pure function; never calls `Date.now()`.

```
computeNext(rating, at, previousStep)
  → { nextDueAt, nextStep }
```

| Rating      | nextDueAt                                     | nextStep            |
|-------------|-----------------------------------------------|---------------------|
| again       | at + 600 000 ms                               | 0                   |
| hard        | at + 86 400 000 ms                            | previousStep        |
| remembered  | at + INTERVALS[previousStep] * 86 400 000 ms  | min(previousStep+1, 4) |

`INTERVALS = [1, 3, 7, 14, 30]`

---

## core.js — public API

Each mutator takes the current state and an options bag, and normally returns a
**new** state with the affected arrays and records copied. An identical
`applyReview` retry returns the existing state. A validation failure throws an
Error without mutating the input; no state is returned on that error path.

| Export             | Behaviour |
|--------------------|-----------|
| `createEmptyState` | `{schemaVersion:1, rooms:[], cards:[], reviewEvents:[]}` |
| `validateState`    | Structural and semantic checks, including full per-card history replay; returns the same valid state or throws a descriptive Error |
| `addRoom`          | Checks limits; appends room |
| `addCard`          | Checks limits; validates surrogate boundaries; rejects duplicate snapshot+range |
| `applyReview`      | Idempotent on same-ID+same-payload; throws on same-ID+different-payload; updates card dueAt/step |
| `getDueCards`      | Filter `dueAt <= now`; sort by dueAt, then id |
| `getOverconfidentMisses` | Filter `confidence==='confident' && rating==='again'`; sort newest-first |
| `getClozeParts`    | Splits `card.noteSnapshot` at `start`/`end` |
| `exportBackup`     | Runs `validateState`, serialises to JSON with `exportedAt`, rejects UTF-8 output above 4 MiB |
| `parseBackup`      | Checks raw UTF-8 JSON size ≤4 MiB before parsing; validates `exportedAt` and full state; returns canonical state fields |

### UTF-16 surrogate boundary check

A boundary `i` is invalid when `noteSnapshot.charCodeAt(i-1)` is a high surrogate
(0xD800–0xDBFF) and `noteSnapshot.charCodeAt(i)` is a low surrogate (0xDC00–0xDFFF).
Applies to both `start` and `end`.

### Duplicate-card check

`addCard` rejects a new card if an existing card in the same room has
`noteSnapshot === currentRoomNote` and identical `start`/`end`.

### Full history replay

`validateState` replays each card's events in their array-append order, starting
with `dueAt === createdAt` and `step === 0`. Event timestamps must not precede card
creation or the previous event; equal timestamps preserve append order. Every
event's previous schedule must match the running schedule, and its next schedule
must match `computeNext`. The card's final `dueAt` and `step` must match the replay
result. Cards without review events must retain their creation schedule.

---

## store.js — public API

```js
createStore(storage, key = 'recall-mansion-v1')
  → { load(), save(state) }
```

- `load()`: absent key → `createEmptyState()`. Present key → UTF-8 byte-size check,
  parse, and `validateState`; returns only `schemaVersion`, `rooms`, `cards`, and
  `reviewEvents`. This also omits incidental `exportedAt` metadata from previously
  saved values. Invalid records cause an error rather than being dropped; reading
  never changes storage.
- `save(state)`: validates the state, calls `exportBackup(state, Date.now())` as a
  size preflight including backup metadata, then serialises only the four canonical
  state fields and calls `storage.setItem` exactly once. Validation or quota failure
  throws; the caller advances its in-memory state only after a successful save.

---

## Export/import size

`exportBackup` first validates the state and export timestamp, then serialises the
backup including `exportedAt`. It measures the resulting string with
`new TextEncoder().encode(json).length` and rejects output above 4,194,304 UTF-8
bytes. `parseBackup` receives raw JSON text, checks its UTF-8 size before
`JSON.parse`, then validates the backup timestamp and state. Record-count and field
limits are checked by `validateState`. The store uses the same export-size preflight
before writing its smaller state-only JSON, so a successful save fits the backup
limit including the export metadata checked at that time.

---

## Error strategy

Validation and storage failures throw an `Error` with a human-readable `.message`
describing the failed constraint or operation. Query helpers assume validated
inputs. Mutators do not modify the input state, including when they throw.

---

## Test plan (node:test)

Tests live in `tests/core.test.js` and `tests/store.test.js`. Covers:

1. Scheduling arithmetic for all three ratings, all five steps, step-cap.
2. `applyReview` idempotent retry; conflicting same-ID error.
3. `getDueCards` ordering and roomId filter.
4. Surrogate-pair boundary rejection (emoji `start` splitting a pair).
5. Repeated-phrase rejection; first occurrence accepted.
6. `exportBackup` / `parseBackup` round-trip.
7. Import oversized (> 4 MiB), wrong schemaVersion, broken relationships.
8. `load()` on absent key; `load()` on corrupt value.
9. `save()` quota failure leaves storage untouched.
10. Korean text and mixed emoji note offsets.
11. Full history-chain replay, same-time append order, and no-event creation state.
12. Canonical state-only storage and two consecutive save/load mutations.
