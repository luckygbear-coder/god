/************************************************************
 * 狼人殺 上帝輔助 PWA - MVP app.js
 * 穩定單檔版（避免手機當機）
 ************************************************************/

/* =========================
   基本工具
========================= */
const $ = (id) => document.getElementById(id);
const qs = (s) => document.querySelector(s);
const qsa = (s) => [...document.querySelectorAll(s)];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

/* =========================
   狀態資料
========================= */
const Game = {
  phase: "setup", // setup | deal | night | day | vote | log
  godUnlocked: false,
  nightCount: 1,
  dayCount: 1,

  settings: {
    playerCount: 9,
    roles: {
      werewolf: 2,
      villager: 4,
      seer: 1,
      witch: 1,
      hunter: 1,
      guard: 0
    }
  },

  players: [],

  dealIndex: 0,

  night: {
    guardTarget: null,
    wolfTarget: null,
    seerCheckTarget: null,
    seerResult: null,
    witchSaveUsed: false,
    witchPoisonUsed: false,
    witchSave: false,
    witchPoisonTarget: null
  },

  log: []
};

/* =========================
   角色定義
========================= */
const ROLE_INFO = {
  werewolf: { name: "狼人", team: "wolf" },
  villager: { name: "村民", team: "villager" },
  seer: { name: "預言家", team: "villager" },
  witch: { name: "女巫", team: "villager" },
  hunter: { name: "獵人", team: "villager" },
  guard: { name: "守衛", team: "villager" }
};

/* =========================
   初始化
========================= */
document.addEventListener("DOMContentLoaded", () => {
  bindSetup();
  bindDeal();
  bindGodLock();
  bindBottomBar();
  updateSetupUI();
});

/* =========================
   畫面切換
========================= */
function showScreen(id) {
  qsa(".screen").forEach(s => s.classList.remove("active"));
  $(id).classList.add("active");
}

/* =========================
   Setup 頁
========================= */
function bindSetup() {
  $("playerCountRange").oninput = (e) => {
    Game.settings.playerCount = Number(e.target.value);
    $("playerCountText").textContent = Game.settings.playerCount;
    updateSetupUI();
  };

  $("countPlus").onclick = () => {
    if (Game.settings.playerCount < 16) {
      Game.settings.playerCount++;
      syncPlayerCount();
    }
  };

  $("countMinus").onclick = () => {
    if (Game.settings.playerCount > 6) {
      Game.settings.playerCount--;
      syncPlayerCount();
    }
  };

  qsa(".step").forEach(btn => {
    btn.onclick = () => {
      const role = btn.dataset.role;
      const op = btn.dataset.op;
      if (op === "plus") Game.settings.roles[role]++;
      if (op === "minus" && Game.settings.roles[role] > 0) {
        Game.settings.roles[role]--;
      }
      updateSetupUI();
    };
  });

  $("btnSuggest").onclick = () => {
    const pc = Game.settings.playerCount;
    Game.settings.roles = {
      werewolf: pc >= 9 ? 2 : 1,
      villager: pc - 4,
      seer: 1,
      witch: 1,
      hunter: 1,
      guard: pc >= 10 ? 1 : 0
    };
    updateSetupUI();
  };
}

function syncPlayerCount() {
  $("playerCountRange").value = Game.settings.playerCount;
  $("playerCountText").textContent = Game.settings.playerCount;
  updateSetupUI();
}

function updateSetupUI() {
  let total = 0;
  for (const r in Game.settings.roles) {
    total += Game.settings.roles[r];
    const el = $("num_" + r);
    if (el) el.textContent = Game.settings.roles[r];
  }
  $("roleTotal").textContent = total;
  $("playerTotal").textContent = Game.settings.playerCount;

  const ok = total === Game.settings.playerCount;
  $("roleWarn").classList.toggle("hidden", ok);
  $("btnPrimary").textContent = ok ? "開始遊戲" : "角色數不符";
  $("btnPrimary").disabled = !ok;
}

/* =========================
   抽身分
========================= */
function bindDeal() {
  $("btnPrimary").onclick = startDeal;
  $("btnNextSeat").onclick = nextDealSeat;
  $("btnBackToSetup").onclick = () => showScreen("screenSetup");
  $("btnFinishDeal").onclick = () => {
    showScreen("screenNight");
    renderNightIntro();
  };

  let holdTimer = null;
  $("holdToReveal").ontouchstart = $("holdToReveal").onmousedown = () => {
    holdTimer = setTimeout(showReveal, 1200);
  };
  $("holdToReveal").ontouchend =
  $("holdToReveal").onmouseup =
  $("holdToReveal").onmouseleave = () => {
    clearTimeout(holdTimer);
    hideReveal();
  };
}

function startDeal() {
  buildPlayers();
  Game.dealIndex = 0;
  showScreen("screenDeal");
  updateDealPrompt();
}

function buildPlayers() {
  const roles = [];
  for (const r in Game.settings.roles) {
    for (let i = 0; i < Game.settings.roles[r]; i++) roles.push(r);
  }
  const shuffled = shuffle(roles);

  Game.players = shuffled.map((r, i) => ({
    seat: i + 1,
    roleId: r,
    team: ROLE_INFO[r].team,
    alive: true,
    isChief: false
  }));
}

function updateDealPrompt() {
  const i = Game.dealIndex + 1;
  $("dealPrompt").innerHTML = `請 <b>${i} 號</b> 拿手機`;
}

function showReveal() {
  const p = Game.players[Game.dealIndex];
  $("revealRole").textContent = ROLE_INFO[p.roleId].name;
  $("revealModal").classList.remove("hidden");
  if (navigator.vibrate) navigator.vibrate(80);
}

function hideReveal() {
  $("revealModal").classList.add("hidden");
}

function nextDealSeat() {
  Game.dealIndex++;
  if (Game.dealIndex >= Game.players.length) {
    $("dealPrompt").innerHTML = "所有玩家已抽完身分";
  } else {
    updateDealPrompt();
  }
}

/* =========================
   上帝鎖
========================= */
function bindGodLock() {
  $("lockBtn").onclick = () => {
    if (Game.godUnlocked) {
      Game.godUnlocked = false;
      alert("已鎖定上帝模式");
    } else {
      $("pinModal").classList.remove("hidden");
    }
  };

  $("pinCancel").onclick = () => $("pinModal").classList.add("hidden");
  $("pinOk").onclick = () => {
    if ($("pinInput").value === "0000") {
      Game.godUnlocked = true;
      $("pinModal").classList.add("hidden");
      alert("上帝模式已解鎖");
    } else {
      $("pinError").classList.remove("hidden");
    }
  };
}

/* =========================
   夜晚（MVP）
========================= */
function renderNightIntro() {
  $("nightBadge").textContent = `第 ${Game.nightCount} 夜`;
  $("script").querySelector(".script-text").textContent =
    "天黑請閉眼。\n（請切換上帝模式進行夜晚操作）";
}

/* =========================
   底部列
========================= */
function bindBottomBar() {
  $("btnBack").onclick = () => {
    if (Game.phase === "deal") showScreen("screenSetup");
  };

  $("btnLog").onclick = () => showScreen("screenLog");
}

/* =========================
   Log（簡易）
========================= */
function addLog(title, text) {
  Game.log.push({ title, text });
  renderLog();
}

function renderLog() {
  const box = $("logList");
  box.innerHTML = "";
  Game.log.forEach(l => {
    const d = document.createElement("div");
    d.className = "log-item";
    d.innerHTML = `<div class="log-title">${l.title}</div>
                   <div class="log-text">${l.text}</div>`;
    box.appendChild(d);
  });
}