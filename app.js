/* =========================
   Werewolf God Helper - app.js
   Works with your provided index.html + style.css
   ========================= */

(() => {
  "use strict";

  /* ---------- DOM ---------- */
  const $ = (id) => document.getElementById(id);

  const uiStatus = $("uiStatus");
  const uiBoard = $("uiBoard");

  const btnAnn = $("btnAnn");
  const btnTimer = $("btnTimer");
  const btnEye = $("btnEye");
  const btnDice = $("btnDice");
  const btnSettings = $("btnSettings");

  const promptTitle = $("promptTitle");
  const promptText = $("promptText");
  const promptFoot = $("promptFoot");

  const setupCard = $("setupCard");
  const boardList = $("boardList");

  const seatsHeader = $("seatsHeader");
  const seatsGrid = $("seatsGrid");

  const btnBack = $("btnBack");
  const btnMain = $("btnMain");
  const btnNext = $("btnNext");

  // Timer drawer
  const timerBackdrop = $("timerBackdrop");
  const timerDrawer = $("timerDrawer");
  const btnCloseTimer = $("btnCloseTimer");
  const timerBig = $("timerBig");
  const timerPresets = $("timerPresets");
  const btnTimerStart = $("btnTimerStart");
  const btnTimerPause = $("btnTimerPause");
  const btnTimerReset = $("btnTimerReset");

  // Ann drawer
  const annBackdrop = $("annBackdrop");
  const annDrawer = $("annDrawer");
  const btnCloseAnn = $("btnCloseAnn");
  const annText = $("annText");
  const toggleAnnGod = $("toggleAnnGod");

  // Settings drawer
  const setBackdrop = $("setBackdrop");
  const setDrawer = $("setDrawer");
  const btnCloseSet = $("btnCloseSet");
  const segEdge = $("segEdge");
  const segCity = $("segCity");
  const togglePolice = $("togglePolice");
  const btnGotoSetup = $("btnGotoSetup");
  const btnHardReset = $("btnHardReset");

  // Role modal
  const roleModal = $("roleModal");
  const roleModalTitle = $("roleModalTitle");
  const roleModalRole = $("roleModalRole");
  const roleModalCamp = $("roleModalCamp");
  const btnRoleDone = $("btnRoleDone");
  const btnRoleClose = $("btnRoleClose");

  // Dice modal
  const diceModal = $("diceModal");
  const diceResult = $("diceResult");
  const btnDiceAgain = $("btnDiceAgain");
  const btnDiceClose = $("btnDiceClose");

  // Thief modal
  const thiefModal = $("thiefModal");
  const thiefHint = $("thiefHint");
  const btnThiefA = $("btnThiefA");
  const btnThiefB = $("btnThiefB");
  const btnThiefClose = $("btnThiefClose");

  /* ---------- Global anti iOS selection / context menu ---------- */
  document.addEventListener("contextmenu", (e) => {
    // prevent long-press menu
    e.preventDefault();
  }, { passive: false });

  // prevent double-tap zoom on many elements (best effort)
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });

  /* ---------- Storage ---------- */
  const KEY = "ww_god_v6";
  const load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  const save = () => {
    localStorage.setItem(KEY, JSON.stringify(state));
  };
  const hardReset = () => {
    localStorage.removeItem(KEY);
    location.reload();
  };

  /* ---------- Boards (fallback) ---------- */
  // camp: "good" | "wolf" | "third"
  // role id: used for logic
  const ROLE = {
    VILLAGER: { id: "villager", name: "平民", camp: "good", night: false },
    WOLF:     { id: "wolf",     name: "狼人", camp: "wolf", night: true, group: "wolves" },

    SEER:     { id: "seer",     name: "預言家", camp: "good", night: true },
    WITCH:    { id: "witch",    name: "女巫", camp: "good", night: true },
    HUNTER:   { id: "hunter",   name: "獵人", camp: "good", night: false },
    GUARD:    { id: "guard",    name: "守衛", camp: "good", night: true },
    IDIOT:    { id: "idiot",    name: "白癡", camp: "good", night: false },

    CUPID:    { id: "cupid",    name: "邱比特", camp: "good", night: true, firstNightOnly: true },
    THIEF:    { id: "thief",    name: "盜賊", camp: "good", night: false, special: "thief" },
    ROBBER:   { id: "robber",   name: "盜賊(簡)", camp: "good", night: true, firstNightOnly: true },
  };

  const BOARDS = [
    {
      id: "official-9",
      name: "9 人官方標準局",
      tags: ["官方", "標準"],
      n: 9,
      extra: 0,
      hasPolice: true,
      roles: { wolf: 3, seer: 1, witch: 1, hunter: 1, villager: 3 },
    },
    {
      id: "official-10",
      name: "10 人官方標準局",
      tags: ["官方", "標準"],
      n: 10,
      extra: 0,
      hasPolice: true,
      roles: { wolf: 3, seer: 1, witch: 1, hunter: 1, guard: 1, villager: 3 },
    },
    {
      id: "official-12",
      name: "12 人官方標準局",
      tags: ["官方", "標準", "含白癡"],
      n: 12,
      extra: 0,
      hasPolice: true,
      roles: { wolf: 4, seer: 1, witch: 1, hunter: 1, guard: 1, idiot: 1, villager: 3 },
    },
    {
      id: "12-edge-nopolice",
      name: "12 人（屠邊・無上警）",
      tags: ["測試", "屠邊", "無上警"],
      n: 12,
      extra: 0,
      hasPolice: false,
      roles: { wolf: 4, seer: 1, witch: 1, hunter: 1, guard: 1, idiot: 1, villager: 3 },
    },
    {
      id: "12-thief",
      name: "12 人含盜賊（+2 底牌）",
      tags: ["盜賊", "變體"],
      n: 12,
      extra: 2,
      hasPolice: true,
      // ✅ 狼人最多 4（固定）
      roles: { wolf: 4, seer: 1, witch: 1, hunter: 1, guard: 1, idiot: 1, thief: 1, villager: 2 },
      thiefScriptAlwaysAsk: true, // 盜賊變體：每天仍照完整腳本詢問（即使被捨棄也照問）
    },
  ];

  /* ---------- Utils ---------- */
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const pad2 = (n) => String(n).padStart(2, "0");
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  function beepVibrate() {
    try { navigator.vibrate?.(80); } catch {}
  }

  /* ---------- State ---------- */
  const defaultState = () => ({
    phase: "SETUP",          // SETUP | DEAL | NIGHT | DAY | VOTE
    step: 0,                 // step within phase
    n: 12,
    boardId: "official-12",
    winMode: "edge",         // edge | city
    hasPolice: true,

    // gameplay
    godMode: false,
    selectedSeat: null,      // seat index 1..n

    seats: [],               // seat objects
    deckExtra: [],           // extra role cards (for thief)
    thief: { seat: null, chosen: false, options: [], mustWolf: false },

    day: 1,                  // day number (starts after first night)
    night: 1,                // night count
    logs: [],                // {type, day, textPublic, textGod}

    // night resolutions
    guardLast: null,
    guardTarget: null,
    wolfTarget: null,
    seerCheck: null,
    seerResult: null,
    witch: { heal: true, poison: true, healTarget: null, poisonTarget: null },

    timer: { running:false, remain:90, lastTick:0 },
  });

  let state = load() || defaultState();

  /* ---------- Seat model ---------- */
  function makeSeats(n) {
    const seats = [];
    for (let i = 1; i <= n; i++) {
      seats.push({
        no: i,
        alive: true,
        roleId: null,
        roleName: "",
        camp: null,                 // good|wolf|third
        viewed: false,              // has viewed their identity at least once
        done: false,                // pressed "我看完了" for deal step
        covered: true,              // whether seat hides identity in DEAL view
        events: [],                 // icons or short tags for god view
        deathReason: "",            // text
      });
    }
    return seats;
  }

  function roleMetaById(id) {
    if (!id) return null;
    if (id === "wolf") return ROLE.WOLF;
    if (id === "villager") return ROLE.VILLAGER;
    if (id === "seer") return ROLE.SEER;
    if (id === "witch") return ROLE.WITCH;
    if (id === "hunter") return ROLE.HUNTER;
    if (id === "guard") return ROLE.GUARD;
    if (id === "idiot") return ROLE.IDIOT;
    if (id === "cupid") return ROLE.CUPID;
    if (id === "thief") return ROLE.THIEF;
    return null;
  }

  /* ---------- Board helpers ---------- */
  function getBoard() {
    return BOARDS.find(b => b.id === state.boardId) || BOARDS[0];
  }

  function buildDeckFromBoard(board) {
    const deck = [];
    const add = (id, count) => { for (let i=0;i<count;i++) deck.push(id); };

    // build from roles map
    Object.entries(board.roles).forEach(([id, cnt]) => add(id, cnt));

    // validate size
    const expected = board.n + (board.extra || 0);
    if (deck.length !== expected) {
      // fallback: adjust villagers
      const diff = expected - deck.length;
      if (diff > 0) add("villager", diff);
      if (diff < 0) deck.splice(0, Math.min(deck.length, -diff));
    }
    return shuffle(deck);
  }

  function boardSummary(board) {
    const parts = [];
    const roles = board.roles;
    const add = (id, cnt) => {
      if (!cnt) return;
      const meta = roleMetaById(id);
      const name = meta ? meta.name : id;
      parts.push(`${cnt}${name}`);
    };

    // order: wolves, seer, witch, hunter, guard, idiot, thief, cupid, villager
    add("wolf", roles.wolf || 0);
    add("seer", roles.seer || 0);
    add("witch", roles.witch || 0);
    add("hunter", roles.hunter || 0);
    add("guard", roles.guard || 0);
    add("idiot", roles.idiot || 0);
    add("cupid", roles.cupid || 0);
    add("thief", roles.thief || 0);
    add("villager", roles.villager || 0);

    const extra = board.extra ? ` + 底牌${board.extra}` : "";
    return `${parts.join(" + ")}${extra}`;
  }

  /* ---------- Logs ---------- */
  function pushLog(textPublic, textGod = "") {
    state.logs.push({
      t: Date.now(),
      day: state.day,
      night: state.night,
      phase: state.phase,
      textPublic,
      textGod,
    });
    save();
  }

  function renderLogs() {
    const showGod = !!toggleAnnGod.checked;
    const lines = state.logs.map((l) => {
      const head = l.phase === "NIGHT"
        ? `🌙 夜晚 ${l.night}`
        : l.phase === "DAY"
          ? `☀️ 白天 ${l.day}`
          : `📌 記錄`;

      const body = showGod && l.textGod ? l.textGod : l.textPublic;
      return `${head}\n${body}\n`;
    });
    annText.textContent = lines.length ? lines.join("\n") : "（尚無公告）";
  }

  /* ---------- UI: drawers & modals ---------- */
  function openDrawer(backdrop, drawer) {
    backdrop.classList.remove("hidden");
    drawer.classList.remove("hidden");
    drawer.setAttribute("aria-hidden", "false");
  }
  function closeDrawer(backdrop, drawer) {
    backdrop.classList.add("hidden");
    drawer.classList.add("hidden");
    drawer.setAttribute("aria-hidden", "true");
  }

  function openModal(modal) {
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }
  function closeModal(modal) {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }

  /* ---------- Timer ---------- */
  function fmtMMSS(sec) {
    sec = clamp(Math.floor(sec), 0, 35999);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${pad2(m)}:${pad2(s)}`;
  }

  function timerTick() {
    if (!state.timer.running) return;
    const now = Date.now();
    const dt = (now - state.timer.lastTick) / 1000;
    state.timer.lastTick = now;
    state.timer.remain = Math.max(0, state.timer.remain - dt);

    if (state.timer.remain <= 0) {
      state.timer.running = false;
      beepVibrate();
    }
    timerBig.textContent = fmtMMSS(state.timer.remain);
    save();
  }
  setInterval(timerTick, 200);

  function setTimer(sec) {
    state.timer.remain = sec;
    timerBig.textContent = fmtMMSS(sec);
    save();
  }

  /* ---------- Setup Rendering ---------- */
  function renderBoardList() {
    const n = state.n;
    const avail = BOARDS.filter(b => b.n === n);

    boardList.innerHTML = "";
    avail.forEach((b) => {
      const el = document.createElement("div");
      el.className = "boardItem" + (b.id === state.boardId ? " selected" : "");
      el.dataset.id = b.id;

      el.innerHTML = `
        <div class="title">${b.name}</div>
        <div class="sub">${b.id} ・ ${boardSummary(b)}</div>
        <div class="tags">
          ${(b.tags || []).map(t => `<span class="badge">${t}</span>`).join("")}
        </div>
      `;

      el.addEventListener("click", () => {
        state.boardId = b.id;
        state.hasPolice = !!b.hasPolice;
        save();
        renderBoardList();
        renderTop();
        renderPrompt();
      });

      boardList.appendChild(el);
    });
  }

  function bindSetupChips() {
    document.querySelectorAll(".chip[data-n]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const n = Number(btn.dataset.n);
        state.n = n;
        // auto pick first board of that n
        const first = BOARDS.find(b => b.n === n);
        if (first) {
          state.boardId = first.id;
          state.hasPolice = !!first.hasPolice;
        }
        save();
        // highlight
        document.querySelectorAll(".chip[data-n]").forEach(b => b.classList.toggle("active", Number(b.dataset.n) === n));
        renderBoardList();
        renderTop();
        renderPrompt();
      });
    });

    // initial highlight
    document.querySelectorAll(".chip[data-n]").forEach(b => b.classList.toggle("active", Number(b.dataset.n) === state.n));
  }

  /* ---------- Deal / Game initialization ---------- */
  function startNewGameFromSetup() {
    const board = getBoard();
    state.phase = "DEAL";
    state.step = 1;
    state.selectedSeat = null;

    state.day = 1;
    state.night = 1;
    state.logs = [];

    state.guardLast = null;
    state.guardTarget = null;
    state.wolfTarget = null;
    state.seerCheck = null;
    state.seerResult = null;
    state.witch = { heal: true, poison: true, healTarget: null, poisonTarget: null };

    // build seats and deck
    state.seats = makeSeats(board.n);
    const deck = buildDeckFromBoard(board);

    // deal
    for (let i = 0; i < board.n; i++) {
      const rid = deck[i];
      const meta = roleMetaById(rid);
      state.seats[i].roleId = rid;
      state.seats[i].roleName = meta ? meta.name : rid;
      state.seats[i].camp = meta ? meta.camp : "good";
      state.seats[i].viewed = false;
      state.seats[i].done = false;
      state.seats[i].covered = true;
      state.seats[i].events = [];
      state.seats[i].deathReason = "";
    }

    state.deckExtra = deck.slice(board.n); // for thief (+2)

    // thief state
    state.thief = { seat: null, chosen: false, options: [], mustWolf: false };
    const thiefSeat = state.seats.find(s => s.roleId === "thief");
    if (thiefSeat) state.thief.seat = thiefSeat.no;

    pushLog(
      `已開局：${board.name}\n人數：${board.n}\n（進入抽身分）`,
      `板子：${board.id}\n配置：${boardSummary(board)}`
    );

    save();
    renderAll();
  }

  /* ---------- Long press handling (0.3s) ---------- */
  const HOLD_MS = 300;
  let holdTimer = null;

  function clearHold() {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  }

  function canRevealSeat(seatNo) {
    if (state.phase !== "DEAL") return false;
    if (!seatNo) return false;
    return true;
  }

  function showRoleModal(seatNo) {
    const s = state.seats.find(x => x.no === seatNo);
    if (!s) return;

    roleModalTitle.textContent = `${seatNo}號 身分`;
    roleModalRole.textContent = s.roleName || "—";
    const campName = s.camp === "wolf" ? "狼人" : s.camp === "third" ? "第三方" : "好人";
    roleModalCamp.textContent = `陣營：${campName}`;

    openModal(roleModal);
  }

  function setupSeatPressHandlers(btn, seatNo) {
    const onDown = (e) => {
      // stop text selection / iOS callout
      e.preventDefault?.();

      // if not selected, treat as click selection
      // (we keep selection on click handler below)

      clearHold();
      holdTimer = setTimeout(() => {
        // must be selected seat
        if (state.selectedSeat !== seatNo) return;
        if (!canRevealSeat(seatNo)) return;

        showRoleModal(seatNo);
        beepVibrate();
      }, HOLD_MS);
    };

    const onUp = () => clearHold();

    btn.addEventListener("touchstart", onDown, { passive: false });
    btn.addEventListener("touchend", onUp, { passive: true });
    btn.addEventListener("touchcancel", onUp, { passive: true });

    btn.addEventListener("mousedown", onDown);
    btn.addEventListener("mouseup", onUp);
    btn.addEventListener("mouseleave", onUp);
  }

  /* ---------- Rendering seats ---------- */
  function seatSubText(seat) {
    // In DEAL:
    if (state.phase === "DEAL") {
      if (state.godMode) {
        // god mode shows role+camp
        const campName = seat.camp === "wolf" ? "狼人" : seat.camp === "third" ? "第三方" : "好人";
        return `${seat.roleName}・${campName}`;
      }
      // normal: always hide, show hint
      return "長按看身分";
    }

    // In game phases:
    if (state.godMode) {
      const campName = seat.camp === "wolf" ? "狼人" : seat.camp === "third" ? "第三方" : "好人";
      return `${seat.roleName}・${campName}`;
    }
    return seat.alive ? "存活" : "死亡";
  }

  function seatMetaLines(seat) {
    if (!state.godMode) return "";
    const lines = [];
    if (!seat.alive && seat.deathReason) lines.push(`☠ ${seat.deathReason}`);
    // events pills: store as strings like "💊救" "🧪毒" "🛡守" "🐺刀"
    if (seat.events && seat.events.length) {
      lines.push(seat.events.join(" "));
    }
    return lines.join("\n");
  }

  function renderSeats() {
    seatsGrid.innerHTML = "";
    const board = getBoard();
    const n = board.n;

    // Grid should always be the "original style" (4 columns)
    // Fill only up to n
    for (let i = 1; i <= n; i++) {
      const seat = state.seats[i-1];

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "seat";
      btn.dataset.no = String(i);

      // selected
      if (state.selectedSeat === i) btn.classList.add("selected");
      if (!seat.alive) btn.classList.add("dead");

      // god camp coloring
      if (state.godMode) {
        btn.classList.add("godOn");
        btn.dataset.camp = seat.camp || "good";
      } else {
        btn.dataset.camp = "";
      }

      const meta = seatMetaLines(seat);
      btn.innerHTML = `
        <div class="num">${i}</div>
        <div class="sub">${seatSubText(seat)}</div>
        ${meta ? `<div class="meta">${meta}</div>` : ``}
      `;

      // click select / toggle select
      btn.addEventListener("click", (e) => {
        e.preventDefault?.();
        // toggle selection: click same seat cancels (before next step confirm)
        if (state.selectedSeat === i) state.selectedSeat = null;
        else state.selectedSeat = i;
        save();
        renderSeats();
      });

      setupSeatPressHandlers(btn, i);
      seatsGrid.appendChild(btn);
    }
  }

  /* ---------- Prompt / Top / Bottom buttons ---------- */
  function renderTop() {
    const board = getBoard();
    uiBoard.textContent = board.id || "—";

    // status text
    let st = "";
    if (state.phase === "SETUP") st = "SETUP / step 1";
    else if (state.phase === "DEAL") st = `抽身分 (${countDone()}/${board.n})`;
    else if (state.phase === "NIGHT") st = `🌙 NIGHT ${state.night} / step ${state.step}`;
    else if (state.phase === "DAY") st = `☀️ DAY ${state.day} / step ${state.step}`;
    else if (state.phase === "VOTE") st = `🗳 投票 / step ${state.step}`;
    uiStatus.textContent = st;
  }

  function countDone() {
    return (state.seats || []).filter(s => s.done).length;
  }

  function dealAllDone() {
    const board = getBoard();
    return countDone() >= board.n;
  }

  function needThiefChoice() {
    const board = getBoard();
    if (board.id !== "12-thief") return false;
    if (!state.thief.seat) return false;
    return !state.thief.chosen;
  }

  function renderPrompt() {
    const board = getBoard();

    if (state.phase === "SETUP") {
      promptTitle.textContent = "開局";
      promptText.textContent =
        "先選人數 → 再選板子（點一下會變色）\n選完按底部「下一步」進入抽身分。\n（開局後，板子與人數不會佔畫面）";
      promptFoot.textContent = "";
      return;
    }

    if (state.phase === "DEAL") {
      promptTitle.textContent = "抽身分";
      const warn = needThiefChoice() ? "⚠ 盜賊尚未完成二選一（盜賊看完身分會立刻二選一）\n" : "";
      promptText.textContent =
        "上帝點選座位（可取消） → 玩家長按 0.3 秒看身分 → 按「我看完了」\n" +
        "看完會自動蓋牌（不會露出角色）\n" +
        "全部看完後按「開始夜晚」進入夜晚流程\n" +
        warn;
      promptFoot.textContent = "";
      return;
    }

    if (state.phase === "NIGHT") {
      promptTitle.textContent = `夜晚 ${state.night}`;
      promptText.textContent = buildNightScriptText();
      promptFoot.textContent = buildNightFoot();
      return;
    }

    if (state.phase === "DAY") {
      promptTitle.textContent = `白天 ${state.day}`;
      promptText.textContent = buildDayScriptText();
      promptFoot.textContent = "按「開始投票」進入投票統計。";
      return;
    }

    if (state.phase === "VOTE") {
      promptTitle.textContent = `投票`;
      promptText.textContent = buildVoteText();
      promptFoot.textContent = "（點選座位紀錄投票流向；按下一步結算公告）";
      return;
    }
  }

  function renderBottomButtons() {
    // back/next always enabled when possible
    btnBack.disabled = state.phase === "SETUP" && state.step <= 1;

    // middle button: major transitions
    if (state.phase === "SETUP") {
      btnMain.textContent = "—";
      btnMain.disabled = true;
    } else if (state.phase === "DEAL") {
      btnMain.textContent = "開始夜晚";
      btnMain.disabled = !(dealAllDone() && !needThiefChoice());
    } else if (state.phase === "NIGHT") {
      btnMain.textContent = "天亮睜眼";
      btnMain.disabled = false;
    } else if (state.phase === "DAY") {
      btnMain.textContent = "開始投票";
      btnMain.disabled = false;
    } else if (state.phase === "VOTE") {
      btnMain.textContent = "進入天黑";
      btnMain.disabled = false;
    }

    // next button: step progression
    btnNext.disabled = false;
  }

  function renderSetupVisibility() {
    const inSetup = state.phase === "SETUP";
    setupCard.classList.toggle("hidden", !inSetup);

    // seats should be hidden while setup, and shown after start
    seatsHeader.classList.toggle("hidden", inSetup);
    seatsGrid.classList.toggle("hidden", inSetup);
  }

  function renderAll() {
    renderTop();
    renderSetupVisibility();

    // when setup, board list should reflect n and selected
    if (state.phase === "SETUP") {
      bindSetupChips();
      renderBoardList();
    }

    // render seats if not setup
    if (state.phase !== "SETUP") renderSeats();

    renderPrompt();
    renderBottomButtons();
    renderLogs();
  }

  /* ---------- Night script building ---------- */
  function hasRole(roleId) {
    return state.seats.some(s => s.roleId === roleId);
  }

  function buildNightOrder() {
    const board = getBoard();

    // base order: guard -> wolves -> seer -> witch
    // plus optional: cupid first night only, robber etc.
    const order = [];

    // cupid first night
    if (hasRole("cupid")) order.push({ id:"cupid", label:"邱比特請睜眼（選兩位戀人）", pick: "two" });

    // guard
    order.push({ id:"guard", label:"守衛請閉眼（選擇守護）", pick: "one" });

    // wolves
    order.push({ id:"wolves", label:"狼人請閉眼（選擇刀人）", pick: "one" });

    // seer
    order.push({ id:"seer", label:"預言家請閉眼（查驗一人）", pick: "one" });

    // witch
    order.push({ id:"witch", label:"女巫請閉眼（解藥 / 毒藥）", pick: "witch" });

    // if thief variant and want to always ask full script, still keep order as above
    // (even if role doesn't exist because thief discarded it)
    if (board.thiefScriptAlwaysAsk) return order;

    // otherwise, filter by actually existing roles
    return order.filter(step => {
      if (step.id === "wolves") return hasRole("wolf");
      return hasRole(step.id);
    });
  }

  function buildNightScriptText() {
    const order = buildNightOrder();
    const lines = [];
    lines.push("夜晚開始：");
    order.forEach((s, idx) => {
      // display label without the leading "閉眼" confusion -> keep user's desired text style
      const title = s.label
        .replace("請閉眼", "請閉眼")
        .replace("請睜眼", "請睜眼");
      lines.push(`${idx+1}. ${title}`);
    });

    const cur = order[state.step - 1];
    if (cur) {
      lines.push("");
      lines.push(`👉 目前：${state.step}. ${cur.label}`);
      if (cur.pick === "one") lines.push("（點座位選取；再點同號取消；按「下一步」確認）");
      if (cur.pick === "two") lines.push("（依序選 2 位；可取消；按「下一步」確認）");
      if (cur.pick === "witch") {
        lines.push("（女巫：點『被刀的人』= 解藥救；點『其他人』= 毒；同晚只能擇一；按「下一步」確認）");
        const pot = [];
        pot.push(state.witch.heal ? "💊解藥可用" : "💊解藥已用");
        pot.push(state.witch.poison ? "🧪毒藥可用" : "🧪毒藥已用");
        lines.push(`狀態：${pot.join(" / ")}`);
      }
    } else {
      lines.push("");
      lines.push("（夜晚流程已完成，可按「天亮睜眼」進入白天）");
    }

    return lines.join("\n");
  }

  function buildNightFoot() {
    const order = buildNightOrder();
    if (state.step > order.length) return "夜晚已完成。";
    return "";
  }

  /* ---------- Day / Vote placeholder (simple but not stuck) ---------- */
  function buildDayScriptText() {
    // simple public resolution (we resolve deaths at dawn)
    const last = state.logs.slice(-1)[0];
    const hint = last ? "" : "";
    return (
      "天亮了，請宣布昨夜結果：\n" +
      `— 昨夜結果：${calcLastNightResultText()}\n\n` +
      "白天流程：自由發言 →（可上警）→ 推理/辯論 → 投票\n" +
      hint
    );
  }

  function calcLastNightResultText() {
    // Use stored results from previous night resolution
    // We'll compute based on seat events tagged with '昨夜'
    const deaths = state.seats.filter(s => !s.alive && s.deathReason && s.deathReason.includes(`N${state.night}`));
    if (!deaths.length) return "平安夜";
    if (deaths.length === 1) return `${deaths[0].no} 號死亡`;
    return deaths.map(d => `${d.no}號`).join("、") + " 死亡";
  }

  // Simple vote record structure stored in state.tempVote
  function buildVoteText() {
    const lines = [];
    lines.push("請逐一記錄投票流向：");
    lines.push("— 點選『投票者』→ 再點『被投者』");
    lines.push("— 棄票：投票者點自己兩次（= 設為棄票）");
    lines.push("");
    lines.push("結算會輸出：");
    lines.push("投給1號的有… / 投給2號的有… / 棄票的有…");
    return lines.join("\n");
  }

  /* ---------- Thief choose ---------- */
  function openThiefChoose() {
    const board = getBoard();
    if (board.extra !== 2) return;

    const seatNo = state.thief.seat;
    if (!seatNo) return;

    // options from extra deck (2 cards)
    const opts = [...state.deckExtra];
    if (opts.length < 2) return;

    // mustWolf rule
    const hasWolfOpt = opts.includes("wolf");
    state.thief.options = opts.slice(0,2);
    state.thief.mustWolf = hasWolfOpt;
    save();

    const optNames = state.thief.options.map(id => roleMetaById(id)?.name || id);
    thiefHint.textContent = hasWolfOpt
      ? "底牌含狼人牌：你只能選『狼人陣營』那張。"
      : "請從兩張底牌中選一張成為你的角色。";

    btnThiefA.textContent = optNames[0];
    btnThiefB.textContent = optNames[1];

    // bind handlers
    const choose = (idx) => {
      const chosenId = state.thief.options[idx];
      const otherId = state.thief.options[1 - idx];

      // enforce mustWolf
      if (state.thief.mustWolf && chosenId !== "wolf") {
        beepVibrate();
        alert("底牌含狼人牌：必須選狼人那張。");
        return;
      }

      const thiefSeat = state.seats.find(s => s.no === seatNo);
      if (!thiefSeat) return;

      const chosenMeta = roleMetaById(chosenId);
      thiefSeat.roleId = chosenId;
      thiefSeat.roleName = chosenMeta ? chosenMeta.name : chosenId;
      thiefSeat.camp = chosenMeta ? chosenMeta.camp : "good";

      state.thief.chosen = true;

      // remove both extra cards (consumed / discarded)
      state.deckExtra = [];

      pushLog(
        "盜賊已完成二選一。（結果不公開）",
        `盜賊座位：${seatNo}\n選擇：${chosenMeta ? chosenMeta.name : chosenId}\n捨棄：${roleMetaById(otherId)?.name || otherId}`
      );

      save();
      closeModal(thiefModal);
      renderAll();
    };

    btnThiefA.onclick = () => choose(0);
    btnThiefB.onclick = () => choose(1);
    btnThiefClose.onclick = () => {
      // cannot close if not chosen (avoid stuck)
      if (!state.thief.chosen) {
        alert("盜賊必須先完成二選一，才能繼續。");
        return;
      }
      closeModal(thiefModal);
    };

    openModal(thiefModal);
  }

  /* ---------- Deal role modal actions ---------- */
  function afterRoleDone() {
    if (!state.selectedSeat) return;
    const s = state.seats.find(x => x.no === state.selectedSeat);
    if (!s) return;

    s.viewed = true;
    s.done = true;
    s.covered = true; // ✅看完立刻蓋牌（格子不露出角色）
    save();

    // if this seat is thief and not chosen -> open thief choose immediately
    if (s.no === state.thief.seat && !state.thief.chosen) {
      closeModal(roleModal);
      // open thief choose
      setTimeout(openThiefChoose, 60);
      renderAll();
      return;
    }

    closeModal(roleModal);
    renderAll();
  }

  /* ---------- Night step confirmation ---------- */
  function resolveNightStepConfirm() {
    const order = buildNightOrder();
    const cur = order[state.step - 1];
    if (!cur) {
      // already finished
      state.step = order.length + 1;
      save();
      renderAll();
      return;
    }

    const sel = state.selectedSeat;

    // helper to set event icon on seat
    const addEvent = (seatNo, icon) => {
      const s = state.seats.find(x => x.no === seatNo);
      if (!s) return;
      if (!s.events.includes(icon)) s.events.push(icon);
    };

    if (cur.id === "cupid") {
      // simple: pick two lovers -> store as events only (for now)
      // To pick two, we use a small buffer in state.tempCupid
      state.tempCupid = state.tempCupid || [];
      if (!sel) { alert("請先點選第一位戀人"); return; }
      if (state.tempCupid.includes(sel)) {
        // cancel same
        state.tempCupid = state.tempCupid.filter(x => x !== sel);
        state.selectedSeat = null;
        save(); renderAll(); return;
      }
      state.tempCupid.push(sel);
      addEvent(sel, "💘");
      state.selectedSeat = null;

      if (state.tempCupid.length < 2) {
        save(); renderAll();
        return; // wait for second pick
      }
      // confirm cupid
      pushLog("邱比特已完成（不公開）。", `戀人：${state.tempCupid[0]} & ${state.tempCupid[1]}`);
      delete state.tempCupid;
      state.step += 1;
      save();
      renderAll();
      return;
    }

    if (cur.id === "guard") {
      if (!sel) { alert("請點選守護目標"); return; }
      state.guardTarget = sel;
      addEvent(sel, "🛡守");
      // clear selection
      state.selectedSeat = null;
      state.step += 1;
      save();
      renderAll();
      return;
    }

    if (cur.id === "wolves") {
      if (!sel) { alert("請點選狼人刀人目標"); return; }
      state.wolfTarget = sel;
      addEvent(sel, "🐺刀");
      state.selectedSeat = null;
      state.step += 1;
      save();
      renderAll();
      return;
    }

    if (cur.id === "seer") {
      if (!sel) { alert("請點選預言家查驗目標"); return; }
      state.seerCheck = sel;
      const checked = state.seats.find(x => x.no === sel);
      const res = checked?.camp === "wolf" ? "狼人" : "好人";
      state.seerResult = res;
      pushLog(
        "預言家已查驗（不公開）。",
        `預言家查驗：${sel} → ${res}`
      );
      state.selectedSeat = null;
      state.step += 1;
      save();
      renderAll();
      return;
    }

    if (cur.id === "witch") {
      // Witch logic:
      // - click wolfTarget = heal (if heal available)
      // - click other = poison (if poison available)
      if (!sel) {
        // allow skip
        state.step += 1;
        save(); renderAll();
        return;
      }

      if (sel === state.wolfTarget) {
        if (!state.witch.heal) { alert("解藥已用完"); return; }
        // choose heal -> clears poison choice
        state.witch.healTarget = sel;
        state.witch.poisonTarget = null;
        addEvent(sel, "💊救");
      } else {
        if (!state.witch.poison) { alert("毒藥已用完"); return; }
        state.witch.poisonTarget = sel;
        state.witch.healTarget = null;
        addEvent(sel, "🧪毒");
      }

      // confirm consumes one
      if (state.witch.healTarget) state.witch.heal = false;
      if (state.witch.poisonTarget) state.witch.poison = false;

      state.selectedSeat = null;
      state.step += 1;
      save();
      renderAll();
      return;
    }
  }

  function resolveNightToDay() {
    // Apply night results: wolfTarget, guardTarget, witch heal/poison
    const killed = new Set();

    // wolf kill unless guarded or healed
    if (state.wolfTarget) {
      const guarded = state.guardTarget && state.guardTarget === state.wolfTarget;
      const healed = state.witch.healTarget && state.witch.healTarget === state.wolfTarget;
      if (!guarded && !healed) killed.add(state.wolfTarget);
    }

    // poison
    if (state.witch.poisonTarget) killed.add(state.witch.poisonTarget);

    // mark deaths with reason (store with night index)
    const deaths = [...killed];
    deaths.forEach((no) => {
      const s = state.seats.find(x => x.no === no);
      if (!s || !s.alive) return;
      s.alive = false;
      const r = [];
      if (no === state.wolfTarget && !(state.guardTarget === no) && !(state.witch.healTarget === no)) r.push("狼刀");
      if (no === state.witch.poisonTarget) r.push("毒死");
      s.deathReason = `N${state.night}：${r.join("+") || "死亡"}`;
    });

    // public log
    if (deaths.length === 0) {
      pushLog("昨夜結果：平安夜");
    } else {
      pushLog(`昨夜結果：${deaths.map(x => `${x}號`).join("、")} 死亡`);
    }

    // reset per-night selections
    state.guardLast = state.guardTarget;
    state.guardTarget = null;
    state.wolfTarget = null;
    state.seerCheck = null;
    state.seerResult = null;
    state.witch.healTarget = null;
    state.witch.poisonTarget = null;

    // advance to DAY
    state.phase = "DAY";
    state.step = 1;
    save();
    renderAll();
  }

  /* ---------- Button actions ---------- */
  btnBack.addEventListener("click", () => {
    if (state.phase === "SETUP") return;

    if (state.phase === "DEAL") {
      // back returns to setup
      state.phase = "SETUP";
      state.step = 1;
      state.seats = [];
      save();
      renderAll();
      return;
    }

    if (state.phase === "NIGHT") {
      state.step = Math.max(1, state.step - 1);
      save();
      renderAll();
      return;
    }

    if (state.phase === "DAY") {
      // no-op for now
      return;
    }

    if (state.phase === "VOTE") {
      // no-op for now
      return;
    }
  });

  btnNext.addEventListener("click", () => {
    if (state.phase === "SETUP") {
      // go to deal
      startNewGameFromSetup();
      return;
    }

    if (state.phase === "DEAL") {
      // next just refresh; start night is via btnMain
      renderAll();
      return;
    }

    if (state.phase === "NIGHT") {
      // confirm current step
      resolveNightStepConfirm();
      return;
    }

    if (state.phase === "DAY") {
      // next -> no-op (major action uses btnMain)
      return;
    }

    if (state.phase === "VOTE") {
      // for now: end vote quickly
      pushLog("投票結算（此版本先略過詳細操作）");
      state.phase = "NIGHT";
      state.night += 1;
      state.step = 1;
      save();
      renderAll();
      return;
    }
  });

  btnMain.addEventListener("click", () => {
    if (state.phase === "DEAL") {
      if (!(dealAllDone() && !needThiefChoice())) return;

      // go NIGHT
      state.phase = "NIGHT";
      state.step = 1;

      // clear any previous per-night selection
      state.selectedSeat = null;
      state.guardTarget = null;
      state.wolfTarget = null;
      state.seerCheck = null;
      state.seerResult = null;
      state.witch.healTarget = null;
      state.witch.poisonTarget = null;

      pushLog("進入夜晚。");
      save();
      renderAll();
      return;
    }

    if (state.phase === "NIGHT") {
      // if night steps not finished, jump to end only when finished
      const order = buildNightOrder();
      if (state.step <= order.length) {
        alert("夜晚流程尚未完成：請按「下一步」依序完成每個角色動作。");
        return;
      }
      resolveNightToDay();
      return;
    }

    if (state.phase === "DAY") {
      state.phase = "VOTE";
      state.step = 1;
      pushLog("開始投票。");
      save();
      renderAll();
      return;
    }

    if (state.phase === "VOTE") {
      // go next night
      state.phase = "NIGHT";
      state.night += 1;
      state.day += 1;
      state.step = 1;
      pushLog("進入天黑。");
      save();
      renderAll();
      return;
    }
  });

  /* ---------- Top icon buttons ---------- */
  btnAnn.addEventListener("click", () => {
    renderLogs();
    openDrawer(annBackdrop, annDrawer);
  });
  btnCloseAnn.addEventListener("click", () => closeDrawer(annBackdrop, annDrawer));
  annBackdrop.addEventListener("click", () => closeDrawer(annBackdrop, annDrawer));
  toggleAnnGod.addEventListener("change", renderLogs);

  btnTimer.addEventListener("click", () => {
    timerBig.textContent = fmtMMSS(state.timer.remain);
    openDrawer(timerBackdrop, timerDrawer);
  });
  btnCloseTimer.addEventListener("click", () => closeDrawer(timerBackdrop, timerDrawer));
  timerBackdrop.addEventListener("click", () => closeDrawer(timerBackdrop, timerDrawer));

  timerPresets.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const sec = Number(t.dataset.sec || 0);
    if (!sec) return;
    setTimer(sec);
  });
  btnTimerStart.addEventListener("click", () => {
    state.timer.running = true;
    state.timer.lastTick = Date.now();
    save();
  });
  btnTimerPause.addEventListener("click", () => {
    state.timer.running = false;
    save();
  });
  btnTimerReset.addEventListener("click", () => {
    state.timer.running = false;
    setTimer(90);
  });

  btnEye.addEventListener("click", () => {
    state.godMode = !state.godMode;
    save();
    renderSeats();
  });

  btnDice.addEventListener("click", () => {
    const alive = state.seats.filter(s => s.alive).map(s => s.no);
    if (!alive.length) {
      diceResult.textContent = "（無存活座位）";
    } else {
      const pick = alive[Math.floor(Math.random() * alive.length)];
      diceResult.textContent = `${pick} 號`;
    }
    openModal(diceModal);
  });
  btnDiceAgain.addEventListener("click", () => {
    const alive = state.seats.filter(s => s.alive).map(s => s.no);
    if (!alive.length) return;
    const pick = alive[Math.floor(Math.random() * alive.length)];
    diceResult.textContent = `${pick} 號`;
  });
  btnDiceClose.addEventListener("click", () => closeModal(diceModal));
  diceModal.addEventListener("click", (e) => {
    if (e.target === diceModal) closeModal(diceModal);
  });

  btnSettings.addEventListener("click", () => {
    togglePolice.checked = !!state.hasPolice;
    segEdge.classList.toggle("primary", state.winMode === "edge");
    segCity.classList.toggle("primary", state.winMode === "city");
    openDrawer(setBackdrop, setDrawer);
  });
  btnCloseSet.addEventListener("click", () => closeDrawer(setBackdrop, setDrawer));
  setBackdrop.addEventListener("click", () => closeDrawer(setBackdrop, setDrawer));

  segEdge.addEventListener("click", () => {
    state.winMode = "edge";
    segEdge.classList.add("primary");
    segCity.classList.remove("primary");
    save();
  });
  segCity.addEventListener("click", () => {
    state.winMode = "city";
    segCity.classList.add("primary");
    segEdge.classList.remove("primary");
    save();
  });
  togglePolice.addEventListener("change", () => {
    state.hasPolice = !!togglePolice.checked;
    save();
  });

  btnGotoSetup.addEventListener("click", () => {
    // go setup (keep boards selection)
    state.phase = "SETUP";
    state.step = 1;
    state.seats = [];
    state.logs = [];
    state.selectedSeat = null;
    save();
    closeDrawer(setBackdrop, setDrawer);
    renderAll();
  });

  btnHardReset.addEventListener("click", () => {
    if (!confirm("確定清空資料並重置？")) return;
    hardReset();
  });

  /* ---------- Role modal buttons ---------- */
  btnRoleDone.addEventListener("click", afterRoleDone);
  btnRoleClose.addEventListener("click", () => {
    closeModal(roleModal);
    renderAll();
  });
  roleModal.addEventListener("click", (e) => {
    if (e.target === roleModal) closeModal(roleModal);
  });

  /* ---------- Phase bootstrapping ---------- */
  function boot() {
    // Ensure consistent N with board
    const b = getBoard();
    state.n = b.n;

    // If state seats missing but not setup, reset to setup
    if (state.phase !== "SETUP" && (!state.seats || !state.seats.length)) {
      state.phase = "SETUP";
      state.step = 1;
      save();
    }

    // Fix: if board list filtered and selected not in current n -> pick first
    const first = BOARDS.find(x => x.n === state.n);
    if (first && !BOARDS.find(x => x.id === state.boardId && x.n === state.n)) {
      state.boardId = first.id;
    }

    // Timer default
    if (!state.timer || typeof state.timer.remain !== "number") {
      state.timer = { running:false, remain:90, lastTick:0 };
    }

    renderAll();
  }

  boot();
})();