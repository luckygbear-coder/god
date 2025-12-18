/* Werewolf God Helper - MVP v30
   - Board picker (boards/index.json)
   - Timer panel (bottom)
   - God view shows role+camp even if dead
   - Idiot exiled: not dead, loses voting right (revealed)
   - Hunter: exiled -> can shoot; night died by wolf -> shoot at daybreak; poison death -> cannot
   - Win mode: city/edge switchable
*/

const STORAGE_KEY = "werewolf_state_v30";

// iOS 防誤觸
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
document.addEventListener("contextmenu", (e) => e.preventDefault());

// DOM
const uiStatus = document.getElementById("uiStatus");
const uiBoard = document.getElementById("uiBoard");
const promptTitle = document.getElementById("promptTitle");
const promptText = document.getElementById("promptText");
const promptFoot = document.getElementById("promptFoot");
const godText = document.getElementById("godText");
const toggleGodView = document.getElementById("toggleGodView");
const seatsGrid = document.getElementById("seatsGrid");

// board picker
const boardPickerCard = document.getElementById("boardPickerCard");
const boardPickerHint = document.getElementById("boardPickerHint");
const boardPicker = document.getElementById("boardPicker");

// settings drawer
const btnSettings = document.getElementById("btnSettings");
const drawer = document.getElementById("drawer");
const drawerBackdrop = document.getElementById("drawerBackdrop");
const btnCloseDrawer = document.getElementById("btnCloseDrawer");
const segEdge = document.getElementById("segEdge");
const segCity = document.getElementById("segCity");
const togglePolice = document.getElementById("togglePolice");
const btnReset = document.getElementById("btnReset");

// timer panel
const timerBig = document.getElementById("timerBig");
const timerHint = document.getElementById("timerHint");
const btnTimerStart = document.getElementById("btnTimerStart");
const btnTimerPause = document.getElementById("btnTimerPause");
const btnTimerReset = document.getElementById("btnTimerReset");
const timerPresets = document.getElementById("timerPresets");

// action bar
const btnBack = document.getElementById("btnBack");
const btnPrimary = document.getElementById("btnPrimary");
const btnCancel = document.getElementById("btnCancel");

const ROLE = {
  wolf: { name: "狼人", camp: "wolf", isGod: false },
  seer: { name: "預言家", camp: "good", isGod: true },
  witch: { name: "女巫", camp: "good", isGod: true },
  hunter: { name: "獵人", camp: "good", isGod: true },
  idiot: { name: "白癡", camp: "good", isGod: true },
  villager: { name: "平民", camp: "good", isGod: false }
};

// fallback boards (if fetch fails)
const BOARD_FALLBACK = {
  "official-9": {
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
      { roleId: "villager", count: 3 }
    ],
    nightSteps: [
      { id: "wolf", name: "狼人", wakeOrder: 1, alwaysShow: true, actionType: "pick", seatPickRule: { allowNone: true } },
      { id: "seer", name: "預言家", wakeOrder: 2, alwaysShow: true, actionType: "pick" },
      { id: "witch", name: "女巫", wakeOrder: 3, alwaysShow: true, actionType: "pick" }
    ]
  },
  "official-10": {
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
      { roleId: "villager", count: 4 }
    ],
    nightSteps: [
      { id: "wolf", name: "狼人", wakeOrder: 1, alwaysShow: true, actionType: "pick", seatPickRule: { allowNone: true } },
      { id: "seer", name: "預言家", wakeOrder: 2, alwaysShow: true, actionType: "pick" },
      { id: "witch", name: "女巫", wakeOrder: 3, alwaysShow: true, actionType: "pick" }
    ]
  },
  "official-12": {
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
      { roleId: "villager", count: 4 }
    ],
    nightSteps: [
      { id: "wolf", name: "狼人", wakeOrder: 1, alwaysShow: true, actionType: "pick", seatPickRule: { allowNone: true } },
      { id: "seer", name: "預言家", wakeOrder: 2, alwaysShow: true, actionType: "pick" },
      { id: "witch", name: "女巫", wakeOrder: 3, alwaysShow: true, actionType: "pick" }
    ]
  }
};

let state = loadState() || makeInitialState();
let toastTimer = null;

// ===== Service Worker register (optional) =====
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}

/* -------------------------
   Init & Render
------------------------- */
wireUI();
render();
renderBoardPicker();

// ===== Helpers: State =====
function makeInitialState(){
  return {
    version: 30,
    config: {
      playersCount: null,
      boardId: null,
      winMode: "edge",   // default
      hasPolice: false
    },
    board: null,
    players: [],
    flow: {
      phase: "SETUP",   // SETUP | NIGHT | DAY | END
      round: 1,
      stepId: "SETUP:A1"
    },
    setup: {
      rolesAssigned: false,
      seenSeats: {} // seat -> true
    },
    night: {
      round: 1,
      stepIndex: 0,
      steps: [], // expanded from board.nightSteps
      logByRound: {} // r -> { wolfKill, seerCheck, seerResult, witchSave, witchPoison, deaths, deathCauses }
    },
    day: {
      vote: null, // { type, stage, voters[], cursor, votes[], results, tiedSeats, tieCount }
      afterExile: null // hunter/idiot flows
    },
    witch: { usedAntidote:false, usedPoison:false },
    ui: { godExpanded:false, selectedSeat:null },
    timer: { totalSec: 120, remainSec: 120, running:false, lastTs: 0 }
  };
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(e){ return null; }
}
function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function saveAndRender(){
  saveState();
  render();
  renderBoardPicker();
}

/* -------------------------
   UI Wiring
------------------------- */
function wireUI(){
  // Settings drawer
  btnSettings?.addEventListener("click", openDrawer);
  btnCloseDrawer?.addEventListener("click", closeDrawer);
  drawerBackdrop?.addEventListener("click", closeDrawer);

  segEdge?.addEventListener("click", ()=> setWinMode("edge"));
  segCity?.addEventListener("click", ()=> setWinMode("city"));

  togglePolice?.addEventListener("change", ()=>{
    if(state.flow.phase !== "SETUP") return toast("遊戲開始後不建議改上警");
    state.config.hasPolice = !!togglePolice.checked;
    if(state.board) state.board.hasPolice = state.config.hasPolice;
    saveAndRender();
  });

  btnReset?.addEventListener("click", ()=>{
    if(!confirm("確定要重置本局？（會清除存檔）")) return;
    localStorage.removeItem(STORAGE_KEY);
    state = makeInitialState();
    saveAndRender();
  });

  toggleGodView?.addEventListener("change", ()=>{
    state.ui.godExpanded = !!toggleGodView.checked;
    saveAndRender();
  });

  // Action bar
  btnBack?.addEventListener("click", ()=> toast("MVP 暫不支援上一步（避免卡住）"));
  btnCancel?.addEventListener("click", onCancel);
  btnPrimary?.addEventListener("click", onPrimary);

  // Timer
  timerPresets?.addEventListener("click", (e)=>{
    const b = e.target.closest("button[data-sec]");
    if(!b) return;
    const sec = Number(b.dataset.sec || "0");
    if(!sec) return;
    setTimer(sec);
  });
  btnTimerStart?.addEventListener("click", ()=> startTimer());
  btnTimerPause?.addEventListener("click", ()=> pauseTimer());
  btnTimerReset?.addEventListener("click", ()=> resetTimer());
}

