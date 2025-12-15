/* =========================================================
   app/app.ui.bindings.js
   UI helpers used by new app.js
   - God PIN modal wiring
   - Announcement modal control
   - Role config modal hook (basic)
   - Deal reveal modal (flip)
   - Witch modal (flow: cut -> save? -> poison?)
   - Export JSON, Copy text
   - Game over modal
   - Prevent iOS text selection / callout on long press
========================================================= */

(function(){
  const A = window.WW_APP || (window.WW_APP = {});
  const UI = A.UI || (A.UI = {});
  const $ = (id)=>document.getElementById(id);

  /* =========================
     Small helpers
  ========================= */
  function el(tag, cls, text){
    const e=document.createElement(tag);
    if(cls) e.className=cls;
    if(typeof text==="string") e.textContent=text;
    return e;
  }
  function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }

  /* =========================
     God view CSS toggle
  ========================= */
  UI.setGodView = function(on){
    document.body.classList.toggle("god-on", !!on);
    const icon = on ? "🔓" : "🔒";
    const btn1 = $("btnGodToggle");
    const btn2 = $("fabGod");
    if(btn1) btn1.textContent = icon;
    if(btn2) btn2.textContent = icon;
  };

  /* =========================
     Announcement modal
  ========================= */
  let annMode = "today";
  UI.setAnnMode = (m)=>{ annMode = (m==="history") ? "history" : "today"; };
  UI.getAnnMode = ()=>annMode;

  UI.openAnnouncement = function(mode="today"){
    UI.setAnnMode(mode);
    const modal = $("modalAnn");
    if(modal) modal.classList.remove("hidden");

    const t = $("annToday");
    const h = $("annHistory");
    t && t.classList.toggle("active", annMode==="today");
    h && h.classList.toggle("active", annMode==="history");
  };

  /* close button exists in index.html */
  (function wireAnnClose(){
    const close = $("closeAnn");
    if(close){
      close.addEventListener("click", ()=>{
        $("modalAnn")?.classList.add("hidden");
      });
    }
  })();

  /* =========================
     Copy / Download
  ========================= */
  UI.copyText = async function(text){
    try{
      await navigator.clipboard.writeText(text||"");
      alert("已複製");
    }catch(e){
      // fallback
      try{
        const ta=document.createElement("textarea");
        ta.value = text||"";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        alert("已複製");
      }catch(err){
        alert("複製失敗（可能需要 HTTPS / PWA 安裝）");
      }
    }
  };

  UI.downloadJSON = function(filename, obj){
    const blob = new Blob([JSON.stringify(obj,null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url;
    a.download=filename || `export_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 600);
  };

  /* =========================
     God PIN modal
  ========================= */
  let pinSubmitHandler = null;

  UI.openGodPin = function(){
    $("pinInput") && ($("pinInput").value="");
    UI.showPinWarn(false);
    $("modalGod")?.classList.remove("hidden");
    $("pinInput")?.focus?.();
  };

  UI.closeGodPin = function(){
    $("modalGod")?.classList.add("hidden");
  };

  UI.showPinWarn = function(on){
    $("pinWarn")?.classList.toggle("hidden", !on);
  };

  UI.onGodPinSubmit = function(fn){
    pinSubmitHandler = fn;
  };

  (function wireGodPin(){
    const close = $("closeGod");
    const cancel = $("pinCancel");
    const ok = $("pinOk");
    close && close.addEventListener("click", UI.closeGodPin);
    cancel && cancel.addEventListener("click", UI.closeGodPin);
    ok && ok.addEventListener("click", ()=>{
      const v = ($("pinInput")?.value || "").trim();
      pinSubmitHandler && pinSubmitHandler(v);
    });
  })();

  /* =========================
     Role config modal hook
     - app.js will call UI.openRoleConfig(state, roles)
     - Here we only open the modal and let app.render handle the content,
       OR provide a minimal fallback UI if needed.
  ========================= */
  UI.openRoleConfig = function(state, roles){
    // Ensure modal exists
    const modal = $("modalRole");
    if(!modal) return alert("缺少 modalRole（index.html）");

    modal.classList.remove("hidden");
    // Render body minimally if render module didn't
    const body = $("roleConfigBody");
    if(!body) return;

    if(body.dataset.built === "1") return;

    // minimal: build rows by existing state.rolesCount keys
    body.innerHTML = "";
    const tip = el("div","hint","提示：角色總數必須等於玩家人數，才能開始。");
    tip.style.marginBottom="10px";
    body.appendChild(tip);

    const list = Object.keys(state.rolesCount||{});
    list.forEach(rid=>{
      const info = (roles && roles[rid]) || {name:rid, icon:"❔"};
      const row = el("div","");
      row.style.display="flex";
      row.style.alignItems="center";
      row.style.justifyContent="space-between";
      row.style.padding="10px 4px";
      row.style.borderBottom="1px dashed rgba(0,0,0,.08)";

      const left = el("div","");
      left.style.fontWeight="1000";
      left.textContent = `${info.icon?info.icon+" ":""}${info.name||rid}`;

      const right = el("div","");
      right.style.display="flex";
      right.style.alignItems="center";
      right.style.gap="10px";

      const minus = el("button","btn ghost","－");
      minus.type="button";
      minus.style.padding="8px 10px";
      const num = el("div","");
      num.style.minWidth="34px";
      num.style.textAlign="center";
      num.style.fontWeight="1000";
      num.textContent = String(state.rolesCount[rid]||0);
      const plus = el("button","btn ghost","＋");
      plus.type="button";
      plus.style.padding="8px 10px";

      minus.onclick=()=>{
        state.rolesCount[rid]=Math.max(0,(state.rolesCount[rid]||0)-1);
        num.textContent=String(state.rolesCount[rid]||0);
        window.WW_APP?.State?.save?.(state);
        window.WW_APP?.Render?.renderSetup?.(state);
      };
      plus.onclick=()=>{
        state.rolesCount[rid]=(state.rolesCount[rid]||0)+1;
        num.textContent=String(state.rolesCount[rid]||0);
        window.WW_APP?.State?.save?.(state);
        window.WW_APP?.Render?.renderSetup?.(state);
      };

      right.append(minus,num,plus);
      row.append(left,right);
      body.appendChild(row);
    });

    body.dataset.built="1";

    // close/apply/reset wired in index.html (buttons exist); add safety:
    $("closeRole")?.addEventListener("click", ()=>modal.classList.add("hidden"));
    $("roleApply")?.addEventListener("click", ()=>modal.classList.add("hidden"));
    $("roleReset")?.addEventListener("click", ()=>{
      body.dataset.built="0";
      body.innerHTML="";
      modal.classList.add("hidden");
      alert("請按「建議配置」重新套用（或我下一步補 boards preset reset）。");
    });
  };

  /* =========================
     Prevent long press selection (helper)
  ========================= */
  UI.stopTouchSelect = function(dom){
    if(!dom) return;
    try{
      dom.style.webkitUserSelect="none";
      dom.style.userSelect="none";
      dom.style.webkitTouchCallout="none";
    }catch(e){}
    // Must be passive:false to prevent iOS callout
    dom.addEventListener("touchstart", (e)=>{ e.preventDefault(); }, {passive:false});
  };

  /* =========================
     Deal Reveal modal (auto inject)
  ========================= */
  function ensureRevealModal(){
    if($("modalReveal")) return;

    const modal = el("div","modal hidden");
    modal.id="modalReveal";
    modal.innerHTML = `
      <div class="modal-card">
        <div class="modal-head">
          <div class="modal-title">身分卡</div>
          <button class="iconbtn" id="closeReveal">✕</button>
        </div>
        <div class="modal-body">
          <div class="card" id="revealCard" style="text-align:center;">
            <div class="hint" id="revealSeat" style="margin-bottom:8px;">座位</div>
            <div style="font-size:42px;line-height:1;" id="revealIcon">❔</div>
            <div style="font-weight:1000;font-size:20px;margin-top:10px;" id="revealRole">—</div>
            <div class="hint" style="margin-top:10px;">放開會立刻關閉（防偷看）</div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    $("closeReveal")?.addEventListener("click", ()=>{
      UI.closeReveal();
    });
  }

  UI.openReveal = function({seat, role}){
    ensureRevealModal();
    $("revealSeat") && ($("revealSeat").textContent = `請 ${seat} 號確認身分`);
    $("revealIcon") && ($("revealIcon").textContent = role?.icon || "❔");
    $("revealRole") && ($("revealRole").textContent = role?.name || role?.id || "—");
    $("modalReveal")?.classList.remove("hidden");
    // optional flip class for later
    $("revealCard")?.classList.add("flipped");
  };

  UI.closeReveal = function(){
    $("revealCard")?.classList.remove("flipped");
    $("modalReveal")?.classList.add("hidden");
  };

  /* =========================
     Witch Panel (auto inject)
     flow rule:
     - If saveUsed: do NOT show knife target; only poison choice
     - else show knife target and ask save? then poison?
     - Respect witchCannotSelfSave by disabling "save" when wolfTarget==witchSeat
  ========================= */
  function ensureWitchModal(){
    if($("modalWitch")) return;

    const modal = el("div","modal hidden");
    modal.id="modalWitch";
    modal.innerHTML = `
      <div class="modal-card">
        <div class="modal-head">
          <div class="modal-title">🧪 女巫操作</div>
          <button class="iconbtn" id="closeWitch">✕</button>
        </div>

        <div class="modal-body">
          <div class="hint" id="witchTopHint"></div>

          <div class="card inner" id="witchCutBox">
            <div class="label">今晚被刀</div>
            <div class="scriptbox" id="witchCutText" style="margin-top:8px;"></div>
          </div>

          <div class="card inner" id="witchSaveBox" style="margin-top:12px;">
            <div class="label">解藥</div>
            <div class="row wrap" style="margin-top:8px;">
              <button class="btn" id="witchBtnSave" type="button">用解藥救他</button>
              <button class="btn ghost" id="witchBtnNoSave" type="button">不用解藥</button>
            </div>
            <div class="hint" id="witchSaveHint" style="margin-top:8px;"></div>
          </div>

          <div class="card inner" id="witchPoisonBox" style="margin-top:12px;">
            <div class="label">毒藥</div>
            <div class="hint small" style="margin-top:6px;">選擇要毒的座位（或不毒）</div>
            <div class="seats" id="witchPoisonSeats"></div>
            <div class="row" style="margin-top:10px;">
              <button class="btn ghost" id="witchBtnNoPoison" type="button">不用毒藥</button>
            </div>
            <div class="hint" id="witchPoisonHint" style="margin-top:8px;"></div>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn ghost" id="witchCancel" type="button">取消</button>
          <button class="btn primary" id="witchDone" type="button">確認完成</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    $("closeWitch")?.addEventListener("click", ()=>UI.closeWitch());
    $("witchCancel")?.addEventListener("click", ()=>UI.closeWitch());
  }

  UI.closeWitch = function(){
    $("modalWitch")?.classList.add("hidden");
    // resolve promise if waiting
    if(UI._witchResolve){
      UI._witchResolve(null);
      UI._witchResolve=null;
    }
  };

  UI.openWitchPanel = function(ctx, witchFlow){
    ensureWitchModal();
    const modal = $("modalWitch");
    modal.classList.remove("hidden");

    const st = ctx.state;
    const rules = ctx.rules || {};
    const wolfTarget = ctx.wolfTarget || null;

    const saveUsed = !!st.night.witchSaveUsed;
    const poisonUsed = !!st.night.witchPoisonUsed;

    let save = !!st.night.witchSave;
    let poisonSeat = st.night.witchPoisonTarget ?? null;

    // top hint
    const topHint = $("witchTopHint");
    topHint.textContent =
      `解藥：${saveUsed?"已用過":"可用"}｜毒藥：${poisonUsed?"已用過":"可用"}`;

    // cut box: if saveUsed => hide
    const cutBox=$("witchCutBox");
    const saveBox=$("witchSaveBox");
    const cutText=$("witchCutText");
    if(saveUsed){
      cutBox.classList.add("hidden");
      saveBox.classList.add("hidden");
    }else{
      cutBox.classList.remove("hidden");
      saveBox.classList.remove("hidden");
      cutText.textContent = wolfTarget ? `${wolfTarget} 號` : "（狼人尚未選刀口 / 或狼人空刀）";
    }

    // save buttons
    const btnSave=$("witchBtnSave");
    const btnNoSave=$("witchBtnNoSave");
    const saveHint=$("witchSaveHint");

    // self save rule
    const cannotSelf = !!rules.witchCannotSelfSave;
    const isSelf = (wolfTarget && ctx.witchSeat && wolfTarget===ctx.witchSeat);
    const saveDisabled = (!wolfTarget) || cannotSelf && isSelf;

    btnSave.disabled = saveUsed || saveDisabled;
    btnNoSave.disabled = saveUsed;

    if(saveUsed){
      saveHint.textContent = "解藥已使用，今晚不能再救人。";
    }else if(!wolfTarget){
      saveHint.textContent = "今晚沒有刀口（可能空刀），不需要解藥。";
    }else if(cannotSelf && isSelf){
      saveHint.textContent = "⚠️ 規則：女巫不能自救。";
    }else{
      saveHint.textContent = save ? "✅ 已選擇用解藥" : "尚未選擇（可用解藥救刀口）";
    }

    btnSave.onclick=()=>{
      if(btnSave.disabled) return;
      save = true;
      btnSave.textContent = "✅ 已用解藥";
      saveHint.textContent = "✅ 已選擇用解藥。";
    };
    btnNoSave.onclick=()=>{
      save = false;
      btnSave.textContent = "用解藥救他";
      saveHint.textContent = "已選擇不用解藥。";
    };

    // poison seats
    const poisonBox=$("witchPoisonBox");
    const poisonSeats=$("witchPoisonSeats");
    const poisonHint=$("witchPoisonHint");
    const btnNoPoison=$("witchBtnNoPoison");

    poisonSeats.innerHTML="";
    poisonHint.textContent = poisonUsed ? "毒藥已使用，不能再毒人。" : (poisonSeat ? `☠️ 已選擇毒 ${poisonSeat} 號` : "尚未選擇（可不毒）");
    btnNoPoison.disabled = poisonUsed;

    // if poison used => disable all
    const seats = st.players.filter(p=>p.alive).map(p=>p.seat);
    seats.forEach(seat=>{
      const b = el("button","seat");
      b.type="button";
      b.textContent=String(seat);
      b.dataset.seat=String(seat);
      if(poisonSeat===seat) b.classList.add("selected");

      // cannot poison self? (not specified, allow)
      b.disabled = poisonUsed;
      if(!st.players.find(p=>p.seat===seat)?.alive) b.classList.add("dead");

      b.onclick=()=>{
        if(poisonUsed) return;
        poisonSeat = seat;
        [...poisonSeats.querySelectorAll(".seat")].forEach(x=>x.classList.remove("selected"));
        b.classList.add("selected");
        poisonHint.textContent = `☠️ 已選擇毒 ${poisonSeat} 號`;
      };
      poisonSeats.appendChild(b);
    });

    btnNoPoison.onclick=()=>{
      if(poisonUsed) return;
      poisonSeat=null;
      [...poisonSeats.querySelectorAll(".seat")].forEach(x=>x.classList.remove("selected"));
      poisonHint.textContent="已選擇不用毒藥。";
    };

    // done
    const done=$("witchDone");
    done.onclick=()=>{
      // guard: if saveUsed, force save=false
      if(saveUsed) save=false;
      // if no wolfTarget, force save=false
      if(!wolfTarget) save=false;
      // cannot self save enforced
      if(cannotSelf && isSelf) save=false;
      // poison used => keep null
      if(poisonUsed) poisonSeat=null;

      modal.classList.add("hidden");
      const out = { save, poisonSeat };
      if(UI._witchResolve){ UI._witchResolve(out); UI._witchResolve=null; }
    };

    return new Promise((resolve)=>{
      UI._witchResolve = resolve;
    });
  };

  /* =========================
     Game Over modal
  ========================= */
  function ensureGameOver(){
    if($("modalGameOver")) return;
    const modal = el("div","modal hidden");
    modal.id="modalGameOver";
    modal.innerHTML = `
      <div class="modal-card">
        <div class="modal-head">
          <div class="modal-title">🏁 遊戲結束</div>
          <button class="iconbtn" id="closeGameOver">✕</button>
        </div>
        <div class="modal-body">
          <div class="scriptbox" id="gameOverText"></div>
        </div>
        <div class="modal-actions">
          <button class="btn primary" id="gameOverOk" type="button">知道了</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    $("closeGameOver")?.addEventListener("click", ()=>modal.classList.add("hidden"));
    $("gameOverOk")?.addEventListener("click", ()=>modal.classList.add("hidden"));
  }

  UI.openGameOver = function(verdict){
    ensureGameOver();
    const modal=$("modalGameOver");
    const text=$("gameOverText");
    const msg = verdict?.message
      || (verdict?.winner ? `勝利陣營：${verdict.winner}` : "遊戲結束");
    text.textContent = msg;
    modal.classList.remove("hidden");
  };

})();