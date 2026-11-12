# Requirements Document

## Introduction

Recall Mansion is a browser-based spaced-repetition study tool for the Kiroween 2026 hackathon. Each note becomes a named "room" in a haunted mansion. Ghost icons with counts represent cards due for review; lit window icons represent rooms with an empty review queue. Users create cloze cards by selecting exact text spans in plain-text notes (captured as UTF-16 code-unit offsets), review them with a two-step confidence-then-rating flow, and persist all state to localStorage with no server, login, or external API required.

The core scheduling contract is deterministic and explicitly documented so users can predict exactly when each card is due. All user content is rendered as text and never interpreted as HTML. The spec covers three complete flows: card creation, card review, and mansion inspection with backup export/import.

The core library (`dist/lib/core.js`) and store (`dist/lib/store.js`) are pure modules with a stable export interface defined in `docs/CORE-CONTRACT.md`, which is the source of truth for state schema, offset semantics, limits, and scheduling arithmetic.

## Glossary

- **App**: The static browser application served from `dist/index.html`.
- **Room**: A named container holding one plain-text note and zero or more cards. Identified by a UUID (≤128 chars). Optional field `isSample: true` marks sample content.
- **Note**: The plain-text body of a Room. Stored as a snapshot (`noteSnapshot`) at card-creation time; subsequent edits to the Room note do not alter existing cards.
- **Card**: A cloze-deletion study item. Contains `noteSnapshot`, `start`, `end` (UTF-16 code-unit offsets into `noteSnapshot`), and scheduling state (`dueAt`, `step`). The answer text is `noteSnapshot.slice(start, end)`.
- **UTF-16 offset**: A character position measured in UTF-16 code units, matching `String.prototype.slice`, `textarea.selectionStart`, and `textarea.selectionEnd`. The card stores `start` (inclusive) and `end` (exclusive) UTF-16 offsets. The answer text is `noteSnapshot.slice(start, end)`.
- **Surrogate pair**: A pair of UTF-16 code units (high surrogate U+D800–U+DBFF followed by low surrogate U+DC00–U+DFFF) that together encode a single Unicode code point above U+FFFF (e.g., emoji). `start` and `end` must not fall between the two code units of a surrogate pair.
- **Phrase**: The answer text of a Card, equal to `noteSnapshot.slice(start, end)`.
- **Cloze**: The presentation of a note with the target span replaced by the placeholder `[___]`.
- **DueAt**: UTC epoch milliseconds at which a Card becomes eligible for review. `dueAt <= now` means the Card is due.
- **Step**: An integer index (0–4) into the scheduling interval table `[1, 3, 7, 14, 30]` days.
- **Review_Event**: An immutable log record: `{id, cardId, at, confidence, rating, previousDueAt, nextDueAt, previousStep, nextStep}`. All IDs are non-empty strings ≤128 chars; all timestamps are finite non-negative numbers.
- **Confidence**: User's self-reported expectation before reveal: one of `unsure`, `maybe`, or `confident`. Does not affect scheduling.
- **Rating**: User's post-reveal self-assessment: one of `again`, `hard`, or `remembered`.
- **Scheduler**: The pure module in `dist/lib/scheduler.js` that computes `nextDueAt` and `nextStep` from a Review_Event. Accepts the review timestamp as an explicit argument; never calls `Date.now()` internally.
- **Store**: The localStorage adapter in `dist/lib/store.js` that serializes, validates, and atomically persists application state. Exposes `load()` and `save(state)` via the object returned by `createStore(storage)`; no other module calls localStorage directly.
- **Backup**: A versioned JSON object produced by `exportBackup` and consumed by `parseBackup`. Must include `schemaVersion: 1` and `exportedAt`.
- **Mansion_View**: The main UI screen displaying all Rooms with their ghost/window state.
- **Overconfident_Miss**: A Review_Event where `confidence === 'confident'` and `rating === 'again'`.

---

## Requirements

### Requirement 1: Room Creation

**User Story:** As a user, I want to create a named room with a plain-text note, so that I can organize my study material by topic.

#### Acceptance Criteria

