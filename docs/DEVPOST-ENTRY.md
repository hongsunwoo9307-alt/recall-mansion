# Recall Mansion — Devpost entry copy

Prepared November 13, 2026 (Asia/Seoul) from the implemented application and recorded verification. Sections labeled as field copy can be pasted into Devpost. Publication checks and unfinished link fields are kept separately below.

## Project name

Recall Mansion

## Elevator pitch

Turn forgotten notes into a haunted mansion: due cards become ghosts, and each completed review brings the light back.

## Category

Costume Contest

## Built with

Kiro CLI, JavaScript, HTML, CSS, SVG, localStorage, Node.js, node:test, ChatGPT Sites, Codex

## Project story — field copy

### Inspiration

Saving a note is easy. Coming back to it is harder. Recall Mansion is for people who collect useful notes and want a small, visible reason to revisit them. A haunted house provides the right metaphor: unfinished reviews linger as ghosts, while a room that has caught up glows with a warm window.

The Halloween theme explains what to do next. It makes review status part of the interface instead of adding decoration that competes with studying.

### What it does

Each plain-text note becomes a room. Select the exact phrase you want to remember, preview the resulting blank and answer, and keep it as a review card. A phrase-and-occurrence field provides an alternative to text selection and handles repeated words.

During review, choose your confidence before revealing the answer. Then rate your recall: Again returns in ten minutes, Hard in twenty-four hours, and Remembered advances through one, three, seven, fourteen, and thirty days. The mansion shows cards that are actually due. Clearing a room's current queue lights its window; when a card becomes due again, the ghost returns.

The Second Look list highlights cards marked Confident before reveal but Again afterward. This records a useful self-reported mismatch, not an objective memory score. Notes stay in the current browser, and validated JSON backups support export and restore. Optional sample rooms help new visitors try the flow without replacing their notes.

### How I built it

Recall Mansion is a static web application with plain JavaScript modules, HTML, CSS, and original inline SVG artwork. Its study core is separate from the interface, and time is passed explicitly into the scheduler so behavior can be tested deterministically. It requires no runtime AI service or application account.

I used the official Kiro CLI for the requirements, technical design, implementation checklist, study core, storage adapter, and Node tests. Codex prepared the interface and integration contract, reviewed the implementation, and exercised the browser flows. Review findings went back to Kiro for fixes. The repository preserves the real `.kiro` files and a detailed contribution record.

### Challenges I ran into

The difficult parts were the small promises a study tool must keep. Repeated phrases, Korean text, emoji, and different line endings must still hide the exact selected span. A saved review must survive reload with the same next due time. An invalid backup must leave existing notes intact.

Review caught an integration bug where backup metadata in local storage disrupted consecutive saves. Kiro corrected the stored shape and added a regression test. It also strengthened import validation to replay the full review history and reject inconsistent schedules, rather than checking only the final event.

### Accomplishments that I'm proud of

The complete note-to-card-to-review flow works, with 73 automated core and storage tests passing. Browser checks confirmed persistence, the confidence-before-reveal flow, sample preservation, backup export, and rejection of an invalid import. The interface includes explicit status labels, keyboard focus, and reduced-motion styles, so the meaning of a ghost or lit window does not depend on color alone.

### What I learned

A precise contract made AI-assisted development easier to inspect. Defining the stored records, text-offset rules, and scheduling arithmetic before implementation gave Kiro a concrete target and made review findings reproducible. A polished visual metaphor is most useful when it reflects real application state.

### What's next for Recall Mansion

I want to test with people who already review their own notes, check more browsers and assistive technologies, and improve note organization based on that feedback. The current schedule is deliberately simple and is not a scientifically validated prediction of memory. There is no cloud synchronization; users should keep backups and edit in one tab at a time.

## How Kiro was used — field copy

I used Kiro CLI 3.2.1 on the Free plan. The first real CLI Spec session produced the requirements document. A subsequent CLI chat session used those requirements and the integration contract to create the design and task documents, implement the study core and localStorage adapter, and write and run the Node tests.

