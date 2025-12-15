/* =========================================================
   狼人殺｜完整角色資料庫
   - 基本板
   - 特殊板 B1
   ⚠️ 僅定義角色資料，不含流程與判定
========================================================= */

window.WW_ROLES = {
  /* =========================
     基本板（預女獵白）
  ========================= */
  villager: {
    id: "villager",
    name: "村民",
    camp: "villager",
    tags: []
  },

  seer: {
    id: "seer",
    name: "預言家",
    camp: "villager",
    tags: ["nightCheck"]
  },

  witch: {
    id: "witch",
    name: "女巫",
    camp: "villager",
    tags: ["save", "poison"]
  },

  hunter: {
    id: "hunter",
    name: "獵人",
    camp: "villager",
    tags: ["canShoot", "deathSkill"]
  },

  guard: {
    id: "guard",
    name: "守衛",
    camp: "villager",
    tags: ["canGuard"]
  },

  werewolf: {
    id: "werewolf",
    name: "狼人",
    camp: "wolf",
    tags: ["wolfKill"]
  },

  /* =========================
     狼人強化
  ========================= */
  whiteWolfKing: {
    id: "whiteWolfKing",
    name: "白狼王",
    camp: "wolf",
    tags: ["wolfKill", "explode", "deathSkill"]
  },

  blackWolfKing: {
    id: "blackWolfKing",
    name: "黑狼王",
    camp: "wolf",
    tags: ["wolfKill", "deathSkill", "poisonSensitive"]
  },

  stoneGargoyle: {
    id: "stoneGargoyle",
    name: "石像鬼",
    camp: "wolf",
    tags: ["nightCheck"]
  },

  /* =========================
     特殊神職（B1）
  ========================= */
  idiot: {
    id: "idiot",
    name: "白痴",
    camp: "villager",
    tags: ["voteImmune"]
  },

  dreamer: {
    id: "dreamer",
    name: "攝夢人",
    camp: "villager",
    tags: ["dreamLock"]
  },

  magician: {
    id: "magician",
    name: "魔術師",
    camp: "villager",
    tags: ["swap"]
  },

  blackMarketDealer: {
    id: "blackMarketDealer",
    name: "黑市商人",
    camp: "villager",
    tags: ["trade"]
  },

  luckyMan: {
    id: "luckyMan",
    name: "幸運兒",
    camp: "villager",
    tags: ["randomRole"]
  },

  demonHunter: {
    id: "demonHunter",
    name: "獵魔人",
    camp: "villager",
    tags: ["counterKill"]
  },

  evilKnight: {
    id: "evilKnight",
    name: "惡靈騎士",
    camp: "villager",
    tags: ["revenge"]
  },

  /* =========================
     第三方陣營
  ========================= */
  cupid: {
    id: "cupid",
    name: "邱比特",
    camp: "third",
    tags: ["linkLovers"]
  },

  lover: {
    id: "lover",
    name: "暗戀者",
    camp: "third",
    tags: ["linkedLife"]
  }
};