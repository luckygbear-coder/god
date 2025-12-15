/* =========================================================
   狼人殺｜上帝輔助 PWA
   檔案：/data/boards/boards.basic.js

   基本板子（6~12 人）
   你確認的規則：
   - 1A 狼人數：6~8=2狼；9~10=3狼；11~12=4狼

   目標：
   - 預女獵白（seer/witch/hunter/idiot）作為核心
   - 10+ 可加入守衛 guard
   - 11+ 可加入騎士 knight
   - 黑狼王 / 白狼王先放進 pool（可手動加進配置）
========================================================= */

(function () {

  // 允許出現在「基本板子」的角色池（給 UI 調整角色用）
  const rolePool = [
    "werewolf",
    "villager",
    "seer",
    "witch",
    "hunter",
    "idiot",
    "guard",
    "knight",
    "blackWolfKing",
    "whiteWolfKing"
  ];

  // 依你選的 1A：回傳狼人數
  function wolvesByCount(n){
    if(n >= 11) return 4;
    if(n >= 9) return 3;
    return 2; // 6~8
  }

  // 產生建議配置（你之後要改策略也很方便）
  // 原則：核心固定 seer/witch/hunter/idiot；狼依 1A；高人數補 guard/knight；其餘村民
  function suggestPreset(n){
    const werewolf = wolvesByCount(n);

    // 核心
    const seer = 1;
    const witch = 1;
    const hunter = 1;
    const idiot = 1;

    // 10 人以上補守衛，11+ 補騎士
    const guard = (n >= 10) ? 1 : 0;
    const knight = (n >= 11) ? 1 : 0;

    const fixed = werewolf + seer + witch + hunter + idiot + guard + knight;
    const villager = Math.max(0, n - fixed);

    return {
      werewolf,
      seer,
      witch,
      hunter,
      idiot,
      guard,
      knight,
      villager,

      // 這兩個先預設 0（避免你說的「配置錯誤」）
      // 需要時你可在 UI 調整角色把其中一隻狼人升級成狼王類
      blackWolfKing: 0,
      whiteWolfKing: 0
    };
  }

  // 明確列出 6~12（避免動態生成造成你覺得「不可靠」）
  const presets = {
    6:  suggestPreset(6),
    7:  suggestPreset(7),
    8:  suggestPreset(8),
    9:  suggestPreset(9),
    10: suggestPreset(10),
    11: suggestPreset(11),
    12: suggestPreset(12)
  };

  // ✅ 基本板子定義
  const BOARD_BASIC = {
    id: "basic",
    name: "基本板子",
    minPlayers: 6,
    maxPlayers: 12,

    rolePool,

    // 預設配置（依人數）
    presets,

    // 額外：給 UI 顯示提示（可選）
    notes: [
      "核心：預言家、女巫、獵人、白痴。",
      "狼人數（1A）：6~8=2狼；9~10=3狼；11~12=4狼。",
      "10+ 可加入守衛；11+ 可加入騎士。",
      "黑狼王/白狼王先提供在角色池，預設不自動加入（避免配置錯誤）。"
    ]
  };

  window.WW_DATA = window.WW_DATA || {};
  window.WW_DATA.boards = window.WW_DATA.boards || {};
  window.WW_DATA.boards.basic = BOARD_BASIC;

})();