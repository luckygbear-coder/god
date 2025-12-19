(() => {
  "use strict";

  /* ===================== helpers ===================== */
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const LS_KEY = "ws_god_state_v4";

  const safeParse = (s, fb=null) => { try { return JSON.parse(s); } catch { return fb; } };
  const save = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {} };
  const load = () => safeParse(localStorage.getItem(LS_KEY), null);

  const fmtTime = (sec) => {
    sec = Math.max(0, Math.floor(sec));
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  const vibrate = (ms=25) => { try { navigator.vibrate?.(ms); } catch {} };

  /* ===================== board fallback ===================== */
  const BOARDS = [
    // 12
    {
      id:"official-12",
      name:"12 人官方標準局",
      players:12,
      tags:["官方","穩","含白癡"],
      desc:"4狼 + 預言家/女巫/守衛/獵人 + 4民",
      roles:[
        {role:"狼人",camp:"狼"},{role:"狼人",camp:"狼"},{role:"狼人",camp:"狼"},{role:"狼人",camp:"狼"},
        {role:"預言家",camp:"神"},{role:"女巫",camp:"神"},{role:"守衛",camp:"神"},{role:"獵人",camp:"神"},
        {role:"村民",camp:"民"},{role:"村民",camp:"民"},{role:"村民",camp:"民"},{role:"村民",camp:"民"},
      ],
      override:{ winMode:"edge", hasPolice:true }
    },
    {
      id:"12-city",
      name:"12 人（標準角色・屠城）",
      players:12,
      tags:["測試","屠城"],
      desc:"同標準角色，勝負改屠城",
      inherit:"official-12",
      override:{ winMode:"city", hasPolice:true }
    },
    {
      id:"12-edge-nopolice",
      name:"12 人（屠邊・無上警）",
      players:12,
      tags:["測試","無上警"],
      desc:"同標準角色，但關閉上警",
      inherit:"official-12",
      override:{ winMode:"edge", hasPolice:false }
    },

    // 10
    {
      id:"official-10",
      name:"10 人官方標準局",
      players:10,
      tags:["官方","快節奏"],
      desc:"3狼 + 預言家/女巫/獵人 + 4民",
      roles:[
        {role:"狼人",camp:"狼"},{role:"狼人",camp:"狼"},{role:"狼人",camp:"狼"},
        {role:"預言家",camp:"神"},{role:"女巫",camp:"神"},{role:"獵人",camp:"神"},
        {role:"村民",camp:"民"},{role:"村民",camp:"民"},{role:"村民",camp:"民"},{role:"村民",camp:"民"},
      ],
      override:{ winMode:"edge", hasPolice:true }
    },
    {
      id:"10-edge-nopolice",
      name:"10 人（屠邊・無上警）",
      players:10,
      tags:["測試","無上警"],
      desc:"同 10 標準，但關閉上警",
      inherit:"official-10",
      override:{ winMode:"edge", hasPolice:false }
    },

    // 9
    {
      id:"official-9",
      name:"9 人官方標準局",
      players:9,
      tags:["官方","最精簡"],
      desc:"3狼 + 預言家/女巫/獵人 + 3民",
      roles:[
        {role:"狼人",camp:"狼"},{role:"狼人",camp:"狼"},{role:"狼人",camp:"狼"},
        {role:"預言家",camp:"神"},{role:"女巫",camp:"神"},{role:"獵人",camp:"神"},
        {role:"村民",camp:"民"},{role:"村民",camp:"民"},{role:"村民",camp:"民"},
      ],
      override:{ winMode:"edge", hasPolice:true }
    },
  ];

  function resolveBoard(id){
    const b = BOARDS.find(x=>x.id===id);
    if(!b) return null;
    if(b.inherit){
      const base = resolveBoard(b.inherit);
      if(!base) return b;
      return {
        ...base,
        ...b,
        roles: b.roles || base.roles,
        override: { ...(base.override||{}), ...(b.override||{}) }
      };
    }
    return b;
  }

  function boardsByPlayers(n){
    return BOARDS.map(b=>resolveBoard(b.id)).filter(b=>b && b.players===n);
  }

  /* ===================== state ===================== */
  const defaultState = {
    version:4,
    step:"SETUP_BOARD",     // SETUP_BOARD -> DEAL -> NIGHT_START (先做到這裡，之後再接完整夜晚)
    players:12,
    boardId:"official-12",
    winMode:"edge",
    hasPolice:true,

    // seats
    seatsAlive:[],
    seatRoles:[],
    seenRole:[],

    // resources
    witchAntidote:true,
    witchPoison:true,
    hunterBullet:true,
    guardCanGuard:true,

    // timer
    timerSec:90,
    timerRunning:false,
    timerEndAt:0,

    // vote data demo (你之後接投票流程時會真正填)
    votes: null
    // votes example:
    // { toMap: { "1":[3,4,7,8,9,12], "2":[6,10,11] }, abstain:[1,2,5] }
  };

  let state = load() || structuredClone(defaultState);

  function normalize(){
    const n = state.players;
    if(!Array.isArray(state.seatsAlive) || state.seatsAlive.length!==n){
      state.seatsAlive = Array.from({length:n}, ()=>true);
    }
    if(!Array.isArray(state.seatRoles) || state.seatRoles.length!==n){
      state.seatRoles = Array.from({length:n}, ()=>null);
    }
    if(!Array.isArray(state.seenRole) || state.seenRole.length!==n){
      state.seenRole = Array.from({length:n}, ()=>false);
    }
  }

  function applyBoardOverride(){
    const b = resolveBoard(state.boardId);
    const ov = b?.override || {};
    if(ov.winMode) state.winMode = ov.winMode;
    if(typeof ov.hasPolice==="boolean") state.hasPolice = ov.hasPolice;
  }

  /* ===================== DOM ===================== */
  const el = {};
  function cacheDom(){
    el.uiStatus = $("#uiStatus");
    el.uiBoard  = $("#uiBoard");

    el.promptTitle = $("#promptTitle");
    el.promptText  = $("#promptText");
    el.promptFoot  = $("#promptFoot");

    el.boardPickerCard = $("#boardPickerCard");
    el.boardPickerHint = $("#boardPickerHint");
    el.boardPicker = $("#boardPicker");
    el.countRow = $("#countRow");

    el.seatsGrid = $("#seatsGrid");

    el.godText = $("#godText");
    el.godDrawerText = $("#godDrawerText");

    el.btnPrimary = $("#btnPrimary");
    el.btnBack = $("#btnBack");
    el.btnCancel = $("#btnCancel");

    el.btnHourglass = $("#btnHourglass");
    el.btnGodEye = $("#btnGodEye");
    el.btnDice = $("#btnDice");
    el.btnSettings = $("#btnSettings");

    // settings drawer
    el.drawerBackdrop = $("#drawerBackdrop");
    el.drawer = $("#drawer");
    el.btnCloseDrawer = $("#btnCloseDrawer");
    el.segEdge = $("#segEdge");
    el.segCity = $("#segCity");
    el.togglePolice = $("#togglePolice");
    el.btnReset = $("#btnReset");

    // timer drawer
    el.timerBackdrop = $("#timerDrawerBackdrop");
    el.timerDrawer = $("#timerDrawer");
    el.btnCloseTimer = $("#btnCloseTimerDrawer");
    el.timerBig = $("#timerBig");
    el.timerPresets = $("#timerPresets");
    el.btnTimerStart = $("#btnTimerStart");
    el.btnTimerPause = $("#btnTimerPause");
    el.btnTimerReset = $("#btnTimerReset");

    // god drawer
    el.godBackdrop = $("#godDrawerBackdrop");
    el.godDrawer = $("#godDrawer");
    el.btnCloseGod = $("#btnCloseGodDrawer");

    // vote drawer
    el.voteBackdrop = $("#voteDrawerBackdrop");
    el.voteDrawer = $("#voteDrawer");
    el.btnVoteDrawer = $("#btnVoteDrawer");
    el.btnCloseVote = $("#btnCloseVoteDrawer");
    el.voteAnnounceText = $("#voteAnnounceText");

    // role modal
    el.roleModal = $("#roleModal");
    el.roleModalTitle = $("#roleModalTitle");
    el.roleModalRole = $("#roleModalRole");
    el.roleModalCamp = $("#roleModalCamp");
    el.btnRoleDone = $("#btnRoleDone");
    el.btnRoleClose = $("#btnRoleClose");

    // dice modal
    el.diceModal = $("#diceModal");
    el.diceResult = $("#diceResult");
    el.btnDiceAgain = $("#btnDiceAgain");
    el.btnDiceClose = $("#btnDiceClose");
  }

  /* ===================== drawers ===================== */
  function showDrawer(which){
    const map = {
      settings:[el.drawerBackdrop, el.drawer],
      timer:[el.timerBackdrop, el.timerDrawer],
      god:[el.godBackdrop, el.godDrawer],
      vote:[el.voteBackdrop, el.voteDrawer],
    };
    const pair = map[which];
    if(!pair) return;
    pair[0]?.classList.remove("hidden");
    pair[1]?.classList.remove("hidden");
    pair[1]?.setAttribute("aria-hidden","false");
  }

  function hideDrawer(which){
    const map = {
      settings:[el.drawerBackdrop, el.drawer],
      timer:[el.timerBackdrop, el.timerDrawer],
      god:[el.godBackdrop, el.godDrawer],
      vote:[el.voteBackdrop, el.voteDrawer],
    };
    const pair = map[which];
    if(!pair) return;
    pair[0]?.classList.add("hidden");
    pair[1]?.classList.add("hidden");
    pair[1]?.setAttribute("aria-hidden","true");
  }

  /* ===================== render ===================== */
  function renderTop(){
    if(el.uiStatus) el.uiStatus.textContent = state.step.replaceAll("_"," / ");
    if(el.uiBoard) el.uiBoard.textContent = state.boardId || "—";
  }

  function setPrompt(title, text, foot=""){
    el.promptTitle && (el.promptTitle.textContent = title);
    el.promptText  && (el.promptText.textContent = text);
    el.promptFoot  && (el.promptFoot.textContent = foot);
  }

  function renderPrompt(){
    if(state.step==="SETUP_BOARD"){
      setPrompt(
        "設定：選人數與板子",
        "1) 先選人數（9 / 10 / 12）\n2) 再點板子套用（會變色）\n3) 按「下一步」進入抽身分",
        "提示：右上 ⌛️ 可開計時器；右上 👁 可看上帝完整資訊。"
      );
      return;
    }

    if(state.step==="DEAL"){
      const done = state.seenRole.filter(Boolean).length;
      setPrompt(
        "抽身分",
        "請把手機交給玩家：\n- 長按座位 0.3 秒翻牌\n- 玩家看完按「我看完了」\n全部看完才能「下一步」。",
        `進度：${done}/${state.players}`
      );
      return;
    }

    if(state.step==="NIGHT_START"){
      setPrompt(
        "夜晚 1",
        "夜晚開始：\n1) 狼人刀人（點座位）\n2) 守衛守人（點座位）\n3) 女巫（同晚解藥/毒藥只能擇一）\n4) 預言家查驗（點座位顯示結果）",
        "（下一步：你要我接完整夜晚流程我就會把刀口/守/女巫互斥/查驗結果整段接上）"
      );
      return;
    }

    setPrompt("—","—","");
  }

  function renderCountAndBoards(){
    if(!el.boardPickerCard) return;

    // show card only in setup
    const show = (state.step==="SETUP_BOARD");
    el.boardPickerCard.classList.toggle("hidden", !show);
    if(!show) return;

    // count row buttons
    if(el.countRow){
      el.countRow.innerHTML = "";
      [9,10,12].forEach(n=>{
        const b = document.createElement("button");
        b.type="button";
        b.className = "chip" + (state.players===n ? " primary" : "");
        b.textContent = `${n}人`;
        b.addEventListener("click", ()=>{
          state.players = n;
          const list = boardsByPlayers(n);
          state.boardId = list[0]?.id || "";
          normalize();
          applyBoardOverride();
          save();
          renderAll();
        });
        el.countRow.appendChild(b);
      });
    }

    // boards grid
    const list = boardsByPlayers(state.players);
    el.boardPickerHint && (el.boardPickerHint.textContent = `目前人數：${state.players} 人（點一下套用板子）`);

    if(el.boardPicker){
      el.boardPicker.innerHTML = "";
      list.forEach(b=>{
        const btn = document.createElement("button");
        btn.type="button";
        btn.className="boardBtn" + (state.boardId===b.id ? " active" : "");
        btn.innerHTML = `
          <div class="name">${b.name}</div>
          <div class="sub">${b.id}　·　${b.desc||""}</div>
          <div class="tags">${(b.tags||[]).map(t=>`<span class="badge">${t}</span>`).join("")}</div>
        `;
        btn.addEventListener("click", ()=>{
          state.boardId = b.id;
          applyBoardOverride();
          save();
          renderAll();
        });
        el.boardPicker.appendChild(btn);
      });
    }
  }

  function renderSeats(){
    if(!el.seatsGrid) return;
    normalize();

    el.seatsGrid.innerHTML = "";
    for(let i=0;i<state.players;i++){
      const alive = !!state.seatsAlive[i];
      const btn = document.createElement("button");
      btn.type="button";
      btn.className="seatBtn" + (alive ? "" : " dead");
      btn.dataset.idx = String(i);
      btn.innerHTML = `
        <div class="no">${i+1}號</div>
        <div class="st">${alive ? "存活" : "死亡"}</div>
      `;

      // ✅ 點選變色更明顯
      btn.addEventListener("click", ()=>{
        $$(".seatBtn").forEach(x=>x.classList.remove("selected"));
        btn.classList.add("selected");
        vibrate(15);
      });

      // ✅ 抽身分長按 0.3 秒翻牌
      let lp = 0;
      const startLP = ()=>{
        if(state.step!=="DEAL") return;
        clearTimeout(lp);
        lp = window.setTimeout(()=> openRoleModal(i), 300);
      };
      const endLP = ()=> clearTimeout(lp);

      btn.addEventListener("pointerdown", startLP);
      btn.addEventListener("pointerup", endLP);
      btn.addEventListener("pointercancel", endLP);
      btn.addEventListener("pointerleave", endLP);

      el.seatsGrid.appendChild(btn);
    }
  }

  function buildGodText(){
    const n = state.players;
    const roles = state.seatRoles.filter(Boolean);

    const wolf = roles.filter(r=>r.camp==="狼").length;
    const god  = roles.filter(r=>r.camp==="神").length;
    const vill = roles.filter(r=>r.camp==="民").length;
    const good = roles.filter(r=>r.camp!=="狼").length;

    const aliveWolf = state.seatRoles.map((r,i)=>({r,i})).filter(x=>x.r && x.r.camp==="狼" && state.seatsAlive[x.i]).length;
    const aliveGood = state.seatRoles.map((r,i)=>({r,i})).filter(x=>x.r && x.r.camp!=="狼" && state.seatsAlive[x.i]).length;

    let t = "";
    t += `人數：${n}\n`;
    t += `板子：${state.boardId}\n`;
    t += `勝負：${state.winMode==="city" ? "屠城" : "屠邊"}\n`;
    t += `上警：${state.hasPolice ? "開" : "關"}\n`;
    t += `流程：${state.step}\n\n`;

    if(!roles.length){
      t += `抽身分：尚未分配\n\n`;
    }else{
      t += `抽身分：已分配\n`;
      t += `角色數：狼 ${wolf} / 神 ${god} / 民 ${vill}（好人 ${good}）\n`;
      t += `存活：狼 ${aliveWolf} / 好人 ${aliveGood}\n\n`;
    }

    t += `女巫：解藥${state.witchAntidote ? "可用" : "已用"} / 毒藥${state.witchPoison ? "可用" : "已用"}\n`;
    t += `守衛：${state.guardCanGuard ? "可守" : "不可守"}\n`;
    t += `獵人：子彈${state.hunterBullet ? "可用" : "已用"}\n\n`;

    t += `座位明細：\n`;
    for(let i=0;i<n;i++){
      const alive = state.seatsAlive[i] ? "存活" : "死亡";
      const r = state.seatRoles[i];
      const roleTxt = r ? `${r.role}（${r.camp}）` : "—";
      const seen = state.seenRole[i] ? "✅已看" : "⬜未看";
      t += `${String(i+1).padStart(2," ")}號：${alive}　${roleTxt}　${seen}\n`;
    }
    return t.trimEnd();
  }

  function renderGod(){
    const txt = buildGodText();
    el.godText && (el.godText.textContent = txt);
    el.godDrawerText && (el.godDrawerText.textContent = txt);
  }

  /* ===================== vote announce (format you want) ===================== */
  function buildVoteAnnounce(votes){
    if(!votes || (!votes.toMap && !votes.abstain)) return "（尚無投票資料）";

    const toMap = votes.toMap || {};
    const abstain = votes.abstain || [];

    // compute counts & max
    const entries = Object.entries(toMap).map(([to, arr])=>{
      const list = (arr||[]).slice().sort((a,b)=>a-b);
      return { to: Number(to), list, count: list.length };
    }).sort((a,b)=>a.to-b.to);

    let max = -1;
    let maxTo = null;
    entries.forEach(e=>{
      if(e.count>max){
        max = e.count; maxTo = e.to;
      }
    });

    let out = "";
    entries.forEach(e=>{
      out += `投給${e.to}號的有${e.count}票：${e.list.join("、") || "（無）"}\n`;
    });
    out += `棄票的有${abstain.length}票：${abstain.slice().sort((a,b)=>a-b).join("、") || "（無）"}\n\n`;

    if(maxTo==null){
      out += "本輪無有效票。";
    }else{
      out += `${maxTo}號得到最高票（${max}票）遭到放逐`;
    }
    return out.trimEnd();
  }

  function renderVoteButton(){
    if(!el.btnVoteDrawer) return;
    const has = !!state.votes;
    el.btnVoteDrawer.classList.toggle("hidden", !has);
    if(has){
      el.voteAnnounceText && (el.voteAnnounceText.textContent = buildVoteAnnounce(state.votes));
    }
  }

  /* ===================== deal roles ===================== */
  function shuffle(arr){
    for(let i=arr.length-1;i>0;i--){
      const j = (Math.random()*(i+1))|0;
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }

  function deal(){
    const b = resolveBoard(state.boardId) || resolveBoard(`official-${state.players}`);
    const pack = b?.roles || [];
    if(pack.length !== state.players){
      state.seatRoles = Array.from({length:state.players},()=>({role:"村民",camp:"民"}));
    }else{
      const pool = shuffle(pack.map(x=>({role:x.role,camp:x.camp})));
      state.seatRoles = pool.slice(0,state.players);
    }

    state.seenRole = Array.from({length:state.players},()=>false);
    state.seatsAlive = Array.from({length:state.players},()=>true);

    state.witchAntidote = true;
    state.witchPoison = true;
    state.hunterBullet = true;
    state.guardCanGuard = true;

    save();
  }

  /* ===================== role modal ===================== */
  function openRoleModal(idx){
    if(!el.roleModal) return;

    const r = state.seatRoles[idx];
    el.roleModalTitle && (el.roleModalTitle.textContent = `${idx+1}號 身分`);
    el.roleModalRole && (el.roleModalRole.textContent = r ? r.role : "（尚未分配）");
    el.roleModalCamp && (el.roleModalCamp.textContent = r ? `陣營：${r.camp}` : "");

    el.roleModal.classList.remove("hidden");
    el.roleModal.setAttribute("aria-hidden","false");
    vibrate(15);
  }

  function closeRoleModal(markSeen){
    if(markSeen){
      const m = (el.roleModalTitle?.textContent||"").match(/^(\d+)號/);
      if(m){
        const idx = parseInt(m[1],10)-1;
        if(idx>=0 && idx<state.players){
          state.seenRole[idx] = true;
          save();
        }
      }
    }
    el.roleModal?.classList.add("hidden");
    el.roleModal?.setAttribute("aria-hidden","true");
    renderAll();
  }

  /* ===================== timer ===================== */
  let tick = 0;

  const timerRunning = ()=> state.timerRunning && state.timerEndAt>0;

  function getRemain(){
    if(!timerRunning()) return state.timerSec;
    const remain = Math.ceil((state.timerEndAt - Date.now())/1000);
    return Math.max(0, remain);
  }

  function renderTimer(){
    el.timerBig && (el.timerBig.textContent = fmtTime(getRemain()));
  }

  function setTimer(sec){
    state.timerSec = sec;
    state.timerRunning = false;
    state.timerEndAt = 0;
    save();
    renderTimer();
  }

  function startTimer(){
    if(timerRunning()) return;
    state.timerRunning = true;
    state.timerEndAt = Date.now() + state.timerSec*1000;
    save();
    syncTimer();
  }

  function pauseTimer(){
    if(!timerRunning()) return;
    state.timerSec = getRemain();
    state.timerRunning = false;
    state.timerEndAt = 0;
    save();
    renderTimer();
  }

  function resetTimer(){
    state.timerRunning = false;
    state.timerEndAt = 0;
    save();
    renderTimer();
  }

  function syncTimer(){
    clearInterval(tick);
    tick = window.setInterval(()=>{
      renderTimer();
      if(timerRunning() && getRemain()<=0){
        state.timerRunning = false;
        state.timerEndAt = 0;
        save();
        renderTimer();
        vibrate(220);
        clearInterval(tick);
      }
    }, 250);
  }

  /* ===================== dice ===================== */
  function openDice(){
    el.diceModal?.classList.remove("hidden");
    el.diceModal?.setAttribute("aria-hidden","false");
    rollDice();
  }
  function closeDice(){
    el.diceModal?.classList.add("hidden");
    el.diceModal?.setAttribute("aria-hidden","true");
  }
  function rollDice(){
    const alive = state.seatsAlive.map((a,i)=>a?i+1:null).filter(Boolean);
    if(!alive.length){
      el.diceResult && (el.diceResult.textContent="—");
      return;
    }
    const pick = alive[(Math.random()*alive.length)|0];
    el.diceResult && (el.diceResult.textContent = `${pick} 號`);
    vibrate(20);
  }

  /* ===================== navigation ===================== */
  function next(){
    if(state.step==="SETUP_BOARD"){
      applyBoardOverride();
      deal();
      state.step="DEAL";
      save();
      renderAll();
      return;
    }
    if(state.step==="DEAL"){
      if(state.seenRole.some(v=>!v)) return;
      state.step="NIGHT_START";
      save();
      renderAll();
      return;
    }
    if(state.step==="NIGHT_START"){
      // 先留（你下一步要我接完整夜晚流程）
      renderAll();
      return;
    }
  }

  function back(){
    if(state.step==="DEAL"){
      state.step="SETUP_BOARD";
      save();
      renderAll();
      return;
    }
    if(state.step==="NIGHT_START"){
      state.step="DEAL";
      save();
      renderAll();
      return;
    }
  }

  function cancel(){
    $$(".seatBtn").forEach(x=>x.classList.remove("selected"));
    vibrate(10);
  }

  function hardReset(){
    if(!confirm("確定要重置本局？（會清除進度與身分）")) return;
    state = structuredClone(defaultState);
    save();
    normalize();
    renderAll();
    hideDrawer("settings");
  }

  /* ===================== render all ===================== */
  function renderAll(){
    normalize();
    renderTop();
    renderPrompt();
    renderCountAndBoards();
    renderSeats();
    renderGod();
    renderTimer();
    renderVoteButton();

    // buttons
    if(el.btnBack) el.btnBack.disabled = (state.step==="SETUP_BOARD");
    if(el.btnPrimary){
      let dis=false;
      if(state.step==="DEAL") dis = state.seenRole.some(v=>!v);
      el.btnPrimary.disabled = dis;
    }

    // settings ui
    if(el.togglePolice) el.togglePolice.checked = !!state.hasPolice;
    if(el.segEdge && el.segCity){
      el.segEdge.classList.toggle("active", state.winMode!=="city");
      el.segCity.classList.toggle("active", state.winMode==="city");
    }
  }

  /* ===================== bind ===================== */
  function bind(){
    // top buttons
    el.btnHourglass?.addEventListener("click", ()=>{ showDrawer("timer"); renderTimer(); vibrate(10); });
    el.btnGodEye?.addEventListener("click", ()=>{ renderGod(); showDrawer("god"); vibrate(10); });

    el.btnDice?.addEventListener("click", openDice);
    el.btnSettings?.addEventListener("click", ()=> showDrawer("settings"));

    // action bar
    el.btnPrimary?.addEventListener("click", next);
    el.btnBack?.addEventListener("click", back);
    el.btnCancel?.addEventListener("click", cancel);

    // settings drawer close
    el.btnCloseDrawer?.addEventListener("click", ()=> hideDrawer("settings"));
    el.drawerBackdrop?.addEventListener("click", ()=> hideDrawer("settings"));

    // timer drawer close
    el.btnCloseTimer?.addEventListener("click", ()=> hideDrawer("timer"));
    el.timerBackdrop?.addEventListener("click", ()=> hideDrawer("timer"));

    // god drawer close
    el.btnCloseGod?.addEventListener("click", ()=> hideDrawer("god"));
    el.godBackdrop?.addEventListener("click", ()=> hideDrawer("god"));

    // vote drawer close
    el.btnCloseVote?.addEventListener("click", ()=> hideDrawer("vote"));
    el.voteBackdrop?.addEventListener("click", ()=> hideDrawer("vote"));
    el.btnVoteDrawer?.addEventListener("click", ()=>{
      el.voteAnnounceText && (el.voteAnnounceText.textContent = buildVoteAnnounce(state.votes));
      showDrawer("vote");
    });

    // timer actions
    el.timerPresets?.addEventListener("click", (e)=>{
      const b = e.target?.closest?.("[data-sec]");
      if(!b) return;
      const sec = parseInt(b.getAttribute("data-sec"),10);
      if(!Number.isFinite(sec)) return;
      setTimer(sec);
      vibrate(10);
    });
    el.btnTimerStart?.addEventListener("click", startTimer);
    el.btnTimerPause?.addEventListener("click", pauseTimer);
    el.btnTimerReset?.addEventListener("click", resetTimer);

    // settings toggles
    el.segEdge?.addEventListener("click", ()=>{ state.winMode="edge"; save(); renderAll(); });
    el.segCity?.addEventListener("click", ()=>{ state.winMode="city"; save(); renderAll(); });
    el.togglePolice?.addEventListener("change", ()=>{ state.hasPolice = !!el.togglePolice.checked; save(); renderAll(); });
    el.btnReset?.addEventListener("click", hardReset);

    // role modal
    el.btnRoleDone?.addEventListener("click", ()=> closeRoleModal(true));
    el.btnRoleClose?.addEventListener("click", ()=> closeRoleModal(false));
    el.roleModal?.addEventListener("click", (e)=>{
      const inside = e.target?.closest?.(".modalCard");
      if(!inside) closeRoleModal(false);
    });

    // dice modal
    el.btnDiceAgain?.addEventListener("click", rollDice);
    el.btnDiceClose?.addEventListener("click", closeDice);
    el.diceModal?.addEventListener("click", (e)=>{
      const inside = e.target?.closest?.(".modalCard");
      if(!inside) closeDice();
    });

    // keep timer loop
    syncTimer();
  }

  /* ===================== boot ===================== */
  function boot(){
    if(!state || typeof state!=="object") state = structuredClone(defaultState);
    if(state.version !== 4){
      state = { ...structuredClone(defaultState), ...state, version:4 };
    }

    // make sure board exists
    const list = boardsByPlayers(state.players);
    if(!list.find(b=>b.id===state.boardId)){
      state.boardId = list[0]?.id || "official-12";
    }
    applyBoardOverride();
    normalize();
    save();

    cacheDom();
    bind();
    renderAll();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();