1. WHEN the user submits a room title and note body, THE App SHALL create a Room with a UUID (≤128 chars), the provided title, the provided note text, and a creation timestamp in UTC epoch milliseconds.
2. THE App SHALL render all room titles and note bodies as plain text, never as HTML.
3. IF the user submits an empty title or an empty note body, THEN THE App SHALL display a validation error message indicating which field is empty and SHALL NOT create a Room.
4. THE App SHALL enforce a maximum room title length of 200 UTF-16 code units and a maximum note body length of 20,000 UTF-16 code units; IF either limit is exceeded, THEN THE App SHALL display a validation error message indicating which field exceeds its limit and SHALL NOT create a Room.
5. WHEN a Room is created, THE Store SHALL persist the new state; IF persistence fails, THE Store SHALL throw and THE App SHALL display a visible error without updating in-memory state.
6. WHEN a Room is successfully created, THE App SHALL display the new Room in the room list immediately without requiring a page reload.
7. IF adding this Room would cause the total room count to exceed 100, THEN THE App SHALL display a validation error and SHALL NOT create the Room.

---

### Requirement 2: Phrase Selection and Card Creation

**User Story:** As a user, I want to select an exact text span in my note to create a cloze card, so that I can be tested on that phrase later.

#### Acceptance Criteria

1. WHEN the user selects a contiguous range of text in the note editor using a pointer, THE App SHALL capture the selection and populate the phrase text field with the selected text and the occurrence-number field with the 1-based index of that occurrence of the phrase in the note.
2. THE App SHALL always display a manual input alternative: a text field for the target phrase and a 1-based occurrence-number field (minimum 1), available regardless of input device. The App SHALL compute the UTF-16 `start` and `end` offsets from the phrase text and occurrence number internally; users are never asked to enter raw numeric offsets.
3. WHEN the user previews a card, THE App SHALL display the Cloze (note text with the target span replaced by `[___]`) and the full note with the target span visually distinguished (by background, border, or underline contrast), paired with an `aria-label` or screen-reader text identifying it as the target phrase.
4. WHEN the user saves a card, THE App SHALL store a snapshot of the note text at that moment (`noteSnapshot`); subsequent edits to the room note SHALL NOT alter any existing card's `noteSnapshot`.
5. WHEN the user saves a card, THE App SHALL assign the card a UUID (≤128 chars), set `dueAt` to the current UTC epoch milliseconds (immediately due), and set `step` to 0.
6. IF the selection is empty (`start === end`), consists entirely of whitespace, or `start` or `end` falls within a UTF-16 surrogate pair, THEN THE App SHALL display a descriptive validation error and SHALL NOT create a Card.
7. IF a card with an identical `start`/`end` range already exists in the same room (checked against the current `noteSnapshot`), THEN THE App SHALL reject the creation with a descriptive error and SHALL NOT create a duplicate Card (no override dialog in MVP).
8. WHEN a Card is created, THE Store SHALL persist the new state; IF persistence fails, THE Store SHALL throw and THE App SHALL display a visible error without updating in-memory state.
9. IF adding this Card would cause the total card count to exceed 3,000, THEN THE App SHALL display a validation error and SHALL NOT create the Card.

---

### Requirement 3: Card Review — Confidence and Recall Rating

**User Story:** As a user, I want to commit a confidence choice before seeing the answer and then self-rate my recall, so that I can track my honest assessment of each review.

#### Acceptance Criteria

1. WHEN the user starts a review session, THE App SHALL present due Cards (where `dueAt <= current UTC epoch milliseconds`) ordered by `dueAt` ascending, then by `id` ascending for ties.
2. WHEN a Card is presented for review, THE App SHALL display the Cloze and SHALL require the user to select a Confidence value (`unsure`, `maybe`, or `confident`) before the reveal button becomes active.
3. WHEN the user activates the reveal, THE App SHALL display the full note text with the target span visually distinguished and SHALL present the three rating options (`again`, `hard`, `remembered`).
4. WHEN the user selects a rating, THE Scheduler SHALL compute the next `dueAt` and next `step`:
   - `again`: `nextDueAt = at + 600_000`; `nextStep = 0`.
   - `hard`: `nextDueAt = at + 86_400_000`; `nextStep = previousStep` (unchanged).
   - `remembered`: `nextDueAt = at + [1,3,7,14,30][previousStep] * 86_400_000`; `nextStep = min(previousStep + 1, 4)`.
