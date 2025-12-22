/* =========================================================
   Werewolf God Helper - app.js (FULL OVERWRITE)
   ✅ 完整上帝操作流程：
   - SETUP：選人數/選板子（點一下變色）→ 下一步發牌
   - DEAL：點座位→玩家長按0.3s看身分→按「我看完了」自動蓋牌
           盜賊看完身分立刻二選一（底牌兩張），放棄那張移出遊戲（不會重複）
           全部看完 + 盜賊完成 → 可開始夜晚
   - NIGHT：依序步驟（自動跳過不存在/已死亡角色）
           守衛（不可連守同一人）→ 狼刀 → 預言家查驗（提示結果）→ 女巫（同夜救/毒二選一）
           夜晚結算：盾擋刀、女巫救/毒、死亡標記、公告自動生成
   - DAY：提示流程 → 開始投票
   - VOTE：上帝逐一收票（選「投票者」→ 選「被投者/棄票」→ 確認）
           完成後自動統計寫入公告 → 進入下一夜
   - 勝負判定：屠邊/屠城（設定可切）
========================================================= */

/* ========= iOS Guards ========= */
(function installIOSGuards(){
  document.addEventListener("contextmenu", (e)=>e.preventDefault(), {passive:false});
  document.addEventListener("selectstart", (e)=>e.preventDefault(), {passive:false});
  document.addEventListener("gesturestart", (e)=>e.preventDefault(), {passive:false});
  document.addEventListener("dblclick", (e)=>e.preventDefault(), {passive:false});

  let lastTouchEnd = 0;
  document.addEventListener("touchend", (e)=>{
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, {passive:false});
})();

/* ========= Utils ========= */
const LS_KEY = "ww_god_helper_v4";
const clamp = (n,min,max)=>Math.max(min,Math.min(max,n));
const randInt = (min,max)=>Math.floor(Math.random()*(max-min+1))+min;

function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

function campOf(role){
  if(role === "平民") return "民";
  if(role === "小狼" || role === "白狼王" || role === "黑狼王") return "狼";
  return "神"; // 白痴、盜賊 都算神
}
function isWolf(role){ return campOf(role)==="狼"; }
function isGood(role){ return campOf(role)!=="狼"; }

function nowDayLabel(){
  return `D${S.day}`;
}

/* ========= Roles ========= */
const GOD_ROLES = ["預言家","女巫","獵人","守衛","白痴","邱比特","盜賊"];
const WOLF_ROLES = ["小狼","白狼王","黑狼王"];

/* ========= Boards =========
   你指定：正常 12 人標準 = 四狼四神四民（民只有平民）
*/
const BOARDS = [
  {
    id:"official-12",
    name:"12 人官方標準局（四狼四神四民）",
    n:12,
    tags:["官方","標準"],
    config:{
      wolves:{ small:4, white:0, black:0 }, // 四狼（預設4小狼）
      gods:["預言家","女巫","獵人","守衛"], // 四神（可替換）
      hasThief:false,
      plusBottom:0
    }
  },
  {
    id:"12-thief",
    name:"12 人含盜賊（+2 底牌）",
    n:12,
    tags:["盜賊","變體"],
    config:{
      wolves:{ small:4, white:0, black:0 }, // 狼上限4
      gods:["預言家","女巫","獵人","守衛","白痴","盜賊"], // 盜賊算神
      hasThief:true,
      plusBottom:2
    }
  },
  {
    id:"official-10",
    name:"10 人標準局",
    n:10,
    tags:["標準"],
    config:{
      wolves:{ small:3, white:0, black:0 },
      gods:["預言家","女巫","獵人"],
      hasThief:false,
      plusBottom:0
    }
  },
  {
    id:"official-9",
    name:"9 人標準局",
    n:9,
    tags:["標準"],
    config:{
      wolves:{ small:3, white:0, black:0 },
      gods:["預言家","女巫"],
      hasThief:false,
      plusBottom:0
    }
  }
];

function wolvesText(w){
  const parts = [];
  if(w.small) parts.push(`小狼${w.small}`);
  if(w.white) parts.push(`白狼王${w.white}`);
  if(w.black) parts.push(`黑狼王${w.black}`);
  return parts.join("+") || "0";
}

/* ========= DOM (需對應你原本 HTML 的 id) ========= */
const uiStatus = document.getElementById("uiStatus");
const uiBoard  = document.getElementById("uiBoard");

const promptTitle = document.getElementById("promptTitle");
const promptText  = document.getElementById("promptText");
const promptFoot  = document.getElementById("promptFoot");

const setupCard = document.getElementById("setupCard");
const boardList = document.getElementById("boardList");

const seatsGrid = document.getElementById("seatsGrid");

const btnBack = document.getElementById("btnBack");
const btnMain = document.getElementById("btnMain");
const btnNext = document.getElementById("btnNext");

const btnAnn = document.getElementById("btnAnn");
const btnTimer = document.getElementById("btnTimer");
const btnEye = document.getElementById("btnEye");
const btnDice = document.getElementById("btnDice");
const btnSettings = document.getElementById("btnSettings");

const annBackdrop = document.getElementById("annBackdrop");
const annDrawer   = document.getElementById("annDrawer");
const btnCloseAnn = document.getElementById("btnCloseAnn");
const annText     = document.getElementById("annText");
const toggleAnnGod= document.getElementById("toggleAnnGod");

const setBackdrop = document.getElementById("setBackdrop");
const setDrawer   = document.getElementById("setDrawer");
const btnCloseSet = document.getElementById("btnCloseSet");
const segEdge     = document.getElementById("segEdge");
const segCity     = document.getElementById("segCity");
const togglePolice= document.getElementById("togglePolice");
const btnGotoSetup= document.getElementById("btnGotoSetup");
const btnHardReset= document.getElementById("btnHardReset");

/* 身分彈窗 */
const roleModal   = document.getElementById("roleModal");
const roleModalTitle = document.getElementById("roleModalTitle");
const roleModalRole  = document.getElementById("roleModalRole");
const roleModalCamp  = document.getElementById("roleModalCamp");
const btnRoleDone    = document.getElementById("btnRoleDone");
const btnRoleClose   = document.getElementById("btnRoleClose");

/* 盜賊二選一彈窗 */
const thiefModal  = document.getElementById("thiefModal");
const thiefHint   = document.getElementById("thiefHint");
const btnThiefA   = document.getElementById("btnThiefA");
const btnThiefB   = document.getElementById("btnThiefB");
const btnThiefClose = document.getElementById("btnThiefClose");

/* ========= UI helpers ========= */
function setTop(status, board){
  if(uiStatus) uiStatus.textContent = status || "—";
  if(uiBoard) uiBoard.textContent = board || "—";
}
function setPrompt(title, text, foot=""){
  if(promptTitle) promptTitle.textContent = title || "—";
  if(promptText)  promptText.textContent  = text  || "—";
  if(promptFoot)  promptFoot.textContent  = foot  || "";
}
function show(el){ el?.classList.remove("hidden"); }
function hide(el){ el?.classList.add("hidden"); }
function openDrawer(backdrop, drawer){ show(backdrop); show(drawer); drawer?.setAttribute("aria-hidden","false"); }
function closeDrawer(backdrop, drawer){ hide(backdrop); hide(drawer); drawer?.setAttribute("aria-hidden","true"); }
function openModal(modal){ show(modal); modal?.setAttribute("aria-hidden","false"); }
function closeModal(modal){ hide(modal); modal?.setAttribute("aria-hidden","true"); }

/* ========= State ========= */
const DEFAULT_STATE = {
  phase:"SETUP",     // SETUP | DEAL | NIGHT | DAY | VOTE | END
  stepIndex:0,
  day:1,
  n:12,
  boardId:"official-12",
  config: structuredClone(BOARDS[0].config),

  seats:[],          // 1..n
  seen:{},           // DEAL 看過牌
  selectedSeat:null, // 通用「選取目標」
  godView:false,

  deck:[],
  bottom:[],         // 盜賊底牌

  thiefSeat:null,
  thiefResolved:false,

  // 夜晚暫存行為
  night:{
    guardTarget:null,
    wolfTarget:null,
    seerTarget:null,
    seerResult:null, // "狼人"/"好人"
    witchChoice:null, // null | "save" | "poison"
    witchTarget:null,
    witchSaveUsed:false,
    witchPoisonUsed:false,
    lastGuardTarget:null // 守衛不可連守
  },

  // 白天投票
  vote:{
    voterQueue:[],
    currentVoter:null,
    tally:{} // targetKey -> voters[]
  },

  // settings
  winMode:"edge",     // edge=屠邊, city=屠城
  hasPolice:false,
  allowWitchSelfSave:false, // 可在設定再接 UI（此版先用 false）
  allowWolfKillWolf:false,  // 此版預設 false

  log:[],
  logGod:[]
};

let S = loadState();

function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(DEFAULT_STATE), ...parsed };
  }catch(e){
    return structuredClone(DEFAULT_STATE);
  }
}
function saveState(){
  localStorage.setItem(LS_KEY, JSON.stringify(S));
}

