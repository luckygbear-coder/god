/* =========================
   狼人殺上帝輔助 - app.js
   配合你目前的 index 結構
   ========================= */

/* ---------- iOS 防雙擊縮放 / 長按選取/複製 ---------- */
(function blockIOSGestures(){
  document.addEventListener("contextmenu", (e)=>e.preventDefault(), {passive:false});
  document.addEventListener("selectstart", (e)=>e.preventDefault(), {passive:false});

  // iOS Safari: gesturestart/gesturechange
  document.addEventListener("gesturestart", (e)=>e.preventDefault(), {passive:false});
  document.addEventListener("gesturechange", (e)=>e.preventDefault(), {passive:false});
  document.addEventListener("gestureend", (e)=>e.preventDefault(), {passive:false});

  // Double tap zoom block
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (e)=>{
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, {passive:false});
})();

/* ---------- DOM ---------- */
const $ = (id)=>document.getElementById(id);

const uiStatus = $("uiStatus");
const uiBoard  = $("uiBoard");

const promptTitle = $("promptTitle");
const promptText  = $("promptText");
const promptFoot  = $("promptFoot");

const setupCard = $("setupCard");
const boardList = $("boardList");

const seatsGrid = $("seatsGrid");

const btnBack = $("btnBack");
const btnMain = $("btnMain");
const btnNext = $("btnNext");

const btnAnn = $("btnAnn");
const btnTimer = $("btnTimer");
const btnEye = $("btnEye");
const btnDice = $("btnDice");
const btnSettings = $("btnSettings");

/* drawers/modals */
const annBackdrop = $("annBackdrop");
const annDrawer = $("annDrawer");
const btnCloseAnn = $("btnCloseAnn");
const annText = $("annText");
const toggleAnnGod = $("toggleAnnGod");

const timerBackdrop = $("timerBackdrop");
const timerDrawer = $("timerDrawer");
const btnCloseTimer = $("btnCloseTimer");
const timerBig = $("timerBig");
const btnTimerStart = $("btnTimerStart");
const btnTimerPause = $("btnTimerPause");
const btnTimerReset = $("btnTimerReset");

const setBackdrop = $("setBackdrop");
const setDrawer = $("setDrawer");
const btnCloseSet = $("btnCloseSet");
const segEdge = $("segEdge");
const segCity = $("segCity");
const togglePolice = $("togglePolice");
const btnGotoSetup = $("btnGotoSetup");
const btnHardReset = $("btnHardReset");

const roleModal = $("roleModal");
const roleModalTitle = $("roleModalTitle");
const roleModalRole = $("roleModalRole");
const roleModalCamp = $("roleModalCamp");
const btnRoleDone = $("btnRoleDone");
const btnRoleClose = $("btnRoleClose");

const diceModal = $("diceModal");
const diceResult = $("diceResult");
const btnDiceAgain = $("btnDiceAgain");
const btnDiceClose = $("btnDiceClose");

const thiefModal = $("thiefModal");
const thiefHint = $("thiefHint");
const btnThiefA = $("btnThiefA");
const btnThiefB = $("btnThiefB");
const btnThiefClose = $("btnThiefClose");

/* ---------- Storage ---------- */
const LS_KEY = "wwg_god_state_v3";

function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(e){ return null; }
}
function saveState(){
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

/* ---------- Utils ---------- */
function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}
function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }
function nowStr(){
  const d = new Date();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  const hh = String(d.getHours()).padStart(2,"0");
  const mi = String(d.getMinutes()).padStart(2,"0");
  return `${mm}/${dd} ${hh}:${mi}`;
}
function isWolfRole(role){
  return (role||"").includes("狼");
}
function campOf(role){
  return isWolfRole(role) ? "狼人" : "好人";
}

/* ---------- Boards ---------- */
/* 你可以再擴充 boards；目前把最需要的先穩定 */
const BOARDS = [
  {
    id:"official-12",
    n:12,
    title:"12 人官方標準局",
    tags:["官方","穩","含白癡"],
    roles:["狼人","狼人","狼人","狼人","預言家","女巫","獵人","守衛","白痴","平民","平民","平民"],
    hasPolice:true,
    winMode:"edge",
  },
  {
    id:"12-edge-nopolice",
    n:12,
    title:"12 人（屠邊・無上警）",
    tags:["測試","屠邊","無上警"],
    roles:["狼人","狼人","狼人","狼人","預言家","女巫","獵人","守衛","白痴","平民","平民","平民"],
    hasPolice:false,
    winMode:"edge",
  },
  {
    id:"12-city",
    n:12,
    title:"12 人（標準角色・屠城）",
    tags:["測試","屠城"],
    roles:["狼人","狼人","狼人","狼人","預言家","女巫","獵人","守衛","白痴","平民","平民","平民"],
    hasPolice:true,
    winMode:"city",
  },
  {
    id:"12-thief",
    n:12,
    title:"12 人含盜賊（+2 底牌）",
    tags:["盜賊","變體"],
    // 12 張會發給玩家的牌：含盜賊 + 2 平民
    // 再額外加 2 張底牌（固定平民），形成 14 張牌 → 洗牌後有 2 張「未發出的底牌」
    roles:[
      "狼人","狼人","狼人","狼人",
      "預言家","女巫","獵人","守衛","白痴",
      "盜賊",
      "平民","平民",
      // +2底牌（固定平民，底牌是“未發出的那兩張”，但仍在同一個牌庫裡）
      "平民","平民"
    ],
    hasPolice:true,
    winMode:"edge",
  },
];

