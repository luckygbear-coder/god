/* =========================================================
   狼人殺｜上帝輔助 PWA
   app.js（穩定容錯版）
   目標：
   - 不再因 WW_DATA 結構或 nightSteps 缺失而卡死
   - setup / deal / night / day 基本流程可跑
   - 長按不選字、不跳放大、不跳選單（iOS）
   - 重新開始（確認後清檔回 setup）
   - 若 WW_DATA 有完整 rules / nightSteps 就用，沒有就 fallback
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
    document.body && (document.body.style.webkitUserSelect = "none");
    document.body && (document.body.style.userSelect = "none");
  } catch (e) {}
  // 阻止長按選字、雙指放大（Safari）
  on(document, "contextmenu", (e) => e.preventDefault(), { passive: false });
  on(document, "selectstart", (e) => e.preventDefault(), { passive: false });
  on(document, "gesturestart", (e) => e.preventDefault(), { passive: false });

  function stopTextSelectOnTouch(el) {
    if (!el) return;
    el.addEventListener("touchstart", (e) => { e.preventDefault(); }, { passive: false });
  }

  /* ---------------------------
     Storage
  --------------------------- */
  const STORAGE_KEY = "ww_save_v1_stable";
  const State = {
    phase: "setup",         // setup | deal | night | day
    boardId: "basic",       // basic | b1
    playerCount: 9,
    rolesCount: null,       // {roleId: count}
    players: [],            // [{seat, roleId, name, icon, team, alive}]
    dealIndex: 0,

    nightNo: 1,
    dayNo: 1,

    godView: false,

    nightState: {},         // pick results
    nightSteps: [],         // resolved steps array
    nightStepIndex: 0,

    logs: [],               // [{nightNo, dayNo, publicText, hiddenText, ts}]
    // 女巫簡化狀態（由 UI 操作）
    witch: { saveUsed:false, poisonUsed:false, save:false, poisonTarget:null },

    // 設定（你要的預設開關）
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
     WW_DATA helpers (超容錯)
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

  function getBoardIdFromUI() {
    return State.boardId || "basic";
  }

  function getBoardBundle(boardId) {
    const WW = getWW();
    if (WW?.getBoardBundle) {
      const b = WW.getBoardBundle(boardId);
      if (b) return b;
    }
    // fallback：直接從 WW_DATA.boards / WW_DATA.rules / WW_DATA.nightSteps 抓
    const board = WW?.boards?.[boardId] || null;
    const rules =
      (boardId === "b1" ? (WW?.rules?.b1) : (WW?.rules?.basic)) || null;
    const nightSteps =
      (boardId === "b1" ? (WW?.nightSteps?.b1) : (WW?.nightSteps?.basic)) || null;

    if (!board) return null;
    return { board, rules, nightSteps };
  }

  /* ---------------------------
     Setup: 預設配置（無 boards preset 也能跑）
  --------------------------- */
  function suggestBasicConfigByCount(n) {
    // 基本：預女獵 + 狼 + 民
    // 6~12 人簡單建議，可再調整
    const wolves = n >= 10 ? 3 : (n >= 8 ? 2 : 2);
    const fixed = 3; // seer+witch+hunter
    const villager = Math.max(0, n - wolves - fixed);
    return { werewolf: wolves, villager, seer: 1, witch: 1, hunter: 1 };
  }

  function suggestB1ConfigByCount(n) {
    // 你說先確保流程順：先做「預女獵 + 守衛 + 騎士 + 黑狼王 + 白狼王」示範
    // （你後續要加更多角色：白痴/攝夢人/... 我們等流程穩再擴）
    const base = { villager: 0, werewolf: 0, seer: 1, witch: 1, hunter: 1, guard: 1, knight: 1, blackWolfKing: 1, whiteWolfKing: 1 };
    // 配狼數：n 6~12
    const wolves = n >= 11 ? 3 : 2;
    base.werewolf = Math.max(0, wolves - 2);      // 扣掉黑狼王/白狼王兩張狼牌
    const fixed = base.seer + base.witch + base.hunter + base.guard + base.knight + base.blackWolfKing + base.whiteWolfKing + base.werewolf;
    base.villager = Math.max(0, n - fixed);
    return base;
  }

  function getSuggestedRolesCount(boardId, n) {
    const bundle = getBoardBundle(boardId);
    // 如果 boards 有 preset 就用
    const preset = bundle?.board?.presets?.[n];
    if (preset && typeof preset === "object") return structuredClone(preset);
    return boardId === "b1" ? suggestB1ConfigByCount(n) : suggestBasicConfigByCount(n);
  }

  function rolesTotal(map) {
    return Object.values(map || {}).reduce((a,b)=>a+(Number(b)||0),0);
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

    // 防 iOS 長按選字（只對這顆按鈕）
    stopTextSelectOnTouch(btn);

    // 先清理舊 handler（避免重複綁）
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
      // 不自動進夜，改成等你按「全部抽完→確認」
      State.dealIndex = State.players.length - 1;
      renderDeal();
      navigator.vibrate?.([60,40,60]);
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
    return State.players.some(p => p.roleId === roleId);
  }

  function buildFallbackNightSteps() {
    // 依照場上有的角色生成基本夜晚流程
    const steps = [];
    steps.push({ key:"close", type:"info", publicScript:"天黑請閉眼。", godScript:"天黑請閉眼。" });

    if (hasRole("guard")) {
      steps.push({ key:"guard", type:"pick", pickKey:"guardTarget", required:true, publicScript:"守衛請睜眼，請守一位玩家。", godScript:"守衛守誰？（點座位）" });
    }

    // 狼刀（允許空刀：wolfCanNoKill）
    steps.push({ key:"wolf", type:"pick", pickKey:"wolfTarget", required: !State.settings.wolfCanNoKill, allowNull: !!State.settings.wolfCanNoKill,
      publicScript: State.settings.wolfCanNoKill ? "狼人請睜眼（可空刀），請選擇目標。":"狼人請睜眼，請選擇目標。",
      godScript: State.settings.wolfCanNoKill ? "狼人刀誰？（可不選=空刀）" : "狼人刀誰？（必選）"
    });

    if (hasRole("seer")) {
      steps.push({ key:"seer", type:"pick", pickKey:"seerCheck", required:true, publicScript:"預言家請睜眼，請查驗一位玩家。", godScript:"預言家查誰？（點座位）" });
    }

    if (hasRole("witch")) {
      steps.push({ key:"witch", type:"witch", publicScript:"女巫請睜眼（上帝操作）。", godScript:"女巫回合：請操作救/毒。" });
    }

    steps.push({ key:"resolve", type:"resolve", publicScript:"天亮請睜眼。", godScript:"天亮：結算夜晚並公告。" });
    return steps;
  }

  function resolveNightStepsForThisGame() {
    const bundle = getBoardBundle(getBoardIdFromUI());
    let steps = bundle?.nightSteps;

    // steps 可能是函式（依玩家/狀態產生）
    if (typeof steps === "function") {
      try { steps = steps(State.players, State.nightState); } catch(e){ steps = null; }
    }

    // 如果是 WW_DATA.nightSteps 物件結構，或空陣列，就 fallback
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

      // iOS 防長按
      stopTextSelectOnTouch(b);

      b.onclick = () => {
        if (!p.alive) return;
        onPick?.(p.seat);
      };
      box.appendChild(b);
    });
  }

  function getCurrentNightStep() {
    return State.nightSteps?.[State.nightStepIndex] || null;
  }

  function renderNight() {
    $("nightTag") && ($("nightTag").textContent = `第 ${State.nightNo} 夜`);

    if (!State.nightSteps || State.nightSteps.length === 0) {
      $("nightScript") && ($("nightScript").textContent = "（夜晚流程缺少 nightSteps，已啟用內建流程）");
      resolveNightStepsForThisGame();
    }

    const step = getCurrentNightStep();
    if (!step) {
      $("nightScript") && ($("nightScript").textContent = "（夜晚流程結束）");
      return;
    }

    const script = State.godView ? (step.godScript || step.publicScript) : (step.publicScript || step.godScript);
    $("nightScript") && ($("nightScript").textContent = script || "（無台詞）");

    // 座位圈點選
    renderSeats("nightSeats", (seat) => {
      if (!step) return;

      // 女巫毒：如果正在選毒目標
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
      if (step.type === "seer" && step.pickKey) {
        State.nightState[step.pickKey] = seat;
        save();
        renderNight();
      }
    });
  }

  function canGoNextNightStep(step) {
    if (!step) return false;
    if (step.type === "pick" && step.required && step.pickKey) {
      // allowNull 的步驟可以不選
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

    // 你需求：解藥已用過 → 不顯示刀口，只能選毒
    const showKnife = !saveUsed;

    if (knifeEl) {
      knifeEl.innerHTML = showKnife ? (knifeSeat ? `${knifeSeat} 號` : "（狼人尚未選刀）") : "（解藥已用過，不提供刀口）";
    }

    if (statusEl) {
      const parts = [];
      parts.push(`解藥：${saveUsed ? "已用過" : (showKnife ? "可用" : "已用過")}`);
      parts.push(`毒藥：${poisonUsed ? "已用過" : "可用"}`);
      if (State.witch.poisonTarget) parts.push(`已選毒：${State.witch.poisonTarget} 號`);
      statusEl.textContent = parts.join("｜");
    }

    // 按鈕狀態
    const btnSave = $("btnWitchSave");
    const btnNoSave = $("btnWitchNoSave");
    const btnPickPoison = $("btnWitchPoisonPick");
    const btnNoPoison = $("btnWitchNoPoison");

    if (btnSave) {
      btnSave.disabled = saveUsed || !showKnife || !knifeSeat;
      btnSave.textContent = State.witch.save ? "✅ 已選擇用解藥" : "用解藥救";
    }
    if (btnNoSave) {
      btnNoSave.disabled = !showKnife; // 解藥用過就不談救
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

    // 女巫步驟：開面板（上帝視角才能操作）
    if (step.type === "witch") {
      if (!State.godView) {
        alert("需要切換 🔓 上帝視角 才能操作女巫");
        return;
      }
      openWitchModal();
      return;
    }

    // resolve
    if (step.type === "resolve") {
      resolveNight();
      return;
    }

    State.nightStepIndex = Math.min(State.nightSteps.length - 1, State.nightStepIndex + 1);
    save();
    renderNight();
  }

  /* ---------------------------
     Resolve night (用 rules，有問題就 fallback)
  --------------------------- */
  function resolveNight() {
    const bundle = getBoardBundle(getBoardIdFromUI());
    const rules = bundle?.rules || null;

    // 先把女巫操作寫回 nightState（給 rules 用）
    State.nightState.witchSave = !!State.witch.save;
    State.nightState.witchPoisonTarget = State.witch.poisonTarget || null;
    State.nightState.witchSaveUsed = !!State.witch.saveUsed;
    State.nightState.witchPoisonUsed = !!State.witch.poisonUsed;

    let publicText = "";
    let hiddenText = "";
    let resolved = null;

    const settings = State.settings || {};

    // ---- 尝试用 rules
    if (rules?.resolveNight && rules?.buildAnnouncement) {
      try {
        resolved = rules.resolveNight({
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
      // ---- fallback：簡化公告（不結算死亡，至少流程不斷）
      publicText = "天亮了。（目前未接上完整 rules，暫不結算死亡）";
      hiddenText = State.godView ? `（上帝）nightState=${JSON.stringify(State.nightState)}` : "";
    }

    // ---- 用藥消耗鎖定（你的需求：用過就永遠不能再用）
    if (State.witch.save) State.witch.saveUsed = true;
    if (State.witch.poisonTarget) State.witch.poisonUsed = true;

    // push log
    State.logs.unshift({
      nightNo: State.nightNo,
      dayNo: State.dayNo,
      publicText,
      hiddenText,
      ts: new Date().toISOString()
    });

    save();

    // 進白天
    showScreen("day");
    renderDayAlive();

    // 必跳公告
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
      box.textContent = State.godView ? (l.publicText + "\n\n" + (l.hiddenText || "")) : l.publicText;
      return;
    }

    // history
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

    // 重置夜晚狀態
    State.nightState = {};
    State.nightStepIndex = 0;
    State._pickPoisonMode = false;

    // 女巫每晚重新選（但用藥是否已用過保留）
    State.witch.save = false;
    State.witch.poisonTarget = null;

    resolveNightStepsForThisGame();
    save();
    showScreen("night");
    renderNight();
  }

  /* ---------------------------
     God toggle + restart button
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
     Setup actions
  --------------------------- */
  function setBoard(boardId) {
    State.boardId = boardId;
    $("boardBasic")?.classList.toggle("active", boardId === "basic");
    $("boardSpecial")?.classList.toggle("active", boardId === "b1");
    // 切板子 → 重新套建議配置
    State.rolesCount = getSuggestedRolesCount(boardId, State.playerCount);
    syncSetupUI();
  }

  function setPlayerCount(n) {
    const v = Math.max(6, Math.min(12, Number(n) || 9));
    State.playerCount = v;
    const range = $("rangeCount");
    if (range) range.value = String(v);
    // 變更人數 → 重新套建議配置
    State.rolesCount = getSuggestedRolesCount(State.boardId, v);
    syncSetupUI();
  }

  function startGame() {
    // 先驗 WW_DATA / roles 是否存在
    const WW = getWW();
    if (!WW) {
      alert("❌ 找不到 WW_DATA（請確認 data/ww.data.js 有載入，且路徑正確）");
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
     Role config modal (簡版)
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

    // 常用角色放前面
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

  /* ---------------------------
     Bind events (index.html ids)
  --------------------------- */
  function bind() {
    ensureRestart