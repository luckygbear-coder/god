/* =========================
  狼人殺上帝輔助 - app.js
  (配合你給的 HTML 結構)
========================= */

/* ---------- iOS 防放大/防選取/防長按選單 ---------- */
(function iosGuards(){
  // 禁止長按跳選單
  window.addEventListener("contextmenu", e => e.preventDefault(), {passive:false});

  // 禁止 iOS gesture 縮放
  window.addEventListener("gesturestart", e => e.preventDefault(), {passive:false});
  window.addEventListener("gesturechange", e => e.preventDefault(), {passive:false});
  window.addEventListener("gestureend", e => e.preventDefault(), {passive:false});

  // 防雙擊放大（Safari 有時會忽略 user-scalable=no）
  let lastTouchEnd = 0;
  document.addEventListener("touchend", function(e){
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, {passive:false});
})();

/* ---------- DOM ---------- */
const $ = (id)=>document.getElementById(id);

const uiStatus = $("uiStatus");
const uiBoard  = $("uiBoard");

const promptTitle = $("promptTitle");
const promptText  = $("promptText");
const promptFoot  = $("promptFoot");

const setupCard = $("setupCard");
const boardList = $("boardList");

const seatsGrid = $("seatsGrid");

const btnAnn = $("btnAnn");
const btnTimer = $("btnTimer");
const btnEye = $("btnEye");
const btnDice = $("btnDice");
const btnSettings = $("btnSettings");

const btnBack = $("btnBack");
const btnMain = $("btnMain");
const btnNext = $("btnNext");

/* drawers */
const timerBackdrop = $("timerBackdrop");
const timerDrawer = $("timerDrawer");
const btnCloseTimer = $("btnCloseTimer");
const timerBig = $("timerBig");
const btnTimerStart = $("btnTimerStart");
const btnTimerPause = $("btnTimerPause");
const btnTimerReset = $("btnTimerReset");
const timerPresets = $("timerPresets");

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

/* modals */
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

/* chips: 人數 */
document.querySelectorAll(".chip[data-n]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const n = Number(btn.dataset.n);
    setPlayers(n);
  });
});

/* ---------- 資料：角色 ---------- */
const ROLE = {
  VILLAGER:{ id:"villager", name:"平民", camp:"good" },
  WOLF:{ id:"wolf", name:"狼人", camp:"wolf" },
  SEER:{ id:"seer", name:"預言家", camp:"good" },
  WITCH:{ id:"witch", name:"女巫", camp:"good" },
  HUNTER:{ id:"hunter", name:"獵人", camp:"good" },
  GUARD:{ id:"guard", name:"守衛", camp:"good" },
  IDIOT:{ id:"idiot", name:"白痴", camp:"good" },
  THIEF:{ id:"thief", name:"盜賊", camp:"good" }, // 盜賊初始視為好人；選到狼牌會變狼
  CUPID:{ id:"cupid", name:"邱比特", camp:"good" },
};

function roleById(id){
  return Object.values(ROLE).find(r=>r.id===id) || ROLE.VILLAGER;
}

/* ---------- 板子定義（你可再加） ---------- */
/**
 * seatsRoles: 正式玩家席位的角色配置（合計=players）
 * extrasCount: 盜賊用「底牌」張數（通常 2）
 * extrasPool: 底牌抽取候選（會從這裡隨機抽 extrasCount 張）
 */
const BOARDS = [
  {
    id:"official-12",
    title:"12 人官方標準局",
    tags:["官方","標準","含白痴"],
    players:12,
    winMode:"edge",
    hasPolice:true,
    seatsRoles:{
      wolf:4, seer:1, witch:1, hunter:1, guard:1, idiot:1, villager:3
    },
    extrasCount:0,
  },
  {
    id:"12-edge-nopolice",
    title:"12 人（屠邊・無上警）",
    tags:["測試","屠邊","無上警"],
    players:12,
    winMode:"edge",
    hasPolice:false,
    seatsRoles:{
      wolf:4, seer:1, witch:1, hunter:1, guard:1, idiot:1, villager:3
    },
    extrasCount:0,
  },
  {
    id:"12-thief",
    title:"12 人含盜賊（+2 底牌）",
    tags:["盜賊","變體"],
    players:12,
    winMode:"edge",
    hasPolice:true,
    // ✅ 你描述的：4狼、預言家、女巫、獵人、守衛、白痴、盜賊、2民 = 12
    seatsRoles:{
      wolf:4, seer:1, witch:1, hunter:1, guard:1, idiot:1, thief:1, villager:2
    },
    extrasCount:2,
    // ✅ 底牌候選：不含盜賊（盜賊是玩家），可以含狼/神/民
    extrasPool:["wolf","villager","villager","seer","witch","hunter","guard","idiot"]
  },

  // 你要 9 / 10 人可以再加（先留基本可用）
  {
    id:"official-10",
    title:"10 人簡易局",
    tags:["官方","簡化"],
    players:10,
    winMode:"edge",
    hasPolice:true,
    seatsRoles:{ wolf:3, seer:1, witch:1, hunter:1, guard:1, villager:3 },
    extrasCount:0
  },
  {
    id:"official-9",
    title:"9 人新手局",
    tags:["官方","新手"],
    players:9,
    winMode:"edge",
    hasPolice:true,
    seatsRoles:{ wolf:3, seer:1, witch:1, hunter:1, guard:1, villager:2 },
    extrasCount:0
  },
];

