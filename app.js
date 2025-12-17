/* =========================================================
   狼人殺｜上帝輔助 PWA（官方12 MVP 穩定版）
   - 修正 iOS 點擊失效：不在按鈕 touchstart preventDefault
   - 抽身分按住 0.3 秒顯示
   - 夜晚流程讀 WW_DB.nightFlows（alwaysAnnounce 照唸）
   - 守衛死了不能守（仍照唸）
   - 公告可捲動、可關
   - 勝負判定：屠邊（預設）/ 可切屠城
========================================================= */
(() => {
  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);
  const warn = (...a) => console.warn("⚠️ app:", ...a);

  /* ---------------------------
     iOS：禁止雙擊放大 / 手勢縮放（不阻斷 click）
  --------------------------- */
  on(document, "contextmenu", (e) => e.preventDefault(), { passive: false });
  on(document, "gesturestart", (e) => e.preventDefault(), { passive: false });
  // double-tap zoom 防護（不碰 touchstart，避免 click 掛掉）
  let _lastTouchEnd = 0;
  on(document, "touchend", (e) => {
    const now = Date.now();
    if (now - _lastTouchEnd <= 300) e.preventDefault();
    _lastTouchEnd = now;
  }, { passive: false });

  /* ---------------------------
     Storage
  --------------------------- */
  const STORAGE_KEY = "ww_official12_mvp_v1";
  const State = {
    phase: "setup",       // setup | deal | night | day
    boardId: "official12",
    playerCount: 12,

    // 角色數量（可調整）
    rolesCount: null,

    // players: [{seat, roleId, alive}]
    players: [],
    dealIndex: 0,

    // 夜晚
    nightNo: 1,
    dayNo: 1,
    godView: false,

    // 當晚選擇
    nightState: {},
    nightStepIndex: 0,

    // 女巫狀態（永久消耗）
    witch: { saveUsed:false, poisonUsed:false, save:false, poisonTarget:null },

    // 白天
    dayMode: "mark",     // mark | vote
    dayVote: { target:null },

    // 公告
    logs: [],

    // 勝利模式
    winMode: "edge"      // edge | city
  };

  function save(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(State)); }catch(e){} }
  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return;
      const s = JSON.parse(raw);
      if(s && typeof s==="object") Object.assign(State, s);
    }catch(e){}
  }
  function clearSave(){ try{ localStorage.removeItem(STORAGE_KEY); }catch(e){} }

  /* ---------------------------
     DB helpers
  --------------------------- */
  function DB(){ return window.WW_DB || null; }
  function ROLES(){ return DB()?.roles || {}; }
  function getRole(rid){
    return ROLES()[rid] || { id:rid, name:rid, icon:"❔", team:"good" };
  }
  function BOARD(){
    return DB()?.boards?.[State.boardId] || null;
  }
  function NIGHT_FLOW(){
    const b = BOARD();
    const id = b?.nightFlowId;
    const f = DB()?.nightFlows?.[id];
    return Array.isArray(f) ? f : [];
  }

  /* ---------------------------
     UI routing
  --------------------------- */
  function showScreen(name){
    document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
    $(`screen-${name}`)?.classList.add("active");
    State.phase = name;
    save();
  }

  /* ---------------------------
     Toast
  --------------------------- */
  let toastTimer = null;
  function toast(msg){
    const el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> el.classList.add("hidden"), 1400);
  }

  /* =========================================================
     Setup：預設配置（官方12）
  ========================================================= */
  function defaultRolesCount(){
    return {
      werewolf: 4,
      seer: 1,
      witch: 1,
      hunter: 1,
      guard: 1,
      idiot: 1,
      villager: 3  // 4民中的 3，因為上面已放 1 白痴算神；若你要 4民 + 白痴，那就 villager:4
    };
  }

  function rolesTotal(map){
    return Object.values(map||{}).reduce((a,b)=> a + (Number(b)||0), 0);
  }

  function syncSetupUI(){
    $("playerCount") && ($("playerCount").textContent = String(State.playerCount));
    $("playerTotal") && ($("playerTotal").textContent = String(State.playerCount));

    const total = rolesTotal(State.rolesCount);
    $("roleTotal") && ($("roleTotal").textContent = String(total));
    $("roleTotal2") && ($("roleTotal2").textContent = String(total));

    const ok = total === State.playerCount;
    $("warnRoleTotal")?.classList.toggle("hidden", ok);

    const btn = $("btnStart");
    if (btn){
      btn.disabled = !ok;
      btn.textContent = ok ? "開始 → 抽身分" : "⚠️ 角色總數需等於玩家數";
    }

    $("btnWinMode") && ($("btnWinMode").textContent = (State.winMode==="edge" ? "屠邊（預設）" : "屠城"));
    save();
  }

  /* =========================================================
     Role Config modal
  ========================================================= */
  function openRoleConfig(){
    const body = $("roleConfigBody");
    if (!body) return;
    body.innerHTML = "";

    const tip = document.createElement("div");
    tip.className = "hint";
    tip.textContent = "點＋/－調整數量；角色總數需等於 12 才能開始。";
    body.appendChild(tip);

    const ids = Object.keys(ROLES());
    const priority = ["werewolf","villager","seer","witch","hunter","guard","idiot","blackWolfKing","whiteWolfKing","wolfKing"];
    const ordered = Array.from(new Set([...priority, ...ids]));

    ordered.forEach((rid) => {
      const info = getRole(rid);
      const row = document.createElement("div");
      row.className = "role-row";

      const left = document.createElement("div");
      left.className = "role-left";
      left.textContent = `${info.icon ? info.icon+" " : ""}${info.name || rid}`;

      const right = document.createElement("div");
      right.className = "role-right";

      const minus = document.createElement("button");
      minus.type = "button";
      minus.className = "btn ghost tiny";
      minus.textContent = "－";

      const num = document.createElement("div");
      num.className = "role-num";
      num.textContent = String(State.rolesCount?.[rid] ?? 0);

      const plus = document.createElement("button");
      plus.type = "button";
      plus.className = "btn ghost tiny";
      plus.textContent = "＋";

      minus.onclick = () => {
        State.rolesCount[rid] = Math.max(0, (State.rolesCount[rid] || 0) - 1);
        num.textContent = String(State.rolesCount[rid]);
        syncSetupUI();
      };
      plus.onclick = () => {
        State.rolesCount[rid] = (State.rolesCount[rid] || 0) + 1;
        num.textContent = String(State.rolesCount[rid]);
        syncSetupUI();
      };

      right.append(minus, num, plus);
      row.append(left, right);
      body.appendChild(row);
    });

    $("modalRole")?.classList.remove("hidden");
  }
  function closeRoleConfig(){ $("modalRole")?.classList.add("hidden"); }

  /* =========================================================
     Build players + deal
  ========================================================= */
  function shuffle(arr){
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function buildPlayers(){
    const list = [];
    for (const [rid, cnt] of Object.entries(State.rolesCount||{})){
      for (let i=0;i<(Number(cnt)||0);i++) list.push(rid);
    }
    shuffle(list);

    State.players = list.map((rid, idx)=>({
      seat: idx+1,
      roleId: rid,
      alive: true
    }));

    State.dealIndex = 0;
    State.nightNo = 1;
    State.dayNo = 1;
    State.nightState = {};
    State.nightStepIndex = 0;
    State.witch = { saveUsed:false, poisonUsed:false, save:false, poisonTarget:null };
    State.dayMode = "mark";
    State.dayVote = { target:null };
    State.logs = [];
    save();
  }

  let holdTimer = null;
  const HOLD_MS = 300;

  function renderDealSeatGrid(){
    const grid = $("dealSeatGrid");
    if (!grid) return;
    grid.innerHTML = "";
    State.players.forEach((p, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seat" + (idx === State.dealIndex ? " selected" : "");
      b.textContent = String(p.seat);
      b.onclick = () => {
        State.dealIndex = idx;
        save();
        renderDeal();
      };
      grid.appendChild(b);
    });
  }

  function showReveal(){
    const p = State.players[State.dealIndex];
    if (!p) return;
    const r = getRole(p.roleId);
    $("revealRole") && ($("revealRole").textContent = `${r.icon} ${r.name}`);
    $("modalReveal")?.classList.remove("hidden");
    navigator.vibrate?.(40);
  }
  function hideReveal(){ $("modalReveal")?.classList.add("hidden"); }

  function renderDeal(){
    const p = State.players[State.dealIndex];
    if (!p) return;
    $("dealText") && ($("dealText").innerHTML = `請 <b>${p.seat} 號</b> 拿手機`);
    renderDealSeatGrid();

    const btnHold = $("btnHoldReveal");
    if (btnHold){
      btnHold.onpointerdown = (e) => {
        clearTimeout(holdTimer);
        holdTimer = setTimeout(showReveal, HOLD_MS);
      };
      const end = () => {
        clearTimeout(holdTimer);
        hideReveal();
      };
      btnHold.onpointerup = end;
      btnHold.onpointercancel = end;
      btnHold.onpointerleave = end;
    }
  }

  function startNight(){
    State.nightState = {};
    State.nightStepIndex = 0;
    State.witch.save = false;
    State.witch.poisonTarget = null;
    save();
    showScreen("night");
    renderNight();
  }

  /* =========================================================
     Night flow
  ========================================================= */
  function step(){ return NIGHT_FLOW()[State.nightStepIndex] || null; }
  function stepScript(st){
    const god = State.godView;
    return (god ? (st?.scripts?.god || st?.scripts?.public) : (st?.scripts?.public || st?.scripts?.god)) || "（無台詞）";
  }

  function actorAlive(roleKey){
    if (!roleKey || roleKey==="narrator") return true;
    // 這版先用 roleKey 直接找該角色是否還活著
    const p = State.players.find(x => x.roleId === roleKey);
    return p ? !!p.alive : false;
  }

  function renderNightSeats(st){
    const box = $("nightSeats");
    if (!box) return;
    box.innerHTML = "";

    const policy = st?.pickPolicy || { aliveOnly:true };
    const canAct = actorAlive(st?.roleKey);

    const selected =
      st?.type==="PICK" ? (State.nightState[st.pickKey] || null) :
      st?.type==="SEER_CHECK" ? (State.nightState[st.pickKey] || null) :
      st?.type==="WITCH" ? (State.witch.poisonTarget || (State.witch.save ? (State.nightState.wolfTarget||null) : null)) :
      null;

    State.players.forEach(p=>{
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seat";
      b.textContent = String(p.seat);

      if (!p.alive) b.classList.add("dead");

      // locked rules
      let lockedReason = "";
      if (!canAct && st?.type!=="INFO" && st?.type!=="RESOLVE"){
        lockedReason = "此角色已死亡，本回合只需照唸流程";
      } else if (policy.aliveOnly && !p.alive){
        lockedReason = "目標已死亡，不能選";
      }

      if (lockedReason) b.classList.add("locked");
      if (selected === p.seat) b.classList.add("selected");

      b.onclick = () => {
        if (lockedReason){
          navigator.vibrate?.(25);
          toast(lockedReason);
          return;
        }

        // PICK
        if (st.type === "PICK" && st.pickKey){
          const cur = State.nightState[st.pickKey] || null;
          if (st.pickPolicy?.toggleToNull){
            State.nightState[st.pickKey] = (cur === p.seat) ? null : p.seat;
          } else {
            State.nightState[st.pickKey] = p.seat;
          }
          save();
          renderNight();
          return;
        }

        // SEER_CHECK
        if (st.type === "SEER_CHECK" && st.pickKey){
          State.nightState[st.pickKey] = p.seat;
          save();
          renderNight();
          return;
        }

        // WITCH
        if (st.type === "WITCH"){
          const knifeSeat = State.nightState.wolfTarget || null;

          // 如果女巫死了，這裡不會進來（canAct 已擋掉）
          // 點刀口=救（前提解藥未用）
          if (!State.witch.saveUsed && knifeSeat && p.seat === knifeSeat){
            // 不可自救提示（若女巫自己是刀口）
            const witchPlayer = State.players.find(x=>x.roleId==="witch");
            if (witchPlayer && witchPlayer.seat === knifeSeat){
              toast("⚠️ 女巫不可自救");
              navigator.vibrate?.(30);
              return;
            }
            State.witch.save = true;
            save(); renderNight();
            return;
          }

          // 其他人=毒（前提毒藥未用）
          if (!State.witch.poisonUsed){
            State.witch.poisonTarget = p.seat;
            save(); renderNight();
            return;
          }

          toast("毒藥已用過");
          navigator.vibrate?.(25);
          return;
        }
      };

      box.appendChild(b);
    });
  }

  function canNext(st){
    if (!st) return false;

    // INFO/RESOLVE 隨時可下一步
    if (st.type === "INFO" || st.type === "RESOLVE") return true;

    // actor 死亡 → 不要求選擇，直接可下一步
    if (!actorAlive(st.roleKey)) return true;

    if (st.type === "PICK"){
      if (st.pickPolicy?.allowNull) return true;
      return !!State.nightState[st.pickKey];
    }
    if (st.type === "SEER_CHECK"){
      return !!State.nightState[st.pickKey];
    }
    // 女巫可直接下一步=不用技能
    if (st.type === "WITCH") return true;

    return true;
  }

  function renderNight(){
    $("nightTag") && ($("nightTag").textContent = `第 ${State.nightNo} 夜`);

    const st = step();
    if (!st){
      $("nightScript") && ($("nightScript").textContent = "（夜晚流程結束）");
      return;
    }

    const tips = [];

    // 若此角色已死亡：提示
    if (!actorAlive(st.roleKey) && st.type !== "INFO" && st.type !== "RESOLVE"){
      tips.push("（此角色已死亡，本回合只需口述流程，不可操作選人）");
    }

    // 預言家查驗結果（上帝提示）
    if (st.type === "SEER_CHECK" && State.nightState[st.pickKey]){
      const seat = State.nightState[st.pickKey];
      const p = State.players.find(x=>x.seat===seat);
      if (p){
        const r = getRole(p.roleId);
        tips.push(`🔮 查驗 ${seat} 號 → ${r.icon} ${r.name}（${r.team==="wolf"?"狼人陣營":"好人陣營"}）`);
      }
    }

    // 女巫提示
    if (st.type === "WITCH"){
      const knifeSeat = State.nightState.wolfTarget || null;
      const witchPlayer = State.players.find(x=>x.roleId==="witch");
      const witchAlive = !!witchPlayer?.alive;

      if (!witchAlive){
        tips.push("🧪 女巫已死亡：本回合不可用藥（仍照唸）");
      } else {
        // 解藥提示：你補充規則
        // - 女巫被刀：若還有解藥仍顯示刀口，提示不可自救
        // - 若解藥已用：不顯示刀口
        if (State.witch.saveUsed){
          tips.push("🧪 解藥：已用過（不再顯示刀口）");
        } else {
          if (knifeSeat){
            if (witchPlayer && witchPlayer.seat === knifeSeat){
              tips.push(`🧪 解藥：刀口 ${knifeSeat} 號（⚠️ 女巫不可自救；可改用毒藥或下一步=不用）`);
            } else {
              tips.push(`🧪 解藥：刀口 ${knifeSeat} 號（點他=救）`);
            }
          } else {
            tips.push("🧪 解藥：狼人尚未選刀");
          }
        }

        tips.push(`☠️ 毒藥：${State.witch.poisonUsed ? "已用過（毒藥沒了）" : "可用（點其他人=毒）"}`);
        if (State.witch.save && knifeSeat) tips.push(`已選救：${knifeSeat} 號`);
        if (State.witch.poisonTarget) tips.push(`已選毒：${State.witch.poisonTarget} 號`);
      }
    }

    const base = stepScript(st);
    $("nightScript") && ($("nightScript").textContent = tips.length ? (base + "\n\n" + tips.join("\n")) : base);

    renderNightSeats(st);
  }

  function nightPrev(){
    State.nightStepIndex = Math.max(0, State.nightStepIndex - 1);
    save(); renderNight();
  }

  function nightNext(){
    const st = step();
    if (!st) return;

    if (!canNext(st)){
      navigator.vibrate?.([60,40,60]);
      toast("需要先選擇目標");
      return;
    }

    // resolve
    if (st.type === "RESOLVE"){
      resolveNight();
      return;
    }

    State.nightStepIndex = Math.min(NIGHT_FLOW().length - 1, State.nightStepIndex + 1);
    save(); renderNight();
  }

  /* =========================================================
     Resolve night + announce + win
  ========================================================= */
  function resolveNightBuiltIn(){
    const knife = State.nightState.wolfTarget || null;
    const guardTarget = State.nightState.guardTarget || null;

    const killed = new Set();
    if (knife) killed.add(knife);

    // 守衛：若守衛死亡則不能守（已在互動禁止，這裡再保險一次）
    const guardAlive = actorAlive("guard");
    if (guardAlive && knife && guardTarget && knife === guardTarget){
      killed.delete(knife);
    }

    // 女巫救
    if (actorAlive("witch") && State.witch.save && knife && !State.witch.saveUsed){
      killed.delete(knife);
    }

    // 女巫毒
    if (actorAlive("witch") && State.witch.poisonTarget && !State.witch.poisonUsed){
      killed.add(State.witch.poisonTarget);
    }

    // 套用死亡
    const deadSeats = [];
    killed.forEach(seat=>{
      const p = State.players.find(x=>x.seat===seat);
      if (p && p.alive){
        p.alive = false;
        deadSeats.push(seat);
      }
    });

    // 用藥消耗
    if (actorAlive("witch")){
      if (State.witch.save && !State.witch.saveUsed) State.witch.saveUsed = true;
      if (State.witch.poisonTarget && !State.witch.poisonUsed) State.witch.poisonUsed = true;
    }

    return { deadSeats };
  }

  function buildAnnouncement(res){
    const dead = res?.deadSeats || [];
    if (!dead.length) return "天亮了，昨晚是平安夜。";
    return `天亮了，昨晚死亡：${dead.join("、")} 號。`;
  }

  function checkWin(){
    const alive = State.players.filter(p=>p.alive);
    const wolves = alive.filter(p=> getRole(p.roleId).team==="wolf").length;
    const good = alive.length - wolves;

    // 好人勝
    if (wolves <= 0){
      return { ended:true, winner:"good", text:"✅ 好人獲勝（狼人全滅）" };
    }

    // 狼人勝（基本條件：狼數 >= 好人）
    if (wolves >= good){
      return { ended:true, winner:"wolf", text:"🐺 狼人獲勝（狼數 ≥ 好人）" };
    }

    // 屠邊 / 屠城（簡化版：屠邊 = 神全滅 或 民全滅）
    if (State.winMode === "edge"){
      const aliveRoles = alive.map(p=>p.roleId);
      const gods = ["seer","witch","hunter","guard","idiot"];
      const villagers = ["villager"];

      const godAlive = aliveRoles.some(r=>gods.includes(r));
      const villAlive = aliveRoles.some(r=>villagers.includes(r));

      if (!godAlive || !villAlive){
        return { ended:true, winner:"wolf", text:"🐺 狼人獲勝（屠邊達成）" };
      }
    } else {
      // 屠城：好人全滅
      if (good <= 0){
        return { ended:true, winner:"wolf", text:"🐺 狼人獲勝（屠城：好人全滅）" };
      }
    }

    return { ended:false };
  }

  function pushLog(publicText, hiddenText=""){
    State.logs.unshift({
      nightNo: State.nightNo,
      dayNo: State.dayNo,
      publicText,
      hiddenText,
      ts: new Date().toISOString()
    });
    save();
  }

  function resolveNight(){
    const res = resolveNightBuiltIn();
    const ann = buildAnnouncement(res);
    pushLog(ann);

    const win = checkWin();
    if (win.ended){
      // 在今日公告尾巴加上結束
      State.logs[0].publicText += `\n\n${win.text}`;
      save();
      showScreen("day");
      renderDay();
      openAnnouncement(true);
      toast("遊戲結束");
      return;
    }

    showScreen("day");
    renderDay();
    openAnnouncement(true);
  }

  /* =========================================================
     Announcement modal
  ========================================================= */
  let annMode = "today";
  function renderAnnouncement(){
    const box = $("annBox");
    if (!box) return;

    if (!State.logs.length){
      box.textContent = "（尚無公告）";
      return;
    }

    if (annMode === "today"){
      box.textContent = State.logs[0].publicText || "";
      return;
    }

    const lines = [];
    State.logs.forEach((l, idx)=>{
      lines.push(`#${State.logs.length-idx}｜第${l.nightNo}夜 / 第${l.dayNo}天`);
      lines.push(l.publicText || "—");
      lines.push("—");
    });
    box.textContent = lines.join("\n");
  }

  function openAnnouncement(forceToday=false){
    if (forceToday) annMode = "today";
    $("modalAnn")?.classList.remove("hidden");
    $("annToday")?.classList.toggle("active", annMode==="today");
    $("annHistory")?.classList.toggle("active", annMode==="history");
    renderAnnouncement();
  }
  function closeAnnouncement(){ $("modalAnn")?.classList.add("hidden"); }

  function exportJSON(){
    const payload = {
      boardId: State.boardId,
      nightNo: State.nightNo,
      dayNo: State.dayNo,
      players: State.players,
      logs: State.logs,
      nightState: State.nightState,
      witch: State.witch,
      winMode: State.winMode
    };
    const txt = JSON.stringify(payload, null, 2);
    try{
      navigator.clipboard?.writeText(txt);
      toast("已複製 JSON");
    }catch(e){}
    // 也顯示在公告框方便手動複製
    $("annBox") && ($("annBox").textContent = txt);
  }

  function copyAnn(){
    const txt = $("annBox")?.textContent || "";
    if (!txt) return;
    navigator.clipboard?.writeText(txt).then(()=>toast("已複製")).catch(()=>toast("複製失敗"));
  }

  /* =========================================================
     Day
  ========================================================= */
  function renderDay(){
    $("dayTag") && ($("dayTag").textContent = `第 ${State.dayNo} 天`);
    renderDayAlive();
    renderDaySeats();
    $("btnDayMode") && ($("btnDayMode").textContent = (State.dayMode==="mark" ? "切換：投票模式" : "切換：標記模式"));
    $("dayModeHint") && ($("dayModeHint").textContent =
      State.dayMode==="mark" ? "☠️ 標記模式：點座位可切換存活" : "🗳️ 投票模式：點座位選放逐目標（點一下取消）"
    );
  }

  function renderDayAlive(){
    const el = $("dayAlive");
    if (!el) return;
    const alive = State.players.filter(p=>p.alive).map(p=>p.seat);
    el.textContent = alive.length ? `存活：${alive.join("、")} 號` : "（全滅？）";
  }

  function renderDaySeats(){
    const box = $("daySeats");
    if (!box) return;
    box.innerHTML = "";

    State.players.forEach(p=>{
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seat";
      b.textContent = String(p.seat);

      if (!p.alive) b.classList.add("dead");
      if (State.dayMode==="vote" && State.dayVote.target === p.seat) b.classList.add("selected");

      b.onclick = () => {
        if (State.dayMode==="mark"){
          p.alive = !p.alive;
          save();
          renderDay();
          return;
        }
        // vote
        if (!p.alive){
          toast("此玩家已死亡");
          return;
        }
        State.dayVote.target = (State.dayVote.target===p.seat) ? nulla null : p.seat;
        save();
        renderDaySeats();
      };

      box.appendChild(b);
    });
  }

  function toggleDayMode(){
    State.dayMode = State.dayMode==="mark" ? "vote" : "mark";
    if (State.dayMode==="mark") State.dayVote.target = null;
    save();
    renderDay();
  }

  // 結算放逐（簡化：把投票目標直接放逐）
  function exile(){
    if (State.dayMode !== "vote"){
      toast("請先切換到投票模式");
      return;
    }
    const t = State.dayVote.target;
    if (!t){
      toast("尚未選擇放逐目標");
      navigator.vibrate?.(40);
      return;
    }

    const target = State.players.find(p=>p.seat===t);
    if (target && target.alive){
      target.alive = false;
      pushLog(`白天放逐：${t} 號出局。`);
      save();
      renderDay();
      openAnnouncement(true);

      // 獵人被放逐 → 詢問是否開槍（先提示再決定）
      if (target.roleId === "hunter"){
        toast("🏹 獵人出局：可選擇是否開槍（下一版加入）");
        // 這版先提示；下一版再做真正選目標開槍流程
      }

      // 放逐後立即檢查勝負
      const win = checkWin();
      if (win.ended){
        State.logs[0].publicText += `\n\n${win.text}`;
        save();
        openAnnouncement(true);
        toast("遊戲結束");
        return;
      }
    }

    State.dayVote.target = null;
    save();
    renderDaySeats();
  }

  function nextToNight(){
    State.nightNo += 1;
    State.dayNo += 1;

    State.nightState = {};
    State.nightStepIndex = 0;
    State.witch.save = false;
    State.witch.poisonTarget = null;

    State.dayMode = "mark";
    State.dayVote.target = null;

    save();
    showScreen("night");
    renderNight();
  }

  /* =========================================================
     God toggle / restart / win mode
  ========================================================= */
  function setGod(flag){
    State.godView = !!flag;
    $("btnGodToggle") && ($("btnGodToggle").textContent = State.godView ? "🔓" : "🔒");
    save();
    if (State.phase==="night") renderNight();
    renderAnnouncement();
  }
  function toggleGod(){ setGod(!State.godView); }

  function toggleWinMode(){
    State.winMode = (State.winMode==="edge") ? "city" : "edge";
    syncSetupUI();
    toast(State.winMode==="edge" ? "已切換：屠邊" : "已切換：屠城");
  }

  /* =========================================================
     Bind
  ========================================================= */
  function bind(){
    // top
    $("btnAnn") && ($("btnAnn").onclick = () => openAnnouncement(true));
    $("btnAnn2") && ($("btnAnn2").onclick = () => openAnnouncement(true));
    $("btnGodToggle") && ($("btnGodToggle").onclick = toggleGod);
    $("btnRestart") && ($("btnRestart").onclick = () => {
      if (!confirm("確定要重新開始？")) return;
      clearSave();
      location.reload();
    });

    // setup
    $("btnRoles") && ($("btnRoles").onclick = openRoleConfig);
    $("btnRoleClose") && ($("btnRoleClose").onclick = closeRoleConfig);
    $("btnRoleDone") && ($("btnRoleDone").onclick = closeRoleConfig);
    $("modalRoleMask") && ($("modalRoleMask").onclick = closeRoleConfig);
    $("btnStart") && ($("btnStart").onclick = () => {
      if (rolesTotal(State.rolesCount) !== 12){
        toast("角色總數需等於 12");
        return;
      }
      buildPlayers();
      showScreen("deal");
      renderDeal();
    }));
    $("btnWinMode") && ($("btnWinMode").onclick = toggleWinMode);

    // deal
    $("btnBackSetup") && ($("btnBackSetup").onclick = () => { showScreen("setup"); syncSetupUI(); });
    $("btnDealNext") && ($("btnDealNext").onclick = () => {
      State.dealIndex = Math.min(State.players.length-1, State.dealIndex+1);
      save(); renderDeal();
    });
    $("btnDealAllDone") && ($("btnDealAllDone").onclick = () => $("modalDealConfirm")?.classList.remove("hidden"));
    $("btnDealConfirmNo") && ($("btnDealConfirmNo").onclick = () => $("modalDealConfirm")?.classList.add("hidden"));
    $("btnDealConfirmYes") && ($("btnDealConfirmYes").onclick = () => {
      $("modalDealConfirm")?.classList.add("hidden");
      startNight();
    });

    // night
    $("btnNightPrev") && ($("btnNightPrev").onclick = nightPrev);
    $("btnNightNext") && ($("btnNightNext").onclick = nightNext);

    // day
    $("btnDayMode") && ($("btnDayMode").onclick = toggleDayMode);
    $("btnDayExile") && ($("btnDayExile").onclick = exile);
    $("btnDayToNight") && ($("btnDayToNight").onclick = nextToNight);

    // ann
    $("btnAnnClose") && ($("btnAnnClose").onclick = closeAnnouncement);
    $("modalAnnMask") && ($("modalAnnMask").onclick = closeAnnouncement);
    $("annToday") && ($("annToday").onclick = () => { annMode="today"; openAnnouncement(false); });
    $("annHistory") && ($("annHistory").onclick = () => { annMode="history"; openAnnouncement(false); });
    $("btnExportAnn") && ($("btnExportAnn").onclick = exportJSON);
    $("btnCopyAnn") && ($("btnCopyAnn").onclick = copyAnn);
  }

  /* =========================================================
     Init
  ========================================================= */
  function init(){
    load();

    // 初始化預設
    if (!State.rolesCount) State.rolesCount = defaultRolesCount();
    State.playerCount = 12;
    State.boardId = "official12";

    bind();
    setGod(State.godView);
    syncSetupUI();

    // 回到上次畫面
    showScreen(State.phase || "setup");

    if (State.phase === "deal") renderDeal();
    if (State.phase === "night") renderNight();
    if (State.phase === "day") renderDay();
  }

  init();
})();