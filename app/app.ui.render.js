/* =========================================================
   app/app.ui.render.js
   渲染層（UI Update / Modal / Night Picks / Witch Panel）
========================================================= */

(function(){
  window.WW_APP = window.WW_APP || {};
  const A = window.WW_APP;
  const W = window.WW_DATA || {};

  const $ = (id) => document.getElementById(id);

  function roleInfo(roleId){
    const roles = W.roles || {};
    const fallback = W.rolesFallback || {};
    return roles[roleId] || fallback[roleId] || { id: roleId, name: roleId, team:"villager", icon:"❔" };
  }

  function rolesTotal(rolesCount){
    return Object.values(rolesCount||{}).reduce((a,b)=>a+(b||0),0);
  }

  function aliveSeats(players){
    return players.filter(p=>p.alive).map(p=>p.seat);
  }

  function setActive(el, on){
    if(!el) return;
    el.classList.toggle("active", !!on);
  }

  function showModal(id, show){
    const el = $(id);
    if(!el) return;
    el.classList.toggle("hidden", !show);
  }

  /* =========================
     Announcement
  ========================= */
  let annMode = "today"; // today | history

  function renderAnnouncement(state){
    const box = $("annBox");
    if(!box) return;

    const logs = state.logs || [];
    const latest = logs[0] || null;

    if(annMode === "today"){
      if(!latest){
        box.textContent = "（尚無公告）";
        return;
      }
      box.textContent = state.godView
        ? (latest.publicText + (latest.hiddenText ? ("\n\n" + latest.hiddenText) : ""))
        : latest.publicText;
      return;
    }

    if(!logs.length){
      box.textContent = "（尚無歷史公告）";
      return;
    }

    const lines = [];
    logs.forEach((l, idx)=>{
      lines.push(`第${l.nightNo}夜 / 第${l.dayNo}天`);
      lines.push(l.publicText || "—");
      if(state.godView && l.hiddenText) lines.push(l.hiddenText);
      lines.push("—");
    });
    box.textContent = lines.join("\n");
  }

  function openAnnouncement(state, mode){
    if(mode) annMode = mode;
    setActive($("annToday"), annMode==="today");
    setActive($("annHistory"), annMode==="history");
    showModal("modalAnn", true);
    renderAnnouncement(state);
  }

  function setAnnMode(state, mode){
    annMode = mode;
    setActive($("annToday"), annMode==="today");
    setActive($("annHistory"), annMode==="history");
    renderAnnouncement(state);
  }

  async function copyAnnouncement(){
    const txt = $("annBox")?.textContent || "";
    try{
      await navigator.clipboard.writeText(txt);
      alert("已複製公告");
    }catch(e){
      alert("複製失敗（可能需要 HTTPS / 安裝 PWA）");
    }
  }

  /* =========================
     Setup render
  ========================= */
  function renderSetup(state){
    $("playerCount") && ($("playerCount").textContent = String(state.playerCount));
    $("playerTotal") && ($("playerTotal").textContent = String(state.playerCount));
    $("rangeCount") && ($("rangeCount").value = String(state.playerCount));

    const rt = rolesTotal(state.rolesCount);
    $("roleTotal") && ($("roleTotal").textContent = String(rt));

    const ok = rt === state.playerCount;
    $("warnRoleTotal") && ($("warnRoleTotal").classList.toggle("hidden", ok));
    const btnStart = $("btnStart");
    if(btnStart){
      btnStart.disabled = !ok;
      btnStart.textContent = ok ? "開始 → 抽身分" : "⚠️ 角色數需等於玩家數";
    }

    setActive($("boardBasic"), state.boardId==="basic");
    setActive($("boardB1"), state.boardId==="b1");
  }

  /* =========================
     Deal render
  ========================= */
  function renderDeal(state){
    const seat = state.dealIndex + 1;
    const total = state.players.length;

    if($("dealText")){
      $("dealText").innerHTML = seat <= total
        ? `請 <b>${seat} 號</b> 拿手機`
        : `所有玩家已抽完身分`;
    }
  }

  /* =========================
     Night wizard
  ========================= */
  function currentStep(state){
    return state.nightSteps[state.nightStepIndex] || null;
  }

  function stepScript(state, step){
    const base = state.godView ? (step.godScript || step.publicScript || "") : (step.publicScript || "");
    let extra = "";

    // 女巫 panel：提示上帝切換
    if(step.type === "panel" && step.roleId === "witch"){
      if(state.godView){
        extra = "\n\n（提示）點『下一步』開啟女巫操作面板。";
      }else{
        extra = "\n\n（提示）請切換到 🔓 上帝視角 才能操作女巫。";
      }
    }

    return (base + extra).trim();
  }

  function renderNightSeats(state){
    const box = $("nightSeats");
    if(!box) return;
    box.innerHTML = "";

    state.players.forEach(p=>{
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seat" + (p.alive ? "" : " dead") + (p.isChief ? " chief" : "");
      b.textContent = String(p.seat);

      b.disabled = !p.alive;
      b.onclick = ()=> A.UI.onNightSeatPick(p.seat);

      box.appendChild(b);
    });
  }

  function renderNight(state){
    $("nightTag") && ($("nightTag").textContent = `第 ${state.nightNo} 夜`);

    const step = currentStep(state);
    if(!$("nightScript")) return;

    if(!step){
      $("nightScript").textContent = "（夜晚流程結束）";
      return;
    }
    $("nightScript").textContent = stepScript(state, step);
    renderNightSeats(state);
  }

  /* =========================
     Witch Panel (Modal inside modalAnn)
     - reuse modalAnn as witch panel for MVP
  ========================= */
  function renderWitchPanel(state){
    const box = $("annBox");
    if(!box) return;

    const panel = W.witchFlow?.getWitchPanelState({
      players: state.players,
      night: state.night,
      rules: state.rules
    });

    const wolfText = panel.showWolfTarget ? `${panel.wolfTarget} 號` : "（解藥已用過／本夜不顯示刀口）";

    box.innerHTML = "";
    const title = document.createElement("div");
    title.style.whiteSpace = "pre-line";
    title.style.fontWeight = "900";
    title.textContent =
      `【女巫操作】\n今晚刀口：${wolfText}\n解藥：${panel.saveAvailable ? "可用" : "已用過"}\n毒藥：${panel.poisonAvailable ? "可用" : "已用過"}`;
    box.appendChild(title);

    if(panel.saveBlockedBySelfRule){
      const warn = document.createElement("div");
      warn.className = "warn";
      warn.textContent = "⚠️ 規則：女巫不能自救（不能對自己使用解藥）";
      warn.style.marginTop = "8px";
      box.appendChild(warn);
    }

    const row1 = document.createElement("div");
    row1.className = "row";
    row1.style.marginTop = "10px";
    row1.style.gap = "10px";

    const btnSave = document.createElement("button");
    btnSave.className = "btn";
    btnSave.type = "button";
    btnSave.textContent = panel.chosenSave ? "✅ 已選擇救" : "用解藥救";
    btnSave.disabled = !panel.saveAvailable || !panel.showWolfTarget || panel.saveBlockedBySelfRule;
    btnSave.onclick = ()=>{
      W.witchFlow.setSave({
        players: state.players,
        night: state.night,
        rules: state.rules,
        useSave: true
      });
      A.UI.persistAndRender();
      renderWitchPanel(state);
    };

    const btnNoSave = document.createElement("button");
    btnNoSave.className = "btn ghost";
    btnNoSave.type = "button";
    btnNoSave.textContent = "不用解藥";
    btnNoSave.onclick = ()=>{
      W.witchFlow.setSave({
        players: state.players,
        night: state.night,
        rules: state.rules,
        useSave: false
      });
      A.UI.persistAndRender();
      renderWitchPanel(state);
    };

    row1.appendChild(btnSave);
    row1.appendChild(btnNoSave);

    const row2 = document.createElement("div");
    row2.className = "row";
    row2.style.marginTop = "10px";
    row2.style.gap = "10px";

    const btnPickPoison = document.createElement("button");
    btnPickPoison.className = "btn";
    btnPickPoison.type = "button";
    btnPickPoison.textContent = panel.chosenPoisonTarget ? `☠️ 已毒 ${panel.chosenPoisonTarget} 號（改選）` : "用毒藥（回夜晚點座位）";
    btnPickPoison.disabled = !panel.poisonAvailable;
    btnPickPoison.onclick = ()=>{
      alert("請關閉此面板，回到夜晚座位圓點，點選你要毒的人。");
      A.UI.setPickMode("poison", true);
    };

    const btnNoPoison = document.createElement("button");
    btnNoPoison.className = "btn ghost";
    btnNoPoison.type = "button";
    btnNoPoison.textContent = "不用毒藥";
    btnNoPoison.onclick = ()=>{
      W.witchFlow.setPoisonTarget({
        players: state.players,
        night: state.night,
        rules: state.rules,
        targetSeat: null
      });
      A.UI.setPickMode("poison", false);
      A.UI.persistAndRender();
      renderWitchPanel(state);
    };

    row2.appendChild(btnPickPoison);
    row2.appendChild(btnNoPoison);

    const done = document.createElement("button");
    done.className = "btn primary";
    done.type = "button";
    done.style.marginTop = "12px";
    done.textContent = "完成女巫操作 → 回到夜晚流程";
    done.onclick = ()=>{
      // finalize locks
      W.witchFlow.finalizeWitch({ night: state.night });
      A.UI.closeModal("modalAnn");
      A.UI.afterWitchDone();
    };

    box.appendChild(row1);
    box.appendChild(row2);
    box.appendChild(done);
  }

  /* =========================
     Day / End
  ========================= */
  function renderDay(state){
    $("dayTag") && ($("dayTag").textContent = `第 ${state.dayNo} 天`);
  }

  function renderEnd(state){
    $("endTitle") && ($("endTitle").textContent =
      state.winner==="villager" ? "🎉 正義聯盟獲勝"
      : state.winner==="wolf" ? "🐺 邪惡陣營獲勝"
      : "🏁 第三方獲勝"
    );
    $("endText") && ($("endText").textContent = state.endReason || "");
  }

  /* =========================
     Public render entry
  ========================= */
  function renderAll(state){
    document.body.classList.toggle("god-on", !!state.godView);

    // screen
    ["setup","deal","night","day","end"].forEach(k=>{
      $(`screen-${k}`)?.classList.toggle("active", state.phase===k);
    });

    if(state.phase==="setup") renderSetup(state);
    if(state.phase==="deal") renderDeal(state);
    if(state.phase==="night") renderNight(state);
    if(state.phase==="day") renderDay(state);
    if(state.phase==="end") renderEnd(state);
  }

  A.Render = {
    renderAll,
    openAnnouncement,
    setAnnMode,
    renderAnnouncement,
    copyAnnouncement,
    renderWitchPanel,
    showModal
  };

})();