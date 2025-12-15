/* =========================================================
   WW_DATA Boards — Basic (6–12 players)
   核心：預言家 / 女巫 / 獵人 / 村民 / 狼人
   擴充（先占位）：守衛 / 騎士 / 黑狼王 / 白狼王
========================================================= */

(function(){
  window.WW_DATA = window.WW_DATA || {};
  const W = window.WW_DATA;

  W.boards = W.boards || {};
  W.boards.basic = {
    id: "basic",
    name: "基本板子",
    playerRange: { min: 6, max: 12 },

    // ✅ 你指定的預設規則開關（之後 rules.core.js 會吃這些）
    defaultRules: {
      noConsecutiveGuard: true,        // 守衛不能連守
      wolfCanSkipKill: true,           // 狼人可以空刀
      witchCannotSelfSave: true,       // 女巫不能自救
      hunterPoisonNoShoot: true,       // 獵人被毒不能開槍
      blackWolfKingPoisonNoSkill: true,// 黑狼王被毒不能用技能

      // 你提到的：救同守則奶穿沒有平安夜（常見：同守同救穿透）
      // 先以開關保留，後續在 rules.core.js 具體定義
      guardAndSavePierce: true
    },

    // ✅ 6–12 人：預設配置（總數=人數）
    // 你之後 UI 要可修改：就以此為初始值
    presets: {
      // 6人：1狼 + 預女獵 + 2民
      6:  { werewolf:1, seer:1, witch:1, hunter:1, villager:2 },

      // 7人：2狼 + 預女獵 + 2民
      7:  { werewolf:2, seer:1, witch:1, hunter:1, villager:2 },

      // 8人：2狼 + 預女獵 + 3民
      8:  { werewolf:2, seer:1, witch:1, hunter:1, villager:3 },

      // 9人：2狼 + 預女獵 + 4民（你點名的常用）
      9:  { werewolf:2, seer:1, witch:1, hunter:1, villager:4 },

      // 10人：3狼 + 預女獵 + 4民
      10: { werewolf:3, seer:1, witch:1, hunter:1, villager:4 },

      // 11人：3狼 + 預女獵 + 5民
      11: { werewolf:3, seer:1, witch:1, hunter:1, villager:5 },

      // 12人：3狼 + 預女獵 + 6民（或 4狼+5民，你之後可在 UI 改）
      12: { werewolf:3, seer:1, witch:1, hunter:1, villager:6 }
    },

    // ✅ 提供擴充角色清單（UI 可做勾選）
    // 這裡不強制套用，只是讓你「可選」並且資料一致
    optionalRoles: [
      "guard",
      "knight",
      "blackWolfKing",
      "whiteWolfKing"
    ],

    // 工具：取預設配置（若沒有就 fallback）
    getPreset(playerCount){
      const p = this.presets[playerCount];
      if(p) return JSON.parse(JSON.stringify(p));
      // fallback：>=9 2狼 else 1狼，固定 預女獵
      const wolves = playerCount >= 9 ? 2 : 1;
      const fixed = 3; // seer+witch+hunter
      const villager = Math.max(0, playerCount - wolves - fixed);
      return { werewolf:wolves, seer:1, witch:1, hunter:1, villager };
    }
  };

})();