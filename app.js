/* =========================
   狼人殺上帝輔助（MVP）
   ✅ SETUP 不顯示座位
   ✅ 板子點選變色
   ✅ 進入 DEAL 才顯示座位
   ✅ 長按 0.3s 翻牌
   ✅ 👁️ 上帝視角：座位顯示陣營/角色/標記 + 抽屜
   ✅ 底部按鈕固定
   ✅ 禁止 iOS 長按選取/放大（搭配 CSS + 事件）
========================= */

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

/* ========== iOS 防選字/長按選單/雙擊放大 ========== */
document.addEventListener("contextmenu", (e) => e.preventDefault(), { passive:false });

let lastTouchEnd = 0;
document.addEventListener("touchend", (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) e.preventDefault();
  lastTouchEnd = now;
}, { passive:false });

/* ========== DOM ========== */
const uiStatus = $("#uiStatus");
const uiBoard  = $("#uiBoard");

const promptTitle = $("#promptTitle");
const promptText  = $("#promptText");
const promptFoot  = $("#promptFoot");

const setupArea = $("#setupArea");
const seatsArea = $("#seatsArea");
const seatsGrid = $("#seatsGrid");
const seatHint  = $("#seatHint");

const boardPicker = $("#boardPicker");
const peopleChips = $("#peopleChips");

const btnBack = $("#btnBack");
const btnPrimary = $("#btnPrimary");
const btnCancel = $("#btnCancel");

const backdrop = $("#backdrop");

/* drawers */
const btnHourglass = $("#btnHourglass");
const drawerTimer = $("#drawerTimer");
const btnCloseTimer = $("#btnCloseTimer");
const timerBig = $("#timerBig");
const btnTimerStart = $("#btnTimerStart");
const btnTimerPause = $("#btnTimerPause");
const btnTimerReset = $("#btnTimerReset");

const btnGodEye = $("#btnGodEye");
const drawerGod = $("#drawerGod");
const btnCloseGod = $("#btnCloseGod");
const toggleGodEye = $("#toggleGodEye");
const godText = $("#godText");
const godSummary = $("#godSummary");

const btnSettings = $("#btnSettings");
const drawerSettings = $("#drawerSettings");
const btnCloseSettings = $("#btnCloseSettings");
const btnGoSetup = $("#btnGoSetup");
const btnEndGame = $("#btnEndGame");

/* role modal */
const roleModal = $("#roleModal");
const roleModalTitle = $("#roleModalTitle");
const roleModalRole = $("#roleModalRole");
const roleModalCamp = $("#roleModalCamp");
const btnRoleDone = $("#btnRoleDone");
const btnRoleClose = $("#btnRoleClose");

/* ========== Boards (可自行擴充) ========== */
const BOARDS = {
  "official-12": {
    id:"official-12",
    title:"12 人官方標準局",
    subtitle:"4狼 + 預言家/女巫/守衛/獵人 + 4民",
    tags:["官方","穩","含白癡"],
    people:12,
    roles:["狼","狼","狼","狼","預言家","女巫","守衛","獵人","白癡","民","民","民"]
  },
  "12-city": {
    id:"12-city",
    title:"12 人（標準角色・屠城）",
    subtitle:"同標準角色，但勝負改屠城",
    tags:["測試","屠城"],
    people:12,
    roles:["狼","狼","狼","狼","預言家","女巫","守衛","獵人","白癡","民","民","民"],
    winMode:"city"
  },
  "12-edge-nopolice": {
    id:"12-edge-nopolice",
    title:"12 人（屠邊・無上警）",
    subtitle:"同標準角色，但關閉上警",
    tags:["測試","無上警"],
    people:12,
    roles:["狼","狼","狼","狼","預言家","女巫","守衛","獵人","白癡","民","民","民"],
    hasPolice:false
  }
};

/* ========== State ========== */
const STORAGE_KEY = "werewolf_god_mvp_v1";

const State = {
  phase: "SETUP",      // SETUP | DEAL | PLAY
  people: 12,
  boardId: "official-12",
  godEye: false,
  selectedSeat: null,
  seats: [],           // {no, alive, role, camp, revealed, marks: {death,rescue,healUse,poisonUse}}
  timer: {sec:90, running:false, endAt:null, left:90, tick:null}
};

