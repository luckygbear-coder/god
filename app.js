/* =========================
   狼人殺上帝輔助 app.js
========================= */

/* ---------- iOS: 防雙擊縮放 + 防長按選取/選單 ---------- */
(function preventIOS(){
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 280) e.preventDefault();
    lastTouchEnd = now;
  }, { passive:false });

  document.addEventListener("contextmenu", (e) => e.preventDefault());
})();

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);

const uiStatus = $("uiStatus");
const uiBoard  = $("uiBoard");

const promptTitle = $("promptTitle");
const promptText  = $("promptText");
const promptFoot  = $("promptFoot");

const seatsGrid   = $("seatsGrid");
const setupCard   = $("setupCard");
const boardList   = $("boardList");
const boardHint   = $("boardHint");

const btnBack = $("btnBack");
const btnMain = $("btnMain");
const btnNext = $("btnNext");

const btnAnn      = $("btnAnn");
const btnTimer    = $("btnTimer");
const btnEye      = $("btnEye");
const btnDice     = $("btnDice");
const btnSettings = $("btnSettings");

/* Drawers */
const timerBackdrop = $("timerBackdrop");
const timerDrawer   = $("timerDrawer");
const btnCloseTimer = $("btnCloseTimer");
const timerBigEl    = $("timerBig");
const btnTimerStart = $("btnTimerStart");
const btnTimerPause = $("btnTimerPause");
const btnTimerReset = $("btnTimerReset");
const timerPresets  = $("timerPresets");

const annBackdrop   = $("annBackdrop");
const annDrawer     = $("annDrawer");
const btnCloseAnn   = $("btnCloseAnn");
const annText       = $("annText");
const toggleAnnGod  = $("toggleAnnGod");

const setBackdrop   = $("setBackdrop");
const setDrawer     = $("setDrawer");
const btnCloseSet   = $("btnCloseSet");
const segEdge       = $("segEdge");
const segCity       = $("segCity");
const togglePolice  = $("togglePolice");
const btnGotoSetup  = $("btnGotoSetup");
const btnHardReset  = $("btnHardReset");

/* Modals */
const roleModal       = $("roleModal");
const roleModalTitle  = $("roleModalTitle");
const roleModalRole   = $("roleModalRole");
const roleModalCamp   = $("roleModalCamp");
const btnRoleDone     = $("btnRoleDone");
const btnRoleClose    = $("btnRoleClose");

const diceModal     = $("diceModal");
const diceResult    = $("diceResult");
const btnDiceAgain  = $("btnDiceAgain");
const btnDiceClose  = $("btnDiceClose");

const thiefModal   = $("thiefModal");
const thiefHint    = $("thiefHint");
const btnThiefA    = $("btnThiefA");
const btnThiefB    = $("btnThiefB");
const btnThiefClose= $("btnThiefClose");

/* ---------- Data ---------- */
const CAMP = { WOLF:"狼人", GOOD:"好人" };

const ROLE = {
  SEER:"預言家",
  WITCH:"女巫",
  HUNTER:"獵人",
  GUARD:"守衛",
  IDIOT:"白痴",
  CUPID:"邱比特",
  THIEF:"盜賊",
  VILLAGER:"村民",
  WOLF:"狼人"
};

function roleCamp(role){
  return role === ROLE.WOLF ? CAMP.WOLF : CAMP.GOOD;
}

const BOARDS = [
  { id:"B9-A", n:9,  name:"9人・經典", desc:"3狼｜3民｜預言家｜女巫｜獵人",
    roles:[ROLE.WOLF,ROLE.WOLF,ROLE.WOLF, ROLE.VILLAGER,ROLE.VILLAGER,ROLE.VILLAGER, ROLE.SEER,ROLE.WITCH,ROLE.HUNTER] },
  { id:"B9-B", n:9,  name:"9人・守衛版", desc:"3狼｜2民｜預言家｜女巫｜獵人｜守衛",
    roles:[ROLE.WOLF,ROLE.WOLF,ROLE.WOLF, ROLE.VILLAGER,ROLE.VILLAGER, ROLE.SEER,ROLE.WITCH,ROLE.HUNTER,ROLE.GUARD] },

  { id:"B10-A", n:10, name:"10人・經典", desc:"3狼｜4民｜預言家｜女巫｜獵人",
    roles:[ROLE.WOLF,ROLE.WOLF,ROLE.WOLF, ROLE.VILLAGER,ROLE.VILLAGER,ROLE.VILLAGER,ROLE.VILLAGER, ROLE.SEER,ROLE.WITCH,ROLE.HUNTER] },
  { id:"B10-B", n:10, name:"10人・白痴版", desc:"3狼｜3民｜預言家｜女巫｜獵人｜白痴",
    roles:[ROLE.WOLF,ROLE.WOLF,ROLE.WOLF, ROLE.VILLAGER,ROLE.VILLAGER,ROLE.VILLAGER, ROLE.SEER,ROLE.WITCH,ROLE.HUNTER,ROLE.IDIOT] },

  { id:"B12-CUPID", n:12, name:"12人・邱比特戀人", desc:"4狼｜4民｜預言家｜女巫｜獵人｜守衛｜邱比特",
    roles:[ROLE.WOLF,ROLE.WOLF,ROLE.WOLF,ROLE.WOLF, ROLE.VILLAGER,ROLE.VILLAGER,ROLE.VILLAGER,ROLE.VILLAGER, ROLE.SEER,ROLE.WITCH,ROLE.HUNTER,ROLE.GUARD,ROLE.CUPID].slice(0,12) },

  { id:"B12-THIEF", n:12, name:"12人・盜賊", desc:"4狼｜4民｜預言家｜女巫｜獵人｜守衛｜白痴｜盜賊",
    roles:[ROLE.WOLF,ROLE.WOLF,ROLE.WOLF,ROLE.WOLF, ROLE.VILLAGER,ROLE.VILLAGER,ROLE.VILLAGER,ROLE.VILLAGER, ROLE.SEER,ROLE.WITCH,ROLE.HUNTER,ROLE.GUARD,ROLE.IDIOT,ROLE.THIEF].slice(0,12),
    hasThief:true }
];

