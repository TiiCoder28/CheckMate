const STORAGE_KEY = "checkmate:v1";
const today = new Date();
const todayKey = toDateKey(today);

const anchors = [
  { id: "morning", icon: "🌅", title: "Start the day", sub: "Water, curtains, one clear priority." },
  { id: "mental", icon: "🧠", title: "Mental state", sub: "Check in instead of pushing through blindly." },
  { id: "alcoholFree", icon: "🌿", title: "Alcohol-free", sub: "Protect today's choice. One day at a time." },
  { id: "move", icon: "🏃🏽‍♀️", title: "Move", sub: "Walk, stretch, train or dance. Ten minutes counts." },
  { id: "body", icon: "🍲", title: "Body", sub: "Eat, hydrate, shower, rest." },
  { id: "family", icon: "🤍", title: "Family", sub: "One intentional moment of connection." },
  { id: "work", icon: "💼", title: "Work", sub: "Complete one meaningful task." },
  { id: "money", icon: "💰", title: "Money", sub: "Avoid one unnecessary spend." },
  { id: "future", icon: "🚀", title: "Future me", sub: "15–30 minutes toward something that matters." },
  { id: "connection", icon: "🤝", title: "Connection", sub: "Speak to one safe person or spend time with family." }
];

let store = loadStore();
let entry = normalizeEntry(store.entries[todayKey]);
store.entries[todayKey] = entry;

function blankEntry() {
  return {
    mood: 5,
    stress: 5,
    energy: 5,
    need: "",
    wins: ["", "", ""],
    anchors: {},
    journal: "",
    reflection: null,
    proud: "",
    hard: "",
    tomorrow: "",
    motivation: null,
    supportDismissed: false,
    updatedAt: new Date().toISOString()
  };
}

function normalizeEntry(value) {
  const base = blankEntry();
  if (!value || typeof value !== "object") return base;
  return {
    ...base,
    ...value,
    wins: Array.isArray(value.wins) ? [...value.wins, "", "", ""].slice(0, 3) : base.wins,
    anchors: value.anchors && typeof value.anchors === "object" ? value.anchors : {}
  };
}

function loadStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (parsed && parsed.entries) return parsed;
  } catch (_) {}
  return { entries: {} };
}

function save() {
  entry.updatedAt = new Date().toISOString();
  store.entries[todayKey] = entry;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));

  const el = document.getElementById("saveState");
  el.textContent = "Saved";
  clearTimeout(save._timer);
  save._timer = setTimeout(() => el.textContent = "Saved locally", 900);

  renderStats();
  renderCapacity();
  renderSupport();
  renderWeek();
  renderJournalCount();
}

function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftDate(base, delta) {
  const d = new Date(base);
  d.setDate(d.getDate() + delta);
  return d;
}

function renderStatic() {
  document.getElementById("todayLabel").textContent = today.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long"
  });

  const grid = document.getElementById("anchorGrid");
  grid.innerHTML = anchors.map(a => `
    <button class="anchor" data-anchor="${a.id}" type="button" aria-pressed="false">
      <span class="anchor-icon">${a.icon}</span>
      <span class="anchor-copy">
        <span class="anchor-title">${a.title}</span>
        <span class="anchor-sub">${a.sub}</span>
      </span>
      <span class="anchor-check">✓</span>
    </button>
  `).join("");

  grid.addEventListener("click", e => {
    const button = e.target.closest("[data-anchor]");
    if (!button) return;
    const id = button.dataset.anchor;
    entry.anchors[id] = !entry.anchors[id];
    renderAnchors();
    save();
    if (id === "alcoholFree") refreshMotivation(true);
  });

  document.getElementById("journalPrompts").addEventListener("click", e => {
    const button = e.target.closest("[data-prompt]");
    if (!button) return;
    const textarea = document.getElementById("journal");
    const prompt = button.dataset.prompt;
    const prefix = entry.journal.trim() ? "\n\n" : "";
    entry.journal = `${entry.journal}${prefix}${prompt}\n`;
    textarea.value = entry.journal;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    save();
  });

  document.getElementById("weekView").addEventListener("click", e => {
    const day = e.target.closest("[data-history-key]");
    if (!day) return;
    renderHistoryDetail(day.dataset.historyKey);
  });
}

