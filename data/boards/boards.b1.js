/* =========================================================
   WW_DATA Boards — Special B1 (6–12 players)
   目標：先讓「特殊板子」有正確預設配置 + 角色可選清單齊全
========================================================= */

(function(){
  window.WW_DATA = window.WW_DATA || {};
  const W = window.WW_DATA;

  W.boards = W.boards || {};

  W.boards.b1 = {
    id: "b1",
    name: "特殊板子 B1",
    playerRange: { min: 6, max: 12 },

    // B1 也沿用你的預設規則開關
    defaultRules: {
      noConsecutiveGuard: true,
      wolfCanSkipKill: true,
      witchCannotSelfSave: true,
      hunterPoisonNoShoot: true,
      blackWolfKingPoisonNoSkill: true,
      guardAndSavePierce: true
    },

    /* ✅ B1 預設配置策略
       - 先讓局可跑：預女獵白固定存在（你要求先齊全再優化流程）
       - 狼人數量：依人數調整
       - 8人以上開始加入擴充角色：guard / knight / 黑狼王 / 白狼王（擇一或多）
       - 第三方角色先不預設強塞（因勝負與流程要特別處理，等 rules 完成再加）
    */
    presets: {
      // 6人：1狼 + 預女獵 + 2民
      6:  { werewolf:1, seer:1, witch:1, hunter:1, villager:2 },

      // 7人：2狼 + 預女獵 + 2民
      7:  { werewolf:2, seer:1, witch:1, hunter:1, villager:2 },

      // 8人：2狼 + 預女獵 + 守衛 + 2民
      8:  { werewolf:2, seer:1, witch:1, hunter:1, guard:1, villager:2 },

      // 9人：2狼 + 預女獵 + 騎士 + 3民
      9:  { werewolf:2, seer:1, witch:1, hunter:1, knight:1, villager:3 },

      // 10人：3狼 + 預女獵 + 守衛 + 騎士 + 2民
      10: { werewolf:3, seer:1, witch:1, hunter:1, guard:1, knight:1, villager:2 },

      // 11人：3狼 + 預女獵 + 守衛 + 騎士 + 3民
      11: { werewolf:3, seer:1, witch:1, hunter:1, guard:1, knight:1, villager:3 },

      // 12人：3狼 + 預女獵 + 守衛 + 騎士 + 黑狼王 + 2民
      // 注意：黑狼王本質是狼陣營角色，你可以把 werewolf 其中一隻改成黑狼王（後續 UI 會做替換）
      12: { werewolf:2, blackWolfKing:1, seer:1, witch:1, hunter:1, guard:1, knight:1, villager:3 }
    },

    // ✅ B1 可選角色（你點名的全部都列入）
    optionalRoles: [
      // 你要先做的擴充
      "guard",
      "knight",
      "blackWolfKing",
      "whiteWolfKing",

      // 你指定要補齊的 B1 角色
      "idiot",              // 白痴
      "dreamEater",         // 攝夢人
      "magician",           // 魔術師
      "blackMarketDealer",  // 黑市商人
      "luckyOne",           // 幸運兒
      "demonHunter",        // 獵魔人
      "hellKnight",         // 惡靈騎士
      "gargoyle",           // 石像鬼
      "cupid",              // 邱比特
      "secretCrush"         // 暗戀者
    ],

    // 工具：取預設配置（若沒有就 fallback）
    getPreset(playerCount){
      const p = this.presets[playerCount];
      if(p) return JSON.parse(JSON.stringify(p));
      // fallback：先用基本板策略，再補一個 guard 作為 B1 氣氛（若人數夠）
      const wolves = playerCount >= 9 ? 2 : 1;
      const fixed = 3; // seer+witch+hunter
      let villager = Math.max(0, playerCount - wolves - fixed);
      const cfg = { werewolf:wolves, seer:1, witch:1, hunter:1, villager };
      if(playerCount >= 8){
        cfg.guard = 1;
        cfg.villager = Math.max(0, cfg.villager - 1);
      }
      return cfg;
    },

    // 工具：檢查配置是否總數=人數
    validateConfig(playerCount, config){
      const total = Object.values(config||{}).reduce((a,b)=>a+(b||0),0);
      return total === playerCount;
    }
  };

})();