/* =========================================================
   狼人殺｜上帝輔助 PWA（資料分檔正式接上版）
   - 讀取 /data 角色/板子/夜晚步驟/規則
   - 規則已包含：
     ✓ 守衛不能連守
     ✓ 女巫不能自救
     ✓ 獵人被毒不能開槍
     ✓ 黑狼王被毒不能技能（blackWolfKing）
========================================================= */

(() => {
  /* -------------------------
     DOM helpers
  ------------------------- */
  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const nowISO = () => new Date().toISOString();

  /* -------------------------
     Data access (with fallback)
  ------------------------- */
  const DATA = (window.WW_DATA || {});
  const roles = DATA.roles || DATA.rolesBase || {};
  const boards = DATA.boards || {};
  const buildNightSteps = DATA.nightStepsBasic || null;
  const rules = DATA.rulesMini || null;

  // fallback roles (避免 /data 未載入時報錯)
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

  /* -------------------------
     Storage
  ------------------------- */
  const STORAGE_KEY = "wolf_god_assist_v2_modular";
  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return null;
      return JSON.parse(raw);
    }catch(e){ return null; }
  }
  function saveState(state){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){}
  }
  function clearState(){
    try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
  }

  /* -------------------------
     Defaults
  ------------------------- */
  function suggestBasicConfigByCount(n){
    const b = boards?.basic;
    if(b?.presets?.[n]) return structuredClone(b.presets[n]);
    if(typeof b?.fallback === "function") return b.fallback(n);

    // 最後 fallback（保底）
    const wolves = n >= 9 ? 2 : 1;
    const guard = n >= 11 ? 1 : 0;
    const fixed = 1+1+1+guard;
    const villager = Math.max(0, n - wolves - fixed);
    return { werewolf:wolves, villager, seer:1, witch:1, hunter:1, guard };
  }

  /* -------------------------
     App State
  ------------------------- */
  const State = {
    godUnlocked: false,
    godView: false,
    pin: "0000",

    boardType: "basic", // basic | special
    playerCount: 9,
    rolesCount: suggestBasicConfigByCount(9),

    // rules settings（給 rules.mini.js 用）
    settings: {
      rules: {
        noConsecutiveGuard: true,
        witchCannotSelfSave: true,
        hunterPoisonNoShoot: true,
        blackWolfKingPoisonNoSkill: true
      }
    },

    phase: "setup", // setup | deal | night | day
    players: [],
    dealIndex: 0,

    nightNo: 1,
    dayNo: 1,

    night: {
      // actions
      guardTarget: null,
      wolfTarget: null,
      seerCheckTarget: null,
      seerResult: null,

      witchSaveUsed: false,
      witchPoisonUsed: false,
      witchSave: false,
      witchPoisonTarget: null,

      // ✅ for rules：守衛不能連守
      prevGuardTarget: null
    },

    // wizard
    nightSteps: [],
    nightStepIndex: 0,
    selectedSeat: null,

    // last resolved meta (for skill checks)
    lastResolved: null,

    // logs
    logs: []
  };

  // restore
  const saved = loadState();
  if(saved && saved.players && Array.isArray(saved.players) && saved.players.length){
    Object.assign(State, saved);

    // 補缺省
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
    const el = Screens[name];
    if(el) el.classList.add("active");
    State.phase = name;
    saveState(State);
  }

  /* =========================================================
     God view toggle (everywhere)
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
    State.rolesCount = (State.boardType==="basic")
      ? suggestBasicConfigByCount(State.playerCount)
      : (State.rolesCount || {});
    syncSetupUI();
  });
  on($("btnMinus"), "click", ()=>{
    State.playerCount = clamp(State.playerCount - 1, 6, 16);
    State.rolesCount = (State.boardType==="basic")
      ? suggestBasicConfigByCount(State.playerCount)
      : (State.rolesCount || {});
    syncSetupUI();
  });
  on(rangeCount, "input", (e)=>{
    State.playerCount = clamp(Number(e.target.value), 6, 16);
    State.rolesCount = (State.boardType==="basic")
      ? suggestBasicConfigByCount(State.playerCount)
      : (State.rolesCount || {});
    syncSetupUI();
  });

  const boardBasic = $("boardBasic");
  const boardSpecial = $("boardSpecial");
  function setBoardType(t){
    State.boardType = t;
    boardBasic?.classList.toggle("active", t==="basic");
    boardSpecial?.classList.toggle("active", t==="special");

    if(t==="basic"){
      State.rolesCount = suggestBasicConfigByCount(State.playerCount);
    }else{
      // special：如果你有 UI 勾選角色，之後會用 boardsSpecial.build()
      // 先保留目前 rolesCount，不強制改
      if(!State.rolesCount || !rolesTotal()) State.rolesCount = suggestBasicConfigByCount(State.playerCount);
    }
    syncSetupUI();
  }
  on(boardBasic, "click", ()=> setBoardType("basic"));
  on(boardSpecial, "click", ()=> setBoardType("special"));

  on($("btnSuggest"), "click", ()=>{
    if(State.boardType==="basic"){
      State.rolesCount = suggestBasicConfigByCount(State.playerCount);
      syncSetupUI();
    }else{
      // 若你之後做特殊板子勾選 UI：這裡改用 boards.special.build()
      const bs = boards?.special;
      if(bs?.build){
        // 暫時：沒勾選角色就給空陣列
        const res = bs.build(State.playerCount, []);
        if(res.ok) State.rolesCount = res.config;
        else alert(res.message || "特殊板子配置失敗");
      }
      syncSetupUI();
    }
  });

  /* =========================================================
     Role Config Modal (沿用，之後會改成依 rolesBase/rolesSpecial 動態生成)
  ========================================================= */
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

    minus.onclick = () => {
      State.rolesCount[roleId] = Math.max(0, (State.rolesCount[roleId]||0) - 1);
      num.textContent = String(State.rolesCount[roleId]);
      syncSetupUI();
    };
    plus.onclick = () => {
      State.rolesCount[roleId] = (State.rolesCount[roleId]||0) + 1;
      num.textContent = String(State.rolesCount[roleId]);
      syncSetupUI();
    };

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

    // 基本角色先列
    ["werewolf","villager","seer","witch","hunter","guard"].forEach(rid=>{
      roleConfigBody.appendChild(roleRow(rid));
    });

    // 若是特殊板子，可加上 special pool（若存在）
    if(State.boardType==="special" && boards?.special?.specialPool){
      const sep = document.createElement("div");
      sep.className = "hint";
      sep.style.marginTop = "10px";
      sep.textContent = "特殊角色（可自行調整數量；之後也可改成勾選模式）";
      roleConfigBody.appendChild(sep);

      boards.special.specialPool.forEach(rid=>{
        if(roles?.[rid]) roleConfigBody.appendChild(roleRow(rid));
      });
    }
  }

  on($("btnOpenRoleConfig"), "click", ()=>{
    renderRoleConfig();
    modalRole?.classList.remove("hidden");
  });
  on($("closeRole"), "click", ()=> modalRole?.classList.add("hidden"));
  on($("roleReset"), "click", ()=>{
    State.rolesCount = suggestBasicConfigByCount(State.playerCount);
    renderRoleConfig();
    syncSetupUI();
  });
  on($("roleApply"), "click", ()=>{
    modalRole?.classList.add("hidden");
    syncSetupUI();
  });

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
    // shuffle
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
    saveState(State);
  }

  function updateDealPrompt(){
    const seat = State.dealIndex + 1;
    if(dealText){
      if(seat <= State.players.length){
        dealText.innerHTML = `請 <b>${seat} 號</b> 拿手機`;
      }else{
        dealText.innerHTML = `所有玩家已抽完身分`;
      }
    }
  }

  // 翻牌（長按 1.2 秒）
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

  on($("btnDealBack"), "click", ()=>{
    hideReveal();
    showScreen("setup");
  });
  on($("btnNextPlayer"), "click", ()=>{
    hideReveal();
    State.dealIndex++;
    updateDealPrompt();
    saveState(State);
  });
  on($("btnFinishDeal"), "click", ()=>{
    hideReveal();
    initNightWizard();
    showScreen("night");
    renderNightUI();
    saveState(State);
  });

  const btnHoldReveal = $("btnHoldReveal");
  if(btnHoldReveal){
    const startHold = () => {
      clearTimeout(holdTimer);
      holdTimer = setTimeout(showReveal, 1200);
    };
    const endHold = () => {
      clearTimeout(holdTimer);
      hideReveal();
    };

    on(btnHoldReveal, "touchstart", startHold, {passive:true});
    on(btnHoldReveal, "touchend", endHold);
    on(btnHoldReveal, "touchcancel", endHold);

    on(btnHoldReveal, "mousedown", startHold);
    on(btnHoldReveal, "mouseup", endHold);
    on(btnHoldReveal, "mouseleave", endHold);
  }

  /* =========================================================
     Night wizard powered by /data/flow/night.steps.basic.js
  ========================================================= */
  const nightTag = $("nightTag");
  const nightScript = $("nightScript");
  const nightSeats = $("nightSeats");

  function resetNightActions(){
    // ✅ 保留 prevGuardTarget / 用藥 used
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

    if(typeof buildNightSteps === "function"){
      State.nightSteps = buildNightSteps(State.players, State.night);
    }else{
      // fallback minimal
      State.nightSteps = [
        { key:"close", type:"info", godScript:"天黑請閉眼。", publicScript:"天黑請閉眼。" },
        { key:"wolf", type:"pick", pickTarget:"wolfTarget", required:true, godScript:"狼人刀誰？", publicScript:"狼人請睜眼。" },
        { key:"dawn", type:"resolve", godScript:"天亮請睜眼。", publicScript:"天亮請睜眼。" }
      ];
    }

    State.nightStepIndex = 0;
  }

  function currentStep(){
    return State.nightSteps[State.nightStepIndex];
  }

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

        // 女巫點毒模式
        if(State._pickPoisonMode){
          State.night.witchPoisonTarget = p.seat;
          State._pickPoisonMode = false;
          saveState(State);
          renderAnnouncementBox();
          renderNightUI();
          return;
        }

        State.selectedSeat = p.seat;
        onPick?.(p.seat);
        renderNightUI();
      };
      container.appendChild(b);
    });
  }

  function getScriptForStep(step){
    // 玩家模式：publicScript；上帝：godScript + afterScript
    const base = State.godView ? (step.godScript || step.publicScript || "") : (step.publicScript || "");
    let extra = "";

    if(State.godView && step.type === "seer" && typeof step.afterScript === "function"){
      extra = step.afterScript({ seerResult: State.night.seerResult }) || "";
    }

    if(step.type === "witch" && State.godView && typeof step.infoForWitch === "function"){
      extra = "\n\n" + step.infoForWitch({ wolfTarget: State.night.wolfTarget });
      // 額外顯示用藥狀態
      extra += `\n\n解藥：${State.night.witchSaveUsed ? "已用過" : "可用"}；毒藥：${State.night.witchPoisonUsed ? "已用過" : "可用"}`;
      if(State.night.witchSave) extra += `\n✅ 已選擇使用解藥。`;
      if(State.night.witchPoisonTarget) extra += `\n☠️ 已選擇毒 ${State.night.witchPoisonTarget} 號。`;
    }

    if(step.key === "witch" && !State.godView){
      extra += "\n\n（提示）請切換到 🔓 上帝視角再操作女巫用藥。";
    }

    return (base + (extra || "")).trim();
  }

  function renderNightUI(){
    if(nightTag) nightTag.textContent = `第 ${State.nightNo} 夜`;
    const step = currentStep();
    if(!step){
      if(nightScript) nightScript.textContent = "（夜晚流程結束）";
      return;
    }

    if(nightScript) nightScript.textContent = getScriptForStep(step);

    renderSeatDots(nightSeats, (seat)=>{
      const s = currentStep();
      if(!s) return;

      // common pick
      if(s.type === "pick" && s.pickTarget){
        // 防呆：allowSelf false
        if(s.ui?.allowSelf === false){
          // 若是狼人步驟，不讓刀自己（假設狼人座位不易判斷，就略過；如需更嚴可加 role checks）
        }
        State.night[s.pickTarget] = seat;
      }

      // seer special
      if(s.type === "seer" && s.pickTarget){
        State.night[s.pickTarget] = seat;
        if(typeof s.apply === "function"){
          const out = s.apply({ players: State.players, seat });
          if(out && typeof out === "object"){
            if(out.seerResult) State.night.seerResult = out.seerResult;
          }
        }else{
          const target = State.players.find(p=>p.seat===seat);
          State.night.seerResult = (target?.team === "wolf") ? "wolf" : "villager";
        }
      }

      saveState(State);
    });

    saveState(State);
  }

  function canNextNight(){
    const step = currentStep();
    if(!step) return false;
    if(step.type === "pick" && step.required && step.pickTarget){
      return !!State.night[step.pickTarget];
    }
    return true;
  }

  function nightPrev(){
    State.selectedSeat = null;
    State.nightStepIndex = Math.max(0, State.nightStepIndex - 1);
    renderNightUI();
  }

  async function nightNext(){
    const step = currentStep();
    if(!step) return;

    if(step.type === "pick" && step.required && step.pickTarget && !State.night[step.pickTarget]){
      if(navigator.vibrate) navigator.vibrate([60,40,60]);
      return;
    }

    // 女巫面板（上帝視角）
    if(step.type === "witch" && State.godView){
      openAnnouncementModal(true);
      return;
    }

    // resolve
    if(step.type === "resolve"){
      resolveNightAndAnnounce();
      return;
    }

    State.selectedSeat = null;
    State.nightStepIndex = Math.min(State.nightSteps.length - 1, State.nightStepIndex + 1);
    renderNightUI();
  }

  on($("btnNightPrev"), "click", nightPrev);
  on($("btnNightNext"), "click", ()=>{
    if(!canNextNight()) return;
    nightNext();
  });

  /* =========================================================
     Announcement Center (modal)
  ========================================================= */
  const modalAnn = $("modalAnn");
  const annBox = $("annBox");
  let annMode = "today"; // today|history
  let annAsWitchPanel = false;

  function getTodayLog(){
    return State.logs[0] || null;
  }

  function renderAnnouncementBox(){
    if(!annBox) return;

    // 女巫面板（借用公告 modal）
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

      // ⚠️ 女巫不能自救提示（當狼刀目標=女巫座位）
      const witchSeat = State.players.find(p=>p.roleId==="witch")?.seat ?? null;
      if(State.settings?.rules?.witchCannotSelfSave && wolf && witchSeat && wolf===witchSeat){
        const warn = document.createElement("div");
        warn.className="hint";
        warn.textContent="⚠️ 規則：女巫不能自救（即使按救，結算會判定無效）";
        annBox.appendChild(warn);
      }

      const area = document.createElement("div");
      area.style.display="flex";
      area.style.flexDirection="column";
      area.style.gap="10px";

      // 解藥
      const row1 = document.createElement("div");
      row1.style.display="flex";
      row1.style.gap="10px";

      const btnSave = document.createElement("button");
      btnSave.className="btn";
      btnSave.type="button";
      btnSave.textContent = State.night.witchSave ? "✅ 已選擇用解藥" : "用解藥救他";
      btnSave.disabled = !canSave;
      btnSave.onclick = ()=>{
        State.night.witchSave = !State.night.witchSave;
        saveState(State);
        renderAnnouncementBox();
        renderNightUI();
      };

      const btnNoSave = document.createElement("button");
      btnNoSave.className="btn ghost";
      btnNoSave.type="button";
      btnNoSave.textContent="不用解藥";
      btnNoSave.onclick=()=>{
        State.night.witchSave=false;
        saveState(State);
        renderAnnouncementBox();
        renderNightUI();
      };

      row1.append(btnSave, btnNoSave);

      // 毒藥
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
      btnNoPoison.onclick=()=>{
        State.night.witchPoisonTarget=null;
        State._pickPoisonMode=false;
        saveState(State);
        renderAnnouncementBox();
        renderNightUI();
      };

      row2.append(btnPickPoison, btnNoPoison);

      // 完成
      const done = document.createElement("button");
      done.className="btn ghost";
      done.type="button";
      done.textContent="完成女巫 → 回夜晚流程";
      done.onclick=()=>{
        State._pickPoisonMode=false;
        annAsWitchPanel=false;
        modalAnn.classList.add("hidden");
        State.selectedSeat=null;
        State.nightStepIndex = Math.min(State.nightSteps.length-1, State.nightStepIndex+1);
        renderNightUI();
        saveState(State);
      };

      area.append(row1, row2, done);
      annBox.appendChild(area);

      const tip = document.createElement("div");
      tip.className="hint";
      tip.style.marginTop="10px";
      tip.textContent="提示：毒藥與解藥將在天亮結算；藥用過會鎖住。";
      annBox.appendChild(tip);

      return;
    }

    // 公告視圖
    const latest = getTodayLog();
    if(annMode==="today"){
      if(!latest){ annBox.textContent="（尚無公告）"; return; }
      annBox.textContent = State.godView
        ? (latest.publicText + "\n\n" + (latest.hiddenText||""))
        : latest.publicText;
      return;
    }

    // history
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

  on($("annToday"), "click", ()=>{
    annMode="today";
    $("annToday")?.classList.add("active");
    $("annHistory")?.classList.remove("active");
    renderAnnouncementBox();
  });
  on($("annHistory"), "click", ()=>{
    annMode="history";
    $("annHistory")?.classList.add("active");
    $("annToday")?.classList.remove("active");
    renderAnnouncementBox();
  });

  on($("btnCopyAnn"), "click", async ()=>{
    try{
      await navigator.clipboard.writeText(annBox?.textContent || "");
      if(navigator.vibrate) navigator.vibrate(40);
      alert("已複製");
    }catch(e){
      alert("複製失敗（可能需要 HTTPS 或 PWA 安裝後）");
    }
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

  function openLogModal(){
    renderLogList();
    modalLog.classList.remove("hidden");
  }

  on($("btnOpenLog"), "click", openLogModal);
  on($("btnOpenLog2"), "click", openLogModal);
  on($("closeLog"), "click", ()=> modalLog.classList.add("hidden"));

  on($("btnClearSave"), "click", ()=>{
    if(confirm("確定清除整局存檔與紀錄？")){
      clearState();
      location.reload();
    }
  });

  /* =========================================================
     Export JSON (using rules.exportPayload if exists)
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
    const includeSecrets = !!State.godView; // 上帝視角匯出含身分
    const payload = (rules?.exportPayload)
      ? rules.exportPayload({ state: State, includeSecrets })
      : { state: State, exportedAt: nowISO() };
    downloadJSON(`狼人殺復盤_${Date.now()}.json`, payload);
  }

  on($("btnExport"), "click", exportReplay);
  on($("btnExport2"), "click", exportReplay);

  /* =========================================================
     Day tool entry (接獵人/黑狼王死亡技能檢查入口)
  ========================================================= */
  on($("btnPolice"), "click", ()=> alert("✅ 下一步我會加入：上警名單 + 發言方向 + 下一位高亮。"));
  on($("btnTalkOrder"), "click", ()=> alert("✅ 下一步我會加入：順/逆/隨機 發言順序 + 一鍵下一位。"));
  on($("btnVote"), "click", ()=> alert("✅ 下一步我會加入：逐位投票（誰投誰）+ 統計 + 處刑 + 死亡技能（含被毒禁用）。"));

  /* =========================================================
     Resolve night via rules.mini.js
  ========================================================= */
  function resolveNightAndAnnounce(){
    if(!rules?.resolveNight || !rules?.buildAnnouncement || !rules?.makeLogItem){
      alert("缺少 rules.mini.js，請確認 /data/flow/rules.mini.js 已正確載入");
      return;
    }

    // 1) resolve
    const resolved = rules.resolveNight({
      players: State.players,
      night: State.night,
      settings: State.settings?.rules || {}
    });

    State.lastResolved = resolved;

    // 2) announcement
    const { publicText, hiddenText } = rules.buildAnnouncement({
      nightNo: State.nightNo,
      dayNo: State.dayNo,
      players: State.players,
      night: State.night,
      resolved,
      settings: State.settings?.rules || {}
    });

    // 3) log
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

    // ✅ 守衛不能連守：保存「本夜實際選擇守誰」為下一夜 prevGuardTarget
    // 這裡用 raw（玩家選的）來判斷連守比較符合主持規則
    State.night.prevGuardTarget = resolved?.meta?.guardTargetRaw ?? State.night.guardTarget ?? State.night.prevGuardTarget;

    // 用藥鎖定
    if(State.night.witchSave) State.night.witchSaveUsed = true;
    if(State.night.witchPoisonTarget) State.night.witchPoisonUsed = true;

    // 下一回合
    State.nightNo += 1;
    State.dayNo += 1;

    // 進白天
    showScreen("day");

    const dayTag = $("dayTag");
    if(dayTag) dayTag.textContent = `第 ${State.dayNo - 1} 天`;

    saveState(State);
    renderLogList();

    // 天亮自動跳公告
    openAnnouncementModal(false, true);

    // 若夜晚死亡包含獵人/黑狼王，可在這裡提示（且遵守被毒禁用）
    maybePromptDeathSkills(resolved);
  }

  function maybePromptDeathSkills(resolved){
    if(!resolved?.deaths?.length) return;
    if(!rules?.canTriggerDeathSkill) return;

    resolved.deaths.forEach(seat=>{
      const p = State.players.find(x=>x.seat===seat);
      if(!p) return;

      // 獵人
      if(p.roleId === "hunter"){
        const ok = rules.canTriggerDeathSkill({
          roleId: "hunter",
          seat,
          resolved,
          settings: State.settings?.rules || {}
        });
        if(!ok){
          // 被毒禁槍：寫入隱藏行動紀錄（復盤）
          State.logs[0].hiddenText += `\n\n（技能）獵人 ${seat} 號：因「被毒」→ 禁止開槍。`;
          saveState(State);
          return;
        }
        // 先做提示（下一步做成真正的開槍彈窗）
        State.logs[0].hiddenText += `\n\n（技能）獵人 ${seat} 號：可開槍（下一步會做成彈窗選擇帶走誰）。`;
        saveState(State);
      }

      // 黑狼王（你指定：被毒不能技能）
      if(p.roleId === "blackWolfKing"){
        const ok = rules.canTriggerDeathSkill({
          roleId: "blackWolfKing",
          seat,
          resolved,
          settings: State.settings?.rules || {}
        });
        if(!ok){
          State.logs[0].hiddenText += `\n\n（技能）黑狼王 ${seat} 號：因「被毒」→ 禁止使用死亡技能。`;
          saveState(State);
          return;
        }
        State.logs[0].hiddenText += `\n\n（技能）黑狼王 ${seat} 號：可使用死亡技能（下一步會做成彈窗帶走誰）。`;
        saveState(State);
      }
    });
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
    for(const [k, c] of map.entries()) lines.push(`${k}：${c} 票`);
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
    }

    syncSetupUI();
    renderLogList();
  }

  boot();

})();
