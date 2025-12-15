// script.js
(() => {
  // ✅ iOS 防長按選字/選單/放大（配合 CSS touch-action）
  try {
    document.documentElement.style.webkitUserSelect = "none";
    document.documentElement.style.userSelect = "none";
    document.documentElement.style.webkitTouchCallout = "none";
  } catch(e){}

  document.addEventListener("contextmenu", (e)=>e.preventDefault(), {passive:false});
  document.addEventListener("selectstart", (e)=>e.preventDefault(), {passive:false});
  document.addEventListener("gesturestart", (e)=>e.preventDefault(), {passive:false});

  // ✅ 防雙擊放大（Safari 常見）
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive:false });

  // ✅ PWA Service Worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(()=>{});
    });
  }
})();