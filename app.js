/* =========================
   狼人殺上帝輔助 app.js
========================= */

/* ---------- iOS / Android: 取消選取、取消雙擊放大(盡力) ---------- */
(function antiZoomAndSelect(){
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 250) e.preventDefault();
    lastTouchEnd = now;
  }, { passive:false });

  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("selectstart", (e) => e.preventDefault());

  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("gesturechange", (e) => e.preventDefault());
  document.addEventListener("gestureend", (e) => e.preventDefault());
})();

/* ---------- DOM helpers ---------- */
const $ = (id) => document.getElementById(id);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
const deepClone = (x) => JSON.parse(JSON.stringify(x));

/* ---------- Roles / Camps ---------- */
const CAMP = { GOOD:"好人", WOLF:"狼人" };

const ROLE_META = {
  villager:{ zh:"平民", camp:CAMP.GOOD },
  seer:{ zh:"預言家", camp:CAMP.GOOD },
  witch:{ zh:"女巫", camp:CAMP.GOOD },
  hunter:{ zh:"獵人", camp:CAMP.GOOD },
  guard:{ zh:"守衛", camp:CAMP.GOOD },
  idiot:{ zh:"白痴", camp:CAMP.GOOD },
  cupid:{ zh:"邱比特", camp:CAMP.GOOD },
  thief:{ zh:"盜賊", camp:CAMP.GOOD }, // 盜賊可能變狼人
  wolf:{ zh:"狼人", camp:CAMP.WOLF },
};
const roleLabel = (k) => ROLE_META[k]?.zh || k;
const roleCamp  = (k) => ROLE_META[k]?.camp || CAMP.GOOD;

/* ---------- ✅ Boards ---------- */
const BOARDS = [
  {
    id:"official-12",
    name:"12人官方標準局",
    players:12,
    tags:["官方","穩","含白痴"],
    roles:{ wolf:4, seer:1, witch:1, hunter:1, guard:1, idiot:1, villager:3 },
  },
  {
    id:"12-city",
    name:"12人（標準角色・屠城）",
    players:12,
    tags:["測試","屠城"],
    roles:{ wolf:4, seer:1, witch:1, hunter:1, guard:1, villager:4 },
  },
  {
    id:"12-edge-nopolice",
    name:"12人（屠邊・無上警）",
    players:12,
    tags:["測試","無上警"],
    roles:{ wolf:4, seer:1, witch:1, hunter:1, guard:1, villager:4 },
    preset:{ hasPolice:false, winMode:"edge" }
  },

  /* ✅ 這個是你要的盜賊規則：
     - 12人，但總牌=14（多2張底牌）
     - 底牌從未被抽到的角色產生（一定不會被別人抽到）
     - 組成：四民、四狼、預、女、獵、守、白、盜 + 2張底牌
     => roles 加起來 14
  */
  {
    id:"12-thief",
    name:"12人含盜賊（底牌2張）",
    players:12,
    tags:["盜賊","底牌2張"],
    roles:{ villager:4, wolf:4, seer:1, witch:1, hunter:1, guard:1, idiot:1, thief:1 }, // 14張
  },

  {
    id:"10-official",
    name:"10人標準（簡化）",
    players:10,
    tags:["10人"],
    roles:{ wolf:3, seer:1, witch:1, hunter:1, villager:4 },
  },
  {
    id:"9-official",
    name:"9人新手（簡化）",
    players:9,
    tags:["9人"],
    roles:{ wolf:3, seer:1, witch:1, villager:4 },
  },
];

/* ---------- State ---------- */
const STORAGE_KEY = "werewolf_god_v3_state";

const DEFAULT_STATE = {
  phase:"setup",     // setup | deal | night | day | vote
  day:1,
  night:1,
  stepIdx:0,
  showGod:false,

  winMode:"edge",
  hasPolice:true,

  players:12,
  boardId:null,

  seats:[],
  selectedSeat:null,

  // witch
  witchHealUsed:false,
  witchPoisonUsed:false,

  // night actions
  nightAct:{
    guard:null,
    wolf:null,
    seer:null,
    witchSave:false,
    witchPoison:null,
    seerResult:null,
  },

  // thief
  extraCards:[],      // 2 bottom cards (roleKey)
  thiefSeatId:null,
  thiefDone:true,

  // vote
  votes:{},
  voteFrom:null,

  // logs
  logs:[],
  annGod:false,
};

let S = loadState();

/* ---------- DOM refs ---------- */
const uiStatus = $("uiStatus");
const uiBoard  = $("uiBoard");

const promptTitle = $("promptTitle");
const promptText  = $("promptText");
const promptFoot  = $("promptFoot");

const setupCard = $("setupCard");
const boardList = $("boardList");
const seatsGrid = $("seatsGrid");

const btnBack = $("btnBack");
const btnMain = $("btnMain");
const btnNext = $("btnNext");

const btnAnn = $("btnAnn");
const btnTimer = $("btnTimer");
const btnEye = $("btnEye");
const btnDice = $("btnDice");
const btnSettings = $("btnSettings");

