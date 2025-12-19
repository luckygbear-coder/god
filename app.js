/* =========================
   狀態 & 存檔
========================= */
const LS_KEY = "wwg_state_v1";

const defaultState = () => ({
  phase: "SETUP", // SETUP | DEAL | NIGHT | DAY | END
  step: "SETUP_BOARD",
  n: 12,
  boardId: "official-12",
  boards: [],

  // seat data
  seats: [], // {no, alive, role, camp, marks:{death,by,rescued}, selected}
  godEye: false,

  // settings
  winMode: "edge",
  hasPolice: true,

  // timer
  timer: { sec: 90, running: false, endAt: 0 },

  // vote announce (string)
  voteAnnounce: ""
});

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    return Object.assign(defaultState(), s);
  } catch {
    return defaultState();
  }
}
function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}
function hardResetToSetup() {
  state = defaultState();
  saveState();
  renderAll();
}
function endGameClearAll() {
  localStorage.removeItem(LS_KEY);
  location.reload();
}

let state = loadState();

/* =========================
   板子資料（內建 fallback）
   你可以之後換成 fetch JSON
========================= */
const BOARD_FALLBACK = [
  {
    id: "official-12",
    title: "12人官方標準局",
    desc: "4狼 + 預言家/女巫/守衛/獵人 + 4民",
    tags: ["官方", "穩", "含白癡"],
    n: 12,
    roles: {
      wolves: 4,
      gods: ["seer", "witch", "guard", "hunter"],
      villagers: 4,
      extras: ["idiot"] // 先給欄位：之後你要「可切換白癡/首位」就放這裡做 UI
    }
  },
  {
    id: "12-city",
    title: "12人（標準角色・屠城）",
    desc: "同標準角色，勝負改屠城",
    tags: ["測試", "屠城"],
    n: 12,
    roles: {
      wolves: 4,
      gods: ["seer", "witch", "guard", "hunter"],
      villagers: 4
    },
    preset: { winMode: "city" }
  },
  {
    id: "12-edge-nopolice",
    title: "12人（屠邊・無上警）",
    desc: "同標準角色，但關閉上警",
    tags: ["測試", "無上警"],
    n: 12,
    roles: {
      wolves: 4,
      gods: ["seer", "witch", "guard", "hunter"],
      villagers: 4
    },
    preset: { winMode: "edge", hasPolice: false }
  }
];

function ensureBoards() {
  if (!Array.isArray(state.boards) || state.boards.length === 0) {
    state.boards = BOARD_FALLBACK;
  }
}

/* =========================
   DOM
========================= */
const $ = (id) => document.getElementById(id);

const uiStatus = $("uiStatus");
const uiBoard = $("uiBoard");

const setupArea = $("setupArea");
const boardPicker = $("boardPicker");

const promptTitle = $("promptTitle");
const promptText = $("promptText");
const promptFoot = $("promptFoot");

const seatsGrid = $("seatsGrid");

const btnBack = $("btnBack");
const btnPrimary = $("btnPrimary");
const btnCancel = $("btnCancel");

const backdrop = $("backdrop");
const drawerSettings = $("drawerSettings");
const drawerGod = $("drawerGod");
const drawerTimer = $("drawerTimer");
const drawerVote = $("drawerVote");

const btnSettings = $("btnSettings");
const btnCloseSettings = $("btnCloseSettings");

const btnGodEye = $("btnGodEye");
const btnCloseGod = $("btnCloseGod");

const btnHourglass = $("btnHourglass");
const btnCloseTimer = $("btnCloseTimer");

const btnVoteDrawer = $("btnVoteDrawer");
const btnCloseVote = $("btnCloseVote");
const voteAnnounceText = $("voteAnnounceText");

const segEdge = $("segEdge");
const segCity = $("segCity");
const togglePolice = $("togglePolice");
const btnGoSetup = $("btnGoSetup");
const btnEndGame = $("btnEndGame");

const godText = $("godText");

const timerBig = $("timerBig");
const btnTimerStart = $("btnTimerStart");
const btnTimerPause = $("btnTimerPause");
const btnTimerReset = $("btnTimerReset");

