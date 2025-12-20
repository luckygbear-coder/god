/* =========================
   Werewolf God Helper (vNext)
   - Thief rule: deck = players + 2, offer 2 leftover roles
   - Offered cards may include wolf
   - If one wolf + one good => thief must choose wolf
   - Night order (Day2+ and default): Guard -> Wolves -> Seer -> Witch
========================= */

const STORAGE_KEY = "ww_god_vnext_v2";

/* ---------- iOS anti-zoom / anti-selection (best effort) ---------- */
(function preventIOSGestures(){
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive:false });

  document.addEventListener("gesturestart", (e)=> e.preventDefault(), { passive:false });
  document.addEventListener("contextmenu", (e)=> e.preventDefault());
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
      extras:["idiot"]
    },
    desc:"4狼 + 預言家/女巫/守衛/獵人 + 4民（含白癡）"
  },

  /* ✅ 盜賊板子（你要的）：
     總牌數 = 14 = 12人 + 2張未被抽選的牌
     內容：四民、四狼、預言家、女巫、獵人、守衛、白癡、盜賊
  */
  {
    id:"official-12-thief",
    name:"12 人（白癡 + 盜賊）",
    tags:["擴充","盜賊","含狼人牌"],
    players:12,
    config:{
      wolves:4,
      villagers:4,
      gods:["seer","witch","guard","hunter"],
      extras:["idiot","thief"]   // ← 這兩個加上去，總牌數會變 14
    },
    desc:"總牌數 14（含盜賊兩張未抽到牌）"
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

  thief:{ key:"thief", name:"盜賊", camp:"good" },
};

function roleName(key){ return ROLE_META[key]?.name || key; }
function roleCamp(key){ return ROLE_META[key]?.camp || "good"; }

function defaultState(){
  return {
    phase:"SETUP",     // SETUP | DEAL | GAME
    stepIndex:0,
    day:1,
    isNight:true,
    selectedSeat:null,
    godView:false,
    policeEnabled:true,
    winMode:"edge",

    setup:{ players:12, boardId:"official-12" },

    seats:[],
    dealt:false,

    witch:{ heal:true, poison:true, healTarget:null, poisonTarget:null },
    night:{ guardTarget:null, wolvesTarget:null, seerTarget:null, seerResult:null },

    thief:{
      offered:[],        // 2 leftover roles
      chosenRole:null,
      discardedRole:null,
      done:false          // chose already
    },

    ann:{ entries:[] },

    timer:{ total:90, left:90, running:false, lastTick:0 }
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

/* ✅ thief modal */
const thiefModal = $("#thiefModal");
const thiefHint  = $("#thiefHint");
const btnThiefA  = $("#btnThiefA");
const btnThiefB  = $("#btnThiefB");
const btnThiefClose = $("#btnThiefClose");

/* ---------- helpers ---------- */
function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }
function fmtTime(sec){
  sec = Math.max(0, Math.floor(sec));
  const m = String(Math.floor(sec/60)).padStart(2,"0");
  const s = String(sec%60).padStart(2,"0");
  return `${m}:${s}`;
}
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
function nowTs(){ return Date.now(); }

function pushAnn(title, publicText, godText){
  state.ann.entries.push({ title, publicText, godText, ts: nowTs() });
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

/* ---------- state ---------- */
let state = loadState();

function ensureSeats(){
  const n = state.setup.players;
  if(!Array.isArray(state.seats) || state.seats.length !== n){
    state.seats = Array.from({length:n}, (_,i)=>({
      id:i+1,
      alive:true,
      role:null,
      camp:null,
      viewed:false,
      marks:{ diedBy:null }
    }));
    state.dealt = false;
    state.selectedSeat = null;
    state.witch = { heal:true, poison:true, healTarget:null, poisonTarget:null };
    state.night = { guardTarget:null, wolvesTarget:null, seerTarget:null, seerResult:null };
    state.thief = { offered:[], chosenRole:null, discardedRole:null, done:false };
    state.ann = { entries:[] };
  }
}

/* ---------- Board list UI ---------- */
function renderBoardList(){
  boardList.innerHTML = "";
  const n = state.setup.players;
  const boards = BOARD_FALLBACK.filter(b=>b.players===n);

  boardHint.textContent = "請點選一個板子套用（會變色）";

  for(const b of boards){
    const div = document.createElement("div");
    div.className = "boardItem" + (state.setup.boardId===b.id ? " active":"");
    div.dataset.id = b.id;
    div.innerHTML = `
      <div class="boardName">${b.name}</div>
      <div class="boardSub">${b.id} ・ ${b.desc}</div>
      <div class="tags">
        ${(b.tags||[]).map(t=>`<span class="tag">${t}</span>`).join("")}
      </div>
    `;
    div.addEventListener("click", ()=>{
      state.setup.boardId = b.id;
      if(b.id.includes("nopolice")) state.policeEnabled = false;
      saveState(); render();
    });
    boardList.appendChild(div);
  }
}

/* ---------- deal roles ---------- */
function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]] = [arr[j],arr[i]];
  }
  return arr;
}

