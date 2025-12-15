/* =========================================================
   狼人殺｜上帝輔助 PWA
   app.js（穩定修正版：不再卡「板子資料結構錯誤」）

   依賴（index.html 已有載入）：
   - window.WW_DATA（data/ww.data.js）
   - roles / boards / rules / nightSteps / engines（可逐步補齊）

   原則：
   - app.js 負責 UI + 狀態 + 流程
   - 規則可由 rules.resolveNight / rules.buildAnnouncement 提供
   - 若 rules 未齊：仍能走完整流程（但結算會用最簡 fallback）
========================================================= */

(() => {
  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);

  /* ---------------------------
     iOS 防長按選字 / 放大
  --------------------------- */
  try {
    document.documentElement.style.webkitUserSelect = "none";
    document.documentElement.style.userSelect = "none";
    document.documentElement.style.webkitTouchCallout = "none";
  } catch (_) {}

  function hardPreventTouchSelect(el) {
    if (!el) return;
    el.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /* ---------------------------
     State + Storage
  --------------------------- */
  const STORAGE_KEY = "ww_save_v2_stable";

  const State = {
    phase: "setup", // setup | deal | night | day
    boardId: "basic",
    playerCount: 9,

    rolesCount: {},

    players: [], // [{seat, roleId, name, icon, team, alive}]
    dealIndex: 0,

    nightNo: 1,
    dayNo: 1,

    bundle: null, // { board, rules, nightSteps }
    nightStepIndex: 0,
    nightState: {},

    godView: false,

    logs: [] // [{nightNo, dayNo, publicText, hiddenText, ts}]
  };

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(State)); } catch (_) {}
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s && typeof s === "object") {
        Object.assign(State, s);
      }
    } catch (_) {}
  }
  function clearSave() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  /* ---------------------------
     Screen switch
  --------------------------- */
  function showScreen(name) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    $(`screen-${name}`)?.classList.add("active");
    State.phase = name;
    save();
  }

  /* ---------------------------
     God view toggle (no PIN 版)
     你已經有 PIN modal，但這版先做「能切」且不會壞
  --------------------------- */
  function setGodView(onFlag) {
    State.godView = !!onFlag;
    document.body.classList.toggle("god-on", State.godView);
    const t = State.godView ? "🔓" : "🔒";
    const b1 = $("btnGodToggle"); if (b1) b1.textContent = t;
    const fab = $("fabGod"); if (fab) fab.textContent = t;
    save();
    // 重新渲染公告（若正在開）
    if (!$("modalAnn")?.classList.contains("hidden")) renderAnnouncementBox();
    if (State.phase === "night") renderNight();
    if (State.phase === "day") renderDay();
  }

  /* ---------------------------
     Helpers：roles / boards bundle
  --------------------------- */
  function requireWWData() {
    const w = window.WW_DATA;
    if (!w) return { ok: false, msg: "找不到 WW_DATA（請確認 data/ww.data.js 有載入且路徑正確）" };
    if (!w.boards || !Object.keys(w.boards).length) return { ok: false, msg: "找不到 boards（請確認 data/boards/boards.config.js 正確輸出 WW_BOARDS）" };
    if (!w.roles || !Object.keys(w.roles).length) return { ok: false, msg: "找不到 roles（請確認 data/roles/*.js 正確輸出 WW_ROLES_BASE / WW_ROLES_B1）" };
    return { ok: true, w };
  }

  function getRole(roleId) {
    const r = window.WW_DATA?.getRole?.(roleId) || window.WW_DATA?.roles?.[roleId];
    if (r) return r;
    return { id: roleId, name: roleId, icon: "❔", team: "unknown" };
  }

  function getBundle(boardId) {
    const w = window.WW_DATA;
    const bundle = w?.getBoardBundle?.(boardId);
    if (!bundle) return null;
    const board = bundle.board;
    const rules = bundle.rules || null;
    const nightSteps = bundle.nightSteps || [];
    return { board, rules, nightSteps };
  }

  /* ---------------------------
     Setup：預設建議配置（6~12）
     你之後可改成 boards 裡面提供 presets
  --------------------------- */
  function defaultPresetBasic(n) {
    // 基本：預女獵白（白=村民），6~12
    // 6: 1狼 1預 1女 1獵 2民
    // 9: 2狼 1預 1女 1獵 4民
    // 12: 3狼 1預 1女 1獵 7民
    const wolves = n >= 12 ? 3 : (n >= 9 ? 2 : 1);
    const fixed = 1 + 1 + 1; // seer witch hunter
    const villager = Math.max(0, n - wolves - fixed);
    return { werewolf: wolves, seer: 1, witch: 1, hunter: 1, villager };
  }

  function defaultPresetB1(n) {
    // B1 先給一套「能開局」的合理預設（你之後再細修）
    // 目標：6~12，含：騎士/守衛/黑狼王/白狼王 的擴充基底
    // 這裡先做：狼人陣營 = werewolf + (n>=10? blackWolfKing : 0) + (n>=12? whiteWolfKing : 0)
    const baseWolf = n >= 9 ? 2 : 1;
    const bkw = n >= 10 ? 1 : 0;
    const wwk = n >= 12 ? 1 : 0;

    // 好人：seer, witch, hunter, guard, knight（人多再放 guard/knight）
    const seer = 1, witch = 1, hunter = 1;
    const guard = n >= 8 ? 1 : 0;
    const knight = n >= 9 ? 1 : 0;

    const wolves = baseWolf;
    const fixed = seer + witch + hunter + guard + knight + bkw + wwk;
    const villager = Math.max(0, n - fixed);

    return {
      werewolf: wolves,
      blackWolfKing: bkw,
      whiteWolfKing: wwk,
      seer, witch, hunter,
      guard, knight,
      villager
    };
  }

  function setSuggestedRoles() {
    State.rolesCount = (State.boardId === "b1")
      ? defaultPresetB1(State.playerCount)
      : defaultPresetBasic(State.playerCount);
    syncSetupUI();
  }

  function rolesTotal() {
    return Object.values(State.rolesCount || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  }

  function syncSetupUI() {
    const pc = $("playerCount"); if (pc) pc.textContent = String(State.playerCount);
    const range = $("rangeCount"); if (range) range.value = String(State.playerCount);

    const rt = rolesTotal();
    const roleTotalEl = $("roleTotal"); if (roleTotalEl) roleTotalEl.textContent = String(rt);
    const playerTotalEl = $("playerTotal"); if (playerTotalEl) playerTotalEl.textContent = String(State.playerCount);

    const warn = $("warnRoleTotal");
    const ok = rt === State.playerCount;
    warn?.classList.toggle("hidden", ok);

    const btnStart = $("btnStart");
    if (btnStart) btnStart.disabled = !ok;

    save();
  }

  function bindSetupControls() {
    on($("boardBasic"), "click", () => {
      State.boardId = "basic";
      $("boardBasic")?.classList.add("active");
      $("boardSpecial")?.classList.remove("active");
      setSuggestedRoles();
      save();
    });
    on($("boardSpecial"), "click", () => {
      State.boardId = "b1";
      $("boardSpecial")?.classList.add("active");
      $("boardBasic")?.classList.remove("active");
      setSuggestedRoles();
      save();
    });

    on($("btnPlus"), "click", () => {
      State.playerCount = Math.min(12, State.playerCount + 1);
      setSuggestedRoles();
    });
    on($("btnMinus"), "click", () => {
      State.playerCount = Math.max(6, State.playerCount - 1);
      setSuggestedRoles();
    });
    on($("rangeCount"), "input", (e) => {
      State.playerCount = Math.max(6, Math.min(12, Number(e.target.value || 9)));
      setSuggestedRoles();
    });

    on($("btnSuggest"), "click", () => setSuggestedRoles());

    on($("btnOpenRoleConfig"), "click", () => {
      renderRoleConfigModal();
      $("modalRole")?.classList.remove("hidden");
    });
    on($("closeRole"), "click", () => $("modalRole")?.classList.add("hidden"));
    on($("roleReset"), "click", () => { setSuggestedRoles(); renderRoleConfigModal(); });
    on($("roleApply"), "click", () => { $("modalRole")?.classList.add("hidden"); syncSetupUI(); });
  }

  function renderRoleConfigModal() {
    const body = $("roleConfigBody");
    if (!body) return;
    body.innerHTML = "";

    const ids = Object.keys(window.WW_DATA?.roles || {});
    // 讓常用角色排前面
    const priority = [
      "werewolf","blackWolfKing","whiteWolfKing",
      "seer","witch","hunter","guard","knight",
      "villager",
      // B1 你要的那一大串先預留（有資料就會顯示）
      "idiot","dreamweaver","magician","blackMarketDealer","luckyOne",
      "demonHunter","evilKnight","gargoyle","cupid","secretLover"
    ];
    const uniq = Array.from(new Set([...priority, ...ids]));

    const tip = document.createElement("div");
    tip.className = "hint";
    tip.style.marginBottom = "10px";
    tip.textContent = "調整後：角色總數必須等於玩家人數才能開始。";
    body.appendChild(tip);

    uniq.forEach((roleId) => {
      const info = getRole(roleId);
      if (!info) return;

      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
      row.style.gap = "10px";
      row.style.padding = "10px 4px";
      row.style.borderBottom = "1px dashed rgba(0,0,0,.08)";

      const left = document.createElement("div");
      left.style.fontWeight = "900";
      left.textContent = `${info.icon ? info.icon + " " : ""}${info.name || roleId}`;

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.alignItems = "center";
      right.style.gap = "10px";

      const minus = document.createElement("button");
      minus.className = "btn ghost tiny";
      minus.type = "button";
      minus.textContent = "－";

      const num = document.createElement("div");
      num.style.minWidth = "36px";
      num.style.textAlign = "center";
      num.style.fontWeight = "900";
      num.textContent = String(State.rolesCount[roleId] ?? 0);

      const plus = document.createElement("button");
      plus.className = "btn ghost tiny";
      plus.type = "button";
      plus.textContent = "＋";

      minus.onclick = () => {
        State.rolesCount[roleId] = Math.max(0, (State.rolesCount[roleId] || 0) - 1);
        num.textContent = String(State.rolesCount[roleId]);
        syncSetupUI();
      };
      plus.onclick = () => {
        State.rolesCount[roleId] = (State.rolesCount[roleId] || 0) + 1;
        num.textContent = String(State.rolesCount[roleId]);
        syncSetupUI();
      };

      right.append(minus, num, plus);
      row.append(left, right);
      body.appendChild(row);
    });
  }

  /* ---------------------------
     Build players（不依賴 buildPlayers）
  --------------------------- */
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function buildPlayersFromRolesCount() {
    const list = [];
    for (const [roleId, cnt] of Object.entries(State.rolesCount || {})) {
      for (let i = 0; i < (Number(cnt) || 0); i++) list.push(roleId);
    }
    if (list.length !== State.playerCount) return null;

    shuffle(list);

    State.players = list.map((roleId, idx) => {
      const r = getRole(roleId);
      return {
        seat: idx + 1,
        roleId,
        name: r.name || roleId,
        icon: r.icon || "❔",
        team: r.team || "unknown",
        alive: true
      };
    });
  }

  /* ---------------------------
     Start game
  --------------------------- */
  function startGame() {
    const check = requireWWData();
    if (!check.ok) return showFatal(check.msg);

    const bundle = getBundle(State.boardId);
    if (!bundle || !bundle.board) return showFatal("板子資料載入失敗：請確認 boards.config.js 有 basic / b1 兩個板子");

    // 設定 bundle
    State.bundle = bundle;

    // 建立玩家（若 board 有 buildPlayers 也可以用，但不強制）
    let used = false;
    const board = bundle.board;

    try {
      if (typeof board.buildPlayers === "function") {
        // 允許你未來在 boards 寫 buildPlayers({count, rolesCount, roles})
        const p = board.buildPlayers({
          count: State.playerCount,
          rolesCount: State.rolesCount,
          roles: window.WW_DATA.roles
        });
        if (Array.isArray(p) && p.length === State.playerCount) {
          State.players = p.map((x, i) => ({
            seat: x.seat ?? (i + 1),
            roleId: x.roleId ?? x.id,
            name: x.name ?? getRole(x.roleId ?? x.id)?.name ?? (x.roleId ?? x.id),
            icon: x.icon ?? getRole(x.roleId ?? x.id)?.icon ?? "❔",
            team: x.team ?? getRole(x.roleId ?? x.id)?.team ?? "unknown",
            alive: (x.alive !== false)
          }));
          used = true;
        }
      }
    } catch (e) {
      console.warn("buildPlayers error:", e);
    }

    if (!used) {
      const ok = rolesTotal() === State.playerCount;
      if (!ok) return showFatal("角色總數必須等於玩家人數（請先按『建議配置』或調整角色）");

      buildPlayersFromRolesCount();
      if (!State.players?.length) return showFatal("無法建立玩家：rolesCount 結構有誤");
    }

    // reset run
    State.dealIndex = 0;
    State.logs = [];
    State.nightNo = 1;
    State.dayNo = 1;
    State.nightState = {};
    State.nightStepIndex = 0;

    showScreen("deal");
    renderDeal();
    renderDealSeatGrid();
    save();
  }

  function showFatal(msg) {
    // 你現在看到的「板子資料結構錯誤」就是走到這裡
    alert("❌ " + msg);
  }

  /* ---------------------------
     Deal
  --------------------------- */
  let revealTimer = null;

  function renderDeal() {
    const p = State.players[State.dealIndex];
    if (!p) return;

    const dealText = $("dealText");
    if (dealText) dealText.innerHTML = `請 <b>${p.seat} 號</b> 拿手機`;

    const btn = $("btnHoldReveal");
    if (!btn) return;

    hardPreventTouchSelect(btn);

    const open = () => {
      $("revealRole").textContent = `${p.icon} ${p.name}`;
      $("modalReveal")?.classList.remove("hidden");
      navigator.vibrate?.(50);
    };
    const close = () => {
      $("modalReveal")?.classList.add("hidden");
    };

    const startHold = () => {
      clearTimeout(revealTimer);
      revealTimer = setTimeout(open, 900);
    };
    const endHold = () => {
      clearTimeout(revealTimer);
      close();
    };

    btn.onpointerdown = startHold;
    btn.onpointerup = endHold;
    btn.onpointercancel = endHold;
    btn.onpointerleave = endHold;
  }

  function renderDealSeatGrid() {
    const box = $("dealSeatGrid");
    if (!box) return;
    box.innerHTML = "";
    State.players.forEach((p) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seat";
      b.textContent = String(p.seat);
      b.onclick = () => {
        State.dealIndex = p.seat - 1;
        renderDeal();
        save();
      };
      box.appendChild(b);
    });
  }

  function nextDeal() {
    State.dealIndex++;
    if (State.dealIndex >= State.players.length) State.dealIndex = State.players.length - 1;
    renderDeal();
    save();
  }

  function openDealConfirm() {
    $("modalDealConfirm")?.classList.remove("hidden");
  }
  function closeDealConfirm() {
    $("modalDealConfirm")?.classList.add("hidden");
  }

  function finishDealConfirmed() {
    closeDealConfirm();
    showScreen("night");
    initNight();
    save();
  }

  /* ---------------------------
     Night flow
  --------------------------- */
  function initNight() {
    State.nightState = {};
    State.nightStepIndex = 0;
    renderNight();
  }

  function currentNightStep() {
    const steps = State.bundle?.nightSteps || [];
    return steps[State.nightStepIndex] || null;
  }

  function renderNight() {
    const step = currentNightStep();
    if (!step) {
      $("nightScript").textContent = "（夜晚流程缺少 nightSteps，請檢查 data/night/*.js）";
      return;
    }

    $("nightTag").textContent = `第 ${State.nightNo} 夜`;
    $("nightScript").textContent = State.godView ? (step.godScript || "") : (step.publicScript || "");

    // 座位圈
    renderSeatDots($("nightSeats"), (seat) => {
      if (step.pickKey) {
        State.nightState[step.pickKey] = seat;
        save();
      }
    });
  }

  function nightPrev() {
    State.nightStepIndex = Math.max(0, State.nightStepIndex - 1);
    renderNight();
    save();
  }

  function nightNext() {
    const step = currentNightStep();
    if (!step) return;

    // 若需要選人
    if (step.required && step.pickKey && !State.nightState[step.pickKey]) {
      navigator.vibrate?.([40, 40, 40]);
      return;
    }

    // 女巫面板（你 index 已經準備好 modalWitch）
    if (step.type === "witch") {
      openWitchModal();
      return;
    }

    // 結算
    if (step.type === "resolve") {
      resolveNight();
      return;
    }

    State.nightStepIndex++;
    renderNight();
    save();
  }

  /* ---------------------------
     Witch modal (依你 index 的 id)
     規則：
     - 先救不救（刀口顯示）
     - 再毒不毒（回座位圈點人）
  --------------------------- */
  function openWitchModal() {
    // 女巫需要上帝視角操作（先簡單要求）
    if (!State.godView) {
      alert("請先切換 🔓 上帝視角 再操作女巫");
      return;
    }

    const modal = $("modalWitch");
    if (!modal) return;

    // 你 nightState 裡的 key 名稱取決於 nightSteps 設計：
    // 這裡做「常見 key」兼容：wolfTarget / knife / killed
    const knife =
      State.nightState.wolfTarget ??
      State.nightState.knife ??
      State.nightState.killed ??
      null;

    // 如果你 data/night 寫的是別的 key，之後我再幫你統一
    $("witchKnife").textContent = knife ? `${knife} 號` : "—";

    // 用 nightState 記錄女巫選擇
    State.nightState.witchSave = !!State.nightState.witchSave;
    State.nightState.witchPoison = State.nightState.witchPoison ?? null;

    $("witchStatus").textContent = `已選：${State.nightState.witchSave ? "✅ 解藥" : "不救"}｜${State.nightState.witchPoison ? "☠️ 毒 " + State.nightState.witchPoison + " 號" : "不毒"}`;

    modal.classList.remove("hidden");
    save();
  }

  function closeWitchModal() {
    $("modalWitch")?.classList.add("hidden");
  }

  function bindWitchButtons() {
    on($("btnWitchSave"), "click", () => {
      State.nightState.witchSave = true;
      openWitchModal(); // refresh
      save();
    });
    on($("btnWitchNoSave"), "click", () => {
      State.nightState.witchSave = false;
      openWitchModal();
      save();
    });

    // 毒藥：提示回座位圈點人（將下一個點座位寫到 witchPoison）
    on($("btnWitchPoisonPick"), "click", () => {
      closeWitchModal();
      alert("請回到『座位圈』點選要毒的人");
      // 進入毒人模式：下一次點座位 → 設 witchPoison
      State._pickPoison = true;
      save();
    });

    on($("btnWitchNoPoison"), "click", () => {
      State.nightState.witchPoison = null;
      State._pickPoison = false;
      openWitchModal();
      save();
    });

    on($("btnWitchDone"), "click", () => {
      State._pickPoison = false;
      closeWitchModal();
      // 女巫步驟完成 → 下一步
      State.nightStepIndex++;
      renderNight();
      save();
    });
  }

  /* ---------------------------
     Resolve night → Announcement → Day
  --------------------------- */
  function resolveNight() {
    const rules = State.bundle?.rules || null;

    // 1) 呼叫 rules.resolveNight（若有）
    let resolved = null;
    try {
      if (rules && typeof rules.resolveNight === "function") {
        resolved = rules.resolveNight({
          players: State.players,
          night: State.nightState,
          settings: State.bundle?.board?.settings || {}
        });
      }
    } catch (e) {
      console.warn("rules.resolveNight error:", e);
    }

    // 2) 若規則沒給，就用 fallback（不會卡死）
    if (!resolved) {
      resolved = fallbackResolveNight();
    }

    // 3) 產公告
    let ann = null;
    try {
      if (rules && typeof rules.buildAnnouncement === "function") {
        ann = rules.buildAnnouncement({
          nightNo: State.nightNo,
          dayNo: State.dayNo,
          players: State.players,
          night: State.nightState,
          resolved
        });
      }
    } catch (e) {
      console.warn("rules.buildAnnouncement error:", e);
    }

    if (!ann) ann = fallbackBuildAnnouncement(resolved);

    // 4) 寫 log
    State.logs.unshift({
      nightNo: State.nightNo,
      dayNo: State.dayNo,
      publicText: ann.publicText || "（無公告）",
      hiddenText: ann.hiddenText || "",
      ts: new Date().toISOString()
    });

    // 5) 一定跳公告
    openAnnouncementModal(true);

    // 6) 進白天
    showScreen("day");
    renderDay();
    save();
  }

  function fallbackResolveNight() {
    // 極簡 fallback：只吃 wolfTarget / witchSave / witchPoison / guardTarget（若你有）
    const wolf = State.nightState.wolfTarget ?? null;
    const guard = State.nightState.guardTarget ?? null;
    const saveW = !!State.nightState.witchSave;
    const poison = State.nightState.witchPoison ?? null;

    const deaths = new Set();

    if (wolf) {
      if (wolf === guard) {
        // 平安夜
      } else if (saveW) {
        // 被救
      } else {
        deaths.add(wolf);
      }
    }
    if (poison) deaths.add(poison);

    // 套用到 players
    deaths.forEach((seat) => {
      const p = State.players.find((x) => x.seat === seat);
      if (p) p.alive = false;
    });

    return { deaths: Array.from(deaths), meta: { wolf, guard, saveW, poison } };
  }

  function fallbackBuildAnnouncement(resolved) {
    const d = resolved?.deaths || [];
    const publicText = d.length
      ? `天亮了，昨晚死亡的是：${d.join("、")} 號。`
      : `天亮了，昨晚是平安夜。`;
    const hiddenText = State.godView ? `（上帝）夜晚紀錄：${JSON.stringify(State.nightState)}` : "";
    return { publicText, hiddenText };
  }

  /* ---------------------------
     Announcement modal
  --------------------------- */
  let annMode = "today";

  function renderAnnouncementBox() {
    const box = $("annBox");
    if (!box) return;

    if (!State.logs.length) {
      box.textContent = "（尚無公告）";
      return;
    }

    if (annMode === "today") {
      const l = State.logs[0];
      box.textContent = State.godView
        ? (l.publicText + (l.hiddenText ? "\n\n" + l.hiddenText : ""))
        : l.publicText;
      return;
    }

    const lines = [];
    State.logs.forEach((l) => {
      lines.push(`第${l.nightNo}夜 / 第${l.dayNo}天`);
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
    renderAnnouncementBox();
  }

  function closeAnnouncementModal() {
    $("modalAnn")?.classList.add("hidden");
  }

  /* ---------------------------
     Day
  --------------------------- */
  function renderDay() {
    $("dayTag").textContent = `第 ${State.dayNo} 天`;
    const alive = State.players.filter((p) => p.alive).map((p) => p.seat);
    $("dayAlive").textContent = alive.length ? `存活：${alive.join("、")} 號` : "—";
  }

  function nextDayToNight() {
    // 進入下一夜
    State.nightNo++;
    State.dayNo++;
    State.nightState = {};
    State.nightStepIndex = 0;
    showScreen("night");
    renderNight();
    save();
  }

  /* ---------------------------
     Seats (Night uses nightSeats)
     支援毒人模式：State._pickPoison
  --------------------------- */
  function renderSeatDots(container, onPick) {
    if (!container) return;
    container.innerHTML = "";
    State.players.forEach((p) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seat" + (p.alive ? "" : " dead");
      b.textContent = String(p.seat);

      hardPreventTouchSelect(b);

      b.onclick = () => {
        if (!p.alive) return;

        // 女巫毒人模式：下一次點座位 → 設 witchPoison
        if (State._pickPoison) {
          State.nightState.witchPoison = p.seat;
          State._pickPoison = false;
          save();
          // 回女巫彈窗更新狀態
          openWitchModal();
          return;
        }

        onPick?.(p.seat);
      };

      container.appendChild(b);
    });
  }

  /* ---------------------------
     Restart（自動插入 btnRestart）
  --------------------------- */
  function ensureRestartButton() {
    if ($("btnRestart")) return;

    const topActions = document.querySelector(".top-actions");
    if (!topActions) return;

    const btn = document.createElement("button");
    btn.className = "iconbtn";
    btn.id = "btnRestart";
    btn.type = "button";
    btn.title = "重新開始";
    btn.textContent = "🔁";
    topActions.prepend(btn);

    on(btn, "click", () => {
      if (!confirm("確定要重新開始？所有進度會清除")) return;
      clearSave();
      location.reload();
    });
  }

  /* ---------------------------
     Bind events
  --------------------------- */
  function bindAll() {
    // Setup
    bindSetupControls();
    on($("btnStart"), "click", startGame);

    // Deal
    on($("btnDealBack"), "click", () => { showScreen("setup"); save(); });
    on($("btnNextPlayer"), "click", nextDeal);
    on($("btnFinishDeal"), "click", openDealConfirm);
    on($("dealConfirmNo"), "click", closeDealConfirm);
    on($("dealConfirmYes"), "click", finishDealConfirmed);

    // Night
    on($("btnNightPrev"), "click", nightPrev);
    on($("btnNightNext"), "click", nightNext);

    // Day
    on($("btnDayNext"), "click", nextDayToNight);

    // God toggle
    on($("btnGodToggle"), "click", () => setGodView(!State.godView));
    on($("fabGod"), "click", () => setGodView(!State.godView));

    // Announcement
    on($("btnOpenAnnouncement"), "click", () => openAnnouncementModal(true));
    on($("fabAnn"), "click", () => openAnnouncementModal(true));
    on($("btnOpenAnnouncement2"), "click", () => openAnnouncementModal(true));
    on($("closeAnn"), "click", closeAnnouncementModal);
    on($("annToday"), "click", () => { annMode = "today"; renderAnnouncementBox(); });
    on($("annHistory"), "click", () => { annMode = "history"; renderAnnouncementBox(); });

    on($("btnCopyAnn"), "click", async () => {
      try {
        await navigator.clipboard.writeText($("annBox")?.textContent || "");
        alert("已複製");
      } catch (_) {
        alert("複製失敗（可能需要 HTTPS 或已安裝 PWA）");
      }
    });

    on($("btnExport"), "click", () => {
      const payload = { ...State, exportedAt: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `狼人殺紀錄_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 400);
    });

    // Witch
    bindWitchButtons();

    // extra prevent
    hardPreventTouchSelect($("btnHoldReveal"));
  }

  /* ---------------------------
     Boot
  --------------------------- */
  function boot() {
    load();
    ensureRestartButton();

    // 若第一次進來沒 rolesCount，先給建議
    if (!State.rolesCount || !Object.keys(State.rolesCount).length) {
      setSuggestedRoles();
    } else {
      syncSetupUI();
    }

    // 恢復 board 按鈕樣式
    if (State.boardId === "b1") {
      $("boardSpecial")?.classList.add("active");
      $("boardBasic")?.classList.remove("active");
    } else {
      $("boardBasic")?.classList.add("active");
      $("boardSpecial")?.classList.remove("active");
    }

    setGodView(!!State.godView);
    bindAll();

    // restore screen
    showScreen(State.phase || "setup");

    if (State.phase === "deal") {
      renderDeal();
      renderDealSeatGrid();
    }
    if (State.phase === "night") {
      // 如果 bundle 還沒拿到（例如 reload），重新取一次
      if (!State.bundle) State.bundle = getBundle(State.boardId);
      renderNight();
    }
    if (State.phase === "day") {
      renderDay();
    }
  }

  boot();
})();