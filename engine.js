const STOPWORDS = new Set(("a an the and or but if then than that this these those of to in on at for with without from by as is are was were be been being am do does did doing done have has had having i you he she it we they me him her us them my your his its our their mine yours ours theirs so such no nor not only own same too very can will just don should now o na abi sha sef eh hmm okay ok ya yah pls please lol lmao oo ooo abeg wahala dey one two three mr mrs ms miss said say says tell told thing things get got go goes going like just really actually know want need make made see saw come came day days time times today tomorrow tonight yes yeah yah no nah fine alright cool good nice great sure please would could shall may might must also btw guys wait oh ah hey hi hello anybody anyone somebody someone everything nothing something which who whom whose when where why how much many our us let lets let's insha allah oga wahala").split(" "));

const AFFIRM = ["yes", "yeah", "yah", "yep", "yup", "ok", "okay", "fine", "sure", "agreed", "agree", "cool", "bet", "alright", "sounds good", "good", "nice", "perfect", "done", "seen", "noted", "correct", "true", "exactly", "definitely", "👍", "✅", "✔", "👌", "🙌", "💯"];
const NEGATE = ["no", "nah", "nope", "not", "never", "cant", "can't", "cannot", "don't", "dont", "won't", "wont", "instead", "rather", "against", "disagree", "❌"];
const FILLER = new Set(["lol", "lmao", "ok", "okay", "yes", "no", "👍", "😂", "💀", "🔥", "😭", "hmm", "oh", "ah", "nice", "cool", "k", "o", "na", "abi", "sha", "sef", "yah", "yep", "alright", "fine"]);
const PRONOUN_OBJ = new Set(["it", "that", "this", "them", "those", "one", "something", "anything", "nothing", "some"]);

