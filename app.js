/* =========================================================
   狼人殺｜上帝輔助 PWA
   app.js（穩定版｜對齊你目前 index.html）

   目標：
   ✅ UI/流程/狀態（可跑完整循環）
   ✅ 依賴 WW_DATA 時「自動相容」：
      - 若 WW_DATA.getBoardBundle 存在：用它
      - 否則 fallback：用 WW_DATA.boards / roles / nightSteps / rules
      - 仍不齊：用內建最小板子，保證能開始遊戲
   ✅ 綁定你 index.html 裡所有按鈕 id（避免沒反應）
========================================================= */

(() => {
  const $ = (id) => document.getElementById(id);
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);

  /* -------------------------
     iOS 防長按選字 / 放大
  --------------------------*/
  try {
    document.documentElement.style.webkitUserSelect = "none";
    document.documentElement.style.userSelect = "none";
    document.documentElement.style.webkitTouchCallout = "none";
  } catch (e) {}
  document.addEventListener("contextmenu", (e) => e.preventDefault(), { passive: false });

  /* -------------------------
     Storage
  --------------------------*/
  const STORAGE_KEY = "ww_pwa_save_v1";
  const save = (s) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {}
  };
  const load = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  };
  const clearSave = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  };

  /* -------------------------
     State
  --------------------------*/
  const State = {
    phase: "setup",      // setup | deal | night | day
    boardId: "basic",    // basic | b1
    playerCount: 9,

    rolesCount: {},      // {roleId: count}
    players: [],         // [{seat, roleId, name, icon, team, alive}]
    dealIndex: 0,

    nightNo: 1,
    dayNo: 1,
    nightStepIndex: 0,

    godView: false,

    // 夜晚暫存行動
    night: {
      wolfTarget: null,
      guardTarget: null,
      seerTarget: null,
      witchSave: false,
      witchPoisonTarget: null,
      witchSaveUsed: false,
      witchPoisonUsed: false
    },

    logs: [] // [{nightNo,dayNo,publicText,hiddenText,ts}]
  };

  // 還原存檔
  const saved = load();
  if (saved && typeof saved === "object") {
    Object.assign(State, saved);
    State.night = Object.assign({
      wolfTarget:null, guardTarget:null, seerTarget:null,
      witchSave:false, witchPoisonTarget:null,
      witchSaveUsed:false, witchPoisonUsed:false
    }, saved.night || {});
    State.logs = Array.isArray(saved.logs) ? saved.logs : [];
  }

  /* -------------------------
     Screen switch
  --------------------------*/
  const showScreen = (name) => {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    $(`screen-${name}`)?.classList.add("active");
    State.phase = name;
    save(State);
  };

  /* -------------------------
     God toggle (多入口)
  --------------------------*/
  function setGod(onFlag) {
    State.godView = !!onFlag;
    document.body.classList.toggle("god-on", State.godView);

    const icon = State.godView ? "🔓" : "🔒";
    if ($("btnGodToggle")) $("btnGodToggle").textContent = icon;
    if ($("fabGod")) $("fabGod").textContent = icon;

    save(State);
    // 公告內容可能因視角不同
    if (!$("modalAnn")?.classList.contains("hidden")) renderAnnouncement();
  }

  function toggleGod() {
    // 你目前 HTML 也有 PIN modal，但此版先「直接切換」
    // 之後你要加 PIN，再把這裡改成先開 modalGod
    setGod(!State.godView);
  }

  on($("btnGodToggle"), "click", toggleGod);
  on($("fabGod"), "click", toggleGod);
  // 你夜晚頁有 btnGodToggle2（用 onclick 轉點 btnGodToggle），不用再綁

  /* -------------------------
     Restart button (自動插入)
  --------------------------*/
  function ensureRestartBtn() {
    if ($("btnRestart")) return;
    const wrap = document.querySelector(".top-actions");
    if (!wrap) return;

    const btn = document.createElement("button");
    btn.className = "iconbtn";
    btn.id = "btnRestart";
    btn.type = "button";
    btn.title = "重新開始";
    btn.textContent = "🔁";
    wrap.prepend(btn);

    on(btn, "click", () => {
      if (!confirm("確定要重新開始？所有進度會清除並回到開局設定。")) return;
      clearSave();
      location.reload();
    });
  }

  /* -------------------------
     Announcement modal
  --------------------------*/
  function openAnnouncement() {
    $("modalAnn")?.classList.remove("hidden");
    // 預設顯示今日
    $("annToday")?.classList.add("active");
    $("annHistory")?.classList.remove("active");
    renderAnnouncement("today");
  }

  function closeAnnouncement() {
    $("modalAnn")?.classList.add("hidden");
  }

  function renderAnnouncement(mode = null) {
    const isToday = mode ? (mode === "today") : $("annToday")?.classList.contains("active");
    const box = $("annBox");
    if (!box) return;

    if (!State.logs.length) {
      box.textContent = "（尚無公告）";
      return;
    }

    if (isToday) {
      const latest = State.logs[0];
      box.textContent = State.godView
        ? `${latest.publicText}\n\n${latest.hiddenText || ""}`.trim()
        : (latest.publicText || "（尚無公告）");
      return;
    }

    const lines = [];
    for (let i = State.logs.length - 1; i >= 0; i--) {
      const l = State.logs[i];
      lines.push(`第${l.nightNo}夜 / 第${l.dayNo}天｜${new Date(l.ts).toLocaleString()}`);
      lines.push(l.publicText || "—");
      if (State.godView && l.hiddenText) lines.push(l.hiddenText);
      lines.push("—");
    }
    box.textContent = lines.join("\n");
  }

  on($("btnOpenAnnouncement"), "click", openAnnouncement);
  on($("fabAnn"), "click", openAnnouncement);
  on($("btnOpenAnnouncement2"), "click", openAnnouncement);
  // 你白天頁 btnOpenAnnouncement3 用 onclick 轉點 btnOpenAnnouncement，不用再綁
  on($("closeAnn"), "click", closeAnnouncement);

  on($("annToday"), "click", () => {
    $("annToday")?.classList.add("active");
    $("annHistory")?.classList.remove("active");
    renderAnnouncement("today");
  });

  on($("annHistory"), "click", () => {
    $("annHistory")?.classList.add("active");
    $("annToday")?.classList.remove("active");
    renderAnnouncement("history");
  });

  on($("btnCopyAnn"), "click", async () => {
    try {
      await navigator.clipboard.writeText($("annBox")?.textContent || "");
      alert("已複製");
    } catch (e) {
      alert("複製失敗（請用 HTTPS / 安裝成 PWA 會更穩）");
    }
  });

  on($("btnExport"), "click", () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      godView: State.godView,
      state: State
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `狼人殺復盤_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  });

  /* -------------------------
     WW_DATA bundle resolver (相容層)
  --------------------------*/
  function getWW() {
    return window.WW_DATA || null;
  }

  // 內建最小角色資料（fallback）
  const FALLBACK_ROLES = {
    werewolf: { id:"werewolf", name:"狼人", icon:"🐺", team:"wolf" },
    villager:{ id:"villager", name:"村民", icon:"🙂", team:"villager" },
    seer:    { id:"seer", name:"預言家", icon:"🔮", team:"villager" },
    witch:   { id:"witch", name:"女巫", icon:"🧪", team:"villager" },
    hunter:  { id:"hunter", name:"獵人", icon:"🔫", team:"villager" },
    guard:   { id:"guard", name:"守衛", icon:"🛡️", team:"villager" },
  };

  function roleInfo(roleId) {
    const WW = getWW();
    const r = (WW && WW.roles && WW.roles[roleId]) ? WW.roles[roleId] : null;
    return r || FALLBACK_ROLES[roleId] || { id: roleId, name: roleId, icon:"❔", team:"villager" };
  }

  // 最小可用板子（一定能開始）
  function fallbackBundleBasic(n) {
    // 9人：2狼+預女獵+4民（多寡會自動補民）
    const wolves = n >= 9 ? 2 : 1;
    const fixed = 3; // seer/witch/hunter
    const villagers = Math.max(0, n - wolves - fixed);
    const config = { werewolf: wolves, seer:1, witch:1, hunter:1, villager:villagers, guard:0 };

    return {
      id: "basic",
      name: "基本板子(內建)",
      suggestRoles: () => ({ ...config }),
      buildPlayers: (rolesCount) => buildPlayersFromRolesCount(n, rolesCount),
      nightSteps: () => ([
        { key:"close", type:"info", publicScript:"天黑請閉眼。", godScript:"天黑請閉眼。" },
        { key:"wolf", type:"pick", pickKey:"wolfTarget", required:true, publicScript:"狼人請睜眼。", godScript:"狼人刀誰？（點座位）" },
        { key:"seer", type:"pick", pickKey:"seerTarget", required:false, publicScript:"預言家請睜眼。", godScript:"預言家驗誰？（點座位）" },
        { key:"witch", type:"witch", publicScript:"女巫請睜眼。", godScript:"女巫操作（下一步會打開面板）" },
        { key:"resolve", type:"resolve", publicScript:"天亮請睜眼。", godScript:"結算夜晚 → 生成公告" },
      ]),
      rules: {
        resolveNight: ({ players, night }) => {
          // 最小規則：只有狼刀（女巫救/毒可選）
          const deaths = new Set();

          const wolf = night.wolfTarget;
          if (wolf) {
            const saved = !!night.witchSave;
            if (!saved) deaths.add(wolf);
          }
          if (night.witchPoisonTarget) deaths.add(night.witchPoisonTarget);

          // 套用死亡
          deaths.forEach(seat => {
            const p = players.find(x => x.seat === seat);
            if (p) p.alive = false;
          });

          return { deaths: [...deaths] };
        },
        buildAnnouncement: ({ nightNo, dayNo, result }) => {
          const list = (result.deaths && result.deaths.length) ? result.deaths.join("、") + " 號" : "無";
          return {
            publicText: `第${nightNo}夜結束｜天亮了\n昨晚死亡：${list}`,
            hiddenText: `（上帝）死亡清單：${list}`
          };
        }
      }
    };
  }

  function buildPlayersFromRolesCount(n, rolesCount) {
    const arr = [];
    Object.entries(rolesCount).forEach(([rid, cnt]) => {
      for (let i = 0; i < (cnt || 0); i++) arr.push(rid);
    });

    // 若不足補村民
    while (arr.length < n) arr.push("villager");
    // 若超過就截斷
    arr.length = n;

    // 洗牌
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    return arr.map((rid, idx) => {
      const info = roleInfo(rid);
      return {
        seat: idx + 1,
        roleId: rid,
        name: info.name,
        icon: info.icon,
        team: info.team,
        alive: true
      };
    });
  }

  function resolveBundle(boardId) {
    const WW = getWW();

    // 1) 你原本想用的 API：WW_DATA.getBoardBundle(boardId)
    if (WW && typeof WW.getBoardBundle === "function") {
      const b = WW.getBoardBundle(boardId);
      if (b) return normalizeBundle(b, boardId);
    }

    // 2) 若 WW_DATA 有 boards / rules / nightSteps 的資料集
    //    我們嘗試拼出一個 bundle
    if (WW) {
      // boards.config.js 你可能做成 WW.boards
      const boardObj =
        (WW.boards && (WW.boards[boardId] || WW.boards[boardId?.toLowerCase?.()])) ||
        null;

      const rulesObj =
        (WW.rules && (WW.rules[boardId] || WW.rules[`${boardId}.js`])) ||
        null;

      const nightObj =
        (WW.nightSteps && (WW.nightSteps[boardId] || WW.nightSteps[`${boardId}.js`])) ||
        null;

      if (boardObj) {
        return normalizeBundle({
          id: boardId,
          name: boardObj.name || boardId,
          suggestRoles: boardObj.suggestRoles,
          buildPlayers: boardObj.buildPlayers,
          nightSteps: nightObj?.nightSteps || nightObj,
          rules: rulesObj || boardObj.rules
        }, boardId);
      }
    }

    // 3) 最後 fallback：內建 basic
    return normalizeBundle(fallbackBundleBasic(State.playerCount), boardId);
  }

  function normalizeBundle(bundle, boardId) {
    // 允許 bundle.board / bundle.rules / bundle.nightSteps 這種結構
    if (bundle.board && (bundle.rules || bundle.nightSteps)) {
      return {
        id: bundle.board.id || boardId,
        name: bundle.board.name || boardId,
        suggestRoles: bundle.board.suggestRoles || bundle.suggestRoles,
        buildPlayers: bundle.board.buildPlayers || bundle.buildPlayers,
        nightSteps: bundle.nightSteps || bundle.board.nightSteps,
        rules: bundle.rules || bundle.board.rules
      };
    }

    // 允許平面結構：{buildPlayers, nightSteps, rules}
    return {
      id: bundle.id || boardId,
      name: bundle.name || boardId,
      suggestRoles: bundle.suggestRoles,
      buildPlayers: bundle.buildPlayers,
      nightSteps: bundle.nightSteps,
      rules: bundle.rules
    };
  }

  /* -------------------------
     Setup UI
  --------------------------*/
  function rolesTotal() {
    return Object.values(State.rolesCount || {}).reduce((a, b) => a + (b || 0), 0);
  }

  function syncSetupUI() {
    if ($("playerCount")) $("playerCount").textContent = String(State.playerCount);
    if ($("rangeCount")) $("rangeCount").value = String(State.playerCount);
    if ($("playerTotal")) $("playerTotal").textContent = String(State.playerCount);

    const rt = rolesTotal();
    if ($("roleTotal")) $("roleTotal").textContent = String(rt);

    const ok = rt === State.playerCount;
    $("warnRoleTotal")?.classList.toggle("hidden", ok);
    if ($("btnStart")) $("btnStart").disabled = !ok;

    save(State);
  }

  function applySuggestRoles() {
    const bundle = resolveBundle(State.boardId);
    const suggest = (typeof bundle.suggestRoles === "function")
      ? bundle.suggestRoles(State.playerCount)
      : null;

    if (suggest && typeof suggest === "object") {
      State.rolesCount = { ...suggest };
    } else {
      // fallback：basic 建議
      State.rolesCount = fallbackBundleBasic(State.playerCount).suggestRoles();
    }
    syncSetupUI();
  }

  on($("boardBasic"), "click", () => {
    State.boardId = "basic";
    $("boardBasic")?.classList.add("active");
    $("boardSpecial")?.classList.remove("active");
    applySuggestRoles();
  });

  on($("boardSpecial"), "click", () => {
    State.boardId = "b1";
    $("boardSpecial")?.classList.add("active");
    $("boardBasic")?.classList.remove("active");
    applySuggestRoles();
  });

  on($("btnMinus"), "click", () => {
    State.playerCount = Math.max(6, State.playerCount - 1);
    applySuggestRoles();
  });

  on($("btnPlus"), "click", () => {
    State.playerCount = Math.min(12, State.playerCount + 1);
    applySuggestRoles();
  });

  on($("rangeCount"), "input", (e) => {
    const v = Number(e.target.value);
    State.playerCount = Math.max(6, Math.min(12, v));
    applySuggestRoles();
  });

  on($("btnSuggest"), "click", applySuggestRoles);

  // 角色調整 modal（先做最基本：把 rolesCount 顯示+/-）
  function openRoleModal() {
    const body = $("roleConfigBody");
    if (!body) return;

    const list = Object.keys(State.rolesCount || {});
    // 如果空的，就先建議配置
    if (!list.length) applySuggestRoles();

    body.innerHTML = "";
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.style.marginBottom = "10px";
    hint.textContent = "角色總數必須等於玩家人數才能開始。";
    body.appendChild(hint);

    const roleIds = Object.keys(State.rolesCount);

    roleIds.forEach((rid) => {
      const info = roleInfo(rid);
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
      row.style.padding = "10px 4px";
      row.style.borderBottom = "1px dashed rgba(0,0,0,.12)";

      const left = document.createElement("div");
      left.style.fontWeight = "900";
      left.textContent = `${info.icon ? info.icon + " " : ""}${info.name}`;

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.alignItems = "center";
      right.style.gap = "10px";

      const minus = document.createElement("button");
      minus.type = "button";
      minus.className = "btn ghost tiny";
      minus.textContent = "－";

      const num = document.createElement("div");
      num.style.minWidth = "36px";
      num.style.textAlign = "center";
      num.style.fontWeight = "900";
      num.textContent = String(State.rolesCount[rid] || 0);

      const plus = document.createElement("button");
      plus.type = "button";
      plus.className = "btn ghost tiny";
      plus.textContent = "＋";

      minus.onclick = () => {
        State.rolesCount[rid] = Math.max(0, (State.rolesCount[rid] || 0) - 1);
        num.textContent = String(State.rolesCount[rid]);
        syncSetupUI();
      };
      plus.onclick = () => {
        State.rolesCount[rid] = (State.rolesCount[rid] || 0) + 1;
        num.textContent = String(State.rolesCount[rid]);
        syncSetupUI();
      };

      right.append(minus, num, plus);
      row.append(left, right);
      body.appendChild(row);
    });

    $("modalRole")?.classList.remove("hidden");
  }

  on($("btnOpenRoleConfig"), "click", openRoleModal);
  on($("closeRole"), "click", () => $("modalRole")?.classList.add("hidden"));
  on($("roleReset"), "click", applySuggestRoles);
  on($("roleApply"), "click", () => {
    $("modalRole")?.classList.add("hidden");
    syncSetupUI();
  });

  /* -------------------------
     Start game
  --------------------------*/
  function startGame() {
    // 防呆：角色數必須等於玩家數
    if (rolesTotal() !== State.playerCount) {
      alert("⚠️ 角色總數必須等於玩家人數");
      return;
    }

    // 取得 bundle（可用 WW_DATA 或 fallback）
    const bundle = resolveBundle(State.boardId);

    // buildPlayers：容許不同寫法
    let players = null;
    if (typeof bundle.buildPlayers === "function") {
      players = bundle.buildPlayers(State.rolesCount, State.playerCount);
    } else {
      players = buildPlayersFromRolesCount(State.playerCount, State.rolesCount);
    }

    if (!Array.isArray(players) || !players.length) {
      alert("❌ 板子資料 buildPlayers() 失敗（已切換 fallback，仍失敗）");
      return;
    }

    // 初始化遊戲
    State.players = players.map((p, idx) => ({
      seat: p.seat ?? (idx + 1),
      roleId: p.roleId || p.id || p.name || "villager",
      name: p.name || roleInfo(p.roleId || "villager").name,
      icon: p.icon || roleInfo(p.roleId || "villager").icon,
      team: p.team || roleInfo(p.roleId || "villager").team,
      alive: (p.alive !== false)
    }));

    State.dealIndex = 0;
    State.nightNo = 1;
    State.dayNo = 1;
    State.nightStepIndex = 0;

    // 夜晚狀態重置（保留藥是否已用）
    State.night = Object.assign(State.night, {
      wolfTarget:null,
      guardTarget:null,
      seerTarget:null,
      witchSave:false,
      witchPoisonTarget:null
    });

    // 如果想每局重置藥：把下面兩行解除註解
    State.night.witchSaveUsed = false;
    State.night.witchPoisonUsed = false;

    State.logs = [];

    // 存下 bundle 到 WW_DATA 以外（我們只在這版 runtime 用，不存 localStorage）
    window.__WW_BUNDLE__ = bundle;

    showScreen("deal");
    renderDeal();
    renderDealSeatGrid();
    save(State);
  }

  on($("btnStart"), "click", startGame);

  /* -------------------------
     Deal (長按翻牌 + 座位回看)
  --------------------------*/
  let holdTimer = null;

  function renderDeal() {
    const p = State.players[State.dealIndex];
    if (!p) return;

    if ($("dealText")) $("dealText").innerHTML = `請 <b>${p.seat} 號</b> 拿手機`;

    const btn = $("btnHoldReveal");
    if (!btn) return;

    // 每次 renderDeal 先清理舊事件（避免重複疊加）
    btn.onpointerdown = null;
    btn.onpointerup = null;
    btn.onpointercancel = null;
    btn.onpointerleave = null;

    // 防 iOS 長按彈出選字
    btn.style.webkitUserSelect = "none";
    btn.style.userSelect = "none";

    btn.onpointerdown = (e) => {
      e.preventDefault();
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        $("revealRole").textContent = `${p.icon || "❔"} ${p.name || p.roleId}`;
        $("modalReveal")?.classList.remove("hidden");
        navigator.vibrate?.(60);
      }, 900);
    };

    const end = (e) => {
      e && e.preventDefault && e.preventDefault();
      clearTimeout(holdTimer);
      $("modalReveal")?.classList.add("hidden");
    };

    btn.onpointerup = end;
    btn.onpointercancel = end;
    btn.onpointerleave = end;
  }

  function renderDealSeatGrid() {
    const grid = $("dealSeatGrid");
    if (!grid) return;
    grid.innerHTML = "";

    State.players.forEach((p) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seat";
      b.textContent = String(p.seat);

      if (State.dealIndex === p.seat - 1) b.classList.add("selected");

      b.onclick = () => {
        State.dealIndex = p.seat - 1;
        renderDeal();
        renderDealSeatGrid();
        save(State);
      };

      grid.appendChild(b);
    });
  }

  function nextDeal() {
    // 下一位（不自動進夜晚）
    if (State.dealIndex < State.players.length - 1) {
      State.dealIndex++;
      renderDeal();
      renderDealSeatGrid();
      save(State);
    } else {
      // 已到最後一位
      navigator.vibrate?.(40);
    }
  }

  on($("btnNextPlayer"), "click", nextDeal);
  on($("btnDealBack"), "click", () => showScreen("setup"));

  // 全部抽完 → 跳確認視窗（你有 modalDealConfirm）
  on($("btnFinishDeal"), "click", () => {
    $("modalDealConfirm")?.classList.remove("hidden");
  });

  on($("dealConfirmNo"), "click", () => {
    $("modalDealConfirm")?.classList.add("hidden");
  });

  on($("dealConfirmYes"), "click", () => {
    $("modalDealConfirm")?.classList.add("hidden");
    // 進夜晚
    initNight();
    showScreen("night");
    save(State);
  });

  /* -------------------------
     Night flow
  --------------------------*/
  function getNightSteps() {
    const bundle = window.__WW_BUNDLE__ || resolveBundle(State.boardId);
    // nightSteps 允許是 function 或 array
    if (typeof bundle.nightSteps === "function") return bundle.nightSteps(State.players, State.night);
    if (Array.isArray(bundle.nightSteps)) return bundle.nightSteps;
    // fallback：最小夜晚步驟
    return fallbackBundleBasic(State.playerCount).nightSteps();
  }

  function initNight() {
    State.nightStepIndex = 0;
    // 每夜重置動作（保留藥用過狀態）
    State.night.wolfTarget = null;
    State.night.guardTarget = null;
    State.night.seerTarget = null;
    State.night.witchSave = false;
    State.night.witchPoisonTarget = null;
    renderNight();
    save(State);
  }

  function renderNight() {
    if ($("nightTag")) $("nightTag").textContent = `第 ${State.nightNo} 夜`;

    const steps = getNightSteps();
    const step = steps[State.nightStepIndex];
    if (!step) {
      $("nightScript") && ($("nightScript").textContent = "（夜晚流程結束）");
      return;
    }

    const script = State.godView ? (step.godScript || step.publicScript || "") : (step.publicScript || "");
    if ($("nightScript")) $("nightScript").textContent = script || "（此步驟無台詞）";

    renderNightSeats(step);
  }

  function renderNightSeats(step) {
    const box = $("nightSeats");
    if (!box) return;
    box.innerHTML = "";

    State.players.forEach((p) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "seat" + (p.alive ? "" : " dead");
      b.textContent = String(p.seat);

      if (!p.alive) b.disabled = true;

      b.onclick = () => {
        if (!p.alive) return;

        // 女巫毒藥選人模式：直接寫入
        if (window.__PICK_POISON__) {
          State.night.witchPoisonTarget = p.seat;
          window.__PICK_POISON__ = false;
          save(State);
          alert(`已選擇毒 ${p.seat} 號`);
          return;
        }

        // 一般 pick：寫入 step.pickKey
        if (step && step.pickKey) {
          State.night[step.pickKey] = p.seat;
          save(State);
          navigator.vibrate?.(20);
        }
      };

      box.appendChild(b);
    });
  }

  function nightPrev() {
    State.nightStepIndex = Math.max(0, State.nightStepIndex - 1);
    renderNight();
    save(State);
  }

  function nightNext() {
    const steps = getNightSteps();
    const step = steps[State.nightStepIndex];
    if (!step) return;

    // 如果需要必選 target
    if (step.required && step.pickKey && !State.night[step.pickKey]) {
      navigator.vibrate?.([60, 40, 60]);
      alert("請先點選座位目標");
      return;
    }

    // 女巫步驟：打開女巫彈窗（上帝視角更合理，但不強制）
    if (step.type === "witch") {
      openWitchModal();
      return;
    }

    // 結算
    if (step.type === "resolve") {
      resolveNight();
      return;
    }

    State.nightStepIndex++;
    renderNight();
    save(State);
  }

  on($("btnNightPrev"), "click", nightPrev);
  on($("btnNightNext"), "click", nightNext);

  /* -------------------------
     Witch modal (你 HTML 已有完整元件)
  --------------------------*/
  function openWitchModal() {
    // 如果解藥用過：不顯示刀口（依你需求）
    const knife = State.night.wolfTarget;
    const knifeEl = $("witchKnife");
    const statusEl = $("witchStatus");

    const saveUsed = !!State.night.witchSaveUsed;
    const poisonUsed = !!State.night.witchPoisonUsed;

    if (knifeEl) knifeEl.textContent = (saveUsed ? "（解藥已用過，不顯示刀口）" : (knife ? `${knife} 號` : "—"));
    if (statusEl) statusEl.textContent = `解藥：${saveUsed ? "已用過" : "可用"}｜毒藥：${poisonUsed ? "已用過" : "可用"}`;

    // 按鈕狀態
    const btnSave = $("btnWitchSave");
    const btnNoSave = $("btnWitchNoSave");
    const btnPoisonPick = $("btnWitchPoisonPick");
    const btnNoPoison = $("btnWitchNoPoison");

    if (btnSave) btnSave.disabled = saveUsed || !knife;      // 沒刀口不給救
    if (btnNoSave) btnNoSave.disabled = false;

    if (btnPoisonPick) btnPoisonPick.disabled = poisonUsed;  // 毒藥用過鎖
    if (btnNoPoison) btnNoPoison.disabled = false;

    $("modalWitch")?.classList.remove("hidden");
  }

  on($("btnWitchSave"), "click", () => {
    if (State.night.witchSaveUsed) return;
    if (!State.night.wolfTarget) return;
    State.night.witchSave = true;
    save(State);
    alert("✅ 已選擇使用解藥（救）");
  });

  on($("btnWitchNoSave"), "click", () => {
    State.night.witchSave = false;
    save(State);
    alert("已選擇不用解藥");
  });

  on($("btnWitchPoisonPick"), "click", () => {
    if (State.night.witchPoisonUsed) return;
    window.__PICK_POISON__ = true;
    save(State);
    alert("請關閉女巫視窗後，回到座位圈點選要毒的人");
  });

  on($("btnWitchNoPoison"), "click", () => {
    State.night.witchPoisonTarget = null;
    window.__PICK_POISON__ = false;
    save(State);
    alert("已選擇不用毒藥");
  });

  on($("btnWitchDone"), "click", () => {
    $("modalWitch")?.classList.add("hidden");

    // 用藥鎖定（這一夜按過就視為用掉）
    if (State.night.witchSave) State.night.witchSaveUsed = true;
    if (State.night.witchPoisonTarget) State.night.witchPoisonUsed = true;

    window.__PICK_POISON__ = false;

    // 女巫完成 → 直接進下一步
    State.nightStepIndex++;
    renderNight();
    save(State);
  });

  /* -------------------------
     Resolve night -> Day
  --------------------------*/
  function resolveNight() {
    const bundle = window.__WW_BUNDLE__ || resolveBundle(State.boardId);
    const rules = bundle.rules || fallbackBundleBasic(State.playerCount).rules;

    let result = null;
    if (rules && typeof rules.resolveNight === "function") {
      result = rules.resolveNight({
        players: State.players,
        night: State.night,
        settings: bundle.settings || {}
      });
    } else {
      // fallback
      result = fallbackBundleBasic(State.playerCount).rules.resolveNight({
        players: State.players,
        night: State.night,
        settings: {}
      });
    }

    let ann = null;
    if (rules && typeof rules.buildAnnouncement === "function") {
      ann = rules.buildAnnouncement({
        nightNo: State.nightNo,
        dayNo: State.dayNo,
        players: State.players,
        result,
        resolved: result
      });
    } else {
      ann = fallbackBundleBasic(State.playerCount).rules.buildAnnouncement({
        nightNo: State.nightNo,
        dayNo: State.dayNo,
        result
      });
    }

    const logItem = {
      ts: new Date().toISOString(),
      nightNo: State.nightNo,
      dayNo: State.dayNo,
      publicText: ann.publicText || "（無公告）",
      hiddenText: ann.hiddenText || ""
    };
    State.logs.unshift(logItem);

    // 顯示公告
    openAnnouncement();

    // 進白天
    renderDayAlive();
    if ($("dayTag")) $("dayTag").textContent = `第 ${State.dayNo} 天`;
    showScreen("day");
    save(State);
  }

  function renderDayAlive() {
    const el = $("dayAlive");
    if (!el) return;
    const alive = State.players.filter(p => p.alive).map(p => `${p.seat}號`).join("、") || "無";
    el.textContent = `存活：${alive}`;
  }

  /* -------------------------
     Day next -> next night
  --------------------------*/
  function nextDayToNight() {
    State.nightNo++;
    State.dayNo++;
    showScreen("night");
    initNight();
    save(State);
  }

  on($("btnDayNext"), "click", nextDayToNight);

  /* -------------------------
     Boot
  --------------------------*/
  function boot() {
    ensureRestartBtn();
    setGod(!!State.godView);

    // 初次若 rolesCount 空 → 建議配置
    if (!State.rolesCount || !Object.keys(State.rolesCount).length) {
      applySuggestRoles();
    } else {
      syncSetupUI();
    }

    // 綁定公告按鈕在 day/night/deal 都走同一個 modal（已綁）
    // 初始化畫面
    showScreen(State.phase || "setup");

    if (State.phase === "deal") {
      renderDeal();
      renderDealSeatGrid();
    }
    if (State.phase === "night") {
      renderNight();
    }
    if (State.phase === "day") {
      renderDayAlive();
      if ($("dayTag")) $("dayTag").textContent = `第 ${State.dayNo} 天`;
    }
  }

  // DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

})();