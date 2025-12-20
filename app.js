/* =========================================
   狼人殺上帝輔助 - app.js（完整覆蓋）
   - iOS 防雙擊放大 / 長按選取
   - SETUP → DEAL → NIGHT → DAY → VOTE 循環
   - DEAL 一律蓋牌（格子不顯示角色）
   - 盜賊在 DEAL 階段必須完成二選一
========================================= */

(() => {
  // ---------- iOS 防雙擊放大 / 長按選取 ----------
  document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);

  const uiStatus = $("uiStatus");
  const uiBoard = $("uiBoard");

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

  const seatsHeader = $("seatsHeader");
  const seatsGrid = $("seatsGrid");

  const btnBack = $("btnBack");
  const btnMain = $("btnMain");
  const btnNext = $("btnNext");

  // Timer drawer
  const timerBackdrop = $("timerBackdrop");
  const timerDrawer = $("timerDrawer");
  const btnCloseTimer = $("btnCloseTimer");
  const timerBig = $("timerBig");
  const timerPresets = $("timerPresets");
  const btnTimerStart = $("btnTimerStart");
  const btnTimerPause = $("btnTimerPause");
  const btnTimerReset = $("btnTimerReset");

  // Ann drawer
  const annBackdrop = $("annBackdrop");
  const annDrawer = $("annDrawer");
  const btnCloseAnn = $("btnCloseAnn");
  const annText = $("annText");
  const toggleAnnGod = $("toggleAnnGod");

  // Settings drawer
  const setBackdrop = $("setBackdrop");
  const setDrawer = $("setDrawer");
  const btnCloseSet = $("btnCloseSet");
  const segEdge = $("segEdge");
  const segCity = $("segCity");
  const togglePolice = $("togglePolice");
  const btnGotoSetup = $("btnGotoSetup");
  const btnHardReset = $("btnHardReset");

  // Role modal
  const roleModal = $("roleModal");
  const roleModalTitle = $("roleModalTitle");
  const roleModalRole = $("roleModalRole");
  const roleModalCamp = $("roleModalCamp");
  const btnRoleDone = $("btnRoleDone");
  const btnRoleClose = $("btnRoleClose");
  let roleModalSeatId = null;

  // Dice modal
  const diceModal = $("diceModal");
  const diceResult = $("diceResult");
  const btnDiceAgain = $("btnDiceAgain");
  const btnDiceClose = $("btnDiceClose");

  // Thief modal
  const thiefModal = $("thiefModal");
  const thiefHint = $("thiefHint");
  const btnThiefA = $("btnThiefA");
  const btnThiefB = $("btnThiefB");
  const btnThiefClose = $("btnThiefClose");

  // ---------- Data: Roles ----------
  const ROLES = {
    villager: { name: "平民", camp: "good" },
    wolf: { name: "狼人", camp: "wolf" },
    seer: { name: "預言家", camp: "good" },
    witch: { name: "女巫", camp: "good" },
    hunter: { name: "獵人", camp: "good" },
    guard: { name: "守衛", camp: "good" },
    idiot: { name: "白痴", camp: "good" },
    cupid: { name: "邱比特", camp: "good" },
    thief: { name: "盜賊", camp: "good" },
    // 你後續要加黑狼王/白狼王也可以在這裡擴充
  };

  // ---------- Boards（內建）----------
  // rolesPool：抽身分用的角色池（會被洗牌分配）
  // flowRoles：夜晚/白天流程要唸到哪些角色（盜賊板子：flowRoles會固定照板子唸，不因盜賊丟棄而消失）
  const BOARDS = [
    {
      id: "official-12",
      name: "12 人官方標準局",
      tags: ["官方", "穩", "含白癡"],
      people: 12,
      rolesPool: [
        "wolf","wolf","wolf","wolf",
        "seer","witch","hunter","guard",
        "idiot",
        "villager","villager","villager"
      ],
      flowRoles: ["guard","wolf","seer","witch"], // 夜晚流程
      hasPolice: true
    },
    {
      id: "12-thief",
      name: "12 人（含盜賊）",
      tags: ["測試", "盜賊", "全流程照唸"],
      people: 12,
      rolesPool: [
        "wolf","wolf","wolf","wolf",
        "seer","witch","hunter","guard",
        "idiot","thief",
        "villager","villager"
      ],
      flowRoles: ["guard","wolf","seer","witch"], // ✅ 即使盜賊丟掉守衛，仍照唸
      hasPolice: true,
      thiefMode: true
    },
    {
      id: "12-cupid",
      name: "12 人（含邱比特）",
      tags: ["測試", "邱比特"],
      people: 12,
      rolesPool: [
        "wolf","wolf","wolf","wolf",
        "seer","witch","hunter","guard",
        "cupid",
        "villager","villager","villager"
      ],
      flowRoles: ["guard","wolf","seer","witch"],
      hasPolice: true,
      cupidMode: true
    },
    {
      id: "12-cupid-thief",
      name: "12 人（邱比特＋盜賊）",
      tags: ["測試", "邱比特", "盜賊"],
      people: 12,
      rolesPool: [
        "wolf","wolf","wolf","wolf",
        "seer","witch","hunter","guard",
        "cupid","thief",
        "villager","villager"
      ],
      flowRoles: ["guard","wolf","seer","witch"],
      hasPolice: true,
      thiefMode: true,
      cupidMode: true
    },
  ];

  // ---------- State ----------
  const STORAGE_KEY = "werewolf_god_helper_v3";

  const defaultState = () => ({
    phase: "SETUP", // SETUP | DEAL | NIGHT | DAY | VOTE
    step: 0,        // sub-step within phase
    people: 12,
    boardId: "",
    winMode: "edge", // edge | city
    hasPolice: true,

    godView: false, // 👁 toggle（DEAL 強制 false）
    selectedSeat: null, // 點座位選取（再點取消）

    seats: [], // {id, alive, roleKey, revealed, deathReason, marks[]}
    deal: { total: 0, revealedCount: 0 },

    // role resources/events
    night: {
      nightNo: 1,
      wolfTarget: null,
      guardTarget: null,
      seerTarget: null,
      witchSave: null,
      witchPoison: null,
      witchUsedSave: false,
      witchUsedPoison: false,
      seerResult: null, // {target, camp}
    },

    cupid: {
      lovers: [], // [a,b]
      done: false
    },

    thief: {
      seatId: null,
      options: null,   // [roleKeyA, roleKeyB]
      chosen: false,
      discarded: null
    },

    vote: {
      // mapping target->voters array
      votes: {}, // { "1": [3,4], "2":[...], "abstain":[...] }
      lastResult: null // text
    },

    announce: [] // {day, title, publicText, godText, ts}
  });

  let S = load() || defaultState();

  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return null;
      return JSON.parse(raw);
    }catch(e){
      return null;
    }
  }
  function save(){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); }catch(e){}
  }

  // ---------- Helpers ----------
  function board(){
    return BOARDS.find(b => b.id === S.boardId) || null;
  }
  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
  function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
  function shuffle(arr){
    const a = arr.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
  }
  function fmtTime(sec){
    sec = Math.max(0, Math.floor(sec));
    const m = String(Math.floor(sec/60)).padStart(2,"0");
    const s = String(sec%60).padStart(2,"0");
    return `${m}:${s}`;
  }
  function roleName(key){ return ROLES[key]?.name || key; }
  function roleCamp(key){ return ROLES[key]?.camp || "good"; }
  function seatById(id){ return S.seats.find(x=>x.id===id); }
  function aliveSeats(){ return S.seats.filter(s=>s.alive); }

  // ---------- Drawer / Modal ----------
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

  // ---------- Timer ----------
  let timer = {
    running:false,
    sec: 90,
    t: null
  };

  function timerRender(){
    timerBig.textContent = fmtTime(timer.sec);
  }
  function timerTick(){
    if(!timer.running) return;
    timer.sec -= 1;
    if(timer.sec <= 0){
      timer.sec = 0;
      timer.running = false;
      if(navigator.vibrate) navigator.vibrate([120,80,120]);
    }
    timerRender();
    saveTimer();
  }
  function timerStart(){
    if(timer.running) return;
    timer.running = true;
    timer.t = setInterval(timerTick, 1000);
    saveTimer();
  }
  function timerPause(){
    timer.running = false;
    if(timer.t){ clearInterval(timer.t); timer.t=null; }
    saveTimer();
  }
  function timerReset(){
    timerPause();
    timer.sec = 90;
    timerRender();
    saveTimer();
  }
  function saveTimer(){
    try{
      localStorage.setItem(STORAGE_KEY+"_timer", JSON.stringify({
        running: timer.running,
        sec: timer.sec,
        ts: Date.now()
      }));
    }catch(e){}
  }
  function loadTimer(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY+"_timer");
      if(!raw) return;
      const t = JSON.parse(raw);
      timer.sec = t.sec ?? 90;

      // 如果離線一段時間，補扣秒數
      if(t.running && typeof t.ts === "number"){
        const delta = Math.floor((Date.now() - t.ts)/1000);
        timer.sec = Math.max(0, timer.sec - delta);
        timer.running = timer.sec > 0;
      }else{
        timer.running = false;
      }

      timerRender();
      if(timer.running){
        timer.t = setInterval(timerTick, 1000);
      }
    }catch(e){}
  }

  // ---------- Setup / Deal ----------
  function initSetup(){
    S.phase = "SETUP";
    S.step = 0;
    S.selectedSeat = null;
    S.godView = false;

    S.seats = [];
    S.deal = { total: 0, revealedCount: 0 };

    S.night = {
      nightNo: 1,
      wolfTarget: null,
      guardTarget: null,
      seerTarget: null,
      witchSave: null,
      witchPoison: null,
      witchUsedSave: false,
      witchUsedPoison: false,
      seerResult: null,
    };

    S.cupid = { lovers: [], done: false };
    S.thief = { seatId: null, options: null, chosen: false, discarded: null };
    S.vote = { votes: {}, lastResult: null };

    // 不清announce（你要回顧也可保留）；但回到開局就清
    S.announce = [];

    save();
    render();
  }

  function applyPeople(n){
    S.people = n;
    // 若板子 people 不符，就清掉 boardId
    const b = board();
    if(b && b.people !== n){
      S.boardId = "";
    }
    save();
    render();
  }

  function applyBoard(id){
    S.boardId = id;
    const b = board();
    if(b){
      S.people = b.people;
      S.hasPolice = !!b.hasPolice;
    }
    save();
    render();
  }

  function startDeal(){
    const b = board();
    if(!b) return;

    // 建 seats
    S.seats = Array.from({length:S.people}, (_,i)=>({
      id: i+1,
      alive: true,
      roleKey: null,
      revealed: false,
      deathReason: "",
      marks: [] // e.g., ["💊","🧪","🛡️","🐾"]
    }));
    S.deal.total = S.people;
    S.deal.revealedCount = 0;

    // 抽角色
    const pool = shuffle(b.rolesPool);
    for(let i=0;i<S.people;i++){
      S.seats[i].roleKey = pool[i] || "villager";
      if(S.seats[i].roleKey === "thief"){
        S.thief.seatId = S.seats[i].id;
      }
    }

    S.phase = "DEAL";
    S.step = 0;
    S.selectedSeat = null;

    // ✅ DEAL 一律關 godView
    S.godView = false;

    addAnnounce("開局", `已選板子：${b.name}（${b.id}）`, `角色池：${b.rolesPool.map(roleName).join("、")}`);

    save();
    render();
  }

  // ---------- Role viewing (long press) ----------
  let pressTimer = null;
  function attachSeatHandlers(btn, seatId){
    // click：選取/取消
    btn.addEventListener("click", (e)=>{
      e.preventDefault();
      if(S.selectedSeat === seatId) S.selectedSeat = null;
      else S.selectedSeat = seatId;
      renderSeats();
      save();
    });

    // long press：看身分（DEAL）/ 快速上帝查看（其他）
    const startPress = (e)=>{
      e.preventDefault();
      clearTimeout(pressTimer);
      pressTimer = setTimeout(()=>{
        openSeatAction(seatId);
      }, 300);
    };
    const endPress = ()=>{
      clearTimeout(pressTimer);
      pressTimer = null;
    };

    btn.addEventListener("touchstart", startPress, {passive:false});
    btn.addEventListener("touchend", endPress);
    btn.addEventListener("touchcancel", endPress);

    btn.addEventListener("pointerdown", startPress);
    btn.addEventListener("pointerup", endPress);
    btn.addEventListener("pointercancel", endPress);
  }

  function openSeatAction(seatId){
    const seat = seatById(seatId);
    if(!seat) return;

    if(S.phase === "DEAL"){
      // 玩家看身分
      roleModalSeatId = seatId;
      roleModalTitle.textContent = `${seatId}號 身分`;
      roleModalRole.textContent = roleName(seat.roleKey);
      roleModalCamp.textContent = `陣營：${roleCamp(seat.roleKey) === "wolf" ? "狼人" : "好人"}`;
      openModal(roleModal);
      return;
    }

    // 遊戲中：長按不彈玩家視窗（避免干擾），只切換選取
    S.selectedSeat = (S.selectedSeat === seatId) ? null : seatId;
    renderSeats();
    save();
  }

  function markSeatRevealed(seatId){
    const seat = seatById(seatId);
    if(!seat) return;
    if(!seat.revealed){
      seat.revealed = true;
      S.deal.revealedCount += 1;
    }
  }

  // ---------- Thief choose ----------
  function openThiefChooseIfNeeded(thiefSeatId){
    const b = board();
    if(!b || !b.thiefMode) return false;
    if(!S.thief.seatId || S.thief.seatId !== thiefSeatId) return false;
    if(S.thief.chosen) return false;

    // 從「未被抽到」的角色中抽兩張：
    // 規則：角色池是一人一張，抽完就沒有剩的。
    // 你要求：盜賊要從「當場遊戲尚未被抽選的角色」抽兩個
    // => 我們用「板子角色池 + 2張額外牌」概念：額外牌從同板子延伸池抽
    // 簡化但符合你描述：從 (官方角色集合) 中排除當局已分配的角色數量後，再抽兩張。
    //
    // 實務上：做一個「候補池」：以 b.rolesPool 為基底再加一些常見神民，
    // 然後扣掉當局已抽走的數量，最後抽兩張。

    const base = [
      ...b.rolesPool,
      "seer","witch","hunter","guard","idiot","villager","villager","wolf"
    ];

    // 計算當局已用掉的角色數量
    const used = {};
    S.seats.forEach(s=>{
      used[s.roleKey] = (used[s.roleKey]||0) + 1;
    });

    // 建候補池（扣掉 used）
    const candidates = [];
    for(const rk of base){
      if((used[rk]||0) > 0){
        used[rk] -= 1;
      }else{
        candidates.push(rk);
      }
    }

    // 若候補池不足，補 villager
    while(candidates.length < 2) candidates.push("villager");

    const pick = shuffle(candidates).slice(0,2);
    S.thief.options = pick;
    S.thief.chosen = false;

    const a = pick[0], b2 = pick[1];
    const hasWolf = (roleCamp(a)==="wolf") || (roleCamp(b2)==="wolf");

    thiefHint.textContent =
      hasWolf
        ? "抽到狼人牌時：若另一張是好人牌，必須選狼人陣營。"
        : "兩張皆為好人牌：可自由選擇其一。";

    btnThiefA.textContent = roleName(a);
    btnThiefB.textContent = roleName(b2);

    // 若一狼一好：禁用好人那張
    if(hasWolf){
      if(roleCamp(a)==="good" && roleCamp(b2)==="wolf"){
        btnThiefA.disabled = true;
        btnThiefB.disabled = false;
      }else if(roleCamp(a)==="wolf" && roleCamp(b2)==="good"){
        btnThiefA.disabled = false;
        btnThiefB.disabled = true;
      }else{
        btnThiefA.disabled = false;
        btnThiefB.disabled = false;
      }
    }else{
      btnThiefA.disabled = false;
      btnThiefB.disabled = false;
    }

    openModal(thiefModal);
    save();
    return true;
  }

  function applyThiefChoice(chosenRoleKey){
    const sid = S.thief.seatId;
    const seat = seatById(sid);
    if(!seat) return;

    const opt = S.thief.options || [];
    const other = opt.find(x=>x!==chosenRoleKey) || null;

    // 盜賊成為 chosen
    seat.roleKey = chosenRoleKey;

    S.thief.chosen = true;
    S.thief.discarded = other;

    addAnnounce(
      "盜賊選角（上帝）",
      "（公開：無）",
      `盜賊座位：${sid}號；選擇：${roleName(chosenRoleKey)}；捨棄：${other ? roleName(other) : "—"}`
    );

    save();
  }

  // ---------- Flow prompts ----------
  function setPrompt(){
    const b = board();
    const phase = S.phase;

    // top status
    const boardLabel = b ? b.id : "—";
    uiBoard.textContent = boardLabel;

    if(phase === "SETUP"){
      uiStatus.textContent = "SETUP / 開局";
      promptTitle.textContent = "開局設定";
      promptText.textContent =
`1) 選人數
2) 選板子（點一下會變色）
3) 按底部「下一步」進入抽身分

提示：
- 👁 上帝視角：遊戲中才可用（抽身分會強制關閉）
- ⌛️ 計時器：抽屜
- 📣 公告：可回顧每天公開資訊`;
      promptFoot.textContent = "";
      btnMain.textContent = "重要流程";
      btnEye.disabled = true;
      btnEye.style.opacity = .45;
      return;
    }

    if(phase === "DEAL"){
      uiStatus.textContent = `抽身分（${S.deal.revealedCount}/${S.deal.total}）`;
      promptTitle.textContent = "抽身分";
      promptText.textContent =
`請將手機交給玩家，長按座位 0.3 秒查看身分。
玩家看完請按「我看完了」。

全部看完後按「開始夜晚」。`;

      promptFoot.textContent = "（再點一次同號碼可取消選取）";

      // ✅ DEAL 階段強制關閉👁，避免座位露角色
      S.godView = false;
      btnEye.disabled = true;
      btnEye.style.opacity = .45;

      btnMain.textContent = "開始夜晚";
      return;
    }

    // GAME phases enable eye
    btnEye.disabled = false;
    btnEye.style.opacity = 1;

    if(phase === "NIGHT"){
      uiStatus.textContent = `🌙 NIGHT ${S.night.nightNo} / step ${S.step+1}`;
      const lines = nightStepsText();
      promptTitle.textContent = `夜晚 ${S.night.nightNo}`;
      promptText.textContent = lines.text;
      promptFoot.textContent = lines.foot;
      btnMain.textContent = "天亮睜眼";
      return;
    }

    if(phase === "DAY"){
      uiStatus.textContent = `☀️ DAY ${S.night.nightNo} / 白天流程`;
      promptTitle.textContent = `白天 ${S.night.nightNo}`;
      promptText.textContent = dayText();
      promptFoot.textContent = "按「開始投票」進入投票統計。";
      btnMain.textContent = "開始投票";
      return;
    }

    if(phase === "VOTE"){
      uiStatus.textContent = `🗳 投票 / step ${S.step+1}`;
      promptTitle.textContent = "投票";
      promptText.textContent = voteText();
      promptFoot.textContent = "用「點座位」記錄票流；📣 公告可回顧。";
      btnMain.textContent = "天黑閉眼";
      return;
    }
  }

  function nightSteps(){
    const b = board();
    const steps = [];

    // Cupid：第一天白天睜眼後（你說第一天睜眼選戀人）
    // 這裡做法：在 NIGHT1 開頭前先做（比較符合主持習慣也不會打亂）
    // 但你要「第一天睜眼」，所以我們放在 DAY1 一進來先提示
    // => 這裡不加入 night steps，由 dayText 內處理。

    // 夜晚流程依板子 flowRoles
    const roles = (b?.flowRoles || ["guard","wolf","seer","witch"]);
    for(const rk of roles){
      if(rk === "guard") steps.push({ key:"guard", title:"守衛請睜眼（選擇守護）", need:"single", aliveOnly:true });
      if(rk === "wolf") steps.push({ key:"wolf", title:"狼人請睜眼（選擇刀人）", need:"single", aliveOnly:true });
      if(rk === "seer") steps.push({ key:"seer", title:"預言家請睜眼（查驗一人）", need:"single", aliveOnly:true });
      if(rk === "witch") steps.push({ key:"witch", title:"女巫請睜眼（解藥 / 毒藥）", need:"witch", aliveOnly:true });
    }

    return steps;
  }

  function nightStepsText(){
    const steps = nightSteps();
    const idx = clamp(S.step, 0, steps.length-1);
    const cur = steps[idx];

    const head = [
      "夜晚開始：",
      ...steps.map((s,i)=>`${i+1}. ${s.title}`),
      "",
      `👉 目前：${idx+1}. ${cur.title}`,
      "（點座位選取；再點同號取消；按「下一步」確認）"
    ].join("\n");

    let foot = "";
    if(cur.key === "witch"){
      foot = `女巫：同晚解藥/毒藥只能擇一。`;
    }
    return { text: head, foot };
  }

  function dayText(){
    const b = board();
    const n = S.night.nightNo;

    const parts = [];
    parts.push("天亮了，請宣布昨夜結果：");

    // 昨夜結果（簡化：根據 night 記錄）
    const kill = S.night.wolfTarget;
    const guard = S.night.guardTarget;
    const save = S.night.witchSave;
    const poison = S.night.witchPoison;

    const resolved = resolveNightResult();
    parts.push(`- 昨夜結果：${resolved.publicLine}`);

    if(b?.cupidMode && n===1 && !S.cupid.done){
      parts.push("");
      parts.push("💘 邱比特（第 1 天睜眼）");
      parts.push("請邱比特選兩位戀人：點兩個座位（再點取消）");
      parts.push("選好後按「下一步」確認戀人。");
    }

    // Seer result is god-only, but in上帝視角會顯示
    parts.push("");
    parts.push("白天流程：自由發言 →（可上警）→ 推選/辯論 → 投票");

    return parts.join("\n");
  }

  function voteText(){
    const lines = [];
    lines.push("點座位：先選『投票目標』，再依序點『投票者』記錄。");
    lines.push("（提示：你可以用公告📣回顧票型）");
    lines.push("");
    lines.push("目前票型：");
    lines.push(formatVoteTable());
    if(S.vote.lastResult){
      lines.push("");
      lines.push("本輪結果：");
      lines.push(S.vote.lastResult);
    }
    return lines.join("\n");
  }

  // ---------- Night resolve ----------
  function resolveNightResult(){
    // 計算死亡（公開）
    const killed = [];
    const kill = S.night.wolfTarget;
    const save = S.night.witchSave;
    const poison = S.night.witchPoison;

    // 狼刀
    if(kill && kill !== save){
      killed.push({ id: kill, reason: "🐺狼刀" });
    }

    // 毒
    if(poison){
      killed.push({ id: poison, reason: "🧪毒死" });
    }

    // 合併
    const uniq = new Map();
    for(const k of killed){
      uniq.set(k.id, k.reason);
    }

    // 更新 seat 狀態
    const deadIds = [];
    for(const [id, reason] of uniq.entries()){
      const seat = seatById(id);
      if(seat && seat.alive){
        seat.alive = false;
        seat.deathReason = reason;
        deadIds.push(id);
      }
    }

    // 標記💊/🧪在格子（上帝視角時看得到）
    // 先清掉上一晚藥標
    S.seats.forEach(s=>{
      s.marks = s.marks.filter(m=>m!=="💊" && m!=="🧪" && m!=="🛡️" && m!=="🔍" && m!=="💘");
    });
    if(S.night.guardTarget){
      seatById(S.night.guardTarget)?.marks.push("🛡️");
    }
    if(S.night.witchSave){
      seatById(S.night.witchSave)?.marks.push("💊");
    }
    if(S.night.witchPoison){
      seatById(S.night.witchPoison)?.marks.push("🧪");
    }
    if(S.night.seerTarget){
      seatById(S.night.seerTarget)?.marks.push("🔍");
    }

    const publicLine =
      deadIds.length === 0
        ? "平安夜"
        : `死亡：${deadIds.sort((a,b)=>a-b).map(x=>`${x}號`).join("、")}`;

    const godLine = [
      `狼刀：${kill ? `${kill}號` : "（無）"}`,
      `守衛：${S.night.guardTarget ? `${S.night.guardTarget}號` : "（無）"}`,
      `女巫救：${S.night.witchSave ? `${S.night.witchSave}號` : "（無）"}（解藥${S.night.witchUsedSave ? "已用" : "未用"}）`,
      `女巫毒：${S.night.witchPoison ? `${S.night.witchPoison}號` : "（無）"}（毒藥${S.night.witchUsedPoison ? "已用" : "未用"}）`,
      `預言家查驗：${S.night.seerTarget ? `${S.night.seerTarget}號` : "（無）"}`
    ].join("\n");

    return { publicLine, godLine };
  }

  // ---------- Voting ----------
  // 票流記錄：先選 target（selectedSeat 當 target），再點 voter 依序加入
  // 簡化：在 VOTE 階段，點座位會：如果尚未選 target → 當 target；若已選 target → 當 voter
  function voteClick(seatId){
    const seat = seatById(seatId);
    if(!seat || !seat.alive) return;

    // 若尚未設定 target，先設定
    if(!S.vote.currentTarget){
      S.vote.currentTarget = seatId;
      S.selectedSeat = seatId;
      renderSeats();
      save();
      return;
    }

    // voter
    const targetKey = String(S.vote.currentTarget);
    if(!S.vote.votes[targetKey]) S.vote.votes[targetKey] = [];
    const arr = S.vote.votes[targetKey];

    // 同一 voter 重複點 → 取消
    const idx = arr.indexOf(seatId);
    if(idx >= 0) arr.splice(idx,1);
    else arr.push(seatId);

    save();
    render();
  }

  function formatVoteTable(){
    const keys = Object.keys(S.vote.votes || {});
    if(keys.length === 0) return "（尚未記錄）";

    const lines = [];
    for(const k of keys.sort((a,b)=>Number(a)-Number(b))){
      const voters = (S.vote.votes[k]||[]).slice().sort((a,b)=>a-b);
      lines.push(`投給${k}號：${voters.length ? voters.join("、") : "（無）"}`);
    }
    return lines.join("\n");
  }

  function finalizeVote(){
    // 算票：每個 target 的 voter 數量
    const entries = Object.entries(S.vote.votes || {}).map(([k,v])=>({
      target: Number(k),
      voters: (v||[]).slice()
    }));

    if(entries.length===0){
      S.vote.lastResult = "尚未記錄投票。";
      return;
    }

    // 找最高票
    let best = null;
    for(const e of entries){
      const c = e.voters.length;
      if(!best || c > best.count){
        best = { target: e.target, count: c, voters: e.voters.slice() };
      }else if(best && c === best.count){
        best.tie = true;
      }
    }

    // 生成你要的清晰格式
    const lines = [];
    for(const e of entries.sort((a,b)=>a.target-b.target)){
      const voters = e.voters.slice().sort((a,b)=>a-b);
      lines.push(`投給${e.target}號的有${voters.length ? voters.join("、") : "（無）"}`);
    }

    if(best.tie){
      lines.push("最高票同票，請依現場規則加投/PK。");
      S.vote.lastResult = lines.join("\n");
      addAnnounce("投票結果", lines.join("\n"), lines.join("\n"));
      return;
    }

    lines.push(`${best.target}號得到最高票遭到放逐`);
    S.vote.lastResult = lines.join("\n");

    // 放逐
    const seat = seatById(best.target);
    if(seat && seat.alive){
      seat.alive = false;
      seat.deathReason = "🗳 放逐";
    }

    addAnnounce("投票結果", lines.join("\n"), lines.join("\n"));
  }

  // ---------- Announce ----------
  function addAnnounce(title, publicText, godText){
    S.announce.push({
      day: S.night?.nightNo || 0,
      title,
      publicText,
      godText,
      ts: Date.now()
    });
    save();
  }

  function renderAnn(){
    const showGod = !!toggleAnnGod.checked;
    const items = S.announce.slice().reverse();

    if(items.length === 0){
      annText.textContent = "（尚無公告）";
      return;
    }

    const lines = [];
    for(const it of items){
      const t = new Date(it.ts);
      const hh = String(t.getHours()).padStart(2,"0");
      const mm = String(t.getMinutes()).padStart(2,"0");
      lines.push(`【D${it.day} ${hh}:${mm}】${it.title}`);
      lines.push(showGod ? (it.godText || "（無）") : (it.publicText || "（無）"));
      lines.push("");
    }
    annText.textContent = lines.join("\n").trim();
  }

  // ---------- Seat rendering ----------
  function renderSeats(){
    seatsGrid.innerHTML = "";
    const b = board();

    // SETUP 隱藏座位
    const showSeats = (S.phase !== "SETUP");
    seatsHeader.classList.toggle("show", showSeats);
    seatsGrid.style.display = showSeats ? "grid" : "none";

    if(!showSeats) return;

    for(const seat of S.seats.length ? S.seats : Array.from({length:S.people},(_,i)=>({id:i+1, alive:true, roleKey:null, revealed:false, deathReason:"", marks:[]}))){
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "seatBtn";
      btn.dataset.id = String(seat.id);

      if(!seat.alive) btn.classList.add("dead");
      if(S.selectedSeat === seat.id) btn.classList.add("selected");

      // VOTE 階段：點座位改成投票操作
      if(S.phase === "VOTE"){
        btn.addEventListener("click", (e)=>{
          e.preventDefault();
          voteClick(seat.id);
        });
        // 不要 long press 觸發玩家身分
      }else{
        attachSeatHandlers(btn, seat.id);
      }

      const num = document.createElement("div");
      num.className = "num";
      num.textContent = String(seat.id);

      const small = document.createElement("div");
      small.className = "small";

      // ✅ 小字顯示邏輯
      if(S.phase === "SETUP"){
        small.textContent = "";
      } else if(S.phase === "DEAL"){
        // ✅ DEAL 一律蓋牌：不顯示角色（就算按👁也不顯示）
        small.textContent = seat.revealed ? "已看完" : "長按看身分";
      } else {
        // 遊戲中
        if(!seat.alive){
          small.textContent = seat.deathReason || "死亡";
        }else{
          small.textContent = "存活";
        }

        // 👁 上帝視角：顯示角色/陣營/事件
        if(S.godView){
          const rk = seat.roleKey;
          const camp = roleCamp(rk);
          btn.classList.add(camp === "wolf" ? "wolf" : "good");

          const marks = (seat.marks||[]).join("");
          const extra = [];
          if(rk) extra.push(roleName(rk));
          extra.push(camp === "wolf" ? "狼人" : "好人");
          if(marks) extra.push(marks);

          // 戀人標記
          if(b?.cupidMode && S.cupid.lovers.includes(seat.id)){
            extra.push("💘");
          }

          small.textContent = extra.join("・");
        }else{
          btn.classList.remove("wolf","good");
        }
      }

      btn.appendChild(num);
      btn.appendChild(small);
      seatsGrid.appendChild(btn);
    }
  }

  // ---------- Render ----------
  function renderSetup(){
    const isSetup = (S.phase === "SETUP");
    setupCard.classList.toggle("show", isSetup);
    if(!isSetup) return;

    // 人數 chips
    const chips = setupCard.querySelectorAll(".chip[data-n]");
    chips.forEach(ch=>{
      const n = Number(ch.dataset.n);
      ch.classList.toggle("active", n === S.people);
      ch.onclick = ()=> applyPeople(n);
    });

    // 板子列表
    boardList.innerHTML = "";
    const list = BOARDS.filter(b=>b.people === S.people);

    if(list.length === 0){
      const div = document.createElement("div");
      div.className = "hint";
      div.textContent = "（此人數沒有內建板子）";
      boardList.appendChild(div);
      return;
    }

    for(const b of list){
      const item = document.createElement("button");
      item.type = "button";
      item.className = "boardItem";
      if(S.boardId === b.id) item.classList.add("active");

      item.innerHTML = `
        <div class="name">${b.name}</div>
        <div class="id">${b.id} ・ ${b.rolesPool.map(roleName).join("、")}</div>
        <div class="tags">${(b.tags||[]).map(t=>`<span class="tag">${t}</span>`).join("")}</div>
      `;

      item.onclick = ()=> applyBoard(b.id);
      boardList.appendChild(item);
    }
  }

  function renderButtons(){
    const isSetup = (S.phase === "SETUP");
    const isDeal = (S.phase === "DEAL");

    // bottom bar is fixed in CSS; just ensure grid layout
    if(!btnBack.parentElement.classList.contains("btnRow")){
      const wrap = document.createElement("div");
      wrap.className = "btnRow";
      btnBack.parentElement.appendChild(wrap);
      wrap.appendChild(btnBack);
      wrap.appendChild(btnMain);
      wrap.appendChild(btnNext);
    }

    // Enable rules
    btnBack.disabled = false;
    btnNext.disabled = false;

    if(isSetup){
      btnBack.disabled = true;
      btnMain.disabled = true;
      btnNext.disabled = !S.boardId; // 沒選板子不能下一步
      btnMain.textContent = "重要流程";
    }else if(isDeal){
      btnMain.disabled = (S.deal.revealedCount < S.deal.total) || (board()?.thiefMode && !S.thief.chosen && !!S.thief.seatId);
    }else{
      btnMain.disabled = false;
    }
  }

  function render(){
    setPrompt();
    renderSetup();
    renderSeats();
    renderButtons();
    renderAnn();
  }

  // ---------- Buttons actions ----------
  btnAnn.addEventListener("click", ()=>{
    renderAnn();
    openDrawer(annBackdrop, annDrawer);
  });
  btnCloseAnn.addEventListener("click", ()=>closeDrawer(annBackdrop, annDrawer));
  annBackdrop.addEventListener("click", ()=>closeDrawer(annBackdrop, annDrawer));
  toggleAnnGod.addEventListener("change", renderAnn);

  btnTimer.addEventListener("click", ()=>{
    timerRender();
    openDrawer(timerBackdrop, timerDrawer);
  });
  btnCloseTimer.addEventListener("click", ()=>closeDrawer(timerBackdrop, timerDrawer));
  timerBackdrop.addEventListener("click", ()=>closeDrawer(timerBackdrop, timerDrawer));
  timerPresets.addEventListener("click", (e)=>{
    const btn = e.target.closest("button[data-sec]");
    if(!btn) return;
    const sec = Number(btn.dataset.sec);
    timerPause();
    timer.sec = sec;
    timerRender();
    saveTimer();
  });
  btnTimerStart.addEventListener("click", timerStart);
  btnTimerPause.addEventListener("click", timerPause);
  btnTimerReset.addEventListener("click", timerReset);

  btnSettings.addEventListener("click", ()=>openDrawer(setBackdrop, setDrawer));
  btnCloseSet.addEventListener("click", ()=>closeDrawer(setBackdrop, setDrawer));
  setBackdrop.addEventListener("click", ()=>closeDrawer(setBackdrop, setDrawer));

  segEdge.addEventListener("click", ()=>{ S.winMode="edge"; save(); });
  segCity.addEventListener("click", ()=>{ S.winMode="city"; save(); });
  togglePolice.addEventListener("change", ()=>{ S.hasPolice = !!togglePolice.checked; save(); });

  btnGotoSetup.addEventListener("click", ()=>{
    initSetup();
    closeDrawer(setBackdrop, setDrawer);
  });
  btnHardReset.addEventListener("click", ()=>{
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY+"_timer");
    S = defaultState();
    initSetup();
    closeDrawer(setBackdrop, setDrawer);
  });

  btnEye.addEventListener("click", ()=>{
    if(S.phase === "DEAL" || S.phase === "SETUP") return;
    S.godView = !S.godView;
    save();
    renderSeats();
  });

  btnDice.addEventListener("click", ()=>{
    // 存活座位隨機
    const alive = aliveSeats().map(s=>s.id);
    if(alive.length === 0){
      diceResult.textContent = "—";
    }else{
      const pick = alive[randInt(0, alive.length-1)];
      diceResult.textContent = `${pick}號`;
    }
    openModal(diceModal);
  });
  btnDiceClose.addEventListener("click", ()=>closeModal(diceModal));
  btnDiceAgain.addEventListener("click", ()=>{
    const alive = aliveSeats().map(s=>s.id);
    if(alive.length === 0) return;
    diceResult.textContent = `${alive[randInt(0, alive.length-1)]}號`;
  });

  // Role modal
  btnRoleClose.addEventListener("click", ()=>{
    closeModal(roleModal);
    roleModalSeatId = null;
  });

  btnRoleDone.addEventListener("click", ()=>{
    const sid = roleModalSeatId;
    const seat = seatById(sid);
    if(!seat) return;

    // ✅ 盜賊：必須在 DEAL 階段先選完，才算看完
    if(S.phase === "DEAL" && seat.roleKey === "thief" && !S.thief.chosen){
      openThiefChooseIfNeeded(sid);
      return;
    }

    closeModal(roleModal);
    markSeatRevealed(sid);

    roleModalSeatId = null;
    save();
    render();
  });

  // Thief modal
  btnThiefClose.addEventListener("click", ()=>{
    // 沒選完不能關（避免跳過）
    if(!S.thief.chosen){
      thiefHint.textContent = "請先完成二選一，才算看完。";
      return;
    }
    closeModal(thiefModal);
  });

  btnThiefA.addEventListener("click", ()=>{
    const opt = S.thief.options?.[0];
    if(!opt) return;
    applyThiefChoice(opt);

    // ✅ 選完盜賊：才算看完 → 蓋牌
    closeModal(thiefModal);
    closeModal(roleModal);

    if(roleModalSeatId){
      markSeatRevealed(roleModalSeatId);
      roleModalSeatId = null;
    }
    save();
    render();
  });

  btnThiefB.addEventListener("click", ()=>{
    const opt = S.thief.options?.[1];
    if(!opt) return;
    applyThiefChoice(opt);

    closeModal(thiefModal);
    closeModal(roleModal);

    if(roleModalSeatId){
      markSeatRevealed(roleModalSeatId);
      roleModalSeatId = null;
    }
    save();
    render();
  });

  // Bottom buttons
  btnNext.addEventListener("click", ()=>{
    if(S.phase === "SETUP"){
      startDeal();
      return;
    }

    if(S.phase === "DEAL"){
      // 下一步在 DEAL 不做事（避免誤觸）
      return;
    }

    if(S.phase === "NIGHT"){
      nightConfirmAndNext();
      return;
    }

    if(S.phase === "DAY"){
      // DAY 的下一步：若有邱比特第一天，這裡用來確認戀人
      const b = board();
      if(b?.cupidMode && S.night.nightNo===1 && !S.cupid.done){
        cupidConfirm();
        return;
      }
      return;
    }

    if(S.phase === "VOTE"){
      // 下一步：結算投票
      finalizeVote();
      save();
      render();
      return;
    }
  });

  btnBack.addEventListener("click", ()=>{
    if(S.phase === "NIGHT"){
      S.step = Math.max(0, S.step-1);
      save(); render();
      return;
    }
    if(S.phase === "VOTE"){
      // 回到上一輪投票設定：清 currentTarget
      S.vote.currentTarget = null;
      S.selectedSeat = null;
      save(); render();
      return;
    }
  });

  btnMain.addEventListener("click", ()=>{
    if(S.phase === "SETUP") return;

    if(S.phase === "DEAL"){
      if(S.deal.revealedCount < S.deal.total) return;
      // 若有盜賊，必須已 chosen 才能開始夜晚
      const b = board();
      if(b?.thiefMode && S.thief.seatId && !S.thief.chosen) return;

      S.phase = "NIGHT";
      S.step = 0;

      addAnnounce(
        "進入夜晚",
        `第${S.night.nightNo}晚開始`,
        `第${S.night.nightNo}晚開始（上帝）`
      );

      save(); render();
      return;
    }

    if(S.phase === "NIGHT"){
      // 進白天：先結算昨夜
      const res = resolveNightResult();
      addAnnounce(
        `夜晚${S.night.nightNo}結果`,
        res.publicLine,
        `${res.publicLine}\n\n${res.godLine}`
      );

      S.phase = "DAY";
      S.step = 0;
      S.selectedSeat = null;

      save(); render();
      return;
    }

    if(S.phase === "DAY"){
      // 進投票
      S.phase = "VOTE";
      S.step = 0;
      S.vote.currentTarget = null;
      S.selectedSeat = null;

      save(); render();
      return;
    }

    if(S.phase === "VOTE"){
      // 天黑閉眼 → 進下一晚
      S.phase = "NIGHT";
      S.step = 0;
      S.selectedSeat = null;

      // 清夜晚暫存
      S.night.nightNo += 1;
      S.night.wolfTarget = null;
      S.night.guardTarget = null;
      S.night.seerTarget = null;
      S.night.witchSave = null;
      S.night.witchPoison = null;
      S.night.seerResult = null;

      // 投票暫存不清（公告已存）
      S.vote.currentTarget = null;

      addAnnounce(
        "天黑閉眼",
        `進入第${S.night.nightNo}晚`,
        `進入第${S.night.nightNo}晚（上帝）`
      );

      save(); render();
    }
  });

  // ---------- Night actions ----------
  function nightConfirmAndNext(){
    const steps = nightSteps();
    const idx = clamp(S.step, 0, steps.length-1);
    const cur = steps[idx];

    // 需要選擇座位
    if(cur.need === "single"){
      const sid = S.selectedSeat;
      if(!sid) return;
      const seat = seatById(sid);
      if(!seat || !seat.alive) return;

      if(cur.key === "guard"){
        S.night.guardTarget = sid;
      }
      if(cur.key === "wolf"){
        S.night.wolfTarget = sid;
      }
      if(cur.key === "seer"){
        S.night.seerTarget = sid;
        S.night.seerResult = { target: sid, camp: roleCamp(seat.roleKey) };
        // 上帝提示：查驗結果放在公告的 godText
        addAnnounce("預言家查驗（上帝）", "（公開：無）", `查驗：${sid}號 → ${roleCamp(seat.roleKey)==="wolf" ? "狼人" : "好人"}`);
      }

      // 確認後清選取
      S.selectedSeat = null;
    }

    if(cur.need === "witch"){
      // 女巫：同晚只能救或毒
      // 操作方式：點一次 = 設定目標；再點同號取消
      // 規則：
      // - 點狼刀目標：視為救（若解藥未用且可救）
      // - 點其他存活：視為毒（若毒藥未用）
      // - 再點一次取消
      const sid = S.selectedSeat;
      if(!sid) return;

      // 再點一次取消由 click 先處理，這裡只處理確認
      if(sid === S.night.wolfTarget){
        if(S.night.witchUsedSave) return;
        // 救
        S.night.witchSave = sid;
        S.night.witchPoison = null;
        S.night.witchUsedSave = true;
        addAnnounce("女巫用解藥（上帝）", "（公開：無）", `解藥：救${sid}號`);
      }else{
        if(S.night.witchUsedPoison) return;
        // 毒
        S.night.witchPoison = sid;
        S.night.witchSave = null;
        S.night.witchUsedPoison = true;
        addAnnounce("女巫用毒藥（上帝）", "（公開：無）", `毒藥：毒${sid}號`);
      }

      S.selectedSeat = null;
    }

    // 下一步
    if(S.step < steps.length-1){
      S.step += 1;
    }else{
      // 夜晚步驟跑完，等按「天亮睜眼」
      S.step = steps.length-1;
    }

    save();
    render();
  }

  // ---------- Cupid confirm ----------
  function cupidConfirm(){
    // 你要「點兩個座位」：我們用 lovers 兩個選取邏輯
    const sid = S.selectedSeat;
    if(!sid) return;

    // 這裡改成：若 lovers 不足 2，累加；滿 2 就下一步確認
    const alive = seatById(sid)?.alive;
    if(!alive) return;

    if(!S.cupid.lovers.includes(sid)){
      if(S.cupid.lovers.length < 2) S.cupid.lovers.push(sid);
    }else{
      // 再點一次取消
      S.cupid.lovers = S.cupid.lovers.filter(x=>x!==sid);
    }

    // 若剛好滿 2 且再按一次「下一步」才確認
    // 這裡為了直覺：當 lovers === 2 就直接確認（更順）
    if(S.cupid.lovers.length === 2){
      S.cupid.done = true;
      addAnnounce("邱比特連結戀人（上帝）", "（公開：無）", `戀人：${S.cupid.lovers[0]}號 ＆ ${S.cupid.lovers[1]}號`);
      S.selectedSeat = null;
    }

    save();
    render();
  }

  // ---------- Init ----------
  function boot(){
    // init bottom bar grid wrapper
    const bar = document.querySelector(".bottomBar");
    bar.innerHTML = "";
    bar.appendChild(btnBack);
    bar.appendChild(btnMain);
    bar.appendChild(btnNext);

    const wrap = document.createElement("div");
    wrap.className = "btnRow";
    wrap.appendChild(btnBack);
    wrap.appendChild(btnMain);
    wrap.appendChild(btnNext);
    bar.appendChild(wrap);

    // 若是全新狀態：在 SETUP
    if(!S || !S.phase) S = defaultState();

    // 若從舊資料回來但 board 不存在，回 SETUP
    if(S.boardId && !board()){
      S.boardId = "";
      S.phase = "SETUP";
    }

    // SETUP 時 seats 空
    if(S.phase === "SETUP"){
      S.seats = [];
    }

    // 同步 UI toggle
    togglePolice.checked = !!S.hasPolice;

    loadTimer();

    render();
  }

  boot();
})();