/* =========================
   Drawer helpers
========================= */
function openDrawer(drawerEl) {
  backdrop.classList.remove("hidden");
  drawerEl.classList.remove("hidden");
  drawerEl.setAttribute("aria-hidden", "false");
}
function closeDrawer(drawerEl) {
  drawerEl.classList.add("hidden");
  drawerEl.setAttribute("aria-hidden", "true");
  // 若沒有其他抽屜開著才關 backdrop
  const anyOpen = [drawerSettings, drawerGod, drawerTimer, drawerVote].some(d => !d.classList.contains("hidden"));
  if (!anyOpen) backdrop.classList.add("hidden");
}
function closeAllDrawers() {
  [drawerSettings, drawerGod, drawerTimer, drawerVote].forEach(d => {
    d.classList.add("hidden");
    d.setAttribute("aria-hidden", "true");
  });
  backdrop.classList.add("hidden");
}

/* =========================
   Setup / Seats init
========================= */
function initSeatsIfNeeded() {
  if (!Array.isArray(state.seats) || state.seats.length !== state.n) {
    state.seats = Array.from({ length: state.n }, (_, i) => ({
      no: i + 1,
      alive: true,
      role: null,       // e.g. "witch"
      camp: null,       // "wolf" | "good"
      marks: {
        death: null,    // "狼刀"|"毒死"|"槍殺"|"黑狼槍"|"白狼爪"
        by: null,       // attacker seat no etc (optional)
        rescued: false  // 被女巫救
      },
      selected: false
    }));
  }
}

function setPeople(n) {
  state.n = n;
  initSeatsIfNeeded();
  // 如果當前 board 不匹配人數，切換到同人數第一個
  const list = state.boards.filter(b => b.n === n);
  if (list.length > 0) state.boardId = list[0].id;
  saveState();
  renderAll();
}

function applyBoard(boardId) {
  const b = state.boards.find(x => x.id === boardId);
  if (!b) return;
  state.boardId = b.id;

  // 套用 preset
  if (b.preset?.winMode) state.winMode = b.preset.winMode;
  if (typeof b.preset?.hasPolice === "boolean") state.hasPolice = b.preset.hasPolice;

  // 板子人數若不同
  if (b.n && b.n !== state.n) {
    state.n = b.n;
    initSeatsIfNeeded();
  }

  saveState();
  renderAll();
}

/* =========================
   UI render
========================= */
function getBoard() {
  return state.boards.find(b => b.id === state.boardId) || state.boards[0];
}

function renderHeader() {
  uiStatus.textContent = `${state.phase} / ${state.step}`;
  uiBoard.textContent = state.boardId || "—";
}

function renderSetupArea() {
  // ✅ 只有 SETUP 才顯示，進入遊戲後完全不佔位
  const isSetup = state.phase === "SETUP";
  setupArea.classList.toggle("hidden", !isSetup);

  // 綁定人數 chips
  document.querySelectorAll(".setupChips .chip[data-n]").forEach(btn => {
    const n = Number(btn.dataset.n);
    btn.classList.toggle("primary", n === state.n);
    btn.onclick = () => setPeople(n);
  });

  // render boards
  renderBoardPicker();
}

function renderBoardPicker() {
  const list = state.boards.filter(b => b.n === state.n);
  boardPicker.innerHTML = "";
  list.forEach(b => {
    const el = document.createElement("div");
    el.className = "boardCard" + (b.id === state.boardId ? " active" : "");
    el.innerHTML = `
      <div class="boardTitle">${b.title}</div>
      <div class="boardSub">${b.id} ・ ${b.desc}</div>
      <div class="badges">
        ${(b.tags || []).map(t => `<span class="badge">${t}</span>`).join("")}
      </div>
    `;
    el.onclick = () => applyBoard(b.id);
    boardPicker.appendChild(el);
  });
}

function renderPrompt() {
  const b = getBoard();

  if (state.phase === "SETUP") {
    promptTitle.textContent = "設定：選板子";
    promptText.textContent =
`目前人數：${state.n}
請在下方選擇板子套用。
套用後按「下一步」進入抽身分。

提示：
- 板子選中會變色
- 要換板子/人數：之後到 ⚙️ 設定 →「更換人數/板子」`;
    promptFoot.textContent = "";
    btnVoteDrawer.classList.add("hidden");
    return;
  }

  // 其他 phase：你可以接回你原本完整流程
  promptTitle.textContent = (state.phase === "NIGHT") ? "夜晚" : "流程";
  promptText.textContent =
`（示意）
目前板子：${b.title}

✅ 流程與座位同頁常駐
✅ 👁️ 可開上帝抽屜 + 格子顯示角色陣營與死亡原因/救人`;
  promptFoot.textContent = "按「下一步」繼續。";
}

