window.ROLES = {
  villager: { id:"villager", name:"村民", team:"villager", skill:"沒有任何特殊能力。"},
  werewolf: { id:"werewolf", name:"狼人", team:"wolf", skill:"夜晚共同選擇一名玩家擊殺。"},
  seer: { id:"seer", name:"預言家", team:"villager", skill:"每晚查驗一名玩家的陣營（好人/狼人）。"},
  witch: { id:"witch", name:"女巫", team:"villager", skill:"解藥與毒藥各一次：解藥救當晚被刀者；毒藥毒殺一人。"},
  hunter: { id:"hunter", name:"獵人", team:"villager", skill:"死亡時可開槍帶走一人。"},
  guard: { id:"guard", name:"守衛", team:"villager", skill:"每晚守護一名玩家，使其免於狼人擊殺。"},

  whiteWolfKing: { id:"whiteWolfKing", name:"白狼王", team:"wolf", skill:"被放逐（投票出局）時，可指定一名玩家一同死亡。"},
  blackWolfKing: { id:"blackWolfKing", name:"黑狼王", team:"wolf", skill:"死亡時，若不是被毒殺且不是白天自爆，可發動狼王之爪帶走一人。"}
};