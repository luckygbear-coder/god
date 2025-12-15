/* =========================================================
   狼人殺｜基本板 夜晚步驟表
   檔案：data/night/night.steps.basic.js

   依賴：
   - WW_ROLES
   - WW_RULES_CORE
========================================================= */

(function () {
  const CORE = window.WW_RULES_CORE;

  if (!CORE) {
    console.error("❌ rules.core.js 未載入");
    return;
  }

  function hasAliveRole(players, roleId) {
    return CORE.alive(players).some(p => p.roleId === roleId);
  }

  /**
   * 產生基本板夜晚步驟
   * @param {Array} players
   * @param {Object} rules
   * @param {Object} nightState - 可選：給 UI 判斷女巫刀口顯示
   */
  function build(players, rules = {}, nightState = {}) {
    const steps = [];

    // 0) start
    steps.push({
      id: "night_start",
      type: "info",
      script: "天黑請閉眼。"
    });

    // 1) guard
    if (hasAliveRole(players, "guard")) {
      steps.push({
        id: "guard",
        type: "pick",
        roleId: "guard",
        key: "guardTarget",
        required: true,
        allowSkip: false,
        script: rules.noConsecutiveGuard
          ? "🛡️ 守衛請睜眼，你要守誰？（不能連守）"
          : "🛡️ 守衛請睜眼，你要守誰？"
      });
    }

    // 2) wolves
    if (hasAliveRole(players, "werewolf") || hasAliveRole(players, "blackWolfKing") || hasAliveRole(players, "whiteWolfKing")) {
      steps.push({
        id: "wolf",
        type: "pick",
        roleId: "werewolf",
        key: "wolfTarget",
        required: !rules.wolfCanSkip,
        allowSkip: !!rules.wolfCanSkip,
        script: rules.wolfCanSkip
          ? "🐺 狼人請睜眼，你們要刀誰？（可空刀）"
          : "🐺 狼人請睜眼，你們要刀誰？"
      });
    }

    // 3) seer
    if (hasAliveRole(players, "seer")) {
      steps.push({
        id: "seer",
        type: "pick",
        roleId: "seer",
        key: "checkTarget",
        required: true,
        allowSkip: false,
        script: "🔮 預言家請睜眼，你要查驗誰？"
      });
    }

    // 4) witch panel
    if (hasAliveRole(players, "witch")) {
      steps.push({
        id: "witch",
        type: "panel",
        roleId: "witch",
        // 重要：女巫的 UI 文案由 app/UI 層組合：
        // - 若 witchSaveUsed=true → 不顯示刀口（只能毒/不毒）
        // - 否則顯示「今晚被刀的是 X 號，要不要救？」
        script: "🧪 女巫請睜眼。"
      });
    }

    // 5) end/resolve
    steps.push({
      id: "night_end",
      type: "resolve",
      script: "天亮請睜眼。"
    });

    return steps;
  }

  window.WW_NIGHT_STEPS_BASIC = { build };
})();