/* ========= Build Deck ========= */
function totalWolves(cfg){
  return (cfg.wolves.small||0)+(cfg.wolves.white||0)+(cfg.wolves.black||0);
}

function buildDeck(){
  const cfg = S.config;
  const totalCards = S.n + (cfg.plusBottom||0);

  const wolves = [];
  for(let i=0;i<(cfg.wolves.small||0);i++) wolves.push("小狼");
  for(let i=0;i<(cfg.wolves.white||0);i++) wolves.push("白狼王");
  for(let i=0;i<(cfg.wolves.black||0);i++) wolves.push("黑狼王");

  const gods = [...cfg.gods];

  const villagersCount = totalCards - wolves.length - gods.length;
  if(villagersCount < 0) throw new Error("配置超過牌數：請減少狼人或神職");
  const deck = [...wolves, ...gods, ...Array(villagersCount).fill("平民")];
  return shuffle(deck);
}

/* ========= Setup Render ========= */
function renderSetup(){
  document.querySelectorAll(".chip[data-n]").forEach(btn=>{
    const n = Number(btn.dataset.n);
    btn.classList.toggle("active", S.n === n);
    btn.onclick = ()=>{
      S.n = n;
      const pick = BOARDS.find(b=>b.n===n) || BOARDS[0];
      S.boardId = pick.id;
      S.config = structuredClone(pick.config);
      // reset
      S.phase="SETUP"; S.day=1; S.stepIndex=0;
      saveState();
      renderSetup();
      renderAll();
    };
  });

  if(!boardList) return;
  boardList.innerHTML = "";
  const list = BOARDS.filter(b=>b.n===S.n);
  list.forEach(b=>{
    const d = document.createElement("div");
    d.className = "boardItem";
    d.classList.toggle("active", S.boardId === b.id);

    const wolfTxt = wolvesText(b.config.wolves);
    const meta = `${b.id} ・ 狼:${wolfTxt} ・ 神:${b.config.gods.length} ・ 民:平民補足${b.config.plusBottom?` ・ 底牌:${b.config.plusBottom}`:""}`;

    d.innerHTML = `
      <div class="boardName">${b.name}</div>
      <div class="boardMeta">${meta}</div>
      <div class="tags">${(b.tags||[]).map(t=>`<span class="tag">${t}</span>`).join("")}</div>
    `;
    d.onclick = ()=>{
      S.boardId = b.id;
      S.config = structuredClone(b.config);
      saveState();
      renderSetup();
      renderAll();
    };
    boardList.appendChild(d);
  });
}

