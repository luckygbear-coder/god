/* =========================================================
   狼人殺｜上帝輔助 PWA（白天 UI 接上版）
   - 夜晚：維持你目前的（night steps + rules resolve + 技能彈窗）
   - 白天：新增
     ✅ 上警（多選候選） + 生成發言順序（順/逆/隨機） + 下一位提示
     ✅ 投票（逐位投票） + 即時統計 + 最高票處刑
     ✅ 處刑後若獵人/黑狼王 → 走你既有技能彈窗（含被毒禁用）
     ✅ 全流程寫入公告中心 + 歷史紀錄 + 匯出 JSON
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

  // ✅ NEW：白天模組
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

  const STORAGE_KEY = "wolf_god_assist_v4_dayui";
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

    // ✅ 技能隊列（夜晚死亡/處刑死亡都用同一套）
    skillQueue:[],

    // ✅ 白天：上警/發言 session
    policeSession:null, // policeSpeech.createPoliceSession()
    // ✅ 白天：投票 session
    voteSession:null    // voteDay.createVoteSession()
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
     Setup UI（略：維持你現有）
  ========================= */
  const elPlayerCount=$("playerCount");
  const elRoleTotal=$("roleTotal");
  const elPlayerTotal=$("playerTotal");
  const warnRoleTotal=$("warnRoleTotal");
  const rangeCount=$("rangeCount");

  function rolesTotal(){
    return Object.values(State.rolesCount).reduce((a,b)=>a+(b||0),0);
  }
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
     Role config modal（沿用你現有）
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
     Build players + deal（維持你現有的長按翻牌）
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
     Night wizard（沿用你現有）
  ========================= */
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
    if(State.godView && step.type==="seer" && typeof step.afterScript==="function"){
      extra = step.afterScript({seerResult:State.night.seerResult}) || "";
    }
    if(step.type==="witch" && State.godView && typeof step.infoForWitch==="function"){
      extra="\n\n"+step.infoForWitch({wolfTarget:State.night.wolfTarget});
      extra+=`\n\n解藥：${State.night.witchSaveUsed?"已用過":"可用"}；毒藥：${State.night.witchPoisonUsed?"已用過":"可用"}`;
      if(State.night.witchSave) extra+="\n✅ 已選擇使用解藥。";
      if(State.night.witchPoisonTarget) extra+=`\n☠️ 已選擇毒 ${State.night.witchPoisonTarget} 號。`;
    }
    if(step.type==="witch" && !State.godView){
      extra+="\n\n（提示）請切換到 🔓 上帝視角再操作女巫用藥。";
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
      if(s.type==="pick" && s.pickTarget) State.night[s.pickTarget]=seat;
      if(s.type==="seer" && s.pickTarget){
        State.night[s.pickTarget]=seat;
        if(typeof s.apply==="function"){
          const out=s.apply({players:State.players, seat});
          if(out?.seerResult) State.night.seerResult=out.seerResult;
        }else{
          const t=State.players.find(p=>p.seat===seat);
          State.night.seerResult=(t?.team==="wolf")?"wolf":"villager";
        }
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
  async function nightNext(){
    const step=currentStep(); if(!step) return;
    if(step.type==="pick" && step.required && step.pickTarget && !State.night[step.pickTarget]){
      navigator.vibrate?.([60,40,60]); return;
    }
    if(step.type==="witch" && State.godView){ openAnnouncementModal(true); return; }
    if(step.type==="resolve"){ resolveNightAndAnnounce(); return; }
    State.selectedSeat=null;
    State.nightStepIndex=Math.min(State.nightSteps.length-1,State.nightStepIndex+1);
    renderNightUI();
  }
  on($("btnNightPrev"),"click",nightPrev);
  on($("btnNightNext"),"click",()=>{ if(!canNextNight()) return; nightNext(); });

  /* =========================
     Announcement modal（含女巫面板）
  ========================= */
  const modalAnn=$("modalAnn");
  const annBox=$("annBox");
  let annMode="today";
  let annAsWitchPanel=false;

  function getTodayLog(){ return State.logs[0]||null; }

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
        warn.textContent="⚠️ 規則：女巫不能自救（按救也會在結算判定無效）";
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
      btnPickPoison.onclick=()=>{ alert("請在下方座位圓點點選要毒的玩家"); State._pickPoisonMode=true; saveState(State); };
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
    try{ await navigator.clipboard.writeText(annBox?.textContent||""); alert("已複製"); }catch(e){ alert("複製失敗（可能需要 HTTPS / PWA 安裝）"); }
  });

  /* =========================
     Log modal
  ========================= */
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

  /* =========================
     Export JSON
  ========================= */
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

  /* =========================================================
     ✅ 白天 UI：上警 / 發言 / 投票（核心）
  ========================================================= */

  // ---------- 通用：寫入今日 log ----------
  function appendToTodayLog({ publicAppend="", hiddenAppend="", votes=null, actions=null }){
    const log = State.logs[0];
    if(!log) return;
    if(publicAppend) log.publicText = (log.publicText||"").trim() + "\n" + publicAppend;
    if(hiddenAppend) log.hiddenText = (log.hiddenText||"").trim() + "\n" + hiddenAppend;
    if(votes) log.votes = votes;
    if(actions) log.actions = Object.assign({}, log.actions||{}, actions);
    saveState(State);
  }

  // ---------- 通用：座位清單 ----------
  function alivePlayers(){
    return State.players.filter(p=>p.alive);
  }

  // ---------- 上警彈窗 ----------
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
      // 寫入今日紀錄（上帝可見）
      if(State.policeSession){
        const c = State.policeSession.candidates || [];
        appendToTodayLog({
          hiddenAppend: `【上警】${c.length? c.join(" 號、")+" 號":"無人上警"}`
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
    if(!policeSpeech){
      alert("缺少 /data/flow/police.speech.js");
      return;
    }
    ensurePoliceModal();
    if(!State.policeSession){
      State.policeSession = policeSpeech.createPoliceSession(State.players);
      saveState(State);
    }else{
      // refresh alive
      State.policeSession.alive = State.players.filter(p=>p.alive).map(p=>p.seat);
      saveState(State);
    }
    renderPoliceSeats();
    $("modalPolice").classList.remove("hidden");
  }

  // ---------- 發言順序彈窗 ----------
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
          <div class="hint">方向：順時針/逆時針/隨機。起始位可點座位選擇。</div>

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
    const pool = (State.policeSession.candidates?.length ? State.policeSession.candidates : State.players.filter(p=>p.alive).map(p=>p.seat));

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

    // 高亮座位（在順序座位池中）
    const box=$("speechSeats");
    if(box && State.policeSession.order?.length && !State.policeSession.done){
      const cur=policeSpeech.currentSpeaker(State.policeSession);
      [...box.querySelectorAll(".seat")].forEach(btn=>{
        btn.classList.toggle("highlight", Number(btn.textContent)===cur);
      });
    }
  }

  function buildSpeechOrder(){
    if(!policeSpeech){
      alert("缺少 /data/flow/police.speech.js"); return;
    }
    if(!State.policeSession){
      State.policeSession = policeSpeech.createPoliceSession(State.players);
    }
    const start = State.policeSession.startSeat ?? (State.policeSession.candidates?.[0] ?? State.players.find(p=>p.alive)?.seat ?? 1);
    policeSpeech.buildOrder(State.policeSession, start);
    saveState(State);

    // 寫入今日紀錄：公開可看順序、上帝可看上警名單
    const exported = policeSpeech.exportSession(State.policeSession);
    appendToTodayLog({
      publicAppend: `【發言順序】${exported.order.length ? exported.order.join(" → ") : "（未生成）"}`,
      hiddenAppend: `（上帝）發言順序資料：${JSON.stringify(exported)}`
    });

    renderSpeechUI();
    renderLogList();
  }

  function nextSpeaker(){
    if(!policeSpeech || !State.policeSession) return;
    const cur = policeSpeech.currentSpeaker(State.policeSession);
    if(!cur){
      alert("請先生成順序"); return;
    }
    policeSpeech.nextSpeaker(State.policeSession);
    saveState(State);
    renderSpeechUI();
  }

  function openSpeechModal(){
    if(!policeSpeech){
      alert("缺少 /data/flow/police.speech.js");
      return;
    }
    ensureSpeechModal();

    if(!State.policeSession){
      State.policeSession = policeSpeech.createPoliceSession(State.players);
      saveState(State);
    }else{
      // refresh alive
      State.policeSession.alive = State.players.filter(p=>p.alive).map(p=>p.seat);
      saveState(State);
    }

    renderSpeechUI();
    $("modalSpeech").classList.remove("hidden");
  }

  // ---------- 投票彈窗 ----------
  function ensureVoteModal(){
    if($("modalVote")) return;
    const wrap=document.createElement("div");
    wrap.id="modalVote";
    wrap.className="modal hidden";
    wrap.innerHTML=`
      <div class="modal-card">
        <div class="modal-head">
          <div class="modal-title">投票</div>
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
    const lines=[];
    const keys=Object.keys(stats||{});
    // 將 abstain 放最後
    keys.sort((a,b)=>{
      if(a==="abstain") return 1;
      if(b==="abstain") return -1;
      return Number(a)-Number(b);
    });
    keys.forEach(k=>{
      if(k==="abstain") lines.push(`棄票：${stats[k]} 票`);
      else lines.push(`${k} 號：${stats[k]} 票`);
    });
    return lines.join("\n") || "（尚未投票）";
  }

  function ensureVoteSession(){
    if(!voteDay){
      alert("缺少 /data/flow/vote.day.js");
      return false;
    }
    if(!State.voteSession || State.voteSession.done){
      State.voteSession = voteDay.createVoteSession(State.players);
      saveState(State);
    }else{
      // refresh voters（死亡可能變動）
      State.voteSession.voters = State.players.filter(p=>p.alive).map(p=>p.seat);
      saveState(State);
    }
    return true;
  }

  function renderVoteUI(){
    const prompt=$("votePrompt");
    const seats=$("voteSeats");
    const statsEl=$("voteStats");
    const hint=$("voteHint");
    const doneBtn=$("voteDone");

    if(!State.voteSession) return;

    const cur = voteDay.currentVoter(State.voteSession);
    if(prompt){
      prompt.textContent = State.voteSession.done
        ? "✅ 投票完成"
        : (cur ? `請 ${cur} 號投票（點選要投的座位）` : "（初始化中）");
    }

    if(seats){
      seats.innerHTML="";
      // 目標：存活座位（可以投任何存活；也可投自己？通常不行，這裡禁自己）
      const targets = State.players.filter(p=>p.alive).map(p=>p.seat);
      targets.forEach(seat=>{
        const b=document.createElement("button");
        b.type="button";
        b.className="seat";
        b.textContent=String(seat);

        // 禁止投自己
        const disabled = (cur === seat);
        if(disabled){ b.disabled=true; b.classList.add("disabled"); }

        b.onclick=()=> castVote(seat);
        seats.appendChild(b);
      });
    }

    const stats = voteDay.getVoteStats(State.voteSession);
    if(statsEl) statsEl.textContent = formatStats(stats);

    if(hint){
      hint.textContent = State.voteSession.done
        ? "點「完成投票」進入統計與處刑"
        : "也可以按「棄票」。";
    }

    if(doneBtn) doneBtn.disabled = !State.voteSession.done;

    saveState(State);
  }

  function openVoteModal(){
    if(!ensureVoteSession()) return;
    ensureVoteModal();
    renderVoteUI();
    $("modalVote").classList.remove("hidden");
  }

  function castVote(toSeatOrNull){
    if(!State.voteSession) return;
    const cur = voteDay.currentVoter(State.voteSession);
    if(!cur) return;

    const ok = voteDay.castVote(State.voteSession, cur, toSeatOrNull);
    if(!ok){
      navigator.vibrate?.([60,40,60]);
      return;
    }
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

  // ✅ 技能彈窗（沿用你現有的邏輯）——簡化內嵌一版（不破壞你原本）
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

    // 需要上帝視角
    if(!State.godView){
      alert("需要 🔓 上帝視角 才能處理死亡技能");
      State.skillQueue.unshift(next);
      saveState(State);
      return;
    }

    // 被毒禁用（夜晚死亡才有 lastResolved；處刑沒有毒 → 允許）
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

  function finalizeVote(){
    if(!State.voteSession || !voteDay) return;

    const result = voteDay.getResult(State.voteSession);
    const votes = voteDay.exportVotes(State.voteSession);

    // 寫入 log：票型只有上帝看（公告中心會依 godView 顯示）
    appendToTodayLog({
      hiddenAppend: `【投票完成】最高票：${result.maxVotes}｜${result.tie ? "平票" : "不平票"}`,
      votes
    });

    if(result.tie){
      appendToTodayLog({
        publicAppend: `【投票結果】平票（最高票 ${result.maxVotes} 票）：${Object.keys(result.stats).filter(k=>k!=="abstain" && result.stats[k]===result.maxVotes).join("、")} 號。`,
        hiddenAppend: `（上帝）建議：可進入 PK / 重新投 / 警長歸票（下一步我可幫你做 UI）`
      });
      $("modalVote").classList.add("hidden");
      openAnnouncementModal(false,true);
      renderLogList();
      return;
    }

    const executed = result.executed[0];
    if(!executed){
      appendToTodayLog({ publicAppend:`【投票結果】無人被處刑。` });
      $("modalVote").classList.add("hidden");
      openAnnouncementModal(false,true);
      renderLogList();
      return;
    }

    // 處刑
    const changed = killSeat(executed, "投票處刑");
    appendToTodayLog({
      publicAppend: changed ? `【處刑】${executed} 號出局。` : `【處刑】${executed} 號已死亡（無變更）。`,
      hiddenAppend: `（處刑）${executed} 號`
    });

    // 處刑技能（獵人/黑狼王）
    const p = State.players.find(x=>x.seat===executed);
    if(p && (p.roleId==="hunter" || p.roleId==="blackWolfKing")){
      // 處刑不是「被毒」，所以不需要禁用；直接進技能隊列
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

  // ---------- 白天按鈕接上 ----------
  on($("btnPolice"),"click", openPoliceModal);
  on($("btnTalkOrder"),"click", openSpeechModal);
  on($("btnVote"),"click", openVoteModal);

  /* =========================================================
     Night resolve（用 rules.mini.js）
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
      actions:null,
      resolvedMeta:resolved?.meta||null
    });
    State.logs.unshift(logItem);

    // 守衛不能連守：保存 raw
    State.night.prevGuardTarget = resolved?.meta?.guardTargetRaw ?? State.night.guardTarget ?? State.night.prevGuardTarget;

    // 用藥鎖定
    if(State.night.witchSave) State.night.witchSaveUsed=true;
    if(State.night.witchPoisonTarget) State.night.witchPoisonUsed=true;

    // 進白天（先加 1）
    State.nightNo += 1;
    State.dayNo += 1;

    showScreen("day");
    $("dayTag") && ($("dayTag").textContent = `第 ${State.dayNo-1} 天`);

    saveState(State);
    renderLogList();

    openAnnouncementModal(false,true);

    // 夜晚技能
    buildSkillQueueFromResolved(resolved);
    runNextSkillIfAny();

    // ✅ 白天初始化：上警、投票 session 清空（讓你白天重新開始流程）
    State.policeSession = policeSpeech ? policeSpeech.createPoliceSession(State.players) : null;
    State.voteSession = null;
    saveState(State);
  }

  /* =========================
     Votes formatting
  ========================= */
  function formatVotes(votes){
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

  /* =========================
     Menu
  ========================= */
  on($("btnMenu"),"click",()=> openAnnouncementModal(false,true));
  on($("btnOpenLog"),"click",()=>{ renderLogList(); $("modalLog")?.classList.remove("hidden"); });
  on($("btnOpenLog2"),"click",()=>{ renderLogList(); $("modalLog")?.classList.remove("hidden"); });

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
      // 若重整且技能還沒處理完
      if(State.skillQueue?.length) runNextSkillIfAny();
    }

    syncSetupUI();
    renderLogList();
  }

  boot();

})();