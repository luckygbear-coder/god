/* =========================================================
   Werewolf God Helper - app.js (FULL REPLACE)
   - Fix: Thief rule = REPLACE, wolves max fixed (e.g. 4)
   - Thief chooses immediately after ALL seen (before night)
   - After viewing role, auto-cover (no leaking)
   - Tap same seat toggles selection (cancel)
   - Basic night flow: Guard -> Wolves -> Seer -> Witch -> Day
   - Works with the HTML you provided (ids must match)
========================================================= */

/* -------------------- iOS: prevent selection/zoom/menu -------------------- */
(function preventIOSBadGestures() {
  document.addEventListener("contextmenu", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gesturechange", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gestureend", (e) => e.preventDefault(), { passive: false });

  // double-tap zoom blocker
  let lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) e.preventDefault();
      lastTouchEnd = now;
    },
    { passive: false }
  );
})();

/* -------------------- helpers -------------------- */
const $ = (id) => document.getElementById(id);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fmtTime(sec) {
  sec = Math.max(0, sec | 0);
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function unique(arr) {
  return [...new Set(arr)];
}

/* -------------------- roles & camps -------------------- */
const ROLE = {
  WOLF: "狼人",
  SEER: "預言家",
  WITCH: "女巫",
  HUNTER: "獵人",
  GUARD: "守衛",
  IDIOT: "白痴",
  CUPID: "邱比特",
  ROBBER: "盜賊", // 你用「盜賊」
  VILLAGER: "平民",
};

function campOf(roleName) {
  return roleName === ROLE.WOLF ? "狼人" : "好人";
}

/* -------------------- boards -------------------- */
const BOARDS = [
  {
    id: "official-12",
    title: "12 人官方標準局",
    n: 12,
    wolves: 4,
    extras: 0,
    tags: ["官方", "穩", "含白痴"],
    roles: [
      ROLE.WOLF, ROLE.WOLF, ROLE.WOLF, ROLE.WOLF,
      ROLE.SEER, ROLE.WITCH, ROLE.HUNTER, ROLE.GUARD, ROLE.IDIOT,
      ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER,
    ],
  },
  {
    id: "12-edge-nopolice",
    title: "12 人（屠邊・無上警）",
    n: 12,
    wolves: 4,
    extras: 0,
    tags: ["測試", "無上警"],
    roles: [
      ROLE.WOLF, ROLE.WOLF, ROLE.WOLF, ROLE.WOLF,
      ROLE.SEER, ROLE.WITCH, ROLE.HUNTER, ROLE.GUARD, ROLE.IDIOT,
      ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER,
    ],
    defaultPolice: false,
  },
  {
    id: "12-city",
    title: "12 人（標準角色・屠城）",
    n: 12,
    wolves: 4,
    extras: 0,
    tags: ["測試", "屠城"],
    roles: [
      ROLE.WOLF, ROLE.WOLF, ROLE.WOLF, ROLE.WOLF,
      ROLE.SEER, ROLE.WITCH, ROLE.HUNTER, ROLE.GUARD, ROLE.IDIOT,
      ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER,
    ],
    defaultWinMode: "city",
  },
  {
    id: "12-thief",
    title: "12 人含盜賊（+2 底牌）",
    n: 12,
    wolves: 4,
    extras: 2, // ✅ 底牌2張
    tags: ["盜賊", "變體"],
    // ✅ 這裡 roles 是「整副牌」= 12+2 = 14 張
    // ✅ 狼固定 4，絕不會變成 5
    roles: [
      ROLE.WOLF, ROLE.WOLF, ROLE.WOLF, ROLE.WOLF,
      ROLE.SEER, ROLE.WITCH, ROLE.HUNTER, ROLE.GUARD, ROLE.IDIOT,
      ROLE.ROBBER,
      ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER, ROLE.VILLAGER,
    ],
  },
];

/* -------------------- storage -------------------- */
const LS_KEY = "ww_god_helper_v1";

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function saveState(st) {
  localStorage.setItem(LS_KEY, JSON.stringify(st));
}

/* -------------------- state -------------------- */
const defaultState = () => ({
  stage: "SETUP", // SETUP | DEAL | THIEF_PICK | NIGHT | DAY
  step: 0,
  day: 1,
  night: 1,
  n: 12,
  boardId: null,
  winMode: "edge", // edge/city
  hasPolice: true,

  selectedSeat: null,
  godEye: false,

  // seats: { [1..n]: { alive, role, seen, revealed, marks:[] } }
  seats: {},
  bottomCards: [], // for thief (+2 cards)
  thiefSeat: null,
  thiefResolved: true,

  // night actions
  actions: {
    guard: null,
    wolf: null,
    seer: null,
    witchSave: false,
    witchPoison: null,
    witchHasSave: true,
    witchHasPoison: true,
  },

  // logs
  ann: [], // strings
});

/* -------------------- UI refs -------------------- */
const ui = {
  uiStatus: $("uiStatus"),
  uiBoard: $("uiBoard"),

  btnAnn: $("btnAnn"),
  btnTimer: $("btnTimer"),
  btnEye: $("btnEye"),
  btnDice: $("btnDice"),
  btnSettings: $("btnSettings"),

  promptTitle: $("promptTitle"),
  promptText: $("promptText"),
  promptFoot: $("promptFoot"),

  setupCard: $("setupCard"),
  boardList: $("boardList"),

  seatsGrid: $("seatsGrid"),

  btnBack: $("btnBack"),
  btnMain: $("btnMain"),
  btnNext: $("btnNext"),

  // drawers
  timerBackdrop: $("timerBackdrop"),
  timerDrawer: $("timerDrawer"),
  btnCloseTimer: $("btnCloseTimer"),
  timerBig: $("timerBig"),
  timerPresets: $("timerPresets"),
  btnTimerStart: $("btnTimerStart"),
  btnTimerPause: $("btnTimerPause"),
  btnTimerReset: $("btnTimerReset"),

  annBackdrop: $("annBackdrop"),
  annDrawer: $("annDrawer"),
  btnCloseAnn: $("btnCloseAnn"),
  annText: $("annText"),
  toggleAnnGod: $("toggleAnnGod"),

  setBackdrop: $("setBackdrop"),
  setDrawer: $("setDrawer"),
  btnCloseSet: $("btnCloseSet"),
  segEdge: $("segEdge"),
  segCity: $("segCity"),
  togglePolice: $("togglePolice"),
  btnGotoSetup: $("btnGotoSetup"),
  btnHardReset: $("btnHardReset"),

  // role modal
  roleModal: $("roleModal"),
  roleModalTitle: $("roleModalTitle"),
  roleModalRole: $("roleModalRole"),
  roleModalCamp: $("roleModalCamp"),
  btnRoleDone: $("btnRoleDone"),
  btnRoleClose: $("btnRoleClose"),

  // dice modal
  diceModal: $("diceModal"),
  diceResult: $("diceResult"),
  btnDiceAgain: $("btnDiceAgain"),
  btnDiceClose: $("btnDiceClose"),

  // thief modal
  thiefModal: $("thiefModal"),
  thiefHint: $("thiefHint"),
  btnThiefA: $("btnThiefA"),
  btnThiefB: $("btnThiefB"),
  btnThiefClose: $("btnThiefClose"),
};

/* -------------------- timer -------------------- */
let timer = {
  total: 90,
  left: 90,
  running: false,
  t: null,
};

function setTimer(sec) {
  timer.total = sec;
  timer.left = sec;
  renderTimer();
  save();
}
function renderTimer() {
  ui.timerBig.textContent = fmtTime(timer.left);
}
function tickTimer() {
  if (!timer.running) return;
  timer.left -= 1;
  if (timer.left <= 0) {
    timer.left = 0;
    timer.running = false;
    try { navigator.vibrate?.([60, 60, 60]); } catch {}
  }
  renderTimer();
  save();
}

/* -------------------- global state instance -------------------- */
let S = loadState() || defaultState();

/* -------------------- derived -------------------- */
function getBoard() {
  return BOARDS.find((b) => b.id === S.boardId) || null;
}
function save() {
  saveState(S);
}

/* -------------------- setup & dealing -------------------- */
function resetForSetup(keepSettings = true) {
  const winMode = keepSettings ? S.winMode : "edge";
  const hasPolice = keepSettings ? S.hasPolice : true;
  S = defaultState();
  S.winMode = winMode;
  S.hasPolice = hasPolice;
  save();
  render();
}

function initSeats(n) {
  const seats = {};
  for (let i = 1; i <= n; i++) {
    seats[i] = {
      alive: true,
      role: null,
      camp: null,
      seen: false,
      revealed: false, // not used; keep
      marks: [], // e.g. ["💊","🧪","🛡️","🗡️"]
    };
  }
  return seats;
}

/**
 * Deal cards:
 * - For normal boards: deck size = n
 * - For thief board: deck size = n + 2 (bottomCards)
 */
function dealCards() {
  const board = getBoard();
  if (!board) return;

  const deck = shuffle(board.roles);
  const n = S.n;

  S.seats = initSeats(n);
  S.bottomCards = [];

  // assign first n to players
  for (let i = 1; i <= n; i++) {
    const role = deck[i - 1];
    S.seats[i].role = role;
    S.seats[i].camp = campOf(role);
    S.seats[i].seen = false;
    S.seats[i].marks = [];
  }

  // bottom cards (if any)
  const extra = board.extras || 0;
  if (extra > 0) {
    S.bottomCards = deck.slice(n, n + extra);
  }

  // thief seat?
  S.thiefSeat = null;
  S.thiefResolved = true;
  if (board.id.includes("thief")) {
    const thiefSeat = Object.keys(S.seats).map(Number).find((i) => S.seats[i].role === ROLE.ROBBER);
    if (thiefSeat) {
      S.thiefSeat = thiefSeat;
      S.thiefResolved = false;
    }
  }

  // witch initial potions
  S.actions = {
    guard: null,
    wolf: null,
    seer: null,
    witchSave: false,
    witchPoison: null,
    witchHasSave: true,
    witchHasPoison: true,
  };

  S.stage = "DEAL";
  S.step = 0;
  S.day = 1;
  S.night = 1;
  S.selectedSeat = null;

  S.ann = [];
  S.ann.push(`✅ 開局：${board.title}`);
  if (board.extras) S.ann.push(`🃏 本局含底牌：${board.extras} 張（僅盜賊可見）`);

  save();
}

/* -------------------- thief resolution -------------------- */
function mustThiefChooseWolf(cardA, cardB) {
  const aWolf = cardA === ROLE.WOLF;
  const bWolf = cardB === ROLE.WOLF;
  return (aWolf && !bWolf) || (!aWolf && bWolf);
}

function openThiefModal() {
  if (!S.thiefSeat || S.thiefResolved) return;
  if (!S.bottomCards || S.bottomCards.length !== 2) {
    // safety: if missing bottom cards, still resolve as "keep robber" (but should not happen)
    S.thiefResolved = true;
    save();
    return;
  }

  const [a, b] = S.bottomCards;

  // hint rules
  const forced = mustThiefChooseWolf(a, b);
  ui.thiefHint.textContent = forced
    ? "底牌含 1 張狼人：盜賊必須選狼人陣營。"
    : "請從底牌兩張中選一張成為你的角色（另一張棄用）。";

  ui.btnThiefA.textContent = a;
  ui.btnThiefB.textContent = b;

  ui.thiefModal.classList.remove("hidden");
  ui.thiefModal.setAttribute("aria-hidden", "false");
}

function closeThiefModal() {
  ui.thiefModal.classList.add("hidden");
  ui.thiefModal.setAttribute("aria-hidden", "true");
}

function resolveThiefPick(pickedRole) {
  const seat = S.thiefSeat;
  if (!seat) return;

  const [a, b] = S.bottomCards;
  const forced = mustThiefChooseWolf(a, b);
  if (forced && pickedRole !== ROLE.WOLF) {
    // force to wolf if needed
    pickedRole = ROLE.WOLF;
  }

  // ✅ REPLACE (not add):
  // - thief seat becomes pickedRole
  // - both bottom cards are discarded after pick
  // - robber card is discarded (no longer exists)
  const prev = S.seats[seat].role; // should be 盜賊
  S.seats[seat].role = pickedRole;
  S.seats[seat].camp = campOf(pickedRole);

  // discard bottom
  S.bottomCards = [];

  S.thiefResolved = true;
  S.stage = "DEAL"; // back to deal; user can continue
  S.ann.push(`🃏 盜賊結算：${seat} 號由「${prev}」改為「${pickedRole}」（另一張底牌棄用）`);

  save();
  closeThiefModal();
  render();
}

/* -------------------- role viewing (long press) -------------------- */
let pressTimer = null;

function bindSeatPress(el, seatNo) {
  // prevent text selection
  el.style.webkitUserSelect = "none";
  el.style.userSelect = "none";

  // tap select toggle
  el.addEventListener("click", (e) => {
    e.preventDefault();
    onSeatTap(seatNo);
  });

  // long press to view role (only in DEAL stage)
  el.addEventListener(
    "touchstart",
    (e) => {
      if (S.stage !== "DEAL") return;
      // must first select seat (god passes phone)
      if (S.selectedSeat !== seatNo) return;

      // block callout
      e.preventDefault();

      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        openRoleModal(seatNo);
      }, 300);
    },
    { passive: false }
  );

  el.addEventListener("touchend", () => clearTimeout(pressTimer), { passive: true });
  el.addEventListener("touchmove", () => clearTimeout(pressTimer), { passive: true });
}