/* Drawers */
const annBackdrop = $("annBackdrop");
const annDrawer = $("annDrawer");
const btnCloseAnn = $("btnCloseAnn");
const annText = $("annText");
const toggleAnnGod = $("toggleAnnGod");

const timerBackdrop = $("timerBackdrop");
const timerDrawer = $("timerDrawer");
const btnCloseTimer = $("btnCloseTimer");
const timerBig = $("timerBig");
const timerPresets = $("timerPresets");
const btnTimerStart = $("btnTimerStart");
const btnTimerPause = $("btnTimerPause");
const btnTimerReset = $("btnTimerReset");

const setBackdrop = $("setBackdrop");
const setDrawer = $("setDrawer");
const btnCloseSet = $("btnCloseSet");
const segEdge = $("segEdge");
const segCity = $("segCity");
const togglePolice = $("togglePolice");
const btnGotoSetup = $("btnGotoSetup");
const btnHardReset = $("btnHardReset");

/* Modals */
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

/* ---------- Save / Load ---------- */
function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return deepClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return { ...deepClone(DEFAULT_STATE), ...parsed };
  }catch(e){
    return deepClone(DEFAULT_STATE);
  }
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); }

/* ---------- Init ---------- */
wireUI();
renderAll();

/* =========================
   UI wiring
========================= */
function wireUI(){
  // setup chips
  setupCard.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip[data-n]");
    if(!btn) return;
    S.players = Number(btn.dataset.n);
    S.boardId = null;
    saveState();
    renderAll();
  });

  // board select
  boardList.addEventListener("click", (e) => {
    const item = e.target.closest(".boardItem");
    if(!item) return;
    S.boardId = item.dataset.id;
    const b = getBoard();
    if(b?.preset?.hasPolice === false) S.hasPolice = false;
    if(b?.preset?.winMode) S.winMode = b.preset.winMode;
    saveState();
    renderAll();
  });

  // seat tap
  seatsGrid.addEventListener("click", (e) => {
    const seatEl = e.target.closest(".seat");
    if(!seatEl) return;
    const sid = Number(seatEl.dataset.id);

    if(S.selectedSeat === sid) S.selectedSeat = null;
    else S.selectedSeat = sid;

    if(S.phase === "vote"){
      handleVoteTap(sid);
      return;
    }

    saveState();
    renderAll();
  });

  // long press show role (deal only)
  seatsGrid.addEventListener("pointerdown", (e) => {
    const seatEl = e.target.closest(".seat");
    if(!seatEl) return;
    if(S.phase !== "deal") return;

    const sid = Number(seatEl.dataset.id);
    const seat = S.seats.find(x => x.id === sid);
    if(!seat || !seat.alive) return;

    let cancelled = false;
    let t = setTimeout(() => {
      if(cancelled) return;
      openRoleModal(sid);
    }, 300);

    const cancel = () => { cancelled = true; clearTimeout(t); };
    seatEl.addEventListener("pointerup", cancel, { once:true });
    seatEl.addEventListener("pointerleave", cancel, { once:true });
    seatEl.addEventListener("pointercancel", cancel, { once:true });
  });

  // bottom
  btnBack.addEventListener("click", goBack);
  btnNext.addEventListener("click", goNext);
  btnMain.addEventListener("click", goMain);

  // top
  btnEye.addEventListener("click", () => { S.showGod = !S.showGod; saveState(); renderAll(); });
  btnAnn.addEventListener("click", () => openDrawer("ann"));
  btnTimer.addEventListener("click", () => openDrawer("timer"));
  btnSettings.addEventListener("click", () => openDrawer("set"));
  btnDice.addEventListener("click", openDice);

  // announce
  btnCloseAnn.addEventListener("click", () => closeDrawer("ann"));
  annBackdrop.addEventListener("click", () => closeDrawer("ann"));
  toggleAnnGod.addEventListener("change", () => {
    S.annGod = !!toggleAnnGod.checked;
    saveState();
    renderAnnounce();
  });

  // timer
  btnCloseTimer.addEventListener("click", () => closeDrawer("timer"));
  timerBackdrop.addEventListener("click", () => closeDrawer("timer"));
  timerPresets.addEventListener("click", (e) => {
    const b = e.target.closest(".chip[data-sec]");
    if(!b) return;
    setTimer(Number(b.dataset.sec));
  });
  btnTimerStart.addEventListener("click", timerStart);
  btnTimerPause.addEventListener("click", timerPause);
  btnTimerReset.addEventListener("click", timerReset);

  // settings
  btnCloseSet.addEventListener("click", () => closeDrawer("set"));
  setBackdrop.addEventListener("click", () => closeDrawer("set"));
  segEdge.addEventListener("click", () => { S.winMode="edge"; saveState(); renderAll(); });
  segCity.addEventListener("click", () => { S.winMode="city"; saveState(); renderAll(); });
  togglePolice.addEventListener("change", () => { S.hasPolice = !!togglePolice.checked; saveState(); renderAll(); });
  btnGotoSetup.addEventListener("click", () => resetToSetup(false));
  btnHardReset.addEventListener("click", () => resetToSetup(true));

  // role modal
  btnRoleClose.addEventListener("click", () => closeRoleModal(false));
  btnRoleDone.addEventListener("click", () => closeRoleModal(true));

  // dice
  btnDiceClose.addEventListener("click", () => closeModal(diceModal));
  btnDiceAgain.addEventListener("click", openDice);

  // thief
  btnThiefClose.addEventListener("click", () => closeModal(thiefModal));
}