/* -------------------------
   Toast
------------------------- */
function toast(msg){
  clearTimeout(toastTimer);
  promptFoot.textContent = msg;
  toastTimer = setTimeout(()=>{ promptFoot.textContent = ""; }, 1800);
}

/* -------------------------
   Timer core
------------------------- */
let timerTick = null;

function setTimer(sec){
  state.timer.totalSec = sec;
  state.timer.remainSec = sec;
  state.timer.running = false;
  state.timer.lastTs = 0;
  stopTimerTick();
  saveAndRender();
}

function startTimer(){
  if(state.timer.remainSec <= 0){
    state.timer.remainSec = state.timer.totalSec || 120;
  }
  state.timer.running = true;
  state.timer.lastTs = Date.now();
  startTimerTick();
  saveAndRender();
}

function pauseTimer(){
  if(!state.timer.running) return;
  syncTimer();
  state.timer.running = false;
  stopTimerTick();
  saveAndRender();
}

function resetTimer(){
  state.timer.running = false;
  state.timer.remainSec = state.timer.totalSec || 120;
  state.timer.lastTs = 0;
  stopTimerTick();
  saveAndRender();
}

function syncTimer(){
  if(!state.timer.running) return;
  const now = Date.now();
  const delta = Math.floor((now - (state.timer.lastTs || now))/1000);
  if(delta > 0){
    state.timer.remainSec = Math.max(0, state.timer.remainSec - delta);
    state.timer.lastTs = now;
  }
  if(state.timer.remainSec === 0){
    state.timer.running = false;
    stopTimerTick();
    try{ navigator.vibrate?.(250); }catch(e){}
  }
}

function startTimerTick(){
  if(timerTick) return;
  timerTick = setInterval(()=>{
    syncTimer();
    renderTimerOnly();
    if(!state.timer.running) saveState();
  }, 250);
}
function stopTimerTick(){
  if(!timerTick) return;
  clearInterval(timerTick);
  timerTick = null;
}

