/* ===============================
   Werewolf God Helper (Single-file)
   Works with your current index.html
================================= */

/* ---------- iOS prevent zoom/select ---------- */
(function antiIOS() {
  document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive:false });
  document.addEventListener("dblclick", (e) => e.preventDefault(), { passive:false });
  document.addEventListener("contextmenu", (e) => e.preventDefault(), { passive:false });

  // stop double-tap zoom (some browsers)
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 350) e.preventDefault();
    lastTouchEnd = now;
  }, { passive:false });
})();

/* ---------- helpers ---------- */
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function hms(sec){
  sec = Math.max(0, Math.floor(sec));
  const m = String(Math.floor(sec/60)).padStart(2,"0");
  const s = String(sec%60).padStart(2,"0");
  return `${m}:${s}`;
}

function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

function deepClone(x){ return JSON.parse(JSON.stringify(x)); }

/* ---------- roles ---------- */
const ROLE = {
  VILLAGER:{ key:"villager", name:"平民", camp:"好人" },
  WOLF:{ key:"wolf", name:"狼人", camp:"狼人" },
  SEER:{ key:"seer", name:"預言家", camp:"好人" },
  WITCH:{ key:"witch", name:"女巫", camp:"好人" },
  HUNTER:{ key:"hunter", name:"獵人", camp:"好人" },
  GUARD:{ key:"guard", name:"守衛", camp:"好人" },
  IDIOT:{ key:"idiot", name:"白痴", camp:"好人" },
  CUPID:{ key:"cupid", name:"邱比特", camp:"好人" },
  THIEF:{ key:"thief", name:"盜賊", camp:"好人" },
};

const ROLE_ICON = {
  witch: { pill:"💊", poison:"🧪" },
  guard: "🛡️",
  seer: "🔮",
  hunter: "🔫",
  cupid: "💘",
  thief: "🃏",
  wolf: "🐺",
};

function roleByKey(key){
  return Object.values(ROLE).find(r=>r.key===key) || {key, name:key, camp:"—"};
}

/* ---------- boards (expandable) ---------- */
const BOARDS = [
  {
    id:"official-12",
    n:12,
    title:"12 人官方標準局",
    sub:"4狼 + 預言家/女巫/守衛/獵人 + 4民",
    tags:["官方","穩","含白痴?否","含盜賊?否"],
    deal:{
      seats: [
        "wolf","wolf","wolf","wolf",
        "seer","witch","guard","hunter",
        "villager","villager","villager","villager"
      ],
      extra: []
    }
  },
  {
    id:"12-city",
    n:12,
    title:"12 人（標準角色・屠城）",
    sub:"同標準角色，但勝負改屠城（設定可切）",
    tags:["測試","屠城"],
    deal:{
      seats: [
        "wolf","wolf","wolf","wolf",
        "seer","witch","guard","hunter",
        "villager","villager","villager","villager"
      ],
      extra:[]
    }
  },
  {
    id:"12-edge-nopolice",
    n:12,
    title:"12 人（屠邊・無上警）",
    sub:"同標準角色，但預設關閉上警",
    tags:["測試","無上警"],
    deal:{
      seats: [
        "wolf","wolf","wolf","wolf",
        "seer","witch","guard","hunter",
        "villager","villager","villager","villager"
      ],
      extra:[]
    },
    defaults:{ hasPolice:false }
  },
  {
    id:"12-thief",
    n:12,
    title:"12 人含盜賊",
    sub:"4狼 + 預/女/獵/守/白痴/盜賊 + 3民（另加 2 張額外牌供盜賊選）",
    tags:["盜賊","含白痴"],
    deal:{
      // 12 seats get these 12 roles
      seats:[
        "wolf","wolf","wolf","wolf",
        "seer","witch","guard","hunter",
        "idiot","thief",
        "villager","villager"
      ],
      // +2 extra roles (from the same pool idea)
      // 你也可以改成隨機從「未出現的角色」抽兩張，這裡先給常用模板
      extra:["villager","villager"]
    }
  },
  {
    id:"12-cupid",
    n:12,
    title:"12 人含邱比特",
    sub:"4狼 + 邱比特 + 預/女/守/獵 + 2民",
    tags:["邱比特"],
    deal:{
      seats:[
        "wolf","wolf","wolf","wolf",
        "cupid",
        "seer","witch","guard","hunter",
        "villager","villager","villager"
      ],
      extra:[]
    }
  },
];

/* ---------- state ---------- */
const LS_KEY = "ww_god_v3";

const DEFAULT_STATE = {
  phase:"setup",   // setup | deal | game
  n:12,
  boardId:"official-12",
  winMode:"edge", // edge | city
  hasPolice:true,

  eye:false,       // god view on seats
  selected:null,   // selected seat for current step

  // seats
  seats:[],        // [{id, alive, roleKey, camp, events:[], seen:false}]
  dealt:false,

  // witch
  witchPill:true,
  witchPoison:true,
  witchSavedSeat:null,
  witchPoisonSeat:null,

  // night/day counts
  day:0,     // 0 before first night
  night:0,

  // current action memory per night
  nightGuard:null,
  nightWolf:null,
  nightSeerCheck:null,

  // announce logs
  logs:[],   // {type, day, textPublic, textGod}

  // votes
  vote: { open:false, records:{} }, // records[voterSeat]=targetSeat|0(abstain)

  // thief
  thief: { pending:false, seat:null, optionA:null, optionB:null, chosen:null },

  // ui
  promptTitle:"—",
  promptText:"—",
  promptFoot:"",

  // timer
  timer:{ sec:90, running:false, lastTick:0 }
};

