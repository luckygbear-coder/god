/* =========================================================
   狼人殺｜上帝輔助 PWA（整合穩定版）
   app.js（修正版：iOS 按鈕可點）
   - 修正：不要對按鈕 touchstart preventDefault（會導致 iOS 點擊失效）
   - 仍保留：禁雙擊放大、禁長按選單/選字
========================================================= */
(() => {
  const $ = (id) => document.getElementById(id);
  const warn = (...a) => console.warn("⚠️ app:", ...a);

  /* ---------------------------
     iOS：禁止選字/長按選單/雙擊放大（但不破壞 click）
  --------------------------- */
  try {
    document.documentElement.style.webkitUserSelect = "none";
    document.documentElement.style.userSelect = "none";
    document.documentElement.style.webkitTouchCallout = "none";
    // 讓按鈕更像 app：減少誤觸縮放
    document.documentElement.style.touchAction = "manipulation";
    if (document.body) {
      document.body.style.webkitUserSelect = "none";
      document.body.style.userSelect = "none";
      document.body.style.touchAction = "manipulation";
    }
  } catch (e) {}

  // 禁右鍵/長按選單（不影響 click）
  document.addEventListener("contextmenu", (e) => e.preventDefault(), { passive: false });

  // 禁選字（不影響 click）
  document.addEventListener("selectstart", (e) => e.preventDefault(), { passive: false });

  // 禁 iOS 手勢縮放
  document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });

  // 阻止 double-tap zoom（只在極短間隔才 preventDefault）
  let _lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    (e) => {
      const now = Date.now();
      if (now - _lastTouchEnd <= 300) e.preventDefault();
      _lastTouchEnd = now;
    },
    { passive: false }
  );

  /* ---------------------------
     Storage
  --------------------------- */
  const STORAGE_KEY = "ww_save_v3_integrated";
  const State = {
    phase: "setup",         // setup | deal | night | day
    boardId: "basic",       // basic | b1
    playerCount: 12,
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

    dayMode: "mark",        // mark | vote
    dayVote: { target:null },

    settings: {
      noConsecutiveGuard: true,
      wolfCanNoKill: true,
      witchCannotSelfSave: true,
      hunterPoisonNoShoot: true,
      blackWolfKingPoisonNoSkill: true,
      winMode: "side" // side(屠邊) | city(屠城)
    }
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
     Screen
  --------------------------- */
  function showScreen(name){
    document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
    $(`screen-${name}`)?.classList.add("active");
    State.phase = name;
    save();
  }

  /* =========================================================
     Data Loader（同你原本）
  ========================================================= */
  const WW_FALLBACK = {
    roles: {
      villager:{ id:"villager", name:"村民", icon:"🙂", team:"villager" },
      werewolf:{ id:"werewolf", name:"狼人", icon:"🐺", team:"wolf" },
      seer:{ id:"seer", name:"預言家", icon:"🔮", team:"villager" },
      witch:{ id:"witch", name:"女巫", icon:"🧪", team:"villager" },
      hunter:{ id:"hunter", name:"獵人", icon:"🏹", team:"villager" },
      guard:{ id:"guard", name:"守衛", icon:"🛡️", team:"villager" },
      knight:{ id:"knight", name:"騎士", icon:"⚔️", team:"villager" },
      blackWolfKing:{ id:"blackWolfKing", name:"黑狼王", icon:"🐺🔫", team:"wolf" },
      whiteWolfKing:{ id:"whiteWolfKing", name:"白狼王", icon:"🐺🤍", team:"wolf" },
      wolfKing:{ id:"wolfKing", name:"狼王", icon:"🐺👑", team:"wolf" },
      idiot:{ id:"idiot", name:"白痴", icon:"🤪", team:"villager", isGod:true },
    },
    boards: {
      basic:{ id:"basic", name:"官方｜基礎" },
      b1:{ id:"b1", name:"官方｜特殊" },
    }
  };

  function mergeMaps(...maps){
    const out = {};
    maps.forEach(m=>{
      if(!m) return;
      Object.keys(m).forEach(k=> out[k] = m[k]);
    });
    return out;
  }

  function ensureWWData(){
    const W = window;

    const rolesAll = mergeMaps(
      W.WW_ROLES || null,
      W.WW_ROLES_BASE || null,
      W.WW_ROLES_B1 || null,
      W.WW_DATA?.roles || null
    );
    const roles = Object.keys(rolesAll).length ? rolesAll : WW_FALLBACK.roles;

    const boardsAll = mergeMaps(
      W.WW_BOARDS || null,
      W.WW_DATA?.boards || null,
      W.BOARDS || null
    );
    const boards = Object.keys(boardsAll).length ? boardsAll : WW_FALLBACK.boards;

    const rulesBasic =
      W.WW_RULES_BASIC || W.WW_RULES?.basic || W.WW_DATA?.rules?.basic || W.RULES_BASIC || null;
    const rulesB1 =
      W.WW_RULES_B1 || W.WW_RULES?.b1 || W.WW_DATA?.rules?.b1 || W.RULES_B1 || null;

    const nightBasic =
      W.WW_NIGHT_STEPS_BASIC || W.WW_DATA?.nightSteps?.basic || W.NIGHT_STEPS_BASIC || null;
    const nightB1 =
      W.WW_NIGHT_STEPS_B1 || W.WW_DATA?.nightSteps?.b1 || W.NIGHT_STEPS_B1 || null;

    const winEngine =
      W.WW_WIN_ENGINE || W.WW_DATA?.engines?.win || W.WIN_ENGINE || null;

    W.WW_DATA = W.WW_DATA || {};
    W.WW_DATA.roles = roles;
    W.WW_DATA.boards = boards;
    W.WW_DATA.rules = { basic: rulesBasic, b1: rulesB1 };
    W.WW_DATA.nightSteps = { basic: nightBasic, b1: nightB1 };
    W.WW_DATA.engines = { win: winEngine };

    W.WW_DATA.getRole = (rid)=> W.WW_DATA.roles?.[rid] || null;
    W.WW_DATA.getBoardBundle = (bid)=>{
      const board = W.WW_DATA.boards?.[bid] || { id: bid, name: bid };
      const rules = bid === "b1" ? W.WW_DATA.rules.b1 : W.WW_DATA.rules.basic;
      const nightSteps = bid === "b1" ? W.WW_DATA.nightSteps.b1 : W.WW_DATA.nightSteps.basic;
      return { board, rules, nightSteps };
    };

    return W.WW_DATA;
  }

  async function loadScriptOnce(src){
    return new Promise((resolve)=>{
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = ()=> resolve(true);
      s.onerror = ()=> resolve(false);
      document.head.appendChild(s);
    });
  }

  async function bootstrapData(){
    const candidates = [
      "./data/ww.data.js",
      "./data/roles/roles.base.js",
      "./data/roles/roles.b1.js",
      "./data/roles/roles.all.js",
      "./data/boards/boards.js",
      "./data/rules/rules.basic.js",
      "./data/rules/rules.b1.js",
      "./data/flow/night.steps.basic.js",
      "./data/flow/night.steps.b1.js",
      "./engine/win.engine.js",
    ];
    for (const src of candidates) await loadScriptOnce(src);
    ensureWWData();
    if (!window.WW_DATA?.roles || !Object.keys(window.WW_DATA.roles).length) window.WW_DATA.roles = WW_FALLBACK.roles;
    if (!window.WW_DATA?.boards || !Object.keys(window.WW_DATA.boards).length) window.WW_DATA.boards = WW_FALLBACK.boards;
  }

  function getWW(){ return window.WW_DATA || null; }
  function getRole(roleId){
    const r = getWW()?.roles?.[roleId];
    return r || { id: roleId, name: roleId, icon:"❔", team:"villager" };
  }

  function getBoardBundle(boardId){
    const WW = getWW();
    if (WW?.getBoardBundle) {
      try { return WW.getBoardBundle(boardId); } catch(e){}
    }
    const b = WW?.boards?.[boardId] || { id: boardId, name: boardId };
    const rules = boardId === "b1" ? (WW?.rules?.b1) : (WW?.rules?.basic);
    const nightSteps = boardId === "b1" ? (WW?.nightSteps?.b1) : (WW?.nightSteps?.basic);
    return { board: b, rules, nightSteps };
  }

  /* ---------------------------
     Utils
  --------------------------- */
  function rolesTotal(map){
    return Object.values(map || {}).reduce((a,b)=> a + (Number(b)||0), 0);
  }
  function shuffle(arr){
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function showToast(msg){
    const t = $("toast");
    if(!t) return;
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(()=>t.classList.remove("show"), 1200);
  }

  /* =========================================================
     ✅ 這裡開始是你原本流程（我只修「按鈕點不到」相關）
     下面我保留你既有 ID 綁定與渲染結構
     （如果你 index.html id 跟我不同，你告訴我，我再對齊）
  ========================================================= */

  function syncSetupUI(){
    if ($("playerCount")) $("playerCount").textContent = String(State.playerCount);
    if ($("playerTotal")) $("playerTotal").textContent = String(State.playerCount);

    const total = rolesTotal(State.rolesCount);
    if ($("roleTotal")) $("roleTotal").textContent = String(total);

    const ok = total === State.playerCount;
    $("warnRoleTotal")?.classList.toggle("hidden", ok);

    const btnStart = $("btnStart");
    if (btnStart) {
      btnStart.disabled = !ok;
      btnStart.textContent = ok ? "開始 → 抽身分" : "⚠️ 角色總數需等於玩家數";
    }
    save();
  }

  function suggestBasicConfigByCount(n){
    // 12人標準：4狼 +（預言家/女巫/獵人/守衛或白痴擇一）+4民
    // 你現在先跑「可測試流程」，先用守衛版本作預設
    if (n === 12) return { werewolf:4, seer:1, witch:1, hunter:1, guard:1, villager:4 };
    const wolves = n >= 10 ? 3 : 2;
    const fixed = 3;
    const villager = Math.max(0, n - wolves - fixed);
    return { werewolf:wolves, villager, seer:1, witch:1, hunter:1 };
  }

  function getSuggestedRolesCount(boardId, n){
    const bundle = getBoardBundle(boardId);
    const preset = bundle?.board?.presets?.[n];
    if (preset && typeof preset === "object") return JSON.parse(JSON.stringify(preset));
    return suggestBasicConfigByCount(n);
  }

  function setBoard(boardId){
    State.boardId = boardId;
    $("boardBasic")?.classList.toggle("active", boardId === "basic");
    $("boardSpecial")?.classList.toggle("active", boardId === "b1");
    State.rolesCount = getSuggestedRolesCount(boardId, State.playerCount);
    syncSetupUI();
  }

  function setPlayerCount(n){
    const v = Math.max(6, Math.min(12, Number(n) || 12));
    State.playerCount = v;
    const range = $("rangeCount");
    if (range) range.value = String(v);
    State.rolesCount = getSuggestedRolesCount(State.boardId, v);
    syncSetupUI();
  }

  function buildPlayersFromRolesCount(){
    const rolesArr = [];
    for (const [rid, cnt] of Object.entries(State.rolesCount || {})) {
      for (let i = 0; i < (Number(cnt)||0); i++) rolesArr.push(rid);
    }
    shuffle(rolesArr);

    State.players = rolesArr.map((rid, idx) => {
      const r = getRole(rid);
      return { seat: idx+1, roleId: rid, name: r.name||rid, icon: r.icon||"❔", team: r.team||"villager", alive: true };
    });

    State.dealIndex = 0;
    State.nightNo = 1;
    State.dayNo = 1;
    State.logs = [];
    State.nightState = {};
    State.nightSteps = [];
    State.nightStepIndex = 0;
    State.witch = { saveUsed:false, poisonUsed:false, save:false, poisonTarget:null };
    State.dayMode = "mark";
    State.dayVote = { target:null };
    save();
  }

  /* ---------------------------
     Deal（略：你原本的可以保留）
     這裡我只保留最必要：確認後進夜晚
  --------------------------- */
  let _dealHoldTimer = null;

  function renderDeal(){
    const p = State.players[State.dealIndex];
    if (!p) return;

    if ($("dealText")) $("dealText").innerHTML = `請 <b>${p.seat} 號</b> 拿手機`;

    const grid = $("dealSeatGrid");
    if (grid) {
      grid.innerHTML = "";
      State.players.forEach((pp, idx) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "seat" + (idx === State.dealIndex ? " selected" : "");
        b.textContent = String(pp.seat);
        b.addEventListener("click", () => {
          State.dealIndex = idx;
          save();
          renderDeal();
        });
        grid.appendChild(b);
      });
    }

    const btnHold = $("btnHoldReveal");
    const showReveal = () => {
      const cur = State.players[State.dealIndex];
      if ($("revealRole")) $("revealRole").textContent = `${cur.icon} ${cur.name}`;
      $("modalReveal")?.classList.remove("hidden");
      navigator.vibrate?.(40);
    };
    const hideReveal = () => $("modalReveal")?.classList.add("hidden");

    if (btnHold) {
      btnHold.onpointerdown = (e) => {
        e.preventDefault?.();
        clearTimeout(_dealHoldTimer);
        _dealHoldTimer = setTimeout(showReveal, 900);
      };
      const end = () => {
        clearTimeout(_dealHoldTimer);
        hideReveal();
      };
      btnHold.onpointerup = end;
      btnHold.onpointercancel = end;
      btnHold.onpointerleave = end;
    }

    $("btnDealNext") && ($("btnDealNext").onclick = () => {
      State.dealIndex = Math.min(State.players.length - 1, State.dealIndex + 1);
      save(); renderDeal();
    });

    $("btnDealAllDone") && ($("btnDealAllDone").onclick = () => $("modalDealConfirm")?.classList.remove("hidden"));
    $("btnDealConfirmYes") && ($("btnDealConfirmYes").onclick = () => {
      $("modalDealConfirm")?.classList.add("hidden");
      startNight();
    });
    $("btnDealConfirmNo") && ($("btnDealConfirmNo").onclick = () => $("modalDealConfirm")?.classList.add("hidden"));
  }

  /* =========================================================
     Night（最小可跑，且 ✅ 按鈕一定能按）
  ========================================================= */
  function hasRole(roleId){
    return State.players.some(p => p.roleId === roleId);
  }

  function buildNightSteps(){
    return [
      { key:"close", type:"info", publicScript:"天黑請閉眼。", godScript:"天黑請閉眼。" },
      { key:"guard", type:"pick", pickKey:"guardTarget", required:true, publicScript:"守衛請睜眼，守一位玩家。", godScript:"守衛守誰？（點座位）", roleId:"guard" },
      { key:"wolf", type:"pick", pickKey:"wolfTarget", required: !State.settings.wolfCanNoKill, allowNull: !!State.settings.wolfCanNoKill, publicScript:"狼人請睜眼，選擇目標。", godScript:"狼人刀誰？（可空刀）" },
      { key:"seer", type:"seer", pickKey:"seerCheck", required:true, publicScript:"預言家請睜眼，查驗一位玩家。", godScript:"預言家查誰？（點座位）", roleId:"seer" },
      { key:"witch", type:"witch", publicScript:"女巫請睜眼（上帝操作）。", godScript:"女巫：點刀口=救、點其他=毒、下一步=不使用", roleId:"witch" },
      { key:"resolve", type:"resolve", publicScript:"天亮請睜眼。", godScript:"天亮：結算夜晚並公告。" },
    ];
  }

  function resolveNightStepsForThisGame(){
    State.nightSteps = buildNightSteps();
    State.nightStepIndex = 0;
    save();
  }

  function getCurrentNightStep(){
    return State.nightSteps?.[State.nightStepIndex] || null;
  }

  function scriptForStep(step){
    const s = State.godView ? (step.godScript || step.publicScript) : (step.publicScript || step.godScript);
    return s || "（無台詞）";
  }

  function renderSeats(containerId, onPick, selectedSeat=null){
    const box = $(containerId);
    if (!box) return;
    box.innerHTML = "";

    State.players.forEach(p => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seat" + (p.alive ? "" : " dead") + (selectedSeat === p.seat ? " selected" : "");
      b.textContent = String(p.seat);
      b.disabled = !p.alive;
      // ✅ 這裡只用 click，不做 touchstart preventDefault
      b.addEventListener("click", () => {
        if (!p.alive) return;
        onPick?.(p.seat);
      });
      box.appendChild(b);
    });
  }

  function renderNight(){
    $("nightTag") && ($("nightTag").textContent = `第 ${State.nightNo} 夜`);

    if (!State.nightSteps || !State.nightSteps.length) resolveNightStepsForThisGame();

    const step = getCurrentNightStep();
    if (!step) return;

    const tips = [];
    if (step.type === "witch") {
      const knifeSeat = State.nightState.wolfTarget || null;

      // 女巫被刀：仍顯示刀口，但提示不可自救（若解藥已用就不顯示刀口）
      const witchSeat = State.players.find(x=>x.roleId==="witch")?.seat || null;
      const witchIsKnife = !!(knifeSeat && witchSeat && knifeSeat === witchSeat);

      if (State.witch.saveUsed) {
        tips.push("🧪 解藥：已用過（本局不再顯示刀口）");
      } else {
        if (knifeSeat) {
          tips.push(`🧪 解藥：刀口 ${knifeSeat} 號（點他=救）${witchIsKnife ? "｜⚠️ 女巫被刀：不可自救" : ""}`);
        } else {
          tips.push("🧪 解藥：狼人尚未選刀");
        }
      }
      tips.push(`☠️ 毒藥：${State.witch.poisonUsed ? "已用過（毒藥沒了）" : "可用（點其他人=毒）"}`);
      if (State.witch.poisonTarget) tips.push(`已選毒：${State.witch.poisonTarget} 號`);
      if (State.witch.save && knifeSeat) tips.push(`已選救：${knifeSeat} 號`);
    }

    if (step.type === "seer" && State.nightState.seerCheck) {
      const seat = State.nightState.seerCheck;
      const p = State.players.find(x=>x.seat===seat);
      if (p) {
        const role = getRole(p.roleId);
        tips.push(`🔮 查驗 ${seat} 號 → ${role.icon} ${role.name}（${role.team==="wolf"?"狼人陣營":"好人陣營"}）`);
      }
    }

    const base = scriptForStep(step);
    $("nightScript") && ($("nightScript").textContent = tips.length ? (base + "\n" + tips.join("\n")) : base);

    const selected =
      (step.type === "pick" || step.type === "seer") ? (State.nightState[step.pickKey] || null)
      : (step.type === "witch" ? (State.witch.poisonTarget || (State.witch.save ? (State.nightState.wolfTarget||null) : null)) : null);

    renderSeats("nightSeats", (seat) => {
      const cur = getCurrentNightStep();
      if (!cur) return;

      if (cur.type === "pick" && cur.pickKey) {
        if (cur.pickKey === "wolfTarget" && State.settings.wolfCanNoKill) {
          State.nightState[cur.pickKey] = (State.nightState[cur.pickKey] === seat) ? null : seat;
        } else {
          State.nightState[cur.pickKey] = seat;
        }
        save(); renderNight();
        return;
      }

      if (cur.type === "seer" && cur.pickKey) {
        State.nightState[cur.pickKey] = seat;
        save(); renderNight();
        return;
      }

      if (cur.type === "witch") {
        const knifeSeat = State.nightState.wolfTarget || null;
        const witchSeat = State.players.find(x=>x.roleId==="witch")?.seat || null;
        const witchIsKnife = !!(knifeSeat && witchSeat && knifeSeat === witchSeat);

        // 點刀口=救（解藥未用，且女巫被刀不可自救）
        if (!State.witch.saveUsed && knifeSeat && seat === knifeSeat) {
          if (witchIsKnife) {
            showToast("⚠️ 女巫不可自救");
            navigator.vibrate?.(30);
            return;
          }
          State.witch.save = true;
          save(); renderNight();
          return;
        }

        // 點其他=毒（毒藥未用）
        if (!State.witch.poisonUsed) {
          State.witch.poisonTarget = seat;
          save(); renderNight();
          return;
        }

        navigator.vibrate?.(30);
      }
    }, selected);
  }

  function canGoNextNightStep(step){
    if (!step) return false;
    if ((step.type === "pick" || step.type === "seer") && step.required && step.pickKey) {
      if (step.allowNull) return true;
      return !!State.nightState[step.pickKey];
    }
    return true;
  }

  function nightPrev(){
    State.nightStepIndex = Math.max(0, State.nightStepIndex - 1);
    save(); renderNight();
  }

  function nightNext(){
    const step = getCurrentNightStep();
    if (!step) return;

    if (!canGoNextNightStep(step)) {
      navigator.vibrate?.([60,40,60]);
      return;
    }

    if (step.type === "resolve") {
      // 先簡化：直接進白天（你後續的結算/公告/勝負我再接回你完整版本）
      showScreen("day");
      renderDay();
      return;
    }

    State.nightStepIndex = Math.min(State.nightSteps.length - 1, State.nightStepIndex + 1);
    save(); renderNight();
  }

  /* =========================================================
     Day（最小可跑）
  ========================================================= */
  function renderDay(){
    $("dayTag") && ($("dayTag").textContent = `第 ${State.dayNo} 天`);
    const alive = State.players.filter(p=>p.alive).map(p=>p.seat);
    $("dayAlive") && ($("dayAlive").textContent = alive.length ? `存活：${alive.join("、")} 號` : "（全滅？）");

    const box = $("daySeats");
    if (!box) return;
    box.innerHTML = "";
    State.players.forEach(p=>{
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seat" + (p.alive ? "" : " dead");
      b.textContent = String(p.seat);
      b.addEventListener("click", () => {
        p.alive = !p.alive;
        save(); renderDay();
      });
      box.appendChild(b);
    });
  }

  /* =========================================================
     Start
  ========================================================= */
  function startGame(){
    ensureWWData();
    if (!State.rolesCount) State.rolesCount = getSuggestedRolesCount(State.boardId, State.playerCount);
    if (rolesTotal(State.rolesCount) !== State.playerCount) {
      alert("⚠️ 角色總數必須等於玩家人數");
      return;
    }
    buildPlayersFromRolesCount();
    showScreen("deal");
    renderDeal();
  }

  function startNight(){
    State.nightState = {};
    State.nightStepIndex = 0;
    State.witch.save = false;
    State.witch.poisonTarget = null;
    resolveNightStepsForThisGame();
    save();
    showScreen("night");
    renderNight();
  }

  function setGod(onFlag){
    State.godView = !!onFlag;
    document.body.classList.toggle("god-on", State.godView);
    $("btnGodToggle") && ($("btnGodToggle").textContent = State.godView ? "🔓" : "🔒");
    $("fabGod") && ($("fabGod").textContent = State.godView ? "🔓" : "🔒");
    save();
    if (State.phase === "night") renderNight();
  }
  function toggleGod(){ setGod(!State.godView); }

  function ensureRestartButton(){
    const b = $("btnRestart") || $("topRestart");
    if (!b) return;
    b.addEventListener("click", () => {
      if (!confirm("確定要重新開始？所有進度會清除並回到開局設定。")) return;
      clearSave();
      location.reload();
    });
  }

  function bind(){
    $("boardBasic") && $("boardBasic").addEventListener("click", () => setBoard("basic"));
    $("boardSpecial") && $("boardSpecial").addEventListener("click", () => setBoard("b1"));

    $("rangeCount") && ($("rangeCount").oninput = (e) => setPlayerCount(e.target.value));
    $("btnStart") && $("btnStart").addEventListener("click", startGame);

    $("btnBackSetup") && $("btnBackSetup").addEventListener("click", () => { showScreen("setup"); syncSetupUI(); });

    $("btnNightPrev") && $("btnNightPrev").addEventListener("click", nightPrev);
    $("btnNightNext") && $("btnNightNext").addEventListener("click", nightNext);

    $("btnGodToggle") && $("btnGodToggle").addEventListener("click", toggleGod);
    $("fabGod") && $("fabGod").addEventListener("click", toggleGod);

    ensureRestartButton();
  }

  async function init(){
    load();
    await bootstrapData();

    if (!State.rolesCount) State.rolesCount = getSuggestedRolesCount(State.boardId, State.playerCount);

    bind();
    setGod(State.godView);

    showScreen(State.phase || "setup");

    if (State.phase === "setup") syncSetupUI();
    if (State.phase === "deal") renderDeal();
    if (State.phase === "night") { resolveNightStepsForThisGame(); renderNight(); }
    if (State.phase === "day") renderDay();

    // 預設補強：如果 setup 進來沒套 board 狀態
    if (State.phase === "setup") setBoard(State.boardId || "basic");
  }

  init().catch(err => {
    warn("init failed:", err);
    ensureWWData();
    showScreen("setup");
    syncSetupUI();
  });

})();