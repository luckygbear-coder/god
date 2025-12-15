/* =========================================================
   app/app.state.js
   狀態機（不含 UI）
   - State 結構
   - 存檔/載入
   - 換日換夜
   - 勝負判定（rulesCore.checkWin）
   - 匯出復盤 JSON
========================================================= */

(function(){
  window.WW_APP = window.WW_APP || {};
  const A = window.WW_APP;
  const W = window.WW_DATA || {};

  const STORAGE_KEY = "ww_god_pwa_v1_state";
  const STATE_VERSION = 1;

  const nowISO = () => new Date().toISOString();

  function defaultRules(){
    return {
      // 你要求：預設開
      noConsecutiveGuard: true,
      wolfCanSkipKill: true,
      witchCannotSelfSave: true,
      hunterPoisonNoShoot: true,
      blackWolfKingPoisonNoSkill: true,
      guardAndSavePierce: true
    };
  }

  function suggestBasicConfigByCount(n){
    // 先做 6~12 MVP（你要 6-12）
    // 可後續改到 boards.basic.js 內更精準
    const wolves = (n >= 9) ? 2 : 1;
    const fixed = 1/*seer*/ + 1/*witch*/ + 1/*hunter*/;
    const villager = Math.max(0, n - wolves - fixed);
    return { werewolf:wolves, seer:1, witch:1, hunter:1, villager };
  }

  function freshState(){
    return {
      version: STATE_VERSION,
      createdAt: nowISO(),

      // 視角（UI 可切）
      godUnlocked: false,
      godView: false,
      pin: "0000",

      // 模式
      kidsMode: false,

      // setup
      boardId: "basic",        // basic | b1
      playerCount: 9,
      rolesCount: suggestBasicConfigByCount(9),
      rules: defaultRules(),

      // runtime
      phase: "setup",          // setup | deal | night | day | end
      players: [],
      dealIndex: 0,

      nightNo: 1,
      dayNo: 1,

      night: {
        // core actions
        guardTarget: null,
        prevGuardTarget: null,
        wolfTarget: null,            // null=空刀
        seerCheckTarget: null,
        seerResult: null,

        witchSaveUsed: false,
        witchPoisonUsed: false,
        witchSave: false,
        witchPoisonTarget: null,

        // special night cache
        _cache: {}
      },

      // wizard steps
      nightSteps: [],
      nightStepIndex: 0,

      // day sessions (engine states)
      policeSession: null,
      speechSession: null,
      voteSession: null,

      // logs
      logs: [],   // [{ts, nightNo, dayNo, publicText, hiddenText, votes, actions, resolvedMeta}]
      lastResolved: null,

      // end
      ended: false,
      winner: null,     // "wolf"|"villager"|"third"
      endReason: ""
    };
  }

  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return null;
      const obj = JSON.parse(raw);
      if(!obj || obj.version !== STATE_VERSION) return null;
      return obj;
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

  function resetToSetup(){
    clear();
    return freshState();
  }

  function setBoard(state, boardId){
    state.boardId = boardId;
  }

  function setPlayerCount(state, n){
    state.playerCount = Math.max(6, Math.min(12, Number(n)||9));
    // 先讓 basic 自動建議；特殊板由 boards.b1.js 處理（之後接）
    if(state.boardId === "basic"){
      state.rolesCount = suggestBasicConfigByCount(state.playerCount);
    }
  }

  function rolesTotal(rolesCount){
    return Object.values(rolesCount||{}).reduce((a,b)=>a+(b||0),0);
  }

  function buildPlayersFromRoles(state, roleInfoFn){
    // roleInfoFn: (roleId)=>{team,...}
    const rolesArr = [];
    Object.entries(state.rolesCount||{}).forEach(([rid,cnt])=>{
      for(let i=0;i<(cnt||0);i++) rolesArr.push(rid);
    });

    // shuffle
    for(let i=rolesArr.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [rolesArr[i],rolesArr[j]] = [rolesArr[j],rolesArr[i]];
    }

    state.players = rolesArr.map((rid, idx)=>({
      seat: idx+1,
      roleId: rid,
      team: roleInfoFn?.(rid)?.team || "villager",
      alive: true,
      isChief: false,
      notes: ""
    }));

    state.dealIndex = 0;
    state.phase = "deal";
    state.logs = [];
    state.lastResolved = null;
    state.nightNo = 1;
    state.dayNo = 1;

    // reset night
    state.night = {
      guardTarget: null,
      prevGuardTarget: null,
      wolfTarget: null,
      seerCheckTarget: null,
      seerResult: null,
      witchSaveUsed: false,
      witchPoisonUsed: false,
      witchSave: false,
      witchPoisonTarget: null,
      _cache: {}
    };

    // reset sessions
    state.policeSession = null;
    state.speechSession = null;
    state.voteSession = null;
  }

  function initNightSteps(state){
    // 依板子決定 steps builder
    if(state.boardId === "basic" && typeof W.nightStepsBasic === "function"){
      state.nightSteps = W.nightStepsBasic(state.players, state.night);
    }else if(state.boardId === "b1" && typeof W.nightStepsSpecial === "function"){
      state.nightSteps = W.nightStepsSpecial(state.players, state.night, { nightNo: state.nightNo });
    }else{
      // fallback
      state.nightSteps = [
        {key:"close", type:"info", publicScript:"天黑請閉眼。", godScript:"天黑請閉眼。"},
        {key:"wolf", type:"pick", pickTarget:"wolfTarget", allowNone:true, required:false, publicScript:"狼人請睜眼。", godScript:"狼人刀誰？（可空刀）"},
        {key:"resolve", type:"resolve", publicScript:"天亮請睜眼。", godScript:"天亮請睜眼。"}
      ];
    }
    state.nightStepIndex = 0;
  }

  function goToNight(state){
    state.phase = "night";

    // reset night actions but keep "used" flags + prevGuardTarget
    const prev = state.night.prevGuardTarget ?? null;
    const saveUsed = !!state.night.witchSaveUsed;
    const poisonUsed = !!state.night.witchPoisonUsed;

    state.night.guardTarget = null;
    state.night.wolfTarget = null;
    state.night.seerCheckTarget = null;
    state.night.seerResult = null;

    state.night.witchSave = false;
    state.night.witchPoisonTarget = null;

    state.night.prevGuardTarget = prev;
    state.night.witchSaveUsed = saveUsed;
    state.night.witchPoisonUsed = poisonUsed;

    state.night._cache = {};
    initNightSteps(state);
  }

  function resolveNightToDay(state){
    const core = W.rulesCore;
    if(!core) throw new Error("rulesCore missing");

    const resolved = core.resolveNight({
      players: state.players,
      night: state.night,
      settings: state.rules
    });
    state.lastResolved = resolved;

    // 套用死亡
    resolved.deaths.forEach(seat=>{
      const p = state.players.find(x=>x.seat===seat);
      if(p) p.alive = false;
    });

    // 用藥鎖定（只要女巫選了）
    // 是否有效（自救無效/奶穿）在 resolveNight 會反映 meta
    if(state.night.witchSave) state.night.witchSaveUsed = true;
    if(state.night.witchPoisonTarget) state.night.witchPoisonUsed = true;

    // 記錄 prevGuardTarget 供不能連守
    state.night.prevGuardTarget = resolved?.meta?.guardTargetRaw ?? state.night.guardTarget ?? state.night.prevGuardTarget;

    // 生成公告
    const { publicText, hiddenText } = core.buildAnnouncement({
      nightNo: state.nightNo,
      dayNo: state.dayNo,
      players: state.players,
      night: state.night,
      resolved,
      settings: state.rules
    });

    // log
    const item = core.makeLogItem({
      ts: nowISO(),
      nightNo: state.nightNo,
      dayNo: state.dayNo,
      publicText,
      hiddenText,
      votes: null,
      actions: { night: deepClone(state.night) },
      resolvedMeta: resolved.meta || null
    });
    state.logs.unshift(item);

    // 進入白天
    state.phase = "day";
  }

  function goNextNight(state){
    // 白天結束 -> 進下一夜
    state.nightNo += 1;
    state.dayNo += 1;
    goToNight(state);
  }

  function checkWinAndMaybeEnd(state){
    const core = W.rulesCore;
    if(!core || typeof core.checkWin !== "function") return false;

    const r = core.checkWin(state.players);
    if(r.ended){
      state.phase = "end";
      state.ended = true;
      state.winner = r.winner;
      state.endReason = r.reason;

      // 加入結局公告（public）
      const publicText =
        (r.winner === "villager")
          ? `🎉 遊戲結束：正義聯盟獲勝！\n原因：${r.reason}`
          : (r.winner === "wolf")
            ? `🐺 遊戲結束：邪惡陣營獲勝！\n原因：${r.reason}`
            : `🏁 遊戲結束：第三方獲勝！\n原因：${r.reason}`;

      state.logs.unshift({
        ts: nowISO(),
        nightNo: state.nightNo,
        dayNo: state.dayNo,
        publicText,
        hiddenText: `（上帝）winner=${r.winner}`,
        votes: null,
        actions: null,
        resolvedMeta: null
      });

      return true;
    }
    return false;
  }

  function exportReplay(state, includeSecrets){
    // includeSecrets：上帝視角才 true
    return {
      exportedAt: nowISO(),
      includeSecrets: !!includeSecrets,
      version: state.version,
      boardId: state.boardId,
      playerCount: state.playerCount,
      rules: deepClone(state.rules),
      ended: state.ended,
      winner: state.winner,
      endReason: state.endReason,
      // players：若不含 secrets，可把 roleId/team 抹掉
      players: state.players.map(p=>{
        if(includeSecrets) return deepClone(p);
        return { seat:p.seat, alive:p.alive, isChief:p.isChief };
      }),
      logs: includeSecrets ? deepClone(state.logs) : state.logs.map(l=>({
        ts:l.ts, nightNo:l.nightNo, dayNo:l.dayNo, publicText:l.publicText
      })),
    };
  }

  // Export API
  A.State = {
    freshState,
    load,
    save,
    clear,
    resetToSetup,

    setBoard,
    setPlayerCount,
    rolesTotal,

    buildPlayersFromRoles,
    goToNight,
    resolveNightToDay,
    goNextNight,
    checkWinAndMaybeEnd,

    exportReplay
  };

})();