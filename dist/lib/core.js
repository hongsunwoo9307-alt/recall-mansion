/**
 * core.js — pure state mutators, query helpers, and backup I/O.
 *
 * This is the stable public API consumed by dist/app.js and store.js.
 * No DOM access; no Date.now() calls; no global state.
 *
 * Source of truth for the contract: docs/CORE-CONTRACT.md
 */

import {
  LIMITS,
  MAX_IMPORT_BYTES,
  MAX_JS_DATE,
  VALID_CONFIDENCES,
  VALID_RATINGS,
  isValidTimestamp,
  assertId,
  assertTitle,
  assertNote,
  isMidSurrogate,
} from './validation.js';

import { computeNext } from './scheduler.js';

// ---------------------------------------------------------------------------
// createEmptyState
// ---------------------------------------------------------------------------

/**
 * Returns a fresh, empty application state.
 * @returns {{ schemaVersion: 1, rooms: [], cards: [], reviewEvents: [] }}
 */
export function createEmptyState() {
  return { schemaVersion: 1, rooms: [], cards: [], reviewEvents: [] };
}

// ---------------------------------------------------------------------------
// validateState
// ---------------------------------------------------------------------------

/**
 * Validates every field, constraint, and relationship in the state object.
 * Throws a descriptive Error on the first detected problem.
 * Does NOT mutate the input.
 *
 * History-chain replay (append order):
 *   For each card, the review events that reference it are replayed in the order
 *   they appear in state.reviewEvents (insertion order, NOT re-sorted).
 *   At each step the validator checks:
 *     - event.at >= card.createdAt
 *     - event.at >= previous event.at  (non-decreasing; ties are allowed)
 *     - event.previousDueAt === running dueAt
 *     - event.previousStep  === running step
 *     - event.nextDueAt / event.nextStep match computeNext(rating, at, previousStep)
 *   After all events, card.dueAt and card.step must equal the final running values.
 *
 *   Cards with no events must still satisfy dueAt === createdAt and step === 0
 *   (the creation schedule).
 *
 * @param {unknown} state
 * @returns {typeof state}  The same reference when valid.
 */
