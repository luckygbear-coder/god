/* =========================
   Werewolf MVP - Day0~Day2 + Timer + Board Fallback
   ========================= */

const STORAGE_KEY = "werewolf_mvp_state_v2";

// ---- Role labels
const ROLE_LABELS = {
  wolf:   { name: "狼人", camp: "wolf" },
  seer:   { name: "預言家", camp: "good", isGod: true },
  witch:  { name: "女巫", camp: "good", isGod: true },
  hunter: { name: "獵人", camp: "good", isGod: true },
  idiot:  { name: "白癡", camp: "good", isGod: true },
  villager:{ name: "平民", camp: "good", isGod: false }
};

// ---- Board fallback (寫入在 app.js，避免 fetch 失敗就掛)
const BOARD_FALLBACK = {
  9: {
    id: "official-9",
    title: "9 人官方標準局",
    playersCount: 9,
    hasPolice: false,
    winCondition: { mode: "city" },
    roles: [
      { roleId: "wolf", count: 3 },
      { roleId: "seer", count: 1 },
      { roleId: "witch", count: 1 },
      { roleId: "hunter", count: 1 },
      { roleId: "villager", count: 3 }
    ],
    nightSteps: [
      { id: "wolf", name: "狼人", wakeOrder: 1, alwaysShow: true, actionType: "pick", seatPickRule: { mode: "single", allowSelf: false, allowDead: false, allowNone: true } },
      { id: "seer", name: "預言家", wakeOrder: 2, alwaysShow: true, actionType: "pick", seatPickRule: { mode: "single", allowSelf: true, allowDead: false, allowNone: false } },
      { id: "witch", name: "女巫", wakeOrder: 3, alwaysShow: true, actionType: "pick" }
    ]
  },
  10: {
    id: "official-10",
    title: "10 人官方標準局",
    playersCount: 10,
    hasPolice: false,
    winCondition: { mode: "city" },
    roles: [
      { roleId: "wolf", count: 3 },
      { roleId: "seer", count: 1 },
      { roleId: "witch", count: 1 },
      { roleId: "hunter", count: 1 },
      { roleId: "villager", count: 4 }
    ],
    nightSteps: [
      { id: "wolf", name: "狼人", wakeOrder: 1, alwaysShow: true, actionType: "pick", seatPickRule: { mode: "single", allowSelf: false, allowDead: false, allowNone: true } },
      { id: "seer", name: "預言家", wakeOrder: 2, alwaysShow: true, actionType: "pick", seatPickRule: { mode: "single", allowSelf: true, allowDead: false, allowNone: false } },
      { id: "witch", name: "女巫", wakeOrder: 3, alwaysShow: true, actionType: "pick" }
    ]
  },
  12: {
    id: "official-12",
    title: "12 人官方標準局",
    playersCount: 12,
    hasPolice: true,
    winCondition: { mode: "edge" },
    roles: [
      { roleId: "wolf", count: 4 },
      { roleId: "seer", count: 1 },
      { roleId: "witch", count: 1 },
      { roleId: "hunter", count: 1 },
      { roleId: "idiot", count: 1 },
      { roleId: "villager", count: 4 }
    ],
    nightSteps: [
      { id: "wolf", name: "狼人", wakeOrder: 1, alwaysShow: true, actionType: "pick", seatPickRule: { mode: "single", allowSelf: false, allowDead: false, allowNone: true } },
      { id: "seer", name: "預言家", wakeOrder: 2, alwaysShow: true, actionType: "pick", seatPickRule: { mode: "single", allowSelf: true, allowDead: false, allowNone: false } },
      { id: "witch", name: "女巫", wakeOrder: 3, alwaysShow: true, actionType: "pick" }
    ]
  }
};

// ----- UI refs
const uiStatus = document.getElementById("uiStatus");
const uiBoard = document.getElementById("uiBoard");
const promptTitle = document.getElementById("promptTitle");
const promptText = document.getElementById("promptText");
const promptFoot = document.getElementById("promptFoot");
const godText = document.getElementById("godText");
const toggleGodView = document.getElementById("toggleGodView");
const seatsGrid = document.getElementById("seatsGrid");

