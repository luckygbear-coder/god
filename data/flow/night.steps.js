/* =========================================================
   狼人殺｜夜晚步驟生成器
   檔案：data/flow/night.steps.js

   依據：
   - 場上存活角色
   - 角色 tags
   動態產生夜晚流程
========================================================= */

(function () {
  const ROLES = window.WW_ROLES || {};

  /**
   * 建立夜晚步驟
   * @param {Array} players - 當前玩家陣列（含 roleId, alive）
   * @param {Object} settings - 規則設定
   */
  function buildNightSteps(players, settings = {}) {
    const steps = [];

    const aliveRoles = players
      .filter(p => p.alive)
      .map(p => ROLES[p.roleId])
      .filter(Boolean);

    const hasTag = (tag) => aliveRoles.some(r => r.tags?.includes(tag));

    /* ========= 開場 ========= */
    steps.push({
      id: "night_start",
      type: "info",
      script: "天黑請閉眼。"
    });

    /* ========= 守衛 ========= */
    if (hasTag("canGuard")) {
      steps.push({
        id: "guard",
        type: "select",
        roleTag: "canGuard",
        target: "guardTarget",
        allowSkip: false,
        script: "守衛請睜眼，你要守誰？"
      });
    }

    /* ========= 攝夢人（之後規則層會用） ========= */
    if (hasTag("dreamLock")) {
      steps.push({
        id: "dreamer",
        type: "select",
        roleTag: "dreamLock",
        target: "dreamTarget",
        allowSkip: false,
        script: "攝夢人請睜眼，你要攝誰的夢？"
      });
    }

    /* ========= 狼人 ========= */
    if (hasTag("wolfKill")) {
      steps.push({
        id: "wolf",
        type: "select",
        roleTag: "wolfKill",
        target: "wolfTarget",
        allowSkip: !!settings.wolfCanSkip,
        script: settings.wolfCanSkip
          ? "狼人請睜眼，你們要刀誰？（可空刀）"
          : "狼人請睜眼，你們要刀誰？"
      });
    }

    /* ========= 預言類（預言家 / 石像鬼） ========= */
    if (hasTag("nightCheck")) {
      steps.push({
        id: "seer",
        type: "select",
        roleTag: "nightCheck",
        target: "checkTarget",
        allowSkip: false,
        script: "預言家／石像鬼請睜眼，你要查驗誰？",
        result: "camp" // 給 engine 用：回傳陣營
      });
    }

    /* ========= 女巫（固定彈窗） ========= */
    if (hasTag("save") || hasTag("poison")) {
      steps.push({
        id: "witch",
        type: "panel",
        roleId: "witch",
        script: "女巫請睜眼。"
        // 實際救/毒流程交給 UI + rules
      });
    }

    /* ========= 結束 ========= */
    steps.push({
      id: "night_end",
      type: "resolve",
      script: "天亮請睜眼。"
    });

    return steps;
  }

  // 對外掛載
  window.WW_NIGHT_STEPS = {
    build: buildNightSteps
  };

})();