/* =========================================================
   最小可用 Basic 板子（只為讓流程跑起來）
========================================================= */

(function () {
  window.WW_DATA = window.WW_DATA || {};

  // 對 app.js 提供的統一入口
  window.WW_DATA.getBoardBundle = function (boardId) {
    if (boardId !== "basic") return null;

    return {
      board: {
        id: "basic",
        name: "基本板子",

        // ⚠️ 這是 app.js 一定會呼叫的
        buildPlayers() {
          // 暫時寫死 9 人，之後再接 UI
          return [
            { seat: 1, name: "狼人", icon: "🐺", alive: true },
            { seat: 2, name: "狼人", icon: "🐺", alive: true },
            { seat: 3, name: "預言家", icon: "🔮", alive: true },
            { seat: 4, name: "女巫", icon: "🧪", alive: true },
            { seat: 5, name: "獵人", icon: "🔫", alive: true },
            { seat: 6, name: "村民", icon: "🙂", alive: true },
            { seat: 7, name: "村民", icon: "🙂", alive: true },
            { seat: 8, name: "村民", icon: "🙂", alive: true },
            { seat: 9, name: "村民", icon: "🙂", alive: true },
          ];
        },

        // 預留設定（之後會用）
        settings: {}
      },

      // 先空的，之後再接
      rules: {},
      nightSteps: []
    };
  };
})();