function formatMMSS(sec){
  const m = Math.floor(sec/60);
  const s = sec % 60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function renderTimerOnly(){
  timerBig.textContent = formatMMSS(state.timer.remainSec);
  timerHint.textContent = state.timer.running ? "計時中…" : "點選時間或按「開始」。";
}

/* -------------------------
   Board Catalog (可選板子)
------------------------- */
let boardCatalog = null;

async function loadBoardCatalog(){
  if(boardCatalog) return boardCatalog;
  try{
    const r = await fetch("./boards/index.json", { cache: "no-store" });
    if(!r.ok) throw new Error("index missing");
    boardCatalog = await r.json();
    return boardCatalog;
  }catch(e){
    boardCatalog = {
      version: 1,
      boards: [
        { id:"official-9", title:"9 人官方標準局", playersCount:9, path:"./boards/official-9.json", tags:["官方"] },
        { id:"official-10", title:"10 人官方標準局", playersCount:10, path:"./boards/official-10.json", tags:["官方"] },
        { id:"official-12", title:"12 人官方標準局", playersCount:12, path:"./boards/official-12.json", tags:["官方"] }
      ]
    };
    return boardCatalog;
  }
}

function renderBoardPicker(){
  if(!boardPickerCard) return;
  boardPickerCard.style.display = (state.flow.phase === "SETUP") ? "" : "none";
  if(state.flow.phase !== "SETUP") return;

  if(!state.config.playersCount){
    boardPickerHint.textContent = "請先選人數，才會顯示可用板子。";
    boardPicker.innerHTML = "";
    return;
  }

  loadBoardCatalog().then(cat=>{
    const list = (cat.boards||[]).filter(b=> b.playersCount === state.config.playersCount);
    boardPickerHint.textContent = `目前人數：${state.config.playersCount} 人（點一下套用板子）`;

    const activeId =
      state.config.boardId ||
      (state.config.playersCount===9 ? "official-9" : state.config.playersCount===10 ? "official-10" : "official-12");

    boardPicker.innerHTML = "";
    list.forEach(b=>{
      const div = document.createElement("div");
      div.className = "board-item" + (b.id === activeId ? " active" : "");

      const left = document.createElement("div");
      const t = document.createElement("div");
      t.className = "board-title";
      t.textContent = b.title;
      const meta = document.createElement("div");
      meta.className = "board-meta";
      meta.textContent = `${b.id}`;
      left.appendChild(t);
      left.appendChild(meta);

      const tags = document.createElement("div");
      tags.className = "board-tags";
      (b.tags||[]).forEach(x=>{
        const s = document.createElement("span");
        s.className = "tag";
        s.textContent = x;
        tags.appendChild(s);
      });

      div.appendChild(left);
      div.appendChild(tags);

      div.addEventListener("click", async ()=>{
        state.config.boardId = b.id;
        await applyBoardByPath(b.path, b.id);
        // 進入 A2（套板子）後 UI 就更明確
        if(state.flow.stepId === "SETUP:A1") state.flow.stepId = "SETUP:A2";
        saveAndRender();
        toast("已套用板子 ✅");
      });

      boardPicker.appendChild(div);
    });
  });
}

async function applyBoardByPath(path, id){
  let board = null;
  try{
    const r = await fetch(path, { cache: "no-store" });
    if(!r.ok) throw new Error("load failed");
    board = await r.json();
  }catch(e){
    // fallback
    board = BOARD_FALLBACK[id] || BOARD_FALLBACK["official-12"];
  }

  state.board = board;
  state.config.playersCount = board.playersCount;
  state.config.hasPolice = !!board.hasPolice;
  state.config.winMode = board.winCondition?.mode || state.config.winMode;

  // players init/reset
  state.players = Array.from({length: board.playersCount}).map((_,i)=>({
    seat: i+1,
    roleId: null,
    alive: true,
    seen: false,
    canVote: true
  }));

  // reset setup flags
  state.setup.rolesAssigned = false;
  state.setup.seenSeats = {};

  // reset game runtime
  state.flow.phase = "SETUP";
  state.flow.round = 1;
  state.flow.stepId = "SETUP:A2";
  state.night = { round:1, stepIndex:0, steps:[], logByRound:{} };
  state.day = { vote:null, afterExile:null };
  state.witch = { usedAntidote:false, usedPoison:false };
  state.ui.selectedSeat = null;
}

/* -------------------------
   Drawer & win mode
------------------------- */
function openDrawer(){
  drawerBackdrop.classList.remove("hidden");
  drawer.classList.remove("hidden");
  // set UI
  togglePolice.checked = !!state.config.hasPolice;
  syncSegUI();
}
function closeDrawer(){
  drawerBackdrop.classList.add("hidden");
  drawer.classList.add("hidden");
}
function setWinMode(mode){
  state.config.winMode = mode;
  if(state.board){
    state.board.winCondition = state.board.winCondition || {};
    state.board.winCondition.mode = mode;
  }
  syncSegUI();
  saveAndRender();
}
function syncSegUI(){
  segEdge.classList.toggle("active", state.config.winMode === "edge");
  segCity.classList.toggle("active", state.config.winMode === "city");
}

/* -------------------------
   Primary/Cancel flow
------------------------- */
function onPrimary(){
  const phase = state.flow.phase;
  const step = state.flow.stepId;

  if(phase === "SETUP"){
    if(step === "SETUP:A1"){
      if(!state.config.playersCount) return toast("請先選人數");
      state.flow.stepId = "SETUP:A2";
      saveAndRender();
      return;
    }
    if(step === "SETUP:A2"){
      // 若還沒套板子，預設套官方
      if(!state.board){
        const id = state.config.playersCount===9 ? "official-9" : state.config.playersCount===10 ? "official-10" : "official-12";
        applyBoardByPath(`./boards/${id}.json`, id).then(()=> saveAndRender());
        return;
      }
      // 進抽身分
      if(!state.setup.rolesAssigned) assignRoles();
      state.flow.stepId = "SETUP:A3";
      saveAndRender();
      return;
    }
    if(step === "SETUP:A3"){
      if(!allSeen()) return toast("全部看完身分才能進夜晚");
      enterNight();
      saveAndRender();
      return;
    }
  }

  if(phase === "NIGHT"){
    const cur = getNightCursor();
    if(cur.kind === "N0"){
      nextNight();
      saveAndRender();
      return;
    }
    if(cur.kind === "STEP"){
      if(cur.stepId === "wolf"){
        commitWolf();
        nextNight();
        saveAndRender();
        return;
      }
      if(cur.stepId === "seer"){
        if(!state.flow.pending?.seerCheck) return toast("預言家要選一位查驗");
        commitSeer();
        nextNight();
        saveAndRender();
        return;
      }
      if(cur.stepId === "witch"){
        commitWitch();
        nextNight();
        saveAndRender();
        return;
      }
    }
    if(cur.kind === "RESOLVE"){
      resolveNight();
      // resolve 內可能進入 END / 或進 DAYBREAK_HUNTER_PROMPT
      if(state.flow.phase !== "NIGHT") { saveAndRender(); return; }
      nextNight(); // to announce
      saveAndRender();
      return;
    }
    if(cur.kind === "ANNOUNCE"){
      // 夜死獵人（狼刀）=> 天亮先問是否開槍
      if(state.day.afterExile?.type === "HUNTER_NIGHT" && state.day.afterExile.stage === "PENDING_DAYBREAK"){
        state.flow.phase = "DAY";
        state.flow.stepId = "DAY:DAYBREAK_HUNTER_PROMPT";
        state.day.afterExile.stage = "PROMPT";
        saveAndRender();
        return;
      }

      if(checkWin()) { saveAndRender(); return; }
      enterDay();
      saveAndRender();
      return;
    }
  }

  if(phase === "DAY"){
    if(step === "DAY:D1"){
      startMainVote();
      saveAndRender();
      return;
    }
    if(step === "DAY:VOTE:CAST"){
      commitVoteAndAdvance("MAIN");
      saveAndRender();
      return;
    }
    if(step === "DAY:VOTE:RESULT"){
      processVoteResultAndAdvance("MAIN");
      saveAndRender();
      return;
    }
    if(step === "DAY:PK:CAST"){
      commitVoteAndAdvance("PK");
      saveAndRender();
      return;
    }
    if(step === "DAY:PK:RESULT"){
      processVoteResultAndAdvance("PK");
      saveAndRender();
      return;
    }

    // exiled hunter prompt/pick
    if(step === "DAY:AFTER_EXILE:HUNTER_PROMPT"){
      state.flow.stepId = "DAY:AFTER_EXILE:HUNTER_PICK";
      toast("獵人請選擇射擊目標");
      saveAndRender();
      return;
    }
    if(step === "DAY:AFTER_EXILE:HUNTER_PICK"){
      if(!state.day.afterExile?.target) return toast("請先選擇要射擊的座位");
      doHunterShot("EXILE");
      saveAndRender();
      return;
    }

    // daybreak hunter prompt/pick
    if(step === "DAY:DAYBREAK_HUNTER_PROMPT"){
      state.flow.stepId = "DAY:DAYBREAK_HUNTER_PICK";
      toast("獵人（夜死）請選擇射擊目標");
      saveAndRender();
      return;
    }
    if(step === "DAY:DAYBREAK_HUNTER_PICK"){
      if(!state.day.afterExile?.target) return toast("請先選擇要射擊的座位");
      doHunterShot("DAYBREAK");
      saveAndRender();
      return;
    }
  }
}

function onCancel(){
  const phase = state.flow.phase;
  const step = state.flow.stepId;

  if(phase === "SETUP" && step === "SETUP:A3"){
    toast("已取消（不影響流程）");
    return;
  }

  if(phase === "NIGHT"){
    state.flow.pending = null;
    state.ui.selectedSeat = null;
    toast("已取消本步驟選擇");
    saveAndRender();
    return;
  }

  // Day votes: cancel = abstain
  if(phase === "DAY" && (step === "DAY:VOTE:CAST" || step === "DAY:PK:CAST")){
    state.day.pending = { target: null };
    toast("本票棄票（0票）");
    commitVoteAndAdvance(step === "DAY:VOTE:CAST" ? "MAIN" : "PK");
    saveAndRender();
    return;
  }

  // hunter prompts: cancel = no shoot
  if(phase === "DAY" && step === "DAY:AFTER_EXILE:HUNTER_PROMPT"){
    toast("獵人選擇不開槍");
    finalizeAfterExile();
    saveAndRender();
    return;
  }
  if(phase === "DAY" && step === "DAY:AFTER_EXILE:HUNTER_PICK"){
    state.day.afterExile.target = null;
    toast("已取消射擊目標");
    saveAndRender();
    return;
  }
  if(phase === "DAY" && step === "DAY:DAYBREAK_HUNTER_PROMPT"){
    toast("獵人（夜死）選擇不開槍");
    state.day.afterExile = null;
    if(checkWin()) { saveAndRender(); return; }
    state.flow.stepId = "DAY:D1";
    saveAndRender();
    return;
  }
  if(phase === "DAY" && step === "DAY:DAYBREAK_HUNTER_PICK"){
    state.day.afterExile.target = null;
    toast("已取消射擊目標");
    saveAndRender();
    return;
  }
}

/* -------------------------
   Setup: choose count & assign roles
------------------------- */
function assignRoles(){
  if(!state.board) return;
  const pool = [];
  state.board.roles.forEach(r=>{
    for(let i=0;i<r.count;i++) pool.push(r.roleId);
  });
  shuffle(pool);

  state.players.forEach((p, idx)=>{
    p.roleId = pool[idx] || "villager";
    p.alive = true;
    p.seen = false;
    p.canVote = true;
  });

  state.setup.rolesAssigned = true;
  state.setup.seenSeats = {};
}

function allSeen(){
  return state.players.every(p=> !!state.setup.seenSeats[String(p.seat)]);
}

function shuffle(a){
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
}

/* -------------------------
   Night: enter, steps, commit, resolve
------------------------- */
function enterNight(){
  state.flow.phase = "NIGHT";
  state.flow.stepId = "NIGHT:N0";
  state.night.round = state.flow.round;
  state.night.stepIndex = 0;
  state.night.steps = [...(state.board?.nightSteps || [])].sort((a,b)=> (a.wakeOrder||0)-(b.wakeOrder||0));

  const r = state.night.round;
  state.night.logByRound[r] = {
    wolfKill: null,
    seerCheck: null,
    seerResult: null,
    witchSave: null,
    witchPoison: null,
    deaths: [],
    deathCauses: {}
  };

  state.flow.pending = null;
  state.ui.selectedSeat = null;
}

function getNightCursor(){
  const idx = state.night.stepIndex;
  if(state.flow.stepId === "NIGHT:N0") return { kind:"N0" };
  if(state.flow.stepId === "NIGHT:RESOLVE") return { kind:"RESOLVE" };
  if(state.flow.stepId === "NIGHT:ANNOUNCE") return { kind:"ANNOUNCE" };

  const step = state.night.steps[idx];
  return { kind:"STEP", stepId: step?.id || null };
}

function nextNight(){
  // N0 -> first step
  if(state.flow.stepId === "NIGHT:N0"){
    state.flow.stepId = "NIGHT:STEP";
    state.night.stepIndex = 0;
    state.flow.pending = null;
    state.ui.selectedSeat = null;
    return;
  }

  // step -> next step or resolve
  if(state.flow.stepId === "NIGHT:STEP"){
    state.night.stepIndex += 1;
    state.flow.pending = null;
    state.ui.selectedSeat = null;

    if(state.night.stepIndex >= state.night.steps.length){
      state.flow.stepId = "NIGHT:RESOLVE";
    }
    return;
  }

  // resolve -> announce
  if(state.flow.stepId === "NIGHT:RESOLVE"){
    state.flow.stepId = "NIGHT:ANNOUNCE";
    return;
  }
}

function commitWolf(){
  const r = state.night.round;
  const log = state.night.logByRound[r];
  const pick = state.flow.pending?.wolfKill ?? null; // allow none
  log.wolfKill = pick;
}

function commitSeer(){
  const r = state.night.round;
  const log = state.night.logByRound[r];
  const seat = state.flow.pending?.seerCheck;
  log.seerCheck = seat;
  const target = state.players.find(p=>p.seat===seat);
  const camp = target ? ROLE[target.roleId]?.camp : null;
  log.seerResult = (camp === "wolf") ? "狼人" : "好人";
}

function commitWitch(){
  const r = state.night.round;
  const log = state.night.logByRound[r];

  // pending can be:
  // { witchSave: seat } or { witchPoison: seat } or null
  const save = state.flow.pending?.witchSave ?? null;
  const poison = state.flow.pending?.witchPoison ?? null;

  if(save && !state.witch.usedAntidote){
    log.witchSave = save;
    state.witch.usedAntidote = true;
    // 互斥：若救了就清毒
    log.witchPoison = null;
  }else if(poison && !state.witch.usedPoison){
    log.witchPoison = poison;
    state.witch.usedPoison = true;
    log.witchSave = null;
  }else{
    // 不使用
    log.witchSave = null;
    log.witchPoison = null;
  }
}

function resolveNight(){
  const r = state.night.round;
  const log = state.night.logByRound[r];
  const deaths = new Set();
  const causes = {};

  const wolfKill = log.wolfKill;
  const save = log.witchSave;
  const poison = log.witchPoison;

  if(wolfKill){
    deaths.add(wolfKill);
    causes[String(wolfKill)] = "wolf";
  }
  if(save && wolfKill === save){
    deaths.delete(wolfKill);
    delete causes[String(wolfKill)];
  }
  if(poison){
    deaths.add(poison);
    causes[String(poison)] = "poison"; // poison overrides
  }

  log.deaths = Array.from(deaths).sort((a,b)=>a-b);
  log.deathCauses = causes;

  // mark alive false
  log.deaths.forEach(seat=>{
    const p = state.players.find(x=>x.seat===seat);
    if(p) p.alive = false;
  });

  // hunter night death by wolf => daybreak prompt
  const hunterSeat = findRoleSeat("hunter");
  if(hunterSeat && log.deaths.includes(hunterSeat)){
    const c = log.deathCauses[String(hunterSeat)] || null;
    if(c === "wolf"){
      state.day.afterExile = {
        type: "HUNTER_NIGHT",
        shooterSeat: hunterSeat,
        stage: "PENDING_DAYBREAK",
        target: null
      };
    }
  }
}

function findRoleSeat(roleId){
  const p = state.players.find(x=>x.roleId===roleId);
  return p ? p.seat : null;
}

/* -------------------------
   Day: announce, vote, PK, exile effects
------------------------- */
function enterDay(){
  state.flow.phase = "DAY";
  state.flow.stepId = "DAY:D1";
  state.day.vote = null;
  state.day.pending = null;
  state.ui.selectedSeat = null;

  // next round number will be increment after a full day -> night
}

function startMainVote(){
  const voters = state.players
    .filter(p=> p.alive && p.canVote !== false)
    .map(p=> p.seat);

  state.day.vote = {
    type: "MAIN",
    stage: "CAST",
    voters,
    cursor: 0,
    votes: [],      // { from, to(null for abstain) }
    results: null,
    tiedSeats: null,
    tieCount: 0
  };
  state.day.pending = { target: null };
  state.flow.stepId = "DAY:VOTE:CAST";
  toast("開始投票：逐位投票（失去投票權者不投）");
}

function commitVoteAndAdvance(type){
  const v = state.day.vote;
  if(!v) return;
  const from = v.voters[v.cursor];
  const to = state.day.pending?.target ?? null;
  v.votes.push({ from, to });

  v.cursor += 1;
  state.day.pending = { target: null };
  state.ui.selectedSeat = null;

  if(v.cursor >= v.voters.length){
    v.stage = "RESULT";
    v.results = computeVoteResults(v.votes);
    state.flow.stepId = (type==="MAIN") ? "DAY:VOTE:RESULT" : "DAY:PK:RESULT";
  }else{
    state.flow.stepId = (type==="MAIN") ? "DAY:VOTE:CAST" : "DAY:PK:CAST";
  }
}

function computeVoteResults(votes){
  const map = new Map(); // to -> count
  votes.forEach(x=>{
    if(x.to == null) return;
    map.set(x.to, (map.get(x.to)||0) + 1);
  });
  const arr = Array.from(map.entries()).map(([seat,count])=>({ seat, count }));
  arr.sort((a,b)=> b.count - a.count || a.seat - b.seat);
  return { bySeat: arr };
}

function processVoteResultAndAdvance(type){
  const v = state.day.vote;
  if(!v) return;

  const top = v.results?.bySeat?.[0] || null;
  if(!top){
    // all abstain => no exile
    toast("全棄票：無人放逐");
    return dayToNight();
  }

  const bestCount = top.count;
  const tied = v.results.bySeat.filter(x=>x.count===bestCount).map(x=>x.seat);

  if(tied.length >= 2){
    v.tieCount += 1;

    if(type==="MAIN"){
      // go PK
      v.type = "PK";
      v.stage = "CAST";
      v.tiedSeats = tied;
      v.voters = state.players.filter(p=> p.alive && p.canVote !== false).map(p=>p.seat);
      v.cursor = 0;
      v.votes = [];
      v.results = null;
      state.day.pending = { target: null };
      state.flow.stepId = "DAY:PK:CAST";
      toast(`平票進 PK：${tied.join("、")} 號`);
      return;
    }

    // PK second tie => no exile
    toast("PK 第二次平票：無人放逐");
    return dayToNight();
  }

  // single top => exile
  const exileSeat = tied[0];
  handleExile(exileSeat);
}

function handleExile(seat){
  const p = state.players.find(x=>x.seat===seat);
  if(!p) return dayToNight();

  // Idiot: exiled by vote -> not die, lose voting right (revealed)
  if(p.roleId === "idiot" && p.alive){
    p.canVote = false;      // ✅ 失去投票權
    // alive stays true
    toast(`白癡 ${seat}號 被放逐：不死亡，但失去投票權`);
    // after exile effects done
    if(checkWin()) return;
    return dayToNight();
  }

  // normal exile death
  p.alive = false;

  // Hunter exiled -> prompt shoot
  if(p.roleId === "hunter"){
    state.day.afterExile = {
      type: "HUNTER_EXILE",
      shooterSeat: seat,
      stage: "PROMPT",
      target: null
    };
    state.flow.stepId = "DAY:AFTER_EXILE:HUNTER_PROMPT";
    toast(`獵人 ${seat}號 被放逐：是否開槍？`);
    return;
  }

  toast(`${seat}號 被放逐`);
  if(checkWin()) return;
  dayToNight();
}

function finalizeAfterExile(){
  state.day.afterExile = null;
  if(checkWin()) return;
  dayToNight();
}

function doHunterShot(kind){
  const after = state.day.afterExile;
  if(!after) return finalizeAfterExile();

  const shooter = after.shooterSeat;
  const targetSeat = after.target;

  if(!targetSeat) return toast("請先選目標");
  if(targetSeat === shooter) return toast("不能射自己");

  const target = state.players.find(p=>p.seat===targetSeat);
  if(!target || !target.alive) return toast("目標已死亡，請重選");

  target.alive = false;
  toast(`💥 獵人 ${shooter}號 開槍帶走 ${targetSeat}號`);

  state.day.afterExile = null;

  if(checkWin()) return;
  // after shot: continue day end -> night
  state.flow.stepId = "DAY:D1";
  dayToNight();
}

/* -------------------------
   Day -> Night
------------------------- */
function dayToNight(){
  // next round
  state.flow.round += 1;
  state.night.round = state.flow.round;
  enterNight();
}

/* -------------------------
   Win check
------------------------- */
function checkWin(){
  const alive = state.players.filter(p=>p.alive);

  const wolves = alive.filter(p=> ROLE[p.roleId]?.camp === "wolf").length;
  const goods = alive.filter(p=> ROLE[p.roleId]?.camp === "good").length;

  const gods = alive.filter(p=> ROLE[p.roleId]?.camp === "good" && ROLE[p.roleId]?.isGod).length;
  const villagers = alive.filter(p=> p.roleId === "villager").length;

  // good priority
  if(wolves === 0){
    endGame("✅ 好人勝利（狼人全滅）");
    return true;
  }

  const mode = state.config.winMode || "edge";
  if(mode === "city"){
    if(wolves >= goods){
      endGame("🐺 狼人勝利（屠城：狼人數 ≥ 好人數）");
      return true;
    }
  }else{ // edge
    if(gods === 0 || villagers === 0){
      endGame("🐺 狼人勝利（屠邊：神全死 或 民全死）");
      return true;
    }
  }

  return false;
}

function endGame(msg){
  state.flow.phase = "END";
  state.flow.stepId = "END";
  promptTitle.textContent = "遊戲結束";
  promptText.textContent = msg;
  promptFoot.textContent = "可在設定中按「重置本局」重新開始。";
}

/* -------------------------
   Seat interactions
------------------------- */
function onSeatClick(seat){
  const phase = state.flow.phase;
  const step = state.flow.stepId;

  // SETUP:A1 choose count via special “virtual buttons” rendered in prompt area
  // (we render count buttons inside promptText; click handled by data attributes, not seats)

  // SETUP:A3: reveal on long press (handled in renderSeat)
  if(phase === "SETUP" && step === "SETUP:A3"){
    // tap = reopen reveal
    showRole(seat);
    return;
  }

  // NIGHT selection
  if(phase === "NIGHT"){
    const cur = getNightCursor();
    if(cur.kind !== "STEP") return;

    if(cur.stepId === "wolf"){
      state.flow.pending = state.flow.pending || {};
      // allow none: tap same seat again to clear
      if(state.flow.pending.wolfKill === seat){
        state.flow.pending.wolfKill = null;
        state.ui.selectedSeat = null;
      }else{
        state.flow.pending.wolfKill = seat;
        state.ui.selectedSeat = seat;
      }
      saveAndRender();
      return;
    }

    if(cur.stepId === "seer"){
      state.flow.pending = state.flow.pending || {};
      state.flow.pending.seerCheck = seat;
      state.ui.selectedSeat = seat;
      saveAndRender();
      return;
    }

    if(cur.stepId === "witch"){
      const r = state.night.round;
      const log = state.night.logByRound[r];
      const wolfKill = log.wolfKill;

      state.flow.pending = state.flow.pending || {};

      // if antidote unused and wolfKill exists, clicking wolfKill = save
      if(wolfKill && seat === wolfKill && !state.witch.usedAntidote){
        // toggle save
        if(state.flow.pending.witchSave === seat){
          state.flow.pending.witchSave = null;
        }else{
          state.flow.pending.witchSave = seat;
          state.flow.pending.witchPoison = null; //互斥
        }
        state.ui.selectedSeat = seat;
        saveAndRender();
        return;
      }

      // else poison (if poison unused)
      if(!state.witch.usedPoison){
        if(state.flow.pending.witchPoison === seat){
          state.flow.pending.witchPoison = null;
        }else{
          state.flow.pending.witchPoison = seat;
          state.flow.pending.witchSave = null; //互斥
        }
        state.ui.selectedSeat = seat;
        saveAndRender();
        return;
      }

      toast("毒藥已用完");
      return;
    }
  }

  // DAY voting / hunter pick
  if(phase === "DAY"){
    if(step === "DAY:VOTE:CAST" || step === "DAY:PK:CAST"){
      // choose target (must be alive)
      const t = state.players.find(p=>p.seat===seat);
      if(!t || !t.alive) return toast("不能投已死亡");
      state.day.pending = { target: seat };
      state.ui.selectedSeat = seat;
      saveAndRender();
      return;
    }

    if(step === "DAY:AFTER_EXILE:HUNTER_PICK" || step === "DAY:DAYBREAK_HUNTER_PICK"){
      const target = state.players.find(p=>p.seat===seat);
      if(!target || !target.alive) return toast("目標已死亡，請重選");
      const shooter = state.day.afterExile?.shooterSeat;
      if(seat === shooter) return toast("不能射自己");
      state.day.afterExile.target = seat;
      state.ui.selectedSeat = seat;
      saveAndRender();
      return;
    }
  }
}

/* -------------------------
   Role reveal (setup)
------------------------- */
function showRole(seat){
  const p = state.players.find(x=>x.seat===seat);
  if(!p) return;

  // mark seen
  state.setup.seenSeats[String(seat)] = true;
  p.seen = true;

  // prompt shows role
  const info = ROLE[p.roleId] || { name:p.roleId, camp:"?" };
  promptTitle.textContent = `抽身分：${seat}號`;
  promptText.textContent = `你的身份是：${info.name}\n陣營：${info.camp === "wolf" ? "狼人" : "好人"}\n\n看完請把手機交回上帝。`;
  promptFoot.textContent = `已查看：${countSeen()}/${state.players.length}`;

  saveState();
  render(); // not full saveAndRender to avoid flicker
}

function countSeen(){
  return Object.keys(state.setup.seenSeats||{}).length;
}

/* -------------------------
   Render
------------------------- */
function render(){
  // timer
  syncTimer();
  renderTimerOnly();

  // top
  uiStatus.textContent = `${state.flow.phase} / R${state.flow.round} / ${state.flow.stepId}`;
  uiBoard.textContent = state.board?.title || boardTitleFromCount();

  // settings UI
  toggleGodView.checked = !!state.ui.godExpanded;
  togglePolice.checked = !!(state.board?.hasPolice ?? state.config.hasPolice);
  syncSegUI();

  renderPrompt();
  renderGodInfo();
  renderSeats();
  renderActions();
}

function boardTitleFromCount(){
  if(!state.config.playersCount) return "—";
  if(state.config.playersCount===9) return "9 人官方標準局";
  if(state.config.playersCount===10) return "10 人官方標準局";
  return "12 人官方標準局";
}

function renderPrompt(){
  const phase = state.flow.phase;
  const step = state.flow.stepId;

  if(phase === "SETUP"){
    if(step === "SETUP:A1"){
      promptTitle.textContent = "選擇人數";
      promptText.innerHTML =
        `請選擇人數：\n\n` +
        `<div class="row" style="gap:8px; margin-top:8px;">
          <button class="btn ghost" id="pick9" style="flex:1;">9人</button>
          <button class="btn ghost" id="pick10" style="flex:1;">10人</button>
          <button class="btn ghost" id="pick12" style="flex:1;">12人</button>
        </div>\n\n` +
        `已選：${state.config.playersCount ? state.config.playersCount+"人" : "（未選）"}`;

      // wire count buttons
      setTimeout(()=>{
        document.getElementById("pick9")?.addEventListener("click", ()=> pickCount(9));
        document.getElementById("pick10")?.addEventListener("click", ()=> pickCount(10));
        document.getElementById("pick12")?.addEventListener("click", ()=> pickCount(12));
      }, 0);

      promptFoot.textContent = "選好後按「下一步」。";
      return;
    }

    if(step === "SETUP:A2"){
      promptTitle.textContent = "載入板子";
      promptText.textContent =
        `已選：${state.config.playersCount}人\n` +
        `請在下方選擇板子（可選板子）\n` +
        `選好後按「下一步」進入抽身分。`;
      promptFoot.textContent = "若沒選板子，會自動使用官方板子。";
      return;
    }

    if(step === "SETUP:A3"){
      promptTitle.textContent = "抽身分";
      promptText.textContent =
        "請大家依序查看身份。看完請把手機交回上帝。\n\n" +
        "操作：長按 0.3 秒翻牌；也可以點座位重看。\n\n" +
        `已查看：${countSeen()} / ${state.players.length}（全部看完才能進夜晚）`;
      promptFoot.textContent = "";
      return;
    }
  }

  if(phase === "NIGHT"){
    const cur = getNightCursor();
    if(cur.kind === "N0"){
      promptTitle.textContent = "天黑";
      promptText.textContent = "天黑請閉眼。所有人請保持安靜。\n\n按「下一步」開始夜晚流程。";
      promptFoot.textContent = "";
      return;
    }
    if(cur.kind === "STEP"){
      const stepObj = state.night.steps[state.night.stepIndex];
      if(stepObj?.id === "wolf"){
        promptTitle.textContent = "狼人";
        promptText.textContent = "狼人請睜眼，請選擇要刀的座位（可空刀：再點一次取消）。";
        promptFoot.textContent = state.flow.pending?.wolfKill ? `目前刀口：${state.flow.pending.wolfKill}號` : "目前：空刀";
        return;
      }
      if(stepObj?.id === "seer"){
        promptTitle.textContent = "預言家";
        promptText.textContent = "預言家請睜眼，請選擇要查驗的座位。";
        const seat = state.flow.pending?.seerCheck;
        if(seat){
          const t = state.players.find(p=>p.seat===seat);
          const camp = t ? ROLE[t.roleId]?.camp : null;
          promptFoot.textContent = `🔮 查驗 ${seat}號 → ${camp==="wolf" ? "狼人" : "好人"}`;
        }else{
          promptFoot.textContent = "尚未選擇查驗目標";
        }
        return;
      }
      if(stepObj?.id === "witch"){
        promptTitle.textContent = "女巫";
        const r = state.night.round;
        const log = state.night.logByRound[r];
        const wolfKill = log.wolfKill;

        let lines = [];
        if(!state.witch.usedAntidote && wolfKill){
          lines.push(`今晚刀口：${wolfKill}號（點刀口=救）`);
        }else{
          lines.push(`今晚刀口：${wolfKill ? wolfKill+"號" : "（無）"}（解藥已用或空刀則不提供救）`);
        }
        lines.push(`解藥：${state.witch.usedAntidote ? "已用" : "未用"}`);
        lines.push(`毒藥：${state.witch.usedPoison ? "已用" : "未用"}`);
        lines.push("");
        lines.push("操作：");
        lines.push("• 點刀口＝救（若解藥未用）");
        lines.push("• 點其他人＝毒（若毒藥未用）");
        lines.push("• 直接按下一步＝不使用");

        promptText.textContent = lines.join("\n");

        const ps = state.flow.pending || {};
        if(ps.witchSave){
          promptFoot.textContent = `本晚：使用解藥救 ${ps.witchSave}號`;
        }else if(ps.witchPoison){
          promptFoot.textContent = `本晚：使用毒藥毒 ${ps.witchPoison}號`;
        }else{
          promptFoot.textContent = "本晚：不使用藥";
        }
        return;
      }
    }

    if(cur.kind === "RESOLVE"){
      promptTitle.textContent = "夜晚結算";
      promptText.textContent = "系統結算中…（狼刀/女巫救/毒）";
      promptFoot.textContent = "";
      return;
    }

    if(cur.kind === "ANNOUNCE"){
      const r = state.night.round;
      const log = state.night.logByRound[r];
      promptTitle.textContent = "天亮公告";
      if(!log || !log.deaths) {
        promptText.textContent = "（無資料）";
      } else {
        promptText.textContent = log.deaths.length ? `昨晚死亡：${log.deaths.join("、")}號` : "平安夜（無人死亡）";
      }
      promptFoot.textContent = "按下一步進入白天流程。";
      return;
    }
  }

  if(phase === "DAY"){
    if(step === "DAY:D1"){
      promptTitle.textContent = "白天";
      promptText.textContent = "白天開始：可先發言，再按「下一步」進入投票。";
      promptFoot.textContent = "";
      return;
    }

    // vote cast
    if(step === "DAY:VOTE:CAST" || step === "DAY:PK:CAST"){
      const v = state.day.vote;
      const from = v?.voters?.[v.cursor];
      promptTitle.textContent = (step==="DAY:PK:CAST") ? "PK 投票" : "投票";
      promptText.textContent =
        `輪到 ${from}號 投票。\n\n`+
        `點座位選要投的人；按取消=棄票。`;

      promptFoot.textContent = state.day.pending?.target ? `目前選擇：投 ${state.day.pending.target}號` : "尚未選擇";
      return;
    }

    // result
    if(step === "DAY:VOTE:RESULT" || step === "DAY:PK:RESULT"){
      const v = state.day.vote;
      const lines = [];
      lines.push("投票明細：");
      (v.votes||[]).forEach(x=>{
        lines.push(`${x.from}號 → ${x.to==null ? "棄票" : x.to+"號"}`);
      });
      lines.push("");
      lines.push("票數統計：");
      const by = v.results?.bySeat || [];
      if(by.length===0) lines.push("（皆棄票）");
      by.forEach(x=> lines.push(`${x.seat}號：${x.count}票`));

      promptTitle.textContent = (step==="DAY:PK:RESULT") ? "PK 結算" : "結算";
      promptText.textContent = lines.join("\n");
      promptFoot.textContent = "按下一步處理平票/放逐。";
      return;
    }

    // hunter prompts
    if(step === "DAY:AFTER_EXILE:HUNTER_PROMPT"){
      const s = state.day.afterExile?.shooterSeat;
      promptTitle.textContent = "獵人技能（放逐）";
      promptText.textContent = `獵人 ${s}號 被放逐。\n是否要開槍？`;
      promptFoot.textContent = "按「下一步」=開槍；按「取消」=不開槍";
      return;
    }
    if(step === "DAY:AFTER_EXILE:HUNTER_PICK"){
      const s = state.day.afterExile?.shooterSeat;
      promptTitle.textContent = "獵人開槍";
      promptText.textContent = `獵人 ${s}號 請選擇要射擊的目標。`;
      promptFoot.textContent = state.day.afterExile?.target ? `目前：射 ${state.day.afterExile.target}號` : "尚未選擇目標";
      return;
    }

    if(step === "DAY:DAYBREAK_HUNTER_PROMPT"){
      const s = state.day.afterExile?.shooterSeat;
      promptTitle.textContent = "天亮：獵人技能";
      promptText.textContent = `獵人 ${s}號 昨晚被狼刀死亡。\n是否在宣布死訊時開槍？\n（被毒死不能開槍，本局已鎖）`;
      promptFoot.textContent = "按「下一步」=開槍；按「取消」=不開槍";
      return;
    }
    if(step === "DAY:DAYBREAK_HUNTER_PICK"){
      const s = state.day.afterExile?.shooterSeat;
      promptTitle.textContent = "天亮：獵人開槍";
      promptText.textContent = `獵人 ${s}號 請選擇要射擊的目標。`;
      promptFoot.textContent = state.day.afterExile?.target ? `目前：射 ${state.day.afterExile.target}號` : "尚未選擇目標";
      return;
    }
  }

  if(phase === "END"){
    // endGame already filled prompt
    return;
  }
}

function pickCount(n){
  state.config.playersCount = n;

  // set default board id
  state.config.boardId = (n===9) ? "official-9" : (n===10) ? "official-10" : "official-12";
  // preload board (so board picker list shows + also seats init)
  applyBoardByPath(`./boards/${state.config.boardId}.json`, state.config.boardId).then(()=>{
    state.flow.stepId = "SETUP:A2";
    saveAndRender();
  });
}

function renderGodInfo(){
  const lines = [];
  lines.push(`選擇人數後會自動載入板子。`);
  if(state.setup.rolesAssigned){
    const unseen = state.players.filter(p=> !state.setup.seenSeats[String(p.seat)]).map(p=>p.seat);
    lines.push(`抽身分：已分配`);
    lines.push(`未查看：${unseen.length ? unseen.join("、") : "（無）"}`);
  }else{
    lines.push(`抽身分：尚未分配`);
  }

  // night info preview
  if(state.flow.phase==="NIGHT"){
    const r = state.night.round;
    const log = state.night.logByRound[r];
    if(log){
      lines.push("");
      lines.push(`夜晚紀錄（R${r}）：`);
      lines.push(`狼刀：${log.wolfKill || "空刀"}`);
      lines.push(`查驗：${log.seerCheck ? `${log.seerCheck}號 → ${log.seerResult}` : "—"}`);
      lines.push(`女巫救：${log.witchSave || "—"}`);
      lines.push(`女巫毒：${log.witchPoison || "—"}`);
    }
  }

  godText.textContent = lines.join("\n");
}

function renderSeats(){
  seatsGrid.innerHTML = "";

  state.players.forEach(p=>{
    const seat = document.createElement("div");
    seat.className = "seat" + (!p.alive ? " dead" : "") + (state.ui.selectedSeat===p.seat ? " selected" : "");
    seat.dataset.seat = String(p.seat);

    const top = document.createElement("div");
    top.className = "seat-top";

    const left = document.createElement("div");
    const num = document.createElement("div");
    num.className = "seat-num";
    num.textContent = `${p.seat}號`;
    const st = document.createElement("div");
    st.className = "seat-status";
    st.textContent = p.alive ? "存活" : "死亡";
    left.appendChild(num);
    left.appendChild(st);

    const right = document.createElement("div");
    right.className = "badge-wrap";

    // ✅ always show role + camp when godExpanded (including dead)
    if(state.ui.godExpanded && p.roleId){
      const roleName = ROLE[p.roleId]?.name || p.roleId;
      const camp = ROLE[p.roleId]?.camp === "wolf" ? "狼人" : "好人";

      const b1 = document.createElement("span");
      b1.className = "badge";
      b1.textContent = roleName;

      const b2 = document.createElement("span");
      b2.className = "badge " + (ROLE[p.roleId]?.camp === "wolf" ? "wolf" : "good");
      b2.textContent = camp;

      right.appendChild(b1);
      right.appendChild(b2);

      // extra: idiot voting disabled
      if(p.canVote === false){
        const b3 = document.createElement("span");
        b3.className = "badge";
        b3.textContent = "禁投票";
        right.appendChild(b3);
      }
    }else{
      // show seen marker during setup
      if(state.flow.phase==="SETUP"){
        const b = document.createElement("span");
        b.className = "badge";
        b.textContent = state.setup.seenSeats[String(p.seat)] ? "已看" : "未看";
        right.appendChild(b);
      }
    }

    top.appendChild(left);
    top.appendChild(right);

    seat.appendChild(top);

    // click
    seat.addEventListener("click", ()=> onSeatClick(p.seat));

    // long press to reveal role on setup A3
    if(state.flow.phase==="SETUP" && state.flow.stepId==="SETUP:A3"){
      addLongPress(seat, ()=> showRole(p.seat), 300);
    }

    seatsGrid.appendChild(seat);
  });
}

function addLongPress(el, fn, ms){
  let t = null;
  let moved = false;

  const clear = ()=>{ if(t){ clearTimeout(t); t=null; } };

  el.addEventListener("touchstart", (e)=>{
    moved = false;
    clear();
    t = setTimeout(()=>{ fn(); clear(); }, ms);
  }, {passive:true});

  el.addEventListener("touchmove", ()=>{ moved = true; clear(); }, {passive:true});
  el.addEventListener("touchend", ()=>{ clear(); }, {passive:true});
  el.addEventListener("touchcancel", ()=>{ clear(); }, {passive:true});

  // mouse fallback
  el.addEventListener("mousedown", ()=>{
    moved = false;
    clear();
    t = setTimeout(()=>{ fn(); clear(); }, ms);
  });
  el.addEventListener("mousemove", ()=>{ moved=true; clear(); });
  el.addEventListener("mouseup", clear);
  el.addEventListener("mouseleave", clear);
}

function renderActions(){
  const phase = state.flow.phase;
  const step = state.flow.stepId;

  btnPrimary.disabled = false;
  btnCancel.disabled = false;

  if(phase==="SETUP"){
    if(step==="SETUP:A1"){
      btnPrimary.textContent = "下一步";
      btnCancel.textContent = "取消";
      return;
    }
    if(step==="SETUP:A2"){
      btnPrimary.textContent = "進入抽身分";
      btnCancel.textContent = "取消";
      return;
    }
    if(step==="SETUP:A3"){
      btnPrimary.textContent = "確認進夜晚";
      btnPrimary.disabled = !allSeen();
      btnCancel.textContent = "取消";
      return;
    }
  }

  if(phase==="NIGHT"){
    const cur = getNightCursor();
    if(cur.kind==="N0"){
      btnPrimary.textContent = "開始夜晚";
      btnCancel.textContent = "取消";
      return;
    }
    if(cur.kind==="STEP"){
      const stepObj = state.night.steps[state.night.stepIndex];
      btnPrimary.textContent = "下一步";
      btnCancel.textContent = "取消";
      // seer requires pick
      if(stepObj?.id==="seer"){
        btnPrimary.disabled = !state.flow.pending?.seerCheck;
      }
      // witch: always can next
      return;
    }
    if(cur.kind==="RESOLVE"){
      btnPrimary.textContent = "完成結算";
      btnCancel.textContent = "取消";
      return;
    }
    if(cur.kind==="ANNOUNCE"){
      btnPrimary.textContent = "進入白天";
      btnCancel.textContent = "取消";
      return;
    }
  }

  if(phase==="DAY"){
    if(step==="DAY:D1"){
      btnPrimary.textContent = "開始投票";
      btnCancel.textContent = "取消";
      return;
    }
    if(step==="DAY:VOTE:CAST" || step==="DAY:PK:CAST"){
      btnPrimary.textContent = "下一位投票";
      btnCancel.textContent = "棄票";
      return;
    }
    if(step==="DAY:VOTE:RESULT" || step==="DAY:PK:RESULT"){
      btnPrimary.textContent = "處理結果";
      btnCancel.textContent = "取消";
      return;
    }

    if(step==="DAY:AFTER_EXILE:HUNTER_PROMPT" || step==="DAY:DAYBREAK_HUNTER_PROMPT"){
      btnPrimary.textContent = "開槍";
      btnCancel.textContent = "不開槍";
      return;
    }
    if(step==="DAY:AFTER_EXILE:HUNTER_PICK" || step==="DAY:DAYBREAK_HUNTER_PICK"){
      btnPrimary.textContent = "確認射擊";
      btnPrimary.disabled = !state.day.afterExile?.target;
      btnCancel.textContent = "取消";
      return;
    }
  }

  if(phase==="END"){
    btnPrimary.textContent = "已結束";
    btnPrimary.disabled = true;
    btnCancel.textContent = "取消";
  }
}
