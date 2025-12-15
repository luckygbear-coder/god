const $ = id => document.getElementById(id);
const GAME = window.GAME;

/* ---------------------------
   0) 安全載入器（依序載入，不存在也不炸）
--------------------------- */
function loadScript(src){
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = false;
    s.onload = () => resolve({ src, ok:true });
    s.onerror = () => resolve({ src, ok:false });
    document.head.appendChild(s);
  });
}

function mergeRolesFromWindow(){
  // 盡可能吃到你現有 roles 檔案可能掛的全域
  const W = window;
  const candidates = [
    W.WW_ROLES_BASE,
    W.WW_ROLES_B1,
    W.WW_ROLES_SPECIAL,
    W.WW_ROLES_SPECIAL_B1,
    W.WW_ROLES_ALL,
    W.ROLES,
    W.roles
  ].filter(Boolean);

  const out = { ...(GAME.roles || {}) };
  for(const obj of candidates){
    if (!obj || typeof obj !== "object") continue;
    for(const k of Object.keys(obj)){
      out[k] = obj[k];
    }
  }
  GAME.roles = out;
  GAME.rolesLoaded = Object.keys(out).length > 0;
}

function renderDebug(results){
  const lines = [];
  lines.push("=== Loader results ===");
  results.forEach(r => lines.push(`${r.ok ? "✅" : "⚠️"} ${r.src}`));
  lines.push("");
  lines.push("=== Roles summary ===");
  lines.push(`rolesLoaded: ${GAME.rolesLoaded}`);
  lines.push(`rolesCount: ${Object.keys(GAME.roles||{}).length}`);
  const sample = Object.keys(GAME.roles||{}).slice(0, 12);
  lines.push(`sample: ${sample.join(", ") || "(none)"}`);

  const box = $("debugData");
  if (box) box.textContent = lines.join("\n");

  // 開始按鈕永遠可按（因為我們仍可用內建流程）
  // 但你想確認資料成功時，也可以顯示提示
  $("startWarn")?.classList.toggle("hidden", true);
}

/* ---------------------------
   1) 綁定 UI
--------------------------- */
function show(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $("screen-" + name)?.classList.add("active");
}

$("btnStart").onclick = () => {
  const n = Math.max(6, Math.min(12, Number($("playerCount").value) || 9));
  GAME.players = Array.from({ length: n }, (_, i) => ({ seat: i + 1, alive: true }));

  GAME.nightStep = 0;
  GAME.nightState = {};
  GAME._witchPickPoison = false;

  show("night");
  renderNight();
};

$("btnNext").onclick = () => next();
$("btnPrev").onclick = () => prev();

function renderNight() {
  const step = GAME.steps[GAME.nightStep];
  $("nightTitle").textContent = `夜晚流程（${GAME.nightStep + 1}/${GAME.steps.length}）`;
  $("nightText").textContent = step.text;
  renderSeats(step);
}

function renderSeats(step) {
  const box = $("seats");
  box.innerHTML = "";

  if (!step.pick && !step.witch) return;

  GAME.players.forEach(p => {
    const b = document.createElement("button");
    b.className = "seat";
    b.textContent = p.seat;

    b.onclick = () => {
      // 1) 女巫毒藥：點座位
      if (GAME._witchPickPoison) {
        GAME.witch.poisonTarget = p.seat;
        GAME.witch.poisonUsed = true;
        GAME._witchPickPoison = false;
        closeWitch();
        next(); // 女巫完成 → 下一步
        return;
      }

      // 2) 一般 pick
      if (step.pick) {
        GAME.nightState[step.pick] = p.seat;
        highlight(p.seat);
      }
    };

    box.appendChild(b);
  });
}

function highlight(seat) {
  document.querySelectorAll(".seat").forEach(b => {
    b.classList.toggle("selected", Number(b.textContent) === seat);
  });
}

function next() {
  const step = GAME.steps[GAME.nightStep];

  // 女巫步驟：打開女巫 modal（不會卡死）
  if (step.witch) {
    openWitch();
    return;
  }

  GAME.nightStep = Math.min(GAME.steps.length - 1, GAME.nightStep + 1);
  renderNight();
}

function prev() {
  GAME.nightStep = Math.max(0, GAME.nightStep - 1);
  renderNight();
}

/* ---------------------------
   2) 女巫 Modal（保證可點座位）
--------------------------- */
function openWitch() {
  $("witchModal").classList.remove("hidden");
  const knife = GAME.nightState.wolfTarget ? `${GAME.nightState.wolfTarget} 號` : "（狼人未選）";
  $("witchInfo").textContent =
    `狼人刀：${knife}\n解藥：${GAME.witch.saveUsed ? "已用" : "可用"}｜毒藥：${GAME.witch.poisonUsed ? "已用" : "可用"}`;
}

function closeWitch() {
  $("witchModal").classList.add("hidden");
}

$("btnWitchSave").onclick = () => {
  if (GAME.witch.saveUsed) return;
  GAME.witch.saveUsed = true;
  closeWitch();
  next();
};

$("btnWitchPoison").onclick = () => {
  if (GAME.witch.poisonUsed) return;
  // 進入「點座位選毒」模式（重點：一定要用這個旗標）
  GAME._witchPickPoison = true;
};

$("btnWitchSkip").onclick = () => {
  GAME._witchPickPoison = false;
  closeWitch();
  next();
};

/* ---------------------------
   3) 第1批：安全接回 roles（不影響主流程）
--------------------------- */
(async function boot(){
  const roleScripts = [
    "./data/roles/roles.base.js",
    "./data/roles/roles.b1.js",
    "./data/roles/roles.special.js",
    "./data/roles/roles.special.b1.js",
    "./data/roles/roles.all.js",
    "./data/roles/roles.index.js"
  ];

  const results = [];
  for(const src of roleScripts){
    results.push(await loadScript(src));
  }
  mergeRolesFromWindow();
  renderDebug(results);
})();