/* =========================================================
   WW_DATA Roles — Special Pack
   目標：先把「特殊板子角色資料」補齊，流程稍後接 night.steps / rules
========================================================= */

(function(){
  window.WW_DATA = window.WW_DATA || {};
  const W = window.WW_DATA;

  // 若 base 先載，這裡做合併
  W.roles = W.roles || {};
  W.rolesSpecial = W.rolesSpecial || {};

  const add = (r) => {
    W.rolesSpecial[r.id] = r;
    // 合併到 roles 供 roleInfo() 直接查
    W.roles[r.id] = r;
  };

  /* =========================================================
     特殊陣營/標籤說明
     team:
       - wolf: 邪惡陣營
       - villager: 正義陣營
       - third: 第三方陣營（勝負判定需特別處理）
========================================================= */

  // -------------------------
  // 正義陣營（特殊）
  // -------------------------
  add({
    id: "idiot",
    name: "白痴",
    team: "villager",
    icon: "🤪",
    tags: ["白天強化", "免死一次(常見規則)"],
    nightOrderHint: null,
    rulesHint: "常見規則：被投票放逐時翻牌免死，但失去投票權/發言權（依桌規）。"
  });

  add({
    id: "dreamEater",
    name: "攝夢人",
    team: "villager",
    icon: "🌀",
    tags: ["夜晚技能", "連睡/入夢"],
    nightOrderHint: "夜晚：攝夢人選擇一名玩家入夢（之後依規則影響其行動/狀態）。",
    rulesHint: "桌規差異很大：入夢者可能無法行動、或被攝夢人牽連死亡。後續會在 rules 接可選規則。"
  });

  add({
    id: "magician",
    name: "魔術師",
    team: "villager",
    icon: "🎩",
    tags: ["夜晚技能", "交換/改變目標(桌規)"],
    nightOrderHint: "夜晚：魔術師可對某些目標做交換/干擾（依板子規則）。",
    rulesHint: "不同流派差異大：可做『交換兩人座位/交換技能目標/移花接木』等。後續以設定開關實作。"
  });

  add({
    id: "demonHunter",
    name: "獵魔人",
    team: "villager",
    icon: "🪓",
    tags: ["白天技能", "決鬥/審判(桌規)"],
    nightOrderHint: null,
    rulesHint: "常見玩法：白天可指定一人決鬥，輸者出局或公開身分（依桌規）。"
  });

  add({
    id: "hellKnight",
    name: "惡靈騎士",
    team: "villager",
    icon: "🐴",
    tags: ["死亡技能", "帶走/復仇(桌規)"],
    nightOrderHint: null,
    rulesHint: "常見玩法：死亡時可帶走一人/或指定一人與自己同歸於盡（依桌規）。"
  });

  add({
    id: "knight",
    name: "騎士",
    team: "villager",
    icon: "🗡️",
    tags: ["白天技能", "決鬥驗人"],
    nightOrderHint: null,
    rulesHint: "常見：白天可挑戰一人，若對方是狼人則狼人死亡；若不是狼人則騎士死亡（依桌規）。"
  });

  // -------------------------
  // 邪惡陣營（特殊狼）
  // -------------------------
  add({
    id: "blackWolfKing",
    name: "黑狼王",
    team: "wolf",
    icon: "🐺👑",
    tags: ["狼", "死亡技能"],
    nightOrderHint: "夜晚：與狼人同刀（若板子規則另有技能再加）。",
    rulesHint: "你指定規則：黑狼王被毒不能使用技能（後續 rules 會實作）。"
  });

  add({
    id: "whiteWolfKing",
    name: "白狼王",
    team: "wolf",
    icon: "🐺⚔️",
    tags: ["狼", "特殊技能(桌規)"],
    nightOrderHint: "夜晚：通常可選擇自爆帶走一人（依桌規）。",
    rulesHint: "不同桌規：可自爆、可夜晚刀人附加效果。後續以設定開關實作。"
  });

  add({
    id: "gargoyle",
    name: "石像鬼",
    team: "wolf",
    icon: "🗿",
    tags: ["狼", "夜晚強化(桌規)"],
    nightOrderHint: "夜晚：可能有『守夜/石化』相關行動（依桌規）。",
    rulesHint: "流派差異大：例如可免疫一次、或可夜晚守護狼人同伴。後續以可插拔規則做。"
  });

  // -------------------------
  // 第三方陣營（特殊）
  // -------------------------
  add({
    id: "cupid",
    name: "邱比特",
    team: "third",
    icon: "💘",
    tags: ["第三方", "綁情侶"],
    nightOrderHint: "第一夜：邱比特選兩人綁成情侶（可能同陣營或跨陣營）。",
    rulesHint: "常見：情侶一方死，另一方殉情；若最後只剩情侶存活則第三方勝利（依桌規）。"
  });

  add({
    id: "secretCrush",
    name: "暗戀者",
    team: "third",
    icon: "🌙",
    tags: ["第三方", "暗戀/單戀(桌規)"],
    nightOrderHint: "第一夜或特定時機：選一人作為暗戀目標（依桌規）。",
    rulesHint: "桌規差異大：可能需要保護目標到最後、或與目標同存活即勝。後續以設定開關定義。"
  });

  // -------------------------
  // 中立功能型（可視為第三方或村民，依板子規則）
  // -------------------------
  add({
    id: "blackMarketDealer",
    name: "黑市商人",
    team: "third",
    icon: "🧳",
    tags: ["第三方/功能", "交換/買賣(桌規)"],
    nightOrderHint: "夜晚：可能提供交換、道具、或資訊交易（依桌規）。",
    rulesHint: "後續會以『道具/交換』模組做。此角色勝利條件需依你板子確定。"
  });

  add({
    id: "luckyOne",
    name: "幸運兒",
    team: "villager",
    icon: "🍀",
    tags: ["被動", "免疫一次(桌規)"],
    nightOrderHint: null,
    rulesHint: "常見：可免疫一次夜晚死亡/或一次技能效果（依桌規）。後續 rules 會做成可選。"
  });

})();