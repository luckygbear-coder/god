/* =========================================================
   data/flow/rules.core.js
   Core rule engine for Werewolf God Assist PWA

   ✅ Night resolve MVP + rule toggles:
     - noConsecutiveGuard
     - wolvesCanSkip
     - witchCannotSelfSave
     - milkPierce (guard+save => die; no peaceful night)
     - hunterPoisonNoShoot
     - blackWolfKingPoisonNoSkill

   ✅ Vote tie policy:
     - tieSecondNoExile (2nd tie => no exile, go night)

   ✅ Win check framework:
     - supports villager vs wolf
     - supports third parties (Cupid lovers / crush etc) via hooks
========================================================= */

(function(){
  const W = window.WW_DATA || (window.WW_DATA = {});
  const roles = W.rolesAll || W.roles || {};

  function roleInfo(id){
    return roles[id] || { id, name:id, team:"villager" };
  }

  function getPlayer(players, seat){
    return players.find(p=>p.seat===seat) || null;
  }

  function alive(players){
    return players.filter(p=>p.alive);
  }

  function aliveByTeam(players, team){
    return alive(players).filter(p=> (p.team || roleInfo(p.roleId).team) === team);
  }

  function uniq(arr){
    return [...new Set((arr||[]).filter(Boolean))];
  }

  function isPoisonDeath(resolved, seat){
    return !!resolved?.meta?.poisonDeaths?.includes(seat);
  }

  function isWolfKillDeath(resolved, seat){
    return !!resolved?.meta?.wolfDeaths?.includes(seat);
  }

  /* =========================================================
     Night resolve
     Inputs:
       - players: [{seat, roleId, team, alive, ...}]
       - night: { guardTarget, prevGuardTarget, wolfTarget, seerCheckTarget, witchSave, witchPoisonTarget, witchSaveUsed, witchPoisonUsed }
       - settings: rules toggles
     Output:
       {
         deaths: [seat...],
         meta: {
            wolfTargetRaw, guardTargetRaw,
            wolfDeaths:[], poisonDeaths:[],
            blockedByGuard:boolean,
            blockedBySave:boolean,
            milkPierce:boolean,
            notes:[...]
         }
       }
  ========================================================= */
  function resolveNight({players, night, settings}){
    const rules = Object.assign({
      noConsecutiveGuard:true,
      wolvesCanSkip:true,
      witchCannotSelfSave:true,
      milkPierce:true,
      hunterPoisonNoShoot:true,
      blackWolfKingPoisonNoSkill:true
    }, settings || {});

    const meta = {
      wolfTargetRaw: night?.wolfTarget ?? null,
      guardTargetRaw: night?.guardTarget ?? null,
      wolfDeaths: [],
      poisonDeaths: [],
      blockedByGuard: false,
      blockedBySave: false,
      milkPierce: false,
      notes: []
    };

    const deaths = [];

    // -------- Validate targets: must be alive to be meaningful
    const wolfTarget = getPlayer(players, meta.wolfTargetRaw)?.alive ? meta.wolfTargetRaw : null;
    const guardTarget = getPlayer(players, meta.guardTargetRaw)?.alive ? meta.guardTargetRaw : null;

    // -------- Guard "no consecutive"
    if(rules.noConsecutiveGuard && guardTarget && night?.prevGuardTarget && guardTarget === night.prevGuardTarget){
      meta.notes.push(`守衛不能連守：本夜守衛目標 ${guardTarget} 無效`);
      // treat as no guard
      meta.guardTargetRaw = null;
    }

    // -------- Wolf can skip
    // If wolvesCanSkip true and wolfTarget is null -> no wolf kill
    // If wolvesCanSkip false -> require wolfTarget; but controller should enforce in steps.
    let effectiveWolfTarget = wolfTarget;

    if(!effectiveWolfTarget){
      if(rules.wolvesCanSkip){
        meta.notes.push("狼人空刀 / 無狼刀目標");
      }else{
        meta.notes.push("⚠️ 規則不允許空刀，但本夜未選刀口（視為無狼刀）");
      }
    }

    // -------- Witch save only applies to wolf target
    // Witch cannot self-save (optional)
    let saveApplies = false;
    if(night?.witchSave && effectiveWolfTarget){
      const witchSeat = players.find(p=>p.roleId==="witch")?.seat ?? null;
      if(rules.witchCannotSelfSave && witchSeat && witchSeat === effectiveWolfTarget){
        meta.notes.push("女巫不能自救：解藥判定無效");
        saveApplies = false;
      }else{
        saveApplies = true;
      }
    }

    // -------- Guard blocks wolf kill unless milkPierce rule triggers with save
    const guarded = (effectiveWolfTarget && meta.guardTargetRaw && effectiveWolfTarget === meta.guardTargetRaw);

    // CASE: milkPierce enabled and guarded + saved => target still dies (沒有平安夜)
    if(rules.milkPierce && guarded && saveApplies){
      meta.milkPierce = true;
      meta.notes.push("奶穿：守 + 救 同目標 → 仍死亡（沒有平安夜）");
      // death happens
      deaths.push(effectiveWolfTarget);
      meta.wolfDeaths.push(effectiveWolfTarget); // treated as wolf-death (knife still effective)
    }else{
      // Normal block logic
      if(guarded){
        meta.blockedByGuard = true;
        meta.notes.push("守衛守中：狼刀無效");
      }
      if(saveApplies){
        meta.blockedBySave = true;
        meta.notes.push("女巫用解藥：狼刀無效");
      }

      if(effectiveWolfTarget){
        if(!meta.blockedByGuard && !meta.blockedBySave){
          deaths.push(effectiveWolfTarget);
          meta.wolfDeaths.push(effectiveWolfTarget);
        }
      }
    }

    // -------- Witch poison (independent)
    const poisonTarget = getPlayer(players, night?.witchPoisonTarget ?? null)?.alive
      ? (night?.witchPoisonTarget ?? null)
      : null;
    if(poisonTarget){
      deaths.push(poisonTarget);
      meta.poisonDeaths.push(poisonTarget);
    }

    // -------- Unique
    const finalDeaths = uniq(deaths);

    return { deaths: finalDeaths, meta };
  }

  /* =========================================================
     Announcement builder
     - publicText: what players see
     - hiddenText: god-only, includes causes & notes
  ========================================================= */
  function buildAnnouncement({nightNo, dayNo, players, night, resolved, settings}){
    const rules = Object.assign({
      milkPierce:true
    }, settings||{});

    const deaths = resolved?.deaths || [];
    const publicDeaths = deaths.length ? deaths.map(s=>`${s} 號`).join("、") : "沒有人";

    const publicText =
      `【第 ${nightNo} 夜公告】\n` +
      `天亮了，昨晚死亡的是：${publicDeaths}。\n` +
      `（進入第 ${dayNo} 天流程）`;

    // God hidden details
    const lines = [];
    lines.push(`【上帝視角｜第 ${nightNo} 夜結算】`);
    lines.push(`狼人刀口：${resolved?.meta?.wolfTargetRaw ? resolved.meta.wolfTargetRaw+" 號" : "（空刀/未選）"}`);
    lines.push(`守衛守護：${resolved?.meta?.guardTargetRaw ? resolved.meta.guardTargetRaw+" 號" : "（未守/無效）"}`);

    // Witch info: if saveUsed already in controller, it will reflect; still show decisions
    const saveTxt = night?.witchSave ? "用解藥" : "不用解藥";
    const poisonTxt = night?.witchPoisonTarget ? `毒 ${night.witchPoisonTarget} 號` : "不毒";
    lines.push(`女巫：${saveTxt}｜${poisonTxt}`);

    if(resolved?.meta?.milkPierce && rules.milkPierce){
      lines.push("⚠️ 奶穿：守+救同目標 → 仍死亡（沒有平安夜）");
    }else{
      if(resolved?.meta?.blockedByGuard) lines.push("守衛守中 → 狼刀無效");
      if(resolved?.meta?.blockedBySave) lines.push("女巫救人 → 狼刀無效");
    }

    if(resolved?.meta?.notes?.length){
      lines.push("【備註】");
      resolved.meta.notes.forEach(n=>lines.push("- "+n));
    }

    const hiddenText = lines.join("\n");
    return { publicText, hiddenText };
  }

  /* =========================================================
     Vote tie policy helper
     - You can use this from day/vote module.
     Input:
       tieRound: 0 for first vote, 1 for second tie, ...
       settings.tieSecondNoExile: true => second tie => no exile
     Output: "pk" | "revote" | "none"
  ========================================================= */
  function decideTieOutcome({tieRound, settings}){
    const rules = Object.assign({ tieSecondNoExile:true }, settings||{});
    // First tie: usually PK or revote (UI chooses)
    if(tieRound <= 0) return "choose"; // UI decides
    // Second tie: none
    if(rules.tieSecondNoExile) return "none";
    return "choose";
  }

  /* =========================================================
     Death skill gating (poison restriction)
     Inputs:
       roleId, seat, resolved, settings
     Output:
       boolean allowed
  ========================================================= */
  function canTriggerDeathSkill({roleId, seat, resolved, settings}){
    const rules = Object.assign({
      hunterPoisonNoShoot:true,
      blackWolfKingPoisonNoSkill:true
    }, settings||{});

    const poisoned = isPoisonDeath(resolved, seat);

    if(roleId==="hunter" && rules.hunterPoisonNoShoot && poisoned){
      return false;
    }
    if(roleId==="blackWolfKing" && rules.blackWolfKingPoisonNoSkill && poisoned){
      return false;
    }
    return true;
  }

  /* =========================================================
     Win check framework
     - Base rule (classic):
       * if wolves == 0 => villagers win
       * if wolves >= others => wolves win
     - Third party hook:
       Provide W.thirdWinCheck(players, settings) => {ended,winner,message} | null
       If returns ended, it takes priority.
  ========================================================= */
  function checkWin({players, settings}){
    // third-party hook (Cupid/lovers/crush etc) — you will extend later
    if(typeof W.thirdWinCheck === "function"){
      const r = W.thirdWinCheck(players, settings);
      if(r && r.ended) return r;
    }

    const wolves = aliveByTeam(players, "wolf").length;
    const good = alive(players).length - wolves;

    if(wolves <= 0){
      return {
        ended:true,
        winner:"villager",
        message:"🏁 遊戲結束：正義聯盟獲勝！\n（所有邪惡陣營已被放逐）"
      };
    }
    if(wolves >= good){
      return {
        ended:true,
        winner:"wolf",
        message:"🏁 遊戲結束：邪惡陣營獲勝！\n（狼人數量已達到或超過其餘存活玩家）"
      };
    }
    return { ended:false };
  }

  /* =========================
     Export public-safe state helper
  ========================= */
  function exportPublic(state){
    const s = JSON.parse(JSON.stringify(state||{}));
    // remove roleId/team
    if(Array.isArray(s.players)){
      s.players = s.players.map(p=>({
        seat:p.seat,
        alive:p.alive,
        isChief:!!p.isChief
      }));
    }
    // remove hidden actions
    if(Array.isArray(s.logs)){
      s.logs = s.logs.map(l=>({
        ts:l.ts, nightNo:l.nightNo, dayNo:l.dayNo,
        publicText:l.publicText
      }));
    }
    // remove night internals
    delete s.night;
    return s;
  }

  /* =========================
     Expose
  ========================= */
  W.rulesCore = {
    resolveNight,
    buildAnnouncement,
    decideTieOutcome,
    canTriggerDeathSkill,
    checkWin,
    exportPublic
  };

})();