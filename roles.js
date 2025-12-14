window.ROLES = {
  villager: { id:"villager", name:"村民", team:"villager", skill:"沒有任何特殊能力。", godNote:"—" },
  werewolf: { id:"werewolf", name:"狼人", team:"wolf", skill:"夜晚共同選擇一名玩家擊殺。", godNote:"狼人共用一刀。" },
  seer: { id:"seer", name:"預言家", team:"villager", skill:"每晚查驗一名玩家的陣營（好人/狼人）。", godNote:"只告知陣營。" },
  witch: { id:"witch", name:"女巫", team:"villager", skill:"有解藥與毒藥各一次。解藥可救當晚被刀者；毒藥可毒殺一人。", godNote:"是否可自救由板子規則決定。" },
  hunter: { id:"hunter", name:"獵人", team:"villager", skill:"死亡時可指定一名玩家一同死亡。", godNote:"是否毒殺可開槍可再加規則。" },
  guard: { id:"guard", name:"守衛", team:"villager", skill:"每晚守護一名玩家，使其免於狼人擊殺。", godNote:"是否可連守由規則決定。" },

  whiteWolfKing: { id:"whiteWolfKing", name:"白狼王", team:"wolf", skill:"白天被放逐時，可指定一名玩家一同死亡。", godNote:"僅 vote 出局觸發。" },
  blackWolfKing: { id:"blackWolfKing", name:"黑狼王", team:"wolf", skill:"死亡時，若不是被毒殺且不是白天自爆，可指定一名玩家一同死亡（狼王之爪）。", godNote:"自爆不觸發；毒殺不觸發。" }
};