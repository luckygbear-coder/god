/* =========================
   Werewolf God Helper (vNext)
   - Mobile first, no page scroll
   - Disable iOS long-press selection + double-tap zoom
   - Setup -> Deal -> Game flow
   - Night order: Guard -> Wolves -> Seer -> Witch (as user specified)
   - Eye (god view) overlays info on seat tiles
   - Announcements drawer (public / god details)
   - Timer drawer w/ presets incl 90s
========================= */

const STORAGE_KEY = "ww_god_vnext_v1";

/* ---------- iOS anti-zoom / anti-selection (best effort) ---------- */
(function preventIOSGestures(){
  // block double tap zoom (Safari)
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive:false });

  // prevent pinch zoom gesture (some browsers)
  document.addEventListener("gesturestart", (e)=> e.preventDefault(), { passive:false });

  // prevent context menu
  document.addEventListener("contextmenu", (e)=> e.preventDefault());

  // prevent text selection
  document.addEventListener("selectstart", (e)=> e.preventDefault());
})();

/* ---------- Board fallback ---------- */
const BOARD_FALLBACK = [
  {
    id:"official-12",
    name:"12 人官方標準局",
    tags:["官方","穩","含白癡"],
    players:12,
    config:{
      wolves:4,
      villagers:4,
      gods:["seer","witch","guard","hunter"],
      extras:["idiot"] // 白癡
    },
    desc:"4狼 + 預言家/女巫/守衛/獵人 + 4民"
  },
  {
    id:"12-city",
    name:"12 人（標準角色・屠城）",
    tags:["測試","屠城"],
    players:12,
    config:{
      wolves:4,
      villagers:4,
      gods:["seer","witch","guard","hunter"],
      extras:["idiot"]
    },
    desc:"同標準角色，勝負改屠城（可在設定切）"
  },
  {
    id:"12-edge-nopolice",
    name:"12 人（屠邊・無上警）",
    tags:["測試","無上警"],
    players:12,
    config:{
      wolves:4,
      villagers:4,
      gods:["seer","witch","guard","hunter"],
      extras:["idiot"]
    },
    desc:"同標準角色，但關閉上警"
  },
  {
    id:"official-10",
    name:"10 人官方標準局",
    tags:["官方","10人"],
    players:10,
    config:{
      wolves:3,
      villagers:3,
      gods:["seer","witch","guard","hunter"],
      extras:[]
    },
    desc:"3狼 + 預言家/女巫/守衛/獵人 + 3民"
  },
  {
    id:"official-9",
    name:"9 人官方標準局",
    tags:["官方","9人"],
    players:9,
    config:{
      wolves:3,
      villagers:3,
      gods:["seer","witch","guard"],
      extras:[]
    },
    desc:"3狼 + 預言家/女巫/守衛 + 3民"
  },
  /* 你要的擴充角色池示例板子（可再加更多） */
  {
    id:"12-cupid-thief",
    name:"12 人（邱比特 + 盜賊）",
    tags:["擴充","盜賊","邱比特"],
    players:12,
    config:{
      wolves:4,
      villagers:4,
      gods:["seer","witch","guard","hunter"],
      extras:["cupid","thief"]
    },
    desc:"含邱比特與盜賊（第一晚特殊流程）"
  }
];

/* ---------- Role meta ---------- */
const ROLE_META = {
  villager:{ key:"villager", name:"平民", camp:"good" },
  wolf:{ key:"wolf", name:"狼人", camp:"wolf" },

  seer:{ key:"seer", name:"預言家", camp:"good" },
  witch:{ key:"witch", name:"女巫", camp:"good" },
  guard:{ key:"guard", name:"守衛", camp:"good" },
  hunter:{ key:"hunter", name:"獵人", camp:"good" },
  idiot:{ key:"idiot", name:"白癡", camp:"good" },

  cupid:{ key:"cupid", name:"邱比特", camp:"good" },
  thief:{ key:"thief", name:"盜賊", camp:"good" },
};

/* ---------- State ---------- */
function defaultState(){
  return {
    phase:"SETUP",     // SETUP | DEAL | GAME
    stepIndex:0,       // within phase flow
    day:1,
    isNight:true,      // within GAME
    mainAction:"天黑閉眼",
    selectedSeat:null, // current action target
    godView:false,     // 👁 overlay
    policeEnabled:true,
    winMode:"edge",    // edge | city

    setup:{
      players:12,
      boardId:"official-12",
      custom:{
        wolves:4,
        villagers:4,
        gods:{ seer:true, witch:true, guard:true, hunter:true, idiot:false, cupid:false, thief:false },
      }
    },

    // seat model
    seats:[], // filled after setup apply
    // deal
    dealt:false,
    // witch resources
    witch:{
      heal:true, poison:true,
      healTarget:null,
      poisonTarget:null
    },
    // cupid
    cupid:{ lovers:[] }, // [a,b]
    // thief (future extension)
    thief:{ chosenRole:null, offered:[] , discarded:null },

    // per-night choices (for announcement)
    night:{
      guardTarget:null,
      wolvesTarget:null,
      seerTarget:null,
      seerResult:null,
      // witch handled in witch.*
    },

    // vote
    vote:{
      // map target -> voters array; target can be number or "abstain"
      records:{},
      result:null
    },

    // announcements log
    ann:{
      entries:[] // {title, publicText, godText, ts}
    },

    // timer
    timer:{
      total:90,
      left:90,
      running:false,
      lastTick:0
    }
  };
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultState();
    const s = JSON.parse(raw);
    return { ...defaultState(), ...s };
  }catch{
    return defaultState();
  }
}
function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------- DOM ---------- */
const $ = (sel)=> document.querySelector(sel);

