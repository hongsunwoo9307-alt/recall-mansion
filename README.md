# Recall Mansion

**Give your notes a room. Return to what matters.**

Recall Mansion turns plain-text notes into rooms in a haunted library. Choose an exact phrase to hide, try recalling it, and decide when to return. Ghost counts show cards that are actually due; a lit window means a room has no reviews waiting.

A new project for **Kiroween 2026**, started November 12, 2026 and submitted on November 13, 2026 (KST) in **Costume Contest**. [View the submitted Devpost project](https://devpost.com/software/recall-mansion).

Source: [hongsunwoo9307-alt/recall-mansion](https://github.com/hongsunwoo9307-alt/recall-mansion). The public source package omits the owner's private hosting configuration; `dist/` contains the complete application and can be hosted independently.

[Open the public web app](https://recall-mansion-hj.hongsunwoo9307.chatgpt.site/). No login is required. Desktop and mobile-sized browser layouts are supported; physical iOS/Android devices have not yet been tested.

[Watch the 1:58 English demonstration](https://youtu.be/umx3xHVfUm8). The video is an edited walkthrough of actual application and Kiro source screens, with English captions and synthesized narration.

[English subtitle file](docs/Recall-Mansion-demo.en.srt).

## Try the study flow

1. Create a room and paste a note, or choose **Explore a sample**.
2. Highlight a phrase and use the selection. A phrase field and occurrence number also support repeated words, keyboard use, and multiline text.
3. Review a due card. Choose confidence before revealing the answer, then rate **Again**, **Hard**, or **Remembered**.
4. Return to the mansion to see the next due time and cards marked confident before reveal but rated Again.
5. Export a JSON backup. Restore validates the complete file and asks before replacing local data.

Samples are original and append without overwriting existing notes. Korean, emoji, repeated phrases, and CRLF selections preserve the original text offsets. User content is rendered as text, including any pasted HTML.

## Run locally

Use Node.js 20 or later; verified development runtime: Node.js 24.22.1. No dependency installation, API key, or build step is needed.

```sh
node serve.mjs
```

Open the printed address, normally `http://127.0.0.1:4317/`. Run the core and storage checks with:

```sh
node --test tests/core.test.js tests/store.test.js
```

The deployable application is the `dist/` directory and can be served by an ordinary static host. The local server binds only to the loopback interface.

## Storage and scheduling

Notes stay in the current browser's localStorage. No runtime AI model reads them; no account, payment, or external API is required by the application. Clearing browser storage, switching browsers, or changing the site origin does not carry notes across. Keep an exported backup and edit in one tab at a time.

The schedule is a simple practice aid, not a scientifically validated prediction of memory:

| Rating | Next review | Step |
| --- | --- | --- |
| Again | 10 minutes | Reset to 0 |
| Hard | 24 hours | Unchanged |
| Remembered | 1, 3, 7, 14, then 30 days | Advance, capped at 4 |

A day is exactly 24 hours. New cards are immediately due. Confidence records your expectation and does not alter scheduling. Timestamps are stored as UTC epoch milliseconds and displayed locally.

Storage failures do not advance the displayed saved state. Reusing an identical review event ID is idempotent. Invalid saved data is preserved and reported instead of silently dropping records. Backups validate relationships, Unicode ranges, complete review history, and final schedules. Limits are 100 rooms, 3,000 cards, 20,000 review events, and 4 MiB per backup; actual browser storage availability can be lower.

## How Kiro was used

The official **Kiro CLI 3.2.1**, on Kiro Free, produced the real requirements, design, and task documents in `.kiro/specs/recall-mansion/`, implemented `dist/lib/`, and wrote and ran the Node tests. Codex prepared the product brief, steering, integration contract, HTML/CSS/DOM interface, and local server, then reviewed Kiro's implementation and exercised the browser flows. Review findings were sent back to Kiro for correction.

See [the contribution record](docs/KIRO-EVIDENCE.md), [the integration contract](docs/CORE-CONTRACT.md), and [the recording plan](docs/DEMO-PLAN.md). The initial steering file alone is not presented as evidence of Kiro implementation.

## Entry status

The prototype is implemented and 73 core/storage tests pass. Participant registration and final project submission were completed on November 13, 2026 (KST), with the owner's eligibility and terms confirmation. Devpost displayed **“Project submitted!”** and lists the project under **“Submitted to Kiroween 2026.”** The application, complete GitHub source, and demonstration video are public. [View the submitted entry](https://devpost.com/software/recall-mansion).

Official deadline: **December 5, 2026, 07:00 KST** (December 4, 14:00 PST). Competition details: [Kiroween](https://kiroween.devpost.com/), [official rules](https://kiroween.devpost.com/rules), and [resources](https://kiroween.devpost.com/resources).

## License

MIT. See [LICENSE](LICENSE). Mansion, window, and ghost graphics are original inline SVG artwork.