/* ---------- 狀態 ---------- */
const LS_KEY = "bear_werewolf_god_v1";

const defaultState = ()=>{
  return {
    phase:"SETUP",           // SETUP | DEAL | NIGHT | DAY | VOTE
    step:1,
    day:1,
    players:12,
    boardId:"official-12",

    winMode:"edge",
    hasPolice:true,

    godEye:false,

    // seats: [{alive, roleId, camp, seen, badges:[], deathReason:null}]
    seats:[],

    // 抽身分
    dealSeenCount:0,
    selectedSeat:null,

    // 盜賊
    extras:[],               // 底牌角色 id 陣列
    thiefSeat:null,
    thiefChosen:false,

    // 夜晚/白天流程
    flowIndex:0,
    flow:[],                 // [{type, label, requiresTarget}]
    pendingTarget:null,      // 選到的目標座位

    // 夜晚結果暫存（用於公告）
    night: {
      guard:null,
      wolves:null,
      seer:null,
      seerResult:null,
      witchSave:null,
      witchPoison:null
    },

    // 投票
    votes: {},               // voterSeat -> targetSeat|"abstain"
    voteTarget:null,

    // 公告記錄
    logs:[],                 // {public, text, day, phase}
  };
};

let S = loadState();

/* ---------- init ---------- */
bootstrap();

function bootstrap(){
  if (!S.seats || S.seats.length !== S.players){
    initSeats();
  }
  renderBoards();
  renderAll();
  bindUI();
}

/* ---------- Storage ---------- */
function saveState(){
  localStorage.setItem(LS_KEY, JSON.stringify(S));
}
function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultState();
    const obj = JSON.parse(raw);
    return Object.assign(defaultState(), obj);
  }catch(e){
    return defaultState();
  }
}

/* ---------- Setup / Board ---------- */
function setPlayers(n){
  S.players = n;
  // 找一個 matching board
  const found = BOARDS.find(b=>b.players===n && b.id.startsWith("official")) || BOARDS.find(b=>b.players===n) || BOARDS[0];
  S.boardId = found.id;
  // reset seats & phase
  hardReset(false);
  S.players = n;
  S.boardId = found.id;
  applyBoard(found);
  initSeats();
  saveState();
  renderBoards();
  renderAll();
}

function applyBoard(board){
  S.winMode = board.winMode ?? "edge";
  S.hasPolice = board.hasPolice ?? true;
}

function currentBoard(){
  return BOARDS.find(b=>b.id===S.boardId) || BOARDS[0];
}

function initSeats(){
  S.seats = Array.from({length:S.players}, (_,i)=>({
    idx:i+1,
    alive:true,
    roleId:null,
    camp:null,
    seen:false,
    badges:[], // e.g. ["💊","🧪","🛡️","🔪"]
    deathReason:null
  }));
  S.dealSeenCount = 0;
  S.selectedSeat = null;
  S.extras = [];
  S.thiefSeat = null;
  S.thiefChosen = false;
  S.flowIndex = 0;
  S.flow = [];
  S.pendingTarget = null;
  S.night = { guard:null, wolves:null, seer:null, seerResult:null, witchSave:null, witchPoison:null };
  S.votes = {};
  S.voteTarget = null;
}

function renderBoards(){
  const board = currentBoard();
  // 人數 chip active
  document.querySelectorAll(".chip[data-n]").forEach(b=>{
    b.classList.toggle("active", Number(b.dataset.n)===S.players);
  });

  // board list
  boardList.innerHTML = "";
  BOARDS.filter(b=>b.players===S.players).forEach(b=>{
    const div = document.createElement("div");
    div.className = "boardItem" + (b.id===S.boardId ? " selected":"");
    div.dataset.id = b.id;

    const rolesLine = boardRolesSummary(b);
    div.innerHTML = `
      <div class="boardName">${escapeHtml(b.title)}</div>
      <div class="boardSub">${escapeHtml(b.id)} ・ ${escapeHtml(rolesLine)}</div>
      <div class="chips" style="margin-top:8px; gap:8px;">
        ${(b.tags||[]).map(t=>`<span class="chip" style="padding:6px 10px; font-size:12px; cursor:default;">${escapeHtml(t)}</span>`).join("")}
      </div>
    `;
    div.addEventListener("click", ()=>{
      S.boardId = b.id;
      applyBoard(b);
      // reset only if still setup
      if (S.phase==="SETUP"){
        initSeats();
      }
      saveState();
      renderBoards();
      renderAll();
    });
    boardList.appendChild(div);
  });
}

function boardRolesSummary(b){
  const sr = b.seatsRoles || {};
  const parts = [];
  if (sr.wolf) parts.push(`${sr.wolf}狼`);
  if (sr.seer) parts.push(`${sr.seer}預言家`);
  if (sr.witch) parts.push(`${sr.witch}女巫`);
  if (sr.hunter) parts.push(`${sr.hunter}獵人`);
  if (sr.guard) parts.push(`${sr.guard}守衛`);
  if (sr.idiot) parts.push(`${sr.idiot}白痴`);
  if (sr.cupid) parts.push(`${sr.cupid}邱比特`);
  if (sr.thief) parts.push(`${sr.thief}盜賊`);
  if (sr.villager) parts.push(`${sr.villager}平民`);
  if (b.extrasCount) parts.push(`底牌${b.extrasCount}`);
  return parts.join(" + ");
}

