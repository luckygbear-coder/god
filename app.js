/* =========================
  Werewolf God Helper (single-file)
  - Setup (N + board)
  - Deal (press seat to select; long-press 0.3s to reveal)
  - Auto cover after reveal
  - God view 👁 toggles showing role/camp + events
  - Thief: choose immediately after thief reveals (from 2 leftover roles)
  - Night/day step hints + require selection on action steps
  - Timer drawer, Ann drawer, Dice, Settings
========================= */

const $ = (id) => document.getElementById(id);
const qsa = (sel, el=document) => Array.from(el.querySelectorAll(sel));

/* ====== iOS anti-zoom / anti-select hardening ====== */
(function iosFix(){
  // prevent double-tap zoom
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 320) e.preventDefault();
    lastTouchEnd = now;
  }, { passive:false });

  // prevent dblclick zoom
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive:false });

  // prevent long-press selection menu
  document.addEventListener('contextmenu', (e) => e.preventDefault());
})();

/* ====== UI refs ====== */
const uiStatus = $("uiStatus");
const uiBoard  = $("uiBoard");

const btnAnn = $("btnAnn");
const btnTimer = $("btnTimer");
const btnEye = $("btnEye");
const btnDice = $("btnDice");
const btnSettings = $("btnSettings");

const promptTitle = $("promptTitle");
const promptText  = $("promptText");
const promptFoot  = $("promptFoot");

const setupCard = $("setupCard");
const boardHint = $("boardHint");
const boardList = $("boardList");

const seatsGrid = $("seatsGrid");
const btnBack = $("btnBack");
const btnMain = $("btnMain");
const btnNext = $("btnNext");

const timerBackdrop = $("timerBackdrop");
const timerDrawer = $("timerDrawer");
const btnCloseTimer = $("btnCloseTimer");
const timerBig = $("timerBig");
const btnTimerStart = $("btnTimerStart");
const btnTimerPause = $("btnTimerPause");
const btnTimerReset = $("btnTimerReset");

const annBackdrop = $("annBackdrop");
const annDrawer = $("annDrawer");
const btnCloseAnn = $("btnCloseAnn");
const annText = $("annText");
const toggleAnnGod = $("toggleAnnGod");

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
const roleModalRole  = $("roleModalRole");
const roleModalCamp  = $("roleModalCamp");
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

/* ====== Boards ====== */
/**
 * roles_total: total cards = players + (thief ? 2 : 0)
 * For thief-board: include "盜賊" in the deck, plus 2 extra cards (leftover)
 */
const BOARD_DEFS = [
  // 12
  { id:"official-12", n:12, title:"12 人官方標準局", tags:["官方","穩","含白癡"], winMode:"edge", police:true,
    roles_total: ["狼人","狼人","狼人","狼人","預言家","女巫","獵人","守衛","白癡","平民","平民","平民"]
  },
  { id:"12-city", n:12, title:"12 人（標準角色・屠城）", tags:["測試","屠城"], winMode:"city", police:true,
    roles_total: ["狼人","狼人","狼人","狼人","預言家","女巫","獵人","守衛","白癡","平民","平民","平民"]
  },
  { id:"12-edge-nopolice", n:12, title:"12 人（屠邊・無上警）", tags:["測試","無上警"], winMode:"edge", police:false,
    roles_total: ["狼人","狼人","狼人","狼人","預言家","女巫","獵人","守衛","白癡","平民","平民","平民"]
  },

  // 12 thief sample (你截圖用的 12-thief)
  { id:"12-thief", n:12, title:"12 人含盜賊（+2 底牌）", tags:["盜賊","變體"], winMode:"edge", police:true,
    roles_total: ["狼人","狼人","狼人","狼人","預言家","女巫","獵人","守衛","白癡","平民","平民","盜賊",
                 /* +2 extra */ "平民","狼人"]
  },

  // 10
  { id:"official-10", n:10, title:"10 人官方標準局", tags:["官方","快"], winMode:"edge", police:true,
    roles_total: ["狼人","狼人","狼人","預言家","女巫","獵人","守衛","平民","平民","平民"]
  },

  // 9
  { id:"official-9", n:9, title:"9 人官方局", tags:["官方","精簡"], winMode:"edge", police:true,
    roles_total: ["狼人","狼人","預言家","女巫","獵人","守衛","平民","平民","平民"]
  },
];

const ROLE_CAMP = (role) => {
  if (role.includes("狼")) return "狼人";
  if (role==="狼人") return "狼人";
  return "好人";
};

const ROLE_ICON = (role) => {
  if (role==="女巫") return "🧪";
  if (role==="預言家") return "🔮";
  if (role==="獵人") return "🔫";
  if (role==="守衛") return "🛡️";
  if (role==="白癡") return "🤪";
  if (role==="邱比特") return "💘";
  if (role==="盜賊") return "🃏";
  if (role==="狼人") return "🐺";
  if (role==="平民") return "🙂";
  return "🎭";
};

