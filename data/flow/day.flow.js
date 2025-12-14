/* =========================================================
   狼人殺｜白天流程引擎（資料驅動）
   檔案：data/flow/day.flow.js

   功能：
   ✅ 上警名單（多選）
   ✅ 發言順序（順/逆/隨機 + 起始位）
   ✅ 投票（逐位投票）
   ✅ 平票處理：第二次仍平票 => 無人放逐，直接進夜晚（你指定）
   ✅ 可輸出：票型誰投誰（供公告中心復盤）

   注意：
   - 不處理 UI
   - 不處理死亡技能（獵人/黑狼王等）— 由 app 層在「死亡發生時」去觸發
========================================================= */

(function () {

  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const aliveSeats = (players) => players.filter(p => p.alive).map(p => p.seat);

  /* =========================================================
     1) 上警 Session
  ========================================================= */
  function createPoliceSession(players) {
    return {
      alive: aliveSeats(players),
      candidates: [],   // 上警座位
      // 可擴充：退水、警徽流
      createdAt: Date.now()
    };
  }

  function togglePoliceCandidate(session, seat) {
    if (!session.alive.includes(seat)) return;
    const idx = session.candidates.indexOf(seat);
    if (idx >= 0) session.candidates.splice(idx, 1);
    else session.candidates.push(seat);
  }

  /* =========================================================
     2) 發言 Session
  ========================================================= */
  function createSpeechSession(players, policeSession) {
    const alive = aliveSeats(players);
    const pool = (policeSession?.candidates?.length)
      ? policeSession.candidates.filter(s => alive.includes(s))
      : alive;

    return {
      alive,
      pool,
      direction: "cw",   // cw | ccw | rand
      startSeat: pool[0] || null,
      order: [],
      index: 0,
      done: false
    };
  }

  function setSpeechDirection(session, dir) {
    if (!["cw", "ccw", "rand"].includes(dir)) return;
    session.direction = dir;
  }

  function buildSpeechOrder(session) {
    const pool = session.pool.slice();
    if (!pool.length) {
      session.order = [];
      session.index = 0;
      session.done = true;
      return;
    }

    // 若隨機：直接洗牌
    if (session.direction === "rand") {
      session.order = shuffle(pool);
      session.index = 0;
      session.done = false;
      return;
    }

    // 順/逆：依座位號排序，並以 startSeat 開頭
    const sorted = pool.slice().sort((a, b) => a - b);
    const start = session.startSeat ?? sorted[0];

    const startIdx = sorted.indexOf(start);
    const rotated =
      startIdx >= 0
        ? sorted.slice(startIdx).concat(sorted.slice(0, startIdx))
        : sorted;

    session.order = (session.direction === "cw") ? rotated : rotated.slice().reverse();
    session.index = 0;
    session.done = false;
  }

  function currentSpeaker(session) {
    if (session.done) return null;
    return session.order[session.index] ?? null;
  }

  function nextSpeaker(session) {
    if (session.done) return;
    session.index++;
    if (session.index >= session.order.length) {
      session.done = true;
    }
  }

  /* =========================================================
     3) 投票 Session（逐位投票）
  ========================================================= */
  function createVoteSession(players, opts = {}) {
    const alive = aliveSeats(players);
    const restrict = Array.isArray(opts.restrictTargets)
      ? opts.restrictTargets.filter(s => alive.includes(s))
      : null;

    return {
      alive,
      // 每位投票者依 seat 由小到大輪
      voters: alive.slice().sort((a, b) => a - b),
      voterIndex: 0,
      // 可投目標：alive 或 restrictTargets
      targets: restrict || alive.slice(),
      // votes: [{fromSeat, toSeat|null}]
      votes: [],
      done: false,
      // 平票重投次數（0=第一次，1=第二次）
      round: opts.round ?? 0,
      label: opts.label ?? "投票"
    };
  }

  function currentVoter(session) {
    if (session.done) return null;
    return session.voters[session.voterIndex] ?? null;
  }

  function castVote(session, fromSeat, toSeatOrNull) {
    if (session.done) return false;
    const cur = currentVoter(session);
    if (cur !== fromSeat) return false;

    // 自己不能投自己（常見規則）
    if (toSeatOrNull && toSeatOrNull === fromSeat) return false;

    // 目標限制（PK 只能投平票名單）
    if (toSeatOrNull && !session.targets.includes(toSeatOrNull)) return false;

    session.votes.push({ fromSeat, toSeat: toSeatOrNull || null });

    session.voterIndex++;
    if (session.voterIndex >= session.voters.length) {
      session.done = true;
    }
    return true;
  }

  function getVoteStats(session) {
    const stats = {};
    session.votes.forEach(v => {
      const k = v.toSeat ? String(v.toSeat) : "abstain";
      stats[k] = (stats[k] || 0) + 1;
    });
    return stats;
  }

  function getVoteResult(session) {
    const stats = getVoteStats(session);

    // 找最高票
    let maxVotes = 0;
    Object.values(stats).forEach(v => { if (v > maxVotes) maxVotes = v; });

    // 找最高票候選（不含棄票）
    const top = Object.keys(stats)
      .filter(k => k !== "abstain" && stats[k] === maxVotes)
      .map(k => Number(k));

    const tie = top.length >= 2;

    return {
      label: session.label,
      round: session.round,
      maxVotes,
      tie,
      topSeats: top,        // 平票名單 or 唯一出局名單
      stats
    };
  }

  function exportVotes(session) {
    return session.votes.slice();
  }

  /* =========================================================
     4) 平票處理規則（你指定）
     - 第一次平票：可以 PK（只投平票名單）或 全體重投
     - 第二次仍平票：無人放逐（直接進夜晚）
     本檔提供「判斷」與「建立下一輪投票 session」工具
  ========================================================= */
  function shouldAutoNoExecuteOnTie(voteResult) {
    // 第二輪仍平票 => 自動無人放逐
    return voteResult.tie && voteResult.round >= 1;
  }

  function createPkVote(players, tieList) {
    return createVoteSession(players, {
      restrictTargets: tieList,
      round: 1,
      label: "PK投票"
    });
  }

  function createRevote(players) {
    return createVoteSession(players, {
      restrictTargets: null,
      round: 1,
      label: "重新投票"
    });
  }

  /* =========================================================
     對外輸出
  ========================================================= */
  window.WW_DAY_FLOW = {
    // police
    createPoliceSession,
    togglePoliceCandidate,

    // speech
    createSpeechSession,
    setSpeechDirection,
    buildSpeechOrder,
    currentSpeaker,
    nextSpeaker,

    // vote
    createVoteSession,
    currentVoter,
    castVote,
    getVoteStats,
    getVoteResult,
    exportVotes,

    // tie
    shouldAutoNoExecuteOnTie,
    createPkVote,
    createRevote
  };

})();