/* ---------- State ---------- */
const LS_KEY = "wg_god_helper_v2";

const defaultState = () => ({
  stage:"setup", // setup|deal|night|day|vote
  day:1,
  night:0,

  winMode:"edge",
  hasPolice:false,

  n:null,
  boardId:null,

  godView:false,

  seats:[],
  selected:new Set(),

  dealt:0,

  rolesPool:[],

  thiefSeat:null,
  thiefOptions:null,
  thiefResolved:false,

  cupidSeat:null,
  lovers:[],

  witchSeat:null,
  witchHealUsed:false,
  witchPoisonUsed:false,
  wolfTarget:null,
  witchPoisonTarget:null,
  witchHealTarget:null,

  guardSeat:null,
  guardLast:null,

  seerSeat:null,
  seerChecked:[],

  hunterSeat:null,

  log:[],
  voteMode:{ step:"pickCandidate", candidate:null, voters:[] },
  votes:[],

  _nightIdx:0
});

let S = loadState();

/* ---------- Utils ---------- */
function saveState(){
  // Set 不能直接 JSON
  const out = {...S, selected:[...S.selected]};
  localStorage.setItem(LS_KEY, JSON.stringify(out));
}
function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return defaultState();
    const s = JSON.parse(raw);
    const base = Object.assign(defaultState(), s);
    base.selected = new Set(s.selected || []);
    return base;
  }catch(e){
    return defaultState();
  }
}
function resetHard(){
  localStorage.removeItem(LS_KEY);
  S = defaultState();
  renderAll();
}

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

function formatTime(sec){
  sec = Math.max(0, Math.floor(sec));
  const m = String(Math.floor(sec/60)).padStart(2,"0");
  const s = String(sec%60).padStart(2,"0");
  return `${m}:${s}`;
}
function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
function seatAlive(i){
  const seat = S.seats[i];
  return seat && !seat.dead;
}

function clearSelection(){ S.selected = new Set(); }
function toggleSelectSeat(i){
  if(!seatAlive(i) && S.stage!=="deal") return;
  if(S.selected.has(i)) S.selected.delete(i);
  else{
    if(S.stage!=="vote") S.selected = new Set([i]);
    else{
      if(S.voteMode.step==="pickVoters") S.selected.add(i);
      else S.selected = new Set([i]);
    }
  }
}

function addLogPublic(text, godText=""){
  S.log.push({ day:S.day, phase:S.stage, text, godText, ts:Date.now() });
}

function buildAnnText(){
  const showGod = !!toggleAnnGod.checked;
  const lines = [];
  S.log.forEach((e, idx)=>{
    lines.push(`【Day ${e.day}】${e.text}`);
    if(showGod && e.godText) lines.push(`  ${e.godText}`);
    if(idx !== S.log.length-1) lines.push("");
  });
  return lines.join("\n");
}

/* ---------- Seats build ---------- */
function buildSeats(n){
  S.seats = Array(n+1).fill(null);
  for(let i=1;i<=n;i++){
    S.seats[i] = {
      id:i,
      role:null,
      camp:null,
      dead:false,
      deadReason:null,
      marks:[],
      seen:false
    };
  }
}

function findSeatByRole(role){
  for(let i=1;i<=S.n;i++){
    if(S.seats[i]?.role===role) return i;
  }
  return null;
}

