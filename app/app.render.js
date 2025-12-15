/* =========================================================
   app/app.render.js
   - render screens: setup / deal / night / day
   - render night steps + seats + wolf skip
   - render announcement center (today / history)
========================================================= */

(function(){
  window.WW_APP = window.WW_APP || {};
  const A = window.WW_APP;
  const W = window.WW_DATA || {};

  const $ = (id)=>document.getElementById(id);

  /* =========================
     Screen switch
  ========================= */
  function showScreen(name){
    ["screen-setup","screen-deal","screen-night","screen-day"].forEach(id=>{
      const el=$(id);
      if(el) el.classList.toggle("active", id===`screen-${name}`);
    });
  }

  /* =========================
     Setup render
  ========================= */
  function renderSetup(state){
    showScreen("setup");
    $("playerCount") && ($("playerCount").textContent = state.playerCount);
    $("playerTotal") && ($("playerTotal").textContent = state.playerCount);

    const total = A.State.rolesTotal(state.rolesCount);
    $("roleTotal") && ($("roleTotal").textContent = total);
    $("warnRoleTotal")?.classList.toggle("hidden", total===state.playerCount);

    $("boardBasic")?.classList.toggle("active", state.boardId==="basic");
    $("boardB1")?.classList.toggle("active", state.boardId==="b1");
  }

  /* =========================
     Deal render
  ========================= */
  function renderDeal(state){
    showScreen("deal");
    const idx = state.dealIndex;
    const total = state.players.length;
    if($("dealText")){
      $("dealText").innerHTML =
        idx < total
          ? `請 <b>${idx+1} 號</b> 拿手機`
          : `所有玩家已確認身分`;
    }
  }

  /* =========================
     Helpers
  ========================= */
  function alivePlayers(players){
    return players.filter(p=>p.alive);
  }

  function seatButton(p, selectedSeat){
    const b=document.createElement("button");
    b.className="seat"+(p.alive?"":" dead");
    b.dataset.seat=String(p.seat);
    b.textContent=String(p.seat);
    if(selectedSeat===p.seat) b.classList.add("selected");
    return b;
  }

  /* =========================
     Night render
  ========================= */
  function renderNight(state){
    showScreen("night");

    $("nightTag") && ($("nightTag").textContent = `第 ${state.nightNo} 夜`);

    const step = state.nightSteps[state.nightStepIndex];
    const scriptEl = $("nightScript");
    const seatsEl = $("nightSeats");

    if(!step){
      scriptEl && (scriptEl.textContent="（夜晚流程結束）");
      seatsEl && (seatsEl.innerHTML="");
      return;
    }

    // Script
    if(scriptEl){
      let text = state.godView
        ? (step.godScript || step.publicScript || "")
        : (step.publicScript || "");
      // seer afterScript
      if(state.godView && typeof step.afterScript==="function"){
        const extra = step.afterScript();
        if(extra) text += "\n\n"+extra;
      }
      scriptEl.textContent = text;
    }

    // Seats
    if(seatsEl){
      seatsEl.innerHTML="";
      alivePlayers(state.players).forEach(p=>{
        const b = seatButton(p, state.selectedSeat);
        seatsEl.appendChild(b);
      });
    }

    // Wolf skip button
    if(step.type==="pick_or_none" && step.pickTarget==="wolfTarget"){
      if(!$("wolfSkipBtn")){
        const btn=document.createElement("button");
        btn.id="wolfSkipBtn";
        btn.className="btn ghost";
        btn.textContent="🐺 空刀";
        btn.onclick=()=>{
          state.night.wolfTarget = null;
          state.selectedSeat = null;
          A.State.save(state);
          renderNight(state);
        };
        seatsEl?.appendChild(btn);
      }
    }

    // Witch panel hint
    if(step.type==="panel" && step.roleId==="witch"){
      if(state.godView){
        // UI 層只顯示提示，實際操作由 UI.openWitchPanel 呼叫 witchFlow
        // 這裡不主動打開，避免誤觸
      }
    }
  }

  /* =========================
     Day render
  ========================= */
  function renderDay(state){
    showScreen("day");
    $("dayTag") && ($("dayTag").textContent = `第 ${state.dayNo} 天`);
  }

  /* =========================
     Announcement render
  ========================= */
  function renderAnnouncement(state, mode){
    const box = $("annBox");
    if(!box) return;

    if(mode==="today"){
      const log = state.logs[0];
      if(!log){ box.textContent="（尚無公告）"; return; }
      box.textContent = state.godView
        ? (log.publicText + "\n\n" + (log.hiddenText||""))
        : log.publicText;
      return;
    }

    // history
    if(!state.logs.length){
      box.textContent="（尚無歷史紀錄）";
      return;
    }
    const lines=[];
    state.logs.forEach((l,idx)=>{
      lines.push(`#${state.logs.length-idx}｜第${l.nightNo}夜 / 第${l.dayNo}天`);
      lines.push(l.publicText||"—");
      if(state.godView && l.hiddenText) lines.push(l.hiddenText);
      lines.push("—");
    });
    box.textContent = lines.join("\n");
  }

  /* =========================
     Public API
  ========================= */
  A.Render = {
    showScreen,
    renderSetup,
    renderDeal,
    renderNight,
    renderDay,
    renderAnnouncement
  };
})();
