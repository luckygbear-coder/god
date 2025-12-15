/* =========================================================
   狼人殺｜白天流程引擎
   檔案：engine/day.engine.js

   功能：
   ✅ 上警名單（多選）
   ✅ 發言順序（順/逆/隨機 + 起始位）
   ✅ 逐位投票
   ✅ 平票處理：第二次平票 → 無人放逐（依需求）
   ✅ 匯出投票紀錄（誰投誰）
========================================================= */

(function () {
  const CORE = window.WW_RULES_CORE;

  if (!CORE) {
    console.error("❌ rules.core.js 未載入");
    return;
  }

  function createDayEngine({ players }) {
    const state = {
      phase: "idle", // idle | police | speech | vote | done
      police: {
        candidates: [] // seats
      },
      speech: {
        direction: "cw", // cw | ccw | rand
        startSeat: null,
        order: [],
        index: 0
      },
      vote: {
        mode: "normal", // normal | pk
        restrictTargets: null, // null or [seats]
        voters: [],
        index: 0,
        records: [], // {fromSeat,toSeat|null}
        stats: {},   // seat->count, abstain->count
        tieCount: 0  // 平票次數（你要：第二次平票=無人放逐）
      }
    };

    /* =========================
       helpers
    ========================= */
    const aliveSeats = () => CORE.alive(players).map(p => p.seat);

    function toggleIn(arr, seat) {
      const i = arr.indexOf(seat);
      if (i >= 0) arr.splice(i, 1);
      else arr.push(seat);
      arr.sort((a, b) => a - b);
    }

    /* =========================
       上警
    ========================= */
    function startPolice() {
      state.phase = "police";
      state.police.candidates = [];
      return snapshot();
    }

    function togglePoliceCandidate(seat) {
      if (state.phase !== "police") return { error: "not_in_police_phase" };
      if (!aliveSeats().includes(seat)) return { error: "dead_cannot_police" };
      toggleIn(state.police.candidates, seat);
      return snapshot();
    }

    function endPolice() {
      if (state.phase !== "police") return { error: "not_in_police_phase" };
      state.phase = "speech";
      return snapshot();
    }

    /* =========================
       發言順序
    ========================= */
    function setSpeechDirection(dir) {
      state.speech.direction = dir;
      return snapshot();
    }

    function setSpeechStartSeat(seat) {
      if (!aliveSeats().includes(seat)) return { error: "invalid_start" };
      state.speech.startSeat = seat;
      return snapshot();
    }

    function buildSpeech({ usePoliceList = false } = {}) {
      const pool = usePoliceList && state.police.candidates.length
        ? state.police.candidates.slice()
        : aliveSeats();

      if (!pool.length) return { error: "no_speakers" };

      let order = [];

      if (state.speech.direction === "rand") {
        order = pool.slice();
        for (let i = order.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [order[i], order[j]] = [order[j], order[i]];
        }
      } else {
        const start = state.speech.startSeat ?? pool[0];
        // 依座位號排序並從 start 旋轉
        const sorted = pool.slice().sort((a, b) => a - b);
        const idx = sorted.indexOf(start);
        const rotated = idx >= 0 ? sorted.slice(idx).concat(sorted.slice(0, idx)) : sorted;

        if (state.speech.direction === "cw") order = rotated;
        else order = rotated.slice().reverse();
      }

      state.speech.order = order;
      state.speech.index = 0;

      return snapshot();
    }

    function currentSpeaker() {
      if (!state.speech.order.length) return null;
      if (state.speech.index >= state.speech.order.length) return null;
      return state.speech.order[state.speech.index];
    }

    function nextSpeaker() {
      if (state.phase !== "speech") return { error: "not_in_speech_phase" };
      state.speech.index++;
      return snapshot();
    }

    function endSpeech() {
      state.phase = "vote";
      return snapshot();
    }

    /* =========================
       投票（逐位）
    ========================= */
    function startVote({ mode = "normal", restrictTargets = null } = {}) {
      if (state.phase !== "vote") state.phase = "vote";

      state.vote.mode = mode;
      state.vote.restrictTargets = restrictTargets ? restrictTargets.slice() : null;

      state.vote.voters = aliveSeats();
      state.vote.index = 0;
      state.vote.records = [];
      state.vote.stats = {};
      // tieCount 不清（你要第二次平票才無人放逐）
      return snapshot();
    }

    function currentVoter() {
      return state.vote.voters[state.vote.index] ?? null;
    }

    function validTargets() {
      const alive = aliveSeats();
      const targets = state.vote.restrictTargets
        ? state.vote.restrictTargets.filter(s => alive.includes(s))
        : alive;
      return targets;
    }

    function castVote(toSeatOrNull) {
      const from = currentVoter();
      if (!from) return { error: "vote_done" };

      // 不能投自己（但可棄票）
      if (toSeatOrNull && toSeatOrNull === from) return { error: "cannot_vote_self" };

      // 目標必須在 valid targets
      if (toSeatOrNull) {
        const targets = validTargets();
        if (!targets.includes(toSeatOrNull)) return { error: "invalid_target" };
      }

      state.vote.records.push({ fromSeat: from, toSeat: toSeatOrNull });

      const k = toSeatOrNull ? String(toSeatOrNull) : "abstain";
      state.vote.stats[k] = (state.vote.stats[k] || 0) + 1;

      state.vote.index++;
      return snapshot();
    }

    function computeResult() {
      const stats = state.vote.stats || {};
      const entries = Object.entries(stats)
        .filter(([k]) => k !== "abstain")
        .map(([k, v]) => ({ seat: Number(k), count: v }));

      if (!entries.length) {
        return { tie: false, executed: null, maxVotes: 0, tiedSeats: [] };
      }

      entries.sort((a, b) => b.count - a.count);
      const max = entries[0].count;
      const tied = entries.filter(e => e.count === max).map(e => e.seat);

      if (tied.length > 1) {
        return { tie: true, executed: null, maxVotes: max, tiedSeats: tied };
      }

      return { tie: false, executed: entries[0].seat, maxVotes: max, tiedSeats: [] };
    }

    /**
     * finalizeVote:
     * - 不平票：回傳 executed seat
     * - 平票：
     *   第一次：回傳 { tie:true, options:{ pkCandidates } }
     *   第二次（再次平票）：回傳 { tieFinal:true, executed:null } => 無人放逐
     */
    function finalizeVote() {
      if (state.vote.index < state.vote.voters.length) {
        return { error: "vote_not_finished" };
      }

      const result = computeResult();

      if (!result.tie) {
        // reset tie chain
        state.vote.tieCount = 0;
        return {
          tie: false,
          executed: result.executed,
          maxVotes: result.maxVotes,
          records: state.vote.records.slice(),
          stats: { ...state.vote.stats }
        };
      }

      // tie
      state.vote.tieCount++;

      // 第二次平票 => 無人放逐
      if (state.vote.tieCount >= 2) {
        return {
          tieFinal: true,
          executed: null,
          maxVotes: result.maxVotes,
          tiedSeats: result.tiedSeats,
          records: state.vote.records.slice(),
          stats: { ...state.vote.stats }
        };
      }

      // 第一次平票：建議 PK（限制名單）
      return {
        tie: true,
        maxVotes: result.maxVotes,
        tiedSeats: result.tiedSeats,
        records: state.vote.records.slice(),
        stats: { ...state.vote.stats },
        next: {
          mode: "pk",
          restrictTargets: result.tiedSeats.slice()
        }
      };
    }

    /* =========================
       匯出 & snapshot
    ========================= */
    function exportDay() {
      return {
        police: { ...state.police },
        speech: { ...state.speech },
        vote: {
          mode: state.vote.mode,
          restrictTargets: state.vote.restrictTargets ? state.vote.restrictTargets.slice() : null,
          records: state.vote.records.slice(),
          stats: { ...state.vote.stats },
          tieCount: state.vote.tieCount
        }
      };
    }

    function snapshot() {
      return JSON.parse(JSON.stringify({
        phase: state.phase,
        police: state.police,
        speech: state.speech,
        vote: {
          mode: state.vote.mode,
          restrictTargets: state.vote.restrictTargets,
          voters: state.vote.voters,
          index: state.vote.index,
          records: state.vote.records,
          stats: state.vote.stats,
          tieCount: state.vote.tieCount
        }
      }));
    }

    return {
      // state
      getState: snapshot,
      exportDay,

      // police
      startPolice,
      togglePoliceCandidate,
      endPolice,

      // speech
      setSpeechDirection,
      setSpeechStartSeat,
      buildSpeech,
      currentSpeaker,
      nextSpeaker,
      endSpeech,

      // vote
      startVote,
      currentVoter,
      validTargets,
      castVote,
      finalizeVote
    };
  }

  window.WW_DAY_ENGINE = {
    createDayEngine
  };
})();
