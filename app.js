/* =========================================================
   Werewolf God Helper - app.js (FULL OVERWRITE)
   - 平民才是民；白痴/盜賊算神
   - 狼上限 4：小狼 + 黑狼王 + 白狼王（可調配）
   - 神職可替換
   - 盜賊：牌堆採「N 人 + 2 底牌」發牌
            盜賊看完身分立刻二選一（底牌兩張）
            放棄那張直接移出遊戲 => 不會重複
   - iOS：禁選取/禁長按選單/禁雙擊縮放（CSS+JS）
========================================================= */

/* ====== DOM ====== */
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

/* Drawer / Modal */
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

const roleModal   = document.getElementById("roleModal");
const roleModalTitle = document.getElementById("roleModalTitle");
const roleModalRole  = document.getElementById("roleModalRole");
const roleModalCamp  = document.getElementById("roleModalCamp");
const btnRoleDone    = document.getElementById("btnRoleDone");
const btnRoleClose   = document.getElementById("btnRoleClose");

const thiefModal  = document.getElementById("thiefModal");
const thiefHint   = document.getElementById("thiefHint");
const btnThiefA   = document.getElementById("btnThiefA");
const btnThiefB   = document.getElementById("btnThiefB");
const btnThiefClose = document.getElementById("btnThiefClose");

/* ====== iOS Guards ====== */
function installIOSGuards(){
  document.addEventListener("contextmenu", (e)=>e.preventDefault(), {passive:false});
  document.addEventListener("selectstart", (e)=>e.preventDefault(), {passive:false});
  document.addEventListener("gesturestart", (e)=>e.preventDefault(), {passive:false});
  document.addEventListener("dblclick", (e)=>e.preventDefault(), {passive:false});

  // double-tap zoom guard
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (e)=>{
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, {passive:false});
}

/* ====== Utils ====== */
const LS_KEY = "ww_god_helper_v3";
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
  if (role === "平民") return "民";
  if (role === "小狼" || role === "白狼王" || role === "黑狼王") return "狼";
  // 其他都算神（含 白痴/盜賊）
  return "神";
}

/* ====== Roles ====== */
const GOD_ROLES = ["預言家","女巫","獵人","守衛","白痴","邱比特","盜賊"];
const WOLF_ROLES = ["小狼","白狼王","黑狼王"];