/* ---------- Game State ---------- */
let state = loadState() || {
  phase:"SETUP",   // SETUP | DEAL | NIGHT | DAY | VOTE
  step:1,

  n:12,
  boardId:"official-12",

  winMode:"edge",
  hasPolice:true,

  godView:false,

  // deal & roles
  deck:[],
  bottom:[],              // 底牌（未發出的兩張）
  seats:[],               // 1..n: {role, alive, seen, marks:{}, death:null}
  dealSeenCount:0,

  // selection
  selectedSeat:null,

  // thief
  thief:{
    seat:null,
    resolved:false,
    options:[],
    chosen:null,
    discarded:null,
  },

  // nights/days
  dayNo:0,        // 0=開局後準備進夜晚1
  nightNo:0,
  nightStepIndex:0,
  nightSteps:[],  // computed each night
  nightActions:[],// log per night

  // vote
  vote:{
    active:false,
    voter:null,
    ballots:{},    // voter -> target
  },

  ann:{
    lines:[],
    showGod:false
  },

  timer:{
    sec:90,
    left:90,
    running:false,
    lastTick:0,
  }
};

/* ---------- Init ---------- */
renderAll();
bindAll();
tickTimer();

/* =========================
   Bindings
   ========================= */
function bindAll(){
  // 人數 chips
  document.querySelectorAll(".chip[data-n]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const n = parseInt(btn.dataset.n,10);
      state.n = n;
      // 自動切到對應的人數板子（先保留 boardId，但會過濾列表）
      state.selectedSeat = null;
      state.phase = "SETUP";
      state.step = 1;
      saveState();
      renderAll();
    });
  });

  // Bottom buttons
  btnBack.addEventListener("click", onBack);
  btnNext.addEventListener("click", onNext);
  btnMain.addEventListener("click", onMain);

  // top buttons
  btnEye.addEventListener("click", ()=>{
    state.godView = !state.godView;
    addAnn(`👁 上帝視角：${state.godView ? "開啟" : "關閉"}`);
    saveState();
    renderSeats();
  });

  // Ann drawer
  btnAnn.addEventListener("click", ()=>openDrawer("ann"));
  btnCloseAnn.addEventListener("click", ()=>closeDrawer("ann"));
  annBackdrop.addEventListener("click", ()=>closeDrawer("ann"));
  toggleAnnGod.addEventListener("change", ()=>{
    state.ann.showGod = !!toggleAnnGod.checked;
    saveState();
    renderAnn();
  });

  // Timer drawer
  btnTimer.addEventListener("click", ()=>openDrawer("timer"));
  btnCloseTimer.addEventListener("click", ()=>closeDrawer("timer"));
  timerBackdrop.addEventListener("click", ()=>closeDrawer("timer"));
  document.querySelectorAll("#timerPresets .chip").forEach(b=>{
    b.addEventListener("click", ()=>{
      const sec = parseInt(b.dataset.sec,10);
      state.timer.sec = sec;
      state.timer.left = sec;
      state.timer.running = false;
      saveState();
      renderTimer();
    });
  });
  btnTimerStart.addEventListener("click", ()=>{
    state.timer.running = true;
    state.timer.lastTick = Date.now();
    saveState();
    renderTimer();
  });
  btnTimerPause.addEventListener("click", ()=>{
    state.timer.running = false;
    saveState();
    renderTimer();
  });
  btnTimerReset.addEventListener("click", ()=>{
    state.timer.left = state.timer.sec;
    state.timer.running = false;
    saveState();
    renderTimer();
  });

  // Settings drawer
  btnSettings.addEventListener("click", ()=>{
    togglePolice.checked = !!state.hasPolice;
    segEdge.classList.toggle("primary", state.winMode==="edge");
    segCity.classList.toggle("primary", state.winMode==="city");
    openDrawer("set");
  });
  btnCloseSet.addEventListener("click", ()=>closeDrawer("set"));
  setBackdrop.addEventListener("click", ()=>closeDrawer("set"));
  segEdge.addEventListener("click", ()=>{
    state.winMode="edge";
    segEdge.classList.add("primary");
    segCity.classList.remove("primary");
    saveState();
  });
  segCity.addEventListener("click", ()=>{
    state.winMode="city";
    segCity.classList.add("primary");
    segEdge.classList.remove("primary");
    saveState();
  });
  togglePolice.addEventListener("change", ()=>{
    state.hasPolice = !!togglePolice.checked;
    saveState();
  });
  btnGotoSetup.addEventListener("click", ()=>{
    resetToSetup(false);
    closeDrawer("set");
  });
  btnHardReset.addEventListener("click", ()=>{
    resetToSetup(true);
    closeDrawer("set");
  });

  // Dice
  btnDice.addEventListener("click", ()=>{
    rollDice();
    openModal("dice");
  });
  btnDiceAgain.addEventListener("click", rollDice);
  btnDiceClose.addEventListener("click", ()=>closeModal("dice"));

  // Role modal
  btnRoleDone.addEventListener("click", ()=>{
    // 看完蓋牌
    if(state._roleViewingSeat){
      const s = state.seats[state._roleViewingSeat-1];
      if(s && !s.seen){
        s.seen = true;
        state.dealSeenCount = state.seats.filter(x=>x.seen).length;
      }
      // 盜賊：看完立刻二選一（在抽身分階段就要選）
      if(s && s.role==="盜賊" && !state.thief.resolved){
        closeModal("role");
        openThiefChoose();
        return;
      }
    }
    closeModal("role");
    state._roleViewingSeat = null;
    saveState();
    renderAll();
  });
  btnRoleClose.addEventListener("click", ()=>{
    closeModal("role");
    state._roleViewingSeat = null;
  });

  // Thief modal
  btnThiefClose.addEventListener("click", ()=>closeModal("thief"));
}