function buildRoleListFromBoard(board){
  const roles = [];
  for(let i=0;i<board.config.wolves;i++) roles.push("wolf");
  for(let i=0;i<board.config.villagers;i++) roles.push("villager");
  for(const g of (board.config.gods||[])) roles.push(g);
  for(const e of (board.config.extras||[])) roles.push(e);
  return roles;
}

function hasThiefInBoard(board){
  const extras = board?.config?.extras || [];
  const gods = board?.config?.gods || [];
  return extras.includes("thief") || gods.includes("thief");
}

function deal(){
  ensureSeats();
  const board = getBoard();
  let roles = buildRoleListFromBoard(board);
  const n = state.setup.players;

  const thiefEnabled = hasThiefInBoard(board);

  // ✅ if thief board => expect deck size = n + 2
  const targetDeckSize = thiefEnabled ? (n + 2) : n;

  while(roles.length < targetDeckSize) roles.push("villager");
  while(roles.length > targetDeckSize) roles.pop();

  shuffle(roles);

  // deal n seats, keep leftovers
  const dealt = roles.slice(0, n);
  const leftovers = roles.slice(n); // length 2 when thief

  state.seats.forEach((s,idx)=>{
    s.role = dealt[idx];
    s.camp = roleCamp(s.role);
    s.viewed = false;
    s.alive = true;
    s.marks = { diedBy:null };
  });

  state.dealt = true;
  state.phase = "DEAL";
  state.stepIndex = 0;
  state.selectedSeat = null;

  state.witch = { heal:true, poison:true, healTarget:null, poisonTarget:null };
  state.night = { guardTarget:null, wolvesTarget:null, seerTarget:null, seerResult:null };

  // thief leftover
  state.thief = {
    offered: thiefEnabled ? leftovers : [],
    chosenRole: null,
    discardedRole: null,
    done: !thiefEnabled
  };

  pushAnn(
    "抽身分開始",
    "請玩家依序查看身分。",
    thiefEnabled
      ? `板子：${board.id}\n人數：${n}\n盜賊啟用：是\n未被抽到的兩張牌：${leftovers.map(roleName).join("、")}`
      : `板子：${board.id}\n人數：${n}\n盜賊啟用：否`
  );

  saveState();
}

/* ---------- prompts ---------- */
function setStatus(){
  const b = getBoard();
  uiBoard.textContent = b.id;
  uiStatus.textContent = `${state.phase}${state.phase==="GAME" ? ` / Day${state.day} / ${state.isNight ? "Night":"Day"}`:""}`;
}