const TASK_VERBS = "(bring|buy|get|send|make|do|write|draft|design|print|prepare|finish|complete|build|fix|call|ask|pay|submit|share|upload|collect|deliver|book|reserve|carry|fetch|download|edit|check|confirm|organise|organize|handle|sort|order|cook|clean|pick|open|close|present|rehearse|practise|practice|test|try|review|record|film|install|plan|schedule|email|scan|publish|deploy|host|register|update|pack|load|sign|measure|cut|sew|draw|paint|translate|invite|watch|attend|join)";
const VERB_RE = new RegExp("\\b" + TASK_VERBS + "\\b", "i");
const COMMIT_FIRST = new RegExp("\\b(i|i'll|ill|i will|im|i'm|i am|me|myself|my)\\b[^.]{0,18}\\b" + TASK_VERBS + "\\b", "i");
const COMMIT_SELF = /\b(i'll|ill|i will|imma|i am going to|let me|leave it to me|i got this|i've got this|i can|on me|i will handle|i'm on it)\b/i;
const UNOWNED_PAT = /\b(who|anyone|anybody|somebody|someone|which of us|we still need|we need|need someone|needs to be|who is going to|who's going to|who will|who can|who is)\b/i;
const STRONG_DECISION = /\b(we are doing|we're doing|we are going with|we'll|we will|let's|lets|decided|the plan is|plan is|going with|we have chosen|we chose|settled|so it's|so its|final|we go with|we are going to|we're going to|we split|we meet|we start)\b/i;
const CHANGE_PAT = /\b(instead|moved to|move to|moving to|changed to|change to|changing to|now it's|now its|no longer|cancel(l)?ed|postpone(d)?|reschedule(d)?|push(ed)? (it )?to|actually make it|correction|update:|shift(ed)? to|rather than|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|tonight|this weekend|\d{1,2}(?:am|pm)|\d{1,2}:\d{2})[\s,]*\bnot\b\s+)\b/i;
const LEAD_JUNK = /^(ok|okay|so|and|also|btw|guys|fine|then|well|please|pls|yeah|yah|yes|no|alright|cool|now|oh|ah|wait|important|anyway|sha|abi)\b[\s,!.:-]*/i;
const LEAD_TIME = /^(today|tonight|tomorrow|tmr|tmrw|monday|mon|tuesday|tue|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat|sunday|sun|next week|this weekend|later|now|asap|\d{1,2}(am|pm)|\d{1,2}:\d{2})\b[\s,!.:-]*/i;
const REFUSAL = /\b(cant|can't|cannot|won't|wont|unable|not able|i'm busy|i am busy|no time|im busy|i dey busy|not around|i'm not|im not)\b/i;
const PROPOSAL = /^(what|how|wat|hw)\s+about\b|^should\s+we\b|^can\s+we\b|^could\s+we\b|^shall\s+we\b|^what\s+if\b|^why\s+don't\s+we\b/i;
const POSITIVE = ["good","nice","great","love","perfect","works","solid","agreed","agree","yes","yeah","yah","fine","ok","okay","cool","bet","sure","🔥","💯","👍"];

const WEEKDAYS = { sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3, thursday: 4, thu: 4, thur: 4, thurs: 4, friday: 5, fri: 5, saturday: 6, sat: 6 };
const MONTHS = { jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11 };

function stem(w) { return w.replace(/(ing|ed|es|s)$/, ""); }
function tokenize(s) {
  return String(s || "").toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ").split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t)).map(stem);
}
function similar(a, b) {
  const A = new Set(tokenize(a)), B = new Set(tokenize(b));
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const t of A) if (B.has(t)) hit++;
  return hit / Math.sqrt(A.size * B.size);
}
function hasWord(hay, w) {
  if (!/[a-z0-9]/i.test(w)) return String(hay).includes(w);
  return new RegExp("\\b" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i").test(String(hay));
}

function isFiller(m) {
  const t = m.text.trim().toLowerCase();
  return m.media || t.length <= 3 || FILLER.has(t) || /^(lol|lmao|ok|okay|yes|no|yah|yep|alright|fine|k|o|na)l?a?$/i.test(t) || /^[\p{Emoji}\s]+$/u.test(t);
}
function ev(m) { return m ? { author: m.author, ts: m.ts, text: m.text.replace(/\s+/g, " ").slice(0, 300) } : null; }
function fmt(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) + ", " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function dayName(ms) { return new Date(ms).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }); }
function cap(s) { s = String(s || "").trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function detectDateOrder(messages) {
  let firstBig = 0, secondBig = 0;
  for (const m of messages) {
    const p = m.date.split(/[\/\-.]/).map(Number);
    if (p.length < 2) continue;
    if (p[0] > 12) firstBig++;
    if (p[1] > 12) secondBig++;
  }
  return secondBig > firstBig ? "MDY" : "DMY";
}

function toMs(m, order) {
  const p = m.date.split(/[\/\-.]/).map(Number);
  if (p.length < 3) return null;
  let y = p[2], day, mon;
  if (y < 100) y += 2000;
  if (order === "MDY") { mon = p[0] - 1; day = p[1]; } else { day = p[0]; mon = p[1] - 1; }
  const t = m.time.toLowerCase();
  let hh = 0, mm = 0;
  const ap = /(\d{1,2}):?(\d{2})?\s*(am|pm)/.exec(t);
  if (ap) { hh = Number(ap[1]) % 12; if (ap[3] === "pm") hh += 12; mm = Number(ap[2] || 0); }
  else { const h24 = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(t); if (h24) { hh = Number(h24[1]); mm = Number(h24[2]); } }
  const d = new Date(y, mon, day, hh, mm, 0, 0);
  return isNaN(d.getTime()) ? null : d.getTime();
}

function resolveWhen(text, refMs) {
  const t = " " + String(text || "").toLowerCase() + " ";
  const d0 = new Date(refMs);
  let base = null, label = null;

  const rel = t.match(/\b(today|tonight|tomorrow|tmr|tmrw|day after tomorrow|next week|this weekend)\b/);
  const mon = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\b/);
  const wd = t.match(/\b(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)\b/);
  const slash = t.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);

  if (rel) {
    const k = rel[1];
    base = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate(), 9, 0, 0);
    if (k === "tomorrow" || k === "tmr" || k === "tmrw") { base.setDate(base.getDate() + 1); label = "tomorrow (" + dayName(base.getTime()) + ")"; }
    else if (k === "day after tomorrow") { base.setDate(base.getDate() + 2); label = dayName(base.getTime()); }
    else if (k === "next week") { base.setDate(base.getDate() + 7); label = "next week"; }
    else if (k === "this weekend") { base.setDate(base.getDate() + ((6 - base.getDay() + 7) % 7)); label = dayName(base.getTime()); }
    else if (k === "tonight") { label = "tonight"; }
    else { label = "today (" + dayName(base.getTime()) + ")"; }
  } else if (mon) {
    const cand = new Date(d0.getFullYear(), MONTHS[mon[2]], Number(mon[1]), 9, 0, 0);
    if (cand.getTime() < refMs - 2 * 86400000) cand.setFullYear(cand.getFullYear() + 1);
    base = cand; label = dayName(cand.getTime());
  } else if (wd) {
    const b = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate(), 9, 0, 0);
    let add = (WEEKDAYS[wd[1]] - b.getDay() + 7) % 7;
    if (add === 0 && /\bnext\b/.test(t)) add = 7;
    b.setDate(b.getDate() + add);
    if (b.getTime() < refMs - 3600000) b.setDate(b.getDate() + 7);
    base = b; label = dayName(b.getTime());
  } else if (slash) {
    let y = slash[3] ? Number(slash[3]) : d0.getFullYear();
    if (y < 100) y += 2000;
    base = new Date(y, Number(slash[2]) - 1, Number(slash[1]), 9, 0, 0);
    label = dayName(base.getTime());
  }
  if (!base) return null;

  const tm = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) || t.match(/\b(\d{1,2}):(\d{2})\b/);
  if (tm) {
    let hh = Number(tm[1]), mm = Number(tm[2] || 0);
    if (tm[3]) { hh = hh % 12; if (tm[3] === "pm") hh += 12; }
    base.setHours(hh, mm, 0, 0);
    label = label + " " + base.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  } else if (/tonight/.test(t)) { base.setHours(20, 0, 0, 0); }
  return { ms: base.getTime(), label: label.trim(), iso: base.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z" };
}

