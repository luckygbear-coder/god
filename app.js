/* =======================
   Werewolf God Helper v1.2
   - Fix iOS double-tap zoom / selection (best-effort)
   - Setup -> Deal -> Game
   - Boards with categories + custom config
   - Top buttons: Timer drawer / Dice / God eye / Announce / Settings
   - God eye: show roles + marks on seats
   - Longpress in DEAL => role modal
   - Longpress in GAME with God eye => admin modal (cause/marks)
======================= */

const $ = (id) => document.getElementById(id);

// --- iOS anti-zoom / anti-select (best-effort) ---
document.addEventListener("dblclick", (e)=>{ e.preventDefault(); }, {passive:false});
document.addEventListener("gesturestart", (e)=>{ e.preventDefault(); }, {passive:false});
let __lastTouchEnd = 0;
document.addEventListener("touchend", (e)=>{
  const now = Date.now();
  if(now - __lastTouchEnd <= 280){
    e.preventDefault(); // block double-tap zoom
  }
  __lastTouchEnd = now;
}, {passive:false});

document.addEventListener("contextmenu", (e)=> e.preventDefault());

// --- UI refs ---
const uiPhase = $("uiPhase");
const uiBoard = $("uiBoard");

const setupCard = $("setupCard");
const promptCard = $("promptCard");
const promptTitle = $("promptTitle");
const promptText = $("promptText");

const seatsWrap = $("seatsWrap");
const seatsGrid = $("seatsGrid");

const btnBack = $("btnBack");
const btnToggle = $("btnToggle");
const btnNext = $("btnNext");

const btnTimer = $("btnTimer");
const btnDice = $("btnDice");
const btnGodEye = $("btnGodEye");
const btnAnnounce = $("btnAnnounce");
const btnSettings = $("btnSettings");

// setup UI
const countChips = $("countChips");
const boardFilterChips = $("boardFilterChips");
const boardList = $("boardList");

const customConfig = $("customConfig");
const customWolves = $("customWolves");
const customTowns = $("customTowns");
const godChecks = $("godChecks");
const customSumHint = $("customSumHint");

// role modal
const roleModal = $("roleModal");
const roleTitle = $("roleTitle");
const roleBody = $("roleBody");
const btnRoleDone = $("btnRoleDone");
const btnRoleClose = $("btnRoleClose");

// admin modal
const adminModal = $("adminModal");
const adminTitle = $("adminTitle");
const adminAlive = $("adminAlive");
const adminCause = $("adminCause");
const adminMarks = $("adminMarks");
const btnAdminSave = $("btnAdminSave");
const btnAdminClose = $("btnAdminClose");

// dice modal
const diceModal = $("diceModal");
const diceResult = $("diceResult");
const btnDiceAgain = $("btnDiceAgain");
const btnDiceClose = $("btnDiceClose");

// drawers
const drawerBackdrop = $("drawerBackdrop");

const timerDrawer = $("timerDrawer");
const btnCloseTimer = $("btnCloseTimer");
const timerText = $("timerText");
const timerPresets = $("timerPresets");
const btnTimerStart = $("btnTimerStart");
const btnTimerPause = $("btnTimerPause");
const btnTimerReset = $("btnTimerReset");

const announceDrawer = $("announceDrawer");
const btnCloseAnnounce = $("btnCloseAnnounce");
const toggleAnnounceGod = $("toggleAnnounceGod");
const announceList = $("announceList");

const settingsDrawer = $("settingsDrawer");
const btnCloseSettings = $("btnCloseSettings");
const btnEndGame = $("btnEndGame");
const btnResetGame = $("btnResetGame");

// --- Data ---
const GOD_POOL = [
  {key:"預言家", label:"🔮 預言家"},
  {key:"女巫", label:"🧪 女巫"},
  {key:"獵人", label:"🔫 獵人"},
  {key:"守衛", label:"🛡️ 守衛"},
  {key:"白痴", label:"🤪 白痴"},
  {key:"邱比特", label:"💘 邱比特"},
  {key:"盜賊", label:"🗡️ 盜賊"},
];

