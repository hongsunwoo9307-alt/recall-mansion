# Recall Mansion demo recording plan

**Target: 115 seconds, English narration. This is a recording plan, not evidence of a completed video, passing tests, deployment, or submission.** Record only after the real application and the features below have been verified. Revise the script if the final implementation differs.

## Preparation

- Use a separate, empty demo browser profile; preserve the owner's saved notes.
- Keep the system clock accurate. Show real due times in the browser's locale. Do not change the clock, edit stored timestamps, or simulate elapsed time.
- Use this original sample note in a room named **Moonlit observatory — demo**:

  > The Moon reflects sunlight rather than producing its own light. A lunar eclipse happens when Earth passes between the Sun and the Moon.

- Open the actual project files before recording. Confirm Kiro attribution against the recorded development session and final files. The `dist/lib` implementation is still being completed at the time this plan is written.
- Record a readable browser viewport with visible pointer actions and English captions. Cuts may shorten navigation, but must not imply a state change that did not happen.

## Storyboard

| Time | Screen and action | Suggested narration |
| --- | --- | --- |
| 0:00–0:10 | Show the empty mansion and review desk. | “Saving a note is easy. Coming back to it is harder. Recall Mansion turns notes into rooms, with ghosts showing which cards are due.” |
| 0:10–0:24 | Create the demo room; paste the sample note and save. | “Each room keeps a plain-text note. This example is a short note about the Moon.” |
| 0:24–0:39 | Select **reflects sunlight**, choose **Use selected phrase**, show the cloze preview, and keep the card. | “I choose the exact phrase I want to remember. The preview shows the question and answer before I save it.” |
| 0:39–0:59 | Review the due card. Choose **Confident** before revealing. Reveal the answer, then choose **Again**. Hold on the saved next-due timestamp. | “Confidence comes first. After revealing the answer, I rate my recall. For this demonstration I choose Again, scheduling a return ten minutes from this actual review.” |
| 0:59–1:14 | Return to the mansion. Show zero due cards, the lit room window, its next-due label, and the dated second-look entry. | “The due count falls and the window lights up. Confident followed by Again is listed for a second look. It records my judgment; it is not an objective memory score.” |
| 1:14–1:27 | Export the real backup. Select that downloaded file for import; show validation counts and the explicit replacement button. | “Notes stay in this browser. A JSON backup lets me keep a copy. Import checks the file before I explicitly choose to replace saved data.” |
| 1:27–1:45 | Show actual `.kiro/specs/recall-mansion/requirements.md`, `design.md`, and `tasks.md`, then the finished `dist/lib` files. | **After verifying provenance:** “Kiro produced the project specs and implemented the study core and storage modules. These are the actual project files. Codex prepared the interface and browser integration.” Point to one implemented scheduling rule; do not show placeholders as finished work. |
| 1:45–1:55 | Return to the working mansion; leave the real next-due label visible. | “A small note, an honest check, and a visible reason to return. Recall Mansion runs without an account or a runtime AI service.” |

## Recording boundaries

- Phrase selection creates the question; do not say AI generates it.
- Describe the schedule as a practice aid, not a validated prediction of memory.
- The Again card remains scheduled for the future. No ten-minute wait or fabricated second review is necessary.
- Backup validation does not itself replace data. If replacement is demonstrated, click the explicit confirmation and verify the restored state.
- Show test results or a public URL only after those specific results or deployment have actually been verified. Do not use this plan as evidence that either is complete.