/* ---------- UI bindings ---------- */
function bindUI(){
  btnEye.addEventListener("click", ()=>{
    S.godEye = !S.godEye;
    saveState();
    renderSeats();
    toast(S.godEye ? "👁 上帝視角：開" : "👁 上帝視角：關");
  });

  btnSettings.addEventListener("click", ()=>openDrawer("set"));
  btnAnn.addEventListener("click", ()=>openDrawer("ann"));
  btnTimer.addEventListener("click", ()=>openDrawer("timer"));

  btnCloseTimer.addEventListener("click", ()=>closeDrawer("timer"));
  timerBackdrop.addEventListener("click", ()=>closeDrawer("timer"));

  btnCloseAnn.addEventListener("click", ()=>closeDrawer("ann"));
  annBackdrop.addEventListener("click", ()=>closeDrawer("ann"));

  btnCloseSet.addEventListener("click", ()=>closeDrawer("set"));
  setBackdrop.addEventListener("click", ()=>closeDrawer("set"));

  // 勝負模式
  segEdge.addEventListener("click", ()=>{
    S.winMode="edge"; saveState(); renderAll();
  });
  segCity.addEventListener("click", ()=>{
    S.winMode="city"; saveState(); renderAll();
  });

  togglePolice.addEventListener("change", ()=>{
    S.hasPolice = togglePolice.checked;
    saveState(); renderAll();
  });

  btnGotoSetup.addEventListener("click", ()=>{
    // 回到開局（保留人數預設）
    const n = S.players;
    hardReset(false);
    S.players = n;
    initSeats();
    S.phase = "SETUP";
    saveState();
    renderBoards();
    renderAll();
    closeDrawer("set");
  });

  btnHardReset.addEventListener("click", ()=>{
    if (!confirm("確定要清空全部資料？")) return;
    hardReset(true);
  });

  // Dice
  btnDice.addEventListener("click", ()=>{
    openModal("dice");
    rollDice();
  });
  btnDiceAgain.addEventListener("click", rollDice);
  btnDiceClose.addEventListener("click", ()=>closeModal("dice"));

  // Role modal
  btnRoleClose.addEventListener("click", ()=>closeModal("role"));
  btnRoleDone.addEventListener("click", ()=>{
    // ✅ 看完＝標記 seen，並自動蓋牌（座位格不顯示角色）
    if (S._roleShowingSeat){
      const seat = S.seats[S._roleShowingSeat-1];
      if (seat && !seat.seen){
        seat.seen = true;
        S.dealSeenCount++;
      }
      S._roleShowingSeat = null;
      closeModal("role");
      saveState();
      renderAll();

      // ✅ 如果是盜賊座位，看完立刻進入盜賊二選一
      const thiefSeat = S.thiefSeat;
      if (S.phase==="DEAL" && thiefSeat && seat && seat.idx===thiefSeat && !S.thiefChosen){
        // 盜賊看完身分後立刻彈出選角
        openThiefChoose();
      }
    }else{
      closeModal("role");
    }
  });

  // Thief modal
  btnThiefClose.addEventListener("click", ()=>{/* 盜賊必須選完才行 */});

  // Bottom buttons
  btnBack.addEventListener("click", onBack);
  btnNext.addEventListener("click", onNext);
  btnMain.addEventListener("click", onMain);

  // Timer
  timerPresets.addEventListener("click", (e)=>{
    const t = e.target.closest(".chip[data-sec]");
    if (!t) return;
    setTimer(Number(t.dataset.sec));
  });
  btnTimerStart.addEventListener("click", timerStart);
  btnTimerPause.addEventListener("click", timerPause);
  btnTimerReset.addEventListener("click", ()=>setTimer(S._timerInit||90));

  // 公告
  toggleAnnGod.addEventListener("change", ()=>{
    renderAnn();
  });
}

/* ---------- Render ---------- */
function renderAll(){
  const b = currentBoard();
  uiBoard.textContent = b.id;
  uiStatus.textContent = statusLine();

  // setup card visibility
  setupCard.classList.toggle("hidden", S.phase !== "SETUP");

  // settings UI
  segEdge.classList.toggle("primary", S.winMode==="edge");
  segCity.classList.toggle("primary", S.winMode==="city");
  togglePolice.checked = !!S.hasPolice;

  renderPrompt();
  renderBoards();
  renderSeats();
  renderBottom();
  renderAnn();
  saveState();
}

function statusLine(){
  if (S.phase==="SETUP") return `SETUP / step ${S.step}`;
  if (S.phase==="DEAL") return `抽身分 (${S.dealSeenCount}/${S.players})`;
  if (S.phase==="NIGHT") return `🌙 NIGHT ${S.day} / step ${S.flowIndex+1}`;
  if (S.phase==="DAY") return `☀️ DAY ${S.day}`;
  if (S.phase==="VOTE") return `🗳️ 投票`;
  return "—";
}