const uiStatus = $("#uiStatus");
const uiBoard  = $("#uiBoard");

const promptTitle = $("#promptTitle");
const promptText  = $("#promptText");
const promptFoot  = $("#promptFoot");

const setupCard  = $("#setupCard");
const boardList  = $("#boardList");
const boardHint  = $("#boardHint");

const seatsGrid  = $("#seatsGrid");

const btnBack = $("#btnBack");
const btnMain = $("#btnMain");
const btnNext = $("#btnNext");

const btnTimer = $("#btnTimer");
const btnDice  = $("#btnDice");
const btnEye   = $("#btnEye");
const btnAnn   = $("#btnAnn");
const btnSettings = $("#btnSettings");

/* timer drawer */
const timerBackdrop = $("#timerBackdrop");
const timerDrawer = $("#timerDrawer");
const btnCloseTimer = $("#btnCloseTimer");
const timerBig = $("#timerBig");
const timerPresets = $("#timerPresets");
const btnTimerStart = $("#btnTimerStart");
const btnTimerPause = $("#btnTimerPause");
const btnTimerReset = $("#btnTimerReset");

/* ann drawer */
const annBackdrop = $("#annBackdrop");
const annDrawer = $("#annDrawer");
const btnCloseAnn = $("#btnCloseAnn");
const annText = $("#annText");
const toggleAnnGod = $("#toggleAnnGod");

/* settings drawer */
const setBackdrop = $("#setBackdrop");
const setDrawer = $("#setDrawer");
const btnCloseSet = $("#btnCloseSet");
const segEdge = $("#segEdge");
const segCity = $("#segCity");
const togglePolice = $("#togglePolice");
const btnGotoSetup = $("#btnGotoSetup");
const btnHardReset = $("#btnHardReset");

const numWolves = $("#numWolves");
const numVillagers = $("#numVillagers");
const godChecks = $("#godChecks");
const btnApplyCustom = $("#btnApplyCustom");

/* role modal */
const roleModal = $("#roleModal");
const roleModalTitle = $("#roleModalTitle");
const roleModalRole  = $("#roleModalRole");
const roleModalCamp  = $("#roleModalCamp");
const btnRoleDone = $("#btnRoleDone");
const btnRoleClose = $("#btnRoleClose");

/* dice modal */
const diceModal = $("#diceModal");
const diceResult = $("#diceResult");
const btnDiceAgain = $("#btnDiceAgain");
const btnDiceClose = $("#btnDiceClose");

/* ---------- helpers ---------- */
function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }
function fmtTime(sec){
  sec = Math.max(0, Math.floor(sec));
  const m = String(Math.floor(sec/60)).padStart(2,"0");
  const s = String(sec%60).padStart(2,"0");
  return `${m}:${s}`;
}
function nowTs(){ return Date.now(); }
function vibrate(ms=250){
  try{ if(navigator.vibrate) navigator.vibrate(ms); }catch{}
}
function campLabel(c){
  if(c==="wolf") return "陣營：狼";
  if(c==="good") return "陣營：好人";
  return "陣營：—";
}
function getBoard(){
  return BOARD_FALLBACK.find(b=>b.id===state.setup.boardId) || BOARD_FALLBACK[0];
}
function roleName(key){
  return ROLE_META[key]?.name || key;
}
function roleCamp(key){
  return ROLE_META[key]?.camp || "good";
}

/* ---------- Initialize ---------- */
let state = loadState();

/* ensure seats exist */
function ensureSeats(){
  const n = state.setup.players;
  if(!Array.isArray(state.seats) || state.seats.length !== n){
    state.seats = Array.from({length:n}, (_,i)=>({
      id:i+1,
      alive:true,
      role:null,
      camp:null,
      viewed:false,
      marks:{
        diedBy:null,      // "wolf" | "poison" | "shot" | ...
        killedBy:null,
        savedBy:null,
        poisonedBy:null,
        guardedBy:null,
        // future: blackwolf, whitewolf etc
      }
    }));
    state.dealt = false;
    state.selectedSeat = null;
    state.witch = { heal:true, poison:true, healTarget:null, poisonTarget:null };
    state.cupid = { lovers:[] };
    state.thief = { chosenRole:null, offered:[], discarded:null };
    state.night = { guardTarget:null, wolvesTarget:null, seerTarget:null, seerResult:null };
    state.vote = { records:{}, result:null };
    state.ann = { entries:[] };
  }
}

