/* =========================================================
   data/rules/rules.core.js
   Werewolf Rules Core (clean API)

   Exposes: WW_DATA.rulesCore

   API:
     - resolveNight({state})
     - buildDaybreakAnnouncement({state, resolved})
     - canTriggerDeathSkill({state, resolved, roleId, seat})
     - voteTiePolicy({state, tieCount})
     - checkWin({state})
     - exportReplay({state, includeSecrets})

   Rule toggles (default true):
     - noConsecutiveGuard
     - wolvesCanSkip
     - witchCannotSelfSave
     - milkPierce
     - hunterPoisonNoShoot
     - blackWolfKingPoisonNoSkill
     - tieSecondNoExile
========================================================= */

(function(){
  const W = window.WW_DATA || (window.WW_DATA = {});
  const ROLES = W.rolesAll || W.roles || {};

  function roleInfo(id){
    return ROLES[id] || { id, name:id, team:"villager", icon:"❔" };
  }
  function teamOf(p){
    return p.team || roleInfo(p.roleId).team || "villager";
  }
  function getPlayer(state, seat){
    return (state.players||[]).find(p=>p.seat===seat) || null;
  }
  function isAlive(state, seat){
    const p=getPlayer(state, seat);
    return !!(p && p.alive);
  }
  function uniq(arr){
    return [...new Set((arr||[]).filter(Boolean))];
  }
  function nowISO(){ return new Date().toISOString(); }

  function defaultRules(){
    return {
      noConsecutiveGuard:true,
      wolvesCanSkip:true,
      witchCannotSelfSave:true,
      milkPierce:true,
      hunterPoisonNoShoot:true,
      blackWolfKingPoisonNoSkill:true,
      tieSecondNoExile:true
    };
  }

  function getRules(state){
    return Object.assign(defaultRules(), state?.settings?.rules || {});
  }

  /* =========================================================
     Night resolve (returns meta for logs & skill gating)
  ========================================================= */
  function resolveNight({state}){
    const rules = getRules(state);

    const night = state.night || {};
    const meta = {
      ts: nowISO(),
      nightNo: state.nightNo,
      dayNo: state.dayNo,

      wolfTargetRaw: night.wolfTarget ?? null,
      guardTargetRaw: night.guardTarget ?? null,

      wolfDeaths: [],
      poisonDeaths: [],

      blockedByGuard:false,
      blockedBySave:false,
      milkPierce:false,

      notes: []
    };

    // sanitize targets (must be alive)
    let wolfTarget = (meta.wolfTargetRaw && isAlive(state, meta.wolfTargetRaw)) ? meta.wolfTargetRaw : null;
    let guardTarget = (meta.guardTargetRaw && isAlive(state, meta.guardTargetRaw)) ? meta.guardTargetRaw : null;

    // no consecutive guard
    if(rules.noConsecutiveGuard && guardTarget && night.prevGuardTarget && guardTarget===night.prevGuardTarget){
      meta.notes.push(`守衛不能連守：本夜守 ${guardTarget} 無效`);
      guardTarget = null;
      meta.guardTargetRaw = null;
    }

    // wolves can skip
    if(!wolfTarget){
      if(rules.wolvesCanSkip) meta.notes.push("狼人空刀 / 無狼刀目標");
      else meta.notes.push("⚠️ 本局不允許空刀，但本夜未選刀口（視為無狼刀）");
    }

    // witch save applies only to wolfTarget
    let saveApplies = false;
    if(night.witchSave && wolfTarget){
      const witchSeat = (state.players||[]).find(p=>p.roleId==="witch")?.seat ?? null;
      if(rules.witchCannotSelfSave && witchSeat && witchSeat===wolfTarget){
        meta.notes.push("女巫不能自救：解藥無效");
        saveApplies = false;
      }else{
        saveApplies = true;
      }
    }

    const guarded = (wolfTarget && guardTarget && wolfTarget===guardTarget);

    const deaths = [];

    // milk pierce: guarded + saved => still die, no peaceful night
    if(rules.milkPierce && guarded && saveApplies){
      meta.milkPierce = true;
      meta.notes.push("奶穿：守+救同目標 → 仍死亡（沒有平安夜）");
      deaths.push(wolfTarget);
      meta.wolfDeaths.push(wolfTarget);
    }else{
      if(guarded){
        meta.blockedByGuard = true;
        meta.notes.push("守衛守中 → 狼刀無效");
      }
      if(saveApplies){
        meta.blockedBySave = true;
        meta.notes.push("女巫用解藥 → 狼刀無效");
      }
      if(wolfTarget && !meta.blockedByGuard && !meta.blockedBySave){
        deaths.push(wolfTarget);
        meta.wolfDeaths.push(wolfTarget);
      }
    }

    // poison independent
    const poisonTarget = (night.witchPoisonTarget && isAlive(state, night.witchPoisonTarget))
      ? night.witchPoisonTarget
      : null;
    if(poisonTarget){
      deaths.push(poisonTarget);
      meta.poisonDeaths.push(poisonTarget);
    }

    return { deaths: uniq(deaths), meta };
  }

  /* =========================================================
     Daybreak announcement builder
  ========================================================= */
  function buildDaybreakAnnouncement({state, resolved}){
    const deaths = resolved?.deaths || [];
    const publicDeaths = deaths.length ? deaths.map(s=>`${s} 號`).join("、") : "沒有人";

    const publicText =
      `【第 ${state.nightNo} 夜公告】\n` +
      `天亮了，昨晚死亡的是：${publicDeaths}。\n` +
      `（進入第 ${state.dayNo} 天流程）`;

    const n = state.night || {};
    const hiddenLines = [];
    hiddenLines.push(`【上帝視角｜第 ${state.nightNo} 夜】`);
    hiddenLines.push(`狼人刀口：${n.wolfTarget ? n.wolfTarget+" 號" : "（空刀/未選）"}`);
    hiddenLines.push(`守衛守護：${n.guardTarget ? n.guardTarget+" 號" : "（未守/無效）"}`);
    hiddenLines.push(`女巫：${n.witchSave ? "用解藥" : "不用解藥"}｜${n.witchPoisonTarget ? ("毒 "+n.witchPoisonTarget+" 號") : "不毒"}`);
    if(resolved?.meta?.milkPierce) hiddenLines.push("⚠️ 奶穿：守+救同目標 → 仍死亡（沒有平安夜）");
    if(resolved?.meta?.notes?.length){
      hiddenLines.push("【備註】");
      resolved.meta.notes.forEach(x=>hiddenLines.push("- "+x));
    }

    return { publicText, hiddenText: hiddenLines.join("\n") };
  }

  /* =========================================================
     Death skill gating
     - Hunter poisoned => no shoot
     - BlackWolfKing poisoned => no skill
  ========================================================= */
  function canTriggerDeathSkill({state, resolved, roleId, seat}){
    const rules = getRules(state);
    const poisoned = !!resolved?.meta?.poisonDeaths?.includes(seat);

    if(roleId==="hunter" && rules.hunterPoisonNoShoot && poisoned) return false;
    if(roleId==="blackWolfKing" && rules.blackWolfKingPoisonNoSkill && poisoned) return false;
    return true;
  }

  /* =========================================================
     Vote tie policy
     tieCount: 1 means first tie, 2 means second tie...
     Required by you: second tie => no exile (direct go night)
  ========================================================= */
  function voteTiePolicy({state, tieCount}){
    const rules = getRules(state);
    if(tieCount >= 2 && rules.tieSecondNoExile){
      return { action:"none", message:"第二次平票：無人放逐，直接進入夜晚。" };
    }
    return { action:"choose", message:"平票：請選擇 PK / 重投 / 無人出局。" };
  }

  /* =========================================================
     Win check (framework)
     - Classic: wolves==0 => good win
                wolves>=others => wolf win
     - Third-party: hook W.thirdWinCheck(state) => {ended,winner,message}
  ========================================================= */
  function checkWin({state}){
    if(typeof W.thirdWinCheck === "function"){
      const r = W.thirdWinCheck(state);
      if(r && r.ended) return r;
    }

    const alivePlayers = (state.players||[]).filter(p=>p.alive);
    const wolves = alivePlayers.filter(p=>teamOf(p)==="wolf").length;
    const others = alivePlayers.length - wolves;

    if(wolves<=0){
      return { ended:true, winner:"villager",
        message:"🏁 遊戲結束：正義聯盟獲勝！\n（所有邪惡陣營已被放逐）"
      };
    }
    if(wolves>=others){
      return { ended:true, winner:"wolf",
        message:"🏁 遊戲結束：邪惡陣營獲勝！\n（狼人數量已達到或超過其餘存活玩家）"
      };
    }
    return { ended:false };
  }

  /* =========================================================
     Replay export
  ========================================================= */
  function exportReplay({state, includeSecrets}){
    const payload = {
      exportedAt: nowISO(),
      includeSecrets: !!includeSecrets,
      version: "rulesCore-v1",
      state: includeSecrets ? state : stripSecrets(state)
    };
    return payload;
  }

  function stripSecrets(state){
    const s = JSON.parse(JSON.stringify(state||{}));
    if(Array.isArray(s.players)){
      s.players = s.players.map(p=>({ seat:p.seat, alive:p.alive, isChief:!!p.isChief }));
    }
    if(Array.isArray(s.logs)){
      s.logs = s.logs.map(l=>({
        ts:l.ts, nightNo:l.nightNo, dayNo:l.dayNo,
        publicText:l.publicText
      }));
    }
    delete s.night;
    return s;
  }

  W.rulesCore = {
    defaultRules,
    getRules,
    resolveNight,
    buildDaybreakAnnouncement,
    canTriggerDeathSkill,
    voteTiePolicy,
    checkWin,
    exportReplay
  };

})();