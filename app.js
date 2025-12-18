/* =========================
   Werewolf MVP (Single Device, GitHub Pages)
   v7 - Full Cover
   - Idiot: exiled by vote => NOT die, lose voting right forever (revealed)
   - Hunter: exiled by vote => prompt shoot? then pick target, resolve death
   - Voting order excludes players without voting right (canVote=false)
   - God view expanded shows role + camp badge on EVERY seat (alive/dead)
   - Win check: wolves==0 => good win (priority)
              city: wolves >= goods => wolf win
              edge: gods==0 OR villagers==0 => wolf win
   ========================= */

const STORAGE_KEY = "werewolf_mvp_state_v7";

/* ---------- Role specs ---------- */
const ROLE_LABELS = {
  wolf: { name: "狼人", camp: "wolf", isGod: false },
  seer: { name: "預言家", camp: "good", isGod: true },
  witch: { name: "女巫", camp: "good", isGod: true },
  hunter: { name: "獵人", camp: "good", isGod: true },
  idiot: { name: "白癡", camp: "good", isGod: true },
  villager: { name: "平民", camp: "good", isGod: false },
};

/* ---------- Board fallback ---------- */
const BOARD_FALLBACK = {
  9: {
    id: "official-9",
    title: "9 人官方標準局",
    playersCount: 9,
    hasPolice: false,
    winCondition: { mode: "city" },
    witchCanSelfSave: false,
    roles: [
      { roleId: "wolf", count: 3 },
      { roleId: "seer", count: 1 },
      { roleId: "witch", count: 1 },
      { roleId: "hunter", count: 1 },
      { roleId: "villager", count: 3 },
    ],
    nightSteps: [
      { id: "wolf", name: "狼人", wakeOrder: 1, alwaysShow: true, actionType: "pick", seatPickRule: { allowNone: true } },
      { id: "seer", name: "預言家", wakeOrder: 2, alwaysShow: true, actionType: "pick" },
      { id: "witch", name: "女巫", wakeOrder: 3, alwaysShow: true, actionType: "pick" },
    ],
  },
  10: {
    id: "official-10",
    title: "10 人官方標準局",
    playersCount: 10,
    hasPolice: false,
    winCondition: { mode: "city" },
    witchCanSelfSave: false,
    roles: [
      { roleId: "wolf", count: 3 },
      { roleId: "seer", count: 1 },
      { roleId: "witch", count: 1 },
      { roleId: "hunter", count: 1 },
      { roleId: "villager", count: 4 },
    ],
    nightSteps: [
      { id: "wolf", name: "狼人", wakeOrder: 1, alwaysShow: true, actionType: "pick", seatPickRule: { allowNone: true } },
      { id: "seer", name: "預言家", wakeOrder: 2, alwaysShow: true, actionType: "pick" },
      { id: "witch", name: "女巫", wakeOrder: 3, alwaysShow: true, actionType: "pick" },
    ],
  },
  12: {
    id: "official-12",
    title: "12 人官方標準局",
    playersCount: 12,
    hasPolice: true,
    winCondition: { mode: "edge" },
    witchCanSelfSave: false,
    roles: [
      { roleId: "wolf", count: 4 },
      { roleId: "seer", count: 1 },
      { roleId: "witch", count: 1 },
      { roleId: "hunter", count: 1 },
      { roleId: "idiot", count: 1 },
      { roleId: "villager", count: 4 },
    ],
    nightSteps: [
      { id: "wolf", name: "狼人", wakeOrder: 1, alwaysShow: true, actionType: "pick", seatPickRule: { allowNone: true } },
      { id: "seer", name: "預言家", wakeOrder: 2, alwaysShow: true, actionType: "pick" },
      { id: "witch", name: "女巫", wakeOrder: 3, alwaysShow: true, actionType: "pick" },
    ],
  },
};

/* ---------- DOM refs ---------- */
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

/* ---------- iOS anti-zoom/callout ---------- */
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
document.addEventListener("contextmenu", (e) => e.preventDefault());

/* ---------- State ---------- */
let state = loadState() ?? makeInitialState();
let timerTick = null;

/* =========================
   Button Handlers
   ========================= */
btnPrimary.addEventListener("click", () => {
  const step = state.flow.stepId;

  if (state.flow.phase === "END") return;

  // SETUP
  if (state.flow.phase === "SETUP" && step === "SETUP:A1") {
    if (!state.config.playersCount) return toast("請先選人數");
    goStep("SETUP:A2");
    return;
  }
  if (state.flow.phase === "SETUP" && step === "SETUP:A2") {
    goStep("SETUP:A3");
    if (!state.setup.rolesAssigned) assignRolesForSetup();
    return;
  }
  if (state.flow.phase === "SETUP" && step === "SETUP:A3") {
    if (!allSeatsSeen()) return toast("還有人沒看身分喔～");
    enterNight();
    return;
  }

  // NIGHT
  if (state.flow.phase === "NIGHT") {
    const n = getCurrentNightStep();
    if (!n) return;

    if (n.kind === "N0") return nextNightStep();

    if (n.kind === "STEP") {
      if (n.stepId === "wolf") {
        commitWolf();
        return nextNightStep();
      }
      if (n.stepId === "seer") {
        if (!state.flow.pending?.seerCheck) return toast("預言家要選一位查驗喔");
        commitSeer();
        return nextNightStep();
      }
      if (n.stepId === "witch") {
        commitWitch();
        return nextNightStep();
      }
    }

    if (n.kind === "RESOLVE") {
      resolveNight();
      if (state.flow.phase === "END") return;
      return nextNightStep();
    }

    if (n.kind === "ANNOUNCE") {
      if (checkWinAndEnd()) return;
      return enterDay();
    }
  }

  // DAY (including after-exile hunter steps)
  if (state.flow.phase === "DAY") {
    if (step === "DAY:D1") {
      startMainVote();
      return;
    }

    if (step === "DAY:VOTE:CAST") return commitCurrentVoteAndAdvance("MAIN");
    if (step === "DAY:VOTE:RESULT") return processVoteResultAndAdvance("MAIN");

    if (step === "DAY:PK:CAST") return commitCurrentVoteAndAdvance("PK");
    if (step === "DAY:PK:RESULT") return processVoteResultAndAdvance("PK");

    if (step === "DAY:AFTER_EXILE:HUNTER_PROMPT") {
      // primary = 開槍
      return goHunterPick();
    }
    if (step === "DAY:AFTER_EXILE:HUNTER_PICK") {
      if (!state.day.afterExile?.target) return toast("請先選擇要射擊的座位");
      confirmHunterShot();
      return;
    }
  }
});

