/* =========================================================
   狼人殺｜規則核心（結算 / 公告 / 勝負）
   data/rules.core.js

   原則：
   - 只做規則與結果，不碰 UI
   - 所有輸入由 app/state 提供：
     players, rules, nightState, role data
========================================================= */

(function () {

  const nowISO = () => new Date().toISOString();

  function getPlayer(players, seat){
    return players.find(p => p.seat === seat) || null;
  }

  function isAlive(players, seat){
    const p = getPlayer(players, seat);
    return !!p && !!p.alive;
  }

  function roleOf(players, seat){
    return getPlayer(players, seat)?.roleId || null;
  }

  function teamOf(players, seat){
    return getPlayer(players, seat)?.team || null;
  }

  function countAliveByTeam(players, team){
    return players.filter(p => p.alive && p.team === team).length;
  }

  function aliveSeats(players){
    return players.filter(p => p.alive).map(p=>p.seat);
  }

  /* =========================================================
     規則檢查：守衛不能連守（回傳 {ok, reason}）
  ========================================================= */
  function validateGuardTarget({ players, night, rules }){
    const target = night.guardTarget;
    if(!target) return { ok:true };

    if(!isAlive(players, target)){
      return { ok:false, reason:"守衛目標必須是存活玩家" };
    }

    if(rules?.noConsecutiveGuard && night.prevGuardTarget && target === night.prevGuardTarget){
      return { ok:false, reason:"規則：守衛不能連守同一人" };
    }

    return { ok:true };
  }

  /* =========================================================
     規則檢查：狼人空刀允許
  ========================================================= */
  function validateWolfTarget({ players, night, rules }){
    const t = night.wolfTarget;
    if(t == null) {
      if(rules?.wolfCanSkip) return { ok:true };
      return { ok:false, reason:"本局規則不允許空刀，狼人必須選擇目標" };
    }
    if(!isAlive(players, t)) return { ok:false, reason:"狼刀目標必須是存活玩家" };
    return { ok:true };
  }

  /* =========================================================
     規則檢查：女巫不能自救（只針對「解藥救刀口」）
  ========================================================= */
  function isWitchSelfSaveInvalid({ players, night, rules }){
    if(!rules?.witchCannotSelfSave) return false;
    if(!night.witchSave) return false;              // 沒選救
    if(!night.wolfTarget) return false;             // 沒刀口
    const witchSeat = players.find(p=>p.alive && p.roleId==="witch")?.seat;
    if(!witchSeat) return false;
    return night.wolfTarget === witchSeat;
  }

  /* =========================================================
     夜晚結算（MVP）
     - wolfTarget
     - guardTarget
     - witchSave (bool)
     - witchPoisonTarget
     - 奶穿：saveHitsGuardMakesDeath
  ========================================================= */
  function resolveNight({ players, night, rules }){
    const meta = {
      ts: nowISO(),
      wolfTargetRaw: night.wolfTarget ?? null,
      guardTargetRaw: night.guardTarget ?? null,
      witchSaveChosen: !!night.witchSave,
      witchPoisonRaw: night.witchPoisonTarget ?? null,
      poisonKills: [],
      wolfKills: [],
      notes: []
    };

    // 合法性（讓 app.js 可以拿 reason 提示）
    const guardCheck = validateGuardTarget({players, night, rules});
    if(!guardCheck.ok) meta.notes.push(guardCheck.reason);

    const wolfCheck = validateWolfTarget({players, night, rules});
    if(!wolfCheck.ok) meta.notes.push(wolfCheck.reason);

    // 先決定「狼刀是否造成死亡」
    let wolfDeath = null;

    if(night.wolfTarget != null){
      const target = night.wolfTarget;

      // 守到 → 本來狼刀無效
      const guarded = (night.guardTarget != null && target === night.guardTarget);

      // 女巫救（可能無效：自救禁）
      let saved = !!night.witchSave;
      if(saved && isWitchSelfSaveInvalid({players, night, rules})){
        saved = false;
        meta.notes.push("女巫不能自救：解藥無效");
      }

      // 奶穿：救同守則死亡（沒有平安夜）
      if(rules?.saveHitsGuardMakesDeath && guarded && !!night.witchSave){
        wolfDeath = target;               // 直接死亡
        meta.notes.push("奶穿：同守同救 → 仍死亡");
      } else {
        if(guarded){
          wolfDeath = null;
          meta.notes.push("守衛守到：狼刀無效");
        } else if(saved){
          wolfDeath = null;
          meta.notes.push("女巫用解藥：狼刀無效");
        } else {
          wolfDeath = target;
        }
      }
    } else {
      if(rules?.wolfCanSkip) meta.notes.push("狼人空刀");
    }

    // 毒藥死亡
    let poisonDeath = null;
    if(night.witchPoisonTarget != null){
      const pt = night.witchPoisonTarget;
      if(isAlive(players, pt)){
        poisonDeath = pt;
      } else {
        meta.notes.push("毒藥目標已死亡或不存在：忽略");
      }
    }

    // 去重死亡名單
    const deaths = [];
    const deathReasons = {}; // seat -> reason array
    function pushDeath(seat, reason){
      if(seat == null) return;
      if(!isAlive(players, seat)) return;
      if(!deaths.includes(seat)) deaths.push(seat);
      deathReasons[seat] = deathReasons[seat] || [];
      deathReasons[seat].push(reason);
    }

    if(wolfDeath != null) pushDeath(wolfDeath, "wolf");
    if(poisonDeath != null) pushDeath(poisonDeath, "poison");

    // 記錄到 meta
    if(wolfDeath != null) meta.wolfKills.push(wolfDeath);
    if(poisonDeath != null) meta.poisonKills.push(poisonDeath);

    return {
      deaths,            // [seat...]
      deathReasons,      // { seat: ["wolf","poison"] }
      meta
    };
  }

  /* =========================================================
     公告（公開 + 上帝隱藏）
     - kidMode: 童話敘述（由 app.js 傳 rules.kidMode）
  ========================================================= */
  function buildAnnouncement({ nightNo, dayNo, players, night, resolved, rules }) {
    const deaths = resolved.deaths || [];
    const kidMode = !!rules?.kidMode;

    // 公開公告
    let publicText = "";
    if(deaths.length === 0){
      publicText = kidMode
        ? `第${nightNo}夜結束～大家都平安！\n可能原因：守衛守對人、女巫救人，或狼人這晚沒有出手。`
        : `天亮了，昨晚是平安夜（無人死亡）。`;
    } else {
      publicText = kidMode
        ? `第${nightNo}夜結束～有壞情緒被帶走了。\n昨晚死亡的是：${deaths.join("、")} 號。\n請依規則留遺言。`
        : `天亮了，昨晚死亡的是：${deaths.join("、")} 號。請依規則留遺言。`;
    }

    // 上帝隱藏（刀口/守/救/毒/驗）
    const hiddenLines = [];
    hiddenLines.push(`【上帝資訊｜第${nightNo}夜】`);
    hiddenLines.push(`狼刀：${night.wolfTarget ?? "（空刀/未選）"}`);
    hiddenLines.push(`守衛：${night.guardTarget ?? "—"}`);
    if(players.some(p=>p.roleId==="seer")){
      hiddenLines.push(`預言家驗：${night.seerCheckTarget ?? "—"}｜結果：${night.seerResult ?? "—"}`);
    }
    if(players.some(p=>p.roleId==="witch")){
      hiddenLines.push(`女巫救：${night.witchSave ? "✅" : "✖"}（解藥${night.witchSaveUsed ? "已用過" : "可用"}）`);
      hiddenLines.push(`女巫毒：${night.witchPoisonTarget ?? "✖"}（毒藥${night.witchPoisonUsed ? "已用過" : "可用"}）`);
    }
    if(resolved?.meta?.notes?.length){
      hiddenLines.push("");
      hiddenLines.push("【規則備註】");
      resolved.meta.notes.forEach(n => hiddenLines.push(`- ${n}`));
    }

    return {
      publicText,
      hiddenText: hiddenLines.join("\n")
    };
  }

  /* =========================================================
     死亡技能觸發判定
     - hunterPoisonNoShoot
     - blackWolfKingPoisonNoSkill
     （只針對「夜晚死亡且原因含 poison」）
  ========================================================= */
  function canTriggerDeathSkill({ roleId, seat, resolved, rules }){
    const reasons = resolved?.deathReasons?.[seat] || [];
    const diedByPoison = reasons.includes("poison");

    if(roleId === "hunter" && rules?.hunterPoisonNoShoot && diedByPoison){
      return false;
    }
    if(roleId === "blackWolfKing" && rules?.blackWolfKingPoisonNoSkill && diedByPoison){
      return false;
    }
    return true;
  }

  /* =========================================================
     勝負判定（先做主流：狼 vs 好）
     + 第三方框架：目前只回傳狀態，後面再加邱比特/暗戀者等
  ========================================================= */
  function checkWin({ players }) {
    const wolves = countAliveByTeam(players, "wolf");
    const good  = countAliveByTeam(players, "villager");
    const third = countAliveByTeam(players, "third");

    // 先做主流：狼 >= 好 → 狼勝；狼=0 → 好勝
    // 第三方先不直接決定勝負（留 hook）
    if(wolves === 0){
      return { ended:true, winner:"villager", reason:"所有邪惡陣營已出局" };
    }
    if(wolves >= good){
      return { ended:true, winner:"wolf", reason:"邪惡陣營人數已達或超過正義陣營" };
    }

    // 第三方框架：後續在這裡擴充
    if(third > 0){
      return { ended:false, winner:null, reason:"第三方尚未結算（框架已預留）" };
    }

    return { ended:false, winner:null, reason:"遊戲繼續" };
  }

  /* =========================================================
     匯出
  ========================================================= */
  window.WW_RULES = {
    validateGuardTarget,
    validateWolfTarget,
    resolveNight,
    buildAnnouncement,
    canTriggerDeathSkill,
    checkWin
  };

})();
