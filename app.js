/* =========================================================
   狼人殺｜上帝輔助 PWA（完整版）
   ✅ 上帝視角切換（全域）
   ✅ 公告中心：今日/歷史（上帝可看隱藏 + 票型/行動）
   ✅ 白天：
      - 上警 UI（多選）
      - 發言 UI（順/逆/隨機 + 起始位 + 下一位提示）
      - 投票 UI（逐位投票 + 統計 + 處刑）
      - 平票處理彈窗：PK（只投平票名單）/ 重投 / 無人出局
   ✅ 夜晚：
      - 沿用你既有 night steps（WW_DATA.nightStepsBasic）
      - 規則結算（rules.mini.js）
      - 女巫面板（彈窗操作）
   ✅ 全流程存檔 + 匯出 JSON

   依賴：
   - WW_DATA.voteDay
   - WW_DATA.policeSpeech
   - WW_DATA.rulesMini
========================================================= */

(() => {
  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const nowISO = () => new Date().toISOString();

  const DATA = (window.WW_DATA || {});
  const roles = DATA.roles || DATA.rolesBase || {};
  const boards = DATA.boards || {};
  const buildNightSteps = DATA.nightStepsBasic || null;
  const rules = DATA.rulesMini || null;

  const voteDay = DATA.voteDay || null;
  const policeSpeech = DATA.policeSpeech || null;

  const FALLBACK_ROLES = {
    werewolf: { id: "werewolf", name: "狼人", team: "wolf", icon: "🐺" },
    villager:{ id: "villager",name: "村民", team: "villager", icon: "🧑‍🌾" },
    seer:    { id: "seer",    name: "預言家", team: "villager", icon: "🔮" },
    witch:   { id: "witch",   name: "女巫", team: "villager", icon: "🧪" },
    hunter:  { id: "hunter",  name: "獵人", team: "villager", icon: "🔫" },
    guard:   { id: "guard",   name: "守衛", team: "villager", icon: "🛡" },
    blackWolfKing:{ id:"blackWolfKing", name:"黑狼王", team:"wolf", icon:"🐺👑" }
  };
  function roleInfo(roleId){
    return roles?.[roleId] || FALLBACK_ROLES[roleId] || { id: roleId, name: roleId, team:"villager", icon:"❔" };
  }

  const STORAGE_KEY = "wolf_god_assist_v6_full_dayui_tiepk";
  function loadState(){ try{ const r=localStorage.getItem(STORAGE_KEY); return r?JSON.parse(r):null; }catch(e){ return null; } }
  function saveState(s){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }catch(e){} }
  function clearState(){ try{ localStorage.removeItem(STORAGE_KEY); }catch(e){} }

  function suggestBasicConfigByCount(n){
    const b = boards?.basic;
    if(b?.presets?.[n]) return structuredClone(b.presets[n]);
    if(typeof b?.fallback === "function") return b.fallback(n);
    const wolves = n >= 9 ? 2 : 1;
    const guard = n >= 11 ? 1 : 0;
    const fixed = 1+1+1+guard;
    const villager = Math.max(0, n - wolves - fixed);
    return { werewolf:wolves, villager, seer:1, witch:1, hunter:1, guard };
  }

  const State = {
    godUnlocked:false,
    godView:false,
    pin:"0000",

    boardType:"basic",
    playerCount:9,
    rolesCount:suggestBasicConfigByCount(9),

    settings:{
      rules:{
        noConsecutiveGuard:true,
        witchCannotSelfSave:true,
        hunterPoisonNoShoot:true,
        blackWolfKingPoisonNoSkill:true
      }
    },

    phase:"setup",
    players:[],
    dealIndex:0,

    nightNo:1,
    dayNo:1,

    night:{
      guardTarget:null,
      wolfTarget:null,
      seerCheckTarget:null,
      seerResult:null,
      witchSaveUsed:false,
      witchPoisonUsed:false,
      witchSave:false,
      witchPoisonTarget:null,
      prevGuardTarget:null
    },

    nightSteps:[],
    nightStepIndex:0,
    selectedSeat:null,

    lastResolved:null,
    logs:[],

    skillQueue:[],

    // ✅ 白天 session
    policeSession:null,
    voteSession:null,

    // ✅ 平票上下文
    tieContext:null,

    // ✅ 投票模式狀態
    _voteMode:"normal",          // normal | pk
    _voteTargets:null,           // null=全體存活；array=限制目標
    _pickPoisonMode:false,
    _activeSkill:null
  };

  const saved = loadState();
  if(saved && Array.isArray(saved.players) && saved.players.length){
    Object.assign(State, saved);
    State.settings = State.settings || {rules:{}};
    State.settings.rules = Object.assign({
      noConsecutiveGuard:true,
      witchCannotSelfSave:true,
      hunterPoisonNoShoot:true,
      blackWolfKingPoisonNoSkill:true
    }, State.settings.rules||{});
    State.night = Object.assign({
      guardTarget:null,wolfTarget:null,seerCheckTarget:null,seerResult:null,
      witchSaveUsed:false,witchPoisonUsed:false,witchSave:false,witchPoisonTarget:null,
      prevGuardTarget:null
    }, State.night||{});
    State.logs = State.logs || [];
    State.skillQueue = State.skillQueue || [];
    State._voteMode = State._voteMode || "normal";
    State._voteTargets = State._voteTargets || null;
    State.tieContext = State.tieContext || null;
  }

  /* =========================
     Screens
  ========================= */
  const Screens = {
    setup: $("screen-setup"),
    deal:  $("screen-deal"),
    night: $("screen-night"),
    day:   $("screen-day"),
  };
  function showScreen(name){
    Object.values(Screens).forEach(s=>s&&s.classList.remove("active"));
    Screens[name]?.classList.add("active");
    State.phase = name;
    saveState(State);
  }

  /* =========================
     God toggle
  ========================= */
  const btnGodToggle = $("btnGodToggle");
  const fabGod = $("fabGod");
  function setGodView(on){
    State.godView = !!on;
    document.body.classList.toggle("god-on", State.godView);
    const icon = State.godView ? "🔓" : "🔒";
    if(btnGodToggle) btnGodToggle.textContent = icon;
    if(fabGod) fabGod.textContent = icon;
    saveState(State);
    renderAnnouncementBox();
    renderLogList();
  }
  function openGodModal(){
    $("pinInput").value="";
    $("pinWarn").classList.add("hidden");
    $("modalGod").classList.remove("hidden");
    $("pinInput").focus?.();
  }
  function toggleGod(){
    if(State.godView){ setGodView(false); return; }
    if(State.godUnlocked){ setGodView(true); return; }
    openGodModal();
  }
  on(btnGodToggle,"click",toggleGod);
  on(fabGod,"click",toggleGod);
  on($("closeGod"),"click",()=> $("modalGod").classList.add("hidden"));
  on($("pinCancel"),"click",()=> $("modalGod").classList.add("hidden"));
  on($("pinOk"),"click",()=>{
    const v=($("pinInput").value||"").trim();
    if(v===State.pin){
      State.godUnlocked=true;
      $("modalGod").classList.add("hidden");
      setGodView(true);
    }else $("pinWarn").classList.remove("hidden");
  });

  /* =========================
     Setup UI
  ========================= */
  const elPlayerCount=$("playerCount");
  const elRoleTotal=$("roleTotal");
  const elPlayerTotal=$("playerTotal");
  const warnRoleTotal=$("warnRoleTotal");
  const rangeCount=$("rangeCount");

  function rolesTotal(){ return Object.values(State.rolesCount).reduce((a,b)=>a+(b||0),0); }
  function syncSetupUI(){
    if(elPlayerCount) elPlayerCount.textContent=String(State.playerCount);
    if(rangeCount) rangeCount.value=String(State.playerCount);
    const rt=rolesTotal();
    if(elRoleTotal) elRoleTotal.textContent=String(rt);
    if(elPlayerTotal) elPlayerTotal.textContent=String(State.playerCount);
    const ok=rt===State.playerCount;
    warnRoleTotal?.classList.toggle("hidden", ok);
    const startBtn=$("btnStart");
    if(startBtn){
      startBtn.disabled=!ok;
      startBtn.textContent= ok ? "開始 → 抽身分" : "⚠️ 角色數需等於玩家數";
    }
    saveState(State);
  }

  on($("btnPlus"),"click",()=>{ State.playerCount=clamp(State.playerCount+1,6,16); if(State.boardType==="basic") State.rolesCount=suggestBasicConfigByCount(State.playerCount); syncSetupUI(); });
  on($("btnMinus"),"click",()=>{ State.playerCount=clamp(State.playerCount-1,6,16); if(State.boardType==="basic") State.rolesCount=suggestBasicConfigByCount(State.playerCount); syncSetupUI(); });
  on(rangeCount,"input",(e)=>{ State.playerCount=clamp(Number(e.target.value),6,16); if(State.boardType==="basic") State.rolesCount=suggestBasicConfigByCount(State.playerCount); syncSetupUI(); });

  on($("boardBasic"),"click",()=>{ State.boardType="basic"; $("boardBasic")?.classList.add("active"); $("boardSpecial")?.classList.remove("active"); State.rolesCount=suggestBasicConfigByCount(State.playerCount); syncSetupUI(); });
  on($("boardSpecial"),"click",()=>{ State.boardType="special"; $("boardSpecial")?.classList.add("active"); $("boardBasic")?.classList.remove("active"); syncSetupUI(); });

  on($("btnSuggest"),"click",()=>{ State.rolesCount=suggestBasicConfigByCount(State.playerCount); syncSetupUI(); });

  /* =========================
     Role config modal
  ========================= */
  const modalRole=$("modalRole");
  const roleConfigBody=$("roleConfigBody");
  function roleRow(roleId){
    const info=roleInfo(roleId);
    const wrap=document.createElement("div");
    wrap.style.display="flex";
    wrap.style.alignItems="center";
    wrap.style.justifyContent="space-between";
    wrap.style.gap="10px";
    wrap.style.padding="10px 4px";
    wrap.style.borderBottom="1px dashed rgba(0,0,0,.08)";

    const left=document.createElement("div");
    left.style.fontWeight="1000";
    left.textContent=`${info.icon?info.icon+" ":""}${info.name}`;

    const right=document.createElement("div");
    right.style.display="flex";
    right.style.alignItems="center";
    right.style.gap="10px";

    const minus=document.createElement("button");
    minus.className="btn ghost tiny"; minus.type="button"; minus.textContent="－";
    const num=document.createElement("div");
    num.style.minWidth="36px"; num.style.textAlign="center"; num.style.fontWeight="1000";
    num.textContent=String(State.rolesCount[roleId]??0);
    const plus=document.createElement("button");
    plus.className="btn ghost tiny"; plus.type="button"; plus.textContent="＋";

    minus.onclick=()=>{ State.rolesCount[roleId]=Math.max(0,(State.rolesCount[roleId]||0)-1); num.textContent=String(State.rolesCount[roleId]); syncSetupUI(); };
    plus.onclick=()=>{ State.rolesCount[roleId]=(State.rolesCount[roleId]||0)+1; num.textContent=String(State.rolesCount[roleId]); syncSetupUI(); };

    right.append(minus,num,plus);
    wrap.append(left,right);
    return wrap;
  }
  function renderRoleConfig(){
    if(!roleConfigBody) return;
    roleConfigBody.innerHTML="";
    const tip=document.createElement("div");
    tip.className="hint"; tip.style.marginBottom="10px";
    tip.textContent="提示：角色總數必須等於玩家人數，才能開始。";
    roleConfigBody.appendChild(tip);
    ["werewolf","villager","seer","witch","hunter","guard","blackWolfKing"].forEach(rid=>{
      roleConfigBody.appendChild(roleRow(rid));
    });
  }
  on($("btnOpenRoleConfig"),"click",()=>{ renderRoleConfig(); modalRole?.classList.remove("hidden"); });
  on($("closeRole"),"click",()=> modalRole?.classList.add("hidden"));
  on($("roleReset"),"click",()=>{ State.rolesCount=suggestBasicConfigByCount(State.playerCount); renderRoleConfig(); syncSetupUI(); });
  on($("roleApply"),"click",()=>{ modalRole?.classList.add("hidden"); syncSetupUI(); });

  /* =========================
     Build players + deal
  ========================= */
  const dealText=$("dealText");
  const modalReveal=$("modalReveal");
  const revealCard=$("revealCard");
  const revealRole=$("revealRole");

  function buildPlayers(){
    const rolesArr=[];
    for(const [rid,cnt] of Object.entries(State.rolesCount)){
      for(let i=0;i<(cnt||0);i++) rolesArr.push(rid);
    }
    for(let i=rolesArr.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [rolesArr[i],rolesArr[j]]=[rolesArr[j],rolesArr[i]];
    }
    State.players = rolesArr.map((rid,idx)=>({
      seat:idx+1,
      roleId:rid,
      team:roleInfo(rid).team||"villager",
      alive:true,
      isChief:false,
      notes:""
    }));
    State.dealIndex=0;
    State.logs=[];
    State.skillQueue=[];
    State.policeSession=null;
    State.voteSession=null;
    State.tieContext=null;
    State._voteMode="normal";
    State._voteTargets=null;
    saveState(State);
  }
  function updateDealPrompt(){
    const seat=State.dealIndex+1;
    if(dealText){
      dealText.innerHTML = seat<=State.players.length ? `請 <b>${seat} 號</b> 拿手機` : `所有玩家已抽完身分`;
    }
  }

  let holdTimer=null, revealShown=false;
  function showReveal(){
    if(State.dealIndex>=State.players.length) return;
    const p=State.players[State.dealIndex];
    const info=roleInfo(p.roleId);
    revealRole.textContent=`${info.icon?info.icon+" ":""}${info.name}`;
    modalReveal.classList.remove("hidden");
    revealCard.classList.add("flipped");
    revealShown=true;
    navigator.vibrate?.(70);
  }
  function hideReveal(){
    if(!revealShown) return;
    revealCard.classList.remove("flipped");
    modalReveal.classList.add("hidden");
    revealShown=false;
  }

  on($("btnStart"),"click",()=>{
    if(rolesTotal()!==State.playerCount) return;
    buildPlayers();
    showScreen("deal");
    updateDealPrompt();
  });
  on($("btnDealBack"),"click",()=>{ hideReveal(); showScreen("setup"); });
  on($("btnNextPlayer"),"click",()=>{ hideReveal(); State.dealIndex++; updateDealPrompt(); saveState(State); });
  on($("btnFinishDeal"),"click",()=>{ hideReveal(); initNightWizard(); showScreen("night"); renderNightUI(); saveState(State); });

  const btnHoldReveal=$("btnHoldReveal");
  if(btnHoldReveal){
    const startHold=()=>{ clearTimeout(holdTimer); holdTimer=setTimeout(showReveal,1200); };
    const endHold=()=>{ clearTimeout(holdTimer); hideReveal(); };
    on(btnHoldReveal,"touchstart",startHold,{passive:true});
    on(btnHoldReveal,"touchend",endHold);
    on(btnHoldReveal,"touchcancel",endHold);
    on(btnHoldReveal,"mousedown",startHold);
    on(btnHoldReveal,"mouseup",endHold);
    on(btnHoldReveal,"mouseleave",endHold);
  }

  /* =========================
     Helpers: players
  ========================= */
  function alivePlayers(){ return State.players.filter(p=>p.alive); }

  /* =========================
     Announcement + Log + Export
  ========================= */
  const modalAnn=$("modalAnn");
  const annBox=$("annBox");
  let annMode="today";
  let annAsWitchPanel=false;

  function getTodayLog(){ return State.logs[0]||null; }

  function formatVotes(votes){
    if(!votes?.length) return "—";
    const map=new Map();
    votes.forEach(v=>{
      const key=v.toSeat?`${v.toSeat}號`:"棄票";
      map.set(key,(map.get(key)||0)+1);
    });
    const lines=[];
    for(const [k,c] of map.entries()) lines.push(`${k}：${c} 票`);
    lines.push("");
    votes.forEach(v=> lines.push(`${v.fromSeat}號 → ${v.toSeat ? (v.toSeat+"號") : "棄票"}`));
    return lines.join("\n");
  }

  function renderAnnouncementBox(){
    if(!annBox) return;

    if(annAsWitchPanel){
      annBox.innerHTML="";
      const wolf=State.night.wolfTarget;
      const canSave=!State.night.witchSaveUsed && !!wolf;
      const canPoison=!State.night.witchPoisonUsed;

      const title=document.createElement("div");
      title.style.whiteSpace="pre-line";
      title.style.fontWeight="1000";
      title.style.marginBottom="10px";
      title.textContent=
        `【女巫操作】\n今晚被刀：${wolf?wolf+" 號":"（尚未選狼刀）"}\n\n解藥：${State.night.witchSaveUsed?"已用過":"可用"}\n毒藥：${State.night.witchPoisonUsed?"已用過":"可用"}`;
      annBox.appendChild(title);

      const witchSeat=State.players.find(p=>p.roleId==="witch")?.seat ?? null;
      if(State.settings?.rules?.witchCannotSelfSave && wolf && witchSeat && wolf===witchSeat){
        const warn=document.createElement("div");
        warn.className="hint";
        warn.textContent="⚠️ 規則：女巫不能自救（就算按救，結算也會判定無效）";
        annBox.appendChild(warn);
      }

      const area=document.createElement("div");
      area.style.display="flex"; area.style.flexDirection="column"; area.style.gap="10px";

      const row1=document.createElement("div");
      row1.style.display="flex"; row1.style.gap="10px";
      const btnSave=document.createElement("button");
      btnSave.className="btn"; btnSave.type="button";
      btnSave.textContent=State.night.witchSave?"✅ 已選擇用解藥":"用解藥救他";
      btnSave.disabled=!canSave;
      btnSave.onclick=()=>{ State.night.witchSave=!State.night.witchSave; saveState(State); renderAnnouncementBox(); renderNightUI(); };
      const btnNoSave=document.createElement("button");
      btnNoSave.className="btn ghost"; btnNoSave.type="button"; btnNoSave.textContent="不用解藥";
      btnNoSave.onclick=()=>{ State.night.witchSave=false; saveState(State); renderAnnouncementBox(); renderNightUI(); };
      row1.append(btnSave,btnNoSave);

      const row2=document.createElement("div");
      row2.style.display="flex"; row2.style.gap="10px";
      const btnPickPoison=document.createElement("button");
      btnPickPoison.className="btn"; btnPickPoison.type="button";
      btnPickPoison.textContent=State.night.witchPoisonTarget?`☠️ 已毒 ${State.night.witchPoisonTarget} 號（改選）`:"用毒藥（點座位）";
      btnPickPoison.disabled=!canPoison;
      btnPickPoison.onclick=()=>{ alert("請回到夜晚座位圓點，點選要毒的人"); State._pickPoisonMode=true; saveState(State); };
      const btnNoPoison=document.createElement("button");
      btnNoPoison.className="btn ghost"; btnNoPoison.type="button"; btnNoPoison.textContent="不用毒藥";
      btnNoPoison.onclick=()=>{ State.night.witchPoisonTarget=null; State._pickPoisonMode=false; saveState(State); renderAnnouncementBox(); renderNightUI(); };
      row2.append(btnPickPoison,btnNoPoison);

      const done=document.createElement("button");
      done.className="btn ghost"; done.type="button"; done.textContent="完成女巫 → 回夜晚流程";
      done.onclick=()=>{
        State._pickPoisonMode=false;
        annAsWitchPanel=false;
        modalAnn.classList.add("hidden");
        State.selectedSeat=null;
        State.nightStepIndex=Math.min(State.nightSteps.length-1,State.nightStepIndex+1);
        renderNightUI();
        saveState(State);
      };

      area.append(row1,row2,done);
      annBox.appendChild(area);
      return;
    }

    const latest=getTodayLog();
    if(annMode==="today"){
      if(!latest){ annBox.textContent="（尚無公告）"; return; }
      annBox.textContent = State.godView
        ? (latest.publicText + "\n\n" + (latest.hiddenText||""))
        : latest.publicText;
      return;
    }

    if(!State.logs.length){ annBox.textContent="（尚無歷史公告）"; return; }
    const lines=[];
    State.logs.forEach((l,idx)=>{
      lines.push(`#${State.logs.length-idx}｜第${l.nightNo}夜 / 第${l.dayNo}天`);
      lines.push(l.publicText||"—");
      if(State.godView && l.hiddenText) lines.push(l.hiddenText);
      if(State.godView && l.votes){ lines.push("【票型】"); lines.push(formatVotes(l.votes)); }
      if(State.godView && l.actions){ lines.push("【行動】"); lines.push(JSON.stringify(l.actions,null,2)); }
      lines.push("—");
    });
    annBox.textContent=lines.join("\n");
  }

  function openAnnouncementModal(asWitch=false, forceToday=false){
    annAsWitchPanel=!!asWitch;
    if(forceToday) annMode="today";
    modalAnn.classList.remove("hidden");
    $("annToday")?.classList.toggle("active", annMode==="today");
    $("annHistory")?.classList.toggle("active", annMode==="history");
    renderAnnouncementBox();
  }

  on($("fabAnn"),"click",()=> openAnnouncementModal(false,true));
  on($("btnOpenAnnouncement"),"click",()=> openAnnouncementModal(false,true));
  on($("btnOpenAnnouncement2"),"click",()=> openAnnouncementModal(false,true));
  on($("closeAnn"),"click",()=>{ annAsWitchPanel=false; State._pickPoisonMode=false; modalAnn.classList.add("hidden"); });
  on($("annToday"),"click",()=>{ annMode="today"; $("annToday")?.classList.add("active"); $("annHistory")?.classList.remove("active"); renderAnnouncementBox(); });
  on($("annHistory"),"click",()=>{ annMode="history"; $("annHistory")?.classList.add("active"); $("annToday")?.classList.remove("active"); renderAnnouncementBox(); });
  on($("btnCopyAnn"),"click",async()=>{
    try{ await navigator.clipboard.writeText(annBox?.textContent||""); alert("已複製"); }
    catch(e){ alert("複製失敗（可能需要 HTTPS / PWA 安裝）"); }
  });

  const modalLog=$("modalLog");
  const logList=$("logList");
  function renderLogList(){
    if(!logList) return;
    logList.innerHTML="";
    if(!State.logs.length){ logList.textContent="—"; return; }
    State.logs.forEach(l=>{
      const item=document.createElement("div");
      item.className="logitem";
      const title=document.createElement("div");
      title.className="logtitle";
      title.textContent=`第${l.nightNo}夜 / 第${l.dayNo}天｜${new Date(l.ts).toLocaleString()}`;
      const text=document.createElement("div");
      text.className="logtext";
      text.textContent = State.godView ? (l.publicText + "\n\n" + (l.hiddenText||"")) : l.publicText;
      item.append(title,text);
      logList.appendChild(item);
    });
  }
  function openLogModal(){ renderLogList(); modalLog.classList.remove("hidden"); }
  on($("btnOpenLog"),"click",openLogModal);
  on($("btnOpenLog2"),"click",openLogModal);
  on($("closeLog"),"click",()=> modalLog.classList.add("hidden"));
  on($("btnClearSave"),"click",()=>{ if(confirm("確定清除整局存檔與紀錄？")){ clearState(); location.reload(); } });

  function downloadJSON(filename, obj){
    const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),500);
  }
  function exportReplay(){
    const includeSecrets=!!State.godView;
    const payload = rules?.exportPayload
      ? rules.exportPayload({state:State, includeSecrets})
      : {state:State, exportedAt:nowISO()};
    downloadJSON(`狼人殺復盤_${Date.now()}.json`, payload);
  }
  on($("btnExport"),"click",exportReplay);
  on($("btnExport2"),"click",exportReplay);

  function appendToTodayLog({ publicAppend="", hiddenAppend="", votes=null, actions=null }){
    const log = State.logs[0];
    if(!log) return;
    if(publicAppend) log.publicText = (log.publicText||"").trim() + "\n" + publicAppend;
    if(hiddenAppend) log.hiddenText = (log.hiddenText||"").trim() + "\n" + hiddenAppend;
    if(votes) log.votes = votes;
    if(actions) log.actions = Object.assign({}, log.actions||{}, actions);
    saveState(State);
  }

  /* =========================================================
     Night wizard（沿用：支援女巫彈窗、毒藥點座位）
  ========================================================= */
  const nightTag=$("nightTag");
  const nightScript=$("nightScript");
  const nightSeats=$("nightSeats");

  function resetNightActions(){
    const prev=State.night.prevGuardTarget ?? null;
    const saveUsed=!!State.night.witchSaveUsed;
    const poisonUsed=!!State.night.witchPoisonUsed;
    State.night={
      guardTarget:null,wolfTarget:null,seerCheckTarget:null,seerResult:null,
      witchSaveUsed:saveUsed,witchPoisonUsed:poisonUsed,
      witchSave:false,witchPoisonTarget:null,
      prevGuardTarget:prev
    };
    State.selectedSeat=null;
  }
  function initNightWizard(){
    resetNightActions();
    State.nightSteps = (typeof buildNightSteps==="function")
      ? buildNightSteps(State.players, State.night)
      : [
        {key:"close",type:"info",godScript:"天黑請閉眼。",publicScript:"天黑請閉眼。"},
        {key:"wolf",type:"pick",pickTarget:"wolfTarget",required:true,godScript:"狼人刀誰？",publicScript:"狼人請睜眼。"},
        {key:"dawn",type:"resolve",godScript:"天亮請睜眼。",publicScript:"天亮請睜眼。"}
      ];
    State.nightStepIndex=0;
  }
  function currentStep(){ return State.nightSteps[State.nightStepIndex]; }

  function renderSeatDots(container, onPick){
    if(!container) return;
    container.innerHTML="";
    State.players.forEach(p=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="seat"+(p.alive?"":" dead")+(p.isChief?" chief":"");
      b.textContent=String(p.seat);
      if(State.selectedSeat===p.seat) b.classList.add("selected");
      b.onclick=()=>{
        if(!p.alive) return;

        // 女巫毒藥：點座位選毒
        if(State._pickPoisonMode){
          State.night.witchPoisonTarget=p.seat;
          State._pickPoisonMode=false;
          saveState(State);
          renderAnnouncementBox();
          renderNightUI();
          return;
        }

        State.selectedSeat=p.seat;
        onPick?.(p.seat);
        renderNightUI();
      };
      container.appendChild(b);
    });
  }

  function getScriptForStep(step){
    const base = State.godView ? (step.godScript||step.publicScript||"") : (step.publicScript||"");
    let extra="";

    // 預言家結果只給上帝看（若你的 step 有 afterScript）
    if(State.godView && step.type==="seer" && typeof step.afterScript==="function"){
      extra = step.afterScript({seerResult:State.night.seerResult}) || "";
    }

    // 女巫提示
    if(step.type==="witch" && State.godView){
      extra += `\n\n（上帝）今晚被刀：${State.night.wolfTarget?State.night.wolfTarget+" 號":"—"}`;
      extra += `\n解藥：${State.night.witchSaveUsed?"已用過":"可用"}；毒藥：${State.night.witchPoisonUsed?"已用過":"可用"}`;
      if(State.night.witchSave) extra+="\n✅ 已選擇使用解藥。";
      if(State.night.witchPoisonTarget) extra+=`\n☠️ 已選擇毒 ${State.night.witchPoisonTarget} 號。`;
      extra += "\n\n點『下一步』會開啟女巫操作彈窗。";
    } else if(step.type==="witch" && !State.godView){
      extra += "\n\n（提示）請切換到 🔓 上帝視角 再操作女巫用藥。";
    }

    return (base+(extra||"")).trim();
  }

  function renderNightUI(){
    if(nightTag) nightTag.textContent=`第 ${State.nightNo} 夜`;
    const step=currentStep();
    if(!step){ if(nightScript) nightScript.textContent="（夜晚流程結束）"; return; }
    if(nightScript) nightScript.textContent=getScriptForStep(step);

    renderSeatDots(nightSeats,(seat)=>{
      const s=currentStep(); if(!s) return;

      if(s.type==="pick" && s.pickTarget){
        State.night[s.pickTarget]=seat;
      }

      if(s.type==="seer" && s.pickTarget){
        State.night[s.pickTarget]=seat;
        const t=State.players.find(p=>p.seat===seat);
        State.night.seerResult=(t?.team==="wolf")?"wolf":"villager";
      }

      saveState(State);
    });

    saveState(State);
  }

  function canNextNight(){
    const step=currentStep(); if(!step) return false;
    if(step.type==="pick" && step.required && step.pickTarget) return !!State.night[step.pickTarget];
    return true;
  }

  function nightPrev(){ State.selectedSeat=null; State.nightStepIndex=Math.max(0,State.nightStepIndex-1); renderNightUI(); }
  function nightNext(){
    const step=currentStep(); if(!step) return;

    if(step.type==="pick" && step.required && step.pickTarget && !State.night[step.pickTarget]){
      navigator.vibrate?.([60,40,60]); return;
    }

    // 女巫步驟：開彈窗操作
    if(step.type==="witch"){
      if(!State.godView){ alert("需要 🔓 上帝視角 才能操作女巫"); return; }
      openAnnouncementModal(true,true);
      return;
    }

    // 結算
    if(step.type==="resolve"){
      resolveNightAndAnnounce();
      return;
    }

    State.selectedSeat=null;
    State.nightStepIndex=Math.min(State.nightSteps.length-1,State.nightStepIndex+1);
    renderNightUI();
  }

  on($("btnNightPrev"),"click",nightPrev);
  on($("btnNightNext"),"click",()=>{ if(!canNextNight()) return; nightNext(); });

  /* =========================================================
     Resolve night -> Day
  ========================================================= */
  function buildSkillQueueFromResolved(resolved){
    State.skillQueue=[];
    if(!resolved?.deaths?.length) return;
    resolved.deaths.forEach(seat=>{
      const p=State.players.find(x=>x.seat===seat);
      if(!p) return;
      if(p.roleId==="hunter") State.skillQueue.push({roleId:"hunter", seat, kind:"shoot"});
      if(p.roleId==="blackWolfKing") State.skillQueue.push({roleId:"blackWolfKing", seat, kind:"explode"});
    });
    saveState(State);
  }

  function resolveNightAndAnnounce(){
    if(!rules?.resolveNight || !rules?.buildAnnouncement || !rules?.makeLogItem){
      alert("缺少 /data/flow/rules.mini.js"); return;
    }
    const resolved = rules.resolveNight({
      players:State.players,
      night:State.night,
      settings:State.settings?.rules || {}
    });
    State.lastResolved = resolved;

    const {publicText, hiddenText} = rules.buildAnnouncement({
      nightNo:State.nightNo,
      dayNo:State.dayNo,
      players:State.players,
      night:State.night,
      resolved,
      settings:State.settings?.rules || {}
    });

    const logItem = rules.makeLogItem({
      ts:nowISO(),
      nightNo:State.nightNo,
      dayNo:State.dayNo,
      publicText,
      hiddenText,
      votes:null,
      actions:{ night: { ...State.night } },
      resolvedMeta:resolved?.meta||null
    });
    State.logs.unshift(logItem);

    // 用藥鎖定
    if(State.night.witchSave) State.night.witchSaveUsed=true;
    if(State.night.witchPoisonTarget) State.night.witchPoisonUsed=true;

    // 記錄守衛原始守誰（供「不能連守」）
    State.night.prevGuardTarget = resolved?.meta?.guardTargetRaw ?? State.night.guardTarget ?? State.night.prevGuardTarget;

    // 進白天
    showScreen("day");
    $("dayTag") && ($("dayTag").textContent = `第 ${State.dayNo} 天`);
    saveState(State);

    openAnnouncementModal(false,true);
    renderLogList();

    // 夜晚死亡技能（需要上帝）
    buildSkillQueueFromResolved(resolved);
    runNextSkillIfAny();

    // 白天初始化 session
    State.policeSession = policeSpeech ? policeSpeech.createPoliceSession(State.players) : null;
    State.voteSession = null;
    State.tieContext = null;
    State._voteMode="normal";
    State._voteTargets=null;
    saveState(State);
  }

  /* =========================================================
     ✅ 白天：上警 UI（多選）
  ========================================================= */
  function ensurePoliceModal(){
    if($("modalPolice")) return;
    const wrap=document.createElement("div");
    wrap.id="modalPolice";
    wrap.className="modal hidden";
    wrap.innerHTML=`
      <div class="modal-card">
        <div class="modal-head">
          <div class="modal-title">上警名單</div>
          <button class="iconbtn" id="closePolice">✕</button>
        </div>
        <div class="modal-body">
          <div class="hint">點選座位：加入/取消上警（僅存活可選）</div>
          <div class="seats" id="policeSeats"></div>
        </div>
        <div class="modal-actions">
          <button class="btn ghost" id="policeClear">清空</button>
          <button class="btn" id="policeDone">完成</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    on($("closePolice"),"click",()=> wrap.classList.add("hidden"));
    on($("policeClear"),"click",()=>{
      if(!State.policeSession) return;
      State.policeSession.candidates = [];
      saveState(State);
      renderPoliceSeats();
    });
    on($("policeDone"),"click",()=>{
      wrap.classList.add("hidden");
      if(State.policeSession){
        const c = State.policeSession.candidates || [];
        appendToTodayLog({
          publicAppend: `【上警】${c.length? c.join("、")+" 號":"無人上警"}`,
          hiddenAppend: `（上帝）上警名單：${c.length? c.join("、"):"—"}`
        });
      }
      renderLogList();
      openAnnouncementModal(false,true);
    });
  }

  function renderPoliceSeats(){
    const box=$("policeSeats");
    if(!box || !State.policeSession) return;
    box.innerHTML="";
    const cand = State.policeSession.candidates || [];
    alivePlayers().forEach(p=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="seat";
      b.textContent=String(p.seat);
      if(cand.includes(p.seat)) b.classList.add("selected");
      b.onclick=()=>{
        if(!policeSpeech) return;
        policeSpeech.toggleCandidate(State.policeSession, p.seat);
        saveState(State);
        renderPoliceSeats();
      };
      box.appendChild(b);
    });
  }

  function openPoliceModal(){
    if(!policeSpeech){ alert("缺少 /data/flow/police.speech.js"); return; }
    ensurePoliceModal();
    if(!State.policeSession){
      State.policeSession = policeSpeech.createPoliceSession(State.players);
    }else{
      State.policeSession.alive = alivePlayers().map(p=>p.seat);
    }
    saveState(State);
    renderPoliceSeats();
    $("modalPolice").classList.remove("hidden");
  }

  /* =========================================================
     ✅ 白天：發言 UI（順/逆/隨機 + 起始位 + 下一位）
  ========================================================= */
  function ensureSpeechModal(){
    if($("modalSpeech")) return;
    const wrap=document.createElement("div");
    wrap.id="modalSpeech";
    wrap.className="modal hidden";
    wrap.innerHTML=`
      <div class="modal-card">
        <div class="modal-head">
          <div class="modal-title">發言順序</div>
          <button class="iconbtn" id="closeSpeech">✕</button>
        </div>
        <div class="modal-body">
          <div class="hint">方向：順時針/逆時針/隨機。起始位：點座位選擇。</div>

          <div style="display:flex;gap:10px;margin:10px 0;">
            <button class="btn ghost" id="dirCW">順時針</button>
            <button class="btn ghost" id="dirCCW">逆時針</button>
            <button class="btn ghost" id="dirRAND">隨機</button>
          </div>

          <div class="hint" id="speechInfo"></div>
          <div class="seats" id="speechSeats"></div>

          <div class="card" style="margin-top:10px;">
            <div style="font-weight:1000;margin-bottom:6px;">順序</div>
            <div id="speechOrder" style="white-space:pre-line;line-height:1.6;"></div>
            <div class="hint" id="speechNextHint" style="margin-top:6px;"></div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn ghost" id="speechBuild">生成順序</button>
          <button class="btn" id="speechNext">下一位</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    on($("closeSpeech"),"click",()=> wrap.classList.add("hidden"));
    on($("dirCW"),"click",()=> setSpeechDir("cw"));
    on($("dirCCW"),"click",()=> setSpeechDir("ccw"));
    on($("dirRAND"),"click",()=> setSpeechDir("rand"));
    on($("speechBuild"),"click",()=> buildSpeechOrder());
    on($("speechNext"),"click",()=> nextSpeaker());
  }

  function setSpeechDir(dir){
    if(!policeSpeech || !State.policeSession) return;
    policeSpeech.setDirection(State.policeSession, dir);
    saveState(State);
    renderSpeechUI();
  }

  function renderSpeechSeats(){
    const box=$("speechSeats");
    if(!box || !State.policeSession) return;
    box.innerHTML="";
    const pool = (State.policeSession.candidates?.length
      ? State.policeSession.candidates
      : alivePlayers().map(p=>p.seat)
    );

    pool.forEach(seat=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="seat";
      b.textContent=String(seat);
      if(State.policeSession.startSeat === seat) b.classList.add("selected");
      b.onclick=()=>{
        State.policeSession.startSeat = seat;
        saveState(State);
        renderSpeechUI();
      };
      box.appendChild(b);
    });
  }

  function renderSpeechUI(){
    if(!State.policeSession) return;
    const info=$("speechInfo");
    const orderEl=$("speechOrder");
    const nextEl=$("speechNextHint");

    const cand=State.policeSession.candidates||[];
    const mode = cand.length ? `警上（${cand.join("、")}）` : "全體存活";
    if(info){
      info.textContent = `模式：${mode}｜方向：${State.policeSession.direction}｜起始：${State.policeSession.startSeat ?? "未選"}`;
    }

    renderSpeechSeats();

    if(orderEl){
      orderEl.textContent = State.policeSession.order?.length
        ? State.policeSession.order.map((s,i)=>`${i+1}. ${s} 號`).join("\n")
        : "（尚未生成）";
    }

    if(nextEl){
      const cur = policeSpeech?.currentSpeaker(State.policeSession);
      nextEl.textContent = State.policeSession.done
        ? "✅ 發言流程結束"
        : (cur ? `👉 下一位發言：${cur} 號` : "👉 請先生成順序");
    }

    // 高亮目前發言者
    const box=$("speechSeats");
    if(box && State.policeSession.order?.length && !State.policeSession.done){
      const cur=policeSpeech.currentSpeaker(State.policeSession);
      [...box.querySelectorAll(".seat")].forEach(btn=>{
        btn.classList.toggle("highlight", Number(btn.textContent)===cur);
      });
    }
  }

  function buildSpeechOrder(){
    if(!policeSpeech){ alert("缺少 /data/flow/police.speech.js"); return; }
    if(!State.policeSession){
      State.policeSession = policeSpeech.createPoliceSession(State.players);
    }
    const start = State.policeSession.startSeat
      ?? (State.policeSession.candidates?.[0] ?? alivePlayers()[0]?.seat ?? 1);

    policeSpeech.buildOrder(State.policeSession, start);
    saveState(State);

    const exported = policeSpeech.exportSession(State.policeSession);

    appendToTodayLog({
      publicAppend: `【發言順序】${exported.order.length ? exported.order.join(" → ") : "（未生成）"}`,
      hiddenAppend: `（上帝）發言資料：${JSON.stringify(exported)}`
    });

    renderSpeechUI();
    renderLogList();
    openAnnouncementModal(false,true);
  }

  function nextSpeaker(){
    if(!policeSpeech || !State.policeSession) return;
    const cur = policeSpeech.currentSpeaker(State.policeSession);
    if(!cur){ alert("請先生成順序"); return; }
    policeSpeech.nextSpeaker(State.policeSession);
    saveState(State);
    renderSpeechUI();
  }

  function openSpeechModal(){
    if(!policeSpeech){ alert("缺少 /data/flow/police.speech.js"); return; }
    ensureSpeechModal();
    if(!State.policeSession){
      State.policeSession = policeSpeech.createPoliceSession(State.players);
    }else{
      State.policeSession.alive = alivePlayers().map(p=>p.seat);
    }
    saveState(State);
    renderSpeechUI();
    $("modalSpeech").classList.remove("hidden");
  }

  /* =========================================================
     ✅ 平票彈窗（PK / 重投 / 無人出局）
  ========================================================= */
  function ensureTieModal(){
    if($("modalTie")) return;
    const wrap=document.createElement("div");
    wrap.id="modalTie";
    wrap.className="modal hidden";
    wrap.innerHTML=`
      <div class="modal-card">
        <div class="modal-head">
          <div class="modal-title">平票處理</div>
          <button class="iconbtn" id="closeTie">✕</button>
        </div>
        <div class="modal-body">
          <div class="hint" id="tieInfo"></div>
          <div class="card">
            <div style="font-weight:1000;margin-bottom:6px;">平票名單</div>
            <div id="tieList" style="white-space:pre-line;line-height:1.6;"></div>
          </div>
          <div class="hint" style="margin-top:8px;">選擇處理方式：</div>
        </div>
        <div class="modal-actions" style="flex-direction:column;gap:10px;">
          <button class="btn" id="tiePK">PK 投票（只投平票名單）</button>
          <button class="btn ghost" id="tieRevote">重新投票（全體存活）</button>
          <button class="btn ghost" id="tieNone">無人出局（本輪不處刑）</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    on($("closeTie"),"click",()=> wrap.classList.add("hidden"));
    on($("tiePK"),"click",()=> chooseTieOption("pk"));
    on($("tieRevote"),"click",()=> chooseTieOption("revote"));
    on($("tieNone"),"click",()=> chooseTieOption("none"));
  }

  function openTieModal(ctx){
    ensureTieModal();
    State.tieContext = ctx;
    saveState(State);

    const info=$("tieInfo");
    const list=$("tieList");

    const label = ctx.mode==="pk" ? "PK 後仍平票" : "首次平票";
    info.textContent = `【${label}】最高票 ${ctx.maxVotes} 票`;
    list.textContent = ctx.candidates.map(s=>`${s} 號`).join("\n");

    $("modalTie").classList.remove("hidden");
  }

  function chooseTieOption(type){
    $("modalTie")?.classList.add("hidden");
    if(!State.tieContext) return;

    if(type==="none"){
      appendToTodayLog({
        publicAppend:`【平票處理】無人出局。`,
        hiddenAppend:`（上帝）平票名單：${State.tieContext.candidates.join("、")}｜選擇：無人出局`
      });
      renderLogList();
      openAnnouncementModal(false,true);
      State.tieContext=null;
      saveState(State);
      return;
    }

    if(type==="revote"){
      appendToTodayLog({
        publicAppend:`【平票處理】重新投票（全體存活）。`,
        hiddenAppend:`（上帝）平票名單：${State.tieContext.candidates.join("、")}｜選擇：重新投票`
      });
      startVote({ mode:"normal", restrictTargets:null, label:"重新投票" });
      return;
    }

    if(type==="pk"){
      appendToTodayLog({
        publicAppend:`【平票處理】進入 PK 投票（僅投平票名單）。`,
        hiddenAppend:`（上帝）平票名單：${State.tieContext.candidates.join("、")}｜選擇：PK`
      });
      startVote({ mode:"pk", restrictTargets: State.tieContext.candidates.slice(), label:"PK 投票" });
      return;
    }
  }

  /* =========================================================
     ✅ 投票 UI（支援 PK/重投）
  ========================================================= */
  function ensureVoteModal(){
    if($("modalVote")) return;
    const wrap=document.createElement("div");
    wrap.id="modalVote";
    wrap.className="modal hidden";
    wrap.innerHTML=`
      <div class="modal-card">
        <div class="modal-head">
          <div class="modal-title" id="voteTitle">投票</div>
          <button class="iconbtn" id="closeVote">✕</button>
        </div>
        <div class="modal-body">
          <div class="hint" id="votePrompt"></div>
          <div class="seats" id="voteSeats"></div>
          <div class="card" style="margin-top:10px;">
            <div style="font-weight:1000;margin-bottom:6px;">即時票數</div>
            <div id="voteStats" style="white-space:pre-line;line-height:1.6;"></div>
          </div>
          <div class="hint" id="voteHint" style="margin-top:8px;"></div>
        </div>
        <div class="modal-actions">
          <button class="btn ghost" id="voteAbstain">棄票</button>
          <button class="btn" id="voteDone" disabled>完成投票</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    on($("closeVote"),"click",()=> wrap.classList.add("hidden"));
    on($("voteAbstain"),"click",()=> castVote(null));
    on($("voteDone"),"click",()=> finalizeVote());
  }

  function formatStats(stats){
    const keys=Object.keys(stats||{});
    keys.sort((a,b)=>{
      if(a==="abstain") return 1;
      if(b==="abstain") return -1;
      return Number(a)-Number(b);
    });
    return keys.map(k=>{
      if(k==="abstain") return `棄票：${stats[k]} 票`;
      return `${k} 號：${stats[k]} 票`;
    }).join("\n") || "（尚未投票）";
  }

  function ensureVoteSession(){
    if(!voteDay){ alert("缺少 /data/flow/vote.day.js"); return false; }
    State.voteSession = voteDay.createVoteSession(State.players);
    saveState(State);
    return true;
  }

  function startVote({ mode="normal", restrictTargets=null, label="投票" }){
    if(!ensureVoteSession()) return;
    ensureVoteModal();
    State._voteMode = mode;
    State._voteTargets = restrictTargets ? restrictTargets.slice() : null;
    $("voteTitle") && ($("voteTitle").textContent = label);
    saveState(State);
    renderVoteUI();
    $("modalVote").classList.remove("hidden");
  }

  function openVoteModal(){
    startVote({ mode:"normal", restrictTargets:null, label:"投票" });
  }

  function renderVoteUI(){
    if(!State.voteSession) return;
    const prompt=$("votePrompt");
    const seats=$("voteSeats");
    const statsEl=$("voteStats");
    const hint=$("voteHint");
    const doneBtn=$("voteDone");

    const cur = voteDay.currentVoter(State.voteSession);
    prompt.textContent = State.voteSession.done
      ? "✅ 投票完成"
      : (cur ? `請 ${cur} 號投票（點選要投的座位）` : "（初始化中）");

    seats.innerHTML="";

    const alive = alivePlayers().map(p=>p.seat);
    const targets = State._voteTargets ? State._voteTargets.filter(s=>alive.includes(s)) : alive;

    targets.forEach(seat=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="seat";
      b.textContent=String(seat);

      // 禁自己
      const disabled = (cur === seat);
      if(disabled){ b.disabled=true; b.classList.add("disabled"); }

      b.onclick=()=> castVote(seat);
      seats.appendChild(b);
    });

    const stats = voteDay.getVoteStats(State.voteSession);
    statsEl.textContent = formatStats(stats);

    hint.textContent = State.voteSession.done ? "點「完成投票」進入統計與處刑" : "也可以按「棄票」。";
    doneBtn.disabled = !State.voteSession.done;

    saveState(State);
  }

  function castVote(toSeatOrNull){
    if(!State.voteSession) return;
    const cur = voteDay.currentVoter(State.voteSession);
    if(!cur) return;

    const ok = voteDay.castVote(State.voteSession, cur, toSeatOrNull);
    if(!ok){ navigator.vibrate?.([60,40,60]); return; }

    saveState(State);
    renderVoteUI();
  }

  function killSeat(seat, reason){
    const p = State.players.find(x=>x.seat===seat);
    if(!p || !p.alive) return false;
    p.alive=false;
    appendToTodayLog({ hiddenAppend:`（死亡）${seat} 號｜原因：${reason}` });
    return true;
  }

  /* =========================================================
     ✅ 技能彈窗（獵人/黑狼王），並支援「被毒禁用」
  ========================================================= */
  function ensureSkillModal(){
    if($("modalSkill")) return;
    const wrap=document.createElement("div");
    wrap.id="modalSkill";
    wrap.className="modal hidden";
    wrap.innerHTML=`
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
          <button class="btn" id="skillConfirm" disabled>確認</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    on($("closeSkill"),"click",()=> wrap.classList.add("hidden"));
    on($("skillSkip"),"click",()=> onSkillSkip());
    on($("skillConfirm"),"click",()=> onSkillConfirm());
  }

  let skillTargetSeat=null;
  function openSkillModal({roleId, seat, kind}){
    ensureSkillModal();
    skillTargetSeat=null;

    const title=$("skillTitle");
    const hint=$("skillHint");
    const seatsBox=$("skillSeats");
    const confirm=$("skillConfirm");
    confirm.disabled=true;

    const role=roleInfo(roleId);
    title.textContent=`${role.icon?role.icon+" ":""}${role.name} 技能`;

    hint.textContent = (kind==="shoot")
      ? `獵人 ${seat} 號是否開槍？點選要帶走的人（可放棄）。`
      : `黑狼王 ${seat} 號是否帶走一人？點選目標（可放棄）。`;

    seatsBox.innerHTML="";
    State.players.forEach(p=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="seat"+(p.alive?"":" dead");
      b.textContent=String(p.seat);

      const disabled = (!p.alive) || (p.seat===seat);
      if(disabled){ b.disabled=true; b.classList.add("disabled"); }

      b.onclick=()=>{
        if(disabled) return;
        skillTargetSeat=p.seat;
        [...seatsBox.querySelectorAll(".seat")].forEach(x=>x.classList.remove("selected"));
        b.classList.add("selected");
        confirm.disabled=false;
      };
      seatsBox.appendChild(b);
    });

    State._activeSkill={roleId, seat, kind};
    saveState(State);
    $("modalSkill").classList.remove("hidden");
  }

  function runNextSkillIfAny(){
    if(!State.skillQueue.length){
      renderLogList();
      saveState(State);
      return;
    }
    const next=State.skillQueue.shift();
    saveState(State);

    if(!next) return;

    if(!State.godView){
      alert("需要 🔓 上帝視角 才能處理死亡技能");
      State.skillQueue.unshift(next);
      saveState(State);
      return;
    }

    // 被毒禁用（只針對夜晚死亡：依 rulesMini.canTriggerDeathSkill）
    if(rules?.canTriggerDeathSkill && State.lastResolved){
      const ok = rules.canTriggerDeathSkill({
        roleId: next.roleId,
        seat: next.seat,
        resolved: State.lastResolved,
        settings: State.settings?.rules || {}
      });
      if(!ok){
        appendToTodayLog({
          hiddenAppend: next.roleId==="hunter"
            ? `（技能）獵人 ${next.seat} 號：因「被毒」→ 禁止開槍。`
            : `（技能）黑狼王 ${next.seat} 號：因「被毒」→ 禁止使用技能。`
        });
        runNextSkillIfAny();
        return;
      }
    }

    openSkillModal(next);
  }

  function onSkillSkip(){
    const s=State._activeSkill;
    if(!s){ $("modalSkill")?.classList.add("hidden"); return; }
    appendToTodayLog({
      hiddenAppend: s.kind==="shoot"
        ? `（技能）獵人 ${s.seat} 號 放棄開槍。`
        : `（技能）黑狼王 ${s.seat} 號 放棄帶人。`
    });
    $("modalSkill").classList.add("hidden");
    State._activeSkill=null;
    saveState(State);
    runNextSkillIfAny();
  }

  function onSkillConfirm(){
    const s=State._activeSkill;
    if(!s || !skillTargetSeat) return;
    const target=skillTargetSeat;

    const changed = killSeat(target, s.kind==="shoot"
      ? `獵人 ${s.seat} 號 開槍帶走`
      : `黑狼王 ${s.seat} 號 死亡技能帶走`
    );

    appendToTodayLog({
      publicAppend: s.kind==="shoot"
        ? (changed ? `⚡ 獵人 ${s.seat} 號 開槍帶走：${target} 號。` : `⚡ 獵人 ${s.seat} 號 開槍但目標已死亡。`)
        : (changed ? `💥 黑狼王 ${s.seat} 號 帶走：${target} 號。` : `💥 黑狼王 ${s.seat} 號 帶走但目標已死亡。`),
      hiddenAppend: s.kind==="shoot"
        ? `（技能）獵人 ${s.seat} 號 → ${target} 號`
        : `（技能）黑狼王 ${s.seat} 號 → ${target} 號`
    });

    $("modalSkill").classList.add("hidden");
    State._activeSkill=null;
    saveState(State);
    runNextSkillIfAny();
  }

  /* =========================
     finalizeVote（含平票分流）
  ========================= */
  function finalizeVote(){
    if(!State.voteSession || !voteDay) return;

    const result = voteDay.getResult(State.voteSession);
    const votes = voteDay.exportVotes(State.voteSession);

    const label = State._voteMode==="pk" ? "PK投票" : "投票";

    appendToTodayLog({
      hiddenAppend: `【${label}完成】最高票：${result.maxVotes}｜${result.tie ? "平票" : "不平票"}｜模式=${State._voteMode}`,
      votes
    });

    // 平票
    if(result.tie){
      const candidates = Object.keys(result.stats)
        .filter(k=>k!=="abstain" && result.stats[k]===result.maxVotes)
        .map(k=>Number(k));

      appendToTodayLog({
        publicAppend:`【${label}結果】平票（最高票 ${result.maxVotes} 票）：${candidates.join("、")} 號。`,
        hiddenAppend:`（上帝）平票名單：${candidates.join("、")}｜等待選擇處理方式`
      });

      $("modalVote").classList.add("hidden");

      openTieModal({
        mode: State._voteMode==="pk" ? "pk" : "normal",
        candidates,
        maxVotes: result.maxVotes
      });

      renderLogList();
      openAnnouncementModal(false,true);
      return;
    }

    // 不平票
    const executed = result.executed[0];
    if(!executed){
      appendToTodayLog({ publicAppend:`【${label}結果】無人被處刑。` });
      $("modalVote").classList.add("hidden");
      openAnnouncementModal(false,true);
      renderLogList();
      return;
    }

    const changed = killSeat(executed, `${label}處刑`);
    appendToTodayLog({
      publicAppend: changed ? `【處刑】${executed} 號出局。` : `【處刑】${executed} 號已死亡（無變更）。`,
      hiddenAppend: `（處刑）${executed} 號｜來源=${label}`
    });

    // 處刑技能：獵人/黑狼王（處刑不是被毒 → 允許）
    const p = State.players.find(x=>x.seat===executed);
    if(p && (p.roleId==="hunter" || p.roleId==="blackWolfKing")){
      State.skillQueue.push({ roleId:p.roleId, seat:executed, kind: p.roleId==="hunter" ? "shoot" : "explode" });
      saveState(State);
      $("modalVote").classList.add("hidden");
      openAnnouncementModal(false,true);
      runNextSkillIfAny();
      return;
    }

    $("modalVote").classList.add("hidden");
    openAnnouncementModal(false,true);
    renderLogList();
  }

  /* =========================
     Day buttons
  ========================= */
  on($("btnPolice"),"click", openPoliceModal);
  on($("btnTalkOrder"),"click", openSpeechModal);
  on($("btnVote"),"click", openVoteModal);

  /* =========================
     Menu shortcuts
  ========================= */
  on($("btnMenu"),"click",()=> openAnnouncementModal(false,true));

  /* =========================
     Boot
  ========================= */
  function boot(){
    setGodView(!!State.godView);

    if(State.phase && Screens[State.phase]) showScreen(State.phase);
    else showScreen("setup");

    if(State.phase==="deal") updateDealPrompt();
    if(State.phase==="night"){
      if(!State.nightSteps || !State.nightSteps.length) initNightWizard();
      renderNightUI();
    }
    if(State.phase==="day"){
      $("dayTag") && ($("dayTag").textContent = `第 ${State.dayNo} 天`);
      if(State.skillQueue?.length) runNextSkillIfAny();
      if(!State.policeSession && policeSpeech) State.policeSession = policeSpeech.createPoliceSession(State.players);
    }

    syncSetupUI();
    renderLogList();
  }

  boot();

})();