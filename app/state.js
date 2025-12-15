/* =========================================================
   狼人殺｜上帝輔助 PWA
   檔案：/app/state.js

   ✅ State 中央管理
   - load/save/clear
   - newGame()：依 boards.* presets 建立玩家 + 抽牌
   - resetToSetup()：回到設定頁（需外層 UI confirm）
========================================================= */

(function () {
  window.WW = window.WW || {};
  window.WW_DATA = window.WW_DATA || {};

  const STORAGE_KEY = "ww_god_pwa_v1";
  const VERSION = 1;

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function deepClone(obj){
    return JSON.parse(JSON.stringify(obj));
  }

  function defaultRules(){
    return {
      // 你確認的預設開關（3.1）
      noConsecutiveGuard: true,
      wolfCanSkip: true,
      witchCannotSelfSave: true,
      hunterPoisonNoShoot: true,
      blackWolfKingPoisonNoSkill: true,

      // 你確認：3A（救同守奶穿＝沒有平安夜）
      saveAndGuardPierce: true,

      // 你確認：平票第二次無人放逐（在 vote 引擎 + day 控制實作）
      tieSecondNoLynch: true,

      // 白痴規則 2A（已在 rules.core.applyLynch）
      idiotRevealNoDeath: true
    };
  }

  function defaultState(){
    return {
      version: VERSION,

      // 上帝視角
      godUnlocked: false,
      godView: false,
      pin: "0000",

      // 設定
      boardId: "basic",          // basic | b1
      playerCount: 9,            // 6~12（目前階段）
      rolesCount: null,          // 開局後會填入，可手動調整
      settings: {
        rules: defaultRules(),
        kidsMode: false
      },

      // 流程
      phase: "setup",            // setup | deal | night | day
      dealIndex: 0,

      nightNo: 1,
      dayNo: 1,

      // 玩家（開局後）
      players: [],

      // 夜晚狀態（每夜重置）
      night: {
        guardTarget: null,
        wolfTarget: null,
        seerCheckTarget: null,
        seerResult: null,

        // 女巫
        witchSaveUsed: false,
        witchPoisonUsed: false,
        witchSave: false,
        witchPoisonTarget: null,

        // 守衛連守記錄
        prevGuardTarget: null
      },

      // 夜晚步驟
      nightSteps: [],
      nightStepIndex: 0,

      // 白天 session（由 day.js 建立）
      policeSession: null,
      voteSession: null,
      tieRound: 0,               // 0=未進平票；1=第一次平票；2=第二次平票（第二次無人放逐）

      // 技能佇列（獵人/黑狼王等死亡技能）
      skillQueue: [],
      lastResolved: null,

      // 公告/復盤
      logs: []
    };
  }

  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return null;
      const obj = JSON.parse(raw);
      if(!obj || obj.version !== VERSION) return null;
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

  function suggestRolesByBoard(boardId, n){
    const board = window.WW_DATA.getBoard ? window.WW_DATA.getBoard(boardId) : (window.WW_DATA.boards?.[boardId] || null);
    if(!board) return null;
    const preset = board.presets?.[n];
    if(preset) return deepClone(preset);

    // fallback：若沒列出，就找最接近的
    const keys = Object.keys(board.presets||{}).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
    if(!keys.length) return null;
    const near = keys.reduce((best,cur)=> Math.abs(cur-n) < Math.abs(best-n) ? cur : best, keys[0]);
    return deepClone(board.presets[near]);
  }

  function buildPlayersFromRoles(rolesCount, n){
    const rolesArr = [];
    Object.entries(rolesCount||{}).forEach(([roleId, cnt])=>{
      for(let i=0;i<(cnt||0);i++) rolesArr.push(roleId);
    });

    // 總數防呆：不足補村民、超過就裁掉（但理想是 setup 就檢查）
    while(rolesArr.length < n) rolesArr.push("villager");
    if(rolesArr.length > n) rolesArr.length = n;

    // 洗牌
    for(let i=rolesArr.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [rolesArr[i],rolesArr[j]] = [rolesArr[j],rolesArr[i]];
    }

    const getRole = window.WW_DATA.getRole || ((id)=>window.WW_DATA.roles?.[id]||null);

    return rolesArr.map((roleId, idx)=> {
      const role = getRole(roleId) || { team:"villager" };
      return {
        seat: idx+1,
        roleId,
        team: role.team || "villager",
        alive: true,
        isChief: false,

        // 白痴/投票權（白痴翻牌後 canVote=false）
        canVote: true,
        idiotRevealed: false,

        notes: ""
      };
    });
  }

  function resetNightKeepConsumables(state){
    // 每夜重置動作，但保留女巫藥是否用過、守衛上一夜守誰
    const prevGuard = state.night?.prevGuardTarget ?? null;
    const saveUsed = !!state.night?.witchSaveUsed;
    const poisonUsed = !!state.night?.witchPoisonUsed;

    state.night = {
      guardTarget: null,
      wolfTarget: null,
      seerCheckTarget: null,
      seerResult: null,

      witchSaveUsed: saveUsed,
      witchPoisonUsed: poisonUsed,
      witchSave: false,
      witchPoisonTarget: null,

      prevGuardTarget: prevGuard
    };

    state.nightSteps = [];
    state.nightStepIndex = 0;
  }

  function newGame(state){
    // 根據板子 presets 生成 rolesCount + players
    const n = clamp(Number(state.playerCount||9), 6, 12);
    state.playerCount = n;

    const suggested = suggestRolesByBoard(state.boardId, n);
    state.rolesCount = suggested || state.rolesCount || {};

    state.players = buildPlayersFromRoles(state.rolesCount, n);

    // 重置流程
    state.phase = "deal";
    state.dealIndex = 0;

    state.nightNo = 1;
    state.dayNo = 1;

    state.logs = [];
    state.skillQueue = [];
    state.lastResolved = null;

    state.policeSession = null;
    state.voteSession = null;
    state.tieRound = 0;

    // 夜晚狀態
    resetNightKeepConsumables(state);
    // 新局：女巫藥要恢復未用
    state.night.witchSaveUsed = false;
    state.night.witchPoisonUsed = false;
    state.night.prevGuardTarget = null;

    save(state);
    return state;
  }

  // 回到 setup（重新選板子/配置）
  function resetToSetup(state){
    const s = defaultState();
    // 保留 pin（你也可不保留）
    s.pin = state.pin || "0000";
    save(s);
    return s;
  }

  window.WW.state = {
    STORAGE_KEY,
    defaultState,
    load,
    save,
    clear,

    defaultRules,

    newGame,
    resetToSetup,
    resetNightKeepConsumables,
    suggestRolesByBoard,
    buildPlayersFromRoles
  };
})();