function questionType(q) {
  const t = String(q).toLowerCase().trim();
  if (/\b(who|whom|whose)\b/.test(t)) return "who";
  if (/\b(when|what time|what day|wat time)\b/.test(t)) return "when";
  if (/\bwhere\b/.test(t)) return "where";
  if (/how much|how many|how long|\bcost\b|\bprice\b|budget|pricing/.test(t)) return "howmuch";
  if (/\bwhy\b/.test(t)) return "why";
  if (/^(is|are|am|was|were|do|does|did|can|could|will|would|should|shall|has|have|had|must|may|might|anybody|anyone)\b/.test(t)) return "yesno";
  return "open";
}

function answerMatches(reply, type, names) {
  const t = reply.toLowerCase();
  switch (type) {
    case "who": return false;
    case "when": return /\b(today|tonight|tomorrow|tmr|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|\d{1,2}(am|pm)|\d{1,2}:\d{2}|\d{1,2}[\/\-]\d{1,2})\b/.test(t);
    case "where": return /\b(at|here|there|library|school|class|classroom|room|online|zoom|meet|house|my place|hall|lab)\b/.test(t);
    case "howmuch": return /\d{2,}/.test(t) || /[₦$£€]|\bnaira\b|\bk\b|thousand/.test(t);
    case "yesno": return AFFIRM.some((a) => hasWord(t, a)) || NEGATE.some((n) => hasWord(t, n));
    default: return reply.trim().length >= 8;
  }
}

const TAKES_IT = /^(me|mine|i'll|ill|i will|im|i'm|i am|i can|i got|i've got|i have|on me|myself|leave it to me|i'll do|i will do|i'll take|i will take|i'll bring|i'll handle|im on it|i'm on it|i dey)\b/i;

function namesSomeone(text, names, exclude) {
  const t = String(text || "").toLowerCase();
  return names.some((n) => {
    if (n === exclude) return false;
    const esc = n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("^" + esc + "\\b").test(t.trim()) || new RegExp("\\b" + esc + "\\b\\s*(will|'ll|ll|can|is|should|got|has|do|does|did|said|goes|go|coming|bring|handle|take)").test(t);
  });
}

