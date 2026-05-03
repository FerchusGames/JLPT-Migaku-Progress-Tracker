// JLPT Progress Dashboard - Frontend Logic

const LEVELS = ["N5", "N4", "N3", "N2", "N1"];
const CATEGORY_COLORS = {
  known: "#4CAF50",
  ignored: "#78909C",
  learning: "#2196F3",
  unknown: "#FF9800",
};
const LEVEL_COLORS = {
  N5: "#4CAF50",
  N4: "#2196F3",
  N3: "#FF9800",
  N2: "#F44336",
  N1: "#9C27B0",
};
const PAGE_SIZE = 100;

// State
const state = {
  data: null,
  viewMode: "cumulative", // cumulative | perLevel
  ignoredAsKnown: true,
  // Export filters
  selectedCategories: new Set(["known", "learning", "ignored", "unknown"]),
  exportLevel: "N5",
  exportMode: "level_only",
  exportLimit: null,
  exportKatakana: false,
  exportTracked: "include",
  exportRandom: false,
  // Word browser
  words: [],
  filteredWords: [],
  searchQuery: "",
  currentPage: 1,
};

const STORAGE_KEY = "jlpt-dashboard-state";

// --- Init ---
document.addEventListener("DOMContentLoaded", init);

function init() {
  setupTheme();
  loadState();
  setupEventListeners();
  fetchData();
}

// --- Persistence ---
function saveState() {
  const saved = {
    viewMode: state.viewMode,
    ignoredAsKnown: state.ignoredAsKnown,
    selectedCategories: Array.from(state.selectedCategories),
    exportLevel: state.exportLevel,
    exportMode: state.exportMode,
    exportLimit: state.exportLimit,
    exportKatakana: state.exportKatakana,
    exportTracked: state.exportTracked,
    exportRandom: state.exportRandom,
    searchQuery: state.searchQuery,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);

    // Restore state
    if (saved.viewMode) state.viewMode = saved.viewMode;
    if (typeof saved.ignoredAsKnown === "boolean") state.ignoredAsKnown = saved.ignoredAsKnown;
    if (Array.isArray(saved.selectedCategories) && saved.selectedCategories.length > 0) {
      state.selectedCategories = new Set(saved.selectedCategories);
    }
    if (saved.exportLevel && saved.exportLevel !== "all") state.exportLevel = saved.exportLevel;
    if (saved.exportMode) state.exportMode = saved.exportMode;
    state.exportLimit = saved.exportLimit ?? null;
    if (typeof saved.exportKatakana === "boolean") state.exportKatakana = saved.exportKatakana;
    if (saved.exportTracked) state.exportTracked = saved.exportTracked;
    if (typeof saved.exportRandom === "boolean") state.exportRandom = saved.exportRandom;
    if (saved.searchQuery) state.searchQuery = saved.searchQuery;

    // Sync DOM elements
    document.getElementById("ignoredToggle").checked = state.ignoredAsKnown;

    // Tabs
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.classList.toggle("tab--active", tab.dataset.mode === state.viewMode);
    });

    // Category chips
    document.querySelectorAll(".chip[data-category]").forEach((chip) => {
      chip.classList.toggle("chip--active", state.selectedCategories.has(chip.dataset.category));
    });

    // Selects
    document.getElementById("exportLevel").value = state.exportLevel;
    document.getElementById("exportCumulative").checked = state.exportMode === "cumulative";
    document.getElementById("exportTracked").value = state.exportTracked;

    // Text/number fields
    document.getElementById("exportLimit").value = state.exportLimit ?? "";
    document.getElementById("exportKatakana").checked = state.exportKatakana;
    document.getElementById("exportRandom").checked = state.exportRandom;

    // Search
    document.getElementById("browserSearch").value = state.searchQuery;
  } catch {
    // Corrupted storage, ignore
  }
}

