const ROLES = window.ROLES;
const BOARDS = window.BOARDS;

const Game = {
  boardId: "basic",
  board: null,
  players: [],
  phase: "setup", // setup | deal | night | day | police | speak | vote
  logs: [],
  settings: { playerCount: 9 },

  dealIndex: 0,

  night: {
    stepIndex: 0,
    steps: [],
    wolfTarget: null,
    guardTarget: null,
    seerTarget: null,
    seerResult: null,
    witchSave: false,
    witchPoisonTarget: null,
    witchSaveUsed: false,
    witchPoisonUsed: false
  },

  police: {
    candidates: new Set(),
    direction: "cw",
    order: [],
    speakIndex: 0
  },

  vote: {
    round: 1,
    candidates: null,
    voterSeats: [],
    voterIndex: 0,
    votes: {}
  }
};

window.Game = Game;

/* ======================
   底部浮窗計時器
====================== */
const Timer = { duration: 120, remain: 120, running: false, interval: null, preset: 120 };

window.setTimer = function(sec){
  Timer.preset = sec;
  Timer.duration = sec;
  Timer.remain = sec;
  updateTimerUI(true);
};
window.startTimer = function(){
  if (Timer.running) return;
  Timer.running = true;
  Timer.interval = setInterval(()=>{
    Timer.remain--;
    updateTimerUI(false);
    if (Timer.remain <= 0){
      Timer.remain = 0;
      stopTimer();
      updateTimerUI(false);
      if (navigator.vibrate) navigator.vibrate([200,100,200]);
      alert("⏰ 時間到");
    }
  }, 1000);
};
window.pauseTimer = function(){ stopTimer(); updateTimerUI(false); };
window.resetTimer = function(){ stopTimer(); Timer.remain = Timer.duration; updateTimerUI(false); };

