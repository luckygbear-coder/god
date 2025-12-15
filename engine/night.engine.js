/* =========================================================
   狼人殺｜夜晚流程引擎
   檔案：engine/night.engine.js

   職責：
   - 控制夜晚「步驟順序」
   - 處理每一步的選擇（pick / skip）
   - 管理女巫救 / 毒流程
   - 夜晚結束時呼叫 rules 結算
========================================================= */

(function () {
  const CORE = window.WW_RULES_CORE;
  const RULES_BASIC = window.WW_RULES_BASIC;
  const RULES_B1 = window.WW_RULES_B1;

  if (!CORE) {
    console.error("❌ rules.core.js 未載入");
    return;
  }

  /* =========================
     建立夜晚引擎
  ========================= */
  function createNightEngine({ players, boardType, rules, stepsBuilder }) {
    const state = {
      index: 0,
      steps: stepsBuilder(players, rules),
      done: false,

      night: {
        wolfTarget: null,
        guardTarget: null,
        prevGuardTarget: null,
        witchSave: false,
        witchPoisonTarget: null
      },

      meta: {}
    };

    /* =====================
       目前步驟
    ===================== */
    function current() {
      return state.steps[state.index] || null;
    }

    /* =====================
       選擇座位
    ===================== */
    function pick(seat) {
      const step = current();
      if (!step) return;

      if (step.type !== "pick") return;
      if (!seat && !step.allowSkip) return;

      // 守衛不能連守
      if (step.roleId === "guard" && rules?.noConsecutiveGuard) {
        if (seat && seat === state.night.prevGuardTarget) {
          return { error: "守衛不能連續守同一人" };
        }
      }

      state.night[step.key] = seat;
      return { ok: true };
    }

    /* =====================
       女巫操作
    ===================== */
    function witchDecision({ save, poisonTarget }) {
      // 解藥已用過 → 不允許再救
      if (save && rules?.witchCannotSelfSave) {
        const witchSeat = CORE.findSeatByRoleId(players, "witch");
        if (witchSeat && state.night.wolfTarget === witchSeat) {
          // 自救無效，直接忽略
          save = false;
        }
      }

      state.night.witchSave = !!save;

      if (poisonTarget) {
        state.night.witchPoisonTarget = poisonTarget;
      }
    }

    /* =====================
       下一步
    ===================== */
    function next() {
      if (state.done) return null;

      const step = current();
      if (!step) return null;

      // 必選但尚未選
      if (step.type === "pick" && step.required) {
        if (!state.night[step.key] && !step.allowSkip) {
          return { error: "尚未選擇目標" };
        }
      }

      state.index++;

      // 夜晚結束
      if (state.index >= state.steps.length) {
        state.done = true;
        return resolveNight();
      }

      return current();
    }

    /* =====================
       夜晚結算
    ===================== */
    function resolveNight() {
      const payload = {
        players,
        night: state.night,
        rules
      };

      let resolved;
      if (boardType === "b1") {
        resolved = RULES_B1.resolveNight(payload);
      } else {
        resolved = RULES_BASIC.resolveNight(payload);
      }

      return {
        resolved,
        nightData: state.night
      };
    }

    /* =====================
       對外 API
    ===================== */
    return {
      current,
      pick,
      witchDecision,
      next,
      getState: () => state
    };
  }

  /* =========================
     掛到全域
  ========================= */
  window.WW_NIGHT_ENGINE = {
    createNightEngine
  };
})();
