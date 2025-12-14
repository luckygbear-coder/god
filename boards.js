window.BOARDS = {
  basic: {
    id:"basic",
    name:"基本板子",
    players:[9,10,11,12],
    intro:"經典配置，流程清楚，適合新手與教學。",
    rules:{ witchSelfSave:"allowed" } // allowed | forbidden
  },
  wolfKings: {
    id:"wolfKings",
    name:"狼王對決板",
    players:[10,11,12],
    intro:"白天爆發性高：白狼王／黑狼王技能會改變局勢。",
    rules:{ witchSelfSave:"forbidden" }
  }
};