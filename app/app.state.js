/* =========================================================
   app/app.state.js
   State Engine
========================================================= */

(function(){
  window.WW_APP = window.WW_APP || {};
  const A = window.WW_APP;
  const W = window.WW_DATA || {};

  const STORAGE_KEY = "ww_god_pwa_v1";

  function deepClone(x){ return JSON.parse(JSON.stringify(x)); }

  function rolesTotal(rolesCount){
    return Object.values(rolesCount||{}).reduce((a,b)=>a+(b||0),0);
  }

  function freshRules(){
    return {
      // 你指定預設開關
      noConsecutiveGuard: true,
      wolfCanSkipKill: true,
      witchCannotSelfSave: true,
      hunterPoisonNoShoot: true,
      blackWolfKingPoisonNoSkill: true,

      // 你指定：救同守則奶穿（無平安夜）
      guardAndSavePierce: true
    };
  }

  function freshState(){
    // basic default 9人：2狼 預女獵 守 3民（你可在 boards preset 覆蓋）
    const defaultRoles = {
      werewolf:2,
      seer:1,
      witch:1,
      hunter:1,
      guard:1,
      villager:3
    };

    return {
      // meta
      phase: "setup",
      boardId: "basic",

      // god
      pin: "0000",
      godUnlocked: false,
      godView: false,

      // setup
      playerCount: 9,
      rolesCount: deepClone(defaultRoles),

      // rules
      rules: freshRules(),

      // game
      players: [],
      dealIndex: 0,

      nightNo: 1,
      dayNo: 1,

      night: {
        guardTarget: null,
        wolfTarget: null, // null means skip if wolfCanSkipKill
        seerCheckTarget: null,
        seerResult: null,

        witchSaveUsed: false,
        witchPoisonUsed: false,
        witchSave: false,
        witchPoisonTarget: null,

        prevGuardTarget: null
      },

      nightSteps: [],
      nightStepIndex: 0,

      // logs
      logs: [],

      // end
      winner: null,
      endReason: ""
    };
  }

  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return null;
      const s = JSON.parse(raw);

      // minimal guards
      if(!s || !Array.isArray(s.players)) return null;

      // merge rules defaults to avoid missing keys
      s.rules = Object.assign(freshRules(), s.rules || {});
      s.night = Object.assign(freshState().night, s.night || {});
      s.rolesCount = s.rolesCount || deepClone(freshState().rolesCount);
      s.logs = s.logs || [];
      s.boardId = s.boardId || "basic";
      s.phase = s.phase || "setup";
      return s;
    }catch(e){
      return null;
    }
  }

  function save(state){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }catch(e){}
  }

  function clear(){
    try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
  }

  function setPlayerCount(state, n){
    const v = Math.max(6, Math.min(12, Number(n)||9)); // 先做 6-12（你要求）
    state.playerCount = v;
  }

  function buildPlayersFromRoles(state, roleInfoFn){
    // Expand rolesCount
    const pool = [];
    Object.entries(state.rolesCount||{}).forEach(([rid,cnt])=>{
      for(let i=0;i<(cnt||0);i++) pool.push(rid);
    });

    // shuffle
    for(let i=pool.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    state.players = pool.map((rid, idx)=>{
      const info = roleInfoFn(rid) || {};
      return {
        seat: idx+1,
        roleId: rid,
        team: info.team || "villager",
        alive: true,
        isChief: false,
        notes: ""
      };
    });

    state.dealIndex = 0;
    state.nightNo = 1;
    state.dayNo = 1;
    state.logs = [];
    state.winner = null;
    state.endReason = "";

    // reset night
    state.night = Object.assign(freshState().night, {
      witchSaveUsed: false,
      witchPoisonUsed: false,
      prevGuardTarget: null
    });

    // build night steps now? (after deal finish will rebuild)
    state.nightSteps = [];
    state.nightStepIndex = 0;
  }

  function resetNightActionsKeepConsumables(state){
    const prevGuard = state.night.prevGuardTarget ?? null;
    const saveUsed = !!state.night.witchSaveUsed;
    const poisonUsed = !!state.night.witchPoisonUsed;

    state.night = Object.assign(freshState().night, {
      witchSaveUsed: saveUsed,
      witchPoisonUsed: poisonUsed,
      prevGuardTarget: prevGuard
    });
  }

  function goToNight(state){
    state.phase = "night";
    resetNightActionsKeepConsumables(state);
    state.nightSteps = (W.nightSteps?.buildNightSteps)
      ? W.nightSteps.buildNightSteps(state.players, state.night, state.rules, state.boardId)
      : [];
    state.nightStepIndex = 0;
  }

  function resolveNightToDay(state){
    if(!W.rulesCore) throw new Error("missing WW_DATA.rulesCore");

    const resolved = W.rulesCore.resolveNight({
      players: state.players,
      night: state.night,
      settings: state.rules
    });

    // apply deaths
    (resolved.deaths || []).forEach(seat=>{
      const p = state.players.find(x=>x.seat===seat);
      if(p) p.alive = false;
    });

    // lock witch consumables
    if(state.night.witchSave) state.night.witchSaveUsed = true;
    if(state.night.witchPoisonTarget) state.night.witchPoisonUsed = true;

    // remember guard target for consecutive guard rule
    state.night.prevGuardTarget = resolved?.meta?.guardTargetRaw ?? state.night.guardTarget ?? state.night.prevGuardTarget;

    // announcement
    const ann = W.rulesCore.buildAnnouncement({
      nightNo: state.nightNo,
      dayNo: state.dayNo,
      players: state.players,
      night: state.night,
      resolved,
      settings: state.rules
    });

    const logItem = W.rulesCore.makeLogItem({
      ts: new Date().toISOString(),
      nightNo: state.nightNo,
      dayNo: state.dayNo,
      publicText: ann.publicText,
      hiddenText: ann.hiddenText,
      votes: null,
      actions: {
        night: {
          guardTarget: state.night.guardTarget,
          wolfTarget: state.night.wolfTarget,
          seerCheckTarget: state.night.seerCheckTarget,
          seerResult: state.night.seerResult,
          witchSave: state.night.witchSave,
          witchPoisonTarget: state.night.witchPoisonTarget,
          witchSaveUsed: state.night.witchSaveUsed,
          witchPoisonUsed: state.night.witchPoisonUsed
        }
      },
      resolvedMeta: resolved.meta || null
    });

    state.logs.unshift(logItem);

    // go day
    state.phase = "day";
  }

  function goNextNight(state){
    // after day ends -> increment
    state.nightNo += 1;
    state.dayNo += 1;
    goToNight(state);
  }

  function checkWinAndMaybeEnd(state){
    if(!W.rulesCore) return false;
    const r = W.rulesCore.checkWin(state.players);
    if(r.ended){
      state.phase = "end";
      state.winner = r.winner;
      state.endReason = r.reason || "";
      // also add final log
      state.logs.unshift({
        ts: new Date().toISOString(),
        nightNo: state.nightNo,
        dayNo: state.dayNo,
        publicText: `🏁 遊戲結束：${state.winner==="wolf"?"邪惡陣營獲勝":state.winner==="villager"?"正義聯盟獲勝":"第三方獲勝"}\n${state.endReason}`,
        hiddenText: "",
        votes: null,
        actions: { end: { winner: state.winner, reason: state.endReason } }
      });
      return true;
    }
    return false;
  }

  function exportReplay(state, includeSecrets){
    const clean = deepClone(state);
    if(!includeSecrets){
      // remove identities
      clean.players = clean.players.map(p=>({
        seat: p.seat,
        alive: p.alive,
        isChief: p.isChief
      }));
      // also hide hidden logs
      clean.logs = (clean.logs||[]).map(l=>({
        ts:l.ts, nightNo:l.nightNo, dayNo:l.dayNo,
        publicText:l.publicText,
        hiddenText:"",
        votes:l.votes || null,
        actions:null
      }));
    }
    return {
      exportedAt: new Date().toISOString(),
      includeSecrets: !!includeSecrets,
      replay: clean
    };
  }

  A.State = {
    STORAGE_KEY,
    rolesTotal,
    freshState,
    freshRules,
    load,
    save,
    clear,
    setPlayerCount,
    buildPlayersFromRoles,
    goToNight,
    resolveNightToDay,
    goNextNight,
    checkWinAndMaybeEnd,
    exportReplay
  };
})();