function bindInputs() {
  ["mood", "stress", "energy"].forEach(id => {
    const input = document.getElementById(id);
    input.value = entry[id];
    document.getElementById(id + "Value").textContent = entry[id];

    input.addEventListener("input", () => {
      entry[id] = Number(input.value);
      document.getElementById(id + "Value").textContent = input.value;
      save();
    });

    input.addEventListener("change", () => refreshMotivation(true));
  });

  bindText("need", value => entry.need = value, () => entry.need);
  ["win1", "win2", "win3"].forEach((id, i) => {
    bindText(id, value => entry.wins[i] = value, () => entry.wins[i] || "");
  });

  bindText("journal", value => entry.journal = value, () => entry.journal || "");
  bindText("proud", value => entry.proud = value, () => entry.proud);
  bindText("hard", value => entry.hard = value, () => entry.hard);
  bindText("tomorrow", value => entry.tomorrow = value, () => entry.tomorrow);

  document.getElementById("refreshMotivation").addEventListener("click", () => refreshMotivation(true));
  document.getElementById("reflectJournal").addEventListener("click", reflectJournal);

  document.getElementById("supportDismiss").addEventListener("click", () => {
    entry.supportDismissed = true;
    save();
  });
}

function bindText(id, setter, getter) {
  const el = document.getElementById(id);
  el.value = getter();
  el.addEventListener("input", () => {
    setter(el.value);
    save();
  });
}

function renderAnchors() {
  document.querySelectorAll("[data-anchor]").forEach(button => {
    const done = Boolean(entry.anchors[button.dataset.anchor]);
    button.classList.toggle("done", done);
    button.setAttribute("aria-pressed", String(done));
  });

  const count = anchors.filter(a => entry.anchors[a.id]).length;
  document.getElementById("progressLabel").textContent = `${count} of ${anchors.length}`;
  document.getElementById("progressBar").style.width = `${Math.round((count / anchors.length) * 100)}%`;
}

function currentAlcoholStreak() {
  let streak = 0;
  let cursor = new Date(today);
  const todayMarked = Boolean(store.entries[todayKey]?.anchors?.alcoholFree);

  if (!todayMarked) cursor = shiftDate(cursor, -1);

  for (let i = 0; i < 4000; i++) {
    const item = store.entries[toDateKey(cursor)];
    if (!item?.anchors?.alcoholFree) break;
    streak++;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}

function renderStats() {
  const completed = anchors.filter(a => entry.anchors[a.id]).length;
  document.getElementById("completedCount").textContent = completed;
  document.getElementById("alcoholStreak").textContent = currentAlcoholStreak();

  let week = 0;
  for (let i = 0; i < 7; i++) {
    if (store.entries[toDateKey(shiftDate(today, -i))]) week++;
  }
  document.getElementById("weekCount").textContent = week;
}

function renderCapacity() {
  const lowCapacity = entry.energy <= 3 || entry.mood <= 3 || entry.stress >= 8;
  const badge = document.getElementById("capacityBadge");
  badge.textContent = lowCapacity
    ? "Low-capacity day · 3 wins is enough"
    : "Normal-capacity day";
}

function renderSupport() {
  const shouldShow =
    !entry.supportDismissed &&
    (entry.mood <= 2 || entry.energy <= 2 || (entry.mood <= 3 && entry.stress >= 9));

  document.getElementById("supportCard").hidden = !shouldShow;
}

function renderWeek() {
  const view = document.getElementById("weekView");
  const days = [];

  for (let i = 6; i >= 0; i--) {
    const d = shiftDate(today, -i);
    const key = toDateKey(d);
    const e = store.entries[key];
    const done = e ? anchors.filter(a => e.anchors?.[a.id]).length : 0;

    days.push(`
      <button class="day-dot ${e ? "checked" : ""} ${key === todayKey ? "today" : ""}" data-history-key="${key}" type="button">
        <span class="dow">${d.toLocaleDateString(undefined, { weekday: "short" })}</span>
        <span class="score">${e ? done : "–"}</span>
        <span class="tiny">${e?.journal?.trim() ? "journaled" : e ? "checked in" : "no entry"}</span>
      </button>
    `);
  }

  view.innerHTML = days.join("");
}

function renderHistoryDetail(key) {
  const target = store.entries[key];
  const panel = document.getElementById("historyDetail");

  if (!target) {
    panel.innerHTML = '<p class="history-empty">No entry for this day.</p>';
    return;
  }

  const date = new Date(key + "T12:00:00");
  const wins = (target.wins || []).filter(Boolean);
  const journal = (target.journal || "").trim();

  panel.innerHTML = `
    <div class="history-head">
      <strong>${escapeHtml(date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" }))}</strong>
      <span>Mood ${Number(target.mood || 5)}/10 · Stress ${Number(target.stress || 5)}/10 · Energy ${Number(target.energy || 5)}/10</span>
    </div>
    ${wins.length ? `<p><strong>Wins:</strong> ${wins.map(escapeHtml).join(" · ")}</p>` : ""}
    ${journal ? `<div class="history-journal">${escapeHtml(journal).replace(/\n/g, "<br>")}</div>` : '<p class="history-empty">No journal entry that day.</p>'}
  `;
}

function fallbackMotivation() {
  const veryLow = entry.energy <= 2 || entry.mood <= 2 || entry.stress >= 9;
  const low = veryLow || entry.energy <= 3 || entry.mood <= 3 || entry.stress >= 8;

  if (veryLow) {
    return {
      message: "Today looks especially heavy. Productivity is not the priority; basic care and connection are enough.",
      action: "Eat or drink something, protect today's alcohol-free choice, and tell one safe person you're having a difficult day.",
      source: "CheckMate low-capacity support"
    };
  }

  if (low) {
    return {
      message: "Today looks heavy, so make the target smaller. You are allowed to protect your energy and count basic care as progress.",
      action: "Choose just one of your three wins and do the gentlest version of it.",
      source: "CheckMate gentle fallback"
    };
  }

  return {
    message: "You do not need a dramatic breakthrough today. Quiet consistency is still movement, and small choices become evidence that you can trust yourself again.",
    action: "Pick the easiest meaningful win and start there.",
    source: "CheckMate gentle fallback"
  };
}

async function refreshMotivation(force = false) {
  if (!force && entry.motivation?.date === todayKey) {
    renderMotivation(entry.motivation);
    return;
  }

  const body = document.getElementById("motivationBody");
  body.innerHTML = '<div class="skeleton line"></div><div class="skeleton line short"></div>';
  document.getElementById("sourceNote").textContent = "";

  try {
    const res = await fetch("/api/motivation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mood: entry.mood,
        stress: entry.stress,
        energy: entry.energy,
        need: entry.need,
        alcoholFreeDays: currentAlcoholStreak(),
        completedAnchors: anchors.filter(a => entry.anchors[a.id]).map(a => a.title),
        wins: entry.wins.filter(Boolean)
      })
    });

    if (!res.ok) throw new Error("Motivation unavailable");
    const data = await res.json();
    entry.motivation = { ...data, date: todayKey };
  } catch (_) {
    entry.motivation = { ...fallbackMotivation(), date: todayKey };
  }

  save();
  renderMotivation(entry.motivation);
}

