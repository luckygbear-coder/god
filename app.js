/* =========================================================
   狼人殺｜上帝輔助（單機穩定測試版）
   ✅ 守衛死後不能守（仍保留口述）
   ✅ 獵人被放逐後：必出現「是否開槍」（被毒禁用）
   ✅ 公告可捲動
   ✅ 屠邊/屠城達成：立即跳遊戲結束
========================================================= */

(() => {
  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);

  /* iOS：防長按選字/選單/雙擊放大 */
  try {
    document.documentElement.style.webkitUserSelect = "none";
    document.documentElement.style.userSelect = "none";
    document.documentElement.style.webkitTouchCallout = "none";
    if (document.body) {
      document.body.style.webkitUserSelect = "none";
      document.body.style.userSelect = "none";
    }
  } catch {}
  on(document, "contextmenu", (e) => e.preventDefault(), { passive:false });
  on(document, "selectstart", (e) => e.preventDefault(), { passive:false });
  on(document, "gesturestart", (e) => e.preventDefault(), { passive:false });

  let _lastTouchEnd = 0;
  on(document, "touchend", (e) => {
    const now = Date.now();
    if (now - _lastTouchEnd <= 300) e.preventDefault();
    _lastTouchEnd = now;
  }, { passive:false });

  function stopSelect(el){
    if(!el) return;
    el.addEventListener("touchstart", (e)=>e.preventDefault(), {passive:false});
  }

  /* ---------------------------
     基礎資料（先讓你能測）
  --------------------------- */
  const ROLES = {
    villager: { id:"villager", name:"平民", icon:"🙂", team:"good", type:"citizen" },
    werewolf: { id:"werewolf", name:"狼人", icon:"🐺", team:"wolf", type:"wolf" },
    seer:     { id:"seer", name:"預言家", icon:"🔮", team:"good", type:"god", nightly:true },
    witch:    { id:"witch", name:"女巫", icon:"🧪", team:"good", type:"god", nightly:true },
    hunter:   { id:"hunter", name:"獵人", icon:"🏹", team:"good", type:"god" },
    guard:    { id:"guard", name:"守衛", icon:"🛡️", team:"good", type:"god", nightly:true },
    idiot:    { id:"idiot", name:"白痴（算神）", icon:"🤪", team:"good", type:"god" },
    blackWolfKing: { id:"blackWolfKing", name:"黑狼王（狼槍）", icon:"🐺🔫", team:"wolf", type:"wolf" },
    whiteWolfKing: { id:"whiteWolfKing", name:"白狼王", icon:"🐺💣", team:"wolf", type:"wolf" },
    wolfKing: { id:"wolfKing", name:"狼王", icon:"🐺👑", team:"wolf", type:"wolf" },
  };

  // 官方 12：4狼 + 預女獵 + 守衛/白痴擇一 + 4民
  function defaultRolesCount() {
    return {
      werewolf: 4,
      seer: 1,
      witch: 1,
      hunter: 1,
      guard: 1,     // 你可在角色視窗把 guard 改 0，idiot 改 1
      idiot: 0,
      villager: 4,
    };
  }

  /* ---------------------------
     狀態
  --------------------------- */
  const KEY = "ww_offline_test_v1";
  const State = {
    phase: "setup", // setup | deal | night | day
    playerCount: 12,
    rolesCount: defaultRolesCount(),
    players: [],
    dealIndex: 0,

    nightNo: 1,
    dayNo: 1,

    godView: false,

    // 規則設定
    settings: {
      hasPolice: true,
      winMode: "edge", // edge | city
      noConsecutiveGuard: true,
      wolfCanNoKill: true,
      witchCannotSelfSave: true,
    },

    // 夜晚操作
    nightStepIndex: 0,
    night: {
      guardTarget: null,
      guardPrev: null,
      wolfTarget: null,
      seerCheck: null,
      witchSave: false,
      witchPoison: null,

      // 女巫消耗（永久）
      witchSaveUsed: false,
      witchPoisonUsed: false,

      // 被毒資訊（用於禁用技能）
      poisonedSeats: [], // 當晚毒死誰（用於獵人/黑狼王技能禁用）
    },

    logs: [],

    // 白天投票
    day: {
      mode: "mark",       // mark | vote
      voteTarget: null,   // 本輪投票指向
      voteRound: 1,       // 1=正常投票，2=PK投票（平票名單）
      pkList: null,       // [seat, seat]
    },

    ended: false,
  };

  function save(){ try{ localStorage.setItem(KEY, JSON.stringify(State)); }catch{} }
  function load(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return;
      const s = JSON.parse(raw);
      if(s && typeof s==="object") Object.assign(State, s);
    }catch{}
  }
  function resetAll(){
    localStorage.removeItem(KEY);
    location.reload();
  }

  /* ---------------------------
     小工具
  --------------------------- */
  const clamp = (n,a,b)=> Math.max(a, Math.min(b, n));
  const deepClone = (obj)=> JSON.parse(JSON.stringify(obj));
  const roleOf = (roleId)=> ROLES[roleId] || {id:roleId,name:roleId,icon:"❔",team:"good",type:"citizen"};
  const playerBySeat = (seat)=> State.players.find(p=>p.seat===seat) || null;
  const alivePlayers = ()=> State.players.filter(p=>p.alive);
  const aliveSeats = ()=> alivePlayers().map(p=>p.seat);
  const isAliveSeat = (seat)=> !!playerBySeat(seat)?.alive;

  function showScreen(name){
    document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
    $(`screen-${name}`)?.classList.add("active");
    State.phase = name;
    save();
  }

  function setGod(onFlag){
    State.godView = !!onFlag;
    $("btnGodToggle").textContent = State.godView ? "🔓" : "🔒";
    $("fabGod").textContent = State.godView ? "🔓" : "🔒";
    document.body.classList.toggle("god-on", State.godView);
    renderDaySeats();
    save();
  }

  function roleTotal(map){
    return Object.values(map||{}).reduce((a,b)=>a+(Number(b)||0),0);
  }

  function buildRoleSummary(){
    const entries = Object.entries(State.rolesCount)
      .filter(([,c])=>Number(c)>0)
      .map(([rid,c])=> `${roleOf(rid).icon}${roleOf(rid).name}×${c}`);
    return entries.join("、");
  }

  /* ---------------------------
     Setup
  --------------------------- */
  function syncSetup(){
    $("playerCount").textContent = String(State.playerCount);
    const total = roleTotal(State.rolesCount);
    $("roleSummary").textContent = buildRoleSummary();
    const ok = total === State.playerCount;
    $("warnRoleTotal").classList.toggle("hidden", ok);
    $("btnStart").disabled = !ok;
  }

  function incPlayer(delta){
    // 此測試版固定 12：先鎖死避免你流程分支爆炸
    State.playerCount = 12;
    $("playerCount").textContent = "12";
    syncSetup();
    save();
  }

  function applySettingsFromUI(){
    State.settings.hasPolice = !!$("optHasPolice").checked;
    State.settings.winMode = $("optWinModeEdge").checked ? "edge" : "city";
    State.settings.noConsecutiveGuard = !!$("optNoConsecutiveGuard").checked;
    State.settings.wolfCanNoKill = !!$("optWolfCanNoKill").checked;
    State.settings.witchCannotSelfSave = !!$("optWitchCannotSelfSave").checked;
    save();
  }

  /* ---------------------------
     Role Config Modal
  --------------------------- */
  function openRoleConfig(){
    const body = $("roleConfigBody");
    body.innerHTML = "";

    const ids = Object.keys(ROLES);
    const priority = ["werewolf","blackWolfKing","whiteWolfKing","wolfKing","seer","witch","hunter","guard","idiot","villager"];
    const ordered = Array.from(new Set([...priority, ...ids]));

    const tip = document.createElement("div");
    tip.className = "hint";
    tip.textContent = "提示：官方 12 先建議「4狼 + 預女獵 + 守衛/白痴擇一 + 4民」。角色總數需等於玩家數才能開始。";
    body.appendChild(tip);

    ordered.forEach(rid=>{
      const info = roleOf(rid);

      const row = document.createElement("div");
      row.className = "role-row";

      const left = document.createElement("div");
      left.className = "role-left";
      left.textContent = `${info.icon} ${info.name}`;

      const right = document.createElement("div");
      right.className = "role-right";

      const minus = document.createElement("button");
      minus.type = "button";
      minus.className = "btn ghost";
      minus.textContent = "－";

      const num = document.createElement("div");
      num.className = "role-num";
      num.textContent = String(State.rolesCount[rid] ?? 0);

      const plus = document.createElement("button");
      plus.type = "button";
      plus.className = "btn ghost";
      plus.textContent = "＋";

      stopSelect(minus); stopSelect(plus);

      minus.onclick = () => {
        State.rolesCount[rid] = Math.max(0, (State.rolesCount[rid]||0) - 1);
        num.textContent = String(State.rolesCount[rid]);
        syncSetup(); save();
      };
      plus.onclick = () => {
        State.rolesCount[rid] = (State.rolesCount[rid]||0) + 1;
        num.textContent = String(State.rolesCount[rid]);
        syncSetup(); save();
      };

      right.append(minus, num, plus);
      row.append(left, right);
      body.appendChild(row);
    });

    $("modalRole").classList.remove("hidden");
  }

  function closeRoleConfig(){ $("modalRole").classList.add("hidden"); }

  function resetRoleConfig(){
    State.rolesCount = defaultRolesCount();
    syncSetup();
    save();
    openRoleConfig(); // 重新渲染
  }

  /* ---------------------------
     Deal
  --------------------------- */
  function shuffle(arr){
    for(let i=arr.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }

  function buildPlayers(){
    const list = [];
    for (const [rid,c] of Object.entries(State.rolesCount)) {
      for (let i=0;i<(Number(c)||0);i++) list.push(rid);
    }
    shuffle(list);
    State.players = list.map((rid, idx)=>{
      const r = roleOf(rid);
      return { seat: idx+1, roleId: rid, alive:true, icon:r.icon, name:r.name, team:r.team, meta:{} };
    });
    State.dealIndex = 0;

    // reset game core
    State.nightNo = 1;
    State.dayNo = 1;
    State.ended = false;
    State.logs = [];

    State.nightStepIndex = 0;
    State.night.guardTarget = null;
    State.night.guardPrev = null;
    State.night.wolfTarget = null;
    State.night.seerCheck = null;
    State.night.witchSave = false;
    State.night.witchPoison = null;
    State.night.poisonedSeats = [];
    // 女巫永久消耗不重置？新局要重置
    State.night.witchSaveUsed = false;
    State.night.witchPoisonUsed = false;

    State.day.mode = "mark";
    State.day.voteTarget = null;
    State.day.voteRound = 1;
    State.day.pkList = null;

    save();
  }

  let holdTimer = null;

  function renderDealSeatGrid(){
    const grid = $("dealSeatGrid");
    grid.innerHTML = "";
    State.players.forEach((p, idx)=>{
      const b = document.createElement("button");
      b.type="button";
      b.className = "seat" + (idx===State.dealIndex ? " selected": "");
      b.textContent = String(p.seat);
      stopSelect(b);
      b.onclick = () => { State.dealIndex = idx; save(); renderDeal(); };
      grid.appendChild(b);
    });
  }

  function renderDeal(){
    const p = State.players[State.dealIndex];
    if(!p) return;

    $("dealText").innerHTML = `請 <b>${p.seat} 號</b> 拿手機`;
    renderDealSeatGrid();

    const btn = $("btnHoldReveal");
    stopSelect(btn);

    btn.onpointerdown = (e)=>{
      e.preventDefault?.();
      clearTimeout(holdTimer);
      holdTimer = setTimeout(()=>{
        $("revealRole").textContent = `${p.icon} ${p.name}`;
        $("modalReveal").classList.remove("hidden");
        navigator.vibrate?.(40);
      }, 900);
    };
    const end = (e)=>{
      e && e.preventDefault?.();
      clearTimeout(holdTimer);
      $("modalReveal").classList.add("hidden");
    };
    btn.onpointerup = end;
    btn.onpointercancel = end;
    btn.onpointerleave = end;
  }

  function nextPlayerDeal(){
    State.dealIndex = Math.min(State.players.length-1, State.dealIndex+1);
    save(); renderDeal();
  }

  function openDealConfirm(){ $("modalDealConfirm").classList.remove("hidden"); }
  function closeDealConfirm(){ $("modalDealConfirm").classList.add("hidden"); }

  /* ---------------------------
     Night Steps（官方12：固定口述順序）
     重要：你要求「角色死了仍要有流程（口述）」
     => step always present，但若角色已死：顯示提示「已死亡，僅口述」，且不讓它產生效果
  --------------------------- */
  const NIGHT_STEPS = [
    { key:"close", label:"天黑閉眼", type:"info" },

    // 守衛
    { key:"guard", label:"守衛", type:"pick", roleId:"guard", pickKey:"guardTarget" },

    // 狼人
    { key:"wolf", label:"狼人", type:"pick", roleId:"werewolf", pickKey:"wolfTarget" },

    // 預言家
    { key:"seer", label:"預言家", type:"pick", roleId:"seer", pickKey:"seerCheck" },

    // 女巫
    { key:"witch", label:"女巫", type:"witch", roleId:"witch" },

    { key:"resolve", label:"天亮結算", type:"resolve" },
  ];

  function roleAlive(roleId){
    // 場上有此角色且仍存活
    return State.players.some(p => p.roleId===roleId && p.alive);
  }

  function hasRole(roleId){
    return State.players.some(p => p.roleId===roleId);
  }

  function currentStep(){ return NIGHT_STEPS[State.nightStepIndex] || null; }

  function stepScript(step){
    const N = State.nightNo;
    const lines = [];
    lines.push(`第 ${N} 夜｜${step.label}`);

    // 口述（公開）
    const pub = [];
    const god = [];

    if(step.key==="close"){
      pub.push("天黑請閉眼。");
      god.push("（上帝）準備夜晚流程。");
    }

    if(step.key==="guard"){
      pub.push("守衛請睜眼，請守一位玩家。");
      if(!hasRole("guard")) pub.push("（本局無守衛，口述即可）");
      else if(!roleAlive("guard")) pub.push("（守衛已死亡：仍口述流程，但本回合不生效）");
      else pub.push("（點座位選擇守護目標）");
      if(State.settings.noConsecutiveGuard) pub.push("（規則：不能連守同一人）");
    }

    if(step.key==="wolf"){
      pub.push(State.settings.wolfCanNoKill ? "狼人請睜眼（可空刀），請選擇目標。" : "狼人請睜眼，請選擇目標（必選）。");
      pub.push("（點座位選擇刀口；再點一次可取消=空刀）");
    }

    if(step.key==="seer"){
      pub.push("預言家請睜眼，請查驗一位玩家。");
      if(!hasRole("seer")) pub.push("（本局無預言家，口述即可）");
      else if(!roleAlive("seer")) pub.push("（預言家已死亡：仍口述流程，但本回合不生效）");
      else pub.push("（點座位查驗，上帝提示會顯示陣營/身分）");
    }

    if(step.key==="witch"){
      pub.push("女巫請睜眼。");
      if(!hasRole("witch")) pub.push("（本局無女巫，口述即可）");
      else {
        if(!roleAlive("witch")) pub.push("（女巫已死亡：仍需口述『是否用藥』，但本回合不生效）");
        // 你需求：女巫死了也要唸是否用藥；不跳視窗，提示區顯示
        const knife = State.night.wolfTarget;
        if(State.night.witchSaveUsed){
          pub.push("🧪 解藥：已用過（不顯示刀口）");
        }else{
          // 你需求：女巫被刀但還有解藥 => 顯示刀口但註明不能自救
          if(knife){
            const witchSeat = State.players.find(p=>p.roleId==="witch")?.seat ?? null;
            if(State.settings.witchCannotSelfSave && witchSeat && knife===witchSeat){
              pub.push(`🧪 今晚刀口：${knife} 號（註：女巫不能自救）`);
            }else{
              pub.push(`🧪 今晚刀口：${knife} 號（點刀口=救）`);
            }
          }else{
            pub.push("🧪 今晚刀口：（狼人尚未選擇）");
          }
        }
        pub.push(`☠️ 毒藥：${State.night.witchPoisonUsed ? "已用過（毒藥沒了）" : "可用（點其他人=毒）"}`);
        pub.push("➡️ 直接按『下一步』＝本晚不使用技能。");
      }
    }

    if(step.key==="resolve"){
      pub.push("天亮請睜眼。");
      pub.push("（上帝結算並公告）");
    }

    // 上帝補充（神視角）
    if(State.godView){
      god.push("");
      god.push("【上帝資訊】");
      const alive = State.players.filter(p=>p.alive).map(p=>{
        return `${p.seat}號 ${p.icon}${p.name}${p.team==="wolf"?"(狼)":"(好)"}`;
      }).join("\n");
      god.push(alive || "（無）");
    }

    return [...lines, "", ...pub, ...(State.godView ? god : [])].join("\n");
  }

  function renderNightSeats(selectedSeat=null, disabled=false){
    const box = $("nightSeats");
    box.innerHTML = "";

    State.players.forEach(p=>{
      const b = document.createElement("button");
      b.type="button";
      b.className = "seat" + (p.alive ? "" : " dead") + (selectedSeat===p.seat ? " selected":"");
      b.textContent = String(p.seat);
      b.disabled = disabled || !p.alive;
      stopSelect(b);
      b.onclick = ()=> onNightPick(p.seat);
      box.appendChild(b);
    });
  }

  function onNightPick(seat){
    const step = currentStep();
    if(!step) return;

    // 避免「有些按了沒變色」：我們統一每次 pick 都重 render + selected
    if(step.type==="pick"){
      // guard：死了不能守
      if(step.key==="guard"){
        if(!roleAlive("guard")) { navigator.vibrate?.(20); return; }
        // 不能連守
        if(State.settings.noConsecutiveGuard && State.night.guardPrev && State.night.guardPrev===seat){
          navigator.vibrate?.([50,30,50]);
          $("nightHint").textContent = `⚠️ 守衛不能連守 ${seat} 號（請改選）`;
          return;
        }
        State.night.guardTarget = (State.night.guardTarget===seat) ? null : seat;
        save(); renderNight();
        return;
      }

      // wolf：可空刀 → 點同一人取消
      if(step.key==="wolf"){
        if(State.settings.wolfCanNoKill){
          State.night.wolfTarget = (State.night.wolfTarget===seat) ? null : seat;
        }else{
          State.night.wolfTarget = seat;
        }
        save(); renderNight();
        return;
      }

      // seer：死了不生效
      if(step.key==="seer"){
        if(!roleAlive("seer")) { navigator.vibrate?.(20); return; }
        State.night.seerCheck = seat;
        save(); renderNight();
        return;
      }
    }

    // witch：不跳視窗，點刀口=救、點其他=毒
    if(step.type==="witch"){
      // 女巫死了：不生效，但仍可讓提示變化？依你需求「不能跳過，口述即可」→不做任何選擇
      if(!roleAlive("witch")) { navigator.vibrate?.(15); return; }

      const knife = State.night.wolfTarget;
      const witchSeat = State.players.find(p=>p.roleId==="witch")?.seat ?? null;

      // 點刀口=救（前提解藥未用）
      if(!State.night.witchSaveUsed && knife && seat===knife){
        if(State.settings.witchCannotSelfSave && witchSeat && knife===witchSeat){
          $("nightHint").textContent = "⚠️ 女巫不能自救，無法用解藥救自己（可改用毒或跳過）";
          navigator.vibrate?.([50,30,50]);
          return;
        }
        State.night.witchSave = !State.night.witchSave;
        save(); renderNight();
        return;
      }

      // 其他=毒（前提毒藥未用）
      if(!State.night.witchPoisonUsed){
        State.night.witchPoison = (State.night.witchPoison===seat) ? null : seat;
        save(); renderNight();
        return;
      }

      $("nightHint").textContent = "☠️ 毒藥已用過，本回合無法再毒人";
      navigator.vibrate?.(20);
      return;
    }
  }

  function renderNight(){
    $("nightTag").textContent = `第 ${State.nightNo} 夜`;

    const step = currentStep();
    if(!step) return;

    // Script
    $("nightScript").textContent = stepScript(step);

    // Hint reset
    $("nightHint").textContent = "點座位會變色；不可操作的回合會顯示原因。";

    // Selected seat highlight
    let selected = null;
    let disabledAll = false;

    if(step.key==="guard"){
      selected = State.night.guardTarget;
      disabledAll = !roleAlive("guard"); // 死後不能守（整圈仍可看，但不能點）
      if(!hasRole("guard")) disabledAll = true;
    }
    if(step.key==="wolf"){
      selected = State.night.wolfTarget;
      disabledAll = false; // 狼人一定可選（口述+操作）
    }
    if(step.key==="seer"){
      selected = State.night.seerCheck;
      disabledAll = !roleAlive("seer") || !hasRole("seer");
    }
    if(step.key==="witch"){
      // 優先標示毒，其次救（刀口）
      selected = State.night.witchPoison || (State.night.witchSave ? State.night.wolfTarget : null);
      disabledAll = !roleAlive("witch") || !hasRole("witch");
    }
    if(step.key==="close" || step.key==="resolve"){
      disabledAll = true;
    }

    renderNightSeats(selected, disabledAll);
  }

  function nightPrev(){
    State.nightStepIndex = clamp(State.nightStepIndex-1, 0, NIGHT_STEPS.length-1);
    save(); renderNight();
  }

  function nightNext(){
    const step = currentStep();
    if(!step) return;

    // 必填檢查（狼人若不可空刀則必須選）
    if(step.key==="wolf" && !State.settings.wolfCanNoKill && !State.night.wolfTarget){
      $("nightHint").textContent = "⚠️ 本局設定：狼人不可空刀，必須選擇刀口";
      navigator.vibrate?.([60,40,60]);
      return;
    }
    if(step.key==="guard" && roleAlive("guard") && !State.night.guardTarget){
      $("nightHint").textContent = "⚠️ 守衛需選擇守護目標（或你可回設定關閉守衛角色）";
      navigator.vibrate?.([60,40,60]);
      return;
    }
    if(step.key==="seer" && roleAlive("seer") && !State.night.seerCheck){
      $("nightHint").textContent = "⚠️ 預言家需選擇查驗目標";
      navigator.vibrate?.([60,40,60]);
      return;
    }

    // 女巫：按下一步＝跳過（本晚不使用技能） -> 不額外清掉（你可能已點了救/毒，就是選擇使用）
    // resolve
    if(step.key==="resolve"){
      resolveNight();
      return;
    }

    State.nightStepIndex = clamp(State.nightStepIndex+1, 0, NIGHT_STEPS.length-1);
    save(); renderNight();
  }

  /* ---------------------------
     夜晚結算（先做官方12基本規則）
     - 守衛死後不生效（已在選擇限制）
     - 奶穿：守同救同一人 → 仍死亡
     - 女巫解藥用過：不顯示刀口（script 已處理）
  --------------------------- */
  function resolveNight(){
    // 清本晚毒記錄（用於禁用獵人等）
    State.night.poisonedSeats = [];

    const knife = State.night.wolfTarget;    // 可能 null=空刀
    const guard = State.night.guardTarget;
    const saveUsed = State.night.witchSaveUsed;
    const poisonUsed = State.night.witchPoisonUsed;

    const killed = new Set();

    // 狼刀
    if(knife) killed.add(knife);

    // 守衛擋刀（守衛必須存活才會有 guardTarget，已限制；這裡仍保險）
    const guardAlive = roleAlive("guard");
    if(guardAlive && knife && guard && knife===guard){
      killed.delete(knife);
    }

    // 女巫救（必須女巫存活、解藥未用）
    const witchAlive = roleAlive("witch");
    const canSave = witchAlive && !saveUsed && !!knife;
    const willSave = canSave && State.night.witchSave === true;

    // 奶穿：同守同救同一人 → 仍死亡
    const奶穿 = (guardAlive && willSave && guard && knife && guard===knife);

    if(willSave && !奶穿){
      killed.delete(knife);
    }

    // 女巫毒（必須女巫存活、毒藥未用、選了目標）
    const canPoison = witchAlive && !poisonUsed && !!State.night.witchPoison;
    if(canPoison){
      killed.add(State.night.witchPoison);
      State.night.poisonedSeats.push(State.night.witchPoison);
    }

    // 套用死亡
    const dead = [];
    killed.forEach(seat=>{
      const p = playerBySeat(seat);
      if(p && p.alive){
        p.alive = false;
        dead.push(seat);
      }
    });

    // 消耗藥
    if(willSave && !saveUsed) State.night.witchSaveUsed = true;
    if(canPoison && !poisonUsed) State.night.witchPoisonUsed = true;

    // 守衛連守記錄：只在守衛存活且有選才寫入
    if(guardAlive && guard) State.night.guardPrev = guard;

    // 公告（依你：白天公告一次公布讓玩家自己判斷原因）
    let text = "";
    if(dead.length===0) text = "天亮了，昨晚是平安夜。";
    else text = `天亮了，昨晚死亡：${dead.join("、")} 號。`;
    if(奶穿 && knife) text += `\n（提示：同守同救 ${knife} 號會奶穿）`;

    pushLog(text);

    // 夜晚狀態準備進白天
    State.nightStepIndex = 0;
    State.day.mode = "mark";
    State.day.voteTarget = null;
    State.day.voteRound = 1;
    State.day.pkList = null;

    save();
    showScreen("day");
    renderDay();
    openAnn(true);

    // 勝負判定
    const win = checkWin();
    if(win.ended){
      openEnd(win.title, win.hint);
    }
  }

  function pushLog(publicText){
    State.logs.unshift({
      nightNo: State.nightNo,
      dayNo: State.dayNo,
      publicText,
      ts: new Date().toISOString()
    });
    save();
  }

  /* ---------------------------
     白天（標記 + 投票）
     - 標記模式：點座位切換存活/死亡
     - 投票模式：點座位選目標（一定變色）
     - 結算：顯示「幾號投給幾號、得票」並放逐
     - 平票：第1次 → PK（只投平票名單）；第2次 → 無人放逐進夜
     - 獵人放逐：彈窗選是否開槍（被毒禁用）
  --------------------------- */
  function renderDay(){
    $("dayTag").textContent = `第 ${State.dayNo} 天`;
    renderDaySeats();
    renderAliveHint();
  }

  function renderAliveHint(){
    const alive = aliveSeats();
    $("dayAliveHint").textContent = alive.length ? `存活：${alive.join("、")} 號` : "（無存活玩家？）";
  }

  function renderDaySeats(){
    const box = $("daySeats");
    box.innerHTML = "";

    State.players.forEach(p=>{
      const b = document.createElement("button");
      b.type="button";
      b.className = "seat" + (p.alive ? "" : " dead");

      // 上帝視角：號碼旁顯示角色（你要的一眼清楚）
      if(State.godView){
        b.textContent = `${p.seat}\n${p.icon}`;
        b.style.whiteSpace = "pre-line";
      }else{
        b.textContent = String(p.seat);
      }

      // 投票選中變色
      if(State.day.mode==="vote" && State.day.voteTarget===p.seat){
        b.classList.add("selected");
      }
      stopSelect(b);

      b.onclick = ()=>{
        if(State.ended) return;

        if(State.day.mode==="mark"){
          p.alive = !p.alive;
          save();
          renderDaySeats();
          renderAliveHint();
          return;
        }

        if(State.day.mode==="vote"){
          // PK 限制：只能投 pkList
          if(State.day.voteRound===2 && Array.isArray(State.day.pkList)){
            if(!State.day.pkList.includes(p.seat)){
              navigator.vibrate?.(20);
              return;
            }
          }
          // 必須存活玩家才可被投（可依你要改）
          if(!p.alive){ navigator.vibrate?.(20); return; }

          State.day.voteTarget = (State.day.voteTarget===p.seat) ? null : p.seat;
          save();
          renderDaySeats();
          return;
        }
      };

      box.appendChild(b);
    });
  }

  function startVote(){
    State.day.mode = "vote";
    State.day.voteTarget = null;
    save();
    renderDaySeats();
    pushLog(`🗳️ 開始投票（第${State.day.voteRound}輪）`);
    openAnn(true);
  }

  // 逐人投票（簡化）：本測試版用「主持口頭統計」→ 你點選目標後按結算，會要求輸入票數/分配嗎？
  // 為了你要的「幾號投給幾號」：我們用一個簡化方案：
  // 1) 跳 prompt：輸入格式 "1>3,2>3,4>5,..."（只輸存活投票者）
  // 2) app 解析出得票與明細，並處理平票/PK
  function settleVote(){
    if(State.day.mode!=="vote"){
      alert("請先按『開始投票』");
      return;
    }

    const alive = aliveSeats();
    const pk = (State.day.voteRound===2 && Array.isArray(State.day.pkList)) ? State.day.pkList : null;

    const hint = pk
      ? `PK名單：${pk.join("、")}（只允許投這些號碼）`
      : `請輸入投票明細：例如 1>3,2>3,4>5（只需輸入存活投票者）`;

    const raw = prompt(`${hint}\n\n格式：1>3,2>3,4>5\n（空白=取消）`, "");
    if(raw===null) return;

    const pairs = raw.split(",").map(s=>s.trim()).filter(Boolean);
    const details = []; // {from,to}
    const votes = new Map(); // to => count

    for(const p of pairs){
      const m = p.match(/^(\d+)\s*>\s*(\d+)$/);
      if(!m) continue;
      const from = Number(m[1]);
      const to = Number(m[2]);

      if(!alive.includes(from)) continue;
      if(pk && !pk.includes(to)) continue;
      if(!isAliveSeat(to)) continue;

      details.push({from,to});
      votes.set(to, (votes.get(to)||0)+1);
    }

    // 沒資料就當取消
    if(details.length===0){
      alert("沒有有效投票明細（請用格式 1>3,2>3）");
      return;
    }

    // 產生公告文字（你要的：幾號投給幾號、得票）
    const lines = [];
    lines.push(`【白天投票結算｜第${State.day.voteRound}輪】`);
    lines.push(details.map(d=>`${d.from}→${d.to}`).join("、"));

    const sorted = Array.from(votes.entries()).sort((a,b)=> b[1]-a[1] || a[0]-b[0]);
    lines.push("");
    lines.push("【得票】");
    sorted.forEach(([to,c])=> lines.push(`${to} 號：${c} 票`));

    // 判斷最高票/平票
    const topCount = sorted[0][1];
    const topSeats = sorted.filter(([,c])=>c===topCount).map(([to])=>to);

    if(topSeats.length>=2){
      // 平票
      lines.push("");
      lines.push(`⚠️ 平票：${topSeats.join("、")}（${topCount}票）`);

      pushLog(lines.join("\n"));
      openAnn(true);

      if(State.day.voteRound===1){
        // 進 PK
        State.day.voteRound = 2;
        State.day.pkList = topSeats;
        State.day.voteTarget = null;
        State.day.mode = "vote";
        save();
        alert(`進入 PK 投票：只投 ${topSeats.join("、")} 號`);
        renderDaySeats();
        return;
      }else{
        // 第二次仍平票：無人放逐
        pushLog("⚖️ PK 第二次仍平票：無人放逐，直接進入夜晚。");
        openAnn(true);
        State.day.mode = "mark";
        save();
        nextDay();
        return;
      }
    }

    // 唯一最高票 → 放逐
    const exiled = topSeats[0];
    lines.push("");
    lines.push(`✅ 放逐：${exiled} 號`);

    // 執行放逐
    const exiledPlayer = playerBySeat(exiled);
    if(exiledPlayer && exiledPlayer.alive){
      exiledPlayer.alive = false;
    }

    pushLog(lines.join("\n"));
    openAnn(true);

    // 獵人放逐技能
    if(exiledPlayer && exiledPlayer.roleId==="hunter"){
      const poisoned = State.night.poisonedSeats.includes(exiled);
      if(poisoned){
        pushLog("🏹 獵人被毒禁用：不能開槍。");
        openAnn(true);
        afterDayExecution();
        return;
      }
      openHunterSkill(exiled);
      return;
    }

    afterDayExecution();
  }

  function afterDayExecution(){
    save();
    renderDay();

    const win = checkWin();
    if(win.ended){
      openEnd(win.title, win.hint);
      return;
    }
  }

  /* Hunter modal */
  let hunterTarget = null;
  let hunterShooterSeat = null;

  function openHunterSkill(seat){
    hunterShooterSeat = seat;
    hunterTarget = null;

    $("hunterHint").textContent = `獵人（${seat}號）被放逐：是否開槍？（可點一個目標，或按「不開槍」）`;
    renderHunterSeats();
    $("modalHunter").classList.remove("hidden");
  }
  function closeHunterSkill(){
    $("modalHunter").classList.add("hidden");
  }
  function renderHunterSeats(){
    const box = $("hunterSeats");
    box.innerHTML = "";
    State.players.forEach(p=>{
      const b = document.createElement("button");
      b.type="button";
      b.className = "seat" + (p.alive ? "" : " dead") + (hunterTarget===p.seat ? " selected":"");
      b.textContent = String(p.seat);
      b.disabled = !p.alive; // 只能射存活者
      stopSelect(b);
      b.onclick = ()=>{ hunterTarget = p.seat; renderHunterSeats(); };
      box.appendChild(b);
    });
  }
  function confirmHunter(){
    if(!hunterTarget){
      navigator.vibrate?.(40);
      return;
    }
    const p = playerBySeat(hunterTarget);
    if(p && p.alive){
      p.alive = false;
      pushLog(`🏹 獵人開槍：${hunterShooterSeat} 號 → 擊殺 ${hunterTarget} 號`);
      openAnn(true);
    }
    closeHunterSkill();
    afterDayExecution();
  }

  /* ---------------------------
     警長流程（先做提示：後續再細化）
  --------------------------- */
  function policeFlow(){
    if(!State.settings.hasPolice){
      alert("本局未開啟上警/警徽");
      return;
    }
    pushLog("👮 上警流程（提示）：上警→退警→投票出警長→發警徽/撕警徽（此版先做口述提示）。");
    openAnn(true);
  }

  /* ---------------------------
     進下一夜
  --------------------------- */
  function nextDay(){
    // 進夜前，重置夜晚選擇（但保留永久消耗）
    State.nightNo += 1;
    State.dayNo += 1;

    State.nightStepIndex = 0;
    State.night.guardTarget = null;
    State.night.wolfTarget = null;
    State.night.seerCheck = null;
    State.night.witchSave = false;
    State.night.witchPoison = null;
    State.night.poisonedSeats = [];

    State.day.mode = "mark";
    State.day.voteTarget = null;
    State.day.voteRound = 1;
    State.day.pkList = null;

    save();
    showScreen("night");
    renderNight();
  }

  /* ---------------------------
     公告中心（可捲動）
  --------------------------- */
  let annMode = "today"; // today | history

  function renderAnn(){
    const box = $("annBox");
    if(State.logs.length===0){
      box.textContent = "（尚無公告）";
      return;
    }
    if(annMode==="today"){
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
    if(forceToday) annMode = "today";
    $("modalAnn").classList.remove("hidden");
    $("annToday").classList.toggle("active", annMode==="today");
    $("annHistory").classList.toggle("active", annMode==="history");
    renderAnn();
  }
  function closeAnn(){ $("modalAnn").classList.add("hidden"); }

  function copyAnn(){
    const t = $("annBox").textContent || "";
    navigator.clipboard?.writeText(t).then(()=>{
      navigator.vibrate?.(30);
    }).catch(()=>{});
  }

  /* ---------------------------
     勝負判定（官方12：屠邊/屠城）
     - 白痴算神（你已確認）
  --------------------------- */
  function countAlive(){
    const alive = State.players.filter(p=>p.alive);
    const wolves = alive.filter(p=> roleOf(p.roleId).team==="wolf").length;
    const goods = alive.length - wolves;

    const gods = alive.filter(p=>{
      const r = roleOf(p.roleId);
      return r.team==="good" && r.type==="god";
    }).length;

    const citizens = alive.filter(p=>{
      const r = roleOf(p.roleId);
      return r.team==="good" && r.type==="citizen";
    }).length;

    return { alive, wolves, goods, gods, citizens };
  }

  function checkWin(){
    const { wolves, goods, gods, citizens } = countAlive();

    // 狼全滅 → 好人勝
    if(wolves<=0){
      return { ended:true, title:"✅ 好人獲勝", hint:"狼人全滅" };
    }

    // 狼數 >= 好人 → 狼人勝（基本）
    if(wolves>=goods){
      return { ended:true, title:"🐺 狼人獲勝", hint:"狼數 ≥ 好人" };
    }

    // 屠城：好人全滅
    if(State.settings.winMode==="city"){
      if(goods<=0){
        return { ended:true, title:"🐺 狼人獲勝", hint:"屠城：好人全滅" };
      }
      return { ended:false };
    }

    // 屠邊：神全死 或 民全死 → 狼勝
    if(State.settings.winMode==="edge"){
      if(gods<=0){
        return { ended:true, title:"🐺 狼人獲勝", hint:"屠邊：神職全滅（白痴算神）" };
      }
      if(citizens<=0){
        return { ended:true, title:"🐺 狼人獲勝", hint:"屠邊：平民全滅" };
      }
      return { ended:false };
    }

    return { ended:false };
  }

  function openEnd(title, hint){
    State.ended = true;
    save();
    $("endTitle").textContent = title;
    $("endHint").textContent = hint || "";
    $("modalEnd").classList.remove("hidden");
  }

  /* ---------------------------
     綁定事件
  --------------------------- */
  function bind(){
    // Setup
    $("btnMinus").onclick = ()=> incPlayer(-1);
    $("btnPlus").onclick = ()=> incPlayer(+1);
    ["optHasPolice","optWinModeEdge","optNoConsecutiveGuard","optWolfCanNoKill","optWitchCannotSelfSave"]
      .forEach(id => $(id).addEventListener("change", ()=>{ applySettingsFromUI(); syncSetup(); }));

    $("btnOpenRoleConfig").onclick = openRoleConfig;
    $("closeRole").onclick = closeRoleConfig;
    $("roleReset").onclick = resetRoleConfig;
    $("roleApply").onclick = ()=>{ closeRoleConfig(); syncSetup(); save(); };

    $("btnStart").onclick = ()=>{
      applySettingsFromUI();
      const total = roleTotal(State.rolesCount);
      if(total !== State.playerCount){
        alert("⚠️ 角色總數必須等於玩家人數");
        return;
      }
      buildPlayers();
      showScreen("deal");
      renderDeal();
    };

    // Deal
    $("btnDealBack").onclick = ()=>{ showScreen("setup"); syncSetup(); };
    $("btnNextPlayer").onclick = nextPlayerDeal;
    $("btnFinishDeal").onclick = openDealConfirm;
    $("dealConfirmYes").onclick = ()=>{
      closeDealConfirm();
      // 進夜
      State.nightStepIndex = 0;
      save();
      showScreen("night");
      renderNight();
    };
    $("dealConfirmNo").onclick = closeDealConfirm;
    $("dealConfirmClose").onclick = closeDealConfirm;

    // Night
    $("btnNightPrev").onclick = nightPrev;
    $("btnNightNext").onclick = nightNext;

    // Day
    $("btnPoliceFlow").onclick = policeFlow;
    $("btnStartVote").onclick = startVote;
    $("btnSettleVote").onclick = settleVote;
    $("btnDayNext").onclick = nextDay;

    // God / Ann / Restart
    $("btnGodToggle").onclick = ()=> setGod(!State.godView);
    $("fabGod").onclick = ()=> setGod(!State.godView);

    $("btnOpenAnn").onclick = ()=> openAnn(true);
    $("fabAnn").onclick = ()=> openAnn(true);
    $("closeAnn").onclick = closeAnn;
    $("annToday").onclick = ()=>{ annMode="today"; openAnn(false); };
    $("annHistory").onclick = ()=>{ annMode="history"; openAnn(false); };
    $("btnCopyAnn").onclick = copyAnn;

    $("btnRestart").onclick = ()=>{
      if(confirm("確定要重新開始？會清除本機進度並回到設定。")) resetAll();
    };

    // Hunter modal
    $("closeHunter").onclick = closeHunterSkill;
    $("hunterPass").onclick = ()=>{
      pushLog("🏹 獵人選擇：不開槍。");
      openAnn(true);
      closeHunterSkill();
      afterDayExecution();
    };
    $("hunterConfirm").onclick = confirmHunter;

    // End modal
    $("closeEnd").onclick = ()=> $("modalEnd").classList.add("hidden");
    $("endRestart").onclick = ()=> resetAll();

    // 防選字
    ["btnOpenAnn","btnGodToggle","btnRestart","btnStart","btnOpenRoleConfig","btnNightPrev","btnNightNext","btnDayNext","btnStartVote","btnSettleVote","btnPoliceFlow"]
      .forEach(id=> stopSelect($(id)));
  }

  /* ---------------------------
     Init
  --------------------------- */
  function init(){
    load();

    // UI 還原設定
    $("optHasPolice").checked = !!State.settings.hasPolice;
    $("optWinModeEdge").checked = (State.settings.winMode!=="city");
    $("optNoConsecutiveGuard").checked = !!State.settings.noConsecutiveGuard;
    $("optWolfCanNoKill").checked = !!State.settings.wolfCanNoKill;
    $("optWitchCannotSelfSave").checked = !!State.settings.witchCannotSelfSave;

    syncSetup();
    bind();
    setGod(!!State.godView);

    showScreen(State.phase || "setup");

    if(State.phase==="deal") renderDeal();
    if(State.phase==="night") renderNight();
    if(State.phase==="day"){ renderDay(); }
  }

  init();
})();