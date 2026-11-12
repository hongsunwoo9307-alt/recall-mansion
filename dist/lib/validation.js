/**
 * validation.js — shared limits and field validators.
 *
 * All helpers are pure functions; none read global state.
 * Used by scheduler.js, core.js, and store.js.
 */

/** Maximum byte length for imported UTF-8 JSON (4 MiB). */
export const MAX_IMPORT_BYTES = 4_194_304;

/**
 * Maximum valid JavaScript Date value in UTC epoch milliseconds.
 * new Date(8640000000000000) is exactly the ECMAScript specification upper bound.
 * Any timestamp or computed dueAt beyond this cannot be displayed as a valid Date.
 */
export const MAX_JS_DATE = 8_640_000_000_000_000;

/** All record and field size limits used consistently across write, export, and import. */
export const LIMITS = {
  titleCodeUnits:        200,
  noteCodeUnits:         20_000,
  idCodeUnits:           128,
  rooms:                 100,
  cards:                 3_000,
  reviewEvents:          20_000,
  importBytes:           MAX_IMPORT_BYTES,
};

export const VALID_CONFIDENCES = new Set(['unsure', 'maybe', 'confident']);
export const VALID_RATINGS     = new Set(['again', 'hard', 'remembered']);

/**
 * Returns true when v is a non-empty string within the ID length limit.
 * @param {unknown} v
 * @returns {boolean}
 */
export function isValidId(v) {
  return typeof v === 'string' && v.length > 0 && v.length <= LIMITS.idCodeUnits;
}

/**
 * Returns true when v is a finite, non-negative number that is also within the
 * valid JavaScript Date range (≤ MAX_JS_DATE).  Any value outside this range
 * cannot be rendered as a valid Date and is therefore rejected.
 * @param {unknown} v
 * @returns {boolean}
 */
export function isFiniteNonNeg(v) {
  return (
    typeof v === 'number' &&
    Number.isFinite(v) &&
    v >= 0 &&
    v <= MAX_JS_DATE
  );
}

/**
 * Returns true when v is usable as a UTC epoch millisecond timestamp.
 * Alias of isFiniteNonNeg for readability at call sites.
 * @param {unknown} v
 * @returns {boolean}
 */
export function isValidTimestamp(v) {
  return isFiniteNonNeg(v);
}

/**
 * Throws a descriptive Error when v is not a valid ID string.
 * @param {unknown} v
 * @param {string} label  Human-readable field name shown in the error.
 */
export function assertId(v, label = 'id') {
  if (typeof v !== 'string') {
    throw new Error(`${label} must be a string, got ${typeof v}`);
  }
  if (v.length === 0) {
    throw new Error(`${label} must not be empty`);
  }
  if (v.length > LIMITS.idCodeUnits) {
    throw new Error(
      `${label} exceeds the ${LIMITS.idCodeUnits}-code-unit limit (got ${v.length})`
    );
  }
}

/**
 * Throws a descriptive Error when v is not a valid room title.
 * Empty strings and whitespace-only strings are both rejected.
 * @param {unknown} v
 * @param {string} label
 */
export function assertTitle(v, label = 'title') {
  if (typeof v !== 'string') {
    throw new Error(`${label} must be a string, got ${typeof v}`);
  }
  if (v.trim().length === 0) {
    throw new Error(`${label} must not be empty or whitespace-only`);
  }
  if (v.length > LIMITS.titleCodeUnits) {
    throw new Error(
      `${label} exceeds the ${LIMITS.titleCodeUnits}-code-unit limit (got ${v.length})`
    );
  }
}

/**
 * Throws a descriptive Error when v is not a valid note body.
 * Empty strings and whitespace-only strings are both rejected.
 * @param {unknown} v
 * @param {string} label
 */
export function assertNote(v, label = 'note') {
  if (typeof v !== 'string') {
    throw new Error(`${label} must be a string, got ${typeof v}`);
  }
  if (v.trim().length === 0) {
    throw new Error(`${label} must not be empty or whitespace-only`);
  }
  if (v.length > LIMITS.noteCodeUnits) {
    throw new Error(
      `${label} exceeds the ${LIMITS.noteCodeUnits}-code-unit limit (got ${v.length})`
    );
  }
}

/**
 * Returns true when the UTF-16 offset i falls between the two code units of a
 * surrogate pair in string s.  A boundary is "inside" a pair when
 * s[i-1] is a high surrogate (U+D800–U+DBFF) and s[i] is a low surrogate
 * (U+DC00–U+DFFF).
 *
 * @param {string} s
 * @param {number} i  Code-unit offset to test (0 ≤ i ≤ s.length).
 * @returns {boolean}
 */
export function isMidSurrogate(s, i) {
  if (i === 0 || i >= s.length) return false;
  const hi = s.charCodeAt(i - 1);
  const lo = s.charCodeAt(i);
  return hi >= 0xD800 && hi <= 0xDBFF && lo >= 0xDC00 && lo <= 0xDFFF;
}
