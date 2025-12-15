/* =========================================================
   Night Steps - Basic Board
   檔案：data/night/night.steps.basic.js
========================================================= */

(function () {
  window.WW_NIGHT_STEPS_BASIC = function (players, nightState, settings = {}) {

    const has = (roleId) => players.some(p => p.roleId === roleId);

    const steps = [];

    // 0. 天黑
    steps.push({
      key: "close",
      type: "info",
      publicScript: "天黑請閉眼。",
      godScript: "天黑請閉眼。"
    });

    // 1. 守衛
    if (has("guard")) {
      steps.push({
        key: "guard",
        type: "pick",
        pickKey: "guardTarget",
        required: true,
        publicScript: "守衛請睜眼，請守一位玩家。",
        godScript: "守衛守誰？（點座位）"
      });
    }

    // 2. 狼人
    steps.push({
      key: "wolf",
      type: "pick",
      pickKey: "wolfTarget",
      required: !settings.wolfCanNoKill,
      allowNull: !!settings.wolfCanNoKill,
      publicScript: settings.wolfCanNoKill
        ? "狼人請睜眼（可空刀），請選擇目標。"
        : "狼人請睜眼，請選擇目標。",
      godScript: settings.wolfCanNoKill
        ? "狼人刀誰？（可不選＝空刀）"
        : "狼人刀誰？（必選）"
    });

    // 3. 預言家
    if (has("seer")) {
      steps.push({
        key: "seer",
        type: "pick",
        pickKey: "seerCheck",
        required: true,
        publicScript: "預言家請睜眼，請查驗一位玩家。",
        godScript: "預言家查誰？（點座位）"
      });
    }

    // 4. 女巫
    if (has("witch")) {
      steps.push({
        key: "witch",
        type: "witch",
        publicScript: "女巫請睜眼。",
        godScript: "女巫回合（救人 / 毒人）"
      });
    }

    // 5. 天亮
    steps.push({
      key: "resolve",
      type: "resolve",
      publicScript: "天亮請睜眼。",
      godScript: "天亮：準備結算夜晚。"
    });

    return steps;
  };
})();