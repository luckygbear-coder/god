/* ================================
   Werewolf God Helper - v31 (FULL)
   - Single device (God) MVP for GitHub Pages
   - SETUP: A1 choose count, A2 load board, A3 reveal roles (tap / longpress)
   - NIGHT: rule-driven steps (wolf -> seer -> witch)
   - Witch: no popup, mutual exclusive (save OR poison), click cancel to clear
   - Resolve night deaths -> DAY announce (scrollable in prompt area)
   - Hunter: exiled -> can shoot; night killed by wolf -> shoot at day announcement; poisoned -> cannot shoot
   - Idiot: exiled first time -> not die, lose voting right (canVote=false)
   - Voting: per-voter logging, tally, PK, revote, second tie => no exile
   - Win condition: mode city(edge/city toggle). Edge = gods all dead OR villagers all dead => wolves win.
     City = wolves >= goodAlive => wolves win. Always wolves=0 => good win.
   - God view: show role+camp on ALL seats including dead.
   - Timer: embedded panel
   ================================ */

const STORAGE_KEY = "werewolf_state_v31";
const LONGPRESS_MS = 300;

/* ====== iOS anti-gesture ====== */
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
document.addEventListener("contextmenu", (e) => e.preventDefault());

/* ====== DOM (tolerant to missing) ====== */
const $ = (id) => document.getElementById(id);

const uiStatus = $("uiStatus");
const uiBoard = $("uiBoard");

const promptTitle = $("promptTitle");
const promptText  = $("promptText");
const promptFoot  = $("promptFoot");

const godText = $("godText");
const toggleGodView = $("toggleGodView");

const seatsGrid = $("seatsGrid");

const boardPickerCard = $("boardPickerCard");
const boardPickerHint = $("boardPickerHint");
const boardPicker = $("boardPicker");

const btnSettings = $("btnSettings");
const drawer = $("drawer");
const drawerBackdrop = $("drawerBackdrop");
const btnCloseDrawer = $("btnCloseDrawer");
const segEdge = $("segEdge");
const segCity = $("segCity");
const togglePolice = $("togglePolice");
const btnReset = $("btnReset");

const timerBig = $("timerBig");
const timerHint = $("timerHint");
const btnTimerStart = $("btnTimerStart");
const btnTimerPause = $("btnTimerPause");
const btnTimerReset = $("btnTimerReset");
const timerPresets = $("timerPresets");

const btnBack = $("btnBack");
const btnPrimary = $("btnPrimary");
const btnCancel = $("btnCancel");

/* ====== Roles ====== */
const ROLE = {
  wolf:     { name: "狼人", camp: "wolf", isGod: false },
  seer:     { name: "預言家", camp: "good", isGod: true },
  witch:    { name: "女巫", camp: "good", isGod: true },
  hunter:   { name: "獵人", camp: "good", isGod: true },
  idiot:    { name: "白癡", camp: "good", isGod: true },
  villager: { name: "平民", camp: "good", isGod: false }
};

/* ====== Fallback boards (official) ====== */
const BOARD_FALLBACK = {
  "official-9": {
    id: "official-9",
    title: "9 人官方標準局",
    playersCount: 9,
    hasPolice: false,
    winCondition: { mode: "edge" },
    witchCanSelfSave: false,
    roles: [
      { roleId: "wolf", count: 3 },
      { roleId: "seer", count: 1 },
      { roleId: "witch", count: 1 },
      { roleId: "hunter", count: 1 },
      { roleId: "villager", count: 3 }
    ],
    nightSteps: [
      { id: "wolf",  name: "狼人",   wakeOrder: 1, alwaysShow: true, actionType: "pick", seatPickRule: { allowNone: true } },
      { id: "seer",  name: "預言家", wakeOrder: 2, alwaysShow: true, actionType: "pick" },
      { id: "witch", name: "女巫",   wakeOrder: 3, alwaysShow: true, actionType: "pick" }
    ]
  },
  "official-10": {
    id: "official-10",
    title: "10 人官方標準局",
    playersCount: 10,
    hasPolice: false,
    winCondition: { mode: "edge" },
    witchCanSelfSave: false,
    roles: [
      { roleId: "wolf", count: 3 },
      { roleId: "seer", count: 1 },
      { roleId: "witch", count: 1 },
      { roleId: "hunter", count: 1 },
      { roleId: "villager", count: 4 }
    ],
    nightSteps: [
      { id: "wolf",  name: "狼人",   wakeOrder: 1, alwaysShow: true, actionType: "pick", seatPickRule: { allowNone: true } },
      { id: "seer",  name: "預言家", wakeOrder: 2, alwaysShow: true, actionType: "pick" },
      { id: "witch", name: "女巫",   wakeOrder: 3, alwaysShow: true, actionType: "pick" }
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
      { id: "wolf",  name: "狼人",   wakeOrder: 1, alwaysShow: true, actionType: "pick", seatPickRule: { allowNone: true } },
      { id: "seer",  name: "預言家", wakeOrder: 2, alwaysShow: true, actionType: "pick" },
      { id: "witch", name: "女巫",   wakeOrder: 3, alwaysShow: true, actionType: "pick" }
    ]
  }
};

/* ====== State ====== */
let state = loadState() || makeInitialState();
let toastTimer = null;

/* ====== Service Worker ====== */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  });
}

/* ====== Init ====== */
wireUI();
render();
renderBoardPicker();

/* ================================
   State + Storage
   ================================ */
function makeInitialState(){
  return {
    version: 31,
    config: {
      playersCount: null,
      boardId: null,
      winMode: "edge",
      hasPolice: false
    },
    board: null,

    players: [], // {seat, roleId, alive, canVote, idiotRevealed, seen}

    flow: { phase: "SETUP", round: 1, stepId: "SETUP:A1" },

    setup: { rolesAssigned: false, seenSeats: {} },

    night: {
      round: 1,
      stepIndex: 0,
      steps: [],
      pending: {},     // per-step pending actions
      logByRound: {},  // round -> { wolf:{target}, seer:{seat,result}, witch:{save,poison} }
      resolvedByRound: {} // round -> { deaths:[{seat, reason}], hunterMayShootSeat? }
    },

    day: {
      round: 1,
      announcement: null,      // {title, lines[], deaths[]}
      vote: null,              // voting state
      hunterShoot: null,       // {fromSeat, allowed, reason, pickedTarget}
      end: null                // {winner, reason}
    },

    witch: { usedAntidote:false, usedPoison:false },

    ui: {
      godExpanded: false,
      selectedSeat: null,
      revealSeat: null, // for setup A3
      scrollTop: 0
    },

    timer: { totalSec: 120, remainSec: 120, running:false, lastTs: 0 }
  };
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){
    return null;
  }
}
function saveState(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){}
}
function saveAndRender(){
  saveState();
  render();
  renderBoardPicker();
}

