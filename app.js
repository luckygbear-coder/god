/* =========================================================
  狼人殺上帝輔助 app.js v3（整合 + 修正）
  - 👁 右上角：開啟「上帝抽屜」
  - 上帝視角：顯示完整角色 / 存活 / 資源狀態
  - Setup：先選人數(9/10/12) → 再選板子（多選項、點選變色）
  - 盡量防呆：任何元素不存在不報錯，避免白屏
========================================================= */

(() => {
  "use strict";

  /* ===================== Utils ===================== */
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  const LS_KEY = "ws_god_v3_state";

  function safeJSONParse(s, fallback) {
    try { return JSON.parse(s); } catch { return fallback; }
  }
  function saveState() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
  }
  function loadState() {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return safeJSONParse(raw, null);
  }

  function vibrate(ms = 40) {
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch {}
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  /* ===================== Boards (fallback) ===================== */
  const BOARD_FALLBACK = [
    // --- 12 ---
    {
      id: "official-12",
      name: "12 人官方標準局",
      players: 12,
      tags: ["官方", "穩", "含白癡"],
      desc: "4狼 + 預言家/女巫/守衛/獵人 + 4民",
      roles: [
        { role: "狼人", camp: "狼" },
        { role: "狼人", camp: "狼" },
        { role: "狼人", camp: "狼" },
        { role: "狼人", camp: "狼" },
        { role: "預言家", camp: "神" },
        { role: "女巫", camp: "神" },
        { role: "守衛", camp: "神" },
        { role: "獵人", camp: "神" },
        { role: "村民", camp: "民" },
        { role: "村民", camp: "民" },
        { role: "村民", camp: "民" },
        { role: "村民", camp: "民" }
      ]
    },
    {
      id: "12-city",
      name: "12 人（標準角色・屠城）",
      players: 12,
      tags: ["測試", "屠城"],
      desc: "同標準角色，勝負改屠城",
      roles: null, // 使用 official-12 的角色
      inherit: "official-12",
      override: { winMode: "city" }
    },
    {
      id: "12-edge-nopolice",
      name: "12 人（屠邊・無上警）",
      players: 12,
      tags: ["測試", "無上警"],
      desc: "同標準角色，但關閉上警",
      roles: null,
      inherit: "official-12",
      override: { hasPolice: false, winMode: "edge" }
    },

    // --- 10 ---
    {
      id: "official-10",
      name: "10 人官方標準局",
      players: 10,
      tags: ["官方", "快節奏"],
      desc: "3狼 + 預言家/女巫/獵人 + 4民",
      roles: [
        { role: "狼人", camp: "狼" },
        { role: "狼人", camp: "狼" },
        { role: "狼人", camp: "狼" },
        { role: "預言家", camp: "神" },
        { role: "女巫", camp: "神" },
        { role: "獵人", camp: "神" },
        { role: "村民", camp: "民" },
        { role: "村民", camp: "民" },
        { role: "村民", camp: "民" },
        { role: "村民", camp: "民" }
      ]
    },
    {
      id: "10-edge-nopolice",
      name: "10 人（屠邊・無上警）",
      players: 10,
      tags: ["測試", "無上警"],
      desc: "同 10 標準，但關閉上警",
      roles: null,
      inherit: "official-10",
      override: { hasPolice: false, winMode: "edge" }
    },

    // --- 9 ---
    {
      id: "official-9",
      name: "9 人官方標準局",
      players: 9,
      tags: ["官方", "最精簡"],
      desc: "3狼 + 預言家/女巫/獵人 + 3民",
      roles: [
        { role: "狼人", camp: "狼" },
        { role: "狼人", camp: "狼" },
        { role: "狼人", camp: "狼" },
        { role: "預言家", camp: "神" },
        { role: "女巫", camp: "神" },
        { role: "獵人", camp: "神" },
        { role: "村民", camp: "民" },
        { role: "村民", camp: "民" },
        { role: "村民", camp: "民" }
      ]
    }
  ];

  function resolveBoard(boardId) {
    const b = BOARD_FALLBACK.find(x => x.id === boardId);
    if (!b) return null;
    if (b.inherit) {
      const base = resolveBoard(b.inherit);
      if (!base) return null;
      const merged = {
        ...base,
        ...b,
        roles: (b.roles && Array.isArray(b.roles)) ? b.roles : base.roles,
      };
      if (b.override) Object.assign(merged, b.override);
      return merged;
    }
    return b;
  }

  function getBoardsByPlayers(n) {
    return BOARD_FALLBACK
      .map(b => resolveBoard(b.id))
      .filter(b => b && b.players === n);
  }

  /* ===================== State ===================== */
  const defaultState = {
    version: 3,
    step: "SETUP_COUNT", // SETUP_COUNT -> SETUP_BOARD -> DEAL -> NIGHT_START
    players: 12,
    boardId: "official-12",
    winMode: "edge",     // edge/city
    hasPolice: true,

    // seats
    seatsAlive: [],          // length players, boolean
    seatRoles: [],           // length players, {role,camp}
    seenRole: [],            // length players, boolean (玩家是否看過)
    // resources
    witchAntidote: true,
    witchPoison: true,
    hunterBullet: true,
    guardCanGuard: true,

    // timer
    timerSec: 90,
    timerRunning: false,
    timerEndAt: 0
  };

  let state = loadState() || structuredClone(defaultState);

  // normalize seats arrays
  function normalizeSeats() {
    const n = state.players;
    if (!Array.isArray(state.seatsAlive) || state.seatsAlive.length !== n) {
      state.seatsAlive = Array.from({ length: n }, () => true);
    }
    if (!Array.isArray(state.seatRoles) || state.seatRoles.length !== n) {
      state.seatRoles = Array.from({ length: n }, () => null);
    }
    if (!Array.isArray(state.seenRole) || state.seenRole.length !== n) {
      state.seenRole = Array.from({ length: n }, () => false);
    }
  }

  /* ===================== DOM refs ===================== */
  const el = {
    uiStatus: null,
    uiBoard: null,

    promptTitle: null,
    promptText: null,
    promptFoot: null,

    boardPickerCard: null,
    boardPicker: null,
    boardPickerHint: null,

    seatsGrid: null,

    godText: null,
    toggleGodView: null,

    btnPrimary: null,
    btnBack: null,
    btnCancel: null,

    // top buttons
    btnHourglass: null,
    btnDice: null,
    btnGodEye: null,
    btnSettings: null,

    // drawers existing in index
    settingsBackdrop: null,
    settingsDrawer: null,
    btnCloseDrawer: null,

    timerBackdrop: null,
    timerDrawer: null,
    btnCloseTimerDrawer: null,

    // timer controls
    timerBig: null,
    timerPresets: null,
    btnTimerStart: null,
    btnTimerPause: null,
    btnTimerReset: null,

    // modals
    roleModal: null,
    roleModalTitle: null,
    roleModalRole: null,
    roleModalCamp: null,
    btnRoleDone: null,
    btnRoleClose: null,

    diceModal: null,
    diceResult: null,
    btnDiceAgain: null,
    btnDiceClose: null,
  };

  /* ===================== Build missing God Drawer (👁) ===================== */
  function ensureGodDrawer() {
    // if already exists, use it
    if ($("#godDrawer") && $("#godDrawerBackdrop")) return;

    const backdrop = document.createElement("div");
    backdrop.id = "godDrawerBackdrop";
    backdrop.className = "backdrop hidden";

    const drawer = document.createElement("div");
    drawer.id = "godDrawer";
    drawer.className = "drawer hidden";
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", "true");
    drawer.setAttribute("aria-hidden", "true");

    drawer.innerHTML = `
      <div class="drawerTop">
        <div class="drawerTitle">👁 上帝資訊</div>
        <button type="button" id="btnCloseGodDrawer" class="iconBtn" aria-label="關閉">✕</button>
      </div>
      <div class="drawerBody">
        <pre id="godDrawerText" class="cardText" style="white-space:pre-wrap; margin:0;"></pre>
      </div>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);

    // close handlers
    const closeBtn = $("#btnCloseGodDrawer");
    const hide = () => hideDrawer("god");
    closeBtn?.addEventListener("click", hide);
    backdrop.addEventListener("click", hide);
  }

  function showDrawer(kind) {
    const map = {
      settings: ["drawerBackdrop", "drawer"],
      timer: ["timerDrawerBackdrop", "timerDrawer"],
      god: ["godDrawerBackdrop", "godDrawer"],
      vote: ["voteDrawerBackdrop", "voteDrawer"]
    };
    const ids = map[kind];
    if (!ids) offerNoop();
    const bd = $("#" + ids[0]);
    const dr = $("#" + ids[1]);
    if (bd) bd.classList.remove("hidden");
    if (dr) {
      dr.classList.remove("hidden");
      dr.setAttribute("aria-hidden", "false");
    }
  }

  function hideDrawer(kind) {
    const map = {
      settings: ["drawerBackdrop", "drawer"],
      timer: ["timerDrawerBackdrop", "timerDrawer"],
      god: ["godDrawerBackdrop", "godDrawer"],
      vote: ["voteDrawerBackdrop", "voteDrawer"]
    };
    const ids = map[kind];
    if (!ids) offerNoop();
    const bd = $("#" + ids[0]);
    const dr = $("#" + ids[1]);
    if (bd) bd.classList.add("hidden");
    if (dr) {
      dr.classList.add("hidden");
      dr.setAttribute("aria-hidden", "true");
    }
  }

  function offerNoop() {}

  /* ===================== Render UI ===================== */
  function setTopStatus() {
    if (el.uiStatus) el.uiStatus.textContent = `${state.step.replaceAll("_", " / ")}`;
    if (el.uiBoard) el.uiBoard.textContent = state.boardId || "—";
  }

  function setPrompt(title, text, foot = "") {
    if (el.promptTitle) el.promptTitle.textContent = title || "—";
    if (el.promptText) el.promptText.textContent = text || "—";
    if (el.promptFoot) el.promptFoot.textContent = foot || "";
  }

  function renderBoardPicker() {
    if (!el.boardPickerCard || !el.boardPicker) return;

    // only show in setup steps
    const show = (state.step === "SETUP_COUNT" || state.step === "SETUP_BOARD");
    el.boardPickerCard.classList.toggle("hidden", !show);

    if (state.step === "SETUP_COUNT") {
      if (el.boardPickerHint) {
        el.boardPickerHint.textContent =
          `目前人數：${state.players} 人（請在下方先選人數）`;
      }
      // show 9/10/12 as buttons
      el.boardPicker.innerHTML = "";
      const wrap = document.createElement("div");
      wrap.className = "timerPresets"; // reuse chip wrap
      [9, 10, 12].forEach(n => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip" + (state.players === n ? " primary" : "");
        b.textContent = `${n}人`;
        b.addEventListener("click", () => {
          state.players = n;
          // default board
          const boards = getBoardsByPlayers(n);
          state.boardId = boards[0]?.id || "";
          normalizeSeats();
          state.step = "SETUP_BOARD";
          saveState();
          renderAll();
        });
        wrap.appendChild(b);
      });
      el.boardPicker.appendChild(wrap);
      return;
    }

    // SETUP_BOARD
    const boards = getBoardsByPlayers(state.players);
    if (el.boardPickerHint) {
      el.boardPickerHint.textContent =
        `目前人數：${state.players} 人（點一下套用板子）`;
    }

    el.boardPicker.innerHTML = "";
    if (!boards.length) {
      el.boardPicker.innerHTML = `<div class="hint">找不到 ${state.players} 人板子（fallback 也沒有）</div>`;
      return;
    }

    boards.forEach(b => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "boardBtn" + (state.boardId === b.id ? " active" : "");
      btn.innerHTML = `
        <div class="name">${b.name}</div>
        <div class="sub">${b.id}　·　${b.desc || ""}</div>
        <div class="tags">${(b.tags || []).map(t => `<span class="badge">${t}</span>`).join("")}</div>
      `;
      btn.addEventListener("click", () => {
        state.boardId = b.id;
        // apply override if any
        const rb = resolveBoard(b.id);
        if (rb?.winMode) state.winMode = rb.winMode;
        if (typeof rb?.hasPolice === "boolean") state.hasPolice = rb.hasPolice;
        saveState();
        renderAll();
      });
      el.boardPicker.appendChild(btn);
    });
  }

  function renderSeats() {
    if (!el.seatsGrid) return;
    normalizeSeats();

    el.seatsGrid.innerHTML = "";
    for (let i = 0; i < state.players; i++) {
      const alive = !!state.seatsAlive[i];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "seatBtn" + (alive ? "" : " dead");
      btn.dataset.idx = String(i);

      btn.innerHTML = `
        <div class="no">${i + 1}號</div>
        <div class="st">${alive ? "存活" : "死亡"}</div>
      `;

      // ✅ 點了要明顯變色（選擇更清楚）
      btn.addEventListener("click", () => {
        $$(".seatBtn").forEach(x => x.classList.remove("selected"));
        btn.classList.add("selected");
        vibrate(20);

        // 在抽身分階段：短按不做事，長按 0.3 秒顯示身份（玩家看）
        // 其他階段：保留「選中」視覺用（你後續流程要用點座位）
      });

      // long-press reveal during DEAL
      let lpTimer = 0;
      const startLP = () => {
        if (state.step !== "DEAL") return;
        clearTimeout(lpTimer);
        lpTimer = window.setTimeout(() => {
          openRoleModal(i);
        }, 300);
      };
      const endLP = () => clearTimeout(lpTimer);

      btn.addEventListener("pointerdown", startLP);
      btn.addEventListener("pointerup", endLP);
      btn.addEventListener("pointercancel", endLP);
      btn.addEventListener("pointerleave", endLP);

      el.seatsGrid.appendChild(btn);
    }
  }

  function buildGodText() {
    const rb = resolveBoard(state.boardId);
    const n = state.players;

    // role summary counts
    const roles = state.seatRoles.filter(Boolean);
    const wolf = roles.filter(r => r.camp === "狼").length;
    const good = roles.filter(r => r.camp !== "狼").length;
    const god = roles.filter(r => r.camp === "神").length;
    const vill = roles.filter(r => r.camp === "民").length;

    const aliveWolf = state.seatRoles
      .map((r, i) => ({ r, i }))
      .filter(x => x.r && x.r.camp === "狼" && state.seatsAlive[x.i]).length;
    const aliveGood = state.seatRoles
      .map((r, i) => ({ r, i }))
      .filter(x => x.r && x.r.camp !== "狼" && state.seatsAlive[x.i]).length;

    let t = "";
    t += `人數：${n}\n`;
    t += `板子：${state.boardId}\n`;
    t += `勝負：${state.winMode === "city" ? "屠城" : "屠邊"}（可切換）\n`;
    t += `上警：${state.hasPolice ? "開" : "關"}\n`;
    t += `流程：${state.step}\n\n`;

    if (!roles.length) {
      t += `抽身分：尚未分配\n\n`;
    } else {
      t += `抽身分：已分配\n`;
      t += `角色數：狼 ${wolf} / 神 ${god} / 民 ${vill}（好人 ${good}）\n`;
      t += `存活：狼 ${aliveWolf} / 好人 ${aliveGood}\n\n`;
    }

    t += `女巫：解藥${state.witchAntidote ? "可用" : "已用"} / 毒藥${state.witchPoison ? "可用" : "已用"}\n`;
    t += `守衛：${state.guardCanGuard ? "可守" : "已死亡/不可再守"}\n`;
    t += `獵人：子彈${state.hunterBullet ? "可用" : "已用"}\n\n`;

    t += `座位明細：\n`;
    for (let i = 0; i < n; i++) {
      const alive = state.seatsAlive[i] ? "存活" : "死亡";
      const r = state.seatRoles[i];
      const roleTxt = r ? `${r.role}（${r.camp}）` : "—";
      const seen = state.seenRole[i] ? "✅已看" : "⬜未看";
      t += `${String(i + 1).padStart(2, " ")}號：${alive}　${roleTxt}　${seen}\n`;
    }

    if (rb?.desc) t += `\n板子說明：${rb.desc}\n`;

    return t.trimEnd();
  }

  function renderGod() {
    const txt = buildGodText();

    // inline godText (如果你的 index 也有那塊)
    if (el.godText) el.godText.textContent = txt;

    // drawer god text
    const godDrawerText = $("#godDrawerText");
    if (godDrawerText) godDrawerText.textContent = txt;
  }

  function renderPromptByStep() {
    if (state.step === "SETUP_COUNT") {
      setPrompt(
        "設定：選人數",
        "請先選人數（9 / 10 / 12）。\n選好後會出現對應板子供你挑選。",
        "提示：之後可在設定切換屠邊/屠城、上警開關。"
      );
      return;
    }

    if (state.step === "SETUP_BOARD") {
      setPrompt(
        "設定：選板子",
        `目前人數：${state.players}\n請點選下方板子套用。\n套用後按「下一步」進入抽身分。`,
        "提示：板子選中會變色，方便辨識。"
      );
      return;
    }

    if (state.step === "DEAL") {
      setPrompt(
        "抽身分",
        "請依序把手機交給每位玩家：\n- 長按座位 0.3 秒顯示身份\n- 玩家看完按「我看完了」\n全部人都看完後，按「下一步」進夜晚。",
        `進度：${state.seenRole.filter(Boolean).length}/${state.players}`
      );
      return;
    }

    if (state.step === "NIGHT_START") {
      setPrompt(
        "夜晚 1",
        "夜晚開始：\n1) 狼人刀人（點座位）\n2) 守衛守人（點座位）\n3) 女巫（同晚解藥/毒藥只能擇一）\n4) 預言家查驗（點座位顯示結果）",
        "按「下一步」開始狼人行動。"
      );
      return;
    }

    // fallback
    setPrompt("—", "—", "");
  }

  function renderAll() {
    normalizeSeats();
    setTopStatus();
    renderPromptByStep();
    renderBoardPicker();
    renderSeats();
    renderGod();

    // button enable states
    if (el.btnBack) el.btnBack.disabled = (state.step === "SETUP_COUNT");
    if (el.btnCancel) el.btnCancel.disabled = false;

    if (el.btnPrimary) {
      // SETUP_BOARD 才能下一步；DEAL 要全部看完
      let disabled = false;
      if (state.step === "SETUP_COUNT") disabled = true;
      if (state.step === "DEAL") disabled = state.seenRole.some(v => !v);
      el.btnPrimary.disabled = disabled;
    }

    // timer render
    renderTimerNow();
  }

  /* ===================== Deal roles ===================== */
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function dealRoles() {
    const rb = resolveBoard(state.boardId) || resolveBoard(`official-${state.players}`);
    const rolePack = rb?.roles || resolveBoard(rb?.inherit || "")?.roles || null;

    if (!rolePack || !Array.isArray(rolePack) || rolePack.length !== state.players) {
      // fallback: all villager (avoid crash)
      state.seatRoles = Array.from({ length: state.players }, () => ({ role: "村民", camp: "民" }));
    } else {
      const pool = shuffle(rolePack.map(x => ({ role: x.role, camp: x.camp })));
      state.seatRoles = pool.slice(0, state.players);
    }

    state.seenRole = Array.from({ length: state.players }, () => false);
    state.seatsAlive = Array.from({ length: state.players }, () => true);

    // resources reset
    state.witchAntidote = true;
    state.witchPoison = true;
    state.hunterBullet = true;
    state.guardCanGuard = true;

    saveState();
  }

  /* ===================== Role modal ===================== */
  function openRoleModal(idx) {
    if (!el.roleModal) return;
    const r = state.seatRoles[idx];
    const title = `${idx + 1}號 身分`;
    const role = r ? r.role : "（尚未分配）";
    const camp = r ? `陣營：${r.camp}` : "";

    if (el.roleModalTitle) el.roleModalTitle.textContent = title;
    if (el.roleModalRole) el.roleModalRole.textContent = role;
    if (el.roleModalCamp) el.roleModalCamp.textContent = camp;

    el.roleModal.classList.remove("hidden");
    el.roleModal.setAttribute("aria-hidden", "false");
  }

  function closeRoleModal(markSeen) {
    if (!el.roleModal) return;
    if (markSeen === true) {
      // 用 modalTitle 解析座位號
      const m = (el.roleModalTitle?.textContent || "").match(/^(\d+)號/);
      if (m) {
        const idx = parseInt(m[1], 10) - 1;
        if (idx >= 0 && idx < state.players) {
          state.seenRole[idx] = true;
          saveState();
        }
      }
    }
    el.roleModal.classList.add("hidden");
    el.roleModal.setAttribute("aria-hidden", "true");
    renderAll();
  }

  /* ===================== Timer ===================== */
  let timerTick = 0;

  function timerIsRunning() {
    return state.timerRunning && state.timerEndAt > 0;
  }

  function renderTimerNow() {
    // timerBig exists both in drawer and maybe elsewhere
    const sec = getTimerRemaining();
    if (el.timerBig) el.timerBig.textContent = fmtTime(sec);
    // if also exists #timerBig in other place, it's same id anyway
  }

  function getTimerRemaining() {
    if (!timerIsRunning()) return state.timerSec;
    const now = Date.now();
    const remain = Math.ceil((state.timerEndAt - now) / 1000);
    return Math.max(0, remain);
  }

  function startTimer() {
    if (timerIsRunning()) return;
    const now = Date.now();
    state.timerRunning = true;
    state.timerEndAt = now + (state.timerSec * 1000);
    saveState();
    syncTimerLoop();
  }

  function pauseTimer() {
    if (!timerIsRunning()) return;
    state.timerSec = getTimerRemaining();
    state.timerRunning = false;
    state.timerEndAt = 0;
    saveState();
    renderTimerNow();
  }

  function resetTimer() {
    state.timerRunning = false;
    state.timerEndAt = 0;
    // keep default 90 sec if user wants; keep current sec if set by preset
    saveState();
    renderTimerNow();
  }

  function setTimer(sec) {
    sec = clamp(sec, 1, 60 * 60);
    state.timerSec = sec;
    state.timerRunning = false;
    state.timerEndAt = 0;
    saveState();
    renderTimerNow();
  }

  function syncTimerLoop() {
    clearInterval(timerTick);
    timerTick = window.setInterval(() => {
      const remain = getTimerRemaining();
      renderTimerNow();
      if (timerIsRunning() && remain <= 0) {
        state.timerRunning = false;
        state.timerEndAt = 0;
        saveState();
        renderTimerNow();
        vibrate(220);
        clearInterval(timerTick);
      }
    }, 250);
  }

  /* ===================== Navigation buttons ===================== */
  function nextStep() {
    if (state.step === "SETUP_COUNT") return; // disabled
    if (state.step === "SETUP_BOARD") {
      // apply board override
      const rb = resolveBoard(state.boardId);
      if (rb?.winMode) state.winMode = rb.winMode;
      if (typeof rb?.hasPolice === "boolean") state.hasPolice = rb.hasPolice;

      // deal
      dealRoles();
      state.step = "DEAL";
      saveState();
      renderAll();
      return;
    }

    if (state.step === "DEAL") {
      if (state.seenRole.some(v => !v)) return;
      state.step = "NIGHT_START";
      saveState();
      renderAll();
      return;
    }

    if (state.step === "NIGHT_START") {
      // 先留：之後接你原本 night flow
      state.step = "NIGHT_START"; // keep
      saveState();
      renderAll();
      return;
    }
  }

  function backStep() {
    if (state.step === "SETUP_COUNT") return;
    if (state.step === "SETUP_BOARD") {
      state.step = "SETUP_COUNT";
      saveState();
      renderAll();
      return;
    }
    if (state.step === "DEAL") {
      state.step = "SETUP_BOARD";
      saveState();
      renderAll();
      return;
    }
    if (state.step === "NIGHT_START") {
      state.step = "DEAL";
      saveState();
      renderAll();
      return;
    }
  }

  function cancelAction() {
    // 目前先做：清除座位選取視覺
    $$(".seatBtn").forEach(x => x.classList.remove("selected"));
    vibrate(10);
  }

  /* ===================== Dice ===================== */
  function openDiceModal() {
    if (!el.diceModal) return;
    el.diceModal.classList.remove("hidden");
    el.diceModal.setAttribute("aria-hidden", "false");
    rollDice();
  }
  function closeDiceModal() {
    if (!el.diceModal) return;
    el.diceModal.classList.add("hidden");
    el.diceModal.setAttribute("aria-hidden", "true");
  }
  function rollDice() {
    if (!el.diceResult) return;
    const aliveIdx = state.seatsAlive
      .map((a, i) => (a ? i : -1))
      .filter(i => i >= 0);

    if (!aliveIdx.length) {
      el.diceResult.textContent = "—";
      return;
    }
    const pick = aliveIdx[(Math.random() * aliveIdx.length) | 0] + 1;
    el.diceResult.textContent = `${pick} 號`;
    vibrate(20);
  }

  /* ===================== Reset ===================== */
  function hardReset() {
    state = structuredClone(defaultState);
    saveState();
    normalizeSeats();
    renderAll();
  }

  /* ===================== Bind ===================== */
  function bind() {
    // refs
    el.uiStatus = $("#uiStatus");
    el.uiBoard = $("#uiBoard");

    el.promptTitle = $("#promptTitle");
    el.promptText = $("#promptText");
    el.promptFoot = $("#promptFoot");

    el.boardPickerCard = $("#boardPickerCard");
    el.boardPicker = $("#boardPicker");
    el.boardPickerHint = $("#boardPickerHint");

    el.seatsGrid = $("#seatsGrid");

    el.godText = $("#godText");
    el.toggleGodView = $("#toggleGodView");

    el.btnPrimary = $("#btnPrimary");
    el.btnBack = $("#btnBack");
    el.btnCancel = $("#btnCancel");

    el.btnHourglass = $("#btnHourglass");
    el.btnDice = $("#btnDice");
    el.btnGodEye = $("#btnGodEye");
    el.btnSettings = $("#btnSettings");

    el.settingsBackdrop = $("#drawerBackdrop");
    el.settingsDrawer = $("#drawer");
    el.btnCloseDrawer = $("#btnCloseDrawer");

    el.timerBackdrop = $("#timerDrawerBackdrop");
    el.timerDrawer = $("#timerDrawer");
    el.btnCloseTimerDrawer = $("#btnCloseTimerDrawer");

    el.timerBig = $("#timerBig");
    el.timerPresets = $("#timerPresets");
    el.btnTimerStart = $("#btnTimerStart");
    el.btnTimerPause = $("#btnTimerPause");
    el.btnTimerReset = $("#btnTimerReset");

    el.roleModal = $("#roleModal");
    el.roleModalTitle = $("#roleModalTitle");
    el.roleModalRole = $("#roleModalRole");
    el.roleModalCamp = $("#roleModalCamp");
    el.btnRoleDone = $("#btnRoleDone");
    el.btnRoleClose = $("#btnRoleClose");

    el.diceModal = $("#diceModal");
    el.diceResult = $("#diceResult");
    el.btnDiceAgain = $("#btnDiceAgain");
    el.btnDiceClose = $("#btnDiceClose");

    // ensure god drawer exists
    ensureGodDrawer();

    // nav
    el.btnPrimary?.addEventListener("click", nextStep);
    el.btnBack?.addEventListener("click", backStep);
    el.btnCancel?.addEventListener("click", cancelAction);

    // top buttons
    el.btnSettings?.addEventListener("click", () => showDrawer("settings"));
    el.btnDice?.addEventListener("click", openDiceModal);

    // ✅ 👁 按了就打開上帝抽屜
    el.btnGodEye?.addEventListener("click", () => {
      renderGod();          // 保證內容最新
      showDrawer("god");
      vibrate(10);
    });

    // ⌛ timer drawer
    el.btnHourglass?.addEventListener("click", () => {
      showDrawer("timer");
      renderTimerNow();
      vibrate(10);
    });

    // close drawers
    el.btnCloseDrawer?.addEventListener("click", () => hideDrawer("settings"));
    el.settingsBackdrop?.addEventListener("click", () => hideDrawer("settings"));

    el.btnCloseTimerDrawer?.addEventListener("click", () => hideDrawer("timer"));
    el.timerBackdrop?.addEventListener("click", () => hideDrawer("timer"));

    // timer presets (chips)
    if (el.timerPresets) {
      el.timerPresets.addEventListener("click", (e) => {
        const btn = e.target?.closest?.("[data-sec]");
        if (!btn) return;
        const sec = parseInt(btn.getAttribute("data-sec"), 10);
        if (!Number.isFinite(sec)) return;
        setTimer(sec);
        vibrate(10);
      });
    }

    el.btnTimerStart?.addEventListener("click", () => startTimer());
    el.btnTimerPause?.addEventListener("click", () => pauseTimer());
    el.btnTimerReset?.addEventListener("click", () => resetTimer());

    // role modal
    el.btnRoleDone?.addEventListener("click", () => closeRoleModal(true));
    el.btnRoleClose?.addEventListener("click", () => closeRoleModal(false));
    el.roleModal?.addEventListener("click", (e) => {
      // click outside card closes (optional)
      const card = e.target?.closest?.(".modalCard");
      if (!card) closeRoleModal(false);
    });

    // dice modal
    el.btnDiceAgain?.addEventListener("click", rollDice);
    el.btnDiceClose?.addEventListener("click", closeDiceModal);
    el.diceModal?.addEventListener("click", (e) => {
      const card = e.target?.closest?.(".modalCard");
      if (!card) closeDiceModal();
    });

    // settings actions (optional: if your index 有這些）
    const segEdge = $("#segEdge");
    const segCity = $("#segCity");
    const togglePolice = $("#togglePolice");
    const btnReset = $("#btnReset");

    segEdge?.addEventListener("click", () => {
      state.winMode = "edge";
      segEdge.classList.add("active");
      segCity?.classList.remove("active");
      saveState();
      renderAll();
    });
    segCity?.addEventListener("click", () => {
      state.winMode = "city";
      segCity.classList.add("active");
      segEdge?.classList.remove("active");
      saveState();
      renderAll();
    });

    if (togglePolice) {
      togglePolice.checked = !!state.hasPolice;
      togglePolice.addEventListener("change", () => {
        state.hasPolice = !!togglePolice.checked;
        saveState();
        renderAll();
      });
    }

    btnReset?.addEventListener("click", () => {
      if (confirm("確定要重置本局？（會清除進度與身分）")) {
        hardReset();
        hideDrawer("settings");
      }
    });

    // init seg UI
    if (segEdge && segCity) {
      if (state.winMode === "city") segCity.classList.add("active");
      else segEdge.classList.add("active");
    }

    // keep timer loop alive
    syncTimerLoop();
  }

  /* ===================== Boot ===================== */
  function boot() {
    // fix older states
    if (!state || typeof state !== "object") state = structuredClone(defaultState);
    if (state.version !== 3) {
      // migrate lightly
      state = { ...structuredClone(defaultState), ...state, version: 3 };
    }

    normalizeSeats();

    // if boardId invalid, set by players
    const boards = getBoardsByPlayers(state.players);
    if (!boards.find(b => b.id === state.boardId)) {
      state.boardId = boards[0]?.id || "official-12";
    }

    saveState();
    bind();
    renderAll();
  }

  document.addEventListener("DOMContentLoaded", boot);

})();