/* ====== State ====== */
const LS_KEY = "ww_god_v3";

const defaultState = () => ({
  stage: "SETUP",          // SETUP | DEAL | THIEF_CHOOSE | NIGHT | DAY | VOTE
  step: 0,                 // flow step index in stage
  day: 1,                  // day counter (day starts after night results)
  night: 1,                // night counter
  selectedN: 12,
  boardId: null,

  winMode: "edge",
  hasPolice: true,

  godView: false,          // 👁 show role/camp/events on seat cells
  seats: [],               // {i, alive, role, camp, viewed, events:[]}
  deckLeft: [],            // leftover cards (for thief)
  thief: { seatIndex: null, done: true, options: [] },

  // Night action buffer
  nightActions: { guard:null, wolf:null, seer:null, witchSave:null, witchPoison:null },
  witch: { saveUsed:false, poisonUsed:false },

  // Announce logs (public + god)
  logs: [],                // {title, publicLines:[], godLines:[]}

  // timer
  timer: { sec: 90, left: 90, running: false, ts: 0 },

  // selection
  selectedSeat: null,      // seat index (0-based)
});

let S = loadState();

/* ====== Persistence ====== */
function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return defaultState();
    const s = JSON.parse(raw);
    return { ...defaultState(), ...s };
  }catch(e){
    return defaultState();
  }
}
function saveState(){
  localStorage.setItem(LS_KEY, JSON.stringify(S));
}

/* ====== Helpers ====== */
function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
function fmtTime(sec){
  const m = Math.floor(sec/60);
  const s = sec%60;
  return String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
}
function seatNo(idx){ return idx+1; }
function ensureSeatIndexAlive(idx){
  return idx!=null && S.seats[idx] && S.seats[idx].alive;
}

/* ====== UI open/close ====== */
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

/* ====== Render ====== */
function renderTop(){
  // ✅ 合併：只顯示一行狀態（避免佔空間）
  const stageLabel =
    S.stage==="SETUP" ? "SETUP"
    : S.stage==="DEAL" ? "抽身分"
    : S.stage==="THIEF_CHOOSE" ? "盜賊二選一"
    : S.stage==="NIGHT" ? `🌙 夜晚 ${S.night}`
    : S.stage==="DAY" ? `☀️ 白天 ${S.day}`
    : S.stage==="VOTE" ? `🗳️ 投票`
    : "—";

  uiStatus.textContent = `${stageLabel} / step ${S.step+1}`;
  uiBoard.textContent  = S.boardId ? S.boardId : "請先選人數與板子";
}

function renderPrompt(){
  if (S.stage==="SETUP"){
    promptTitle.textContent = "開局";
    promptText.textContent =
`1) 先選人數
2) 再選板子（點一下會變色）
3) 按底部「下一步」進入抽身分`;
    promptFoot.textContent = "（選完後，開局卡片會消失，避免佔畫面）";
    return;
  }

  if (S.stage==="DEAL"){
    promptTitle.textContent = `抽身分（${countViewed()}/${S.selectedN}）`;
    let extra = "";
    if (S.thief && S.thief.seatIndex!=null && !S.thief.done){
      extra = "\n⚠️ 盜賊尚未完成選角（盜賊看完身分會立刻二選一）";
    }
    promptText.textContent =
`上帝點選座位 → 玩家長按 0.3 秒看身分 → 按「我看完了」
看完會自動蓋牌（不會露出角色）
全部看完後按「開始夜晚」進入夜晚流程
（再點一次同號可取消選取）${extra}`;
    promptFoot.textContent = S.godView ? "👁 上帝視角：目前開啟" : "👁 上帝視角：目前關閉";
    return;
  }

  if (S.stage==="NIGHT"){
    const nightFlow = getNightFlowText();
    promptTitle.textContent = `夜晚 ${S.night}`;
    promptText.textContent = nightFlow;
    promptFoot.textContent = "按「下一步」依序提示，需點座位選取目標；再按一次同號可取消。";
    return;
  }

  if (S.stage==="DAY"){
    promptTitle.textContent = `白天 ${S.day}`;
    promptText.textContent =
`天亮了，請宣佈昨夜結果（看 📣 公告可回顧）
白天流程：自由發言 →（可上警）→ 推理/辯論 → 投票
按中間鍵「開始投票」進入投票統計`;
    promptFoot.textContent = "📣 公告：會自動累積每天資訊，可切換上帝詳細。";
    return;
  }

  if (S.stage==="VOTE"){
    promptTitle.textContent = `投票`;
    promptText.textContent =
`操作方式：
1) 點「投票者」座位（要投票的人）
2) 再點「被投」座位（或點同一位=棄票）
系統會在 📣 公告產生「票型分組」結果。`;
    promptFoot.textContent = "完成後按中間鍵「結算放逐」";
    return;
  }
}

function renderSetup(){
  if (S.stage==="SETUP"){
    setupCard.classList.remove("hidden");
    renderSetupChips();
    renderBoardList();
  }else{
    setupCard.classList.add("hidden");
  }
}

