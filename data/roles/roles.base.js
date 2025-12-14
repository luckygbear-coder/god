/* =========================================================
   狼人殺｜角色資料（基本板子）
   檔案：/data/roles/roles.base.js

   - 只放「角色定義」：名稱、陣營、icon、夜晚是否出手、提示文案
   - 不放流程邏輯（流程會在 /data/flow）
   - 全域掛載：window.WW_DATA.rolesBase
========================================================= */

(() => {
  const root = (window.WW_DATA = window.WW_DATA || {});

  root.rolesBase = {
    werewolf: {
      id: "werewolf",
      name: "狼人",
      team: "wolf",
      icon: "🐺",
      tags: ["夜晚行動", "刀人"],
      nightAction: "wolfKill",
      godHints: {
        short: "狼人睜眼，刀誰？",
        say: "請說：「狼人請睜眼，你們要刀誰？」"
      },
      playerHints: {
        short: "夜晚選擇一名玩家作為目標。",
      }
    },

    villager: {
      id: "villager",
      name: "村民",
      team: "villager",
      icon: "🧑‍🌾",
      tags: ["無夜晚技能"],
      nightAction: null,
      godHints: {
        short: "村民無夜晚行動",
        say: "（村民無夜晚行動）"
      },
      playerHints: {
        short: "白天靠推理找出狼人。",
      }
    },

    seer: {
      id: "seer",
      name: "預言家",
      team: "villager",
      icon: "🔮",
      tags: ["夜晚行動", "查驗"],
      nightAction: "seerCheck",
      godHints: {
        short: "預言家睜眼，驗誰？",
        say: "請說：「預言家請睜眼，你要查驗誰？」",
        resultSayGood: "請說：「他的身分是——好人。」",
        resultSayWolf: "請說：「他的身分是——狼人。」"
      },
      playerHints: {
        short: "夜晚查驗一名玩家陣營（好人/狼人）。",
      }
    },

    witch: {
      id: "witch",
      name: "女巫",
      team: "villager",
      icon: "🧪",
      tags: ["夜晚行動", "解藥一次", "毒藥一次"],
      nightAction: "witch",
      resources: {
        antidote: 1,
        poison: 1
      },
      godHints: {
        short: "女巫睜眼，用藥？",
        say: "請說：「女巫請睜眼，今晚被刀的是 X 號，你要用解藥/毒藥嗎？」"
      },
      playerHints: {
        short: "解藥可救狼刀目標（一次）；毒藥可毒一人（一次）。",
      }
    },

    hunter: {
      id: "hunter",
      name: "獵人",
      team: "villager",
      icon: "🔫",
      tags: ["死亡技能", "開槍帶走一人"],
      nightAction: null,
      deathAction: "hunterShoot",
      godHints: {
        short: "獵人死亡可開槍",
        say: "請說：「獵人是否開槍？你要帶走誰？」"
      },
      playerHints: {
        short: "若因處刑/狼刀死亡（依規則），可開槍帶走一人。",
      }
    },

    guard: {
      id: "guard",
      name: "守衛",
      team: "villager",
      icon: "🛡",
      tags: ["夜晚行動", "守護一人"],
      nightAction: "guardProtect",
      godHints: {
        short: "守衛睜眼，守誰？",
        say: "請說：「守衛請睜眼，你要守誰？」"
      },
      playerHints: {
        short: "夜晚守護一人，若守到狼刀目標可擋刀（MVP 規則）。",
      }
    }
  };

  // 方便其它檔案取用的合併入口（之後 roles.special.js 會再補進去）
  root.roles = Object.assign({}, root.rolesBase, root.rolesSpecial || {});
})();