function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return deepClone(DEFAULT_STATE);
    const st = JSON.parse(raw);
    return Object.assign(deepClone(DEFAULT_STATE), st);
  }catch(e){
    return deepClone(DEFAULT_STATE);
  }
}
function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }

let state = loadState();

/* ---------- DOM refs ---------- */
const uiStatus = $("uiStatus");
const uiBoard  = $("uiBoard");
const promptTitle = $("promptTitle");
const promptText  = $("promptText");
const promptFoot  = $("promptFoot");

const setupCard   = $("setupCard");
const boardList   = $("boardList");

const seatsGrid   = $("seatsGrid");

const btnBack = $("btnBack");
const btnMain = $("btnMain");
const btnNext = $("btnNext");

const btnAnn = $("btnAnn");
const btnTimer = $("btnTimer");
const btnEye = $("btnEye");
const btnDice = $("btnDice");
const btnSettings = $("btnSettings");

/* drawers */
const timerBackdrop = $("timerBackdrop");
const timerDrawer   = $("timerDrawer");
const btnCloseTimer = $("btnCloseTimer");
const timerBig      = $("timerBig");
const btnTimerStart = $("btnTimerStart");
const btnTimerPause = $("btnTimerPause");
const btnTimerReset = $("btnTimerReset");
const timerPresets  = $("timerPresets");

/* ann */
const annBackdrop = $("annBackdrop");
const annDrawer   = $("annDrawer");
const btnCloseAnn = $("btnCloseAnn");
const toggleAnnGod = $("toggleAnnGod");
const annText     = $("annText");

/* settings */
const setBackdrop = $("setBackdrop");
const setDrawer   = $("setDrawer");
const btnCloseSet = $("btnCloseSet");
const segEdge     = $("segEdge");
const segCity     = $("segCity");
const togglePolice= $("togglePolice");
const btnGotoSetup= $("btnGotoSetup");
const btnHardReset= $("btnHardReset");

/* modals */
const roleModal = $("roleModal");
const roleModalTitle = $("roleModalTitle");
const roleModalRole  = $("roleModalRole");
const roleModalCamp  = $("roleModalCamp");
const btnRoleDone = $("btnRoleDone");
const btnRoleClose= $("btnRoleClose");

const diceModal = $("diceModal");
const diceResult= $("diceResult");
const btnDiceAgain = $("btnDiceAgain");
const btnDiceClose = $("btnDiceClose");

const thiefModal = $("thiefModal");
const thiefHint  = $("thiefHint");
const btnThiefA  = $("btnThiefA");
const btnThiefB  = $("btnThiefB");
const btnThiefClose = $("btnThiefClose");

/* ---------- UI render ---------- */
function setBodyState(){
  document.body.classList.toggle("state-setup", state.phase==="setup");
  document.body.classList.toggle("state-deal", state.phase==="deal");
  document.body.classList.toggle("state-game", state.phase==="game");
}

function currentBoard(){
  return BOARDS.find(b=>b.id===state.boardId) || BOARDS.find(b=>b.id==="official-12");
}

function renderTop(){
  const b = currentBoard();
  uiBoard.textContent = state.phase==="setup" ? "狼人殺上帝輔助" : (b?.id || "—");
  uiStatus.textContent = statusLine();
}

function statusLine(){
  const b = currentBoard();
  if(state.phase==="setup"){
    return `SETUP｜人數 ${state.n}｜選板子`;
  }
  if(state.phase==="deal"){
    const seen = state.seats.filter(s=>s.seen).length;
    return `抽身分（${seen}/${state.n}）｜${b?.title || b?.id}`;
  }
  return `DAY ${state.day} / NIGHT ${state.night}｜${b?.id}｜${state.winMode==="edge"?"屠邊":"屠城"}${state.hasPolice?"｜上警":"｜無上警"}`;
}

function setPrompt(title, text, foot=""){
  state.promptTitle = title;
  state.promptText  = text;
  state.promptFoot  = foot;
  promptTitle.textContent = title;
  promptText.textContent  = text;
  promptFoot.textContent  = foot;
}

function renderSetup(){
  // chips highlight
  document.querySelectorAll(".chips .chip[data-n]").forEach(btn=>{
    const n = Number(btn.dataset.n);
    btn.classList.toggle("active", n===state.n);
  });

  // boards list by n
  boardList.innerHTML = "";
  const list = BOARDS.filter(b=>b.n===state.n);
  list.forEach(b=>{
    const div = document.createElement("div");
    div.className = "boardItem" + (b.id===state.boardId ? " active":"");
    div.dataset.board = b.id;

    div.innerHTML = `
      <div class="boardName">${b.title}</div>
      <div class="boardSub">${b.id} ・ ${b.sub}</div>
      <div class="badges">
        ${(b.tags||[]).map(t=>`<span class="badge">${t}</span>`).join("")}
      </div>
    `;
    boardList.appendChild(div);
  });

  setPrompt(
    "開局設定",
    "1) 先選人數 → 2) 選板子（點一下會變色）\n3) 按底部「下一步」進入抽身分。",
    "提示：進入遊戲後不再佔版面；要重選請到 ⚙️ 設定 → 回到開局"
  );

  btnMain.textContent = "開始夜晚"; // in setup just placeholder
}

