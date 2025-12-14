// 使用全域資料（不使用 import，GitHub Pages / iOS 最穩）
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

  night: { wolfTarget: null },

  police: {
    candidates: new Set(), // 上警名單
    direction: "cw",       // cw | ccw | rand
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

/* ========= 預設配置 ========= */
const PRESETS = {
  basic: {
    9:  { werewolf:2, villager:5, seer:1, witch:1 },
    10: { werewolf:3, villager:5, seer:1, witch:1 },
    11: { werewolf:3, villager:5, seer:1, witch:1, hunter:1 },
    12: { werewolf:3, villager:5, seer:1, witch:1, hunter:1, guard:1 }
  },
  wolfKings: {
    10: { werewolf:2, whiteWolfKing:1, blackWolfKing:1, villager:4, seer:1, witch:1 },
    11: { werewolf:2, whiteWolfKing:1, blackWolfKing:1, villager:5, seer:1, witch:1 },
    12: { werewolf:2, whiteWolfKing:1, blackWolfKing:1, villager:6, seer:1, witch:1 }
  }
};

/* ========= 啟動 ========= */
document.addEventListener("DOMContentLoaded", () => {
  renderSetup(Game.boardId);
  injectMiniStyles();
});

/* ========= 共用工具 ========= */
const $ = (id) => document.getElementById(id);

function alivePlayers() { return Game.players.filter(p=>p.alive); }
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
  if(!preset) throw new Error("沒有此人數預設配置");
  const list=[];
  for(const [id,n] of Object.entries(preset)){
    for(let i=0;i<n;i++) list.push(id);
  }
  if(list.length!==count) throw new Error("角色數量不等於玩家數");
  return shuffle(list);
}

function createPlayers(count, roleList){
  return Array.from({length:count},(_,i)=>({
    seat:i+1,
    roleId: roleList[i],
    alive:true
  }));
}

/* ========= Setup：選板子/人數/開始 ========= */
window.selectBoard = (id)=> renderSetup(id);
window.setPlayerCount = (n)=>{ Game.settings.playerCount=n; renderSetup(Game.boardId); };

function renderSetup(boardId){
  Game.phase="setup";
  Game.boardId=boardId;
  Game.board=BOARDS[boardId];

  const counts = Game.board.players || [9,10,11,12];
  if(!counts.includes(Game.settings.playerCount)) Game.settings.playerCount=counts[0];

  const boardsHtml = Object.values(BOARDS).map(b=>`
    <button class="board-card ${b.id===boardId?"active":""}" onclick="selectBoard('${b.id}')">
      <div class="board-title">${b.name}</div>
      <div class="board-intro">${b.intro||""}</div>
      <div class="board-meta">人數 ${b.players.join("–")} ・ 女巫自救 ${b.rules?.witchSelfSave==="forbidden"?"不可":"可"}</div>
    </button>
  `).join("");

  const countsHtml = counts.map(n=>`
    <button class="pill ${n===Game.settings.playerCount?"active":""}" onclick="setPlayerCount(${n})">${n} 人</button>
  `).join("");

  const roleSummary = presetSummary(boardId, Game.settings.playerCount);

  $("main").innerHTML = `
    <section class="panel">
      <h2 class="h2">請選擇板子開始遊戲</h2>
      <div class="grid">${boardsHtml}</div>
    </section>

    <section class="panel">
      <h3 class="h3">玩家人數</h3>
      <div class="row">${countsHtml}</div>
    </section>

    <section class="panel">
      <h3 class="h3">預設角色配置</h3>
      <div class="card">${roleSummary}</div>
      <button class="primary" onclick="startDeal()">開始抽牌</button>
    </section>
  `;
}

function presetSummary(boardId,count){
  const preset = PRESETS[boardId]?.[count];
  if(!preset) return `⚠️ 無 ${count} 人配置`;
  return Object.entries(preset).filter(([,v])=>v>0).map(([id,v])=>`${ROLES[id].name}×${v}`).join("、");
}

/* ========= 抽牌 ========= */
window.startDeal = function(){
  const roleList = buildRoleList(Game.boardId, Game.settings.playerCount);
  Game.players = createPlayers(Game.settings.playerCount, roleList);
  Game.dealIndex=0;
  Game.phase="deal";
  renderDeal();
};

function renderDeal(){
  const p = Game.players[Game.dealIndex];
  $("main").innerHTML = `
    <section class="panel">
      <div class="tag">🎴 抽牌</div>
      <h2 class="h2">請 ${p.seat} 號查看身分</h2>
      <div class="hint">看完交給下一位</div>
      <button class="primary" onclick="showRole()">查看身分</button>
      <button class="ghost" onclick="renderSetup('${Game.boardId}')">返回選板子</button>
    </section>
  `;
}