/* ---------- Boards UI ---------- */
function renderBoards(){
  boardList.innerHTML = "";
  const n = S.n;
  if(!n){
    boardHint.textContent = "請先選擇人數";
    return;
  }
  const filtered = BOARDS.filter(b=>b.n===n);
  if(!filtered.length){
    boardHint.textContent = "此人數目前沒有板子";
    return;
  }
  boardHint.textContent = "請選擇板子（點一下會變色）";

  filtered.forEach(b=>{
    const btn = document.createElement("button");
    btn.type="button";
    btn.className = "boardBtn" + (S.boardId===b.id ? " active":"");
    btn.innerHTML = `<div class="bTitle">${b.name}</div><div class="bSub">${b.desc}</div>`;
    btn.addEventListener("click", ()=>{
      S.boardId = b.id;
      saveState();
      renderBoards();
      renderTop();
      renderPrompt();
    });
    boardList.appendChild(btn);
  });
}

/* ---------- Deal ---------- */
function prepareDeal(){
  const board = BOARDS.find(b=>b.id===S.boardId);
  if(!board) return;

  S.stage="deal";
  S.day=1;
  S.night=0;
  S.dealt=0;
  S._nightIdx=0;
  clearSelection();

  buildSeats(board.n);

  S.rolesPool = shuffle(board.roles);
  for(let i=1;i<=board.n;i++){
    const r = S.rolesPool[i-1];
    S.seats[i].role = r;
    S.seats[i].camp = roleCamp(r);
  }

  S.seerSeat   = findSeatByRole(ROLE.SEER);
  S.witchSeat  = findSeatByRole(ROLE.WITCH);
  S.hunterSeat = findSeatByRole(ROLE.HUNTER);
  S.guardSeat  = findSeatByRole(ROLE.GUARD);
  S.cupidSeat  = findSeatByRole(ROLE.CUPID);
  S.thiefSeat  = findSeatByRole(ROLE.THIEF);
  S.thiefResolved = !S.thiefSeat;
  S.thiefOptions = null;

  S.witchHealUsed=false;
  S.witchPoisonUsed=false;
  S.wolfTarget=null;
  S.witchHealTarget=null;
  S.witchPoisonTarget=null;

  S.guardLast=null;
  S.lovers=[];
  S.seerChecked=[];

  S.log=[];
  S.votes=[];
  S.voteMode={ step:"pickCandidate", candidate:null, voters:[] };

  addLogPublic(`第 1 天開始。請依序抽身分。`, `【上帝】板子：${board.name} / ${board.desc}`);
  saveState();
  renderAll();
}

function countSeen(){
  let c=0;
  for(let i=1;i<=S.n;i++) if(S.seats[i]?.seen) c++;
  return c;
}

/* long press helper */
function attachLongPress(el, ms, fn){
  let t=null;
  const start=(e)=>{
    e.preventDefault?.();
    t=setTimeout(()=>{ t=null; fn(); }, ms);
  };
  const cancel=()=>{ if(t){ clearTimeout(t); t=null; } };

  el.addEventListener("touchstart", start, {passive:false});
  el.addEventListener("touchend", cancel);
  el.addEventListener("touchmove", cancel);
  el.addEventListener("touchcancel", cancel);

  el.addEventListener("mousedown", start);
  el.addEventListener("mouseup", cancel);
  el.addEventListener("mouseleave", cancel);
}

function openRoleModal(i){
  const seat = S.seats[i];
  roleModalTitle.textContent = `玩家 ${i} 號身分`;
  roleModalRole.textContent  = seat.role || "—";
  roleModalCamp.textContent  = seat.camp ? `陣營：${seat.camp}` : "—";
  openModal(roleModal);
}

btnRoleClose.onclick = ()=> closeModal(roleModal);
btnRoleDone.onclick = ()=>{
  const selected = [...S.selected][0];
  if(S.stage==="deal" && selected){
    S.seats[selected].seen = true;
    S.dealt = countSeen();
  }
  closeModal(roleModal);
  saveState();
  renderAll();

  // 盜賊：他看完後再跳選角
  if(S.stage==="deal" && selected===S.thiefSeat && !S.thiefResolved){
    setTimeout(openThiefChoice, 120);
  }
};

