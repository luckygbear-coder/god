/* =========================================================
   WW_DATA Night Steps — Special Builder (B1)
   - 將 nightSpecialRegistry 轉成可執行 steps
   - 依角色存在/存活/第一夜條件動態生成
   - 女巫 panel 交由 WW_DATA.witchFlow 處理
========================================================= */

(function(){
  window.WW_DATA = window.WW_DATA || {};
  const W = window.WW_DATA;

  function hasRole(players, roleId){
    return players.some(p => p.roleId === roleId);
  }
  function hasAliveRole(players, roleId){
    return players.some(p => p.alive && p.roleId === roleId);
  }

  // pick2 需要記住點選過的第一個
  function ensureNightCache(night){
    night._cache = night._cache || {};
    night._cache.pick2 = night._cache.pick2 || {};
    return night._cache;
  }

  function makeSeatPickStep(reg, nightKey){
    return {
      key: reg.id,
      type: "pick",
      roleId: reg.id,
      required: true,
      allowNone: false,
      pickTarget: nightKey,
      godScript: reg.script?.god || "",
      publicScript: reg.script?.public || reg.script?.god || ""
    };
  }

  function makeSeatPickAllowNoneStep(reg, nightKey){
    return {
      key: reg.id,
      type: "pick",
      roleId: reg.id,
      required: false,
      allowNone: true,
      pickTarget: nightKey,
      godScript: reg.script?.god || "",
      publicScript: reg.script?.public || reg.script?.god || ""
    };
  }

  // pick2：點兩個座位，寫入 night[keyA], night[keyB]
  function makePick2Step(reg){
    const keyA = reg.dataKeys?.[0] || (reg.id + "PickA");
    const keyB = reg.dataKeys?.[1] || (reg.id + "PickB");

    return {
      key: reg.id,
      type: "pick2",
      roleId: reg.id,
      required: true,
      allowNone: false,
      dataKeys: [keyA, keyB],
      godScript: reg.script?.god || "",
      publicScript: reg.script?.public || reg.script?.god || "",
      onPick: ({ seat, night }) => {
        const cache = ensureNightCache(night);
        const picked = cache.pick2[reg.id] || [];

        // 不可重複
        if(picked.includes(seat)) return { ok:false, reason:"不可重複選同一人" };

        picked.push(seat);
        cache.pick2[reg.id] = picked;

        if(picked.length === 1){
          night[keyA] = picked[0];
          night[keyB] = null;
          return { ok:true, done:false, picked: picked.slice() };
        }
        night[keyA] = picked[0];
        night[keyB] = picked[1];
        return { ok:true, done:true, picked: picked.slice() };
      },
      reset: ({ night }) => {
        const cache = ensureNightCache(night);
        cache.pick2[reg.id] = [];
        night[keyA] = null;
        night[keyB] = null;
      }
    };
  }

  function makePanelStep(reg){
    return {
      key: reg.id,
      type: "panel",
      roleId: reg.id,
      godScript: reg.script?.god || "",
      publicScript: reg.script?.public || reg.script?.god || ""
    };
  }

  function makeInfoStep(reg){
    return {
      key: reg.id,
      type: "info",
      roleId: reg.id,
      publicScript: reg.script?.public || reg.script?.god || "",
      godScript: reg.script?.god || ""
    };
  }

  function buildNightStepsSpecial(players, night, context){
    const registry = Array.isArray(W.nightSpecialRegistry) ? W.nightSpecialRegistry : [];
    const nightNo = context?.nightNo ?? 1;

    const steps = [];
    steps.push({
      key: "close",
      type: "info",
      publicScript: "天黑請閉眼。",
      godScript: "天黑請閉眼。"
    });

    // 依 order 排序
    const sorted = registry.slice().sort((a,b)=> (a.order||0) - (b.order||0));

    sorted.forEach(reg=>{
      // night 角色才進 steps
      if(reg.phase !== "night") return;

      // 第一夜限定
      if(reg.onlyFirstNight && nightNo !== 1) return;

      // 目前 MVP：只在該角色「存活」才出現夜晚步驟（避免死亡還出現）
      if(!hasAliveRole(players, reg.id)) return;

      // panel / pick / pick2 / allowNone / confirm / none
      if(reg.type === "panel"){
        steps.push(makePanelStep(reg));
        return;
      }

      if(reg.type === "pick2"){
        steps.push(makePick2Step(reg));
        return;
      }

      if(reg.type === "pick1"){
        const key = reg.dataKeys?.[0] || (reg.id + "Target");
        steps.push(makeSeatPickStep(reg, key));
        return;
      }

      if(reg.type === "pick1_or_none"){
        const key = reg.dataKeys?.[0] || (reg.id + "Target");
        steps.push(makeSeatPickAllowNoneStep(reg, key));
        return;
      }

      // confirm / none：先用 info 佔位提示（之後補規則效果）
      if(reg.type === "confirm" || reg.type === "none"){
        if((reg.script?.god || reg.script?.public)){
          steps.push(makeInfoStep(reg));
        }
        return;
      }
    });

    steps.push({
      key: "resolve",
      type: "resolve",
      publicScript: "天亮了，請睜眼。",
      godScript: "天亮了，請睜眼。（系統結算並生成公告）"
    });

    return steps;
  }

  // Export
  W.nightStepsSpecial = buildNightStepsSpecial;

})();