/* ================================
   UI wiring
   ================================ */
function wireUI(){
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

  // MVP: 上一步保持可用（用簡單 history 會很長；我們用「安全退回」）
  btnBack?.addEventListener("click", ()=>{
    safeBack();
  });

  btnCancel?.addEventListener("click", onCancel);
  btnPrimary?.addEventListener("click", onPrimary);

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

/* ================================
   Toast
   ================================ */
function toast(msg){
  if(!promptFoot) return;
  clearTimeout(toastTimer);
  promptFoot.textContent = msg;
  toastTimer = setTimeout(()=>{ promptFoot.textContent = ""; }, 1600);
}

/* ================================
   Timer (embedded)
   ================================ */
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
  if(state.timer.remainSec <= 0) state.timer.remainSec = state.timer.totalSec || 120;
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
  if(timerBig) timerBig.textContent = formatMMSS(state.timer.remainSec);
  if(timerHint) timerHint.textContent = state.timer.running ? "計時中…" : "點選時間或按「開始」。";
}

/* ================================
   Board catalog / picker
   ================================ */
let boardCatalog = null;

async function loadBoardCatalog(){
  if(boardCatalog) return boardCatalog;
  try{
    const r = await fetch("./boards/index.json", { cache: "no-store" });
    if(!r.ok) throw new Error("index missing");
    boardCatalog = await r.json();
    return boardCatalog;
  }catch(e){
    // Minimal fallback
    boardCatalog = {
      version: 1,
      boards: [
        { id:"official-9",  title:"9 人官方標準局",  playersCount:9,  path:"./boards/official-9.json",  tags:["官方"] },
        { id:"official-10", title:"10 人官方標準局", playersCount:10, path:"./boards/official-10.json", tags:["官方"] },
        { id:"official-12", title:"12 人官方標準局", playersCount:12, path:"./boards/official-12.json", tags:["官方"] }
      ]
    };
    return boardCatalog;
  }
}

function renderBoardPicker(){
  if(!boardPickerCard || !boardPickerHint || !boardPicker) return;
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
        // keep step at A2 if still there
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
    board = BOARD_FALLBACK[id] || BOARD_FALLBACK["official-12"];
  }

  // Apply
  state.board = board;
  state.config.playersCount = board.playersCount;
  state.config.hasPolice = !!board.hasPolice;
  state.config.winMode = board.winCondition?.mode || state.config.winMode;

  // Reset core state for new board
  state.players = Array.from({length: board.playersCount}).map((_,i)=>({
    seat: i+1,
    roleId: null,
    alive: true,
    canVote: true,
    idiotRevealed: false,
    seen: false
  }));

  state.setup.rolesAssigned = false;
  state.setup.seenSeats = {};
  state.ui.revealSeat = null;
  state.ui.selectedSeat = null;

  state.flow.phase = "SETUP";
  state.flow.round = 1;
  state.flow.stepId = "SETUP:A2";

  state.night = {
    round: 1,
    stepIndex: 0,
    steps: [],
    pending: {},
    logByRound: {},
    resolvedByRound: {}
  };

  state.day = {
    round: 1,
    announcement: null,
    vote: null,
    hunterShoot: null,
    end: null
  };

  state.witch = { usedAntidote:false, usedPoison:false };
}

/* ================================
   Drawer
   ================================ */
function openDrawer(){
  drawerBackdrop?.classList.remove("hidden");
  drawer?.classList.remove("hidden");
  if(togglePolice) togglePolice.checked = !!state.config.hasPolice;
  syncSegUI();
}
function closeDrawer(){
  drawerBackdrop?.classList.add("hidden");
  drawer?.classList.add("hidden");
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
  segEdge?.classList.toggle("active", state.config.winMode === "edge");
  segCity?.classList.toggle("active", state.config.winMode === "city");
}

/* ================================
   Flow actions
   ================================ */
function onPrimary(){
  if(state.flow.phase === "END"){
    toast("本局已結束，可按設定→重置開新局");
    return;
  }

  // If hunter shooting pending, primary acts as confirm shot/no-shot
  if(state.flow.phase === "DAY" && state.flow.stepId === "DAY:HS"){
    confirmHunterShoot();
    return;
  }

  // Voting steps handled by primary
  if(state.flow.phase === "DAY" && state.flow.stepId === "DAY:VOTE"){
    confirmVoteForCurrentVoter();
    return;
  }
  if(state.flow.phase === "DAY" && state.flow.stepId === "DAY:PK"){
    confirmPKVoteForCurrentVoter();
    return;
  }

  // Setup / Night / Day transitions
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
      if(!state.board){
        const id = state.config.playersCount===9 ? "official-9" : state.config.playersCount===10 ? "official-10" : "official-12";
        applyBoardByPath(`./boards/${id}.json`, id).then(()=> saveAndRender());
        return;
      }
      if(!state.setup.rolesAssigned) assignRoles();
      state.flow.stepId = "SETUP:A3";
      state.ui.revealSeat = null;
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
    // N0 -> start steps
    if(step === "NIGHT:N0"){
      state.flow.stepId = "NIGHT:STEP";
      state.night.stepIndex = 0;
      saveAndRender();
      return;
    }

    if(step === "NIGHT:STEP"){
      // commit current step, go next
      commitNightStepAndNext();
      saveAndRender();
      return;
    }

    if(step === "NIGHT:RESOLVE"){
      // auto resolve already done, go day announce
      enterDayAnnouncement();
      saveAndRender();
      return;
    }
  }

  if(phase === "DAY"){
    if(step === "DAY:D1"){
      // if hunter shoot exists, branch; else proceed to talk
      if(shouldEnterHunterShoot()){
        state.flow.stepId = "DAY:HS";
        saveAndRender();
        return;
      }
      state.flow.stepId = "DAY:D2";
      saveAndRender();
      return;
    }

    if(step === "DAY:D2"){
      // go to vote
      startVoting(false);
      saveAndRender();
      return;
    }

    if(step === "DAY:EXILE_DONE"){
      // after exile resolved, check win, then next night
      const ended = checkAndMaybeEnd();
      if(ended){
        saveAndRender();
        return;
      }
      enterNight(true);
      saveAndRender();
      return;
    }

    if(step === "DAY:NO_EXILE_DONE"){
      const ended = checkAndMaybeEnd();
      if(ended){
        saveAndRender();
        return;
      }
      enterNight(true);
      saveAndRender();
      return;
    }
  }

  toast("尚未支援的操作");
}

