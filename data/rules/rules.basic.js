/* =========================================================
   狼人殺｜基本板規則
   檔案：data/rules/rules.basic.js

   板子：預言家 / 女巫 / 獵人 / 守衛 / 狼人 / 村民
========================================================= */

(function () {
  const CORE = window.WW_RULES_CORE;
  const ROLES = window.WW_ROLES;

  if (!CORE) {
    console.error("❌ rules.core.js 未載入");
    return;
  }

  /* =========================
     夜晚結算（基本板）
  ========================= */
  function resolveNight({ players, night, rules }) {
    const resolved = CORE.resolveNightCommon({
      players,
      night,
      rules
    });

    // 標記實際死亡
    resolved.deaths.forEach(seat => {
      const p = CORE.bySeat(players, seat);
      if (p) p.alive = false;
    });

    return resolved;
  }

  /* =========================
     公告文字（玩家）
  ========================= */
  function buildPublicAnnouncement({ nightNo, resolved }) {
    const deaths = resolved.deaths;

    if (!deaths.length) {
      return `🌤️ 天亮了，昨晚是平安夜。`;
    }

    if (deaths.length === 1) {
      return `🌅 天亮了，昨晚死亡的是：${deaths[0]} 號。`;
    }

    return `🌅 天亮了，昨晚死亡的是：${deaths.join("、")} 號。`;
  }

  /* =========================
     公告文字（上帝）
  ========================= */
  function buildHiddenAnnouncement({ resolved }) {
    const m = resolved.meta;
    const lines = [];

    if (m.killedByWolf) {
      lines.push(`🐺 狼刀：${m.killedByWolf} 號`);
    }

    if (m.blockedByGuard) {
      lines.push(`🛡️ 守衛成功守到目標`);
    }

    if (m.savedByWitch) {
      lines.push(`🧪 女巫使用解藥`);
    }

    if (m.milkPierce) {
      lines.push(`⚠️ 奶穿：守 + 救 同時作用，仍然死亡`);
    }

    if (m.poisonDeaths?.length) {
      lines.push(`☠️ 女巫毒：${m.poisonDeaths.join("、")} 號`);
    }

    if (!lines.length) {
      lines.push("（本夜無隱藏事件）");
    }

    return lines.join("\n");
  }

  /* =========================
     技能觸發（死亡後）
     - 獵人
     - 黑狼王（雖然基本板未啟用，但先保留）
  ========================= */
  function collectDeathSkills({ players, resolved, rules }) {
    const skills = [];

    resolved.deaths.forEach(seat => {
      const p = CORE.bySeat(players, seat);
      if (!p) return;

      // 獵人
      if (p.roleId === "hunter") {
        const poisoned = CORE.isPoisonDeath(resolved, seat);
        if (poisoned && rules?.hunterPoisonNoShoot) {
          skills.push({
            roleId: "hunter",
            seat,
            disabled: true,
            reason: "被毒，不能開槍"
          });
        } else {
          skills.push({
            roleId: "hunter",
            seat,
            disabled: false
          });
        }
      }

      // 黑狼王（若有）
      if (p.roleId === "blackWolfKing") {
        const poisoned = CORE.isPoisonDeath(resolved, seat);
        if (poisoned && rules?.blackWolfKingPoisonNoSkill) {
          skills.push({
            roleId: "blackWolfKing",
            seat,
            disabled: true,
            reason: "被毒，不能使用技能"
          });
        } else {
          skills.push({
            roleId: "blackWolfKing",
            seat,
            disabled: false
          });
        }
      }
    });

    return skills;
  }

  /* =========================
     勝負判定（基本板）
  ========================= */
  function checkWin(players) {
    const alive = CORE.alive(players);

    const wolves = alive.filter(p => p.roleId === "werewolf");
    const good = alive.filter(p => {
      const r = ROLES[p.roleId];
      return r?.camp === "villager";
    });

    if (!wolves.length) {
      return {
        winner: "villager",
        reason: "所有狼人已被放逐"
      };
    }

    if (wolves.length >= good.length) {
      return {
        winner: "wolf",
        reason: "狼人數量已達或超過好人"
      };
    }

    return null;
  }

  /* =========================
     對外掛載
  ========================= */
  window.WW_RULES_BASIC = {
    resolveNight,
    buildPublicAnnouncement,
    buildHiddenAnnouncement,
    collectDeathSkills,
    checkWin
  };
})();
