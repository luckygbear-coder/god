/* ===========================
狼人殺上帝輔助 - app.js（完整覆蓋版）
- mobile first / iOS friendly
- supports: setup boards, identity reveal (long press), flow prompts,
  seats highlight, god info, settings drawer, vote announce formatting,
  timer (strip now + optional drawer later)
=========================== */

(() => {
  "use strict";

  /* ---------- DOM helpers ---------- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);

  const LS_KEY = "wolf_god_helper_state_v1";
  const NOW = () => Date.now();

  /* ---------- Elements ---------- */
  const el = {
    uiStatus: $("#uiStatus"),
    uiBoard: $("#uiBoard"),

    // top icons
    btnDice: $("#btnDice"),
    btnSettings: $("#btnSettings"),
    // optional (if you later add)
    btnHourglass: $("#btnHourglass"), // ⌛️
    btnGodEye: $("#btnGodEye"),       // 👁

    // tabs
    tabFlow: $("#tabFlow"),
    tabSeats: $("#tabSeats"),
    tabGod: $("#tabGod"),
    panelFlow: $("#panelFlow"),
    panelSeats: $("#panelSeats"),
    panelGod: $("#panelGod"),

    // flow UI
    promptTitle: $("#promptTitle"),
    promptText: $("#promptText"),
    promptFoot: $("#promptFoot"),
    toolRow: $("#toolRow"),
    btnVoteDrawer: $("#btnVoteDrawer"),

    // board picker
    boardPickerCard: $("#boardPickerCard"),
    boardPickerHint: $("#boardPickerHint"),
    boardPicker: $("#boardPicker"),

    // seats
    seatsGrid: $("#seatsGrid"),

    // god
    toggleGodView: $("#toggleGodView"),
    godText: $("#godText"),

    // bottom actions
    btnBack: $("#btnBack"),
    btnPrimary: $("#btnPrimary"),
    btnCancel: $("#btnCancel"),

    // drawers
    drawerBackdrop: $("#drawerBackdrop"),
    drawer: $("#drawer"),
    btnCloseDrawer: $("#btnCloseDrawer"),
    segEdge: $("#segEdge"),
    segCity: $("#segCity"),
    togglePolice: $("#togglePolice"),
    btnReset: $("#btnReset"),

    voteDrawerBackdrop: $("#voteDrawerBackdrop"),
    voteDrawer: $("#voteDrawer"),
    btnCloseVoteDrawer: $("#btnCloseVoteDrawer"),
    voteAnnounceText: $("#voteAnnounceText"),

    // modals
    roleModal: $("#roleModal"),
    roleModalTitle: $("#roleModalTitle"),
    roleModalRole: $("#roleModalRole"),
    roleModalCamp: $("#roleModalCamp"),
    btnRoleDone: $("#btnRoleDone"),
    btnRoleClose: $("#btnRoleClose"),

    diceModal: $("#diceModal"),
    diceResult: $("#diceResult"),
    btnDiceAgain: $("#btnDiceAgain"),
    btnDiceClose: $("#btnDiceClose"),

    // timer strip (current index)
    timerBig: $("#timerBig"),
    timerPresets: $("#timerPresets"),
    btnTimerStart: $("#btnTimerStart"),
    btnTimerPause: $("#btnTimerPause"),
    btnTimerReset: $("#btnTimerReset"),
  };

  /* ---------- iOS Safari: prevent zoom / selection annoyance ---------- */
  // NOTE: you already set maximum-scale=1,user-scalable=no in index viewport.
  // Here only prevents double tap highlight.
  let lastTouchEnd = 0;
  on(document, "touchend", (e) => {
    const now = NOW();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });

  /* ---------- Data: boards fallback ---------- */
  // You already have boards/official-9/10/12.json on GitHub.
  // If fetch fails, fallback is used.
  const BOARD_FALLBACK = {
    "official-9": {
      id: "official-9",
      name: "9 人官方標準局",
      tags: ["官方", "穩"],
      players: 9,
      roles: [
        "狼人","狼人","狼人",
        "預言家","女巫","獵人",
        "村民","村民","村民"
      ]
    },
    "official-10": {
      id: "official-10",
      name: "10 人官方標準局",
      tags: ["官方", "穩"],
      players: 10,
      roles: [
        "狼人","狼人","狼人",
        "預言家","女巫","獵人","守衛",
        "村民","村民","村民"
      ]
    },
    "official-12": {
      id: "official-12",
      name: "12 人官方標準局",
      tags: ["官方", "穩", "含白癡"],
      players: 12,
      roles: [
        "狼人","狼人","狼人","狼人",
        "預言家","女巫","獵人","守衛","白癡",
        "村民","村民","村民"
      ]
    }
  };

  const ROLE_META = {
    "狼人": { camp: "wolf", campZh: "狼人陣營", type: "wolf" },
    "預言家": { camp: "good", campZh: "好人陣營", type: "god" },
    "女巫": { camp: "good", campZh: "好人陣營", type: "god" },
    "獵人": { camp: "good", campZh: "好人陣營", type: "god" },
    "守衛": { camp: "good", campZh: "好人陣營", type: "god" },
    "白癡": { camp: "good", campZh: "好人陣營", type: "god" },
    "村民": { camp: "good", campZh: "好人陣營", type: "villager" }
  };

  /* ---------- State ---------- */
  const defaultState = () => ({
    version: 1,
    stage: "SETUP_A1",      // SETUP_A1 -> SETUP_A2 -> SETUP_A3 -> NIGHT -> DAY -> VOTE...
    round: 1,               // night/day counter
    day: 0,                 // day count
    players: 12,            // 9/10/12
    boardId: "official-12",
    boardName: "—",
    boardTags: [],
    roles: [],              // role list length n (from board)
    seats: [],              // [{no, alive, role, camp, revealed, notes, voteTarget, marks:{night/day/vote}}]
    hasPolice: true,
    winMode: "edge",        // edge/city
    policeSeat: 0,

    // identity reveal
    revealDoneCount: 0,

    // night actions
    knifeTarget: 0,
    guardTarget: 0,
    witchSaveUsed: false,
    witchPoisonUsed: false,
    witchChoice: null,      // {type:"save"/"poison", target}
    seerResult: null,       // {target, campZh}

    // voting
    voting: {
      open: false,
      currentVoter: 0,
      votes: {}             // voterNo -> targetNo(1..n) or 0 for abstain
    },

    // death log
    lastDeaths: [],         // array of seatNos died last resolution
    announce: "",

    // timer
    timer: {
      presetSec: 90,
      secLeft: 90,
      running: false,
      lastTick: 0
    }
  });

  let S = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return initNewGame(defaultState());
      const parsed = JSON.parse(raw);
      // minimal migrate
      const merged = Object.assign(defaultState(), parsed);
      if (!Array.isArray(merged.seats) || merged.seats.length === 0) {
        return initNewGame(merged);
      }
      return merged;
    } catch (e) {
      return initNewGame(defaultState());
    }
  }

  function saveState() {
    localStorage.setItem(LS_KEY, JSON.stringify(S));
  }

  function initNewGame(state) {
    const n = state.players || 12;
    state.seats = Array.from({ length: n }, (_, i) => ({
      no: i + 1,
      alive: true,
      role: "",
      camp: "",
      campZh: "",
      type: "",
      revealed: false,
      revealDone: false,
      notes: "",
      voteTarget: null,
      marks: { night: false, day: false, vote: false }
    }));
    state.revealDoneCount = 0;
    state.knifeTarget = 0;
    state.guardTarget = 0;
    state.witchChoice = null;
    state.seerResult = null;
    state.voting = { open: false, currentVoter: 0, votes: {} };
    state.lastDeaths = [];
    state.announce = "";
    state.timer = { presetSec: 90, secLeft: 90, running: false, lastTick: 0 };
    return state;
  }

  /* ---------- UI: tabs ---------- */
  function setTab(name) {
    const map = {
      flow: [el.tabFlow, el.panelFlow],
      seats: [el.tabSeats, el.panelSeats],
      god: [el.tabGod, el.panelGod],
    };
    Object.entries(map).forEach(([k, [btn, panel]]) => {
      if (!btn || !panel) return;
      btn.classList.toggle("active", k === name);
      panel.classList.toggle("active", k === name);
    });
  }

  /* ---------- Drawer helpers ---------- */
  function openDrawer(drawerEl, backdropEl) {
    if (!drawerEl || !backdropEl) return;
    backdropEl.classList.remove("hidden");
    drawerEl.classList.remove("hidden");
    drawerEl.setAttribute("aria-hidden", "false");
  }
  function closeDrawer(drawerEl, backdropEl) {
    if (!drawerEl || !backdropEl) return;
    backdropEl.classList.add("hidden");
    drawerEl.classList.add("hidden");
    drawerEl.setAttribute("aria-hidden", "true");
  }

  function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove("hidden");
    modalEl.setAttribute("aria-hidden", "false");
  }
  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add("hidden");
    modalEl.setAttribute("aria-hidden", "true");
  }

  /* ---------- Timer ---------- */
  let timerRAF = null;

  function fmtTime(sec) {
    sec = Math.max(0, sec | 0);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function timerSyncUI() {
    if (el.timerBig) el.timerBig.textContent = fmtTime(S.timer.secLeft);
  }

  function timerTick() {
    if (!S.timer.running) return;
    const now = NOW();
    if (!S.timer.lastTick) S.timer.lastTick = now;
    const dt = Math.floor((now - S.timer.lastTick) / 1000);
    if (dt > 0) {
      S.timer.secLeft = Math.max(0, S.timer.secLeft - dt);
      S.timer.lastTick += dt * 1000;
      timerSyncUI();
      saveState();
      if (S.timer.secLeft === 0) {
        S.timer.running = false;
        saveState();
        // vibrate if available
        try { navigator.vibrate && navigator.vibrate([120, 60, 120]); } catch {}
      }
    }
    timerRAF = requestAnimationFrame(timerTick);
  }

  function timerStart() {
    if (S.timer.secLeft <= 0) S.timer.secLeft = S.timer.presetSec;
    S.timer.running = true;
    S.timer.lastTick = NOW();
    saveState();
    timerSyncUI();
    if (!timerRAF) timerRAF = requestAnimationFrame(timerTick);
  }

  function timerPause() {
    S.timer.running = false;
    S.timer.lastTick = 0;
    saveState();
    timerSyncUI();
  }

  function timerReset() {
    S.timer.running = false;
    S.timer.lastTick = 0;
    S.timer.secLeft = S.timer.presetSec;
    saveState();
    timerSyncUI();
  }

  function timerSetPreset(sec) {
    sec = Number(sec) || 90;
    S.timer.presetSec = sec;
    S.timer.secLeft = sec;
    S.timer.running = false;
    S.timer.lastTick = 0;
    saveState();
    timerSyncUI();
  }

  /* ---------- Board loading / render ---------- */
  async function loadBoardsForPlayers(n) {
    const list = [];

    // 1) Try fetch official json
    const candidates = [
      `./boards/official-${n}.json`,
      `./boards/official-${n}/board.json`,
      `./boards/official-${n}.json?ts=${Date.now()}`
    ];

    let fetched = null;
    for (const url of candidates) {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) continue;
        fetched = await r.json();
        break;
      } catch {}
    }

    if (fetched && fetched.id) {
      // normalize single board
      list.push({
        id: fetched.id,
        name: fetched.name || fetched.id,
        tags: fetched.tags || [],
        players: fetched.players || n,
        roles: fetched.roles || []
      });
    } else {
      // fallback: show official + any matching fallback variants if you added later
      const key = `official-${n}`;
      if (BOARD_FALLBACK[key]) list.push(BOARD_FALLBACK[key]);
    }

    // add fallback variants if you create them later (safe)
    Object.values(BOARD_FALLBACK).forEach(b => {
      if (b.players === n && !list.find(x => x.id === b.id)) list.push(b);
    });

    return list;
  }

  function renderBoardPicker(boards) {
    if (!el.boardPicker) return;
    el.boardPicker.innerHTML = "";

    boards.forEach((b) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "boardBtn";
      if (S.boardId === b.id) btn.classList.add("active");

      const title = document.createElement("div");
      title.className = "name";
      title.textContent = b.name || b.id;

      const sub = document.createElement("div");
      sub.className = "sub";
      sub.textContent = b.id;

      const tags = document.createElement("div");
      tags.className = "tags";
      (b.tags || []).forEach(t => {
        const sp = document.createElement("span");
        sp.className = "badge";
        sp.textContent = t;
        tags.appendChild(sp);
      });

      btn.appendChild(title);
      btn.appendChild(sub);
      if (tags.childNodes.length) btn.appendChild(tags);

      on(btn, "click", () => {
        S.boardId = b.id;
        S.boardName = b.name || b.id;
        S.boardTags = b.tags || [];
        S.roles = Array.isArray(b.roles) ? b.roles.slice() : [];
        // mark selected
        $$(".boardBtn").forEach(x => x.classList.remove("active"));
        btn.classList.add("active");
        saveState();
        syncTop();
        syncGodText();
        setPrompt("SETUP_A2");
      });

      el.boardPicker.appendChild(btn);
    });
  }

  /* ---------- Seats ---------- */
  function seatByNo(no) {
    return S.seats.find(s => s.no === no);
  }

  function aliveSeats() {
    return S.seats.filter(s => s.alive);
  }

  function renderSeats() {
    if (!el.seatsGrid) return;
    el.seatsGrid.innerHTML = "";

    S.seats.forEach((s) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seatBtn";
      b.dataset.no = String(s.no);

      if (!s.alive) b.classList.add("dead");
      if (S.voting.currentVoter === s.no) b.classList.add("selected");
      if (s.marks.night) b.classList.add("mark-night");
      if (s.marks.day) b.classList.add("mark-day");
      if (s.marks.vote) b.classList.add("mark-vote");

      const no = document.createElement("div");
      no.className = "no";
      no.textContent = `${s.no}號`;

      const st = document.createElement("div");
      st.className = "st";
      st.textContent = s.alive ? "存活" : "死亡";

      b.appendChild(no);
      b.appendChild(st);

      // click behavior depends on stage
      on(b, "click", () => onSeatTap(s.no));

      // long press to reveal identity in SETUP_A3
      attachLongPress(b, s.no);

      el.seatsGrid.appendChild(b);
    });
  }

  function clearMarks() {
    S.seats.forEach(s => s.marks = { night:false, day:false, vote:false });
  }

  function attachLongPress(btn, seatNo) {
    let t = null;
    let moved = false;

    const start = (e) => {
      if (S.stage !== "SETUP_A3") return;
      moved = false;
      t = setTimeout(() => {
        if (!moved) revealSeatRole(seatNo);
      }, 300); // ✅ 0.3 秒
    };
    const cancel = () => {
      if (t) clearTimeout(t);
      t = null;
    };

    on(btn, "touchstart", start, { passive: true });
    on(btn, "touchmove", () => { moved = true; cancel(); }, { passive: true });
    on(btn, "touchend", cancel, { passive: true });
    on(btn, "touchcancel", cancel, { passive: true });

    // mouse
    on(btn, "mousedown", start);
    on(btn, "mousemove", () => { moved = true; cancel(); });
    on(btn, "mouseup", cancel);
    on(btn, "mouseleave", cancel);
  }

  function revealSeatRole(seatNo) {
    const s = seatByNo(seatNo);
    if (!s || !s.role) return;

    s.revealed = true;

    el.roleModalTitle.textContent = `${seatNo}號 身分`;
    el.roleModalRole.textContent = `角色：${s.role}`;
    el.roleModalCamp.textContent = `陣營：${s.campZh}`;

    openModal(el.roleModal);
    saveState();
    renderSeats();
  }

  function markRevealDone(seatNo) {
    const s = seatByNo(seatNo);
    if (!s) return;
    if (!s.revealDone) {
      s.revealDone = true;
      S.revealDoneCount = S.seats.filter(x => x.revealDone).length;
    }
    saveState();
    syncGodText();
  }

  /* ---------- Role assignment ---------- */
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function assignRolesFromBoard() {
    const n = S.players;
    let roles = (S.roles && S.roles.length === n) ? S.roles.slice() : null;

    if (!roles) {
      // fallback by boardId
      const fb = BOARD_FALLBACK[S.boardId] || BOARD_FALLBACK[`official-${n}`];
      roles = (fb && fb.roles && fb.roles.length === n) ? fb.roles.slice() : [];
    }

    if (roles.length !== n) {
      // last fallback
      roles = Array.from({ length: n }, (_, i) => (i < Math.floor(n/3) ? "狼人" : "村民"));
    }

    shuffle(roles);

    S.seats.forEach((s, idx) => {
      const r = roles[idx];
      const meta = ROLE_META[r] || { camp:"good", campZh:"好人陣營", type:"villager" };
      s.role = r;
      s.camp = meta.camp;
      s.campZh = meta.campZh;
      s.type = meta.type;
      s.revealed = false;
      s.revealDone = false;
      s.alive = true;
      s.voteTarget = null;
      s.marks = { night:false, day:false, vote:false };
    });

    S.revealDoneCount = 0;

    // reset resources
    S.witchSaveUsed = false;
    S.witchPoisonUsed = false;

    saveState();
    renderSeats();
    syncGodText();
  }

  /* ---------- Dice ---------- */
  function rollDicePickSpeaker() {
    const alive = aliveSeats().map(s => s.no);
    if (!alive.length) return "—";
    const pick = alive[Math.floor(Math.random() * alive.length)];
    return `${pick}號`;
  }

  /* ---------- Win check ---------- */
  function countAlive() {
    const wolves = S.seats.filter(s => s.alive && s.camp === "wolf").length;
    const gods = S.seats.filter(s => s.alive && s.type === "god").length;
    const villagers = S.seats.filter(s => s.alive && s.type === "villager").length;
    const good = gods + villagers;
    return { wolves, gods, villagers, good };
  }

  function checkWin() {
    const { wolves, good, gods, villagers } = countAlive();

    // good win priority: wolves all dead
    if (wolves === 0) return { end: true, winner: "好人勝利（狼人全滅）" };

    if (S.winMode === "city") {
      // 屠城：狼數 >= 好人數
      if (wolves >= good) return { end: true, winner: "狼人勝利（狼數 ≥ 好人數）" };
      return { end: false };
    } else {
      // 屠邊：神全死 or 民全死 -> 狼勝
      if (gods === 0) return { end: true, winner: "狼人勝利（神全滅・屠邊）" };
      if (villagers === 0) return { end: true, winner: "狼人勝利（民全滅・屠邊）" };
      return { end: false };
    }
  }

  /* ---------- Flow / prompts ---------- */
  function syncTop() {
    if (el.uiStatus) el.uiStatus.textContent = stageLabel();
    if (el.uiBoard) el.uiBoard.textContent = S.boardName && S.boardName !== "—" ? S.boardName : `${S.players} 人（未選板子）`;
  }

  function stageLabel() {
    // compact like screenshot: SETUP / R1 / SETUP:A2
    const r = S.round || 1;
    if (S.stage.startsWith("SETUP")) return `SETUP / R${r} / ${S.stage.replace("_", ":")}`;
    if (S.stage.startsWith("NIGHT")) return `NIGHT / R${r} / ${S.stage}`;
    if (S.stage.startsWith("DAY")) return `DAY / R${r} / ${S.stage}`;
    return `R${r} / ${S.stage}`;
  }

  function setPrompt(stage) {
    // stage-specific instructions
    S.stage = stage;

    // show/hide board picker card
    if (el.boardPickerCard) {
      el.boardPickerCard.classList.toggle("hidden", !(stage === "SETUP_A1" || stage === "SETUP_A2"));
    }

    // vote drawer button visibility
    if (el.btnVoteDrawer) {
      const show = stage === "DAY_VOTE" || stage === "DAY_EXILE_DONE";
      el.btnVoteDrawer.classList.toggle("hidden", !show);
    }

    // update text
    let title = "—";
    let text = "—";
    let foot = "";

    const n = S.players;

    if (stage === "SETUP_A1") {
      title = "開始設定";
      text =
`請選擇人數（9 / 10 / 12）。
接著到下方「可選板子」點選套用。

提示：
• 勝負可在設定切換：屠邊 / 屠城
• 上警可在設定開關`;
      foot = `目前人數：${n} 人`;
      ensurePlayerCountChips();
      refreshBoardPicker();
    }

    if (stage === "SETUP_A2") {
      title = "可選板子";
      text =
`請在下方「可選板子」點一下套用板子。
套用後按「下一步」進入抽身分。`;
      foot = `已選板子：${S.boardId || "—"}`;
      ensurePlayerCountChips();
      refreshBoardPicker();
    }

    if (stage === "SETUP_A3") {
      title = "抽身分（長按 0.3 秒翻牌）";
      text =
`請玩家依序長按自己的座位（0.3 秒）查看身分。
看完按「我看完了」回到上帝。

全部看完後才能進入夜晚。`;
      foot = `已看完：${S.revealDoneCount}/${S.players}`;
      clearMarks();
    }

    if (stage === "NIGHT_START") {
      title = `夜晚 ${S.round}`;
      text =
`夜晚開始。
依序進行：
1) 狼人刀人（點座位）
2) 守衛守人（點座位，守衛死後不可再守）
3) 女巫（同晚解藥/毒藥只能擇一）
4) 預言家查驗（點座位，結果顯示在提示）`;
      foot = `請按「下一步」開始狼人行動。`;
      clearMarks();
    }

    if (stage === "NIGHT_WOLVES") {
      title = "狼人請睜眼・選擇刀口";
      text = `請點選座位作為刀口。`;
      foot = S.knifeTarget ? `目前刀口：${S.knifeTarget}號` : "尚未選擇刀口";
      markSelectableAlive("night", true);
    }

    if (stage === "NIGHT_GUARD") {
      title = "守衛請睜眼・選擇守護";
      const guard = findAliveRole("守衛");
      if (!guard) {
        text = `（本局無守衛或守衛已死亡）\n請按「下一步」進入女巫。`;
        foot = "";
      } else {
        text = `請點選要守護的座位。`;
        foot = S.guardTarget ? `目前守護：${S.guardTarget}號` : "尚未選擇守護";
        markSelectableAlive("night", true);
      }
    }

    if (stage === "NIGHT_WITCH") {
      title = "女巫請睜眼";
      const witch = findAliveRole("女巫");
      if (!witch) {
        text = `（女巫已死亡或本局無女巫）\n請按「下一步」進入預言家。`;
        foot = "";
      } else {
        const saveAvail = !S.witchSaveUsed;
        const poisonAvail = !S.witchPoisonUsed;
        const knife = S.knifeTarget ? `${S.knifeTarget}號` : "（無）";
        text =
`今晚刀口：${knife}

操作方式（不跳視窗，直接點座位）：
• 點「刀口」= 救（解藥未用時）
• 點「其他人」= 毒（毒藥未用時）
• 再點一次可取消

規則：
• 同一晚解藥/毒藥只能擇一`;
        foot =
`解藥：${saveAvail ? "可用" : "已用"} / 毒藥：${poisonAvail ? "可用" : "已用"}`
+ (S.witchChoice ? `\n女巫已選：${S.witchChoice.type === "save" ? "救" : "毒"} ${S.witchChoice.target}號` : "");
        markSelectableAlive("night", true);
      }
    }

    if (stage === "NIGHT_SEER") {
      title = "預言家請睜眼・查驗";
      const seer = findAliveRole("預言家");
      if (!seer) {
        text = `（預言家已死亡或本局無預言家）\n請按「下一步」結算夜晚。`;
        foot = "";
      } else {
        text =
`請點選要查驗的座位。
查驗結果會顯示在下方提示（供上帝口頭宣告）。`;
        foot = S.seerResult ? `查驗：${S.seerResult.target}號 → ${S.seerResult.campZh}` : "尚未查驗";
        markSelectableAlive("night", true);
      }
    }

    if (stage === "NIGHT_RESOLVE") {
      title = "結算夜晚";
      const deaths = resolveNight();
      text = deaths.length
        ? `今晚死亡：${deaths.join("、")}號`
        : `平安夜（無人死亡）`;
      foot = `請按「下一步」進入白天。`;
      clearMarks();
    }

    if (stage === "DAY_START") {
      title = `白天 ${S.round}`;
      const deaths = S.lastDeaths || [];
      text = deaths.length
        ? `天亮了。\n昨夜死亡：${deaths.join("、")}號`
        : `天亮了。\n昨夜平安（無人死亡）`;
      foot = `請按「下一步」進入投票。`;
      clearMarks();
    }

    if (stage === "DAY_VOTE") {
      title = "投票（清楚誰投給誰）";
      text =
`操作方式：
1) 先點「投票人」
2) 再點「投票目標」
3) 若要棄票：先選投票人，再點一次投票人 = 棄票

你也可以點「投票公告」查看目前統計。`;
      foot = S.voting.currentVoter ? `目前投票人：${S.voting.currentVoter}號` : "請先選擇投票人";
      clearMarks();
      markSelectableAlive("vote", true);
      S.voting.open = true;
    }

    if (stage === "DAY_EXILE_DONE") {
      title = "投票結果";
      const summary = buildVoteAnnounce(true);
      text = summary.mainText;
      foot = summary.foot || "按「下一步」進入下一晚（或顯示結局）";
      clearMarks();
      S.voting.open = false;
    }

    // apply to UI
    if (el.promptTitle) el.promptTitle.textContent = title;
    if (el.promptText) el.promptText.textContent = text;
    if (el.promptFoot) el.promptFoot.textContent = foot;

    syncTop();
    syncGodText();
    renderSeats();
    saveState();
  }

  function ensurePlayerCountChips() {
    // Show small chips in boardPickerHint for 9/10/12 quick change
    if (!el.boardPickerHint) return;
    el.boardPickerHint.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.gap = "10px";
    wrap.style.flexWrap = "wrap";
    wrap.style.marginTop = "8px";

    [9,10,12].forEach(n => {
      const c = document.createElement("button");
      c.type = "button";
      c.className = "chip";
      c.textContent = `${n}人`;
      if (S.players === n) c.classList.add("primary");
      on(c, "click", async () => {
        S.players = n;
        S.boardId = `official-${n}`;
        S.boardName = "—";
        S.roles = [];
        S = initNewGame(S);
        saveState();
        syncTop();
        syncGodText();
        renderSeats();
        // rerender chips + boards
        setPrompt("SETUP_A1");
      });
      wrap.appendChild(c);
    });

    const tips = document.createElement("div");
    tips.className = "hint";
    tips.style.marginTop = "8px";
    tips.textContent = "點一下切換人數，然後在下方選板子套用。";

    el.boardPickerHint.appendChild(wrap);
    el.boardPickerHint.appendChild(tips);
  }

  async function refreshBoardPicker() {
    const boards = await loadBoardsForPlayers(S.players);
    renderBoardPicker(boards);
  }

  function findAliveRole(roleName) {
    return S.seats.find(s => s.alive && s.role === roleName);
  }

  function markSelectableAlive(kind, onOff) {
    // highlight availability via outline class (css uses mark-night/day/vote)
    S.seats.forEach(s => {
      if (!s.alive) {
        s.marks[kind] = false;
      } else {
        s.marks[kind] = !!onOff;
      }
    });
  }

  /* ---------- Seat tap behavior by stage ---------- */
  function onSeatTap(no) {
    const s = seatByNo(no);
    if (!s) return;

    // SETUP_A3: tap -> allow re-open role modal if already revealed
    if (S.stage === "SETUP_A3") {
      if (s.role) {
        revealSeatRole(no);
      }
      return;
    }

    if (S.stage === "NIGHT_WOLVES") {
      if (!s.alive) return;
      S.knifeTarget = no;
      setPrompt("NIGHT_WOLVES");
      return;
    }

    if (S.stage === "NIGHT_GUARD") {
      const guard = findAliveRole("守衛");
      if (!guard) return;
      if (!s.alive) return;
      S.guardTarget = no;
      setPrompt("NIGHT_GUARD");
      return;
    }

    if (S.stage === "NIGHT_WITCH") {
      const witch = findAliveRole("女巫");
      if (!witch) return;
      if (!s.alive) return;

      // cancel if tap same target again
      if (S.witchChoice && S.witchChoice.target === no) {
        S.witchChoice = null;
        setPrompt("NIGHT_WITCH");
        return;
      }

      // decide save/poison
      const isKnife = S.knifeTarget && no === S.knifeTarget;

      if (isKnife) {
        if (S.witchSaveUsed) {
          // cannot
          flashFoot("解藥已用");
          return;
        }
        // choose save (and clear poison)
        S.witchChoice = { type: "save", target: no };
        setPrompt("NIGHT_WITCH");
        return;
      } else {
        if (S.witchPoisonUsed) {
          flashFoot("毒藥已用");
          return;
        }
        S.witchChoice = { type: "poison", target: no };
        setPrompt("NIGHT_WITCH");
        return;
      }
    }

    if (S.stage === "NIGHT_SEER") {
      const seer = findAliveRole("預言家");
      if (!seer) return;
      if (!s.alive) return;
      const campZh = s.camp === "wolf" ? "狼人" : "好人";
      S.seerResult = { target: no, campZh };
      setPrompt("NIGHT_SEER");
      return;
    }

    if (S.stage === "DAY_VOTE") {
      if (!s.alive) return;
      handleVoteTap(no);
      return;
    }

    // default: just select highlight (for clarity)
    S.voting.currentVoter = no;
    renderSeats();
  }

  function flashFoot(msg) {
    if (!el.promptFoot) return;
    const old = el.promptFoot.textContent;
    el.promptFoot.textContent = msg;
    setTimeout(() => {
      el.promptFoot.textContent = old;
    }, 900);
  }

  /* ---------- Voting ---------- */
  function handleVoteTap(no) {
    const alive = seatByNo(no)?.alive;
    if (!alive) return;

    // 1) choose voter first
    if (!S.voting.currentVoter) {
      S.voting.currentVoter = no;
      renderSeats();
      setPrompt("DAY_VOTE");
      return;
    }

    const voterNo = S.voting.currentVoter;

    // tap same voter again => abstain
    if (voterNo === no) {
      S.voting.votes[String(voterNo)] = 0;
      S.voting.currentVoter = 0;
      saveState();
      renderSeats();
      setPrompt("DAY_VOTE");
      return;
    }

    // set vote target
    S.voting.votes[String(voterNo)] = no;
    S.voting.currentVoter = 0;

    saveState();
    renderSeats();
    setPrompt("DAY_VOTE");
  }

  function buildVoteAnnounce(finalize = false) {
    // group: target -> [voters]
    const votes = S.voting.votes || {};
    const n = S.players;

    const groups = new Map(); // target->voters
    const abstain = [];

    // only alive voters count
    S.seats.forEach(s => {
      if (!s.alive) return;
      const v = votes[String(s.no)];
      if (v === 0) abstain.push(s.no);
      else if (typeof v === "number" && v >= 1 && v <= n) {
        if (!groups.has(v)) groups.set(v, []);
        groups.get(v).push(s.no);
      }
    });

    // sort output by target number asc
    const lines = [];
    const targets = Array.from(groups.keys()).sort((a,b)=>a-b);

    targets.forEach(t => {
      const voters = groups.get(t).slice().sort((a,b)=>a-b);
      lines.push(`投給${t}號的有${voters.length ? " " + voters.join("、") : "（無）"}`);
    });

    if (abstain.length) {
      abstain.sort((a,b)=>a-b);
      lines.push(`棄票的有 ${abstain.join("、")}`);
    }

    // determine highest
    let max = 0;
    let winners = [];
    targets.forEach(t => {
      const c = groups.get(t).length;
      if (c > max) { max = c; winners = [t]; }
      else if (c === max && c > 0) winners.push(t);
    });

    let foot = "";
    let exile = 0;

    if (max === 0) {
      foot = "目前無有效票（全棄票或尚未投票）";
    } else if (winners.length === 1) {
      exile = winners[0];
      foot = `${exile}號得到最高票（${max}票）遭到放逐`;
    } else {
      foot = `平票：${winners.join("、")}號（各 ${max} 票）→ 請處理平票規則（再投/警長歸票等）`;
    }

    const mainText = lines.length ? lines.join("\n") : "（尚未投票）";
    const out = { mainText, foot, exile, max, tie: winners.length > 1 };

    if (finalize && exile && !out.tie) {
      // apply exile
      killSeat(exile, "exile");
    }

    return out;
  }

  function killSeat(no, reason) {
    const s = seatByNo(no);
    if (!s || !s.alive) return;
    s.alive = false;

    // hunter shot when exiled
    if (reason === "exile" && s.role === "獵人") {
      // ask shoot
      const shoot = confirm("獵人被放逐，要開槍嗎？（OK=開槍 / Cancel=不開）");
      if (shoot) {
        const target = prompt("請輸入要開槍的號碼（1~" + S.players + "）", "");
        const t = Number(target);
        if (t >= 1 && t <= S.players && seatByNo(t)?.alive) {
          seatByNo(t).alive = false;
          S.lastDeaths = [no, t];
        } else {
          S.lastDeaths = [no];
        }
      } else {
        S.lastDeaths = [no];
      }
    } else {
      S.lastDeaths = [no];
    }

    saveState();
    renderSeats();
    syncGodText();
  }

  /* ---------- Night resolve ---------- */
  function resolveNight() {
    // compute deaths
    const deaths = new Set();

    // guard blocks knife if same target
    let knife = S.knifeTarget || 0;
    const guard = S.guardTarget || 0;

    if (knife && guard && knife === guard) {
      knife = 0; // guarded
    }

    // witch choice
    if (S.witchChoice) {
      if (S.witchChoice.type === "save") {
        // save cancels knife if same target
        if (knife === S.witchChoice.target) knife = 0;
        S.witchSaveUsed = true;
      } else if (S.witchChoice.type === "poison") {
        deaths.add(S.witchChoice.target);
        S.witchPoisonUsed = true;
      }
    }

    // final knife
    if (knife) deaths.add(knife);

    // apply deaths
    const list = Array.from(deaths).filter(no => seatByNo(no)?.alive);
    list.forEach(no => {
      seatByNo(no).alive = false;
    });

    S.lastDeaths = list;

    // reset night selections
    S.knifeTarget = 0;
    S.guardTarget = 0;
    S.witchChoice = null;
    S.seerResult = null;

    saveState();
    renderSeats();
    syncGodText();

    // check win
    const w = checkWin();
    if (w.end) {
      // jump to end prompt
      S.stage = "GAME_END";
      if (el.promptTitle) el.promptTitle.textContent = "遊戲結束";
      if (el.promptText) el.promptText.textContent = w.winner;
      if (el.promptFoot) el.promptFoot.textContent = "可到設定重置本局";
      saveState();
      return list;
    }

    return list;
  }

  /* ---------- God info ---------- */
  function syncGodText() {
    if (!el.godText) return;

    const n = S.players;
    const { wolves, good, gods, villagers } = countAlive();

    const boardLine = `板子：${S.boardId || "—"}`;
    const winLine = `勝負：${S.winMode === "edge" ? "屠邊（可切換）" : "屠城（可切換）"}`;
    const policeLine = `上警：${S.hasPolice ? "開" : "關"}`;

    const assignLine = `抽身分：${S.seats.some(s => s.role) ? "已分配" : "尚未分配"}`;
    const unseen = S.seats.filter(s => s.role && !s.revealDone).map(s => s.no);
    const unseenLine = `未查看：${unseen.length ? unseen.join("、") : "（無）"}`;

    const witch = findAliveRole("女巫");
    const witchLine = witch
      ? `女巫：解藥${S.witchSaveUsed ? "已用" : "可用"} / 毒藥${S.witchPoisonUsed ? "已用" : "可用"}`
      : `女巫：不在場或已死亡`;

    const hunter = findAliveRole("獵人");
    const hunterLine = hunter ? `獵人：子彈可用（需上帝判斷）` : `獵人：不在場或已死亡`;

    const guard = findAliveRole("守衛");
    const guardLine = guard ? `守衛：存活` : `守衛：已死亡或不在場`;

    const liveLine = `存活：狼 ${wolves} / 好 ${good}（神 ${gods} + 民 ${villagers}）`;

    el.godText.textContent =
`人數：${n}
${boardLine}
${winLine}
${policeLine}
${assignLine}
${unseenLine}

${witchLine}
${hunterLine}
${guardLine}

${liveLine}`;
  }

  /* ---------- Settings ---------- */
  function syncSettingsUI() {
    if (el.segEdge) el.segEdge.classList.toggle("active", S.winMode === "edge");
    if (el.segCity) el.segCity.classList.toggle("active", S.winMode === "city");
    if (el.togglePolice) el.togglePolice.checked = !!S.hasPolice;
  }

  /* ---------- Navigation (Back/Next/Cancel) ---------- */
  function goNext() {
    // handle stage transitions
    const st = S.stage;

    if (st === "SETUP_A1") {
      setPrompt("SETUP_A2");
      return;
    }
    if (st === "SETUP_A2") {
      // must have board roles
      assignRolesFromBoard();
      setPrompt("SETUP_A3");
      return;
    }
    if (st === "SETUP_A3") {
      const allDone = S.seats.every(s => s.revealDone);
      if (!allDone) {
        flashFoot(`還有未看完：${S.seats.filter(x=>!x.revealDone).map(x=>x.no).join("、")}號`);
        return;
      }
      setPrompt("NIGHT_START");
      return;
    }

    if (st === "NIGHT_START") { setPrompt("NIGHT_WOLVES"); return; }
    if (st === "NIGHT_WOLVES") { setPrompt("NIGHT_GUARD"); return; }
    if (st === "NIGHT_GUARD") { setPrompt("NIGHT_WITCH"); return; }
    if (st === "NIGHT_WITCH") { setPrompt("NIGHT_SEER"); return; }
    if (st === "NIGHT_SEER") { setPrompt("NIGHT_RESOLVE"); return; }
    if (st === "NIGHT_RESOLVE") { setPrompt("DAY_START"); return; }
    if (st === "DAY_START") {
      // prepare vote
      S.voting = { open: true, currentVoter: 0, votes: {} };
      saveState();
      setPrompt("DAY_VOTE");
      return;
    }
    if (st === "DAY_VOTE") {
      // finalize vote (build result + apply exile if no tie)
      const res = buildVoteAnnounce(true);
      // if tie or no votes, just show result without auto kill
      if (res.tie || res.max === 0) {
        setPrompt("DAY_EXILE_DONE");
        return;
      }

      // after exile check win
      const w = checkWin();
      if (w.end) {
        S.stage = "GAME_END";
        if (el.promptTitle) el.promptTitle.textContent = "遊戲結束";
        if (el.promptText) el.promptText.textContent = w.winner;
        if (el.promptFoot) el.promptFoot.textContent = "可到設定重置本局";
        saveState();
        return;
      }

      setPrompt("DAY_EXILE_DONE");
      return;
    }
    if (st === "DAY_EXILE_DONE") {
      // go to next night
      S.round += 1;
      saveState();
      setPrompt("NIGHT_START");
      return;
    }

    if (st === "GAME_END") {
      flashFoot("已結束，請到設定重置本局");
      return;
    }

    // fallback
    setPrompt("SETUP_A1");
  }

  function goBack() {
    const st = S.stage;
    const order = [
      "SETUP_A1","SETUP_A2","SETUP_A3",
      "NIGHT_START","NIGHT_WOLVES","NIGHT_GUARD","NIGHT_WITCH","NIGHT_SEER","NIGHT_RESOLVE",
      "DAY_START","DAY_VOTE","DAY_EXILE_DONE"
    ];
    const idx = order.indexOf(st);
    if (idx > 0) setPrompt(order[idx - 1]);
  }

  function doCancel() {
    const st = S.stage;

    // cancel vote: clear current voter
    if (st === "DAY_VOTE") {
      S.voting.currentVoter = 0;
      saveState();
      renderSeats();
      setPrompt("DAY_VOTE");
      return;
    }

    // cancel witch choice
    if (st === "NIGHT_WITCH") {
      S.witchChoice = null;
      saveState();
      setPrompt("NIGHT_WITCH");
      return;
    }

    // general: no-op
    flashFoot("已取消目前選擇");
  }

  /* ---------- Vote Drawer ---------- */
  function openVoteDrawer() {
    const res = buildVoteAnnounce(false);
    if (el.voteAnnounceText) {
      el.voteAnnounceText.textContent = res.mainText + (res.foot ? `\n\n${res.foot}` : "");
    }
    openDrawer(el.voteDrawer, el.voteDrawerBackdrop);
  }

  /* ---------- Boot ---------- */
  function bindEvents() {
    // tabs
    on(el.tabFlow, "click", () => setTab("flow"));
    on(el.tabSeats, "click", () => setTab("seats"));
    on(el.tabGod, "click", () => setTab("god"));

    // settings drawer
    on(el.btnSettings, "click", () => {
      syncSettingsUI();
      openDrawer(el.drawer, el.drawerBackdrop);
    });
    on(el.btnCloseDrawer, "click", () => closeDrawer(el.drawer, el.drawerBackdrop));
    on(el.drawerBackdrop, "click", () => closeDrawer(el.drawer, el.drawerBackdrop));

    on(el.segEdge, "click", () => {
      S.winMode = "edge";
      saveState();
      syncSettingsUI();
      syncGodText();
      syncTop();
    });
    on(el.segCity, "click", () => {
      S.winMode = "city";
      saveState();
      syncSettingsUI();
      syncGodText();
      syncTop();
    });
    on(el.togglePolice, "change", (e) => {
      S.hasPolice = !!e.target.checked;
      saveState();
      syncSettingsUI();
      syncGodText();
      syncTop();
    });

    on(el.btnReset, "click", () => {
      const ok = confirm("確定要重置本局？（會清空進度）");
      if (!ok) return;
      S = initNewGame(defaultState());
      saveState();
      closeDrawer(el.drawer, el.drawerBackdrop);
      syncTop();
      syncGodText();
      renderSeats();
      setPrompt("SETUP_A1");
      setTab("flow");
      timerReset();
    });

    // vote drawer
    on(el.btnVoteDrawer, "click", openVoteDrawer);
    on(el.btnCloseVoteDrawer, "click", () => closeDrawer(el.voteDrawer, el.voteDrawerBackdrop));
    on(el.voteDrawerBackdrop, "click", () => closeDrawer(el.voteDrawer, el.voteDrawerBackdrop));

    // role modal
    on(el.btnRoleClose, "click", () => closeModal(el.roleModal));
    on(el.btnRoleDone, "click", () => {
      // mark current modal seat done by parsing title
      const t = (el.roleModalTitle?.textContent || "").match(/^(\d+)號/);
      if (t) markRevealDone(Number(t[1]));
      closeModal(el.roleModal);
      // refresh progress
      setPrompt("SETUP_A3");
    });

    // dice
    on(el.btnDice, "click", () => {
      if (el.diceResult) el.diceResult.textContent = rollDicePickSpeaker();
      openModal(el.diceModal);
    });
    on(el.btnDiceAgain, "click", () => {
      if (el.diceResult) el.diceResult.textContent = rollDicePickSpeaker();
    });
    on(el.btnDiceClose, "click", () => closeModal(el.diceModal));

    // bottom actions
    on(el.btnPrimary, "click", goNext);
    on(el.btnBack, "click", goBack);
    on(el.btnCancel, "click", doCancel);

    // god view toggle (panel)
    on(el.toggleGodView, "change", () => {
      // just re-render; your CSS scrollBox already controls
      syncGodText();
    });

    // timer strip buttons
    if (el.timerPresets) {
      on(el.timerPresets, "click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        const sec = btn.dataset && btn.dataset.sec ? Number(btn.dataset.sec) : null;
        if (sec) timerSetPreset(sec);

        // add 1:30 preset if you add a button with data-sec="90"
        // (you asked for 1分半按鈕：只要在 index 加一顆即可)
      });
    }
    on(el.btnTimerStart, "click", timerStart);
    on(el.btnTimerPause, "click", timerPause);
    on(el.btnTimerReset, "click", timerReset);

    // OPTIONAL: if you later add top ⌛️ button
    on(el.btnHourglass, "click", () => {
      // if you add timer drawer in index later, open it here
      const timerDrawer = $("#timerDrawer");
      const timerBackdrop = $("#timerDrawerBackdrop");
      if (timerDrawer && timerBackdrop) {
        // sync drawer UI if you add elements
        openDrawer(timerDrawer, timerBackdrop);
      } else {
        // fallback: start/pause toggle
        if (S.timer.running) timerPause();
        else timerStart();
      }
    });

    // OPTIONAL: if you later add top 👁 button
    on(el.btnGodEye, "click", () => {
      setTab("god");
      if (el.toggleGodView) {
        el.toggleGodView.checked = true;
        syncGodText();
      }
    });
  }

  function boot() {
    // ensure seats count matches players
    if (!S.seats || S.seats.length !== S.players) {
      S = initNewGame(S);
      saveState();
    }

    bindEvents();
    setTab("flow");

    syncTop();
    syncGodText();
    renderSeats();

    // restore prompt
    setPrompt(S.stage || "SETUP_A1");

    // timer UI restore
    timerSyncUI();
    if (S.timer.running) {
      // continue ticking
      if (!timerRAF) timerRAF = requestAnimationFrame(timerTick);
    }
  }

  boot();

})();