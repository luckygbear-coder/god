/*************************
 * 狼人殺上帝輔助 App
 * 核心流程控制 app.js
 *************************/

import ROLES from "./roles.js";
import BOARDS from "./boards.js";

/* ======================
   全域遊戲狀態
====================== */

const Game = {
  board: null,
  players: [],
  phase: "setup", // setup | deal | night | day | vote | end
  nightStepIndex: 0,
  nightSteps: [],
  logs: [],

  night: {
    wolfTarget: null,
    guardTarget: null,
    seerTarget: null,
    seerResult: null,
    witchSave: false,
    witchPoisonTarget: null
  }
};

/* ======================
   玩家結構
====================== */

function createPlayers(count, roleList) {
  const shuffledRoles = shuffle(roleList);
  return Array.from({ length: count }, (_, i) => ({
    seat: i + 1,
    roleId: shuffledRoles[i],
    alive: true,
    isChief: false,
    status: {}
  }));
}

/* ======================
   開始遊戲
====================== */

window.startGame = function (boardId, playerCount, roleList) {
  Game.board = BOARDS[boardId];
  Game.players = createPlayers(playerCount, roleList);
  Game.phase = "deal";
  renderDeal();
};

/* ======================
   抽牌（Pass & Play）
====================== */

let dealIndex = 0;

function renderDeal() {
  const p = Game.players[dealIndex];
  document.getElementById("main").innerHTML = `
    <h2>請 ${p.seat} 號查看身分</h2>
    <button onclick="showRole(${dealIndex})">按住查看角色</button>
  `;
}

window.showRole = function (index) {
  const p = Game.players[index];
  const role = ROLES[p.roleId];
  alert(`你是【${role.name}】\n\n${role.skill}`);
  dealIndex++;
  if (dealIndex >= Game.players.length) {
    startNight();
  } else {
    renderDeal();
  }
};

/* ======================
   夜晚流程
====================== */

function startNight() {
  Game.phase = "night";
  Game.nightStepIndex = 0;
  Game.night = {
    wolfTarget: null,
    guardTarget: null,
    seerTarget: null,
    seerResult: null,
    witchSave: false,
    witchPoisonTarget: null
  };

  Game.nightSteps = Game.board.nightOrder.slice();
  renderNightStep();
}

function renderNightStep() {
  const step = Game.nightSteps[Game.nightStepIndex];
  if (!step) {
    resolveNight();
    return;
  }

  switch (step) {
    case "guard":
      pickTarget("守衛守誰？", "guardTarget");
      break;
    case "werewolf":
      pickTarget("狼人刀誰？", "wolfTarget");
      break;
    case "seer":
      pickTarget("預言家驗誰？", "seerTarget", true);
      break;
    case "witch":
      renderWitch();
      break;
    case "cupid":
      pickTwoTargets("邱比特選擇情侶");
      break;
    default:
      nextNightStep();
  }
}

function nextNightStep() {
  Game.nightStepIndex++;
  renderNightStep();
}

/* ======================
   夜晚選人工具
====================== */

function pickTarget(title, key, reveal = false) {
  const buttons = Game.players
    .filter(p => p.alive)
    .map(
      p => `<button onclick="confirmTarget('${key}',${p.seat})">${p.seat} 號</button>`
    )
    .join("");

  document.getElementById("main").innerHTML = `
    <h2>${title}</h2>
    ${buttons}
  `;

  window.confirmTarget = function (k, seat) {
    Game.night[k] = seat;
    if (reveal) {
      const target = Game.players.find(p => p.seat === seat);
      const team = ROLES[target.roleId].team === "wolf" ? "狼人" : "好人";
      Game.night.seerResult = team;
      alert(`查驗結果：${team}`);
    }
    nextNightStep();
  };
}

function renderWitch() {
  const target = Game.night.wolfTarget;
  const witchSeat = Game.players.find(p => ROLES[p.roleId].id === "witch")?.seat;

  let saveDisabled =
    target === witchSeat && Game.board.rules.witchSelfSave === "forbidden";

  document.getElementById("main").innerHTML = `
    <h2>女巫行動</h2>
    <p>今晚被刀的是：${target ? target + " 號" : "無"}</p>
    <button ${saveDisabled ? "disabled" : ""} onclick="witchSave()">用解藥</button>
    <button onclick="witchPoison()">用毒藥</button>
    <button onclick="nextNightStep()">不用</button>
  `;
}

