/* =========================================================
   狼人殺｜夜晚流程（資料驅動）
   data/flow/night.steps.js

   目標：
   - 依照 roles 自動生成夜晚 wizard steps
   - 每一步有：
     - key
     - type: info | pick | seer | witch | resolve
     - speaker: 主持台詞（公開/上帝）
     - pick: 需要點選座位的目標欄位（寫到 night 狀態）
     - required: 是否必選（狼人刀，若允許空刀可不必）
   - 不做任何死亡結算（rules.core.js 會做）
========================================================= */

(function () {

  function hasRole(players, roleId){
    return players.some(p => p.alive && p.roleId === roleId);
  }

  function aliveSeats(players){
    return players.filter(p=>p.alive).map(p=>p.seat);
  }

  // 給 app.js 用：回傳 step 陣列
  function buildNightSteps({ players, boardId, rules, nightState }) {

    const steps = [];
    const alive = aliveSeats(players);

    // 0. 天黑
    steps.push({
      key:"close",
      type:"info",
      publicText:"天黑請閉眼。",
      godText:"（上帝）天黑請閉眼。準備進入夜晚流程。"
    });

    // 1. 守衛（如果存在）
    if(hasRole(players,"guard")){
      steps.push({
        key:"guard",
        type:"pick",
        actor:"guard",
        pickKey:"guardTarget",
        required:true,
        publicText:"守衛請睜眼。你要守誰？（點選座位）",
        godText:"（上帝）守衛睜眼：請問要守誰？（點選座位）",
        help: "規則：不能連守由 rules 處理（會提示/阻擋）。"
      });
    }

    // 2. 狼人（狼人/狼王合併行動：刀人 或 空刀）
    // 有任何 wolf team 的「夜晚行動狼」都視為狼人回合
    // MVP：只記 wolfTarget（後續可擴充多狼一致確認）
    const hasWolf = players.some(p=>p.alive && (p.team==="wolf"));
    if(hasWolf){
      const canSkip = !!rules?.wolfCanSkip;
      steps.push({
        key:"wolf",
        type:"pick",
        actor:"wolf",
        pickKey:"wolfTarget",
        required: !canSkip, // 允許空刀→非必選
        allowNone: canSkip,
        publicText: canSkip
          ? "狼人請睜眼。你們要刀誰？（可選擇空刀）"
          : "狼人請睜眼。你們要刀誰？（點選座位）",
        godText: canSkip
          ? "（上帝）狼人回合：刀誰？（可選擇空刀）"
          : "（上帝）狼人回合：刀誰？（必選）",
        help: "若空刀：wolfTarget = null。"
      });
    }

    // 3. 預言家
    if(hasRole(players,"seer")){
      steps.push({
        key:"seer",
        type:"seer",
        actor:"seer",
        pickKey:"seerCheckTarget",
        required:true,
        publicText:"預言家請睜眼。你要查驗誰？（點選座位）",
        godText:"（上帝）預言家回合：請選擇查驗目標（點選座位），系統會顯示結果（好人/狼人）。",
        help:"查驗結果只在上帝視角可見。"
      });
    }

    // 4. 女巫（彈窗操作）
    if(hasRole(players,"witch")){
      steps.push({
        key:"witch",
        type:"witch",
        actor:"witch",
        required:false,
        publicText:"女巫請睜眼。（請上帝操作女巫彈窗）",
        godText:"（上帝）女巫回合：請開啟女巫彈窗（先告知刀口→再選救/不救→再選毒/不毒）。",
        help:"如果解藥已用過：不顯示刀口，只能選毒/不毒。"
      });
    }

    // 5. 天亮前（結算）
    steps.push({
      key:"resolve",
      type:"resolve",
      publicText:"天亮請睜眼。",
      godText:"（上帝）天亮結算：按下一步會進行結算並自動生成公告。"
    });

    return steps;
  }

  // export
  window.WW_NIGHT = {
    buildNightSteps
  };

})();