function renderSetupChips(){
  qsa(".chip[data-n]", setupCard).forEach(btn=>{
    const n = Number(btn.dataset.n);
    btn.classList.toggle("active", n===S.selectedN);
  });
}

function renderBoardList(){
  boardList.innerHTML = "";
  const list = BOARD_DEFS.filter(b=>b.n===S.selectedN);
  if(!list.length){
    boardHint.textContent = "（沒有板子）";
    return;
  }
  boardHint.textContent = "請選擇板子（點一下會變色）";

  list.forEach(b=>{
    const div = document.createElement("div");
    div.className = "boardItem" + (S.boardId===b.id ? " active" : "");
    div.innerHTML = `
      <div class="bTitle">${b.title}</div>
      <div class="bSub">${b.id} ・ ${summarizeRoles(b.roles_total, b.n)}</div>
      <div class="tags">${b.tags.map(t=>`<span class="tag">${t}</span>`).join("")}</div>
    `;
    div.addEventListener("click", ()=>{
      S.boardId = b.id;
      S.winMode = b.winMode;
      S.hasPolice = b.police;
      saveState();
      renderAll();
    });
    boardList.appendChild(div);
  });
}

function summarizeRoles(roles_total, n){
  // show first n roles summary (ignore +2)
  const roles = roles_total.slice(0, n);
  const map = {};
  roles.forEach(r=> map[r]=(map[r]||0)+1 );
  const parts = Object.keys(map).map(k=>`${map[k]}${k==="平民"?"民":k==="狼人"?"狼":k}`);
  return parts.join(" + ");
}

function renderSeats(){
  seatsGrid.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "grid";

  // when setup, hide seats (你要求：選人數/板子時不要出現號碼)
  if (S.stage==="SETUP"){
    seatsGrid.appendChild(wrap);
    return;
  }

  for(let i=0;i<S.selectedN;i++){
    const seat = S.seats[i] || { alive:true, role:null, camp:null, viewed:false, events:[] };
    const div = document.createElement("div");
    div.className = "seat" + (S.selectedSeat===i ? " selected" : "") + (!seat.alive ? " dead":"");
    // god view border
    if (S.godView) div.classList.add("godOn");

    // color cues if god view
    if (S.godView){
      div.classList.add(seat.camp==="狼人" ? "wolf" : "good");
    }

    const line1 = `<div class="num">${seatNo(i)}</div>`;

    let sub = "";
    if (S.stage==="DEAL"){
      // ✅ 蓋牌：一般顯示「長按看身分」或「已看」
      sub = seat.viewed ? "已看（蓋牌）" : "長按看身分";
      // ✅ 上帝視角開啟時才顯示角色/陣營
      if (S.godView && seat.role){
        sub = `${seat.role}・${seat.camp}`;
      }
    }else{
      // in game
      if (S.godView && seat.role){
        const ev = formatSeatEvents(seat);
        sub = `${seat.role}・${seat.camp}${ev ? "\n"+ev : ""}`;
      }else{
        sub = seat.alive ? "存活" : "死亡";
      }
    }

    div.innerHTML = `
      ${line1}
      <div class="sub">${sub.replace(/\n/g,"<br>")}</div>
    `;

    // tap select/cancel
    div.addEventListener("click", ()=>{
      if (S.selectedSeat===i) S.selectedSeat = null;
      else S.selectedSeat = i;
      saveState();
      renderSeats();
    });

    // long-press reveal during DEAL
    if (S.stage==="DEAL"){
      attachLongPress(div, 300, ()=>{
        revealRole(i);
      });
    }

    wrap.appendChild(div);
  }

  seatsGrid.appendChild(wrap);
}

function formatSeatEvents(seat){
  if(!seat.events || !seat.events.length) return "";
  // show last 2 events
  const last = seat.events.slice(-2);
  return last.join("、");
}

function renderBottom(){
  // middle button label depends on stage
  if (S.stage==="DEAL"){
    btnMain.textContent = "開始夜晚";
    btnMain.disabled = !(countViewed()===S.selectedN && (!S.thief || S.thief.done));
  }else if (S.stage==="NIGHT"){
    btnMain.textContent = "天亮睜眼";
    btnMain.disabled = false;
  }else if (S.stage==="DAY"){
    btnMain.textContent = "開始投票";
    btnMain.disabled = false;
  }else if (S.stage==="VOTE"){
    btnMain.textContent = "結算放逐";
    btnMain.disabled = false;
  }else{
    btnMain.textContent = "—";
    btnMain.disabled = true;
  }
}

/* ====== Long press helper ====== */
function attachLongPress(el, ms, fn){
  let t = null;
  const start = (e)=>{
    // avoid selecting text
    e.preventDefault();
    if (t) clearTimeout(t);
    t = setTimeout(()=>{ t=null; fn(); }, ms);
  };
  const cancel = ()=>{
    if (t) clearTimeout(t);
    t = null;
  };
  el.addEventListener("touchstart", start, {passive:false});
  el.addEventListener("touchend", cancel);
  el.addEventListener("touchmove", cancel);
  el.addEventListener("mousedown", start);
  el.addEventListener("mouseup", cancel);
  el.addEventListener("mouseleave", cancel);
}