function renderSeats(){
  seatsGrid.innerHTML = "";
  const cols = state.n===9 ? 3 : 4;
  seatsGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  state.seats.forEach(s=>{
    const div = document.createElement("div");
    div.className = "seat";
    div.dataset.seat = String(s.id);

    if(state.selected===s.id) div.classList.add("selected");
    if(!s.alive) div.classList.add("dead");

    // god view colors
    if(state.eye){
      if(s.camp==="好人") div.classList.add("good");
      if(s.camp==="狼人") div.classList.add("wolf");
    }

    const role = roleByKey(s.roleKey);

    // line2 text
    let sub = "";
    if(state.phase==="deal"){
      sub = s.seen ? `${role.name}` : "長按看身分";
    }else{
      if(!s.alive) sub = "死亡";
      else sub = "存活";
    }

    // god view extra
    let godLine = "";
    if(state.eye){
      const icons = [];

      // witch marks move to seat
      if(state.witchSavedSeat===s.id) icons.push(ROLE_ICON.witch.pill);
      if(state.witchPoisonSeat===s.id) icons.push(ROLE_ICON.witch.poison);

      // guard target this night
      if(state.nightGuard===s.id) icons.push(ROLE_ICON.guard);

      // events
      if(Array.isArray(s.events) && s.events.length){
        // show last 2 events as short icons
        const map = {
          "wolf":"🩸",
          "poison":"🧪",
          "pill":"💊",
          "shot":"🔫",
          "claw":"🖐️",
          "blackshot":"💥",
          "exile":"🗳️"
        };
        const last = s.events.slice(-2).map(e=>map[e]||"•");
        icons.push(...last);
      }

      const roleText = `${role.name}・${s.camp}`;
      godLine = icons.length ? `${icons.join("")}  ${roleText}` : roleText;
    }

    div.innerHTML = `
      <div class="seatNum">${s.id}</div>
      <div class="seatSub">${sub}</div>
      ${state.eye ? `<div class="seatSub" style="color:var(--ink); font-weight:900;">${godLine}</div>` : ``}
    `;

    seatsGrid.appendChild(div);
  });
}

function renderButtons(){
  if(state.phase==="setup"){
    btnBack.disabled = true;
    btnNext.disabled = false;
    btnMain.disabled = true;
    btnMain.textContent = "開始夜晚";
    return;
  }
  btnBack.disabled = false;
  btnNext.disabled = false;

  // main button meaning by phase
  if(state.phase==="deal"){
    btnMain.disabled = false;
    btnMain.textContent = "開始夜晚";
  }else{
    btnMain.disabled = false;
    // toggle day/night helper label
    btnMain.textContent = state.night>state.day ? "天亮睜眼" : "天黑閉眼";
  }
}

/* ---------- setup actions ---------- */
function ensureSeats(){
  state.seats = Array.from({length:state.n}, (_,i)=>({
    id:i+1,
    alive:true,
    roleKey:"villager",
    camp:"好人",
    events:[],
    seen:false,
  }));
}

function applyBoardDefaults(){
  const b = currentBoard();
  if(b?.defaults){
    if(typeof b.defaults.hasPolice==="boolean") state.hasPolice = b.defaults.hasPolice;
  }
}

/* ---------- dealing ---------- */
function buildDealPool(){
  const b = currentBoard();
  const poolSeats = b.deal.seats.slice();
  const poolExtra = b.deal.extra.slice();
  // if board seats count not equal n, fallback
  if(poolSeats.length !== state.n){
    // simple fallback: 4 wolf + seer/witch/guard/hunter + rest villager
    const base = [];
    const wolves = clamp(Math.floor(state.n/3), 3, 4);
    for(let i=0;i<wolves;i++) base.push("wolf");
    base.push("seer","witch","guard","hunter");
    while(base.length<state.n) base.push("villager");
    return { seats: base, extra: [] };
  }
  return { seats: poolSeats, extra: poolExtra };
}

function doDeal(){
  ensureSeats();
  applyBoardDefaults();

  const deal = buildDealPool();
  const shuffled = shuffle(deal.seats);

  for(let i=0;i<state.seats.length;i++){
    state.seats[i].roleKey = shuffled[i];
    state.seats[i].camp = roleByKey(shuffled[i]).camp;
    state.seats[i].seen = false;
    state.seats[i].events = [];
    state.seats[i].alive = true;
  }

  // reset consumables
  state.witchPill = true;
  state.witchPoison = true;
  state.witchSavedSeat = null;
  state.witchPoisonSeat = null;

  state.day = 0;
  state.night = 0;
  state.nightGuard = null;
  state.nightWolf = null;
  state.nightSeerCheck = null;

  state.logs = [];
  state.vote = { open:false, records:{} };

  // thief pending setup
  state.thief = { pending:false, seat:null, optionA:null, optionB:null, chosen:null };

  state.phase = "deal";
  state.selected = null;

  // if thief exists -> compute remaining 2 cards (extra) and set pending
  const thiefSeat = state.seats.find(s=>s.roleKey==="thief")?.id || null;
  if(thiefSeat){
    // remaining from extra pool, OR if extra empty: take two random from roles not in seats
    let opt = deal.extra.slice();
    if(opt.length < 2){
      const all = ["seer","witch","guard","hunter","idiot","cupid","villager","villager","villager","wolf"];
      const used = new Set(state.seats.map(s=>s.roleKey));
      const candidates = all.filter(k=>!used.has(k));
      opt = shuffle(candidates).slice(0,2);
      while(opt.length<2) opt.push("villager");
    }
    state.thief.pending = true;
    state.thief.seat = thiefSeat;
    state.thief.optionA = opt[0];
    state.thief.optionB = opt[1];
  }

  setPrompt("抽身分", "請將手機交給玩家：\n— 上帝先點選座位（可取消選取）\n— 玩家長按 0.3 秒查看身分\n— 看完按「我看完了」\n全部看完後按「開始夜晚」。");
}