// Cancel behavior
btnCancel.addEventListener("click", () => {
  const step = state.flow.stepId;

  if (state.flow.phase === "END") return;

  if (step === "SETUP:A3") {
    state.ui.revealingSeat = null;
    return saveAndRender();
  }

  if (state.flow.phase === "NIGHT") {
    state.flow.pending = null;
    toast("已取消本步驟選擇");
    return saveAndRender();
  }

  // Hunter prompt: cancel = 不開槍
  if (state.flow.phase === "DAY" && step === "DAY:AFTER_EXILE:HUNTER_PROMPT") {
    toast("獵人選擇不開槍");
    finalizeAfterExileAndNext();
    return;
  }

  // Hunter pick: cancel just clears target
  if (state.flow.phase === "DAY" && step === "DAY:AFTER_EXILE:HUNTER_PICK") {
    state.day.afterExile.target = null;
    toast("已取消射擊目標");
    saveAndRender(false);
    return;
  }

  // Day voting cast: cancel = abstain
  if (state.flow.phase === "DAY" && (step === "DAY:VOTE:CAST" || step === "DAY:PK:CAST")) {
    state.day.pending = { target: null };
    toast("本票棄票（0票）");
    return commitCurrentVoteAndAdvance(step === "DAY:VOTE:CAST" ? "MAIN" : "PK");
  }
});

// Back button MVP
btnBack.addEventListener("click", () => {
  toast("MVP 暫不支援上一步（避免卡住）");
});

/* ===== Settings drawer ===== */
btnSettings.addEventListener("click", openDrawer);
btnCloseDrawer?.addEventListener("click", closeDrawer);
drawerBackdrop?.addEventListener("click", closeDrawer);

toggleGodView?.addEventListener("change", () => {
  state.ui.godExpanded = !!toggleGodView.checked;
  saveAndRender(false);
});

segEdge?.addEventListener("click", () => setWinMode("edge"));
segCity?.addEventListener("click", () => setWinMode("city"));

togglePolice?.addEventListener("change", () => {
  if (!isSetupPhase()) return;
  if (!state.board) return;
  state.board.hasPolice = !!togglePolice.checked;
  saveAndRender();
});

btnReset?.addEventListener("click", () => {
  if (!confirm("確定要重置本局？（會清除存檔）")) return;
  stopTimer(true);
  localStorage.removeItem(STORAGE_KEY);
  state = makeInitialState();
  render();
});

/* ===== Timer drawer ===== */
btnTimer?.addEventListener("click", openTimer);
btnCloseTimer?.addEventListener("click", closeTimer);
timerBackdrop?.addEventListener("click", closeTimer);

timerPresets?.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-sec]");
  if (!btn) return;
  const sec = Number(btn.dataset.sec);
  setTimer(sec * 1000);
  startTimer();
});
btnTimerStart?.addEventListener("click", () => startTimer());
btnTimerPause?.addEventListener("click", () => pauseTimer());
btnTimerReset?.addEventListener("click", () => resetTimer());

/* =========================
   State helpers
   ========================= */