/* ====== Deal / reveal / cover ====== */
function startDeal(){
  const board = BOARD_DEFS.find(b=>b.id===S.boardId);
  if(!board) return;

  const deck = shuffle(board.roles_total.slice()); // includes +2 for thief board
  const rolesForSeats = deck.slice(0, board.n);
  const leftover = deck.slice(board.n);

  S.seats = [];
  for(let i=0;i<board.n;i++){
    const role = rolesForSeats[i];
    S.seats.push({
      i,
      alive:true,
      role,
      camp: ROLE_CAMP(role),
      viewed:false,
      events:[]
    });
  }

  // thief info
  const thiefIndex = S.seats.findIndex(s=>s.role==="盜賊");
  S.deckLeft = leftover.slice();
  S.thief = {
    seatIndex: thiefIndex>=0 ? thiefIndex : null,
    done: thiefIndex>=0 ? false : true,
    options: [] // set when thief reveals
  };

  S.witch = { saveUsed:false, poisonUsed:false };
  S.nightActions = { guard:null, wolf:null, seer:null, witchSave:null, witchPoison:null };
  S.logs = [];
  S.stage = "DEAL";
  S.step = 0;
  S.day = 1;
  S.night = 1;
  S.selectedSeat = null;

  pushLog("開局完成", [
    `人數：${S.selectedN}`,
    `板子：${S.boardId}`,
    `勝負：${S.winMode==="city"?"屠城":"屠邊"}`,
    `上警：${S.hasPolice?"開":"關"}`
  ], [
    `牌堆剩餘：${S.deckLeft.join("、") || "(無)"}`
  ]);

  saveState();
  renderAll();
}

function revealRole(seatIdx){
  const seat = S.seats[seatIdx];
  if(!seat) return;

  roleModalTitle.textContent = `${seatNo(seatIdx)}號 身分`;
  roleModalRole.textContent = `${ROLE_ICON(seat.role)} ${seat.role}`;
  roleModalCamp.textContent = `陣營：${seat.camp}`;
  openModal(roleModal);

  // when close / done
  btnRoleClose.onclick = ()=> closeModal(roleModal);
  btnRoleDone.onclick = ()=>{
    closeModal(roleModal);
    seat.viewed = true;

    // ✅ 看完立刻蓋牌（座位格不顯示角色，除非 👁）
    // (renderSeats already follows this rule)

    // ✅ 盜賊：在抽身分階段就要二選一
    if (seat.role==="盜賊" && S.thief && S.thief.seatIndex===seatIdx && !S.thief.done){
      openThiefChoose();
    }

    saveState();
    renderAll();
  };
}

function countViewed(){
  return (S.seats||[]).filter(s=>s.viewed).length;
}

/* ====== Thief ====== */
function openThiefChoose(){
  if(!S.thief || S.thief.seatIndex==null) return;
  const left = S.deckLeft.slice();
  if(left.length<2){
    // fallback: random from standard pool (should not happen)
    S.thief.options = ["平民","平民"];
  }else{
    S.thief.options = left.slice(0,2); // ✅ 盜賊只能從未被抽到的兩張選
  }

  const optA = S.thief.options[0];
  const optB = S.thief.options[1];
  const campA = ROLE_CAMP(optA);
  const campB = ROLE_CAMP(optB);

  // rule: if one wolf one good => must pick wolf
  const mustWolf = (campA!==campB) && (campA==="狼人" || campB==="狼人");

  thiefHint.textContent =
    mustWolf
      ? "兩張牌包含狼人牌：依規則只能選擇狼人陣營。"
      : "請二選一，選完立刻成為該角色（另一張棄置）。";

  btnThiefA.textContent = `${ROLE_ICON(optA)} ${optA}`;
  btnThiefB.textContent = `${ROLE_ICON(optB)} ${optB}`;

  btnThiefA.disabled = mustWolf && campA!=="狼人";
  btnThiefB.disabled = mustWolf && campB!=="狼人";

  const choose = (picked)=>{
    const seat = S.seats[S.thief.seatIndex];
    seat.role = picked;
    seat.camp = ROLE_CAMP(picked);
    seat.events.push(`盜賊→${picked}`);

    // ✅ 移除兩張底牌（避免再出現在任何人身上）
    const a = S.thief.options[0];
    const b = S.thief.options[1];
    let left2 = S.deckLeft.slice();
    // remove one occurrence each
    const ia = left2.indexOf(a); if(ia>=0) left2.splice(ia,1);
    const ib = left2.indexOf(b); if(ib>=0) left2.splice(ib,1);
    S.deckLeft = left2;

    S.thief.done = true;

    pushLog("盜賊完成選角", [
      "（公開）盜賊已完成選角"
    ], [
      `盜賊座位：${seatNo(S.thief.seatIndex)}號`,
      `盜賊選擇：${picked}`,
      `棄置：${picked===a ? b : a}`
    ]);

    closeModal(thiefModal);
    saveState();
    renderAll();
  };

  btnThiefA.onclick = ()=> choose(optA);
  btnThiefB.onclick = ()=> choose(optB);
  btnThiefClose.onclick = ()=> closeModal(thiefModal);

  openModal(thiefModal);
}