const BOARDS = [
  // 12
  { id:"official-12", count:12, name:"12人官方標準局", desc:"4狼 + 預言家/女巫/獵人/守衛 + 4民", tags:["官方","屠邊","含白癡"], roles:["狼人","狼人","狼人","狼人","預言家","女巫","獵人","守衛","平民","平民","平民","平民"] },
  { id:"12-city", count:12, name:"12人（標準角色・屠城）", desc:"同標準角色，但勝負改屠城", tags:["測試","屠城"], roles:["狼人","狼人","狼人","狼人","預言家","女巫","獵人","守衛","平民","平民","平民","平民"] },
  { id:"12-edge-nopolice", count:12, name:"12人（屠邊・無上警）", desc:"同標準角色，但關閉上警", tags:["測試","無上警","屠邊"], roles:["狼人","狼人","狼人","狼人","預言家","女巫","獵人","守衛","平民","平民","平民","平民"] },
  // 10
  { id:"official-10", count:10, name:"10人官方標準局", desc:"3狼 + 預言家/女巫/獵人 + 4民", tags:["官方","屠邊"], roles:["狼人","狼人","狼人","預言家","女巫","獵人","平民","平民","平民","平民"] },
  { id:"10-noguard", count:10, name:"10人（無守衛）", desc:"3狼 + 預言家/女巫/獵人 + 4民", tags:["測試","屠邊"], roles:["狼人","狼人","狼人","預言家","女巫","獵人","平民","平民","平民","平民"] },
  // 9
  { id:"official-9", count:9, name:"9人官方標準局", desc:"3狼 + 預言家/女巫 + 4民", tags:["官方","屠邊"], roles:["狼人","狼人","狼人","預言家","女巫","平民","平民","平民","平民"] },

  // custom placeholder
  { id:"custom", count:0, name:"自訂配置（可調狼/神/民）", desc:"自由配置：狼人數/平民數/神職勾選", tags:["自訂"], roles:[] }
];

const MARKS = [
  {k:"🐺", t:"🐺狼刀"},
  {k:"💊", t:"💊解救"},
  {k:"🧪", t:"🧪中毒"},
  {k:"🛡️", t:"🛡️守護"},
  {k:"🔫", t:"🔫槍"},
  {k:"💥", t:"💥黑狼槍"},
  {k:"🦴", t:"🦴白狼爪"},
  {k:"🗳️", t:"🗳️放逐"},
];

const state = {
  phase: "SETUP",     // SETUP | DEAL | GAME
  playerCount: 12,
  boardId: "official-12",
  boardFilter: "全部",
  godEye: false,

  seats: [],          // {no, role, camp, alive, viewed, marks:Set, cause}
  selected: null,

  longPressTimer: null,

  // deal
  viewed: new Set(),

  // announce logs
  logs: [],           // {title, pub, god, ts}

  // timer
  timerSec: 90,
  timerLeft: 90,
  timerRunning: false,
  timerTick: null,

  // admin
  editingSeatNo: null,

  // announce
  announceShowGod: false,
};

// ---- persistence for timer (local only) ----
const TIMER_KEY = "ww_timer_v1";
function saveTimer(){
  const obj = {
    timerSec: state.timerSec,
    timerLeft: state.timerLeft,
    timerRunning: state.timerRunning,
    savedAt: Date.now()
  };
  localStorage.setItem(TIMER_KEY, JSON.stringify(obj));
}
function loadTimer(){
  try{
    const raw = localStorage.getItem(TIMER_KEY);
    if(!raw) return;
    const obj = JSON.parse(raw);
    state.timerSec = Number(obj.timerSec || 90);
    state.timerLeft = Number(obj.timerLeft || state.timerSec);
    state.timerRunning = Boolean(obj.timerRunning);
  }catch{}
}

// ---- helpers ----
const roleCamp = (role)=>{
  if(role==="狼人") return "狼";
  if(role==="平民") return "民";
  return "神";
};