/* =========================
   Render
========================= */
function renderAll(){
  uiStatus.textContent = statusLine();
  uiBoard.textContent = S.boardId ? S.boardId : "—";

  renderSettingsUI();
  renderSetupCard();
  renderPrompt();
  renderSeats();
  renderAnnounce();
  renderTimerUI();

  btnEye.style.background = S.showGod ? "rgba(255,233,186,.95)" : "rgba(255,255,255,.65)";
  btnEye.style.borderColor = S.showGod ? "#e5a14a" : "var(--stroke)";

  updateBottomButtons();

  if(S.phase === "vote") wireVoteFootButtons();
}

function renderSettingsUI(){
  segEdge.classList.toggle("primary", S.winMode === "edge");
  segCity.classList.toggle("primary", S.winMode === "city");
  togglePolice.checked = !!S.hasPolice;
}

function renderSetupCard(){
  const inSetup = (S.phase === "setup");
  setupCard.classList.toggle("hidden", !inSetup);

  setupCard.querySelectorAll(".chip[data-n]").forEach(ch => {
    ch.classList.toggle("active", Number(ch.dataset.n) === Number(S.players));
  });

  if(!inSetup) return;

  const boards = BOARDS.filter(b => b.players === Number(S.players));
  boardList.innerHTML = boards.map(b => {
    const tags = (b.tags || []).map(t => `<span class="chip" style="padding:6px 10px; font-size:12px;">${t}</span>`).join(" ");
    const roleSummary = summarizeBoardRoles(b);
    return `
      <div class="boardItem ${S.boardId === b.id ? "active":""}" data-id="${b.id}">
        <div class="boardName">${b.name}</div>
        <div class="boardSub">${b.id} ・ ${roleSummary}</div>
        <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">${tags}</div>
      </div>
    `;
  }).join("") || `<div class="hint">此人數暫無板子（可在 app.js BOARDS 增加）</div>`;
}

function renderPrompt(){
  if(S.phase === "setup"){
    promptTitle.textContent = "開局";
    promptText.textContent =
`1) 選人數
2) 選板子（點一下會變色）
3) 按底部「下一步」進入抽身分`;
    promptFoot.innerHTML = "";
    return;
  }

  if(S.phase === "deal"){
    const seen = S.seats.filter(s=>s.seen).length;
    promptTitle.textContent = `抽身分（${seen}/${S.players}）`;
    const thiefNote = hasRole("thief") ? "（含盜賊：盜賊看完身分後立刻二選一）" : "";
    promptText.textContent =
`上帝點選座位 → 玩家長按 0.3 秒看身分 → 按「我看完了」
看完會自動蓋牌（不會露出角色）
全部看完後按「開始夜晚」進入夜晚流程
${thiefNote}`;
    promptFoot.innerHTML = renderDealFoot();
    return;
  }

  if(S.phase === "night"){
    const steps = getNightSteps();
    const cur = steps[S.stepIdx];
    promptTitle.textContent = `夜晚 ${S.night}`;
    promptText.textContent = nightPrompt(cur);
    promptFoot.innerHTML = nightFoot(cur);
    return;
  }

  if(S.phase === "day"){
    promptTitle.textContent = `白天 ${S.day}`;
    promptText.textContent = dayPromptText();
    promptFoot.innerHTML = `<div class="hint">📣 公告可回顧每天公開資訊（可切上帝詳細）</div>`;
    return;
  }

  if(S.phase === "vote"){
    promptTitle.textContent = `投票（白天 ${S.day}）`;
    promptText.textContent =
`投票方式：
1) 先點「投票者」(活著的人)
2) 再點「投給誰」(活著的人)
- 點同一個座位可取消選取
- 已投的人會被記錄`;
    promptFoot.innerHTML = voteFoot();
    return;
  }
}

function renderSeats(){
  if(S.phase === "setup"){
    seatsGrid.classList.add("hidden");
    return;
  }
  seatsGrid.classList.remove("hidden");

  seatsGrid.innerHTML = S.seats.map(seat => {
    const isSel = (S.selectedSeat === seat.id);
    const deadCls = seat.alive ? "" : "dead";
    let extraCls = "";

    if(S.showGod){
      if(seat.camp === CAMP.GOOD) extraCls += " badgeGood";
      if(seat.camp === CAMP.WOLF) extraCls += " badgeWolf";
    }

    const line1 = renderSeatLine1(seat);
    const events = S.showGod ? renderSeatEvents(seat) : `<div class="seatEvents" style="height:18px;"></div>`;

    return `
      <div class="seat ${isSel?"selected":""} ${deadCls} ${extraCls}" data-id="${seat.id}">
        <div class="seatNum">${seat.id}</div>
        <div class="seatLine">${line1}</div>
        ${events}
      </div>
    `;
  }).join("");
}