/* ---------- long press role reveal ---------- */
let pressTimer = null;
let pressSeat = null;

function bindSeatLongPress(el){
  el.addEventListener("pointerdown", (e)=>{
    const seatId = Number(el.dataset.seat);
    pressSeat = seatId;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(()=>{
      onSeatLongPress(seatId);
    }, 300);
  }, {passive:true});

  const cancel = ()=>{
    clearTimeout(pressTimer);
    pressTimer = null;
    pressSeat = null;
  };
  el.addEventListener("pointerup", cancel, {passive:true});
  el.addEventListener("pointercancel", cancel, {passive:true});
  el.addEventListener("pointerleave", cancel, {passive:true});
}

function onSeatLongPress(seatId){
  if(state.phase!=="deal") return; // only reveal in deal for player
  const s = state.seats.find(x=>x.id===seatId);
  if(!s) return;

  const r = roleByKey(s.roleKey);
  roleModalTitle.textContent = `${seatId}號 身分`;
  roleModalRole.textContent  = r.name;
  roleModalCamp.textContent  = `陣營：${r.camp}`;
  openModal(roleModal);

  // mark seen when player clicks done
  btnRoleDone.onclick = ()=>{
    s.seen = true;
    closeModal(roleModal);
    saveState();
    renderAll();
  };
  btnRoleClose.onclick = ()=> closeModal(roleModal);
}

/* ---------- click selection ---------- */
function onSeatClick(seatId){
  // toggle selection (click same again cancels)
  state.selected = (state.selected===seatId) ? null : seatId;
  saveState();
  renderAll();
}

/* ---------- eye toggle ---------- */
function toggleEye(){
  state.eye = !state.eye;
  saveState();
  renderAll();
}

/* ---------- timer ---------- */
function timerTickLoop(){
  if(!state.timer.running) return;
  const now = Date.now();
  const dt = (now - state.timer.lastTick) / 1000;
  if(dt >= 1){
    const step = Math.floor(dt);
    state.timer.sec = Math.max(0, state.timer.sec - step);
    state.timer.lastTick = now;
    saveState();
    renderTimer();
    if(state.timer.sec <= 0){
      state.timer.running = false;
      try{ navigator.vibrate && navigator.vibrate([200,80,200]); }catch(e){}
      saveState();
      renderTimer();
      return;
    }
  }
  requestAnimationFrame(timerTickLoop);
}

function renderTimer(){
  timerBig.textContent = hms(state.timer.sec);
}

function timerSet(sec){
  state.timer.sec = sec;
  state.timer.running = false;
  state.timer.lastTick = Date.now();
  saveState();
  renderTimer();
}

/* ---------- dice ---------- */
function openDice(){
  const alive = state.seats.filter(s=>s.alive).map(s=>s.id);
  if(!alive.length){
    diceResult.textContent = "—";
  }else{
    const pick = alive[Math.floor(Math.random()*alive.length)];
    diceResult.textContent = `${pick} 號`;
  }
  openModal(diceModal);
}
btnDiceAgain.onclick = ()=> openDice();
btnDiceClose.onclick = ()=> closeModal(diceModal);

/* ---------- drawers/modal helpers ---------- */
function openDrawer(backdrop, drawer){
  backdrop.classList.remove("hidden");
  drawer.classList.remove("hidden");
  drawer.setAttribute("aria-hidden","false");
}
function closeDrawer(backdrop, drawer){
  backdrop.classList.add("hidden");
  drawer.classList.add("hidden");
  drawer.setAttribute("aria-hidden","true");
}
function openModal(modal){
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden","false");
}
function closeModal(modal){
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden","true");
}

/* ---------- ann render ---------- */
function buildAnnText(showGod){
  if(!state.logs.length) return "（目前沒有公告紀錄）";
  const lines = [];
  for(const L of state.logs){
    lines.push(showGod ? L.textGod : L.textPublic);
    lines.push("");
  }
  return lines.join("\n").trim();
}

/* ---------- flow (minimal but usable) ---------- */
function startNight1(){
  state.night = 1;
  state.day = 0;
  state.phase = "game";
  state.selected = null;

  // if thief pending -> force choose before night
  if(state.thief.pending){
    openThiefChoose();
    // prompt still shown, but thief modal must be handled first
  }

  setPrompt(
    `夜晚 ${state.night}`,
    [
      "夜晚開始：",
      "1) 守衛請睜眼（選擇守護）",
      "2) 狼人請睜眼（選擇刀人）",
      "3) 預言家請睜眼（查驗一人）",
      "4) 女巫請睜眼（解藥 / 毒藥）",
      "",
      "👉 依序按「下一步」提示，並依提示點座位"
    ].join("\n"),
    "提示：點座位可取消再選；👁 可切上帝視角"
  );

  // log header
  pushLog(`NIGHT ${state.night} 開始`, `NIGHT ${state.night} 開始`);
}

