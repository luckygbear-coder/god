/* =========================================================
   狼人殺｜上帝輔助 PWA
   檔案：/data/flow/vote.day.js

   ✅ 白天投票引擎（穩定版）
   - 逐位投票（請 1 號 → 2 號 → ...）
   - 自動跳過：死亡 / canVote=false（例如白痴翻牌後）
   - 支援限制投票目標（PK 名單）
   - 支援平票處理：
       round=1 => 可選 PK / 重投 / 無人出局（由 UI 決策）
       round=2 => 規則：無人放逐，直接進入夜晚（你要求）

   API
   - createVoteSession(players, opts)
   - currentVoter(session)
   - castVote(session, fromSeat, toSeatOrNull)
   - getVoteStats(session)
   - exportVotes(session)
   - getResult(session)
   - resolveTieDecision({round, type, candidates})
========================================================= */

(function () {
  window.WW_DATA = window.WW_DATA || {};

  function seatToPlayer(players, seat){
    return players.find(p=>p.seat===seat) || null;
  }

  function aliveAndCanVote(players){
    return players
      .filter(p => p.alive && p.canVote !== false)
      .map(p => p.seat);
  }

  function aliveSeats(players){
    return players.filter(p=>p.alive).map(p=>p.seat);
  }

  function uniq(arr){
    return Array.from(new Set((arr||[]).filter(Boolean)));
  }

  function sortNum(arr){
    return (arr||[]).slice().sort((a,b)=>a-b);
  }

  /* =========================================================
     createVoteSession
     opts:
       - restrictTargets: number[] | null   // PK 限制投票目標
       - allowAbstain: boolean (default true)
       - skipCannotVote: boolean (default true)
       - label: string
  ========================================================= */
  function createVoteSession(players, opts = {}){
    const voterList = opts.skipCannotVote === false
      ? players.filter(p=>p.alive).map(p=>p.seat)
      : aliveAndCanVote(players);

    const targets = (() => {
      const alive = aliveSeats(players);
      if (!opts.restrictTargets) return alive;
      return opts.restrictTargets.filter(s => alive.includes(s));
    })();

    return {
      label: opts.label || "投票",
      createdAt: new Date().toISOString(),

      voters: voterList,           // 會投票的人
      targets: targets,            // 可被投的目標（PK 會縮小）
      idx: 0,
      done: voterList.length === 0,

      allowAbstain: opts.allowAbstain !== false,

      // votes: { fromSeat, toSeat|null }
      votes: []
    };
  }

  function currentVoter(session){
    if(!session || session.done) return null;
    return session.voters[session.idx] || null;
  }

  function canVoteTarget(session, fromSeat, toSeatOrNull){
    if(!session) return false;

    if(toSeatOrNull === null){
      return !!session.allowAbstain;
    }

    const toSeat = Number(toSeatOrNull);
    if(!Number.isFinite(toSeat)) return false;

    // 不能投自己
    if(toSeat === fromSeat) return false;

    // 必須在 targets 內
    return session.targets.includes(toSeat);
  }

  function castVote(session, fromSeat, toSeatOrNull){
    if(!session || session.done) return false;

    const cur = currentVoter(session);
    if(cur !== fromSeat) return false;

    if(!canVoteTarget(session, fromSeat, toSeatOrNull)) return false;

    session.votes.push({
      fromSeat,
      toSeat: (toSeatOrNull === null ? null : Number(toSeatOrNull))
    });

    session.idx++;
    if(session.idx >= session.voters.length){
      session.done = true;
    }
    return true;
  }

  function getVoteStats(session){
    const stats = {};
    (session?.votes || []).forEach(v=>{
      const k = (v.toSeat === null) ? "abstain" : String(v.toSeat);
      stats[k] = (stats[k] || 0) + 1;
    });
    return stats;
  }

  function exportVotes(session){
    return (session?.votes || []).slice();
  }

  /* =========================================================
     getResult
     return:
       {
         stats,
         maxVotes,
         tie: boolean,
         candidates: number[], // 最高票名單（不含棄票）
         executed: number[]    // 若不平票：只會有 1 個
       }
  ========================================================= */
  function getResult(session){
    const stats = getVoteStats(session);

    // 找最高票（排除棄票）
    const keys = Object.keys(stats).filter(k=>k!=="abstain");
    let maxVotes = 0;
    keys.forEach(k => { maxVotes = Math.max(maxVotes, stats[k] || 0); });

    if(maxVotes === 0){
      return { stats, maxVotes:0, tie:false, candidates:[], executed:[] };
    }

    const candidates = keys
      .filter(k => (stats[k]||0) === maxVotes)
      .map(k => Number(k));

    const tie = candidates.length > 1;

    return {
      stats,
      maxVotes,
      tie,
      candidates: sortNum(candidates),
      executed: tie ? [] : [candidates[0]]
    };
  }

  /* =========================================================
     resolveTieDecision
     - round=1：由 UI 選擇 pk / revote / none
     - round=2：你要求：無人放逐，進夜晚（不再 PK）
     return:
       { action:"pk"|"revote"|"none", restrictTargets?:number[] }
  ========================================================= */
  function resolveTieDecision({ round, type, candidates }){
    const list = sortNum(uniq(candidates || []));

    if(round >= 2){
      return { action: "none" };
    }

    if(type === "pk"){
      return { action: "pk", restrictTargets: list };
    }
    if(type === "revote"){
      return { action: "revote" };
    }
    return { action: "none" };
  }

  window.WW_DATA.voteDay = {
    createVoteSession,
    currentVoter,
    castVote,
    getVoteStats,
    exportVotes,
    getResult,
    resolveTieDecision
  };
})();