/* =========================================================
   data/roles/roles.all.js
   角色資料全集（Basic + B1 + 特殊角色）
========================================================= */

(function(){
  window.WW_DATA = window.WW_DATA || {};

  const roles = {

    /* =========================
       基本角色（Basic）
    ========================= */
    werewolf: {
      id:"werewolf",
      name:"狼人",
      team:"wolf",
      icon:"🐺",
      desc:"每晚可共同刀一名玩家（依規則可空刀）。",
      nightAction:true
    },

    villager: {
      id:"villager",
      name:"村民",
      team:"villager",
      icon:"🧑‍🌾",
      desc:"沒有技能，依靠推理找出狼人。"
    },

    seer: {
      id:"seer",
      name:"預言家",
      team:"villager",
      icon:"🔮",
      desc:"每晚可查驗一名玩家的陣營（好人/狼人）。",
      nightAction:true
    },

    witch: {
      id:"witch",
      name:"女巫",
      team:"villager",
      icon:"🧪",
      desc:"擁有一次解藥與一次毒藥。依規則可能不能自救。",
      nightAction:true
    },

    hunter: {
      id:"hunter",
      name:"獵人",
      team:"villager",
      icon:"🔫",
      desc:"死亡時可帶走一名玩家（被毒依規則可能不能開槍）。",
      deathSkill:true
    },

    guard: {
      id:"guard",
      name:"守衛",
      team:"villager",
      icon:"🛡️",
      desc:"每晚可守護一名玩家，依規則不能連守同一人。",
      nightAction:true
    },

    /* =========================
       B1 擴充角色
    ========================= */
    knight: {
      id:"knight",
      name:"騎士",
      team:"villager",
      icon:"⚔️",
      desc:"白天可指定一名玩家對決，失敗者出局（依桌規）。",
      daySkill:true
    },

    blackWolfKing: {
      id:"blackWolfKing",
      name:"黑狼王",
      team:"wolf",
      icon:"🐺👑",
      desc:"死亡時可帶走一名玩家（被毒依規則不能發動）。",
      deathSkill:true
    },

    whiteWolfKing: {
      id:"whiteWolfKing",
      name:"白狼王",
      team:"wolf",
      icon:"🐺⚪",
      desc:"擁有特殊爆發技能（多為白天/特定時機）。",
      daySkill:true
    },

    /* =========================
       特殊角色（資料先齊全）
    ========================= */

    idiot: {
      id:"idiot",
      name:"白痴",
      team:"villager",
      icon:"🤪",
      desc:"被票出時不死亡，但失去投票權。",
      passive:true
    },

    dreamer: {
      id:"dreamer",
      name:"攝夢人",
      team:"villager",
      icon:"💤",
      desc:"夜晚可攝夢一名玩家，影響其夜晚行動（依版本）。",
      nightAction:true
    },

    magician: {
      id:"magician",
      name:"魔術師",
      team:"villager",
      icon:"🎩",
      desc:"可干擾夜晚目標指向（依版本）。",
      nightAction:true
    },

    blackMarketDealer: {
      id:"blackMarketDealer",
      name:"黑市商人",
      team:"third",
      icon:"💰",
      desc:"可與他人交易能力，目標是存活到最後。",
      daySkill:true
    },

    luckyOne: {
      id:"luckyOne",
      name:"幸運兒",
      team:"villager",
      icon:"🍀",
      desc:"第一次成為死亡目標時可能免疫。",
      passive:true
    },

    demonHunter: {
      id:"demonHunter",
      name:"獵魔人",
      team:"villager",
      icon:"🔥",
      desc:"對特定邪惡角色有額外效果。",
      passive:true
    },

    ghostRider: {
      id:"ghostRider",
      name:"惡靈騎士",
      team:"third",
      icon:"🏍️",
      desc:"死亡時可能轉化為其他狀態（依版本）。",
      deathSkill:true
    },

    gargoyle: {
      id:"gargoyle",
      name:"石像鬼",
      team:"third",
      icon:"🗿",
      desc:"夜晚可能免疫行動，白天可甦醒。",
      passive:true
    },

    cupid: {
      id:"cupid",
      name:"邱比特",
      team:"villager",
      icon:"💘",
      desc:"第一夜連結兩名戀人，戀人一死另一人殉情。",
      nightAction:true
    },

    admirer: {
      id:"admirer",
      name:"暗戀者",
      team:"third",
      icon:"💔",
      desc:"暗戀某位玩家，依存活情況改變勝負條件。",
      passive:true
    }
  };

  window.WW_DATA.rolesAll = roles;
  // 與舊程式相容
  window.WW_DATA.roles = roles;
})();
