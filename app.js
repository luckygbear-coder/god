/* =========================================================
   狼人殺｜上帝輔助 PWA（童話UI / 無主畫面捲軸）
   - 上帝視角切換（🔒/🔓） everywhere
   - 抽身分：長按 1.2 秒翻牌（放開隱藏）
   - 夜晚 Wizard（守衛→狼人→預言→女巫→天亮結算）
   - 公告中心：今日/歷史，玩家只看公開；上帝可看隱藏（夜晚動作/票型）
   - 全流程存檔 + 匯出 JSON（復盤）
   - 若 /data 尚未建立：使用 fallback 資料（可先跑）
========================================================= */

(() => {
  /* -------------------------
     DOM helpers
  ------------------------- */
  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const nowISO = () => new Date().toISOString();

  /* -------------------------
     Fallback data (若 /data 還沒建立，先用這套)
  ------------------------- */
  const FALLBACK_ROLES = {
    werewolf: { id: "werewolf", name: "狼人", team: "wolf", emoji: "🐺" },
    villager:{ id: "villager",name: "村民", team: "villager", emoji: "🧑‍🌾" },
    seer:    { id: "seer",    name: "預言家", team: "villager", emoji: "🔮" },
    witch:   { id: "witch",   name: "女巫", team: "villager", emoji: "🧪" },
    hunter:  { id: "hunter",  name: "獵人", team: "villager", emoji: "🔫" },
    guard:   { id: "guard",   name: "守衛", team: "villager", emoji: "🛡" }
  };

  function suggestConfigByCount(n){
    // MVP 常見：9人 2狼+預女獵+4民；10+多守衛
    const wolves = n >= 9 ? 2 : 1;
    const hasGuard = n >= 10 ? 1 : 0;
    const fixed = 1 + 1 + 1 + hasGuard; // seer+witch+hunter+guard
    const villagers = n - wolves - fixed;
    return {
      werewolf: wolves,
      villager: Math.max(0, villagers),
      seer: 1,
      witch: 1,
      hunter: 1,
      guard: hasGuard
    };
  }

  /* -------------------------
     Storage (先內建，之後可拆到 /data/storage)
  ------------------------- */
  const STORAGE_KEY = "wolf_god_assist_v1";
  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return null;
      return JSON.parse(raw);
    }catch(e){
      return null;
    }
  }
  function saveState(state){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){}
  }
  function clearState(){
    try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
  }

  /* -------------------------
     App State
  ------------------------- */
  const State = {
    // view / lock
    godUnlocked: false,
    godView: false,
    pin: "0000",

    // setup
    boardType: "basic", // basic | special (special UI 先保留)
    playerCount: 9,
    rolesCount: suggestConfigByCount(9),

    // game
    phase: "setup",     // setup | deal | night | day
    players: [],
    dealIndex: 0,

    // round counters
    nightNo: 1,
    dayNo: 1,

    // night actions
    night: {
      guardTarget: null,
      wolfTarget: null,
      seerCheckTarget: null,
      seerResult: null,     // "wolf" | "villager"
      witchSaveUsed: false,
      witchPoisonUsed: false,
      witchSave: false,
      witchPoisonTarget: null
    },

    // wizard
    nightSteps: [],
    nightStepIndex: 0,
    selectedSeat: null,

    // announcements / logs
    logs: [] // {id, ts, dayNo, nightNo, publicText, hiddenText, votes?}
  };

  /* -------------------------
     Restore previous saved game if exists
  ------------------------- */
  const saved = loadState();
  if(saved && saved.players && Array.isArray(saved.players) && saved.players.length){
    Object.assign(State, saved);
    // 確保缺失欄位補上
    State.rolesCount = State.rolesCount || suggestConfigByCount(State.playerCount || 9);
    State.night = State.night || {
      guardTarget:null,wolfTarget:null,seerCheckTarget:null,seerResult:null,
      witchSaveUsed:false,witchPoisonUsed:false,witchSave:false,witchPoisonTarget:null
    };
    State.logs = State.logs || [];
  }

  /* =========================================================
     UI: Screen
  ========================================================= */
  const Screens = {
    setup: $("screen-setup"),
    deal: $("screen-deal"),
    night:$("screen-night"),
    day:  $("screen-day"),
  };

  function showScreen(name){
    Object.values(Screens).forEach(s => s && s.classList.remove("active"));
    const el = Screens[name];
    if(el) el.classList.add("active");
    State.phase = name;
    saveState(State);
  }

  /* =========================================================
     UI: God view toggle (🔒/🔓) - everywhere
  ========================================================= */
  const btnGodToggle = $("btnGodToggle");
  const fabGod = $("fabGod");

  function setGodView(on){
    State.godView = !!on;
    document.body.classList.toggle("god-on", State.godView);
    const icon = State.godView ? "🔓" : "🔒";
    if(btnGodToggle) btnGodToggle.textContent = icon;
    if(fabGod) fabGod.textContent = icon;
    saveState(State);
    // 公告中心若開著，需刷新顯示（公開/隱藏）
    renderAnnouncementBox();
    renderLogList();
  }

  function openGodModal(){
    $("pinInput").value = "";
    $("pinWarn").classList.add("hidden");
    $("modalGod").classList.remove("hidden");
    $("pinInput").focus?.();
  }

  function toggleGod(){
    if(State.godView){
      // 關閉上帝視角（不需要鎖）
      setGodView(false);
      return;
    }
    // 開啟上帝視角：需要已解鎖 or 輸入 PIN
    if(State.godUnlocked){
      setGodView(true);
    }else{
      openGodModal();
    }
  }

  on(btnGodToggle, "click", toggleGod);
  on(fabGod, "click", toggleGod);

  // God modal
  on($("closeGod"), "click", ()=> $("modalGod").classList.add("hidden"));
  on($("pinCancel"), "click", ()=> $("modalGod").classList.add("hidden"));
  on($("pinOk"), "click", ()=>{
    const v = ($("pinInput").value || "").trim();
    if(v === State.pin){
      State.godUnlocked = true;
      $("modalGod").classList.add("hidden");
      setGodView(true);
    }else{
      $("pinWarn").classList.remove("hidden");
    }
  });

  /* =========================================================
     Setup UI
  ========================================================= */
  const elPlayerCount = $("playerCount");
  const elRoleTotal = $("roleTotal");
  const elPlayerTotal = $("playerTotal");
  const warnRoleTotal = $("warnRoleTotal");
  const rangeCount = $("rangeCount");

  function rolesTotal(){
    return Object.values(State.rolesCount).reduce((a,b)=>a+(b||0),0);
  }

  function syncSetupUI(){
    if(elPlayerCount) elPlayerCount.textContent = String(State.playerCount);
    if(rangeCount) rangeCount.value = String(State.playerCount);

    const rt = rolesTotal();
    if(elRoleTotal) elRoleTotal.textContent = String(rt);
    if(elPlayerTotal) elPlayerTotal.textContent = String(State.playerCount);

    const ok = rt === State.playerCount;
    warnRoleTotal?.classList.toggle("hidden", ok);

    const startBtn = $("btnStart");
    if(startBtn){
      startBtn.disabled = !ok;
      startBtn.textContent = ok ? "開始 → 抽身分" : "⚠️ 角色數需等於玩家數";
    }
    saveState(State);
  }

  on($("btnPlus"), "click", ()=>{
    State.playerCount = clamp(State.playerCount + 1, 6, 16);
    // 若原本是建議配置，跟著調整會比較直覺：直接重新建議一次
    State.rolesCount = suggestConfigByCount(State.playerCount);
    syncSetupUI();
  });

  on($("btnMinus"), "click", ()=>{
    State.playerCount = clamp(State.playerCount - 1, 6, 16);
    State.rolesCount = suggestConfigByCount(State.playerCount);
    syncSetupUI();
  });

  on(rangeCount, "input", (e)=>{
    State.playerCount = clamp(Number(e.target.value), 6, 16);
    State.rolesCount = suggestConfigByCount(State.playerCount);
    syncSetupUI();
  });

  // Board type (basic/special)
  const boardBasic = $("boardBasic");
  const boardSpecial = $("boardSpecial");
  function setBoardType(t){
    State.boardType = t;
    boardBasic?.classList.toggle("active", t==="basic");
    boardSpecial?.classList.toggle("active", t==="special");
    // special 先保留 UI，暫時仍採用基本配置規則
    syncSetupUI();
  }
  on(boardBasic, "click", ()=> setBoardType("basic"));
  on(boardSpecial, "click", ()=> setBoardType("special"));

  // Suggest
  on($("btnSuggest"), "click", ()=>{
    State.rolesCount = suggestConfigByCount(State.playerCount);
    syncSetupUI();
  });

  /* =========================================================
     Role Config Modal (彈窗調整角色數)
  ========================================================= */
  const modalRole = $("modalRole");
  const roleConfigBody = $("roleConfigBody");

  function roleRow(roleId, label){
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.justifyContent = "space-between";
    wrap.style.gap = "10px";
    wrap.style.padding = "10px 4px";
    wrap.style.borderBottom = "1px dashed rgba(0,0,0,.08)";

    const left = document.createElement("div");
    left.style.fontWeight = "1000";
    left.textContent = label;

    const right = document.createElement("div");
    right.style.display="flex";
    right.style.alignItems="center";
    right.style.gap="10px";

    const minus = document.createElement("button");
    minus.className = "btn ghost tiny";
    minus.textContent = "－";
    minus.type = "button";

    const num = document.createElement("div");
    num.style.minWidth="36px";
    num.style.textAlign="center";
    num.style.fontWeight="1000";
    num.id = `rc_${roleId}`;
    num.textContent = String(State.rolesCount[roleId] ?? 0);

    const plus = document.createElement("button");
    plus.className = "btn ghost tiny";
    plus.textContent = "＋";
    plus.type = "button";

    minus.onclick = () => {
      State.rolesCount[roleId] = Math.max(0, (State.rolesCount[roleId]||0) - 1);
      num.textContent = String(State.rolesCount[roleId]);
      syncSetupUI();
    };
    plus.onclick = () => {
      State.rolesCount[roleId] = (State.rolesCount[roleId]||0) + 1;
      num.textContent = String(State.rolesCount[roleId]);
      syncSetupUI();
    };

    right.append(minus, num, plus);
    wrap.append(left, right);
    return wrap;
  }

  function renderRoleConfig(){
    if(!roleConfigBody) return;
    roleConfigBody.innerHTML = "";

    const title = document.createElement("div");
    title.className = "hint";
    title.style.marginBottom = "10px";
    title.textContent = "提示：角色總數必須等於玩家人數，才能開始。";
    roleConfigBody.appendChild(title);

    // 基本角色（MVP）
    roleConfigBody.appendChild(roleRow("werewolf", "🐺 狼人"));
    roleConfigBody.appendChild(roleRow("villager","🧑‍🌾 村民"));
    roleConfigBody.appendChild(roleRow("seer",    "🔮 預言家"));
    roleConfigBody.appendChild(roleRow("witch",   "🧪 女巫"));
    roleConfigBody.appendChild(roleRow("hunter",  "🔫 獵人"));
    roleConfigBody.appendChild(roleRow("guard",   "🛡 守衛"));

    const tip2 = document.createElement("div");
    tip2.className = "hint";
    tip2.style.marginTop = "10px";
    tip2.textContent = "特殊角色板子：下一個檔案我會幫你把 /data 分拆後加進來。";
    roleConfigBody.appendChild(tip2);
  }

  on($("btnOpenRoleConfig"), "click", ()=>{
    renderRoleConfig();
    modalRole?.classList.remove("hidden");
  });
  on($("closeRole"), "click", ()=> modalRole?.classList.add("hidden"));
  on($("roleReset"), "click", ()=>{
    State.rolesCount = suggestConfigByCount(State.playerCount);
    renderRoleConfig();
    syncSetupUI();
  });
  on($("roleApply"), "click", ()=>{
    modalRole?.classList.add("hidden");
    syncSetupUI();
  });

  /* =========================================================
     Build Players + Deal
  ========================================================= */
  const dealText = $("dealText");
  const modalReveal = $("modalReveal");
  const revealCard = $("revealCard");
  const revealRole = $("revealRole");

  function buildPlayers(){
    const rolesArr = [];
    for(const [rid, cnt] of Object.entries(State.rolesCount)){
      for(let i=0;i<(cnt||0);i++) rolesArr.push(rid);
    }
    // shuffle
    for(let i=rolesArr.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [rolesArr[i], rolesArr[j]] = [rolesArr[j], rolesArr[i]];
    }

    State.players = rolesArr.map((rid, idx)=>({
      seat: idx+1,
      roleId: rid,
      team: (FALLBACK_ROLES[rid]?.team || "villager"),
      alive: true,
      isChief: false,
      notes: ""
    }));

    State.dealIndex = 0;
    saveState(State);
  }

  function updateDealPrompt(){
    const seat = State.dealIndex + 1;
    if(dealText){
      if(seat <= State.players.length){
        dealText.innerHTML = `請 <b>${seat} 號</b> 拿手機`;
      }else{
        dealText.innerHTML = `所有玩家已抽完身分`;
      }
    }
  }

  // 翻牌顯示（長按 1.2 秒）
  let holdTimer = null;
  let revealShown = false;

  function showReveal(){
    if(State.dealIndex >= State.players.length) return;
    const p = State.players[State.dealIndex];
    const info = FALLBACK_ROLES[p.roleId] || {name: p.roleId};
    revealRole.textContent = `${info.emoji ? info.emoji+" " : ""}${info.name}`;
    modalReveal.classList.remove("hidden");
    // flip
    revealCard.classList.add("flipped");
    revealShown = true;
    if(navigator.vibrate) navigator.vibrate(70);
  }
  function hideReveal(){
    if(!revealShown) return;
    revealCard.classList.remove("flipped");
    modalReveal.classList.add("hidden");
    revealShown = false;
  }

  on($("btnStart"), "click", ()=>{
    if(rolesTotal() !== State.playerCount) return;
    buildPlayers();
    showScreen("deal");
    updateDealPrompt();
  });

  on($("btnDealBack"), "click", ()=>{
    hideReveal();
    showScreen("setup");
  });

  on($("btnNextPlayer"), "click", ()=>{
    hideReveal();
    State.dealIndex++;
    updateDealPrompt();
    saveState(State);
  });

  on($("btnFinishDeal"), "click", ()=>{
    hideReveal();
    // 完成抽牌後，進夜晚
    initNightWizard();
    showScreen("night");
    renderNightUI();
    saveState(State);
  });

  const btnHoldReveal = $("btnHoldReveal");
  if(btnHoldReveal){
    const startHold = () => {
      clearTimeout(holdTimer);
      holdTimer = setTimeout(showReveal, 1200);
    };
    const endHold = () => {
      clearTimeout(holdTimer);
      hideReveal();
    };

    on(btnHoldReveal, "touchstart", startHold, {passive:true});
    on(btnHoldReveal, "touchend", endHold);
    on(btnHoldReveal, "touchcancel", endHold);

    on(btnHoldReveal, "mousedown", startHold);
    on(btnHoldReveal, "mouseup", endHold);
    on(btnHoldReveal, "mouseleave", endHold);
  }

  /* =========================================================
     Night Wizard (MVP)
  ========================================================= */
  const nightTag = $("nightTag");
  const nightScript = $("nightScript");
  const nightSeats = $("nightSeats");

  function hasRole(roleId){
    return State.players.some(p=>p.roleId === roleId);
  }

  function resetNightActions(){
    State.night = {
      guardTarget: null,
      wolfTarget: null,
      seerCheckTarget: null,
      seerResult: null,
      witchSaveUsed: !!State.night?.witchSaveUsed,
      witchPoisonUsed: !!State.night?.witchPoisonUsed,
      witchSave: false,
      witchPoisonTarget: null
    };
    State.selectedSeat = null;
  }

  function initNightWizard(){
    resetNightActions();

    const steps = [];
    steps.push({ key:"close", type:"info", text:"天黑請閉眼。" });

    if(hasRole("guard")) steps.push({ key:"guard", type:"pick", text:"守衛請睜眼，你要守誰？（點選座位）", pick:"guardTarget" });
    steps.push({ key:"wolf", type:"pick", text:"狼人請睜眼，你們要刀誰？（點選座位）", pick:"wolfTarget", required:true });

    if(hasRole("seer")){
      steps.push({
        key:"seer", type:"pick",
        text:"預言家請睜眼，你要查驗誰？（點選座位）",
        pick:"seerCheckTarget",
        afterPick: (seat)=>{
          const target = State.players.find(p=>p.seat===seat);
          const isWolf = target?.team === "wolf";
          State.night.seerResult = isWolf ? "wolf" : "villager";
        }
      });
    }

    if(hasRole("witch")){
      steps.push({
        key:"witch", type:"witch",
        text:"女巫請睜眼。"
      });
    }

    steps.push({ key:"dawn", type:"resolve", text:"天亮請睜眼。系統結算並生成公告。" });

    State.nightSteps = steps;
    State.nightStepIndex = 0;
  }

  function currentStep(){
    return State.nightSteps[State.nightStepIndex];
  }

  function renderSeatDots(container, onPick){
    if(!container) return;
    container.innerHTML = "";

    State.players.forEach(p=>{
      const b = document.createElement("button");
      b.type="button";
      b.className="seat"+(p.alive?"":" dead")+(p.isChief?" chief":"");
      b.textContent=String(p.seat);
      if(State.selectedSeat===p.seat) b.classList.add("selected");

      b.onclick=()=>{
        if(!p.alive) return;

        // 若在「女巫選毒」模式
        if(State._pickPoisonMode){
          State.night.witchPoisonTarget = p.seat;
          State._pickPoisonMode = false;
          saveState(State);
          renderAnnouncementBox();
          renderNightUI();
          return;
        }

        State.selectedSeat = p.seat;
        onPick?.(p.seat);
        renderNightUI();
      };

      container.appendChild(b);
    });
  }

  function renderNightUI(){
    if(nightTag) nightTag.textContent = `第 ${State.nightNo} 夜`;

    const step = currentStep();
    if(!step){
      if(nightScript) nightScript.textContent = "（夜晚流程結束）";
      return;
    }

    // 基本台詞
    let scriptText = step.text;

    // 上帝視角提示（需要上帝看得到的內容）
    if(step.key === "seer" && State.night.seerCheckTarget && State.godView){
      const r = State.night.seerResult === "wolf" ? "狼人" : "好人";
      scriptText += `\n\n（上帝視角）查驗結果：${r}\n請對預言家說：「他的身分是——${r}。」`;
    }

    if(step.key === "witch"){
      const wolf = State.night.wolfTarget;
      const wolfTxt = wolf ? `今晚被刀的是 ${wolf} 號。` : "今晚沒有狼刀目標。";
      scriptText += `\n${wolfTxt}`;

      if(!State.godView){
        scriptText += `\n\n（提示）請先切換到 🔓 上帝視角再操作女巫用藥。`;
      }else{
        scriptText += `\n\n解藥：${State.night.witchSaveUsed ? "已用過" : "可用"}；毒藥：${State.night.witchPoisonUsed ? "已用過" : "可用"}`;
        if(State.night.witchSave) scriptText += `\n✅ 已選擇使用解藥。`;
        if(State.night.witchPoisonTarget) scriptText += `\n☠️ 已選擇毒 ${State.night.witchPoisonTarget} 號。`;
      }
    }

    if(nightScript) nightScript.textContent = scriptText;

    // 座位點選
    renderSeatDots(nightSeats, (seat)=>{
      const s = currentStep();
      if(!s) return;

      if(s.type === "pick"){
        State.night[s.pick] = seat;
        if(typeof s.afterPick === "function") s.afterPick(seat);
      }

      saveState(State);
    });

    saveState(State);
  }

  function canNextNight(){
    const step = currentStep();
    if(!step) return false;

    if(step.type === "pick" && step.required){
      return !!State.night[step.pick];
    }
    return true;
  }

  function nightPrev(){
    State.selectedSeat = null;
    State.nightStepIndex = Math.max(0, State.nightStepIndex - 1);
    renderNightUI();
  }

  async function nightNext(){
    const step = currentStep();
    if(!step) return;

    // 防呆：狼刀未選不能過
    if(step.type === "pick" && step.required && !State.night[step.pick]){
      if(navigator.vibrate) navigator.vibrate([60,40,60]);
      return;
    }

    // 女巫：上帝視角用公告 modal 當面板
    if(step.key === "witch" && State.godView){
      openAnnouncementModal(true);
      return;
    }

    if(step.type === "resolve"){
      resolveNightAndAnnounce();
      return;
    }

    State.selectedSeat = null;
    State.nightStepIndex = Math.min(State.nightSteps.length - 1, State.nightStepIndex + 1);
    renderNightUI();
  }

  on($("btnNightPrev"), "click", nightPrev);
  on($("btnNightNext"), "click", ()=>{
    if(!canNextNight()) return;
    nightNext();
  });

  /* =========================================================
     Night Resolve + Announcement
  ========================================================= */
  function resolveNightAndAnnounce(){
    const deaths = new Set();

    const wolf = State.night.wolfTarget;
    const guard = State.night.guardTarget;
    const save = State.night.witchSave;
    const poison = State.night.witchPoisonTarget;

    if(wolf){
      if(wolf === guard){
        // 擋刀
      }else if(save){
        // 女巫救
      }else{
        deaths.add(wolf);
      }
    }
    if(poison) deaths.add(poison);

    const deadSeats = [...deaths].sort((a,b)=>a-b);
    deadSeats.forEach(seat=>{
      const p = State.players.find(x=>x.seat===seat);
      if(p) p.alive = false;
    });

    const publicText =
      deadSeats.length
        ? `天亮了。\n昨晚死亡的是：${deadSeats.join(" 號、")} 號。\n請依序發言／投票。`
        : `天亮了。\n昨晚是平安夜（沒有死亡）。\n請依序發言／投票。`;

    const hiddenLines = [];
    hiddenLines.push(`【第 ${State.nightNo} 夜｜隱藏紀錄】`);
    if(State.night.guardTarget) hiddenLines.push(`守衛守：${State.night.guardTarget} 號`);
    if(State.night.wolfTarget) hiddenLines.push(`狼人刀：${State.night.wolfTarget} 號`);
    if(State.night.seerCheckTarget){
      const r = State.night.seerResult === "wolf" ? "狼人" : "好人";
      hiddenLines.push(`預言查：${State.night.seerCheckTarget} 號 → ${r}`);
    }
    if(hasRole("witch")){
      hiddenLines.push(`女巫救：${State.night.witchSave ? "有" : "無"}（解藥${State.night.witchSaveUsed ? "已用過" : "未用"}）`);
      hiddenLines.push(`女巫毒：${State.night.witchPoisonTarget ? (State.night.witchPoisonTarget+" 號") : "無"}（毒藥${State.night.witchPoisonUsed ? "已用過" : "未用"}）`);
    }
    hiddenLines.push(`死亡結算：${deadSeats.length ? deadSeats.join(" 號、")+" 號" : "無"}`);

    const hiddenText = hiddenLines.join("\n");

    const logItem = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      ts: nowISO(),
      nightNo: State.nightNo,
      dayNo: State.dayNo,
      publicText,
      hiddenText,
      votes: null
    };
    State.logs.unshift(logItem);

    // 用藥鎖定
    if(State.night.witchSave) State.night.witchSaveUsed = true;
    if(State.night.witchPoisonTarget) State.night.witchPoisonUsed = true;

    // 進白天
    State.nightNo += 1;
    State.dayNo += 1;

    saveState(State);

    showScreen("day");

    // 天亮自動跳公告
    openAnnouncementModal(false, true);

    const dayTag = $("dayTag");
    if(dayTag) dayTag.textContent = `第 ${State.dayNo - 1} 天`;

    renderLogList();
  }

  /* =========================================================
     Announcement Center (📣)
  ========================================================= */
  const modalAnn = $("modalAnn");
  const annBox = $("annBox");
  let annMode = "today";  // today | history
  let annAsWitchPanel = false;

  function getTodayLog(){
    return State.logs[0] || null;
  }

  function renderAnnouncementBox(){
    if(!annBox) return;

    // 女巫操作面板（借用公告 modal）
    if(annAsWitchPanel){
      const step = currentStep();
      if(!step || step.key !== "witch"){
        annBox.textContent = "（女巫面板不可用）";
        return;
      }

      const wolf = State.night.wolfTarget;
      const canSave = hasRole("witch") && !State.night.witchSaveUsed && !!wolf;
      const canPoison = hasRole("witch") && !State.night.witchPoisonUsed;

      annBox.innerHTML = "";

      const t = document.createElement("div");
      t.style.whiteSpace = "pre-line";
      t.style.fontWeight = "1000";
      t.style.marginBottom = "10px";
      t.textContent =
        `【女巫操作】\n今晚被刀：${wolf ? wolf+" 號" : "（尚未選狼刀）"}\n\n解藥：${State.night.witchSaveUsed ? "已用過" : "可用"}\n毒藥：${State.night.witchPoisonUsed ? "已用過" : "可用"}`;
      annBox.appendChild(t);

      const area = document.createElement("div");
      area.style.display="flex";
      area.style.flexDirection="column";
      area.style.gap="10px";

      const row1 = document.createElement("div");
      row1.style.display="flex";
      row1.style.gap="10px";

      const btnSave = document.createElement("button");
      btnSave.className = "btn";
      btnSave.type="button";
      btnSave.textContent = State.night.witchSave ? "✅ 已使用解藥" : "用解藥救他";
      btnSave.disabled = !canSave;
      btnSave.onclick = ()=>{
        State.night.witchSave = !State.night.witchSave;
        saveState(State);
        renderAnnouncementBox();
        renderNightUI();
      };

      const btnNoSave = document.createElement("button");
      btnNoSave.className = "btn ghost";
      btnNoSave.type="button";
      btnNoSave.textContent = "不用解藥";
      btnNoSave.onclick = ()=>{
        State.night.witchSave = false;
        saveState(State);
        renderAnnouncementBox();
        renderNightUI();
      };

      row1.append(btnSave, btnNoSave);

      const row2 = document.createElement("div");
      row2.style.display="flex";
      row2.style.gap="10px";

      const btnPickPoison = document.createElement("button");
      btnPickPoison.className = "btn";
      btnPickPoison.type="button";
      btnPickPoison.textContent = State.night.witchPoisonTarget ? `☠️ 已毒 ${State.night.witchPoisonTarget} 號（改選）` : "用毒藥（點選座位）";
      btnPickPoison.disabled = !canPoison;
      btnPickPoison.onclick = ()=>{
        alert("請在下方『座位圓點』點選要毒的玩家（只能上帝視角操作）。");
        State._pickPoisonMode = true;
        saveState(State);
      };

      const btnNoPoison = document.createElement("button");
      btnNoPoison.className = "btn ghost";
      btnNoPoison.type="button";
      btnNoPoison.textContent = "不用毒藥";
      btnNoPoison.onclick = ()=>{
        State.night.witchPoisonTarget = null;
        State._pickPoisonMode = false;
        saveState(State);
        renderAnnouncementBox();
        renderNightUI();
      };

      row2.append(btnPickPoison, btnNoPoison);

      const done = document.createElement("button");
      done.className = "btn ghost";
      done.type="button";
      done.textContent = "完成女巫 → 回夜晚流程";
      done.onclick = ()=>{
        State._pickPoisonMode = false;
        annAsWitchPanel = false;
        modalAnn.classList.add("hidden");
        State.selectedSeat = null;
        State.nightStepIndex = Math.min(State.nightSteps.length - 1, State.nightStepIndex + 1);
        renderNightUI();
        saveState(State);
      };

      area.append(row1, row2, done);
      annBox.appendChild(area);

      const tip = document.createElement("div");
      tip.className = "hint";
      tip.style.marginTop = "10px";
      tip.textContent = "提示：毒藥會在天亮結算；解藥只能救狼刀那位。";
      annBox.appendChild(tip);

      return;
    }

    // 一般公告視圖
    const latest = getTodayLog();

    if(annMode === "today"){
      if(!latest){
        annBox.textContent = "（尚無公告）";
        return;
      }
      const pub = latest.publicText || "—";
      const hid = latest.hiddenText || "";
      annBox.textContent = State.godView ? (pub + "\n\n" + hid) : pub;
      return;
    }

    // history
    if(!State.logs.length){
      annBox.textContent = "（尚無歷史公告）";
      return;
    }

    const lines = [];
    State.logs.forEach((l, idx)=>{
      const head = `#${State.logs.length-idx}｜第${l.nightNo}夜 / 第${l.dayNo}天`;
      lines.push(head);
      lines.push(l.publicText || "—");
      if(State.godView && l.hiddenText){
        lines.push(l.hiddenText);
      }
      if(State.godView && l.votes){
        lines.push("【票型】");
        lines.push(formatVotes(l.votes));
      }
      lines.push("—");
    });
    annBox.textContent = lines.join("\n");
  }

  function openAnnouncementModal(asWitch=false, forceToday=false){
    annAsWitchPanel = !!asWitch;
    if(forceToday) annMode = "today";

    modalAnn.classList.remove("hidden");

    $("annToday")?.classList.toggle("active", annMode==="today");
    $("annHistory")?.classList.toggle("active", annMode==="history");

    renderAnnouncementBox();
  }

  on($("fabAnn"), "click", ()=> openAnnouncementModal(false, true));
  on($("btnOpenAnnouncement"), "click", ()=> openAnnouncementModal(false, true));
  on($("btnOpenAnnouncement2"), "click", ()=> openAnnouncementModal(false, true));

  on($("closeAnn"), "click", ()=>{
    annAsWitchPanel = false;
    State._pickPoisonMode = false;
    modalAnn.classList.add("hidden");
  });

  on($("annToday"), "click", ()=>{
    annMode = "today";
    $("annToday").classList.add("active");
    $("annHistory").classList.remove("active");
    renderAnnouncementBox();
  });
  on($("annHistory"), "click", ()=>{
    annMode = "history";
    $("annHistory").classList.add("active");
    $("annToday").classList.remove("active");
    renderAnnouncementBox();
  });

  on($("btnCopyAnn"), "click", async ()=>{
    try{
      const text = annBox?.textContent || "";
      await navigator.clipboard.writeText(text);
      if(navigator.vibrate) navigator.vibrate(40);
      alert("已複製");
    }catch(e){
      alert("複製失敗（可能需要 HTTPS 或 PWA 安裝後）");
    }
  });

  /* =========================================================
     Log / Replay modal
  ========================================================= */
  const modalLog = $("modalLog");
  const logList = $("logList");

  function renderLogList(){
    if(!logList) return;
    logList.innerHTML = "";

    if(!State.logs.length){
      logList.textContent = "—";
      return;
    }

    State.logs.forEach(l=>{
      const item = document.createElement("div");
      item.className = "logitem";

      const title = document.createElement("div");
      title.className = "logtitle";
      title.textContent = `第${l.nightNo}夜 / 第${l.dayNo}天｜${new Date(l.ts).toLocaleString()}`;

      const text = document.createElement("div");
      text.className = "logtext";
      text.textContent = State.godView ? (l.publicText + "\n\n" + (l.hiddenText||"")) : l.publicText;

      item.append(title, text);
      logList.appendChild(item);
    });
  }

  function openLogModal(){
    renderLogList();
    modalLog.classList.remove("hidden");
  }

  on($("btnOpenLog"), "click", openLogModal);
  on($("btnOpenLog2"), "click", openLogModal);
  on($("closeLog"), "click", ()=> modalLog.classList.add("hidden"));

  on($("btnClearSave"), "click", ()=>{
    if(confirm("確定清除整局存檔與紀錄？")){
      clearState();
      location.reload();
    }
  });

  /* =========================================================
     Export JSON (復盤)
  ========================================================= */
  function downloadJSON(filename, obj){
    const blob = new Blob([JSON.stringify(obj, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 500);
  }

  function exportReplay(){
    const payload = {
      meta: {
        exportedAt: nowISO(),
        app: "狼人殺｜上帝輔助 PWA",
        version: "mvp-1"
      },
      settings: {
        boardType: State.boardType,
        playerCount: State.playerCount,
        rolesCount: State.rolesCount
      },
      players: State.godView ? State.players : State.players.map(p=>({
        seat:p.seat, alive:p.alive, isChief:p.isChief
      })),
      logs: State.logs,
    };
    downloadJSON(`狼人殺復盤_${Date.now()}.json`, payload);
  }

  on($("btnExport"), "click", exportReplay);
  on($("btnExport2"), "click", exportReplay);

  /* =========================================================
     Day tools buttons (先做入口，避免卡住)
  ========================================================= */
  on($("btnPolice"), "click", ()=>{
    alert("✅ 下一步我會加入：上警名單 + 發言方向 + 下一位高亮。");
  });
  on($("btnTalkOrder"), "click", ()=>{
    alert("✅ 下一步我會加入：順/逆/隨機 發言順序 + 一鍵下一位。");
  });
  on($("btnVote"), "click", ()=>{
    alert("✅ 下一步我會加入：逐位投票（誰投誰）+ 統計 + 處刑 + 獵人開槍，並寫入公告/復盤。");
  });

  /* =========================================================
     Vote formatting (placeholder for next step)
  ========================================================= */
  function formatVotes(votes){
    const map = new Map();
    votes.forEach(v=>{
      const key = v.toSeat ? `${v.toSeat}號` : "棄票";
      map.set(key, (map.get(key)||0) + 1);
    });
    const lines = [];
    for(const [k, c] of map.entries()){
      lines.push(`${k}：${c} 票`);
    }
    lines.push("");
    votes.forEach(v=>{
      lines.push(`${v.fromSeat}號 → ${v.toSeat ? (v.toSeat+"號") : "棄票"}`);
    });
    return lines.join("\n");
  }

  /* =========================================================
     Menu button (暫用：快速入口)
  ========================================================= */
  on($("btnMenu"), "click", ()=>{
    openAnnouncementModal(false, true);
  });

  /* =========================================================
     Boot UI
  ========================================================= */
  function boot(){
    setGodView(!!State.godView);

    if(State.phase && Screens[State.phase]){
      showScreen(State.phase);
    }else{
      showScreen("setup");
    }

    if(State.phase === "deal") updateDealPrompt();

    if(State.phase === "night"){
      if(!State.nightSteps || !State.nightSteps.length){
        initNightWizard();
      }
      renderNightUI();
    }

    if(State.phase === "day"){
      const dayTag = $("dayTag");
      if(dayTag) dayTag.textContent = `第 ${State.dayNo} 天`;
    }

    syncSetupUI();
    renderLogList();
  }

  boot();

})();