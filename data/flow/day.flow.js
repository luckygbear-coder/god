/* =========================================================
   狼人殺｜白天流程工具（資料/流程，不含 UI）
   data/flow/day.flow.js

   功能：
   - 上警：多選名單 candidates[]
   - 發言：順/逆/隨機 + 起始位 + 逐位 next
   - 投票：逐位投票 + 統計 + 結果
   - 平票規則：第二次平票 → 無人放逐 → 進夜晚
========================================================= */

(function () {

  function aliveSeats(players){
    return players.filter(p=>p.alive).map(p=>p.seat);
  }

  /* =========================================================
     上警 Session
  ========================================================= */
  function createPoliceSession(players){
    return {
      alive: aliveSeats(players),
      candidates: [],
      direction: "cw",     // cw | ccw | rand
      startSeat: null,
      order: [],
      cursor: 0,
      done: false
    };
  }

  function toggleCandidate(session, seat){
    if(!session.alive.includes(seat)) return;
    const idx = session.candidates.indexOf(seat);
    if(idx >= 0) session.candidates.splice(idx,1);
    else session.candidates.push(seat);
    session.candidates.sort((a,b)=>a-b);
  }

  function setDirection(session, dir){
    if(!["cw","ccw","rand"].includes(dir)) return;
    session.direction = dir;
  }

  function buildOrder(session, startSeat){
    const pool = (session.candidates && session.candidates.length)
      ? session.candidates.slice()
      : session.alive.slice();

    if(!pool.length){
      session.order = [];
      session.cursor = 0;
      session.done = true;
      return session.order;
    }

    let order = [];

    if(session.direction === "rand"){
      order = pool.slice();
      for(let i=order.length-1;i>0;i--){
        const j = Math.floor(Math.random()*(i+1));
        [order[i],order[j]]=[order[j],order[i]];
      }
    } else {
      // 圓桌順序依數字座位
      const sorted = pool.slice().sort((a,b)=>a-b);
      const idx = sorted.indexOf(startSeat);
      const startIdx = idx>=0 ? idx : 0;

      if(session.direction === "cw"){
        order = sorted.slice(startIdx).concat(sorted.slice(0,startIdx));
      } else {
        // 逆時針：從 start 往前
        const left = sorted.slice(0,startIdx).reverse();
        const right = sorted.slice(startIdx).reverse();
        order = right.concat(left);
      }
    }

    session.startSeat = startSeat;
    session.order = order;
    session.cursor = 0;
    session.done = order.length === 0;
    return order;
  }

  function currentSpeaker(session){
    if(!session.order || !session.order.length) return null;
    if(session.cursor >= session.order.length){
      session.done = true;
      return null;
    }
    return session.order[session.cursor];
  }

  function nextSpeaker(session){
    if(session.done) return null;
    session.cursor++;
    if(session.cursor >= (session.order?.length||0)){
      session.done = true;
      return null;
    }
    return session.order[session.cursor];
  }

  function exportPoliceSession(session){
    return {
      alive: session.alive.slice(),
      candidates: session.candidates.slice(),
      direction: session.direction,
      startSeat: session.startSeat,
      order: session.order.slice(),
      cursor: session.cursor,
      done: session.done
    };
  }

  /* =========================================================
     投票 Session（逐位投票）
     - round: 1=第一次投票；2=第二次（平票後重投/PK）
     - restrictTargets: null=所有存活；array=限制目標（PK）
  ========================================================= */
  function createVoteSession(players, opt={}){
    const alive = aliveSeats(players);
    return {
      alive,
      voters: alive.slice(),               // 逐位投票順序（預設按座位）
      cursor: 0,
      done: false,
      votes: [],                           // {fromSeat,toSeat|null}
      stats: {},                           // computed
      round: opt.round || 1,               // 1 or 2
      restrictTargets: opt.restrictTargets || null
    };
  }

  function currentVoter(session){
    if(session.cursor >= session.voters.length){
      session.done = true;
      return null;
    }
    return session.voters[session.cursor];
  }

  function castVote(session, fromSeat, toSeatOrNull){
    const cur = currentVoter(session);
    if(cur == null || cur !== fromSeat) return false;

    // 棄票允許
    if(toSeatOrNull == null){
      session.votes.push({fromSeat, toSeat:null});
      session.cursor++;
      if(session.cursor >= session.voters.length) session.done = true;
      return true;
    }

    // 不能投自己
    if(toSeatOrNull === fromSeat) return false;

    // 目標必須存活
    if(!session.alive.includes(toSeatOrNull)) return false;

    // PK 限制目標
    if(Array.isArray(session.restrictTargets) && session.restrictTargets.length){
      if(!session.restrictTargets.includes(toSeatOrNull)) return false;
    }

    session.votes.push({fromSeat, toSeat:toSeatOrNull});
    session.cursor++;
    if(session.cursor >= session.voters.length) session.done = true;
    return true;
  }

  function computeStats(session){
    const stats = {};
    session.votes.forEach(v=>{
      const k = v.toSeat == null ? "abstain" : String(v.toSeat);
      stats[k] = (stats[k]||0)+1;
    });
    session.stats = stats;
    return stats;
  }

  function getTop(session){
    const stats = computeStats(session);
    const entries = Object.entries(stats);

    let max = 0;
    entries.forEach(([k,c])=>{
      if(k==="abstain") return;
      if(c>max) max=c;
    });

    const tops = entries
      .filter(([k,c])=>k!=="abstain" && c===max)
      .map(([k])=>Number(k));

    return { maxVotes:max, tops, tie: tops.length>=2 };
  }

  function getResult(session){
    const { maxVotes, tops, tie } = getTop(session);

    // 沒有人得到票（全棄票）
    if(maxVotes === 0){
      return { maxVotes:0, tie:false, executed:null, tops:[] };
    }

    if(tie){
      return { maxVotes, tie:true, executed:null, tops };
    }
    return { maxVotes, tie:false, executed: tops[0], tops };
  }

  function exportVotes(session){
    return session.votes.slice();
  }

  /* =========================================================
     平票規則（你指定）
     - 第一次平票：進入第二輪（由 UI 決定是 PK/重投）
     - 第二次平票：無人放逐 → 進夜晚
  ========================================================= */
  function tieRuleDecision({ voteRound, tieTops }){
    if(voteRound >= 2){
      return {
        action: "no_exile",      // ✅ 第二次平票：無人放逐
        message: "第二次平票：無人放逐，直接進入夜晚。"
      };
    }
    return {
      action: "need_choice",     // 交給 UI：PK / 重投
      message: `平票（${tieTops.join("、")}）：請選擇 PK 或 重投。`
    };
  }

  /* =========================================================
     Export
  ========================================================= */
  window.WW_DAY = {
    // police
    createPoliceSession,
    toggleCandidate,
    setDirection,
    buildOrder,
    currentSpeaker,
    nextSpeaker,
    exportPoliceSession,

    // vote
    createVoteSession,
    currentVoter,
    castVote,
    computeStats,
    getResult,
    exportVotes,
    tieRuleDecision
  };

})();