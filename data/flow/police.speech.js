/* =========================================================
   狼人殺｜上帝輔助 PWA
   檔案：/data/flow/police.speech.js

   ✅ 上警 + 發言順序引擎（穩定版）
   - createPoliceSession(players)
   - toggleCandidate(session, seat)
   - setDirection(session, "cw"|"ccw"|"rand")
   - buildOrder(session, startSeat)
   - currentSpeaker(session)
   - nextSpeaker(session)
   - exportSession(session)

   設計：
   - candidates 空 => 全體存活發言
   - candidates 有 => 警上發言（名單內依方向/隨機）
   - startSeat 必須在候選名單中（若不在，會自動修正）
========================================================= */

(function () {
  window.WW_DATA = window.WW_DATA || {};

  function aliveSeats(players){
    return players.filter(p=>p.alive).map(p=>p.seat);
  }

  function uniq(arr){
    return Array.from(new Set((arr||[]).filter(Boolean)));
  }

  function sortNum(arr){
    return (arr||[]).slice().sort((a,b)=>a-b);
  }

  function randShuffle(arr){
    const a = arr.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

  // 以座位號循環產生順時針/逆時針序列（假設座位 1..N）
  function buildCircleOrder({ pool, startSeat, direction, totalSeatsMax }) {
    const set = new Set(pool);
    const N = totalSeatsMax;

    if(direction === "rand"){
      const shuffled = randShuffle(pool);
      // 強制把 startSeat 放第一個（如果存在）
      if(startSeat && set.has(startSeat)){
        const rest = shuffled.filter(s=>s!==startSeat);
        return [startSeat, ...rest];
      }
      return shuffled;
    }

    // cw: 1->2->...->N->1
    // ccw: 1<-2<-...<-N
    const step = (direction === "ccw") ? -1 : 1;

    let cur = startSeat;
    const order = [];
    const guard = N * 3; // 防呆
    let cnt = 0;

    while(order.length < pool.length && cnt < guard){
      if(set.has(cur)) order.push(cur);
      cur = cur + step;
      if(cur > N) cur = 1;
      if(cur < 1) cur = N;
      cnt++;
    }

    // 若因資料異常沒生完，補齊
    const missing = pool.filter(s=>!order.includes(s));
    return order.concat(missing);
  }

  /* =========================================================
     createPoliceSession
  ========================================================= */
  function createPoliceSession(players){
    const alive = aliveSeats(players);
    const maxSeat = players.length ? Math.max(...players.map(p=>p.seat)) : alive.length;

    return {
      createdAt: new Date().toISOString(),
      alive: alive,                 // 存活座位
      maxSeat,

      // 上警名單（多選）
      candidates: [],

      // 發言
      direction: "cw",              // cw | ccw | rand
      startSeat: null,
      order: [],
      cursor: 0,
      done: false,

      // 記錄（可選）
      spoken: [] // 已發言座位
    };
  }

  function toggleCandidate(session, seat){
    if(!session) return;
    const s = Number(seat);
    if(!session.alive.includes(s)) return;

    const set = new Set(session.candidates || []);
    if(set.has(s)) set.delete(s);
    else set.add(s);

    session.candidates = sortNum(Array.from(set));

    // 若 startSeat 不在名單中，清掉
    if(session.startSeat && session.candidates.length && !set.has(session.startSeat)){
      session.startSeat = null;
    }
  }

  function setDirection(session, dir){
    if(!session) return;
    if(!["cw","ccw","rand"].includes(dir)) return;
    session.direction = dir;
  }

  function getSpeechPool(session){
    // 有上警 => 警上發言，否則全體存活
    const cand = session.candidates || [];
    if(cand.length) return cand.filter(s=>session.alive.includes(s));
    return session.alive.slice();
  }

  function buildOrder(session, startSeat){
    if(!session) return;
    session.alive = uniq(session.alive || []);

    const pool = getSpeechPool(session);
    if(!pool.length){
      session.order = [];
      session.cursor = 0;
      session.done = true;
      return;
    }

    // 起始位修正
    let start = Number(startSeat || session.startSeat || pool[0]);
    if(!pool.includes(start)) start = pool[0];

    session.startSeat = start;

    session.order = buildCircleOrder({
      pool,
      startSeat: start,
      direction: session.direction,
      totalSeatsMax: session.maxSeat || Math.max(...session.alive)
    });

    session.cursor = 0;
    session.done = false;
    session.spoken = [];
  }

  function currentSpeaker(session){
    if(!session || session.done) return null;
    if(!session.order?.length) return null;
    return session.order[session.cursor] || null;
  }

  function nextSpeaker(session){
    if(!session || session.done) return null;
    const cur = currentSpeaker(session);
    if(cur) session.spoken.push(cur);

    session.cursor++;
    if(session.cursor >= session.order.length){
      session.done = true;
      return null;
    }
    return currentSpeaker(session);
  }

  function exportSession(session){
    if(!session) return null;
    return {
      createdAt: session.createdAt,
      alive: session.alive,
      candidates: session.candidates,
      direction: session.direction,
      startSeat: session.startSeat,
      order: session.order,
      cursor: session.cursor,
      done: session.done,
      spoken: session.spoken
    };
  }

  window.WW_DATA.policeSpeech = {
    createPoliceSession,
    toggleCandidate,
    setDirection,
    buildOrder,
    currentSpeaker,
    nextSpeaker,
    exportSession
  };
})();