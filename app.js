/* =========================================================
   狼人殺｜上帝輔助 PWA（整合穩定版）
   app.js
   - 自動載入 data/ engine/app 分檔（失敗就 fallback）
   - basic / b1 板子
   - 夜晚流程（女巫不跳視窗）
   - 預言家查驗顯示於提示
   - 白天投票/標記存活（點座位一定變色）
   - 勝負判定（可接 win.engine，沒就內建）
========================================================= */
(() => {
  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);
  const warn = (...a) => console.warn("⚠️ app:", ...a);

  /* ---------------------------
     iOS：禁止選字/長按選單/雙擊放大
  --------------------------- */
  try {
    document.documentElement.style.webkitUserSelect = "none";
    document.documentElement.style.userSelect = "none";
    document.documentElement.style.webkitTouchCallout = "none";
    if (document.body) {
      document.body.style.webkitUserSelect = "none";
      document.body.style.userSelect = "none";
    }
  } catch (e) {}
  on(document, "contextmenu", (e) => e.preventDefault(), { passive: false });
  on(document, "selectstart", (e) => e.preventDefault(), { passive: false });
  on(document, "gesturestart", (e) => e.preventDefault(), { passive: false });
  // 重要：阻止 double-tap zoom（iOS）
  let _lastTouchEnd = 0;
  on(document, "touchend", (e) => {
    const now = Date.now();
    if (now - _lastTouchEnd <= 300) e.preventDefault();
    _lastTouchEnd = now;
  }, { passive: false });

  function stopTextSelectOnTouch(el) {
    if (!el) return;
    el.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
  }

  /* ---------------------------
     Storage
  --------------------------- */
  const STORAGE_KEY = "ww_save_v3_integrated";
  const State = {
    phase: "setup",         // setup | deal | night | day
    boardId: "basic",       // basic | b1
    playerCount: 9,
    rolesCount: null,       // { roleId: count }
    players: [],            // [{seat, roleId, name, icon, team, alive}]
    dealIndex: 0,

    nightNo: 1,
    dayNo: 1,
    godView: false,

    nightState: {},         // 每晚選擇結果
    nightSteps: [],
    nightStepIndex: 0,

    logs: [],               // 公告
    // 女巫永久消耗
    witch: { saveUsed:false, poisonUsed:false, save:false, poisonTarget:null },

    // 白天操作
    dayMode: "mark",        // mark | vote
    dayVote: { target:null },

    settings: {
      noConsecutiveGuard: true,
      wolfCanNoKill: true,
      witchCannotSelfSave: true,
      hunterPoisonNoShoot: true,
      blackWolfKingPoisonNoSkill: true,
    }
  };

  function save(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(State)); }catch(e){} }
  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return;
      const s = JSON.parse(raw);
      if(s && typeof s==="object") Object.assign(State, s);
    }catch(e){}
  }
  function clearSave(){ try{ localStorage.removeItem(STORAGE_KEY); }catch(e){} }

  /* ---------------------------
     Screen
  --------------------------- */
  function showScreen(name){
    document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
    $(`screen-${name}`)?.classList.add("active");
    State.phase = name;
    save();
  }

  /* =========================================================
     Data Loader：把你的分檔接回（安全）
     你 repo 結構（你給我的）：
       /data/ww.data.js
       /data/roles/roles.*.js
       /data/boards/*.js
       /data/flow/*.js
       /data/rules/*.js
       /engine/*.js
  ========================================================= */
  const WW_FALLBACK = {
    roles: {
      villager:{ id:"villager", name:"村民", icon:"🙂", team:"villager" },
      werewolf:{ id:"werewolf", name:"狼人", icon:"🐺", team:"wolf" },
      seer:{ id:"seer", name:"預言家", icon:"🔮", team:"villager" },
      witch:{ id:"witch", name:"女巫", icon:"🧪", team:"villager" },
      hunter:{ id:"hunter", name:"獵人", icon:"🏹", team:"villager" },
      guard:{ id:"guard", name:"守衛", icon:"🛡️", team:"villager" },
      knight:{ id:"knight", name:"騎士", icon:"⚔️", team:"villager" },
      blackWolfKing:{ id:"blackWolfKing", name:"黑狼王", icon:"🐺👑", team:"wolf" },
      whiteWolfKing:{ id:"whiteWolfKing", name:"白狼王", icon:"🐺🤍", team:"wolf" },
    },
    boards: {
      basic:{ id:"basic", name:"基礎板子" },
      b1:{ id:"b1", name:"特殊板子" },
    }
  };

  function mergeMaps(...maps){
    const out = {};
    maps.forEach(m=>{
      if(!m) return;
      Object.keys(m).forEach(k=> out[k] = m[k]);
    });
    return out;
  }

  function ensureWWData(){
    const W = window;

    // 收集 roles（支援多種命名）
    const rolesAll = mergeMaps(
      W.WW_ROLES || null,
      W.WW_ROLES_BASE || null,
      W.WW_ROLES_B1 || null,
      W.WW_DATA?.roles || null
    );
    const roles = Object.keys(rolesAll).length ? rolesAll : WW_FALLBACK.roles;

    // boards
    const boardsAll = mergeMaps(
      W.WW_BOARDS || null,
      W.WW_DATA?.boards || null,
      W.BOARDS || null
    );
    const boards = Object.keys(boardsAll).length ? boardsAll : WW_FALLBACK.boards;

    // rules
    const rulesBasic =
      W.WW_RULES_BASIC || W.WW_RULES?.basic || W.WW_DATA?.rules?.basic || W.RULES_BASIC || null;
    const rulesB1 =
      W.WW_RULES_B1 || W.WW_RULES?.b1 || W.WW_DATA?.rules?.b1 || W.RULES_B1 || null;

    // night steps
    const nightBasic =
      W.WW_NIGHT_STEPS_BASIC || W.WW_DATA?.nightSteps?.basic || W.NIGHT_STEPS_BASIC || null;
    const nightB1 =
      W.WW_NIGHT_STEPS_B1 || W.WW_DATA?.nightSteps?.b1 || W.NIGHT_STEPS_B1 || null;

    // win engine
    const winEngine =
      W.WW_WIN_ENGINE || W.WW_DATA?.engines?.win || W.WIN_ENGINE || null;

    W.WW_DATA = W.WW_DATA || {};
    W.WW_DATA.roles = roles;
    W.WW_DATA.boards = boards;
    W.WW_DATA.rules = { basic: rulesBasic, b1: rulesB1 };
    W.WW_DATA.nightSteps = { basic: nightBasic, b1: nightB1 };
    W.WW_DATA.engines = { win: winEngine };

    W.WW_DATA.getRole = (rid)=> W.WW_DATA.roles?.[rid] || null;
    W.WW_DATA.getBoardBundle = (bid)=>{
      const board = W.WW_DATA.boards?.[bid] || { id: bid, name: bid };
      const rules = bid === "b1" ? W.WW_DATA.rules.b1 : W.WW_DATA.rules.basic;
      const nightSteps = bid === "b1" ? W.WW_DATA.nightSteps.b1 : W.WW_DATA.nightSteps.basic;
      return { board, rules, nightSteps };
    };

    return W.WW_DATA;
  }

  async function loadScriptOnce(src){
    return new Promise((resolve)=>{
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = ()=> resolve(true);
      s.onerror = ()=> resolve(false);
      document.head.appendChild(s);
    });
  }

  async function bootstrapData(){
    // 依你資料夾清單：把最重要的先載入（失敗也繼續）
    const candidates = [
      "./data/ww.data.js",

      "./data/roles/roles.base.js",
      "./data/roles/roles.b1.js",
      "./data/roles/roles.all.js",
      "./data/roles/roles.index.js",
      "./data/roles/roles.special.js",
      "./data/roles/roles.special.b1.js",

      "./data/boards/boards.js",
      "./data/boards/board.basic.js",
      "./data/boards/board.special.js",
      "./data/boards/basic.bundle.js",
      "./data/boards/boards.b1.js",
      "./data/boards/boards.config.js",
      "./data/boards/boards.index.js",

      "./data/rules/rules.basic.js",
      "./data/rules/rules.b1.js",
      "./data/rules/rules.core.js",

      "./data/flow/night.steps.basic.js",
      "./data/flow/night.steps.b1.js",
      "./data/flow/night.steps.js",
      "./data/flow/night.steps.special.js",
      "./data/flow/night.special.registry.js",
      "./data/flow/night.witch.js",
      "./data/flow/day.flow.js",
      "./data/flow/day.vote.js",
      "./data/flow/vote.day.js",
      "./data/flow/win.check.js",

      "./engine/win.engine.js",
      "./engine/day.engine.js",
      "./engine/night.engine.js",

      "./app/state.core.js",
      "./app/state.js",
      "./app/app.js",
      "./app/app.state.js",
      "./app/app.render.js",
      "./app/app.ui.bindings.js",
      "./app/app.ui.render.js",
      "./app/day.js",
      "./app/night.js",
    ];

    // 只要其中部分成功就好；不硬 fail
    for (const src of candidates) {
      // 已有 WW_DATA 且已能 getBoardBundle / roles 就不必再狂載
      // 但為了你說 ww.data.js 有時沒反應，我們仍安全逐一載入
      await loadScriptOnce(src);
    }

    ensureWWData();

    // 最終保險：如果 roles 還是空，用 fallback
    if (!window.WW_DATA?.roles || !Object.keys(window.WW_DATA.roles).length) {
      window.WW_DATA = window.WW_DATA || {};
      window.WW_DATA.roles = WW_FALLBACK.roles;
    }
    if (!window.WW_DATA?.boards || !Object.keys(window.WW_DATA.boards).length) {
      window.WW_DATA = window.WW_DATA || {};
      window.WW_DATA.boards = WW_FALLBACK.boards;
    }
  }

  /* ---------------------------
     WW helpers
  --------------------------- */
  function getWW(){ return window.WW_DATA || null; }
  function getRolesMap(){ return getWW()?.roles || {}; }
  function getRole(roleId){
    const r = getRolesMap()?.[roleId];
    return r || { id: roleId, name: roleId, icon:"❔", team:"villager" };
  }
  function getBoardBundle(boardId){
    const WW = getWW();
    if (WW?.getBoardBundle) {
      try { return WW.getBoardBundle(boardId); } catch(e){}
    }
    const b = WW?.boards?.[boardId] || { id: boardId, name: boardId };
    const rules = boardId === "b1" ? (WW?.rules?.b1) : (WW?.rules?.basic);
    const nightSteps = boardId === "b1" ? (WW?.nightSteps?.b1) : (WW?.nightSteps?.basic);
    return { board: b, rules, nightSteps };
  }

  /* =========================================================
     Setup：建議配置（可用 boards preset，沒有就 fallback）
  ========================================================= */
  function rolesTotal(map){
    return Object.values(map || {}).reduce((a,b)=> a + (Number(b)||0), 0);
  }

  function suggestBasicConfigByCount(n){
    const wolves = n >= 10 ? 3 : (n >= 8 ? 2 : 2);
    const fixed = 3; // seer+witch+hunter
    const villager = Math.max(0, n - wolves - fixed);
    return { werewolf:wolves, villager, seer:1, witch:1, hunter:1 };
  }

  function suggestB1ConfigByCount(n){
    const base = { villager:0, werewolf:0, seer:1, witch:1, hunter:1, guard:1, knight:1, blackWolfKing:1, whiteWolfKing:1 };
    const wolves = n >= 11 ? 3 : 2;
    base.werewolf = Math.max(0, wolves - 2); // 扣黑/白狼王
    const fixed = Object.values(base).reduce((a,b)=>a+b,0);
    base.villager = Math.max(0, n - fixed);
    return base;
  }

  function getSuggestedRolesCount(boardId, n){
    const bundle = getBoardBundle(boardId);
    const preset = bundle?.board?.presets?.[n];
    if (preset && typeof preset === "object") {
      try { return structuredClone(preset); } catch(e){ return JSON.parse(JSON.stringify(preset)); }
    }
    return boardId === "b1" ? suggestB1ConfigByCount(n) : suggestBasicConfigByCount(n);
  }

  function syncSetupUI(){
    if ($("playerCount")) $("playerCount").textContent = String(State.playerCount);
    if ($("playerTotal")) $("playerTotal").textContent = String(State.playerCount);

    const total = rolesTotal(State.rolesCount);
    if ($("roleTotal")) $("roleTotal").textContent = String(total);

    const ok = total === State.playerCount;
    $("warnRoleTotal")?.classList.toggle("hidden", ok);

    const btnStart = $("btnStart");
    if (btnStart) {
      btnStart.disabled = !ok;
      btnStart.textContent = ok ? "開始 → 抽身分" : "⚠️ 角色總數需等於玩家數";
    }
    save();
  }

  function setBoard(boardId){
    State.boardId = boardId;
    $("boardBasic")?.classList.toggle("active", boardId === "basic");
    $("boardSpecial")?.classList.toggle("active", boardId === "b1");
    State.rolesCount = getSuggestedRolesCount(boardId, State.playerCount);
    syncSetupUI();
  }

  function setPlayerCount(n){
    const v = Math.max(6, Math.min(12, Number(n) || 9));
    State.playerCount = v;
    const range = $("rangeCount");
    if (range) range.value = String(v);
    State.rolesCount = getSuggestedRolesCount(State.boardId, v);
    syncSetupUI();
  }

  /* ---------------------------
     Players build + shuffle
  --------------------------- */
  function shuffle(arr){
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function buildPlayersFromRolesCount(){
    const rolesArr = [];
    for (const [rid, cnt] of Object.entries(State.rolesCount || {})) {
      for (let i = 0; i < (Number(cnt)||0); i++) rolesArr.push(rid);
    }
    shuffle(rolesArr);

    State.players = rolesArr.map((rid, idx) => {
      const r = getRole(rid);
      return { seat: idx+1, roleId: rid, name: r.name||rid, icon: r.icon||"❔", team: r.team||"villager", alive: true };
    });

    State.dealIndex = 0;
    State.nightNo = 1;
    State.dayNo = 1;
    State.logs = [];
    State.nightState = {};
    State.nightSteps = [];
    State.nightStepIndex = 0;
    State.witch = State.witch || { saveUsed:false, poisonUsed:false, save:false, poisonTarget:null };
    State.dayMode = "mark";
    State.dayVote = { target:null };
    save();
  }

  /* =========================================================
     Deal
  ========================================================= */
  let _dealHoldTimer = null;

  function renderDealSeatGrid(){
    const grid = $("dealSeatGrid");
    if (!grid) return;
    grid.innerHTML = "";
    State.players.forEach((p, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seat" + (idx === State.dealIndex ? " selected" : "");
      b.textContent = String(p.seat);
      stopTextSelectOnTouch(b);
      b.onclick = () => {
        State.dealIndex = idx;
        save();
        renderDeal();
      };
      grid.appendChild(b);
    });
  }

  function showRevealForCurrent(){
    const p = State.players[State.dealIndex];
    if (!p) return;
    if ($("revealRole")) $("revealRole").textContent = `${p.icon} ${p.name}`;
    $("modalReveal")?.classList.remove("hidden");
    navigator.vibrate?.(40);
  }
  function hideReveal(){ $("modalReveal")?.classList.add("hidden"); }

  function renderDeal(){
    const p = State.players[State.dealIndex];
    if (!p) return;

    if ($("dealText")) $("dealText").innerHTML = `請 <b>${p.seat} 號</b> 拿手機`;
    renderDealSeatGrid();

    const btnHold = $("btnHoldReveal");
    if (btnHold) {
      stopTextSelectOnTouch(btnHold);
      btnHold.onpointerdown = (e) => {
        e.preventDefault?.();
        clearTimeout(_dealHoldTimer);
        _dealHoldTimer = setTimeout(showRevealForCurrent, 900);
      };
      const end = (e) => {
        e && e.preventDefault?.();
        clearTimeout(_dealHoldTimer);
        hideReveal();
      };
      btnHold.onpointerup = end;
      btnHold.onpointercancel = end;
      btnHold.onpointerleave = end;
    }

    // 下一位
    const btnNext = $("btnDealNext");
    if (btnNext) {
      btnNext.onclick = () => {
        State.dealIndex = Math.min(State.players.length - 1, State.dealIndex + 1);
        save(); renderDeal();
      };
    }

    // 全部抽完確認
    const btnAllDone = $("btnDealAllDone");
    if (btnAllDone) {
      btnAllDone.onclick = () => $("modalDealConfirm")?.classList.remove("hidden");
    }
    $("btnDealConfirmYes") && ($("btnDealConfirmYes").onclick = () => {
      $("modalDealConfirm")?.classList.add("hidden");
      startNight();
    });
    $("btnDealConfirmNo") && ($("btnDealConfirmNo").onclick = () => {
      $("modalDealConfirm")?.classList.add("hidden");
    });
  }

  /* =========================================================
     Night steps
  ========================================================= */
  function hasRole(roleId){
    return State.players.some(p => p.roleId === roleId);
  }

  function buildFallbackNightSteps(){
    const steps = [];
    steps.push({ key:"close", type:"info", publicScript:"天黑請閉眼。", godScript:"天黑請閉眼。" });

    if (hasRole("guard")) {
      steps.push({ key:"guard", type:"pick", pickKey:"guardTarget", required:true,
        publicScript:"守衛請睜眼，守一位玩家。", godScript:"守衛守誰？（點座位）"
      });
    }

    steps.push({ key:"wolf", type:"pick", pickKey:"wolfTarget", required: !State.settings.wolfCanNoKill, allowNull: !!State.settings.wolfCanNoKill,
      publicScript: State.settings.wolfCanNoKill ? "狼人請睜眼（可空刀），選擇目標。":"狼人請睜眼，選擇目標。",
      godScript: State.settings.wolfCanNoKill ? "狼人刀誰？（可不選=空刀）":"狼人刀誰？（必選）"
    });

    if (hasRole("seer")) {
      steps.push({ key:"seer", type:"seer", pickKey:"seerCheck", required:true,
        publicScript:"預言家請睜眼，查驗一位玩家。", godScript:"預言家查誰？（點座位）"
      });
    }

    if (hasRole("witch")) {
      steps.push({ key:"witch", type:"witch",
        publicScript:"女巫請睜眼（上帝操作）。", godScript:"女巫：點被刀=救、點其他=毒、下一步=不使用"
      });
    }

    steps.push({ key:"resolve", type:"resolve", publicScript:"天亮請睜眼。", godScript:"天亮：結算夜晚並公告。" });
    return steps;
  }

  function resolveNightStepsForThisGame(){
    const bundle = getBoardBundle(State.boardId);
    let steps = bundle?.nightSteps;

    if (typeof steps === "function") {
      try { steps = steps(State.players, State.nightState); } catch(e){ steps = null; }
    }
    if (!Array.isArray(steps) || steps.length === 0) {
      steps = buildFallbackNightSteps();
    }

    State.nightSteps = steps;
    State.nightStepIndex = 0;
    save();
  }

  function getCurrentNightStep(){
    return State.nightSteps?.[State.nightStepIndex] || null;
  }

  function scriptForStep(step){
    const s = State.godView ? (step.godScript || step.publicScript) : (step.publicScript || step.godScript);
    return s || "（無台詞）";
  }

  function selectedSeatForStep(step){
    if (!step) return null;
    if (step.type === "pick" || step.type === "seer") {
      return step.pickKey ? (State.nightState[step.pickKey] || null) : null;
    }
    if (step.type === "witch") {
      // 女巫：優先顯示毒目標，再顯示救（刀口）
      return State.witch.poisonTarget || (State.witch.save ? (State.nightState.wolfTarget||null) : null);
    }
    return null;
  }

  function renderSeats(containerId, onPick, selectedSeat=null){
    const box = $(containerId);
    if (!box) return;
    box.innerHTML = "";

    State.players.forEach(p => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seat" + (p.alive ? "" : " dead") + (selectedSeat === p.seat ? " selected" : "");
      b.textContent = String(p.seat);
      b.disabled = !p.alive;
      stopTextSelectOnTouch(b);

      b.onclick = () => {
        if (!p.alive) return;
        onPick?.(p.seat);
      };
      box.appendChild(b);
    });
  }

  function canGoNextNightStep(step){
    if (!step) return false;
    if ((step.type === "pick" || step.type === "seer") && step.required && step.pickKey) {
      if (step.allowNull) return true;
      return !!State.nightState[step.pickKey];
    }
    // witch：可直接下一步（表示不用技能）
    return true;
  }

  function renderNight(){
    if ($("nightTag")) $("nightTag").textContent = `第 ${State.nightNo} 夜`;

    if (!State.nightSteps || !State.nightSteps.length) resolveNightStepsForThisGame();

    const step = getCurrentNightStep();
    if (!step) {
      if ($("nightScript")) $("nightScript").textContent = "（夜晚流程結束）";
      return;
    }

    // 顯示提示
    const tips = [];
    // 女巫提示：依用藥狀態顯示
    if (step.type === "witch") {
      const knifeSeat = State.nightState.wolfTarget || null;
      if (State.witch.saveUsed) {
        tips.push("🧪 解藥：已用過（本局不再顯示刀口）");
      } else {
        tips.push(`🧪 解藥：${knifeSeat ? `刀口 ${knifeSeat} 號（點他=救）` : "狼人尚未選刀"}`);
      }
      tips.push(`☠️ 毒藥：${State.witch.poisonUsed ? "已用過（毒藥沒了）" : "可用（點其他人=毒）"}`);
      if (State.witch.poisonTarget) tips.push(`已選毒：${State.witch.poisonTarget} 號`);
      if (State.witch.save && knifeSeat) tips.push(`已選救：${knifeSeat} 號`);
    }

    // 預言家結果顯示
    if (step.type === "seer" && State.nightState.seerCheck) {
      const seat = State.nightState.seerCheck;
      const p = State.players.find(x=>x.seat===seat);
      if (p) {
        const role = getRole(p.roleId);
        tips.push(`🔮 查驗 ${seat} 號 → ${role.icon} ${role.name}（${role.team==="wolf"?"狼人陣營":"好人陣營"}）`);
      }
    }

    const base = scriptForStep(step);
    if ($("nightScript")) $("nightScript").textContent = tips.length ? (base + "\n" + tips.join("\n")) : base;

    // 座位圈
    const sel = selectedSeatForStep(step);
    renderSeats("nightSeats", (seat) => {
      const cur = getCurrentNightStep();
      if (!cur) return;

      // guard / wolf / pick
      if (cur.type === "pick" && cur.pickKey) {
        // 狼人空刀：點同一人再次點=取消
        if (cur.pickKey === "wolfTarget" && State.settings.wolfCanNoKill) {
          State.nightState[cur.pickKey] = (State.nightState[cur.pickKey] === seat) ? null : seat;
        } else {
          State.nightState[cur.pickKey] = seat;
        }
        save(); renderNight();
        return;
      }

      // seer：點了就顯示結果（上帝提示）
      if (cur.type === "seer" && cur.pickKey) {
        State.nightState[cur.pickKey] = seat;
        save(); renderNight();
        return;
      }

      // witch：不跳視窗，直接判定救/毒
      if (cur.type === "witch") {
        const knifeSeat = State.nightState.wolfTarget || null;

        // 若點刀口：救（前提解藥未用）
        if (!State.witch.saveUsed && knifeSeat && seat === knifeSeat) {
          State.witch.save = true;
          save(); renderNight();
          return;
        }

        // 其他：毒（前提毒藥未用）
        if (!State.witch.poisonUsed) {
          State.witch.poisonTarget = seat;
          save(); renderNight();
          return;
        }

        // 毒藥已用：點了也不變（但不阻斷流程）
        navigator.vibrate?.(30);
        return;
      }
    }, sel);
  }

  function nightPrev(){
    State.nightStepIndex = Math.max(0, State.nightStepIndex - 1);
    save(); renderNight();
  }

  function nightNext(){
    const step = getCurrentNightStep();
    if (!step) return;

    if (!canGoNextNightStep(step)) {
      navigator.vibrate?.([60,40,60]);
      return;
    }

    // 女巫：按下一步＝不使用技能（清除本晚選擇，但永久用藥不變）
    if (step.type === "witch") {
      // 只要按下一步就進結算步驟（下一個 step）
      State.nightStepIndex = Math.min(State.nightSteps.length - 1, State.nightStepIndex + 1);
      save(); renderNight();
      return;
    }

    if (step.type === "resolve") {
      resolveNight();
      return;
    }

    State.nightStepIndex = Math.min(State.nightSteps.length - 1, State.nightStepIndex + 1);
    save(); renderNight();
  }

  /* =========================================================
     Resolve Night + Win
  ========================================================= */
  function builtInResolveNight(){
    // 簡化結算：處理守衛、女巫救、女巫毒（不含連鎖技能）
    const knife = State.nightState.wolfTarget || null;
    const guard = State.nightState.guardTarget || null;

    const killed = new Set();
    if (knife) killed.add(knife);

    // 守衛擋刀
    if (knife && guard && knife === guard) killed.delete(knife);

    // 女巫救：點刀口=救
    if (State.witch.save && knife && !State.witch.saveUsed) killed.delete(knife);

    // 女巫毒
    if (State.witch.poisonTarget && !State.witch.poisonUsed) killed.add(State.witch.poisonTarget);

    // 套用死亡
    const deadSeats = [];
    killed.forEach(seat=>{
      const p = State.players.find(x=>x.seat===seat);
      if (p && p.alive) { p.alive = false; deadSeats.push(seat); }
    });

    return { deadSeats };
  }

  function builtInAnnouncement(resolved){
    const deadSeats = resolved?.deadSeats || [];
    if (!deadSeats.length) return { publicText: "天亮了，昨晚是平安夜。", hiddenText:"" };
    return { publicText: `天亮了，昨晚死亡：${deadSeats.join("、")} 號。`, hiddenText:"" };
  }

  function checkWinBuiltIn(){
    const alive = State.players.filter(p=>p.alive);
    const wolves = alive.filter(p=> getRole(p.roleId).team === "wolf").length;
    const good = alive.length - wolves;

    if (wolves <= 0) return { ended:true, winner:"good", text:"✅ 好人獲勝（狼人全滅）" };
    if (wolves >= good) return { ended:true, winner:"wolf", text:"🐺 狼人獲勝（狼數≥好人）" };
    return { ended:false };
  }

  function resolveNight(){
    const bundle = getBoardBundle(State.boardId);
    const rules = bundle?.rules || null;

    // 把女巫狀態寫回 nightState（若外部 rules 要用）
    State.nightState.witchSave = !!State.witch.save;
    State.nightState.witchPoisonTarget = State.witch.poisonTarget || null;
    State.nightState.witchSaveUsed = !!State.witch.saveUsed;
    State.nightState.witchPoisonUsed = !!State.witch.poisonUsed;

    let publicText = "";
    let hiddenText = "";
    let resolved = null;

    // 優先用外部 rules（若存在）
    if (rules?.resolveNight && rules?.buildAnnouncement) {
      try {
        resolved = rules.resolveNight({ players: State.players, night: State.nightState, settings: State.settings });
        const ann = rules.buildAnnouncement({
          nightNo: State.nightNo, dayNo: State.dayNo,
          players: State.players, night: State.nightState,
          resolved, settings: State.settings
        });
        publicText = ann?.publicText || "（公告產生失敗）";
        hiddenText = ann?.hiddenText || "";
      } catch (e) {
        warn("rules error:", e);
        resolved = builtInResolveNight();
        const ann = builtInAnnouncement(resolved);
        publicText = ann.publicText + "（已改用內建穩定規則）";
        hiddenText = State.godView ? String(e) : "";
      }
    } else {
      resolved = builtInResolveNight();
      const ann = builtInAnnouncement(resolved);
      publicText = ann.publicText;
      hiddenText = "";
    }

    // 用藥永久消耗鎖定
    if (State.witch.save && !State.witch.saveUsed) State.witch.saveUsed = true;
    if (State.witch.poisonTarget && !State.witch.poisonUsed) State.witch.poisonUsed = true;

    // push log
    State.logs.unshift({
      nightNo: State.nightNo,
      dayNo: State.dayNo,
      publicText,
      hiddenText,
      ts: new Date().toISOString()
    });

    // 勝負判定（先外部 win.engine，再內建）
    const WW = getWW();
    let win = null;
    try {
      if (WW?.engines?.win?.checkWin) {
        win = WW.engines.win.checkWin({ players: State.players, settings: State.settings, boardId: State.boardId });
      }
    } catch(e){ warn("win.engine error:", e); }
    if (!win || typeof win !== "object") win = checkWinBuiltIn();

    save();

    // 進白天
    showScreen("day");
    renderDay();
    openAnnouncementModal(true);

    // 若已結束，公告加一行
    if (win?.ended) {
      const extra = `\n\n${win.text || "（遊戲結束）"}`;
      State.logs[0].publicText += extra;
      save();
      renderAnnouncement();
    }
  }

  /* =========================================================
     Announcement modal
  ========================================================= */
  let annMode = "today";
  function renderAnnouncement(){
    const box = $("annBox");
    if (!box) return;

    if (!State.logs.length) {
      box.textContent = "（尚無公告）";
      return;
    }

    if (annMode === "today") {
      const l = State.logs[0];
      box.textContent = State.godView ? (l.publicText + (l.hiddenText ? "\n\n" + l.hiddenText : "")) : l.publicText;
      return;
    }

    const lines = [];
    State.logs.forEach((l, idx) => {
      lines.push(`#${State.logs.length - idx}｜第${l.nightNo}夜 / 第${l.dayNo}天`);
      lines.push(l.publicText || "—");
      if (State.godView && l.hiddenText) lines.push(l.hiddenText);
      lines.push("—");
    });
    box.textContent = lines.join("\n");
  }

  function openAnnouncementModal(forceToday=false){
    if (forceToday) annMode = "today";
    $("modalAnn")?.classList.remove("hidden");
    $("annToday")?.classList.toggle("active", annMode === "today");
    $("annHistory")?.classList.toggle("active", annMode === "history");
    renderAnnouncement();
  }

  function closeAnnouncementModal(){
    $("modalAnn")?.classList.add("hidden");
  }

  /* =========================================================
     Day：座位圈（點就變色）
  ========================================================= */
  function renderDay(){
    if ($("dayTag")) $("dayTag").textContent = `第 ${State.dayNo} 天`;
    renderDayAlive();
    renderDaySeats();
  }

  function renderDayAlive(){
    const el = $("dayAlive");
    if (!el) return;
    const alive = State.players.filter(p=>p.alive).map(p=>p.seat);
    el.textContent = alive.length ? `存活：${alive.join("、")} 號` : "（全滅？）";
  }

  function renderDaySeats(){
    const box = $("daySeats");
    if (!box) return;
    box.innerHTML = "";

    State.players.forEach(p=>{
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seat" + (p.alive ? "" : " dead");

      // 投票模式：選到 target 變 selected
      if (State.dayMode === "vote" && State.dayVote.target === p.seat) b.classList.add("selected");

      // 標記模式：死亡就是 dead（已在 class）
      b.textContent = String(p.seat);
      stopTextSelectOnTouch(b);

      b.onclick = () => {
        if (State.dayMode === "mark") {
          p.alive = !p.alive; // 點一下切換存活/死亡
          save();
          renderDay();
          return;
        }
        if (State.dayMode === "vote") {
          State.dayVote.target = (State.dayVote.target === p.seat) ? null : p.seat;
          save();
          renderDaySeats();
          return;
        }
      };

      box.appendChild(b);
    });
  }

  function dayToggleMode(){
    State.dayMode = State.dayMode === "mark" ? "vote" : "mark";
    save();
    $("dayModeHint") && ($("dayModeHint").textContent =
      State.dayMode === "mark" ? "☠️ 標記模式：點座位可切換存活" : "🗳️ 投票模式：點座位選投票目標"
    );
    renderDaySeats();
  }

  function dayConfirmVote(){
    if (State.dayMode !== "vote") return;
    const t = State.dayVote.target;
    if (!t) { navigator.vibrate?.(40); return; }
    State.logs.unshift({
      nightNo: State.nightNo,
      dayNo: State.dayNo,
      publicText: `白天投票：目前指向 ${t} 號（你可自行決定是否放逐/進PK）`,
      hiddenText: "",
      ts: new Date().toISOString()
    });
    save();
    openAnnouncementModal(true);
  }

  function nextDayToNight(){
    State.nightNo += 1;
    State.dayNo += 1;

    // reset night picks
    State.nightState = {};
    State.nightStepIndex = 0;

    // 女巫每晚可重新選（但 saveUsed/poisonUsed 永久保留）
    State.witch.save = false;
    State.witch.poisonTarget = null;

    State.dayMode = "mark";
    State.dayVote = { target:null };

    resolveNightStepsForThisGame();
    save();
    showScreen("night");
    renderNight();
  }

  /* =========================================================
     Start Game / Night init
  ========================================================= */
  function startGame(){
    // 一律先確保 WW_DATA（即使 ww.data.js 沒反應，也有 fallback）
    ensureWWData();

    if (!State.rolesCount) State.rolesCount = getSuggestedRolesCount(State.boardId, State.playerCount);
    if (rolesTotal(State.rolesCount) !== State.playerCount) {
      alert("⚠️ 角色總數必須等於玩家人數");
      return;
    }
    buildPlayersFromRolesCount();
    showScreen("deal");
    renderDeal();
  }

  function startNight(){
    // reset night
    State.nightState = {};
    State.nightStepIndex = 0;
    State.witch.save = false;
    State.witch.poisonTarget = null;
    resolveNightStepsForThisGame();
    save();
    showScreen("night");
    renderNight();
  }

  /* =========================================================
     God toggle + Restart
  ========================================================= */
  function setGod(onFlag){
    State.godView = !!onFlag;
    document.body.classList.toggle("god-on", State.godView);
    if ($("btnGodToggle")) $("btnGodToggle").textContent = State.godView ? "🔓" : "🔒";
    if ($("fabGod")) $("fabGod").textContent = State.godView ? "🔓" : "🔒";
    save();
    renderAnnouncement();
    if (State.phase === "night") renderNight();
  }
  function toggleGod(){ setGod(!State.godView); }

  function ensureRestartButton(){
    const b = $("btnRestart") || $("topRestart");
    if (!b) return;
    b.onclick = () => {
      if (!confirm("確定要重新開始？所有進度會清除並回到開局設定。")) return;
      clearSave();
      location.reload();
    };
  }

  /* =========================================================
     Role Config modal（可捲動＆可關）
  ========================================================= */
  function openRoleConfig(){
    const body = $("roleConfigBody");
    if (!body) return;

    body.innerHTML = "";
    const rolesMap = getRolesMap();
    const ids = Object.keys(rolesMap);

    const tip = document.createElement("div");
    tip.className = "hint";
    tip.textContent = "點＋/－調整數量；角色總數需等於玩家人數才能開始。";
    body.appendChild(tip);

    const priority = ["werewolf","villager","seer","witch","hunter","guard","knight","blackWolfKing","whiteWolfKing"];
    const ordered = Array.from(new Set([...priority, ...ids]));

    if (!State.rolesCount) State.rolesCount = getSuggestedRolesCount(State.boardId, State.playerCount);

    ordered.forEach((rid) => {
      const info = getRole(rid);

      const row = document.createElement("div");
      row.className = "role-row";

      const left = document.createElement("div");
      left.className = "role-left";
      left.textContent = `${info.icon ? info.icon+" " : ""}${info.name || rid}`;

      const right = document.createElement("div");
      right.className = "role-right";

      const minus = document.createElement("button");
      minus.type = "button";
      minus.className = "btn ghost tiny";
      minus.textContent = "－";

      const num = document.createElement("div");
      num.className = "role-num";
      num.textContent = String(State.rolesCount?.[rid] ?? 0);

      const plus = document.createElement("button");
      plus.type = "button";
      plus.className = "btn ghost tiny";
      plus.textContent = "＋";

      stopTextSelectOnTouch(minus);
      stopTextSelectOnTouch(plus);

      minus.onclick = () => {
        State.rolesCount[rid] = Math.max(0, (State.rolesCount[rid] || 0) - 1);
        num.textContent = String(State.rolesCount[rid]);
        syncSetupUI();
      };
      plus.onclick = () => {
        State.rolesCount[rid] = (State.rolesCount[rid] || 0) + 1;
        num.textContent = String(State.rolesCount[rid]);
        syncSetupUI();
      };

      right.append(minus, num, plus);
      row.append(left, right);
      body.appendChild(row);
    });

    $("modalRole")?.classList.remove("hidden");
  }

  function closeRoleConfig(){
    $("modalRole")?.classList.add("hidden");
  }

  /* =========================================================
     Bind events（依你的 index.html ids）
  ========================================================= */
  function bind(){
    // Setup
    $("boardBasic") && ($("boardBasic").onclick = () => setBoard("basic"));
    $("boardSpecial") && ($("boardSpecial").onclick = () => setBoard("b1"));

    $("rangeCount") && ($("rangeCount").oninput = (e) => setPlayerCount(e.target.value));
    $("btnRoles") && ($("btnRoles").onclick = openRoleConfig);
    $("btnRoleClose") && ($("btnRoleClose").onclick = closeRoleConfig);
    $("modalRoleMask") && ($("modalRoleMask").onclick = closeRoleConfig);

    $("btnStart") && ($("btnStart").onclick = startGame);

    // Deal
    $("btnBackSetup") && ($("btnBackSetup").onclick = () => { showScreen("setup"); syncSetupUI(); });

    // Night
    $("btnNightPrev") && ($("btnNightPrev").onclick = nightPrev);
    $("btnNightNext") && ($("btnNightNext").onclick = nightNext);
    $("btnAnn") && ($("btnAnn").onclick = () => openAnnouncementModal(true));
    $("btnGodToggle") && ($("btnGodToggle").onclick = toggleGod);
    $("fabGod") && ($("fabGod").onclick = toggleGod);

    // Announcement
    $("btnAnnClose") && ($("btnAnnClose").onclick = closeAnnouncementModal);
    $("annToday") && ($("annToday").onclick = () => { annMode="today"; openAnnouncementModal(false); });
    $("annHistory") && ($("annHistory").onclick = () => { annMode="history"; openAnnouncementModal(false); });

    // Day
    $("btnDayToNight") && ($("btnDayToNight").onclick = nextDayToNight);
    $("btnDayMode") && ($("btnDayMode").onclick = dayToggleMode);
    $("btnDayVoteConfirm") && ($("btnDayVoteConfirm").onclick = dayConfirmVote);

    // Restart
    ensureRestartButton();
  }

  /* =========================================================
     Init
  ========================================================= */
  async function init(){
    load();
    await bootstrapData();

    // 初始 UI 同步
    if (!State.rolesCount) State.rolesCount = getSuggestedRolesCount(State.boardId, State.playerCount);

    bind();
    setGod(State.godView);

    // 回到上次畫面
    showScreen(State.phase || "setup");

    if (State.phase === "setup") syncSetupUI();
    if (State.phase === "deal") renderDeal();
    if (State.phase === "night") { resolveNightStepsForThisGame(); renderNight(); }
    if (State.phase === "day") renderDay();

    // 額外：如果座位/按鈕有文字選取風險，統一加
    ["btnStart","btnRoles","btnNightPrev","btnNightNext","btnAnn","btnDayToNight","btnDayMode","btnDayVoteConfirm"]
      .forEach(id => stopTextSelectOnTouch($(id)));
  }

  // Boot
  init().catch(err => {
    warn("init failed:", err);
    ensureWWData();
    showScreen("setup");
    syncSetupUI();
  });

})();