The development contract specified the state schema, UTF-16 selection offsets, exact intervals, idempotent review events, full backup validation, and failure behavior. This kept implementation and interface integration aligned. The steering document established the project scope, local operation, keyboard support, honest status reporting, and preservation of actual Kiro evidence.

The most useful iteration was sending concrete review failures back to Kiro. Kiro fixed consecutive-save failures caused by stored export metadata, completed validation of the entire review-event chain, and aligned imported snapshot checks with card creation. It added regression coverage and finished with 73 passing tests across 20 suites.

Kiro's implementation is in `dist/lib/`; its tests are in `tests/`. The actual requirements, design, and completed checklist are in `.kiro/specs/recall-mansion/`. `docs/KIRO-EVIDENCE.md` distinguishes Kiro's work from Codex's interface, contract, integration review, and browser verification. Codex later corrected a few documentation descriptions without changing the recorded Kiro implementation or test outcome.

This build used Kiro CLI, specs, steering, and ordinary unit/regression tests. It did not use Kiro IDE, Web, Crew, custom agents, hooks, MCP integrations, Powers, or property-based testing. It does not call Kiro or another AI model at runtime.

## Why this category — field copy

Costume Contest: the haunted-house interface makes a practical study queue visible. Each note has a room, ghosts and counts show due cards, and a lit window shows a room with cards but no review currently waiting. The theme supports the main task while plain labels, readable text, keyboard controls, and reduced-motion styles keep it usable.

## Testing instructions — field copy

Open the application in a current desktop browser. The application itself needs no account, API key, or paid service. Enable local storage for the site.

1. Choose **Explore a sample** to append three labeled rooms and four cards, or choose **Create a room** to paste your own plain-text note.
2. For a new room, choose a phrase using text selection or the phrase-and-occurrence fields. Check the blank and answer preview, then keep the card.
3. Start a due review. Choose confidence, reveal the answer, and select Again, Hard, or Remembered.
4. Return to the mansion and check the saved next-due time and room state. Reload to confirm persistence. Confident followed by Again also creates a Second Look entry.
5. Export a JSON backup using the header control. Restore validates the selected file before its explicit replacement button can apply it. Restoration replaces this browser's current mansion, so retain a backup first.

Data stays in this browser and site origin. For a separate test, use a separate browser profile. Avoid simultaneous edits in multiple tabs. The sample button adds its content only once. No ten-minute wait is needed to verify that Again schedules a future review.

To run from source, use `node serve.mjs` and open the printed loopback URL. No dependencies or build step are required. Tests run with `node --test tests/core.test.js tests/store.test.js`; development was verified with Node.js 24.22.1.

## Originality and existing work — field copy

Recall Mansion was started on November 12, 2026 for Kiroween 2026. It is a new project and does not reuse ScopeGuard source. The application uses original HTML, CSS, JavaScript, sample content, and inline SVG artwork, without a third-party application template or external runtime library. Development used Kiro CLI and Codex; Node.js provides local tooling and tests, and ChatGPT Sites provides static hosting. The repository includes an MIT license.

## Bonus selection

No additional eligibility-based or publishing-based bonus is claimed by this draft. Best Demo requires no additional submission step. Do not claim student, startup, Kiro Crew, previous-Kiroween, social-post, or blog-post eligibility without the corresponding facts and artifacts.

## Link fields and publication handoff

| Field | Current verified value/status |
| --- | --- |
| Application | https://recall-mansion-hj.hongsunwoo9307.chatgpt.site — deployed; initially owner-private. Verify judge access before submitting this URL. |
| Public GitHub source | Awaiting creation/publication and verification by the publishing workflow. |
| Public YouTube demonstration | Awaiting finished video, public upload, and playback verification. |
| Devpost draft | Awaiting creation and saved-field verification. |

Do not paste the status notes into URL fields. Replace this table with the verified links when available. No final hackathon submission has been claimed here.