function participantsOf(messages) {
  const map = new Map();
  for (const m of messages) map.set(m.author, (map.get(m.author) || 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
}

function splitClauses(text, names) {
  const subj = (names || []).concat(["i", "we", "you", "he", "she", "they", "i'll", "ill", "im", "i'm"])
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const splitter = new RegExp("[.!?;]+|\\s+\\band\\b\\s+(?=(?:" + subj + ")\\b)|\\s+\\bplus\\b\\s+(?=(?:" + subj + ")\\b)", "i");
  return String(text).replace(/\s+/g, " ").trim()
    .split(splitter)
    .map((c) => c.replace(/^[,\s]+/, "").replace(/[,.\s]+$/, "").trim())
    .filter((c) => c.length > 3);
}

function cleanTask(clause, names, speaker) {
  let c = clause.trim();
  let guard = 0;
  while (guard++ < 6) {
    const before = c;
    c = c.replace(LEAD_TIME, "");
    c = c.replace(LEAD_JUNK, "");
    if (c === before) break;
  }
  for (const n of names) {
    const re = new RegExp("^" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b[,\\s]*", "i");
    if (re.test(c)) { c = c.replace(re, ""); break; }
  }
  let prev = null;
  while (prev !== c) { prev = c; c = c.replace(LEAD_JUNK, ""); }
  c = c.replace(/^(you|u|ur|your|i|i'll|ill|i will|im|i'm|i am|we|my|me)\s+/i, "");
  c = c.replace(/^(will|would|can|could|shall|should|am|be|going to|gonna|have to|need to)\s+/i, "");
  c = c.split(/\s+(if|because|cos|so that)\s+/i)[0];
  if (c.length > 70) c = c.split(/,\s*/)[0];
  return cap(c.trim());
}

function extractQuestions(messages, names) {
  const WINDOW = 20, HOURS = 48;
  const out = [];
  for (let i = 0; i < messages.length; i++) {
    const q = messages[i];
    if (!q.isQuestion || q.media) continue;
    const type = questionType(q.text);
    const qTokens = new Set(tokenize(q.text));
    const proposal = PROPOSAL.test(q.text.trim());
    const confirmAsk = /\b(agreed|agree|ok|okay|right|yeah|yes|sure|cool|alright|deal|any objections|sha|abi|see this one|confirmed?)\s*\??$/i.test(q.text.trim());
    let answered = null, reasked = null, others = 0;
    for (let j = i + 1; j < Math.min(messages.length, i + 1 + WINDOW); j++) {
      const r = messages[j];
      if (q.tsMs && r.tsMs && r.tsMs - q.tsMs > HOURS * 3600000) break;
      if (r.author === q.author) {
        if (r.isQuestion && similar(r.text, q.text) > 0.4) reasked = r;
        continue;
      }
      if (isFiller(r)) continue;
      others++;
      if (r.isQuestion && type !== "yesno") continue;
      const t = r.text.toLowerCase().trim();
      const shares = tokenize(r.text).some((x) => qTokens.has(x));
      if (confirmAsk && AFFIRM.some((w) => hasWord(t, w))) { answered = r; break; }
      if (type === "who" && ((TAKES_IT.test(t) && (shares || r.text.trim().length < 25)) || (shares && namesSomeone(r.text, names, q.author)))) { answered = r; break; }
      if (proposal) {
        if (shares && (POSITIVE.some((w) => hasWord(t, w)) || NEGATE.some((w) => hasWord(t, w)))) { answered = r; break; }
        continue;
      }
      if (!shares) continue;
      if (answerMatches(r.text, type, names)) { answered = r; break; }
    }
    if (!answered) {
      const qt = tokenize(q.text);
      const workish = /\b(who|when|where|how much|budget|price|pricing|bring|buy|send|make|do|poster|prototype|slides|script|demo|meet|time|cost|pay|print|design|extension|regulator|video|record|submit|deadline|test|share|logo|thumbnail|domain|hosting|rehearsal|tonight|tomorrow|weekend|free|available|ready)\b/i.test(q.text) || type === "who" || type === "when" || type === "howmuch" || type === "where";
      out.push({
        question: q.text.replace(/\s+/g, " ").slice(0, 220),
        asked_by: q.author, asked_at: fmt(q.tsMs), tsMs: q.tsMs, type: type,
        reasked: reasked ? { by: reasked.author, at: fmt(reasked.tsMs) } : null,
        partial: others > 0, evidence: ev(q), tokens: qt.length,
        priority: reasked ? 3 : workish && q.text.trim().length > 18 ? 2 : 1,
      });
    }
  }
  return out.sort((a, b) => b.priority - a.priority || (b.reasked ? 1 : 0) - (a.reasked ? 1 : 0) || (a.tsMs || 0) - (b.tsMs || 0));
}

function extractTasks(messages, names) {
  const out = [];
  const seen = new Set();
  for (const m of messages) {
    if (m.media) continue;
    const full = m.text.replace(/\s+/g, " ").trim();
    for (const clause of splitClauses(full, names)) {
      if (!VERB_RE.test(clause)) continue;
      if (REFUSAL.test(clause)) continue;
      const isQ = /\?$/.test(clause) || UNOWNED_PAT.test(clause) && questionType(clause) === "who";
      let owner = null, task = null, note = null;

      const namedOther = names.find((n) => n !== m.author && new RegExp("\\b" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i").test(clause));
      const verbIdx = clause.search(VERB_RE);
      const afterVerb = clause.slice(verbIdx).split(/\s+/).slice(1, 3).join(" ").toLowerCase();
      const pronounObject = PRONOUN_OBJ.has(afterVerb.split(" ")[0]);

      if (UNOWNED_PAT.test(clause)) {
        if (pronounObject) continue;
        owner = null;
        task = cleanTask(clause.replace(UNOWNED_PAT, "").replace(/^(is|are|will|would|can|should|going to|to)\s+/i, ""), names, m.author);
        note = "Raised in the group — nobody claimed it.";
        if (task.length < 6) continue;
      } else if (namedOther && new RegExp("^" + namedOther + "\\b", "i").test(clause.trim())) {
        owner = namedOther;
        task = cleanTask(clause, names, m.author);
      } else if (COMMIT_FIRST.test(clause) || COMMIT_SELF.test(clause)) {
        owner = m.author;
        task = cleanTask(clause, names, m.author);
      } else if (/\b(you|u|ur)\b/i.test(clause) && namedOther) {
        owner = namedOther;
        task = cleanTask(clause, names, m.author);
      } else if (/\b(you|u|ur)\b/i.test(clause)) {
        continue;
      } else {
        continue;
      }

      if (!task || task.length < 5 || /^[-\s]*$/i.test(task)) continue;
      if (isQ && owner && !UNOWNED_PAT.test(clause)) continue;
      const key = (owner || "?") + "|" + tokenize(task).slice(0, 5).join(" ");
      if (seen.has(key)) continue;
      seen.add(key);

      const w = resolveWhen(clause, m.tsMs || Date.now());
      out.push({
        task: task.slice(0, 120), owner: owner,
        due: w ? w.label : null, dueMs: w ? w.ms : null, dueIso: w ? w.iso : null,
        unowned: !owner, status: owner ? "claimed" : "unowned",
        note: note, evidence: ev(m), tsMs: m.tsMs,
      });
    }
  }
  return out;
}

function extractDecisions(messages, names) {
  const out = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.media) continue;
    const full = m.text.replace(/\s+/g, " ").trim();
    if (!STRONG_DECISION.test(full)) continue;
    if (REFUSAL.test(full)) continue;
    if (full.length < 18) continue;
    if (isFiller(m)) continue;
    const core = splitClauses(full, names).filter((c) => STRONG_DECISION.test(c) || VERB_RE.test(c)).join(". ");
    if (!core || core.length < 12) continue;

    const agreed = [], objected = [];
    for (let j = i + 1; j < Math.min(messages.length, i + 9); j++) {
      const r = messages[j];
      if (m.tsMs && r.tsMs && r.tsMs - m.tsMs > 3 * 3600000) break;
      if (r.author === m.author) continue;
      const t = r.text.toLowerCase().trim();
      if (STRONG_DECISION.test(r.text) && r.text.length > 25) break;
      if (NEGATE.some((n) => hasWord(t, n)) && !AFFIRM.some((a) => hasWord(t, a))) { if (!objected.includes(r.author)) objected.push(r.author); continue; }
      if (AFFIRM.some((a) => hasWord(t, a)) || (r.text.trim().length >= 4 && !isFiller(r))) { if (!agreed.includes(r.author)) agreed.push(r.author); }
    }
    const silent = names.filter((n) => n !== m.author && !agreed.includes(n) && !objected.includes(n));
    out.push({
      decision: cap(core).slice(0, 200), when: fmt(m.tsMs), proposed_by: m.author,
      agreed_by: agreed, silent: silent, objections: objected,
      confidence: agreed.length >= 2 ? "confirmed" : agreed.length === 1 ? "weakly confirmed" : "assumed",
      why: objected.length ? cap(objected.join(", ")) + " pushed back." : agreed.length >= 2 ? agreed.length + " people agreed on the record." : "Nobody explicitly agreed — it was assumed.",
      evidence: ev(m), tsMs: m.tsMs,
    });
  }
  return out;
}

function extractChanges(messages, names) {
  const out = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.media || !CHANGE_PAT.test(m.text)) continue;
    if (m.text.replace(/\s+/g, " ").trim().length < 14) continue;
    const ack = [];
    for (let j = i + 1; j < Math.min(messages.length, i + 20); j++) {
      const r = messages[j];
      if (m.tsMs && r.tsMs && r.tsMs - m.tsMs > 4 * 3600000) break;
      if (r.author !== m.author && !ack.includes(r.author)) ack.push(r.author);
    }
    const notAck = names.filter((n) => n !== m.author && !ack.includes(n));
    const text = m.text.replace(/\s+/g, " ").trim();
    out.push({
      what: "Plan change", to: cap(text).slice(0, 200), when: fmt(m.tsMs), relayed_by: m.author,
      acknowledged_by: ack, not_acknowledged: notAck,
      impact: notAck.length ? notAck.length + " of " + names.length + " never responded within 4 hours." : "Everyone responded within 4 hours.",
      evidence: ev(m), tsMs: m.tsMs,
    });
  }
  return out;
}

function extractMoney(messages, names) {
  const CTX = /\b(total|each|owe|owed|paid|pay|bought|buy|cost|costs|price|pricing|prices|split|budget|receipt|naira|balance|charge|charged|found|quote|selling|amount|money|cash|transfer|send)\b/i;
  const entries = [];
  for (const m of messages) {
    if (m.media) continue;
    const raw = m.text.replace(/\s+/g, " ").trim();
    const hasCtx = CTX.test(raw);
    const found = [];
    let mm;
    const sym = /([₦$£€])\s?([\d,]+(?:\.\d+)?)/g;
    while ((mm = sym.exec(raw)) !== null) found.push({ value: Number(mm[2].replace(/,/g, "")), currency: mm[1] });
    const k = /([\d,]+(?:\.\d+)?)\s?(k|thousand)\b/gi;
    while ((mm = k.exec(raw)) !== null) found.push({ value: Number(mm[1].replace(/,/g, "")) * 1000, currency: "₦" });
    if (!found.length && hasCtx) {
      const bare = /\b([\d,]{3,}(?:\.\d+)?)\b/g;
      while ((mm = bare.exec(raw)) !== null) {
        const v = Number(mm[1].replace(/,/g, ""));
        if (v >= 50 && !/(18650|\d{4,}\s?(am|pm))/.test(mm[1])) found.push({ value: v, currency: "₦" });
      }
    }
    for (const f of found) {
      if (!f.value || f.value < 20) continue;
      const t = raw.toLowerCase();
      let kind = "mentioned";
      if (m.isQuestion || /\b(should|are we|what about|maybe|thinking|or)\b/.test(t) && /\b(or|should|are we)\b/.test(t)) kind = "proposed";
      else if (/\b(each|per person|we owe|each of us|apiece|per head)\b/.test(t)) kind = "share";
      else if (/\b(paid|bought|spent|total|cost|i sent|transferred)\b/.test(t) || COMMIT_SELF.test(raw)) kind = "paid";
      const payer = /(^|\s)(i|me|my)(\s|$)/i.test(t) && /\b(paid|bought|spent|sent|transfer)/i.test(t)
        ? m.author
        : (names.find((n) => n !== m.author && t.includes(n.toLowerCase())) || m.author);
      entries.push({ value: f.value, currency: f.currency, kind: kind, by: payer, ts: fmt(m.tsMs), evidence: ev(m) });
    }
  }
  if (!entries.length) return null;
  const paid = entries.filter((e) => e.kind === "paid");
  const shares = entries.filter((e) => e.kind === "share");
  const proposed = entries.filter((e) => e.kind === "proposed");
  const cur = (paid[0] || shares[0] || entries[0]).currency;
  const total = paid.reduce((a, b) => a + b.value, 0);
  const perHead = shares.length ? shares[shares.length - 1].value : (names.length > 1 ? Math.round(total / names.length) : total);
  const paidBy = new Map();
  for (const e of paid) paidBy.set(e.by, (paidBy.get(e.by) || 0) + e.value);
  const balances = total && names.length > 1
    ? names.map((n) => ({ person: n, net: (paidBy.get(n) || 0) - perHead })).filter((b) => Math.abs(b.net) >= 1).sort((a, b) => b.net - a.net)
    : [];
  return { currency: cur, total: total, perHead: perHead, entries: entries, proposed: proposed, balances: balances, count: names.length };
}

function loadBalance(messages, tasks, names) {
  const words = new Map();
  for (const m of messages) words.set(m.author, (words.get(m.author) || 0) + m.text.split(/\s+/).filter(Boolean).length);
  const claimed = new Map();
  for (const t of tasks) if (t.owner) claimed.set(t.owner, (claimed.get(t.owner) || 0) + 1);
  const raw = names.map((n) => ({ person: n, words: words.get(n) || 0, tasks: claimed.get(n) || 0 }));
  const score = raw.map((r) => r.words * 0.4 + r.tasks * 25);
  const sum = score.reduce((a, b) => a + b, 0) || 1;
  return raw.map((r, i) => ({
    person: r.person, share: Math.round((score[i] / sum) * 100),
    role: (r.tasks ? r.tasks + " claimed task" + (r.tasks === 1 ? "" : "s") : "no tasks claimed") + " · " + r.words + " words written",
  })).sort((a, b) => b.share - a.share);
}

function topics(messages) {
  const freq = new Map();
  for (const m of messages) for (const t of tokenize(m.text)) freq.set(t, (freq.get(t) || 0) + 1);
  return [...freq.entries()].filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([word, count]) => ({ word: word, count: count }));
}

