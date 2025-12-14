/* =========================================================
   狼人殺｜規則結算（MVP）
   檔案：/data/flow/rules.mini.js

   功能：
   - resolveNight()：夜晚結算（狼刀/守/女巫救毒）
   - buildAnnouncement()：生成公告（公開/隱藏）
   - makeLogItem()：建立統一的回合紀錄格式
   - exportPayload()：匯出復盤 JSON 的結構統一

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

  function roleName(roleId){
    return roles?.[roleId]?.name || roleId;
  }

  /* ---------------------------------------------------------
     1) 夜晚結算（MVP）
     規則：
     - 若 wolfTarget == guardTarget => 擋刀
     - 若 女巫救（witchSave=true）=> 擋刀（僅能救狼刀目標）
     - 毒藥：加一個死亡（可雙死）
  --------------------------------------------------------- */
  function resolveNight({ players, night, settings = {} }){
    const deaths = [];

    const wolfTarget = night?.wolfTarget ?? null;
    const guardTarget = night?.guardTarget ?? null;
    const witchSave = !!night?.witchSave;
    const poisonTarget = night?.witchPoisonTarget ?? null;

    // 狼刀
    if (wolfTarget && isAlive(players, wolfTarget)) {
      if (wolfTarget === guardTarget) {
        // 擋刀
      } else if (witchSave) {
        // 女巫救（MVP 不做「不能自救」等限制）
      } else {
        deaths.push(wolfTarget);
      }
    }

    // 毒藥
    if (poisonTarget && isAlive(players, poisonTarget)) {
      deaths.push(poisonTarget);
    }

    const finalDeaths = uniqSorted(deaths);

    // 套用死亡
    finalDeaths.forEach(seat => {
      const p = getPlayer(players, seat);
      if (p) p.alive = false;
    });

    return {
      deaths: finalDeaths,
      meta: {
        wolfTarget,
        guardTarget,
        witchSave,
        poisonTarget
      }
    };
  }

  /* ---------------------------------------------------------
     2) 公告生成
     - publicText：玩家可見
     - hiddenText：上帝可見（夜晚動作、查驗、用藥）
  --------------------------------------------------------- */
  function buildAnnouncement({ nightNo, dayNo, players, night, resolved }){
    const deaths = resolved?.deaths || [];
    const {
      wolfTarget,
      guardTarget,
      witchSave,
      poisonTarget
    } = resolved?.meta || {};

    // 公開公告
    const publicText = deaths.length
      ? `天亮了。\n昨晚死亡的是：${deaths.join(" 號、")} 號。\n請依序發言／投票。`
      : `天亮了。\n昨晚是平安夜（沒有死亡）。\n請依序發言／投票。`;

    // 上帝隱藏公告
    const lines = [];
    lines.push(`【第 ${nightNo} 夜｜隱藏紀錄】`);

    if (guardTarget) lines.push(`守衛守：${guardTarget} 號`);
    if (wolfTarget) lines.push(`狼人刀：${wolfTarget} 號`);

    if (night?.seerCheckTarget) {
      const r = night?.seerResult === "wolf" ? "狼人" : "好人";
      lines.push(`預言查：${night.seerCheckTarget} 號 → ${r}`);
    }

    if (players.some(p => p.roleId === "witch")) {
      lines.push(`女巫救：${witchSave ? "有" : "無"}（解藥${night?.witchSaveUsed ? "已用過" : "未用"}）`);
      lines.push(`女巫毒：${poisonTarget ? (poisonTarget + " 號") : "無"}（毒藥${night?.witchPoisonUsed ? "已用過" : "未用"}）`);
    }

    // 擋刀原因（可讀性）
    if (wolfTarget && deaths.indexOf(wolfTarget) === -1) {
      if (wolfTarget === guardTarget) lines.push(`狼刀無效原因：守衛擋刀（守到狼刀目標）`);
      else if (witchSave) lines.push(`狼刀無效原因：女巫使用解藥`);
      else lines.push(`狼刀無效原因：未知（請檢查規則）`);
    }

    lines.push(`死亡結算：${deaths.length ? deaths.join(" 號、") + " 號" : "無"}`);

    const hiddenText = lines.join("\n");

    return { publicText, hiddenText };
  }

  /* ---------------------------------------------------------
     3) 統一回合紀錄格式
     votes: [{fromSeat, toSeat|null}]
     actions: 可自由擴充（例如白天騎士決鬥、獵人開槍）
  --------------------------------------------------------- */
  function makeLogItem({
    ts,
    nightNo,
    dayNo,
    publicText,
    hiddenText,
    votes = null,
    actions = null
  }){
    return {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      ts: ts || new Date().toISOString(),
      nightNo,
      dayNo,
      publicText,
      hiddenText,
      votes,
      actions
    };
  }

  /* ---------------------------------------------------------
     4) 匯出復盤 JSON 結構（統一格式）
  --------------------------------------------------------- */
  function exportPayload({ state, includeSecrets = false }){
    const payload = {
      meta: {
        exportedAt: new Date().toISOString(),
        app: "狼人殺｜上帝輔助 PWA",
        version: "mvp-1",
        includeSecrets: !!includeSecrets
      },
      settings: {
        boardType: state.boardType,
        playerCount: state.playerCount,
        rolesCount: state.rolesCount
      },
      players: includeSecrets
        ? state.players
        : state.players.map(p => ({ seat: p.seat, alive: p.alive, isChief: p.isChief })),
      logs: state.logs
    };
    return payload;
  }

  root.rulesMini = {
    resolveNight,
    buildAnnouncement,
    makeLogItem,
    exportPayload,
    roleName
  };
})();
