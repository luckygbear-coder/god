/* =========================================================
   狼人殺｜上帝輔助 PWA
   app.js（最終瘦身穩定版）

   原則：
   - ❌ 不寫任何狼人殺規則
   - ✅ 只負責 UI、流程、狀態
   - ✅ 規則 / 夜晚流程 / 勝負 → 全部來自 WW_DATA
========================================================= */

(() => {
  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  /* -------------------------------------------------------
     全域狀態
  ------------------------------------------------------- */
  const State = {
    phase: "setup",     // setup | deal | night | day | end
    boardId: "basic",

    players: [],
    dealIndex: 0,

    nightNo: 1,
    dayNo: 1,

    nightState: {},
    logs: [],

    godView: false,
    bundle: null,       // board + rules + nightSteps
  };

  /* -------------------------------------------------------
     工具
  ------------------------------------------------------- */
  function save() {
    localStorage.setItem("ww_save", JSON.stringify(State));
  }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem("ww_save"));
      if (s && s.players) Object.assign(State, s);
    } catch(e){}
  }

  function showScreen(name) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    $(`screen-${name}`)?.classList.add("active");
    State.phase = name;
    save();
  }

  function toggleGod() {
    State.godView = !State.godView;
    document.body.classList.toggle("god-on", State.godView);
    $("btnGodToggle").textContent = State.godView ? "🔓" : "🔒";
    save();
  }

  /* -------------------------------------------------------
     Setup
  ------------------------------------------------------- */
  function startGame() {
    const bundle = WW_DATA.getBoardBundle(State.boardId);
    if (!bundle) {
      alert("板子資料載入失敗");
      return;
    }
    State.bundle = bundle;

    // 建立玩家（只根據 board preset）
    State.players = bundle.board.buildPlayers();
    State.dealIndex = 0;
    State.logs = [];
    State.nightNo = 1;
    State.dayNo = 1;

    showScreen("deal");
    renderDeal();
  }

  /* -------------------------------------------------------
     Deal（長按翻牌）
  ------------------------------------------------------- */
  function renderDeal() {
    const idx = State.dealIndex;
    const p = State.players[idx];
    if (!p) return;

    $("dealText").innerHTML = `請 <b>${p.seat} 號</b> 拿手機`;

    const btn = $("btnHoldReveal");
    let timer = null;

    btn.onpointerdown = () => {
      timer = setTimeout(() => {
        $("revealRole").textContent = `${p.icon} ${p.name}`;
        $("modalReveal").classList.remove("hidden");
        navigator.vibrate?.(60);
      }, 800);
    };
    btn.onpointerup = btn.onpointerleave = () => {
      clearTimeout(timer);
      $("modalReveal").classList.add("hidden");
    };
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

  /* -------------------------------------------------------
     Night
  ------------------------------------------------------- */
  function initNight() {
    const { nightSteps } = State.bundle;
    State.nightState = {};
    State.nightStepIndex = 0;
    renderNight();
  }

  function renderNight() {
    const steps = State.bundle.nightSteps;
    const step = steps[State.nightStepIndex];
    if (!step) return;

    $("nightTag").textContent = `第 ${State.nightNo} 夜`;
    $("nightScript").textContent =
      State.godView ? step.godScript : step.publicScript;

    renderSeats((seat) => {
      if (step.pickKey) {
        State.nightState[step.pickKey] = seat;
      }
    });
  }

  function nightNext() {
    const steps = State.bundle.nightSteps;
    const step = steps[State.nightStepIndex];

    // 結算
    if (step.type === "resolve") {
      resolveNight();
      return;
    }

    State.nightStepIndex++;
    renderNight();
    save();
  }

  function resolveNight() {
    const { rules } = State.bundle;
    const result = rules.resolveNight({
      players: State.players,
      night: State.nightState,
      settings: State.bundle.board.settings
    });

    const ann = rules.buildAnnouncement({
      nightNo: State.nightNo,
      dayNo: State.dayNo,
      players: State.players,
      resolved: result
    });

    State.logs.unshift({
      nightNo: State.nightNo,
      dayNo: State.dayNo,
      publicText: ann.publicText,
      hiddenText: ann.hiddenText
    });

    showAnnouncement();
    showScreen("day");
    save();
  }

  /* -------------------------------------------------------
     Day
  ------------------------------------------------------- */
  function showAnnouncement() {
    $("annBox").textContent = State.godView
      ? State.logs[0].publicText + "\n\n" + State.logs[0].hiddenText
      : State.logs[0].publicText;
    $("modalAnn").classList.remove("hidden");
  }

  function nextDay() {
    State.nightNo++;
    State.dayNo++;
    showScreen("night");
    initNight();
    save();
  }

  /* -------------------------------------------------------
     Seats
  ------------------------------------------------------- */
  function renderSeats(onPick) {
    const box = $("nightSeats") || $("daySeats");
    if (!box) return;
    box.innerHTML = "";

    State.players.forEach(p => {
      const b = document.createElement("button");
      b.className = "seat" + (p.alive ? "" : " dead");
      b.textContent = p.seat;
      b.onclick = () => p.alive && onPick(p.seat);
      box.appendChild(b);
    });
  }

  /* -------------------------------------------------------
     Restart
  ------------------------------------------------------- */
  function restartGame() {
    if (!confirm("確定要重新開始？所有進度會清除")) return;
    localStorage.removeItem("ww_save");
    location.reload();
  }

  /* -------------------------------------------------------
     Bind events
  ------------------------------------------------------- */
  on($("btnStart"), "click", startGame);
  on($("btnNextPlayer"), "click", nextDeal);
  on($("btnNightNext"), "click", nightNext);
  on($("btnDayNext"), "click", nextDay);
  on($("btnGodToggle"), "click", toggleGod);
  on($("btnRestart"), "click", restartGame);
  on($("btnOpenAnnouncement"), "click", showAnnouncement);
  on($("closeAnn"), "click", () => $("modalAnn").classList.add("hidden"));

  /* -------------------------------------------------------
     Boot
  ------------------------------------------------------- */
  load();
  document.body.classList.toggle("god-on", State.godView);

  showScreen(State.phase || "setup");

})();