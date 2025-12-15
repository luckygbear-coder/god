/* =========================================================
   狼人殺｜上帝輔助 PWA（app.js 瘦身版）
   依賴：data/ww.data.js 載入完成後提供 WW_DATA
========================================================= */

(() => {
  const $ = (id) => document.getElementById(id);
  const qs = (sel) => document.querySelector(sel);
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const nowISO = () => new Date().toISOString();

  /* =========================
     iOS 防長按選字 / 放大
  ========================= */
  try {
    document.documentElement.style.webkitUserSelect = "none";
    document.documentElement.style.userSelect = "none";
    document.documentElement.style.webkitTouchCallout = "none";
  } catch (e) {}
  const preventLongPress = (el) => {
    if (!el) return;
    el.addEventListener("touchstart", (e) => {
      // 防止 iOS 放大/選字（注意：需要 passive:false）
      e.preventDefault();
    }, { passive: false });
  };

  /* =========================
     Storage
  ========================= */
  const STORAGE_KEY = "ww_pwa_v1_rebuild";
  const load = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  };
  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(State));
    } catch (e) {}
  };
  const clearSave = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  };

  /* =========================
     Data Hub
  ========================= */
  const DATA = window.WW_DATA;
  if (!DATA) {
    alert("缺少 data/ww.data.js（WW_DATA）");
    return;
  }

  const ROLES = DATA.roles || {};
  const BOARDS = DATA.boards || {};
  const ENGINES = DATA.engines || {};
  const WIN_ENGINE = DATA.engines?.win || window.WW_WIN_ENGINE;

  const roleInfo = (roleId) => ROLES[roleId] || { id: roleId, name: roleId, camp: "villager", icon: "❔" };

  /* =========================
     State
  ========================= */
  const DEFAULT_RULES = {
    noConsecutiveGuard: true,
    wolfCanSkip: true,
    witchCannotSelfSave: true,
    hunterPoisonNoShoot: true,
    blackWolfKingPoisonNoSkill: true,
    guardAndSaveNoPeaceNight: false
  };

  const FreshState = () => ({
    // view
    screen: "setup",
    godUnlocked: false,
    godView: false,
    pin: "0000",

    // setup
    boardType: "basic",
    playerCount: 9,
    rolesCount: {},

    // rules toggles
    settings: { rules: { ...DEFAULT_RULES } },

    // game
    players: [],
    deal: {
      idx: 1,           // current seat for pass&play
      revealedSeat: null
    },
    dayNo: 1,
    nightNo: 1,

    // meta for special board
    meta: {
      lovers: null // [a,b] if cupid used later
    },

    // night state (generic)
    night: {},

    // steps (from night steps data)
    nightWizard: {
      steps: [],
      i: 0
    },

    // logs
    logs: [], // newest first {ts, nightNo, dayNo, publicText, hiddenText, actions}
  });

  let State = FreshState();

  // load persisted
  const saved = load();
  if (saved && typeof saved === "object" && Array.isArray(saved.players)) {
    State = Object.assign(FreshState(), saved);
    State.settings = State.settings || { rules: {} };
    State.settings.rules = Object.assign({ ...DEFAULT_RULES }, State.settings.rules || {});
    State.logs = Array.isArray(State.logs) ? State.logs : [];
  }

  /* =========================
     UI helpers
  ========================= */
  const Screens = {
    setup: $("screen-setup"),
    deal: $("screen-deal"),
    night: $("screen-night"),
    day: $("screen-day")
  };

  function showScreen(name) {
    Object.values(Screens).forEach(s => s && s.classList.remove("active"));
    Screens[name]?.classList.add("active");
    State.screen = name;
    save();
    renderTopBadges();
  }

  function renderTopBadges() {
    const nightTag = $("nightTag");
    const dayTag = $("dayTag");
    if (nightTag) nightTag.textContent = `第 ${State.nightNo} 夜`;
    if (dayTag) dayTag.textContent = `第 ${State.dayNo} 天`;
  }

  /* =========================
     God View
  ========================= */
  const btnGodToggle = $("btnGodToggle");
  const fabGod = $("fabGod");
  function setGodView(on) {
    State.godView = !!on;
    document.body.classList.toggle("god-on", State.godView);
    if (btnGodToggle) btnGodToggle.textContent = State.godView ? "🔓" : "🔒";
    if (fabGod) fabGod.textContent = State.godView ? "🔓" : "🔒";
    save();
    renderAnnouncementText();
  }

  function openGodModal() {
    const m = $("modalGod");
    if (!m) return;
    $("pinInput") && ($("pinInput").value = "");
    $("pinWarn")?.classList.add("hidden");
    m.classList.remove("hidden");
    $("pinInput")?.focus?.();
  }

  function toggleGod() {
    if (State.godView) return setGodView(false);
    if (State.godUnlocked) return setGodView(true);
    openGodModal();
  }

  on(btnGodToggle, "click", toggleGod);
  on(fabGod, "click", toggleGod);
  on($("closeGod"), "click", () => $("modalGod")?.classList.add("hidden"));
  on($("pinCancel"), "click", () => $("modalGod")?.classList.add("hidden"));
  on($("pinOk"), "click", () => {
    const v = ($("pinInput")?.value || "").trim();
    if (v === State.pin) {
      State.godUnlocked = true;
      $("modalGod")?.classList.add("hidden");
      setGodView(true);
    } else {
      $("pinWarn")?.classList.remove("hidden");
    }
  });

  /* =========================
     Announcement Center
  ========================= */
  const modalAnn = $("modalAnn");
  const annBox = $("annBox");
  let annMode = "today"; // today|history

  function getTodayLog() {
    return State.logs[0] || null;
  }

  function renderAnnouncementText() {
    if (!annBox) return;

    if (annMode === "today") {
      const l = getTodayLog();
      if (!l) return (annBox.textContent = "（尚無公告）");
      annBox.textContent = State.godView
        ? (l.publicText + (l.hiddenText ? "\n\n" + l.hiddenText : ""))
        : l.publicText;
      return;
    }

    if (!State.logs.length) {
      annBox.textContent = "（尚無歷史公告）";
      return;
    }

    const lines = [];
    // oldest last
    for (let i = State.logs.length - 1; i >= 0; i--) {
      const l = State.logs[i];
      lines.push(`— 第${l.nightNo}夜 / 第${l.dayNo}天 —`);
      lines.push(l.publicText || "—");
      if (State.godView && l.hiddenText) lines.push(l.hiddenText);
      lines.push("");
    }
    annBox.textContent = lines.join("\n");
  }

  function openAnn(mode = "today") {
    if (!modalAnn) return;
    annMode = mode;
    $("annToday")?.classList.toggle("active", annMode === "today");
    $("annHistory")?.classList.toggle("active", annMode === "history");
    modalAnn.classList.remove("hidden");
    renderAnnouncementText();
  }

  on($("btnOpenAnnouncement"), "click", () => openAnn("today"));
  on($("fabAnn"), "click", () => openAnn("today"));
  on($("closeAnn"), "click", () => modalAnn?.classList.add("hidden"));
  on($("annToday"), "click", () => openAnn("today"));
  on($("annHistory"), "click", () => openAnn("history"));

  on($("btnCopyAnn"), "click", async () => {
    try {
      await navigator.clipboard.writeText(annBox?.textContent || "");
      alert("已複製公告");
    } catch (e) {
      alert("複製失敗（可能需要 HTTPS / 已安裝 PWA）");
    }
  });

  /* =========================
     Export JSON (Replay)
  ========================= */
  function downloadJSON(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 800);
  }

  on($("btnExport"), "click", () => {
    const payload = {
      exportedAt: nowISO(),
      includeSecrets: State.godView,
      state: State
    };
    downloadJSON(`狼人殺復盤_${Date.now()}.json`, payload);
  });

  /* =========================
     Restart button (🔁)
  ========================= */
  function ensureRestartBtn() {
    const top = qs(".top-actions");
    if (!top) return;

    if ($("btnRestart")) return;

    const b = document.createElement("button");
    b.id = "btnRestart";
    b.className = "iconbtn";
    b.type = "button";
    b.title = "重新開始";
    b.textContent = "🔁";
    b.onclick = () => {
      if (!confirm("確定要重新開始？（會清除本局存檔與紀錄）")) return;
      clearSave();
      State = FreshState();
      applyBoardPreset();
      save();
      location.reload();
    };

    top.insertBefore(b, top.firstChild);
  }

  /* =========================
     Setup: board + presets
  ========================= */
  const elPlayerCount = $("playerCount");
  const elRoleTotal = $("roleTotal");
  const elPlayerTotal = $("playerTotal");
  const warnRoleTotal = $("warnRoleTotal");
  const rangeCount = $("rangeCount");

  function rolesTotal() {
    return Object.values(State.rolesCount || {}).reduce((a, b) => a + (b || 0), 0);
  }

  function applyBoardPreset() {
    const board = BOARDS[State.boardType];
    if (!board) return;

    const n = State.playerCount;
    const preset = typeof board.getPreset === "function"
      ? board.getPreset(n)
      : (board.presets?.[n] ? { ...board.presets[n] } : {});

    State.rolesCount = preset;
    save();
  }

  function syncSetupUI() {
    const rt = rolesTotal();
    elPlayerCount && (elPlayerCount.textContent = String(State.playerCount));
    elRoleTotal && (elRoleTotal.textContent = String(rt));
    elPlayerTotal && (elPlayerTotal.textContent = String(State.playerCount));
    rangeCount && (rangeCount.value = String(State.playerCount));

    const ok = rt === State.playerCount;
    warnRoleTotal?.classList.toggle("hidden", ok);

    const startBtn = $("btnStart");
    if (startBtn) {
      startBtn.disabled = !ok;
      startBtn.textContent = ok ? "開始 → 抽身分" : "⚠️ 角色數需等於玩家數";
    }
    save();
  }

  on($("btnPlus"), "click", () => {
    State.playerCount = clamp(State.playerCount + 1, 6, 12);
    applyBoardPreset();
    syncSetupUI();
  });

  on($("btnMinus"), "click", () => {
    State.playerCount = clamp(State.playerCount - 1, 6, 12);
    applyBoardPreset();
    syncSetupUI();
  });

  on(rangeCount, "input", (e) => {
    State.playerCount = clamp(Number(e.target.value), 6, 12);
    applyBoardPreset();
    syncSetupUI();
  });

  on($("boardBasic"), "click", () => {
    State.boardType = "basic";
    $("boardBasic")?.classList.add("active");
    $("boardSpecial")?.classList.remove("active");
    applyBoardPreset();
    syncSetupUI();
  });

  on($("boardSpecial"), "click", () => {
    State.boardType = "b1";
    $("boardSpecial")?.classList.add("active");
    $("boardBasic")?.classList.remove("active");
    applyBoardPreset();
    syncSetupUI();
  });

  on($("btnSuggest"), "click", () => {
    applyBoardPreset();
    syncSetupUI();
  });

  /* =========================
     Role config modal (simple)
  ========================= */
  const modalRole = $("modalRole");
  const roleConfigBody = $("roleConfigBody");

  function renderRoleConfig() {
    if (!roleConfigBody) return;
    roleConfigBody.innerHTML = "";

    const board = BOARDS[State.boardType];
    const pool = board?.rolesPool || Object.keys(ROLES);

    const tip = document.createElement("div");
    tip.className = "hint";
    tip.style.marginBottom = "10px";
    tip.textContent = "角色總數必須等於玩家人數才能開始。";
    roleConfigBody.appendChild(tip);

    pool.forEach((rid) => {
      const info = roleInfo(rid);
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
      row.style.gap = "10px";
      row.style.padding = "10px 4px";
      row.style.borderBottom = "1px dashed rgba(0,0,0,.08)";

      const left = document.createElement("div");
      left.style.fontWeight = "900";
      left.textContent = `${info.icon ? info.icon + " " : ""}${info.name}`;

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
      num.textContent = String(State.rolesCount[rid] ?? 0);

      const plus = document.createElement("button");
      plus.type = "button";
      plus.className = "btn ghost tiny";
      plus.textContent = "＋";

      minus.onclick = () => {
        State.rolesCount[rid] = Math.max(0, (State.rolesCount[rid] || 0) - 1);
        num.textContent = String(State.rolesCount[rid] || 0);
        syncSetupUI();
      };
      plus.onclick = () => {
        State.rolesCount[rid] = (State.rolesCount[rid] || 0) + 1;
        num.textContent = String(State.rolesCount[rid]);
        syncSetupUI();
      };

      right.append(minus, num, plus);
      row.append(left, right);
      roleConfigBody.appendChild(row);
    });
  }

  on($("btnOpenRoleConfig"), "click", () => {
    renderRoleConfig();
    modalRole?.classList.remove("hidden");
  });
  on($("closeRole"), "click", () => modalRole?.classList.add("hidden"));
  on($("roleReset"), "click", () => {
    applyBoardPreset();
    renderRoleConfig();
    syncSetupUI();
  });
  on($("roleApply"), "click", () => {
    modalRole?.classList.add("hidden");
    syncSetupUI();
  });

  /* =========================
     Build players + Deal flow
  ========================= */
  const dealText = $("dealText");
  const seatGrid = $("dealSeatGrid"); // (若 index.html 有) 座位快速回看
  const btnHoldReveal = $("btnHoldReveal");

  const modalReveal = $("modalReveal");
  const revealRole = $("revealRole");

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function buildPlayers() {
    const rolesArr = [];
    for (const [rid, cnt] of Object.entries(State.rolesCount)) {
      for (let i = 0; i < (cnt || 0); i++) rolesArr.push(rid);
    }
    shuffle(rolesArr);

    State.players = rolesArr.map((rid, idx) => {
      const info = roleInfo(rid);
      return {
        seat: idx + 1,
        roleId: rid,
        camp: info.camp || info.team || "villager",
        alive: true,
        isChief: false,
        flags: {} // future
      };
    });

    State.deal.idx = 1;
    State.deal.revealedSeat = null;

    State.logs = [];
    State.dayNo = 1;
    State.nightNo = 1;
    State.meta = State.meta || {};
    State.meta.lovers = null;

    save();
  }

  function updateDealPrompt() {
    const seat = State.deal.idx;
    if (dealText) {
      dealText.innerHTML = seat <= State.players.length
        ? `請 <b>${seat} 號</b> 拿手機（可點下方座位回看）`
        : "✅ 所有人都已看過身分";
    }
  }

  function renderDealSeatGrid() {
    if (!seatGrid) return;
    seatGrid.innerHTML = "";

    for (let s = 1; s <= State.players.length; s++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seat";
      b.textContent = String(s);
      if (s === State.deal.idx) b.classList.add("selected");

      b.onclick = () => {
        State.deal.idx = s;
        save();
        updateDealPrompt();
        renderDealSeatGrid();
      };

      seatGrid.appendChild(b);
    }
  }

  let holdTimer = null;
  function showRevealForSeat(seat) {
    const p = State.players.find(x => x.seat === seat);
    if (!p) return;

    State.deal.revealedSeat = seat;
    const info = roleInfo(p.roleId);

    if (revealRole) revealRole.textContent = `${info.icon ? info.icon + " " : ""}${info.name}`;
    modalReveal?.classList.remove("hidden");

    navigator.vibrate?.(50);
    save();
  }

  function hideReveal() {
    State.deal.revealedSeat = null;
    modalReveal?.classList.add("hidden");
    save();
  }

  function bindHoldToReveal() {
    if (!btnHoldReveal) return;

    preventLongPress(btnHoldReveal);

    const start = () => {
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => showRevealForSeat(State.deal.idx), 900); // 0.9s（更像手機）
    };
    const end = () => {
      clearTimeout(holdTimer);
      hideReveal();
    };

    on(btnHoldReveal, "touchstart", start, { passive: true });
    on(btnHoldReveal, "touchend", end);
    on(btnHoldReveal, "touchcancel", end);
    on(btnHoldReveal, "mousedown", start);
    on(btnHoldReveal, "mouseup", end);
    on(btnHoldReveal, "mouseleave", end);
  }

  on($("btnStart"), "click", () => {
    if (rolesTotal() !== State.playerCount) return;
    buildPlayers();
    showScreen("deal");
    updateDealPrompt();
    renderDealSeatGrid();
    save();
  });

  on($("btnDealBack"), "click", () => {
    hideReveal();
    showScreen("setup");
  });

  on($("btnNextPlayer"), "click", () => {
    hideReveal();
    State.deal.idx = clamp(State.deal.idx + 1, 1, State.players.length + 1);
    updateDealPrompt();
    renderDealSeatGrid();
    save();
  });

  // 抽完後「確認才進夜晚」
  on($("btnFinishDeal"), "click", () => {
    if (State.deal.idx <= State.players.length) {
      alert("還有人沒看身分，請先完成抽牌。");
      return;
    }
    openConfirmToNight();
  });

  /* =========================
     Confirm enter night modal
  ========================= */
  function openConfirmToNight() {
    const m = $("modalDealConfirm");
    if (!m) {
      // 若 index.html 沒做這個 modal，就用 confirm
      if (!confirm("確認全部人都看過身分？要進入夜晚嗎？")) return;
      startNight();
      return;
    }
    m.classList.remove("hidden");
  }

  on($("dealConfirmNo"), "click", () => $("modalDealConfirm")?.classList.add("hidden"));
  on($("dealConfirmYes"), "click", () => {
    $("modalDealConfirm")?.classList.add("hidden");
    startNight();
  });

  /* =========================
     Night Wizard
  ========================= */
  const nightScript = $("nightScript");
  const nightSeats = $("nightSeats");

  function getRulesForBoard() {
    return State.boardType === "b1" ? DATA.rules?.b1 : DATA.rules?.basic;
  }

  function getNightStepsForBoard() {
    return State.boardType === "b1" ? DATA.nightSteps?.b1 : DATA.nightSteps?.basic;
  }

  function resetNight() {
    State.night = {
      // common
      wolfTarget: null,
      guardTarget: null,
      seerCheckTarget: null,
      seerResult: null,

      // witch
      witchSave: false,
      witchPoisonTarget: null,
      witchSaveUsed: !!State.night?.witchSaveUsed,
      witchPoisonUsed: !!State.night?.witchPoisonUsed,

      // consecutive guard memory (store last guard)
      prevGuardTarget: State.night?.prevGuardTarget ?? null,

      // b1 extras
      gargoyleTarget: null
    };
  }

  function buildNightWizard() {
    resetNight();

    const stepsDef = getNightStepsForBoard();
    if (!stepsDef || !Array.isArray(stepsDef)) {
      alert("缺少 night steps 檔（data/night/night.steps.*.js）");
      return;
    }

    // 只保留該局存在的角色步驟
    const aliveRoleSet = new Set(State.players.map(p => p.roleId));
    const steps = stepsDef.filter(st => {
      if (st.requiresRole) return aliveRoleSet.has(st.requiresRole);
      return true;
    });

    State.nightWizard.steps = steps;
    State.nightWizard.i = 0;
    save();
  }

  function currentNightStep() {
    return State.nightWizard.steps[State.nightWizard.i] || null;
  }

  function renderSeatDots(container, selectedSeat, onPick) {
    if (!container) return;
    container.innerHTML = "";

    State.players.forEach(p => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seat" + (p.alive ? "" : " dead");
      b.textContent = String(p.seat);
      if (selectedSeat === p.seat) b.classList.add("selected");

      b.onclick = () => {
        if (!p.alive) return;
        onPick?.(p.seat);
      };

      container.appendChild(b);
    });
  }

  function scriptForStep(step) {
    if (!step) return "";

    const isGod = State.godView;
    let base = isGod ? (step.godScript || step.publicScript || "") : (step.publicScript || "");

    // 女巫：依你需求調整文案（刀口/用過藥）
    if (step.key === "witch") {
      if (!isGod) {
        return (base + "\n\n（提示）請切換到 🔓 上帝視角 才能操作女巫。").trim();
      }

      const wolfTarget = State.night.wolfTarget;
      const canSave = !State.night.witchSaveUsed;
      const canPoison = !State.night.witchPoisonUsed;

      // 解藥用過：不顯示刀口，只能毒
      if (!canSave) {
        base += `\n\n（女巫）解藥：已用過\n毒藥：${canPoison ? "可用" : "已用過"}`;
        base += `\n👉 下一步會開啟女巫彈窗（僅操作毒藥）。`;
        return base.trim();
      }

      // 解藥可用：顯示刀口
      base += `\n\n（女巫）今晚被刀：${wolfTarget ? wolfTarget + " 號" : "（狼人尚未選刀口）"}`;
      base += `\n解藥：可用｜毒藥：${canPoison ? "可用" : "已用過"}`;
      base += `\n👉 下一步會開啟女巫彈窗（先救→再決定是否毒）。`;
      return base.trim();
    }

    return base.trim();
  }

  function renderNight() {
    renderTopBadges();

    const step = currentNightStep();
    if (!step) {
      nightScript && (nightScript.textContent = "（夜晚流程結束）");
      return;
    }

    nightScript && (nightScript.textContent = scriptForStep(step));

    // seat picking
    renderSeatDots(nightSeats, null, (seat) => {
      // 不在 app.js 做規則，只寫選擇行為
      if (step.pickKey) {
        // guard consecutive restriction提示（規則在 engine/rules，但 UI 要防呆）
        if (step.pickKey === "guardTarget" && State.settings.rules.noConsecutiveGuard) {
          if (State.night.prevGuardTarget && State.night.prevGuardTarget === seat) {
            alert("規則：守衛不能連守同一人");
            return;
          }
        }

        State.night[step.pickKey] = seat;

        // seer result calc（純顯示，不影響規則）
        if (step.key === "seer" && step.pickKey === "seerCheckTarget") {
          const t = State.players.find(p => p.seat === seat);
          State.night.seerResult = (t?.camp === "wolf") ? "wolf" : "villager";
        }

        save();
        renderNight();
      }
    });
  }

  on($("btnNightPrev"), "click", () => {
    State.nightWizard.i = Math.max(0, State.nightWizard.i - 1);
    save();
    renderNight();
  });

  on($("btnNightNext"), "click", () => {
    const step = currentNightStep();
    if (!step) return;

    // required pick
    if (step.required && step.pickKey && !State.night[step.pickKey]) {
      navigator.vibrate?.([50, 30, 50]);
      return;
    }

    // witch panel
    if (step.key === "witch") {
      if (!State.godView) return alert("需要 🔓 上帝視角 才能操作女巫");
      openWitchPanel();
      return;
    }

    // resolve
    if (step.key === "resolve") {
      resolveNightToDay();
      return;
    }

    State.nightWizard.i = Math.min(State.nightWizard.steps.length - 1, State.nightWizard.i + 1);
    save();
    renderNight();
  });

  function startNight() {
    buildNightWizard();
    showScreen("night");
    renderNight();
    save();
  }

  /* =========================
     Witch Panel (符合你指定流程)
  ========================= */
  function openWitchPanel() {
    const m = $("modalWitch");
    if (!m) {
      // 若 index.html 沒放 witch modal，就退而求其次
      alert("缺少女巫彈窗（modalWitch）。我下一個可以補 index.html 的完整彈窗。");
      return;
    }

    const wolfTarget = State.night.wolfTarget;
    const canSave = !State.night.witchSaveUsed;
    const canPoison = !State.night.witchPoisonUsed;

    // UI 填充
    $("witchKnife") && ($("witchKnife").textContent =
      canSave ? (wolfTarget ? `${wolfTarget} 號` : "（尚未選刀口）") : "（解藥已用過，不顯示刀口）"
    );

    $("btnWitchSave") && ($("btnWitchSave").disabled = !canSave || !wolfTarget);
    $("btnWitchNoSave") && ($("btnWitchNoSave").disabled = !canSave);

    $("btnWitchPoisonPick") && ($("btnWitchPoisonPick").disabled = !canPoison);
    $("btnWitchNoPoison") && ($("btnWitchNoPoison").disabled = !canPoison);

    // 狀態提示
    $("witchStatus") && ($("witchStatus").textContent =
      `解藥：${State.night.witchSaveUsed ? "已用過" : "可用"}｜毒藥：${State.night.witchPoisonUsed ? "已用過" : "可用"}`
    );

    // 防止模式殘留
    State._witchPickPoison = false;

    m.classList.remove("hidden");
  }

  // 女巫：救/不救
  on($("btnWitchSave"), "click", () => {
    // 女巫不能自救（只做 UI 防呆，規則仍由 rules 判）
    if (State.settings.rules.witchCannotSelfSave) {
      const witchSeat = State.players.find(p => p.roleId === "witch")?.seat;
      if (witchSeat && State.night.wolfTarget === witchSeat) {
        alert("規則：女巫不能自救");
        // 仍允許玩家選擇，但會在 rules 判無效；這裡直接阻止更直覺
        return;
      }
    }
    State.night.witchSave = true;
    save();
    // 接著讓玩家決定要不要毒（不自動關閉）
    $("witchStepHint") && ($("witchStepHint").textContent = "已選擇救人。接著可選擇：要不要使用毒藥？");
  });

  on($("btnWitchNoSave"), "click", () => {
    State.night.witchSave = false;
    save();
    $("witchStepHint") && ($("witchStepHint").textContent = "不使用解藥。接著可選擇：要不要使用毒藥？");
  });

  // 女巫：毒（點座位）
  on($("btnWitchPoisonPick"), "click", () => {
    State._witchPickPoison = true;
    save();
    alert("請在夜晚座位圈上點選要毒的人（點完會自動回到女巫彈窗）");
    $("modalWitch")?.classList.add("hidden");
  });

  on($("btnWitchNoPoison"), "click", () => {
    State.night.witchPoisonTarget = null;
    State._witchPickPoison = false;
    save();
    $("witchStepHint") && ($("witchStepHint").textContent = "不使用毒藥。");
  });

  on($("btnWitchDone"), "click", () => {
    $("modalWitch")?.classList.add("hidden");
    // 前進到下一步
    State.nightWizard.i = Math.min(State.nightWizard.steps.length - 1, State.nightWizard.i + 1);
    save();
    renderNight();
  });

  // night seat click support poison pick
  function bindNightSeatPoisonPick() {
    if (!nightSeats) return;
    nightSeats.addEventListener("click", (e) => {
      const btn = e.target?.closest?.(".seat");
      if (!btn) return;
      if (!State._witchPickPoison) return;

      const seat = Number(btn.textContent);
      if (!seat || !State.players.find(p => p.seat === seat && p.alive)) return;

      // 不允許毒自己?（桌規不一致，先不限制）
      State.night.witchPoisonTarget = seat;
      State._witchPickPoison = false;
      save();

      // 回到女巫彈窗
      openWitchPanel();
      $("witchStepHint") && ($("witchStepHint").textContent = `已選擇毒 ${seat} 號。`);
    });
  }

  /* =========================
     Resolve night -> Day
  ========================= */
  function pushLog({ publicText, hiddenText, actions }) {
    State.logs.unshift({
      ts: nowISO(),
      nightNo: State.nightNo,
      dayNo: State.dayNo,
      publicText,
      hiddenText,
      actions: actions || null
    });
    save();
  }

  function resolveNightToDay() {
    const rules = getRulesForBoard();
    if (!rules?.resolveNight || !rules?.buildAnnouncement) {
      alert("缺少 rules 檔（data/rules/rules.*.js）");
      return;
    }

    // 交給 rules 結算（會直接改 players 的 alive）
    const resolved = rules.resolveNight({
      players: State.players,
      night: State.night,
      settings: State.settings.rules,
      stateMeta: State.meta
    });

    // 用藥鎖定（只做狀態保存，不做規則）
    if (State.night.witchSave) State.night.witchSaveUsed = true;
    if (State.night.witchPoisonTarget) State.night.witchPoisonUsed = true;

    // 記錄守衛，供不能連守
    State.night.prevGuardTarget = resolved?.meta?.guardTargetRaw ?? State.night.guardTarget ?? State.night.prevGuardTarget;

    const ann = rules.buildAnnouncement({
      nightNo: State.nightNo,
      dayNo: State.dayNo,
      players: State.players,
      night: State.night,
      resolved,
      settings: State.settings.rules
    });

    pushLog({
      publicText: ann.publicText,
      hiddenText: ann.hiddenText,
      actions: { night: { ...State.night }, resolvedMeta: resolved?.meta || null }
    });

    // 勝負判定（交給 win.engine + rules checkWin）
    const win = WIN_ENGINE?.checkWin
      ? WIN_ENGINE.checkWin({ boardType: State.boardType, players: State.players, stateMeta: State.meta })
      : (rules.checkWin ? rules.checkWin(State.players, State.meta) : { ended: false });

    if (win?.ended) {
      const msg = WIN_ENGINE?.formatWinText ? WIN_ENGINE.formatWinText(win) : `遊戲結束：${win.winner}`;
      alert(msg);
      // 照樣進入 day 畫面，方便看公告/復盤
    }

    // 進入白天
    showScreen("day");
    renderDay();
    openAnn("today");
    save();
  }

  /* =========================
     Day flow (最小可用：公告→下一夜)
     你要的投票/上警會在後續 day.engine + UI 檔分批補回來
  ========================= */
  function renderDay() {
    renderTopBadges();

    // 你如果 index.html 有 dayAliveList 可顯示存活
    const aliveBox = $("dayAlive");
    if (aliveBox) {
      const alive = State.players.filter(p => p.alive).map(p => `${p.seat}號`).join("、") || "—";
      aliveBox.textContent = `存活：${alive}`;
    }
  }

  // 白天下一步 → 下一夜（延續到遊戲結束）
  on($("btnDayNext"), "click", () => {
    // 下一夜
    State.nightNo += 1;
    State.dayNo += 1;
    save();
    startNight();
  });

  /* =========================
     Boot
  ========================= */
  function boot() {
    ensureRestartBtn();

    // 初次若沒有 rolesCount，依板子套 preset
    if (!State.rolesCount || !Object.keys(State.rolesCount).length) {
      applyBoardPreset();
      save();
    }

    setGodView(!!State.godView);
    bindHoldToReveal();
    bindNightSeatPoisonPick();

    // 防 iOS 長按選字（可加到更多按鈕）
    preventLongPress(btnHoldReveal);
    preventLongPress($("btnNightNext"));
    preventLongPress($("btnNightPrev"));

    syncSetupUI();

    // restore screen
    if (State.screen && Screens[State.screen]) showScreen(State.screen);
    else showScreen("setup");

    if (State.screen === "deal") {
      updateDealPrompt();
      renderDealSeatGrid();
    }
    if (State.screen === "night") {
      if (!State.nightWizard.steps?.length) buildNightWizard();
      renderNight();
    }
    if (State.screen === "day") {
      renderDay();
    }
  }

  boot();

})();