/* ---------- Setup UI ---------- */
function renderBoardList(){
  boardList.innerHTML = "";
  const n = state.setup.players;
  const boards = BOARD_FALLBACK.filter(b=>b.players===n);

  if(boards.length===0){
    boardHint.textContent = "找不到此人數板子（fallback）";
    return;
  }
  boardHint.textContent = "請點選一個板子套用（會變色）";

  for(const b of boards){
    const div = document.createElement("div");
    div.className = "boardItem" + (state.setup.boardId===b.id ? " active":"");
    div.dataset.id = b.id;
    div.innerHTML = `
      <div class="boardName">${b.name}</div>
      <div class="boardSub">${b.id} ・ ${b.desc}</div>
      <div class="tags">
        ${b.tags.map(t=>`<span class="tag">${t}</span>`).join("")}
      </div>
    `;
    div.addEventListener("click", ()=>{
      state.setup.boardId = b.id;
      // preset police for special board
      if(b.id.includes("nopolice")) state.policeEnabled = false;
      saveState();
      render();
    });
    boardList.appendChild(div);
  }
}

/* ---------- Deal roles ---------- */
function buildRoleListFromBoard(board){
  // board config is base. Then allow custom overrides via settings custom apply (handled elsewhere)
  const roles = [];
  for(let i=0;i<board.config.wolves;i++) roles.push("wolf");
  for(let i=0;i<board.config.villagers;i++) roles.push("villager");
  for(const g of board.config.gods) roles.push(g);
  for(const e of (board.config.extras||[])) roles.push(e);
  return roles;
}
function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]] = [arr[j],arr[i]];
  }
  return arr;
}
function deal(){
  ensureSeats();
  const board = getBoard();
  const roleList = buildRoleListFromBoard(board);

  // fit to players (safety)
  const n = state.setup.players;
  while(roleList.length < n) roleList.push("villager");
  while(roleList.length > n) roleList.pop();

  shuffle(roleList);
  state.seats.forEach((s,idx)=>{
    s.role = roleList[idx];
    s.camp = roleCamp(s.role);
    s.viewed = false;
    s.alive = true;
    s.marks = { diedBy:null, killedBy:null, savedBy:null, poisonedBy:null, guardedBy:null };
  });

  // reset night resources
  state.witch = { heal:true, poison:true, healTarget:null, poisonTarget:null };
  state.night = { guardTarget:null, wolvesTarget:null, seerTarget:null, seerResult:null };
  state.vote = { records:{}, result:null };
  state.cupid = { lovers:[] };
  state.thief = { chosenRole:null, offered:[], discarded:null };

  state.dealt = true;
  state.phase = "DEAL";
  state.stepIndex = 0;
  state.selectedSeat = null;

  pushAnn("抽身分開始", "請玩家依序查看身分。", `板子：${board.id}\n人數：${n}\n已產生身分。`);
  saveState();
}

/* ---------- Flow / prompts ---------- */
function setStatus(){
  const b = getBoard();
  uiBoard.textContent = b.id;
  uiStatus.textContent = `${state.phase}${state.phase==="GAME" ? ` / Day${state.day} / ${state.isNight ? "Night":"Day"}`:""}`;
}
function currentPrompt(){
  const board = getBoard();
  if(state.phase==="SETUP"){
    return {
      title:"設定：選板子",
      text:
`請先選人數與板子（點一下會變色）。
套用後按「下一步」進入抽身分。`,
      foot:"提示：遊戲中想重選板子 → ⚙️ 設定 → 回到開局"
    };
  }

  if(state.phase==="DEAL"){
    return {
      title:"抽身分",
      text:
`請將手機交給玩家，長按座位 0.3 秒查看身分。
全部看完後按「下一步」進入遊戲。`,
      foot:`已看完：${state.seats.filter(s=>s.viewed).length}/${state.seats.length}`
    };
  }

  // GAME
  if(state.isNight){
    // Your order: Guard -> Wolves -> Seer -> Witch
    const steps = [
      { key:"guard", title:"守衛請睜眼", hint:"（選擇守護）", action:"GUARD" },
      { key:"wolves", title:"狼人請睜眼", hint:"（選擇刀人）", action:"WOLVES" },
      { key:"seer", title:"預言家請睜眼", hint:"（查驗一人）", action:"SEER" },
      { key:"witch", title:"女巫請睜眼", hint:"（解藥 / 毒藥）", action:"WITCH" },
    ];
    const i = clamp(state.stepIndex, 0, steps.length-1);
    const st = steps[i];

    // dynamic hints
    let extra = "";
    if(st.action==="WITCH"){
      extra =
`女巫狀態：
💊 解藥：${state.witch.heal ? "可用" : "已用"}
🧪 毒藥：${state.witch.poison ? "可用" : "已用"}

操作：
- 點「刀口」座位 => 用解藥救（若可用）
- 點「其他」座位 => 用毒藥毒（若可用）
- 再點同一格可取消
（同一晚只能救或毒其一）`;
    }

    return {
      title:`🌙 夜晚 ${state.day}`,
      text:
`流程：
1) 守衛請睜眼（選擇守護）
2) 狼人請睜眼（選擇刀人）
3) 預言家請睜眼（查驗一人）
4) 女巫請睜眼（解藥 / 毒藥）

現在：${st.title} ${st.hint}

👉 依序按「下一步」提示
${extra ? "\n\n" + extra : ""}`,
      foot:`步驟 ${i+1}/${steps.length} ・ 目前選取：${state.selectedSeat ?? "（無）"}`
    };
  }else{
    return {
      title:`☀️ 白天 ${state.day}`,
      text:
`白天流程（你可用📣回顧）：
- 公告昨夜結果
- 進入發言 / 投票
- 投票結算後按「下一步」進入天黑

提示：
- 🎲 可抽存活座位發言順序
- 👁 可切上帝視角（座位格顯示角色與事件）`,
      foot:""
    };
  }
}