/* step machine for night/day */
const STEP = {
  NONE:0,
  NIGHT_GUARD:1,
  NIGHT_WOLF:2,
  NIGHT_SEER:3,
  NIGHT_WITCH:4,
  DAY_REVEAL:5,
  DAY_VOTE:6,
  DAY_EXILE_DONE:7,
};
let step = STEP.NONE;

function setStep(newStep){
  step = newStep;
  state.selected = null;
  saveState();
  renderAll();
}

function nextStep(){
  if(state.phase==="setup"){
    // setup -> deal
    if(!state.n) state.n = 12;
    if(!state.boardId) state.boardId = currentBoard().id;
    doDeal();
    saveState();
    renderAll();
    return;
  }

  if(state.phase==="deal"){
    // must all seen before proceed
    const seen = state.seats.filter(s=>s.seen).length;
    if(seen < state.n){
      setPrompt("抽身分", state.promptText, `還有 ${state.n - seen} 人未看身分`);
      renderAll();
      return;
    }
    // proceed to game
    startNight1();
    setStep(STEP.NIGHT_GUARD);
    saveState();
    renderAll();
    return;
  }

  // game steps
  if(step===STEP.NIGHT_GUARD){
    setPrompt(`夜晚 ${state.night}｜守衛`, "守衛請睜眼：請點選要守護的座位（可空守：不選直接下一步）");
    // record selection when leaving step
    state.nightGuard = state.selected || null;
    setStep(STEP.NIGHT_WOLF);
    return;
  }

  if(step===STEP.NIGHT_WOLF){
    setPrompt(`夜晚 ${state.night}｜狼人`, "狼人請睜眼：請點選要刀的座位（必選）");
    if(!state.selected){
      // require
      return;
    }
    state.nightWolf = state.selected;
    // mark event (not kill yet until day reveal)
    setStep(STEP.NIGHT_SEER);
    return;
  }

  if(step===STEP.NIGHT_SEER){
    setPrompt(`夜晚 ${state.night}｜預言家`, "預言家請睜眼：請點選要查驗的座位（必選）");
    if(!state.selected) return;
    state.nightSeerCheck = state.selected;
    const target = state.seats.find(s=>s.id===state.nightSeerCheck);
    const camp = target?.camp || "—";
    pushLog(
      `預言家查驗：${state.nightSeerCheck} 號（結果由上帝口頭公布）`,
      `預言家查驗：${state.nightSeerCheck} 號 → ${camp}`
    );
    setStep(STEP.NIGHT_WITCH);
    return;
  }

  if(step===STEP.NIGHT_WITCH){
    // witch: if pill available and wolf target exists
    const wolf = state.nightWolf;
    const lines = [];
    lines.push("女巫請睜眼：");
    if(wolf) lines.push(`— 今晚刀口：${wolf} 號`);
    if(state.witchPill) lines.push("— 解藥可用：點「刀口座位」視為救");
    else lines.push("— 解藥已用");
    if(state.witchPoison) lines.push("— 毒藥可用：點「其他座位」視為毒");
    else lines.push("— 毒藥已用");
    lines.push("");
    lines.push("（同一晚只能救或毒其一；再點同一座位可取消選取）");
    setPrompt(`夜晚 ${state.night}｜女巫`, lines.join("\n"));

    // interpretation:
    // - selected == wolf -> try save (if pill)
    // - selected != null && selected != wolf -> poison (if poison)
    // - no selection -> do nothing
    const sel = state.selected;

    // apply decision on next
    if(sel){
      if(sel===wolf && state.witchPill){
        // save
        state.witchPill = false;
        state.witchSavedSeat = wolf;
        state.witchPoisonSeat = null;
        state.witchPoison = state.witchPoison; // unchanged
        pushLog(`女巫使用解藥（公開不揭露）`, `女巫救：${wolf} 號（💊）`);
      }else if(sel!==wolf && state.witchPoison){
        state.witchPoison = false;
        state.witchPoisonSeat = sel;
        state.witchSavedSeat = null;
        pushLog(`女巫使用毒藥（公開不揭露）`, `女巫毒：${sel} 號（🧪）`);
      }
    }

    // resolve night -> day reveal
    setStep(STEP.DAY_REVEAL);
    return;
  }

  if(step===STEP.DAY_REVEAL){
    // resolve deaths
    const wolf = state.nightWolf;
    const saved = state.witchSavedSeat;
    const poisoned = state.witchPoisonSeat;

    const deaths = new Set();

    if(wolf && wolf!==saved){
      deaths.add(wolf);
      addSeatEvent(wolf, "wolf");
    }
    if(poisoned){
      deaths.add(poisoned);
      addSeatEvent(poisoned, "poison");
    }

    // apply
    for(const id of deaths){
      const s = state.seats.find(x=>x.id===id);
      if(s) s.alive = false;
    }

    state.day += 1;

    // log daybreak
    const publicLine = deaths.size
      ? `天亮：昨晚死亡 ${Array.from(deaths).sort((a,b)=>a-b).join("、")} 號`
      : "天亮：平安夜";
    const godLine = [
      publicLine,
      state.nightGuard ? `守衛守：${state.nightGuard} 號（🛡️）` : "守衛空守",
      state.nightWolf ? `狼人刀：${state.nightWolf} 號（🩸）` : "狼人未刀？",
      saved ? `女巫救：${saved} 號（💊）` : "女巫未救",
      poisoned ? `女巫毒：${poisoned} 號（🧪）` : "女巫未毒",
      state.nightSeerCheck ? `預言家查：${state.nightSeerCheck} 號` : ""
    ].filter(Boolean).join("\n");

    pushLog(`DAY ${state.day}｜${publicLine}`, `DAY ${state.day}｜\n${godLine}`);

    setPrompt(`白天 ${state.day}`, `${publicLine}\n\n按中間「開始投票」進入投票流程（📣 可回顧公告）`, "提示：要投票時，中間按鈕會變「開始投票」");
    btnMain.textContent = "開始投票";
    setStep(STEP.DAY_VOTE);
    return;
  }

  if(step===STEP.DAY_VOTE){
    // enter vote collection: we use selection to record vote quickly
    // 简化：每次「下一步」會要求先選投誰，並自動把「目前選取者」視為被投
    // 更完整要逐個投票者記錄；先提供可用版：在設定公告中可呈現票型
    if(!state.vote.open){
      state.vote.open = true;
      state.vote.records = {};
      pushLog(`開始投票`, `開始投票`);
      setPrompt(`白天 ${state.day}｜投票`, "投票模式：\n1) 先點「投票者」座位（再點取消）\n2) 再點「被投」座位（或點空白代表棄票）\n\n👉 這版快速法：\n- 先點投票者（選取）\n- 再點被投者（會自動記錄）\n\n按「下一步」可結算投票。");
      renderAll();
      return;
    }else{
      // tally
      const tally = tallyVotes();
      const text = formatVoteAnnounce(tally);
      pushLog(`投票結算`, `投票結算（上帝）\n${text}`);

      // apply exile (highest vote)
      const exile = tally.exiled;
      if(exile){
        const s = state.seats.find(x=>x.id===exile);
        if(s){
          s.alive = false;
          addSeatEvent(exile, "exile");
        }
      }

      setPrompt(`白天 ${state.day}｜投票結果`, text + `\n\n按「下一步」進入下一晚。`);
      setStep(STEP.DAY_EXILE_DONE);
      state.vote.open = false;
      state.vote.records = {};
      state.selected = null;
      saveState();
      renderAll();
      return;
    }
  }

  if(step===STEP.DAY_EXILE_DONE){
    // next night
    state.night += 1;
    // reset night memory
    state.nightGuard = null;
    state.nightWolf = null;
    state.nightSeerCheck = null;
    state.witchSavedSeat = null;
    state.witchPoisonSeat = null;

    setPrompt(
      `夜晚 ${state.night}`,
      [
        "夜晚開始：",
        "1) 守衛請睜眼（選擇守護）",
        "2) 狼人請睜眼（選擇刀人）",
        "3) 預言家請睜眼（查驗一人）",
        "4) 女巫請睜眼（解藥 / 毒藥）",
        "",
        "👉 依序按「下一步」提示"
      ].join("\n")
    );
    pushLog(`NIGHT ${state.night} 開始`, `NIGHT ${state.night} 開始`);
    setStep(STEP.NIGHT_GUARD);
    return;
  }
}

