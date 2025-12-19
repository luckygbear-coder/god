/* =========================
   狼人殺上帝輔助 - 單頁整合版
   - 上帝抽屜 👁️
   - 計時器抽屜 ⌛️
   - 可選板子卡片 + 自訂配置
   - 防 iOS 長按選取/放大
========================= */

(() => {
  // ---------- iOS 防選取/放大（更保險：JS 層補強） ----------
  document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("contextmenu", (e) => e.preventDefault(), { passive: false });

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const pad2 = (n) => (n < 10 ? "0" + n : "" + n);
  const fmtTime = (sec) => `${pad2(Math.floor(sec / 60))}:${pad2(sec % 60)}`;

  // ---------- DOM ----------
  const uiStatus = $("uiStatus");
  const uiBoard = $("uiBoard");

  const btnTimer = $("btnTimer");
  const btnDice = $("btnDice");
  const btnGodDrawer = $("btnGodDrawer");
  const btnSettings = $("btnSettings");

  const jumpFlow = $("jumpFlow");
  const jumpSeats = $("jumpSeats");
  const jumpGod = $("jumpGod");
  const mainScroll = $("mainScroll");

  const promptTitle = $("promptTitle");
  const promptText = $("promptText");
  const promptFoot = $("promptFoot");
  const toolRow = $("toolRow");
  const btnVoteDrawer = $("btnVoteDrawer");

  const peopleChips = $("peopleChips");
  const boardGrid = $("boardGrid");
  const boardPickerHint = $("boardPickerHint");

  const wolvesMinus = $("wolvesMinus");
  const wolvesPlus = $("wolvesPlus");
  const wolvesVal = $("wolvesVal");
  const villagersVal = $("villagersVal");
  const roleToggles = $("roleToggles");
  const btnApplyCustom = $("btnApplyCustom");

  const seatsGrid = $("seatsGrid");
  const seatHint = $("seatHint");

  const godSummary = $("godSummary");
  const btnOpenGodDrawer2 = $("btnOpenGodDrawer2");

  const btnBack = $("btnBack");
  const btnPrimary = $("btnPrimary");
  const btnCancel = $("btnCancel");

  const backdrop = $("backdrop");
  const drawerSettings = $("drawerSettings");
  const btnCloseSettings = $("btnCloseSettings");
  const segEdge = $("segEdge");
  const segCity = $("segCity");
  const togglePolice = $("togglePolice");
  const btnReset = $("btnReset");

  const drawerGod = $("drawerGod");
  const btnCloseGod = $("btnCloseGod");
  const godText = $("godText");

  const drawerTimer = $("drawerTimer");
  const btnCloseTimer = $("btnCloseTimer");
  const timerBig = $("timerBig");
  const timerPresets = $("timerPresets");
  const btnTimerStart = $("btnTimerStart");
  const btnTimerPause = $("btnTimerPause");
  const btnTimerReset = $("btnTimerReset");

  const drawerVote = $("drawerVote");
  const btnCloseVote = $("btnCloseVote");
  const voteAnnounceText = $("voteAnnounceText");

  const roleModal = $("roleModal");
  const roleModalTitle = $("roleModalTitle");
  const roleModalRole = $("roleModalRole");
  const roleModalCamp = $("roleModalCamp");
  const btnRoleDone = $("btnRoleDone");
  const btnRoleClose = $("btnRoleClose");

  const diceModal = $("diceModal");
  const diceResult = $("diceResult");
  const btnDiceAgain = $("btnDiceAgain");
  const btnDiceClose = $("btnDiceClose");

  // ---------- Data ----------
  const ROLE_META = {
    seer:   { name: "預言家", camp: "神", tag: "🔮" },
    witch:  { name: "女巫", camp: "神", tag: "🧪" },
    guard:  { name: "守衛", camp: "神", tag: "🛡️" },
    hunter: { name: "獵人", camp: "神", tag: "🏹" },
    idiot:  { name: "白痴", camp: "神", tag: "🤪" },
  };

  const BUILTIN_BOARDS = [
    {
      id: "official-12",
      title: "12 人官方標準局",
      players: 12,
      wolves: 4,
      gods: ["seer", "witch", "guard", "hunter"],
      tags: ["官方", "穩", "含白癡?（可自訂）"],
      desc: "4狼 + 預言家/女巫/守衛/獵人 + 4民",
      note: "可在「自訂配置」勾白痴、調狼數"
    },
    {
      id: "12-city",
      title: "12 人（標準角色・屠城）",
      players: 12,
      wolves: 4,
      gods: ["seer", "witch", "guard", "hunter"],
      tags: ["測試", "屠城"],
      desc: "同標準角色，但勝負改屠城",
      preset: { winMode: "city" }
    },
    {
      id: "12-edge-nopolice",
      title: "12 人（屠邊・無上警）",
      players: 12,
      wolves: 4,
      gods: ["seer", "witch", "guard", "hunter"],
      tags: ["測試", "無上警"],
      desc: "同標準角色，但關閉上警",
      preset: { hasPolice: false }
    },
    {
      id: "official-10",
      title: "10 人官方簡化局",
      players: 10,
      wolves: 3,
      gods: ["seer", "witch", "hunter"],
      tags: ["官方", "快節奏"],
      desc: "3狼 + 預言家/女巫/獵人 + 4民"
    },
    {
      id: "official-9",
      title: "9 人官方快速局",
      players: 9,
      wolves: 3,
      gods: ["seer", "witch"],
      tags: ["官方", "超快"],
      desc: "3狼 + 預言家/女巫 + 4民"
    }
  ];

  // ---------- Persistent state ----------
  const STORAGE_KEY = "werewolf_god_v3_singlepage";
  const defaultState = () => ({
    phase: "SETUP",                // SETUP | DEAL | PLAY
    step: "SETUP_PEOPLE",          // flow step key
    round: 1,
    timeOfDay: "NIGHT",            // NIGHT / DAY

    playerCount: 12,
    boardId: "official-12",

    // settings
    winMode: "edge",               // edge | city
    hasPolice: true,

    // custom
    custom: {
      wolves: 4,
      gods: { seer: true, witch: true, guard: true, hunter: true, idiot: false },
      applied: false
    },

    // seats
    seats: [],                     // { n, alive, roleKey, revealed }
    lastAction: null,

    // voting
    voting: {
      open: false,
      votes: {}                    // voter -> target (number or 0 for abstain)
    },

    // timer
    timer: {
      baseSec: 90,
      leftSec: 90,
      running: false,
      lastTick: 0
    },

    // per-night memory (simplified)
    night: {
      wolfTarget: null,
      guardTarget: null,
      witchSave: false,
      witchPoisonTarget: null,
      seerTarget: null,
      guardAlive: true
    },

    // UI selection highlight
    selectMode: "NONE",            // NONE | PICK_WOLF | PICK_SAVE | PICK_POISON | PICK_CHECK | PICK_KILL | PICK_VOTE
    selectedSeat: null,
  });

  let S = loadState();
  ensureSeats();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return { ...defaultState(), ...parsed };
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
  }

  function ensureSeats() {
    if (!Array.isArray(S.seats) || S.seats.length !== S.playerCount) {
      S.seats = Array.from({ length: S.playerCount }, (_, i) => ({
        n: i + 1,
        alive: true,
        roleKey: null,
        revealed: false,
      }));
    } else {
      // trim/expand if needed
      if (S.seats.length > S.playerCount) S.seats = S.seats.slice(0, S.playerCount);
      if (S.seats.length < S.playerCount) {
        const start = S.seats.length;
        for (let i = start; i < S.playerCount; i++) {
          S.seats.push({ n: i + 1, alive: true, roleKey: null, revealed: false });
        }
      }
    }
  }

  // ---------- Board building ----------
  function buildBoardFromBuiltin(boardId) {
    const b = BUILTIN_BOARDS.find(x => x.id === boardId);
    if (!b) return null;
    const gods = [...b.gods];
    const villagers = b.players - b.wolves - gods.length;
    return {
      id: b.id,
      title: b.title,
      players: b.players,
      wolves: b.wolves,
      gods,
      villagers,
      tags: b.tags || [],
      desc: b.desc || "",
      preset: b.preset || null
    };
  }

  function buildBoardFromCustom() {
    const players = S.playerCount;
    const wolves = S.custom.wolves;
    const gods = Object.keys(S.custom.gods).filter(k => S.custom.gods[k]);
    const villagers = players - wolves - gods.length;
    return {
      id: "custom",
      title: "自訂板子",
      players,
      wolves,
      gods,
      villagers,
      tags: ["自訂"],
      desc: `${wolves}狼 + ${gods.map(k => ROLE_META[k].name).join(" / ") || "無神"} + ${villagers}民`
    };
  }

  function getActiveBoard() {
    if (S.boardId === "custom") return buildBoardFromCustom();
    return buildBoardFromBuiltin(S.boardId);
  }

  // ---------- UI: drawers ----------
  function openDrawer(which) {
    backdrop.classList.remove("hidden");
    if (which === "settings") drawerSettings.classList.remove("hidden");
    if (which === "god") drawerGod.classList.remove("hidden");
    if (which === "timer") drawerTimer.classList.remove("hidden");
    if (which === "vote") drawerVote.classList.remove("hidden");
    lockAria();
  }
  function closeAllDrawers() {
    backdrop.classList.add("hidden");
    drawerSettings.classList.add("hidden");
    drawerGod.classList.add("hidden");
    drawerTimer.classList.add("hidden");
    drawerVote.classList.add("hidden");
    lockAria();
  }
  function lockAria() {
    drawerSettings.setAttribute("aria-hidden", drawerSettings.classList.contains("hidden") ? "true" : "false");
    drawerGod.setAttribute("aria-hidden", drawerGod.classList.contains("hidden") ? "true" : "false");
    drawerTimer.setAttribute("aria-hidden", drawerTimer.classList.contains("hidden") ? "true" : "false");
    drawerVote.setAttribute("aria-hidden", drawerVote.classList.contains("hidden") ? "true" : "false");
  }

  backdrop.addEventListener("click", closeAllDrawers);

  btnSettings.addEventListener("click", () => openDrawer("settings"));
  btnCloseSettings.addEventListener("click", closeAllDrawers);

  btnGodDrawer.addEventListener("click", () => {
    renderGod();
    openDrawer("god");
  });
  btnOpenGodDrawer2.addEventListener("click", () => {
    renderGod();
    openDrawer("god");
  });
  btnCloseGod.addEventListener("click", closeAllDrawers);

  btnTimer.addEventListener("click", () => openDrawer("timer"));
  btnCloseTimer.addEventListener("click", closeAllDrawers);

  btnVoteDrawer.addEventListener("click", () => {
    renderVoteAnnounce();
    openDrawer("vote");
  });
  btnCloseVote.addEventListener("click", closeAllDrawers);

  // ---------- Jump (scroll to sections) ----------
  function setActiveTab(btn) {
    [jumpFlow, jumpSeats, jumpGod].forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
  }
  function scrollToSection(id, btn) {
    const el = document.getElementById(id);
    if (!el) return;
    setActiveTab(btn);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  jumpFlow.addEventListener("click", () => scrollToSection("secFlow", jumpFlow));
  jumpSeats.addEventListener("click", () => scrollToSection("secSeats", jumpSeats));
  jumpGod.addEventListener("click", () => scrollToSection("secGod", jumpGod));

  // ---------- Settings ----------
  function renderSettings() {
    segEdge.classList.toggle("active", S.winMode === "edge");
    segCity.classList.toggle("active", S.winMode === "city");
    togglePolice.checked = !!S.hasPolice;
  }
  segEdge.addEventListener("click", () => { S.winMode = "edge"; saveState(); renderAll(); });
  segCity.addEventListener("click", () => { S.winMode = "city"; saveState(); renderAll(); });
  togglePolice.addEventListener("change", () => { S.hasPolice = togglePolice.checked; saveState(); renderAll(); });

  btnReset.addEventListener("click", () => {
    S = defaultState();
    saveState();
    ensureSeats();
    renderAll();
    closeAllDrawers();
  });

  // ---------- People chips ----------
  const PEOPLE_OPTIONS = [9, 10, 12];
  function renderPeople() {
    peopleChips.innerHTML = "";
    for (const n of PEOPLE_OPTIONS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (S.playerCount === n ? " active" : "");
      b.textContent = `${n}人`;
      b.addEventListener("click", () => {
        S.playerCount = n;
        ensureSeats();

        // sync custom defaults
        if (n === 12) S.custom.wolves = clamp(S.custom.wolves, 3, 5);
        if (n === 10) S.custom.wolves = clamp(S.custom.wolves, 2, 4);
        if (n === 9)  S.custom.wolves = clamp(S.custom.wolves, 2, 4);

        // auto choose a matching builtin board if current mismatch
        const match = BUILTIN_BOARDS.find(x => x.players === n && x.id.includes("official"));
        if (match) S.boardId = match.id;

        saveState();
        renderAll();
      });
      peopleChips.appendChild(b);
    }
  }

  // ---------- Boards ----------
  function boardRoleLine(board) {
    const godNames = board.gods.map(k => ROLE_META[k]?.name || k).join("/");
    return `${board.wolves}狼 + ${godNames || "無神"} + ${board.villagers}民`;
  }

  function renderBoards() {
    const playerCount = S.playerCount;
    const list = BUILTIN_BOARDS.filter(b => b.players === playerCount);

    boardGrid.innerHTML = "";

    // builtin boards
    for (const b0 of list) {
      const b = buildBoardFromBuiltin(b0.id);
      const card = document.createElement("div");
      card.className = "boardCard" + (S.boardId === b.id ? " selected" : "");
      card.tabIndex = 0;

      card.innerHTML = `
        <div class="title">${b0.title}</div>
        <div class="sub">${b0.id} ・ ${boardRoleLine(b)}</div>
        <div class="sub">${b0.desc || ""}</div>
        <div class="boardTags">
          ${(b0.tags || []).map(t => `<span class="tag">${t}</span>`).join("")}
        </div>
      `;

      card.addEventListener("click", () => {
        S.boardId = b.id;
        // apply preset changes if board has them
        if (b0.preset?.winMode) S.winMode = b0.preset.winMode;
        if (typeof b0.preset?.hasPolice === "boolean") S.hasPolice = b0.preset.hasPolice;
        saveState();
        renderAll();
      });

      boardGrid.appendChild(card);
    }

    // custom board card (only if custom applied or id=custom)
    if (S.custom.applied || S.boardId === "custom") {
      const cb = buildBoardFromCustom();
      const card = document.createElement("div");
      card.className = "boardCard" + (S.boardId === "custom" ? " selected" : "");
      card.innerHTML = `
        <div class="title">自訂板子</div>
        <div class="sub">custom ・ ${boardRoleLine(cb)}</div>
        <div class="boardTags"><span class="tag">自訂</span></div>
      `;
      card.addEventListener("click", () => {
        S.boardId = "custom";
        saveState();
        renderAll();
      });
      boardGrid.appendChild(card);
    }

    boardPickerHint.textContent = `目前人數：${playerCount} 人（點一下套用板子，選中會變色）`;
  }

  // ---------- Custom config ----------
  const CUSTOM_ROLE_ORDER = [
    ["seer", "🔮 預言家"],
    ["witch", "🧪 女巫"],
    ["guard", "🛡️ 守衛"],
    ["hunter", "🏹 獵人"],
    ["idiot", "🤪 白痴"],
  ];

  function calcVillagers(players, wolves, godsCount) {
    return players - wolves - godsCount;
  }

  function renderCustom() {
    wolvesVal.textContent = String(S.custom.wolves);

    const godsCount = Object.values(S.custom.gods).filter(Boolean).length;
    const villagers = calcVillagers(S.playerCount, S.custom.wolves, godsCount);
    villagersVal.textContent = String(villagers);

    roleToggles.innerHTML = "";
    for (const [k, label] of CUSTOM_ROLE_ORDER) {
      const box = document.createElement("label");
      box.className = "roleToggle";
      box.innerHTML = `
        <span class="name">${label}</span>
        <input type="checkbox" ${S.custom.gods[k] ? "checked" : ""} />
      `;
      const input = box.querySelector("input");
      input.addEventListener("change", () => {
        S.custom.gods[k] = input.checked;

        // ensure villagers not negative (auto limit)
        const gc = Object.values(S.custom.gods).filter(Boolean).length;
        let v = calcVillagers(S.playerCount, S.custom.wolves, gc);
        if (v < 0) {
          // revert if impossible
          input.checked = false;
          S.custom.gods[k] = false;
        }
        saveState();
        renderCustom();
      });
      roleToggles.appendChild(box);
    }

    // wolves stepper
    wolvesMinus.onclick = () => {
      S.custom.wolves = clamp(S.custom.wolves - 1, 1, S.playerCount - 1);
      fixCustomFeasible();
      saveState();
      renderCustom();
    };
    wolvesPlus.onclick = () => {
      S.custom.wolves = clamp(S.custom.wolves + 1, 1, S.playerCount - 1);
      fixCustomFeasible();
      saveState();
      renderCustom();
    };
  }

  function fixCustomFeasible() {
    // if villagers negative, drop roles from the end
    while (true) {
      const gc = Object.values(S.custom.gods).filter(Boolean).length;
      const v = calcVillagers(S.playerCount, S.custom.wolves, gc);
      if (v >= 0) break;
      // turn off last checked role
      const last = [...CUSTOM_ROLE_ORDER].reverse().find(([k]) => S.custom.gods[k]);
      if (!last) break;
      S.custom.gods[last[0]] = false;
    }
  }

  btnApplyCustom.addEventListener("click", () => {
    const gc = Object.values(S.custom.gods).filter(Boolean).length;
    const v = calcVillagers(S.playerCount, S.custom.wolves, gc);
    if (v < 0) return;

    S.custom.applied = true;
    S.boardId = "custom";
    saveState();
    renderAll();
  });

  // ---------- Seats UI ----------
  function renderSeats() {
    seatsGrid.innerHTML = "";
    for (const seat of S.seats) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "seat";
      if (!seat.alive) btn.classList.add("dead");
      if (S.selectedSeat === seat.n) btn.classList.add("selected");

      // mode outline
      if (S.selectMode === "PICK_WOLF") btn.classList.add("pickWolf");
      if (S.selectMode === "PICK_SAVE") btn.classList.add("pickSave");
      if (S.selectMode === "PICK_POISON") btn.classList.add("pickPoison");
      if (S.selectMode === "PICK_CHECK") btn.classList.add("pickCheck");

      btn.innerHTML = `
        <div class="n">${seat.n}號</div>
        <div class="s">${seat.alive ? "存活" : "死亡"}</div>
      `;

      btn.addEventListener("click", () => onSeatClick(seat.n));
      btn.addEventListener("pointerdown", (e) => {
        // 防止 iOS 長按造成選取/放大更穩
        e.preventDefault();
      });

      seatsGrid.appendChild(btn);
    }
  }

  function onSeatClick(n) {
    // ignore dead in some modes
    const seat = S.seats[n - 1];
    if (!seat) return;

    S.selectedSeat = n;
    saveState();
    renderSeats();

    // handle by mode
    if (S.phase === "DEAL") {
      // long-press will show role; click just highlight
      return;
    }

    if (S.selectMode === "PICK_WOLF") {
      if (!seat.alive) return;
      S.night.wolfTarget = n;
      S.lastAction = `🐺 狼人刀：${n}號`;
      saveState();
      renderAll();
      return;
    }

    if (S.selectMode === "PICK_CHECK") {
      if (!seat.alive) return;
      S.night.seerTarget = n;
      const camp = getCampOfSeat(n);
      S.lastAction = `🔮 預言家查驗：${n}號 → ${camp}`;
      saveState();
      renderAll();
      return;
    }

    if (S.selectMode === "PICK_SAVE") {
      // save must be wolf target
      if (S.night.wolfTarget !== n) {
        S.lastAction = `🧪 解藥只能點刀口（目前刀口：${S.night.wolfTarget ?? "未選"}）`;
        saveState();
        renderAll();
        return;
      }
      S.night.witchSave = true;
      S.night.witchPoisonTarget = null;
      S.lastAction = `🧪 女巫解藥：救 ${n}號`;
      saveState();
      renderAll();
      return;
    }

    if (S.selectMode === "PICK_POISON") {
      if (!seat.alive) return;
      // poison and save cannot both
      S.night.witchPoisonTarget = n;
      S.night.witchSave = false;
      S.lastAction = `🧪 女巫毒藥：毒 ${n}號`;
      saveState();
      renderAll();
      return;
    }
  }

  function getCampOfSeat(n) {
    const seat = S.seats[n - 1];
    if (!seat?.roleKey) return "（未分配）";
    if (seat.roleKey === "wolf") return "狼";
    if (seat.roleKey === "villager") return "好人";
    return "好人";
  }

  // ---------- Deal / roles ----------
  function buildRoleBag(board) {
    const bag = [];
    for (let i = 0; i < board.wolves; i++) bag.push("wolf");
    for (const g of board.gods) bag.push(g);
    for (let i = 0; i < board.villagers; i++) bag.push("villager");
    return bag;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function dealRoles() {
    const board = getActiveBoard();
    if (!board) return;

    // apply board player count (safety)
    S.playerCount = board.players;
    ensureSeats();

    const bag = shuffle(buildRoleBag(board));
    for (let i = 0; i < S.seats.length; i++) {
      S.seats[i].roleKey = bag[i] || "villager";
      S.seats[i].revealed = false;
      S.seats[i].alive = true;
    }

    S.phase = "DEAL";
    S.step = "DEAL";
    S.selectedSeat = null;

    // reset night memory
    S.night = {
      wolfTarget: null,
      guardTarget: null,
      witchSave: false,
      witchPoisonTarget: null,
      seerTarget: null,
      guardAlive: true
    };

    // reset voting
    S.voting = { open: false, votes: {} };

    saveState();
  }

  // long press to reveal
  let pressTimer = null;
  function attachSeatLongPress() {
    // delegate by capturing on seatsGrid
    seatsGrid.addEventListener("touchstart", (e) => {
      const btn = e.target.closest(".seat");
      if (!btn) return;
      if (S.phase !== "DEAL") return;

      e.preventDefault();

      const idx = [...seatsGrid.children].indexOf(btn);
      if (idx < 0) return;
      const seatN = idx + 1;

      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        showRoleModal(seatN);
      }, 300);
    }, { passive: false });

    seatsGrid.addEventListener("touchend", () => clearTimeout(pressTimer));
    seatsGrid.addEventListener("touchcancel", () => clearTimeout(pressTimer));

    // pointer (desktop)
    seatsGrid.addEventListener("pointerdown", (e) => {
      const btn = e.target.closest(".seat");
      if (!btn) return;
      if (S.phase !== "DEAL") return;

      e.preventDefault();

      const idx = [...seatsGrid.children].indexOf(btn);
      if (idx < 0) return;
      const seatN = idx + 1;

      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => showRoleModal(seatN), 300);
    });

    seatsGrid.addEventListener("pointerup", () => clearTimeout(pressTimer));
    seatsGrid.addEventListener("pointercancel", () => clearTimeout(pressTimer));
  }

  function roleName(roleKey) {
    if (roleKey === "wolf") return "狼人";
    if (roleKey === "villager") return "平民";
    return ROLE_META[roleKey]?.name || roleKey;
  }
  function roleCamp(roleKey) {
    if (roleKey === "wolf") return "陣營：狼";
    if (roleKey === "villager") return "陣營：民";
    return `陣營：${ROLE_META[roleKey]?.camp || "神"}`;
  }

  function showRoleModal(n) {
    const seat = S.seats[n - 1];
    if (!seat) return;

    roleModalTitle.textContent = `${n}號 身分`;
    roleModalRole.textContent = roleName(seat.roleKey);
    roleModalCamp.textContent = roleCamp(seat.roleKey);

    roleModal.classList.remove("hidden");
    roleModal.setAttribute("aria-hidden", "false");

    // mark revealed (but still allow re-watch)
    seat.revealed = true;
    saveState();
    renderAll();
  }

  function closeRoleModal() {
    roleModal.classList.add("hidden");
    roleModal.setAttribute("aria-hidden", "true");
  }
  btnRoleClose.addEventListener("click", closeRoleModal);
  btnRoleDone.addEventListener("click", closeRoleModal);

  // ---------- Dice ----------
  function openDice() {
    const alive = S.seats.filter(s => s.alive).map(s => s.n);
    if (alive.length === 0) {
      diceResult.textContent = "—";
    } else {
      const pick = alive[Math.floor(Math.random() * alive.length)];
      diceResult.textContent = `${pick}號`;
    }
    diceModal.classList.remove("hidden");
    diceModal.setAttribute("aria-hidden", "false");
  }
  function closeDice() {
    diceModal.classList.add("hidden");
    diceModal.setAttribute("aria-hidden", "true");
  }
  btnDice.addEventListener("click", openDice);
  btnDiceAgain.addEventListener("click", openDice);
  btnDiceClose.addEventListener("click", closeDice);

  // ---------- Timer ----------
  function tickTimer() {
    if (!S.timer.running) return;
    const now = Date.now();
    const dt = Math.floor((now - S.timer.lastTick) / 1000);
    if (dt <= 0) return;
    S.timer.lastTick = now;
    S.timer.leftSec = Math.max(0, S.timer.leftSec - dt);
    if (S.timer.leftSec === 0) {
      S.timer.running = false;
      // vibration if supported
      if (navigator.vibrate) navigator.vibrate([120, 80, 120]);
    }
    saveState();
    renderTimer();
  }

  setInterval(tickTimer, 250);

  function setTimer(sec) {
    S.timer.baseSec = sec;
    S.timer.leftSec = sec;
    S.timer.running = false;
    saveState();
    renderTimer();
  }

  function renderTimer() {
    timerBig.textContent = fmtTime(S.timer.leftSec);
  }

  timerPresets.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    const sec = Number(btn.dataset.sec || 0);
    if (!sec) return;
    setTimer(sec);
  });

  btnTimerStart.addEventListener("click", () => {
    if (S.timer.leftSec <= 0) S.timer.leftSec = S.timer.baseSec;
    S.timer.running = true;
    S.timer.lastTick = Date.now();
    saveState();
    renderTimer();
  });
  btnTimerPause.addEventListener("click", () => {
    S.timer.running = false;
    saveState();
    renderTimer();
  });
  btnTimerReset.addEventListener("click", () => {
    S.timer.running = false;
    S.timer.leftSec = S.timer.baseSec;
    saveState();
    renderTimer();
  });

  // ---------- Vote announce formatting ----------
  function renderVoteAnnounce() {
    const votes = S.voting.votes || {};
    const byTarget = new Map(); // target -> voters[]
    const abstain = [];

    for (const [voterStr, target] of Object.entries(votes)) {
      const voter = Number(voterStr);
      if (!target || target === 0) {
        abstain.push(voter);
      } else {
        if (!byTarget.has(target)) byTarget.set(target, []);
        byTarget.get(target).push(voter);
      }
    }

    // sort
    abstain.sort((a,b)=>a-b);
    const targets = [...byTarget.keys()].sort((a,b)=>a-b);
    for (const t of targets) byTarget.get(t).sort((a,b)=>a-b);

    // determine max
    let maxT = null, maxCnt = -1;
    for (const t of targets) {
      const c = byTarget.get(t).length;
      if (c > maxCnt) { maxCnt = c; maxT = t; }
    }

    let out = "";
    for (const t of targets) {
      const arr = byTarget.get(t);
      out += `投給${t}號的有 ${arr.join("、") || "（無）"}（${arr.length}票）\n`;
    }
    out += `棄票的有 ${abstain.join("、") || "（無）"}（${abstain.length}票）\n`;

    if (maxT != null) out += `\n${maxT}號得到最高票遭到放逐`;
    else out += `\n（尚無投票資料）`;

    voteAnnounceText.textContent = out;
  }

  // ---------- God view ----------
  function renderGod() {
    const board = getActiveBoard();
    const lines = [];

    lines.push(`人數：${S.playerCount}`);
    lines.push(`板子：${board?.id || S.boardId}`);
    lines.push(`勝負：${S.winMode === "edge" ? "屠邊" : "屠城"}`);
    lines.push(`上警：${S.hasPolice ? "開" : "關"}`);
    lines.push(`抽身分：${S.seats.every(s => !!s.roleKey) ? "已分配" : "尚未分配"}`);
    lines.push(`存活：狼 ${countAlive("wolf")} / 好人 ${countAliveGood()}`);
    lines.push("");

    lines.push("【座位角色表】");
    for (const s of S.seats) {
      const r = s.roleKey ? roleName(s.roleKey) : "（未分配）";
      lines.push(`${pad2(s.n)}號：${r}${s.alive ? "" : "（死亡）"}`);
    }

    godText.textContent = lines.join("\n");

    // on-page summary (short)
    godSummary.textContent =
      `人數：${S.playerCount}\n` +
      `板子：${board?.id || S.boardId}\n` +
      `勝負：${S.winMode === "edge" ? "屠邊" : "屠城"}｜上警：${S.hasPolice ? "開" : "關"}\n` +
      `存活：狼 ${countAlive("wolf")} / 好人 ${countAliveGood()}\n` +
      `（完整角色表請用右上 👁️ 抽屜）`;
  }

  function countAlive(roleKey) {
    return S.seats.filter(s => s.alive && s.roleKey === roleKey).length;
  }
  function countAliveGood() {
    return S.seats.filter(s => s.alive && s.roleKey !== "wolf").length;
  }

  // ---------- Flow / steps ----------
  function setFlow(step, title, text, foot, selectMode = "NONE") {
    S.step = step;
    S.selectMode = selectMode;
    saveState();

    promptTitle.textContent = title;
    promptText.textContent = text;
    promptFoot.textContent = foot || "";
    seatHint.textContent = selectMode === "NONE" ? "點座位查看狀態 /（依流程提示操作）" : "點座位完成本步驟選擇（選到會變色）";
  }

  function renderFlow() {
    const board = getActiveBoard();
    uiStatus.textContent = `${S.phase} / ${S.step}`;
    uiBoard.textContent = board?.id || "—";

    // show/hide vote drawer button (example: when vote data exists)
    const hasVotes = S.voting && Object.keys(S.voting.votes || {}).length > 0;
    btnVoteDrawer.classList.toggle("hidden", !hasVotes);

    // SETUP
    if (S.phase === "SETUP") {
      setFlow(
        "SETUP",
        `設定：選板子`,
        `目前人數：${S.playerCount}\n請在下方「可選板子」點一下套用。\n\n也可以用「自訂配置」調整：狼人數 / 神職（白痴等）\n套用後按「下一步」進入抽身分。`,
        `提示：板子選中會變色，方便辨識。`
      );
      return;
    }

    // DEAL
    if (S.phase === "DEAL") {
      const allSeen = S.seats.every(s => s.revealed);
      setFlow(
        "DEAL",
        "抽身分",
        "請把手機交給玩家：\n- 長按座位 0.3 秒翻牌\n- 看完按「關閉」\n全部看完才能「下一步」。",
        allSeen ? "✅ 全部已看完，可以進入夜晚。" : "（尚有人未看）"
      );
      return;
    }

    // PLAY - simplified cycle
    if (S.phase === "PLAY") {
      if (S.timeOfDay === "NIGHT") {
        // night sequence simplified
        const lines = [];
        lines.push(`夜晚 ${S.round}`);
        lines.push("");
        lines.push("依序操作：");
        lines.push("1) 狼人刀人（點座位）");
        lines.push("2) 女巫（同晚解藥/毒藥只能擇一）");
        lines.push("3) 預言家查驗（點座位顯示結果）");
        lines.push("");
        lines.push("目前紀錄：");
        lines.push(`- 狼刀：${S.night.wolfTarget ?? "未選"}`);
        lines.push(`- 女巫救：${S.night.witchSave ? "是" : "否"}`);
        lines.push(`- 女巫毒：${S.night.witchPoisonTarget ?? "未選"}`);
        lines.push(`- 查驗：${S.night.seerTarget ?? "未選"}`);
        if (S.lastAction) lines.push(`\n最後操作：${S.lastAction}`);

        let mode = "NONE";
        // choose next expected action
        if (!S.night.wolfTarget) mode = "PICK_WOLF";
        else if (hasRole("witch") && !S.night.witchSave && !S.night.witchPoisonTarget) mode = "PICK_SAVE"; // default to save mode first
        else if (hasRole("seer") && !S.night.seerTarget) mode = "PICK_CHECK";

        setFlow(
          "NIGHT",
          `夜晚 ${S.round}`,
          lines.join("\n"),
          "按「下一步」結算夜晚 → 進白天",
          mode
        );
        return;
      }

      // DAY
      const d = [];
      d.push(`白天 ${S.round}`);
      d.push("");
      d.push("你可以：");
      d.push("- 點座位標記（例如：投票記錄/放逐）");
      d.push("- 需要公告可用「投票公告」抽屜");
      if (S.lastAction) d.push(`\n最後操作：${S.lastAction}`);

      setFlow(
        "DAY",
        `白天 ${S.round}`,
        d.join("\n"),
        "按「下一步」進入下一晚（或顯示結局）",
        "NONE"
      );
    }
  }

  function hasRole(roleKey) {
    return S.seats.some(s => s.roleKey === roleKey);
  }

  // ---------- Buttons: back/next/cancel ----------
  btnCancel.addEventListener("click", () => {
    S.selectedSeat = null;
    S.selectMode = "NONE";
    S.lastAction = "取消本次選擇";
    saveState();
    renderAll();
  });

  btnBack.addEventListener("click", () => {
    // simple back: go to setup if in deal; otherwise toggle day/night for demo
    if (S.phase === "DEAL") {
      S.phase = "SETUP";
      S.step = "SETUP";
      saveState();
      renderAll();
      return;
    }

    if (S.phase === "PLAY") {
      S.timeOfDay = (S.timeOfDay === "NIGHT") ? "DAY" : "NIGHT";
      S.lastAction = "手動切換（上一步）";
      saveState();
      renderAll();
      return;
    }
  });

  btnPrimary.addEventListener("click", () => {
    // SETUP -> DEAL
    if (S.phase === "SETUP") {
      const board = getActiveBoard();
      if (!board) return;
      dealRoles();
      renderAll();
      return;
    }

    // DEAL -> PLAY (only if all seen)
    if (S.phase === "DEAL") {
      const allSeen = S.seats.every(s => s.revealed);
      if (!allSeen) {
        S.lastAction = "⚠️ 還有人未看完身分";
        saveState();
        renderAll();
        return;
      }
      S.phase = "PLAY";
      S.timeOfDay = "NIGHT";
      S.round = 1;
      S.lastAction = null;
      // reset night picks
      S.night.wolfTarget = null;
      S.night.witchSave = false;
      S.night.witchPoisonTarget = null;
      S.night.seerTarget = null;
      saveState();
      renderAll();
      return;
    }

    // PLAY transitions
    if (S.phase === "PLAY") {
      if (S.timeOfDay === "NIGHT") {
        // resolve night (simplified)
        const killed = [];

        if (S.night.wolfTarget) killed.push(S.night.wolfTarget);
        if (S.night.witchSave && S.night.wolfTarget) {
          // saved
          const idx = killed.indexOf(S.night.wolfTarget);
          if (idx >= 0) killed.splice(idx, 1);
        }
        if (S.night.witchPoisonTarget) killed.push(S.night.witchPoisonTarget);

        // apply deaths
        const uniq = [...new Set(killed)];
        for (const n of uniq) {
          const seat = S.seats[n - 1];
          if (seat) seat.alive = false;
        }

        S.lastAction = uniq.length ? `夜晚死亡：${uniq.join("、")}號` : "夜晚無人死亡";

        // reset night picks for next night
        S.night.wolfTarget = null;
        S.night.witchSave = false;
        S.night.witchPoisonTarget = null;
        S.night.seerTarget = null;
        S.selectedSeat = null;
        S.selectMode = "NONE";

        // go day
        S.timeOfDay = "DAY";

        saveState();
        renderAll();
        return;
      }

      // DAY -> next NIGHT
      if (S.timeOfDay === "DAY") {
        S.timeOfDay = "NIGHT";
        S.round += 1;
        S.lastAction = null;
        saveState();
        renderAll();
        return;
      }
    }
  });

  // ---------- Render all ----------
  function renderAll() {
    ensureSeats();
    renderSettings();
    renderPeople();
    renderBoards();
    renderCustom();
    renderSeats();
    renderTimer();
    renderGod();
    renderFlow();
  }

  // ---------- init ----------
  attachSeatLongPress();
  renderAll();
  closeAllDrawers();
})();