/* ========= Deal ========= */
function startDeal(){
  let deck;
  try{ deck = buildDeck(); }
  catch(err){ alert(err.message || "配置錯誤"); return; }

  S.seats = Array(S.n+1).fill(null).map((_,i)=> i===0 ? null : ({
    no:i,
    role:null,
    camp:null,
    alive:true,
    death:null,
    events:[]
  }));
  S.seen = {};
  S.selectedSeat = null;
  S.godView = false;

  S.log = [];
  S.logGod = [];

  S.thiefSeat = null;
  S.thiefResolved = false;

  // reset night
  S.night.guardTarget = null;
  S.night.wolfTarget = null;
  S.night.seerTarget = null;
  S.night.seerResult = null;
  S.night.witchChoice = null;
  S.night.witchTarget = null;
  // witch uses 保留到整局
  S.night.witchSaveUsed = false;
  S.night.witchPoisonUsed = false;
  S.night.lastGuardTarget = null;

  // 發 N 人
  for(let i=1;i<=S.n;i++){
    const role = deck.pop();
    S.seats[i].role = role;
    S.seats[i].camp = campOf(role);
    if(role === "盜賊") S.thiefSeat = i;
  }

  // 底牌（盜賊用）
  S.bottom = [];
  for(let k=0;k<(S.config.plusBottom||0);k++){
    S.bottom.push(deck.pop());
  }

  S.deck = [];
  S.phase = "DEAL";
  S.stepIndex = 0;
  S.day = 1;

  saveState();
  renderAll();
}

function allSeen(){
  for(let i=1;i<=S.n;i++) if(!S.seen[i]) return false;
  return true;
}
function canStartNight(){
  if(S.phase!=="DEAL") return false;
  if(!allSeen()) return false;
  if(S.config.hasThief && !S.thiefResolved) return false;
  return true;
}

/* ========= Thief ========= */
function resolveThiefIfNeeded(){
  if(!S.config.hasThief) return;
  if(S.thiefResolved) return;
  if(!S.thiefSeat) return;
  if(!S.bottom || S.bottom.length !== 2) return;

  const a = S.bottom[0];
  const b = S.bottom[1];
  const mustWolf = isWolf(a) || isWolf(b);

  thiefHint.textContent = mustWolf
    ? "底牌含狼人陣營：盜賊必須選擇狼人陣營（另一張移出遊戲）。"
    : "請從兩張底牌中選擇其一成為你的新角色（另一張移出遊戲）。";

  btnThiefA.textContent = `選 ${a}`;
  btnThiefB.textContent = `選 ${b}`;

  function pick(role){
    if(mustWolf && !isWolf(role)){
      alert("此局底牌含狼人，你必須選狼人陣營。");
      return;
    }
    const chosen = role;
    const other = (role===a)?b:a;

    const seat = S.seats[S.thiefSeat];
    seat.role = chosen;
    seat.camp = campOf(chosen);

    S.bottom = []; // 放棄那張移出遊戲
    S.thiefResolved = true;
    S.logGod.push(`【盜賊】${S.thiefSeat}號 改為「${chosen}」，棄掉「${other}」（移出遊戲）`);

    closeModal(thiefModal);
    saveState();
    renderAll();
  }

  btnThiefA.onclick = ()=>pick(a);
  btnThiefB.onclick = ()=>pick(b);
  btnThiefClose.onclick = ()=>alert("盜賊必須先完成選角才能開始夜晚。");

  openModal(thiefModal);
}

/* ========= Seat UI ========= */
function renderSeats(){
  if(!seatsGrid) return;
  seatsGrid.innerHTML = "";
  for(let i=1;i<=S.n;i++){
    const seat = S.seats?.[i] || { no:i, alive:true, role:null, camp:null, events:[] };

    const b = document.createElement("button");
    b.type="button";
    b.className="seat";
    b.dataset.seat=String(i);

    if(seat.alive===false) b.classList.add("dead");
    if(S.selectedSeat===i) b.classList.add("isSelected");

    // 上帝視角依陣營框色
    if(S.godView && seat.camp){
      b.classList.add(seat.camp==="狼" ? "campWolf" : "campGood");
    }

    let sub = "點一下選取";
    if(S.phase==="DEAL"){
      sub = S.seen[i] ? "已看過（已蓋牌）" : "長按 0.3 秒看身分";
    }else if(S.godView && seat.role){
      sub = `${seat.role}・${seat.camp==="狼" ? "狼人":"好人"}`;
    }else if(seat.alive===false){
      sub = seat.death ? `死亡・${seat.death}` : "死亡";
    }

    const ev = (S.godView && seat.events?.length)
      ? `<div class="eventLine">${seat.events.join(" ")}</div>` : "";

    b.innerHTML = `
      <div class="seatNum">${i}</div>
      <div class="seatSub">${sub}</div>
      ${ev}
    `;
    seatsGrid.appendChild(b);
  }
}

function bindSeatClick(){
  if(!seatsGrid) return;
  seatsGrid.addEventListener("click",(e)=>{
    const btn = e.target.closest(".seat");
    if(!btn) return;
    const n = Number(btn.dataset.seat);
    if(!Number.isFinite(n)) return;

    // toggle
    S.selectedSeat = (S.selectedSeat===n)?null:n;
    saveState();
    renderSeats();
    renderPhasePrompt(); // 讓提示文字更新「目前選了誰」
  });
}

/* 長按看身分（DEAL only） */
let pressTimer=null;
let currentViewingSeat=null;

