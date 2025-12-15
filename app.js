/* =========================================================
   狼人殺｜上帝輔助 PWA（ID 對齊你貼的 index.html）
   app.js（可直接覆蓋）
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
      document.body.style.touchAction = "manipulation";
    }
  } catch (e) {}
  on(document, "contextmenu", (e) => e.preventDefault(), { passive: false });
  on(document, "selectstart", (e) => e.preventDefault(), { passive: false });
  on(document, "gesturestart", (e) => e.preventDefault(), { passive: false });
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
  const STORAGE_KEY = "ww_save_v4_idmatch";
  const State = {
    phase: "setup",           // setup | deal | night | day
    boardId: "basic",         // basic | b1
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

    // 女巫（永久消耗）
    witch: { saveUsed:false, poisonUsed:false, save:false, poisonTarget:null },

    // 白天投票（你說現在流程正常，我這裡只保底＋變色）
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

  /* ---------------------------
     WW_DATA（保底）
  --------------------------- */
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
      basic:{ id:"basic", name:"基本板子" },
      b1:{ id:"b1", name:"特殊板子 B1" },
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

    const rolesAll = mergeMaps(
      W.WW_ROLES || null,
      W.WW_ROLES_BASE || null,
      W.WW_ROLES_B1 || null,
      W.WW_DATA?.roles || null
    );
    const roles = Object.keys(rolesAll).length ? rolesAll : WW_FALLBACK.roles;

    const boardsAll = mergeMaps(
      W.WW_BOARDS || null,
      W.WW_DATA?.boards || null,
      W.BOARDS || null
    );
    const boards = Object.keys(boardsAll).length ? boardsAll : WW_FALLBACK.boards;

    const rulesBasic =
      W.WW_RULES_BASIC || W.WW_RULES?.basic || W.WW_DATA?.rules?.basic || W.RULES_BASIC || null;
    const rulesB1 =
      W.WW_RULES_B1 || W.WW_RULES?.b1 || W.WW_DATA?.rules?.b1 || W.RULES_B1 || null;

    const nightBasic =
      W.WW_NIGHT_STEPS_BASIC || W.WW_DATA?.nightSteps?.basic || W.NIGHT_STEPS_BASIC || null;
    const nightB1 =
      W.WW_NIGHT_STEPS_B1 || W.WW_DATA?.nightSteps?.b1 || W.NIGHT_STEPS_B1 || null;

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

  /* ---------------------------
     Setup：建議配置
  --------------------------- */
  function rolesTotal(map){
    return Object.values(map || {}).reduce((a,b)=> a + (Number(b)||0), 0);
  }

  function suggestBasicConfigByCount(n){
    const wolves = n >= 10 ? 3 : (n >= 8 ? 2 : 2);
    const fixed = 3; // 預女獵
    const villager = Math.max(0, n - wolves - fixed);
    return { werewolf:wolves, villager, seer:1, witch:1, hunter:1 };
  }

  function suggestB1ConfigByCount(n){
    const base = { villager:0, werewolf:0, seer:1, witch:1, hunter:1, guard:1, knight:1, blackWolfKing:1, whiteWolfKing:1 };
    const wolves = n >= 11 ? 3 : 2;
    base.werewolf = Math.max(0, wolves - 2);
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
    $("playerCount") && ($("playerCount").textContent = String(State.playerCount));
    $("playerTotal") && ($("playerTotal").textContent = String(State.playerCount));

    const total = rolesTotal(State.rolesCount);
    $("roleTotal") && ($("roleTotal").textContent = String(total));

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
    $("rangeCount") && ($("rangeCount").value = String(v));
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
    State.witch = { saveUsed:false, poisonUsed:false, save:false, poisonTarget:null };
    State.dayVote = { target:null };
    save();
  }

  /* =========================================================
     Deal（對齊你的 index.html）
     - btnNextPlayer
     - btnFinishDeal + modalDealConfirm / dealConfirmYes / dealConfirmNo
     - dealSeatGrid 點座位回去翻牌
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
  }

  function nextDealPlayer(){
    State.dealIndex = Math.min(State.players.length - 1, State.dealIndex + 1);
    save(); renderDeal();
  }

  function openDealConfirm(){ $("modalDealConfirm")?.classList.remove("hidden"); }
  function closeDealConfirm(){ $("modalDealConfirm")?.classList.add("hidden"); }

  /* =========================================================
     Night steps（女巫不跳視窗）
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
        publicScript:"預言家請睜眼，查驗一位玩家。", godScript:"預言家查誰？（點座位後會顯示結果）"
      });
    }

    if (hasRole("witch")) {
      steps.push({ key:"witch", type:"witch",
        publicScript:"女巫請睜眼（上帝操作）。", godScript:"女巫：點刀口=救、點其他=毒、下一步=不使用"
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
    return true;
  }

  function renderNight(){
    $("nightTag") && ($("nightTag").textContent = `第 ${State.nightNo} 夜`);

    if (!State.nightSteps || !State.nightSteps.length) resolveNightStepsForThisGame();
    const step = getCurrentNightStep();
    if (!step) {
      $("nightScript") && ($("nightScript").textContent = "（夜晚流程結束）");
      return;
    }

    const tips = [];

    // 女巫提示（不跳視窗）
    if (step.type === "witch") {
      const knifeSeat = State.nightState.wolfTarget || null;

      if (State.witch.saveUsed) tips.push("🧪 解藥：已用過（本局不再顯示刀口）");
      else tips.push(`🧪 解藥：${knifeSeat ? `刀口 ${knifeSeat} 號（點他=救）` : "狼人尚未選刀"}`);

      tips.push(`☠️ 毒藥：${State.witch.poisonUsed ? "已用過（毒藥沒了）" : "可用（點其他人=毒）"}`);
      if (State.witch.save && knifeSeat) tips.push(`已選救：${knifeSeat} 號`);
      if (State.witch.poisonTarget) tips.push(`已選毒：${State.witch.poisonTarget} 號`);
    }

    // 預言家：顯示查驗結果在提示
    if (step.type === "seer" && State.nightState.seerCheck) {
      const seat = State.nightState.seerCheck;
      const p = State.players.find(x=>x.seat===seat);
      if (p) {
        const role = getRole(p.roleId);
        tips.push(`🔮 查驗 ${seat} 號 → ${role.icon} ${role.name}（${role.team==="wolf"?"狼人陣營":"好人陣營"}）`);
      }
    }

    const base = scriptForStep(step);
    $("nightScript") && ($("nightScript").textContent = tips.length ? (base + "\n" + tips.join("\n")) : base);

    const sel = selectedSeatForStep(step);
    renderSeats("nightSeats", (seat) => {
      const cur = getCurrentNightStep();
      if (!cur) return;

      if (cur.type === "pick" && cur.pickKey) {
        if (cur.pickKey === "wolfTarget" && State.settings.wolfCanNoKill) {
          State.nightState[cur.pickKey] = (State.nightState[cur.pickKey] === seat) ? null : seat;
        } else {
          State.nightState[cur.pickKey] = seat;
        }
        save(); renderNight(); return;
      }

      if (cur.type === "seer" && cur.pickKey) {
        State.nightState[cur.pickKey] = seat;
        save(); renderNight(); return;
      }

      if (cur.type === "witch") {
        const knifeSeat = State.nightState.wolfTarget || null;

        // 點刀口=救（解藥未用才有效）
        if (!State.witch.saveUsed && knifeSeat && seat === knifeSeat) {
          State.witch.save = true;
          save(); renderNight(); return;
        }

        // 點其他=毒（毒藥未用才有效）
        if (!State.witch.poisonUsed) {
          State.witch.poisonTarget = seat;
          save(); renderNight(); return;
        }

        navigator.vibrate?.(30);
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

    if (!canGoNextNightStep(step)) { navigator.vibrate?.([60,40,60]); return; }

    if (step.type === "resolve") { resolveNight(); return; }

    State.nightStepIndex = Math.min(State.nightSteps.length - 1, State.nightStepIndex + 1);
    save(); renderNight();
  }

  /* ---------------------------
     Resolve（保底不炸）
  --------------------------- */
  function builtInResolveNight(){
    const knife = State.nightState.wolfTarget || null;
    const guard = State.nightState.guardTarget || null;

    const killed = new Set();
    if (knife) killed.add(knife);

    if (knife && guard && knife === guard) killed.delete(knife);
    if (State.witch.save && knife && !State.witch.saveUsed) killed.delete(knife);
    if (State.witch.poisonTarget && !State.witch.poisonUsed) killed.add(State.witch.poisonTarget);

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

  function resolveNight(){
    const bundle = getBoardBundle(State.boardId);
    const rules = bundle?.rules || null;

    State.nightState.witchSave = !!State.witch.save;
    State.nightState.witchPoisonTarget = State.witch.poisonTarget || null;
    State.nightState.witchSaveUsed = !!State.witch.saveUsed;
    State.nightState.witchPoisonUsed = !!State.witch.poisonUsed;

    let publicText = "";
    let hiddenText = "";
    let resolved = null;

    if (rules?.resolveNight && rules?.buildAnnouncement) {
      try {
        resolved = rules.resolveNight({ players: State.players, night: State.nightState, settings: State.settings });
        const ann = rules.buildAnnouncement({ nightNo: State.nightNo, dayNo: State.dayNo, players: State.players, night: State.nightState, resolved, settings: State.settings });
        publicText = ann?.publicText || "天亮了。（公告產生失敗，已保底）";
        hiddenText = ann?.hiddenText || "";
      } catch (e) {
        warn("rules error:", e);
        resolved = builtInResolveNight();
        const ann = builtInAnnouncement(resolved);
        publicText = ann.publicText;
        hiddenText = State.godView ? String(e) : "";
      }
    } else {
      resolved = builtInResolveNight();
      const ann = builtInAnnouncement(resolved);
      publicText = ann.publicText;
      hiddenText = "";
    }

    if (State.witch.save && !State.witch.saveUsed) State.witch.saveUsed = true;
    if (State.witch.poisonTarget && !State.witch.poisonUsed) State.witch.poisonUsed = true;

    State.logs.unshift({ nightNo: State.nightNo, dayNo: State.dayNo, publicText, hiddenText, ts: new Date().toISOString() });
    save();

    showScreen("day");
    renderDay();
    openAnnouncementModal(true);
  }

  /* ---------------------------
     Announcement（對齊你的 modalAnn / closeAnn / annToday / annHistory）
  --------------------------- */
  let annMode = "today";

  function renderAnnouncement(){
    const box = $("annBox");
    if (!box) return;

    if (!State.logs.length) { box.textContent = "（尚無公告）"; return; }

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

  /* ---------------------------
     Day（對齊你 screen-day；如果你沒有 daySeats 就不渲染）
  --------------------------- */
  function renderDay(){
    $("dayTag") && ($("dayTag").textContent = `第 ${State.dayNo} 天`);

    const alive = State.players.filter(p=>p.alive).map(p=>p.seat);
    $("dayAlive") && ($("dayAlive").textContent = alive.length ? `存活：${alive.join("、")} 號` : "（全滅？）");

    // 投票座位（若你 index 有 daySeats 就會用）
    renderDaySeats();
  }

  function renderDaySeats(){
    const box = $("daySeats");
    if (!box) return;
    box.innerHTML = "";

    State.players.forEach(p=>{
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seat" + (p.alive ? "" : " dead") + (State.dayVote.target === p.seat ? " selected" : "");
      b.textContent = String(p.seat);
      stopTextSelectOnTouch(b);
      b.onclick = () => {
        if (!p.alive) return;
        State.dayVote.target = (State.dayVote.target === p.seat) ? null : p.seat;
        save();
        renderDaySeats();
      };
      box.appendChild(b);
    });
  }

  function nextDayToNight(){
    State.nightNo += 1;
    State.dayNo += 1;

    State.nightState = {};
    State.nightStepIndex = 0;

    State.witch.save = false;
    State.witch.poisonTarget = null;

    State.dayVote = { target:null };

    resolveNightStepsForThisGame();
    save();
    showScreen("night");
    renderNight();
  }

  /* ---------------------------
     God toggle + restart
  --------------------------- */
  function setGod(onFlag){
    State.godView = !!onFlag;
    document.body.classList.toggle("god-on", State.godView);
    $("btnGodToggle") && ($("btnGodToggle").textContent = State.godView ? "🔓" : "🔒");
    $("fabGod") && ($("fabGod").textContent = State.godView ? "🔓" : "🔒");
    save();
    renderAnnouncement();
    if (State.phase === "night") renderNight();
  }
  function toggleGod(){ setGod(!State.godView); }

  function ensureRestartButton(){
    // 你 topbar 會自動插入 btnRestart 的版本，這裡保底：若不存在就自己加
    if ($("btnRestart")) {
      $("btnRestart").onclick = () => {
        if (!confirm("確定要重新開始？所有進度會清除並回到開局設定。")) return;
        clearSave(); location.reload();
      };
      return;
    }
    const host = document.querySelector(".top-actions");
    if (!host) return;
    const b = document.createElement("button");
    b.id = "btnRestart";
    b.className = "iconbtn";
    b.type = "button";
    b.title = "重新開始";
    b.textContent = "🔁";
    b.onclick = () => {
      if (!confirm("確定要重新開始？所有進度會清除並回到開局設定。")) return;
      clearSave(); location.reload();
    };
    host.insertBefore(b, host.firstChild);
  }

  /* ---------------------------
     Start game
  --------------------------- */
  function startGame(){
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
    State.nightState = {};
    State.nightStepIndex = 0;
    State.witch.save = false;
    State.witch.poisonTarget = null;
    resolveNightStepsForThisGame();
    save();
    showScreen("night");
    renderNight();
  }

  /* ---------------------------
     Role config modal：你目前 modalRole / closeRole / roleConfigBody / roleApply / roleReset
     這裡先做「能捲動＋能關閉＋能套用」的最小可用版本
  --------------------------- */
  function openRoleConfig(){
    const body = $("roleConfigBody");
    if (!body) return;

    body.innerHTML = "";
    const rolesMap = getRolesMap();
    const ids = Object.keys(rolesMap);

    const tip = document.createElement("div");
    tip.className = "hint";
    tip.style.marginBottom = "8px";
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
      left.textContent = `${info.icon ? info.icon+" " : ""}${info.name || rid}`;

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.alignItems = "center";
      right.style.gap = "10px";

      const minus = document.createElement("button");
      minus.type = "button";
      minus.className = "btn ghost tiny";
      minus.textContent = "－";

      const num = document.createElement("div");
      num.style.minWidth = "36px";
      num.style.textAlign = "center";
      num.style.fontWeight = "900";
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

  function resetRoleConfig(){
    State.rolesCount = getSuggestedRolesCount(State.boardId, State.playerCount);
    syncSetupUI();
    openRoleConfig(); // 重新渲染
  }

  /* ---------------------------
     Bind events：對齊你 index.html
  --------------------------- */
  function bind(){
    // Setup
    on($("boardBasic"), "click", () => setBoard("basic"));
    on($("boardSpecial"), "click", () => setBoard("b1"));

    // 人數＋－（你 index 有 btnMinus/btnPlus/rangeCount）
    on($("btnMinus"), "click", () => setPlayerCount(State.playerCount - 1));
    on($("btnPlus"), "click", () => setPlayerCount(State.playerCount + 1));
    on($("rangeCount"), "input", (e) => setPlayerCount(e.target.value));

    // 角色
    on($("btnOpenRoleConfig"), "click", openRoleConfig);
    on($("closeRole"), "click", closeRoleConfig);
    on($("roleReset"), "click", resetRoleConfig);
    on($("roleApply"), "click", () => { closeRoleConfig(); syncSetupUI(); });

    // 建議配置
    on($("btnSuggest"), "click", () => {
      State.rolesCount = getSuggestedRolesCount(State.boardId, State.playerCount);
      syncSetupUI();
    });

    // Start
    on($("btnStart"), "click", startGame);

    // Deal
    on($("btnNextPlayer"), "click", nextDealPlayer);
    on($("btnDealBack"), "click", () => { showScreen("setup"); syncSetupUI(); });

    on($("btnFinishDeal"), "click", openDealConfirm);
    on($("dealConfirmNo"), "click", closeDealConfirm);
    on($("dealConfirmYes"), "click", () => { closeDealConfirm(); startNight(); });

    // Night
    on($("btnNightPrev"), "click", nightPrev);
    on($("btnNightNext"), "click", nightNext);

    // Day
    on($("btnDayNext"), "click", nextDayToNight);

    // God + Ann（你的 index 有 btnOpenAnnouncement / closeAnn / annToday / annHistory）
    on($("btnGodToggle"), "click", toggleGod);
    on($("fabGod"), "click", toggleGod);

    on($("btnOpenAnnouncement"), "click", () => openAnnouncementModal(true));
    on($("btnOpenAnnouncement2"), "click", () => openAnnouncementModal(true));
    on($("btnOpenAnnouncement3"), "click", () => openAnnouncementModal(true));
    on($("closeAnn"), "click", () => $("modalAnn")?.classList.add("hidden"));

    on($("annToday"), "click", () => { annMode="today"; openAnnouncementModal(false); });
    on($("annHistory"), "click", () => { annMode="history"; openAnnouncementModal(false); });

    // Copy / Export（有就綁，沒有就跳過）
    on($("btnCopyAnn"), "click", async () => {
      try {
        await navigator.clipboard.writeText($("annBox")?.textContent || "");
        navigator.vibrate?.(30);
      } catch(e){}
    });
    on($("btnExport"), "click", () => {
      const data = JSON.stringify({ logs: State.logs, players: State.players, settings: State.settings }, null, 2);
      const blob = new Blob([data], { type:"application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ww-export.json";
      a.click();
      setTimeout(()=>URL.revokeObjectURL(url), 500);
    });

    ensureRestartButton();
  }

  /* ---------------------------
     Init
  --------------------------- */
  async function init(){
    load();
    ensureWWData();

    if (!State.rolesCount) State.rolesCount = getSuggestedRolesCount(State.boardId, State.playerCount);

    bind();
    setGod(State.godView);

    showScreen(State.phase || "setup");

    if (State.phase === "setup") syncSetupUI();
    if (State.phase === "deal") renderDeal();
    if (State.phase === "night") { resolveNightStepsForThisGame(); renderNight(); }
    if (State.phase === "day") renderDay();

    ["btnStart","btnNextPlayer","btnFinishDeal","btnNightPrev","btnNightNext","btnDayNext"]
      .forEach(id => stopTextSelectOnTouch($(id)));
  }

  init().catch(err => {
    warn("init failed:", err);
    ensureWWData();
    showScreen("setup");
    syncSetupUI();
  });
})();