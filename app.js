/* =========================================================
   狼人殺｜上帝輔助 PWA
   app.js（穩定可跑版｜不跳女巫視窗｜預言家顯示結果｜座位必變色）
========================================================= */

(() => {
  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);

  // 只做「不選字」：不要用 preventDefault 去擋 touchstart（會讓 iOS click 失效）
  try {
    document.documentElement.style.webkitUserSelect = "none";
    document.documentElement.style.userSelect = "none";
    document.documentElement.style.webkitTouchCallout = "none";
  } catch (e) {}

  on(document, "contextmenu", (e) => e.preventDefault(), { passive: false });
  on(document, "selectstart", (e) => e.preventDefault(), { passive: false });
  on(document, "gesturestart", (e) => e.preventDefault(), { passive: false });

  /* ---------------------------
     Storage
  --------------------------- */
  const STORAGE_KEY = "ww_save_v2";
  const State = {
    phase: "setup",
    boardId: "basic",
    playerCount: 9,
    rolesCount: null,

    players: [],
    dealIndex: 0,

    nightNo: 1,
    dayNo: 1,

    godView: false,

    nightState: {},
    nightSteps: [],
    nightStepIndex: 0,

    logs: [],

    // 女巫永久消耗狀態 + 每晚選擇
    witch: {
      saveUsed: false,
      poisonUsed: false,
      save: false,
      poisonTarget: null
    },

    // 連續守衛限制
    lastGuardTarget: null,

    // 白天選中（投票/標記用）
    daySelected: null,

    settings: {
      noConsecutiveGuard: true,
      wolfCanNoKill: true,
      witchCannotSelfSave: true
    }
  };

  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(State)); } catch(e){}
  };
  const load = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s && typeof s === "object") Object.assign(State, s);
    } catch(e){}
  };
  const clearSave = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch(e){}
  };

  /* ---------------------------
     Screen
  --------------------------- */
  function showScreen(name){
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    $(`screen-${name}`)?.classList.add("active");
    State.phase = name;
    save();
  }

  /* ---------------------------
     Data access（安全接回：有就用、沒有就 fallback）
  --------------------------- */
  function getWW(){ return window.WW_DATA || null; }

  function getRolesMap(){
    const WW = getWW();
    // 你 repo 也可能有 roles.js 另外掛全域：window.WW_ROLES 等
    return WW?.roles || window.WW_ROLES || {};
  }

  function getRole(roleId){
    const roles = getRolesMap();
    return roles?.[roleId] || { id: roleId, name: roleId, icon: "❔", team: "villager" };
  }

  function getBoardBundle(boardId){
    const WW = getWW();
    if (WW?.getBoardBundle) {
      const b = WW.getBoardBundle(boardId);
      if (b) return b;
    }
    // fallback：試著從已載入的全域抓
    const board = WW?.boards?.[boardId] || null;
    const rules = (boardId === "b1" ? (WW?.rules?.b1) : (WW?.rules?.basic)) || null;
    const nightSteps = (boardId === "b1" ? (WW?.nightSteps?.b1) : (WW?.nightSteps?.basic)) || null;
    return board ? { board, rules, nightSteps } : null;
  }

  /* ---------------------------
     Setup: suggestions
  --------------------------- */
  function suggestBasicConfigByCount(n){
    const wolves = n >= 10 ? 3 : 2;
    const fixed = 3; // seer+witch+hunter
    const villager = Math.max(0, n - wolves - fixed);
    return { werewolf: wolves, villager, seer: 1, witch: 1, hunter: 1 };
  }
  function suggestB1ConfigByCount(n){
    const base = { villager: 0, werewolf: 0, seer: 1, witch: 1, hunter: 1, guard: 1, knight: 1, blackWolfKing: 1, whiteWolfKing: 1 };
    const wolves = n >= 11 ? 3 : 2;
    base.werewolf = Math.max(0, wolves - 2);
    const fixed = Object.values(base).reduce((a,b)=>a+b,0);
    base.villager = Math.max(0, n - fixed);
    return base;
  }
  function getSuggestedRolesCount(boardId, n){
    const bundle = getBoardBundle(boardId);
    const preset = bundle?.board?.presets?.[n];
    if (preset && typeof preset === "object") return structuredClone(preset);
    return boardId === "b1" ? suggestB1ConfigByCount(n) : suggestBasicConfigByCount(n);
  }
  function rolesTotal(map){
    return Object.values(map || {}).reduce((a,b)=>a+(Number(b)||0),0);
  }

  function syncSetupUI(){
    $("playerCount") && ($("playerCount").textContent = String(State.playerCount));
    $("playerTotal") && ($("playerTotal").textContent = String(State.playerCount));
    $("roleTotal") && ($("roleTotal").textContent = String(rolesTotal(State.rolesCount)));
    const ok = rolesTotal(State.rolesCount) === State.playerCount;
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
    $("boardB1")?.classList.toggle("active", boardId === "b1");
    State.rolesCount = getSuggestedRolesCount(boardId, State.playerCount);
    syncSetupUI();
  }
  function setPlayerCount(n){
    const v = Math.max(6, Math.min(12, Number(n)||9));
    State.playerCount = v;
    $("rangeCount") && ($("rangeCount").value = String(v));
    State.rolesCount = getSuggestedRolesCount(State.boardId, v);
    syncSetupUI();
  }

  /* ---------------------------
     Build players
  --------------------------- */
  function shuffle(arr){
    for (let i = arr.length - 1; i > 0; i--){
      const j = Math.floor(Math.random()*(i+1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function buildPlayersFromRolesCount(){
    const rolesArr = [];
    for (const [rid,cnt] of Object.entries(State.rolesCount || {})){
      for (let i=0;i<(Number(cnt)||0);i++) rolesArr.push(rid);
    }
    shuffle(rolesArr);

    State.players = rolesArr.map((rid, idx) => {
      const r = getRole(rid);
      return {
        seat: idx + 1,
        roleId: rid,
        name: r.name || rid,
        icon: r.icon || "❔",
        team: r.team || "villager",
        alive: true
      };
    });

    State.dealIndex = 0;
    State.nightNo = 1;
    State.dayNo = 1;
    State.logs = [];
    State.nightState = {};
    State.nightSteps = [];
    State.nightStepIndex = 0;
    State.witch = State.witch || { saveUsed:false, poisonUsed:false, save:false, poisonTarget:null };
    State.lastGuardTarget = null;
    State.daySelected = null;
    save();
  }

  /* ---------------------------
     Deal
  --------------------------- */
  let holdTimer = null;

  function renderDealSeatGrid(){
    const grid = $("dealSeatGrid");
    if (!grid) return;
    grid.innerHTML = "";
    State.players.forEach((p, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seat" + (idx === State.dealIndex ? " selected" : "");
      b.textContent = String(p.seat);
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
    $("revealRole") && ($("revealRole").textContent = `${p.icon} ${p.name}`);
    $("modalReveal")?.classList.remove("hidden");
    navigator.vibrate?.(40);
  }
  function hideReveal(){ $("modalReveal")?.classList.add("hidden"); }

  function renderDeal(){
    const p = State.players[State.dealIndex];
    if (!p) return;

    $("dealText") && ($("dealText").innerHTML = `請 <b>${p.seat} 號</b> 拿手機`);
    renderDealSeatGrid();

    const btnHold = $("btnHoldReveal");
    if (!btnHold) return;

    btnHold.onpointerdown = (e) => {
      clearTimeout(holdTimer);
      holdTimer = setTimeout(showRevealForCurrent, 900);
    };
    const end = () => {
      clearTimeout(holdTimer);
      hideReveal();
    };
    btnHold.onpointerup = end;
    btnHold.onpointercancel = end;
    btnHold.onpointerleave = end;
  }

  function nextDeal(){
    State.dealIndex++;
    if (State.dealIndex >= State.players.length) {
      State.dealIndex = State.players.length - 1;
      navigator.vibrate?.([40,30,40]);
      renderDeal();
      return;
    }
    save();
    renderDeal();
  }

  function openDealConfirm(){ $("modalDealConfirm")?.classList.remove("hidden"); }
  function closeDealConfirm(){ $("modalDealConfirm")?.classList.add("hidden"); }

  /* ---------------------------
     Night steps（fallback + 安全接回）
  --------------------------- */
  function hasRole(roleId){
    return State.players.some(p => p.roleId === roleId);
  }

  function buildFallbackNightSteps(){
    const steps = [];
    steps.push({ key:"close", type:"info", publicScript:"天黑請閉眼。", godScript:"天黑請閉眼。" });

    if (hasRole("guard")) {
      steps.push({
        key:"guard",
        type:"pick",
        pickKey:"guardTarget",
        required:true,
        publicScript:"守衛請睜眼，請守一位玩家。",
        godScript:"守衛守誰？（點座位）"
      });
    }

    steps.push({
      key:"wolf",
      type:"pick",
      pickKey:"wolfTarget",
      required: !State.settings.wolfCanNoKill,
      allowNull: !!State.settings.wolfCanNoKill,
      publicScript: State.settings.wolfCanNoKill ? "狼人請睜眼（可空刀），請選擇目標。" : "狼人請睜眼，請選擇目標。",
      godScript: State.settings.wolfCanNoKill ? "狼人刀誰？（可不選=空刀；再點一次取消）" : "狼人刀誰？（必選）"
    });

    if (hasRole("seer")) {
      steps.push({
        key:"seer",
        type:"seer",
        pickKey:"seerCheck",
        required:true,
        publicScript:"預言家請睜眼，請查驗一位玩家。",
        godScript:"預言家查誰？（點座位後會顯示結果）"
      });
    }

    if (hasRole("witch")) {
      steps.push({
        key:"witch",
        type:"witch",
        publicScript:"女巫請睜眼（上帝操作）。",
        godScript:"女巫：點『刀口』=救；點『其他人』=毒；按下一步=不用技能"
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

  /* ---------------------------
     Seat render（確保必變色）
  --------------------------- */
  function renderSeats(containerId, opts){
    const box = $(containerId);
    if (!box) return;
    box.innerHTML = "";

    const {
      selectedSeat = null,
      disabledSeats = new Set(),
      onPick = null
    } = opts || {};

    State.players.forEach(p => {
      const b = document.createElement("button");
      b.type = "button";

      const isDisabled = !p.alive || disabledSeats.has(p.seat);
      b.disabled = isDisabled;

      b.className =
        "seat" +
        (p.alive ? "" : " dead") +
        (selectedSeat === p.seat ? " selected" : "");

      b.textContent = String(p.seat);

      b.onclick = () => {
        if (isDisabled) return;
        onPick?.(p.seat);
      };

      box.appendChild(b);
    });
  }

  /* ---------------------------
     Night UI logic（守衛/狼/預言家/女巫都在同畫面）
  --------------------------- */
  function setNightScript(text){
    $("nightScript") && ($("nightScript").textContent = text || "");
  }

  function renderNight(){
    $("nightTag") && ($("nightTag").textContent = `第 ${State.nightNo} 夜`);

    if (!State.nightSteps || State.nightSteps.length === 0) {
      resolveNightStepsForThisGame();
    }

    const step = getCurrentNightStep();
    if (!step) {
      setNightScript("（夜晚流程結束）");
      return;
    }

    // helper text
    const helper = $("nightHelper");
    if (helper) helper.textContent = "";

    // 依視角顯示台詞
    let baseScript = State.godView ? (step.godScript || step.publicScript) : (step.publicScript || step.godScript);
    baseScript = baseScript || "（無台詞）";

    // 額外顯示：預言家結果 / 女巫刀口與藥狀態
    if (State.godView && step.type === "seer" && State.nightState.seerResultText) {
      baseScript += "\n\n" + State.nightState.seerResultText;
    }

    if (State.godView && step.type === "witch") {
      const knifeSeat = State.nightState.wolfTarget || null;
      const parts = [];

      // 解藥提示（用過就不顯示刀口）
      if (State.witch.saveUsed) {
        parts.push("解藥：已用過（本局無法再救）");
      } else {
        parts.push("解藥：可用");
        if (knifeSeat) parts.push(`刀口：${knifeSeat} 號（點刀口=救）`);
        else parts.push("刀口：狼人尚未選刀");
      }

      // 毒藥提示
      if (State.witch.poisonUsed) parts.push("毒藥：已用過（本局無法再毒）");
      else parts.push("毒藥：可用（點其他人=毒）");

      // 本晚選擇提示
      if (State.witch.save) parts.push("✅ 本晚已選：救人");
      if (State.witch.poisonTarget) parts.push(`☠️ 本晚已選：毒 ${State.witch.poisonTarget} 號`);

      baseScript += "\n\n" + parts.join("\n");
    }

    setNightScript(baseScript);

    // 本步驟允許點哪些座位？
    const disabledSeats = new Set();
    let selectedSeat = null;

    // 只有 pick/seer/witch 才能點座位
    const seatClickable = State.godView && (step.type === "pick" || step.type === "seer" || step.type === "witch");
    if (!seatClickable) {
      // 全部禁用（避免亂點）
      State.players.forEach(p => disabledSeats.add(p.seat));
      if (helper) helper.textContent = "（此步驟不需點座位）";
    } else {
      // 依不同步驟決定選中座位與禁用
      if (step.type === "pick" && step.pickKey) {
        selectedSeat = State.nightState[step.pickKey] || null;

        // 守衛：連續守同一人不可
        if (step.pickKey === "guardTarget" && State.settings.noConsecutiveGuard && State.lastGuardTarget) {
          disabledSeats.add(State.lastGuardTarget);
          if (helper) helper.textContent = `（規則：不能連續守同一人；上次守的是 ${State.lastGuardTarget} 號）`;
        }
      }

      if (step.type === "seer") {
        selectedSeat = State.nightState.seerCheck || null;
      }

      if (step.type === "witch") {
        // 女巫本步驟座位按鈕「不顯示選中」也可，但你要明確回饋 → 用 poisonTarget 當選中色
        selectedSeat = State.witch.poisonTarget || (State.witch.save ? (State.nightState.wolfTarget || null) : null);

        // 如果刀口不存在，就不讓「救」發生（點任何人只可能毒）
        // 但座位仍可點（毒）
      }
    }

    renderSeats("nightSeats", {
      selectedSeat,
      disabledSeats,
      onPick: (seat) => handleNightSeatPick(step, seat)
    });
  }

  function handleNightSeatPick(step, seat){
    if (!State.godView) return;

    // INFO / RESOLVE 不應該可點（保險）
    if (!step || !(step.type === "pick" || step.type === "seer" || step.type === "witch")) return;

    // ---- 守衛 / 狼 等一般 pick
    if (step.type === "pick" && step.pickKey) {
      // 守衛：連續守同一人不可
      if (step.pickKey === "guardTarget" && State.settings.noConsecutiveGuard && State.lastGuardTarget && seat === State.lastGuardTarget) {
        navigator.vibrate?.([40,30,40]);
        return;
      }

      // 狼刀：允許空刀 → 再點一次取消
      if (step.pickKey === "wolfTarget" && State.settings.wolfCanNoKill) {
        const cur = State.nightState.wolfTarget || null;
        State.nightState.wolfTarget = (cur === seat) ? null : seat;
      } else {
        State.nightState[step.pickKey] = seat;
      }

      save();
      renderNight();
      return;
    }

    // ---- 預言家：點了就顯示查驗結果（顯示在提示）
    if (step.type === "seer") {
      State.nightState.seerCheck = seat;

      const p = State.players.find(x => x.seat === seat);
      const role = p ? getRole(p.roleId) : null;

      // 你要「顯示角色身分讓上帝告知預言家」
      const res = p
        ? `🔎 查驗結果：${seat} 號是「${role?.icon || ""}${role?.name || p.roleId}」｜陣營：${p.team}`
        : `🔎 查驗結果：${seat} 號（查無資料）`;

      State.nightState.seerResultText = res;

      save();
      renderNight();
      return;
    }

    // ---- 女巫：不跳視窗
    if (step.type === "witch") {
      const knifeSeat = State.nightState.wolfTarget || null;

      // 點到刀口：救（若解藥未用過）
      if (knifeSeat && seat === knifeSeat && !State.witch.saveUsed) {
        // 自救限制：若你之後要加「女巫座位」才可判定；此版先保留設定位
        State.witch.save = true;
        State.witch.poisonTarget = null; // 救就先清毒（避免同晚兩個動作造成混亂）
        save();
        renderNight();
        return;
      }

      // 點其他人：毒（若毒藥未用過）
      if (!State.witch.poisonUsed) {
        State.witch.poisonTarget = (State.witch.poisonTarget === seat) ? null : seat; // 再點取消
        State.witch.save = false; // 你要求：點其他人就是毒
        save();
        renderNight();
        return;
      }

      // 毒藥已用過，點了也不做事
      navigator.vibrate?.([40,30,40]);
      return;
    }
  }

  function canGoNextNightStep(step){
    if (!step) return false;

    // pick required
    if (step.type === "pick" && step.required && step.pickKey) {
      if (step.allowNull) return true;
      return !!State.nightState[step.pickKey];
    }
    if (step.type === "seer") {
      return !!State.nightState.seerCheck;
    }
    // witch：允許直接下一步＝不使用技能
    return true;
  }

  function nightPrev(){
    State.nightStepIndex = Math.max(0, State.nightStepIndex - 1);
    save();
    renderNight();
  }

  function nightNext(){
    const step = getCurrentNightStep();
    if (!step) return;

    if (!State.godView && (step.type === "pick" || step.type === "seer" || step.type === "witch")) {
      alert("需要切換 🔓 上帝視角 才能操作夜晚目標");
      return;
    }

    if (!canGoNextNightStep(step)) {
      navigator.vibrate?.([40,30,40]);
      return;
    }

    if (step.type === "resolve") {
      resolveNight();
      return;
    }

    // 守衛 target 記錄（用於下一夜連守限制）
    if (step.type === "pick" && step.pickKey === "guardTarget") {
      State.lastGuardTarget = State.nightState.guardTarget || null;
    }

    State.nightStepIndex = Math.min(State.nightSteps.length - 1, State.nightStepIndex + 1);
    save();
    renderNight();
  }

  /* ---------------------------
     Resolve Night（公告乾淨、不噴錯誤字）
  --------------------------- */
  function resolveNight(){
    const bundle = getBoardBundle(State.boardId);
    const rules = bundle?.rules || null;

    // 寫回 nightState（給 rules 用）
    State.nightState.witchSave = !!State.witch.save;
    State.nightState.witchPoisonTarget = State.witch.poisonTarget || null;
    State.nightState.witchSaveUsed = !!State.witch.saveUsed;
    State.nightState.witchPoisonUsed = !!State.witch.poisonUsed;

    let publicText = "";
    let hiddenText = "";
    let resolved = null;

    // 用過就永遠不能再用
    if (State.witch.save) State.witch.saveUsed = true;
    if (State.witch.poisonTarget) State.witch.poisonUsed = true;

    // 嘗試接 rules（如果你 data/rules 有提供）
    if (rules?.resolveNight && rules?.buildAnnouncement) {
      try {
        resolved = rules.resolveNight({
          players: State.players,
          night: State.nightState,
          settings: State.settings
        });

        const ann = rules.buildAnnouncement({
          nightNo: State.nightNo,
          dayNo: State.dayNo,
          players: State.players,
          night: State.nightState,
          resolved,
          settings: State.settings
        });

        publicText = ann?.publicText || "天亮了。";
        hiddenText = ann?.hiddenText || "";
      } catch (e) {
        publicText = "天亮了。（目前使用穩定簡化規則：不自動結算死亡，你可白天手動標記）";
        hiddenText = State.godView ? `rules error: ${String(e)}` : "";
      }
    } else {
      // fallback：乾淨公告
      publicText = "天亮了。（目前使用穩定簡化規則：不自動結算死亡，你可白天手動標記）";
      hiddenText = State.godView ? `（上帝）nightState=${JSON.stringify(State.nightState)}` : "";
    }

    State.logs.unshift({
      nightNo: State.nightNo,
      dayNo: State.dayNo,
      publicText,
      hiddenText,
      ts: new Date().toISOString()
    });

    // 進白天
    save();
    showScreen("day");
    renderDay();

    // 跳公告
    openAnnouncementModal(true);
  }

  /* ---------------------------
     Announcement modal
  --------------------------- */
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
      box.textContent = State.godView ? (l.publicText + "\n\n" + (l.hiddenText || "")) : l.publicText;
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
  function closeAnnouncementModal(){ $("modalAnn")?.classList.add("hidden"); }

  /* ---------------------------
     Day（你要：點了要變色，清楚知道有沒有按到）
  --------------------------- */
  function renderDay(){
    $("dayTag") && ($("dayTag").textContent = `第 ${State.dayNo} 天`);

    const alive = State.players.filter(p => p.alive).map(p => p.seat);
    $("dayAlive") && ($("dayAlive").textContent = alive.length ? `存活：${alive.join("、")} 號` : "（全滅？）");

    renderSeats("daySeats", {
      selectedSeat: State.daySelected || null,
      disabledSeats: new Set(State.players.filter(p=>!p.alive).map(p=>p.seat)),
      onPick: (seat) => {
        State.daySelected = (State.daySelected === seat) ? null : seat; // 再點取消
        save();
        renderDay();
      }
    });
  }

  function nextDayToNight(){
    State.nightNo += 1;
    State.dayNo += 1;

    State.nightState = {};
    State.nightStepIndex = 0;

    // 女巫每晚重新選（但用藥是否已用過保留）
    State.witch.save = false;
    State.witch.poisonTarget = null;

    // 清預言家顯示
    State.nightState.seerResultText = null;

    resolveNightStepsForThisGame();
    save();
    showScreen("night");
    renderNight();
  }

  /* ---------------------------
     God toggle + restart
  --------------------------- */
  function setGod(flag){
    State.godView = !!flag;
    document.body.classList.toggle("god-on", State.godView);
    $("btnGodToggle") && ($("btnGodToggle").textContent = State.godView ? "🔓" : "🔒");
    $("btnGodToggle2") && ($("btnGodToggle2").textContent = State.godView ? "🔓 上帝視角" : "🔒 玩家視角");
    $("fabGod") && ($("fabGod").textContent = State.godView ? "🔓" : "🔒");
    save();
    renderAnnouncement();
    if (State.phase === "night") renderNight();
  }
  function toggleGod(){ setGod(!State.godView); }

  /* ---------------------------
     Role config modal（可捲動 + 可關閉）
  --------------------------- */
  function openRoleConfig(){
    const body = $("roleConfigBody");
    if (!body) return;

    body.innerHTML = "";
    const rolesMap = getRolesMap();
    const ids = Object.keys(rolesMap);

    const tip = document.createElement("div");
    tip.className = "hint";
    tip.style.marginBottom = "10px";
    tip.textContent = "點＋/－調整數量；角色總數需等於玩家人數才能開始。";
    body.appendChild(tip);

    const priority = ["werewolf","villager","seer","witch","hunter","guard","knight","blackWolfKing","whiteWolfKing"];
    const ordered = Array.from(new Set([...priority, ...ids]));

    if (!State.rolesCount) State.rolesCount = getSuggestedRolesCount(State.boardId, State.playerCount);

    ordered.forEach((rid) => {
      const info = getRole(rid);

      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
      row.style.padding = "10px 4px";
      row.style.borderBottom = "1px dashed rgba(0,0,0,.10)";

      const left = document.createElement("div");
      left.style.fontWeight = "900";
      left.textContent = `${info.icon ? info.icon + " " : ""}${info.name || rid}`;

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.alignItems = "center";
      right.style.gap = "10px";

      const minus = document.createElement("button");
      minus.type = "button";
      minus.className = "btn ghost";
      minus.style.padding = "8px 12px";
      minus.textContent = "－";

      const num = document.createElement("div");
      num.style.minWidth = "36px";
      num.style.textAlign = "center";
      num.style.fontWeight = "900";
      num.textContent = String(State.rolesCount?.[rid] ?? 0);

      const plus = document.createElement("button");
      plus.type = "button";
      plus.className = "btn ghost";
      plus.style.padding = "8px 12px";
      plus.textContent = "＋";

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

  function closeRoleConfig(){ $("modalRole")?.classList.add("hidden"); }

  /* ---------------------------
     Start game
  --------------------------- */
  function startGame(){
    if (!State.rolesCount) State.rolesCount = getSuggestedRolesCount(State.boardId, State.playerCount);
    if (rolesTotal(State.rolesCount) !== State.playerCount) {
      alert("⚠️ 角色總數必須等於玩家人數");
      return;
    }
    buildPlayersFromRolesCount();
    showScreen("deal");
    renderDeal();
  }

  /* ---------------------------
     Bind events
  --------------------------- */
  function bind(){
    // setup
    on($("boardBasic"), "click", () => setBoard("basic"));
    on($("boardB1"), "click", () => setBoard("b1"));
    on($("rangeCount"), "input", (e) => setPlayerCount(e.target.value));
    on($("btnRoleConfig"), "click", openRoleConfig);
    on($("btnStart"), "click", startGame);

    // role modal
    on($("btnRoleClose"), "click", closeRoleConfig);
    on($("modalRole"), "click", (e) => {
      if (e.target && e.target.id === "modalRole") closeRoleConfig();
    });

    // deal
    on($("btnDealNext"), "click", nextDeal);
    on($("btnBackSetup"), "click", () => { showScreen("setup"); syncSetupUI(); });
    on($("btnDealConfirmOpen"), "click", openDealConfirm);
    on($("btnDealConfirmNo"), "click", closeDealConfirm);
    on($("btnDealConfirmYes"), "click", () => {
      closeDealConfirm();
      resolveNightStepsForThisGame();
      showScreen("night");
      renderNight();
    });

    // night
    on($("btnNightPrev"), "click", nightPrev);
    on($("btnNightNext"), "click", nightNext);
    on($("btnGodToggle2"), "click", toggleGod);
    on($("btnAnnOpenNight"), "click", () => openAnnouncementModal(true));

    // day
    on($("btnToNight"), "click", nextDayToNight);
    on($("btnAnnOpenDay"), "click", () => openAnnouncementModal(true));

    // top + fab
    on($("btnGodToggle"), "click", toggleGod);
    on($("fabGod"), "click", toggleGod);
    on($("btnAnnOpenTop"), "click", () => openAnnouncementModal(true));
    on($("fabAnn"), "click", () => openAnnouncementModal(true));

    // announcement modal
    on($("btnAnnClose"), "click", closeAnnouncementModal);
    on($("modalAnn"), "click", (e) => {
      if (e.target && e.target.id === "modalAnn") closeAnnouncementModal();
    });
    on($("annToday"), "click", () => { annMode="today"; renderAnnouncement(); $("annToday")?.classList.add("active"); $("annHistory")?.classList.remove("active"); });
    on($("annHistory"), "click", () => { annMode="history"; renderAnnouncement(); $("annHistory")?.classList.add("active"); $("annToday")?.classList.remove("active"); });

    on($("btnCopy"), "click", async () => {
      try {
        await navigator.clipboard.writeText($("annBox")?.textContent || "");
        navigator.vibrate?.(30);
      } catch(e){
        alert("複製失敗（iOS 可能需要手動長按複製）");
      }
    });

    on($("btnExport"), "click", () => {
      const payload = {
        version: "1.0",
        boardId: State.boardId,
        playerCount: State.playerCount,
        players: State.players,
        logs: State.logs
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `ww_export_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    });

    // restart
    on($("btnRestart"), "click", () => {
      if (!confirm("確定要重新開始？所有進度會清除並回到開局設定。")) return;
      clearSave();
      location.reload();
    });
  }

  /* ---------------------------
     Boot
  --------------------------- */
  function boot(){
    load();

    // UI 初始值
    if (!$("rangeCount")?.value) {}
    $("rangeCount") && ($("rangeCount").value = String(State.playerCount));

    if (!State.rolesCount) State.rolesCount = getSuggestedRolesCount(State.boardId, State.playerCount);

    $("boardBasic")?.classList.toggle("active", State.boardId === "basic");
    $("boardB1")?.classList.toggle("active", State.boardId === "b1");

    setGod(State.godView);

    syncSetupUI();
    bind();

    // 依 phase 回復畫面
    showScreen(State.phase || "setup");
    if (State.phase === "deal") renderDeal();
    if (State.phase === "night") renderNight();
    if (State.phase === "day") renderDay();
  }

  boot();
})();