/* ---------- Announcements ---------- */
function pushAnn(title, publicText, godText){
  state.ann.entries.push({
    title,
    publicText,
    godText,
    ts: nowTs()
  });
}
function renderAnn(){
  const showGod = !!toggleAnnGod.checked;
  const lines = [];
  if(state.ann.entries.length===0){
    lines.push("（尚無公告）");
  }else{
    for(const e of state.ann.entries.slice().reverse()){
      const dt = new Date(e.ts);
      const t = `${String(dt.getHours()).padStart(2,"0")}:${String(dt.getMinutes()).padStart(2,"0")}`;
      lines.push(`【${t}】${e.title}`);
      lines.push(showGod ? e.godText : e.publicText);
      lines.push("");
    }
  }
  annText.textContent = lines.join("\n");
}

/* ---------- Seat rendering ---------- */
function seatDisplayLines(s){
  // Base line
  const n = `${s.id}號`;
  const alive = s.alive ? "存活" : "死亡";

  if(!state.godView){
    return { n, s: alive, g:"" };
  }

  // God view: show role/camp + marks
  const role = s.role ? roleName(s.role) : "—";
  const camp = s.camp==="wolf" ? "狼" : "好";
  const marks = [];

  // night marks
  if(state.night.wolvesTarget===s.id) marks.push("🐺狼刀");
  if(state.night.guardTarget===s.id) marks.push("🛡守");
  if(state.witch.healTarget===s.id) marks.push("💊救");
  if(state.witch.poisonTarget===s.id) marks.push("🧪毒");
  if(state.cupid.lovers.includes(s.id)) marks.push("💘戀");

  // died reason if dead
  if(!s.alive && s.marks?.diedBy){
    const map = {
      wolf:"🐺刀死",
      poison:"🧪毒死",
      shot:"🔫槍殺",
      vote:"📮放逐",
    };
    marks.push(map[s.marks.diedBy] || `✖ ${s.marks.diedBy}`);
  }

  return {
    n,
    s: `${alive}`,
    g: `${role}（${camp}）${marks.length?`\n${marks.join(" ")}`:""}`
  };
}
function renderSeats(){
  seatsGrid.innerHTML = "";
  const n = state.seats.length;

  // During SETUP: do not show seats (you asked)
  if(state.phase==="SETUP"){
    seatsGrid.classList.add("hidden");
    $("#seatsHeader").classList.add("hidden");
    return;
  }else{
    seatsGrid.classList.remove("hidden");
    $("#seatsHeader").classList.remove("hidden");
  }

  for(const s of state.seats){
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "seat" +
      (!s.alive ? " dead":"") +
      (state.selectedSeat===s.id ? " selected":"");

    // marks outline
    if(state.godView && s.camp==="wolf") btn.classList.add("markBad");
    if(state.godView && s.camp==="good") btn.classList.add("markGood");

    const d = seatDisplayLines(s);
    btn.innerHTML = `
      <div class="n">${d.n}</div>
      <div class="s">${d.s}</div>
      ${d.g ? `<div class="g">${d.g.replace(/\n/g,"<br>")}</div>` : ""}
    `;

    // Click behavior
    btn.addEventListener("click", ()=>{
      // toggle selection (you requested)
      if(state.selectedSeat===s.id){
        state.selectedSeat = null;
      }else{
        state.selectedSeat = s.id;
      }
      saveState();
      render();
    });

    // Deal reveal: long press 0.3s
    if(state.phase==="DEAL"){
      let pressTimer = null;
      const start = (e)=>{
        e.preventDefault();
        pressTimer = setTimeout(()=>{
          openRoleModal(s.id);
        }, 300);
      };
      const cancel = ()=>{
        if(pressTimer){ clearTimeout(pressTimer); pressTimer=null; }
      };
      btn.addEventListener("touchstart", start, {passive:false});
      btn.addEventListener("touchend", cancel);
      btn.addEventListener("touchmove", cancel);
      btn.addEventListener("mousedown", start);
      btn.addEventListener("mouseup", cancel);
      btn.addEventListener("mouseleave", cancel);
    }

    seatsGrid.appendChild(btn);
  }
}