function shuffle(arr){
  const a = [...arr];
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function fmtTime(sec){
  sec = Math.max(0, Math.floor(sec));
  const m = String(Math.floor(sec/60)).padStart(2,"0");
  const s = String(sec%60).padStart(2,"0");
  return `${m}:${s}`;
}

function pushLog(title, pub, god=""){
  state.logs.unshift({
    title,
    pub: pub || "",
    god: god || "",
    ts: new Date().toLocaleString("zh-Hant",{hour12:false})
  });
  renderAnnounce();
}

// ---- boards ----
function getBoard(){
  return BOARDS.find(b=>b.id===state.boardId) || BOARDS[0];
}

function buildCustomRoles(){
  const wolves = Number(customWolves.value || 0);
  const towns = Number(customTowns.value || 0);

  const gods = [];
  [...godChecks.querySelectorAll("input[type=checkbox]")].forEach(cb=>{
    if(cb.checked) gods.push(cb.dataset.role);
  });

  const total = wolves + towns + gods.length;
  const ok = (total === state.playerCount && wolves>=1);

  customSumHint.textContent = `目前總數：${total} / ${state.playerCount}（神職 ${gods.length}）` + (ok ? " ✅" : " ❗️");

  if(!ok) return null;

  const roles = [
    ...Array(wolves).fill("狼人"),
    ...gods,
    ...Array(towns).fill("平民")
  ];
  return roles;
}

function renderSetup(){
  // 人數 chips
  const counts = [9,10,12];
  countChips.innerHTML = "";
  counts.forEach(n=>{
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (state.playerCount===n ? " active":"");
    b.textContent = `${n}人`;
    b.onclick = ()=>{
      state.playerCount = n;
      // 如果目前板子不符合人數，切回第一個符合的
      const match = BOARDS.find(x=>x.count===n && x.id!=="custom");
      state.boardId = match ? match.id : "custom";
      renderSetup();
    };
    countChips.appendChild(b);
  });

  // 分類 chips
  const filters = ["全部","官方","測試","屠城","無上警","自訂"];
  boardFilterChips.innerHTML = "";
  filters.forEach(f=>{
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (state.boardFilter===f ? " active":"");
    b.textContent = f;
    b.onclick = ()=>{
      state.boardFilter = f;
      renderSetup();
    };
    boardFilterChips.appendChild(b);
  });

  // 板子列表（依人數 + 分類）
  const list = BOARDS.filter(b=>{
    if(b.id==="custom") return true; // 自訂永遠可見
    if(b.count !== state.playerCount) return false;
    if(state.boardFilter==="全部") return true;
    return b.tags.includes(state.boardFilter);
  }).filter(b=>{
    // 自訂在任何人數都能選，但顯示在列表底部
    if(b.id==="custom") return true;
    return true;
  });

  boardList.innerHTML = "";
  list.forEach(bd=>{
    const div = document.createElement("div");
    div.className = "boardItem" + (state.boardId===bd.id ? " active":"");
    const tagsHtml = bd.tags.map(t=>`<span class="tag">${t}</span>`).join("");
    div.innerHTML = `
      <div class="name">${bd.name}</div>
      <div class="sub">${bd.id} · ${bd.desc}</div>
      <div class="tags">${tagsHtml}</div>
    `;
    div.onclick = ()=>{
      state.boardId = bd.id;
      renderSetup();
    };
    boardList.appendChild(div);
  });

  // 自訂配置 UI 顯示
  const isCustom = (state.boardId==="custom");
  customConfig.classList.toggle("hidden", !isCustom);

  // 自訂初始化
  if(isCustom){
    // default values (fit count)
    if(!customWolves.value) customWolves.value = String(Math.max(1, Math.floor(state.playerCount/3)));
    if(!customTowns.value) customTowns.value = String(state.playerCount - Number(customWolves.value) - 2);

    // god checks
    if(!godChecks.dataset.inited){
      godChecks.dataset.inited = "1";
      GOD_POOL.forEach(r=>{
        const wrap = document.createElement("label");
        wrap.className = "checkItem";
        wrap.innerHTML = `
          <span>${r.label}</span>
          <input type="checkbox" data-role="${r.key}">
        `;
        godChecks.appendChild(wrap);
      });

      // default: 預言家/女巫/獵人/守衛 勾上（如果人數足夠）
      const defaults = ["預言家","女巫","獵人","守衛"];
      [...godChecks.querySelectorAll("input")].forEach(cb=>{
        cb.checked = defaults.includes(cb.dataset.role);
        cb.addEventListener("change", ()=> buildCustomRoles());
      });
    }
    customWolves.oninput = ()=> buildCustomRoles();
    customTowns.oninput = ()=> buildCustomRoles();
    buildCustomRoles();
  }

  // setup 按鈕
  btnBack.disabled = true;
  btnNext.disabled = true;
  btnToggle.textContent = "開始抽身分";
  btnToggle.disabled = false;

  uiPhase.textContent = "SETUP";
  uiBoard.textContent = getBoard().id;
}

// ---- phase UI ----
function setPhase(p){
  state.phase = p;
  uiPhase.textContent = p;
  uiBoard.textContent = getBoard().id;

  if(p==="SETUP"){
    setupCard.classList.remove("hidden");
    promptCard.classList.add("hidden");
    seatsWrap.classList.add("hidden");

    btnBack.disabled = true;
    btnNext.disabled = true;
    btnToggle.textContent = "開始抽身分";
    btnToggle.disabled = false;

    state.godEye = false;
    renderGodEyeBtn();
    return;
  }

  if(p==="DEAL"){
    setupCard.classList.add("hidden");
    promptCard.classList.remove("hidden");
    seatsWrap.classList.remove("hidden");

    promptTitle.textContent = "抽身分";
    promptText.textContent = "長按座位 0.3 秒查看身分。全部看完後，中間按鈕會變成「進入遊戲」。";

    btnBack.disabled = false;
    btnNext.disabled = false;
    btnToggle.textContent = "進入遊戲";

    renderSeats();
    updateDealToggle();
    return;
  }

  if(p==="GAME"){
    setupCard.classList.add("hidden");
    promptCard.classList.remove("hidden");
    seatsWrap.classList.remove("hidden");

    promptTitle.textContent = "遊戲中";
    promptText.textContent = "點座位可選取（再點取消）。👁️ 可切換上帝視角（顯示角色/陣營/事件標記）。";

    btnBack.disabled = false;
    btnNext.disabled = false;
    btnToggle.disabled = false;
    btnToggle.textContent = "天黑閉眼";

    renderSeats();
    return;
  }
}

function renderGodEyeBtn(){
  btnGodEye.style.opacity = state.godEye ? "1" : "0.75";
}

// ---- deal setup ----
function startDeal(){
  const board = getBoard();
  let roles = null;

  if(board.id==="custom"){
    roles = buildCustomRoles();
    if(!roles){
      alert("自訂配置總人數不符合，請調整狼人/平民/神職數量。");
      return;
    }
  }else{
    roles = [...board.roles];
  }

  // force match count
  if(roles.length !== state.playerCount){
    alert("板子角色數與人數不一致（請改用自訂或換板子）");
    return;
  }

  const shuffled = shuffle(roles);
  state.seats = shuffled.map((role, idx)=>({
    no: idx+1,
    role,
    camp: roleCamp(role),
    alive: true,
    marks: new Set(),
    cause: "",
  }));
  state.selected = null;
  state.viewed = new Set();
  state.godEye = false;
  renderGodEyeBtn();

  pushLog("開始抽身分", `人數：${state.playerCount}｜板子：${getBoard().id}`, `角色已洗牌完成`);

  setPhase("DEAL");
}

// ---- seat rendering ----
function seatMetaText(seat){
  if(state.phase==="DEAL"){
    if(state.godEye){
      return `${seat.role}（${seat.camp}）`;
    }
    return state.viewed.has(seat.no) ? "已看" : "未看";
  }

  // GAME
  if(state.godEye){
    const marks = [...seat.marks].join("");
    const cause = seat.cause ? `\n${seat.cause}` : "";
    return `${seat.role}（${seat.camp}）${marks ? "\n"+marks : ""}${cause}`;
  }

  return seat.alive ? "存活" : "死亡";
}

function renderSeats(){
  seatsGrid.innerHTML = state.seats.map(seat=>{
    const sel = (state.selected===seat.no) ? " selected" : "";
    return `
      <div class="seat${sel}" data-no="${seat.no}">
        <div class="no">${seat.no}號</div>
        <div class="meta">${seatMetaText(seat)}</div>
      </div>
    `;
  }).join("");
}

// ---- selection + longpress ----
seatsGrid.addEventListener("pointerdown", (e)=>{
  const seatEl = e.target.closest(".seat");
  if(!seatEl) return;
  const no = Number(seatEl.dataset.no);
  const seat = state.seats.find(s=>s.no===no);
  if(!seat) return;

  clearTimeout(state.longPressTimer);

  if(state.phase==="DEAL"){
    state.longPressTimer = setTimeout(()=> openRoleModal(seat), 300);
  }else if(state.phase==="GAME" && state.godEye){
    state.longPressTimer = setTimeout(()=> openAdminModal(seat), 350);
  }
});

seatsGrid.addEventListener("pointerup", (e)=>{
  clearTimeout(state.longPressTimer);
  const seatEl = e.target.closest(".seat");
  if(!seatEl) return;
  const no = Number(seatEl.dataset.no);

  // 點同一個 = 取消
  state.selected = (state.selected===no) ? null : no;
  renderSeats();
});

seatsGrid.addEventListener("pointercancel", ()=> clearTimeout(state.longPressTimer));
seatsGrid.addEventListener("contextmenu", (e)=> e.preventDefault());

// ---- Role Modal ----
function openRoleModal(seat){
  roleTitle.textContent = `${seat.no}號 身分`;
  roleBody.textContent = seat.role;
  roleModal.classList.remove("hidden");
  roleModal.setAttribute("aria-hidden","false");

  state.viewed.add(seat.no);
  updateDealToggle();
  renderSeats();
}

function closeRoleModal(){
  roleModal.classList.add("hidden");
  roleModal.setAttribute("aria-hidden","true");
}

btnRoleDone.onclick = closeRoleModal;
btnRoleClose.onclick = closeRoleModal;

// ---- Deal toggle state ----
function updateDealToggle(){
  const all = (state.viewed.size === state.playerCount);
  btnToggle.disabled = !all;
  if(all){
    btnToggle.textContent = "進入遊戲";
  }else{
    btnToggle.textContent = "進入遊戲";
  }
}

// ---- Admin Modal ----
function openAdminModal(seat){
  state.editingSeatNo = seat.no;
  adminTitle.textContent = `${seat.no}號（上帝操作）`;

  adminAlive.checked = seat.alive;
  adminCause.value = seat.cause || "";

  adminMarks.innerHTML = "";
  MARKS.forEach(m=>{
    const b = document.createElement("button");
    b.type = "button";
    b.className = "markBtn" + (seat.marks.has(m.k) ? " active" : "");
    b.textContent = m.t;
    b.onclick = ()=>{
      if(seat.marks.has(m.k)) seat.marks.delete(m.k);
      else seat.marks.add(m.k);
      b.classList.toggle("active");
    };
    adminMarks.appendChild(b);
  });

  adminModal.classList.remove("hidden");
  adminModal.setAttribute("aria-hidden","false");
}

function closeAdminModal(){
  adminModal.classList.add("hidden");
  adminModal.setAttribute("aria-hidden","true");
  state.editingSeatNo = null;
}

btnAdminClose.onclick = closeAdminModal;

btnAdminSave.onclick = ()=>{
  const no = state.editingSeatNo;
  const seat = state.seats.find(s=>s.no===no);
  if(!seat) return closeAdminModal();

  seat.alive = Boolean(adminAlive.checked);
  seat.cause = adminCause.value || "";

  // 如果死亡，座位上帝視角會看到原因；非上帝視角仍只顯示存活/死亡
  renderSeats();

  pushLog(
    `更新 ${no}號 狀態`,
    `（公開）${no}號：${seat.alive ? "存活" : "死亡"}`,
    `（上帝）${no}號：${seat.role}｜標記：${[...seat.marks].join("") || "無"}｜原因：${seat.cause || "無"}`
  );

  closeAdminModal();
};

// ---- Top Buttons ----
btnGodEye.onclick = ()=>{
  if(state.phase==="SETUP") return;
  state.godEye = !state.godEye;
  renderGodEyeBtn();
  renderSeats();
};

btnDice.onclick = ()=>{
  if(state.phase==="SETUP") return;
  openDice();
};

btnAnnounce.onclick = ()=>{
  openDrawer("announce");
};

btnSettings.onclick = ()=>{
  openDrawer("settings");
};

btnTimer.onclick = ()=>{
  openDrawer("timer");
};

// ---- Dice Modal ----
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
  const alive = state.seats.filter(s=>s.alive).map(s=>s.no);
  if(!alive.length){
    diceResult.textContent = "（無存活座位）";
    return;
  }
  const pick = alive[Math.floor(Math.random()*alive.length)];
  diceResult.textContent = `${pick}號`;
}

