/* =========================================================
   狼人殺｜夜晚流程步驟（資料驅動）
   檔案：data/flow/night.steps.js

   目標：
   - 依「本局實際存在的角色」動態生成夜晚流程
   - 先支援：守衛 / 狼人(可空刀) / 預言家 / 女巫（含你指定女巫彈窗邏輯的資料接口）
   - 黑狼王 / 白狼王：本檔先決定「是否在夜晚出現」
     * 黑狼王：死亡技（不在夜晚出現）
     * 白狼王：可自爆（先做成 optional step，後續再串 UI）

   注意：
   - 本檔不處理結算（結算在 rules.core.js）
   - 本檔不處理 UI（UI 在 app.js）
========================================================= */

(function () {
  function hasRole(players, roleId) {
    return players.some(p => p.roleId === roleId);
  }

  function aliveSeats(players) {
    return players.filter(p => p.alive).map(p => p.seat);
  }

  function stepInfo(key, godScript, publicScript) {
    return { key, type: "info", godScript, publicScript };
  }

  function stepPick(key, opts) {
    // opts: { title, pickKey, required, allowSkip, filterFn(seat)->bool, godScript, publicScript }
    return {
      key,
      type: "pick",
      title: opts.title,
      pickKey: opts.pickKey,          // 寫入 night[pickKey]
      required: !!opts.required,
      allowSkip: !!opts.allowSkip,    // 若 allowSkip=true => 可選 null
      filter: opts.filter || "alive",  // "alive" | "aliveNotSelf" | "custom"
      filterFn: opts.filterFn || null,
      godScript: opts.godScript || "",
      publicScript: opts.publicScript || ""
    };
  }

  function stepWitch(key) {
    // 女巫在 UI 端會開彈窗，這裡只提供主持引導
    return {
      key,
      type: "witch",
      title: "女巫行動",
      godScript:
        "女巫請睜眼。今晚被刀的是誰？（上帝看手機）\n請問要不要使用解藥？\n若不救／或已無解藥：請問要不要使用毒藥？",
      publicScript:
        "女巫請睜眼。"
    };
  }

  function stepResolve(key) {
    return {
      key,
      type: "resolve",
      title: "天亮結算",
      godScript: "天亮請睜眼（系統結算並生成公告）。",
      publicScript: "天亮請睜眼。"
    };
  }

  /**
   * buildNightSteps(players, night, settings)
   * 回傳：steps[]
   * - players: 本局玩家（含 seat/roleId/team/alive）
   * - night: 當晚狀態（guardTarget/wolfTarget/...）
   * - settings: 規則開關（從 WW_DATA.defaultRules 或 UI 設定）
   */
  function buildNightSteps(players, night, settings) {
    const rules = (settings && settings.rules) ? settings.rules : (settings || {});
    const steps = [];

    // 0. 開場
    steps.push(stepInfo(
      "closeEyes",
      "天黑請閉眼。",
      "天黑請閉眼。"
    ));

    // 1. 守衛（特殊板會有）
    if (hasRole(players, "guard")) {
      steps.push(stepPick("guard", {
        title: "守衛守護",
        pickKey: "guardTarget",
        required: false,
        allowSkip: false,
        filter: "alive",
        godScript:
          "守衛請睜眼。你要守護誰？（點選座位）\n（提示）規則：不能連守（若連守會自動判定無效）",
        publicScript: "守衛請睜眼。"
      }));
    }

    // 2. 狼人刀人（可空刀）
    steps.push(stepPick("wolf", {
      title: "狼人刀人",
      pickKey: "wolfTarget",
      required: false,
      allowSkip: !!rules.wolfCanSkip,
      filter: "alive",
      godScript:
        rules.wolfCanSkip
          ? "狼人請睜眼。你們要刀誰？（可選擇空刀）"
          : "狼人請睜眼。你們要刀誰？（必選一人）",
      publicScript: "狼人請睜眼。"
    }));

    // 3. 預言家查驗
    if (hasRole(players, "seer")) {
      steps.push(stepPick("seer", {
        title: "預言家查驗",
        pickKey: "seerCheckTarget",
        required: true,
        allowSkip: false,
        filter: "alive",
        godScript:
          "預言家請睜眼。你要查驗誰？（點選座位）\n系統會顯示結果給上帝：好人 / 狼人\n請告訴預言家結果。",
        publicScript: "預言家請睜眼。"
      }));
    }

    // 4. 女巫用藥（彈窗 UI 會吃這步）
    if (hasRole(players, "witch")) {
      steps.push(stepWitch("witch"));
    }

    // 5. 白狼王（自爆）— 先保留 step，第一版 UI 可以先不顯示/不啟用
    // 你之後說「流程順再優化」：所以先把 step 放進來，UI 可先 hidden
    if (hasRole(players, "whiteWolfKing")) {
      steps.push({
        key: "whiteWolfKing",
        type: "optional",
        title: "白狼王（可選）",
        featureFlag: "enableWhiteWolfKingNight", // app 可用開關控制顯示
        godScript:
          "（可選）白狼王是否要自爆？\n若要：選擇帶走一人（之後由規則/流程處理）。",
        publicScript: "（可選）白狼王行動。"
      });
    }

    // 6. 天亮結算
    steps.push(stepResolve("resolve"));

    return steps;
  }

  // 掛到 WW_DATA
  window.WW_NIGHT_STEPS = {
    buildNightSteps
  };

})();
