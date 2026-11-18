const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const state = { raw: "", messages: [], stats: null, analysis: null, mode: "engine" };

document.addEventListener("DOMContentLoaded", () => {
  $("#analyseBtn").addEventListener("click", () => run($("#chatInput").value));
  $("#demoBtn").addEventListener("click", () => { $("#chatInput").value = DEMO_CHAT; run(DEMO_CHAT); });
  $("#fileInput").addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) readFile(f);
  });
  $("#againBtn").addEventListener("click", () => {
    $("#resultsPanel").hidden = true;
    $("#inputPanel").hidden = false;
    $("#capySecret").hidden = true;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  $("#copyRecap").addEventListener("click", copyRecap);
  $("#icsBtn").addEventListener("click", downloadIcs);
  $("#askForm").addEventListener("submit", (e) => { e.preventDefault(); ask($("#askInput").value); });
  $("#fontToggle").addEventListener("click", () => toggleBody("easy", $("#fontToggle"), "Aa Easy read", "Aa Default type", "Easy-read type on"));
  $("#contrastToggle").addEventListener("click", () => toggleBody("contrast", $("#contrastToggle"), "◐ High contrast", "◐ Normal contrast", "High contrast on"));
  $("#sizeToggle").addEventListener("click", () => toggleBody("big", $("#sizeToggle"), "A+ Larger text", "A– Default text", "Larger text on"));
  $("#motionToggle").addEventListener("click", () => toggleBody("still", $("#motionToggle"), "✦ Reduce motion", "✦ Motion allowed", "Motion reduced"));
  $("#settingsBtn").addEventListener("click", toggleSettings);
  restoreSettings();
  ["apiKey", "apiBase", "apiModel"].forEach((id) => $("#" + id).addEventListener("change", persistSettings));
  $("#grokBtn").addEventListener("click", () => {
    $("#apiBase").value = "https://api.x.ai/v1/chat/completions";
    $("#apiModel").value = "grok-4-1-fast-reasoning";
    persistSettings();
    toast("Grok preset set — paste your xAI key above");
    $("#apiKey").focus();
  });
  $("#openaiBtn").addEventListener("click", () => {
    $("#apiBase").value = "https://api.openai.com/v1/chat/completions";
    $("#apiModel").value = "gpt-4o-mini";
    persistSettings();
  });
  $("#draftBtn").addEventListener("click", draftReply);
  $("#redraftBtn").addEventListener("click", draftReply);
  $("#copyReply").addEventListener("click", copyReplyText);

  ["dragenter", "dragover"].forEach((ev) => document.addEventListener(ev, (e) => { e.preventDefault(); $("#drop").classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => document.addEventListener(ev, (e) => { e.preventDefault(); $("#drop").classList.remove("over"); }));
  document.addEventListener("drop", (e) => {
    e.preventDefault();
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) readFile(f);
  });
});

function readFile(f) {
  const r = new FileReader();
  r.onload = () => { $("#chatInput").value = r.result; toast("Read " + f.name); run(r.result); };
  r.onerror = () => toast("Could not read that file");
  r.readAsText(f);
}

async function run(raw) {
  if (!raw || !raw.trim()) { toast("Paste a chat first, or load the demo"); $("#chatInput").focus(); return; }
  state.raw = raw;
  const parsed = parseChat(raw);
  if (!parsed.messages.length) { toast("No messages found. Use a real WhatsApp export: More > Export chat > Without media."); return; }
  state.messages = parsed.messages;
  state.stats = chatStats(parsed.messages);

  showLoading(parsed.messages.length);
  if (parsed.messages.length > 500) revealCapybara(parsed.messages.length);

  const t0 = now();
  const key = $("#apiKey").value.trim();
  try {
    if (key) {
      try {
        state.analysis = await analyseLive(parsed.messages, key);
        state.mode = "live";
      } catch (err) {
        state.analysis = analyse(parsed.messages);
        state.mode = "engine";
        toast("AI unavailable (" + err.message + ") — used the built-in engine instead");
      }
    } else {
      await nextPaint();
      state.analysis = analyse(parsed.messages);
      state.mode = "engine";
    }
  } catch (err) {
    hideLoading();
    console.error(err);
    toast("Analysis hit a snag on this file: " + err.message);
    return;
  }
  state.ms = Math.round((now() - t0) * 10) / 10;
  hideLoading();
  render();
}

function now() { return (window.performance || Date).now(); }

function nextPaint() {
  return new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
}

async function analyseLive(messages, key) {
  const base = $("#apiBase").value.trim() || "https://api.openai.com/v1/chat/completions";
  const model = $("#apiModel").value.trim() || "gpt-4o-mini";
  const transcript = messages.slice(-500).map((m) => "[" + m.ts + "] " + m.author + ": " + m.text.replace(/\n+/g, " ")).join("\n");
  const system = "You are Decided. Turn a group chat into a record. Return ONLY JSON with keys: project, status, recap (array of short lines), decisions (array of {decision,when,proposed_by,agreed_by,silent,confidence,why}), action_items (array of {task,owner,due,status,note}), open_questions (array of {question,asked_by,asked_at,why_it_matters}), plan_changes (array of {what,from,to,when,relayed_by,acknowledged_by,not_acknowledged,impact}), risks (array of {level,text}), load_balance (array of {person,share,role}), ask_chips (array of strings). Set owner to null for any task nobody claimed. Surface questions that were asked and never answered. Be concrete, use the group's own words.";
  const res = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify({ model: model, temperature: 0.2, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: "TRANSCRIPT:\n" + transcript }] }),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();
  const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
  const out = JSON.parse(text.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim());
  if (!out.recap) throw new Error("unexpected shape");
  return out;
}

