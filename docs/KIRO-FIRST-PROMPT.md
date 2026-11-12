# Prepared prompt for the first real Kiro session

Status: prepared by Codex and supplied to a real Kiro CLI 3.2.1 Spec session on 2026-11-12. Kiro read this file and began writing `.kiro/specs/recall-mansion/requirements.md`. See the contribution record for later verified implementation and test outcomes.

Build Recall Mansion, a new Kiroween 2026 entry for the Costume Contest category. The owner chose this idea. Read README.md, docs/PRODUCT-BRIEF.md, and .kiro/steering/hackathon.md.

Start by creating a requirements spec with measurable acceptance criteria, a technical design, and a small implementation task list in .kiro/specs/recall-mansion/. Then implement the substantive study core and meaningful tests. Do not stop at planning if the requirements are sufficient.

Use buildless HTML/CSS/JavaScript with browser ES modules under dist/. Use a package.json with type module and node:test for pure core tests. Expose the scheduling and card creation logic separately from the DOM. Do not install packages unless you explain why a dependency is needed. The UI can be developed separately; do not overwrite existing UI files without inspecting them.

The core flow is: note and title → user selects an exact phrase occurrence → cloze card snapshots the note and offsets → select pre-reveal confidence → reveal answer → self-rate recall → persist one review event and next due time → mansion reflects the real due count. No runtime AI, external network requests, server, login, or payment system is required.

Use deterministic, explicitly documented scheduling: a new card is due immediately. Again = 10 minutes and reset step to 0. Hard = 24 hours and keep step. Remembered = interval from [1, 3, 7, 14, 30] days at the current step, then advance with a cap. A day is exactly 24 hours; store UTC epoch milliseconds and display local time. Repeated processing of the same review-event ID must be idempotent. Confidence is descriptive and does not secretly modify the schedule.

Validate Unicode phrase offsets and duplicate phrases. Keep card content as a snapshot when a source note changes. Persist to localStorage via a narrow adapter that surfaces failures and never reports a save success when persistence failed. Backups must include schemaVersion and bounded arrays; validate types, finite timestamps, unique IDs, relationships, and length limits before atomic replace. Render all user content as text, never HTML.

Write and run meaningful node:test tests for schedule boundaries, due-at-now, capped steps, retry idempotence, Korean/emoji text and repeated phrase selection, corrupt backups, and storage failures. Report the real commands and outcomes. Leave the root .kiro folder in source control.

Record your actual contribution in docs/KIRO-EVIDENCE.md, including the implementation and tests you ran. Be accurate: the initial briefing and steering files were prepared by Codex. Do not claim another tool's work as your own. Do not publish, accept paid plans, or transmit personal documents.
