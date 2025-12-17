(() => {
  const $ = (id) => document.getElementById(id);

  // ===== iOS 防長按/雙擊放大（再補強一次） =====
  try {
    document.documentElement.style.webkitUserSelect = "none";
    document.documentElement.style.userSelect = "none";
    document.documentElement.style.webkitTouchCallout = "none";
    document.body && (document.body.style.webkitUserSelect = "none");
    document.body && (document.body.style.userSelect = "none");
  } catch {}
  document.addEventListener("contextmenu", (e) => e.preventDefault(), { passive:false });
  document.addEventListener("selectstart", (e) => e.preventDefault(), { passive:false });
  document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive:false });
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive:false });

  const STORAGE_KEY = "ww_official12_mvp_v1";

  const State = {
    phase: "setup", // setup | deal | night | day
    boardId: "official12",
    playerCount: 12,

    // 由 setup 決定
    wolfset: "w4",
    godchoice: "guard",

    settings: {
      noConsecutiveGuard: true,
      wolfCanNoKill: true,
      witchCannotSelfSave: true,
      hunterPoisonNoShoot: true,
      blackPoisonNoSkill: true,
    },

    players: [], // [{seat, roleId, alive}]
    dealIndex: 0,

    nightNo: 1,
    dayNo: 1,

    godView: false,

    // 每晚狀態
    nightState: { guardTarget:null, wolfTarget:null, seerCheck:null },
    lastGuardTarget: null,

    witch: { saveUsed:false, poisonUsed:false, save:false, poisonTarget:null },

    // 夜晚流程
    nightSteps: [],
    nightStepIndex: 0,

    // 公告
    logs: [], // [{title,text}]
    // 白天投票
    vote: { voter:null, target:null, map:{} }, // map[voter]=target
  };

  function save(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(State)); }catch{} }
  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return;
      const s = JSON.parse(raw);
      if(s && typeof s === "object") Object.assign(State, s);
    }catch{}
  }
  function resetAll(){
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }

  function showScreen(name){
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    $(`screen-${name}`)?.classList.add("active");
    State.phase = name;
    save();
  }

  // ===== Data =====
  const DB = window.WW_DB;
  const role = (id) => DB.roles[id] || { id, name:id, icon:"❔", team:"good" };

  // ===== Setup → build players =====
  function buildOfficial12Roles(){
    // 神固定：預女獵
    const baseGods = ["seer","witch","hunter"];
    const choiceGod = State.godchoice === "idiot" ? "idiot" : "guard";

    // 狼隊擇一
    let wolves = [];
    if (State.wolfset === "w4") wolves = ["werewolf","werewolf","werewolf","werewolf"];
    if (State.wolfset === "w3_black") wolves = ["werewolf","werewolf","werewolf","blackWolfKing"];
    if (State.wolfset === "w3_white") wolves = ["werewolf","werewolf","werewolf","whiteWolfKing"];
    if (State.wolfset === "w3_king") wolves = ["werewolf","werewolf","werewolf","wolfKing"];

    // 平民補滿到 12
    const fixed = [...wolves, ...baseGods, choiceGod];
    const villagerCount = Math.max(0, 12 - fixed.length);
    const villagers = Array.from({length:villagerCount}, () => "villager");

    return [...fixed, ...villagers];
  }

  function shuffle(arr){
    for(let i=arr.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }

  function startGame(){
    const rolesArr = buildOfficial12Roles();
    shuffle(rolesArr);

    State.players = rolesArr.map((rid, idx) => ({
      seat: idx+1,
      roleId: rid,
      alive: true
    }));

    State.dealIndex = 0;
    State.nightNo = 1;
    State.dayNo = 1;

    State.logs = [];
    State.vote = { voter:null, target:null, map:{} };

    // reset night
    State.nightState = { guardTarget:null, wolfTarget:null, seerCheck:null };
    State.lastGuardTarget = null;
    State.witch = State.witch || { saveUsed:false, poisonUsed:false, save:false, poisonTarget:null };

    save();
    showScreen("deal");
    renderDeal();
  }

  // ===== Deal (long press reveal) =====
  let holdTimer = null;

  function renderDealSeatGrid(){
    const grid = $("dealSeatGrid");
    if(!grid) return;
    grid.innerHTML = "";
    State.players.forEach((p, idx) => {
      const b = document.createElement("button");
      b.type="button";
      b.className = "seat" + (idx===State.dealIndex ? " selected":"");
      b.textContent = String(p.seat);
      b.onclick = () => {
        State.dealIndex = idx;
        save();
        renderDeal();
      };
      grid.appendChild(b);
    });
  }

  function renderDeal(){
    const p = State.players[State.dealIndex];
    if(!p) return;

    $("dealText").innerHTML = `請 <b>${p.seat} 號</b> 拿手機`;
    renderDealSeatGrid();

    const btn = $("btnHoldReveal");
    btn.onpointerdown = (e) => {
      e.preventDefault?.();
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        const r = role(p.roleId);
        $("revealRole").textContent = `${r.icon} ${r.name}`;
        $("modalReveal").classList.remove("hidden");
        navigator.vibrate?.(50);
      }, 900);
    };
    const end = (e) => {
      e && e.preventDefault?.();
      clearTimeout(holdTimer);
      $("modalReveal").classList.add("hidden");
    };
    btn.onpointerup = end;
    btn.onpointercancel = end;
    btn.onpointerleave = end;
  }

  function nextPlayer(){
    if(State.dealIndex < State.players.length-1){
      State.dealIndex++;
      save();
      renderDeal();
    }else{
      navigator.vibrate?.([60,40,60]);
    }
  }

  // ===== Night =====
  function loadNightSteps(){
    const flow = DB.nightFlows[DB.boards.official12.nightFlowId];
    State.nightSteps = flow.slice().sort((a,b)=>a.order-b.order);
    State.nightStepIndex = 0;
  }

  function setSeatRoleLabels(){
    // 上帝視角：在每顆 seat 顯示 role 名稱
    const apply = (containerId) => {
      const box = $(containerId);
      if(!box) return;
      box.querySelectorAll(".seat").forEach(btn => {
        const seat = Number(btn.textContent);
        const p = State.players.find(x=>x.seat===seat);
        if(!p) return;
        const r = role(p.roleId);
        btn.setAttribute("data-role", `${r.icon}${r.name}`);
      });
    };
    apply("nightSeats");
    apply("daySeats");
    apply("dealSeatGrid");
  }

  function currentStep(){
    return State.nightSteps[State.nightStepIndex] || null;
  }

  function seerResultText(seat){
    const p = State.players.find(x=>x.seat===seat);
    if(!p) return "";
    const r = role(p.roleId);
    const camp = (r.team === "wolf") ? "狼人陣營" : "好人陣營";
    return `🔮 查驗 ${seat} 號 → ${r.icon} ${r.name}（${camp}）`;
  }

  function witchHintText(){
    const witchSeat = State.players.find(p=>p.roleId==="witch")?.seat || null;
    const knife = State.nightState.wolfTarget;

    const lines = [];

    // 解藥提示規則（你確認的）
    if (State.witch.saveUsed) {
      lines.push("🧪 解藥：已用過（本局不再顯示刀口）");
    } else {
      if (!knife) {
        lines.push("🧪 解藥：狼人尚未選刀（暫無刀口）");
      } else {
        // 女巫被刀：仍要顯示刀口，但註明不可自救（若開啟）
        if (witchSeat && knife === witchSeat && State.settings.witchCannotSelfSave) {
          lines.push(`🧪 刀口：${knife} 號（女巫自己）｜規則：不可自救`);
        } else {
          lines.push(`🧪 刀口：${knife} 號（點刀口=救）`);
        }
      }
    }

    if (State.witch.poisonUsed) lines.push("☠️ 毒藥：已用過（毒藥沒了）");
    else lines.push("☠️ 毒藥：可用（點其他人=毒）");

    if (State.witch.save && knife) lines.push(`✅ 已選救：${knife} 號`);
    if (State.witch.poisonTarget) lines.push(`☠️ 已選毒：${State.witch.poisonTarget} 號`);

    return lines.join("\n");
  }

  function renderNight(){
    $("nightTag").textContent = `第 ${State.nightNo} 夜`;

    const step = currentStep();
    if(!step){
      $("nightPublic").textContent = "（夜晚流程結束）";
      $("nightGod").textContent = "";
      return;
    }

    $("nightPublic").textContent = step.scripts.public || "（無口述）";

    // god hints
    const godLines = [];
    godLines.push(step.scripts.god || "");
    if(step.type === "SEER_CHECK" && State.nightState.seerCheck){
      godLines.push("");
      godLines.push(seerResultText(State.nightState.seerCheck));
    }
    if(step.type === "WITCH"){
      godLines.push("");
      godLines.push(witchHintText());
    }
    $("nightGod").textContent = godLines.join("\n").trim();

    renderNightSeats();
    setSeatRoleLabels();
  }

  function selectedSeatForStep(step){
    if(!step) return null;
    if(step.type === "PICK") return State.nightState[step.pickKey] || null;
    if(step.type === "SEER_CHECK") return State.nightState[step.pickKey] || null;
    if(step.type === "WITCH") return State.witch.poisonTarget || (State.witch.save ? State.nightState.wolfTarget : null);
    return null;
  }

  function renderNightSeats(){
    const box = $("nightSeats");
    box.innerHTML = "";
    const step = currentStep();
    const selected = selectedSeatForStep(step);

    State.players.forEach(p => {
      const b = document.createElement("button");
      b.type="button";
      b.className = "seat" + (p.alive ? "" : " dead") + ((selected===p.seat) ? " selected" : "");
      b.textContent = String(p.seat);
      b.disabled = !p.alive;

      b.onclick = () => {
        if(!p.alive) return;
        handleNightSeatClick(p.seat);
      };

      box.appendChild(b);
    });
  }

  function handleNightSeatClick(seat){
    const step = currentStep();
    if(!step) return;

    // ===== Guard / Wolf / Seer =====
    if(step.type === "PICK"){
      // 不能連守
      if(step.pickKey === "guardTarget" && State.settings.noConsecutiveGuard){
        if(State.lastGuardTarget && State.lastGuardTarget === seat){
          navigator.vibrate?.([60,40,60]);
          return;
        }
      }

      // 狼人空刀：點同一個再點一次取消
      if(step.pickKey === "wolfTarget" && State.settings.wolfCanNoKill){
        State.nightState.wolfTarget = (State.nightState.wolfTarget === seat) ? null : seat;
      }else{
        State.nightState[step.pickKey] = seat;
      }

      save();
      renderNight();
      return;
    }

    if(step.type === "SEER_CHECK"){
      State.nightState.seerCheck = seat;
      save();
      renderNight();
      return;
    }

    // ===== Witch：不跳視窗 =====
    if(step.type === "WITCH"){
      const witchSeat = State.players.find(p=>p.roleId==="witch")?.seat || null;
      const knife = State.nightState.wolfTarget;

      // 點刀口 = 救（解藥未用，且刀口存在）
      if (!State.witch.saveUsed && knife && seat === knife) {
        // 不可自救
        if (witchSeat && knife === witchSeat && State.settings.witchCannotSelfSave) {
          // 仍顯示刀口，但禁止救
          State.witch.save = false;
          navigator.vibrate?.([60,40,60]);
          save();
          renderNight();
          return;
        }
        State.witch.save = true;
        save();
        renderNight();
        return;
      }

      // 其他 = 毒（毒藥未用）
      if (!State.witch.poisonUsed) {
        State.witch.poisonTarget = seat;
        save();
        renderNight();
        return;
      }

      navigator.vibrate?.(30);
    }
  }

  function canNext(step){
    if(!step) return false;
    if(step.type === "PICK"){
      if(step.pickKey === "wolfTarget" && State.settings.wolfCanNoKill) return true; // 可空刀
      return !!State.nightState[step.pickKey];
    }
    if(step.type === "SEER_CHECK") return !!State.nightState.seerCheck;
    // WITCH 可直接下一步=不用
    return true;
  }

  function nightPrev(){
    State.nightStepIndex = Math.max(0, State.nightStepIndex - 1);
    save();
    renderNight();
  }

  function nightNext(){
    const step = currentStep();
    if(!canNext(step)){
      navigator.vibrate?.([60,40,60]);
      return;
    }

    // 進下一步
    if(step.type !== "RESOLVE"){
      // 如果剛剛守衛選定，記住做「不能連守」
      if(step.type === "PICK" && step.pickKey === "guardTarget" && State.nightState.guardTarget){
        State.lastGuardTarget = State.nightState.guardTarget;
      }
      State.nightStepIndex++;
      save();
      renderNight();
      return;
    }

    // RESOLVE
    resolveNight();
  }

  // ===== Resolve Night =====
  function resolveNight(){
    const knife = State.nightState.wolfTarget;  // 可 null
    const guard = State.nightState.guardTarget; // 必選（若有守衛）
    const killed = new Set();

    if(knife) killed.add(knife);

    // 守衛擋刀（但「同守同救＝奶穿」：仍死亡）
    const isSameGuardAndKnife = knife && guard && (knife === guard);

    // 女巫救：點刀口=救（只要本晚選擇 save=true）
    const canUseSave = !State.witch.saveUsed;
    const willSave = !!State.witch.save && canUseSave;

    // 女巫不可自救：若刀口=女巫自己，救無效
    const witchSeat = State.players.find(p=>p.roleId==="witch")?.seat || null;
    const selfSaveBlocked = (witchSeat && knife === witchSeat && State.settings.witchCannotSelfSave);

    // 先處理擋刀/救人
    if(knife){
      if(isSameGuardAndKnife && willSave && !selfSaveBlocked){
        // 奶穿：仍死亡（保留 killed）
      } else {
        // 守衛擋刀
        if(isSameGuardAndKnife) killed.delete(knife);
        // 女巫救人
        if(willSave && !selfSaveBlocked) killed.delete(knife);
      }
    }

    // 女巫毒
    const canUsePoison = !State.witch.poisonUsed;
    if(State.witch.poisonTarget && canUsePoison){
      killed.add(State.witch.poisonTarget);
    }

    // 套用死亡
    const deadSeats = [];
    killed.forEach(seat => {
      const p = State.players.find(x=>x.seat===seat);
      if(p && p.alive){
        p.alive = false;
        deadSeats.push(seat);
      }
    });

    // 用藥永久消耗
    if(willSave && !State.witch.saveUsed && !selfSaveBlocked) State.witch.saveUsed = true;
    if(State.witch.poisonTarget && !State.witch.poisonUsed) State.witch.poisonUsed = true;

    // 白天公告：不顯示死因，只公布死亡名單或平安夜（符合你 Step9-4A）
    const ann = deadSeats.length
      ? `天亮了，昨晚死亡：${deadSeats.join("、")} 號。`
      : `天亮了，昨晚是平安夜。`;

    State.logs.unshift({ title:`第${State.nightNo}夜公告`, text: ann });

    // 勝負（先簡易）
    const win = checkWinSimple();
    let dayAnn = ann;
    if(win.ended) dayAnn += `\n\n${win.text}`;

    // 進白天
    $("dayAnn").textContent = dayAnn;
    State.dayNo = State.nightNo; // 方便看：第N夜 -> 第N天（你也可改）
    showScreen("day");
    renderDay();

    save();
    openAnnModal();
  }

  function checkWinSimple(){
    const alive = State.players.filter(p=>p.alive);
    const wolves = alive.filter(p => role(p.roleId).team === "wolf").length;
    const good = alive.length - wolves;
    if(wolves <= 0) return { ended:true, text:"✅ 好人獲勝（狼人全滅）" };
    if(wolves >= good) return { ended:true, text:"🐺 狼人獲勝（狼數 ≥ 好人）" };
    return { ended:false, text:"" };
  }

  // ===== Day + Voting (簡化) =====
  function renderDay(){
    $("dayTag").textContent = `第 ${State.nightNo} 天`;
    const aliveSeats = State.players.filter(p=>p.alive).map(p=>p.seat);
    $("dayAlive").textContent = aliveSeats.length ? `存活：${aliveSeats.join("、")} 號` : "（全滅？）";

    renderDaySeats();
    setSeatRoleLabels();
    renderVoteStatus();
  }

  function renderVoteStatus(){
    $("voteVoter").textContent = State.vote.voter ? `${State.vote.voter} 號` : "（先點一個座位）";
    $("voteTarget").textContent = State.vote.target ? `${State.vote.target} 號` : "（再點要投的人）";
  }

  function renderDaySeats(){
    const box = $("daySeats");
    box.innerHTML = "";

    State.players.forEach(p=>{
      const b = document.createElement("button");
      b.type="button";
      const selected = (State.vote.target === p.seat) || (State.vote.voter === p.seat);
      b.className = "seat" + (p.alive ? "" : " dead") + (selected ? " selected":"");
      b.textContent = String(p.seat);
      b.disabled = !p.alive;

      b.onclick = () => {
        if(!p.alive) return;
        // 第一段選投票者
        if(!State.vote.voter){
          State.vote.voter = p.seat;
          State.vote.target = null;
        }else if(!State.vote.target){
          // 第二段選目標（可以投自己也行；你可再加限制）
          State.vote.target = p.seat;
          State.vote.map[String(State.vote.voter)] = State.vote.target;
          // 送出一票後，讓他再選下一個投票者（加速主持）
          State.vote.voter = null;
          State.vote.target = null;
        }
        save();
        renderDay();
      };

      box.appendChild(b);
    });
  }

  function clearVotes(){
    State.vote = { voter:null, target:null, map:{} };
    save();
    renderDay();
  }

  function tallyVote(){
    const votes = State.vote.map || {};
    const alive = new Set(State.players.filter(p=>p.alive).map(p=>p.seat));

    // 統計
    const count = {};
    const lines = [];
    Object.keys(votes).forEach(voterStr=>{
      const voter = Number(voterStr);
      const target = Number(votes[voterStr]);
      if(!alive.has(voter)) return;     // 死人不算
      if(!alive.has(target)) return;    // 投死人不算
      count[target] = (count[target]||0)+1;
      lines.push(`${voter} → ${target}`);
    });

    // 找最高
    let max = 0;
    Object.values(count).forEach(v=>{ if(v>max) max=v; });
    const tops = Object.keys(count).filter(k=>count[k]===max).map(Number);

    let resultText = "";
    if(max===0){
      resultText = "白天投票：尚無有效投票。";
    }else if(tops.length>1){
      resultText = `白天投票結果：\n${lines.join("、")}\n\n得票：` +
        Object.keys(count).map(k=>`${k}號${count[k]}票`).join("、") +
        `\n\n平票（${tops.join("、")}號）→ 本版先不處理 PK，請你手動主持。`;
    }else{
      const exiled = tops[0];
      resultText = `白天投票結果：\n${lines.join("、")}\n\n得票：` +
        Object.keys(count).map(k=>`${k}號${count[k]}票`).join("、") +
        `\n\n放逐：${exiled} 號。`;
      // 直接放逐（先不接技能彈窗）
      const p = State.players.find(x=>x.seat===exiled);
      if(p) p.alive = false;
    }

    State.logs.unshift({ title:`第${State.nightNo}天投票`, text: resultText });
    save();
    openAnnModal();
    renderDay();
  }

  function nextNight(){
    // 下一夜初始化
    State.nightNo += 1;

    State.nightState = { guardTarget:null, wolfTarget:null, seerCheck:null };
    State.witch.save = false;
    State.witch.poisonTarget = null;

    loadNightSteps();
    State.nightStepIndex = 0;

    save();
    showScreen("night");
    renderNight();
  }

  // ===== Announcement modal =====
  function openAnnModal(){
    const box = $("annBox");
    if(!State.logs.length) box.textContent = "（尚無公告）";
    else{
      const lines = [];
      State.logs.slice(0, 30).forEach((l, idx)=>{
        lines.push(`【${l.title}】`);
        lines.push(l.text);
        lines.push("—");
      });
      box.textContent = lines.join("\n");
    }
    $("modalAnn").classList.remove("hidden");
  }
  function closeAnnModal(){
    $("modalAnn").classList.add("hidden");
  }

  // ===== God view =====
  function setGod(flag){
    State.godView = !!flag;
    document.body.classList.toggle("god-on", State.godView);
    $("btnGod").textContent = State.godView ? "🔓" : "🔒";
    save();
    // 立即刷新 role label
    setSeatRoleLabels();
    if(State.phase==="night") renderNight();
    if(State.phase==="day") renderDay();
    if(State.phase==="deal") renderDealSeatGrid();
  }
  function toggleGod(){ setGod(!State.godView); }

  // ===== Bind =====
  function bind(){
    $("btnStart").onclick = startGame;
    $("btnDealBack").onclick = () => { showScreen("setup"); };
    $("btnNextPlayer").onclick = nextPlayer;
    $("btnFinishDeal").onclick = () => $("modalDealConfirm").classList.remove("hidden");
    $("dealConfirmNo").onclick = () => $("modalDealConfirm").classList.add("hidden");
    $("dealConfirmYes").onclick = () => {
      $("modalDealConfirm").classList.add("hidden");
      // 進夜晚
      State.nightNo = 1;
      loadNightSteps();
      State.nightStepIndex = 0;
      showScreen("night");
      renderNight();
      save();
    };

    $("btnNightPrev").onclick = nightPrev;
    $("btnNightNext").onclick = nightNext;

    $("btnDayNext").onclick = nextNight;
    $("btnClearVotes").onclick = clearVotes;
    $("btnTallyVote").onclick = tallyVote;

    $("btnAnn").onclick = openAnnModal;
    $("btnCloseAnn").onclick = closeAnnModal;

    $("btnGod").onclick = toggleGod;

    $("btnRestart").onclick = () => {
      if(!confirm("確定要重新開始？所有進度會清除。")) return;
      resetAll();
    };

    // role config placeholder
    $("btnOpenRoleConfig").onclick = () => $("modalRole").classList.remove("hidden");
    $("btnCloseRole").onclick = () => $("modalRole").classList.add("hidden");
    $("btnCloseRole2").onclick = () => $("modalRole").classList.add("hidden");

    // setup radios + toggles
    document.querySelectorAll('input[name="wolfset"]').forEach(r=>{
      r.addEventListener("change", () => { State.wolfset = r.value; save(); });
    });
    document.querySelectorAll('input[name="godchoice"]').forEach(r=>{
      r.addEventListener("change", () => { State.godchoice = r.value; save(); });
    });

    $("s_noConGuard").onchange = (e)=>{ State.settings.noConsecutiveGuard = e.target.checked; save(); };
    $("s_wolfNoKill").onchange = (e)=>{ State.settings.wolfCanNoKill = e.target.checked; save(); };
    $("s_witchNoSelf").onchange = (e)=>{ State.settings.witchCannotSelfSave = e.target.checked; save(); };
    $("s_hunterPoisonNoShoot").onchange = (e)=>{ State.settings.hunterPoisonNoShoot = e.target.checked; save(); };
    $("s_blackPoisonNoSkill").onchange = (e)=>{ State.settings.blackPoisonNoSkill = e.target.checked; save(); };
  }

  // ===== Boot =====
  function boot(){
    load();

    // 恢復 setup UI
    // radios
    const wolfRadio = document.querySelector(`input[name="wolfset"][value="${State.wolfset}"]`);
    if(wolfRadio) wolfRadio.checked = true;
    const godRadio = document.querySelector(`input[name="godchoice"][value="${State.godchoice}"]`);
    if(godRadio) godRadio.checked = true;

    $("s_noConGuard").checked = !!State.settings.noConsecutiveGuard;
    $("s_wolfNoKill").checked = !!State.settings.wolfCanNoKill;
    $("s_witchNoSelf").checked = !!State.settings.witchCannotSelfSave;
    $("s_hunterPoisonNoShoot").checked = !!State.settings.hunterPoisonNoShoot;
    $("s_blackPoisonNoSkill").checked = !!State.settings.blackPoisonNoSkill;

    bind();
    setGod(State.godView);

    showScreen(State.phase || "setup");

    if(State.phase === "deal") renderDeal();
    if(State.phase === "night"){
      if(!State.nightSteps || !State.nightSteps.length) loadNightSteps();
      renderNight();
    }
    if(State.phase === "day"){
      // dayAnn 優先顯示最近公告
      if(State.logs[0]) $("dayAnn").textContent = State.logs[0].text;
      renderDay();
    }
  }

  boot();
})();