/* =========================
   Navigation handlers
   ========================= */
function onBack(){
  if(state.phase==="SETUP"){
    // no-op
    return;
  }
  if(state.phase==="DEAL"){
    // 回到開局設定
    resetToSetup(false);
    return;
  }
  if(state.phase==="VOTE"){
    // 離開投票回 DAY
    state.phase="DAY";
    state.vote.active=false;
    state.vote.voter=null;
    saveState();
    renderAll();
    return;
  }
  // NIGHT / DAY：先不做回溯太複雜，維持簡單
  addAnn("（提示）此版本不支援流程倒轉。");
}

function onMain(){
  if(state.phase==="DEAL"){
    // 中間按鈕在抽身分階段 = 開始夜晚
    if(!canStartNightFromDeal()){
      return;
    }
    startNight();
    return;
  }

  if(state.phase==="DAY"){
    // 中間按鈕：開始投票
    startVote();
    return;
  }

  if(state.phase==="NIGHT"){
    // 中間按鈕：天亮睜眼（結算夜晚）
    finishNightToDay();
    return;
  }

  if(state.phase==="SETUP"){
    // no-op
  }
}

function onNext(){
  if(state.phase==="SETUP"){
    // 進入抽身分
    const board = getSelectedBoard();
    if(!board){
      addAnn("⚠️ 請先選擇板子。");
      return;
    }
    startDeal(board);
    return;
  }

  if(state.phase==="DEAL"){
    // next 在抽身分階段：通常不使用（由中間開始夜晚）
    if(canStartNightFromDeal()){
      startNight();
    }else{
      addAnn("⚠️ 還有人沒看身分，或盜賊尚未選角。");
    }
    return;
  }

  if(state.phase==="NIGHT"){
    advanceNightStep();
    return;
  }

  if(state.phase==="DAY"){
    // day next：進入夜晚（先讓你主持白天）
    addAnn(`🌙 進入夜晚（由中間按鈕或下一步引導）。`);
    state.phase="NIGHT";
    state.nightNo = Math.max(1, state.nightNo+1);
    buildNightSteps();
    state.nightStepIndex = 0;
    saveState();
    renderAll();
    return;
  }

  if(state.phase==="VOTE"){
    // 結算投票
    finishVote();
    return;
  }
}

/* =========================
   Core: Setup / Deal
   ========================= */
function getBoardsForN(n){
  return BOARDS.filter(b=>b.n===n);
}
function getSelectedBoard(){
  const list = getBoardsForN(state.n);
  return list.find(b=>b.id===state.boardId) || null;
}

function startDeal(board){
  // init seats
  state.phase = "DEAL";
  state.step = 1;
  state.dayNo = 0;
  state.nightNo = 0;
  state.nightStepIndex = 0;
  state.vote = {active:false, voter:null, ballots:{}};

  state.winMode = board.winMode;
  state.hasPolice = board.hasPolice;

  // build deck and shuffle
  state.deck = shuffle([...board.roles]);
  state.bottom = [];
  state.seats = [];
  state.dealSeenCount = 0;
  state.selectedSeat = null;

  state.thief = { seat:null, resolved:false, options:[], chosen:null, discarded:null };

  for(let i=1;i<=board.n;i++){
    const role = state.deck.shift();
    const seatObj = {
      role,
      alive:true,
      seen:false,
      marks:{},
      death:null,     // {reason}
    };
    state.seats.push(seatObj);
    if(role==="盜賊"){
      state.thief.seat = i;
    }
  }
  // remaining are bottom cards (for thief boards, should be 2)
  state.bottom = [...state.deck];
  state.deck = [];

  addAnn(`🎴 開始抽身分（${state.n}人）。`);
  addAnn(`板子：${board.id}`);
  saveState();
  renderAll();
}