function currentPrompt(){
  if(state.phase==="SETUP"){
    return {
      title:"設定：選板子",
      text:`請先選人數與板子（點一下會變色）。\n套用後按「下一步」進入抽身分。`,
      foot:"提示：遊戲中想重選板子 → ⚙️ 設定 → 回到開局"
    };
  }

  if(state.phase==="DEAL"){
    return {
      title:"抽身分",
      text:`請將手機交給玩家，長按座位 0.3 秒查看身分。\n全部看完後按「下一步」進入遊戲。`,
      foot:`已看完：${state.seats.filter(s=>s.viewed).length}/${state.seats.length}`
    };
  }

  // GAME
  if(state.isNight){
    // ✅ Day1 night: if thief exists and not done, show step 0 prompt
    const board = getBoard();
    const thiefEnabled = hasThiefInBoard(board);

    if(state.day === 1 && thiefEnabled && !state.thief.done){
      return {
        title:`🌙 夜晚 1（盜賊）`,
        text:
`🃏 盜賊請睜眼：
盜賊可以從「未被抽到的兩張角色牌」中二擇一，決定自己要成為哪個角色。

👉 請按右上角的「下一步」或直接開啟盜賊選角視窗選擇。`,
        foot:`未被抽到：${(state.thief.offered||[]).map(roleName).join("、") || "（無）"}`
      };
    }

    // your fixed order
    const steps = [
      { title:"守衛請睜眼", hint:"（選擇守護）", action:"GUARD" },
      { title:"狼人請睜眼", hint:"（選擇刀人）", action:"WOLVES" },
      { title:"預言家請睜眼", hint:"（查驗一人）", action:"SEER" },
      { title:"女巫請睜眼", hint:"（解藥 / 毒藥）", action:"WITCH" },
    ];
    const i = clamp(state.stepIndex, 0, steps.length-1);
    const st = steps[i];

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
  }

  return {
    title:`☀️ 白天 ${state.day}`,
    text:`白天：公告昨夜結果、發言、投票（📣可回顧）。\n提示：🎲 抽發言、👁 切上帝視角。`,
    foot:""
  };
}

