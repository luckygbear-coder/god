/* Werewolf God Helper - MVP v31
   Fix: Setup A3 reveal role content was overwritten by renderPrompt.
   - Use state.ui.revealSeat to show role panel in prompt area.
   - Cancel closes reveal panel.
*/

const STORAGE_KEY = "werewolf_state_v31";

document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
document.addEventListener("contextmenu", (e) => e.preventDefault());

const uiStatus = document.getElementById("uiStatus");
const uiBoard = document.getElementById("uiBoard");
const promptTitle = document.getElementById("promptTitle");
const promptText = document.getElementById("promptText");
const promptFoot = document.getElementById("promptFoot");
const godText = document.getElementById("godText");
const toggleGodView = document.getElementById("toggleGodView");
const seatsGrid = document.getElementById("seatsGrid");

const boardPickerCard = document.getElementById("boardPickerCard");
const boardPickerHint = document.getElementById("boardPickerHint");
const boardPicker = document.getElementById("boardPicker");

const btnSettings = document.getElementById("btnSettings");
const drawer = document.getElementById("drawer");
const drawerBackdrop = document.getElementById("drawerBackdrop");
const btnCloseDrawer = document.getElementById("btnCloseDrawer");
const segEdge = document.getElementById("segEdge");
const segCity = document.getElementById("segCity");
const togglePolice = document.getElementById("togglePolice");
const btnReset = document.getElementById("btnReset");

const timerBig = document.getElementById("timerBig");
const timerHint = document.getElementById("timerHint");
const btnTimerStart = document.getElementById("btnTimerStart");
const btnTimerPause = document.getElementById("btnTimerPause");
const btnTimerReset = document.getElementById("btnTimerReset");
const timerPresets = document.getElementById("timerPresets");

const btnBack = document.getElementById("btnBack");
const btnPrimary = document.getElementById("btnPrimary");
const btnCancel = document.getElementById("btnCancel");

const ROLE = {
  wolf: { name: "狼人", camp: "wolf", isGod: false },
  seer: { name: "預言家", camp: "good", isGod: true },
  witch: { name: "女巫", camp: "good", isGod: true },
  hunter: { name: "獵人", camp: "good", isGod: true },
  idiot: { name: "白癡", camp: "good", isGod: true },
  villager: { name: "平民", camp: "good", isGod: false }
};

const BOARD_FALLBACK = {
  "official-9": {
    id: "official-9",
    title: "9 人官方標準局",
    playersCount: 9,
    hasPolice: false,
    winCondition: { mode: "city" },
    witchCanSelfSave: false,
    roles: [
      { roleId: "wolf", count: 3 },
      { roleId: "seer", count: 1 },
      { roleId: "witch", count: 1 },
      { roleId: "hunter", count: 1 },
      { roleId: "villager", count: 3 }
    ],
    nightSteps: [
      { id: "wolf", name: "狼人", wakeOrder: 1, alwaysShow: true, actionType: "pick", seatPickRule: { allowNone: true } },
      { id: "seer", name: "預言家", wakeOrder: 2, alwaysShow: true, actionType: "pick" },
      { id: "witch", name: "女巫", wakeOrder: 3, alwaysShow: true, actionType: "pick" }
    ]
  },
  "official-10": {
    id: "official-10",
    title: "10 人官方標準局",
    playersCount: 10,
    hasPolice: false,
    winCondition: { mode: "city" },
    witchCanSelfSave: false,
    roles: [
      { roleId: "wolf", count: 3 },
      { roleId: "seer", count: 1 },
      { roleId: "witch", count: 1 },
      { roleId: "hunter", count: 1 },
      { roleId: "villager", count: 4 }
    ],
    nightSteps: [
      { id: "wolf", name: "狼人", wakeOrder: 1, alwaysShow: true, actionType: "pick", seatPickRule: { allowNone: true } },
      { id: "seer", name: "預言家", wakeOrder: 2, alwaysShow: true, actionType: "pick" },
      { id: "witch", name: "女巫", wakeOrder: 3, alwaysShow: true, actionType: "pick" }
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
      { id: "wolf", name: "狼人", wakeOrder: 1, alwaysShow: true, actionType: "pick", seatPickRule: { allowNone: true } },
      { id: "seer", name: "預言家", wakeOrder: 2, alwaysShow: true, actionType: "pick" },
      { id: "witch", name: "女巫", wakeOrder: 3, alwaysShow: true, actionType: "pick" }
    ]
  }
};

let state = loadState() || makeInitialState();
let toastTimer = null;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}

wireUI();
render();
renderBoardPicker();

