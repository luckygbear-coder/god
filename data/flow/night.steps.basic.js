/* =========================================================
   狼人殺｜上帝輔助 PWA
   檔案：/data/flow/night.steps.basic.js

   基本板子夜晚步驟生成器（Wizard Steps）
   - 依本局實際角色動態生成
   - 女巫使用 app.js 彈窗處理（type:"witch"）

   依賴：
   - WW_DATA.roles（roles.index.js 已合併）
========================================================= */

(function () {
  window.WW_DATA = window.WW_DATA || {};

  function hasRole(players, roleId) {
    return players.some(p => p.roleId === roleId);
  }

  // 給 app.js 呼叫：buildNightSteps(players, nightState, settings)
  function buildNightStepsBasic(players, night, settings = {}) {
    const steps = [];

    // 0) 天黑
    steps.push({
      key: "close",
      type: "info",
      publicScript: "天黑請閉眼。",
      godScript: "天黑請閉眼。"
    });

    // 1) 守衛
    if (hasRole(players, "guard")) {
      steps.push({
        key: "guard",
        type: "pick",
        pickTarget: "guardTarget",
        required: true,
        roleId: "guard",
        publicScript: "守衛請睜眼，請選擇你要守護的人。",
        godScript:
          "請說：『守衛請睜眼，你要守誰？』\n" +
          "（提示）若規則開啟「不能連守」，請避免連續守同一人。"
      });
    }

    // 2) 狼人
    if (hasRole(players, "werewolf") || players.some(p => (p.team === "wolf"))) {
      steps.push({
        key: "wolf",
        type: "pick",
        pickTarget: "wolfTarget",
        required: false, // 可空刀由規則決定，規則層會檢查
        roleId: "werewolf",
        publicScript: "狼人請睜眼，請選擇你們要刀的人。",
        godScript:
          "請說：『狼人請睜眼，你們要刀誰？』\n" +
          "（提示）若規則允許空刀，可不選人直接進下一步。"
      });
    }

    // 3) 預言家
    if (hasRole(players, "seer")) {
      steps.push({
        key: "seer",
        type: "seer",
        pickTarget: "seerCheckTarget",
        required: true,
        roleId: "seer",
        publicScript: "預言家請睜眼，請選擇你要查驗的人。",
        godScript:
          "請說：『預言家請睜眼，你要查驗誰？』\n" +
          "選擇後請告知預言家結果（好人/狼人）。",
        afterScript: ({ seerResult }) => {
          if (!seerResult) return "";
          return `\n（上帝）查驗結果：${seerResult === "wolf" ? "狼人" : "好人"}`;
        }
      });
    }

    // 4) 女巫（彈窗）
    if (hasRole(players, "witch")) {
      steps.push({
        key: "witch",
        type: "witch",
        roleId: "witch",
        publicScript:
          "女巫請睜眼。（需要上帝視角操作女巫用藥）",
        godScript:
          "請說：『女巫請睜眼。』\n" +
          "（上帝操作）接下來會開啟女巫彈窗：\n" +
          "1) 顯示今晚刀口（若解藥已用過則不顯示）\n" +
          "2) 選擇救 / 不救\n" +
          "3) 選擇毒 / 不毒\n" +
          "完成後回到夜晚流程。"
      });
    }

    // 5) 天亮結算
    steps.push({
      key: "resolve",
      type: "resolve",
      publicScript: "天亮請睜眼。",
      godScript:
        "請說：『天亮了，請大家睜眼。』\n" +
        "接著系統將自動結算死亡名單並生成公告。"
    });

    return steps;
  }

  window.WW_DATA.nightStepsBasic = buildNightStepsBasic;
})();