window.showRole = function(){
  const p=Game.players[Game.dealIndex];
  const r=ROLES[p.roleId];
  alert(`你是【${r.name}】\n\n${r.skill}`);
  Game.dealIndex++;
  if(Game.dealIndex>=Game.players.length) startNight();
  else renderDeal();
};

/* ========= 夜晚（先穩定版：狼人刀人） ========= */
function startNight(){
  Game.phase="night";
  Game.night.wolfTarget=null;

  $("main").innerHTML=`
    <section class="panel">
      <div class="tag">🌙 夜晚</div>
      <h2 class="h2">狼人刀誰？</h2>
      <div class="seats">
        ${alivePlayers().map(p=>`<button class="seat" onclick="nightWolfPick(${p.seat})">${p.seat}</button>`).join("")}
      </div>
      <button class="ghost" onclick="nightWolfPick(null)">平安夜（不刀）</button>
    </section>
  `;
}

window.nightWolfPick = function(seat){
  Game.night.wolfTarget = seat;
  resolveNight();
};

function resolveNight(){
  const deaths=[];
  if(Game.night.wolfTarget) deaths.push(Game.night.wolfTarget);
  deaths.forEach(s=> killPlayer(s,"night"));

  const txt = `天亮了，昨晚死亡的是：${deaths.length?deaths.join("、")+" 號":"沒有人"}`;
  Game.logs.push(txt);
  startDay(txt);
}

/* ========= 白天（上警＋發言順序＋投票入口） ========= */
function startDay(announce){
  Game.phase="day";
  Game.police = { candidates:new Set(), direction:"cw", order:[], speakIndex:0 };

  $("main").innerHTML=`
    <section class="panel">
      <div class="tag">☀️ 白天</div>

      <div class="card">
        <div style="font-weight:900;margin-bottom:6px;">公告</div>
        <div>${escapeHtml(announce)}</div>
        <div class="row" style="margin-top:10px;">
          <button class="ghost" onclick="startNight()">進入下一夜</button>
          <button class="ghost" onclick="startVote()">直接投票</button>
        </div>
      </div>

      <div class="card">
        <div style="font-weight:900;margin-bottom:6px;">👥 座位（上帝模式可點查看身分）</div>
        <div class="seats">
          ${Game.players.map(p=>`
            <button class="seat-chip ${p.alive?"":"dead"}"
              onclick="godPeek(${p.seat})" ${p.alive?"":"disabled"}>${p.seat}</button>
          `).join("")}
        </div>
        <div class="hint">上帝模式（👁️）才會跳出身分</div>
      </div>

      <div class="card">
        <div style="font-weight:900;margin-bottom:6px;">🚨 上警</div>
        <div class="hint">點選上警玩家，再生成發言順序</div>
        <button class="primary" onclick="startPolice()">開始上警</button>
      </div>
    </section>
  `;
}

/* ========= 上帝點座位看身分 ========= */
window.godPeek = function(seat){
  if(!document.body.classList.contains("god")) return;
  const p = Game.players.find(x=>x.seat===seat);
  if(!p) return;
  const r = ROLES[p.roleId];
  alert(`👁️ ${seat} 號\n角色：${r.name}\n\n${r.skill}`);
};

/* ========= 上警流程 ========= */
window.startPolice = function(){
  Game.phase="police";
  const seats = alivePlayers().map(p=>p.seat);

  $("main").innerHTML=`
    <section class="panel">
      <div class="tag">🚨 上警</div>
      <h2 class="h2">請點選上警的玩家</h2>

      <div class="seats">
        ${seats.map(s=>`<button class="seat-chip" onclick="togglePolice(${s})">${s}</button>`).join("")}
      </div>

      <div class="card">
        <div style="font-weight:900;margin-bottom:6px;">上警名單</div>
        <div id="policeList" class="hint">（尚未選擇）</div>
      </div>

      <div class="card">
        <div style="font-weight:900;margin-bottom:6px;">發言方向</div>
        <div class="row">
          <button class="pill active" id="dir-cw" onclick="setSpeakDir('cw')">順時針</button>
          <button class="pill" id="dir-ccw" onclick="setSpeakDir('ccw')">逆時針</button>
          <button class="pill" id="dir-rand" onclick="setSpeakDir('rand')">隨機</button>
        </div>
      </div>

      <button class="primary" onclick="generateSpeakOrder()">生成發言順序</button>
      <button class="ghost" onclick="startDay('（已取消上警）')">取消返回白天</button>
    </section>
  `;
  refreshPoliceList();
};

window.togglePolice = function(seat){
  if(Game.police.candidates.has(seat)) Game.police.candidates.delete(seat);
  else Game.police.candidates.add(seat);
  refreshPoliceList();
};

function refreshPoliceList(){
  const el = document.getElementById("policeList");
  if(!el) return;
  const list = [...Game.police.candidates].sort((a,b)=>a-b);
  el.innerHTML = list.length ? list.join("、")+" 號" : "（尚未選擇）";
}

