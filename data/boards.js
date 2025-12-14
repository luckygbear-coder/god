/* =========================================================
   狼人殺｜板子與預設配置
   檔案：data/boards.js

   目標：
   - 先提供「基本板子」與「特殊板子1」兩套可玩配置（6~12人）
   - 每個人數都有一鍵套用的預設配置
   - UI 可再手動調整數量（但總數需=玩家數）

   說明：
   - 基本板子：預言家/女巫/獵人/白痴 + 狼人 + 村民
   - 特殊板子1：加入 騎士/守衛/黑狼王/白狼王（並保留預女獵白）
========================================================= */

(function () {
  // 小工具：確保配置總數 = n（不符就補/扣村民）
  function normalizeToN(n, config, villagerKey = "villager") {
    const out = { ...config };
    const total = Object.values(out).reduce((a, b) => a + (b || 0), 0);
    const diff = n - total;
    out[villagerKey] = (out[villagerKey] || 0) + diff;
    if (out[villagerKey] < 0) out[villagerKey] = 0;
    return out;
  }

  // ========= 基本板子（6~12）=========
  // 固定：seer=1, witch=1, hunter=1, idiot=1
  // 狼人數：6-7(2狼), 8-9(3狼), 10-12(4狼)
  function basicPreset(n) {
    let wolves = 2;
    if (n >= 8 && n <= 9) wolves = 3;
    if (n >= 10) wolves = 4;

    const base = {
      werewolf: wolves,
      seer: 1,
      witch: 1,
      hunter: 1,
      idiot: 1,
      villager: 0
    };
    return normalizeToN(n, base, "villager");
  }

  const BASIC_PRESETS = {};
  for (let n = 6; n <= 12; n++) BASIC_PRESETS[n] = basicPreset(n);

  // ========= 特殊板子1（6~12）=========
  // 你指定：騎士、守衛、黑狼王、白狼王
  // 並保留：預女獵白（先做可玩、之後你再調整）
  //
  // 方案設計（可玩且不爆炸）：
  // - 6人：2狼（含1黑狼王）+ 預 + 女 + 獵 + 1民（不放白狼王/守衛/騎士，避免太擠）
  // - 7人：2狼（黑狼王+狼人）+ 預 + 女 + 獵 + 白痴 + 1民
  // - 8人：3狼（黑狼王+白狼王+狼人）+ 預女獵 + 白痴 + 1民
  // - 9人：3狼（黑狼王+白狼王+狼人）+ 預女獵白 + 守衛 + 1民
  // - 10人：4狼（黑狼王+白狼王+2狼人）+ 預女獵白 + 守衛 + 1民
  // - 11人：4狼（黑狼王+白狼王+2狼人）+ 預女獵白 + 守衛 + 騎士 + 1民
  // - 12人：4狼（黑狼王+白狼王+2狼人）+ 預女獵白 + 守衛 + 騎士 + 2民
  //
  // 這套的重點是：6~12 都能玩、強度逐步加，且你仍可在UI調整
  function specialPreset(n) {
    let cfg = {};

    if (n === 6) {
      cfg = { blackWolfKing: 1, werewolf: 1, seer: 1, witch: 1, hunter: 1, villager: 0 };
    } else if (n === 7) {
      cfg = { blackWolfKing: 1, werewolf: 1, seer: 1, witch: 1, hunter: 1, idiot: 1, villager: 0 };
    } else if (n === 8) {
      cfg = { blackWolfKing: 1, whiteWolfKing: 1, werewolf: 1, seer: 1, witch: 1, hunter: 1, idiot: 1, villager: 0 };
    } else if (n === 9) {
      cfg = { blackWolfKing: 1, whiteWolfKing: 1, werewolf: 1, seer: 1, witch: 1, hunter: 1, idiot: 1, guard: 1, villager: 0 };
    } else if (n === 10) {
      cfg = { blackWolfKing: 1, whiteWolfKing: 1, werewolf: 2, seer: 1, witch: 1, hunter: 1, idiot: 1, guard: 1, villager: 0 };
    } else if (n === 11) {
      cfg = { blackWolfKing: 1, whiteWolfKing: 1, werewolf: 2, seer: 1, witch: 1, hunter: 1, idiot: 1, guard: 1, knight: 1, villager: 0 };
    } else if (n === 12) {
      cfg = { blackWolfKing: 1, whiteWolfKing: 1, werewolf: 2, seer: 1, witch: 1, hunter: 1, idiot: 1, guard: 1, knight: 1, villager: 0 };
      cfg = normalizeToN(12, cfg, "villager"); // 會補成 2 民
      return cfg;
    }

    return normalizeToN(n, cfg, "villager");
  }

  const SPECIAL1_PRESETS = {};
  for (let n = 6; n <= 12; n++) SPECIAL1_PRESETS[n] = specialPreset(n);

  // ========= 對外輸出 =========
  const BOARDS = {
    basic: {
      id: "basic",
      name: "基本板子（預女獵白）",
      playerRange: [6, 12],
      rolesRecommended: ["seer", "witch", "hunter", "idiot", "werewolf", "villager"],
      presets: BASIC_PRESETS
    },

    special1: {
      id: "special1",
      name: "特殊板子 1（騎士/守衛/黑狼王/白狼王）",
      playerRange: [6, 12],
      rolesRecommended: [
        "seer", "witch", "hunter", "idiot",
        "guard", "knight",
        "blackWolfKing", "whiteWolfKing", "werewolf", "villager"
      ],
      presets: SPECIAL1_PRESETS
    }
  };

  window.WW_BOARDS = BOARDS;
})();