function renderPrompt(){
  const b = currentBoard();

  if (S.phase==="SETUP"){
    promptTitle.textContent = "開局";
    promptText.textContent =
`1) 先選人數
2) 再選板子（點一下會變色）
3) 按底部「下一步」進入抽身分`;
    promptFoot.textContent = "選完後，開局卡片會消失避免佔畫面。";
    return;
  }

  if (S.phase==="DEAL"){
    promptTitle.textContent = "抽身分";
    promptText.textContent =
`上帝點選座位（可取消選取） → 玩家長按 0.3 秒看身分 → 按「我看完了」
看完會自動蓋牌（不會露出角色）
全部看完後按「開始夜晚」進入夜晚流程
（含盜賊：盜賊看完身分會立刻二選一）`;
    // 盜賊提醒
    if (S.thiefSeat && !S.thiefChosen){
      promptFoot.textContent = "⚠️ 盜賊尚未完成選角（盜賊看完身分會立刻二選一）";
    }else{
      promptFoot.textContent = "";
    }
    return;
  }

  if (S.phase==="NIGHT"){
    promptTitle.textContent = `夜晚 ${S.day}`;
    const lines = [];
    S.flow.forEach((f,idx)=>{
      const mark = idx===S.flowIndex ? "👉 " : "   ";
      lines.push(`${mark}${idx+1}. ${f.label}`);
    });
    const cur = S.flow[S.flowIndex];
    let extra = "";
    if (cur?.requiresTarget){
      extra = `\n\n（點座位選取；再點同號取消；按「下一步」確認）`;
    }else{
      extra = `\n\n按「下一步」繼續。`;
    }
    promptText.textContent = lines.join("\n") + extra;
    promptFoot.textContent = "";
    return;
  }

  if (S.phase==="DAY"){
    promptTitle.textContent = `白天 ${S.day}`;
    promptText.textContent =
`天亮了，請宣佈昨夜結果：
- ${calcNightPublicResultText()}

白天流程：自由發言 → ${S.hasPolice ? "（可上警） → " : ""}推理/辯論 → 投票

按「開始投票」進入投票統計。`;
    promptFoot.textContent = "";
    return;
  }

  if (S.phase==="VOTE"){
    promptTitle.textContent = "投票統計";
    promptText.textContent =
`1) 先點「被投的人」（會亮起）
2) 再點「投票的人」（會記錄成投給該人）
3) 再點同一位投票者＝取消該投票者的票

想棄票：先點「棄票」目標（最下方會出現一個棄票目標），再點投票者。`;
    promptFoot.textContent = voteFootText();
    return;
  }
}

function renderSeats(){
  seatsGrid.innerHTML = "";
  const showGod = !!S.godEye;

  // 投票模式：增加一個「棄票目標」用假座位
  const needAbstain = (S.phase==="VOTE");
  const totalCells = S.players + (needAbstain ? 1 : 0);

  for (let i=1;i<=totalCells;i++){
    if (needAbstain && i===totalCells){
      const div = document.createElement("div");
      div.className = "seat";
      if (S.voteTarget==="abstain") div.classList.add("selected");
      div.innerHTML = `
        <div class="seatNum" style="color:#7a5a6a;">—</div>
        <div class="seatSub">棄票</div>
      `;
      div.addEventListener("click", ()=>{
        S.voteTarget = "abstain";
        saveState();
        renderSeats();
        renderAll();
      });
      seatsGrid.appendChild(div);
      continue;
    }

    const seat = S.seats[i-1];
    const div = document.createElement("div");
    div.className = "seat";
    if (seat.dead) div.classList.add("dead");
    if (S.selectedSeat===i) div.classList.add("selected");

    // 👁 上帝視角：外框依陣營
    if (showGod && seat.roleId){
      const camp = seat.camp || roleById(seat.roleId).camp;
      if (camp==="wolf") div.classList.add("wolfOutline");
      else div.classList.add("goodOutline");
    }

    // 內容：非上帝視角 → 一律蓋牌（只顯示提示）
    let subText = "長按看身分";
    if (showGod && seat.roleId){
      const r = roleById(seat.roleId);
      subText = `${r.name}・${r.camp==="wolf"?"狼人":"好人"}`;
    }

    div.innerHTML = `
      <div class="seatNum">${i}</div>
      <div class="seatSub">${escapeHtml(subText)}</div>
      <div class="seatBadges">${(seat.badges||[]).map(b=>`<span class="badge">${b}</span>`).join("")}</div>
    `;

    // click：選取（再點取消）
    div.addEventListener("click", ()=>{
      if (S.phase==="SETUP") return; // setup 不需要點座位
      if (S.selectedSeat===i) S.selectedSeat = null;
      else S.selectedSeat = i;
      saveState();
      renderSeats();
    });

    // long press：看身分（只有 DEAL 階段才允許）
    attachLongPress(div, 300, ()=>{
      if (S.phase!=="DEAL") return;
      // 必須先選到同座位（避免誤觸）
      if (S.selectedSeat!==i){
        toast("先點一下座位，再長按 0.3 秒看身分");
        return;
      }
      showSeatRole(i);
    });

    seatsGrid.appendChild(div);
  }
}

