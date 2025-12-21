/* =========================
   Werewolf God Helper - app.js (with VOTE system)
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
  document.addEventListener(
    "contextmenu",
    (e) => {
      e.preventDefault();
    },
    { passive: false }
  );

  // best-effort prevent double-tap zoom
  let lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) e.preventDefault();
      lastTouchEnd = now;
    },
    { passive: false }
  );

  /* ---------- Storage ---------- */
  const KEY = "ww_god_v7";
  const load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  const save = () => localStorage.setItem(KEY, JSON.stringify(state));
  const hardReset = () => {
    localStorage.removeItem(KEY);
    location.reload();
  };

  /* ---------- Roles ---------- */
  const ROLE = {
    VILLAGER: { id: "villager", name: "平民", camp: "good", night: false },
    WOLF: { id: "wolf", name: "狼人", camp: "wolf", night: true, group: "wolves" },

    SEER: { id: "seer", name: "預言家", camp: "good", night: true },
    WITCH: { id: "witch", name: "女巫", camp: "good", night: true },
    HUNTER: { id: "hunter", name: "獵人", camp: "good", night: false },
    GUARD: { id: "guard", name: "守衛", camp: "good", night: true },
    IDIOT: { id: "idiot", name: "白癡", camp: "good", night: false },

    CUPID: { id: "cupid", name: "邱比特", camp: "good", night: true, firstNightOnly: true },
    THIEF: { id: "thief", name: "盜賊", camp: "good", night: false, special: "thief" },
  };

  const roleMetaById = (id) => {
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
  };

  /* ---------- Boards (fallback) ---------- */
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
      // ✅狼人固定最多 4
      roles: { wolf: 4, seer: 1, witch: 1, hunter: 1, guard: 1, idiot: 1, thief: 1, villager: 2 },
      thiefScriptAlwaysAsk: true,
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
  const beepVibrate = () => {
    try {
      navigator.vibrate?.(80);
    } catch {}
  };

  /* ---------- State ---------- */
  const defaultState = () => ({
    phase: "SETUP", // SETUP | DEAL | NIGHT | DAY | VOTE
    step: 1,
    n: 12,
    boardId: "official-12",
    winMode: "edge",
    hasPolice: true,

    godMode: false,
    selectedSeat: null,

    seats: [],
    deckExtra: [],

    thief: { seat: null, chosen: false, options: [], mustWolf: false },

    day: 1, // 初始白天視為 Day1，第一晚後變 Day2（符合你截圖）
    night: 1,

    logs: [],

    guardTarget: null,
    wolfTarget: null,
    seerCheck: null,
    seerResult: null,
    witch: { heal: true, poison: true, healTarget: null, poisonTarget: null },

    // ✅投票
    vote: { voter: null, map: {}, finalized: false },

    timer: { running: false, remain: 90, lastTick: 0 },
  });

  let state = load() || defaultState();

  /* ---------- Seat model ---------- */
  const makeSeats = (n) =>
    Array.from({ length: n }, (_, idx) => ({
      no: idx + 1,
      alive: true,
      roleId: null,
      roleName: "",
      camp: "good",
      viewed: false,
      done: false,
      covered: true,
      events: [],
      deathReason: "",
    }));

  /* ---------- Board helpers ---------- */
  const getBoard = () => BOARDS.find((b) => b.id === state.boardId) || BOARDS[0];

  const boardSummary = (board) => {
    const roles = board.roles;
    const parts = [];
    const add = (id, cnt) => {
      if (!cnt) return;
      parts.push(`${cnt}${roleMetaById(id)?.name || id}`);
    };
    add("wolf", roles.wolf || 0);
    add("seer", roles.seer || 0);
    add("witch", roles.witch || 0);
    add("hunter", roles.hunter || 0);
    add("guard", roles.guard || 0);
    add("idiot", roles.idiot || 0);
    add("cupid", roles.cupid || 0);
    add("thief", roles.thief || 0);
    add("villager", roles.villager || 0);
    return `${parts.join(" + ")}${board.extra ? ` + 底牌${board.extra}` : ""}`;
  };

  const buildDeckFromBoard = (board) => {
    const deck = [];
    const add = (id, count) => {
      for (let i = 0; i < count; i++) deck.push(id);
    };
    Object.entries(board.roles).forEach(([id, cnt]) => add(id, cnt));

    const expected = board.n + (board.extra || 0);
    const diff = expected - deck.length;
    if (diff > 0) add("villager", diff);
    if (diff < 0) deck.splice(0, Math.min(deck.length, -diff));

    return shuffle(deck);
  };

  /* ---------- Logs ---------- */
  const pushLog = (textPublic, textGod = "") => {
    state.logs.push({
      t: Date.now(),
      day: state.day,
      night: state.night,
      phase: state.phase,
      textPublic,
      textGod,
    });
    save();
  };

  const renderLogs = () => {
    const showGod = !!toggleAnnGod.checked;
    const lines = state.logs.map((l) => {
      const head =
        l.phase === "NIGHT"
          ? `🌙 夜晚 ${l.night}`
          : l.phase === "DAY"
          ? `☀️ 白天 ${l.day}`
          : l.phase === "VOTE"
          ? `🗳 投票（白天 ${l.day}）`
          : `📌 記錄`;

      const body = showGod && l.textGod ? l.textGod : l.textPublic;
      return `${head}\n${body}\n`;
    });
    annText.textContent = lines.length ? lines.join("\n") : "（尚無公告）";
  };

  /* ---------- UI: drawers & modals ---------- */
  const openDrawer = (backdrop, drawer) => {
    backdrop.classList.remove("hidden");
    drawer.classList.remove("hidden");
    drawer.setAttribute("aria-hidden", "false");
  };
  const closeDrawer = (backdrop, drawer) => {
    backdrop.classList.add("hidden");
    drawer.classList.add("hidden");
    drawer.setAttribute("aria-hidden", "true");
  };
  const openModal = (modal) => {
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  };
  const closeModal = (modal) => {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  };

  /* ---------- Timer ---------- */
  const fmtMMSS = (sec) => {
    sec = clamp(Math.floor(sec), 0, 35999);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${pad2(m)}:${pad2(s)}`;
  };

  const timerTick = () => {
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
  };
  setInterval(timerTick, 200);

  const setTimer = (sec) => {
    state.timer.remain = sec;
    timerBig.textContent = fmtMMSS(sec);
    save();
  };

  /* ---------- Setup UI ---------- */
  const renderBoardList = () => {
    const avail = BOARDS.filter((b) => b.n === state.n);
    boardList.innerHTML = "";
    avail.forEach((b) => {
      const el = document.createElement("div");
      el.className = "boardItem" + (b.id === state.boardId ? " selected" : "");
      el.dataset.id = b.id;
      el.innerHTML = `
        <div class="title">${b.name}</div>
        <div class="sub">${b.id} ・ ${boardSummary(b)}</div>
        <div class="tags">${(b.tags || []).map((t) => `<span class="badge">${t}</span>`).join("")}</div>
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
  };

  const bindSetupChips = () => {
    document.querySelectorAll(".chip[data-n]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const n = Number(btn.dataset.n);
        state.n = n;
        const first = BOARDS.find((b) => b.n === n);
        if (first) {
          state.boardId = first.id;
          state.hasPolice = !!first.hasPolice;
        }
        save();
        document.querySelectorAll(".chip[data-n]").forEach((b) => b.classList.toggle("active", Number(b.dataset.n) === n));
        renderBoardList();
        renderTop();
        renderPrompt();
      });
    });
    document.querySelectorAll(".chip[data-n]").forEach((b) => b.classList.toggle("active", Number(b.dataset.n) === state.n));
  };

  /* ---------- Game init ---------- */
  const startNewGameFromSetup = () => {
    const board = getBoard();
    state.phase = "DEAL";
    state.step = 1;
    state.selectedSeat = null;

    state.day = 1; // Day1（第一晚後 Day2）
    state.night = 1;

    state.logs = [];

    state.guardTarget = null;
    state.wolfTarget = null;
    state.seerCheck = null;
    state.seerResult = null;
    state.witch = { heal: true, poison: true, healTarget: null, poisonTarget: null };

    state.vote = { voter: null, map: {}, finalized: false };

    state.seats = makeSeats(board.n);

    const deck = buildDeckFromBoard(board);

    // deal seats
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

    // thief extras
    state.deckExtra = deck.slice(board.n);
    state.thief = { seat: null, chosen: false, options: [], mustWolf: false };
    const thiefSeat = state.seats.find((s) => s.roleId === "thief");
    if (thiefSeat) state.thief.seat = thiefSeat.no;

    pushLog(`已開局：${board.name}\n人數：${board.n}\n（進入抽身分）`, `板子：${board.id}\n配置：${boardSummary(board)}`);

    save();
    renderAll();
  };

  /* ---------- Long press to reveal (0.3s) ---------- */
  const HOLD_MS = 300;
  let holdTimer = null;
  const clearHold = () => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  };

  const showRoleModal = (seatNo) => {
    const s = state.seats.find((x) => x.no === seatNo);
    if (!s) return;
    roleModalTitle.textContent = `${seatNo}號 身分`;
    roleModalRole.textContent = s.roleName || "—";
    const campName = s.camp === "wolf" ? "狼人" : s.camp === "third" ? "第三方" : "好人";
    roleModalCamp.textContent = `陣營：${campName}`;
    openModal(roleModal);
  };

  const setupSeatPressHandlers = (btn, seatNo) => {
    const onDown = (e) => {
      e.preventDefault?.();
      clearHold();
      holdTimer = setTimeout(() => {
        if (state.phase !== "DEAL") return;
        if (state.selectedSeat !== seatNo) return;
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
  };

  /* ---------- Thief choose ---------- */
  const needThiefChoice = () => {
    const board = getBoard();
    if (board.id !== "12-thief") return false;
    if (!state.thief.seat) return false;
    return !state.thief.chosen;
  };

  const openThiefChoose = () => {
    const board = getBoard();
    if (board.extra !== 2) return;
    const seatNo = state.thief.seat;
    if (!seatNo) return;

    const opts = [...state.deckExtra];
    if (opts.length < 2) return;

    state.thief.options = opts.slice(0, 2);
    state.thief.mustWolf = state.thief.options.includes("wolf");
    save();

    const optNames = state.thief.options.map((id) => roleMetaById(id)?.name || id);
    thiefHint.textContent = state.thief.mustWolf
      ? "底牌含狼人牌：你只能選『狼人陣營』那張。"
      : "請從兩張底牌中選一張成為你的角色。";

    btnThiefA.textContent = optNames[0];
    btnThiefB.textContent = optNames[1];

    const choose = (idx) => {
      const chosenId = state.thief.options[idx];
      const otherId = state.thief.options[1 - idx];

      if (state.thief.mustWolf && chosenId !== "wolf") {
        beepVibrate();
        alert("底牌含狼人牌：必須選狼人那張。");
        return;
      }

      const thiefSeat = state.seats.find((s) => s.no === seatNo);
      if (!thiefSeat) return;

      const chosenMeta = roleMetaById(chosenId);
      thiefSeat.roleId = chosenId;
      thiefSeat.roleName = chosenMeta ? chosenMeta.name : chosenId;
      thiefSeat.camp = chosenMeta ? chosenMeta.camp : "good";

      state.thief.chosen = true;
      state.deckExtra = []; // consumed

      pushLog("盜賊已完成二選一。（結果不公開）", `盜賊座位：${seatNo}\n選擇：${chosenMeta ? chosenMeta.name : chosenId}\n捨棄：${roleMetaById(otherId)?.name || otherId}`);

      save();
      closeModal(thiefModal);
      renderAll();
    };

    btnThiefA.onclick = () => choose(0);
    btnThiefB.onclick = () => choose(1);

    btnThiefClose.onclick = () => {
      alert("盜賊必須先完成二選一，才能繼續。");
    };

    openModal(thiefModal);
  };

  /* ---------- Vote system ---------- */
  const resetVote = () => {
    state.vote = { voter: null, map: {}, finalized: false };
    // init alive voters
    state.seats.forEach((s) => {
      if (s.alive) state.vote.map[String(s.no)] = null; // null = 未投/棄票
    });
  };

  const voteSet = (voter, targetOrNull) => {
    if (!state.vote || state.vote.finalized) return;
    if (!state.seats.find((s) => s.no === voter && s.alive)) return;

    // target can be null(abstain) or an alive seat
    if (targetOrNull !== null) {
      const t = state.seats.find((s) => s.no === targetOrNull && s.alive);
      if (!t) return;
    }

    state.vote.map[String(voter)] = targetOrNull;
    save();
  };

  const voteTally = () => {
    const aliveNos = state.seats.filter((s) => s.alive).map((s) => s.no);
    const counts = new Map();
    const detail = new Map(); // target -> voters[]
    let abstain = [];

    aliveNos.forEach((t) => {
      counts.set(t, 0);
      detail.set(t, []);
    });

    for (const voterStr of Object.keys(state.vote.map || {})) {
      const voter = Number(voterStr);
      const to = state.vote.map[voterStr];
      if (to === null) {
        abstain.push(voter);
      } else if (counts.has(to)) {
        counts.set(to, counts.get(to) + 1);
        detail.get(to).push(voter);
      }
    }

    // determine max
    let max = 0;
    aliveNos.forEach((t) => (max = Math.max(max, counts.get(t) || 0)));
    const maxTargets = aliveNos.filter((t) => (counts.get(t) || 0) === max && max > 0);

    return { aliveNos, counts, detail, abstain, max, maxTargets };
  };

  const voteTextForPrompt = () => {
    const { aliveNos, counts, detail, abstain } = voteTally();
    const lines = [];
    lines.push("投票操作：");
    lines.push("1) 點『投票者』 2) 點『被投者』");
    lines.push("棄票：投票者 → 再點投票者（自己）一次 = 棄票");
    lines.push("");
    lines.push("目前票型：");
    aliveNos.forEach((t) => {
      const voters = detail.get(t) || [];
      if (!voters.length) return;
      lines.push(`投給${t}號（${counts.get(t)}）：${voters.join("、")}`);
    });
    lines.push(`棄票/未投：${abstain.length ? abstain.join("、") : "—"}`);
    return lines.join("\n");
  };

  const finalizeVote = () => {
    const { aliveNos, counts, detail, abstain, max, maxTargets } = voteTally();

    // build public text
    const publicLines = [];
    aliveNos.forEach((t) => {
      const voters = detail.get(t) || [];
      if (voters.length) publicLines.push(`投給${t}號（${counts.get(t)}）：${voters.join("、")}`);
    });
    publicLines.push(`棄票/未投：${abstain.length ? abstain.join("、") : "—"}`);

    let resultLine = "";
    if (max === 0 || maxTargets.length === 0) {
      resultLine = "結果：無有效投票，無放逐。";
    } else if (maxTargets.length >= 2) {
      resultLine = `結果：平票（${maxTargets.join("、")}），無放逐。`;
    } else {
      const exiled = maxTargets[0];
      resultLine = `結果：放逐 ${exiled} 號。`;
      const s = state.seats.find((x) => x.no === exiled);
      if (s && s.alive) {
        s.alive = false;
        s.deathReason = `D${state.day}：放逐`;
        if (!s.events.includes("🗳放逐")) s.events.push("🗳放逐");
      }
    }

    publicLines.push(resultLine);

    pushLog(publicLines.join("\n"));
    state.vote.finalized = true;
    state.vote.voter = null;
    state.selectedSeat = null;
    save();
  };

  /* ---------- Seats rendering ---------- */
  const seatSubText = (seat) => {
    if (state.phase === "DEAL") {
      if (state.godMode) {
        const campName = seat.camp === "wolf" ? "狼人" : seat.camp === "third" ? "第三方" : "好人";
        return `${seat.roleName}・${campName}`;
      }
      return "長按看身分";
    }

    if (state.phase === "VOTE") {
      // show vote arrow for voter
      const to = state.vote?.map?.[String(seat.no)];
      if (to === null) return "棄票/未投";
      if (typeof to === "number") return `→ ${to}號`;
      return "棄票/未投";
    }

    if (state.godMode) {
      const campName = seat.camp === "wolf" ? "狼人" : seat.camp === "third" ? "第三方" : "好人";
      return `${seat.roleName}・${campName}`;
    }

    return seat.alive ? "存活" : "死亡";
  };

  const seatMetaLines = (seat) => {
    if (!state.godMode) return "";
    const lines = [];
    if (!seat.alive && seat.deathReason) lines.push(`☠ ${seat.deathReason}`);
    if (seat.events?.length) lines.push(seat.events.join(" "));
    return lines.join("\n");
  };

  const renderSeats = () => {
    seatsGrid.innerHTML = "";
    const board = getBoard();
    for (let i = 1; i <= board.n; i++) {
      const seat = state.seats[i - 1];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "seat";
      btn.dataset.no = String(i);

      // selected highlight
      if (state.phase === "VOTE") {
        if (state.vote?.voter === i) btn.classList.add("selected");
      } else {
        if (state.selectedSeat === i) btn.classList.add("selected");
      }

      if (!seat.alive) btn.classList.add("dead");

      // god coloring
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

      // click behaviors by phase
      btn.addEventListener("click", (e) => {
        e.preventDefault?.();

        // ✅ VOTE phase
        if (state.phase === "VOTE") {
          if (state.vote.finalized) return;

          // pick voter first
          if (!state.vote.voter) {
            if (!seat.alive) return;
            state.vote.voter = i;
            save();
            renderSeats();
            renderPrompt();
            return;
          }

          const voter = state.vote.voter;

          // click same as voter => abstain
          if (i === voter) {
            voteSet(voter, null);
            state.vote.voter = null;
            save();
            renderSeats();
            renderPrompt();
            return;
          }

          // set vote to target
          if (!seat.alive) return;
          voteSet(voter, i);
          state.vote.voter = null;
          save();
          renderSeats();
          renderPrompt();
          return;
        }

        // ✅ normal selection (toggle)
        if (state.selectedSeat === i) state.selectedSeat = null;
        else state.selectedSeat = i;
        save();
        renderSeats();
      });

      setupSeatPressHandlers(btn, i);
      seatsGrid.appendChild(btn);
    }
  };

  /* ---------- Top / Prompt / Bottom ---------- */
  const countDone = () => state.seats.filter((s) => s.done).length;
  const dealAllDone = () => countDone() >= getBoard().n;

  const buildNightOrder = () => {
    const board = getBoard();
    const hasRole = (id) => state.seats.some((s) => s.roleId === id);

    const order = [];
    if (hasRole("cupid")) order.push({ id: "cupid", label: "邱比特請睜眼（選兩位戀人）", pick: "two" });
    order.push({ id: "guard", label: "守衛請閉眼（選擇守護）", pick: "one" });
    order.push({ id: "wolves", label: "狼人請閉眼（選擇刀人）", pick: "one" });
    order.push({ id: "seer", label: "預言家請閉眼（查驗一人）", pick: "one" });
    order.push({ id: "witch", label: "女巫請閉眼（解藥 / 毒藥）", pick: "witch" });

    if (board.thiefScriptAlwaysAsk) return order;
    return order.filter((s) => (s.id === "wolves" ? hasRole("wolf") : hasRole(s.id)));
  };

  const buildNightScriptText = () => {
    const order = buildNightOrder();
    const lines = [];
    lines.push("夜晚開始：");
    order.forEach((s, idx) => lines.push(`${idx + 1}. ${s.label}`));

    const cur = order[state.step - 1];
    if (cur) {
      lines.push("");
      lines.push(`👉 目前：${state.step}. ${cur.label}`);
      if (cur.pick === "one") lines.push("（點座位選取；再點同號取消；按「下一步」確認）");
      if (cur.pick === "two") lines.push("（依序選 2 位；可取消；按「下一步」確認）");
      if (cur.pick === "witch") {
        lines.push("（女巫：點『被刀的人』= 解藥救；點『其他人』= 毒；同晚只能擇一；按「下一步」確認）");
        lines.push(`狀態：${state.witch.heal ? "💊解藥可用" : "💊解藥已用"} / ${state.witch.poison ? "🧪毒藥可用" : "🧪毒藥已用"}`);
      }
    } else {
      lines.push("");
      lines.push("（夜晚流程已完成，可按「天亮睜眼」進入白天）");
    }
    return lines.join("\n");
  };

  const calcLastNightResultText = () => {
    const deaths = state.seats.filter((s) => !s.alive && s.deathReason && s.deathReason.includes(`N${state.night}`));
    if (!deaths.length) return "平安夜";
    if (deaths.length === 1) return `${deaths[0].no} 號死亡`;
    return deaths.map((d) => `${d.no}號`).join("、") + " 死亡";
  };

  const buildDayScriptText = () => {
    return (
      "天亮了，請宣布昨夜結果：\n" +
      `— 昨夜結果：${calcLastNightResultText()}\n\n` +
      "白天流程：自由發言 →（可上警）→ 推理/辯論 → 投票"
    );
  };

  const renderTop = () => {
    const board = getBoard();
    uiBoard.textContent = board.id || "—";

    let st = "";
    if (state.phase === "SETUP") st = "SETUP / step 1";
    else if (state.phase === "DEAL") st = `抽身分 (${countDone()}/${board.n})`;
    else if (state.phase === "NIGHT") st = `🌙 NIGHT ${state.night} / step ${state.step}`;
    else if (state.phase === "DAY") st = `☀️ DAY ${state.day} / step ${state.step}`;
    else if (state.phase === "VOTE") st = `🗳 投票 / 白天 ${state.day}`;
    uiStatus.textContent = st;
  };

  const renderPrompt = () => {
    if (state.phase === "SETUP") {
      promptTitle.textContent = "開局";
      promptText.textContent = "先選人數 → 再選板子（點一下會變色）\n選完按底部「下一步」進入抽身分。";
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
      promptFoot.textContent = "";
      return;
    }

    if (state.phase === "DAY") {
      promptTitle.textContent = `白天 ${state.day}`;
      promptText.textContent = buildDayScriptText();
      promptFoot.textContent = "按「開始投票」進入投票統計。";
      return;
    }

    if (state.phase === "VOTE") {
      promptTitle.textContent = `投票（白天 ${state.day}）`;
      promptText.textContent = voteTextForPrompt();
      promptFoot.textContent = state.vote.finalized ? "已結算。按「進入天黑」開始下一晚。" : "按「下一步」結算公告。";
      return;
    }
  };

  const renderBottomButtons = () => {
    btnBack.disabled = state.phase === "SETUP";

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
      btnMain.disabled = !state.vote.finalized;
    }

    btnNext.disabled = false;
  };

  const renderSetupVisibility = () => {
    const inSetup = state.phase === "SETUP";
    setupCard.classList.toggle("hidden", !inSetup);
    seatsHeader.classList.toggle("hidden", inSetup);
    seatsGrid.classList.toggle("hidden", inSetup);
  };

  const renderAll = () => {
    renderTop();
    renderSetupVisibility();
    if (state.phase === "SETUP") {
      bindSetupChips();
      renderBoardList();
    } else {
      renderSeats();
    }
    renderPrompt();
    renderBottomButtons();
    renderLogs();
  };

  /* ---------- Deal role modal actions ---------- */
  const afterRoleDone = () => {
    if (!state.selectedSeat) return;
    const s = state.seats.find((x) => x.no === state.selectedSeat);
    if (!s) return;

    s.viewed = true;
    s.done = true;
    s.covered = true; // ✅看完立即蓋牌
    save();

    if (s.no === state.thief.seat && !state.thief.chosen) {
      closeModal(roleModal);
      setTimeout(openThiefChoose, 60);
      renderAll();
      return;
    }

    closeModal(roleModal);
    renderAll();
  };

  /* ---------- Night actions ---------- */
  const resolveNightStepConfirm = () => {
    const order = buildNightOrder();
    const cur = order[state.step - 1];
    if (!cur) {
      state.step = order.length + 1;
      save();
      renderAll();
      return;
    }

    const sel = state.selectedSeat;

    const addEvent = (seatNo, icon) => {
      const s = state.seats.find((x) => x.no === seatNo);
      if (!s) return;
      if (!s.events.includes(icon)) s.events.push(icon);
    };

    if (cur.id === "guard") {
      if (!sel) return alert("請點選守護目標");
      state.guardTarget = sel;
      addEvent(sel, "🛡守");
      state.selectedSeat = null;
      state.step += 1;
      save();
      renderAll();
      return;
    }

    if (cur.id === "wolves") {
      if (!sel) return alert("請點選狼人刀人目標");
      state.wolfTarget = sel;
      addEvent(sel, "🐺刀");
      state.selectedSeat = null;
      state.step += 1;
      save();
      renderAll();
      return;
    }

    if (cur.id === "seer") {
      if (!sel) return alert("請點選預言家查驗目標");
      state.seerCheck = sel;
      const checked = state.seats.find((x) => x.no === sel);
      const res = checked?.camp === "wolf" ? "狼人" : "好人";
      state.seerResult = res;
      pushLog("預言家已查驗（不公開）。", `預言家查驗：${sel} → ${res}`);
      state.selectedSeat = null;
      state.step += 1;
      save();
      renderAll();
      return;
    }

    if (cur.id === "witch") {
      if (!sel) {
        state.step += 1;
        save();
        renderAll();
        return;
      }

      if (sel === state.wolfTarget) {
        if (!state.witch.heal) return alert("解藥已用完");
        state.witch.healTarget = sel;
        state.witch.poisonTarget = null;
        addEvent(sel, "💊救");
      } else {
        if (!state.witch.poison) return alert("毒藥已用完");
        state.witch.poisonTarget = sel;
        state.witch.healTarget = null;
        addEvent(sel, "🧪毒");
      }

      if (state.witch.healTarget) state.witch.heal = false;
      if (state.witch.poisonTarget) state.witch.poison = false;

      state.selectedSeat = null;
      state.step += 1;
      save();
      renderAll();
      return;
    }

    // cupid (optional) - 先略過細節，不影響流程
    if (cur.id === "cupid") {
      state.step += 1;
      save();
      renderAll();
      return;
    }
  };

  const resolveNightToDay = () => {
    const killed = new Set();

    if (state.wolfTarget) {
      const guarded = state.guardTarget && state.guardTarget === state.wolfTarget;
      const healed = state.witch.healTarget && state.witch.healTarget === state.wolfTarget;
      if (!guarded && !healed) killed.add(state.wolfTarget);
    }
    if (state.witch.poisonTarget) killed.add(state.witch.poisonTarget);

    const deaths = [...killed];
    deaths.forEach((no) => {
      const s = state.seats.find((x) => x.no === no);
      if (!s || !s.alive) return;
      s.alive = false;
      const r = [];
      if (no === state.wolfTarget) r.push("狼刀");
      if (no === state.witch.poisonTarget) r.push("毒死");
      s.deathReason = `N${state.night}：${r.join("+") || "死亡"}`;
    });

    if (deaths.length === 0) pushLog("昨夜結果：平安夜");
    else pushLog(`昨夜結果：${deaths.map((x) => `${x}號`).join("、")} 死亡`);

    // reset
    state.guardTarget = null;
    state.wolfTarget = null;
    state.seerCheck = null;
    state.seerResult = null;
    state.witch.healTarget = null;
    state.witch.poisonTarget = null;

    // ✅進白天：day +1（Night1 → Day2）
    state.phase = "DAY";
    state.step = 1;
    state.day += 1;

    save();
    renderAll();
  };

  /* ---------- Buttons ---------- */
  btnBack.addEventListener("click", () => {
    if (state.phase === "SETUP") return;

    if (state.phase === "DEAL") {
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

    if (state.phase === "VOTE") {
      // 取消目前選的投票者
      state.vote.voter = null;
      save();
      renderSeats();
      renderPrompt();
      return;
    }
  });

  btnNext.addEventListener("click", () => {
    if (state.phase === "SETUP") {
      startNewGameFromSetup();
      return;
    }

    if (state.phase === "NIGHT") {
      resolveNightStepConfirm();
      return;
    }

    if (state.phase === "VOTE") {
      if (!state.vote.finalized) {
        finalizeVote();
        renderAll();
      }
      return;
    }
  });

  btnMain.addEventListener("click", () => {
    if (state.phase === "DEAL") {
      if (!(dealAllDone() && !needThiefChoice())) return;

      state.phase = "NIGHT";
      state.step = 1;
      state.selectedSeat = null;

      pushLog("進入夜晚。");
      save();
      renderAll();
      return;
    }

    if (state.phase === "NIGHT") {
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
      resetVote();
      pushLog("開始投票。");
      save();
      renderAll();
      return;
    }

    if (state.phase === "VOTE") {
      if (!state.vote.finalized) return;

      // ✅進入下一晚：只加 night，不加 day（day 在天亮時才 +1）
      state.phase = "NIGHT";
      state.night += 1;
      state.step = 1;
      state.selectedSeat = null;
      state.vote.voter = null;

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
    const alive = state.seats.filter((s) => s.alive).map((s) => s.no);
    diceResult.textContent = alive.length ? `${alive[Math.floor(Math.random() * alive.length)]} 號` : "（無存活座位）";
    openModal(diceModal);
  });
  btnDiceAgain.addEventListener("click", () => {
    const alive = state.seats.filter((s) => s.alive).map((s) => s.no);
    if (!alive.length) return;
    diceResult.textContent = `${alive[Math.floor(Math.random() * alive.length)]} 號`;
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

  /* ---------- Role modal ---------- */
  btnRoleDone.addEventListener("click", afterRoleDone);
  btnRoleClose.addEventListener("click", () => {
    closeModal(roleModal);
    renderAll();
  });
  roleModal.addEventListener("click", (e) => {
    if (e.target === roleModal) closeModal(roleModal);
  });

  /* ---------- Boot ---------- */
  const boot = () => {
    const b = getBoard();
    state.n = b.n;

    if (state.phase !== "SETUP" && (!state.seats || !state.seats.length)) {
      state.phase = "SETUP";
      state.step = 1;
      save();
    }

    const first = BOARDS.find((x) => x.n === state.n);
    if (first && !BOARDS.find((x) => x.id === state.boardId && x.n === state.n)) {
      state.boardId = first.id;
    }

    if (!state.timer || typeof state.timer.remain !== "number") {
      state.timer = { running: false, remain: 90, lastTick: 0 };
    }

    renderAll();
  };

  boot();
})();