function renderSeatLine1(seat){
  if(!seat.alive){
    return S.showGod ? `死亡：${seat.deathReason || "—"}` : "死亡";
  }

  if(S.phase === "deal"){
    // ✅ 蓋牌：不顯示角色
    return seat.seen ? "已看" : "長按看身分";
  }

  if(!S.showGod) return "存活";

  const r = seat.roleKey ? roleLabel(seat.roleKey) : "—";
  const c = seat.camp ? seat.camp : "—";
  return `${r}・${c}`;
}

function renderSeatEvents(seat){
  const icons = (seat.events || []).map(ev => ev.icon);
  return `<div class="seatEvents">${icons.join("")}</div>`;
}

function renderAnnounce(){
  toggleAnnGod.checked = !!S.annGod;

  if(!S.logs.length){
    annText.textContent = "（目前沒有公告紀錄）";
    return;
  }

  const pub = [];
  const god = [];

  S.logs.forEach((log, idx) => {
    pub.push(`【${idx+1}】${log.title}\n${log.publicText}\n`);
    if(log.godText) god.push(`【${idx+1}】${log.title}\n${log.godText}\n`);
  });

  annText.textContent = S.annGod
    ? (pub.join("\n") + "\n\n—— 上帝詳細 ——\n\n" + god.join("\n"))
    : pub.join("\n");
}

function statusLine(){
  if(S.phase === "setup") return `SETUP`;
  if(S.phase === "deal")  return `DEAL`;
  if(S.phase === "night") return `NIGHT ${S.night} / step ${S.stepIdx+1}`;
  if(S.phase === "day")   return `DAY ${S.day}`;
  if(S.phase === "vote")  return `DAY ${S.day} / 投票`;
  return "—";
}

function updateBottomButtons(){
  if(S.phase === "setup"){
    btnMain.textContent = "—";
    btnMain.disabled = true;
    return;
  }
  if(S.phase === "deal"){
    btnMain.textContent = "開始夜晚";
    btnMain.disabled = !allSeen() || (hasRole("thief") && !S.thiefDone);
    return;
  }
  if(S.phase === "night"){
    btnMain.textContent = "天亮睜眼";
    btnMain.disabled = false;
    return;
  }
  if(S.phase === "day"){
    btnMain.textContent = "開始投票";
    btnMain.disabled = false;
    return;
  }
  if(S.phase === "vote"){
    btnMain.textContent = "結束投票";
    btnMain.disabled = false;
    return;
  }
}

/* =========================
   Flow
========================= */
function goNext(){
  if(S.phase === "setup"){
    if(!S.boardId) return toast("請先選板子");
    startDeal();
    return;
  }
  if(S.phase === "deal"){
    toast("抽身分完成後按「開始夜晚」");
    return;
  }
  if(S.phase === "night"){
    confirmNightStep();
    return;
  }
  if(S.phase === "day"){
    startVote();
    return;
  }
  if(S.phase === "vote"){
    finishVoteAndExile();
    return;
  }
}

function goBack(){
  if(S.phase === "deal"){
    resetToSetup(false);
    return;
  }
  if(S.phase === "night"){
    S.stepIdx = clamp(S.stepIdx - 1, 0, getNightSteps().length - 1);
    S.selectedSeat = null;
    saveState(); renderAll();
    return;
  }
  if(S.phase === "vote"){
    S.phase = "day";
    S.voteFrom = null;
    saveState(); renderAll();
  }
}

function goMain(){
  if(S.phase === "deal"){
    if(!allSeen()) return toast("還有人沒看身分");
    if(hasRole("thief") && !S.thiefDone) return toast("盜賊尚未選角");
    startNight();
    return;
  }
  if(S.phase === "night"){
    endNightToDay();
    return;
  }
  if(S.phase === "day"){
    startVote();
    return;
  }
  if(S.phase === "vote"){
    finishVoteAndExile();
  }
}

/* =========================
   Setup / Deal
========================= */
function getBoard(){ return BOARDS.find(b => b.id === S.boardId) || null; }

function summarizeBoardRoles(b){
  const parts = [];
  Object.entries(b.roles).forEach(([rk, c]) => parts.push(`${c}×${roleLabel(rk)}`));
  const total = Object.values(b.roles).reduce((a,b)=>a+b,0);
  const extra = total - b.players;
  return parts.join(" + ") + (extra>0 ? `（底牌${extra}）` : "");
}

function resetToSetup(hard){
  if(hard){
    localStorage.removeItem(STORAGE_KEY);
    S = deepClone(DEFAULT_STATE);
    renderAll();
    return;
  }
  const keep = { winMode:S.winMode, hasPolice:S.hasPolice, annGod:S.annGod };
  S = deepClone(DEFAULT_STATE);
  Object.assign(S, keep);
  saveState();
  renderAll();
}

