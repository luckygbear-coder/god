/* =========================================================
   Werewolf God Helper - app.js (FULL OVERWRITE)
   Works with your current index.html structure (no change).
   ========================================================= */

(() => {
  "use strict";

  /* ------------------------- iOS Anti-zoom / Anti-select ------------------------- */
  // 防雙擊放大
  let __lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    (e) => {
      const now = Date.now();
      if (now - __lastTouchEnd <= 300) {
        e.preventDefault();
      }
      __lastTouchEnd = now;
    },
    { passive: false }
  );

  // 防長按選取/複製/系統選單
  ["contextmenu", "selectstart", "gesturestart"].forEach((evt) => {
    document.addEventListener(
      evt,
      (e) => {
        e.preventDefault();
      },
      { passive: false }
    );
  });

  // 讓可點區域在 iOS 不會跳出「複製」泡泡（仍建議 CSS 加 user-select:none）
  document.addEventListener(
    "touchstart",
    (e) => {
      const t = e.target;
      if (!t) return;
      // 只要是按鈕 / 座位 / 卡片區塊，就阻止選取行為
      if (
        t.closest("button") ||
        t.closest(".seat") ||
        t.closest(".card") ||
        t.closest(".drawer") ||
        t.closest(".modal")
      ) {
        // 不要 preventDefault 以免影響 click
      }
    },
    { passive: true }
  );

  /* ------------------------- Helpers ------------------------- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const LS_KEY = "wlgod_state_v3";

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${pad2(m)}:${pad2(s)}`;
  }

  function safeJSONParse(text, fallback) {
    try {
      return JSON.parse(text);
    } catch {
      return fallback;
    }
  }

  /* ------------------------- Roles / Camps ------------------------- */
  const CAMP = {
    WOLF: "wolf",
    GOOD: "good",
  };

  // 角色定義（顯示用）
  const ROLE = {
    villager: { id: "villager", name: "平民", camp: CAMP.GOOD, abbr: "民" },
    seer: { id: "seer", name: "預言家", camp: CAMP.GOOD, abbr: "預" },
    witch: { id: "witch", name: "女巫", camp: CAMP.GOOD, abbr: "巫" },
    hunter: { id: "hunter", name: "獵人", camp: CAMP.GOOD, abbr: "獵" },
    guard: { id: "guard", name: "守衛", camp: CAMP.GOOD, abbr: "守" },
    idiot: { id: "idiot", name: "白痴", camp: CAMP.GOOD, abbr: "白" },
    cupid: { id: "cupid", name: "邱比特", camp: CAMP.GOOD, abbr: "邱" },
    thief: { id: "thief", name: "盜賊", camp: CAMP.GOOD, abbr: "盜" },
    robber: { id: "robber", name: "盜賊(舊名/備用)", camp: CAMP.GOOD, abbr: "盜" },

    // 狼
    werewolf: { id: "werewolf", name: "狼人", camp: CAMP.WOLF, abbr: "狼" },
    blackwolf: { id: "blackwolf", name: "黑狼王", camp: CAMP.WOLF, abbr: "黑" },
    whitewolf: { id: "whitewolf", name: "白狼王", camp: CAMP.WOLF, abbr: "白王" },
  };

  function roleInfo(roleId) {
    return ROLE[roleId] || { id: roleId, name: roleId, camp: CAMP.GOOD, abbr: "?" };
  }

  /* ------------------------- Board fallback (so it never crashes) ------------------------- */
  // 你要求：狼人最多四隻；12-thief-edge：2小狼+黑白狼王（共4狼）
  // 盜賊板：玩家12人 + 底牌2張 => deck總長度14（含盜賊）
  const BOARD_FALLBACK = {
    list: [
      { id: "official-9", title: "9人官方標準局", players: 9, winMode: "edge", hasPolice: false, path: "boards/official-9.json" },
      { id: "official-10", title: "10人官方標準局", players: 10, winMode: "edge", hasPolice: false, path: "boards/official-10.json" },
      { id: "official-12", title: "12人官方標準局", players: 12, winMode: "edge", hasPolice: false, path: "boards/official-12.json" },

      // 你目前 variants 目錄中既有的（不強依賴內容，會盡量讀檔）
      { id: "12-thief-city", title: "12人含盜賊（+2底牌・屠城）", players: 12, winMode: "city", hasPolice: false, path: "boards/variants/12-thief-city.json" },
      { id: "12-thief-edge", title: "12人含盜賊（+2底牌・屠邊・2小狼+黑白狼王）", players: 12, winMode: "edge", hasPolice: false, path: "boards/variants/12-thief-edge.json" },
    ],
    // 當讀不到 boards/variants/12-thief-xxx.json 時，使用這份內建 deck
    byId: {
      "12-thief-city": {
        players: 12,
        winMode: "city",
        hasPolice: false,
        extra: 2,
        deck: [
          // 4狼（2小狼+黑白狼王）
          "werewolf",
          "werewolf",
          "blackwolf",
          "whitewolf",
          // 4神（預女獵守）+ 盜賊（神） => 神位基礎 5
          "seer",
          "witch",
          "hunter",
          "guard",
          "thief",
          // 平民補齊（先放 5 民）
          // ※因為是 deck=14（12+2），多出來的2張會當底牌
          "villager",
          "villager",
          "villager",
          "villager",
          "villager",
        ],
      },
      "12-thief-edge": {
        players: 12,
        winMode: "edge",
        hasPolice: false,
        extra: 2,
        deck: [
          "werewolf",
          "werewolf",
          "blackwolf",
          "whitewolf",
          "seer",
          "witch",
          "hunter",
          "guard",
          "thief",
          "villager",
          "villager",
          "villager",
          "villager",
          "villager",
        ],
      },
    },
  };

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

  /* ------------------------- State ------------------------- */
  const defaultState = () => ({
    phase: "setup", // setup | deal | night | day | vote
    day: 1,
    isNight: false,

    // setup
    players: null,
    boardId: null,
    boardMeta: null,

    winMode: "edge", // edge|city
    hasPolice: false,

    // seats
    seats: [], // {n, roleId, alive, selected, seen, death:{cause}, marks:{wolf, potion}, notes:[]}

    // dealing
    deck: [], // full deck (players + extra)
    bottom: [], // bottom cards
    dealt: false,

    // thief
    thiefSeat: null,
    thiefChosen: false,
    thiefChoice: null, // {picked, discarded}

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

    // flow step
    flow: {
      step: 0,
      steps: [], // generated
      mode: null, // selection mode
      vote: {
        target: null, // seat n or 0 for abstain
        map: {}, // voterSeat -> target
      },
    },

    // announcements
    logs: [], // {day, public, god}
    godView: false,
  });

  let S = defaultState();

  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(S));
    } catch {}
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

  /* ------------------------- Boards loading ------------------------- */
  async function fetchJSON(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  async function loadBoardsIndex() {
    // 先嘗試 boards/index.json（你剛剛 A 給的）
    try {
      const idx = await fetchJSON("boards/index.json");
      const items = [];
      if (idx && Array.isArray(idx.groups)) {
        idx.groups.forEach((g) => {
          (g.items || []).forEach((it) => items.push(it));
        });
      }
      // normalize
      return items.map((it) => ({
        id: it.id,
        title: it.title,
        players: it.players,
        path: it.path,
        tags: it.tags || [],
      }));
    } catch {
      // fallback
      return BOARD_FALLBACK.list.map((x) => ({ id: x.id, title: x.title, players: x.players, path: x.path, tags: [] }));
    }
  }

  async function loadBoardById(boardId) {
    // 讀取對應 path
    const boards = await loadBoardsIndex();
    const meta = boards.find((b) => b.id === boardId) || BOARD_FALLBACK.list.find((b) => b.id === boardId);
    if (!meta) throw new Error("Board not found");

    // 嘗試讀 JSON
    try {
      const obj = await fetchJSON(meta.path);

      // 支援兩種格式：
      // A) { players, winMode, hasPolice, extra, deck:[...] }
      // B) { meta:{players,...}, roles:{...} } -> 盡力轉成 deck
      const players = obj.players ?? obj?.meta?.players ?? meta.players;
      const winMode = obj.winMode ?? obj?.meta?.winMode ?? meta.winMode ?? "edge";
      const hasPolice = obj.hasPolice ?? obj?.meta?.hasPolice ?? false;
      const extra = obj.extra ?? obj?.meta?.extra ?? 0;

      let deck = Array.isArray(obj.deck) ? obj.deck.slice() : null;

      // 若沒有 deck，嘗試由 roles 組合（非常寬鬆）
      if (!deck && obj.roles) {
        deck = [];
        const wolves = obj.roles.wolves || [];
        const gods = obj.roles.gods || [];
        const villagerN = obj.roles.villagers ?? 0;

        wolves.forEach((r) => deck.push(r));
        gods.forEach((r) => deck.push(r));
        for (let i = 0; i < villagerN; i++) deck.push("villager");
      }

      // deck 若仍不存在，用 fallback byId
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
      // fallback byId
      const fb = BOARD_FALLBACK.byId[boardId];
      if (!fb) {
        // 最後兜底：12人官方（4狼4神4民）
        return {
          id: "official-12",
          title: "12人官方標準局（fallback）",
          players: 12,
          winMode: "edge",
          hasPolice: false,
          extra: 0,
          deck: ["werewolf", "werewolf", "werewolf", "werewolf", "seer", "witch", "hunter", "guard", "villager", "villager", "villager", "villager"],
        };
      }
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
  }

  /* ------------------------- Setup UI ------------------------- */
  function renderSetup(boardsAll) {
    // 人數 chips
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

    if (!players) {
      boardHint.textContent = "請先選人數，再選板子（點一下會變色）";
    } else {
      boardHint.textContent = "請選擇板子（點一下會變色）";
    }

    // 格子按鈕區分開來
    list.forEach((b) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "boardBtn";
      btn.textContent = b.title;
      btn.dataset.id = b.id;

      const isSel = S.boardId === b.id;
      btn.classList.toggle("active", isSel);

      btn.onclick = async () => {
        S.boardId = b.id;
        // 先讓 UI 立即變色
        save();
        renderBoardList(boardsAll);
        syncTop();

        // 再載入 board meta
        try {
          const meta = await loadBoardById(b.id);
          S.boardMeta = meta;
          S.winMode = meta.winMode || S.winMode;
          S.hasPolice = !!meta.hasPolice;

          // 設定抽屜同步
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
        marks: {
          wolfHit: false,
          guard: false,
          save: false,
          poison: false,
        },
        notes: [],
      });
    }
  }

  function renderSeats() {
    seatsGrid.innerHTML = "";
    const n = S.players || 0;

    // 原本喜歡的：格子 grid（由 CSS 控）
    for (let i = 1; i <= n; i++) {
      const seat = S.seats[i - 1];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "seat";
      btn.dataset.n = String(i);

      // 顯示：號碼 +（上帝視角時）角色/陣營/事件
      const top = document.createElement("div");
      top.className = "seatNum";
      top.textContent = String(i);
      btn.appendChild(top);

      if (S.godView && seat.roleId) {
        const info = roleInfo(seat.roleId);

        const badge = document.createElement("div");
        badge.className = "seatBadge";
        badge.textContent = `${info.abbr}`;
        btn.appendChild(badge);

        // 事件小圖示
        const ev = document.createElement("div");
        ev.className = "seatEvents";
        const icons = [];
        if (!seat.alive && seat.death?.cause) icons.push(seat.death.cause);
        if (seat.marks.guard) icons.push("🛡️");
        if (seat.marks.save) icons.push("💊");
        if (seat.marks.poison) icons.push("🧪");
        ev.textContent = icons.join(" ");
        btn.appendChild(ev);

        // 陣營框色
        btn.classList.toggle("campWolf", info.camp === CAMP.WOLF);
        btn.classList.toggle("campGood", info.camp === CAMP.GOOD);
      } else {
        btn.classList.remove("campWolf", "campGood");
      }

      // 存活/死亡外觀
      btn.classList.toggle("dead", !seat.alive);

      // 選取外觀
      btn.classList.toggle("selected", !!seat.selected);

      // 點一下：選取/取消
      btn.onclick = () => {
        // setup 階段不顯示座位可點（你要選完進入遊戲才出現），所以這裡也保護
        if (S.phase === "setup") return;

        // 投票模式：有 target 才算投票，否則是選 target
        if (S.phase === "vote") {
          handleVoteTap(seat.n);
          return;
        }

        // 一般模式：toggle selected
        seat.selected = !seat.selected;
        save();
        renderSeats();
        syncPrompt();
      };

      // 長按 0.3 秒：看身分（deal 期或你想隨時查看）
      let pressTimer = null;
      btn.addEventListener("touchstart", () => {
        if (S.phase === "setup") return;
        pressTimer = setTimeout(() => {
          pressTimer = null;
          openRole(seat.n);
        }, 300);
      });
      btn.addEventListener("touchend", () => {
        if (pressTimer) clearTimeout(pressTimer);
        pressTimer = null;
      });
      btn.addEventListener("touchmove", () => {
        if (pressTimer) clearTimeout(pressTimer);
        pressTimer = null;
      });

      // 桌機也能用 mousedown 長按
      btn.addEventListener("mousedown", () => {
        if (S.phase === "setup") return;
        pressTimer = setTimeout(() => {
          pressTimer = null;
          openRole(seat.n);
        }, 300);
      });
      btn.addEventListener("mouseup", () => {
        if (pressTimer) clearTimeout(pressTimer);
        pressTimer = null;
      });
      btn.addEventListener("mouseleave", () => {
        if (pressTimer) clearTimeout(pressTimer);
        pressTimer = null;
      });

      seatsGrid.appendChild(btn);
    }
  }

  /* ------------------------- Dealing (deck + bottom cards) ------------------------- */
  function dealIfNeeded() {
    if (S.dealt) return;

    const meta = S.boardMeta;
    if (!meta || !meta.players || !Array.isArray(meta.deck)) return;

    const players = meta.players;
    const extra = meta.extra || Math.max(0, meta.deck.length - players);

    // deck總長度要 >= players
    let deck = meta.deck.slice();

    // 安全：若 deck 長度不足，就補 villager
    while (deck.length < players) deck.push("villager");

    // 若 extra 需要但 deck 不夠，就再補 villager
    while (deck.length < players + extra) deck.push("villager");

    // 洗牌
    deck = shuffle(deck);

    // 發給玩家
    for (let i = 0; i < players; i++) {
      S.seats[i].roleId = deck[i];
    }

    // 底牌（盜賊用）
    S.bottom = deck.slice(players, players + extra);

    S.deck = deck;
    S.dealt = true;

    // 找盜賊座位
    const thiefIdx = S.seats.findIndex((x) => x.roleId === "thief" || x.roleId === "robber");
    S.thiefSeat = thiefIdx >= 0 ? S.seats[thiefIdx].n : null;

    // 女巫藥初始化
    S.night.usedSave = false;
    S.night.usedPoison = false;

    save();
  }

  /* ------------------------- Role modal + Thief choice ------------------------- */
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

  btnRoleClose.onclick = () => {
    // 關閉也要「蓋牌」：不在格子上留任何角色字樣（我們本來就不顯示）
    closeRoleModal();
  };

  btnRoleDone.onclick = () => {
    const seatN = CURRENT_ROLE_SEAT;
    if (!seatN) {
      closeRoleModal();
      return;
    }

    // 標記看過
    const seat = S.seats[seatN - 1];
    seat.seen = true;
    save();

    closeRoleModal();
    renderSeats();
    syncPrompt();

    // ✅ 盜賊：看完盜賊身分後立刻進入選角（不是進黑夜才選）
    if ((seat.roleId === "thief" || seat.roleId === "robber") && !S.thiefChosen) {
      openThiefChoose(seatN);
    }
  };

  function openThiefChoose(seatN) {
    // 只有 board 有 extra>=2 才會有底牌
    if (!Array.isArray(S.bottom) || S.bottom.length < 2) {
      // 沒底牌就不開
      return;
    }

    const a = S.bottom[0];
    const b = S.bottom[1];

    const ia = roleInfo(a);
    const ib = roleInfo(b);

    thiefHint.textContent =
      `盜賊（${seatN}號）請在兩張底牌中選擇其一。若其中有狼陣營，必須選狼陣營。`;

    btnThiefA.textContent = ia.name;
    btnThiefB.textContent = ib.name;

    // 強制規則：有狼 + 好人 => 只能選狼
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
    // 盜賊座位變成 pickedRole
    const seat = S.seats[seatN - 1];
    seat.roleId = pickedRole;

    // 記錄盜賊選擇（上帝可看）
    S.thiefChosen = true;
    S.thiefChoice = { picked: pickedRole, discarded: discardedRole };

    // ✅ 底牌移除（不會再出現在任何玩家身上）
    // （玩家早已發完，底牌只是額外資訊；這裡是為了正確顯示「哪張被捨棄」）
    S.bottom = [];

    // 公告（公開版不說底牌內容；上帝版記錄）
    pushLog(
      `盜賊已完成選角。`,
      `盜賊（${seatN}號）選擇：${roleInfo(pickedRole).name}；捨棄：${roleInfo(discardedRole).name}`
    );

    save();
    closeModal(thiefModal);
    renderSeats();
    syncPrompt();
  }

  /* ------------------------- Flow generation ------------------------- */
  function rolesInGame() {
    const set = new Set();
    S.seats.forEach((s) => {
      if (s.roleId) set.add(s.roleId);
    });
    return set;
  }

  function buildNightSteps() {
    const set = rolesInGame();

    // 你指定的基本夜晚順序（第2天）：守衛->狼人->預言家->女巫
    // 若 board 有其他角色（邱比特、盜賊等）再加在第1天特殊流程中（後續你要 C 我再加完整）
    const steps = [];

    if (set.has("guard")) {
      steps.push({
        key: "guard",
        title: "🛡️ 守衛請睜眼",
        text: "請守衛選擇今晚要守護的座位。\n（提示：再點同號可取消）",
        mode: { type: "pickOneAlive", store: "guardTarget" },
      });
    }

    // 狼人行動（包含黑白狼王本質仍是狼陣營）
    if (set.has("werewolf") || set.has("blackwolf") || set.has("whitewolf")) {
      steps.push({
        key: "wolf",
        title: "🐺 狼人請睜眼",
        text: "請狼人共同選擇今晚要刀的座位。\n（提示：再點同號可取消）",
        mode: { type: "pickOneAlive", store: "wolfTarget" },
      });
    }

    if (set.has("seer")) {
      steps.push({
        key: "seer",
        title: "🔮 預言家請睜眼",
        text: "請預言家查驗一名玩家。\n上帝點選座位後，會顯示該玩家陣營（好/狼）供口頭宣告。",
        mode: { type: "pickOneAlive", store: "seerTarget", reveal: "seerReveal" },
      });
    }

    if (set.has("witch")) {
      steps.push({
        key: "witch",
        title: "🧪 女巫請睜眼",
        text:
          "女巫今晚可選擇：\n" +
          "1) 💊 解藥：點『被刀的人』表示救\n" +
          "2) 🧪 毒藥：點『任一人』表示毒\n" +
          "同一晚只能擇一，且用過就沒有。\n（提示：再點同號可取消）",
        mode: { type: "witch" },
      });
    }

    return steps;
  }

  function setFlowSteps(steps) {
    S.flow.steps = steps;
    S.flow.step = 0;
    S.flow.mode = steps[0]?.mode || null;
  }

  function currentStep() {
    return S.flow.steps[S.flow.step] || null;
  }

  /* ------------------------- Night/Day/Vote transitions ------------------------- */
  function startDealPhase() {
    S.phase = "deal";
    S.day = 1;
    S.isNight = false;

    // 初始化座位
    initSeats(S.players);
    dealIfNeeded();

    pushLog("遊戲開始，請依序查看身分。", `板子：${S.boardMeta?.title || S.boardId}；winMode=${S.winMode}`);

    save();
    renderAll();
  }

  function startNight() {
    S.phase = "night";
    S.isNight = true;

    // 清掉本夜行動
    S.night.guardTarget = null;
    S.night.wolfTarget = null;
    S.night.seerTarget = null;
    S.night.witchSave = null;
    S.night.witchPoison = null;

    // 清掉座位選取
    S.seats.forEach((s) => (s.selected = false));

    const steps = buildNightSteps();
    setFlowSteps(steps);

    pushLog(`第 ${S.day} 天進入天黑。`, `夜晚流程開始：${steps.map((x) => x.key).join(" -> ")}`);

    save();
    renderAll();
  }

  function resolveNight() {
    // 解析夜晚結果（簡化版：處理守衛/狼刀/女巫）
    const wolf = S.night.wolfTarget;
    const guard = S.night.guardTarget;

    // 先清掉標記
    S.seats.forEach((s) => {
      s.marks.wolfHit = false;
      s.marks.guard = false;
      s.marks.save = false;
      s.marks.poison = false;
    });

    if (guard) {
      S.seats[guard - 1].marks.guard = true;
    }

    if (wolf) {
      S.seats[wolf - 1].marks.wolfHit = true;
    }

    // 女巫
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

    // 判定：狼刀是否被守/救擋下
    const deaths = [];
    if (wolf) {
      const blockedByGuard = guard && guard === wolf;
      const blockedByWitch = saved && saved === wolf;

      if (!blockedByGuard && !blockedByWitch) {
        deaths.push({ n: wolf, cause: "🐺" }); // 狼刀
      }
    }

    if (poisoned) {
      deaths.push({ n: poisoned, cause: "🧪" }); // 毒死
    }

    // 執行死亡
    deaths.forEach((d) => {
      const seat = S.seats[d.n - 1];
      seat.alive = false;
      seat.death = { cause: d.cause, day: S.day };
      seat.selected = false;
    });

    // 公告文字（公開）
    if (deaths.length === 0) {
      pushLog("昨夜平安無事。", `守衛：${guard || "未選"}；狼刀：${wolf || "未選"}；解藥：${saved || "未用"}；毒藥：${poisoned || "未用"}`);
    } else {
      const diedNums = deaths.map((d) => `${d.n}號`).join("、");
      pushLog(`昨夜死亡：${diedNums}。`, `守衛：${guard || "未選"}；狼刀：${wolf || "未選"}；解藥：${saved || "未用"}；毒藥：${poisoned || "未用"}；死亡明細=${JSON.stringify(deaths)}`);
    }

    save();
  }

  function startDay() {
    // 先結算夜晚
    if (S.phase === "night") {
      resolveNight();
    }

    S.phase = "day";
    S.isNight = false;

    // 清掉選取
    S.seats.forEach((s) => (s.selected = false));

    save();
    renderAll();
  }

  function startVote() {
    S.phase = "vote";
    S.isNight = false;

    // init vote map
    S.flow.vote = { target: null, map: {} };
    S.seats.forEach((s) => (s.selected = false));

    pushLog(`第 ${S.day} 天開始投票。`, "投票模式：先點『放逐目標』，再點『投票的人』；再點可取消。");

    save();
    renderAll();
  }

  function finishVoteAndAnnounce() {
    const map = S.flow.vote.map || {};
    const groups = new Map(); // target -> voters[]
    const voters = Object.keys(map).map((k) => Number(k));

    voters.forEach((v) => {
      const t = Number(map[v]);
      if (!groups.has(t)) groups.set(t, []);
      groups.get(t).push(v);
    });

    // 格式化公告：投給1號的有3、4...
    const lines = [];
    const targets = Array.from(groups.keys()).sort((a, b) => a - b);

    let maxTarget = null;
    let maxVotes = -1;

    targets.forEach((t) => {
      const vs = (groups.get(t) || []).sort((a, b) => a - b);
      const who = vs.join("、");
      if (t === 0) {
        lines.push(`棄票的有${who ? who : "（無）"}`);
      } else {
        lines.push(`投給${t}號的有${who ? who : "（無）"}（${vs.length}票）`);
        if (vs.length > maxVotes) {
          maxVotes = vs.length;
          maxTarget = t;
        }
      }
    });

    if (maxTarget && maxVotes > 0) {
      lines.push(`${maxTarget}號得到最高票遭到放逐。`);
      // 先不強制死亡（你可能還要處理白痴、獵人槍等），先記錄公告即可
    } else {
      lines.push("本輪投票無法決定最高票。");
    }

    pushLog(lines.join("\n"), `voteMap=${JSON.stringify(map)}`);

    // 投票結束 -> 進入天黑
    S.day += 1;
    startNight();
  }

  function handleVoteTap(seatN) {
    const seat = S.seats[seatN - 1];
    if (!seat.alive) return;

    const vote = S.flow.vote;

    // 若尚未選放逐目標：第一次點就是目標
    if (vote.target == null) {
      vote.target = seatN;
      // 目標視覺：把目標 seat 設 selected
      S.seats.forEach((s) => (s.selected = false));
      seat.selected = true;
      save();
      renderSeats();
      syncPrompt();
      return;
    }

    // 已有目標：點的人=投票者 toggle
    const voter = seatN;
    const cur = vote.map[voter];

    if (cur === vote.target) {
      delete vote.map[voter]; // 再點取消
    } else {
      vote.map[voter] = vote.target;
    }

    save();
    syncPrompt();
  }

  /* ------------------------- Logs ------------------------- */
  function pushLog(publicText, godText) {
    S.logs.push({
      day: S.day,
      public: publicText,
      god: godText || publicText,
      ts: Date.now(),
    });
    save();
  }

  function renderAnn() {
    const showGod = !!toggleAnnGod.checked;

    const lines = [];
    const logs = S.logs.slice(-200);

    logs.forEach((l) => {
      const head = `【Day ${l.day}】`;
      lines.push(head);
      lines.push(showGod ? l.god : l.public);
      lines.push("");
    });

    annText.textContent = lines.join("\n").trim();
  }

  /* ------------------------- Prompt / Top / Buttons ------------------------- */
  function syncTop() {
    const p = S.players ? `${S.players}人` : "未選人數";
    const b = S.boardMeta?.title || S.boardId || "未選板子";

    uiStatus.textContent =
      S.phase === "setup"
        ? "開局設定"
        : S.phase === "deal"
        ? "抽身分"
        : S.phase === "night"
        ? `夜晚 Day${S.day}`
        : S.phase === "vote"
        ? `投票 Day${S.day}`
        : `白天 Day${S.day}`;

    uiBoard.textContent = `${p}｜${b}`;
  }

  function syncPrompt() {
    // setup
    if (S.phase === "setup") {
      promptTitle.textContent = "開始前請先選人數與板子";
      promptText.textContent =
        "1) 先選人數（9/10/12）\n" +
        "2) 再選板子（會變色）\n" +
        "3) 按底部「下一步」開始抽身分\n\n" +
        "提示：設定（⚙️）可回到開局重選。";
      promptFoot.textContent = "";
      btnBack.disabled = true;
      btnNext.disabled = !(S.players && S.boardId);
      btnMain.disabled = true;
      btnMain.textContent = "—";
      return;
    }

    // deal
    if (S.phase === "deal") {
      const total = S.players || 0;
      const seen = S.seats.filter((s) => s.seen).length;
      promptTitle.textContent = `抽身分（已看 ${seen}/${total}）`;
      promptText.textContent =
        "請玩家依序長按自己的號碼 0.3 秒查看身分。\n" +
        "看完請按「我看完了」並把手機交回上帝。\n\n" +
        "※ 看完後會蓋牌，不會留在畫面上。";
      promptFoot.textContent = "";

      btnBack.disabled = true;
      btnMain.disabled = true;
      btnMain.textContent = "—";

      // ✅ 全部看完才能進夜晚（且盜賊若存在必須完成選角）
      const allSeen = seen === total;
      const thiefOk = !S.thiefSeat || S.thiefChosen;
      btnNext.disabled = !(allSeen && thiefOk);
      return;
    }

    // night
    if (S.phase === "night") {
      const step = currentStep();
      if (!step) {
        promptTitle.textContent = "夜晚流程（無角色行動）";
        promptText.textContent = "此板子本夜無可操作流程。按「天亮睜眼」進入白天。";
        promptFoot.textContent = "";
      } else {
        promptTitle.textContent = `${step.title}（步驟 ${S.flow.step + 1}/${S.flow.steps.length}）`;
        promptText.textContent = step.text;

        // 額外提示：預言家查驗顯示結果
        if (step.mode?.reveal === "seerReveal" && S.night.seerTarget) {
          const t = S.night.seerTarget;
          const camp = roleInfo(S.seats[t - 1].roleId).camp === CAMP.WOLF ? "狼人" : "好人";
          promptText.textContent += `\n\n✅ 查驗結果：${t}號是【${camp}】`;
        }

        // 女巫用藥狀態
        if (step.key === "witch") {
          const line = [];
          line.push(`解藥：${S.night.usedSave ? "已用" : "未用"}`);
          line.push(`毒藥：${S.night.usedPoison ? "已用" : "未用"}`);
          promptText.textContent += `\n\n${line.join("｜")}`;
        }

        promptFoot.textContent = "";
      }

      btnBack.disabled = S.flow.step <= 0;
      btnNext.disabled = false;
      btnMain.disabled = false;
      btnMain.textContent = "天亮睜眼";
      return;
    }

    // day
    if (S.phase === "day") {
      promptTitle.textContent = `白天（Day ${S.day}）`;
      promptText.textContent =
        "你可以：\n" +
        "1) 📣 打開公告回顧\n" +
        "2) 👁 開啟上帝視角（座位直接顯示陣營/角色/事件）\n" +
        "3) 準備好後按「開始投票」\n\n" +
        "提示：按「天黑閉眼」可直接進入夜晚。";
      promptFoot.textContent = "";
      btnBack.disabled = true;
      btnNext.disabled = false;
      btnNext.textContent = "下一步";
      btnMain.disabled = false;
      btnMain.textContent = "開始投票";
      return;
    }

    // vote
    if (S.phase === "vote") {
      const vote = S.flow.vote;
      const target = vote.target;

      promptTitle.textContent = `投票（Day ${S.day}）`;
      if (target == null) {
        promptText.textContent = "請先點選『要放逐的目標』座位（第一次點）。";
      } else {
        const assigned = Object.keys(vote.map).length;
        promptText.textContent =
          `目前放逐目標：${target}號\n` +
          `請點選『投票的人』加入/取消投票。\n` +
          `已記錄：${assigned} 人投票。\n\n` +
          "完成後按「下一步」生成公告。";
      }

      // promptFoot 顯示「棄票」與「重選目標」
      promptFoot.innerHTML = "";
      const row = document.createElement("div");
      row.className = "toolRow";

      const btnResetTarget = document.createElement("button");
      btnResetTarget.type = "button";
      btnResetTarget.className = "btn ghost small";
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
      btnAbstain.className = "btn ghost small";
      btnAbstain.textContent = "棄票（目標=0）";
      btnAbstain.onclick = () => {
        vote.target = 0;
        S.seats.forEach((s) => (s.selected = false));
        save();
        renderSeats();
        syncPrompt();
      };

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
    // 依 phase 決定 btnNext / btnMain 的行為
    btnNext.onclick = () => {
      if (S.phase === "setup") {
        // 進入抽身分
        if (!(S.players && S.boardId)) return;
        startDealPhase();
        return;
      }

      if (S.phase === "deal") {
        // 全看完 -> 進夜晚
        const total = S.players || 0;
        const seen = S.seats.filter((s) => s.seen).length;
        const allSeen = seen === total;
        const thiefOk = !S.thiefSeat || S.thiefChosen;
        if (!allSeen || !thiefOk) return;
        startNight();
        return;
      }

      if (S.phase === "night") {
        // 下一步：處理 step 流程
        const step = currentStep();
        if (!step) return;

        // 確認該步有選擇（女巫允許沒做事）
        if (step.key === "guard" && !S.night.guardTarget) {
          toast("請選守護目標（可再點取消）");
          return;
        }
        if (step.key === "wolf" && !S.night.wolfTarget) {
          toast("請選狼人刀口（可再點取消）");
          return;
        }
        if (step.key === "seer" && !S.night.seerTarget) {
          toast("請選查驗目標（可再點取消）");
          return;
        }
        // witch 可不做

        // 前進步驟
        S.flow.step = clamp(S.flow.step + 1, 0, S.flow.steps.length);
        if (S.flow.step >= S.flow.steps.length) {
          // 夜晚步驟完成 -> 等上帝按「天亮睜眼」
          S.flow.step = S.flow.steps.length - 1;
          toast("夜晚流程完成，按「天亮睜眼」進入白天");
        }
        save();
        syncPrompt();
        return;
      }

      if (S.phase === "day") {
        // 白天下一步：直接進投票（你也可用中間鍵）
        startVote();
        return;
      }

      if (S.phase === "vote") {
        // 生成投票公告
        const vote = S.flow.vote;
        if (vote.target == null) {
          toast("請先點選放逐目標");
          return;
        }
        finishVoteAndAnnounce();
        return;
      }
    };

    btnBack.onclick = () => {
      if (S.phase === "night") {
        S.flow.step = clamp(S.flow.step - 1, 0, S.flow.steps.length - 1);
        save();
        syncPrompt();
      }
    };

    btnMain.onclick = () => {
      // 中間鍵：重要流程切換
      if (S.phase === "day") {
        // 你文字顯示「開始投票」
        startVote();
        return;
      }
      if (S.phase === "vote") {
        // 投票中可直接進夜晚（若你想跳過公告也行）
        startNight();
        return;
      }
      if (S.phase === "night") {
        // 天亮
        startDay();
        return;
      }
      // deal/setup 不啟用
    };
  }

  /* ------------------------- Night selection handling ------------------------- */
  function handleSeatPickForNight(seatN) {
    const seat = S.seats[seatN - 1];
    if (!seat || !seat.alive) return;

    const step = currentStep();
    if (!step) return;

    if (!step.mode) return;

    const type = step.mode.type;

    // pickOneAlive
    if (type === "pickOneAlive") {
      const store = step.mode.store;

      // toggle
      const cur = S.night[store];
      if (cur === seatN) {
        S.night[store] = null;
      } else {
        S.night[store] = seatN;
      }

      // 視覺：只有這個被 selected（再點取消全清）
      S.seats.forEach((s) => (s.selected = false));
      if (S.night[store]) S.seats[S.night[store] - 1].selected = true;

      // 預言家查驗立即顯示結果
      save();
      renderSeats();
      syncPrompt();
      return;
    }

    // witch
    if (type === "witch") {
      // 同一晚只能擇一：救 or 毒
      // 救：只能點「狼刀目標」
      // 毒：可點任一存活
      const wolf = S.night.wolfTarget;

      // 若點的是狼刀目標 => 嘗試救
      if (wolf && seatN === wolf) {
        if (S.night.usedSave) {
          toast("解藥已用過");
          return;
        }
        // toggle 救
        if (S.night.witchSave === seatN) {
          S.night.witchSave = null;
        } else {
          S.night.witchSave = seatN;
          // 選救會清掉毒
          S.night.witchPoison = null;
        }
      } else {
        // 毒
        if (S.night.usedPoison) {
          toast("毒藥已用過");
          return;
        }
        if (S.night.witchPoison === seatN) {
          S.night.witchPoison = null;
        } else {
          S.night.witchPoison = seatN;
          // 選毒會清掉救
          S.night.witchSave = null;
        }
      }

      // 視覺：把救/毒目標標記在座位（上帝視角才會出圖示；一般不顯示）
      save();
      syncPrompt();
      renderSeats();
      return;
    }
  }

  /* ------------------------- Toast (lightweight) ------------------------- */
  let toastTimer = null;
  function toast(msg) {
    uiStatus.textContent = msg;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      syncTop();
    }, 1200);
  }

  /* ------------------------- Timer ------------------------- */
  let timerSec = 90;
  let timerRunning = false;
  let timerT = null;

  function timerRender() {
    timerBig.textContent = formatTime(timerSec);
  }

  function timerStart() {
    if (timerRunning) return;
    timerRunning = true;
    timerT = setInterval(() => {
      timerSec = Math.max(0, timerSec - 1);
      timerRender();
      if (timerSec <= 0) {
        timerStop();
        // 震動（可用）
        try {
          navigator.vibrate?.(300);
        } catch {}
      }
    }, 1000);
  }
  function timerStop() {
    timerRunning = false;
    if (timerT) clearInterval(timerT);
    timerT = null;
  }
  function timerReset() {
    timerStop();
    timerSec = 90;
    timerRender();
  }

  /* ------------------------- Dice ------------------------- */
  function openDice() {
    const alive = S.seats.filter((s) => s.alive).map((s) => s.n);
    if (alive.length === 0) {
      diceResult.textContent = "—";
    } else {
      const pick = alive[Math.floor(Math.random() * alive.length)];
      diceResult.textContent = `${pick} 號`;
    }
    openModal(diceModal);
  }

  /* ------------------------- God view toggle ------------------------- */
  function toggleGodView() {
    S.godView = !S.godView;
    save();
    renderSeats();
  }

  /* ------------------------- Event wiring (Top buttons / drawers) ------------------------- */
  function wireUI() {
    // Ann
    btnAnn.onclick = () => {
      renderAnn();
      openDrawer(annBackdrop, annDrawer);
    };
    btnCloseAnn.onclick = () => closeDrawer(annBackdrop, annDrawer);
    annBackdrop.onclick = () => closeDrawer(annBackdrop, annDrawer);
    toggleAnnGod.onchange = () => renderAnn();

    // Timer
    btnTimer.onclick = () => {
      timerRender();
      openDrawer(timerBackdrop, timerDrawer);
    };
    btnCloseTimer.onclick = () => closeDrawer(timerBackdrop, timerDrawer);
    timerBackdrop.onclick = () => closeDrawer(timerBackdrop, timerDrawer);

    // Timer presets
    $$("#timerPresets .chip[data-sec]").forEach((btn) => {
      btn.onclick = () => {
        timerSec = Number(btn.dataset.sec || 90);
        timerRender();
      };
    });
    btnTimerStart.onclick = () => timerStart();
    btnTimerPause.onclick = () => timerStop();
    btnTimerReset.onclick = () => timerReset();

    // Eye
    btnEye.onclick = () => {
      toggleGodView();
      toast(S.godView ? "上帝視角：開" : "上帝視角：關");
    };

    // Dice
    btnDice.onclick = () => openDice();
    btnDiceAgain.onclick = () => openDice();
    btnDiceClose.onclick = () => closeModal(diceModal);

    // Settings
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

    togglePolice.onchange = () => {
      S.hasPolice = !!togglePolice.checked;
      save();
    };

    btnGotoSetup.onclick = () => {
      // 回到開局：保留 boards index 但清遊戲
      S = defaultState();
      save();
      location.reload();
    };

    btnHardReset.onclick = () => {
      localStorage.removeItem(LS_KEY);
      location.reload();
    };

    // Seat interactions for night pick
    seatsGrid.addEventListener("click", (e) => {
      const btn = e.target?.closest(".seat");
      if (!btn) return;
      const n = Number(btn.dataset.n);
      if (!n) return;

      if (S.phase === "night") {
        handleSeatPickForNight(n);
      }
    });
  }

  /* ------------------------- Render all ------------------------- */
  function renderAll() {
    // setup card visible only in setup
    setupCard.style.display = S.phase === "setup" ? "" : "none";

    // seats: setup 階段不顯示座位（你要選完進入遊戲才出現）
    if (S.phase === "setup") {
      seatsGrid.innerHTML = "";
    } else {
      renderSeats();
    }

    syncTop();
    syncPrompt();
  }

  /* ------------------------- Boot ------------------------- */
  async function boot() {
    // load state
    load();

    // boards list
    const boardsAll = await loadBoardsIndex();

    // setup UI
    renderSetup(boardsAll);

    // if already selected board but meta missing, load
    if (S.boardId && !S.boardMeta) {
      try {
        S.boardMeta = await loadBoardById(S.boardId);
      } catch {}
    }

    // if we were past setup but seats not inited, fix
    if (S.phase !== "setup") {
      if (!S.players && S.boardMeta?.players) S.players = S.boardMeta.players;
      if (!S.players && S.boardMeta?.players == null && S.boardId) S.players = 12;

      if (!Array.isArray(S.seats) || S.seats.length !== S.players) {
        initSeats(S.players);
      }
      if (!S.dealt && S.boardMeta) {
        dealIfNeeded();
      }
    }

    // sync settings drawer
    togglePolice.checked = !!S.hasPolice;
    segEdge.classList.toggle("active", S.winMode === "edge");
    segCity.classList.toggle("active", S.winMode === "city");

    // wire events
    wireUI();
    syncBottomButtons();

    // render
    renderAll();
  }

  boot().catch((err) => {
    console.error(err);
    // fallback minimal render
    syncTop();
    syncPrompt();
  });
})();