5. WHEN the user submits a rating, THE App SHALL create exactly one Review_Event: `{id (new UUID), cardId, at (UTC epoch ms), confidence, rating, previousDueAt, nextDueAt, previousStep, nextStep}`.
6. WHEN the user submits a rating, THE App SHALL update the Card's `dueAt` and `step` and persist both the updated Card and the new Review_Event atomically.
7. IF persistence fails during review submission, THE Store SHALL throw and THE App SHALL display a persistent error without updating in-memory state.
8. IF a Review_Event with the same `id` and identical payload already exists, THE `applyReview` function SHALL return the current state unchanged (idempotent retry); IF the same `id` exists with a conflicting payload, `applyReview` SHALL throw a descriptive error leaving state unchanged.
9. WHEN the last due Card in the queue has been reviewed, THE App SHALL display a session-complete message (cards reviewed count) and a control to return home.
10. IF no Cards are due when the user starts a review session, THE App SHALL display a "nothing due" message and SHALL NOT enter the card-presentation flow.

---

### Requirement 4: Scheduling Contract

**User Story:** As a user, I want a deterministic, documented scheduling rule, so that I can predict when each card will be due.

#### Acceptance Criteria

1. THE App SHALL display the scheduling rules in a panel reachable by a persistent UI control (e.g., help/about button), stating the app is a simple practice aid and not a scientifically validated memory predictor.
2. WHEN a `remembered` rating is submitted, THE Scheduler SHALL compute `nextDueAt = at + intervals[previousStep] * 86_400_000` where `intervals = [1,3,7,14,30]` and `previousStep` is the step at review time, and SHALL set `nextStep = min(previousStep + 1, 4)`.
3. THE Scheduler SHALL cap step at 4; a card at step 4 receiving `remembered` retains step 4 and gets `nextDueAt = at + 30 * 86_400_000`.
4. WHEN a new Card is created, THE App SHALL set `dueAt` to the UTC epoch milliseconds at creation and `step` to 0.
5. THE Scheduler SHALL accept the review timestamp as an explicit argument and SHALL NOT call `Date.now()` internally.
6. WHEN an `again` rating is submitted, THE Scheduler SHALL set `nextDueAt = at + 600_000` and `nextStep = 0`.
7. WHEN a `hard` rating is submitted, THE Scheduler SHALL set `nextDueAt = at + 86_400_000` and `nextStep = previousStep`.
8. IF a review is submitted with an event ID already present in state with a conflicting payload, THE `applyReview` function SHALL throw a descriptive error leaving state unchanged.

---

### Requirement 5: Mansion View and Room State

**User Story:** As a user, I want to see all my rooms at a glance with ghost counts and lit windows, so that I know which rooms need attention.

#### Acceptance Criteria

1. THE Mansion_View SHALL display each Room as a card or button showing: room title, ghost count (number of due Cards), window state (lit (review queue cleared, one or more cards present and all reviewed up to now), unlit/haunted (cards are due), or empty (no cards at all)), and the earliest `dueAt` among due Cards displayed in the user's locale.
2. THE App SHALL pair all ghost and window visual indicators with text labels and numeric counts so that state is communicated without relying on color or icon alone.
3. WHEN a Room has zero Cards, THE Mansion_View SHALL display the Room in an "empty" visual state (distinct from both haunted/due and lit/completed), with ghost count 0 and no due-time value.
4. WHEN the user opens a Room, THE App SHALL display the room note, its Cards sorted by `dueAt` ascending, and the next due time for each Card in the user's locale.
5. THE App SHALL display all timestamps in the user's local time converted from stored UTC epoch milliseconds.
6. WHEN the Mansion_View is displayed and UTC time advances past the `dueAt` of one or more Cards, THE Mansion_View SHALL update affected room ghost counts and window states without a page reload, within 60 seconds of the threshold crossing.
7. IF a Room contains no Cards, THE Mansion_View SHALL display that Room in the empty state with ghost count 0 and no due-time value.