/* -------------------- seat interactions -------------------- */
function onSeatTap(seatNo) {
  // toggle select
  if (S.selectedSeat === seatNo) {
    S.selectedSeat = null;
  } else {
    S.selectedSeat = seatNo;
  }
  save();
  renderSeats(); // quick update
}

/* -------------------- role modal -------------------- */
let currentRoleSeat = null;

function openRoleModal(seatNo) {
  const seat = S.seats[seatNo];
  if (!seat) return;

  currentRoleSeat = seatNo;

  ui.roleModalTitle.textContent = `${seatNo} 號 身分`;
  ui.roleModalRole.textContent = seat.role || "—";
  ui.roleModalCamp.textContent = `陣營：${seat.camp || "—"}`;

  ui.roleModal.classList.remove("hidden");
  ui.roleModal.setAttribute("aria-hidden", "false");
}

function closeRoleModal() {
  ui.roleModal.classList.add("hidden");
  ui.roleModal.setAttribute("aria-hidden", "true");
  currentRoleSeat = null;
}

/* -------------------- deal completion & start night -------------------- */
function countSeen() {
  return Object.values(S.seats).filter((x) => x.seen).length;
}
function allSeen() {
  return countSeen() >= S.n;
}

function afterAllSeenMaybeThief() {
  // ✅ once all seen -> if thief exists and not resolved -> open modal immediately
  if (allSeen() && S.thiefSeat && !S.thiefResolved) {
    S.stage = "THIEF_PICK";
    save();
    render();
    openThiefModal();
    return true;
  }
  return false;
}

