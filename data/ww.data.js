/* =========================================================
   狼人殺｜WW_DATA 統一資料中樞
   檔案：data/ww.data.js

   功能：
   - 統一彙整 roles / boards / rules / nightSteps / engines
   - 提供安全 fallback（避免 undefined 直接炸）
   - 提供 board bundle 取用介面
========================================================= */

(function () {
  const W = window;

  /* -------------------------------------------------------
     工具
  ------------------------------------------------------- */
  const noop = () => null;
  const warn = (msg) => console.warn("⚠️ WW_DATA:", msg);

  function safe(obj, name) {
    if (!obj) {
      warn(`缺少 ${name}`);
      return {};
    }
    return obj;
  }

  function mergeMaps(...maps) {
    const out = {};
    maps.forEach(m => {
      if (!m) return;
      Object.keys(m).forEach(k => out[k] = m[k]);
    });
    return out;
  }

  /* -------------------------------------------------------
     收集原始資料（來自各檔）
  ------------------------------------------------------- */

  // Roles
  const rolesBase = W.WW_ROLES_BASE || null;
  const rolesB1   = W.WW_ROLES_B1   || null;
  const rolesAll  = mergeMaps(rolesBase, rolesB1);

  // Boards
  const boards = W.WW_BOARDS || null;

  // Rules
  const rulesBasic = W.WW_DATA?.rulesBasic || W.WW_RULES_BASIC || null;
  const rulesB1    = W.WW_DATA?.rulesB1    || W.WW_RULES_B1    || null;

  // Night steps
  const nightStepsBasic = W.WW_NIGHT_STEPS_BASIC || null;
  const nightStepsB1    = W.WW_NIGHT_STEPS_B1    || null;

  // Engines
  const nightEngine = W.WW_NIGHT_ENGINE || null;
  const dayEngine   = W.WW_DAY_ENGINE   || null;
  const winEngine   = W.WW_WIN_ENGINE   || null;

  /* -------------------------------------------------------
     掛載到 WW_DATA
  ------------------------------------------------------- */
  W.WW_DATA = W.WW_DATA || {};

  W.WW_DATA.roles = safe(rolesAll, "roles（roles.base / roles.b1）");
  W.WW_DATA.boards = safe(boards, "boards（boards.config.js）");

  W.WW_DATA.rules = {
    basic: rulesBasic || noop,
    b1:    rulesB1    || noop
  };

  W.WW_DATA.nightSteps = {
    basic: nightStepsBasic || [],
    b1:    nightStepsB1    || []
  };

  W.WW_DATA.engines = {
    night: nightEngine || noop,
    day:   dayEngine   || noop,
    win:   winEngine   || noop
  };

  /* -------------------------------------------------------
     對 UI 最重要的 API
  ------------------------------------------------------- */

  /**
   * 依板子取得完整 bundle
   * @param {string} boardId - "basic" | "b1"
   */
  W.WW_DATA.getBoardBundle = function (boardId) {
    const board = W.WW_DATA.boards?.[boardId];
    if (!board) {
      warn(`找不到板子：${boardId}`);
      return null;
    }

    const rules =
      board.rules === "b1"
        ? W.WW_DATA.rules.b1
        : W.WW_DATA.rules.basic;

    const nightSteps =
      board.nightSteps === "b1"
        ? W.WW_DATA.nightSteps.b1
        : W.WW_DATA.nightSteps.basic;

    return {
      board,
      rules,
      nightSteps
    };
  };

  /**
   * 快速取得角色資料
   */
  W.WW_DATA.getRole = function (roleId) {
    return W.WW_DATA.roles?.[roleId] || null;
  };

  /* -------------------------------------------------------
     健檢輸出
  ------------------------------------------------------- */
  const summary = {
    roles: Object.keys(W.WW_DATA.roles || {}).length,
    boards: Object.keys(W.WW_DATA.boards || {}).length,
    nightSteps: {
      basic: W.WW_DATA.nightSteps.basic.length,
      b1: W.WW_DATA.nightSteps.b1.length
    },
    engines: Object.keys(W.WW_DATA.engines || {}).length
  };

  console.log("✅ WW_DATA ready", summary);

})();