function makeInitialState() {
  return {
    meta: { version: "mvp-1.7", createdAt: Date.now(), updatedAt: Date.now() },
    config: { playersCount: null },
    board: null,
    players: [],

    flow: { phase: "SETUP", round: 1, stepId: "SETUP:A1", stepIndex: 0, pending: null },

    setup: { rolesAssigned: false, seenSeats: [] },

    night: { round: 1, index: 0, order: [], logByRound: {} },
    witch: { usedAntidote: false, usedPoison: false },

    day: {
      round: 1,
      stage: "DISCUSS",
      voterOrder: [],
      voterIndex: 0,
      candidates: null,
      pending: null,
      voteLogByRound: {},
      afterExile: null, // ✅ Day6: hunter prompt / pick
    },

    ui: { godExpanded: false, revealingSeat: null },

    timer: { durationMs: 0, remainingMs: 0, running: false, lastTickAt: 0 },

    end: null,
  };
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
function saveAndRender(shouldSave = true) {
  if (shouldSave) saveState(state);
  render();
}
function isSetupPhase() {
  return state.flow.phase === "SETUP";
}

/* =========================
   Boards + players
   ========================= */
async function loadBoardByCount(count) {
  const urlMap = { 9: "./boards/official-9.json", 10: "./boards/official-10.json", 12: "./boards/official-12.json" };
  try {
    const url = urlMap[count];
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("fetch failed");
    return await res.json();
  } catch {
    return JSON.parse(JSON.stringify(BOARD_FALLBACK[count]));
  }
}

function initPlayers(count) {
  state.players = Array.from({ length: count }, (_, i) => ({
    seat: i + 1,
    name: `${i + 1}號`,
    alive: true,
    canVote: true, // ✅ 白癡被票後會變 false
    roleId: null,
    camp: null,
    markers: { idiotRevealed: false },
  }));
  state.setup.seenSeats = [];
  state.setup.rolesAssigned = false;
  state.ui.revealingSeat = null;
  state.day.afterExile = null;
  state.end = null;
}

function setPlayersCount(count) {
  state.config.playersCount = count;
  initPlayers(count);

  loadBoardByCount(count)
    .then((board) => {
      state.board = board;
      state.board.winCondition = state.board.winCondition || { mode: "city" };
      state.board.playersCount = count;
      state.board.witchCanSelfSave = !!state.board.witchCanSelfSave;
      syncDrawerUI();
      saveAndRender();
    })
    .catch((err) => {
      console.error(err);
      toast("讀取板子失敗（請檢查 boards/）");
    });
}

/* =========================
   Setup flow
   ========================= */
function goStep(stepId) {
  state.flow.stepId = stepId;
  state.flow.stepIndex += 1;
  saveAndRender();
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function assignRolesForSetup() {
  const board = state.board;
  if (!board) return;

  const roleList = [];
  for (const r of board.roles) for (let i = 0; i < r.count; i++) roleList.push(r.roleId);
  shuffle(roleList);

  state.players.forEach((p, idx) => {
    const roleId = roleList[idx] ?? "villager";
    const spec = ROLE_LABELS[roleId] ?? { camp: "good" };
    p.roleId = roleId;
    p.camp = spec.camp;
  });

  state.setup.rolesAssigned = true;
  state.setup.seenSeats = [];
  saveAndRender();
}

function allSeatsSeen() {
  return state.players.length > 0 && state.setup.seenSeats.length === state.players.length;
}

/* =========================
   Win Condition
   ========================= */
function countAliveBy(predicate) {
  return state.players.filter(p => p.alive && predicate(p)).length;
}

function evaluateWin() {
  const mode = state.board?.winCondition?.mode || "city";
  const wolves = countAliveBy(p => p.camp === "wolf");
  const goods  = countAliveBy(p => p.camp !== "wolf");

  if (wolves === 0) return { winner: "good", reason: "狼人全滅" };

  if (mode === "city") {
    if (wolves >= goods) return { winner: "wolf", reason: "屠城：狼人數 ≥ 好人數" };
  }

  if (mode === "edge") {
    const aliveGods = countAliveBy(p => (ROLE_LABELS[p.roleId]?.isGod) && p.camp !== "wolf");
    const aliveVillagers = countAliveBy(p => (p.roleId === "villager") && p.camp !== "wolf");
    if (aliveGods === 0) return { winner: "wolf", reason: "屠邊：神全死" };
    if (aliveVillagers === 0) return { winner: "wolf", reason: "屠邊：民全死" };
  }

  return null;
}

function checkWinAndEnd() {
  const res = evaluateWin();
  if (!res) return false;

  state.flow.phase = "END";
  state.flow.stepId = "END";
  state.flow.stepIndex += 1;
  state.end = { ...res, at: Date.now() };

  toast(res.winner === "good" ? `🎉 好人勝（${res.reason}）` : `🐺 狼人勝（${res.reason}）`);
  saveAndRender();
  return true;
}

/* =========================
   Night flow
   ========================= */
function enterNight() {
  state.flow.phase = "NIGHT";
  state.flow.stepId = "NIGHT:N0";
  state.flow.stepIndex += 1;

  syncDrawerUI();

  const steps = (state.board?.nightSteps || [])
    .slice()
    .sort((a, b) => a.wakeOrder - b.wakeOrder)
    .map((s) => ({ kind: "STEP", stepId: s.id, name: s.name }));

  state.night.round = state.flow.round;
  state.night.order = [{ kind: "N0" }, ...steps, { kind: "RESOLVE" }, { kind: "ANNOUNCE" }];
  state.night.index = 0;

  if (!state.night.logByRound[state.night.round]) {
    state.night.logByRound[state.night.round] = {
      wolfKill: null,
      seerCheck: null,
      seerResult: null,
      witchSave: null,
      witchPoison: null,
      deaths: [],
    };
  }

  state.flow.pending = null;
  state.day.afterExile = null;
  toast("🌙 進入夜晚");
  saveAndRender();
}

function getCurrentNightStep() {
  if (state.flow.phase !== "NIGHT") return null;
  return state.night.order[state.night.index] || null;
}

function nextNightStep() {
  state.flow.pending = null;
  state.night.index = Math.min(state.night.index + 1, state.night.order.length - 1);

  const cur = getCurrentNightStep();
  if (!cur) return saveAndRender();

  if (cur.kind === "N0") state.flow.stepId = "NIGHT:N0";
  else if (cur.kind === "STEP") state.flow.stepId = `NIGHT:${cur.stepId}`;
  else if (cur.kind === "RESOLVE") state.flow.stepId = "NIGHT:RESOLVE";
  else if (cur.kind === "ANNOUNCE") state.flow.stepId = "NIGHT:ANNOUNCE";

  state.flow.stepIndex += 1;
  saveAndRender();
}

function getKnifeSeatForWitch() {
  const log = state.night.logByRound[state.night.round];
  return log?.wolfKill ?? null;
}

function commitWolf() {
  const log = state.night.logByRound[state.night.round];
  log.wolfKill = state.flow.pending?.wolfKill ?? null;
  saveState(state);
}

function commitSeer() {
  const log = state.night.logByRound[state.night.round];
  const seat = state.flow.pending?.seerCheck ?? null;
  log.seerCheck = seat;

  const target = state.players.find((p) => p.seat === seat);
  log.seerResult = target ? (target.camp === "wolf" ? "狼人" : "好人") : null;

  saveState(state);
}

function commitWitch() {
  const log = state.night.logByRound[state.night.round];
  const p = state.flow.pending || {};
  log.witchSave = p.witchSave ?? null;
  log.witchPoison = p.witchPoison ?? null;

  if (log.witchSave) state.witch.usedAntidote = true;
  if (log.witchPoison) state.witch.usedPoison = true;

  saveState(state);
}

function resolveNight() {
  const log = state.night.logByRound[state.night.round];
  const deaths = new Set();

  const wolfKill = log.wolfKill;
  const save = log.witchSave;
  const poison = log.witchPoison;

  if (wolfKill) deaths.add(wolfKill);
  if (save && wolfKill === save) deaths.delete(wolfKill);
  if (poison) deaths.add(poison);

  log.deaths = Array.from(deaths).sort((a, b) => a - b);

  for (const seat of log.deaths) {
    const pl = state.players.find((p) => p.seat === seat);
    if (pl) pl.alive = false;
  }

  saveState(state);
  checkWinAndEnd();
}

/* =========================
   Day flow + voting
   ========================= */
function enterDay() {
  if (state.flow.phase === "END") return;

  state.flow.phase = "DAY";
  state.flow.stepId = "DAY:D1";
  state.flow.stepIndex += 1;

  state.day.round = state.flow.round;
  state.day.stage = "DISCUSS";
  state.day.pending = null;
  state.day.voterOrder = [];
  state.day.voterIndex = 0;
  state.day.candidates = null;
  state.day.afterExile = null;

  if (!state.day.voteLogByRound[state.flow.round]) {
    state.day.voteLogByRound[state.flow.round] = {
      ties: 0,
      MAIN: { votes: {} },
      PK: { votes: {} },
      lastResult: null,
    };
  }

  toast("☀️ 進入白天");
  saveAndRender();
}

function aliveSeats() {
  return state.players.filter((p) => p.alive).map((p) => p.seat);
}

// ✅ 可投票的存活玩家（白癡被票出後 canVote=false 不再投票）
function aliveVoterSeats() {
  return state.players.filter((p) => p.alive && p.canVote !== false).map((p) => p.seat);
}

function startMainVote() {
  const r = state.flow.round;
  const aliveVoters = aliveVoterSeats();

  state.day.voterOrder = aliveVoters.slice();
  state.day.voterIndex = 0;
  state.day.pending = { target: null };
  state.day.candidates = null;
  state.day.stage = "MAIN_CAST";

  state.day.voteLogByRound[r].MAIN.votes = {};
  state.flow.stepId = "DAY:VOTE:CAST";
  state.flow.stepIndex += 1;

  saveAndRender();
}

function currentVoterSeat() {
  return state.day.voterOrder[state.day.voterIndex] ?? null;
}

function commitCurrentVoteAndAdvance(kind) {
  const r = state.flow.round;
  const voter = currentVoterSeat();
  if (!voter) return toast("投票流程錯誤：找不到投票者");

  const target = state.day.pending?.target ?? null;

  if (target !== null) {
    const alive = new Set(aliveSeats());
    if (!alive.has(target)) return toast("不能投已死亡的人");
    if (kind === "PK" && state.day.candidates && !state.day.candidates.includes(target)) {
      return toast("PK 只能投平票者");
    }
  }

  const bucket = kind === "PK" ? state.day.voteLogByRound[r].PK.votes : state.day.voteLogByRound[r].MAIN.votes;
  bucket[String(voter)] = target;

  state.day.voterIndex += 1;
  state.day.pending = { target: null };

  if (state.day.voterIndex >= state.day.voterOrder.length) {
    state.day.stage = kind === "PK" ? "PK_RESULT" : "MAIN_RESULT";
    state.flow.stepId = kind === "PK" ? "DAY:PK:RESULT" : "DAY:VOTE:RESULT";
    state.flow.stepIndex += 1;
    return saveAndRender();
  }

  saveAndRender(false);
}

function tallyVotes(votesObj, candidateLimit = null) {
  const counts = new Map();
  const detailLines = [];

  const voters = Object.keys(votesObj).map(Number).sort((a, b) => a - b);
  for (const v of voters) {
    const t = votesObj[String(v)];
    if (t === null || t === undefined) {
      detailLines.push(`${v}號→（棄票）`);
      continue;
    }
    detailLines.push(`${v}號→${t}號`);
    if (candidateLimit && !candidateLimit.includes(t)) continue;
    counts.set(t, (counts.get(t) || 0) + 1);
  }

  const sortedCounts = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const topCount = sortedCounts.length ? sortedCounts[0][1] : 0;
  const topSeats = sortedCounts.filter(([_, c]) => c === topCount && topCount > 0).map(([s]) => s);

  return { detailLines, sortedCounts, topCount, topSeats };
}

function processVoteResultAndAdvance(kind) {
  const r = state.flow.round;
  const roundLog = state.day.voteLogByRound[r];

  const votes = kind === "PK" ? roundLog.PK.votes : roundLog.MAIN.votes;
  const limit = kind === "PK" ? state.day.candidates : null;
  const result = tallyVotes(votes, limit);

  roundLog.lastResult = { kind, result, at: Date.now() };

  const tie = result.topSeats.length >= 2;
  const hasWinner = result.topSeats.length === 1;

  if (kind === "MAIN") {
    if (tie) {
      roundLog.ties += 1;
      state.day.candidates = result.topSeats.slice();
      state.day.voterOrder = aliveVoterSeats(); // ✅ PK 投票者也排除失票者
      state.day.voterIndex = 0;
      state.day.pending = { target: null };
      state.day.stage = "PK_CAST";
      roundLog.PK.votes = {};
      state.flow.stepId = "DAY:PK:CAST";
      state.flow.stepIndex += 1;
      toast(`平票 → 進入 PK：${state.day.candidates.join("、")}號`);
      return saveAndRender();
    }

    if (hasWinner) {
      const seat = result.topSeats[0];
      const outcome = exileSeat(seat); // ✅ Day6 outcomes
      if (state.flow.phase === "END") return;

      if (outcome === "HUNTER_PENDING") {
        // stay in DAY until hunter done
        return;
      }

      state.flow.round += 1;
      return enterNight();
    }

    toast("全棄票 → 無人放逐");
    state.flow.round += 1;
    return enterNight();
  }

  // PK
  if (kind === "PK") {
    if (tie) {
      roundLog.ties += 1;
      toast("PK 再平票 → 無人放逐");
      state.flow.round += 1;
      return enterNight();
    }

    if (hasWinner) {
      const seat = result.topSeats[0];
      const outcome = exileSeat(seat);
      if (state.flow.phase === "END") return;

      if (outcome === "HUNTER_PENDING") {
        return;
      }

      state.flow.round += 1;
      return enterNight();
    }

    toast("PK 全棄票 → 無人放逐");
    state.flow.round += 1;
    return enterNight();
  }
}

/* =========================
   Day6: exile handling
   ========================= */
/**
 * @returns "NORMAL_DEAD" | "IDIOT_SURVIVE" | "HUNTER_PENDING"
 */
function exileSeat(seat) {
  const p = state.players.find((x) => x.seat === seat);
  if (!p || !p.alive) return "NORMAL_DEAD";

  // ✅ 白癡：第一次被票 => 不死，但失去投票權
  if (p.roleId === "idiot" && !p.markers?.idiotRevealed) {
    p.markers = p.markers || {};
    p.markers.idiotRevealed = true;
    p.canVote = false;
    toast(`白癡 ${seat}號 被票出但不死（失去投票權）`);
    saveState(state);
    saveAndRender();
    return "IDIOT_SURVIVE";
  }

  // 其他角色：死亡
  p.alive = false;
  toast(`放逐：${seat}號`);
  saveState(state);

  // ✅ 獵人：被放逐 => 先問是否開槍
  if (p.roleId === "hunter") {
    state.day.afterExile = {
      type: "HUNTER",
      shooterSeat: seat,
      stage: "PROMPT",
      target: null,
    };
    state.flow.stepId = "DAY:AFTER_EXILE:HUNTER_PROMPT";
    state.flow.stepIndex += 1;
    saveAndRender();
    return "HUNTER_PENDING";
  }

  checkWinAndEnd();
  saveAndRender();
  return "NORMAL_DEAD";
}

function goHunterPick() {
  if (!state.day.afterExile || state.day.afterExile.type !== "HUNTER") return;
  state.day.afterExile.stage = "PICK";
  state.day.afterExile.target = null;
  state.flow.stepId = "DAY:AFTER_EXILE:HUNTER_PICK";
  state.flow.stepIndex += 1;
  toast("獵人請選擇射擊目標");
  saveAndRender();
}

function confirmHunterShot() {
  const after = state.day.afterExile;
  if (!after || after.type !== "HUNTER") return;

  const shooter = after.shooterSeat;
  const targetSeat = after.target;

  if (!targetSeat) return toast("請先選射擊目標");
  if (targetSeat === shooter) return toast("不能射自己");

  const target = state.players.find(p => p.seat === targetSeat);
  if (!target || !target.alive) return toast("目標已死亡，請重選");

  target.alive = false;
  toast(`💥 獵人 ${shooter}號 開槍：帶走 ${targetSeat}號`);
  saveState(state);

  finalizeAfterExileAndNext();
}

function finalizeAfterExileAndNext() {
  state.day.afterExile = null;

  // 先判定勝負
  if (checkWinAndEnd()) return;

  // 結束白天 → 下一輪
  state.flow.round += 1;
  enterNight();
}

/* =========================
   Seat rendering + interactions
   ========================= */
function renderSeats() {
  const n = state.players.length || 9;
  let cols = 3;
  if (n === 12) cols = 4;
  else if (n === 10) cols = 5;
  seatsGrid.dataset.cols = String(cols);

  seatsGrid.innerHTML = "";

  const step = state.flow.stepId;
  const dayPickClass = step === "DAY:VOTE:CAST" ? "pick-vote"
    : step === "DAY:PK:CAST" ? "pick-pk"
    : step === "DAY:AFTER_EXILE:HUNTER_PICK" ? "pick-hunter"
    : null;

  state.players.forEach((p) => {
    const el = document.createElement("div");
    el.className = "seat";
    el.dataset.seat = String(p.seat);

    if (!p.alive) el.classList.add("dead");
    if (state.setup.seenSeats.includes(p.seat)) el.classList.add("seen");

    if (step === "SETUP:A3" && state.ui.revealingSeat === p.seat) el.classList.add("reveal");
    if (dayPickClass) {
      const picked =
        (step === "DAY:AFTER_EXILE:HUNTER_PICK" && state.day.afterExile?.target === p.seat) ||
        ((step === "DAY:VOTE:CAST" || step === "DAY:PK:CAST") && state.day.pending?.target === p.seat);

      if (picked) el.classList.add(dayPickClass);
    }

    const corner = document.createElement("div");
    corner.className = "corner";
    corner.textContent = getCornerText(p.seat);

    const num = document.createElement("div");
    num.className = "num";
    num.textContent = `${p.seat}號`;

    const tag = document.createElement("div");
    tag.className = "tag";

    if (step === "SETUP:A3" && state.ui.revealingSeat === p.seat) {
      const spec = ROLE_LABELS[p.roleId] || { name: "未知", camp: "good" };
      tag.textContent = `${spec.name} · ${spec.camp === "wolf" ? "狼人陣營" : "好人陣營"}`;
    } else {
      // ✅ 顯示失去投票權
      const voteTxt = (p.alive && p.canVote === false) ? "（失去投票權）" : "";
      tag.textContent = p.alive ? `存活${voteTxt}` : "死亡";

      // ✅ God view expanded: alive/dead 都顯示角色＋陣營
      if (state.ui.godExpanded && p.roleId) {
        const spec = ROLE_LABELS[p.roleId] || { name: p.roleId, camp: p.camp || "good" };
        el.classList.toggle("camp-wolf", spec.camp === "wolf");
        el.classList.toggle("camp-good", spec.camp !== "wolf");

        const godLine = document.createElement("div");
        godLine.className = "godrole";
        godLine.innerHTML = `${spec.name}<span class="godcamp">${spec.camp === "wolf" ? "狼人" : "好人"}</span>`;
        el.appendChild(godLine);
      }
    }

    el.appendChild(corner);
    el.appendChild(num);
    el.appendChild(tag);

    wireSeatInteractions(el, p.seat);
    seatsGrid.appendChild(el);
  });
}

function getCornerText(seat) {
  if (state.flow.stepId.startsWith("SETUP")) {
    return state.setup.seenSeats.includes(seat) ? "已看" : "未看";
  }

  if (state.flow.phase === "NIGHT") {
    const step = state.flow.stepId;
    if (step === "NIGHT:wolf") return state.flow.pending?.wolfKill === seat ? "刀" : "";
    if (step === "NIGHT:seer") return state.flow.pending?.seerCheck === seat ? "查" : "";
    if (step === "NIGHT:witch") {
      if (state.flow.pending?.witchSave === seat) return "救";
      if (state.flow.pending?.witchPoison === seat) return "毒";
      const knife = getKnifeSeatForWitch();
      if (knife === seat && !state.witch.usedAntidote) return "刀口";
      return "";
    }
  }

  if (state.flow.phase === "DAY") {
    const step = state.flow.stepId;

    if (step === "DAY:AFTER_EXILE:HUNTER_PICK") {
      const shooter = state.day.afterExile?.shooterSeat;
      if (seat === shooter) return "獵人";
      return "";
    }

    if (step === "DAY:VOTE:CAST" || step === "DAY:PK:CAST") {
      const voter = currentVoterSeat();
      if (voter === seat) return "投票中";
      return "";
    }
  }

  return "";
}

function wireSeatInteractions(el, seat) {
  const step = state.flow.stepId;

  // SETUP:A3 reveal with long press 0.3s
  if (step === "SETUP:A3") {
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
      state.ui.revealingSeat = state.ui.revealingSeat === seat ? null : seat;
      if (state.ui.revealingSeat === seat && !state.setup.seenSeats.includes(seat)) {
        state.setup.seenSeats.push(seat);
      }
      saveAndRender();
    });

    return;
  }

  // NIGHT seat picking
  if (state.flow.phase === "NIGHT") {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      handleNightSeatPick(seat);
    });
    return;
  }

  // Hunter pick
  if (state.flow.phase === "DAY" && step === "DAY:AFTER_EXILE:HUNTER_PICK") {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      handleHunterPick(seat);
    });
    return;
  }

  // DAY voting seat picking
  if (state.flow.phase === "DAY" && (step === "DAY:VOTE:CAST" || step === "DAY:PK:CAST")) {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      handleDaySeatPick(seat);
    });
    return;
  }
}