/* ---------- Role modal ---------- */
function openRoleModal(seatId){
  const s = state.seats.find(x=>x.id===seatId);
  if(!s) return;

  roleModalTitle.textContent = `${seatId}號 身分`;
  roleModalRole.textContent = roleName(s.role || "—");
  roleModalCamp.textContent = campLabel(s.camp);

  roleModal.classList.remove("hidden");
  roleModal.setAttribute("aria-hidden","false");
}
function closeRoleModal(){
  roleModal.classList.add("hidden");
  roleModal.setAttribute("aria-hidden","true");
}
btnRoleDone.addEventListener("click", ()=>{
  const title = roleModalTitle.textContent || "";
  const m = title.match(/^(\d+)號/);
  if(m){
    const id = Number(m[1]);
    const s = state.seats.find(x=>x.id===id);
    if(s) s.viewed = true;
  }
  saveState();
  closeRoleModal();
  render();
});
btnRoleClose.addEventListener("click", ()=>{
  closeRoleModal();
});

/* ---------- Drawers ---------- */
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

/* timer drawer */
btnTimer.addEventListener("click", ()=>{
  openDrawer(timerBackdrop, timerDrawer);
  renderTimer();
});
btnCloseTimer.addEventListener("click", ()=> closeDrawer(timerBackdrop, timerDrawer));
timerBackdrop.addEventListener("click", ()=> closeDrawer(timerBackdrop, timerDrawer));

/* ann drawer */
btnAnn.addEventListener("click", ()=>{
  openDrawer(annBackdrop, annDrawer);
  renderAnn();
});
btnCloseAnn.addEventListener("click", ()=> closeDrawer(annBackdrop, annDrawer));
annBackdrop.addEventListener("click", ()=> closeDrawer(annBackdrop, annDrawer));
toggleAnnGod.addEventListener("change", ()=> renderAnn());

/* settings drawer */
btnSettings.addEventListener("click", ()=>{
  openDrawer(setBackdrop, setDrawer);
  renderSettingsUI();
});
btnCloseSet.addEventListener("click", ()=> closeDrawer(setBackdrop, setDrawer));
setBackdrop.addEventListener("click", ()=> closeDrawer(setBackdrop, setDrawer));

/* ---------- Timer logic ---------- */
function renderTimer(){
  timerBig.textContent = fmtTime(state.timer.left);
}
function setTimer(sec){
  state.timer.total = sec;
  state.timer.left = sec;
  state.timer.running = false;
  state.timer.lastTick = 0;
  saveState();
  renderTimer();
}
timerPresets.addEventListener("click", (e)=>{
  const btn = e.target.closest("button[data-sec]");
  if(!btn) return;
  const sec = Number(btn.dataset.sec);
  setTimer(sec);
});
btnTimerStart.addEventListener("click", ()=>{
  if(state.timer.left<=0) state.timer.left = state.timer.total;
  state.timer.running = true;
  state.timer.lastTick = Date.now();
  saveState();
});
btnTimerPause.addEventListener("click", ()=>{
  state.timer.running = false;
  saveState();
});
btnTimerReset.addEventListener("click", ()=>{
  state.timer.left = state.timer.total;
  state.timer.running = false;
  saveState();
  renderTimer();
});
function tickTimer(){
  if(!state.timer.running) return;
  const t = Date.now();
  const dt = (t - (state.timer.lastTick || t)) / 1000;
  state.timer.lastTick = t;
  state.timer.left -= dt;
  if(state.timer.left <= 0){
    state.timer.left = 0;
    state.timer.running = false;
    vibrate(400);
  }
  saveState();
  renderTimer();
}

/* ---------- Dice ---------- */
function openDice(){
  diceModal.classList.remove("hidden");
  diceModal.setAttribute("aria-hidden","false");
  rollDice();
}
function closeDice(){
  diceModal.classList.add("hidden");
  diceModal.setAttribute("aria-hidden","true");
}
function rollDice(){
  const alive = state.seats.filter(s=>s.alive).map(s=>s.id);
  if(alive.length===0){
    diceResult.textContent = "（無存活）";
    return;
  }
  const pick = alive[Math.floor(Math.random()*alive.length)];
  diceResult.textContent = `${pick} 號`;
}
btnDice.addEventListener("click", ()=> openDice());
btnDiceAgain.addEventListener("click", ()=> rollDice());
btnDiceClose.addEventListener("click", ()=> closeDice());

/* ---------- Eye (god view) ---------- */
btnEye.addEventListener("click", ()=>{
  state.godView = !state.godView;
  saveState();
  render();
});

