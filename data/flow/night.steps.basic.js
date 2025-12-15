/* =========================================================
   WW_DATA Night Steps — Basic (MVP)
   產生夜晚 wizard steps（依現存角色動態生成）
   - 守衛：不能連守（由 UI/規則一起防呆）
   - 狼人：可空刀（wolfTarget = null 表示空刀）
   - 預言家：驗人結果只給上帝看
   - 女巫：刀口→救→毒；解藥已用過則不顯示刀口，只剩毒
========================================================= */

(function(){
  window.WW_DATA = window.WW_DATA || {};
  const W = window.WW_DATA;

  W.nightStepsBasic = function buildNightSteps(players, night){
    const hasAliveRole = (roleId) => players.some(p => p.alive && p.roleId === roleId);
    const hasRole = (roleId) => players.some(p => p.roleId === roleId);

    const steps = [];

    // helper: common scripts
    const info = (key, text) => ({
      key, type:"info",
      publicScript: text,
      godScript: text
    });

    steps.push(info("close", "天黑請閉眼。"));

    // 守衛
    if(hasAliveRole("guard")){
      steps.push({
        key: "guard",
        type: "pick",
        roleId: "guard",
        pickTarget: "guardTarget",
        required: true,
        allowNone: false,
        restrict: { aliveOnly:true },
        godScript:
          "守衛請睜眼。你要守誰？（點選座位）\n（規則）不能連守同一人。",
        publicScript:
          "守衛請睜眼。你要守誰？",
        validatePick: ({ seat, nightState, settings }) => {
          if(settings?.noConsecutiveGuard && nightState?.prevGuardTarget && seat === nightState.prevGuardTarget){
            return { ok:false, reason:"不能連守同一人" };
          }
          return { ok:true };
        }
      });
    }

    // 狼人（可空刀）
    if(hasAliveRole("werewolf") || hasAliveRole("blackWolfKing") || hasAliveRole("whiteWolfKing") || hasAliveRole("gargoyle")){
      steps.push({
        key: "wolf",
        type: "pick",
        roleId: "wolf",
        pickTarget: "wolfTarget",
        required: false,            // ✅ 因為可以空刀
        allowNone: true,            // wolfTarget = null 即空刀
        restrict: { aliveOnly:true },
        godScript:
          "狼人請睜眼。你們要刀誰？（點選座位）\n（可選）若空刀，請選擇「空刀」。",
        publicScript:
          "狼人請睜眼。你們要刀誰？"
      });
    }

    // 預言家
    if(hasAliveRole("seer")){
      steps.push({
        key: "seer",
        type: "seer",
        roleId: "seer",
        pickTarget: "seerCheckTarget",
        required: true,
        allowNone: false,
        restrict: { aliveOnly:true },
        godScript:
          "預言家請睜眼。你要查驗誰？（點選座位）\n（上帝）系統會顯示結果給你。",
        publicScript:
          "預言家請睜眼。你要查驗誰？",
        afterScript: ({ seerResult, targetSeat }) => {
          if(!targetSeat) return "";
          if(seerResult === "wolf") return `請告訴預言家：${targetSeat} 號是「狼人」。`;
          if(seerResult === "villager") return `請告訴預言家：${targetSeat} 號是「好人」。`;
          return "";
        }
      });
    }

    // 女巫（刀口→救→毒）
    // 如果場上有女巫（即使死了也可能不用出現；MVP：只在存活時出現）
    if(hasAliveRole("witch")){
      steps.push({
        key: "witch",
        type: "witch",
        roleId: "witch",
        required: false,
        godScript:
          "女巫請睜眼。（將以彈窗操作）\n流程：先告知刀口→是否用解藥→是否用毒藥。\n若解藥已用過：不顯示刀口，只可選擇是否用毒。",
        publicScript:
          "女巫請睜眼。"
      });
    }

    steps.push({
      key: "resolve",
      type: "resolve",
      publicScript: "天亮了，請睜眼。",
      godScript: "天亮了，請睜眼。（系統結算並生成公告）"
    });

    return steps;
  };

})();