const btnSettings = document.getElementById("btnSettings");
const drawer = document.getElementById("drawer");
const drawerBackdrop = document.getElementById("drawerBackdrop");
const btnCloseDrawer = document.getElementById("btnCloseDrawer");
const segEdge = document.getElementById("segEdge");
const segCity = document.getElementById("segCity");
const togglePolice = document.getElementById("togglePolice");
const btnReset = document.getElementById("btnReset");

const btnTimer = document.getElementById("btnTimer");
const timerDrawer = document.getElementById("timerDrawer");
const timerBackdrop = document.getElementById("timerBackdrop");
const btnCloseTimer = document.getElementById("btnCloseTimer");
const timerBig = document.getElementById("timerBig");
const timerHint = document.getElementById("timerHint");
const btnTimerStart = document.getElementById("btnTimerStart");
const btnTimerPause = document.getElementById("btnTimerPause");
const btnTimerReset = document.getElementById("btnTimerReset");
const timerPresets = document.getElementById("timerPresets");

const btnBack = document.getElementById("btnBack");
const btnPrimary = document.getElementById("btnPrimary");
const btnCancel = document.getElementById("btnCancel");

// ----- State
let state = loadState() ?? makeInitialState();
let timerTick = null;

// =========================
// iOS anti-zoom / anti-callout
// =========================
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
document.addEventListener("contextmenu", (e) => e.preventDefault());

// =========================
// Events - Main
// =========================
btnPrimary.addEventListener("click", () => {
  if (state.flow.phase === "SETUP" && state.flow.stepId === "SETUP:A1") {
    if (!state.config.playersCount) return toast("請先選人數");
    goStep("SETUP:A2");
    return;
  }

  if (state.flow.phase === "SETUP" && state.flow.stepId === "SETUP:A2") {
    goStep("SETUP:A3");
    if (!state.setup.rolesAssigned) assignRolesForSetup();
    return;
  }

  if (state.flow.phase === "SETUP" && state.flow.stepId === "SETUP:A3") {
    if (!allSeatsSeen()) return toast("還有人沒看身分喔～");
    toast("✅ Day2 完成：已可進夜晚（下一版接 NIGHT）");
    return;
  }
});

btnCancel.addEventListener("click", () => {
  state.ui.revealingSeat = null;
  saveAndRender();
});

// Settings drawer
btnSettings.addEventListener("click", openDrawer);
btnCloseDrawer.addEventListener("click", closeDrawer);
drawerBackdrop.addEventListener("click", closeDrawer);

// Timer drawer
btnTimer.addEventListener("click", openTimer);
btnCloseTimer.addEventListener("click", closeTimer);
timerBackdrop.addEventListener("click", closeTimer);

toggleGodView.addEventListener("change", () => {
  state.ui.godExpanded = !!toggleGodView.checked;
  saveAndRender(false);
});

segEdge.addEventListener("click", () => setWinMode("edge"));
segCity.addEventListener("click", () => setWinMode("city"));

togglePolice.addEventListener("change", () => {
  if (!isSetupPhase()) return;
  if (!state.board) return;
  state.board.hasPolice = !!togglePolice.checked;
  saveAndRender();
});

btnReset.addEventListener("click", () => {
  if (!confirm("確定要重置本局？（會清除存檔）")) return;
  stopTimer(true);
  localStorage.removeItem(STORAGE_KEY);
  state = makeInitialState();
  render();
});

// Timer controls
timerPresets.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-sec]");
  if (!btn) return;
  const sec = Number(btn.dataset.sec);
  setTimer(sec * 1000);
  startTimer();
});

btnTimerStart.addEventListener("click", () => startTimer());
btnTimerPause.addEventListener("click", () => pauseTimer());
btnTimerReset.addEventListener("click", () => resetTimer());

// =========================
// State helpers
// =========================
function makeInitialState() {
  return {
    meta: { version: "mvp-1.1", createdAt: Date.now(), updatedAt: Date.now() },
    config: { playersCount: null },
    board: null,
    players: [],
    flow: { phase: "SETUP", round: 1, stepId: "SETUP:A1", stepIndex: 0, pending: null },
    setup: { rolesAssigned: false, seenSeats: [] },
    ui: { godExpanded: false, revealingSeat: null },
    timer: {
      durationMs: 0,
      remainingMs: 0,
      running: false,
      lastTickAt: 0
    }
  };
}