function onCancel(){
  const phase = state.flow.phase;
  const step = state.flow.stepId;

  // Setup A3: close reveal
  if(phase==="SETUP" && step==="SETUP:A3"){
    state.ui.revealSeat = null;
    saveAndRender();
    return;
  }

  // Night: clear selection/pending for current step
  if(phase==="NIGHT" && step==="NIGHT:STEP"){
    clearNightPendingForCurrentStep();
    saveAndRender();
    return;
  }

  // Day vote: allow abstain on confirm? cancel clears current selection
  if(phase==="DAY" && (step==="DAY:VOTE" || step==="DAY:PK")){
    state.ui.selectedSeat = null;
    saveAndRender();
    return;
  }

  // Hunter shoot: cancel means "不開槍"
  if(phase==="DAY" && step==="DAY:HS"){
    state.day.hunterShoot.pickedTarget = null;
    confirmHunterShoot(true); // force no-shot
    return;
  }

  toast("已取消");
}

/* MVP safe back: go to previous major step without breaking logs */
function safeBack(){
  const { phase, stepId } = state.flow;

  if(phase==="SETUP"){
    if(stepId==="SETUP:A2"){ state.flow.stepId="SETUP:A1"; saveAndRender(); return; }
    if(stepId==="SETUP:A3"){ state.flow.stepId="SETUP:A2"; state.ui.revealSeat=null; saveAndRender(); return; }
    toast("已在第一步");
    return;
  }

  if(phase==="NIGHT"){
    toast("夜晚不建議上一步（避免資料錯亂）");
    return;
  }

  if(phase==="DAY"){
    toast("白天不建議上一步（避免投票/公告錯亂）");
    return;
  }
}

/* ================================
   Setup
   ================================ */
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
    p.canVote = true;
    p.idiotRevealed = false;
    p.seen = false;
  });

  state.setup.rolesAssigned = true;
  state.setup.seenSeats = {};
}

function allSeen(){
  return state.players.every(p=> !!state.setup.seenSeats[String(p.seat)]);
}
function countSeen(){
  return Object.keys(state.setup.seenSeats||{}).length;
}

function shuffle(a){
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
}

/* ================================
   Night flow
   ================================ */
function enterNight(isNextRound=false){
  state.flow.phase = "NIGHT";
  state.flow.stepId = "NIGHT:N0";
  if(isNextRound){
    state.night.round += 1;
    state.day.round = state.night.round;
  }

  // build steps from board
  const steps = (state.board?.nightSteps || [])
    .slice()
    .sort((a,b)=> (a.wakeOrder||0) - (b.wakeOrder||0));

  state.night.steps = steps;
  state.night.stepIndex = 0;
  state.night.pending = {};
  state.ui.selectedSeat = null;

  // ensure round logs container
  state.night.logByRound[String(state.night.round)] = state.night.logByRound[String(state.night.round)] || {};
}

function getCurrentNightStep(){
  const idx = state.night.stepIndex || 0;
  return state.night.steps[idx] || null;
}

function clearNightPendingForCurrentStep(){
  const s = getCurrentNightStep();
  if(!s) return;
  delete state.night.pending[s.id];
  state.ui.selectedSeat = null;
}

function commitNightStepAndNext(){
  const step = getCurrentNightStep();
  if(!step){
    // no steps? resolve directly
    state.flow.stepId = "NIGHT:RESOLVE";
    resolveNight();
    return;
  }

  // Always show step, but action may be locked if role dead
  const actor = findFirstByRole(step.id); // step ids are same as role ids for MVP
  const actorAlive = actor ? actor.alive : false;

  // Get pending
  const pending = state.night.pending[step.id] || {};

  const roundKey = String(state.night.round);
  const rlog = state.night.logByRound[roundKey] || (state.night.logByRound[roundKey] = {});

  if(step.id === "wolf"){
    // allow none
    if(actorAlive){
      rlog.wolf = { target: (pending.target ?? null) };
    }else{
      rlog.wolf = { target: null, note: "狼人已死/不存在（流程照唸）" };
    }
  }

  if(step.id === "seer"){
    if(actorAlive){
      const seat = pending.target ?? null;
      if(seat){
        const checked = state.players.find(p=>p.seat===seat);
        const isWolf = checked && ROLE[checked.roleId]?.camp === "wolf";
        rlog.seer = { seat, result: isWolf ? "狼人" : "好人" };
      }else{
        rlog.seer = { seat: null, result: null };
      }
    }else{
      rlog.seer = { seat: null, result: null, note: "預言家已死/不存在（流程照唸）" };
    }
  }

  if(step.id === "witch"){
    // witch rule-driven, mutual exclusive; if witch dead, still record no action
    if(!actorAlive){
      rlog.witch = { save: null, poison: null, note: "女巫已死/不存在（流程照唸）" };
    }else{
      const w = pending || {};
      rlog.witch = { save: w.save ?? null, poison: w.poison ?? null };

      // consume potions when actually used
      if(w.save){
        state.witch.usedAntidote = true;
      }
      if(w.poison){
        state.witch.usedPoison = true;
      }
    }
  }

  // advance step
  state.night.stepIndex += 1;
  state.ui.selectedSeat = null;

  if(state.night.stepIndex >= state.night.steps.length){
    state.flow.stepId = "NIGHT:RESOLVE";
    resolveNight();
  }
}

function resolveNight(){
  const roundKey = String(state.night.round);
  const rlog = state.night.logByRound[roundKey] || {};

  const deaths = [];
  const reasonMap = new Map(); // seat -> reason

  const wolfTarget = rlog.wolf?.target ?? null;
  const witchSave = rlog.witch?.save ?? null;
  const witchPoison = rlog.witch?.poison ?? null;

  // wolf kill (unless saved)
  if(wolfTarget && wolfTarget !== witchSave){
    reasonMap.set(wolfTarget, "wolf");
  }

  // poison kill always kills (even if also wolf)
  if(witchPoison){
    reasonMap.set(witchPoison, "poison");
  }

  // Build deaths list (exclude already dead)
  for(const [seat, reason] of reasonMap.entries()){
    const p = state.players.find(x=>x.seat===seat);
    if(p && p.alive){
      deaths.push({ seat, reason });
    }
  }

  // Determine if hunter can shoot at day announcement (night killed by wolf only)
  let hunterMayShootSeat = null;
  for(const d of deaths){
    const p = state.players.find(x=>x.seat===d.seat);
    if(p?.roleId === "hunter" && d.reason === "wolf"){
      hunterMayShootSeat = d.seat;
      break;
    }
  }

  state.night.resolvedByRound[roundKey] = { deaths, hunterMayShootSeat };

  // Prepare announcement (deaths not applied until DAY:D1 confirm)
  const lines = [];
  if(deaths.length === 0){
    lines.push("平安夜。");
  }else{
    lines.push(`死亡：${deaths.map(d=>`${d.seat}號`).join("、")}`);
  }
  state.day.announcement = {
    title: `天亮了（第 ${state.night.round} 夜）`,
    lines,
    deaths
  };

  // Apply deaths now (so board shows dead in day)
  applyDeaths(deaths);

  // Win check immediately after night deaths (but hunter may still shoot)
  // We delay final END until after announcement/hunter shot to match流程
}

