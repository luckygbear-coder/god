/* =========================================================
   app/app.ui.bindings.js
   - bind all UI events
   - required ids check + report
========================================================= */

(function(){
  window.WW_APP = window.WW_APP || {};
  const A = window.WW_APP;

  const $ = (id) => document.getElementById(id);
  const on = (id, ev, fn, opt) => {
    const el = $(id);
    if(!el) return false;
    el.addEventListener(ev, fn, opt);
    return true;
  };

  // 你目前 UI 最核心會用到的 ids（先做 MVP 必須存在）
  const REQUIRED = [
    // global
    "btnGodToggle","fabGod","btnOpenAnnouncement","fabAnn",
    "modalGod","pinInput","pinOk","pinCancel","closeGod","pinWarn",

    // screens
    "screen-setup","screen-deal","screen-night","screen-day",

    // setup
    "boardBasic","boardB1",
    "playerCount","btnMinus","btnPlus","rangeCount",
    "btnSuggest","btnOpenRoleConfig","btnStart",
    "roleTotal","playerTotal","warnRoleTotal",
    "modalRole","roleConfigBody","closeRole","roleReset","roleApply",

    // deal
    "dealText","btnHoldReveal","btnNextPlayer","btnFinishDeal","btnDealBack",

    // night
    "nightTag","nightScript","nightSeats","btnNightPrev","btnNightNext",

    // day
    "dayTag","btnPolice","btnTalkOrder","btnVote","btnDayNext",

    // announcement
    "modalAnn","closeAnn","annToday","annHistory","annBox","btnCopyAnn",

    // log/export/reset
    "btnExport","btnClearSave"
  ];

  function checkRequiredIds(){
    return REQUIRED.filter(id => !$(id));
  }

  function reportMissingIds(missing){
    if(!missing.length) return;
    console.warn("[WW] Missing IDs:", missing);

    // 畫面上也提示（不擋操作）
    let bar = document.getElementById("ww-missing-bar");
    if(!bar){
      bar = document.createElement("div");
      bar.id = "ww-missing-bar";
      bar.style.position="fixed";
      bar.style.left="10px";
      bar.style.right="10px";
      bar.style.bottom="76px";
      bar.style.zIndex="9999";
      bar.style.background="rgba(255,235,205,.95)";
      bar.style.border="2px solid rgba(0,0,0,.12)";
      bar.style.borderRadius="14px";
      bar.style.padding="10px 12px";
      bar.style.fontSize="12px";
      bar.style.lineHeight="1.5";
      bar.style.boxShadow="0 10px 30px rgba(0,0,0,.18)";
      document.body.appendChild(bar);
    }
    bar.textContent = `⚠️ UI 缺少 ${missing.length} 個 id，部分按鈕可能無反應：${missing.slice(0,6).join(", ")}${missing.length>6?"…":""}（詳見 console）`;
  }

  function bindAll(state){
    // --- 防 iOS 長按選字（補一層保險：全站禁止選字） ---
    try{
      document.documentElement.style.webkitUserSelect="none";
      document.documentElement.style.userSelect="none";
      document.body && (document.body.style.webkitUserSelect="none");
      document.body && (document.body.style.userSelect="none");
    }catch(e){}

    // --- global ---
    on("btnGodToggle","click",()=> A.UI.toggleGod());
    on("fabGod","click",()=> A.UI.toggleGod());

    on("pinOk","click",()=> A.UI.pinOk());
    on("pinCancel","click",()=> A.UI.closeModal("modalGod"));
    on("closeGod","click",()=> A.UI.closeModal("modalGod"));

    // announcement
    on("btnOpenAnnouncement","click",()=> A.UI.openAnnouncement("today"));
    on("fabAnn","click",()=> A.UI.openAnnouncement("today"));
    on("closeAnn","click",()=> A.UI.closeModal("modalAnn"));
    on("annToday","click",()=> A.UI.setAnnMode("today"));
    on("annHistory","click",()=> A.UI.setAnnMode("history"));
    on("btnCopyAnn","click",()=> {
      const text = $("annBox")?.textContent || "";
      navigator.clipboard?.writeText(text).then(()=>alert("已複製")).catch(()=>alert("複製失敗"));
    });

    // setup: boards
    on("boardBasic","click",()=> A.UI.selectBoard("basic"));
    on("boardB1","click",()=> A.UI.selectBoard("b1"));

    // setup: count
    on("btnMinus","click",()=> A.UI.changeCount(-1));
    on("btnPlus","click",()=> A.UI.changeCount(+1));
    on("rangeCount","input",(e)=> A.UI.setCount(Number(e.target.value)));

    // setup: roles
    on("btnSuggest","click",()=> A.UI.suggestRoles());
    on("btnOpenRoleConfig","click",()=> A.UI.openRoleModal());
    on("roleReset","click",()=> A.UI.resetRoles());
    on("roleApply","click",()=> A.UI.closeModal("modalRole"));
    on("closeRole","click",()=> A.UI.closeModal("modalRole"));

    // setup: start
    on("btnStart","click",()=> A.UI.startGame());

    // deal
    on("btnNextPlayer","click",()=> A.UI.dealNext());
    on("btnFinishDeal","click",()=> A.UI.dealFinish());
    on("btnDealBack","click",()=> A.UI.goSetup());

    // night
    on("btnNightPrev","click",()=> A.UI.nightPrev());
    on("btnNightNext","click",()=> A.UI.nightNext());

    // night seat pick (delegate)
    const nightSeats = $("nightSeats");
    if(nightSeats){
      nightSeats.addEventListener("click",(e)=>{
        const btn = e.target.closest("button.seat");
        if(!btn) return;
        const seat = Number(btn.dataset.seat || btn.textContent);
        if(!Number.isFinite(seat)) return;
        A.UI.onNightSeatPick(seat);
      });
    }

    // day buttons (後續 police / vote / speech 會再接更多 modal)
    on("btnPolice","click",()=> alert("上警 UI：下一檔會補完整（police + speech + vote 模組）"));
    on("btnTalkOrder","click",()=> alert("發言 UI：下一檔會補完整（police + speech + vote 模組）"));
    on("btnVote","click",()=> alert("投票 UI：下一檔會補完整（police + speech + vote 模組）"));
    on("btnDayNext","click",()=> A.UI.goNextNight());

    // export / clear
    on("btnExport","click",()=> A.UI.exportReplay());
    on("btnClearSave","click",()=> {
      if(confirm("確定清除本局存檔並回到設定？")){
        A.State.clear();
        location.reload();
      }
    });
  }

  A.Bindings = {
    REQUIRED,
    checkRequiredIds,
    reportMissingIds,
    bindAll
  };
})();