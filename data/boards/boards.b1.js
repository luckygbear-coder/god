/* =========================================================
   狼人殺｜上帝輔助 PWA
   檔案：/data/boards/boards.b1.js

   特殊板子 B1（6~12 人）
   你確認的規則：
   - 1A 狼人數：6~8=2狼；9~10=3狼；11~12=4狼

   B1 角色池（你要求）：白痴、攝夢人、魔術師、黑市商人、
   幸運兒、獵魔人、惡靈騎士、石像鬼、邱比特、暗戀者…

   設計原則：
   - 先「能玩、配置不亂」：預女獵在，白痴可有
   - 每局預設只放 1~3 個特殊角色（其餘你可手動加）
   - 第三方預設：先放邱比特（戀人系），12 人可加暗戀者或惡靈騎士
========================================================= */

(function () {

  const rolePool = [
    // 基本池
    "werewolf",
    "villager",
    "seer",
    "witch",
    "hunter",
    "idiot",
    "guard",
    "knight",
    "blackWolfKing",
    "whiteWolfKing",

    // B1 特殊角色（資料已在 roles.special.b1.js 定義）
    "dreamer",              // 攝夢人
    "magician",             // 魔術師
    "blackMarketDealer",    // 黑市商人
    "lucky",                // 幸運兒
    "demonHunter",          // 獵魔人
    "deathKnight",          // 惡靈騎士（第三方）
    "gargoyle",             // 石像鬼（偏狼方/視規則）
    "cupid",                // 邱比特（第三方）
    "secretLover"           // 暗戀者（第三方）
  ];

  function wolvesByCount(n){
    if(n >= 11) return 4;
    if(n >= 9) return 3;
    return 2; // 6~8
  }

  // B1 建議配置策略（先可玩）：
  // - 核心：seer + witch + hunter（白痴視人數）
  // - 狼依 1A
  // - 10+ 加 guard；11+ 加 knight
  // - 特殊：9+ 給 cupid；10+ 可加 dreamer；11+ 可加 magician；
  //         12+ 可加 secretLover 或 deathKnight（先預設 secretLover）
  function suggestPresetB1(n){
    const werewolf = wolvesByCount(n);

    const seer = 1;
    const witch = 1;
    const hunter = 1;

    // B1：白痴在 7+ 才放，6人太擠
    const idiot = (n >= 7) ? 1 : 0;

    const guard = (n >= 10) ? 1 : 0;
    const knight = (n >= 11) ? 1 : 0;

    // B1 特殊
    const cupid = (n >= 9) ? 1 : 0;
    const dreamer = (n >= 10) ? 1 : 0;
    const magician = (n >= 11) ? 1 : 0;

    // 第三方加碼（先預設 12 人放暗戀者；惡靈騎士先不預設避免勝負複雜）
    const secretLover = (n >= 12) ? 1 : 0;
    const deathKnight = 0;

    // 其它 B1 角色先預設 0（給你手動調整加入）
    const blackMarketDealer = 0;
    const lucky = 0;
    const demonHunter = 0;
    const gargoyle = 0;

    // 狼王類：預設 0，避免配置錯誤（你可手動把其中一狼升級）
    const blackWolfKing = 0;
    const whiteWolfKing = 0;

    const fixed =
      werewolf + seer + witch + hunter + idiot +
      guard + knight +
      cupid + dreamer + magician +
      secretLover + deathKnight +
      blackMarketDealer + lucky + demonHunter + gargoyle +
      blackWolfKing + whiteWolfKing;

    const villager = Math.max(0, n - fixed);

    return {
      // 核心
      werewolf,
      seer,
      witch,
      hunter,
      villager,

      // 基本延伸
      idiot,
      guard,
      knight,

      // 狼王（手動加）
      blackWolfKing,
      whiteWolfKing,

      // B1 特殊
      cupid,
      secretLover,
      dreamer,
      magician,

      blackMarketDealer,
      lucky,
      demonHunter,
      deathKnight,
      gargoyle
    };
  }

  const presets = {
    6:  suggestPresetB1(6),
    7:  suggestPresetB1(7),
    8:  suggestPresetB1(8),
    9:  suggestPresetB1(9),
    10: suggestPresetB1(10),
    11: suggestPresetB1(11),
    12: suggestPresetB1(12)
  };

  const BOARD_B1 = {
    id: "b1",
    name: "特殊板子 B1",
    minPlayers: 6,
    maxPlayers: 12,

    rolePool,
    presets,

    hasThirdParty: true,

    notes: [
      "狼人數（1A）：6~8=2狼；9~10=3狼；11~12=4狼。",
      "B1 預設：9+ 有邱比特；10+ 加攝夢人；11+ 加魔術師；12+ 加暗戀者。",
      "黑市商人/幸運兒/獵魔人/惡靈騎士/石像鬼：先在角色池，預設不自動加入（你可手動加）。",
      "狼王類（黑狼王/白狼王）：先在角色池，預設不自動加入（你可手動把其中一狼升級）。"
    ]
  };

  window.WW_DATA = window.WW_DATA || {};
  window.WW_DATA.boards = window.WW_DATA.boards || {};
  window.WW_DATA.boards.b1 = BOARD_B1;

})();