function seatDisplayLines(seat) {
  const lines = [];
  if (!seat.alive) lines.push("死亡");

  // 👁️ 上帝視角：顯示角色/陣營
  if (state.godEye) {
    if (seat.camp) lines.push(seat.camp === "wolf" ? "🐺狼" : "🧑‍🌾好");
    if (seat.role) lines.push(seat.role);
  } else {
    lines.push(seat.alive ? "存活" : "死亡");
  }

  return lines;
}

function renderSeats() {
  initSeatsIfNeeded();
  seatsGrid.innerHTML = "";

  state.seats.forEach(seat => {
    const el = document.createElement("div");
    el.className = "seat" +
      (seat.selected ? " selected" : "") +
      (!seat.alive ? " dead" : "");

    const stateLines = seatDisplayLines(seat);
    const meta = [];

    if (state.godEye) {
      // 死亡原因 / 被救
      if (seat.marks?.rescued) meta.push("💊 被救");
      if (!seat.alive && seat.marks?.death) meta.push(`☠️ ${seat.marks.death}`);
    }

    el.innerHTML = `
      <div class="seatNum">${seat.no}號</div>
      <div class="seatState">${stateLines.join("・")}</div>
      ${meta.length ? `<div class="seatMeta">${meta.join(" / ")}</div>` : ``}
    `;

    el.onclick = () => onSeatTap(seat.no);
    seatsGrid.appendChild(el);
  });
}

function renderSettingsUI() {
  segEdge.classList.toggle("active", state.winMode === "edge");
  segCity.classList.toggle("active", state.winMode === "city");
  togglePolice.checked = !!state.hasPolice;
}

function renderGodText() {
  const aliveW = state.seats.filter(s => s.alive && s.camp === "wolf").length;
  const aliveG = state.seats.filter(s => s.alive && s.camp === "good").length;

  godText.textContent =
`人數：${state.n}
板子：${state.boardId}
勝負：${state.winMode === "edge" ? "屠邊" : "屠城"}
上警：${state.hasPolice ? "開" : "關"}
上帝視角：${state.godEye ? "開（格子顯示角色陣營）" : "關"}

存活：狼 ${aliveW} / 好 ${aliveG}

提示：
- 👁️ 開啟後，座位格會顯示角色/陣營/死亡原因/救人
- 要更換板子/人數：⚙️ 設定 → 更換人數/板子`;
}

/* =========================
   interactions
========================= */
function onSeatTap(no) {
  // ✅ 點選要變色（明顯）
  state.seats.forEach(s => s.selected = (s.no === no));
  saveState();
  renderSeats();
}

/* =========================
   Flow buttons
========================= */
function goNext() {
  // ✅ SETUP -> 進入 DEAL 後，把 setupArea 隱藏（phase 變更）
  if (state.phase === "SETUP") {
    state.phase = "DEAL";
    state.step = "DEAL_START";
    saveState();
    renderAll();
    return;
  }

  // demo flow
  if (state.phase === "DEAL") {
    state.phase = "NIGHT";
    state.step = "NIGHT_START";
  } else if (state.phase === "NIGHT") {
    state.phase = "DAY";
    state.step = "DAY_START";
  } else {
    state.phase = "NIGHT";
    state.step = "NIGHT_START";
  }

  saveState();
  renderAll();
}

function goBack() {
  // 簡化：讓你可以退回 SETUP（你也可限制只允許從設定回去）
  if (state.phase !== "SETUP") {
    state.phase = "SETUP";
    state.step = "SETUP_BOARD";
    saveState();
    renderAll();
  }
}

function cancelAction() {
  // 先做：清選取
  state.seats.forEach(s => s.selected = false);
  saveState();
  renderSeats();
}

/* =========================
   Timer
========================= */
let timerTick = null;

