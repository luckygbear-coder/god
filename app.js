/* =========================================================
   狼人殺｜上帝輔助 PWA（技能彈窗版）
   - 夜晚流程讀 /data/flow/night.steps.basic.js
   - 規則讀 /data/flow/rules.mini.js（含 4 條規則）
   - 天亮後自動處理死亡技能（獵人/黑狼王）：
     ✓ 被毒禁用（獵人/黑狼王）
     ✓ 彈窗選目標或放棄
     ✓ 結果寫入公告中心/歷史/匯出 JSON
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

  const FALLBACK_ROLES = {
    werewolf: { id: "werewolf", name: "狼人", team: "wolf", icon: "🐺" },
    villager:{ id: "villager",name: "村民", team: "villager", icon: "🧑‍🌾" },
    seer:    { id: "seer",    name: "預言家", team: "villager", icon: "🔮" },
    witch:   { id: "witch",   name: "女巫", team: "villager", icon: "🧪" },
    hunter:  { id: "hunter",  name: "獵人", team: "villager", icon: "🔫" },
    guard:   { id: "guard",   name: "守衛", team: "villager", icon: "🛡" }
  };

  function roleInfo(roleId){
    return roles?.[roleId] || FALLBACK_ROLES[roleId] || { id: roleId, name: roleId, team:"villager", icon:"❔" };
  }

  const STORAGE_KEY = "wolf_god_assist_v3_skillmodal";
  function loadState(){
    try{ const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; }catch(e){ return null; }
  }
  function saveState(state){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){} }
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
    godUnlocked: false,
    godView: false,
    pin: "0000",

    boardType: "basic",
    playerCount: 9,
    rolesCount: suggestBasicConfigByCount(9),

    settings: {
      rules: {
        noConsecutiveGuard: true,
        witchCannotSelfSave: true,
        hunterPoisonNoShoot: true,
        blackWolfKingPoisonNoSkill: true
      }
    },

    phase: "setup",
    players: [],
    dealIndex: 0,

    nightNo: 1,
    dayNo: 1,

    night: {
      guardTarget: null,
      wolfTarget: null,
      seerCheckTarget: null,
      seerResult: null,
      witchSaveUsed: false,
      witchPoisonUsed: false,
      witchSave: false,
      witchPoisonTarget: null,
      prevGuardTarget: null
    },

    nightSteps: [],
    nightStepIndex: 0,
    selectedSeat: null,

    lastResolved: null,

    logs: [],

    // ✅ 技能隊列（天亮後依序處理）
    skillQueue: [] // [{ roleId, seat, kind }]
  };

  const saved = loadState();
  if(saved && Array.isArray(saved.players) && saved.players.length){
    Object.assign(State, saved);
    State.settings = State.settings || { rules:{} };
    State.settings.rules = Object.assign({
      noConsecutiveGuard: true,
      witchCannotSelfSave: true,
      hunterPoisonNoShoot: true,
      blackWolfKingPoisonNoSkill: true
    }, State.settings.rules || {});
    State.night = Object.assign({
      guardTarget:null,wolfTarget:null,seerCheckTarget:null,seerResult:null,
      witchSaveUsed:false,witchPoisonUsed:false,witchSave:false,witchPoisonTarget:null,
      prevGuardTarget:null
    }, State.night || {});
    State.logs = State.logs || [];
    State.skillQueue = State.skillQueue || [];
  }

  /* =========================================================
     Screens
  ========================================================= */
  const Screens = {
    setup: $("screen-setup"),
    deal: $("screen-deal"),
    night:$("screen-night"),
    day:  $("screen-day"),
  };
  function showScreen(name){
    Object.values(Screens).forEach(s => s && s.classList.remove("active"));
    Screens[name]?.classList.add("active");
    State.phase = name;
    saveState(State);
  }

  /* =========================================================
     God view toggle
  ========================================================= */
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
    $("pinInput").value = "";
    $("pinWarn").classList.add("hidden");
    $("modalGod").classList.remove("hidden");
    $("pinInput").focus?.();
  }
  function toggleGod(){
    if(State.godView){ setGodView(false); return; }
    if(State.godUnlocked){ setGodView(true); return; }
    openGodModal();
  }
  on(btnGodToggle, "click", toggleGod);
  on(fabGod, "click", toggleGod);

  on($("closeGod"), "click", ()=> $("modalGod").classList.add("hidden"));
  on($("pinCancel"), "click", ()=> $("modalGod").classList.add("hidden"));
  on($("pinOk"), "click", ()=>{
    const v = ($("pinInput").value || "").trim();
    if(v === State.pin){
      State.godUnlocked = true;
      $("modalGod").classList.add("hidden");
      setGodView(true);
    }else{
      $("pinWarn").classList.remove("hidden");
    }
  });

  /* =========================================================
     Setup UI
  ========================================================= */
  const elPlayerCount = $("playerCount");
  const elRoleTotal = $("roleTotal");
  const elPlayerTotal = $("playerTotal");
  const warnRoleTotal = $("warnRoleTotal");
  const rangeCount = $("rangeCount");

  function rolesTotal(){
    return Object.values(State.rolesCount).reduce((a,b)=>a+(b||0),0);
  }
  function syncSetupUI(){
    if(elPlayerCount) elPlayerCount.textContent = String(State.playerCount);
    if(rangeCount) rangeCount.value = String(State.playerCount);

    const rt = rolesTotal();
    if(elRoleTotal) elRoleTotal.textContent = String(rt);
    if(elPlayerTotal) elPlayerTotal.textContent = String(State.playerCount);

    const ok = rt === State.playerCount;
    warnRoleTotal?.classList.toggle("hidden", ok);

    const startBtn = $("btnStart");
    if(startBtn){
      startBtn.disabled = !ok;
      startBtn.textContent = ok ? "開始 → 抽身分" : "⚠️ 角色數需等於玩家數";
    }
    saveState(State);
  }

  on($("btnPlus"), "click", ()=>{
    State.playerCount = clamp(State.playerCount + 1, 6, 16);
    if(State.boardType==="basic") State.rolesCount = suggestBasicConfigByCount(State.playerCount);
    syncSetupUI();
  });
  on($("btnMinus"), "click", ()=>{
    State.playerCount = clamp(State.playerCount - 1, 6, 16);
    if(State.boardType==="basic") State.rolesCount = suggestBasicConfigByCount(State.playerCount);
    syncSetupUI();
  });
  on(rangeCount, "input", (e)=>{
    State.playerCount = clamp(Number(e.target.value), 6, 16);
    if(State.boardType==="basic") State.rolesCount = suggestBasicConfigByCount(State.playerCount);
    syncSetupUI();
  });

  const boardBasic = $("boardBasic");
  const boardSpecial = $("boardSpecial");
  function setBoardType(t){
    State.boardType = t;
    boardBasic?.classList.toggle("active", t==="basic");
    boardSpecial?.classList.toggle("active", t==="special");
    if(t==="basic") State.rolesCount = suggestBasicConfigByCount(State.playerCount);
    syncSetupUI();
  }
  on(boardBasic, "click", ()=> setBoardType("basic"));
  on(boardSpecial, "click", ()=> setBoardType("special"));

  on($("btnSuggest"), "click", ()=>{
    if(State.boardType==="basic"){
      State.rolesCount = suggestBasicConfigByCount(State.playerCount);
      syncSetupUI();
    }else{
      const bs = boards?.special;
      if(bs?.build){
        const res = bs.build(State.playerCount, []);
        if(res.ok) State.rolesCount = res.config;
        else alert(res.message || "特殊板子配置失敗");
      }
      syncSetupUI();
    }
  });

  /* Role config modal（沿用） */
  const modalRole = $("modalRole");
  const roleConfigBody = $("roleConfigBody");
  function roleRow(roleId){
    const info = roleInfo(roleId);
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.justifyContent = "space-between";
    wrap.style.gap = "10px";
    wrap.style.padding = "10px 4px";
    wrap.style.borderBottom = "1px dashed rgba(0,0,0,.08)";

    const left = document.createElement("div");
    left.style.fontWeight = "1000";
    left.textContent = `${info.icon ? info.icon+" " : ""}${info.name}`;

    const right = document.createElement("div");
    right.style.display="flex";
    right.style.alignItems="center";
    right.style.gap="10px";

    const minus = document.createElement("button");
    minus.className = "btn ghost tiny";
    minus.textContent = "－";
    minus.type = "button";

    const num = document.createElement("div");
    num.style.minWidth="36px";
    num.style.textAlign="center";
    num.style.fontWeight="1000";
    num.textContent = String(State.rolesCount[roleId] ?? 0);

    const plus = document.createElement("button");
    plus.className = "btn ghost tiny";
    plus.textContent = "＋";
    plus.type = "button";

    minus.onclick = () => { State.rolesCount[roleId]=Math.max(0,(State.rolesCount[roleId]||0)-1); num.textContent=String(State.rolesCount[roleId]); syncSetupUI(); };
    plus.onclick = () => { State.rolesCount[roleId]=(State.rolesCount[roleId]||0)+1; num.textContent=String(State.rolesCount[roleId]); syncSetupUI(); };

    right.append(minus, num, plus);
    wrap.append(left, right);
    return wrap;
  }
  function renderRoleConfig(){
    if(!roleConfigBody) return;
    roleConfigBody.innerHTML = "";

    const title = document.createElement("div");
    title.className = "hint";
    title.style.marginBottom = "10px";
    title.textContent = "提示：角色總數必須等於玩家人數，才能開始。";
    roleConfigBody.appendChild(title);

    ["werewolf","villager","seer","witch","hunter","guard"].forEach(rid=> roleConfigBody.appendChild(roleRow(rid)));

    if(State.boardType==="special" && boards?.special?.specialPool){
      const sep = document.createElement("div");
      sep.className = "hint";
      sep.style.marginTop = "10px";
      sep.textContent = "特殊角色（目前為手動調整數量；之後可改勾選）";
      roleConfigBody.appendChild(sep);

      boards.special.specialPool.forEach(rid=>{
        if(roles?.[rid]) roleConfigBody.appendChild(roleRow(rid));
      });
    }
  }
  on($("btnOpenRoleConfig"), "click", ()=>{ renderRoleConfig(); modalRole?.classList.remove("hidden"); });
  on($("closeRole"), "click", ()=> modalRole?.classList.add("hidden"));
  on($("roleReset"), "click", ()=>{ State.rolesCount=suggestBasicConfigByCount(State.playerCount); renderRoleConfig(); syncSetupUI(); });
  on($("roleApply"), "click", ()=>{ modalRole?.classList.add("hidden"); syncSetupUI(); });

  /* =========================================================
     Build Players + Deal
  ========================================================= */
  const dealText = $("dealText");
  const modalReveal = $("modalReveal");
  const revealCard = $("revealCard");
  const revealRole = $("revealRole");

  function buildPlayers(){
    const rolesArr = [];
    for(const [rid, cnt] of Object.entries(State.rolesCount)){
      for(let i=0;i<(cnt||0);i++) rolesArr.push(rid);
    }
    for(let i=rolesArr.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [rolesArr[i], rolesArr[j]] = [rolesArr[j], rolesArr[i]];
    }
    State.players = rolesArr.map((rid, idx)=>({
      seat: idx+1,
      roleId: rid,
      team: roleInfo(rid).team || "villager",
      alive: true,
      isChief: false,
      notes: ""
    }));
    State.dealIndex = 0;
    State.skillQueue = [];
    saveState(State);
  }
  function updateDealPrompt(){
    const seat = State.dealIndex + 1;
    if(dealText){
      dealText.innerHTML = seat <= State.players.length
        ? `請 <b>${seat} 號</b> 拿手機`
        : `所有玩家已抽完身分`;
    }
  }

  let holdTimer = null;
  let revealShown = false;
  function showReveal(){
    if(State.dealIndex >= State.players.length) return;
    const p = State.players[State.dealIndex];
    const info = roleInfo(p.roleId);
    revealRole.textContent = `${info.icon ? info.icon+" " : ""}${info.name}`;
    modalReveal.classList.remove("hidden");
    revealCard.classList.add("flipped");
    revealShown = true;
    if(navigator.vibrate) navigator.vibrate(70);
  }
  function hideReveal(){
    if(!revealShown) return;
    revealCard.classList.remove("flipped");
    modalReveal.classList.add("hidden");
    revealShown = false;
  }

  on($("btnStart"), "click", ()=>{
    if(rolesTotal() !== State.playerCount) return;
    buildPlayers();
    showScreen("deal");
    updateDealPrompt();
  });

  on($("btnDealBack"), "click", ()=>{ hideReveal(); showScreen("setup"); });
  on($("btnNextPlayer"), "click", ()=>{ hideReveal(); State.dealIndex++; updateDealPrompt(); saveState(State); });
  on($("btnFinishDeal"), "click", ()=>{
    hideReveal();
    initNightWizard();
    showScreen("night");
    renderNightUI();
    saveState(State);
  });

  const btnHoldReveal = $("btnHoldReveal");
  if(btnHoldReveal){
    const startHold = () => { clearTimeout(holdTimer); holdTimer=setTimeout(showReveal, 1200); };
    const endHold = () => { clearTimeout(holdTimer); hideReveal(); };
    on(btnHoldReveal,"touchstart",startHold,{passive:true});
    on(btnHoldReveal,"touchend",endHold);
    on(btnHoldReveal,"touchcancel",endHold);
    on(btnHoldReveal,"mousedown",startHold);
    on(btnHoldReveal,"mouseup",endHold);
    on(btnHoldReveal,"mouseleave",endHold);
  }

  /* =========================================================
     Night wizard
  ========================================================= */
  const nightTag = $("nightTag");
  const nightScript = $("nightScript");
  const nightSeats = $("nightSeats");

  function resetNightActions(){
    const prevGuardTarget = State.night.prevGuardTarget ?? null;
    const witchSaveUsed = !!State.night.witchSaveUsed;
    const witchPoisonUsed = !!State.night.witchPoisonUsed;

    State.night = {
      guardTarget: null,
      wolfTarget: null,
      seerCheckTarget: null,
      seerResult: null,
      witchSaveUsed,
      witchPoisonUsed,
      witchSave: false,
      witchPoisonTarget: null,
      prevGuardTarget
    };
    State.selectedSeat = null;
  }

  function initNightWizard(){
    resetNightActions();
    State.nightSteps = (typeof buildNightSteps === "function")
      ? buildNightSteps(State.players, State.night)
      : [
          { key:"close", type:"info", godScript:"天黑請閉眼。", publicScript:"天黑請閉眼。" },
          { key:"wolf", type:"pick", pickTarget:"wolfTarget", required:true, godScript:"狼人刀誰？", publicScript:"狼人請睜眼。" },
          { key:"dawn", type:"resolve", godScript:"天亮請睜眼。", publicScript:"天亮請睜眼。" }
        ];
    State.nightStepIndex = 0;
  }

  function currentStep(){ return State.nightSteps[State.nightStepIndex]; }

  function renderSeatDots(container, onPick){
    if(!container) return;
    container.innerHTML = "";
    State.players.forEach(p=>{
      const b = document.createElement("button");
      b.type="button";
      b.className="seat"+(p.alive?"":" dead")+(p.isChief?" chief":"");
      b.textContent=String(p.seat);
      if(State.selectedSeat===p.seat) b.classList.add("selected");
      b.onclick=()=>{
        if(!p.alive) return;

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
    const base = State.godView ? (step.godScript || step.publicScript || "") : (step.publicScript || "");
    let extra = "";

    if(State.godView && step.type==="seer" && typeof step.afterScript==="function"){
      extra = step.afterScript({ seerResult: State.night.seerResult }) || "";
    }

    if(step.type==="witch" && State.godView && typeof step.infoForWitch==="function"){
      extra = "\n\n" + step.infoForWitch({ wolfTarget: State.night.wolfTarget });
      extra += `\n\n解藥：${State.night.witchSaveUsed ? "已用過" : "可用"}；毒藥：${State.night.witchPoisonUsed ? "已用過" : "可用"}`;
      if(State.night.witchSave) extra += `\n✅ 已選擇使用解藥。`;
      if(State.night.witchPoisonTarget) extra += `\n☠️ 已選擇毒 ${State.night.witchPoisonTarget} 號。`;
    }

    if(step.type==="witch" && !State.godView){
      extra += "\n\n（提示）請切換到 🔓 上帝視角再操作女巫用藥。";
    }

    return (base + (extra||"")).trim();
  }

  function renderNightUI(){
    if(nightTag) nightTag.textContent = `第 ${State.nightNo} 夜`;
    const step = currentStep();
    if(!step){ if(nightScript) nightScript.textContent="（夜晚流程結束）"; return; }

    if(nightScript) nightScript.textContent = getScriptForStep(step);

    renderSeatDots(nightSeats, (seat)=>{
      const s = currentStep();
      if(!s) return;

      if(s.type==="pick" && s.pickTarget){
        State.night[s.pickTarget] = seat;
      }
      if(s.type==="seer" && s.pickTarget){
        State.night[s.pickTarget] = seat;
        if(typeof s.apply === "function"){
          const out = s.apply({ players: State.players, seat });
          if(out?.seerResult) State.night.seerResult = out.seerResult;
        }else{
          const t = State.players.find(p=>p.seat===seat);
          State.night.seerResult = (t?.team==="wolf") ? "wolf" : "villager";
        }
      }
      saveState(State);
    });

    saveState(State);
  }

  function canNextNight(){
    const step = currentStep();
    if(!step) return false;
    if(step.type==="pick" && step.required && step.pickTarget) return !!State.night[step.pickTarget];
    return true;
  }

  function nightPrev(){ State.selectedSeat=null; State.nightStepIndex=Math.max(0,State.nightStepIndex-1); renderNightUI(); }

  async function nightNext(){
    const step = currentStep();
    if(!step) return;

    if(step.type==="pick" && step.required && step.pickTarget && !State.night[step.pickTarget]){
      if(navigator.vibrate) navigator.vibrate([60,40,60]);
      return;
    }

    if(step.type==="witch" && State.godView){
      openAnnouncementModal(true);
      return;
    }

    if(step.type==="resolve"){
      resolveNightAndAnnounce();
      return;
    }

    State.selectedSeat=null;
    State.nightStepIndex=Math.min(State.nightSteps.length-1, State.nightStepIndex+1);
    renderNightUI();
  }

  on($("btnNightPrev"), "click", nightPrev);
  on($("btnNightNext"), "click", ()=>{ if(!canNextNight()) return; nightNext(); });

  /* =========================================================
     Announcement modal (also witch panel)
  ========================================================= */
  const modalAnn = $("modalAnn");
  const annBox = $("annBox");
  let annMode = "today";
  let annAsWitchPanel = false;

  function getTodayLog(){ return State.logs[0] || null; }

  function renderAnnouncementBox(){
    if(!annBox) return;

    if(annAsWitchPanel){
      annBox.innerHTML = "";
      const wolf = State.night.wolfTarget;
      const canSave = !State.night.witchSaveUsed && !!wolf;
      const canPoison = !State.night.witchPoisonUsed;

      const title = document.createElement("div");
      title.style.whiteSpace="pre-line";
      title.style.fontWeight="1000";
      title.style.marginBottom="10px";
      title.textContent =
        `【女巫操作】\n今晚被刀：${wolf ? wolf+" 號" : "（尚未選狼刀）"}\n\n解藥：${State.night.witchSaveUsed ? "已用過" : "可用"}\n毒藥：${State.night.witchPoisonUsed ? "已用過" : "可用"}`;
      annBox.appendChild(title);

      const witchSeat = State.players.find(p=>p.roleId==="witch")?.seat ?? null;
      if(State.settings?.rules?.witchCannotSelfSave && wolf && witchSeat && wolf===witchSeat){
        const warn = document.createElement("div");
        warn.className="hint";
        warn.textContent="⚠️ 規則：女巫不能自救（按救也會在結算判定無效）";
        annBox.appendChild(warn);
      }

      const area = document.createElement("div");
      area.style.display="flex";
      area.style.flexDirection="column";
      area.style.gap="10px";

      const row1 = document.createElement("div");
      row1.style.display="flex";
      row1.style.gap="10px";

      const btnSave = document.createElement("button");
      btnSave.className="btn";
      btnSave.type="button";
      btnSave.textContent = State.night.witchSave ? "✅ 已選擇用解藥" : "用解藥救他";
      btnSave.disabled = !canSave;
      btnSave.onclick=()=>{ State.night.witchSave=!State.night.witchSave; saveState(State); renderAnnouncementBox(); renderNightUI(); };

      const btnNoSave = document.createElement("button");
      btnNoSave.className="btn ghost";
      btnNoSave.type="button";
      btnNoSave.textContent="不用解藥";
      btnNoSave.onclick=()=>{ State.night.witchSave=false; saveState(State); renderAnnouncementBox(); renderNightUI(); };

      row1.append(btnSave, btnNoSave);

      const row2 = document.createElement("div");
      row2.style.display="flex";
      row2.style.gap="10px";

      const btnPickPoison = document.createElement("button");
      btnPickPoison.className="btn";
      btnPickPoison.type="button";
      btnPickPoison.textContent = State.night.witchPoisonTarget
        ? `☠️ 已毒 ${State.night.witchPoisonTarget} 號（改選）`
        : "用毒藥（點座位）";
      btnPickPoison.disabled = !canPoison;
      btnPickPoison.onclick=()=>{
        alert("請在下方『座位圓點』點選要毒的玩家（上帝視角）。");
        State._pickPoisonMode=true;
        saveState(State);
      };

      const btnNoPoison = document.createElement("button");
      btnNoPoison.className="btn ghost";
      btnNoPoison.type="button";
      btnNoPoison.textContent="不用毒藥";
      btnNoPoison.onclick=()=>{ State.night.witchPoisonTarget=null; State._pickPoisonMode=false; saveState(State); renderAnnouncementBox(); renderNightUI(); };

      row2.append(btnPickPoison, btnNoPoison);

      const done = document.createElement("button");
      done.className="btn ghost";
      done.type="button";
      done.textContent="完成女巫 → 回夜晚流程";
      done.onclick=()=>{
        State._pickPoisonMode=false;
        annAsWitchPanel=false;
        modalAnn.classList.add("hidden");
        State.selectedSeat=null;
        State.nightStepIndex=Math.min(State.nightSteps.length-1, State.nightStepIndex+1);
        renderNightUI();
        saveState(State);
      };

      area.append(row1, row2, done);
      annBox.appendChild(area);
      return;
    }

    const latest = getTodayLog();

    if(annMode==="today"){
      if(!latest){ annBox.textContent="（尚無公告）"; return; }
      annBox.textContent = State.godView
        ? (latest.publicText + "\n\n" + (latest.hiddenText||""))
        : latest.publicText;
      return;
    }

    if(!State.logs.length){ annBox.textContent="（尚無歷史公告）"; return; }
    const lines = [];
    State.logs.forEach((l, idx)=>{
      lines.push(`#${State.logs.length-idx}｜第${l.nightNo}夜 / 第${l.dayNo}天`);
      lines.push(l.publicText || "—");
      if(State.godView && l.hiddenText) lines.push(l.hiddenText);
      if(State.godView && l.votes){ lines.push("【票型】"); lines.push(formatVotes(l.votes)); }
      lines.push("—");
    });
    annBox.textContent = lines.join("\n");
  }

  function openAnnouncementModal(asWitch=false, forceToday=false){
    annAsWitchPanel = !!asWitch;
    if(forceToday) annMode="today";
    modalAnn.classList.remove("hidden");
    $("annToday")?.classList.toggle("active", annMode==="today");
    $("annHistory")?.classList.toggle("active", annMode==="history");
    renderAnnouncementBox();
  }

  on($("fabAnn"), "click", ()=> openAnnouncementModal(false, true));
  on($("btnOpenAnnouncement"), "click", ()=> openAnnouncementModal(false, true));
  on($("btnOpenAnnouncement2"), "click", ()=> openAnnouncementModal(false, true));

  on($("closeAnn"), "click", ()=>{
    annAsWitchPanel=false;
    State._pickPoisonMode=false;
    modalAnn.classList.add("hidden");
  });

  on($("annToday"), "click", ()=>{ annMode="today"; $("annToday")?.classList.add("active"); $("annHistory")?.classList.remove("active"); renderAnnouncementBox(); });
  on($("annHistory"), "click", ()=>{ annMode="history"; $("annHistory")?.classList.add("active"); $("annToday")?.classList.remove("active"); renderAnnouncementBox(); });

  on($("btnCopyAnn"), "click", async ()=>{
    try{ await navigator.clipboard.writeText(annBox?.textContent || ""); alert("已複製"); }catch(e){ alert("複製失敗（可能需要 HTTPS 或 PWA 安裝後）"); }
  });

  /* =========================================================
     Log modal
  ========================================================= */
  const modalLog = $("modalLog");
  const logList = $("logList");

  function renderLogList(){
    if(!logList) return;
    logList.innerHTML = "";
    if(!State.logs.length){ logList.textContent="—"; return; }

    State.logs.forEach(l=>{
      const item = document.createElement("div");
      item.className="logitem";

      const title = document.createElement("div");
      title.className="logtitle";
      title.textContent = `第${l.nightNo}夜 / 第${l.dayNo}天｜${new Date(l.ts).toLocaleString()}`;

      const text = document.createElement("div");
      text.className="logtext";
      text.textContent = State.godView ? (l.publicText + "\n\n" + (l.hiddenText||"")) : l.publicText;

      item.append(title, text);
      logList.appendChild(item);
    });
  }
  function openLogModal(){ renderLogList(); modalLog.classList.remove("hidden"); }
  on($("btnOpenLog"), "click", openLogModal);
  on($("btnOpenLog2"), "click", openLogModal);
  on($("closeLog"), "click", ()=> modalLog.classList.add("hidden"));

  on($("btnClearSave"), "click", ()=>{
    if(confirm("確定清除整局存檔與紀錄？")){
      clearState(); location.reload();
    }
  });

  /* =========================================================
     Export JSON
  ========================================================= */
  function downloadJSON(filename, obj){
    const blob = new Blob([JSON.stringify(obj, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 500);
  }
  function exportReplay(){
    const includeSecrets = !!State.godView;
    const payload = (rules?.exportPayload)
      ? rules.exportPayload({ state: State, includeSecrets })
      : { state: State, exportedAt: nowISO() };
    downloadJSON(`狼人殺復盤_${Date.now()}.json`, payload);
  }
  on($("btnExport"), "click", exportReplay);
  on($("btnExport2"), "click", exportReplay);

  /* =========================================================
     Day tool entry placeholders
  ========================================================= */
  on($("btnPolice"), "click", ()=> alert("✅ 下一步我會加入：上警名單 + 發言方向 + 下一位高亮。"));
  on($("btnTalkOrder"), "click", ()=> alert("✅ 下一步我會加入：順/逆/隨機 發言順序 + 一鍵下一位。"));
  on($("btnVote"), "click", ()=> alert("✅ 下一步我會加入：逐位投票（誰投誰）+ 統計 + 處刑 + 寫入公告/復盤。"));

  /* =========================================================
     Night resolve + push skill queue + run skill modal
  ========================================================= */
  function resolveNightAndAnnounce(){
    if(!rules?.resolveNight || !rules?.buildAnnouncement || !rules?.makeLogItem){
      alert("缺少 rules.mini.js，請確認 /data/flow/rules.mini.js 已正確載入");
      return;
    }

    const resolved = rules.resolveNight({
      players: State.players,
      night: State.night,
      settings: State.settings?.rules || {}
    });
    State.lastResolved = resolved;

    const { publicText, hiddenText } = rules.buildAnnouncement({
      nightNo: State.nightNo,
      dayNo: State.dayNo,
      players: State.players,
      night: State.night,
      resolved,
      settings: State.settings?.rules || {}
    });

    const logItem = rules.makeLogItem({
      ts: nowISO(),
      nightNo: State.nightNo,
      dayNo: State.dayNo,
      publicText,
      hiddenText,
      votes: null,
      actions: null,
      resolvedMeta: resolved?.meta || null
    });
    State.logs.unshift(logItem);

    // ✅ 守衛不能連守：保存本夜玩家選的守誰（raw）
    State.night.prevGuardTarget = resolved?.meta?.guardTargetRaw ?? State.night.guardTarget ?? State.night.prevGuardTarget;

    // 用藥鎖定
    if(State.night.witchSave) State.night.witchSaveUsed = true;
    if(State.night.witchPoisonTarget) State.night.witchPoisonUsed = true;

    // next round
    State.nightNo += 1;
    State.dayNo += 1;

    // go day
    showScreen("day");
    const dayTag = $("dayTag");
    if(dayTag) dayTag.textContent = `第 ${State.dayNo - 1} 天`;

    saveState(State);
    renderLogList();

    // 天亮公告跳窗
    openAnnouncementModal(false, true);

    // ✅ 建立技能隊列（獵人/黑狼王），然後執行彈窗
    buildSkillQueueFromResolved(resolved);
    runNextSkillIfAny();
  }

  function buildSkillQueueFromResolved(resolved){
    State.skillQueue = [];
    if(!resolved?.deaths?.length) return;

    resolved.deaths.forEach(seat=>{
      const p = State.players.find(x=>x.seat===seat);
      if(!p) return;

      if(p.roleId === "hunter"){
        State.skillQueue.push({ roleId:"hunter", seat, kind:"shoot" });
      }
      if(p.roleId === "blackWolfKing"){
        State.skillQueue.push({ roleId:"blackWolfKing", seat, kind:"explode" });
      }
    });

    saveState(State);
  }

  /* =========================================================
     Skill Modal (獵人開槍 / 黑狼王帶走)
     - 會遵守 rules.canTriggerDeathSkill（被毒禁用）
  ========================================================= */
  const modalSkill = $("modalSkill");         // 你若沒有這個 modal，我會自動建立
  let skillTargetSeat = null;

  function ensureSkillModal(){
    if($("modalSkill")) return;

    // 動態建立一個 modal（不要求你改 HTML）
    const wrap = document.createElement("div");
    wrap.id = "modalSkill";
    wrap.className = "modal hidden";
    wrap.innerHTML = `
      <div class="modal-card">
        <div class="modal-head">
          <div class="modal-title" id="skillTitle">技能</div>
          <button class="iconbtn" id="closeSkill">✕</button>
        </div>
        <div class="modal-tabs">
          <button class="tab active" id="skillTab">技能</button>
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

    on($("closeSkill"), "click", ()=> wrap.classList.add("hidden"));
    on($("skillSkip"), "click", ()=> onSkillSkip());
    on($("skillConfirm"), "click", ()=> onSkillConfirm());
  }

  function openSkillModal({ roleId, seat, kind }){
    ensureSkillModal();
    skillTargetSeat = null;

    const title = $("skillTitle");
    const hint = $("skillHint");
    const seatsBox = $("skillSeats");
    const confirm = $("skillConfirm");

    const role = roleInfo(roleId);
    title.textContent = `${role.icon ? role.icon+" " : ""}${role.name} 技能`;

    if(kind === "shoot"){
      hint.textContent = `獵人 ${seat} 號是否開槍？請點選要帶走的玩家（可放棄）。`;
    }else{
      hint.textContent = `黑狼王 ${seat} 號是否帶走一人？請點選目標（可放棄）。`;
    }

    confirm.disabled = true;

    // render seats
    seatsBox.innerHTML = "";
    State.players.forEach(p=>{
      const b = document.createElement("button");
      b.type="button";
      b.className="seat"+(p.alive?"":" dead");
      b.textContent = String(p.seat);

      // 不能選自己、不能選已死
      const disabled = (!p.alive) || (p.seat === seat);
      if(disabled) b.classList.add("disabled");
      b.disabled = disabled;

      b.onclick = ()=>{
        if(disabled) return;
        skillTargetSeat = p.seat;
        // refresh selected
        [...seatsBox.querySelectorAll(".seat")].forEach(x=>x.classList.remove("selected"));
        b.classList.add("selected");
        confirm.disabled = false;
      };

      seatsBox.appendChild(b);
    });

    $("modalSkill").classList.remove("hidden");

    // 保存目前技能 context
    State._activeSkill = { roleId, seat, kind };
    saveState(State);
  }

  function appendToTodayLog({ publicAppend="", hiddenAppend="" }){
    const log = State.logs[0];
    if(!log) return;

    if(publicAppend){
      log.publicText = (log.publicText || "").trim() + "\n" + publicAppend;
    }
    if(hiddenAppend){
      log.hiddenText = (log.hiddenText || "").trim() + "\n" + hiddenAppend;
    }
    saveState(State);
  }

  function killSeat(seat, reason){
    const p = State.players.find(x=>x.seat===seat);
    if(!p || !p.alive) return false;
    p.alive = false;

    // 同步寫進隱藏公告（復盤原因）
    appendToTodayLog({
      hiddenAppend: `（技能結算）${seat} 號死亡｜原因：${reason}`
    });
    return true;
  }

  function onSkillSkip(){
    const s = State._activeSkill;
    if(!s){ $("modalSkill")?.classList.add("hidden"); return; }

    const who = `${s.seat} 號`;
    if(s.kind==="shoot"){
      appendToTodayLog({
        hiddenAppend: `（技能）獵人 ${who} 放棄開槍。`
      });
    }else{
      appendToTodayLog({
        hiddenAppend: `（技能）黑狼王 ${who} 放棄帶人。`
      });
    }

    $("modalSkill").classList.add("hidden");
    State._activeSkill = null;
    saveState(State);

    // 下一個技能
    runNextSkillIfAny();
  }

  function onSkillConfirm(){
    const s = State._activeSkill;
    if(!s){ $("modalSkill")?.classList.add("hidden"); return; }
    if(!skillTargetSeat){ return; }

    const target = skillTargetSeat;
    const who = `${s.seat} 號`;

    if(s.kind==="shoot"){
      const changed = killSeat(target, `獵人 ${who} 開槍帶走`);
      appendToTodayLog({
        publicAppend: changed ? `⚡ 獵人 ${who} 開槍帶走：${target} 號。` : `⚡ 獵人 ${who} 嘗試開槍，但目標已死亡。`,
        hiddenAppend: `（技能）獵人 ${who} 開槍 → ${target} 號`
      });
    }else{
      const changed = killSeat(target, `黑狼王 ${who} 死亡技能帶走`);
      appendToTodayLog({
        publicAppend: changed ? `💥 黑狼王 ${who} 帶走：${target} 號。` : `💥 黑狼王 ${who} 嘗試帶走，但目標已死亡。`,
        hiddenAppend: `（技能）黑狼王 ${who} 帶走 → ${target} 號`
      });
    }

    $("modalSkill").classList.add("hidden");
    State._activeSkill = null;
    saveState(State);

    // 下一個技能
    runNextSkillIfAny();
  }

  function runNextSkillIfAny(){
    if(!State.skillQueue.length){
      saveState(State);
      renderLogList();
      return;
    }

    // 一次處理一個
    const next = State.skillQueue.shift();
    saveState(State);

    if(!next) return;

    // ✅ 規則：被毒禁用（獵人/黑狼王）
    if(rules?.canTriggerDeathSkill && State.lastResolved){
      const ok = rules.canTriggerDeathSkill({
        roleId: next.roleId,
        seat: next.seat,
        resolved: State.lastResolved,
        settings: State.settings?.rules || {}
      });
      if(!ok){
        if(next.roleId==="hunter"){
          appendToTodayLog({ hiddenAppend: `（技能）獵人 ${next.seat} 號：因「被毒」→ 禁止開槍。` });
        }else{
          appendToTodayLog({ hiddenAppend: `（技能）黑狼王 ${next.seat} 號：因「被毒」→ 禁止使用死亡技能。` });
        }
        // 直接處理下一個
        runNextSkillIfAny();
        return;
      }
    }

    // ✅ 需要上帝視角才能操作技能（避免玩家看到）
    if(!State.godView){
      alert("需要 🔓 上帝視角 才能處理死亡技能，請先解鎖。");
      // 把技能塞回去隊列最前
      State.skillQueue.unshift(next);
      saveState(State);
      return;
    }

    openSkillModal(next);
  }

  /* =========================================================
     Votes formatting placeholder
  ========================================================= */
  function formatVotes(votes){
    const map = new Map();
    votes.forEach(v=>{
      const key = v.toSeat ? `${v.toSeat}號` : "棄票";
      map.set(key, (map.get(key)||0) + 1);
    });
    const lines = [];
    for(const [k,c] of map.entries()) lines.push(`${k}：${c} 票`);
    lines.push("");
    votes.forEach(v=> lines.push(`${v.fromSeat}號 → ${v.toSeat ? (v.toSeat+"號") : "棄票"}`));
    return lines.join("\n");
  }

  on($("btnMenu"), "click", ()=> openAnnouncementModal(false, true));

  /* =========================================================
     Boot
  ========================================================= */
  function boot(){
    setGodView(!!State.godView);

    if(State.phase && Screens[State.phase]) showScreen(State.phase);
    else showScreen("setup");

    if(State.phase === "deal") updateDealPrompt();

    if(State.phase === "night"){
      if(!State.nightSteps || !State.nightSteps.length) initNightWizard();
      renderNightUI();
    }

    if(State.phase === "day"){
      const dayTag = $("dayTag");
      if(dayTag) dayTag.textContent = `第 ${State.dayNo} 天`;
      // 若中途重整，技能隊列仍在，回到白天可繼續處理
      if(State.skillQueue?.length) runNextSkillIfAny();
    }

    syncSetupUI();
    renderLogList();
  }

  boot();

})();
