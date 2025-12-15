/* =========================================================
   狼人殺｜特殊板 B1 夜晚步驟表
   檔案：data/night/night.steps.b1.js

   依賴：
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
   * 產生 B1 夜晚步驟
   * @param {Array} players
   * @param {Object} rules
   * @param {Object} nightState - 可選：給 UI 判斷首夜、女巫顯示
   * @param {Object} meta - 可選：用於傳入「是否已連線」
   */
  function build(players, rules = {}, nightState = {}, meta = {}) {
    const steps = [];

    const isFirstNight = (nightState.nightNo ?? 1) === 1;

    // 0) start
    steps.push({
      id: "night_start",
      type: "info",
      script: "天黑請閉眼。"
    });

    // 1) cupid（首夜）
    // 這步不會卡，engine/UI 只要支援「選兩個座位」即可
    if (isFirstNight && hasAliveRole(players, "cupid")) {
      steps.push({
        id: "cupid_link",
        type: "pick2",
        roleId: "cupid",
        key: "loversLink",
        required: true,
        allowSkip: false,
        script: "💘 邱比特請睜眼，請指定兩位成為暗戀者（情侶）。"
      });
    }

    // 2) guard
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

    // 3) wolves（包含強狼也視作狼方夜刀）
    if (
      hasAliveRole(players, "werewolf") ||
      hasAliveRole(players, "blackWolfKing") ||
      hasAliveRole(players, "whiteWolfKing")
    ) {
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

    // 4) seer（如果 B1 仍有預言家）
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

    // 5) gargoyle（石像鬼：夜晚查驗）
    if (hasAliveRole(players, "stoneGargoyle")) {
      steps.push({
        id: "gargoyle_check",
        type: "pick",
        roleId: "stoneGargoyle",
        key: "gargoyleTarget",
        required: true,
        allowSkip: false,
        script: "🗿 石像鬼請睜眼，你要查驗誰？"
      });
    }

    // 6) witch panel
    if (hasAliveRole(players, "witch")) {
      steps.push({
        id: "witch",
        type: "panel",
        roleId: "witch",
        script: "🧪 女巫請睜眼。"
      });
    }

    // 7) end/resolve
    steps.push({
      id: "night_end",
      type: "resolve",
      script: "天亮請睜眼。"
    });

    return steps;
  }

  window.WW_NIGHT_STEPS_B1 = { build };
})();