/* ---------- seats ---------- */
function seatDisplayLines(s){
  const n = `${s.id}號`;
  const alive = s.alive ? "存活" : "死亡";

  if(!state.godView){
    return { n, s: alive, g:"" };
  }

  const role = s.role ? roleName(s.role) : "—";
  const camp = s.camp==="wolf" ? "狼" : "好";
  const marks = [];

  if(state.night.wolvesTarget===s.id) marks.push("🐺狼刀");
  if(state.night.guardTarget===s.id) marks.push("🛡守");
  if(state.witch.healTarget===s.id) marks.push("💊救");
  if(state.witch.poisonTarget===s.id) marks.push("🧪毒");

  if(!s.alive && s.marks?.diedBy){
    const map = { wolf:"🐺刀死", poison:"🧪毒死", vote:"📮放逐" };
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

  // setup: hide seats
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

    if(state.godView && s.camp==="wolf") btn.classList.add("markBad");
    if(state.godView && s.camp==="good") btn.classList.add("markGood");

    const d = seatDisplayLines(s);
    btn.innerHTML = `
      <div class="n">${d.n}</div>
      <div class="s">${d.s}</div>
      ${d.g ? `<div class="g">${d.g.replace(/\n/g,"<br>")}</div>` : ""}
    `;

    btn.addEventListener("click", ()=>{
      if(state.selectedSeat===s.id) state.selectedSeat = null;
      else state.selectedSeat = s.id;
      saveState(); render();
    });

    // Deal long press 0.3s
    if(state.phase==="DEAL"){
      let pressTimer = null;
      const start = (e)=>{
        e.preventDefault();
        pressTimer = setTimeout(()=> openRoleModal(s.id), 300);
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

/* ---------- role modal ---------- */
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
  const m = (roleModalTitle.textContent||"").match(/^(\d+)號/);
  if(m){
    const id = Number(m[1]);
    const s = state.seats.find(x=>x.id===id);
    if(s) s.viewed = true;
  }
  saveState(); closeRoleModal(); render();
});
btnRoleClose.addEventListener("click", ()=> closeRoleModal());

/* ---------- drawers ---------- */
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
btnTimer.addEventListener("click", ()=>{ openDrawer(timerBackdrop, timerDrawer); renderTimer(); });
btnCloseTimer.addEventListener("click", ()=> closeDrawer(timerBackdrop, timerDrawer));
timerBackdrop.addEventListener("click", ()=> closeDrawer(timerBackdrop, timerDrawer));

/* ann drawer */
btnAnn.addEventListener("click", ()=>{ openDrawer(annBackdrop, annDrawer); renderAnn(); });
btnCloseAnn.addEventListener("click", ()=> closeDrawer(annBackdrop, annDrawer));
annBackdrop.addEventListener("click", ()=> closeDrawer(annBackdrop, annDrawer));
toggleAnnGod.addEventListener("change", ()=> renderAnn());

/* settings drawer */
btnSettings.addEventListener("click", ()=> openDrawer(setBackdrop, setDrawer));
btnCloseSet.addEventListener("click", ()=> closeDrawer(setBackdrop, setDrawer));
setBackdrop.addEventListener("click", ()=> closeDrawer(setBackdrop, setDrawer));

/* ---------- timer ---------- */
function renderTimer(){ timerBig.textContent = fmtTime(state.timer.left); }
function setTimer(sec){
  state.timer.total = sec;
  state.timer.left = sec;
  state.timer.running = false;
  state.timer.lastTick = 0;
  saveState(); renderTimer();
}
timerPresets.addEventListener("click", (e)=>{
  const btn = e.target.closest("button[data-sec]");
  if(!btn) return;
  setTimer(Number(btn.dataset.sec));
});
btnTimerStart.addEventListener("click", ()=>{
  if(state.timer.left<=0) state.timer.left = state.timer.total;
  state.timer.running = true;
  state.timer.lastTick = Date.now();
  saveState();
});
btnTimerPause.addEventListener("click", ()=>{ state.timer.running=false; saveState(); });
btnTimerReset.addEventListener("click", ()=>{
  state.timer.left = state.timer.total;
  state.timer.running = false;
  saveState(); renderTimer();
});
function tickTimer(){
  if(!state.timer.running) return;
  const t = Date.now();
  const dt = (t - (state.timer.lastTick || t)) / 1000;
  state.timer.lastTick = t;
  state.timer.left -= dt;
  if(state.timer.left<=0){
    state.timer.left = 0;
    state.timer.running = false;
    vibrate(400);
  }
  saveState(); renderTimer();
}

/* ---------- dice ---------- */
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
  diceResult.textContent = alive.length ? `${alive[Math.floor(Math.random()*alive.length)]} 號` : "（無存活）";
}
btnDice.addEventListener("click", ()=> openDice());
btnDiceAgain.addEventListener("click", ()=> rollDice());
btnDiceClose.addEventListener("click", ()=> closeDice());

/* ---------- eye god view ---------- */
btnEye.addEventListener("click", ()=>{
  state.godView = !state.godView;
  saveState(); render();
});

/* ---------- setup chips ---------- */
document.addEventListener("click", (e)=>{
  const chip = e.target.closest(".chip[data-n]");
  if(!chip) return;
  const n = Number(chip.dataset.n);
  state.setup.players = n;
  const first = BOARD_FALLBACK.find(b=>b.players===n) || BOARD_FALLBACK[0];
  state.setup.boardId = first.id;
  ensureSeats();
  saveState(); render();
});

/* ---------- thief modal logic ---------- */
function openThiefModal(){
  const offered = state.thief.offered || [];
  if(offered.length !== 2){
    // safety: if missing offered, mark done
    state.thief.done = true;
    saveState();
    return;
  }

  const a = offered[0], b = offered[1];
  const aCamp = roleCamp(a), bCamp = roleCamp(b);

  // Find thief seat
  const thiefSeat = state.seats.find(s=>s.role==="thief");
  const thiefId = thiefSeat?.id ?? "（未知）";

  thiefHint.textContent = `盜賊座位：${thiefId}號。請從未被抽到的兩張牌中選一張。`;

  btnThiefA.textContent = `${roleName(a)}（${aCamp==="wolf" ? "狼" : "好"}）`;
  btnThiefB.textContent = `${roleName(b)}（${bCamp==="wolf" ? "狼" : "好"}）`;

  // rule: if one wolf one good => must choose wolf
  const mustWolf = (aCamp!==bCamp) && (aCamp==="wolf" || bCamp==="wolf");
  btnThiefA.disabled = mustWolf && aCamp!=="wolf";
  btnThiefB.disabled = mustWolf && bCamp!=="wolf";

  btnThiefA.classList.toggle("primary", !btnThiefA.disabled);
  btnThiefB.classList.toggle("primary", !btnThiefB.disabled);

  thiefModal.classList.remove("hidden");
  thiefModal.setAttribute("aria-hidden","false");
}
function closeThiefModal(){
  thiefModal.classList.add("hidden");
  thiefModal.setAttribute("aria-hidden","true");
}
function applyThiefChoice(chosenRole){
  const offered = state.thief.offered || [];
  if(offered.length !== 2) return;

  const thiefSeat = state.seats.find(s=>s.role==="thief");
  if(!thiefSeat) {
    state.thief.done = true;
    saveState();
    return;
  }

  const other = offered.find(r=>r!==chosenRole) ?? null;

  // enforce wolf-only if one wolf one good
  const aCamp = roleCamp(offered[0]);
  const bCamp = roleCamp(offered[1]);
  const mustWolf = (aCamp!==bCamp) && (aCamp==="wolf" || bCamp==="wolf");
  if(mustWolf && roleCamp(chosenRole) !== "wolf"){
    return; // blocked
  }

  // apply role
  thiefSeat.role = chosenRole;
  thiefSeat.camp = roleCamp(chosenRole);

  state.thief.chosenRole = chosenRole;
  state.thief.discardedRole = other;
  state.thief.done = true;

  pushAnn(
    "盜賊已選角",
    "（盜賊已完成選角）",
    `盜賊座位：${thiefSeat.id}號\n可選：${offered.map(roleName).join("、")}\n選擇：${roleName(chosenRole)}\n捨棄：${other ? roleName(other) : "（無）"}`
  );

  saveState();
  closeThiefModal();
  render();
}

btnThiefA?.addEventListener("click", ()=> applyThiefChoice(state.thief.offered?.[0]));
btnThiefB?.addEventListener("click", ()=> applyThiefChoice(state.thief.offered?.[1]));
btnThiefClose?.addEventListener("click", ()=> closeThiefModal());

/* ---------- night step commit ---------- */
function handleNightStepCommit(){
  const i = clamp(state.stepIndex,0,3);
  const target = state.selectedSeat;

  if(i===0){
    state.night.guardTarget = target ?? null;
    pushAnn(`🌙 Night${state.day}：守衛`, "（夜間行動已完成）", `守衛守：${target ?? "（無）"}`);
  }
  if(i===1){
    state.night.wolvesTarget = target ?? null;
    pushAnn(`🌙 Night${state.day}：狼人`, "（夜間行動已完成）", `狼人刀：${target ?? "（無）"}`);
  }
  if(i===2){
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
    if(target==null){
      pushAnn(`🌙 Night${state.day}：女巫`, "（夜間行動已完成）", `女巫：未用藥`);
      return;
    }
    const wolvesTarget = state.night.wolvesTarget;
    if(target===wolvesTarget && state.witch.heal){
      state.witch.heal = false;
      state.witch.healTarget = target;
      state.witch.poisonTarget = null;
      pushAnn(`🌙 Night${state.day}：女巫`, "（夜間行動已完成）", `使用解藥 💊 救：${target}`);
    }else if(target!==wolvesTarget && state.witch.poison){
      state.witch.poison = false;
      state.witch.poisonTarget = target;
      state.witch.healTarget = null;
      pushAnn(`🌙 Night${state.day}：女巫`, "（夜間行動已完成）", `使用毒藥 🧪 毒：${target}`);
    }else{
      pushAnn(`🌙 Night${state.day}：女巫`, "（夜間行動已完成）", `女巫：此操作不可（藥已用或規則限制）`);
    }
  }
}

function resolveNightAndAnnounce(){
  const deaths = [];
  const wt = state.night.wolvesTarget;
  const heal = state.witch.healTarget;
  const poison = state.witch.poisonTarget;

  if(wt && wt !== heal) deaths.push({id:wt, by:"wolf"});
  if(poison) deaths.push({id:poison, by:"poison"});

  const map = new Map();
  for(const d of deaths){
    if(!map.has(d.id)) map.set(d.id, d.by);
  }

  for(const [id,by] of map.entries()){
    const s = state.seats.find(x=>x.id===id);
    if(s && s.alive){
      s.alive = false;
      s.marks.diedBy = by;
    }
  }

  const deadIds = Array.from(map.keys());
  const pub = deadIds.length===0
    ? `🌙 第 ${state.day} 夜結果\n昨晚是平安夜，沒有人死亡。`
    : `🌙 第 ${state.day} 夜結果\n昨晚死亡：${deadIds.join("、")}。`;

  const godLines = [];
  godLines.push(`🌙 第 ${state.day} 夜（上帝視角）`);
  godLines.push(`守衛：${state.night.guardTarget ?? "（無）"}`);
  godLines.push(`狼人刀：${state.night.wolvesTarget ?? "（無）"}`);
  if(state.night.seerTarget) godLines.push(`預言家查驗：${state.night.seerTarget} → ${state.night.seerResult}`);
  else godLines.push(`預言家查驗：（無）`);
  if(state.witch.healTarget) godLines.push(`女巫：💊救 ${state.witch.healTarget}`);
  if(state.witch.poisonTarget) godLines.push(`女巫：🧪毒 ${state.witch.poisonTarget}`);
  if(deadIds.length===0) godLines.push(`結果：平安夜`);
  else godLines.push(`結果：死亡 ${deadIds.join("、")}`);

  pushAnn(`天亮睜眼（第${state.day}夜）`, pub, godLines.join("\n"));
}

/* ---------- buttons ---------- */
btnBack.addEventListener("click", ()=>{
  if(state.phase==="SETUP") return;

  if(state.phase==="DEAL"){
    state.phase = "SETUP";
    state.stepIndex = 0;
    state.dealt = false;
    state.selectedSeat = null;
    saveState(); render();
    return;
  }

  if(state.isNight){
    state.stepIndex = clamp(state.stepIndex - 1, 0, 3);
    state.selectedSeat = null;
  }else{
    state.isNight = true;
    state.stepIndex = 3;
  }
  saveState(); render();
});

btnMain.addEventListener("click", ()=>{
  if(state.phase!=="GAME") return;

  if(state.isNight){
    resolveNightAndAnnounce();
    state.isNight = false;
    state.stepIndex = 0;
    btnMain.textContent = "天黑閉眼";
  }else{
    state.day += 1;
    state.isNight = true;
    state.stepIndex = 0;
    btnMain.textContent = "天亮睜眼";
    state.selectedSeat = null;
    state.night = { guardTarget:null, wolvesTarget:null, seerTarget:null, seerResult:null };
  }
  saveState(); render();
});

btnNext.addEventListener("click", ()=>{
  if(state.phase==="SETUP"){
    ensureSeats();
    deal();
    render();
    return;
  }

  if(state.phase==="DEAL"){
    const allViewed = state.seats.every(s=>s.viewed);
    if(!allViewed){
      pushAnn("提醒", "尚有人未看身分。", `已看完：${state.seats.filter(s=>s.viewed).length}/${state.seats.length}`);
      saveState(); render();
      return;
    }
    state.phase = "GAME";
    state.isNight = true;
    state.day = 1;
    state.stepIndex = 0;
    btnMain.textContent = "天亮睜眼";
    pushAnn("進入遊戲", "遊戲開始。", `Day1 / Night start`);
    saveState(); render();

    // ✅ if thief exists, open modal immediately at Day1 start
    const board = getBoard();
    if(state.day===1 && hasThiefInBoard(board) && !state.thief.done){
      openThiefModal();
    }
    return;
  }

  // GAME
  if(state.isNight){
    // ✅ Day1 thief choose gate: cannot proceed until chosen
    const board = getBoard();
    if(state.day===1 && hasThiefInBoard(board) && !state.thief.done){
      openThiefModal();
      return;
    }

    handleNightStepCommit();
    state.stepIndex = clamp(state.stepIndex + 1, 0, 3);
    state.selectedSeat = null;
  }else{
    pushAnn(`白天 ${state.day}（提示）`, "可開始投票（📣可回顧）。", "投票詳細統計下一輪補上。");
  }

  saveState(); render();
});

/* ---------- bottom bar label ---------- */
function renderBottomBar(){
  if(state.phase==="SETUP"){
    btnMain.textContent = "—";
    btnMain.disabled = true;
    btnBack.disabled = true;
    btnNext.textContent = "下一步";
    btnNext.disabled = false;
    return;
  }
  btnBack.disabled = false;

  if(state.phase==="DEAL"){
    btnMain.textContent = "—";
    btnMain.disabled = true;
    btnNext.textContent = "下一步";
    btnBack.textContent = "上一步";
    return;
  }

  btnMain.disabled = false;
  btnBack.textContent = "上一步";
  btnNext.textContent = "下一步";
  btnMain.textContent = state.isNight ? "天亮睜眼" : "天黑閉眼";
}

/* ---------- render ---------- */
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
  timerBig.textContent = fmtTime(state.timer.left);
  saveState();
}

