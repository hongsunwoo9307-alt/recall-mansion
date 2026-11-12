# UI/core integration contract

Prepared by Codex to coordinate the UI with Kiro's implementation. Kiro owns the implementation and tests of these modules.

## State and records

State: `{schemaVersion: 1, rooms: [], cards: [], reviewEvents: []}`.

- Room: `{id, title, note, createdAt, isSample?}`.
- Card: `{id, roomId, noteSnapshot, start, end, dueAt, step, createdAt}`. `start` and `end` are UTF-16 code-unit offsets, matching textarea.selectionStart/selectionEnd and String.slice. The selected answer is `noteSnapshot.slice(start, end)`. Reject boundaries that split a surrogate pair. Empty/whitespace-only selections are invalid.
- Review event: `{id, cardId, at, confidence, rating, previousDueAt, nextDueAt, previousStep, nextStep}`.
- Confidence: `unsure | maybe | confident`. Rating: `again | hard | remembered`.
- All IDs are nonempty bounded strings; all timestamps are finite nonnegative numbers that can be displayed as valid JavaScript Dates.

## Required exports in dist/lib/core.js

- `createEmptyState()` → a fresh empty state.
- `validateState(state)` → the validated state or throws a descriptive Error. Do not mutate the input.
- `addRoom(state, {id, title, note, now, isSample = false})` → new State.
- `addCard(state, {id, roomId, start, end, now})` → new State. Snapshot the current room note. Reject a duplicate snapshot/range in that room with a descriptive error (no duplicate-confirmation feature in MVP).
- `applyReview(state, {id, cardId, at, confidence, rating})` → new State. Same ID and same payload is an idempotent retry; conflicting payload with an existing event ID is an error. Preserve the prior state on any error.
- `getDueCards(state, now, roomId?)` → Cards ordered by dueAt then ID. Due means dueAt <= now.
- `getOverconfidentMisses(state)` → Review events where confidence is confident and rating is again, newest first. This is a descriptive log, not an objective correctness score.
- `getClozeParts(card)` → `{before, answer, after}`.
- `exportBackup(state, now)` → JSON string with schemaVersion, exportedAt, rooms, cards, reviewEvents.
- `parseBackup(text)` → validated State. Validate the entire payload before returning.

Internal files such as scheduler.js and validation.js are encouraged; core.js should re-export the stable interface above.

## Required exports in dist/lib/store.js

- `createStore(storage, key = 'recall-mansion-v1')` → `{load(), save(state)}`. Storage is the provided localStorage-like adapter, not a global read at module evaluation.
- `load()` → fresh empty State only when the key is absent. Invalid or inaccessible saved data must throw a descriptive Error, preserving the original storage value. Never silently drop records or overwrite damaged data.
- `save(state)` → validate and serialize then call setItem exactly once. Throw on storage failure. The caller only updates UI state after this succeeds.

## Limits and validation

Use consistent limits: title 200 UTF-16 units; note 20,000; IDs 128; rooms 100; cards 3,000; reviewEvents 20,000; imported UTF-8 JSON at most 4 MiB. Enforce record count limits on writes as well as imports. Reject unsupported schema versions, invalid enum values, timestamps, duplicate IDs, broken relationships, invalid ranges, incorrect steps, and malformed history. Do not sanitize by dropping records.

Export must be importable under the same limits. Export should reject invalid/oversized state instead of emitting an unusable backup. Storage quota failure is an expected error and must leave the previous durable state untouched.

## Scheduling

Again: at + 600000, step 0. Hard: at + 86400000, retain step. Remembered: at + [1,3,7,14,30][oldStep] * 86400000, step min(oldStep+1,4). Confidence does not affect scheduling. Pure functions receive time explicitly.

Meaningful tests must include deterministic scheduling, idempotent retries, conflicting reused IDs, malformed/oversized import, storage quota failure, missing key versus corrupt saved state, Unicode surrogate boundaries, and repeated phrase ranges.
