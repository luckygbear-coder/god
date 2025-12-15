/* =========================================================
   狼人殺｜上帝輔助 PWA
   app.js（不依賴 ww.data.js 的穩定版）
========================================================= */

(function () {
  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);

  // iOS 防長按選字/選單
  try {
    document.documentElement.style.webkitUserSelect = "none";
    document.documentElement.style.userSelect = "none";
    document.documentElement.style.webkitTouchCallout = "none";
  } catch (e) {}
  on(document, "contextmenu", (e) => e.preventDefault(), { passive: false });
  on(document, "selectstart", (e) => e.preventDefault(), { passive: false });
  on(document, "gesturestart", (e) => e.preventDefault(), { passive: false });

  function stopTouchDefault(el) {
    if (!el) return;
    el.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
  }

  /* ---------------------------
     Storage
  --------------------------- */
  const STORAGE_KEY = "ww_save_v2_nohub";
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

    witch: { saveUsed:false, poisonUsed:false, save:false, poisonTarget:null },
    settings: {
      wolfCanNoKill: true,
      witchCannotSelfSave: true,
      noConsecutiveGuard: true,
    }
  };

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(State)); } catch(e){}
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s && typeof s === "object") Object.assign(State, s);
    } catch(e){}
  }
  function clearSave() {
    try { localStorage.removeItem(STORAGE_KEY); } catch(e){}
  }

  /* ---------------------------
     Data access (直接吃 window.WW_... 變數)
  --------------------------- */
  function mergeMaps(a, b) {
    const out = {};
    if (a && typeof a === "object") Object.assign(out, a);
    if (b && typeof b === "object") Object.assign(out, b);
    return out;
  }

  function getRolesMap() {
    // 你的 roles.base.js / roles.b1.js 應該會掛：
    // window.WW_ROLES_BASE / window.WW_ROLES_B1
    const roles = mergeMaps(window.WW_ROLES_BASE, window.WW_ROLES_B1);

    // fallback：至少讓 UI 跑
    const fallback = {
      werewolf: { id:"werewolf", name:"狼人", icon:"🐺", team:"wolf" },
      villager:{ id:"villager", name:"村民", icon:"🧑", team:"villager" },
      seer:    { id:"seer", name:"預言家", icon:"🔮", team:"villager" },
      witch:   { id:"witch", name:"女巫", icon:"🧪", team:"villager" },
      hunter:  { id:"hunter", name:"獵人", icon:"🏹", team:"villager" },
      guard:   { id:"guard", name:"守衛", icon:"🛡️", team:"villager" },
      knight:  { id:"knight", name:"騎士", icon:"⚔️", team:"villager" },
      blackWolfKing:{ id:"blackWolfKing", name:"黑狼王", icon:"🐺👑", team:"wolf" },
      whiteWolfKing:{ id:"whiteWolfKing", name:"白狼王", icon:"🐺🤍", team:"wolf" },
    };

    const merged = mergeMaps(fallback, roles);
    return merged;
  }

  function getRole(roleId) {
    const roles = getRolesMap();
    return roles[roleId] || { id:roleId, name:roleId, icon:"❔", team:"villager" };
  }

  function getBoardsMap() {
    // boards.config.js 應該會掛 window.WW_BOARDS
    const b = window.WW_BOARDS;
    if (b && typeof b === "object") return b;

    // fallback
    return {
      basic: { id:"basic", name:"基本板子" },
      b1: { id:"b1", name:"特殊板子 B1" }
    };
  }

  function getRules(boardId) {
    // rules.basic.js / rules.b1.js 期待掛：
    // window.WW_RULES_BASIC / window.WW_RULES_B1
    if (boardId === "b1") return window.WW_RULES_B1 || null;
    return window.WW_RULES_BASIC || null;
  }

  function getNightSteps(boardId) {
    // night.steps.basic.js / night.steps.b1.js 期待掛：
    // window.WW_NIGHT_STEPS_BASIC / window.WW_NIGHT_STEPS_B1
    if (boardId === "b1") return window.WW_NIGHT_STEPS_B1 || null;
    return window.WW_NIGHT_STEPS_BASIC || null;
  }

  /* ---------------------------
     Screens
  --------------------------- */
  function showScreen(name) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    $(`screen-${name}`)?.classList.add("active");
    State.phase = name;
    save();
  }

  /* ---------------------------
     Setup: 建議配置
  --------------------------- */
  function suggestBasic(n) {
    const wolves = n >= 10 ? 3 : 2;
    const fixed = 3; // 預女獵
    const villager = Math.max(0, n - wolves - fixed);
    return { werewolf:wolves, villager, seer:1, witch:1, hunter:1 };
  }
  function suggestB1(n) {
    const base = { seer:1, witch:1, hunter:1, guard:1, knight:1, blackWolfKing:1, whiteWolfKing:1, werewolf:0, villager:0 };
    const wolves = n >= 11 ? 3 : 2;
    base.werewolf = Math.max(0, wolves - 2);
    const fixed = Object.values(base).reduce((a,b)=>a+b,0);
    base.villager = Math.max(0, n - fixed);
    return base;
  }

  function rolesTotal(map) {
    return Object.values(map || {}).reduce((a,b)=>a+(Number(b)||0),0);
  }

  function applySuggested() {
    State.rolesCount = (State.boardId === "b1") ? suggestB1(State.playerCount) : suggestBasic(State.playerCount);
    syncSetupUI();
  }

  function syncSetupUI() {
    $("playerCount") && ($("playerCount").textContent = String(State.playerCount));
    $("playerTotal") && ($("playerTotal").textContent = String(State.playerCount));

    if (!State.rolesCount) applySuggested();

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

  function setBoard(boardId) {
    State.boardId = (boardId === "b1") ? "b1" : "basic";
    $("boardBasic")?.classList.toggle("active", State.boardId === "basic");
    $("boardSpecial")?.classList.toggle("active", State.boardId === "b1");
    applySuggested();
  }

  function setPlayerCount(n) {
    const v = Math.max(6, Math.min(12, Number(n) || 9));
    State.playerCount = v;
    const range = $("rangeCount");
    if (range) range.value = String(v);
    applySuggested();
  }

  /* ---------------------------
     Players build + shuffle
  --------------------------- */
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function buildPlayers() {
    const rolesArr = [];
    for (const [rid, cnt] of Object.entries(State.rolesCount || {})) {
      for (let i = 0; i < (Number(cnt)||0); i++) rolesArr.push(rid);
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
        alive: true,
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
    save();
  }

  /* ---------------------------
     Deal
  --------------------------- */
  let _dealHoldTimer = null;

  function renderDealSeatGrid() {
    const grid = $("dealSeatGrid");
    if (!grid) return;
    grid.innerHTML = "";
    State.players.forEach((p, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seat" + (idx === State.dealIndex ? " selected" : "");
      b.textContent = String(p.seat);
      stopTouchDefault(b);
      b.onclick = () => {
        State.dealIndex = idx;
        save();
        renderDeal();
      };
      grid.appendChild(b);
    });
  }

  function showRevealForCurrent() {
    const p = State.players[State.dealIndex];
    if (!p) return;
    $("revealRole") && ($("revealRole").textContent = `${p.icon} ${p.name}`);
    $("modalReveal")?.classList.remove("hidden");
    navigator.vibrate?.(60);
  }
  function hideReveal() { $("modalReveal")?.classList.add("hidden"); }

  function renderDeal() {
    const p = State.players[State.dealIndex];
    if (!p) return;

    $("dealText") && ($("dealText").innerHTML = `請 <b>${p.seat} 號</b> 拿手機`);
    renderDealSeatGrid();

    const btn = $("btnHoldReveal");
    if (!btn) return;

    stopTouchDefault(btn);

    btn.onpointerdown = (e) => {
      e.preventDefault?.();
      clearTimeout(_dealHoldTimer);
      _dealHoldTimer = setTimeout(showRevealForCurrent, 900);
    };
    const end = (e) => {
      e && e.preventDefault?.();
      clearTimeout(_dealHoldTimer);
      hideReveal();
    };
    btn.onpointerup = end;
    btn.onpointercancel = end;
    btn.onpointerleave = end;
  }

  function nextDeal() {
    State.dealIndex++;
    if (State.dealIndex >= State.players.length) {
      State.dealIndex = State.players.length - 1;
      renderDeal();
      navigator.vibrate?.([60,40,60]);
      return;
    }
    save();
    renderDeal();
  }

  /* ---------------------------
     Night steps (優先用 data/night，沒有就 fallback)
  --------------------------- */
  function hasRole(roleId) {
    return State.players.some(p => p.roleId === roleId);
  }

  function fallbackNightSteps() {
    const steps = [];
    steps.push({ type:"info", publicScript:"天黑請閉眼。", godScript:"天黑請閉眼。" });

    if (hasRole("guard")) {
      steps.push({ type:"pick", pickKey:"guardTarget", required:true, publicScript:"守衛請睜眼，請守一位玩家。", godScript:"守衛守誰？（點座位）" });
    }

    steps.push({
      type:"pick",
      pickKey:"wolfTarget",
      required: !State.settings.wolfCanNoKill,
      allowNull: !!State.settings.wolfCanNoKill,
      publicScript: State.settings.wolfCanNoKill ? "狼人請睜眼（可空刀），請選擇目標。" : "狼人請睜眼，請選擇目標。",
      godScript: State.settings.wolfCanNoKill ? "狼人刀誰？（可不選=空刀）" : "狼人刀誰？（必選）",
    });

    if (hasRole("seer")) {
      steps.push({ type:"pick", pickKey:"seerCheck", required:true, publicScript:"預言家請睜眼，請查驗一位玩家。", godScript:"預言家查誰？（點座位）" });
    }

    if (hasRole("witch")) {
      steps.push({ type:"witch", publicScript:"女巫請睜眼（上帝操作）。", godScript:"女巫回合：請操作救/毒。" });
    }

    steps.push({ type:"resolve", publicScript:"天亮請睜眼。", godScript:"天亮：結算夜晚並公告。" });
    return steps;
  }

  function resolveNightSteps() {
    let steps = getNightSteps(State.boardId);

    if (typeof steps === "function") {
      try { steps = steps(State.players, State.nightState); } catch(e){ steps = null; }
    }

    if (!Array.isArray(steps) || steps.length === 0) {
      steps = fallbackNightSteps();
    }

    State.nightSteps = steps;
    State.nightStepIndex = 0;
    save();
  }

  function getCurrentNightStep() {
    return State.nightSteps?.[State.nightStepIndex] || null;
  }

  function renderSeats(containerId, onPick, selectedSeat = null) {
    const box = $(containerId);
    if (!box) return;
    box.innerHTML = "";

    State.players.forEach(p => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seat" + (p.alive ? "" : " dead") + (selectedSeat === p.seat ? " selected":"");
      b.textContent = String(p.seat);
      b.disabled = !p.alive;
      stopTouchDefault(b);
      b.onclick = () => p.alive && onPick?.(p.seat);
      box.appendChild(b);
    });
  }

  function renderNight() {
    $("nightTag") && ($("nightTag").textContent = `第 ${State.nightNo} 夜`);
    $("dayTag") && ($("dayTag").textContent = `第 ${State.dayNo} 天`);

    if (!State.nightSteps || State.nightSteps.length === 0) resolveNightSteps();

    const step = getCurrentNightStep();
    if (!step) {
      $("nightScript") && ($("nightScript").textContent = "（夜晚流程結束）");
      return;
    }

    const script = State.godView
      ? (step.godScript || step.publicScript)
      : (step.publicScript || step.godScript);

    $("nightScript") && ($("nightScript").textContent = script || "（無台詞）");

    renderSeats("nightSeats", (seat) => {
      // 女巫毒目標選擇模式
      if (State._pickPoisonMode) {
        State.witch.poisonTarget = seat;
        State._pickPoisonMode = false;
        save();
        renderWitchModal();
        renderNight();
        return;
      }

      // 一般 pick
      if (step.type === "pick" && step.pickKey) {
        State.nightState[step.pickKey] = seat;
        save();
        renderNight();
      }
    });
  }

  function canNext(step) {
    if (!step) return false;
    if (step.type === "pick" && step.required && step.pickKey) {
      if (step.allowNull) return true;
      return !!State.nightState[step.pickKey];
    }
    return true;
  }

  /* ---------------------------
     Witch
  --------------------------- */
  function openWitch() {
    $("modalWitch")?.classList.remove("hidden");
    renderWitchModal();
  }
  function closeWitch() {
    $("modalWitch")?.classList.add("hidden");
    State._pickPoisonMode = false;
  }

  function renderWitchModal() {
    const knifeSeat = State.nightState.wolfTarget || null;
    const knifeEl = $("witchKnife");
    const statusEl = $("witchStatus");

    const saveUsed = !!State.witch.saveUsed;
    const poisonUsed = !!State.witch.poisonUsed;
    const showKnife = !saveUsed;

    if (knifeEl) {
      knifeEl.innerHTML = showKnife ? (knifeSeat ? `${knifeSeat} 號` : "（狼人尚未選刀）") : "（解藥已用過，不提供刀口）";
    }

    if (statusEl) {
      const parts = [];
      parts.push(`解藥：${saveUsed ? "已用過" : "可用"}`);
      parts.push(`毒藥：${poisonUsed ? "已用過" : "可用"}`);
      if (State.witch.poisonTarget) parts.push(`已選毒：${State.witch.poisonTarget} 號`);
      statusEl.textContent = parts.join("｜");
    }

    const btnSave = $("btnWitchSave");
    const btnNoSave = $("btnWitchNoSave");
    const btnPickPoison = $("btnWitchPoisonPick");

    if (btnSave) {
      btnSave.disabled = saveUsed || !showKnife || !knifeSeat;
      btnSave.textContent = State.witch.save ? "✅ 已選擇用解藥" : "用解藥救";
    }
    if (btnNoSave) btnNoSave.disabled = !showKnife;
    if (btnPickPoison) {
      btnPickPoison.disabled = poisonUsed;
      btnPickPoison.textContent = State.witch.poisonTarget ? `☠️ 已毒 ${State.witch.poisonTarget} 號（改選）` : "用毒藥（回座位圈點人）";
    }
  }

  /* ---------------------------
     Resolve night (優先用 rules 檔案，沒有就簡化公告)
  --------------------------- */
  function openAnn(forceToday=false){ window.WW_APP?.openAnnouncement?.(forceToday); }

  function resolveNight() {
    const rules = getRules(State.boardId);

    // 寫回女巫狀態
    State.nightState.witchSave = !!State.witch.save;
    State.nightState.witchPoisonTarget = State.witch.poisonTarget || null;
    State.nightState.witchSaveUsed = !!State.witch.saveUsed;
    State.nightState.witchPoisonUsed = !!State.witch.poisonUsed;

    let publicText = "";
    let hiddenText = "";

    if (rules?.resolveNight && rules?.buildAnnouncement) {
      try {
        const resolved = rules.resolveNight({
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

        publicText = ann?.publicText || "（公告產生失敗）";
        hiddenText = ann?.hiddenText || "";
      } catch (e) {
        console.warn("rules error:", e);
        publicText = "（規則結算失敗，已用簡化公告）";
        hiddenText = State.godView ? String(e) : "";
      }
    } else {
      // fallback：不結算死亡，流程先跑起來
      publicText = "天亮了。（尚未接上完整 rules，暫不結算死亡）";
      hiddenText = State.godView ? `nightState=${JSON.stringify(State.nightState)}` : "";
    }

    if (State.witch.save) State.witch.saveUsed = true;
    if (State.witch.poisonTarget) State.witch.poisonUsed = true;

    State.logs.unshift({
      nightNo: State.nightNo,
      dayNo: State.dayNo,
      publicText,
      hiddenText,
      ts: new Date().toISOString()
    });

    save();

    showScreen("day");
    renderDayAlive();
    openAnn(true);
  }

  /* ---------------------------
     Day
  --------------------------- */
  function renderDayAlive() {
    const el = $("dayAlive");
    if (!el) return;
    const alive = State.players.filter(p => p.alive).map(p => p.seat);
    el.textContent = alive.length ? `存活：${alive.join("、")} 號` : "（全滅？）";
  }

  function nextDayToNight() {
    State.nightNo += 1;
    State.dayNo += 1;

    State.nightState = {};
    State.nightStepIndex = 0;
    State._pickPoisonMode = false;

    State.witch.save = false;
    State.witch.poisonTarget = null;

    resolveNightSteps();
    save();

    showScreen("night");
    renderNight();
  }

  /* ---------------------------
     God lock
  --------------------------- */
  const DEFAULT_PIN = "0000";
  function setGod(onFlag) {
    State.godView = !!onFlag;
    document.body.classList.toggle("god-on", State.godView);
    $("btnGodToggle") && ($("btnGodToggle").textContent = State.godView ? "🔓" : "🔒");
    $("fabGod") && ($("fabGod").textContent = State.godView ? "🔓" : "🔒");
    save();
    renderNight();
    window.WW_APP?.renderAnnouncement?.();
  }

  function openGodModal() {
    $("pinWarn")?.classList.add("hidden");
    $("pinInput") && ($("pinInput").value = "");
    $("modalGod")?.classList.remove("hidden");
    setTimeout(()=> $("pinInput")?.focus(), 60);
  }

  function closeGodModal() {
    $("modalGod")?.classList.add("hidden");
  }

  function toggleGod() {
    if (State.godView) {
      setGod(false);
      return;
    }
    openGodModal();
  }

  /* ---------------------------
     Role config modal
  --------------------------- */
  function openRoleConfig() {
    const body = $("roleConfigBody");
    if (!body) return;

    if (!State.rolesCount) applySuggested();

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

    ordered.forEach((rid) => {
      const info = getRole(rid);

      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
      row.style.padding = "10px 4px";
      row.style.borderBottom = "1px dashed rgba(0,0,0,.08)";

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

  function closeRoleConfig() { $("modalRole")?.classList.add("hidden"); }

  /* ---------------------------
     Start game
  --------------------------- */
  function startGame() {
    if (!State.rolesCount) applySuggested();
    if (rolesTotal(State.rolesCount) !== State.playerCount) {
      alert("⚠️ 角色總數必須等於玩家人數");
      return;
    }
    buildPlayers();
    showScreen("deal");
    renderDeal();
  }

  /* ---------------------------
     Night step navigation
  --------------------------- */
  function nightPrev() {
    State.nightStepIndex = Math.max(0, State.nightStepIndex - 1);
    save();
    renderNight();
  }

  function nightNext() {
    const step = getCurrentNightStep();
    if (!step) return;

    if (!canNext(step)) {
      navigator.vibrate?.([60,40,60]);
      return;
    }

    if (step.type === "witch") {
      if (!State.godView) {
        alert("需要切換 🔓 上帝視角 才能操作女巫");
        return;
      }
      openWitch();
      return;
    }

    if (step.type === "resolve") {
      resolveNight();
      return;
    }

    State.nightStepIndex = Math.min(State.nightSteps.length - 1, State.nightStepIndex + 1);
    save();
    renderNight();
  }

  /* ---------------------------
     Bind events
  --------------------------- */
  function bind() {
    // setup
    on($("boardBasic"), "click", () => setBoard("basic"));
    on($("boardSpecial"), "click", () => setBoard("b1"));

    on($("btnMinus"), "click", () => setPlayerCount(State.playerCount - 1));
    on($("btnPlus"), "click", () => setPlayerCount(State.playerCount + 1));
    on($("rangeCount"), "input", (e) => setPlayerCount(e.target.value));

    on($("btnSuggest"), "click", () => applySuggested());
    on($("btnOpenRoleConfig"), "click", () => openRoleConfig());

    on($("btnStart"), "click", () => startGame());

    // restart
    on($("btnRestart"), "click", () => {
      if (!confirm("確定要重新開始？所有進度會清除並回到開局設定。")) return;
      clearSave();
      location.reload();
    });

    // deal
    on($("btnNextPlayer"), "click", () => nextDeal());
    on($("btnDealBack"), "click", () => { showScreen("setup"); syncSetupUI(); });
    on($("btnFinishDeal"), "click", () => {
      resolveNightSteps();
      showScreen("night");
      renderNight();
    });

    // night
    on($("btnNightPrev"), "click", () => nightPrev());
    on($("btnNightNext"), "click", () => nightNext());

    // day
    on($("btnDayNext"), "click", () => nextDayToNight());

    // god toggle
    on($("btnGodToggle"), "click", () => toggleGod());
    on($("btnGodToggle2"), "click", () => toggleGod());
    on($("btnGodToggle3"), "click", () => toggleGod());
    on($("fabGod"), "click", () => toggleGod());

    // god modal
    on($("closeGod"), "click", closeGodModal);
    on($("pinCancel"), "click", closeGodModal);
    on($("pinOk"), "click", () => {
      const v = ($("pinInput")?.value || "").trim();
      if (v === DEFAULT_PIN) {
        setGod(true);
        closeGodModal();
      } else {
        $("pinWarn")?.classList.remove("hidden");
        navigator.vibrate?.([60,40,60]);
      }
    });

    // role modal
    on($("closeRole"), "click", closeRoleConfig);
    on($("roleApply"), "click", () => { closeRoleConfig(); syncSetupUI(); });
    on($("roleReset"), "click", () => { applySuggested(); openRoleConfig(); });

    // witch modal
    on($("closeWitch"), "click", closeWitch);
    on($("btnWitchSave"), "click", () => { State.witch.save = true; save(); renderWitchModal(); });
    on($("btnWitchNoSave"), "click", () => { State.witch.save = false; save(); renderWitchModal(); });
    on($("btnWitchPoisonPick"), "click", () => {
      if (State.witch.poisonUsed) return;
      State._pickPoisonMode = true;
      closeWitch();
      alert("請回到座位圈點選要毒的座位");
    });
    on($("btnWitchNoPoison"), "click", () => { State.witch.poisonTarget = null; save(); renderWitchModal(); });
    on($("btnWitchDone"), "click", () => { closeWitch(); });

    // reveal modal：點背景也可關（安全）
    on($("modalReveal"), "click", () => $("modalReveal")?.classList.add("hidden"));
  }

  /* ---------------------------
     Export minimal app API (給 script.js 用)
  --------------------------- */
  window.WW_APP_CORE = {
    State,
    save,
    load,
    showScreen,
    syncSetupUI,
    renderDeal,
    renderNight,
    renderDayAlive,
    setGod,
  };

  /* ---------------------------
     init
  --------------------------- */
  function init() {
    load();
    bind();

    // 初始化 UI
    if (!$("rangeCount")) return;

    $("rangeCount").value = String(State.playerCount || 9);
    $("boardBasic")?.classList.toggle("active", State.boardId !== "b1");
    $("boardSpecial")?.classList.toggle("active", State.boardId === "b1");

    // 若 rolesCount 缺失 → 立即補上，避免「開始」永遠 disabled
    if (!State.rolesCount) applySuggested();

    syncSetupUI();

    // 回到上次畫面
    showScreen(State.phase || "setup");
    if (State.phase === "deal") renderDeal();
    if (State.phase === "night") renderNight();
    if (State.phase === "day") renderDayAlive();

    // 顯示上帝鎖狀態
    setGod(!!State.godView);
  }

  window.WW_APP_INIT = init;
})();