/* -------------------- flow (night/day) -------------------- */
function rolesInGame() {
  return unique(Object.values(S.seats).map((s) => s.role).filter(Boolean));
}
function aliveSeats() {
  return Object.entries(S.seats)
    .filter(([, s]) => s.alive)
    .map(([k]) => Number(k));
}

function setPrompt(title, text, foot = "") {
  ui.promptTitle.textContent = title;
  ui.promptText.textContent = text;
  ui.promptFoot.textContent = foot;
}

function setTopStatus() {
  const board = getBoard();
  ui.uiBoard.textContent = board ? board.id : "—";
  if (S.stage === "SETUP") ui.uiStatus.textContent = `SETUP / step ${S.step + 1}`;
  if (S.stage === "DEAL") ui.uiStatus.textContent = `抽身分（${countSeen()}/${S.n}）`;
  if (S.stage === "THIEF_PICK") ui.uiStatus.textContent = `盜賊二選一`;
  if (S.stage === "NIGHT") ui.uiStatus.textContent = `🌙 NIGHT ${S.night} / step ${S.step + 1}`;
  if (S.stage === "DAY") ui.uiStatus.textContent = `☀️ DAY ${S.day}`;
}

function nightSequence() {
  const roles = rolesInGame();

  // 固定順序（你要求的第二天流程也符合這個順序）
  const seq = [];
  if (roles.includes(ROLE.GUARD)) seq.push("GUARD");
  seq.push("WOLVES"); // always
  if (roles.includes(ROLE.SEER)) seq.push("SEER");
  if (roles.includes(ROLE.WITCH)) seq.push("WITCH");
  return seq;
}

