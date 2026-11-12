/**
 * store.test.js — node:test tests for dist/lib/store.js
 *
 * Run: node --test tests/
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createStore }     from '../dist/lib/store.js';
import { createEmptyState, addRoom, addCard, applyReview } from '../dist/lib/core.js';
import { MAX_IMPORT_BYTES } from '../dist/lib/validation.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = 1_700_000_000_000;

let _counter = 0;
function uid() { return `s-${++_counter}`; }

/** Minimal in-memory localStorage replacement. */
function makeStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem(k)    { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem(k, v) { data[k] = v; },
    _data: data,
  };
}

/** Storage whose setItem always throws (quota simulation). */
function makeQuotaStorage(initialJSON) {
  const data = {};
  if (initialJSON !== undefined) data['recall-mansion-v1'] = initialJSON;
  return {
    getItem(k)    { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem()     { throw new DOMException('QuotaExceededError', 'QuotaExceededError'); },
    _data: data,
  };
}

function makeState() {
  let s = createEmptyState();
  s = addRoom(s, { id: uid(), title: 'Store Test Room', note: 'Hello world foo bar.', now: NOW });
  const roomId = s.rooms[0].id;
  s = addCard(s, { id: uid(), roomId, start: 6, end: 11, now: NOW }); // "world"
  return s;
}

// ---------------------------------------------------------------------------
// 1. load() — absent key
// ---------------------------------------------------------------------------

describe('store.load — absent key', () => {
  it('returns fresh empty state when key is absent', () => {
    const store = createStore(makeStorage());
    const s = store.load();
    assert.equal(s.schemaVersion, 1);
    assert.deepEqual(s.rooms, []);
    assert.deepEqual(s.cards, []);
    assert.deepEqual(s.reviewEvents, []);
  });
});

// ---------------------------------------------------------------------------
// 2. load() — corrupt stored value
// ---------------------------------------------------------------------------

describe('store.load — corrupt stored value', () => {
  it('throws on non-JSON stored value', () => {
    const store = createStore(makeStorage({ 'recall-mansion-v1': 'not json' }));
    assert.throws(store.load, /not valid JSON/);
  });

  it('throws on JSON that fails validateState', () => {
    const corrupt = JSON.stringify({ schemaVersion: 99, rooms: [], cards: [], reviewEvents: [] });
    const store = createStore(makeStorage({ 'recall-mansion-v1': corrupt }));
    assert.throws(store.load, /schemaVersion/);
  });

  it('does NOT overwrite storage on corrupt value', () => {
    const corrupt = 'bad data';
    const storage = makeStorage({ 'recall-mansion-v1': corrupt });
    const store = createStore(storage);
    try { store.load(); } catch (_) { /* expected */ }
    assert.equal(storage._data['recall-mansion-v1'], corrupt);
  });
});

// ---------------------------------------------------------------------------
// 3. save() + load() round-trip
// ---------------------------------------------------------------------------

describe('store.save / store.load round-trip', () => {
  it('saves and reloads state correctly', () => {
    const storage = makeStorage();
    const store   = createStore(storage);
    const s       = makeState();

    store.save(s);
    const loaded = store.load();

    assert.equal(loaded.schemaVersion, 1);
    assert.equal(loaded.rooms.length,  s.rooms.length);
    assert.equal(loaded.cards.length,  s.cards.length);
  });

  it('loaded state does not contain exportedAt key', () => {
    const storage = makeStorage();
    const store   = createStore(storage);
    store.save(makeState());
    const loaded = store.load();
    assert.ok(!('exportedAt' in loaded), 'exportedAt must not appear in loaded state');
  });

  it('two consecutive save/load mutations preserve integrity', () => {
    const storage = makeStorage();
    const store   = createStore(storage);

    // First mutation: add a room + card
    let s = makeState();
    store.save(s);
    let loaded = store.load();
    assert.equal(loaded.rooms.length, 1);
    assert.equal(loaded.cards.length, 1);

    // Second mutation: apply a review
    const cardId = loaded.cards[0].id;
    const evId   = uid();
    const s2 = applyReview(loaded, {
      id: evId, cardId, at: NOW + 1000, confidence: 'maybe', rating: 'remembered',
    });
    store.save(s2);
    const loaded2 = store.load();

    assert.equal(loaded2.reviewEvents.length, 1);
    assert.equal(loaded2.reviewEvents[0].id, evId);
    // Card's dueAt/step must reflect the review
    const card = loaded2.cards.find(c => c.id === cardId);
    assert.ok(card.dueAt > NOW);
    assert.equal(card.step, 1);
    // No exportedAt in second load
    assert.ok(!('exportedAt' in loaded2));
  });
});

// ---------------------------------------------------------------------------
// 4. save() — quota failure leaves storage intact
// ---------------------------------------------------------------------------

describe('store.save — quota failure', () => {
  it('throws and leaves previous storage value untouched', () => {
    const s     = makeState();
    const store = createStore(makeQuotaStorage());
    assert.throws(() => store.save(s), /Storage write failed/);
  });

  it('previous value is preserved after quota error', () => {
    // Save a valid state first using a normal storage,
    // then try to save again through a quota-throwing adapter that pre-seeds the key.
    const normalStorage = makeStorage();
    const normalStore   = createStore(normalStorage);
    const s1            = makeState();
    normalStore.save(s1);
    const originalJSON = normalStorage._data['recall-mansion-v1'];

    // Hand the saved JSON to a quota-throwing storage
    const quotaStorage = makeQuotaStorage(originalJSON);
    const quotaStore   = createStore(quotaStorage);

    // Try to save a new state — quota error fires
    const s2 = addRoom(s1, { id: uid(), title: 'Extra', note: 'extra content', now: NOW + 1 });
    assert.throws(() => quotaStore.save(s2), /Storage write failed/);

    // Original JSON must still be in storage
    assert.equal(quotaStorage._data['recall-mansion-v1'], originalJSON);
  });
});

// ---------------------------------------------------------------------------
// 5. save() — stored JSON contains only canonical state keys
// ---------------------------------------------------------------------------

describe('store.save — stored JSON shape', () => {
  it('stored JSON has schemaVersion, rooms, cards, reviewEvents; no exportedAt', () => {
    const storage = makeStorage();
    createStore(storage).save(makeState());
    const stored = JSON.parse(storage._data['recall-mansion-v1']);
    assert.ok('schemaVersion' in stored);
    assert.ok('rooms'         in stored);
    assert.ok('cards'         in stored);
    assert.ok('reviewEvents'  in stored);
    assert.ok(!('exportedAt'  in stored), 'exportedAt must not appear in stored JSON');
  });
});
