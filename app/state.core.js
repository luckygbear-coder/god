/* =========================================================
   狼人殺｜State Core（全局狀態機骨架）
   檔案：app/state.core.js

   依賴：
   - window.WW_DATA（data/ww.data.js）
   - window.WW_NIGHT_STEPS.buildNightSteps（data/flow/night.steps.js）
   - window.WW_DAY_FLOW（data/flow/day.flow.js）
========================================================= */

(function () {
  const STORAGE_KEY = "ww_god_pwa_v1";

  const nowISO = () => new Date().toISOString();

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  function roleInfo(roleId) {
    return window.WW_DATA?.roles?.[roleId] || { id: roleId, name: roleId, team: "villager", icon: "❔" };
  }

  function normalizeConfigToN(n, config) {
    const out = { ...config };
    const total = Object.values(out).reduce((a, b) => a + (b || 0), 0);
    const diff = n - total;
    out.villager = (out.villager || 0) + diff;
    if (out.villager < 0) out.villager = 0;
    return out;
  }

  function buildPlayersFromConfig(playerCount, roleCounts) {
    const rolesArr = [];
    Object.entries(roleCounts).forEach(([rid, cnt]) => {
      for (let i = 0; i < (cnt || 0); i++) rolesArr.push(rid);
    });

    // shuffle
    for (let i = rolesArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rolesArr[i], rolesArr[j]] = [rolesArr[j], rolesArr[i]];
    }

    return rolesArr.slice(0, playerCount).map((rid, idx) => {
      const info = roleInfo(rid);
      return {
        seat: idx + 1,
        roleId: rid,
        team: info.team || "villager",
        alive: true,
        isChief: false,
        notes: ""
      };
    });
  }

  function makeInitialState() {
    const WW = window.WW_DATA;
    const boardId = "basic";
    const n = 9;
    const preset = WW?.boards?.basic?.presets?.[n] || { werewolf: 2, villager: 4, seer: 1, witch: 1, hunter: 1 };
    return {
      version: "1.0.0",
      phase: "setup", // setup | deal | night | day | end
      boardId,
      playerCount: n,
      roleCounts: normalizeConfigToN(n, preset),

      // 視角
      god: { pin: "0000", unlocked: false, view: false },

      // 規則
      rules: { ...((WW && WW.defaultRules) || {}) },

      // 玩家
      players: [],

      // 抽牌
      dealIndex: 0,

      // 日夜
      nightNo: 1,
      dayNo: 1,

      // 夜晚狀態（每晚重置，但保留 prevGuardTarget 與已用藥）
      night: {
        guardTarget: null,
        wolfTarget: null,          // null = 空刀
        seerCheckTarget: null,
        seerResult: null,          // "wolf"/"villager"
        witchSave: false,
        witchPoisonTarget: null,

        witchSaveUsed: false,
        witchPoisonUsed: false,

        prevGuardTarget: null
      },

      // 夜晚流程
      nightSteps: [],
      nightStepIndex: 0,

      // 白天流程 sessions
      day: {
        police: null,
        speech: null,
        vote: null,

        tieRoundUsed: false // 讓 UI 知道是否已進第二輪（平票第二次 → 無放逐）
      },

      // 公告與復盤
      logs: [], // 每天一筆 {ts, nightNo, dayNo, publicText, hiddenText, votes, actions}

      // 本次夜晚結算結果（供死亡技能/公告）
      lastResolved: null,

      // 結局
      gameOver: null // { winner, reason }
    };
  }

  /* =========================
     夜晚初始化/推進
  ========================= */
  function resetNightForNewNight(state) {
    // 保留：prevGuardTarget、已用藥
    const prevGuard = state.night.prevGuardTarget ?? null;
    const saveUsed = !!state.night.witchSaveUsed;
    const poisonUsed = !!state.night.witchPoisonUsed;

    state.night = {
      guardTarget: null,
      wolfTarget: null,
      seerCheckTarget: null,
      seerResult: null,
      witchSave: false,
      witchPoisonTarget: null,

      witchSaveUsed: saveUsed,
      witchPoisonUsed: poisonUsed,

      prevGuardTarget: prevGuard
    };

    state.nightSteps = window.WW_NIGHT_STEPS.buildNightSteps(
      state.players,
      state.night,
      { rules: state.rules }
    );
    state.nightStepIndex = 0;
  }

  function resolveNight(state, kidMode = false) {
    const rulesCore = window.WW_DATA.rulesCore;

    const resolved = rulesCore.resolveNight({
      players: state.players,
      night: state.night,
      rules: state.rules
    });
    state.lastResolved = resolved;

    // 用藥消耗鎖定
    if (state.night.witchSave) state.night.witchSaveUsed = true;
    if (state.night.witchPoisonTarget) state.night.witchPoisonUsed = true;

    // 記錄本晚守衛目標（供下一晚判連守）
    state.night.prevGuardTarget = resolved?.meta?.guardTargetFinal ?? state.night.guardTarget ?? state.night.prevGuardTarget;

    // 實際死亡
    (resolved.deaths || []).forEach(seat => {
      const p = state.players.find(x => x.seat === seat);
      if (p) p.alive = false;
    });

    // 公告文案
    const publicText = rulesCore.buildNightPublicText({
      nightNo: state.nightNo,
      dayNo: state.dayNo,
      resolved,
      rules: state.rules,
      kidMode
    });

    const hiddenText = rulesCore.buildNightHiddenText({
      players: state.players,
      night: state.night,
      resolved,
      rules: state.rules
    });

    state.logs.unshift({
      ts: nowISO(),
      nightNo: state.nightNo,
      dayNo: state.dayNo,
      publicText,
      hiddenText,
      votes: null,
      actions: { night: deepClone(state.night) },
      resolvedMeta: resolved.meta || null
    });

    // 勝負判定
    const win = rulesCore.checkWin(state.players);
    if (win.ended) {
      state.phase = "end";
      state.gameOver = { winner: win.winner, reason: win.reason };
      return;
    }

    // 進入白天
    state.phase = "day";

    // 白天 session 初始化（由 UI 決定何時開啟/顯示）
    state.day.police = window.WW_DAY_FLOW.createPoliceSession(state.players);
    state.day.speech = null;
    state.day.vote = null;
    state.day.tieRoundUsed = false;
  }

  function nextDayToNight(state) {
    // 結束一天 → 進下一夜
    state.dayNo += 1;
    state.nightNo += 1;
    state.phase = "night";
    resetNightForNewNight(state);
  }

  /* =========================
     對外 API
  ========================= */
  const api = {
    STORAGE_KEY,
    save,
    load,
    clear,

    makeInitialState,
    buildPlayersFromConfig,
    normalizeConfigToN,

    resetNightForNewNight,
    resolveNight,
    nextDayToNight
  };

  window.WW_STATE_CORE = api;

})();
