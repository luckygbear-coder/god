/* =========================================================
   狼人殺｜統一資料入口（Data Hub）
   檔案：data/ww.data.js

   依賴載入順序（建議在 index.html 依序 script 引入）：
   1) data/roles/roles.base.js
   2) data/roles/roles.b1.js
   3) data/boards/boards.config.js
   4) data/rules/rules.basic.js
   5) data/rules/rules.b1.js
   6) data/night/night.steps.basic.js
   7) data/night/night.steps.b1.js
   8) engine/*.js (night/day/win)
   9) data/ww.data.js   ← 最後載入（本檔）
========================================================= */

(function () {

  function mergeRoles(...maps) {
    const out = {};
    maps.forEach(m => {
      if (!m) return;
      Object.keys(m).forEach(k => out[k] = m[k]);
    });
    return out;
  }

  // Roles
  const rolesBase = window.WW_ROLES_BASE || null;
  const rolesB1 = window.WW_ROLES_B1 || null;
  const rolesAll = mergeRoles(rolesBase, rolesB1);

  // Boards
  const boards = window.WW_BOARDS || null;

  // Rules
  const rulesBasic = window.WW_DATA?.rulesBasic || null;
  const rulesB1 = window.WW_DATA?.rulesB1 || null;

  // Night steps
  const nightStepsBasic = window.WW_NIGHT_STEPS_BASIC || null;
  const nightStepsB1 = window.WW_NIGHT_STEPS_B1 || null;

  // Engines
  const nightEngine = window.WW_NIGHT_ENGINE || null;
  const dayEngine = window.WW_DAY_ENGINE || null;
  const winEngine = window.WW_WIN_ENGINE || null;

  // --- 健檢 ---
  const missing = [];
  if (!rolesBase) missing.push("WW_ROLES_BASE (data/roles/roles.base.js)");
  if (!rolesB1) missing.push("WW_ROLES_B1 (data/roles/roles.b1.js)");
  if (!boards) missing.push("WW_BOARDS (data/boards/boards.config.js)");
  if (!rulesBasic) missing.push("WW_DATA.rulesBasic (data/rules/rules.basic.js)");
  if (!rulesB1) missing.push("WW_DATA.rulesB1 (data/rules/rules.b1.js)");
  if (!nightStepsBasic) missing.push("WW_NIGHT_STEPS_BASIC (data/night/night.steps.basic.js)");
  if (!nightStepsB1) missing.push("WW_NIGHT_STEPS_B1 (data/night/night.steps.b1.js)");
  if (!nightEngine) missing.push("WW_NIGHT_ENGINE (engine/night.engine.js)");
  if (!dayEngine) missing.push("WW_DAY_ENGINE (engine/day.engine.js)");
  if (!winEngine) missing.push("WW_WIN_ENGINE (engine/win.engine.js)");

  if (missing.length) {
    console.warn("⚠️ WW_DATA 依賴缺少：\n" + missing.map(x => " - " + x).join("\n"));
  }

  // 統一掛上 WW_DATA
  window.WW_DATA = window.WW_DATA || {};

  window.WW_DATA.rolesBase = rolesBase || {};
  window.WW_DATA.rolesB1 = rolesB1 || {};
  window.WW_DATA.roles = rolesAll || {};

  window.WW_DATA.boards = boards || {};

  window.WW_DATA.rules = {
    basic: rulesBasic,
    b1: rulesB1
  };

  window.WW_DATA.nightSteps = {
    basic: nightStepsBasic,
    b1: nightStepsB1
  };

  window.WW_DATA.engines = {
    night: nightEngine,
    day: dayEngine,
    win: winEngine
  };

  // 方便 UI 快速取用：依 boardType 取得 rules/steps
  window.WW_DATA.getBoardBundle = function (boardType) {
    const b = window.WW_DATA.boards?.[boardType];
    if (!b) return null;

    const rulesKey = b.rulesKey; // rulesBasic / rulesB1
    const stepsKey = b.nightStepsKey; // WW_NIGHT_STEPS_BASIC / B1

    const rules = window.WW_DATA[rulesKey] || window.WW_DATA.rules?.[boardType] || null;
    const steps = (stepsKey === "WW_NIGHT_STEPS_BASIC")
      ? window.WW_DATA.nightSteps?.basic
      : window.WW_DATA.nightSteps?.b1;

    return { board: b, rules, steps };
  };

  console.log("✅ WW_DATA ready:", {
    roles: Object.keys(window.WW_DATA.roles || {}).length,
    boards: Object.keys(window.WW_DATA.boards || {}).length,
    engines: Object.keys(window.WW_DATA.engines || {}).length
  });

})();