function prevStep(){
  // simple: in setup can't
  if(state.phase==="setup") return;

  // in deal: back to setup (soft)
  if(state.phase==="deal"){
    state.phase = "setup";
    state.dealt = false;
    state.selected = null;
    saveState();
    renderAll();
    return;
  }

  // in game: we do minimal back: just show prompt message (not undo)
  pushLog("（提示）此版本不做流程回溯復原", "（提示）此版本不做流程回溯復原");
  setPrompt("提示", "此版本「上一步」不回溯已結算事件。\n若要重來請到 ⚙️ 設定 → 回到開局。");
  renderAll();
}

/* ---------- vote record (by click) ---------- */
let voteVoter = null; // temporary voter selection

function handleVoteClick(seatId){
  // two-step: pick voter then target
  if(voteVoter==null){
    voteVoter = seatId;
    state.selected = seatId;
    saveState();
    renderAll();
    return;
  }
  // second click -> target
  const voter = voteVoter;
  const target = seatId;
  state.vote.records[String(voter)] = target;
  voteVoter = null;
  state.selected = null;
  saveState();
  renderAll();
}

function tallyVotes(){
  const records = state.vote.records || {};
  const bucket = new Map(); // target -> voters[]
  const abstain = [];

  for(const [voter, target] of Object.entries(records)){
    const v = Number(voter);
    const t = Number(target);
    if(!t || t===0){
      abstain.push(v);
      continue;
    }
    if(!bucket.has(t)) bucket.set(t, []);
    bucket.get(t).push(v);
  }

  // determine highest
  let exiled = null;
  let best = -1;
  for(const [t, voters] of bucket.entries()){
    if(voters.length > best){
      best = voters.length;
      exiled = t;
    }else if(voters.length === best){
      exiled = null; // tie -> no exile (simple)
    }
  }

  return {
    bucket,
    abstain: abstain.sort((a,b)=>a-b),
    exiled,
    best
  };
}

