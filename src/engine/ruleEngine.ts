import {
  CARD_LIBRARY,
  createProceduralPatron,
  ENEMY_TEMPLATES,
  generateDailyBulletins,
  INGREDIENTS,
  MAIN_NPC_ORDER,
  REWARD_CARD_POOL,
  resolveNpcProfile,
  RUMOR_SEED_TEMPLATES,
  STARTER_DECK_IDS,
} from "../data/gameConfig";
import {
  COMBO_CARD_LIBRARY,
  createCutawayBuildingForLocation,
  createDefaultRpgState,
  ensureRpgState,
  getNormalizedDeckCards,
  grantRpgXp,
  PERK_LIBRARY,
  resolveCardStats,
  roll2d6AttributeCheck,
  RPG_ATTRIBUTE_META,
  syncDeckDefIdsFromDeckCards,
} from "../data/rpgAndCards";
import {
  DEFAULT_UNLOCKED_LORE_IDS,
  scanTextForLoreUnlocks,
  WASTELAND_LORE_DB,
} from "../data/wastelandLore";
import {
  customPatronToStaticProfile,
  loadCharacterRoster,
} from "../data/settingsAndRosterStore";
import {
  ActiveEnemy,
  CampaignSaveState,
  CardInstance,
  CityLocationId,
  CraftedDrink,
  DraftCardOption,
  IngredientId,
  NightCompanionState,
  NightRunState,
  NpcId,
  NpcProposedActionType,
  NpcStaticProfile,
  PendingDecisionOffer,
  QuantifiedNpcState,
  RpgAttributeKey,
  RuinMapNode,
  RuleValidationLog,
  ShowdownVerdictChoice,
  TavernRumor,
} from "../types/game";

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(val)));
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now()
    .toString(36)
    .slice(-4)}`;
}

export function nowTimeLabel(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

export function emptyIngredientBag(): Record<IngredientId, number> {
  return {
    rad_water: 0,
    mutant_potato: 0,
    rust_malt: 0,
    glow_shroom: 0,
    calm_herb: 0,
    cryo_mint: 0,
  };
}

export function addCardToCampaignDeck(
  state: CampaignSaveState,
  defId: string,
  upgraded = false
): void {
  const list = getNormalizedDeckCards(state);
  list.push({
    uid: uid("dc"),
    defId,
    upgraded,
  });
  state.deckCards = list;
  syncDeckDefIdsFromDeckCards(state);
}

export function buildNightCompanionFromProfile(
  profile: NpcStaticProfile
): NightCompanionState {
  const skill = profile.companionSkill || {
    name: "废墟火力掩护",
    desc: "每回合结束造成 5 点掩护伤害，每 2 回合搜刮 1 份食材。",
    kind: "ASSAULT_SCAVENGE" as const,
    value: 5,
  };
  return {
    npcId: profile.id,
    name: profile.name,
    title: profile.title,
    portraitUrl: profile.portraitUrl,
    combatSpriteUrl: profile.combatSpriteUrl,
    modularParts: profile.modularParts,
    skillName: skill.name,
    skillDesc: skill.desc,
    kind: skill.kind,
    value: skill.value,
  };
}

export function pushTavernRumor(
  state: CampaignSaveState,
  rumor: Omit<TavernRumor, "id">
): void {
  const existing = (state.activeRumors || []).filter(
    (r) => r.title !== rumor.title
  );
  state.activeRumors = [
    {
      ...rumor,
      id: uid("rumor"),
    },
    ...existing,
  ].slice(0, 4);
}

export function computeRumorAggregate(state: CampaignSaveState): {
  trustMod: number;
  tensionMod: number;
  hasLootBoost: boolean;
} {
  const list = state.activeRumors || [];
  let trustMod = 0;
  let tensionMod = 0;
  let hasLootBoost = false;
  list.forEach((r) => {
    trustMod += r.trustMod;
    tensionMod += r.tensionMod;
    if (r.nightBonus === "LOOT") hasLootBoost = true;
  });
  return {
    trustMod: clamp(trustMod, -12, 14),
    tensionMod: clamp(tensionMod, -16, 16),
    hasLootBoost,
  };
}

export function buildDailyNpcQueue(day: number): NpcId[] {
  const offset = (day - 1) % MAIN_NPC_ORDER.length;
  const rotated = [
    ...MAIN_NPC_ORDER.slice(offset),
    ...MAIN_NPC_ORDER.slice(0, offset),
  ];
  return rotated.slice(0, 3);
}

export function syncCustomPatronsIntoCampaign(
  state: CampaignSaveState,
  appendUnqueuedToToday = false
): CampaignSaveState {
  const roster = loadCharacterRoster();
  const activeCustoms = roster.customPatrons.filter((c) => c.enabled !== false);
  if (activeCustoms.length === 0) {
    return state;
  }
  const next = structuredClone(state);
  next.proceduralProfiles = next.proceduralProfiles || {};

  activeCustoms.forEach((rec) => {
    const prof = customPatronToStaticProfile(rec);
    next.proceduralProfiles![rec.id] = prof;
    if (!next.npcs[rec.id]) {
      next.npcs[rec.id] = {
        id: rec.id,
        trust: 56, // 初始信任即接近同行助战线，喝一杯好酒或寒暄即可签约夜探助战
        intoxication: 0,
        tension: 18,
        debtCaps: 0,
        visits: 0,
        unlockedCardGiven: false,
        intelSharedToday: false,
        memories: [],
        clueExposed: false,
        exposedClueNote: "",
        showdownResolved: null,
        rumorSeededToday: false,
      };
    }
    if (appendUnqueuedToToday && !next.todayQueue.includes(rec.id)) {
      next.todayQueue.push(rec.id);
    }
  });

  if (next.nightCompanion) {
    const updatedProf = resolveNpcProfile(next, next.nightCompanion.npcId);
    next.nightCompanion = buildNightCompanionFromProfile(updatedProf);
    if (next.nightRun?.companion) {
      next.nightRun.companion = next.nightCompanion;
    }
  }

  return next;
}

export function populateDailyQueueWithDrifter(
  state: CampaignSaveState,
  day: number
): CampaignSaveState {
  const next = syncCustomPatronsIntoCampaign(structuredClone(state), false);
  ensureRpgState(next);
  next.deckCards = getNormalizedDeckCards(next);
  syncDeckDefIdsFromDeckCards(next);

  next.proceduralProfiles = next.proceduralProfiles || {};
  const nextSerial = (next.drifterCounter || 0) + 1;
  next.drifterCounter = nextSerial;

  const rumorAgg = computeRumorAggregate(next);
  const { profile, initialState } = createProceduralPatron(day, nextSerial);
  initialState.trust = clamp(initialState.trust + rumorAgg.trustMod, 15, 85);
  initialState.tension = clamp(
    initialState.tension + rumorAgg.tensionMod,
    5,
    80
  );
  next.proceduralProfiles[profile.id] = profile;
  next.npcs[profile.id] = initialState;

  const mainThree = buildDailyNpcQueue(day);
  if (day > 1 && (rumorAgg.trustMod !== 0 || rumorAgg.tensionMod !== 0)) {
    mainThree.forEach((mId) => {
      if (next.npcs[mId]) {
        next.npcs[mId].trust = clamp(
          next.npcs[mId].trust + Math.round(rumorAgg.trustMod * 0.5),
          0,
          100
        );
        next.npcs[mId].tension = clamp(
          next.npcs[mId].tension + Math.round(rumorAgg.tensionMod * 0.5),
          5,
          90
        );
      }
    });
  }

  const activeCustomIds = loadCharacterRoster()
    .customPatrons.filter((c) => c.enabled !== false)
    .map((c) => c.id);

  // 若人物库中有原创酒客，每天安排进店轮值排入吧台队列
  const rotatedCustoms =
    activeCustomIds.length > 0
      ? [
          ...activeCustomIds.slice((day - 1) % activeCustomIds.length),
          ...activeCustomIds.slice(0, (day - 1) % activeCustomIds.length),
        ].slice(0, 2)
      : [];

  next.todayQueue = [
    mainThree[0],
    ...rotatedCustoms,
    profile.id,
    mainThree[1],
    mainThree[2],
  ];
  next.currentQueueIndex = 0;

  const queueProfiles = next.todayQueue.map((id) => resolveNpcProfile(next, id));
  next.dailyBulletins = generateDailyBulletins(day, queueProfiles);
  return next;
}

export function summonExtraProceduralPatron(
  prevState: CampaignSaveState
): CampaignSaveState {
  const next = syncCustomPatronsIntoCampaign(structuredClone(prevState), false);
  next.proceduralProfiles = next.proceduralProfiles || {};
  const currentNpcId = next.todayQueue[next.currentQueueIndex];
  if (currentNpcId && next.npcs[currentNpcId]) {
    next.npcs[currentNpcId].visits += 1;
  }

  // 若人物库中有尚未在今日进店的原创酒客，优先迎入该原创酒客！
  const unvisitedCustom = loadCharacterRoster()
    .customPatrons.filter((c) => c.enabled !== false)
    .find((c) => !next.todayQueue.includes(c.id));

  if (unvisitedCustom) {
    next.todayQueue = [...next.todayQueue, unvisitedCustom.id];
    next.currentQueueIndex = next.todayQueue.length - 1;
    next.currentTurnServedDrink = false;
    next.dialogueHistory = [];
    next.pendingOffer = null;
    const queueProfiles = next.todayQueue.map((id) => resolveNpcProfile(next, id));
    next.dailyBulletins = generateDailyBulletins(next.day, queueProfiles);
    return next;
  }

  const rumorAgg = computeRumorAggregate(next);
  const nextSerial = (next.drifterCounter || 0) + 1;
  next.drifterCounter = nextSerial;
  const { profile, initialState } = createProceduralPatron(next.day, nextSerial);
  initialState.trust = clamp(initialState.trust + rumorAgg.trustMod, 15, 85);
  initialState.tension = clamp(
    initialState.tension + rumorAgg.tensionMod,
    5,
    80
  );
  next.proceduralProfiles[profile.id] = profile;
  next.npcs[profile.id] = initialState;

  next.todayQueue = [...next.todayQueue, profile.id];
  next.currentQueueIndex = next.todayQueue.length - 1;
  next.currentTurnServedDrink = false;
  next.dialogueHistory = [];
  next.pendingOffer = null;

  const queueProfiles = next.todayQueue.map((id) => resolveNpcProfile(next, id));
  next.dailyBulletins = generateDailyBulletins(next.day, queueProfiles);
  return next;
}

export function createInitialCampaign(): CampaignSaveState {
  const npcs: Record<NpcId, QuantifiedNpcState> = {
    ash_scavenger: {
      id: "ash_scavenger",
      trust: 42,
      intoxication: 0,
      tension: 24,
      debtCaps: 0,
      visits: 0,
      unlockedCardGiven: false,
      intelSharedToday: false,
      memories: [],
      clueExposed: false,
      showdownResolved: null,
      rumorSeededToday: false,
    },
    buck_raider: {
      id: "buck_raider",
      trust: 36,
      intoxication: 0,
      tension: 42,
      debtCaps: 0,
      visits: 0,
      unlockedCardGiven: false,
      intelSharedToday: false,
      memories: [],
      clueExposed: false,
      showdownResolved: null,
      rumorSeededToday: false,
    },
    k7_synth: {
      id: "k7_synth",
      trust: 40,
      intoxication: 0,
      tension: 32,
      debtCaps: 0,
      visits: 0,
      unlockedCardGiven: false,
      intelSharedToday: false,
      memories: [],
      clueExposed: false,
      showdownResolved: null,
      rumorSeededToday: false,
    },
    mori_merchant: {
      id: "mori_merchant",
      trust: 46,
      intoxication: 0,
      tension: 18,
      debtCaps: 0,
      visits: 0,
      unlockedCardGiven: false,
      intelSharedToday: false,
      memories: [],
      clueExposed: false,
      showdownResolved: null,
      rumorSeededToday: false,
    },
  };

  const deckCards = STARTER_DECK_IDS.map((defId, idx) => ({
    uid: `dc_init_${idx}`,
    defId,
    upgraded: false,
  }));

  const initial: CampaignSaveState = {
    version: 3,
    day: 1,
    maxDays: 7,
    phase: "TITLE",
    weatherIndex: 0,
    caps: 38,
    tavernSecurity: 85,
    havenReputation: 20,
    playerHp: 50,
    playerMaxHp: 50,
    rpg: createDefaultRpgState(),
    inventory: {
      rad_water: 5,
      mutant_potato: 4,
      rust_malt: 4,
      glow_shroom: 2,
      calm_herb: 2,
      cryo_mint: 1,
    },
    npcs,
    proceduralProfiles: {},
    drifterCounter: 0,
    todayQueue: [],
    currentQueueIndex: 0,
    currentTurnServedDrink: false,
    dialogueHistory: [],
    pendingOffer: null,
    deckDefIds: [...STARTER_DECK_IDS],
    deckCards,
    todayLedger: {
      day: 1,
      patronsServed: 0,
      capsEarned: 0,
      capsCreditIssued: 0,
      xpEarnedToday: 0,
      intelUnlocked: [],
      ambushTriggeredBy: [],
      notableEvents: [],
    },
    nightIntelUnlocked: false,
    nightIntelPatronName: null,
    nightAmbushTriggered: false,
    nightAmbushPatronName: null,
    nightBossWeakened: false,
    dailyBulletins: [],
    activeRumors: [
      {
        id: "init_rumor_1",
        day: 1,
        title: "零号街区新亮起的钨丝灯",
        detail: "听说防空洞旧吧台换了位懂调酒的新掌柜，不少拾荒客想过来探探深浅。",
        tone: "WARM",
        trustMod: 2,
        tensionMod: 0,
        remainingDays: 2,
        nightBonus: null,
      },
    ],
    nightCompanion: null,
    activeCommission: null,
    nightHitmanTriggered: false,
    nightHitmanSponsor: null,
    nightTrapCacheUnlocked: false,
    nightRun: null,
    ruleLogs: [],
    soundEnabled: true,
    bgmEnabled: true,
    ttsEnabled: true,
    unlockedLoreIds: [...DEFAULT_UNLOCKED_LORE_IDS],
  };

  return populateDailyQueueWithDrifter(initial, 1);
}

/**
 * 第 3 天深度体验预设档（含 LV.3 角色成长、专长与四大流派核心卡）
 */
export function createJudgeShowcasePreset(): CampaignSaveState {
  const base = createInitialCampaign();
  base.day = 3;
  base.phase = "DAY_TAVERN";
  base.weatherIndex = 2;
  base.caps = 64;
  base.tavernSecurity = 90;
  base.havenReputation = 52;
  base.playerMaxHp = 62;
  base.playerHp = 62;
  base.rpg = {
    level: 3,
    xp: 45,
    nextLevelXp: 195,
    statPoints: 2,
    upgradeTokens: 2,
    pendingPerkChoices: 1,
    attributes: {
      STR: 3,
      AGI: 3,
      ELO: 4,
      CHA: 3,
    },
    unlockedPerks: ["perk_gunslinger", "perk_iron_barkeep"],
    lastDiceCheck: null,
  };
  base.inventory = {
    rad_water: 6,
    mutant_potato: 5,
    rust_malt: 5,
    glow_shroom: 4,
    calm_herb: 3,
    cryo_mint: 3,
  };
  const presetDeckIds = [
    ...STARTER_DECK_IDS,
    "sig_ash_crowbar",
    "card_weld_bulkhead",
    "card_shield_slam",
    "card_gatling_barrage",
    "card_arc_turret_rig",
  ];
  base.deckCards = presetDeckIds.map((defId, idx) => ({
    uid: `dc_preset_${idx}`,
    defId,
    upgraded:
      defId === "sig_ash_crowbar" ||
      defId === "card_snap_aim" ||
      defId === "starter_rummage",
  }));
  syncDeckDefIdsFromDeckCards(base);
  base.unlockedLoreIds = WASTELAND_LORE_DB.slice(0, 14).map((e) => e.id);

  base.npcs.ash_scavenger = {
    id: "ash_scavenger",
    trust: 76,
    intoxication: 10,
    tension: 12,
    debtCaps: 0,
    visits: 2,
    unlockedCardGiven: true,
    intelSharedToday: false,
    clueExposed: false,
    showdownResolved: null,
    rumorSeededToday: false,
    memories: [
      {
        day: 1,
        impactTag: "多倒半杯",
        summary: "老板端上满杯废墟暖胃甜麦饮多倒了半杯，阿灰暖和过来付了全款。",
      },
      {
        day: 2,
        impactTag: "赠予信物",
        summary: "信任度突破阈值72，阿灰将《阿灰的万能撬棍》留在吧台并随时愿同行助战。",
      },
    ],
  };

  base.npcs.mori_merchant = {
    id: "mori_merchant",
    trust: 60,
    intoxication: 0,
    tension: 14,
    debtCaps: 14,
    visits: 1,
    unlockedCardGiven: false,
    intelSharedToday: false,
    clueExposed: false,
    showdownResolved: null,
    rumorSeededToday: false,
    memories: [
      {
        day: 2,
        impactTag: "赊账立据",
        summary: "莫里驼队周转不灵赊了14枚瓶盖的金算盘特调，发誓下次进门连本带利奉还。",
      },
    ],
  };

  base.npcs.buck_raider = {
    id: "buck_raider",
    trust: 62,
    intoxication: 15,
    tension: 26,
    debtCaps: 0,
    visits: 2,
    unlockedCardGiven: false,
    intelSharedToday: false,
    clueExposed: false,
    showdownResolved: null,
    rumorSeededToday: false,
    memories: [
      {
        day: 1,
        impactTag: "烈酒投缘",
        summary: "老板未兑一滴水端上铁锈烧刀子，巴克大呼痛快，距离赠予霰弹卡仅一步之遥。",
      },
    ],
  };

  base.npcs.k7_synth = {
    id: "k7_synth",
    trust: 56,
    intoxication: 0,
    tension: 22,
    debtCaps: 0,
    visits: 1,
    unlockedCardGiven: false,
    intelSharedToday: false,
    clueExposed: false,
    showdownResolved: null,
    rumorSeededToday: false,
    memories: [
      {
        day: 2,
        impactTag: "保守秘密",
        summary: "老板看破却未点破其合成人接缝，端上荧光净辐冷萃帮其降温。",
      },
    ],
  };

  const d3Drifter = createProceduralPatron(3, 2);
  base.proceduralProfiles = {
    ...(base.proceduralProfiles || {}),
    [d3Drifter.profile.id]: d3Drifter.profile,
  };
  base.npcs[d3Drifter.profile.id] = d3Drifter.initialState;
  base.drifterCounter = 2;
  base.todayQueue = [
    "mori_merchant",
    d3Drifter.profile.id,
    "buck_raider",
    "k7_synth",
  ];
  base.currentQueueIndex = 0;
  base.todayLedger.day = 3;

  const queueProfiles = base.todayQueue.map((id) => resolveNpcProfile(base, id));
  base.dailyBulletins = generateDailyBulletins(3, queueProfiles);
  base.activeRumors = [
    {
      id: "preset_rumor_1",
      day: 2,
      title: "酒足情义重的铁皮避风港",
      detail: "阿灰在集市逢人便夸酒馆掌柜倒酒实在、肯赊救急，进门熟客初始信任 +6。",
      tone: "WARM",
      trustMod: 6,
      tensionMod: -4,
      remainingDays: 2,
      nightBonus: null,
    },
    {
      id: "preset_rumor_2",
      day: 2,
      title: "北方猎犬悬赏电报频传",
      detail: "东区暗探与黑市走私客混杂进店，吧台底下暗流涌动。",
      tone: "CUNNING",
      trustMod: 0,
      tensionMod: 2,
      remainingDays: 2,
      nightBonus: "LOOT",
    },
  ];
  base.nightCompanion = buildNightCompanionFromProfile(
    resolveNpcProfile(base, "ash_scavenger")
  );

  base.ruleLogs = [
    {
      id: "preset_log_1",
      day: 2,
      timestamp: "昨日归档",
      npcId: "ash_scavenger",
      npcName: "阿灰",
      provider: "rule-archive",
      modelName: "历史校验快照",
      rawProposedAction: "GIFT_SIGNATURE_CARD",
      quantifiedBefore: { trust: 61, intoxication: 12, tension: 18, debtCaps: 0 },
      quantifiedAfter: { trust: 76, intoxication: 24, tension: 12, debtCaps: 0 },
      ruleCheckSummary: "校验通过：trust (76) >= 赠卡阈值 (72) 且信物尚未发放",
      passedValidation: true,
      enforcedOutcome: "发放专属0费搜刮卡《阿灰的万能撬棍》并签约夜探同行助战",
      worldMutation: "卡组新增 sig_ash_crowbar；同行助战席：阿灰",
    },
  ];

  return base;
}

// ==================== RPG 属性加点、专长选择与卡牌升星改装 ====================

export function allocateRpgStatPoint(
  prevState: CampaignSaveState,
  attr: RpgAttributeKey
): { nextState: CampaignSaveState; banner: string } {
  const state = structuredClone(prevState);
  const rpg = ensureRpgState(state);
  if (rpg.statPoints <= 0) {
    return { nextState: prevState, banner: "当前没有可分配的基础属性点" };
  }
  rpg.statPoints -= 1;
  rpg.attributes[attr] = (rpg.attributes[attr] || 2) + 1;
  const meta = RPG_ATTRIBUTE_META[attr];
  return {
    nextState: state,
    banner: `「${meta.name} (${meta.code})」已提升至 ${rpg.attributes[attr]} 点！`,
  };
}

export function selectRpgPerk(
  prevState: CampaignSaveState,
  perkId: string
): { nextState: CampaignSaveState; banner: string } {
  const state = structuredClone(prevState);
  const rpg = ensureRpgState(state);
  const perk = PERK_LIBRARY.find((p) => p.id === perkId);
  if (!perk || rpg.pendingPerkChoices <= 0 || rpg.unlockedPerks.includes(perkId)) {
    return { nextState: prevState, banner: "" };
  }
  rpg.pendingPerkChoices -= 1;
  rpg.unlockedPerks.push(perkId);

  if (perkId === "perk_vault_constitution") {
    state.playerMaxHp += 12;
    state.playerHp = Math.min(state.playerMaxHp, state.playerHp + 12);
  } else if (perkId === "perk_blackmarket_eye") {
    rpg.upgradeTokens += 2;
  }

  return {
    nextState: state,
    banner: `已习得废土专长《${perk.name}》！`,
  };
}

export function upgradeDeckCard(
  prevState: CampaignSaveState,
  cardUid: string,
  preferBuildingScrap = false
): { nextState: CampaignSaveState; banner: string } {
  const state = structuredClone(prevState);
  const rpg = ensureRpgState(state);
  const deck = getNormalizedDeckCards(state);
  const target = deck.find((c) => c.uid === cardUid);
  if (!target || target.upgraded) {
    return { nextState: prevState, banner: "该卡牌已处于 +1 升星状态" };
  }

  const building = state.nightRun?.building;
  const canUseScrap =
    preferBuildingScrap && Boolean(building && building.scrapParts >= 3);
  if (!canUseScrap && rpg.upgradeTokens <= 0) {
    return {
      nextState: prevState,
      banner: "缺少卡牌升级点（或工作台 3 枚废铁零件），升级失败",
    };
  }

  if (canUseScrap && building) {
    building.scrapParts -= 3;
    building.exploreLog = [
      `在钳工改装台消耗 3 枚废铁零件，将《${resolveCardStats(target.defId, false).name}》精锻升星为 +1！`,
      ...building.exploreLog,
    ].slice(0, 10);
  } else {
    rpg.upgradeTokens -= 1;
  }

  target.upgraded = true;
  state.deckCards = deck;
  syncDeckDefIdsFromDeckCards(state);
  const upgradedStats = resolveCardStats(target.defId, true);

  return {
    nextState: state,
    banner: `卡牌升星成功：《${upgradedStats.name}》已永久强化！`,
  };
}

export interface RawLlmTurnInput {
  dialogue: string;
  innerThought: string;
  moodLabel: string;
  trustDelta: number;
  intoxicationDelta: number;
  tensionDelta: number;
  proposedAction: NpcProposedActionType;
  offerCaps: number;
  memoryNote: string;
  clueRevealed?: boolean;
  slippedClue?: string;
  provider: string;
  modelName: string;
}

export interface RuleEngineResolution {
  nextState: CampaignSaveState;
  patronFinishedTurn: boolean;
  systemBanner: string | null;
}

const GENERIC_DETECTIVE_KEYWORDS = [
  "口供",
  "真身",
  "卧底",
  "密探",
  "通缉",
  "悬赏",
  "伪装",
  "电报",
  "实话",
  "底细",
];

/**
 * 确定性游戏规则校验引擎：
 * - 所有收钱、还旧债、给情报、赠专属卡均生成吧台中央实体签收单 SETTLEMENT_RECEIPT，由玩家亲手点击入账！
 * - 砍价与闹事冲突接入 2d6 + 四维属性掷骰检定。
 */
export function validateAndApplyNpcTurn(
  prevState: CampaignSaveState,
  npcId: NpcId,
  llmTurn: RawLlmTurnInput,
  servedDrink?: CraftedDrink,
  playerMessage?: string
): RuleEngineResolution {
  const state: CampaignSaveState = structuredClone(prevState);
  const rpg = ensureRpgState(state);
  state.deckCards = getNormalizedDeckCards(state);
  syncDeckDefIdsFromDeckCards(state);
  state.activeRumors = state.activeRumors || [];

  const profile = resolveNpcProfile(state, npcId);
  if (!state.npcs[npcId]) {
    state.npcs[npcId] = {
      id: npcId,
      trust: 42,
      intoxication: 0,
      tension: 25,
      debtCaps: 0,
      visits: 0,
      unlockedCardGiven: false,
      intelSharedToday: false,
      memories: [],
      clueExposed: false,
      showdownResolved: null,
      rumorSeededToday: false,
    };
  }
  const npc = state.npcs[npcId];

  const snapshotBefore = {
    trust: npc.trust,
    intoxication: npc.intoxication,
    tension: npc.tension,
    debtCaps: npc.debtCaps,
  };

  let trustDelta = clamp(llmTurn.trustDelta, -18, 20);
  let intoxDelta = clamp(llmTurn.intoxicationDelta, 0, 28);
  let tensionDelta = clamp(llmTurn.tensionDelta, -25, 28);

  const ruleNotes: string[] = [];

  const isFirstGreetingThisVisit = state.dialogueHistory.length === 0 && !servedDrink;
  if (isFirstGreetingThisVisit && state.activeRumors.length > 0) {
    const agg = computeRumorAggregate(state);
    if (agg.trustMod !== 0 || agg.tensionMod !== 0) {
      trustDelta += agg.trustMod;
      tensionDelta += agg.tensionMod;
      ruleNotes.push(
        `江湖流言传染(信任${agg.trustMod >= 0 ? `+${agg.trustMod}` : agg.trustMod}/张力${
          agg.tensionMod >= 0 ? `+${agg.tensionMod}` : agg.tensionMod
        })`
      );
    }
  }

  if (servedDrink) {
    const chaBonus = Math.max(0, (rpg.attributes.CHA || 2) - 2) * 2;
    if (chaBonus > 0) {
      trustDelta += chaBonus;
      ruleNotes.push(`掌柜魅力加成 信任+${chaBonus}`);
    }

    const matchedPrefs = servedDrink.flavorTags.filter((t) =>
      profile.favoriteNotes.includes(t)
    );
    const hitDislike = servedDrink.flavorTags.some((t) =>
      profile.dislikedNotes.includes(t)
    );

    if (matchedPrefs.length > 0) {
      trustDelta += 4 + matchedPrefs.length * 2;
      tensionDelta -= 4;
      ruleNotes.push(
        `命中偏好[${matchedPrefs.join("/")}] 信任+${4 + matchedPrefs.length * 2}`
      );
    }
    if (hitDislike) {
      trustDelta -= 6;
      tensionDelta += 12;
      ruleNotes.push("触碰口味雷区 张力+12");
    }
    if (servedDrink.pourStyle === "generous") {
      trustDelta += 8;
      tensionDelta -= 6;
      intoxDelta += 6;
      ruleNotes.push("慷慨多倒半杯 信任+8/醉意+6/张力-6");
      pushTavernRumor(state, {
        day: state.day,
        title: "掌柜倒酒满溢不掺假",
        detail: `${profile.name}喝到了多倒半杯的实在好酒，酒馆厚道名声在外传开。`,
        tone: "WARM",
        trustMod: 4,
        tensionMod: -3,
        remainingDays: 2,
        nightBonus: null,
      });
    } else if (servedDrink.pourStyle === "watered") {
      trustDelta -= 9;
      tensionDelta += 15;
      ruleNotes.push("兑水省料被察觉 信任-9/张力+15");
      pushTavernRumor(state, {
        day: state.day,
        title: "吧台酒水寡淡掺水风言",
        detail: `有酒客抱怨杯底全是兑进去的辐射凉水，新客进门多了几分挑剔。`,
        tone: "RUTHLESS",
        trustMod: -4,
        tensionMod: 5,
        remainingDays: 2,
        nightBonus: null,
      });
    }
    if (servedDrink.soothing >= 6) {
      tensionDelta -= 8;
      ruleNotes.push("高安抚草本配方 张力-8");
    }
    intoxDelta = Math.max(intoxDelta, servedDrink.potency * 4 + 4);
  }

  npc.trust = clamp(npc.trust + trustDelta, 0, 100);
  npc.intoxication = clamp(npc.intoxication + intoxDelta, 0, 100);
  npc.tension = clamp(npc.tension + tensionDelta, 0, 100);

  // 侦探酒保双轨识破判定（口才 ELO 可降低套话催醉门槛！）
  let newlyExposedClue = false;
  const agenda = profile.secretAgenda;
  if (agenda?.isUndercover && !npc.showdownResolved && !npc.clueExposed) {
    const msgText = (playerMessage || "").trim();
    const hitProbeKeyword =
      msgText.length > 0 &&
      [...agenda.probeKeywords, ...GENERIC_DETECTIVE_KEYWORDS].some((kw) =>
        msgText.includes(kw)
      );

    const eloDiscount = Math.max(0, (rpg.attributes.ELO || 2) - 2) * 3;
    const threshold = Math.max(10, agenda.slipIntoxicationThreshold - eloDiscount);
    const exposedByIntox = npc.intoxication >= threshold;
    const exposedByProbeAndTipsy =
      hitProbeKeyword && npc.intoxication >= Math.max(8, threshold - 12);
    const exposedByLlm =
      Boolean(llmTurn.clueRevealed) &&
      (npc.intoxication >= 10 || hitProbeKeyword || Boolean(servedDrink));

    if (exposedByIntox || exposedByProbeAndTipsy || exposedByLlm) {
      npc.clueExposed = true;
      npc.exposedClueNote =
        llmTurn.slippedClue && llmTurn.slippedClue.trim().length >= 6
          ? llmTurn.slippedClue.trim()
          : agenda.defaultClueText;
      newlyExposedClue = true;
      grantRpgXp(state, 15);
      ruleNotes.push(
        `抓获伪装破绽[醉意${npc.intoxication}/${threshold}${
          hitProbeKeyword ? "·命中盘问" : ""
        } · +15XP]`
      );
    }
  } else if (playerMessage && playerMessage.trim().length > 0 && !servedDrink) {
    grantRpgXp(state, 4);
  }

  let action: NpcProposedActionType = llmTurn.proposedAction;
  let passedValidation = true;
  let ruleCheckSummary = "";
  let enforcedOutcome = "";
  let worldMutation = "无世界状态变更（继续吧台交谈）";
  let systemBanner: string | null = null;
  const patronFinishedTurn = false;

  if (npc.tension >= profile.brawlTensionThreshold) {
    if (action !== "PROVOKE_BRAWL") {
      passedValidation = false;
      ruleCheckSummary = `强制覆写：当前张力 (${npc.tension}) >= 暴走阈值 (${profile.brawlTensionThreshold})，覆盖原提议 ${action}`;
    } else {
      ruleCheckSummary = `校验通过：张力 (${npc.tension}) >= 暴走阈值 (${profile.brawlTensionThreshold})，触发闹事检定`;
    }
    action = "PROVOKE_BRAWL";
  }

  if (
    !servedDrink &&
    action !== "CHAT_ONLY" &&
    action !== "REPAY_DEBT" &&
    action !== "OFFER_COMMISSION" &&
    action !== "PROVOKE_BRAWL"
  ) {
    passedValidation = false;
    ruleCheckSummary = `拦截提议 ${action}：当前尚未递出饮品，规则层锁定为吧台寒暄 CHAT_ONLY`;
    action = "CHAT_ONLY";
  }

  const basePrice = servedDrink?.suggestedPrice ?? 12;

  const buildStandardPaymentReceipt = (
    paidCaps: number,
    tipCaps: number,
    extraOpts?: Partial<PendingDecisionOffer>
  ): PendingDecisionOffer => ({
    type: "SETTLEMENT_RECEIPT",
    npcId,
    npcName: profile.name,
    suggestedPrice: servedDrink ? basePrice : 0,
    offeredCaps: paidCaps,
    tipCaps,
    xpReward: 16,
    description: `${profile.name}将酒钱与情报凭证推到吧台中央，请清点签收入账。`,
    ...extraOpts,
  });

  switch (action) {
    case "OFFER_COMMISSION": {
      if (npc.trust >= 54 && !state.activeCommission) {
        const commTitle =
          profile.secretAgenda?.commissionTitle || `替${profile.name}取回废墟遗物`;
        const commObj =
          profile.secretAgenda?.commissionDesc ||
          `前往黑夜废墟建筑顶层取回指定委托物箱。`;

        state.pendingOffer = {
          type: "COMMISSION_OFFER",
          npcId,
          npcName: profile.name,
          suggestedPrice: servedDrink ? basePrice : 0,
          offeredCaps: 22,
          xpReward: 20,
          commissionTitle: commTitle,
          commissionObjective: commObj,
          description: `${profile.name}${
            servedDrink ? `放下 ${basePrice} 枚酒钱，` : ""
          }压低声音托付私活：「${commTitle}」——今晚在废墟建筑取回目标，黎明额外奉上 22 枚瓶盖重酬！`,
        };
        ruleCheckSummary = `校验通过：信任度 (${npc.trust}) >= 54 且当前无冲突委托`;
        enforcedOutcome = `挂起专属夜探委托单《${commTitle}》，等待掌柜拍板签收`;
        worldMutation = "生成吧台待决单：COMMISSION_OFFER";
      } else {
        passedValidation = false;
        ruleCheckSummary = `拦截 OFFER_COMMISSION：信任未达标 (${npc.trust} < 54) 或已有生效委托`;
        if (servedDrink) {
          state.pendingOffer = buildStandardPaymentReceipt(basePrice, 0, {
            description: `${profile.name}喝完《${servedDrink.name}》，在吧台放下了 ${basePrice} 枚瓶盖酒钱。`,
          });
          enforcedOutcome = `转为吧台酒钱签收单（${basePrice} 枚瓶盖）`;
          worldMutation = `生成吧台收款单：+${basePrice} 瓶盖待入账`;
          systemBanner = `${profile.name}已放下酒钱，请在吧台中央点击签收`;
        } else {
          enforcedOutcome = "转为普通吧台交谈";
        }
      }
      break;
    }

    case "REPAY_DEBT": {
      if (npc.debtCaps > 0 && npc.trust >= 40) {
        const repaid = Math.max(npc.debtCaps + 4, Math.round(npc.debtCaps * 1.4));
        const clearedDebt = npc.debtCaps;
        const drinkCaps = servedDrink ? basePrice : 0;
        const bossNote = npcId === "mori_merchant";

        state.pendingOffer = {
          type: "SETTLEMENT_RECEIPT",
          npcId,
          npcName: profile.name,
          suggestedPrice: drinkCaps,
          offeredCaps: drinkCaps,
          repaidDebtCaps: repaid,
          weakenedBossNote: bossNote,
          xpReward: 24,
          description: `${profile.name}把装满瓶盖的布袋拍在吧台上：连本带利归还旧账 ${repaid} 盖${
            drinkCaps > 0 ? `，外加今日酒钱 ${drinkCaps} 盖` : ""
          }${bossNote ? "，并附赠一份极寒核芯巨钳兽弱点图纸" : ""}！`,
        };
        ruleCheckSummary = `校验通过：历史欠款 (${clearedDebt} 盖) > 0 且信任度 (${npc.trust}) >= 40`;
        enforcedOutcome = `挂起旧债连本带利归还签收单（共 ${repaid + drinkCaps} 盖）`;
        worldMutation = `生成吧台签收单：旧债 +${repaid} 盖${
          bossNote ? " · 巨钳兽弱点情报" : ""
        }`;
        systemBanner = `${profile.name}归还了旧债与情报，请在吧台中央点击签收！`;
      } else {
        passedValidation = false;
        ruleCheckSummary = `拦截 REPAY_DEBT：当前无欠款 (${npc.debtCaps}) 或信任不足 (${npc.trust} < 40)`;
        if (servedDrink) {
          state.pendingOffer = buildStandardPaymentReceipt(basePrice, 0, {
            description: `${profile.name}喝尽杯中酒，在吧台放下了 ${basePrice} 枚瓶盖。`,
          });
          enforcedOutcome = `转为标准吧台收款单（${basePrice} 枚瓶盖）`;
          worldMutation = `生成吧台收款单：+${basePrice} 瓶盖待入账`;
        } else {
          enforcedOutcome = "转为普通寒暄对白";
        }
      }
      break;
    }

    case "GIFT_SIGNATURE_CARD": {
      const rewardCardId = profile.signatureCardId || "card_treasure_hound";
      const paid = Math.max(basePrice, llmTurn.offerCaps || basePrice);
      if (npc.trust >= profile.giftCardThreshold && !npc.unlockedCardGiven) {
        const cardDef = CARD_LIBRARY[rewardCardId];
        state.pendingOffer = buildStandardPaymentReceipt(paid, 0, {
          giftCardDefId: rewardCardId,
          giftCardName: cardDef.name,
          xpReward: 30,
          description: `${profile.name}付清 ${paid} 枚瓶盖，并将看家信物卡《${cardDef.name}》郑重推到吧台中央托付给你！`,
        });
        ruleCheckSummary = `校验通过：信任度 (${npc.trust}) >= 信物阈值 (${profile.giftCardThreshold}) 且信物未发放`;
        enforcedOutcome = `挂起吧台签收单：酒钱 ${paid} 盖 + 专属卡牌《${cardDef.name}》`;
        worldMutation = `生成吧台签收单：+${paid} 盖 · 信物卡《${cardDef.name}》待收下`;
        systemBanner = `${profile.name}奉上酒钱与专属卡《${cardDef.name}》，请点击吧台签收！`;
      } else if (
        npc.trust >= profile.intelThreshold &&
        !npc.intelSharedToday
      ) {
        passedValidation = false;
        state.pendingOffer = buildStandardPaymentReceipt(paid, 0, {
          intelUnlockedNote: `${profile.name}手绘的废墟隐藏医药冷藏库暗号`,
          xpReward: 24,
          description: `${profile.name}放下 ${paid} 枚瓶盖，并在餐巾纸背面画出了今晚废墟建筑「隐藏医药冷藏室」的通风管暗号！`,
        });
        ruleCheckSummary = `降级裁决：信任度 (${npc.trust}) 未达信物阈值，转为透露隐藏冷库暗号`;
        enforcedOutcome = `挂起吧台签收单：酒钱 ${paid} 盖 + 隐藏冷藏室路线情报`;
        worldMutation = `生成吧台签收单：+${paid} 盖 · 废墟冷库情报待收下`;
        systemBanner = `${profile.name}留下瓶盖与废墟冷库情报，请在吧台签收！`;
      } else {
        passedValidation = false;
        state.pendingOffer = buildStandardPaymentReceipt(basePrice, 0, {
          description: `${profile.name}喝完《${servedDrink?.name || "特调"}》，在杯垫旁放下了 ${basePrice} 枚瓶盖。`,
        });
        ruleCheckSummary = `拦截 GIFT_SIGNATURE_CARD：信任度未达阈值或已赠出，转为常规结账单`;
        enforcedOutcome = `挂起常规酒钱签收单（${basePrice} 枚瓶盖）`;
        worldMutation = `生成吧台签收单：+${basePrice} 盖待入账`;
        systemBanner = `${profile.name}已放下酒钱，请在吧台中央点击入账`;
      }
      break;
    }

    case "SHARE_RUIN_INTEL": {
      const paid = Math.max(basePrice, llmTurn.offerCaps || basePrice);
      if (npc.trust >= profile.intelThreshold && !npc.intelSharedToday) {
        const rewardCardId = profile.signatureCardId || "card_treasure_hound";
        const alsoGiftCard =
          npc.trust >= profile.giftCardThreshold && !npc.unlockedCardGiven;
        const cardDef = CARD_LIBRARY[rewardCardId];

        state.pendingOffer = buildStandardPaymentReceipt(paid, 0, {
          intelUnlockedNote: `${profile.name}透露的废墟隐藏冷藏库密道`,
          giftCardDefId: alsoGiftCard ? rewardCardId : undefined,
          giftCardName: alsoGiftCard ? cardDef.name : undefined,
          xpReward: alsoGiftCard ? 32 : 24,
          description: `${profile.name}推过 ${paid} 枚瓶盖与一张标着「废墟隐藏医药冷库」的草图${
            alsoGiftCard ? `，还顺手把《${cardDef.name}》留在了吧台上` : ""
          }，请清点签收！`,
        });
        ruleCheckSummary = `校验通过：信任度 (${npc.trust}) >= 情报阈值 (${profile.intelThreshold})`;
        enforcedOutcome = `挂起吧台签收单：酒钱 ${paid} 盖 + 废墟冷库情报${
          alsoGiftCard ? ` + 《${cardDef.name}》` : ""
        }`;
        worldMutation = `生成吧台签收单：瓶盖与情报凭证待玩家确认入账`;
        systemBanner = `${profile.name}放下了瓶盖与废墟路线情报，请点击吧台签收单确认！`;
      } else {
        passedValidation = false;
        state.pendingOffer = buildStandardPaymentReceipt(basePrice, 0, {
          description: `${profile.name}欲言又止地收起地图，只按规矩在吧台放下了 ${basePrice} 枚瓶盖酒钱。`,
        });
        ruleCheckSummary = `拦截 SHARE_RUIN_INTEL：信任度 (${npc.trust}) < 情报阈值 (${profile.intelThreshold}) 或今日已分享`;
        enforcedOutcome = `仅挂起常规酒钱签收单（${basePrice} 枚瓶盖）`;
        worldMutation = `生成吧台签收单：+${basePrice} 盖待入账`;
        systemBanner = `${profile.name}已放下 ${basePrice} 枚瓶盖，请在吧台点击入账`;
      }
      break;
    }

    case "PAY_FULL": {
      const tip = servedDrink?.pourStyle === "generous" && npc.trust >= 55 ? 3 : 0;
      const basePaid = Math.max(basePrice, llmTurn.offerCaps || basePrice);
      const rewardCardId = profile.signatureCardId || "card_treasure_hound";
      const alsoGiftCard =
        npc.trust >= profile.giftCardThreshold && !npc.unlockedCardGiven;
      const cardDef = CARD_LIBRARY[rewardCardId];

      state.pendingOffer = buildStandardPaymentReceipt(basePaid, tip, {
        giftCardDefId: alsoGiftCard ? rewardCardId : undefined,
        giftCardName: alsoGiftCard ? cardDef.name : undefined,
        xpReward: alsoGiftCard ? 28 : 16,
        description: `${profile.name}爽快地在吧台排开 ${basePaid} 枚瓶盖${
          tip > 0 ? `（另附 ${tip} 盖厚道小费）` : ""
        }${
          alsoGiftCard ? `，临走还把专属卡《${cardDef.name}》留给你防身` : ""
        }，请清点入账！`,
      });
      ruleCheckSummary = `校验通过：生成吧台结账签收单（酒钱 ${basePaid} 盖${
        tip > 0 ? ` + 小费 ${tip} 盖` : ""
      }）`;
      enforcedOutcome = `挂起吧台收款签收单，等待掌柜点击入账`;
      worldMutation = `生成吧台签收单：SETTLEMENT_RECEIPT`;
      systemBanner = `${profile.name}已放下瓶盖酒钱，请在吧台中央点击签收入账！`;
      break;
    }

    case "BARGAIN": {
      const offered = clamp(
        llmTurn.offerCaps > 0 ? llmTurn.offerCaps : Math.round(basePrice * 0.7),
        Math.max(5, Math.round(basePrice * 0.55)),
        basePrice - 2
      );
      state.pendingOffer = {
        type: "BARGAIN",
        npcId,
        npcName: profile.name,
        suggestedPrice: basePrice,
        offeredCaps: offered,
        xpReward: 16,
        description: `${profile.name}摸着干瘪口袋讲价：原价 ${basePrice} 盖的《${
          servedDrink?.name || "特调"
        }》，能不能算 ${offered} 枚瓶盖？`,
        diceOption: {
          attr: "ELO",
          dc: 9,
          label: "巧舌溢价",
          hint: `2d6+口才 ≥ 9：说服对方按原价 ${basePrice} 盖外加 2 盖小费痛快买单`,
        },
      };
      ruleCheckSummary = `校验通过：触发吧台议价裁决（菜单价 ${basePrice} vs 出价 ${offered} 盖，支持口才 2d6 检定）`;
      enforcedOutcome = "挂起议价交互单，可让利、硬收原价或发动【2d6+口才】说服检定";
      worldMutation = "生成待决吧台事件：BARGAIN";
      break;
    }

    case "ASK_CREDIT": {
      state.pendingOffer = {
        type: "ASK_CREDIT",
        npcId,
        npcName: profile.name,
        suggestedPrice: basePrice,
        offeredCaps: 0,
        xpReward: 16,
        description: `${profile.name}面露难色请求把这杯 ${basePrice} 枚瓶盖的《${
          servedDrink?.name || "特调"
        }》记在赊账本上，承诺改日宽裕时连本带利归还。`,
      };
      ruleCheckSummary = `校验通过：触发赊账立据裁决（待记账金额 ${basePrice} 瓶盖，当前旧债 ${npc.debtCaps}）`;
      enforcedOutcome = "挂起赊账交互单，等待老板决定准许记账或婉拒";
      worldMutation = "生成待决吧台事件：ASK_CREDIT";
      break;
    }

    case "PROVOKE_BRAWL": {
      state.pendingOffer = {
        type: "BRAWL_CRISIS",
        npcId,
        npcName: profile.name,
        suggestedPrice: basePrice,
        offeredCaps: 0,
        xpReward: 20,
        description: `${profile.name}危险张力飙至 ${npc.tension}/100，猛拍吧台准备掀桌拔枪！可掷骰用【力量/敏捷】当场镇压，或免单熄火！`,
        diceOption: {
          attr: "STR",
          dc: 9,
          label: "重拳镇场",
          hint: "2d6+力量 ≥ 9：单手按住桌面震慑刺头，免损酒馆耐久并勒令赔付酒钱",
        },
        altDiceOption: {
          attr: "AGI",
          dc: 9,
          label: "闪电夺械",
          hint: "2d6+敏捷 ≥ 9：残影夺下枪械化解危机，全馆喝彩声望+8",
        },
      };
      enforcedOutcome =
        "触发高张力冲突危机，支持【2d6+力量/敏捷】武力检定、免单安抚或强行轰出";
      worldMutation = "生成待决危机事件：BRAWL_CRISIS";
      break;
    }

    case "CHAT_ONLY":
    default: {
      ruleCheckSummary = `吧台交谈阶段：更新四维情绪（信任 ${snapshotBefore.trust}→${npc.trust}，醉意 ${snapshotBefore.intoxication}→${npc.intoxication}，张力 ${snapshotBefore.tension}→${npc.tension}）`;
      enforcedOutcome = "已完成情绪状态同步，等待老板调酒催醉或继续套话";
      break;
    }
  }

  if (newlyExposedClue) {
    systemBanner = systemBanner
      ? `${systemBanner} · 抓获伪装破绽！`
      : `抓获「${profile.name}」的口供破绽（+15 XP）！可在吧台或牛皮纸手札向其摊牌`;
    worldMutation = `${worldMutation}；解锁三向摊牌裁决`;
  }

  const existingLoreIds =
    state.unlockedLoreIds && state.unlockedLoreIds.length > 0
      ? state.unlockedLoreIds
      : [...DEFAULT_UNLOCKED_LORE_IDS];
  const loreScan = scanTextForLoreUnlocks(existingLoreIds, [
    playerMessage || "",
    llmTurn.dialogue || "",
    llmTurn.slippedClue || "",
    servedDrink?.name || "",
    newlyExposedClue ? "破绽 卧底 口供" : "",
  ]);
  state.unlockedLoreIds = loreScan.nextUnlockedIds;
  if (loreScan.newlyUnlockedEntries.length > 0) {
    grantRpgXp(state, loreScan.newlyUnlockedEntries.length * 6);
    const firstTitle = loreScan.newlyUnlockedEntries[0].title;
    const extraCount = loreScan.newlyUnlockedEntries.length;
    const loreBanner =
      extraCount > 1
        ? `废土档案新收录《${firstTitle}》等 ${extraCount} 篇`
        : `废土档案新收录：《${firstTitle}》`;
    ruleNotes.push(loreBanner);
    worldMutation = `${worldMutation}；${loreBanner}`;
    systemBanner = systemBanner ? `${systemBanner} · ${loreBanner}` : loreBanner;
  }

  const logEntry: RuleValidationLog = {
    id: uid("rule"),
    day: state.day,
    timestamp: nowTimeLabel(),
    npcId,
    npcName: profile.name,
    provider: llmTurn.provider,
    modelName: llmTurn.modelName,
    rawProposedAction: llmTurn.proposedAction,
    quantifiedBefore: snapshotBefore,
    quantifiedAfter: {
      trust: npc.trust,
      intoxication: npc.intoxication,
      tension: npc.tension,
      debtCaps: npc.debtCaps,
    },
    ruleCheckSummary:
      ruleNotes.length > 0
        ? `${ruleCheckSummary}（规则修正：${ruleNotes.join("，")}）`
        : ruleCheckSummary,
    passedValidation,
    enforcedOutcome,
    worldMutation,
  };

  state.ruleLogs = [logEntry, ...state.ruleLogs].slice(0, 30);

  state.dialogueHistory = [
    ...state.dialogueHistory,
    {
      id: uid("dlg"),
      speaker: "NPC",
      speakerName: `${profile.name} · ${llmTurn.moodLabel || "落座"}`,
      text: llmTurn.dialogue,
      subtext: llmTurn.innerThought,
      timestamp: nowTimeLabel(),
    },
  ];

  if (servedDrink) {
    state.currentTurnServedDrink = true;
  }

  return {
    nextState: state,
    patronFinishedTurn,
    systemBanner,
  };
}

/**
 * 老板处理吧台实体收款情报签收单 / 议价 / 赊账 / 冲突 / 委托（含 2d6 属性掷骰检定）
 */
export function resolvePendingOfferChoice(
  prevState: CampaignSaveState,
  accept: boolean,
  diceMode?: "PRIMARY_DICE" | "ALT_DICE"
): { nextState: CampaignSaveState; banner: string } {
  if (!prevState.pendingOffer) {
    return { nextState: prevState, banner: "" };
  }
  const state: CampaignSaveState = structuredClone(prevState);
  const rpg = ensureRpgState(state);
  state.deckCards = getNormalizedDeckCards(state);
  const offer = state.pendingOffer!;
  const npc = state.npcs[offer.npcId];
  const profile = resolveNpcProfile(state, offer.npcId);
  state.pendingOffer = null;

  const hasIronBarkeep = rpg.unlockedPerks.includes("perk_iron_barkeep");
  let banner = "";

  // 1. 吧台中央「瓶盖与情报实体签收单」确认入账
  if (offer.type === "SETTLEMENT_RECEIPT") {
    const baseCaps = offer.offeredCaps || 0;
    const tipCaps = offer.tipCaps || 0;
    const debtCaps = offer.repaidDebtCaps || 0;
    const totalCaps = baseCaps + tipCaps + debtCaps;

    state.caps += totalCaps;
    state.todayLedger.capsEarned += totalCaps;
    if (offer.suggestedPrice > 0 || state.currentTurnServedDrink) {
      state.todayLedger.patronsServed += 1;
      state.havenReputation += 4;
    }

    const parts: string[] = [];
    if (totalCaps > 0) {
      parts.push(
        `实收 +${totalCaps} 瓶盖${
          debtCaps > 0 ? `（含归还旧债 ${debtCaps} 盖）` : tipCaps > 0 ? `（含小费 ${tipCaps} 盖）` : ""
        }`
      );
    }

    if (debtCaps > 0) {
      npc.debtCaps = 0;
      state.havenReputation += 5;
      npc.memories.push({
        day: state.day,
        impactTag: "守信还债",
        summary: `在吧台亲手结清并连本带利奉还 ${debtCaps} 枚瓶盖旧账。`,
      });
    }

    if (offer.weakenedBossNote) {
      state.nightBossWeakened = true;
      state.todayLedger.intelUnlocked.push("极寒核芯巨钳兽甲壳弱点（生命-20%）");
      parts.push("点亮【首领弱点情报】");
    }

    if (offer.intelUnlockedNote) {
      npc.intelSharedToday = true;
      state.nightIntelUnlocked = true;
      state.nightIntelPatronName = profile.name;
      state.havenReputation += 6;
      state.todayLedger.intelUnlocked.push(offer.intelUnlockedNote);
      parts.push("解锁【隐藏医药冷藏室】暗号");
    }

    if (offer.giftCardDefId && !npc.unlockedCardGiven) {
      npc.unlockedCardGiven = true;
      addCardToCampaignDeck(state, offer.giftCardDefId, false);
      state.havenReputation += 10;
      if (!state.nightCompanion) {
        state.nightCompanion = buildNightCompanionFromProfile(profile);
      }
      const cName =
        offer.giftCardName ||
        CARD_LIBRARY[offer.giftCardDefId]?.name ||
        "专属战术卡";
      state.todayLedger.notableEvents.push(
        `${profile.name}赠予专属信物卡《${cName}》`
      );
      pushTavernRumor(state, {
        day: state.day,
        title: `${profile.name}把看家信物留在了吧台`,
        detail: "熟客把保命装备托付给掌柜，荒原人都传这家酒馆最讲生死交情。",
        tone: "WARM",
        trustMod: 6,
        tensionMod: -4,
        remainingDays: 3,
        nightBonus: null,
      });
      parts.push(`获赠卡牌《${cName}》`);
    }

    if (debtCaps === 0) {
      npc.memories.push({
        day: state.day,
        impactTag: offer.giftCardDefId
          ? "托付信物"
          : offer.intelUnlockedNote
          ? "透露密道"
          : "痛快结账",
        summary: `在吧台签收结清 ${totalCaps} 枚瓶盖${
          offer.intelUnlockedNote ? "并留下废墟密道暗号" : ""
        }。`,
      });
    }

    const xpGain = offer.xpReward || 16;
    const xpRes = grantRpgXp(state, xpGain);
    parts.push(`+${xpGain} XP${xpRes.leveledUp ? `（升至 LV.${xpRes.newLevel}！）` : ""}`);

    banner = `已清点入账：${parts.join(" · ")}`;
    return { nextState: state, banner };
  }

  // 2. 专属夜间委托单
  if (offer.type === "COMMISSION_OFFER") {
    const drinkPay = offer.suggestedPrice || 0;
    if (drinkPay > 0) {
      state.caps += drinkPay;
      state.todayLedger.capsEarned += drinkPay;
      state.todayLedger.patronsServed += 1;
    }
    const xpRes = grantRpgXp(state, offer.xpReward || 18);

    if (accept) {
      state.activeCommission = {
        id: uid("comm"),
        npcId: offer.npcId,
        npcName: profile.name,
        title: offer.commissionTitle || `${profile.name}的夜探委托`,
        objective:
          offer.commissionObjective || "潜入废墟建筑顶层取回指定委托物。",
        rewardCaps: offer.offeredCaps || 22,
        completed: false,
      };
      npc.trust = clamp(npc.trust + 8, 0, 100);
      state.todayLedger.notableEvents.push(
        `接下${profile.name}的夜间委托《${state.activeCommission.title}》`
      );
      npc.memories.push({
        day: state.day,
        impactTag: "托付私活",
        summary: `将夜间委托《${state.activeCommission.title}》交给酒馆老板代办。`,
      });
      banner = `已签收${drinkPay > 0 ? `酒钱 +${drinkPay} 盖并` : ""}接下委托《${
        state.activeCommission.title
      }》 · 今晚废墟顶层已刷出目标箱${
        xpRes.leveledUp ? ` · 升至 LV.${xpRes.newLevel}！` : ""
      }`;
    } else {
      banner = `${
        drinkPay > 0 ? `已收下酒钱 +${drinkPay} 盖，` : ""
      }婉拒了 ${profile.name} 的夜间私活委托`;
    }
    return { nextState: state, banner };
  }

  // 3. 吧台讲价（支持 2d6 + 口才 检定）
  if (offer.type === "BARGAIN") {
    if (diceMode === "PRIMARY_DICE" && offer.diceOption) {
      const roll = roll2d6AttributeCheck(
        rpg,
        offer.diceOption.attr,
        offer.diceOption.dc,
        "吧台巧舌溢价检定"
      );
      if (roll.success) {
        const fullPlusTip = offer.suggestedPrice + 2;
        state.caps += fullPlusTip;
        state.todayLedger.capsEarned += fullPlusTip;
        state.todayLedger.patronsServed += 1;
        npc.trust = clamp(npc.trust + 6, 0, 100);
        npc.tension = clamp(npc.tension - 6, 0, 100);
        state.havenReputation += 6;
        const xpGain = 22 + (hasIronBarkeep ? 10 : 0);
        const xpRes = grantRpgXp(state, xpGain);
        npc.memories.push({
          day: state.day,
          impactTag: "折服买单",
          summary: `被掌柜一番妙语说服，痛快掏出 ${fullPlusTip} 枚瓶盖全价带小费买单。`,
        });
        banner = `${roll.summary} → 入账 +${fullPlusTip} 瓶盖 · +${xpGain} XP${
          xpRes.leveledUp ? `（升至 LV.${xpRes.newLevel}！）` : ""
        }`;
      } else {
        state.caps += offer.offeredCaps;
        state.todayLedger.capsEarned += offer.offeredCaps;
        state.todayLedger.patronsServed += 1;
        npc.tension = clamp(npc.tension + 5, 0, 100);
        grantRpgXp(state, 10);
        banner = `${roll.summary} → 只好按对方出价收下 +${offer.offeredCaps} 瓶盖（+10 XP）`;
      }
      return { nextState: state, banner };
    }

    const xpRes = grantRpgXp(state, 14);
    if (accept) {
      state.caps += offer.offeredCaps;
      state.todayLedger.capsEarned += offer.offeredCaps;
      state.todayLedger.patronsServed += 1;
      npc.trust = clamp(npc.trust + 8, 0, 100);
      npc.tension = clamp(npc.tension - 6, 0, 100);
      state.havenReputation += 5;
      npc.memories.push({
        day: state.day,
        impactTag: "让利成交",
        summary: `老板爽快抹去零头，只收 ${offer.offeredCaps} 枚瓶盖成交，心里记下一份人情。`,
      });
      banner = `让利签收：入账 +${offer.offeredCaps} 瓶盖 · ${profile.name}信任 +8${
        xpRes.leveledUp ? ` · 升至 LV.${xpRes.newLevel}！` : ""
      }`;
    } else if (npc.trust >= 45) {
      state.caps += offer.suggestedPrice;
      state.todayLedger.capsEarned += offer.suggestedPrice;
      state.todayLedger.patronsServed += 1;
      npc.trust = clamp(npc.trust - 3, 0, 100);
      npc.tension = clamp(npc.tension + 6, 0, 100);
      npc.memories.push({
        day: state.day,
        impactTag: "一分不让",
        summary: `砍价被老板回绝，最终按原价掏了 ${offer.suggestedPrice} 枚瓶盖。`,
      });
      banner = `坚持原价入账：+${offer.suggestedPrice} 瓶盖 · ${profile.name}信任微降`;
    } else {
      const partial = offer.offeredCaps;
      state.caps += partial;
      state.todayLedger.capsEarned += partial;
      state.todayLedger.patronsServed += 1;
      npc.trust = clamp(npc.trust - 7, 0, 100);
      npc.tension = clamp(npc.tension + 14, 0, 100);
      npc.memories.push({
        day: state.day,
        impactTag: "砍价不欢",
        summary: `口袋见底还被硬催原价，丢下仅有的 ${partial} 枚瓶盖闷闷离去。`,
      });
      banner = `${profile.name}丢下 ${partial} 瓶盖不悦离开 · 张力 +14`;
    }
    return { nextState: state, banner };
  }

  // 4. 请求赊账
  if (offer.type === "ASK_CREDIT") {
    const xpRes = grantRpgXp(state, 15);
    if (accept) {
      npc.debtCaps += offer.suggestedPrice;
      state.todayLedger.capsCreditIssued += offer.suggestedPrice;
      state.todayLedger.patronsServed += 1;
      npc.trust = clamp(npc.trust + 14, 0, 100);
      npc.tension = clamp(npc.tension - 10, 0, 100);
      state.havenReputation += 8;
      pushTavernRumor(state, {
        day: state.day,
        title: "掌柜肯给落难客记账救急",
        detail: `${profile.name}囊中羞涩获准赊账，荒原人传言这家吧台有人情味。`,
        tone: "WARM",
        trustMod: 5,
        tensionMod: -3,
        remainingDays: 2,
        nightBonus: null,
      });
      npc.memories.push({
        day: state.day,
        impactTag: "赊账立据",
        summary: `窘迫时获准赊账 ${offer.suggestedPrice} 枚瓶盖，暗下决心改日连本带利偿还。`,
      });
      banner = `准许记入赊账本（+${offer.suggestedPrice} 盖待还） · ${profile.name}信任 +14${
        xpRes.leveledUp ? ` · 升至 LV.${xpRes.newLevel}！` : ""
      }`;
    } else {
      npc.trust = clamp(npc.trust - 12, 0, 100);
      npc.tension = clamp(npc.tension + 18, 0, 100);
      state.havenReputation = Math.max(0, state.havenReputation - 3);
      state.todayLedger.patronsServed += 1;
      npc.memories.push({
        day: state.day,
        impactTag: "拒赊冷遇",
        summary: "囊中羞涩求赊一杯酒却被当面回绝，倍感难堪。",
      });
      banner = `婉拒赊账：未收到瓶盖 · ${profile.name}信任 -12 / 张力 +18`;
    }
    return { nextState: state, banner };
  }

  // 5. 吧台高张力闹事冲突（支持 2d6 + 力量 / 敏捷 检定！）
  if (offer.type === "BRAWL_CRISIS") {
    const chosenDice =
      diceMode === "PRIMARY_DICE"
        ? offer.diceOption
        : diceMode === "ALT_DICE"
        ? offer.altDiceOption
        : undefined;

    if (chosenDice) {
      const roll = roll2d6AttributeCheck(
        rpg,
        chosenDice.attr,
        chosenDice.dc,
        chosenDice.label
      );
      state.todayLedger.patronsServed += 1;
      if (roll.success) {
        const fineCaps = Math.max(8, offer.suggestedPrice);
        state.caps += fineCaps;
        state.todayLedger.capsEarned += fineCaps;
        npc.tension = clamp(npc.tension - 42, 0, 100);
        npc.trust = clamp(npc.trust + 4, 0, 100);
        state.havenReputation += 8;
        const xpGain = 26 + (hasIronBarkeep ? 10 : 0);
        const xpRes = grantRpgXp(state, xpGain);
        pushTavernRumor(state, {
          day: state.day,
          title: "吧台掌柜露了一手硬功夫镇住全场",
          detail: `${profile.name}刚想掀桌就被掌柜干净利落按住，乖乖赔了酒钱，无人敢造次！`,
          tone: "CUNNING",
          trustMod: 3,
          tensionMod: -8,
          remainingDays: 2,
          nightBonus: null,
        });
        npc.memories.push({
          day: state.day,
          impactTag: "折服赔礼",
          summary: `在吧台冲动闹事被掌柜当场制住，心服口服留下 ${fineCaps} 枚瓶盖赔罪。`,
        });
        banner = `${roll.summary} → 免损耐久且无伏击，赔付 +${fineCaps} 盖 · +${xpGain} XP${
          xpRes.leveledUp ? `（升至 LV.${xpRes.newLevel}！）` : ""
        }`;
      } else {
        state.tavernSecurity = clamp(state.tavernSecurity - 10, 0, 100);
        state.playerHp = Math.max(10, state.playerHp - 5);
        state.nightAmbushTriggered = true;
        state.nightAmbushPatronName = profile.name;
        state.todayLedger.ambushTriggeredBy.push(profile.name);
        grantRpgXp(state, 10);
        banner = `${roll.summary} → 扭打擦伤生命 -5、酒馆耐久 -10，今晚留意废墟报复伏击！`;
      }
      return { nextState: state, banner };
    }

    grantRpgXp(state, 14);
    if (accept) {
      npc.tension = clamp(npc.tension - 32, 0, 100);
      npc.trust = clamp(npc.trust + 5, 0, 100);
      state.havenReputation += 4;
      state.todayLedger.patronsServed += 1;
      npc.memories.push({
        day: state.day,
        impactTag: "免单熄火",
        summary: "险些在吧台拔枪翻脸，幸得老板大度免单给台阶下，火气消了大半。",
      });
      banner = `免单化解冲突：成功压下 ${profile.name} 的火气（张力 -32）`;
    } else {
      state.tavernSecurity = clamp(state.tavernSecurity - 15, 0, 100);
      npc.trust = clamp(npc.trust - 18, 0, 100);
      state.nightAmbushTriggered = true;
      state.nightAmbushPatronName = profile.name;
      state.todayLedger.ambushTriggeredBy.push(profile.name);
      state.todayLedger.patronsServed += 1;
      pushTavernRumor(state, {
        day: state.day,
        title: "酒馆掌柜铁腕轰出闹事客",
        detail: `${profile.name}掀桌未成反被轰出门外，刺头收敛不少，但暗巷结下了梁子。`,
        tone: "RUTHLESS",
        trustMod: -2,
        tensionMod: -8,
        remainingDays: 2,
        nightBonus: null,
      });
      npc.memories.push({
        day: state.day,
        impactTag: "拔枪结怨",
        summary: "在吧台闹事被强硬轰出门外，摔碎了两只酒瓶，怀恨在心。",
      });
      banner = `强行轰出闹事客：酒馆耐久 -15 · 警告：今晚黑夜废墟将遭遇报复伏击！`;
    }
  }

  return { nextState: state, banner };
}

/**
 * 侦探酒保抓获破绽后的「三向摊牌裁决」
 */
export function resolveShowdownVerdict(
  prevState: CampaignSaveState,
  npcId: NpcId,
  choice: ShowdownVerdictChoice
): { nextState: CampaignSaveState; banner: string } {
  const state = structuredClone(prevState);
  ensureRpgState(state);
  const profile = resolveNpcProfile(state, npcId);
  const npc = state.npcs[npcId];
  if (!npc || !npc.clueExposed || npc.showdownResolved) {
    return { nextState: prevState, banner: "" };
  }

  const agenda = profile.secretAgenda;
  const bountyCaps = agenda?.bountyCaps || 25;
  const hushCaps = agenda?.hushCaps || 18;
  const before = {
    trust: npc.trust,
    intoxication: npc.intoxication,
    tension: npc.tension,
    debtCaps: npc.debtCaps,
  };

  npc.showdownResolved = choice;
  state.pendingOffer = null;
  if (!state.currentTurnServedDrink) {
    state.currentTurnServedDrink = true;
    state.todayLedger.patronsServed += 1;
  }

  const xpRes = grantRpgXp(state, 28);
  const lvNote = xpRes.leveledUp ? ` · 升至 LV.${xpRes.newLevel}！` : "";

  let banner = "";
  let outcomeText = "";
  let worldMutation = "";

  if (choice === "EXPOSE_BOUNTY") {
    state.caps += bountyCaps;
    state.todayLedger.capsEarned += bountyCaps;
    state.tavernSecurity = clamp(state.tavernSecurity + 8, 0, 100);
    npc.trust = clamp(npc.trust - 30, 0, 100);
    npc.tension = clamp(npc.tension + 20, 0, 100);
    state.nightHitmanTriggered = true;
    state.nightHitmanSponsor = profile.name;
    state.todayLedger.ambushTriggeredBy.push(`${profile.name}幕后买凶`);
    state.todayLedger.notableEvents.push(
      `当面拆穿${profile.name}真身（${agenda?.trueIdentity}），领赏 +${bountyCaps} 盖`
    );
    pushTavernRumor(state, {
      day: state.day,
      title: "掌柜眼毒手狠·当场拆穿潜伏者领赏",
      detail: `${profile.name}在吧台酒后失言被当场戳破真身，各方暗探进门无不胆寒，但幕后势力已买凶报复！`,
      tone: "RUTHLESS",
      trustMod: -3,
      tensionMod: -10,
      remainingDays: 3,
      nightBonus: null,
    });
    npc.memories.push({
      day: state.day,
      impactTag: "拆穿举报",
      summary: `酒后失言被掌柜当面识破「${agenda?.trueIdentity}」真身并驱逐领赏，结下死仇。`,
    });
    banner = `当面拆穿领赏 +${bountyCaps} 瓶盖 · +28 XP${lvNote} · 警报：今晚废墟将遭遇买凶杀手！`;
    outcomeText = `拍出电报当面拆穿${profile.name}，兑现悬赏 +${bountyCaps} 瓶盖`;
    worldMutation = `瓶盖 +${bountyCaps} · 安全耐久 +8 · 触发黑夜[买凶清算猎手]精英巡逻`;
  } else if (choice === "BLACKMAIL_SHELTER") {
    state.caps += hushCaps;
    state.todayLedger.capsEarned += hushCaps;
    npc.trust = clamp(npc.trust + 18, 0, 100);
    npc.tension = clamp(npc.tension - 16, 0, 100);
    state.havenReputation += 8;
    state.nightCompanion = buildNightCompanionFromProfile(profile);
    if (!state.activeCommission) {
      state.activeCommission = {
        id: uid("comm"),
        npcId,
        npcName: profile.name,
        title: agenda?.commissionTitle || `${profile.name}的封口善后委托`,
        objective:
          agenda?.commissionDesc || "潜入黑夜废墟顶层替其抹除追踪首尾。",
        rewardCaps: 22,
        completed: false,
      };
    }
    state.todayLedger.notableEvents.push(
      `收下${profile.name}封口费 +${hushCaps} 盖并包庇秘密，结成夜探同盟`
    );
    pushTavernRumor(state, {
      day: state.day,
      title: "铁皮吧台守口如瓶·暗夜客的避风港",
      detail: "道上盛传只要付足规矩钱，酒馆掌柜连天大的秘密都替你烂在肚子里。",
      tone: "WARM",
      trustMod: 7,
      tensionMod: -5,
      remainingDays: 3,
      nightBonus: null,
    });
    npc.memories.push({
      day: state.day,
      impactTag: "收钱遮掩",
      summary: `奉上 ${hushCaps} 枚瓶盖封口费换得老板替其抹去行踪，主动答应今晚同行助战。`,
    });
    banner = `收下封口费 +${hushCaps} 盖 · 「${profile.name}」加入今夜助战席 · +28 XP${lvNote}`;
    outcomeText = `收下 ${hushCaps} 瓶盖封口费替其遮掩真身，结为夜间助战盟友`;
    worldMutation = `瓶盖 +${hushCaps} · 信任 +18 · 激活夜探伙伴[${profile.name}]与专属委托`;
  } else {
    const tipCaps = 10;
    state.caps += tipCaps;
    state.todayLedger.capsEarned += tipCaps;
    state.nightBossWeakened = true;
    state.nightTrapCacheUnlocked = true;
    state.havenReputation += 10;
    npc.tension = clamp(npc.tension - 10, 0, 100);
    state.todayLedger.intelUnlocked.push(`设局假情报诱敌（削弱首领+诱敌战利品箱）`);
    pushTavernRumor(state, {
      day: state.day,
      title: "假坐标设局·外路密探栽进废墟辐射坑",
      detail: "听说有暗探在吧台套话反被掌柜用假坐标引去替死鬼路线，常客们暗暗叫绝。",
      tone: "CUNNING",
      trustMod: 5,
      tensionMod: -6,
      remainingDays: 3,
      nightBonus: "LOOT",
    });
    npc.memories.push({
      day: state.day,
      impactTag: "顺水设局",
      summary: "揣着老板故意透露的假废墟坐标钻进了盲区，留下整箱补给。",
    });
    banner = `顺水推舟喂假情报！酒钱 +${tipCaps} 盖 · 解锁「诱敌遗落箱」且首领削弱 20% · +28 XP${lvNote}`;
    outcomeText = `看破不说破，故意喂给${profile.name}假坐标引其去消耗废墟守卫`;
    worldMutation = `瓶盖 +${tipCaps} · 解锁1F[假坐标诱敌箱] · 核芯首领HP削减20%`;
  }

  state.ruleLogs = [
    {
      id: uid("rule"),
      day: state.day,
      timestamp: nowTimeLabel(),
      npcId,
      npcName: profile.name,
      provider: "detective-verdict",
      modelName: "三向摊牌规则引擎",
      rawProposedAction: choice,
      quantifiedBefore: before,
      quantifiedAfter: {
        trust: npc.trust,
        intoxication: npc.intoxication,
        tension: npc.tension,
        debtCaps: npc.debtCaps,
      },
      ruleCheckSummary: `口供破绽已抓获（${npc.exposedClueNote}），执行掌柜裁决：${choice}`,
      passedValidation: true,
      enforcedOutcome: outcomeText,
      worldMutation,
    },
    ...state.ruleLogs,
  ].slice(0, 30);

  state.dialogueHistory = [
    ...state.dialogueHistory,
    {
      id: uid("sys_verdict"),
      speaker: "SYSTEM",
      speakerName: "侦探裁决卷宗",
      text: `${outcomeText} —— ${banner}`,
      timestamp: nowTimeLabel(),
    },
  ];

  return { nextState: state, banner };
}

export function seedActiveRumor(
  prevState: CampaignSaveState,
  npcId: NpcId,
  templateId: string
): { nextState: CampaignSaveState; banner: string } {
  const state = structuredClone(prevState);
  const rpg = ensureRpgState(state);
  const npc = state.npcs[npcId];
  const profile = resolveNpcProfile(state, npcId);
  const tpl = RUMOR_SEED_TEMPLATES.find((t) => t.id === templateId);
  if (!npc || !tpl || npc.rumorSeededToday) {
    return { nextState: prevState, banner: "" };
  }

  const chaDiscount = Math.max(0, (rpg.attributes.CHA || 2) - 2);
  const freeTrustThreshold = Math.max(38, 50 - chaDiscount * 4);
  const isFree = npc.trust >= freeTrustThreshold;
  const cost = isFree ? 0 : Math.max(2, 6 - chaDiscount * 2);
  if (state.caps < cost) {
    return { nextState: prevState, banner: `瓶盖不足 ${cost} 枚，无法塞润喉费托人放风` };
  }

  state.caps -= cost;
  npc.rumorSeededToday = true;
  npc.trust = clamp(npc.trust + 3, 0, 100);
  grantRpgXp(state, 10);

  pushTavernRumor(state, {
    day: state.day,
    title: tpl.title,
    detail: `由「${profile.name}」替你在荒原散出风声：${tpl.detail}`,
    tone: tpl.tone,
    trustMod: tpl.trustMod,
    tensionMod: tpl.tensionMod,
    remainingDays: 3,
    nightBonus: tpl.nightBonus,
  });

  const banner = `已托「${profile.name}」散播口风《${tpl.title}》${
    cost > 0 ? `（润喉费 -${cost} 瓶盖）` : "（魅力/熟客免费帮忙）"
  } · +10 XP`;

  state.dialogueHistory = [
    ...state.dialogueHistory,
    {
      id: uid("sys_rumor"),
      speaker: "SYSTEM",
      speakerName: "流言风评板",
      text: banner,
      timestamp: nowTimeLabel(),
    },
  ];

  return { nextState: state, banner };
}

export function inviteNightCompanion(
  prevState: CampaignSaveState,
  npcId: NpcId
): { nextState: CampaignSaveState; banner: string } {
  const state = structuredClone(prevState);
  const rpg = ensureRpgState(state);
  const npc = state.npcs[npcId];
  const profile = resolveNpcProfile(state, npcId);
  const requiredTrust = Math.max(43, 55 - Math.max(0, (rpg.attributes.CHA || 2) - 2) * 4);

  if (!npc || npc.trust < requiredTrust) {
    return {
      nextState: prevState,
      banner: `信任度需达到 ${requiredTrust} 以上（魅力可降低门槛），客人才肯冒险陪你夜闯废墟`,
    };
  }

  state.nightCompanion = buildNightCompanionFromProfile(profile);
  let commBanner = "";
  if (!state.activeCommission && profile.secretAgenda?.commissionTitle) {
    state.activeCommission = {
      id: uid("comm"),
      npcId,
      npcName: profile.name,
      title: profile.secretAgenda.commissionTitle,
      objective:
        profile.secretAgenda.commissionDesc ||
        "前往黑夜废墟建筑顶层完成常客专属委托。",
      rewardCaps: 22,
      completed: false,
    };
    commBanner = `，并同步点亮委托《${state.activeCommission.title}》`;
  }

  const banner = `已签约「${profile.name}」进入今夜助战席（伙伴技：${state.nightCompanion.skillName}）${commBanner}`;
  return { nextState: state, banner };
}

// ==================== 黑夜：城市废墟选点 + 三层横版实操探索 + 四流派 Combo 牌局 ====================

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function rollScavengedIngredients(
  count: number,
  rareBoost = false
): Record<IngredientId, number> {
  const bag = emptyIngredientBag();
  const pool: IngredientId[] = rareBoost
    ? [
        "glow_shroom",
        "calm_herb",
        "cryo_mint",
        "glow_shroom",
        "cryo_mint",
        "mutant_potato",
        "rust_malt",
      ]
    : [
        "rad_water",
        "mutant_potato",
        "rust_malt",
        "rad_water",
        "mutant_potato",
        "glow_shroom",
        "calm_herb",
      ];

  for (let i = 0; i < count; i++) {
    const picked = pool[Math.floor(Math.random() * pool.length)];
    bag[picked] += 1;
  }
  return bag;
}

export function mergeLootBags(
  a: Record<IngredientId, number>,
  b: Record<IngredientId, number>
): Record<IngredientId, number> {
  const out = { ...a };
  (Object.keys(b) as IngredientId[]).forEach((k) => {
    out[k] = (out[k] || 0) + (b[k] || 0);
  });
  return out;
}

export function rollDraftCardOptions(
  state: CampaignSaveState,
  count = 3,
  highRarityBias = false
): DraftCardOption[] {
  const rpg = ensureRpgState(state);
  const cha = rpg.attributes.CHA || 2;
  const hasBlackmarketEye = rpg.unlockedPerks.includes("perk_blackmarket_eye");
  const upgradeChance =
    (hasBlackmarketEye ? 0.55 : 0.14) + Math.max(0, cha - 2) * 0.08 + (highRarityBias ? 0.15 : 0);

  const pool = highRarityBias
    ? [
        ...REWARD_CARD_POOL,
        ...REWARD_CARD_POOL.filter((id) => COMBO_CARD_LIBRARY[id]?.rarity === "rare"),
      ]
    : REWARD_CARD_POOL;

  const uniquePicked: string[] = [];
  const shuffled = shuffle(pool);
  for (const id of shuffled) {
    if (!uniquePicked.includes(id)) {
      uniquePicked.push(id);
      if (uniquePicked.length >= count) break;
    }
  }

  return uniquePicked.map((defId) => ({
    defId,
    upgraded: Math.random() < upgradeChance,
  }));
}

export function createNightRunState(campaign: CampaignSaveState): NightRunState {
  const defaultLoc: CityLocationId = campaign.nightIntelUnlocked
    ? "shelled_clinic"
    : campaign.activeCommission
    ? "scrap_shipyard"
    : "ruined_mart";

  const legacyNodes: RuinMapNode[] = [];

  return {
    currentFloor: 1,
    nodes: legacyNodes,
    activeNodeId: null,
    nodeMode: "CITY_MAP",
    selectedLocationId: defaultLoc,
    building: null,
    activePatrolId: null,
    ambushAdvantage: false,
    persuadeAttemptedThisCombat: false,
    turn: 1,
    energy: 3,
    maxEnergy: 3,
    playerBlock: 0,
    comboCount: 0,
    retainBlockTurns: 0,
    thorns: 0,
    gadgetTurretDmg: 0,
    gadgetsPlayedCount: 0,
    xpEarnedThisRun: 0,
    cardsCollectedThisRun: [],
    drawPile: [],
    hand: [],
    discardPile: [],
    exhaustPile: [],
    enemies: [],
    combatLog: [],
    lootBag: emptyIngredientBag(),
    capsLooted: 0,
    cardChoices: [],
    draftOptions: [],
    summaryNote: "",
    companion: campaign.nightCompanion || null,
  };
}

/**
 * 阶段一：在类《这是我的战争》城市废墟总览大地图选定据点，生成三层横版建筑剖面！
 */
export function selectNightCityLocation(
  prevState: CampaignSaveState,
  locationId: CityLocationId
): CampaignSaveState {
  if (!prevState.nightRun) return prevState;
  const state = structuredClone(prevState);
  ensureRpgState(state);
  const run = state.nightRun!;
  run.selectedLocationId = locationId;
  run.building = createCutawayBuildingForLocation(state, locationId);
  run.currentFloor = 1;
  run.nodeMode = "BUILDING_EXPLORE";
  return state;
}

function instantiateEnemy(
  templateId: string,
  day: number,
  weakenedBoss = false
): ActiveEnemy {
  const tpl = ENEMY_TEMPLATES[templateId] || ENEMY_TEMPLATES.ash_rats;
  const dayScale = 1 + (day - 1) * 0.08;
  const scaledHp = Math.round(
    tpl.maxHp * dayScale * (weakenedBoss && tpl.isBoss ? 0.8 : 1)
  );
  return {
    uid: uid("enemy"),
    templateId: tpl.id,
    name: tpl.name,
    subtitle: tpl.subtitle,
    hp: scaledHp,
    maxHp: scaledHp,
    block: 0,
    attackDebuff: 0,
    radStacks: 0,
    markedTurns: 0,
    isHuman: Boolean(tpl.isHuman),
    intentIndex: 0,
    currentIntent: tpl.intents[0],
    lootCount: tpl.lootCount,
    capReward: tpl.capReward,
    xpReward: tpl.xpReward || 20,
  };
}

export function drawCardsFromPile(
  run: NightRunState,
  count: number
): NightRunState {
  const next = structuredClone(run);
  for (let i = 0; i < count; i++) {
    if (next.hand.length >= 9) break;
    if (next.drawPile.length === 0) {
      if (next.discardPile.length === 0) break;
      next.drawPile = shuffle(next.discardPile);
      next.discardPile = [];
    }
    const popped = next.drawPile.pop();
    if (popped) {
      next.hand.push(popped);
    }
  }
  return next;
}

/**
 * 从横版建筑遭遇巡逻敌人（区分正面遭遇 vs 绕后先手偷袭！）进入四流派卡牌肉鸽战斗
 */
export function startBuildingPatrolCombat(
  prevState: CampaignSaveState,
  patrolId: string,
  isBackstab: boolean
): CampaignSaveState {
  if (!prevState.nightRun || !prevState.nightRun.building) return prevState;
  const state = structuredClone(prevState);
  const rpg = ensureRpgState(state);
  const deckEntries = getNormalizedDeckCards(state);
  const run = state.nightRun!;
  const building = run.building!;
  const patrol = building.patrols.find((p) => p.id === patrolId && !p.defeated);
  if (!patrol) return prevState;

  building.playerFloor = patrol.floor;
  building.playerX = clamp(
    isBackstab
      ? patrol.facing === "right"
        ? patrol.x - 5
        : patrol.x + 5
      : patrol.x - 6,
    8,
    92
  );

  const deckInstances: CardInstance[] = shuffle(
    deckEntries.map((entry) => ({
      uid: uid("card"),
      defId: entry.defId,
      upgraded: entry.upgraded,
    }))
  );

  const agiBlockBonus = Math.max(0, (rpg.attributes.AGI || 2) - 2) * 2;
  const perkStartBlock = rpg.unlockedPerks.includes("perk_scrap_barricade")
    ? 6
    : 0;
  const perkLeaderEnergy =
    rpg.unlockedPerks.includes("perk_inspirational") && run.companion ? 1 : 0;

  run.activePatrolId = patrol.id;
  run.ambushAdvantage = isBackstab;
  run.persuadeAttemptedThisCombat = false;
  run.nodeMode = "COMBAT";
  run.turn = 1;
  run.energy = run.maxEnergy + (isBackstab ? 1 : 0) + perkLeaderEnergy;
  run.playerBlock = agiBlockBonus + perkStartBlock;
  run.comboCount = isBackstab ? 1 : 0;
  run.retainBlockTurns = 0;
  run.thorns = 0;
  run.gadgetTurretDmg = 0;
  run.gadgetsPlayedCount = 0;
  run.drawPile = deckInstances;
  run.hand = [];
  run.discardPile = [];
  run.exhaustPile = [];
  run.enemies = patrol.enemyIds.map((id) => {
    const e = instantiateEnemy(id, state.day, state.nightBossWeakened);
    if (isBackstab) {
      e.markedTurns = 2;
      e.attackDebuff += 2;
    }
    return e;
  });

  const logs: string[] = [];
  if (isBackstab) {
    logs.push(
      `【绕后先手偷袭】趁「${patrol.name}」背对潜行突袭：首回合能量 +1、连击 +1、多抽 1 张牌，全体敌人挂 2 回合锁定标记且攻击 -2！`
    );
  } else {
    logs.push(
      `遭遇「${patrol.name}」！观察敌方意图，灵活打出枪火连击、重甲盾猛、辐射引爆或 0 费拾荒机关 Combo！`
    );
  }
  if (run.companion) {
    logs.push(
      `同行助战伙伴「${run.companion.name}」已在侧翼就位（每回合结束自动施展「${run.companion.skillName}」）`
    );
  }

  let drawnRun = drawCardsFromPile(run, isBackstab ? 6 : 5);
  if (rpg.unlockedPerks.includes("perk_gadget_tinker") && drawnRun.hand.length < 9) {
    drawnRun.hand.push({
      uid: uid("tok"),
      defId: "token_sawblade_disc",
      upgraded: false,
      isToken: true,
    });
    logs.push("专长《巧手拾荒机关师》触发：首回合手牌塞入 1 张《0费·锯片飞盘》");
  }
  drawnRun.combatLog = logs;
  state.nightRun = drawnRun;
  return state;
}

/**
 * 阶段二：横版建筑内移动角色（键盘 A/D/W/S 或鼠标点击走位爬梯）并驱动巡逻敌兵步进与视野侦测
 */
export function moveAndStepBuildingExplore(
  prevState: CampaignSaveState,
  nextFloor: 1 | 2 | 3,
  nextX: number,
  facing: "left" | "right"
): CampaignSaveState {
  if (
    !prevState.nightRun ||
    prevState.nightRun.nodeMode !== "BUILDING_EXPLORE" ||
    !prevState.nightRun.building
  ) {
    return prevState;
  }
  const state = structuredClone(prevState);
  const rpg = ensureRpgState(state);
  const run = state.nightRun!;
  const b = run.building!;

  const floorChanged = nextFloor !== b.playerFloor;
  b.playerFloor = nextFloor;
  b.playerX = clamp(nextX, 6, 94);
  b.playerFacing = facing;
  run.currentFloor = nextFloor;

  // 巡逻敌兵微幅往返走动（爬梯瞬间不推进敌兵，保证跨层体验顺滑可预期）
  if (!floorChanged) {
    b.patrols.forEach((p) => {
      if (p.defeated) return;
      const step = p.facing === "right" ? 2.5 : -2.5;
      let nx = p.x + step;
      if (nx >= p.maxX) {
        nx = p.maxX;
        p.facing = "left";
      } else if (nx <= p.minX) {
        nx = p.minX;
        p.facing = "right";
      }
      p.x = Math.round(nx * 10) / 10;
    });
  }

  // 检测同楼层未击败敌人的正面视野锥 vs 背后潜行突袭距离
  const agiStealthBonus = Math.max(0, (rpg.attributes.AGI || 2) - 2) * 1.5;
  const frontAlertRange = Math.max(4.5, 7.5 - agiStealthBonus * 0.5);

  for (const p of b.patrols) {
    if (p.defeated || p.floor !== b.playerFloor) continue;
    const dx = b.playerX - p.x;
    const dist = Math.abs(dx);
    const playerInFrontOfEnemy =
      (p.facing === "right" && dx >= -1) || (p.facing === "left" && dx <= 1);

    if (playerInFrontOfEnemy && dist <= frontAlertRange) {
      b.exploreLog = [
        `踏入了「${p.name}」的正面手电警戒视野，触发正面遭遇战！`,
        ...b.exploreLog,
      ].slice(0, 10);
      return startBuildingPatrolCombat(state, p.id, false);
    }
    if (!playerInFrontOfEnemy && dist <= 4.5) {
      b.exploreLog = [
        `悄无声息摸到「${p.name}」背后，成功发动【先手偷袭】！`,
        ...b.exploreLog,
      ].slice(0, 10);
      return startBuildingPatrolCombat(state, p.id, true);
    }
  }

  return state;
}

/**
 * 横版建筑内交互现场设施：翻物资柜、撬重锁武器箱拿新卡、钳工改装台升星、交涉中立幸存者、撤离门返航
 */
export function interactBuildingObject(
  prevState: CampaignSaveState,
  objectId: string
): { nextState: CampaignSaveState; banner: string } {
  if (!prevState.nightRun || !prevState.nightRun.building) {
    return { nextState: prevState, banner: "" };
  }
  const state = structuredClone(prevState);
  const rpg = ensureRpgState(state);
  const run = state.nightRun!;
  const b = run.building!;
  const obj = b.objects.find((o) => o.id === objectId);
  if (!obj || obj.floor !== b.playerFloor) {
    return { nextState: prevState, banner: "请先通过爬梯抵达该设施所在楼层" };
  }

  b.playerFacing = obj.x >= b.playerX ? "right" : "left";
  b.playerX = clamp(obj.x, 7, 92);

  if (obj.kind === "EXIT_DOOR") {
    run.nodeMode = "RUN_COMPLETE";
    run.summaryNote = `你推开「${b.locationName}」一楼防爆撤离门安全返航，背包内所有调酒原料、瓶盖与新搜集卡牌悉数带回酒馆！`;
    return {
      nextState: state,
      banner: "已从防爆门安全撤离废墟！",
    };
  }

  if (obj.kind === "WORKBENCH") {
    run.nodeMode = "WORKBENCH_UPGRADE";
    return {
      nextState: state,
      banner: "已打开废土钳工改装台：可消耗升级点或 3 枚废铁零件将卡牌升至 +1 星",
    };
  }

  if (obj.used) {
    return { nextState: state, banner: "该点位已经搜刮或处理完毕" };
  }

  if (obj.kind === "NEUTRAL_SURVIVOR") {
    b.activeSurvivorId = obj.id;
    run.nodeMode = "SURVIVOR_PARLEY";
    return {
      nextState: state,
      banner: `遇到非敌对幸存者「${obj.survivorName || "拾荒客"}」，可用口才或魅力交涉`,
    };
  }

  if (obj.kind === "LOCKED_WEAPON_CRATE") {
    obj.used = true;
    obj.locked = false;
    const hasAshCrowbar = getNormalizedDeckCards(state).some(
      (c) => c.defId === "sig_ash_crowbar"
    );
    let banner = "";
    if (hasAshCrowbar) {
      grantRpgXp(state, 18);
      b.scrapParts += 1;
      banner = "凭借《阿灰的万能撬棍》免检定无损撬开重锁军火箱！（+18 XP，零件+1）";
    } else {
      const roll = roll2d6AttributeCheck(
        rpg,
        "STR",
        obj.lockDc || 8,
        `撬开${obj.label}`
      );
      if (roll.success) {
        const xpGain = 20 + (rpg.unlockedPerks.includes("perk_iron_barkeep") ? 10 : 0);
        grantRpgXp(state, xpGain);
        b.scrapParts += 1;
        banner = `${roll.summary} → 无损撬开重锁武器箱！（+${xpGain} XP，零件+1）`;
      } else {
        state.playerHp = Math.max(8, state.playerHp - 3);
        grantRpgXp(state, 12);
        banner = `${roll.summary} → 硬砸锁扣擦伤 -3 生命，成功砸开军火箱！（+12 XP）`;
      }
    }
    b.exploreLog = [banner, ...b.exploreLog].slice(0, 10);
    run.draftOptions = rollDraftCardOptions(state, 3, obj.floor === 3);
    run.cardChoices = run.draftOptions.map((d) => d.defId);
    run.nodeMode = "CRATE_CARD_DRAFT";
    return { nextState: state, banner };
  }

  // 常规物资柜 / 熟客暗号冷库 / 假坐标遗落箱 / 委托目标箱
  obj.used = true;
  const rumorLootBoost = computeRumorAggregate(state).hasLootBoost ? 1 : 0;

  if (obj.kind === "INTEL_COLD_VAULT") {
    run.lootBag.glow_shroom += 2;
    run.lootBag.cryo_mint += 2;
    run.lootBag.calm_herb += 1;
    run.capsLooted += 14;
    b.scrapParts += 2;
    const xpRes = grantRpgXp(state, 24);
    const msg = `开启熟客暗号冷库：获得幽光菌菇×2、冰薄荷×2、安神草×1、瓶盖+14、零件+2 · +24 XP${
      xpRes.leveledUp ? `（升至 LV.${xpRes.newLevel}！）` : ""
    }`;
    b.exploreLog = [msg, ...b.exploreLog].slice(0, 10);
    return { nextState: state, banner: msg };
  }

  if (obj.kind === "TRAP_LOOT_CACHE") {
    run.lootBag.cryo_mint += 2;
    run.lootBag.glow_shroom += 1;
    run.lootBag.rust_malt += 2;
    run.capsLooted += 15;
    b.scrapParts += 2;
    const xpRes = grantRpgXp(state, 22);
    const msg = `搬空假坐标诱敌遗落箱：冰薄荷×2、菌菇×1、麦芽×2、瓶盖+15、零件+2 · +22 XP${
      xpRes.leveledUp ? `（升至 LV.${xpRes.newLevel}！）` : ""
    }`;
    b.exploreLog = [msg, ...b.exploreLog].slice(0, 10);
    return { nextState: state, banner: msg };
  }

  if (obj.kind === "COMMISSION_TARGET") {
    if (state.activeCommission) {
      state.activeCommission.completed = true;
    }
    run.capsLooted += 10;
    b.scrapParts += 2;
    const xpRes = grantRpgXp(state, 30);
    const msg = `成功取回专属委托物《${
      state.activeCommission?.title || "目标信物"
    }》！黎明返馆将兑现重酬 · 瓶盖+10、零件+2 · +30 XP${
      xpRes.leveledUp ? `（升至 LV.${xpRes.newLevel}！）` : ""
    }`;
    b.exploreLog = [msg, ...b.exploreLog].slice(0, 10);
    return { nextState: state, banner: msg };
  }

  // SUPPLY_CABINET
  const rareBias =
    obj.floor === 3 ||
    b.locationId === "shelled_clinic" ||
    b.locationId === "cryo_reactor";
  const rolled = rollScavengedIngredients(
    (obj.floor === 3 ? 3 : 2) + rumorLootBoost,
    rareBias
  );
  run.lootBag = mergeLootBags(run.lootBag, rolled);
  const foundCaps = obj.floor === 3 ? 7 : 4;
  run.capsLooted += foundCaps;
  b.scrapParts += 2;
  const xpRes = grantRpgXp(state, 15);
  const itemNames = (Object.keys(rolled) as IngredientId[])
    .filter((k) => rolled[k] > 0)
    .map((k) => `${INGREDIENTS[k].name}×${rolled[k]}`)
    .join("、");
  const msg = `搜翻「${obj.label}」：获得 ${itemNames}、瓶盖+${foundCaps}、改装零件+2 · +15 XP${
    xpRes.leveledUp ? `（升至 LV.${xpRes.newLevel}！）` : ""
  }`;
  b.exploreLog = [msg, ...b.exploreLog].slice(0, 10);
  return { nextState: state, banner: msg };
}

/**
 * 夜晚横版建筑遭遇非敌对幸存者：使用「口才 ELO / 魅力 CHA」掷骰交涉或瓶盖换卡
 */
export function resolveSurvivorParley(
  prevState: CampaignSaveState,
  mode: "ELO_PERSUADE" | "CHA_CHARM" | "CAPS_TRADE" | "LEAVE"
): { nextState: CampaignSaveState; banner: string } {
  if (!prevState.nightRun || !prevState.nightRun.building) {
    return { nextState: prevState, banner: "" };
  }
  const state = structuredClone(prevState);
  const rpg = ensureRpgState(state);
  const run = state.nightRun!;
  const b = run.building!;
  const obj = b.objects.find((o) => o.id === b.activeSurvivorId);

  if (mode === "LEAVE" || !obj) {
    b.activeSurvivorId = null;
    run.nodeMode = "BUILDING_EXPLORE";
    return { nextState: state, banner: "你收起武器向幸存者点头示意，继续探索楼层" };
  }

  const hasIronBarkeep = rpg.unlockedPerks.includes("perk_iron_barkeep");

  if (mode === "CAPS_TRADE") {
    const totalAvailableCaps = state.caps + run.capsLooted;
    if (totalAvailableCaps < 6) {
      return { nextState: prevState, banner: "随身瓶盖不足 6 枚，可尝试口才或魅力交涉" };
    }
    if (run.capsLooted >= 6) {
      run.capsLooted -= 6;
    } else {
      const rem = 6 - run.capsLooted;
      run.capsLooted = 0;
      state.caps -= rem;
    }
    obj.used = true;
    b.activeSurvivorId = null;
    run.lootBag.glow_shroom += 1;
    run.lootBag.calm_herb += 1;
    grantRpgXp(state, 16);
    run.draftOptions = rollDraftCardOptions(state, 3, true);
    run.cardChoices = run.draftOptions.map((d) => d.defId);
    run.nodeMode = "CRATE_CARD_DRAFT";
    const msg = `支付 6 枚瓶盖与「${obj.survivorName}」友好交易：获赠菌菇×1、安神草×1，并任选 1 张战术卡！（+16 XP）`;
    b.exploreLog = [msg, ...b.exploreLog].slice(0, 10);
    return { nextState: state, banner: msg };
  }

  const attr: RpgAttributeKey = mode === "ELO_PERSUADE" ? "ELO" : "CHA";
  const roll = roll2d6AttributeCheck(
    rpg,
    attr,
    9,
    mode === "ELO_PERSUADE" ? "废墟口才安抚交涉" : "废墟魅力折服换礼"
  );
  obj.used = true;
  b.activeSurvivorId = null;

  if (roll.success) {
    const xpGain = 24 + (hasIronBarkeep ? 10 : 0);
    grantRpgXp(state, xpGain);
    if (mode === "ELO_PERSUADE") {
      run.lootBag.glow_shroom += 1;
      run.lootBag.calm_herb += 1;
      b.scrapParts += 2;
    } else {
      run.lootBag.cryo_mint += 1;
      state.playerHp = Math.min(state.playerMaxHp, state.playerHp + 8);
    }
    run.draftOptions = rollDraftCardOptions(state, 3, true).map((opt, idx) => ({
      ...opt,
      upgraded: mode === "CHA_CHARM" ? true : idx === 0 ? true : opt.upgraded,
    }));
    run.cardChoices = run.draftOptions.map((d) => d.defId);
    run.nodeMode = "CRATE_CARD_DRAFT";
    const msg = `${roll.summary} → 幸存者感激地送上珍稀药草，并打开私藏战术卡袋任你挑选！（+${xpGain} XP）`;
    b.exploreLog = [msg, ...b.exploreLog].slice(0, 10);
    return { nextState: state, banner: msg };
  } else {
    run.lootBag.rad_water += 1;
    run.lootBag.mutant_potato += 1;
    grantRpgXp(state, 10);
    run.nodeMode = "BUILDING_EXPLORE";
    const msg = `${roll.summary} → 幸存者仍有戒心，匆匆留下辐射水×1 与土豆×1 后钻入暗道离开（+10 XP）`;
    b.exploreLog = [msg, ...b.exploreLog].slice(0, 10);
    return { nextState: state, banner: msg };
  }
}

export function closeWorkbenchToExplore(
  prevState: CampaignSaveState
): CampaignSaveState {
  if (!prevState.nightRun) return prevState;
  const state = structuredClone(prevState);
  state.nightRun!.nodeMode = "BUILDING_EXPLORE";
  return state;
}

// ==================== 阶段三：四大流派深度 Combo 卡牌战斗引擎 ====================

export function getEffectiveCardCost(
  cardInst: CardInstance,
  run: NightRunState
): number {
  const stats = resolveCardStats(cardInst.defId, cardInst.upgraded);
  let cost = stats.baseCost;
  if (stats.costReducePerCombo) {
    cost = Math.max(0, cost - (run.comboCount || 0));
  }
  return cost;
}

export function enterRuinNode(
  prevState: CampaignSaveState,
  nodeId: string
): CampaignSaveState {
  // 兼容接口：若收到城市据点 ID 直接进入对应横版建筑
  if (
    nodeId === "ruined_mart" ||
    nodeId === "shelled_clinic" ||
    nodeId === "scrap_shipyard" ||
    nodeId === "cryo_reactor"
  ) {
    return selectNightCityLocation(prevState, nodeId);
  }
  return prevState;
}

function finalizeCombatVictoryIfCleared(
  state: CampaignSaveState,
  run: NightRunState,
  logs: string[]
): boolean {
  const hasLootBoost = computeRumorAggregate(state).hasLootBoost;
  run.enemies = run.enemies.filter((e) => {
    if (e.hp <= 0) {
      const drop = rollScavengedIngredients(
        e.lootCount + (hasLootBoost ? 1 : 0),
        e.templateId === "sentry_bot" ||
          e.templateId === "syndicate_hitman" ||
          e.templateId === "beacon_drone" ||
          e.templateId === "frost_claw_boss"
      );
      run.lootBag = mergeLootBags(run.lootBag, drop);
      run.capsLooted += e.capReward;
      const xpGain = e.xpReward || 20;
      const xpRes = grantRpgXp(state, xpGain);
      logs.push(
        `击溃「${e.name}」！掉落瓶盖 +${e.capReward}、食材×${
          e.lootCount + (hasLootBoost ? 1 : 0)
        } · +${xpGain} XP${xpRes.leveledUp ? `（升至 LV.${xpRes.newLevel}！）` : ""}`
      );
      return false;
    }
    return true;
  });

  if (run.enemies.length === 0) {
    let isBossOrElite = false;
    if (run.building && run.activePatrolId) {
      const patrol = run.building.patrols.find((p) => p.id === run.activePatrolId);
      if (patrol) {
        patrol.defeated = true;
        isBossOrElite = Boolean(patrol.isBoss || patrol.isElite);
        run.building.scrapParts += patrol.isBoss ? 3 : 2;
        run.building.exploreLog = [
          `肃清了 ${patrol.floor}F 威胁「${patrol.name}」，缴获改装零件 +${
            patrol.isBoss ? 3 : 2
          }！`,
          ...run.building.exploreLog,
        ].slice(0, 10);
      }
    }
    run.draftOptions = rollDraftCardOptions(state, 3, isBossOrElite);
    run.cardChoices = run.draftOptions.map((d) => d.defId);
    run.nodeMode = "POST_COMBAT_REWARD";
    return true;
  }
  return false;
}

export function playCombatCard(
  prevState: CampaignSaveState,
  cardUid: string,
  targetEnemyUid?: string
): CampaignSaveState {
  if (!prevState.nightRun || prevState.nightRun.nodeMode !== "COMBAT") {
    return prevState;
  }
  const state = structuredClone(prevState);
  const rpg = ensureRpgState(state);
  let run = state.nightRun!;
  const handIdx = run.hand.findIndex((c) => c.uid === cardUid);
  if (handIdx === -1) return prevState;

  const cardInst = run.hand[handIdx];
  const stats = resolveCardStats(cardInst.defId, cardInst.upgraded);
  const effectiveCost = getEffectiveCardCost(cardInst, run);
  if (run.energy < effectiveCost) return prevState;

  const comboBeforePlay = run.comboCount || 0;
  run.energy -= effectiveCost;
  run.hand.splice(handIdx, 1);

  const logs: string[] = [];
  const strBonus = Math.max(0, (rpg.attributes.STR || 2) - 2);
  const hasGunslingerPerk = rpg.unlockedPerks.includes("perk_gunslinger");
  const hasRadChemistPerk = rpg.unlockedPerks.includes("perk_rad_chemist");
  const hasVaultConstitution = rpg.unlockedPerks.includes(
    "perk_vault_constitution"
  );
  const hasGadgetTinkerPerk = rpg.unlockedPerks.includes("perk_gadget_tinker");

  const getPrimaryTarget = (): ActiveEnemy | undefined =>
    run.enemies.find((e) => e.uid === targetEnemyUid && e.hp > 0) ||
    run.enemies.find((e) => e.hp > 0);

  const dealHitToEnemy = (enemy: ActiveEnemy, rawDamage: number): number => {
    let dmg = rawDamage;
    if ((enemy.markedTurns || 0) > 0) {
      dmg = Math.round(dmg * 1.35);
    }
    if (enemy.block > 0) {
      const absorbed = Math.min(enemy.block, dmg);
      enemy.block -= absorbed;
      dmg -= absorbed;
    }
    enemy.hp = Math.max(0, enemy.hp - dmg);
    return dmg;
  };

  // 1. 先结算护甲获取与护甲翻倍（使《铆钉盾猛重砸》吃到本卡新增护甲！）
  if (stats.block > 0) {
    run.playerBlock += stats.block;
    logs.push(`获得 +${stats.block} 点护甲`);
  }

  if (stats.doubleCurrentBlock) {
    const added = run.playerBlock;
    run.playerBlock *= 2;
    logs.push(`液压装甲超频：当前护甲翻倍至 ${run.playerBlock} 点（+${added}）！`);
  }

  if (stats.retainBlockTurns > 0) {
    run.retainBlockTurns = Math.max(
      run.retainBlockTurns || 0,
      stats.retainBlockTurns
    );
    logs.push(`防爆焊死：未来 ${run.retainBlockTurns} 回合未消耗护甲将完整保留！`);
  }

  if (stats.thornsGain > 0) {
    run.thorns = (run.thorns || 0) + stats.thornsGain;
    logs.push(`披挂倒刺网甲：本场战斗荆棘反伤提升至 ${run.thorns} 点`);
  }

  // 2. 单体直接伤害 / 连击多段弹幕 / 重甲盾猛伤害
  const target = getPrimaryTarget();

  if (stats.damage > 0 && target) {
    const totalHits =
      stats.hits + (stats.hitsPerCombo ? comboBeforePlay : 0);
    const perHitRaw =
      stats.damage +
      (stats.archetype === "NEUTRAL" || stats.archetype === "JUGGERNAUT"
        ? strBonus
        : 0);
    let sumDealt = 0;
    for (let h = 0; h < totalHits; h++) {
      const currentTarget = target.hp > 0 ? target : getPrimaryTarget();
      if (!currentTarget) break;
      sumDealt += dealHitToEnemy(currentTarget, perHitRaw);
    }
    logs.push(
      totalHits > 1
        ? `打出《${stats.name}》，倾泻 ${totalHits} 段连射共造成 ${sumDealt} 点伤害！`
        : `打出《${stats.name}》，对「${target.name}」造成 ${sumDealt} 点伤害`
    );
  }

  if (stats.damageFromBlockRatio > 0 && target) {
    const slamRaw =
      Math.round(run.playerBlock * stats.damageFromBlockRatio) + strBonus * 2;
    const dealt = dealHitToEnemy(target, slamRaw);
    logs.push(
      `【重甲盾猛】按当前 ${run.playerBlock} 点护甲砸出 ${dealt} 点毁灭重击！`
    );
  }

  // 3. 范围群伤与拾荒机关风暴加成
  if (stats.aoeDamage > 0) {
    const gadgetBonus =
      stats.damagePerGadgetPlayed > 0
        ? (run.gadgetsPlayedCount || 0) * stats.damagePerGadgetPlayed
        : 0;
    const rawAoe = stats.aoeDamage + gadgetBonus;
    run.enemies.forEach((e) => {
      if (e.hp > 0) dealHitToEnemy(e, rawAoe);
    });
    logs.push(
      `打出《${stats.name}》，对全体敌人造成 ${rawAoe} 点范围轰击${
        gadgetBonus > 0 ? `（含机关连携 +${gadgetBonus}）` : ""
      }！`
    );
  }

  // 4. 锁定标记（枪火连击流）
  if (stats.applyMarked > 0) {
    if (stats.aoeDamage > 0 || stats.category === "TACTIC") {
      run.enemies.forEach((e) => {
        if (e.hp > 0) e.markedTurns = (e.markedTurns || 0) + stats.applyMarked;
      });
      logs.push(`锁定标记全体敌人 ${stats.applyMarked} 回合（受击伤害 +35%）`);
    } else if (target && target.hp > 0) {
      target.markedTurns = (target.markedTurns || 0) + stats.applyMarked;
      logs.push(`锁定「${target.name}」${stats.applyMarked} 回合（受击 +35%）`);
    }
  }

  // 5. 辐射生化流：叠层、翻倍催化与核冬裂变引爆！
  const radPerkExtra = hasRadChemistPerk ? 2 : 0;
  if (stats.applyRad > 0 && target && target.hp > 0) {
    const amt = stats.applyRad + radPerkExtra;
    target.radStacks = (target.radStacks || 0) + amt;
    logs.push(`对「${target.name}」施加 +${amt} 层辐射腐蚀（当前 ${target.radStacks} 层）`);
  }

  if (stats.aoeApplyRad > 0) {
    const amt = stats.aoeApplyRad + radPerkExtra;
    run.enemies.forEach((e) => {
      if (e.hp > 0) e.radStacks = (e.radStacks || 0) + amt;
    });
    logs.push(`菌孢弥漫：全体敌人叠加 +${amt} 层辐射腐蚀！`);
  }

  if (stats.doubleTargetRad && target && target.hp > 0) {
    target.radStacks = (target.radStacks || 0) * 2;
    logs.push(
      `同位素催化：「${target.name}」辐射层数翻倍至 ${target.radStacks} 层！`
    );
  }

  if (stats.detonateRadMultiplier > 0 && target) {
    const stacks = target.radStacks || 0;
    const burstDmg = Math.max(
      6,
      Math.round(stacks * stats.detonateRadMultiplier)
    );
    run.enemies.forEach((e) => {
      if (e.hp > 0) dealHitToEnemy(e, burstDmg);
    });
    logs.push(
      `【核冬裂变引爆】催化 ${stacks} 层辐射，对全场轰出 ${burstDmg} 点生化爆破！`
    );
  }

  // 6. 治疗、回能、滑铲返能、削弱、瓶盖与现场搜刮
  if (stats.heal > 0) {
    const actualHeal = hasVaultConstitution
      ? Math.round(stats.heal * 1.5)
      : stats.heal;
    const beforeHp = state.playerHp;
    state.playerHp = Math.min(state.playerMaxHp, state.playerHp + actualHeal);
    logs.push(`战地急救恢复 +${state.playerHp - beforeHp} 点生命`);
  }

  if (stats.gainEnergy > 0) {
    run.energy += stats.gainEnergy;
    logs.push(`注入肾上腺：行动能量 +${stats.gainEnergy}`);
  }

  if (stats.id === "card_slide_reload" && comboBeforePlay >= 2) {
    run.energy += 1;
    logs.push(`连击达标（≥2）：《滑铲快速上膛》返还 +1 点行动能量！`);
  }

  if (stats.weakenEnemyAttack > 0) {
    run.enemies.forEach((e) => {
      if (e.hp > 0) e.attackDebuff += stats.weakenEnemyAttack;
    });
    logs.push(`战术压制：全体敌人攻击力 -${stats.weakenEnemyAttack}`);
  }

  if (stats.bonusCaps > 0) {
    run.capsLooted += stats.bonusCaps;
    logs.push(`搜刮入账 +${stats.bonusCaps} 枚瓶盖`);
  }

  if (stats.scavengeCount > 0) {
    const rolled = rollScavengedIngredients(
      stats.scavengeCount,
      stats.scavengeRareBoost
    );
    run.lootBag = mergeLootBags(run.lootBag, rolled);
    const names = (Object.keys(rolled) as IngredientId[])
      .filter((k) => rolled[k] > 0)
      .map((k) => `${INGREDIENTS[k].name}×${rolled[k]}`);
    logs.push(`现场搜刮入包：${names.join("、")}`);
  }

  // 7. 拾荒机关流：架设磁暴线圈、衍生 0 费机关卡、触发自动电击！
  if (stats.gadgetTurretGain > 0) {
    run.gadgetTurretDmg = (run.gadgetTurretDmg || 0) + stats.gadgetTurretGain;
    logs.push(
      `架设磁暴线圈：每打出 0 费牌或搜刮牌将自动电击敌方 ${run.gadgetTurretDmg} 点并得护甲！`
    );
  }

  const isZeroOrScavenge =
    effectiveCost === 0 || stats.category === "SCAVENGE";
  let extraTinkerDraw = 0;
  if (isZeroOrScavenge) {
    const prevGadgets = run.gadgetsPlayedCount || 0;
    run.gadgetsPlayedCount = prevGadgets + 1;
    if (hasGadgetTinkerPerk && effectiveCost === 0 && prevGadgets === 0) {
      extraTinkerDraw = 1;
    }
    if ((run.gadgetTurretDmg || 0) > 0) {
      const zapTarget = getPrimaryTarget();
      const blockGain = (run.gadgetTurretDmg || 0) >= 6 ? 3 : 2;
      run.playerBlock += blockGain;
      if (zapTarget) {
        const zapped = dealHitToEnemy(zapTarget, run.gadgetTurretDmg!);
        logs.push(
          `【磁暴线圈连携】自动电击「${zapTarget.name}」${zapped} 点伤害，护甲 +${blockGain}！`
        );
      }
    }
  }

  // 8. 连击点数增长与《荒原快枪手》专长触发
  let gainedCombo = stats.comboGain;
  if (hasGunslingerPerk && stats.category === "ATTACK" && comboBeforePlay === 0) {
    gainedCombo += 1;
    const mkTarget = getPrimaryTarget();
    if (mkTarget && mkTarget.hp > 0) {
      mkTarget.markedTurns = (mkTarget.markedTurns || 0) + 1;
    }
    logs.push("专长《荒原快枪手》触发：首张攻击额外连击 +1 并挂锁定标记！");
  }
  if (gainedCombo > 0) {
    run.comboCount = comboBeforePlay + gainedCombo;
  }

  // 9. 弃牌/消耗处理、过牌抽卡与塞入衍生 0 费机关卡
  if (stats.exhaust || cardInst.isToken) {
    run.exhaustPile.push(cardInst);
  } else {
    run.discardPile.push(cardInst);
  }

  const totalDraw = stats.drawCards + extraTinkerDraw;
  if (totalDraw > 0) {
    run = drawCardsFromPile(run, totalDraw);
  }

  if (stats.spawnGadgetId && stats.spawnGadgetCount > 0) {
    const gadgetDef = COMBO_CARD_LIBRARY[stats.spawnGadgetId];
    for (let i = 0; i < stats.spawnGadgetCount; i++) {
      if (run.hand.length >= 9) break;
      run.hand.push({
        uid: uid("tok"),
        defId: stats.spawnGadgetId,
        upgraded: Boolean(cardInst.upgraded),
        isToken: true,
      });
    }
    if (gadgetDef) {
      logs.push(
        `巧手组装：手牌新增 ${stats.spawnGadgetCount} 张《${
          cardInst.upgraded ? gadgetDef.upgradedName : gadgetDef.name
        }》`
      );
    }
  }

  finalizeCombatVictoryIfCleared(state, run, logs);
  run.combatLog = [...logs, ...run.combatLog].slice(0, 16);
  state.nightRun = run;
  return state;
}

/**
 * 牌局内「口才劝降」：对人类敌人在残血（或激战中）掷 2d6 + 口才 迫使其弃械投降并献出瓶盖！
 */
export function attemptCombatPersuade(
  prevState: CampaignSaveState,
  targetEnemyUid?: string
): { nextState: CampaignSaveState; banner: string } {
  if (!prevState.nightRun || prevState.nightRun.nodeMode !== "COMBAT") {
    return { nextState: prevState, banner: "" };
  }
  const state = structuredClone(prevState);
  const rpg = ensureRpgState(state);
  const run = state.nightRun!;

  if (run.persuadeAttemptedThisCombat) {
    return { nextState: prevState, banner: "本场战斗已尝试过口才劝降" };
  }

  const humanTarget =
    run.enemies.find(
      (e) => e.uid === targetEnemyUid && e.hp > 0 && e.isHuman
    ) || run.enemies.find((e) => e.hp > 0 && e.isHuman);

  if (!humanTarget) {
    return {
      nextState: prevState,
      banner: "场上没有可沟通的人类敌对单位（变异兽与机甲无法劝降）",
    };
  }

  run.persuadeAttemptedThisCombat = true;
  const hpRatio = humanTarget.hp / Math.max(1, humanTarget.maxHp);
  const dc = hpRatio <= 0.55 ? 8 : 10;
  const roll = roll2d6AttributeCheck(
    rpg,
    "ELO",
    dc,
    `牌局劝降「${humanTarget.name}」`
  );

  const logs: string[] = [];
  if (roll.success) {
    humanTarget.hp = 0;
    const ransomCaps = 10;
    run.capsLooted += ransomCaps;
    const xpGain =
      18 + (rpg.unlockedPerks.includes("perk_iron_barkeep") ? 10 : 0);
    grantRpgXp(state, xpGain);
    logs.push(
      `【口才劝降成功】${roll.summary} →「${humanTarget.name}」丢下武器投降，交出买命钱 +${ransomCaps} 瓶盖！`
    );
    finalizeCombatVictoryIfCleared(state, run, logs);
    run.combatLog = [...logs, ...run.combatLog].slice(0, 16);
    return {
      nextState: state,
      banner: `${roll.summary} → 敌方弃械投降，额外缴获 +${ransomCaps} 瓶盖！`,
    };
  } else {
    humanTarget.attackDebuff += 1;
    grantRpgXp(state, 6);
    logs.push(
      `【劝降未果】${roll.summary} →「${humanTarget.name}」咬牙顽抗，但心神动摇攻击力 -1`
    );
    run.combatLog = [...logs, ...run.combatLog].slice(0, 16);
    return {
      nextState: state,
      banner: `${roll.summary} → 敌方拒绝投降（敌攻 -1，+6 XP）`,
    };
  }
}

export function endPlayerCombatTurn(
  prevState: CampaignSaveState
): CampaignSaveState {
  if (!prevState.nightRun || prevState.nightRun.nodeMode !== "COMBAT") {
    return prevState;
  }
  const state = structuredClone(prevState);
  const rpg = ensureRpgState(state);
  let run = state.nightRun!;
  const logs: string[] = [];

  // 弃置非衍生手牌，衍生 Token 牌自动消耗清理以免污染牌库
  run.hand.forEach((c) => {
    if (c.isToken) {
      run.exhaustPile.push(c);
    } else {
      run.discardPile.push(c);
    }
  });
  run.hand = [];

  const hasRadChemist = rpg.unlockedPerks.includes("perk_rad_chemist");
  const hasInspirational = rpg.unlockedPerks.includes("perk_inspirational");
  const hasScrapBarricade = rpg.unlockedPerks.includes("perk_scrap_barricade");
  const chaBonus = Math.max(0, (rpg.attributes.CHA || 2) - 2);

  // 1. 结算敌方回合末辐射腐蚀掉血
  run.enemies.forEach((e) => {
    if (e.hp > 0 && (e.radStacks || 0) > 0) {
      const radDmg = Math.max(
        1,
        Math.round(e.radStacks! * (hasRadChemist ? 1.4 : 1))
      );
      e.hp = Math.max(0, e.hp - radDmg);
      e.radStacks = Math.max(0, e.radStacks! - 1);
      logs.push(`【辐射腐蚀】「${e.name}」受到 ${radDmg} 点内蚀伤害`);
    }
  });

  if (finalizeCombatVictoryIfCleared(state, run, logs)) {
    run.combatLog = [...logs, ...run.combatLog].slice(0, 16);
    state.nightRun = run;
    return state;
  }

  // 2. 场内同行助战伙伴自动释放伙伴技（受魅力 CHA 与《并肩领袖气场》加成）
  if (run.companion && run.enemies.length > 0) {
    const comp = run.companion;
    const compPower = Math.round(
      (comp.value + chaBonus) * (hasInspirational ? 1.6 : 1)
    );
    const leadEnemy = run.enemies.find((e) => e.hp > 0);
    const applyHit = (target: ActiveEnemy, rawDmg: number) => {
      let dmg = rawDmg;
      if (target.block > 0) {
        const absorbed = Math.min(target.block, dmg);
        target.block -= absorbed;
        dmg -= absorbed;
      }
      target.hp = Math.max(0, target.hp - dmg);
      return dmg;
    };

    if (comp.kind === "ASSAULT_SCAVENGE" && leadEnemy) {
      const dealt = applyHit(leadEnemy, compPower);
      let extraMsg = "";
      if (run.turn % 2 === 1) {
        const bag = rollScavengedIngredients(1, false);
        run.lootBag = mergeLootBags(run.lootBag, bag);
        const foundKey = (Object.keys(bag) as IngredientId[]).find(
          (k) => bag[k] > 0
        );
        if (foundKey) extraMsg = `，并撬出${INGREDIENTS[foundKey].name}×1`;
      }
      logs.push(
        `【伙伴援护·${comp.name}】「${comp.skillName}」造成 ${dealt} 点伤害${extraMsg}`
      );
    } else if (comp.kind === "SHOTGUN_AOE") {
      run.enemies.forEach((e) => {
        if (e.hp > 0) applyHit(e, compPower);
      });
      logs.push(
        `【伙伴援护·${comp.name}】「${comp.skillName}」横扫全场 ${compPower} 点铁砂伤害！`
      );
    } else if (comp.kind === "OPTIC_SHIELD") {
      run.playerBlock += compPower;
      if (leadEnemy) applyHit(leadEnemy, 4 + chaBonus);
      logs.push(
        `【伙伴援护·${comp.name}】展开光学护盾 +${compPower} 护甲，脉冲反击 ${
          4 + chaBonus
        } 点伤害`
      );
    } else if (comp.kind === "DART_CAPS" && leadEnemy) {
      const dealt = applyHit(leadEnemy, compPower);
      run.capsLooted += 3;
      leadEnemy.radStacks = (leadEnemy.radStacks || 0) + 2;
      logs.push(
        `【伙伴援护·${comp.name}】淬毒镖造成 ${dealt} 点伤害（辐射+2），顺手摸回 +3 盖`
      );
    } else if (comp.kind === "HEAVY_BLOW" && leadEnemy) {
      const dealt = applyHit(leadEnemy, compPower);
      logs.push(
        `【伙伴援护·${comp.name}】重锤猛击「${leadEnemy.name}」造成 ${dealt} 点伤害！`
      );
    } else if (comp.kind === "FIELD_MEDIC") {
      state.playerHp = Math.min(state.playerMaxHp, state.playerHp + 4);
      if (leadEnemy) applyHit(leadEnemy, compPower);
      logs.push(
        `【伙伴援护·${comp.name}】战地急救恢复 +4 生命，点射造成 ${compPower} 点伤害`
      );
    }

    if (finalizeCombatVictoryIfCleared(state, run, logs)) {
      run.combatLog = [...logs, ...run.combatLog].slice(0, 16);
      state.nightRun = run;
      return state;
    }
  }

  // 3. 敌方行动与荆棘反伤结算
  for (const enemy of run.enemies) {
    if (enemy.hp <= 0) continue;
    enemy.block = 0;
    if ((enemy.markedTurns || 0) > 0) {
      enemy.markedTurns = Math.max(0, enemy.markedTurns! - 1);
    }
    const intent = enemy.currentIntent;
    const effectiveVal = Math.max(1, intent.value - enemy.attackDebuff);

    const triggerThornsOnEnemy = () => {
      if ((run.thorns || 0) > 0) {
        enemy.hp = Math.max(0, enemy.hp - run.thorns!);
        logs.push(`【倒刺荆棘】反弹「${enemy.name}」${run.thorns} 点伤害`);
      }
    };

    if (
      intent.type === "ATTACK" ||
      intent.type === "HEAVY_ATTACK" ||
      intent.type === "RAD_HOWL"
    ) {
      let dmg = effectiveVal;
      if (run.playerBlock > 0) {
        const blocked = Math.min(run.playerBlock, dmg);
        run.playerBlock -= blocked;
        dmg -= blocked;
      }
      state.playerHp = Math.max(0, state.playerHp - dmg);
      logs.push(
        `${enemy.name}施展「${intent.label}」，${
          dmg > 0 ? `造成 ${dmg} 点穿透伤害` : "被你的重甲完美格挡！"
        }`
      );
      triggerThornsOnEnemy();
    } else if (intent.type === "STEAL_LOOT") {
      let dmg = effectiveVal;
      if (run.playerBlock > 0) {
        const blocked = Math.min(run.playerBlock, dmg);
        run.playerBlock -= blocked;
        dmg -= blocked;
      }
      state.playerHp = Math.max(0, state.playerHp - dmg);
      if (dmg > 0) {
        const availableKeys = (Object.keys(run.lootBag) as IngredientId[]).filter(
          (k) => run.lootBag[k] > 0
        );
        if (availableKeys.length > 0) {
          const lostKey = availableKeys[0];
          run.lootBag[lostKey] -= 1;
          logs.push(
            `${enemy.name}趁乱夺走了背包里的 1 份${INGREDIENTS[lostKey].name}！`
          );
        } else {
          logs.push(`${enemy.name}造成 ${dmg} 点伤害`);
        }
      } else {
        logs.push(`护甲完美挡下了${enemy.name}的抢夺扑击！`);
      }
      triggerThornsOnEnemy();
    } else if (intent.type === "GUARD_HEAL") {
      enemy.block += intent.value;
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + 3);
      logs.push(`${enemy.name}加固了 ${intent.value} 点护甲并修复机体`);
    }

    const tpl = ENEMY_TEMPLATES[enemy.templateId] || ENEMY_TEMPLATES.ash_rats;
    enemy.intentIndex = (enemy.intentIndex + 1) % tpl.intents.length;
    enemy.currentIntent = tpl.intents[enemy.intentIndex];
  }

  if (finalizeCombatVictoryIfCleared(state, run, logs)) {
    run.combatLog = [...logs, ...run.combatLog].slice(0, 16);
    state.nightRun = run;
    return state;
  }

  if (state.playerHp <= 0) {
    state.playerHp = 18;
    (Object.keys(run.lootBag) as IngredientId[]).forEach((k) => {
      run.lootBag[k] = Math.floor(run.lootBag[k] / 2);
    });
    run.capsLooted = Math.floor(run.capsLooted / 2);
    run.nodeMode = "RUN_COMPLETE";
    run.summaryNote =
      "你在重伤昏迷前拉响烟雾弹撤回酒馆，虽遗失了半数拾荒物资，但已取得的卡牌与经验完好保留！";
    state.nightRun = run;
    return state;
  }

  // 进入新回合：结算重甲流「护甲保留」与连击清零
  run.turn += 1;
  run.energy = run.maxEnergy;
  run.comboCount = 0;
  if ((run.retainBlockTurns || 0) > 0) {
    run.retainBlockTurns = Math.max(0, run.retainBlockTurns! - 1);
    logs.push(`重甲焊死生效：完整保留 ${run.playerBlock} 点护甲进入新回合！`);
  } else if (hasScrapBarricade && run.playerBlock > 0) {
    run.playerBlock = Math.min(10, run.playerBlock);
    logs.push(`专长《废铁移动堡垒》保留了 ${run.playerBlock} 点护甲`);
  } else {
    run.playerBlock = 0;
  }

  run.combatLog = [...logs, ...run.combatLog].slice(0, 16);
  run = drawCardsFromPile(run, 5);
  state.nightRun = run;
  return state;
}

/**
 * 搜翻武器箱、幸存者赠礼或战后三选一：将选定卡牌（含 +1 升星状态）永久加入牌组并返回横版建筑继续探索！
 */
export function draftNightCardReward(
  prevState: CampaignSaveState,
  optionIndex: number | null
): { nextState: CampaignSaveState; banner: string } {
  if (!prevState.nightRun) return { nextState: prevState, banner: "" };
  const state = structuredClone(prevState);
  ensureRpgState(state);
  const run = state.nightRun!;
  const options = run.draftOptions || [];

  let banner = "";
  if (optionIndex !== null && options[optionIndex]) {
    const picked = options[optionIndex];
    addCardToCampaignDeck(state, picked.defId, picked.upgraded);
    const resolved = resolveCardStats(picked.defId, picked.upgraded);
    run.cardsCollectedThisRun = [
      ...(run.cardsCollectedThisRun || []),
      resolved.name,
    ];
    banner = `新卡牌《${resolved.name}》已永久收录进探险牌库！`;
  } else {
    run.capsLooted += 6;
    banner = "放弃选牌，拆解武器零件换取 +6 枚瓶盖";
  }

  run.draftOptions = [];
  run.cardChoices = [];
  run.activePatrolId = null;

  if (run.building) {
    run.nodeMode = "BUILDING_EXPLORE";
  } else {
    run.nodeMode = "RUN_COMPLETE";
    run.summaryNote = "满载战利品重返废土酒馆！";
  }

  return { nextState: state, banner };
}