/* ====== Flow engine (Night/Day/Vote) ====== */
function getNightOrder(){
  // if board includes thief, still read standard roles (你需求：盜賊會讓大家不知道誰是什麼，仍要照板子唸)
  // Here we always include standard: guard, wolf, seer, witch (when exist in total-role list)
  const rolesPresent = new Set(S.seats.map(s=>s.role));
  const board = BOARD_DEFS.find(b=>b.id===S.boardId);
  const declaredSet = new Set((board?.roles_total||[])); // includes discarded possibilities on thief board
  const has = (r)=> declaredSet.has(r);

  const steps = [];
  if (has("守衛")) steps.push({key:"guard", title:"守衛請睜眼（選擇守護）", needPick:true});
  steps.push({key:"wolf", title:"狼人請睜眼（選擇刀人）", needPick:true});
  if (has("預言家")) steps.push({key:"seer", title:"預言家請睜眼（查驗一人）", needPick:true});
  if (has("女巫")) steps.push({key:"witch", title:"女巫請睜眼（解藥 / 毒藥）", needPick:true});
  return steps;
}

function getNightFlowText(){
  const steps = getNightOrder();
  const lines = [];
  lines.push("夜晚開始：");
  steps.forEach((s,idx)=> lines.push(`${idx+1}. ${s.title}`));
  lines.push("");
  const cur = steps[S.step] || null;
  if(cur){
    lines.push(`👉 目前：${S.step+1}. ${cur.title}`);
    if(cur.key==="witch"){
      const w = S.witch;
      const save = w.saveUsed ? "解藥已用" : "解藥可用💊";
      const poison = w.poisonUsed ? "毒藥已用" : "毒藥可用🧪";
      lines.push(`（女巫狀態：${save} / ${poison}）`);
      lines.push("操作：先點座位（刀口=救；或點其他=毒；再按「下一步」確認。再點同號取消。");
    }else{
      lines.push("（點座位選取；再點同號取消；按「下一步」確認）");
    }
  }else{
    lines.push("✅ 夜晚流程已完成。按「天亮睜眼」進入白天。");
  }
  return lines.join("\n");
}

function confirmNightStep(){
  const steps = getNightOrder();
  const cur = steps[S.step];
  if(!cur) return;

  if(cur.needPick && S.selectedSeat==null){
    toast("請先點一個座位");
    return;
  }

  const pick = S.selectedSeat;
  const pickNo = pick==null ? "—" : `${seatNo(pick)}號`;

  if(cur.key==="guard"){
    S.nightActions.guard = pick;
    pushLog(`夜晚${S.night}：守衛`, [`守衛已選擇守護（上帝知道）`], [`守護：${pickNo}`]);
    markSeatEvent(pick, "🛡️盾");
  }

  if(cur.key==="wolf"){
    S.nightActions.wolf = pick;
    pushLog(`夜晚${S.night}：狼人`, [`狼人已行動（上帝知道）`], [`刀口：${pickNo}`]);
    markSeatEvent(pick, "🐺狼刀");
  }

  if(cur.key==="seer"){
    S.nightActions.seer = pick;
    const camp = S.seats[pick]?.camp || "—";
    pushLog(`夜晚${S.night}：預言家`, [`預言家已查驗（上帝口述）`], [`查驗：${pickNo} → ${camp}`]);
    markSeatEvent(pick, "🔮查驗");
  }

  if(cur.key==="witch"){
    const wolf = S.nightActions.wolf;
    // If click wolf target => save, else poison
    let godLines = [];
    let pubLines = [`女巫已行動（上帝知道）`];
    if (pick===wolf && !S.witch.saveUsed){
      S.nightActions.witchSave = wolf;
      S.witch.saveUsed = true;
      godLines.push(`解藥：救 ${pickNo}`);
      markSeatEvent(pick, "💊被救");
    }else if (pick!=null && pick!==wolf && !S.witch.poisonUsed){
      S.nightActions.witchPoison = pick;
      S.witch.poisonUsed = true;
      godLines.push(`毒藥：毒 ${pickNo}`);
      markSeatEvent(pick, "🧪中毒");
    }else{
      godLines.push("女巫：本輪無有效用藥（可能已用完/或點選不符合）");
    }
    pushLog(`夜晚${S.night}：女巫`, pubLines, godLines);
  }

  // advance
  S.selectedSeat = null;
  S.step += 1;
  saveState();
  renderAll();
}