/* ---------- Thief ---------- */
function openThiefChoice(){
  if(!S.thiefSeat || S.thiefResolved) return;

  // 從「尚未被看過」的座位中抽 2 個角色（符合你說的“未被抽選/確認”概念）
  let pool = [];
  for(let i=1;i<=S.n;i++){
    if(i===S.thiefSeat) continue;
    if(S.seats[i] && !S.seats[i].seen) pool.push(i);
  }
  if(pool.length<2){
    pool = [...Array(S.n).keys()].slice(1).filter(x=>x!==S.thiefSeat);
  }
  pool = shuffle(pool);

  const aSeat = pool[0], bSeat = pool[1];
  const aRole = S.seats[aSeat].role;
  const bRole = S.seats[bSeat].role;

  const mustWolf = (aRole===ROLE.WOLF || bRole===ROLE.WOLF);
  S.thiefOptions = { a:{seat:aSeat, role:aRole}, b:{seat:bSeat, role:bRole}, mustWolf };

  thiefHint.textContent = mustWolf
    ? "抽到含狼人牌：你必須選擇狼人陣營。"
    : "抽到兩張好人牌：你可以自由選擇其一。";

  btnThiefA.textContent = aRole;
  btnThiefB.textContent = bRole;

  openModal(thiefModal);

  const choose = (pick) => {
    if(S.thiefOptions.mustWolf && pick.role!==ROLE.WOLF){
      thiefHint.textContent = "⚠️ 必須選狼人牌";
      setTimeout(()=> thiefHint.textContent = "抽到含狼人牌：你必須選擇狼人陣營。", 650);
      return;
    }

    const seat = S.thiefSeat;
    S.seats[seat].role = pick.role;
    S.seats[seat].camp = roleCamp(pick.role);

    // 重新定位關鍵角色位
    S.seerSeat   = findSeatByRole(ROLE.SEER);
    S.witchSeat  = findSeatByRole(ROLE.WITCH);
    S.hunterSeat = findSeatByRole(ROLE.HUNTER);
    S.guardSeat  = findSeatByRole(ROLE.GUARD);

    addLogPublic(
      `盜賊已完成選角。`,
      `【上帝】盜賊(${seat}號)選擇：${pick.role}；捨棄：${pick===S.thiefOptions.a ? S.thiefOptions.b.role : S.thiefOptions.a.role}`
    );

    S.thiefResolved = true;
    closeModal(thiefModal);
    saveState();
    renderAll();
  };

  btnThiefA.onclick = ()=> choose(S.thiefOptions.a);
  btnThiefB.onclick = ()=> choose(S.thiefOptions.b);
}
btnThiefClose.onclick = ()=> closeModal(thiefModal);

/* ---------- Night flow ---------- */
function countNightStepsTotal(){
  let c=0;
  if(S.night===1 && S.cupidSeat) c++;
  if(S.guardSeat) c++;
  c++; // wolf
  if(S.seerSeat) c++;
  if(S.witchSeat) c++;
  return c;
}

function getNightStep(){
  const steps = [];
  if(S.night===1 && S.cupidSeat){
    steps.push({ key:"cupid",
      text:`邱比特請睜眼（第 1 夜限定）\n請選擇兩位戀人（點兩位，按下一步）`,
      foot:"點兩個號碼即可；也可空過。"
    });
  }
  if(S.guardSeat){
    steps.push({ key:"guard",
      text:`守衛請睜眼（選擇守護）\n點一位要守護的玩家，按下一步`,
      foot:"可空守（不選直接下一步）。"
    });
  }
  steps.push({ key:"wolf",
    text:`狼人請睜眼（選擇刀人）\n點一位要刀的玩家，按下一步`,
    foot:"只記錄目標，不會立刻公開。"
  });
  if(S.seerSeat){
    steps.push({ key:"seer",
      text:`預言家請睜眼（查驗一人）\n點一位要查驗的玩家，按下一步`,
      foot:"查驗結果會寫入📣公告（上帝可看）。"
    });
  }
  if(S.witchSeat){
    steps.push({ key:"witch",
      text:`女巫請睜眼（解藥/毒藥）\n- 救：點狼刀目標（若有）\n- 毒：點其他玩家\n同一晚救/毒只能擇一`,
      foot:"不操作可直接下一步。"
    });
  }

  return steps[Math.min(S._nightIdx||0, steps.length-1)];
}

function advanceNightStep(){
  const step = getNightStep();
  const sel = [...S.selected];

  switch(step.key){
    case "cupid":{
      if(sel.length===2){
        S.lovers = sel.slice(0,2);
        addLogPublic(`邱比特完成連結戀人。`, `【上帝】戀人：${S.lovers[0]}號 & ${S.lovers[1]}號`);
      }else{
        addLogPublic(`邱比特未選擇戀人。`, `【上帝】戀人未設定`);
      }
      clearSelection();
      S._nightIdx++;
      break;
    }
    case "guard":{
      const target = sel[0]||null;
      if(target){
        if(S.guardLast && target===S.guardLast){
          addLogPublic(`守衛連守同一人（已忽略）`, `【上帝】連守限制：${target}號`);
        }else{
          S.seats[target].marks.push("🛡 守護");
          S.guardLast = target;
          addLogPublic(`守衛已守護。`, `【上帝】守護：${target}號`);
        }
      }else{
        addLogPublic(`守衛空守。`, `【上帝】空盾`);
      }
      clearSelection();
      S._nightIdx++;
      break;
    }
    case "wolf":{
      const target = sel[0]||null;
      S.wolfTarget = target;
      addLogPublic(`狼人已選擇刀人。`, `【上帝】狼刀：${target ? target+"號":"無"}`);
      clearSelection();
      S._nightIdx++;
      break;
    }
    case "seer":{
      const target = sel[0]||null;
      if(target){
        const camp = S.seats[target].camp;
        S.seerChecked.push({ day:S.day, seat:target, camp });
        addLogPublic(`預言家完成查驗。`, `【上帝】查驗：${target}號 → ${camp}`);
      }else{
        addLogPublic(`預言家未查驗。`, `【上帝】查驗：無`);
      }
      clearSelection();
      S._nightIdx++;
      break;
    }
    case "witch":{
      const target = sel[0]||null;
      if(!target){
        addLogPublic(`女巫未用藥。`, `【上帝】女巫：未操作`);
        clearSelection();
        S._nightIdx++;
        break;
      }

      if(S.wolfTarget && target===S.wolfTarget && !S.witchHealUsed){
        S.witchHealUsed = true;
        S.witchHealTarget = target;
        S.seats[target].marks.push("💊 解救");
        addLogPublic(`女巫使用解藥。`, `【上帝】解藥救：${target}號`);
        S.witchPoisonTarget = null;
      }else if(!S.witchPoisonUsed){
        S.witchPoisonUsed = true;
        S.witchPoisonTarget = target;
        S.seats[target].marks.push("🧪 中毒");
        addLogPublic(`女巫使用毒藥。`, `【上帝】毒藥毒：${target}號`);
        S.witchHealTarget = null;
      }else{
        addLogPublic(`女巫已無可用藥。`, `【上帝】藥已用完`);
      }

      clearSelection();
      S._nightIdx++;
      break;
    }
  }

  if(S._nightIdx >= countNightStepsTotal()){
    resolveNight();
  }
}