function bindSeatLongPress(){
  if(!seatsGrid) return;

  function startPress(btn){
    if(S.phase!=="DEAL") return;
    const n = Number(btn?.dataset?.seat);
    if(!Number.isFinite(n)) return;

    // 先選取該座位
    if(S.selectedSeat!==n){
      S.selectedSeat=n;
      saveState();
      renderSeats();
    }

    pressTimer=setTimeout(()=>showIdentity(n), 300);
  }
  function cancel(){
    if(pressTimer){ clearTimeout(pressTimer); pressTimer=null; }
  }

  seatsGrid.addEventListener("touchstart",(e)=>{
    const btn=e.target.closest(".seat");
    if(btn) startPress(btn);
  },{passive:true});
  seatsGrid.addEventListener("touchend",cancel);
  seatsGrid.addEventListener("touchmove",cancel);

  seatsGrid.addEventListener("mousedown",(e)=>{
    const btn=e.target.closest(".seat");
    if(btn) startPress(btn);
  });
  seatsGrid.addEventListener("mouseup",cancel);
  seatsGrid.addEventListener("mouseleave",cancel);
}

function showIdentity(n){
  const seat=S.seats[n];
  if(!seat) return;

  currentViewingSeat=n;
  roleModalTitle.textContent=`${n}號 身分`;
  roleModalRole.textContent=seat.role||"—";
  roleModalCamp.textContent=`陣營：${seat.camp==="狼"?"狼人":"好人"}`;
  openModal(roleModal);
}

// ✅ 看完立即蓋牌；若是盜賊，立刻二選一
function doneIdentity(){
  if(currentViewingSeat!=null){
    S.seen[currentViewingSeat]=true;
    const seat=S.seats[currentViewingSeat];
    closeModal(roleModal);
    currentViewingSeat=null;

    saveState();
    renderSeats();

    if(seat?.role==="盜賊"){
      setTimeout(()=>resolveThiefIfNeeded(), 60);
    }
    renderAll();
  }else{
    closeModal(roleModal);
  }
}

btnRoleDone?.addEventListener("click", doneIdentity);
btnRoleClose?.addEventListener("click", ()=>closeModal(roleModal));

/* ========= Phase Prompt ========= */
function rolesPresentAlive(){
  const present = new Set();
  for(let i=1;i<=S.n;i++){
    const seat=S.seats[i];
    if(seat?.alive && seat.role) present.add(seat.role);
  }
  return present;
}

function seatByRole(role){
  for(let i=1;i<=S.n;i++){
    if(S.seats[i]?.alive && S.seats[i]?.role===role) return i;
  }
  return null;
}

function buildNightSteps(){
  const present = rolesPresentAlive();
  const steps = [];

  // Cupid first night
  if(S.day===1 && present.has("邱比特")){
    steps.push({key:"cupid", title:`夜晚 ${S.day}`, text:"邱比特請睜眼（選兩位戀人）", needPick:true, pickCount:2});
  }
  if(present.has("守衛")){
    steps.push({key:"guard", title:`夜晚 ${S.day}`, text:"守衛請睜眼（選擇守護）\n- 不可連守同一人", needPick:true, pickCount:1});
  }
  steps.push({key:"wolves", title:`夜晚 ${S.day}`, text:"狼人請睜眼（選擇刀人）", needPick:true, pickCount:1});

  if(present.has("預言家")){
    steps.push({key:"seer", title:`夜晚 ${S.day}`, text:"預言家請睜眼（查驗一人）", needPick:true, pickCount:1});
  }
  if(present.has("女巫")){
    steps.push({key:"witch", title:`夜晚 ${S.day}`, text:"女巫請睜眼（解藥 / 毒藥）\n- 點刀口 = 救（💊，同夜不可再毒）\n- 點其他人 = 毒（🧪，同夜不可再救）\n- 再點同號可取消", needPick:true, pickCount:1, witch:true});
  }
  return steps;
}

function renderPhasePrompt(){
  if(S.phase==="SETUP"){
    setPrompt(
      "開局設定",
      "1) 先選人數\n2) 再選板子（點一下會變色）\n3) 按底部「下一步」進入抽身分",
      "（你指定：12人標準 = 四狼四神四民，民只有平民）"
    );
    return;
  }

  if(S.phase==="DEAL"){
    const done = Object.keys(S.seen).length;
    const warnThief = (S.config.hasThief && !S.thiefResolved)
      ? "⚠️ 盜賊尚未完成選角（盜賊看完身分會立刻二選一）\n" : "";
    setPrompt(
      `抽身分（${done}/${S.n}）`,
      `上帝點選座位（可取消）→ 玩家長按 0.3 秒看身分 → 按「我看完了」\n看完會自動蓋牌（不會露出角色）\n全部看完後按「開始夜晚」進入夜晚流程\n${warnThief}`.trim()
    );
    return;
  }

  if(S.phase==="NIGHT"){
    const steps = buildNightSteps();
    const s = steps[S.stepIndex];
    if(!s){
      setPrompt(`夜晚 ${S.day}`, "夜晚步驟已完成，請按「天亮睜眼」結算。");
      return;
    }
    const sel = S.selectedSeat ? `（已選：${S.selectedSeat}號）` : "（尚未選座位）";

    // witch 額外顯示刀口
    let extra = "";
    if(s.key==="witch"){
      const knife = S.night.wolfTarget ? `${S.night.wolfTarget}號` : "（尚未有刀口）";
      extra = `\n\n刀口：${knife}\n本夜已選：${S.night.witchChoice ? (S.night.witchChoice==="save"?"💊救":"🧪毒") : "尚未"}`
            + `\n解藥：${S.night.witchSaveUsed?"已用":"未用"}／毒藥：${S.night.witchPoisonUsed?"已用":"未用"}`;
    }

    setPrompt(
      s.title,
      `${s.text}\n👉 操作：點座位選取；再點同號取消；按「下一步」確認\n${sel}${extra}`
    );
    return;
  }

  if(S.phase==="DAY"){
    setPrompt(
      `白天 ${S.day}`,
      `天亮了，請宣布昨夜結果（可按📣公告回顧）。\n\n白天流程：自由發言 → ${(S.hasPolice?"可上警":"不設上警")} → 推理/辯論 → 投票\n\n按「開始投票」進入投票收票。`
    );
    return;
  }

  if(S.phase==="VOTE"){
    const voter = S.vote.currentVoter;
    const voterTxt = voter ? `${voter}號` : "（尚未選投票者）";
    const targetTxt = S.selectedSeat ? `${S.selectedSeat}號` : "（尚未選被投者）";
    setPrompt(
      `投票（白天 ${S.day}）`,
      `上帝收票流程：\n1) 先按座位選「投票者」→ 按「下一步」確認投票者\n2) 再選「被投者」（或按「中間主鍵」棄票）→ 按「下一步」確認\n\n目前投票者：${voterTxt}\n目前被投者：${targetTxt}\n剩餘未收票：${S.vote.voterQueue.length} 人`
    );
    return;
  }

  if(S.phase==="END"){
    setPrompt("遊戲結束", S.endText || "—");
  }
}

