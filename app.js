/* =========================
   Werewolf MVP - Day0~Day2
   - SETUP:A1 choose count
   - SETUP:A2 load board + config winMode/hasPolice
   - SETUP:A3 assign roles + long-press reveal (0.3s) + seen gate
   ========================= */

const STORAGE_KEY = "werewolf_mvp_state_v1";

const ROLE_LABELS = {
  wolf:   { name: "狼人", camp: "wolf" },
  seer:   { name: "預言家", camp: "good" },
  witch:  { name: "女巫", camp: "good" },
  hunter: { name: "獵人", camp: "good" },
  idiot:  { name: "白癡", camp: "good", isGod: true },
  villager:{ name: "平民", camp: "good" }
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

const btnBack = document.getElementById("btnBack");
const btnPrimary = document.getElementById("btnPrimary");
const btnCancel = document.getElementById("btnCancel");

// ----- State
let state = loadState() ?? makeInitialState();
render();

// =========================
// iOS anti-zoom / anti-callout (extra hardening)
// =========================
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
document.addEventListener("contextmenu", (e) => e.preventDefault());

// =========================
// Events
// =========================
btnPrimary.addEventListener("click", () => {
  if (state.flow.phase === "SETUP" && state.flow.stepId === "SETUP:A1") {
    // Must choose playersCount
    if (!state.config.playersCount) {
      toast("請先選人數");
      return;
    }
    goStep("SETUP:A2");
    return;
  }

  if (state.flow.phase === "SETUP" && state.flow.stepId === "SETUP:A2") {
    // Confirm board -> A3
    goStep("SETUP:A3");
    // auto assign roles when enter A3
    if (!state.setup.rolesAssigned) assignRolesForSetup();
    return;
  }

  if (state.flow.phase === "SETUP" && state.flow.stepId === "SETUP:A3") {
    if (!allSeatsSeen()) {
      toast("還有人沒看身分喔～");
      return;
    }
    // next to night (we'll stop here for Day2)
    toast("✅ Day2 完成：已可進夜晚（下一版接 NIGHT）");
    // You can switch to NIGHT:N0 later
    return;
  }
});

btnCancel.addEventListener("click", () => {
  // clear reveal/pending etc
  state.ui.revealingSeat = null;
  saveAndRender();
});

btnSettings.addEventListener("click", () => openDrawer());
btnCloseDrawer.addEventListener("click", () => closeDrawer());
drawerBackdrop.addEventListener("click", () => closeDrawer());

toggleGodView.addEventListener("change", () => {
  state.ui.godExpanded = !!toggleGodView.checked;
  saveAndRender(false);
});

segEdge.addEventListener("click", () => setWinMode("edge"));
segCity.addEventListener("click", () => setWinMode("city"));

togglePolice.addEventListener("change", () => {
  if (!isSetupPhase()) return;
  state.board.hasPolice = !!togglePolice.checked;
  saveAndRender();
});

btnReset.addEventListener("click", () => {
  if (!confirm("確定要重置本局？（會清除存檔）")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = makeInitialState();
  render();
});

// =========================
// State helpers
// =========================
function makeInitialState() {
  return {
    meta: { version: "mvp-1.0", createdAt: Date.now(), updatedAt: Date.now() },
    config: { playersCount: null },
    board: null, // loaded board config
    players: [],
    flow: {
      phase: "SETUP",
      round: 1,
      stepId: "SETUP:A1",
      stepIndex: 0,
      pending: null
    },
    setup: {
      rolesAssigned: false,
      seenSeats: [] // seat numbers
    },
    ui: {
      godExpanded: false,
      revealingSeat: null
    }
  };
}

function isSetupPhase() {
  return state.flow.phase === "SETUP";
}

function goStep(stepId) {
  state.flow.stepId = stepId;
  state.flow.stepIndex += 1;
  // keep phase as SETUP for Day2
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
  const map = {
    9: "./boards/official-9.json",
    10: "./boards/official-10.json",
    12: "./boards/official-12.json"
  };
  const url = map[count];
  if (!url) throw new Error("Unsupported playersCount");
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Board load failed");
  return await res.json();
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
  // Load board
  loadBoardByCount(count).then((board) => {
    state.board = board;
    // board default options
    // allow setup override
    state.board.winCondition = state.board.winCondition || { mode: "city" };
    state.meta.updatedAt = Date.now();
    saveAndRender();
  }).catch((err) => {
    console.error(err);
    toast("讀取板子失敗（請檢查 boards 檔案）");
  });
}

// =========================
// Role assignment for SETUP.A3
// =========================
function assignRolesForSetup() {
  const board = state.board;
  if (!board) return;

  // Build role list by counts
  const roleList = [];
  for (const r of board.roles) {
    for (let i = 0; i < r.count; i++) roleList.push(r.roleId);
  }
  if (roleList.length !== state.players.length) {
    console.warn("Role count mismatch", roleList.length, state.players.length);
  }
  shuffle(roleList);

  // Assign
  state.players.forEach((p, idx) => {
    const roleId = roleList[idx] ?? "villager";
    const spec = ROLE_LABELS[roleId] ?? { name: roleId, camp: "good" };
    p.roleId = roleId;
    p.camp = spec.camp;
    p.revealed = false;
  });

  // apply board hasPolice default to settings UI
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
  // columns suggestion
  let cols = 3;
  if (n === 12) cols = 4;
  else if (n === 10) cols = 5;
  else cols = 3;
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

    // Show role only when revealing (SETUP:A3)
    if (state.flow.stepId === "SETUP:A3" && state.ui.revealingSeat === p.seat) {
      const spec = ROLE_LABELS[p.roleId] || { name: "未知", camp: "good" };
      tag.textContent = `${spec.name} · ${spec.camp === "wolf" ? "狼人陣營" : "好人陣營"}`;
    } else {
      tag.textContent = p.alive ? "存活" : "死亡";
    }

    el.appendChild(corner);
    el.appendChild(num);
    el.appendChild(tag);

    // interactions:
    wireSeatInteractions(el, p.seat);

    seatsGrid.appendChild(el);
  });
}

