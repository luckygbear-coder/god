/* =========================================================
   app/app.ui.bindings.js
   - 集中綁定所有按鈕事件（避免按了沒反應）
   - 啟動時檢查 index.html 是否缺少必要 id
   - iOS 長按防選字、防放大（事件層）
========================================================= */

(function(){
  window.WW_APP = window.WW_APP || {};
  const A = window.WW_APP;

  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);

  /* =========================
     iOS 長按防呆
  ========================= */
  function disableTextSelectGlobally(){
    try{
      document.documentElement.style.webkitUserSelect = "none";
      document.documentElement.style.userSelect = "none";
      document.documentElement.style.webkitTouchCallout = "none"; // iOS 長按選單
      document.body && (document.body.style.webkitUserSelect = "none");
      document.body && (document.body.style.userSelect = "none");
      document.body && (document.body.style.webkitTouchCallout = "none");
    }catch(e){}
  }

  function preventTouchCallout(el){
    if(!el) return;
    // iOS：touchstart 若不 passive 才能 preventDefault
    el.addEventListener("touchstart", (e)=>{ e.preventDefault(); }, {passive:false});
  }

  /* =========================
     Required IDs 檢查
  ========================= */
  const REQUIRED_IDS = [
    // global
    "btnGodToggle","fabGod",
    "btnOpenAnnouncement","fabAnn",
    "btnRestart",

    // screens
    "screen-setup","screen-deal","screen-night","screen-day","screen-end",

    // setup
    "btnStart","btnOpenRoleConfig","btnSuggest",
    "btnPlus","btnMinus","rangeCount",
    "playerCount","roleTotal","playerTotal","warnRoleTotal",
    "boardBasic","boardB1",

    // deal
    "dealText","btnHoldReveal","btnNextPlayer","btnFinishDeal","btnDealBack",

    // night
    "nightTag","nightScript","nightSeats",
    "btnNightPrev","btnNightNext",

    // day
    "dayTag",
    "btnPolice","btnTalkOrder","btnVote","btnDayNext",

    // modals (pin / role / announcement / log)
    "modalGod","pinInput","pinOk","pinCancel","pinWarn","closeGod",
    "modalRole","roleConfigBody","roleApply","roleReset","closeRole",
    "modalAnn","annBox","annToday","annHistory","btnCopyAnn","closeAnn",
    "modalLog","logList","closeLog","btnExport","btnClearSave",

    // end
    "endTitle","endText","btnBackToSetup"
  ];

  function checkRequiredIds(){
    const missing = REQUIRED_IDS.filter(id => !$(id));
    return missing;
  }

  function reportMissingIds(missing){
    if(!missing.length) return;
    console.warn("[WW] Missing IDs:", missing);

    // 直接在畫面上提示（方便你手機上看到）
    const box = document.createElement("div");
    box.style.position = "fixed";
    box.style.left = "12px";
    box.style.right = "12px";
    box.style.bottom = "12px";
    box.style.zIndex = "99999";
    box.style.background = "rgba(20,0,0,.92)";
    box.style.color = "#fff";
    box.style.padding = "12px";
    box.style.borderRadius = "14px";
    box.style.fontSize = "12px";
    box.style.lineHeight = "1.5";
    box.innerHTML =
      `<div style="font-weight:900;margin-bottom:6px;">⚠️ index.html 缺少必要 id</div>
       <div style="white-space:pre-wrap;">${missing.join(", ")}</div>
       <div style="opacity:.85;margin-top:6px;">請把缺的 id 補回去，不然按鈕會「按了沒反應」。</div>`;
    document.body.appendChild(box);
  }

  /* =========================
     Screen switching (UI helper)
  ========================= */
  function showScreen(id){
    ["screen-setup","screen-deal","screen-night","screen-day","screen-end"].forEach(s=>{
      $(s)?.classList.remove("active");
    });
    $(id)?.classList.add("active");
  }

  /* =========================
     Bindings
  ========================= */
  function bindAll(state){
    // --- global disable long-press selection ---
    disableTextSelectGlobally();
    preventTouchCallout(document.body);

    // 禁止 iOS double tap zoom / long press image preview 交由 CSS + meta
    // 這裡只做 touchcallout

    // --- God toggle ---
    on($("btnGodToggle"), "click", ()=> A.UI?.toggleGod?.());
    on($("fabGod"), "click", ()=> A.UI?.toggleGod?.());

    // --- Announcement ---
    on($("btnOpenAnnouncement"), "click", ()=> A.UI?.openAnnouncement?.("today"));
    on($("fabAnn"), "click", ()=> A.UI?.openAnnouncement?.("today"));
    on($("annToday"), "click", ()=> A.UI?.setAnnMode?.("today"));
    on($("annHistory"), "click", ()=> A.UI?.setAnnMode?.("history"));
    on($("btnCopyAnn"), "click", ()=> A.UI?.copyAnnouncement?.());
    on($("closeAnn"), "click", ()=> A.UI?.closeModal?.("modalAnn"));

    // --- Restart ---
    on($("btnRestart"), "click", ()=> {
      if(confirm("確定要重新開始？（會清除本局存檔與紀錄）")){
        A.State.clear();
        location.reload();
      }
    });

    // --- Setup board ---
    on($("boardBasic"), "click", ()=> A.UI?.selectBoard?.("basic"));
    on($("boardB1"), "click", ()=> A.UI?.selectBoard?.("b1"));

    // --- Setup player count ---
    on($("btnPlus"), "click", ()=> A.UI?.changeCount?.(+1));
    on($("btnMinus"), "click", ()=> A.UI?.changeCount?.(-1));
    on($("rangeCount"), "input", (e)=> A.UI?.setCount?.(Number(e.target.value)));

    // --- Role modal ---
    on($("btnOpenRoleConfig"), "click", ()=> A.UI?.openRoleModal?.());
    on($("roleReset"), "click", ()=> A.UI?.resetRoles?.());
    on($("roleApply"), "click", ()=> A.UI?.closeModal?.("modalRole"));
    on($("closeRole"), "click", ()=> A.UI?.closeModal?.("modalRole"));

    // --- Suggest roles ---
    on($("btnSuggest"), "click", ()=> A.UI?.suggestRoles?.());

    // --- Start game ---
    on($("btnStart"), "click", ()=> A.UI?.startGame?.());

    // --- Deal ---
    preventTouchCallout($("btnHoldReveal"));
    on($("btnDealBack"), "click", ()=> A.UI?.goSetup?.());
    on($("btnNextPlayer"), "click", ()=> A.UI?.dealNext?.());
    on($("btnFinishDeal"), "click", ()=> A.UI?.dealFinish?.());

    // --- Night ---
    on($("btnNightPrev"), "click", ()=> A.UI?.nightPrev?.());
    on($("btnNightNext"), "click", ()=> A.UI?.nightNext?.());

    // --- Day tools ---
    on($("btnPolice"), "click", ()=> A.UI?.openPolice?.());
    on($("btnTalkOrder"), "click", ()=> A.UI?.openSpeech?.());
    on($("btnVote"), "click", ()=> A.UI?.openVote?.());

    // 下一步 -> 下一夜
    on($("btnDayNext"), "click", ()=> A.UI?.goNextNight?.());

    // --- Logs / export / clear ---
    on($("btnExport"), "click", ()=> A.UI?.exportReplay?.());
    on($("btnClearSave"), "click", ()=> {
      if(confirm("確定清除整局存檔與紀錄？")){
        A.State.clear();
        location.reload();
      }
    });
    on($("closeLog"), "click", ()=> A.UI?.closeModal?.("modalLog"));

    // --- God PIN modal ---
    on($("pinOk"), "click", ()=> A.UI?.pinOk?.());
    on($("pinCancel"), "click", ()=> A.UI?.closeModal?.("modalGod"));
    on($("closeGod"), "click", ()=> A.UI?.closeModal?.("modalGod"));

    // --- End screen ---
    on($("btnBackToSetup"), "click", ()=> {
      if(confirm("回到設定頁？（會清除本局存檔）")){
        A.State.clear();
        location.reload();
      }
    });

    // 初次 screen
    showScreen(state.phase === "end" ? "screen-end" : `screen-${state.phase}`);
  }

  A.Bindings = {
    checkRequiredIds,
    reportMissingIds,
    bindAll
  };

})();