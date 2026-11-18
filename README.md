# Decided

Turns a chaotic group chat into a record of what was decided, who owns what, and what was asked but never answered.

A summariser tells you what was said. Decided tells you what wasn't.

## What it does

- Parses a WhatsApp chat export, both iOS and Android formats
- Finds decisions, and who never actually agreed to them
- Finds tasks nobody claimed
- Finds questions that were asked and never answered
- Tracks plan changes and who never confirmed them
- Quotes the exact message behind every claim
- Copies a recap you can paste straight back into the group
- Exports every deadline to your calendar as an `.ics` file
- Answers questions about the chat, with the receipt attached

## Privacy

Everything is parsed in your browser. No account, no database, nothing stored, no tracking. The app works fully offline in demo mode.

## Run it

No build step, no dependencies. Serve the folder:

```
python3 -m http.server 3000
```

Then open http://localhost:3000 — or just open `index.html` directly.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Markup |
| `styles.css` | Design and the four accessibility modes |
| `parser.js` | WhatsApp export parser, chat statistics, evidence lookup |
| `data.js` | Demo dataset and offline answers |
| `app.js` | UI, rendering, exports, live AI mode |

## Accessibility

Four modes, always visible: easy-read type, high contrast, larger text, reduced motion. The whole app is keyboard-only usable and screen-reader friendly.

## AI

Optional. Click the AI button and add any OpenAI-compatible API key to analyse your own chats. Without a key the app runs entirely offline on the built-in demo dataset, so nothing ever depends on a network call.

## Built for

Teens Hack Houston (TripleH) 2026 — theme: productivity.

## Licence

MIT