function isSetupPhase() {
  return state.flow.phase === "SETUP";
}

function goStep(stepId) {
  state.flow.stepId = stepId;
  state.flow.stepIndex += 1;
  state.meta.updatedAt = Date.now();
  saveAndRender();
}

function saveAndRender(shouldSave = true) {
  if (shouldSave) saveState(state);
  render();
}

function saveState(s) {
  s.meta.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// =========================
// Board loading + players init
// =========================
async function loadBoardByCount(count) {
  const urlMap = {
    9: "./boards/official-9.json",
    10: "./boards/official-10.json",
    12: "./boards/official-12.json"
  };

  // 1) try fetch JSON
  try {
    const url = urlMap[count];
    if (!url) throw new Error("unsupported count");
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("fetch failed");
    const json = await res.json();
    return json;
  } catch (e) {
    // 2) fallback to embedded board
    const fb = BOARD_FALLBACK[count];
    if (!fb) throw e;
    return structuredCloneSafe(fb);
  }
}

function structuredCloneSafe(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function initPlayers(count) {
  state.players = Array.from({ length: count }, (_, i) => ({
    seat: i + 1,
    name: `${i + 1}號`,
    alive: true,
    roleId: null,
    camp: null,
    revealed: false,
    markers: {
      isPolice: false,
      isChief: false,
      hasBadge: false,
      idiotRevealed: false,
      hunterCanShoot: true
    }
  }));
  state.setup.seenSeats = [];
  state.setup.rolesAssigned = false;
}

function setPlayersCount(count) {
  state.config.playersCount = count;
  initPlayers(count);

  loadBoardByCount(count).then((board) => {
    // 寫入 board（你說的「板子等需要的內容寫入」）
    state.board = board;
    state.board.winCondition = state.board.winCondition || { mode: "city" };
    // 鎖定：board.playersCount 與 config 一致
    state.board.playersCount = count;
    saveAndRender();
  }).catch((err) => {
    console.error(err);
    toast("讀取板子失敗（請檢查 boards/ 檔案）");
  });
}

// =========================
// Role assignment for SETUP:A3
// =========================
function assignRolesForSetup() {
  const board = state.board;
  if (!board) return;

  const roleList = [];
  for (const r of board.roles) {
    for (let i = 0; i < r.count; i++) roleList.push(r.roleId);
  }
  shuffle(roleList);

  state.players.forEach((p, idx) => {
    const roleId = roleList[idx] ?? "villager";
    const spec = ROLE_LABELS[roleId] ?? { name: roleId, camp: "good" };
    p.roleId = roleId;
    p.camp = spec.camp;
    p.revealed = false;
  });

  state.setup.rolesAssigned = true;
  state.setup.seenSeats = [];
  saveAndRender();
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function allSeatsSeen() {
  return state.players.length > 0 && state.setup.seenSeats.length === state.players.length;
}

// =========================
// Seat rendering + long-press reveal
// =========================
function renderSeats() {
  const n = state.players.length || 9;
  let cols = 3;
  if (n === 12) cols = 4;
  else if (n === 10) cols = 5;
  seatsGrid.dataset.cols = String(cols);

  seatsGrid.innerHTML = "";

  state.players.forEach((p) => {
    const el = document.createElement("div");
    el.className = "seat";
    el.dataset.seat = String(p.seat);

    if (!p.alive) el.classList.add("dead");
    if (state.setup.seenSeats.includes(p.seat)) el.classList.add("seen");
    if (state.ui.revealingSeat === p.seat) el.classList.add("reveal");

    const corner = document.createElement("div");
    corner.className = "corner";
    corner.textContent = state.setup.seenSeats.includes(p.seat) ? "已看" : "未看";

    const num = document.createElement("div");
    num.className = "num";
    num.textContent = `${p.seat}號`;

    const tag = document.createElement("div");
    tag.className = "tag";

    if (state.flow.stepId === "SETUP:A3" && state.ui.revealingSeat === p.seat) {
      const spec = ROLE_LABELS[p.roleId] || { name: "未知", camp: "good" };
      tag.textContent = `${spec.name} · ${spec.camp === "wolf" ? "狼人陣營" : "好人陣營"}`;
    } else {
      tag.textContent = p.alive ? "存活" : "死亡";
    }

    el.appendChild(corner);
    el.appendChild(num);
    el.appendChild(tag);

    wireSeatInteractions(el, p.seat);
    seatsGrid.appendChild(el);
  });
}

function wireSeatInteractions(el, seat) {
  if (state.flow.stepId !== "SETUP:A3") {
    el.addEventListener("click", () => toast(`點了 ${seat}號（目前非抽身分步驟）`));
    return;
  }

  let pressTimer = null;
  const PRESS_MS = 300;

  const startPress = (e) => {
    e.preventDefault();
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      state.ui.revealingSeat = seat;
      if (!state.setup.seenSeats.includes(seat)) state.setup.seenSeats.push(seat);
      saveAndRender();
    }, PRESS_MS);
  };

  const endPress = (e) => {
    e.preventDefault();
    clearTimeout(pressTimer);
    pressTimer = null;
    if (state.ui.revealingSeat === seat) {
      state.ui.revealingSeat = null;
      saveAndRender(false);
    }
  };

  el.addEventListener("touchstart", startPress, { passive: false });
  el.addEventListener("touchend", endPress, { passive: false });
  el.addEventListener("touchcancel", endPress, { passive: false });

  el.addEventListener("mousedown", startPress);
  el.addEventListener("mouseup", endPress);
  el.addEventListener("mouseleave", endPress);

  el.addEventListener("click", (e) => {
    e.preventDefault();
    state.ui.revealingSeat = (state.ui.revealingSeat === seat) ? null : seat;
    if (state.ui.revealingSeat === seat && !state.setup.seenSeats.includes(seat)) {
      state.setup.seenSeats.push(seat);
    }
    saveAndRender();
  });
}

// =========================
// Settings drawer
// =========================
function openDrawer() {
  drawer.classList.remove("hidden");
  drawerBackdrop.classList.remove("hidden");
  syncDrawerUI();
}
function closeDrawer() {
  drawer.classList.add("hidden");
  drawerBackdrop.classList.add("hidden");
}
function setWinMode(mode) {
  if (!isSetupPhase()) {
    toast("進入夜晚後不可更改勝負模式");
    syncDrawerUI();
    return;
  }
  if (!state.board) return toast("請先選人數並套用板子");
  state.board.winCondition = state.board.winCondition || {};
  state.board.winCondition.mode = mode;
  saveAndRender();
  syncDrawerUI();
}
function syncDrawerUI() {
  const mode = state.board?.winCondition?.mode || "city";
  segEdge.classList.toggle("active", mode === "edge");
  segCity.classList.toggle("active", mode === "city");
  togglePolice.checked = !!state.board?.hasPolice;

  const lock = !isSetupPhase() || state.flow.stepId.startsWith("NIGHT");
  segEdge.disabled = lock;
  segCity.disabled = lock;
  togglePolice.disabled = lock;
}

// =========================
// Timer drawer + logic
// =========================
function openTimer() {
  timerDrawer.classList.remove("hidden");
  timerBackdrop.classList.remove("hidden");
  renderTimerUI();
}
function closeTimer() {
  timerDrawer.classList.add("hidden");
  timerBackdrop.classList.add("hidden");
}

function setTimer(ms) {
  state.timer.durationMs = ms;
  state.timer.remainingMs = ms;
  state.timer.running = false;
  state.timer.lastTickAt = 0;
  saveAndRender();
  renderTimerUI();
}

function startTimer() {
  if (!state.timer.durationMs) {
    // default 2:00
    setTimer(120000);
  }
  if (state.timer.remainingMs <= 0) {
    state.timer.remainingMs = state.timer.durationMs;
  }
  state.timer.running = true;
  state.timer.lastTickAt = Date.now();
  ensureTimerTick();
  saveAndRender();
  renderTimerUI();
}

function pauseTimer() {
  if (!state.timer.running) return;
  tickOnce(); // 先把時間扣到最新
  state.timer.running = false;
  saveAndRender();
  renderTimerUI();
}

function resetTimer() {
  state.timer.running = false;
  state.timer.remainingMs = state.timer.durationMs || 0;
  state.timer.lastTickAt = 0;
  saveAndRender();
  renderTimerUI();
}

function stopTimer(clearAll = false) {
  if (timerTick) clearInterval(timerTick);
  timerTick = null;
  if (clearAll) {
    state.timer = { durationMs: 0, remainingMs: 0, running: false, lastTickAt: 0 };
  } else {
    state.timer.running = false;
  }
}

function ensureTimerTick() {
  if (timerTick) return;
  timerTick = setInterval(() => {
    if (!state.timer.running) return;
    tickOnce();
  }, 250);
}

function tickOnce() {
  const now = Date.now();
  const dt = Math.max(0, now - (state.timer.lastTickAt || now));
  state.timer.lastTickAt = now;
  state.timer.remainingMs = Math.max(0, state.timer.remainingMs - dt);

  // finished
  if (state.timer.remainingMs <= 0) {
    state.timer.running = false;
    state.timer.remainingMs = 0;
    // 震動提示（iOS 支援度不一，但不會報錯）
    if (navigator.vibrate) navigator.vibrate([120, 80, 120]);
    toast("⏱️ 時間到！");
  }
  saveState(state);
  renderTimerBadge();
  renderTimerUI();
}

function renderTimerBadge() {
  const running = state.timer.running;
  btnTimer.classList.toggle("running", running);

  const remain = state.timer.remainingMs || 0;
  if (running || remain > 0) {
    const t = formatMMSS(remain);
    btnTimer.textContent = t;
  } else {
    btnTimer.textContent = "⏱️";
  }
}

function renderTimerUI() {
  if (!timerBig) return;
  timerBig.textContent = formatMMSS(state.timer.remainingMs || 0);
  if (state.timer.running) {
    timerHint.textContent = "倒數中…（可暫停或重置）";
  } else if ((state.timer.remainingMs || 0) > 0) {
    timerHint.textContent = "已暫停／待開始（可按開始繼續）";
  } else {
    timerHint.textContent = "選一個常用時間開始，或按開始使用預設 2:00。";
  }
}

function formatMMSS(ms) {
  const sec = Math.ceil(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

// =========================
// Render
// =========================
function render() {
  uiStatus.textContent = `${state.flow.phase} / R${state.flow.round} / ${state.flow.stepId}`;
  uiBoard.textContent = state.board ? state.board.title : "未套用板子";

  toggleGodView.checked = !!state.ui.godExpanded;

  renderPrompt();
  renderGodPanel();
  renderSeats();
  renderActions();

  // timer badge
  renderTimerBadge();
  if (state.timer.running) ensureTimerTick();

  saveState(state);
  syncDrawerUI();
}

function renderPrompt() {
  const step = state.flow.stepId;

  if (step === "SETUP:A1") {
    promptTitle.textContent = "選擇人數";
    promptText.textContent = "請選擇人數：9人、10人或12人。";
    promptFoot.innerHTML = `
      <div class="quick-row">
        <button class="quick" data-count="9">9人</button>
        <button class="quick" data-count="10">10人</button>
        <button class="quick" data-count="12">12人</button>
      </div>
      <div style="margin-top:6px;">${state.config.playersCount ? `已選：${state.config.playersCount}人` : "尚未選擇"}</div>
    `;
    promptFoot.querySelectorAll(".quick").forEach(btn => {
      btn.addEventListener("click", () => {
        const count = Number(btn.dataset.count);
        setPlayersCount(count);
        toast(`已選 ${count} 人`);
      });
    });
  } else if (step === "SETUP:A2") {
    promptTitle.textContent = "確認板子";
    if (!state.board) {
      promptText.textContent = "載入板子中…";
      promptFoot.textContent = "";
    } else {
      const mode = state.board.winCondition?.mode === "edge" ? "屠邊" : "屠城";
      promptText.textContent =
        `已套用：${state.board.title}\n` +
        `上警：${state.board.hasPolice ? "啟用" : "關閉"}\n` +
        `勝負：${mode}（可在⚙️調整）\n\n按「下一步」進入抽身分。`;
      promptFoot.textContent = "提示：進夜晚後，上警/勝負模式會鎖定。";
    }
  } else if (step === "SETUP:A3") {
    promptTitle.textContent = "抽身分";
    promptText.textContent =
      "請大家依序查看身分。看完請把手機交回上帝。\n\n" +
      "操作：長按 0.3 秒翻牌；也可以點座位重看。";
    promptFoot.textContent = `已查看：${state.setup.seenSeats.length} / ${state.players.length}（全部看完才能進夜晚）`;
  } else {
    promptTitle.textContent = "（未定義步驟）";
    promptText.textContent = "目前步驟尚未定義 prompt。";
    promptFoot.textContent = "";
  }
}

function renderGodPanel() {
  if (!state.ui.godExpanded) {
    godText.textContent = "（收合中）";
    return;
  }

  const step = state.flow.stepId;
  if (step === "SETUP:A1") {
    godText.textContent = "選完人數後會自動載入對應官方板子。（若讀取失敗，會自動使用內建備援）";
  } else if (step === "SETUP:A2") {
    if (!state.board) {
      godText.textContent = "載入板子中…";
    } else {
      const roleCounts = state.board.roles.map(r => `${ROLE_LABELS[r.roleId]?.name ?? r.roleId}×${r.count}`).join("、");
      godText.textContent =
        `板子ID：${state.board.id}\n` +
        `人數：${state.board.playersCount}\n` +
        `角色配置：${roleCounts}\n` +
        `夜晚流程：${state.board.nightSteps.map(s=>`${s.wakeOrder}.${s.name}`).join(" → ")}\n` +
        `勝負模式：${state.board.winCondition?.mode}\n` +
        `上警：${state.board.hasPolice}`;
    }
  } else if (step === "SETUP:A3") {
    const seen = new Set(state.setup.seenSeats);
    const unseen = state.players.filter(p => !seen.has(p.seat)).map(p => p.seat);
    godText.textContent =
      `抽身分狀態：${state.setup.rolesAssigned ? "已分配" : "未分配"}\n` +
      `未查看座位：${unseen.length ? unseen.join("、") : "（無）"}\n\n` +
      `提示：只有在抽身分階段才顯示角色；其他階段不顯示。`;
  } else {
    godText.textContent = "（此步驟尚未定義上帝資訊）";
  }
}

function renderActions() {
  const step = state.flow.stepId;

  btnBack.disabled = true; // Day0~2 先鎖
  btnCancel.disabled = (step !== "SETUP:A3");

  if (step === "SETUP:A1") {
    btnPrimary.textContent = "下一步";
    btnPrimary.disabled = !state.config.playersCount;
  } else if (step === "SETUP:A2") {
    btnPrimary.textContent = "下一步";
    btnPrimary.disabled = !state.board;
  } else if (step === "SETUP:A3") {
    btnPrimary.textContent = "確認進夜晚";
    btnPrimary.disabled = !allSeatsSeen();
  } else {
    btnPrimary.textContent = "下一步";
    btnPrimary.disabled = false;
  }
}

// add quick buttons style
const styleTag = document.createElement("style");
styleTag.textContent = `
.quick-row{ display:flex; gap:8px; margin-top:6px; }
.quick{
  flex:1; border:2px solid var(--line); background:#fff;
  border-radius:999px; padding:10px 12px; font-weight:900;
}
`;
document.head.appendChild(styleTag);

// =========================
// Toast
// =========================
let toastTimer = null;
function toast(msg) {
  clearTimeout(toastTimer);
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.style.position = "fixed";
    el.style.left = "50%";
    el.style.bottom = "calc(84px + env(safe-area-inset-bottom, 0px))";
    el.style.transform = "translateX(-50%)";
    el.style.background = "rgba(0,0,0,.75)";
    el.style.color = "#fff";
    el.style.padding = "10px 12px";
    el.style.borderRadius = "999px";
    el.style.fontSize = "12px";
    el.style.zIndex = "999";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.display = "block";
  toastTimer = setTimeout(() => (el.style.display = "none"), 1400);
}

// =========================
// Boot
// =========================
render();
renderTimerUI();