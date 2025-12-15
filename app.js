/* =========================================================
   app.js  (NEW CONTROLLER)
   - wires: WW_APP.State + WW_APP.Render + WW_APP.UI
   - phases: setup -> deal -> night -> day -> night...
   - core requirements:
     * no consecutive guard (default ON)
     * wolves can skip kill (default ON)
     * witch cannot self-save (default ON)
     * guard+save => "奶穿" (no peaceful night)
     * hunter poisoned cannot shoot
     * blackWolfKing poisoned cannot skill
     * tie: 2nd tie => no exile (handled in rules.core if provided)
========================================================= */

(function(){
  const A = window.WW_APP || (window.WW_APP={});
  const S = A.State;
  const R = A.Render;
  const UI = A.UI;
  const W = window.WW_DATA || {};

  const $ = (id)=>document.getElementById(id);
  const on = (el, ev, fn, opt)=> el && el.addEventListener(ev, fn, opt);

  if(!S || !R || !UI){
    console.error("[app.js] Missing modules: app.state.js / app.render.js / app.ui.bindings.js");
    return;
  }

  /* =========================
     Utils
  ========================= */
  function nowISO(){ return new Date().toISOString(); }
  function clone(x){ return JSON.parse(JSON.stringify(x)); }

  function getRoles(){
    return W.rolesAll || W.roles || {};
  }

  function roleInfo(id){
    const roles=getRoles();
    return roles[id] || { id, name:id, team:"villager", icon:"❔" };
  }

  function aliveSeats(state){
    return state.players.filter(p=>p.alive).map(p=>p.seat);
  }

  function getPlayer(state, seat){
    return state.players.find(p=>p.seat===seat) || null;
  }

  /* =========================
     Ensure defaults
  ========================= */
  function ensureDefaults(state){
    state.settings = state.settings || {};
    state.settings.rules = Object.assign({
      noConsecutiveGuard: true,
      wolvesCanSkip: true,
      witchCannotSelfSave: true,
      hunterPoisonNoShoot: true,
      blackWolfKingPoisonNoSkill: true,
      milkPierce: true,            // 救同守則奶穿：true=奶穿(沒有平安夜)
      tieSecondNoExile: true        // 平票第二次無人放逐
    }, state.settings.rules || {});

    state.boardId = state.boardId || "basic";
    state.playerCount = state.playerCount || 9;

    state.nightNo = state.nightNo || 1;
    state.dayNo = state.dayNo || 1;

    state.phase = state.phase || "setup";
    state.dealIndex = state.dealIndex || 0;

    state.logs = state.logs || [];

    state.night = state.night || {};
    state.night.prevGuardTarget = state.night.prevGuardTarget ?? null;

    state.nightSteps = state.nightSteps || [];
    state.nightStepIndex = state.nightStepIndex || 0;

    state.selectedSeat = state.selectedSeat || null;

    // deal-recheck: allow tapping seat to reveal again
    state.deal = state.deal || { focusSeat: null };

    // vote tie tracking (for day)
    state.day = state.day || { tieRound:0 };

    return state;
  }

  /* =========================
     State & boot
  ========================= */
  let state = ensureDefaults(S.load() || S.createInitial());
  S.save(state);

  function renderAll(){
    UI.setGodView(state.godView);
    if(state.phase==="setup") R.renderSetup(state);
    else if(state.phase==="deal") R.renderDeal(state);
    else if(state.phase==="night") R.renderNight(state);
    else if(state.phase==="day") R.renderDay(state);
  }

  /* =========================
     Setup: board/preset
  ========================= */
  function applyBoardPreset(){
    const presetFn = W.getBoardPreset;
    if(typeof presetFn==="function"){
      state.rolesCount = presetFn(state.boardId, state.playerCount);
    }else{
      // fallback: minimal safe
      state.rolesCount = { werewolf:2, seer:1, witch:1, hunter:1, villager: state.playerCount-5 };
    }
    S.save(state);
    R.renderSetup(state);
  }

  function setBoard(id){
    state.boardId = id;
    applyBoardPreset();
  }

  function setPlayerCount(n){
    const nn = Math.max(6, Math.min(12, Number(n)||9));
    state.playerCount = nn;
    applyBoardPreset();
  }

  /* =========================
     Build players + Deal
  ========================= */
  function buildPlayers(){
    const rolesArr=[];
    for(const [rid,cnt] of Object.entries(state.rolesCount||{})){
      for(let i=0;i<(cnt||0);i++) rolesArr.push(rid);
    }
    // ensure exact
    while(rolesArr.length < state.playerCount) rolesArr.push("villager");
    rolesArr.length = state.playerCount;

    // shuffle
    for(let i=rolesArr.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [rolesArr[i],rolesArr[j]]=[rolesArr[j],rolesArr[i]];
    }

    state.players = rolesArr.map((rid,idx)=>({
      seat: idx+1,
      roleId: rid,
      team: roleInfo(rid).team || "villager",
      alive: true,
      isChief: false,
      notes: ""
    }));

    state.dealIndex = 0;
    state.deal.focusSeat = null;

    // reset game progress
    state.nightNo=1;
    state.dayNo=1;
    state.logs=[];
    state.day.tieRound=0;

    // reset night persistent flags
    state.night = {
      prevGuardTarget: null,
      guardTarget: null,
      wolfTarget: null,
      seerCheckTarget: null,
      seerResult: null,
      witchSaveUsed: false,
      witchPoisonUsed: false,
      witchSave: false,
      witchPoisonTarget: null,
      _meta: {}
    };

    S.save(state);
  }

  /* =========================
     Deal: reveal logic (hold)
  ========================= */
  let holdTimer=null;
  function dealSeatToReveal(){
    // normal: dealIndex -> seat
    if(state.deal.focusSeat) return state.deal.focusSeat;
    return (state.dealIndex < state.players.length) ? (state.dealIndex+1) : null;
  }

  function showRevealCard(seat){
    const p = getPlayer(state, seat);
    if(!p) return;
    UI.openReveal({
      seat,
      role: roleInfo(p.roleId),
      godView: state.godView
    });
    navigator.vibrate?.(60);
  }

  function hideRevealCard(){
    UI.closeReveal();
  }

  function startHoldReveal(){
    clearTimeout(holdTimer);
    holdTimer=setTimeout(()=>{
      const seat = dealSeatToReveal();
      if(seat) showRevealCard(seat);
    }, 1200);
  }

  function endHoldReveal(){
    clearTimeout(holdTimer);
    hideRevealCard();
  }

  function nextPlayerDeal(){
    hideRevealCard();
    state.deal.focusSeat = null;
    state.dealIndex = Math.min(state.players.length, state.dealIndex+1);
    S.save(state);
    R.renderDeal(state);
  }

  function goDealScreen(){
    state.phase="deal";
    S.save(state);
    R.renderDeal(state);
  }

  /* =========================
     Night: build steps
  ========================= */
  function resetNightVolatile(){
    // keep used potions & prevGuardTarget
    const prev = state.night.prevGuardTarget ?? null;
    const saveUsed = !!state.night.witchSaveUsed;
    const poisonUsed = !!state.night.witchPoisonUsed;

    state.night.guardTarget=null;
    state.night.wolfTarget=null;
    state.night.seerCheckTarget=null;
    state.night.seerResult=null;
    state.night.witchSave=false;
    state.night.witchPoisonTarget=null;
    state.night.prevGuardTarget=prev;
    state.night.witchSaveUsed=saveUsed;
    state.night.witchPoisonUsed=poisonUsed;

    state.selectedSeat=null;
  }

  function buildNightSteps(){
    const builder = W.nightSteps;
    if(typeof builder!=="function"){
      console.warn("[app.js] Missing WW_DATA.nightSteps (data/flow/night.steps.js)");
      // fallback minimal steps
      state.nightSteps = [
        {key:"close", type:"info", publicScript:"天黑請閉眼。", godScript:"天黑請閉眼。"},
        {key:"wolf", type:"pick_or_none", pickTarget:"wolfTarget", required:false, roleId:"werewolf",
          publicScript:"狼人請睜眼。", godScript:"狼人刀誰？（可空刀）" },
        {key:"dawn", type:"resolve", publicScript:"天亮請睜眼。", godScript:"天亮請睜眼 → 結算" }
      ];
      return;
    }
    state.nightSteps = builder({
      players: state.players,
      night: state.night,
      settings: clone(state.settings.rules),
      roles: getRoles()
    });
  }

  function goNightScreen(){
    state.phase="night";
    resetNightVolatile();
    buildNightSteps();
    state.nightStepIndex=0;
    S.save(state);
    R.renderNight(state);
  }

  function curStep(){
    return state.nightSteps[state.nightStepIndex] || null;
  }

  function seatPickInNight(seat){
    const step = curStep();
    if(!step) return;
    if(!getPlayer(state, seat)?.alive) return;

    state.selectedSeat = seat;

    if(step.type==="pick" && step.pickTarget){
      state.night[step.pickTarget]=seat;
    }
    if(step.type==="pick_or_none" && step.pickTarget){
      state.night[step.pickTarget]=seat;
    }
    if(step.type==="seer" && step.pickTarget){
      state.night[step.pickTarget]=seat;
      const t=getPlayer(state, seat);
      state.night.seerResult = (t?.team==="wolf") ? "wolf" : "villager";
    }
    S.save(state);
    R.renderNight(state);
  }

  function nightPrev(){
    state.selectedSeat=null;
    state.nightStepIndex=Math.max(0, state.nightStepIndex-1);
    S.save(state);
    R.renderNight(state);
  }

  async function nightNext(){
    const step = curStep();
    if(!step) return;

    // required pick
    if(step.required && step.pickTarget && !state.night[step.pickTarget]){
      navigator.vibrate?.([60,40,60]);
      return;
    }

    // Witch panel
    if(step.type==="panel" && step.roleId==="witch"){
      if(!state.godView){
        alert("需要 🔓 上帝視角 才能操作女巫。");
        return;
      }
      const wf = W.witchFlow;
      if(!wf){
        alert("缺少 data/flow/witch.flow.js");
        return;
      }

      // build panel context
      const ctx = {
        state,
        wolfTarget: state.night.wolfTarget,
        rules: clone(state.settings.rules),
        witchSeat: state.players.find(p=>p.roleId==="witch")?.seat ?? null
      };

      const result = await UI.openWitchPanel(ctx, wf);
      // result: {save:boolean|null, poisonSeat:number|null, usedSave:boolean?}
      if(result){
        // apply decisions
        if(typeof result.save==="boolean") state.night.witchSave = result.save;
        if(result.poisonSeat===null) state.night.witchPoisonTarget = null;
        if(typeof result.poisonSeat==="number") state.night.witchPoisonTarget = result.poisonSeat;
      }

      S.save(state);
      // after closing panel, proceed to next step automatically
      state.selectedSeat=null;
      state.nightStepIndex = Math.min(state.nightSteps.length-1, state.nightStepIndex+1);
      S.save(state);
      R.renderNight(state);
      return;
    }

    // Resolve
    if(step.type==="resolve"){
      resolveNightAndGoDay();
      return;
    }

    state.selectedSeat=null;
    state.nightStepIndex = Math.min(state.nightSteps.length-1, state.nightStepIndex+1);
    S.save(state);
    R.renderNight(state);
  }

  /* =========================
     Resolve night -> announcement -> day
  ========================= */
  function ensureRulesCore(){
    if(!W.rulesCore){
      console.warn("[app.js] Missing WW_DATA.rulesCore (data/flow/rules.core.js)");
      return null;
    }
    return W.rulesCore;
  }

  function resolveNightAndGoDay(){
    const rulesCore = ensureRulesCore();
    if(!rulesCore){
      alert("缺少 rules.core.js（核心規則）");
      return;
    }

    // Resolve using rulesCore
    const resolved = rulesCore.resolveNight({
      players: state.players,
      night: state.night,
      settings: clone(state.settings.rules)
    });

    // mark deaths
    (resolved.deaths || []).forEach(seat=>{
      const p=getPlayer(state, seat);
      if(p) p.alive=false;
    });

    // consume potions
    if(state.night.witchSave) state.night.witchSaveUsed=true;
    if(state.night.witchPoisonTarget) state.night.witchPoisonUsed=true;

    // remember guard target for "no consecutive guard"
    if(typeof resolved.meta?.guardTargetRaw!=="undefined"){
      state.night.prevGuardTarget = resolved.meta.guardTargetRaw;
    }else{
      state.night.prevGuardTarget = state.night.guardTarget ?? state.night.prevGuardTarget ?? null;
    }

    // announcement
    const ann = rulesCore.buildAnnouncement({
      nightNo: state.nightNo,
      dayNo: state.dayNo,
      players: state.players,
      night: state.night,
      resolved,
      settings: clone(state.settings.rules)
    });

    // log
    state.logs.unshift({
      ts: nowISO(),
      nightNo: state.nightNo,
      dayNo: state.dayNo,
      publicText: ann.publicText || "",
      hiddenText: ann.hiddenText || "",
      actions: { night: clone(state.night), resolved: clone(resolved) }
    });

    // go day
    state.phase="day";
    S.save(state);
    R.renderDay(state);

    // must popup announcement
    UI.openAnnouncement("today");
    R.renderAnnouncement(state, "today");

    // victory check at day start
    const verdict = rulesCore.checkWin({
      players: state.players,
      settings: clone(state.settings.rules)
    });
    if(verdict?.ended){
      UI.openGameOver(verdict);
    }
  }

  function dayNextToNight(){
    const rulesCore = ensureRulesCore();
    if(!rulesCore){
      alert("缺少 rules.core.js（核心規則）");
      return;
    }

    // day end win check
    const verdict = rulesCore.checkWin({
      players: state.players,
      settings: clone(state.settings.rules)
    });
    if(verdict?.ended){
      UI.openGameOver(verdict);
      return;
    }

    // advance counters
    state.nightNo += 1;
    state.dayNo += 1;
    state.day.tieRound = 0;

    S.save(state);
    goNightScreen();
  }

  /* =========================
     Global: God toggle & Announcement
  ========================= */
  function toggleGod(){
    if(state.godView){
      state.godView=false;
      S.save(state);
      UI.setGodView(false);
      // rerender announcement if modal opened
      R.renderAnnouncement(state, UI.getAnnMode());
      renderAll();
      return;
    }
    if(state.godUnlocked){
      state.godView=true;
      S.save(state);
      UI.setGodView(true);
      R.renderAnnouncement(state, UI.getAnnMode());
      renderAll();
      return;
    }
    UI.openGodPin();
  }

  function unlockGod(pin){
    if(pin === (state.pin || "0000")){
      state.godUnlocked=true;
      state.godView=true;
      S.save(state);
      UI.setGodView(true);
      renderAll();
      return true;
    }
    return false;
  }

  function openAnn(mode){
    UI.openAnnouncement(mode);
    R.renderAnnouncement(state, mode);
  }

  function exportReplay(){
    const payload = {
      exportedAt: nowISO(),
      includeSecrets: !!state.godView,
      state: state.godView ? clone(state) : S.exportPublic(state)
    };
    UI.downloadJSON(`狼人殺復盤_${Date.now()}.json`, payload);
  }

  /* =========================
     Restart
  ========================= */
  function restart(){
    const ok = confirm("確定要重新開始？\n（會清除本局存檔與紀錄，回到選板子/配置）");
    if(!ok) return;
    S.clear();
    location.reload();
  }

  /* =========================
     Bind UI events
  ========================= */
  // Setup
  on($("boardBasic"), "click", ()=>{ setBoard("basic"); renderAll(); });
  on($("boardB1"), "click", ()=>{ setBoard("b1"); renderAll(); });

  on($("btnMinus"), "click", ()=>{ setPlayerCount(state.playerCount-1); });
  on($("btnPlus"),  "click", ()=>{ setPlayerCount(state.playerCount+1); });
  on($("rangeCount"), "input", (e)=>{ setPlayerCount(Number(e.target.value)); });

  on($("btnSuggest"), "click", ()=>{ applyBoardPreset(); });

  on($("btnOpenRoleConfig"), "click", ()=>{ UI.openRoleConfig(state, getRoles()); });

  on($("btnStart"), "click", ()=>{
    if(S.rolesTotal(state.rolesCount)!==state.playerCount){
      alert("角色總數必須等於玩家人數");
      return;
    }
    buildPlayers();
    goDealScreen();
  });

  // Deal
  const holdBtn = $("btnHoldReveal");
  if(holdBtn){
    // stop iOS text select
    UI.stopTouchSelect(holdBtn);

    on(holdBtn, "touchstart", (e)=>{ e.preventDefault(); startHoldReveal(); }, {passive:false});
    on(holdBtn, "touchend", ()=>endHoldReveal());
    on(holdBtn, "touchcancel", ()=>endHoldReveal());
    on(holdBtn, "mousedown", ()=>startHoldReveal());
    on(holdBtn, "mouseup", ()=>endHoldReveal());
    on(holdBtn, "mouseleave", ()=>endHoldReveal());
  }

  on($("btnNextPlayer"), "click", ()=> nextPlayerDeal());
  on($("btnDealBack"), "click", ()=>{
    state.phase="setup";
    S.save(state);
    renderAll();
  });

  on($("btnFinishDeal"), "click", ()=>{
    // require confirm to enter night
    const ok = confirm("所有人都已確認身分了嗎？\n確認後將進入夜晚流程。");
    if(!ok) return;
    goNightScreen();
  });

  // Night seat click delegation
  on($("nightSeats"), "click", (e)=>{
    const btn = e.target.closest(".seat");
    if(!btn) return;
    const seat = Number(btn.dataset.seat);
    seatPickInNight(seat);
  });

  on($("btnNightPrev"), "click", ()=>nightPrev());
  on($("btnNightNext"), "click", ()=>nightNext());

  // Day
  on($("btnDayNext"), "click", ()=>dayNextToNight());

  // Global: God & Ann
  on($("btnGodToggle"), "click", toggleGod);
  on($("fabGod"), "click", toggleGod);

  on($("btnOpenAnnouncement"), "click", ()=>openAnn("today"));
  on($("fabAnn"), "click", ()=>openAnn("today"));

  on($("annToday"), "click", ()=>{ UI.setAnnMode("today"); R.renderAnnouncement(state, "today"); });
  on($("annHistory"), "click", ()=>{ UI.setAnnMode("history"); R.renderAnnouncement(state, "history"); });

  on($("btnCopyAnn"), "click", ()=> UI.copyText($("annBox")?.textContent||""));
  on($("btnExport"), "click", ()=> exportReplay());
  on($("btnClearSave"), "click", ()=>{
    const ok = confirm("確定清除本局存檔？");
    if(!ok) return;
    S.clear();
    location.reload();
  });

  // God pin modal buttons (delegated to UI)
  UI.onGodPinSubmit((pin)=>{
    const ok = unlockGod(pin);
    if(!ok) UI.showPinWarn(true);
    else UI.closeGodPin();
  });

  // Restart
  on($("btnRestart"), "click", restart);

  /* =========================
     Initial render & preset sync
  ========================= */
  // ensure preset exists on first load
  if(!state.rolesCount || !Object.keys(state.rolesCount).length){
    applyBoardPreset();
  }else{
    // keep totals sync
    R.renderSetup(state);
  }

  renderAll();
})();