function renderPrompt() {
  const board = getBoard();

  if (S.stage === "SETUP") {
    setPrompt(
      "開局",
      "先選人數 → 再選板子（點一下會變色）→ 按底部「下一步」進入抽身分。",
      "（選完後，開局卡片會自動收起，避免佔畫面）"
    );
    ui.btnMain.textContent = "—";
    ui.btnMain.disabled = true;
    return;
  }

  if (S.stage === "DEAL") {
    const hasThief = !!S.thiefSeat;
    const thiefLine = hasThief ? "（含盜賊：全部看完後會立刻二選一）" : "";
    setPrompt(
      `抽身分`,
      `上帝先點選座位（可取消選取）→ 玩家長按 0.3 秒看身分 → 按「我看完了」\n看完會自動蓋牌（不會露出角色）\n全部看完後按「開始夜晚」進入夜晚流程\n${thiefLine}`,
      ""
    );

    ui.btnMain.textContent = allSeen() ? "開始夜晚" : "開始夜晚";
    ui.btnMain.disabled = !allSeen() || (S.thiefSeat && !S.thiefResolved);
    return;
  }

  if (S.stage === "THIEF_PICK") {
    setPrompt(
      "盜賊二選一",
      "盜賊已看完身分，請立刻從底牌兩張中二選一（依規則可能強制選狼人）。",
      ""
    );
    ui.btnMain.textContent = "開始夜晚";
    ui.btnMain.disabled = true; // must finish thief modal
    return;
  }

  if (S.stage === "NIGHT") {
    const seq = nightSequence();
    const cur = seq[S.step] || null;

    if (!cur) {
      // night finished
      setPrompt(
        `夜晚 ${S.night} 結束`,
        "按「天亮睜眼」進入白天公告結果。",
        ""
      );
      ui.btnMain.textContent = "天亮睜眼";
      ui.btnMain.disabled = false;
      return;
    }

    if (cur === "GUARD") {
      setPrompt(
        `夜晚 ${S.night}`,
        `1) 守衛請睜眼（選擇守護）\n👉 點座位選取；再點同號取消（空盾）\n按「下一步」確認`,
        `目前：守護 = ${S.actions.guard ?? "（未選/空盾）"}`
      );
      ui.btnMain.textContent = "天亮睜眼";
      ui.btnMain.disabled = true;
      return;
    }
    if (cur === "WOLVES") {
      setPrompt(
        `夜晚 ${S.night}`,
        `2) 狼人請睜眼（選擇刀人）\n👉 點座位選取；再點同號取消\n按「下一步」確認`,
        `目前：刀口 = ${S.actions.wolf ?? "（未選）"}`
      );
      ui.btnMain.textContent = "天亮睜眼";
      ui.btnMain.disabled = true;
      return;
    }
    if (cur === "SEER") {
      setPrompt(
        `夜晚 ${S.night}`,
        `3) 預言家請睜眼（查驗一人）\n👉 點座位選取；再點同號取消\n按「下一步」確認（會在公告記錄查驗結果）`,
        `目前：查驗 = ${S.actions.seer ?? "（未選）"}`
      );
      ui.btnMain.textContent = "天亮睜眼";
      ui.btnMain.disabled = true;
      return;
    }
    if (cur === "WITCH") {
      const wolf = S.actions.wolf;
      const saveHint = wolf ? `（狼刀 ${wolf}）` : "（尚未有刀口）";
      setPrompt(
        `夜晚 ${S.night}`,
        `4) 女巫請睜眼（解藥 / 毒藥）\n- 點「刀口」= 使用解藥救人（若解藥未用）\n- 點「其他人」= 使用毒藥（若毒藥未用）\n- 同晚解/毒只能擇一；再點同號可取消\n按「下一步」確認\n${saveHint}`,
        `解藥：${S.actions.witchHasSave ? (S.actions.witchSave ? "已使用" : "可用") : "已用完"} ｜毒藥：${S.actions.witchHasPoison ? (S.actions.witchPoison ? `毒 ${S.actions.witchPoison}` : "可用") : "已用完"}`
      );
      ui.btnMain.textContent = "天亮睜眼";
      ui.btnMain.disabled = true;
      return;
    }
  }

  if (S.stage === "DAY") {
    setPrompt(
      `白天 ${S.day}`,
      "天亮了，請宣告昨夜結果並進入發言、警長（若有）、推理、投票。\n按中間鍵「開始投票 / 天黑閉眼」可切換重要流程（你可手動帶流程）。",
      ""
    );
    ui.btnMain.textContent = "開始投票";
    ui.btnMain.disabled = false;
    return;
  }
}

