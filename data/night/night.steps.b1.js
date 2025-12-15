/* =========================================================
   Night Steps - B1 Board
   檔案：data/night/night.steps.b1.js
========================================================= */

(function () {
  window.WW_NIGHT_STEPS_B1 = function (players, nightState, settings = {}) {

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
        godScript: "守衛守誰？"
      });
    }

    // 2. 狼人（含黑狼王 / 白狼王）
    steps.push({
      key: "wolf",
      type: "pick",
      pickKey: "wolfTarget",
      required: !settings.wolfCanNoKill,
      allowNull: !!settings.wolfCanNoKill,
      publicScript: settings.wolfCanNoKill
        ? "狼人請睜眼（可空刀），請選擇目標。"
        : "狼人請睜眼，請選擇目標。",
      godScript: "狼人今晚刀誰？"
    });

    // 3. 預言家
    if (has("seer")) {
      steps.push({
        key: "seer",
        type: "pick",
        pickKey: "seerCheck",
        required: true,
        publicScript: "預言家請睜眼，請查驗一位玩家。",
        godScript: "預言家查誰？"
      });
    }

    // 4. 女巫
    if (has("witch")) {
      steps.push({
        key: "witch",
        type: "witch",
        publicScript: "女巫請睜眼。",
        godScript: "女巫回合（救 / 毒）"
      });
    }

    // 5. 騎士（夜行版，若你之後改成白天也 OK）
    if (has("knight")) {
      steps.push({
        key: "knight",
        type: "pick",
        pickKey: "knightTarget",
        required: false,
        publicScript: "騎士請睜眼（若要行動）。",
        godScript: "騎士要帶誰？（可不選）"
      });
    }

    // 6. 天亮
    steps.push({
      key: "resolve",
      type: "resolve",
      publicScript: "天亮請睜眼。",
      godScript: "天亮，進行結算。"
    });

    return steps;
  };
})();