/* ================================
   Day flow
   ================================ */
function enterDayAnnouncement(){
  state.flow.phase = "DAY";
  state.flow.stepId = "DAY:D1";
  state.ui.selectedSeat = null;

  // clear vote/hunter states
  state.day.vote = null;
  state.day.hunterShoot = null;

  // if announcement missing, build from last resolved
  if(!state.day.announcement){
    state.day.announcement = { title:"天亮了", lines:["（無資料）"], deaths:[] };
  }
}

function shouldEnterHunterShoot(){
  const roundKey = String(state.night.round);
  const res = state.night.resolvedByRound[roundKey];
  const seat = res?.hunterMayShootSeat || null;
  if(!seat) return false;

  // confirm hunter is still dead and not poisoned
  const p = state.players.find(x=>x.seat===seat);
  if(!p || p.alive) return false;

  // create hunter shoot state
  state.day.hunterShoot = {
    fromSeat: seat,
    allowed: true,
    reason: "night_wolf",
    pickedTarget: null
  };
  return true;
}

function confirmHunterShoot(forceNoShot=false){
  const hs = state.day.hunterShoot;
  if(!hs) {
    state.flow.stepId = "DAY:D2";
    saveAndRender();
    return;
  }

  if(forceNoShot || !hs.pickedTarget){
    // no shot
    state.day.hunterShoot = null;
    // proceed to talk
    state.flow.stepId = "DAY:D2";
    saveAndRender();
    return;
  }

  // shoot target (must be alive)
  const tgt = state.players.find(x=>x.seat===hs.pickedTarget);
  if(!tgt || !tgt.alive){
    toast("目標無效（必須選存活者）");
    return;
  }

  applyDeaths([{ seat: tgt.seat, reason: "hunter" }]);

  // clear hunter shoot
  state.day.hunterShoot = null;

  // check end after shot
  const ended = checkAndMaybeEnd();
  if(ended){
    saveAndRender();
    return;
  }

  state.flow.stepId = "DAY:D2";
  saveAndRender();
}

/* ================================
   Voting
   ================================ */
function startVoting(isPK){
  const voters = state.players
    .filter(p=> p.alive && p.canVote)
    .map(p=> p.seat);

  if(voters.length === 0){
    toast("沒有人可以投票");
    state.flow.stepId = "DAY:NO_EXILE_DONE";
    return;
  }

  state.day.vote = {
    isPK: !!isPK,
    voters,
    voterIndex: 0,
    currentTarget: null,
    log: [], // {voter, target}
    tally: null,
    pkCandidates: null,
    pkRound: 0
  };

  state.ui.selectedSeat = null;
  state.flow.stepId = isPK ? "DAY:PK" : "DAY:VOTE";
}

function currentVoterSeat(){
  const v = state.day.vote;
  if(!v) return null;
  return v.voters[v.voterIndex] || null;
}

function confirmVoteForCurrentVoter(){
  const v = state.day.vote;
  if(!v) return;

  const voter = currentVoterSeat();
  if(!voter) return;

  const target = state.ui.selectedSeat || null;

  // allow abstain by pressing primary without selection
  v.log.push({ voter, target });

  v.voterIndex += 1;
  state.ui.selectedSeat = null;

  if(v.voterIndex >= v.voters.length){
    // tally
    v.tally = buildTally(v.log, null); // all alive candidates
    const top = getTopCandidates(v.tally);

    if(top.length === 0){
      // nobody got votes => no exile
      state.flow.stepId = "DAY:NO_EXILE_DONE";
      return;
    }

    if(top.length === 1){
      // exile
      resolveExile(top[0].seat);
      return;
    }

    // tie => PK
    v.pkCandidates = top.map(x=>x.seat);
    v.pkRound = 1;
    startPKVoting(v.pkCandidates);
    return;
  }

  // continue next voter
}

function startPKVoting(candidates){
  // reset vote state for PK round
  const voters = state.players
    .filter(p=> p.alive && p.canVote)
    .map(p=> p.seat);

  state.day.vote = {
    isPK: true,
    voters,
    voterIndex: 0,
    currentTarget: null,
    log: [],
    tally: null,
    pkCandidates: candidates.slice(),
    pkRound: (state.day.vote?.pkRound || 1)
  };

  state.ui.selectedSeat = null;
  state.flow.stepId = "DAY:PK";
}

function confirmPKVoteForCurrentVoter(){
  const v = state.day.vote;
  if(!v) return;

  const voter = currentVoterSeat();
  if(!voter) return;

  const target = state.ui.selectedSeat || null;

  // PK vote: only allow candidates, otherwise treat as abstain
  if(target && !v.pkCandidates.includes(target)){
    toast("PK 只能投候選人（或不選＝棄票）");
    return;
  }

  v.log.push({ voter, target });
  v.voterIndex += 1;
  state.ui.selectedSeat = null;

  if(v.voterIndex >= v.voters.length){
    v.tally = buildTally(v.log, v.pkCandidates);
    const top = getTopCandidates(v.tally);

    if(top.length === 1){
      resolveExile(top[0].seat);
      return;
    }

    // still tie
    if(v.pkRound >= 2){
      // second tie => no exile
      state.flow.stepId = "DAY:NO_EXILE_DONE";
      return;
    }

    // PK revote round 2
    const cand = top.map(x=>x.seat);
    startPKVoting(cand);
    state.day.vote.pkRound = 2;
    return;
  }
}

function buildTally(log, restrictSeats){
  const map = new Map(); // seat->count
  // initialize restrictSeats
  if(Array.isArray(restrictSeats)){
    restrictSeats.forEach(s=> map.set(s, 0));
  }else{
    // all alive are valid candidates
    state.players.filter(p=>p.alive).forEach(p=> map.set(p.seat, 0));
  }

  for(const it of log){
    if(!it.target) continue;
    if(!map.has(it.target)) continue;
    map.set(it.target, (map.get(it.target) || 0) + 1);
  }

  // to array
  const arr = [];
  for(const [seat,count] of map.entries()){
    arr.push({ seat, count });
  }
  arr.sort((a,b)=> b.count - a.count || a.seat - b.seat);
  return arr;
}

function getTopCandidates(tallyArr){
  if(!tallyArr || tallyArr.length===0) return [];
  const max = tallyArr[0].count;
  if(max <= 0) return [];
  return tallyArr.filter(x=> x.count === max);
}