function canStartNightFromDeal(){
  // 必須全部都看過；且盜賊若存在需已選角
  const allSeen = (state.seats.filter(s=>s.seen).length === state.n);
  const thiefOk = (!state.thief.seat) || state.thief.resolved;
  return allSeen && thiefOk;
}

/* =========================
   Seats / Interaction
   ========================= */
function seatTap(i){
  if(state.selectedSeat === i){
    state.selectedSeat = null;
  }else{
    state.selectedSeat = i;
  }
  saveState();
  renderSeats();
}

function bindSeatEvents(el, i){
  el.addEventListener("click", (e)=>{
    e.preventDefault();
    e.stopPropagation();
    seatTap(i);

    if(state.phase==="VOTE"){
      voteTap(i);
      return;
    }

    // NIGHT: 依步驟要求點座位
    if(state.phase==="NIGHT"){
      // 只是在夜晚流程中記錄選取，確認在下一步
      return;
    }
  });

  // 長按 0.3 秒看身分（只在 DEAL）
  let pressTimer = null;
  let pressed = false;

  const startPress = (e)=>{
    if(state.phase!=="DEAL") return;
    if(!state.seats[i-1].alive) return;

    pressed = true;
    pressTimer = setTimeout(()=>{
      if(!pressed) return;
      openRoleForSeat(i);
    }, 300);
  };
  const endPress = ()=>{
    pressed = false;
    if(pressTimer){ clearTimeout(pressTimer); pressTimer=null; }
  };

  el.addEventListener("touchstart", (e)=>{ e.preventDefault(); startPress(e); }, {passive:false});
  el.addEventListener("touchend", (e)=>{ e.preventDefault(); endPress(); }, {passive:false});
  el.addEventListener("touchmove", (e)=>{ e.preventDefault(); endPress(); }, {passive:false});

  // desktop fallback
  el.addEventListener("mousedown", startPress);
  el.addEventListener("mouseup", endPress);
  el.addEventListener("mouseleave", endPress);
}

function openRoleForSeat(i){
  const s = state.seats[i-1];
  if(!s) return;

  state._roleViewingSeat = i;

  roleModalTitle.textContent = `${i}號 身分`;
  roleModalRole.textContent  = s.role;
  roleModalCamp.textContent  = `陣營：${campOf(s.role)}`;

  openModal("role");
}

/* =========================
   Thief logic (底牌二選一)
   ========================= */
function openThiefChoose(){
  const seat = state.thief.seat;
  if(!seat) return;

  // options = 底牌兩張（未發出的）
  if(!Array.isArray(state.bottom) || state.bottom.length !== 2){
    // 若不剛好兩張，就保底抽兩張（但正常不會）
    const pool = [...state.bottom];
    shuffle(pool);
    state.bottom = pool.slice(0,2);
  }
  state.thief.options = [...state.bottom];

  const [a,b] = state.thief.options;
  const aWolf = isWolfRole(a);
  const bWolf = isWolfRole(b);

  btnThiefA.disabled = false;
  btnThiefB.disabled = false;

  // 若包含狼 + 好人：必須選狼
  if(aWolf !== bWolf){
    if(aWolf){
      btnThiefB.disabled = true;
      thiefHint.textContent = `底牌：${a} / ${b}（含狼人牌，必須選狼人陣營）`;
    }else{
      btnThiefA.disabled = true;
      thiefHint.textContent = `底牌：${a} / ${b}（含狼人牌，必須選狼人陣營）`;
    }
  }else{
    thiefHint.textContent = `底牌：${a} / ${b}（請二選一；另一張將移出遊戲）`;
  }

  btnThiefA.textContent = a;
  btnThiefB.textContent = b;

  btnThiefA.onclick = ()=>chooseThief(a);
  btnThiefB.onclick = ()=>chooseThief(b);

  openModal("thief");
}

function chooseThief(chosen){
  const seat = state.thief.seat;
  const s = state.seats[seat-1];
  if(!s || s.role!=="盜賊") return;

  const [a,b] = state.thief.options;
  const other = (chosen===a)? b : a;

  // 限制：含狼必選狼
  if(isWolfRole(a) !== isWolfRole(b)){
    if(!isWolfRole(chosen)){
      addAnn("⚠️ 含狼人牌時，盜賊必須選狼人陣營。");
      return;
    }
  }

  // 盜賊變成 chosen；other 移出遊戲；盜賊牌本身消失（已由盜賊玩家占用）
  s.role = chosen;

  state.thief.resolved = true;
  state.thief.chosen = chosen;
  state.thief.discarded = other;

  // 底牌移出遊戲（兩張都清空）
  state.bottom = [];

  addAnn(`🃏 盜賊已選角：成為「${chosen}」，捨棄「${other}」（移出遊戲）`);
  closeModal("thief");

  saveState();
  renderAll();
}