/* -------------------- apply actions (night resolve) -------------------- */
function clearNightSelectionsOnly() {
  S.selectedSeat = null;
}

function resolveNight() {
  // compute deaths based on actions
  const wolfTarget = S.actions.wolf; // number or null
  const guardTarget = S.actions.guard; // number or null
  const saved = S.actions.witchSave;
  const poisonTarget = S.actions.witchPoison;

  const deaths = [];
  const detail = [];

  // wolf kill
  if (wolfTarget) {
    if (guardTarget && guardTarget === wolfTarget) {
      detail.push(`🛡️ 守衛守到 ${wolfTarget}（擋刀）`);
    } else if (saved) {
      detail.push(`💊 女巫解藥救 ${wolfTarget}`);
      // mark on seat
      S.seats[wolfTarget].marks = unique([...S.seats[wolfTarget].marks, "💊"]);
    } else {
      deaths.push({ seat: wolfTarget, reason: "🗡️ 狼刀" });
      S.seats[wolfTarget].marks = unique([...S.seats[wolfTarget].marks, "🗡️"]);
    }
  } else {
    detail.push("🗡️ 狼人未刀人");
  }

  // poison
  if (poisonTarget) {
    deaths.push({ seat: poisonTarget, reason: "🧪 毒死" });
    S.seats[poisonTarget].marks = unique([...S.seats[poisonTarget].marks, "🧪"]);
  }

  // apply deaths (avoid double)
  const killedSeats = unique(deaths.map((d) => d.seat));
  killedSeats.forEach((k) => {
    if (S.seats[k]) S.seats[k].alive = false;
  });

  // announce string
  let publicLine = "";
  if (killedSeats.length === 0) publicLine = "昨夜結果：平安夜";
  else publicLine = `昨夜死亡：${killedSeats.join("、")} 號`;

  const godDetail = deaths.map((d) => `${d.seat}（${d.reason}）`).join("、");
  const seerLine = S.actions.seer
    ? `🔮 預言家查驗 ${S.actions.seer}：${campOf(S.seats[S.actions.seer].role)}`
    : "";

  // log
  S.ann.push(`🌙 NIGHT ${S.night} → ☀️ DAY ${S.day}: ${publicLine}`);
  if (detail.length) S.ann.push(detail.map((x) => `  - ${x}`).join("\n"));
  if (seerLine) S.ann.push(seerLine);
  if (godDetail) S.ann.push(`（上帝細節）${godDetail}`);

  // reset nightly selections for next night (keep potion availability)
  S.actions.guard = null;
  S.actions.wolf = null;
  S.actions.seer = null;
  S.actions.witchSave = false;
  S.actions.witchPoison = null;

  S.day += 1;
  S.night += 1;

  save();
}

/* -------------------- buttons: Back/Main/Next -------------------- */
function goNext() {
  if (S.stage === "SETUP") {
    // must have board selected
    if (!S.boardId) return;
    dealCards();
    // after deal -> hide setup card by stage
    save();
    render();
    return;
  }

  if (S.stage === "DEAL") {
    // next used as "進入遊戲" same as main? Keep simple: Next = no-op
    return;
  }

  if (S.stage === "THIEF_PICK") {
    return;
  }

  if (S.stage === "NIGHT") {
    const seq = nightSequence();
    const cur = seq[S.step];
    if (!cur) return;

    // confirm current step selection and advance
    if (cur === "GUARD") {
      // allow null (empty guard)
      S.actions.guard = S.selectedSeat ?? null;
      clearNightSelectionsOnly();
      S.step += 1;
      save();
      render();
      return;
    }
    if (cur === "WOLVES") {
      S.actions.wolf = S.selectedSeat ?? null;
      clearNightSelectionsOnly();
      S.step += 1;
      save();
      render();
      return;
    }
    if (cur === "SEER") {
      S.actions.seer = S.selectedSeat ?? null;
      if (S.actions.seer) {
        const camp = campOf(S.seats[S.actions.seer].role);
        S.ann.push(`🔮 查驗：${S.actions.seer} 是 ${camp}`);
      }
      clearNightSelectionsOnly();
      S.step += 1;
      save();
      render();
      return;
    }
    if (cur === "WITCH") {
      // witch selection handled by tap logic; just advance
      clearNightSelectionsOnly();
      S.step += 1;
      save();
      render();
      return;
    }
  }

  if (S.stage === "DAY") {
    // move to next night start
    S.stage = "NIGHT";
    S.step = 0;
    S.selectedSeat = null;
    save();
    render();
    return;
  }
}

function goBack() {
  if (S.stage === "SETUP") return;

  if (S.stage === "DEAL") {
    // back to setup
    S.stage = "SETUP";
    S.step = 0;
    save();
    render();
    return;
  }

  if (S.stage === "NIGHT") {
    S.step = Math.max(0, S.step - 1);
    S.selectedSeat = null;
    save();
    render();
    return;
  }

  if (S.stage === "DAY") {
    // back to night end screen (not strict)
    S.stage = "NIGHT";
    S.step = Math.max(0, nightSequence().length); // end
    save();
    render();
    return;
  }
}

