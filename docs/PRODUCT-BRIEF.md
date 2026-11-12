# Recall Mansion product brief

Owner selection: Recall Mansion (2026-11-12). This brief was prepared with Codex before Kiro implementation.

## Promise and audience

For people who save notes but rarely revisit them, Recall Mansion makes the next review visible: unfinished reviews haunt rooms, and completing the queue lights their windows. This is a study aid, not a medical tool or a scientifically validated memory score.

## Minimum complete product

1. Create a room with a title and plain-text note. Select the exact occurrence of a phrase to remember, preview the blank and answer, and save a card. Also provide an explicit phrase-and-occurrence alternative for keyboard/mobile input.
2. Review due cards. Commit a confidence choice before revealing the answer, then self-rate Again, Hard, or Remembered. Display the next due time, update the room, and persist exactly one review event.
3. See room counts, next due times, and recent outcomes. List cards marked confident before reveal but rated Again afterward, without treating them as objectively incorrect answers. Export and validate a versioned JSON backup before import replaces local data with an explicit confirmation.

Provide optional original sample content, clearly identified as sample. Loading sample content must not overwrite the owner's notes.

## Scheduling contract

- New card: immediately due, step 0.
- Again: next due = review timestamp + 10 minutes; next step = 0.
- Hard: next due = review timestamp + 24 hours; retain step.
- Remembered: use [1, 3, 7, 14, 30] days at the pre-review step; advance by 1 capped at 4.
- A day means 24 hours. Store UTC epoch milliseconds and format in the user's locale.
- Due means dueAt <= now. Retrying the same review-event ID must not advance twice.
- Confidence records self-reported expectation; it does not change the schedule.

## Architecture and visual direction

Static browser app, English first, responsive, localStorage only, no runtime AI/API dependency. Use dist/index.html, dist/styles.css, dist/app.js, and pure modules in dist/lib/. Keep a simple local Node server/run command and node:test core tests.

Use a dark ink background, warm ivory text, amber window lights, and lavender ghost accents. Aim for a readable illustrated library/mansion rather than a busy 3D game. Each room is a semantic button/card. Ghost and window visuals must be paired with labels and counts; never rely on color alone. Support visible keyboard focus, touch targets, screen-reader announcements, and prefers-reduced-motion.

## Acceptance gates

- A new visitor can complete note → card → review → updated room without an account or API key.
- Selected phrase occurrence is correct even with repeated words, Korean, emoji, and line breaks.
- A review survives reload with the same next due time and no duplicate event.
- Failed persistence is visible; the UI does not claim a durable save.
- Import validates the entire backup before altering existing data; malformed or oversized input leaves saved notes intact.
- User text cannot inject HTML, script, or external resource loads.
- Demonstration shows real state changes without faking elapsed time.
- Public source includes the actual Kiro specs and an honest contribution record.

## Out of scope for the first version

3D navigation, voice, PDF/OCR, automated AI questions, accounts, payments, cloud sync, medical claims, and external note integrations.
