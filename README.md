# Decided

Turns a chaotic group chat into a record of what was decided, who owns what, and what was asked but never answered.

A summariser tells you what was said. Decided tells you what wasn't.

## What it finds

- **Questions nobody answered** — ranked by what breaks first. It knows what shape an answer should take: a *who* question needs a name or a volunteer, a *when* needs a time, a *how much* needs a number. A reply that isn't the right shape does not count as an answer.
- **Questions asked twice** — the surest sign something is blocked.
- **Tasks nobody claimed** — raised in the group, then silence.
- **Who owns what** — resolved per clause, so one message can assign three different people.
- **Decisions, and who stayed silent** — with a confidence label. "Confirmed" means two or more people agreed on the record. "Assumed" means someone declared it and nobody did.
- **Plan changes, and who never responded** — a change is only real once everyone has seen it.
- **Money** — every amount, classified as actually paid, a per-head share, a price only proposed, or just mentioned. Then who owes what.
- **Load balance** — weighted by claimed tasks and words written.

Every finding links to the exact message, sender and timestamp. Nothing is asserted without its receipt.

## Waiting on you

Decided also works backwards from one question: **what is waiting on you?**

Pick your name in the chat and it lists, in order of urgency: questions that name you and got no usable answer, tasks of yours that are overdue, plan changes you never acknowledged, tasks nobody claimed, money you owe, and the questions the whole group is stuck on.

Add any OpenAI-compatible key — Grok included, one tap with the **⚡ Use my Grok** preset — and Decided drafts the reply **in your voice**: it feeds the model about 25 of your old messages as style samples plus the last 40 messages of context, and writes one message that covers everything waiting on you. Copy, check, send.

Decided never sends anything anywhere on your behalf. No app can post into WhatsApp without your phone, and nothing should go out into a group chat unnamed.

## No AI required

The whole analysis engine is deterministic code running in your browser. There is no API key, no account, no database, no upload and no tracking. Paste a chat and it works offline.

An AI key is optional. Add any OpenAI-compatible endpoint under the AI button to layer a written analysis and written answers on top. If the AI call fails, the app falls back to the engine, so nothing ever breaks.

## Run it

No build step, no dependencies.

```
python3 -m http.server 3000
```

Then open http://localhost:3000 — or open `index.html` directly.

## Using your own chat

In WhatsApp: open the group, tap the name, **More → Export chat → Without media**. That gives you a `.txt`. Upload it or paste it in.

Both export formats are supported:

```
[17/11/2026, 16:04:12] Chidera: ok so we have 3 days
17/11/2026, 16:04 - Chidera: ok so we have 3 days
```

Multi-line messages are stitched back together, system messages and media placeholders are filtered out, phone-number senders are handled, and the date order (DD/MM vs MM/DD) is detected from the file itself.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Markup |
| `styles.css` | Design and the four accessibility modes |
| `parser.js` | WhatsApp export parser, chat statistics, evidence lookup |
| `engine.js` | The analysis engine: questions, tasks, decisions, changes, money, risk |
| `data.js` | A demo chat for testing without your own data |
| `app.js` | UI, rendering, exports, optional AI mode |
| `functions/ai-proxy.js` | Optional edge relay, used only if a provider blocks browser calls. Allowlisted endpoints, stores nothing |

## Accessibility

Four modes, always visible: easy-read type, high contrast, larger text, reduced motion. Keyboard-only usable throughout, with screen-reader labels and live regions.

## Built for

Teens Hack Houston (TripleH) 2026 — theme: productivity.

## Licence

MIT
