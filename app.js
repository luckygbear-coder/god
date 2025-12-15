/* =========================================================
   app.js (Rebuild MVP)
   Works with:
     - data/boards/boards.basic.js  => WW_DATA.getBasicPreset
     - data/boards/boards.b1.js     => WW_DATA.getB1Preset
     - data/flow/night.steps.js     => WW_DATA.nightSteps.buildNightSteps
     - data/rules/rules.core.js     => WW_DATA.rulesCore

   Requirements met:
     ✅ No iOS text selection / no image zoom
     ✅ Pass&Play deal: tap seat to revisit, long-press 1.2s to reveal with flip
     ✅ Night wizard, Witch panel corrected
     ✅ Daybreak always announces, loop day->night until win
     ✅ Vote w/ tie second => no exile (go night)
     ✅ God toggle everywhere, announcements (today/history), export JSON
     ✅ Restart with confirm
========================================================= */

(() => {
  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);
  const nowISO = () => new Date().toISOString();
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  const WW = (window.WW_DATA || {});
  const rulesCore = WW.rulesCore;
  const nightSteps = WW.nightSteps;
  const getBasicPreset = WW.getBasicPreset;
  const getB1Preset = WW.getB1Preset;
  const rolesAll = WW.rolesAll || WW.roles || {};

  /* =========================================================
     Hard anti text selection / iOS long-press callout
  ========================================================= */
  try {
    document.documentElement.style.webkitUserSelect = "none";
    document.documentElement.style.userSelect = "none";
    document.documentElement.style.webkitTouchCallout = "none";
    document.body && (document.body.style.webkitUserSelect = "none");
    document.body && (document.body.style.userSelect = "none");
    document.body && (document.body.style.webkitTouchCallout = "none");
  } catch(e){}

  function preventTouchSelect(el){
    if(!el) return;
    el.addEventListener("touchstart", (e)=>{ e.preventDefault(); }, {passive:false});
  }

  /* =========================================================
     Role helper
  ========================================================= */
  const FALLBACK = {
    werewolf:{id:"werewolf",name:"狼人",team:"wolf",icon:"🐺"},
    villager:{id:"villager",name:"村民",team:"villager",icon:"🧑‍🌾"},
    seer:{id:"seer",name:"預言家",team:"villager",icon:"🔮"},
    witch:{id:"witch",name:"女巫",team:"villager",icon:"🧪"},
    hunter:{id:"hunter",name:"獵人",team:"villager",icon:"🔫"},
    guard:{id:"guard",name:"守衛",team:"villager",icon:"🛡️"},
    knight:{id:"knight",name:"騎士",team:"villager",icon:"🗡️"},
    blackWolfKing:{id:"blackWolfKing",name:"黑狼王",team:"wolf",icon:"🐺👑"},
    whiteWolfKing:{id:"whiteWolfKing",name:"白狼王",team:"wolf",icon:"🐺⚪️👑"},
  };
  function roleInfo(id){
    return rolesAll[id] || FALLBACK[id] || {id,name:id,team:"villager",icon:"❔"};
  }

  /* =========================================================
     Storage
  ========================================================= */
  const KEY = "ww_pwa_rebuild_v1";
  const load = () => { try{ const r=localStorage.getItem(KEY); return r?JSON.parse(r):null; }catch(e){ return null; } };
  const save = (s) => { try{ localStorage.setItem(KEY, JSON.stringify(s)); }catch(e){} };
  const clear = () => { try{ localStorage.removeItem(KEY); }catch(e){} };

  /* =========================================================
     State
  ========================================================= */
  const State = {
    // view & lock
    pin: "0000",
    godUnlocked: false,
    godView: false,

    // setup
    boardType: "basic", // basic | b1
    playerCount: 9,
    rolesCount: {},

    settings: {
      rules: rulesCore ? rulesCore.defaultRules() : {
        noConsecutiveGuard:true,
        wolvesCanSkip:true,
        witchCannotSelfSave:true,
        milkPierce:true,
        hunterPoisonNoShoot:true,
        blackWolfKingPoisonNoSkill:true,
        tieSecondNoExile:true
      }
    },

    // game
    phase: "setup", // setup | deal | night | day | end
    players: [],
    dealIndex: 0,
    nightNo: 1,
    dayNo: 1,

    // night actions
    night: {
      prevGuardTarget: null,
      guardTarget: null,
      wolfTarget: null,
      seerCheckTarget: null,
      witchSaveUsed: false,
      witchPoisonUsed: false,
      witchSave: false,
      witchPoisonTarget: null
    },

    // wizard
    nightSteps: [],
    nightStepIndex: 0,
    selectedSeat: null,

    // day
    vote: null,       // vote session
    tieCount: 0,      // consecutive tie counter (for "second tie -> none")
    police: { candidates: [], speechOrder: [], speechIdx: 0, direction:"cw", startSeat:null },

    // logs
    logs: [],          // [{ts,nightNo,dayNo,publicText,hiddenText,actions,votes}]
    lastResolved: null,

    // end
    ended: false,
    winner: null
  };

  const loaded = load();
  if(loaded && loaded.players){
    Object.assign(State, loaded);
    // merge defaults for safety
    State.settings = State.settings || {rules:{}};
    State.settings.rules = Object.assign(rulesCore?rulesCore.defaultRules():{}, State.settings.rules||{});
    State.night = Object.assign({
      prevGuardTarget:null,guardTarget:null,wolfTarget:null,seerCheckTarget:null,
      witchSaveUsed:false,witchPoisonUsed:false,witchSave:false,witchPoisonTarget:null
    }, State.night||{});
    State.police = Object.assign({candidates:[],speechOrder:[],speechIdx:0,direction:"cw",startSeat:null}, State.police||{});
    State.logs = State.logs || [];
    State.tieCount = State.tieCount || 0;
  } else {
    // initial preset
    applyPreset();
  }

  function applyPreset(){
    if(State.boardType==="b1" && typeof getB1Preset==="function"){
      State.rolesCount = getB1Preset(State.playerCount);
    } else if(typeof getBasicPreset==="function"){
      State.rolesCount = getBasicPreset(State.playerCount);
    } else {
      // fallback basic
      State.rolesCount = { werewolf:2, seer:1, witch:1, hunter:1, villager: State.playerCount-5 };
    }
  }

  function rolesTotal(){
    return Object.values(State.rolesCount||{}).reduce((a,b)=>a+(Number(b)||0),0);
  }

  function alivePlayers(){
    return (State.players||[]).filter(p=>p.alive);
  }

  /* =========================================================
     Screens
  ========================================================= */
  const Screens = {
    setup: $("screen-setup"),
    deal: $("screen-deal"),
    night: $("screen-night"),
    day: $("screen-day"),
    end: $("screen-end"),
  };
  function showScreen(name){
    Object.values(Screens).forEach(s=>s && s.classList.remove("active"));
    Screens[name] && Screens[name].classList.add("active");
    State.phase = name;
    save(State);
    renderHeaderTags();
  }

  function renderHeaderTags(){
    $("nightTag") && ($("nightTag").textContent = `第 ${State.nightNo} 夜`);
    $("dayTag") && ($("dayTag").textContent = `第 ${State.dayNo} 天`);
  }

  /* =========================================================
     God toggle
  ========================================================= */
  const btnGodToggle = $("btnGodToggle");
  const fabGod = $("fabGod");
  function setGodView(on){
    State.godView = !!on;
    document.body.classList.toggle("god-on", State.godView);
    const icon = State.godView ? "🔓" : "🔒";
    btnGodToggle && (btnGodToggle.textContent = icon);
    fabGod && (fabGod.textContent = icon);
    save(State);
    renderAnnBox();
    renderLogs();
  }

  function toggleGod(){
    if(State.godView){ setGodView(false); return; }
    if(State.godUnlocked){ setGodView(true); return; }
    openGodModal();
  }

  on(btnGodToggle,"click",toggleGod);
  on(fabGod,"click",toggleGod);

  function openGodModal(){
    $("modalGod")?.classList.remove("hidden");
    $("pinInput") && ($("pinInput").value="");
    $("pinWarn")?.classList.add("hidden");
    $("pinInput")?.focus?.();
  }
  on($("closeGod"),"click",()=> $("modalGod")?.classList.add("hidden"));
  on($("pinCancel"),"click",()=> $("modalGod")?.classList.add("hidden"));
  on($("pinOk"),"click",()=>{
    const v = ($("pinInput")?.value || "").trim();
    if(v === State.pin){
      State.godUnlocked = true;
      $("modalGod")?.classList.add("hidden");
      setGodView(true);
    }else{
      $("pinWarn")?.classList.remove("hidden");
    }
  });

  /* =========================================================
     Restart (insert button if exists slot)
  ========================================================= */
  function ensureRestartBtn(){
    // Prefer existing id if your index.html has it; otherwise inject into top bar.
    let btn = $("btnRestart");
    if(btn) return;
    const host = document.querySelector(".top-actions");
    if(!host) return;
    btn = document.createElement("button");
    btn.className="iconbtn";
    btn.id="btnRestart";
    btn.title="重新開始";
    btn.textContent="🔁";
    host.insertBefore(btn, host.firstChild);
    on(btn,"click",()=>{
      if(confirm("確定要重新開始？\n（會清空本局存檔與紀錄，回到選板子/配置）")){
        clear();
        location.reload();
      }
    });
  }
  ensureRestartBtn();

  /* =========================================================
     Setup UI bindings (need ids in index.html)
  ========================================================= */
  const rangeCount = $("rangeCount");
  const elPlayerCount = $("playerCount");
  const elRoleTotal = $("roleTotal");
  const elPlayerTotal = $("playerTotal");
  const warnRoleTotal = $("warnRoleTotal");
  const btnStart = $("btnStart");

  function syncSetupUI(){
    elPlayerCount && (elPlayerCount.textContent = String(State.playerCount));
    rangeCount && (rangeCount.value = String(State.playerCount));
    elRoleTotal && (elRoleTotal.textContent = String(rolesTotal()));
    elPlayerTotal && (elPlayerTotal.textContent = String(State.playerCount));

    const ok = rolesTotal()===State.playerCount;
    warnRoleTotal && warnRoleTotal.classList.toggle("hidden", ok);
    if(btnStart){
      btnStart.disabled = !ok;
      btnStart.textContent = ok ? "開始 → 抽身分" : "⚠️ 角色數需等於玩家數";
    }
    save(State);
  }

  on($("btnPlus"),"click",()=>{
    State.playerCount = clamp(State.playerCount+1, 6, 12);
    applyPreset();
    syncSetupUI();
  });
  on($("btnMinus"),"click",()=>{
    State.playerCount = clamp(State.playerCount-1, 6, 12);
    applyPreset();
    syncSetupUI();
  });
  on(rangeCount,"input",(e)=>{
    State.playerCount = clamp(Number(e.target.value), 6, 12);
    applyPreset();
    syncSetupUI();
  });

  on($("boardBasic"),"click",()=>{
    State.boardType="basic";
    $("boardBasic")?.classList.add("active");
    $("boardSpecial")?.classList.remove("active");
    applyPreset();
    syncSetupUI();
  });
  on($("boardSpecial"),"click",()=>{
    State.boardType="b1";
    $("boardSpecial")?.classList.add("active");
    $("boardBasic")?.classList.remove("active");
    applyPreset();
    syncSetupUI();
  });

  on($("btnSuggest"),"click",()=>{
    applyPreset();
    syncSetupUI();
  });

  // Role config modal (simple list from current rolesCount)
  function renderRoleConfig(){
    const body = $("roleConfigBody");
    if(!body) return;
    body.innerHTML = "";
    const tip = document.createElement("div");
    tip.className="hint";
    tip.textContent = "角色總數必須等於玩家人數才能開始。";
    body.appendChild(tip);

    Object.keys(State.rolesCount).forEach(rid=>{
      const info = roleInfo(rid);
      const row = document.createElement("div");
      row.style.display="flex";
      row.style.alignItems="center";
      row.style.justifyContent="space-between";
      row.style.padding="10px 4px";
      row.style.borderBottom="1px dashed rgba(0,0,0,.08)";

      const left = document.createElement("div");
      left.style.fontWeight="900";
      left.textContent = `${info.icon?info.icon+" ":""}${info.name}`;

      const right = document.createElement("div");
      right.style.display="flex";
      right.style.alignItems="center";
      right.style.gap="10px";

      const minus = document.createElement("button");
      minus.className="btn ghost tiny";
      minus.type="button";
      minus.textContent="－";

      const num = document.createElement("div");
      num.style.minWidth="36px";
      num.style.textAlign="center";
      num.style.fontWeight="900";
      num.textContent = String(State.rolesCount[rid]||0);

      const plus = document.createElement("button");
      plus.className="btn ghost tiny";
      plus.type="button";
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
  }

  on($("btnOpenRoleConfig"),"click",()=>{
    renderRoleConfig();
    $("modalRole")?.classList.remove("hidden");
  });
  on($("closeRole"),"click",()=> $("modalRole")?.classList.add("hidden"));
  on($("roleReset"),"click",()=>{
    applyPreset();
    renderRoleConfig();
    syncSetupUI();
  });
  on($("roleApply"),"click",()=>{
    $("modalRole")?.classList.add("hidden");
    syncSetupUI();
  });

  /* =========================================================
     Build players / deal
  ========================================================= */
  function shuffle(arr){
    const a=[...arr];
    for(let i=a.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

  function buildPlayers(){
    const rolesArr=[];
    Object.entries(State.rolesCount).forEach(([rid,cnt])=>{
      for(let i=0;i<(Number(cnt)||0);i++) rolesArr.push(rid);
    });
    const shuffled = shuffle(rolesArr);

    State.players = shuffled.map((rid,idx)=>({
      seat: idx+1,
      roleId: rid,
      team: roleInfo(rid).team || "villager",
      alive: true,
      isChief: false,
      notes: ""
    }));

    // reset game
    State.dealIndex = 0;
    State.nightNo = 1;
    State.dayNo = 1;
    State.logs = [];
    State.lastResolved = null;
    State.tieCount = 0;

    State.night = {
      prevGuardTarget: null,
      guardTarget: null,
      wolfTarget: null,
      seerCheckTarget: null,
      witchSaveUsed: false,
      witchPoisonUsed: false,
      witchSave: false,
      witchPoisonTarget: null
    };

    State.police = { candidates: [], speechOrder: [], speechIdx: 0, direction:"cw", startSeat:null };
    State.vote = null;

    save(State);
  }

  /* =========================================================
     Deal UI: seat list + long press flip
  ========================================================= */
  const dealText = $("dealText");
  const dealSeats = $("dealSeats"); // recommend in index.html; if missing we'll ignore
  const modalReveal = $("modalReveal");
  const revealCard = $("revealCard");
  const revealRole = $("revealRole");

  function updateDealPrompt(){
    const seat = State.dealIndex+1;
    if(dealText){
      dealText.innerHTML = seat<=State.players.length
        ? `請 <b>${seat} 號</b> 拿手機（也可點座位回去重看）`
        : `所有玩家已抽完身分`;
    }
    renderDealSeats();
  }

  function renderDealSeats(){
    if(!dealSeats) return;
    dealSeats.innerHTML="";
    State.players.forEach(p=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="seat";
      b.textContent=String(p.seat);
      if(State.dealIndex+1===p.seat) b.classList.add("selected");
      b.onclick=()=>{
        State.dealIndex = p.seat-1;
        updateDealPrompt();
        save(State);
      };
      dealSeats.appendChild(b);
    });
  }

  let holdTimer=null;
  let revealShown=false;

  function showReveal(){
    if(State.dealIndex>=State.players.length) return;
    const p=State.players[State.dealIndex];
    const info=roleInfo(p.roleId);
    if(revealRole) revealRole.textContent = `${info.icon?info.icon+" ":""}${info.name}`;
    modalReveal && modalReveal.classList.remove("hidden");
    revealCard && revealCard.classList.add("flipped");
    revealShown = true;
    navigator.vibrate?.(70);
  }

  function hideReveal(){
    if(!revealShown) return;
    revealCard && revealCard.classList.remove("flipped");
    modalReveal && modalReveal.classList.add("hidden");
    revealShown = false;
  }

  const btnHoldReveal = $("btnHoldReveal");
  if(btnHoldReveal){
    preventTouchSelect(btnHoldReveal);

    const startHold = ()=>{
      clearTimeout(holdTimer);
      holdTimer=setTimeout(showReveal, 1200);
    };
    const endHold = ()=>{
      clearTimeout(holdTimer);
      hideReveal();
    };

    on(btnHoldReveal,"touchstart",startHold,{passive:false});
    on(btnHoldReveal,"touchend",endHold);
    on(btnHoldReveal,"touchcancel",endHold);
    on(btnHoldReveal,"mousedown",startHold);
    on(btnHoldReveal,"mouseup",endHold);
    on(btnHoldReveal,"mouseleave",endHold);
  }

  on($("btnStart"),"click",()=>{
    if(rolesTotal()!==State.playerCount) return;
    buildPlayers();
    showScreen("deal");
    updateDealPrompt();
  });

  on($("btnDealBack"),"click",()=>{
    hideReveal();
    showScreen("setup");
  });

  on($("btnNextPlayer"),"click",()=>{
    hideReveal();
    State.dealIndex = Math.min(State.players.length, State.dealIndex+1);
    updateDealPrompt();
    save(State);
  });

  on($("btnFinishDeal"),"click",()=>{
    hideReveal();
    if(confirm("確認所有人都抽完並記住身分了嗎？\n按「確定」才會進入夜晚。")){
      initNight();
      showScreen("night");
      renderNight();
    }
  });

  /* =========================================================
     Announcement center + logs + export
  ========================================================= */
  const modalAnn = $("modalAnn");
  const annBox = $("annBox");
  let annMode = "today"; // today|history

  function getTodayLog(){
    return State.logs[0] || null;
  }

  function renderAnnBox(){
    if(!annBox) return;

    if(annMode==="today"){
      const l=getTodayLog();
      if(!l){ annBox.textContent="（尚無公告）"; return; }
      annBox.textContent = State.godView
        ? (l.publicText + (l.hiddenText?("\n\n"+l.hiddenText):""))
        : l.publicText;
      return;
    }

    if(!State.logs.length){ annBox.textContent="（尚無歷史公告）"; return; }
    const lines=[];
    State.logs.slice().reverse().forEach((l,idx)=>{
      lines.push(`【#${idx+1}｜第${l.nightNo}夜/第${l.dayNo}天】`);
      lines.push(l.publicText||"—");
      if(State.godView && l.hiddenText) lines.push(l.hiddenText);
      if(State.godView && l.votes){
        lines.push("【票型】");
        l.votes.forEach(v=> lines.push(`${v.from} → ${v.to===null?"棄票":(v.to+"號")}`));
      }
      lines.push("—");
    });
    annBox.textContent = lines.join("\n");
  }

  function openAnn(forceToday=true){
    if(forceToday) annMode="today";
    modalAnn && modalAnn.classList.remove("hidden");
    $("annToday")?.classList.toggle("active", annMode==="today");
    $("annHistory")?.classList.toggle("active", annMode==="history");
    renderAnnBox();
  }

  on($("btnOpenAnnouncement"),"click",()=>openAnn(true));
  on($("btnOpenAnnouncement2"),"click",()=>openAnn(true));
  on($("fabAnn"),"click",()=>openAnn(true));

  on($("closeAnn"),"click",()=> modalAnn && modalAnn.classList.add("hidden"));
  on($("annToday"),"click",()=>{ annMode="today"; renderAnnBox(); $("annToday")?.classList.add("active"); $("annHistory")?.classList.remove("active"); });
  on($("annHistory"),"click",()=>{ annMode="history"; renderAnnBox(); $("annHistory")?.classList.add("active"); $("annToday")?.classList.remove("active"); });

  on($("btnCopyAnn"),"click",async()=>{
    try{
      await navigator.clipboard.writeText(annBox?.textContent||"");
      alert("已複製公告");
    }catch(e){
      alert("複製失敗（可能需 HTTPS / 安裝成 PWA）");
    }
  });

  function exportJSON(){
    if(!rulesCore) return alert("缺少 rulesCore");
    const payload = rulesCore.exportReplay({state:State, includeSecrets: !!State.godView});
    const blob = new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=`狼人殺復盤_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),500);
  }
  on($("btnExport"),"click",exportJSON);
  on($("btnExport2"),"click",exportJSON);

  function pushLog({publicText, hiddenText, actions, votes}){
    State.logs.unshift({
      ts: nowISO(),
      nightNo: State.nightNo,
      dayNo: State.dayNo,
      publicText: publicText || "",
      hiddenText: hiddenText || "",
      actions: actions || null,
      votes: votes || null
    });
    save(State);
  }

  function renderLogs(){
    const list=$("logList");
    if(!list) return;
    list.innerHTML="";
    if(!State.logs.length){ list.textContent="—"; return; }
    State.logs.forEach(l=>{
      const item=document.createElement("div");
      item.className="logitem";
      const title=document.createElement("div");
      title.className="logtitle";
      title.textContent=`第${l.nightNo}夜 / 第${l.dayNo}天`;
      const text=document.createElement("div");
      text.className="logtext";
      text.textContent = State.godView ? (l.publicText + (l.hiddenText?("\n\n"+l.hiddenText):"")) : l.publicText;
      item.append(title,text);
      list.appendChild(item);
    });
  }

  on($("btnOpenLog"),"click",()=>{ renderLogs(); $("modalLog")?.classList.remove("hidden"); });
  on($("btnOpenLog2"),"click",()=>{ renderLogs(); $("modalLog")?.classList.remove("hidden"); });
  on($("closeLog"),"click",()=> $("modalLog")?.classList.add("hidden"));

  on($("btnClearSave"),"click",()=>{
    if(confirm("確定清除整局存檔與紀錄？")){
      clear();
      location.reload();
    }
  });

  /* =========================================================
     Night wizard
  ========================================================= */
  const nightScript = $("nightScript");
  const nightSeats = $("nightSeats");

  function resetNightActionsKeepResources(){
    // keep used flags + prevGuardTarget
    const keepPrev = State.night.prevGuardTarget ?? null;
    const saveUsed = !!State.night.witchSaveUsed;
    const poisonUsed = !!State.night.witchPoisonUsed;

    State.night = {
      prevGuardTarget: keepPrev,
      guardTarget: null,
      wolfTarget: null,
      seerCheckTarget: null,
      witchSaveUsed: saveUsed,
      witchPoisonUsed: poisonUsed,
      witchSave: false,
      witchPoisonTarget: null
    };
    State.selectedSeat = null;
    save(State);
  }

  function initNight(){
    if(!nightSteps?.buildNightSteps) return alert("缺少 nightSteps.buildNightSteps");
    resetNightActionsKeepResources();
    State.nightSteps = nightSteps.buildNightSteps(State);
    State.nightStepIndex = 0;
    State.selectedSeat = null;
    save(State);
    renderHeaderTags();
  }

  function curStep(){
    return (State.nightSteps||[])[State.nightStepIndex] || null;
  }

  function renderSeatDots(container, onPick){
    if(!container) return;
    container.innerHTML="";
    State.players.forEach(p=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="seat"+(p.alive?"":" dead")+(p.isChief?" chief":"");
      b.textContent=String(p.seat);
      if(State.selectedSeat===p.seat) b.classList.add("selected");
      b.disabled = !p.alive;
      b.onclick=()=>{
        if(!p.alive) return;
        State.selectedSeat = p.seat;
        onPick && onPick(p.seat);
        save(State);
        renderNight();
      };
      container.appendChild(b);
    });
  }

  function nightStepScript(step){
    if(!step) return "（夜晚流程結束）";
    const base = State.godView ? (step.godScript||step.publicScript||"") : (step.publicScript||"");
    let extra = "";

    if(step.type==="seer" && State.godView && typeof step.afterScript==="function"){
      extra = step.afterScript({state:State}) || "";
    }

    if(step.type==="pick" && step.pickTarget==="wolfTarget" && State.godView){
      const canSkip = !!State.settings.rules.wolvesCanSkip;
      extra += canSkip ? "\n（提示）可空刀：不點座位也能下一步。" : "";
    }

    return (base + (extra?("\n\n"+extra):"")).trim();
  }

  function renderNight(){
    renderHeaderTags();
    const step = curStep();
    nightScript && (nightScript.textContent = nightStepScript(step));

    renderSeatDots(nightSeats, (seat)=>{
      const s=curStep(); if(!s) return;
      if(s.type==="pick" && s.pickTarget){
        State.night[s.pickTarget] = seat;
      }
      if(s.type==="seer" && s.pickTarget){
        State.night[s.pickTarget] = seat;
      }
    });
  }

  function canNightNext(){
    const step = curStep();
    if(!step) return false;
    if(step.type==="pick" && step.required && step.pickTarget){
      return !!State.night[step.pickTarget];
    }
    if(step.type==="seer" && step.required && step.pickTarget){
      return !!State.night[step.pickTarget];
    }
    return true;
  }

  on($("btnNightPrev"),"click",()=>{
    State.selectedSeat=null;
    State.nightStepIndex=Math.max(0, State.nightStepIndex-1);
    save(State);
    renderNight();
  });

  on($("btnNightNext"),"click",()=>{
    const step = curStep();
    if(!step) return;

    if(!canNightNext()){
      navigator.vibrate?.([60,40,60]);
      return;
    }

    // Witch panel
    if(step.type==="witchPanel"){
      if(!State.godView) return alert("需要 🔓 上帝視角 才能操作女巫");
      openWitchPanel();
      return;
    }

    // Resolve -> daybreak
    if(step.type==="resolve"){
      resolveNightToDay();
      return;
    }

    // allow wolf skip (no selection)
    if(step.type==="pick" && step.pickTarget==="wolfTarget"){
      // no action needed
    }

    State.selectedSeat=null;
    State.nightStepIndex=Math.min(State.nightSteps.length-1, State.nightStepIndex+1);
    save(State);
    renderNight();
  });

  /* =========================================================
     Witch panel (modalAnn reused as panel)
     Corrected:
       - show wolf target only if save NOT used
       - if save used => only poison part
       - flow: see knife -> save? -> poison? (poison selection by seat buttons)
  ========================================================= */
  let witchPickingPoison=false;

  function openWitchPanel(){
    // reuse announcement modal UI if present; otherwise alert
    if(!modalAnn || !annBox) return alert("缺少公告彈窗（modalAnn/annBox）");

    witchPickingPoison=false;
    modalAnn.classList.remove("hidden");
    // force today tab
    annMode="today";
    $("annToday")?.classList.add("active");
    $("annHistory")?.classList.remove("active");

    renderWitchPanel();
  }

  function renderWitchPanel(){
    if(!annBox) return;
    annBox.innerHTML="";

    const n=State.night;
    const aliveSeats = alivePlayers().map(p=>p.seat);
    const wolfTarget = (n.wolfTarget && aliveSeats.includes(n.wolfTarget)) ? n.wolfTarget : null;

    const canSave = !n.witchSaveUsed;
    const canPoison = !n.witchPoisonUsed;

    const title = document.createElement("div");
    title.style.whiteSpace="pre-line";
    title.style.fontWeight="900";
    title.style.marginBottom="10px";

    // IMPORTANT: if save already used => don't show knife info
    if(canSave){
      title.textContent =
        `【女巫操作】\n` +
        `今晚被刀：${wolfTarget ? (wolfTarget+" 號") : "（狼人空刀/未選刀口）"}\n` +
        `解藥：可用｜毒藥：${canPoison?"可用":"已用過"}`;
    }else{
      title.textContent =
        `【女巫操作】\n` +
        `解藥：已用過（本局不再顯示刀口）\n` +
        `毒藥：${canPoison?"可用":"已用過"}`;
    }
    annBox.appendChild(title);

    // self save warning
    const witchSeat = State.players.find(p=>p.roleId==="witch")?.seat ?? null;
    if(canSave && State.settings.rules.witchCannotSelfSave && wolfTarget && witchSeat && wolfTarget===witchSeat){
      const warn=document.createElement("div");
      warn.className="warn";
      warn.textContent="⚠️ 規則：女巫不能自救（救會判定無效）";
      annBox.appendChild(warn);
    }

    // Save section
    if(canSave){
      const saveRow=document.createElement("div");
      saveRow.style.display="flex";
      saveRow.style.gap="10px";
      saveRow.style.margin="10px 0";

      const btnSave=document.createElement("button");
      btnSave.className="btn";
      btnSave.type="button";
      btnSave.textContent = n.witchSave ? "✅ 已選擇：救" : "用解藥救他";
      btnSave.disabled = !wolfTarget; // can't save if no knife
      btnSave.onclick=()=>{
        State.night.witchSave = !State.night.witchSave;
        save(State);
        renderWitchPanel();
      };

      const btnNoSave=document.createElement("button");
      btnNoSave.className="btn ghost";
      btnNoSave.type="button";
      btnNoSave.textContent="不救";
      btnNoSave.onclick=()=>{
        State.night.witchSave = false;
        save(State);
        renderWitchPanel();
      };

      saveRow.append(btnSave, btnNoSave);
      annBox.appendChild(saveRow);
    }

    // Poison section
    const poisonBox=document.createElement("div");
    poisonBox.className="card inner";
    poisonBox.style.padding="10px 12px";

    const poisonTitle=document.createElement("div");
    poisonTitle.style.fontWeight="900";
    poisonTitle.textContent="毒藥";
    poisonBox.appendChild(poisonTitle);

    const poisonHint=document.createElement("div");
    poisonHint.className="hint";
    poisonHint.style.marginTop="6px";
    if(!canPoison){
      poisonHint.textContent="毒藥已用過。";
    }else{
      poisonHint.textContent = State.night.witchPoisonTarget
        ? `已選擇：毒 ${State.night.witchPoisonTarget} 號`
        : "選擇是否要毒人（可不毒）。";
    }
    poisonBox.appendChild(poisonHint);

    const poisonRow=document.createElement("div");
    poisonRow.style.display="flex";
    poisonRow.style.gap="10px";
    poisonRow.style.marginTop="10px";

    const btnPick=document.createElement("button");
    btnPick.className="btn";
    btnPick.type="button";
    btnPick.textContent = State.night.witchPoisonTarget ? "改選毒人（點座位）" : "用毒藥（點座位）";
    btnPick.disabled = !canPoison;
    btnPick.onclick=()=>{
      witchPickingPoison=true;
      renderWitchPanel();
    };

    const btnNoPoison=document.createElement("button");
    btnNoPoison.className="btn ghost";
    btnNoPoison.type="button";
    btnNoPoison.textContent="不毒";
    btnNoPoison.disabled = !canPoison;
    btnNoPoison.onclick=()=>{
      State.night.witchPoisonTarget = null;
      witchPickingPoison=false;
      save(State);
      renderWitchPanel();
    };

    poisonRow.append(btnPick, btnNoPoison);
    poisonBox.appendChild(poisonRow);

    // seats picker
    if(witchPickingPoison && canPoison){
      const seatsWrap=document.createElement("div");
      seatsWrap.className="seats";
      seatsWrap.style.marginTop="10px";

      alivePlayers().forEach(p=>{
        const b=document.createElement("button");
        b.type="button";
        b.className="seat";
        b.textContent=String(p.seat);
        if(State.night.witchPoisonTarget===p.seat) b.classList.add("selected");
        b.onclick=()=>{
          State.night.witchPoisonTarget = p.seat;
          witchPickingPoison=false;
          save(State);
          renderWitchPanel();
        };
        seatsWrap.appendChild(b);
      });

      poisonBox.appendChild(seatsWrap);

      const tip=document.createElement("div");
      tip.className="hint";
      tip.style.marginTop="8px";
      tip.textContent="點座位即完成選擇。";
      poisonBox.appendChild(tip);
    }

    annBox.appendChild(poisonBox);

    // done
    const done=document.createElement("button");
    done.className="btn primary";
    done.type="button";
    done.style.marginTop="12px";
    done.textContent="完成女巫 → 回夜晚流程";
    done.onclick=()=>{
      witchPickingPoison=false;
      modalAnn.classList.add("hidden");
      // advance one step
      State.selectedSeat=null;
      State.nightStepIndex=Math.min(State.nightSteps.length-1, State.nightStepIndex+1);
      save(State);
      renderNight();
    };

    annBox.appendChild(done);
  }

  /* =========================================================
     Resolve night -> day
  ========================================================= */
  function resolveNightToDay(){
    if(!rulesCore) return alert("缺少 rulesCore");

    // record prev guard
    State.night.prevGuardTarget = State.night.guardTarget ?? State.night.prevGuardTarget;

    const resolved = rulesCore.resolveNight({state:State});
    State.lastResolved = resolved;

    // apply deaths
    (resolved.deaths||[]).forEach(seat=>{
      const p=State.players.find(x=>x.seat===seat);
      if(p) p.alive=false;
    });

    // lock potions if used
    if(State.night.witchSave) State.night.witchSaveUsed=true;
    if(State.night.witchPoisonTarget) State.night.witchPoisonUsed=true;

    // build announcement
    const ann = rulesCore.buildDaybreakAnnouncement({state:State, resolved});
    pushLog({
      publicText: ann.publicText,
      hiddenText: ann.hiddenText,
      actions: { night: JSON.parse(JSON.stringify(State.night)), resolvedMeta: resolved.meta }
    });

    // go day
    showScreen("day");
    renderDay();
    openAnn(true);
    renderLogs();

    // win check (after deaths)
    const win = rulesCore.checkWin({state:State});
    if(win.ended){
      endGame(win);
      return;
    }

    save(State);
  }

  /* =========================================================
     Day UI: Police (simple) + Speech order + Vote + Next Night
  ========================================================= */
  function renderDay(){
    renderHeaderTags();
    renderDaySeats();
    syncPoliceUI();
    syncSpeechUI();
  }

  // day seat board (for quick view)
  const daySeats = $("daySeats");
  function renderDaySeats(){
    if(!daySeats) return;
    daySeats.innerHTML="";
    State.players.forEach(p=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="seat"+(p.alive?"":" dead")+(p.isChief?" chief":"");
      b.textContent=String(p.seat);
      // tap seat in day: nothing for now, later can open notes
      daySeats.appendChild(b);
    });
  }

  // Police candidates modal (simple)
  function openPoliceModal(){
    const modal=$("modalPolice");
    const box=$("policeSeats");
    if(!modal || !box) return alert("缺少 modalPolice/policeSeats（請用新版 index.html）");
    box.innerHTML="";
    alivePlayers().forEach(p=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="seat";
      b.textContent=String(p.seat);
      if(State.police.candidates.includes(p.seat)) b.classList.add("selected");
      b.onclick=()=>{
        const i=State.police.candidates.indexOf(p.seat);
        if(i>=0) State.police.candidates.splice(i,1);
        else State.police.candidates.push(p.seat);
        save(State);
        openPoliceModal(); // rerender
      };
      box.appendChild(b);
    });
    modal.classList.remove("hidden");
  }
  on($("btnPolice"),"click",openPoliceModal);
  on($("closePolice"),"click",()=> $("modalPolice")?.classList.add("hidden"));
  on($("policeClear"),"click",()=>{ State.police.candidates=[]; save(State); openPoliceModal(); });
  on($("policeDone"),"click",()=>{
    $("modalPolice")?.classList.add("hidden");
    const list = State.police.candidates.slice().sort((a,b)=>a-b);
    pushLog({
      publicText: `【上警】${list.length? list.join("、")+" 號":"無人上警"}`,
      hiddenText: `（上帝）上警名單：${list.length?list.join("、"):"—"}`
    });
    openAnn(true);
  });

  function syncPoliceUI(){
    const el=$("policeSummary");
    if(!el) return;
    const list = State.police.candidates.slice().sort((a,b)=>a-b);
    el.textContent = list.length ? `上警：${list.join("、")} 號` : "上警：—";
  }

  // Speech order modal (simple)
  function buildSpeechOrder(){
    const aliveSeats = alivePlayers().map(p=>p.seat);
    const pool = State.police.candidates.length ? State.police.candidates.filter(s=>aliveSeats.includes(s)) : aliveSeats;

    if(!pool.length) return;

    const dir = State.police.direction; // cw|ccw|rand
    const start = State.police.startSeat ?? pool[0];

    let order=[];
    if(dir==="rand"){
      order = pool.slice().sort(()=>Math.random()-0.5);
    } else {
      // clockwise / counterclockwise assume numeric circle
      const max = State.playerCount;
      const step = (dir==="cw") ? 1 : -1;
      let cur = start;
      const inPool = new Set(pool);
      const visited = new Set();
      while(visited.size < pool.length){
        if(inPool.has(cur) && !visited.has(cur)){
          visited.add(cur);
          order.push(cur);
        }
        cur += step;
        if(cur>max) cur=1;
        if(cur<1) cur=max;
      }
    }

    State.police.speechOrder = order;
    State.police.speechIdx = 0;
    save(State);

    pushLog({
      publicText: `【發言順序】${order.join(" → ")}`
    });
  }

  function openSpeechModal(){
    const modal=$("modalSpeech");
    if(!modal) return alert("缺少 modalSpeech（請用新版 index.html）");
    modal.classList.remove("hidden");
    renderSpeechModal();
  }

  function renderSpeechModal(){
    const info=$("speechInfo");
    const seats=$("speechSeats");
    const orderEl=$("speechOrder");
    const nextHint=$("speechNextHint");
    if(!seats || !orderEl || !nextHint || !info) return;

    const aliveSeats = alivePlayers().map(p=>p.seat);
    const pool = State.police.candidates.length ? State.police.candidates.filter(s=>aliveSeats.includes(s)) : aliveSeats;

    info.textContent = `模式：${State.police.candidates.length?"警上":"全體存活"}｜方向：${State.police.direction}｜起始：${State.police.startSeat ?? "未選"}`;

    seats.innerHTML="";
    pool.forEach(seatNo=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="seat";
      b.textContent=String(seatNo);
      if(State.police.startSeat===seatNo) b.classList.add("selected");
      b.onclick=()=>{
        State.police.startSeat = seatNo;
        save(State);
        renderSpeechModal();
      };
      seats.appendChild(b);
    });

    orderEl.textContent = State.police.speechOrder.length
      ? State.police.speechOrder.map((s,i)=>`${i+1}. ${s} 號`).join("\n")
      : "（尚未生成）";

    const cur = State.police.speechOrder[State.police.speechIdx] || null;
    nextHint.textContent = cur ? `👉 下一位發言：${cur} 號` : "👉 請先生成順序";

    // highlight
    [...seats.querySelectorAll(".seat")].forEach(btn=>{
      btn.classList.toggle("highlight", Number(btn.textContent)===cur);
    });
  }

  function syncSpeechUI(){
    const el=$("speechSummary");
    if(!el) return;
    const cur = State.police.speechOrder[State.police.speechIdx] || null;
    el.textContent = cur ? `下一位發言：${cur} 號` : "發言：—";
  }

  on($("btnTalkOrder"),"click",openSpeechModal);
  on($("closeSpeech"),"click",()=> $("modalSpeech")?.classList.add("hidden"));
  on($("dirCW"),"click",()=>{ State.police.direction="cw"; save(State); renderSpeechModal(); });
  on($("dirCCW"),"click",()=>{ State.police.direction="ccw"; save(State); renderSpeechModal(); });
  on($("dirRAND"),"click",()=>{ State.police.direction="rand"; save(State); renderSpeechModal(); });
  on($("speechBuild"),"click",()=>{ buildSpeechOrder(); renderSpeechModal(); syncSpeechUI(); });
  on($("speechNext"),"click",()=>{
    if(!State.police.speechOrder.length) return alert("請先生成順序");
    State.police.speechIdx = Math.min(State.police.speechOrder.length, State.police.speechIdx+1);
    save(State);
    renderSpeechModal();
    syncSpeechUI();
  });

  // Voting (simple step-by-step)
  function openVoteModal(){
    const modal=$("modalVote");
    if(!modal) return alert("缺少 modalVote（請用新版 index.html）");
    State.vote = createVoteSession();
    save(State);
    modal.classList.remove("hidden");
    renderVoteModal();
  }
  on($("btnVote"),"click",openVoteModal);
  on($("closeVote"),"click",()=> $("modalVote")?.classList.add("hidden"));

  function createVoteSession(restrictTargets=null){
    const aliveSeats = alivePlayers().map(p=>p.seat);
    return {
      voters: aliveSeats.slice(),
      idx: 0,
      votes: [], // {from,to|null}
      restrictTargets: restrictTargets ? restrictTargets.slice() : null
    };
  }

  function voteTargets(){
    const aliveSeats = alivePlayers().map(p=>p.seat);
    if(State.vote?.restrictTargets){
      return State.vote.restrictTargets.filter(s=>aliveSeats.includes(s));
    }
    return aliveSeats;
  }

  function renderVoteModal(){
    const prompt=$("votePrompt");
    const seats=$("voteSeats");
    const stats=$("voteStats");
    const done=$("voteDone");
    if(!prompt||!seats||!stats||!done) return;

    const v=State.vote;
    if(!v) return;

    const cur = v.voters[v.idx] || null;
    if(!cur){
      prompt.textContent="✅ 投票完成";
      done.disabled=false;
    }else{
      prompt.textContent=`請 ${cur} 號投票`;
      done.disabled=true;
    }

    seats.innerHTML="";
    const targets = voteTargets();
    targets.forEach(t=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="seat";
      b.textContent=String(t);
      if(cur===t){ b.disabled=true; b.classList.add("disabled"); }
      b.onclick=()=>castVote(t);
      seats.appendChild(b);
    });

    stats.textContent = renderVoteStats(v.votes);

    save(State);
  }

  function renderVoteStats(votes){
    const m=new Map();
    votes.forEach(x=>{
      const key = x.to===null ? "棄票" : `${x.to}號`;
      m.set(key,(m.get(key)||0)+1);
    });
    if(!votes.length) return "（尚未投票）";
    return [...m.entries()].map(([k,c])=>`${k}：${c} 票`).join("\n");
  }

  function castVote(to){
    const v=State.vote;
    const cur = v.voters[v.idx] || null;
    if(!cur) return;

    v.votes.push({from:cur, to});
    v.idx += 1;
    save(State);
    renderVoteModal();
  }

  on($("voteAbstain"),"click",()=>{
    const v=State.vote;
    const cur = v?.voters[v.idx] || null;
    if(!cur) return;
    v.votes.push({from:cur, to:null});
    v.idx += 1;
    save(State);
    renderVoteModal();
  });

  on($("voteDone"),"click",()=>{
    finalizeVote();
  });

  function finalizeVote(){
    const v=State.vote;
    if(!v) return;

    const aliveSeats = alivePlayers().map(p=>p.seat);

    // count
    const count={};
    v.votes.forEach(x=>{
      if(x.to===null) return;
      if(!aliveSeats.includes(x.to)) return;
      count[x.to]=(count[x.to]||0)+1;
    });

    // compute max
    let max=0;
    Object.values(count).forEach(c=>{ if(c>max) max=c; });

    // no votes
    if(max===0){
      pushLog({ publicText:"【投票結果】全體棄票 / 無有效票，本輪無人放逐。", votes: v.votes });
      State.vote=null;
      $("modalVote")?.classList.add("hidden");
      openAnn(true);
      return;
    }

    const top = Object.keys(count).filter(k=>count[k]===max).map(Number);

    // tie
    if(top.length>=2){
      State.tieCount += 1;
      const policy = rulesCore.voteTiePolicy({state:State, tieCount: State.tieCount});

      pushLog({
        publicText: `【投票結果】平票（最高 ${max} 票）：${top.join("、")} 號。`,
        hiddenText: `（上帝）平票次數：${State.tieCount}｜候選：${top.join("、")}`,
        votes: v.votes
      });

      State.vote=null;
      $("modalVote")?.classList.add("hidden");
      openAnn(true);

      if(policy.action==="none"){
        // second tie => no exile -> go night directly
        alert(policy.message);
        goNextNight();
        return;
      }

      // first tie -> choose pk or revote or none
      openTieModal(top);
      return;
    }

    // not tie -> execute
    State.tieCount = 0;
    const executed = top[0];

    const p=State.players.find(x=>x.seat===executed);
    if(p && p.alive) p.alive=false;

    pushLog({
      publicText:`【放逐】${executed} 號出局。`,
      hiddenText:`（上帝）放逐：${executed}｜票數=${max}`,
      votes: v.votes
    });

    State.vote=null;
    $("modalVote")?.classList.add("hidden");
    openAnn(true);

    // win check
    const win = rulesCore.checkWin({state:State});
    if(win.ended){ endGame(win); return; }

    save(State);
    renderDay();
  }

  // tie modal
  function openTieModal(candidates){
    const modal=$("modalTie");
    if(!modal) return alert("缺少 modalTie（請用新版 index.html）");
    $("tieList") && ($("tieList").textContent = candidates.map(s=>`${s} 號`).join("\n"));
    $("tieInfo") && ($("tieInfo").textContent = `平票名單：${candidates.join("、")}｜請選擇處理方式`);
    modal.classList.remove("hidden");

    // store candidates temp
    modal.dataset.candidates = JSON.stringify(candidates);
  }
  on($("closeTie"),"click",()=> $("modalTie")?.classList.add("hidden"));

  on($("tieNone"),"click",()=>{
    $("modalTie")?.classList.add("hidden");
    pushLog({ publicText:"【平票處理】無人放逐，進入夜晚。" });
    openAnn(true);
    goNextNight();
  });

  on($("tieRevote"),"click",()=>{
    $("modalTie")?.classList.add("hidden");
    pushLog({ publicText:"【平票處理】重新投票（全體存活）。" });
    openAnn(true);
    // open vote again
    State.vote = createVoteSession(null);
    save(State);
    $("modalVote")?.classList.remove("hidden");
    renderVoteModal();
  });

  on($("tiePK"),"click",()=>{
    const modal=$("modalTie");
    const cand = JSON.parse(modal?.dataset?.candidates || "[]");
    $("modalTie")?.classList.add("hidden");
    pushLog({ publicText:`【平票處理】進入 PK 投票（只投：${cand.join("、")}）。` });
    openAnn(true);
    State.vote = createVoteSession(cand);
    save(State);
    $("modalVote")?.classList.remove("hidden");
    renderVoteModal();
  });

  // Day next -> night
  function goNextNight(){
    // next loop
    State.dayNo += 1;
    State.nightNo += 1;

    // reset day helpers
    State.police = { candidates: [], speechOrder: [], speechIdx: 0, direction:"cw", startSeat:null };
    State.vote = null;

    // init night
    initNight();
    showScreen("night");
    renderNight();
    save(State);
  }
  on($("btnDayNext"),"click",goNextNight);

  /* =========================================================
     End game
  ========================================================= */
  function endGame(win){
    State.ended = true;
    State.winner = win.winner;
    pushLog({ publicText: win.message, hiddenText:"（系統判定勝負）" });

    showScreen("end");
    $("endText") && ($("endText").textContent = win.message);
    openAnn(true);
    renderLogs();
    save(State);
  }

  /* =========================================================
     Boot / restore
  ========================================================= */
  function boot(){
    // setup
    ensureRestartBtn();
    syncSetupUI();
    setGodView(!!State.godView);

    // show correct board buttons
    if(State.boardType==="b1"){
      $("boardSpecial")?.classList.add("active");
      $("boardBasic")?.classList.remove("active");
    }else{
      $("boardBasic")?.classList.add("active");
      $("boardSpecial")?.classList.remove("active");
    }

    // route
    if(State.phase==="deal"){
      showScreen("deal");
      updateDealPrompt();
    }else if(State.phase==="night"){
      showScreen("night");
      if(!State.nightSteps || !State.nightSteps.length) initNight();
      renderNight();
    }else if(State.phase==="day"){
      showScreen("day");
      renderDay();
    }else if(State.phase==="end"){
      showScreen("end");
      $("endText") && ($("endText").textContent = (State.logs[0]?.publicText||"遊戲結束"));
    }else{
      showScreen("setup");
    }

    renderLogs();
    renderAnnBox();
  }

  boot();

})();