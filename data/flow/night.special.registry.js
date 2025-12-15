/* =========================================================
   WW_DATA Night Special Registry
   目的：
   - 把「特殊角色的夜晚步驟」用可插拔 registry 管理
   - 之後 night.steps.special.js 會把 registry 轉成 steps
   注意：
   - 目前先把資料補齊（你要求先把角色資料齊全）
   - 詳細規則效果（例如攝夢人/石像鬼怎麼判定）會在 rules.special.* 補上
========================================================= */

(function(){
  window.WW_DATA = window.WW_DATA || {};
  const W = window.WW_DATA;

  // order：越小越早執行（只是建議排序，後續可調）
  W.nightSpecialRegistry = [
    /* =========================
       情侶/第三方（通常在第一夜特殊處理）
    ========================= */
    {
      id: "cupid",
      phase: "night",
      order: 10,
      type: "pick2",
      onlyFirstNight: true,
      dataKeys: ["cupidPickA", "cupidPickB"],
      script: {
        god: "邱比特請睜眼。請選兩位成為情侶。（點兩個座位）",
        public: "邱比特請睜眼。"
      }
    },
    {
      id: "secretCrush", // 暗戀者（通常跟邱比特/情侶系統一起跑）
      phase: "night",
      order: 12,
      type: "pick1",
      onlyFirstNight: true,
      dataKeys: ["secretCrushTarget"],
      script: {
        god: "暗戀者請睜眼。你暗戀誰？（點一個座位）",
        public: "暗戀者請睜眼。"
      }
    },

    /* =========================
       守護 / 防禦
    ========================= */
    {
      id: "guard",
      phase: "night",
      order: 20,
      type: "pick1",
      dataKeys: ["guardTarget"],
      script: {
        god: "守衛請睜眼。你要守誰？（點選座位）\n（規則）不能連守同一人。",
        public: "守衛請睜眼。"
      }
    },
    {
      id: "hellKnight", // 惡靈騎士（暫定：偏防禦/反擊類）
      phase: "night",
      order: 22,
      type: "confirm",
      dataKeys: ["hellKnightMode"],
      script: {
        god: "惡靈騎士請睜眼。（特殊效果待規則補齊）\n目前先做：本夜是否啟動技能？",
        public: "惡靈騎士請睜眼。"
      }
    },

    /* =========================
       狼人陣營 / 夜殺
    ========================= */
    {
      id: "werewolf",
      phase: "night",
      order: 30,
      type: "pick1_or_none",
      dataKeys: ["wolfTarget"],
      script: {
        god: "狼人請睜眼。你們要刀誰？（點選座位）\n（可選）空刀：選擇「空刀」。",
        public: "狼人請睜眼。"
      }
    },
    {
      id: "blackWolfKing",
      phase: "night",
      order: 31,
      type: "none", // 黑狼王多為「死亡技能」，夜晚不額外行動（先不加夜行動）
      dataKeys: [],
      script: {
        god: "黑狼王（夜晚無額外行動，主要為死亡技能）。",
        public: ""
      }
    },
    {
      id: "whiteWolfKing",
      phase: "night",
      order: 32,
      type: "confirm", // 白狼王常見是「白天自爆」或特殊帶人（先占位）
      dataKeys: ["whiteWolfKingFlag"],
      script: {
        god: "白狼王（主要特殊技能待補）。目前先占位：是否標記本夜狀態？",
        public: ""
      }
    },
    {
      id: "gargoyle", // 石像鬼（常見：可夜晚查人/守屍等變體）
      phase: "night",
      order: 35,
      type: "pick1",
      dataKeys: ["gargoyleTarget"],
      script: {
        god: "石像鬼請睜眼。你要選擇誰作為目標？（效果待補）",
        public: "石像鬼請睜眼。"
      }
    },

    /* =========================
       查驗 / 控制 / 干擾
    ========================= */
    {
      id: "seer",
      phase: "night",
      order: 40,
      type: "pick1",
      dataKeys: ["seerCheckTarget", "seerResult"],
      script: {
        god: "預言家請睜眼。你要查驗誰？（點選座位）",
        public: "預言家請睜眼。"
      }
    },
    {
      id: "dreamEater", // 攝夢人（常見：封口/禁技能/夢境控制）
      phase: "night",
      order: 42,
      type: "pick1",
      dataKeys: ["dreamEaterTarget"],
      script: {
        god: "攝夢人請睜眼。你要讓誰進入夢境？（效果待補）",
        public: "攝夢人請睜眼。"
      }
    },
    {
      id: "magician", // 魔術師（常見：交換、偽裝）
      phase: "night",
      order: 44,
      type: "pick2",
      dataKeys: ["magicianPickA", "magicianPickB"],
      script: {
        god: "魔術師請睜眼。你要對哪兩位做魔術？（效果待補）",
        public: "魔術師請睜眼。"
      }
    },
    {
      id: "blackMarketDealer", // 黑市商人（常見：交易/購買道具）
      phase: "night",
      order: 46,
      type: "confirm",
      dataKeys: ["blackMarketDealerAction"],
      script: {
        god: "黑市商人請睜眼。（交易/道具系統待補）\n目前先占位：本夜是否進行交易？",
        public: "黑市商人請睜眼。"
      }
    },

    /* =========================
       女巫 / 治療 / 毒
    ========================= */
    {
      id: "witch",
      phase: "night",
      order: 60,
      type: "panel", // 由 witchFlow 彈窗處理
      dataKeys: ["witchSave", "witchPoisonTarget", "witchSaveUsed", "witchPoisonUsed"],
      script: {
        god: "女巫請睜眼。（將用彈窗操作：刀口→救→毒）",
        public: "女巫請睜眼。"
      }
    },

    /* =========================
       被動/白天技能角色（先列入）
    ========================= */
    {
      id: "idiot", // 白痴：多為白天投票免死一次或翻牌特例
      phase: "day",
      order: 0,
      type: "passive",
      dataKeys: [],
      script: {
        god: "白痴（白天被投出通常翻牌不死/失去投票權，依規則版本）。",
        public: ""
      }
    },
    {
      id: "luckyOne", // 幸運兒：多為被動（被查驗顯示好人/免死一次等）
      phase: "passive",
      order: 0,
      type: "passive",
      dataKeys: [],
      script: {
        god: "幸運兒（被動效果待補）。",
        public: ""
      }
    },
    {
      id: "demonHunter", // 獵魔人：可能白天決鬥/夜晚標記
      phase: "day",
      order: 0,
      type: "passive",
      dataKeys: [],
      script: {
        god: "獵魔人（技能待補）。",
        public: ""
      }
    }
  ];

})();