/* ---------- Settings ---------- */
function renderSettingsUI(){
  // seg
  segEdge.classList.toggle("active", state.winMode==="edge");
  segCity.classList.toggle("active", state.winMode==="city");
  togglePolice.checked = !!state.policeEnabled;

  // steppers
  numWolves.textContent = String(state.setup.custom.wolves);
  numVillagers.textContent = String(state.setup.custom.villagers);

  // god checks
  const keys = ["seer","witch","hunter","guard","idiot","cupid","thief"];
  godChecks.innerHTML = "";
  for(const k of keys){
    const div = document.createElement("label");
    div.className = "check";
    div.innerHTML = `<span>${roleName(k)}</span><input type="checkbox" data-g="${k}">`;
    const input = div.querySelector("input");
    input.checked = !!state.setup.custom.gods[k];
    input.addEventListener("change", ()=>{
      state.setup.custom.gods[k] = !!input.checked;
      saveState();
    });
    godChecks.appendChild(div);
  }
}
segEdge.addEventListener("click", ()=>{ state.winMode="edge"; saveState(); renderSettingsUI(); });
segCity.addEventListener("click", ()=>{ state.winMode="city"; saveState(); renderSettingsUI(); });
togglePolice.addEventListener("change", ()=>{
  state.policeEnabled = !!togglePolice.checked;
  saveState();
});

document.addEventListener("click", (e)=>{
  const b = e.target.closest(".stepBtn");
  if(!b) return;
  const key = b.dataset.step;
  const d = Number(b.dataset.d);
  if(key==="wolves"){
    state.setup.custom.wolves = clamp(state.setup.custom.wolves + d, 1, 10);
  }else if(key==="villagers"){
    state.setup.custom.villagers = clamp(state.setup.custom.villagers + d, 0, 12);
  }
  saveState();
  renderSettingsUI();
});

btnApplyCustom.addEventListener("click", ()=>{
  // Apply custom config and re-deal immediately
  const n = state.setup.players;
  const gods = Object.entries(state.setup.custom.gods)
    .filter(([,v])=>v)
    .map(([k])=>k);

  // Build a custom board snapshot
  const customBoard = {
    id:"custom",
    name:"自訂板子",
    players:n,
    config:{
      wolves: state.setup.custom.wolves,
      villagers: state.setup.custom.villagers,
      gods: gods.filter(k=>["seer","witch","guard","hunter"].includes(k)),
      extras: gods.filter(k=>["idiot","cupid","thief"].includes(k)),
    }
  };

  // Store by overwriting current boardId to a compatible fallback? keep boardId but use custom only for deal
  state.setup.boardId = state.setup.boardId || "official-12";
  // perform deal using custom role list
  ensureSeats();
  const roles = [];
  for(let i=0;i<customBoard.config.wolves;i++) roles.push("wolf");
  for(let i=0;i<customBoard.config.villagers;i++) roles.push("villager");
  for(const g of customBoard.config.gods) roles.push(g);
  for(const e of (customBoard.config.extras||[])) roles.push(e);

  while(roles.length < n) roles.push("villager");
  while(roles.length > n) roles.pop();
  shuffle(roles);

  state.seats.forEach((s,idx)=>{
    s.role = roles[idx];
    s.camp = roleCamp(s.role);
    s.viewed = false;
    s.alive = true;
    s.marks = { diedBy:null, killedBy:null, savedBy:null, poisonedBy:null, guardedBy:null };
  });

  state.phase = "DEAL";
  state.stepIndex = 0;
  state.dealt = true;
  state.selectedSeat = null;
  state.witch = { heal:true, poison:true, healTarget:null, poisonTarget:null };
  state.night = { guardTarget:null, wolvesTarget:null, seerTarget:null, seerResult:null };
  state.vote = { records:{}, result:null };
  state.cupid = { lovers:[] };
  state.thief = { chosenRole:null, offered:[], discarded:null };
  state.ann.entries = [];

  pushAnn("套用自訂配置", "已重抽身分。", `自訂：狼${customBoard.config.wolves}／民${customBoard.config.villagers}\n神職：${gods.map(roleName).join("、")||"（無）"}`);
  saveState();
  closeDrawer(setBackdrop, setDrawer);
  render();
});

btnGotoSetup.addEventListener("click", ()=>{
  state.phase = "SETUP";
  state.stepIndex = 0;
  state.dealt = false;
  state.selectedSeat = null;
  saveState();
  closeDrawer(setBackdrop, setDrawer);
  render();
});
btnHardReset.addEventListener("click", ()=>{
  localStorage.removeItem(STORAGE_KEY);
  state = defaultState();
  ensureSeats();
  saveState();
  closeDrawer(setBackdrop, setDrawer);
  render();
});