// --- Theme ---
function setupTheme() {
  const saved = localStorage.getItem("jlpt-theme");
  if (saved === "dark" || (!saved && matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.setAttribute("data-theme", "dark");
    document.getElementById("themeBtn").querySelector("span").textContent = "light_mode";
  }
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  document.documentElement.setAttribute("data-theme", isDark ? "light" : "dark");
  localStorage.setItem("jlpt-theme", isDark ? "light" : "dark");
  document.getElementById("themeBtn").querySelector("span").textContent = isDark ? "dark_mode" : "light_mode";
  // Redraw charts with updated colors
  if (state.data) {
    renderCharts();
  }
}

// --- Event Listeners ---
function setupEventListeners() {
  document.getElementById("themeBtn").addEventListener("click", toggleTheme);
  document.getElementById("refreshBtn").addEventListener("click", fetchData);
  document.getElementById("ignoredToggle").addEventListener("change", (e) => {
    state.ignoredAsKnown = e.target.checked;
    saveState();
    renderSummary();
    renderProgressTable();
    renderCharts();
  });

  // Tabs
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("tab--active"));
      tab.classList.add("tab--active");
      state.viewMode = tab.dataset.mode;
      saveState();
      renderProgressTable();
    });
  });

  // Category chips
  document.querySelectorAll(".chip[data-category]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const cat = chip.dataset.category;
      if (state.selectedCategories.has(cat)) {
        if (state.selectedCategories.size > 1) {
          state.selectedCategories.delete(cat);
          chip.classList.remove("chip--active");
        }
      } else {
        state.selectedCategories.add(cat);
        chip.classList.add("chip--active");
      }
      saveState();
      debouncedFetchWords();
    });
  });

  // Export filters
  document.getElementById("exportLevel").addEventListener("change", (e) => {
    state.exportLevel = e.target.value;
    saveState();
    debouncedFetchWords();
  });
  document.getElementById("exportCumulative").addEventListener("change", (e) => {
    state.exportMode = e.target.checked ? "cumulative" : "level_only";
    saveState();
    debouncedFetchWords();
  });
  document.getElementById("exportLimit").addEventListener("input", (e) => {
    state.exportLimit = e.target.value || null;
    saveState();
    debouncedFetchWords();
  });
  document.getElementById("exportKatakana").addEventListener("change", (e) => {
    state.exportKatakana = e.target.checked;
    saveState();
    debouncedFetchWords();
  });
  document.getElementById("exportTracked").addEventListener("change", (e) => {
    state.exportTracked = e.target.value;
    saveState();
    debouncedFetchWords();
  });
  document.getElementById("exportRandom").addEventListener("change", (e) => {
    state.exportRandom = e.target.checked;
    saveState();
  });

  // Export buttons
  document.getElementById("copyBtn").addEventListener("click", copyToClipboard);
  document.getElementById("downloadCsvBtn").addEventListener("click", () => downloadFile("csv"));
  document.getElementById("downloadJsonBtn").addEventListener("click", () => downloadFile("json"));

  // Search
  document.getElementById("browserSearch").addEventListener("input", (e) => {
    state.searchQuery = e.target.value.trim();
    state.currentPage = 1;
    saveState();
    applySearchFilter();
    renderWordTable();
  });
}

// --- Debounce ---
let fetchWordsTimer = null;
function debouncedFetchWords() {
  clearTimeout(fetchWordsTimer);
  fetchWordsTimer = setTimeout(fetchWords, 300);
}

// --- Data Fetching ---
async function fetchData() {
  const loading = document.getElementById("loading");
  const dashboard = document.getElementById("dashboard");
  const errorState = document.getElementById("errorState");

  loading.hidden = false;
  dashboard.hidden = true;
  errorState.hidden = true;

  try {
    const resp = await fetch("/api/data");
    if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
    state.data = await resp.json();

    loading.hidden = true;
    dashboard.hidden = false;

    renderSummary();
    renderProgressTable();
    renderCharts();
    fetchWords();
  } catch (err) {
    loading.hidden = true;
    errorState.hidden = false;
    document.getElementById("errorMessage").textContent = `Could not load data: ${err.message}`;
  }
}

function buildWordParams() {
  const params = new URLSearchParams();
  params.set("category", Array.from(state.selectedCategories).join(","));
  params.set("level", state.exportLevel);
  params.set("mode", state.exportMode);
  if (state.exportLimit) params.set("limit", state.exportLimit);
  if (state.exportKatakana) params.set("katakana", "true");
  params.set("tracked", state.exportTracked);
  return params;
}

