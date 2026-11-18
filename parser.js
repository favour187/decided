const SYSTEM_PATTERNS = [ /messages and calls are end-to-end encrypted/i, /created (this )?group/i, /added you to this group/i, /\badded\b.*\bto the group\b/i, /joined using this group's invite link/i, /left the group/i, /removed\b/i, /changed (the subject|this group's|the group (icon|description))/i, /changed the phone number/i, /you were added/i, /this message was deleted/i, /deleted message/i, /missed (voice|video) call/i, /^you:?\s*$/i, /security code changed/i, /turned on disappearing messages/i, /made you an admin/i, /tap to learn more/i, /created group/i ];

const IOS_RE = /^\[(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:AM|PM|am|pm)?\]\s([^:]{1,80}):\s?([\s\S]*)$/;

const AND_RE = /^(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:AM|PM|am|pm)?\s[-–]\s([^:]{1,80}):\s?([\s\S]*)$/;

function parseLine(line) {
  let m = line.match(IOS_RE) || line.match(AND_RE);
  if (!m) return null;
  const [, dateStr, timeStr, rawAuthor, text] = m;
  return {
    dateStr: dateStr,
    timeStr: timeStr,
    author: cleanAuthor(rawAuthor),
    text: text.trim()
  };
}

function cleanAuthor(a) {
  a = (a || "").trim().replace(/^[\u200e\u200f]+/, "").replace(/[\u200e\u200f]+$/, "");
  const digits = a.replace(/[^\d]/g, "");
  if (/^\+?\d{7,15}$/.test(a) || digits.length >= 9 && !/[a-z]/i.test(a)) {
    return "Member " + digits.slice(-4);
  }
  return a.replace(/\s+/g, " ").slice(0, 40) || "Unknown";
}

function isSystem(author, text) {
  const blob = (author + " " + text).trim();
  return SYSTEM_PATTERNS.some(re => re.test(blob));
}

function parseChat(raw) {
  if (!raw || typeof raw !== "string") return {
    messages: [],
    skipped: 0
  };
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const messages = [];
  let skipped = 0;
  for (const line of lines) {
    const parsed = parseLine(line);
    if (parsed) {
      if (isSystem(parsed.author, parsed.text)) {
        skipped++;
        continue;
      }
      if (!parsed.text) {
        skipped++;
        continue;
      }
      messages.push({
        ts: `${parsed.dateStr} ${parsed.timeStr}`,
        date: parsed.dateStr,
        time: parsed.timeStr,
        author: parsed.author,
        text: parsed.text,
        isQuestion: isQuestion(parsed.text),
        media: /<media omitted>|image omitted|video omitted|sticker omitted|audio omitted|gif omitted|document omitted/i.test(parsed.text),
        idx: messages.length
      });
    } else if (messages.length && line.trim()) {
      messages[messages.length - 1].text += "\n" + line;
    } else if (line.trim()) {
      skipped++;
    }
  }
  return {
    messages: messages,
    skipped: skipped
  };
}

const INTERROGATIVE = /^(who|what|when|where|why|how|which|whose|whom|is|are|am|was|were|do|does|did|can|could|will|would|shall|should|may|might|must|anybody|anyone|somebody|have|has|had)\b/i;

const LEAD_IN = /^(ok|okay|so|but|btw|and|also|guys|important|wait|oh|ah|pls|please|hey|hi|hello|yah|yes|no|fine|lol|sha|abi|now|then|well|anyway)[\s,!.:\-]*/i;

function isQuestion(text) {
  if (/\?/.test(text)) return true;
  let t = String(text || "").trim();
  for (let i = 0; i < 2; i++) {
    const m = t.match(LEAD_IN);
    if (!m) break;
    t = t.slice(m[0].length);
  }
  return INTERROGATIVE.test(t);
}

function chatStats(messages) {
  const byAuthor = new Map;
  let questions = 0, media = 0, nightOwl = 0;
  const dayCounts = new Map;
  for (const m of messages) {
    byAuthor.set(m.author, (byAuthor.get(m.author) || 0) + 1);
    if (m.isQuestion) questions++;
    if (m.media) media++;
    const h = parseInt((m.time.split(":")[0] || "0").replace(/^0/, ""), 10);
    if (h >= 22 || h < 5) nightOwl++;
    dayCounts.set(m.date, (dayCounts.get(m.date) || 0) + 1);
  }
  const participants = [ ...byAuthor.entries() ].sort((a, b) => b[1] - a[1]);
  const total = messages.length;
  const busiestDay = [ ...dayCounts.entries() ].sort((a, b) => b[1] - a[1])[0];
  return {
    total: total,
    skippedMedia: media,
    questionsAsked: questions,
    nightMessages: nightOwl,
    participants: participants.map(([name, count]) => ({
      name: name,
      count: count,
      pct: total ? Math.round(count / total * 100) : 0
    })),
    daySpan: dayCounts.size,
    firstTs: messages[0]?.ts || "",
    lastTs: messages[total - 1]?.ts || "",
    busiestDay: busiestDay ? `${busiestDay[0]} (${busiestDay[1]} msgs)` : "",
    volume: (() => {
      if (!messages.length) return "";
      const words = messages.reduce((s, m) => s + m.text.split(/\s+/).filter(Boolean).length, 0);
      return `${words.toLocaleString()} words across ${total} messages`;
    })()
  };
}

function findEvidence(messages, needle, authorHint) {
  const q = (needle || "").toLowerCase().trim();
  if (!q) return null;
  const terms = q.split(/\s+/).filter(t => t.length > 2);
  let best = null, bestScore = 0;
  for (const m of messages) {
    const hay = m.text.toLowerCase();
    let score = 0;
    for (const t of terms) if (hay.includes(t)) score += t.length;
    if (authorHint && m.author.toLowerCase().includes(String(authorHint).toLowerCase())) score += 4;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return bestScore > 0 ? best : null;
}