function buildRisks(a, lastMs) {
  const risks = [];
  for (const t of a.action_items.filter((x) => !x.owner).slice(0, 3)) {
    const days = t.dueMs ? Math.round((t.dueMs - lastMs) / 86400000) : null;
    risks.push({ level: "high", text: "Nobody claimed: \"" + t.task.slice(0, 90) + "\"" + (t.due ? " — due " + t.due : "") + (days !== null && days <= 2 ? ". That is " + (days <= 0 ? "already past" : days + " day(s) away") + "." : ".") });
  }
  for (const q of a.open_questions.filter((x) => x.reasked).slice(0, 2)) {
    risks.push({ level: "high", text: "\"" + q.question.slice(0, 80) + "\" — " + q.asked_by + " got no answer and " + q.reasked.by + " had to ask again at " + q.reasked.at + "." });
  }
  const old = a.open_questions.filter((x) => x.priority >= 2 && !x.reasked && x.tsMs && lastMs - x.tsMs > 12 * 3600000);
  if (old.length) risks.push({ level: old.length > 2 ? "high" : "medium", text: old.length + " question(s) older than 12 hours with no usable reply. Oldest: \"" + old[old.length - 1].question.slice(0, 80) + "\" (" + old[old.length - 1].asked_by + ", " + old[old.length - 1].asked_at + ")." });
  for (const c of a.plan_changes) {
    if (c.not_acknowledged.length) risks.push({ level: c.not_acknowledged.length >= 2 ? "high" : "medium", text: "Plan changed at " + c.when + " and " + c.not_acknowledged.join(", ") + " never responded. If they missed it they will show up at the wrong time or place." });
  }
  const zero = a.load_balance.filter((l) => /no tasks claimed/.test(l.role));
  if (zero.length) risks.push({ level: "medium", text: zero.map((z) => z.person).join(", ") + " never claimed a single task in this chat." });
  if (a.load_balance.length >= 3) {
    const top = a.load_balance[0].share;
    const rest = a.load_balance.slice(1).reduce((s, b) => s + b.share, 0) / (a.load_balance.length - 1);
    if (top > rest * 1.7) risks.push({ level: "medium", text: a.load_balance[0].person + " is carrying " + top + "% of the visible work, well above everyone else." });
  }
  const assumed = a.decisions.filter((d) => d.confidence === "assumed");
  if (assumed.length) risks.push({ level: "medium", text: assumed.length + " thing(s) were stated as decided but nobody agreed on the record. Assumed agreement is how groups end up arguing later." });
  if (a.money && a.money.balances.filter((b) => b.net < 0).length) {
    const owing = a.money.balances.filter((b) => b.net < 0);
    risks.push({ level: "medium", text: owing.length + " people still owe money (" + owing.map((b) => b.person + " " + a.money.currency + Math.abs(Math.round(b.net)).toLocaleString()).join(", ") + "). Unsettled money is how groups fall apart on the last day." });
  }
  return risks.slice(0, 9);
}

