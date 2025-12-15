/* =========================================================
   Rules - B1 Board
   檔案：data/rules/rules.b1.js

   目前：沿用 basic 夜晚結算（確保流程穩）
   - 黑狼王/白狼王的「主動技能」先不在夜晚算
   - 死亡技能是否被毒禁用：用 canTriggerDeathSkill 控制
========================================================= */

(function () {
  // 直接重用 basic（若 basic 未載入，也提供自含版本）
  const basic = window.WW_RULES_BASIC;

  if (basic) {
    window.WW_RULES_B1 = {
      resolveNight: basic.resolveNight,
      buildAnnouncement: basic.buildAnnouncement,
      canTriggerDeathSkill: basic.canTriggerDeathSkill,
      exportPayload: basic.exportPayload,
    };
    return;
  }

  // fallback（幾乎不會進到這）
  window.WW_RULES_B1 = {
    resolveNight: ({ players }) => ({ deaths: [], seer: { target: null, result: null }, meta: { reasons:["B1 rules fallback"] } }),
    buildAnnouncement: ({ nightNo, dayNo }) => ({ publicText: `第${nightNo}夜結束（B1 fallback）`, hiddenText: `第${dayNo}天` }),
    canTriggerDeathSkill: () => true,
    exportPayload: ({ state }) => ({ exportedAt: new Date().toISOString(), state }),
  };
})();