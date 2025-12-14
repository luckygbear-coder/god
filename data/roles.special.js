/* =========================================================
   狼人殺｜角色資料（特殊角色）
   檔案：data/roles.special.js
   說明：
   - 僅定義「特殊角色資料」
   - 不包含流程、不包含結算
   - 可自由被 boards / flow / rules 引用
========================================================= */

(function () {
  const ROLES_SPECIAL = {
    guard: {
      id: "guard",
      name: "守衛",
      team: "villager",
      icon: "🛡",
      night: true,
      description:
        "夜晚守護一名玩家，使其不會被狼人殺害。不可連續守同一人（預設）。",
      order: 20,
      rules: {
        noConsecutiveGuard: true
      }
    },

    knight: {
      id: "knight",
      name: "騎士",
      team: "villager",
      icon: "⚔️",
      night: false,
      description:
        "白天可公開決鬥一名玩家。若對方是狼人，狼人直接出局；否則騎士出局。",
      order: 10,
      daySkill: true
    },

    blackWolfKing: {
      id: "blackWolfKing",
      name: "黑狼王",
      team: "wolf",
      icon: "🐺👑",
      night: true,
      description:
        "死亡時可帶走一名玩家。若被女巫毒殺，則不能發動技能。",
      order: 25,
      deathSkill: true,
      rules: {
        poisonDisablesSkill: true
      }
    },

    whiteWolfKing: {
      id: "whiteWolfKing",
      name: "白狼王",
      team: "wolf",
      icon: "🐺🤍",
      night: true,
      description:
        "夜晚可自爆帶走一名玩家（通常限一次）。",
      order: 26,
      activeSkill: true,
      limit: 1
    },

    cupid: {
      id: "cupid",
      name: "邱比特",
      team: "villager",
      icon: "💘",
      night: true,
      description:
        "第一夜指定兩名玩家成為情侶。情侶一方死亡，另一方殉情。",
      order: 5,
      firstNightOnly: true,
      thirdPartyPossible: true
    },

    admirer: {
      id: "admirer",
      name: "暗戀者",
      team: "third",
      icon: "🖤",
      night: false,
      description:
        "暗戀一名玩家。若暗戀對象死亡，暗戀者殉情。",
      order: 96,
      passive: true,
      thirdParty: true
    },

    lucky: {
      id: "lucky",
      name: "幸運兒",
      team: "villager",
      icon: "🍀",
      night: false,
      description:
        "第一次成為狼刀目標時不會死亡。",
      order: 97,
      passive: true,
      oneTimeShield: true
    },

    dreamer: {
      id: "dreamer",
      name: "攝夢人",
      team: "villager",
      icon: "🌙",
      night: true,
      description:
        "夜晚選擇一名玩家，使其隔天無法行動（依板子規則）。",
      order: 35,
      controlSkill: true
    },

    magician: {
      id: "magician",
      name: "魔術師",
      team: "villager",
      icon: "🎩",
      night: true,
      description:
        "可交換兩名玩家的身分或座位（依板子規則）。",
      order: 45,
      complexSkill: true
    },

    demonHunter: {
      id: "demonHunter",
      name: "獵魔人",
      team: "villager",
      icon: "🔥",
      night: true,
      description:
        "夜晚標記一名玩家，若其為狼人，將在日後被處決。",
      order: 55
    },

    evilKnight: {
      id: "evilKnight",
      name: "惡靈騎士",
      team: "third",
      icon: "💀⚔️",
      night: true,
      description:
        "第三方陣營角色，依特定條件獲勝。",
      order: 60,
      thirdParty: true
    },

    gargoyle: {
      id: "gargoyle",
      name: "石像鬼",
      team: "third",
      icon: "🗿",
      night: true,
      description:
        "夜晚可查驗玩家是否行動過，屬第三方陣營。",
      order: 65,
      thirdParty: true
    },

    blackMarketDealer: {
      id: "blackMarketDealer",
      name: "黑市商人",
      team: "third",
      icon: "💰",
      night: true,
      description:
        "可交易或干擾他人技能，具高度擴充性。",
      order: 70,
      thirdParty: true
    }
  };

  window.WW_ROLES_SPECIAL = ROLES_SPECIAL;
})();