/* =========================
   Night flow
   ========================= */
function startNight(){
  state.phase = "NIGHT";
  state.nightNo = 1;
  state.dayNo = 1;
  buildNightSteps();
  state.nightStepIndex = 0;
  state.selectedSeat = null;

  addAnn(`🌙 夜晚 ${state.nightNo} 開始`);
  saveState();
  renderAll();
}

function buildNightSteps(){
  const roles = state.seats.map(s=>s.role);
  const hasGuard = roles.includes("守衛");
  const hasWolf  = roles.some(r=>isWolfRole(r));
  const hasSeer  = roles.includes("預言家");
  const hasWitch = roles.includes("女巫");

  const steps = [];
  if(hasGuard) steps.push({key:"guard", title:"守衛請閉眼（選擇守護）", needPick:true, multi:false});
  if(hasWolf)  steps.push({key:"wolf",  title:"狼人請閉眼（選擇刀人）",   needPick:true, multi:false});
  if(hasSeer)  steps.push({key:"seer",  title:"預言家請閉眼（查驗一人）", needPick:true, multi:false});
  if(hasWitch) steps.push({key:"witch", title:"女巫請閉眼（解藥 / 毒藥）", needPick:true, multi:false, witch:true});

  state.nightSteps = steps;
}

function currentNightStep(){
  return state.nightSteps[state.nightStepIndex] || null;
}

function advanceNightStep(){
  const step = currentNightStep();
  if(!step){
    // night finished -> day
    finishNightToDay();
    return;
  }

  // 若此步需要選人，必須先點座位
  if(step.needPick && !state.selectedSeat){
    addAnn("⚠️ 請先點選座位。再按「下一步」確認。");
    return;
  }

  // 記錄動作
  const target = state.selectedSeat;

  if(step.key==="guard"){
    addNightAction(`🛡 守衛守護：${target}號`);
    markSeat(target, "shield");
  }
  if(step.key==="wolf"){
    addNightAction(`🐺 狼人刀：${target}號`);
    markSeat(target, "knife");
  }
  if(step.key==="seer"){
    const r = state.seats[target-1].role;
    const camp = campOf(r);
    addNightAction(`🔮 預言家查驗：${target}號 → ${camp}`);
    // 只記到上帝公告的詳細
    state.seats[target-1].marks.seer = camp;
  }
  if(step.key==="witch"){
    // 簡化：點到刀口=救；點其他=毒（同晚只能擇一）
    const knifeTarget = findMarked("knife");
    if(knifeTarget && target===knifeTarget){
      // 救
      addNightAction(`💊 女巫救：${target}號`);
      markSeat(target, "heal");
      // 移除 knife 的死亡效果由天亮結算
    }else{
      addNightAction(`🧪 女巫毒：${target}號`);
      markSeat(target, "poison");
    }
  }

  // 清選取進下一步
  state.selectedSeat = null;
  state.nightStepIndex += 1;
  saveState();
  renderAll();
}

function addNightAction(txt){
  state.nightActions.push(`[N${state.nightNo}] ${txt}`);
  addAnn(txt, true);
}

function finishNightToDay(){
  // 結算（簡化）：knife 目標若被 heal 則存活；poison 必死
  const knife = findMarked("knife");
  const healed = findMarked("heal");
  const poison = findMarked("poison");

  const deaths = [];

  if(poison){
    killSeat(poison, "毒死");
    deaths.push({seat:poison, reason:"毒死"});
  }

  if(knife){
    if(healed && healed===knife){
      // 平安夜（刀口被救）
      markSeat(knife, "saved");
    }else{
      killSeat(knife, "狼刀");
      deaths.push({seat:knife, reason:"狼刀"});
    }
  }

  // 清除刀/救/毒標記（保留 saved 供顯示）
  clearMark("knife");
  clearMark("heal");
  clearMark("poison");

  state.phase = "DAY";
  state.nightStepIndex = 0;
  state.selectedSeat = null;

  const result = deaths.length
    ? `天亮結果：${deaths.map(d=>`${d.seat}號（${d.reason}）`).join("、")}`
    : "天亮結果：平安夜";

  addAnn(`☀️ 白天 ${state.dayNo+1}：${result}`);
  state.dayNo += 1;

  saveState();
  renderAll();
}

/* =========================
   Vote (簡化版：先選投票者→再選被投者)
   下一步：結算
   ========================= */
function startVote(){
  state.phase = "VOTE";
  state.vote.active = true;
  state.vote.voter = null;
  state.vote.ballots = {};
  state.selectedSeat = null;

  addAnn(`🗳 開始投票（先點投票者，再點被投者）`);
  saveState();
  renderAll();
}

function voteTap(i){
  if(!state.vote.active) return;
  const seat = state.seats[i-1];
  if(!seat || !seat.alive) return;

  // 第一次點：投票者
  if(!state.vote.voter){
    state.vote.voter = i;
    addAnn(`投票者：${i}號，請再點選「被投者」`, true);
    saveState();
    renderAll();
    return;
  }

  // 第二次點：被投者
  const voter = state.vote.voter;
  const target = i;

  state.vote.ballots[String(voter)] = target;
  addAnn(`票：${voter} → ${target}`, true);

  // 重置 voter 讓下一個人投
  state.vote.voter = null;
  saveState();
  renderAll();
}