function formatVoteAnnounce(tally){
  const lines = [];
  const entries = Array.from(tally.bucket.entries()).sort((a,b)=>a[0]-b[0]);
  for(const [t, voters] of entries){
    const v = voters.slice().sort((a,b)=>a-b);
    lines.push(`投給${t}號的有 ${v.join("、")}（${v.length}票）`);
  }
  if(tally.abstain.length){
    lines.push(`棄票的有 ${tally.abstain.join("、")}（${tally.abstain.length}票）`);
  }
  if(entries.length===0 && !tally.abstain.length) lines.push("（尚未記錄任何投票）");

  if(tally.exiled){
    lines.push(`${tally.exiled}號得到最高票遭到放逐`);
  }else{
    lines.push(`最高票平票或無有效票：本輪不放逐`);
  }
  return lines.join("\n");
}

/* ---------- seat events ---------- */
function addSeatEvent(seatId, code){
  const s = state.seats.find(x=>x.id===seatId);
  if(!s) return;
  s.events = s.events || [];
  s.events.push(code);
}

/* ---------- logs ---------- */
function pushLog(publicText, godText){
  const d = state.day;
  const n = state.night;
  state.logs.push({
    type:"log",
    day:d,
    textPublic: publicText,
    textGod: godText
  });
}

/* ---------- thief ---------- */
function openThiefChoose(){
  const seat = state.thief.seat;
  const a = state.thief.optionA;
  const b = state.thief.optionB;
  if(!seat || !a || !b) return;

  const ra = roleByKey(a);
  const rb = roleByKey(b);

  // rule: if one wolf one good -> must pick wolf
  const aWolf = ra.camp==="狼人";
  const bWolf = rb.camp==="狼人";
  let forced = null;
  if(aWolf !== bWolf){
    forced = aWolf ? a : b;
  }

  thiefHint.textContent = forced
    ? `盜賊是 ${seat} 號。兩張牌一好一狼：只能選狼人陣營（已限制）。`
    : `盜賊是 ${seat} 號。請在兩張牌中擇一成為你的角色。`;

  btnThiefA.textContent = ra.name + (ra.camp==="狼人" ? "（狼人）" : "");
  btnThiefB.textContent = rb.name + (rb.camp==="狼人" ? "（狼人）" : "");

  btnThiefA.disabled = forced ? (forced!==a) : false;
  btnThiefB.disabled = forced ? (forced!==b) : false;

  const choose = (key)=>{
    // apply role replacement
    const s = state.seats.find(x=>x.id===seat);
    if(!s) return;
    s.roleKey = key;
    s.camp = roleByKey(key).camp;

    state.thief.pending = false;
    state.thief.chosen = key;

    pushLog("（盜賊已完成選角）", `盜賊（${seat}號）選擇：${roleByKey(key).name}；另一張捨棄`);
    closeModal(thiefModal);
    saveState();
    renderAll();
  };

  btnThiefA.onclick = ()=> choose(a);
  btnThiefB.onclick = ()=> choose(b);
  btnThiefClose.onclick = ()=> closeModal(thiefModal);

  openModal(thiefModal);
}

/* ---------- events binding ---------- */
function bindSetupEvents(){
  document.querySelectorAll(".chips .chip[data-n]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      state.n = Number(btn.dataset.n);
      // auto pick first board of this n
      const first = BOARDS.find(b=>b.n===state.n);
      if(first) state.boardId = first.id;
      saveState();
      renderAll();
    });
  });

  boardList.addEventListener("click", (e)=>{
    const item = e.target.closest(".boardItem");
    if(!item) return;
    state.boardId = item.dataset.board;
    saveState();
    renderAll();
  });
}

function bindTopButtons(){
  btnEye.addEventListener("click", ()=> toggleEye());

  btnTimer.addEventListener("click", ()=>{
    renderTimer();
    openDrawer(timerBackdrop, timerDrawer);
  });
  btnCloseTimer.addEventListener("click", ()=> closeDrawer(timerBackdrop, timerDrawer));
  timerBackdrop.addEventListener("click", ()=> closeDrawer(timerBackdrop, timerDrawer));

  timerPresets.addEventListener("click", (e)=>{
    const b = e.target.closest(".chip[data-sec]");
    if(!b) return;
    timerSet(Number(b.dataset.sec));
  });
  btnTimerStart.addEventListener("click", ()=>{
    state.timer.running = true;
    state.timer.lastTick = Date.now();
    saveState();
    timerTickLoop();
  });
  btnTimerPause.addEventListener("click", ()=>{
    state.timer.running = false;
    saveState();
  });
  btnTimerReset.addEventListener("click", ()=>{
    timerSet(90);
  });

  btnAnn.addEventListener("click", ()=>{
    annText.textContent = buildAnnText(toggleAnnGod.checked);
    openDrawer(annBackdrop, annDrawer);
  });
  btnCloseAnn.addEventListener("click", ()=> closeDrawer(annBackdrop, annDrawer));
  annBackdrop.addEventListener("click", ()=> closeDrawer(annBackdrop, annDrawer));
  toggleAnnGod.addEventListener("change", ()=>{
    annText.textContent = buildAnnText(toggleAnnGod.checked);
  });

  btnDice.addEventListener("click", ()=>{
    if(state.phase==="setup"){
      openModal(diceModal);
      diceResult.textContent = "（請先開局）";
      return;
    }
    openDice();
  });

  btnSettings.addEventListener("click", ()=>{
    // sync UI
    segEdge.classList.toggle("primary", state.winMode==="edge");
    segCity.classList.toggle("primary", state.winMode==="city");
    togglePolice.checked = !!state.hasPolice;

    openDrawer(setBackdrop, setDrawer);
  });
  btnCloseSet.addEventListener("click", ()=> closeDrawer(setBackdrop, setDrawer));
  setBackdrop.addEventListener("click", ()=> closeDrawer(setBackdrop, setDrawer));

  segEdge.addEventListener("click", ()=>{
    state.winMode = "edge";
    segEdge.classList.add("primary");
    segCity.classList.remove("primary");
    saveState();
    renderTop();
  });
  segCity.addEventListener("click", ()=>{
    state.winMode = "city";
    segCity.classList.add("primary");
    segEdge.classList.remove("primary");
    saveState();
    renderTop();
  });

  togglePolice.addEventListener("change", ()=>{
    state.hasPolice = togglePolice.checked;
    saveState();
    renderTop();
  });

  btnGotoSetup.addEventListener("click", ()=>{
    // back to setup but keep stored settings (winMode/police)
    state.phase = "setup";
    state.dealt = false;
    state.eye = false;
    state.selected = null;
    state.seats = [];
    state.logs = [];
    state.vote = {open:false, records:{}};
    saveState();
    closeDrawer(setBackdrop, setDrawer);
    renderAll();
  });

  btnHardReset.addEventListener("click", ()=>{
    localStorage.removeItem(LS_KEY);
    state = deepClone(DEFAULT_STATE);
    saveState();
    closeDrawer(setBackdrop, setDrawer);
    renderAll();
  });
}

