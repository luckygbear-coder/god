/* =========================================================
   data/boards/boards.b1.js
   特殊板子 B1（進階狼陣營）
   6–12 人｜騎士 / 守衛 / 黑狼王 / 白狼王 + 基本神民

   目標：
   - 先把「角色資料/配置」做齊全且正確
   - 先可玩：夜晚仍以狼/預/女/守為主
   - 黑狼王/白狼王 的特殊技能，流程後續再接（不在此檔）

   導出：
     WW_DATA.boardsB1
     WW_DATA.getB1Preset(playerCount)
========================================================= */

(function(){
  const W = window.WW_DATA || (window.WW_DATA = {});

  function clone(obj){ return JSON.parse(JSON.stringify(obj)); }

  function normalizeCount(n){
    const v = Number(n) || 9;
    if(v < 6) return 6;
    if(v > 12) return 12;
    return v;
  }

  /* ---------------------------------------------------------
     設計原則（B1）
     - 仍保留：seer/witch/hunter（各 1）
     - 加入：knight（騎士，白天技能，先當「可存在角色」）
     - 守衛：8 人起加入（或玩家可手動調整）
     - 狼陣營：
        * 小局（6–8）：總狼 2，其中 1 個可替換為 blackWolfKing / whiteWolfKing（預設只放 1 個特殊狼）
        * 9–12：總狼 3，其中 1–2 個可為特殊狼（預設 2 個特殊狼）
     - 注意：配置只是身分數量；技能流程稍後接
  --------------------------------------------------------- */
  const PRESETS = {
    // 6人：2狼(含1特狼)、预女猎、1民
    6: {
      blackWolfKing: 1,
      werewolf: 1,

      seer: 1,
      witch: 1,
      hunter: 1,

      villager: 1
    },

    // 7人：2狼(含1特狼)、预女猎、骑士、1民
    7: {
      blackWolfKing: 1,
      werewolf: 1,

      seer: 1,
      witch: 1,
      hunter: 1,
      knight: 1,

      villager: 1
    },

    // 8人：2狼(含1特狼)、预女猎、骑士、守卫、1民
    8: {
      blackWolfKing: 1,
      werewolf: 1,

      seer: 1,
      witch: 1,
      hunter: 1,
      knight: 1,
      guard: 1,

      villager: 1
    },

    // 9人：3狼(含2特狼)、预女猎、骑士、守卫、1民
    9: {
      blackWolfKing: 1,
      whiteWolfKing: 1,
      werewolf: 1,

      seer: 1,
      witch: 1,
      hunter: 1,
      knight: 1,
      guard: 1,

      villager: 1
    },

    // 10人：3狼(含2特狼)、预女猎、骑士、守卫、2民
    10: {
      blackWolfKing: 1,
      whiteWolfKing: 1,
      werewolf: 1,

      seer: 1,
      witch: 1,
      hunter: 1,
      knight: 1,
      guard: 1,

      villager: 2
    },

    // 11人：3狼(含2特狼)、预女猎、骑士、守卫、3民
    11: {
      blackWolfKing: 1,
      whiteWolfKing: 1,
      werewolf: 1,

      seer: 1,
      witch: 1,
      hunter: 1,
      knight: 1,
      guard: 1,

      villager: 3
    },

    // 12人：3狼(含2特狼)、预女猎、骑士、守卫、4民
    12: {
      blackWolfKing: 1,
      whiteWolfKing: 1,
      werewolf: 1,

      seer: 1,
      witch: 1,
      hunter: 1,
      knight: 1,
      guard: 1,

      villager: 4
    }
  };

  function getB1Preset(playerCount){
    const n = normalizeCount(playerCount);
    return clone(PRESETS[n] || PRESETS[9]);
  }

  W.boardsB1 = {
    id: "b1",
    name: "特殊板子 B1（騎士／黑狼王／白狼王）",
    minPlayers: 6,
    maxPlayers: 12,
    presets: PRESETS
  };

  W.getB1Preset = getB1Preset;

})();