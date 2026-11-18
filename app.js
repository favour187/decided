const $ = (s, r = document) => r.querySelector(s);

const $$ = (s, r = document) => [ ...r.querySelectorAll(s) ];

const state = {
  raw: "",
  messages: [],
  stats: null,
  analysis: null,
  mode: "demo"
};

document.addEventListener("DOMContentLoaded", () => {
  $("#analyseBtn").addEventListener("click", () => run($("#chatInput").value));
  $("#demoBtn").addEventListener("click", () => {
    $("#chatInput").value = DEMO_CHAT;
    toast("Demo chat loaded — now hit Untangle it");
    run(DEMO_CHAT);
  });
  $("#fileInput").addEventListener("change", e => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader;
    r.onload = () => {
      $("#chatInput").value = r.result;
      toast(`Read ${f.name}`);
      run(r.result);
    };
    r.readAsText(f);
  });
  $("#againBtn").addEventListener("click", () => {
    $("#resultsPanel").hidden = true;
    $("#inputPanel").hidden = false;
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });
  $("#copyRecap").addEventListener("click", copyRecap);
  $("#icsBtn").addEventListener("click", downloadIcs);
  $("#askForm").addEventListener("submit", e => {
    e.preventDefault();
    ask($("#askInput").value);
  });
  $("#fontToggle").addEventListener("click", () => toggleBody("easy", $("#fontToggle"), "Aa Easy read", "Aa Default type", "Easy-read type on"));
  $("#contrastToggle").addEventListener("click", () => toggleBody("contrast", $("#contrastToggle"), "◐ High contrast", "◐ Normal contrast", "High contrast on"));
  $("#sizeToggle").addEventListener("click", () => toggleBody("big", $("#sizeToggle"), "A+ Larger text", "A– Default text", "Larger text on"));
  $("#motionToggle").addEventListener("click", () => toggleBody("still", $("#motionToggle"), "✦ Reduce motion", "✦ Motion allowed", "Motion reduced"));
  $("#settingsBtn").addEventListener("click", toggleSettings);
  [ "dragenter", "dragover" ].forEach(ev => document.addEventListener(ev, e => {
    e.preventDefault();
    $("#drop").classList.add("over");
  }));
  [ "dragleave", "drop" ].forEach(ev => document.addEventListener(ev, e => {
    e.preventDefault();
    if (ev === "drop" || e.target === document.body) $("#drop").classList.remove("over");
  }));
  document.addEventListener("drop", e => {
    e.preventDefault();
    $("#drop").classList.remove("over");
    const f = e.dataTransfer?.files?.[0];
    if (!f) return;
    const r = new FileReader;
    r.onload = () => {
      $("#chatInput").value = r.result;
      toast(`Read ${f.name}`);
      run(r.result);
    };
    r.readAsText(f);
  });
});

async function run(raw) {
  if (!raw || !raw.trim()) {
    toast("Paste a chat first — or load the demo 🦫");
    $("#chatInput").focus();
    return;
  }
  state.raw = raw;
  const {messages: messages, skipped: skipped} = parseChat(raw);
  if (!messages.length) {
    toast("Couldn't find any messages. Try a real WhatsApp export (⋮ → More → Export chat).");
    return;
  }
  state.messages = messages;
  state.stats = chatStats(messages);
  showLoading(messages.length);
  if (messages.length > 500) revealCapybara(messages.length);
  const key = $("#apiKey").value.trim();
  try {
    if (key) {
      state.analysis = await analyseLive(messages, key);
      state.mode = "live";
    } else {
      await fakeDelay(900);
      state.analysis = JSON.parse(JSON.stringify(DEMO_ANALYSIS));
      state.mode = "demo";
    }
  } catch (err) {
    console.error(err);
    hideLoading();
    toast("Live analysis failed — falling back to demo mode. (" + err.message + ")");
    state.analysis = JSON.parse(JSON.stringify(DEMO_ANALYSIS));
    state.mode = "demo";
  }
  attachEvidence(state.analysis);
  hideLoading();
  render();
}