btnDiceAgain.onclick = rollDice;
btnDiceClose.onclick = closeDice;

// ---- Drawers (timer/announce/settings) ----
function openDrawer(which){
  drawerBackdrop.classList.remove("hidden");

  timerDrawer.classList.add("hidden");
  announceDrawer.classList.add("hidden");
  settingsDrawer.classList.add("hidden");

  if(which==="timer") timerDrawer.classList.remove("hidden");
  if(which==="announce") announceDrawer.classList.remove("hidden");
  if(which==="settings") settingsDrawer.classList.remove("hidden");
}

function closeDrawer(){
  drawerBackdrop.classList.add("hidden");
  timerDrawer.classList.add("hidden");
  announceDrawer.classList.add("hidden");
  settingsDrawer.classList.add("hidden");
}

drawerBackdrop.onclick = closeDrawer;
btnCloseTimer.onclick = closeDrawer;
btnCloseAnnounce.onclick = closeDrawer;
btnCloseSettings.onclick = closeDrawer;

// ---- Announce rendering ----
toggleAnnounceGod.onchange = ()=>{
  state.announceShowGod = toggleAnnounceGod.checked;
  renderAnnounce();
};

function renderAnnounce(){
  toggleAnnounceGod.checked = state.announceShowGod;

  announceList.innerHTML = "";
  if(!state.logs.length){
    const div = document.createElement("div");
    div.className = "announceItem";
    div.innerHTML = `<div class="t">尚無公告</div><div class="b">開始遊戲後會自動累積回顧。</div>`;
    announceList.appendChild(div);
    return;
  }

  state.logs.forEach(item=>{
    const div = document.createElement("div");
    div.className = "announceItem";
    const body = state.announceShowGod
      ? `${item.pub}\n\n${item.god ? item.god : ""}\n\n⏱ ${item.ts}`
      : `${item.pub}\n\n⏱ ${item.ts}`;
    div.innerHTML = `<div class="t">${item.title}</div><div class="b">${body.trim()}</div>`;
    announceList.appendChild(div);
  });
}

