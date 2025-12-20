/* =========================
   Werewolf God Helper (PWA)
   iOS-friendly long press + no-zoom
   ========================= */

const $ = (id) => document.getElementById(id);

/** ======= DOM ======= */
const uiStatus = $("uiStatus");
const uiBoard  = $("uiBoard");

const btnAnn = $("btnAnn");
const btnTimer = $("btnTimer");
const btnEye = $("btnEye");
const btnDice = $("btnDice");
const btnSettings = $("btnSettings");

const promptTitle = $("promptTitle");
const promptText = $("promptText");
const promptFoot = $("promptFoot");

const setupCard = $("setupCard");
const boardList = $("boardList");
const boardHint = $("boardHint");

const seatsGrid = $("seatsGrid");

const btnBack = $("btnBack");
const btnMain = $("btnMain");
const btnNext = $("btnNext");

/* Drawer/Modal */
const timerBackdrop = $("timerBackdrop");
const timerDrawer = $("timerDrawer");
const btnCloseTimer = $("btnCloseTimer");
const timerBig = $("timerBig");
const timerPresets = $("timerPresets");
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
const roleModalRole = $("roleModalRole");
const roleModalCamp = $("roleModalCamp");
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

/** ======= Storage ======= */
const LS_KEY = "ww_god_v6";

/** ======= Boards =======
 * roles: list of role keys (excluding 'villager' which we can auto-fill)
 * total seats = n
 */
const BOARDS = [
  {
    id: "official-12",
    name: "12 人官方標準局",
    n: 12,
    tags: ["官方","穩","含白癡"],
    desc: "4 狼 + 預言家/女巫/獵人/守衛 + 白癡 + 2 民",
    roles: ["werewolf","werewolf","werewolf","werewolf","seer","witch","hunter","guard","idiot","villager","villager","villager"]
  },
  {
    id: "12-thief",
    name: "12 人含盜賊",
    n: 12,
    tags: ["盜賊","變動","更刺激"],
    desc: "4 狼 + 預言家/女巫/獵人/守衛/白癡/盜賊 + 1 民（盜賊從未抽到角色再抽 2 選 1）",
    // 這裡的 roles 是「要分配給 12 人的初始牌庫」
    roles: ["werewolf","werewolf","werewolf","werewolf","seer","witch","hunter","guard","idiot","thief","villager","villager"]
  },
  {
    id: "12-cupid",
    name: "12 人含邱比特",
    n: 12,
    tags: ["邱比特","戀人"],
    desc: "4 狼 + 預言家/女巫/獵人/守衛/邱比特 + 2 民",
    roles: ["werewolf","werewolf","werewolf","werewolf","seer","witch","hunter","guard","cupid","villager","villager","villager"]
  }
];

const ROLE_META = {
  villager: { zh:"平民", camp:"好人" },
  werewolf: { zh:"狼人", camp:"狼人" },
  seer:     { zh:"預言家", camp:"好人" },
  witch:    { zh:"女巫", camp:"好人" },
  hunter:   { zh:"獵人", camp:"好人" },
  guard:    { zh:"守衛", camp:"好人" },
  idiot:    { zh:"白癡", camp:"好人" },
  cupid:    { zh:"邱比特", camp:"好人" },
  thief:    { zh:"盜賊", camp:"好人" },
};

function roleLabel(key){
  const m = ROLE_META[key] || { zh:key, camp:"" };
  return `${m.zh}`;
}
function campLabel(key){
  const m = ROLE_META[key] || { camp:"" };
  return m.camp;
}

/** ======= State ======= */
const S = loadState() || freshState();

function freshState(){
  return {
    phase: "setup", // setup | deal | night | day | vote
    n: 12,
    boardId: "official-12",
    winMode: "edge",
    hasPolice: true,

    godOn: false,       // 👁
    selectedSeatId: null,

    seats: [],          // built after startGame()
    dealViewed: {},     // seatId: true/false

    // for thief
    thiefSeatId: null,
    thiefDone: false,
    thiefOffer: null,   // [roleA, roleB]
    // role pool for thief picking
    remainingPool: [],  // roles not assigned to any seat (after initial deal, except thief)
    discardedRole: null,

    // day/night counters
    dayNo: 1,
    nightNo: 1,

    // logs for announce
    logs: [], // {t, public, god}
    annShowGod: false,

    // timer
    timer: { sec: 90, left: 90, running:false, ts: 0 }
  };
}

