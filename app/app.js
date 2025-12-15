/* =========================================================
   app/app.js (Main Entry)
   - load state
   - check required IDs
   - bind UI
   - orchestrate flow
========================================================= */

(function(){
  window.WW_APP = window.WW_APP || {};
  const A = window.WW_APP;
  const W = window.WW_DATA || {};

  const $ = (id) => document.getElementById(id);

  // ---------- State bootstrap ----------
  let state = A.State.load() || A.State.freshState();

  function persist(){
    A.State.save(state);
  }

  function render(){
    A.Render.renderAll(state);
    // announcement modal live update
    if(!$("modalAnn")?.classList.contains("hidden")){
      A.Render.renderAnnouncement(state);
    }
  }

  function hardGoPhase(phase){
    state.phase = phase;
    persist();
    render();
  }

  // ---------- God toggle ----------
  function openGodPin(){
    $("pinWarn")?.classList.add("hidden");
    $("pinInput") && ($("pinInput").value="");
    A.Render.showModal("modalGod", true);
    $("pinInput")?.focus?.();
  }

  function setGodView(on){
    state.godView = !!on;
    document.body.classList.toggle("god-on", !!state.godView);
    const icon = state.godView ? "🔓" : "🔒";
    $("btnGodToggle") && ($("btnGodToggle").textContent = icon);
    $("fabGod") && ($("fabGod").textContent = icon);
    persist();
    render();
  }

  function toggleGod(){
    if(state.godView){
      setGodView(false);
      return;
    }
    if(state.godUnlocked){
      setGodView(true);
      return;
    }
    openGodPin();
  }

  function pinOk(){
    const v = ($("pinInput")?.value || "").trim();
    if(v === state.pin){
      state.godUnlocked = true;
      A.Render.showModal("modalGod", false);
      setGodView(true);
      persist();
    }else{
      $("pinWarn")?.classList.remove("hidden");
    }
  }

  // ---------- Board / Count / Roles ----------
  function selectBoard(boardId){
    state.boardId = boardId;
    // 讓 boards 檔案決定預設配置（若有）
    if(W.boards?.[boardId]?.presets?.[state.playerCount]){
      state.rolesCount = structuredClone(W.boards[boardId].presets[state.playerCount]);
    }else if(boardId === "basic"){
      // default basic suggestion
      // (State 層已經內建)
      state.rolesCount = state.rolesCount;
    }
    persist();
    render();
  }

  function setCount(n){
    A.State.setPlayerCount(state, n);
    // 若 board 有 preset，優先套
    if(W.boards?.[state.boardId]?.presets?.[state.playerCount]){
      state.rolesCount = structuredClone(W.boards[state.boardId].presets[state.playerCount]);
    }
    persist();
    render();
  }

  function changeCount(delta){
    setCount((state.playerCount||9) + delta);
  }

  function suggestRoles(){
    // 優先 board preset
    if(W.boards?.[state.boardId]?.presets?.[state.playerCount]){
      state.rolesCount = structuredClone(W.boards[state.boardId].presets[state.playerCount]);
    }else if(state.boardId === "basic"){
      state.rolesCount = (A.State.freshState().rolesCount);
    }
    persist();
    render();
  }

  // ---------- Role modal render ----------
  function openRoleModal(){
    const body = $("roleConfigBody");
    if(!body) return;
    body.innerHTML = "";

    const list = (W.boards?.[state.boardId]?.rolesList)
      || ["werewolf","villager","seer","witch","hunter","guard","knight","blackWolfKing","whiteWolfKing"];

    list.forEach(roleId=>{
      const info = (W.roles?.[roleId]) || (W.rolesFallback?.[roleId]) || {name:roleId, icon:"❔"};
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

      const minus=document.createElement("button");
      minus.className="btn ghost tiny";
      minus.type="button";
      minus.textContent="－";

      const num=document.createElement("div");
      num.style.minWidth="36px";
      num.style.textAlign="center";
      num.style.fontWeight="900";
      num.textContent=String(state.rolesCount[roleId]||0);

      const plus=document.createElement("button");
      plus.className="btn ghost tiny";
      plus.type="button";
      plus.textContent="＋";

      minus.onclick=()=>{
        state.rolesCount[roleId] = Math.max(0, (state.rolesCount[roleId]||0)-1);
        num.textContent=String(state.rolesCount[roleId]||0);
        persist(); render();
      };
      plus.onclick=()=>{
        state.rolesCount[roleId] = (state.rolesCount[roleId]||0)+1;
        num.textContent=String(state.rolesCount[roleId]||0);
        persist(); render();
      };

      right.append(minus,num,plus);
      row.append(left,right);
      body.appendChild(row);
    });

    A.Render.showModal("modalRole", true);
  }

  function resetRoles(){
    suggestRoles();
    openRoleModal();
  }

  function closeModal(id){
    A.Render.showModal(id, false);
    render();
  }

  // ---------- Start / Deal ----------
  function roleInfoFn(rid){
    const info = (W.roles?.[rid]) || (W.rolesFallback?.[rid]) || {team:"villager"};
    return info;
  }

  function startGame(){
    const total = A.State.rolesTotal(state.rolesCount);
    if(total !== state.playerCount){
      alert("角色總數必須等於玩家人數");
      return;
    }
    A.State.buildPlayersFromRoles(state, roleInfoFn);
    state.phase = "deal";
    persist();
    render();
  }

  // 翻牌：這裡先不做動畫（交給 CSS），只控制流程
  let holdTimer = null;
  function showReveal(){
    // 你後續要插圖片時，在這裡做 reveal card render
    // MVP 先用 alert（避免你說的「放大特寫」）
    const p = state.players[state.dealIndex];
    if(!p) return;
    const info = roleInfoFn(p.roleId);
    alert(`${p.seat} 號身分：${info.name}`);
  }
  function hideReveal(){}

  function dealNext(){
    state.dealIndex += 1;
    persist(); render();
  }

  function dealFinish(){
    // 必須按確認才進夜晚：你要的
    if(!confirm("確定全部抽完？要進入夜晚流程嗎？")) return;

    // 初始化進夜晚
    A.State.goToNight(state);
    persist();
    hardGoPhase("night");
  }

  function goSetup(){
    if(confirm("回到設定頁？（會清除本局存檔）")){
      A.State.clear();
      location.reload();
    }
  }

  // ---------- Night pick modes ----------
  const pickMode = {
    poison: false,
    pick2: null // {stepKey, picked:[...]}
  };

  function setPickMode(kind, on){
    if(kind === "poison") pickMode.poison = !!on;
  }

  function onNightSeatPick(seat){
    // poison mode
    if(pickMode.poison){
      W.witchFlow.setPoisonTarget({
        players: state.players,
        night: state.night,
        rules: state.rules,
        targetSeat: seat
      });
      pickMode.poison = false;
      persist(); render();
      A.Render.openAnnouncement(state, "today");
      A.Render.renderWitchPanel(state);
      return;
    }

    const step = state.nightSteps[state.nightStepIndex];
    if(!step) return;

    // pick1
    if(step.type === "pick" && step.pickTarget){
      // allow none handled by UI choice (later)
      state.night[step.pickTarget] = seat;

      // seer result (basic)
      if(step.roleId === "seer"){
        const t = state.players.find(p=>p.seat===seat);
        state.night.seerResult = (t?.team === "wolf") ? "wolf" : "villager";
      }

      persist(); render();
      return;
    }

    // pick2
    if(step.type === "pick2" && typeof step.onPick === "function"){
      const r = step.onPick({ seat, night: state.night });
      if(r?.ok){
        persist(); render();
        // 若已選滿兩人，自動往下一步（更像手機 app）
        if(r.done){
          state.nightStepIndex += 1;
          persist(); render();
        }
      }else{
        navigator.vibrate?.([60,40,60]);
      }
      return;
    }
  }

  function nightPrev(){
    state.nightStepIndex = Math.max(0, (state.nightStepIndex||0)-1);
    persist(); render();
  }

  function afterWitchDone(){
    // 女巫完成 -> 進下一步
    state.nightStepIndex = Math.min(state.nightSteps.length-1, state.nightStepIndex+1);
    persist(); render();
  }

  function nightNext(){
    const step = state.nightSteps[state.nightStepIndex];
    if(!step) return;

    // panel(witch)
    if(step.type === "panel" && step.roleId === "witch"){
      if(!state.godView){
        alert("需要 🔓 上帝視角 才能操作女巫");
        return;
      }
      A.Render.openAnnouncement(state, "today");
      A.Render.renderWitchPanel(state);
      return;
    }

    // resolve
    if(step.type === "resolve"){
      // 結算 -> 白天
      try{
        A.State.resolveNightToDay(state);
        persist();
        hardGoPhase("day");
        // 一定跳公告
        A.Render.openAnnouncement(state, "today");
        render();
        // 勝負判定（夜晚死亡後先判定一次）
        if(A.State.checkWinAndMaybeEnd(state)){
          persist();
          hardGoPhase("end");
          A.Render.openAnnouncement(state, "today");
        }
      }catch(e){
        alert("夜晚結算失敗：缺少 rulesCore 或資料不完整");
        console.error(e);
      }
      return;
    }

    // normal step next
    state.nightStepIndex = Math.min(state.nightSteps.length-1, state.nightStepIndex+1);
    persist(); render();
  }

  // ---------- Day ----------
  function goNextNight(){
    // 白天到下一夜
    if(A.State.checkWinAndMaybeEnd(state)){
      persist();
      hardGoPhase("end");
      A.Render.openAnnouncement(state, "today");
      return;
    }
    A.State.goNextNight(state);
    persist();
    hardGoPhase("night");
  }

  // ---------- Export ----------
  function exportReplay(){
    const includeSecrets = !!state.godView;
    const payload = A.State.exportReplay(state, includeSecrets);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `狼人殺復盤_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 400);
  }

  function persistAndRender(){
    persist(); render();
  }

  // ---------- UI API exposed to Bindings/Render ----------
  A.UI = {
    // modal
    closeModal,
    openAnnouncement: (mode)=> A.Render.openAnnouncement(state, mode),
    setAnnMode: (mode)=> A.Render.setAnnMode(state, mode),
    copyAnnouncement,

    // god
    toggleGod,
    pinOk,

    // setup
    selectBoard,
    changeCount,
    setCount,
    suggestRoles,
    openRoleModal,
    resetRoles,
    startGame,

    // deal
    goSetup,
    dealNext,
    dealFinish,

    // night
    nightPrev,
    nightNext,
    onNightSeatPick,
    setPickMode,
    afterWitchDone,

    // day
    goNextNight,

    // export
    exportReplay,

    // helper
    persistAndRender
  };

  // ---------- Boot ----------
  function boot(){
    // required IDs check
    const missing = A.Bindings.checkRequiredIds();
    if(missing.length){
      A.Bindings.reportMissingIds(missing);
    }

    // bind events
    A.Bindings.bindAll(state);

    // initial render
    render();

    // set icons
    const icon = state.godView ? "🔓" : "🔒";
    $("btnGodToggle") && ($("btnGodToggle").textContent = icon);
    $("fabGod") && ($("fabGod").textContent = icon);

    // bind touch-and-hold reveal (deal)
    const holdBtn = $("btnHoldReveal");
    if(holdBtn){
      const startHold = ()=>{
        clearTimeout(holdTimer);
        holdTimer = setTimeout(()=>showReveal(), 1200);
      };
      const endHold = ()=>{
        clearTimeout(holdTimer);
        hideReveal();
      };
      holdBtn.addEventListener("touchstart", startHold, {passive:true});
      holdBtn.addEventListener("touchend", endHold);
      holdBtn.addEventListener("touchcancel", endHold);
      holdBtn.addEventListener("mousedown", startHold);
      holdBtn.addEventListener("mouseup", endHold);
      holdBtn.addEventListener("mouseleave", endHold);
    }
  }

  boot();

})();