function bindBottom(){
  btnBack.addEventListener("click", ()=> prevStep());

  btnNext.addEventListener("click", ()=>{
    // if in vote collection, "下一步" means tally
    nextStep();
    saveState();
    renderAll();
  });

  btnMain.addEventListener("click", ()=>{
    if(state.phase==="deal"){
      // behave same as next step -> start night
      nextStep();
      return;
    }
    if(state.phase==="game"){
      if(step===STEP.DAY_REVEAL){
        // not used
        return;
      }
      if(step===STEP.DAY_VOTE){
        // already in vote - main does nothing
        return;
      }
      // toggle helper only (label changes handled in renderButtons)
      // if currently at night flow, we let nextStep do the real progress
      // main button can start vote when ready:
      if(step===STEP.DAY_VOTE){
        return;
      }
      if(step===STEP.DAY_EXILE_DONE){
        return;
      }
      // in "day reveal finished" step, setStep DAY_VOTE is already done
      if(btnMain.textContent.includes("投票") && step===STEP.DAY_VOTE){
        return;
      }
    }
  });
}

/* ---------- seat click delegation + long press binding ---------- */
function bindSeats(){
  seatsGrid.addEventListener("click", (e)=>{
    const seatEl = e.target.closest(".seat");
    if(!seatEl) return;
    const seatId = Number(seatEl.dataset.seat);

    if(state.phase==="game" && step===STEP.DAY_VOTE && state.vote.open){
      // vote record mode
      handleVoteClick(seatId);
      return;
    }

    onSeatClick(seatId);
  });

  // long-press: bind after render (each seat)
}

/* ---------- main render ---------- */
function renderAll(){
  setBodyState();
  renderTop();

  // setup visibility
  if(state.phase==="setup"){
    renderSetup();
    // clear seats content, but keep structure hidden
  }else{
    // prompt per phase persists
    promptTitle.textContent = state.promptTitle || "—";
    promptText.textContent  = state.promptText || "—";
    promptFoot.textContent  = state.promptFoot || "";
  }

  // seats render when not setup
  if(state.phase!=="setup"){
    if(!state.seats || state.seats.length!==state.n) ensureSeats();
    renderSeats();

    // bind long press on current seats
    document.querySelectorAll(".seat").forEach(el=> bindSeatLongPress(el));
  }

  renderButtons();
}

/* ---------- init ---------- */
function init(){
  // if no phase -> setup
  if(!state.phase) state.phase = "setup";

  // if in deal/game but seats missing -> go setup
  if((state.phase==="deal" || state.phase==="game") && (!state.seats || state.seats.length!==state.n)){
    state.phase = "setup";
    state.seats = [];
  }

  // step restore (simple)
  if(state.phase!=="game") step = STEP.NONE;
  if(state.phase==="game" && step===STEP.NONE) step = STEP.NIGHT_GUARD;

  // initial prompt for setup
  if(state.phase==="setup"){
    setPrompt(
      "開局設定",
      "1) 選人數\n2) 選板子\n3) 按「下一步」進入抽身分"
    );
  }

  bindSetupEvents();
  bindTopButtons();
  bindBottom();
  bindSeats();

  // close modals by backdrop click
  roleModal.addEventListener("click", (e)=>{ if(e.target===roleModal) closeModal(roleModal); });
  diceModal.addEventListener("click", (e)=>{ if(e.target===diceModal) closeModal(diceModal); });
  thiefModal.addEventListener("click", (e)=>{ if(e.target===thiefModal) closeModal(thiefModal); });

  renderTimer();
  renderAll();
  saveState();
}

/* ensure boardId matches n */
(function normalize(){
  const ok = BOARDS.find(b=>b.id===state.boardId && b.n===state.n);
  if(!ok){
    const first = BOARDS.find(b=>b.n===state.n) || BOARDS.find(b=>b.id==="official-12");
    if(first) state.boardId = first.id;
  }
})();

init();