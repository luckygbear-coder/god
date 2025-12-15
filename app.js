/* =========================================================
   狼人殺｜上帝輔助 PWA
   app.js（完整穩定版｜修女巫卡死＋座位點不到＋空刀＋不能連守）

   目標：
   - setup / deal / night / day 基本流程可跑
   - iOS：長按不選字、不跳放大、不跳選單（不阻斷座位 click）
   - 若 WW_DATA / rules / nightSteps 存在就用，沒有就 fallback
   - 女巫流程：刀口→救→毒；解藥用過不顯示刀口（只能毒）
   - 狼人空刀（wolfCanNoKill=true 時）
   - 不能連守（noConsecutiveGuard=true 時，用 prevGuardTarget）
========================================================= */

(() => {
  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);

  /* ---------------------------
     iOS 防長按選字/放大/選單（⚠️ 不阻斷 click）
  --------------------------- */
  try {
    document.documentElement.style.webkitUserSelect = "none";
    document.documentElement.style.userSelect = "none";
    document.documentElement.style.webkitTouchCallout = "none";
    document.body && (document.body.style.webkitUserSelect = "none");
    document.body && (document.body.style.userSelect = "none");
  } catch (e) {}
  // 禁右鍵/選取（不會影響一般 click）
  on(document, "contextmenu", (e) => e.preventDefault(), { passive: false });
  on(document, "selectstart", (e) => e.preventDefault(), { passive: false });
  // iOS gesture（縮放）
  on(document, "gesturestart", (e) => e.preventDefault(), { passive: false });

  // ✅ 只用在「長按翻牌按鈕」上（避免影響座位 click）
  function stopTextSelectOnTouchOnlyHold(el) {
    if (!el) return;
    el.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
      },
      { passive: false }
    );
  }

  /* ---------------------------
     Storage
  --------------------------- */
  const STORAGE_KEY = "ww_save_v1_stable_full";
  const State = {
    phase: "setup", // setup | deal | night | day
    boardId: "basic", // basic | b1
    playerCount: 9,
    rolesCount: null, // {roleId: count}
    players: [], // [{seat, roleId, name, icon, team, alive}]
    dealIndex: 0,

    nightNo: 1,
    dayNo: 1,

    godView: false,

    nightState: {}, // pick results
    nightSteps: [],
    nightStepIndex: 0,

    logs: [], // [{nightNo, dayNo, publicText, hiddenText, ts}]

    // 女巫（UI 操作）
    witch: { saveUsed: false, poisonUsed: false, save: false, poisonTarget: null },

    // 設定（預設開）
    settings: {
      noConsecutiveGuard: true,
      wolfCanNoKill: true,
      witchCannotSelfSave: true,
      hunterPoisonNoShoot: true,
      blackWolfKingPoisonNoSkill: true,
    },

    // internal
    _pickPoisonMode: false,
    _prevGuardTarget: null,
  };

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(State));
    } catch (e) {}
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s && typeof s === "object") {
        Object.assign(State, s);
        // 保底
        State.settings = State.settings || {
          noConsecutiveGuard: true,
          wolfCanNoKill: true,
          witchCannotSelfSave: true,
          hunterPoisonNoShoot: true,
          blackWolfKingPoisonNoSkill: true,
        };
        State.witch = State.witch || { saveUsed: false, poisonUsed: false, save: false, poisonTarget: null };
        State.logs = Array.isArray(State.logs) ? State.logs : [];
        State.players = Array.isArray(State.players) ? State.players : [];
        State.nightState = State.nightState || {};
        State.nightSteps = Array.isArray(State.nightSteps) ? State.nightSteps : [];
      }
    } catch (e) {}
  }
  function clearSave() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  /* ---------------------------
     Screens
  --------------------------- */
  function showScreen(name) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    $(`screen-${name}`)?.classList.add("active");
    State.phase = name;
    save();
  }

  /* ---------------------------
     WW_DATA helpers（超容錯）
  --------------------------- */
  function getWW() {
    return window.WW_DATA || null;
  }
  function getRolesMap() {
    const WW = getWW();
    return WW?.roles || {};
  }
  function getRole(roleId) {
    const roles = getRolesMap();
    return roles?.[roleId] || { id: roleId, name: roleId, icon: "❔", team: "villager" };
  }
  function getBoardBundle(boardId) {
    const WW = getWW();
    if (WW?.getBoardBundle) {
      const b = WW.getBoardBundle(boardId);
      if (b) return b;
    }
    // fallback：直接抓 WW_DATA.boards / rules / nightSteps
    const board = WW?.boards?.[boardId] || null;
    const rules = (boardId === "b1" ? WW?.rules?.b1 : WW?.rules?.basic) || null;
    const nightSteps = (boardId === "b1" ? WW?.nightSteps?.b1 : WW?.nightSteps?.basic) || null;
    if (!board) return null;
    return { board, rules, nightSteps };
  }

  /* ---------------------------
     Setup: 預設配置（沒 preset 也能跑）
  --------------------------- */
  function suggestBasicConfigByCount(n) {
    // 預女獵 + 狼 + 民
    const wolves = n >= 10 ? 3 : 2;
    const fixed = 3; // seer+witch+hunter
    const villager = Math.max(0, n - wolves - fixed);
    return { werewolf: wolves, villager, seer: 1, witch: 1, hunter: 1 };
  }
  function suggestB1ConfigByCount(n) {
    // 示範版：預女獵 + 守衛 + 騎士 + 黑狼王 + 白狼王（之後你會再擴）
    const base = {
      villager: 0,
      werewolf: 0,
      seer: 1,
      witch: 1,
      hunter: 1,
      guard: 1,
      knight: 1,
      blackWolfKing: 1,
      whiteWolfKing: 1,
    };
    const wolves = n >= 11 ? 3 : 2;
    base.werewolf = Math.max(0, wolves - 2); // 扣掉黑狼王/白狼王
    const fixed =
      base.seer +
      base.witch +
      base.hunter +
      base.guard +
      base.knight +
      base.blackWolfKing +
      base.whiteWolfKing +
      base.werewolf;
    base.villager = Math.max(0, n - fixed);
    return base;
  }
  function rolesTotal(map) {
    return Object.values(map || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  }
  function getSuggestedRolesCount(boardId, n) {
    const bundle = getBoardBundle(boardId);
    const preset = bundle?.board?.presets?.[n];
    if (preset && typeof preset === "object") return structuredClone(preset);
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
      for (let i = 0; i < (Number(cnt) || 0); i++) rolesArr.push(rid);
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
    State._pickPoisonMode = false;
    State._prevGuardTarget = null;

    State.witch = State.witch || { saveUsed: false, poisonUsed: false, save: false, poisonTarget: null };
    State.witch.save = false;
    State.witch.poisonTarget = null;

    save();
  }

  /* ---------------------------
     Deal UI
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
      b.style.webkitTouchCallout = "none";
      b.style.webkitUserSelect = "none";
      b.style.userSelect = "none";
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

    // ✅ 只在這顆按鈕阻擋 touchstart（避免影響座位 click）
    stopTextSelectOnTouchOnlyHold(btn);

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
      navigator.vibrate?.([60, 40, 60]);
      return;
    }
    save();
    renderDeal();
  }

  function openDealConfirm() {
    $("modalDealConfirm")?.classList.remove("hidden");
  }
  function closeDealConfirm() {
    $("modalDealConfirm")?.classList.add("hidden");
  }

  /* ---------------------------
     Night steps fallback generator
  --------------------------- */
  function hasRole(roleId) {
    return State.players.some((p) => p.roleId === roleId);
  }

  function buildFallbackNightSteps() {
    const steps = [];
    steps.push({ key: "close", type: "info", publicScript: "天黑請閉眼。", godScript: "天黑請閉眼。" });

    if (hasRole("guard")) {
      steps.push({
        key: "guard",
        type: "pick",
        pickKey: "guardTarget",
        required: true,
        publicScript: "守衛請睜眼，請守一位玩家。",
        godScript: "守衛守誰？（點座位）",
      });
    }

    // 狼刀（可空刀）
    steps.push({
      key: "wolf",
      type: "pick",
      pickKey: "wolfTarget",
      required: !State.settings.wolfCanNoKill,
      allowNull: !!State.settings.wolfCanNoKill,
      publicScript: State.settings.wolfCanNoKill ? "狼人請睜眼（可空刀），請選擇目標。" : "狼人請睜眼，請選擇目標。",
      godScript: State.settings.wolfCanNoKill ? "狼人刀誰？（可不選=空刀）" : "狼人刀誰？（必選）",
    });

    if (hasRole("seer")) {
      steps.push({
        key: "seer",
        type: "pick",
        pickKey: "seerCheck",
        required: true,
        publicScript: "預言家請睜眼，請查驗一位玩家。",
        godScript: "預言家查誰？（點座位）",
      });
    }

    if (hasRole("witch")) {
      steps.push({ key: "witch", type: "witch", publicScript: "女巫請睜眼（上帝操作）。", godScript: "女巫回合：請操作救/毒。" });
    }

    steps.push({ key: "resolve", type: "resolve", publicScript: "天亮請睜眼。", godScript: "天亮：結算夜晚並公告。" });
    return steps;
  }

  function resolveNightStepsForThisGame() {
    const bundle = getBoardBundle(State.boardId);
    let steps = bundle?.nightSteps;

    if (typeof steps === "function") {
      try {
        steps = steps(State.players, State.nightState);
      } catch (e) {
        steps = null;
      }
    }

    if (!Array.isArray(steps) || steps.length === 0) {
      steps = buildFallbackNightSteps();
    }

    State.nightSteps = steps;
    State.nightStepIndex = 0;
    save();
  }

  /* ---------------------------
     Night UI + Witch UI（✅已修 iOS 座位點不到）
  --------------------------- */

  // ✅ 座位渲染：不再 preventDefault（iOS 會讓 click 不觸發）
  function renderSeats(containerId, onPick, selectedSeat = null, disabledSeatSet = null) {
    const box = $(containerId);
    if (!box) return;
    box.innerHTML = "";

    State.players.forEach((p) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seat" + (p.alive ? "" : " dead") + (selectedSeat === p.seat ? " selected" : "");
      b.textContent = String(p.seat);

      const disableByRule = disabledSeatSet && disabledSeatSet.has(p.seat);
      b.disabled = !p.alive || !!disableByRule;
      if (disableByRule) b.classList.add("disabled");

      // iOS：避免長按跳選單（不擋 click）
      b.style.webkitTouchCallout = "none";
      b.style.webkitUserSelect = "none";
      b.style.userSelect = "none";

      b.addEventListener("click", () => {
        if (!p.alive) return;
        if (disableByRule) return;
        onPick?.(p.seat);
      });

      box.appendChild(b);
    });
  }

  function getCurrentNightStep() {
    return State.nightSteps?.[State.nightStepIndex] || null;
  }

  function ensureWolfNoKillButton(step) {
    if (!step || step.type !== "pick" || step.pickKey !== "wolfTarget") return;

    const seatsBox = $("nightSeats");
    if (!seatsBox) return;

    const old = $("wolfNoKillBar");
    if (old) old.remove();

    if (!State.settings.wolfCanNoKill) return;

    const bar = document.createElement("div");
    bar.id = "wolfNoKillBar";
    bar.style.display = "flex";
    bar.style.gap = "10px";
    bar.style.marginTop = "10px";

    const btnNoKill = document.createElement("button");
    btnNoKill.type = "button";
    btnNoKill.className = "btn ghost";
    btnNoKill.textContent = State.nightState.wolfTarget == null ? "✅ 空刀中" : "空刀";
    btnNoKill.onclick = () => {
      State.nightState.wolfTarget = null;
      save();
      renderNight();
    };

    const btnClear = document.createElement("button");
    btnClear.type = "button";
    btnClear.className = "btn ghost";
    btnClear.textContent = "清除選擇";
    btnClear.onclick = () => {
      delete State.nightState.wolfTarget;
      save();
      renderNight();
    };

    bar.append(btnNoKill, btnClear);
    seatsBox.parentElement?.appendChild(bar);
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

    const script = State.godView ? step.godScript || step.publicScript : step.publicScript || step.godScript;
    $("nightScript") && ($("nightScript").textContent = script || "（無台詞）");

    ensureWolfNoKillButton(step);

    // 不能連守：如果 prevGuardTarget 存在，守衛步驟禁選同一人
    let disabled = null;
    if (step.type === "pick" && step.pickKey === "guardTarget" && State.settings.noConsecutiveGuard) {
      const prev = State.nightState.prevGuardTarget ?? State._prevGuardTarget ?? null;
      if (prev) {
        disabled = new Set([prev]);
      }
    }

    const selected =
      State._pickPoisonMode ? State.witch.poisonTarget : step.pickKey ? State.nightState?.[step.pickKey] ?? null : null;

    renderSeats(
      "nightSeats",
      (seat) => {
        // 女巫毒 pick mode
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
          return;
        }
      },
      selected,
      disabled
    );
  }

  function canGoNextNightStep(step) {
    if (!step) return false;

    if (step.type === "pick" && step.required && step.pickKey) {
      if (step.pickKey === "wolfTarget" && State.settings.wolfCanNoKill) return true;
      return State.nightState[step.pickKey] != null;
    }
    return true;
  }

  function openWitchModal() {
    $("modalWitch")?.classList.remove("hidden");
    renderWitchModal();
  }

  function renderWitchModal() {
    const knifeSeat = State.nightState.wolfTarget ?? null;

    const knifeEl = $("witchKnife");
    const statusEl = $("witchStatus");

    const saveUsed = !!State.witch.saveUsed;
    const poisonUsed = !!State.witch.poisonUsed;

    // 解藥已用過：不顯示刀口，只能毒
    const showKnife = !saveUsed;

    if (knifeEl) {
      knifeEl.innerHTML = showKnife
        ? knifeSeat != null
          ? `${knifeSeat} 號`
          : "（狼人尚未選刀／或空刀）"
        : "（解藥已用過，不提供刀口）";
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
      btnSave.disabled = saveUsed || !showKnife || knifeSeat == null;
      btnSave.textContent = State.witch.save ? "✅ 已選擇用解藥" : "用解藥救";
    }
    if (btnNoSave) {
      btnNoSave.disabled = !showKnife;
    }
    if (btnPickPoison) {
      btnPickPoison.disabled = poisonUsed;
      btnPickPoison.textContent = State.witch.poisonTarget ? `☠️ 已毒 ${State.witch.poisonTarget} 號（改選）` : "用毒藥（回座位圈點人）";
    }
    if (btnNoPoison) {
      btnNoPoison.disabled = false;
    }
  }

  function nightPrev() {
    State._pickPoisonMode = false;
    State.nightStepIndex = Math.max(0, State.nightStepIndex - 1);
    save();
    renderNight();
  }

  function nightNext() {
    const step = getCurrentNightStep();
    if (!step) return;

    if (!canGoNextNightStep(step)) {
      navigator.vibrate?.([60, 40, 60]);
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

    State._pickPoisonMode = false;
    State.nightStepIndex = Math.min(State.nightSteps.length - 1, State.nightStepIndex + 1);
    save();
    renderNight();
  }

  function initNightForNewRound() {
    State.nightState = {};
    // 帶入上一夜守衛目標，供不能連守
    State.nightState.prevGuardTarget = State._prevGuardTarget ?? null;

    State._pickPoisonMode = false;

    State.witch = State.witch || { saveUsed: false, poisonUsed: false, save: false, poisonTarget: null };
    State.witch.save = false;
    State.witch.poisonTarget = null;

    resolveNightStepsForThisGame();
    save();
    renderNight();
  }

  /* ---------------------------
     Resolve night（有 rules 就用，沒有就簡化）
  --------------------------- */
  function resolveNight() {
    const bundle = getBoardBundle(State.boardId);
    const rules = bundle?.rules || null;

    // 把女巫 UI 決策寫回 nightState（給 rules 用）
    State.nightState.witchSave = !!State.witch.save;
    State.nightState.witchPoisonTarget = State.witch.poisonTarget || null;
    State.nightState.witchSaveUsed = !!State.witch.saveUsed;
    State.nightState.witchPoisonUsed = !!State.witch.poisonUsed;

    const settings = State.settings || {};

    let publicText = "";
    let hiddenText = "";
    let resolved = null;

    if (rules?.resolveNight && rules?.buildAnnouncement) {
      try {
        resolved = rules.resolveNight({
          players: State.players,
          night: State.nightState,
          settings,
        });

        const ann = rules.buildAnnouncement({
          nightNo: State.nightNo,
          dayNo: State.dayNo,
          players: State.players,
          night: State.nightState,
          resolved,
          settings,
        });

        publicText = ann?.publicText || "（公告產生失敗）";
        hiddenText = ann?.hiddenText || "";

        // ✅ 從 resolved 帶回「本夜守誰」作為下一夜 prevGuardTarget
        const guardTarget = resolved?.meta?.guardTargetRaw ?? State.nightState.guardTarget ?? null;
        if (guardTarget) State._prevGuardTarget = guardTarget;
      } catch (e) {
        console.warn("rules error:", e);
        publicText = "（規則結算失敗，已用簡化公告）";
        hiddenText = State.godView ? String(e) : "";
      }
    } else {
      // fallback：不結算死亡，至少不卡流程
      publicText = "天亮了。（目前未接上完整 rules，暫不結算死亡）";
      hiddenText = State.godView ? `（上帝）nightState=${JSON.stringify(State.nightState)}` : "";
      // 仍保留 guardTarget 給下一夜不能連守
      if (State.nightState.guardTarget) State._prevGuardTarget = State.nightState.guardTarget;
    }

    // ✅ 用藥消耗鎖定（選了就算用掉）
    if (State.witch.save) State.witch.saveUsed = true;
    if (State.witch.poisonTarget) State.witch.poisonUsed = true;

    State.logs.unshift({
      nightNo: State.nightNo,
      dayNo: State.dayNo,
      publicText,
      hiddenText,
      ts: new Date().toISOString(),
    });

    save();

    showScreen("day");
    renderDayAlive();
    openAnnouncementModal(true);
  }

  /* ---------------------------
     Announcement modal
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
      box.textContent = State.godView ? l.publicText + "\n\n" + (l.hiddenText || "") : l.publicText;
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

  function downloadJSON(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function exportReplay() {
    downloadJSON(`狼人殺記錄_${Date.now()}.json`, {
      exportedAt: new Date().toISOString(),
      state: State,
    });
  }

  /* ---------------------------
     Day
  --------------------------- */
  function renderDayAlive() {
    const el = $("dayAlive");
    if (!el) return;
    const alive = State.players.filter((p) => p.alive).map((p) => p.seat);
    el.textContent = alive.length ? `存活：${alive.join("、")} 號` : "（全滅？）";
  }

  function nextDayToNight() {
    State.nightNo += 1;
    State.dayNo += 1;
    $("dayTag") && ($("dayTag").textContent = `第 ${State.dayNo} 天`);

    initNightForNewRound();
    showScreen("night");
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
  function toggleGod() {
    setGod(!State.godView);
  }

  function ensureRestartButton() {
    const host = document.querySelector(".top-actions");
    if (!host) return;
    if ($("btnRestart")) return;

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

    const priority = ["werewolf", "villager", "seer", "witch", "hunter", "guard", "knight", "blackWolfKing", "whiteWolfKing"];
    const ordered = Array.from(new Set([...priority, ...ids]));

    State.rolesCount = State.rolesCount || {};

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
      left.textContent = `${info.icon ? info.icon + " " : ""}${info.name || rid}`;

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

  /* ---------------------------
     Start game
  --------------------------- */
  function startGame() {
    const WW = getWW();
    if (!WW) {
      alert("❌ 找不到 WW_DATA（請確認 data/ww.data.js 已載入，且路徑正確）");
      return;
    }

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
     Bind events（index.html ids）
  --------------------------- */
  function bind() {
    ensureRestartButton();

    // Setup: board
    on($("boardBasic"), "click", () => setBoard("basic"));
    on($("boardSpecial"), "click", () => setBoard("b1"));

    // Setup: count
    on($("btnPlus"), "click", () => setPlayerCount(State.playerCount + 1));
    on($("btnMinus"), "click", () => setPlayerCount(State.playerCount - 1));
    on($("rangeCount"), "input", (e) => setPlayerCount(e.target.value));

    // Setup: suggest / role config
    on($("btnSuggest"), "click", () => {
      State.rolesCount = getSuggestedRolesCount(State.boardId, State.playerCount);
      syncSetupUI();
    });
    on($("btnOpenRoleConfig"), "click", openRoleConfig);
    on($("closeRole"), "click", () => $("modalRole")?.classList.add("hidden"));
    on($("roleReset"), "click", () => {
      State.rolesCount = getSuggestedRolesCount(State.boardId, State.playerCount);
      openRoleConfig();
      syncSetupUI();
    });
    on($("roleApply"), "click", () => $("modalRole")?.classList.add("hidden"));

    // Start
    on($("btnStart"), "click", startGame);

    // Deal
    on($("btnNextPlayer"), "click", nextDeal);
    on($("btnDealBack"), "click", () => {
      hideReveal();
      showScreen("setup");
    });
    on($("btnFinishDeal"), "click", openDealConfirm);
    on($("dealConfirmNo"), "click", closeDealConfirm);
    on($("dealConfirmYes"), "click", () => {
      closeDealConfirm();
      showScreen("night");
      initNightForNewRound();
    });

    // Night
    on($("btnNightPrev"), "click", nightPrev);
    on($("btnNightNext"), "click", nightNext);

    // Witch modal buttons
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
      alert("請在座位圈點選要毒的人");
      renderNight();
    });
    on($("btnWitchNoPoison"), "click", () => {
      State._pickPoisonMode = false;
      State.witch.poisonTarget = null;
      save();
      renderWitchModal();
      renderNight();
    });
    on($("btnWitchDone"), "click", () => {
      State._pickPoisonMode = false;
      $("modalWitch")?.classList.add("hidden");
      // 完成女巫後 → 夜晚下一步
      State.nightStepIndex = Math.min(State.nightSteps.length - 1, State.nightStepIndex + 1);
      save();
      renderNight();
    });

    // Day
    on($("btnDayNext"), "click", nextDayToNight);

    // God
    on($("btnGodToggle"), "click", toggleGod);
    on($("fabGod"), "click", toggleGod);

    // Announcement
    on($("btnOpenAnnouncement"), "click", () => openAnnouncementModal(true));
    on($("fabAnn"), "click", () => openAnnouncementModal(true));
    on($("btnOpenAnnouncement2"), "click", () => openAnnouncementModal(true));

    on($("closeAnn"), "click", () => $("modalAnn")?.classList.add("hidden"));
    on($("annToday"), "click", () => {
      annMode = "today";
      $("annToday")?.classList.add("active");
      $("annHistory")?.classList.remove("active");
      renderAnnouncement();
    });
    on($("annHistory"), "click", () => {
      annMode = "history";
      $("annHistory")?.classList.add("active");
      $("annToday")?.classList.remove("active");
      renderAnnouncement();
    });

    on($("btnExport"), "click", exportReplay);
    on($("btnCopyAnn"), "click", async () => {
      try {
        await navigator.clipboard.writeText($("annBox")?.textContent || "");
        alert("已複製");
      } catch (e) {
        alert("複製失敗（可能需要 HTTPS / PWA 安裝）");
      }
    });
  }

  /* ---------------------------
     Boot
  --------------------------- */
  function boot() {
    load();
    ensureRestartButton();

    // 基本 UI 初始化
    State.rolesCount = State.rolesCount || getSuggestedRolesCount(State.boardId, State.playerCount);
    $("rangeCount") && ($("rangeCount").value = String(State.playerCount));
    $("dayTag") && ($("dayTag").textContent = `第 ${State.dayNo} 天`);
    setBoard(State.boardId); // 會 syncSetupUI

    setGod(!!State.godView);
    bind();

    // 恢復畫面
    showScreen(State.phase || "setup");

    if (State.phase === "deal") {
      renderDeal();
    } else if (State.phase === "night") {
      if (!State.nightSteps || !State.nightSteps.length) resolveNightStepsForThisGame();
      renderNight();
    } else if (State.phase === "day") {
      renderDayAlive();
      renderAnnouncement();
    }
  }

  boot();
})();