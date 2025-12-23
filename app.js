/* =========================================================
   Werewolf God Helper - app.js (FULL OVERWRITE)
   C2 included: Cupid Day1 lovers, Thief bottom logic, robust flow
   ========================================================= */
(() => {
  "use strict";

  /* ------------------------- iOS Anti-zoom / Anti-select ------------------------- */
  let __lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    (e) => {
      const now = Date.now();
      if (now - __lastTouchEnd <= 300) e.preventDefault();
      __lastTouchEnd = now;
    },
    { passive: false }
  );

  ["contextmenu", "selectstart", "gesturestart"].forEach((evt) => {
    document.addEventListener(
      evt,
      (e) => e.preventDefault(),
      { passive: false }
    );
  });

  /* ------------------------- Helpers ------------------------- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const LS_KEY = "wlgod_state_v4";

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const pad2 = (n) => String(n).padStart(2, "0");
  const formatTime = (sec) => {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${pad2(m)}:${pad2(s)}`;
  };

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function safeJSONParse(text, fallback) {
    try {
      return JSON.parse(text);
    } catch {
      return fallback;
    }
  }

  /* ------------------------- Roles / Camps ------------------------- */
  const CAMP = { WOLF: "wolf", GOOD: "good" };

  const ROLE = {
    villager: { id: "villager", name: "平民", camp: CAMP.GOOD, abbr: "民" },
    seer: { id: "seer", name: "預言家", camp: CAMP.GOOD, abbr: "預" },
    witch: { id: "witch", name: "女巫", camp: CAMP.GOOD, abbr: "巫" },
    hunter: { id: "hunter", name: "獵人", camp: CAMP.GOOD, abbr: "獵" },
    guard: { id: "guard", name: "守衛", camp: CAMP.GOOD, abbr: "守" },
    idiot: { id: "idiot", name: "白痴", camp: CAMP.GOOD, abbr: "白" },
    cupid: { id: "cupid", name: "邱比特", camp: CAMP.GOOD, abbr: "邱" },
    thief: { id: "thief", name: "盜賊", camp: CAMP.GOOD, abbr: "盜" },

    werewolf: { id: "werewolf", name: "狼人", camp: CAMP.WOLF, abbr: "狼" },
    blackwolf: { id: "blackwolf", name: "黑狼王", camp: CAMP.WOLF, abbr: "黑" },
    whitewolf: { id: "whitewolf", name: "白狼王", camp: CAMP.WOLF, abbr: "白王" },
  };

  function roleInfo(roleId) {
    return ROLE[roleId] || { id: roleId, name: roleId, camp: CAMP.GOOD, abbr: "?" };
  }

  /* ------------------------- DOM refs ------------------------- */
  const uiStatus = $("#uiStatus");
  const uiBoard = $("#uiBoard");

  const btnAnn = $("#btnAnn");
  const btnTimer = $("#btnTimer");
  const btnEye = $("#btnEye");
  const btnDice = $("#btnDice");
  const btnSettings = $("#btnSettings");

  const promptTitle = $("#promptTitle");
  const promptText = $("#promptText");
  const promptFoot = $("#promptFoot");

  const setupCard = $("#setupCard");
  const boardList = $("#boardList");
  const boardHint = $("#boardHint");

  const seatsGrid = $("#seatsGrid");

  const btnBack = $("#btnBack");
  const btnMain = $("#btnMain");
  const btnNext = $("#btnNext");

  // Timer drawer
  const timerBackdrop = $("#timerBackdrop");
  const timerDrawer = $("#timerDrawer");
  const btnCloseTimer = $("#btnCloseTimer");
  const timerBig = $("#timerBig");
  const btnTimerStart = $("#btnTimerStart");
  const btnTimerPause = $("#btnTimerPause");
  const btnTimerReset = $("#btnTimerReset");

  // Ann drawer
  const annBackdrop = $("#annBackdrop");
  const annDrawer = $("#annDrawer");
  const btnCloseAnn = $("#btnCloseAnn");
  const annText = $("#annText");
  const toggleAnnGod = $("#toggleAnnGod");

  // Settings drawer
  const setBackdrop = $("#setBackdrop");
  const setDrawer = $("#setDrawer");
  const btnCloseSet = $("#btnCloseSet");
  const segEdge = $("#segEdge");
  const segCity = $("#segCity");
  const togglePolice = $("#togglePolice");
  const btnGotoSetup = $("#btnGotoSetup");
  const btnHardReset = $("#btnHardReset");

  // Role modal
  const roleModal = $("#roleModal");
  const roleModalTitle = $("#roleModalTitle");
  const roleModalRole = $("#roleModalRole");
  const roleModalCamp = $("#roleModalCamp");
  const btnRoleDone = $("#btnRoleDone");
  const btnRoleClose = $("#btnRoleClose");

  // Dice modal
  const diceModal = $("#diceModal");
  const diceResult = $("#diceResult");
  const btnDiceAgain = $("#btnDiceAgain");
  const btnDiceClose = $("#btnDiceClose");

  // Thief modal
  const thiefModal = $("#thiefModal");
  const thiefHint = $("#thiefHint");
  const btnThiefA = $("#btnThiefA");
  const btnThiefB = $("#btnThiefB");
  const btnThiefClose = $("#btnThiefClose");

  /* ------------------------- Board fallback ------------------------- */
  // 12-thief: players=12, extra=2 => deck total 14
  // 狼上限四隻；此板：2小狼+黑狼王+白狼王 = 4狼
  const BOARD_FALLBACK = {
    list: [
      { id: "official-9", title: "9人官方標準局", players: 9, winMode: "edge", hasPolice: false, path: "boards/official-9.json" },
      { id: "official-10", title: "10人官方標準局", players: 10, winMode: "edge", hasPolice: false, path: "boards/official-10.json" },
      { id: "official-12", title: "12人官方標準局（四狼四神四民）", players: 12, winMode: "edge", hasPolice: false, path: "boards/official-12.json" },

      { id: "12-thief-city", title: "12人含盜賊（+2底牌・屠城）", players: 12, winMode: "city", hasPolice: false, path: "boards/variants/12-thief-city.json" },
      { id: "12-thief-edge", title: "12人含盜賊（+2底牌・屠邊・2小狼+黑白狼王）", players: 12, winMode: "edge", hasPolice: false, path: "boards/variants/12-thief-edge.json" },
    ],
    byId: {
      "12-thief-city": {
        players: 12, winMode: "city", hasPolice: false, extra: 2,
        deck: [
          "werewolf","werewolf","blackwolf","whitewolf",
          "seer","witch","hunter","guard",
          "thief",
          "villager","villager","villager","villager","villager"
        ]
      },
      "12-thief-edge": {
        players: 12, winMode: "edge", hasPolice: false, extra: 2,
        deck: [
          "werewolf","werewolf","blackwolf","whitewolf",
          "seer","witch","hunter","guard",
          "thief",
          "villager","villager","villager","villager","villager"
        ]
      }
    }
  };

  /* ------------------------- State ------------------------- */
  const defaultState = () => ({
    phase: "setup", // setup | deal | night | day | vote
    day: 1,

    players: null,
    boardId: null,
    boardMeta: null,

    winMode: "edge",
    hasPolice: false,

    seats: [],

    deck: [],
    bottom: [],
    dealt: false,

    // declared roles: 用來「照流程詢問」的角色集合（含盜賊底牌候選）
    declaredRoles: [],

    // thief
    thiefSeat: null,
    thiefChosen: false,
    thiefChoice: null,      // {picked, discarded}
    thiefBottomOptions: null, // [a,b] 保留候選供流程詢問（即使捨棄也照樣唸）

    // cupid
    lovers: [], // [a,b]

    // night actions
    night: {
      guardTarget: null,
      wolfTarget: null,
      seerTarget: null,
      witchSave: null,
      witchPoison: null,
      usedSave: false,
      usedPoison: false,
    },

    // flow
    flow: {
      step: 0,
      steps: [],
      vote: {
        target: null,
        map: {},
      },
    },

    logs: [],
    godView: false,
  });

  let S = defaultState();

  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch {}
  }
  function load() {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const obj = safeJSONParse(raw, null);
    if (!obj) return false;
    S = Object.assign(defaultState(), obj);
    return true;
  }

  /* ------------------------- Drawers / Modals ------------------------- */
  function openDrawer(backdropEl, drawerEl) {
    backdropEl.classList.remove("hidden");
    drawerEl.classList.remove("hidden");
    drawerEl.setAttribute("aria-hidden", "false");
  }
  function closeDrawer(backdropEl, drawerEl) {
    backdropEl.classList.add("hidden");
    drawerEl.classList.add("hidden");
    drawerEl.setAttribute("aria-hidden", "true");
  }
  function openModal(modalEl) {
    modalEl.classList.remove("hidden");
    modalEl.setAttribute("aria-hidden", "false");
  }
  function closeModal(modalEl) {
    modalEl.classList.add("hidden");
    modalEl.setAttribute("aria-hidden", "true");
  }

  /* ------------------------- Boards ------------------------- */
  async function fetchJSON(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  async function loadBoardsIndex() {
    try {
      const idx = await fetchJSON("boards/index.json");
      const items = [];
      if (idx && Array.isArray(idx.groups)) {
        idx.groups.forEach((g) => (g.items || []).forEach((it) => items.push(it)));
      }
      return items.map((it) => ({
        id: it.id,
        title: it.title,
        players: it.players,
        path: it.path,
        tags: it.tags || [],
      }));
    } catch {
      return BOARD_FALLBACK.list.map((x) => ({ id: x.id, title: x.title, players: x.players, path: x.path, tags: [] }));
    }
  }

  async function loadBoardById(boardId) {
    const boards = await loadBoardsIndex();
    const meta = boards.find((b) => b.id === boardId) || BOARD_FALLBACK.list.find((b) => b.id === boardId);
    if (!meta) throw new Error("Board not found");

    try {
      const obj = await fetchJSON(meta.path);
      const players = obj.players ?? obj?.meta?.players ?? meta.players;
      const winMode = obj.winMode ?? obj?.meta?.winMode ?? meta.winMode ?? "edge";
      const hasPolice = obj.hasPolice ?? obj?.meta?.hasPolice ?? false;
      const extra = obj.extra ?? obj?.meta?.extra ?? 0;

      let deck = Array.isArray(obj.deck) ? obj.deck.slice() : null;

      if (!deck && obj.roles) {
        deck = [];
        (obj.roles.wolves || []).forEach((r) => deck.push(r));
        (obj.roles.gods || []).forEach((r) => deck.push(r));
        const vn = obj.roles.villagers ?? 0;
        for (let i = 0; i < vn; i++) deck.push("villager");
      }

      if (!deck) throw new Error("No deck in board json");

      return {
        id: boardId,
        title: meta.title,
        players,
        winMode,
        hasPolice,
        extra: extra || Math.max(0, deck.length - players),
        deck,
      };
    } catch {
      const fb = BOARD_FALLBACK.byId[boardId];
      if (fb) {
        return {
          id: boardId,
          title: meta?.title || boardId,
          players: fb.players,
          winMode: fb.winMode,
          hasPolice: fb.hasPolice,
          extra: fb.extra || 0,
          deck: fb.deck.slice(),
        };
      }
      // 最後兜底：12人四狼四神四民
      return {
        id: "official-12",
        title: "12人官方標準局（fallback）",
        players: 12,
        winMode: "edge",
        hasPolice: false,
        extra: 0,
        deck: ["werewolf","werewolf","werewolf","werewolf","seer","witch","hunter","guard","villager","villager","villager","villager"],
      };
    }
  }

  /* ------------------------- Setup UI ------------------------- */
  function renderSetup(boardsAll) {
    $$(".chips .chip[data-n]").forEach((btn) => {
      btn.classList.toggle("primary", Number(btn.dataset.n) === S.players);
      btn.onclick = () => {
        S.players = Number(btn.dataset.n);
        S.boardId = null;
        S.boardMeta = null;
        save();
        renderSetup(boardsAll);
        renderBoardList(boardsAll);
        syncTop();
        syncPrompt();
      };
    });
    renderBoardList(boardsAll);
  }

  function renderBoardList(boardsAll) {
    const players = S.players;
    const list = players ? boardsAll.filter((b) => Number(b.players) === Number(players)) : boardsAll;

    boardList.innerHTML = "";
    boardHint.textContent = players ? "請選擇板子（點一下會變色）" : "請先選人數，再選板子（點一下會變色）";

    list.forEach((b) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "boardBtn";
      btn.textContent = b.title;
      btn.dataset.id = b.id;
      btn.classList.toggle("active", S.boardId === b.id);

      btn.onclick = async () => {
        S.boardId = b.id;
        save();
        renderBoardList(boardsAll);
        syncTop();

        try {
          const meta = await loadBoardById(b.id);
          S.boardMeta = meta;
          S.winMode = meta.winMode || S.winMode;
          S.hasPolice = !!meta.hasPolice;

          togglePolice.checked = S.hasPolice;
          segEdge.classList.toggle("active", S.winMode === "edge");
          segCity.classList.toggle("active", S.winMode === "city");

          save();
          syncTop();
          syncPrompt();
        } catch (err) {
          console.error(err);
        }
      };

      boardList.appendChild(btn);
    });
  }

  /* ------------------------- Seats ------------------------- */
  function initSeats(n) {
    S.seats = [];
    for (let i = 1; i <= n; i++) {
      S.seats.push({
        n: i,
        roleId: null,
        alive: true,
        selected: false,
        seen: false,
        death: null,
        marks: { guard:false, save:false, poison:false },
      });
    }
  }

  function renderSeats() {
    seatsGrid.innerHTML = "";
    const n = S.players || 0;

    for (let i = 1; i <= n; i++) {
      const seat = S.seats[i - 1];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "seat";
      btn.dataset.n = String(i);

      const num = document.createElement("div");
      num.className = "seatNum";
      num.textContent = String(i);
      btn.appendChild(num);

      // 上帝視角：顯示角色/事件、並依陣營上色
      if (S.godView && seat.roleId) {
        const info = roleInfo(seat.roleId);

        const badge = document.createElement("div");
        badge.className = "seatBadge";
        badge.textContent = info.abbr;
        btn.appendChild(badge);

        const ev = document.createElement("div");
        ev.className = "seatEvents";
        const icons = [];
        if (!seat.alive && seat.death?.cause) icons.push(seat.death.cause);
        if (seat.marks.guard) icons.push("🛡️");
        if (seat.marks.save) icons.push("💊");
        if (seat.marks.poison) icons.push("🧪");
        ev.textContent = icons.join(" ");
        btn.appendChild(ev);

        btn.classList.toggle("campWolf", info.camp === CAMP.WOLF);
        btn.classList.toggle("campGood", info.camp === CAMP.GOOD);
      }

      btn.classList.toggle("dead", !seat.alive);
      btn.classList.toggle("selected", !!seat.selected);

      btn.onclick = () => {
        if (S.phase === "setup") return;

        if (S.phase === "vote") {
          handleVoteTap(seat.n);
          return;
        }

        // 一般：點一下選/再點取消
        seat.selected = !seat.selected;
        save();
        renderSeats();
        syncPrompt();
      };

      // 長按 0.3 秒看身分
      let pressTimer = null;
      const startPress = () => {
        if (S.phase === "setup") return;
        pressTimer = setTimeout(() => {
          pressTimer = null;
          openRole(seat.n);
        }, 300);
      };
      const cancelPress = () => {
        if (pressTimer) clearTimeout(pressTimer);
        pressTimer = null;
      };

      btn.addEventListener("touchstart", startPress, { passive: true });
      btn.addEventListener("touchend", cancelPress, { passive: true });
      btn.addEventListener("touchmove", cancelPress, { passive: true });

      btn.addEventListener("mousedown", startPress);
      btn.addEventListener("mouseup", cancelPress);
      btn.addEventListener("mouseleave", cancelPress);

      seatsGrid.appendChild(btn);
    }
  }

  /* ------------------------- Dealing ------------------------- */
  function computeDeclaredRolesFromDeck(deck) {
    const set = new Set();
    deck.forEach((r) => set.add(r));
    // 把未知/不需要的去掉也可，但這裡保留即可
    return Array.from(set);
  }

  function dealIfNeeded() {
    if (S.dealt) return;
    const meta = S.boardMeta;
    if (!meta || !meta.players || !Array.isArray(meta.deck)) return;

    const players = meta.players;
    const extra = meta.extra || Math.max(0, meta.deck.length - players);

    let deck = meta.deck.slice();
    while (deck.length < players + extra) deck.push("villager");

    // ✅ 宣告角色（用來照流程詢問）
    S.declaredRoles = computeDeclaredRolesFromDeck(deck);

    // 洗牌並發牌
    deck = shuffle(deck);
    for (let i = 0; i < players; i++) S.seats[i].roleId = deck[i];

    S.bottom = deck.slice(players, players + extra);
    S.deck = deck;
    S.dealt = true;

    // 找盜賊座位
    const thiefIdx = S.seats.findIndex((x) => x.roleId === "thief");
    S.thiefSeat = thiefIdx >= 0 ? S.seats[thiefIdx].n : null;

    // 女巫藥初始化
    S.night.usedSave = false;
    S.night.usedPoison = false;

    save();
  }

  /* ------------------------- Logs ------------------------- */
  function pushLog(publicText, godText) {
    S.logs.push({ day: S.day, public: publicText, god: godText || publicText, ts: Date.now() });
    save();
  }

  function renderAnn() {
    const showGod = !!toggleAnnGod.checked;
    const lines = [];
    const logs = S.logs.slice(-200);
    logs.forEach((l) => {
      lines.push(`【Day ${l.day}】`);
      lines.push(showGod ? l.god : l.public);
      lines.push("");
    });
    annText.textContent = lines.join("\n").trim();
  }

  /* ------------------------- Role modal + Thief choose ------------------------- */
  let CURRENT_ROLE_SEAT = null;

  function openRole(seatN) {
    const seat = S.seats[seatN - 1];
    if (!seat || !seat.roleId) return;

    CURRENT_ROLE_SEAT = seatN;

    const info = roleInfo(seat.roleId);
    roleModalTitle.textContent = `${seatN} 號身分`;
    roleModalRole.textContent = `角色：${info.name}`;
    roleModalCamp.textContent = `陣營：${info.camp === CAMP.WOLF ? "狼人陣營" : "好人陣營"}`;

    openModal(roleModal);
  }

  function closeRoleModal() {
    closeModal(roleModal);
    CURRENT_ROLE_SEAT = null;
  }

  btnRoleClose.onclick = () => closeRoleModal();

  btnRoleDone.onclick = () => {
    const seatN = CURRENT_ROLE_SEAT;
    if (!seatN) return closeRoleModal();

    const seat = S.seats[seatN - 1];
    seat.seen = true;
    save();

    closeRoleModal();
    renderSeats();
    syncPrompt();

    // ✅ 盜賊：看完身分立刻選底牌（不是進黑夜才選）
    if (seat.roleId === "thief" && !S.thiefChosen) {
      openThiefChoose(seatN);
    }
  };

  function openThiefChoose(seatN) {
    if (!Array.isArray(S.bottom) || S.bottom.length < 2) return;

    const a = S.bottom[0];
    const b = S.bottom[1];

    // ✅ 保留候選供之後流程「照樣詢問」使用
    S.thiefBottomOptions = [a, b];

    const ia = roleInfo(a);
    const ib = roleInfo(b);

    thiefHint.textContent =
      `盜賊（${seatN}號）請在兩張底牌中選擇其一。\n` +
      `若其中有狼陣營，必須選狼陣營。`;

    btnThiefA.textContent = ia.name;
    btnThiefB.textContent = ib.name;

    const aIsWolf = ia.camp === CAMP.WOLF;
    const bIsWolf = ib.camp === CAMP.WOLF;
    const onlyWolf = (aIsWolf && !bIsWolf) || (!aIsWolf && bIsWolf);

    btnThiefA.disabled = onlyWolf && !aIsWolf;
    btnThiefB.disabled = onlyWolf && !bIsWolf;

    btnThiefA.classList.toggle("ghost", btnThiefA.disabled);
    btnThiefB.classList.toggle("ghost", btnThiefB.disabled);

    btnThiefA.onclick = () => pickThief(seatN, a, b);
    btnThiefB.onclick = () => pickThief(seatN, b, a);
    btnThiefClose.onclick = () => closeModal(thiefModal);

    openModal(thiefModal);
  }

  function pickThief(seatN, pickedRole, discardedRole) {
    const seat = S.seats[seatN - 1];
    seat.roleId = pickedRole;

    S.thiefChosen = true;
    S.thiefChoice = { picked: pickedRole, discarded: discardedRole };

    // ✅ 底牌清空（不會再被任何人抽到）
    S.bottom = [];

    pushLog(
      "盜賊已完成選角。",
      `盜賊（${seatN}號）選擇：${roleInfo(pickedRole).name}；捨棄：${roleInfo(discardedRole).name}`
    );

    save();
    closeModal(thiefModal);
    renderSeats();
    syncPrompt();
  }

  /* ------------------------- Flow generation ------------------------- */
  function declaredHas(roleId) {
    return (S.declaredRoles || []).includes(roleId) || false;
  }

  function buildNightSteps() {
    const steps = [];

    // ✅ Day1 特殊：邱比特選戀人（第一夜）
    if (S.day === 1 && declaredHas("cupid")) {
      steps.push({
        key: "cupid",
        title: "💘 邱比特請睜眼",
        text:
          "請邱比特選擇兩位戀人（點兩個不同座位）。\n" +
          "提示：再點同號可取消；選滿兩位即可下一步。\n" +
          "（若本局可能沒有邱比特或無人睜眼，直接下一步）",
        mode: { type: "pickTwoAlive", store: "lovers" },
      });
    }

    // ✅ 守衛：即使盜賊底牌把守衛捨棄，你仍希望每天照樣詢問（讓玩家不知道）
    if (declaredHas("guard") || (S.thiefBottomOptions || []).includes("guard")) {
      steps.push({
        key: "guard",
        title: "🛡️ 守衛請睜眼",
        text:
          "請守衛選擇今晚要守護的座位。\n" +
          "提示：再點同號可取消。\n" +
          "（若本局沒有守衛或無人睜眼，直接下一步）",
        mode: { type: "pickOneAlive", store: "guardTarget" },
        optional: true,
      });
    }

    // 狼人（含黑狼王/白狼王）
    if (declaredHas("werewolf") || declaredHas("blackwolf") || declaredHas("whitewolf")) {
      steps.push({
        key: "wolf",
        title: "🐺 狼人請睜眼",
        text:
          "請狼人共同選擇今晚要刀的座位。\n" +
          "提示：再點同號可取消。\n\n" +
          "（黑狼王/白狼王技能若要使用，先照常選刀口；你可在📣公告（上帝詳細）中補記『黑狼槍/白狼爪』細節）",
        mode: { type: "pickOneAlive", store: "wolfTarget" },
      });
    }

    if (declaredHas("seer") || (S.thiefBottomOptions || []).includes("seer")) {
      steps.push({
        key: "seer",
        title: "🔮 預言家請睜眼",
        text:
          "請預言家查驗一名玩家。\n" +
          "上帝點選座位後，畫面會顯示結果（好/狼）供口頭宣告。\n" +
          "（若本局沒有預言家或無人睜眼，直接下一步）",
        mode: { type: "pickOneAlive", store: "seerTarget", reveal: "seerReveal" },
        optional: true,
      });
    }

    if (declaredHas("witch") || (S.thiefBottomOptions || []).includes("witch")) {
      steps.push({
        key: "witch",
        title: "🧪 女巫請睜眼",
        text:
          "女巫今晚可選擇：\n" +
          "1) 💊 解藥：點『被刀的人』表示救\n" +
          "2) 🧪 毒藥：點『任一人』表示毒\n" +
          "同一晚只能擇一，用過就沒有。\n" +
          "提示：再點同號可取消。\n" +
          "（若本局沒有女巫或無人睜眼，直接下一步）",
        mode: { type: "witch" },
        optional: true,
      });
    }

    return steps;
  }

  function setFlowSteps(steps) {
    S.flow.steps = steps;
    S.flow.step = 0;
  }

  function currentStep() {
    return S.flow.step >= S.flow.steps.length ? null : (S.flow.steps[S.flow.step] || null);
  }

  /* ------------------------- Night selection handling ------------------------- */
  function handleSeatPickForNight(seatN) {
    const seat = S.seats[seatN - 1];
    if (!seat || !seat.alive) return;

    const step = currentStep();
    if (!step || !step.mode) return;

    const type = step.mode.type;

    // pickOneAlive
    if (type === "pickOneAlive") {
      const store = step.mode.store;
      const cur = S.night[store];
      S.night[store] = (cur === seatN) ? null : seatN;

      // 視覺：只標記本次選到的
      S.seats.forEach((s) => (s.selected = false));
      if (S.night[store]) S.seats[S.night[store] - 1].selected = true;

      save();
      renderSeats();
      syncPrompt();
      return;
    }

    // pickTwoAlive（邱比特戀人）
    if (type === "pickTwoAlive") {
      let arr = Array.isArray(S.lovers) ? S.lovers.slice() : [];
      const idx = arr.indexOf(seatN);
      if (idx >= 0) {
        arr.splice(idx, 1);
      } else {
        if (arr.length < 2) arr.push(seatN);
      }
      arr.sort((a, b) => a - b);
      S.lovers = arr;

      // 視覺：選到的兩位亮起
      S.seats.forEach((s) => (s.selected = false));
      arr.forEach((n) => { S.seats[n - 1].selected = true; });

      save();
      renderSeats();
      syncPrompt();
      return;
    }

    // witch
    if (type === "witch") {
      const wolf = S.night.wolfTarget;

      if (wolf && seatN === wolf) {
        if (S.night.usedSave) return toast("解藥已用過");
        S.night.witchSave = (S.night.witchSave === seatN) ? null : seatN;
        if (S.night.witchSave) S.night.witchPoison = null;
      } else {
        if (S.night.usedPoison) return toast("毒藥已用過");
        S.night.witchPoison = (S.night.witchPoison === seatN) ? null : seatN;
        if (S.night.witchPoison) S.night.witchSave = null;
      }

      save();
      renderSeats();
      syncPrompt();
      return;
    }
  }

  /* ------------------------- Phase transitions ------------------------- */
  function startDealPhase() {
    S.phase = "deal";
    S.day = 1;

    initSeats(S.players);
    dealIfNeeded();

    pushLog("遊戲開始，請依序查看身分。", `板子：${S.boardMeta?.title || S.boardId}；winMode=${S.winMode}`);

    save();
    renderAll();
  }

  function startNight() {
    S.phase = "night";

    S.night.guardTarget = null;
    S.night.wolfTarget = null;
    S.night.seerTarget = null;
    S.night.witchSave = null;
    S.night.witchPoison = null;

    S.seats.forEach((s) => (s.selected = false));

    const steps = buildNightSteps();
    setFlowSteps(steps);

    pushLog(`第 ${S.day} 天進入天黑。`, `夜晚流程：${steps.map((x) => x.key).join(" -> ") || "（無）"}`);

    save();
    renderAll();
  }

  function resolveNight() {
    // 清事件標記
    S.seats.forEach((s) => {
      s.marks.guard = false;
      s.marks.save = false;
      s.marks.poison = false;
    });

    const wolf = S.night.wolfTarget;
    const guard = S.night.guardTarget;

    if (guard) S.seats[guard - 1].marks.guard = true;

    let saved = null;
    let poisoned = null;

    if (S.night.witchSave) {
      saved = S.night.witchSave;
      S.night.usedSave = true;
      S.seats[saved - 1].marks.save = true;
    }
    if (S.night.witchPoison) {
      poisoned = S.night.witchPoison;
      S.night.usedPoison = true;
      S.seats[poisoned - 1].marks.poison = true;
    }

    const deaths = [];

    if (wolf) {
      const blockedByGuard = guard && guard === wolf;
      const blockedByWitch = saved && saved === wolf;
      if (!blockedByGuard && !blockedByWitch) {
        deaths.push({ n: wolf, cause: "🐺" }); // 狼刀（若要黑狼槍/白狼爪可在公告詳細補記）
      }
    }
    if (poisoned) deaths.push({ n: poisoned, cause: "🧪" });

    deaths.forEach((d) => {
      const seat = S.seats[d.n - 1];
      seat.alive = false;
      seat.death = { cause: d.cause, day: S.day };
      seat.selected = false;
    });

    // 公告
    if (deaths.length === 0) {
      pushLog("昨夜平安無事。", `守衛=${guard || "未選/無"}；狼刀=${wolf || "未選"}；解藥=${saved || "未用"}；毒藥=${poisoned || "未用"}；戀人=${(S.lovers||[]).join(",")||"—"}`);
    } else {
      const diedNums = deaths.map((d) => `${d.n}號`).join("、");
      pushLog(`昨夜死亡：${diedNums}。`, `守衛=${guard || "未選/無"}；狼刀=${wolf || "未選"}；解藥=${saved || "未用"}；毒藥=${poisoned || "未用"}；死亡=${JSON.stringify(deaths)}`);
    }

    save();
  }

  function startDay() {
    if (S.phase === "night") resolveNight();

    S.phase = "day";
    S.seats.forEach((s) => (s.selected = false));
    save();
    renderAll();
  }

  function startVote() {
    S.phase = "vote";
    S.flow.vote = { target: null, map: {} };
    S.seats.forEach((s) => (s.selected = false));

    pushLog(`第 ${S.day} 天開始投票。`, "投票：先點『放逐目標』，再點『投票的人』（再點可取消）。");

    save();
    renderAll();
  }

  function finishVoteAndAnnounce() {
    const map = S.flow.vote.map || {};
    const groups = new Map(); // target -> voters[]
    Object.keys(map).forEach((k) => {
      const voter = Number(k);
      const target = Number(map[k]);
      if (!groups.has(target)) groups.set(target, []);
      groups.get(target).push(voter);
    });

    const lines = [];
    const targets = Array.from(groups.keys()).sort((a, b) => a - b);

    let maxTarget = null;
    let maxVotes = -1;

    targets.forEach((t) => {
      const vs = (groups.get(t) || []).sort((a, b) => a - b);
      if (t === 0) {
        lines.push(`棄票的有${vs.length ? vs.join("、") : "（無）"}`);
      } else {
        lines.push(`投給${t}號的有${vs.length ? vs.join("、") : "（無）"}（${vs.length}票）`);
        if (vs.length > maxVotes) {
          maxVotes = vs.length;
          maxTarget = t;
        }
      }
    });

    if (maxTarget && maxVotes > 0) {
      lines.push(`${maxTarget}號得到最高票遭到放逐。`);
    } else {
      lines.push("本輪投票無法決定最高票。");
    }

    pushLog(lines.join("\n"), `voteMap=${JSON.stringify(map)}`);

    // 白天結束 -> 天黑
    S.day += 1;
    startNight();
  }

  function handleVoteTap(seatN) {
    const seat = S.seats[seatN - 1];
    if (!seat.alive) return;

    const vote = S.flow.vote;

    if (vote.target == null) {
      vote.target = seatN;
      S.seats.forEach((s) => (s.selected = false));
      seat.selected = true;
      save();
      renderSeats();
      syncPrompt();
      return;
    }

    const voter = seatN;
    const cur = vote.map[voter];

    if (cur === vote.target) delete vote.map[voter];
    else vote.map[voter] = vote.target;

    save();
    syncPrompt();
  }

  /* ------------------------- Toast ------------------------- */
  let toastTimer = null;
  function toast(msg) {
    uiStatus.textContent = msg;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => syncTop(), 1200);
  }

  /* ------------------------- Timer ------------------------- */
  let timerSec = 90;
  let timerRunning = false;
  let timerT = null;

  function timerRender() { timerBig.textContent = formatTime(timerSec); }
  function timerStart() {
    if (timerRunning) return;
    timerRunning = true;
    timerT = setInterval(() => {
      timerSec = Math.max(0, timerSec - 1);
      timerRender();
      if (timerSec <= 0) {
        timerStop();
        try { navigator.vibrate?.(300); } catch {}
      }
    }, 1000);
  }
  function timerStop() { timerRunning = false; if (timerT) clearInterval(timerT); timerT = null; }
  function timerReset() { timerStop(); timerSec = 90; timerRender(); }

  /* ------------------------- Dice ------------------------- */
  function openDice() {
    const alive = S.seats.filter((s) => s.alive).map((s) => s.n);
    diceResult.textContent = alive.length ? `${alive[Math.floor(Math.random() * alive.length)]} 號` : "—";
    openModal(diceModal);
  }

  /* ------------------------- God view toggle ------------------------- */
  function toggleGodView() {
    S.godView = !S.godView;
    save();
    renderSeats();
  }

  /* ------------------------- Top / Prompt / Buttons ------------------------- */
  function syncTop() {
    const p = S.players ? `${S.players}人` : "未選人數";
    const b = S.boardMeta?.title || S.boardId || "未選板子";

    uiStatus.textContent =
      S.phase === "setup" ? "開局設定"
      : S.phase === "deal" ? "抽身分"
      : S.phase === "night" ? `夜晚 Day${S.day}`
      : S.phase === "vote" ? `投票 Day${S.day}`
      : `白天 Day${S.day}`;

    uiBoard.textContent = `${p}｜${b}`;
  }

  function syncPrompt() {
    if (S.phase === "setup") {
      promptTitle.textContent = "開局：選人數與板子";
      promptText.textContent =
        "✅ 先選人數（9/10/12）→ 再選板子（會變色）\n" +
        "✅ 按底部「下一步」開始抽身分\n" +
        "提示：板子很多時可在板子區塊內上下滑。";
      promptFoot.textContent = "";
      btnBack.disabled = true;
      btnMain.disabled = true;
      btnMain.textContent = "—";
      btnNext.disabled = !(S.players && S.boardId);
      btnNext.textContent = "下一步";
      return;
    }

    if (S.phase === "deal") {
      const total = S.players || 0;
      const seen = S.seats.filter((s) => s.seen).length;
      promptTitle.textContent = `抽身分（已看 ${seen}/${total}）`;
      promptText.textContent =
        "請玩家依序長按自己的號碼 0.3 秒查看身分。\n" +
        "看完按「我看完了」。\n\n" +
        "✅ 看完會蓋牌（不會留在格子上）。\n" +
        "✅ 若抽到盜賊，看完會立刻跳出底牌二選一。";
      promptFoot.textContent = "";

      btnBack.disabled = true;
      btnMain.disabled = true;
      btnMain.textContent = "—";

      const allSeen = seen === total;
      const thiefOk = !S.thiefSeat || S.thiefChosen;

      btnNext.disabled = !(allSeen && thiefOk);
      btnNext.textContent = "下一步";
      return;
    }

    if (S.phase === "night") {
      const step = currentStep();
      const idx = S.flow.step + 1;
      const total = S.flow.steps.length;

      if (!step) {
        promptTitle.textContent = `夜晚流程完成（Day ${S.day}）`;
        promptText.textContent = "夜晚流程已跑完。請按中間按鈕「天亮睜眼」進入白天。";
      } else {
        promptTitle.textContent = `${step.title}（${idx}/${total}）`;
        promptText.textContent = step.text;

        if (step.key === "cupid") {
          const lv = (S.lovers || []);
          promptText.textContent += `\n\n目前戀人：${lv.length ? lv.join("號、") + "號" : "（未選）"}`;
        }

        if (step.mode?.reveal === "seerReveal" && S.night.seerTarget) {
          const t = S.night.seerTarget;
          const camp = roleInfo(S.seats[t - 1].roleId).camp === CAMP.WOLF ? "狼人" : "好人";
          promptText.textContent += `\n\n✅ 查驗結果：${t}號是【${camp}】`;
        }

        if (step.key === "witch") {
          const line = [];
          line.push(`解藥：${S.night.usedSave ? "已用" : "未用"}`);
          line.push(`毒藥：${S.night.usedPoison ? "已用" : "未用"}`);
          promptText.textContent += `\n\n${line.join("｜")}`;
        }
      }

      btnBack.disabled = S.flow.step <= 0;
      btnNext.disabled = false;
      btnNext.textContent = "下一步";
      btnMain.disabled = false;
      btnMain.textContent = "天亮睜眼";
      return;
    }

    if (S.phase === "day") {
      promptTitle.textContent = `白天（Day ${S.day}）`;
      promptText.textContent =
        "你可以：\n" +
        "📣 公告：回顧每天公開事件（可切換上帝詳細）\n" +
        "👁 上帝視角：座位格顯示陣營/角色/事件更直覺\n\n" +
        "準備好請按中間「開始投票」。";
      promptFoot.textContent = "";
      btnBack.disabled = true;
      btnMain.disabled = false;
      btnMain.textContent = "開始投票";
      btnNext.disabled = false;
      btnNext.textContent = "下一步";
      return;
    }

    if (S.phase === "vote") {
      const vote = S.flow.vote;
      const target = vote.target;

      promptTitle.textContent = `投票（Day ${S.day}）`;
      if (target == null) {
        promptText.textContent = "請先點『要放逐的目標』座位（第一次點）。";
      } else {
        const assigned = Object.keys(vote.map).length;
        promptText.textContent =
          `目前放逐目標：${target === 0 ? "棄票(0)" : target + "號"}\n` +
          `請點『投票的人』加入/取消投票。\n` +
          `已記錄：${assigned} 人投票。\n\n` +
          "完成後按「下一步」生成公告。";
      }

      promptFoot.innerHTML = "";
      const row = document.createElement("div");
      row.className = "toolRow";

      const btnResetTarget = document.createElement("button");
      btnResetTarget.type = "button";
      btnResetTarget.className = "btn ghost";
      btnResetTarget.style.padding = "8px 10px";
      btnResetTarget.style.fontSize = "13px";
      btnResetTarget.textContent = "重選目標";
      btnResetTarget.onclick = () => {
        vote.target = null;
        S.seats.forEach((s) => (s.selected = false));
        save();
        renderSeats();
        syncPrompt();
      };

      const btnAbstain = document.createElement("button");
      btnAbstain.type = "button";
      btnAbstain.className = "btn ghost";
      btnAbstain.style.padding = "8px 10px";
      btnAbstain.style.fontSize = "13px";
      btnAbstain.textContent = "棄票目標=0";
      btnAbstain.onclick = () => {
        vote.target = 0;
        S.seats.forEach((s) => (s.selected = false));
        save();
        renderSeats();
        syncPrompt();
      };

      row.style.display = "flex";
      row.style.gap = "8px";
      row.appendChild(btnResetTarget);
      row.appendChild(btnAbstain);
      promptFoot.appendChild(row);

      btnBack.disabled = true;
      btnMain.disabled = false;
      btnMain.textContent = "天黑閉眼";
      btnNext.disabled = false;
      btnNext.textContent = "下一步";
      return;
    }
  }

  function syncBottomButtons() {
    btnNext.onclick = () => {
      if (S.phase === "setup") {
        if (!(S.players && S.boardId)) return;
        startDealPhase();
        return;
      }

      if (S.phase === "deal") {
        const total = S.players || 0;
        const seen = S.seats.filter((s) => s.seen).length;
        const allSeen = seen === total;
        const thiefOk = !S.thiefSeat || S.thiefChosen;
        if (!allSeen || !thiefOk) return toast("尚未全部看完（或盜賊尚未選角）");
        startNight();
        return;
      }

      if (S.phase === "night") {
        const step = currentStep();
        if (!step) return toast("夜晚已完成，請按「天亮睜眼」");

        // 必要步驟檢查（optional 的可跳過）
        if (step.key === "cupid") {
          if ((S.lovers || []).length !== 2) return toast("請選兩位戀人（可再點取消）");
        }
        if (step.key === "wolf" && !S.night.wolfTarget) return toast("請選狼人刀口（可再點取消）");
        if (step.key === "seer" && !S.night.seerTarget && !step.optional) return toast("請選查驗目標");

        // 守衛/預言家/女巫 若無人睜眼可跳（optional=true），因此不強制
        // 前進 step
        S.flow.step += 1;
        save();
        syncPrompt();
        return;
      }

      if (S.phase === "day") {
        startVote();
        return;
      }

      if (S.phase === "vote") {
        if (S.flow.vote.target == null) return toast("請先點放逐目標");
        finishVoteAndAnnounce();
        return;
      }
    };

    btnBack.onclick = () => {
      if (S.phase === "night") {
        S.flow.step = clamp(S.flow.step - 1, 0, S.flow.steps.length);
        save();
        syncPrompt();
      }
    };

    btnMain.onclick = () => {
      if (S.phase === "day") return startVote();
      if (S.phase === "vote") return startNight();
      if (S.phase === "night") return startDay();
    };
  }

  /* ------------------------- Ann / Timer / Settings / Dice / Eye wiring ------------------------- */
  function wireUI() {
    btnAnn.onclick = () => { renderAnn(); openDrawer(annBackdrop, annDrawer); };
    btnCloseAnn.onclick = () => closeDrawer(annBackdrop, annDrawer);
    annBackdrop.onclick = () => closeDrawer(annBackdrop, annDrawer);
    toggleAnnGod.onchange = () => renderAnn();

    btnTimer.onclick = () => { timerRender(); openDrawer(timerBackdrop, timerDrawer); };
    btnCloseTimer.onclick = () => closeDrawer(timerBackdrop, timerDrawer);
    timerBackdrop.onclick = () => closeDrawer(timerBackdrop, timerDrawer);

    $$("#timerPresets .chip[data-sec]").forEach((btn) => {
      btn.onclick = () => { timerSec = Number(btn.dataset.sec || 90); timerRender(); };
    });
    btnTimerStart.onclick = () => timerStart();
    btnTimerPause.onclick = () => timerStop();
    btnTimerReset.onclick = () => timerReset();

    btnEye.onclick = () => { toggleGodView(); toast(S.godView ? "上帝視角：開" : "上帝視角：關"); };

    btnDice.onclick = () => openDice();
    btnDiceAgain.onclick = () => openDice();
    btnDiceClose.onclick = () => closeModal(diceModal);

    btnSettings.onclick = () => openDrawer(setBackdrop, setDrawer);
    btnCloseSet.onclick = () => closeDrawer(setBackdrop, setDrawer);
    setBackdrop.onclick = () => closeDrawer(setBackdrop, setDrawer);

    segEdge.onclick = () => {
      S.winMode = "edge";
      segEdge.classList.add("active");
      segCity.classList.remove("active");
      save();
      syncTop();
    };
    segCity.onclick = () => {
      S.winMode = "city";
      segCity.classList.add("active");
      segEdge.classList.remove("active");
      save();
      syncTop();
    };

    togglePolice.onchange = () => { S.hasPolice = !!togglePolice.checked; save(); };

    btnGotoSetup.onclick = () => {
      S = defaultState();
      save();
      location.reload();
    };
    btnHardReset.onclick = () => {
      localStorage.removeItem(LS_KEY);
      location.reload();
    };

    // night seat picking
    seatsGrid.addEventListener("click", (e) => {
      const btn = e.target?.closest(".seat");
      if (!btn) return;
      const n = Number(btn.dataset.n);
      if (!n) return;
      if (S.phase === "night") handleSeatPickForNight(n);
    });
  }

  /* ------------------------- Render all ------------------------- */
  function renderAll() {
    setupCard.style.display = S.phase === "setup" ? "" : "none";
    if (S.phase === "setup") seatsGrid.innerHTML = "";
    else renderSeats();

    syncTop();
    syncPrompt();
  }

  /* ------------------------- Boot ------------------------- */
  async function boot() {
    load();

    const boardsAll = await loadBoardsIndex();
    renderSetup(boardsAll);

    if (S.boardId && !S.boardMeta) {
      try { S.boardMeta = await loadBoardById(S.boardId); } catch {}
    }

    if (S.phase !== "setup") {
      if (!S.players && S.boardMeta?.players) S.players = S.boardMeta.players;
      if (!Array.isArray(S.seats) || S.seats.length !== S.players) initSeats(S.players);
      if (!S.dealt && S.boardMeta) dealIfNeeded();
    }

    togglePolice.checked = !!S.hasPolice;
    segEdge.classList.toggle("active", S.winMode === "edge");
    segCity.classList.toggle("active", S.winMode === "city");

    wireUI();
    syncBottomButtons();
    renderAll();
  }

  boot().catch((err) => {
    console.error(err);
    syncTop();
    syncPrompt();
  });
})();