function startDeal(){
  const b = getBoard();
  if(!b) return toast("找不到板子");

  S.phase = "deal";
  S.day = 1;
  S.night = 1;
  S.stepIdx = 0;
  S.showGod = false;
  S.selectedSeat = null;

  S.seats = [];
  for(let i=1;i<=S.players;i++){
    S.seats.push({ id:i, alive:true, roleKey:null, camp:null, seen:false, deathReason:null, events:[] });
  }

  // ✅ deck size 可以 > players（盜賊底牌）
  const deck = [];
  Object.entries(b.roles).forEach(([rk, count]) => {
    for(let i=0;i<count;i++) deck.push(rk);
  });

  const totalCards = deck.length;
  if(totalCards < S.players){
    return toast("板子角色卡不足（小於人數）");
  }

  shuffle(deck);

  const dealt = deck.slice(0, S.players);
  const bottom = deck.slice(S.players); // ✅ 剩下的全部都是底牌（盜賊會用到）

  // assign dealt to seats
  shuffle(dealt);
  S.thiefSeatId = null;
  S.extraCards = bottom;  // ✅ 未被抽到的角色

  for(let i=0;i<S.seats.length;i++){
    const rk = dealt[i];
    S.seats[i].roleKey = rk;
    S.seats[i].camp = roleCamp(rk);
    if(rk === "thief") S.thiefSeatId = S.seats[i].id;
  }

  S.thiefDone = !dealt.includes("thief");

  S.witchHealUsed = false;
  S.witchPoisonUsed = false;

  S.logs = [];
  addLog("開局", `板子：${b.id}\n人數：${S.players}\n勝負：${S.winMode==="edge"?"屠邊":"屠城"}\n上警：${S.hasPolice?"開":"關"}`, `配置：${summarizeBoardRoles(b)}\n底牌：${S.extraCards.map(roleLabel).join("、")||"—"}`);

  saveState();
  renderAll();
}

function allSeen(){ return S.seats.every(s => s.seen); }
function hasRole(roleKey){ return S.seats.some(s => s.roleKey === roleKey); }
function hasAlive(roleKey){ return S.seats.some(s => s.alive && s.roleKey === roleKey); }

/* =========================
   Role modal / Thief
========================= */
let roleModalSeatId = null;

function openRoleModal(seatId){
  const seat = S.seats.find(s=>s.id===seatId);
  if(!seat) return;

  roleModalSeatId = seatId;
  roleModalTitle.textContent = `${seat.id}號 身分`;
  roleModalRole.textContent = roleLabel(seat.roleKey);
  roleModalCamp.textContent = `陣營：${seat.camp}`;

  openModal(roleModal);
}

function closeRoleModal(markSeen){
  if(roleModalSeatId == null){
    closeModal(roleModal);
    return;
  }

  const seat = S.seats.find(s=>s.id===roleModalSeatId);
  if(seat && markSeen){
    seat.seen = true;

    // ✅ 盜賊：在抽身分環節就要選
    if(seat.roleKey === "thief" && !S.thiefDone){
      closeModal(roleModal);
      roleModalSeatId = null;
      saveState();
      renderAll();
      openThiefChoose();
      return;
    }
  }

  closeModal(roleModal);
  roleModalSeatId = null;
  saveState();
  renderAll();
}

function openThiefChoose(){
  const seat = S.seats.find(s=>s.id===S.thiefSeatId);
  if(!seat) return;

  // ✅ 從「未被抽到」的角色中隨機抽兩張
  if(!Array.isArray(S.extraCards) || S.extraCards.length < 2){
    S.thiefDone = true;
    saveState(); renderAll();
    toast("底牌不足，盜賊略過");
    return;
  }

  const pool = shuffle(S.extraCards.slice());
  const a = pool[0];
  const b = pool[1];

  const aIsWolf = roleCamp(a) === CAMP.WOLF;
  const bIsWolf = roleCamp(b) === CAMP.WOLF;
  const mustWolf = (aIsWolf !== bIsWolf);

  thiefHint.textContent =
`你是盜賊：
從「未被抽到的角色」隨機兩張底牌二選一。
若其中包含狼人牌，必須選狼人陣營。`;

  btnThiefA.textContent = roleLabel(a);
  btnThiefB.textContent = roleLabel(b);

  btnThiefA.disabled = mustWolf && !aIsWolf;
  btnThiefB.disabled = mustWolf && !bIsWolf;

  btnThiefA.onclick = () => chooseThiefRole(a, b);
  btnThiefB.onclick = () => chooseThiefRole(b, a);

  openModal(thiefModal);
}

function chooseThiefRole(chosen, discarded){
  const seat = S.seats.find(s=>s.id===S.thiefSeatId);
  if(!seat) return;

  seat.roleKey = chosen;
  seat.camp = roleCamp(chosen);

  // ✅ 盜賊選到的角色來自底牌 => 本來就沒被任何號碼抽到
  // 選完後：底牌直接清空（避免任何流程誤用）
  S.extraCards = [];
  S.thiefDone = true;

  addLog("盜賊完成選角", "（公開：盜賊已完成選角）",
    `盜賊座位：${seat.id}號\n選擇：${roleLabel(chosen)}\n捨棄：${roleLabel(discarded)}`);

  closeModal(thiefModal);
  saveState();
  renderAll();
}

