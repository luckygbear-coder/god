/* =======================
   Stable v0.9 (fix iOS mis-tap / add SETUP)
======================= */

const $ = (id) => document.getElementById(id);

const uiPhase = $("uiPhase");
const uiBoard = $("uiBoard");

const setupCard = $("setupCard");
const promptCard = $("promptCard");
const promptTitle = $("promptTitle");
const promptText = $("promptText");

const seatsWrap = $("seatsWrap");
const seatsGrid = $("seatsGrid");

const btnGodEye = $("btnGodEye");
const btnBack = $("btnBack");
const btnToggle = $("btnToggle");
const btnNext = $("btnNext");

const roleModal = $("roleModal");
const roleTitle = $("roleTitle");
const roleBody = $("roleBody");
const btnRoleDone = $("btnRoleDone");
const btnRoleClose = $("btnRoleClose");

const countChips = $("countChips");
const boardList = $("boardList");

// ---- Boards (先用內建，避免 fetch 失敗造成空白) ----
const BOARDS = [
  {
    id: "official-12",
    count: 12,
    name: "12人官方標準局",
    desc: "4狼 + 預言家/女巫/獵人/守衛 + 4民",
    roles: ["狼人","狼人","狼人","狼人","預言家","女巫","獵人","守衛","平民","平民","平民","平民"]
  },
  {
    id: "official-10",
    count: 10,
    name: "10人官方標準局",
    desc: "3狼 + 預言家/女巫/獵人 + 4民",
    roles: ["狼人","狼人","狼人","預言家","女巫","獵人","平民","平民","平民","平民"]
  },
  {
    id: "official-9",
    count: 9,
    name: "9人官方標準局",
    desc: "3狼 + 預言家/女巫 + 4民",
    roles: ["狼人","狼人","狼人","預言家","女巫","平民","平民","平民","平民"]
  }
];

const state = {
  phase: "SETUP",          // SETUP | DEAL | GAME
  playerCount: 12,
  boardId: "official-12",
  godEye: false,
  selected: null,          // seatNo
  seats: [],               // {no, role, alive}
  viewed: new Set(),       // seatNo
  longPressTimer: null,
};

