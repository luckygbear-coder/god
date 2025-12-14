# 狼人殺上帝輔助 PWA｜UI ID 對照規格（v1）

## 0. 核心原則（避免「按了沒反應」）
- 所有頁面按鈕都必須存在對應的 id，並由 app.js 綁定。
- 按鈕能不能按，不靠「按了才 alert」，而是依 phase 自動 disable/enable。
- phase 由 `WW_STATE_CORE` 統一管理：setup | deal | night | day | end

---

## 1. 必備 screen 結構（index.html）

### 1.1 Screens（每個 screen 必須有）
- `#screen-setup`
- `#screen-deal`
- `#screen-night`
- `#screen-day`
- `#screen-end`（結局畫面）

> app.js 會用 class `.active` 顯示單一 screen  
> 其他 screen 必須 `display:none` 或 `visibility:hidden`

---

## 2. 全域工具（everywhere）
### 2.1 上帝視角切換（必備）
- `#btnGodToggle`：右上角 🔒/🔓
- `#fabGodToggle`：右下角浮動 🔒/🔓（單手操作）
- `#modalGodPin`：PIN 彈窗（上帝解鎖）
  - `#pinInput`
  - `#pinOk`
  - `#pinCancel`
  - `#pinWarn`（錯誤提示）

行為：
- 未解鎖且點 🔒 => 打開 PIN 彈窗
- PIN 正確 => `god.unlocked=true` 且 `god.view=true`
- 已解鎖點 🔓 => 切換回玩家視角（god.view=false）

---

### 2.2 公告中心（必備）
- `#btnAnnOpen`：右上角 📣
- `#fabAnnOpen`：右下角浮動 📣
- `#modalAnn`
  - `#annTabToday`（今日）
  - `#annTabHistory`（歷史）
  - `#annToggleGodView`（公告內切換玩家/上帝）
  - `#annContent`（文字容器）
  - `#annCopy`（複製）
  - `#annClose`

行為：
- 玩家視角：只顯示 publicText + 投票統計（可選：只顯示結果，不顯示誰投誰）
- 上帝視角：顯示 hiddenText + 票型誰投誰 + 夜晚行動 JSON

---

### 2.3 重新開始（必備）
- `#btnRestart`（頂部列 🔁 或設定內）
- `#modalConfirmRestart`
  - `#restartYes`
  - `#restartNo`

行為：
- 點 🔁 => 顯示確認
- 確認 => 清除 localStorage + 回到 setup（重新選板子與配置）

---

## 3. Setup（開局設定）
必備 id：
- `#boardBasic`
- `#boardSpecialB1`（特殊板子 b1）
- `#playerMinus`
- `#playerPlus`
- `#playerCount`
- `#rangeCount`（6~12）
- `#btnRoleConfig`（開角色調整彈窗）
- `#btnApplyPreset`（依人數套預設）
- `#roleTotal`
- `#warnRoleTotal`
- `#btnStartDeal`（開始 → 抽身分）

角色調整彈窗（必備）：
- `#modalRoleConfig`
  - `#roleConfigBody`
  - `#roleReset`
  - `#roleClose`
  - `#roleApply`

規則開關彈窗（必備）：
- `#btnRuleConfig`
- `#modalRuleConfig`
  - `#rule_noConsecutiveGuard`
  - `#rule_wolfCanSkip`
  - `#rule_witchCannotSelfSave`
  - `#rule_hunterPoisonNoShoot`
  - `#rule_blackWolfKingPoisonNoSkill`
  - `#rule_saveHitsGuardMakesDeath`（固定 true 也要顯示為鎖定）
  - `#ruleKidMode`（小朋友模式）
  - `#ruleApply`
  - `#ruleClose`

---

## 4. Deal（抽身分｜可回頭確認）
必備：
- `#dealPrompt`（例如：請 1 號拿手機 / 請交給下一位）
- 座位列（可點座位回去看身分）
  - `#dealSeatStrip`（容器）
  - seat 按鈕 class：`.seat`（會用 data-seat）
- 長按翻牌按鈕：
  - `#btnHoldReveal`
- 翻牌彈窗（含動畫）：
  - `#modalReveal`
  - `#revealCard`（有 flip 動畫 class）
  - `#revealRoleName`
  - `#revealRoleIcon`
  - `#revealClose`（放開會自動關，這顆可備用）
- 抽牌流程控制：
  - `#btnDealPrevSeat`（上一位）
  - `#btnDealNextSeat`（我已看完 → 下一位）
  - `#btnDealConfirmAll`（全部抽完後「確認」才進夜晚）

互動要求（你指定）：
- 長按不會「選取文字」
- 長按不會「放大瀏覽」
- 可以點座位回到該玩家，再長按翻牌確認身分
- 全部抽完後必須按「確認進夜晚」才會進

