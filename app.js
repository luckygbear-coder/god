/* =========================================================
   狼人殺｜上帝輔助 PWA（單機穩定可跑版）
   - 修掉 iOS 點擊失效：不再用 touchstart preventDefault
   - 抽身分：按住 0.3 秒顯示
   - 抽完：可按進夜晚（有接 btnDealEnterNight）
   - 夜晚：守衛死後不能守；女巫不跳窗；預言家查驗顯示在提示
   - 白天：標記 / 投票；投票結算 → 公告；若放逐獵人 → 詢問是否開槍
   - 勝負：屠邊（預設）/ 可切屠城（這版先固定屠邊，之後你要我再把開關加回）
   - 遊戲結束：跳 end 畫面
========================================================= */
(() => {
  const $ = (id) => document.getElementById(id);
  const warn = (...a) => console.warn("⚠️ app:", ...a);

  // iOS：阻止 pinch 手勢（不阻止點擊）
  document.addEventListener("gesturestart", (e)=> e.preventDefault(), { passive:false });

  const STORAGE_KEY = "ww_save_official12_v1";

  const State = {
    phase: "setup",          // setup | deal | night | day | end
    playerCount: 12,
    optIdiot: false,         // false=守衛 true=白痴（二擇一）
    players: [],             // {seat, roleId, name, icon, team, alive}
    dealIndex: 0,

    godView: false,

    nightNo: 1,
    dayNo: 1,

    // 夜晚選擇
    nightStepIndex: 0,
    nightState: {
      guardTarget: null,
      wolfTarget: null,
      seerCheck: null,
    },

    // 女巫永久與當夜
    witch: {
      saveUsed: false,
      poisonUsed: false,
      saveThisNight: false,
      poisonTarget: null,
    },

    // 白天
    dayMode: "mark",         // mark | vote
    dayVoteTarget: null,

    // 投票記錄（簡化：每次只結算一次）
    voteHistory: [],

    // 公告
    logs: [],

    // 獵人處理
    hunterPending: null,     // {seat, reason:"exile"|"night"} 需要決定是否開槍
    hunterShotTarget: null,

    // 遊戲結束
    ended: false,
    endText: "",
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

  function showScreen(name){
    document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
    $(`screen-${name}`)?.classList.add("active");
    State.phase = name;
    save();
  }

  // ===== Roles（官方 12：狼人4、預言家、女巫、獵人、守衛/白痴、平民4） =====
  const ROLES = {
    villager: { id:"villager", name:"村民", icon:"🙂", team:"good" },
    werewolf: { id:"werewolf", name:"狼人", icon:"🐺", team:"wolf" },
    seer:     { id:"seer",     name:"預言家", icon:"🔮", team:"good" },
    witch:    { id:"witch",    name:"女巫", icon:"🧪", team:"good" },
    hunter:   { id:"hunter",   name:"獵人", icon:"🏹", team:"good" },
    guard:    { id:"guard",    name:"守衛", icon:"🛡️", team:"good" },
    idiot:    { id:"idiot",    name:"白痴", icon:"🤪", team:"good" }, // 算神
  };
  const getRole = (rid)=> ROLES[rid] || { id:rid, name:rid, icon:"❔", team:"good" };

  function shuffle(arr){
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function buildPlayers(){
    const n = State.playerCount;

    // 固定配置（先做官方 12）
    // 狼 4
    // 神：seer witch hunter + (guard or idiot)
    // 民：剩下
    const roles = [];
    for(let i=0;i<4;i++) roles.push("werewolf");
    roles.push("seer","witch","hunter", State.optIdiot ? "idiot" : "guard");

    while(roles.length < n) roles.push("villager");
    shuffle(roles);

    State.players = roles.map((rid, idx)=>{
      const r = getRole(rid);
      return { seat: idx+1, roleId: rid, name: r.name, icon: r.icon, team: r.team, alive: true };
    });

    State.dealIndex = 0;
    State.nightNo = 1;
    State.dayNo = 1;
    State.nightStepIndex = 0;
    State.nightState = { guardTarget:null, wolfTarget:null, seerCheck:null };
    State.witch = { saveUsed:false, poisonUsed:false, saveThisNight:false, poisonTarget:null };
    State.dayMode = "mark";
    State.dayVoteTarget = null;
    State.voteHistory = [];
    State.logs = [];
    State.hunterPending = null;
    State.hunterShotTarget = null;
    State.ended = false;
    State.endText = "";
    save();
  }

  // ===== Setup UI =====
  function syncSetupUI(){
    $("playerCount").textContent = String(State.playerCount);
    $("rangeCount").value = String(State.playerCount);

    $("optGuard")?.classList.toggle("active", !State.optIdiot);
    $("optIdiot")?.classList.toggle("active", !!State.optIdiot);

    // 這版固定配置，永遠 OK
    $("warnRoleTotal")?.classList.add("hidden");
    $("btnStart").disabled = false;
  }

  // ===== Deal =====
  let holdTimer = null;
  const HOLD_MS = 300; // ✅ 0.3 秒

  function renderDealSeatGrid(){
    const grid = $("dealSeatGrid");
    if (!grid) return;
    grid.innerHTML = "";
    State.players.forEach((p, idx)=>{
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seat" + (idx===State.dealIndex ? " selected" : "");
      b.textContent = String(p.seat);
      b.addEventListener("click", ()=>{
        State.dealIndex = idx;
        save();
        renderDeal();
      });
      grid.appendChild(b);
    });
  }

  function showReveal(){
    const p = State.players[State.dealIndex];
    if (!p) return;
    $("revealRole").textContent = `${p.icon} ${p.name}`;
    $("modalReveal").classList.remove("hidden");
  }
  function hideReveal(){
    $("modalReveal").classList.add("hidden");
  }

  function renderDeal(){
    const p = State.players[State.dealIndex];
    if (!p) return;

    $("dealText").innerHTML = `請 <b>${p.seat} 號</b> 拿手機`;
    renderDealSeatGrid();

    const pad = $("btnHoldReveal");
    // 用 pointer events：iOS 點擊不會壞
    pad.onpointerdown = () => {
      clearTimeout(holdTimer);
      holdTimer = setTimeout(showReveal, HOLD_MS);
    };
    pad.onpointerup = () => { clearTimeout(holdTimer); hideReveal(); };
    pad.onpointercancel = () => { clearTimeout(holdTimer); hideReveal(); };
    pad.onpointerleave = () => { clearTimeout(holdTimer); hideReveal(); };

    $("btnDealNext").onclick = ()=>{
      State.dealIndex = Math.min(State.players.length-1, State.dealIndex+1);
      save();
      renderDeal();
    };
  }

  // ===== Night Flow（固定流程：天黑 → 守衛 → 狼 → 預言家 → 女巫 → 天亮結算） =====
  const NIGHT_STEPS = [
    { key:"close", type:"info", script:"天黑請閉眼。" },
    { key:"guard", type:"pick_guard", script:"守衛請睜眼，守一位玩家。" },
    { key:"wolf",  type:"pick_wolf",  script:"狼人請睜眼，選擇刀口。" },
    { key:"seer",  type:"pick_seer",  script:"預言家請睜眼，查驗一位玩家。" },
    { key:"witch", type:"witch",      script:"女巫請睜眼（上帝操作）。" },
    { key:"resolve", type:"resolve",  script:"天亮請睜眼（結算並公告）。" },
  ];

  function aliveSeatList(){
    return State.players.filter(p=>p.alive).map(p=>p.seat);
  }

  function renderSeatGrid(containerId, selectedSeat, onPick){
    const box = $(containerId);
    if(!box) return;
    box.innerHTML = "";
    State.players.forEach(p=>{
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seat" + (p.alive ? "" : " dead") + (selectedSeat===p.seat ? " selected" : "");
      b.textContent = String(p.seat);

      // ✅ 上帝視角：顯示角色在號碼旁（你要的）
      if (State.godView) {
        const r = getRole(p.roleId);
        b.textContent = `${p.seat}${r.icon}`;
        b.title = `${p.seat}號 ${r.name}`;
      }

      b.disabled = !p.alive;
      b.addEventListener("click", ()=>{
        if (!p.alive) return;
        onPick?.(p.seat);
      });
      box.appendChild(b);
    });
  }

  function isGuardAlive(){
    return State.players.some(p=>p.alive && p.roleId==="guard");
  }
  function isSeerAlive(){
    return State.players.some(p=>p.alive && p.roleId==="seer");
  }
  function isWitchAlive(){
    return State.players.some(p=>p.alive && p.roleId==="witch");
  }

  function currentNightStep(){
    return NIGHT_STEPS[State.nightStepIndex] || null;
  }

  function nightTips(step){
    const tips = [];

    // 守衛死亡：仍唸流程，但不可操作
    if (step.type==="pick_guard" && !isGuardAlive()) {
      tips.push("🛡️ 守衛已死亡，本回合不可操作（仍照唸流程）。");
    }

    // 預言家結果顯示（上帝方便口述）
    if (step.type==="pick_seer" && State.nightState.seerCheck) {
      const seat = State.nightState.seerCheck;
      const p = State.players.find(x=>x.seat===seat);
      if (p) {
        const r = getRole(p.roleId);
        tips.push(`🔮 查驗 ${seat} 號 → ${r.icon} ${r.name}（${r.team==="wolf"?"狼人陣營":"好人陣營"}）`);
      }
    }

    // 女巫提示（含你要求的「女巫被刀：顯示刀口但註明不可自救」）
    if (step.type==="witch") {
      const knife = State.nightState.wolfTarget || null;
      const witchSeat = State.players.find(p=>p.roleId==="witch")?.seat ?? null;
      const witchAlive = isWitchAlive();

      if (!witchAlive) {
        tips.push("🧪 女巫已死亡（仍照唸流程）。");
      }

      // 解藥顯示規則（照你最後確認）
      if (State.witch.saveUsed) {
        tips.push("🧪 解藥：已用過（本局不再顯示刀口）");
      } else {
        if (knife) {
          if (witchSeat && knife===witchSeat) {
            tips.push(`🧪 刀口：${knife} 號（女巫被刀）`);
            tips.push("⚠️ 本局設定：女巫不可自救（不能點刀口救自己）");
          } else {
            tips.push(`🧪 刀口：${knife} 號（點刀口＝救）`);
          }
        } else {
          tips.push("🧪 刀口：狼人尚未選擇");
        }
      }

      tips.push(`☠️ 毒藥：${State.witch.poisonUsed ? "已用過（毒藥沒了）" : "可用（點其他人＝毒）"}`);
      if (State.witch.poisonTarget) tips.push(`已選毒：${State.witch.poisonTarget} 號`);
      if (State.witch.saveThisNight && knife) tips.push(`已選救：${knife} 號`);
      tips.push("➡️ 直接按「下一步」＝本晚不使用技能");
    }

    return tips;
  }

  function renderNight(){
    $("nightTag").textContent = `第 ${State.nightNo} 夜`;

    const step = currentNightStep();
    if (!step) return;

    const lines = [];
    lines.push(`第 ${State.nightNo} 夜｜${step.script}`);
    const tips = nightTips(step);
    if (tips.length) {
      lines.push("");
      lines.push(...tips);
    }
    $("nightScript").textContent = lines.join("\n");

    // 座位選擇區：根據 step 決定是否可選、選哪個 key
    let selected = null;

    if (step.type==="pick_guard") selected = State.nightState.guardTarget;
    if (step.type==="pick_wolf") selected = State.nightState.wolfTarget;
    if (step.type==="pick_seer") selected = State.nightState.seerCheck;
    if (step.type==="witch") {
      selected = State.witch.poisonTarget || (State.witch.saveThisNight ? State.nightState.wolfTarget : null);
    }

    renderSeatGrid("nightSeats", selected, (seat)=>{
      // 不可操作：守衛死了
      if (step.type==="pick_guard") {
        if (!isGuardAlive()) return;
        State.nightState.guardTarget = (State.nightState.guardTarget===seat) ? null : seat;
        save(); renderNight(); return;
      }

      if (step.type==="pick_wolf") {
        State.nightState.wolfTarget = (State.nightState.wolfTarget===seat) ? null : seat;
        save(); renderNight(); return;
      }

      if (step.type==="pick_seer") {
        if (!isSeerAlive()) return; // 預言家死了仍唸流程，但不可操作
        State.nightState.seerCheck = seat;
        save(); renderNight(); return;
      }

      if (step.type==="witch") {
        // 女巫死了仍唸流程，但不可操作（你要的是唸，不是操作）
        if (!isWitchAlive()) return;

        const knife = State.nightState.wolfTarget || null;
        const witchSeat = State.players.find(p=>p.roleId==="witch")?.seat ?? null;

        // 點刀口＝救（解藥未用、且不是女巫自救）
        if (!State.witch.saveUsed && knife && seat===knife) {
          if (witchSeat && knife===witchSeat) {
            // 不可自救
            return;
          }
          State.witch.saveThisNight = true;
          save(); renderNight(); return;
        }

        // 點其他＝毒（毒藥未用）
        if (!State.witch.poisonUsed) {
          State.witch.poisonTarget = seat;
          save(); renderNight(); return;
        }
      }
    });
  }

  function nightCanNext(){
    const step = currentNightStep();
    if (!step) return false;

    if (step.type==="pick_wolf") {
      // 狼刀必選（先做你測試用的最穩規則）
      return !!State.nightState.wolfTarget;
    }
    if (step.type==="pick_seer") {
      // 預言家活著才需要必選；死了就可直接下一步（仍唸流程）
      if (!isSeerAlive()) return true;
      return !!State.nightState.seerCheck;
    }
    // 守衛可空（或死了不可選但可過）
    return true;
  }

  function nightPrev(){
    State.nightStepIndex = Math.max(0, State.nightStepIndex-1);
    save(); renderNight();
  }
  function nightNext(){
    if (!nightCanNext()) return;

    const step = currentNightStep();
    if (!step) return;

    if (step.type==="resolve") {
      resolveNight();
      return;
    }

    // 女巫：按下一步＝本晚不使用技能（不消耗藥）
    if (step.type==="witch") {
      State.nightStepIndex++;
      save(); renderNight();
      return;
    }

    State.nightStepIndex++;
    save(); renderNight();
  }

  // ===== Night Resolve =====
  function resolveNight(){
    const knife = State.nightState.wolfTarget || null;
    const guard = State.nightState.guardTarget || null;

    const dead = new Set();

    if (knife) dead.add(knife);

    // 守衛擋刀（守衛活著才算）
    if (knife && guard && isGuardAlive() && knife===guard) dead.delete(knife);

    // 女巫救（解藥未用 + 本晚選救 + 女巫活著）
    if (State.witch.saveThisNight && !State.witch.saveUsed && isWitchAlive()) {
      // 但若刀口是女巫自己，這裡永遠不會 saveThisNight=true（已在操作時阻止）
      if (knife) dead.delete(knife);
    }

    // 女巫毒（毒藥未用 + 本晚選毒 + 女巫活著）
    if (State.witch.poisonTarget && !State.witch.poisonUsed && isWitchAlive()) {
      dead.add(State.witch.poisonTarget);
    }

    // 套用死亡
    const deadSeats = [];
    dead.forEach(seat=>{
      const p = State.players.find(x=>x.seat===seat);
      if (p && p.alive) { p.alive = false; deadSeats.push(seat); }
    });

    // 消耗藥（只在女巫活著且真的用到時）
    if (isWitchAlive()) {
      if (State.witch.saveThisNight && !State.witch.saveUsed) State.witch.saveUsed = true;
      if (State.witch.poisonTarget && !State.witch.poisonUsed) State.witch.poisonUsed = true;
    }

    // 公告（你要「全部一起公布讓玩家自己判斷」）
    let publicText = "";
    if (!deadSeats.length) publicText = "天亮了，昨晚是平安夜。";
    else publicText = `天亮了，昨晚死亡：${deadSeats.join("、")} 號。`;

    State.logs.unshift({
      nightNo: State.nightNo,
      dayNo: State.dayNo,
      publicText,
      ts: new Date().toISOString()
    });

    // 重置本晚可變狀態（藥永久保留）
    State.nightStepIndex = 0;
    State.nightState = { guardTarget:null, wolfTarget:null, seerCheck:null };
    State.witch.saveThisNight = false;
    State.witch.poisonTarget = null;

    // 勝負判定（屠邊預設）
    const win = checkWin();
    if (win.ended) {
      State.ended = true;
      State.endText = win.text;
      save();
      showEnd();
      return;
    }

    save();
    showScreen("day");
    renderDay();
    openAnn(true);
  }

  // ===== Win Check（屠邊：神全死 or 民全死 → 狼勝；狼全死 → 好勝） =====
  function checkWin(){
    const alive = State.players.filter(p=>p.alive);

    const wolves = alive.filter(p=>p.team==="wolf").length;
    if (wolves<=0) return { ended:true, text:"✅ 遊戲結束：好人獲勝（狼人全滅）" };

    const aliveGod = alive.filter(p=>{
      // 神：seer witch hunter guard idiot（白痴算神）
      return ["seer","witch","hunter","guard","idiot"].includes(p.roleId);
    }).length;

    const aliveVillager = alive.filter(p=>p.roleId==="villager").length;

    // 屠邊：神死光 或 民死光
    if (aliveGod<=0) return { ended:true, text:"🐺 遊戲結束：狼人獲勝（屠邊：神職全滅）" };
    if (aliveVillager<=0) return { ended:true, text:"🐺 遊戲結束：狼人獲勝（屠邊：平民全滅）" };

    // 狼數 >= 好人（也可直接判狼勝，避免卡局）
    const good = alive.length - wolves;
    if (wolves >= good) return { ended:true, text:"🐺 遊戲結束：狼人獲勝（狼數≥好人）" };

    return { ended:false };
  }

  // ===== Announcement =====
  let annMode = "today";

  function renderAnn(){
    const box = $("annBox");
    if (!box) return;

    if (!State.logs.length) {
      box.textContent = "（尚無公告）";
      return;
    }

    if (annMode==="today") {
      box.textContent = State.logs[0].publicText;
      return;
    }

    const lines = [];
    State.logs.forEach((l, idx)=>{
      lines.push(`#${State.logs.length-idx}｜第${l.nightNo}夜 / 第${l.dayNo}天`);
      lines.push(l.publicText);
      lines.push("—");
    });
    box.textContent = lines.join("\n");
  }

  function openAnn(forceToday=false){
    if (forceToday) annMode="today";
    $("modalAnn").classList.remove("hidden");
    $("annToday").classList.toggle("active", annMode==="today");
    $("annHistory").classList.toggle("active", annMode==="history");
    renderAnn();
  }
  function closeAnn(){
    $("modalAnn").classList.add("hidden");
  }

  // ===== Day =====
  function renderDay(){
    $("dayTag").textContent = `第 ${State.dayNo} 天`;
    $("dayAlive").textContent = `存活：${aliveSeatList().join("、")} 號`;

    renderDaySeats();
    $("btnDayMode").textContent = State.dayMode==="mark" ? "切換：投票模式" : "切換：標記模式";
    $("dayModeHint").textContent = State.dayMode==="mark"
      ? "☠️ 標記模式：點座位可切換存活"
      : "🗳️ 投票模式：點座位選投票目標（會高亮）";
  }

  function renderDaySeats(){
    const box = $("daySeats");
    if (!box) return;
    box.innerHTML = "";

    State.players.forEach(p=>{
      const b = document.createElement("button");
      b.type="button";
      b.className="seat" + (p.alive ? "" : " dead");

      if (State.dayMode==="vote" && State.dayVoteTarget===p.seat) b.classList.add("selected");

      // 上帝視角顯示角色
      if (State.godView) {
        const r = getRole(p.roleId);
        b.textContent = `${p.seat}${r.icon}`;
      } else {
        b.textContent = String(p.seat);
      }

      b.addEventListener("click", ()=>{
        if (State.dayMode==="mark") {
          p.alive = !p.alive;
          save();
          renderDay();
          return;
        }
        if (State.dayMode==="vote") {
          State.dayVoteTarget = (State.dayVoteTarget===p.seat) ? null : p.seat;
          save();
          renderDaySeats();
          return;
        }
      });

      box.appendChild(b);
    });
  }

  function toggleDayMode(){
    State.dayMode = State.dayMode==="mark" ? "vote" : "mark";
    if (State.dayMode==="mark") State.dayVoteTarget = null;
    save();
    renderDay();
  }

  // ===== Vote Settlement (簡化：你按「結算」→ 直接公告得票 & 放逐) =====
  function settleVote(){
    if (State.dayMode!=="vote") return;

    const target = State.dayVoteTarget;
    if (!target) return;

    // 這版先用「上帝手動點選」作為結果（未做逐一點名計票）
    // 但公告格式照你要的「得票/放逐」
    const text =
      `白天投票結算：\n` +
      `放逐：${target} 號\n` +
      `（此版為測試流程：由上帝選擇放逐目標，後續再加逐一點票統計）`;

    // 放逐
    const exiled = State.players.find(p=>p.seat===target);
    if (exiled && exiled.alive) {
      exiled.alive = false;
    }

    State.logs.unshift({
      nightNo: State.nightNo,
      dayNo: State.dayNo,
      publicText: text,
      ts: new Date().toISOString()
    });

    // ✅ 獵人被放逐：詢問是否開槍
    if (exiled && exiled.roleId==="hunter") {
      State.hunterPending = { seat: target, reason:"exile" };
      State.hunterShotTarget = null;
      save();
      openHunterModal();
      return;
    }

    // 勝負
    const win = checkWin();
    if (win.ended) {
      State.ended = true;
      State.endText = win.text;
      save();
      showEnd();
      return;
    }

    save();
    openAnn(true);
    renderDay();
  }

  // ===== Hunter Modal =====
  function openHunterModal(){
    $("modalHunter").classList.remove("hidden");
    renderSeatGrid("hunterSeats", State.hunterShotTarget, (seat)=>{
      // 不可射自己（可改）
      if (State.hunterPending?.seat===seat) return;
      State.hunterShotTarget = (State.hunterShotTarget===seat) ? null : seat;
      save();
      openHunterModal();
    });
  }
  function closeHunterModal(){
    $("modalHunter").classList.add("hidden");
  }
  function hunterNoShot(){
    // 不開槍，直接結束獵人流程
    closeHunterModal();

    // 勝負
    const win = checkWin();
    if (win.ended) {
      State.ended = true;
      State.endText = win.text;
      save();
      showEnd();
      return;
    }

    save();
    openAnn(true);
    renderDay();
  }
  function hunterConfirmShot(){
    const t = State.hunterShotTarget;
    closeHunterModal();

    if (t) {
      const p = State.players.find(x=>x.seat===t);
      if (p && p.alive) p.alive = false;

      State.logs.unshift({
        nightNo: State.nightNo,
        dayNo: State.dayNo,
        publicText: `🏹 獵人開槍：帶走 ${t} 號。`,
        ts: new Date().toISOString()
      });
    } else {
      State.logs.unshift({
        nightNo: State.nightNo,
        dayNo: State.dayNo,
        publicText: `🏹 獵人選擇不開槍。`,
        ts: new Date().toISOString()
      });
    }

    State.hunterPending = null;
    State.hunterShotTarget = null;

    // 勝負
    const win = checkWin();
    if (win.ended) {
      State.ended = true;
      State.endText = win.text;
      save();
      showEnd();
      return;
    }

    save();
    openAnn(true);
    renderDay();
  }

  // ===== Enter next night =====
  function dayToNight(){
    // 下一夜
    State.nightNo += 1;

    // reset night state（藥永久保留）
    State.nightStepIndex = 0;
    State.nightState = { guardTarget:null, wolfTarget:null, seerCheck:null };
    State.witch.saveThisNight = false;
    State.witch.poisonTarget = null;

    // reset day vote
    State.dayNo += 1;
    State.dayMode = "mark";
    State.dayVoteTarget = null;

    save();
    showScreen("night");
    renderNight();
  }

  // ===== God Toggle =====
  function setGod(flag){
    State.godView = !!flag;
    $("btnGodToggle").textContent = State.godView ? "🔓" : "🔒";
    save();

    // 重新渲染當前畫面（讓號碼旁立即顯示角色 icon）
    if (State.phase==="deal") renderDeal();
    if (State.phase==="night") renderNight();
    if (State.phase==="day") renderDay();
    if (State.phase==="end") showEnd();
  }
  function toggleGod(){ setGod(!State.godView); }

  // ===== End =====
  function showEnd(){
    showScreen("end");
    $("endText").textContent = State.endText || "（遊戲結束）";
  }

  // ===== Bind =====
  function bind(){
    // Setup
    $("rangeCount").addEventListener("input", (e)=>{
      State.playerCount = Math.max(6, Math.min(12, Number(e.target.value)||12));
      syncSetupUI(); save();
    });
    $("optGuard").addEventListener("click", ()=>{
      State.optIdiot = false; syncSetupUI(); save();
    });
    $("optIdiot").addEventListener("click", ()=>{
      State.optIdiot = true; syncSetupUI(); save();
    });

    $("btnStart").addEventListener("click", ()=>{
      buildPlayers();
      showScreen("deal");
      renderDeal();
    });

    // Deal
    $("btnBackSetup").addEventListener("click", ()=>{
      showScreen("setup");
      syncSetupUI();
    });

    // ✅ 你卡住的點：抽完進夜晚按鈕，必須接事件
    $("btnDealEnterNight").addEventListener("click", ()=>{
      // 進入夜晚
      State.nightStepIndex = 0;
      save();
      showScreen("night");
      renderNight();
    });

    // Night
    $("btnNightPrev").addEventListener("click", nightPrev);
    $("btnNightNext").addEventListener("click", nightNext);

    // Day
    $("btnDayMode").addEventListener("click", toggleDayMode);
    $("btnDayVoteConfirm").addEventListener("click", settleVote);
    $("btnDayToNight").addEventListener("click", dayToNight);

    // Announcement
    $("btnAnn").addEventListener("click", ()=> openAnn(true));
    $("btnAnn2").addEventListener("click", ()=> openAnn(true));
    $("btnAnnClose").addEventListener("click", closeAnn);
    $("annMask").addEventListener("click", closeAnn);
    $("annToday").addEventListener("click", ()=>{ annMode="today"; openAnn(false); });
    $("annHistory").addEventListener("click", ()=>{ annMode="history"; openAnn(false); });

    $("btnCopyAnn").addEventListener("click", async ()=>{
      try{
        await navigator.clipboard.writeText($("annBox").textContent || "");
      }catch(e){}
    });

    $("btnExportAnn").addEventListener("click", ()=>{
      const payload = {
        playerCount: State.playerCount,
        optIdiot: State.optIdiot,
        players: State.players,
        logs: State.logs,
        ts: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(payload,null,2)], {type:"application/json"});
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "werewolf_logs.json";
      a.click();
      setTimeout(()=> URL.revokeObjectURL(a.href), 800);
    });

    // God / Restart
    $("btnGodToggle").addEventListener("click", toggleGod);
    $("btnRestart").addEventListener("click", ()=>{
      if (!confirm("確定要重新開始？所有進度會清除。")) return;
      clearSave();
      location.reload();
    });

    // Hunter modal
    $("btnHunterNo").addEventListener("click", hunterNoShot);
    $("btnHunterYes").addEventListener("click", hunterConfirmShot);
    $("hunterMask").addEventListener("click", hunterNoShot);

    // End
    $("btnEndRestart").addEventListener("click", ()=>{
      clearSave();
      location.reload();
    });
  }

  // ===== Init =====
  function init(){
    load();
    bind();
    syncSetupUI();
    setGod(State.godView);

    // 回到上次畫面
    showScreen(State.phase || "setup");

    if (State.phase==="setup") syncSetupUI();
    if (State.phase==="deal") renderDeal();
    if (State.phase==="night") renderNight();
    if (State.phase==="day") renderDay();
    if (State.phase==="end") showEnd();
  }

  init();
})();