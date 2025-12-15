/* =========================================================
   狼人殺｜上帝輔助 PWA（重新設計核心 v1）
   app.js

   依賴（按 index.html script 順序）：
   - WW_DATA        (data/ww.data.js)
   - WW_NIGHT       (data/flow/night.steps.js)
   - WW_RULES       (data/rules.core.js)
   - WW_DAY         (data/flow/day.flow.js)

   原則：
   - UI 只靠 index.html 的 id
   - 流程只靠 WW_* 模組
========================================================= */

(() => {
  /* =========================
     DOM Helpers
  ========================= */
  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const nowISO = () => new Date().toISOString();

  /* =========================
     防止 iOS 長按選字/放大（最後一道保險）
  ========================= */
  try {
    document.documentElement.style.webkitUserSelect = "none";
    document.documentElement.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";
    document.body.style.userSelect = "none";
  } catch (e) {}
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("contextmenu", (e) => e.preventDefault());

  /* =========================
     Data modules
  ========================= */
  const DATA = window.WW_DATA;
  const NIGHT = window.WW_NIGHT;
  const RULES = window.WW_RULES;
  const DAY = window.WW_DAY;

  if(!DATA || !NIGHT || !RULES || !DAY){
    alert("缺少必要資料檔：請確認 /data 內檔案是否都已放好並正確引用。");
    return;
  }

  /* =========================
     Storage
  ========================= */
  const STORAGE_KEY = "ww_god_pwa_v2";
  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    }catch(e){ return null; }
  }
  function saveState(){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(State)); }catch(e){}
  }
  function clearState(){
    try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
  }

  /* =========================
     Core State
  ========================= */
  const defaultBoardId = "basic";
  const defaultCount = 9;

  function presetRoles(boardId, count){
    const b = DATA.boards[boardId];
    if(b?.presets?.[count]) return structuredClone(b.presets[count]);
    // fallback：用 basic 的 9
    return structuredClone(DATA.boards.basic.presets[defaultCount]);
  }

  const State = {
    // view
    phase: "setup", // setup|deal|night|day
    godUnlocked: false,
    godView: false,
    pin: "0000",

    // setup
    boardId: defaultBoardId,
    playerCount: defaultCount,
    rolesCount: presetRoles(defaultBoardId, defaultCount),

    rules: {
      ...DATA.defaultRules,
      kidMode: false
    },

    // game
    players: [],   // {seat, roleId, team, alive, isChief}
    dealIndex: 0,  // current seat index (0-based)

    nightNo: 1,
    dayNo: 1,

    // night state
    night: {
      prevGuardTarget: null,

      guardTarget: null,
      wolfTarget: null,          // null = 空刀
      seerCheckTarget: null,
      seerResult: null,

      witchSaveUsed: false,
      witchPoisonUsed: false,
      witchSave: false,
      witchPoisonTarget: null
    },

    nightSteps: [],
    nightStepIndex: 0,

    // day tools
    policeSession: null,
    speechSession: null,
    voteSession: null,
    voteRound: 1,                 // 1 or 2
    voteRestrictTargets: null,     // null or [seats] for PK
    lastTieTops: null,

    // skill queue
    skillQueue: [],               // {roleId, seat, kind}
    lastResolved: null,           // last night resolve for poison reason check

    // logs for replay
    logs: [] // newest first: {ts, nightNo, dayNo, publicText, hiddenText, votes, actions}
  };

  // restore
  const saved = loadState();
  if(saved && saved.players && Array.isArray(saved.players)){
    Object.assign(State, saved);
    // merge default rules to avoid missing keys
    State.rules = Object.assign({ ...DATA.defaultRules, kidMode:false }, State.rules||{});
  }

  /* =========================
     Screens
  ========================= */
  const Screens = {
    setup: $("screen-setup"),
    deal:  $("screen-deal"),
    night: $("screen-night"),
    day:   $("screen-day")
  };
  function showScreen(name){
    Object.values(Screens).forEach(s=>s && s.classList.remove("active"));
    Screens[name]?.classList.add("active");
    State.phase = name;
    saveState();
  }

  /* =========================
     Role helpers
  ========================= */
  function roleInfo(roleId){
    return DATA.roles[roleId] || { id:roleId, name:roleId, team:"villager", icon:"❔" };
  }
  function alivePlayers(){
    return State.players.filter(p=>p.alive);
  }
  function aliveSeats(){
    return alivePlayers().map(p=>p.seat);
  }
  function bySeat(seat){
    return State.players.find(p=>p.seat===seat) || null;
  }

  /* =========================
     Setup UI bindings
  ========================= */
  const elPlayerCount = $("playerCount");
  const elRoleTotal = $("roleTotal");
  const elPlayerTotal = $("playerTotal");
  const warnRoleTotal = $("warnRoleTotal");
  const rangeCount = $("rangeCount");

  function rolesTotal(){
    return Object.values(State.rolesCount||{}).reduce((a,b)=>a+(b||0),0);
  }

  function syncRuleCheckboxes(){
    const map = {
      rule_noConsecutiveGuard:"noConsecutiveGuard",
      rule_wolfCanSkip:"wolfCanSkip",
      rule_witchCannotSelfSave:"witchCannotSelfSave",
      rule_hunterPoisonNoShoot:"hunterPoisonNoShoot",
      rule_blackWolfKingPoisonNoSkill:"blackWolfKingPoisonNoSkill",
      rule_saveHitsGuardMakesDeath:"saveHitsGuardMakesDeath",
      rule_kidMode:"kidMode"
    };
    Object.keys(map).forEach(id=>{
      const key = map[id];
      const el = $(id);
      if(el) el.checked = !!State.rules[key];
    });
  }

  function syncSetupUI(){
    if(elPlayerCount) elPlayerCount.textContent = String(State.playerCount);
    if(elPlayerTotal) elPlayerTotal.textContent = String(State.playerCount);
    if(rangeCount) rangeCount.value = String(State.playerCount);

    const rt = rolesTotal();
    if(elRoleTotal) elRoleTotal.textContent = String(rt);

    const ok = rt === State.playerCount;
    warnRoleTotal?.classList.toggle("hidden", ok);

    const btnStart = $("btnStart");
    if(btnStart){
      btnStart.disabled = !ok;
      btnStart.textContent = ok ? "開始 → 抽身分" : "⚠️ 角色數需等於玩家數";
    }

    syncRuleCheckboxes();
    saveState();
  }

  function setBoard(boardId){
    State.boardId = boardId;
    // set UI pill active
    $("boardBasic")?.classList.toggle("active", boardId==="basic");
    $("boardSpecialB1")?.classList.toggle("active", boardId==="special_b1");

    // reset preset
    State.rolesCount = presetRoles(boardId, State.playerCount);
    syncSetupUI();
  }

  on($("boardBasic"), "click", ()=>setBoard("basic"));
  on($("boardSpecialB1"), "click", ()=>setBoard("special_b1"));

  on($("btnPlus"), "click", ()=>{
    State.playerCount = clamp(State.playerCount+1, 6, 12);
    State.rolesCount = presetRoles(State.boardId, State.playerCount);
    syncSetupUI();
  });
  on($("btnMinus"), "click", ()=>{
    State.playerCount = clamp(State.playerCount-1, 6, 12);
    State.rolesCount = presetRoles(State.boardId, State.playerCount);
    syncSetupUI();
  });
  on(rangeCount, "input", (e)=>{
    State.playerCount = clamp(Number(e.target.value), 6, 12);
    State.rolesCount = presetRoles(State.boardId, State.playerCount);
    syncSetupUI();
  });

  on($("btnSuggest"), "click", ()=>{
    State.rolesCount = presetRoles(State.boardId, State.playerCount);
    syncSetupUI();
  });

  // rules toggles
  const ruleMap = {
    rule_noConsecutiveGuard:"noConsecutiveGuard",
    rule_wolfCanSkip:"wolfCanSkip",
    rule_witchCannotSelfSave:"witchCannotSelfSave",
    rule_hunterPoisonNoShoot:"hunterPoisonNoShoot",
    rule_blackWolfKingPoisonNoSkill:"blackWolfKingPoisonNoSkill",
    rule_saveHitsGuardMakesDeath:"saveHitsGuardMakesDeath",
    rule_kidMode:"kidMode"
  };
  Object.entries(ruleMap).forEach(([id,key])=>{
    on($(id),"change",(e)=>{
      State.rules[key] = !!e.target.checked;
      saveState();
    });
  });

  /* =========================
     Role config modal
  ========================= */
  const modalRole = $("modalRole");
  const roleConfigBody = $("roleConfigBody");

  function roleRow(roleId){
    const info = roleInfo(roleId);
    const wrap = document.createElement("div");
    wrap.className = "role-row";
    wrap.innerHTML = `
      <div class="role-left"><b>${info.icon ? info.icon+" " : ""}${info.name}</b></div>
      <div class="role-right">
        <button class="btn ghost tiny" type="button">－</button>
        <div class="role-num"></div>
        <button class="btn ghost tiny" type="button">＋</button>
      </div>
    `;
    const minus = wrap.querySelectorAll("button")[0];
    const plus  = wrap.querySelectorAll("button")[1];
    const num   = wrap.querySelector(".role-num");
    const setNum = ()=> num.textContent = String(State.rolesCount[roleId]||0);
    setNum();

    minus.onclick = ()=>{
      State.rolesCount[roleId] = Math.max(0,(State.rolesCount[roleId]||0)-1);
      setNum(); syncSetupUI();
    };
    plus.onclick = ()=>{
      State.rolesCount[roleId] = (State.rolesCount[roleId]||0)+1;
      setNum(); syncSetupUI();
    };
    return wrap;
  }

  function renderRoleConfig(){
    if(!roleConfigBody) return;
    roleConfigBody.innerHTML = "";

    const tip = document.createElement("div");
    tip.className = "hint";
    tip.textContent = "提示：角色總數必須等於玩家人數才能開始。";
    roleConfigBody.appendChild(tip);

    // 根據板子顯示常用角色（仍可擴：先給你核心）
    const baseList = ["werewolf","villager","seer","witch","hunter","guard"];
    const specialExtra = ["knight","blackWolfKing","whiteWolfKing"];
    const list = State.boardId==="basic" ? baseList : baseList.concat(specialExtra);

    list.forEach(rid=>{
      if(!DATA.roles[rid]) return;
      roleConfigBody.appendChild(roleRow(rid));
    });
  }

  on($("btnOpenRoleConfig"), "click", ()=>{
    renderRoleConfig();
    modalRole?.classList.remove("hidden");
  });
  on($("closeRole"), "click", ()=> modalRole?.classList.add("hidden"));
  on($("roleReset"), "click", ()=>{
    State.rolesCount = presetRoles(State.boardId, State.playerCount);
    renderRoleConfig();
    syncSetupUI();
  });
  on($("roleApply"), "click", ()=>{
    modalRole?.classList.add("hidden");
    syncSetupUI();
  });

  /* =========================
     Build players & Deal
  ========================= */
  const dealText = $("dealText");
  const dealSeats = $("dealSeats");

  function buildPlayers(){
    // build role array
    const arr = [];
    Object.entries(State.rolesCount).forEach(([rid,cnt])=>{
      for(let i=0;i<(cnt||0);i++) arr.push(rid);
    });
    // shuffle
    for(let i=arr.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    State.players = arr.map((rid,idx)=>{
      const r = roleInfo(rid);
      return {
        seat: idx+1,
        roleId: rid,
        team: r.team || "villager",
        alive: true,
        isChief: false,
        notes: ""
      };
    });

    State.dealIndex = 0;
    State.nightNo = 1;
    State.dayNo = 1;
    State.logs = [];
    State.skillQueue = [];
    State.lastResolved = null;

    // reset night state
    State.night = {
      prevGuardTarget: null,
      guardTarget: null,
      wolfTarget: null,
      seerCheckTarget: null,
      seerResult: null,
      witchSaveUsed: false,
      witchPoisonUsed: false,
      witchSave: false,
      witchPoisonTarget: null
    };

    // reset day
    State.policeSession = null;
    State.speechSession = null;
    State.voteSession = null;
    State.voteRound = 1;
    State.voteRestrictTargets = null;
    State.lastTieTops = null;

    saveState();
  }

  function renderDealSeats(){
    if(!dealSeats) return;
    dealSeats.innerHTML = "";
    for(let i=1;i<=State.players.length;i++){
      const b = document.createElement("button");
      b.type="button";
      b.className = "seat";
      b.textContent = String(i);
      if(i === State.dealIndex+1) b.classList.add("selected");
      b.onclick = ()=>{
        State.dealIndex = i-1;
        updateDealPrompt();
        renderDealSeats();
        saveState();
      };
      dealSeats.appendChild(b);
    }
  }

  function updateDealPrompt(){
    const seat = State.dealIndex + 1;
    if(dealText){
      dealText.innerHTML = seat<=State.players.length
        ? `請 <b>${seat} 號</b> 拿手機`
        : `所有玩家已抽完身分`;
    }
  }

  on($("btnStart"), "click", ()=>{
    if(rolesTotal() !== State.playerCount) return;
    buildPlayers();
    showScreen("deal");
    updateDealPrompt();
    renderDealSeats();
  });

  on($("btnDealBack"), "click", ()=>{
    hideReveal();
    showScreen("setup");
  });

  on($("btnNextPlayer"), "click", ()=>{
    hideReveal();
    State.dealIndex = Math.min(State.players.length, State.dealIndex+1);
    updateDealPrompt();
    renderDealSeats();
    saveState();
  });

  // 必須確認後才能進夜晚（兩段按鈕）
  let dealConfirmed = false;
  on($("btnFinishDeal"), "click", ()=>{
    if(State.dealIndex < State.players.length-1){
      alert("還有人沒抽完，可先按「下一位」完成所有人抽牌。");
      return;
    }
    dealConfirmed = confirm("確認所有玩家都已抽完並看過身分？\n按「確定」後可進入夜晚。");
    if(dealConfirmed){
      alert("已確認。請按下方「進夜晚（需要確認）」進入夜晚流程。");
    }
  });

  on($("btnGoNight"), "click", ()=>{
    if(!dealConfirmed){
      alert("請先按「✅ 全部抽完 → 確認進入夜晚」並確認。");
      return;
    }
    initNight();
    showScreen("night");
    renderNight();
  });

  /* =========================
     Reveal modal (long press)
  ========================= */
  const modalReveal = $("modalReveal");
  const revealCard = $("revealCard");
  const revealRole = $("revealRole");
  const revealIcon = $("revealIcon");

  let holdTimer = null;
  let showing = false;

  function showReveal(){
    if(State.dealIndex >= State.players.length) return;
    const p = State.players[State.dealIndex];
    const r = roleInfo(p.roleId);

    if(revealRole) revealRole.textContent = r.name;
    if(revealIcon) revealIcon.textContent = r.icon || "❔";

    modalReveal?.classList.remove("hidden");
    revealCard?.classList.add("flipped");
    showing = true;
    navigator.vibrate?.(60);
  }

  function hideReveal(){
    if(!showing) return;
    revealCard?.classList.remove("flipped");
    modalReveal?.classList.add("hidden");
    showing = false;
  }

  on($("closeReveal"), "click", hideReveal);
  on($("revealOk"), "click", hideReveal);

  const btnHold = $("btnHoldReveal");
  if(btnHold){
    const startHold = (e)=>{
      e.preventDefault();
      clearTimeout(holdTimer);
      holdTimer = setTimeout(showReveal, 1200);
    };
    const endHold = (e)=>{
      e.preventDefault();
      clearTimeout(holdTimer);
      hideReveal();
    };
    on(btnHold, "touchstart", startHold, {passive:false});
    on(btnHold, "touchend", endHold, {passive:false});
    on(btnHold, "touchcancel", endHold, {passive:false});
    on(btnHold, "mousedown", startHold);
    on(btnHold, "mouseup", endHold);
    on(btnHold, "mouseleave", endHold);
  }

  /* =========================
     God view (PIN)
  ========================= */
  const btnGodToggle = $("btnGodToggle");
  const fabGod = $("fabGod");

  function setGodView(on){
    State.godView = !!on;
    document.body.classList.toggle("god-on", State.godView);
    const icon = State.godView ? "🔓" : "🔒";
    if(btnGodToggle) btnGodToggle.textContent = icon;
    if(fabGod) fabGod.textContent = icon;
    saveState();
    renderAnnTodayBox();
  }

  function openGodModal(){
    $("pinInput").value="";
    $("pinWarn")?.classList.add("hidden");
    $("modalGod")?.classList.remove("hidden");
    $("pinInput")?.focus?.();
  }

  function toggleGod(){
    if(State.godView){
      setGodView(false);
      return;
    }
    if(State.godUnlocked){
      setGodView(true);
      return;
    }
    openGodModal();
  }

  on(btnGodToggle, "click", toggleGod);
  on(fabGod, "click", toggleGod);
  on($("closeGod"), "click", ()=> $("modalGod")?.classList.add("hidden"));
  on($("pinCancel"), "click", ()=> $("modalGod")?.classList.add("hidden"));
  on($("pinOk"), "click", ()=>{
    const v = ($("pinInput").value||"").trim();
    if(v === State.pin){
      State.godUnlocked = true;
      $("modalGod")?.classList.add("hidden");
      setGodView(true);
    }else{
      $("pinWarn")?.classList.remove("hidden");
    }
  });

  /* =========================
     Announcement center + logs + export
  ========================= */
  const modalAnn = $("modalAnn");
  const annBox = $("annBox");
  const annTodayBox = $("annTodayBox");
  let annMode = "today"; // today|history

  function latestLog(){
    return State.logs[0] || null;
  }

  function renderAnnTodayBox(){
    if(!annTodayBox) return;
    const l = latestLog();
    if(!l){
      annTodayBox.textContent="（尚無公告）";
      return;
    }
    annTodayBox.textContent = l.publicText || "（尚無公告）";
  }

  function renderAnnModal(){
    if(!annBox) return;

    if(annMode === "today"){
      const l = latestLog();
      if(!l){
        annBox.textContent="（尚無公告）";
      }else{
        annBox.textContent = State.godView
          ? (l.publicText + "\n\n" + (l.hiddenText||""))
          : l.publicText;
      }
    } else {
      if(!State.logs.length){
        annBox.textContent="（尚無歷史公告）";
      } else {
        const lines=[];
        State.logs.forEach((l,idx)=>{
          lines.push(`#${State.logs.length-idx}｜第${l.nightNo}夜 / 第${l.dayNo}天`);
          lines.push(l.publicText||"—");
          if(State.godView && l.hiddenText) lines.push("\n"+l.hiddenText);
          if(State.godView && l.votes){
            lines.push("\n【票型】");
            l.votes.forEach(v=>{
              lines.push(`${v.fromSeat}→${v.toSeat==null?"棄票":(v.toSeat+"")}`);
            });
          }
          lines.push("—");
        });
        annBox.textContent = lines.join("\n");
      }
    }
  }

  function openAnn(forceToday=false){
    if(forceToday) annMode="today";
    $("annToday")?.classList.toggle("ghost", annMode!=="today");
    $("annHistory")?.classList.toggle("ghost", annMode!=="history");
    modalAnn?.classList.remove("hidden");
    renderAnnModal();
    renderAnnTodayBox();
  }

  on($("btnOpenAnnouncement"), "click", ()=>openAnn(true));
  on($("btnOpenAnnouncement2"), "click", ()=>openAnn(true));
  on($("btnOpenAnnouncement3"), "click", ()=>openAnn(true));
  on($("fabAnn"), "click", ()=>openAnn(true));
  on($("closeAnn"), "click", ()=> modalAnn?.classList.add("hidden"));

  on($("annToday"), "click", ()=>{
    annMode="today";
    renderAnnModal();
  });
  on($("annHistory"), "click", ()=>{
    annMode="history";
    renderAnnModal();
  });

  on($("btnCopyAnn"), "click", async ()=>{
    try{
      await navigator.clipboard.writeText(annBox?.textContent||"");
      alert("已複製");
    }catch(e){
      alert("複製失敗：可能需要 HTTPS 或已安裝成 PWA。");
    }
  });

  // logs modal
  const modalLog = $("modalLog");
  const logList = $("logList");
  function renderLogs(){
    if(!logList) return;
    logList.innerHTML="";
    if(!State.logs.length){
      logList.textContent="（尚無）";
      return;
    }
    State.logs.forEach(l=>{
      const d = document.createElement("div");
      d.className="logitem";
      d.innerHTML = `
        <div class="logtitle">第${l.nightNo}夜 / 第${l.dayNo}天｜${new Date(l.ts).toLocaleString()}</div>
        <pre class="logtext">${State.godView ? (l.publicText+"\n\n"+(l.hiddenText||"")) : l.publicText}</pre>
      `;
      logList.appendChild(d);
    });
  }
  on($("btnOpenLog"), "click", ()=>{ renderLogs(); modalLog?.classList.remove("hidden"); });
  on($("btnOpenLog2"), "click", ()=>{ renderLogs(); modalLog?.classList.remove("hidden"); });
  on($("closeLog"), "click", ()=> modalLog?.classList.add("hidden"));
  on($("btnCloseLog2"), "click", ()=> modalLog?.classList.add("hidden"));

  // export
  function downloadJSON(filename, obj){
    const blob = new Blob([JSON.stringify(obj,null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download=filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 500);
  }
  function exportReplay(){
    const includeSecrets = !!State.godView;
    const payload = {
      exportedAt: nowISO(),
      includeSecrets,
      state: includeSecrets ? State : scrubSecrets(State)
    };
    downloadJSON(`狼人殺復盤_${Date.now()}.json`, payload);
  }
  function scrubSecrets(state){
    const s = structuredClone(state);
    // remove identities for player view export
    s.players = s.players.map(p=>({ seat:p.seat, alive:p.alive, isChief:p.isChief }));
    s.night = { ...s.night, seerResult:null };
    s.logs = s.logs.map(l=>({ ts:l.ts, nightNo:l.nightNo, dayNo:l.dayNo, publicText:l.publicText }));
    return s;
  }
  on($("btnExport"), "click", exportReplay);
  on($("btnExport2"), "click", exportReplay);
  on($("btnExportFromLog"), "click", exportReplay);

  // clear save
  on($("btnClearSave"), "click", ()=>{
    if(confirm("確定清除本局存檔與復盤？")){
      clearState();
      location.reload();
    }
  });

  /* =========================
     Restart confirm
  ========================= */
  const modalRestart = $("modalRestart");
  on($("btnRestart"), "click", ()=> modalRestart?.classList.remove("hidden"));
  on($("closeRestart"), "click", ()=> modalRestart?.classList.add("hidden"));
  on($("restartCancel"), "click", ()=> modalRestart?.classList.add("hidden"));
  on($("restartOk"), "click", ()=>{
    clearState();
    location.reload();
  });

  /* =========================
     Night init/render
  ========================= */
  const nightTag = $("nightTag");
  const nightScript = $("nightScript");
  const nightSeats = $("nightSeats");

  function resetNightSelectionsKeepUsage(){
    const keepSaveUsed = !!State.night.witchSaveUsed;
    const keepPoisonUsed = !!State.night.witchPoisonUsed;
    const prevGuard = State.night.prevGuardTarget ?? null;

    State.night = {
      prevGuardTarget: prevGuard,
      guardTarget: null,
      wolfTarget: null,
      seerCheckTarget: null,
      seerResult: null,
      witchSaveUsed: keepSaveUsed,
      witchPoisonUsed: keepPoisonUsed,
      witchSave: false,
      witchPoisonTarget: null
    };
  }

  function initNight(){
    resetNightSelectionsKeepUsage();
    State.nightSteps = NIGHT.buildNightSteps({
      players: State.players,
      boardId: State.boardId,
      rules: State.rules,
      nightState: State.night
    });
    State.nightStepIndex = 0;
    saveState();
  }

  function currentStep(){
    return State.nightSteps[State.nightStepIndex] || null;
  }

  function renderNightSeats(pickMode){
    if(!nightSeats) return;
    nightSeats.innerHTML = "";

    State.players.forEach(p=>{
      const b=document.createElement("button");
      b.type="button";
      b.className = "seat" + (p.alive ? "" : " dead");
      b.textContent = String(p.seat);

      if(!p.alive) b.disabled = true;

      b.onclick = ()=>{
        if(!p.alive) return;

        // pickMode could be: "guardTarget" | "wolfTarget" | "seerCheckTarget" | "witchPoisonTarget"
        if(pickMode === "guardTarget"){
          const chk = RULES.validateGuardTarget({players:State.players, night:{...State.night, guardTarget:p.seat}, rules:State.rules});
          if(!chk.ok){
            alert(chk.reason);
            return;
          }
          State.night.guardTarget = p.seat;
        }

        if(pickMode === "wolfTarget"){
          State.night.wolfTarget = p.seat;
        }

        if(pickMode === "seerCheckTarget"){
          State.night.seerCheckTarget = p.seat;
          // seer result
          State.night.seerResult = (bySeat(p.seat)?.team === "wolf") ? "wolf" : "villager";
        }

        if(pickMode === "witchPoisonTarget"){
          State.night.witchPoisonTarget = p.seat;
          closeWitchModal();
        }

        saveState();
        renderNight();
      };

      // highlight chosen
      const chosen =
        (State.night.guardTarget===p.seat) ||
        (State.night.wolfTarget===p.seat) ||
        (State.night.seerCheckTarget===p.seat) ||
        (State.night.witchPoisonTarget===p.seat);

      if(chosen) b.classList.add("selected");

      nightSeats.appendChild(b);
    });

    // add "空刀" button when wolfCanSkip and pickMode is wolfTarget
    if(pickMode === "wolfTarget" && State.rules.wolfCanSkip){
      const btnNone = document.createElement("button");
      btnNone.type="button";
      btnNone.className="seat ghost";
      btnNone.textContent="空刀";
      btnNone.onclick = ()=>{
        State.night.wolfTarget = null;
        saveState();
        renderNight();
      };
      nightSeats.appendChild(btnNone);
    }
  }

  function buildNightScript(step){
    if(!step) return "（夜晚流程結束）";
    const t = State.godView ? (step.godText || step.publicText || "") : (step.publicText || "");
    // append extra for seer result (only god)
    let extra = "";
    if(step.type==="seer" && State.godView && State.night.seerCheckTarget){
      extra = `\n\n（上帝）查驗結果：${State.night.seerResult==="wolf" ? "狼人" : "好人"}`;
    }
    if(step.type==="witch"){
      if(State.godView){
        if(State.night.witchSaveUsed){
          extra = "\n\n（上帝）解藥已用過：本回合不顯示刀口，只能選擇是否用毒。";
        } else {
          extra = "\n\n（上帝）下一步會開啟女巫彈窗：先顯示刀口 → 再選救/不救 → 再選毒/不毒。";
        }
      } else {
        extra = "\n\n（提示）女巫操作需要 🔓 上帝視角。";
      }
    }
    return (t + extra).trim();
  }

  function renderNight(){
    if(nightTag) nightTag.textContent = `第 ${State.nightNo} 夜`;
    const step = currentStep();
    if(nightScript) nightScript.textContent = buildNightScript(step);

    let pickMode = null;
    if(step){
      if(step.type==="pick") pickMode = step.pickKey;           // guardTarget / wolfTarget
      if(step.type==="seer") pickMode = step.pickKey;           // seerCheckTarget
      if(step.type==="witch") pickMode = null;
    }

    renderNightSeats(pickMode);

    saveState();
  }

  /* =========================
     Witch modal (dynamic build in JS)
  ========================= */
  let witchModal = null;

  function ensureWitchModal(){
    if(witchModal) return;

    witchModal = document.createElement("div");
    witchModal.id = "modalWitch";
    witchModal.className = "modal hidden";
    witchModal.innerHTML = `
      <div class="modal-card">
        <div class="modal-head">
          <div class="modal-title">女巫操作</div>
          <button class="iconbtn" id="closeWitch">✕</button>
        </div>
        <div class="modal-body" id="witchBody"></div>
        <div class="modal-actions" id="witchActions"></div>
      </div>
    `;
    document.body.appendChild(witchModal);

    on($("closeWitch"), "click", closeWitchModal);
  }

  function openWitchModal(){
    ensureWitchModal();
    if(!State.godView){
      alert("需要 🔓 上帝視角 才能操作女巫。");
      return;
    }

    const body = $("witchBody");
    const act  = $("witchActions");
    if(!body || !act) return;

    body.innerHTML = "";
    act.innerHTML = "";

    // If save already used: do not show wolf target at all
    if(State.night.witchSaveUsed){
      const t = document.createElement("div");
      t.className="hint";
      t.textContent="解藥已用過：本回合只能選擇是否用毒。";
      body.appendChild(t);
    } else {
      const wolf = State.night.wolfTarget;
      const wolfLine = document.createElement("div");
      wolfLine.className="card inner";
      wolfLine.innerHTML = `
        <div class="label">今晚刀口</div>
        <div class="big-num">${wolf==null ? "（空刀/未選）" : (wolf+" 號")}</div>
        <div class="hint">要不要使用解藥？</div>
      `;
      body.appendChild(wolfLine);

      const row = document.createElement("div");
      row.className="row wrap";
      const btnSave = document.createElement("button");
      btnSave.className="btn";
      btnSave.type="button";
      btnSave.textContent = State.night.witchSave ? "✅ 已選救（點取消）" : "用解藥救";
      btnSave.disabled = (wolf==null); // 空刀/未選刀口就不能救
      btnSave.onclick = ()=>{
        State.night.witchSave = !State.night.witchSave;
        saveState();
        openWitchModal(); // rerender
      };
      const btnNoSave = document.createElement("button");
      btnNoSave.className="btn ghost";
      btnNoSave.type="button";
      btnNoSave.textContent="不救";
      btnNoSave.onclick = ()=>{
        State.night.witchSave = false;
        saveState();
        openWitchModal();
      };
      row.append(btnSave, btnNoSave);

      // witch cannot self save notice (not blocking; RULES will invalidate)
      const witchSeat = State.players.find(p=>p.alive && p.roleId==="witch")?.seat || null;
      if(State.rules.witchCannotSelfSave && wolf!=null && witchSeat && wolf===witchSeat){
        const warn = document.createElement("div");
        warn.className="warn";
        warn.textContent="⚠️ 規則：女巫不能自救（就算選救，結算會判定無效）";
        body.appendChild(warn);
      }

      body.appendChild(row);
    }

    // Poison section
    const poisonCard = document.createElement("div");
    poisonCard.className="card inner";
    poisonCard.innerHTML = `
      <div class="label">毒藥</div>
      <div class="hint">毒藥${State.night.witchPoisonUsed ? "已用過" : "可用"}。${State.night.witchPoisonTarget ? `目前已毒：${State.night.witchPoisonTarget} 號` : ""}</div>
    `;
    body.appendChild(poisonCard);

    const row2 = document.createElement("div");
    row2.className="row wrap";

    const btnPickPoison = document.createElement("button");
    btnPickPoison.className="btn";
    btnPickPoison.type="button";
    btnPickPoison.textContent = State.night.witchPoisonTarget ? "改選毒人（點座位）" : "用毒（點座位）";
    btnPickPoison.disabled = !!State.night.witchPoisonUsed;
    btnPickPoison.onclick = ()=>{
      alert("請在夜晚座位區點選要毒的人。");
      // temporarily set step pick mode: we reuse nightSeats click by setting a flag on step
      State._witchPickPoison = true;
      saveState();
      closeWitchModal();
      renderNight();
      // seats click handler: we detect flag below
    };

    const btnNoPoison = document.createElement("button");
    btnNoPoison.className="btn ghost";
    btnNoPoison.type="button";
    btnNoPoison.textContent="不用毒";
    btnNoPoison.onclick = ()=>{
      State.night.witchPoisonTarget = null;
      State._witchPickPoison = false;
      saveState();
      openWitchModal();
    };

    row2.append(btnPickPoison, btnNoPoison);
    body.appendChild(row2);

    // actions
    const btnDone = document.createElement("button");
    btnDone.className="btn primary";
    btnDone.type="button";
    btnDone.textContent="完成女巫 → 回夜晚";
    btnDone.onclick = ()=>{
      State._witchPickPoison = false;
      closeWitchModal();
      // proceed to next step
      State.nightStepIndex = Math.min(State.nightSteps.length-1, State.nightStepIndex+1);
      saveState();
      renderNight();
    };

    act.appendChild(btnDone);

    witchModal.classList.remove("hidden");
  }

  function closeWitchModal(){
    witchModal?.classList.add("hidden");
  }

  /* =========================
     Night Next/Prev
  ========================= */
  function canNext(step){
    if(!step) return false;

    if(step.type==="pick"){
      if(step.pickKey==="wolfTarget"){
        // if wolf can skip, allow null
        if(State.rules.wolfCanSkip) return true;
        return State.night.wolfTarget != null;
      }
      if(step.pickKey==="guardTarget") return State.night.guardTarget != null;
    }
    if(step.type==="seer"){
      return State.night.seerCheckTarget != null;
    }
    return true;
  }

  on($("btnNightPrev"), "click", ()=>{
    State.nightStepIndex = Math.max(0, State.nightStepIndex-1);
    saveState();
    renderNight();
  });

  on($("btnNightNext"), "click", ()=>{
    const step = currentStep();
    if(!step) return;

    // If witch poison picking is active, let user pick seat first
    if(State._witchPickPoison){
      alert("請先在座位區點選要毒的人（或在女巫彈窗選不用毒）。");
      return;
    }

    if(!canNext(step)){
      alert("此步驟需要先完成選擇。");
      return;
    }

    if(step.type==="witch"){
      // open witch modal
      openWitchModal();
      return;
    }

    if(step.type==="resolve"){
      // resolve -> day
      resolveNightToDay();
      return;
    }

    // go next
    State.nightStepIndex = Math.min(State.nightSteps.length-1, State.nightStepIndex+1);
    saveState();
    renderNight();
  });

  // hook seats click when poison pick
  // we do this by wrapping renderNightSeats click: easiest is global listener
  // We already built click inside renderNightSeats; so add a simple overlay detection:
  // We'll modify renderNightSeats to check State._witchPickPoison at click time.
  // (implemented by checking inside renderNightSeats click above isn't possible now; do quick patch:)
  const _origRenderNightSeats = renderNightSeats;
  renderNightSeats = function(pickMode){
    if(!nightSeats) return;
    nightSeats.innerHTML = "";
    State.players.forEach(p=>{
      const b=document.createElement("button");
      b.type="button";
      b.className = "seat" + (p.alive ? "" : " dead");
      b.textContent = String(p.seat);
      if(!p.alive) b.disabled=true;

      b.onclick = ()=>{
        if(!p.alive) return;

        // poison picking overrides everything
        if(State._witchPickPoison){
          if(State.night.witchPoisonUsed){
            alert("毒藥已用過。");
            State._witchPickPoison=false;
            saveState();
            return;
          }
          State.night.witchPoisonTarget = p.seat;
          State._witchPickPoison=false;
          saveState();
          // open witch modal again to allow done
          openWitchModal();
          renderNight();
          return;
        }

        // normal
        if(pickMode === "guardTarget"){
          const chk = RULES.validateGuardTarget({players:State.players, night:{...State.night, guardTarget:p.seat}, rules:State.rules});
          if(!chk.ok){ alert(chk.reason); return; }
          State.night.guardTarget = p.seat;
        }
        if(pickMode === "wolfTarget"){
          State.night.wolfTarget = p.seat;
        }
        if(pickMode === "seerCheckTarget"){
          State.night.seerCheckTarget = p.seat;
          State.night.seerResult = (bySeat(p.seat)?.team==="wolf") ? "wolf" : "villager";
        }

        saveState();
        renderNight();
      };

      const chosen =
        (State.night.guardTarget===p.seat) ||
        (State.night.wolfTarget===p.seat) ||
        (State.night.seerCheckTarget===p.seat) ||
        (State.night.witchPoisonTarget===p.seat);

      if(chosen) b.classList.add("selected");
      nightSeats.appendChild(b);
    });

    if(pickMode === "wolfTarget" && State.rules.wolfCanSkip){
      const btnNone = document.createElement("button");
      btnNone.type="button";
      btnNone.className="seat ghost";
      btnNone.textContent="空刀";
      btnNone.onclick = ()=>{
        State.night.wolfTarget = null;
        saveState();
        renderNight();
      };
      nightSeats.appendChild(btnNone);
    }
  };

  /* =========================
     Resolve night -> Day
  ========================= */
  function pushLog({ publicText, hiddenText, votes=null, actions=null }){
    State.logs.unshift({
      ts: nowISO(),
      nightNo: State.nightNo,
      dayNo: State.dayNo,
      publicText,
      hiddenText,
      votes,
      actions
    });
    saveState();
  }

  function markDeaths(deaths){
    deaths.forEach(seat=>{
      const p = bySeat(seat);
      if(p) p.alive = false;
    });
  }

  function buildDeathSkills(resolved){
    State.skillQueue = [];
    (resolved.deaths||[]).forEach(seat=>{
      const p = bySeat(seat);
      if(!p) return;
      if(p.roleId==="hunter") State.skillQueue.push({roleId:"hunter", seat, kind:"shoot"});
      if(p.roleId==="blackWolfKing") State.skillQueue.push({roleId:"blackWolfKing", seat, kind:"explode"});
      if(p.roleId==="whiteWolfKing") State.skillQueue.push({roleId:"whiteWolfKing", seat, kind:"explode"});
    });
    saveState();
  }

  function resolveNightToDay(){
    // validate key picks
    const gchk = RULES.validateGuardTarget({players:State.players, night:State.night, rules:State.rules});
    if(!gchk.ok){
      alert(gchk.reason);
      return;
    }
    const wchk = RULES.validateWolfTarget({players:State.players, night:State.night, rules:State.rules});
    if(!wchk.ok){
      alert(wchk.reason);
      return;
    }

    const resolved = RULES.resolveNight({ players:State.players, night:State.night, rules:State.rules });
    State.lastResolved = resolved;

    // apply deaths
    markDeaths(resolved.deaths);

    // lock witch usage
    if(State.night.witchSave) State.night.witchSaveUsed = true;
    if(State.night.witchPoisonTarget != null) State.night.witchPoisonUsed = true;

    // record prev guard
    State.night.prevGuardTarget = State.night.guardTarget ?? State.night.prevGuardTarget;

    // build announcement
    const ann = RULES.buildAnnouncement({
      nightNo: State.nightNo,
      dayNo: State.dayNo,
      players: State.players,
      night: State.night,
      resolved,
      rules: State.rules
    });

    pushLog({
      publicText: ann.publicText,
      hiddenText: ann.hiddenText,
      actions: { night: structuredClone(State.night), resolved: resolved.meta }
    });

    renderAnnTodayBox();

    // move to day
    showScreen("day");
    $("dayTag") && ($("dayTag").textContent = `第 ${State.dayNo} 天`);
    openAnn(true);         // ✅ 必跳公告中心
    renderLogs();

    // skills
    buildDeathSkills(resolved);
    runDeathSkillsIfNeeded();

    // init day sessions
    State.policeSession = DAY.createPoliceSession(State.players);
    State.speechSession = null;
    State.voteSession = null;
    State.voteRound = 1;
    State.voteRestrictTargets = null;
    State.lastTieTops = null;

    saveState();

    // check win
    checkWinAndMaybeEnd();
  }

  /* =========================
     Day: next night
  ========================= */
  on($("btnDayNext"), "click", ()=>{
    if(checkWinAndMaybeEnd(true)) return; // ended
    State.nightNo += 1;
    State.dayNo += 1; // day count increments when next morning; keep simple: increment now for tag later
    // Actually day tag is for current day; We will correct below after entering night:
    State.dayNo -= 1;

    initNight();
    showScreen("night");
    renderNight();
    saveState();
  });

  /* =========================
     Win check
  ========================= */
  function checkWinAndMaybeEnd(silent=false){
    const result = RULES.checkWin({ players: State.players });
    if(!result.ended) return false;

    const text = result.winner==="wolf"
      ? `🐺 邪惡陣營獲勝！\n原因：${result.reason}`
      : `✨ 正義陣營獲勝！\n原因：${result.reason}`;

    // log and show announcement
    pushLog({
      publicText: `【遊戲結束】\n${text}`,
      hiddenText: State.godView ? `（上帝）最終存活：${aliveSeats().join("、")||"—"}` : ""
    });
    renderAnnTodayBox();
    if(!silent){
      alert(text);
      openAnn(true);
    }
    return true;
  }

  /* =========================
     Death skills modal (simple)
  ========================= */
  let skillModal = null;
  let skillPick = null;

  function ensureSkillModal(){
    if(skillModal) return;
    skillModal = document.createElement("div");
    skillModal.id = "modalSkill";
    skillModal.className = "modal hidden";
    skillModal.innerHTML = `
      <div class="modal-card">
        <div class="modal-head">
          <div class="modal-title" id="skillTitle">技能</div>
          <button class="iconbtn" id="closeSkill">✕</button>
        </div>
        <div class="modal-body">
          <div class="hint" id="skillHint"></div>
          <div class="seats" id="skillSeats"></div>
        </div>
        <div class="modal-actions">
          <button class="btn ghost" id="skillSkip">放棄</button>
          <button class="btn" id="skillOk" disabled>確認</button>
        </div>
      </div>
    `;
    document.body.appendChild(skillModal);
    on($("closeSkill"), "click", ()=>skillModal.classList.add("hidden"));
    on($("skillSkip"), "click", ()=>{ skillPick=null; skillModal.classList.add("hidden"); runDeathSkillsIfNeeded(); });
    on($("skillOk"), "click", ()=>applySkillPick());
  }

  function openSkill(next){
    ensureSkillModal();
    if(!State.godView){
      alert("需要 🔓 上帝視角 才能處理死亡技能。");
      // push back
      State.skillQueue.unshift(next);
      saveState();
      return;
    }

    // poison disable checks (only for night deaths)
    const ok = RULES.canTriggerDeathSkill({
      roleId: next.roleId,
      seat: next.seat,
      resolved: State.lastResolved,
      rules: State.rules
    });
    if(!ok){
      pushLog({
        publicText: `（系統）${next.seat} 號 ${roleInfo(next.roleId).name} 因被毒死亡 → 無法發動技能。`,
        hiddenText: `（上帝）技能被毒禁用：${next.roleId}@${next.seat}`
      });
      renderAnnTodayBox();
      saveState();
      return;
    }

    $("skillTitle").textContent = `${roleInfo(next.roleId).icon||""} ${roleInfo(next.roleId).name} 技能`;
    $("skillHint").textContent = next.roleId==="hunter"
      ? `獵人 ${next.seat} 號是否開槍？點選要帶走的人（可放棄）。`
      : `狼王 ${next.seat} 號死亡技能：點選要帶走的人（可放棄）。`;

    const box = $("skillSeats");
    box.innerHTML="";
    skillPick = null;
    $("skillOk").disabled = true;

    State.players.forEach(p=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="seat"+(p.alive?"":" dead");
      b.textContent=String(p.seat);
      if(!p.alive || p.seat===next.seat) b.disabled=true;
      b.onclick=()=>{
        skillPick = { from: next.seat, to: p.seat, roleId: next.roleId };
        [...box.querySelectorAll(".seat")].forEach(x=>x.classList.remove("selected"));
        b.classList.add("selected");
        $("skillOk").disabled = false;
      };
      box.appendChild(b);
    });

    State._activeSkill = next;
    skillModal.classList.remove("hidden");
  }

  function applySkillPick(){
    const s = State._activeSkill;
    if(!s || !skillPick) return;

    const target = bySeat(skillPick.to);
    if(target && target.alive){
      target.alive = false;
    }

    pushLog({
      publicText: s.roleId==="hunter"
        ? `⚡ 獵人 ${s.seat} 號開槍帶走：${skillPick.to} 號。`
        : `💥 狼王 ${s.seat} 號帶走：${skillPick.to} 號。`,
      hiddenText: `（上帝）死亡技能：${s.roleId}@${s.seat} -> ${skillPick.to}`
    });

    renderAnnTodayBox();
    skillModal.classList.add("hidden");
    State._activeSkill=null;
    skillPick=null;
    saveState();
    runDeathSkillsIfNeeded();
    checkWinAndMaybeEnd();
  }

  function runDeathSkillsIfNeeded(){
    if(!State.skillQueue.length) return;
    const next = State.skillQueue.shift();
    saveState();
    openSkill(next);
  }

  /* =========================
     Day tools UI (simple modals created here)
     - Police candidates
     - Speech order
     - Vote + tie rule (2nd tie => none)
  ========================= */

  // Police modal
  let policeModal=null;
  function ensurePoliceModal(){
    if(policeModal) return;
    policeModal=document.createElement("div");
    policeModal.id="modalPolice";
    policeModal.className="modal hidden";
    policeModal.innerHTML=`
      <div class="modal-card">
        <div class="modal-head">
          <div class="modal-title">上警名單</div>
          <button class="iconbtn" id="closePolice">✕</button>
        </div>
        <div class="modal-body">
          <div class="hint">點選座位加入/取消上警（僅存活可選）</div>
          <div class="seats" id="policeSeats"></div>
        </div>
        <div class="modal-actions">
          <button class="btn ghost" id="policeClear">清空</button>
          <button class="btn" id="policeDone">完成</button>
        </div>
      </div>
    `;
    document.body.appendChild(policeModal);
    on($("closePolice"),"click",()=>policeModal.classList.add("hidden"));
    on($("policeClear"),"click",()=>{
      State.policeSession.candidates=[];
      saveState();
      renderPoliceSeats();
    });
    on($("policeDone"),"click",()=>{
      policeModal.classList.add("hidden");
      const c=State.policeSession.candidates||[];
      const txt = c.length ? `【上警】${c.join("、")} 號` : "【上警】無人上警";
      pushLog({ publicText: txt, hiddenText: State.godView ? `（上帝）上警名單=${JSON.stringify(c)}` : "" });
      renderAnnTodayBox();
      saveState();
      openAnn(true);
    });
  }

  function renderPoliceSeats(){
    const box=$("policeSeats");
    box.innerHTML="";
    alivePlayers().forEach(p=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="seat";
      b.textContent=String(p.seat);
      if(State.policeSession.candidates.includes(p.seat)) b.classList.add("selected");
      b.onclick=()=>{
        DAY.toggleCandidate(State.policeSession, p.seat);
        saveState();
        renderPoliceSeats();
      };
      box.appendChild(b);
    });
  }

  on($("btnPolice"),"click",()=>{
    ensurePoliceModal();
    if(!State.policeSession) State.policeSession = DAY.createPoliceSession(State.players);
    State.policeSession.alive = aliveSeats();
    saveState();
    renderPoliceSeats();
    policeModal.classList.remove("hidden");
  });

  // Speech modal
  let speechModal=null;
  function ensureSpeechModal(){
    if(speechModal) return;
    speechModal=document.createElement("div");
    speechModal.id="modalSpeech";
    speechModal.className="modal hidden";
    speechModal.innerHTML=`
      <div class="modal-card">
        <div class="modal-head">
          <div class="modal-title">發言順序</div>
          <button class="iconbtn" id="closeSpeech">✕</button>
        </div>
        <div class="modal-body">
          <div class="hint">方向/起始位，生成後可按「下一位」提示。</div>
          <div class="row wrap" style="margin:10px 0;">
            <button class="btn ghost" id="dirCW">順時針</button>
            <button class="btn ghost" id="dirCCW">逆時針</button>
            <button class="btn ghost" id="dirRAND">隨機</button>
          </div>
          <div class="hint" id="speechInfo"></div>
          <div class="seats" id="speechSeats"></div>
          <pre class="annbox" id="speechOrderBox" style="margin-top:10px;">（尚未生成）</pre>
          <div class="hint" id="speechNextHint" style="margin-top:8px;"></div>
        </div>
        <div class="modal-actions">
          <button class="btn ghost" id="speechBuild">生成</button>
          <button class="btn" id="speechNext">下一位</button>
        </div>
      </div>
    `;
    document.body.appendChild(speechModal);
    on($("closeSpeech"),"click",()=>speechModal.classList.add("hidden"));
    on($("dirCW"),"click",()=>{ State._speechDir="cw"; renderSpeechUI(); });
    on($("dirCCW"),"click",()=>{ State._speechDir="ccw"; renderSpeechUI(); });
    on($("dirRAND"),"click",()=>{ State._speechDir="rand"; renderSpeechUI(); });
    on($("speechBuild"),"click",()=>buildSpeech());
    on($("speechNext"),"click",()=>nextSpeech());
  }

  function renderSpeechUI(){
    const info=$("speechInfo");
    const seatsEl=$("speechSeats");
    const box=$("speechOrderBox");
    const nextHint=$("speechNextHint");

    // pool: police candidates if any, else alive
    const cand = State.policeSession?.candidates || [];
    const pool = cand.length ? cand.slice() : aliveSeats();

    info.textContent = `模式：${cand.length?"警上":"全體"}｜方向：${State._speechDir||"cw"}｜起始：${State._speechStart||"未選"}`;

    seatsEl.innerHTML="";
    pool.forEach(seat=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="seat";
      b.textContent=String(seat);
      if(State._speechStart===seat) b.classList.add("selected");
      b.onclick=()=>{ State._speechStart=seat; saveState(); renderSpeechUI(); };
      seatsEl.appendChild(b);
    });

    const s = State.speechSession;
    if(!s || !s.order?.length){
      box.textContent="（尚未生成）";
      nextHint.textContent="👉 請按「生成」";
      return;
    }
    box.textContent = s.order.map((x,i)=>`${i+1}. ${x} 號`).join("\n");
    const cur = DAY.currentSpeaker(s);
    nextHint.textContent = s.done ? "✅ 發言結束" : (cur ? `👉 下一位：${cur} 號` : "✅ 發言結束");
  }

  function buildSpeech(){
    const cand = State.policeSession?.candidates || [];
    const pool = cand.length ? cand.slice() : aliveSeats();
    if(!pool.length) return;

    const dir = State._speechDir || "cw";
    const start = State._speechStart || pool[0];

    const session = {
      alive: aliveSeats(),
      candidates: cand.slice(),
      direction: dir,
      startSeat: start,
      order: [],
      cursor: 0,
      done: false
    };
    DAY.setDirection(session, dir);
    DAY.buildOrder(session, start);
    State.speechSession = session;
    saveState();

    pushLog({
      publicText:`【發言順序】${session.order.join(" → ")}`,
      hiddenText: State.godView ? `（上帝）speech=${JSON.stringify(DAY.exportPoliceSession(session))}` : ""
    });
    renderAnnTodayBox();
    renderSpeechUI();
  }

  function nextSpeech(){
    const s = State.speechSession;
    if(!s || !s.order?.length){ alert("請先生成"); return; }
    DAY.nextSpeaker(s);
    saveState();
    renderSpeechUI();
  }

  on($("btnTalkOrder"),"click",()=>{
    ensureSpeechModal();
    if(!State.policeSession) State.policeSession = DAY.createPoliceSession(State.players);
    renderSpeechUI();
    speechModal.classList.remove("hidden");
  });

  // Vote modal
  let voteModal=null;
  function ensureVoteModal(){
    if(voteModal) return;
    voteModal=document.createElement("div");
    voteModal.id="modalVote";
    voteModal.className="modal hidden";
    voteModal.innerHTML=`
      <div class="modal-card">
        <div class="modal-head">
          <div class="modal-title" id="voteTitle">投票</div>
          <button class="iconbtn" id="closeVote">✕</button>
        </div>
        <div class="modal-body">
          <div class="hint" id="votePrompt"></div>
          <div class="seats" id="voteSeats"></div>
          <pre class="annbox" id="voteStats" style="margin-top:10px;">（尚未投票）</pre>
          <div class="hint" id="voteHint" style="margin-top:8px;"></div>
        </div>
        <div class="modal-actions">
          <button class="btn ghost" id="voteAbstain">棄票</button>
          <button class="btn" id="voteDone" disabled>完成</button>
        </div>
      </div>
    `;
    document.body.appendChild(voteModal);
    on($("closeVote"),"click",()=>voteModal.classList.add("hidden"));
    on($("voteAbstain"),"click",()=>castVote(null));
    on($("voteDone"),"click",()=>finishVote());
  }

  function startVote(round=1, restrictTargets=null){
    ensureVoteModal();
    State.voteRound = round;
    State.voteRestrictTargets = restrictTargets ? restrictTargets.slice() : null;
    State.voteSession = DAY.createVoteSession(State.players, { round, restrictTargets: State.voteRestrictTargets });
    saveState();
    renderVoteUI();
    voteModal.classList.remove("hidden");
  }

  function renderVoteUI(){
    const s = State.voteSession;
    if(!s) return;

    $("voteTitle").textContent = s.round===2 ? "投票（第二輪）" : "投票（第一輪）";

    const cur = DAY.currentVoter(s);
    $("votePrompt").textContent = s.done ? "✅ 投票完成" : `請 ${cur} 號投票`;
    $("voteHint").textContent = (State.voteRestrictTargets && State.voteRestrictTargets.length)
      ? `PK 限制目標：${State.voteRestrictTargets.join("、")} 號`
      : "可選擇棄票";

    // seats
    const box = $("voteSeats");
    box.innerHTML="";

    const alive = aliveSeats();
    const targets = State.voteRestrictTargets?.length
      ? State.voteRestrictTargets.filter(x=>alive.includes(x))
      : alive;

    targets.forEach(seat=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="seat";
      b.textContent=String(seat);
      if(cur===seat){ b.disabled=true; b.classList.add("dead"); }
      b.onclick=()=>castVote(seat);
      box.appendChild(b);
    });

    const stats = DAY.computeStats(s);
    $("voteStats").textContent = formatStats(stats);

    $("voteDone").disabled = !s.done;
    saveState();
  }

  function formatStats(stats){
    const keys = Object.keys(stats||{});
    keys.sort((a,b)=>{
      if(a==="abstain") return 1;
      if(b==="abstain") return -1;
      return Number(a)-Number(b);
    });
    if(!keys.length) return "（尚未投票）";
    return keys.map(k=>{
      return k==="abstain" ? `棄票：${stats[k]} 票` : `${k} 號：${stats[k]} 票`;
    }).join("\n");
  }

  function castVote(toSeatOrNull){
    const s = State.voteSession;
    if(!s) return;
    const cur = DAY.currentVoter(s);
    const ok = DAY.castVote(s, cur, toSeatOrNull);
    if(!ok){ alert("投票無效（不能投自己/目標不在範圍/目標已死）"); return; }
    saveState();
    renderVoteUI();
  }

  function finishVote(){
    const s = State.voteSession;
    if(!s || !s.done) return;

    const res = DAY.getResult(s);
    const votes = DAY.exportVotes(s);

    // log votes (public only shows summary; hidden has mapping when godView)
    const summary = res.maxVotes===0
      ? "【投票結果】全棄票，無人放逐。"
      : res.tie
        ? `【投票結果】平票（最高票 ${res.maxVotes}）：${res.tops.join("、")} 號`
        : `【投票結果】最高票 ${res.maxVotes}：放逐 ${res.executed} 號`;

    pushLog({
      publicText: summary,
      hiddenText: State.godView ? `（上帝）votes=${JSON.stringify(votes)}` : "",
      votes
    });
    renderAnnTodayBox();

    if(res.maxVotes===0){
      voteModal.classList.add("hidden");
      openAnn(true);
      return;
    }

    if(res.tie){
      // tie decision
      const decision = DAY.tieRuleDecision({ voteRound: s.round, tieTops: res.tops });
      if(decision.action==="no_exile"){
        pushLog({ publicText: `【平票處理】${decision.message}`, hiddenText:"" });
        renderAnnTodayBox();
        voteModal.classList.add("hidden");
        openAnn(true);
        return;
      }

      // first tie: ask PK or revote
      const choice = prompt(`平票：${res.tops.join("、")} 號\n輸入 1=PK（只投平票名單）\n輸入 2=重投（全體存活）\n（取消）=不處理/關閉`, "1");
      if(choice==="1"){
        // PK as round 2, restrict tops
        voteModal.classList.add("hidden");
        startVote(2, res.tops);
        return;
      }
      if(choice==="2"){
        voteModal.classList.add("hidden");
        startVote(2, null);
        return;
      }
      // cancel
      voteModal.classList.add("hidden");
      openAnn(true);
      return;
    }

    // execute
    const ex = res.executed;
    const p = bySeat(ex);
    if(p && p.alive) p.alive=false;

    pushLog({
      publicText: `【處刑】${ex} 號出局。`,
      hiddenText: State.godView ? `（上帝）處刑 seat=${ex} role=${p?.roleId||"?"}` : ""
    });
    renderAnnTodayBox();

    // death skill from execution: allow (not poison)
    if(p && (p.roleId==="hunter" || p.roleId==="blackWolfKing" || p.roleId==="whiteWolfKing")){
      State.skillQueue.push({ roleId:p.roleId, seat:ex, kind:"explode" });
      saveState();
      runDeathSkillsIfNeeded();
    }

    voteModal.classList.add("hidden");
    openAnn(true);
    checkWinAndMaybeEnd();
  }

  on($("btnVote"),"click",()=>{
    startVote(1, null);
  });

  /* =========================
     Boot by phase
  ========================= */
  function boot(){
    // board pill state
    $("boardBasic")?.classList.toggle("active", State.boardId==="basic");
    $("boardSpecialB1")?.classList.toggle("active", State.boardId==="special_b1");

    setGodView(!!State.godView);

    // phase restore
    if(Screens[State.phase]) showScreen(State.phase);
    else showScreen("setup");

    syncSetupUI();
    renderAnnTodayBox();

    if(State.phase==="deal"){
      updateDealPrompt();
      renderDealSeats();
    }
    if(State.phase==="night"){
      if(!State.nightSteps?.length){
        initNight();
      }
      renderNight();
    }
    if(State.phase==="day"){
      $("dayTag") && ($("dayTag").textContent = `第 ${State.dayNo} 天`);
      renderAnnTodayBox();
    }
  }

  boot();

})();