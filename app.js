/* =========================================================
   狼人殺｜上帝輔助 PWA
   app.js（穩定基準版）

   原則：
   - UI / 流程穩定優先
   - WW_DATA 有問題 → 顯示錯誤，不炸整個 App
   - iOS 長按不選字、不放大、不吃事件
========================================================= */

(() => {
  /* =========================
     DOM helpers
  ========================= */
  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);

  /* =========================
     iOS 防長按選字 / 放大
  ========================= */
  try {
    document.documentElement.style.webkitUserSelect = "none";
    document.documentElement.style.userSelect = "none";
    document.documentElement.style.webkitTouchCallout = "none";
  } catch(e){}

  /* =========================
     State
  ========================= */
  const State = {
    phase: "setup",      // setup | deal | night | day
    boardId: "basic",

    players: [],
    dealIndex: 0,

    nightNo: 1,
    dayNo: 1,

    nightState: {},
    logs: [],

    godView: false,

    bundle: null,        // 來自 WW_DATA
  };

  const STORAGE_KEY = "ww_pwa_state_v1";

  /* =========================
     Storage
  ========================= */
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(State));
    } catch(e){}
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && typeof data === "object") {
        Object.assign(State, data);
      }
    } catch(e){}
  }

  /* =========================
     Screen control
  ========================= */
  function showScreen(name) {
    document.querySelectorAll(".screen")
      .forEach(s => s.classList.remove("active"));

    const el = $(`screen-${name}`);
    if (el) el.classList.add("active");

    State.phase = name;
    save();
  }

  /* =========================
     God view
  ========================= */
  function toggleGod() {
    State.godView = !State.godView;
    document.body.classList.toggle("god-on", State.godView);
    const btn = $("btnGodToggle");
    if (btn) btn.textContent = State.godView ? "🔓" : "🔒";
    save();
  }

  /* =========================
     Setup → Start
  ========================= */
  function startGame() {
    if (!window.WW_DATA || typeof WW_DATA.getBoardBundle !== "function") {
      alert("❌ 板子資料（WW_DATA）尚未載入");
      return;
    }

    const bundle = WW_DATA.getBoardBundle(State.boardId);
    if (!bundle || !bundle.board || !bundle.board.buildPlayers) {
      alert("❌ 板子資料結構錯誤");
      return;
    }

    State.bundle = bundle;
    State.players = bundle.board.buildPlayers();
    State.dealIndex = 0;
    State.nightNo = 1;
    State.dayNo = 1;
    State.logs = [];

    showScreen("deal");
    renderDeal();
  }

  /* =========================
     Deal（翻牌）
  ========================= */
  let dealTimer = null;

  function renderDeal() {
    const p = State.players[State.dealIndex];
    if (!p) return;

    $("dealText").innerHTML = `請 <b>${p.seat} 號</b> 拿手機`;

    const btn = $("btnHoldReveal");
    const modal = $("modalReveal");
    const roleEl = $("revealRole");

    if (!btn || !modal || !roleEl) return;

    const startHold = (e) => {
      e.preventDefault();
      clearTimeout(dealTimer);
      dealTimer = setTimeout(() => {
        roleEl.textContent = `${p.icon || ""} ${p.name}`;
        modal.classList.remove("hidden");
        navigator.vibrate?.(60);
      }, 800);
    };

    const endHold = () => {
      clearTimeout(dealTimer);
      modal.classList.add("hidden");
    };

    btn.ontouchstart = startHold;
    btn.ontouchend = endHold;
    btn.ontouchcancel = endHold;
    btn.onmousedown = startHold;
    btn.onmouseup = endHold;
    btn.onmouseleave = endHold;
  }

  function nextDeal() {
    State.dealIndex++;
    if (State.dealIndex >= State.players.length) {
      showScreen("night");
      initNight();
    } else {
      renderDeal();
    }
    save();
  }

  /* =========================
     Night（最小可走版）
  ========================= */
  function initNight() {
    State.nightState = {};
    renderNight();
  }

  function renderNight() {
    $("nightTag").textContent = `第 ${State.nightNo} 夜`;
    $("nightScript").textContent =
      State.godView
        ? "（上帝）夜晚流程進行中"
        : "天黑請閉眼";

    renderSeats("nightSeats");
  }

  function nightNext() {
    // 目前只是示範流程
    resolveNight();
  }

  function resolveNight() {
    State.logs.unshift({
      nightNo: State.nightNo,
      dayNo: State.dayNo,
      publicText: "天亮了，昨晚是平安夜。",
      hiddenText: "（測試）夜晚無事件"
    });

    showAnnouncement();
    showScreen("day");
    save();
  }

  /* =========================
     Day
  ========================= */
  function showAnnouncement() {
    const log = State.logs[0];
    if (!log) return;

    $("annBox").textContent = State.godView
      ? `${log.publicText}\n\n${log.hiddenText}`
      : log.publicText;

    $("modalAnn").classList.remove("hidden");
  }

  function nextDay() {
    State.nightNo++;
    State.dayNo++;
    showScreen("night");
    initNight();
    save();
  }

  /* =========================
     Seats
  ========================= */
  function renderSeats(containerId) {
    const box = $(containerId);
    if (!box) return;

    box.innerHTML = "";
    State.players.forEach(p => {
      const b = document.createElement("button");
      b.className = "seat" + (p.alive === false ? " dead" : "");
      b.textContent = p.seat;
      box.appendChild(b);
    });
  }

  /* =========================
     Restart
  ========================= */
  function restartGame() {
    if (!confirm("確定要重新開始？所有進度會清除")) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }

  /* =========================
     Bind events
  ========================= */
  on($("btnStart"), "click", startGame);
  on($("btnNextPlayer"), "click", nextDeal);
  on($("btnNightNext"), "click", nightNext);
  on($("btnDayNext"), "click", nextDay);
  on($("btnGodToggle"), "click", toggleGod);
  on($("btnRestart"), "click", restartGame);
  on($("btnOpenAnnouncement"), "click", showAnnouncement);
  on($("closeAnn"), "click", () => $("modalAnn")?.classList.add("hidden"));

  /* =========================
     Boot
  ========================= */
  load();
  document.body.classList.toggle("god-on", State.godView);
  showScreen(State.phase || "setup");
})();