export function validateState(state) {
  if (state === null || typeof state !== 'object' || Array.isArray(state)) {
    throw new Error('state must be a plain object');
  }

  if (state.schemaVersion !== 1) {
    throw new Error(
      `Unsupported schemaVersion: ${JSON.stringify(state.schemaVersion)}; expected 1`
    );
  }

  // ---- arrays present ----
  for (const arrayKey of ['rooms', 'cards', 'reviewEvents']) {
    if (!Array.isArray(state[arrayKey])) {
      throw new Error(`state.${arrayKey} must be an array`);
    }
  }

  // ---- record count limits ----
  if (state.rooms.length > LIMITS.rooms) {
    throw new Error(
      `rooms array exceeds the ${LIMITS.rooms}-record limit (got ${state.rooms.length})`
    );
  }
  if (state.cards.length > LIMITS.cards) {
    throw new Error(
      `cards array exceeds the ${LIMITS.cards}-record limit (got ${state.cards.length})`
    );
  }
  if (state.reviewEvents.length > LIMITS.reviewEvents) {
    throw new Error(
      `reviewEvents array exceeds the ${LIMITS.reviewEvents}-record limit ` +
      `(got ${state.reviewEvents.length})`
    );
  }

  // ---- room validation ----
  const roomIds = new Set();
  for (let i = 0; i < state.rooms.length; i++) {
    const r   = state.rooms[i];
    const ctx = `rooms[${i}]`;
    _requirePlainObject(r, ctx);
    assertId(r.id,       `${ctx}.id`);
    assertTitle(r.title, `${ctx}.title`);
    assertNote(r.note,   `${ctx}.note`);
    _requireTimestamp(r.createdAt, `${ctx}.createdAt`);
    if (roomIds.has(r.id)) {
      throw new Error(`${ctx}.id "${r.id}" is duplicated`);
    }
    roomIds.add(r.id);
    if ('isSample' in r && typeof r.isSample !== 'boolean') {
      throw new Error(`${ctx}.isSample must be a boolean when present`);
    }
  }

  // ---- card validation ----
  const cardIds = new Set();
  for (let i = 0; i < state.cards.length; i++) {
    const c   = state.cards[i];
    const ctx = `cards[${i}]`;
    _requirePlainObject(c, ctx);
    assertId(c.id,     `${ctx}.id`);
    assertId(c.roomId, `${ctx}.roomId`);
    if (!roomIds.has(c.roomId)) {
      throw new Error(`${ctx}.roomId "${c.roomId}" does not reference a known room`);
    }
    if (typeof c.noteSnapshot !== 'string') {
      throw new Error(`${ctx}.noteSnapshot must be a string`);
    }
    if (c.noteSnapshot.length === 0) {
      throw new Error(`${ctx}.noteSnapshot must not be empty`);
    }
    if (c.noteSnapshot.length > LIMITS.noteCodeUnits) {
      throw new Error(
        `${ctx}.noteSnapshot exceeds the ${LIMITS.noteCodeUnits}-code-unit limit ` +
        `(got ${c.noteSnapshot.length})`
      );
    }
    _requireNonNegInt(c.start, `${ctx}.start`);
    _requireNonNegInt(c.end,   `${ctx}.end`);
    if (c.start >= c.end) {
      throw new Error(
        `${ctx}: start (${c.start}) must be less than end (${c.end})`
      );
    }
    if (c.end > c.noteSnapshot.length) {
      throw new Error(
        `${ctx}: end (${c.end}) exceeds noteSnapshot length (${c.noteSnapshot.length})`
      );
    }
    if (isMidSurrogate(c.noteSnapshot, c.start)) {
      throw new Error(
        `${ctx}.start (${c.start}) falls inside a UTF-16 surrogate pair`
      );
    }
    if (isMidSurrogate(c.noteSnapshot, c.end)) {
      throw new Error(
        `${ctx}.end (${c.end}) falls inside a UTF-16 surrogate pair`
      );
    }
    // Answer must not be whitespace-only.
    if (c.noteSnapshot.slice(c.start, c.end).trim().length === 0) {
      throw new Error(
        `${ctx}: the selected answer [${c.start}, ${c.end}) is whitespace-only`
      );
    }
    _requireTimestamp(c.dueAt,     `${ctx}.dueAt`);
    _requireTimestamp(c.createdAt, `${ctx}.createdAt`);
    if (!Number.isInteger(c.step) || c.step < 0 || c.step > 4) {
      throw new Error(
        `${ctx}.step must be an integer 0–4, got ${JSON.stringify(c.step)}`
      );
    }
    if (cardIds.has(c.id)) {
      throw new Error(`${ctx}.id "${c.id}" is duplicated`);
    }
    cardIds.add(c.id);
  }

  // ---- reviewEvent structural validation ----
  const eventIds = new Set();
  for (let i = 0; i < state.reviewEvents.length; i++) {
    const e   = state.reviewEvents[i];
    const ctx = `reviewEvents[${i}]`;
    _requirePlainObject(e, ctx);
    assertId(e.id,     `${ctx}.id`);
    assertId(e.cardId, `${ctx}.cardId`);
    if (!cardIds.has(e.cardId)) {
      throw new Error(
        `${ctx}.cardId "${e.cardId}" does not reference a known card`
      );
    }
    _requireTimestamp(e.at,            `${ctx}.at`);
    _requireTimestamp(e.previousDueAt, `${ctx}.previousDueAt`);
    _requireTimestamp(e.nextDueAt,     `${ctx}.nextDueAt`);
    if (!VALID_CONFIDENCES.has(e.confidence)) {
      throw new Error(
        `${ctx}.confidence "${e.confidence}" is not valid; ` +
        `expected unsure | maybe | confident`
      );
    }
    if (!VALID_RATINGS.has(e.rating)) {
      throw new Error(
        `${ctx}.rating "${e.rating}" is not valid; expected again | hard | remembered`
      );
    }
    if (!Number.isInteger(e.previousStep) || e.previousStep < 0 || e.previousStep > 4) {
      throw new Error(
        `${ctx}.previousStep must be an integer 0–4, got ${JSON.stringify(e.previousStep)}`
      );
    }
    if (!Number.isInteger(e.nextStep) || e.nextStep < 0 || e.nextStep > 4) {
      throw new Error(
        `${ctx}.nextStep must be an integer 0–4, got ${JSON.stringify(e.nextStep)}`
      );
    }
    if (eventIds.has(e.id)) {
      throw new Error(`${ctx}.id "${e.id}" is duplicated`);
    }
    eventIds.add(e.id);
  }

  // ---- Full per-card history-chain replay (append order) ----
  _validateCardHistoryChains(state);

  return state;
}