function onMain() {
  if (S.stage === "DEAL") {
    // ✅ All seen? If thief unresolved, open modal. Else start night.
    if (!allSeen()) return;

    if (afterAllSeenMaybeThief()) return;

    // start night 1
    S.stage = "NIGHT";
    S.step = 0;
    S.selectedSeat = null;

    // (important) ensure all cards are covered after seen
    Object.values(S.seats).forEach((s) => (s.revealed = false));

    save();
    render();
    return;
  }

  if (S.stage === "NIGHT") {
    // if night steps finished -> resolve and go day
    const seq = nightSequence();
    if (S.step >= seq.length) {
      resolveNight();
      S.stage = "DAY";
      S.selectedSeat = null;
      save();
      render();
      return;
    }

    // during night: main is disabled by renderPrompt
    return;
  }

  if (S.stage === "DAY") {
    // toggle important flow text only
    // we let Next handle to night, but main can be used for "開始投票" label only
    S.ann.push(`📣 白天流程：開始投票（手動統計票型，可用公告回顧）`);
    save();
    openAnnDrawer();
    return;
  }
}

/* -------------------- witch selection rules -------------------- */
function handleWitchTap(seatNo) {
  // during WITCH step:
  // - tap wolfTarget => save (if has save)
  // - tap other => poison (if has poison)
  // - same seat again toggles off
  const wolfTarget = S.actions.wolf;

  // toggle off if same as existing poison
  if (S.actions.witchPoison === seatNo) {
    S.actions.witchPoison = null;
    save();
    render();
    return;
  }

  // tap wolf target => save toggle
  if (wolfTarget && seatNo === wolfTarget) {
    if (!S.actions.witchHasSave) return;

    // if already saved => cancel
    if (S.actions.witchSave) {
      S.actions.witchSave = false;
      save();
      render();
      return;
    }

    // choose save => cancel poison
    S.actions.witchSave = true;
    S.actions.witchPoison = null;
    S.actions.witchHasSave = false; // consume
    save();
    render();
    return;
  }

  // poison
  if (!S.actions.witchHasPoison) return;

  // choosing poison cancels save
  if (S.actions.witchSave) {
    S.actions.witchSave = false;
  }

  S.actions.witchPoison = seatNo;
  S.actions.witchHasPoison = false; // consume
  save();
  render();
}

/* -------------------- render seats -------------------- */
function seatCardText(i) {
  const seat = S.seats[i];
  if (!seat) return "";

  // Setup stage: no seats shown (but HTML always has grid); we will show blank
  if (S.stage === "SETUP") return "";

  // Deal stage: always covered
  if (S.stage === "DEAL" || S.stage === "THIEF_PICK") {
    return seat.seen ? "（已看）" : "長按看身分";
  }

  // In game stages: if godEye show role/camp; else show alive/dead only
  if (!S.godEye) {
    return seat.alive ? "存活" : "死亡";
  }

  // god eye on
  const marks = (seat.marks && seat.marks.length) ? ` ${seat.marks.join("")}` : "";
  const life = seat.alive ? "" : "（死）";
  return `${seat.role}・${seat.camp}${life}${marks}`;
}

function renderSeats() {
  const n = S.n || 12;

  // grid
  ui.seatsGrid.innerHTML = "";
  ui.seatsGrid.style.pointerEvents = "auto";

  for (let i = 1; i <= n; i++) {
    const seat = S.seats[i] || { alive: true };
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "seat";

    const isSelected = S.selectedSeat === i;
    if (isSelected) btn.classList.add("selected");
    if (!seat.alive) btn.classList.add("dead");
    if (S.godEye) {
      if (seat.role === ROLE.WOLF) btn.classList.add("wolf");
      else btn.classList.add("good");
    }

    // Witch step highlight logic
    if (S.stage === "NIGHT") {
      const seq = nightSequence();
      const cur = seq[S.step];
      if (cur === "WITCH") {
        const wolfTarget = S.actions.wolf;
        if (wolfTarget && i === wolfTarget && S.actions.witchHasSave) btn.classList.add("hintSave");
        if (S.actions.witchPoison === i) btn.classList.add("hintPoison");
      }
    }

    btn.innerHTML = `
      <div class="seatNo">${i}</div>
      <div class="seatInfo">${seatCardText(i)}</div>
    `;

    // bind
    bindSeatPress(btn, i);

    ui.seatsGrid.appendChild(btn);
  }
}

/* -------------------- board list render -------------------- */
function renderBoards() {
  ui.boardList.innerHTML = "";

  const n = S.n;
  const items = BOARDS.filter((b) => b.n === n);

  items.forEach((b) => {
    const div = document.createElement("div");
    div.className = "boardItem";
    if (S.boardId === b.id) div.classList.add("selected");

    const roleSummary = summarizeBoard(b);

    div.innerHTML = `
      <div class="boardTitle">${b.title}</div>
      <div class="boardSub">${b.id} ・ ${roleSummary}</div>
      <div class="boardTags">
        ${(b.tags || []).map((t) => `<span class="tag">${t}</span>`).join("")}
      </div>
    `;

    div.addEventListener("click", () => {
      S.boardId = b.id;
      // defaults
      if (typeof b.defaultPolice === "boolean") S.hasPolice = b.defaultPolice;
      if (b.defaultWinMode) S.winMode = b.defaultWinMode;
      save();
      renderBoards();
      renderPrompt();
      setTopStatus();
    });

    ui.boardList.appendChild(div);
  });

  if (items.length === 0) {
    const p = document.createElement("div");
    p.className = "hint";
    p.textContent = "此人數尚無板子（請先選 9 / 10 / 12）。";
    ui.boardList.appendChild(p);
  }
}

