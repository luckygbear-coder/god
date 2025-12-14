import ROLES from "./roles.js";
import BOARDS from "./boards.js";

/* ======================
   全域狀態（讓 index.html 可讀 logs）
====================== */
export const Game = {
  boardId: "basic",
  board: null,
  players: [],
  phase: "setup", // setup | deal | night | day | vote
  dealIndex: 0,

  nightStepIndex: 0,
  nightSteps: [],
  logs: [],

  settings: { playerCount: 9 },

  night: {
    wolfTarget: null,
    guardTarget: null,
    seerTarget: null,
    seerResult: null,
    witchSave: false,
    witchPoisonTarget: null
  },

  vote: {
    round: 1,
    candidates: null,      // null = 全部可投；陣列 = 只限名單（平票重投）
    voterSeats: [],
    voterIndex: 0,
    votes: {},             // { voterSeat: targetSeat|null }
    done: false
  }
};
window.Game = Game;

/* ======================
   板子預設配置（你可自行再加）
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
   啟動
====================== */
document.addEventListener("DOMContentLoaded", () => {
  renderSetup("basic");
});

/* ======================
   Setup UI（選板子/人數/配置）
====================== */
function renderSetup(boardId) {
  Game.phase = "setup";
  Game.boardId = boardId;
  Game.board = BOARDS[boardId];

  const counts = Game.board.players || [9, 10, 11, 12];
  if (!counts.includes(Game.settings.playerCount)) Game.settings.playerCount = counts[0];

  const boardsHtml = Object.values(BOARDS).map(b => `
    <button class="board-card ${b.id === boardId ? "active" : ""}" onclick="selectBoard('${b.id}')">
      <div class="board-title">${b.name}</div>
      <div class="board-intro">${b.intro || ""}</div>
      <div class="board-meta">
        人數 ${b.players.join("–")} ・ 女巫自救 ${b.rules?.witchSelfSave === "forbidden" ? "不可" : "可"}
      </div>
    </button>
  `).join("");

  const countsHtml = counts.map(n => `
    <button class="pill ${n === Game.settings.playerCount ? "active" : ""}" onclick="setPlayerCount(${n})">${n} 人</button>
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
      <h3 class="h3">本局角色配置（預設）</h3>
      <div class="card">${presetSummary(boardId, Game.settings.playerCount)}</div>
      <button class="primary" onclick="startDeal()">開始抽牌</button>
    </section>
  `;
}

window.selectBoard = id => renderSetup(id);
window.setPlayerCount = n => { Game.settings.playerCount = n; renderSetup(Game.boardId); };

function presetSummary(boardId, count) {
  const preset = PRESETS[boardId]?.[count];
  if (!preset) return `⚠️ 這個板子目前沒有 ${count} 人的預設配置。`;
  return Object.entries(preset)
    .filter(([,v])=>v>0)
    .map(([k,v]) => `${ROLES[k]?.name || k} × ${v}`)
    .join("、");
}

/* ======================
   抽牌（Pass & Play）
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
      <div class="hint">看完請交給下一位</div>
      <button class="primary" onclick="showRole()">查看身分</button>
      <button class="ghost" onclick="renderSetup('${Game.boardId}')">返回選板子</button>
    </section>
  `;
}

window.showRole = function () {
  const p = Game.players[Game.dealIndex];
  const r = ROLES[p.roleId];
  alert(`你是【${r.name}】\n\n${r.skill}`);
  Game.dealIndex++;
  if (Game.dealIndex >= Game.players.length) startNight();
  else renderDeal();
};

/* ======================
   夜晚（簡化：狼人刀人；你要完整夜晚我也能再補回）
====================== */
function startNight() {
  Game.phase = "night";
  Game.night = {
    wolfTarget: null,
    guardTarget: null,
    seerTarget: null,
    seerResult: null,
    witchSave: false,
    witchPoisonTarget: null
  };

  document.getElementById("main").innerHTML = `
    <section class="panel">
      <div class="tag">🌙 夜晚</div>
      <h2 class="h2">狼人刀誰？</h2>
      <div class="hint">點選要擊殺的座位</div>
      <div class="seats">
        ${alivePlayers().map(p => `<button class="seat" onclick="nightWolfPick(${p.seat})">${p.seat}</button>`).join("")}
      </div>
      <button class="ghost" onclick="nightWolfPick(null)">平安夜（不刀）</button>
    </section>
  `;
}

window.nightWolfPick = function(seat){
  Game.night.wolfTarget = seat;
  resolveNight();
};

function resolveNight() {
  const deaths = new Set();

  if (Game.night.wolfTarget) deaths.add(Game.night.wolfTarget);
  deaths.forEach(seat => killPlayer(seat, "night"));

  const deathList = [...deaths].map(s=>`${s} 號`).join("、") || "沒有人";
  const announce = `天亮了，昨晚死亡的是：${deathList}`;
  Game.logs.push(announce);

  startDay(announce);
}

/* ======================
   白天（含座位可點 + 投票入口）
====================== */
function startDay(announceText) {
  Game.phase = "day";

  document.getElementById("main").innerHTML = `
    <section class="panel">
      <div class="tag">☀️ 白天</div>

      <div class="card">
        <div style="font-weight:900;margin-bottom:6px;">公告</div>
        <div>${escapeHtml(announceText)}</div>
        <div class="row" style="margin-top:10px;">
          <button class="ghost" onclick="copyText(${JSON.stringify(announceText)})">一鍵複製公告</button>
          <button class="ghost" onclick="startNight()">直接進入下一夜</button>
        </div>
      </div>

      <div class="card">
        <div style="font-weight:900;margin-bottom:6px;">👥 座位（上帝模式可點查看身分）</div>
        <div class="seats">
          ${Game.players.map(p => `
            <button class="seat-chip ${p.alive ? "" : "dead"}"
              onclick="godPeek(${p.seat})"
              ${p.alive ? "" : "disabled"}
            >${p.seat}</button>
          `).join("")}
        </div>
        <div class="hint">玩家模式點了不會顯示身分</div>
      </div>

      <div class="card">
        <div style="font-weight:900;margin-bottom:6px;">🗳️ 投票</div>
        <div class="hint">按開始後，會依序提示每位存活玩家投票</div>
        <button class="primary" onclick="startVote()">開始投票</button>
      </div>
    </section>
  `;

  injectMiniStyles();
}

/* ======================
   👁️ 上帝查看身分（只有 body.god 才會顯示）
====================== */
window.godPeek = function (seat) {
  if (!document.body.classList.contains("god")) return;
  const p = Game.players.find(x => x.seat === seat);
  if (!p) return;
  const r = ROLES[p.roleId];
  alert(`👁️ ${seat} 號\n角色：${r.name}\n\n${r.skill}\n\n（備註）${r.godNote || "—"}`);
};

/* ======================
   ✅ 白天投票流程（逐一點票 + 統計 + 平票重投 + 處刑觸發）
====================== */
window.startVote = function () {
  Game.phase = "vote";
  Game.vote = {
    round: 1,
    candidates: null, // null = 全部可投
    voterSeats: alivePlayers().map(p => p.seat),
    voterIndex: 0,
    votes: {},
    done: false
  };
  renderVoteStep();
};

function renderVoteStep() {
  const v = Game.vote;
  const voterSeat = v.voterSeats[v.voterIndex];

  // 所有可投目標
  const aliveSeats = alivePlayers().map(p => p.seat);
  const allowedCandidates = v.candidates ? v.candidates : aliveSeats;

  // 投票目標（通常不讓投自己）
  const targets = allowedCandidates.filter(s => s !== voterSeat);

  // 若候選名單只剩自己（理論上不太會），允許棄票
  const targetButtons = targets.map(s => `
    <button class="seat" onclick="castVote(${voterSeat}, ${s})">${s}</button>
  `).join("");

  document.getElementById("main").innerHTML = `
    <section class="panel">
      <div class="tag">🗳️ 投票第 ${v.round} 輪</div>
      <h2 class="h2">請 ${voterSeat} 號投票</h2>

      <div class="hint">
        ${v.candidates ? `本輪只可投：${v.candidates.join("、")} 號（平票重投）` : "本輪可投任一存活座位"}
      </div>

      <div class="seats">${targetButtons}</div>

      <div class="row">
        <button class="ghost" onclick="castVote(${voterSeat}, null)">棄票</button>
        <button class="ghost" onclick="cancelVote()">取消投票（回白天）</button>
      </div>

      <div class="card">
        <div style="font-weight:900;margin-bottom:6px;">已投進度</div>
        <div>${v.voterIndex} / ${v.voterSeats.length}</div>
      </div>
    </section>
  `;

  injectMiniStyles();
}

window.castVote = function (voterSeat, targetSeat) {
  const v = Game.vote;
  v.votes[voterSeat] = targetSeat; // null = 棄票
  v.voterIndex++;

  if (v.voterIndex >= v.voterSeats.length) {
    renderVoteResult();
  } else {
    renderVoteStep();
  }
};

window.cancelVote = function () {
  startDay("（已取消投票）");
};

/* 統計票數 */
function tallyVotes(votes, candidateLimit=null) {
  const tally = new Map(); // seat -> count
  const entries = Object.entries(votes);

  for (const [, target] of entries) {
    if (target === null) continue; // 棄票
    if (candidateLimit && !candidateLimit.includes(target)) continue;
    tally.set(target, (tally.get(target) || 0) + 1);
  }

  // 轉成陣列排序
  const result = [...tally.entries()]
    .map(([seat, count]) => ({ seat, count }))
    .sort((a,b) => b.count - a.count);

  return result;
}

function renderVoteResult() {
  const v = Game.vote;
  const tally = tallyVotes(v.votes, v.candidates);

  // 顯示每個人投了誰（上帝看）
  const detailLines = v.voterSeats.map(seat => {
    const t = v.votes[seat];
    return `${seat} → ${t === null ? "棄票" : t + " 號"}`;
  }).join("<br>");

  // 沒有人得票
  if (tally.length === 0) {
    Game.logs.push(`投票結果：全部棄票 / 無有效票（第 ${v.round} 輪）`);
    document.getElementById("main").innerHTML = `
      <section class="panel">
        <div class="tag">🗳️ 投票結果</div>
        <div class="card">
          <div style="font-weight:900;margin-bottom:6px;">結果</div>
          <div>全部棄票 / 無有效票</div>
        </div>
        <div class="card">
          <div style="font-weight:900;margin-bottom:6px;">投票明細（上帝）</div>
          <div style="line-height:1.8">${detailLines}</div>
        </div>
        <button class="primary" onclick="startDay('（本輪無處刑）')">回到白天</button>
      </section>
    `;
    injectMiniStyles();
    return;
  }

  const topCount = tally[0].count;
  const topSeats = tally.filter(x => x.count === topCount).map(x => x.seat);

  // 平票 → 重投（只限平票者）
  if (topSeats.length > 1) {
    Game.logs.push(`投票平票：${topSeats.join("、")}（${topCount} 票），進入重投（第 ${v.round} 輪）`);
    document.getElementById("main").innerHTML = `
      <section class="panel">
        <div class="tag">🗳️ 平票</div>

        <div class="card">
          <div style="font-weight:900;margin-bottom:6px;">平票名單</div>
          <div>${topSeats.join("、")} 號（${topCount} 票）</div>
        </div>

        <div class="card">
          <div style="font-weight:900;margin-bottom:6px;">投票明細（上帝）</div>
          <div style="line-height:1.8">${detailLines}</div>
        </div>

        <div class="row">
          <button class="primary" onclick="revote(${JSON.stringify(topSeats)})">平票重投</button>
          <button class="ghost" onclick="startDay('（平票未處刑）')">不重投，回白天</button>
        </div>
      </section>
    `;
    injectMiniStyles();
    return;
  }

  // 有唯一最高票
  const executedSeat = topSeats[0];
  Game.logs.push(`投票結果：${executedSeat} 號最高票（${topCount} 票），待確認處刑（第 ${v.round} 輪）`);

  document.getElementById("main").innerHTML = `
    <section class="panel">
      <div class="tag">🗳️ 投票結果</div>

      <div class="card">
        <div style="font-weight:900;margin-bottom:6px;">最高票</div>
        <div>${executedSeat} 號（${topCount} 票）</div>
      </div>

      <div class="card">
        <div style="font-weight:900;margin-bottom:6px;">票數統計</div>
        <div>
          ${tally.map(x => `• ${x.seat} 號：${x.count} 票`).join("<br>")}
        </div>
      </div>

      <div class="card">
        <div style="font-weight:900;margin-bottom:6px;">投票明細（上帝）</div>
        <div style="line-height:1.8">${detailLines}</div>
      </div>

      <div class="row">
        <button class="primary" onclick="confirmExecute(${executedSeat})">確認處刑</button>
        <button class="ghost" onclick="startDay('（取消處刑，回白天）')">取消</button>
      </div>
    </section>
  `;
  injectMiniStyles();
}

window.revote = function (candidates) {
  // 進入第 2 輪（重投）
  Game.vote = {
    round: Game.vote.round + 1,
    candidates,
    voterSeats: alivePlayers().map(p => p.seat),
    voterIndex: 0,
    votes: {},
    done: false
  };
  renderVoteStep();
};

window.confirmExecute = function (seat) {
  // 處刑死亡（reason=vote）
  killPlayer(seat, "vote");

  const aliveText = alivePlayers().map(p=>p.seat).join("、") || "無";
  Game.logs.push(`處刑：${seat} 號出局。存活：${aliveText}`);

  // 回到白天（或你要直接進夜晚也行）
  startDay(`處刑：${seat} 號出局`);
};

/* ======================
   死亡處理（處刑/夜晚/毒殺/自爆）
   - 白狼王：被票出（vote）可帶走一人
   - 黑狼王：非毒殺、非自爆，可帶走一人（被票出也可）
   - 獵人：死亡可開槍（此版：毒殺也可，若你要限制我再幫你加規則）
====================== */
function killPlayer(seat, reason) {
  const p = Game.players.find(x => x.seat === seat);
  if (!p || !p.alive) return;

  p.alive = false;

  const role = ROLES[p.roleId];

  // 觸發：白狼王（僅被票出）
  if (role.id === "whiteWolfKing" && reason === "vote") {
    return promptCarry(seat, "白狼王", "白狼王發動技能：帶走誰？", (target) => {
      killPlayer(target, "wolfKingClaw");
      Game.logs.push(`白狼王帶走：${target} 號`);
      startDay(`處刑結算完成（白狼王帶走 ${target} 號）`);
    });
  }

  // 觸發：黑狼王（非毒殺、非自爆）
  if (role.id === "blackWolfKing" && reason !== "poison" && reason !== "explode") {
    return promptCarry(seat, "黑狼王", "黑狼王發動【狼王之爪】：帶走誰？", (target) => {
      killPlayer(target, "wolfKingClaw");
      Game.logs.push(`黑狼王帶走：${target} 號`);
      startDay(`結算完成（黑狼王帶走 ${target} 號）`);
    });
  }

  // 觸發：獵人（任何死亡都可）
  if (role.id === "hunter") {
    return promptCarry(seat, "獵人", "獵人開槍：帶走誰？", (target) => {
      killPlayer(target, "hunterShot");
      Game.logs.push(`獵人帶走：${target} 號`);
      startDay(`結算完成（獵人帶走 ${target} 號）`);
    });
  }
}

/* 共同：選一個對象帶走（上帝操作） */
function promptCarry(fromSeat, title, msg, onPick) {
  const targets = alivePlayers()
    .map(p => p.seat)
    .filter(s => s !== fromSeat);

  document.getElementById("main").innerHTML = `
    <section class="panel">
      <div class="tag">⚡ ${title}技能</div>
      <h2 class="h2">${escapeHtml(msg)}</h2>
      <div class="seats">
        ${targets.map(s => `<button class="seat" onclick="carryPick(${s})">${s}</button>`).join("")}
      </div>
      <button class="ghost" onclick="startDay('（${title}選擇不帶人）')">不帶人</button>
    </section>
  `;

  window.carryPick = function (seat) {
    onPick(seat);
    delete window.carryPick;
  };

  injectMiniStyles();
}

/* ======================
   工具
====================== */
function alivePlayers() {
  return Game.players.filter(p => p.alive);
}

function buildRoleList(boardId, count) {
  const preset = PRESETS[boardId]?.[count];
  if (!preset) throw new Error("找不到預設配置");
  const list = [];
  for (const [roleId, qty] of Object.entries(preset)) {
    for (let i = 0; i < qty; i++) list.push(roleId);
  }
  if (list.length !== count) throw new Error("角色數量不等於玩家數");
  return shuffle(list);
}

function createPlayers(count, roles) {
  return Array.from({ length: count }, (_, i) => ({
    seat: i + 1,
    roleId: roles[i],
    alive: true,
    isChief: false,
    status: {}
  }));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

window.copyText = async function (txt) {
  try {
    await navigator.clipboard.writeText(txt);
    alert("已複製 ✅");
  } catch {
    alert("複製失敗（iOS 有時會限制，請長按自行複製）");
  }
};

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ======================
   內建小樣式（不改 style.css 也能像 App）
====================== */
let _miniInjected = false;
function injectMiniStyles(){
  if(_miniInjected) return;
  _miniInjected = true;
  const css = `
  .panel{padding:14px}
  .h2{margin:0 0 10px;font-size:22px}
  .h3{margin:0 0 8px;font-size:16px;opacity:.85}
  .hint{font-size:13px;opacity:.7;margin:6px 0}
  .tag{display:inline-block;padding:6px 10px;border-radius:999px;background:#fff;opacity:.85;font-size:12px;margin-bottom:10px}
  .grid{display:grid;grid-template-columns:1fr;gap:10px}
  .board-card{width:100%;text-align:left;border:0;border-radius:14px;padding:12px;background:#fff;box-shadow:0 3px 10px rgba(0,0,0,.08)}
  .board-card.active{outline:2px solid #5a0000}
  .board-title{font-weight:900;font-size:16px;margin-bottom:6px}
  .board-intro{font-size:13px;opacity:.8;margin-bottom:6px}
  .board-meta{font-size:12px;opacity:.65}
  .row{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
  .pill{border:0;border-radius:999px;padding:10px 12px;background:#eee}
  .pill.active{background:#5a0000;color:#fff}
  .primary{width:100%;border:0;border-radius:14px;padding:14px 12px;background:#5a0000;color:#fff;font-weight:800}
  .ghost{width:100%;border:1px solid #ddd;border-radius:14px;padding:12px;background:#fff}
  .card{background:#fff;border-radius:14px;padding:12px;box-shadow:0 3px 10px rgba(0,0,0,.06);margin-top:10px}
  .seats{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
  .seat{border:0;border-radius:12px;padding:12px 0;width:64px;background:#f0f0f0;font-weight:900}
  .seat-chip{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:14px;background:#f0f0f0;font-weight:900;border:0}
  .seat-chip.dead{opacity:.35;text-decoration:line-through}
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}