function markSeatEvent(idx, text){
  if(idx==null) return;
  const seat = S.seats[idx];
  if(!seat) return;
  if(!seat.events) seat.events = [];
  // avoid duplicate spam
  if(seat.events[seat.events.length-1]!==text) seat.events.push(text);
}

function finishNightToDay(){
  // resolve deaths
  const wolf = S.nightActions.wolf;
  const guard = S.nightActions.guard;
  const save = S.nightActions.witchSave;
  const poison = S.nightActions.witchPoison;

  let deaths = [];
  if (wolf!=null){
    // guard blocks unless same? (basic rule)
    const blocked = (guard!=null && guard===wolf);
    const saved = (save!=null && save===wolf);
    if(!blocked && !saved){
      deaths.push({idx:wolf, reason:"狼刀"});
    }
  }
  if (poison!=null){
    deaths.push({idx:poison, reason:"毒死"});
  }

  // apply
  deaths.forEach(d=>{
    if(S.seats[d.idx]) {
      S.seats[d.idx].alive = false;
      markSeatEvent(d.idx, d.reason);
    }
  });

  const pub = [];
  const god = [];

  if(deaths.length===0){
    pub.push("昨夜結果：平安夜");
    god.push(`狼刀：${wolf!=null?seatNo(wolf)+"號":"—"}`);
    god.push(`守衛：${guard!=null?seatNo(guard)+"號":"—"}`);
    god.push(`解藥：${save!=null?seatNo(save)+"號":"—"}`);
    god.push(`毒藥：${poison!=null?seatNo(poison)+"號":"—"}`);
  }else{
    pub.push("昨夜結果：有玩家死亡");
    deaths.forEach(d=> pub.push(`- ${seatNo(d.idx)}號 死亡`));
    deaths.forEach(d=> god.push(`${seatNo(d.idx)}號：${d.reason}`));
  }

  pushLog(`天亮（白天${S.day}）`, pub, god);

  // reset for next cycle
  S.stage = "DAY";
  S.step = 0;
  S.nightActions = { guard:null, wolf:null, seer:null, witchSave:null, witchPoison:null };
  saveState();
  renderAll();
}

/* ====== Vote (simple grouped output) ====== */
let voteMap = {}; // voterIdx -> targetIdx|null ("abstain" as null)
function startVote(){
  voteMap = {};
  S.stage = "VOTE";
  S.step = 0;
  S.selectedSeat = null;
  saveState();
  renderAll();
}
function handleVoteTap(idx){
  // voting: select voter first, then target
  // reuse selectedSeat as voter selection
  if(S.selectedSeat==null){
    S.selectedSeat = idx; // voter
    saveState(); renderAll();
    toast(`已選投票者：${seatNo(idx)}號（再點被投者）`);
    return;
  }
  const voter = S.selectedSeat;
  const target = idx;

  if(voter===target){
    voteMap[voter] = null; // abstain
    toast(`${seatNo(voter)}號：棄票`);
  }else{
    voteMap[voter] = target;
    toast(`${seatNo(voter)}號 → 投給 ${seatNo(target)}號`);
  }
  S.selectedSeat = null;
  saveState(); renderAll();
}

function settleVote(){
  // group by target
  const groups = {}; // key: targetIdx or "abstain" -> voters[]
  Object.keys(voteMap).forEach(v=>{
    const voter = Number(v);
    const t = voteMap[voter];
    const key = (t==null) ? "abstain" : String(t);
    if(!groups[key]) groups[key]=[];
    groups[key].push(voter);
  });

  const lines = [];
  const godLines = [];

  // targets
  const keys = Object.keys(groups).filter(k=>k!=="abstain").map(Number).sort((a,b)=>a-b);
  keys.forEach(t=>{
    const voters = groups[String(t)].map(i=>seatNo(i)).sort((a,b)=>a-b);
    lines.push(`投給${seatNo(t)}號的有：${voters.join("、")}（${voters.length}票）`);
  });

  const abst = (groups["abstain"]||[]).map(i=>seatNo(i)).sort((a,b)=>a-b);
  if(abst.length) lines.push(`棄票的有：${abst.join("、")}（${abst.length}票）`);

  // find max
  let maxT = null, maxV = -1;
  keys.forEach(t=>{
    const c = (groups[String(t)]||[]).length;
    if(c>maxV){ maxV=c; maxT=t; }
  });

  if(maxT==null){
    lines.push("（尚未有有效投票）");
  }else{
    lines.push(`${seatNo(maxT)}號得到最高票，遭到放逐。`);
    // apply exile
    if(S.seats[maxT]) {
      S.seats[maxT].alive = false;
      markSeatEvent(maxT, "放逐");
    }
  }

  pushLog(`白天${S.day}投票結果`, lines, godLines);

  // move to next night
  S.stage = "NIGHT";
  S.night += 1;
  S.day += 1;
  S.step = 0;
  S.selectedSeat = null;

  saveState();
  renderAll();
}

