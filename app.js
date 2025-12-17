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
  const STORAGE_KEY = "ww_official12_mvp_v1_2";

  const State = {
    phase:"setup",
    god:false,

    goodChoice:"guard", // guard | idiot
    wolfChoice:"w4",    // w4 | bk | wk | wking

    players:[],
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
      hunterShot:null,
    },
    witch:{ saveUsed:false, poisonUsed:false },

    logs:[],
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

  function db(){ return window.WW_DB || null; }
  function roleInfo(roleId){
    const r=db()?.roles?.[roleId];
    return r || {id:roleId, name:roleId, icon:"❔", team:"good"};
  }

  function roleAlive(roleId){
    return State.players.some(p => p.roleId===roleId && p.alive);
  }

  function setActive(btnIds, activeId){
    btnIds.forEach(id => $(id)?.classList.toggle("active", id===activeId));
  }

  /* ---------- build roles ---------- */
  function buildRoleList12(){
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

  function shuffle(arr){
    for(let i=arr.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }

  function syncSetupUI(){
    $("playerCount") && ($("playerCount").textContent="12");
    $("playerTotal") && ($("playerTotal").textContent="12");
    $("roleTotal") && ($("roleTotal").textContent="12");
    $("warnRoleTotal")?.classList.add("hidden");
    const btnStart=$("btnStart");
    if(btnStart){
      btnStart.disabled=false;
      btnStart.textContent="開始 → 抽身分";
    }
  }

  /* ---------- start / deal ---------- */
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
    navigator.vibrate?.(20);
  }
  function hideReveal(){ $("modalReveal")?.classList.add("hidden"); }

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

    $("btnFinishDeal") && ($("btnFinishDeal").onclick=startNight);
  }

  /* ---------- night flow ---------- */
  function flow(){
    const fId = db()?.boards?.official12?.nightFlowId;
    const steps = db()?.nightFlows?.[fId] || [];
    return steps.slice().sort((a,b)=>(a.order||0)-(b.order||0));
  }
  function step(){ return flow()[State.nightStepIndex] || null; }

  function scriptTextForStep(st){
    if(!st) return "（無流程）";
    const s = State.god ? (st.scripts?.god || st.scripts?.public) : (st.scripts?.public || st.scripts?.god);
    return s || "（無台詞）";
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
      b.onclick=()=> onNightPick(p.seat);
      box.appendChild(b);
    });
  }

  function renderNight(){
    $("nightTag") && ($("nightTag").textContent = `第 ${State.nightNo} 夜`);

    const st=step();
    if(!st){
      $("nightScript") && ($("nightScript").textContent="（夜晚流程結束）");
      return;
    }

    const lines=[scriptTextForStep(st)];

    // ✅ 守衛步驟：本局沒守衛也照唸，但提示「可直接下一步」
    if(st.type==="PICK" && st.roleKey==="guard" && !roleAlive("guard")){
      lines.push("\n（本局未啟用守衛：此步驟照唸即可，直接按『下一步』）");
    }

    // 預言家查驗結果（上帝提示）
    if(st.type==="SEER_CHECK" && State.nightState.seerCheck){
      const seat=State.nightState.seerCheck;
      const p=State.players.find(x=>x.seat===seat);
      if(p){
        const r=roleInfo(p.roleId);
        lines.push(`\n🔮 查驗 ${seat} 號 → ${r.icon} ${r.name}（${r.team==="wolf"?"狼人陣營":"好人陣營"}）`);
      }
    }

    // 女巫提示（不跳視窗）
    if(st.type==="WITCH"){
      const knife=State.nightState.wolfTarget || null;
      if(!roleAlive("witch")){
        lines.push("\n（女巫已死亡：此步驟照唸即可，直接按『下一步』）");
      }else{
        if(State.witch.saveUsed){
          lines.push(`\n🧪 解藥：已用過（本局不顯示刀口）`);
        }else{
          if(knife){
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
    }

    $("nightScript") && ($("nightScript").textContent = lines.join("\n"));

    let selected=null;
    if(st.type==="PICK" && st.pickKey) selected = State.nightState[st.pickKey] || null;
    if(st.type==="SEER_CHECK") selected = State.nightState.seerCheck || null;
    if(st.type==="WITCH") selected = State.nightState.witchPoison || (State.nightState.witchSave ? (State.nightState.wolfTarget||null) : null);
    renderSeatsNight(selected);
  }

  function onNightPick(seat){
    const st=step();
    if(!st) return;

    if(st.type==="PICK" && st.pickKey){
      // ✅ 守衛：本局沒守衛 → 不可選，但不該卡流程
      if(st.roleKey==="guard" && !roleAlive("guard")){
        navigator.vibrate?.(15);
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
      if(!roleAlive("seer")){
        navigator.vibrate?.(15);
        return;
      }
      State.nightState.seerCheck = seat;
      save(); renderNight();
      return;
    }

    if(st.type==="WITCH"){
      if(!roleAlive("witch")){
        navigator.vibrate?.(15);
        return;
      }

      const knife = State.nightState.wolfTarget || null;

      // 點刀口=救（不可自救）
      if(!State.witch.saveUsed && knife && seat===knife){
        const witchSeat = State.players.find(p=>p.roleId==="witch")?.seat;
        if(witchSeat===knife){
          navigator.vibrate?.(25);
          return;
        }
        State.nightState.witchSave = true;
        save(); renderNight();
        return;
      }

      // 其他=毒（一次）
      if(!State.witch.poisonUsed){
        State.nightState.witchPoison = seat;
        save(); renderNight();
        return;
      }

      navigator.vibrate?.(15);
      return;
    }

    navigator.vibrate?.(10);
  }

  function canNext(){
    const st=step();
    if(!st) return false;

    if(st.type==="PICK" && st.pickKey){
      // ✅ 修正重點：守衛步驟若本局沒有守衛 → 可直接下一步
      if(st.roleKey==="guard" && !roleAlive("guard")) return true;

      if(st.pickPolicy?.allowNull) return true;
      return !!State.nightState[st.pickKey];
    }

    if(st.type==="SEER_CHECK"){
      // 預言家死了也可直接過
      return !roleAlive("seer") ? true : !!State.nightState.seerCheck;
    }

    // WITCH: 可直接過（不用技能）
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
      navigator.vibrate?.(35);
      return;
    }

    if(st.type==="RESOLVE"){
      resolveNight();
      return;
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

  /* ---------- resolve / announcement / win ---------- */
  function killSeat(seat){
    const p=State.players.find(x=>x.seat===seat);
    if(p) p.alive=false;
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
    if(c.gods<=0) return { ended:true, text:"🐺 狼人獲勝（屠邊：神職全滅）" };
    if(c.villagers<=0) return { ended:true, text:"🐺 狼人獲勝（屠邊：平民全滅）" };
    if(c.wolves>=c.good) return { ended:true, text:"🐺 狼人獲勝（狼數≥好人）" };
    return { ended:false };
  }

  function resolveNight(){
    const dead=[];
    const knife = State.nightState.wolfTarget || null;
    const guard = State.nightState.guardTarget || null;

    if(knife) dead.push(knife);

    // 守衛擋刀（守衛存在且活著才算）
    if(knife && guard && roleAlive("guard") && knife===guard){
      const idx=dead.indexOf(knife);
      if(idx>=0) dead.splice(idx,1);
    }

    // 女巫救
    const witchSeat = State.players.find(p=>p.roleId==="witch")?.seat;
    if(roleAlive("witch") && !State.witch.saveUsed && State.nightState.witchSave && knife){
      if(witchSeat!==knife){
        const idx=dead.indexOf(knife);
        if(idx>=0) dead.splice(idx,1);
        State.witch.saveUsed=true;
      }
    }

    // 女巫毒
    if(roleAlive("witch") && !State.witch.poisonUsed && State.nightState.witchPoison){
      if(!dead.includes(State.nightState.witchPoison)) dead.push(State.nightState.witchPoison);
      State.witch.poisonUsed=true;
    }

    dead.forEach(seat => killSeat(seat));

    const text = dead.length
      ? `🌤️ 天亮了，昨晚死亡：${dead.join("、")} 號。`
      : `🌤️ 天亮了，昨晚是平安夜。`;

    State.logs.unshift({ text, ts: new Date().toISOString() });

    const win = checkWin();
    if(win.ended){
      State.logs.unshift({ text: `🏁 遊戲結束：${win.text}`, ts: new Date().toISOString() });
    }

    save();
    showScreen("day");
    renderDay();
    openAnn();
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

  function openAnn(){
    const box=$("annBox");
    if(box){
      box.textContent = State.logs.length ? State.logs.map(l => l.text).join("\n\n") : "（尚無公告）";
    }
    $("modalAnn")?.classList.remove("hidden");
  }
  function closeAnn(){ $("modalAnn")?.classList.add("hidden"); }

  function toggleGod(){
    State.god = !State.god;
    $("btnGod") && ($("btnGod").textContent = State.god ? "🔓" : "🔒");
    save();
    if(State.phase==="night") renderNight();
  }

  function bind(){
    // setup good choice
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

    // wolves
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
      navigator.vibrate?.(15);
    });

    // day
    $("btnDayToNight") && ($("btnDayToNight").onclick=nextDay);
  }

  function init(){
    load();
    bind();
    syncSetupUI();

    // restore active visuals
    setActive(["optGuard","optIdiot"], State.goodChoice==="guard" ? "optGuard" : "optIdiot");
    const wolfMap={w4:"optW4",bk:"optBK",wk:"optWK",wking:"optWKING"};
    setActive(["optW4","optBK","optWK","optWKING"], wolfMap[State.wolfChoice] || "optW4");

    $("btnGod") && ($("btnGod").textContent = State.god ? "🔓" : "🔒");

    showScreen(State.phase || "setup");
    if(State.phase==="deal") renderDeal();
    if(State.phase==="night") renderNight();
    if(State.phase==="day") renderDay();
  }

  init();
})();