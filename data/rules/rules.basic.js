/* =========================================================
   Rules - Basic Board
   檔案：data/rules/rules.basic.js

   輸入：
   - players: [{seat, roleId, team, alive}]
   - night:
       wolfTarget (可為 null/undefined 表示空刀)
       guardTarget
       seerCheck
       witchSave (boolean)
       witchPoisonTarget (seat|null)
       witchSaveUsed (boolean)
       witchPoisonUsed (boolean)
       prevGuardTarget (seat|null)  // 若有
   - settings:
       noConsecutiveGuard
       wolfCanNoKill
       witchCannotSelfSave
       hunterPoisonNoShoot
       blackWolfKingPoisonNoSkill

   規則重點（依你要求）：
   - 守衛不能連守（若連守 → 視為本晚守衛無效）
   - 狼人可空刀（wolfTarget 空則無狼刀）
   - 女巫不能自救（若 wolfTarget 是女巫且開此規則，救無效）
   - ✅ 救同守＝奶穿（若同時守到且女巫救了同一人 → 仍死亡）
========================================================= */

(function () {
  function findPlayer(players, seat) {
    return players.find(p => p.seat === seat) || null;
  }
  function isAlive(players, seat) {
    const p = findPlayer(players, seat);
    return !!p && !!p.alive;
  }
  function markDead(players, seat) {
    const p = findPlayer(players, seat);
    if (p) p.alive = false;
  }

  function teamOf(players, seat) {
    const p = findPlayer(players, seat);
    return p?.team || null;
  }
  function roleOf(players, seat) {
    const p = findPlayer(players, seat);
    return p?.roleId || null;
  }

  function resolveNight({ players, night, settings = {} }) {
    const meta = {
      wolfTarget: night?.wolfTarget ?? null,
      guardTargetRaw: night?.guardTarget ?? null,
      guardEffective: true,
      witchSaveApplied: false,
      witchPoisonApplied: false,
      reasons: [],
      deathBy: {}, // seat -> "wolf"/"poison"/"both"
      poisonDeaths: [],
      wolfDeaths: [],
    };

    const deaths = new Set();

    // ---------- Guard rule: no consecutive guard
    let guardTarget = night?.guardTarget ?? null;
    if (settings.noConsecutiveGuard && guardTarget != null) {
      const prev = night?.prevGuardTarget ?? null;
      if (prev != null && prev === guardTarget) {
        // 連守 → 本晚守衛無效
        meta.guardEffective = false;
        guardTarget = null;
        meta.reasons.push("守衛連守：本晚守衛無效");
      }
    }

    // ---------- Wolf target (allow no kill)
    const wolfTarget = (night?.wolfTarget ?? null);
    const wolfPicked = wolfTarget != null;

    // 若不允許空刀但又沒選，這裡不硬炸，當作空刀並記錄
    if (!settings.wolfCanNoKill && !wolfPicked) {
      meta.reasons.push("未選狼刀（但規則不允許空刀）：視為空刀（保護流程不斷）");
    }

    // ---------- Witch save legality
    const witchSeat = players.find(p => p.roleId === "witch")?.seat ?? null;
    const saveUsed = !!night?.witchSaveUsed;
    const willSave = !!night?.witchSave;

    // 可救的前提：本晚有狼刀目標 + 沒用過解藥 + 玩家存活
    let saveCandidate = wolfPicked && !saveUsed && isAlive(players, wolfTarget);

    // 女巫不能自救
    if (settings.witchCannotSelfSave && wolfPicked && witchSeat && wolfTarget === witchSeat) {
      // 即便玩家點了救，也不允許生效
      if (willSave) meta.reasons.push("女巫嘗試自救：規則禁止 → 救無效");
      saveCandidate = false;
    }

    // ---------- Wolf death apply (with guard + save)
    if (wolfPicked && isAlive(players, wolfTarget)) {
      const guarded = (guardTarget != null && guardTarget === wolfTarget);

      // ✅ 救同守＝奶穿：如果同時 guarded 且 willSave，則兩者都不生效，仍死亡
      if (guarded && willSave && saveCandidate) {
        meta.reasons.push("救同守：奶穿（狼刀仍然成立）");
        deaths.add(wolfTarget);
        meta.wolfDeaths.push(wolfTarget);
        meta.deathBy[wolfTarget] = "wolf";
      }
      else if (guarded) {
        meta.reasons.push("守衛守中：狼刀無效");
      }
      else if (willSave && saveCandidate) {
        meta.witchSaveApplied = true;
        meta.reasons.push("女巫使用解藥：狼刀無效");
      }
      else {
        deaths.add(wolfTarget);
        meta.wolfDeaths.push(wolfTarget);
        meta.deathBy[wolfTarget] = "wolf";
      }
    } else {
      if (settings.wolfCanNoKill) meta.reasons.push("狼人空刀");
    }

    // ---------- Witch poison
    const poisonUsed = !!night?.witchPoisonUsed;
    const poisonTarget = night?.witchPoisonTarget ?? null;
    if (!poisonUsed && poisonTarget != null && isAlive(players, poisonTarget)) {
      deaths.add(poisonTarget);
      meta.witchPoisonApplied = true;
      meta.poisonDeaths.push(poisonTarget);
      meta.deathBy[poisonTarget] = meta.deathBy[poisonTarget]
        ? "both"
        : "poison";
    }

    // ---------- Apply deaths to players
    const deathList = [...deaths].sort((a, b) => a - b);
    deathList.forEach(seat => markDead(players, seat));

    // ---------- Seer result (for god only)
    let seerResult = null;
    if (night?.seerCheck != null) {
      const t = findPlayer(players, night.seerCheck);
      seerResult = t ? (t.team === "wolf" ? "wolf" : "villager") : null;
    }

    return {
      deaths: deathList,
      seer: {
        target: night?.seerCheck ?? null,
        result: seerResult,
      },
      meta
    };
  }

  function buildAnnouncement({ nightNo, dayNo, players, night, resolved, settings = {} }) {
    const deaths = resolved?.deaths || [];
    const publicText = deaths.length
      ? `天亮了，昨晚死亡的是：${deaths.map(s => `${s} 號`).join("、")}。`
      : `天亮了，昨晚是平安夜。`;

    // 上帝隱藏文字
    const hiddenLines = [];
    hiddenLines.push(`（上帝）第${nightNo}夜 / 第${dayNo}天`);
    hiddenLines.push(`狼刀：${night?.wolfTarget ?? "空刀/未選"}`);
    hiddenLines.push(`守衛：${night?.guardTarget ?? "—"}${resolved?.meta?.guardEffective === false ? "（連守無效）" : ""}`);

    if (night?.seerCheck != null) {
      hiddenLines.push(`預言家驗：${night.seerCheck} → ${resolved?.seer?.result === "wolf" ? "狼人" : "好人"}`);
    }

    hiddenLines.push(`女巫救：${night?.witchSave ? "是" : "否"}（已用：${night?.witchSaveUsed ? "是" : "否"}）`);
    hiddenLines.push(`女巫毒：${night?.witchPoisonTarget ?? "否"}（已用：${night?.witchPoisonUsed ? "是" : "否"}）`);

    if (resolved?.meta?.reasons?.length) {
      hiddenLines.push(`原因：${resolved.meta.reasons.join(" / ")}`);
    }

    return {
      publicText,
      hiddenText: hiddenLines.join("\n")
    };
  }

  // 供 app.js 判定「死亡技能是否能觸發」（被毒禁用）
  function canTriggerDeathSkill({ roleId, seat, resolved, settings = {} }) {
    if (!resolved?.meta?.deathBy) return true;
    const by = resolved.meta.deathBy[seat]; // "wolf"|"poison"|"both"
    const poisoned = (by === "poison" || by === "both");

    if (poisoned && roleId === "hunter" && settings.hunterPoisonNoShoot) return false;
    if (poisoned && roleId === "blackWolfKing" && settings.blackWolfKingPoisonNoSkill) return false;
    return true;
  }

  // 匯出 payload（給 app.js 匯出 JSON 用）
  function exportPayload({ state, includeSecrets }) {
    const copy = JSON.parse(JSON.stringify(state));
    if (!includeSecrets) {
      // 移除身分
      if (Array.isArray(copy.players)) {
        copy.players.forEach(p => { delete p.roleId; delete p.team; delete p.name; delete p.icon; });
      }
      // 移除隱藏 log
      if (Array.isArray(copy.logs)) {
        copy.logs.forEach(l => { delete l.hiddenText; });
      }
    }
    return { exportedAt: new Date().toISOString(), includeSecrets, state: copy };
  }

  window.WW_RULES_BASIC = {
    resolveNight,
    buildAnnouncement,
    canTriggerDeathSkill,
    exportPayload,
  };
})();