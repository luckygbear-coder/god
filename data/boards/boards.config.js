/* =========================================================
   狼人殺｜板子設定與預設配置（6～12人）
   檔案：data/boards/boards.config.js

   產出：
   - WW_BOARDS.basic
   - WW_BOARDS.b1

   設計原則：
   1) 每個 preset 都保證「角色總數 = 玩家數」
   2) 允許 UI 端再手動增減
========================================================= */

(function () {

  function sum(cfg) {
    return Object.values(cfg).reduce((a, b) => a + (b || 0), 0);
  }

  function normalizeToCount(cfg, n) {
    // 確保總數等於 n：不足補 villager，多了先減 villager
    const out = { ...cfg };
    const total = sum(out);

    if (total < n) out.villager = (out.villager || 0) + (n - total);
    if (total > n) {
      const extra = total - n;
      out.villager = Math.max(0, (out.villager || 0) - extra);
    }
    return out;
  }

  /* =========================================================
     BASIC（預女獵白 + 視人數加守衛 / 狼人）
  ========================================================= */

  const BASIC_PRESETS = {
    6:  normalizeToCount({ werewolf: 2, seer: 1, witch: 1, hunter: 1, villager: 1 }, 6),
    7:  normalizeToCount({ werewolf: 2, seer: 1, witch: 1, hunter: 1, villager: 2 }, 7),
    8:  normalizeToCount({ werewolf: 2, seer: 1, witch: 1, hunter: 1, villager: 3 }, 8),
    9:  normalizeToCount({ werewolf: 3, seer: 1, witch: 1, hunter: 1, villager: 3 }, 9),
    10: normalizeToCount({ werewolf: 3, seer: 1, witch: 1, hunter: 1, guard: 1, villager: 3 }, 10),
    11: normalizeToCount({ werewolf: 3, seer: 1, witch: 1, hunter: 1, guard: 1, villager: 4 }, 11),
    12: normalizeToCount({ werewolf: 4, seer: 1, witch: 1, hunter: 1, guard: 1, villager: 4 }, 12),
  };

  function basicPreset(n) {
    return BASIC_PRESETS[n] ? { ...BASIC_PRESETS[n] } : normalizeToCount({ werewolf: Math.max(2, Math.floor(n / 3)), seer: 1, witch: 1, hunter: 1, villager: 0 }, n);
  }

  /* =========================================================
     B1（你指定：騎士 + 守衛 + 黑狼王 + 白狼王 先做核心預設）
     - 仍保留 seer/witch/hunter 讓玩法穩定
     - 狼方：werewolf + blackWolfKing + whiteWolfKing
  ========================================================= */

  const B1_PRESETS = {
    6:  normalizeToCount({ werewolf: 1, blackWolfKing: 1, seer: 1, witch: 1, knight: 1, villager: 1 }, 6),
    7:  normalizeToCount({ werewolf: 1, blackWolfKing: 1, seer: 1, witch: 1, knight: 1, hunter: 1, villager: 1 }, 7),
    8:  normalizeToCount({ werewolf: 2, blackWolfKing: 1, seer: 1, witch: 1, knight: 1, hunter: 1, villager: 1 }, 8),
    9:  normalizeToCount({ werewolf: 2, blackWolfKing: 1, whiteWolfKing: 1, seer: 1, witch: 1, knight: 1, hunter: 1, villager: 1 }, 9),
    10: normalizeToCount({ werewolf: 2, blackWolfKing: 1, whiteWolfKing: 1, seer: 1, witch: 1, knight: 1, hunter: 1, guard: 1, villager: 1 }, 10),
    11: normalizeToCount({ werewolf: 2, blackWolfKing: 1, whiteWolfKing: 1, seer: 1, witch: 1, knight: 1, hunter: 1, guard: 1, villager: 2 }, 11),
    12: normalizeToCount({ werewolf: 3, blackWolfKing: 1, whiteWolfKing: 1, seer: 1, witch: 1, knight: 1, hunter: 1, guard: 1, villager: 2 }, 12),
  };

  function b1Preset(n) {
    return B1_PRESETS[n] ? { ...B1_PRESETS[n] } : normalizeToCount({
      werewolf: Math.max(2, Math.floor(n / 3)),
      blackWolfKing: 1,
      whiteWolfKing: n >= 9 ? 1 : 0,
      seer: 1,
      witch: 1,
      knight: 1,
      hunter: 1,
      guard: n >= 10 ? 1 : 0,
      villager: 0
    }, n);
  }

  /* =========================================================
     Boards meta
  ========================================================= */

  const BOARDS = {
    basic: {
      id: "basic",
      name: "基本板子（預女獵白）",
      range: [6, 12],
      presets: BASIC_PRESETS,
      getPreset: basicPreset,
      rolesPool: [
        "werewolf", "villager", "seer", "witch", "hunter", "guard"
      ],
      rulesKey: "rulesBasic",
      nightStepsKey: "WW_NIGHT_STEPS_BASIC"
    },

    b1: {
      id: "b1",
      name: "特殊板子 B1（騎士/守衛/黑狼王/白狼王）",
      range: [6, 12],
      presets: B1_PRESETS,
      getPreset: b1Preset,
      rolesPool: [
        // 基本
        "werewolf", "villager", "seer", "witch", "hunter", "guard",
        // 你指定核心
        "knight", "blackWolfKing", "whiteWolfKing",
        // B1 擴充（先給 pool，UI 才能勾）
        "idiot", "stoneGargoyle", "cupid", "admirer",
        "dreamEater", "magician", "blackMarketDealer", "luckyOne",
        "demonHunter", "evilKnight"
      ],
      rulesKey: "rulesB1",
      nightStepsKey: "WW_NIGHT_STEPS_B1"
    }
  };

  window.WW_BOARDS = BOARDS;

})();