async function fetchWords() {
  const params = buildWordParams();
  params.set("format", "json");

  try {
    const resp = await fetch(`/api/words?${params}`);
    if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
    const result = await resp.json();
    state.words = result.words;
    state.currentPage = 1;
    document.getElementById("previewCount").textContent =
      `${result.count.toLocaleString()} words match your filters`;
    applySearchFilter();
    renderWordTable();
  } catch (err) {
    document.getElementById("previewCount").textContent = `Error: ${err.message}`;
  }
}

function applySearchFilter() {
  const q = state.searchQuery.toLowerCase();
  if (!q) {
    state.filteredWords = state.words;
  } else {
    state.filteredWords = state.words.filter(
      (w) => w.surface.toLowerCase().includes(q) || w.reading.toLowerCase().includes(q)
    );
  }
}

// --- Render: Summary Cards ---
function renderSummary() {
  const s = state.data.summary;
  const iak = state.ignoredAsKnown;

  const known = iak ? s.known + s.ignored : s.known;
  const unknown = iak ? s.unknown : s.unknown;
  const total = s.total;
  const pct = (v) => ((v / total) * 100).toFixed(1) + "%";

  document.getElementById("summaryKnown").textContent = known.toLocaleString();
  document.getElementById("summaryKnownPct").textContent = `${pct(known)} of ${total.toLocaleString()}`;
  document.getElementById("summaryLearning").textContent = s.learning.toLocaleString();
  document.getElementById("summaryLearningPct").textContent = `${pct(s.learning)} of ${total.toLocaleString()}`;
  document.getElementById("summaryUnknown").textContent = unknown.toLocaleString();
  document.getElementById("summaryUnknownPct").textContent = `${pct(unknown)} of ${total.toLocaleString()}`;

  const progressPct = ((known / total) * 100).toFixed(1);
  document.getElementById("summaryProgress").textContent = `${progressPct}%`;
  document.getElementById("summaryProgressBar").style.width = `${progressPct}%`;
}

