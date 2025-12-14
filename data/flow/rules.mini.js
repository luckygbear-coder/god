/* =========================================================
   狼人殺｜規則結算（MVP + 規則擴充）
   檔案：/data/flow/rules.mini.js

   新增規則：
   1) 守衛不能連守（prevGuardTarget）
   2) 女巫不能自救
   3) 獵人被毒不能開槍
   4) 黑狼王被毒不能使用技能（blackWolfKing）

   全域掛載：window.WW_DATA.rulesMini
========================================================= */

(() => {
  const root = (window.WW_DATA = window.WW_DATA || {});
  const roles = root.roles || {};

  const uniqSorted = (arr) => Array.from(new Set(arr)).sort((a,b)=>a-b);

  function getPlayer(players, seat){
    return players.find(p => p.seat === seat);
  }
  function isAlive(players, seat){
    const p = getPlayer(players, seat);
    return !!p?.alive;
  }
  function anyRole(players, roleId){
    return players?.some(p => p.roleId === roleId);
  }
  function findFirstSeatByRole(players, roleId){
    const p = players.find(x => x.roleId === roleId);
    return p?.seat ?? null;
  }
  function roleName(roleId){
    return roles?.[roleId]?.name || roleId;
  }

  /* ---------------------------------------------------------
     預設規則開關（可由 settings 覆蓋）
  --------------------------------------------------------- */
  function withDefaultSettings(settings = {}){
    return {
      // 你要求的四條規則（預設都開）
      noConsecutiveGuard: settings.noConsecutiveGuard ?? true,    // 守衛不能連守
      witchCannotSelfSave: settings.witchCannotSelfSave ?? true,  // 女巫不能自救
      hunterPoisonNoShoot: settings.hunterPoisonNoShoot ?? true,  // 獵人被毒不能開槍
      blackWolfKingPoisonNoSkill: settings.blackWolfKingPoisonNoSkill ?? true, // 黑狼王被毒不能技能

      // 其他後續可加
      ...settings
    };
  }

  /* ---------------------------------------------------------
     1) 夜晚結算（含規則）
     night 欄位（建議 app.js 維護）：
     - guardTarget
     - prevGuardTarget   ✅ 新增：上一夜守誰（用於不能連守）
     - wolfTarget
     - seerCheckTarget / seerResult
     - witchSaveUsed / witchPoisonUsed
     - witchSave (boolean)
     - witchPoisonTarget (seat|null)
  --------------------------------------------------------- */
  function resolveNight({ players, night, settings = {} }){
    const S = withDefaultSettings(settings);

    const deaths = [];
    const tags = {
      // 重要：標記死亡原因，供「獵人被毒不能開槍 / 黑狼王被毒不能技能」用
      wolfKilled: new Set(),   // seats killed by wolf
      poisoned: new Set(),     // seats poisoned by witch
      protectedBlocked: false, // guard blocked wolf kill
      savedByWitch: false,     // witch saved wolf target
      guardInvalidReason: null // "consecutive"
    };

    const wolfTarget = night?.wolfTarget ?? null;
    const guardTargetRaw = night?.guardTarget ?? null;
    const prevGuardTarget = night?.prevGuardTarget ?? null;

    // 守衛不能連守：若這夜守與上一夜相同，視為「守衛無效」
    let guardTarget = guardTargetRaw;
    if (S.noConsecutiveGuard && guardTargetRaw && prevGuardTarget && guardTargetRaw === prevGuardTarget) {
      guardTarget = null;
      tags.guardInvalidReason = "consecutive";
    }

    // 女巫救
    const witchSave = !!night?.witchSave;
    const poisonTarget = night?.witchPoisonTarget ?? null;

    // 女巫不能自救（若她救自己，判定為無效）
    // 這裡假設：救=救狼刀目標，所以等同判定「狼刀目標是否為女巫座位」
    let effectiveWitchSave = witchSave;
    if (S.witchCannotSelfSave && witchSave && wolfTarget) {
      const witchSeat = findFirstSeatByRole(players, "witch");
      if (witchSeat && wolfTarget === witchSeat) {
        effectiveWitchSave = false;
      }
    }

    // 狼刀判定
    if (wolfTarget && isAlive(players, wolfTarget)) {
      if (guardTarget && wolfTarget === guardTarget) {
        // 擋刀
        tags.protectedBlocked = true;
      } else if (effectiveWitchSave) {
        // 女巫救
        tags.savedByWitch = true;
      } else {
        deaths.push(wolfTarget);
        tags.wolfKilled.add(wolfTarget);
      }
    }

    // 毒藥
    if (poisonTarget && isAlive(players, poisonTarget)) {
      deaths.push(poisonTarget);
      tags.poisoned.add(poisonTarget);
    }

    const finalDeaths = uniqSorted(deaths);

    // 套用死亡
    finalDeaths.forEach(seat => {
      const p = getPlayer(players, seat);
      if (p) p.alive = false;
    });

    // 把「這夜守誰」回傳，讓 app.js 下一夜寫入 prevGuardTarget
    // （注意：若連守無效，我們仍回傳 raw 守誰，用於 UI 顯示；prev 用 raw 才符合規則檢查）
    return {
      deaths: finalDeaths,
      meta: {
        wolfTarget,
        guardTargetRaw,
        guardTargetEffective: guardTarget,
        prevGuardTarget,
        witchSaveRequested: witchSave,
        witchSaveEffective: effectiveWitchSave,
        poisonTarget,
        tags
      }
    };
  }

  /* ---------------------------------------------------------
     2) 公告生成（公開/隱藏）
     - 隱藏公告會多寫入：守衛連守無效、女巫自救無效、死亡原因標記
  --------------------------------------------------------- */
  function buildAnnouncement({ nightNo, dayNo, players, night, resolved, settings = {} }){
    const S = withDefaultSettings(settings);

    const deaths = resolved?.deaths || [];
    const m = resolved?.meta || {};
    const tags = m.tags || {
      wolfKilled: new Set(),
      poisoned: new Set()
    };

    // 公開公告
    const publicText = deaths.length
      ? `天亮了。\n昨晚死亡的是：${deaths.join(" 號、")} 號。\n請依序發言／投票。`
      : `天亮了。\n昨晚是平安夜（沒有死亡）。\n請依序發言／投票。`;

    // 上帝隱藏公告
    const lines = [];
    lines.push(`【第 ${nightNo} 夜｜隱藏紀錄】`);

    if (m.guardTargetRaw) {
      if (S.noConsecutiveGuard && m.guardInvalidReason === "consecutive") {
        lines.push(`守衛守：${m.guardTargetRaw} 號（⚠️ 連守同一人 → 本夜守衛無效）`);
      } else {
        lines.push(`守衛守：${m.guardTargetRaw} 號`);
      }
    }

    if (m.wolfTarget) lines.push(`狼人刀：${m.wolfTarget} 號`);

    if (night?.seerCheckTarget) {
      const r = night?.seerResult === "wolf" ? "狼人" : "好人";
      lines.push(`預言查：${night.seerCheckTarget} 號 → ${r}`);
    }

    if (anyRole(players, "witch")) {
      // 解藥顯示：是否嘗試救、是否生效
      if (night?.witchSave) {
        if (S.witchCannotSelfSave && m.witchSaveRequested && !m.witchSaveEffective) {
          lines.push(`女巫救：嘗試救（⚠️ 自救規則 → 本夜解藥無效）`);
        } else {
          lines.push(`女巫救：有（解藥${night?.witchSaveUsed ? "已用過" : "未用"}）`);
        }
      } else {
        lines.push(`女巫救：無（解藥${night?.witchSaveUsed ? "已用過" : "未用"}）`);
      }

      lines.push(`女巫毒：${m.poisonTarget ? (m.poisonTarget + " 號") : "無"}（毒藥${night?.witchPoisonUsed ? "已用過" : "未用"}）`);
    }

    // 擋刀原因
    if (m.wolfTarget && deaths.indexOf(m.wolfTarget) === -1) {
      if (m.guardTargetEffective && m.wolfTarget === m.guardTargetEffective) lines.push(`狼刀無效原因：守衛擋刀（有效守到狼刀目標）`);
      else if (m.witchSaveEffective) lines.push(`狼刀無效原因：女巫使用解藥（有效）`);
      else lines.push(`狼刀無效原因：未知（請檢查規則）`);
    }

    // 死亡原因（上帝用）
    if (deaths.length) {
      const reasonLines = [];
      deaths.forEach(seat => {
        const r = [];
        if (tags.wolfKilled?.has(seat)) r.push("狼刀");
        if (tags.poisoned?.has(seat)) r.push("毒");
        reasonLines.push(`${seat} 號：${r.length ? r.join("+") : "不明"}`);
      });
      lines.push(`【死亡原因】\n${reasonLines.join("\n")}`);
    }

    lines.push(`死亡結算：${deaths.length ? deaths.join(" 號、") + " 號" : "無"}`);

    const hiddenText = lines.join("\n");

    return { publicText, hiddenText };
  }

  /* ---------------------------------------------------------
     3) 角色死亡技能可否觸發（被毒禁用）
     - 獵人被毒不能開槍
     - 黑狼王被毒不能技能
     你可以在 app.js 觸發技能前先問 canTriggerDeathSkill()
  --------------------------------------------------------- */
  function canTriggerDeathSkill({ roleId, seat, resolved, settings = {} }){
    const S = withDefaultSettings(settings);
    const tags = resolved?.meta?.tags;

    const poisoned = !!tags?.poisoned?.has(seat);

    if (roleId === "hunter" && S.hunterPoisonNoShoot && poisoned) return false;

    // 你指定「黑狼王」：這裡用 roleId = "blackWolfKing"
    if (roleId === "blackWolfKing" && S.blackWolfKingPoisonNoSkill && poisoned) return false;

    return true;
  }

  /* ---------------------------------------------------------
     4) 統一回合紀錄格式
  --------------------------------------------------------- */
  function makeLogItem({
    ts,
    nightNo,
    dayNo,
    publicText,
    hiddenText,
    votes = null,
    actions = null,
    resolvedMeta = null
  }){
    return {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      ts: ts || new Date().toISOString(),
      nightNo,
      dayNo,
      publicText,
      hiddenText,
      votes,
      actions,
      resolvedMeta // 可選：存 meta 方便復盤（含死亡原因、守衛是否無效等）
    };
  }

  /* ---------------------------------------------------------
     5) 匯出復盤 JSON 結構（統一格式）
  --------------------------------------------------------- */
  function exportPayload({ state, includeSecrets = false }){
    return {
      meta: {
        exportedAt: new Date().toISOString(),
        app: "狼人殺｜上帝輔助 PWA",
        version: "mvp-2-rules",
        includeSecrets: !!includeSecrets
      },
      settings: {
        boardType: state.boardType,
        playerCount: state.playerCount,
        rolesCount: state.rolesCount,
        rules: state.settings?.rules || null
      },
      players: includeSecrets
        ? state.players
        : state.players.map(p => ({ seat: p.seat, alive: p.alive, isChief: p.isChief })),
      logs: state.logs
    };
  }

  root.rulesMini = {
    resolveNight,
    buildAnnouncement,
    canTriggerDeathSkill,
    makeLogItem,
    exportPayload,
    roleName
  };
})();
