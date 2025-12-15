/* =========================================================
   WW_DATA Night — Witch Flow (MVP)
   解決：
   - 彈窗順序固定：刀口 -> 救 -> 毒
   - 解藥用過：不顯示刀口，只能毒或不毒
   - 女巫不能自救：直接在流程層判斷（UI 可禁用按鈕）
========================================================= */

(function(){
  window.WW_DATA = window.WW_DATA || {};
  const W = window.WW_DATA;

  function seatOfRole(players, roleId){
    return players.find(p=>p.roleId===roleId)?.seat ?? null;
  }

  // 回傳女巫本夜應顯示的「面板狀態」
  // UI 只要吃這些欄位就能畫正確
  function getWitchPanelState({players, night, rules}){
    const witchSeat = seatOfRole(players, "witch");
    const wolfTarget = night.wolfTarget ?? null;

    const saveAvailable = !night.witchSaveUsed;     // 解藥是否還可用
    const poisonAvailable = !night.witchPoisonUsed; // 毒藥是否還可用

    // ✅ 解藥用過 -> 不顯示刀口
    const showWolfTarget = saveAvailable && !!wolfTarget;

    // ✅ 女巫不能自救：如果狼刀目標就是女巫自己
    const saveBlockedBySelfRule =
      !!rules?.witchCannotSelfSave &&
      !!wolfTarget &&
      !!witchSeat &&
      wolfTarget === witchSeat;

    return {
      witchSeat,
      wolfTarget,
      showWolfTarget,

      saveAvailable,
      poisonAvailable,

      saveBlockedBySelfRule,

      // 當前選擇（由 night 狀態帶入）
      chosenSave: !!night.witchSave,
      chosenPoisonTarget: night.witchPoisonTarget ?? null
    };
  }

  // 設定「是否用解藥」：只允許救狼刀目標
  function setSave({players, night, rules, useSave}){
    const panel = getWitchPanelState({players, night, rules});

    // 解藥不可用或沒有刀口 -> 一律視為不救
    if(!panel.saveAvailable || !panel.wolfTarget){
      night.witchSave = false;
      return { ok:false, reason:"解藥不可用或沒有刀口" };
    }

    // 女巫不能自救
    if(panel.saveBlockedBySelfRule){
      night.witchSave = false;
      return { ok:false, reason:"女巫不能自救" };
    }

    night.witchSave = !!useSave;
    return { ok:true };
  }

  // 設定毒目標（或取消）
  function setPoisonTarget({players, night, rules, targetSeat}){
    const panel = getWitchPanelState({players, night, rules});

    if(!panel.poisonAvailable){
      night.witchPoisonTarget = null;
      return { ok:false, reason:"毒藥不可用" };
    }

    if(targetSeat == null){
      night.witchPoisonTarget = null;
      return { ok:true };
    }

    // 只能毒存活者（MVP）
    const alive = players.find(p=>p.seat===targetSeat && p.alive);
    if(!alive){
      return { ok:false, reason:"只能選存活玩家" };
    }

    night.witchPoisonTarget = Number(targetSeat);
    return { ok:true };
  }

  // 女巫結束（給 app.js 用來做「用藥鎖定」）
  // 注意：是否真的救成功，會在 rules.core.resolveNight 裡判定（例如奶穿/自救無效）
  function finalizeWitch({night}){
    const used = {
      usedSaveThisNight: !!night.witchSave,
      usedPoisonThisNight: !!night.witchPoisonTarget
    };

    if(used.usedSaveThisNight) night.witchSaveUsed = true;
    if(used.usedPoisonThisNight) night.witchPoisonUsed = true;

    return used;
  }

  W.witchFlow = {
    getWitchPanelState,
    setSave,
    setPoisonTarget,
    finalizeWitch
  };

})();