function finishVote(){
  const ballots = state.vote.ballots;
  const entries = Object.entries(ballots).map(([v,t])=>({v:parseInt(v,10), t}));

  // 統計
  const count = {};
  for(const e of entries){
    count[e.t] = (count[e.t]||0)+1;
  }
  const sorted = Object.entries(count).sort((a,b)=>b[1]-a[1]);

  let summary = "投票結果：\n";
  for(const [t,c] of sorted){
    summary += `- ${t}號：${c} 票\n`;
  }
  summary += "\n票型：\n";
  for(const e of entries){
    summary += `${e.v}→${e.t}  `;
  }

  addAnn(`📣 投票結算\n${summary}`);

  // (可再加：最高票放逐 / 平票處理)
  state.phase = "DAY";
  state.vote.active=false;
  state.vote.voter=null;

  saveState();
  renderAll();
}

/* =========================
   Marks / Death
   ========================= */
function markSeat(i, key){
  const s = state.seats[i-1];
  if(!s) return;
  s.marks[key] = true;
}
function clearMark(key){
  for(const s of state.seats){
    delete s.marks[key];
  }
}
function findMarked(key){
  for(let i=1;i<=state.n;i++){
    if(state.seats[i-1]?.marks?.[key]) return i;
  }
  return null;
}
function killSeat(i, reason){
  const s = state.seats[i-1];
  if(!s) return;
  s.alive = false;
  s.death = {reason};
}

/* =========================
   Announce
   ========================= */
function addAnn(line, quiet=false){
  state.ann.lines.unshift(`[${nowStr()}] ${line}`);
  if(!quiet) console.log(line);
  saveState();
  renderAnn();
}

function renderAnn(){
  toggleAnnGod.checked = !!state.ann.showGod;

  let txt = state.ann.lines.slice(0,200).join("\n");
  if(state.ann.showGod){
    txt += "\n\n—— 上帝詳細（座位）——\n";
    for(let i=1;i<=state.n;i++){
      const s = state.seats[i-1];
      if(!s) continue;
      const dead = s.alive ? "" : `（死亡：${s.death?.reason||"?"}）`;
      txt += `${i}號：${s.role}・${campOf(s.role)} ${dead}\n`;
    }
    if(state.thief.seat){
      txt += `\n盜賊：${state.thief.resolved ? `已選「${state.thief.chosen}」，捨棄「${state.thief.discarded}」` : "尚未選角"}\n`;
    }
  }
  annText.textContent = txt;
}

/* =========================
   Timer
   ========================= */
function fmtTime(sec){
  sec = Math.max(0, Math.floor(sec));
  const m = String(Math.floor(sec/60)).padStart(2,"0");
  const s = String(sec%60).padStart(2,"0");
  return `${m}:${s}`;
}
function renderTimer(){
  timerBig.textContent = fmtTime(state.timer.left);
  if(state.timer.left<=0 && state.timer.running){
    state.timer.running=false;
    try{ navigator.vibrate?.(200); }catch(e){}
  }
  saveState();
}
function tickTimer(){
  setInterval(()=>{
    if(!state.timer.running) return;
    const now = Date.now();
    const dt = (now - (state.timer.lastTick||now))/1000;
    state.timer.lastTick = now;
    state.timer.left = Math.max(0, state.timer.left - dt);
    renderTimer();
  }, 250);
}

/* =========================
   Drawers / Modals
   ========================= */
function openDrawer(which){
  if(which==="ann"){
    annBackdrop.classList.remove("hidden");
    annDrawer.classList.remove("hidden");
    renderAnn();
  }
  if(which==="timer"){
    timerBackdrop.classList.remove("hidden");
    timerDrawer.classList.remove("hidden");
    renderTimer();
  }
  if(which==="set"){
    setBackdrop.classList.remove("hidden");
    setDrawer.classList.remove("hidden");
  }
}
function closeDrawer(which){
  if(which==="ann"){
    annBackdrop.classList.add("hidden");
    annDrawer.classList.add("hidden");
  }
  if(which==="timer"){
    timerBackdrop.classList.add("hidden");
    timerDrawer.classList.add("hidden");
  }
  if(which==="set"){
    setBackdrop.classList.add("hidden");
    setDrawer.classList.add("hidden");
  }
}
function openModal(which){
  if(which==="role") roleModal.classList.remove("hidden");
  if(which==="dice") diceModal.classList.remove("hidden");
  if(which==="thief") thiefModal.classList.remove("hidden");
}
function closeModal(which){
  if(which==="role") roleModal.classList.add("hidden");
  if(which==="dice") diceModal.classList.add("hidden");
  if(which==="thief") thiefModal.classList.add("hidden");
}