/* ========= Night Validation & Confirm ========= */
function ensureAliveSeat(n){
  return !!(n && S.seats[n]?.alive);
}

function confirmNightStep(){
  const steps = buildNightSteps();
  const step = steps[S.stepIndex];
  if(!step) return;

  const key = step.key;

  // helper: 需要選1人
  function requirePick(){
    if(!S.selectedSeat){
      alert("請先點選座位（再按下一步確認）");
      return false;
    }
    if(!ensureAliveSeat(S.selectedSeat)){
      alert("該座位已死亡，請改選存活座位");
      return false;
    }
    return true;
  }

  // Cupid（簡化：用兩次選擇）
  if(key==="cupid"){
    S._cupidPick = S._cupidPick || [];
    if(!requirePick()) return;
    if(S._cupidPick.includes(S.selectedSeat)){
      alert("已選過這個座位，請選另一位");
      return;
    }
    S._cupidPick.push(S.selectedSeat);
    S.selectedSeat = null;
    saveState();
    renderSeats();

    if(S._cupidPick.length < 2){
      alert(`已選第 ${S._cupidPick.length} 位戀人，請再選第 2 位`);
      renderPhasePrompt();
      return;
    }
    S.logGod.push(`【邱比特】戀人：${S._cupidPick[0]}號 & ${S._cupidPick[1]}號`);
    S._cupidPick = [];
    S.stepIndex++;
    saveState(); renderAll();
    return;
  }

  // Guard
  if(key==="guard"){
    if(!requirePick()) return;

    // 不可連守同一人
    if(S.night.lastGuardTarget && S.selectedSeat === S.night.lastGuardTarget){
      alert("守衛不可連守同一人，請改選");
      return;
    }

    S.night.guardTarget = S.selectedSeat;
    S.logGod.push(`【守衛】守護：${S.selectedSeat}號`);
    S.seats[S.selectedSeat].events.push("🛡️");

    S.selectedSeat = null;
    S.stepIndex++;
    saveState(); renderAll();
    return;
  }

  // Wolves
  if(key==="wolves"){
    if(!requirePick()) return;

    if(!S.allowWolfKillWolf){
      const targetRole = S.seats[S.selectedSeat]?.role;
      if(isWolf(targetRole)){
        alert("狼人不可刀狼人（如需允許可再加開關），請改選");
        return;
      }
    }

    S.night.wolfTarget = S.selectedSeat;
    S.logGod.push(`【狼人】刀：${S.selectedSeat}號`);
    S.seats[S.selectedSeat].events.push("🐺🗡️");

    S.selectedSeat = null;
    S.stepIndex++;
    saveState(); renderAll();
    return;
  }

  // Seer
  if(key==="seer"){
    if(!requirePick()) return;

    const t = S.selectedSeat;
    const camp = S.seats[t].camp;
    const result = (camp==="狼") ? "狼人" : "好人";
    S.night.seerTarget = t;
    S.night.seerResult = result;
    S.logGod.push(`【預言家】查驗：${t}號 → ${result}`);
    // 讓上帝口頭宣告：提示仍保留在畫面
    alert(`查驗結果：${t}號 是「${result}」`);

    S.selectedSeat = null;
    S.stepIndex++;
    saveState(); renderAll();
    return;
  }

  // Witch (同夜救/毒二選一，且用過就不能再用)
  if(key==="witch"){
    if(!S.selectedSeat){
      // 允許女巫不操作直接下一步
      S.logGod.push("【女巫】本夜不使用藥");
      S.stepIndex++;
      saveState(); renderAll();
      return;
    }
    if(!ensureAliveSeat(S.selectedSeat)){
      alert("該座位已死亡，請改選存活座位或取消");
      return;
    }

    const knife = S.night.wolfTarget;
    const t = S.selectedSeat;

    // 點刀口=救
    if(knife && t === knife){
      if(S.night.witchPoisonUsed || S.night.witchChoice==="poison"){
        alert("本夜已選毒藥，不能再救。請先取消或直接下一步。");
        return;
      }
      if(S.night.witchSaveUsed){
        alert("解藥已用過，不能再救。");
        return;
      }
      // 不可自救（預設 false）
      const witchSeat = seatByRole("女巫");
      if(!S.allowWitchSelfSave && witchSeat && t === witchSeat){
        alert("此局設定：女巫不可自救。");
        return;
      }

      S.night.witchChoice = "save";
      S.night.witchTarget = t;
      // 先不結算，夜晚結算才用
      alert(`女巫選擇：💊 救 ${t}號（按下一步確認）`);
      // 不清 selection，讓你看得到目前選中刀口
      return;
    }

    // 點其他人=毒
    if(S.night.witchSaveUsed || S.night.witchChoice==="save"){
      alert("本夜已選救，不能再毒。請先取消或直接下一步。");
      return;
    }
    if(S.night.witchPoisonUsed){
      alert("毒藥已用過，不能再毒。");
      return;
    }

    S.night.witchChoice = "poison";
    S.night.witchTarget = t;
    alert(`女巫選擇：🧪 毒 ${t}號（按下一步確認）`);
    return;
  }
}

