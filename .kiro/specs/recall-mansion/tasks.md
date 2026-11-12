# Implementation Tasks — Recall Mansion Study Core

## Task 1 — Project scaffold

- [x] Add `package.json` with `"type": "module"`, `"scripts": {"test": "node --test tests/core.test.js tests/store.test.js"}`.
- [x] Create `dist/lib/` directory (validation.js, scheduler.js, core.js, store.js).
- [x] Create `tests/` directory (core.test.js, store.test.js).

## Task 2 — validation.js

- [x] Export `LIMITS` constant (title, note, id, rooms, cards, reviewEvents, importBytes).
- [x] Export `isValidId(v)`, `isFiniteNonNeg(v)`, `isValidTimestamp(v)` (rejects > MAX_JS_DATE).
- [x] Export `assertId`, `assertTitle`, `assertNote` helpers that throw descriptive errors (whitespace-only rejected).
- [x] Export `VALID_CONFIDENCES` and `VALID_RATINGS` sets.

## Task 3 — scheduler.js

- [x] Export `INTERVALS = [1,3,7,14,30]`.
- [x] Export `computeNext(rating, at, previousStep)` → `{nextDueAt, nextStep}` (throws if result > MAX_JS_DATE).
- [x] Throw on unknown rating.

## Task 4 — core.js — state creators and validators

- [x] `createEmptyState()`.
- [x] `validateState(state)`: check schemaVersion, arrays present, all record limits,
  field-level validation for every record type, ID uniqueness, referential integrity
  (cardId→cards, roomId→rooms), valid step range, valid offsets (start < end, non-negative),
  noteSnapshot length ≤ 20 000, non-whitespace answer, surrogate boundaries,
  full per-event history-chain replay in append order (at ≥ createdAt, non-decreasing at,
  previousDueAt/previousStep match running state, nextDueAt/nextStep match computeNext),
  final card dueAt/step match last event, no-event card dueAt === createdAt and step === 0.

## Task 5 — core.js — mutators

- [x] `addRoom(state, {id, title, note, now, isSample})`.
- [x] `addCard(state, {id, roomId, start, end, now})` with surrogate check and
  duplicate-range check.
- [x] `applyReview(state, {id, cardId, at, confidence, rating})` with idempotence
  and conflict detection.

## Task 6 — core.js — queries and backup

- [x] `getDueCards(state, now, roomId?)`.
- [x] `getOverconfidentMisses(state)`.
- [x] `getClozeParts(card)`.
- [x] `exportBackup(state, now)` — validates, serialises, checks UTF-8 byte length ≤ 4 MiB.
- [x] `parseBackup(text)` — size check, JSON.parse, full validateState.

## Task 7 — store.js

- [x] `createStore(storage, key)`.
- [x] `load()` — absent key returns empty state; corrupt value throws without touching storage;
  returns canonical state-only fields (no exportedAt).
- [x] `save(state)` — exportBackup used as size preflight only; persists canonical
  state-only JSON via setItem exactly once; propagates quota error leaving previous value intact.

## Task 8 — tests

- [x] Scheduling unit tests (all ratings, all steps, step-cap, MAX_JS_DATE overflow).
- [x] `applyReview` idempotent retry and conflict error.
- [x] `getDueCards` filter and ordering.
- [x] Surrogate boundary rejection; valid emoji card creation.
- [x] Duplicate phrase rejection; first occurrence accepted.
- [x] `exportBackup`/`parseBackup` round-trip; exportedAt absent from returned state.
- [x] `parseBackup` oversized, wrong schemaVersion, missing/out-of-range exportedAt, broken cardId reference, invalid JSON.
- [x] `load()` absent key; `load()` corrupt value leaves storage intact.
- [x] `save()` quota failure leaves previous storage value intact.
- [x] Korean text offsets.
- [x] History-chain append-order regression (z-then-a same-timestamp events accepted).
- [x] History-chain rejects at preceding prior event for same card.
- [x] Per-event invariants: previousDueAt/Step mismatch, at < createdAt.
- [x] Final card schedule mismatch (dueAt, step).
- [x] No-event card: dueAt ≠ createdAt rejected; step ≠ 0 rejected.
- [x] Two consecutive save/load mutations preserve integrity; no exportedAt in loaded state.
- [x] validateState: noteSnapshot > 20 000 code units rejected.
- [x] validateState: whitespace-only answer rejected.

## Task 9 — run tests and fix failures

- [x] `node --test tests/core.test.js tests/store.test.js` — 73 tests, 0 failures (Node.js v24.22.1, 2026-11-12).
- [x] Real command and outcome recorded in docs/KIRO-EVIDENCE.md.