// --- Render: Progress Table ---
function renderProgressTable() {
  const dataSet = state.viewMode === "cumulative" ? state.data.cumulative : state.data.perLevel;
  const iak = state.ignoredAsKnown;
  const tbody = document.getElementById("progressTableBody");
  tbody.innerHTML = "";

  for (const level of LEVELS) {
    const d = dataSet[level];
    const knownCount = iak ? d.known + d.ignored : d.known;
    const pct = d.total > 0 ? ((knownCount / d.total) * 100).toFixed(1) : "0.0";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="level-badge level-badge--${level}">${level}</span></td>
      <td>${d.total.toLocaleString()}</td>
      <td>${knownCount.toLocaleString()}</td>
      <td>${iak ? "—" : d.ignored.toLocaleString()}</td>
      <td>${d.learning.toLocaleString()}</td>
      <td>${d.unknown.toLocaleString()}</td>
      <td>
        <div class="cell-progress">
          <div class="cell-progress__bar">
            <div class="cell-progress__fill" style="width:${pct}%; background:${LEVEL_COLORS[level]}"></div>
          </div>
          <span class="cell-progress__label">${pct}%</span>
        </div>
      </td>`;
    tbody.appendChild(tr);
  }
}

// --- Render: Charts ---
function renderCharts() {
  renderDonut();
  renderBarChart();
}

function renderDonut() {
  const canvas = document.getElementById("donutChart");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const size = 300;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + "px";
  canvas.style.height = size + "px";
  ctx.scale(dpr, dpr);

  const s = state.data.summary;
  const iak = state.ignoredAsKnown;

  const segments = iak
    ? [
        { label: "Known", value: s.known + s.ignored, color: CATEGORY_COLORS.known },
        { label: "Learning", value: s.learning, color: CATEGORY_COLORS.learning },
        { label: "Unknown", value: s.unknown, color: CATEGORY_COLORS.unknown },
      ]
    : [
        { label: "Known", value: s.known, color: CATEGORY_COLORS.known },
        { label: "Ignored", value: s.ignored, color: CATEGORY_COLORS.ignored },
        { label: "Learning", value: s.learning, color: CATEGORY_COLORS.learning },
        { label: "Unknown", value: s.unknown, color: CATEGORY_COLORS.unknown },
      ];

  const total = segments.reduce((a, b) => a + b.value, 0);
  const cx = size / 2, cy = size / 2, radius = 120, inner = 70;

  ctx.clearRect(0, 0, size, size);
  let startAngle = -Math.PI / 2;

  for (const seg of segments) {
    const sweep = (seg.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, startAngle + sweep);
    ctx.arc(cx, cy, inner, startAngle + sweep, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    startAngle += sweep;
  }

  // Center text
  const textColor = getComputedStyle(document.documentElement).getPropertyValue("--md-on-surface").trim() || "#1D1B20";
  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.font = "700 28px Roboto, sans-serif";
  const mainPct = ((segments[0].value / total) * 100).toFixed(1) + "%";
  ctx.fillText(mainPct, cx, cy + 4);
  ctx.font = "400 12px Roboto, sans-serif";
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--md-on-surface-variant").trim() || "#49454F";
  ctx.fillText("known", cx, cy + 22);

  // Legend
  const legendEl = document.getElementById("donutLegend");
  legendEl.innerHTML = segments
    .map(
      (seg) =>
        `<span class="legend-item"><span class="legend-swatch" style="background:${seg.color}"></span>${seg.label}: ${seg.value.toLocaleString()}</span>`
    )
    .join("");
}

function renderBarChart() {
  const canvas = document.getElementById("barChart");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const W = 500, H = 300;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.scale(dpr, dpr);

  const perLevel = state.data.perLevel;
  const iak = state.ignoredAsKnown;

  ctx.clearRect(0, 0, W, H);

  const pad = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;

  // Find max total for scale
  const maxTotal = Math.max(...LEVELS.map((l) => perLevel[l].total));

  const barW = chartW / LEVELS.length;
  const barPad = barW * 0.2;

  const textColor = getComputedStyle(document.documentElement).getPropertyValue("--md-on-surface-variant").trim() || "#49454F";

  // Y-axis grid lines
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--md-outline-variant").trim() || "#CAC4D0";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(W - pad.right, y);
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = "400 11px Roboto, sans-serif";
    ctx.textAlign = "right";
    const val = Math.round(maxTotal * (1 - i / 4));
    ctx.fillText(val.toLocaleString(), pad.left - 6, y + 4);
  }

  // Bars
  LEVELS.forEach((level, i) => {
    const d = perLevel[level];
    const x = pad.left + barW * i + barPad;
    const w = barW - barPad * 2;
    const total = d.total;

    const segments = iak
      ? [
          { value: d.known + d.ignored, color: CATEGORY_COLORS.known },
          { value: d.learning, color: CATEGORY_COLORS.learning },
          { value: d.unknown, color: CATEGORY_COLORS.unknown },
        ]
      : [
          { value: d.known, color: CATEGORY_COLORS.known },
          { value: d.ignored, color: CATEGORY_COLORS.ignored },
          { value: d.learning, color: CATEGORY_COLORS.learning },
          { value: d.unknown, color: CATEGORY_COLORS.unknown },
        ];

    let yOffset = pad.top + chartH;

    for (const seg of segments) {
      const segH = (seg.value / maxTotal) * chartH;
      yOffset -= segH;
      ctx.fillStyle = seg.color;
      ctx.fillRect(x, yOffset, w, segH);
    }

    // Level label
    ctx.fillStyle = textColor;
    ctx.font = "500 13px Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(level, x + w / 2, H - pad.bottom + 20);
  });

  // Legend
  const categories = iak
    ? [
        { label: "Known", color: CATEGORY_COLORS.known },
        { label: "Learning", color: CATEGORY_COLORS.learning },
        { label: "Unknown", color: CATEGORY_COLORS.unknown },
      ]
    : [
        { label: "Known", color: CATEGORY_COLORS.known },
        { label: "Ignored", color: CATEGORY_COLORS.ignored },
        { label: "Learning", color: CATEGORY_COLORS.learning },
        { label: "Unknown", color: CATEGORY_COLORS.unknown },
      ];

  document.getElementById("barLegend").innerHTML = categories
    .map(
      (c) => `<span class="legend-item"><span class="legend-swatch" style="background:${c.color}"></span>${c.label}</span>`
    )
    .join("");
}

// --- Render: Word Browser ---
function renderWordTable() {
  const words = state.filteredWords;
  const totalPages = Math.max(1, Math.ceil(words.length / PAGE_SIZE));
  state.currentPage = Math.min(state.currentPage, totalPages);

  const start = (state.currentPage - 1) * PAGE_SIZE;
  const page = words.slice(start, start + PAGE_SIZE);

  const tbody = document.getElementById("wordTableBody");
  tbody.innerHTML = "";

  for (let i = 0; i < page.length; i++) {
    const w = page[i];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${start + i + 1}</td>
      <td>${escapeHtml(w.surface)}</td>
      <td>${escapeHtml(w.reading)}</td>
      <td><span class="level-badge level-badge--${w.level}">${w.level}</span></td>
      <td><span class="cat-badge cat-badge--${w.category}">${w.category}</span></td>`;
    tbody.appendChild(tr);
  }

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const container = document.getElementById("pagination");
  container.innerHTML = "";

  if (totalPages <= 1) return;

  const addBtn = (label, page, disabled = false, active = false) => {
    const btn = document.createElement("button");
    btn.className = `page-btn${active ? " page-btn--active" : ""}`;
    btn.textContent = label;
    btn.disabled = disabled;
    if (!disabled && !active) {
      btn.addEventListener("click", () => {
        state.currentPage = page;
        renderWordTable();
        document.querySelector(".browser-section").scrollIntoView({ behavior: "smooth" });
      });
    }
    container.appendChild(btn);
  };

  addBtn("\u2039", state.currentPage - 1, state.currentPage === 1);

  // Show pages around current
  const range = 2;
  let startPage = Math.max(1, state.currentPage - range);
  let endPage = Math.min(totalPages, state.currentPage + range);

  if (startPage > 1) {
    addBtn("1", 1);
    if (startPage > 2) {
      const dots = document.createElement("span");
      dots.className = "page-btn";
      dots.textContent = "...";
      dots.style.cursor = "default";
      container.appendChild(dots);
    }
  }

  for (let p = startPage; p <= endPage; p++) {
    addBtn(String(p), p, false, p === state.currentPage);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const dots = document.createElement("span");
      dots.className = "page-btn";
      dots.textContent = "...";
      dots.style.cursor = "default";
      container.appendChild(dots);
    }
    addBtn(String(totalPages), totalPages);
  }

  addBtn("\u203A", state.currentPage + 1, state.currentPage === totalPages);
}