// ---- Settings actions ----
btnEndGame.onclick = ()=>{
  // 回到 SETUP（保留你上次選的人數/板子/自訂）
  pushLog("結束遊戲", "（公開）本局已結束", "（上帝）回到選板子");
  state.seats = [];
  state.viewed = new Set();
  state.selected = null;
  state.godEye = false;
  renderGodEyeBtn();
  closeDrawer();
  renderSetup();
  setPhase("SETUP");
};

btnResetGame.onclick = ()=>{
  // 重置本局但保留板子（回到 DEAL 前的 SETUP 也行；這裡回到 SETUP 比較安全）
  pushLog("重置本局", "（公開）本局已重置", "（上帝）保留板子設定");
  state.seats = [];
  state.viewed = new Set();
  state.selected = null;
  state.godEye = false;
  renderGodEyeBtn();
  closeDrawer();
  renderSetup();
  setPhase("SETUP");
};

// ---- Timer Drawer ----
function renderTimer(){
  timerText.textContent = fmtTime(state.timerLeft);
}

function stopTimerTick(){
  if(state.timerTick){
    clearInterval(state.timerTick);
    state.timerTick = null;
  }
}

function startTimerTick(){
  stopTimerTick();
  state.timerRunning = true;
  state.timerTick = setInterval(()=>{
    state.timerLeft -= 1;
    if(state.timerLeft <= 0){
      state.timerLeft = 0;
      state.timerRunning = false;
      stopTimerTick();
      // 震動提示（支援則振）
      if(navigator.vibrate) navigator.vibrate([150,80,150,80,200]);
    }
    renderTimer();
    saveTimer();
  }, 1000);
  saveTimer();
}

