/* =========================================================
   狼人殺｜上帝輔助 PWA
   檔案：/data/roles/roles.special.b1.js

   B1 特殊板子角色資料（資料完整優先）
   ⚠️ 僅定義角色「是誰、屬於誰、有什麼能力型態」
   ⚠️ 實際流程 / 結算 / 勝負判定由 rules / flow 接管
========================================================= */

(function () {
  const ROLES_SPECIAL_B1 = {

    /* -------------------------
       白痴（特殊板子也可出現）
    ------------------------- */
    idiot: {
      id: "idiot",
      name: "白痴",
      team: "villager",
      icon: "🤪",
      tags: ["passive", "antiLynch"],
      special: {
        onLynched: "revealAndLoseVote"
      },
      desc: "被票出不死亡，翻牌後失去投票權。"
    },

    /* -------------------------
       攝夢人
       - 夜晚攝夢一人
       - 攝夢成功者通常不能行動 / 或被連動死亡
    ------------------------- */
    dreamer: {
      id: "dreamer",
      name: "攝夢人",
      team: "villager",
      icon: "💤",
      tags: ["nightAct", "control"],
      hasNightAction: true,
      action: {
        type: "pickOne",
        key: "dreamTarget",
        target: "aliveNotSelf"
      },
      desc: "夜晚攝夢一名玩家，影響其行動或生死（依板子規則）。"
    },

    /* -------------------------
       魔術師
       - 常見：交換兩人身分 / 技能干擾
    ------------------------- */
    magician: {
      id: "magician",
      name: "魔術師",
      team: "villager",
      icon: "🎩",
      tags: ["nightAct", "chaos"],
      hasNightAction: true,
      action: {
        type: "pickTwo",
        key: "magicianSwapTargets",
        target: "alive"
      },
      desc: "夜晚選擇兩名玩家，可能交換或干擾其身分/狀態。"
    },

    /* -------------------------
       黑市商人
       - 提供技能/道具交易（高度擴充角色）
    ------------------------- */
    blackMarketDealer: {
      id: "blackMarketDealer",
      name: "黑市商人",
      team: "villager",
      icon: "🛒",
      tags: ["nightAct", "trade"],
      hasNightAction: true,
      action: {
        type: "modalFlow",
        key: "marketPanel"
      },
      desc: "夜晚可與玩家進行能力或道具交換（依板子設定）。"
    },

    /* -------------------------
       幸運兒
       - 常見：死亡時觸發隨機事件
    ------------------------- */
    lucky: {
      id: "lucky",
      name: "幸運兒",
      team: "villager",
      icon: "🍀",
      tags: ["passive", "random"],
      hasNightAction: false,
      special: {
        onDeath: "triggerRandomEffect"
      },
      desc: "出局時可能觸發隨機正面或負面效果。"
    },

    /* -------------------------
       獵魔人
       - 通常對狼陣營有額外效果
    ------------------------- */
    demonHunter: {
      id: "demonHunter",
      name: "獵魔人",
      team: "villager",
      icon: "🏹",
      tags: ["nightAct", "antiWolf"],
      hasNightAction: true,
      action: {
        type: "pickOne",
        key: "demonHunterTarget",
        target: "alive"
      },
      desc: "夜晚狙擊或標記一名玩家，對狼人有額外效果。"
    },

    /* -------------------------
       惡靈騎士（第三方）
       - 常見為第三陣營
    ------------------------- */
    deathKnight: {
      id: "deathKnight",
      name: "惡靈騎士",
      team: "third",
      icon: "💀🏇",
      tags: ["third", "deathSkill"],
      hasNightAction: false,
      deathSkill: {
        type: "pickOne",
        key: "deathKnightRevengeTarget",
        target: "aliveNotSelf"
      },
      desc: "死亡時可詛咒或帶走一名玩家，屬第三方陣營。"
    },

    /* -------------------------
       石像鬼
       - 常見：夜晚偵查 + 不能被守護
    ------------------------- */
    gargoyle: {
      id: "gargoyle",
      name: "石像鬼",
      team: "wolf",
      icon: "🗿",
      tags: ["wolf", "nightAct", "info"],
      hasNightAction: true,
      action: {
        type: "pickOne",
        key: "gargoyleCheckTarget",
        target: "alive"
      },
      special: {
        ignoreGuard: true
      },
      desc: "夜晚查驗玩家，部分規則下不受守衛保護。"
    },

    /* -------------------------
       邱比特
       - 第一夜連結兩人
    ------------------------- */
    cupid: {
      id: "cupid",
      name: "邱比特",
      team: "third",
      icon: "💘",
      tags: ["nightAct", "link"],
      hasNightAction: true,
      action: {
        type: "pickTwo",
        key: "cupidLinkTargets",
        target: "alive"
      },
      desc: "第一夜連結兩名戀人，影響勝負條件。"
    },

    /* -------------------------
       暗戀者
       - 隱性第三方，與戀人系統連動
    ------------------------- */
    secretLover: {
      id: "secretLover",
      name: "暗戀者",
      team: "third",
      icon: "🫶",
      tags: ["passive", "lover"],
      hasNightAction: false,
      special: {
        linkedByCupid: true
      },
      desc: "與戀人系統相關的隱性第三方角色。"
    }
  };

  window.WW_DATA = window.WW_DATA || {};
  window.WW_DATA.rolesSpecialB1 = ROLES_SPECIAL_B1;
})();
