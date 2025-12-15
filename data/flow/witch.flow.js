/* =========================================================
   data/flow/witch.flow.js
   女巫流程引擎：刀口→救→毒
   - 解藥用過就不顯示刀口
   - 女巫不能自救（可設定）
========================================================= */

(function(){
  window.WW_DATA = window.WW_DATA || {};

  function getWitchSeat(players){
    return players.find(p=>p.roleId==="witch")?.seat ?? null;
  }

  function isAlive(players, seat){
    return !!players.find(p=>p.seat===seat && p.alive);
  }

  function getWitchPanelState({players, night, rules}){
    const r = rules || {};
    const witchSeat = getWitchSeat(players);

    // 是否允許顯示刀口：只有「解藥還沒用過」才顯示
    const saveAvailable = !night.witchSaveUsed;
    const showWolfTarget = saveAvailable; // ✅ 你要求：用過就不顯示刀口

    // 刀口（僅在 showWolfTarget 時有意義）
    const wolfTarget = night.wolfTarget ?? null;

    // 自救限制
    const saveBlockedBySelfRule =
      !!r.witchCannotSelfSave &&
      !!wolfTarget &&
      !!witchSeat &&
      wolfTarget === witchSeat;

    // 若刀口是死人/不存在，就視為不可救
    const validWolfTarget = wolfTarget && isAlive(players, wolfTarget);

    // 能不能按救
    const canSave =
      saveAvailable &&
      showWolfTarget &&
      validWolfTarget &&
      !saveBlockedBySelfRule;

    // 毒藥
    const poisonAvailable = !night.witchPoisonUsed;

    return {
      witchSeat,
      wolfTarget,
      showWolfTarget,
      saveAvailable,
      poisonAvailable,
      saveBlockedBySelfRule,
      canSave,
      chosenSave: !!night.witchSave,
      chosenPoisonTarget: night.witchPoisonTarget ?? null
    };
  }

  function setSave({players, night, rules, useSave}){
    const panel = getWitchPanelState({players, night, rules});
    if(useSave){
      if(!panel.canSave) return false;
      night.witchSave = true;
      return true;
    }else{
      night.witchSave = false;
      return true;
    }
  }

  function setPoisonTarget({players, night, rules, targetSeat}){
    const panel = getWitchPanelState({players, night, rules});
    if(!panel.poisonAvailable){
      // 毒藥已用過
      night.witchPoisonTarget = null;
      return false;
    }
    if(targetSeat === null){
      night.witchPoisonTarget = null;
      return true;
    }
    if(!isAlive(players, targetSeat)) return false;
    night.witchPoisonTarget = targetSeat;
    return true;
  }

  function finalizeWitch({night}){
    // 用藥鎖定（在離開女巫面板時）
    if(night.witchSave) night.witchSaveUsed = true;
    if(night.witchPoisonTarget) night.witchPoisonUsed = true;
    return true;
  }

  window.WW_DATA.witchFlow = {
    getWitchPanelState,
    setSave,
    setPoisonTarget,
    finalizeWitch
  };
})();