function renderBottom(){
  // 三鍵：上一步 / 主流程 / 下一步
  btnBack.textContent = "上一步";
  btnNext.textContent = "下一步";

  if (S.phase==="SETUP"){
    btnMain.textContent = "—";
    btnMain.classList.add("disabled");
    btnMain.disabled = true;

    btnBack.classList.add("disabled");
    btnBack.disabled = true;

    // 必須選好人數+板子才可下一步
    const ok = !!S.players && !!S.boardId;
    btnNext.disabled = !ok;
    btnNext.classList.toggle("disabled", !ok);
    return;
  }

  btnBack.disabled = false;
  btnBack.classList.remove("disabled");

  if (S.phase==="DEAL"){
    btnMain.textContent = "開始夜晚";
    const okAllSeen = (S.dealSeenCount >= S.players);
    const okThief = (!S.thiefSeat) || S.thiefChosen;
    const ok = okAllSeen && okThief;

    btnMain.disabled = !ok;
    btnMain.classList.toggle("disabled", !ok);

    // 下一步在 DEAL 階段不用（保留但不讓按）
    btnNext.disabled = true;
    btnNext.classList.add("disabled");
    return;
  }

  if (S.phase==="NIGHT"){
    btnMain.textContent = "天亮睜眼";
    btnMain.disabled = true;
    btnMain.classList.add("disabled");
    btnNext.disabled = false;
    btnNext.classList.remove("disabled");
    return;
  }

  if (S.phase==="DAY"){
    btnMain.textContent = "開始投票";
    btnMain.disabled = false;
    btnMain.classList.remove("disabled");

    btnNext.disabled = false;
    btnNext.classList.remove("disabled");
    return;
  }

  if (S.phase==="VOTE"){
    btnMain.textContent = "結算公告";
    btnMain.disabled = false;
    btnMain.classList.remove("disabled");

    btnNext.disabled = false;
    btnNext.classList.remove("disabled");
    return;
  }
}

/* ---------- Long press helper ---------- */
function attachLongPress(el, ms, fn){
  let t = null;
  const clear = ()=>{ if (t){ clearTimeout(t); t=null; } };

  el.addEventListener("touchstart", (e)=>{
    clear();
    t = setTimeout(()=>fn(), ms);
  }, {passive:true});

  el.addEventListener("touchend", clear, {passive:true});
  el.addEventListener("touchmove", clear, {passive:true});

  // 桌面也支援
  el.addEventListener("mousedown", ()=>{
    clear();
    t = setTimeout(()=>fn(), ms);
  });
  el.addEventListener("mouseup", clear);
  el.addEventListener("mouseleave", clear);
}

/* ---------- Phase transitions ---------- */
function onNext(){
  if (S.phase==="SETUP"){
    // 進入 DEAL
    startDeal();
    return;
  }

  if (S.phase==="NIGHT"){
    advanceNight();
    return;
  }

  if (S.phase==="DAY"){
    // 下一步：直接跳到下一夜（或你要改成結束白天也行）
    // 這裡先保持「下一步」= 進入下一夜
    startNight(); // 會自動 day+1 在 night 結束後，白天+1
    return;
  }

  if (S.phase==="VOTE"){
    // 下一步：清除選取目標（方便繼續點）
    S.selectedSeat = null;
    saveState();
    renderAll();
    return;
  }
}

function onBack(){
  // 先簡單：回上一階段（避免卡死）
  if (S.phase==="DEAL"){
    // 回 setup
    S.phase="SETUP";
    S.step=1;
    initSeats();
    saveState();
    renderAll();
    return;
  }

  if (S.phase==="NIGHT"){
    // 回 deal（通常不需要，但防誤操作）
    if (confirm("要回到抽身分嗎？（夜晚資料會保留但流程重來）")){
      S.phase="DEAL";
      S.flowIndex=0;
      S.flow=[];
      S.pendingTarget=null;
      saveState();
      renderAll();
    }
    return;
  }

  if (S.phase==="DAY"){
    // 回夜晚最後一步（不建議，但給上帝救援）
    if (confirm("要回到夜晚流程嗎？")){
      S.phase="NIGHT";
      // 回到最後一步方便修正
      S.flowIndex = Math.max(0, S.flow.length-1);
      saveState();
      renderAll();
    }
    return;
  }

  if (S.phase==="VOTE"){
    S.phase="DAY";
    S.voteTarget=null;
    saveState();
    renderAll();
    return;
  }
}

function onMain(){
  if (S.phase==="DEAL"){
    // 開始夜晚
    startNight();
    return;
  }

  if (S.phase==="DAY"){
    // 開始投票
    startVote();
    return;
  }

  if (S.phase==="VOTE"){
    // 結算公告（你要的票型格式）
    const text = buildVoteAnnouncementText();
    addLog(true, text);
    toast("📣 已寫入公告");
    openDrawer("ann");
    return;
  }
}

/* ---------- DEAL ---------- */
function startDeal(){
  // 必須選定板子
  const b = currentBoard();
  applyBoard(b);

  // 初始化 seats
  initSeats();

  // 生成角色牌（座位用）
  const deck = buildSeatDeck(b);
  shuffle(deck);

  // 發牌
  for (let i=0;i<S.players;i++){
    const rId = deck[i];
    const r = roleById(rId);
    S.seats[i].roleId = rId;
    S.seats[i].camp = r.camp;
  }

  // 盜賊設定
  S.thiefSeat = null;
  S.thiefChosen = false;
  for (let i=0;i<S.players;i++){
    if (S.seats[i].roleId==="thief"){
      S.thiefSeat = i+1;
      break;
    }
  }

  // 生成底牌（只給盜賊用）：從 extrasPool 抽兩張，不會進座位 deck
  S.extras = [];
  if (b.extrasCount && b.extrasPool && b.extrasPool.length){
    const pool = [...b.extrasPool];
    shuffle(pool);
    S.extras = pool.slice(0, b.extrasCount);
  }

  S.phase="DEAL";
  S.step=1;
  S.selectedSeat=null;

  addLog(true, `開局：${b.title}（${b.id}）`);

  saveState();
  renderAll();
}