window.witchSave = function () {
  Game.night.witchSave = true;
  nextNightStep();
};

window.witchPoison = function () {
  pickTarget("女巫毒誰？", "witchPoisonTarget");
};

/* ======================
   夜晚結算
====================== */

function resolveNight() {
  const deaths = new Set();

  // 狼刀
  if (Game.night.wolfTarget) {
    let blocked =
      Game.night.wolfTarget === Game.night.guardTarget ||
      Game.night.witchSave;

    if (!blocked) deaths.add(Game.night.wolfTarget);
  }

  // 女巫毒
  if (Game.night.witchPoisonTarget) {
    deaths.add(Game.night.witchPoisonTarget);
  }

  deaths.forEach(seat => killPlayer(seat, "night"));

  const deathList = [...deaths].map(s => `${s} 號`).join("、") || "沒有人";
  Game.logs.push(`天亮了，昨晚死亡的是：${deathList}`);

  startDay(deathList);
}

/* ======================
   死亡處理（含狼王）
====================== */

function killPlayer(seat, reason) {
  const p = Game.players.find(p => p.seat === seat);
  if (!p || !p.alive) return;

  p.alive = false;

  const role = ROLES[p.roleId];

  if (role.id === "blackWolfKing") {
    if (reason !== "poison" && reason !== "explode") {
      alert("黑狼王發動【狼王之爪】");
      pickTarget("黑狼王帶誰？", "__blackWolfClaw");
    }
  }

  if (role.id === "whiteWolfKing" && reason === "vote") {
    alert("白狼王發動技能");
    pickTarget("白狼王帶誰？", "__whiteWolfClaw");
  }
}

/* ======================
   白天流程
====================== */

function startDay(deathText) {
  Game.phase = "day";
  document.getElementById("main").innerHTML = `
    <h2>白天</h2>
    <p>${deathText}</p>
    <div id="speechTimer"></div>
  `;
  renderSpeechTimer();
}

/* ======================
   白天發言倒數計時器
====================== */

const speechTimer = {
  duration: 120,
  remaining: 120,
  running: false,
  interval: null
};

function renderSpeechTimer() {
  document.getElementById("speechTimer").innerHTML = `
    <h3>🕒 發言倒數</h3>
    <button onclick="setSpeechMinutes(1)">1 分</button>
    <button onclick="setSpeechMinutes(2)">2 分</button>
    <button onclick="setSpeechMinutes(3)">3 分</button>
    <h1 id="timerDisplay">02:00</h1>
    <button onclick="startSpeechTimer()">開始</button>
    <button onclick="pauseSpeechTimer()">暫停</button>
    <button onclick="resetSpeechTimer()">重置</button>
  `;
  updateTimerDisplay();
}

window.setSpeechMinutes = function (m) {
  if (speechTimer.running) return;
  speechTimer.duration = m * 60;
  speechTimer.remaining = m * 60;
  updateTimerDisplay();
};

window.startSpeechTimer = function () {
  if (speechTimer.running) return;
  speechTimer.running = true;
  speechTimer.interval = setInterval(() => {
    speechTimer.remaining--;
    if (speechTimer.remaining <= 0) {
      pauseSpeechTimer();
      alert("⏰ 發言時間到！");
    }
    updateTimerDisplay();
  }, 1000);
};

window.pauseSpeechTimer = function () {
  clearInterval(speechTimer.interval);
  speechTimer.running = false;
};

window.resetSpeechTimer = function () {
  pauseSpeechTimer();
  speechTimer.remaining = speechTimer.duration;
  updateTimerDisplay();
};

function updateTimerDisplay() {
  const m = Math.floor(speechTimer.remaining / 60);
  const s = speechTimer.remaining % 60;
  document.getElementById("timerDisplay").innerText =
    `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ======================
   工具
====================== */

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}
