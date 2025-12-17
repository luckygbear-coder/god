// script.js — 先只放「官方12 MVP」需要的資料
window.WW_DB = (() => {
  const roles = {
    villager:{ id:"villager", name:"平民", icon:"🙂", team:"good" },
    werewolf:{ id:"werewolf", name:"狼人", icon:"🐺", team:"wolf" },
    seer:{ id:"seer", name:"預言家", icon:"🔮", team:"good" },
    witch:{ id:"witch", name:"女巫", icon:"🧪", team:"good" },
    hunter:{ id:"hunter", name:"獵人", icon:"🏹", team:"good" },
    guard:{ id:"guard", name:"守衛", icon:"🛡️", team:"good" },
    idiot:{ id:"idiot", name:"白痴（算神）", icon:"🤡", team:"good" },

    blackWolfKing:{ id:"blackWolfKing", name:"黑狼王", icon:"🐺🔫", team:"wolf" },
    whiteWolfKing:{ id:"whiteWolfKing", name:"白狼王", icon:"🐺💥", team:"wolf" },
    wolfKing:{ id:"wolfKing", name:"狼王", icon:"🐺👑", team:"wolf" }
  };

  // 官方12夜晚流程（alwaysAnnounce: true = 即使死了也照唸）
  const nightflow_official12 = [
    { id:"N0_CLOSE", order:0, roleKey:"narrator", alwaysAnnounce:true, type:"INFO",
      scripts:{ public:"天黑請閉眼。", god:"天黑請閉眼。" } },

    { id:"N1_GUARD", order:10, roleKey:"guard", alwaysAnnounce:true, type:"PICK", pickKey:"guardTarget",
      pickPolicy:{ aliveOnly:true, allowNull:false, toggleToNull:false },
      scripts:{
        public:"守衛請睜眼，請選擇一名玩家守護，守護後請閉眼。",
        god:"🛡️ 守衛守誰？（點座位）"
      } },

    { id:"N2_WOLF", order:20, roleKey:"werewolf", alwaysAnnounce:true, type:"PICK", pickKey:"wolfTarget",
      pickPolicy:{ aliveOnly:true, allowNull:true, toggleToNull:true },
      scripts:{
        public:"狼人請睜眼，請選擇今晚要殺害的玩家，選定後請閉眼。",
        god:"🐺 狼人刀誰？（可再點一次取消=空刀）"
      } },

    { id:"N3_SEER", order:30, roleKey:"seer", alwaysAnnounce:true, type:"SEER_CHECK", pickKey:"seerCheck",
      pickPolicy:{ aliveOnly:true, allowNull:false, toggleToNull:false },
      scripts:{
        public:"預言家請睜眼，請選擇一名玩家查驗，查驗後請閉眼。",
        god:"🔮 預言家查誰？（點座位後，提示區顯示查驗結果）"
      } },

    { id:"N4_WITCH", order:40, roleKey:"witch", alwaysAnnounce:true, type:"WITCH",
      scripts:{
        public:"女巫請睜眼。",
        god:"🧪 女巫操作（不跳視窗）：\n- 點『刀口』=救（若解藥未用；不可自救會提示）\n- 點『其他人』=毒（若毒藥未用）\n- 直接下一步=不用"
      } },

    { id:"N9_RESOLVE", order:90, roleKey:"narrator", alwaysAnnounce:true, type:"RESOLVE",
      scripts:{ public:"天亮請睜眼。", god:"🌤️ 結算夜晚 → 產生白天公告" } },
  ];

  return {
    roles,
    boards: {
      official12: {
        id:"official12",
        name:"官方｜12人標準場",
        nightFlowId:"nightflow_official12"
      }
    },
    nightFlows: {
      nightflow_official12
    }
  };
})();