function resolveNight(){
  const deaths = [];

  if(S.wolfTarget){
    const t = S.wolfTarget;
    const savedByHeal = (S.witchHealTarget===t);
    const savedByGuard = S.seats[t].marks.includes("🛡 守護");
    if(!savedByHeal && !savedByGuard){
      deaths.push({seat:t, reason:"🐺 狼刀"});
      S.seats[t].marks.push("🐺 狼刀");
    }else{
      if(savedByGuard) addLogPublic(`守衛守護成功。`, `【上帝】盾到：${t}號`);
      if(savedByHeal) addLogPublic(`女巫解救成功。`, `【上帝】救到：${t}號`);
    }
  }

  if(S.witchPoisonTarget){
    deaths.push({seat:S.witchPoisonTarget, reason:"🧪 毒死"});
  }

  const uniq = new Map();
  deaths.forEach(d=>uniq.set(d.seat, d.reason));
  const finalDeaths = [...uniq.entries()].map(([seat,reason])=>({seat,reason}));

  if(finalDeaths.length===0){
    addLogPublic(`昨夜平安無事。`, `【上帝】平安夜`);
  }else{
    addLogPublic(`昨夜死亡：${finalDeaths.map(d=>`${d.seat}號`).join("、")}`,
      `【上帝】原因：${finalDeaths.map(d=>`${d.seat}號 ${d.reason}`).join("；")}`);
    finalDeaths.forEach(d=>{
      S.seats[d.seat].dead = true;
      S.seats[d.seat].deadReason = d.reason;
    });
  }

  S.wolfTarget=null;
  S.witchHealTarget=null;
  S.witchPoisonTarget=null;

  S.stage="day";
  S.day += 1;
  S._nightIdx=0;

  saveState();
  renderAll();
}

/* ---------- Vote ---------- */
function startVote(){
  S.stage="vote";
  S.voteMode={ step:"pickCandidate", candidate:null, voters:[] };
  clearSelection();
  addLogPublic(`開始投票。`, `【上帝】投票開始`);
  saveState();
  renderAll();
}
function advanceVote(){
  const vm = S.voteMode;
  const sel = [...S.selected];

  if(vm.step==="pickCandidate"){
    const c = sel[0];
    if(!c) return;
    vm.candidate = c;
    vm.step="pickVoters";
    clearSelection();
    saveState();
    renderAll();
    return;
  }

  const voters = sel.slice().sort((a,b)=>a-b);
  S.votes.push({ day:S.day-1, to:vm.candidate, from:voters });

  addLogPublic(`投票：${voters.length? voters.join("、")+" 投給 ":"（無）投給 "}${vm.candidate}號`);
  vm.step="pickCandidate";
  vm.candidate=null;
  clearSelection();
  saveState();
  renderAll();
}
function settleVote(){
  const map = new Map();
  S.votes.forEach(v=>{
    if(!map.has(v.to)) map.set(v.to, []);
    map.get(v.to).push(...v.from);
  });

  const alive = [];
  for(let i=1;i<=S.n;i++) if(seatAlive(i)) alive.push(i);

  const votedFrom = new Set();
  S.votes.forEach(v=>v.from.forEach(x=>votedFrom.add(x)));
  const abstain = alive.filter(x=>!votedFrom.has(x));

  const lines = [];
  const entries = [...map.entries()].sort((a,b)=>b[1].length-a[1].length);

  entries.forEach(([to, from])=>{
    const uniqueFrom = [...new Set(from)].sort((a,b)=>a-b);
    lines.push(`投給${to}號的有${uniqueFrom.length? " "+uniqueFrom.join("、") : "（無）"}`);
    lines.push(`→ ${to}號共 ${uniqueFrom.length} 票`);
    lines.push("");
  });

  lines.push(`棄票的有${abstain.length? " "+abstain.join("、") : "（無）"}`);

  let exile=null;
  if(entries.length){
    exile = entries[0][0];
    lines.push("");
    lines.push(`${exile}號得到最高票遭到放逐`);
  }else{
    lines.push("");
    lines.push(`沒有有效投票，無人放逐`);
  }

  addLogPublic(`投票結算完成。`);
  addLogPublic(lines.join("\n"));

  if(exile){
    S.seats[exile].dead=true;
    S.seats[exile].deadReason="🗳 放逐";
  }

  S.stage="night";
  S.night += 1;
  S._nightIdx=0;
  S.votes=[];
  S.voteMode={ step:"pickCandidate", candidate:null, voters:[] };
  clearSelection();

  saveState();
  renderAll();
}

