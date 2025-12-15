/* =========================================================
   data/boards/boards.js
   6–12 人｜Basic + B1 預設配置
   - presets[n] 回傳 rolesCount (object)
========================================================= */

(function(){
  window.WW_DATA = window.WW_DATA || {};

  function clone(x){ return JSON.parse(JSON.stringify(x)); }

  const basicPresets = {
    6:  { werewolf:2, seer:1, witch:1, hunter:1, villager:1 },                       // 2狼 + 預女獵 + 1民
    7:  { werewolf:2, seer:1, witch:1, hunter:1, villager:2 },                       // +1民
    8:  { werewolf:2, seer:1, witch:1, hunter:1, guard:1, villager:2 },              // 加守
    9:  { werewolf:2, seer:1, witch:1, hunter:1, guard:1, villager:3 },              // 標準9
    10: { werewolf:3, seer:1, witch:1, hunter:1, guard:1, villager:3 },              // 3狼
    11: { werewolf:3, seer:1, witch:1, hunter:1, guard:1, villager:4 },              // +1民
    12: { werewolf:3, seer:1, witch:1, hunter:1, guard:1, villager:5 }               // +1民
  };

  // B1：騎士 / 黑狼王 / 白狼王
  // 原則：先用黑狼王替換一隻狼人（仍算狼陣營），再加白狼王（也算狼），最後加入騎士（好人）
  const b1Presets = {
    6:  { werewolf:1, blackWolfKing:1, seer:1, witch:1, hunter:1, villager:1 },       // 2狼(含黑狼王) + 預女獵 + 1民
    7:  { werewolf:1, blackWolfKing:1, seer:1, witch:1, hunter:1, villager:2 },       // +1民
    8:  { werewolf:1, blackWolfKing:1, seer:1, witch:1, hunter:1, guard:1, villager:2 }, // 加守
    9:  { werewolf:1, blackWolfKing:1, seer:1, witch:1, hunter:1, guard:1, knight:1, villager:2 }, // 加騎士
    10: { werewolf:1, blackWolfKing:1, whiteWolfKing:1, seer:1, witch:1, hunter:1, guard:1, knight:1, villager:2 }, // 3狼(含黑/白) + 騎士
    11: { werewolf:2, blackWolfKing:1, whiteWolfKing:1, seer:1, witch:1, hunter:1, guard:1, knight:1, villager:2 }, // 4狼(含黑/白)
    12: { werewolf:2, blackWolfKing:1, whiteWolfKing:1, seer:1, witch:1, hunter:1, guard:1, knight:1, villager:3 }  // +1民
  };

  function normalizeCount(n){
    const v = Math.max(6, Math.min(12, Number(n)||9));
    return v;
  }

  function getPreset(boardId, n){
    const nn = normalizeCount(n);
    if(boardId==="b1"){
      return clone(b1Presets[nn] || b1Presets[9]);
    }
    return clone(basicPresets[nn] || basicPresets[9]);
  }

  window.WW_DATA.boards = {
    basic: { id:"basic", name:"基本板子", presets: basicPresets },
    b1:    { id:"b1",    name:"特殊板子 B1", presets: b1Presets }
  };

  window.WW_DATA.getBoardPreset = getPreset;
})();