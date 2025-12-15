/* =========================================================
   狼人殺｜特殊板 B1 規則引擎
   檔案：data/rules/rules.b1.js

   支援：
   - 黑狼王（死亡技能）
   - 白狼王（白天自爆規格：由 day/app 處理觸發，這裡只留標記）
   - 騎士（白天決鬥：由 day/app 觸發）
   - 白痴（投票免死：由 day/app 觸發）
   - 邱比特（首夜連線→戀人）
   - 暗戀者（先資料，勝利條件後續補）
   - 石像鬼（夜晚查驗：只給上帝）
   - 其他角色先資料齊全，流程後續再加

   規則開關（settings.rules）：
   - noConsecutiveGuard: true
   - wolfCanSkip: true
   - witchCannotSelfSave: true
   - hunterPoisonNoShoot: true
   - blackWolfKingPoisonNoSkill: true
   - guardAndSaveNoPeaceNight: false  // 你說的「奶穿」規則（可開）
========================================================= */

(function () {

  function isAlive(players, seat) {
    const p = players.find(x => x.seat === seat);
    return p && p.alive;
  }

  function kill(players, seat, reason, meta) {
    const p = players.find(x => x.seat === seat);
    if (!p || !p.alive) return false;
    p.alive = false;
    p.deathReason = reason;
    meta.killed = meta.killed || [];
    meta.killed.push({ seat, reason });
    return true;
  }

  function findByRole(players, roleId) {
    return players.find(p => p.roleId === roleId && p.alive);
  }

  /* =========================
     戀人連坐
     meta.lovers = [a,b]
  ========================= */
  function applyLoversChain(players, deaths, meta) {
    const lovers = meta.lovers;
    if (!lovers || lovers.length !== 2) return deaths;

    let changed = true;
    const set = new Set(deaths);

    while (changed) {
      changed = false;
      for (const d of Array.from(set)) {
        if (d === lovers[0] && isAlive(players, lovers[1]) && !set.has(lovers[1])) {
          set.add(lovers[1]); changed = true;
        }
        if (d === lovers[1] && isAlive(players, lovers[0]) && !set.has(lovers[0])) {
          set.add(lovers[0]); changed = true;
        }
      }
    }

    return Array.from(set);
  }

  /* =========================
     夜晚結算（B1）
  ========================= */
  function resolveNight({ players, night, settings, stateMeta }) {
    const deaths = [];
    const meta = {
      ...((stateMeta || {}).nightMeta || {}),
      killed: []
    };

    const rules = settings || {};

    const wolfTarget = night.wolfTarget || null;
    const guardTarget = night.guardTarget || null;

    const witchSave = !!night.witchSave;
    const witchPoisonTarget = night.witchPoisonTarget || null;

    // 給 engine 記錄「守衛守誰」
    meta.guardTargetRaw = guardTarget;

    /* ========= 石像鬼查驗（只記錄，不公開） ========= */
    if (night.gargoyleTarget && isAlive(players, night.gargoyleTarget)) {
      const t = players.find(p => p.seat === night.gargoyleTarget);
      meta.gargoyleCheck = {
        target: night.gargoyleTarget,
        result: (t?.camp === "wolf") ? "wolf" : "not_wolf"
      };
    }

    /* =========================
       1) 狼刀判定
    ========================= */
    let wolfKilled = null;

    if (wolfTarget && isAlive(players, wolfTarget)) {
      const guardHit = guardTarget && guardTarget === wolfTarget;
      const saveHit = witchSave;

      if (guardHit) meta.guardSuccess = true;
      if (saveHit) meta.witchSave = true;

      // 你說的「救同守則奶穿沒有平安夜」
      // 解釋：若同一晚又守又救，視為「奶穿」=> 仍會死（沒有平安夜）
      if (rules.guardAndSaveNoPeaceNight && guardHit && saveHit) {
        wolfKilled = wolfTarget;
        meta.milkPierce = true;
      } else if (guardHit) {
        wolfKilled = null;
      } else if (saveHit) {
        wolfKilled = null;
      } else {
        wolfKilled = wolfTarget;
      }
    }

    if (wolfKilled) deaths.push(wolfKilled);

    /* =========================
       2) 女巫毒
    ========================= */
    if (witchPoisonTarget && isAlive(players, witchPoisonTarget)) {
      if (!deaths.includes(witchPoisonTarget)) {
        deaths.push(witchPoisonTarget);
      }
      meta.poisoned = witchPoisonTarget;
    }

    /* =========================
       3) 戀人連坐（若 meta.lovers 已存在）
    ========================= */
    const afterLovers = applyLoversChain(players, deaths, meta);
    afterLovers.forEach(seat => {
      kill(players, seat, "night", meta);
    });

    return {
      deaths: afterLovers,
      meta
    };
  }

  /* =========================
     技能禁用：被毒
  ========================= */
  function canTriggerDeathSkill({ roleId, seat, resolved, settings }) {
    const rules = settings || {};
    if (resolved?.meta?.poisoned === seat) {
      if (roleId === "hunter" && rules.hunterPoisonNoShoot) return false;
      if (roleId === "blackWolfKing" && rules.blackWolfKingPoisonNoSkill) return false;
    }
    return true;
  }

  /* =========================
     公告（public + hidden）
  ========================= */
  function buildAnnouncement({ nightNo, dayNo, players, night, resolved, settings }) {
    let publicText = `🌅 天亮了（第 ${dayNo} 天）\n`;

    if (!resolved.deaths.length) {
      publicText += "昨晚是平安夜。";
    } else {
      publicText += `昨晚死亡的是：${resolved.deaths.join("、")} 號。`;
    }

    // hidden：上帝可見
    const hiddenParts = [];
    if (resolved?.meta?.gargoyleCheck) {
      const g = resolved.meta.gargoyleCheck;
      hiddenParts.push(`（上帝）石像鬼查驗：${g.target} 號 → ${g.result}`);
    }
    if (resolved?.meta?.milkPierce) {
      hiddenParts.push("（上帝）奶穿：同守同救仍死亡（guardAndSaveNoPeaceNight）");
    }
    if (resolved?.meta?.poisoned) {
      hiddenParts.push(`（上帝）被毒：${resolved.meta.poisoned} 號`);
    }

    return {
      publicText,
      hiddenText: hiddenParts.length ? hiddenParts.join("\n") : "（上帝）—"
    };
  }

  function makeLogItem({ ts, nightNo, dayNo, publicText, hiddenText, actions, resolvedMeta }) {
    return {
      ts,
      nightNo,
      dayNo,
      publicText,
      hiddenText,
      actions: actions || null,
      resolvedMeta: resolvedMeta || null
    };
  }

  /* =========================
     勝負判定（含第三方）
     stateMeta 需要帶：
     - lovers: [a,b]   // 邱比特連線結果
  ========================= */
  function checkWin(players, stateMeta) {
    const alive = players.filter(p => p.alive);

    const wolves = alive.filter(p => p.camp === "wolf");
    const villagers = alive.filter(p => p.camp === "villager");
    const third = alive.filter(p => p.camp === "third");

    // 1) 第三方：戀人優先勝利（常見桌規）
    const lovers = stateMeta?.lovers;
    if (lovers && lovers.length === 2) {
      const aAlive = alive.some(p => p.seat === lovers[0]);
      const bAlive = alive.some(p => p.seat === lovers[1]);

      // 只剩兩名戀人存活 → 戀人勝
      if (aAlive && bAlive && alive.length === 2) {
        return {
          ended: true,
          winner: "third",
          reason: `戀人 ${lovers[0]} 號與 ${lovers[1]} 號存活至最後`
        };
      }
    }

    // 2) 狼全滅 → 好人勝
    if (!wolves.length) {
      return { ended: true, winner: "villager", reason: "所有邪惡陣營已出局" };
    }

    // 3) 狼達到控制人數 → 狼勝（狼 >= 好人+第三方）
    const nonWolves = alive.length - wolves.length;
    if (wolves.length >= nonWolves) {
      return { ended: true, winner: "wolf", reason: "邪惡陣營人數達到控制場面" };
    }

    return { ended: false };
  }

  window.WW_DATA = window.WW_DATA || {};
  window.WW_DATA.rulesB1 = {
    resolveNight,
    canTriggerDeathSkill,
    buildAnnouncement,
    makeLogItem,
    checkWin
  };

})();