/* =========================================================
   狼人殺｜上帝輔助 PWA
   檔案：/app/day.js

   ✅ 白天流程控制（狀態機）
   dayPhase:
     - "free"      : 自由工具階段（上警/發言/投票按鈕可用）
     - "voting"    : 投票進行中（投票彈窗開著）
     - "tie"       : 平票等待決策（PK/重投/無人）
     - "executed"  : 已處刑（可能進技能）
     - "end"       : 遊戲結束

   依賴：
   - WW_DATA.voteDay（第9檔）
   - WW_DATA.policeSpeech（第10檔）
   - WW_DATA.rulesCore（第8檔）
========================================================= */

(function () {
  window.WW = window.WW || {};
  window.WW_DATA = window.WW_DATA || {};

  const voteDay = window.WW_DATA.voteDay;
  const policeSpeech = window.WW_DATA.policeSpeech;
  const rulesCore = window.WW_DATA.rulesCore;

  const $ = (id) => document.getElementById(id);

  function alivePlayers(state){
    return state.players.filter(p=>p.alive);
  }

  function pushLogAppend(state, { publicAppend="", hiddenAppend="", votes=null, actions=null }){
    const log = state.logs?.[0];
    if(!log) return;
    if(publicAppend) log.publicText = (log.publicText||"").trim() + "\n" + publicAppend;
    if(hiddenAppend) log.hiddenText = (log.hiddenText||"").trim() + "\n" + hiddenAppend;
    if(votes) log.votes = votes;
    if(actions) log.actions = Object.assign({}, log.actions||{}, actions);
    window.WW.state.save(state);
  }

  function makeDayIfMissing(state){
    state.day = state.day || {};
    if(!state.day.dayPhase) state.day.dayPhase = "free";
    if(!state.tieRound && state.tieRound !== 0) state.tieRound = 0;
  }

  /* =========================================================
     勝負判定（先基礎，第三方留 hook）
  ========================================================= */
  function checkWin(state){
    const alive = alivePlayers(state);
    const wolves = alive.filter(p=>p.team==="wolf").length;
    const good = alive.filter(p=>p.team!=="wolf").length;

    // 基本規則：狼=0 => 好人勝；狼>=好人 => 狼勝
    if(wolves === 0){
      return { ended:true, winner:"good", reason:"所有狼人都出局" };
    }
    if(wolves >= good){
      return { ended:true, winner:"wolf", reason:"狼人陣營達到平票或超過好人" };
    }

    // TODO: 第三方（邱比特/暗戀者/石像鬼等）在 app.js 統一判斷
    return { ended:false };
  }

  function endGame(state, win){
    makeDayIfMissing(state);
    state.day.dayPhase = "end";
    state.phase = "day";

    const msg = win.winner==="wolf"
      ? `🎉【遊戲結束】邪惡陣營獲勝！\n原因：${win.reason}`
      : `🎉【遊戲結束】正義聯盟獲勝！\n原因：${win.reason}`;

    // 公告寫入當天 log
    pushLogAppend(state, {
      publicAppend: msg,
      hiddenAppend: `（結局）winner=${win.winner}｜${win.reason}`
    });

    window.WW.state.save(state);
    return win;
  }

  /* =========================================================
     白天初始化（每次進入白天呼叫）
  ========================================================= */
  function initDay(state){
    makeDayIfMissing(state);

    // 白天開始：重置平票 round
    state.tieRound = 0;

    // 建立上警 session（工具）
    if(policeSpeech){
      state.policeSession = policeSpeech.createPoliceSession(state.players);
    }else{
      state.policeSession = null;
    }

    // 投票 session 尚未開始
    state.voteSession = null;

    state.day.dayPhase = "free";
    window.WW.state.save(state);

    // 檢查勝負（夜晚後可能已結束）
    const win = checkWin(state);
    if(win.ended){
      endGame(state, win);
      return win;
    }
    return null;
  }

  /* =========================================================
     投票開始
     options:
       - mode: "normal" | "pk"
       - restrictTargets: number[] | null
       - label
  ========================================================= */
  function startVote(state, options={}){
    makeDayIfMissing(state);
    if(!voteDay){
      alert("缺少 /data/flow/vote.day.js");
      return null;
    }
    if(state.day.dayPhase==="end") return null;

    const opts = {
      restrictTargets: options.restrictTargets || null,
      label: options.label || (options.mode==="pk" ? "PK 投票" : "投票"),
      allowAbstain: true,
      skipCannotVote: true
    };

    state.voteSession = voteDay.createVoteSession(state.players, opts);
    state.day.dayPhase = "voting";

    // 保存模式（給 UI 讀）
    state.day.voteMode = options.mode || "normal";
    state.day.voteRestrictTargets = opts.restrictTargets;

    window.WW.state.save(state);
    return state.voteSession;
  }

  /* =========================================================
     投票結算（由 app.js 在「完成投票」按下後呼叫）
  ========================================================= */
  function finalizeVote(state){
    makeDayIfMissing(state);
    if(!state.voteSession || !voteDay) return { ok:false, reason:"no-session" };

    const result = voteDay.getResult(state.voteSession);
    const votes = voteDay.exportVotes(state.voteSession);

    pushLogAppend(state, {
      hiddenAppend: `【投票完成】mode=${state.day.voteMode}｜maxVotes=${result.maxVotes}｜tie=${result.tie}`,
      votes
    });

    // 沒人被投（全棄票或 0）
    if(!result.candidates.length && !result.executed.length){
      pushLogAppend(state, { publicAppend: "【投票結果】無人被放逐。" });
      state.day.dayPhase = "executed";
      window.WW.state.save(state);
      return { ok:true, type:"none" };
    }

    // 平票
    if(result.tie){
      state.tieRound = (state.tieRound||0) + 1;

      pushLogAppend(state, {
        publicAppend: `【投票結果】平票（最高票 ${result.maxVotes} 票）：${result.candidates.join("、")} 號。`,
        hiddenAppend: `（平票）round=${state.tieRound}｜candidates=${result.candidates.join(",")}`
      });

      // 第二次平票：直接無人放逐進夜晚（你要求）
      if(state.tieRound >= 2 && state.settings?.rules?.tieSecondNoLynch){
        pushLogAppend(state, {
          publicAppend: "【平票處理】第二次平票 → 無人放逐，進入夜晚。",
          hiddenAppend: "（平票處理）round2 => none"
        });
        state.day.dayPhase = "executed";
        window.WW.state.save(state);
        return { ok:true, type:"tie2_none" };
      }

      // 第一次平票：交給 UI 選 pk / revote / none
      state.day.dayPhase = "tie";
      state.day.tieCandidates = result.candidates.slice();
      state.day.tieMaxVotes = result.maxVotes;
      window.WW.state.save(state);
      return { ok:true, type:"tie1", candidates: result.candidates.slice(), maxVotes: result.maxVotes };
    }

    // 不平票：處刑
    const executed = result.executed[0];
    if(!executed){
      state.day.dayPhase = "executed";
      window.WW.state.save(state);
      return { ok:true, type:"none" };
    }

    const out = applyLynch(state, executed, { reason:"vote" });
    state.day.dayPhase = "executed";
    window.WW.state.save(state);
    return { ok:true, type:"executed", seat: executed, outcome: out };
  }

  /* =========================================================
     平票決策（UI 選擇後呼叫）
     type: "pk" | "revote" | "none"
  ========================================================= */
  function decideTie(state, type){
    makeDayIfMissing(state);
    const list = (state.day.tieCandidates || []).slice();
    if(!list.length) return { ok:false, reason:"no-candidates" };

    // round=1
    const decision = voteDay.resolveTieDecision({ round: state.tieRound||1, type, candidates: list });

    pushLogAppend(state, {
      publicAppend:
        decision.action==="pk" ? "【平票處理】進入 PK 投票（只投平票名單）。"
        : decision.action==="revote" ? "【平票處理】重新投票（全體存活）。"
        : "【平票處理】無人放逐，進入夜晚。",
      hiddenAppend: `（平票決策）action=${decision.action}`
    });

    // 清 tie state
    state.day.tieCandidates = null;
    state.day.tieMaxVotes = null;

    if(decision.action==="none"){
      state.day.dayPhase = "executed";
      window.WW.state.save(state);
      return { ok:true, action:"none" };
    }

    if(decision.action==="revote"){
      // 重投：重建投票 session（全體存活）
      startVote(state, { mode:"normal", restrictTargets:null, label:"重新投票" });
      window.WW.state.save(state);
      return { ok:true, action:"revote" };
    }

    if(decision.action==="pk"){
      // PK：只投名單
      startVote(state, { mode:"pk", restrictTargets: decision.restrictTargets, label:"PK 投票" });
      window.WW.state.save(state);
      return { ok:true, action:"pk", restrictTargets: decision.restrictTargets };
    }

    return { ok:false, reason:"unknown" };
  }

  /* =========================================================
     處刑套用（含白痴翻牌不死 + 失去投票權）
  ========================================================= */
  function applyLynch(state, seat, { reason="vote" } = {}){
    if(!rulesCore){
      alert("缺少 rules.core.js");
      return { ok:false, reason:"no-rules" };
    }

    const res = rulesCore.applyLynch({
      players: state.players,
      seat,
      settings: state.settings?.rules || {}
    });

    if(res.type === "idiot_reveal"){
      // 白痴翻牌不死：投票權關閉（在 rulesCore 已做），公告也補
      pushLogAppend(state, {
        publicAppend: `【放逐】${seat} 號被投出，但他翻牌是「白痴」→ 不出局，之後失去投票權。`,
        hiddenAppend: `（白痴）seat=${seat} reveal=true canVote=false`
      });
      window.WW.state.save(state);
      return res;
    }

    if(res.type === "executed"){
      pushLogAppend(state, {
        publicAppend: `【放逐】${seat} 號出局。`,
        hiddenAppend: `（放逐）seat=${seat} reason=${reason}`
      });

      // 死亡技能入列（由 app.js 彈窗處理）
      const p = state.players.find(x=>x.seat===seat);
      if(p && (p.roleId==="hunter" || p.roleId==="blackWolfKing")){
        state.skillQueue = state.skillQueue || [];
        state.skillQueue.push({
          roleId: p.roleId,
          seat: seat,
          kind: p.roleId==="hunter" ? "shoot" : "explode",
          trigger: "lynch"
        });
      }

      window.WW.state.save(state);
      return res;
    }

    // 其他：視為無事
    window.WW.state.save(state);
    return res;
  }

  /* =========================================================
     白天結束 → 進下一夜（由 app.js 的 btnDayNext 呼叫）
  ========================================================= */
  function goNextNight(state){
    makeDayIfMissing(state);
    if(state.day.dayPhase==="end"){
      return { ok:false, reason:"ended" };
    }

    // 若仍在 tie 狀態，必須先處理平票
    if(state.day.dayPhase==="tie"){
      return { ok:false, reason:"tie_pending" };
    }
    // 若仍在 voting 狀態，必須先完成投票
    if(state.day.dayPhase==="voting"){
      return { ok:false, reason:"voting_pending" };
    }

    // 先判勝負（白天處刑/技能後可能結束）
    const win = checkWin(state);
    if(win.ended){
      endGame(state, win);
      return { ok:false, reason:"ended_now", win };
    }

    // 推進天數/夜數
    state.dayNo += 1;
    state.nightNo += 1;

    // 轉相位
    state.phase = "night";

    // 由 night.js initNight 重新產生夜晚步驟
    window.WW.state.save(state);
    return { ok:true };
  }

  window.WW.day = {
    initDay,
    startVote,
    finalizeVote,
    decideTie,
    applyLynch,
    goNextNight,
    checkWin,
    endGame
  };
})();
