// script.js：只放「啟動級」東西（SW + iOS 防雙點）
// app.js 只處理遊戲邏輯與 UI

// PWA service worker（有 sw.js 就會註冊）
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  });
}

// iOS Safari：再補一層「雙擊不放大」
let lastTouchEnd = 0;
document.addEventListener("touchend", (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });

// desktop 雙擊也不做縮放（避免意外）
document.addEventListener("dblclick", (e) => {
  e.preventDefault();
}, { passive: false });