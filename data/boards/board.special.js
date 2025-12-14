/* =========================================================
   狼人殺｜板子配置（特殊板子）
   檔案：/data/boards/board.special.js

   功能：
   - 可自由勾選特殊角色（丘比特、騎士、白狼王…）
   - 自動計算「狼人數 / 平民數」
   - 保證角色總數 = 玩家人數
   - 超出或不足會回傳錯誤訊息（給 UI 顯示）
========================================================= */

(() => {
  const root = (window.WW_DATA = window.WW_DATA || {});
  const roles = root.roles || {};

  /* -------------------------
     可用特殊角色池
     （只要 roles.special 有定義，就能用）
  ------------------------- */
  const SPECIAL_POOL = [
    "cupid",
    "knight",
    "whiteWolf",
    "wolfBeauty",
    "thief"
  ];

  /* -------------------------
     建立特殊板子
  ------------------------- */
  root.boardsSpecial = {
    id: "special",
    name: "特殊角色板子",

    playerMin: 6,
    playerMax: 16,

    specialPool: SPECIAL_POOL,

    /**
     * 依玩家數與勾選角色產生配置
     * @param {number} playerCount
     * @param {string[]} selectedRoles - 勾選的特殊角色 id
     * @returns {object} { ok, config, message }
     */
    build(playerCount, selectedRoles = []) {
      if (playerCount < this.playerMin || playerCount > this.playerMax) {
        return {
          ok: false,
          message: "玩家人數超出此板子範圍"
        };
      }

      const config = {};
      let usedSlots = 0;
      let wolfCount = 0;

      // 1️⃣ 先放入特殊角色
      selectedRoles.forEach(roleId => {
        if (!roles[roleId]) return;
        config[roleId] = 1;
        usedSlots += 1;

        if (roles[roleId].team === "wolf") {
          wolfCount += 1;
        }
      });

      // 2️⃣ 保底角色（預言家、女巫、獵人）
      ["seer", "witch", "hunter"].forEach(rid => {
        if (!config[rid]) {
          config[rid] = 1;
          usedSlots += 1;
        }
      });

      // 3️⃣ 狼人數量推估（扣掉白狼王等已算的狼）
      const baseWolf =
        playerCount >= 13 ? 4 :
        playerCount >= 10 ? 3 :
        2;

      const normalWolf = Math.max(0, baseWolf - wolfCount);
      if (normalWolf > 0) {
        config.werewolf = normalWolf;
        usedSlots += normalWolf;
        wolfCount += normalWolf;
      }

      // 4️⃣ 補村民到滿
      const villager = playerCount - usedSlots;
      if (villager < 0) {
        return {
          ok: false,
          message: "角色數量超過玩家人數，請取消部分角色"
        };
      }

      config.villager = villager;

      // 5️⃣ 最終校驗
      const total = Object.values(config).reduce((a, b) => a + b, 0);
      if (total !== playerCount) {
        return {
          ok: false,
          message: `角色總數錯誤（${total}/${playerCount}）`
        };
      }

      return {
        ok: true,
        config,
        message: "特殊板子配置完成"
      };
    }
  };

  // 合併到 boards
  root.boards = Object.assign({}, root.boards || {}, {
    special: root.boardsSpecial
  });
})();
