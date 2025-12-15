/* =========================================================
   狼人殺｜規則核心引擎（共用）
   檔案：data/rules/rules.core.js

   ✅ 工具：玩家查詢、存活、陣營統計
   ✅ 夜晚結算共用：狼刀/守衛/女巫救/毒
   ✅ 規則開關（由 boards.config.js defaultRules 提供）
   - noConsecutiveGuard：守衛不能連守
   - witchCannotSelfSave：女巫不能自救
   - hunterPoisonNoShoot：獵人被毒不能開槍
   - blackWolfKingPoisonNoSkill：黑狼王被毒不能用技能
   - wolfCanSkip：狼人可空刀
   - saveSameAsGuardNoPeace：救同守 → 奶穿（沒有平安夜）
========================================================= */

(function () {
  const ROLES = window.WW_ROLES || {};

  /* =========================
     基本查詢
  ========================= */
  const bySeat = (players, seat) => players.find(p => p.seat === seat);
  const alive = (players) => players.filter(p => p.alive);
  const aliveSeats = (players) => alive(players).map(p => p.seat);

  const roleOf = (players, seat) => {
    const p = bySeat(players, seat);
    if (!p) return null;
    return ROLES[p.roleId] || null;
  };

  const hasRoleIdAlive = (players, roleId) =>
    alive(players).some(p => p.roleId === roleId);

  const findSeatByRoleId = (players, roleId) =>
    players.find(p => p.roleId === roleId)?.seat ?? null;

  const campOfSeat = (players, seat) => {
    const r = roleOf(players, seat);
    return r?.camp || "villager";
  };

  /* =========================
     工具：去重
  ========================= */
  const uniq = (arr) => Array.from(new Set((arr || []).filter(Boolean)));

  /* =========================
     規則合法性檢查
  ========================= */
  function validateGuardTarget({ players, night, rules }) {
    // 守衛不能連守：本夜 guardTarget 不能等於 prevGuardTarget
    if (!rules?.noConsecutiveGuard) return { ok: true };
    const g = night.guardTarget;
    const prev = night.prevGuardTarget;
    if (!g || !prev) return { ok: true };
    if (g === prev) return { ok: false, reason: "noConsecutiveGuard" };
    return { ok: true };
  }

  function validateWitchSave({ players, night, rules }) {
    // 女巫不能自救：wolfTarget 是女巫自己時，witchSave 即使點了也視為無效
    if (!rules?.witchCannotSelfSave) return { ok: true };
    if (!night.witchSave) return { ok: true };

    const witchSeat = findSeatByRoleId(players, "witch");
    if (!witchSeat) return { ok: true };

    if (night.wolfTarget && night.wolfTarget === witchSeat) {
      return { ok: false, reason: "witchCannotSelfSave" };
    }
    return { ok: true };
  }

  /* =========================
     夜晚共用結算（MVP+你要求的奶穿）
     輸入 night:
     - wolfTarget
     - guardTarget
     - prevGuardTarget
     - witchSave (boolean)
     - witchPoisonTarget
     輸出：
     - deaths: [seat...]
     - meta: { killedByWolf, killedByPoison, blockedByGuard, savedByWitch, milkPierce }
========================================================= */
  function resolveNightCommon({ players, night, rules }) {
    const meta = {
      wolfTargetRaw: night.wolfTarget || null,
      guardTargetRaw: night.guardTarget || null,
      savedByWitch: false,
      blockedByGuard: false,
      milkPierce: false,
      killedByWolf: null,      // seat or null
      killedByPoison: null,    // seat or null
      poisonDeaths: [],        // seats
      wolfDeaths: []           // seats
    };

    const deaths = [];

    // 1) 狼刀
    let wolfVictim = night.wolfTarget || null;

    // 2) 守衛不能連守（若違規：守衛守護視為無效）
    const guardCheck = validateGuardTarget({ players, night, rules });
    const guardTargetEffective = guardCheck.ok ? night.guardTarget : null;

    // 3) 判斷守衛擋刀
    const guarded = wolfVictim && guardTargetEffective && wolfVictim === guardTargetEffective;

    // 4) 女巫救（含不能自救檢查）
    const witchSaveCheck = validateWitchSave({ players, night, rules });
    const witchSaveEffective = night.witchSave && witchSaveCheck.ok;

    // 5) 奶穿規則：救同守 → 沒有平安夜（直接視為死亡）
    // 你的描述：「救同守則奶穿沒有平安夜」
    // 我這裡解讀為：同一晚狼刀目標同時被守、且女巫又救 → 仍然死（奶穿）
    // 若你之後要改成其他解讀，我們只改這一段。
    const saveSameAsGuardNoPeace = !!rules?.saveSameAsGuardNoPeace;

    if (wolfVictim) {
      if (guarded && witchSaveEffective && saveSameAsGuardNoPeace) {
        // 奶穿：兩種保護同時作用反而失效
        meta.milkPierce = true;
        deaths.push(wolfVictim);
        meta.killedByWolf = wolfVictim;
        meta.wolfDeaths.push(wolfVictim);
      } else if (guarded) {
        meta.blockedByGuard = true;
        // 平安（至少擋掉狼刀）
      } else if (witchSaveEffective) {
        meta.savedByWitch = true;
        // 平安（女巫救掉狼刀）
      } else {
        deaths.push(wolfVictim);
        meta.killedByWolf = wolfVictim;
        meta.wolfDeaths.push(wolfVictim);
      }
    }

    // 6) 女巫毒（可與狼刀同晚雙死）
    if (night.witchPoisonTarget) {
      const t = night.witchPoisonTarget;
      deaths.push(t);
      meta.killedByPoison = t;
      meta.poisonDeaths.push(t);
    }

    return {
      deaths: uniq(deaths),
      meta,
      checks: {
        guardCheck,
        witchSaveCheck
      }
    };
  }

  /* =========================
     被毒判定（給技能禁用）
     - resolved.meta.poisonDeaths 內含被毒死亡座位
  ========================= */
  function isPoisonDeath(resolved, seat) {
    return !!resolved?.meta?.poisonDeaths?.includes(seat);
  }

  /* =========================
     對外輸出
  ========================= */
  window.WW_RULES_CORE = {
    bySeat,
    alive,
    aliveSeats,
    roleOf,
    campOfSeat,
    hasRoleIdAlive,
    findSeatByRoleId,
    uniq,

    validateGuardTarget,
    validateWitchSave,
    resolveNightCommon,
    isPoisonDeath
  };
})();