/* ---------- Setup chips ---------- */
document.addEventListener("click", (e)=>{
  const chip = e.target.closest(".chip[data-n]");
  if(!chip) return;
  const n = Number(chip.dataset.n);
  state.setup.players = n;
  // pick default board for that n
  const first = BOARD_FALLBACK.find(b=>b.players===n) || BOARD_FALLBACK[0];
  state.setup.boardId = first.id;

  ensureSeats();
  saveState();
  render();
});

/* ---------- Buttons behavior ---------- */
btnBack.addEventListener("click", ()=>{
  // general back: stepIndex--
  if(state.phase==="SETUP"){
    // nothing
    return;
  }
  if(state.phase==="DEAL"){
    // back to setup
    state.phase = "SETUP";
    state.stepIndex = 0;
    state.dealt = false;
    state.selectedSeat = null;
    saveState();
    render();
    return;
  }
  // GAME
  if(state.isNight){
    state.stepIndex = clamp(state.stepIndex - 1, 0, 3);
    state.selectedSeat = null;
  }else{
    // go back to night (rare)
    state.isNight = true;
    state.stepIndex = 3;
  }
  saveState();
  render();
});

btnMain.addEventListener("click", ()=>{
  // Important flow toggle
  if(state.phase==="SETUP"){
    return;
  }
  if(state.phase==="DEAL"){
    // no main action
    return;
  }
  // GAME: toggle day/night
  if(state.isNight){
    // End night -> compute night result and announce morning
    resolveNightAndAnnounce();
    state.isNight = false;
    state.stepIndex = 0;
    btnMain.textContent = "開始投票";
  }else{
    // End day -> go night
    state.day += 1;
    state.isNight = true;
    state.stepIndex = 0;
    btnMain.textContent = "天亮睜眼";
    // clear selections for new night
    state.selectedSeat = null;
    state.night = { guardTarget:null, wolvesTarget:null, seerTarget:null, seerResult:null };
    state.vote = { records:{}, result:null };
  }
  saveState();
  render();
});

btnNext.addEventListener("click", ()=>{
  if(state.phase==="SETUP"){
    // must have board selected; then deal and go DEAL
    ensureSeats();
    deal();
    render();
    return;
  }
  if(state.phase==="DEAL"){
    // must all viewed
    const allViewed = state.seats.every(s=>s.viewed);
    if(!allViewed){
      pushAnn("提醒", "尚有人未看身分。", `已看完：${state.seats.filter(s=>s.viewed).length}/${state.seats.length}`);
      saveState();
      render();
      return;
    }
    state.phase = "GAME";
    state.isNight = true;
    state.day = 1;
    state.stepIndex = 0;
    btnMain.textContent = "天黑閉眼";
    pushAnn("進入遊戲", "遊戲開始。", `Day1 / Night start`);
    saveState();
    render();
    return;
  }

  // GAME
  if(state.isNight){
    handleNightStepCommit();
    // next step
    state.stepIndex = clamp(state.stepIndex + 1, 0, 3);
    state.selectedSeat = null;
  }else{
    // day next: currently just placeholder (voting system will be next round)
    pushAnn(`白天 ${state.day}（提示）`, "可開始投票（📣僅記錄）。", "之後可做 PK / 多輪投票。");
  }
  saveState();
  render();
});

/* ---------- Night step commit ---------- */
function handleNightStepCommit(){
  const i = clamp(state.stepIndex,0,3);
  const target = state.selectedSeat;

  if(i===0){
    // GUARD
    state.night.guardTarget = target ?? null;
    if(target){
      const s = state.seats.find(x=>x.id===target);
      if(s) s.marks.guardedBy = "guard";
    }
    pushAnn(`🌙 Night${state.day}：守衛`, "（夜間行動已完成）", `守衛守：${target ?? "（無）"}`);
  }
  if(i===1){
    // WOLVES
    state.night.wolvesTarget = target ?? null;
    pushAnn(`🌙 Night${state.day}：狼人`, "（夜間行動已完成）", `狼人刀：${target ?? "（無）"}`);
  }
  if(i===2){
    // SEER
    state.night.seerTarget = target ?? null;
    if(target){
      const s = state.seats.find(x=>x.id===target);
      const res = s?.camp==="wolf" ? "狼人" : "好人";
      state.night.seerResult = res;
      pushAnn(`🌙 Night${state.day}：預言家`, "（夜間行動已完成）", `查驗：${target} → ${res}`);
    }else{
      state.night.seerResult = null;
      pushAnn(`🌙 Night${state.day}：預言家`, "（夜間行動已完成）", `查驗：（無）`);
    }
  }
  if(i===3){
    // WITCH: click logic is special but we reuse selection:
    // - if selected equals wolvesTarget => heal (if available)
    // - else => poison (if available)
    if(target==null){
      pushAnn(`🌙 Night${state.day}：女巫`, "（夜間行動已完成）", `女巫：未用藥`);
      return;
    }
    const wolvesTarget = state.night.wolvesTarget;
    if(target===wolvesTarget && state.witch.heal){
      // choose heal
      state.witch.heal = false;
      state.witch.healTarget = target;
      // if had poison target, clear
      state.witch.poisonTarget = null;
      pushAnn(`🌙 Night${state.day}：女巫`, "（夜間行動已完成）", `使用解藥 💊 救：${target}`);
    }else if(target!==wolvesTarget && state.witch.poison){
      state.witch.poison = false;
      state.witch.poisonTarget = target;
      // if had heal target, clear
      state.witch.healTarget = null;
      pushAnn(`🌙 Night${state.day}：女巫`, "（夜間行動已完成）", `使用毒藥 🧪 毒：${target}`);
    }else{
      // cannot use
      pushAnn(`🌙 Night${state.day}：女巫`, "（夜間行動已完成）", `女巫：此操作不可（藥已用或規則限制）`);
    }
  }
}

