/* =========================================================
   狼人殺｜上帝輔助 PWA
   檔案：/data/roles/roles.base.js

   基本角色全集（先把資料齊全，流程/結算由 rules.core.js 負責）
   內含你已確認的規則關聯欄位：
   - 白痴：被票出不死、失去投票權（2A）
   - 獵人：被毒不能開槍（由全局規則控制）
   - 黑狼王：被毒不能用技能（由全局規則控制）
========================================================= */

(function () {
  const ROLES_BASE = {
    /* -------------------------
       村民
    ------------------------- */
    villager: {
      id: "villager",
      name: "村民",
      team: "villager",
      icon: "🧑‍🌾",
      tags: ["passive"],
      order: 0,
      hasNightAction: false,
      action: { type: "none" },
      desc: "沒有夜晚技能，白天靠推理投票。"
    },

    /* -------------------------
       狼人（群體）
       - 夜晚刀人（可空刀：由 settings.rules.wolfCanSkip 控制）
    ------------------------- */
    werewolf: {
      id: "werewolf",
      name: "狼人",
      team: "wolf",
      icon: "🐺",
      tags: ["nightAct", "kill"],
      order: 20,
      hasNightAction: true,
      action: {
        type: "pickOne",
        key: "wolfTarget",
        target: "aliveNotWolf",     // 建議：UI 可允許點任何存活；規則層可再限制
        allowSkipByRule: "wolfCanSkip"
      },
      desc: "夜晚集體選擇刀一名玩家（是否可空刀由規則決定）。"
    },

    /* -------------------------
       預言家
       - 夜晚驗一人，得知陣營（好人/狼人）
    ------------------------- */
    seer: {
      id: "seer",
      name: "預言家",
      team: "villager",
      icon: "🔮",
      tags: ["nightAct", "info"],
      order: 30,
      hasNightAction: true,
      action: {
        type: "pickOne",
        key: "seerCheckTarget",
        target: "aliveNotSelf",
        allowSkip: false
      },
      desc: "夜晚查驗一名玩家，得知其為狼人或好人（上帝視角顯示）。"
    },

    /* -------------------------
       女巫
       - 彈窗流程：先顯示刀口→救/不救→毒/不毒
       - 解藥/毒藥各一次（由 night.witchSaveUsed / witchPoisonUsed 追蹤）
       - 女巫不能自救：由 settings.rules.witchCannotSelfSave 控制
    ------------------------- */
    witch: {
      id: "witch",
      name: "女巫",
      team: "villager",
      icon: "🧪",
      tags: ["nightAct", "modal", "save", "poison"],
      order: 40,
      hasNightAction: true,
      action: {
        type: "modalFlow",
        key: "witchPanel",
        steps: ["showWolfTarget", "chooseSave", "choosePoison"],
        saveKey: "witchSave",
        poisonKey: "witchPoisonTarget",
        limited: { save: 1, poison: 1 }
      },
      desc: "夜晚可用一次解藥救被刀者、一次毒藥毒一人（是否可自救由規則決定）。"
    },

    /* -------------------------
       獵人
       - 死亡技能：可開槍帶走一人（通常在出局時）
       - 被毒不能開槍：由 settings.rules.hunterPoisonNoShoot 控制
    ------------------------- */
    hunter: {
      id: "hunter",
      name: "獵人",
      team: "villager",
      icon: "🔫",
      tags: ["deathSkill", "shoot"],
      order: 0,
      hasNightAction: false,
      action: { type: "none" },
      deathSkill: {
        type: "pickOne",
        key: "hunterShootTarget",
        target: "aliveNotSelf",
        blockedByRuleIfPoisoned: "hunterPoisonNoShoot"
      },
      desc: "出局時可開槍帶走一名玩家（若被毒則依規則可能不能開槍）。"
    },

    /* -------------------------
       白痴（2A）
       - 被票出：不死亡，但公開身分並失去投票權
       - 之後投票流程應跳過白痴（或禁止投票）
    ------------------------- */
    idiot: {
      id: "idiot",
      name: "白痴",
      team: "villager",
      icon: "🤪",
      tags: ["passive", "antiLynch"],
      order: 0,
      hasNightAction: false,
      action: { type: "none" },
      special: {
        onLynched: "revealAndLoseVote",   // rules.core.js 會用到
        loseVote: true
      },
      desc: "被票出不死亡，公開身分後失去投票權。"
    },

    /* -------------------------
       守衛
       - 夜晚守一人
       - 不能連守：由 settings.rules.noConsecutiveGuard 控制
    ------------------------- */
    guard: {
      id: "guard",
      name: "守衛",
      team: "villager",
      icon: "🛡️",
      tags: ["nightAct", "protect"],
      order: 10,
      hasNightAction: true,
      action: {
        type: "pickOne",
        key: "guardTarget",
        target: "alive",                 // 是否可守自己：你可之後做成規則開關
        allowSkip: false,
        blockedByRuleIfSameAsPrev: "noConsecutiveGuard"
      },
      desc: "夜晚守護一名玩家，可能抵擋狼人刀（不能連守由規則決定）。"
    },

    /* -------------------------
       騎士（先把資料放好）
       - 多數規則為白天技能：可挑戰一人（成功/失敗依規則）
       - MVP 先只「可存在與抽到」，流程稍後接
    ------------------------- */
    knight: {
      id: "knight",
      name: "騎士",
      team: "villager",
      icon: "⚔️",
      tags: ["daySkill"],
      order: 0,
      hasNightAction: false,
      action: { type: "none" },
      daySkill: {
        type: "pickOne",
        key: "knightDuelTarget",
        target: "aliveNotSelf",
        once: true
      },
      desc: "白天可使用一次挑戰技能（流程與判定後續接入）。"
    },

    /* -------------------------
       黑狼王
       - 多數規則：死亡技能可帶走一人
       - 被毒不能用技能：由 settings.rules.blackWolfKingPoisonNoSkill 控制
    ------------------------- */
    blackWolfKing: {
      id: "blackWolfKing",
      name: "黑狼王",
      team: "wolf",
      icon: "🐺👑",
      tags: ["wolf", "deathSkill", "explode"],
      order: 0,
      hasNightAction: false,
      action: { type: "none" },
      deathSkill: {
        type: "pickOne",
        key: "blackWolfKingExplodeTarget",
        target: "aliveNotSelf",
        blockedByRuleIfPoisoned: "blackWolfKingPoisonNoSkill"
      },
      desc: "出局時可帶走一名玩家（若被毒則依規則可能不能使用技能）。"
    },

    /* -------------------------
       白狼王（先把資料放好）
       - 常見：白天自爆帶走一人/或特定時機技能
       - MVP 先只「可存在與抽到」，流程稍後接
    ------------------------- */
    whiteWolfKing: {
      id: "whiteWolfKing",
      name: "白狼王",
      team: "wolf",
      icon: "🐺🤍👑",
      tags: ["wolf", "daySkill"],
      order: 0,
      hasNightAction: false,
      action: { type: "none" },
      daySkill: {
        type: "pickOne",
        key: "whiteWolfKingBoomTarget",
        target: "aliveNotSelf",
        once: true
      },
      desc: "可在白天使用一次自爆/帶人類技能（流程與判定後續接入）。"
    }
  };

  // 匯出到全域（讓 app.js / data loader 讀得到）
  window.WW_DATA = window.WW_DATA || {};
  window.WW_DATA.rolesBase = ROLES_BASE;
})();