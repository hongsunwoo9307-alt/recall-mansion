/**
 * scheduler.js — deterministic scheduling arithmetic.
 *
 * Pure functions only; never calls Date.now().
 * All time values are UTC epoch milliseconds.
 */

import { VALID_RATINGS, MAX_JS_DATE } from './validation.js';

/** Interval table for the "remembered" path, in days. */
export const INTERVALS = [1, 3, 7, 14, 30];

const MS_PER_DAY   = 86_400_000;
const MS_AGAIN     = 600_000;    // 10 minutes

/**
 * Compute the next due time and next step from a review.
 *
 * Throws if the computed nextDueAt would exceed the JavaScript Date range
 * (> MAX_JS_DATE), since such a value cannot be displayed as a valid Date.
 *
 * @param {'again'|'hard'|'remembered'} rating
 * @param {number} at             UTC epoch ms of the review.
 * @param {number} previousStep   Current step index (0–4).
 * @returns {{ nextDueAt: number, nextStep: number }}
 */
export function computeNext(rating, at, previousStep) {
  if (!VALID_RATINGS.has(rating)) {
    throw new Error(`Unknown rating "${rating}"; expected again | hard | remembered`);
  }
  if (typeof at !== 'number' || !Number.isFinite(at) || at < 0 || at > MAX_JS_DATE) {
    throw new Error(
      `at must be a finite non-negative number within the JavaScript Date range, got ${at}`
    );
  }
  if (!Number.isInteger(previousStep) || previousStep < 0 || previousStep > 4) {
    throw new Error(`previousStep must be an integer 0–4, got ${previousStep}`);
  }

  let nextDueAt;
  let nextStep;

  switch (rating) {
    case 'again':
      nextDueAt = at + MS_AGAIN;
      nextStep  = 0;
      break;

    case 'hard':
      nextDueAt = at + MS_PER_DAY;
      nextStep  = previousStep;
      break;

    case 'remembered': {
      const days = INTERVALS[previousStep];
      nextDueAt  = at + days * MS_PER_DAY;
      nextStep   = Math.min(previousStep + 1, 4);
      break;
    }

    default:
      // Unreachable after the has() guard above, but satisfies linters.
      throw new Error(`Unhandled rating "${rating}"`);
  }

  if (nextDueAt > MAX_JS_DATE) {
    throw new Error(
      `Computed nextDueAt (${nextDueAt}) exceeds the maximum JavaScript Date value ` +
      `(${MAX_JS_DATE}); cannot produce a displayable date`
    );
  }

  return { nextDueAt, nextStep };
}