function summarizeBoard(b) {
  const counts = {};
  b.roles.forEach((r) => (counts[r] = (counts[r] || 0) + 1));

  // pretty order
  const order = [
    ROLE.WOLF,
    ROLE.SEER,
    ROLE.WITCH,
    ROLE.HUNTER,
    ROLE.GUARD,
    ROLE.IDIOT,
    ROLE.CUPID,
    ROLE.ROBBER,
    ROLE.VILLAGER,
  ];

  const parts = [];
  order.forEach((r) => {
    if (counts[r]) parts.push(`${counts[r]}${r === ROLE.WOLF ? "狼" : r === ROLE.VILLAGER ? "民" : r}`);
  });

  if (b.extras) parts.push(`+底牌${b.extras}`);

  return parts.join(" + ");
}

/* -------------------- drawers -------------------- */
function openDrawer(backdrop, drawer) {
  backdrop.classList.remove("hidden");
  drawer.classList.remove("hidden");
  drawer.setAttribute("aria-hidden", "false");
}
function closeDrawer(backdrop, drawer) {
  backdrop.classList.add("hidden");
  drawer.classList.add("hidden");
  drawer.setAttribute("aria-hidden", "true");
}

function openTimerDrawer() {
  openDrawer(ui.timerBackdrop, ui.timerDrawer);
}
function openAnnDrawer() {
  ui.annText.textContent = buildAnnText(ui.toggleAnnGod.checked);
  openDrawer(ui.annBackdrop, ui.annDrawer);
}
function openSetDrawer() {
  // set UI state
  ui.togglePolice.checked = !!S.hasPolice;
  ui.segEdge.classList.toggle("primary", S.winMode === "edge");
  ui.segCity.classList.toggle("primary", S.winMode === "city");
  openDrawer(ui.setBackdrop, ui.setDrawer);
}

function buildAnnText(showGodDetail) {
  // If toggle off: remove lines starting with (上帝細節)
  const out = [];
  for (const line of S.ann) {
    if (!showGodDetail && String(line).includes("（上帝細節）")) continue;
    out.push(line);
  }
  return out.join("\n\n");
}

/* -------------------- dice -------------------- */
function openDiceModal() {
  ui.diceModal.classList.remove("hidden");
  ui.diceModal.setAttribute("aria-hidden", "false");
  rollDice();
}
function closeDiceModal() {
  ui.diceModal.classList.add("hidden");
  ui.diceModal.setAttribute("aria-hidden", "true");
}
function rollDice() {
  const alive = aliveSeats();
  if (alive.length === 0) {
    ui.diceResult.textContent = "—";
    return;
  }
  const pick = alive[randInt(0, alive.length - 1)];
  ui.diceResult.textContent = `${pick} 號`;
}

/* -------------------- render root -------------------- */
function render() {
  setTopStatus();

  // show/hide setup card
  ui.setupCard.style.display = S.stage === "SETUP" ? "block" : "none";

  // always render boards in setup
  if (S.stage === "SETUP") renderBoards();

  renderPrompt();
  renderSeats();

  // buttons
  ui.btnBack.disabled = false;
  ui.btnNext.disabled = false;

  // main button label already set by renderPrompt; keep fallback
  if (S.stage === "SETUP") {
    ui.btnBack.textContent = "上一步";
    ui.btnNext.textContent = "下一步";
    ui.btnMain.textContent = "—";
  } else if (S.stage === "DEAL") {
    ui.btnBack.textContent = "上一步";
    ui.btnNext.textContent = "下一步";
  } else if (S.stage === "NIGHT") {
    ui.btnBack.textContent = "上一步";
    ui.btnNext.textContent = "下一步";
  } else if (S.stage === "DAY") {
    ui.btnBack.textContent = "上一步";
    ui.btnNext.textContent = "下一步";
  }

  // ensure thief modal if needed
  if (S.stage === "THIEF_PICK") {
    openThiefModal();
  }
}

