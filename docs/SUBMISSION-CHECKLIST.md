# Recall Mansion — submission checklist

Prepared November 13, 2026 (Asia/Seoul). This checklist records evidence, not final submission. Participant registration is complete. The current request is to prepare the project for submission; the final Submit action remains separate.

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
| Browser verification | Note/card/review/persistence, sample preservation, export, invalid import gate, and narrow viewport observed; limits documented. |
| Kiro use | Actual `.kiro/specs/recall-mansion/` documents, `dist/lib/`, tests, and `docs/KIRO-EVIDENCE.md`. |
| Root `.kiro` | Present and not ignored by `.gitignore`. |
| License | Root `LICENSE`: MIT, Hyenjun Hong, 2026. |
| English copy | `docs/DEVPOST-ENTRY.md`; story, Kiro account, category rationale, testing instructions, and originality disclosure. |
| Hosting | Owner-private deployment exists at https://recall-mansion-hj.hongsunwoo9307.chatgpt.site. |

## Publication and submission gates

- [ ] Publish the full repository on GitHub; verify public visibility, browsable root `.kiro`, readable source, and GitHub's detected MIT license.
- [ ] Record the final public source URL in the Devpost draft and entry document.
- [ ] Make the app accessible to judges and verify that access with the intended visitor permissions. Owner-only preview access is insufficient for an unauthenticated judge.
- [ ] Finish the demonstration using the working application. Show note creation, exact phrase/card creation, confidence, answer reveal, rating, saved state, and the actual Kiro project files.
- [ ] Verify video duration below 3:00, readable English narration/captions, real state changes, no secret/account exposure, and no unlicensed third-party media.
- [ ] Upload to YouTube as Public, verify playback, and record its exact URL. A local MP4 or unlisted upload does not satisfy the public-video requirement.
- [ ] Create/save the Devpost draft with title, pitch, story, technologies, category, app URL, GitHub URL, video URL, Kiro-use answer, and any remaining fields shown by the live form.
- [ ] Inspect the saved preview and all links. Confirm that the video and copy describe only implemented features.
- [ ] Present the complete entry for final submission approval, then verify Devpost's actual success state after submission.

Exact custom question labels, limits, and required checkboxes still need inspection in the authenticated Devpost form; this document does not invent unseen form fields.

## Accuracy notes for the final review

- Kiro CLI generated requirements, design/tasks, core/storage modules, and tests; Codex handled the UI, integration contract, review, browser verification, and documentation corrections.
- Do not claim Kiro Crew, hooks, custom agents, MCP, Powers, or property-based tests. They were not used for this build.
- There is no runtime AI question generator, cloud sync, objective memory scoring, or medically/scientifically validated scheduling model.
- Notes use browser localStorage. Keep backups and use one editing tab. Failed persistence and invalid imports are reported without claiming a save.
- Valid import round trips were tested at module level; the prior browser session verified the invalid-import gate and real export. If the video demonstrates valid replacement, perform and verify that actual browser action before describing it as complete.
- Accessibility affordances are implemented, but a full accessibility audit and exhaustive browser coverage have not been completed.
- Registration is complete; final project submission is not.