/* Witch step 的「下一步」：若已選救/毒，就在這裡確定並往下一步 */
function confirmWitchAndAdvance(){
  if(S.phase!=="NIGHT") return false;
  const steps = buildNightSteps();
  const step = steps[S.stepIndex];
  if(!step || step.key!=="witch") return false;

  // 若沒選（或選了但還沒確定），這裡做確定並結束女巫步
  if(!S.night.witchChoice){
    S.logGod.push("【女巫】本夜不使用藥");
    S.stepIndex++;
    S.selectedSeat=null;
    saveState(); renderAll();
    return true;
  }

  if(S.night.witchChoice==="save"){
    S.night.witchSaveUsed = true;
    S.logGod.push(`【女巫】💊 解藥：救 ${S.night.witchTarget}號`);
    S.seats[S.night.witchTarget].events.push("💊");
  }else if(S.night.witchChoice==="poison"){
    S.night.witchPoisonUsed = true;
    S.logGod.push(`【女巫】🧪 毒藥：毒 ${S.night.witchTarget}號`);
    S.seats[S.night.witchTarget].events.push("🧪");
  }

  S.stepIndex++;
  S.selectedSeat=null;
  saveState(); renderAll();
  return true;
}

/* ========= Night Resolution ========= */
function killSeat(no, reason){
  const s = S.seats[no];
  if(!s || !s.alive) return;
  s.alive = false;
  s.death = reason || "死亡";
  s.events.push("☠️");
}

function resolveNight(){
  // 先判斷：狼刀是否被盾擋 / 被女巫救
  const wolfTarget = S.night.wolfTarget;
  const guardTarget = S.night.guardTarget;
  const witchChoice = S.night.witchChoice;
  const witchTarget = S.night.witchTarget;

  let wolfKilled = null;

  if(wolfTarget && ensureAliveSeat(wolfTarget)){
    let blocked = false;
    if(guardTarget && guardTarget === wolfTarget) blocked = true;

    let saved = false;
    if(witchChoice==="save" && witchTarget === wolfTarget) saved = true;

    if(!blocked && !saved){
      wolfKilled = wolfTarget;
      killSeat(wolfTarget, "狼刀");
    }else{
      if(blocked) S.logGod.push(`【結算】🛡️ 守護擋刀：${wolfTarget}號`);
      if(saved)   S.logGod.push(`【結算】💊 解藥救回：${wolfTarget}號`);
    }
  }

  // 毒藥結算（不被守護擋）
  let poisoned = null;
  if(witchChoice==="poison" && witchTarget && ensureAliveSeat(witchTarget)){
    poisoned = witchTarget;
    killSeat(witchTarget, "毒死");
  }

  // 公開公告（只寫「幾號倒牌」，不寫原因）
  const dead = [];
  if(wolfKilled) dead.push(wolfKilled);
  if(poisoned && poisoned!==wolfKilled) dead.push(poisoned);

  if(dead.length===0){
    S.log.push(`${nowDayLabel()} 昨夜結果：平安夜`);
  }else{
    S.log.push(`${nowDayLabel()} 昨夜結果：倒牌 ${dead.sort((a,b)=>a-b).map(x=>`${x}號`).join("、")}`);
  }

  // 更新守衛 last target
  if(guardTarget) S.night.lastGuardTarget = guardTarget;

  // 清空當夜暫存（藥已用不重置）
  S.night.guardTarget = null;
  S.night.wolfTarget = null;
  S.night.seerTarget = null;
  S.night.seerResult = null;
  S.night.witchChoice = null;
  S.night.witchTarget = null;

  // 勝負判定
  checkWinAndMaybeEnd();
}

/* ========= Win Check ========= */
function countAlive(){
  let wolves=0, gods=0, villagers=0, good=0;
  for(let i=1;i<=S.n;i++){
    const seat=S.seats[i];
    if(!seat?.alive) continue;
    const role = seat.role;
    const camp = seat.camp;
    if(camp==="狼") wolves++;
    else{
      good++;
      if(role==="平民") villagers++;
      else gods++;
    }
  }
  return {wolves,gods,villagers,good};
}

function checkWinAndMaybeEnd(){
  const {wolves,gods,villagers,good} = countAlive();

  // 好人勝：狼全滅
  if(wolves===0){
    endGame(`✅ 好人勝利！\n（狼全滅）`);
    return true;
  }

  if(S.winMode==="city"){
    // 屠城：狼數 >= 好人數
    if(wolves >= good){
      endGame(`🐺 狼人勝利！\n（屠城：狼數 ${wolves} ≥ 好人數 ${good}）`);
      return true;
    }
  }else{
    // 屠邊：神全死 或 民全死
    if(gods===0 || villagers===0){
      endGame(`🐺 狼人勝利！\n（屠邊：${gods===0?"神全死":"民全死"}）`);
      return true;
    }
  }
  return false;
}

function endGame(text){
  S.phase="END";
  S.endText=text;
  S.log.push(`【遊戲結束】${text.replace(/\n/g," ")}`);
  saveState();
  renderAll();
  alert(text);
}

/* ========= Vote Flow ========= */
function startVote(){
  S.phase="VOTE";
  S.selectedSeat = null;
  S.vote.voterQueue = [];
  S.vote.currentVoter = null;
  S.vote.tally = {};

  for(let i=1;i<=S.n;i++){
    if(S.seats[i]?.alive) S.vote.voterQueue.push(i);
  }
  saveState();
  renderAll();
}