/* =========================
   Night flow（依存在角色動態生成，順序：守→狼→預→女）
========================= */
function getNightSteps(){
  const steps = [];
  if(hasAlive("guard")) steps.push({ key:"guard", name:"守衛請睜眼（選守護）" });
  steps.push({ key:"wolf", name:"狼人請睜眼（選刀人）" });
  if(hasAlive("seer"))  steps.push({ key:"seer", name:"預言家請睜眼（查驗一人）" });
  if(hasAlive("witch")) steps.push({ key:"witch", name:"女巫請睜眼（解藥/毒藥）" });
  return steps;
}

function startNight(){
  S.phase = "night";
  S.stepIdx = 0;
  S.selectedSeat = null;
  S.nightAct = { guard:null, wolf:null, seer:null, witchSave:false, witchPoison:null, seerResult:null };
  saveState();
  renderAll();
}

function nightPrompt(cur){
  const list = getNightSteps().map((s, idx) => `${idx+1}. ${s.name}`).join("\n");
  const now = `👉 目前：${cur ? (S.stepIdx+1 + ". " + cur.name) : "—"}`;

  let extra = "";
  if(cur?.key === "witch"){
    const wolfTarget = S.nightAct.wolf;
    extra =
`\n\n【女巫提示】\n狼人刀口：${wolfTarget ? wolfTarget + "號" : "（尚未選）"}\n- 點刀口＝解藥💊\n- 點其他人＝毒藥🧪\n- 同一晚只能擇一`;
  }
  if(cur?.key === "seer" && S.nightAct.seerResult){
    extra += `\n\n查驗結果：${S.nightAct.seerResult}`;
  }

  return `夜晚開始：\n${list}\n\n${now}\n（點座位選取；再點同號取消；按「下一步」確認）${extra}`;
}

function nightFoot(cur){
  if(cur?.key === "witch"){
    const heal = S.witchHealUsed ? "💊已用" : "💊可用";
    const poison = S.witchPoisonUsed ? "🧪已用" : "🧪可用";
    return `<div class="hint">${heal}　${poison}</div>`;
  }
  return `<div class="hint">點座位選取；再點同號取消</div>`;
}

function confirmNightStep(){
  const steps = getNightSteps();
  const cur = steps[S.stepIdx];
  if(!cur) return;

  if(cur.key === "guard"){
    if(!S.selectedSeat) return toast("請選守護對象");
    S.nightAct.guard = S.selectedSeat;
    addSeatEvent(S.selectedSeat, { icon:"🛡️", text:"守護" });
  }

  if(cur.key === "wolf"){
    if(!S.selectedSeat) return toast("請選狼人刀口");
    S.nightAct.wolf = S.selectedSeat;
  }

  if(cur.key === "seer"){
    if(!S.selectedSeat) return toast("請選查驗對象");
    S.nightAct.seer = S.selectedSeat;
    const t = S.seats.find(s=>s.id===S.selectedSeat);
    S.nightAct.seerResult = t ? `${t.id}號：${t.camp}` : "—";
  }

  if(cur.key === "witch"){
    const wolfTarget = S.nightAct.wolf;

    if(S.selectedSeat){
      if(wolfTarget && S.selectedSeat === wolfTarget){
        if(S.witchHealUsed) return toast("解藥已用");
        if(S.nightAct.witchPoison) return toast("同晚已選毒，請先取消");
        S.nightAct.witchSave = !S.nightAct.witchSave;
      }else{
        if(S.witchPoisonUsed) return toast("毒藥已用");
        if(S.nightAct.witchSave) return toast("同晚已選救，請先取消");
        S.nightAct.witchPoison = (S.nightAct.witchPoison === S.selectedSeat) ? null : S.selectedSeat;
      }
    }

    if(S.nightAct.witchSave) S.witchHealUsed = true;
    if(S.nightAct.witchPoison) S.witchPoisonUsed = true;
  }

  S.selectedSeat = null;
  S.stepIdx++;

  if(S.stepIdx >= steps.length){
    endNightToDay();
    return;
  }

  saveState();
  renderAll();
}