function pauseTimer(){
  state.timerRunning = false;
  stopTimerTick();
  saveTimer();
}

function resetTimer(){
  state.timerLeft = state.timerSec;
  renderTimer();
  saveTimer();
}

function buildTimerPresets(){
  const presets = [
    {sec:30, t:"30秒"},
    {sec:60, t:"1分鐘"},
    {sec:90, t:"1分半"},
    {sec:120, t:"2分鐘"},
    {sec:180, t:"3分鐘"},
    {sec:300, t:"5分鐘"},
  ];
  timerPresets.innerHTML = "";
  presets.forEach(p=>{
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = p.t;
    b.onclick = ()=>{
      state.timerSec = p.sec;
      state.timerLeft = p.sec;
      renderTimer();
      saveTimer();
    };
    timerPresets.appendChild(b);
  });
}

btnTimerStart.onclick = ()=>{
  if(state.timerLeft <= 0) state.timerLeft = state.timerSec;
  startTimerTick();
};
btnTimerPause.onclick = pauseTimer;
btnTimerReset.onclick = ()=>{ pauseTimer(); resetTimer(); };

// ---- Bottom buttons (3 key) ----
btnToggle.onclick = ()=>{
  if(state.phase==="SETUP"){
    startDeal();
    return;
  }
  if(state.phase==="DEAL"){
    if(btnToggle.disabled) return;
    setPhase("GAME");
    pushLog("進入遊戲", "（公開）遊戲開始", "（上帝）可用 👁️ 檢視角色");
    return;
  }
  if(state.phase==="GAME"){
    // 重要流程切換（最小可用版）
    const now = btnToggle.textContent;
    const next = (now==="天黑閉眼") ? "天亮睜眼"
              : (now==="天亮睜眼") ? "開始投票"
              : "天黑閉眼";
    btnToggle.textContent = next;

    // log
    pushLog(`流程：${next}`, `（公開）${next}`, `（上帝）目前可用長按座位設定事件標記/死亡原因`);
  }
};

