# Recall Mansion — submission checklist

Updated November 13, 2026 (Asia/Seoul). **Final submission is complete.** Participant registration and project submission are complete. [View the submitted Devpost project](https://devpost.com/software/recall-mansion).

## Official requirements checked

- New work built during October 30–December 4, 2026; deadline **December 5, 2026 at 07:00 KST**. Select **Costume Contest**. Best Demo needs no extra entry step. [Competition overview](https://kiroween.devpost.com/)
- Meaningful Kiro use, functional application URL, feature description, and Kiro-use write-up.
- Public GitHub repository containing complete source/assets/run instructions, a detectable open-source license, and root `.kiro` tracked.
- Public YouTube demonstration, under three minutes, showing real operation. Use authorized media only.
- English materials or English translations. Judge access must remain available through January 30, 2027 at 06:00 KST.
- Complete required form fields. Final submission accepts the official rules; draft saving is available beforehand. [Official rules, sections 1, 4–5](https://kiroween.devpost.com/rules)

Extra credits, a social post, and a blog post are optional; no additional credit request or bonus publication is needed for this entry. [Resources](https://kiroween.devpost.com/resources)

## Project evidence already available

| Item | Evidence |
| --- | --- |
| New project | README and steering record November 12, 2026 start; no ScopeGuard source reuse. |
| Working implementation | Static application in `dist/`, with `serve.mjs` for local use. |
| Core verification | 73 tests, 20 suites, 0 failures; `docs/VERIFICATION.md`. |
| Browser verification | Note/card/review/persistence, sample preservation, export, and invalid import gate verified. A valid backup with one room, one card, and one review enabled replacement; replacement was not performed. At a 390 × 844 browser viewport, create room → create card → Somewhat → Remembered → save → reload passed without horizontal overflow. |
| Kiro use | Actual `.kiro/specs/recall-mansion/` documents, `dist/lib/`, tests, and `docs/KIRO-EVIDENCE.md`. |
| Root `.kiro` | Present and not ignored by `.gitignore`. |
| License | Root `LICENSE`: MIT, Hyenjun Hong, 2026. |
| English copy | `docs/DEVPOST-ENTRY.md`; story, Kiro account, category rationale, testing instructions, and originality disclosure. |
| Hosting | https://recall-mansion-hj.hongsunwoo9307.chatgpt.site — public audience confirmed; anonymous HTTP requests returned 200 for the root and `lib/core.js`. |
| Public source | https://github.com/hongsunwoo9307-alt/recall-mansion — initial verified publication: 27 files at commit `02ed114be2f806b259442622a5909e36df598e16`; root `.kiro` and tests browsable, MIT detected. |
| Submitted Devpost project | Submission `1298833`; https://devpost.com/software/recall-mansion. Submitted to Kiroween 2026 on November 13, 2026 (KST), with the English story, three screenshots, video, and app/source links. |
| Public video | https://youtu.be/umx3xHVfUm8 — Public, 117.86 seconds, 1080p H.264/AAC. Actual playback and changing English captions verified in the Devpost embed. |

## Publication and submission gates

- [x] Publish the full repository on GitHub; verify public visibility, browsable root `.kiro`, readable source, and GitHub's detected MIT license.
- [x] Record the verified public source URL in the entry document.
- [x] Save and verify the public source URL in the Devpost entry.
- [x] Apply the owner's approved public audience and confirm Sites reports public access.
- [x] Verify anonymous HTTP access to the hosted app and core module; verify the complete application flow in the browser.
- [x] Finish the demonstration from eleven frames captured from the actual application and project files.
- [x] Verify video duration below 3:00, English captions, and actual application content.
- [x] Upload to YouTube as Public, verify playback, and record its exact URL. The live form permits public or unlisted videos; the published video is Public.
- [x] Save the Devpost overview, project details, and additional information, including the app/source/video links and Kiro-use description.
- [x] Inspect the saved preview, including its story, three screenshots, embedded video playback, and app/source links.
- [x] Obtain the owner's final submission request, accept the final terms, submit the project, and verify Devpost's actual success state.

Devpost displayed **“Project submitted!”** and **“Submitted to Kiroween 2026”** on the public project page after final submission. Editing remains available until the official deadline. Editor: https://devpost.com/submit-to/31667-kiroween-2026/manage/submissions/1298833-recall-mansion/project_details/edit

Required organizer-only questions and eligibility confirmations were verified with the owner and saved in Devpost. Private response values are intentionally absent from this public checklist. The project category is **Costume Contest**, with no special bonus category.

## Accuracy notes for the final review

- Kiro CLI generated requirements, design/tasks, core/storage modules, and tests; Codex handled the UI, integration contract, review, browser verification, and documentation corrections.
- Do not claim Kiro Crew, hooks, custom agents, MCP, Powers, or property-based tests. They were not used for this build.
- There is no runtime AI question generator, cloud sync, objective memory scoring, or medically/scientifically validated scheduling model.
- Notes use browser localStorage. Keep backups and use one editing tab. Failed persistence and invalid imports are reported without claiming a save.
- Valid import round trips were tested at module level. Browser checks verified the invalid-import gate, real export, and validation of a one-room/one-card/one-review backup with the replacement button enabled. Browser replacement itself was not performed; do not describe it as completed.
- The 390 × 844 test used a real browser with a narrow viewport, not a physical mobile device. Accessibility affordances are implemented, but a full accessibility audit and exhaustive browser coverage have not been completed.
- Registration and final project submission are complete, with Devpost's success state verified.