function resolveExile(seat){
  const p = state.players.find(x=>x.seat===seat);
  if(!p || !p.alive){
    state.flow.stepId = "DAY:EXILE_DONE";
    return;
  }

  // Idiot rule: first time exiled -> NOT die, lose vote right
  if(p.roleId === "idiot" && !p.idiotRevealed){
    p.idiotRevealed = true;
    p.canVote = false;
    // remains alive
    state.flow.stepId = "DAY:EXILE_DONE";
    toast("白癡被放逐：不死，但失去投票權");
    return;
  }

  // Normal exile death
  applyDeaths([{ seat, reason: "vote" }]);

  // Hunter: if exiled and not poisoned, can shoot immediately (per spec: 放逐後先提示是否開槍)
  if(p.roleId === "hunter"){
    // poisoned death cannot shoot
    // exile reason is vote => allowed
    state.day.hunterShoot = {
      fromSeat: seat,
      allowed: true,
      reason: "exiled",
      pickedTarget: null
    };
    state.flow.stepId = "DAY:HS";
    return;
  }

  state.flow.stepId = "DAY:EXILE_DONE";
}

/* ================================
   Death application
   ================================ */
function applyDeaths(deaths){
  for(const d of deaths){
    const p = state.players.find(x=>x.seat===d.seat);
    if(!p) continue;
    if(!p.alive) continue;
    p.alive = false;
    // dead still shows role in god view by design
  }

  // Special: if hunter died by poison, he cannot shoot (handled by checks)
  // Special: if idiot dies by other reasons (night/hunter), treat as normal death (no special)
}

/* ================================
   Win condition
   ================================ */
function countAliveBy(filterFn){
  return state.players.filter(p=>p.alive).filter(filterFn).length;
}

function isWolf(p){ return ROLE[p.roleId]?.camp === "wolf"; }
function isGood(p){ return ROLE[p.roleId]?.camp === "good"; }
function isGodRole(p){ return !!ROLE[p.roleId]?.isGod; }
function isVillagerRole(p){ return p.roleId === "villager"; }

function checkAndMaybeEnd(){
  const wolves = countAliveBy(isWolf);
  const goodAll = countAliveBy(isGood);

  // Good win priority: wolves all dead
  if(wolves === 0){
    endGame("好人勝", "狼人全滅");
    return true;
  }

  const mode = state.config.winMode || state.board?.winCondition?.mode || "edge";

  if(mode === "city"){
    // wolves >= good => wolves win
    if(wolves >= goodAll){
      endGame("狼人勝", "屠城：狼人數 ≥ 好人數");
      return true;
    }
    return false;
  }

  // edge: gods all dead OR villagers all dead => wolves win
  const godsAlive = state.players.filter(p=>p.alive && isGodRole(p)).length;
  const villagersAlive = state.players.filter(p=>p.alive && isVillagerRole(p)).length;

  if(godsAlive === 0){
    endGame("狼人勝", "屠邊：神全死");
    return true;
  }
  if(villagersAlive === 0){
    endGame("狼人勝", "屠邊：民全死");
    return true;
  }

  return false;
}

function endGame(winner, reason){
  state.flow.phase = "END";
  state.flow.stepId = "END";
  state.day.end = { winner, reason };
}

/* ================================
   Seat interactions
   ================================ */
function onSeatClick(seat){
  const phase = state.flow.phase;
  const step = state.flow.stepId;

  // Setup reveal
  if(phase==="SETUP" && step==="SETUP:A3"){
    revealRole(seat);
    return;
  }

  // Night step selection
  if(phase==="NIGHT" && step==="NIGHT:STEP"){
    handleNightSeatPick(seat);
    return;
  }

  // Day vote selection
  if(phase==="DAY" && (step==="DAY:VOTE" || step==="DAY:PK")){
    // only allow picking alive targets
    const p = state.players.find(x=>x.seat===seat);
    if(!p || !p.alive){
      toast("只能投存活者");
      return;
    }
    state.ui.selectedSeat = seat;
    saveAndRender();
    return;
  }

  // Hunter shoot selection
  if(phase==="DAY" && step==="DAY:HS"){
    const p = state.players.find(x=>x.seat===seat);
    if(!p || !p.alive){
      toast("只能選存活者");
      return;
    }
    state.day.hunterShoot.pickedTarget = seat;
    state.ui.selectedSeat = seat;
    saveAndRender();
    return;
  }
}

function revealRole(seat){
  const p = state.players.find(x=>x.seat===seat);
  if(!p) return;

  state.ui.revealSeat = seat;
  state.setup.seenSeats[String(seat)] = true;
  p.seen = true;
  saveAndRender();
}

function handleNightSeatPick(seat){
  const step = getCurrentNightStep();
  if(!step) return;

  const actor = findFirstByRole(step.id);
  const actorAlive = actor ? actor.alive : false;

  // if actor dead, no actions
  if(!actorAlive){
    toast(`${step.name}已死（流程照唸，不能操作）`);
    return;
  }

  const aliveTarget = state.players.find(p=>p.seat===seat && p.alive);
  if(!aliveTarget){
    toast("只能選存活者");
    return;
  }

  // step-specific rules
  if(step.id === "wolf"){
    // allow none; clicking seat sets target
    state.night.pending.wolf = state.night.pending.wolf || {};
    state.night.pending.wolf.target = seat;
    state.ui.selectedSeat = seat;
    saveAndRender();
    return;
  }

  if(step.id === "seer"){
    state.night.pending.seer = state.night.pending.seer || {};
    state.night.pending.seer.target = seat;
    state.ui.selectedSeat = seat;
    saveAndRender();
    return;
  }

  if(step.id === "witch"){
    // Witch: click knife target = save (if available), click other = poison (if available), mutual exclusive
    const roundKey = String(state.night.round);
    const rlog = state.night.logByRound[roundKey] || {};
    const wolfTarget = rlog.wolf?.target ?? null;

    state.night.pending.witch = state.night.pending.witch || { save:null, poison:null };

    // Decide save vs poison based on whether clicked seat == wolfTarget
    if(seat === wolfTarget){
      // save
      if(state.witch.usedAntidote){
        toast("解藥已用過（不能救）");
        return;
      }
      // self-save rule: if witch is victim and not allowed, block
      if(!state.board?.witchCanSelfSave){
        const witchSeat = findFirstByRole("witch")?.seat;
        if(witchSeat && wolfTarget === witchSeat){
          toast("本局規則：女巫不可自救");
          return;
        }
      }
      state.night.pending.witch.save = seat;
      state.night.pending.witch.poison = null;
      state.ui.selectedSeat = seat;
      saveAndRender();
      return;
    }

    // poison
    if(state.witch.usedPoison){
      toast("毒藥已用過（不能毒）");
      return;
    }
    state.night.pending.witch.poison = seat;
    state.night.pending.witch.save = null;
    state.ui.selectedSeat = seat;
    saveAndRender();
    return;
  }
}

function findFirstByRole(roleId){
  return state.players.find(p=>p.roleId===roleId) || null;
}