/* -------------------- events wiring -------------------- */
function wire() {
  // top buttons
  ui.btnTimer.addEventListener("click", openTimerDrawer);
  ui.btnAnn.addEventListener("click", openAnnDrawer);
  ui.btnSettings.addEventListener("click", openSetDrawer);

  ui.btnEye.addEventListener("click", () => {
    S.godEye = !S.godEye;
    save();
    renderSeats();
  });

  ui.btnDice.addEventListener("click", openDiceModal);

  // bottom buttons
  ui.btnBack.addEventListener("click", goBack);
  ui.btnNext.addEventListener("click", goNext);
  ui.btnMain.addEventListener("click", onMain);

  // timer drawer
  ui.btnCloseTimer.addEventListener("click", () => closeDrawer(ui.timerBackdrop, ui.timerDrawer));
  ui.timerBackdrop.addEventListener("click", () => closeDrawer(ui.timerBackdrop, ui.timerDrawer));
  ui.timerPresets.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-sec]");
    if (!btn) return;
    setTimer(Number(btn.dataset.sec));
  });
  ui.btnTimerStart.addEventListener("click", () => {
    if (timer.running) return;
    timer.running = true;
    if (!timer.t) timer.t = setInterval(tickTimer, 1000);
    save();
  });
  ui.btnTimerPause.addEventListener("click", () => {
    timer.running = false;
    save();
  });
  ui.btnTimerReset.addEventListener("click", () => {
    timer.running = false;
    timer.left = timer.total;
    renderTimer();
    save();
  });

  // announce drawer
  ui.btnCloseAnn.addEventListener("click", () => closeDrawer(ui.annBackdrop, ui.annDrawer));
  ui.annBackdrop.addEventListener("click", () => closeDrawer(ui.annBackdrop, ui.annDrawer));
  ui.toggleAnnGod.addEventListener("change", () => {
    ui.annText.textContent = buildAnnText(ui.toggleAnnGod.checked);
  });

  // settings drawer
  ui.btnCloseSet.addEventListener("click", () => closeDrawer(ui.setBackdrop, ui.setDrawer));
  ui.setBackdrop.addEventListener("click", () => closeDrawer(ui.setBackdrop, ui.setDrawer));

  ui.segEdge.addEventListener("click", () => {
    S.winMode = "edge";
    save();
    ui.segEdge.classList.add("primary");
    ui.segCity.classList.remove("primary");
  });
  ui.segCity.addEventListener("click", () => {
    S.winMode = "city";
    save();
    ui.segCity.classList.add("primary");
    ui.segEdge.classList.remove("primary");
  });
  ui.togglePolice.addEventListener("change", (e) => {
    S.hasPolice = !!e.target.checked;
    save();
  });
  ui.btnGotoSetup.addEventListener("click", () => {
    // go back to setup but keep winMode/police
    const keepWin = S.winMode;
    const keepPolice = S.hasPolice;
    resetForSetup(true);
    S.winMode = keepWin;
    S.hasPolice = keepPolice;
    save();
    closeDrawer(ui.setBackdrop, ui.setDrawer);
    render();
  });
  ui.btnHardReset.addEventListener("click", () => {
    localStorage.removeItem(LS_KEY);
    S = defaultState();
    save();
    closeDrawer(ui.setBackdrop, ui.setDrawer);
    render();
  });

  // role modal
  ui.btnRoleClose.addEventListener("click", closeRoleModal);
  ui.btnRoleDone.addEventListener("click", () => {
    if (!currentRoleSeat) return;

    // mark seen
    S.seats[currentRoleSeat].seen = true;

    // ✅ auto-cover (do not reveal on grid)
    S.selectedSeat = null;

    // log
    // (don’t log private role)
    save();
    closeRoleModal();

    // after closing: if all seen -> if thief exists -> open thief modal now
    if (afterAllSeenMaybeThief()) return;

    render();
  });

  // dice modal
  ui.btnDiceClose.addEventListener("click", closeDiceModal);
  ui.btnDiceAgain.addEventListener("click", rollDice);

  // thief modal
  ui.btnThiefClose.addEventListener("click", () => {
    // cannot close until resolved (avoid stuck)
    // keep it open
  });

  ui.btnThiefA.addEventListener("click", () => resolveThiefPick(ui.btnThiefA.textContent));
  ui.btnThiefB.addEventListener("click", () => resolveThiefPick(ui.btnThiefB.textContent));

  // setup: people count chips inside setupCard
  ui.setupCard.addEventListener("click", (e) => {
    const btn = e.target.closest("button.chip[data-n]");
    if (!btn) return;
    const n = Number(btn.dataset.n);
    S.n = n;
    // reset board selection when n changes
    S.boardId = null;
    save();
    renderBoards();
    renderPrompt();
    setTopStatus();
  });

  // special: during night witch step use seat tap differently
  ui.seatsGrid.addEventListener("click", (e) => {
    if (S.stage !== "NIGHT") return;
    const seq = nightSequence();
    const cur = seq[S.step];
    if (cur !== "WITCH") return;

    const seatBtn = e.target.closest("button.seat");
    if (!seatBtn) return;

    const no = Number(seatBtn.querySelector(".seatNo")?.textContent);
    if (!no) return;

    // witch uses tap to decide save/poison
    handleWitchTap(no);
  });
}

/* -------------------- stage-specific seat tap override (night) -------------------- */
const _origOnSeatTap = onSeatTap;
function onSeatTap(seatNo) {
  if (S.stage === "NIGHT") {
    const seq = nightSequence();
    const cur = seq[S.step];
    if (cur === "WITCH") {
      // handled in grid listener, ignore here
      return;
    }
  }
  _origOnSeatTap(seatNo);
}

/* -------------------- start: ensure setup stage if missing board -------------------- */
function boot() {
  wire();

  // init timer view
  if (!timer.total) timer.total = 90;
  timer.left = clamp(timer.left || 90, 0, 60 * 60);
  renderTimer();
  if (!timer.t) timer.t = setInterval(tickTimer, 1000);

  // If state inconsistent, repair
  if (!S.n) S.n = 12;
  if (!S.seats || Object.keys(S.seats).length === 0) {
    S.seats = initSeats(S.n);
  }

  // If stage not setup but board missing -> back to setup
  if (S.stage !== "SETUP" && !S.boardId) {
    S.stage = "SETUP";
    S.step = 0;
    save();
  }

  // Ensure boards list present in setup
  render();
}

boot();