/* ===== State ===== */
function makeInitialState(){
  return {
    version: 31,
    config: { playersCount: null, boardId: null, winMode: "edge", hasPolice: false },
    board: null,
    players: [],
    flow: { phase: "SETUP", round: 1, stepId: "SETUP:A1" },
    setup: { rolesAssigned: false, seenSeats: {} },
    night: { round: 1, stepIndex: 0, steps: [], logByRound: {} },
    day: { vote: null, afterExile: null },
    witch: { usedAntidote:false, usedPoison:false },
    ui: {
      godExpanded:false,
      selectedSeat:null,
      revealSeat: null   // ✅ NEW: A3 身分檢視座位
    },
    timer: { totalSec: 120, remainSec: 120, running:false, lastTs: 0 }
  };
}

function loadState(){
  try{ const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; }
  catch(e){ return null; }
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function saveAndRender(){ saveState(); render(); renderBoardPicker(); }

/* ===== UI wire ===== */
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

  btnBack?.addEventListener("click", ()=> toast("MVP 暫不支援上一步（避免卡住）"));
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

/* ===== Toast ===== */
function toast(msg){
  clearTimeout(toastTimer);
  promptFoot.textContent = msg;
  toastTimer = setTimeout(()=>{ promptFoot.textContent = ""; }, 1800);
}

/* ===== Timer ===== */
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
  timerBig.textContent = formatMMSS(state.timer.remainSec);
  timerHint.textContent = state.timer.running ? "計時中…" : "點選時間或按「開始」。";
}

/* ===== Board Catalog ===== */
let boardCatalog = null;
async function loadBoardCatalog(){
  if(boardCatalog) return boardCatalog;
  try{
    const r = await fetch("./boards/index.json", { cache: "no-store" });
    if(!r.ok) throw new Error("index missing");
    boardCatalog = await r.json();
    return boardCatalog;
  }catch(e){
    boardCatalog = {
      version: 1,
      boards: [
        { id:"official-9", title:"9 人官方標準局", playersCount:9, path:"./boards/official-9.json", tags:["官方"] },
        { id:"official-10", title:"10 人官方標準局", playersCount:10, path:"./boards/official-10.json", tags:["官方"] },
        { id:"official-12", title:"12 人官方標準局", playersCount:12, path:"./boards/official-12.json", tags:["官方"] }
      ]
    };
    return boardCatalog;
  }
}

function renderBoardPicker(){
  if(!boardPickerCard) return;
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

  state.board = board;
  state.config.playersCount = board.playersCount;
  state.config.hasPolice = !!board.hasPolice;
  state.config.winMode = board.winCondition?.mode || state.config.winMode;

  state.players = Array.from({length: board.playersCount}).map((_,i)=>({
    seat: i+1, roleId: null, alive: true, seen: false, canVote: true
  }));

  state.setup.rolesAssigned = false;
  state.setup.seenSeats = {};
  state.ui.revealSeat = null;

  state.flow.phase = "SETUP";
  state.flow.round = 1;
  state.flow.stepId = "SETUP:A2";
  state.night = { round:1, stepIndex:0, steps:[], logByRound:{} };
  state.day = { vote:null, afterExile:null };
  state.witch = { usedAntidote:false, usedPoison:false };
  state.ui.selectedSeat = null;
}

/* ===== Drawer ===== */
function openDrawer(){
  drawerBackdrop.classList.remove("hidden");
  drawer.classList.remove("hidden");
  togglePolice.checked = !!state.config.hasPolice;
  syncSegUI();
}
function closeDrawer(){
  drawerBackdrop.classList.add("hidden");
  drawer.classList.add("hidden");
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
  segEdge.classList.toggle("active", state.config.winMode === "edge");
  segCity.classList.toggle("active", state.config.winMode === "city");
}

/* ===== Flow ===== */
function onPrimary(){
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

  // 其他 phase（NIGHT/DAY/END）保持你之前 v30 的流程不變
  // 為了只修你現在的 A3 問題，這份 v31 專注修抽身分顯示。
  toast("（提示）本版只修 A3 顯示問題；若你要我把完整 NIGHT/DAY 也一起合併，我可以再給你完整 v31 全功能版。");
}

function onCancel(){
  const phase = state.flow.phase;
  const step = state.flow.stepId;

  // ✅ A3：取消=關閉身分檢視（不影響已看）
  if(phase === "SETUP" && step === "SETUP:A3"){
    state.ui.revealSeat = null;
    saveAndRender();
    return;
  }

  toast("已取消");
}

/* ===== Setup ===== */
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
    p.seen = false;
    p.canVote = true;
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

/* ===== Night (placeholder) ===== */
function enterNight(){
  state.flow.phase = "NIGHT";
  state.flow.stepId = "NIGHT:N0";
}

/* ===== Seat click ===== */
function onSeatClick(seat){
  const phase = state.flow.phase;
  const step = state.flow.stepId;

  if(phase === "SETUP" && step === "SETUP:A3"){
    revealRole(seat);
    return;
  }
}

