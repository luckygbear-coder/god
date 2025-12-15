/* =========================================================
   script.js
   - 啟動 app（呼叫 WW_APP_INIT）
   - 公告中心 modal 的行為（今日/歷史/複製/匯出）
========================================================= */

(function(){
  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);

  const core = () => window.WW_APP_CORE;

  let annMode = "today";

  function renderAnnouncement(){
    const box = $("annBox");
    const S = core()?.State;
    if (!box || !S) return;

    if (!S.logs || !S.logs.length) {
      box.textContent = "（尚無公告）";
      return;
    }

    if (annMode === "today") {
      const l = S.logs[0];
      box.textContent = S.godView
        ? (l.publicText + "\n\n" + (l.hiddenText || ""))
        : l.publicText;
      return;
    }

    const lines = [];
    S.logs.forEach((l, idx) => {
      lines.push(`#${S.logs.length - idx}｜第${l.nightNo}夜 / 第${l.dayNo}天`);
      lines.push(l.publicText || "—");
      if (S.godView && l.hiddenText) lines.push(l.hiddenText);
      lines.push("—");
    });
    box.textContent = lines.join("\n");
  }

  function openAnnouncement(forceToday=false){
    if (forceToday) annMode = "today";
    $("modalAnn")?.classList.remove("hidden");
    $("annToday")?.classList.toggle("active", annMode === "today");
    $("annHistory")?.classList.toggle("active", annMode === "history");
    renderAnnouncement();
  }
  function closeAnnouncement(){
    $("modalAnn")?.classList.add("hidden");
  }

  // 對 app.js 暴露 API
  window.WW_APP = {
    openAnnouncement,
    renderAnnouncement
  };

  function copyText(txt){
    if (!txt) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(txt).then(()=>alert("已複製"));
    } else {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = txt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      alert("已複製");
    }
  }

  function exportJSON(){
    const S = core()?.State;
    if (!S) return;
    const data = {
      exportedAt: new Date().toISOString(),
      boardId: S.boardId,
      playerCount: S.playerCount,
      players: S.players,
      logs: S.logs
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "werewolf-announcement-export.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function bindAnn(){
    on($("btnOpenAnnouncement"), "click", ()=>openAnnouncement(false));
    on($("btnOpenAnnouncement2"), "click", ()=>openAnnouncement(false));
    on($("btnOpenAnnouncement3"), "click", ()=>openAnnouncement(false));
    on($("fabAnn"), "click", ()=>openAnnouncement(false));

    on($("closeAnn"), "click", closeAnnouncement);

    on($("annToday"), "click", ()=>{
      annMode = "today";
      $("annToday")?.classList.add("active");
      $("annHistory")?.classList.remove("active");
      renderAnnouncement();
    });

    on($("annHistory"), "click", ()=>{
      annMode = "history";
      $("annHistory")?.classList.add("active");
      $("annToday")?.classList.remove("active");
      renderAnnouncement();
    });

    on($("btnCopyAnn"), "click", ()=>{
      copyText($("annBox")?.textContent || "");
    });

    on($("btnExport"), "click", exportJSON);
  }

  // 啟動
  function init(){
    bindAnn();
    if (typeof window.WW_APP_INIT === "function") window.WW_APP_INIT();
  }

  init();
})();