function render() {
  const a = state.analysis, s = state.stats;
  $("#inputPanel").hidden = true;
  $("#resultsPanel").hidden = false;
  $("#projectName").textContent = a.project || "Your group chat";
  $("#chatMeta").textContent = s.total + " messages · " + s.volume + " · " + s.participants.length + " people · " + s.daySpan + " days · dates read as " + (a.dateOrder === "MDY" ? "MM/DD/YY" : "DD/MM/YY") + " · read in " + (state.ms < 1000 ? state.ms + "ms" : (state.ms / 1000).toFixed(1) + "s") + (state.mode === "live" ? " · AI mode" : " · analysed in your browser, nothing uploaded");
  $("#receiptId").textContent = "RCPT-" + hash(state.raw).toUpperCase();
  renderProof(a, s);
  renderReply(a, s);
  renderRecap(a);
  renderRisks(a);
  renderOpen(a);
  renderActions(a);
  renderMoney(a);
  renderLoad(a);
  renderDecisions(a);
  renderChanges(a);
  renderAsk(a);
  $("#resultsPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderProof(a, s) {
  const open = (a.open_questions || []).filter((q) => q.priority >= 2).length;
  const unowned = (a.action_items || []).filter((t) => !t.owner).length;
  const changes = (a.plan_changes || []).length;
  const decisions = (a.decisions || []).length;
  const reasked = (a.open_questions || []).filter((q) => q.reasked).length;
  const cells = [
    { n: s.total, l: "messages read", c: "info" },
    { n: s.questionsAsked, l: "questions asked", c: "info" },
    { n: open, l: "asked &amp; never answered", c: open ? "bad" : "good" },
    { n: unowned, l: "tasks nobody claimed", c: unowned ? "bad" : "good" },
    { n: decisions, l: "decisions found", c: decisions ? "good" : "warn" },
    { n: changes, l: "plan changes", c: changes ? "warn" : "good" },
    { n: reasked, l: "had to be asked twice", c: reasked ? "bad" : "good" },
  ];
  $("#proofStrip").innerHTML = cells.map((c) => '<div class="proof-cell ' + c.c + '"><b>' + c.n + "</b><span>" + c.l + "</span></div>").join("");
}

function renderRecap(a) {
  $("#recapList").innerHTML = (a.recap || []).map((r) => "<li><span>" + esc(r) + "</span></li>").join("");
}

function renderRisks(a) {
  const list = a.risks || [];
  $("#risksBlock").hidden = !list.length;
  $("#risksList").innerHTML = list.map((r) => '<li class="' + (r.level === "high" ? "high" : "med") + '"><span class="lvl">' + (r.level === "high" ? "HIGH" : "MED") + "</span><span>" + esc(r.text) + "</span></li>").join("");
}

function renderOpen(a) {
  const list = a.open_questions || [];
  const strong = list.filter((q) => q.priority >= 2);
  const weak = list.filter((q) => q.priority < 2);
  $("#openCount").textContent = strong.length;
  $("#openBlock").hidden = !list.length;
  $("#openList").innerHTML = strong.concat(weak).map((q) => "<li" + (q.priority < 2 ? ' class="lowpri"' : "") + ">" +
    '<div class="card-top"><p class="card-title">&ldquo;' + esc(q.question) + "&rdquo;</p>" +
    '<span class="badge ' + (q.reasked ? "red" : q.priority >= 2 ? "red" : "") + '">' +
    (q.reasked ? "asked twice" : q.partial ? "replies, but no answer" : "no reply at all") + " · " + esc(q.asked_at || "") + "</span></div>" +
    '<p class="card-why">' + esc(q.why_it_matters || "") + (q.priority < 2 ? ' <span class="dim">(low signal — may be banter)</span>' : "") + "</p>" +
    evidenceHtml(q.evidence) + "</li>").join("");
}

function renderActions(a) {
  const items = a.action_items || [];
  $("#actionsBlock").hidden = !items.length;
  const tb = $("#actionsTable tbody");
  tb.innerHTML = items.map((t, i) => {
    const unowned = !t.owner;
    return '<tr class="' + (unowned ? "unowned" : "") + '">' +
      "<td><strong>" + esc(t.task) + "</strong>" + (t.note ? '<br><span class="dim">' + esc(t.note) + "</span>" : "") + "<br>" + statusBadge(t, unowned) + "</td>" +
      '<td class="owner">' + (unowned ? "⚠ NOBODY" : esc(t.owner)) + "</td>" +
      '<td class="due">' + esc(t.due || "—") + "</td>" +
      "<td>" + (t.evidence ? '<button class="evlink" type="button" data-ev="' + i + '">receipt ↗</button>' : "—") + "</td></tr>";
  }).join("");
  $$(".evlink", tb).forEach((b) => b.addEventListener("click", () => {
    const t = items[Number(b.dataset.ev)];
    openReceipt(t.evidence, t.task);
  }));
}

function statusBadge(t, unowned) {
  if (unowned) return '<span class="badge red">UNOWNED</span>';
  if (t.status === "done") return '<span class="badge green">done</span>';
  if (t.due) return '<span class="badge blue">claimed</span>';
  return '<span class="badge green">claimed</span>';
}

function renderMoney(a) {
  const m = a.money;
  $("#moneyBlock").hidden = !m;
  if (!m) return;
  const c = m.currency;
  const kindBadge = { paid: ["green", "actually paid"], share: ["blue", "per person"], proposed: ["amber", "only proposed"], mentioned: ["", "just mentioned"] };
  const rows = m.entries.map((e, i) => {
    const kb = kindBadge[e.kind] || ["", e.kind];
    return "<tr><td class=\"due\">" + c + Number(e.value).toLocaleString() + '</td>' +
      '<td class="owner">' + esc(e.by) + '</td><td><span class="badge ' + kb[0] + '">' + kb[1] + '</span></td>' +
      '<td class="due">' + esc(e.ts) + "</td>" +
      "<td>" + (e.evidence ? '<button class="evlink money-ev" data-i="' + i + '">receipt ↗</button>' : "—") + "</td></tr>";
  }).join("");
  const owing = (m.balances || []).filter((b) => b.net < 0);
  const owed = (m.balances || []).filter((b) => b.net > 0);
  const bal = (m.balances || []).map((b) => '<div class="load-row"><span class="load-name">' + esc(b.person) + '</span><span class="load-bar"><span class="load-fill ' + (b.net > 0 ? "" : "hot") + '" style="width:' + Math.min(100, Math.round(Math.abs(b.net) / (m.perHead || 1) * 100)) + '%"></span></span><span class="load-pct">' + (b.net > 0 ? "owed " : "owes ") + c + Math.abs(Math.round(b.net)).toLocaleString() + "</span></div>").join("");
  $("#moneyBox").innerHTML =
    '<div class="proof" style="margin-bottom:14px">' +
    '<div class="proof-cell info"><b>' + c + Number(m.total).toLocaleString() + "</b><span>actually paid</span></div>" +
    '<div class="proof-cell ' + (owing.length ? "warn" : "good") + '"><b>' + c + Math.round(m.perHead).toLocaleString() + "</b><span>per person of " + m.count + "</span></div>" +
    '<div class="proof-cell ' + (owing.length ? "bad" : "good") + '"><b>' + owing.length + "</b><span>still owe</span></div>" +
    '<div class="proof-cell"><b>' + m.proposed.length + '</b><span>price(s) floated but never agreed</span></div></div>' +
    (bal ? "<div class=\"load\">" + bal + "</div>" : "") +
    '<div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Amount</th><th>Said by</th><th>Kind</th><th>When</th><th>Proof</th></tr></thead><tbody>' + rows + "</tbody></table></div>";
  $$(".money-ev", $("#moneyBox")).forEach((b) => b.addEventListener("click", () => {
    const e = m.entries[Number(b.dataset.i)];
    if (e) openReceipt(e.evidence, c + Number(e.value).toLocaleString() + " (" + e.kind + ")");
  }));
}

function renderLoad(a) {
  const list = a.load_balance || [];
  $("#loadBlock").hidden = !list.length;
  $("#loadChart").innerHTML = list.map((p) => {
    const cls = p.share >= 32 ? "hot" : p.share <= 8 ? "low" : "";
    return '<div class="load-row"><span class="load-name" title="' + esc(p.role || "") + '">' + esc(p.person) + '</span>' +
      '<span class="load-bar"><span class="load-fill ' + cls + '" style="width:0%" data-w="' + Math.min(100, p.share) + '"></span></span>' +
      '<span class="load-pct">' + p.share + "%</span></div>";
  }).join("");
  requestAnimationFrame(() => $$(".load-fill", $("#loadChart")).forEach((el) => { el.style.width = el.dataset.w + "%"; }));
}

function renderDecisions(a) {
  const list = a.decisions || [];
  $("#decisionsBlock").hidden = !list.length;
  $("#decisionsList").innerHTML = list.map((d) => "<li>" +
    '<div class="card-top"><p class="card-title">' + esc(d.decision) + "</p>" +
    '<span class="badge ' + (d.confidence === "confirmed" ? "green" : d.confidence === "assumed" ? "amber" : "blue") + '">' + esc(d.confidence) + "</span></div>" +
    '<p class="card-why">' + esc(d.when || "") + " · proposed by <strong>" + esc(d.proposed_by || "?") + "</strong>" +
    ((d.agreed_by || []).length ? " · agreed: " + d.agreed_by.map(esc).join(", ") : "") +
    ((d.objections || []).length ? ' · <span class="bad">objected: ' + d.objections.map(esc).join(", ") + "</span>" : "") +
    ((d.silent || []).length ? ' · <span class="bad">silent: ' + d.silent.map(esc).join(", ") + "</span>" : "") +
    (d.why ? "<br>" + esc(d.why) : "") + "</p>" + evidenceHtml(d.evidence) + "</li>").join("");
}

function renderChanges(a) {
  const list = a.plan_changes || [];
  $("#changesBlock").hidden = !list.length;
  $("#changesList").innerHTML = list.map((c) => "<li>" +
    '<div class="card-top"><p class="card-title">' + esc(c.to) + "</p>" +
    '<span class="badge amber">' + esc(c.when || "") + "</span></div>" +
    '<p class="card-why">Relayed by <strong>' + esc(c.relayed_by || "?") + "</strong>" +
    ((c.acknowledged_by || []).length ? " · responded: " + c.acknowledged_by.map(esc).join(", ") : "") +
    ((c.not_acknowledged || []).length ? ' · <span class="bad">never responded: ' + c.not_acknowledged.map(esc).join(", ") + "</span>" : "") +
    (c.impact ? "<br>" + esc(c.impact) : "") + "</p>" + evidenceHtml(c.evidence) + "</li>").join("");
}

function renderAsk(a) {
  $("#askChips").innerHTML = (a.ask_chips || []).map((c) => '<button class="chip" type="button">' + esc(c) + "</button>").join("");
  $$("#askChips .chip").forEach((b) => b.addEventListener("click", () => { $("#askInput").value = b.textContent; ask(b.textContent); }));
  $("#askAnswer").hidden = true;
}

function evidenceHtml(e) {
  if (!e) return "";
  return '<details class="ev"><summary>show the receipt</summary><div class="evidence">' +
    '<div class="ev-meta"><b>' + esc(e.author) + "</b><span>" + esc(e.ts) + '</span></div>' +
    '<div class="ev-text">&ldquo;' + esc(e.text) + "&rdquo;</div></div></details>";
}

function openReceipt(e, title) {
  if (!e) return;
  const box = $("#askAnswer");
  box.hidden = false;
  box.innerHTML = "<h4>📎 " + esc(title || "") + "</h4>" +
    '<div class="evidence" style="margin-top:8px"><div class="ev-meta"><b>' + esc(e.author) + "</b><span>" + esc(e.ts) + '</span></div>' +
    '<div class="ev-text">&ldquo;' + esc(e.text) + "&rdquo;</div></div>";
  box.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function ask(q) {
  q = (q || "").trim();
  if (!q) return;
  const box = $("#askAnswer");
  box.hidden = false;
  box.innerHTML = "<h4>…</h4><p class=\"dim\">Searching " + state.messages.length + " messages.</p>";
  const key = $("#apiKey").value.trim();

  if (key && state.mode === "live") {
    try {
      const base = $("#apiBase").value.trim() || "https://api.openai.com/v1/chat/completions";
      const model = $("#apiModel").value.trim() || "gpt-4o-mini";
      const transcript = state.messages.map((m) => "[" + m.ts + "] " + m.author + ": " + m.text.replace(/\n+/g, " ")).join("\n");
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
        body: JSON.stringify({ model: model, temperature: 0.1, response_format: { type: "json_object" }, messages: [{ role: "system", content: "Answer using ONLY the transcript. Return JSON {\"answer\":\"2-4 concrete sentences\"}. If there is no answer in the transcript, say so and name who should be asked." }, { role: "user", content: "TRANSCRIPT:\n" + transcript + "\n\nQUESTION: " + q }] }),
      });
      const data = await res.json();
      const r = JSON.parse(data.choices[0].message.content.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim());
      const hits = searchChat(state.messages, q);
      box.innerHTML = "<h4>&ldquo;" + esc(q) + "&rdquo;</h4><p>" + esc(r.answer) + "</p>" + hits.slice(0, 2).map((h) => '<div class="evidence"><div class="ev-meta"><b>' + esc(h.author) + "</b><span>" + esc(h.ts) + '</span></div><div class="ev-text">&ldquo;' + esc(h.text) + "&rdquo;</div></div>").join("");
      return;
    } catch (err) {
      console.warn("live lookup unavailable", err && err.message);
    }
  }

  await fakeDelay(180);
  const hits = searchChat(state.messages, q);
  if (!hits.length) {
    box.innerHTML = "<h4>&ldquo;" + esc(q) + "&rdquo;</h4><p>Nothing in this chat matches. That is itself a finding — if it should have been answered here, it never was.</p>";
    return;
  }
  box.innerHTML = "<h4>&ldquo;" + esc(q) + "&rdquo;</h4>" +
    '<p class="dim">Ranked search over ' + state.messages.length + ' messages, in your browser. Add an AI key under ⚙ AI for a written answer.</p>' +
    hits.map((h) => '<div class="evidence"><div class="ev-meta"><b>' + esc(h.author) + "</b><span>" + esc(h.ts) + '</span><span class="badge blue">relevance ' + h.score + '</span></div><div class="ev-text">&ldquo;' + esc(h.text) + "&rdquo;</div></div>").join("");
}