/* ---------- Render ---------- */
function renderTop(){
  let st="—";
  if(S.stage==="setup") st="開局設定";
  if(S.stage==="deal")  st=`抽身分（${countSeen()}/${S.n||0}）`;
  if(S.stage==="night") st=`第 ${S.night} 夜`;
  if(S.stage==="day")   st=`第 ${S.day} 天`;
  if(S.stage==="vote")  st=`投票（第 ${S.day-1} 天）`;
  uiStatus.textContent = st;

  const b = BOARDS.find(x=>x.id===S.boardId);
  uiBoard.textContent = S.stage==="setup"
    ? (S.n ? `人數：${S.n}` : "請選人數")
    : (b ? b.name : "—");

  segEdge.classList.toggle("primary", S.winMode==="edge");
  segCity.classList.toggle("primary", S.winMode==="city");
  togglePolice.checked = !!S.hasPolice;
}

function renderPrompt(){
  if(S.stage==="setup"){
    promptTitle.textContent="請先設定人數與板子";
    promptText.textContent =
`1) 先選人數（9 / 10 / 12）
2) 再選板子（格子按鈕會變色）
3) 按底部「下一步」進入抽身分

✅ 選完後：開局設定會自動收起，不再佔畫面。`;
    promptFoot.textContent="抽身分：玩家長按 0.3 秒查看。";
    return;
  }

  if(S.stage==="deal"){
    promptTitle.textContent="抽身分";
    promptText.textContent =
`上帝點選座位 → 玩家長按 0.3 秒看身分 → 按「我看完了」
全部看完後按「下一步」進入夜晚流程。`;
    promptFoot.textContent="（再點一次同號碼可取消選取）";
    return;
  }

  if(S.stage==="night"){
    const step = getNightStep();
    promptTitle.textContent = `🌙 夜晚流程（第 ${S.night} 夜）`;
    promptText.textContent = step.text;
    promptFoot.textContent = step.foot || "";
    return;
  }

  if(S.stage==="day"){
    promptTitle.textContent = `☀️ 白天流程（第 ${S.day-1} 天結束後）`;
    promptText.textContent =
`📣 公告可回顧每一天公開資訊
按中間鍵「開始投票」進入投票流程`;
    promptFoot.textContent = "你也可以先討論發言，再按開始投票。";
    return;
  }

  if(S.stage==="vote"){
    const vm=S.voteMode;
    if(vm.step==="pickCandidate"){
      promptTitle.textContent="🗳️ 投票：選擇被投票者";
      promptText.textContent = `點選候選（被投票者） → 按「下一步」`;
      promptFoot.textContent = "再點一次可取消。";
    }else{
      promptTitle.textContent = `🗳️ 投票：選擇投票者 → 投給 ${vm.candidate} 號`;
      promptText.textContent = `可多選投票者 → 按「下一步」儲存此票型`;
      promptFoot.textContent = "可多選；再點可取消。";
    }
  }
}

function buildSeatMeta(i){
  const seat = S.seats[i];
  if(S.stage==="deal" && !S.godView){
    return seat.seen ? "✅已看" : "長按看身分";
  }
  if(!S.godView){
    return seat.dead ? "已死亡" : "";
  }

  const lines=[];
  if(seat.role) lines.push(`${seat.role}・${seat.camp}`);
  if(seat.dead && seat.deadReason) lines.push(`☠️ ${seat.deadReason}`);
  if(seat.marks?.length){
    seat.marks.slice(-2).forEach(m=>lines.push(m));
  }
  return lines.join("<br/>");
}