/* =========================
   Dice
   ========================= */
function rollDice(){
  const alive = [];
  for(let i=1;i<=state.n;i++){
    if(state.seats[i-1]?.alive) alive.push(i);
  }
  if(!alive.length){
    diceResult.textContent="—";
    return;
  }
  const pick = alive[Math.floor(Math.random()*alive.length)];
  diceResult.textContent = `${pick}號`;
}

/* =========================
   Render
   ========================= */
function renderAll(){
  // board list
  renderSetup();
  renderTop();
  renderPrompt();
  renderSeats();
  renderBottomBar();
  renderAnn();
}

function renderTop(){
  uiBoard.textContent = state.boardId || "—";

  // status line
  if(state.phase==="SETUP"){
    uiStatus.textContent = `SETUP / step ${state.step}`;
  }else if(state.phase==="DEAL"){
    uiStatus.textContent = `抽身分（${state.seats.filter(s=>s.seen).length}/${state.n}）`;
  }else if(state.phase==="NIGHT"){
    uiStatus.textContent = `🌙 NIGHT ${state.nightNo} / step ${state.nightStepIndex+1}`;
  }else if(state.phase==="DAY"){
    uiStatus.textContent = `☀️ DAY ${state.dayNo}`;
  }else if(state.phase==="VOTE"){
    uiStatus.textContent = `🗳 投票中`;
  }else{
    uiStatus.textContent = "—";
  }

  // 眼睛顏色
  btnEye.style.opacity = state.godView ? "1" : ".7";
}

function renderPrompt(){
  if(state.phase==="SETUP"){
    promptTitle.textContent = "開局";
    promptText.textContent =
`1) 先選人數
2) 再選板子（點一下會變色）
3) 按底部「下一步」進入抽身分`;
    promptFoot.textContent = "（選完後，開局卡會消失，避免佔畫面）";
    return;
  }

  if(state.phase==="DEAL"){
    const thiefNote = (state.thief.seat && !state.thief.resolved)
      ? "⚠️ 盜賊尚未完成選角（盜賊看完身分會立刻二選一）"
      : "";
    promptTitle.textContent = "抽身分";
    promptText.textContent =
`上帝點選座位（可取消選取） → 玩家長按 0.3 秒看身分 → 按「我看完了」
看完會自動蓋牌（不會露出角色）
全部看完後按「開始夜晚」進入夜晚流程
${thiefNote}`.trim();
    promptFoot.textContent = "";
    return;
  }

  if(state.phase==="NIGHT"){
    const step = currentNightStep();
    promptTitle.textContent = `夜晚 ${state.nightNo}`;
    const list = state.nightSteps.map((s,idx)=>`${idx+1}) ${s.title}`).join("\n");
    const cur = step ? `👉 目前：${state.nightStepIndex+1}. ${step.title}\n（點座位選取；再按「下一步」確認）` : "夜晚結束，請天亮睜眼。";
    promptText.textContent = `夜晚開始：\n${list}\n\n${cur}`;
    promptFoot.textContent = step ? "" : "按中間按鈕「天亮睜眼」進入白天。";
    return;
  }

  if(state.phase==="DAY"){
    promptTitle.textContent = `白天 ${state.dayNo}`;
    promptText.textContent =
`天亮了，請宣佈昨夜結果：
- 公開資訊（死亡/平安夜）
- 然後進入自由發言 →（可上警）→ 推理/辯論 → 投票

按中間「開始投票」進入投票統計。`;
    promptFoot.textContent = "";
    return;
  }

  if(state.phase==="VOTE"){
    promptTitle.textContent = `投票`;
    const voter = state.vote.voter ? `${state.vote.voter}號（等待選被投者）` : "—";
    promptText.textContent =
`投票方式（簡化）：
1) 先點「投票者」
2) 再點「被投者」
會自動記錄一票

目前投票者：${voter}

按「下一步」結算投票結果（含票型）。`;
    promptFoot.textContent = "";
    return;
  }
}

function renderSetup(){
  const isSetup = (state.phase==="SETUP");
  setupCard.classList.toggle("hidden", !isSetup);

  // chips highlight
  document.querySelectorAll(".chip[data-n]").forEach(btn=>{
    btn.classList.toggle("on", parseInt(btn.dataset.n,10)===state.n);
  });

  // build board list
  if(!isSetup) return;

  const list = getBoardsForN(state.n);
  // 若現在 boardId 不在 list，改成第一個
  if(!list.find(b=>b.id===state.boardId) && list[0]){
    state.boardId = list[0].id;
  }

  boardList.innerHTML = "";
  list.forEach(b=>{
    const div = document.createElement("div");
    div.className = "boardItem" + (b.id===state.boardId ? " selected" : "");
    div.innerHTML = `
      <div class="title">${b.title}</div>
      <div class="sub">${b.id} ・ ${summaryRoles(b.roles, b.n)}</div>
      <div class="tags">${b.tags.map(t=>`<span class="tag">${t}</span>`).join("")}</div>
    `;
    div.addEventListener("click", ()=>{
      state.boardId = b.id;
      state.hasPolice = b.hasPolice;
      state.winMode = b.winMode;
      saveState();
      renderSetup();
    });
    boardList.appendChild(div);
  });

  saveState();
}