function handleNightSeatPick(seat) {
  const stepId = state.flow.stepId;

  const alive = state.players.find((p) => p.seat === seat && p.alive);
  if (!alive) return toast("這位已死亡，不能選");

  if (stepId === "NIGHT:wolf") {
    const cur = state.flow.pending?.wolfKill ?? null;
    const next = cur === seat ? null : seat; // allow none
    state.flow.pending = { wolfKill: next };
    saveAndRender(false);
    return;
  }

  if (stepId === "NIGHT:seer") {
    state.flow.pending = { seerCheck: seat };
    saveAndRender(false);
    return;
  }

  if (stepId === "NIGHT:witch") {
    const knife = getKnifeSeatForWitch();
    const canSave = !state.witch.usedAntidote && !!knife;
    const canPoison = !state.witch.usedPoison;

    const p = state.flow.pending || { witchSave: null, witchPoison: null };

    if (knife === seat) {
      if (!canSave) return toast("解藥已用過（或沒有刀口）");

      const witchSeat = findRoleSeat("witch");
      const selfSaveAllowed = !!state.board?.witchCanSelfSave;
      if (!selfSaveAllowed && witchSeat && knife === witchSeat) return toast("本局設定：女巫不可自救");

      const nextSave = p.witchSave === seat ? null : seat;
      state.flow.pending = { witchSave: nextSave, witchPoison: null };
      saveAndRender(false);
      return;
    }

    if (!canPoison) return toast("毒藥已用過");

    const nextPoison = p.witchPoison === seat ? null : seat;
    state.flow.pending = { witchSave: null, witchPoison: nextPoison };
    saveAndRender(false);
    return;
  }

  toast("這一步不用點座位");
}

