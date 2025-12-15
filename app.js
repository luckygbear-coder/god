/* =========================================================
   狼人殺｜上帝輔助 PWA
   app.js（不依賴 ww.data.js｜自建資料中樞版）
========================================================= */

(() => {
  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);

  // ====== 防呆：把錯誤直接秀出來（避免按了沒反應）
  window.addEventListener("error", (e) => {
    alert("❌ JS 錯誤：" + (e?.message || "unknown"));
  });
  window.addEventListener("unhandledrejection", (e) => {
    alert("❌ Promise 錯誤：" + (e?.reason?.message || e?.reason || "unknown"));
  });

  // ====== iOS 防長按選字/放大/選單
  try {
    document.documentElement.style.webkitUserSelect = "none";
    document.documentElement.style.userSelect = "none";
    document.documentElement.style.webkitTouchCallout = "none";
    document.body && (document.body.style.webkitUserSelect = "none");
    document.body && (document.body.style.userSelect = "none");
  } catch (e) {}
  on(document, "contextmenu", (e) => e.preventDefault(), { passive: false });
  on(document, "selectstart", (e) => e.preventDefault(), { passive: false });
  on(document, "gesturestart", (e) => e.preventDefault(), { passive: false });

  function stopTextSelectOnTouch(el) {
    if (!el) return;
    el.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
  }

  // ====== State
  const STORAGE_KEY = "ww_save_apphub_v1";
  const State = {
    phase: "setup",
    boardId: "basic",
    playerCount: 9,
    rolesCount: null,
    players: [],
    dealIndex: 0,

    nightNo: 1,
    dayNo: 1,

    godView: false,

    nightState: {},
    nightSteps: [],
    nightStepIndex: 0,

    logs: [],

    witch: { saveUsed:false, poisonUsed:false, save:false, poisonTarget:null },

    settings: {
      noConsecutiveGuard: true,
      wolfCanNoKill: true,
      witchCannotSelfSave: true,
      hunterPoisonNoShoot: true,
      blackWolfKingPoisonNoSkill: true,
    }
  };

  function save(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(State)); }catch(e){} }
  function load(){ try{ const s=JSON.parse(localStorage.getItem(STORAGE_KEY)); if(s&&s.players) Object.assign(State,s);}catch(e){} }
  function clearSave(){ try{ localStorage.removeItem(STORAGE_KEY);}catch(e){} }

  function showScreen(name){
    document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
    $(`screen-${name}`)?.classList.add("active");
    State.phase = name;
    save();
  }

  // =========================================================
  // ✅ AppHub：不用 ww.data.js，自己整合 window.WW_* 全域
  // =========================================================
  const AppHub = (() => {
    const warn = (m) => console.warn("⚠️ AppHub:", m);

    const roles = Object.assign(
      {},
      window.WW_ROLES_BASE || {},
      window.WW_ROLES_B1 || {},
      window.WW_ROLES_ALL || {}
    );

    const boards = window.WW_BOARDS || null;

    const nightStepsBasic = window.WW_NIGHT_STEPS_BASIC || null;
    const nightStepsB1 = window.WW_NIGHT_STEPS_B1 || null;

    const rulesBasic = window.WW_RULES_BASIC || null;
    const rulesB1 = window.WW_RULES_B1 || null;

    function getRole(roleId){
      return roles?.[roleId] || { id: roleId, name: roleId, icon:"❔", team:"villager" };
    }

    function getBundle(boardId){
      if(!boards || !boards[boardId]){
        warn(`boards 缺少或找不到 boardId=${boardId}`);
        return { board:null, rules:null, nightSteps:null };
      }
      const board = boards[boardId];
      const isB1 = (boardId === "b1") || (board.rules === "b1") || (board.nightSteps === "b1");

      const rules = isB1 ? rulesB1 : rulesBasic;
      const nightSteps = isB1 ? nightStepsB1 : nightStepsBasic;

      return { board, rules, nightSteps };
    }

    function health(){
      return {
        roles: Object.keys(roles||{}).length,
        boards: boards ? Object.keys(boards).length : 0,
        nightSteps: {
          basic: Array.isArray(nightStepsBasic) ? nightStepsBasic.length : 0,
          b1: Array.isArray(nightStepsB1) ? nightStepsB1.length : 0,
        },
        rules: {
          basic: !!rulesBasic,
          b1: !!rulesB1,
        }
      };
    }

    console.log("✅ AppHub ready", health());
    return { getRole, getBundle, health };
  })();

  // =========================
  // Setup 建議配置
  // =========================
  function rolesTotal(map){
    return Object.values(map || {}).reduce((a,b)=>a+(Number(b)||0),0);
  }
  function suggestBasic(n){
    const wolves = n >= 10 ? 3 : (n >= 8 ? 2 : 2);
    const fixed = 3;
    const villager = Math.max(0, n - wolves - fixed);
    return { werewolf:wolves, villager, seer:1, witch:1, hunter:1 };
  }
  function suggestB1(n){
    const base = { villager:0, werewolf:0, seer:1, witch:1, hunter:1, guard:1, knight:1, blackWolfKing:1, whiteWolfKing:1 };
    const wolves = n >= 11 ? 3 : 2;
    base.werewolf = Math.max(0, wolves - 2);
    const fixed = Object.values(base).reduce((a,b)=>a+b,0);
    base.villager = Math.max(0, n - fixed);
    return base;
  }

  function getSuggested(boardId, n){
    const bundle = AppHub.getBundle(boardId);
    const preset = bundle?.board?.presets?.[n];
    if (preset && typeof preset === "object") return structuredClone(preset);
    return boardId === "b1" ? suggestB1(n) : suggestBasic(n);
  }

  function syncSetupUI(){
    $("playerCount") && ($("playerCount").textContent = String(State.playerCount));
    $("playerTotal") && ($("playerTotal").textContent = String(State.playerCount));

    const total = rolesTotal(State.rolesCount);
    $("roleTotal") && ($("roleTotal").textContent = String(total));
    const ok = total === State.playerCount;
    $("warnRoleTotal")?.classList.toggle("hidden", ok);

    const btnStart = $("btnStart");
    if(btnStart){
      btnStart.disabled = !ok;
      btnStart.textContent = ok ? "開始 → 抽身分" : "⚠️ 角色總數需等於玩家數";
    }
    save();
  }

  function setBoard(boardId){
    State.boardId = boardId;
    $("boardBasic")?.classList.toggle("active", boardId==="basic");
    $("boardSpecial")?.classList.toggle("active", boardId==="b1");
    State.rolesCount = getSuggested(boardId, State.playerCount);
    syncSetupUI();
  }

  function setPlayerCount(n){
    const v = Math.max(6, Math.min(12, Number(n)||9));
    State.playerCount = v;
    $("rangeCount") && ($("rangeCount").value = String(v));
    State.rolesCount = getSuggested(State.boardId, v);
    syncSetupUI();
  }

  // =========================
  // Players
  // =========================
  function shuffle(arr){
    for(let i=arr.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }

  function buildPlayers(){
    const rolesArr = [];
    for(const [rid,cnt] of Object.entries(State.rolesCount||{})){
      for(let i=0;i<(Number(cnt)||0);i++) rolesArr.push(rid);
    }
    shuffle(rolesArr);

    State.players = rolesArr.map((rid, idx) => {
      const r = AppHub.getRole(rid);
      return {
        seat: idx+1,
        roleId: rid,
        name: r.name || rid,
        icon: r.icon || "❔",
        team: r.team || "villager",
        alive: true
      };
    });

    State.dealIndex = 0;
    State.nightNo = 1;
    State.dayNo = 1;
    State.logs = [];
    State.nightState = {};
    State.nightSteps = [];
    State.nightStepIndex = 0;
    State.witch.save = false;
    State.witch.poisonTarget = null;
    save();
  }

  // =========================
  // Deal（長按翻牌 + 座位回看）
  // =========================
  let _dealHoldTimer = null;

  function renderDealSeatGrid(){
    const grid = $("dealSeatGrid");
    if(!grid) return;
    grid.innerHTML = "";
    State.players.forEach((p, idx) => {
      const b = document.createElement("button");
      b.type="button";
      b.className="seat" + (idx===State.dealIndex ? " selected":"");
      b.textContent=String(p.seat);
      stopTextSelectOnTouch(b);
      b.onclick=()=>{ State.dealIndex=idx; save(); renderDeal(); };
      grid.appendChild(b);
    });
  }

  function showReveal(){
    const p = State.players[State.dealIndex];
    if(!p) return;
    $("revealRole") && ($("revealRole").textContent = `${p.icon} ${p.name}`);
    $("modalReveal")?.classList.remove("hidden");
    navigator.vibrate?.(60);
  }
  function hideReveal(){ $("modalReveal")?.classList.add("hidden"); }

  function renderDeal(){
    const p = State.players[State.dealIndex];
    if(!p) return;
    $("dealText") && ($("dealText").innerHTML = `請 <b>${p.seat} 號</b> 拿手機`);
    renderDealSeatGrid();

    const btn = $("btnHoldReveal");
    if(!btn) return;
    stopTextSelectOnTouch(btn);

    btn.onpointerdown = (e)=>{
      e.preventDefault?.();
      clearTimeout(_dealHoldTimer);
      _dealHoldTimer = setTimeout(showReveal, 900);
    };
    const end = (e)=>{
      e?.preventDefault?.();
      clearTimeout(_dealHoldTimer);
      hideReveal();
    };
    btn.onpointerup = end;
    btn.onpointercancel = end;
    btn.onpointerleave = end;
  }

  function nextDeal(){
    State.dealIndex++;
    if(State.dealIndex >= State.players.length){
      State.dealIndex = State.players.length - 1;
      renderDeal();
      navigator.vibrate?.([60,40,60]);
      return;
    }
    save();
    renderDeal();
  }

  // =========================
  // Night steps（沒有就 fallback）
  // =========================
  function hasRole(roleId){ return State.players.some(p=>p.roleId===roleId); }

  function buildFallbackNightSteps(){
    const steps = [];
    steps.push({ type:"info", publicScript:"天黑請閉眼。", godScript:"天黑請閉眼。" });

    if(hasRole("guard")){
      steps.push({ type:"pick", pickKey:"guardTarget", required:true, publicScript:"守衛請睜眼，請守一位玩家。", godScript:"守衛守誰？（點座位）" });
    }

    steps.push({
      type:"pick",
      pickKey:"wolfTarget",
      required: !State.settings.wolfCanNoKill,
      allowNull: !!State.settings.wolfCanNoKill,
      publicScript: State.settings.wolfCanNoKill ? "狼人請睜眼（可空刀），請選擇目標。" : "狼人請睜眼，請選擇目標。",
      godScript: State.settings.wolfCanNoKill ? "狼人刀誰？（可不選=空刀）" : "狼人刀誰？（必選）"
    });

    if(hasRole("seer")){
      steps.push({ type:"pick", pickKey:"seerCheck", required:true, publicScript:"預言家請睜眼，請查驗一位玩家。", godScript:"預言家查誰？（點座位）" });
    }

    if(hasRole("witch")){
      steps.push({ type:"witch", publicScript:"女巫請睜眼（上帝操作）。", godScript:"女巫回合：請操作救/毒。" });
    }

    steps.push({ type:"resolve", publicScript:"天亮請睜眼。", godScript:"天亮：結算夜晚並公告。" });
    return steps;
  }

  function resolveNightSteps(){
    const bundle = AppHub.getBundle(State.boardId);
    let steps = bundle?.nightSteps;

    if(typeof steps === "function"){
      try{ steps = steps(State.players, State.nightState); }catch(e){ steps=null; }
    }

    if(!Array.isArray(steps) || steps.length===0){
      steps = buildFallbackNightSteps();
    }

    State.nightSteps = steps;
    State.nightStepIndex = 0;
    save();
  }

  function renderSeats(containerId, onPick, selectedSeat=null){
    const box = $(containerId);
    if(!box) return;
    box.innerHTML = "";
    State.players.forEach(p=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="seat" + (p.alive ? "" : " dead") + (selectedSeat===p.seat ? " selected":"");
      b.textContent=String(p.seat);
      b.disabled=!p.alive;
      stopTextSelectOnTouch(b);
      b.onclick=()=>{ if(p.alive) onPick?.(p.seat); };
      box.appendChild(b);
    });
  }

  function currentNightStep(){ return State.nightSteps?.[State.nightStepIndex] || null; }

  function renderNight(){
    $("nightTag") && ($("nightTag").textContent = `第 ${State.nightNo} 夜`);

    if(!State.nightSteps || State.nightSteps.length===0){
      resolveNightSteps();
    }

    const step = currentNightStep();
    if(!step){
      $("nightScript") && ($("nightScript").textContent = "（夜晚流程結束）");
      return;
    }

    const script = State.godView ? (step.godScript || step.publicScript) : (step.publicScript || step.godScript);
    $("nightScript") && ($("nightScript").textContent = script || "（無台詞）");

    renderSeats("nightSeats", (seat)=>{
      if(step.type==="pick" && step.pickKey){
        State.nightState[step.pickKey] = seat;
        save();
        renderNight();
      }
    }, step.pickKey ? State.nightState[step.pickKey] : null);
  }

  function canNext(step){
    if(step?.type==="pick" && step.required && step.pickKey){
      if(step.allowNull) return true;
      return !!State.nightState[step.pickKey];
    }
    return true;
  }

  function openWitch(){
    $("modalWitch")?.classList.remove("hidden");
    renderWitch();
  }

  function renderWitch(){
    const knifeSeat = State.nightState.wolfTarget || null;
    const saveUsed = !!State.witch.saveUsed;
    const poisonUsed = !!State.witch.poisonUsed;
    const showKnife = !saveUsed;

    $("witchKnife") && ($("witchKnife").innerHTML =
      showKnife ? (knifeSeat ? `${knifeSeat} 號` : "（狼人尚未選刀）") : "（解藥已用過，不提供刀口）"
    );

    $("witchStatus") && ($("witchStatus").textContent =
      `解藥：${saveUsed ? "已用過" : "可用"}｜毒藥：${poisonUsed ? "已用過" : "可用"}${State.witch.poisonTarget ? `｜已毒：${State.witch.poisonTarget}號` : ""}`
    );

    const btnSave = $("btnWitchSave");
    if(btnSave){
      btnSave.disabled = saveUsed || !showKnife || !knifeSeat;
      btnSave.textContent = State.witch.save ? "✅ 已選擇用解藥" : "用解藥救";
    }
    $("btnWitchNoSave") && ($("btnWitchNoSave").disabled = !showKnife);

    const btnPick = $("btnWitchPoisonPick");
    if(btnPick){
      btnPick.disabled = poisonUsed;
      btnPick.textContent = State.witch.poisonTarget ? `☠️ 已毒 ${State.witch.poisonTarget} 號（改選）` : "用毒藥（回座位圈點人）";
    }
  }

  function nightPrev(){
    State.nightStepIndex = Math.max(0, State.nightStepIndex-1);
    save();
    renderNight();
  }

  function resolveNight(){
    const bundle = AppHub.getBundle(State.boardId);
    const rules = bundle?.rules || null;

    // 把女巫選擇寫回 nightState
    State.nightState.witchSave = !!State.witch.save;
    State.nightState.witchPoisonTarget = State.witch.poisonTarget || null;

    let publicText = "";
    let hiddenText = "";

    if(rules?.resolveNight && rules?.buildAnnouncement){
      try{
        const resolved = rules.resolveNight({
          players: State.players,
          night: State.nightState,
          settings: State.settings
        });

        const ann = rules.buildAnnouncement({
          nightNo: State.nightNo,
          dayNo: State.dayNo,
          players: State.players,
          night: State.nightState,
          resolved,
          settings: State.settings
        });

        publicText = ann?.publicText || "（公告產生失敗）";
        hiddenText = ann?.hiddenText || "";
      }catch(e){
        console.warn(e);
        publicText = "（rules 結算失敗，已用簡化公告）";
        hiddenText = State.godView ? String(e) : "";
      }
    }else{
      publicText = "天亮了。（目前未接上完整 rules，暫不結算死亡）";
      hiddenText = State.godView ? `nightState=${JSON.stringify(State.nightState)}` : "";
    }

    if(State.witch.save) State.witch.saveUsed = true;
    if(State.witch.poisonTarget) State.witch.poisonUsed = true;

    State.logs.unshift({
      nightNo: State.nightNo,
      dayNo: State.dayNo,
      publicText,
      hiddenText,
      ts: new Date().toISOString()
    });

    save();
    showScreen("day");
    renderDayAlive();
    openAnnouncement(true);
  }

  function nightNext(){
    const step = currentNightStep();
    if(!step) return;

    if(!canNext(step)){
      navigator.vibrate?.([60,40,60]);
      return;
    }

    if(step.type==="witch"){
      if(!State.godView){
        alert("需要切換 🔓 上帝視角 才能操作女巫");
        return;
      }
      openWitch();
      return;
    }

    if(step.type==="resolve"){
      resolveNight();
      return;
    }

    State.nightStepIndex = Math.min(State.nightSteps.length-1, State.nightStepIndex+1);
    save();
    renderNight();
  }

  // =========================
  // Announcement
  // =========================
  let annMode = "today";

  function renderAnnouncement(){
    const box = $("annBox");
    if(!box) return;

    if(!State.logs.length){
      box.textContent = "（尚無公告）";
      return;
    }
    if(annMode==="today"){
      const l = State.logs[0];
      box.textContent = State.godView ? (l.publicText + "\n\n" + (l.hiddenText||"")) : l.publicText;
      return;
    }
    const lines = [];
    State.logs.forEach((l, idx)=>{
      lines.push(`#${State.logs.length-idx}｜第${l.nightNo}夜 / 第${l.dayNo}天`);
      lines.push(l.publicText||"—");
      if(State.godView && l.hiddenText) lines.push(l.hiddenText);
      lines.push("—");
    });
    box.textContent = lines.join("\n");
  }

  function openAnnouncement(forceToday=false){
    if(forceToday) annMode="today";
    $("modalAnn")?.classList.remove("hidden");
    $("annToday")?.classList.toggle("active", annMode==="today");
    $("annHistory")?.classList.toggle("active", annMode==="history");
    renderAnnouncement();
  }

  function renderDayAlive(){
    const el = $("dayAlive");
    if(!el) return;
    const alive = State.players.filter(p=>p.alive).map(p=>p.seat);
    el.textContent = alive.length ? `存活：${alive.join("、")} 號` : "（全滅？）";
  }

  function nextDayToNight(){
    State.nightNo += 1;
    State.dayNo += 1;
    State.nightState = {};
    State.nightStepIndex = 0;
    State.witch.save = false;
    State.witch.poisonTarget = null;
    resolveNightSteps();
    save();
    showScreen("night");
    renderNight();
  }

  function setGod(flag){
    State.godView = !!flag;
    document.body.classList.toggle("god-on", State.godView);
    $("btnGodToggle") && ($("btnGodToggle").textContent = State.godView ? "🔓" : "🔒");
    $("fabGod") && ($("fabGod").textContent = State.godView ? "🔓" : "🔒");
    save();
    renderAnnouncement();
    renderNight();
  }
  function toggleGod(){ setGod(!State.godView); }

  function ensureRestartButton(){
    if($("btnRestart")) return;
    const host = document.querySelector(".top-actions");
    if(!host) return;
    const b = document.createElement("button");
    b.id="btnRestart";
    b.className="iconbtn";
    b.type="button";
    b.title="重新開始";
    b.textContent="🔁";
    b.onclick=()=>{
      if(!confirm("確定要重新開始？所有進度會清除並回到開局設定。")) return;
      clearSave();
      location.reload();
    };
    host.insertBefore(b, host.firstChild);
  }

  // =========================
  // Start game
  // =========================
  function startGame(){
    // ✅ 一按就有反應（方便你確認事件有沒有綁到）
    console.log("▶ btnStart clicked");

    if(!State.rolesCount) State.rolesCount = getSuggested(State.boardId, State.playerCount);

    if(rolesTotal(State.rolesCount) !== State.playerCount){
      alert("⚠️ 角色總數必須等於玩家人數");
      return;
    }

    buildPlayers();
    showScreen("deal");
    renderDeal();
  }

  // =========================
  // Bind events
  // =========================
  function bind(){
    ensureRestartButton();

    on($("boardBasic"), "click", () => setBoard("basic"));
    on($("boardSpecial"), "click", () => setBoard("b1"));

    on($("btnMinus"), "click", () => setPlayerCount(State.playerCount-1));
    on($("btnPlus"), "click", () => setPlayerCount(State.playerCount+1));
    on($("rangeCount"), "input", (e) => setPlayerCount(e.target.value));

    // ⭐ 你說「按開始沒反應」：這邊一定要綁到
    const btnStart = $("btnStart");
    if(btnStart){
      on(btnStart, "click", startGame);
      stopTextSelectOnTouch(btnStart);
    }else{
      alert("❌ 找不到 btnStart（請確認 index.html 有 id=btnStart）");
    }

    on($("btnNextPlayer"), "click", nextDeal);

    on($("btnFinishDeal"), "click", () => $("modalDealConfirm")?.classList.remove("hidden"));
    on($("dealConfirmNo"), "click", () => $("modalDealConfirm")?.classList.add("hidden"));
    on($("dealConfirmYes"), "click", () => {
      $("modalDealConfirm")?.classList.add("hidden");
      resolveNightSteps();
      showScreen("night");
      renderNight();
    });

    on($("btnDealBack"), "click", () => showScreen("setup"));

    on($("btnNightPrev"), "click", nightPrev);
    on($("btnNightNext"), "click", nightNext);

    on($("btnDayNext"), "click", nextDayToNight);

    on($("btnGodToggle"), "click", toggleGod);
    on($("fabGod"), "click", toggleGod);

    on($("btnOpenAnnouncement"), "click", () => openAnnouncement(true));
    on($("fabAnn"), "click", () => openAnnouncement(true));
    on($("closeAnn"), "click", () => $("modalAnn")?.classList.add("hidden"));
    on($("annToday"), "click", () => { annMode="today"; renderAnnouncement(); $("annToday")?.classList.add("active"); $("annHistory")?.classList.remove("active"); });
    on($("annHistory"), "click", () => { annMode="history"; renderAnnouncement(); $("annHistory")?.classList.add("active"); $("annToday")?.classList.remove("active"); });

    // 女巫
    on($("btnWitchSave"), "click", () => { State.witch.save = true; save(); renderWitch(); });
    on($("btnWitchNoSave"), "click", () => { State.witch.save = false; save(); renderWitch(); });
    on($("btnWitchPoisonPick"), "click", () => { alert("請關閉女巫視窗後，在座位圈點要毒的人"); $("modalWitch")?.classList.add("hidden"); State._pickPoison = true; });
    on($("btnWitchNoPoison"), "click", () => { State.witch.poisonTarget = null; save(); renderWitch(); });
    on($("btnWitchDone"), "click", () => { $("modalWitch")?.classList.add("hidden"); State._pickPoison=false; State.nightStepIndex = Math.min(State.nightSteps.length-1, State.nightStepIndex+1); save(); renderNight(); });

    // 座位圈點毒（簡化）
    on($("nightSeats"), "click", (e) => {
      if(!State._pickPoison) return;
      const btn = e.target.closest("button.seat");
      if(!btn) return;
      const seat = Number(btn.textContent);
      if(!seat) return;
      State.witch.poisonTarget = seat;
      State._pickPoison = false;
      save();
      alert(`已選毒：${seat} 號（回女巫視窗確認）`);
      $("modalWitch")?.classList.remove("hidden");
      renderWitch();
      renderNight();
    });
  }

  // =========================
  // Boot
  // =========================
  load();
  ensureRestartButton();
  setGod(State.godView);

  // 初始化建議配置
  if(!State.rolesCount) State.rolesCount = getSuggested(State.boardId, State.playerCount);
  syncSetupUI();

  bind();
  showScreen(State.phase || "setup");
})();