function summaryRoles(roles, n){
  // 只做簡短摘要：幾狼 + 幾神 + 幾民（盜賊視為神側角色，僅摘要用）
  const deck = [...roles];
  const wolves = deck.filter(isWolfRole).length;
  const gods = deck.filter(r=>["預言家","女巫","獵人","守衛","白痴","盜賊","邱比特"].includes(r)).length;
  const vill = deck.length - wolves - gods;
  const extra = deck.length - n;
  return `${wolves}狼 + ${gods}神 + ${vill}民${extra>0?` + 底牌${extra}`:""}`;
}

function renderSeats(){
  seatsGrid.innerHTML = "";
  for(let i=1;i<=state.n;i++){
    const s = state.seats[i-1] || {role:"—", alive:true, seen:false, marks:{}};

    const el = document.createElement("div");
    el.className = "seat";

    // selected
    if(state.selectedSeat===i) el.classList.add("selected");
    if(!s.alive) el.classList.add("dead");

    // god view camp color
    if(state.godView && state.phase!=="SETUP"){
      el.classList.add("god");
      el.classList.add(isWolfRole(s.role) ? "wolf" : "good");
    }

    // badges for events
    const badges = [];
    if(s.marks.shield) badges.push("🛡");
    if(s.marks.knife) badges.push("🗡");
    if(s.marks.heal || s.marks.saved) badges.push("💊");
    if(s.marks.poison) badges.push("🧪");
    if(s.death?.reason){
      if(s.death.reason==="狼刀") badges.push("🐺");
      if(s.death.reason==="毒死") badges.push("☠️");
    }

    const showRoleLine = state.godView && state.phase!=="SETUP";
    const line1 = showRoleLine ? `${s.role}・${campOf(s.role)}` :
      (state.phase==="DEAL"
        ? (s.seen ? "已看" : "長按看身分")
        : " ");

    el.innerHTML = `
      <div class="badges">${badges.map(b=>`<span class="badge">${b}</span>`).join("")}</div>
      <div class="num">${i}</div>
      <div class="line">${line1}</div>
    `;

    bindSeatEvents(el, i);
    seatsGrid.appendChild(el);
  }
}

function renderBottomBar(){
  // middle button label depends on phase
  if(state.phase==="SETUP"){
    btnMain.textContent = "—";
    btnMain.disabled = true;
    btnNext.disabled = false;
    btnBack.disabled = true;
    return;
  }

  if(state.phase==="DEAL"){
    btnMain.textContent = "開始夜晚";
    btnMain.disabled = !canStartNightFromDeal();
    btnNext.disabled = false;  // next 也可嘗試開始
    btnBack.disabled = false;
    return;
  }

  if(state.phase==="NIGHT"){
    btnMain.textContent = "天亮睜眼";
    btnMain.disabled = false;
    btnNext.disabled = false;
    btnBack.disabled = false;
    return;
  }

  if(state.phase==="DAY"){
    btnMain.textContent = "開始投票";
    btnMain.disabled = false;
    btnNext.disabled = false;
    btnBack.disabled = false;
    return;
  }

  if(state.phase==="VOTE"){
    btnMain.textContent = "—";
    btnMain.disabled = true;
    btnNext.disabled = false; // next=結算
    btnBack.disabled = false;
    return;
  }
}

/* =========================
   Reset
   ========================= */
function resetToSetup(hard){
  if(hard){
    localStorage.removeItem(LS_KEY);
    state = {
      phase:"SETUP",
      step:1,
      n:12,
      boardId:"official-12",
      winMode:"edge",
      hasPolice:true,
      godView:false,
      deck:[],
      bottom:[],
      seats:[],
      dealSeenCount:0,
      selectedSeat:null,
      thief:{ seat:null, resolved:false, options:[], chosen:null, discarded:null },
      dayNo:0,
      nightNo:0,
      nightStepIndex:0,
      nightSteps:[],
      nightActions:[],
      vote:{active:false, voter:null, ballots:{}},
      ann:{lines:[], showGod:false},
      timer:{sec:90,left:90,running:false,lastTick:0}
    };
    saveState();
    renderAll();
    return;
  }

  state.phase="SETUP";
  state.step=1;
  state.deck=[];
  state.bottom=[];
  state.seats=[];
  state.dealSeenCount=0;
  state.selectedSeat=null;
  state.thief={ seat:null, resolved:false, options:[], chosen:null, discarded:null };
  state.dayNo=0;
  state.nightNo=0;
  state.nightStepIndex=0;
  state.nightSteps=[];
  state.nightActions=[];
  state.vote={active:false, voter:null, ballots:{}};

  addAnn("↩️ 回到開局（可重選人數/板子）");
  saveState();
  renderAll();
}