/* Long press helper */
function addLongPress(el, fn, ms){
  let t = null;
  const clear = ()=>{ if(t){ clearTimeout(t); t=null; } };

  el.addEventListener("touchstart", ()=>{
    clear();
    t = setTimeout(()=>{ fn(); clear(); }, ms);
  }, {passive:true});
  el.addEventListener("touchmove", clear, {passive:true});
  el.addEventListener("touchend", clear, {passive:true});
  el.addEventListener("touchcancel", clear, {passive:true});

  el.addEventListener("mousedown", ()=>{
    clear();
    t = setTimeout(()=>{ fn(); clear(); }, ms);
  });
  el.addEventListener("mouseup", clear);
  el.addEventListener("mouseleave", clear);
}

/* ================================
   Render
   ================================ */
function render(){
  syncTimer();
  renderTimerOnly();

  if(uiStatus) uiStatus.textContent = `${state.flow.phase} / R${state.flow.round} / ${state.flow.stepId}`;
  if(uiBoard) uiBoard.textContent = state.board?.title || boardTitleFromCount();

  if(toggleGodView) toggleGodView.checked = !!state.ui.godExpanded;
  if(togglePolice) togglePolice.checked = !!(state.board?.hasPolice ?? state.config.hasPolice);
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
  if(!promptTitle || !promptText || !promptFoot) return;

  const phase = state.flow.phase;
  const step = state.flow.stepId;

  // END
  if(phase==="END"){
    promptTitle.textContent = "遊戲結束";
    promptText.textContent = `${state.day.end?.winner || "—"}\n${state.day.end?.reason || ""}`;
    promptFoot.textContent = "可到設定→重置開始新局。";
    return;
  }

  // SETUP
  if(phase==="SETUP"){
    if(step==="SETUP:A1"){
      promptTitle.textContent = "選擇人數";
      promptText.innerHTML =
        `請選擇人數：\n\n` +
        `<div class="row" style="gap:8px; margin-top:8px;">
          <button class="btn ghost" id="pick9" style="flex:1;">9人</button>
          <button class="btn ghost" id="pick10" style="flex:1;">10人</button>
          <button class="btn ghost" id="pick12" style="flex:1;">12人</button>
        </div>\n\n` +
        `已選：${state.config.playersCount ? state.config.playersCount+"人" : "（未選）"}`;

      setTimeout(()=>{
        $("pick9")?.addEventListener("click", ()=> pickCount(9));
        $("pick10")?.addEventListener("click", ()=> pickCount(10));
        $("pick12")?.addEventListener("click", ()=> pickCount(12));
      }, 0);

      promptFoot.textContent = "選好後按「下一步」。";
      return;
    }

    if(step==="SETUP:A2"){
      promptTitle.textContent = "可選板子";
      promptText.textContent =
        `已選：${state.config.playersCount}人\n` +
        `請在上方「可選板子」區塊點選板子套用。\n\n` +
        `提示：\n` +
        `• 屠邊/屠城可在設定切換\n` +
        `• 上警可在設定開關（MVP）`;
      promptFoot.textContent = "套用後按「下一步」進入抽身分。";
      return;
    }

    if(step==="SETUP:A3"){
      if(state.ui.revealSeat){
        const p = state.players.find(x=>x.seat===state.ui.revealSeat);
        const info = p ? (ROLE[p.roleId] || { name:p.roleId, camp:"?" }) : null;
        promptTitle.textContent = `抽身分：${state.ui.revealSeat}號`;
        promptText.textContent =
          `你的身份是：${info?.name || "—"}\n` +
          `陣營：${info?.camp === "wolf" ? "狼人" : "好人"}\n\n` +
          `看完請把手機交回上帝。\n` +
          `（按「取消」可關閉身分畫面）`;
        promptFoot.textContent = `已查看：${countSeen()} / ${state.players.length}`;
        return;
      }

      promptTitle.textContent = "抽身分";
      promptText.textContent =
        "請大家依序查看身份。看完請把手機交回上帝。\n\n" +
        `操作：長按 ${LONGPRESS_MS/1000} 秒翻牌；或點座位重看。\n\n` +
        `已查看：${countSeen()} / ${state.players.length}（全部看完才能進夜晚）`;
      promptFoot.textContent = "";
      return;
    }
  }

  // NIGHT
  if(phase==="NIGHT"){
    if(step==="NIGHT:N0"){
      promptTitle.textContent = "天黑請閉眼";
      promptText.textContent = "天黑請閉眼，所有人保持安靜。\n\n按「下一步」開始夜晚流程。";
      promptFoot.textContent = "";
      return;
    }

    if(step==="NIGHT:STEP"){
      const s = getCurrentNightStep();
      if(!s){
        promptTitle.textContent = "夜晚流程";
        promptText.textContent = "（本局沒有夜晚流程）";
        promptFoot.textContent = "按下一步結算。";
        return;
      }

      const actor = findFirstByRole(s.id);
      const actorAlive = actor ? actor.alive : false;

      promptTitle.textContent = `${s.name}行動`;
      let text = "";

      if(s.id==="wolf"){
        text += "狼人請睜眼，請選擇今晚要刀的座位。\n";
        text += "• 點座位＝刀\n";
        text += "• 可空刀：直接按「下一步」\n";
        if(!actorAlive) text += "\n（狼人已死/不存在，本步照唸但無行動）";
      }

      if(s.id==="seer"){
        text += "預言家請睜眼，請選擇要查驗的座位。\n";
        text += "• 點座位＝查驗\n";
        text += "• 不查驗：直接按「下一步」\n";
        if(!actorAlive) text += "\n（預言家已死/不存在，本步照唸但無行動）";
      }

      if(s.id==="witch"){
        const roundKey = String(state.night.round);
        const rlog = state.night.logByRound[roundKey] || {};
        const wolfTarget = rlog.wolf?.target ?? null;

        text += "女巫請睜眼。\n";
        if(state.witch.usedAntidote){
          text += "• 解藥：已用過（本晚不顯示刀口）\n";
        }else{
          text += `• 刀口：${wolfTarget ? `${wolfTarget}號` : "（本晚可能空刀/未記錄）"}\n`;
          text += "  - 點刀口座位＝救\n";
        }
        text += state.witch.usedPoison ? "• 毒藥：已用過\n" : "• 毒藥：可用（點其他座位＝毒）\n";
        text += "• 救/毒互斥；按「取消」可清除本步選擇；按「下一步」＝本晚不用\n";
        if(!actorAlive) text += "\n（女巫已死/不存在，本步照唸但無行動）";
      }

      // God-only quick info
      if(state.ui.godExpanded && s.id==="seer"){
        const pending = state.night.pending.seer?.target ?? null;
        if(pending){
          const checked = state.players.find(p=>p.seat===pending);
          const isWolfCamp = checked && ROLE[checked.roleId]?.camp==="wolf";
          text += `\n\n🔮 查驗 ${pending}號 → ${isWolfCamp ? "狼人" : "好人"}（上帝用）`;
        }
      }

      promptText.textContent = text;
      promptFoot.textContent = "";
      return;
    }

    if(step==="NIGHT:RESOLVE"){
      promptTitle.textContent = "夜晚結算";
      const roundKey = String(state.night.round);
      const res = state.night.resolvedByRound[roundKey];
      const deaths = res?.deaths || [];
      if(deaths.length===0){
        promptText.textContent = "本晚結算：平安夜。\n按「下一步」進入天亮公告。";
      }else{
        const lines = deaths.map(d=>`${d.seat}號（${d.reason==="wolf"?"刀":d.reason==="poison"?"毒":"其他"}）`);
        promptText.textContent = `本晚結算死亡：\n${lines.join("\n")}\n\n按「下一步」進入天亮公告。`;
      }
      promptFoot.textContent = "";
      return;
    }
  }

  // DAY
  if(phase==="DAY"){
    if(step==="DAY:D1"){
      const ann = state.day.announcement;
      promptTitle.textContent = ann?.title || "天亮公告";
      const lines = ann?.lines || ["—"];
      let text = lines.join("\n");

      // add god-only details
      if(state.ui.godExpanded){
        const roundKey = String(state.night.round);
        const rlog = state.night.logByRound[roundKey] || {};
        const wolf = rlog.wolf?.target ? `${rlog.wolf.target}號` : "空刀/未記錄";
        const seer = rlog.seer?.seat ? `${rlog.seer.seat}號→${rlog.seer.result}` : "未查驗";
        const wsave = rlog.witch?.save ? `${rlog.witch.save}號` : "無";
        const wpoison = rlog.witch?.poison ? `${rlog.witch.poison}號` : "無";
        text += `\n\n（上帝）夜晚明細：\n狼人刀：${wolf}\n預言查：${seer}\n女巫救：${wsave}\n女巫毒：${wpoison}`;
      }

      promptText.textContent = text;
      promptFoot.textContent = "按「下一步」進入白天（若獵人夜刀死亡，會先提示開槍）。";
      return;
    }

    if(step==="DAY:HS"){
      const hs = state.day.hunterShoot;
      const from = hs?.fromSeat;
      const reason = hs?.reason;

      // If hunterShoot exists but not allowed, skip
      if(!hs || !from){
        state.flow.stepId = "DAY:D2";
        saveAndRender();
        return;
      }

      // poisoned check (if somehow)
      // Night poison cannot shoot:
      if(reason === "night_poison"){
        promptTitle.textContent = "獵人開槍";
        promptText.textContent = `獵人（${from}號）是被毒死：不能開槍。`;
        promptFoot.textContent = "按「下一步」繼續白天。";
        // auto clear on next primary
        hs.pickedTarget = null;
        return;
      }

      promptTitle.textContent = "獵人開槍";
      promptText.textContent =
        `獵人（${from}號）可以開槍。\n\n` +
        `• 點一位存活者作為目標\n` +
        `• 不開槍：按「取消」\n` +
        `• 確認：按「下一步」`;
      promptFoot.textContent = state.ui.selectedSeat ? `已選目標：${state.ui.selectedSeat}號` : "尚未選目標（可不開槍）";
      return;
    }

    if(step==="DAY:D2"){
      promptTitle.textContent = "白天";
      promptText.textContent = "白天開始：可先發言。\n按「開始投票」進入投票。";
      promptFoot.textContent = "";
      return;
    }

    if(step==="DAY:VOTE"){
      const v = state.day.vote;
      const voter = currentVoterSeat();
      promptTitle.textContent = "白天投票";
      promptText.textContent =
        `輪到：${voter}號投票\n\n` +
        `• 點選要投的存活座位\n` +
        `• 不選＝棄票（直接按「下一步」）\n` +
        `\n進度：${(v?.voterIndex||0)+1} / ${v?.voters?.length||0}`;
      promptFoot.textContent = state.ui.selectedSeat ? `已選：${state.ui.selectedSeat}號` : "（棄票）";
      return;
    }

    if(step==="DAY:PK"){
      const v = state.day.vote;
      const voter = currentVoterSeat();
      const cand = v?.pkCandidates || [];
      promptTitle.textContent = `PK 投票（第${v?.pkRound||1}輪）`;
      promptText.textContent =
        `候選人：${cand.map(x=>`${x}號`).join("、")}\n\n` +
        `輪到：${voter}號投票\n` +
        `• 只能投候選人\n` +
        `• 不選＝棄票（直接按「下一步」）\n` +
        `\n進度：${(v?.voterIndex||0)+1} / ${v?.voters?.length||0}`;
      promptFoot.textContent = state.ui.selectedSeat ? `已選：${state.ui.selectedSeat}號` : "（棄票）";
      return;
    }

    if(step==="DAY:EXILE_DONE"){
      // show tally summary if exists
      const v = state.day.vote;
      const summary = buildVoteSummary(v);
      promptTitle.textContent = "投票結算";
      promptText.textContent = summary;
      promptFoot.textContent = "按「下一步」進入下一晚（或若已結束則顯示結局）。";
      return;
    }

    if(step==="DAY:NO_EXILE_DONE"){
      const v = state.day.vote;
      const summary = buildVoteSummary(v, true);
      promptTitle.textContent = "投票結算";
      promptText.textContent = summary;
      promptFoot.textContent = "按「下一步」進入下一晚（或若已結束則顯示結局）。";
      return;
    }
  }

  // fallback
  promptTitle.textContent = "—";
  promptText.textContent = "—";
  promptFoot.textContent = "";
}

