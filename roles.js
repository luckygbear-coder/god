const ROLES = {
  // ===== 基本角色 =====
  villager: {
    id: "villager",
    name: "村民",
    team: "villager",
    trigger: [],
    skill: "沒有任何特殊能力。",
    godNote: "無夜晚流程。"
  },

  werewolf: {
    id: "werewolf",
    name: "狼人",
    team: "wolf",
    trigger: ["night"],
    skill: "夜晚可與狼人同伴討論並選擇一名玩家擊殺。",
    godNote: "所有狼人共用一次刀人目標。"
  },

  seer: {
    id: "seer",
    name: "預言家",
    team: "villager",
    trigger: ["night"],
    skill: "每晚可查驗一名玩家的陣營（好人 / 狼人）。",
    godNote: "僅告知陣營，不告知具體角色。"
  },

  witch: {
    id: "witch",
    name: "女巫",
    team: "villager",
    trigger: ["night"],
    skill:
      "擁有一瓶解藥與一瓶毒藥。解藥可救當晚被狼人擊殺的玩家；毒藥可毒殺一名玩家。",
    godNote:
      "是否可自救由板子規則決定。解藥與毒藥皆為一次性。"
  },

  hunter: {
    id: "hunter",
    name: "獵人",
    team: "villager",
    trigger: ["death"],
    skill:
      "死亡時可立即指定一名玩家一同死亡。",
    godNote:
      "若被女巫毒殺，是否可開槍由板子或主持人規則決定。"
  },

  guard: {
    id: "guard",
    name: "守衛",
    team: "villager",
    trigger: ["night"],
    skill:
      "每晚可守護一名玩家，使其免於狼人擊殺。",
    godNote:
      "是否可連續守同一人由板子規則決定。"
  },

  // ===== 狼王 =====
  whiteWolfKing: {
    id: "whiteWolfKing",
    name: "白狼王",
    team: "wolf",
    trigger: ["day"],
    skill:
      "白天被放逐時，可立即指定一名玩家一同死亡。",
    godNote:
      "僅在被投票出局時觸發。"
  },

  blackWolfKing: {
    id: "blackWolfKing",
    name: "黑狼王",
    team: "wolf",
    trigger: ["death", "day"],
    skill:
      "死亡時，若不是被女巫毒殺且不是白天自爆，可指定一名玩家一同死亡。",
    godNote:
      "白天可自爆，但自爆不可發動狼王之爪。"
  },

  wolfBeauty: {
    id: "wolfBeauty",
    name: "狼美人",
    team: "wolf",
    trigger: ["night"],
    skill:
      "夜晚可魅惑一名玩家。若狼美人死亡，被魅惑者隔天跟著死亡。",
    godNote:
      "魅惑關係需記錄。"
  },

  // ===== 控場 / 干擾 =====
  elder: {
    id: "elder",
    name: "禁言長老",
    team: "villager",
    trigger: ["night"],
    skill:
      "夜晚指定一名玩家，隔天該玩家無法發言。",
    godNote:
      "僅影響白天發言，不影響投票。"
  },

  dreamer: {
    id: "dreamer",
    name: "攝夢人",
    team: "villager",
    trigger: ["night"],
    skill:
      "夜晚讓一名玩家進入夢境，隔天無法使用技能。",
    godNote:
      "需標記夢境狀態，隔天清除。"
  },

  magician: {
    id: "magician",
    name: "魔術師",
    team: "villager",
    trigger: ["night"],
    skill:
      "夜晚可選擇兩名玩家，交換其座位或顯示順序。",
    godNote:
      "僅影響資訊與座位，不改變實際身分。"
  },

  // ===== 第三陣營 =====
  cupid: {
    id: "cupid",
    name: "邱比特",
    team: "third",
    trigger: ["firstNight"],
    skill:
      "第一夜指定兩名玩家成為情侶。情侶任一死亡，另一人殉情。",
    godNote:
      "第一夜後不再行動。"
  },

  admirer: {
    id: "admirer",
    name: "暗戀者",
    team: "third",
    trigger: ["night"],
    skill:
      "指定一名玩家為暗戀對象，依板子規則可能改變勝利條件。",
    godNote:
      "暗戀關係通常不公開。"
  },

  // ===== 混沌 / 娛樂 =====
  marketDealer: {
    id: "marketDealer",
    name: "黑市商人",
    team: "villager",
    trigger: ["night"],
    skill:
      "夜晚可進行一次交易，獲得隨機能力或效果。",
    godNote:
      "能力來源由主持人或系統決定。"
  },

  lucky: {
    id: "lucky",
    name: "幸運兒",
    team: "villager",
    trigger: ["death"],
    skill:
      "首次死亡時免疫死亡一次。",
    godNote:
      "觸發後視為普通玩家。"
  },

  idiot: {
    id: "idiot",
    name: "白痴",
    team: "villager",
    trigger: ["day"],
    skill:
      "白天被票出時不死，但失去投票權。",
    godNote:
      "通常會翻牌確認身分。"
  },

  demonHunter: {
    id: "demonHunter",
    name: "獵魔人",
    team: "villager",
    trigger: ["day"],
    skill:
      "白天可指定一名玩家決鬥，若對方是狼人則擊殺成功，否則自己死亡。",
    godNote:
      "通常限一次使用。"
  }
};

export default ROLES;