/* ---------- Resolve night and announce ---------- */
function resolveNightAndAnnounce(){
  // compute deaths:
  // wolvesTarget dies unless healed
  // poisonTarget dies
  const deaths = [];

  const wt = state.night.wolvesTarget;
  const heal = state.witch.healTarget;
  const poison = state.witch.poisonTarget;

  if(wt && wt !== heal){
    deaths.push({id:wt, by:"wolf"});
  }
  if(poison){
    deaths.push({id:poison, by:"poison"});
  }

  // apply deaths (avoid duplicate)
  const map = new Map();
  for(const d of deaths){
    if(!map.has(d.id)) map.set(d.id, d.by);
  }

  // mark seats
  for(const [id,by] of map.entries()){
    const s = state.seats.find(x=>x.id===id);
    if(s && s.alive){
      s.alive = false;
      s.marks.diedBy = by;
    }
  }

  // Build announcement
  const deadIds = Array.from(map.keys());
  let pub = "";
  if(deadIds.length===0){
    pub = `🌙 第 ${state.day} 夜結果\n昨晚是平安夜，沒有人死亡。`;
  }else{
    pub = `🌙 第 ${state.day} 夜結果\n昨晚死亡：${deadIds.join("、")}。`;
  }

  const godLines = [];
  godLines.push(`🌙 第 ${state.day} 夜（上帝視角）`);
  godLines.push(`守衛：${state.night.guardTarget ?? "（無）"}`);
  godLines.push(`狼人刀：${state.night.wolvesTarget ?? "（無）"}`);
  if(state.night.seerTarget){
    godLines.push(`預言家查驗：${state.night.seerTarget} → ${state.night.seerResult}`);
  }else{
    godLines.push(`預言家查驗：（無）`);
  }
  if(state.witch.healTarget) godLines.push(`女巫：💊救 ${state.witch.healTarget}`);
  else if(!state.witch.heal) godLines.push(`女巫：💊已用（本夜未救）`);
  else godLines.push(`女巫：💊可用`);
  if(state.witch.poisonTarget) godLines.push(`女巫：🧪毒 ${state.witch.poisonTarget}`);
  else if(!state.witch.poison) godLines.push(`女巫：🧪已用（本夜未毒）`);
  else godLines.push(`女巫：🧪可用`);

  pushAnn(`天亮睜眼（第${state.day}夜）`, pub, godLines.join("\n"));
}

/* ---------- Render ---------- */
function renderBottomBar(){
  // set main label
  if(state.phase==="SETUP"){
    btnMain.textContent = "—";
    btnMain.disabled = true;
    btnBack.disabled = true;
    btnNext.textContent = "下一步";
    btnNext.disabled = false;
    return;
  }
  btnMain.disabled = false;
  btnBack.disabled = false;

  if(state.phase==="DEAL"){
    btnMain.textContent = "—";
    btnMain.disabled = true;
    btnNext.textContent = "下一步";
    btnBack.textContent = "上一步";
    return;
  }

  // GAME
  btnBack.textContent = "上一步";
  btnNext.textContent = "下一步";
  btnMain.textContent = state.isNight ? "天亮睜眼" : "天黑閉眼";
}
function renderSetupVisibility(){
  setupCard.classList.toggle("hidden", state.phase !== "SETUP");
}
function renderChips(){
  document.querySelectorAll(".chip[data-n]").forEach(c=>{
    c.classList.toggle("active", Number(c.dataset.n)===state.setup.players);
  });
}
function renderPrompt(){
  const p = currentPrompt();
  promptTitle.textContent = p.title;
  promptText.textContent = p.text;
  promptFoot.textContent = p.foot || "";
}
function render(){
  ensureSeats();
  setStatus();
  renderSetupVisibility();
  renderChips();
  renderBoardList();
  renderPrompt();
  renderSeats();
  renderBottomBar();

  // update timer display even when closed
  timerBig.textContent = fmtTime(state.timer.left);

  // persist
  saveState();
}

/* ---------- Start ---------- */
ensureSeats();
renderSettingsUI();
renderTimer();
render();

setInterval(()=>{
  tickTimer();
}, 250);