function buildSeatDeck(b){
  const sr = b.seatsRoles || {};
  const deck = [];

  // ✅ 防呆：狼人最多 4（你要求）
  const wolves = Math.min(4, sr.wolf||0);

  for (let i=0;i<wolves;i++) deck.push("wolf");
  for (let i=0;i<(sr.seer||0);i++) deck.push("seer");
  for (let i=0;i<(sr.witch||0);i++) deck.push("witch");
  for (let i=0;i<(sr.hunter||0);i++) deck.push("hunter");
  for (let i=0;i<(sr.guard||0);i++) deck.push("guard");
  for (let i=0;i<(sr.idiot||0);i++) deck.push("idiot");
  for (let i=0;i<(sr.cupid||0);i++) deck.push("cupid");
  for (let i=0;i<(sr.thief||0);i++) deck.push("thief");
  for (let i=0;i<(sr.villager||0);i++) deck.push("villager");

  // 補足（避免你之後調配置時 deck 不足）
  while (deck.length < S.players) deck.push("villager");
  if (deck.length > S.players) deck.length = S.players;

  return deck;
}

function showSeatRole(seatNo){
  const seat = S.seats[seatNo-1];
  if (!seat?.roleId) return;

  const r = roleById(seat.roleId);

  S._roleShowingSeat = seatNo;
  roleModalTitle.textContent = `${seatNo}號 身分`;
  roleModalRole.textContent  = r.name;
  roleModalCamp.textContent  = `陣營：${(seat.camp||r.camp)==="wolf" ? "狼人" : "好人"}`;

  openModal("role");
}

function openThiefChoose(){
  // 必須有盜賊 + 底牌
  if (!S.thiefSeat || !S.extras || S.extras.length<2) return;

  openModal("thief");

  const a = S.extras[0];
  const b = S.extras[1];
  const ra = roleById(a);
  const rb = roleById(b);

  // 若一狼一好 → 只能選狼陣營
  const aWolf = ra.camp==="wolf";
  const bWolf = rb.camp==="wolf";
  const mustWolf = (aWolf && !bWolf) || (!aWolf && bWolf);

  thiefHint.textContent = mustWolf
    ? "抽到狼人牌＋好人牌：只能選狼人陣營（請選狼人那張）"
    : "可從兩張底牌中選擇一張作為你的角色（另一張捨棄）";

  btnThiefA.textContent = ra.name;
  btnThiefB.textContent = rb.name;

  btnThiefA.disabled = mustWolf && !aWolf;
  btnThiefB.disabled = mustWolf && !bWolf;

  btnThiefA.classList.toggle("disabled", btnThiefA.disabled);
  btnThiefB.classList.toggle("disabled", btnThiefB.disabled);

  btnThiefA.onclick = ()=>chooseThiefRole(a);
  btnThiefB.onclick = ()=>chooseThiefRole(b);
}

function chooseThiefRole(roleId){
  const seatNo = S.thiefSeat;
  if (!seatNo) return;

  const seat = S.seats[seatNo-1];
  seat.roleId = roleId;

  const r = roleById(roleId);
  seat.camp = r.camp;

  S.thiefChosen = true;

  closeModal("thief");
  addLog(false, `（上帝）盜賊已完成選角。`);
  saveState();
  renderAll();
}

/* ---------- NIGHT FLOW ---------- */
function startNight(){
  // 初始化夜晚流程
  S.phase = "NIGHT";
  S.flowIndex = 0;
  S.pendingTarget = null;

  // 夜晚流程依角色存在自動生成
  S.flow = buildNightFlow();

  saveState();
  renderAll();
}

function buildNightFlow(){
  // 你指定的順序：守衛 → 狼人 → 預言家 → 女巫
  // 若該角色不存在就不加入
  const has = {
    guard: anyRoleAlive("guard"),
    wolf:  anyRoleAlive("wolf"),
    seer:  anyRoleAlive("seer"),
    witch: anyRoleAlive("witch"),
  };

  const flow = [];
  if (has.guard) flow.push({type:"guard", label:"守衛請閉眼（選擇守護）", requiresTarget:true});
  if (has.wolf)  flow.push({type:"wolves", label:"狼人請閉眼（選擇刀人）", requiresTarget:true});
  if (has.seer)  flow.push({type:"seer", label:"預言家請閉眼（查驗一人）", requiresTarget:true});
  if (has.witch) flow.push({type:"witch", label:"女巫請閉眼（解藥 / 毒藥）", requiresTarget:true});

  // 沒任何流程也要能往白天走
  if (!flow.length){
    flow.push({type:"none", label:"本局無夜晚可操作角色", requiresTarget:false});
  }

  // 清空夜晚暫存
  S.night = { guard:null, wolves:null, seer:null, seerResult:null, witchSave:null, witchPoison:null };

  return flow;
}

