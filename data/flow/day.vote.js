/* =========================================================
   WW_DATA Day Vote Engine (MVP)
   - 逐位投票：依存活座位順序
   - 棄票：toSeat = null
   - 統計：回傳最高票、是否平票、平票名單
   - 規則：第二次平票 => 無人放逐（直接進夜晚）
========================================================= */

(function(){
  window.WW_DATA = window.WW_DATA || {};
  const W = window.WW_DATA;

  function aliveSeats(players){
    return players.filter(p=>p.alive).map(p=>p.seat).sort((a,b)=>a-b);
  }

  function createVoteSession(players, opts={}){
    const alive = aliveSeats(players);
    return {
      kind: "dayVote",
      createdAt: new Date().toISOString(),

      // 投票者順序
      voters: alive.slice(),
      voterIndex: 0,

      // 限制可投目標（PK）：null=全體存活；array=指定名單
      restrictTargets: Array.isArray(opts.restrictTargets) ? opts.restrictTargets.slice() : null,

      // fromSeat -> toSeat(null=棄票)
      votes: {},

      done: false,

      // ✅ 平票計數：同一天內平票第幾次（用來第二次平票判定無人放逐）
      tieCount: Number(opts.tieCount || 0)
    };
  }

  function currentVoter(session){
    if(!session || session.done) return null;
    return session.voters[session.voterIndex] ?? null;
  }

  function allowedTargets(session, players){
    const alive = aliveSeats(players);
    if(Array.isArray(session.restrictTargets)){
      return session.restrictTargets.filter(s => alive.includes(s));
    }
    return alive;
  }

  function castVote(session, players, fromSeat, toSeatOrNull){
    if(!session || session.done) return false;
    const cur = currentVoter(session);
    if(cur !== fromSeat) return false;

    // 不能投自己（桌規你若要可投自己可改）
    if(toSeatOrNull && toSeatOrNull === fromSeat) return false;

    // 只能投存活者 or 棄票
    if(toSeatOrNull){
      const targets = allowedTargets(session, players);
      if(!targets.includes(toSeatOrNull)) return false;
    }

    session.votes[String(fromSeat)] = (toSeatOrNull ? Number(toSeatOrNull) : null);

    // 移動到下一位
    session.voterIndex++;
    if(session.voterIndex >= session.voters.length){
      session.done = true;
    }
    return true;
  }

  function exportVotes(session){
    const out = [];
    Object.keys(session.votes).map(Number).sort((a,b)=>a-b).forEach(from=>{
      out.push({ fromSeat: from, toSeat: session.votes[String(from)] });
    });
    return out;
  }

  function getVoteStats(session){
    // stats: { "3":2, "5":1, "abstain":3 }
    const stats = {};
    Object.values(session.votes).forEach(to=>{
      if(to === null || to === undefined){
        stats.abstain = (stats.abstain || 0) + 1;
      }else{
        const k = String(to);
        stats[k] = (stats[k] || 0) + 1;
      }
    });
    return stats;
  }

  function getResult(session){
    const stats = getVoteStats(session);

    // 找最高票（不含棄票）
    const entries = Object.entries(stats).filter(([k]) => k !== "abstain");
    if(entries.length === 0){
      return {
        stats,
        maxVotes: 0,
        tie: false,
        candidates: [],
        executed: null,
        finalOutcome: "no_execute" // 全棄票
      };
    }

    let maxVotes = 0;
    entries.forEach(([_,v]) => { if(v > maxVotes) maxVotes = v; });

    const candidates = entries
      .filter(([_,v]) => v === maxVotes)
      .map(([k]) => Number(k))
      .sort((a,b)=>a-b);

    const tie = candidates.length >= 2;

    if(tie){
      // ✅ 平票：回傳 candidates，並由上層 UI 決定怎麼處理
      // 若已經是第二次平票（tieCount >= 1）=> 直接判定無人放逐
      if(session.tieCount >= 1){
        return {
          stats,
          maxVotes,
          tie: true,
          candidates,
          executed: null,
          finalOutcome: "no_execute_tie_second"
        };
      }
      return {
        stats,
        maxVotes,
        tie: true,
        candidates,
        executed: null,
        finalOutcome: "need_tie_decision"
      };
    }

    // 不平票：唯一最高票者出局
    return {
      stats,
      maxVotes,
      tie: false,
      candidates,
      executed: candidates[0],
      finalOutcome: "execute"
    };
  }

  W.voteDay = {
    createVoteSession,
    currentVoter,
    allowedTargets,
    castVote,
    exportVotes,
    getVoteStats,
    getResult
  };

})();