function renderMotivation(data) {
  document.getElementById("motivationBody").innerHTML = `
    <p class="motivation-text">${escapeHtml(data.message || "")}</p>
    <span class="action-chip">5% action · ${escapeHtml(data.action || "Do one kind thing for future you.")}</span>
  `;
  document.getElementById("sourceNote").textContent =
    data.source ? `Fresh context: ${data.source}` : "";
}

function renderJournalCount() {
  const words = countWords(entry.journal || "");
  document.getElementById("journalCount").textContent =
    `${words} word${words === 1 ? "" : "s"}`;
}

function countWords(value) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

async function reflectJournal() {
  const panel = document.getElementById("journalReflection");
  const button = document.getElementById("reflectJournal");
  const journal = (entry.journal || "").trim();

  panel.hidden = false;

  if (journal.length < 20) {
    panel.innerHTML = '<p class="reflection-empty">Write a little more first — even two or three honest sentences is enough.</p>';
    return;
  }

  button.disabled = true;
  button.textContent = "Reflecting…";
  panel.innerHTML = '<div class="skeleton line"></div><div class="skeleton line short"></div>';

  try {
    const response = await fetch("/api/reflect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mood: entry.mood,
        stress: entry.stress,
        energy: entry.energy,
        need: entry.need,
        journal,
        proud: entry.proud,
        hard: entry.hard,
        tomorrow: entry.tomorrow,
        alcoholFreeDays: currentAlcoholStreak()
      })
    });

    if (!response.ok) throw new Error("Reflection unavailable");

    const data = await response.json();
    entry.reflection = {
      ...data,
      generatedAt: new Date().toISOString()
    };
    save();
    renderReflection(entry.reflection);
  } catch (_) {
    panel.innerHTML = '<p class="reflection-empty">I could not generate a reflection right now. Your journal is still saved locally.</p>';
  } finally {
    button.disabled = false;
    button.textContent = "Reflect with AI";
  }
}

function renderReflection(data) {
  const panel = document.getElementById("journalReflection");

  if (!data) {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  panel.innerHTML = `
    <p class="kicker">A reflection, not a verdict</p>
    <div class="reflection-block">
      <span>What I'm hearing</span>
      <p>${escapeHtml(data.reflection || "")}</p>
    </div>
    <div class="reflection-block">
      <span>A possible pattern</span>
      <p>${escapeHtml(data.pattern || "")}</p>
    </div>
    <div class="reflection-block">
      <span>One gentle next step</span>
      <p>${escapeHtml(data.next || "")}</p>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[ch]));
}

renderStatic();
bindInputs();
renderAnchors();
renderStats();
renderCapacity();
renderSupport();
renderWeek();
renderJournalCount();
renderReflection(entry.reflection);
refreshMotivation(false);