/* ====== Preset Boards (你可自行加更多) ====== */
const BOARDS = [
  {
    id:"official-12",
    name:"12 人官方標準局",
    n:12,
    tags:["官方","標準","含白痴"],
    // 12人：四狼四神四民（神內含白痴）
    config:{
      wolves:{ small:4, white:0, black:0 }, // 預設 4 小狼
      gods:["預言家","女巫","獵人","守衛"], // 4 神（可替換）
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
      wolves:{ small:4, white:0, black:0 }, // 狼上限4，預設4小狼
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
      wolves:{ small:3, white:0, black:0 }, // 10人通常3狼
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

/* ====== Game State ====== */
const DEFAULT_STATE = {
  phase:"SETUP",          // SETUP | DEAL | NIGHT | DAY | VOTE
  stepIndex:0,
  day:1,                  // 白天第幾天（夜晚=同一天夜）
  n:12,
  boardId:"official-12",
  config: JSON.parse(JSON.stringify(BOARDS[0].config)),
  // dealing
  deck:[],                // 全牌堆（含底牌）
  bottom:[],              // 底牌（最多2）
  seats:[],               // index 1..n  (0 unused)
  seen:{},                // seatNo -> true
  selectedSeat:null,      // 用於流程目標
  godView:false,
  log:[],                 // 公開公告（+可選上帝詳細）
  logGod:[],              // 上帝詳細
  // thief
  thiefSeat:null,
  thiefResolved:false,
  // settings
  winMode:"edge",
  hasPolice:false
};

let S = loadState();

/* ====== Storage ====== */
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

/* ====== UI helpers ====== */
function setTop(status, board){
  uiStatus.textContent = status || "—";
  uiBoard.textContent = board || "—";
}

function setPrompt(title, text, foot=""){
  promptTitle.textContent = title || "—";
  promptText.textContent  = text || "—";
  promptFoot.textContent  = foot || "";
}

function show(el){ el?.classList.remove("hidden"); }
function hide(el){ el?.classList.add("hidden"); }

function openDrawer(backdrop, drawer){
  show(backdrop); show(drawer);
  drawer.setAttribute("aria-hidden","false");
}
function closeDrawer(backdrop, drawer){
  hide(backdrop); hide(drawer);
  drawer.setAttribute("aria-hidden","true");
}

function openModal(modal){
  show(modal);
  modal.setAttribute("aria-hidden","false");
}
function closeModal(modal){
  hide(modal);
  modal.setAttribute("aria-hidden","true");
}

/* ====== Setup UI ====== */
function renderSetup(){
  // 人數 chips
  document.querySelectorAll(".chip[data-n]").forEach(btn=>{
    const n = Number(btn.dataset.n);
    btn.classList.toggle("active", S.n === n);
    btn.onclick = ()=>{
      S.n = n;
      // 找同n的第一個板子作預設
      const pick = BOARDS.find(b=>b.n===n) || BOARDS[0];
      S.boardId = pick.id;
      S.config = structuredClone(pick.config);
      saveState();
      renderSetup();
      renderAll();
    };
  });

  // board list
  boardList.innerHTML = "";
  const list = BOARDS.filter(b=>b.n===S.n);
  list.forEach(b=>{
    const d = document.createElement("div");
    d.className = "boardItem";
    d.dataset.id = b.id;
    d.classList.toggle("active", S.boardId === b.id);

    const wolvesTxt = wolvesText(b.config.wolves);
    const godsTxt = b.config.gods.join("、");
    const meta = `${b.id} ・ 狼:${wolvesTxt} ・ 神:${b.config.gods.length}（含白痴/盜賊） ・ 民:平民`;

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

function wolvesText(w){
  const parts = [];
  if (w.small) parts.push(`小狼${w.small}`);
  if (w.white) parts.push(`白狼王${w.white}`);
  if (w.black) parts.push(`黑狼王${w.black}`);
  return parts.join("+") || "0";
}

/* ====== Dynamic settings: 注入「配置」到設定抽屜 ====== */
function injectRoleConfigUI(){
  const body = setDrawer.querySelector(".drawerBody");
  if(!body) return;

  // 避免重複注入
  if (body.querySelector("#roleCfgBox")) return;

  const box = document.createElement("div");
  box.id = "roleCfgBox";
  box.className = "card tight";
  box.style.marginTop = "12px";

  box.innerHTML = `
    <div class="cardTitle" style="font-size:18px;">🎛️ 角色配置（可替換）</div>
    <div class="hint" style="margin:6px 0 10px;">
      規則：平民才算民；白痴/盜賊算神。<br/>
      狼上限 4，可用「小狼/黑狼王/白狼王」組合。
    </div>

    <div class="hint">狼人配置（總數 ≤ 4）</div>
    <div class="chips" style="margin-top:8px; flex-wrap:wrap;">
      <button type="button" class="chip" id="wSmallDec">小狼 -</button>
      <button type="button" class="chip" id="wSmallAdd">小狼 +</button>
      <button type="button" class="chip" id="wWhiteToggle">白狼王 切換</button>
      <button type="button" class="chip" id="wBlackToggle">黑狼王 切換</button>
    </div>
    <div class="hint" id="wolfCfgHint" style="margin-top:8px;"></div>

    <div class="hint" style="margin-top:12px;">神職（勾選＝加入；白痴/盜賊都算神）</div>
    <div id="godCfgList" style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:8px;"></div>

    <div class="hint" id="countHint" style="margin-top:10px;"></div>
    <button type="button" class="btn ghost" id="btnCfgApply" style="width:100%; margin-top:10px;">
      套用到目前板子
    </button>
  `;

  body.appendChild(box);

  // bind
  const wolfCfgHint = box.querySelector("#wolfCfgHint");
  const countHint = box.querySelector("#countHint");
  const godCfgList = box.querySelector("#godCfgList");

  // local editable (不直接改 S.config，按套用才寫入)
  const cfg = structuredClone(S.config);

  function totalWolves(c){
    return (c.wolves.small||0) + (c.wolves.white||0) + (c.wolves.black||0);
  }

  function refreshCfgUI(){
    wolfCfgHint.textContent = `目前：${wolvesText(cfg.wolves)}（總數 ${totalWolves(cfg)} / 4）`;

    godCfgList.innerHTML = "";
    GOD_ROLES.forEach(r=>{
      const wrap = document.createElement("label");
      wrap.className = "row";
      wrap.style.border = "2px solid var(--stroke)";
      wrap.style.borderRadius = "14px";
      wrap.style.padding = "10px 12px";
      wrap.style.background = "#fff8ea";

      const checked = cfg.gods.includes(r);
      wrap.innerHTML = `
        <span style="font-weight:1000;">${r}</span>
        <input type="checkbox" ${checked ? "checked":""} />
      `;
      const cb = wrap.querySelector("input");
      cb.onchange = ()=>{
        const on = cb.checked;
        if(on && !cfg.gods.includes(r)) cfg.gods.push(r);
        if(!on) cfg.gods = cfg.gods.filter(x=>x!==r);

        // thief toggle 綁 hasThief/plusBottom
        cfg.hasThief = cfg.gods.includes("盜賊");
        cfg.plusBottom = cfg.hasThief ? 2 : 0;

        refreshCfgUI();
      };
      godCfgList.appendChild(wrap);
    });

    const wolves = totalWolves(cfg);
    const gods = cfg.gods.length;
    const totalCards = S.n + (cfg.plusBottom||0);

    // 先把民算出來（全用平民補）
    const villagers = totalCards - wolves - gods;
    const ok = villagers >= 0;

    countHint.textContent =
      `人數 ${S.n}，底牌 ${cfg.plusBottom||0}，牌總數 ${totalCards}\n` +
      `狼人 ${wolves}、神 ${gods}、民（平民） ${villagers} ${ok ? "" : "⚠️ 超過牌數，請減少狼人或神"}`;

    countHint.style.whiteSpace = "pre-wrap";
    countHint.style.color = ok ? "var(--muted)" : "#c03b3b";
  }

  box.querySelector("#wSmallDec").onclick = ()=>{
    cfg.wolves.small = clamp((cfg.wolves.small||0)-1, 0, 4);
    refreshCfgUI();
  };
  box.querySelector("#wSmallAdd").onclick = ()=>{
    // 不能超過 4
    const t = totalWolves(cfg);
    if (t >= 4) return;
    cfg.wolves.small = clamp((cfg.wolves.small||0)+1, 0, 4);
    refreshCfgUI();
  };
  box.querySelector("#wWhiteToggle").onclick = ()=>{
    // 切換 0/1，但總數不超4
    const now = cfg.wolves.white ? 0 : 1;
    const t = totalWolves(cfg) - (cfg.wolves.white||0) + now;
    if (t > 4) return;
    cfg.wolves.white = now;
    refreshCfgUI();
  };
  box.querySelector("#wBlackToggle").onclick = ()=>{
    const now = cfg.wolves.black ? 0 : 1;
    const t = totalWolves(cfg) - (cfg.wolves.black||0) + now;
    if (t > 4) return;
    cfg.wolves.black = now;
    refreshCfgUI();
  };

  box.querySelector("#btnCfgApply").onclick = ()=>{
    // 套用
    S.config = cfg;

    // 同步 boardId 只當作「自訂」
    if(!S.boardId.startsWith("custom-")) S.boardId = "custom-" + S.n;
    saveState();
    renderAll();
    alert("已套用角色配置 ✅");
  };

  refreshCfgUI();
}

/* ====== Build Deck (最重要：避免重複 + 支援盜賊) ======
   規則：
   - 牌堆總數 = N + plusBottom(盜賊=2)
   - 狼：由 wolves.small/white/black 組成（總≤4）
   - 神：config.gods 列表（白痴/盜賊算神）
   - 民：剩餘全部用「平民」補
*/
function buildDeck(){
  const cfg = S.config;
  const totalCards = S.n + (cfg.plusBottom||0);

  const wolves = [];
  for(let i=0;i<(cfg.wolves.small||0);i++) wolves.push("小狼");
  for(let i=0;i<(cfg.wolves.white||0);i++) wolves.push("白狼王");
  for(let i=0;i<(cfg.wolves.black||0);i++) wolves.push("黑狼王");
  const wolfCount = wolves.length;

  const gods = [...cfg.gods]; // already role names
  const godCount = gods.length;

  const villagersCount = totalCards - wolfCount - godCount;
  if (villagersCount < 0){
    // 不合法，硬修：先減少平民不可能 => 直接 throw
    throw new Error("配置超過牌數：請減少狼人或神職");
  }

  const deck = [];
  deck.push(...wolves);
  deck.push(...gods);
  for(let i=0;i<villagersCount;i++) deck.push("平民");

  shuffle(deck);
  return deck;
}

/* ====== Deal ====== */
function startDeal(){
  // init seats 1..n
  S.seats = Array(S.n+1).fill(null).map((_,i)=> i===0 ? null : ({
    no:i,
    role:null,
    camp:null,
    alive:true,
    death:null,      // "狼刀"|"毒死"|...
    events:[]        // icon strings
  }));
  S.seen = {};
  S.selectedSeat = null;
  S.godView = false;
  S.log = [];
  S.logGod = [];

  S.thiefSeat = null;
  S.thiefResolved = false;

  let deck;
  try{
    deck = buildDeck();
  }catch(err){
    alert(err.message || "配置錯誤");
    return;
  }

  // 發給 N 人
  for(let i=1;i<=S.n;i++){
    const role = deck.pop();
    S.seats[i].role = role;
    S.seats[i].camp = campOf(role);
    if(role === "盜賊") S.thiefSeat = i;
  }

  // 底牌
  const plus = S.config.plusBottom || 0;
  S.bottom = [];
  for(let k=0;k<plus;k++){
    S.bottom.push(deck.pop());
  }

  // 剩餘 deck 理論上為 0
  S.deck = [];

  S.phase = "DEAL";
  S.stepIndex = 0;
  S.day = 1;

  saveState();
  renderAll();
}

/* ====== Thief resolve ======
   - 盜賊看完身分時立刻彈二選一（底牌兩張）
   - 若兩張含狼 + 好人 => 必須選狼
   - 若兩張都狼 => 可選其一，另一張丟出遊戲 => 狼總數 -1
   - 若兩張都好人 => 可選其一，另一張丟出遊戲（可能導致 4狼5神3民 或 4狼4神4民）
*/
function resolveThiefIfNeeded(){
  const cfg = S.config;
  if(!cfg.hasThief) return;
  if(S.thiefResolved) return;
  if(!S.thiefSeat) return;
  if(!S.bottom || S.bottom.length !== 2) return;

  const a = S.bottom[0];
  const b = S.bottom[1];

  const aCamp = campOf(a);
  const bCamp = campOf(b);

  // 限制：若有狼牌，必須成為狼
  let mustWolf = (aCamp === "狼" || bCamp === "狼");

  thiefHint.textContent =
    mustWolf
      ? "底牌含狼人陣營：盜賊必須選擇狼人陣營（另一張移出遊戲）。"
      : "請從兩張底牌中選擇其一成為你的新角色（另一張移出遊戲）。";

  btnThiefA.textContent = `選 ${a}`;
  btnThiefB.textContent = `選 ${b}`;

  function pick(role){
    // 若 mustWolf 且 role 不是狼 => 不允許
    if(mustWolf && campOf(role) !== "狼"){
      alert("此局底牌含狼人，你必須選狼人陣營。");
      return;
    }

    const chosen = role;
    const other = (role === a) ? b : a;

    // 盜賊 seat 變更角色
    const seat = S.seats[S.thiefSeat];
    seat.role = chosen;
    seat.camp = campOf(chosen);

    // 被丟棄的那張移出遊戲（不再出現在任何人身上）=> 其實已經是底牌，直接丟棄即可
    S.bottom = []; // 底牌消失
    S.thiefResolved = true;

    // 上帝詳細紀錄
    S.logGod.push(`【盜賊】${S.thiefSeat}號 由「盜賊」改為「${chosen}」，棄掉「${other}」（移出遊戲）`);

    closeModal(thiefModal);
    saveState();
    renderAll();
  }

  btnThiefA.onclick = ()=>pick(a);
  btnThiefB.onclick = ()=>pick(b);
  btnThiefClose.onclick = ()=>alert("盜賊必須先完成選角才能開始夜晚。");

  openModal(thiefModal);
}

/* ====== Seat UI (click select / toggle) ====== */
function renderSeats(){
  seatsGrid.innerHTML = "";
  for(let i=1;i<=S.n;i++){
    const seat = S.seats?.[i] || { no:i, alive:true, role:null, camp:null, events:[] };

    const b = document.createElement("button");
    b.type = "button";
    b.className = "seat";
    b.dataset.seat = String(i);

    // alive/dead
    if(seat.alive === false) b.classList.add("dead");

    // god view camp outline
    if(S.godView && seat.camp){
      b.classList.add(seat.camp === "狼" ? "campWolf" : "campGood");
    }

    // selected
    if(S.selectedSeat === i) b.classList.add("isSelected");

    // seatSub text
    let sub = "點一下選取";
    if(S.phase === "DEAL"){
      sub = S.seen[i] ? "已看過（已蓋牌）" : "長按 0.3 秒看身分";
    }else if(S.godView && seat.role){
      sub = `${seat.role}・${seat.camp === "狼" ? "狼人" : "好人"}`;
    }else if(seat.alive === false){
      sub = seat.death ? `死亡・${seat.death}` : "死亡";
    }

    // events icons
    const ev = (S.godView && seat.events && seat.events.length)
      ? `<div class="eventLine">${seat.events.join(" ")}</div>`
      : "";

    b.innerHTML = `
      <div class="seatNum">${i}</div>
      <div class="seatSub">${sub}</div>
      ${ev}
    `;

    seatsGrid.appendChild(b);
  }
}

function bindSeatClick(){
  seatsGrid.addEventListener("click",(e)=>{
    const btn = e.target.closest(".seat");
    if(!btn) return;
    const n = Number(btn.dataset.seat);
    if(!Number.isFinite(n)) return;

    // toggle select
    S.selectedSeat = (S.selectedSeat === n) ? null : n;
    saveState();
    renderSeats();
  });
}

/* ====== Long press to show identity (DEAL only) ====== */
let pressTimer = null;
function bindSeatLongPress(){
  function startPress(targetBtn){
    if(!targetBtn) return;
    if(S.phase !== "DEAL") return;

    const n = Number(targetBtn.dataset.seat);
    if(!Number.isFinite(n)) return;

    // 必須先點選座位（符合你之前習慣）
    if(S.selectedSeat !== n){
      S.selectedSeat = n;
      saveState();
      renderSeats();
    }

    pressTimer = setTimeout(()=>{
      showIdentity(n);
    }, 300);
  }

  function cancelPress(){
    if(pressTimer){
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  }

  seatsGrid.addEventListener("touchstart",(e)=>{
    const btn = e.target.closest(".seat");
    startPress(btn);
  }, {passive:true});

  seatsGrid.addEventListener("touchend", cancelPress);
  seatsGrid.addEventListener("touchmove", cancelPress);

  seatsGrid.addEventListener("mousedown",(e)=>{
    const btn = e.target.closest(".seat");
    startPress(btn);
  });
  seatsGrid.addEventListener("mouseup", cancelPress);
  seatsGrid.addEventListener("mouseleave", cancelPress);
}

let currentViewingSeat = null;
function showIdentity(n){
  const seat = S.seats[n];
  if(!seat) return;

  currentViewingSeat = n;
  roleModalTitle.textContent = `${n}號 身分`;
  roleModalRole.textContent  = seat.role || "—";
  roleModalCamp.textContent  = `陣營：${seat.camp === "狼" ? "狼人" : "好人"}`;

  openModal(roleModal);
}

function hideIdentityAndCover(){
  if(currentViewingSeat != null){
    S.seen[currentViewingSeat] = true; // ✅ 看完就蓋牌（不再顯示角色）
    saveState();
    renderSeats();

    // 若此人是盜賊 => 立刻二選一
    const seat = S.seats[currentViewingSeat];
    if(seat?.role === "盜賊"){
      // 盜賊要先按「我看完了」才進二選一（你要的流程）
      setTimeout(()=>resolveThiefIfNeeded(), 50);
    }
  }
  currentViewingSeat = null;
  closeModal(roleModal);
}

btnRoleDone.onclick = hideIdentityAndCover;
btnRoleClose.onclick = ()=>{ closeModal(roleModal); };

/* ====== Phase flow ====== */
function updateMainButtons(){
  // 中間主按鈕文字依 phase
  if(S.phase === "SETUP"){
    btnMain.textContent = "—";
    btnMain.disabled = true;
    btnBack.disabled = true;
    btnNext.disabled = false;
  }else if(S.phase === "DEAL"){
    btnMain.textContent = "開始夜晚";
    btnMain.disabled = true; // 會用「全部看完 + 盜賊完成」才可按
    btnBack.disabled = false;
    btnNext.disabled = false;
  }else if(S.phase === "NIGHT"){
    btnMain.textContent = "天亮睜眼";
    btnMain.disabled = false;
    btnBack.disabled = false;
    btnNext.disabled = false;
  }else if(S.phase === "DAY"){
    btnMain.textContent = "開始投票";
    btnMain.disabled = false;
    btnBack.disabled = false;
    btnNext.disabled = false;
  }else if(S.phase === "VOTE"){
    btnMain.textContent = "結束投票";
    btnMain.disabled = false;
    btnBack.disabled = false;
    btnNext.disabled = false;
  }
}

function allSeen(){
  for(let i=1;i<=S.n;i++){
    if(!S.seen[i]) return false;
  }
  return true;
}

function canStartNight(){
  if(S.phase !== "DEAL") return false;
  if(!allSeen()) return false;
  // 若有盜賊，必須完成選角
  if(S.config.hasThief && !S.thiefResolved) return false;
  return true;
}

/* ====== Night/Day Steps ====== */
function rolesPresent(){
  const set = new Set();
  for(let i=1;i<=S.n;i++){
    const r = S.seats[i]?.role;
    if(r) set.add(r);
  }
  return set;
}

function buildNightSteps(){
  const present = rolesPresent();
  const steps = [];

  // 第一夜若有邱比特（你之前有需求）
  if(S.day === 1 && present.has("邱比特")){
    steps.push({ key:"cupid", title:`夜晚 ${S.day}`, text:"邱比特請睜眼（選擇兩位戀人）", needPick:true, pickCount:2 });
  }

  if(present.has("守衛")) steps.push({ key:"guard", title:`夜晚 ${S.day}`, text:"守衛請閉眼（選擇守護）", needPick:true, pickCount:1 });
  steps.push({ key:"wolves", title:`夜晚 ${S.day}`, text:"狼人請閉眼（選擇刀人）", needPick:true, pickCount:1 });

  if(present.has("預言家")) steps.push({ key:"seer", title:`夜晚 ${S.day}`, text:"預言家請閉眼（查驗一人）", needPick:true, pickCount:1 });
  if(present.has("女巫")) steps.push({ key:"witch", title:`夜晚 ${S.day}`, text:"女巫請閉眼（解藥 / 毒藥）\n- 點刀口=救（💊）\n- 點其他人=毒（🧪）\n- 再點同號可取消", needPick:true, pickCount:1, witch:true });

  return steps;
}

function buildDayPrompt(){
  return {
    title:`白天 ${S.day}`,
    text:
`天亮了，請宣布昨夜結果（可按📣公告回顧）：

白天流程：自由發言 → ${(S.hasPolice?"上警/警長":"不設上警")} → 推理/辯論 → 投票

按「開始投票」進入投票統計。`
  };
}

function renderPhasePrompt(){
  if(S.phase === "SETUP"){
    setPrompt("開局設定",
`1) 先選人數
2) 再選板子（點一下會變色）
3) 按底部「下一步」進入抽身分`,
`（選完後，開局卡會消失，避免佔畫面）`
    );
    return;
  }

  if(S.phase === "DEAL"){
    const done = Object.keys(S.seen).length;
    const warnThief = (S.config.hasThief && !S.thiefResolved) ? "⚠️ 盜賊尚未完成選角（盜賊看完身分會立刻二選一）\n" : "";
    setPrompt(
      `抽身分（${done}/${S.n}）`,
`上帝點選座位（可取消） → 玩家長按 0.3 秒看身分 → 按「我看完了」
看完會自動蓋牌（不會露出角色）
全部看完後按「開始夜晚」進入夜晚流程
${warnThief}`.trim()
    );
    return;
  }

  if(S.phase === "NIGHT"){
    const steps = buildNightSteps();
    const s = steps[S.stepIndex] || steps[0];
    const list = steps.map((x,idx)=>`${idx+1}) ${x.text}`).join("\n");
    setPrompt(
      `夜晚 ${S.day}`,
`夜晚開始：
${list}

👉 目前：${S.stepIndex+1}. ${s.text}
（點座位選取；再點同號取消；按「下一步」確認）`
    );
    return;
  }

  if(S.phase === "DAY"){
    const d = buildDayPrompt();
    setPrompt(d.title, d.text);
    return;
  }

  if(S.phase === "VOTE"){
    setPrompt(
      `投票（白天 ${S.day}）`,
`按「結束投票」後會把票型寫入📣公告（可回顧每日公開資訊）`
    );
  }
}

/* ====== Actions ====== */
function goSetup(){
  S.phase="SETUP";
  S.stepIndex=0;
  S.day=1;
  S.selectedSeat=null;
  saveState();
  renderAll();
}

function goDeal(){
  // 必須有 n + board
  if(!S.n || !S.boardId){
    alert("請先選人數與板子");
    return;
  }
  startDeal();
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

function endNightToDay(){
  S.phase="DAY";
  S.stepIndex=0;
  S.selectedSeat=null;

  // 夜晚結果這裡先用簡化：若你要完整刀口/救/毒/盾等，可再接你既有的事件紀錄邏輯
  // 先示範：若上帝沒記錄，公告為平安夜（你也可以手動在📣補充）
  if(!S.log.includes(`Day${S.day}:`)){
    S.log.push(`Day${S.day}: 天亮公告（請上帝補充昨夜結果）`);
  }

  saveState();
  renderAll();
}

function startVote(){
  S.phase="VOTE";
  S.selectedSeat=null;
  saveState();
  renderAll();

  // 用 prompt 方式快速收票（不改HTML）
  const alive = [];
  for(let i=1;i<=S.n;i++){
    if(S.seats[i]?.alive) alive.push(i);
  }
  const votes = {}; // target -> [voters]
  for(const v of alive){
    const t = prompt(`投票：${v}號 投給誰？（輸入座位號；0=棄票）`, "0");
    const tn = Number(t);
    if(!Number.isFinite(tn) || tn<0 || tn>S.n) continue;
    const key = tn === 0 ? "棄票" : `${tn}號`;
    votes[key] = votes[key] || [];
    votes[key].push(v);
  }

  // 統計文字
  const lines = Object.entries(votes)
    .sort((a,b)=>b[1].length-a[1].length)
    .map(([k,arr])=>`${k}：${arr.length} 票（${arr.join("、")}）`);

  S.log.push(`Day${S.day} 投票結果：\n${lines.join("\n")}`);
  S.logGod.push(`【上帝】已完成 Day${S.day} 投票輸入`);

  saveState();
  renderAll();
}

function endVote(){
  // 投票結束：進入下一夜
  S.phase="NIGHT";
  S.day += 1;
  S.stepIndex = 0;
  S.selectedSeat = null;
  saveState();
  renderAll();
}

/* ====== Night step confirm ====== */
function confirmNightStep(){
  const steps = buildNightSteps();
  const s = steps[S.stepIndex];
  if(!s) return;

  if(s.needPick){
    if(s.pickCount === 1){
      if(!S.selectedSeat){
        alert("請先點選座位（再按下一步確認）");
        return;
      }
    }else if(s.pickCount === 2){
      // 情侶：用兩次點選來完成
      // 簡化做法：第一次選 A 存在 temp，第二次選 B
      S._cupidPick = S._cupidPick || [];
      if(!S.selectedSeat){
        alert("請先點選座位");
        return;
      }
      if(S._cupidPick.includes(S.selectedSeat)){
        alert("已選過這個座位，請選另一位");
        return;
      }
      S._cupidPick.push(S.selectedSeat);
      if(S._cupidPick.length < 2){
        alert(`已選第 ${S._cupidPick.length} 位，請再選第 2 位戀人`);
        S.selectedSeat = null;
        saveState();
        renderSeats();
        return;
      }
      // 完成
      S.logGod.push(`【邱比特】選擇戀人：${S._cupidPick[0]}號 & ${S._cupidPick[1]}號`);
      S._cupidPick = [];
    }

    // 記錄（簡化）
    if(s.key === "guard"){
      S.logGod.push(`【守衛】守護：${S.selectedSeat}號`);
      // 盾牌 icon（只在上帝視角）
      S.seats[S.selectedSeat].events.push("🛡️");
    }
    if(s.key === "wolves"){
      S.logGod.push(`【狼人】刀：${S.selectedSeat}號`);
      S.seats[S.selectedSeat].events.push("🐺🗡️");
    }
    if(s.key === "seer"){
      const target = S.selectedSeat;
      const camp = S.seats[target].camp;
      S.logGod.push(`【預言家】查驗：${target}號 → ${camp === "狼" ? "狼人" : "好人"}`);
      // 公開不寫入 log（上帝口頭宣布）
    }
    if(s.key === "witch"){
      // 簡化：用一次選取 + 讓上帝決定救/毒（不做二選一 UI）
      const target = S.selectedSeat;
      const choose = prompt("女巫：輸入 1=救(💊) / 2=毒(🧪) / 0=取消", "0");
      if(choose === "1"){
        S.logGod.push(`【女巫】💊 解藥：救 ${target}號`);
        S.seats[target].events.push("💊");
      }else if(choose === "2"){
        S.logGod.push(`【女巫】🧪 毒藥：毒 ${target}號`);
        S.seats[target].events.push("🧪");
      }else{
        S.logGod.push(`【女巫】本輪不使用藥`);
      }
    }
  }

  // next step
  S.selectedSeat = null;
  S.stepIndex += 1;

  if(S.stepIndex >= steps.length){
    // 夜晚結束
    endNightToDay();
    return;
  }

  saveState();
  renderAll();
}

/* ====== Announce ====== */
function renderAnnounce(){
  const showGod = !!toggleAnnGod.checked;
  const pub = S.log.join("\n\n");
  const god = S.logGod.join("\n");

  annText.textContent = showGod
    ? (pub + (god ? `\n\n—— 上帝詳細 ——\n${god}` : ""))
    : pub || "（尚無公告）";
}

/* ====== God View ====== */
function toggleGodView(){
  S.godView = !S.godView;
  saveState();
  renderAll();
}

/* ====== Dice ====== */
function rollDiceAlive(){
  const alive = [];
  for(let i=1;i<=S.n;i++){
    if(S.seats?.[i]?.alive) alive.push(i);
  }
  if(!alive.length) return null;
  return alive[randInt(0, alive.length-1)];
}

/* ====== Render All ====== */
function renderAll(){
  // top status
  const boardName = S.boardId || "—";
  setTop(`${S.phase} / day ${S.day} / step ${S.stepIndex+1}`, boardName);

  // setup card visible only in SETUP
  if(S.phase === "SETUP"){
    show(setupCard);
  }else{
    hide(setupCard);
  }

  // prompt
  renderPhasePrompt();

  // seats
  if(S.phase === "SETUP"){
    // SETUP 不顯示座位角色內容（但仍顯示格子不影響你操作習慣）
    // 你若想 SETUP 完全不顯示座位，可在此改成 seatsGrid.innerHTML=""
  }

  // 確保 seats exist（在 DEAL 之前也給空格）
  if(!S.seats || S.seats.length !== S.n+1){
    S.seats = Array(S.n+1).fill(null).map((_,i)=> i===0 ? null : ({
      no:i, role:null, camp:null, alive:true, death:null, events:[]
    }));
  }

  renderSeats();

  // buttons
  updateMainButtons();

  // DEAL：開始夜晚按鈕啟用條件
  if(S.phase === "DEAL"){
    btnMain.disabled = !canStartNight();
  }

  // announce text
  renderAnnounce();

  // 設定抽屜內注入配置 UI（不改HTML）
  injectRoleConfigUI();
}

/* ====== Bindings ====== */
function bindTopButtons(){
  btnAnn.onclick = ()=>openDrawer(annBackdrop, annDrawer);
  btnCloseAnn.onclick = ()=>closeDrawer(annBackdrop, annDrawer);
  annBackdrop.onclick = ()=>closeDrawer(annBackdrop, annDrawer);
  toggleAnnGod.onchange = renderAnnounce;

  btnSettings.onclick = ()=>openDrawer(setBackdrop, setDrawer);
  btnCloseSet.onclick = ()=>closeDrawer(setBackdrop, setDrawer);
  setBackdrop.onclick = ()=>closeDrawer(setBackdrop, setDrawer);

  btnEye.onclick = toggleGodView;

  btnDice.onclick = ()=>{
    const n = rollDiceAlive();
    alert(n ? `🎲 今日發言起點：${n}號` : "目前無存活座位");
  };

  // timer 按鈕先保留（你的 index 有 timerDrawer，但此版不接 timer）
  btnTimer.onclick = ()=>alert("⌛️ 計時器：此版先保留 UI（如要我可再把 timer 功能接回）");

  // win mode
  segEdge.onclick = ()=>{
    S.winMode="edge"; saveState();
    segEdge.classList.add("primary"); segCity.classList.remove("primary");
  };
  segCity.onclick = ()=>{
    S.winMode="city"; saveState();
    segCity.classList.add("primary"); segEdge.classList.remove("primary");
  };

  togglePolice.onchange = ()=>{
    S.hasPolice = !!togglePolice.checked;
    saveState();
    renderAll();
  };

  btnGotoSetup.onclick = ()=>{
    if(confirm("回到開局會結束目前遊戲並回到選板子。確定？")){
      S = structuredClone(DEFAULT_STATE);
      saveState();
      renderSetup();
      renderAll();
      closeDrawer(setBackdrop,setDrawer);
    }
  };

  btnHardReset.onclick = ()=>{
    if(confirm("清空所有資料（硬重置）？")){
      localStorage.removeItem(LS_KEY);
      location.reload();
    }
  };
}

function bindBottomButtons(){
  btnBack.onclick = ()=>{
    if(S.phase === "SETUP"){
      // no-op
      return;
    }
    if(S.phase === "DEAL"){
      // 回到 SETUP
      goSetup();
      return;
    }
    if(S.phase === "NIGHT"){
      // 退一步 step
      S.stepIndex = Math.max(0, S.stepIndex-1);
      S.selectedSeat = null;
      saveState();
      renderAll();
      return;
    }
    if(S.phase === "DAY"){
      // 回夜晚最後一步（視需要）
      S.phase="NIGHT";
      S.stepIndex = Math.max(0, buildNightSteps().length-1);
      saveState();
      renderAll();
      return;
    }
    if(S.phase === "VOTE"){
      // 回DAY
      S.phase="DAY";
      saveState();
      renderAll();
      return;
    }
  };

  btnMain.onclick = ()=>{
    if(S.phase === "DEAL"){
      startNight();
      return;
    }
    if(S.phase === "NIGHT"){
      endNightToDay();
      return;
    }
    if(S.phase === "DAY"){
      startVote();
      return;
    }
    if(S.phase === "VOTE"){
      endVote();
      return;
    }
  };

  btnNext.onclick = ()=>{
    if(S.phase === "SETUP"){
      // 進入 DEAL
      goDeal();
      return;
    }
    if(S.phase === "DEAL"){
      // 下一步：提醒玩家繼續看牌（此階段主要靠長按）
      alert("抽身分階段：請點座位後長按 0.3 秒看身分。全部看完後按「開始夜晚」。");
      return;
    }
    if(S.phase === "NIGHT"){
      confirmNightStep();
      return;
    }
    if(S.phase === "DAY"){
      // 可用下一步作為「進入夜晚」提示
      alert("白天流程中：請按「開始投票」進入投票統計。");
      return;
    }
    if(S.phase === "VOTE"){
      alert("投票中：請按「結束投票」進入下一夜。");
      return;
    }
  };
}

/* ====== Boot ====== */
function boot(){
  installIOSGuards();
  bindSeatClick();
  bindSeatLongPress();
  bindTopButtons();
  bindBottomButtons();

  // init setup view
  renderSetup();

  // sync UI toggles
  togglePolice.checked = !!S.hasPolice;
  if(S.winMode === "city"){
    segCity.classList.add("primary"); segEdge.classList.remove("primary");
  }else{
    segEdge.classList.add("primary"); segCity.classList.remove("primary");
  }

  renderAll();
}

boot();