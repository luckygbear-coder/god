/* =========================================================
   狼人殺｜上帝輔助 PWA（app.js 完整版・可覆蓋）
   - 不依賴你上一段貼到一半的程式
   - 盡量使用你 index.html 已存在的 id
========================================================= */
(() => {
  /* =========================
     Utils
  ========================= */
  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const nowISO = () => new Date().toISOString();
  const deepClone = (x) => JSON.parse(JSON.stringify(x));

  /* =========================
     Anti text-select (iOS long-press)
  ========================= */
  try {
    const css = document.createElement("style");
    css.textContent = `
      html, body, .app-shell, .screen, button, .seat, .btn, .pill, .iconbtn, .tag {
        -webkit-user-select: none !important;
        user-select: none !important;
        -webkit-touch-callout: none !important;
      }
    `;
    document.head.appendChild(css);
  } catch (e) {}
  function stopTouchSelect(el){
    if(!el) return;
    // iOS: preventDefault needs passive:false
    el.addEventListener("touchstart", (e)=>{ e.preventDefault(); }, {passive:false});
  }

  /* =========================
     External data (optional)
  ========================= */
  const DATA = (window.WW_DATA || {});
  const rolesData = DATA.roles || DATA.rolesBase || {};
  const boards = DATA.boards || {};

  /* =========================
     Role fallback
  ========================= */
  const FALLBACK_ROLES = {
    werewolf: { id: "werewolf", name: "狼人", team: "wolf", icon: "🐺" },
    villager: { id: "villager", name: "村民", team: "villager", icon: "🧑‍🌾" },
    seer:     { id: "seer", name: "預言家", team: "villager", icon: "🔮" },
    witch:    { id: "witch", name: "女巫", team: "villager", icon: "🧪" },
    hunter:   { id: "hunter", name: "獵人", team: "villager", icon: "🔫" },
    guard:    { id: "guard", name: "守衛", team: "villager", icon: "🛡" },
    blackWolfKing: { id: "blackWolfKing", name: "黑狼王", team: "wolf", icon: "🐺👑" },
  };
  function roleInfo(roleId){
    return rolesData?.[roleId] || FALLBACK_ROLES[roleId] || { id: roleId, name: roleId, team: "villager", icon: "❔" };
  }

  /* =========================
     Storage
  ========================= */
  const STORAGE_KEY = "wolf_god_assist_v8_full_rewrite";
  function loadState(){ try{ const r=localStorage.getItem(STORAGE_KEY); return r?JSON.parse(r):null; }catch(e){ return null; } }
  function saveState(s){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }catch(e){} }
  function clearState(){ try{ localStorage.removeItem(STORAGE_KEY); }catch(e){} }

  /* =========================
     Suggested config
  ========================= */
  function suggestBasicConfigByCount(n){
    const b = boards?.basic;
    if(b?.presets?.[n]) return deepClone(b.presets[n]);
    if(typeof b?.fallback === "function") return b.fallback(n);

    const wolves = n >= 9 ? 2 : 1;
    const guard = n >= 11 ? 1 : 0;
    const fixed = 1 + 1 + 1 + guard; // seer+witch+hunter+guard
    const villager = Math.max(0, n - wolves - fixed);
    return { werewolf:wolves, villager, seer:1, witch:1, hunter:1, guard };
  }

  /* =========================
     Default state
  ========================= */
  function defaultState(){
    return {
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

      logs:[],          // newest first
      lastResolved:null,

      // Day flows
      police:{ candidates:[], direction:"cw", startSeat:null, order:[], idx:0, done:false },
      vote:null,        // created when start vote

      // tie
      tieContext:null,

      // skill queue
      skillQueue:[],
      activeSkill:null,

      // modes
      _pickPoisonMode:false,
      _voteMode:"normal",        // normal | pk
      _voteTargets:null,         // null or array

      // game over
      gameOver:false,
      winner:null
    };
  }

  const State = defaultState();
  const saved = loadState();
  if(saved && typeof saved === "object"){
    Object.assign(State, saved);
    State.settings = State.settings || {rules:{}};
    State.settings.rules = Object.assign(defaultState().settings.rules, State.settings.rules||{});
    State.night = Object.assign(defaultState().night, State.night||{});
    State.logs = Array.isArray(State.logs)?State.logs:[];
    State.police = Object.assign(defaultState().police, State.police||{});
    State.skillQueue = Array.isArray(State.skillQueue)?State.skillQueue:[];
    State._voteMode = State._voteMode || "normal";
    State._voteTargets = State._voteTargets || null;
    State.gameOver = !!State.gameOver;
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
     Restart button (auto insert)
  ========================= */
  function restartToSetup(){
    clearState();
    const fresh = defaultState();
    Object.keys(State).forEach(k=>delete State[k]);
    Object.assign(State, fresh);

    setGodView(false);
    showScreen("setup");
    syncSetupUI();
    renderLogList();
    closeAllModals();
    saveState(State);
  }
  function ensureRestartBtn(){
    const topActions = document.querySelector(".top-actions");
    if(!topActions) return;
    if($("btnRestartGame")) return;

    const btn = document.createElement("button");
    btn.className="iconbtn";
    btn.id="btnRestartGame";
    btn.type="button";
    btn.title="重新開始（回到板子/配置）";
    btn.textContent="🔁";
    topActions.insertBefore(btn, topActions.firstChild);

btn.onclick = () => {
  openRestartModal();
};

  function closeAllModals(){
    [
      "modalAnn","modalLog","modalRole","modalGod","modalReveal",
      "modalVote","modalTie","modalSpeech","modalPolice","modalSkill"
    ].forEach(id=>$(id)?.classList.add("hidden"));
  }

  /* =========================
     God toggle
  ========================= */
  const btnGodToggle = $("btnGodToggle");
  const fabGod = $("fabGod");
  function setGodView(flag){
    State.godView = !!flag;
    document.body.classList.toggle("god-on", State.godView);
    const icon = State.godView ? "🔓" : "🔒";
    if(btnGodToggle) btnGodToggle.textContent = icon;
    if(fabGod) fabGod.textContent = icon;
    saveState(State);
    renderAnnouncementBox();
    renderLogList();
  }
  function openGodModal(){
    if($("pinInput")) $("pinInput").value="";
    $("pinWarn")?.classList.add("hidden");
    $("modalGod")?.classList.remove("hidden");
    $("pinInput")?.focus?.();
  }
  function toggleGod(){
    if(State.godView){ setGodView(false); return; }
    if(State.godUnlocked){ setGodView(true); return; }
    openGodModal();
  }
  on(btnGodToggle,"click",toggleGod);
  on(fabGod,"click",toggleGod);
  on($("closeGod"),"click",()=> $("modalGod")?.classList.add("hidden"));
  on($("pinCancel"),"click",()=> $("modalGod")?.classList.add("hidden"));
  on($("pinOk"),"click",()=>{
    const v = ($("pinInput")?.value||"").trim();
    if(v===State.pin){
      State.godUnlocked=true;
      $("modalGod")?.classList.add("hidden");
      setGodView(true);
    }else{
      $("pinWarn")?.classList.remove("hidden");
    }
  });

  /* =========================
     Setup UI
  ========================= */
  const elPlayerCount=$("playerCount");
  const elRoleTotal=$("roleTotal");
  const elPlayerTotal=$("playerTotal");
  const warnRoleTotal=$("warnRoleTotal");
  const rangeCount=$("rangeCount");

  function rolesTotal(){
    return Object.values(State.rolesCount||{}).reduce((a,b)=>a+(b||0),0);
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
      startBtn.textContent = ok ? "開始 → 抽身分" : "⚠️ 角色數需等於玩家數";
    }
    saveState(State);
  }

  on($("btnPlus"),"click",()=>{
    State.playerCount=clamp(State.playerCount+1,6,16);
    if(State.boardType==="basic") State.rolesCount=suggestBasicConfigByCount(State.playerCount);
    syncSetupUI();
  });
  on($("btnMinus"),"click",()=>{
    State.playerCount=clamp(State.playerCount-1,6,16);
    if(State.boardType==="basic") State.rolesCount=suggestBasicConfigByCount(State.playerCount);
    syncSetupUI();
  });
  on(rangeCount,"input",(e)=>{
    State.playerCount=clamp(Number(e.target.value),6,16);
    if(State.boardType==="basic") State.rolesCount=suggestBasicConfigByCount(State.playerCount);
    syncSetupUI();
  });

  on($("boardBasic"),"click",()=>{
    State.boardType="basic";
    $("boardBasic")?.classList.add("active");
    $("boardSpecial")?.classList.remove("active");
    State.rolesCount=suggestBasicConfigByCount(State.playerCount);
    syncSetupUI();
  });
  on($("boardSpecial"),"click",()=>{
    State.boardType="special";
    $("boardSpecial")?.classList.add("active");
    $("boardBasic")?.classList.remove("active");
    syncSetupUI();
  });

  on($("btnSuggest"),"click",()=>{
    State.rolesCount=suggestBasicConfigByCount(State.playerCount);
    syncSetupUI();
  });

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
    minus.className="btn ghost tiny";
    minus.type="button";
    minus.textContent="－";
    stopTouchSelect(minus);

    const num=document.createElement("div");
    num.style.minWidth="36px";
    num.style.textAlign="center";
    num.style.fontWeight="1000";
    num.textContent=String(State.rolesCount[roleId]??0);

    const plus=document.createElement("button");
    plus.className="btn ghost tiny";
    plus.type="button";
    plus.textContent="＋";
    stopTouchSelect(plus);

    minus.onclick=()=>{
      State.rolesCount[roleId]=Math.max(0,(State.rolesCount[roleId]||0)-1);
      num.textContent=String(State.rolesCount[roleId]);
      syncSetupUI();
    };
    plus.onclick=()=>{
      State.rolesCount[roleId]=(State.rolesCount[roleId]||0)+1;
      num.textContent=String(State.rolesCount[roleId]);
      syncSetupUI();
    };

    right.append(minus,num,plus);
    wrap.append(left,right);
    return wrap;
  }

  function renderRoleConfig(){
    if(!roleConfigBody) return;
    roleConfigBody.innerHTML="";

    const tip=document.createElement("div");
    tip.className="hint";
    tip.style.marginBottom="10px";
    tip.textContent="提示：角色總數必須等於玩家人數，才能開始。";
    roleConfigBody.appendChild(tip);

    ["werewolf","villager","seer","witch","hunter","guard","blackWolfKing"].forEach(rid=>{
      roleConfigBody.appendChild(roleRow(rid));
    });
  }

  on($("btnOpenRoleConfig"),"click",()=>{
    renderRoleConfig();
    modalRole?.classList.remove("hidden");
  });
  on($("closeRole"),"click",()=> modalRole?.classList.add("hidden"));
  on($("roleReset"),"click",()=>{
    State.rolesCount=suggestBasicConfigByCount(State.playerCount);
    renderRoleConfig();
    syncSetupUI();
  });
  on($("roleApply"),"click",()=>{
    modalRole?.classList.add("hidden");
    syncSetupUI();
  });

  /* =========================
     Build players + deal
  ========================= */
  const dealText=$("dealText");
  const modalReveal=$("modalReveal");
  const revealCard=$("revealCard");
  const revealRole=$("revealRole");

  function buildPlayers(){
    const rolesArr=[];
    for(const [rid,cnt] of Object.entries(State.rolesCount||{})){
      for(let i=0;i<(cnt||0);i++) rolesArr.push(rid);
    }
    // shuffle
    for(let i=rolesArr.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [rolesArr[i],rolesArr[j]]=[rolesArr[j],rolesArr[i]];
    }

    State.players = rolesArr.map((rid,idx)=>({
      seat: idx+1,
      roleId: rid,
      team: roleInfo(rid).team||"villager",
      alive: true,
      isChief: false,
      notes: ""
    }));

    State.dealIndex=0;
    State.logs=[];
    State.skillQueue=[];
    State.activeSkill=null;
    State.tieContext=null;
    State.vote=null;

    State.nightNo=1;
    State.dayNo=1;
    State.gameOver=false;
    State.winner=null;

    State.police = deepClone(defaultState().police);
    State.night = Object.assign(defaultState().night, {
      witchSaveUsed:false,
      witchPoisonUsed:false,
      prevGuardTarget:null
    });
    saveState(State);
  }

  function updateDealPrompt(){
    const seat = State.dealIndex+1;
    if(dealText){
      dealText.innerHTML = seat<=State.players.length
        ? `請 <b>${seat} 號</b> 拿手機`
        : `所有玩家已抽完身分`;
    }
  }

  let holdTimer=null, revealShown=false;
  function showReveal(){
    if(State.dealIndex>=State.players.length) return;
    const p=State.players[State.dealIndex];
    const info=roleInfo(p.roleId);

    if(revealRole) revealRole.textContent = `${info.icon?info.icon+" ":""}${info.name}`;
    modalReveal?.classList.remove("hidden");
    revealCard?.classList.add("flipped");
    revealShown=true;
    navigator.vibrate?.(70);
  }
  function hideReveal(){
    if(!revealShown) return;
    revealCard?.classList.remove("flipped");
    modalReveal?.classList.add("hidden");
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
  on($("btnFinishDeal"),"click",()=>{
    hideReveal();
    initNightWizard();
    showScreen("night");
    renderNightUI();
    saveState(State);
  });

  const btnHoldReveal=$("btnHoldReveal");
  if(btnHoldReveal){
    stopTouchSelect(btnHoldReveal);
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
     Helpers
  ========================= */
  const alivePlayers = () => State.players.filter(p=>p.alive);
  const getPlayer = (seat) => State.players.find(p=>p.seat===seat)||null;

  /* =========================
     Win check
  ========================= */
  function countTeams(){
    let wolves=0, villagers=0;
    State.players.forEach(p=>{
      if(!p.alive) return;
      if(p.team==="wolf") wolves++;
      else if(p.team==="villager") villagers++;
    });
    return {wolves, villagers};
  }
  function endGame(winner){
    State.gameOver=true;
    State.winner=winner;
    saveState(State);

    const title = winner==="villager" ? "🎉 正義聯盟獲勝！" : "🐺 邪惡陣營獲勝！";
    const desc = winner==="villager"
      ? "所有邪惡陣營已被放逐。"
      : "狼人數量已達到或超過好人數量。";

    // push log
    State.logs.unshift({
      ts: nowISO(),
      nightNo: State.nightNo,
      dayNo: State.dayNo,
      publicText: `${title}\n${desc}\n\n（可按右上 🔁 重新開始）`,
      hiddenText: State.godView ? `（上帝）結局：${winner}` : "",
      votes: null,
      actions: { end: { winner } }
    });
    saveState(State);
    openAnnouncementModal(false,true);
    renderLogList();
  }
  function checkWin(){
    if(State.gameOver) return true;
    const {wolves, villagers} = countTeams();
    if(wolves<=0){ endGame("villager"); return true; }
    if(villagers>0 && wolves>=villagers){ endGame("wolf"); return true; }
    return false;
  }

  /* =========================================================
     Announcement Center + Logs + Export
  ========================================================= */
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

    /* ===== Witch panel ===== */
    if(annAsWitchPanel){
      annBox.innerHTML="";

      const wolf = State.night.wolfTarget;
      const canPoison = !State.night.witchPoisonUsed;
      const canSave = (!State.night.witchSaveUsed) && (!!wolf);

      const witchSeat = State.players.find(p=>p.roleId==="witch")?.seat ?? null;

      const header=document.createElement("div");
      header.style.whiteSpace="pre-line";
      header.style.fontWeight="1000";
      header.style.marginBottom="10px";

      const knifeLine = State.night.witchSaveUsed
        ? "刀口：⚠️（解藥已用過，本局不顯示刀口）"
        : `刀口：${wolf ? (wolf+" 號") : "（尚未選狼刀）"}`;

      header.textContent = `【女巫操作】\n${knifeLine}\n\n解藥：${State.night.witchSaveUsed?"已用過":"可用"}\n毒藥：${State.night.witchPoisonUsed?"已用過":"可用"}`;
      annBox.appendChild(header);

      if(State.settings?.rules?.witchCannotSelfSave && wolf && witchSeat && wolf===witchSeat){
        const warn=document.createElement("div");
        warn.className="hint";
        warn.textContent="⚠️ 規則：女巫不能自救（就算選救，結算會判定無效）";
        annBox.appendChild(warn);
      }

      const area=document.createElement("div");
      area.style.display="flex";
      area.style.flexDirection="column";
      area.style.gap="10px";

      // save row (only when save not used)
      if(!State.night.witchSaveUsed){
        const row1=document.createElement("div");
        row1.style.display="flex";
        row1.style.gap="10px";

        const btnSave=document.createElement("button");
        btnSave.className="btn";
        btnSave.type="button";
        btnSave.textContent = State.night.witchSave ? "✅ 已選擇用解藥" : "用解藥（救他）";
        btnSave.disabled = !canSave;
        stopTouchSelect(btnSave);
        btnSave.onclick=()=>{
          State.night.witchSave = !State.night.witchSave;
          saveState(State);
          renderAnnouncementBox();
          renderNightUI();
        };

        const btnNoSave=document.createElement("button");
        btnNoSave.className="btn ghost";
        btnNoSave.type="button";
        btnNoSave.textContent="不用解藥";
        stopTouchSelect(btnNoSave);
        btnNoSave.onclick=()=>{
          State.night.witchSave=false;
          saveState(State);
          renderAnnouncementBox();
          renderNightUI();
        };

        row1.append(btnSave, btnNoSave);
        area.appendChild(row1);
      }

      const row2=document.createElement("div");
      row2.style.display="flex";
      row2.style.gap="10px";

      const btnPickPoison=document.createElement("button");
      btnPickPoison.className="btn";
      btnPickPoison.type="button";
      btnPickPoison.textContent = State.night.witchPoisonTarget
        ? `☠️ 已毒 ${State.night.witchPoisonTarget} 號（改選）`
        : "用毒藥（回夜晚點座位）";
      btnPickPoison.disabled = !canPoison;
      stopTouchSelect(btnPickPoison);
      btnPickPoison.onclick=()=>{
        alert("請回到夜晚座位圓點，點選要毒的人");
        State._pickPoisonMode=true;
        saveState(State);
      };

      const btnNoPoison=document.createElement("button");
      btnNoPoison.className="btn ghost";
      btnNoPoison.type="button";
      btnNoPoison.textContent="不用毒藥";
      stopTouchSelect(btnNoPoison);
      btnNoPoison.onclick=()=>{
        State.night.witchPoisonTarget=null;
        State._pickPoisonMode=false;
        saveState(State);
        renderAnnouncementBox();
        renderNightUI();
      };

      row2.append(btnPickPoison, btnNoPoison);
      area.appendChild(row2);

      const done=document.createElement("button");
      done.className="btn primary";
      done.type="button";
      done.textContent="完成女巫操作 → 回夜晚流程";
      stopTouchSelect(done);
      done.onclick=()=>{
        State._pickPoisonMode=false;
        annAsWitchPanel=false;
        modalAnn?.classList.add("hidden");

        // advance to next night step
        State.selectedSeat=null;
        State.nightStepIndex=Math.min(State.nightSteps.length-1, State.nightStepIndex+1);
        saveState(State);
        renderNightUI();
      };

      area.appendChild(done);
      annBox.appendChild(area);
      return;
    }

    /* ===== Normal announcements ===== */
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
    modalAnn?.classList.remove("hidden");
    $("annToday")?.classList.toggle("active", annMode==="today");
    $("annHistory")?.classList.toggle("active", annMode==="history");
    renderAnnouncementBox();
  }

  on($("fabAnn"),"click",()=> openAnnouncementModal(false,true));
  on($("btnOpenAnnouncement"),"click",()=> openAnnouncementModal(false,true));
  on($("btnOpenAnnouncement2"),"click",()=> openAnnouncementModal(false,true));
  on($("closeAnn"),"click",()=>{ annAsWitchPanel=false; State._pickPoisonMode=false; modalAnn?.classList.add("hidden"); });
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
  function openLogModal(){ renderLogList(); modalLog?.classList.remove("hidden"); }
  on($("btnOpenLog"),"click",openLogModal);
  on($("btnOpenLog2"),"click",openLogModal);
  on($("closeLog"),"click",()=> modalLog?.classList.add("hidden"));

  function downloadJSON(filename, obj){
    const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),500);
  }
  function exportReplay(){
    const includeSecrets = !!State.godView;
    const payload = {
      exportedAt: nowISO(),
      includeSecrets,
      state: includeSecrets ? State : redactSecrets(State)
    };
    downloadJSON(`狼人殺復盤_${Date.now()}.json`, payload);
  }
  function redactSecrets(s){
    const copy = deepClone(s);
    // remove roles in player-mode export
    if(copy?.players){
      copy.players = copy.players.map(p=>({
        seat:p.seat, alive:p.alive, isChief:!!p.isChief, team: "?", roleId:"?"
      }));
    }
    return copy;
  }
  on($("btnExport"),"click",exportReplay);
  on($("btnExport2"),"click",exportReplay);

  on($("btnClearSave"),"click",()=>{
    const ok = confirm("確定清除整局存檔並回到開局設定？");
    if(!ok) return;
    restartToSetup();
  });

  function appendNewLog({publicText, hiddenText="", votes=null, actions=null}){
    State.logs.unshift({
      ts: nowISO(),
      nightNo: State.nightNo,
      dayNo: State.dayNo,
      publicText,
      hiddenText,
      votes,
      actions
    });
    saveState(State);
  }

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
     Night Wizard
  ========================================================= */
  const nightTag=$("nightTag");
  const nightScript=$("nightScript");
  const nightSeats=$("nightSeats");

  function resetNightActions(){
    const prev = State.night.prevGuardTarget ?? null;
    const saveUsed = !!State.night.witchSaveUsed;
    const poisonUsed = !!State.night.witchPoisonUsed;
    State.night = Object.assign(defaultState().night, {
      witchSaveUsed: saveUsed,
      witchPoisonUsed: poisonUsed,
      prevGuardTarget: prev
    });
    State.selectedSeat=null;
    State._pickPoisonMode=false;
  }

  function initNightWizard(){
    resetNightActions();
    State.nightSteps = [
      {key:"close",type:"info", godScript:"天黑請閉眼。", publicScript:"天黑請閉眼。"},
      {key:"guard",type:"pick", pickTarget:"guardTarget", required:false, godScript:"守衛請睜眼，你要守誰？", publicScript:"守衛請睜眼。"},
      {key:"wolf", type:"pick", pickTarget:"wolfTarget", required:true,  godScript:"狼人請睜眼，你們要刀誰？", publicScript:"狼人請睜眼。"},
      {key:"seer", type:"seer", pickTarget:"seerCheckTarget", required:false, godScript:"預言家請睜眼，你要驗誰？", publicScript:"預言家請睜眼。"},
      {key:"witch",type:"witch", godScript:"女巫請睜眼，是否用藥？", publicScript:"女巫請睜眼。"},
      {key:"dawn", type:"resolve", godScript:"天亮請睜眼（按下一步結算）。", publicScript:"天亮請睜眼。"}
    ];
    State.nightStepIndex=0;
    saveState(State);
  }

  function currentStep(){
    return State.nightSteps[State.nightStepIndex] || null;
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
      stopTouchSelect(b);

      b.onclick=()=>{
        if(State.gameOver) return;
        if(!p.alive) return;

        // Witch poison pick mode
        if(State._pickPoisonMode){
          State.night.witchPoisonTarget = p.seat;
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

    if(step.type==="seer" && State.godView){
      const t = getPlayer(State.night.seerCheckTarget);
      if(t) extra += `\n\n（上帝）查驗結果：${t.team==="wolf" ? "狼人" : "好人"}`;
    }

    if(step.type==="witch"){
      if(State.godView){
        if(State.night.witchSaveUsed){
          extra += "\n\n（上帝）解藥已用過：本局不顯示刀口，只能選擇是否使用毒藥。";
        }else{
          extra += `\n\n（上帝）刀口：${State.night.wolfTarget ? (State.night.wolfTarget+" 號") : "—（尚未選狼刀）"}`;
        }
        extra += "\n\n點『下一步』開啟女巫彈窗操作。";
      }else{
        extra += "\n\n（提示）請切換到 🔓 上帝視角 再操作女巫用藥。";
      }
    }

    return (base + extra).trim();
  }

  function renderNightUI(){
    const step=currentStep();
    if(nightTag) nightTag.textContent=`第 ${State.nightNo} 夜`;
    if(nightScript) nightScript.textContent = step ? getScriptForStep(step) : "（夜晚結束）";

    renderSeatDots(nightSeats, (seat)=>{
      const s=currentStep(); if(!s) return;

      if(s.type==="pick" && s.pickTarget){
        // Guard no consecutive
        if(s.pickTarget==="guardTarget" && State.settings?.rules?.noConsecutiveGuard){
          const prev = State.night.prevGuardTarget;
          if(prev && prev===seat){
            alert("規則：守衛不能連守同一人。");
            State.selectedSeat=null;
            return;
          }
        }
        State.night[s.pickTarget]=seat;
      }

      if(s.type==="seer"){
        State.night.seerCheckTarget=seat;
        const t=getPlayer(seat);
        State.night.seerResult = (t?.team==="wolf") ? "wolf" : "villager";
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

  function nightPrev(){
    if(State.gameOver) return;
    State.selectedSeat=null;
    State.nightStepIndex=Math.max(0, State.nightStepIndex-1);
    saveState(State);
    renderNightUI();
  }

  function nightNext(){
    if(State.gameOver) return;
    const step=currentStep(); if(!step) return;

    if(step.type==="pick" && step.required && !State.night[step.pickTarget]){
      navigator.vibrate?.([60,40,60]);
      return;
    }

    if(step.type==="witch"){
      if(!State.godView){ alert("需要 🔓 上帝視角 才能操作女巫"); return; }
      openAnnouncementModal(true,true);
      return;
    }

    if(step.type==="resolve"){
      resolveNightAndGoDay();
      return;
    }

    State.selectedSeat=null;
    State.nightStepIndex=Math.min(State.nightSteps.length-1, State.nightStepIndex+1);
    saveState(State);
    renderNightUI();
  }

  on($("btnNightPrev"),"click",nightPrev);
  on($("btnNightNext"),"click",()=>{ if(!canNextNight()) return; nightNext(); });

  /* =========================================================
     Rules: resolve night (MVP + requested rules)
  ========================================================= */
  function resolveNight(){
    const settings = State.settings?.rules || {};
    const night = State.night;

    const deaths = [];
    const meta = {
      wolfTarget: night.wolfTarget || null,
      guardTargetRaw: night.guardTarget || null,
      guardBlocked: false,
      witchSaved: false,
      witchPoisoned: night.witchPoisonTarget || null,
      poisonList: night.witchPoisonTarget ? [night.witchPoisonTarget] : [],
      deathReasons: {}, // seat -> reason
      deathSource: {}   // seat -> "wolf"|"poison"
    };

    // wolf kill logic
    if(night.wolfTarget){
      const wolfTarget = night.wolfTarget;
      const guardTarget = night.guardTarget;

      let wolfBlocked = false;

      // guard blocks wolf if same target
      if(guardTarget && guardTarget === wolfTarget){
        wolfBlocked = true;
        meta.guardBlocked = true;
      }

      // witch save
      let canSave = night.witchSave && !night.witchSaveUsed;
      if(canSave && settings.witchCannotSelfSave){
        const witchSeat = State.players.find(p=>p.roleId==="witch")?.seat ?? null;
        if(witchSeat && witchSeat === wolfTarget){
          canSave = false; // invalid
        }
      }

      if(!wolfBlocked){
        if(canSave){
          meta.witchSaved = true;
        } else {
          deaths.push(wolfTarget);
          meta.deathReasons[wolfTarget] = "狼刀";
          meta.deathSource[wolfTarget] = "wolf";
        }
      }
    }

    // poison
    if(night.witchPoisonTarget && !night.witchPoisonUsed){
      const t = night.witchPoisonTarget;
      if(!deaths.includes(t)) deaths.push(t);
      meta.deathReasons[t] = meta.deathReasons[t] ? (meta.deathReasons[t] + "+毒") : "女巫毒";
      meta.deathSource[t] = "poison";
    }

    // apply deaths to players
    deaths.forEach(seat=>{
      const p=getPlayer(seat);
      if(p) p.alive=false;
    });

    // lock potion usage after resolve
    if(night.witchSave && !night.witchSaveUsed){
      night.witchSaveUsed = true;
    }
    if(night.witchPoisonTarget && !night.witchPoisonUsed){
      night.witchPoisonUsed = true;
    }

    // update prev guard
    night.prevGuardTarget = night.guardTarget || night.prevGuardTarget || null;

    return { deaths, meta };
  }

  function buildNightAnnouncement(resolved){
    const deaths = resolved.deaths || [];
    const meta = resolved.meta || {};
    let publicText = `天亮了。`;
    if(deaths.length===0){
      publicText += `\n昨晚是平安夜。`;
    }else{
      publicText += `\n昨晚死亡的是：${deaths.join("、")} 號。`;
    }
    publicText += `\n\n（白天流程）上警 → 發言 → 投票`;

    let hiddenText = `（上帝）第${State.nightNo}夜結算：`;
    hiddenText += `\n- 狼刀：${meta.wolfTarget??"—"}`;
    hiddenText += `\n- 守衛：${meta.guardTargetRaw??"—"}`;
    hiddenText += `\n- 守到刀口：${meta.guardBlocked ? "是" : "否"}`;
    hiddenText += `\n- 女巫救：${meta.witchSaved ? "有" : "無"}`;
    hiddenText += `\n- 女巫毒：${meta.witchPoisoned ?? "無"}`;
    hiddenText += `\n- 死亡原因：${Object.keys(meta.deathReasons||{}).length ? JSON.stringify(meta.deathReasons) : "—"}`;

    return { publicText, hiddenText };
  }

  function canTriggerDeathSkill(roleId, seat, resolved){
    const settings = State.settings?.rules || {};
    const meta = resolved?.meta || {};
    const source = meta.deathSource?.[seat] || null;

    if(source === "poison"){
      if(roleId==="hunter" && settings.hunterPoisonNoShoot) return false;
      if(roleId==="blackWolfKing" && settings.blackWolfKingPoisonNoSkill) return false;
    }
    return true;
  }

  /* =========================================================
     Night -> Day transition
  ========================================================= */
  function buildSkillQueueFromResolved(resolved){
    State.skillQueue = [];
    (resolved.deaths||[]).forEach(seat=>{
      const p=getPlayer(seat);
      if(!p) return;
      if(p.roleId==="hunter") State.skillQueue.push({ roleId:"hunter", seat, kind:"shoot" });
      if(p.roleId==="blackWolfKing") State.skillQueue.push({ roleId:"blackWolfKing", seat, kind:"explode" });
    });
    saveState(State);
  }

  function resolveNightAndGoDay(){
    if(State.gameOver) return;

    const resolved = resolveNight();
    State.lastResolved = resolved;

    const { publicText, hiddenText } = buildNightAnnouncement(resolved);
    appendNewLog({
      publicText,
      hiddenText,
      votes: null,
      actions: { night: deepClone(State.night), resolved: deepClone(resolved) }
    });

    saveState(State);

    // check win after night deaths
    if(checkWin()) return;

    // Day start
    showScreen("day");
    $("dayTag") && ($("dayTag").textContent = `第 ${State.dayNo} 天`);
    saveState(State);

    // 반드시彈公告（你要的）
    openAnnouncementModal(false,true);
    renderLogList();

    // queue death skills
    buildSkillQueueFromResolved(resolved);
    runNextSkillIfAny();
  }

  /* =========================================================
     Day: go next night (btnDayNext)
  ========================================================= */
  function goNextNight(){
    if(State.gameOver) return;

    // day end -> next
    State.nightNo += 1;
    State.dayNo += 1;

    initNightWizard();
    showScreen("night");
    renderNightUI();
    saveState(State);
  }
  on($("btnDayNext"),"click",goNextNight);

  /* =========================================================
     Day: Police (candidates)
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
          <button class="iconbtn" id="closePolice" type="button">✕</button>
        </div>
        <div class="modal-body">
          <div class="hint">點選座位：加入/取消上警（僅存活可選）</div>
          <div class="seats" id="policeSeats"></div>
        </div>
        <div class="modal-actions">
          <button class="btn ghost" id="policeClear" type="button">清空</button>
          <button class="btn primary" id="policeDone" type="button">完成</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    stopTouchSelect($("closePolice"));
    stopTouchSelect($("policeClear"));
    stopTouchSelect($("policeDone"));

    on($("closePolice"),"click",()=> wrap.classList.add("hidden"));
    on($("policeClear"),"click",()=>{
      State.police.candidates=[];
      saveState(State);
      renderPoliceSeats();
    });
    on($("policeDone"),"click",()=>{
      wrap.classList.add("hidden");
      const c = State.police.candidates || [];
      appendToTodayLog({
        publicAppend:`【上警】${c.length? c.join("、")+" 號":"無人上警"}`
      });
      renderLogList();
      openAnnouncementModal(false,true);
    });
  }

  function renderPoliceSeats(){
    const box=$("policeSeats");
    if(!box) return;
    box.innerHTML="";
    const cand = State.police.candidates || [];
    alivePlayers().forEach(p=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="seat";
      b.textContent=String(p.seat);
      if(cand.includes(p.seat)) b.classList.add("selected");
      stopTouchSelect(b);
      b.onclick=()=>{
        if(State.gameOver) return;
        const i = cand.indexOf(p.seat);
        if(i>=0) cand.splice(i,1);
        else cand.push(p.seat);
        cand.sort((a,b)=>a-b);
        State.police.candidates=cand;
        saveState(State);
        renderPoliceSeats();
      };
      box.appendChild(b);
    });
  }

  function openPoliceModal(){
    if(State.gameOver) return;
    ensurePoliceModal();
    renderPoliceSeats();
    $("modalPolice")?.classList.remove("hidden");
  }

  /* =========================================================
     Day: Speech order modal
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
          <button class="iconbtn" id="closeSpeech" type="button">✕</button>
        </div>
        <div class="modal-body">
          <div class="hint">方向：順時針/逆時針/隨機。起始位：點座位選擇。</div>
          <div style="display:flex;gap:10px;margin:10px 0;">
            <button class="btn ghost" id="dirCW" type="button">順時針</button>
            <button class="btn ghost" id="dirCCW" type="button">逆時針</button>
            <button class="btn ghost" id="dirRAND" type="button">隨機</button>
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
          <button class="btn ghost" id="speechBuild" type="button">生成順序</button>
          <button class="btn primary" id="speechNext" type="button">下一位</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    ["closeSpeech","dirCW","dirCCW","dirRAND","speechBuild","speechNext"].forEach(id=>stopTouchSelect($(id)));

    on($("closeSpeech"),"click",()=> wrap.classList.add("hidden"));
    on($("dirCW"),"click",()=>{ State.police.direction="cw"; saveState(State); renderSpeechUI(); });
    on($("dirCCW"),"click",()=>{ State.police.direction="ccw"; saveState(State); renderSpeechUI(); });
    on($("dirRAND"),"click",()=>{ State.police.direction="rand"; saveState(State); renderSpeechUI(); });
    on($("speechBuild"),"click",buildSpeechOrder);
    on($("speechNext"),"click",nextSpeaker);
  }

  function speechPoolSeats(){
    const alive = alivePlayers().map(p=>p.seat);
    const cand = (State.police.candidates||[]).filter(s=>alive.includes(s));
    return cand.length ? cand : alive;
  }

  function buildSpeechOrder(){
    if(State.gameOver) return;
    const pool = speechPoolSeats();
    if(!pool.length){ alert("沒有可發言的存活玩家"); return; }

    let order = [];
    const dir = State.police.direction || "cw";

    if(dir==="rand"){
      order = pool.slice();
      for(let i=order.length-1;i>0;i--){
        const j=Math.floor(Math.random()*(i+1));
        [order[i],order[j]]=[order[j],order[i]];
      }
    } else {
      // cw / ccw start seat
      const start = State.police.startSeat ?? pool[0];
      const idx = pool.indexOf(start)>=0 ? pool.indexOf(start) : 0;
      const seq = pool.slice();
      // sort in numeric circle
      seq.sort((a,b)=>a-b);
      const rotated = seq.slice(idx).concat(seq.slice(0,idx));
      order = (dir==="cw") ? rotated : rotated.slice().reverse();
    }

    State.police.order = order;
    State.police.idx = 0;
    State.police.done = order.length===0;
    saveState(State);

    appendToTodayLog({
      publicAppend:`【發言順序】${order.length ? order.join(" → ") : "（未生成）"}`
    });
    renderLogList();
    openAnnouncementModal(false,true);
    renderSpeechUI();
  }

  function currentSpeaker(){
    if(!State.police.order?.length) return null;
    if(State.police.done) return null;
    return State.police.order[State.police.idx] ?? null;
  }

  function nextSpeaker(){
    if(State.gameOver) return;
    if(!State.police.order?.length){ alert("請先生成順序"); return; }
    if(State.police.done){ return; }
    State.police.idx += 1;
    if(State.police.idx >= State.police.order.length){
      State.police.done = true;
    }
    saveState(State);
    renderSpeechUI();
  }

  function renderSpeechSeats(){
    const box=$("speechSeats");
    if(!box) return;
    box.innerHTML="";
    const pool = speechPoolSeats();
    pool.forEach(seat=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="seat";
      b.textContent=String(seat);
      if(State.police.startSeat===seat) b.classList.add("selected");
      stopTouchSelect(b);
      b.onclick=()=>{
        if(State.gameOver) return;
        State.police.startSeat = seat;
        saveState(State);
        renderSpeechUI();
      };
      box.appendChild(b);
    });

    const cur = currentSpeaker();
    if(cur){
      [...box.querySelectorAll(".seat")].forEach(btn=>{
        btn.classList.toggle("highlight", Number(btn.textContent)===cur);
      });
    }
  }

  function renderSpeechUI(){
    if(!$("speechInfo")) return;
    const pool = speechPoolSeats();
    const mode = (State.police.candidates?.length ? `警上（${State.police.candidates.join("、")}）` : "全體存活");
    $("speechInfo").textContent = `模式：${mode}｜方向：${State.police.direction}｜起始：${State.police.startSeat ?? "未選"}`;

    renderSpeechSeats();

    const orderEl=$("speechOrder");
    if(orderEl){
      orderEl.textContent = State.police.order?.length
        ? State.police.order.map((s,i)=>`${i+1}. ${s} 號`).join("\n")
        : "（尚未生成）";
    }

    const nextEl=$("speechNextHint");
    if(nextEl){
      const cur=currentSpeaker();
      nextEl.textContent = State.police.done
        ? "✅ 發言流程結束"
        : (cur ? `👉 下一位發言：${cur} 號` : "👉 請先生成順序");
    }
  }

  function openSpeechModal(){
    if(State.gameOver) return;
    ensureSpeechModal();
    renderSpeechUI();
    $("modalSpeech")?.classList.remove("hidden");
  }

  /* =========================================================
     Day: Vote + Tie handling
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
          <button class="iconbtn" id="closeVote" type="button">✕</button>
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
          <button class="btn ghost" id="voteAbstain" type="button">棄票</button>
          <button class="btn primary" id="voteDone" type="button" disabled>完成投票</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    ["closeVote","voteAbstain","voteDone"].forEach(id=>stopTouchSelect($(id)));

    on($("closeVote"),"click",()=> wrap.classList.add("hidden"));
    on($("voteAbstain"),"click",()=> castVote(null));
    on($("voteDone"),"click",finalizeVote);
  }

  function ensureTieModal(){
    if($("modalTie")) return;
    const wrap=document.createElement("div");
    wrap.id="modalTie";
    wrap.className="modal hidden";
    wrap.innerHTML=`
      <div class="modal-card">
        <div class="modal-head">
          <div class="modal-title">平票處理</div>
          <button class="iconbtn" id="closeTie" type="button">✕</button>
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
          <button class="btn primary" id="tiePK" type="button">PK 投票（只投平票名單）</button>
          <button class="btn ghost" id="tieRevote" type="button">重新投票（全體存活）</button>
          <button class="btn ghost" id="tieNone" type="button">無人出局（本輪不處刑）</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    ["closeTie","tiePK","tieRevote","tieNone"].forEach(id=>stopTouchSelect($(id)));

    on($("closeTie"),"click",()=> wrap.classList.add("hidden"));
    on($("tiePK"),"click",()=> chooseTieOption("pk"));
    on($("tieRevote"),"click",()=> chooseTieOption("revote"));
    on($("tieNone"),"click",()=> chooseTieOption("none"));
  }

  function startVote({mode="normal", restrictTargets=null, label="投票"}){
    if(State.gameOver) return;
    ensureVoteModal();
    State._voteMode = mode;
    State._voteTargets = restrictTargets ? restrictTargets.slice() : null;

    const alive = alivePlayers().map(p=>p.seat);
    const voters = alive.slice();

    State.vote = {
      label,
      voters,
      idx: 0,
      votes: [],       // {fromSeat,toSeat|null}
      done: false
    };
    saveState(State);

    $("voteTitle") && ($("voteTitle").textContent = label);
    renderVoteUI();
    $("modalVote")?.classList.remove("hidden");
  }

  function openVoteModal(){
    startVote({mode:"normal", restrictTargets:null, label:"投票"});
  }

  function currentVoter(){
    if(!State.vote) return null;
    if(State.vote.done) return null;
    return State.vote.voters[State.vote.idx] ?? null;
  }

  function getVoteStats(){
    const stats = {};
    (State.vote?.votes||[]).forEach(v=>{
      if(v.toSeat==null){
        stats.abstain = (stats.abstain||0)+1;
      }else{
        stats[v.toSeat] = (stats[v.toSeat]||0)+1;
      }
    });
    return stats;
  }

  function formatStats(stats){
    const keys = Object.keys(stats||{});
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

  function renderVoteUI(){
    if(!State.vote) return;
    const prompt=$("votePrompt");
    const seats=$("voteSeats");
    const statsEl=$("voteStats");
    const hint=$("voteHint");
    const doneBtn=$("voteDone");

    const cur = currentVoter();
    if(prompt){
      prompt.textContent = State.vote.done
        ? "✅ 投票完成"
        : (cur ? `請 ${cur} 號投票（點選要投的座位）` : "（初始化中）");
    }

    if(seats){
      seats.innerHTML="";
      const alive = alivePlayers().map(p=>p.seat);

      // targets: pk 제한 or all alive
      const targets = State._voteTargets
        ? State._voteTargets.filter(s=>alive.includes(s))
        : alive;

      targets.forEach(seat=>{
        const b=document.createElement("button");
        b.type="button";
        b.className="seat";
        b.textContent=String(seat);
        stopTouchSelect(b);

        // disable self-vote
        const disabled = (cur===seat);
        if(disabled){ b.disabled=true; b.classList.add("disabled"); }

        b.onclick=()=> castVote(seat);
        seats.appendChild(b);
      });
    }

    const stats = getVoteStats();
    if(statsEl) statsEl.textContent = formatStats(stats);

    if(hint){
      hint.textContent = State.vote.done ? "點「完成投票」進入統計與處刑" : "也可以按「棄票」。";
    }
    if(doneBtn) doneBtn.disabled = !State.vote.done;

    saveState(State);
  }

  function castVote(toSeatOrNull){
    if(!State.vote) return;
    const cur = currentVoter();
    if(!cur) return;

    // record
    State.vote.votes.push({ fromSeat: cur, toSeat: toSeatOrNull });

    // advance
    State.vote.idx += 1;
    if(State.vote.idx >= State.vote.voters.length){
      State.vote.done = true;
    }
    saveState(State);
    renderVoteUI();
  }

  function openTieModal(ctx){
    ensureTieModal();
    State.tieContext = ctx;
    saveState(State);

    const label = ctx.mode==="pk" ? "PK 後仍平票" : "首次平票";
    $("tieInfo") && ($("tieInfo").textContent = `【${label}】最高票 ${ctx.maxVotes} 票`);
    $("tieList") && ($("tieList").textContent = ctx.candidates.map(s=>`${s} 號`).join("\n"));

    $("modalTie")?.classList.remove("hidden");
  }

  function chooseTieOption(type){
    $("modalTie")?.classList.add("hidden");
    if(!State.tieContext) return;

    const candidates = State.tieContext.candidates || [];

    if(type==="none"){
      appendToTodayLog({
        publicAppend:`【平票處理】無人出局。`,
        hiddenAppend:`（上帝）平票名單：${candidates.join("、")}｜選擇：無人出局`
      });
      State.tieContext=null;
      saveState(State);
      renderLogList();
      openAnnouncementModal(false,true);
      checkWin();
      return;
    }

    if(type==="revote"){
      appendToTodayLog({
        publicAppend:`【平票處理】重新投票（全體存活）。`,
        hiddenAppend:`（上帝）平票名單：${candidates.join("、")}｜選擇：重新投票`
      });
      State.tieContext=null;
      saveState(State);
      startVote({mode:"normal", restrictTargets:null, label:"重新投票"});
      return;
    }

    if(type==="pk"){
      appendToTodayLog({
        publicAppend:`【平票處理】進入 PK 投票（僅投平票名單）。`,
        hiddenAppend:`（上帝）平票名單：${candidates.join("、")}｜選擇：PK`
      });
      State.tieContext=null;
      saveState(State);
      startVote({mode:"pk", restrictTargets:candidates.slice(), label:"PK 投票"});
      return;
    }
  }

  function killSeat(seat, reason){
    const p=getPlayer(seat);
    if(!p || !p.alive) return false;
    p.alive=false;
    appendToTodayLog({ hiddenAppend:`（死亡）${seat} 號｜原因：${reason}` });
    saveState(State);
    return true;
  }

  function finalizeVote(){
    if(!State.vote || !State.vote.done) return;

    const votes = State.vote.votes.slice();
    const label = State.vote.label || (State._voteMode==="pk" ? "PK投票" : "投票");

    // stats
    const stats = getVoteStats();
    let maxVotes = 0;
    Object.keys(stats).forEach(k=>{
      if(k==="abstain") return;
      maxVotes = Math.max(maxVotes, stats[k]);
    });

    const top = Object.keys(stats)
      .filter(k=>k!=="abstain" && stats[k]===maxVotes)
      .map(k=>Number(k));

    appendToTodayLog({
      hiddenAppend:`【${label}完成】最高票：${maxVotes}｜${top.length>1?"平票":"不平票"}｜模式=${State._voteMode}`,
      votes
    });

    // tie
    if(top.length>1 && maxVotes>0){
      appendToTodayLog({
        publicAppend:`【${label}結果】平票（最高票 ${maxVotes} 票）：${top.join("、")} 號。`,
        hiddenAppend:`（上帝）平票名單：${top.join("、")}`
      });

      $("modalVote")?.classList.add("hidden");

      openTieModal({
        mode: State._voteMode==="pk" ? "pk" : "normal",
        candidates: top,
        maxVotes
      });

      renderLogList();
      openAnnouncementModal(false,true);
      return;
    }

    // no execution (all abstain or maxVotes=0)
    if(maxVotes===0 || top.length===0){
      appendToTodayLog({ publicAppend:`【${label}結果】無人被處刑。` });
      $("modalVote")?.classList.add("hidden");
      renderLogList();
      openAnnouncementModal(false,true);
      checkWin();
      return;
    }

    // execute
    const executed = top[0];
    const changed = killSeat(executed, `${label}處刑`);
    appendToTodayLog({
      publicAppend: changed ? `【處刑】${executed} 號出局。` : `【處刑】${executed} 號已死亡（無變更）。`,
      hiddenAppend: `（處刑）${executed} 號｜來源=${label}`
    });

    $("modalVote")?.classList.add("hidden");
    renderLogList();
    openAnnouncementModal(false,true);

    // push death skills from execution (execution not poison -> allowed)
    const p=getPlayer(executed);
    if(p && (p.roleId==="hunter" || p.roleId==="blackWolfKing")){
      State.skillQueue.push({ roleId:p.roleId, seat:executed, kind: p.roleId==="hunter" ? "shoot" : "explode", from:"execute" });
      saveState(State);
      runNextSkillIfAny();
      return;
    }

    checkWin();
  }

  /* =========================================================
     Skills: Hunter / BlackWolfKing
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
          <button class="iconbtn" id="closeSkill" type="button">✕</button>
        </div>
        <div class="modal-body">
          <div class="hint" id="skillHint"></div>
          <div class="seats" id="skillSeats"></div>
        </div>
        <div class="modal-actions">
          <button class="btn ghost" id="skillSkip" type="button">放棄</button>
          <button class="btn primary" id="skillConfirm" type="button" disabled>確認</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    ["closeSkill","skillSkip","skillConfirm"].forEach(id=>stopTouchSelect($(id)));
    on($("closeSkill"),"click",()=> wrap.classList.add("hidden"));
    on($("skillSkip"),"click",onSkillSkip);
    on($("skillConfirm"),"click",onSkillConfirm);
  }

  let skillTargetSeat=null;

  function openSkillModal(skill){
    ensureSkillModal();
    skillTargetSeat=null;

    const {roleId, seat, kind} = skill;
    const role=roleInfo(roleId);

    $("skillTitle") && ($("skillTitle").textContent = `${role.icon?role.icon+" ":""}${role.name} 技能`);
    $("skillHint") && ($("skillHint").textContent =
      kind==="shoot"
        ? `獵人 ${seat} 號是否開槍？點選要帶走的人（可放棄）。`
        : `黑狼王 ${seat} 號是否帶走一人？點選目標（可放棄）。`
    );

    const seatsBox=$("skillSeats");
    const confirm=$("skillConfirm");
    if(confirm) confirm.disabled=true;

    if(seatsBox){
      seatsBox.innerHTML="";
      State.players.forEach(p=>{
        const b=document.createElement("button");
        b.type="button";
        b.className="seat"+(p.alive?"":" dead");
        b.textContent=String(p.seat);
        stopTouchSelect(b);

        const disabled = (!p.alive) || (p.seat===seat);
        if(disabled){ b.disabled=true; b.classList.add("disabled"); }

        b.onclick=()=>{
          if(disabled) return;
          skillTargetSeat=p.seat;
          [...seatsBox.querySelectorAll(".seat")].forEach(x=>x.classList.remove("selected"));
          b.classList.add("selected");
          if(confirm) confirm.disabled=false;
        };
        seatsBox.appendChild(b);
      });
    }

    State.activeSkill = skill;
    saveState(State);
    $("modalSkill")?.classList.remove("hidden");
  }

  function runNextSkillIfAny(){
    if(!State.skillQueue.length){
      saveState(State);
      return;
    }
    const next = State.skillQueue.shift();
    saveState(State);

    if(!next) return;

    // need god view
    if(!State.godView){
      alert("需要 🔓 上帝視角 才能處理死亡技能");
      State.skillQueue.unshift(next);
      saveState(State);
      return;
    }

    // if death from poison (night), apply restriction
    if(next.from!=="execute" && State.lastResolved){
      const ok = canTriggerDeathSkill(next.roleId, next.seat, State.lastResolved);
      if(!ok){
        appendToTodayLog({
          hiddenAppend: next.roleId==="hunter"
            ? `（技能）獵人 ${next.seat} 號：因「被毒」→ 禁止開槍。`
            : `（技能）黑狼王 ${next.seat} 號：因「被毒」→ 禁止使用技能。`
        });
        renderLogList();
        openAnnouncementModal(false,true);
        runNextSkillIfAny();
        return;
      }
    }

    openSkillModal(next);
  }

  function onSkillSkip(){
    const s=State.activeSkill;
    if(!s){ $("modalSkill")?.classList.add("hidden"); return; }
    appendToTodayLog({
      publicAppend: s.kind==="shoot" ? `⚡ 獵人 ${s.seat} 號 放棄開槍。` : `💥 黑狼王 ${s.seat} 號 放棄帶人。`,
      hiddenAppend: s.kind==="shoot"
        ? `（技能）獵人 ${s.seat} 放棄`
        : `（技能）黑狼王 ${s.seat} 放棄`
    });
    $("modalSkill")?.classList.add("hidden");
    State.activeSkill=null;
    saveState(State);
    renderLogList();
    openAnnouncementModal(false,true);
    checkWin();
    runNextSkillIfAny();
  }

  function onSkillConfirm(){
    const s=State.activeSkill;
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
        ? `（技能）獵人 ${s.seat} → ${target}`
        : `（技能）黑狼王 ${s.seat} → ${target}`
    });

    $("modalSkill")?.classList.add("hidden");
    State.activeSkill=null;
    saveState(State);
    renderLogList();
    openAnnouncementModal(false,true);

    // if target also has death skill, push it (execution-style now)
    const p=getPlayer(target);
    if(p && (p.roleId==="hunter" || p.roleId==="blackWolfKing")){
      State.skillQueue.push({ roleId:p.roleId, seat:target, kind: p.roleId==="hunter" ? "shoot" : "explode", from:"execute" });
      saveState(State);
    }

    checkWin();
    runNextSkillIfAny();
  }

  /* =========================================================
     Bind day buttons
  ========================================================= */
  on($("btnPolice"),"click",openPoliceModal);
  on($("btnTalkOrder"),"click",openSpeechModal);
  on($("btnVote"),"click",openVoteModal);

  /* =========================================================
     Announcement/Log quick
  ========================================================= */
  on($("btnMenu"),"click",()=> openAnnouncementModal(false,true));

  /* =========================================================
     Boot
  ========================================================= */
  function boot(){
    ensureRestartBtn();
    setGodView(!!State.godView);

    // restore screen
    if(State.phase && Screens[State.phase]) showScreen(State.phase);
    else showScreen("setup");

    // update deal prompt
    if(State.phase==="deal") updateDealPrompt();

    // night render
    if(State.phase==="night"){
      if(!State.nightSteps || !State.nightSteps.length) initNightWizard();
      renderNightUI();
    }

    // day tag
    if(State.phase==="day"){
      $("dayTag") && ($("dayTag").textContent = `第 ${State.dayNo} 天`);
      // if skill queue pending
      if(State.skillQueue?.length) runNextSkillIfAny();
    }

    // Setup
    syncSetupUI();
    renderLogList();

    // Always keep announcement openable
    if(State.gameOver){
      openAnnouncementModal(false,true);
    }
  }

  boot();
})();