function wireSeatInteractions(el, seat) {
  // Only meaningful in SETUP:A3 for now
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
      // reveal
      state.ui.revealingSeat = seat;
      if (!state.setup.seenSeats.includes(seat)) state.setup.seenSeats.push(seat);
      saveAndRender();
    }, PRESS_MS);
  };

  const endPress = (e) => {
    e.preventDefault();
    clearTimeout(pressTimer);
    pressTimer = null;
    // hide reveal when release
    if (state.ui.revealingSeat === seat) {
      state.ui.revealingSeat = null;
      saveAndRender(false);
    }
  };

  // Touch
  el.addEventListener("touchstart", startPress, { passive: false });
  el.addEventListener("touchend", endPress, { passive: false });
  el.addEventListener("touchcancel", endPress, { passive: false });

  // Mouse (desktop testing)
  el.addEventListener("mousedown", startPress);
  el.addEventListener("mouseup", endPress);
  el.addEventListener("mouseleave", endPress);

  // Tap to re-view (your requirement)
  el.addEventListener("click", (e) => {
    e.preventDefault();
    // quick tap toggles reveal (for re-view)
    state.ui.revealingSeat = (state.ui.revealingSeat === seat) ? null : seat;
    if (state.ui.revealingSeat === seat && !state.setup.seenSeats.includes(seat)) {
      state.setup.seenSeats.push(seat);
    }
    saveAndRender();
  });
}

// =========================
// Settings drawer helpers
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
  if (!state.board) {
    toast("請先選人數並套用板子");
    return;
  }
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

  // lock when not in setup
  const lock = !isSetupPhase() || state.flow.stepId.startsWith("NIGHT");
  segEdge.disabled = lock;
  segCity.disabled = lock;
  togglePolice.disabled = lock;
}

// =========================
// Render
// =========================
function render() {
  // status
  uiStatus.textContent = `${state.flow.phase} / R${state.flow.round} / ${state.flow.stepId}`;
  uiBoard.textContent = state.board ? state.board.title : "未套用板子";

  toggleGodView.checked = !!state.ui.godExpanded;

  // prompt by step
  renderPrompt();

  // god panel
  renderGodPanel();

  // seats
  renderSeats();

  // action buttons state
  renderActions();

  // persist minimal
  saveState(state);
}

function renderPrompt() {
  const step = state.flow.stepId;

  if (step === "SETUP:A1") {
    promptTitle.textContent = "選擇人數";
    promptText.textContent = "請選擇人數：9人、10人或12人。";
    promptFoot.textContent = state.config.playersCount ? `已選：${state.config.playersCount}人` : "尚未選擇";
  } else if (step === "SETUP:A2") {
    promptTitle.textContent = "確認板子";
    if (!state.board) {
      promptText.textContent = "載入板子中…（若一直卡住，請檢查 boards/ 檔案）";
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
    godText.textContent = "選完人數後會自動載入對應官方板子。";
  } else if (step === "SETUP:A2") {
    if (!state.board) {
      godText.textContent = "載入板子中…";
    } else {
      const roleCounts = state.board.roles.map(r => `${ROLE_LABELS[r.roleId]?.name ?? r.roleId}×${r.count}`).join("、");
      godText.textContent =
        `板子ID：${state.board.id}\n` +
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
  btnCancel.disabled = (state.flow.stepId !== "SETUP:A3");

  if (step === "SETUP:A1") {
    btnPrimary.textContent = "下一步";
    btnPrimary.disabled = !state.config.playersCount;
  } else if (step === "SETUP:A2") {
    btnPrimary.textContent = "下一步";
    btnPrimary.disabled = !state.board;
  } else if (step === "SETUP:A3") {
    btnPrimary.textContent = allSeatsSeen() ? "確認進夜晚" : "確認進夜晚";
    btnPrimary.disabled = !allSeatsSeen();
  } else {
    btnPrimary.textContent = "下一步";
    btnPrimary.disabled = false;
  }

  // render count selection buttons inside prompt foot on A1
  if (step === "SETUP:A1") {
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
  }
}

// add minimal styles for inline buttons
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

// initial sync for drawer
syncDrawerUI();