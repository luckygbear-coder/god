/* =========================================================
   狼人殺｜板子配置（基本板子）
   檔案：/data/boards/board.basic.js

   - 只放「人數 → 建議配置」
   - 不放流程與結算邏輯
   - 之後想換你的常用板子，只改這裡
   - 全域掛載：window.WW_DATA.boardsBasic
========================================================= */

(() => {
  const root = (window.WW_DATA = window.WW_DATA || {});

  // helper：快速產生配置
  const cfg = ({ wolf, villager, seer=1, witch=1, hunter=1, guard=0 }) => ({
    werewolf: wolf,
    villager,
    seer,
    witch,
    hunter,
    guard
  });

  // 你可依自己習慣調整每個人數配置
  root.boardsBasic = {
    id: "basic",
    name: "基本板子",
    playerMin: 6,
    playerMax: 16,

    // 人數 -> 配置
    presets: {
      6:  cfg({ wolf:1, villager:2, seer:1, witch:1, hunter:1, guard:0 }),
      7:  cfg({ wolf:2, villager:2, seer:1, witch:1, hunter:1, guard:0 }),
      8:  cfg({ wolf:2, villager:3, seer:1, witch:1, hunter:1, guard:0 }),
      9:  cfg({ wolf:2, villager:4, seer:1, witch:1, hunter:1, guard:0 }),
      10: cfg({ wolf:3, villager:4, seer:1, witch:1, hunter:1, guard:0 }),
      11: cfg({ wolf:3, villager:4, seer:1, witch:1, hunter:1, guard:1 }),
      12: cfg({ wolf:3, villager:5, seer:1, witch:1, hunter:1, guard:1 }),
      13: cfg({ wolf:4, villager:5, seer:1, witch:1, hunter:1, guard:1 }),
      14: cfg({ wolf:4, villager:6, seer:1, witch:1, hunter:1, guard:1 }),
      15: cfg({ wolf:4, villager:7, seer:1, witch:1, hunter:1, guard:1 }),
      16: cfg({ wolf:5, villager:7, seer:1, witch:1, hunter:1, guard:1 })
    },

    // 若玩家數不在 presets，給一個 fallback（避免報錯）
    fallback(playerCount){
      // 通用推估：>=9 用 2 狼、>=10 用 3 狼
      const wolf = playerCount >= 13 ? 4 : (playerCount >= 10 ? 3 : 2);
      const guard = playerCount >= 11 ? 1 : 0;
      const fixed = 1 + 1 + 1 + guard; // 預/女/獵/守
      const villager = Math.max(0, playerCount - wolf - fixed);
      return cfg({ wolf, villager, seer:1, witch:1, hunter:1, guard });
    }
  };

  // 方便 app.js 直接用
  root.boards = Object.assign({}, root.boards || {}, { basic: root.boardsBasic });
})();