window.setSpeakDir = function(dir){
  Game.police.direction=dir;
  ["cw","ccw","rand"].forEach(d=>{
    const btn=document.getElementById(`dir-${d}`);
    if(btn) btn.classList.toggle("active", d===dir);
  });
};

window.generateSpeakOrder = function(){
  const list = [...Game.police.candidates].sort((a,b)=>a-b);
  if(list.length===0){
    alert("請先選擇上警名單");
    return;
  }

  let order = [];
  if(Game.police.direction==="rand"){
    order = shuffle(list);
  } else {
    // 順/逆：以「名單最小號」當起點（你也可以改成指定起點）
    order = [...list];
    if(Game.police.direction==="ccw") order.reverse();
  }

  Game.police.order = order;
  Game.police.speakIndex = 0;
  startSpeaking();
};

/* ========= 發言順序（一步一步提示下一位） ========= */
function startSpeaking(){
  Game.phase="speak";
  renderSpeaking();
}

window.nextSpeaker = function(){
  Game.police.speakIndex++;
  renderSpeaking();
};

function renderSpeaking(){
  const order = Game.police.order;
  const i = Game.police.speakIndex;

  if(i >= order.length){
    // 發言結束 → 回白天，準備投票
    Game.logs.push(`上警發言完成：${order.join("→")}`);
    startDay(`（上警發言結束）可開始投票`);
    return;
  }

  const seat = order[i];
  $("main").innerHTML=`
    <section class="panel">
      <div class="tag">🎤 上警發言</div>
      <h2 class="h2">下一位發言：${seat} 號</h2>
      <div class="hint">可搭配白天倒數計時器（你要我加回來我也能直接塞）</div>

      <div class="card">
        <div style="font-weight:900;margin-bottom:6px;">順序</div>
        <div>${order.map((s,idx)=> idx===i ? `<b>👉 ${s}</b>` : `${s}`).join(" ・ ")}</div>
      </div>

      <button class="primary" onclick="nextSpeaker()">下一位</button>
      <button class="ghost" onclick="startVote()">直接進投票</button>
      <button class="ghost" onclick="startDay('（中止上警發言）')">返回白天</button>
    </section>
  `;
}

/* ========= 投票（逐一點票 + 平票重投 + 處刑觸發） ========= */
window.startVote = function(){
  Game.phase="vote";
  Game.vote = {
    round: 1,
    candidates: null,
    voterSeats: alivePlayers().map(p=>p.seat),
    voterIndex: 0,
    votes: {}
  };
  renderVoteStep();
};

function renderVoteStep(){
  const v=Game.vote;
  const voter = v.voterSeats[v.voterIndex];
  const aliveSeats = alivePlayers().map(p=>p.seat);
  const candidates = v.candidates ? v.candidates : aliveSeats;
  const targets = candidates.filter(s=>s!==voter);

  $("main").innerHTML=`
    <section class="panel">
      <div class="tag">🗳️ 投票第 ${v.round} 輪</div>
      <h2 class="h2">請 ${voter} 號投票</h2>
      <div class="hint">${v.candidates ? `本輪只可投：${v.candidates.join("、")} 號` : "可投任一存活玩家"}</div>

      <div class="seats">
        ${targets.map(s=>`<button class="seat" onclick="castVote(${voter},${s})">${s}</button>`).join("")}
      </div>

      <div class="row">
        <button class="ghost" onclick="castVote(${voter},null)">棄票</button>
        <button class="ghost" onclick="startDay('（取消投票）')">取消返回白天</button>
      </div>

      <div class="card">
        <div style="font-weight:900;margin-bottom:6px;">進度</div>
        <div>${v.voterIndex} / ${v.voterSeats.length}</div>
      </div>
    </section>
  `;
}

window.castVote = function(voter, target){
  const v=Game.vote;
  v.votes[voter]=target;
  v.voterIndex++;
  if(v.voterIndex>=v.voterSeats.length) renderVoteResult();
  else renderVoteStep();
};

function tallyVotes(votes, limit=null){
  const m=new Map();
  for(const target of Object.values(votes)){
    if(target===null) continue;
    if(limit && !limit.includes(target)) continue;
    m.set(target,(m.get(target)||0)+1);
  }
  return [...m.entries()].map(([seat,count])=>({seat, count})).sort((a,b)=>b.count-a.count);
}

