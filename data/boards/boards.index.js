/* =========================================================
   狼人殺｜上帝輔助 PWA
   檔案：/data/boards/boards.index.js

   板子資料合併載入器
   需要先載入：
   - /data/boards/boards.basic.js  -> WW_DATA.boards.basic
   - /data/boards/boards.b1.js     -> WW_DATA.boards.b1

   產出：
   - WW_DATA.boards（統一入口）
   - WW_DATA.getBoard(boardId)
========================================================= */

(function () {
  window.WW_DATA = window.WW_DATA || {};
  window.WW_DATA.boards = window.WW_DATA.boards || {};

  const boards = window.WW_DATA.boards;

  // 工具：取板子
  window.WW_DATA.getBoard = function getBoard(boardId) {
    return boards[boardId] || null;
  };

  // 自檢旗標
  window.WW_DATA.__boardsReady = true;
})();