function handleDaySeatPick(seat) {
  const step = state.flow.stepId;
  const voter = currentVoterSeat();
  if (!voter) return;

  const aliveSet = new Set(aliveSeats());
  if (!aliveSet.has(seat)) return toast("不能投已死亡的人");

  if (step === "DAY:PK:CAST" && state.day.candidates && !state.day.candidates.includes(seat)) {
    return toast("PK 只能投平票者");
  }

  state.day.pending = state.day.pending || { target: null };
  state.day.pending.target = state.day.pending.target === seat ? null : seat;
  saveAndRender(false);
}

function handleHunterPick(seat) {
  const after = state.day.afterExile;
  if (!after || after.type !== "HUNTER") return;

  const shooter = after.shooterSeat;
  if (seat === shooter) return toast("不能射自己");

  const target = state.players.find(p => p.seat === seat);
  if (!target || !target.alive) return toast("不能射已死亡的人");

  after.target = after.target === seat ? null : seat;
  saveAndRender(false);
}

function findRoleSeat(roleId) {
  const p = state.players.find((x) => x.roleId === roleId);
  return p?.seat ?? null;
}

/* =========================
   Prompt + God panel
   ========================= */
function renderPrompt() {
  if (state.flow.phase === "END") {
    const e = state.end || { winner: "?", reason: "" };
    promptTitle.textContent = "遊戲結束";
    promptText.textContent =
      (e.winner === "good" ? "🎉 好人獲勝！" : "🐺 狼人獲勝！") +
      (e.reason ? `\n\n原因：${e.reason}` : "");
    promptFoot.textContent = "可按 ⚙️ → 重置本局 開新局。";
    return;
  }

  const step = state.flow.stepId;

  // SETUP
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
    promptFoot.querySelectorAll(".quick").forEach((btn) => {
      btn.addEventListener("click", () => {
        const count = Number(btn.dataset.count);
        setPlayersCount(count);
        toast(`已選 ${count} 人`);
      });
    });
    return;
  }

  if (step === "SETUP:A2") {
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
    return;
  }

  if (step === "SETUP:A3") {
    promptTitle.textContent = "抽身分";
    promptText.textContent =
      "請大家依序查看身分。看完請把手機交回上帝。\n\n" +
      "操作：長按 0.3 秒翻牌；也可以點座位重看。";
    promptFoot.textContent = `已查看：${state.setup.seenSeats.length} / ${state.players.length}（全部看完才能進夜晚）`;
    return;
  }

  // NIGHT
  if (state.flow.phase === "NIGHT") {
    if (step === "NIGHT:N0") {
      promptTitle.textContent = "天黑";
      promptText.textContent = "天黑請閉眼。所有人請保持安靜。";
      promptFoot.textContent = "按「下一步」開始夜晚流程。";
      return;
    }

    if (step === "NIGHT:wolf") {
      promptTitle.textContent = "狼人行動";
      promptText.textContent =
        "狼人請睜眼，確認彼此身分。\n" +
        "狼人請選擇今晚要殺的人（可空刀）。\n" +
        "狼人請閉眼。";
      const v = state.flow.pending?.wolfKill ?? null;
      promptFoot.textContent = `目前：${v ? `刀 ${v}號` : "空刀"}`;
      return;
    }

    if (step === "NIGHT:seer") {
      promptTitle.textContent = "預言家查驗";
      promptText.textContent =
        "預言家請睜眼。\n" +
        "請選擇一位玩家查驗身分。\n" +
        "上帝會口頭宣告結果（好人/狼人）。\n" +
        "預言家請閉眼。";
      const v = state.flow.pending?.seerCheck ?? null;
      promptFoot.textContent = v ? `已選：查驗 ${v}號` : "尚未選擇";
      return;
    }

    if (step === "NIGHT:witch") {
      promptTitle.textContent = "女巫用藥";
      const knife = getKnifeSeatForWitch();
      const knifeText = !state.witch.usedAntidote && knife
        ? `今晚刀口：${knife}號`
        : "今晚沒有刀口資訊（解藥已用或空刀）";

      promptText.textContent =
        "女巫請睜眼。\n" +
        `${knifeText}\n\n` +
        "操作：點「刀口」＝救；點「其他人」＝毒；按下一步＝不用。\n" +
        "（解藥/毒藥同一晚只能擇一，可再點取消）\n" +
        "女巫請閉眼。";

      const p = state.flow.pending || {};
      let pick = "本晚不用";
      if (p.witchSave) pick = `本晚救 ${p.witchSave}號`;
      if (p.witchPoison) pick = `本晚毒 ${p.witchPoison}號`;

      promptFoot.textContent =
        `解藥：${state.witch.usedAntidote ? "已用" : "可用"} ｜ 毒藥：${state.witch.usedPoison ? "已用" : "可用"}\n` +
        pick;
      return;
    }

    if (step === "NIGHT:RESOLVE") {
      promptTitle.textContent = "夜晚結算";
      promptText.textContent = "（系統結算中：狼刀 → 女巫救/毒）";
      promptFoot.textContent = "按「下一步」產生天亮公告。";
      return;
    }

    if (step === "NIGHT:ANNOUNCE") {
      promptTitle.textContent = "天亮公告";
      const log = state.night.logByRound[state.night.round];
      const deaths = log?.deaths || [];
      promptText.textContent =
        deaths.length === 0
          ? "天亮了。昨晚是平安夜，無人死亡。"
          : `天亮了。昨晚死亡的是：${deaths.join("號、")}號。`;
      promptFoot.textContent = "按「下一步」進入白天。";
      return;
    }
  }

  // DAY
  if (state.flow.phase === "DAY") {
    const r = state.flow.round;
    const roundLog = state.day.voteLogByRound[r];

    if (step === "DAY:D1") {
      promptTitle.textContent = "白天開始";
      const log = state.night.logByRound[r];
      const deaths = log?.deaths || [];
      promptText.textContent = deaths.length
        ? `昨晚死亡：${deaths.join("號、")}號。\n請大家開始討論。`
        : "昨晚平安夜。\n請大家開始討論。";
      promptFoot.textContent = "按「下一步」開始逐位投票。";
      return;
    }

    if (step === "DAY:VOTE:CAST") {
      promptTitle.textContent = "白天投票";
      const voter = currentVoterSeat();
      promptText.textContent =
        `輪到 ${voter}號 投票。\n` +
        "請點選你要投的座位。\n\n" +
        "小提醒：右下角「棄票」＝0票。";
      const t = state.day.pending?.target ?? null;
      promptFoot.textContent = t ? `目前選擇：投 ${t}號` : "尚未選擇（可棄票）";
      return;
    }

    if (step === "DAY:VOTE:RESULT") {
      promptTitle.textContent = "投票統計";
      const result = tallyVotes(roundLog.MAIN.votes);
      const details = result.detailLines.join("\n");
      const counts = result.sortedCounts.map(([s, c]) => `${s}號 ${c}票`).join("、") || "（沒有有效票）";
      promptText.textContent = `${details}\n\n票數：${counts}`;

      if (result.topSeats.length >= 2) {
        promptFoot.textContent = `平票：${result.topSeats.join("、")}號 → 按「下一步」進 PK`;
      } else if (result.topSeats.length === 1) {
        promptFoot.textContent = `最高票：${result.topSeats[0]}號 → 按「下一步」處理放逐`;
      } else {
        promptFoot.textContent = "全棄票 → 按「下一步」無人放逐並進入下一晚";
      }
      return;
    }

    if (step === "DAY:PK:CAST") {
      promptTitle.textContent = "PK 重投";
      const voter = currentVoterSeat();
      const cands = state.day.candidates || [];
      promptText.textContent =
        `平票者：${cands.join("、")}號\n\n` +
        `輪到 ${voter}號 投票。\n` +
        "PK 只能投平票者。\n\n" +
        "右下角「棄票」＝0票。";
      const t = state.day.pending?.target ?? null;
      promptFoot.textContent = t ? `目前選擇：投 ${t}號` : "尚未選擇（可棄票）";
      return;
    }

    if (step === "DAY:PK:RESULT") {
      promptTitle.textContent = "PK 統計";
      const limit = state.day.candidates || null;
      const result = tallyVotes(roundLog.PK.votes, limit);
      const details = result.detailLines.join("\n");
      const counts = result.sortedCounts.map(([s, c]) => `${s}號 ${c}票`).join("、") || "（沒有有效票）";
      promptText.textContent = `${details}\n\n票數：${counts}`;

      if (result.topSeats.length >= 2) {
        promptFoot.textContent = `第二次平票 → 按「下一步」無人放逐並進入下一晚`;
      } else if (result.topSeats.length === 1) {
        promptFoot.textContent = `最高票：${result.topSeats[0]}號 → 按「下一步」處理放逐`;
      } else {
        promptFoot.textContent = "全棄票 → 按「下一步」無人放逐並進入下一晚";
      }
      return;
    }

    // ✅ Hunter after exile
    if (step === "DAY:AFTER_EXILE:HUNTER_PROMPT") {
      const shooter = state.day.afterExile?.shooterSeat;
      promptTitle.textContent = "獵人技能";
      promptText.textContent =
        `獵人 ${shooter}號 被放逐。\n\n` +
        "是否要開槍？\n" +
        "（先決定，再選目標）";
      promptFoot.textContent = "按「開槍」進入選目標；按右下角「不開槍」直接進下一晚。";
      return;
    }

    if (step === "DAY:AFTER_EXILE:HUNTER_PICK") {
      const shooter = state.day.afterExile?.shooterSeat;
      const t = state.day.afterExile?.target ?? null;
      promptTitle.textContent = "獵人開槍";
      promptText.textContent =
        `獵人 ${shooter}號 請選擇要射擊的目標。\n\n` +
        "點座位選擇（不能射自己、不能射已死亡）。";
      promptFoot.textContent = t ? `目前選擇：射 ${t}號` : "尚未選擇目標";
      return;
    }
  }

  promptTitle.textContent = "（未定義步驟）";
  promptText.textContent = "目前步驟尚未定義 prompt。";
  promptFoot.textContent = "";
}