/**
 * For each card, replay its review events in the order they appear in
 * state.reviewEvents (not re-sorted — insertion order is the canonical chain).
 *
 * Invariants checked at each step:
 *   1. event.at >= card.createdAt
 *   2. event.at >= previous event.at  (non-decreasing; ties allowed)
 *   3. event.previousDueAt === running dueAt
 *   4. event.previousStep  === running step
 *   5. event.nextDueAt / event.nextStep match computeNext(rating, at, previousStep)
 *
 * After all events:
 *   6. card.dueAt === final running dueAt
 *   7. card.step  === final running step
 *
 * Cards with no events:
 *   8. card.dueAt === card.createdAt  (immediately due at creation)
 *   9. card.step  === 0
 *
 * @param {object} state  Already structurally validated.
 */
function _validateCardHistoryChains(state) {
  // Build card lookup map.
  const cardMap = new Map(state.cards.map(c => [c.id, c]));

  // Collect events per card in array-append order.
  /** @type {Map<string, object[]>} */
  const eventsByCard = new Map();
  for (const e of state.reviewEvents) {
    if (!eventsByCard.has(e.cardId)) eventsByCard.set(e.cardId, []);
    eventsByCard.get(e.cardId).push(e);
  }

  for (const card of state.cards) {
    const events = eventsByCard.get(card.id) ?? [];

    if (events.length === 0) {
      // No-event card: must equal creation schedule.
      if (card.dueAt !== card.createdAt) {
        throw new Error(
          `card "${card.id}" has no review events but dueAt (${card.dueAt}) ` +
          `does not equal createdAt (${card.createdAt}); ` +
          `a new card must be immediately due`
        );
      }
      if (card.step !== 0) {
        throw new Error(
          `card "${card.id}" has no review events but step (${card.step}) is not 0; ` +
          `a new card must start at step 0`
        );
      }
      continue;
    }

    // Running state starts from the creation schedule.
    let runningDueAt = card.createdAt;
    let runningStep  = 0;
    let prevAt       = null; // used for monotonicity check

    for (let ei = 0; ei < events.length; ei++) {
      const e   = events[ei];
      const ectx = `card "${card.id}" reviewEvents[${ei}] id="${e.id}"`;

      // 1. Event must not precede card creation.
      if (e.at < card.createdAt) {
        throw new Error(
          `${ectx}: at (${e.at}) is before card.createdAt (${card.createdAt})`
        );
      }

      // 2. Events must be non-decreasing in at (insertion order).
      if (prevAt !== null && e.at < prevAt) {
        throw new Error(
          `${ectx}: at (${e.at}) is earlier than the preceding event's at (${prevAt}); ` +
          `events must be non-decreasing in time`
        );
      }

      // 3. previousDueAt must match running state.
      if (e.previousDueAt !== runningDueAt) {
        throw new Error(
          `${ectx}: previousDueAt (${e.previousDueAt}) does not match the ` +
          `running dueAt (${runningDueAt}) at that point in the history`
        );
      }

      // 4. previousStep must match running state.
      if (e.previousStep !== runningStep) {
        throw new Error(
          `${ectx}: previousStep (${e.previousStep}) does not match the ` +
          `running step (${runningStep}) at that point in the history`
        );
      }

      // 5. nextDueAt / nextStep must match computeNext.
      const expected = computeNext(e.rating, e.at, e.previousStep);
      if (e.nextDueAt !== expected.nextDueAt) {
        throw new Error(
          `${ectx}: nextDueAt (${e.nextDueAt}) does not match the schedule for ` +
          `rating="${e.rating}", at=${e.at}, previousStep=${e.previousStep} ` +
          `(expected ${expected.nextDueAt})`
        );
      }
      if (e.nextStep !== expected.nextStep) {
        throw new Error(
          `${ectx}: nextStep (${e.nextStep}) does not match the schedule for ` +
          `rating="${e.rating}", at=${e.at}, previousStep=${e.previousStep} ` +
          `(expected ${expected.nextStep})`
        );
      }

      // Advance running state.
      runningDueAt = e.nextDueAt;
      runningStep  = e.nextStep;
      prevAt       = e.at;
    }

    // 6–7. Final card state must match end of replay.
    if (card.dueAt !== runningDueAt) {
      throw new Error(
        `card "${card.id}": dueAt (${card.dueAt}) does not match the last ` +
        `review event's nextDueAt (${runningDueAt})`
      );
    }
    if (card.step !== runningStep) {
      throw new Error(
        `card "${card.id}": step (${card.step}) does not match the last ` +
        `review event's nextStep (${runningStep})`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// addRoom
// ---------------------------------------------------------------------------

/**
 * Returns a new state with the room appended.
 *
 * @param {object} state
 * @param {{ id: string, title: string, note: string, now: number, isSample?: boolean }} opts
 * @returns {object}
 */
export function addRoom(state, { id, title, note, now, isSample = false }) {
  assertId(id);
  assertTitle(title);
  assertNote(note);
  _requireTimestamp(now, 'now');

  if (state.rooms.some(r => r.id === id)) {
    throw new Error(`A room with id "${id}" already exists`);
  }
  if (state.rooms.length >= LIMITS.rooms) {
    throw new Error(
      `Cannot add room: the ${LIMITS.rooms}-room limit has been reached`
    );
  }

  const room = { id, title, note, createdAt: now };
  if (isSample) room.isSample = true;

  return {
    ...state,
    rooms: [...state.rooms, room],
  };
}

// ---------------------------------------------------------------------------
// addCard
// ---------------------------------------------------------------------------

/**
 * Returns a new state with the card appended.
 * Snapshots the current note of the target room.
 *
 * @param {object} state
 * @param {{ id: string, roomId: string, start: number, end: number, now: number }} opts
 * @returns {object}
 */
export function addCard(state, { id, roomId, start, end, now }) {
  assertId(id, 'card id');
  assertId(roomId, 'roomId');
  _requireTimestamp(now, 'now');

  const room = state.rooms.find(r => r.id === roomId);
  if (!room) {
    throw new Error(`addCard: roomId "${roomId}" not found`);
  }

  _requireNonNegInt(start, 'start');
  _requireNonNegInt(end,   'end');

  if (start >= end) {
    throw new Error(`start (${start}) must be less than end (${end})`);
  }

  const noteSnapshot = room.note;

  if (end > noteSnapshot.length) {
    throw new Error(
      `end (${end}) exceeds the note length (${noteSnapshot.length})`
    );
  }

  // Reject empty / whitespace-only answer
  const answer = noteSnapshot.slice(start, end);
  if (answer.trim().length === 0) {
    throw new Error(
      `The selected range [${start}, ${end}) is empty or whitespace-only`
    );
  }

  // Surrogate boundary check
  if (isMidSurrogate(noteSnapshot, start)) {
    throw new Error(
      `start (${start}) falls inside a UTF-16 surrogate pair`
    );
  }
  if (isMidSurrogate(noteSnapshot, end)) {
    throw new Error(
      `end (${end}) falls inside a UTF-16 surrogate pair`
    );
  }

  // Duplicate check: same room, same snapshot, same range
  if (state.cards.some(
    c => c.roomId === roomId &&
         c.noteSnapshot === noteSnapshot &&
         c.start === start &&
         c.end === end
  )) {
    throw new Error(
      `A card for the range [${start}, ${end}) in this room already exists`
    );
  }

  if (state.cards.some(c => c.id === id)) {
    throw new Error(`A card with id "${id}" already exists`);
  }

  if (state.cards.length >= LIMITS.cards) {
    throw new Error(
      `Cannot add card: the ${LIMITS.cards}-card limit has been reached`
    );
  }

  const card = {
    id,
    roomId,
    noteSnapshot,
    start,
    end,
    dueAt: now,     // immediately due
    step: 0,
    createdAt: now,
  };

  return {
    ...state,
    cards: [...state.cards, card],
  };
}

// ---------------------------------------------------------------------------
// applyReview
// ---------------------------------------------------------------------------

/**
 * Returns a new state with the review event appended and the card updated.
 *
 * Same id + same payload → idempotent, returns unchanged state.
 * Same id + different payload → throws, state unchanged.
 *
 * @param {object} state
 * @param {{ id: string, cardId: string, at: number, confidence: string, rating: string }} opts
 * @returns {object}
 */
export function applyReview(state, { id, cardId, at, confidence, rating }) {
  assertId(id, 'review event id');
  assertId(cardId, 'cardId');
  _requireTimestamp(at, 'at');

  if (!VALID_CONFIDENCES.has(confidence)) {
    throw new Error(
      `confidence "${confidence}" is not valid; expected unsure | maybe | confident`
    );
  }
  if (!VALID_RATINGS.has(rating)) {
    throw new Error(
      `rating "${rating}" is not valid; expected again | hard | remembered`
    );
  }

  const card = state.cards.find(c => c.id === cardId);
  if (!card) {
    throw new Error(`applyReview: cardId "${cardId}" not found`);
  }

  // Idempotence / conflict check
  const existing = state.reviewEvents.find(e => e.id === id);
  if (existing) {
    const matches =
      existing.cardId     === cardId     &&
      existing.at         === at         &&
      existing.confidence === confidence &&
      existing.rating     === rating;
    if (matches) {
      return state; // idempotent retry
    }
    throw new Error(
      `A review event with id "${id}" already exists with a different payload ` +
      `(conflicting retry)`
    );
  }

  if (state.reviewEvents.length >= LIMITS.reviewEvents) {
    throw new Error(
      `Cannot add review event: the ${LIMITS.reviewEvents}-record limit has been reached`
    );
  }

  const { nextDueAt, nextStep } = computeNext(rating, at, card.step);

  const event = {
    id,
    cardId,
    at,
    confidence,
    rating,
    previousDueAt: card.dueAt,
    nextDueAt,
    previousStep:  card.step,
    nextStep,
  };

  const updatedCard = { ...card, dueAt: nextDueAt, step: nextStep };

  return {
    ...state,
    cards:        state.cards.map(c => c.id === cardId ? updatedCard : c),
    reviewEvents: [...state.reviewEvents, event],
  };
}

// ---------------------------------------------------------------------------
// getDueCards
// ---------------------------------------------------------------------------

/**
 * Returns cards where dueAt <= now, ordered by dueAt ascending then id ascending.
 * Optionally filtered to a single room.
 *
 * @param {object} state
 * @param {number} now
 * @param {string} [roomId]
 * @returns {object[]}
 */
export function getDueCards(state, now, roomId) {
  let cards = state.cards.filter(c => c.dueAt <= now);
  if (roomId !== undefined) {
    cards = cards.filter(c => c.roomId === roomId);
  }
  return cards.slice().sort((a, b) => {
    if (a.dueAt !== b.dueAt) return a.dueAt - b.dueAt;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// ---------------------------------------------------------------------------
// getOverconfidentMisses
// ---------------------------------------------------------------------------

/**
 * Returns review events where confidence === 'confident' and rating === 'again',
 * sorted newest first (by at descending, then id descending for ties).
 *
 * @param {object} state
 * @returns {object[]}
 */
export function getOverconfidentMisses(state) {
  return state.reviewEvents
    .filter(e => e.confidence === 'confident' && e.rating === 'again')
    .slice()
    .sort((a, b) => {
      if (b.at !== a.at) return b.at - a.at;
      return b.id < a.id ? -1 : b.id > a.id ? 1 : 0;
    });
}

// ---------------------------------------------------------------------------
// getClozeParts
// ---------------------------------------------------------------------------

/**
 * Splits a card's noteSnapshot at the stored offsets.
 *
 * @param {object} card
 * @returns {{ before: string, answer: string, after: string }}
 */
export function getClozeParts(card) {
  const { noteSnapshot, start, end } = card;
  return {
    before: noteSnapshot.slice(0, start),
    answer: noteSnapshot.slice(start, end),
    after:  noteSnapshot.slice(end),
  };
}

// ---------------------------------------------------------------------------
// exportBackup
// ---------------------------------------------------------------------------

/**
 * Serialises the state to a JSON string with exportedAt and schemaVersion.
 *
 * Validates state first (throws on invalid/oversized state).
 * Also checks that the resulting UTF-8 JSON stays within the 4 MiB import limit
 * so the backup is guaranteed to be importable.
 *
 * @param {object} state
 * @param {number} now  UTC epoch ms for the exportedAt field.
 * @returns {string}
 */
export function exportBackup(state, now) {
  validateState(state);
  _requireTimestamp(now, 'now');

  const backup = {
    schemaVersion: state.schemaVersion,
    exportedAt:    now,
    rooms:         state.rooms,
    cards:         state.cards,
    reviewEvents:  state.reviewEvents,
  };

  const json = JSON.stringify(backup);

  // Verify the UTF-8 byte length fits within the import limit.
  const byteLength = new TextEncoder().encode(json).length;
  if (byteLength > MAX_IMPORT_BYTES) {
    throw new Error(
      `Export would produce a ${byteLength}-byte file, which exceeds the ` +
      `${MAX_IMPORT_BYTES}-byte (4 MiB) import limit; reduce your data before exporting`
    );
  }

  return json;
}

// ---------------------------------------------------------------------------
// parseBackup
// ---------------------------------------------------------------------------

/**
 * Parses and fully validates a backup JSON string.
 * Returns a valid state object on success; throws a descriptive Error otherwise.
 * Does not mutate any existing state.
 *
 * @param {string} text  The raw JSON string from a backup file.
 * @returns {{ schemaVersion: 1, rooms: object[], cards: object[], reviewEvents: object[] }}
 */
export function parseBackup(text) {
  if (typeof text !== 'string') {
    throw new Error('parseBackup: input must be a string');
  }

  // Byte-size guard (UTF-8 encoding).
  const byteLength = new TextEncoder().encode(text).length;
  if (byteLength > MAX_IMPORT_BYTES) {
    throw new Error(
      `Backup is ${byteLength} bytes, which exceeds the ${MAX_IMPORT_BYTES}-byte ` +
      `(4 MiB) limit`
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`Backup is not valid JSON: ${e.message}`);
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Backup root must be a JSON object');
  }

  // exportedAt presence/validity (backup-specific field, not in state schema)
  if (!('exportedAt' in parsed)) {
    throw new Error('Backup is missing the exportedAt field');
  }
  if (!isValidTimestamp(parsed.exportedAt)) {
    throw new Error(
      `Backup exportedAt must be a finite non-negative number within the ` +
      `JavaScript Date range, got ${JSON.stringify(parsed.exportedAt)}`
    );
  }

  // Extract the canonical state subset and run full validation.
  const state = {
    schemaVersion: parsed.schemaVersion,
    rooms:         parsed.rooms,
    cards:         parsed.cards,
    reviewEvents:  parsed.reviewEvents,
  };

  validateState(state);
  return state;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function _requirePlainObject(v, label) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    throw new Error(`${label} must be a plain object`);
  }
}

function _requireTimestamp(v, label) {
  if (!isValidTimestamp(v)) {
    throw new Error(
      `${label} must be a finite non-negative number within the JavaScript Date ` +
      `range (0–${MAX_JS_DATE}), got ${JSON.stringify(v)}`
    );
  }
}

function _requireNonNegInt(v, label) {
  if (!Number.isInteger(v) || v < 0) {
    throw new Error(`${label} must be a non-negative integer, got ${JSON.stringify(v)}`);
  }
}