// VOTE：下一步被分成兩段
// A) 若 currentVoter 尚未設定：把 selectedSeat 當作投票者
// B) 若 currentVoter 已設定：把 selectedSeat 當作被投者（若 null 代表棄票）
function voteNext(){
  if(S.phase!=="VOTE") return;

  if(!S.vote.currentVoter){
    // 選投票者
    if(!S.selectedSeat){
      alert("請先點選「投票者」座位");
      return;
    }
    const v = S.selectedSeat;
    if(!S.seats[v]?.alive){
      alert("投票者必須是存活座位");
      return;
    }
    // 投票者必須在 queue
    if(!S.vote.voterQueue.includes(v)){
      alert("這位投票者已收過票或不在待收名單");
      return;
    }
    S.vote.currentVoter = v;
    S.selectedSeat = null;
    saveState();
    renderAll();
    return;
  }

  // 選被投者（可棄票：用中間主鍵）
  const voter = S.vote.currentVoter;
  const target = S.selectedSeat; // null 代表還沒選
  if(!target){
    alert("請先選被投者；若要棄票請按「結束/棄票」(中間主鍵)");
    return;
  }
  if(!S.seats[target]?.alive){
    alert("被投者必須是存活座位");
    return;
  }

  // 記票
  const key = `${target}號`;
  S.vote.tally[key] = S.vote.tally[key] || [];
  S.vote.tally[key].push(voter);

  // 移出 queue
  S.vote.voterQueue = S.vote.voterQueue.filter(x=>x!==voter);
  S.vote.currentVoter = null;
  S.selectedSeat = null;

  // 若收完票 -> 統計並進下一夜
  if(S.vote.voterQueue.length===0){
    finalizeVote();
    return;
  }

  saveState();
  renderAll();
}

// 中間主鍵在 VOTE 階段：棄票
function voteAbstain(){
  if(S.phase!=="VOTE") return;
  if(!S.vote.currentVoter){
    alert("請先選投票者，再按中間鍵棄票");
    return;
  }
  const voter = S.vote.currentVoter;
  const key = "棄票";
  S.vote.tally[key] = S.vote.tally[key] || [];
  S.vote.tally[key].push(voter);

  S.vote.voterQueue = S.vote.voterQueue.filter(x=>x!==voter);
  S.vote.currentVoter = null;
  S.selectedSeat = null;

  if(S.vote.voterQueue.length===0){
    finalizeVote();
    return;
  }
  saveState();
  renderAll();
}

function finalizeVote(){
  // 統計
  const lines = Object.entries(S.vote.tally)
    .sort((a,b)=>b[1].length-a[1].length)
    .map(([k,arr])=>`${k}：${arr.length} 票（${arr.sort((x,y)=>x-y).join("、")}）`);

  S.log.push(`${nowDayLabel()} 投票結果：\n${lines.join("\n") || "（無）"}`);
  S.logGod.push(`【上帝】完成 ${nowDayLabel()} 投票收票`);

  // 進入下一夜
  S.phase="NIGHT";
  S.day += 1;
  S.stepIndex = 0;
  S.selectedSeat = null;

  saveState();
  renderAll();
}

/* ========= Navigation ========= */
function goSetup(){
  S.phase="SETUP";
  S.stepIndex=0;
  S.day=1;
  S.selectedSeat=null;
  saveState();
  renderAll();
}

function startNight(){
  if(!canStartNight()){
    alert("尚未完成：請確認所有人都看完身分，且盜賊已完成二選一。");
    return;
  }
  S.phase="NIGHT";
  S.stepIndex=0;
  S.selectedSeat=null;
  saveState();
  renderAll();
}

function dawn(){
  // 夜晚結算 + 進白天
  resolveNight();
  if(S.phase==="END") return;

  S.phase="DAY";
  S.stepIndex=0;
  S.selectedSeat=null;
  saveState();
  renderAll();
}

/* ========= Announce / God View / Dice ========= */
function renderAnnounce(){
  const showGod = !!toggleAnnGod?.checked;
  const pub = (S.log||[]).join("\n\n");
  const god = (S.logGod||[]).join("\n");
  if(annText){
    annText.textContent = showGod
      ? (pub + (god ? `\n\n—— 上帝詳細 ——\n${god}` : ""))
      : (pub || "（尚無公告）");
  }
}

function toggleGodView(){
  S.godView = !S.godView;
  saveState();
  renderAll();
}

function rollDiceAlive(){
  const alive=[];
  for(let i=1;i<=S.n;i++) if(S.seats[i]?.alive) alive.push(i);
  if(!alive.length) return null;
  return alive[randInt(0, alive.length-1)];
}

/* ========= Main Buttons Text ========= */
function updateMainButtons(){
  if(!btnMain || !btnBack || !btnNext) return;

  if(S.phase==="SETUP"){
    btnMain.textContent="—";
    btnMain.disabled=true;
    btnBack.disabled=true;
    btnNext.disabled=false; // 下一步=發牌
    return;
  }

  if(S.phase==="DEAL"){
    btnMain.textContent="開始夜晚";
    btnMain.disabled=!canStartNight();
    btnBack.disabled=false;
    btnNext.disabled=false; // 提示用
    return;
  }

  if(S.phase==="NIGHT"){
    btnMain.textContent="天亮睜眼";
    btnMain.disabled=false;
    btnBack.disabled=false;
    btnNext.disabled=false; // 下一步=確認步驟
    return;
  }

  if(S.phase==="DAY"){
    btnMain.textContent="開始投票";
    btnMain.disabled=false;
    btnBack.disabled=false;
    btnNext.disabled=false;
    return;
  }

  if(S.phase==="VOTE"){
    btnMain.textContent="棄票/略過";
    btnMain.disabled=false;
    btnBack.disabled=false;
    btnNext.disabled=false; // 下一步=收票流程
    return;
  }

  if(S.phase==="END"){
    btnMain.textContent="回到開局";
    btnMain.disabled=false;
    btnBack.disabled=true;
    btnNext.disabled=true;
  }
}