function advanceNight(){
  const cur = S.flow[S.flowIndex];
  if (!cur) return;

  // 需要選人的步驟：必須選到存活座位
  if (cur.requiresTarget){
    const t = S.selectedSeat;
    if (!t){
      toast("先點座位再按下一步");
      return;
    }
    const seat = S.seats[t-1];
    if (!seat || !seat.alive){
      toast("只能選存活座位");
      return;
    }
    // 記錄
    if (cur.type==="guard"){
      S.night.guard = t;
      markBadge(t, "🛡️");
      addLog(false, `（上帝）守衛守護：${t}號`);
    }
    if (cur.type==="wolves"){
      S.night.wolves = t;
      markBadge(t, "🔪");
      addLog(false, `（上帝）狼人刀：${t}號`);
    }
    if (cur.type==="seer"){
      S.night.seer = t;
      const camp = S.seats[t-1].camp || roleById(S.seats[t-1].roleId).camp;
      S.night.seerResult = (camp==="wolf") ? "狼人" : "好人";
      addLog(false, `（上帝）預言家查驗：${t}號＝${S.night.seerResult}`);
    }
    if (cur.type==="witch"){
      // 簡化：如果有刀口就問是否救；此版用「選刀口＝救 / 選其他＝毒」規則
      if (S.night.wolves && t===S.night.wolves){
        S.night.witchSave = t;
        markBadge(t, "💊");
        // 救＝移除刀 badge（仍保留紀錄）
        unmarkBadge(t, "🔪");
        addLog(false, `（上帝）女巫解藥救：${t}號`);
      }else{
        S.night.witchPoison = t;
        markBadge(t, "🧪");
        addLog(false, `（上帝）女巫毒：${t}號`);
      }
    }
  }

  // 下一步
  S.selectedSeat = null;
  S.flowIndex++;

  // 夜晚結束 → 結算 → 進白天
  if (S.flowIndex >= S.flow.length){
    resolveNight();
    S.phase = "DAY";
    S.day += 1;
    saveState();
    renderAll();
    return;
  }

  saveState();
  renderAll();
}

function resolveNight(){
  // 依照：刀口若被救則無事；毒一定死（本版簡化）
  const died = new Set();

  if (S.night.wolves){
    if (!(S.night.witchSave && S.night.witchSave===S.night.wolves)){
      died.add(S.night.wolves);
    }
  }
  if (S.night.witchPoison) died.add(S.night.witchPoison);

  // 套用死亡
  died.forEach(n=>{
    const seat = S.seats[n-1];
    if (!seat) return;
    seat.alive = false;
    seat.dead = true;
    // 死因
    if (n===S.night.witchPoison) seat.deathReason = "毒死";
    else seat.deathReason = "狼刀";
  });

  // 公開公告
  const pub = calcNightPublicResultText();
  addLog(true, `昨夜結果：${pub}`);
}

function calcNightPublicResultText(){
  // 公開：只講死幾人/幾號（不講誰救誰毒）
  const deaths = S.seats.filter(s=>s.dead && s.deathReason && s._deathDay!==S.day).map(s=>s.idx);

  // 這裡簡化：用夜晚暫存判斷
  const died = [];
  if (S.night.wolves && !(S.night.witchSave && S.night.witchSave===S.night.wolves)) died.push(S.night.wolves);
  if (S.night.witchPoison) died.push(S.night.witchPoison);

  if (!died.length) return "平安夜";
  return `死亡：${[...new Set(died)].sort((a,b)=>a-b).join("、")}號`;
}

function anyRoleAlive(roleId){
  return S.seats.some(s=>s.alive && s.roleId===roleId);
}

/* ---------- Vote ---------- */
function startVote(){
  S.phase="VOTE";
  S.votes = {};
  S.voteTarget = null;
  S.selectedSeat = null;
  saveState();
  renderAll();

  // 投票：改成點座位 = 選目標/記票
  // 我們把 click 行為放在 renderSeats 內：它仍然是選取座位
  // 所以這裡用事件委派：在 VOTE 模式下，點 seat 的邏輯改成：
  //  - 若點到「棄票」＝設定 voteTarget=abstain
  //  - 若 voteTarget 已有（含 abstain），點其他座位＝該座位投給 voteTarget（再點取消）
  //  - 若 voteTarget 沒有，第一次點＝設定 voteTarget=那位（當作被投者）
  seatsGrid.querySelectorAll(".seat").forEach((el, idx)=>{
    el.onclick = (e)=>{
      e.preventDefault();
      e.stopPropagation();

      // idx 對應：最後一格可能是棄票
      const isAbstainCell = (idx===S.players); // 因為最後加 1 格
      if (isAbstainCell){
        S.voteTarget = "abstain";
        saveState(); renderAll();
        return;
      }

      const seatNo = idx+1;
      if (!S.voteTarget){
        // 設定被投者
        S.voteTarget = seatNo;
        saveState(); renderAll();
        return;
      }

      // 有目標：此時點的是「投票者」
      const voter = seatNo;
      if (!S.seats[voter-1].alive){
        toast("死亡玩家不能投票");
        return;
      }
      if (S.votes[voter] && S.votes[voter]===S.voteTarget){
        delete S.votes[voter]; // 再點一次取消
      }else{
        S.votes[voter] = S.voteTarget;
      }
      saveState(); renderAll();
    };
  });
}

function voteFootText(){
  // 顯示目前票數摘要
  const map = {};
  Object.entries(S.votes).forEach(([voter, target])=>{
    map[target] = map[target] || [];
    map[target].push(Number(voter));
  });

  const lines = [];
  Object.keys(map).sort((a,b)=>{
    if (a==="abstain") return 1;
    if (b==="abstain") return -1;
    return Number(a)-Number(b);
  }).forEach(k=>{
    const voters = map[k].sort((a,b)=>a-b).join("、");
    if (k==="abstain") lines.push(`棄票：${voters}`);
    else lines.push(`投給${k}號：${voters}`);
  });
  return lines.length ? lines.join("｜") : "尚未記錄投票";
}