function buildVoteSummary(v, noExile=false){
  if(!v){
    return noExile ? "無人放逐。" : "投票結束。";
  }
  const lines = [];
  lines.push("投票明細：");
  for(const it of v.log || []){
    lines.push(`${it.voter}號 → ${it.target ? `${it.target}號` : "棄票"}`);
  }
  lines.push("");
  if(v.tally && v.tally.length){
    lines.push("票數：");
    for(const t of v.tally){
      lines.push(`${t.seat}號：${t.count}票`);
    }
  }
  lines.push("");
  lines.push(noExile ? "結果：無人放逐。" : "結果：已結算。");
  return lines.join("\n");
}

function renderGodInfo(){
  if(!godText) return;
  const lines = [];

  lines.push(`人數：${state.config.playersCount || "—"}`);
  lines.push(`板子：${state.board?.id || state.config.boardId || "—"}`);
  lines.push(`勝負：${state.config.winMode === "city" ? "屠城" : "屠邊"}（可切換）`);

  if(state.setup.rolesAssigned){
    const unseen = state.players.filter(p=> !state.setup.seenSeats[String(p.seat)]).map(p=>p.seat);
    lines.push(`抽身分：已分配`);
    lines.push(`未查看：${unseen.length ? unseen.join("、") : "（無）"}`);
  }else{
    lines.push(`抽身分：尚未分配`);
  }

  // show witch potion status
  lines.push(`女巫：解藥${state.witch.usedAntidote ? "已用" : "可用"} / 毒藥${state.witch.usedPoison ? "已用" : "可用"}`);

  // show alive counts
  const wolves = countAliveBy(isWolf);
  const goodAll = countAliveBy(isGood);
  lines.push(`存活：狼 ${wolves} / 好 ${goodAll}`);

  godText.textContent = lines.join("\n");
}