---

### Requirement 6: Overconfident Miss Tracking

**User Story:** As a user, I want to see a list of cards where I was confident before reveal but rated Again, so that I can recognize patterns in my misconceptions.

#### Acceptance Criteria

1. WHEN a Review_Event is persisted with `confidence === 'confident'` and `rating === 'again'`, THE App SHALL add it to the Overconfident_Miss list so the list always reflects the current qualifying Review_Events without a page reload.
2. WHEN the user opens the inspection panel (reachable from Mansion_View), THE App SHALL display the Overconfident_Miss list sorted newest-first showing: room title, target phrase (from `noteSnapshot.slice(start, end)`), and review timestamp in the user's locale.
3. IF the list is empty, THE App SHALL display a message indicating no overconfident misses have been recorded.
4. THE App SHALL present records using neutral language such as "confident before reveal, rated Again" and SHALL NOT use words like "wrong", "failed", or "mistake".

---

### Requirement 7: Backup Export

**User Story:** As a user, I want to export a versioned JSON backup of all my data, so that I can keep a copy or transfer it to another device.

#### Acceptance Criteria

1. WHEN the user triggers an export, THE Store SHALL serialize all Rooms, Cards, and Review_Events into a single Backup JSON string via `exportBackup`.
2. THE Backup SHALL include `schemaVersion` (integer 1), `exportedAt` (UTC epoch ms), and bounded arrays for `rooms`, `cards`, and `reviewEvents`.
3. WHEN export is ready, THE App SHALL offer it as a downloadable JSON file with a filename including the export date formatted as `YYYY-MM-DD`.
4. IF the state contains more than 100 rooms, 3,000 cards, or 20,000 review events, `exportBackup` SHALL throw and THE App SHALL display an error; it SHALL NOT produce a file from oversized or invalid state.
5. WHEN export completes successfully, THE App SHALL produce the downloadable file within 5 seconds for datasets within limits.
6. IF serialization fails, THE App SHALL display an error and SHALL NOT offer a partial or corrupt file.

---

### Requirement 8: Backup Import and Validation

**User Story:** As a user, I want to import a backup file and have it validated before my existing data is replaced, so that corrupt or malicious files cannot destroy my notes.

#### Acceptance Criteria

1. WHEN the user selects a file for import, THE App SHALL reject files larger than 4 MiB before parsing, displaying a descriptive error; existing data SHALL remain unchanged.
2. `parseBackup` SHALL validate the entire JSON payload before returning: `schemaVersion === 1`, `exportedAt` is a finite number, arrays are within limits (100 rooms / 3,000 cards / 20,000 review events), all IDs are non-empty strings ≤128 chars, IDs are unique within each array, all `cardId` references in reviewEvents exist in the cards array, all `roomId` references in cards exist in the rooms array, all timestamps are finite non-negative numbers, all enum values are valid, and all `start`/`end` offsets are non-negative integers with `start < end`.
3. IF any validation check fails, `parseBackup` SHALL throw a descriptive Error and THE App SHALL report it; existing localStorage data SHALL remain unchanged.
4. WHEN validation passes, THE App SHALL show a confirmation dialog summarizing: room count, card count, review event count, and export date; requiring explicit user confirmation before replacing existing data; IF the user cancels, existing data SHALL remain unchanged.
5. WHEN the user confirms the import, THE Store SHALL atomically replace the existing data via `save`; IF `save` throws, THE App SHALL report the error and existing data SHALL remain intact.
6. THE App SHALL treat all imported strings as untrusted text and render them via text nodes or `textContent`, never `innerHTML`.

---

### Requirement 9: Persistence and Storage Integrity

**User Story:** As a user, I want all my data to survive page reloads and to be notified when a save fails, so that I can trust the application's storage.

#### Acceptance Criteria