function attachEvidence(a) {
  const grab = o => {
    if (!o || !o.evidence_needle) return null;
    const m = findEvidence(state.messages, o.evidence_needle, o.owner || o.asked_by || o.proposed_by || o.relayed_by);
    return m ? {
      author: m.author,
      ts: m.ts,
      text: m.text
    } : null;
  };
  (a.decisions || []).forEach(d => d.evidence = grab(d));
  (a.action_items || []).forEach(t => t.evidence = grab(t));
  (a.open_questions || []).forEach(q => q.evidence = grab(q));
  (a.plan_changes || []).forEach(c => c.evidence = grab(c));
}

async function analyseLive(messages, key) {
  const base = $("#apiBase").value.trim() || "https://api.openai.com/v1/chat/completions";
  const model = $("#apiModel").value.trim() || "gpt-4o-mini";
  const transcript = messages.slice(-400).map(m => `[${m.ts}] ${m.author}: ${m.text.replace(/\n+/g, " ")}`).join("\n");
  const system = `You are "Decided", an analyst for teen group chats (mostly WhatsApp). You turn a chaotic group conversation into a reliable record so a group stops doing duplicate work.\n\nReturn ONLY valid JSON, no markdown fences, matching this exact shape:\n{\n  "project": "short name of what the group is doing",\n  "status": "one line: on track / at risk / blocked, with the reason",\n  "recap": ["5-8 short lines a teen could paste straight back into the group. Lead with the most consequential."],\n  "decisions": [{"decision":"","when":"","proposed_by":"","agreed_by":[],"silent":[],"confidence":"confirmed|assumed","why":"","evidence_needle":"a distinctive 3-6 word phrase copied EXACTLY from the source message"}],\n  "action_items": [{"task":"","owner":"person's name or null if nobody claimed it","due":"","status":"done|in_progress|at_risk|not_started|unowned|just_claimed","note":"","evidence_needle":"exact phrase from source"}],\n  "open_questions": [{"question":"","asked_by":"","asked_at":"","why_it_matters":"what breaks if this stays unanswered","evidence_needle":"exact phrase from source"}],\n  "plan_changes": [{"what":"","from":"","to":"","when":"","relayed_by":"","acknowledged_by":[],"not_acknowledged":[],"impact":"","evidence_needle":"exact phrase from source"}],\n  "risks": [{"level":"high|medium","text":""}],\n  "load_balance": [{"person":"","share":0,"role":""}],\n  "ask_chips": ["4 good questions someone could ask this chat"]\n}\n\nRules:\n- open_questions is your most important output: questions asked in the group that nobody answered. Rank them by what breaks first.\n- Set owner to null for any task nobody claimed. That is a finding, not an omission.\n- For load_balance, share = that person's percentage of claimed work (not messages). Shares should total ~100.\n- Every evidence_needle MUST be copied verbatim from the transcript so it can be located again.\n- Be concrete and use the group's own words. No corporate tone. No filler.`;
  const res = await fetch(base, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: model,
      temperature: .2,
      response_format: {
        type: "json_object"
      },
      messages: [ {
        role: "system",
        content: system
      }, {
        role: "user",
        content: `TRANSCRIPT (${messages.length} messages):\n\n${transcript}`
      } ]
    })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text().then(t => t.slice(0, 120))}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || "";
  const clean = text.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  const parsed = JSON.parse(clean);
  if (!parsed.recap) throw new Error("model returned an unexpected shape");
  return parsed;
}