function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(e){
    return null;
  }
}
function saveState(){
  localStorage.setItem(LS_KEY, JSON.stringify(S));
}

/** ======= Helpers ======= */
function nowStr(){
  const d = new Date();
  const pad = (x)=> String(x).padStart(2,"0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function logIt(publicText, godText=null){
  S.logs.unshift({
    t: nowStr(),
    public: publicText,
    god: godText || publicText
  });
  saveState();
}

/** ======= UI basics ======= */
function setStatus(){
  let p = S.phase;
  let label =
    p==="setup" ? "SETUP / BOARD" :
    p==="deal"  ? `抽身分 (${countViewed()}/${S.n})` :
    p==="night" ? `🌙 NIGHT ${S.nightNo}` :
    p==="day"   ? `☀️ DAY ${S.dayNo}` :
    p==="vote"  ? `📣 投票` : "—";

  uiStatus.textContent = label;
  uiBoard.textContent = S.boardId || "—";
  btnEye.classList.toggle("active", !!S.godOn);
}

function countViewed(){
  return Object.values(S.dealViewed || {}).filter(Boolean).length;
}

/** ======= Setup rendering ======= */
function renderSetup(){
  setupCard.classList.toggle("hidden", S.phase !== "setup");

  // people chips
  setupCard.querySelectorAll(".chip[data-n]").forEach(btn=>{
    const n = Number(btn.dataset.n);
    btn.classList.toggle("active", S.n === n);
    btn.onclick = ()=>{
      if(S.phase!=="setup") return;
      S.n = n;
      // auto pick first board with same n
      const b = BOARDS.find(x=>x.n===n) || BOARDS[0];
      S.boardId = b.id;
      saveState();
      renderAll();
    };
  });

  // board list
  boardList.innerHTML = "";
  const list = BOARDS.filter(b=>b.n===S.n);
  boardHint.textContent = list.length ? "請選擇板子（點一下會變色）" : "此人數尚無板子";
  list.forEach(b=>{
    const el = document.createElement("div");
    el.className = "boardItem" + (S.boardId===b.id ? " active":"");
    el.innerHTML = `
      <div class="boardName">${b.name}</div>
      <div class="boardId">${b.id}</div>
      <div class="boardDesc">${b.desc}</div>
      <div class="tags">${(b.tags||[]).map(t=>`<span class="tag">${t}</span>`).join("")}</div>
    `;
    el.onclick = ()=>{
      if(S.phase!=="setup") return;
      S.boardId = b.id;
      saveState();
      renderAll();
    };
    boardList.appendChild(el);
  });
}

/** ======= Seats ======= */
function buildSeats(n){
  const arr = [];
  for(let i=1;i<=n;i++){
    arr.push({
      id:i,
      alive:true,
      role:null,     // role key
      camp:null,     // derived
      note:"",       // future use: wolf刀/毒/盾…
    });
  }
  return arr;
}

function renderSeats(){
  seatsGrid.innerHTML = "";
  // 在 setup 階段：不要顯示座位格（你要求選完板子後才進抽身分才出現）
  if(S.phase==="setup"){
    seatsGrid.classList.add("hidden");
    return;
  }
  seatsGrid.classList.remove("hidden");

  S.seats.forEach(seat=>{
    const el = document.createElement("div");
    el.className = "seat";
    el.dataset.id = seat.id;

    // selected highlight
    if(S.selectedSeatId === seat.id) el.classList.add("selected");
    if(!seat.alive) el.classList.add("dead");

    // content
    const n = seat.id;
    let sub = "";

    if(S.phase==="deal"){
      // 抽身分階段：預設不顯示角色（避免被看到）
      sub = "長按看身分";
      // 但如果上帝視角開啟（👁），仍可顯示（方便上帝核對）
      if(S.godOn && seat.role){
        sub = `${roleLabel(seat.role)}・${campLabel(seat.role)}`;
      }
    }else{
      // 遊戲階段：正常顯示存活/死亡，若 👁 開啟顯示更多
      sub = seat.alive ? "存活" : "死亡";
      if(S.godOn && seat.role){
        sub = `${roleLabel(seat.role)}・${campLabel(seat.role)}`;
      }
    }

    el.innerHTML = `
      <div class="n">${n}</div>
      <div class="sub">${sub}</div>
      ${S.godOn && seat.note ? `<div class="godline">${seat.note}</div>` : ``}
    `;

    // click select toggle
    el.addEventListener("click", ()=>{
      if(S.phase==="setup") return;
      if(S.selectedSeatId === seat.id){
        S.selectedSeatId = null;
      }else{
        S.selectedSeatId = seat.id;
      }
      saveState();
      renderSeats();
    });

    seatsGrid.appendChild(el);
  });

  // 重新綁長按（iOS 需要 touchstart）
  bindLongPress();
}

let lpBound = false;
function bindLongPress(){
  // 避免重複綁
  if(lpBound) return;
  lpBound = true;

  let lpTimer = null;
  let lpSeatEl = null;

  function clearLP(){
    if(lpTimer) clearTimeout(lpTimer);
    lpTimer = null;
    lpSeatEl = null;
  }

  function startLP(seatEl){
    clearLP();
    lpSeatEl = seatEl;

    // ✅ 只在抽身分階段允許長按
    if(S.phase !== "deal") return;

    const sid = Number(seatEl.dataset.id);
    const seat = S.seats.find(x=>x.id===sid);
    if(!seat || !seat.alive) return;

    lpTimer = setTimeout(()=>{
      if(S.phase !== "deal") return;
      openRoleModal(sid);
    }, 300);
  }

  // iOS: touchstart 最穩
  seatsGrid.addEventListener("touchstart", (e)=>{
    const seatEl = e.target.closest(".seat");
    if(!seatEl) return;
    startLP(seatEl);
  }, {passive:true});

  seatsGrid.addEventListener("touchend", clearLP, {passive:true});
  seatsGrid.addEventListener("touchcancel", clearLP, {passive:true});
  seatsGrid.addEventListener("touchmove", clearLP, {passive:true});

  // pointer for other devices
  seatsGrid.addEventListener("pointerdown", (e)=>{
    const seatEl = e.target.closest(".seat");
    if(!seatEl) return;
    startLP(seatEl);
  });
  seatsGrid.addEventListener("pointerup", clearLP);
  seatsGrid.addEventListener("pointercancel", clearLP);
  seatsGrid.addEventListener("pointerleave", clearLP);
}

/** ======= Deal / Role modal ======= */
let roleViewingSeatId = null;

function openRoleModal(seatId){
  const seat = S.seats.find(s=>s.id===seatId);
  if(!seat || !seat.role) return;

  roleViewingSeatId = seatId;

  roleModalTitle.textContent = `${seatId} 號 身分`;
  roleModalRole.textContent = roleLabel(seat.role);
  roleModalCamp.textContent = `陣營：${campLabel(seat.role)}`;

  roleModal.classList.remove("hidden");
  roleModal.setAttribute("aria-hidden","false");
}

function closeRoleModal(){
  roleModal.classList.add("hidden");
  roleModal.setAttribute("aria-hidden","true");
  roleViewingSeatId = null;
}

btnRoleClose.onclick = closeRoleModal;

// ✅ 看完：標記已看 + 自動蓋牌（格子不顯示角色）
// ✅ 若該玩家是盜賊：立刻進入盜賊二選一
btnRoleDone.onclick = ()=>{
  if(roleViewingSeatId == null) return;
  S.dealViewed[roleViewingSeatId] = true;

  const seat = S.seats.find(s=>s.id===roleViewingSeatId);
  closeRoleModal();

  saveState();
  renderAll();

  // 盜賊：看完身分後立刻二選一
  if(seat && seat.role==="thief" && !S.thiefDone){
    S.thiefSeatId = seat.id;
    openThiefModal();
  }
};

/** ======= Thief ======= */
function pick2FromPool(pool){
  if(pool.length < 2) return null;
  const a = pool[Math.floor(Math.random()*pool.length)];
  let b = a;
  while(b===a) b = pool[Math.floor(Math.random()*pool.length)];
  return [a,b];
}

function openThiefModal(){
  const thiefSeat = S.seats.find(s=>s.id===S.thiefSeatId);
  if(!thiefSeat) return;

  // 如果尚未生成兩張牌，從 remainingPool 抽兩張
  if(!S.thiefOffer){
    const offer = pick2FromPool(S.remainingPool);
    if(!offer){
      // 沒牌就直接當平民（保底）
      S.thiefDone = true;
      thiefSeat.role = "villager";
      thiefSeat.camp = campLabel("villager");
      saveState();
      renderAll();
      return;
    }
    S.thiefOffer = offer;
  }

  const [ra, rb] = S.thiefOffer;
  thiefHint.textContent = "請從兩張牌中選 1 張成為你的最終角色（另一張被捨棄）。";

  btnThiefA.textContent = roleLabel(ra);
  btnThiefB.textContent = roleLabel(rb);

  thiefModal.classList.remove("hidden");
  thiefModal.setAttribute("aria-hidden","false");

  btnThiefA.onclick = ()=> chooseThiefRole(ra);
  btnThiefB.onclick = ()=> chooseThiefRole(rb);
}

function closeThiefModal(){
  thiefModal.classList.add("hidden");
  thiefModal.setAttribute("aria-hidden","true");
}

btnThiefClose.onclick = closeThiefModal;

function chooseThiefRole(chosen){
  const thiefSeat = S.seats.find(s=>s.id===S.thiefSeatId);
  if(!thiefSeat) return;

  const [ra, rb] = S.thiefOffer || [];
  const other = (chosen===ra ? rb : ra);

  // ✅ 盜賊成為 chosen
  thiefSeat.role = chosen;
  thiefSeat.camp = campLabel(chosen);

  // ✅ 從 remainingPool 移除 chosen & other（避免其他玩家再抽到）
  S.remainingPool = S.remainingPool.filter(r=>r!==chosen && r!==other);

  S.discardedRole = other;
  S.thiefDone = true;

  // 清掉 offer
  S.thiefOffer = null;

  logIt("盜賊已完成選角。", `盜賊(${S.thiefSeatId}號) 選擇：${roleLabel(chosen)}，捨棄：${roleLabel(other)}`);

  closeThiefModal();
  saveState();
  renderAll();
}

/** ======= Start Game ======= */
function startGameFromSetup(){
  const board = BOARDS.find(b=>b.id===S.boardId) || BOARDS[0];

  S.phase = "deal";
  S.dayNo = 1;
  S.nightNo = 1;
  S.godOn = false;
  S.selectedSeatId = null;

  S.seats = buildSeats(board.n);
  S.dealViewed = {};
  S.thiefSeatId = null;
  S.thiefDone = true; // will set to false if board has thief
  S.remainingPool = [];
  S.discardedRole = null;

  // assign initial roles
  const bag = [...board.roles];

  // shuffle bag
  for(let i=bag.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [bag[i],bag[j]] = [bag[j],bag[i]];
  }

  // deal 1 role to each seat
  S.seats.forEach((seat, idx)=>{
    const r = bag[idx];
    seat.role = r;
    seat.camp = campLabel(r);
  });

  // remaining pool (for thief to draw) = roles NOT dealt to any seat
  // 這邊板子的 roles 已經剛好等於 n，所以 remainingPool 先空。
  // ✅ 盜賊板：我們要從「尚未被抽到的角色」再抽兩張，
  // 做法：把一個「可被抽的角色池」定義為：所有可能角色 - 已經出現的角色數量。
  // 為了符合你說的「從未被抽到角色中抽兩張」，我們用 board.extraPool 定義，
  // 若沒定義就用常見神職池當備用。
  const hasThief = S.seats.some(s=>s.role==="thief");
  if(hasThief){
    S.thiefDone = false;
    S.thiefSeatId = S.seats.find(s=>s.role==="thief").id;

    // ✅ 建立可抽池：把「標準神職/特色職」丟進池裡，然後移除已出現的角色
    // 你要更完整就把更多角色加進來即可
    const basePool = [
      "seer","witch","hunter","guard","idiot","cupid"
    ];
    // 狼牌也允許出現在池中（你有提到可能抽到狼牌）
    basePool.push("werewolf");

    // 去重
    const uniq = Array.from(new Set(basePool));

    // 移除已經在座位出現的角色（讓「尚未抽到」成立）
    const appeared = new Set(S.seats.map(s=>s.role));
    S.remainingPool = uniq.filter(r=>!appeared.has(r));

    // 若移除後不足 2 張，就補 villager / werewolf 保底（但仍盡量不重複）
    while(S.remainingPool.length < 2){
      const add = (S.remainingPool.includes("villager") ? "werewolf" : "villager");
      if(!appeared.has(add) && !S.remainingPool.includes(add)) S.remainingPool.push(add);
      else break;
    }
  }

  logIt("已開始抽身分。");
  saveState();
  renderAll();
}

/** ======= Flow ======= */
function currentBoard(){
  return BOARDS.find(b=>b.id===S.boardId) || BOARDS[0];
}

function setPrompt(title, text, foot=""){
  promptTitle.textContent = title;
  promptText.textContent = text;
  promptFoot.textContent = foot;
}

function renderPrompt(){
  if(S.phase==="setup"){
    setPrompt(
      "開局設定",
      "1) 先選人數\n2) 再選板子（點一下會變色）\n3) 按底部「下一步」開始抽身分",
      "選完進入抽身分後才會顯示座位格。"
    );
    return;
  }

  if(S.phase==="deal"){
    const hasThief = S.seats.some(s=>s.role==="thief");
    const thiefWarn = hasThief && !S.thiefDone ? "⚠️ 盜賊尚未完成選角（盜賊看完身分會立刻二選一）" : "";
    setPrompt(
      "抽身分",
      "上帝點選座位 → 玩家長按 0.3 秒看身分 → 按「我看完了」\n看完會自動蓋牌（不會露出角色）\n全部看完後按「開始夜晚」進入夜晚流程",
      thiefWarn
    );
    return;
  }

  if(S.phase==="night"){
    setPrompt(
      `夜晚 ${S.nightNo}`,
      "夜晚開始：\n1. 守衛請睜眼（選擇守護）\n2. 狼人請睜眼（選擇刀人）\n3. 預言家請睜眼（查驗一人）\n4. 女巫請睜眼（解藥 / 毒藥）\n\n👉 依序按「下一步」提示（點座位選取；再點取消）",
      ""
    );
    return;
  }

  if(S.phase==="day"){
    setPrompt(
      `白天 ${S.dayNo}`,
      "天亮了，請宣佈昨夜結果。\n白天流程：自由發言 →（可上警）→ 推理/辯論 → 投票\n\n按「開始投票」進入投票統計。",
      ""
    );
    return;
  }

  if(S.phase==="vote"){
    setPrompt(
      "投票統計",
      "請用「點座位」記錄投票（你可以在公告 📣 看到清晰票型）。\n完成後按「下一步」結算最高票放逐。",
      ""
    );
    return;
  }
}

function renderButtons(){
  // 中央流程鍵文字
  if(S.phase==="deal"){
    btnMain.textContent = "開始夜晚";
  }else if(S.phase==="night"){
    btnMain.textContent = "天亮睜眼";
  }else if(S.phase==="day"){
    btnMain.textContent = "開始投票";
  }else if(S.phase==="vote"){
    btnMain.textContent = "結算放逐";
  }else{
    btnMain.textContent = "—";
  }

  // 上一步可用性
  btnBack.disabled = (S.phase==="setup");
}

/** ======= Actions ======= */
function canLeaveDeal(){
  if(countViewed() < S.n) return false;
  // 有盜賊必須完成選角
  if(S.seats.some(s=>s.role==="thief") && !S.thiefDone) return false;
  return true;
}

btnNext.onclick = ()=>{
  // setup -> deal
  if(S.phase==="setup"){
    startGameFromSetup();
    return;
  }

  // deal -> night
  if(S.phase==="deal"){
    if(!canLeaveDeal()){
      alert("還沒全部看完身分（或盜賊尚未完成選角）。");
      return;
    }
    S.phase = "night";
    logIt("進入夜晚。");
    saveState();
    renderAll();
    return;
  }

  // night -> day
  if(S.phase==="night"){
    S.phase = "day";
    S.dayNo += 1;
    logIt("天亮，進入白天流程。");
    saveState();
    renderAll();
    return;
  }

  // day -> vote
  if(S.phase==="day"){
    S.phase = "vote";
    logIt("開始投票。");
    saveState();
    renderAll();
    return;
  }

  // vote -> night
  if(S.phase==="vote"){
    S.phase = "night";
    S.nightNo += 1;
    logIt("投票結算完成，進入夜晚。");
    saveState();
    renderAll();
    return;
  }
};

btnMain.onclick = ()=>{
  // 讓中間鍵做「重要流程切換」
  if(S.phase==="deal"){
    btnNext.click();
    return;
  }
  if(S.phase==="night"){
    // night -> day
    S.phase = "day";
    S.dayNo += 1;
    logIt("天亮，進入白天流程。");
    saveState();
    renderAll();
    return;
  }
  if(S.phase==="day"){
    // day -> vote
    S.phase = "vote";
    logIt("開始投票。");
    saveState();
    renderAll();
    return;
  }
  if(S.phase==="vote"){
    // vote -> night
    S.phase = "night";
    S.nightNo += 1;
    logIt("投票結算完成，進入夜晚。");
    saveState();
    renderAll();
    return;
  }
};

btnBack.onclick = ()=>{
  // 簡化：只允許退回上一個 phase（不做細分 step）
  if(S.phase==="deal"){
    // 回到 setup
    S.phase="setup";
  }else if(S.phase==="night"){
    S.phase="deal";
  }else if(S.phase==="day"){
    S.phase="night";
    S.dayNo = Math.max(1, S.dayNo-1);
  }else if(S.phase==="vote"){
    S.phase="day";
  }
  saveState();
  renderAll();
};

/** ======= Top buttons ======= */
btnEye.onclick = ()=>{
  S.godOn = !S.godOn;
  saveState();
  renderAll();
};

btnDice.onclick = ()=>{
  openDice();
};

btnAnn.onclick = ()=>{
  openAnn();
};

btnTimer.onclick = ()=>{
  openTimer();
};

btnSettings.onclick = ()=>{
  openSettings();
};

/** ======= Dice ======= */
function openDice(){
  // alive seats
  const alive = S.seats.filter(s=>s.alive).map(s=>s.id);
  if(!alive.length){
    alert("沒有存活座位可抽。");
    return;
  }
  const pick = alive[Math.floor(Math.random()*alive.length)];
  diceResult.textContent = `${pick}`;
  diceModal.classList.remove("hidden");
  diceModal.setAttribute("aria-hidden","false");
}
function closeDice(){
  diceModal.classList.add("hidden");
  diceModal.setAttribute("aria-hidden","true");
}
btnDiceClose.onclick = closeDice;
btnDiceAgain.onclick = openDice;

/** ======= Drawer helpers ======= */
function openDrawer(backdropEl, drawerEl){
  backdropEl.classList.remove("hidden");
  drawerEl.classList.remove("hidden");
  drawerEl.setAttribute("aria-hidden","false");
}
function closeDrawer(backdropEl, drawerEl){
  backdropEl.classList.add("hidden");
  drawerEl.classList.add("hidden");
  drawerEl.setAttribute("aria-hidden","true");
}

/** ======= Announce ======= */
function openAnn(){
  toggleAnnGod.checked = !!S.annShowGod;
  renderAnnText();
  openDrawer(annBackdrop, annDrawer);
}
function closeAnn(){
  closeDrawer(annBackdrop, annDrawer);
}
btnCloseAnn.onclick = closeAnn;
annBackdrop.onclick = closeAnn;

toggleAnnGod.onchange = ()=>{
  S.annShowGod = !!toggleAnnGod.checked;
  saveState();
  renderAnnText();
};

function renderAnnText(){
  const lines = (S.logs||[]).map(it=>{
    const msg = S.annShowGod ? it.god : it.public;
    return `[${it.t}] ${msg}`;
  });
  annText.textContent = lines.join("\n\n") || "（目前沒有公告）";
}

/** ======= Timer ======= */
function tickTimer(){
  if(!S.timer.running) return;
  const now = Date.now();
  const dt = Math.floor((now - S.timer.ts)/1000);
  if(dt <= 0) return;

  S.timer.ts = now;
  S.timer.left = Math.max(0, S.timer.left - dt);
  if(S.timer.left === 0){
    S.timer.running = false;
    // iOS 震動
    try{ navigator.vibrate && navigator.vibrate([100,80,100]); }catch(e){}
  }
  saveState();
  renderTimerUI();
}
setInterval(tickTimer, 300);

function formatMMSS(sec){
  const m = Math.floor(sec/60);
  const s = sec%60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}
function renderTimerUI(){
  timerBig.textContent = formatMMSS(S.timer.left);
}
function openTimer(){
  renderTimerUI();
  openDrawer(timerBackdrop, timerDrawer);
}
function closeTimer(){
  closeDrawer(timerBackdrop, timerDrawer);
}
btnCloseTimer.onclick = closeTimer;
timerBackdrop.onclick = closeTimer;

timerPresets.addEventListener("click",(e)=>{
  const b = e.target.closest(".chip[data-sec]");
  if(!b) return;
  const sec = Number(b.dataset.sec);
  S.timer.sec = sec;
  S.timer.left = sec;
  S.timer.running = false;
  saveState();
  renderTimerUI();
});

btnTimerStart.onclick = ()=>{
  if(S.timer.left<=0) S.timer.left = S.timer.sec || 90;
  S.timer.running = true;
  S.timer.ts = Date.now();
  saveState();
  renderTimerUI();
};
btnTimerPause.onclick = ()=>{
  S.timer.running = false;
  saveState();
  renderTimerUI();
};
btnTimerReset.onclick = ()=>{
  S.timer.running = false;
  S.timer.left = S.timer.sec || 90;
  saveState();
  renderTimerUI();
};

/** ======= Settings ======= */
function openSettings(){
  togglePolice.checked = !!S.hasPolice;
  segEdge.classList.toggle("primary", S.winMode==="edge");
  segCity.classList.toggle("primary", S.winMode==="city");
  openDrawer(setBackdrop, setDrawer);
}
function closeSettings(){
  closeDrawer(setBackdrop, setDrawer);
}
btnCloseSet.onclick = closeSettings;
setBackdrop.onclick = closeSettings;

segEdge.onclick = ()=>{
  S.winMode = "edge";
  saveState();
  openSettings();
};
segCity.onclick = ()=>{
  S.winMode = "city";
  saveState();
  openSettings();
};
togglePolice.onchange = ()=>{
  S.hasPolice = !!togglePolice.checked;
  saveState();
};

btnGotoSetup.onclick = ()=>{
  // 回到開局（保留設定）
  S.phase = "setup";
  S.seats = [];
  S.dealViewed = {};
  S.logs = [];
  saveState();
  closeSettings();
  renderAll();
};

btnHardReset.onclick = ()=>{
  localStorage.removeItem(LS_KEY);
  location.reload();
};

/** ======= iOS double-tap zoom killer (JS layer) ======= */
(function preventDoubleTapZoom(){
  let lastTouchEnd = 0;
  document.addEventListener("touchend", function(e){
    const now = Date.now();
    if(now - lastTouchEnd <= 300){
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, {passive:false});
})();

/** ======= Render all ======= */
function renderAll(){
  setStatus();
  renderSetup();
  renderPrompt();
  renderSeats();
  renderButtons();
  renderAnnText();
}

/** ======= Boot ======= */
(function init(){
  // if fresh load and not setup but seats missing, go setup
  if(S.phase!=="setup" && (!S.seats || !S.seats.length)){
    Object.assign(S, freshState());
    saveState();
  }

  // keep godOn off during deal unless user toggles
  renderAll();
})();