function renderSeats(){
  if(!seatsGrid) return;
  seatsGrid.innerHTML = "";

  state.players.forEach(p=>{
    const seat = document.createElement("div");
    seat.className =
      "seat" +
      (!p.alive ? " dead" : "") +
      (state.ui.selectedSeat === p.seat ? " selected" : "");

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

      // idiot reveal info
      if(p.roleId==="idiot" && p.idiotRevealed){
        const b3 = document.createElement("span");
        b3.className = "badge";
        b3.textContent = "失票權";
        right.appendChild(b3);
      }
    }else{
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

    seat.addEventListener("click", ()=> onSeatClick(p.seat));

    // Long press reveal in A3
    if(state.flow.phase==="SETUP" && state.flow.stepId==="SETUP:A3"){
      addLongPress(seat, ()=> revealRole(p.seat), LONGPRESS_MS);
    }

    seatsGrid.appendChild(seat);
  });
}

function renderActions(){
  if(!btnPrimary || !btnCancel || !btnBack) return;

  const phase = state.flow.phase;
  const step = state.flow.stepId;

  btnPrimary.disabled = false;
  btnCancel.disabled = false;
  btnBack.disabled = false;

  if(phase==="END"){
    btnPrimary.textContent = "完成";
    btnPrimary.disabled = true;
    btnCancel.textContent = "取消";
    btnCancel.disabled = true;
    btnBack.textContent = "上一步";
    btnBack.disabled = true;
    return;
  }

  if(phase==="SETUP"){
    if(step==="SETUP:A1"){
      btnBack.textContent = "上一步";
      btnBack.disabled = true;
      btnPrimary.textContent = "下一步";
      btnCancel.textContent = "取消";
      return;
    }
    if(step==="SETUP:A2"){
      btnBack.textContent = "上一步";
      btnPrimary.textContent = "下一步";
      btnCancel.textContent = "取消";
      return;
    }
    if(step==="SETUP:A3"){
      btnBack.textContent = "上一步";
      btnPrimary.textContent = "確認進夜晚";
      btnPrimary.disabled = !allSeen();
      btnCancel.textContent = state.ui.revealSeat ? "關閉" : "取消";
      return;
    }
  }

  if(phase==="NIGHT"){
    if(step==="NIGHT:N0"){
      btnBack.textContent = "上一步";
      btnBack.disabled = false;
      btnPrimary.textContent = "開始夜晚";
      btnCancel.textContent = "取消";
      return;
    }
    if(step==="NIGHT:STEP"){
      btnBack.textContent = "上一步";
      btnBack.disabled = true; // night no back for safety
      btnPrimary.textContent = "下一步";
      btnCancel.textContent = "清除";
      return;
    }
    if(step==="NIGHT:RESOLVE"){
      btnBack.textContent = "上一步";
      btnBack.disabled = true;
      btnPrimary.textContent = "天亮公告";
      btnCancel.textContent = "取消";
      return;
    }
  }

  if(phase==="DAY"){
    if(step==="DAY:D1"){
      btnBack.textContent = "上一步";
      btnBack.disabled = true;
      btnPrimary.textContent = "下一步";
      btnCancel.textContent = "取消";
      return;
    }
    if(step==="DAY:HS"){
      btnBack.textContent = "上一步";
      btnBack.disabled = true;
      btnPrimary.textContent = "下一步";
      btnCancel.textContent = "不開槍";
      return;
    }
    if(step==="DAY:D2"){
      btnBack.textContent = "上一步";
      btnBack.disabled = true;
      btnPrimary.textContent = "開始投票";
      btnCancel.textContent = "取消";
      return;
    }
    if(step==="DAY:VOTE"){
      btnBack.textContent = "上一步";
      btnBack.disabled = true;
      btnPrimary.textContent = "確認";
      btnCancel.textContent = "清除";
      return;
    }
    if(step==="DAY:PK"){
      btnBack.textContent = "上一步";
      btnBack.disabled = true;
      btnPrimary.textContent = "確認";
      btnCancel.textContent = "清除";
      return;
    }
    if(step==="DAY:EXILE_DONE" || step==="DAY:NO_EXILE_DONE"){
      btnBack.textContent = "上一步";
      btnBack.disabled = true;
      btnPrimary.textContent = "下一步";
      btnCancel.textContent = "取消";
      return;
    }
  }

  // fallback
  btnPrimary.textContent = "下一步";
  btnCancel.textContent = "取消";
  btnBack.textContent = "上一步";
}

/* ================================
   Pick count
   ================================ */
function pickCount(n){
  state.config.playersCount = n;
  // default board id
  state.config.boardId = (n===9) ? "official-9" : (n===10) ? "official-10" : "official-12";
  applyBoardByPath(`./boards/${state.config.boardId}.json`, state.config.boardId).then(()=>{
    state.flow.stepId = "SETUP:A2";
    saveAndRender();
  });
}

/* ================================
   Night enter (first time)
   ================================ */
function enterNight(firstTime=false){
  state.flow.phase = "NIGHT";
  state.flow.stepId = "NIGHT:N0";
  if(firstTime){
    state.night.round = 1;
    state.flow.round = 1;
    state.day.round = 1;
  }else{
    state.flow.round = state.night.round;
  }
  enterNight(true); // we reuse enterNight(true) earlier for next round, but this would increment
  // NOTE: to avoid recursion, we do inline below
}

/* Fix: the function name above conflicts; keep single implementation */
function enterNight(isNextRound){
  state.flow.phase = "NIGHT";
  state.flow.stepId = "NIGHT:N0";

  if(isNextRound){
    // if already in night previously, increment; else keep at 1
    if(state.flow.phase === "NIGHT" && state.flow.stepId !== "SETUP:A3"){
      // no-op
    }
  }

  // build steps
  const steps = (state.board?.nightSteps || [])
    .slice()
    .sort((a,b)=> (a.wakeOrder||0) - (b.wakeOrder||0));

  state.night.steps = steps;
  state.night.stepIndex = 0;
  state.night.pending = {};
  state.ui.selectedSeat = null;

  // ensure round logs
  const roundKey = String(state.night.round);
  state.night.logByRound[roundKey] = state.night.logByRound[roundKey] || {};

  // clear day announcement until resolve
  state.day.announcement = null;
  state.day.vote = null;
  state.day.hunterShoot = null;
}

/* ================================
   Utilities
   ================================ */
function boardTitleFromId(){
  return state.config.boardId || "—";
}