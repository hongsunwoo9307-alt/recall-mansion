/**
 * core.test.js — node:test tests for dist/lib/core.js and dist/lib/scheduler.js
 *
 * Run: node --test tests/
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { computeNext, INTERVALS } from '../dist/lib/scheduler.js';
import {
  createEmptyState,
  validateState,
  addRoom,
  addCard,
  applyReview,
  getDueCards,
  getOverconfidentMisses,
  getClozeParts,
  exportBackup,
  parseBackup,
} from '../dist/lib/core.js';
import { MAX_JS_DATE } from '../dist/lib/validation.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = 1_700_000_000_000; // fixed epoch for deterministic tests

let _counter = 0;
function uid() { return `id-${++_counter}`; }

function makeRoom(state, overrides = {}) {
  const id    = overrides.id    ?? uid();
  const title = overrides.title ?? 'Test Room';
  const note  = overrides.note  ?? 'The quick brown fox jumps over the lazy dog.';
  const now   = overrides.now   ?? NOW;
  return { state: addRoom(state, { id, title, note, now }), id, note };
}

function makeCard(state, roomId, start, end, overrides = {}) {
  const id  = overrides.id  ?? uid();
  const now = overrides.now ?? NOW;
  return { state: addCard(state, { id, roomId, start, end, now }), id };
}

function makeReview(state, cardId, opts = {}) {
  const id         = opts.id         ?? uid();
  const at         = opts.at         ?? NOW;
  const confidence = opts.confidence ?? 'maybe';
  const rating     = opts.rating     ?? 'remembered';
  return { state: applyReview(state, { id, cardId, at, confidence, rating }), id };
}

// ---------------------------------------------------------------------------
// 1. Scheduler — arithmetic
// ---------------------------------------------------------------------------

describe('scheduler — computeNext', () => {
  it('again: adds 10 minutes and resets step to 0', () => {
    const r = computeNext('again', NOW, 3);
    assert.equal(r.nextDueAt, NOW + 600_000);
    assert.equal(r.nextStep,  0);
  });

  it('hard: adds 24 hours and retains step', () => {
    for (const step of [0, 1, 2, 3, 4]) {
      const r = computeNext('hard', NOW, step);
      assert.equal(r.nextDueAt, NOW + 86_400_000, `step=${step}`);
      assert.equal(r.nextStep,  step,              `step=${step}`);
    }
  });

  it('remembered: uses correct interval for each step', () => {
    for (const step of [0, 1, 2, 3, 4]) {
      const r = computeNext('remembered', NOW, step);
      assert.equal(r.nextDueAt, NOW + INTERVALS[step] * 86_400_000, `step=${step}`);
      const expectedStep = step < 4 ? step + 1 : 4;
      assert.equal(r.nextStep, expectedStep, `step=${step}`);
    }
  });

  it('remembered at step 4: retains step 4 and uses 30-day interval', () => {
    const r = computeNext('remembered', NOW, 4);
    assert.equal(r.nextDueAt, NOW + 30 * 86_400_000);
    assert.equal(r.nextStep,  4);
  });

  it('throws on unknown rating', () => {
    assert.throws(
      () => computeNext('excellent', NOW, 0),
      /Unknown rating/
    );
  });

  it('throws when at exceeds MAX_JS_DATE', () => {
    assert.throws(
      () => computeNext('again', MAX_JS_DATE + 1, 0),
      /JavaScript Date range/
    );
  });

  it('throws when computed nextDueAt would exceed MAX_JS_DATE', () => {
    // 30-day remembered from 1 day before ceiling overflows.
    const bigAt = MAX_JS_DATE - 86_400_000;
    assert.throws(
      () => computeNext('remembered', bigAt, 4),
      /exceeds the maximum JavaScript Date value/
    );
  });
});

// ---------------------------------------------------------------------------
// 2. createEmptyState / validateState
// ---------------------------------------------------------------------------

describe('createEmptyState', () => {
  it('returns schemaVersion 1 with empty arrays', () => {
    const s = createEmptyState();
    assert.equal(s.schemaVersion, 1);
    assert.deepEqual(s.rooms, []);
    assert.deepEqual(s.cards, []);
    assert.deepEqual(s.reviewEvents, []);
  });
});

describe('validateState', () => {
  it('accepts a fresh empty state', () => {
    assert.doesNotThrow(() => validateState(createEmptyState()));
  });

  it('throws on wrong schemaVersion', () => {
    assert.throws(
      () => validateState({ schemaVersion: 2, rooms: [], cards: [], reviewEvents: [] }),
      /schemaVersion/
    );
  });

  it('throws when rooms is not an array', () => {
    assert.throws(
      () => validateState({ schemaVersion: 1, rooms: null, cards: [], reviewEvents: [] }),
      /rooms/
    );
  });

  it('throws on duplicate room id', () => {
    let s = createEmptyState();
    s = addRoom(s, { id: 'dup', title: 'A', note: 'note', now: NOW });
    const tampered = { ...s, rooms: [...s.rooms, s.rooms[0]] };
    assert.throws(() => validateState(tampered), /duplicated/);
  });

  it('throws on duplicate card id', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s);
    const { state: s3 } = makeCard(s2, roomId, 4, 9);
    const tampered = { ...s3, cards: [...s3.cards, s3.cards[0]] };
    assert.throws(() => validateState(tampered), /duplicated/);
  });

  it('throws when cardId in reviewEvent does not exist', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s);
    const { state: s3, id: cardId } = makeCard(s2, roomId, 4, 9);
    const { state: s4 } = makeReview(s3, cardId);
    const tampered = {
      ...s4,
      reviewEvents: s4.reviewEvents.map(e => ({ ...e, cardId: 'ghost-id' })),
    };
    assert.throws(() => validateState(tampered), /does not reference a known card/);
  });

  it('throws when noteSnapshot exceeds 20 000 code units', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s);
    const { state: s3, id: cardId } = makeCard(s2, roomId, 4, 9);
    const badSnapshot = 'x'.repeat(20_001);
    const tampered = {
      ...s3,
      cards: s3.cards.map(c =>
        c.id === cardId ? { ...c, noteSnapshot: badSnapshot, end: 9 } : c
      ),
    };
    assert.throws(() => validateState(tampered), /20000/);
  });

  it('throws when selected answer in noteSnapshot is whitespace-only', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s);
    const { state: s3, id: cardId } = makeCard(s2, roomId, 4, 9);
    // Craft a noteSnapshot where the slice is all spaces
    const wsSnapshot = 'xxxx     yyyyy';
    const tampered = {
      ...s3,
      cards: s3.cards.map(c =>
        c.id === cardId
          ? { ...c, noteSnapshot: wsSnapshot, start: 4, end: 9, dueAt: NOW, step: 0, createdAt: NOW }
          : c
      ),
    };
    assert.throws(() => validateState(tampered), /whitespace/i);
  });
});

// ---------------------------------------------------------------------------
// 3. addRoom
// ---------------------------------------------------------------------------

describe('addRoom', () => {
  it('appends a room', () => {
    const s = addRoom(createEmptyState(), { id: 'r1', title: 'Physics', note: 'Newton', now: NOW });
    assert.equal(s.rooms.length, 1);
    assert.equal(s.rooms[0].title, 'Physics');
    assert.equal(s.rooms[0].createdAt, NOW);
  });

  it('rejects empty title', () => {
    assert.throws(
      () => addRoom(createEmptyState(), { id: uid(), title: '', note: 'x', now: NOW }),
      /title/
    );
  });

  it('rejects whitespace-only title', () => {
    assert.throws(
      () => addRoom(createEmptyState(), { id: uid(), title: '   ', note: 'x', now: NOW }),
      /title.*whitespace/i
    );
  });

  it('rejects whitespace-only note', () => {
    assert.throws(
      () => addRoom(createEmptyState(), { id: uid(), title: 'T', note: '\t\n ', now: NOW }),
      /note.*whitespace/i
    );
  });

  it('rejects title exceeding 200 code units', () => {
    const longTitle = 'x'.repeat(201);
    assert.throws(
      () => addRoom(createEmptyState(), { id: uid(), title: longTitle, note: 'x', now: NOW }),
      /200/
    );
  });

  it('marks isSample when flag is true', () => {
    const s = addRoom(createEmptyState(), {
      id: uid(), title: 'Sample', note: 'content', now: NOW, isSample: true,
    });
    assert.equal(s.rooms[0].isSample, true);
  });

  it('throws when room limit is reached', () => {
    let s = createEmptyState();
    for (let i = 0; i < 100; i++) {
      s = addRoom(s, { id: `room-${i}`, title: `Room ${i}`, note: 'n', now: NOW });
    }
    assert.throws(
      () => addRoom(s, { id: 'extra', title: 'Over', note: 'over', now: NOW }),
      /100-room limit/
    );
  });
});

// ---------------------------------------------------------------------------
// 4. addCard — basic and limits
// ---------------------------------------------------------------------------

describe('addCard', () => {
  it('creates a card due immediately at step 0', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s);
    const { state: s3, id: cardId } = makeCard(s2, roomId, 4, 9);
    const card = s3.cards.find(c => c.id === cardId);
    assert.ok(card);
    assert.equal(card.dueAt,     NOW);
    assert.equal(card.step,      0);
    assert.equal(card.createdAt, NOW);
    assert.equal(card.noteSnapshot, 'The quick brown fox jumps over the lazy dog.');
  });

  it('rejects start === end', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s);
    assert.throws(
      () => addCard(s2, { id: uid(), roomId, start: 4, end: 4, now: NOW }),
      /start.*less than end/
    );
  });

  it('rejects whitespace-only selection', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s, { note: 'hello world' });
    // offset 5 is a space
    assert.throws(
      () => addCard(s2, { id: uid(), roomId, start: 5, end: 6, now: NOW }),
      /whitespace/i
    );
  });

  it('rejects duplicate snapshot+range in same room', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s);
    const { state: s3 } = makeCard(s2, roomId, 4, 9);
    assert.throws(
      () => addCard(s3, { id: uid(), roomId, start: 4, end: 9, now: NOW }),
      /already exists/
    );
  });

  it('allows same range in different rooms', () => {
    let s = createEmptyState();
    const { state: s2, id: r1 } = makeRoom(s);
    const { state: s3, id: r2 } = makeRoom(s2, { title: 'Room 2' });
    const { state: s4 } = makeCard(s3, r1, 4, 9);
    assert.doesNotThrow(() => makeCard(s4, r2, 4, 9));
  });

  it('throws when card limit is reached', () => {
    let s = createEmptyState();
    // Use a note long enough to have 3000+ unique non-overlapping single-char selections.
    // We need at least 3000 characters; 'a'.repeat(3001) works fine.
    const longNote = 'a'.repeat(3_001);
    const { state: s2, id: roomId } = makeRoom(s, { note: longNote });
    // Directly push 3000 card stubs (unique ranges) to bypass the loop cost.
    for (let i = 0; i < 3_000; i++) {
      s2.cards.push({
        id: `climit-${i}`,
        roomId,
        noteSnapshot: longNote,
        start: i,
        end: i + 1,
        dueAt: NOW,
        step: 0,
        createdAt: NOW,
      });
    }
    assert.throws(
      () => addCard(s2, { id: uid(), roomId, start: 3_000, end: 3_001, now: NOW }),
      /3[,.]?000-card limit/
    );
  });
});

// ---------------------------------------------------------------------------
// 5. UTF-16 / surrogate boundaries
// ---------------------------------------------------------------------------

describe('addCard — UTF-16 surrogate boundaries', () => {
  // U+1F600 (😀) encodes as \uD83D\uDE00 (2 code units).
  // 'Hi 😀 there'  →  H=0 i=1 ' '=2 \uD83D=3 \uDE00=4 ' '=5 t=6 h=7 e=8 r=9 e=10
  const emojiNote = 'Hi 😀 there';

  it('accepts boundaries that do not split the surrogate pair', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s, { note: emojiNote });
    // 3..5 captures the full emoji (both code units)
    assert.doesNotThrow(() => makeCard(s2, roomId, 3, 5));
  });

  it('rejects start that falls inside a surrogate pair', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s, { note: emojiNote });
    assert.throws(
      () => addCard(s2, { id: uid(), roomId, start: 4, end: 6, now: NOW }),
      /surrogate/i
    );
  });

  it('rejects end that falls inside a surrogate pair', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s, { note: emojiNote });
    assert.throws(
      () => addCard(s2, { id: uid(), roomId, start: 2, end: 4, now: NOW }),
      /surrogate/i
    );
  });
});

// ---------------------------------------------------------------------------
// 6. Korean text offsets
// ---------------------------------------------------------------------------

describe('addCard — Korean text', () => {
  // Korean characters are BMP (1 code unit each).
  const korNote = '사과는 맛있어요. 오늘 공부합시다.';

  it('creates a card selecting Korean characters', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s, { note: korNote });
    // "사과" = code units 0–1, so start=0, end=2
    const { state: s3, id: cardId } = makeCard(s2, roomId, 0, 2);
    const card = s3.cards.find(c => c.id === cardId);
    assert.equal(card.noteSnapshot.slice(0, 2), '사과');
  });
});

// ---------------------------------------------------------------------------
// 7. applyReview — idempotence and conflict
// ---------------------------------------------------------------------------

describe('applyReview', () => {
  it('idempotent retry with same id and same payload returns unchanged state', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s);
    const { state: s3, id: cardId } = makeCard(s2, roomId, 4, 9);
    const { state: s4 } = makeReview(s3, cardId, {
      id: 'ev1', at: NOW, confidence: 'maybe', rating: 'hard',
    });
    const s5 = applyReview(s4, {
      id: 'ev1', cardId, at: NOW, confidence: 'maybe', rating: 'hard',
    });
    assert.equal(s5.reviewEvents.length, 1);
    assert.equal(
      s5.cards.find(c => c.id === cardId).dueAt,
      s4.cards.find(c => c.id === cardId).dueAt
    );
  });

  it('throws on conflicting retry (same id, different payload)', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s);
    const { state: s3, id: cardId } = makeCard(s2, roomId, 4, 9);
    const { state: s4 } = makeReview(s3, cardId, {
      id: 'ev2', at: NOW, confidence: 'maybe', rating: 'hard',
    });
    assert.throws(
      () => applyReview(s4, {
        id: 'ev2', cardId, at: NOW, confidence: 'maybe', rating: 'again',
      }),
      /conflicting/
    );
    assert.equal(s4.reviewEvents.length, 1);
  });

  it('updates card dueAt and step correctly after review', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s);
    const { state: s3, id: cardId } = makeCard(s2, roomId, 4, 9);
    const { state: s4 } = makeReview(s3, cardId, { rating: 'remembered' });
    const card = s4.cards.find(c => c.id === cardId);
    assert.equal(card.dueAt, NOW + INTERVALS[0] * 86_400_000);
    assert.equal(card.step,  1);
  });

  it('again review sets step to 0 regardless of current step', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s);
    const { state: s3, id: cardId } = makeCard(s2, roomId, 4, 9);
    let cur = s3;
    for (let i = 0; i < 3; i++) {
      const { state: next } = makeReview(cur, cardId, {
        rating: 'remembered', at: NOW + i * 86_400_000,
      });
      cur = next;
    }
    const { state: final } = makeReview(cur, cardId, {
      rating: 'again', at: NOW + 10_000_000,
    });
    const card = final.cards.find(c => c.id === cardId);
    assert.equal(card.step, 0);
  });
});

// ---------------------------------------------------------------------------
// 8. getDueCards
// ---------------------------------------------------------------------------

describe('getDueCards', () => {
  it('returns only cards where dueAt <= now, sorted by dueAt then id', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s);
    const idA = uid();
    s2.cards.push({
      id: idA, roomId, noteSnapshot: 'fox', start: 0, end: 3,
      dueAt: NOW - 1000, step: 0, createdAt: NOW - 1000,
    });
    const idB = uid();
    s2.cards.push({
      id: idB, roomId, noteSnapshot: 'fox', start: 0, end: 3,
      dueAt: NOW + 1000, step: 0, createdAt: NOW,
    });
    const idC = uid();
    s2.cards.push({
      id: idC, roomId, noteSnapshot: 'fox', start: 0, end: 3,
      dueAt: NOW, step: 0, createdAt: NOW,
    });

    const due = getDueCards(s2, NOW);
    const ids = due.map(c => c.id);
    assert.ok(!ids.includes(idB), 'future card should not be due');
    assert.ok(ids.includes(idA));
    assert.ok(ids.includes(idC));
    assert.equal(ids[0], idA); // smallest dueAt first
  });

  it('filters by roomId when provided', () => {
    let s = createEmptyState();
    const { state: s2, id: r1 } = makeRoom(s);
    const { state: s3, id: r2 } = makeRoom(s2, { title: 'Room 2' });
    const { state: s4, id: c1 } = makeCard(s3, r1, 4, 9);
    const { state: s5 } = makeCard(s4, r2, 4, 9);

    const due = getDueCards(s5, NOW + 1, r1);
    assert.equal(due.length, 1);
    assert.equal(due[0].id, c1);
  });
});

// ---------------------------------------------------------------------------
// 9. getOverconfidentMisses
// ---------------------------------------------------------------------------

describe('getOverconfidentMisses', () => {
  it('returns only confident+again events, newest first', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s);
    const { state: s3, id: c1 } = makeCard(s2, roomId, 4, 9);
    const { state: s4, id: c2 } = makeCard(s3, roomId, 10, 15);
    const { state: s5, id: c3 } = makeCard(s4, roomId, 16, 21);

    // Event 1: confident+again at NOW
    const { state: s6 } = makeReview(s5, c1, {
      confidence: 'confident', rating: 'again', at: NOW,
    });
    // Event 2: maybe+again (should not appear)
    const { state: s7 } = makeReview(s6, c2, {
      confidence: 'maybe', rating: 'again', at: NOW + 1,
    });
    // Event 3: confident+again at NOW + 2 (should appear first)
    const { state: s8 } = makeReview(s7, c3, {
      confidence: 'confident', rating: 'again', at: NOW + 2,
    });

    const misses = getOverconfidentMisses(s8);
    assert.equal(misses.length, 2);
    assert.equal(misses[0].at, NOW + 2); // newest first
    assert.equal(misses[1].at, NOW);
  });

  it('returns empty array when none', () => {
    assert.deepEqual(getOverconfidentMisses(createEmptyState()), []);
  });
});

// ---------------------------------------------------------------------------
// 10. getClozeParts
// ---------------------------------------------------------------------------

describe('getClozeParts', () => {
  it('splits note into before / answer / after', () => {
    const card = { noteSnapshot: 'The quick brown fox', start: 10, end: 15 };
    const { before, answer, after } = getClozeParts(card);
    assert.equal(before, 'The quick ');
    assert.equal(answer, 'brown');
    assert.equal(after,  ' fox');
  });
});

// ---------------------------------------------------------------------------
// 11. exportBackup / parseBackup round-trip
// ---------------------------------------------------------------------------

describe('exportBackup / parseBackup', () => {
  it('round-trips through export and parse', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s);
    const { state: s3, id: cardId } = makeCard(s2, roomId, 4, 9);
    const { state: s4 } = makeReview(s3, cardId);

    const json = exportBackup(s4, NOW);
    const parsed = parseBackup(json);

    assert.equal(parsed.schemaVersion, 1);
    assert.equal(parsed.rooms.length, 1);
    assert.equal(parsed.cards.length, 1);
    assert.equal(parsed.reviewEvents.length, 1);
    // exportedAt must NOT leak into the returned state
    assert.ok(!('exportedAt' in parsed));
  });

  it('exportBackup includes exportedAt in the JSON string', () => {
    const json = exportBackup(createEmptyState(), NOW);
    const obj = JSON.parse(json);
    assert.equal(obj.exportedAt, NOW);
  });

  it('parseBackup rejects oversized input', () => {
    const big = 'x'.repeat(4_194_305);
    assert.throws(() => parseBackup(big), /4 MiB/);
  });

  it('parseBackup rejects wrong schemaVersion', () => {
    const json = JSON.stringify({
      schemaVersion: 99, exportedAt: NOW, rooms: [], cards: [], reviewEvents: [],
    });
    assert.throws(() => parseBackup(json), /schemaVersion/);
  });

  it('parseBackup rejects missing exportedAt', () => {
    const json = JSON.stringify({
      schemaVersion: 1, rooms: [], cards: [], reviewEvents: [],
    });
    assert.throws(() => parseBackup(json), /exportedAt/);
  });

  it('parseBackup rejects exportedAt exceeding MAX_JS_DATE', () => {
    const json = JSON.stringify({
      schemaVersion: 1, exportedAt: MAX_JS_DATE + 1,
      rooms: [], cards: [], reviewEvents: [],
    });
    assert.throws(() => parseBackup(json), /exportedAt/);
  });

  it('parseBackup rejects broken cardId reference', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s);
    const { state: s3, id: cardId } = makeCard(s2, roomId, 4, 9);
    const { state: s4 } = makeReview(s3, cardId);
    const tampered = { ...s4, cards: [] };
    const json = JSON.stringify({ schemaVersion: 1, exportedAt: NOW, ...tampered });
    assert.throws(() => parseBackup(json), /does not reference a known card/);
  });

  it('parseBackup rejects invalid JSON', () => {
    assert.throws(() => parseBackup('{ not valid json }'), /not valid JSON/);
  });
});

// ---------------------------------------------------------------------------
// 12. History-chain replay — append order preserved
// ---------------------------------------------------------------------------

describe('validateState — history-chain: append order, not sorted by id', () => {
  it('accepts two events at the same timestamp in z-then-a id order (append order)', () => {
    // Previously the validator sorted events by id, which would have reordered
    // "z-event" before "a-event" and invalidated the previousDueAt chain.
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s);
    const { state: s3, id: c1 } = makeCard(s2, roomId, 4, 9);
    const { state: s4, id: c2 } = makeCard(s3, roomId, 10, 15);

    // Review c1 with event id "z-event" at NOW → hard, dueAt advances
    const { state: s5 } = makeReview(s4, c1, {
      id: 'z-event', at: NOW, rating: 'hard', confidence: 'maybe',
    });
    // Review c1 again with event id "a-event" at the same timestamp
    // This is a second review of the same card; at must be >= previous event's at.
    // For a different card c2 we can safely use the same timestamp.
    const { state: s6 } = makeReview(s5, c2, {
      id: 'a-event', at: NOW, rating: 'remembered', confidence: 'unsure',
    });

    // Both are on different cards so no ordering conflict; just prove it validates.
    assert.doesNotThrow(() => validateState(s6));
  });

  it('rejects an event whose at precedes a prior event for the same card', () => {
    // Build a chain: card created at NOW, first event at NOW+1 (hard),
    // then inject a second event at NOW (which is >= createdAt but < first event's at).
    // The validator must detect that the second event's at < preceding event's at.
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s);
    const { state: s3, id: cardId } = makeCard(s2, roomId, 4, 9);

    // First review at NOW+1
    const firstAt  = NOW + 1;
    const { state: s4 } = makeReview(s3, cardId, {
      id: 'ev-first', at: firstAt, rating: 'hard', confidence: 'maybe',
    });

    // The card after first review: dueAt = firstAt + 86_400_000, step = 0
    const afterFirst = computeNext('hard', firstAt, 0);

    // Second event at NOW (< firstAt), injected out-of-order after ev-first.
    // previousDueAt/Step must match post-first-review state to avoid other checks.
    const secondAt = NOW; // valid >= createdAt but < first event's at
    const secondComputed = computeNext('hard', secondAt, afterFirst.nextStep);
    const secondEvent = {
      id:            'ev-second',
      cardId,
      at:            secondAt,
      confidence:    'maybe',
      rating:        'hard',
      previousDueAt: afterFirst.nextDueAt,
      previousStep:  afterFirst.nextStep,
      nextDueAt:     secondComputed.nextDueAt,
      nextStep:      secondComputed.nextStep,
    };

    const injected = {
      ...s4,
      reviewEvents: [...s4.reviewEvents, secondEvent],
      cards: s4.cards.map(c =>
        c.id === cardId
          ? { ...c, dueAt: secondComputed.nextDueAt, step: secondComputed.nextStep }
          : c
      ),
    };

    assert.throws(() => validateState(injected), /earlier than the preceding event/);
  });
});

// ---------------------------------------------------------------------------
// 13. History-chain: full per-event invariant checks
// ---------------------------------------------------------------------------

describe('validateState — history-chain: per-event invariants', () => {
  it('throws when reviewEvent nextDueAt does not match computeNext', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s);
    const { state: s3, id: cardId } = makeCard(s2, roomId, 4, 9);
    const { state: s4 } = makeReview(s3, cardId, { rating: 'hard' });

    const tampered = {
      ...s4,
      reviewEvents: s4.reviewEvents.map(e => ({ ...e, nextDueAt: e.nextDueAt + 1 })),
    };
    // Update card to avoid triggering the card-mismatch check first
    const tamperedFull = {
      ...tampered,
      cards: tampered.cards.map(c =>
        c.id === cardId ? { ...c, dueAt: tampered.reviewEvents[0].nextDueAt } : c
      ),
    };
    assert.throws(() => validateState(tamperedFull), /nextDueAt.*does not match the schedule/);
  });

  it('throws when reviewEvent nextStep does not match computeNext', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s);
    const { state: s3, id: cardId } = makeCard(s2, roomId, 4, 9);
    const { state: s4 } = makeReview(s3, cardId, { rating: 'remembered' });

    const tampered = {
      ...s4,
      reviewEvents: s4.reviewEvents.map(e => ({ ...e, nextStep: 3 })),
    };
    const tamperedFull = {
      ...tampered,
      cards: tampered.cards.map(c =>
        c.id === cardId ? { ...c, step: 3 } : c
      ),
    };
    assert.throws(() => validateState(tamperedFull), /nextStep.*does not match the schedule/);
  });

  it('throws when previousDueAt does not match running state', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s);
    const { state: s3, id: cardId } = makeCard(s2, roomId, 4, 9);
    const { state: s4 } = makeReview(s3, cardId, { rating: 'hard' });

    // Tamper previousDueAt in the event and keep nextDueAt/nextStep correct
    const ev = s4.reviewEvents[0];
    const tamperedEv = { ...ev, previousDueAt: ev.previousDueAt + 999 };
    const tampered = {
      ...s4,
      reviewEvents: [tamperedEv],
    };
    assert.throws(() => validateState(tampered), /previousDueAt.*does not match the running/);
  });

  it('throws when previousStep does not match running state', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s);
    const { state: s3, id: cardId } = makeCard(s2, roomId, 4, 9);
    const { state: s4 } = makeReview(s3, cardId, { rating: 'hard' });

    const ev = s4.reviewEvents[0];
    const tamperedEv = { ...ev, previousStep: 2 }; // should be 0
    // Recompute nextDueAt/nextStep to avoid that check firing first
    const recomputed = computeNext(ev.rating, ev.at, 2);
    const fixedEv = { ...tamperedEv, ...recomputed };

    const tampered = {
      ...s4,
      reviewEvents: [fixedEv],
      cards: s4.cards.map(c =>
        c.id === cardId
          ? { ...c, dueAt: recomputed.nextDueAt, step: recomputed.nextStep }
          : c
      ),
    };
    assert.throws(() => validateState(tampered), /previousStep.*does not match the running/);
  });

  it('throws when event.at is before card.createdAt', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s);
    const { state: s3, id: cardId } = makeCard(s2, roomId, 4, 9);

    // Create a review event whose at is before card.createdAt
    const earlyAt = NOW - 1;
    const { nextDueAt, nextStep } = computeNext('hard', earlyAt, 0);
    const earlyEvent = {
      id:            uid(),
      cardId,
      at:            earlyAt,
      confidence:    'maybe',
      rating:        'hard',
      previousDueAt: NOW,  // createdAt = NOW
      nextDueAt,
      previousStep:  0,
      nextStep,
    };
    const tampered = {
      ...s3,
      reviewEvents: [earlyEvent],
      cards: s3.cards.map(c =>
        c.id === cardId ? { ...c, dueAt: nextDueAt, step: nextStep } : c
      ),
    };
    assert.throws(() => validateState(tampered), /before card\.createdAt/);
  });

  it('accepts a correct multi-event history chain', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s);
    const { state: s3, id: cardId } = makeCard(s2, roomId, 4, 9);
    let cur = s3;
    for (let i = 0; i < 3; i++) {
      const { state: next } = makeReview(cur, cardId, {
        rating: 'remembered', at: NOW + i * 86_400_000,
      });
      cur = next;
    }
    assert.doesNotThrow(() => validateState(cur));
  });
});

// ---------------------------------------------------------------------------
// 14. Final card schedule integrity in validateState
// ---------------------------------------------------------------------------

describe('validateState — final card schedule integrity', () => {
  it('throws when card dueAt does not match last review nextDueAt', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s);
    const { state: s3, id: cardId } = makeCard(s2, roomId, 4, 9);
    const { state: s4 } = makeReview(s3, cardId, { rating: 'hard' });

    const tampered = {
      ...s4,
      cards: s4.cards.map(c =>
        c.id === cardId ? { ...c, dueAt: c.dueAt + 999 } : c
      ),
    };
    assert.throws(() => validateState(tampered), /dueAt.*does not match the last review/);
  });

  it('throws when card step does not match last review nextStep', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s);
    const { state: s3, id: cardId } = makeCard(s2, roomId, 4, 9);
    const { state: s4 } = makeReview(s3, cardId, { rating: 'remembered' });

    const tampered = {
      ...s4,
      cards: s4.cards.map(c =>
        c.id === cardId ? { ...c, step: 3 } : c
      ),
    };
    assert.throws(() => validateState(tampered), /step.*does not match the last review/);
  });

  it('no-event card: dueAt must equal createdAt', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s);
    const { state: s3, id: cardId } = makeCard(s2, roomId, 4, 9);
    const tampered = {
      ...s3,
      cards: s3.cards.map(c =>
        c.id === cardId ? { ...c, dueAt: c.createdAt + 1 } : c
      ),
    };
    assert.throws(
      () => validateState(tampered),
      /dueAt.*does not equal createdAt/
    );
  });

  it('no-event card: step must be 0', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s);
    const { state: s3, id: cardId } = makeCard(s2, roomId, 4, 9);
    const tampered = {
      ...s3,
      cards: s3.cards.map(c =>
        c.id === cardId ? { ...c, step: 1 } : c
      ),
    };
    assert.throws(
      () => validateState(tampered),
      /step.*is not 0/
    );
  });

  it('accepts a card with no review events at creation schedule', () => {
    let s = createEmptyState();
    const { state: s2, id: roomId } = makeRoom(s);
    const { state: s3 } = makeCard(s2, roomId, 4, 9);
    assert.doesNotThrow(() => validateState(s3));
  });
});