function renderSeats(){
  if(S.stage==="setup"){
    seatsGrid.innerHTML="";
    $("seatsHeader").style.display="none";
    return;
  }
  $("seatsHeader").style.display="";

  seatsGrid.innerHTML="";
  const n=S.n || (S.seats.length-1);

  for(let i=1;i<=n;i++){
    const seat=S.seats[i];
    const div=document.createElement("div");
    div.className="seat";
    if(S.selected.has(i)) div.classList.add("selected");
    if(seat.dead) div.classList.add("dead");
    if(S.godView){
      if(seat.camp===CAMP.WOLF) div.classList.add("wolfGod");
      else div.classList.add("goodGod");
    }

    const badges=[];
    if(S.godView){
      if(i===S.witchSeat){
        if(!S.witchHealUsed) badges.push(`<span class="badge left">💊</span>`);
        if(!S.witchPoisonUsed) badges.push(`<span class="badge">🧪</span>`);
      }
      const last = seat.marks?.[seat.marks.length-1] || "";
      if(last.includes("🛡")) badges.push(`<span class="badge">🛡</span>`);
      if(last.includes("💊")) badges.push(`<span class="badge">💊</span>`);
      if(last.includes("🧪")) badges.push(`<span class="badge">🧪</span>`);
      if(last.includes("🐺")) badges.push(`<span class="badge">🐺</span>`);
      if(last.includes("🔫")) badges.push(`<span class="badge">🔫</span>`);
    }

    div.innerHTML = `
      ${badges.join("")}
      <div class="seatNum">${i}</div>
      <div class="seatMeta">${buildSeatMeta(i)}</div>
    `;

    div.addEventListener("click", ()=>{
      toggleSelectSeat(i);
      saveState();
      renderSeats();
    });

    attachLongPress(div, 300, ()=>{
      if(S.stage!=="deal") return;
      openRoleModal(i);
    });

    seatsGrid.appendChild(div);
  }
}

function renderBottomButtons(){
  if(S.stage==="setup"){ btnMain.textContent="—"; btnMain.disabled=true; return; }
  btnMain.disabled=false;

  if(S.stage==="deal"){ btnMain.textContent="開始夜晚"; return; }
  if(S.stage==="night"){ btnMain.textContent="天亮睜眼"; return; }
  if(S.stage==="day"){ btnMain.textContent="開始投票"; return; }
  if(S.stage==="vote"){ btnMain.textContent="結算投票"; return; }
}

function renderAll(){
  renderTop();
  setupCard.style.display = (S.stage==="setup") ? "" : "none";
  if(S.stage==="setup") renderBoards();
  renderPrompt();
  renderBottomButtons();
  renderSeats();

  if(!annDrawer.classList.contains("hidden")){
    annText.textContent = buildAnnText();
  }
}

/* ---------- Actions ---------- */
function onNext(){
  if(S.stage==="setup"){
    if(!S.n || !S.boardId) return;
    prepareDeal();
    return;
  }

  if(S.stage==="deal"){
    if(countSeen() < S.n){
      addLogPublic(`尚有玩家未看身分。`, `【上帝】已看：${countSeen()}/${S.n}`);
      saveState(); renderAll();
      return;
    }
    S.stage="night";
    S.night=1;
    S._nightIdx=0;
    clearSelection();
    addLogPublic(`進入夜晚。`, `【上帝】第 1 夜開始`);
    saveState(); renderAll();
    return;
  }

  if(S.stage==="night"){
    advanceNightStep();
    saveState(); renderAll();
    return;
  }

  if(S.stage==="vote"){
    advanceVote();
    return;
  }
}

function onBack(){
  if(S.stage==="vote" && S.voteMode.step==="pickVoters"){
    S.voteMode.step="pickCandidate";
    S.voteMode.candidate=null;
    clearSelection();
    saveState(); renderAll();
    return;
  }
  if(S.stage==="night"){
    if((S._nightIdx||0)>0){
      S._nightIdx=Math.max(0,(S._nightIdx||0)-1);
      clearSelection();
      saveState(); renderAll();
    }
  }
}

function onMain(){
  if(S.stage==="deal"){
    if(countSeen() < S.n){
      addLogPublic(`尚有玩家未看身分，無法開始夜晚。`, `【上帝】已看：${countSeen()}/${S.n}`);
      saveState(); renderAll();
      return;
    }
    S.stage="night";
    S.night=1;
    S._nightIdx=0;
    clearSelection();
    addLogPublic(`進入夜晚。`, `【上帝】第 1 夜開始`);
    saveState(); renderAll();
    return;
  }

  if(S.stage==="day"){
    startVote(); return;
  }

  if(S.stage==="vote"){
    settleVote(); return;
  }

  if(S.stage==="night"){
    addLogPublic(`請用「下一步」依序走夜晚流程。`);
    saveState(); renderAll();
  }
}

/* ---------- Dice ---------- */
function rollDice(){
  const alive=[];
  for(let i=1;i<=S.n;i++) if(seatAlive(i)) alive.push(i);
  if(!alive.length){ diceResult.textContent="—"; return; }
  const pick = alive[Math.floor(Math.random()*alive.length)];
  diceResult.textContent = `${pick}`;
}