function endNightToDay(){
  const wolfTarget = S.nightAct.wolf;
  const guardTarget = S.nightAct.guard;
  const saved = S.nightAct.witchSave;
  const poisoned = S.nightAct.witchPoison;

  const deaths = [];
  if(wolfTarget){
    const protectedByGuard = (guardTarget && guardTarget === wolfTarget);
    if(!saved && !protectedByGuard){
      deaths.push({ id:wolfTarget, reason:"狼刀", icon:"🗡️" });
    }else{
      if(protectedByGuard) addSeatEvent(wolfTarget, { icon:"🛡️", text:"守到" });
      if(saved) addSeatEvent(wolfTarget, { icon:"💊", text:"救" });
    }
  }
  if(poisoned){
    deaths.push({ id:poisoned, reason:"毒死", icon:"🧪" });
  }

  const uniq = new Map();
  deaths.forEach(d => { if(!uniq.has(d.id)) uniq.set(d.id, d); });

  const diedIds = [];
  uniq.forEach((d) => {
    const seat = S.seats.find(s=>s.id===d.id);
    if(seat && seat.alive){
      seat.alive = false;
      seat.deathReason = d.reason;
      addSeatEvent(d.id, { icon:"☠️", text:d.reason });
      diedIds.push(d.id);
    }
  });

  const publicText = diedIds.length === 0
    ? "昨夜結果：平安夜"
    : `昨夜死亡：${diedIds.map(x=>x+"號").join("、")}`;

  const godText =
`守衛：${guardTarget ? guardTarget+"號" : "—"}
狼人刀：${wolfTarget ? wolfTarget+"號" : "—"}
預言家：${S.nightAct.seer ? (S.nightAct.seer+"號 / "+(S.nightAct.seerResult||"—")) : "—"}
女巫：${S.nightAct.witchSave ? "救💊" : "未救"} / ${S.nightAct.witchPoison ? ("毒🧪 "+S.nightAct.witchPoison+"號") : "未毒"}`;

  addLog(`夜晚${S.night}結束 → 天亮`, publicText, godText);

  S.phase = "day";
  S.selectedSeat = null;
  S.stepIdx = 0;

  S.day += 1;
  S.night += 1;

  saveState();
  renderAll();
}

function dayPromptText(){
  const last = S.logs[S.logs.length-1];
  const lastPublic = last ? last.publicText : "—";
  const flow = `白天流程：自由發言 → ${(S.hasPolice ? "可上警 → " : "")}推理/辯論 → 投票`;
  return `天亮了，請宣佈昨夜結果：\n- ${lastPublic}\n\n${flow}\n\n按「開始投票」進入投票統計。`;
}

/* =========================
   Vote（保持你要的公告格式）
========================= */
function startVote(){
  S.phase = "vote";
  S.votes = {};
  S.voteFrom = null;
  S.selectedSeat = null;
  saveState();
  renderAll();
}

function handleVoteTap(seatId){
  const seat = S.seats.find(s=>s.id===seatId);
  if(!seat || !seat.alive) return toast("只能選存活者");

  if(!S.voteFrom){
    S.voteFrom = seatId;
    toast(`投票者：${seatId}號，請再點投給誰`);
    saveState(); renderAll();
    return;
  }

  if(S.voteFrom === seatId){
    S.voteFrom = null;
    toast("取消投票者選取");
    saveState(); renderAll();
    return;
  }

  S.votes[String(S.voteFrom)] = String(seatId);
  toast(`${S.voteFrom}號 → 投給 ${seatId}號`);
  S.voteFrom = null;

  saveState();
  renderAll();
}

function voteFoot(){
  const alive = S.seats.filter(s=>s.alive).map(s=>s.id);
  const votedCount = Object.keys(S.votes).length;
  const total = alive.length;
  return `
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">
      <button type="button" class="chip" id="btnAbstain">棄票</button>
      <button type="button" class="chip" id="btnClearVote">清除本輪</button>
      <div class="hint" style="margin-left:auto;">已投：${votedCount}/${total}</div>
    </div>
  `;
}

function wireVoteFootButtons(){
  const btnAbstain = $("btnAbstain");
  const btnClearVote = $("btnClearVote");

  if(btnAbstain){
    btnAbstain.onclick = () => {
      if(!S.voteFrom) return toast("請先點投票者");
      S.votes[String(S.voteFrom)] = "abstain";
      toast(`${S.voteFrom}號 → 棄票`);
      S.voteFrom = null;
      saveState(); renderAll();
    };
  }
  if(btnClearVote){
    btnClearVote.onclick = () => {
      S.votes = {};
      S.voteFrom = null;
      toast("已清除本輪投票");
      saveState(); renderAll();
    };
  }
}