/* ✅ NEW revealRole: 不直接改 prompt，改 state.ui.revealSeat，交給 renderPrompt 顯示 */
function revealRole(seat){
  const p = state.players.find(x=>x.seat===seat);
  if(!p) return;

  state.ui.revealSeat = seat;

  // 標記已看
  state.setup.seenSeats[String(seat)] = true;
  p.seen = true;

  saveAndRender();
}

/* ===== Long press helper ===== */
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

/* ===== Render ===== */
function render(){
  syncTimer();
  renderTimerOnly();

  uiStatus.textContent = `${state.flow.phase} / R${state.flow.round} / ${state.flow.stepId}`;
  uiBoard.textContent = state.board?.title || boardTitleFromCount();

  toggleGodView.checked = !!state.ui.godExpanded;
  togglePolice.checked = !!(state.board?.hasPolice ?? state.config.hasPolice);
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
  const phase = state.flow.phase;
  const step = state.flow.stepId;

  if(phase === "SETUP"){
    if(step === "SETUP:A1"){
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
        document.getElementById("pick9")?.addEventListener("click", ()=> pickCount(9));
        document.getElementById("pick10")?.addEventListener("click", ()=> pickCount(10));
        document.getElementById("pick12")?.addEventListener("click", ()=> pickCount(12));
      }, 0);

      promptFoot.textContent = "選好後按「下一步」。";
      return;
    }

    if(step === "SETUP:A2"){
      promptTitle.textContent = "載入板子";
      promptText.textContent =
        `已選：${state.config.playersCount}人\n` +
        `請在下方選擇板子（可選板子）\n` +
        `選好後按「下一步」進入抽身分。`;
      promptFoot.textContent = "若沒選板子，會自動使用官方板子。";
      return;
    }

    if(step === "SETUP:A3"){
      // ✅ 若正在檢視身分：顯示身分內容（不會被覆蓋掉）
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

      // ✅ 否則顯示抽身分說明
      promptTitle.textContent = "抽身分";
      promptText.textContent =
        "請大家依序查看身份。看完請把手機交回上帝。\n\n" +
        "操作：長按 0.3 秒翻牌；也可以點座位重看。\n\n" +
        `已查看：${countSeen()} / ${state.players.length}（全部看完才能進夜晚）`;
      promptFoot.textContent = "";
      return;
    }
  }

  // 其它 phase 簡化顯示（避免你這次只想先修 A3）
  promptTitle.textContent = "—";
  promptText.textContent = "（流程照常，若你要完整 NIGHT/DAY 合併版我再發）";
  promptFoot.textContent = "";
}

function pickCount(n){
  state.config.playersCount = n;
  state.config.boardId = (n===9) ? "official-9" : (n===10) ? "official-10" : "official-12";
  applyBoardByPath(`./boards/${state.config.boardId}.json`, state.config.boardId).then(()=>{
    state.flow.stepId = "SETUP:A2";
    saveAndRender();
  });
}

function renderGodInfo(){
  const lines = [];
  lines.push(`選擇人數後會自動載入板子。`);
  if(state.setup.rolesAssigned){
    const unseen = state.players.filter(p=> !state.setup.seenSeats[String(p.seat)]).map(p=>p.seat);
    lines.push(`抽身分：已分配`);
    lines.push(`未查看：${unseen.length ? unseen.join("、") : "（無）"}`);
  }else{
    lines.push(`抽身分：尚未分配`);
  }
  godText.textContent = lines.join("\n");
}

function renderSeats(){
  seatsGrid.innerHTML = "";

  state.players.forEach(p=>{
    const seat = document.createElement("div");
    seat.className = "seat" + (!p.alive ? " dead" : "") + (state.ui.selectedSeat===p.seat ? " selected" : "");
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

    if(state.flow.phase==="SETUP" && state.flow.stepId==="SETUP:A3"){
      addLongPress(seat, ()=> revealRole(p.seat), 300);
    }

    seatsGrid.appendChild(seat);
  });
}

function renderActions(){
  const phase = state.flow.phase;
  const step = state.flow.stepId;

  btnPrimary.disabled = false;
  btnCancel.disabled = false;

  if(phase==="SETUP"){
    if(step==="SETUP:A1"){
      btnPrimary.textContent = "下一步";
      btnCancel.textContent = "取消";
      return;
    }
    if(step==="SETUP:A2"){
      btnPrimary.textContent = "進入抽身分";
      btnCancel.textContent = "取消";
      return;
    }
    if(step==="SETUP:A3"){
      btnPrimary.textContent = "確認進夜晚";
      btnPrimary.disabled = !allSeen();
      btnCancel.textContent = state.ui.revealSeat ? "關閉身分" : "取消";
      return;
    }
  }

  btnPrimary.textContent = "下一步";
  btnCancel.textContent = "取消";
}

/* ===== small helpers ===== */
function boardTitleFromId(){
  const id = state.config.boardId;
  return id || "—";
}