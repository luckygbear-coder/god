/* =========================================================
   狼人殺｜上帝輔助 PWA
   檔案：/data/roles/roles.index.js

   角色資料合併載入器
   - WW_DATA.rolesBase（必須先載入 roles.base.js）
   - WW_DATA.rolesSpecialB1（可選：載入 roles.special.b1.js）
   產出：
   - WW_DATA.roles（統一角色入口）
========================================================= */

(function () {
  window.WW_DATA = window.WW_DATA || {};

  const base = window.WW_DATA.rolesBase || {};
  const b1   = window.WW_DATA.rolesSpecialB1 || {};

  // 合併（後者可覆蓋前者）
  const merged = Object.assign({}, base, b1);

  // 最終統一入口
  window.WW_DATA.roles = merged;

  // 工具：取角色資料（給 app.js / flow 用）
  window.WW_DATA.getRole = function getRole(roleId) {
    return merged[roleId] || null;
  };

  // 開發期自檢（避免漏載）
  window.WW_DATA.__rolesReady = true;
})();