function renderGodPanel() {
  if (!state.ui.godExpanded) {
    godText.textContent = "（收合中）";
    return;
  }

  if (state.flow.phase === "END") {
    const e = state.end || {};
    godText.textContent = `結束：${e.winner === "good" ? "好人勝" : "狼人勝"}\n原因：${e.reason || "—"}`;
    return;
  }

  const step = state.flow.stepId;

  if (step === "SETUP:A1") {
    godText.textContent = "選完人數後會自動載入對應官方板子。（若讀取失敗，會自動使用內建備援）";
    return;
  }

  if (step === "SETUP:A2") {
    if (!state.board) return (godText.textContent = "載入板子中…");
    const roleCounts = state.board.roles.map((r) => `${ROLE_LABELS[r.roleId]?.name ?? r.roleId}×${r.count}`).join("、");
    const mode = state.board.winCondition?.mode || "city";
    godText.textContent =
      `板子：${state.board.title}\n` +
      `角色：${roleCounts}\n` +
      `夜晚：${state.board.nightSteps.map((s) => `${s.wakeOrder}.${s.name}`).join(" → ")}\n` +
      `勝負：${mode === "edge" ? "屠邊" : "屠城"}\n` +
      `上警：${state.board.hasPolice ? "啟用" : "關閉"}`;
    return;
  }

  if (step === "SETUP:A3") {
    const seen = new Set(state.setup.seenSeats);
    const unseen = state.players.filter((p) => !seen.has(p.seat)).map((p) => p.seat);
    godText.textContent =
      `抽身分：${state.setup.rolesAssigned ? "已分配" : "未分配"}\n` +
      `未查看：${unseen.length ? unseen.join("、") : "（無）"}`;
    return;
  }

  if (state.flow.phase === "NIGHT") {
    const log = state.night.logByRound[state.night.round];

    if (step === "NIGHT:seer") {
      const seat = state.flow.pending?.seerCheck ?? null;
      let res = "（尚未選）";
      if (seat) {
        const target = state.players.find((p) => p.seat === seat);
        res = target ? (target.camp === "wolf" ? "狼人" : "好人") : "未知";
      }
      godText.textContent = `查驗：${seat ? `${seat}號 → ${res}` : "尚未選擇"}`;
      return;
    }

    if (step === "NIGHT:RESOLVE") {
      godText.textContent =
        `狼刀：${log?.wolfKill ?? "空刀"}\n` +
        `救：${log?.witchSave ?? "—"}\n` +
        `毒：${log?.witchPoison ?? "—"}\n` +
        `死亡：${log?.deaths?.length ? log.deaths.join("、") + "號" : "平安夜"}`;
      return;
    }

    if (step === "NIGHT:ANNOUNCE") {
      godText.textContent = `死亡：${log?.deaths?.length ? log.deaths.join("、") + "號" : "平安夜"}`;
      return;
    }

    godText.textContent = "夜晚流程中…";
    return;
  }

  if (state.flow.phase === "DAY") {
    const r = state.flow.round;
    const vote = state.day.voteLogByRound[r];
    if (state.flow.stepId === "DAY:VOTE:RESULT") {
      const res = tallyVotes(vote.MAIN.votes);
      godText.textContent = `主投最高票：${res.topSeats.length ? res.topSeats.join("、") + "號" : "（無）"}`;
      return;
    }
    if (state.flow.stepId === "DAY:PK:RESULT") {
      const res = tallyVotes(vote.PK.votes, state.day.candidates);
      godText.textContent = `PK最高票：${res.topSeats.length ? res.topSeats.join("、") + "號" : "（無）"}`;
      return;
    }
    if (state.flow.stepId.startsWith("DAY:AFTER_EXILE:HUNTER")) {
      const shooter = state.day.afterExile?.shooterSeat;
      const t = state.day.afterExile?.target ?? null;
      godText.textContent = `獵人放逐後：${shooter}號\n目標：${t ? t + "號" : "（未選）"}`;
      return;
    }
    godText.textContent = "白天流程中…";
    return;
  }

  godText.textContent = "（此步驟尚未定義上帝資訊）";
}