function buildRecap(r) {
  const out = [];
  for (const d of r.decisions.filter((x) => x.confidence === "confirmed").slice(0, 2)) {
    out.push("DECIDED: " + d.decision.slice(0, 140) + " (" + d.proposed_by + ", " + d.when + ", agreed by " + d.agreed_by.join("/") + ")");
  }
  const next = r.action_items.filter((t) => t.owner && t.dueMs).sort((a, b) => a.dueMs - b.dueMs)[0];
  if (next) out.push("NEXT UP: " + next.owner + " — " + next.task.slice(0, 90) + " (due " + next.due + ")");
  const owners = r.action_items.filter((t) => t.owner);
  if (owners.length > 1) out.push("OWNERS: " + owners.slice(0, 6).map((t) => t.owner + " = " + t.task.slice(0, 42)).join(" · "));
  const un = r.action_items.filter((t) => !t.owner);
  if (un.length) out.push("⚠ NOBODY CLAIMED: " + un.slice(0, 3).map((t) => t.task.slice(0, 55)).join(" | "));
  if (r.open_questions.length) out.push("❓ STILL UNANSWERED: " + r.open_questions.filter((q) => q.priority >= 2).slice(0, 3).map((q) => "\"" + q.question.slice(0, 65) + "\" (" + q.asked_by + ")").join(" | "));
  for (const c of r.plan_changes.slice(0, 2)) if (c.not_acknowledged.length) out.push("🔀 CHANGED at " + c.when + " — never confirmed by " + c.not_acknowledged.join(", "));
  if (r.money && r.money.total) {
    out.push("💰 MONEY: " + r.money.currency + r.money.total.toLocaleString() + " paid, " + r.money.currency + Math.round(r.money.perHead).toLocaleString() + " per person" + (r.money.balances.filter((b) => b.net < 0).length ? ", " + r.money.balances.filter((b) => b.net < 0).length + " still owe" : ""));
  }
  if (!out.length) out.push("No decisions, claimed tasks or open questions were detected in this chat.");
  return out.slice(0, 8);
}

