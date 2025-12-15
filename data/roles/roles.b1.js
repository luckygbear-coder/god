/* =========================================================
   狼人殺｜特殊板子 B1 角色資料表
   檔案：data/roles/roles.b1.js

   注意：
   - 本檔僅描述角色「是誰」
   - 不處理流程、不處理判定
========================================================= */

(function () {

  const ROLES = {

    /* =========================
       狼人陣營（強化）
    ========================= */

    blackWolfKing: {
      id: "blackWolfKing",
      name: "黑狼王",
      camp: "wolf",
      tags: ["wolf", "deathSkill"],
      description: "死亡時可帶走一名玩家。",
      nightAction: {
        type: "kill",
        key: "wolfTarget"
      },
      deathSkill: {
        type: "explode",
        forbiddenWhenPoisoned: true
      },
      winConditionHint: "屬於狼人陣營"
    },

    whiteWolfKing: {
      id: "whiteWolfKing",
      name: "白狼王",
      camp: "wolf",
      tags: ["wolf", "suicideKill"],
      description: "白天可自爆帶走一名玩家。",
      nightAction: null,
      deathSkill: {
        type: "suicideKill",
        daytimeOnly: true
      },
      winConditionHint: "屬於狼人陣營"
    },

    /* =========================
       村民陣營（特殊能力）
    ========================= */

    knight: {
      id: "knight",
      name: "騎士",
      camp: "villager",
      tags: ["challenge"],
      description: "白天可指定一人決鬥，輸者出局。",
      nightAction: null,
      deathSkill: null
    },

    idiot: {
      id: "idiot",
      name: "白痴",
      camp: "villager",
      tags: ["immuneVote"],
      description: "被投票出局時不死亡，但失去投票權。",
      nightAction: null,
      deathSkill: null
    },

    demonHunter: {
      id: "demonHunter",
      name: "獵魔人",
      camp: "villager",
      tags: ["antiThird"],
      description: "夜晚可查驗是否為第三方角色。",
      nightAction: {
        type: "checkThird",
        key: "demonCheck"
      },
      deathSkill: null
    },

    magician: {
      id: "magician",
      name: "魔術師",
      camp: "villager",
      tags: ["swap"],
      description: "第一夜可交換兩名玩家的身分。",
      nightAction: {
        type: "swap",
        firstNightOnly: true
      },
      deathSkill: null
    },

    dreamEater: {
      id: "dreamEater",
      name: "攝夢人",
      camp: "villager",
      tags: ["sleep"],
      description: "每晚可使一名玩家進入夢境，隔天無法發言。",
      nightAction: {
        type: "sleep",
        key: "sleepTarget"
      },
      deathSkill: null
    },

    /* =========================
       第三方陣營
    ========================= */

    cupid: {
      id: "cupid",
      name: "邱比特",
      camp: "third",
      tags: ["link"],
      description: "第一夜連結兩名戀人。",
      nightAction: {
        type: "link",
        firstNightOnly: true
      },
      deathSkill: null,
      winConditionHint: "戀人雙方存活至最後"
    },

    admirer: {
      id: "admirer",
      name: "暗戀者",
      camp: "third",
      tags: ["soloLove"],
      description: "單戀一名玩家，若其死亡則失去勝利條件。",
      nightAction: {
        type: "chooseLove",
        firstNightOnly: true
      },
      deathSkill: null,
      winConditionHint: "暗戀對象存活至最後"
    },

    evilKnight: {
      id: "evilKnight",
      name: "惡靈騎士",
      camp: "third",
      tags: ["revenge"],
      description: "被殺死時標記兇手，下一個夜晚兇手死亡。",
      nightAction: null,
      deathSkill: {
        type: "revenge"
      },
      winConditionHint: "完成復仇後存活"
    },

    stoneGargoyle: {
      id: "stoneGargoyle",
      name: "石像鬼",
      camp: "third",
      tags: ["selfCheck"],
      description: "夜晚可查驗一名玩家是否為狼人。",
      nightAction: {
        type: "checkWolf",
        key: "gargoyleCheck"
      },
      deathSkill: null,
      winConditionHint: "存活至最後"
    },

    blackMarketDealer: {
      id: "blackMarketDealer",
      name: "黑市商人",
      camp: "third",
      tags: ["trade"],
      description: "可與其他玩家交換能力或狀態。",
      nightAction: {
        type: "trade"
      },
      deathSkill: null,
      winConditionHint: "存活至最後"
    },

    luckyOne: {
      id: "luckyOne",
      name: "幸運兒",
      camp: "villager",
      tags: ["reroll"],
      description: "首次死亡判定時可免死一次。",
      nightAction: null,
      deathSkill: {
        type: "avoidOnce"
      }
    }

  };

  window.WW_ROLES_B1 = ROLES;

})();
