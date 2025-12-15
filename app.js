/* =========================================================
   狼人殺｜上帝輔助 PWA
   app.js（第1～5批合體完整版）
   - 夜晚：步驟 / 女巫 / 空刀 / 不能連守 / 公告
   - 白天：發言倒數 / 投票 / 平票處理 / 處刑 / 死亡技能 / 勝負判定
========================================================= */

(() => {
  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);

  /* iOS 防選字/長按選單（不阻斷 click） */
  try {
    document.documentElement.style.webkitUserSelect = "none";
    document.documentElement.style.userSelect = "none";
    document.documentElement.style.webkitTouchCallout = "none";
  } catch(e){}
  on(document, "contextmenu", (e)=>e.preventDefault(), {passive:false});
  on(document, "selectstart", (e)=>e.preventDefault(), {passive:false});
  on(document, "gesturestart", (e)=>e.preventDefault(), {passive:false});

  function stopTextSelectOnTouchOnlyHold(el){
    if(!el) return;
    el.addEventListener("touchstart", (e)=>e.preventDefault(), {passive:false});
  }

  const STORAGE_KEY = "ww_save_v_full_v5";

  const State = {
    phase:"setup",
    boardId:"basic",
    playerCount:9,
    rolesCount:null,
    players:[],
    dealIndex:0,

    nightNo:1,
    dayNo:1,
    godView:false,

    nightState:{},
    nightSteps:[],
    nightStepIndex:0,

    logs:[],

    witch:{ saveUsed:false, poisonUsed:false, save:false, poisonTarget:null },

    settings:{
      noConsecutiveGuard:true,
      wolfCanNoKill:true,
      witchCannotSelfSave:true,
      hunterPoisonNoShoot:true,
      blackWolfKingPoisonNoSkill:true,
    },

    _pickPoisonMode:false,
    _prevGuardTarget:null,

    /* Day flow */
    day:{ killToggle:false },
    vote:{
      round:1,         // 1=第一次投票, 2=第二次（若仍平票 => 無人放逐）
      pk:false,        // true=只投平票者
      electorate:[],   // 可投票的存活者 seat[]
      candidates:[],   // 本輪可被投的人 seat[]（PK時為平票名單）
      cursor:0,        // 正在投票的 seat index
      ballots:{},      // voterSeat -> targetSeat|null
      tally:{},        // targetSeat -> count
      lastTied:[],     // 上次平票名單
      finished:false,
    },

    timer:{
      sec:60,
      running:false,
      t:null,
    }
  };

  function save(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(State)); }catch(e){} }
  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return;
      const s = JSON.parse(raw);
      if(s && typeof s==="object"){
        Object.assign(State, s);
        State.players = Array.isArray(State.players)?State.players:[];
        State.logs = Array.isArray(State.logs)?State.logs:[];
        State.witch = State.witch || {saveUsed:false, poisonUsed:false, save:false, poisonTarget:null};
        State.settings = State.settings || {
          noConsecutiveGuard:true, wolfCanNoKill:true, witchCannotSelfSave:true,
          hunterPoisonNoShoot:true, blackWolfKingPoisonNoSkill:true
        };
        State.vote = State.vote || {};
        State.timer = State.timer || {sec:60,running:false,t:null};
      }
    }catch(e){}
  }
  function clearSave(){ try{ localStorage.removeItem(STORAGE_KEY);}catch(e){} }

  function showScreen(name){
    document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
    $(`screen-${name}`)?.classList.add("active");
    State.phase = name;
    save();
  }

  /* WW_DATA */
  function getWW(){ return window.WW_DATA || null; }
  function getRolesMap(){ return getWW()?.roles || {}; }
  function getRole(roleId){
    const r = getRolesMap()?.[roleId];
    return r || { id:roleId, name:roleId, icon:"❔", team:"villager" };
  }
  function getBoardBundle(boardId){
    const WW = getWW();
    if(WW?.getBoardBundle){
      const b = WW.getBoardBundle(boardId);
      if(b) return b;
    }
    const board = WW?.boards?.[boardId] || null;
    const rules = (boardId==="b1" ? WW?.rules?.b1 : WW?.rules?.basic) || null;
    const nightSteps = (boardId==="b1" ? WW?.nightSteps?.b1 : WW?.nightSteps?.basic) || null;
    if(!board) return null;
    return {board, rules, nightSteps};
  }

  /* Setup suggestion */
  function suggestBasicConfigByCount(n){
    const wolves = n>=10 ? 3 : 2;
    const fixed = 3;
    const villager = Math.max(0, n-wolves-fixed);
    return { werewolf:wolves, villager, seer:1, witch:1, hunter:1 };
  }
  function suggestB1ConfigByCount(n){
    const base = { villager:0, werewolf:0, seer:1, witch:1, hunter:1, guard:1, knight:1, blackWolfKing:1, whiteWolfKing:1 };
    const wolves = n>=11 ? 3 : 2;
    base.werewolf = Math.max(0, wolves-2);
    const fixed =
      base.seer+base.witch+base.hunter+base.guard+base.knight+
      base.blackWolfKing+base.whiteWolfKing+base.werewolf;
    base.villager = Math.max(0, n-fixed);
    return base;
  }
  function rolesTotal(map){ return Object.values(map||{}).reduce((a,b)=>a+(Number(b)||0),0); }
  function getSuggestedRolesCount(boardId, n){
    const preset = getBoardBundle(boardId)?.board?.presets?.[n];
    if(preset && typeof preset==="object") return structuredClone(preset);
    return boardId==="b1" ? suggestB1ConfigByCount(n) : suggestBasicConfigByCount(n);
  }

  function syncSetupUI(){
    $("playerCount") && ($("playerCount").textContent = String(State.playerCount));
    $("playerTotal") && ($("playerTotal").textContent = String(State.playerCount));
    const total = rolesTotal(State.rolesCount);
    $("roleTotal") && ($("roleTotal").textContent = String(total));
    const ok = total===State.playerCount;
    $("warnRoleTotal")?.classList.toggle("hidden", ok);

    const btnStart = $("btnStart");
    if(btnStart){
      btnStart.disabled = !ok;
      btnStart.textContent = ok ? "開始 → 抽身分" : "⚠️ 角色總數需等於玩家數";
    }
    save();
  }

  function setBoard(boardId){
    State.boardId = boardId;
    $("boardBasic")?.classList.toggle("active", boardId==="basic");
    $("boardSpecial")?.classList.toggle("active", boardId==="b1");
    State.rolesCount = getSuggestedRolesCount(boardId, State.playerCount);
    syncSetupUI();
  }
  function setPlayerCount(n){
    const v = Math.max(6, Math.min(12, Number(n)||9));
    State.playerCount = v;
    $("rangeCount") && ($("rangeCount").value = String(v));
    State.rolesCount = getSuggestedRolesCount(State.boardId, v);
    syncSetupUI();
  }

  /* Players */
  function shuffle(arr){
    for(let i=arr.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }

  function buildPlayersFromRolesCount(){
    const rolesArr = [];
    for(const [rid,cnt] of Object.entries(State.rolesCount||{})){
      for(let i=0;i<(Number(cnt)||0);i++) rolesArr.push(rid);
    }
    shuffle(rolesArr);

    State.players = rolesArr.map((rid,idx)=>{
      const r = getRole(rid);
      return { seat:idx+1, roleId:rid, name:r.name||rid, icon:r.icon||"❔", team:r.team||"villager", alive:true, diedBy:null };
    });

    State.dealIndex=0;
    State.nightNo=1;
    State.dayNo=1;
    State.logs=[];
    State.nightState={};
    State.nightSteps=[];
    State.nightStepIndex=0;
    State._pickPoisonMode=false;
    State._prevGuardTarget=null;

    State.witch = State.witch || {saveUsed:false, poisonUsed:false, save:false, poisonTarget:null};
    State.witch.save=false;
    State.witch.poisonTarget=null;

    State.vote = freshVoteState();

    State.day = { killToggle:false };
    save();
  }

  /* Deal */
  let _dealHoldTimer=null;

  function renderDealSeatGrid(){
    const grid=$("dealSeatGrid");
    if(!grid) return;
    grid.innerHTML="";
    State.players.forEach((p,idx)=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="seat"+(idx===State.dealIndex?" selected":"");
      b.textContent=String(p.seat);
      b.style.webkitTouchCallout="none";
      b.style.webkitUserSelect="none";
      b.style.userSelect="none";
      b.onclick=()=>{ State.dealIndex=idx; save(); renderDeal(); };
      grid.appendChild(b);
    });
  }

  function showRevealForCurrent(){
    const p=State.players[State.dealIndex];
    if(!p) return;
    $("revealRole") && ($("revealRole").textContent=`${p.icon} ${p.name}`);
    $("modalReveal")?.classList.remove("hidden");
    navigator.vibrate?.(60);
  }
  function hideReveal(){ $("modalReveal")?.classList.add("hidden"); }

  function renderDeal(){
    const p=State.players[State.dealIndex];
    if(!p) return;
    $("dealText") && ($("dealText").innerHTML=`請 <b>${p.seat} 號</b> 拿手機`);
    renderDealSeatGrid();

    const btn=$("btnHoldReveal");
    if(!btn) return;
    stopTextSelectOnTouchOnlyHold(btn);

    btn.onpointerdown=null;
    btn.onpointerup=null;
    btn.onpointercancel=null;
    btn.onpointerleave=null;

    btn.onpointerdown=(e)=>{
      e.preventDefault?.();
      clearTimeout(_dealHoldTimer);
      _dealHoldTimer=setTimeout(showRevealForCurrent, 900);
    };
    const end=(e)=>{
      e && e.preventDefault?.();
      clearTimeout(_dealHoldTimer);
      hideReveal();
    };
    btn.onpointerup=end;
    btn.onpointercancel=end;
    btn.onpointerleave=end;
  }

  function nextDeal(){
    State.dealIndex++;
    if(State.dealIndex>=State.players.length){
      State.dealIndex=State.players.length-1;
      renderDeal();
      navigator.vibrate?.([60,40,60]);
      return;
    }
    save();
    renderDeal();
  }
  function openDealConfirm(){ $("modalDealConfirm")?.classList.remove("hidden"); }
  function closeDealConfirm(){ $("modalDealConfirm")?.classList.add("hidden"); }

  /* Night steps fallback */
  function hasRole(roleId){ return State.players.some(p=>p.roleId===roleId); }

  function buildFallbackNightSteps(){
    const steps=[];
    steps.push({key:"close",type:"info",publicScript:"天黑請閉眼。",godScript:"天黑請閉眼。"});
    if(hasRole("guard")){
      steps.push({key:"guard",type:"pick",pickKey:"guardTarget",required:true,publicScript:"守衛請睜眼，請守一位玩家。",godScript:"守衛守誰？（點座位）"});
    }
    steps.push({
      key:"wolf",type:"pick",pickKey:"wolfTarget",
      required:!State.settings.wolfCanNoKill, allowNull:!!State.settings.wolfCanNoKill,
      publicScript: State.settings.wolfCanNoKill ? "狼人請睜眼（可空刀），請選擇目標。":"狼人請睜眼，請選擇目標。",
      godScript: State.settings.wolfCanNoKill ? "狼人刀誰？（可不選=空刀）":"狼人刀誰？（必選）"
    });
    if(hasRole("seer")){
      steps.push({key:"seer",type:"pick",pickKey:"seerCheck",required:true,publicScript:"預言家請睜眼，請查驗一位玩家。",godScript:"預言家查誰？（點座位）"});
    }
    if(hasRole("witch")){
      steps.push({key:"witch",type:"witch",publicScript:"女巫請睜眼（上帝操作）。",godScript:"女巫回合：請操作救/毒。"});
    }
    steps.push({key:"resolve",type:"resolve",publicScript:"天亮請睜眼。",godScript:"天亮：結算夜晚並公告。"});
    return steps;
  }

  function resolveNightStepsForThisGame(){
    const bundle=getBoardBundle(State.boardId);
    let steps=bundle?.nightSteps;

    if(typeof steps==="function"){
      try{ steps=steps(State.players, State.nightState);}catch(e){ steps=null; }
    }
    if(!Array.isArray(steps) || steps.length===0){
      steps=buildFallbackNightSteps();
    }
    State.nightSteps=steps;
    State.nightStepIndex=0;
    save();
  }

  /* Seats renderer */
  function renderSeats(containerId, onPick, selectedSeat=null, disabledSeatSet=null){
    const box=$(containerId);
    if(!box) return;
    box.innerHTML="";

    State.players.forEach(p=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="seat"+(p.alive?"":" dead")+(selectedSeat===p.seat?" selected":"");
      b.textContent=String(p.seat);

      const disableByRule = disabledSeatSet && disabledSeatSet.has(p.seat);
      b.disabled = !p.alive || !!disableByRule;
      if(disableByRule) b.classList.add("disabled");

      b.style.webkitTouchCallout="none";
      b.style.webkitUserSelect="none";
      b.style.userSelect="none";

      b.addEventListener("click", ()=>{
        if(!p.alive) return;
        if(disableByRule) return;
        onPick?.(p.seat);
      });

      box.appendChild(b);
    });
  }

  function getCurrentNightStep(){ return State.nightSteps?.[State.nightStepIndex] || null; }

  function ensureWolfNoKillButton(step){
    if(!step || step.type!=="pick" || step.pickKey!=="wolfTarget") return;
    const seatsBox=$("nightSeats");
    if(!seatsBox) return;
    $("wolfNoKillBar")?.remove();
    if(!State.settings.wolfCanNoKill) return;

    const bar=document.createElement("div");
    bar.id="wolfNoKillBar";
    bar.style.display="flex";
    bar.style.gap="10px";
    bar.style.marginTop="10px";

    const btnNoKill=document.createElement("button");
    btnNoKill.type="button";
    btnNoKill.className="btn ghost";
    btnNoKill.textContent = (State.nightState.wolfTarget==null) ? "✅ 空刀中" : "空刀";
    btnNoKill.onclick=()=>{
      State.nightState.wolfTarget=null;
      save();
      renderNight();
    };

    const btnClear=document.createElement("button");
    btnClear.type="button";
    btnClear.className="btn ghost";
    btnClear.textContent="清除選擇";
    btnClear.onclick=()=>{
      delete State.nightState.wolfTarget;
      save();
      renderNight();
    };

    bar.append(btnNoKill, btnClear);
    seatsBox.parentElement?.appendChild(bar);
  }

  function renderNight(){
    $("nightTag") && ($("nightTag").textContent=`第 ${State.nightNo} 夜`);
    if(!State.nightSteps || !State.nightSteps.length) resolveNightStepsForThisGame();

    const step=getCurrentNightStep();
    if(!step){
      $("nightScript") && ($("nightScript").textContent="（夜晚流程結束）");
      return;
    }

    const script = State.godView ? (step.godScript||step.publicScript) : (step.publicScript||step.godScript);
    $("nightScript") && ($("nightScript").textContent = script || "（無台詞）");

    ensureWolfNoKillButton(step);

    // 不能連守
    let disabled=null;
    if(step.type==="pick" && step.pickKey==="guardTarget" && State.settings.noConsecutiveGuard){
      const prev = State.nightState.prevGuardTarget ?? State._prevGuardTarget ?? null;
      if(prev) disabled=new Set([prev]);
    }

    const selected =
      State._pickPoisonMode ? State.witch.poisonTarget :
      (step.pickKey ? (State.nightState?.[step.pickKey] ?? null) : null);

    renderSeats("nightSeats", (seat)=>{
      if(State._pickPoisonMode){
        State.witch.poisonTarget = seat;
        State._pickPoisonMode=false;
        save();
        renderWitchModal();
        renderNight();
        return;
      }
      if(step.type==="pick" && step.pickKey){
        State.nightState[step.pickKey]=seat;
        save();
        renderNight();
      }
    }, selected, disabled);
  }

  function canGoNextNightStep(step){
    if(!step) return false;
    if(step.type==="pick" && step.required && step.pickKey){
      if(step.pickKey==="wolfTarget" && State.settings.wolfCanNoKill) return true;
      return State.nightState[step.pickKey]!=null;
    }
    return true;
  }

  function openWitchModal(){
    $("modalWitch")?.classList.remove("hidden");
    renderWitchModal();
  }

  function renderWitchModal(){
    const knifeSeat = State.nightState.wolfTarget ?? null;
    const saveUsed=!!State.witch.saveUsed;
    const poisonUsed=!!State.witch.poisonUsed;

    const showKnife = !saveUsed;

    $("witchKnife") && ($("witchKnife").innerHTML =
      showKnife ? (knifeSeat!=null ? `${knifeSeat} 號` : "（狼人尚未選刀／或空刀）")
               : "（解藥已用過，不提供刀口）"
    );

    if($("witchStatus")){
      const parts=[];
      parts.push(`解藥：${saveUsed?"已用過":"可用"}`);
      parts.push(`毒藥：${poisonUsed?"已用過":"可用"}`);
      if(State.witch.poisonTarget) parts.push(`已選毒：${State.witch.poisonTarget} 號`);
      $("witchStatus").textContent = parts.join("｜");
    }

    const btnSave=$("btnWitchSave");
    const btnNoSave=$("btnWitchNoSave");
    const btnPick=$("btnWitchPoisonPick");

    if(btnSave){
      btnSave.disabled = saveUsed || !showKnife || knifeSeat==null;
      btnSave.textContent = State.witch.save ? "✅ 已選擇用解藥" : "用解藥救";
    }
    if(btnNoSave){
      btnNoSave.disabled = !showKnife;
    }
    if(btnPick){
      btnPick.disabled = poisonUsed;
      btnPick.textContent = State.witch.poisonTarget ? `☠️ 已毒 ${State.witch.poisonTarget} 號（改選）` : "用毒藥（回座位圈點人）";
    }
  }

  function nightPrev(){
    State._pickPoisonMode=false;
    State.nightStepIndex = Math.max(0, State.nightStepIndex-1);
    save(); renderNight();
  }

  function nightNext(){
    const step=getCurrentNightStep();
    if(!step) return;
    if(!canGoNextNightStep(step)){
      navigator.vibrate?.([60,40,60]);
      return;
    }
    if(step.type==="witch"){
      if(!State.godView){
        alert("需要切換 🔓 上帝視角 才能操作女巫");
        return;
      }
      openWitchModal();
      return;
    }
    if(step.type==="resolve"){
      resolveNight();
      return;
    }
    State._pickPoisonMode=false;
    State.nightStepIndex = Math.min(State.nightSteps.length-1, State.nightStepIndex+1);
    save(); renderNight();
  }

  function initNightForNewRound(){
    State.nightState = {};
    State.nightState.prevGuardTarget = State._prevGuardTarget ?? null;
    State._pickPoisonMode=false;
    State.witch.save=false;
    State.witch.poisonTarget=null;
    resolveNightStepsForThisGame();
    save();
    renderNight();
  }

  /* Announcement */
  let annMode="today";
  function renderAnnouncement(){
    const box=$("annBox");
    if(!box) return;
    if(!State.logs.length){
      box.textContent="（尚無公告）";
      return;
    }
    if(annMode==="today"){
      const l=State.logs[0];
      box.textContent = State.godView ? (l.publicText+"\n\n"+(l.hiddenText||"")) : l.publicText;
      return;
    }
    const lines=[];
    State.logs.forEach((l,idx)=>{
      lines.push(`#${State.logs.length-idx}｜第${l.nightNo}夜 / 第${l.dayNo}天`);
      lines.push(l.publicText||"—");
      if(State.godView && l.hiddenText) lines.push(l.hiddenText);
      lines.push("—");
    });
    box.textContent=lines.join("\n");
  }
  function openAnnouncementModal(forceToday=false){
    if(forceToday) annMode="today";
    $("modalAnn")?.classList.remove("hidden");
    $("annToday")?.classList.toggle("active", annMode==="today");
    $("annHistory")?.classList.toggle("active", annMode==="history");
    renderAnnouncement();
  }

  function downloadJSON(filename, obj){
    const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=filename;
    document.body.appendChild(a);
    a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),500);
  }
  function exportReplay(){
    downloadJSON(`狼人殺記錄_${Date.now()}.json`, { exportedAt:new Date().toISOString(), state:State });
  }

  /* Resolve Night */
  function resolveNight(){
    const bundle=getBoardBundle(State.boardId);
    const rules=bundle?.rules || null;
    const settings=State.settings || {};

    State.nightState.witchSave = !!State.witch.save;
    State.nightState.witchPoisonTarget = State.witch.poisonTarget || null;
    State.nightState.witchSaveUsed = !!State.witch.saveUsed;
    State.nightState.witchPoisonUsed = !!State.witch.poisonUsed;

    let publicText="", hiddenText="", resolved=null;

    if(rules?.resolveNight && rules?.buildAnnouncement){
      try{
        resolved = rules.resolveNight({players:State.players, night:State.nightState, settings});
        const ann = rules.buildAnnouncement({
          nightNo:State.nightNo, dayNo:State.dayNo, players:State.players,
          night:State.nightState, resolved, settings
        });
        publicText = ann?.publicText || "（公告產生失敗）";
        hiddenText = ann?.hiddenText || "";

        const guardTarget = resolved?.meta?.guardTargetRaw ?? State.nightState.guardTarget ?? null;
        if(guardTarget) State._prevGuardTarget = guardTarget;

        // 如果 rules 有回傳死亡名單，這裡套用
        const died = resolved?.diedSeats;
        const diedBy = resolved?.diedBy || {};
        if(Array.isArray(died)){
          died.forEach(seat=>{
            const p = State.players.find(x=>x.seat===seat);
            if(p) { p.alive=false; p.diedBy = diedBy[seat] || p.diedBy || "night"; }
          });
        }
      }catch(e){
        console.warn("rules error:", e);
        publicText="（規則結算失敗，已用簡化公告）";
        hiddenText=State.godView ? String(e) : "";
      }
    }else{
      publicText="天亮了。（目前未接上完整 rules，暫不結算死亡）";
      hiddenText=State.godView ? `nightState=${JSON.stringify(State.nightState)}` : "";
      if(State.nightState.guardTarget) State._prevGuardTarget = State.nightState.guardTarget;
    }

    if(State.witch.save) State.witch.saveUsed=true;
    if(State.witch.poisonTarget) State.witch.poisonUsed=true;

    State.logs.unshift({
      nightNo:State.nightNo, dayNo:State.dayNo,
      publicText, hiddenText, ts:new Date().toISOString()
    });

    // 進白天
    showScreen("day");
    renderDayUI();
    openAnnouncementModal(true);

    // 白天一開始就做勝負檢查
    checkWinAndShow();
    save();
  }

  /* Day UI */
  function aliveSeats(){ return State.players.filter(p=>p.alive).map(p=>p.seat); }
  function renderDayUI(){
    $("dayTag") && ($("dayTag").textContent=`第 ${State.dayNo} 天`);
    const el=$("dayAlive");
    if(el){
      const alive=aliveSeats();
      el.textContent = alive.length ? `存活：${alive.join("、")} 號` : "（全滅？）";
    }
    renderSeats("daySeats", (seat)=>{
      if(!State.day.killToggle) return;
      const p=State.players.find(x=>x.seat===seat);
      if(!p) return;
      p.alive = !p.alive;
      p.diedBy = p.alive ? null : "manual";
      save();
      renderDayUI();
    });
  }

  function toggleKillMode(){
    State.day.killToggle = !State.day.killToggle;
    $("btnKillToggle") && ($("btnKillToggle").textContent = State.day.killToggle ? "✅ 標記中（點座位切換）" : "💀 標記死亡/復活");
    save();
  }

  /* Timer */
  function fmt(sec){
    const m = String(Math.floor(sec/60)).padStart(2,"0");
    const s = String(sec%60).padStart(2,"0");
    return `${m}:${s}`;
  }
  function renderTimer(){
    $("timerText") && ($("timerText").textContent = fmt(State.timer.sec));
  }
  function openTimer(){
    $("modalTimer")?.classList.remove("hidden");
    renderTimer();
  }
  function closeTimer(){
    $("modalTimer")?.classList.add("hidden");
  }
  function timerStart(){
    if(State.timer.running) return;
    State.timer.running=true;
    State.timer.t = setInterval(()=>{
      State.timer.sec = Math.max(0, State.timer.sec-1);
      renderTimer();
      if(State.timer.sec<=0){
        navigator.vibrate?.([120,60,120]);
        timerStop();
      }
      save();
    }, 1000);
    save();
  }
  function timerStop(){
    State.timer.running=false;
    if(State.timer.t) clearInterval(State.timer.t);
    State.timer.t=null;
    save();
  }
  function timerReset(){
    timerStop();
    State.timer.sec=60;
    renderTimer();
    save();
  }

  /* Vote */
  function freshVoteState(){
    return {
      round:1, pk:false,
      electorate:[], candidates:[],
      cursor:0,
      ballots:{},
      tally:{},
      lastTied:[],
      finished:false
    };
  }

  function buildTally(ballots){
    const tally={};
    Object.values(ballots||{}).forEach(target=>{
      if(target==null) return;
      tally[target] = (tally[target]||0)+1;
    });
    return tally;
  }

  function formatTally(tally){
    const keys = Object.keys(tally||{}).map(n=>Number(n)).sort((a,b)=>b-a);
    if(!keys.length) return "（尚無票）";
    const lines=[];
    keys.forEach(seat=>{
      lines.push(`${seat} 號：${tally[seat]} 票`);
    });
    return lines.join("\n");
  }

  function openVote(){
    // 初始化投票
    State.vote = freshVoteState();
    State.vote.electorate = aliveSeats();      // 存活者逐位投票
    State.vote.candidates = aliveSeats();      // 可被投的人（存活者）
    State.vote.cursor = 0;
    State.vote.ballots = {};
    State.vote.tally = {};
    State.vote.finished=false;
    save();

    $("modalVote")?.classList.remove("hidden");
    renderVoteModal();
  }

  function closeVote(){
    $("modalVote")?.classList.add("hidden");
  }

  function renderVoteModal(){
    const V=State.vote;
    const voter = V.electorate[V.cursor];
    $("voteHint") && ($("voteHint").innerHTML = voter!=null ? `現在請 <b>${voter} 號</b> 投票` : "投票結束");
    const targetsBox=$("voteTargets");
    if(!targetsBox) return;

    targetsBox.innerHTML="";
    V.candidates.forEach(seat=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="seat";
      b.textContent=String(seat);
      b.style.webkitTouchCallout="none";
      b.style.webkitUserSelect="none";
      b.style.userSelect="none";
      b.onclick=()=>{
        const voterSeat = V.electorate[V.cursor];
        if(voterSeat==null) return;
        V.ballots[voterSeat]=seat;
        V.tally = buildTally(V.ballots);
        $("voteTally") && ($("voteTally").textContent = formatTally(V.tally));
        save();
      };
      targetsBox.appendChild(b);
    });

    $("voteTally") && ($("voteTally").textContent = formatTally(V.tally));
  }

  function voteSkip(){
    const V=State.vote;
    const voterSeat = V.electorate[V.cursor];
    if(voterSeat==null) return;
    V.ballots[voterSeat]=null;
    V.tally = buildTally(V.ballots);
    $("voteTally") && ($("voteTally").textContent = formatTally(V.tally));
    save();
  }

  function voteNext(){
    const V=State.vote;
    if(V.cursor < V.electorate.length-1){
      V.cursor++;
      save();
      renderVoteModal();
      return;
    }
    // 結束投票
    V.finished=true;
    save();
    closeVote();
    handleVoteResult();
  }

  function maxSeatsFromTally(tally){
    const entries = Object.entries(tally||{}).map(([k,v])=>[Number(k),Number(v)||0]);
    if(!entries.length) return {max:0, seats:[]};
    let max=0;
    entries.forEach(([,v])=>{ if(v>max) max=v; });
    const seats = entries.filter(([,v])=>v===max).map(([s])=>s);
    return {max, seats};
  }

  function handleVoteResult(){
    const V=State.vote;
    const {max, seats} = maxSeatsFromTally(V.tally);

    // 全棄票或無有效票 => 無人出局
    if(max<=0 || !seats.length){
      openExecuteModal("本輪投票沒有有效票，無人放逐。", null);
      return;
    }

    if(seats.length===1){
      // 唯一最高票 => 放逐
      executeSeat(seats[0], "vote");
      return;
    }

    // 平票
    V.lastTied = seats.slice();
    save();
    openTieModal(seats);
  }

  function openTieModal(seats){
    $("modalTie")?.classList.remove("hidden");
    $("tieHint") && ($("tieHint").innerHTML =
      `本輪平票：<b>${seats.join("、")} 號</b><br/>請選擇 PK／重投／無人出局。`
    );
  }
  function closeTieModal(){ $("modalTie")?.classList.add("hidden"); }

  function tiePK(){
    const V=State.vote;
    closeTieModal();

    // 第二次還平票 → 無人放逐
    if(V.round>=2){
      openExecuteModal("第二次平票，無人放逐，直接進入夜晚。", null);
      return;
    }

    // PK：只投平票名單
    State.vote = freshVoteState();
    State.vote.round = 2;
    State.vote.pk = true;
    State.vote.electorate = aliveSeats();
    State.vote.candidates = V.lastTied.slice();
    State.vote.cursor = 0;
    State.vote.ballots = {};
    State.vote.tally = {};
    save();

    $("modalVote")?.classList.remove("hidden");
    renderVoteModal();
  }

  function tieRevote(){
    const V=State.vote;
    closeTieModal();

    // 第二次還平票 → 無人放逐（你的規則）
    if(V.round>=2){
      openExecuteModal("第二次平票，無人放逐，直接進入夜晚。", null);
      return;
    }

    // 重投：全體重投（仍只投存活者）
    State.vote = freshVoteState();
    State.vote.round = 2;
    State.vote.pk = false;
    State.vote.electorate = aliveSeats();
    State.vote.candidates = aliveSeats();
    State.vote.cursor = 0;
    State.vote.ballots = {};
    State.vote.tally = {};
    save();

    $("modalVote")?.classList.remove("hidden");
    renderVoteModal();
  }

  function tieNoOne(){
    closeTieModal();
    openExecuteModal("平票選擇：無人放逐。", null);
  }

  /* Execute + skill */
  function openExecuteModal(text, seat){
    $("modalExecute")?.classList.remove("hidden");
    $("executeText") && ($("executeText").innerHTML = text);
    // 把 seat 暫存
    $("modalExecute").dataset.seat = seat!=null ? String(seat) : "";
  }
  function closeExecuteModal(){
    $("modalExecute")?.classList.add("hidden");
  }

  function executeSeat(seat, reason){
    const p=State.players.find(x=>x.seat===seat);
    if(!p || !p.alive){
      openExecuteModal("目標不存在或已死亡。", null);
      return;
    }
    p.alive=false;
    p.diedBy = reason || "vote";
    save();

    openExecuteModal(`本輪放逐：<b>${seat} 號</b>。`, seat);

    // 立即做勝負檢查（有人出局後）
    // 技能若要觸發，會在 executeOk 之後判斷
  }

  function openSkillModal(kind, deadSeat){
    // kind: "hunter" | "blackWolfKing"
    const alive = aliveSeats().filter(s=>s!==deadSeat);
    $("modalSkill")?.classList.remove("hidden");
    $("modalSkill").dataset.kind = kind;
    $("modalSkill").dataset.deadSeat = String(deadSeat);
    $("modalSkill").dataset.pick = "";

    const name = kind==="hunter" ? "獵人" : "黑狼王";
    $("skillHint") && ($("skillHint").innerHTML = `${deadSeat} 號為<b>${name}</b>，可選擇帶走 1 人（點座位）。`);

    const box=$("skillTargets");
    if(!box) return;
    box.innerHTML="";
    alive.forEach(seat=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="seat";
      b.textContent=String(seat);
      b.onclick=()=>{
        $("modalSkill").dataset.pick = String(seat);
        // 讓按鈕有 selected 感
        Array.from(box.children).forEach(x=>x.classList.remove("selected"));
        b.classList.add("selected");
      };
      box.appendChild(b);
    });
  }
  function closeSkillModal(){ $("modalSkill")?.classList.add("hidden"); }

  function applySkill(){
    const kind = $("modalSkill").dataset.kind;
    const deadSeat = Number($("modalSkill").dataset.deadSeat||0);
    const pick = Number($("modalSkill").dataset.pick||0);

    if(!pick){
      closeSkillModal();
      checkWinAndShow();
      return;
    }
    const target = State.players.find(x=>x.seat===pick);
    if(target && target.alive){
      target.alive=false;
      target.diedBy = (kind==="hunter") ? "hunterShot" : "blackWolfKingBoom";
    }
    save();
    closeSkillModal();
    renderDayUI();
    checkWinAndShow();
  }

  function canUseDeathSkill(deadSeat){
    // 你的需求：「被毒禁用」
    const p=State.players.find(x=>x.seat===deadSeat);
    if(!p) return false;
    if(p.diedBy==="witchPoison") return false;
    return true;
  }

  /* Win check (簡化版：若你有 win.engine 之後可接) */
  function checkWin(){
    // 若有 WW_WIN_ENGINE，就交給它
    const WE = window.WW_WIN_ENGINE || getWW()?.engines?.win || null;
    if(WE && typeof WE.checkWin==="function"){
      try{
        return WE.checkWin({players:State.players, boardId:State.boardId, settings:State.settings});
      }catch(e){
        console.warn("win engine error:", e);
      }
    }

    // fallback：狼全滅 => 好人勝；好人(非狼) <= 狼 => 狼勝
    const alive = State.players.filter(p=>p.alive);
    const wolves = alive.filter(p=>String(p.team).includes("wolf") || p.roleId.includes("wolf") || p.roleId==="werewolf");
    const good = alive.length - wolves.length;

    if(wolves.length===0) return {ended:true, winner:"villager", text:"🐻 勝負判定：狼人全滅，好人陣營勝利！"};
    if(good<=wolves.length) return {ended:true, winner:"wolf", text:"🐺 勝負判定：狼人達成屠邊/屠城條件，狼人勝利！"};
    return {ended:false};
  }

  function checkWinAndShow(){
    const r = checkWin();
    if(!r.ended) return false;
    $("modalWin")?.classList.remove("hidden");
    $("winText") && ($("winText").innerHTML = r.text || "遊戲結束");
    save();
    return true;
  }

  /* God + restart */
  function setGod(onFlag){
    State.godView=!!onFlag;
    document.body.classList.toggle("god-on", State.godView);
    $("btnGodToggle") && ($("btnGodToggle").textContent = State.godView ? "🔓" : "🔒");
    $("fabGod") && ($("fabGod").textContent = State.godView ? "🔓" : "🔒");
    save();
    renderAnnouncement();
    renderNight();
  }
  function toggleGod(){ setGod(!State.godView); }

  function ensureRestartButton(){
    const host=document.querySelector(".top-actions");
    if(!host) return;
    if($("btnRestart")) return;
    const b=document.createElement("button");
    b.id="btnRestart";
    b.className="iconbtn";
    b.type="button";
    b.title="重新開始";
    b.textContent="🔁";
    b.onclick=()=>{
      if(!confirm("確定要重新開始？所有進度會清除並回到開局設定。")) return;
      clearSave();
      location.reload();
    };
    host.insertBefore(b, host.firstChild);
  }

  /* Day -> next night */
  function nextDayToNight(){
    // 每天結束前檢查勝負（若已結束就不進夜）
    if(checkWinAndShow()) return;

    State.nightNo += 1;
    State.dayNo += 1;

    initNightForNewRound();
    showScreen("night");
    save();
  }

  /* Start game */
  function startGame(){
    const WW=getWW();
    if(!WW){
      alert("❌ 找不到 WW_DATA（請確認 data/ww.data.js 有載入，且路徑正確）");
      return;
    }
    if(!State.rolesCount) State.rolesCount=getSuggestedRolesCount(State.boardId, State.playerCount);
    if(rolesTotal(State.rolesCount)!==State.playerCount){
      alert("⚠️ 角色總數必須等於玩家人數");
      return;
    }
    buildPlayersFromRolesCount();
    showScreen("deal");
    renderDeal();
  }

  /* Role config modal (簡版) */
  function openRoleConfig(){
    const body=$("roleConfigBody");
    if(!body) return;
    body.innerHTML="";
    const ids=Object.keys(getRolesMap());
    const priority=["werewolf","villager","seer","witch","hunter","guard","knight","blackWolfKing","whiteWolfKing"];
    const ordered=Array.from(new Set([...priority, ...ids]));
    State.rolesCount=State.rolesCount||{};

    const tip=document.createElement("div");
    tip.className="hint";
    tip.style.marginBottom="10px";
    tip.textContent="點＋/－調整數量；角色總數需等於玩家人數才能開始。";
    body.appendChild(tip);

    ordered.forEach(rid=>{
      const info=getRole(rid);
      const row=document.createElement("div");
      row.style.display="flex";
      row.style.alignItems="center";
      row.style.justifyContent="space-between";
      row.style.padding="10px 4px";
      row.style.borderBottom="1px dashed rgba(0,0,0,.08)";

      const left=document.createElement("div");
      left.style.fontWeight="900";
      left.textContent=`${info.icon?info.icon+" ":""}${info.name||rid}`;

      const right=document.createElement("div");
      right.style.display="flex";
      right.style.alignItems="center";
      right.style.gap="10px";

      const minus=document.createElement("button");
      minus.type="button";
      minus.className="btn ghost tiny";
      minus.textContent="－";

      const num=document.createElement("div");
      num.style.minWidth="36px";
      num.style.textAlign="center";
      num.style.fontWeight="900";
      num.textContent=String(State.rolesCount?.[rid] ?? 0);

      const plus=document.createElement("button");
      plus.type="button";
      plus.className="btn ghost tiny";
      plus.textContent="＋";

      minus.onclick=()=>{
        State.rolesCount[rid]=Math.max(0,(State.rolesCount[rid]||0)-1);
        num.textContent=String(State.rolesCount[rid]);
        syncSetupUI();
      };
      plus.onclick=()=>{
        State.rolesCount[rid]=(State.rolesCount[rid]||0)+1;
        num.textContent=String(State.rolesCount[rid]);
        syncSetupUI();
      };

      right.append(minus,num,plus);
      row.append(left,right);
      body.appendChild(row);
    });

    $("modalRole")?.classList.remove("hidden");
  }

  /* Bind */
  function bind(){
    ensureRestartButton();

    // Setup
    on($("boardBasic"),"click",()=>setBoard("basic"));
    on($("boardSpecial"),"click",()=>setBoard("b1"));
    on($("btnPlus"),"click",()=>setPlayerCount(State.playerCount+1));
    on($("btnMinus"),"click",()=>setPlayerCount(State.playerCount-1));
    on($("rangeCount"),"input",(e)=>setPlayerCount(e.target.value));

    on($("btnSuggest"),"click",()=>{
      State.rolesCount=getSuggestedRolesCount(State.boardId, State.playerCount);
      syncSetupUI();
    });
    on($("btnOpenRoleConfig"),"click",openRoleConfig);
    on($("closeRole"),"click",()=>$("modalRole")?.classList.add("hidden"));
    on($("roleReset"),"click",()=>{
      State.rolesCount=getSuggestedRolesCount(State.boardId, State.playerCount);
      openRoleConfig();
      syncSetupUI();
    });
    on($("roleApply"),"click",()=>$("modalRole")?.classList.add("hidden"));

    on($("btnStart"),"click",startGame);

    // Deal
    on($("btnNextPlayer"),"click",nextDeal);
    on($("btnDealBack"),"click",()=>{ hideReveal(); showScreen("setup"); });
    on($("btnFinishDeal"),"click",openDealConfirm);
    on($("dealConfirmNo"),"click",closeDealConfirm);
    on($("dealConfirmYes"),"click",()=>{
      closeDealConfirm();
      showScreen("night");
      initNightForNewRound();
    });

    // Night
    on($("btnNightPrev"),"click",nightPrev);
    on($("btnNightNext"),"click",nightNext);

    // Witch
    on($("btnWitchSave"),"click",()=>{ State.witch.save=true; save(); renderWitchModal(); });
    on($("btnWitchNoSave"),"click",()=>{ State.witch.save=false; save(); renderWitchModal(); });
    on($("btnWitchPoisonPick"),"click",()=>{
      if(State.witch.poisonUsed) return;
      State._pickPoisonMode=true;
      save();
      $("modalWitch")?.classList.add("hidden");
      alert("請在座位圈點選要毒的人");
      renderNight();
    });
    on($("btnWitchNoPoison"),"click",()=>{
      State._pickPoisonMode=false;
      State.witch.poisonTarget=null;
      save();
      renderWitchModal();
      renderNight();
    });
    on($("btnWitchDone"),"click",()=>{
      State._pickPoisonMode=false;
      $("modalWitch")?.classList.add("hidden");
      State.nightStepIndex=Math.min(State.nightSteps.length-1, State.nightStepIndex+1);
      save();
      renderNight();
    });

    // Day
    on($("btnKillToggle"),"click",toggleKillMode);
    on($("btnSpeechTimer"),"click",openTimer);
    on($("btnDayNext"),"click",nextDayToNight);

    on($("btnStartVote"),"click",openVote);

    // Timer modal
    on($("closeTimer"),"click",closeTimer);
    on($("timerStart"),"click",timerStart);
    on($("timerStop"),"click",timerStop);
    on($("timerReset"),"click",timerReset);
    on($("timerMinus10"),"click",()=>{ State.timer.sec=Math.max(0,State.timer.sec-10); renderTimer(); save(); });
    on($("timerPlus10"),"click",()=>{ State.timer.sec=Math.min(60*10,State.timer.sec+10); renderTimer(); save(); });

    // Vote modal
    on($("closeVote"),"click",closeVote);
    on($("voteSkip"),"click",voteSkip);
    on($("voteNext"),"click",voteNext);

    // Tie modal
    on($("closeTie"),"click",closeTieModal);
    on($("tiePK"),"click",tiePK);
    on($("tieRevote"),"click",tieRevote);
    on($("tieNoOne"),"click",tieNoOne);

    // Execute modal
    on($("closeExecute"),"click",closeExecuteModal);
    on($("executeOk"),"click",()=>{
      const seat = Number($("modalExecute")?.dataset.seat || 0) || null;
      closeExecuteModal();
      renderDayUI();

      // 若有被放逐者，檢查技能（獵人/黑狼王）
      if(seat!=null){
        const dead = State.players.find(p=>p.seat===seat);
        if(dead){
          const rid = dead.roleId;
          const isHunter = rid==="hunter";
          const isBlackWolfKing = rid==="blackWolfKing";

          // 被毒禁用規則（你要的）
          const okSkill = canUseDeathSkill(seat);

          if(isHunter && okSkill){
            openSkillModal("hunter", seat);
            return;
          }
          if(isBlackWolfKing && okSkill){
            openSkillModal("blackWolfKing", seat);
            return;
          }
        }
      }
      checkWinAndShow();
    });

    // Skill modal
    on($("closeSkill"),"click",closeSkillModal);
    on($("skillSkip"),"click",()=>{
      closeSkillModal();
      checkWinAndShow();
    });
    on($("skillApply"),"click",applySkill);

    // Win modal
    on($("closeWin"),"click",()=>$("modalWin")?.classList.add("hidden"));
    on($("winOk"),"click",()=>$("modalWin")?.classList.add("hidden"));

    // God
    on($("btnGodToggle"),"click",toggleGod);
    on($("fabGod"),"click",toggleGod);

    // Announcement
    on($("btnOpenAnnouncement"),"click",()=>openAnnouncementModal(true));
    on($("fabAnn"),"click",()=>openAnnouncementModal(true));
    on($("btnOpenAnnouncement2"),"click",()=>openAnnouncementModal(true));
    on($("closeAnn"),"click",()=>$("modalAnn")?.classList.add("hidden"));
    on($("annToday"),"click",()=>{
      annMode="today";
      $("annToday")?.classList.add("active");
      $("annHistory")?.classList.remove("active");
      renderAnnouncement();
    });
    on($("annHistory"),"click",()=>{
      annMode="history";
      $("annHistory")?.classList.add("active");
      $("annToday")?.classList.remove("active");
      renderAnnouncement();
    });

    on($("btnExport"),"click",exportReplay);
    on($("btnCopyAnn"),"click",async ()=>{
      try{
        await navigator.clipboard.writeText($("annBox")?.textContent||"");
        alert("已複製");
      }catch(e){
        alert("複製失敗（可能需要 HTTPS / PWA 安裝）");
      }
    });
  }

  /* Boot */
  function boot(){
    load();
    ensureRestartButton();

    State.rolesCount = State.rolesCount || getSuggestedRolesCount(State.boardId, State.playerCount);
    $("rangeCount") && ($("rangeCount").value = String(State.playerCount));
    setBoard(State.boardId); // 會 sync

    setGod(!!State.godView);
    bind();

    showScreen(State.phase || "setup");

    if(State.phase==="deal") renderDeal();
    if(State.phase==="night"){
      if(!State.nightSteps || !State.nightSteps.length) resolveNightStepsForThisGame();
      renderNight();
    }
    if(State.phase==="day"){
      renderDayUI();
      renderAnnouncement();
    }
  }

  boot();
})();