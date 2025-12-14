/* =========================================================
   狼人殺｜夜晚流程步驟表（基本板子）
   檔案：/data/flow/night.steps.basic.js

   - 只放「夜晚 Wizard 步驟」
   - 每一步可設定：
     key / type / needsRole / required / scripts / pickTarget / apply
   - app.js 之後會改成「讀取這張表」來動態生成夜晚流程
   - 全域掛載：window.WW_DATA.nightStepsBasic
========================================================= */

(() => {
  const root = (window.WW_DATA = window.WW_DATA || {});
  const roles = root.roles || {};

  // 工具：判斷這局是否有某角色
  const hasRole = (players, roleId) => players?.some(p => p.roleId === roleId);

  // 工具：上帝台詞模板
  const SAY = {
    close: "天黑請閉眼。",
    open:  "天亮請睜眼。",

    guardAsk: "請說：「守衛請睜眼，你要守誰？」",
    wolfAsk:  "請說：「狼人請睜眼，你們要刀誰？」",

    seerAsk:  "請說：「預言家請睜眼，你要查驗誰？」",
    seerGood: "請說：「他的身分是——好人。」",
    seerWolf: "請說：「他的身分是——狼人。」",

    witchAsk: "請說：「女巫請睜眼，今晚被刀的是 X 號，你要用解藥/毒藥嗎？」"
  };

  /* ---------------------------------------------------------
     步驟表：回傳一個陣列（依順序執行）
     type:
       - info     : 只顯示台詞
       - pick     : 需要點選座位（存到 state.night[pickTarget]）
       - seer     : 特化 pick（點選後計算好人/狼人）
       - witch    : 特化（顯示狼刀目標 + 解/毒按鈕邏輯由 app.js 或 modal panel 處理）
       - resolve  : 結算天亮公告（由 app.js 規則層處理）
  --------------------------------------------------------- */
  root.nightStepsBasic = function buildNightSteps(players, stateNight) {
    const steps = [];

    // 1) 天黑閉眼
    steps.push({
      key: "close",
      type: "info",
      title: "天黑",
      publicScript: SAY.close,
      godScript: SAY.close
    });

    // 2) 守衛（可選）
    if (hasRole(players, "guard")) {
      steps.push({
        key: "guard",
        type: "pick",
        title: "守衛",
        needsRole: "guard",
        required: false,
        pickTarget: "guardTarget",
        publicScript: "守衛請睜眼。",
        godScript: `${SAY.guardAsk}\n（點選座位）`,
        ui: {
          pickAliveOnly: true,
          allowSelf: true
        }
      });
    }

    // 3) 狼人（必有）
    steps.push({
      key: "wolf",
      type: "pick",
      title: "狼人",
      needsRole: "werewolf", // 只要有狼人就算
      required: true,
      pickTarget: "wolfTarget",
      publicScript: "狼人請睜眼。",
      godScript: `${SAY.wolfAsk}\n（點選座位｜未選不能下一步）`,
      ui: {
        pickAliveOnly: true,
        allowSelf: false // 狼刀自己通常不允許（你若要開放可改 true）
      }
    });

    // 4) 預言家（可選）
    if (hasRole(players, "seer")) {
      steps.push({
        key: "seer",
        type: "seer",
        title: "預言家",
        needsRole: "seer",
        required: false,
        pickTarget: "seerCheckTarget",
        resultTarget: "seerResult",
        publicScript: "預言家請睜眼。",
        godScript: `${SAY.seerAsk}\n（點選座位）`,
        ui: {
          pickAliveOnly: true,
          allowSelf: true
        },
        apply({ players, seat }) {
          const target = players.find(p => p.seat === seat);
          const isWolf = target?.team === "wolf";
          return { seerResult: isWolf ? "wolf" : "villager" };
        },
        afterScript({ seerResult }) {
          if (!seerResult) return "";
          return `\n（上帝視角）查驗結果：${seerResult === "wolf" ? "狼人" : "好人"}\n` +
            (seerResult === "wolf" ? SAY.seerWolf : SAY.seerGood);
        }
      });
    }

    // 5) 女巫（可選）
    if (hasRole(players, "witch")) {
      steps.push({
        key: "witch",
        type: "witch",
        title: "女巫",
        needsRole: "witch",
        required: false,
        publicScript: "女巫請睜眼。",
        godScript: `${SAY.witchAsk}\n（解藥/毒藥在面板操作）`,
        ui: {
          // 由 app.js 的 modal panel 接手
          panel: "witchPanel"
        },
        infoForWitch({ wolfTarget }) {
          return wolfTarget ? `今晚被刀：${wolfTarget} 號` : "今晚未選狼刀目標";
        }
      });
    }

    // 6) 天亮結算
    steps.push({
      key: "dawn",
      type: "resolve",
      title: "天亮",
      publicScript: SAY.open,
      godScript: `${SAY.open}\n（系統結算並生成公告）`
    });

    return steps;
  };

})();