/* ====== Announce text ====== */
function renderAnn(){
  const showGod = !!toggleAnnGod.checked;
  const blocks = [];
  S.logs.forEach((L, idx)=>{
    blocks.push(`【${idx+1}】${L.title}`);
    (L.publicLines||[]).forEach(x=> blocks.push(`- ${x}`));
    if(showGod){
      (L.godLines||[]).forEach(x=> blocks.push(`* ${x}`));
    }
    blocks.push(""); // blank line
  });
  annText.textContent = blocks.join("\n").trim();
}

function pushLog(title, publicLines=[], godLines=[]){
  S.logs.push({ title, publicLines, godLines });
}

/* ====== Timer ====== */
let timerInterval = null;
function tickTimer(){
  if(!S.timer.running) return;
  const now = Date.now();
  const elapsed = Math.floor((now - S.timer.ts)/1000);
  const left = Math.max(0, S.timer.left - elapsed);
  timerBig.textContent = fmtTime(left);
  if(left<=0){
    S.timer.running = false;
    S.timer.left = 0;
    saveState();
    clearInterval(timerInterval);
    timerInterval = null;
    try{ navigator.vibrate && navigator.vibrate([120,80,120]); }catch(_){}
  }
}
function setTimer(sec){
  S.timer.sec = sec;
  S.timer.left = sec;
  S.timer.running = false;
  S.timer.ts = 0;
  timerBig.textContent = fmtTime(sec);
  saveState();
}

/* ====== Dice ====== */
function rollDice(){
  const alive = S.seats.map((s,idx)=>({s,idx})).filter(x=>x.s.alive).map(x=>x.idx);
  if(!alive.length){ diceResult.textContent="—"; return; }
  const pick = alive[Math.floor(Math.random()*alive.length)];
  diceResult.textContent = `${seatNo(pick)}號`;
}

/* ====== Toast ====== */
let toastTimer=null;
function toast(msg){
  // lightweight: show in promptFoot
  promptFoot.textContent = msg;
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> renderPrompt(), 1200);
}

/* ====== Main render ====== */
function renderAll(){
  renderTop();
  renderPrompt();
  renderSetup();
  renderSeats();
  renderBottom();
  renderAnn();
}