/* =========================
   Action bar rendering
   ========================= */
function renderActions() {
  const step = state.flow.stepId;

  btnBack.disabled = true;

  if (state.flow.phase === "END") {
    btnPrimary.disabled = true;
    btnCancel.disabled = true;
    btnPrimary.textContent = "已結束";
    btnCancel.textContent = "—";
    return;
  }

  btnCancel.disabled = false;

  if (state.flow.phase === "SETUP") {
    btnCancel.textContent = "取消";
    if (step === "SETUP:A1") {
      btnPrimary.textContent = "下一步";
      btnPrimary.disabled = !state.config.playersCount;
      return;
    }
    if (step === "SETUP:A2") {
      btnPrimary.textContent = "下一步";
      btnPrimary.disabled = !state.board;
      return;
    }
    if (step === "SETUP:A3") {
      btnPrimary.textContent = "確認進夜晚";
      btnPrimary.disabled = !allSeatsSeen();
      return;
    }
  }

  if (state.flow.phase === "NIGHT") {
    btnCancel.textContent = "取消";
    btnPrimary.disabled = false;
    if (step === "NIGHT:N0") btnPrimary.textContent = "開始夜晚";
    else if (step === "NIGHT:wolf") btnPrimary.textContent = "下一步（提交刀口）";
    else if (step === "NIGHT:seer") {
      btnPrimary.textContent = "下一步（提交查驗）";
      btnPrimary.disabled = !state.flow.pending?.seerCheck;
    } else if (step === "NIGHT:witch") btnPrimary.textContent = "下一步（提交用藥）";
    else if (step === "NIGHT:RESOLVE") btnPrimary.textContent = "生成天亮公告";
    else if (step === "NIGHT:ANNOUNCE") btnPrimary.textContent = "進入白天";
    else btnPrimary.textContent = "下一步";
    return;
  }

  if (state.flow.phase === "DAY") {
    // Hunter after exile steps
    if (step === "DAY:AFTER_EXILE:HUNTER_PROMPT") {
      btnCancel.textContent = "不開槍";
      btnPrimary.textContent = "開槍";
      btnPrimary.disabled = false;
      return;
    }
    if (step === "DAY:AFTER_EXILE:HUNTER_PICK") {
      btnCancel.textContent = "取消";
      btnPrimary.textContent = "確認射擊";
      btnPrimary.disabled = !state.day.afterExile?.target;
      return;
    }

    btnPrimary.disabled = false;

    if (step === "DAY:D1") {
      btnCancel.textContent = "取消";
      btnPrimary.textContent = "開始投票";
      return;
    }

    if (step === "DAY:VOTE:CAST" || step === "DAY:PK:CAST") {
      btnCancel.textContent = "棄票";
      const t = state.day.pending?.target ?? null;
      btnPrimary.textContent = t ? "提交本票" : "提交本票（請先點人或按棄票）";
      return;
    }

    if (step === "DAY:VOTE:RESULT" || step === "DAY:PK:RESULT") {
      btnCancel.textContent = "取消";
      btnPrimary.textContent = "下一步";
      return;
    }
  }
}

