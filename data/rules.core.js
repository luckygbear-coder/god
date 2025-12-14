/* =========================================================
   狼人殺｜核心規則引擎（MVP）
   檔案：data/rules.core.js

   規則重點（依你定版）：
   ✅ 守衛不能連守（預設開）
   ✅ 狼人可空刀（預設開）
   ✅ 女巫不能自救（預設開）
   ✅ 4.1B 奶穿：若「守到 + 女巫仍救」=> 救穿，狼刀仍成立（目標死亡）
   ✅ 獵人被毒不能開槍（預設開）
   ✅ 黑狼王被毒不能用技能（預設開）
   ✅ 勝負判定：A+B（並保留 third hook）
========================================================= */

(function () {

  // =============== 工具 ===============
  const uniq = (arr) => [...new Set(arr.filter(Boolean))];
  const isAlive = (players, seat) => players.find(p => p.seat === seat)?.alive === true;
  const roleOf = (players, seat) => players.find(p => p.seat === seat)?.roleId || null;
  const teamOf = (players, seat) => players.find(p => p.seat === seat)?.team || null;

  // =============== 預設規則開關 ===============
  const DEFAULT_RULES = {
    noConsecutiveGuard: true,
    wolfCanSkip: true,
    witchCannotSelfSave: true,
    hunterPoisonNoShoot: true,
    blackWolfKingPoisonNoSkill: true,
    // 你指定的奶穿規則（固定 true）
    saveHitsGuardMakesDeath: true
  };

  function mergeRules(userRules) {
    return Object.assign({}, DEFAULT_RULES, userRules || {});
  }

  // =============== 夜晚結算（核心） ===============
  /**
   * resolveNight({players, night, rules})
   *
   * night 結構（UI/flow 層填入）：
   * - guardTarget: seat|null
   * - wolfTarget: seat|null   // null 表示空刀
   * - seerCheckTarget: seat|null
   * - seerResult: "wolf"|"villager"|null   // 可由 flow 直接算
   * - witchSave: boolean
   * - witchPoisonTarget: seat|null
   * - witchSaveUsed/witchPoisonUsed: boolean (由 state 管)
   * - prevGuardTarget: seat|null (上晚守誰，供「不能連守」判斷)
   *
   * 回傳：
   * - deaths: seat[]
   * - meta: { reasonsBySeat, flags... }（上帝視角用）
   */
  function resolveNight({ players, night, rules }) {
    const R = mergeRules(rules);

    const deaths = [];
    const reasonsBySeat = {}; // seat -> ["wolf","poison",...]
    const flags = {
      wolfSkipped: false,
      guardInvalid: false,
      witchSelfSaveBlocked: false,
      witchSaveApplied: false,
      witchPoisonApplied: false,
      guardHit: false,
      saveHitsGuard: false
    };

    // ---- 1) 守衛合法性：不能連守
    let guardTarget = night.guardTarget || null;
    if (guardTarget && !isAlive(players, guardTarget)) guardTarget = null;

    if (R.noConsecutiveGuard && guardTarget && night.prevGuardTarget && guardTarget === night.prevGuardTarget) {
      // 連守無效
      guardTarget = null;
      flags.guardInvalid = true;
    }

    // ---- 2) 狼刀：可空刀
    let wolfTarget = night.wolfTarget || null;
    if (!wolfTarget) {
      flags.wolfSkipped = true;
    }
    if (wolfTarget && !isAlive(players, wolfTarget)) wolfTarget = null;

    // ---- 3) 女巫解藥：不能自救（規則 ON）
    const witchSeat = players.find(p => p.roleId === "witch")?.seat || null;
    let witchSave = !!night.witchSave;
    if (witchSave && R.witchCannotSelfSave && witchSeat && wolfTarget === witchSeat) {
      // 阻止自救（視為沒救）
      witchSave = false;
      flags.witchSelfSaveBlocked = true;
    }

    // ---- 4) 狼刀是否被守到
    const guardHit = !!(wolfTarget && guardTarget && wolfTarget === guardTarget);
    flags.guardHit = guardHit;

    // ---- 5) 奶穿（你指定 4.1B）
    // 若 guardHit 且 witchSave=true 且 R.saveHitsGuardMakesDeath=true
    // => 視為「救穿」，狼刀仍成立（仍死亡）
    const saveHitsGuard = !!(guardHit && witchSave && R.saveHitsGuardMakesDeath);
    flags.saveHitsGuard = saveHitsGuard;

    // ---- 6) 結算狼刀死亡
    if (wolfTarget) {
      let wolfKill = true;

      if (guardHit && !saveHitsGuard) {
        // 守到有效（且沒有奶穿）
        wolfKill = false;
      }

      if (witchSave && !saveHitsGuard) {
        // 女巫救到有效（且沒有奶穿）
        wolfKill = false;
        flags.witchSaveApplied = true;
      }

      if (wolfKill) {
        deaths.push(wolfTarget);
        reasonsBySeat[wolfTarget] = (reasonsBySeat[wolfTarget] || []).concat(["wolf"]);
      }
    }

    // ---- 7) 結算毒藥
    let poisonTarget = night.witchPoisonTarget || null;
    if (poisonTarget && !isAlive(players, poisonTarget)) poisonTarget = null;

    if (poisonTarget) {
      deaths.push(poisonTarget);
      reasonsBySeat[poisonTarget] = (reasonsBySeat[poisonTarget] || []).concat(["poison"]);
      flags.witchPoisonApplied = true;
    }

    const finalDeaths = uniq(deaths);

    // meta：提供上帝用（含 raw target）
    const meta = {
      guardTargetRaw: night.guardTarget || null,
      guardTargetFinal: guardTarget,
      wolfTargetRaw: night.wolfTarget || null,
      wolfTargetFinal: wolfTarget,
      poisonTargetFinal: poisonTarget,
      reasonsBySeat,
      flags
    };

    return { deaths: finalDeaths, meta };
  }

  // =============== 公告文案（玩家/上帝） ===============
  function buildNightPublicText({ nightNo, dayNo, resolved, rules, kidMode = false }) {
    const R = mergeRules(rules);
    const deaths = resolved?.deaths || [];
    const f = resolved?.meta?.flags || {};

    // 主要公開結果
    let main;
    if (!deaths.length) {
      // 平安夜（但你有奶穿規則：奶穿會有死者，不會到這裡）
      main = kidMode
        ? `🌤 第${dayNo}天早上到了！昨晚大家都平安～`
        : `天亮了，昨晚是平安夜。`;
    } else {
      const list = deaths.map(s => `${s} 號`).join("、");
      main = kidMode
        ? `🌅 第${dayNo}天早上到了！昨晚倒下的是：${list}。`
        : `天亮了，昨晚死亡的是：${list}。`;
    }

    // 小朋友模式：加「可能發生什麼」提示（不暴露身份）
    let hint = "";
    if (kidMode) {
      const maybe = [];
      if (f.wolfSkipped) maybe.push("狼人可能選擇了空刀");
      if (f.guardHit) maybe.push("守衛可能守到了危險的地方");
      if (f.witchSaveApplied) maybe.push("女巫可能用了解藥");
      if (!deaths.length && maybe.length) {
        hint = `\n🧩 可能發生：${maybe.join(" / ")}。`;
      } else if (!deaths.length && !maybe.length) {
        hint = `\n🧩 可能發生：狼人沒找到目標，或有人默默守護了大家。`;
      }
    }

    return `${main}${hint}`;
  }

  function buildNightHiddenText({ players, night, resolved, rules }) {
    const R = mergeRules(rules);
    const meta = resolved?.meta || {};
    const f = meta.flags || {};
    const reasonsBySeat = meta.reasonsBySeat || {};

    const lines = [];
    lines.push(`（上帝）夜晚細節：`);
    lines.push(`- 守衛：raw=${meta.guardTargetRaw ?? "—"}，final=${meta.guardTargetFinal ?? "—"}${f.guardInvalid ? "（連守無效）" : ""}`);
    lines.push(`- 狼刀：raw=${meta.wolfTargetRaw ?? "—"}，final=${meta.wolfTargetFinal ?? "—"}${f.wolfSkipped ? "（空刀）" : ""}`);
    if (night.seerCheckTarget) {
      lines.push(`- 預言家查驗：${night.seerCheckTarget}（結果=${night.seerResult || "—"}）`);
    }
    lines.push(`- 女巫解藥：${night.witchSave ? "選擇救" : "不救"}${f.witchSelfSaveBlocked ? "（自救被規則阻止）" : ""}${f.saveHitsGuard ? "（奶穿：守到+救 => 仍死亡）" : ""}`);
    lines.push(`- 女巫毒藥：${night.witchPoisonTarget ? `毒 ${night.witchPoisonTarget}` : "不毒"}`);

    const deaths = resolved?.deaths || [];
    if (deaths.length) {
      lines.push(`- 死亡原因：`);
      deaths.forEach(seat => {
        const rs = reasonsBySeat[seat] || [];
        lines.push(`  • ${seat}：${rs.join("+") || "未知"}`);
      });
    }

    return lines.join("\n");
  }

  // =============== 死亡技能可否觸發（被毒禁用） ===============
  /**
   * canTriggerDeathSkill({roleId, seat, resolved, rules})
   * 依你需求：
   * - 獵人被毒 => 不能開槍（規則 ON）
   * - 黑狼王被毒 => 不能用技能（規則 ON）
   */
  function canTriggerDeathSkill({ roleId, seat, resolved, rules }) {
    const R = mergeRules(rules);
    const reasonsBySeat = resolved?.meta?.reasonsBySeat || {};
    const reasons = reasonsBySeat[seat] || [];
    const poisoned = reasons.includes("poison");

    if (roleId === "hunter" && R.hunterPoisonNoShoot && poisoned) return false;
    if (roleId === "blackWolfKing" && R.blackWolfKingPoisonNoSkill && poisoned) return false;

    return true;
  }

  // =============== 勝負判定（A+B + third hook） ===============
  /**
   * checkWin(players)
   * - A：狼陣營人數 >= 好人陣營人數 => 狼勝
   * - B：所有狼死亡 => 好人勝
   * - third：保留 hook（不讓 third 被算進 villager）
   */
  function checkWin(players) {
    const alive = players.filter(p => p.alive);

    const wolfAlive = alive.filter(p => p.team === "wolf").length;
    const villAlive = alive.filter(p => p.team === "villager").length;
    const thirdAlive = alive.filter(p => p.team === "third").length;

    // B：狼全滅 => 好人勝
    if (wolfAlive === 0) {
      return { ended: true, winner: "villager", reason: "所有狼人已出局" };
    }

    // A：狼 >= 好人（這裡「好人」只算 villager，不含 third）
    if (wolfAlive >= villAlive && villAlive > 0) {
      return { ended: true, winner: "wolf", reason: "狼人勢力已壓制好人" };
    }

    // 若場上只剩 狼 + third（villager=0），通常可直接判狼勝或依 third 規則
    // MVP：先不判第三方勝利，但避免卡死
    if (villAlive === 0 && wolfAlive > 0) {
      return { ended: true, winner: "wolf", reason: "好人已全數出局（第三方待擴充規則）" };
    }

    return { ended: false, winner: null, reason: "" , meta:{wolfAlive,villAlive,thirdAlive} };
  }

  // =============== 匯出（玩家版/上帝版） ===============
  function exportPayload({ state, includeSecrets }) {
    // 玩家版：移除 players.roleId/team/notes 與 hidden logs
    const copy = JSON.parse(JSON.stringify(state));

    if (!includeSecrets) {
      if (Array.isArray(copy.players)) {
        copy.players = copy.players.map(p => ({
          seat: p.seat,
          alive: p.alive,
          isChief: !!p.isChief
        }));
      }
      if (Array.isArray(copy.logs)) {
        copy.logs = copy.logs.map(l => ({
          ts: l.ts,
          nightNo: l.nightNo,
          dayNo: l.dayNo,
          publicText: l.publicText
        }));
      }
      // 去掉夜晚隱藏狀態
      if (copy.night) {
        copy.night = { ...copy.night };
        delete copy.night.seerResult;
        delete copy.night.seerCheckTarget;
        delete copy.night.wolfTarget;
        delete copy.night.guardTarget;
        delete copy.night.witchPoisonTarget;
      }
    }

    return {
      exportedAt: new Date().toISOString(),
      includeSecrets: !!includeSecrets,
      data: copy
    };
  }

  // =============== 對外掛載 ===============
  window.WW_RULES_CORE = {
    DEFAULT_RULES,
    mergeRules,
    resolveNight,
    buildNightPublicText,
    buildNightHiddenText,
    canTriggerDeathSkill,
    checkWin,
    exportPayload
  };

})();
