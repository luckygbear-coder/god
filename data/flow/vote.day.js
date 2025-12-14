/* =========================================================
   狼人殺｜白天投票流程
   檔案：/data/flow/vote.day.js

   功能：
   - createVoteSession(players)
   - castVote(seatFrom, seatTo | null)
   - getVoteStats()
   - getResult()
   - exportVotes()

   全域掛載：window.WW_DATA.voteDay
========================================================= */

(() => {
  const root = (window.WW_DATA = window.WW_DATA || {});

  function aliveSeats(players){
    return players.filter(p => p.alive).map(p => p.seat);
  }

  /* ---------------------------------------------------------
     建立投票場次
  --------------------------------------------------------- */
  function createVoteSession(players){
    return {
      voters: aliveSeats(players),     // 需要投票的人
      cursor: 0,                       // 目前輪到第幾位
      votes: [],                       // [{ fromSeat, toSeat|null }]
      done: false
    };
  }

  /* ---------------------------------------------------------
     取得目前輪到誰投票
  --------------------------------------------------------- */
  function currentVoter(session){
    if(session.done) return null;
    return session.voters[session.cursor] ?? null;
  }

  /* ---------------------------------------------------------
     投票（seatTo = null 代表棄票）
  --------------------------------------------------------- */
  function castVote(session, seatFrom, seatTo){
    if(session.done) return false;

    const expected = currentVoter(session);
    if(expected !== seatFrom) return false;

    session.votes.push({
      fromSeat: seatFrom,
      toSeat: seatTo ?? null
    });

    session.cursor += 1;
    if(session.cursor >= session.voters.length){
      session.done = true;
    }
    return true;
  }

  /* ---------------------------------------------------------
     即時票數統計
  --------------------------------------------------------- */
  function getVoteStats(session){
    const stats = {};
    session.votes.forEach(v => {
      const key = v.toSeat === null ? "abstain" : String(v.toSeat);
      stats[key] = (stats[key] || 0) + 1;
    });
    return stats;
  }

  /* ---------------------------------------------------------
     計算投票結果
     回傳：
     {
       executed: [seat...] | [],
       tie: true/false,
       maxVotes: number,
       stats
     }
  --------------------------------------------------------- */
  function getResult(session){
    const stats = getVoteStats(session);
    let max = 0;
    let targets = [];

    Object.entries(stats).forEach(([k, v]) => {
      if(k === "abstain") return;
      if(v > max){
        max = v;
        targets = [Number(k)];
      }else if(v === max){
        targets.push(Number(k));
      }
    });

    return {
      executed: targets.length === 1 ? targets : [],
      tie: targets.length > 1,
      maxVotes: max,
      stats
    };
  }

  /* ---------------------------------------------------------
     匯出票型（寫入公告 / 歷史用）
  --------------------------------------------------------- */
  function exportVotes(session){
    return session.votes.map(v => ({
      fromSeat: v.fromSeat,
      toSeat: v.toSeat
    }));
  }

  root.voteDay = {
    createVoteSession,
    currentVoter,
    castVote,
    getVoteStats,
    getResult,
    exportVotes
  };
})();
