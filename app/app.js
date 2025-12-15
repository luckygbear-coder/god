/* =========================================================
   狼人殺｜上帝輔助 PWA
   檔案：/app/app.js

   ✅ 入口整合（穩定版）
   - setup / deal / night / day 切頁
   - 上帝視角 🔒/🔓 everywhere
   - 女巫彈窗（night.js）
   - 投票彈窗 / 平票彈窗 / 技能彈窗（day.js + rules.core）
   - 公告中心（今日/歷史；上帝可看 hidden + votes + actions）
   - 重新開始（確認後回 setup）
   - 小朋友模式：夜晚台詞 + 早上公告原因推測（守/救/空刀）
========================================================= */

(function () {
  window.WW = window.WW || {};
  window.WW_DATA = window.WW_DATA || {};

  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const nowISO = () => new Date().toISOString();

  /* =========================
     iOS 防長按選字 / 放大
  ========================= */
  try {
    document.documentElement.style.webkitUserSelect = "none";
    document.documentElement.style.userSelect = "none";
    document.documentElement.style.webkitTouchCallout = "none";
    document.body && (document.body.style.webkitUserSelect = "none");
    document.body && (document.body.style.userSelect = "none");
    document.body && (document.body.style.webkitTouchCallout = "none");
  } catch(e){}

  function preventTouchSelect(el){
    if(!el) return;
    el.addEventListener("touchstart", (e)=>{ e.preventDefault(); }, {passive:false});
  }

  /* =========================
     State boot
  ========================= */
  let State = window.WW.state.load() || window.WW.state.defaultState();
  window.WW.state.save(State);

  /* =========================
     Screens
  ========================= */
  const Screens = {
    setup: $("screen-setup"),
    deal:  $("screen-deal"),
    night: $("screen-night"),
    day:   $("screen-day")
  };

  function showScreen(name){
    Object.values(Screens).forEach(s=>s && s.classList.remove("active"));
    Screens[name]?.classList.add("active");
    State.phase = name;
    window.WW.state.save(State);

    // 標籤更新
    if(name==="night") $("nightTag") && ($("nightTag").textContent = `第 ${State.nightNo} 夜`);
    if(name==="day") $("dayTag") && ($("dayTag").textContent = `第 ${State.dayNo} 天`);
  }

  /* =========================
     上帝視角
  ========================= */
  function setGodView(on){
    State.godView = !!on;
    document.body.classList.toggle("god-on", State.godView);

    const icon = State.godView ? "🔓" : "🔒";
    $("btnGodToggle") && ($("btnGodToggle").textContent = icon);
    $("fabGod") && ($("fabGod").textContent = icon);

    window.WW.state.save(State);
    renderAnnouncementBox(); // 公告中心切換 hidden
  }

  function openGodModal(){
    const modal = $("modalGod");
    const input = $("pinInput");
    const warn = $("pinWarn");

    if(!modal) { alert("缺少 modalGod"); return; }
    warn && warn.classList.add("hidden");
    input && (input.value="");
    modal.classList.remove("hidden");
    input && input.focus?.();
  }

  function toggleGod(){
    if(State.godView){ setGodView(false); return; }
    if(State.godUnlocked){ setGodView(true); return; }
    openGodModal();
  }

  on($("btnGodToggle"), "click", toggleGod);
  on($("fabGod"), "click", toggleGod);
  on($("closeGod"), "click", ()=> $("modalGod")?.classList.add("hidden"));
  on($("pinCancel"), "click", ()=> $("modalGod")?.classList.add("hidden"));
  on($("pinOk"), "click", ()=>{
    const v = ($("pinInput")?.value || "").trim();
    if(v === (State.pin || "0000")){
      State.godUnlocked = true;
      $("modalGod")?.classList.add("hidden");
      setGodView(true);
    }else{
      $("pinWarn")?.classList.remove("hidden");
    }
  });

  /* =========================
     重新開始（你要的確認視窗）
  ========================= */
  function ensureRestartButton(){
    const header = document.querySelector(".top-actions");
    if(!header) return;
    if($("btnRestart")) return;

    const btn = document.createElement("button");
    btn.id = "btnRestart";
    btn.className = "iconbtn";
    btn.type = "button";
    btn.title = "重新開始";
    btn.textContent = "🔁";
    header.insertBefore(btn, header.firstChild);

    on(btn, "click", ()=>{
      if(confirm("確定要重新開始？\n（會清除本局進度並回到選板子/配置）")){
        State = window.WW.state.resetToSetup(State);
        location.reload();
      }
    });
  }

  /* =========================
     Setup：板子/人數/配置（這版先最小化：按開始就 newGame）
  ========================= */
  function bindSetup(){
    const range = $("rangeCount");
    const plus = $("btnPlus");
    const minus = $("btnMinus");

    const boardBasic = $("boardBasic");
    const boardB1 = $("boardSpecial");

    const txtCount = $("playerCount");

    function renderSetup(){
      txtCount && (txtCount.textContent = String(State.playerCount));
      range && (range.value = String(State.playerCount));

      // 顯示角色總數
      const rolesCount = State.rolesCount || window.WW.state.suggestRolesByBoard(State.boardId, State.playerCount) || {};
      const total = Object.values(rolesCount).reduce((a,b)=>a+(b||0),0);

      $("roleTotal") && ($("roleTotal").textContent = String(total));
      $("playerTotal") && ($("playerTotal").textContent = String(State.playerCount));

      const ok = total === State.playerCount;
      $("warnRoleTotal")?.classList.toggle("hidden", ok);
      if($("btnStart")){
        $("btnStart").disabled = !ok;
        $("btnStart").textContent = ok ? "開始 → 抽身分" : "⚠️ 角色數需等於玩家數";
      }

      // active 樣式
      boardBasic?.classList.toggle("active", State.boardId==="basic");
      boardB1?.classList.toggle("active", State.boardId==="b1");

      window.WW.state.save(State);
    }

    on(plus,"click",()=>{
      State.playerCount = clamp((State.playerCount||9)+1, 6, 12);
      State.rolesCount = window.WW.state.suggestRolesByBoard(State.boardId, State.playerCount);
      renderSetup();
    });
    on(minus,"click",()=>{
      State.playerCount = clamp((State.playerCount||9)-1, 6, 12);
      State.rolesCount = window.WW.state.suggestRolesByBoard(State.boardId, State.playerCount);
      renderSetup();
    });
    on(range,"input",(e)=>{
      State.playerCount = clamp(Number(e.target.value||9), 6, 12);
      State.rolesCount = window.WW.state.suggestRolesByBoard(State.boardId, State.playerCount);
      renderSetup();
    });

    on(boardBasic,"click",()=>{
      State.boardId = "basic";
      State.rolesCount = window.WW.state.suggestRolesByBoard(State.boardId, State.playerCount);
      renderSetup();
    });
    on(boardB1,"click",()=>{
      State.boardId = "b1";
      State.rolesCount = window.WW.state.suggestRolesByBoard(State.boardId, State.playerCount);
      renderSetup();
    });

    // 建議配置（直接拉 presets）
    on($("btnSuggest"),"click",()=>{
      State.rolesCount = window.WW.state.suggestRolesByBoard(State.boardId, State.playerCount);
      renderSetup();
    });

    // ✅ 開始：newGame → deal
    on($("btnStart"),"click",()=>{
      State.rolesCount = State.rolesCount || window.WW.state.suggestRolesByBoard(State.boardId, State.playerCount);
      // 總數檢查
      const total = Object.values(State.rolesCount||{}).reduce((a,b)=>a+(b||0),0);
      if(total !== State.playerCount){
        alert("角色總數必須等於玩家人數");
        return;
      }
      State = window.WW.state.newGame(State);
      showScreen("deal");
      renderDeal();
    });

    // kidsMode toggle（若你有開關 id=kidsToggle）
    on($("kidsToggle"),"change",(e)=>{
      State.settings = State.settings || {};
      State.settings.kidsMode = !!e.target.checked;
      window.WW.state.save(State);
    });

    renderSetup();
  }

  /* =========================
     Deal：抽牌（可回頭點座位再長按看身分）
  ========================= */
  let holdTimer=null, revealShown=false;

  function renderDeal(){
    const dealText = $("dealText");
    const seat = (State.dealIndex||0) + 1;
    const total = State.players?.length || 0;

    if(dealText){
      dealText.innerHTML = seat <= total
        ? `請 <b>${seat} 號</b> 拿手機`
        : `所有玩家已抽完身分`;
    }

    // 讓玩家可以點座位回去查看（你要的 2.2）
    const seats = $("dealSeats");
    if(seats){
      seats.innerHTML = "";
      (State.players||[]).forEach(p=>{
        const b = document.createElement("button");
        b.type="button";
        b.className = "seat" + (p.alive ? "" : " dead");
        b.textContent = String(p.seat);
        if(p.seat === seat) b.classList.add("selected");
        b.onclick = ()=>{
          State.dealIndex = p.seat - 1;
          window.WW.state.save(State);
          renderDeal();
        };
        seats.appendChild(b);
      });
    }

    window.WW.state.save(State);
  }

  function roleInfo(roleId){
    const r = window.WW_DATA.getRole ? window.WW_DATA.getRole(roleId) : (window.WW_DATA.roles?.[roleId]||null);
    return r || { name: roleId, icon:"❔" };
  }

  function showReveal(){
    const idx = State.dealIndex || 0;
    if(!State.players?.[idx]) return;
    const p = State.players[idx];
    const info = roleInfo(p.roleId);

    $("revealRole") && ($("revealRole").textContent = `${info.icon?info.icon+" ":""}${info.name}`);
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

  function bindDeal(){
    const holdBtn = $("btnHoldReveal");
    if(holdBtn){
      preventTouchSelect(holdBtn);

      const startHold = ()=>{
        clearTimeout(holdTimer);
        holdTimer = setTimeout(showReveal, 1200);
      };
      const endHold = ()=>{
        clearTimeout(holdTimer);
        hideReveal();
      };

      on(holdBtn,"touchstart",startHold,{passive:true});
      on(holdBtn,"touchend",endHold);
      on(holdBtn,"touchcancel",endHold);
      on(holdBtn,"mousedown",startHold);
      on(holdBtn,"mouseup",endHold);
      on(holdBtn,"mouseleave",endHold);
    }

    on($("btnNextPlayer"),"click",()=>{
      hideReveal();
      State.dealIndex = (State.dealIndex||0) + 1;
      window.WW.state.save(State);
      renderDeal();
    });

    on($("btnDealBack"),"click",()=>{
      hideReveal();
      showScreen("setup");
    });

    // 全部抽完後必須按確認才進夜晚（你要的 2.2）
    on($("btnFinishDeal"),"click",()=>{
      hideReveal();
      if((State.dealIndex||0) < (State.players?.length||0)-1){
        if(!confirm("還有人沒確認身分，確定要進入夜晚？")) return;
      }
      // 初始化夜晚
      window.WW.night.initNight(State);
      showScreen("night");
      window.WW.night.renderNight(State);
    });
  }

  /* =========================
     Night：wizard + 女巫彈窗 + 結算到 Day
  ========================= */
  function bindNight(){
    on($("btnNightPrev"),"click",()=>{
      window.WW.night.prevStep(State);
      window.WW.night.renderNight(State);
    });

    on($("btnNightNext"),"click",()=>{
      const step = window.WW.night.nextStep(State);
      if(step.action==="blocked"){
        alert("請先完成本步驟（點選座位）");
        return;
      }
      if(step.action==="witch"){
        window.WW.night.openWitchModal(State);
        return;
      }
      if(step.action==="resolve"){
        const out = window.WW.night.resolveNightToDay(State);
        if(!out) return;

        // ✅ 夜晚結束必跳公告（你要求）
        openAnnouncementModal(true); // forceToday
        // ✅ 初始化白天
        window.WW.day.initDay(State);

        showScreen("day");
        renderDayTag();
        return;
      }

      window.WW.night.renderNight(State);
    });
  }

  function renderDayTag(){
    $("dayTag") && ($("dayTag").textContent = `第 ${State.dayNo} 天`);
  }

  /* =========================
     Day：上警/發言/投票/平票/下一夜
  ========================= */
  function bindDay(){
    // 上警
    on($("btnPolice"),"click",()=>{
      openPoliceModal();
    });

    // 發言順序
    on($("btnTalkOrder"),"click",()=>{
      openSpeechModal();
    });

    // 投票
    on($("btnVote"),"click",()=>{
      // 開始投票（normal）
      window.WW.day.startVote(State, { mode:"normal", restrictTargets:null, label:"投票" });
      openVoteModal();
      renderVoteUI();
    });

    // 白天下一步（進下一夜）
    on($("btnDayNext"),"click",()=>{
      // 若還在 tie/voting，day.js 會回原因
      const out = window.WW.day.goNextNight(State);
      if(!out.ok){
        if(out.reason==="tie_pending"){
          alert("目前有平票尚未處理，請先選擇 PK / 重投 / 無人出局");
          openTieModal();
          return;
        }
        if(out.reason==="voting_pending"){
          alert("投票尚未完成，請先完成投票");
          openVoteModal();
          return;
        }
        if(out.reason==="ended_now" || out.reason==="ended"){
          openAnnouncementModal(true);
          return;
        }
        return;
      }

      // 初始化下一夜
      window.WW.night.initNight(State);
      showScreen("night");
      window.WW.night.renderNight(State);
    });
  }

  /* =========================================================
     公告中心（今日/歷史 + 上帝 hidden + votes + actions）
  ========================================================= */
  let annMode="today";

  function formatVotes(votes){
    if(!votes?.length) return "—";
    const map = new Map();
    votes.forEach(v=>{
      const key = v.toSeat ? `${v.toSeat}號` : "棄票";
      map.set(key,(map.get(key)||0)+1);
    });
    const lines = [];
    for(const [k,c] of map.entries()) lines.push(`${k}：${c} 票`);
    lines.push("");
    votes.forEach(v=> lines.push(`${v.fromSeat}號 → ${v.toSeat ? (v.toSeat+"號") : "棄票"}`));
    return lines.join("\n");
  }

  function kidsExplainFromLatestLog(){
    if(!State.settings?.kidsMode) return "";
    const log = State.logs?.[0];
    if(!log) return "";

    // 只針對夜晚公告補充推測
    const resolved = log.resolvedMeta || null;
    const night = log.actions?.night || null;
    if(!night) return "";

    const lines = [];
    lines.push("");
    lines.push("🧒【小朋友模式｜熊熊解說】");
    // 平安夜推測
    // 注意：你規則 saveAndGuardPierce=true => 守+救同人會「奶穿」→ 仍死，所以平安夜原因會更偏空刀/守到/救到其一
    const deaths = resolved?.deathsFinal || resolved?.deaths || [];
    if(!deaths?.length){
      if(!night.wolfTarget){
        lines.push("昨晚沒有人倒下，可能是：狼人選擇了空刀（不刀人）。");
      }else{
        const maybe = [];
        if(night.guardTarget && night.guardTarget === night.wolfTarget) maybe.push("守衛守對了");
        if(night.witchSave) maybe.push("女巫用了救人的解藥");
        if(maybe.length){
          lines.push(`昨晚沒有人倒下，可能是：${maybe.join(" 或 ")}。`);
        }else{
          lines.push("昨晚沒有人倒下，可能是：狼人臨時改變了主意或出了意外（依桌規）。");
        }
      }
    }else{
      if(night.witchPoisonTarget){
        lines.push("昨晚可能有人是被女巫的毒藥影響（毒藥很可怕，要小心使用）。");
      }
      lines.push("今天大家要好好討論：誰的說法最奇怪？誰的行為最不像好人？");
    }

    return lines.join("\n");
  }

  function renderAnnouncementBox(){
    const box = $("annBox");
    if(!box) return;

    if(annMode==="today"){
      const l = State.logs?.[0];
      if(!l){ box.textContent="（尚無公告）"; return; }
      box.textContent = State.godView
        ? (l.publicText + "\n\n" + (l.hiddenText||""))
        : l.publicText;

      // kidsMode 補充（只加在 today）
      const extra = kidsExplainFromLatestLog();
      if(extra) box.textContent += extra;
      return;
    }

    // history
    const logs = State.logs || [];
    if(!logs.length){ box.textContent="（尚無歷史公告）"; return; }

    const lines = [];
    logs.forEach((l, idx)=>{
      lines.push(`#${logs.length-idx}｜第${l.nightNo}夜 / 第${l.dayNo}天`);
      lines.push(l.publicText || "—");

      if(State.godView && l.hiddenText) lines.push(l.hiddenText);

      if(State.godView && l.votes){
        lines.push("【票型】");
        lines.push(formatVotes(l.votes));
      }
      if(State.godView && l.actions){
        lines.push("【行動】");
        lines.push(JSON.stringify(l.actions, null, 2));
      }
      lines.push("—");
    });

    box.textContent = lines.join("\n");
  }

  function openAnnouncementModal(forceToday=false){
    const modal = $("modalAnn");
    if(!modal){ alert("缺少 modalAnn"); return; }
    if(forceToday) annMode="today";

    $("annToday")?.classList.toggle("active", annMode==="today");
    $("annHistory")?.classList.toggle("active", annMode==="history");
    renderAnnouncementBox();
    modal.classList.remove("hidden");
  }

  function bindAnnouncement(){
    on($("btnOpenAnnouncement"),"click",()=>openAnnouncementModal(true));
    on($("btnOpenAnnouncement2"),"click",()=>openAnnouncementModal(true));
    on($("fabAnn"),"click",()=>openAnnouncementModal(true));

    on($("closeAnn"),"click",()=> $("modalAnn")?.classList.add("hidden"));
    on($("annToday"),"click",()=>{
      annMode="today";
      renderAnnouncementBox();
      $("annToday")?.classList.add("active");
      $("annHistory")?.classList.remove("active");
    });
    on($("annHistory"),"click",()=>{
      annMode="history";
      renderAnnouncementBox();
      $("annHistory")?.classList.add("active");
      $("annToday")?.classList.remove("active");
    });

    on($("btnCopyAnn"),"click", async ()=>{
      try{
        await navigator.clipboard.writeText($("annBox")?.textContent || "");
        alert("已複製");
      }catch(e){
        alert("複製失敗（需 HTTPS 或已安裝 PWA）");
      }
    });

    // 匯出 JSON（復盤）
    on($("btnExport"),"click", exportReplay);
    on($("btnExport2"),"click", exportReplay);
  }

  function downloadJSON(filename, obj){
    const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),500);
  }

  function exportReplay(){
    const includeSecrets = !!State.godView;
    const payload = (window.WW_DATA.rulesCore?.exportPayload)
      ? window.WW_DATA.rulesCore.exportPayload({ state: State, includeSecrets })
      : { state: State, exportedAt: nowISO() };
    downloadJSON(`狼人殺復盤_${Date.now()}.json`, payload);
  }

  /* =========================================================
     上警 Modal / 發言 Modal
     （用 flow 引擎 police.speech.js 生成）
  ========================================================= */
  function ensurePoliceModal(){
    if($("modalPolice")) return;

    const wrap=document.createElement("div");
    wrap.id="modalPolice";
    wrap.className="modal hidden";
    wrap.innerHTML=`
      <div class="modal-card">
        <div class="modal-head">
          <div class="modal-title">上警名單</div>
          <button class="iconbtn" id="closePolice">✕</button>
        </div>
        <div class="modal-body">
          <div class="hint">點選座位加入/取消上警（僅存活）</div>
          <div class="seats" id="policeSeats"></div>
        </div>
        <div class="modal-actions">
          <button class="btn ghost" id="policeClear">清空</button>
          <button class="btn" id="policeDone">完成</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    on($("closePolice"),"click",()=> wrap.classList.add("hidden"));
    on($("policeClear"),"click",()=>{
      if(State.policeSession) State.policeSession.candidates = [];
      window.WW.state.save(State);
      renderPoliceSeats();
    });
    on($("policeDone"),"click",()=>{
      wrap.classList.add("hidden");
      // 寫入 log
      const c = State.policeSession?.candidates || [];
      const l = State.logs?.[0];
      if(l){
        l.publicText = (l.publicText||"").trim() + `\n【上警】${c.length ? c.join("、")+" 號" : "無人上警"}`;
        if(State.godView){
          l.hiddenText = (l.hiddenText||"").trim() + `\n（上帝）上警名單：${c.length?c.join(","):"—"}`;
        }
      }
      window.WW.state.save(State);
    });
  }

  function renderPoliceSeats(){
    const box = $("policeSeats");
    if(!box || !State.policeSession) return;

    box.innerHTML = "";
    const cand = State.policeSession.candidates || [];
    const alive = State.players.filter(p=>p.alive).map(p=>p.seat);

    alive.forEach(seat=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="seat";
      b.textContent=String(seat);
      if(cand.includes(seat)) b.classList.add("selected");

      b.onclick=()=>{
        window.WW_DATA.policeSpeech.toggleCandidate(State.policeSession, seat);
        window.WW.state.save(State);
        renderPoliceSeats();
      };
      box.appendChild(b);
    });
  }

  function openPoliceModal(){
    if(!window.WW_DATA.policeSpeech){
      alert("缺少 /data/flow/police.speech.js");
      return;
    }
    ensurePoliceModal();

    if(!State.policeSession){
      State.policeSession = window.WW_DATA.policeSpeech.createPoliceSession(State.players);
    }else{
      State.policeSession.alive = State.players.filter(p=>p.alive).map(p=>p.seat);
    }

    window.WW.state.save(State);
    renderPoliceSeats();
    $("modalPolice")?.classList.remove("hidden");
  }

  function ensureSpeechModal(){
    if($("modalSpeech")) return;

    const wrap=document.createElement("div");
    wrap.id="modalSpeech";
    wrap.className="modal hidden";
    wrap.innerHTML=`
      <div class="modal-card">
        <div class="modal-head">
          <div class="modal-title">發言順序</div>
          <button class="iconbtn" id="closeSpeech">✕</button>
        </div>
        <div class="modal-body">
          <div class="hint">方向：順/逆/隨機。點座位選起始位。</div>

          <div class="row" style="gap:10px;margin:10px 0;">
            <button class="btn ghost" id="dirCW">順時針</button>
            <button class="btn ghost" id="dirCCW">逆時針</button>
            <button class="btn ghost" id="dirRAND">隨機</button>
          </div>

          <div class="hint" id="speechInfo"></div>
          <div class="seats" id="speechSeats"></div>

          <div class="card inner" style="margin-top:10px;">
            <div style="font-weight:1000;margin-bottom:6px;">順序</div>
            <div id="speechOrder" style="white-space:pre-line;line-height:1.6;"></div>
            <div class="hint" id="speechNextHint" style="margin-top:6px;"></div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn ghost" id="speechBuild">生成順序</button>
          <button class="btn" id="speechNext">下一位</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    on($("closeSpeech"),"click",()=> wrap.classList.add("hidden"));
    on($("dirCW"),"click",()=> setSpeechDir("cw"));
    on($("dirCCW"),"click",()=> setSpeechDir("ccw"));
    on($("dirRAND"),"click",()=> setSpeechDir("rand"));
    on($("speechBuild"),"click",()=> buildSpeechOrder());
    on($("speechNext"),"click",()=> nextSpeaker());
  }

  function speechPool(){
    const cand = State.policeSession?.candidates || [];
    if(cand.length) return cand.slice();
    return State.players.filter(p=>p.alive).map(p=>p.seat);
  }

  function renderSpeechUI(){
    const info = $("speechInfo");
    const seats = $("speechSeats");
    const orderEl = $("speechOrder");
    const hint = $("speechNextHint");

    if(!State.policeSession || !window.WW_DATA.policeSpeech) return;

    const pool = speechPool();
    const mode = (State.policeSession.candidates?.length) ? `警上（${State.policeSession.candidates.join("、")}）` : "全體存活";

    if(info){
      info.textContent = `模式：${mode}｜方向：${State.policeSession.direction}｜起始：${State.policeSession.startSeat ?? "未選"}`;
    }

    if(seats){
      seats.innerHTML = "";
      pool.forEach(seat=>{
        const b=document.createElement("button");
        b.type="button";
        b.className="seat";
        b.textContent=String(seat);
        if(State.policeSession.startSeat===seat) b.classList.add("selected");
        b.onclick=()=>{
          State.policeSession.startSeat=seat;
          window.WW.state.save(State);
          renderSpeechUI();
        };
        seats.appendChild(b);
      });
    }

    if(orderEl){
      orderEl.textContent = State.policeSession.order?.length
        ? State.policeSession.order.map((s,i)=>`${i+1}. ${s} 號`).join("\n")
        : "（尚未生成）";
    }

    if(hint){
      if(State.policeSession.done) hint.textContent="✅ 發言流程結束";
      else{
        const cur = window.WW_DATA.policeSpeech.currentSpeaker(State.policeSession);
        hint.textContent = cur ? `👉 下一位發言：${cur} 號` : "👉 請先生成順序";
      }
    }
  }

  function setSpeechDir(dir){
    if(!window.WW_DATA.policeSpeech) return;
    window.WW_DATA.policeSpeech.setDirection(State.policeSession, dir);
    window.WW.state.save(State);
    renderSpeechUI();
  }

  function buildSpeechOrder(){
    if(!window.WW_DATA.policeSpeech) return;
    if(!State.policeSession){
      State.policeSession = window.WW_DATA.policeSpeech.createPoliceSession(State.players);
    }

    const pool = speechPool();
    const start = State.policeSession.startSeat || pool[0] || 1;

    window.WW_DATA.policeSpeech.buildOrder(State.policeSession, start);
    window.WW.state.save(State);

    // 寫入 log
    const l = State.logs?.[0];
    if(l){
      const order = State.policeSession.order || [];
      l.publicText = (l.publicText||"").trim() + `\n【發言順序】${order.length ? order.join(" → ") : "（未生成）"}`;
      if(State.godView){
        l.hiddenText = (l.hiddenText||"").trim() + `\n（上帝）speech=${JSON.stringify(window.WW_DATA.policeSpeech.exportSession(State.policeSession))}`;
      }
    }
    window.WW.state.save(State);
    renderSpeechUI();
  }

  function nextSpeaker(){
    if(!window.WW_DATA.policeSpeech) return;
    const cur = window.WW_DATA.policeSpeech.currentSpeaker(State.policeSession);
    if(!cur){
      alert("請先生成順序");
      return;
    }
    window.WW_DATA.policeSpeech.nextSpeaker(State.policeSession);
    window.WW.state.save(State);
    renderSpeechUI();
  }

  function openSpeechModal(){
    if(!window.WW_DATA.policeSpeech){
      alert("缺少 /data/flow/police.speech.js");
      return;
    }
    ensureSpeechModal();
    if(!State.policeSession){
      State.policeSession = window.WW_DATA.policeSpeech.createPoliceSession(State.players);
    }else{
      State.policeSession.alive = State.players.filter(p=>p.alive).map(p=>p.seat);
    }
    window.WW.state.save(State);
    renderSpeechUI();
    $("modalSpeech")?.classList.remove("hidden");
  }

  /* =========================================================
     投票 Modal / 平票 Modal
  ========================================================= */
  function ensureVoteModal(){
    if($("modalVote")) return;

    const wrap=document.createElement("div");
    wrap.id="modalVote";
    wrap.className="modal hidden";
    wrap.innerHTML=`
      <div class="modal-card">
        <div class="modal-head">
          <div class="modal-title" id="voteTitle">投票</div>
          <button class="iconbtn" id="closeVote">✕</button>
        </div>
        <div class="modal-body">
          <div class="hint" id="votePrompt"></div>
          <div class="seats" id="voteSeats"></div>
          <div class="card inner" style="margin-top:10px;">
            <div style="font-weight:1000;margin-bottom:6px;">即時票數</div>
            <div id="voteStats" style="white-space:pre-line;line-height:1.6;"></div>
          </div>
          <div class="hint" id="voteHint" style="margin-top:8px;"></div>
        </div>
        <div class="modal-actions">
          <button class="btn ghost" id="voteAbstain">棄票</button>
          <button class="btn" id="voteDone" disabled>完成投票</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    on($("closeVote"),"click",()=> wrap.classList.add("hidden"));
    on($("voteAbstain"),"click",()=> castVote(null));
    on($("voteDone"),"click",()=> finishVote());
  }

  function formatStats(stats){
    const keys = Object.keys(stats||{});
    keys.sort((a,b)=>{
      if(a==="abstain") return 1;
      if(b==="abstain") return -1;
      return Number(a)-Number(b);
    });
    return keys.map(k=>{
      if(k==="abstain") return `棄票：${stats[k]} 票`;
      return `${k} 號：${stats[k]} 票`;
    }).join("\n") || "（尚未投票）";
  }

  function openVoteModal(){
    ensureVoteModal();
    $("modalVote")?.classList.remove("hidden");
  }

  function renderVoteUI(){
    if(!State.voteSession || !window.WW_DATA.voteDay) return;

    const session = State.voteSession;
    const cur = window.WW_DATA.voteDay.currentVoter(session);

    $("voteTitle") && ($("voteTitle").textContent = session.label || "投票");
    $("votePrompt") && ($("votePrompt").textContent = session.done ? "✅ 投票完成" : `請 ${cur} 號投票（點選要投的座位）`);

    const seats = $("voteSeats");
    if(seats){
      seats.innerHTML="";
      const targets = session.targets || [];
      targets.forEach(seat=>{
        const b=document.createElement("button");
        b.type="button";
        b.className="seat";
        b.textContent=String(seat);

        // 不能投自己
        if(cur === seat){
          b.disabled=true;
          b.classList.add("disabled");
        }

        b.onclick=()=> castVote(seat);
        seats.appendChild(b);
      });
    }

    const stats = window.WW_DATA.voteDay.getVoteStats(session);
    $("voteStats") && ($("voteStats").textContent = formatStats(stats));

    $("voteHint") && ($("voteHint").textContent = session.done ? "點「完成投票」進入統計" : "也可以按「棄票」。");
    $("voteDone") && ($("voteDone").disabled = !session.done);

    window.WW.state.save(State);
  }

  function castVote(toSeatOrNull){
    const session = State.voteSession;
    if(!session) return;

    const cur = window.WW_DATA.voteDay.currentVoter(session);
    if(!cur) return;

    const ok = window.WW_DATA.voteDay.castVote(session, cur, toSeatOrNull);
    if(!ok){
      navigator.vibrate?.([60,40,60]);
      return;
    }
    window.WW.state.save(State);
    renderVoteUI();
  }

  function ensureTieModal(){
    if($("modalTie")) return;

    const wrap=document.createElement("div");
    wrap.id="modalTie";
    wrap.className="modal hidden";
    wrap.innerHTML=`
      <div class="modal-card">
        <div class="modal-head">
          <div class="modal-title">平票處理</div>
          <button class="iconbtn" id="closeTie">✕</button>
        </div>
        <div class="modal-body">
          <div class="hint" id="tieInfo"></div>
          <div class="card inner">
            <div style="font-weight:1000;margin-bottom:6px;">平票名單</div>
            <div id="tieList" style="white-space:pre-line;line-height:1.6;"></div>
          </div>
        </div>
        <div class="modal-actions" style="flex-direction:column;gap:10px;">
          <button class="btn" id="tiePK">PK 投票（只投平票名單）</button>
          <button class="btn ghost" id="tieRevote">重新投票（全體存活）</button>
          <button class="btn ghost" id="tieNone">無人出局（進夜晚）</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    on($("closeTie"),"click",()=> wrap.classList.add("hidden"));
    on($("tiePK"),"click",()=> decideTie("pk"));
    on($("tieRevote"),"click",()=> decideTie("revote"));
    on($("tieNone"),"click",()=> decideTie("none"));
  }

  function openTieModal(){
    ensureTieModal();
    const c = State.day?.tieCandidates || [];
    const max = State.day?.tieMaxVotes || 0;
    $("tieInfo") && ($("tieInfo").textContent = `最高票 ${max} 票｜第 ${State.tieRound||1} 次平票`);
    $("tieList") && ($("tieList").textContent = c.map(s=>`${s} 號`).join("\n"));
    $("modalTie")?.classList.remove("hidden");
  }

  function decideTie(type){
    $("modalTie")?.classList.add("hidden");
    const out = window.WW.day.decideTie(State, type);
    window.WW.state.save(State);

    // 若進入 revote / pk，會重新開投票
    if(out.ok && (out.action==="revote" || out.action==="pk")){
      openVoteModal();
      renderVoteUI();
      return;
    }
    // none：回到自由階段
    if(out.ok && out.action==="none"){
      closeVoteAndReturn();
      return;
    }
  }

  function finishVote(){
    const out = window.WW.day.finalizeVote(State);
    window.WW.state.save(State);

    // 關投票窗
    $("modalVote")?.classList.add("hidden");

    if(!out.ok) return;

    if(out.type==="tie1"){
      openTieModal();
      return;
    }

    // 第二次平票：直接無人放逐，回白天自由（可直接進下一夜）
    if(out.type==="tie2_none"){
      openAnnouncementModal(true);
      return;
    }

    // 處刑/無人：跳公告
    openAnnouncementModal(true);

    // 若有死亡技能，這裡觸發技能彈窗（需上帝）
    runNextSkillIfAny();
  }

  function closeVoteAndReturn(){
    $("modalVote")?.classList.add("hidden");
    $("modalTie")?.classList.add("hidden");
    openAnnouncementModal(true);
  }

  /* =========================================================
     技能彈窗（獵人/黑狼王）
  ========================================================= */
  function ensureSkillModal(){
    if($("modalSkill")) return;

    const wrap=document.createElement("div");
    wrap.id="modalSkill";
    wrap.className="modal hidden";
    wrap.innerHTML=`
      <div class="modal-card">
        <div class="modal-head">
          <div class="modal-title" id="skillTitle">技能</div>
          <button class="iconbtn" id="closeSkill">✕</button>
        </div>
        <div class="modal-body">
          <div class="hint" id="skillHint"></div>
          <div class="seats" id="skillSeats"></div>
        </div>
        <div class="modal-actions">
          <button class="btn ghost" id="skillSkip">放棄</button>
          <button class="btn" id="skillConfirm" disabled>確認</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    on($("closeSkill"),"click",()=> wrap.classList.add("hidden"));
    on($("skillSkip"),"click",()=> skillSkip());
    on($("skillConfirm"),"click",()=> skillConfirm());
  }

  let activeSkill=null;
  let skillTarget=null;

  function openSkillModal(skill){
    ensureSkillModal();
    activeSkill = skill;
    skillTarget = null;

    const role = window.WW_DATA.getRole ? window.WW_DATA.getRole(skill.roleId) : null;
    const title = `${role?.icon?role.icon+" ":""}${role?.name||skill.roleId} 技能`;

    $("skillTitle") && ($("skillTitle").textContent = title);

    $("skillHint") && ($("skillHint").textContent =
      skill.kind==="shoot"
        ? `獵人 ${skill.seat} 號是否開槍？點選要帶走的人（可放棄）。`
        : `黑狼王 ${skill.seat} 號是否帶走一人？點選目標（可放棄）。`
    );

    const seats = $("skillSeats");
    if(seats){
      seats.innerHTML="";
      State.players.forEach(p=>{
        const b=document.createElement("button");
        b.type="button";
        b.className="seat" + (p.alive ? "" : " dead");
        b.textContent=String(p.seat);

        const disabled = (!p.alive) || (p.seat===skill.seat);
        if(disabled){ b.disabled=true; b.classList.add("disabled"); }

        b.onclick=()=>{
          if(disabled) return;
          skillTarget = p.seat;
          [...seats.querySelectorAll(".seat")].forEach(x=>x.classList.remove("selected"));
          b.classList.add("selected");
          $("skillConfirm") && ($("skillConfirm").disabled = false);
        };

        seats.appendChild(b);
      });
    }

    $("skillConfirm") && ($("skillConfirm").disabled = true);
    $("modalSkill")?.classList.remove("hidden");
  }

  function runNextSkillIfAny(){
    if(!State.skillQueue?.length) {
      // 檢查勝負
      const win = window.WW.day.checkWin(State);
      if(win.ended) window.WW.day.endGame(State, win);
      return;
    }

    // 必須上帝視角才能操作
    if(!State.godView){
      alert("需要 🔓 上帝視角 才能處理死亡技能");
      return;
    }

    const next = State.skillQueue.shift();
    window.WW.state.save(State);

    // 被毒禁用：由 rules.core 判斷（夜晚死亡才會有 meta.poisonedDeaths）
    if(window.WW_DATA.rulesCore?.canTriggerDeathSkill && State.lastResolved){
      const ok = window.WW_DATA.rulesCore.canTriggerDeathSkill({
        roleId: next.roleId,
        seat: next.seat,
        resolved: State.lastResolved,
        settings: State.settings?.rules || {}
      });
      if(!ok){
        // 寫入 hidden log
        const l = State.logs?.[0];
        if(l){
          l.hiddenText = (l.hiddenText||"").trim() + `\n（技能）${next.roleId} ${next.seat}：因被毒→禁用`;
        }
        window.WW.state.save(State);
        runNextSkillIfAny();
        return;
      }
    }

    openSkillModal(next);
  }

  function killSeat(seat, reason){
    const p = State.players.find(x=>x.seat===seat);
    if(!p || !p.alive) return false;
    p.alive = false;

    const l = State.logs?.[0];
    if(l){
      l.hiddenText = (l.hiddenText||"").trim() + `\n（死亡）${seat}｜${reason}`;
    }
    window.WW.state.save(State);
    return true;
  }

  function skillSkip(){
    $("modalSkill")?.classList.add("hidden");
    // 寫 log
    const l = State.logs?.[0];
    if(l && activeSkill){
      l.hiddenText = (l.hiddenText||"").trim() + `\n（技能）${activeSkill.roleId} ${activeSkill.seat} 放棄`;
    }
    window.WW.state.save(State);
    activeSkill=null;
    skillTarget=null;
    runNextSkillIfAny();
  }

  function skillConfirm(){
    if(!activeSkill || !skillTarget) return;
    const changed = killSeat(skillTarget,
      activeSkill.kind==="shoot"
        ? `獵人 ${activeSkill.seat} 開槍`
        : `黑狼王 ${activeSkill.seat} 帶走`
    );

    const l = State.logs?.[0];
    if(l){
      l.publicText = (l.publicText||"").trim() +
        (changed
          ? `\n${activeSkill.kind==="shoot" ? "⚡" : "💥"} ${activeSkill.seat} 號帶走：${skillTarget} 號。`
          : `\n${activeSkill.kind==="shoot" ? "⚡" : "💥"} 技能目標已死亡（無變更）。`);
    }

    $("modalSkill")?.classList.add("hidden");
    window.WW.state.save(State);

    activeSkill=null;
    skillTarget=null;

    // 可能連鎖（例如帶走另一個帶技能的角色）：簡版先不自動塞隊列（可之後加）
    runNextSkillIfAny();
  }

  /* =========================
     綁定公告入口（多處）
  ========================= */
  function bindGlobalButtons(){
    // 浮動公告/上帝按鈕
    on($("fabAnn"),"click",()=>openAnnouncementModal(true));
    on($("fabGod"),"click",toggleGod);

    // 上方公告/上帝
    on($("btnOpenAnnouncement"),"click",()=>openAnnouncementModal(true));
    on($("btnGodToggle"),"click",toggleGod);
  }

  /* =========================
     Boot / Restore
  ========================= */
  function boot(){
    ensureRestartButton();
    bindAnnouncement();
    bindGlobalButtons();
    bindSetup();
    bindDeal();
    bindNight();
    bindDay();

    // 讓某些按鈕也防長按
    preventTouchSelect($("btnHoldReveal"));

    // 恢復畫面
    setGodView(!!State.godView);

    if(State.phase && Screens[State.phase]){
      showScreen(State.phase);
    }else{
      showScreen("setup");
    }

    if(State.phase==="deal") renderDeal();
    if(State.phase==="night") window.WW.night.renderNight(State);
    if(State.phase==="day"){
      renderDayTag();
      // 白天如果沒有公告先給入口
      // （夜晚進白天時一定會寫 log）
    }

    // 讓投票彈窗若存在可回填
    if(State.day?.dayPhase==="voting"){
      openVoteModal();
      renderVoteUI();
    }
    if(State.day?.dayPhase==="tie"){
      openTieModal();
    }
  }

  boot();

})();