function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function renderTimer() {
  timerBig.textContent = fmt(state.timer.sec);
}

function timerStart() {
  if (state.timer.running) return;
  state.timer.running = true;
  state.timer.endAt = Date.now() + state.timer.sec * 1000;
  saveState();
  startTimerLoop();
}

function timerPause() {
  if (!state.timer.running) return;
  state.timer.running = false;
  // 計算剩餘
  const left = Math.max(0, Math.round((state.timer.endAt - Date.now()) / 1000));
  state.timer.sec = left;
  saveState();
  stopTimerLoop();
  renderTimer();
}

function timerReset() {
  state.timer.running = false;
  state.timer.sec = 90;
  state.timer.endAt = 0;
  saveState();
  stopTimerLoop();
  renderTimer();
}

function startTimerLoop() {
  stopTimerLoop();
  timerTick = setInterval(() => {
    if (!state.timer.running) return;
    const left = Math.max(0, Math.round((state.timer.endAt - Date.now()) / 1000));
    state.timer.sec = left;
    renderTimer();
    if (left <= 0) {
      state.timer.running = false;
      saveState();
      stopTimerLoop();
      // 震動（可用就震動）
      if (navigator.vibrate) navigator.vibrate([120,80,120]);
    }
  }, 250);
}

function stopTimerLoop() {
  if (timerTick) clearInterval(timerTick);
  timerTick = null;
}

/* =========================
   bind events
========================= */
function bindEvents() {
  backdrop.onclick = closeAllDrawers;

  btnSettings.onclick = () => { renderSettingsUI(); openDrawer(drawerSettings); };
  btnCloseSettings.onclick = () => closeDrawer(drawerSettings);

  btnGodEye.onclick = () => { renderGodText(); openDrawer(drawerGod); };
  btnCloseGod.onclick = () => closeDrawer(drawerGod);

  btnHourglass.onclick = () => { renderTimer(); openDrawer(drawerTimer); };
  btnCloseTimer.onclick = () => closeDrawer(drawerTimer);

  btnVoteDrawer.onclick = () => { voteAnnounceText.textContent = state.voteAnnounce || "—"; openDrawer(drawerVote); };
  btnCloseVote.onclick = () => closeDrawer(drawerVote);

  segEdge.onclick = () => { state.winMode = "edge"; saveState(); renderSettingsUI(); renderGodText(); };
  segCity.onclick = () => { state.winMode = "city"; saveState(); renderSettingsUI(); renderGodText(); };

  togglePolice.onchange = (e) => { state.hasPolice = !!e.target.checked; saveState(); renderGodText(); };

  btnGoSetup.onclick = () => {
    closeAllDrawers();
    state.phase = "SETUP";
    state.step = "SETUP_BOARD";
    saveState();
    renderAll();
  };

  btnEndGame.onclick = () => {
    // 結束本局：清存檔回到初始
    endGameClearAll();
  };

  btnBack.onclick = goBack;
  btnPrimary.onclick = goNext;
  btnCancel.onclick = cancelAction;

  // timer preset chips
  document.querySelectorAll("#drawerTimer .chip[data-sec]").forEach(btn => {
    btn.onclick = () => {
      const sec = Number(btn.dataset.sec);
      state.timer.sec = sec;
      state.timer.running = false;
      state.timer.endAt = 0;
      saveState();
      stopTimerLoop();
      renderTimer();
    };
  });

  btnTimerStart.onclick = timerStart;
  btnTimerPause.onclick = timerPause;
  btnTimerReset.onclick = timerReset;
}

/* =========================
   main render
========================= */
function renderAll() {
  ensureBoards();
  initSeatsIfNeeded();
  renderHeader();
  renderSetupArea();
  renderPrompt();
  renderSeats();
  renderGodText();
  renderTimer();

  // ✅ 進入遊戲後：setupArea 自動隱藏（renderSetupArea 已處理）
  // ✅ 上帝視角開關：這裡不直接切換，由你之後要加「抽屜內 switch」也可以
}

(function boot(){
  ensureBoards();
  initSeatsIfNeeded();

  bindEvents();

  // restore timer loop if running
  if (state.timer.running) startTimerLoop();
  renderAll();
})();