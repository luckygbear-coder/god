/* =========================================================
   狼人殺｜勝負判定引擎
   檔案：engine/win.engine.js

   職責：
   ✅ 統一入口：checkWin(boardType, players, stateMeta)
   ✅ 支援第三方（由 rules.b1.checkWin 內處理優先順序）
========================================================= */

(function () {
  const BASIC = window.WW_RULES_BASIC;
  const B1 = window.WW_RULES_B1;

  function checkWin({ boardType, players, stateMeta }) {
    if (boardType === "b1") {
      if (!B1?.checkWin) {
        console.error("❌ rules.b1.js 未載入或缺少 checkWin()");
        return null;
      }
      return B1.checkWin(players, stateMeta || {});
    }

    if (!BASIC?.checkWin) {
      console.error("❌ rules.basic.js 未載入或缺少 checkWin()");
      return null;
    }
    return BASIC.checkWin(players);
  }

  function formatWinText(win) {
    if (!win) return null;

    if (win.winner === "villager") {
      return `✅ 正義聯盟獲勝！\n原因：${win.reason || "達成勝利條件"}`;
    }
    if (win.winner === "wolf") {
      return `🐺 邪惡陣營獲勝！\n原因：${win.reason || "達成勝利條件"}`;
    }
    if (win.winner === "third") {
      return `💞 第三方獲勝！\n原因：${win.reason || "達成勝利條件"}`;
    }

    return `🏁 遊戲結束：${win.winner}\n原因：${win.reason || "—"}`;
  }

  window.WW_WIN_ENGINE = {
    checkWin,
    formatWinText
  };
})();