/* ========= Render All ========= */
function renderAll(){
  setTop(`${S.phase} / day ${S.day} / step ${S.stepIndex+1}`, S.boardId || "—");

  if(S.phase==="SETUP") show(setupCard);
  else hide(setupCard);

  // seats safety
  if(!S.seats || S.seats.length !== S.n+1){
    S.seats = Array(S.n+1).fill(null).map((_,i)=> i===0 ? null : ({
      no:i, role:null, camp:null, alive:true, death:null, events:[]
    }));
  }

  renderPhasePrompt();
  renderSeats();
  updateMainButtons();
  renderAnnounce();
}

/* ========= Bind Top Buttons ========= */
function bindTopButtons(){
  btnAnn?.addEventListener("click", ()=>openDrawer(annBackdrop, annDrawer));
  btnCloseAnn?.addEventListener("click", ()=>closeDrawer(annBackdrop, annDrawer));
  annBackdrop?.addEventListener("click", ()=>closeDrawer(annBackdrop, annDrawer));
  toggleAnnGod?.addEventListener("change", renderAnnounce);

  btnSettings?.addEventListener("click", ()=>openDrawer(setBackdrop, setDrawer));
  btnCloseSet?.addEventListener("click", ()=>closeDrawer(setBackdrop, setDrawer));
  setBackdrop?.addEventListener("click", ()=>closeDrawer(setBackdrop, setDrawer));

  btnEye?.addEventListener("click", toggleGodView);

  btnDice?.addEventListener("click", ()=>{
    const n = rollDiceAlive();
    alert(n ? `🎲 今日發言起點：${n}號` : "目前無存活座位");
  });

  btnTimer?.addEventListener("click", ()=>alert("⌛️ 計時器：你原本的 timer drawer 可保留（如要我再把功能接回來我再補）"));

  segEdge?.addEventListener("click", ()=>{
    S.winMode="edge"; saveState();
    segEdge.classList.add("primary"); segCity?.classList.remove("primary");
  });
  segCity?.addEventListener("click", ()=>{
    S.winMode="city"; saveState();
    segCity.classList.add("primary"); segEdge?.classList.remove("primary");
  });

  togglePolice?.addEventListener("change", ()=>{
    S.hasPolice = !!togglePolice.checked;
    saveState();
    renderAll();
  });

  btnGotoSetup?.addEventListener("click", ()=>{
    if(confirm("回到開局會結束目前遊戲並回到選板子。確定？")){
      S = structuredClone(DEFAULT_STATE);
      saveState();
      renderSetup();
      renderAll();
      closeDrawer(setBackdrop,setDrawer);
    }
  });

  btnHardReset?.addEventListener("click", ()=>{
    if(confirm("清空所有資料（硬重置）？")){
      localStorage.removeItem(LS_KEY);
      location.reload();
    }
  });
}

/* ========= Bind Bottom Buttons ========= */
function bindBottomButtons(){
  btnBack?.addEventListener("click", ()=>{
    if(S.phase==="SETUP") return;

    if(S.phase==="DEAL"){
      goSetup();
      return;
    }

    if(S.phase==="NIGHT"){
      // 退一步
      S.stepIndex = Math.max(0, S.stepIndex-1);
      S.selectedSeat=null;
      saveState(); renderAll();
      return;
    }

    if(S.phase==="DAY"){
      // 回夜晚（不建議，但保留）
      S.phase="NIGHT";
      S.stepIndex = Math.max(0, buildNightSteps().length-1);
      saveState(); renderAll();
      return;
    }

    if(S.phase==="VOTE"){
      // 回DAY
      S.phase="DAY";
      S.vote.currentVoter=null;
      S.selectedSeat=null;
      saveState(); renderAll();
      return;
    }

    if(S.phase==="END"){
      // no-op
      return;
    }
  });

  btnMain?.addEventListener("click", ()=>{
    if(S.phase==="DEAL"){
      startNight();
      return;
    }
    if(S.phase==="NIGHT"){
      dawn();
      return;
    }
    if(S.phase==="DAY"){
      startVote();
      return;
    }
    if(S.phase==="VOTE"){
      voteAbstain(); // 棄票
      return;
    }
    if(S.phase==="END"){
      S = structuredClone(DEFAULT_STATE);
      saveState();
      renderSetup();
      renderAll();
      return;
    }
  });

  btnNext?.addEventListener("click", ()=>{
    if(S.phase==="SETUP"){
      startDeal();
      return;
    }

    if(S.phase==="DEAL"){
      alert("抽身分階段：點座位後長按 0.3 秒看身分；看完按「我看完了」。全部看完後按「開始夜晚」。");
      return;
    }

    if(S.phase==="NIGHT"){
      // 若此步是女巫，下一步先確定女巫，再往下
      if(confirmWitchAndAdvance()) return;

      // 一般步驟確認
      const steps = buildNightSteps();
      const step = steps[S.stepIndex];

      // 若步驟不存在（全部跳過）就讓你可以結束
      if(!step){
        alert("夜晚步驟已完成，可按「天亮睜眼」結算。");
        return;
      }

      // 若該角色不存在（被跳過），直接前進
      // （其實 buildNightSteps 已經只取存活角色，但保險）
      confirmNightStep();
      return;
    }

    if(S.phase==="DAY"){
      alert("白天流程：發言→推理→投票。請按「開始投票」進入收票。");
      return;
    }

    if(S.phase==="VOTE"){
      voteNext();
      return;
    }
  });
}

/* ========= Boot ========= */
function boot(){
  // init toggles
  if(togglePolice) togglePolice.checked = !!S.hasPolice;
  if(S.winMode==="city"){
    segCity?.classList.add("primary"); segEdge?.classList.remove("primary");
  }else{
    segEdge?.classList.add("primary"); segCity?.classList.remove("primary");
  }

  renderSetup();
  bindSeatClick();
  bindSeatLongPress();
  bindTopButtons();
  bindBottomButtons();
  renderAll();
}

boot();