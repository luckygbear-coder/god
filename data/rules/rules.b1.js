/* =========================================================
   狼人殺｜特殊板 B1 規則
   檔案：data/rules/rules.b1.js

   目標：
   ✅ 夜晚結算（沿用 core：狼刀/守衛/女巫救毒/奶穿）
   ✅ 強狼技能限制（被毒禁用）
   ✅ 第三方勝負判定骨架（邱比特/暗戀者）
   ✅ 產生公告（玩家/上帝）
========================================================= */

(function () {
  const CORE = window.WW_RULES_CORE;
  const ROLES = window.WW_ROLES;

  if (!CORE) {
    console.error("❌ rules.core.js 未載入");
    return;
  }

  /* =========================
     夜晚結算（B1）
     - 目前仍採用 core 的 common 結算（MVP）
     - 後續 B1 角色特殊技能（如石像鬼查驗、白狼王炸）會在 engine/skills 加
  ========================= */
  function resolveNight({ players, night, rules }) {
    const resolved = CORE.resolveNightCommon({ players, night, rules });

    // 套用死亡
    resolved.deaths.forEach(seat => {
      const p = CORE.bySeat(players, seat);
      if (p) p.alive = false;
    });

    return resolved;
  }

  /* =========================
     公告（玩家）
  ========================= */
  function buildPublicAnnouncement({ nightNo, resolved }) {
    const deaths = resolved.deaths;
    if (!deaths.length) return `🌤️ 天亮了，昨晚是平安夜。`;
    if (deaths.length === 1) return `🌅 天亮了，昨晚死亡的是：${deaths[0]} 號。`;
    return `🌅 天亮了，昨晚死亡的是：${deaths.join("、")} 號。`;
  }

  /* =========================
     公告（上帝）
     - 額外列出：狼刀/守/救/毒/奶穿
     - 若有查驗結果（由 engine 寫入 resolved.meta.checkResult）也可顯示
  ========================= */
  function buildHiddenAnnouncement({ resolved }) {
    const m = resolved.meta || {};
    const lines = [];

    if (m.killedByWolf) lines.push(`🐺 狼刀：${m.killedByWolf} 號`);
    if (m.blockedByGuard) lines.push(`🛡️ 守衛成功守到目標`);
    if (m.savedByWitch) lines.push(`🧪 女巫使用解藥`);
    if (m.milkPierce) lines.push(`⚠️ 奶穿：守 + 救 同時作用，仍然死亡`);
    if (m.poisonDeaths?.length) lines.push(`☠️ 女巫毒：${m.poisonDeaths.join("、")} 號`);

    // 查驗結果（可選）
    if (m.checkTarget && m.checkResult) {
      lines.push(`🔍 查驗：${m.checkTarget} 號 → ${m.checkResult}`);
    }

    if (!lines.length) lines.push("（本夜無隱藏事件）");
    return lines.join("\n");
  }

  /* =========================
     收集死亡技能（B1）
     - 獵人：被毒不能開槍（你指定）
     - 黑狼王：被毒不能用技能（你指定）
     - 白狼王：此處保留 deathSkill 入口（規則可後補）
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
          skills.push({ roleId: "hunter", seat, disabled: true, reason: "被毒，不能開槍" });
        } else {
          skills.push({ roleId: "hunter", seat, disabled: false });
        }
      }

      // 黑狼王（死亡帶人）
      if (p.roleId === "blackWolfKing") {
        const poisoned = CORE.isPoisonDeath(resolved, seat);
        if (poisoned && rules?.blackWolfKingPoisonNoSkill) {
          skills.push({ roleId: "blackWolfKing", seat, disabled: true, reason: "被毒，不能使用技能" });
        } else {
          skills.push({ roleId: "blackWolfKing", seat, disabled: false });
        }
      }

      // 白狼王（先預留：有些板子是主動技能，不一定是 deathSkill）
      if (p.roleId === "whiteWolfKing") {
        // TODO：若你的規則是「白狼王白天自爆帶人」，會在 day 技能處理
        // 這裡先不自動觸發
      }
    });

    return skills;
  }

  /* =========================
     第三方：邱比特/暗戀者（先做勝負判定骨架）
     - engine 後續會建立 loversLink: [seatA, seatB]
     - 若未建立連結，第三方視為不存在（不影響勝負）
  ========================= */
  function checkThirdPartyWin(players, stateMeta) {
    const link = stateMeta?.loversLink; // 期望格式：[a,b]
    if (!Array.isArray(link) || link.length !== 2) return null;

    const [a, b] = link;
    const pa = CORE.bySeat(players, a);
    const pb = CORE.bySeat(players, b);
    if (!pa || !pb) return null;

    const aliveA = pa.alive;
    const aliveB = pb.alive;

    // 情侶同生同死：若一方死，另一方也應被 engine 處理同步死亡
    // 這裡只做勝負：兩人都活到最後 -> 第三方勝
    const aliveCount = CORE.alive(players).length;
    if (aliveA && aliveB && aliveCount === 2) {
      return { winner: "third", reason: "暗戀者（情侶）存活到最後" };
    }

    return null;
  }

  /* =========================
     勝負判定（B1）
     - 先判第三方（若情侶勝利條件成立）
     - 再判狼/好人
  ========================= */
  function checkWin(players, stateMeta) {
    // 1) 第三方先判（若成立直接結束）
    const third = checkThirdPartyWin(players, stateMeta);
    if (third) return third;

    const alivePlayers = CORE.alive(players);

    const wolves = alivePlayers.filter(p => (ROLES[p.roleId]?.camp === "wolf"));
    const good = alivePlayers.filter(p => (ROLES[p.roleId]?.camp === "villager"));

    if (!wolves.length) {
      return { winner: "villager", reason: "所有邪惡陣營已被放逐" };
    }

    // 你要：直到最後正義放逐所有邪惡，否則邪惡可能獲勝
    if (wolves.length >= good.length) {
      return { winner: "wolf", reason: "邪惡陣營人數已達或超過正義" };
    }

    return null;
  }

  /* =========================
     對外掛載
  ========================= */
  window.WW_RULES_B1 = {
    resolveNight,
    buildPublicAnnouncement,
    buildHiddenAnnouncement,
    collectDeathSkills,
    checkWin
  };
})();
