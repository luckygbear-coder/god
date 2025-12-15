/* =========================================================
   WW_DATA Day Police & Speech Engine
   - 上警名單（多選）
   - 發言順序：順時針 / 逆時針 / 隨機
   - 起始位指定
   - 下一位提示
   - 可重建（PK / 重投後重來）
========================================================= */

(function(){
  window.WW_DATA = window.WW_DATA || {};
  const W = window.WW_DATA;

  function aliveSeats(players){
    return players.filter(p=>p.alive).map(p=>p.seat).sort((a,b)=>a-b);
  }

  /* =========================
     上警 Session
  ========================= */
  function createPoliceSession(players){
    return {
      kind: "police",
      alive: aliveSeats(players),
      candidates: [],   // 上警名單
      createdAt: new Date().toISOString()
    };
  }

  function toggleCandidate(session, seat){
    if(!session) return;
    const i = session.candidates.indexOf(seat);
    if(i >= 0) session.candidates.splice(i,1);
    else session.candidates.push(seat);
    session.candidates.sort((a,b)=>a-b);
  }

  /* =========================
     發言 Session
  ========================= */
  function createSpeechSession(players, policeSession){
    const alive = aliveSeats(players);
    const pool = (policeSession && policeSession.candidates.length)
      ? policeSession.candidates.slice()
      : alive.slice();

    return {
      kind: "speech",
      pool,              // 參與發言的人
      direction: "cw",   // cw | ccw | rand
      startSeat: null,   // 起始位
      order: [],         // 發言順序
      index: 0,
      done: false
    };
  }

  function setDirection(session, dir){
    if(!session) return;
    if(["cw","ccw","rand"].includes(dir)){
      session.direction = dir;
    }
  }

  function buildOrder(session, startSeat){
    if(!session || !session.pool.length) return [];

    let pool = session.pool.slice();

    if(session.direction === "rand"){
      for(let i=pool.length-1;i>0;i--){
        const j = Math.floor(Math.random()*(i+1));
        [pool[i],pool[j]] = [pool[j],pool[i]];
      }
    }else{
      pool.sort((a,b)=>a-b);
      if(session.direction === "ccw"){
        pool.reverse();
      }
    }

    const start = startSeat ?? pool[0];
    const idx = pool.indexOf(start);
    if(idx >= 0){
      session.order = pool.slice(idx).concat(pool.slice(0,idx));
    }else{
      session.order = pool.slice();
    }

    session.startSeat = start;
    session.index = 0;
    session.done = false;
    return session.order;
  }

  function currentSpeaker(session){
    if(!session || session.done) return null;
    return session.order[session.index] ?? null;
  }

  function nextSpeaker(session){
    if(!session || session.done) return null;
    session.index++;
    if(session.index >= session.order.length){
      session.done = true;
      return null;
    }
    return session.order[session.index];
  }

  function exportSession(session){
    if(!session) return null;
    return {
      pool: session.pool.slice(),
      direction: session.direction,
      startSeat: session.startSeat,
      order: session.order.slice(),
      done: session.done
    };
  }

  W.policeSpeech = {
    createPoliceSession,
    toggleCandidate,

    createSpeechSession,
    setDirection,
    buildOrder,
    currentSpeaker,
    nextSpeaker,
    exportSession
  };

})();