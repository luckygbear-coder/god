// 先放「穩定可跑」的核心資料（不依賴 WW_DATA）
window.GAME = {
  players: [],
  nightStep: 0,
  nightState: {},
  witch: {
    saveUsed: false,
    poisonUsed: false,
    poisonTarget: null,
  },
  // 先用內建 steps（第2批再換成你的 data/night/*.js）
  steps: [
    { key: "close", text: "天黑請閉眼" },
    { key: "wolf", text: "狼人請選擇擊殺目標", pick: "wolfTarget" },
    { key: "seer", text: "預言家請查驗一人", pick: "seerTarget" },
    { key: "witch", text: "女巫請行動", witch: true },
    { key: "open", text: "天亮請睜眼" }
  ],

  // 第1批：安全接回 roles 的容器
  roles: {},      // { roleId: {name, icon, team...} }
  rolesLoaded: false
};