/* =========================================================
   狼人殺｜上帝輔助 PWA
   檔案：/data/flow/rules.core.js

   ✅ 核心規則引擎（Core Rules）
   - resolveNight(): 夜晚結算（含你指定規則）
   - buildAnnouncement(): 生成公開/隱藏公告（上帝/玩家視角）
   - canTriggerDeathSkill(): 判定死亡技能是否可用（被毒禁用）
   - applyLynch(): 白天處刑（含白痴 2A）
   - checkWin(): 勝負判定骨架（含 third party 擴充接口）
========================================================= */

(function () {
  window.WW_DATA = window.WW_DATA || {};

  const getRole = (id) => (window.WW_DATA.getRole ? window.WW_DATA.getRole(id) : null);

  const TEAM = {
    WOLF: "wolf",
    VILL: "villager",
    THIRD: "third"
  };

  function seatToPlayer(players, seat) {
    return players.find(p => p.seat === seat) || null;
  }

  function aliveSeats(players) {
    return players.filter(p => p.alive).map(p => p.seat);
  }

  function isAlive(players, seat) {
    const p = seatToPlayer(players, seat);
    return !!(p && p.alive);
  }

  function uniq(arr) {
    return Array.from(new Set((arr || []).filter(Boolean)));
  }

  function sortNum(arr) {
    return (arr || []).slice().sort((a,b)=>a-b);
  }

  /* =========================================================
     resolveNight
     night:
       guardTarget, wolfTarget, witchSave(bool), witchPoisonTarget
       prevGuardTarget (for noConsecutiveGuard)
       ... (seer info 不影響死亡)
  ========================================================= */
  function resolveNight({ players, night, settings }) {
    const meta = {
      // 原始選擇（方便回放/上帝視角）
      guardTargetRaw: night.guardTarget || null,
      wolfTargetRaw: night.wolfTarget || null,
      witchSaveChosen: !!night.witchSave,
      witchPoisonTargetRaw: night.witchPoisonTarget || null,

      // 違規/修正記錄
      invalid: {
        guardConsecutiveFixed: false,
        wolfSkip: false,
        witchSelfSaveBlocked: false
      },

      // 判定標記
      killedByWolf: null,
      killedByPoison: null,
      savedByWitch: false,
      blockedByGuard: false,
      guardAndSavePierce: false, // 3A 奶穿
      causeMap: {} // seat -> "wolf"|"poison"|"guard+save_pierce"|...
    };

    const rules = settings || {};

    // ---- 1) 守衛不能連守（規則開啟才生效）
    let guardTarget = night.guardTarget || null;
    if (rules.noConsecutiveGuard && guardTarget && night.prevGuardTarget && guardTarget === night.prevGuardTarget) {
      // 直接視為本晚守衛無效（你也可改成「強制取消選擇」）
      guardTarget = null;
      meta.invalid.guardConsecutiveFixed = true;
    }

    // ---- 2) 狼人可空刀
    let wolfTarget = night.wolfTarget || null;
    if (!wolfTarget) {
      // 沒選目標
      if (rules.wolfCanSkip) {
        meta.invalid.wolfSkip = true;
        wolfTarget = null;
      } else {
        // 若不允許空刀，規則層不強制補選（交給 UI 防呆）
        wolfTarget = null;
      }
    }

    // ---- 3) 女巫不能自救（如果救的對象是女巫自己 → 取消救）
    let witchSave = !!night.witchSave;
    const witchSeat = players.find(p => p.roleId === "witch")?.seat || null;
    if (rules.witchCannotSelfSave && witchSave && wolfTarget && witchSeat && wolfTarget === witchSeat) {
      witchSave = false;
      meta.invalid.witchSelfSaveBlocked = true;
      meta.witchSelfSaveSeat = witchSeat;
    }

    // ---- 4) 結算狼刀是否生效（先考慮守）
    let wolfKillSeat = null;
    if (wolfTarget && isAlive(players, wolfTarget)) {
      if (guardTarget && guardTarget === wolfTarget) {
        // 守到刀口 → 先視為擋刀
        meta.blockedByGuard = true;
        wolfKillSeat = null;
      } else {
        wolfKillSeat = wolfTarget;
      }
    }

    // ---- 5) 女巫救（只能救狼刀那位；且救了就讓狼刀無效）
    // 注意：若前面被守擋刀，wolfKillSeat 本來就 null，此時救的意義只用於「3A 奶穿」
    let savedByWitch = false;
    if (wolfTarget && witchSave) {
      savedByWitch = true;
      meta.savedByWitch = true;
    }

    // ---- 6) 3A：救同守則奶穿（沒有平安夜）
    // 你選 3A：若守衛守到刀口且女巫也選擇救 → 反而死亡（奶穿）
    // 實作：guardTarget == wolfTarget 且 witchSave==true 且 wolfTarget 存活 → 最終死 wolfTarget
    let pierceSeat = null;
    if (rules.saveAndGuardPierce && wolfTarget && isAlive(players, wolfTarget)) {
      if (guardTarget && guardTarget === wolfTarget && savedByWitch) {
        pierceSeat = wolfTarget;
        meta.guardAndSavePierce = true;
      }
    }

    // ---- 7) 決定最終狼刀死亡
    // 若奶穿成立 → 一定死 pierceSeat
    // 否則若 wolfKillSeat 存在：
    //   - 若 savedByWitch → 不死
    //   - 否則 → 死
    let deaths = [];
    if (pierceSeat) {
      deaths.push(pierceSeat);
      meta.killedByWolf = pierceSeat;
      meta.causeMap[pierceSeat] = "guard+save_pierce";
    } else if (wolfKillSeat) {
      if (savedByWitch) {
        // 被救不死
      } else {
        deaths.push(wolfKillSeat);
        meta.killedByWolf = wolfKillSeat;
        meta.causeMap[wolfKillSeat] = "wolf";
      }
    }

    // ---- 8) 毒藥
    let poisonSeat = night.witchPoisonTarget || null;
    if (poisonSeat && isAlive(players, poisonSeat)) {
      deaths.push(poisonSeat);
      meta.killedByPoison = poisonSeat;
      meta.causeMap[poisonSeat] = "poison";
    } else {
      poisonSeat = null;
    }

    // 去重排序
    deaths = sortNum(uniq(deaths));

    // ---- 9) 回傳
    return {
      deaths,
      meta: {
        ...meta,
        guardTargetFinal: guardTarget,
        wolfTargetFinal: wolfTarget,
        witchSaveFinal: witchSave,
        poisonFinal: poisonSeat
      }
    };
  }

  /* =========================================================
     buildAnnouncement
     - publicText: 玩家可看
     - hiddenText: 上帝可看（包含原因/違規修正/刀口等）
  ========================================================= */
  function buildAnnouncement({ nightNo, dayNo, players, night, resolved, settings }) {
    const deaths = resolved?.deaths || [];
    const meta = resolved?.meta || {};
    const rules = settings || {};

    // 公開公告（玩家）
    let publicText = "";
    if (!deaths.length) {
      publicText = `第${nightNo}夜結束，天亮了。\n昨晚是平安夜。`;
      // 注意：3A 下若守+救奶穿不會平安夜；這句成立表示真的無死
    } else {
      publicText = `第${nightNo}夜結束，天亮了。\n昨晚死亡的是：${deaths.join("、")} 號。`;
    }

    // 隱藏公告（上帝）
    const lines = [];
    lines.push(`【上帝記錄】第${nightNo}夜 / 第${dayNo}天`);
    lines.push(`狼刀：${meta.wolfTargetRaw ? meta.wolfTargetRaw + "號" : "（空刀/未選）"}`);
    lines.push(`守衛：${meta.guardTargetRaw ? meta.guardTargetRaw + "號" : "（未守/無效）"}`);
    if (meta.invalid.guardConsecutiveFixed) lines.push("⚠️ 守衛連守被規則禁止 → 本晚守衛視為無效");
    if (meta.invalid.wolfSkip) lines.push("🐺 本晚狼人選擇空刀（規則允許）");

    // 女巫（若解藥已用過，UI 可能不顯示刀口，但規則依然記錄）
    lines.push(`女巫救：${meta.witchSaveChosen ? "有選救" : "未救"}（最終：${meta.witchSaveFinal ? "有效" : "無/被規則取消"}）`);
    if (meta.invalid.witchSelfSaveBlocked) lines.push("⚠️ 女巫自救被規則禁止 → 取消救人");

    lines.push(`女巫毒：${meta.witchPoisonTargetRaw ? meta.witchPoisonTargetRaw + "號" : "未毒"}`);

    if (meta.blockedByGuard) lines.push("🛡️ 守衛擋刀成立（若同時女巫救，依 3A 可能奶穿）");
    if (meta.guardAndSavePierce) lines.push("💥 3A：救同守奶穿 → 目標反而死亡");

    if (deaths.length) {
      lines.push(`死亡名單：${deaths.join("、")}號`);
      deaths.forEach(s => {
        lines.push(`- ${s}號：原因=${meta.causeMap?.[s] || "unknown"}`);
      });
    } else {
      lines.push("死亡名單：無");
    }

    // 小朋友模式文案（先留接口，後續由 app.js 或 settings 控制要不要加）
    // 若你要放在規則層也可以，先不強塞，避免干擾主公告。

    return {
      publicText,
      hiddenText: lines.join("\n")
    };
  }

  /* =========================================================
     canTriggerDeathSkill
     - 被毒禁用：
       - hunterPoisonNoShoot
       - blackWolfKingPoisonNoSkill
     判斷方式：看 resolved.meta.causeMap[seat] === "poison"
  ========================================================= */
  function canTriggerDeathSkill({ roleId, seat, resolved, settings }) {
    const rules = settings || {};
    const cause = resolved?.meta?.causeMap?.[seat] || null;
    const poisoned = (cause === "poison");

    if (!poisoned) return true;

    if (roleId === "hunter" && rules.hunterPoisonNoShoot) return false;
    if (roleId === "blackWolfKing" && rules.blackWolfKingPoisonNoSkill) return false;

    return true;
  }

  /* =========================================================
     applyLynch (白天處刑)
     - 白痴 2A：被票出不死，但公開並失去投票權
     回傳：
       { type:"lynch"|"idiotReveal", seat, changedAlive, publicText, hiddenText }
  ========================================================= */
  function applyLynch({ players, seat, settings }) {
    const p = seatToPlayer(players, seat);
    if (!p) {
      return { type: "none", seat, changedAlive: false, publicText: "（找不到該玩家）", hiddenText: "" };
    }

    // 若已死
    if (!p.alive) {
      return { type: "none", seat, changedAlive: false, publicText: `【處刑】${seat}號已死亡（無變更）。`, hiddenText: "" };
    }

    // 白痴規則
    if (p.roleId === "idiot") {
      // 不死亡，改狀態
      p.idiotRevealed = true;   // 給 UI/投票流程用
      p.canVote = false;        // 之後投票應跳過或禁止

      return {
        type: "idiotReveal",
        seat,
        changedAlive: false,
        publicText: `【處刑】${seat}號翻牌：白痴！不出局，但從此失去投票權。`,
        hiddenText: `（上帝）白痴翻牌：seat=${seat}，alive=true，canVote=false`
      };
    }

    // 正常處刑：死亡
    p.alive = false;

    return {
      type: "lynch",
      seat,
      changedAlive: true,
      publicText: `【處刑】${seat}號出局。`,
      hiddenText: `（上帝）處刑死亡：seat=${seat} role=${p.roleId} team=${p.team}`
    };
  }

  /* =========================================================
     checkWin（勝負判定骨架）
     - 先做基本：
       - 狼全滅 => 好人勝
       - 狼人數 >= 好人數 => 狼勝（含第三方時需更複雜）
     - 你要求：若有第三方要考慮特殊情況
       => 先保留 hook：thirdWinCheck(state)
  ========================================================= */
  function checkWin({ players, extra = {} }) {
    const alive = players.filter(p => p.alive);

    const wolves = alive.filter(p => p.team === TEAM.WOLF);
    const vill   = alive.filter(p => p.team === TEAM.VILL);
    const third  = alive.filter(p => p.team === TEAM.THIRD);

    // 第三方判定（留接口）
    // extra.thirdWinCheck 需回傳 {winner:"third", detail:"..."} 或 null
    if (typeof extra.thirdWinCheck === "function") {
      const thirdResult = extra.thirdWinCheck({ players, alive, wolves, vill, third, extra });
      if (thirdResult) return thirdResult;
    }

    // 好人勝：狼全滅
    if (wolves.length === 0) {
      return { winner: "villager", detail: "狼人陣營全滅" };
    }

    // 狼勝：狼 >= 好人（不含 third）
    if (wolves.length >= vill.length) {
      return { winner: "wolf", detail: "狼人數已達到或超過好人數" };
    }

    return null; // 未結束
  }

  /* =========================================================
     makeLogItem / exportPayload（給 app.js 用）
  ========================================================= */
  function makeLogItem({ ts, nightNo, dayNo, publicText, hiddenText, votes, actions, resolvedMeta }) {
    return {
      ts,
      nightNo,
      dayNo,
      publicText: publicText || "",
      hiddenText: hiddenText || "",
      votes: votes || null,
      actions: actions || null,
      resolvedMeta: resolvedMeta || null
    };
  }

  function exportPayload({ state, includeSecrets }) {
    // 秘密資訊：玩家身分/夜晚細節/hiddenText
    const safePlayers = state.players.map(p => {
      if (includeSecrets) return p;
      return {
        seat: p.seat,
        alive: p.alive,
        isChief: !!p.isChief,
        idiotRevealed: !!p.idiotRevealed,
        canVote: p.canVote !== false
      };
    });

    const safeLogs = (state.logs || []).map(l => {
      if (includeSecrets) return l;
      return {
        ts: l.ts,
        nightNo: l.nightNo,
        dayNo: l.dayNo,
        publicText: l.publicText
      };
    });

    return {
      exportedAt: new Date().toISOString(),
      includeSecrets: !!includeSecrets,
      boardType: state.boardType,
      playerCount: state.playerCount,
      settings: state.settings,
      players: safePlayers,
      logs: safeLogs
    };
  }

  window.WW_DATA.rulesCore = {
    resolveNight,
    buildAnnouncement,
    canTriggerDeathSkill,
    applyLynch,
    checkWin,
    makeLogItem,
    exportPayload
  };

})();