/* =========================
   Settings drawer
   ========================= */
function openDrawer() {
  drawer?.classList.remove("hidden");
  drawerBackdrop?.classList.remove("hidden");
  syncDrawerUI();
}
function closeDrawer() {
  drawer?.classList.add("hidden");
  drawerBackdrop?.classList.add("hidden");
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
  if (!segEdge || !segCity || !togglePolice) return;
  const mode = state.board?.winCondition?.mode || "city";
  segEdge.classList.toggle("active", mode === "edge");
  segCity.classList.toggle("active", mode === "city");
  togglePolice.checked = !!state.board?.hasPolice;

  const lock = !isSetupPhase();
  segEdge.disabled = lock;
  segCity.disabled = lock;
  togglePolice.disabled = lock;
}

/* =========================
   Timer drawer + logic (persist)
   ========================= */
function openTimer() {
  timerDrawer?.classList.remove("hidden");
  timerBackdrop?.classList.remove("hidden");
  renderTimerUI();
}
function closeTimer() {
  timerDrawer?.classList.add("hidden");
  timerBackdrop?.classList.add("hidden");
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
  if (!state.timer.durationMs) setTimer(120000);
  if (state.timer.remainingMs <= 0) state.timer.remainingMs = state.timer.durationMs;
  state.timer.running = true;
  state.timer.lastTickAt = Date.now();
  ensureTimerTick();
  saveAndRender();
  renderTimerUI();
}

function pauseTimer() {
  if (!state.timer.running) return;
  tickOnce();
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
  if (clearAll) state.timer = { durationMs: 0, remainingMs: 0, running: false, lastTickAt: 0 };
  else state.timer.running = false;
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

  if (state.timer.remainingMs <= 0) {
    state.timer.running = false;
    state.timer.remainingMs = 0;
    if (navigator.vibrate) navigator.vibrate([120, 80, 120]);
    toast("⏱️ 時間到！");
  }

  saveState(state);
  renderTimerBadge();
  renderTimerUI();
}

function renderTimerBadge() {
  if (!btnTimer) return;
  const running = state.timer.running;
  btnTimer.classList.toggle("running", running);
  const remain = state.timer.remainingMs || 0;
  btnTimer.textContent = running || remain > 0 ? formatMMSS(remain) : "⏱️";
}

function renderTimerUI() {
  if (!timerBig || !timerHint) return;
  timerBig.textContent = formatMMSS(state.timer.remainingMs || 0);
  if (state.timer.running) timerHint.textContent = "倒數中…（可暫停或重置）";
  else if ((state.timer.remainingMs || 0) > 0) timerHint.textContent = "已暫停／待開始（可按開始繼續）";
  else timerHint.textContent = "選一個常用時間開始，或按開始使用預設 2:00。";
}

function formatMMSS(ms) {
  const sec = Math.ceil(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* =========================
   Root render
   ========================= */
function render() {
  uiStatus.textContent = `${state.flow.phase} / R${state.flow.round} / ${state.flow.stepId}`;
  uiBoard.textContent = state.board ? state.board.title : "未套用板子";
  if (toggleGodView) toggleGodView.checked = !!state.ui.godExpanded;

  renderPrompt();
  renderGodPanel();
  renderSeats();
  renderActions();

  renderTimerBadge();
  if (state.timer.running) ensureTimerTick();

  saveState(state);
  syncDrawerUI();
}

/* ---------- quick button style injection (A1) ---------- */
const styleTag = document.createElement("style");
styleTag.textContent = `
.quick-row{ display:flex; gap:8px; margin-top:6px; }
.quick{
  flex:1; border:2px solid var(--line, #e3c39e); background:#fff;
  border-radius:999px; padding:10px 12px; font-weight:900;
}
`;
document.head.appendChild(styleTag);

/* =========================
   Toast
   ========================= */
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

/* =========================
   Boot
   ========================= */
render();
renderTimerUI();