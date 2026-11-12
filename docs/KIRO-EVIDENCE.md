# Kiro Contribution Evidence

## Session 1 — 2026-11-12 (Real Kiro CLI 3.2.1 Spec session)

**What Kiro did:**
Generated `.kiro/specs/recall-mansion/requirements.md` — a full requirements spec with
12 numbered requirements, acceptance criteria, and a glossary — from the prompt in
`docs/KIRO-FIRST-PROMPT.md`.

**What Codex did before this session:**
Prepared `README.md`, `docs/PRODUCT-BRIEF.md`, `docs/CORE-CONTRACT.md`,
`docs/KIRO-FIRST-PROMPT.md`, `.kiro/steering/hackathon.md`, and the initial UI files
(`dist/index.html`, `dist/styles.css`, `dist/app.js`, `serve.mjs`).
These are not claimed as Kiro output.

---

## Session 2 — 2026-11-12 (Kiro CLI chat session)

**Task:** Implement the study core per `docs/CORE-CONTRACT.md`, the requirements spec,
and in-flight steering corrections from the owner.

**Files created by Kiro in this session:**

| File | Description |
|------|-------------|
| `.kiro/specs/recall-mansion/design.md` | Concise technical design: module map, state shape, limits table, scheduler table, error strategy, test plan |
| `.kiro/specs/recall-mansion/tasks.md` | 9-task implementation checklist |
| `package.json` | `type: module`; test script `node --test tests/core.test.js tests/store.test.js` |
| `dist/lib/validation.js` | Shared limits, `MAX_JS_DATE` constant, `isValidTimestamp` (rejects > MAX_JS_DATE), `assertTitle`/`assertNote` (reject whitespace-only), `isMidSurrogate` |
| `dist/lib/scheduler.js` | `computeNext(rating, at, previousStep)` — pure, deterministic; throws if `nextDueAt > MAX_JS_DATE` |
| `dist/lib/core.js` | All ten exports required by the contract: `createEmptyState`, `validateState`, `addRoom`, `addCard`, `applyReview`, `getDueCards`, `getOverconfidentMisses`, `getClozeParts`, `exportBackup`, `parseBackup`; full history-chain replay (append order) in `validateState`; no-event card creation schedule check |
| `dist/lib/store.js` | `createStore(storage, key)` — `load()` returns canonical state-only fields (no `exportedAt`); `save()` uses `exportBackup` as size preflight then writes state-only JSON; quota failures leave storage intact |
| `tests/core.test.js` | 59 `node:test` tests covering: scheduling arithmetic, all five steps, step cap, `MAX_JS_DATE` overflow, `validateState` structure, whitespace rejection, surrogate boundaries, Korean text, idempotent retry, conflict detection, `getDueCards` ordering, overconfident misses, cloze parts, export/import round-trip, oversized import, broken references, history-chain append order, per-event invariants (previousDueAt/Step, at monotonicity, at ≥ createdAt, nextDueAt/Step vs scheduler), final card schedule integrity, no-event card creation check |
| `tests/store.test.js` | 14 `node:test` tests covering: absent key returns empty state, non-JSON / invalid-schema corrupt value throws without overwriting storage, save+load round-trip, `exportedAt` absent from loaded state, two consecutive save/load mutations, quota failure leaves storage intact, stored JSON shape |

**Steering corrections applied during this session:**

- `isValidTimestamp` rejects values > `MAX_JS_DATE`; `computeNext` throws if result
  would exceed `MAX_JS_DATE`.
- `assertTitle` and `assertNote` reject whitespace-only strings.
- `store.save` uses `exportBackup` only as a size preflight; persists canonical
  state-only JSON so `load()` never returns an `exportedAt` key.
- `validateState` checks `noteSnapshot.length <= 20000` and that the selected answer
  is not whitespace-only.
- History-chain replay walks events in array-append order (not re-sorted by id),
  with full per-event invariant checks including at-monotonicity in that order.
- No-event cards must satisfy `dueAt === createdAt` and `step === 0`.
- Regressions added for all corrected invariants and for two consecutive save/load
  mutations.

**Files NOT modified by Kiro (Codex work, left untouched):**
`dist/index.html`, `dist/styles.css`, `dist/app.js`, `serve.mjs`,
`.openai/hosting.json`.

**Test run command and outcome (actual, not simulated):**

```
node --test tests/core.test.js tests/store.test.js
```

Output (Node.js v24.22.1, 2026-11-12):

```
ℹ tests 73
ℹ suites 20
ℹ pass 73
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 218
```

All 73 tests pass. No stubs, no simulated calls, no unexecuted tests.

**Documentation review — 2026-11-13:** Codex corrected the export count here and
reviewed `design.md` against the implementation, clarifying copying, errors, UTF-8
size checks, canonical storage, and full history replay. These documentation edits
do not change the Kiro implementation, tests, or recorded test results.