async function askLive(question, key) {
  const base = $("#apiBase").value.trim() || "https://api.openai.com/v1/chat/completions";
  const model = $("#apiModel").value.trim() || "gpt-4o-mini";
  const transcript = state.messages.map(m => `[${m.ts}] ${m.author}: ${m.text.replace(/\n+/g, " ")}`).join("\n");
  const res = await fetch(base, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: model,
      temperature: .1,
      response_format: {
        type: "json_object"
      },
      messages: [ {
        role: "system",
        content: `Answer using ONLY the transcript. Return JSON: {"answer":"2-4 sentences, concrete, in the group's own words","evidence_needle":"3-6 words copied EXACTLY from the message that proves it"}. If the transcript has no answer, say so plainly in "answer" and note who should be asked.`
      }, {
        role: "user",
        content: `TRANSCRIPT:\n${transcript}\n\nQUESTION: ${question}`
      } ]
    })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim());
}

function render() {
  const a = state.analysis, s = state.stats;
  $("#inputPanel").hidden = true;
  $("#resultsPanel").hidden = false;
  $("#projectName").textContent = a.project || "Your group chat";
  $("#chatMeta").textContent = `${s.total} messages · ${s.volume} · ${s.participants.length} people · ${s.daySpan} day${s.daySpan === 1 ? "" : "s"} · ${s.questionsAsked} questions asked · ${s.nightMessages} after 10pm` + (state.mode === "demo" ? " · demo mode" : " · live AI");
  $("#receiptId").textContent = `RCPT-${hash(state.raw).toUpperCase()}-${(new Date).toISOString().slice(5, 10).replace("-", "")}`;
  renderProof(a, s);
  renderRecap(a);
  renderRisks(a);
  renderOpen(a);
  renderActions(a);
  renderLoad(a);
  renderDecisions(a);
  renderChanges(a);
  renderAsk(a);
  $("#resultsPanel").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function renderProof(a, s) {
  const open = (a.open_questions || []).length;
  const unowned = (a.action_items || []).filter(t => !t.owner).length;
  const changes = (a.plan_changes || []).length;
  const decisions = (a.decisions || []).length;
  const cells = [ {
    n: s.total,
    l: "messages read",
    c: "info"
  }, {
    n: s.questionsAsked,
    l: "questions asked",
    c: "info"
  }, {
    n: open,
    l: "asked &amp; never answered",
    c: open ? "bad" : "good"
  }, {
    n: unowned,
    l: "tasks nobody claimed",
    c: unowned ? "bad" : "good"
  }, {
    n: decisions,
    l: "decisions on the record",
    c: "good"
  }, {
    n: changes,
    l: "plan changes to confirm",
    c: changes ? "warn" : "good"
  } ];
  $("#proofStrip").innerHTML = cells.map(c => `<div class="proof-cell ${c.c}"><b>${c.n}</b><span>${c.l}</span></div>`).join("");
}

function renderRecap(a) {
  $("#recapList").innerHTML = (a.recap || []).map(r => `<li><span>${esc(r)}</span></li>`).join("");
}

function renderRisks(a) {
  const list = a.risks || [];
  $("#risksBlock").hidden = !list.length;
  $("#risksList").innerHTML = list.map(r => `<li class="${r.level === "high" ? "high" : "med"}"><span class="lvl">${r.level === "high" ? "HIGH" : "MED"}</span><span>${esc(r.text)}</span></li>`).join("");
}

function renderOpen(a) {
  const list = a.open_questions || [];
  $("#openCount").textContent = list.length;
  $("#openBlock").hidden = !list.length;
  $("#openList").innerHTML = list.map(q => `\n    <li>\n      <div class="card-top">\n        <p class="card-title">“${esc(q.question)}”</p>\n        <span class="badge red">unanswered · ${esc(q.asked_at || "")}</span>\n      </div>\n      <p class="card-why"><strong>Asked by ${esc(q.asked_by || "someone")}.</strong> ${esc(q.why_it_matters || "")}</p>\n      ${evidenceHtml(q.evidence)}\n    </li>`).join("");
}

function renderActions(a) {
  const items = a.action_items || [];
  $("#actionsBlock").hidden = !items.length;
  const tb = $("#actionsTable tbody");
  tb.innerHTML = items.map((t, i) => {
    const unowned = !t.owner;
    const badge = statusBadge(t.status, unowned);
    return `<tr class="${unowned ? "unowned" : ""}">\n      <td><strong>${esc(t.task)}</strong>${t.note ? `<br><span style="color:var(--ink3);font-size:12.5px">${esc(t.note)}</span>` : ""}<br>${badge}</td>\n      <td class="owner">${unowned ? "⚠ NOBODY" : esc(t.owner)}</td>\n      <td class="due">${esc(t.due || "—")}</td>\n      <td>${t.evidence ? `<button class="evlink" type="button" data-ev="${i}">receipt ↗</button>` : "—"}</td>\n    </tr>`;
  }).join("");
  $$(".evlink", tb).forEach(b => b.addEventListener("click", () => {
    const t = items[+b.dataset.ev];
    openReceipt(t.evidence, t.task);
  }));
}

function statusBadge(status, unowned) {
  if (unowned) return `<span class="badge red">UNOWNED</span>`;
  const map = {
    done: [ "green", "done" ],
    in_progress: [ "blue", "in progress" ],
    at_risk: [ "red", "at risk" ],
    not_started: [ "amber", "not started" ],
    just_claimed: [ "amber", "just claimed" ],
    unowned: [ "red", "UNOWNED" ]
  };
  const [cls, label] = map[status] || [ "", status || "" ];
  return cls ? `<span class="badge ${cls}">${esc(label)}</span>` : "";
}

function renderLoad(a) {
  const list = a.load_balance || [];
  $("#loadBlock").hidden = !list.length;
  $("#loadChart").innerHTML = list.map(p => {
    const cls = p.share >= 30 ? "hot" : p.share <= 8 ? "low" : "";
    return `<div class="load-row">\n      <span class="load-name" title="${esc(p.role || "")}">${esc(p.person)}</span>\n      <span class="load-bar"><span class="load-fill ${cls}" style="width:0%" data-w="${Math.min(100, p.share)}"></span></span>\n      <span class="load-pct">${p.share}%</span>\n    </div>`;
  }).join("");
  requestAnimationFrame(() => $$(".load-fill").forEach(el => el.style.width = el.dataset.w + "%"));
}

function renderDecisions(a) {
  const list = a.decisions || [];
  $("#decisionsBlock").hidden = !list.length;
  $("#decisionsList").innerHTML = list.map(d => `\n    <li>\n      <div class="card-top">\n        <p class="card-title">${esc(d.decision)}</p>\n        <span class="badge ${d.confidence === "assumed" ? "amber" : "green"}">${d.confidence === "assumed" ? "never explicitly agreed" : "confirmed"}</span>\n      </div>\n      <p class="card-why">\n        ${esc(d.when || "")} · proposed by <strong>${esc(d.proposed_by || "?")}</strong>\n        ${(d.agreed_by || []).length ? ` · agreed: ${d.agreed_by.map(esc).join(", ")}` : ""}\n        ${(d.silent || []).length ? ` · <span style="color:var(--red)">silent: ${d.silent.map(esc).join(", ")}</span>` : ""}\n        ${d.why ? `<br>${esc(d.why)}` : ""}\n      </p>\n      ${evidenceHtml(d.evidence)}\n    </li>`).join("");
}

function renderChanges(a) {
  const list = a.plan_changes || [];
  $("#changesBlock").hidden = !list.length;
  $("#changesList").innerHTML = list.map(c => `\n    <li>\n      <div class="card-top">\n        <p class="card-title">${esc(c.what)}: <s style="color:var(--ink3)">${esc(c.from)}</s> → <strong style="color:var(--amber)">${esc(c.to)}</strong></p>\n        <span class="badge amber">${esc(c.when || "")}</span>\n      </div>\n      <p class="card-why">\n        Relayed by <strong>${esc(c.relayed_by || "?")}</strong>\n        ${(c.not_acknowledged || []).length ? ` · <span style="color:var(--red)">never confirmed by: ${c.not_acknowledged.map(esc).join(", ")}</span>` : ""}\n        ${c.impact ? `<br>${esc(c.impact)}` : ""}\n      </p>\n      ${evidenceHtml(c.evidence)}\n    </li>`).join("");
}

function renderAsk(a) {
  const chips = a.ask_chips || [];
  $("#askChips").innerHTML = chips.map(c => `<button class="chip" type="button">${esc(c)}</button>`).join("");
  $$("#askChips .chip").forEach(b => b.addEventListener("click", () => {
    $("#askInput").value = b.textContent;
    ask(b.textContent);
  }));
  $("#askAnswer").hidden = true;
}

function evidenceHtml(ev) {
  if (!ev) return "";
  return `<details class="ev"><summary>show the receipt</summary>\n    <div class="evidence"><div class="ev-meta"><b>${esc(ev.author)}</b><span>${esc(ev.ts)}</span></div>\n    <div class="ev-text">“${esc(ev.text)}”</div></div></details>`;
}

function openReceipt(ev, title) {
  if (!ev) return;
  const box = $("#askAnswer");
  box.hidden = false;
  box.innerHTML = `<h4>📎 ${esc(title || "")}</h4>\n    <div class="evidence" style="margin-top:8px"><div class="ev-meta"><b>${esc(ev.author)}</b><span>${esc(ev.ts)}</span></div>\n    <div class="ev-text">“${esc(ev.text)}”</div></div>`;
  box.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

async function ask(q) {
  q = (q || "").trim();
  if (!q) return;
  const box = $("#askAnswer");
  box.hidden = false;
  box.innerHTML = `<h4>…</h4><p style="color:var(--ink3)">Searching ${state.messages.length} messages.</p>`;
  const key = $("#apiKey").value.trim();
  let answer = null, ev = null;
  if (key && state.mode === "live") {
    try {
      const r = await askLive(q, key);
      answer = r.answer;
      ev = r.evidence_needle ? findEvidence(state.messages, r.evidence_needle) : null;
    } catch (e) {
      answer = "Live lookup failed: " + e.message;
    }
  } else {
    await fakeDelay(420);
    const hit = DEMO_ANSWERS.find(d => d.match.some(m => q.toLowerCase().includes(m)));
    if (hit) {
      answer = hit.answer;
      ev = findEvidence(state.messages, hit.needle);
    } else {
      const m = findEvidence(state.messages, q);
      answer = m ? `Closest match in the chat — ${m.author} said this. Ask something more specific, or add an API key under ⚙ AI for a full live answer.` : `Nothing in this chat answers that. That may itself be the finding — if it should have been answered, it's an open question. (Demo mode: add an API key under ⚙ AI for live answers.)`;
      ev = m;
    }
  }
  box.innerHTML = `<h4>“${esc(q)}”</h4><p>${esc(answer || "")}</p>${ev ? `<div class="evidence"><div class="ev-meta"><b>${esc(ev.author)}</b><span>${esc(ev.ts)}</span></div><div class="ev-text">“${esc(ev.text)}”</div></div>` : ""}`;
}

function copyRecap() {
  const a = state.analysis;
  const lines = [ `📋 ${a.project || "GROUP RECAP"} — ${(new Date).toLocaleDateString()}`, ...(a.recap || []).map(r => `› ${r}`) ];
  const open = a.open_questions || [];
  if (open.length) {
    lines.push("", "❓ STILL UNANSWERED:");
    open.forEach(q => lines.push(`• ${q.question} (asked by ${q.asked_by}, ${q.asked_at})`));
  }
  const unowned = (a.action_items || []).filter(t => !t.owner);
  if (unowned.length) {
    lines.push("", "⚠ NOBODY HAS CLAIMED:");
    unowned.forEach(t => lines.push(`• ${t.task}${t.due ? ` — due ${t.due}` : ""}`));
  }
  lines.push("", "— made with Decided 🦫");
  const text = lines.join("\n");
  navigator.clipboard?.writeText(text).then(() => toast("Recap copied — paste it back into the group")).catch(() => {
    prompt("Copy manually:", text);
  });
}

function downloadIcs() {
  const items = (state.analysis.action_items || []).filter(t => t.due);
  const lines = [ "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Decided//TripleH//EN", "CALSCALE:GREGORIAN" ];
  let n = 0;
  for (const t of items) {
    const d = guessDate(t.due);
    if (!d) continue;
    n++;
    lines.push("BEGIN:VEVENT", `UID:decided-${hash(state.raw)}-${n}@tripleh`, `DTSTAMP:${(new Date).toISOString().replace(/[-:]/g, "").split(".")[0]}Z`, `DTSTART:${d}`, `DTEND:${plusHour(d)}`, `SUMMARY:${icsEsc((t.owner ? t.owner + ": " : "UNOWNED: ") + t.task)}`, `DESCRIPTION:${icsEsc(t.note || "From your group chat, via Decided")}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  if (!n) {
    toast("No dated deadlines found to export");
    return;
  }
  const blob = new Blob([ lines.join("\r\n") ], {
    type: "text/calendar"
  });
  const url = URL.createObjectURL(blob);
  const el = document.createElement("a");
  el.href = url;
  el.download = "decided-deadlines.ics";
  el.click();
  URL.revokeObjectURL(url);
  toast(`Exported ${n} deadline${n === 1 ? "" : "s"} to your calendar`);
}

const MONTHS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12
};

function guessDate(str) {
  if (!str) return null;
  const s = str.toLowerCase();
  const year = (s.match(/20\d{2}/) || [ (new Date).getFullYear() ])[0];
  let month = null;
  for (const k in MONTHS) if (s.includes(k)) {
    month = MONTHS[k];
    break;
  }
  const dayNum = s.match(/\b(\d{1,2})\b/);
  if (month && dayNum) {
    const d = new Date(Date.UTC(+year, month - 1, Math.min(28, +dayNum[1]), 8, 0, 0));
    return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  }
  return null;
}

function plusHour(ics) {
  const d = new Date(ics.replace("Z", "").replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, "$1-$2-$3T$4:$5:$6Z"));
  d.setUTCHours(d.getUTCHours() + 1);
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function icsEsc(s) {
  return String(s).replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
}

function toggleBody(cls, btn, offLabel, onLabel, msg) {
  const on = document.body.classList.toggle(cls);
  btn.setAttribute("aria-pressed", String(on));
  btn.innerHTML = on ? onLabel : offLabel;
  toast(on ? msg : "Reset");
}

function toggleSettings() {
  const p = $("#settings"), b = $("#settingsBtn");
  p.hidden = !p.hidden;
  b.setAttribute("aria-expanded", String(!p.hidden));
  if (!p.hidden) $("#apiKey").focus();
}

function showLoading(n) {
  $("#loading").hidden = false;
  const msgs = [ `Reading ${n} messages so you don't have to…`, "Separating decisions from noise…", "Looking for questions nobody answered…", "Checking who actually agreed…", "Finding the work nobody claimed…" ];
  let i = 0;
  $("#loadingText").textContent = msgs[0];
  showLoading._t = setInterval(() => {
    i = (i + 1) % msgs.length;
    $("#loadingText").textContent = msgs[i];
  }, 1400);
}

function hideLoading() {
  $("#loading").hidden = true;
  clearInterval(showLoading._t);
}

function revealCapybara(n) {
  $("#capyCount").textContent = `${n.toLocaleString()} messages. That's a capybara-sized mess.`;
  $("#capySecret").hidden = false;
  setTimeout(() => $("#capySecret").hidden = true, 7e3);
}

let toastT;

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => t.hidden = true, 3200);
}

function fakeDelay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(16).padStart(6, "0").slice(0, 6);
}
