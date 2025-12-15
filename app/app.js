/* =========================================================
   狼人殺｜上帝輔助 PWA — app/app.js（A 方案補丁骨架）
   ✅ 公告入口統一（btnOpenAnnouncement + fabAnn）
   ✅ 重新開始（btnRestart + modalRestart）
   ✅ 抽牌頁：dealSeats 點座位回看身分
   ✅ 上帝視角切換（btnGodToggle + fabGod + PIN modal）
   ✅ 兼容：缺少 id 不會整個掛掉（事件綁定防呆）
========================================================= */

(() => {
  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);

  // ========= Storage =========
  const STORAGE_KEY = "wolf_god_assist_rebuild_v1";
  function loadState(){
    try{ const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; }
    catch(e){ return null; }
  }
  function saveState(s){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }catch(e){}
  }
  function clearState(){
    try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
  }

  // ========= Data =========
  const DATA = window.WW_DATA || {};
  const roles = DATA.roles || DATA.rolesBase || {};
  const boards = DATA.boards || {};

  const FALLBACK_ROLES = {
    werewolf: { id: "werewolf", name: "狼人", team: "wolf", icon: "🐺" },
    villager:{ id: "villager",name: "村民", team: "villager", icon: "🧑‍🌾" },
    seer:    { id: "seer",    name: "預言家", team: "villager", icon: "🔮" },
    witch:   { id: "witch",   name: "女巫", team: "villager", icon: "🧪" },
    hunter:  { id: "hunter",  name: "獵人", team: "villager", icon: "🔫" },
    guard:   { id: "guard",   name: "守衛", team: "villager", icon: "🛡️" },
    blackWolfKing:{ id:"blackWolfKing", name:"黑狼王", team:"wolf", icon:"🐺👑" },
    whiteWolfKing:{ id:"whiteWolfKing", name:"白狼王", team:"wolf", icon:"🐺⚔️" },
    knight:{ id:"knight", name:"騎士", team:"villager", icon:"🗡️" }
  };
  function roleInfo(roleId){
    return roles?.[roleId] || FALLBACK_ROLES[roleId] || { id: roleId, name: roleId, team: "villager", icon:"❔" };
  }

  // ========= Minimal State (骨架) =========
  const DefaultState = {
    phase: "setup", // setup | deal | night | day

    // God view
    pin: "0000",
    godUnlocked: false,
    godView: false,

    // settings
    boardType: "basic",
    playerCount: 9,
    kidsMode: false,

    // deal
    players: [],      // {seat, roleId, team, alive, isChief}
    dealIndex: 0      // 目前輪到第幾位（0-based）
  };

  const State = Object.assign({}, DefaultState, loadState() || {});
  State.players = Array.isArray(State.players) ? State.players : [];
  saveState(State);

  // ========= Screens =========
  const Screens = {
    setup: $("screen-setup"),
    deal:  $("screen-deal"),
    night: $("screen-night"),
    day:   $("screen-day"),
  };
  function showScreen(name){
    Object.values(Screens).forEach(s => s && s.classList.remove("active"));
    Screens[name]?.classList.add("active");
    State.phase = name;
    saveState(State);
  }

  // ========= God toggle =========
  function setGodView(on){
    State.godView = !!on;
    document.body.classList.toggle("god-on", State.godView);

    const icon = State.godView ? "🔓" : "🔒";
    if ($("btnGodToggle")) $("btnGodToggle").textContent = icon;
    if ($("fabGod")) $("fabGod").textContent = icon;

    saveState(State);
  }

  function openGodModal(){
    const modal = $("modalGod");
    $("pinInput") && ($("pinInput").value = "");
    $("pinWarn")?.classList.add("hidden");
    modal?.classList.remove("hidden");
    $("pinInput")?.focus?.();
  }

  function toggleGod(){
    if(State.godView){ setGodView(false); return; }
    if(State.godUnlocked){ setGodView(true); return; }
    openGodModal();
  }

  on($("btnGodToggle"), "click", toggleGod);
  on($("fabGod"), "click", toggleGod);

  on($("closeGod"), "click", () => $("modalGod")?.classList.add("hidden"));
  on($("pinCancel"), "click", () => $("modalGod")?.classList.add("hidden"));
  on($("pinOk"), "click", () => {
    const v = ($("pinInput")?.value || "").trim();
    if(v === State.pin){
      State.godUnlocked = true;
      $("modalGod")?.classList.add("hidden");
      setGodView(true);
      saveState(State);
    }else{
      $("pinWarn")?.classList.remove("hidden");
    }
  });

  // ========= Announcement Center（A 方案：只有兩個入口） =========
  function openAnnouncement(){
    $("modalAnn")?.classList.remove("hidden");
  }
  function closeAnnouncement(){
    $("modalAnn")?.classList.add("hidden");
  }

  on($("btnOpenAnnouncement"), "click", openAnnouncement);
  on($("fabAnn"), "click", openAnnouncement);
  on($("closeAnn"), "click", closeAnnouncement);

  on($("annToday"), "click", () => {
    $("annToday")?.classList.add("active");
    $("annHistory")?.classList.remove("active");
    // 之後你的 logs 接回來時再渲染
  });
  on($("annHistory"), "click", () => {
    $("annHistory")?.classList.add("active");
    $("annToday")?.classList.remove("active");
    // 之後你的 logs 接回來時再渲染
  });
  on($("btnCopyAnn"), "click", async () => {
    try{
      await navigator.clipboard.writeText($("annBox")?.textContent || "");
      alert("已複製公告");
    }catch(e){
      alert("複製失敗（可能需要 HTTPS / PWA 安裝）");
    }
  });

  // ========= Restart (modal) =========
  function openRestart(){ $("modalRestart")?.classList.remove("hidden"); }
  function closeRestart(){ $("modalRestart")?.classList.add("hidden"); }

  on($("btnRestart"), "click", openRestart);
  on($("closeRestart"), "click", closeRestart);
  on($("restartCancel"), "click", closeRestart);
  on($("restartOk"), "click", () => {
    // 清除存檔 → 回到 setup
    clearState();
    location.reload();
  });

  // ========= Setup UI =========
  function suggestConfigBasic(n){
    // 先給一個最小預設（之後你要分 boards.basic.js 來產生）
    // 9人：2狼 預 女 獵 + 4民
    if(n === 9) return { werewolf:2, seer:1, witch:1, hunter:1, villager:4 };
    // 6~12 的簡單預設（先保底能玩）
    const wolves = n >= 9 ? 2 : 1;
    const fixed = 3; // seer+witch+hunter
    const villager = Math.max(0, n - wolves - fixed);
    return { werewolf:wolves, seer:1, witch:1, hunter:1, villager };
  }

  function buildPlayers(){
    // 先以 basic 預設抽牌（之後你會改成 boards / roles 完整分檔）
    const cfg = suggestConfigBasic(State.playerCount);
    const rolesArr = [];
    Object.entries(cfg).forEach(([rid,cnt])=>{
      for(let i=0;i<(cnt||0);i++) rolesArr.push(rid);
    });

    // 補齊（如果 cfg 不小心不足）
    while(rolesArr.length < State.playerCount) rolesArr.push("villager");
    // 剪裁（如果超過）
    rolesArr.length = State.playerCount;

    // shuffle
    for(let i=rolesArr.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [rolesArr[i], rolesArr[j]] = [rolesArr[j], rolesArr[i]];
    }

    State.players = rolesArr.map((rid, idx)=>({
      seat: idx+1,
      roleId: rid,
      team: roleInfo(rid).team || "villager",
      alive: true,
      isChief: false
    }));
    State.dealIndex = 0;
    saveState(State);
  }

  // 綁定 setup 互動
  function syncSetupUI(){
    $("playerCount") && ($("playerCount").textContent = String(State.playerCount));
    $("playerTotal") && ($("playerTotal").textContent = String(State.playerCount));
    $("rangeCount") && ($("rangeCount").value = String(State.playerCount));

    State.kidsMode = !!($("kidsToggle")?.checked);
    saveState(State);
  }

  on($("boardBasic"), "click", () => {
    State.boardType = "basic";
    $("boardBasic")?.classList.add("active");
    $("boardSpecial")?.classList.remove("active");
    saveState(State);
  });
  on($("boardSpecial"), "click", () => {
    State.boardType = "special";
    $("boardSpecial")?.classList.add("active");
    $("boardBasic")?.classList.remove("active");
    saveState(State);
  });

  on($("btnMinus"), "click", () => {
    State.playerCount = Math.max(6, Math.min(12, State.playerCount - 1));
    syncSetupUI();
  });
  on($("btnPlus"), "click", () => {
    State.playerCount = Math.max(6, Math.min(12, State.playerCount + 1));
    syncSetupUI();
  });
  on($("rangeCount"), "input", (e) => {
    State.playerCount = Math.max(6, Math.min(12, Number(e.target.value)));
    syncSetupUI();
  });

  on($("kidsToggle"), "change", () => {
    State.kidsMode = !!($("kidsToggle")?.checked);
    saveState(State);
  });

  on($("btnSuggest"), "click", () => {
    // 現在只是提示用途，之後由 boards.*.js 產生可編輯配置
    alert("目前為骨架版：稍後我們會用 boards 檔案提供可修改配置。");
  });

  on($("btnStart"), "click", () => {
    buildPlayers();
    showScreen("deal");
    renderDealSeats();
    updateDealPrompt();
  });

  // ========= Deal Page =========
  function updateDealPrompt(){
    const seat = State.dealIndex + 1;
    const total = State.players.length;
    if($("dealText")){
      $("dealText").innerHTML = seat <= total
        ? `請 <b>${seat} 號</b> 拿手機（可點座位回去重看）`
        : `所有玩家已抽完身分`;
    }
  }

  function renderDealSeats(){
    const box = $("dealSeats");
    if(!box) return;
    box.innerHTML = "";
    State.players.forEach(p=>{
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seat" + (p.alive ? "" : " dead");
      b.textContent = String(p.seat);

      // 目前輪到誰：高亮
      if(p.seat === State.dealIndex + 1) b.classList.add("selected");

      b.onclick = () => {
        State.dealIndex = p.seat - 1;
        saveState(State);
        renderDealSeats();
        updateDealPrompt();
      };
      box.appendChild(b);
    });
  }

  // 翻牌（長按）— 只做基本顯示
  let holdTimer = null;
  let revealShown = false;

  function showReveal(){
    if(State.dealIndex >= State.players.length) return;
    const p = State.players[State.dealIndex];
    const info = roleInfo(p.roleId);

    $("revealRole") && ($("revealRole").textContent = `${info.icon ? info.icon+" " : ""}${info.name}`);
    $("modalReveal")?.classList.remove("hidden");
    $("revealCard")?.classList.add("flipped");
    revealShown = true;
    navigator.vibrate?.(60);
  }

  function hideReveal(){
    if(!revealShown) return;
    $("revealCard")?.classList.remove("flipped");
    $("modalReveal")?.classList.add("hidden");
    revealShown = false;
  }

  const btnHold = $("btnHoldReveal");
  if(btnHold){
    const startHold = () => {
      clearTimeout(holdTimer);
      holdTimer = setTimeout(showReveal, 1200);
    };
    const endHold = () => {
      clearTimeout(holdTimer);
      hideReveal();
    };

    // iOS 防「長按放大」：touchstart preventDefault（但不要阻止 click）
    btnHold.addEventListener("touchstart", (e)=>{ e.preventDefault(); startHold(); }, {passive:false});
    btnHold.addEventListener("touchend", endHold);
    btnHold.addEventListener("touchcancel", endHold);

    on(btnHold, "mousedown", startHold);
    on(btnHold, "mouseup", endHold);
    on(btnHold, "mouseleave", endHold);
  }

  on($("btnNextPlayer"), "click", () => {
    hideReveal();
    State.dealIndex = Math.min(State.players.length, State.dealIndex + 1);
    saveState(State);
    renderDealSeats();
    updateDealPrompt();
  });

  on($("btnDealBack"), "click", () => {
    hideReveal();
    showScreen("setup");
  });

  on($("btnFinishDeal"), "click", () => {
    hideReveal();
    // 目前骨架：直接進夜晚（之後 night.js 接完整流程）
    showScreen("night");
    if($("nightScript")) $("nightScript").textContent = "（骨架版）夜晚流程之後會由 night.steps + rules 完整驅動。";
  });

  // ========= Boot =========
  function boot(){
    // 恢復 UI
    setGodView(!!State.godView);

    // 恢復 setup 開關
    if($("kidsToggle")) $("kidsToggle").checked = !!State.kidsMode;

    // 恢復板子選擇
    if(State.boardType === "special"){
      $("boardSpecial")?.classList.add("active");
      $("boardBasic")?.classList.remove("active");
    }else{
      $("boardBasic")?.classList.add("active");
      $("boardSpecial")?.classList.remove("active");
    }

    syncSetupUI();

    // 恢復畫面
    if(Screens[State.phase]) showScreen(State.phase);
    else showScreen("setup");

    if(State.phase === "deal"){
      renderDealSeats();
      updateDealPrompt();
    }
  }

  boot();
})();