---

## 5. Night（夜晚 Wizard）
必備：
- `#nightTag`（第 X 夜）
- `#nightScript`（主持台詞）
- `#nightSeats`（座位圓點容器）
- 底部操作列：
  - `#btnNightPrev`
  - `#btnNightNext`

女巫彈窗（你指定流程必須正確）：
- `#modalWitch`
  - `#witchTitle`
  - `#witchKilledInfo`（顯示今晚刀口；若解藥已用過 => 不顯示刀口，只顯示“解藥已用”）
  - `#btnWitchSaveYes`
  - `#btnWitchSaveNo`
  - `#witchPoisonSection`
    - `#btnWitchPoisonPick`（點了回到座位點選毒誰）
    - `#btnWitchPoisonNone`
    - `#witchPoisonTargetText`
  - `#btnWitchDone`
  - `#witchClose`

女巫流程（你要求）：
- 若解藥未用過：顯示「今晚被刀 X 號」=> 問救不救 => 再問毒不毒
- 若解藥已用過：不顯示刀口，只提供「要不要毒」
- 規則：女巫不能自救（wolfTarget==witchSeat => 救按鈕可顯示提示但無效）
- 狼人可空刀：若 wolfTarget=null，女巫面板顯示「今晚無刀口」

夜晚結束：
- 必定 resolve => 立刻產生公告（logs[0]）並切到 day
- 並自動跳出公告彈窗（今日）

---

## 6. Day（白天）
必備：
- `#dayTag`（第 X 天）
- 三大按鈕：
  - `#btnOpenPolice`（上警）
  - `#btnOpenSpeech`（發言）
  - `#btnOpenVote`（投票）
- 下一步（進夜晚）：
  - `#btnDayNextNight`
  - 行為：切到 night，nightNo+1/dayNo+1，重置 night actions

上警彈窗：
- `#modalPolice`
  - `#policeSeats`
  - `#policeClear`
  - `#policeDone`
  - `#policeClose`

發言彈窗：
- `#modalSpeech`
  - `#speechDirCW` `#speechDirCCW` `#speechDirRand`
  - `#speechSeats`（選起始位）
  - `#speechBuild`
  - `#speechOrderText`
  - `#speechNext`
  - `#speechClose`

投票彈窗（逐位投票）：
- `#modalVote`
  - `#voteTitle`
  - `#votePrompt`（請 X 號投票）
  - `#voteSeats`（可投目標）
  - `#voteAbstain`
  - `#voteStats`
  - `#voteDone`
  - `#voteClose`

平票彈窗（你指定：第二次平票=無放逐）：
- `#modalTie`
  - `#tieInfo`
  - `#tieList`
  - `#tiePK`
  - `#tieRevote`
  - `#tieNone`
  - `#tieClose`

規則：
- 第一次平票：可 PK 或 重投 或 無放逐
- 第二次仍平票：自動無放逐（不再詢問，直接寫公告並進夜晚）

---

## 7. End（結局）
必備：
- `#endTitle`
- `#endReason`
- `#btnEndRestart`（重新開始）

勝負判定（A+B）：
- B：狼全滅 => 好人勝
- A：狼 >= 好人人數（不含 third）=> 狼勝
- third：保留擴充 hook

---

## 8. Style.css 必備 class（不捲動 + 童話風 + 手機操作）
必備：
- `html, body { height: 100%; overflow: hidden; }`
- `.app-shell { height: 100dvh; display:flex; flex-direction:column; }`
- `.main { flex:1; overflow:hidden; }`
- `.screen { height: 100%; overflow:hidden; display:none; }`
- `.screen.active { display:flex; flex-direction:column; }`
- `.card` `.bottombar` `.topbar` `.modal` `.modal-card`
- `.seats`（座位圓點容器）
- `.seat`（圓點按鈕）
- `.seat.dead`（灰）
- `.seat.selected`（外框粗）
- `.fab`（浮動按鈕群：公告/上帝）
- `.noSelect`（全域 user-select:none）

防 iOS：
- `.seat, button { -webkit-touch-callout:none; -webkit-user-select:none; user-select:none; }`
- `img { -webkit-user-drag:none; }`
- 禁止 double-tap zoom（用 meta viewport 已做，但仍需 touch-action）

---

## 9. 你這輪額外需求（待你確認）
1) 特殊板子 b1 角色清單會再擴：白痴、攝夢人、魔術師、黑市商人、幸運兒、獵魔人、惡靈騎士、石像鬼、邱比特、暗戀者…（先補資料，再串流程）
2) 小朋友模式：
   - 夜晚台詞更像故事引導
   - 早上公告加「可能發生什麼」（守衛守到/女巫救/狼人空刀...）
3) 抽牌頁：可點 seat 回看身份（仍要長按翻牌）
