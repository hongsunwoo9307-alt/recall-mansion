/**
 * store.js — localStorage adapter.
 *
 * createStore(storage, key) → { load(), save(state) }
 *
 * No other module reads or writes localStorage directly.
 * The storage adapter interface is { getItem(key), setItem(key, value) },
 * matching the browser's localStorage API.
 *
 * Source of truth: docs/CORE-CONTRACT.md § "Required exports in dist/lib/store.js"
 *
 * Design note — why we do NOT use exportBackup for the stored value:
 *   exportBackup adds an `exportedAt` field for archive purposes.  If that JSON
 *   were written to storage, every load() would return an object with an extra
 *   `exportedAt` key.  UI code doing identity/equality checks after save() would
 *   see a mutated object and treat a just-saved state as "changed".  We therefore
 *   serialise the four canonical state fields only, and use exportBackup solely as
 *   a size-preflight check before writing.
 */

import { MAX_IMPORT_BYTES } from './validation.js';
import { createEmptyState, validateState, exportBackup } from './core.js';

/**
 * Creates a store bound to the given storage adapter and key.
 *
 * @param {Pick<Storage,'getItem'|'setItem'>} storage
 *   A localStorage-like object with getItem and setItem.
 * @param {string} [key='recall-mansion-v1']
 * @returns {{ load: () => object, save: (state: object) => void }}
 */
export function createStore(storage, key = 'recall-mansion-v1') {
  if (
    !storage ||
    typeof storage.getItem  !== 'function' ||
    typeof storage.setItem  !== 'function'
  ) {
    throw new Error('createStore: storage must have getItem and setItem methods');
  }

  return { load, save };

  // --------------------------------------------------------------------------

  /**
   * Reads and validates state from storage.
   *
   * - Absent key → returns a fresh empty state.
   * - Present but invalid → throws a descriptive Error; storage is NOT modified.
   *
   * Returns an object with exactly the four canonical state keys:
   *   { schemaVersion, rooms, cards, reviewEvents }
   *
   * @returns {object}
   */
  function load() {
    let raw;
    try {
      raw = storage.getItem(key);
    } catch (e) {
      throw new Error(`Storage read failed: ${e.message}`);
    }

    if (raw === null || raw === undefined) {
      return createEmptyState();
    }

    // Validate byte length before parsing (consistent with import limit).
    const byteLength = new TextEncoder().encode(raw).length;
    if (byteLength > MAX_IMPORT_BYTES) {
      throw new Error(
        `Stored data is ${byteLength} bytes, which exceeds the ` +
        `${MAX_IMPORT_BYTES}-byte (4 MiB) limit; the data has not been modified`
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error(
        `Stored data is not valid JSON (the original value has not been modified): ` +
        e.message
      );
    }

    try {
      validateState(parsed);
    } catch (e) {
      throw new Error(
        `Stored data failed validation (the original value has not been modified): ` +
        e.message
      );
    }

    // Return only the canonical state fields so callers never see incidental keys.
    return {
      schemaVersion: parsed.schemaVersion,
      rooms:         parsed.rooms,
      cards:         parsed.cards,
      reviewEvents:  parsed.reviewEvents,
    };
  }

  // --------------------------------------------------------------------------

  /**
   * Validates, serialises, and atomically writes state to storage.
   *
   * Throws on validation failure or storage quota error.
   * The caller MUST NOT update in-memory state until this returns without throwing.
   *
   * Size check:
   *   We run exportBackup (which adds exportedAt overhead) as a conservative size
   *   preflight.  If the backup-with-overhead fits in 4 MiB, the state-only JSON
   *   certainly fits too.  This keeps the size contract consistent with exports.
   *   We then serialise the canonical state fields only (no exportedAt) and call
   *   setItem exactly once with that leaner string.
   *
   * @param {object} state
   */
  function save(state) {
    // Full semantic validation first.
    validateState(state);

    // Size preflight via exportBackup (uses Date.now() only at this adapter boundary).
    // This throws if record counts or byte size exceed limits.
    exportBackup(state, Date.now());

    // Canonical state-only serialisation — no exportedAt, no extra fields.
    const json = JSON.stringify({
      schemaVersion: state.schemaVersion,
      rooms:         state.rooms,
      cards:         state.cards,
      reviewEvents:  state.reviewEvents,
    });

    try {
      storage.setItem(key, json);
    } catch (e) {
      // Re-throw with a clear message; the previous value in storage is intact.
      throw new Error(
        `Storage write failed (previous data is intact): ${e.message}`
      );
    }
  }
}