function finishVoteAndExile(){
  const alive = S.seats.filter(s=>s.alive).map(s=>s.id);

  const buckets = new Map();
  const abstain = [];

  alive.forEach(voterId => {
    const v = S.votes[String(voterId)];
    if(!v) return;
    if(v === "abstain") abstain.push(voterId);
    else{
      const t = Number(v);
      if(!buckets.has(t)) buckets.set(t, []);
      buckets.get(t).push(voterId);
    }
  });

  const lines = [];
  let maxVotes = 0;
  let maxTargets = [];

  [...buckets.entries()].sort((a,b)=>a[0]-b[0]).forEach(([target, voters]) => {
    const count = voters.length;
    lines.push(`投給${target}號的有${voters.join("、")}（${count}票）`);
    if(count > maxVotes){ maxVotes = count; maxTargets = [target]; }
    else if(count === maxVotes && count > 0){ maxTargets.push(target); }
  });

  if(abstain.length){
    lines.push(`棄票的有${abstain.join("、")}（${abstain.length}票）`);
  }

  let exiled = null;
  if(maxTargets.length === 1){
    exiled = maxTargets[0];
    lines.push(`${exiled}號得到最高票遭到放逐`);
  }else if(maxTargets.length > 1){
    lines.push(`最高票同票：${maxTargets.join("、")}（本輪無放逐或請自行裁定）`);
  }else{
    lines.push("本輪尚無有效投票（或全棄票）");
  }

  if(exiled){
    const seat = S.seats.find(s=>s.id===exiled);
    if(seat && seat.alive){
      seat.alive = false;
      seat.deathReason = "放逐";
      addSeatEvent(exiled, { icon:"📮", text:"放逐" });
    }
  }

  addLog(`白天${S.day-1}投票結果`, lines.join("\n"), `原始票表：\n${JSON.stringify(S.votes, null, 2)}`);

  S.phase = "night";
  S.stepIdx = 0;
  S.votes = {};
  S.voteFrom = null;
  S.selectedSeat = null;
  S.nightAct = { guard:null, wolf:null, seer:null, witchSave:false, witchPoison:null, seerResult:null };

  saveState();
  renderAll();
}

/* =========================
   Helpers: logs / events
========================= */
function addSeatEvent(seatId, ev){
  const seat = S.seats.find(s=>s.id===seatId);
  if(!seat) return;
  seat.events = seat.events || [];
  seat.events.push(ev);
}

function addLog(title, publicText, godText){
  S.logs.push({ title, publicText, godText });
}

/* =========================
   Deal Foot
========================= */
function renderDealFoot(){
  if(hasRole("thief") && !S.thiefDone){
    return `<div class="hint">⚠️ 盜賊尚未完成選角（盜賊看完身分會立刻二選一）</div>`;
  }
  if(allSeen()){
    return `<div class="hint">✅ 全部看完了，可以按「開始夜晚」</div>`;
  }
  return `<div class="hint">（再點一次同號可取消選取）</div>`;
}

/* =========================
   Drawer / Modal
========================= */
function openDrawer(which){
  if(which==="ann"){ annBackdrop.classList.remove("hidden"); annDrawer.classList.remove("hidden"); }
  if(which==="timer"){ timerBackdrop.classList.remove("hidden"); timerDrawer.classList.remove("hidden"); }
  if(which==="set"){ setBackdrop.classList.remove("hidden"); setDrawer.classList.remove("hidden"); }
}
function closeDrawer(which){
  if(which==="ann"){ annBackdrop.classList.add("hidden"); annDrawer.classList.add("hidden"); }
  if(which==="timer"){ timerBackdrop.classList.add("hidden"); timerDrawer.classList.add("hidden"); }
  if(which==="set"){ setBackdrop.classList.add("hidden"); setDrawer.classList.add("hidden"); }
}
function openModal(el){ el.classList.remove("hidden"); }
function closeModal(el){ el.classList.add("hidden"); }

/* =========================
   Dice
========================= */
function openDice(){
  const alive = S.seats.filter(s=>s.alive).map(s=>s.id);
  if(!alive.length) return toast("沒有人存活");
  const pick = alive[Math.floor(Math.random()*alive.length)];
  diceResult.textContent = `${pick}號`;
  openModal(diceModal);
}

/* =========================
   Timer
========================= */
let timer = { totalSec:90, remainSec:90, running:false, t:null };

function formatMMSS(sec){
  sec = Math.max(0, sec|0);
  const m = String(Math.floor(sec/60)).padStart(2,"0");
  const s = String(sec%60).padStart(2,"0");
  return `${m}:${s}`;
}

function setTimer(sec){
  timer.totalSec = sec;
  timer.remainSec = sec;
  timer.running = false;
  if(timer.t) clearInterval(timer.t);
  timer.t = null;
  renderTimerUI();
}

function timerStart(){
  if(timer.running) return;
  timer.running = true;
  if(timer.t) clearInterval(timer.t);
  timer.t = setInterval(() => {
    timer.remainSec--;
    if(timer.remainSec <= 0){
      timer.remainSec = 0;
      timerPause();
      try{ navigator.vibrate && navigator.vibrate([200,120,200]); }catch(_){}
    }
    renderTimerUI();
  }, 1000);
  renderTimerUI();
}

function timerPause(){
  timer.running = false;
  if(timer.t) clearInterval(timer.t);
  timer.t = null;
  renderTimerUI();
}

function timerReset(){
  timer.remainSec = timer.totalSec;
  timerPause();
  renderTimerUI();
}

function renderTimerUI(){
  timerBig.textContent = formatMMSS(timer.remainSec);
  btnTimerStart.classList.toggle("primary", timer.running);
}

/* =========================
   toast
========================= */
let toastT = null;
function toast(msg){
  const old = uiStatus.textContent;
  uiStatus.textContent = msg;
  if(toastT) clearTimeout(toastT);
  toastT = setTimeout(() => { uiStatus.textContent = old; }, 900);
}