function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(State)); }
function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return;
    const obj = JSON.parse(raw);
    Object.assign(State, obj);
  }catch(e){}
}

/* ========== Utils ========== */
function campOf(role){
  if(["狼","白狼王","黑狼王"].includes(role)) return "狼";
  if(["民"].includes(role)) return "民";
  return "神";
}
function shuffle(arr){
  const a = arr.slice();
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
function vibrate(ms){
  try{ if(navigator.vibrate) navigator.vibrate(ms); }catch(e){}
}

/* ========== Render Setup ========== */
function renderSetup(){
  boardPicker.innerHTML = "";
  const list = Object.values(BOARDS).filter(b => b.people === State.people);
  list.forEach(b=>{
    const el = document.createElement("button");
    el.type="button";
    el.className = "boardCard" + (State.boardId===b.id ? " selected" : "");
    el.innerHTML = `
      <div class="boardTitle">${b.title}</div>
      <div class="boardSub">${b.id} ・ ${b.subtitle}</div>
      <div class="tagRow">${(b.tags||[]).map(t=>`<span class="tag">${t}</span>`).join("")}</div>
    `;
    el.addEventListener("click", ()=>{
      State.boardId = b.id;
      // ✅ 選中立刻變色
      renderSetup();
      updateTop();
      save();
    });
    boardPicker.appendChild(el);
  });

  // chips selected
  $$("#peopleChips .chip").forEach(ch=>{
    const n = Number(ch.dataset.n);
    ch.classList.toggle("selected", n===State.people);
  });
}

/* ========== Seats ========== */
function buildSeats(){
  const b = BOARDS[State.boardId];
  const roles = shuffle(b.roles);

  State.seats = [];
  for(let i=1;i<=State.people;i++){
    const role = roles[i-1];
    State.seats.push({
      no:i,
      alive:true,
      role,
      camp: campOf(role),
      revealed:false,
      marks:{
        death:null,      // wolf/poison/gun/black/white
        rescue:false,
        healUse:false,
        poisonUse:false
      }
    });
  }
}

function seatMetaText(seat){
  const m = seat.marks;
  const parts = [];
  if(State.godEye){
    parts.push(`${seat.camp}｜${seat.role}`);
  }
  if(m.death){
    const map = {wolf:"狼刀", poison:"毒死", gun:"槍殺", black:"黑狼槍", white:"白狼爪"};
    parts.push(`☠️${map[m.death]||m.death}`);
  }
  if(m.rescue) parts.push("💊被救");
  if(m.healUse) parts.push("💊解藥");
  if(m.poisonUse) parts.push("🧪毒藥");
  return parts.join(" · ");
}

function renderSeats(){
  seatsGrid.innerHTML = "";
  for(const seat of State.seats){
    const btn = document.createElement("button");
    btn.type="button";
    btn.className = "seat"
      + (seat.no===State.selectedSeat ? " selected" : "")
      + (!seat.alive ? " dead" : "");

    btn.innerHTML = `
      <div class="seatNum">${seat.no}號</div>
      <div class="seatState">${seat.alive ? "存活" : "死亡"}</div>
      <div class="seatMeta">${seatMetaText(seat)}</div>
    `;

    // tap select (顏色要變明顯)
    btn.addEventListener("click", ()=>{
      State.selectedSeat = seat.no;
      renderSeats();
      save();
    });

    // long press 0.3s (only in DEAL)
    attachLongPress(btn, 300, ()=>{
      if(State.phase !== "DEAL") return;
      openRoleModal(seat.no);
    });

    seatsGrid.appendChild(btn);
  }

  renderGodText();
}

/* ========== Long press helper ========== */
function attachLongPress(el, ms, onFire){
  let t = null;
  let moved = false;

  const clear = ()=>{
    if(t) clearTimeout(t);
    t = null;
    moved = false;
  };

  el.addEventListener("pointerdown", (e)=>{
    moved = false;
    t = setTimeout(()=>{ if(!moved) onFire(); }, ms);
  });

  el.addEventListener("pointermove", ()=>{ moved = true; clear(); });
  el.addEventListener("pointerup", clear);
  el.addEventListener("pointercancel", clear);
  el.addEventListener("pointerleave", clear);
}

/* ========== Role modal ========== */
function openRoleModal(no){
  const seat = State.seats.find(s=>s.no===no);
  if(!seat) return;

  seat.revealed = true; // 已查看（可用於你的「全部看完才能下一步」邏輯）
  roleModalTitle.textContent = `${no}號 身分`;
  roleModalRole.textContent  = seat.role;
  roleModalCamp.textContent  = `陣營：${seat.camp}`;
  roleModal.classList.remove("hidden");
  roleModal.setAttribute("aria-hidden","false");
  save();
}

function closeRoleModal(){
  roleModal.classList.add("hidden");
  roleModal.setAttribute("aria-hidden","true");
}

/* ========== God drawer / godEye ========== */
function renderGodText(){
  const b = BOARDS[State.boardId];
  const aliveWolf = State.seats.filter(s=>s.alive && s.camp==="狼").length;
  const aliveGood = State.seats.filter(s=>s.alive && s.camp!=="狼").length;

  const healUsed = State.seats.some(s=>s.marks.healUse);
  const poisonUsed = State.seats.some(s=>s.marks.poisonUse);

  const lines = [];
  lines.push(`人數：${State.people}`);
  lines.push(`板子：${b?.id || State.boardId}`);
  lines.push(`階段：${State.phase}`);
  lines.push(`存活：狼 ${aliveWolf} / 好 ${aliveGood}`);
  lines.push(`女巫：解藥${healUsed?"已用":"可用"} / 毒藥${poisonUsed?"已用":"可用"}`);
  lines.push("");
  lines.push("座位摘要（👁️ 開啟時座位會直接顯示角色/標記）：");
  for(const s of State.seats){
    const meta = seatMetaText(s);
    lines.push(`${s.no}：${s.alive?"存活":"死亡"}${meta?`｜${meta}`:""}`);
  }

  godText.textContent = lines.join("\n");
  godSummary.textContent = lines.slice(0, 6).join("\n") + "\n（按 👁️ 查看全部）";
}

function setGodEye(on){
  State.godEye = !!on;
  toggleGodEye.checked = State.godEye;
  renderSeats();
  save();
}

/* mark buttons */
function applyMark(mark){
  const no = State.selectedSeat;
  if(!no){
    alert("先點一個座位再標記");
    return;
  }
  const s = State.seats.find(x=>x.no===no);
  if(!s) return;

  if(mark==="clear"){
    s.marks.death = null;
    s.marks.rescue = false;
    s.marks.healUse = false;
    s.marks.poisonUse = false;
  }else if(mark==="rescue"){
    s.marks.rescue = true;
  }else if(mark==="healUse"){
    // 解藥只能放一個：先清掉其它人的 healUse
    State.seats.forEach(x=>x.marks.healUse=false);
    s.marks.healUse = true;
  }else if(mark==="poisonUse"){
    // 毒藥只能放一個：先清掉其它人的 poisonUse
    State.seats.forEach(x=>x.marks.poisonUse=false);
    s.marks.poisonUse = true;
  }else{
    s.marks.death = mark;
    s.alive = false; // 你也可以改成「只標記不改生死」，先給直覺版
  }

  renderSeats();
  save();
}

/* ========== Timer drawer ========== */
function openDrawer(drawer){
  backdrop.classList.remove("hidden");
  drawer.classList.remove("hidden");
  drawer.setAttribute("aria-hidden","false");
}
function closeDrawer(drawer){
  drawer.classList.add("hidden");
  drawer.setAttribute("aria-hidden","true");
  backdrop.classList.add("hidden");
}

/* timer */
function timerRender(){
  timerBig.textContent = fmtTime(State.timer.left);
}
function timerSet(sec){
  State.timer.sec = sec;
  State.timer.left = sec;
  State.timer.running = false;
  State.timer.endAt = null;
  if(State.timer.tick) clearInterval(State.timer.tick);
  State.timer.tick = null;
  timerRender();
  save();
}
function timerStart(){
  if(State.timer.running) return;
  State.timer.running = true;
  State.timer.endAt = Date.now() + State.timer.left*1000;
  State.timer.tick = setInterval(()=>{
    const left = Math.max(0, Math.ceil((State.timer.endAt - Date.now())/1000));
    State.timer.left = left;
    timerRender();
    if(left<=0){
      timerPause();
      vibrate([200,120,200,120,200]);
    }
    save();
  }, 250);
  save();
}
function timerPause(){
  if(!State.timer.running) return;
  State.timer.running = false;
  if(State.timer.tick) clearInterval(State.timer.tick);
  State.timer.tick = null;
  State.timer.endAt = null;
  save();
}
function timerReset(){
  timerSet(State.timer.sec);
}

/* ========== Flow / Phase ========== */
function updateTop(){
  uiStatus.textContent = State.phase;
  uiBoard.textContent  = State.boardId || "—";
}

function renderFlow(){
  updateTop();

  if(State.phase === "SETUP"){
    promptTitle.textContent = "設定：選人數與板子";
    promptText.textContent =
`1) 先選人數（9/10/12）
2) 選一個板子（會變色）
3) 按「下一步」進入抽身分（DEAL）

提示：SETUP 期間不顯示座位，避免擠畫面。`;
    promptFoot.textContent = "要改人數/板子：⚙️ 設定 → 回到選板子";
    setupArea.classList.remove("hidden");
    seatsArea.classList.add("hidden");
    btnBack.disabled = true;
    btnPrimary.textContent = "下一步";
    seatHint.textContent = "—";
    return;
  }

  if(State.phase === "DEAL"){
    promptTitle.textContent = "抽身分";
    promptText.textContent =
`請把手機交給玩家：
- 長按座位 0.3 秒翻牌
- 玩家看完按「我看完了」
- 全部都看完後再按「下一步」進入遊戲`;
    promptFoot.textContent = "✅ 已看完的人會記錄在系統裡";
    setupArea.classList.add("hidden");
    seatsArea.classList.remove("hidden");
    btnBack.disabled = false;
    btnPrimary.textContent = "進入遊戲";
    seatHint.textContent = "長按 0.3 秒翻牌（抽身分階段）";
    return;
  }

  if(State.phase === "PLAY"){
    promptTitle.textContent = "進行中";
    promptText.textContent =
`流程卡 + 座位卡會同時常駐，操作更直覺。
- 點座位：選取（會變色）
- 👁️：開上帝抽屜 + 可開啟上帝視角顯示角色/陣營/標記`;
    promptFoot.textContent = "要結束本局：⚙️ 設定 → 結束本局";
    setupArea.classList.add("hidden");
    seatsArea.classList.remove("hidden");
    btnBack.disabled = false;
    btnPrimary.textContent = "下一步";
    seatHint.textContent = "點座位可選取（變色）";
  }
}

/* ========== Phase transitions ========== */
function canLeaveDeal(){
  return State.seats.length>0 && State.seats.every(s=>s.revealed);
}

/* ========== Events ========== */
peopleChips.addEventListener("click", (e)=>{
  const btn = e.target.closest(".chip");
  if(!btn) return;
  const n = Number(btn.dataset.n);
  if(!n) return;
  State.people = n;

  // 若目前板子人數不符，改成該人數的第一個板子
  const list = Object.values(BOARDS).filter(b=>b.people===n);
  State.boardId = list[0]?.id || State.boardId;

  renderSetup();
  updateTop();
  save();
});

btnPrimary.addEventListener("click", ()=>{
  if(State.phase === "SETUP"){
    // 進 DEAL：建立座位與身分
    buildSeats();
    State.phase = "DEAL";
    State.selectedSeat = null;
    renderSeats();
    renderFlow();
    save();
    return;
  }

  if(State.phase === "DEAL"){
    if(!canLeaveDeal()){
      alert("還有人尚未翻牌看身分（每個座位都要長按翻牌）");
      return;
    }
    State.phase = "PLAY";
    renderFlow();
    save();
    return;
  }

  if(State.phase === "PLAY"){
    alert("（此 MVP 版先把核心操作修好：下一步流程可再接你原本 Day0~Day2 的狀態機）");
  }
});

btnBack.addEventListener("click", ()=>{
  if(State.phase === "DEAL"){
    // 回 SETUP：不保留座位
    State.phase = "SETUP";
    State.seats = [];
    State.selectedSeat = null;
    renderFlow();
    renderSetup();
    save();
    return;
  }
  if(State.phase === "PLAY"){
    // 回 DEAL（保留座位）
    State.phase = "DEAL";
    renderFlow();
    save();
  }
});

btnCancel.addEventListener("click", ()=>{
  State.selectedSeat = null;
  renderSeats();
  save();
});

/* drawers open/close */
btnHourglass.addEventListener("click", ()=> openDrawer(drawerTimer));
btnCloseTimer.addEventListener("click", ()=> closeDrawer(drawerTimer));

btnGodEye.addEventListener("click", ()=> openDrawer(drawerGod));
btnCloseGod.addEventListener("click", ()=> closeDrawer(drawerGod));

btnSettings.addEventListener("click", ()=> openDrawer(drawerSettings));
btnCloseSettings.addEventListener("click", ()=> closeDrawer(drawerSettings));

backdrop.addEventListener("click", ()=>{
  [drawerTimer, drawerGod, drawerSettings].forEach(d=>{
    if(!d.classList.contains("hidden")) closeDrawer(d);
  });
});

/* timer presets */
drawerTimer.addEventListener("click", (e)=>{
  const b = e.target.closest(".chip[data-sec]");
  if(!b) return;
  const sec = Number(b.dataset.sec);
  if(!sec) return;
  timerSet(sec);
});
btnTimerStart.addEventListener("click", timerStart);
btnTimerPause.addEventListener("click", timerPause);
btnTimerReset.addEventListener("click", timerReset);

/* god eye toggle */
toggleGodEye.addEventListener("change", (e)=>{
  setGodEye(e.target.checked);
});

/* marks */
drawerGod.addEventListener("click", (e)=>{
  const b = e.target.closest(".chip[data-mark]");
  if(!b) return;
  applyMark(b.dataset.mark);
});

/* settings actions */
btnGoSetup.addEventListener("click", ()=>{
  closeDrawer(drawerSettings);
  State.phase = "SETUP";
  State.seats = [];
  State.selectedSeat = null;
  renderFlow();
  renderSetup();
  save();
});
btnEndGame.addEventListener("click", ()=>{
  if(confirm("確定要結束本局並清除存檔嗎？")){
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
});

/* role modal actions */
btnRoleDone.addEventListener("click", ()=>{
  closeRoleModal();
  renderSeats();
  renderFlow();
});
btnRoleClose.addEventListener("click", ()=>{
  closeRoleModal();
});

/* dice */
$("#btnDice").addEventListener("click", ()=>{
  if(State.phase === "SETUP"){
    alert("先進入遊戲後才會從存活座位擲骰。");
    return;
  }
  const alive = State.seats.filter(s=>s.alive).map(s=>s.no);
  if(alive.length===0){ alert("沒有存活座位"); return; }
  const pick = alive[Math.floor(Math.random()*alive.length)];
  alert(`🎲 抽到：${pick}號`);
});

/* ========== Init ========== */
load();

(function init(){
  // 若有存檔且在 DEAL/PLAY，確保 seatsArea 顯示
  renderSetup();
  if(State.phase !== "SETUP" && (!State.seats || State.seats.length===0)){
    // 存檔壞掉時保護
    State.phase = "SETUP";
  }
  // timer restore
  if(!State.timer) State.timer = {sec:90, running:false, endAt:null, left:90, tick:null};
  timerRender();

  // render seats if needed
  if(State.phase !== "SETUP"){
    seatsArea.classList.remove("hidden");
    setupArea.classList.add("hidden");
    renderSeats();
  }else{
    seatsArea.classList.add("hidden");
    setupArea.classList.remove("hidden");
  }

  setGodEye(!!State.godEye);
  renderFlow();
  save();
})();