1. WHEN the App initializes, THE Store SHALL call `load()` to read Rooms, Cards, and Review_Events from localStorage.
2. IF the localStorage key is absent, `load()` SHALL return a fresh empty state without throwing.
3. IF the localStorage key is present but its value is corrupt, inaccessible, or fails validation, `load()` SHALL throw a descriptive Error preserving the original storage value unchanged; THE App SHALL display an error and SHALL NOT overwrite or silently discard the damaged data.
4. `save(state)` SHALL validate then serialize the state and call `setItem` exactly once; IF `setItem` throws, `save` SHALL propagate the error; THE App caller SHALL display a persistent error banner and SHALL NOT update in-memory state.
5. THE Store SHALL expose exactly two operations for direct localStorage access — `load()` and `save(state)` — through the adapter returned by `createStore(storage)`, so no other module calls localStorage directly, making the adapter replaceable for testing.
6. WHEN the Store writes data, it SHALL perform an atomic single-key replace; a failed write leaves the previous serialized state intact.

---

### Requirement 10: Accessibility and Reduced Motion

**User Story:** As a user with accessibility needs, I want the application to support keyboard navigation, readable contrast, and reduced motion, so that I can use it comfortably.

#### Acceptance Criteria

1. THE App SHALL support keyboard navigation for all interactive elements (room creation, card creation, review flow, backup import/export) such that every pointer-reachable action is also reachable by Tab/Shift-Tab/Enter/Space alone, with every focusable element showing a visible focus outline of at least 2 px and ≥3:1 contrast against adjacent background.
2. THE App SHALL meet WCAG 2.1 AA: ≥4.5:1 contrast ratio for normal text, ≥3:1 for large text (18 pt or 14 pt bold), and ≥3:1 for meaningful non-text UI components (ghost badges, window indicators, confidence/rating buttons).
3. WHERE `prefers-reduced-motion: reduce` is active, THE App SHALL suppress all CSS transitions, CSS animations, and JS-driven motion, replacing them with instant state changes.
4. THE App SHALL provide a non-empty `aria-label` or associated `<label>` on every interactive control that lacks visible text.
5. WHEN review state changes (card revealed, next card shown, session ended, error), THE App SHALL update an ARIA live region: `aria-live="polite"` for normal transitions and `aria-live="assertive"` for errors.

---

### Requirement 11: Sample Content

**User Story:** As a new user, I want to load sample content to explore the app, so that I can understand the features without creating my own notes first.

#### Acceptance Criteria

1. THE App SHALL provide a button or menu item with visible text including "Sample" to load sample content, reachable by keyboard without first creating any room or card.
2. WHEN the user loads sample content, THE App SHALL add sample rooms and cards to existing data WITHOUT modifying, overwriting, or deleting existing rooms, cards, or review events.
3. IF loading sample content would cause the total room count to exceed 100 or the total card count to exceed 3,000, THE App SHALL reject the load, display a descriptive error, and leave all existing data unchanged.
4. THE App SHALL mark all sample rooms with `isSample: true` in stored state and SHALL display a visible "Sample" label on every sample room tile and card.

---

### Requirement 12: Security and Content Safety

**User Story:** As a user, I want the application to prevent injected content from executing, so that pasted notes cannot attack my browser.

#### Acceptance Criteria

1. THE App SHALL render all user-supplied text — room titles, note bodies, card phrases, cloze text, review history entries, and content from imported backups — using DOM text nodes or `textContent` exclusively; THE App SHALL NOT assign user-supplied strings to `innerHTML`, `outerHTML`, or any property triggering HTML parsing.
2. THE App SHALL NOT initiate network requests to load images, scripts, or stylesheets from URLs found in user-supplied text, including note bodies, room titles, or imported backup strings.
3. WHEN the user pastes or types content containing HTML tags, script fragments, or URL schemes (e.g., `javascript:`, `data:`), THE App SHALL display those characters as literal visible text without parsing or executing them.
4. WHEN the App renders user-supplied text into an ARIA live region or any accessible name, THE App SHALL use text-node assignment so that markup injected via user content is not interpreted by the accessibility tree.
