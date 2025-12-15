/* =========================================================
   狼人殺｜資料總匯（唯一入口 v2）
   data/ww.data.js

   原則：
   - 所有資料只從 WW_DATA 讀
   - UI / flow / app 不可硬編角色或規則
   - 先齊「資料正確性」，再優化流程
========================================================= */

(function () {

  /* =========================================================
     1️⃣ 角色資料（先齊全，不管流程）
     team: villager | wolf | third
     night: 是否有夜晚行動（true / false）
  ========================================================= */

  const roles = {

    /* ---------- 基本角色 ---------- */
    villager: {
      id: "villager",
      name: "村民",
      team: "villager",
      icon: "🧑‍🌾",
      night: false
    },

    werewolf: {
      id: "werewolf",
      name: "狼人",
      team: "wolf",
      icon: "🐺",
      night: true
    },

    seer: {
      id: "seer",
      name: "預言家",
      team: "villager",
      icon: "🔮",
      night: true
    },

    witch: {
      id: "witch",
      name: "女巫",
      team: "villager",
      icon: "🧪",
      night: true,
      hasSave: true,
      hasPoison: true
    },

    hunter: {
      id: "hunter",
      name: "獵人",
      team: "villager",
      icon: "🔫",
      night: false,
      deathSkill: true
    },

    guard: {
      id: "guard",
      name: "守衛",
      team: "villager",
      icon: "🛡",
      night: true
    },

    knight: {
      id: "knight",
      name: "騎士",
      team: "villager",
      icon: "⚔️",
      night: false
    },

    /* ---------- 狼人陣營 ---------- */
    blackWolfKing: {
      id: "blackWolfKing",
      name: "黑狼王",
      team: "wolf",
      icon: "🐺👑",
      night: false,
      deathSkill: true
    },

    whiteWolfKing: {
      id: "whiteWolfKing",
      name: "白狼王",
      team: "wolf",
      icon: "🐺⚡",
      night: false,
      deathSkill: true
    },

    /* ---------- 第三方（先佔位） ---------- */
    cupid: {
      id: "cupid",
      name: "邱比特",
      team: "third",
      icon: "💘",
      night: true
    },

    idiot: {
      id: "idiot",
      name: "白痴",
      team: "villager",
      icon: "🤪",
      night: false
    },

    dreamer: {
      id: "dreamer",
      name: "攝夢人",
      team: "villager",
      icon: "🌙",
      night: true
    },

    magician: {
      id: "magician",
      name: "魔術師",
      team: "villager",
      icon: "🎩",
      night: true
    },

    lucky: {
      id: "lucky",
      name: "幸運兒",
      team: "villager",
      icon: "🍀",
      night: false
    },

    demonHunter: {
      id: "demonHunter",
      name: "獵魔人",
      team: "villager",
      icon: "🗡",
      night: true
    },

    ghostKnight: {
      id: "ghostKnight",
      name: "惡靈騎士",
      team: "third",
      icon: "💀⚔️",
      night: true
    },

    gargoyle: {
      id: "gargoyle",
      name: "石像鬼",
      team: "wolf",
      icon: "🗿",
      night: true
    },

    secretLover: {
      id: "secretLover",
      name: "暗戀者",
      team: "third",
      icon: "💔",
      night: false
    }
  };

  /* =========================================================
     2️⃣ 板子（先做「正確配置」）
     - basic：預女獵白
     - special_b1：進階狼王板
     人數：6–12（你指定）
  ========================================================= */

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
      name: "特殊板子 B1（狼王）",
      min: 6,
      max: 12,
      presets: {
        6:  { werewolf:1, blackWolfKing:1, seer:1, witch:1, villager:2 },
        7:  { werewolf:1, blackWolfKing:1, seer:1, witch:1, villager:3 },
        8:  { werewolf:2, blackWolfKing:1, seer:1, witch:1, villager:3 },
        9:  { werewolf:2, blackWolfKing:1, seer:1, witch:1, hunter:1, villager:3 },
        10: { werewolf:2, blackWolfKing:1, whiteWolfKing:1, seer:1, witch:1, hunter:1, villager:3 },
        11: { werewolf:2, blackWolfKing:1, whiteWolfKing:1, seer:1, witch:1, hunter:1, guard:1, villager:3 },
        12: { werewolf:3, blackWolfKing:1, whiteWolfKing:1, seer:1, witch:1, hunter:1, guard:1, villager:3 }
      }
    }
  };

  /* =========================================================
     3️⃣ 預設規則（你指定的全部）
  ========================================================= */

  const defaultRules = {
    noConsecutiveGuard: true,          // 不能連守
    wolfCanSkip: true,                // 狼人可以空刀
    witchCannotSelfSave: true,         // 女巫不能自救
    hunterPoisonNoShoot: true,         // 獵人被毒不能開槍
    blackWolfKingPoisonNoSkill: true,  // 黑狼王被毒不能用技能
    saveHitsGuardMakesDeath: true      // 救同守則奶穿
  };

  /* =========================================================
     4️⃣ 匯出
  ========================================================= */

  window.WW_DATA = {
    version: "2.0.0",
    roles,
    boards,
    defaultRules
  };

})();
