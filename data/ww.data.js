/* =========================================================
   狼人殺｜資料總匯（唯一入口）
   檔案：data/ww.data.js

   功能：
   - 匯總所有角色資料（基本 + 特殊）
   - 匯總板子（6–12 人）
   - 掛載核心規則引擎
   - 提供 app / flow / UI 的唯一資料來源

   ⚠️ 原則：
   - 任何程式碼「只能讀 WW_DATA」
   - 不可再直接讀 window.WW_ROLES_xxx
========================================================= */

(function () {

  /* =========================
     1️⃣ 角色資料整合
  ========================= */
  const rolesBase = window.WW_ROLES_BASE || {};
  const rolesSpecial = window.WW_ROLES_SPECIAL || {};

  const roles = {
    ...rolesBase,
    ...rolesSpecial
  };

  /* =========================
     2️⃣ 板子資料（6–12 人）
     👉 僅定義「預設配置」
     👉 允許 UI 再修改
  ========================= */
  const boards = {
    basic: {
      id: "basic",
      name: "基本板子（預女獵白）",
      min: 6,
      max: 12,
      presets: {
        6:  { werewolf:2, villager:2, seer:1, witch:1 },
        7:  { werewolf:2, villager:3, seer:1, witch:1 },
        8:  { werewolf:2, villager:3, seer:1, witch:1, hunter:1 },
        9:  { werewolf:3, villager:3, seer:1, witch:1, hunter:1 },
        10: { werewolf:3, villager:4, seer:1, witch:1, hunter:1 },
        11: { werewolf:3, villager:4, seer:1, witch:1, hunter:1, guard:1 },
        12: { werewolf:4, villager:4, seer:1, witch:1, hunter:1, guard:1 }
      }
    },

    special_b1: {
      id: "special_b1",
      name: "特殊板子 B1",
      min: 6,
      max: 12,
      presets: {
        6:  { werewolf:2, villager:1, seer:1, witch:1, knight:1 },
        7:  { werewolf:2, villager:2, seer:1, witch:1, knight:1 },
        8:  { werewolf:2, villager:2, seer:1, witch:1, knight:1, guard:1 },
        9:  { werewolf:3, villager:2, seer:1, witch:1, knight:1, guard:1 },
        10: { werewolf:3, villager:3, seer:1, witch:1, knight:1, guard:1 },
        11: { werewolf:3, villager:3, seer:1, witch:1, knight:1, guard:1, hunter:1 },
        12: { werewolf:4, villager:3, seer:1, witch:1, knight:1, guard:1, hunter:1 }
      },
      allowedRoles: [
        "werewolf","villager",
        "seer","witch","hunter",
        "guard","knight",
        "blackWolfKing","whiteWolfKing"
      ]
    }
  };

  /* =========================
     3️⃣ 預設規則開關（全局）
  ========================= */
  const defaultRules = {
    noConsecutiveGuard: true,
    wolfCanSkip: true,
    witchCannotSelfSave: true,
    hunterPoisonNoShoot: true,
    blackWolfKingPoisonNoSkill: true,
    saveHitsGuardMakesDeath: true
  };

  /* =========================
     4️⃣ 掛載核心規則引擎
  ========================= */
  const rulesCore = window.WW_RULES_CORE;

  if (!rulesCore) {
    console.error("❌ WW_RULES_CORE 尚未載入，請確認 data/rules.core.js");
  }

  /* =========================
     5️⃣ 對外唯一資料出口
  ========================= */
  window.WW_DATA = {
    version: "1.0.0",
    roles,
    rolesBase,
    rolesSpecial,
    boards,
    defaultRules,
    rulesCore
  };

})();
