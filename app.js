import ROLES from "./roles.js";
import BOARDS from "./boards.js";

/* ======================
   全域遊戲狀態（讓 index.html 可讀）
====================== */
export const Game = {
  boardId: null,
  board: null,
  players: [],
  phase: "setup", // setup | deal | night | day
  dealIndex: 0,

  nightStepIndex: 0,
  nightSteps: [],
  logs: [],

  settings: {
    playerCount: 9
  },

  night: {
    wolfTarget: null,
    guardTarget: null,
    seerTarget: null,
    seerResult: null,
    witchSave: false,
    witchPoisonTarget: null
  }
};
window.Game = Game;

/* ======================
   板子預設配置（9–12）
====================== */
const PRESETS = {
  basic: {
    9:  { werewolf: 2, villager: 5, seer: 1, witch: 1 },
    10: { werewolf: 3, villager: 5, seer: 1, witch: 1 },
    11: { werewolf: 3, villager: 5, seer: 1, witch: 1, hunter: 1 },
    12: { werewolf: 3, villager: 5, seer: 1, witch: 1, hunter: 1, guard: 1 }
  },
  wolfKings: {
    10: { werewolf: 2, whiteWolfKing: 1, blackWolfKing: 1, villager: 4, seer: 1, witch: 1 },
    11: { werewolf: 2, whiteWolfKing: 1, blackWolfKing: 1, villager: 5, seer: 1, witch: 1 },
    12: { werewolf: 2, whiteWolfKing: 1, blackWolfKing: 1, villager: 6, seer: 1, witch: 1 }
  }
};

/* ======================
   啟動：顯示選板子
====================== */
document.addEventListener("DOMContentLoaded", () => {
  renderSetup("basic");
});

/* ======================
   Setup UI
====================== */
function renderSetup(boardId) {
  Game.phase = "setup";
  Game.boardId = boardId;
  Game.board = BOARDS[boardId];

  const counts = Game.board.players;
  if (!counts.includes(Game.settings.playerCount)) {
    Game.settings.playerCount = counts[0];
  }

  const boardsHtml = Object.values(BOARDS).map(b => `
    <button class="board-card ${b.id === boardId ? "active" : ""}"
      onclick="selectBoard('${b.id}')">
      <div class="board-title">${b.name}</div>
      <div class="board-intro">${b.intro}</div>
      <div class="board-meta">
        人數 ${b.players.join("–")} ・ 女巫自救 ${b.rules.witchSelfSave === "forbidden" ? "不可" : "可"}
      </div>
    </button>
  `).join("");

  const countsHtml = counts.map(n => `
    <button class="pill ${n === Game.settings.playerCount ? "active" : ""}"
      onclick="setPlayerCount(${n})">${n} 人</button>
  `).join("");

  document.getElementById("main").innerHTML = `
    <section class="panel">
      <h2 class="h2">請選擇板子開始遊戲</h2>
      <div class="grid">${boardsHtml}</div>
    </section>

    <section class="panel">
      <h3 class="h3">玩家人數</h3>
      <div class="row">${countsHtml}</div>
    </section>

    <section class="panel">
      <h3 class="h3">本局角色配置</h3>
      <div class="card">${presetSummary(boardId, Game.settings.playerCount)}</div>
      <button class="primary" onclick="startDeal()">開始抽牌</button>
    </section>
  `;
}

window.selectBoard = id => renderSetup(id);
window.setPlayerCount = n => {
  Game.settings.playerCount = n;
  renderSetup(Game.boardId);
};

function presetSummary(boardId, count) {
  const preset = PRESETS[boardId][count];
  return Object.entries(preset)
    .map(([k, v]) => `${ROLES[k].name} × ${v}`)
    .join("、");
}

/* ======================
   抽牌
====================== */
window.startDeal = function () {
  const roleList = buildRoleList(Game.boardId, Game.settings.playerCount);
  Game.players = createPlayers(Game.settings.playerCount, roleList);
  Game.dealIndex = 0;
  Game.phase = "deal";
  renderDeal();
};

function renderDeal() {
  const p = Game.players[Game.dealIndex];
  document.getElementById("main").innerHTML = `
    <section class="panel">
      <h2 class="h2">請 ${p.seat} 號查看身分</h2>
      <button class="primary" onclick="showRole()">查看身分</button>
    </section>
  `;
}

window.showRole = function () {
  const p = Game.players[Game.dealIndex];
  alert(`你是【${ROLES[p.roleId].name}】\n\n${ROLES[p.roleId].skill}`);
  Game.dealIndex++;
  Game.dealIndex >= Game.players.length ? startNight() : renderDeal();
};

/* ======================
   夜晚（簡化版）
====================== */
function startNight() {
  Game.phase = "night";
  Game.nightStepIndex = 0;
  Game.nightSteps = Game.board.nightOrder.slice();
  Game.night = { wolfTarget: null, guardTarget: null, seerTarget: null, witchSave: false };
  nextNightStep();
}

function nextNightStep() {
  const step = Game.nightSteps[Game.nightStepIndex++];
  if (!step) return resolveNight();

  document.getElementById("main").innerHTML = `
    <section class="panel">
      <h2 class="h2">🌙 ${step} 行動</h2>
      <div class="seats">
        ${Game.players.filter(p=>p.alive).map(p=>`
          <button class="seat" onclick="nightPick('${step}',${p.seat})">${p.seat}</button>
        `).join("")}
      </div>
    </section>
  `;
}

window.nightPick = function (step, seat) {
  if (step === "werewolf") Game.night.wolfTarget = seat;
  nextNightStep();
};

function resolveNight() {
  const deaths = [];
  if (Game.night.wolfTarget) deaths.push(Game.night.wolfTarget);
  deaths.forEach(seat => Game.players.find(p=>p.seat===seat).alive=false);
  const text = deaths.length ? `死亡：${deaths.join("、")} 號` : "平安夜";
  Game.logs.push(text);
  startDay(text);
}

/* ======================
   白天 + 上帝點座位看身分
====================== */
function startDay(text) {
  Game.phase = "day";
  document.getElementById("main").innerHTML = `
    <section class="panel">
      <h2 class="h2">☀️ 白天</h2>
      <div class="card">${text}</div>

      <div class="card">
        <h3 class="h3">座位（上帝可點查看身分）</h3>
        <div class="seats">
          ${Game.players.map(p=>`
            <button class="seat-chip ${p.alive?"":"dead"}"
              onclick="godPeek(${p.seat})">${p.seat}</button>
          `).join("")}
        </div>
      </div>

      <button class="primary" onclick="startNight()">進入下一夜</button>
    </section>
  `;
}

/* ======================
   👁️ 上帝查看身分
====================== */
window.godPeek = function (seat) {
  if (!document.body.classList.contains("god")) return;
  const p = Game.players.find(x=>x.seat===seat);
  if (!p) return;
  const r = ROLES[p.roleId];
  alert(`👁️ ${seat} 號\n角色：${r.name}\n\n${r.skill}`);
};

/* ======================
   工具
====================== */
function buildRoleList(boardId, count) {
  const preset = PRESETS[boardId][count];
  const list = [];
  Object.entries(preset).forEach(([k,v])=>{
    for(let i=0;i<v;i++) list.push(k);
  });
  return shuffle(list);
}

function createPlayers(count, roles) {
  return Array.from({length:count},(_,i)=>({
    seat:i+1, roleId:roles[i], alive:true
  }));
}

function shuffle(a) {
  const arr=[...a];
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}