/* =========================================================
   狼人殺｜上警與發言順序流程
   檔案：/data/flow/police.speech.js

   功能：
   - createPoliceSession(players)
   - toggleCandidate(session, seat)
   - setDirection(session, "cw"|"ccw"|"rand")
   - buildOrder(session, startSeat)
   - nextSpeaker(session)
   - currentSpeaker(session)
   - exportSession(session)

   全域掛載：window.WW_DATA.policeSpeech
========================================================= */

(() => {
  const root = (window.WW_DATA = window.WW_DATA || {});

  const aliveSeats = (players) => players.filter(p => p.alive).map(p => p.seat);

  function shuffle(arr){
    const a = arr.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---------------------------------------------------------
     建立上警流程 Session
  --------------------------------------------------------- */
  function createPoliceSession(players){
    return {
      alive: aliveSeats(players),
      candidates: [],        // 上警座位（多選）
      direction: "cw",       // cw 順時針 / ccw 逆時針 / rand 隨機
      startSeat: null,       // 從哪一位開始發言（通常警上從某位開始）
      order: [],             // 發言順序（計算後）
      cursor: 0,             // 目前輪到第幾位
      done: false
    };
  }

  /* ---------------------------------------------------------
     勾選/取消上警候選
  --------------------------------------------------------- */
  function toggleCandidate(session, seat){
    if(!session.alive.includes(seat)) return;
    const idx = session.candidates.indexOf(seat);
    if(idx >= 0) session.candidates.splice(idx, 1);
    else session.candidates.push(seat);
  }

  function setDirection(session, dir){
    if(["cw","ccw","rand"].includes(dir)) session.direction = dir;
  }

  /* ---------------------------------------------------------
     依方向產生發言順序
     startSeat：從哪位開始（若未給，預設用 candidates[0] 或 alive[0]）
  --------------------------------------------------------- */
  function buildOrder(session, startSeat = null){
    const pool = session.candidates.length ? session.candidates.slice() : session.alive.slice();
    if(!pool.length){
      session.order = [];
      session.cursor = 0;
      session.done = true;
      return session.order;
    }

    const start = startSeat ?? session.startSeat ?? pool[0];
    session.startSeat = start;

    let order = [];

    if(session.direction === "rand"){
      order = shuffle(pool);
    } else {
      // cw/ccw：按座位號繞一圈
      const sorted = pool.slice().sort((a,b)=>a-b);
      const idx = sorted.indexOf(start);
      const rotated = idx >= 0
        ? sorted.slice(idx).concat(sorted.slice(0, idx))
        : sorted;

      order = (session.direction === "cw") ? rotated : rotated.slice().reverse();
    }

    session.order = order;
    session.cursor = 0;
    session.done = order.length === 0;
    return order;
  }

  function currentSpeaker(session){
    if(session.done) return null;
    return session.order[session.cursor] ?? null;
  }

  function nextSpeaker(session){
    if(session.done) return null;
    session.cursor += 1;
    if(session.cursor >= session.order.length){
      session.done = true;
      return null;
    }
    return currentSpeaker(session);
  }

  function exportSession(session){
    return {
      candidates: session.candidates.slice(),
      direction: session.direction,
      startSeat: session.startSeat,
      order: session.order.slice()
    };
  }

  root.policeSpeech = {
    createPoliceSession,
    toggleCandidate,
    setDirection,
    buildOrder,
    currentSpeaker,
    nextSpeaker,
    exportSession
  };
})();