function copyRecap() {
  const a = state.analysis;
  const lines = ["📋 GROUP RECAP — " + new Date().toLocaleDateString(), ""];
  (a.recap || []).forEach((r) => lines.push("› " + r));
  const un = (a.action_items || []).filter((t) => !t.owner);
  if (un.length) { lines.push("", "⚠ NOBODY HAS CLAIMED:"); un.forEach((t) => lines.push("• " + t.task + (t.due ? " — due " + t.due : ""))); }
  const oq = a.open_questions || [];
  if (oq.length) { lines.push("", "❓ STILL UNANSWERED:"); oq.forEach((q) => lines.push("• " + q.question + " (" + q.asked_by + ", " + q.asked_at + ")")); }
  lines.push("", "— made with Decided");
  const text = lines.join("\n");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => toast("Recap copied — paste it back into the group")).catch(() => prompt("Copy manually:", text));
  } else { prompt("Copy manually:", text); }
}

function downloadIcs() {
  const items = (state.analysis.action_items || []).filter((t) => t.dueIso);
  if (!items.length) { toast("No dated deadlines found to export"); return; }
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Decided//TripleH//EN", "CALSCALE:GREGORIAN"];
  items.forEach((t, i) => {
    const end = new Date(new Date(t.dueIso.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3T$4:$5:$6Z")).getTime() + 3600000)
      .toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    lines.push("BEGIN:VEVENT", "UID:decided-" + hash(state.raw) + "-" + i, "DTSTAMP:" + stamp,
      "DTSTART:" + t.dueIso, "DTEND:" + end,
      "SUMMARY:" + icsEsc((t.owner ? t.owner + ": " : "UNOWNED: ") + t.task),
      "DESCRIPTION:" + icsEsc(t.note || "Extracted from your group chat by Decided"), "END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const el = document.createElement("a");
  el.href = url; el.download = "decided-deadlines.ics"; document.body.appendChild(el); el.click(); el.remove();
  URL.revokeObjectURL(url);
  toast("Exported " + items.length + " real deadline(s) to your calendar");
}

function icsEsc(s) { return String(s).replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n"); }

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
  const msgs = ["Reading " + n + " messages so you don't have to…", "Working out who actually agreed…", "Looking for questions nobody answered…", "Finding the work nobody claimed…", "Following the money…"];
  let i = 0;
  $("#loadingText").textContent = msgs[0];
  showLoading._t = setInterval(() => { i = (i + 1) % msgs.length; $("#loadingText").textContent = msgs[i]; }, 1200);
}
function hideLoading() { $("#loading").hidden = true; clearInterval(showLoading._t); }
function revealCapybara(n) {
  $("#capyCount").textContent = n.toLocaleString() + " messages. That is a capybara-sized mess.";
  $("#capySecret").hidden = false;
  setTimeout(() => { $("#capySecret").hidden = true; }, 8000);
}
let toastT;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.hidden = true; }, 3600);
}
function fakeDelay(ms) { return new Promise((r) => setTimeout(r, ms)); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function hash(str) { let h = 0; for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; } return Math.abs(h).toString(16).padStart(6, "0").slice(0, 6); }

function restoreSettings() {
  try {
    const k = localStorage.getItem("decided.key");
    const b = localStorage.getItem("decided.base");
    const m = localStorage.getItem("decided.model");
    if (k) $("#apiKey").value = k;
    if (b) $("#apiBase").value = b;
    if (m) $("#apiModel").value = m;
  } catch (err) {
    console.warn("settings not restored", err && err.message);
  }
}

function persistSettings() {
  try {
    localStorage.setItem("decided.key", $("#apiKey").value.trim());
    localStorage.setItem("decided.base", $("#apiBase").value.trim());
    localStorage.setItem("decided.model", $("#apiModel").value.trim());
  } catch (err) {
    console.warn("settings not saved", err && err.message);
  }
}

function renderReply(a, s) {
  const parts = (s && s.participants) || [];
  if (!parts.length) return;
  const names = parts.map((p) => p.name);
  let saved = null;
  try { saved = localStorage.getItem("decided.you"); } catch (err) { saved = null; }
  if (!state.you || names.indexOf(state.you) === -1) {
    state.you = saved && names.indexOf(saved) !== -1 ? saved : parts[0].name;
  }
  const pick = $("#youPick");
  pick.innerHTML = "";
  const lab = document.createElement("span");
  lab.className = "ylab";
  lab.textContent = "You in this chat:";
  pick.appendChild(lab);
  names.forEach((n) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "youchip";
    b.textContent = n + (n === state.you ? " ✓" : "");
    b.setAttribute("aria-pressed", String(n === state.you));
    b.addEventListener("click", () => {
      state.you = n;
      try { localStorage.setItem("decided.you", n); } catch (err) { console.warn(err); }
      $("#draftWrap").hidden = true;
      state.draft = "";
      renderReply(state.analysis, state.stats);
    });
    pick.appendChild(b);
  });
  const needs = needsFor(a, state.you);
  state.needs = needs;
  $("#needsCount").textContent = needs.length;
  const ul = $("#needsList");
  ul.innerHTML = "";
  if (!needs.length) {
    const li = document.createElement("li");
    li.textContent = "Nothing is waiting on you. Rare group. Enjoy it.";
    ul.appendChild(li);
  }
  needs.forEach((n) => {
    const li = document.createElement("li");
    li.className = "k-" + n.kind;
    li.textContent = n.text;
    ul.appendChild(li);
  });
  const key = $("#apiKey").value.trim();
  $("#replyNote").textContent = key
    ? "Sends about 25 of your old messages as voice samples, plus the last 40 messages of context. Nothing else."
    : "Works without any key. Add your Grok key under ⚙ AI and Decided will write the reply in your exact voice.";
  $("#draftBtn").textContent = key ? "✍ Draft my reply in my voice" : "✍ Draft my reply in my voice (add a key under ⚙ AI)";
}

async function draftReply() {
  const key = $("#apiKey").value.trim();
  if (!key) {
    toggleSettings();
    toast("Paste your Grok key under ⚙ AI first — tap ⚡ Use my Grok");
    return;
  }
  const needs = state.needs || [];
  if (!needs.length) { toast("Nothing is waiting on you right now"); return; }
  const you = state.you;
  const voice = state.messages.filter((m) => m.author === you && !m.media).slice(-25).map((m) => m.text.replace(/\n+/g, " ").slice(0, 200));
  const recent = state.messages.slice(-40).map((m) => m.author + ": " + m.text.replace(/\n+/g, " ").slice(0, 200));
  const system = "You write WhatsApp replies AS " + you + ", one member of this group. Copy their exact style from the VOICE SAMPLES: casing, punctuation, abbreviations, Nigerian English or pidgin if present, emoji habits, typical message length. Output ONE reply message only: plain text, at most 3 sentences, no quotation marks, no explanation, no hashtags. Cover every numbered NEED using only facts already present in the chat. If you commit to doing something, say when.";
  const user = "VOICE SAMPLES (" + you + "):\n" + voice.join("\n") + "\n\nRECENT CHAT:\n" + recent.join("\n") + "\n\nNEEDS A REPLY FROM " + you + ":\n" + needs.map((n, i) => (i + 1) + ". " + n.text).join("\n");
  const btn = $("#draftBtn");
  btn.disabled = true;
  $("#draftNote").textContent = "reading the room…";
  try {
    const text = await callModel(key, system, user);
    state.draft = text.trim();
    $("#draftWrap").hidden = false;
    const box = $("#replyDraft");
    box.innerHTML = "";
    const tag = document.createElement("span");
    tag.className = "dtag";
    tag.textContent = "as " + you + " — check it, then send";
    const body = document.createElement("span");
    body.textContent = state.draft;
    box.append(tag, body);
    $("#draftNote").textContent = "drafted by " + ($("#apiModel").value.trim() || "your model");
  } catch (err) {
    $("#draftNote").textContent = "";
    toast("Draft failed: " + err.message);
  } finally {
    btn.disabled = false;
  }
}

async function callModel(key, system, user) {
  const base = $("#apiBase").value.trim() || "https://api.openai.com/v1/chat/completions";
  const model = $("#apiModel").value.trim() || "gpt-4o-mini";
  const messages = [{ role: "system", content: system }, { role: "user", content: user }];
  let res;
  try {
    res = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({ model: model, temperature: 0.4, messages: messages }),
    });
  } catch (netErr) {
    res = await fetch("/ai-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base: base, model: model, key: key, messages: messages }),
    });
    if (!res.ok) throw new Error("provider blocked the browser and the relay answered HTTP " + res.status);
    const d = await res.json();
    return (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || "";
  }
  if (!res.ok) throw new Error("HTTP " + res.status + " from your provider");
  const d = await res.json();
  return (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || "";
}

function copyReplyText() {
  const t = state.draft || "";
  if (!t) { toast("Nothing to copy yet"); return; }
  const done = () => toast("Reply copied — paste it into WhatsApp");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(done, () => fallbackCopy(t, done));
  } else {
    fallbackCopy(t, done);
  }
}

function fallbackCopy(t, done) {
  const ta = document.createElement("textarea");
  ta.value = t;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
    done();
  } catch (err) {
    toast("Copy blocked — long-press the draft instead");
  }
  document.body.removeChild(ta);
}