function buildVoteAnnouncementText(){
  const map = {};
  Object.entries(S.votes).forEach(([voter, target])=>{
    map[target] = map[target] || [];
    map[target].push(Number(voter));
  });

  const blocks = [];
  // 依你要的格式輸出
  Object.keys(map).forEach(k=>{
    map[k].sort((a,b)=>a-b);
  });

  // 找最高票（不含棄票）
  let top = {target:null, count:-1};
  Object.keys(map).forEach(k=>{
    if (k==="abstain") return;
    const c = map[k].length;
    if (c > top.count){
      top = {target:Number(k), count:c};
    }
  });

  // 输出
  Object.keys(map).sort((a,b)=>{
    if (a==="abstain") return 1;
    if (b==="abstain") return -1;
    return Number(a)-Number(b);
  }).forEach(k=>{
    const voters = map[k].join("、");
    if (k==="abstain"){
      blocks.push(`棄票的有${voters ? `：${voters}` : "：—"}`);
    }else{
      blocks.push(`投給${k}號的有${voters ? `：${voters}` : "：—"}`);
    }
  });

  if (top.target){
    blocks.push(`${top.target}號得到最高票遭到放逐`);
  }else{
    blocks.push(`本輪無有效票`);
  }

  return blocks.join("\n");
}

/* ---------- Announce Drawer ---------- */
function renderAnn(){
  const showGod = toggleAnnGod.checked;
  const lines = [];
  S.logs.forEach(l=>{
    if (!showGod && l.public!==true) return;
    lines.push(l.text);
  });
  annText.textContent = lines.join("\n\n") || "（尚無公告）";
}

/* ---------- Drawer / Modal ---------- */
function openDrawer(which){
  if (which==="timer"){
    timerBackdrop.classList.remove("hidden");
    timerDrawer.classList.remove("hidden");
  }
  if (which==="ann"){
    annBackdrop.classList.remove("hidden");
    annDrawer.classList.remove("hidden");
    renderAnn();
  }
  if (which==="set"){
    setBackdrop.classList.remove("hidden");
    setDrawer.classList.remove("hidden");
  }
}
function closeDrawer(which){
  if (which==="timer"){
    timerBackdrop.classList.add("hidden");
    timerDrawer.classList.add("hidden");
  }
  if (which==="ann"){
    annBackdrop.classList.add("hidden");
    annDrawer.classList.add("hidden");
  }
  if (which==="set"){
    setBackdrop.classList.add("hidden");
    setDrawer.classList.add("hidden");
  }
}

function openModal(which){
  if (which==="role") roleModal.classList.remove("hidden");
  if (which==="dice") diceModal.classList.remove("hidden");
  if (which==="thief") thiefModal.classList.remove("hidden");
}
function closeModal(which){
  if (which==="role") roleModal.classList.add("hidden");
  if (which==="dice") diceModal.classList.add("hidden");
  if (which==="thief") thiefModal.classList.add("hidden");
}

/* ---------- Dice ---------- */
function rollDice(){
  const alive = S.seats.filter(s=>s.alive).map(s=>s.idx);
  if (!alive.length){
    diceResult.textContent = "—";
    return;
  }
  const pick = alive[Math.floor(Math.random()*alive.length)];
  diceResult.textContent = String(pick);
}

/* ---------- Timer (簡易) ---------- */
let timerInt = null;

function setTimer(sec){
  S._timerLeft = sec;
  S._timerInit = sec;
  renderTimer();
  saveState();
}

function renderTimer(){
  const s = Math.max(0, Number(S._timerLeft||90));
  const mm = String(Math.floor(s/60)).padStart(2,"0");
  const ss = String(s%60).padStart(2,"0");
  timerBig.textContent = `${mm}:${ss}`;
}

function timerStart(){
  if (timerInt) return;
  timerInt = setInterval(()=>{
    S._timerLeft = Math.max(0, (S._timerLeft||90) - 1);
    renderTimer();
    saveState();
    if (S._timerLeft<=0){
      timerPause();
      // iOS 震動（可用則用）
      try{ navigator.vibrate?.(200); }catch(e){}
    }
  }, 1000);
}
function timerPause(){
  if (timerInt){
    clearInterval(timerInt);
    timerInt = null;
  }
}

/* ---------- Helpers ---------- */
function addLog(isPublic, text){
  S.logs.push({public:!!isPublic, text, day:S.day, phase:S.phase});
  saveState();
}

function markBadge(seatNo, badge){
  const s = S.seats[seatNo-1];
  if (!s) return;
  s.badges = s.badges || [];
  if (!s.badges.includes(badge)) s.badges.push(badge);
}
function unmarkBadge(seatNo, badge){
  const s = S.seats[seatNo-1];
  if (!s?.badges) return;
  s.badges = s.badges.filter(x=>x!==badge);
}

function shuffle(arr){
  for (let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

let toastTimer=null;
function toast(msg){
  clearTimeout(toastTimer);
  promptFoot.textContent = msg;
  toastTimer=setTimeout(()=>{ promptFoot.textContent=""; }, 1800);
}

function hardReset(clearAll=true){
  if (clearAll) localStorage.removeItem(LS_KEY);
  S = defaultState();
  saveState();
  renderBoards();
  renderAll();
}