/* =========================================================
   data/boards/boards.basic.js
   基本板子（Basic）
   6–12 人｜預女獵白｜可選守衛

   導出：
     WW_DATA.boardsBasic
     WW_DATA.getBasicPreset(playerCount)
========================================================= */

(function(){
  const W = window.WW_DATA || (window.WW_DATA = {});

  function clone(obj){
    return JSON.parse(JSON.stringify(obj));
  }

  /* ---------------------------------------------------------
     設計原則
     - 6–8 人：2 狼
     - 9–12 人：3 狼
     - 守衛從 8 人開始加入
     - 預言家 / 女巫 / 獵人 固定各 1
  --------------------------------------------------------- */
  const PRESETS = {
    6: {
      werewolf: 2,
      seer: 1,
      witch: 1,
      hunter: 1,
      villager: 1
    },
    7: {
      werewolf: 2,
      seer: 1,
      witch: 1,
      hunter: 1,
      villager: 2
    },
    8: {
      werewolf: 2,
      seer: 1,
      witch: 1,
      hunter: 1,
      guard: 1,
      villager: 2
    },
    9: {
      werewolf: 3,
      seer: 1,
      witch: 1,
      hunter: 1,
      guard: 1,
      villager: 2
    },
    10: {
      werewolf: 3,
      seer: 1,
      witch: 1,
      hunter: 1,
      guard: 1,
      villager: 3
    },
    11: {
      werewolf: 3,
      seer: 1,
      witch: 1,
      hunter: 1,
      guard: 1,
      villager: 4
    },
    12: {
      werewolf: 3,
      seer: 1,
      witch: 1,
      hunter: 1,
      guard: 1,
      villager: 5
    }
  };

  function normalizeCount(n){
    const v = Number(n) || 9;
    if(v < 6) return 6;
    if(v > 12) return 12;
    return v;
  }

  function getBasicPreset(playerCount){
    const n = normalizeCount(playerCount);
    return clone(PRESETS[n] || PRESETS[9]);
  }

  /* ---------------------------------------------------------
     掛載到全域
  --------------------------------------------------------- */
  W.boardsBasic = {
    id: "basic",
    name: "基本板子（預女獵白）",
    minPlayers: 6,
    maxPlayers: 12,
    presets: PRESETS
  };

  W.getBasicPreset = getBasicPreset;

})();