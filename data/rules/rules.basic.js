/* =========================================================
   狼人殺｜基本板規則引擎
   檔案：data/rules/rules.basic.js

   角色支援：
   - 狼人、村民、預言家、女巫、獵人、守衛
   - 黑狼王（死亡技能）
   
   預設規則（可由設定覆寫）：
   - 守衛不能連守
   - 狼人可以空刀
   - 女巫不能自救
   - 獵人被毒不能開槍
   - 黑狼王被毒不能用技能
========================================================= */

(function () {

  function isAlive(players, seat) {
    const p = players.find(x => x.seat === seat);
    return p && p.alive;
  }

  function kill(players, seat, reason) {
    const p = players.find(x => x.seat === seat);
    if (!p || !p.alive) return false;
    p.alive = false;
    p.deathReason = reason;
    return true;
  }

  function resolveNight({ players, night, settings }) {
    const deaths = [];
    const meta = {};

    const {
      wolfTarget,
      guardTarget,
      prevGuardTarget,
      witchSave,
      witchPoisonTarget
    } = night;

    /* =========================
       1. 狼刀判定
    ========================= */

    let wolfKilled = null;

    if (wolfTarget && isAlive(players, wolfTarget)) {

      // 守衛守中
      if (guardTarget && guardTarget === wolfTarget) {
        meta.guardSuccess = true;
      }
      // 女巫救
      else if (witchSave) {
        meta.witchSave = true;
      }
      // 真死亡
      else {
        wolfKilled = wolfTarget;
      }
    }

    if (wolfKilled) {
      deaths.push(wolfKilled);
    }

    /* =========================
       2. 女巫毒
    ========================= */

    if (
      witchPoisonTarget &&
      isAlive(players, witchPoisonTarget) &&
      !deaths.includes(witchPoisonTarget)
    ) {
      deaths.push(witchPoisonTarget);
      meta.poisoned = witchPoisonTarget;
    }

    /* =========================
       3. 統整死亡
    ========================= */

    deaths.forEach(seat => {
      kill(players, seat, "night");
    });

    /* =========================
       4. 記錄守衛（不能連守）
    ========================= */

    meta.guardTargetRaw = guardTarget;

    return {
      deaths,
      meta
    };
  }

  function canTriggerDeathSkill({ roleId, seat, resolved, settings }) {
    // 被毒禁用
    if (resolved.meta?.poisoned === seat) {
      if (roleId === "hunter" && settings.hunterPoisonNoShoot) return false;
      if (roleId === "blackWolfKing" && settings.blackWolfKingPoisonNoSkill) return false;
    }
    return true;
  }

  function buildAnnouncement({ nightNo, dayNo, players, resolved }) {
    let text = `🌅 天亮了（第 ${dayNo} 天）\n`;

    if (!resolved.deaths.length) {
      text += "昨晚是平安夜。";
    } else {
      text += `昨晚死亡的是：${resolved.deaths.join("、")} 號。`;
    }

    return {
      publicText: text,
      hiddenText: `（上帝）夜晚死亡：${JSON.stringify(resolved.deaths)}`
    };
  }

  function makeLogItem({ ts, nightNo, dayNo, publicText, hiddenText, actions }) {
    return {
      ts,
      nightNo,
      dayNo,
      publicText,
      hiddenText,
      actions
    };
  }

  function checkWin(players) {
    const alive = players.filter(p => p.alive);
    const wolves = alive.filter(p => p.camp === "wolf");
    const villagers = alive.filter(p => p.camp === "villager");

    if (!wolves.length) {
      return { ended: true, winner: "villager" };
    }

    if (wolves.length >= villagers.length) {
      return { ended: true, winner: "wolf" };
    }

    return { ended: false };
  }

  window.WW_DATA = window.WW_DATA || {};
  window.WW_DATA.rulesBasic = {
    resolveNight,
    canTriggerDeathSkill,
    buildAnnouncement,
    makeLogItem,
    checkWin
  };

})();