/* ---------- God view ---------- */
function toggleGodView(){
  S.godView = !S.godView;
  addLogPublic(`上帝視角：${S.godView?"開":"關"}`, `【上帝】godView=${S.godView}`);
  saveState();
  renderAll();
}

/* ---------- Timer ---------- */
let timer = { sec:90, running:false, t:null };

function loadTimer(){
  try{
    const raw = localStorage.getItem("wg_timer_v1");
    if(raw){
      const o = JSON.parse(raw);
      timer.sec = o.sec ?? 90;
      timer.running = o.running ?? false;
    }
  }catch(e){}
  updateTimerUI();
  if(timer.running) startTimerTick();
}
function saveTimer(){
  localStorage.setItem("wg_timer_v1", JSON.stringify({sec:timer.sec, running:timer.running}));
}
function updateTimerUI(){ timerBigEl.textContent = formatTime(timer.sec); }
function startTimerTick(){
  if(timer.t) clearInterval(timer.t);
  timer.t = setInterval(()=>{
    if(!timer.running) return;
    timer.sec -= 1;
    if(timer.sec<=0){
      timer.sec=0;
      timer.running=false;
      if(navigator.vibrate) navigator.vibrate([200,120,200]);
      addLogPublic(`⏱ 計時結束。`);
      saveTimer();
    }
    updateTimerUI();
    saveTimer();
  }, 1000);
}
function setTimer(sec){
  timer.sec=sec;
  timer.running=false;
  updateTimerUI();
  saveTimer();
}
btnTimerStart.onclick = ()=>{ timer.running=true; saveTimer(); startTimerTick(); };
btnTimerPause.onclick = ()=>{ timer.running=false; saveTimer(); };
btnTimerReset.onclick = ()=>{ setTimer(90); };

timerPresets.addEventListener("click",(e)=>{
  const btn=e.target.closest(".chip");
  if(!btn) return;
  const sec=Number(btn.dataset.sec||"0");
  if(sec>0) setTimer(sec);
});

/* ---------- Drawer/Modal binding ---------- */
btnTimer.onclick = ()=> openDrawer(timerBackdrop, timerDrawer);
btnCloseTimer.onclick = ()=> closeDrawer(timerBackdrop, timerDrawer);
timerBackdrop.onclick = ()=> closeDrawer(timerBackdrop, timerDrawer);

btnAnn.onclick = ()=>{
  annText.textContent = buildAnnText();
  openDrawer(annBackdrop, annDrawer);
};
btnCloseAnn.onclick = ()=> closeDrawer(annBackdrop, annDrawer);
annBackdrop.onclick = ()=> closeDrawer(annBackdrop, annDrawer);
toggleAnnGod.onchange = ()=>{ annText.textContent = buildAnnText(); };

btnSettings.onclick = ()=> openDrawer(setBackdrop, setDrawer);
btnCloseSet.onclick = ()=> closeDrawer(setBackdrop, setDrawer);
setBackdrop.onclick = ()=> closeDrawer(setBackdrop, setDrawer);

segEdge.onclick = ()=>{ S.winMode="edge"; saveState(); renderTop(); };
segCity.onclick = ()=>{ S.winMode="city"; saveState(); renderTop(); };
togglePolice.onchange = ()=>{ S.hasPolice=togglePolice.checked; saveState(); };

btnGotoSetup.onclick = ()=>{
  const keepWin=S.winMode, keepPolice=S.hasPolice;
  S = defaultState();
  S.winMode=keepWin;
  S.hasPolice=keepPolice;
  saveState();
  renderAll();
  closeDrawer(setBackdrop, setDrawer);
};
btnHardReset.onclick = ()=>{ resetHard(); closeDrawer(setBackdrop, setDrawer); };

btnEye.onclick = toggleGodView;

btnDice.onclick = ()=>{ rollDice(); openModal(diceModal); };
btnDiceAgain.onclick = rollDice;
btnDiceClose.onclick = ()=> closeModal(diceModal);

/* ---------- Setup 人數 chip ---------- */
document.querySelectorAll(".setupCard .chip[data-n]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const n = Number(btn.dataset.n);
    S.n=n;
    S.boardId=null;
    saveState();

    document.querySelectorAll(".setupCard .chip[data-n]").forEach(x=>{
      x.classList.toggle("active", x.dataset.n===String(n));
    });

    renderBoards();
    renderTop();
    renderPrompt();
  });
});

/* ---------- Buttons ---------- */
btnNext.onclick = onNext;
btnBack.onclick = onBack;
btnMain.onclick = onMain;

/* ---------- Boot ---------- */
(function boot(){
  if(S.stage==="setup" && S.n){
    document.querySelectorAll(".setupCard .chip[data-n]").forEach(x=>{
      x.classList.toggle("active", x.dataset.n===String(S.n));
    });
  }
  renderAll();
  loadTimer();
})();