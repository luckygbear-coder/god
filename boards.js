const BOARDS = {
  basic: {
    id: "basic",
    name: "基本板子",
    players: [9, 10, 11, 12],
    intro: "經典配置，流程清楚，適合新手與教學。",
    roles: ["werewolf", "villager", "seer", "witch", "hunter", "guard"],
    nightOrder: ["guard", "werewolf", "seer", "witch"],
    rules: {
      witchSelfSave: "allowed"
    }
  },

  wolfKings: {
    id: "wolfKings",
    name: "狼王對決板",
    players: [10, 11, 12],
    intro: "白天爆發性極高，狼王死亡將瞬間改變戰局。",
    roles: ["werewolf", "whiteWolfKing", "blackWolfKing", "seer", "witch", "villager"],
    nightOrder: ["werewolf", "seer", "witch"],
    rules: {
      witchSelfSave: "forbidden"
    }
  },

  lovers: {
    id: "lovers",
    name: "情侶命運板",
    players: [9, 10, 11, 12],
    intro: "第三陣營加入，勝利條件不再單純。",
    roles: ["werewolf", "villager", "seer", "witch", "cupid", "admirer"],
    nightOrder: ["cupid", "werewolf", "seer", "witch"],
    rules: {
      witchSelfSave: "allowed"
    }
  },

  control: {
    id: "control",
    name: "能力干擾板",
    players: [10, 11, 12],
    intro: "發言與技能皆可能被干擾，資訊極不穩定。",
    roles: ["werewolf", "villager", "seer", "witch", "elder", "dreamer", "magician"],
    nightOrder: ["magician", "dreamer", "elder", "werewolf", "seer", "witch"],
    rules: {
      witchSelfSave: "forbidden"
    }
  },

  chaos: {
    id: "chaos",
    name: "黑市混沌板",
    players: [10, 11, 12],
    intro: "高變數娛樂局，任何夜晚都可能翻盤。",
    roles: ["werewolf", "villager", "seer", "witch", "marketDealer", "lucky", "idiot", "demonHunter"],
    nightOrder: ["marketDealer", "werewolf", "seer", "witch"],
    rules: {
      witchSelfSave: "allowed"
    }
  }
};

export default BOARDS;
