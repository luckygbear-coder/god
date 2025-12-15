/* =========================================================
   狼人殺｜基本角色資料表
   檔案：data/roles/roles.base.js

   使用者板子：
   - basic（預言家、女巫、獵人、守衛、狼人、村民）
========================================================= */

(function () {
  const ROLES = {
    /* =========================
       村民陣營
    ========================= */

    villager: {
      id: "villager",
      name: "村民",
      camp: "villager",
      tags: ["villager"],
      description: "沒有任何特殊能力的普通村民。",
      nightAction: null,
      deathSkill: null
    },

    seer: {
      id: "seer",
      name: "預言家",
      camp: "villager",
      tags: ["check"],
      description: "每晚可查驗一名玩家的陣營。",
      nightAction: {
        type: "check",
        key: "seerCheck"
      },
      deathSkill: null
    },

    witch: {
      id: "witch",
      name: "女巫",
      camp: "villager",
      tags: ["save", "poison"],
      description: "擁有一次解藥與一次毒藥。",
      nightAction: {
        type: "panel",
        saveOnce: true,
        poisonOnce: true
      },
      deathSkill: null
    },

    hunter: {
      id: "hunter",
      name: "獵人",
      camp: "villager",
      tags: ["shoot"],
      description: "死亡時可開槍帶走一人。",
      nightAction: null,
      deathSkill: {
        type: "shoot",
        forbiddenWhenPoisoned: true
      }
    },

    guard: {
      id: "guard",
      name: "守衛",
      camp: "villager",
      tags: ["guard"],
      description: "每晚可守護一人，使其免於狼人傷害。",
      nightAction: {
        type: "guard",
        key: "guardTarget"
      },
      deathSkill: null
    },

    /* =========================
       狼人陣營
    ========================= */

    werewolf: {
      id: "werewolf",
      name: "狼人",
      camp: "wolf",
      tags: ["wolf"],
      description: "每晚與其他狼人共同決定擊殺目標。",
      nightAction: {
        type: "kill",
        key: "wolfTarget",
        allowSkip: true
      },
      deathSkill: null
    }

  };

  window.WW_ROLES_BASE = ROLES;
})();