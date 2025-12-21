/* =============================
  狼人殺上帝輔助 - app.js
  ✅ 座位 Grid 點選/取消
  ✅ 長按0.3秒看身分（防iOS選字/放大）
  ✅ 看完自動蓋牌
  ✅ 👁 上帝視角：在號碼格顯示角色/陣營
  ✅ 板子選取變色
  ✅ 盜賊：抽身分階段立刻二選一（底牌兩張）
============================= */

(() => {
  // ---------- DOM ----------
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
  const boardHint = $("boardHint");

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

  // ---------- iOS 防選字/長按選單/雙擊放大（JS版） ----------
  // 1) 阻止長按跳出選單（複製/查詢）
  document.addEventListener("contextmenu", (e) => e.preventDefault(), { passive: false });

  // 2) 阻止雙擊放大（Safari）
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });

  // 3) 阻止文字被選取（保險）
  document.addEventListener("selectstart", (e) => {
    // 讓 input/textarea 仍可選字
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    e.preventDefault();
  }, { passive: false });

  // ---------- 資料 ----------
  const ROLE = {
    villager: { zh: "平民", camp: "good" },
    wolf:     { zh: "狼人", camp: "wolf" },
    seer:     { zh: "預言家", camp: "good" },
    witch:    { zh: "女巫", camp: "good" },
    hunter:   { zh: "獵人", camp: "good" },
    guard:    { zh: "守衛", camp: "good" },
    idiot:    { zh: "白癡", camp: "good" },
    cupid:    { zh: "邱比特", camp: "good" },
    robber:   { zh: "盜賊", camp: "good" }, // 盜賊本體是好人陣營，但會變成抽到的角色
  };

  const CAMP_ZH = { good: "好人", wolf: "狼人" };

  // 板子：你可再加更多（9/10 也能擴）
  // 注意：12-thief 是 14 張牌：12人發12張 + 底牌2張給盜賊二選一
  const BOARDS = [
    {
      id: "official-12",
      n: 12,
      name: "12 人官方標準局",
      tags: ["官方", "穩", "含白癡"],
      deck: [
        "wolf","wolf","wolf","wolf",
        "seer","witch","hunter","guard","idiot",
        "villager","villager","villager"
      ],
      hasBottom: 0,
      note: "4狼 + 預言家/女巫/獵人/守衛/白癡 + 3民"
    },
    {
      id: "12-city",
      n: 12,
      name: "12 人（標準角色・屠城）",
      tags: ["測試", "屠城"],
      deck: [
        "wolf","wolf","wolf","wolf",
        "seer","witch","hunter","guard","idiot",
        "villager","villager","villager"
      ],
      hasBottom: 0,
      forceWinMode: "city",
      note: "同標準角色，勝負改屠城"
    },
    {
      id: "12-edge-nopolice",
      n: 12,
      name: "12 人（屠邊・無上警）",
      tags: ["測試", "無上警"],
      deck: [
        "wolf","wolf","wolf","wolf",
        "seer","witch","hunter","guard","idiot",
        "villager","villager","villager"
      ],
      hasBottom: 0,
      forcePolice: false,
      note: "同標準角色，但關閉上警"
    },
    {
      id: "12-thief",
      n: 12,
      name: "12 人含盜賊（+2 底牌）",
      tags: ["盜賊", "變體"],
      deck: [
        // 14 cards
        "wolf","wolf","wolf","wolf",
        "seer","witch","hunter","guard","idiot",
        "robber",
        "villager","villager","villager","villager"
      ],
      hasBottom: 2,
      note: "盜賊從底牌兩張二選一；若一狼一好，只能選狼"
    },
  ];

  // ---------- 狀態 ----------
  const STORAGE_KEY = "ww_god_helper_v2";

  const defaultState = () => ({
    phase: "setup",     // setup | deal | night | day | vote
    step: 1,            // 流程內的小步
    n: 12,
    boardId: "official-12",
    winMode: "edge",    // edge | city
    hasPolice: true,

    seats: [],          // [{id, alive, roleKey, camp, seen, events:{}, selected?}]
    selectedSeat: null,

    godView: false,

    // 盜賊底牌與狀態
    bottomCards: [],    // ["seer","wolf"] etc
    thiefSeatId: null,
    thiefChosen: false,

    // 女巫藥
    witch: { healUsed: false, poisonUsed: false, healTarget: null, poisonTarget: null },

    // 公告紀錄
    ann: [], // [{day, textPublic, textGod}]
    day: 1,
    night: 1,

    // timer
    timer: { sec: 90, running: false, endAt: null },
  });

  let S = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const obj = JSON.parse(raw);
      // 簡單容錯
      return { ...defaultState(), ...obj };
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
  }

  // ---------- 工具 ----------
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function boardById(id) {
    return BOARDS.find(b => b.id === id) || BOARDS[0];
  }

  function roleInfo(key) {
    return ROLE[key] || { zh: key, camp: "good" };
  }

  function setText(el, txt) {
    if (!el) return;
    el.textContent = txt == null ? "" : String(txt);
  }

  // ---------- Drawer / Modal ----------
  function openDrawer(backdrop, drawer) {
    backdrop.classList.remove("hidden");
    drawer.classList.remove("hidden");
    drawer.setAttribute("aria-hidden", "false");
    // 防止背景滾動
    document.body.style.overflow = "hidden";
  }
  function closeDrawer(backdrop, drawer) {
    backdrop.classList.add("hidden");
    drawer.classList.add("hidden");
    drawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function openModal(modal) {
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeModal(modal) {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  // ---------- UI：板子列表 ----------
  function renderBoards() {
    const n = S.n;
    const boards = BOARDS.filter(b => b.n === n);

    boardList.innerHTML = "";
    boards.forEach(b => {
      const div = document.createElement("button");
      div.type = "button";
      div.className = "boardItem" + (S.boardId === b.id ? " selected" : "");
      div.dataset.id = b.id;

      const tags = (b.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("");

      div.innerHTML = `
        <div class="boardName">${escapeHtml(b.name)}</div>
        <div class="boardSub">${escapeHtml(b.id)} ・ ${escapeHtml(b.note || "")}</div>
        <div class="boardTags">${tags}</div>
      `;

      div.addEventListener("click", () => {
        S.boardId = b.id;

        // 強制屠城/無上警的板子設定
        if (b.forceWinMode) S.winMode = b.forceWinMode;
        if (b.forcePolice === false) S.hasPolice = false;

        saveState();
        render();
      });

      boardList.appendChild(div);
    });

    if (boards.length === 0) {
      boardList.innerHTML = `<div class="hint">此人數暫無板子</div>`;
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  // ---------- UI：座位 Grid ----------
  function buildSeats(n) {
    const seats = [];
    for (let i = 1; i <= n; i++) {
      seats.push({
        id: i,
        alive: true,
        roleKey: null,
        camp: null,
        seen: false, // 玩家是否看過身分
        events: {
          killedBy: null,     // "wolf"|"poison"|"gun"...
          saved: false,       // 女巫救
          poisoned: false,    // 女巫毒
          guarded: false,     // 守護
        },
      });
    }
    return seats;
  }

  function renderSeats() {
    // 12人：4欄；9人：3欄；10人：5x2 or 4欄也行（這裡先4欄）
    const n = S.n;
    const cols = (n === 9) ? 3 : 4;
    seatsGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

    seatsGrid.innerHTML = "";
    S.seats.forEach(seat => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "seat" +
        (S.selectedSeat === seat.id ? " selected" : "") +
        (!seat.alive ? " dead" : "");

      btn.dataset.id = seat.id;

      // 內容：永遠顯示號碼
      // 若 godView=true 且已分配角色 -> 顯示角色與陣營
      // 否則顯示提示字
      const showGod = S.godView && seat.roleKey;

      const roleLine = showGod
        ? `${roleInfo(seat.roleKey).zh}・${CAMP_ZH[seat.camp]}`
        : (S.phase === "deal" ? "長按看身分" : (seat.alive ? "存活" : "死亡"));

      // 事件 icon（只在上帝視角顯示）
      const icons = [];
      if (showGod) {
        if (seat.events.guarded) icons.push("🛡️");
        if (seat.events.saved) icons.push("💊");
        if (seat.events.poisoned) icons.push("🧪");
        if (seat.events.killedBy === "wolf") icons.push("🐺");
        if (seat.events.killedBy === "gun") icons.push("🔫");
      }

      btn.innerHTML = `
        <div class="seatNum">${seat.id}</div>
        <div class="seatSub">${roleLine}</div>
        ${icons.length ? `<div class="seatIcons">${icons.join(" ")}</div>` : ""}
      `;

      // 點一下：選取 / 再點取消（不跑格）
      btn.addEventListener("click", () => {
        const id = seat.id;
        S.selectedSeat = (S.selectedSeat === id) ? null : id;
        saveState();
        renderSeats(); // 只重繪座位即可
      });

      // 長按 0.3 秒：只在 deal 階段允許顯示身分
      attachLongPress(btn, seat.id);

      seatsGrid.appendChild(btn);
    });
  }

  // ---------- 長按：0.3 秒 ----------
  function attachLongPress(el, seatId) {
    let timer = null;
    let moved = false;

    const start = (e) => {
      // 只在抽身分階段允許長按看身分
      if (S.phase !== "deal") return;

      moved = false;
      // 阻止 iOS 長按選字/放大/跳工具
      e.preventDefault?.();

      clearTimeout(timer);
      timer = setTimeout(() => {
        if (moved) return;
        openSeatRole(seatId);
      }, 300);
    };

    const move = () => {
      moved = true;
      clearTimeout(timer);
    };

    const end = () => {
      clearTimeout(timer);
    };

    // pointer events 優先（較穩）
    el.addEventListener("pointerdown", start, { passive: false });
    el.addEventListener("pointermove", move, { passive: true });
    el.addEventListener("pointerup", end, { passive: true });
    el.addEventListener("pointercancel", end, { passive: true });

    // iOS Safari 有時 pointer 不穩，補 touch
    el.addEventListener("touchstart", start, { passive: false });
    el.addEventListener("touchmove", move, { passive: true });
    el.addEventListener("touchend", end, { passive: true });
    el.addEventListener("touchcancel", end, { passive: true });
  }

  function openSeatRole(seatId) {
    const seat = S.seats.find(s => s.id === seatId);
    if (!seat || !seat.roleKey) return;

    // 開 modal 顯示身分（玩家看）
    roleModalTitle.textContent = `${seatId}號 身分`;
    roleModalRole.textContent = roleInfo(seat.roleKey).zh;
    roleModalCamp.textContent = `陣營：${CAMP_ZH[seat.camp]}`;

    // 記錄當前查看 seatId
    roleModal.dataset.seatId = String(seatId);

    openModal(roleModal);
  }

  function markSeatSeen(seatId) {
    const seat = S.seats.find(s => s.id === seatId);
    if (!seat) return;
    seat.seen = true;
    saveState();
    // 看完立即蓋牌：座位格不顯示角色（除非上帝視角開）
    renderSeats();
  }

  // ---------- 發牌/抽身分 ----------
  function startDeal() {
    const b = boardById(S.boardId);

    // 初始化 seats
    S.seats = buildSeats(S.n);
    S.selectedSeat = null;
    S.godView = false;

    // deck
    const deck = shuffle(b.deck);

    // deal 12 cards
    const dealt = deck.slice(0, S.n);
    const bottom = deck.slice(S.n, S.n + (b.hasBottom || 0));

    // assign
    for (let i = 0; i < S.n; i++) {
      const roleKey = dealt[i];
      const info = roleInfo(roleKey);
      S.seats[i].roleKey = roleKey;
      S.seats[i].camp = info.camp;
      S.seats[i].seen = false;
      S.seats[i].events = { killedBy: null, saved: false, poisoned: false, guarded: false };
    }

    // thief support
    S.bottomCards = bottom;
    S.thiefSeatId = null;
    S.thiefChosen = false;

    // 找盜賊座位（若有）
    const thiefSeat = S.seats.find(s => s.roleKey === "robber");
    if (thiefSeat) S.thiefSeatId = thiefSeat.id;

    // reset day/night
    S.phase = "deal";
    S.step = 1;
    S.day = 1;
    S.night = 1;
    S.ann = [];
    S.witch = { healUsed: false, poisonUsed: false, healTarget: null, poisonTarget: null };

    saveState();
    render();
  }

  // 盜賊二選一：在盜賊看完身份後立即跳出
  function maybeOpenThiefChoose(afterSeatSeenId) {
    if (!S.thiefSeatId) return;
    if (S.thiefChosen) return;
    if (afterSeatSeenId !== S.thiefSeatId) return;

    // 盜賊必須有底牌兩張
    if (!Array.isArray(S.bottomCards) || S.bottomCards.length !== 2) {
      // 沒底牌就視為無法變更
      S.thiefChosen = true;
      saveState();
      return;
    }

    const [a, b] = S.bottomCards;
    const ia = roleInfo(a), ib = roleInfo(b);

    // 規則：若一狼一好，只能選狼
    const mustPickWolf = (ia.camp !== ib.camp) && (ia.camp === "wolf" || ib.camp === "wolf");

    thiefHint.textContent = mustPickWolf
      ? "⚠️ 抽到一狼一好：只能選擇狼人陣營那張。"
      : "請從底牌兩張選擇一張成為你的角色。";

    btnThiefA.textContent = `${ia.zh}（${CAMP_ZH[ia.camp]}）`;
    btnThiefB.textContent = `${ib.zh}（${CAMP_ZH[ib.camp]}）`;

    // 先清掉舊 listener（用 clone 替換）
    const newA = btnThiefA.cloneNode(true);
    const newB = btnThiefB.cloneNode(true);
    btnThiefA.parentNode.replaceChild(newA, btnThiefA);
    btnThiefB.parentNode.replaceChild(newB, btnThiefB);

    // 重新綁定
    newA.addEventListener("click", () => {
      if (mustPickWolf && ia.camp !== "wolf") return;
      applyThiefChoice(a);
    });
    newB.addEventListener("click", () => {
      if (mustPickWolf && ib.camp !== "wolf") return;
      applyThiefChoice(b);
    });

    // 更新引用（重要）
    // eslint-disable-next-line no-global-assign
    window.btnThiefA = newA;
    // eslint-disable-next-line no-global-assign
    window.btnThiefB = newB;

    openModal(thiefModal);
  }

  function applyThiefChoice(chosenRoleKey) {
    const seat = S.seats.find(s => s.id === S.thiefSeatId);
    if (!seat) return;

    const info = roleInfo(chosenRoleKey);
    seat.roleKey = chosenRoleKey;
    seat.camp = info.camp;

    // 底牌另一張視為棄牌（不再出現）
    S.thiefChosen = true;

    // 盜賊底牌使用完，清空（避免誤用）
    S.bottomCards = [];

    saveState();
    closeModal(thiefModal);
    renderSeats();
    renderPrompt();
  }

  function allSeen() {
    return S.seats.every(s => s.seen);
  }

  // ---------- 流程（先做穩定骨架） ----------
  function enterNight() {
    // 進入夜晚 1
    S.phase = "night";
    S.step = 1;
    saveState();
    render();
  }

  function enterDay() {
    S.phase = "day";
    S.step = 1;
    saveState();
    render();
  }

  // ---------- Prompt / Top UI ----------
  function renderTop() {
    const b = boardById(S.boardId);
    const phaseMap = {
      setup: `SETUP / step ${S.step}`,
      deal: `抽身分 (${S.seats.filter(s => s.seen).length}/${S.n})`,
      night: `🌙 NIGHT ${S.night} / step ${S.step}`,
      day: `☀️ DAY ${S.day} / step ${S.step}`,
      vote: `🗳️ 投票 / step ${S.step}`,
    };

    setText(uiStatus, phaseMap[S.phase] || "—");
    setText(uiBoard, b?.id || "—");

    // middle main button label
    if (S.phase === "setup") {
      btnMain.textContent = "—";
      btnMain.disabled = true;
    } else if (S.phase === "deal") {
      btnMain.textContent = "開始夜晚";
      btnMain.disabled = !allSeen() || (S.thiefSeatId && !S.thiefChosen);
    } else if (S.phase === "night") {
      btnMain.textContent = "天亮睜眼";
      btnMain.disabled = false;
    } else if (S.phase === "day") {
      btnMain.textContent = "開始投票";
      btnMain.disabled = false;
    } else {
      btnMain.textContent = "—";
      btnMain.disabled = false;
    }

    // 上一步/下一步 enable
    btnBack.disabled = (S.phase === "setup" && S.step === 1);
    btnNext.disabled = false;

    // setup 顯示/隱藏
    const inSetup = (S.phase === "setup");
    setupCard.style.display = inSetup ? "" : "none";

    // seatsHeader 標題提示
    if (S.phase === "deal") {
      seatsHeader.querySelector(".hint")?.replaceChildren(document.createTextNode("點一下選取；再點一次取消選取｜長按 0.3 秒看身分"));
    } else {
      seatsHeader.querySelector(".hint")?.replaceChildren(document.createTextNode("點一下選取；再點一次取消選取"));
    }
  }

  function renderPrompt() {
    if (S.phase === "setup") {
      setText(promptTitle, "開局");
      setText(promptText, "先選人數 → 再選板子（點一下會變色）→ 按底部「下一步」進入抽身分。");
      setText(promptFoot, "（選完後，開局卡會消失，避免佔畫面）");
      return;
    }

    if (S.phase === "deal") {
      setText(promptTitle, "抽身分");
      const thiefNeed = (S.thiefSeatId && !S.thiefChosen)
        ? "⚠️ 盜賊尚未完成選角（盜賊看完身分會立刻二選一）\n\n"
        : "";
      setText(promptText,
        "上帝點選座位（可取消選取） → 玩家長按 0.3 秒看身分 → 按「我看完了」\n" +
        "看完會自動蓋牌（不會露出角色）\n" +
        "全部看完後按「開始夜晚」進入夜晚流程\n\n" +
        thiefNeed
      );
      setText(promptFoot, "");
      return;
    }

    if (S.phase === "night") {
      setText(promptTitle, `夜晚 ${S.night}`);
      setText(promptText,
        "夜晚開始：\n" +
        "1) 守衛請閉眼（選擇守護）\n" +
        "2) 狼人請閉眼（選擇刀人）\n" +
        "3) 預言家請閉眼（查驗一人）\n" +
        "4) 女巫請閉眼（解藥 / 毒藥）\n\n" +
        "👉 依序按「下一步」提示；點座位選取；再點同號取消。"
      );
      setText(promptFoot, "");
      return;
    }

    if (S.phase === "day") {
      setText(promptTitle, `白天 ${S.day}`);
      setText(promptText,
        "天亮了，請宣佈昨夜結果。\n\n" +
        "白天流程：自由發言 →（可上警）→ 推理/辯論 → 投票\n\n" +
        "按「開始投票」進入投票統計。"
      );
      setText(promptFoot, "");
      return;
    }

    setText(promptTitle, "—");
    setText(promptText, "—");
    setText(promptFoot, "");
  }

  // ---------- Render ----------
  function render() {
    renderTop();
    renderBoards();
    renderPrompt();

    // seats 若未初始化：setup 也先初始化一次，避免空白
    if (!Array.isArray(S.seats) || S.seats.length !== S.n) {
      S.seats = buildSeats(S.n);
    }
    renderSeats();

    // settings toggles
    togglePolice.checked = !!S.hasPolice;
    segEdge.classList.toggle("active", S.winMode === "edge");
    segCity.classList.toggle("active", S.winMode === "city");

    saveState();
  }

  // ---------- Buttons / Events ----------
  // setup 人數 chips
  setupCard.querySelectorAll(".chip[data-n]").forEach(btn => {
    btn.addEventListener("click", () => {
      const n = Number(btn.dataset.n);
      if (![9,10,12].includes(n)) return;
      S.n = n;

      // 調整 boardId：找同人數第一個
      const first = BOARDS.find(b => b.n === n);
      if (first) S.boardId = first.id;

      // 重置 seats（但仍在 setup）
      S.seats = buildSeats(S.n);
      S.selectedSeat = null;

      saveState();
      render();
    });
  });

  // Bottom buttons
  btnBack.addEventListener("click", () => {
    if (S.phase === "setup") {
      if (S.step > 1) S.step--;
    } else {
      // 先做保守：只退 step，不跨 phase（避免資料錯亂）
      if (S.step > 1) S.step--;
    }
    saveState();
    render();
  });

  btnNext.addEventListener("click", () => {
    if (S.phase === "setup") {
      // 必須選到板子
      if (!S.boardId) {
        boardHint.textContent = "請先選擇板子（點一下會變色）";
        return;
      }
      startDeal();
      return;
    }

    // 其他 phase：先做 step++（你後面要更細夜晚流程時再擴）
    S.step++;
    saveState();
    render();
  });

  btnMain.addEventListener("click", () => {
    if (S.phase === "deal") {
      if (!allSeen()) return;
      if (S.thiefSeatId && !S.thiefChosen) return;
      enterNight();
      return;
    }
    if (S.phase === "night") {
      // 夜晚 -> 白天
      enterDay();
      return;
    }
    if (S.phase === "day") {
      // 白天 -> 投票（先不展開統計細節，公告用 ann）
      S.phase = "vote";
      S.step = 1;
      saveState();
      render();
      return;
    }
  });

  // Eye god view
  btnEye.addEventListener("click", () => {
    S.godView = !S.godView;
    saveState();
    renderSeats();
  });

  // Dice
  btnDice.addEventListener("click", () => {
    // 從存活座位抽
    const alive = S.seats.filter(s => s.alive).map(s => s.id);
    if (alive.length === 0) return;
    const pick = alive[(Math.random() * alive.length) | 0];
    diceResult.textContent = `${pick} 號`;
    openModal(diceModal);
  });
  btnDiceAgain.addEventListener("click", () => {
    const alive = S.seats.filter(s => s.alive).map(s => s.id);
    if (alive.length === 0) return;
    const pick = alive[(Math.random() * alive.length) | 0];
    diceResult.textContent = `${pick} 號`;
  });
  btnDiceClose.addEventListener("click", () => closeModal(diceModal));

  // Announce drawer (先顯示累積紀錄，後面你要的「白天投票所有票型」可再加)
  btnAnn.addEventListener("click", () => {
    annText.textContent = buildAnnText(toggleAnnGod.checked);
    openDrawer(annBackdrop, annDrawer);
  });
  btnCloseAnn.addEventListener("click", () => closeDrawer(annBackdrop, annDrawer));
  annBackdrop.addEventListener("click", () => closeDrawer(annBackdrop, annDrawer));
  toggleAnnGod.addEventListener("change", () => {
    annText.textContent = buildAnnText(toggleAnnGod.checked);
  });

  function buildAnnText(showGod) {
    if (!S.ann.length) return "（尚無公告）";
    return S.ann.map((a, idx) => {
      const head = `#${idx + 1} ${a.title || ""}`.trim();
      const body = showGod ? (a.textGod || a.textPublic) : a.textPublic;
      return `${head}\n${body}\n`;
    }).join("\n");
  }

  // Timer drawer
  btnTimer.addEventListener("click", () => openDrawer(timerBackdrop, timerDrawer));
  btnCloseTimer.addEventListener("click", () => closeDrawer(timerBackdrop, timerDrawer));
  timerBackdrop.addEventListener("click", () => closeDrawer(timerBackdrop, timerDrawer));

  timerPresets?.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip[data-sec]");
    if (!btn) return;
    const sec = Number(btn.dataset.sec);
    if (!Number.isFinite(sec)) return;
    setTimer(sec);
  });

  btnTimerStart?.addEventListener("click", () => timerStart());
  btnTimerPause?.addEventListener("click", () => timerPause());
  btnTimerReset?.addEventListener("click", () => timerReset());

  let timerTick = null;
  function setTimer(sec) {
    S.timer.sec = Math.max(0, sec | 0);
    S.timer.running = false;
    S.timer.endAt = null;
    saveState();
    renderTimer();
  }
  function timerStart() {
    if (S.timer.running) return;
    const now = Date.now();
    S.timer.running = true;
    S.timer.endAt = now + S.timer.sec * 1000;
    saveState();
    if (timerTick) clearInterval(timerTick);
    timerTick = setInterval(() => {
      if (!S.timer.running || !S.timer.endAt) return;
      const left = Math.max(0, Math.ceil((S.timer.endAt - Date.now()) / 1000));
      timerBig.textContent = fmtTime(left);
      if (left <= 0) {
        S.timer.running = false;
        S.timer.sec = 0;
        S.timer.endAt = null;
        saveState();
        clearInterval(timerTick);
        timerTick = null;
        // 震動（若可用）
        try { navigator.vibrate?.(200); } catch {}
      }
    }, 200);
    renderTimer();
  }
  function timerPause() {
    if (!S.timer.running || !S.timer.endAt) return;
    const left = Math.max(0, Math.ceil((S.timer.endAt - Date.now()) / 1000));
    S.timer.sec = left;
    S.timer.running = false;
    S.timer.endAt = null;
    saveState();
    if (timerTick) { clearInterval(timerTick); timerTick = null; }
    renderTimer();
  }
  function timerReset() {
    S.timer.running = false;
    S.timer.endAt = null;
    // 預設回 90
    S.timer.sec = 90;
    saveState();
    if (timerTick) { clearInterval(timerTick); timerTick = null; }
    renderTimer();
  }
  function renderTimer() {
    const sec = S.timer.running && S.timer.endAt
      ? Math.max(0, Math.ceil((S.timer.endAt - Date.now()) / 1000))
      : (S.timer.sec | 0);
    timerBig.textContent = fmtTime(sec);
  }
  function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  }
  renderTimer();

  // Settings drawer
  btnSettings.addEventListener("click", () => openDrawer(setBackdrop, setDrawer));
  btnCloseSet.addEventListener("click", () => closeDrawer(setBackdrop, setDrawer));
  setBackdrop.addEventListener("click", () => closeDrawer(setBackdrop, setDrawer));

  segEdge.addEventListener("click", () => {
    S.winMode = "edge";
    saveState();
    render();
  });
  segCity.addEventListener("click", () => {
    S.winMode = "city";
    saveState();
    render();
  });
  togglePolice.addEventListener("change", () => {
    S.hasPolice = !!togglePolice.checked;
    saveState();
    render();
  });

  btnGotoSetup.addEventListener("click", () => {
    S = defaultState();
    saveState();
    render();
    closeDrawer(setBackdrop, setDrawer);
  });

  btnHardReset.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    S = defaultState();
    render();
    closeDrawer(setBackdrop, setDrawer);
  });

  // Role modal actions
  btnRoleClose.addEventListener("click", () => closeModal(roleModal));
  btnRoleDone.addEventListener("click", () => {
    const seatId = Number(roleModal.dataset.seatId);
    closeModal(roleModal);
    markSeatSeen(seatId);

    // ✅ 盜賊：看完身分立刻二選一（抽身分階段）
    maybeOpenThiefChoose(seatId);
  });

  // Thief modal close
  btnThiefClose.addEventListener("click", () => closeModal(thiefModal));

  // ---------- 初始化 ----------
  // 如果剛開頁面是 setup，先建立 seats
  if (!Array.isArray(S.seats) || S.seats.length !== S.n) {
    S.seats = buildSeats(S.n);
  }

  // 若目前在 deal，確保 seats 有 roleKey（避免你之前舊資料造成卡住）
  if (S.phase === "deal") {
    const anyRole = S.seats.some(s => s.roleKey);
    if (!anyRole) {
      // 直接退回 setup，避免「卡在抽身分但沒牌」
      S.phase = "setup";
      S.step = 1;
    }
  }

  render();

})();