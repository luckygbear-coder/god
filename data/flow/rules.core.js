/* =========================================================
   data/flow/rules.core.js
   核心規則（Night Resolve / Announcement / Win Check）
========================================================= */

(function(){
  window.WW_DATA = window.WW_DATA || {};

  const nowISO = () => new Date().toISOString();

  function deepClone(x){ return JSON.parse(JSON.stringify(x)); }
  function uniq(arr){ return Array.from(new Set(arr)); }

  function getPlayer(players, seat){
    return players.find(p=>p.seat===seat) || null;
  }

  function roleIdOf(players, seat){
    return getPlayer(players, seat)?.roleId || null;
  }

  function isAlive(players, seat){
    return !!getPlayer(players, seat)?.alive;
  }

  function teamOf(players, seat){
    return getPlayer(players, seat)?.team || "villager";
  }

  function countAliveByTeam(players, team){
    return players.filter(p=>p.alive && p.team===team).length;
  }

  function countAlivePlayers(players){
    return players.filter(p=>p.alive).length;
  }

  function seatListAlive(players){
    return players.filter(p=>p.alive).map(p=>p.seat);
  }

  /* =========================================================
     Night Resolve
     - guardTarget can be null
     - wolfTarget can be null (空刀)
     - witchSave only applies to wolfTarget (if exists)
     - witchPoisonTarget can be null
========================================================= */
  function resolveNight({players, night, settings}){
    const rules = settings || {};
    const meta = {
      wolfTargetRaw: night.wolfTarget ?? null,
      guardTargetRaw: night.guardTarget ?? null,
      guardBlockedConsecutive: false,
      wolfSkipped: false,
      witchSaveChosen: !!night.witchSave,
      witchPoisonTarget: night.witchPoisonTarget ?? null,
      witchSaveEffective: false,
      guardEffective: false,
      guardHit: false,
      saveHit: false,
      saveBlockedSelf: false,
      healPierce: false, // 奶穿
      poisonDeaths: [],
      wolfDeaths: [],
      finalDeaths: []
    };

    // --- validate targets (dead targets ignored) ---
    const alive = seatListAlive(players);

    let guardTarget = night.guardTarget;
    if(guardTarget && !alive.includes(guardTarget)) guardTarget = null;

    let wolfTarget = (night.wolfTarget === null || night.wolfTarget === undefined) ? null : night.wolfTarget;
    if(wolfTarget && !alive.includes(wolfTarget)) wolfTarget = null;

    let poisonTarget = night.witchPoisonTarget;
    if(poisonTarget && !alive.includes(poisonTarget)) poisonTarget = null;

    // --- wolf can skip kill ---
    if(rules.wolfCanSkipKill && (wolfTarget === null)){
      meta.wolfSkipped = true;
    }

    // --- no consecutive guard ---
    if(rules.noConsecutiveGuard && guardTarget && (night.prevGuardTarget != null) && guardTarget === night.prevGuardTarget){
      meta.guardBlockedConsecutive = true;
      guardTarget = null;
    }

    // --- Guard hit? ---
    if(guardTarget && wolfTarget && guardTarget === wolfTarget){
      meta.guardHit = true;
      meta.guardEffective = true;
    }

    // --- Witch save effective? (cannot self save) ---
    // Only meaningful if wolfTarget exists
    let witchSaveEffective = false;
    if(night.witchSave && wolfTarget){
      const witchSeat = players.find(p=>p.roleId==="witch")?.seat ?? null;
      if(rules.witchCannotSelfSave && witchSeat && wolfTarget === witchSeat){
        meta.saveBlockedSelf = true;
        witchSaveEffective = false;
      }else{
        witchSaveEffective = true;
        meta.saveHit = true;
      }
    }
    meta.witchSaveEffective = witchSaveEffective;

    // --- Main resolve: wolf kill ---
    let wolfDeath = null;

    if(wolfTarget){
      const guarded = meta.guardHit;
      const saved = witchSaveEffective;

      // 奶穿：guard + save 同時 -> 規則設定 guardAndSavePierce
      if(rules.guardAndSavePierce && guarded && saved){
        meta.healPierce = true;
        wolfDeath = wolfTarget; // still dies
      }else if(guarded){
        wolfDeath = null; // guarded, no death
      }else if(saved){
        wolfDeath = null; // saved, no death
      }else{
        wolfDeath = wolfTarget;
      }
    }

    // --- Poison resolve ---
    let poisonDeath = null;
    if(poisonTarget){
      poisonDeath = poisonTarget;
    }

    const deaths = uniq([wolfDeath, poisonDeath].filter(Boolean));
    meta.wolfDeaths = wolfDeath ? [wolfDeath] : [];
    meta.poisonDeaths = poisonDeath ? [poisonDeath] : [];
    meta.finalDeaths = deaths.slice();

    return {
      deaths,
      meta,
      // for seer
      seer: {
        target: night.seerCheckTarget ?? null,
        result: night.seerResult ?? null
      }
    };
  }

  /* =========================================================
     Announcement
     - publicText: 玩家可看
     - hiddenText: 上帝可看（包含細節）
========================================================= */
  function buildAnnouncement({nightNo, dayNo, players, night, resolved, settings}){
    const m = resolved.meta || {};
    const deaths = resolved.deaths || [];

    // public deaths line
    const deathText = deaths.length ? deaths.map(s=>`${s}號`).join("、") : "無人";
    let publicLines = [];
    publicLines.push(`☀️ 第${dayNo}天 天亮了`);
    publicLines.push(`昨晚死亡：${deathText}`);

    // Kids mode 由上層 UI/文案檔處理（這裡只提供原因提示給上層）
    // Hidden lines (god)
    let hidden = [];
    hidden.push(`（上帝）第${nightNo}夜結算`);
    hidden.push(`狼刀：${m.wolfTargetRaw ? (m.wolfTargetRaw+"號") : (settings.wolfCanSkipKill ? "空刀" : "—")}`);
    hidden.push(`守衛：${m.guardTargetRaw ? (m.guardTargetRaw+"號") : "—"}${m.guardBlockedConsecutive ? "（連守無效）":""}`);

    if(m.wolfTargetRaw){
      if(m.guardHit) hidden.push(`守到刀口：是（阻擋=${!m.healPierce})`);
      if(m.witchSaveChosen){
        hidden.push(`女巫救：選擇是${m.saveBlockedSelf ? "（自救無效）":""}${m.witchSaveEffective ? "（有效）":"（無效）"}`);
      }else{
        hidden.push(`女巫救：否`);
      }
      if(m.healPierce) hidden.push(`⚠️ 奶穿：守+救同時，仍死亡`);
    }else{
      if(m.wolfSkipped) hidden.push(`狼人：空刀`);
    }

    hidden.push(`女巫毒：${m.witchPoisonTarget ? (m.witchPoisonTarget+"號") : "否"}`);

    // Also mention seer result (hidden only)
    if(night.seerCheckTarget){
      hidden.push(`預言家驗：${night.seerCheckTarget}號 => ${night.seerResult==="wolf"?"狼人":"好人"}`);
    }

    // Provide a gentle public hint about 平安夜/空刀/奶穿（不洩密）
    if(!deaths.length){
      // 平安夜：可能守到、女巫救、或狼人空刀
      publicLines.push(`（提示）今晚平安：可能有守衛守到人、女巫救人、或狼人空刀。`);
    }else if(deaths.length===1 && m.healPierce){
      publicLines.push(`（提示）昨晚可能發生「奶穿」或其他規則導致仍有人倒下。`);
    }

    return {
      publicText: publicLines.join("\n"),
      hiddenText: hidden.join("\n")
    };
  }

  function makeLogItem({ts, nightNo, dayNo, publicText, hiddenText, votes, actions, resolvedMeta}){
    return {
      ts: ts || nowISO(),
      nightNo, dayNo,
      publicText: publicText || "",
      hiddenText: hiddenText || "",
      votes: votes || null,
      actions: actions || null,
      resolvedMeta: resolvedMeta || null
    };
  }

  /* =========================================================
     Death skill trigger rule
     - hunterPoisonNoShoot
     - blackWolfKingPoisonNoSkill
========================================================= */
  function canTriggerDeathSkill({roleId, seat, resolved, settings}){
    const rules = settings || {};
    const poison = resolved?.meta?.poisonDeaths || [];
    const diedByPoison = poison.includes(seat);

    if(roleId === "hunter" && rules.hunterPoisonNoShoot && diedByPoison) return false;
    if(roleId === "blackWolfKing" && rules.blackWolfKingPoisonNoSkill && diedByPoison) return false;
    return true;
  }

  /* =========================================================
     Win check (framework for third party)
     - base win:
        wolves == 0 => villager win
        wolves >= others => wolf win
     - third party:
        reserved for future expansion
========================================================= */
  function checkWin(players){
    const wolf = countAliveByTeam(players, "wolf");
    const vill = countAliveByTeam(players, "villager");
    const third = countAliveByTeam(players, "third");
    const alive = countAlivePlayers(players);

    // third party placeholder: if only third remains
    if(alive > 0 && third === alive){
      return { ended:true, winner:"third", reason:"場上只剩第三方陣營存活。" };
    }

    if(wolf === 0 && alive > 0){
      return { ended:true, winner:"villager", reason:"所有邪惡陣營已被放逐。" };
    }

    // wolf parity rule: wolf >= non-wolf alive => wolf win
    const nonWolf = alive - wolf;
    if(wolf > 0 && wolf >= nonWolf){
      return { ended:true, winner:"wolf", reason:"邪惡陣營人數已達到或超過其他陣營。" };
    }

    return { ended:false, winner:null, reason:"" };
  }

  window.WW_DATA.rulesCore = {
    resolveNight,
    buildAnnouncement,
    makeLogItem,
    canTriggerDeathSkill,
    checkWin
  };
})();