// --- Export Functions ---
async function copyToClipboard() {
  let words = state.filteredWords;
  if (state.exportRandom) {
    words = shuffleWithTimeSeed(words);
  }
  const text = words.map((w) => `${w.surface}\t${w.reading}`).join("\n");
  try {
    await navigator.clipboard.writeText(text);
    const suffix = state.exportRandom ? " (random order)" : "";
    showSnackbar(`Copied ${words.length} words to clipboard${suffix}`);
  } catch {
    showSnackbar("Failed to copy - check browser permissions");
  }
}

function shuffleWithTimeSeed(arr) {
  let seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  const rand = () => {
    seed = (seed + 0x6D2B79F5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function downloadFile(format) {
  const params = buildWordParams();
  params.set("format", format);

  try {
    const resp = await fetch(`/api/words?${params}`);
    if (!resp.ok) throw new Error(`Server returned ${resp.status}`);

    const blob = await resp.blob();
    const ext = format === "json" ? "json" : "csv";
    const filename = `jlpt_words_${new Date().toISOString().slice(0, 10)}.${ext}`;

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    showSnackbar(`Downloaded ${filename}`);
  } catch (err) {
    showSnackbar(`Download failed: ${err.message}`);
  }
}

// --- Utilities ---
function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

let snackbarTimer = null;
function showSnackbar(msg) {
  const el = document.getElementById("snackbar");
  el.textContent = msg;
  el.classList.add("snackbar--visible");
  clearTimeout(snackbarTimer);
  snackbarTimer = setTimeout(() => el.classList.remove("snackbar--visible"), 3000);
}
