/* =========================================================
   狼人殺｜上帝輔助 PWA
   app.js（穩定容錯 + 可用版）
   Fix:
   - Role modal 可捲、可關閉
   - 白天座位點選會變色（投票/標記）
   - 底部按鈕 / 事件全數綁定
   - 不依賴 ww.data.js 也能跑（有 WW_DATA 就用）
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
      noConsecutiveGuard: true,
      wolfCanNoKill: true,
      witchCannotSelfSave: true,
      hunterPoisonNoShoot: true,
      blackWolfKingPoisonNoSkill: true,
    },

    /* ✅ 白天互動 */
    dayMode: "vote",         // vote | mark
    dayPickSeat: null        // 投票圈選顯示用
  };

  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(State)); } catch(e){} }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s && typeof s === "object") Object.assign(State, s);
    } catch(e){}
  }
  function clearSave() { try { localStorage.removeItem(STORAGE_KEY); } catch(e){} }

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
     Data (WW_DATA if exists)
  --------------------------- */
  function getWW() { return window.WW_DATA || null; }

  function mergeMaps(...maps){
    const out = {};
    maps.forEach(m => {
      if (!m) return;
      Object.keys(m).forEach(k => out[k] = m[k]);
    });
    return out;
  }

  function getRolesMap() {
    const WW = getWW();
    if (WW?.roles) return WW.roles;

    // fallback：如果你有放 roles.js（根目錄）或 data/roles/*.js 沒掛上 WW_DATA 時，給基本內建
    return {
      villager: { id:"villager", name:"村民", icon:"👤", team:"villager" },
      werewolf: { id:"werewolf", name:"狼人", icon:"🐺", team:"wolf" },
      seer:     { id:"seer", name:"預言家", icon:"🔮", team:"villager" },
      witch:    { id:"witch", name:"女巫", icon:"🧪", team:"villager" },
      hunter:   { id:"hunter", name:"獵人", icon:"🏹", team:"villager" },
      guard:    { id:"guard", name:"守衛", icon:"🛡️", team:"villager" },
      knight:   { id:"knight", name:"騎士", icon:"⚔️", team:"villager" },
      blackWolfKing:{ id:"blackWolfKing", name:"黑狼王", icon:"🐺👑", team:"wolf" },
      whiteWolfKing:{ id:"whiteWolfKing", name:"白狼王", icon:"🐺🤍", team:"wolf" },
    };
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
    // fallback: minimal board
    return {
      board: { id: boardId, name: boardId === "b1" ? "特殊板子B1" : "基本板子" },
      rules: null,
      nightSteps: null
    };
  }

  /* ---------------------------
     Setup suggestions
  --------------------------- */
  function suggestBasicConfigByCount(n) {
    const wolves = n >= 10 ? 3 : 2;
    const fixed = 3; // seer+witch+hunter
    const villager = Math.max(0, n - wolves - fixed);
    return { werewolf: wolves, villager, seer: 1, witch: 1, hunter: 1 };
  }
  function suggestB1ConfigByCount(n) {
    const base = { villager: 0, werewolf: 0, seer: 1, witch: 1, hunter: 1, guard: 1, knight: 1, blackWolfKing: 1, whiteWolfKing: 1 };
    const wolves = n >= 11 ? 3 : 2;
    base.werewolf = Math.max(0, wolves - 2);
    const fixed = base.seer + base.witch + base.hunter + base.guard + base.knight + base.blackWolfKing + base.whiteWolfKing + base.werewolf;
    base.villager = Math.max(0, n - fixed);
    return base;
  }
  function getSuggestedRolesCount(boardId, n) {
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
      return { seat: idx + 1, roleId: rid, name: r.name || rid, icon: r.icon || "❔", team: r.team || "villager", alive: true };
    });

    State.dealIndex = 0;
    State.nightNo = 1;
    State.dayNo = 1;
    State.logs = [];
    State.nightState = {};
    State.nightSteps = [];
    State.nightStepIndex = 0;
    State.dayMode = "vote";
    State.dayPickSeat = null;

    State.witch = State.witch || { saveUsed:false, poisonUsed:false, save:false, poisonTarget:null };
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
      stopTextSelectOnTouch(b);
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

    stopTextSelectOnTouch(btn);
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

  function openDealConfirm() { $("modalDealConfirm")?.classList.remove("hidden"); }
  function closeDealConfirm() { $("modalDealConfirm")?.classList.add("hidden"); }

  /* ---------------------------
     Night fallback steps
  --------------------------- */
  function hasRole(roleId) { return State.players.some(p => p.roleId === roleId); }

  function buildFallbackNightSteps() {
    const steps = [];
    steps.push({ key:"close", type:"info", publicScript:"天黑請閉眼。", godScript:"天黑請閉眼。" });

    if (hasRole("guard")) {
      steps.push({ key:"guard", type:"pick", pickKey:"guardTarget", required:true,
        publicScript:"守衛請睜眼，請守一位玩家。", godScript:"守衛守誰？（點座位）" });
    }

    steps.push({ key:"wolf", type:"pick", pickKey:"wolfTarget",
      required: !State.settings.wolfCanNoKill, allowNull: !!State.settings.wolfCanNoKill,
      publicScript: State.settings.wolfCanNoKill ? "狼人請睜眼（可空刀），請選擇目標。":"狼人請睜眼，請選擇目標。",
      godScript: State.settings.wolfCanNoKill ? "狼人刀誰？（可不選=空刀）" : "狼人刀誰？（必選）"
    });

    if (hasRole("seer")) {
      steps.push({ key:"seer", type:"pick", pickKey:"seerCheck", required:true,
        publicScript:"預言家請睜眼，請查驗一位玩家。", godScript:"預言家查誰？（點座位）" });
    }

    if (hasRole("witch")) {
      steps.push({ key:"witch", type:"witch", publicScript:"女巫請睜眼（上帝操作）。", godScript:"女巫回合：請操作救/毒。" });
    }

    steps.push({ key:"resolve", type:"resolve", publicScript:"天亮請睜眼。", godScript:"天亮：結算夜晚並公告。" });
    return steps;
  }

  function resolveNightStepsForThisGame() {
    const bundle = getBoardBundle(State.boardId);
    let steps = bundle?.nightSteps;

    if (typeof steps === "function") {
      try { steps = steps(State.players, State.nightState); } catch(e){ steps = null; }
    }
    if (!Array.isArray(steps) || steps.length === 0) steps = buildFallbackNightSteps();

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

      stopTextSelectOnTouch(b);
      b.onclick = () => { if (p.alive) onPick?.(p.seat); };

      box.appendChild(b);
    });
  }

  function getCurrentNightStep() { return State.nightSteps?.[State.nightStepIndex] || null; }

  function renderNight() {
    $("nightTag") && ($("nightTag").textContent = `第 ${State.nightNo} 夜`);

    if (!State.nightSteps || State.nightSteps.length === 0) resolveNightStepsForThisGame();

    const step = getCurrentNightStep();
    if (!step) {
      $("nightScript") && ($("nightScript").textContent = "（夜晚流程結束）");
      return;
    }

    const script = State.godView ? (step.godScript || step.publicScript) : (step.publicScript || step.godScript);
    $("nightScript") && ($("nightScript").textContent = script || "（無台詞）");

    renderSeats("nightSeats", (seat) => {
      // 女巫選毒目標模式
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
    }, (step.type === "pick" && step.pickKey) ? (State.nightState[step.pickKey] || null) : null);
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
      parts.push(`解藥：${saveUsed ? "已用過" : (showKnife ? "可用" : "已用過")}`);
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
     Resolve night (fallback stable)
  --------------------------- */
  function resolveNight() {
    // 寫回女巫
    State.nightState.witchSave = !!State.witch.save;
    State.nightState.witchPoisonTarget = State.witch.poisonTarget || null;

    // fallback 公告（你之後接 rules 也不會壞）
    const publicText = "天亮了。（目前使用穩定簡化規則：先不自動結算死亡，你可白天手動標記）";
    const hiddenText = State.godView ? `（上帝）nightState=${JSON.stringify(State.nightState)}` : "";

    if (State.witch.save) State.witch.saveUsed = true;
    if (State.witch.poisonTarget) State.witch.poisonUsed = true;

    State.logs.unshift({ nightNo: State.nightNo, dayNo: State.dayNo, publicText, hiddenText, ts: new Date().toISOString() });
    save();

    showScreen("day");
    renderDay();
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
     Day (✅ seat click color + mark mode)
  --------------------------- */
  function renderDayAlive() {
    const el = $("dayAlive");
    if (!el) return;
    const alive = State.players.filter(p => p.alive).map(p => p.seat);
    el.textContent = alive.length ? `存活：${alive.join("、")} 號` : "（全滅？）";
  }

  function renderDaySeats() {
    // 白天座位圈：可投票（點一下變色），或標記死亡/復活（切換模式）
    renderSeats("daySeats", (seat) => {
      if (State.dayMode === "mark") {
        const p = State.players.find(x => x.seat === seat);
        if (!p) return;
        p.alive = !p.alive;
        State.dayPickSeat = null;
        save();
        renderDay();
        return;
      }
      // vote mode
      State.dayPickSeat = (State.dayPickSeat === seat) ? null : seat;
      save();
      renderDaySeats();
    }, State.dayPickSeat);
  }

  function renderDay() {
    $("dayTag") && ($("dayTag").textContent = `第 ${State.dayNo} 天`);
    renderDayAlive();

    // 你 index.html 目前白天座位圈 id 叫什麼不一定，
    // 這裡保底：如果沒有 daySeats，就不炸
    if ($("daySeats")) renderDaySeats();
  }

  function nextDayToNight() {
    State.nightNo += 1;
    State.dayNo += 1;

    State.nightState = {};
    State.nightStepIndex = 0;
    State._pickPoisonMode = false;

    State.witch.save = false;
    State.witch.poisonTarget = null;

    State.dayMode = "vote";
    State.dayPickSeat = null;

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
    if (State.phase === "night") renderNight();
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
     Role config modal (✅ close + scroll)
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
     Setup actions
  --------------------------- */
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
     Bind events (✅ complete)
  --------------------------- */
  function bind() {
    ensureRestartButton();

    // Setup
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
    on($("btnStart"), "click", startGame);

    // Role modal
    on($("closeRole"), "click", closeRoleConfig);
    on($("roleApply"), "click", () => { closeRoleConfig(); syncSetupUI(); });
    on($("roleReset"), "click", () => { State.rolesCount = getSuggestedRolesCount(State.boardId, State.playerCount); openRoleConfig(); syncSetupUI(); });

    // Deal
    on($("btnDealBack"), "click", () => { showScreen("setup"); syncSetupUI(); });
    on($("btnNextPlayer"), "click", nextDeal);
    on($("btnFinishDeal"), "click", openDealConfirm);

    on($("dealConfirmNo"), "click", closeDealConfirm);
    on($("dealConfirmYes"), "click", () => {
      closeDealConfirm();
      resolveNightStepsForThisGame();
      showScreen("night");
      renderNight();
    });

    // Night
    on($("btnNightPrev"), "click", nightPrev);
    on($("btnNightNext"), "click", nightNext);

    // Witch modal actions (✅ 你卡住/按座位無反應：這裡補齊)
    on($("btnWitchSave"), "click", () => { State.witch.save = true; save(); renderWitchModal(); });
    on($("btnWitchNoSave"), "click", () => { State.witch.save = false; save(); renderWitchModal(); });

    on($("btnWitchPoisonPick"), "click", () => {
      if (State.witch.poisonUsed) return;
      State._pickPoisonMode = true; // 回座位圈點人
      $("modalWitch")?.classList.add("hidden");
      alert("請回到座位圈點選要毒的人");
    });
    on($("btnWitchNoPoison"), "click", () => { State.witch.poisonTarget = null; State._pickPoisonMode = false; save(); renderWitchModal(); });

    on($("btnWitchDone"), "click", () => {
      $("modalWitch")?.classList.add("hidden");
      // 女巫步驟完成 -> 進下一步
      State.nightStepIndex = Math.min(State.nightSteps.length - 1, State.nightStepIndex + 1);
      save();
      renderNight();
    });

    // Day
    on($("btnDayNext"), "click", nextDayToNight);

    // God toggle
    on($("btnGodToggle"), "click", toggleGod);
    on($("btnGodToggle2"), "click", toggleGod);
    on($("fabGod"), "click", toggleGod);

    // Announcement modal
    on($("btnOpenAnnouncement"), "click", () => openAnnouncementModal(true));
    on($("btnOpenAnnouncement2"), "click", () => openAnnouncementModal(true));
    on($("btnOpenAnnouncement3"), "click", () => openAnnouncementModal(true));
    on($("fabAnn"), "click", () => openAnnouncementModal(true));

    on($("closeAnn"), "click", () => $("modalAnn")?.classList.add("hidden"));
    on($("annToday"), "click", () => { annMode="today"; renderAnnouncement(); $("annToday")?.classList.add("active"); $("annHistory")?.classList.remove("active"); });
    on($("annHistory"), "click", () => { annMode="history"; renderAnnouncement(); $("annHistory")?.classList.add("active"); $("annToday")?.classList.remove("active"); });

    on($("btnCopyAnn"), "click", async () => {
      try{
        await navigator.clipboard.writeText($("annBox")?.textContent || "");
        alert("已複製");
      }catch(e){
        alert("複製失敗（iOS Safari 可能限制），你可手動全選複製");
      }
    });

    on($("btnExport"), "click", () => {
      const data = JSON.stringify({ logs: State.logs, state: State }, null, 2);
      const blob = new Blob([data], { type:"application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ww_export.json";
      a.click();
      URL.revokeObjectURL(url);
    });

    // God PIN modal (簡化：直接切換，不卡死)
    on($("closeGod"), "click", () => $("modalGod")?.classList.add("hidden"));
    on($("pinCancel"), "click", () => $("modalGod")?.classList.add("hidden"));
    on($("pinOk"), "click", () => {
      const v = ($("pinInput")?.value || "").trim();
      if (v === "0000" || v.length === 0) {
        $("modalGod")?.classList.add("hidden");
        setGod(true);
      } else {
        $("pinWarn")?.classList.remove("hidden");
      }
    });

    // open god modal
    on($("btnGodToggle"), "dblclick", () => { $("modalGod")?.classList.remove("hidden"); $("pinWarn")?.classList.add("hidden"); });
  }

  /* ---------------------------
     Boot
  --------------------------- */
  function boot() {
    load();
    ensureRestartButton();

    // 初始化預設
    if (!State.rolesCount) State.rolesCount = getSuggestedRolesCount(State.boardId, State.playerCount);

    // 安全：把 board 按鈕狀態對齊
    $("boardBasic")?.classList.toggle("active", State.boardId === "basic");
    $("boardSpecial")?.classList.toggle("active", State.boardId === "b1");

    setGod(State.godView);

    bind();
    syncSetupUI();

    // 恢復畫面
    showScreen(State.phase || "setup");
    if (State.phase === "deal") renderDeal();
    if (State.phase === "night") { if (!State.nightSteps?.length) resolveNightStepsForThisGame(); renderNight(); }
    if (State.phase === "day") renderDay();
  }

  boot();
})();