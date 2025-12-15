/* =========================================================
   狼人殺｜上帝輔助 PWA
   app.js（超穩定：自動補載資料檔 + 不依賴 ww.data.js）
   - setup / deal / night / day 流程可跑
   - iOS：防長按選字/放大/選單
   - 若 roles/boards/rules/nightSteps 缺失 → fallback 不卡死
========================================================= */

(() => {
  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);

  /* ---------------------------
     iOS 防長按選字/放大/選單
  --------------------------- */
  try {
    document.documentElement.style.webkitUserSelect = "none";
    document.documentElement.style.userSelect = "none";
    document.documentElement.style.webkitTouchCallout = "none";
    document.documentElement.style.webkitTextSizeAdjust = "100%";
  } catch (e) {}
  on(document, "contextmenu", (e) => e.preventDefault(), { passive: false });
  on(document, "selectstart", (e) => e.preventDefault(), { passive: false });
  on(document, "gesturestart", (e) => e.preventDefault(), { passive: false });

  function stopTouchSelect(el) {
    if (!el) return;
    el.style.webkitUserSelect = "none";
    el.style.userSelect = "none";
    el.style.webkitTouchCallout = "none";
    el.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
  }

  /* ---------------------------
     動態載入 script（app.js 自己補載）
  --------------------------- */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.onload = () => resolve(src);
      s.onerror = () => reject(new Error("load fail: " + src));
      document.head.appendChild(s);
    });
  }

  async function loadFirstAvailable(candidates) {
    for (const src of candidates) {
      try {
        await loadScript(src);
        return src;
      } catch (e) {}
    }
    return null;
  }

  // 依你截圖的 repo 結構：同一份東西可能有多種路徑
  async function ensureDataLoaded() {
    // 1) roles
    if (!getRolesMapReady()) {
      await loadFirstAvailable([
        "./data/roles/roles.base.js",
        "./data/roles/roles.b1.js",
        "./data/roles/roles.all.js",
        "./data/roles/roles.index.js",
        "./data/roles/roles.special.js",
        "./data/roles/roles.special.b1.js",
        "./data/roles/roles.js",
        "./data/roles.base.js",
        "./data/roles.special.js",
        "./roles.js",
      ]);
      // 有些專案 roles.base / roles.b1 需要都載
      if (!getRolesMapReady()) {
        await loadFirstAvailable(["./data/roles/roles.base.js", "./data/roles.base.js"]);
        await loadFirstAvailable(["./data/roles/roles.b1.js", "./data/roles/roles.b1.js"]);
      }
    }

    // 2) boards
    if (!getBoardsMapReady()) {
      await loadFirstAvailable([
        "./data/boards/boards.config.js",
        "./data/boards/boards.js",
        "./data/boards/boards.index.js",
        "./data/boards/board.basic.js",
        "./data/boards/board.special.js",
        "./data/boards/boards.b1.js",
        "./data/boards/basic.bundle.js",
        "./data/boards.js",
        "./boards.js",
      ]);
    }

    // 3) rules（可缺，缺了用 fallback）
    if (!getRulesReady()) {
      await loadFirstAvailable([
        "./data/rules/rules.basic.js",
        "./data/rules/rules.b1.js",
        "./data/rules/rules.core.js",
        "./data/rules.core.js",
        "./data/rules.basic.js",
        "./data/rules.b1.js",
      ]);
    }

    // 4) night steps（你現在卡住主要是這個）
    if (!getNightStepsReady()) {
      // 你 repo 有兩種：data/night/* 與 data/flow/*
      await loadFirstAvailable([
        "./data/night/night.steps.basic.js",
        "./data/night/night.steps.b1.js",
        "./data/night.steps.basic.js",
        "./data/night.steps.b1.js",

        "./data/flow/night.steps.basic.js",
        "./data/flow/night.steps.special.js",
        "./data/flow/night.steps.js",
        "./data/flow/night.special.registry.js",
        "./data/flow/night.steps.b1.js",

        "./data/night/night.steps.js",
        "./data/night/night.steps.special.js",
      ]);
    }

    // 5) engines（可缺）
    await loadFirstAvailable([
      "./engine/night.engine.js",
      "./engine/day.engine.js",
      "./engine/win.engine.js",
      "./engine/night.engine.js",
      "./engine/day.engine.js",
      "./engine/win.engine.js",
      "./data/flow/win.check.js",
      "./data/flow/vote.day.js",
    ]);

    // 6) ww.data.js（可有可無；有就當加分）
    if (!window.WW_DATA?.getBoardBundle) {
      await loadFirstAvailable(["./data/ww.data.js", "./ww.data.js"]);
    }
  }

  /* ---------------------------
     Storage
  --------------------------- */
  const STORAGE_KEY = "ww_save_v2_appjs_hub";
  const State = {
    phase: "setup",
    boardId: "basic",       // basic | b1
    playerCount: 9,
    rolesCount: null,       // { roleId: count }
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
      noConsecutiveGuard: true,
      wolfCanNoKill: true,
      witchCannotSelfSave: true,
      hunterPoisonNoShoot: true,
      blackWolfKingPoisonNoSkill: true,
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
     Screens
  --------------------------- */
  function showScreen(name) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    $(`screen-${name}`)?.classList.add("active");
    State.phase = name;
    save();
  }

  /* ---------------------------
     資料收集（不依賴 ww.data.js）
  --------------------------- */
  function mergeMaps(...maps) {
    const out = {};
    for (const m of maps) {
      if (!m || typeof m !== "object") continue;
      for (const k of Object.keys(m)) out[k] = m[k];
    }
    return out;
  }

  // roles：可能存在於很多命名
  function getRolesMap() {
    const W = window;
    return mergeMaps(
      W.WW_ROLES_ALL,
      W.WW_ROLES_BASE,
      W.WW_ROLES_B1,
      W.WW_ROLES_SPECIAL,
      W.WW_ROLES_SPECIAL_B1,
      W.ROLES,
      W.roles,
      W.WW_DATA?.roles
    );
  }
  function getRolesMapReady() {
    const m = getRolesMap();
    return m && Object.keys(m).length > 0;
  }
  function getRole(roleId) {
    const roles = getRolesMap();
    return roles?.[roleId] || { id: roleId, name: roleId, icon:"❔", team:"villager" };
  }

  // boards
  function getBoardsMap() {
    const W = window;
    return (
      W.WW_BOARDS ||
      W.BOARDS ||
      W.boards ||
      W.WW_DATA?.boards ||
      null
    );
  }
  function getBoardsMapReady() {
    const b = getBoardsMap();
    return b && typeof b === "object" && Object.keys(b).length > 0;
  }

  // rules
  function getRulesHub() {
    const W = window;
    // 你 index.html 的版本會是 WW_RULES_BASIC / WW_RULES_B1
    const basic = W.WW_RULES_BASIC || W.rulesBasic || W.WW_DATA?.rulesBasic || W.WW_DATA?.rules?.basic || null;
    const b1 = W.WW_RULES_B1 || W.rulesB1 || W.WW_DATA?.rulesB1 || W.WW_DATA?.rules?.b1 || null;
    return { basic, b1 };
  }
  function getRulesReady() {
    const r = getRulesHub();
    return !!(r.basic || r.b1);
  }

  // nightSteps
  function getNightStepsHub() {
    const W = window;
    // 你 repo 同時存在 data/night 與 data/flow，命名也可能不同
    const basic =
      W.WW_NIGHT_STEPS_BASIC ||
      W.NIGHT_STEPS_BASIC ||
      W.nightStepsBasic ||
      W.WW_DATA?.nightSteps?.basic ||
      null;

    const b1 =
      W.WW_NIGHT_STEPS_B1 ||
      W.NIGHT_STEPS_B1 ||
      W.nightStepsB1 ||
      W.WW_DATA?.nightSteps?.b1 ||
      null;

    // 另外：flow 版本可能只有一份 steps
    const any =
      W.NIGHT_STEPS ||
      W.nightSteps ||
      null;

    return { basic, b1, any };
  }
  function getNightStepsReady() {
    const h = getNightStepsHub();
    const arr = h.basic || h.b1 || h.any;
    return Array.isArray(arr) && arr.length > 0;
  }

  function getBoardBundle(boardId) {
    // 如果 ww.data.js 有就用（加分）
    if (window.WW_DATA?.getBoardBundle) {
      const b = window.WW_DATA.getBoardBundle(boardId);
      if (b) return b;
    }

    const boards = getBoardsMap();
    const board = boards?.[boardId] || null;

    const rulesHub = getRulesHub();
    const rules = (boardId === "b1" ? rulesHub.b1 : rulesHub.basic) || null;

    const stepsHub = getNightStepsHub();
    let nightSteps = (boardId === "b1" ? stepsHub.b1 : stepsHub.basic) || null;
    if (!nightSteps) nightSteps = stepsHub.any || null;

    return { board, rules, nightSteps };
  }

  /* ---------------------------
     Setup：建議配置（fallback）
  --------------------------- */
  function clone(obj) {
    try { return JSON.parse(JSON.stringify(obj)); } catch(e){ return obj; }
  }

  function rolesTotal(map) {
    return Object.values(map || {}).reduce((a,b)=>a+(Number(b)||0),0);
  }

  function suggestBasicConfigByCount(n) {
    const wolves = n >= 10 ? 3 : 2;
    const fixed = 3; // seer/witch/hunter
    const villager = Math.max(0, n - wolves - fixed);
    return { werewolf: wolves, villager, seer: 1, witch: 1, hunter: 1 };
  }

  function suggestB1ConfigByCount(n) {
    const base = {
      seer:1, witch:1, hunter:1,
      guard:1, knight:1,
      blackWolfKing:1, whiteWolfKing:1,
      werewolf:0, villager:0
    };
    const wolves = n >= 11 ? 3 : 2;
    base.werewolf = Math.max(0, wolves - 2);
    const fixed = Object.values(base).reduce((a,b)=>a+b,0);
    base.villager = Math.max(0, n - fixed);
    return base;
  }

  function getSuggestedRolesCount(boardId, n) {
    const bundle = getBoardBundle(boardId);
    const preset = bundle?.board?.presets?.[n];
    if (preset && typeof preset === "object") return clone(preset);
    return boardId === "b1" ? suggestB1ConfigByCount(n) : suggestBasicConfigByCount(n);
  }

  function syncSetupUI() {
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

  function setBoard(boardId) {
    State.boardId = boardId;
    $("boardBasic")?.classList.toggle("active", boardId === "basic");
    $("boardSpecial")?.classList.toggle("active", boardId === "b1");
    State.rolesCount = getSuggestedRolesCount(boardId, State.playerCount);
    syncSetupUI();
  }

  function setPlayerCount(n) {
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
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function buildPlayersFromRolesCount() {
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
     Deal（長按翻牌）
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
      stopTouchSelect(b);
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
  function hideReveal() {
    $("modalReveal")?.classList.add("hidden");
  }

  function renderDeal() {
    const p = State.players[State.dealIndex];
    if (!p) return;

    $("dealText") && ($("dealText").innerHTML = `請 <b>${p.seat} 號</b> 拿手機`);
    renderDealSeatGrid();

    const btn = $("btnHoldReveal");
    if (!btn) return;

    stopTouchSelect(btn);

    btn.onpointerdown = null;
    btn.onpointerup = null;
    btn.onpointercancel = null;
    btn.onpointerleave = null;

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

  function goBackToSetupFromDeal() {
    showScreen("setup");
    syncSetupUI();
  }

  function openDealConfirm() {
    $("modalDealConfirm")?.classList.remove("hidden");
  }
  function closeDealConfirm() {
    $("modalDealConfirm")?.classList.add("hidden");
  }

  /* ---------------------------
     Night steps：fallback（最少可跑）
  --------------------------- */
  function hasRole(roleId) {
    return State.players.some(p => p.roleId === roleId);
  }

  function buildFallbackNightSteps() {
    const steps = [];
    steps.push({ key:"close", type:"info", publicScript:"天黑請閉眼。", godScript:"天黑請閉眼。" });

    if (hasRole("guard")) {
      steps.push({ key:"guard", type:"pick", pickKey:"guardTarget", required:true,
        publicScript:"守衛請睜眼，請守一位玩家。", godScript:"守衛守誰？（點座位）"
      });
    }

    steps.push({ key:"wolf", type:"pick", pickKey:"wolfTarget",
      required: !State.settings.wolfCanNoKill,
      allowNull: !!State.settings.wolfCanNoKill,
      publicScript: State.settings.wolfCanNoKill ? "狼人請睜眼（可空刀），請選擇目標。":"狼人請睜眼，請選擇目標。",
      godScript: State.settings.wolfCanNoKill ? "狼人刀誰？（可不選=空刀）" : "狼人刀誰？（必選）"
    });

    if (hasRole("seer")) {
      steps.push({ key:"seer", type:"pick", pickKey:"seerCheck", required:true,
        publicScript:"預言家請睜眼，請查驗一位玩家。", godScript:"預言家查誰？（點座位）"
      });
    }

    if (hasRole("witch")) {
      steps.push({ key:"witch", type:"witch",
        publicScript:"女巫請睜眼（上帝操作）。", godScript:"女巫回合：請操作救/毒。"
      });
    }

    steps.push({ key:"resolve", type:"resolve", publicScript:"天亮請睜眼。", godScript:"天亮：結算夜晚並公告。" });
    return steps;
  }

  function resolveNightStepsForThisGame() {
    const bundle = getBoardBundle(State.boardId);
    let steps = bundle?.nightSteps || null;

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

  /* ---------------------------
     Night UI + Witch UI
  --------------------------- */
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
      stopTouchSelect(b);
      b.onclick = () => p.alive && onPick?.(p.seat);
      box.appendChild(b);
    });
  }

  function getCurrentNightStep() {
    return State.nightSteps?.[State.nightStepIndex] || null;
  }

  function renderNight() {
    $("nightTag") && ($("nightTag").textContent = `第 ${State.nightNo} 夜`);

    if (!State.nightSteps || State.nightSteps.length === 0) {
      resolveNightStepsForThisGame();
    }

    const step = getCurrentNightStep();
    if (!step) {
      $("nightScript") && ($("nightScript").textContent = "（夜晚流程結束）");
      return;
    }

    const script = State.godView ? (step.godScript || step.publicScript) : (step.publicScript || step.godScript);
    $("nightScript") && ($("nightScript").textContent = script || "（無台詞）");

    renderSeats("nightSeats", (seat) => {
      if (!step) return;

      if (State._pickPoisonMode) {
        State.witch.poisonTarget = seat;
        State._pickPoisonMode = false;
        save();
        renderWitchModal();
        renderNight();
        return;
      }

      if (step.type === "pick" && step.pickKey) {
        State.nightState[step.pickKey] = seat;
        save();
        renderNight();
      }
    });
  }

  function canGoNextNightStep(step) {
    if (!step) return false;
    if (step.type === "pick" && step.required && step.pickKey) {
      if (step.allowNull) return true;
      return !!State.nightState[step.pickKey];
    }
    return true;
  }

  function openWitchModal() {
    $("modalWitch")?.classList.remove("hidden");
    renderWitchModal();
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
    const btnNoPoison = $("btnWitchNoPoison");

    if (btnSave) {
      btnSave.disabled = saveUsed || !showKnife || !knifeSeat;
      btnSave.textContent = State.witch.save ? "✅ 已選擇用解藥" : "用解藥救";
    }
    if (btnNoSave) btnNoSave.disabled = !showKnife;

    if (btnPickPoison) {
      btnPickPoison.disabled = poisonUsed;
      btnPickPoison.textContent = State.witch.poisonTarget ? `☠️ 已毒 ${State.witch.poisonTarget} 號（改選）` : "用毒藥（回座位圈點人）";
    }
    if (btnNoPoison) btnNoPoison.disabled = false;
  }

  function nightPrev() {
    State.nightStepIndex = Math.max(0, State.nightStepIndex - 1);
    save();
    renderNight();
  }

  function nightNext() {
    const step = getCurrentNightStep();
    if (!step) return;

    if (!canGoNextNightStep(step)) {
      navigator.vibrate?.([60,40,60]);
      return;
    }

    if (step.type === "witch") {
      if (!State.godView) {
        alert("需要切換 🔓 上帝視角 才能操作女巫");
        return;
      }
      openWitchModal();
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
     Resolve night（有 rules 就用，沒有就 fallback）
  --------------------------- */
  function resolveNight() {
    const bundle = getBoardBundle(State.boardId);
    const rules = bundle?.rules || null;

    State.nightState.witchSave = !!State.witch.save;
    State.nightState.witchPoisonTarget = State.witch.poisonTarget || null;
    State.nightState.witchSaveUsed = !!State.witch.saveUsed;
    State.nightState.witchPoisonUsed = !!State.witch.poisonUsed;

    let publicText = "";
    let hiddenText = "";

    const settings = State.settings || {};

    if (rules?.resolveNight && rules?.buildAnnouncement) {
      try {
        const resolved = rules.resolveNight({
          players: State.players,
          night: State.nightState,
          settings
        });
        const ann = rules.buildAnnouncement({
          nightNo: State.nightNo,
          dayNo: State.dayNo,
          players: State.players,
          night: State.nightState,
          resolved,
          settings
        });
        publicText = ann?.publicText || "（公告產生失敗）";
        hiddenText = ann?.hiddenText || "";
      } catch (e) {
        console.warn("rules error:", e);
        publicText = "（規則結算失敗，已用簡化公告）";
        hiddenText = State.godView ? String(e) : "";
      }
    } else {
      publicText = "天亮了。（目前未接上完整 rules，暫不結算死亡）";
      hiddenText = State.godView ? `（上帝）nightState=${JSON.stringify(State.nightState)}` : "";
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
    openAnnouncementModal(true);
  }

  /* ---------------------------
     Announcement
  --------------------------- */
  let annMode = "today";

  function renderAnnouncement() {
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

  function openAnnouncementModal(forceToday = false) {
    if (forceToday) annMode = "today";
    $("modalAnn")?.classList.remove("hidden");
    $("annToday")?.classList.toggle("active", annMode === "today");
    $("annHistory")?.classList.toggle("active", annMode === "history");
    renderAnnouncement();
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

    resolveNightStepsForThisGame();
    save();
    showScreen("night");
    renderNight();
  }

  /* ---------------------------
     God toggle + restart
  --------------------------- */
  function setGod(onFlag) {
    State.godView = !!onFlag;
    document.body.classList.toggle("god-on", State.godView);
    $("btnGodToggle") && ($("btnGodToggle").textContent = State.godView ? "🔓" : "🔒");
    $("fabGod") && ($("fabGod").textContent = State.godView ? "🔓" : "🔒");
    save();
    renderAnnouncement();
    renderNight();
  }
  function toggleGod() { setGod(!State.godView); }

  function ensureRestartButton() {
    if ($("btnRestart")) return;
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
      clearSave();
      location.reload();
    };
    host.insertBefore(b, host.firstChild);
  }

  /* ---------------------------
     Role config modal（簡版）
  --------------------------- */
  function openRoleConfig() {
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

    if (!State.rolesCount) State.rolesCount = getSuggestedRolesCount(State.boardId, State.playerCount);

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

      stopTouchSelect(minus);
      stopTouchSelect(plus);

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

  /* ---------------------------
     Start game
  --------------------------- */
  function startGame() {
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
     Bind UI events
  --------------------------- */
  function bind() {
    ensureRestartButton();

    // setup
    on($("boardBasic"), "click", () => setBoard("basic"));
    on($("boardSpecial"), "click", () => setBoard("b1"));

    on($("btnMinus"), "click", () => setPlayerCount(State.playerCount - 1));
    on($("btnPlus"), "click", () => setPlayerCount(State.playerCount + 1));
    on($("rangeCount"), "input", (e) => setPlayerCount(e.target.value));

    on($("btnSuggest"), "click", () => {
      State.rolesCount = getSuggestedRolesCount(State.boardId, State.playerCount);
      syncSetupUI();
    });

    on($("btnOpenRoleConfig"), "click", openRoleConfig);
    on($("closeRole"), "click", () => $("modalRole")?.classList.add("hidden"));
    on($("roleReset"), "click", () => {
      State.rolesCount = getSuggestedRolesCount(State.boardId, State.playerCount);
      openRoleConfig(); // 直接重畫
      syncSetupUI();
    });
    on($("roleApply"), "click", () => {
      $("modalRole")?.classList.add("hidden");
      syncSetupUI();
    });

    on($("btnStart"), "click", startGame);

    // deal
    on($("btnDealBack"), "click", goBackToSetupFromDeal);
    on($("btnNextPlayer"), "click", nextDeal);
    on($("btnFinishDeal"), "click", openDealConfirm);

    on($("dealConfirmNo"), "click", closeDealConfirm);
    on($("dealConfirmYes"), "click", () => {
      closeDealConfirm();
      // 進夜晚
      State.nightState = {};
      State.nightStepIndex = 0;
      resolveNightStepsForThisGame();
      showScreen("night");
      renderNight();
      save();
    });

    // night
    on($("btnNightPrev"), "click", nightPrev);
    on($("btnNightNext"), "click", nightNext);

    // witch modal
    on($("btnWitchSave"), "click", () => {
      State.witch.save = true;
      save();
      renderWitchModal();
    });
    on($("btnWitchNoSave"), "click", () => {
      State.witch.save = false;
      save();
      renderWitchModal();
    });
    on($("btnWitchPoisonPick"), "click", () => {
      if (State.witch.poisonUsed) return;
      State._pickPoisonMode = true;
      save();
      $("modalWitch")?.classList.add("hidden");
      alert("請回到座位圈點選要毒的玩家");
    });
    on($("btnWitchNoPoison"), "click", () => {
      State.witch.poisonTarget = null;
      State._pickPoisonMode = false;
      save();
      renderWitchModal();
    });
    on($("btnWitchDone"), "click", () => {
      $("modalWitch")?.classList.add("hidden");
      // 女巫操作完成 → 直接前進到下一步
      State.nightStepIndex = Math.min(State.nightSteps.length - 1, State.nightStepIndex + 1);
      save();
      renderNight();
    });

    // day
    on($("btnDayNext"), "click", nextDayToNight);

    // announcement
    const openAnn = () => openAnnouncementModal(false);
    on($("btnOpenAnnouncement"), "click", openAnn);
    on($("btnOpenAnnouncement2"), "click", openAnn);
    on($("btnOpenAnnouncement3"), "click", openAnn);
    on($("closeAnn"), "click", () => $("modalAnn")?.classList.add("hidden"));

    on($("annToday"), "click", () => { annMode = "today"; renderAnnouncement(); $("annToday")?.classList.add("active"); $("annHistory")?.classList.remove("active"); });
    on($("annHistory"), "click", () => { annMode = "history"; renderAnnouncement(); $("annHistory")?.classList.add("active"); $("annToday")?.classList.remove("active"); });

    on($("btnCopyAnn"), "click", async () => {
      try {
        const txt = $("annBox")?.textContent || "";
        await navigator.clipboard.writeText(txt);
        alert("已複製");
      } catch(e) {
        alert("複製失敗（iOS 有時需要 https 與權限）");
      }
    });

    on($("btnExport"), "click", () => {
      const blob = new Blob([JSON.stringify(State, null, 2)], { type:"application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "ww_export.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });

    // god toggle
    on($("btnGodToggle"), "click", toggleGod);
    on($("fabGod"), "click", toggleGod);
    on($("fabAnn"), "click", openAnn);
  }

  /* ---------------------------
     Boot
  --------------------------- */
  async function boot() {
    load();

    // 先補載資料檔（重點）
    await ensureDataLoaded();

    // 初始化 UI
    document.body.classList.toggle("god-on", !!State.godView);
    $("btnGodToggle") && ($("btnGodToggle").textContent = State.godView ? "🔓" : "🔒");
    $("fabGod") && ($("fabGod").textContent = State.godView ? "🔓" : "🔒");

    // 若 roles/boards 還是沒有，至少不讓開始卡死：用 fallback（你仍可先跑流程）
    if (!State.rolesCount) {
      State.rolesCount = getSuggestedRolesCount(State.boardId, State.playerCount);
    }

    bind();
    showScreen(State.phase || "setup");
    syncSetupUI();

    // 若在 deal/night/day 重新進入，補畫面
    if (State.phase === "deal") renderDeal();
    if (State.phase === "night") { if (!State.nightSteps?.length) resolveNightStepsForThisGame(); renderNight(); }
    if (State.phase === "day") renderDayAlive();

    // console 健檢
    console.log("✅ app.js boot ok", {
      roles: Object.keys(getRolesMap() || {}).length,
      boards: Object.keys(getBoardsMap() || {}).length,
      nightStepsReady: getNightStepsReady(),
      rulesReady: getRulesReady()
    });
  }

  boot();

})();