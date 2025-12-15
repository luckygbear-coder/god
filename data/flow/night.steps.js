/* =========================================================
   data/flow/night.steps.js
   Build night wizard steps based on selected board + roles

   Exposes:
     window.WW_DATA.nightSteps = { buildNightSteps(state) }

   Step format (for app.js):
     {
       key: "wolf",
       type: "pick" | "info" | "seer" | "witchPanel" | "resolve",
       pickTarget?: "wolfTarget" | "guardTarget" | "seerCheckTarget",
       required?: boolean,
       allowSkip?: boolean,
       godScript: string,
       publicScript: string,
       afterScript?: ({state})=>string   // optional, god-only append
     }
========================================================= */

(function(){
  const W = window.WW_DATA || (window.WW_DATA = {});
  const roles = W.rolesAll || W.roles || {};

  function roleInfo(id){
    return roles[id] || { id, name:id, team:"villager", icon:"❔" };
  }

  function hasRole(state, roleId){
    return (state.players||[]).some(p=>p.roleId===roleId);
  }

  function aliveSeatList(state){
    return (state.players||[]).filter(p=>p.alive).map(p=>p.seat);
  }

  function getTeamOfSeat(state, seat){
    const p = (state.players||[]).find(x=>x.seat===seat);
    if(!p) return "villager";
    return p.team || roleInfo(p.roleId).team || "villager";
  }

  // small helper for scripts
  function lineJoin(arr){ return (arr||[]).filter(Boolean).join("\n"); }

  /* =========================================================
     Build steps
     boardType: "basic" | "b1" (special)
     steps order baseline:
       close -> (guard) -> (wolves) -> (seer) -> (witch) -> resolve
     Later: add special roles (dreamer / gargoyle etc) by inserting here.
  ========================================================= */
  function buildNightSteps(state){
    const rules = state?.settings?.rules || {};
    const steps = [];
    const board = state.boardType || "basic";

    // 0) Close eyes
    steps.push({
      key:"close",
      type:"info",
      godScript:"天黑請閉眼。",
      publicScript:"天黑請閉眼。"
    });

    // 1) Guard
    if(hasRole(state,"guard")){
      const note = rules.noConsecutiveGuard
        ? "（規則：守衛不能連守同一人）"
        : "";
      steps.push({
        key:"guard",
        type:"pick",
        pickTarget:"guardTarget",
        required:false,
        allowSkip:true,
        godScript: lineJoin([
          "守衛請睜眼。你要守誰？（點選座位）",
          note,
          "完成後請說：守衛請閉眼。"
        ]),
        publicScript:"守衛請睜眼。"
      });
    }

    // 2) Wolves
    if(hasRole(state,"werewolf") || hasRole(state,"blackWolfKing") || hasRole(state,"whiteWolfKing") || hasRole(state,"wolf")){
      const canSkip = !!rules.wolvesCanSkip;
      steps.push({
        key:"wolf",
        type:"pick",
        pickTarget:"wolfTarget",
        required: false,           // allow skip
        allowSkip: canSkip,
        godScript: lineJoin([
          "狼人請睜眼。你們要刀誰？（點選座位）",
          canSkip ? "（可空刀：不選刀口也可以直接下一步）" : "（本局不允許空刀：請務必選刀口）",
          "完成後請說：狼人請閉眼。"
        ]),
        publicScript:"狼人請睜眼。"
      });
    }

    // 3) Seer
    if(hasRole(state,"seer")){
      steps.push({
        key:"seer",
        type:"seer",
        pickTarget:"seerCheckTarget",
        required:true,
        godScript: lineJoin([
          "預言家請睜眼。你要查驗誰？（點選座位）",
          "我會在上帝視角顯示結果，你再口頭告訴預言家。",
          "完成後請說：預言家請閉眼。"
        ]),
        publicScript:"預言家請睜眼。",
        afterScript: ({state})=>{
          const seat = state?.night?.seerCheckTarget;
          if(!seat) return "";
          const team = getTeamOfSeat(state, seat);
          return `（上帝）查驗結果：${seat} 號是 —— ${team==="wolf" ? "狼人" : "好人"}。`;
        }
      });
    }

    // 4) Witch (panel)
    if(hasRole(state,"witch")){
      // If save already used: panel should only allow poison (刀口不顯示) — UI 會處理
      steps.push({
        key:"witch",
        type:"witchPanel",
        godScript: lineJoin([
          "女巫請睜眼。",
          "（系統會開啟女巫操作彈窗：刀口→要不要救→要不要毒）",
          "完成後請說：女巫請閉眼。"
        ]),
        publicScript:"女巫請睜眼。"
      });
    }

    // ===== Special board b1 skeleton insertion points =====
    // 你說「特殊板子全部都做」：我們先把 b1 的夜晚插槽留好，
    // 之後每個角色的規則確認後，再逐一加上 pick/panel/skill
    if(board === "b1"){
      // Example placeholders (disabled unless role exists)
      if(hasRole(state,"gargoyle")){
        steps.splice(1,0,{
          key:"gargoyle",
          type:"pick",
          pickTarget:"gargoyleTarget",
          required:false,
          allowSkip:true,
          godScript:"石像鬼請睜眼。你要盯誰？（點選座位）完成後石像鬼閉眼。",
          publicScript:"石像鬼請睜眼。"
        });
      }

      if(hasRole(state,"dreamEater")){ // 攝夢人
        steps.splice(2,0,{
          key:"dreamEater",
          type:"pick",
          pickTarget:"dreamTarget",
          required:false,
          allowSkip:true,
          godScript:"攝夢人請睜眼。你要攝誰的夢？（點選座位）完成後閉眼。",
          publicScript:"攝夢人請睜眼。"
        });
      }

      // 黑市商人/魔術師/幸運兒/獵魔人/惡靈騎士/白痴/邱比特/暗戀者…（後續加）
      // Cupid is usually first night only → will be handled by day0 / special phase later.
    }

    // 5) Resolve
    steps.push({
      key:"resolve",
      type:"resolve",
      godScript:"天亮請睜眼。（系統將自動結算並跳出公告）",
      publicScript:"天亮請睜眼。"
    });

    return steps;
  }

  W.nightSteps = { buildNightSteps };

})();