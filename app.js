/* ===========================
狼人殺上帝輔助 - app.js（完整覆蓋 v2：防白屏）
=========================== */
(() => {
  "use strict";

  /* ---------- Error overlay (no blank screen) ---------- */
  function showFatal(err) {
    try {
      const box = document.createElement("div");
      box.style.cssText = [
        "position:fixed","inset:12px","z-index:999999",
        "background:#fff7e6","border:2px solid #f5d3a6","border-radius:16px",
        "box-shadow:0 10px 26px rgba(0,0,0,.18)",
        "padding:12px 14px","font-family:ui-monospace,Menlo,monospace",
        "color:#4b3044","overflow:auto","white-space:pre-wrap"
      ].join(";");
      box.innerHTML =
`🐺 app.js 發生錯誤（所以剛剛才會整頁空白）

${String(err && (err.stack || err.message || err))}

✅ 請把這段截圖/貼回給我，我可以精準修。
`;
      document.body.appendChild(box);
    } catch (e) {
      alert("app.js error: " + (err && (err.message || err)));
    }
  }

  window.addEventListener("error", (e) => showFatal(e.error || e.message));
  window.addEventListener("unhandledrejection", (e) => showFatal(e.reason));

  try {
    /* ---------- DOM helpers ---------- */
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => Array.from(document.querySelectorAll(sel));
    const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);

    const LS_KEY = "wolf_god_helper_state_v1";
    const NOW = () => Date.now();

    /* ---------- Elements (safe) ---------- */
    const el = {
      uiStatus: $("#uiStatus"),
      uiBoard: $("#uiBoard"),

      btnDice: $("#btnDice"),
      btnSettings: $("#btnSettings"),

      // optional future
      btnHourglass: $("#btnHourglass"), // ⌛️
      btnGodEye: $("#btnGodEye"),       // 👁

      tabFlow: $("#tabFlow"),
      tabSeats: $("#tabSeats"),
      tabGod: $("#tabGod"),
      panelFlow: $("#panelFlow"),
      panelSeats: $("#panelSeats"),
      panelGod: $("#panelGod"),

      promptTitle: $("#promptTitle"),
      promptText: $("#promptText"),
      promptFoot: $("#promptFoot"),
      btnVoteDrawer: $("#btnVoteDrawer"),

      boardPickerCard: $("#boardPickerCard"),
      boardPickerHint: $("#boardPickerHint"),
      boardPicker: $("#boardPicker"),

      seatsGrid: $("#seatsGrid"),

      toggleGodView: $("#toggleGodView"),
      godText: $("#godText"),

      btnBack: $("#btnBack"),
      btnPrimary: $("#btnPrimary"),
      btnCancel: $("#btnCancel"),

      drawerBackdrop: $("#drawerBackdrop"),
      drawer: $("#drawer"),
      btnCloseDrawer: $("#btnCloseDrawer"),
      segEdge: $("#segEdge"),
      segCity: $("#segCity"),
      togglePolice: $("#togglePolice"),
      btnReset: $("#btnReset"),

      voteDrawerBackdrop: $("#voteDrawerBackdrop"),
      voteDrawer: $("#voteDrawer"),
      btnCloseVoteDrawer: $("#btnCloseVoteDrawer"),
      voteAnnounceText: $("#voteAnnounceText"),

      roleModal: $("#roleModal"),
      roleModalTitle: $("#roleModalTitle"),
      roleModalRole: $("#roleModalRole"),
      roleModalCamp: $("#roleModalCamp"),
      btnRoleDone: $("#btnRoleDone"),
      btnRoleClose: $("#btnRoleClose"),

      diceModal: $("#diceModal"),
      diceResult: $("#diceResult"),
      btnDiceAgain: $("#btnDiceAgain"),
      btnDiceClose: $("#btnDiceClose"),

      timerBig: $("#timerBig"),
      timerPresets: $("#timerPresets"),
      btnTimerStart: $("#btnTimerStart"),
      btnTimerPause: $("#btnTimerPause"),
      btnTimerReset: $("#btnTimerReset"),
    };

    /* ---------- Minimal iOS double-tap guard (safe) ---------- */
    // 不要在整個 document 亂 preventDefault，避免 iOS 觸控事件被吃掉
    let lastTap = 0;
    on(document, "touchend", (e) => {
      const t = NOW();
      if (t - lastTap < 250) {
        // 只在「非輸入」且「非可滾動」區塊避免雙擊放大
        const tag = (e.target && e.target.tagName || "").toLowerCase();
        if (!["input","textarea","select"].includes(tag)) e.preventDefault();
      }
      lastTap = t;
    }, { passive: false });

    /* ---------- Data: boards fallback ---------- */
    const BOARD_FALLBACK = {
      "official-9": {
        id: "official-9",
        name: "9 人官方標準局",
        tags: ["官方", "穩"],
        players: 9,
        roles: ["狼人","狼人","狼人","預言家","女巫","獵人","村民","村民","村民"]
      },
      "official-10": {
        id: "official-10",
        name: "10 人官方標準局",
        tags: ["官方", "穩"],
        players: 10,
        roles: ["狼人","狼人","狼人","預言家","女巫","獵人","守衛","村民","村民","村民"]
      },
      "official-12": {
        id: "official-12",
        name: "12 人官方標準局",
        tags: ["官方", "穩", "含白癡"],
        players: 12,
        roles: ["狼人","狼人","狼人","狼人","預言家","女巫","獵人","守衛","白癡","村民","村民","村民"]
      }
    };

    const ROLE_META = {
      "狼人": { camp: "wolf", campZh: "狼人陣營", type: "wolf" },
      "預言家": { camp: "good", campZh: "好人陣營", type: "god" },
      "女巫": { camp: "good", campZh: "好人陣營", type: "god" },
      "獵人": { camp: "good", campZh: "好人陣營", type: "god" },
      "守衛": { camp: "good", campZh: "好人陣營", type: "god" },
      "白癡": { camp: "good", campZh: "好人陣營", type: "god" },
      "村民": { camp: "good", campZh: "好人陣營", type: "villager" }
    };

    /* ---------- State ---------- */
    const defaultState = () => ({
      version: 2,
      stage: "SETUP_A1",
      round: 1,
      day: 0,
      players: 12,
      boardId: "official-12",
      boardName: "—",
      boardTags: [],
      roles: [],
      seats: [],
      hasPolice: true,
      winMode: "edge",

      revealDoneCount: 0,

      knifeTarget: 0,
      guardTarget: 0,
      witchSaveUsed: false,
      witchPoisonUsed: false,
      witchChoice: null,
      seerResult: null,

      voting: { open: false, currentVoter: 0, votes: {} },

      lastDeaths: [],

      timer: { presetSec: 90, secLeft: 90, running: false, lastTick: 0 }
    });

    function initNewGame(state) {
      const n = state.players || 12;
      state.seats = Array.from({ length: n }, (_, i) => ({
        no: i + 1,
        alive: true,
        role: "",
        camp: "",
        campZh: "",
        type: "",
        revealed: false,
        revealDone: false,
        marks: { night:false, day:false, vote:false }
      }));
      state.revealDoneCount = 0;
      state.knifeTarget = 0;
      state.guardTarget = 0;
      state.witchChoice = null;
      state.seerResult = null;
      state.voting = { open:false, currentVoter:0, votes:{} };
      state.lastDeaths = [];
      state.timer = state.timer || { presetSec: 90, secLeft: 90, running: false, lastTick: 0 };
      return state;
    }

    function loadState() {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return initNewGame(defaultState());
        const parsed = JSON.parse(raw);
        const merged = Object.assign(defaultState(), parsed);
        if (!Array.isArray(merged.seats) || merged.seats.length !== merged.players) {
          return initNewGame(merged);
        }
        return merged;
      } catch {
        return initNewGame(defaultState());
      }
    }
    function saveState() {
      localStorage.setItem(LS_KEY, JSON.stringify(S));
    }

    let S = loadState();

    /* ---------- Drawer / modal helpers ---------- */
    function openDrawer(drawerEl, backdropEl) {
      if (!drawerEl || !backdropEl) return;
      backdropEl.classList.remove("hidden");
      drawerEl.classList.remove("hidden");
      drawerEl.setAttribute("aria-hidden","false");
    }
    function closeDrawer(drawerEl, backdropEl) {
      if (!drawerEl || !backdropEl) return;
      backdropEl.classList.add("hidden");
      drawerEl.classList.add("hidden");
      drawerEl.setAttribute("aria-hidden","true");
    }
    function openModal(modalEl) {
      if (!modalEl) return;
      modalEl.classList.remove("hidden");
      modalEl.setAttribute("aria-hidden","false");
    }
    function closeModal(modalEl) {
      if (!modalEl) return;
      modalEl.classList.add("hidden");
      modalEl.setAttribute("aria-hidden","true");
    }

    /* ---------- Tabs ---------- */
    function setTab(name) {
      const map = {
        flow: [el.tabFlow, el.panelFlow],
        seats: [el.tabSeats, el.panelSeats],
        god: [el.tabGod, el.panelGod],
      };
      Object.entries(map).forEach(([k,[btn,panel]]) => {
        if (btn) btn.classList.toggle("active", k === name);
        if (panel) panel.classList.toggle("active", k === name);
      });
    }

    /* ---------- Timer ---------- */
    let timerRAF = null;
    function fmtTime(sec) {
      sec = Math.max(0, sec|0);
      const m = Math.floor(sec/60), s = sec%60;
      return String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
    }
    function timerSyncUI() {
      if (el.timerBig) el.timerBig.textContent = fmtTime(S.timer.secLeft);
    }
    function timerTick() {
      if (!S.timer.running) return;
      const now = NOW();
      if (!S.timer.lastTick) S.timer.lastTick = now;
      const dt = Math.floor((now - S.timer.lastTick)/1000);
      if (dt > 0) {
        S.timer.secLeft = Math.max(0, S.timer.secLeft - dt);
        S.timer.lastTick += dt*1000;
        timerSyncUI();
        saveState();
        if (S.timer.secLeft === 0) {
          S.timer.running = false;
          S.timer.lastTick = 0;
          saveState();
          try { navigator.vibrate && navigator.vibrate([120,60,120]); } catch {}
        }
      }
      timerRAF = requestAnimationFrame(timerTick);
    }
    function timerStart() {
      if (S.timer.secLeft <= 0) S.timer.secLeft = S.timer.presetSec;
      S.timer.running = true;
      S.timer.lastTick = NOW();
      saveState(); timerSyncUI();
      if (!timerRAF) timerRAF = requestAnimationFrame(timerTick);
    }
    function timerPause() {
      S.timer.running = false;
      S.timer.lastTick = 0;
      saveState(); timerSyncUI();
    }
    function timerReset() {
      S.timer.running = false;
      S.timer.lastTick = 0;
      S.timer.secLeft = S.timer.presetSec;
      saveState(); timerSyncUI();
    }
    function timerSetPreset(sec) {
      sec = Number(sec)||90;
      S.timer.presetSec = sec;
      S.timer.secLeft = sec;
      S.timer.running = false;
      S.timer.lastTick = 0;
      saveState(); timerSyncUI();
    }

    /* ---------- Board load ---------- */
    async function loadBoardsForPlayers(n) {
      const list = [];
      const url = `./boards/official-${n}.json`;
      try {
        const r = await fetch(url, { cache:"no-store" });
        if (r.ok) {
          const b = await r.json();
          if (b && b.id) {
            list.push({
              id: b.id, name: b.name || b.id, tags: b.tags || [],
              players: b.players || n, roles: b.roles || []
            });
          }
        }
      } catch {}
      const key = `official-${n}`;
      if (!list.length && BOARD_FALLBACK[key]) list.push(BOARD_FALLBACK[key]);
      // include any extra fallback variants (safe)
      Object.values(BOARD_FALLBACK).forEach(b => {
        if (b.players === n && !list.find(x=>x.id===b.id)) list.push(b);
      });
      return list;
    }

    async function refreshBoardPicker() {
      const boards = await loadBoardsForPlayers(S.players);
      renderBoardPicker(boards);
    }

    function renderBoardPicker(boards) {
      if (!el.boardPicker) return;
      el.boardPicker.innerHTML = "";
      boards.forEach((b) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "boardBtn";
        if (S.boardId === b.id) btn.classList.add("active");

        btn.innerHTML = `
          <div class="name">${escapeHtml(b.name || b.id)}</div>
          <div class="sub">${escapeHtml(b.id)}</div>
          <div class="tags">${(b.tags||[]).map(t=>`<span class="badge">${escapeHtml(t)}</span>`).join("")}</div>
        `;

        on(btn, "click", () => {
          S.boardId = b.id;
          S.boardName = b.name || b.id;
          S.boardTags = b.tags || [];
          S.roles = Array.isArray(b.roles) ? b.roles.slice() : [];
          $$(".boardBtn").forEach(x=>x.classList.remove("active"));
          btn.classList.add("active");
          saveState();
          syncTop();
          syncGodText();
          setPrompt("SETUP_A2");
        });

        el.boardPicker.appendChild(btn);
      });
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({
        "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
      }[c]));
    }

    /* ---------- Seats ---------- */
    function seatByNo(no) { return S.seats.find(s=>s.no===no); }
    function aliveSeats() { return S.seats.filter(s=>s.alive); }

    function clearMarks() {
      S.seats.forEach(s=>s.marks={night:false,day:false,vote:false});
    }
    function markSelectableAlive(kind, onOff) {
      S.seats.forEach(s => {
        s.marks[kind] = (!!onOff && s.alive);
      });
    }

    function renderSeats() {
      if (!el.seatsGrid) return;
      el.seatsGrid.innerHTML = "";
      S.seats.forEach((s) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "seatBtn";
        b.dataset.no = String(s.no);

        if (!s.alive) b.classList.add("dead");
        // ✅ 點選更明顯：投票選人 / 流程選人都會套 selected
        if (S.voting.currentVoter === s.no) b.classList.add("selected");

        if (s.marks.night) b.classList.add("mark-night");
        if (s.marks.day) b.classList.add("mark-day");
        if (s.marks.vote) b.classList.add("mark-vote");

        b.innerHTML = `<div class="no">${s.no}號</div><div class="st">${s.alive?"存活":"死亡"}</div>`;

        on(b, "click", () => onSeatTap(s.no));
        attachLongPress(b, s.no);

        el.seatsGrid.appendChild(b);
      });
    }

    function attachLongPress(btn, seatNo) {
      let t=null, moved=false;
      const start = () => {
        if (S.stage !== "SETUP_A3") return;
        moved=false;
        t=setTimeout(()=>{ if(!moved) revealSeatRole(seatNo); }, 300);
      };
      const cancel = () => { if(t) clearTimeout(t); t=null; };
      on(btn,"touchstart",start,{passive:true});
      on(btn,"touchmove",()=>{moved=true;cancel();},{passive:true});
      on(btn,"touchend",cancel,{passive:true});
      on(btn,"touchcancel",cancel,{passive:true});
      on(btn,"mousedown",start);
      on(btn,"mousemove",()=>{moved=true;cancel();});
      on(btn,"mouseup",cancel);
      on(btn,"mouseleave",cancel);
    }

    function revealSeatRole(seatNo) {
      const s = seatByNo(seatNo);
      if (!s || !s.role) return;

      if (!el.roleModal || !el.roleModalTitle) {
        alert(`${seatNo}號：${s.role}（${s.campZh}）`);
        return;
      }
      el.roleModalTitle.textContent = `${seatNo}號 身分`;
      if (el.roleModalRole) el.roleModalRole.textContent = `角色：${s.role}`;
      if (el.roleModalCamp) el.roleModalCamp.textContent = `陣營：${s.campZh}`;
      openModal(el.roleModal);
      saveState();
    }

    function markRevealDone(seatNo) {
      const s = seatByNo(seatNo);
      if (!s) return;
      if (!s.revealDone) {
        s.revealDone = true;
        S.revealDoneCount = S.seats.filter(x=>x.revealDone).length;
      }
      saveState();
      syncGodText();
    }

    /* ---------- Roles ---------- */
    function shuffle(arr) {
      for (let i=arr.length-1;i>0;i--){
        const j=Math.floor(Math.random()*(i+1));
        [arr[i],arr[j]]=[arr[j],arr[i]];
      }
      return arr;
    }
    function assignRolesFromBoard() {
      const n = S.players;
      let roles = (S.roles && S.roles.length===n) ? S.roles.slice() : null;
      if (!roles) {
        const fb = BOARD_FALLBACK[S.boardId] || BOARD_FALLBACK[`official-${n}`];
        roles = (fb && fb.roles && fb.roles.length===n) ? fb.roles.slice() : [];
      }
      if (roles.length!==n) roles = Array.from({length:n},(_,i)=> i<Math.floor(n/3)?"狼人":"村民");

      shuffle(roles);

      S.seats.forEach((s, idx) => {
        const r = roles[idx];
        const meta = ROLE_META[r] || { camp:"good", campZh:"好人陣營", type:"villager" };
        s.role = r;
        s.camp = meta.camp;
        s.campZh = meta.campZh;
        s.type = meta.type;
        s.revealDone = false;
        s.alive = true;
        s.marks = {night:false,day:false,vote:false};
      });

      S.revealDoneCount = 0;
      S.witchSaveUsed = false;
      S.witchPoisonUsed = false;

      saveState();
      renderSeats();
      syncGodText();
    }

    /* ---------- Dice ---------- */
    function rollDicePickSpeaker() {
      const alive = aliveSeats().map(s=>s.no);
      if (!alive.length) return "—";
      const pick = alive[Math.floor(Math.random()*alive.length)];
      return `${pick}號`;
    }

    /* ---------- Win check ---------- */
    function countAlive() {
      const wolves = S.seats.filter(s=>s.alive && s.camp==="wolf").length;
      const gods = S.seats.filter(s=>s.alive && s.type==="god").length;
      const villagers = S.seats.filter(s=>s.alive && s.type==="villager").length;
      const good = gods+villagers;
      return {wolves, gods, villagers, good};
    }
    function checkWin() {
      const {wolves, good, gods, villagers} = countAlive();
      if (wolves===0) return {end:true, winner:"好人勝利（狼人全滅）"};
      if (S.winMode==="city") {
        if (wolves>=good) return {end:true, winner:"狼人勝利（狼數 ≥ 好人數）"};
        return {end:false};
      } else {
        if (gods===0) return {end:true, winner:"狼人勝利（神全滅・屠邊）"};
        if (villagers===0) return {end:true, winner:"狼人勝利（民全滅・屠邊）"};
        return {end:false};
      }
    }

    /* ---------- Top label ---------- */
    function stageLabel() {
      const r = S.round || 1;
      if ((S.stage||"").startsWith("SETUP")) return `SETUP / R${r} / ${S.stage.replace("_",":")}`;
      if ((S.stage||"").startsWith("NIGHT")) return `NIGHT / R${r} / ${S.stage}`;
      if ((S.stage||"").startsWith("DAY")) return `DAY / R${r} / ${S.stage}`;
      return `R${r} / ${S.stage}`;
    }
    function syncTop() {
      if (el.uiStatus) el.uiStatus.textContent = stageLabel();
      if (el.uiBoard) el.uiBoard.textContent = (S.boardName && S.boardName!=="—") ? S.boardName : `${S.players} 人（未選板子）`;
    }

    /* ---------- Prompts ---------- */
    function findAliveRole(roleName) {
      return S.seats.find(s=>s.alive && s.role===roleName);
    }
    function flashFoot(msg) {
      if (!el.promptFoot) return;
      const old = el.promptFoot.textContent;
      el.promptFoot.textContent = msg;
      setTimeout(()=>{ el.promptFoot.textContent = old; }, 900);
    }

    function ensurePlayerCountChips() {
      if (!el.boardPickerHint) return;
      el.boardPickerHint.innerHTML = "";
      const wrap = document.createElement("div");
      wrap.style.display="flex";
      wrap.style.gap="10px";
      wrap.style.flexWrap="wrap";
      wrap.style.marginTop="8px";

      [9,10,12].forEach(n=>{
        const c=document.createElement("button");
        c.type="button";
        c.className="chip";
        c.textContent=`${n}人`;
        if (S.players===n) c.classList.add("primary");
        on(c,"click",()=>{
          S.players=n;
          S.boardId=`official-${n}`;
          S.boardName="—";
          S.roles=[];
          S = initNewGame(S);
          saveState();
          syncTop(); syncGodText(); renderSeats();
          setPrompt("SETUP_A1");
        });
        wrap.appendChild(c);
      });

      const tips=document.createElement("div");
      tips.className="hint";
      tips.style.marginTop="8px";
      tips.textContent="點一下切換人數，然後在下方選板子套用。";

      el.boardPickerHint.appendChild(wrap);
      el.boardPickerHint.appendChild(tips);
    }

    function setPrompt(stage) {
      S.stage = stage;

      if (el.boardPickerCard) {
        el.boardPickerCard.classList.toggle("hidden", !(stage==="SETUP_A1" || stage==="SETUP_A2"));
      }
      if (el.btnVoteDrawer) {
        const show = stage==="DAY_VOTE" || stage==="DAY_EXILE_DONE";
        el.btnVoteDrawer.classList.toggle("hidden", !show);
      }

      let title="—", text="—", foot="";

      if (stage==="SETUP_A1") {
        title="開始設定";
        text=
`請選擇人數（9 / 10 / 12），再到下方「可選板子」點一下套用。

提示：
• 勝負可在設定切換：屠邊 / 屠城
• 上警可在設定開關`;
        foot=`目前人數：${S.players} 人`;
        ensurePlayerCountChips();
        refreshBoardPicker();
        clearMarks();
      }

      if (stage==="SETUP_A2") {
        title="可選板子";
        text=
`請在下方用「格子板子按鈕」選一個套用。
套用後按「下一步」進入抽身分。`;
        foot=`已選板子：${S.boardId || "—"}`;
        ensurePlayerCountChips();
        refreshBoardPicker();
        clearMarks();
      }

      if (stage==="SETUP_A3") {
        title="抽身分（長按 0.3 秒翻牌）";
        text=
`請玩家依序長按自己的座位（0.3 秒）查看身分。
看完按「我看完了」交回上帝。

全部看完後才能進入夜晚。`;
        foot=`已看完：${S.revealDoneCount}/${S.players}`;
        clearMarks();
      }

      if (stage==="NIGHT_START") {
        title=`夜晚 ${S.round}`;
        text=
`夜晚開始：
1) 狼人刀人（點座位）
2) 守衛守人（點座位）
3) 女巫（同晚解藥/毒藥只能擇一）
4) 預言家查驗（點座位顯示結果）`;
        foot="按「下一步」開始狼人行動。";
        clearMarks();
      }

      if (stage==="NIGHT_WOLVES") {
        title="狼人請睜眼・選刀口";
        text="請點選座位作為刀口。";
        foot= S.knifeTarget ? `目前刀口：${S.knifeTarget}號` : "尚未選擇刀口";
        markSelectableAlive("night", true);
      }

      if (stage==="NIGHT_GUARD") {
        const guard = findAliveRole("守衛");
        title="守衛請睜眼・選守護";
        if (!guard) {
          text="（本局無守衛或守衛已死亡）\n按「下一步」進入女巫。";
          foot="";
          clearMarks();
        } else {
          text="請點選要守護的座位。";
          foot= S.guardTarget ? `目前守護：${S.guardTarget}號` : "尚未選擇守護";
          markSelectableAlive("night", true);
        }
      }

      if (stage==="NIGHT_WITCH") {
        const witch = findAliveRole("女巫");
        title="女巫請睜眼";
        if (!witch) {
          text="（女巫已死亡或本局無女巫）\n按「下一步」進入預言家。";
          foot="";
          clearMarks();
        } else {
          const knife = S.knifeTarget ? `${S.knifeTarget}號` : "（無）";
          text=
`今晚刀口：${knife}

操作方式：
• 點「刀口」= 救（解藥未用時）
• 點「其他人」= 毒（毒藥未用時）
• 再點一次可取消

規則：
• 同一晚解藥/毒藥只能擇一`;
          foot=`解藥：${S.witchSaveUsed?"已用":"可用"} / 毒藥：${S.witchPoisonUsed?"已用":"可用"}`
            + (S.witchChoice ? `\n女巫已選：${S.witchChoice.type==="save"?"救":"毒"} ${S.witchChoice.target}號` : "");
          markSelectableAlive("night", true);
        }
      }

      if (stage==="NIGHT_SEER") {
        const seer = findAliveRole("預言家");
        title="預言家請睜眼・查驗";
        if (!seer) {
          text="（預言家已死亡或本局無預言家）\n按「下一步」結算夜晚。";
          foot="";
          clearMarks();
        } else {
          text="請點選要查驗的座位。\n查驗結果會顯示在下方提示（供上帝口頭宣告）。";
          foot= S.seerResult ? `查驗：${S.seerResult.target}號 → ${S.seerResult.campZh}` : "尚未查驗";
          markSelectableAlive("night", true);
        }
      }

      if (stage==="NIGHT_RESOLVE") {
        title="結算夜晚";
        const deaths = resolveNight();
        text = deaths.length ? `今晚死亡：${deaths.join("、")}號` : "平安夜（無人死亡）";
        foot="按「下一步」進入白天。";
        clearMarks();
      }

      if (stage==="DAY_START") {
        title=`白天 ${S.round}`;
        text = (S.lastDeaths && S.lastDeaths.length)
          ? `天亮了。\n昨夜死亡：${S.lastDeaths.join("、")}號`
          : "天亮了。\n昨夜平安（無人死亡）";
        foot="按「下一步」進入投票。";
        clearMarks();
      }

      if (stage==="DAY_VOTE") {
        title="投票（清楚誰投給誰）";
        text=
`操作方式：
1) 先點「投票人」
2) 再點「投票目標」
3) 棄票：先選投票人，再點一次投票人 = 棄票

可按「投票公告」查看統計。`;
        foot= S.voting.currentVoter ? `目前投票人：${S.voting.currentVoter}號` : "請先選擇投票人";
        clearMarks();
        markSelectableAlive("vote", true);
        S.voting.open = true;
      }

      if (stage==="DAY_EXILE_DONE") {
        title="投票結果";
        const summary = buildVoteAnnounce(true);
        text = summary.mainText;
        foot = summary.foot || "按「下一步」進入下一晚（或顯示結局）";
        clearMarks();
        S.voting.open = false;
      }

      if (stage==="GAME_END") {
        title="遊戲結束";
        text = "（請到設定重置本局）";
        foot="";
        clearMarks();
      }

      if (el.promptTitle) el.promptTitle.textContent = title;
      if (el.promptText) el.promptText.textContent = text;
      if (el.promptFoot) el.promptFoot.textContent = foot;

      syncTop();
      syncGodText();
      renderSeats();
      saveState();
    }

    /* ---------- Seat tap logic ---------- */
    function onSeatTap(no) {
      const s = seatByNo(no);
      if (!s) return;

      if (S.stage==="SETUP_A3") {
        if (s.role) revealSeatRole(no);
        return;
      }

      if (S.stage==="NIGHT_WOLVES") {
        if (!s.alive) return;
        S.knifeTarget = no;
        setPrompt("NIGHT_WOLVES");
        return;
      }

      if (S.stage==="NIGHT_GUARD") {
        if (!findAliveRole("守衛")) return;
        if (!s.alive) return;
        S.guardTarget = no;
        setPrompt("NIGHT_GUARD");
        return;
      }

      if (S.stage==="NIGHT_WITCH") {
        if (!findAliveRole("女巫")) return;
        if (!s.alive) return;

        if (S.witchChoice && S.witchChoice.target === no) {
          S.witchChoice = null;
          setPrompt("NIGHT_WITCH");
          return;
        }

        const isKnife = S.knifeTarget && no===S.knifeTarget;
        if (isKnife) {
          if (S.witchSaveUsed) return flashFoot("解藥已用");
          S.witchChoice = { type:"save", target:no };
          setPrompt("NIGHT_WITCH");
          return;
        } else {
          if (S.witchPoisonUsed) return flashFoot("毒藥已用");
          S.witchChoice = { type:"poison", target:no };
          setPrompt("NIGHT_WITCH");
          return;
        }
      }

      if (S.stage==="NIGHT_SEER") {
        if (!findAliveRole("預言家")) return;
        if (!s.alive) return;
        S.seerResult = { target:no, campZh: (s.camp==="wolf"?"狼人":"好人") };
        setPrompt("NIGHT_SEER");
        return;
      }

      if (S.stage==="DAY_VOTE") {
        if (!s.alive) return;
        handleVoteTap(no);
        return;
      }
    }

    /* ---------- Vote announce ---------- */
    function handleVoteTap(no) {
      if (!S.voting.currentVoter) {
        S.voting.currentVoter = no;
        renderSeats();
        setPrompt("DAY_VOTE");
        return;
      }

      const voter = S.voting.currentVoter;

      // tap voter again => abstain
      if (voter === no) {
        S.voting.votes[String(voter)] = 0;
        S.voting.currentVoter = 0;
        saveState();
        renderSeats();
        setPrompt("DAY_VOTE");
        return;
      }

      S.voting.votes[String(voter)] = no;
      S.voting.currentVoter = 0;

      saveState();
      renderSeats();
      setPrompt("DAY_VOTE");
    }

    function buildVoteAnnounce(finalize=false) {
      const votes = S.voting.votes || {};
      const n = S.players;

      const groups = new Map(); // target -> voters[]
      const abstain = [];

      S.seats.forEach(s=>{
        if (!s.alive) return;
        const v = votes[String(s.no)];
        if (v === 0) abstain.push(s.no);
        else if (typeof v === "number" && v>=1 && v<=n) {
          if (!groups.has(v)) groups.set(v, []);
          groups.get(v).push(s.no);
        }
      });

      const targets = Array.from(groups.keys()).sort((a,b)=>a-b);
      const lines = [];

      targets.forEach(t=>{
        const voters = groups.get(t).slice().sort((a,b)=>a-b);
        lines.push(`投給${t}號的有 ${voters.join("、")}（${voters.length}票）`);
      });

      abstain.sort((a,b)=>a-b);
      if (abstain.length) lines.push(`棄票的有 ${abstain.join("、")}`);

      let max=0, winners=[];
      targets.forEach(t=>{
        const c = groups.get(t).length;
        if (c>max){ max=c; winners=[t]; }
        else if (c===max && c>0) winners.push(t);
      });

      let foot="", exile=0, tie=false;
      if (max===0) foot="目前無有效票（全棄票或尚未投票）";
      else if (winners.length===1) {
        exile=winners[0];
        foot=`${exile}號得到最高票（${max}票）遭到放逐`;
      } else {
        tie=true;
        foot=`平票：${winners.join("、")}號（各 ${max} 票）→ 請處理平票規則（再投/警長歸票等）`;
      }

      if (finalize && exile && !tie) {
        killSeat(exile, "exile");
      }

      return {
        mainText: lines.length ? lines.join("\n") : "（尚未投票）",
        foot, exile, max, tie
      };
    }

    function killSeat(no, reason) {
      const s = seatByNo(no);
      if (!s || !s.alive) return;
      s.alive = false;

      // 獵人放逐是否開槍
      if (reason==="exile" && s.role==="獵人") {
        const shoot = confirm("獵人被放逐，要開槍嗎？（OK=開槍 / 取消=不開）");
        if (shoot) {
          const t = Number(prompt(`請輸入要開槍的號碼（1~${S.players}）`, ""));
          if (t>=1 && t<=S.players && seatByNo(t)?.alive) seatByNo(t).alive=false;
        }
      }

      saveState();
      renderSeats();
      syncGodText();
    }

    /* ---------- Night resolve ---------- */
    function resolveNight() {
      const deaths = new Set();
      let knife = S.knifeTarget || 0;
      const guard = S.guardTarget || 0;
      if (knife && guard && knife===guard) knife = 0;

      if (S.witchChoice) {
        if (S.witchChoice.type==="save") {
          if (knife===S.witchChoice.target) knife=0;
          S.witchSaveUsed = true;
        } else if (S.witchChoice.type==="poison") {
          deaths.add(S.witchChoice.target);
          S.witchPoisonUsed = true;
        }
      }

      if (knife) deaths.add(knife);

      const list = Array.from(deaths).filter(no => seatByNo(no)?.alive);
      list.forEach(no => seatByNo(no).alive=false);
      S.lastDeaths = list;

      // reset night picks
      S.knifeTarget=0;
      S.guardTarget=0;
      S.witchChoice=null;
      S.seerResult=null;

      saveState();
      renderSeats();
      syncGodText();

      const w = checkWin();
      if (w.end) {
        S.stage="GAME_END";
        if (el.promptTitle) el.promptTitle.textContent="遊戲結束";
        if (el.promptText) el.promptText.textContent=w.winner;
        if (el.promptFoot) el.promptFoot.textContent="可到設定重置本局";
        saveState();
      }

      return list;
    }

    /* ---------- God info ---------- */
    function syncGodText() {
      if (!el.godText) return;
      const {wolves, good, gods, villagers} = countAlive();
      const unseen = S.seats.filter(s=>s.role && !s.revealDone).map(s=>s.no);

      el.godText.textContent =
`人數：${S.players}
板子：${S.boardId || "—"}
勝負：${S.winMode==="edge"?"屠邊（可切換）":"屠城（可切換）"}
上警：${S.hasPolice ? "開" : "關"}
抽身分：${S.seats.some(s=>s.role) ? "已分配" : "尚未分配"}
未查看：${unseen.length ? unseen.join("、") : "（無）"}

女巫：解藥${S.witchSaveUsed?"已用":"可用"} / 毒藥${S.witchPoisonUsed?"已用":"可用"}
存活：狼 ${wolves} / 好 ${good}（神 ${gods} + 民 ${villagers}）`;
    }

    /* ---------- Settings UI ---------- */
    function syncSettingsUI() {
      if (el.segEdge) el.segEdge.classList.toggle("active", S.winMode==="edge");
      if (el.segCity) el.segCity.classList.toggle("active", S.winMode==="city");
      if (el.togglePolice) el.togglePolice.checked = !!S.hasPolice;
    }

    /* ---------- Vote drawer ---------- */
    function openVoteDrawer() {
      const res = buildVoteAnnounce(false);
      if (el.voteAnnounceText) {
        el.voteAnnounceText.textContent = res.mainText + (res.foot ? `\n\n${res.foot}` : "");
      }
      openDrawer(el.voteDrawer, el.voteDrawerBackdrop);
    }

    /* ---------- Navigation ---------- */
    function goNext() {
      const st = S.stage;

      if (st==="SETUP_A1") { setPrompt("SETUP_A2"); return; }
      if (st==="SETUP_A2") { assignRolesFromBoard(); setPrompt("SETUP_A3"); return; }
      if (st==="SETUP_A3") {
        const allDone = S.seats.every(s=>s.revealDone);
        if (!allDone) return flashFoot("還有人沒看完身分");
        setPrompt("NIGHT_START"); return;
      }

      if (st==="NIGHT_START") { setPrompt("NIGHT_WOLVES"); return; }
      if (st==="NIGHT_WOLVES") { setPrompt("NIGHT_GUARD"); return; }
      if (st==="NIGHT_GUARD") { setPrompt("NIGHT_WITCH"); return; }
      if (st==="NIGHT_WITCH") { setPrompt("NIGHT_SEER"); return; }
      if (st==="NIGHT_SEER") { setPrompt("NIGHT_RESOLVE"); return; }
      if (st==="NIGHT_RESOLVE") { setPrompt("DAY_START"); return; }

      if (st==="DAY_START") {
        S.voting = { open:true, currentVoter:0, votes:{} };
        saveState();
        setPrompt("DAY_VOTE");
        return;
      }

      if (st==="DAY_VOTE") {
        const res = buildVoteAnnounce(true);
        // tie / no votes just show summary
        if (res.tie || res.max===0) { setPrompt("DAY_EXILE_DONE"); return; }

        const w = checkWin();
        if (w.end) {
          S.stage="GAME_END";
          if (el.promptTitle) el.promptTitle.textContent="遊戲結束";
          if (el.promptText) el.promptText.textContent=w.winner;
          if (el.promptFoot) el.promptFoot.textContent="可到設定重置本局";
          saveState();
          return;
        }

        setPrompt("DAY_EXILE_DONE");
        return;
      }

      if (st==="DAY_EXILE_DONE") {
        S.round += 1;
        saveState();
        setPrompt("NIGHT_START");
        return;
      }

      if (st==="GAME_END") return flashFoot("已結束，請到設定重置本局");

      setPrompt("SETUP_A1");
    }

    function goBack() {
      const order = [
        "SETUP_A1","SETUP_A2","SETUP_A3",
        "NIGHT_START","NIGHT_WOLVES","NIGHT_GUARD","NIGHT_WITCH","NIGHT_SEER","NIGHT_RESOLVE",
        "DAY_START","DAY_VOTE","DAY_EXILE_DONE"
      ];
      const idx = order.indexOf(S.stage);
      if (idx>0) setPrompt(order[idx-1]);
    }

    function doCancel() {
      if (S.stage==="DAY_VOTE") {
        S.voting.currentVoter = 0;
        saveState();
        renderSeats();
        setPrompt("DAY_VOTE");
        return;
      }
      if (S.stage==="NIGHT_WITCH") {
        S.witchChoice = null;
        saveState();
        setPrompt("NIGHT_WITCH");
        return;
      }
      flashFoot("已取消目前選擇");
    }

    /* ---------- Bind events ---------- */
    function bindEvents() {
      on(el.tabFlow,"click",()=>setTab("flow"));
      on(el.tabSeats,"click",()=>setTab("seats"));
      on(el.tabGod,"click",()=>setTab("god"));

      on(el.btnSettings,"click",()=>{
        syncSettingsUI();
        openDrawer(el.drawer, el.drawerBackdrop);
      });
      on(el.btnCloseDrawer,"click",()=>closeDrawer(el.drawer, el.drawerBackdrop));
      on(el.drawerBackdrop,"click",()=>closeDrawer(el.drawer, el.drawerBackdrop));

      on(el.segEdge,"click",()=>{
        S.winMode="edge"; saveState(); syncSettingsUI(); syncGodText(); syncTop();
      });
      on(el.segCity,"click",()=>{
        S.winMode="city"; saveState(); syncSettingsUI(); syncGodText(); syncTop();
      });
      on(el.togglePolice,"change",(e)=>{
        S.hasPolice = !!e.target.checked;
        saveState(); syncSettingsUI(); syncGodText(); syncTop();
      });

      on(el.btnReset,"click",()=>{
        if (!confirm("確定要重置本局？（會清空進度）")) return;
        S = initNewGame(defaultState());
        saveState();
        closeDrawer(el.drawer, el.drawerBackdrop);
        syncTop(); syncGodText(); renderSeats();
        setPrompt("SETUP_A1");
        setTab("flow");
        timerReset();
      });

      on(el.btnVoteDrawer,"click",openVoteDrawer);
      on(el.btnCloseVoteDrawer,"click",()=>closeDrawer(el.voteDrawer, el.voteDrawerBackdrop));
      on(el.voteDrawerBackdrop,"click",()=>closeDrawer(el.voteDrawer, el.voteDrawerBackdrop));

      on(el.btnRoleClose,"click",()=>closeModal(el.roleModal));
      on(el.btnRoleDone,"click",()=>{
        const m = (el.roleModalTitle?.textContent||"").match(/^(\d+)號/);
        if (m) markRevealDone(Number(m[1]));
        closeModal(el.roleModal);
        setPrompt("SETUP_A3");
      });

      on(el.btnDice,"click",()=>{
        if (el.diceResult) el.diceResult.textContent = rollDicePickSpeaker();
        openModal(el.diceModal);
      });
      on(el.btnDiceAgain,"click",()=>{
        if (el.diceResult) el.diceResult.textContent = rollDicePickSpeaker();
      });
      on(el.btnDiceClose,"click",()=>closeModal(el.diceModal));

      on(el.btnPrimary,"click",goNext);
      on(el.btnBack,"click",goBack);
      on(el.btnCancel,"click",doCancel);

      // timer
      on(el.timerPresets,"click",(e)=>{
        const btn = e.target.closest("button");
        if (!btn) return;
        if (btn.dataset && btn.dataset.sec) timerSetPreset(btn.dataset.sec);
      });
      on(el.btnTimerStart,"click",timerStart);
      on(el.btnTimerPause,"click",timerPause);
      on(el.btnTimerReset,"click",timerReset);

      // optional top ⌛️
      on(el.btnHourglass,"click",()=>{
        const timerDrawer = $("#timerDrawer");
        const timerBackdrop = $("#timerDrawerBackdrop");
        if (timerDrawer && timerBackdrop) openDrawer(timerDrawer, timerBackdrop);
        else (S.timer.running ? timerPause() : timerStart());
      });

      // optional top 👁
      on(el.btnGodEye,"click",()=>{
        setTab("god");
        if (el.toggleGodView) el.toggleGodView.checked = true;
        syncGodText();
      });
    }

    /* ---------- Boot ---------- */
    function boot() {
      // guard: if page is missing key containers, show readable hint
      if (!document.body) throw new Error("document.body not ready");

      bindEvents();
      setTab("flow");

      syncTop();
      syncGodText();
      renderSeats();

      setPrompt(S.stage || "SETUP_A1");

      timerSyncUI();
      if (S.timer.running && !timerRAF) timerRAF = requestAnimationFrame(timerTick);
    }

    // ensure DOM ready even if script moved
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }

  } catch (err) {
    showFatal(err);
  }
})();