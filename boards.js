window.BOARDS = {
  basic: {
    id:"basic",
    name:"基本板子",
    players:[9,10,11,12],
    intro:"經典配置，流程清楚，適合新手與教學。",
    nightOrder:["werewolf"],  // 你要完整夜晚我再幫你加回守/驗/女巫
    rules:{ witchSelfSave:"allowed" }
  },

  wolfKings: {
    id:"wolfKings",
    name:"狼王對決板",
    players:[10,11,12],
    intro:"白天爆發性高，狼王技能會瞬間改變局勢。",
    nightOrder:["werewolf"],
    rules:{ witchSelfSave:"forbidden" }
  }
};