function analyse(messages) {
  const order = detectDateOrder(messages);
  for (const m of messages) m.tsMs = toMs(m, order);
  const names = participantsOf(messages).map((p) => p.name);
  const lastMs = messages.reduce((a, m) => Math.max(a, m.tsMs || 0), 0);
  const firstMs = messages.reduce((a, m) => (m.tsMs && (!a || m.tsMs < a) ? m.tsMs : a), 0);

  const open_questions = extractQuestions(messages, names);
  for (const q of open_questions) {
    q.why_it_matters = q.reasked
      ? "Asked by " + q.asked_by + " and never answered — " + q.reasked.by + " had to ask again at " + q.reasked.at + ". Someone is blocked on this."
      : q.partial
        ? "Asked by " + q.asked_by + " at " + q.asked_at + ". People replied, but nobody gave a " + q.type + "-shaped answer."
        : "Asked by " + q.asked_by + " at " + q.asked_at + ". Nobody replied at all.";
  }

  const a = {
    project: names.length + " people · " + messages.length + " messages · " + (firstMs ? dayName(firstMs) + " → " + dayName(lastMs) : ""),
    status: "", dateOrder: order,
    recap: [], decisions: extractDecisions(messages, names), action_items: extractTasks(messages, names),
    open_questions: open_questions, plan_changes: extractChanges(messages, names),
    risks: [], load_balance: [], money: extractMoney(messages, names), topics: topics(messages), ask_chips: [],
  };
  a.load_balance = loadBalance(messages, a.action_items, names);
  a.risks = buildRisks(a, lastMs);
  a.status = a.risks.filter((r) => r.level === "high").length + " high-risk finding(s)";
  a.recap = buildRecap(a);

  const unowned = a.action_items.find((t) => !t.owner);
  const strongQs = a.open_questions.filter((q) => q.priority >= 2);
  const lead = strongQs.filter((q) => ["who", "howmuch", "when"].includes(q.type)).pop() || strongQs.pop();
  a.ask_chips = [
    lead ? lead.question.slice(0, 55) : null,
    unowned ? "who is going to " + unowned.task.replace(/^(somebody|someone|we (still )?need( somebody| someone)?|need( somebody| someone)?)\s*(to)?\s*/i, "").toLowerCase().slice(0, 42) : null,
    a.money ? "how much do we each owe" : null,
    a.plan_changes[0] ? "when are we meeting" : (a.topics[0] ? a.topics[0].word : null),
  ].filter(Boolean).slice(0, 4);
  return a;
}

function searchChat(messages, query) {
  const q = tokenize(query);
  if (!q.length) return [];
  const df = new Map();
  const docs = messages.map((m) => {
    const toks = tokenize(m.text);
    for (const t of new Set(toks)) df.set(t, (df.get(t) || 0) + 1);
    return { m: m, toks: toks };
  });
  const N = docs.length || 1;
  return docs.map((d) => {
    let s = 0;
    for (const t of q) {
      const f = d.toks.filter((x) => x === t || x.startsWith(t) || t.startsWith(x)).length;
      if (!f) continue;
      s += (1 + Math.log(f)) * Math.log(1 + N / (1 + (df.get(t) || 0)));
    }
    if (q.some((t) => d.m.author.toLowerCase().includes(t))) s += 1.5;
    if (d.m.isQuestion && /(who|when|where|what|why|how much)/.test(query.toLowerCase())) s += 0.4;
    return { m: d.m, score: s };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 4)
    .map((x) => Object.assign(ev(x.m), { score: Math.round(x.score * 100) / 100 }));
}