function stopTimer(){
  Timer.running = false;
  if (Timer.interval) clearInterval(Timer.interval);
  Timer.interval = null;
}
function showTimer(){
  if (document.getElementById("speechTimer")) { updateTimerUI(true); return; }
  const el = document.createElement("div");
  el.id = "speechTimer";
  el.innerHTML = `
    <div class="timer-box">
      <div class="timer-time" id="timerTime">02:00</div>
      <div class="timer-presets">
        <button id="tp60" onclick="setTimer(60)">1分</button>
        <button id="tp120" onclick="setTimer(120)">2分</button>
        <button id="tp180" onclick="setTimer(180)">3分</button>
        <button id="tp300" onclick="setTimer(300)">5分</button>
      </div>
      <div class="timer-actions">
        <button onclick="startTimer()">▶︎</button>
        <button onclick="pauseTimer()">⏸</button>
        <button onclick="resetTimer()">⟲</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  updateTimerUI(true);
}
function hideTimer(){
  const el = document.getElementById("speechTimer");
  if (el) el.remove();
}
function updateTimerUI(refreshPreset){
  const el = document.getElementById("timerTime");
  if (!el) return;
  const m = String(Math.floor(Timer.remain/60)).padStart(2,"0");
  const s = String(Timer.remain%60).padStart(2,"0");
  el.textContent = `${m}:${s}`;
  el.classList.toggle("danger", Timer.remain <= 10 && Timer.remain > 0);

  if (refreshPreset){
    ["tp60","tp120","tp180","tp300"].forEach(id=>{
      const b = document.getElementById(id);
      if (!b) return;
      const sec = Number(id.replace("tp",""));
      b.classList.toggle("active", sec === Timer.preset);
    });
  }
}

/* ======================
   預設配置
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
   啟動與導覽
====================== */
document.addEventListener("DOMContentLoaded", () => {
  // 上帝模式切換
  const godBtn = document.getElementById("godToggle");
  godBtn.addEventListener("click", () => {
    document.body.classList.toggle("god");
  });

  // 底部導覽
  document.getElementById("btnHome").addEventListener("click", () => renderSetup(Game.boardId));
  document.getElementById("btnRoles").addEventListener("click", () => renderRoleBook());
  document.getElementById("btnLogs").addEventListener("click", () => renderLogs());

  renderSetup(Game.boardId);
});

/* ======================
   共用工具
====================== */
const $ = (id) => document.getElementById(id);
function alivePlayers(){ return Game.players.filter(p=>p.alive); }
function hasAliveRole(roleId){ return Game.players.some(p=>p.alive && p.roleId===roleId); }
function seatOfAliveRole(roleId){ return Game.players.find(p=>p.alive && p.roleId===roleId)?.seat ?? null; }
function escapeHtml(s){ return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }
function shuffle(arr){
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
function buildRoleList(boardId, count){
  const preset = PRESETS[boardId]?.[count];
  const list=[];
  for(const [id,n] of Object.entries(preset)){
    for(let i=0;i<n;i++) list.push(id);
  }
  return shuffle(list);
}
function createPlayers(count, roleList){
  return Array.from({length:count},(_,i)=>({ seat:i+1, roleId:roleList[i], alive:true }));
}

/* ======================
   Setup：選板子/人數/開始
====================== */
window.selectBoard = (id)=> renderSetup(id);
window.setPlayerCount = (n)=>{ Game.settings.playerCount=n; renderSetup(Game.boardId); };

function renderSetup(boardId){
  hideTimer();
  Game.phase="setup";
  Game.boardId=boardId;
  Game.board=BOARDS[boardId];

  const counts = Game.board.players;
  if(!counts.includes(Game.settings.playerCount)) Game.settings.playerCount=counts[0];

  const boardsHtml = Object.values(BOARDS).map(b=>`
    <button class="board-card ${b.id===boardId?"active":""}" onclick="selectBoard('${b.id}')">
      <div class="board-title">${b.name}</div>
      <div class="board-intro">${b.intro}</div>
      <div class="board-meta">人數 ${b.players.join("–")} ・ 女巫自救 ${b.rules.witchSelfSave==="forbidden"?"不可":"可"}</div>
    </button>
  `).join("");

  const countsHtml = counts.map(n=>`
    <button class="btn pill ${n===Game.settings.playerCount?"active":""}" onclick="setPlayerCount(${n})">${n} 人</button>
  `).join("");

  $("main").innerHTML = `
    <section class="panel">
      <h2 class="h2">請選擇板子開始遊戲</h2>
      <div class="grid">${boardsHtml}</div>
    </section>

    <section class="panel">
      <div class="card">
        <h3 class="h3">玩家人數</h3>
        <div class="row">${countsHtml}</div>
      </div>
    </section>

    <section class="panel">
      <div class="card">
        <h3 class="h3">預設角色配置</h3>
        <div class="hint">${presetSummary(boardId, Game.settings.playerCount)}</div>
        <div class="row">
          <button class="btn primary" onclick="startDeal()">開始抽牌</button>
        </div>
      </div>
    </section>
  `;
}

function presetSummary(boardId,count){
  const preset = PRESETS[boardId]?.[count];
  if(!preset) return `⚠️ 無 ${count} 人配置`;
  return Object.entries(preset).filter(([,v])=>v>0).map(([id,v])=>`${ROLES[id].name}×${v}`).join("、");
}

/* ======================
   角色圖鑑 / 紀錄
====================== */
function renderRoleBook(){
  hideTimer();
  const items = Object.values(ROLES).map(r=>`
    <div class="card" style="margin-bottom:10px">
      <div style="font-weight:1000">${r.name}</div>
      <div class="hint">${escapeHtml(r.skill)}</div>
    </div>
  `).join("");

  $("main").innerHTML = `
    <section class="panel">
      <h2 class="h2">📖 角色圖鑑</h2>
      ${items}
    </section>
  `;
}

function renderLogs(){
  hideTimer();
  const list = Game.logs.length ? Game.logs.slice().reverse().map(x=>`<div class="card" style="margin-bottom:10px">${escapeHtml(x)}</div>`).join("")
                              : `<div class="card">尚無紀錄</div>`;
  $("main").innerHTML = `
    <section class="panel">
      <h2 class="h2">📜 紀錄</h2>
      ${list}
    </section>
  `;
}

/* ======================
   抽牌
====================== */
window.startDeal = function(){
  const roleList = buildRoleList(Game.boardId, Game.settings.playerCount);
  Game.players = createPlayers(Game.settings.playerCount, roleList);
  Game.dealIndex=0;
  Game.phase="deal";
  renderDeal();
};

function renderDeal(){
  hideTimer();
  const p = Game.players[Game.dealIndex];
  $("main").innerHTML = `
    <section class="panel">
      <div class="card">
        <div class="tag">🎴 抽牌</div>
        <h2 class="h2">請 ${p.seat} 號查看身分</h2>
        <p class="hint">看完交給下一位</p>
        <div class="row">
          <button class="btn primary" onclick="showRole()">查看身分</button>
          <button class="btn ghost" onclick="renderSetup('${Game.boardId}')">返回選板子</button>
        </div>
      </div>
    </section>
  `;
}

window.showRole = function(){
  const p = Game.players[Game.dealIndex];
  const r = ROLES[p.roleId];
  alert(`你是【${r.name}】\n\n${r.skill}`);
  Game.dealIndex++;
  if(Game.dealIndex >= Game.players.length) startNight();
  else renderDeal();
};

/* ======================
   ✅ 完整夜晚流程：守衛→狼人→預言→女巫（救/毒/自救規則）
====================== */
function startNight(){
  hideTimer();
  Game.phase="night";

  Game.night.stepIndex=0;
  Game.night.steps = [];
  Game.night.wolfTarget=null;
  Game.night.guardTarget=null;
  Game.night.seerTarget=null;
  Game.night.seerResult=null;
  Game.night.witchSave=false;
  Game.night.witchPoisonTarget=null;

  // 步驟依本局有的角色
  if (hasAliveRole("guard")) Game.night.steps.push("guard");
  if (hasAliveRole("werewolf") || hasAliveRole("whiteWolfKing") || hasAliveRole("blackWolfKing")) Game.night.steps.push("werewolf");
  if (hasAliveRole("seer")) Game.night.steps.push("seer");
  if (hasAliveRole("witch")) Game.night.steps.push("witch");

  renderNightStep();
}

window.skipNightStep = function(){
  Game.night.stepIndex++;
  renderNightStep();
};

function renderNightStep(){
  const step = Game.night.steps[Game.night.stepIndex];
  if (!step) return resolveNight();

  const title = { guard:"守衛", werewolf:"狼人", seer:"預言家", witch:"女巫" }[step] || step;
  const script = {
    guard:"請說：守衛請睜眼，你要守誰？",
    werewolf:"請說：狼人請睜眼，你們要刀誰？",
    seer:"請說：預言家請睜眼，你要查驗誰？",
    witch:"請說：女巫請睜眼。"
  }[step] || "";

  $("main").innerHTML = `
    <section class="panel">
      <div class="card">
        <div class="tag">🌙 夜晚 ${Game.night.stepIndex+1}/${Game.night.steps.length}</div>
        <h2 class="h2">${title}行動</h2>
        ${script ? `<div class="script">${script}</div>` : ""}
        <div id="stepBody"></div>
        <div class="row">
          <button class="btn ghost" onclick="skipNightStep()">跳過此步驟</button>
        </div>
      </div>
    </section>
  `;

  if (step === "guard") pickTarget("stepBody", "守誰？", "guardTarget", { allowNone:true });
  else if (step === "werewolf") pickTarget("stepBody", "刀誰？", "wolfTarget", { allowNone:true });
  else if (step === "seer") pickTarget("stepBody", "驗誰？", "seerTarget", { reveal:true });
  else if (step === "witch") renderWitch("stepBody");
}

function pickTarget(containerId, title, key, opt={}){
  const alive = alivePlayers().map(p=>p.seat);
  const buttons = alive.map(s=>`<button class="seat" onclick="confirmNightTarget('${key}',${s},${opt.reveal?1:0})">${s}</button>`).join("");

  $(containerId).innerHTML = `
    <p class="hint">${title}</p>
    <div class="seats">${buttons}</div>
    ${opt.allowNone ? `<div class="row"><button class="btn ghost" onclick="confirmNightTarget('${key}',null,0)">不使用/略過</button></div>` : ""}
  `;
}

window.confirmNightTarget = function(key, seat, revealFlag){
  Game.night[key] = seat;

  if (key === "seerTarget" && seat != null && revealFlag){
    const target = Game.players.find(p=>p.seat===seat);
    const team = (ROLES[target.roleId]?.team === "wolf") ? "狼人" : "好人";
    Game.night.seerResult = team;
    alert(`查驗結果：${seat} 號是【${team}】`);
    Game.logs.push(`（上帝）預言查驗 ${seat}：${team}`);
  }

  Game.night.stepIndex++;
  renderNightStep();
};

function renderWitch(containerId){
  const wolfTarget = Game.night.wolfTarget;
  const witchSeat = seatOfAliveRole("witch");
  const rule = Game.board.rules.witchSelfSave;

  const cannotSelfSave = wolfTarget && witchSeat && wolfTarget===witchSeat && rule==="forbidden";
  const saveDisabled = Game.night.witchSaveUsed || !wolfTarget || cannotSelfSave;
  const poisonDisabled = Game.night.witchPoisonUsed;

  $(containerId).innerHTML = `
    <p class="hint">今晚被刀：<b>${wolfTarget ? wolfTarget+" 號" : "無"}</b></p>
    ${cannotSelfSave ? `<div class="warn">本板子規則：女巫不可自救（解藥鎖定）</div>` : ""}

    <div class="row">
      <button class="btn primary" ${saveDisabled?"disabled":""} onclick="witchUseSave()">
        ${Game.night.witchSaveUsed ? "解藥已用" : "用解藥"}
      </button>
      <button class="btn primary" ${poisonDisabled?"disabled":""} onclick="witchPickPoison()">
        ${Game.night.witchPoisonUsed ? "毒藥已用" : "用毒藥"}
      </button>
      <button class="btn ghost" onclick="skipNightStep()">不用</button>
    </div>
  `;
}

window.witchUseSave = function(){
  Game.night.witchSave=true;
  Game.night.witchSaveUsed=true;
  Game.logs.push(`（上帝）女巫使用解藥`);
  Game.night.stepIndex++;
  renderNightStep();
};

window.witchPickPoison = function(){
  // 選毒目標
  pickTarget("stepBody","毒誰？","witchPoisonTarget",{ allowNone:true });

  const old = window.confirmNightTarget;
  window.confirmNightTarget = function(key, seat){
    Game.night[key]=seat;
    if (key==="witchPoisonTarget" && seat!=null){
      Game.night.witchPoisonUsed=true;
      Game.logs.push(`（上帝）女巫毒 ${seat} 號`);
    }
    window.confirmNightTarget = old;
    Game.night.stepIndex++;
    renderNightStep();
  };
};

function resolveNight(){
  const deaths = new Map(); // seat -> reason

  // 狼刀（可能被守/救擋）
  if (Game.night.wolfTarget != null){
    const blockedByGuard = (Game.night.guardTarget != null && Game.night.guardTarget === Game.night.wolfTarget);
    const blockedBySave = (Game.night.witchSave === true);
    if (!blockedByGuard && !blockedBySave) deaths.set(Game.night.wolfTarget, "night");
  }

  // 毒藥（優先）
  if (Game.night.witchPoisonTarget != null){
    deaths.set(Game.night.witchPoisonTarget, "poison");
  }

  for (const [seat, reason] of deaths.entries()){
    killPlayer(seat, reason);
  }

  const list = [...deaths.keys()];
  const announce = `天亮了，昨晚死亡的是：${list.length ? list.join("、")+" 號" : "沒有人"}`;
  Game.logs.push(announce);
  startDay(announce);
}

/* ======================
   白天：上帝看身分 + 上警 + 投票入口 + 計時器顯示
====================== */
function startDay(announce){
  Game.phase="day";
  Game.police = { candidates:new Set(), direction:"cw", order:[], speakIndex:0 };

  $("main").innerHTML = `
    <section class="panel">
      <div class="card">
        <div class="tag">☀️ 白天</div>
        <h2 class="h2">白天流程</h2>
        <div class="card" style="margin-top:10px">
          <div style="font-weight:1000;margin-bottom:6px;">公告</div>
          <div>${escapeHtml(announce)}</div>
        </div>

        <div class="card" style="margin-top:10px">
          <div style="font-weight:1000;margin-bottom:6px;">👥 座位（上帝可點看身分）</div>
          <div class="seats">
            ${Game.players.map(p=>`
              <button class="seat-chip ${p.alive?"":"dead"}" onclick="godPeek(${p.seat})" ${p.alive?"":"disabled"}>${p.seat}</button>
            `).join("")}
          </div>
          <div class="hint">上帝模式（右上角開啟）才會跳出身分</div>
        </div>

        <div class="row" style="margin-top:10px">
          <button class="btn primary" onclick="startPolice()">🚨 開始上警</button>
          <button class="btn ghost" onclick="startVote()">🗳️ 直接投票</button>
          <button class="btn ghost" onclick="startNight()">🌙 進入下一夜</button>
        </div>
      </div>
    </section>
  `;

  showTimer();
}

window.godPeek = function(seat){
  if (!document.body.classList.contains("god")) return;
  const p = Game.players.find(x=>x.seat===seat);
  if (!p) return;
  const r = ROLES[p.roleId];
  alert(`👁️ ${seat} 號\n角色：${r.name}\n\n${r.skill}`);
};

/* ======================
   上警 + 發言順序（順/逆/隨機）
====================== */
window.startPolice = function(){
  Game.phase="police";
  showTimer();

  const seats = alivePlayers().map(p=>p.seat);
  $("main").innerHTML = `
    <section class="panel">
      <div class="card">
        <div class="tag">🚨 上警</div>
        <h2 class="h2">點選上警玩家</h2>

        <div class="seats">
          ${seats.map(s=>`<button class="seat-chip" onclick="togglePolice(${s})">${s}</button>`).join("")}
        </div>

        <div class="card" style="margin-top:10px">
          <div style="font-weight:1000;margin-bottom:6px;">上警名單</div>
          <div id="policeList" class="hint">（尚未選擇）</div>
        </div>

        <div class="card" style="margin-top:10px">
          <div style="font-weight:1000;margin-bottom:6px;">發言方向</div>
          <div class="row">
            <button class="btn pill active" id="dir-cw" onclick="setSpeakDir('cw')">順時針</button>
            <button class="btn pill" id="dir-ccw" onclick="setSpeakDir('ccw')">逆時針</button>
            <button class="btn pill" id="dir-rand" onclick="setSpeakDir('rand')">隨機</button>
          </div>
        </div>

        <div class="row" style="margin-top:10px">
          <button class="btn primary" onclick="generateSpeakOrder()">生成發言順序</button>
          <button class="btn ghost" onclick="startDay('（取消上警）')">返回白天</button>
        </div>
      </div>
    </section>
  `;
  refreshPoliceList();
};

window.togglePolice = function(seat){
  if (Game.police.candidates.has(seat)) Game.police.candidates.delete(seat);
  else Game.police.candidates.add(seat);
  refreshPoliceList();
};

function refreshPoliceList(){
  const el = document.getElementById("policeList");
  if(!el) return;
  const list = [...Game.police.candidates].sort((a,b)=>a-b);
  el.textContent = list.length ? (list.join("、")+" 號") : "（尚未選擇）";
}

window.setSpeakDir = function(dir){
  Game.police.direction = dir;
  ["cw","ccw","rand"].forEach(d=>{
    const btn = document.getElementById("dir-"+d);
    if(btn) btn.classList.toggle("active", d===dir);
  });
};

window.generateSpeakOrder = function(){
  const list = [...Game.police.candidates].sort((a,b)=>a-b);
  if (!list.length){ alert("請先選擇上警名單"); return; }

  let order = [];
  if (Game.police.direction==="rand") order = shuffle(list);
  else {
    order = [...list];
    if (Game.police.direction==="ccw") order.reverse();
  }

  Game.police.order = order;
  Game.police.speakIndex = 0;
  renderSpeaking();
};

window.nextSpeaker = function(){
  Game.police.speakIndex++;
  renderSpeaking();
};

function renderSpeaking(){
  Game.phase="speak";
  showTimer();

  const order = Game.police.order;
  const i = Game.police.speakIndex;

  if (i >= order.length){
    Game.logs.push(`上警發言完成：${order.join("→")}`);
    startDay("（上警發言結束）可開始投票");
    return;
  }

  const seat = order[i];
  $("main").innerHTML = `
    <section class="panel">
      <div class="card">
        <div class="tag">🎤 上警發言</div>
        <h2 class="h2">下一位：${seat} 號</h2>
        <div class="hint">底部計時器可直接開始計時</div>

        <div class="card" style="margin-top:10px">
          <div style="font-weight:1000;margin-bottom:6px;">順序</div>
          <div>${order.map((s,idx)=> idx===i ? `<b>👉 ${s}</b>` : `${s}`).join(" ・ ")}</div>
        </div>

        <div class="row" style="margin-top:10px">
          <button class="btn primary" onclick="nextSpeaker()">下一位</button>
          <button class="btn ghost" onclick="startVote()">直接投票</button>
          <button class="btn ghost" onclick="startDay('（中止上警）')">返回白天</button>
        </div>
      </div>
    </section>
  `;
}

/* ======================
   投票（逐一點票 + 平票重投 + 處刑觸發）
====================== */
window.startVote = function(){
  Game.phase="vote";
  showTimer();

  Game.vote = {
    round: 1,
    candidates: null,
    voterSeats: alivePlayers().map(p=>p.seat),
    voterIndex: 0,
    votes: {}
  };
  renderVoteStep();
};

window.castVote = function(voter, target){
  const v = Game.vote;
  v.votes[voter] = target;
  v.voterIndex++;
  if (v.voterIndex >= v.voterSeats.length) renderVoteResult();
  else renderVoteStep();
};

function renderVoteStep(){
  showTimer();
  const v = Game.vote;
  const voter = v.voterSeats[v.voterIndex];
  const aliveSeats = alivePlayers().map(p=>p.seat);
  const candidates = v.candidates ? v.candidates : aliveSeats;
  const targets = candidates.filter(s=>s!==voter);

  $("main").innerHTML = `
    <section class="panel">
      <div class="card">
        <div class="tag">🗳️ 投票第 ${v.round} 輪</div>
        <h2 class="h2">請 ${voter} 號投票</h2>
        <div class="hint">${v.candidates ? `本輪只可投：${v.candidates.join("、")} 號` : "可投任一存活玩家"}</div>

        <div class="seats">
          ${targets.map(s=>`<button class="seat" onclick="castVote(${voter},${s})">${s}</button>`).join("")}
        </div>

        <div class="row" style="margin-top:10px">
          <button class="btn ghost" onclick="castVote(${voter},null)">棄票</button>
          <button class="btn ghost" onclick="startDay('（取消投票）')">取消返回白天</button>
        </div>

        <div class="card" style="margin-top:10px">
          <div style="font-weight:1000;margin-bottom:6px;">進度</div>
          <div>${v.voterIndex} / ${v.voterSeats.length}</div>
        </div>
      </div>
    </section>
  `;
}

function tallyVotes(votes, limit=null){
  const m = new Map();
  for (const t of Object.values(votes)){
    if (t===null) continue;
    if (limit && !limit.includes(t)) continue;
    m.set(t, (m.get(t)||0)+1);
  }
  return [...m.entries()].map(([seat,count])=>({seat, count})).sort((a,b)=>b.count-a.count);
}

window.revote = function(cands){
  Game.vote = {
    round: Game.vote.round + 1,
    candidates: cands,
    voterSeats: alivePlayers().map(p=>p.seat),
    voterIndex: 0,
    votes: {}
  };
  renderVoteStep();
};

window.confirmExecute = function(seat){
  killPlayer(seat, "vote");
  Game.logs.push(`處刑：${seat} 號出局`);
  startDay(`處刑：${seat} 號出局`);
};

function renderVoteResult(){
  showTimer();
  const v = Game.vote;
  const tally = tallyVotes(v.votes, v.candidates);
  const detail = v.voterSeats.map(s=>{
    const t=v.votes[s];
    return `${s}→${t===null?"棄票":t+"號"}`;
  }).join("<br>");

  if (!tally.length){
    Game.logs.push(`投票：全棄票/無效（第${v.round}輪）`);
    $("main").innerHTML = `
      <section class="panel">
        <div class="card">
          <div class="tag">🗳️ 結果</div>
          <h2 class="h2">無有效票</h2>
          <div class="card" style="margin-top:10px">全部棄票 / 無有效票</div>
          <div class="card" style="margin-top:10px"><b>明細（上帝）</b><div class="hint" style="margin-top:6px">${detail}</div></div>
          <div class="row" style="margin-top:10px">
            <button class="btn primary" onclick="startDay('（本輪無處刑）')">回白天</button>
          </div>
        </div>
      </section>
    `;
    return;
  }

  const top = tally[0].count;
  const topSeats = tally.filter(x=>x.count===top).map(x=>x.seat);

  if (topSeats.length>1){
    Game.logs.push(`平票：${topSeats.join("、")}（${top}票）`);
    $("main").innerHTML = `
      <section class="panel">
        <div class="card">
          <div class="tag">🗳️ 平票</div>
          <h2 class="h2">平票名單：${topSeats.join("、")}（${top}票）</h2>
          <div class="card" style="margin-top:10px"><b>明細（上帝）</b><div class="hint" style="margin-top:6px">${detail}</div></div>
          <div class="row" style="margin-top:10px">
            <button class="btn primary" onclick="revote(${JSON.stringify(topSeats)})">平票重投</button>
            <button class="btn ghost" onclick="startDay('（平票不處刑）')">回白天</button>
          </div>
        </div>
      </section>
    `;
    return;
  }

  const executed = topSeats[0];
  $("main").innerHTML = `
    <section class="panel">
      <div class="card">
        <div class="tag">🗳️ 結果</div>
        <h2 class="h2">${executed} 號最高票（${top}票）</h2>
        <div class="card" style="margin-top:10px"><b>統計</b><div class="hint" style="margin-top:6px">${tally.map(x=>`• ${x.seat}號：${x.count}票`).join("<br>")}</div></div>
        <div class="card" style="margin-top:10px"><b>明細（上帝）</b><div class="hint" style="margin-top:6px">${detail}</div></div>
        <div class="row" style="margin-top:10px">
          <button class="btn primary" onclick="confirmExecute(${executed})">確認處刑</button>
          <button class="btn ghost" onclick="startDay('（取消處刑）')">回白天</button>
        </div>
      </div>
    </section>
  `;
}

/* ======================
   死亡與技能（獵人/白狼王/黑狼王）
====================== */
function killPlayer(seat, reason){
  const p = Game.players.find(x=>x.seat===seat);
  if (!p || !p.alive) return;
  p.alive=false;

  const role = ROLES[p.roleId];

  // 白狼王：僅 vote 觸發
  if (role.id==="whiteWolfKing" && reason==="vote"){
    return promptCarry(seat, "白狼王", "白狼王帶走誰？", (t)=>{
      killPlayer(t,"claw");
      Game.logs.push(`白狼王帶走：${t} 號`);
      startDay(`結算完成（白狼王帶走 ${t} 號）`);
    });
  }

  // 黑狼王：非毒殺、非自爆
  if (role.id==="blackWolfKing" && reason!=="poison" && reason!=="explode"){
    return promptCarry(seat, "黑狼王", "黑狼王【狼王之爪】帶走誰？", (t)=>{
      killPlayer(t,"claw");
      Game.logs.push(`黑狼王帶走：${t} 號`);
      startDay(`結算完成（黑狼王帶走 ${t} 號）`);
    });
  }

  // 獵人：死亡可開槍（這版不限制毒殺，你要限制我再加）
  if (role.id==="hunter"){
    return promptCarry(seat, "獵人", "獵人開槍帶走誰？", (t)=>{
      killPlayer(t,"shot");
      Game.logs.push(`獵人帶走：${t} 號`);
      startDay(`結算完成（獵人帶走 ${t} 號）`);
    });
  }
}

function promptCarry(fromSeat, title, msg, onPick){
  hideTimer(); // 技能結算先清爽
  const targets = alivePlayers().map(p=>p.seat).filter(s=>s!==fromSeat);

  $("main").innerHTML = `
    <section class="panel">
      <div class="card">
        <div class="tag">⚡ ${title}技能</div>
        <h2 class="h2">${escapeHtml(msg)}</h2>
        <div class="seats">
          ${targets.map(s=>`<button class="seat" onclick="carryPick(${s})">${s}</button>`).join("")}
        </div>
        <div class="row" style="margin-top:10px">
          <button class="btn ghost" onclick="startDay('（${title}選擇不帶人）')">不帶人</button>
        </div>
      </div>
    </section>
  `;

  window.carryPick = function(seat){
    onPick(seat);
    delete window.carryPick;
  };
}