function renderVoteResult(){
  const v=Game.vote;
  const tally=tallyVotes(v.votes, v.candidates);

  const detail = v.voterSeats.map(s=>{
    const t=v.votes[s];
    return `${s}→${t===null?"棄票":t+"號"}`;
  }).join("<br>");

  if(tally.length===0){
    Game.logs.push(`投票：全棄票/無效（第${v.round}輪）`);
    $("main").innerHTML=`
      <section class="panel">
        <div class="tag">🗳️ 結果</div>
        <div class="card">全部棄票 / 無有效票</div>
        <div class="card"><div style="font-weight:900;margin-bottom:6px;">明細（上帝）</div>${detail}</div>
        <button class="primary" onclick="startDay('（本輪無處刑）')">回白天</button>
      </section>
    `;
    return;
  }

  const top=tally[0].count;
  const topSeats=tally.filter(x=>x.count===top).map(x=>x.seat);

  if(topSeats.length>1){
    Game.logs.push(`平票：${topSeats.join("、")}（${top}票）`);
    $("main").innerHTML=`
      <section class="panel">
        <div class="tag">🗳️ 平票</div>
        <div class="card">平票名單：${topSeats.join("、")}（${top}票）</div>
        <div class="card"><div style="font-weight:900;margin-bottom:6px;">明細（上帝）</div>${detail}</div>
        <div class="row">
          <button class="primary" onclick="revote(${JSON.stringify(topSeats)})">平票重投</button>
          <button class="ghost" onclick="startDay('（平票不處刑）')">回白天</button>
        </div>
      </section>
    `;
    return;
  }

  const executed=topSeats[0];
  Game.logs.push(`最高票：${executed}（${top}票）`);
  $("main").innerHTML=`
    <section class="panel">
      <div class="tag">🗳️ 結果</div>
      <div class="card"><b>${executed} 號</b> 最高票（${top}票）</div>
      <div class="card"><div style="font-weight:900;margin-bottom:6px;">統計</div>${tally.map(x=>`• ${x.seat}號：${x.count}票`).join("<br>")}</div>
      <div class="card"><div style="font-weight:900;margin-bottom:6px;">明細（上帝）</div>${detail}</div>
      <div class="row">
        <button class="primary" onclick="confirmExecute(${executed})">確認處刑</button>
        <button class="ghost" onclick="startDay('（取消處刑）')">回白天</button>
      </div>
    </section>
  `;
}

window.revote = function(cands){
  Game.vote = {
    round: Game.vote.round+1,
    candidates: cands,
    voterSeats: alivePlayers().map(p=>p.seat),
    voterIndex: 0,
    votes: {}
  };
  renderVoteStep();
};

window.confirmExecute = function(seat){
  killPlayer(seat,"vote");
  Game.logs.push(`處刑：${seat}號出局`);
  startDay(`處刑：${seat} 號出局`);
};

/* ========= 死亡觸發：獵人/白狼王/黑狼王 ========= */
function killPlayer(seat, reason){
  const p = Game.players.find(x=>x.seat===seat);
  if(!p || !p.alive) return;
  p.alive=false;

  const role = ROLES[p.roleId];

  if(role.id==="whiteWolfKing" && reason==="vote"){
    return promptCarry(seat,"白狼王","白狼王帶走誰？",(t)=>{
      killPlayer(t,"claw");
      Game.logs.push(`白狼王帶走：${t}號`);
      startDay(`結算完成（白狼王帶走 ${t} 號）`);
    });
  }

  if(role.id==="blackWolfKing" && reason!=="poison" && reason!=="explode"){
    return promptCarry(seat,"黑狼王","黑狼王【狼王之爪】帶走誰？",(t)=>{
      killPlayer(t,"claw");
      Game.logs.push(`黑狼王帶走：${t}號`);
      startDay(`結算完成（黑狼王帶走 ${t} 號）`);
    });
  }

  if(role.id==="hunter"){
    return promptCarry(seat,"獵人","獵人開槍帶走誰？",(t)=>{
      killPlayer(t,"shot");
      Game.logs.push(`獵人帶走：${t}號`);
      startDay(`結算完成（獵人帶走 ${t} 號）`);
    });
  }
}

function promptCarry(fromSeat, title, msg, onPick){
  const targets = alivePlayers().map(p=>p.seat).filter(s=>s!==fromSeat);

  $("main").innerHTML=`
    <section class="panel">
      <div class="tag">⚡ ${title}技能</div>
      <h2 class="h2">${escapeHtml(msg)}</h2>
      <div class="seats">
        ${targets.map(s=>`<button class="seat" onclick="carryPick(${s})">${s}</button>`).join("")}
      </div>
      <button class="ghost" onclick="startDay('（${title}選擇不帶人）')">不帶人</button>
    </section>
  `;

  window.carryPick = function(seat){
    onPick(seat);
    delete window.carryPick;
  };
}

/* ========= 小樣式（不改 style.css 也能像 App） ========= */
let _miniInjected=false;
function injectMiniStyles(){
  if(_miniInjected) return;
  _miniInjected=true;

  const css=`
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
  const st=document.createElement("style");
  st.textContent=css;
  document.head.appendChild(st);
}