function setStatus(){
  const b = getBoard();
  uiBoard.textContent = b.id;
  uiStatus.textContent = `${state.phase}${state.phase==="GAME" ? ` / Day${state.day} / ${state.isNight ? "Night":"Day"}`:""}`;
}

/* ---------- Ann / Drawer buttons ---------- */
btnAnn.addEventListener("click", ()=>{ openDrawer(annBackdrop, annDrawer); renderAnn(); });

/* ---------- Setup board selection click ---------- */
boardList.addEventListener("click", (e)=>{
  const item = e.target.closest(".boardItem");
  if(!item) return;
  const id = item.dataset.id;
  if(!id) return;
  state.setup.boardId = id;
  saveState(); render();
});

/* ---------- Hard reset / setup ---------- */
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

/* ---------- toggle police + winMode (safe) ---------- */
segEdge?.addEventListener("click", ()=>{ state.winMode="edge"; saveState(); });
segCity?.addEventListener("click", ()=>{ state.winMode="city"; saveState(); });
togglePolice?.addEventListener("change", ()=>{ state.policeEnabled = !!togglePolice.checked; saveState(); });

/* ---------- close ann ---------- */
btnCloseAnn.addEventListener("click", ()=> closeDrawer(annBackdrop, annDrawer));
annBackdrop.addEventListener("click", ()=> closeDrawer(annBackdrop, annDrawer));

/* ---------- close timer ---------- */
btnCloseTimer.addEventListener("click", ()=> closeDrawer(timerBackdrop, timerDrawer));
timerBackdrop.addEventListener("click", ()=> closeDrawer(timerBackdrop, timerDrawer));

/* ---------- close settings ---------- */
btnCloseSet.addEventListener("click", ()=> closeDrawer(setBackdrop, setDrawer));

/* ---------- start ---------- */
ensureSeats();
renderTimer();
render();
setInterval(()=> tickTimer(), 250);