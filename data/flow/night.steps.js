/* =========================================================
   data/flow/night.steps.js
   夜晚步驟表（Basic + B1）依角色配置動態生成
   step types:
    - info
    - pick (pickTarget)
    - pick_or_none (pickTarget, allowNone)
    - panel (roleId="witch") 交給 witchFlow
    - resolve
========================================================= */

(function(){
  window.WW_DATA = window.WW_DATA || {};

  function hasRole(players, roleId){
    return players.some(p=>p.roleId===roleId && p.alive);
  }

  function roleSeat(players, roleId){
    return players.find(p=>p.roleId===roleId && p.alive)?.seat ?? null;
  }

  function buildSeerAfterScript(night){
    const t = night.seerCheckTarget;
    const r = night.seerResult;
    if(!t || !r) return "";
    return `（上帝）系統結果：${t}號 是 ${r==="wolf" ? "狼人" : "好人"}。\n請你告訴預言家：他的身分是——${r==="wolf" ? "狼人" : "好人"}。`;
  }

  function stepsBasic({players, night, rules}){
    const steps = [];

    steps.push({
      key:"close",
      type:"info",
      publicScript:"🌙 天黑請閉眼。",
      godScript:"🌙 天黑請閉眼。"
    });

    // Guard
    if(hasRole(players, "guard")){
      steps.push({
        key:"guard",
        type:"pick",
        roleId:"guard",
        pickTarget:"guardTarget",
        required:false,
        publicScript:"🛡 守衛請睜眼。",
        godScript:`🛡 守衛請睜眼。\n守誰？（點選座位）\n（提示）規則預設：不能連守同一人。`
      });
    }

    // Wolves (allow skip)
    steps.push({
      key:"wolf",
      type:"pick_or_none",
      roleId:"werewolf",
      pickTarget:"wolfTarget",
      allowNone: !!rules.wolfCanSkipKill,
      required:false,
      publicScript:"🐺 狼人請睜眼。",
      godScript:`🐺 狼人請睜眼。\n刀誰？（點座位）${rules.wolfCanSkipKill ? "\n也可選擇『空刀』。" : ""}`
    });

    // Seer
    if(hasRole(players, "seer")){
      steps.push({
        key:"seer",
        type:"pick",
        roleId:"seer",
        pickTarget:"seerCheckTarget",
        required:false,
        publicScript:"🔮 預言家請睜眼。",
        godScript:"🔮 預言家請睜眼。\n你要查驗誰？（點選座位）",
        afterScript: () => buildSeerAfterScript(night)
      });
    }

    // Witch (panel)
    if(hasRole(players, "witch")){
      steps.push({
        key:"witch",
        type:"panel",
        roleId:"witch",
        publicScript:"🧪 女巫請睜眼。",
        godScript:"🧪 女巫請睜眼。\n（上帝）下一步會開啟女巫操作面板。"
      });
    }

    steps.push({
      key:"resolve",
      type:"resolve",
      publicScript:"☀️ 天亮請睜眼。",
      godScript:"☀️ 天亮請睜眼。\n（上帝）下一步：自動結算並生成公告。"
    });

    return steps;
  }

  // B1: 在 basic 上加骨架（騎士/黑狼王/白狼王）
  // 這些角色很多是白天技能或死亡技能；夜晚先做「提醒步驟」避免忘記
  function stepsB1({players, night, rules}){
    const steps = stepsBasic({players, night, rules});

    // 在 resolve 前插入提醒（不改結算）
    const idxResolve = steps.findIndex(s=>s.type==="resolve");
    const insertAt = idxResolve>=0 ? idxResolve : steps.length;

    // Knight（通常白天技能，但很多桌會夜晚提醒）
    if(hasRole(players, "knight")){
      steps.splice(insertAt, 0, {
        key:"knight_hint",
        type:"info",
        roleId:"knight",
        publicScript:"⚔️ （提示）騎士在白天可發動技能（依你們桌規）。",
        godScript:"⚔️ （上帝提示）騎士白天技能：請記得在白天流程提供騎士操作入口（我們後續會做）。"
      });
    }

    // WhiteWolfKing / BlackWolfKing mostly death skills
    if(hasRole(players, "whiteWolfKing")){
      steps.splice(insertAt, 0, {
        key:"wwk_hint",
        type:"info",
        roleId:"whiteWolfKing",
        publicScript:"🐺⚪ （提示）白狼王存在。",
        godScript:"🐺⚪（上帝提示）白狼王技能多為白天/特定時機發動，後續會接入。"
      });
    }

    if(hasRole(players, "blackWolfKing")){
      steps.splice(insertAt, 0, {
        key:"bwk_hint",
        type:"info",
        roleId:"blackWolfKing",
        publicScript:"🐺👑 （提示）黑狼王存在。",
        godScript:"🐺👑（上帝提示）黑狼王死亡技能：後續會由 death-skill queue 處理；且『被毒不能用技能』已在 rulesCore.canTriggerDeathSkill。"
      });
    }

    return steps;
  }

  function buildNightSteps(players, night, rules, boardId){
    const ctx = {players, night, rules: rules||{}};
    if(boardId === "b1") return stepsB1(ctx);
    return stepsBasic(ctx);
  }

  window.WW_DATA.nightSteps = {
    buildNightSteps
  };
})();