btnBack.onclick = ()=>{
  if(state.phase==="DEAL"){
    setPhase("SETUP");
    return;
  }
  if(state.phase==="GAME"){
    pushLog("上一步", "（公開）上一步", "（上帝）此版先保留為提示，下一版再接完整回退流程");
    promptTitle.textContent = "提示";
    promptText.textContent = "你按了上一步（下一版我會把完整夜/日流程與回退堆疊補上）。";
  }
};

btnNext.onclick = ()=>{
  if(state.phase==="DEAL"){
    promptTitle.textContent = "抽身分";
    promptText.textContent = "長按座位 0.3 秒查看身分。全部看完後按「進入遊戲」。";
    return;
  }
  if(state.phase==="GAME"){
    pushLog("下一步", "（公開）下一步", "（上帝）此版先保留為提示，下一版再接完整流程推進");
    promptTitle.textContent = "提示";
    promptText.textContent = "你按了下一步（下一版我會把完整夜/日流程推進補上）。";
  }
};

// ---- boot ----
function boot(){
  // timer
  loadTimer();
  buildTimerPresets();
  renderTimer();
  if(state.timerRunning){
    // 安全起見，重新開啟 tick（不補償離線秒數）
    startTimerTick();
  }

  // init god checks UI
  GOD_POOL.forEach(r=>{
    // already rendered lazily in renderSetup custom init
  });

  // init logs UI
  renderAnnounce();

  // setup screen
  renderSetup();
  setPhase("SETUP");
}

boot();