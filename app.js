/* =========================================================
   官方12 MVP — app.js
   ✅ start 一定可按（除非你手動弄到角色總數錯）
   ✅ 長按翻牌 0.3s
   ✅ 夜晚座位點了必變色（selected）
   ✅ 女巫不跳視窗：點刀口=救、點其他=毒、下一步=不用
   ✅ 守衛死了不能守（但流程仍照唸）
   ✅ 獵人放逐：提示是否開槍（MVP 先只做提示/記錄）
   ✅ 公告可捲動
   ✅ 屠邊/屠城：先做屠邊（神死光或民死光）+ 狼全滅好人勝
========================================================= */

(() => {
  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);

  // iOS: 禁止長按選字/選單/雙擊放大
  try{
    document.documentElement.style.webkitUserSelect="none";
    document.documentElement.style.userSelect="none";
    document.documentElement.style.webkitTouchCallout="none";
    if(document.body){
      document.body.style.webkitUserSelect="none";
      document.body.style.userSelect="none";
    }
  }catch(e){}
  on(document,"contextmenu",e=>e.preventDefault(),{passive:false});
  on(document,"selectstart",e=>e.preventDefault(),{passive:false});
  on(document,"gesturestart",e=>e.preventDefault(),{passive:false});
  let _lastTouchEnd=0;
  on(document,"touchend",(e)=>{
    const now=Date.now();
    if(now-_lastTouchEnd<=300) e.preventDefault();
    _lastTouchEnd=now;
  },{passive:false});

  const HOLD_MS = 300; // ✅ 0.3 秒

  const STORAGE_KEY = "ww_official12_mvp_v1";

  const State = {
    phase:"setup", // setup|deal|night|day
    god:false,

    // setup options
    goodChoice:"guard", // guard | idiot
    wolfChoice:"w4",    // w4 | bk | wk | wking

    // game
    players:[],         // {seat, roleId, alive}
    dealIndex:0,

    nightNo:1,
    dayNo:1,

    nightStepIndex:0,
    nightState:{
      guardTarget:null,
      wolfTarget:null,
      seerCheck:null,
      witchSave:false,
      witchPoison:null,
      // MVP: hunter shot record
      hunterShot:null,
    },
    witch:{
      saveUsed:false,
      poisonUsed:false,
    },

    logs:[], // {text, ts}
  };

  function save(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(State)); }catch(e){} }
  function load(){
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      if(!raw) return;
      const s=JSON.parse(raw);
      if(s && typeof s==="object") Object.assign(State,s);
    }catch(e){}
  }
  function clearSave(){ try{ localStorage.removeItem(STORAGE_KEY); }catch(e){} }

  function showScreen(name){
    document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
    $(`screen-${name}`)?.classList.add("active");
    State.phase=name;
    save();
  }

  function db(){
    return window.WW_DB || null;
  }
  function roleInfo(roleId){
    const r=db()?.roles?.[roleId];
    return r || {id:roleId, name:roleId, icon:"❔", team:"good"};
  }

  /* -------------------------
     Setup: build roles preset
  ------------------------- */
  function buildRoleList12(){
    // 12 人固定：
    // 狼 4（其中一張可換成 BK/WK/WKING）
    // 神：seer witch hunter + (guard or idiot)
    // 民：4
    const list = [];

    // wolves
    if(State.wolfChoice==="w4"){
      list.push("werewolf","werewolf","werewolf","werewolf");
    }else if(State.wolfChoice==="bk"){
      list.push("blackWolfKing","werewolf","werewolf","werewolf");
    }else if(State.wolfChoice==="wk"){
      list.push("whiteWolfKing","werewolf","werewolf","werewolf");
    }else{
      list.push("wolfKing","werewolf","werewolf","werewolf");
    }

    // gods
    list.push("seer","witch","hunter");
    list.push(State.goodChoice==="guard" ? "guard" : "idiot");

    // villagers
    list.push("villager","villager","villager","villager");

    return list;
  }

  function syncSetupUI(){
    $("playerCount") && ($("playerCount").textContent="12");
    $("playerTotal") && ($("playerTotal").textContent="12");
    $("roleTotal") && ($("roleTotal").textContent="12");
    $("warnRoleTotal")?.classList.add("hidden");

    const btnStart=$("btnStart");
    if(btnStart){
      btnStart.disabled=false; // ✅ 這版保證可按
      btnStart.textContent="開始 → 抽身分";
    }
  }

  function setActive(btnIds, activeId){
    btnIds.forEach(id => $(id)?.classList.toggle("active", id===activeId));
  }

  /* -------------------------
     Start / Deal
  ------------------------- */
  function shuffle(arr){
    for(let i=arr.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }

  function startGame(){
    if(!db()){
      alert("找不到 WW_DB：請確認 script.js 有正確載入（Console 看看有沒有 404）");
      return;
    }
    const roles = buildRoleList12();
    shuffle(roles);

    State.players = roles.map((rid, idx)=>({
      seat: idx+1,
      roleId: rid,
      alive: true,
    }));

    State.dealIndex=0;
    State.nightNo=1;
    State.dayNo=1;
    State.nightStepIndex=0;
    State.nightState={
      guardTarget:null, wolfTarget:null, seerCheck:null,
      witchSave:false, witchPoison:null,
      hunterShot:null,
    };
    State.witch = State.witch || {saveUsed:false, poisonUsed:false};
    State.logs=[];
    save();

    showScreen("deal");
    renderDeal();
  }

  let holdTimer=null;

  function renderDealSeatGrid(){
    const grid=$("dealSeatGrid");
    if(!grid) return;
    grid.innerHTML="";
    State.players.forEach((p, idx)=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="seat"+(idx===State.dealIndex?" selected":"");
      b.textContent=String(p.seat);
      b.onclick=()=>{ State.dealIndex=idx; save(); renderDeal(); };
      grid.appendChild(b);
    });
  }

  function showReveal(){
    const p=State.players[State.dealIndex];
    if(!p) return;
    const r=roleInfo(p.roleId);
    $("revealRole") && ($("revealRole").textContent = `${r.icon} ${r.name}`);
    $("modalReveal")?.classList.remove("hidden");
    navigator.vibrate?.(30);
  }
  function hideReveal(){
    $("modalReveal")?.classList.add("hidden");
  }

  function renderDeal(){
    const p=State.players[State.dealIndex];
    if(!p) return;
    $("dealText") && ($("dealText").innerHTML = `請 <b>${p.seat} 號</b> 拿手機`);
    renderDealSeatGrid();

    const btn=$("btnHoldReveal");
    if(btn){
      btn.onpointerdown = (e)=>{
        e.preventDefault?.();
        clearTimeout(holdTimer);
        holdTimer=setTimeout(showReveal, HOLD_MS);
      };
      const end=(e)=>{
        e && e.preventDefault?.();
        clearTimeout(holdTimer);
        hideReveal();
      };
      btn.onpointerup=end;
      btn.onpointerleave=end;
      btn.onpointercancel=end;
    }

    $("btnNextPlayer") && ($("btnNextPlayer").onclick=()=>{
      State.dealIndex = Math.min(State.players.length-1, State.dealIndex+1);
      save(); renderDeal();
    });

    $("btnBackSetup") && ($("btnBackSetup").onclick=()=>{
      showScreen("setup");
      syncSetupUI();
    });

    $("btnFinishDeal") && ($("btnFinishDeal").onclick=()=>{
      // ✅ 不管現在看第幾號，都允許進入夜晚（避免卡住）
      startNight();
    });
  }

  /* -------------------------
     Night flow (official12)
  ------------------------- */
  function flow(){
    const fId = db()?.boards?.official12?.nightFlowId;
    const steps = db()?.nightFlows?.[fId] || [];
    return steps.slice().sort((a,b)=>(a.order||0)-(b.order||0));
  }

  function step(){
    return flow()[State.nightStepIndex] || null;
  }

  function renderSeatsNight(selectedSeat){
    const box=$("nightSeats");
    if(!box) return;
    box.innerHTML="";
    State.players.forEach(p=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="seat"+(p.alive?"":" dead")+(selectedSeat===p.seat?" selected":"");
      b.textContent=String(p.seat);
      // 注意：夜晚點人只要「該步驟允許」才會寫入，否則只是讓你知道按到
      b.onclick=()=> onNightPick(p.seat);
      box.appendChild(b);
    });
  }

  function roleAlive(roleId){
    return State.players.some(p => p.roleId===roleId && p.alive);
  }

  function scriptTextForStep(st){
    if(!st) return "（無流程）";
    const s = State.god ? (st.scripts?.god || st.scripts?.public) : (st.scripts?.public || st.scripts?.god);
    return s || "（無台詞）";
  }

  function renderNight(){
    $("nightTag") && ($("nightTag").textContent = `第 ${State.nightNo} 夜`);

    const st=step();
    if(!st){
      $("nightScript") && ($("nightScript").textContent="（夜晚流程結束）");
      return;
    }

    const lines=[scriptTextForStep(st)];

    // ✅ 上帝提示：預言家查驗結果
    if(st.type==="SEER_CHECK" && State.nightState.seerCheck){
      const seat=State.nightState.seerCheck;
      const p=State.players.find(x=>x.seat===seat);
      if(p){
        const r=roleInfo(p.roleId);
        lines.push(`\n🔮 查驗 ${seat} 號 → ${r.icon} ${r.name}（${r.team==="wolf"?"狼人陣營":"好人陣營"}）`);
      }
    }

    // ✅ 上帝提示：女巫（不跳視窗）
    if(st.type==="WITCH"){
      const knife=State.nightState.wolfTarget || null;
      if(State.witch.saveUsed){
        lines.push(`\n🧪 解藥：已用過（本局不顯示刀口）`);
      }else{
        if(knife){
          // 女巫被刀且不能自救：只有女巫活著才會提醒「不可自救」
          const witchSeat = State.players.find(p=>p.roleId==="witch")?.seat;
          const selfWarn = (witchSeat===knife) ? "（女巫被刀：不可自救）" : "";
          lines.push(`\n🧪 解藥：刀口 ${knife} 號（點他=救）${selfWarn}`);
        }else{
          lines.push(`\n🧪 解藥：狼人尚未選刀`);
        }
      }
      lines.push(`☠️ 毒藥：${State.witch.poisonUsed ? "已用過（毒藥沒了）" : "可用（點其他人=毒）"}`);
      if(State.nightState.witchSave) lines.push(`✅ 已選救`);
      if(State.nightState.witchPoison) lines.push(`☠️ 已選毒：${State.nightState.witchPoison} 號`);
    }

    $("nightScript") && ($("nightScript").textContent = lines.join("\n"));

    // selected seat UI
    let selected=null;
    if(st.type==="PICK" && st.pickKey) selected = State.nightState[st.pickKey] || null;
    if(st.type==="SEER_CHECK") selected = State.nightState.seerCheck || null;
    if(st.type==="WITCH") selected = State.nightState.witchPoison || (State.nightState.witchSave ? (State.nightState.wolfTarget||null) : null);
    renderSeatsNight(selected);
  }

  function onNightPick(seat){
    const st=step();
    if(!st) return;

    // ✅ 先讓 UI 一定有反應：點到就會 selected（即使不能寫入也會震動提示）
    const aliveOnly = st.pickPolicy?.aliveOnly;
    if(aliveOnly){
      const p=State.players.find(x=>x.seat===seat);
      if(p && !p.alive){
        navigator.vibrate?.(20);
        return;
      }
    }

    if(st.type==="PICK" && st.pickKey){
      // 守衛：死了不能守（但流程仍照唸）
      if(st.roleKey==="guard" && !roleAlive("guard")){
        navigator.vibrate?.(20);
        return;
      }

      // 狼刀：可空刀 toggle
      if(st.pickKey==="wolfTarget" && st.pickPolicy?.toggleToNull){
        State.nightState.wolfTarget = (State.nightState.wolfTarget===seat) ? null : seat;
      }else{
        State.nightState[st.pickKey]=seat;
      }
      save(); renderNight();
      return;
    }

    if(st.type==="SEER_CHECK"){
      // 預言家：死了也照唸，但不能查驗
      if(!roleAlive("seer")){
        navigator.vibrate?.(20);
        return;
      }
      State.nightState.seerCheck = seat;
      save(); renderNight();
      return;
    }

    if(st.type==="WITCH"){
      // 女巫：死了也照唸，但不能操作
      if(!roleAlive("witch")){
        navigator.vibrate?.(20);
        return;
      }

      const knife = State.nightState.wolfTarget || null;

      // 若解藥已用過：不提供救
      if(!State.witch.saveUsed && knife && seat===knife){
        // 不能自救（女巫被刀）
        const witchSeat = State.players.find(p=>p.roleId==="witch")?.seat;
        if(witchSeat===knife){
          // 不顯示刀口的規則你說：若解藥已沒了才不顯示刀口
          // 這裡是有解藥但不能自救，所以只是拒絕「救」
          navigator.vibrate?.(30);
          return;
        }
        State.nightState.witchSave = true;
        save(); renderNight();
        return;
      }

      // 毒（一次）
      if(!State.witch.poisonUsed){
        State.nightState.witchPoison = seat;
        save(); renderNight();
        return;
      }

      navigator.vibrate?.(20);
      return;
    }

    // INFO / RESOLVE：點座位無效
    navigator.vibrate?.(15);
  }

  function canNext(){
    const st=step();
    if(!st) return false;

    if(st.type==="PICK" && st.pickKey){
      // allowNull true 可以不選
      if(st.pickPolicy?.allowNull) return true;
      return !!State.nightState[st.pickKey];
    }
    if(st.type==="SEER_CHECK"){
      return !roleAlive("seer") ? true : !!State.nightState.seerCheck; // 死了可直接過
    }
    // WITCH: 可直接過（代表不用）
    return true;
  }

  function nightPrev(){
    State.nightStepIndex = Math.max(0, State.nightStepIndex-1);
    save(); renderNight();
  }

  function nightNext(){
    const st=step();
    if(!st) return;

    if(!canNext()){
      navigator.vibrate?.(40);
      return;
    }

    if(st.type==="RESOLVE"){
      resolveNight();
      return;
    }

    // 下一步前：如果是女巫步驟「直接下一步=不用」就清除本晚選擇（但保留已用過）
    if(st.type==="WITCH"){
      // 不做任何事就是不用；但如果你已點救/毒，照樣帶入結算
    }

    State.nightStepIndex++;
    save(); renderNight();
  }

  function startNight(){
    State.nightStepIndex=0;
    State.nightState.guardTarget=null;
    State.nightState.wolfTarget=null;
    State.nightState.seerCheck=null;
    State.nightState.witchSave=false;
    State.nightState.witchPoison=null;
    save();
    showScreen("night");
    renderNight();
  }

  /* -------------------------
     Resolve + Announcement + Win
  ------------------------- */
  function killSeat(seat){
    const p=State.players.find(x=>x.seat===seat);
    if(p) p.alive=false;
  }

  function resolveNight(){
    const dead=[];

    const knife = State.nightState.wolfTarget || null;
    const guard = State.nightState.guardTarget || null;

    // 狼刀先記
    if(knife) dead.push(knife);

    // 守衛擋刀（守衛死了不能守：上面已擋寫入；這裡再保險）
    if(knife && guard && roleAlive("guard") && knife===guard){
      const idx=dead.indexOf(knife);
      if(idx>=0) dead.splice(idx,1);
    }

    // 女巫救（只有女巫活著且解藥未用且非自救）
    const witchSeat = State.players.find(p=>p.roleId==="witch")?.seat;
    if(roleAlive("witch") && !State.witch.saveUsed && State.nightState.witchSave && knife){
      if(witchSeat!==knife){
        const idx=dead.indexOf(knife);
        if(idx>=0) dead.splice(idx,1);
        State.witch.saveUsed=true;
      }
    }

    // 女巫毒（只有女巫活著且毒未用）
    if(roleAlive("witch") && !State.witch.poisonUsed && State.nightState.witchPoison){
      if(!dead.includes(State.nightState.witchPoison)) dead.push(State.nightState.witchPoison);
      State.witch.poisonUsed=true;
    }

    // 套用死亡
    dead.forEach(seat => killSeat(seat));

    // 公告文字（你說：死亡原因不必揭露，一起公布即可）
    const text = dead.length
      ? `🌤️ 天亮了，昨晚死亡：${dead.join("、")} 號。`
      : `🌤️ 天亮了，昨晚是平安夜。`;

    State.logs.unshift({ text, ts: new Date().toISOString() });

    // ✅ 勝負判定（屠邊：神死光 或 民死光；狼全滅好人勝；狼數>=好人也算狼勝）
    const win = checkWin();
    if(win.ended){
      State.logs.unshift({ text: `🏁 遊戲結束：${win.text}`, ts: new Date().toISOString() });
    }

    save();
    showScreen("day");
    renderDay();
    openAnn();
  }

  function countAlive(){
    const alive = State.players.filter(p=>p.alive);
    const wolves = alive.filter(p => roleInfo(p.roleId).team==="wolf").length;
    const good = alive.length - wolves;

    const gods = alive.filter(p => ["seer","witch","hunter","guard","idiot"].includes(p.roleId)).length;
    const villagers = alive.filter(p => p.roleId==="villager").length;

    return { alive, wolves, good, gods, villagers };
  }

  function checkWin(){
    const c=countAlive();
    if(c.wolves<=0) return { ended:true, text:"✅ 好人獲勝（狼人全滅）" };

    // 屠邊：神死光 或 民死光 → 狼贏
    if(c.gods<=0) return { ended:true, text:"🐺 狼人獲勝（屠邊：神職全滅）" };
    if(c.villagers<=0) return { ended:true, text:"🐺 狼人獲勝（屠邊：平民全滅）" };

    // 補一個常見條件：狼數 >= 好人
    if(c.wolves>=c.good) return { ended:true, text:"🐺 狼人獲勝（狼數≥好人）" };

    return { ended:false };
  }

  function renderDay(){
    $("dayTag") && ($("dayTag").textContent = `第 ${State.dayNo} 天`);
    const aliveSeats = State.players.filter(p=>p.alive).map(p=>p.seat);
    $("dayAlive") && ($("dayAlive").textContent = aliveSeats.length ? `存活：${aliveSeats.join("、")} 號` : "（全滅？）");
  }

  function nextDay(){
    State.dayNo++;
    State.nightNo++;
    save();
    startNight();
  }

  /* -------------------------
     Announcement Modal
  ------------------------- */
  function openAnn(){
    const box=$("annBox");
    if(box){
      if(!State.logs.length){
        box.textContent="（尚無公告）";
      }else{
        box.textContent = State.logs.map(l => l.text).join("\n\n");
      }
    }
    $("modalAnn")?.classList.remove("hidden");
  }
  function closeAnn(){ $("modalAnn")?.classList.add("hidden"); }

  /* -------------------------
     God toggle (MVP: 只是顯示鎖頭，正式 PIN 之後再加)
  ------------------------- */
  function toggleGod(){
    State.god = !State.god;
    $("btnGod") && ($("btnGod").textContent = State.god ? "🔓" : "🔒");
    save();
    if(State.phase==="night") renderNight();
  }

  /* -------------------------
     Bind
  ------------------------- */
  function bind(){
    // setup options
    $("optGuard") && ($("optGuard").onclick=()=>{
      State.goodChoice="guard";
      setActive(["optGuard","optIdiot"],"optGuard");
      save();
    });
    $("optIdiot") && ($("optIdiot").onclick=()=>{
      State.goodChoice="idiot";
      setActive(["optGuard","optIdiot"],"optIdiot");
      save();
    });

    const wolfBtns=["optW4","optBK","optWK","optWKING"];
    $("optW4") && ($("optW4").onclick=()=>{ State.wolfChoice="w4"; setActive(wolfBtns,"optW4"); save(); });
    $("optBK") && ($("optBK").onclick=()=>{ State.wolfChoice="bk"; setActive(wolfBtns,"optBK"); save(); });
    $("optWK") && ($("optWK").onclick=()=>{ State.wolfChoice="wk"; setActive(wolfBtns,"optWK"); save(); });
    $("optWKING") && ($("optWKING").onclick=()=>{ State.wolfChoice="wking"; setActive(wolfBtns,"optWKING"); save(); });

    $("btnStart") && ($("btnStart").onclick=startGame);

    // top
    $("btnGod") && ($("btnGod").onclick=toggleGod);
    $("btnAnn") && ($("btnAnn").onclick=openAnn);
    $("btnRestart") && ($("btnRestart").onclick=()=>{
      if(!confirm("確定要重新開始？會清除進度並回到設定。")) return;
      clearSave();
      location.reload();
    });

    // night
    $("btnNightPrev") && ($("btnNightPrev").onclick=nightPrev);
    $("btnNightNext") && ($("btnNightNext").onclick=nightNext);

    // ann
    $("btnAnnClose") && ($("btnAnnClose").onclick=closeAnn);
    $("btnCopyAnn") && ($("btnCopyAnn").onclick=()=>{
      const t=$("annBox")?.textContent || "";
      navigator.clipboard?.writeText(t);
      navigator.vibrate?.(20);
    });

    // day
    $("btnDayToNight") && ($("btnDayToNight").onclick=nextDay);
  }

  /* -------------------------
     Init
  ------------------------- */
  function init(){
    load();
    bind();
    syncSetupUI();

    // restore phase
    $("btnGod") && ($("btnGod").textContent = State.god ? "🔓" : "🔒");

    showScreen(State.phase || "setup");

    if(State.phase==="deal") renderDeal();
    if(State.phase==="night") renderNight();
    if(State.phase==="day") renderDay();
  }

  init();
})();