// ========== helpers ==========
function shuffle(arr){
  const a = [...arr];
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function getBoard(){
  return BOARDS.find(b=>b.id===state.boardId) || BOARDS[0];
}

function setPhase(p){
  state.phase = p;
  uiPhase.textContent = p;

  if(p==="SETUP"){
    uiBoard.textContent = "—";
    setupCard.classList.remove("hidden");
    promptCard.classList.add("hidden");
    seatsWrap.classList.add("hidden");
    btnToggle.textContent = "開始抽身分";
    btnBack.textContent = "上一步";
    btnNext.textContent = "下一步";
    btnBack.disabled = true;
    btnNext.disabled = true;
    btnToggle.disabled = !state.boardId;
  }

  if(p==="DEAL"){
    const board = getBoard();
    uiBoard.textContent = board.id;
    setupCard.classList.add("hidden");
    promptCard.classList.remove("hidden");
    seatsWrap.classList.remove("hidden");

    promptTitle.textContent = "抽身分";
    promptText.textContent = "請將手機交給玩家，長按座位 0.3 秒查看身分。全部看完後再按「進入遊戲」。";

    btnBack.disabled = false;
    btnNext.disabled = false;
    btnBack.textContent = "上一步";
    btnNext.textContent = "下一步";
    btnToggle.textContent = "進入遊戲";
    btnToggle.disabled = (state.viewed.size !== board.count); // 全看完才可進入
  }

  if(p==="GAME"){
    const board = getBoard();
    uiBoard.textContent = board.id;
    setupCard.classList.add("hidden");
    promptCard.classList.remove("hidden");
    seatsWrap.classList.remove("hidden");

    promptTitle.textContent = "遊戲中";
    promptText.textContent = "點座位可選取（再點一次取消）。👁️ 可切換上帝視角顯示角色。";

    btnBack.disabled = false;
    btnNext.disabled = false;
    btnToggle.disabled = false;
    btnBack.textContent = "上一步";
    btnToggle.textContent = "天黑閉眼";
    btnNext.textContent = "下一步";
  }

  renderSeats();
  renderTopEye();
}

function renderTopEye(){
  btnGodEye.textContent = state.godEye ? "👁️" : "👁️";
  btnGodEye.style.opacity = state.godEye ? "1" : "0.75";
}

// ========== SETUP UI ==========
function renderSetup(){
  // chips
  const counts = [9,10,12];
  countChips.innerHTML = "";
  counts.forEach(n=>{
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (state.playerCount===n ? " active" : "");
    b.textContent = `${n}人`;
    b.onclick = ()=>{
      state.playerCount = n;
      // auto choose first board with count
      const match = BOARDS.find(x=>x.count===n);
      state.boardId = match ? match.id : BOARDS[0].id;
      renderSetup();
    };
    countChips.appendChild(b);
  });

  // board list (filtered by count)
  const list = BOARDS.filter(b=>b.count===state.playerCount);
  boardList.innerHTML = "";
  list.forEach(bd=>{
    const div = document.createElement("div");
    div.className = "boardItem" + (state.boardId===bd.id ? " active" : "");
    div.innerHTML = `
      <div class="name">${bd.name}</div>
      <div class="sub">${bd.id} · ${bd.desc}</div>
    `;
    div.onclick = ()=>{
      state.boardId = bd.id;
      renderSetup();
    };
    boardList.appendChild(div);
  });

  btnToggle.disabled = !state.boardId;
}

// ========== DEAL init ==========
function startDeal(){
  const board = getBoard();
  const shuffled = shuffle(board.roles);
  state.seats = shuffled.map((role, idx)=>({
    no: idx+1,
    role,
    alive: true,
  }));
  state.selected = null;
  state.viewed = new Set();
  state.godEye = false; // 預設關閉
  setPhase("DEAL");
}

// ========== Seats rendering (stable + event delegation) ==========
function seatMetaText(seat){
  if(state.godEye) return seat.role;
  if(state.phase==="DEAL") return state.viewed.has(seat.no) ? "已看" : "未看";
  return seat.alive ? "存活" : "死亡";
}

function renderSeats(){
  if(state.phase==="SETUP"){
    seatsGrid.innerHTML = "";
    return;
  }

  // build once per render, but click use delegation from container
  seatsGrid.innerHTML = state.seats.map(seat=>{
    const sel = state.selected===seat.no ? " selected" : "";
    return `
      <div class="seat${sel}" data-no="${seat.no}">
        <div class="no">${seat.no}號</div>
        <div class="meta">${seatMetaText(seat)}</div>
      </div>
    `;
  }).join("");
}

// ---- iOS longpress safe: do NOT preventDefault on touchstart,
// but block contextmenu and selection globally (CSS) + contextmenu prevent
seatsGrid.addEventListener("contextmenu", (e)=> e.preventDefault());

function openRoleModal(seat){
  roleTitle.textContent = `${seat.no}號 身分`;
  roleBody.textContent = seat.role;
  roleModal.classList.remove("hidden");
  roleModal.setAttribute("aria-hidden","false");

  state.viewed.add(seat.no);

  // 更新進入遊戲按鈕狀態
  if(state.phase==="DEAL"){
    const board = getBoard();
    btnToggle.disabled = (state.viewed.size !== board.count);
    renderSeats();
  }
}

function closeRoleModal(){
  roleModal.classList.add("hidden");
  roleModal.setAttribute("aria-hidden","true");
}

btnRoleDone.onclick = closeRoleModal;
btnRoleClose.onclick = closeRoleModal;

// event delegation for tap + longpress
seatsGrid.addEventListener("pointerdown", (e)=>{
  const seatEl = e.target.closest(".seat");
  if(!seatEl) return;

  const no = Number(seatEl.dataset.no);
  const seat = state.seats.find(s=>s.no===no);
  if(!seat) return;

  // start long press timer only in DEAL
  if(state.phase==="DEAL"){
    clearTimeout(state.longPressTimer);
    state.longPressTimer = setTimeout(()=>{
      openRoleModal(seat);
    }, 300);
  }
});

seatsGrid.addEventListener("pointerup", (e)=>{
  clearTimeout(state.longPressTimer);

  const seatEl = e.target.closest(".seat");
  if(!seatEl) return;

  const no = Number(seatEl.dataset.no);

  // tap toggles selection
  state.selected = (state.selected===no) ? null : no;
  renderSeats();
});

seatsGrid.addEventListener("pointercancel", ()=> clearTimeout(state.longPressTimer));
seatsGrid.addEventListener("pointermove", ()=> {/* 可選：移動就取消長按 */
  // 不做也行，但避免拖曳誤觸
});

// ========== Top buttons ==========
btnGodEye.onclick = ()=>{
  if(state.phase==="SETUP") return;
  state.godEye = !state.godEye;
  renderTopEye();
  renderSeats();
};

// ========== Bottom buttons ==========
btnToggle.onclick = ()=>{
  if(state.phase==="SETUP"){
    startDeal();
    return;
  }
  if(state.phase==="DEAL"){
    const board = getBoard();
    if(state.viewed.size !== board.count) return;
    setPhase("GAME");
    return;
  }
  if(state.phase==="GAME"){
    // 這裡先做最小流程切換示意（下一步我們再接完整夜晚/白天流程）
    const text = btnToggle.textContent;
    btnToggle.textContent = (text==="天黑閉眼") ? "天亮睜眼"
                      : (text==="天亮睜眼") ? "開始投票"
                      : "天黑閉眼";
  }
};

btnBack.onclick = ()=>{
  if(state.phase==="DEAL"){
    setPhase("SETUP");
    return;
  }
  if(state.phase==="GAME"){
    // 先保留：之後接真正的流程堆疊
    promptTitle.textContent = "（上一步）";
    promptText.textContent = "你按了上一步（下一步我們會接真正的流程回退）。";
  }
};

btnNext.onclick = ()=>{
  if(state.phase==="DEAL"){
    // DEAL 的下一步先不做（避免誤導）
    promptTitle.textContent = "抽身分";
    promptText.textContent = "長按座位 0.3 秒查看身分；全部看完後按「進入遊戲」。";
    return;
  }
  if(state.phase==="GAME"){
    promptTitle.textContent = "（下一步）";
    promptText.textContent = "你按了下一步（下一步我們會接真正的夜/日流程）。";
  }
};

// ========== boot ==========
function boot(){
  // default setup
  state.playerCount = 12;
  state.boardId = "official-12";
  renderSetup();
  setPhase("SETUP");
}

boot();