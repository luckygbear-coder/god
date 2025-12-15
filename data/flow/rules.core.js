/* =========================================================
   WW_DATA Rules — Core (MVP)
   - 夜晚結算：守衛/狼人/女巫（救/毒）/ 預言家結果由上層存
   - 規則開關：
      noConsecutiveGuard
      wolfCanSkipKill
      witchCannotSelfSave
      hunterPoisonNoShoot
      blackWolfKingPoisonNoSkill
      guardAndSavePierce  (救同守則奶穿：同守同救仍然死，沒有平安夜)
   - 死亡技能觸發限制：獵人/黑狼王 被毒死亡 => 禁用
   - 勝負判定：MVP（狼=0 或 好人<=狼）
     第三方：先留接口（後續 Cupid/暗戀者/黑市商人…再擴充）
========================================================= */

(function(){
  window.WW_DATA = window.WW_DATA || {};
  const W = window.WW_DATA;

  // 工具
  const deepClone = (x) => JSON.parse(JSON.stringify(x));
  const seatOfRole = (players, roleId) => players.find(p=>p.roleId===roleId)?.seat ?? null;

  function aliveSeats(players){
    return players.filter(p=>p.alive).map(p=>p.seat);
  }
  function isAlive(players, seat){
    return !!players.find(p=>p.seat===seat && p.alive);
  }
  function teamOf(players, seat){
    return players.find(p=>p.seat===seat)?.team || "villager";
  }
  function roleIdOf(players, seat){
    return players.find(p=>p.seat===seat)?.roleId || null;
  }

  /* =========================================================
     resolveNight
     input:
       players: [{seat, roleId, team, alive...}]
       night: {
         guardTarget, prevGuardTarget,
         wolfTarget (null=空刀),
         witchSaveUsed, witchPoisonUsed,
         witchSave (boolean), witchPoisonTarget
       }
       settings: 規則開關
     output:
       {
         deaths: [seat...],
         deathReason: { [seat]: "wolf"|"poison"|... },
         meta: {...}
       }
========================================================= */
  function resolveNight({players, night, settings}){
    const rules = settings || {};
    const alive = new Set(aliveSeats(players));

    const meta = {
      wolfTargetRaw: night.wolfTarget ?? null,
      guardTargetRaw: night.guardTarget ?? null,
      witchSaveChosen: !!night.witchSave,
      witchPoisonTargetRaw: night.witchPoisonTarget ?? null,
      saveEffective: false,
      guardBlocked: false,
      wolfSkipped: false,
      pierceGuardSave: false
    };

    // 0) wolfCanSkipKill：允許空刀
    let wolfTarget = night.wolfTarget ?? null;
    if(!wolfTarget){
      meta.wolfSkipped = true;
      wolfTarget = null;
    }

    // 1) guard target validity（不能連守：這裡不改你的選擇，但提供 meta 告知）
    if(rules.noConsecutiveGuard && night.prevGuardTarget && night.guardTarget === night.prevGuardTarget){
      meta.guardInvalidConsecutive = true;
      // MVP：視為當晚守衛無效（避免你 UI 阻擋失敗時還能結算）
      meta.guardTargetEffective = null;
    }else{
      meta.guardTargetEffective = night.guardTarget ?? null;
    }

    const guardTarget = meta.guardTargetEffective;

    // 2) 狼刀 vs 守衛
    let wolfKills = null;
    if(wolfTarget && alive.has(wolfTarget)){
      if(guardTarget && wolfTarget === guardTarget){
        meta.guardBlocked = true;
        wolfKills = null;
      }else{
        wolfKills = wolfTarget;
      }
    }

    // 3) 女巫救（只能救狼刀那位）
    let saveEffective = false;
    if(wolfKills && night.witchSave && !night.witchSaveUsed){
      const witchSeat = seatOfRole(players, "witch");
      // 女巫不能自救：若狼刀目標=女巫自己，救無效
      if(rules.witchCannotSelfSave && witchSeat && wolfKills === witchSeat){
        saveEffective = false;
        meta.saveBlockedBySelfRule = true;
      }else{
        saveEffective = true;
      }
    }
    meta.saveEffective = saveEffective;

    // 4) 救同守則奶穿（沒有平安夜）
    // 若同時：狼刀被守到（guardBlocked=true）且 女巫仍選擇救（saveEffective=true）
    // => 依你說的：奶穿（仍然死亡）
    if(rules.guardAndSavePierce && meta.guardBlocked && saveEffective){
      meta.pierceGuardSave = true;
      // 讓狼刀有效（穿透）
      wolfKills = wolfTarget;
      // 視為救無效
      saveEffective = false;
      meta.saveEffective = false;
    }

    // 5) 最終狼刀死者
    const deaths = [];
    const deathReason = {};
    if(wolfKills && alive.has(wolfKills)){
      if(saveEffective){
        // 被救，狼刀無效
      }else{
        deaths.push(wolfKills);
        deathReason[wolfKills] = "wolf";
      }
    }

    // 6) 女巫毒（可與狼刀同晚雙死）
    const poisonTarget = night.witchPoisonTarget ?? null;
    if(poisonTarget && alive.has(poisonTarget) && !night.witchPoisonUsed){
      if(!deaths.includes(poisonTarget)){
        deaths.push(poisonTarget);
      }
      deathReason[poisonTarget] = deathReason[poisonTarget] || "poison";
    }

    // 去重
    const uniq = Array.from(new Set(deaths)).sort((a,b)=>a-b);

    return {
      deaths: uniq,
      deathReason,
      meta
    };
  }

  /* =========================================================
     canTriggerDeathSkill
     - 被毒死亡 => 禁用獵人開槍、黑狼王帶人（依你規則）
========================================================= */
  function canTriggerDeathSkill({roleId, seat, resolved, settings}){
    const rules = settings || {};
    const reason = resolved?.deathReason?.[seat] || null;

    // 只有「被毒死亡」才限制（處刑/狼刀都可觸發）
    const diedByPoison = reason === "poison";

    if(roleId === "hunter" && rules.hunterPoisonNoShoot && diedByPoison){
      return false;
    }
    if(roleId === "blackWolfKing" && rules.blackWolfKingPoisonNoSkill && diedByPoison){
      return false;
    }
    return true;
  }

  /* =========================================================
     buildAnnouncement
     - publicText：給玩家
     - hiddenText：上帝額外資訊
========================================================= */
  function buildAnnouncement({nightNo, dayNo, players, night, resolved, settings}){
    const deaths = resolved.deaths || [];
    const publicLines = [];
    const hiddenLines = [];

    publicLines.push(`第 ${nightNo} 夜結束，天亮了。`);
    if(deaths.length){
      publicLines.push(`昨晚死亡的是：${deaths.join("、")} 號。`);
    }else{
      publicLines.push(`昨晚是平安夜。`);
    }

    // 小朋友模式（你後面會接 kidsMode；這裡先留 hook）
    // 上層可自行追加 publicText

    // hidden：夜晚行動
    hiddenLines.push(`【隱藏｜夜晚行動】`);
    hiddenLines.push(`守衛：${night.guardTarget ? night.guardTarget+" 號" : "—"}${resolved.meta?.guardInvalidConsecutive ? "（連守無效）" : ""}`);
    hiddenLines.push(`狼人：${night.wolfTarget ? night.wolfTarget+" 號" : "空刀"}`);
    if(night.seerCheckTarget){
      const t = night.seerCheckTarget;
      const result = night.seerResult || (teamOf(players, t)==="wolf" ? "wolf" : "villager");
      hiddenLines.push(`預言家：驗 ${t} 號 → ${result==="wolf" ? "狼人" : "好人"}`);
    }
    hiddenLines.push(`女巫：解藥=${night.witchSaveUsed ? "已用過" : (night.witchSave ? "本夜使用" : "未用")}；毒藥=${night.witchPoisonUsed ? "已用過" : (night.witchPoisonTarget ? `毒 ${night.witchPoisonTarget} 號` : "未用")}`);

    // 規則 meta 提示
    if(resolved.meta?.pierceGuardSave){
      hiddenLines.push(`⚠️ 規則：救同守 => 奶穿（同守同救仍然死亡）`);
    }

    return {
      publicText: publicLines.join("\n"),
      hiddenText: hiddenLines.join("\n")
    };
  }

  function makeLogItem({ts, nightNo, dayNo, publicText, hiddenText, votes=null, actions=null, resolvedMeta=null}){
    return {
      ts,
      nightNo,
      dayNo,
      publicText,
      hiddenText,
      votes,
      actions,
      resolvedMeta
    };
  }

  /* =========================================================
     checkWin (MVP)
     - wolfAlive = 邪惡陣營存活數
     - goodAlive = 正義陣營存活數
     - thirdAlive = 第三方存活數（先留接口）
     return:
       { ended:boolean, winner:"wolf"|"villager"|"third"|null, reason:string }
========================================================= */
  function checkWin(players){
    const alive = players.filter(p=>p.alive);
    const wolfAlive = alive.filter(p=>p.team==="wolf").length;
    const villAlive = alive.filter(p=>p.team==="villager").length;
    const thirdAlive = alive.filter(p=>p.team==="third").length;

    // MVP：
    if(wolfAlive === 0){
      return { ended:true, winner:"villager", reason:"所有邪惡陣營已被放逐/死亡" };
    }
    if(villAlive <= wolfAlive){
      return { ended:true, winner:"wolf", reason:"邪惡陣營人數達到或超過正義陣營" };
    }

    // 第三方勝利條件（先留接口，後面 Cupid/暗戀者再補）
    // if(thirdAlive>0 && someThirdConditionMet) return {ended:true, winner:"third", reason:"..."}

    return { ended:false, winner:null, reason:"" };
  }

  // Export
  W.rulesCore = {
    resolveNight,
    buildAnnouncement,
    makeLogItem,
    canTriggerDeathSkill,
    checkWin
  };

})();