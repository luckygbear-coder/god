/* =========================================================
   狼人殺｜板子設定（6–12 人）
   - basic：預女獵白（可選守衛）
   - b1：在 basic 基礎 + 騎士/守衛/黑狼王/白狼王 等
   ✅ 只提供「建議配置」與「可用角色池」
========================================================= */

(function(){
  // 依賴 roles.all.js
  const R = window.WW_ROLES || {};

  // 工具：安全檢查角色是否存在
  const hasRole = (id) => !!R[id];

  // 你要求：先把角色資料齊全，配置先做「可用且正確」
  // 下面配置以「可玩、常見、對局順」為優先（之後你要微調我再改）

  const BOARDS = {
    /* =========================
       基本板：預女獵白（可選守衛）
       - 6~12 人
    ========================= */
    basic: {
      id: "basic",
      name: "基本板（預女獵白）",
      playerRange: [6, 12],
      rolePool: [
        "werewolf","villager","seer","witch","hunter","guard"
      ].filter(hasRole),

      // 規則預設開關（你指定）
      defaultRules: {
        noConsecutiveGuard: true,
        wolfCanSkip: true,
        witchCannotSelfSave: true,
        hunterPoisonNoShoot: true,
        blackWolfKingPoisonNoSkill: true,
        tieSecondNoExile: true
      },

      // 建議配置（總數要等於人數）
      presets: {
        6:  { werewolf:2, seer:1, witch:1, villager:2 },
        7:  { werewolf:2, seer:1, witch:1, hunter:1, villager:2 },
        8:  { werewolf:2, seer:1, witch:1, hunter:1, villager:3 },
        9:  { werewolf:2, seer:1, witch:1, hunter:1, villager:4 },
        10: { werewolf:3, seer:1, witch:1, hunter:1, villager:4 },
        11: { werewolf:3, seer:1, witch:1, hunter:1, guard:1, villager:4 },
        12: { werewolf:3, seer:1, witch:1, hunter:1, guard:1, villager:5 }
      }
    },

    /* =========================
       特殊板 B1（你指定：全做）
       先做「可玩閉環」：在 basic 上擴充強狼/神職/第三方
       - 6~12 人：以 8+ 最完整
    ========================= */
    b1: {
      id: "b1",
      name: "特殊板 B1（擴充）",
      playerRange: [6, 12],

      // B1 可用角色池：把你點名的全部放進去（存在即可）
      rolePool: [
        // 基本
        "werewolf","villager","seer","witch","hunter","guard",
        // 強狼
        "blackWolfKing","whiteWolfKing","stoneGargoyle",
        // 神職
        "idiot","dreamer","magician","blackMarketDealer",
        "luckyMan","demonHunter","evilKnight",
        // 第三方
        "cupid","lover"
      ].filter(hasRole),

      defaultRules: {
        noConsecutiveGuard: true,
        wolfCanSkip: true,
        witchCannotSelfSave: true,
        hunterPoisonNoShoot: true,
        blackWolfKingPoisonNoSkill: true,
        tieSecondNoExile: true
      },

      // B1 建議配置（可玩+合理）
      // 原則：
      // - 6/7 人太擠：只放少量特色
      // - 8~12 人逐步加入強狼/特殊神職/第三方
      presets: {
        6: {
          werewolf:2,
          seer:1,
          witch:1,
          villager:2
        },
        7: {
          werewolf:2,
          seer:1,
          witch:1,
          hunter:1,
          villager:2
        },
        8: {
          werewolf:2,
          blackWolfKing:1,    // 強狼（算狼人方）
          seer:1,
          witch:1,
          hunter:1,
          villager:2
        },
        9: {
          werewolf:2,
          whiteWolfKing:1,
          seer:1,
          witch:1,
          hunter:1,
          guard:1,
          villager:2
        },
        10: {
          werewolf:2,
          blackWolfKing:1,
          whiteWolfKing:1,
          seer:1,
          witch:1,
          hunter:1,
          guard:1,
          villager:2
        },
        11: {
          werewolf:2,
          blackWolfKing:1,
          whiteWolfKing:1,
          stoneGargoyle:1,
          seer:1,
          witch:1,
          hunter:1,
          guard:1,
          villager:2
        },
        12: {
          werewolf:2,
          blackWolfKing:1,
          whiteWolfKing:1,
          stoneGargoyle:1,
          seer:1,
          witch:1,
          hunter:1,
          guard:1,
          idiot:1,          // 加一個特殊神職
          villager:1
        }
      },

      // 你要「特殊板全部都做」：先提供「推薦擴充」清單
      // 之後 UI 可做成：勾角色 → 自動把 villager 換掉
      recommendedAdds: [
        "idiot","dreamer","magician","blackMarketDealer",
        "luckyMan","demonHunter","evilKnight","cupid","lover"
      ].filter(hasRole)
    }
  };

  // 對外掛載（給 app.js / setup 用）
  window.WW_BOARDS = BOARDS;

  // 一個小工具：取建議配置（找不到就回傳 null）
  window.WW_getPreset = function(boardId, playerCount){
    const b = BOARDS[boardId];
    if(!b) return null;
    return b.presets?.[playerCount] ? JSON.parse(JSON.stringify(b.presets[playerCount])) : null;
  };

})();