/* ====== Wiring ====== */
function bindUI(){
  // setup chips
  qsa(".chip[data-n]", setupCard).forEach(btn=>{
    btn.addEventListener("click", ()=>{
      S.selectedN = Number(btn.dataset.n);
      S.boardId = null;
      saveState();
      renderAll();
    });
  });

  // bottom buttons
  btnBack.addEventListener("click", ()=>{
    // simple: step back within stage
    if(S.stage==="NIGHT" && S.step>0){
      S.step -= 1;
      S.selectedSeat = null;
      saveState(); renderAll();
      return;
    }
    if(S.stage==="DAY"){
      // go back to last night (not rolling back results in this simple build)
      toast("白天不支援回復上一夜（避免狀態混亂）");
      return;
    }
    if(S.stage==="DEAL"){
      // allow go back to setup
      S.stage="SETUP";
      S.boardId=null;
      S.seats=[];
      S.deckLeft=[];
      S.logs=[];
      saveState(); renderAll();
      return;
    }
  });

  btnNext.addEventListener("click", ()=>{
    if(S.stage==="SETUP"){
      if(!S.boardId){
        toast("請先選板子");
        return;
      }
      startDeal();
      return;
    }
    if(S.stage==="DEAL"){
      toast("抽身分階段：請用長按查看，全部看完後按「開始夜晚」");
      return;
    }
    if(S.stage==="NIGHT"){
      const steps = getNightOrder();
      if(S.step >= steps.length){
        toast("夜晚已完成，按「天亮睜眼」");
        return;
      }
      confirmNightStep();
      return;
    }
    if(S.stage==="DAY"){
      toast("白天請按中間鍵「開始投票」");
      return;
    }
    if(S.stage==="VOTE"){
      toast("投票中：完成後按中間鍵「結算放逐」");
      return;
    }
  });

  btnMain.addEventListener("click", ()=>{
    if(S.stage==="DEAL"){
      if(btnMain.disabled){
        toast("請先讓所有玩家看完身分（含盜賊完成二選一）");
        return;
      }
      // start night
      S.stage="NIGHT";
      S.step=0;
      S.selectedSeat=null;
      saveState(); renderAll();
      pushLog(`進入夜晚${S.night}`, ["夜晚開始"], []);
      renderAnn();
      return;
    }

    if(S.stage==="NIGHT"){
      // if night steps not finished, jump to finish? no
      const steps = getNightOrder();
      if(S.step < steps.length){
        toast("請先完成夜晚步驟（用「下一步」確認）");
        return;
      }
      finishNightToDay();
      return;
    }

    if(S.stage==="DAY"){
      startVote();
      return;
    }

    if(S.stage==="VOTE"){
      settleVote();
      return;
    }
  });

  // top buttons
  btnTimer.addEventListener("click", ()=> openDrawer(timerBackdrop, timerDrawer));
  btnCloseTimer.addEventListener("click", ()=> closeDrawer(timerBackdrop, timerDrawer));
  timerBackdrop.addEventListener("click", ()=> closeDrawer(timerBackdrop, timerDrawer));

  // presets
  qsa("#timerPresets .chip").forEach(b=>{
    b.addEventListener("click", ()=>{
      const sec = Number(b.dataset.sec);
      setTimer(sec);
    });
  });
  btnTimerStart.addEventListener("click", ()=>{
    if(S.timer.running) return;
    S.timer.running = true;
    S.timer.ts = Date.now();
    saveState();
    if(!timerInterval){
      timerInterval = setInterval(tickTimer, 250);
    }
  });
  btnTimerPause.addEventListener("click", ()=>{
    if(!S.timer.running) return;
    // freeze left
    const now = Date.now();
    const elapsed = Math.floor((now - S.timer.ts)/1000);
    S.timer.left = Math.max(0, S.timer.left - elapsed);
    S.timer.running = false;
    S.timer.ts = 0;
    saveState();
    tickTimer();
  });
  btnTimerReset.addEventListener("click", ()=>{
    setTimer(S.timer.sec || 90);
  });

  btnAnn.addEventListener("click", ()=>{
    renderAnn();
    openDrawer(annBackdrop, annDrawer);
  });
  btnCloseAnn.addEventListener("click", ()=> closeDrawer(annBackdrop, annDrawer));
  annBackdrop.addEventListener("click", ()=> closeDrawer(annBackdrop, annDrawer));
  toggleAnnGod.addEventListener("change", renderAnn);

  btnSettings.addEventListener("click", ()=> openDrawer(setBackdrop, setDrawer));
  btnCloseSet.addEventListener("click", ()=> closeDrawer(setBackdrop, setDrawer));
  setBackdrop.addEventListener("click", ()=> closeDrawer(setBackdrop, setDrawer));

  segEdge.addEventListener("click", ()=>{
    S.winMode="edge"; saveState(); toast("勝負：屠邊"); renderAll();
  });
  segCity.addEventListener("click", ()=>{
    S.winMode="city"; saveState(); toast("勝負：屠城"); renderAll();
  });
  togglePolice.addEventListener("change", ()=>{
    S.hasPolice = !!togglePolice.checked;
    saveState(); renderAll();
  });

  btnGotoSetup.addEventListener("click", ()=>{
    S = defaultState();
    saveState();
    location.reload();
  });
  btnHardReset.addEventListener("click", ()=>{
    localStorage.removeItem(LS_KEY);
    location.reload();
  });

  btnEye.addEventListener("click", ()=>{
    S.godView = !S.godView;
    saveState();
    renderAll();
    toast(S.godView ? "👁 上帝視角：開" : "👁 上帝視角：關");
  });

  btnDice.addEventListener("click", ()=>{
    rollDice();
    openModal(diceModal);
  });
  btnDiceAgain.addEventListener("click", rollDice);
  btnDiceClose.addEventListener("click", ()=> closeModal(diceModal));
  diceModal.addEventListener("click", (e)=>{
    if(e.target===diceModal) closeModal(diceModal);
  });

  // close modals by background
  roleModal.addEventListener("click", (e)=>{ if(e.target===roleModal) closeModal(roleModal); });
  thiefModal.addEventListener("click", (e)=>{ if(e.target===thiefModal) closeModal(thiefModal); });

  // defaults
  togglePolice.checked = !!S.hasPolice;
}

function applySeatInteractionOverrides(){
  // In vote stage, seat taps mean vote logic
  // We'll hook by re-render: add event listeners in renderSeats via click already.
  // So: override selection behavior when vote stage:
  // (We intercept by using global capture on seatsGrid)
  seatsGrid.addEventListener("click", (e)=>{
    if(S.stage!=="VOTE") return;
    const seatEl = e.target.closest(".seat");
    if(!seatEl) return;
    // infer index by reading its num text
    const numEl = seatEl.querySelector(".num");
    if(!numEl) return;
    const n = Number(numEl.textContent.trim());
    const idx = n-1;
    if(idx>=0 && idx<S.selectedN){
      e.preventDefault();
      e.stopPropagation();
      handleVoteTap(idx);
    }
  }, true);
}

/* ====== Boot ====== */
function boot(){
  bindUI();
  applySeatInteractionOverrides();

  // if loaded state is broken, normalize
  if(S.stage!=="SETUP" && (!S.boardId || !S.selectedN)){
    S = defaultState();
    saveState();
  }

  // sync settings UI
  togglePolice.checked = !!S.hasPolice;
  segEdge.classList.toggle("primary", S.winMode==="edge");
  segCity.classList.toggle("primary", S.winMode==="city");

  // timer display
  timerBig.textContent = fmtTime(S.timer.left ?? 90);
  if(S.timer.running && !timerInterval){
    timerInterval = setInterval(tickTimer, 250);
  }

  renderAll();
}

boot();