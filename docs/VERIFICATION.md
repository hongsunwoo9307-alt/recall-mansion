# Prototype verification

Verified November 12–13, 2026 (Asia/Seoul). This record was prepared by Codex from executed checks, separately from Kiro's contribution record.

## Automated checks

`node --test tests/core.test.js tests/store.test.js` on Node.js 24.22.1: **73 tests passed, 20 suites, 0 failures**. Kiro ran this command after implementation; Codex independently repeated the final suite. No npm installation is needed to run the documented command.

Independent review also exercised Unicode/CRLF snapshots, repeated phrase offsets, split-surrogate rejection, retry conflicts, schedule/date limits, corrupt and inaccessible storage, quota failures, and UTF-8 backups over 4 MiB. Review found three issues that Kiro corrected: storage metadata broke consecutive saves; history validation needed the complete chain; imported snapshots needed the same bounds and answer checks as card creation. The failing reproductions passed after correction.

## Browser observations

Executed against the local static application with the in-app Chromium browser:

- Empty startup and the study guide render; Escape closes the guide and returns focus.
- A room with Korean, an emoji, line breaks, repeated words, and literal script markup saves. Script markup remains text.
- Selecting occurrence 2 of the same Korean phrase hides exactly the second occurrence. Room creation followed by card creation succeeds without a reload.
- Reveal stays disabled until confidence is chosen. Confidence controls become disabled after reveal.
- Confident followed by Again records one review and exactly 600,000 milliseconds until its next due time. Rating controls disappear after commitment.
- Reload preserves the room, card, review count, next due time, and second-look entry.
- When the real due time passed, the room returned to a ghost/due state without altering the clock.
- Sample content adds three labeled rooms and four cards while preserving the existing test room; the sample button then disables.
- An unsupported-schema backup shows an error and keeps the replacement button disabled.
- The exported download contained the actual saved review. Parsing and re-exporting it produced an identical State.
- A 390-pixel viewport had no document-level horizontal overflow. Reduced-motion styles and contrast adjustments were reviewed in source.
- No console errors or warnings were recorded in the inspected browser session.

## Additional hosted and mobile-size checks — November 13, 2026

The owner approved public visitor access, and an anonymous HTTP request without cookies returned the application and its core module with HTTP 200 and no login redirect. Public GitHub source includes the complete application, tests, root `.kiro`, run instructions, and the detected MIT license.

At a 390-by-844 browser viewport, a new demonstration room and phrase card were created, reviewed with Somewhat then Remembered, and reloaded. The saved next-day schedule and room/card/review counts persisted. The page width was 375 pixels within the 390-pixel viewport; the review dialog's client and scroll widths were both 339 pixels. Input and rating controls remained usable without horizontal overflow. This was desktop Chromium at a mobile-sized viewport, not a test on physical iOS or Android hardware.

A real exported hosted backup with one room, one card, and one review was selected in the restore dialog. Its counts were validated and the explicit replacement control became enabled. Replacement was not performed.

The public English demonstration at https://youtu.be/umx3xHVfUm8 is 117.86 seconds. Its 1920-by-1080 H.264/AAC output passed full decode verification. YouTube confirmed publication and reported no copyright issues in its check; actual playback was observed in the saved Devpost embed. The video uses real application and public repository captures with explicit editing and elapsed-time labels.

## Scope and limits

This is a prototype check, not a full accessibility audit or a claim of support for every browser. Valid import round trips and persistence replacement were covered at module level; the browser's invalid-import gate and export download were exercised. Browser storage quota and damaged-data paths were tested with injected storage adapters. Simultaneous edits across tabs are not protected by an atomic lock. No runtime AI, cloud sync, or payment integration is present.

The hosted site has a different origin from localhost, so local test notes are not transferred automatically. The application and source are public; final hackathon submission remains separate.
