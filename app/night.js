/* =========================================================
   狼人殺｜上帝輔助 PWA
   檔案：/app/night.js

   ✅ 夜晚流程控制
   - initNight(state)
   - renderNight(state, ui)
   - prevStep(state), nextStep(state, ui)
   - openWitchModal(state, ui)
   - resolveNightToDay(state, ui) => 回傳 { publicText, hiddenText, resolved }
========================================================= */

(function () {
  window.WW = window.WW || {};
  window.WW_DATA = window.WW_DATA || {};

  const rulesCore = window.WW_DATA.rulesCore;

  const $ = (id) => document.getElementById(id);

  function hasRole(players, roleId){
    return players.some(p=>p.roleId===roleId);
  }

  function alive(players, seat){
    const p = players.find(x=>x.seat===seat);
    return !!(p && p.alive);
  }

  function roleName(roleId){
    const r = window.WW_DATA.getRole ? window.WW_DATA.getRole(roleId) : (window.WW_DATA.roles?.[roleId]||null);
    return r?.name || roleId;
  }

  function initNight(state){
    // 重置夜晚動作（保留：女巫藥是否用過、prevGuardTarget）
    window.WW.state.resetNightKeepConsumables(state);

    // 生成 steps（使用你第7檔 night.steps.basic.js）
    const buildSteps = window.WW_DATA.nightStepsBasic;
    state.nightSteps = (typeof buildSteps === "function")
      ? buildSteps(state.players, state.night, state.settings?.rules || {})
      : [];

    state.nightStepIndex = 0;
    window.WW.state.save(state);
  }

  function currentStep(state){
    return state.nightSteps?.[state.nightStepIndex] || null;
  }

  function seatDotsHTML(state, onPick){
    const box = $("nightSeats");
    if(!box) return;

    box.innerHTML = "";
    state.players.forEach(p=>{
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "seat" + (p.alive ? "" : " dead") + (p.isChief ? " chief" : "");
      btn.textContent = String(p.seat);

      btn.onclick = () => {
        if(!p.alive) return;
        onPick(p.seat);
      };

      box.appendChild(btn);
    });
  }

  function scriptForStep(state, step){
    const god = !!state.godView;
    let txt = (god ? (step.godScript || step.publicScript || "") : (step.publicScript || "")) || "";

    // 守衛連守提醒（只提示）
    if(step.key==="guard" && god && state.settings?.rules?.noConsecutiveGuard && state.night.prevGuardTarget){
      txt += `\n\n（提示）上一夜守的是：${state.night.prevGuardTarget} 號，本夜不可連守同一人。`;
    }

    // 預言家結果只給上帝看
    if(step.type==="seer" && god && typeof step.afterScript==="function"){
      txt += step.afterScript({seerResult: state.night.seerResult}) || "";
    }

    // 女巫提示（上帝）
    if(step.type==="witch"){
      if(!god){
        txt += `\n\n（提示）請切換 🔓 上帝視角 才能操作女巫。`;
      }else{
        txt += `\n\n（上帝）點「下一步」將開啟女巫彈窗。`;
      }
    }

    return txt.trim();
  }

  function renderNight(state){
    const tag = $("nightTag");
    const script = $("nightScript");
    if(tag) tag.textContent = `第 ${state.nightNo} 夜`;

    const step = currentStep(state);
    if(!step){
      if(script) script.textContent = "（夜晚流程結束）";
      return;
    }

    if(script) script.textContent = scriptForStep(state, step);

    // 座位點選（依 step 類型寫入 state.night）
    seatDotsHTML(state, (seat)=>{
      const s = currentStep(state);
      if(!s) return;

      // pick 型
      if(s.type==="pick" && s.pickTarget){
        state.night[s.pickTarget] = seat;
      }

      // seer 型
      if(s.type==="seer" && s.pickTarget){
        state.night[s.pickTarget] = seat;
        const t = state.players.find(p=>p.seat===seat);
        state.night.seerResult = (t?.team === "wolf") ? "wolf" : "villager";
      }

      window.WW.state.save(state);
      renderNight(state);
    });
  }

  function prevStep(state){
    state.nightStepIndex = Math.max(0, state.nightStepIndex - 1);
    window.WW.state.save(state);
  }

  function canNext(state){
    const step = currentStep(state);
    if(!step) return false;

    // 需要必選的步驟（例如守衛、預言）
    if(step.type==="pick" && step.required && step.pickTarget){
      return !!state.night[step.pickTarget];
    }
    if(step.type==="seer" && step.required && step.pickTarget){
      return !!state.night[step.pickTarget];
    }

    // 狼人可空刀：required=false
    return true;
  }

  /* =========================================================
     女巫彈窗：刀口→救→毒（解藥用過則不顯示刀口）
  ========================================================= */
  function openWitchModal(state, ui){
    // 需要上帝視角
    if(!state.godView){
      alert("需要 🔓 上帝視角 才能操作女巫");
      return;
    }

    // UI DOM
    const modal = $("modalWitch");
    const body = $("witchBody");
    const btnClose = $("witchClose");
    const btnDone = $("witchDone");

    if(!modal || !body){
      alert("缺少女巫彈窗 DOM（index.html 需有 modalWitch / witchBody / witchDone）");
      return;
    }

    const rules = state.settings?.rules || {};
    const wolfTarget = state.night.wolfTarget;
    const witchSeat = state.players.find(p=>p.roleId==="witch")?.seat || null;

    // 清空內容
    body.innerHTML = "";

    const card = document.createElement("div");
    card.className = "card inner";
    card.style.whiteSpace = "pre-line";
    card.style.lineHeight = "1.6";

    // 1) 解藥是否可用
    if(!state.night.witchSaveUsed){
      const info = document.createElement("div");
      info.style.fontWeight = "1000";
      info.textContent = `今晚被刀的是：${wolfTarget ? (wolfTarget + " 號") : "（狼人尚未選擇/或空刀）"}`;
      card.appendChild(info);

      // 女巫不能自救提示
      if(rules.witchCannotSelfSave && wolfTarget && witchSeat && wolfTarget === witchSeat){
        const warn = document.createElement("div");
        warn.className = "warn";
        warn.textContent = "⚠️ 規則：女巫不能自救（就算你選救，系統會判定無效）";
        warn.style.marginTop = "8px";
        card.appendChild(warn);
      }

      const row = document.createElement("div");
      row.className = "row";
      row.style.gap = "10px";
      row.style.marginTop = "10px";

      const btnSave = document.createElement("button");
      btnSave.type = "button";
      btnSave.className = "btn";
      btnSave.textContent = state.night.witchSave ? "✅ 已選擇救人" : "使用解藥救他";
      btnSave.disabled = !wolfTarget; // 沒刀口就不能救
      btnSave.onclick = ()=>{
        state.night.witchSave = !state.night.witchSave;
        window.WW.state.save(state);
        openWitchModal(state, ui); // 重繪
      };

      const btnNoSave = document.createElement("button");
      btnNoSave.type = "button";
      btnNoSave.className = "btn ghost";
      btnNoSave.textContent = "不使用解藥";
      btnNoSave.onclick = ()=>{
        state.night.witchSave = false;
        window.WW.state.save(state);
        openWitchModal(state, ui);
      };

      row.append(btnSave, btnNoSave);
      card.appendChild(row);
    } else {
      // 解藥已用過：不顯示刀口（符合你要求）
      const info = document.createElement("div");
      info.style.fontWeight = "1000";
      info.textContent = "解藥：已用過（本夜不顯示刀口）";
      card.appendChild(info);
    }

    // 2) 毒藥（可用才顯示）
    const poisonWrap = document.createElement("div");
    poisonWrap.style.marginTop = "14px";

    const poisonTitle = document.createElement("div");
    poisonTitle.style.fontWeight = "1000";
    poisonTitle.textContent = `毒藥：${state.night.witchPoisonUsed ? "已用過" : "可用"}`;
    poisonWrap.appendChild(poisonTitle);

    if(!state.night.witchPoisonUsed){
      const tip = document.createElement("div");
      tip.className = "hint";
      tip.textContent = "要毒人：點下方座位（再按「完成」）／不毒：按「清除毒藥」。";
      tip.style.marginTop = "6px";
      poisonWrap.appendChild(tip);

      const seats = document.createElement("div");
      seats.className = "seats";
      seats.style.marginTop = "8px";

      state.players.forEach(p=>{
        const b = document.createElement("button");
        b.type = "button";
        b.className = "seat" + (p.alive ? "" : " dead");
        b.textContent = String(p.seat);

        if(!p.alive) b.disabled = true;

        if(state.night.witchPoisonTarget === p.seat){
          b.classList.add("selected");
        }

        b.onclick = ()=>{
          if(!p.alive) return;
          state.night.witchPoisonTarget = p.seat;
          window.WW.state.save(state);
          openWitchModal(state, ui);
        };

        seats.appendChild(b);
      });

      poisonWrap.appendChild(seats);

      const row2 = document.createElement("div");
      row2.className = "row";
      row2.style.gap = "10px";
      row2.style.marginTop = "10px";

      const btnClear = document.createElement("button");
      btnClear.type = "button";
      btnClear.className = "btn ghost";
      btnClear.textContent = "清除毒藥（不毒）";
      btnClear.onclick = ()=>{
        state.night.witchPoisonTarget = null;
        window.WW.state.save(state);
        openWitchModal(state, ui);
      };

      row2.appendChild(btnClear);
      poisonWrap.appendChild(row2);
    }

    body.appendChild(card);
    body.appendChild(poisonWrap);

    // 事件
    if(btnClose){
      btnClose.onclick = ()=> modal.classList.add("hidden");
    }

    if(btnDone){
      btnDone.onclick = ()=>{
        // 關閉彈窗、回到夜晚 wizard 下一步
        modal.classList.add("hidden");
        state.nightStepIndex = Math.min(state.nightSteps.length-1, state.nightStepIndex + 1);
        window.WW.state.save(state);
        renderNight(state);
      };
    }

    modal.classList.remove("hidden");
  }

  /* =========================================================
     resolveNightToDay：結算 + 生成公告 + 寫入 logs
  ========================================================= */
  function resolveNightToDay(state){
    if(!rulesCore){
      alert("缺少 rules.core.js（WW_DATA.rulesCore）");
      return null;
    }

    // 結算夜晚
    const resolved = rulesCore.resolveNight({
      players: state.players,
      night: state.night,
      settings: state.settings?.rules || {}
    });
    state.lastResolved = resolved;

    // 套用死亡（更新 players.alive）
    (resolved.deaths || []).forEach(seat=>{
      const p = state.players.find(x=>x.seat===seat);
      if(p) p.alive = false;
    });

    // 若女巫選救/毒，鎖定藥水使用
    if(state.night.witchSave) state.night.witchSaveUsed = true;
    if(state.night.witchPoisonTarget) state.night.witchPoisonUsed = true;

    // 記錄 prevGuardTarget（供下一夜不能連守）
    // 以「本夜原本選擇」為準（即使連守被判無效，也要記住他想守誰，或你也可改成記 guardTargetFinal）
    state.night.prevGuardTarget = state.night.guardTarget || state.night.prevGuardTarget || null;

    // 公告
    const ann = rulesCore.buildAnnouncement({
      nightNo: state.nightNo,
      dayNo: state.dayNo,
      players: state.players,
      night: state.night,
      resolved,
      settings: state.settings?.rules || {}
    });

    const logItem = rulesCore.makeLogItem({
      ts: new Date().toISOString(),
      nightNo: state.nightNo,
      dayNo: state.dayNo,
      publicText: ann.publicText,
      hiddenText: ann.hiddenText,
      votes: null,
      actions: { night: { ...state.night } },
      resolvedMeta: resolved.meta || null
    });
    state.logs.unshift(logItem);

    // 夜晚結束 → 進白天
    state.phase = "day";

    window.WW.state.save(state);
    return { ...ann, resolved };
  }

  function nextStep(state){
    const step = currentStep(state);
    if(!step) return { action:"none" };

    if(!canNext(state)){
      // 需要選擇但沒選
      navigator.vibrate?.([60,40,60]);
      return { action:"blocked" };
    }

    // 女巫：開彈窗
    if(step.type === "witch"){
      return { action:"witch" };
    }

    // 結算：resolve
    if(step.type === "resolve"){
      return { action:"resolve" };
    }

    // 一般下一步
    state.nightStepIndex = Math.min(state.nightSteps.length-1, state.nightStepIndex + 1);
    window.WW.state.save(state);
    return { action:"next" };
  }

  window.WW.night = {
    initNight,
    renderNight,
    prevStep,
    nextStep,
    openWitchModal,
    resolveNightToDay
  };
})();
