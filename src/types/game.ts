export type GamePhase =
  | "TITLE"
  | "DAY_TAVERN"
  | "DUSK_LEDGER"
  | "NIGHT_ROGUELIKE"
  | "ENDING";

export type WorkspaceTab = "STAGE" | "PATRONS" | "LORE" | "DECK" | "INSPECTOR";

export type IngredientId =
  | "rad_water"
  | "mutant_potato"
  | "rust_malt"
  | "glow_shroom"
  | "calm_herb"
  | "cryo_mint";

export interface IngredientDef {
  id: IngredientId;
  name: string;
  subtitle: string;
  imageUrl: string;
  rarity: "common" | "uncommon" | "rare";
  potencyBonus: number;
  soothingBonus: number;
  purificationBonus: number;
  flavorTags: string[];
  capValue: number;
}

export type PourStyle = "standard" | "generous" | "watered";

export interface DrinkRecipePreset {
  id: string;
  name: string;
  tagline: string;
  imageUrl: string;
  ingredients: [IngredientId, IngredientId, IngredientId];
  suggestedPrice: number;
  flavorNotes: string[];
}

export interface CraftedDrink {
  name: string;
  imageUrl: string;
  ingredients: [IngredientId, IngredientId, IngredientId];
  ingredientsText: string;
  pourStyle: PourStyle;
  potency: number;
  soothing: number;
  purification: number;
  suggestedPrice: number;
  flavorTags: string[];
}

export type MainNpcId =
  | "ash_scavenger"
  | "k7_synth"
  | "buck_raider"
  | "mori_merchant";

export type NpcId = string;

export type NpcProposedActionType =
  | "CHAT_ONLY"
  | "PAY_FULL"
  | "BARGAIN"
  | "ASK_CREDIT"
  | "REPAY_DEBT"
  | "SHARE_RUIN_INTEL"
  | "GIFT_SIGNATURE_CARD"
  | "OFFER_COMMISSION"
  | "PROVOKE_BRAWL";

export interface NpcMemoryEntry {
  day: number;
  summary: string;
  impactTag: string;
}

/**
 * 可复用模块化立绘拼接参数（用于非主要人物的随机过路废土客自动拼装）
 */
export interface ModularAvatarParts {
  bodyBuild?: number; // 0: 魁梧壮硕体型 (BURLY), 1: 匀称标准体型 (STANDARD), 2: 纤细清瘦体型 (SLENDER)
  paletteIndex: number; // 0..4 废土配色方案
  backGear: number; // 0..6 背部装备组件
  coatStyle: number; // 0..3 对应体型池内的外套服装组件
  neckwear: number; // 0..4 领口与挂件组件（兼容旧存档）
  faceShape: number; // 0..4 对应体型池内的脸型与面孔组件
  featureMark: number; // 0..5 伤疤/义眼/胡茬组件
  eyeStyle: number; // 0..4 眼部与镜片组件
  headgear: number; // 0..4 头饰/帽兜/护目镜组件
}

export type CompanionSkillKind =
  | "ASSAULT_SCAVENGE"
  | "SHOTGUN_AOE"
  | "OPTIC_SHIELD"
  | "DART_CAPS"
  | "HEAVY_BLOW"
  | "FIELD_MEDIC";

export interface NpcCompanionSkillDef {
  name: string;
  desc: string;
  kind: CompanionSkillKind;
  value: number;
}

export interface NpcSecretAgenda {
  isUndercover: boolean;
  codeName: string;
  surfaceAlibi: string;
  trueIdentity: string;
  secretGoal: string;
  probeKeywords: string[];
  slipIntoxicationThreshold: number;
  defaultClueText: string;
  bountyCaps: number;
  hushCaps: number;
  commissionTitle?: string;
  commissionDesc?: string;
}

export type ShowdownVerdictChoice =
  | "EXPOSE_BOUNTY"
  | "BLACKMAIL_SHELTER"
  | "FEED_FALSE_INTEL";

export interface QuantifiedNpcState {
  id: NpcId;
  trust: number; // 0 - 100
  intoxication: number; // 0 - 100
  tension: number; // 0 - 100
  debtCaps: number; // >= 0
  visits: number;
  unlockedCardGiven: boolean;
  intelSharedToday: boolean;
  memories: NpcMemoryEntry[];
  clueExposed?: boolean;
  exposedClueNote?: string;
  showdownResolved?: ShowdownVerdictChoice | null;
  rumorSeededToday?: boolean;
  commissionCompletedCount?: number;
}

export interface NpcStaticProfile {
  id: NpcId;
  isMainCharacter: boolean;
  name: string;
  title: string;
  faction: string;
  portraitUrl?: string;
  combatSpriteUrl?: string;
  modularParts?: ModularAvatarParts;
  personaPrompt: string;
  speechStyle: string;
  bio: string;
  favoriteNotes: string[];
  dislikedNotes: string[];
  signatureCardId?: string;
  intelThreshold: number;
  giftCardThreshold: number;
  brawlTensionThreshold: number;
  quickTopics: string[];
  secretAgenda?: NpcSecretAgenda;
  companionSkill?: NpcCompanionSkillDef;
}

export interface DailyBulletin {
  id: string;
  code: string;
  title: string;
  clueHint: string;
  bountyCaps: number;
}

export interface TavernRumor {
  id: string;
  day: number;
  title: string;
  detail: string;
  tone: "WARM" | "RUTHLESS" | "CUNNING";
  trustMod: number;
  tensionMod: number;
  remainingDays: number;
  nightBonus?: "LOOT" | "CALM" | null;
}

export interface NightCompanionState {
  npcId: NpcId;
  name: string;
  title: string;
  portraitUrl?: string;
  combatSpriteUrl?: string;
  modularParts?: ModularAvatarParts;
  skillName: string;
  skillDesc: string;
  kind: CompanionSkillKind;
  value: number;
}

export interface ActiveCommission {
  id: string;
  npcId: NpcId;
  npcName: string;
  title: string;
  objective: string;
  rewardCaps: number;
  completed: boolean;
}

export interface DialogueServedDrinkVisual {
  name: string;
  imageUrl: string;
  ingredientsText: string;
  pourStyle: PourStyle;
  suggestedPrice: number;
  potency: number;
  soothing: number;
  purification: number;
}

export interface DialogueLine {
  id: string;
  speaker: "NPC" | "PLAYER" | "SYSTEM";
  speakerName: string;
  text: string;
  subtext?: string;
  servedDrinkVisual?: DialogueServedDrinkVisual;
  timestamp: string;
}

// ==================== 昼夜贯通 RPG LEVEL + 四维属性 + 掷骰检定 ====================

export type RpgAttributeKey = "STR" | "AGI" | "ELO" | "CHA";

export interface DiceRollResult {
  id: string;
  title: string;
  attr: RpgAttributeKey;
  dice: [number, number];
  attrVal: number;
  perkBonus: number;
  total: number;
  dc: number;
  success: boolean;
  summary: string;
}

export interface RpgPerkDef {
  id: string;
  code: string;
  name: string;
  archetypeTag: string;
  description: string;
}

export interface RpgCharacterState {
  level: number;
  xp: number;
  nextLevelXp: number;
  statPoints: number;
  upgradeTokens: number;
  pendingPerkChoices: number;
  attributes: Record<RpgAttributeKey, number>;
  unlockedPerks: string[];
  lastDiceCheck?: DiceRollResult | null;
}

export interface OfferDiceCheckOption {
  attr: RpgAttributeKey;
  dc: number;
  label: string;
  hint: string;
}

export interface PendingDecisionOffer {
  type:
    | "SETTLEMENT_RECEIPT"
    | "BARGAIN"
    | "ASK_CREDIT"
    | "BRAWL_CRISIS"
    | "COMMISSION_OFFER";
  npcId: NpcId;
  npcName: string;
  suggestedPrice: number;
  offeredCaps: number;
  description: string;
  commissionTitle?: string;
  commissionObjective?: string;
  // 吧台收款与情报实体签收单扩展字段
  tipCaps?: number;
  repaidDebtCaps?: number;
  intelUnlockedNote?: string;
  weakenedBossNote?: boolean;
  giftCardDefId?: string;
  giftCardName?: string;
  xpReward?: number;
  // DND 简明 2d6 + 属性检定选项
  diceOption?: OfferDiceCheckOption;
  altDiceOption?: OfferDiceCheckOption;
}

export interface RuleValidationLog {
  id: string;
  day: number;
  timestamp: string;
  npcId: NpcId;
  npcName: string;
  provider: string;
  modelName: string;
  rawProposedAction: NpcProposedActionType | string;
  quantifiedBefore: {
    trust: number;
    intoxication: number;
    tension: number;
    debtCaps: number;
  };
  quantifiedAfter: {
    trust: number;
    intoxication: number;
    tension: number;
    debtCaps: number;
  };
  ruleCheckSummary: string;
  passedValidation: boolean;
  enforcedOutcome: string;
  worldMutation: string;
}

// ==================== 四大流派 Combo 卡牌与升星构筑 ====================

export type CardCategory = "ATTACK" | "GUARD" | "SCAVENGE" | "TACTIC";

export type CardArchetype =
  | "NEUTRAL"
  | "GUNSLINGER"
  | "JUGGERNAUT"
  | "RAD_BIO"
  | "GADGETEER";

export interface CardDef {
  id: string;
  name: string;
  upgradedName?: string;
  category: CardCategory;
  archetype?: CardArchetype;
  cost: number;
  upgradedCost?: number;
  rarity: "starter" | "common" | "rare" | "signature" | "token";
  description: string;
  upgradedDescription?: string;
  damage?: number;
  upgradedDamage?: number;
  hits?: number;
  upgradedHits?: number;
  aoeDamage?: number;
  upgradedAoeDamage?: number;
  block?: number;
  upgradedBlock?: number;
  heal?: number;
  upgradedHeal?: number;
  drawCards?: number;
  upgradedDrawCards?: number;
  gainEnergy?: number;
  upgradedGainEnergy?: number;
  scavengeCount?: number;
  upgradedScavengeCount?: number;
  scavengeRareBoost?: boolean;
  bonusCaps?: number;
  upgradedBonusCaps?: number;
  weakenEnemyAttack?: number;
  upgradedWeakenEnemyAttack?: number;
  // 四大流派专属连携词条
  comboGain?: number;
  hitsPerCombo?: boolean;
  costReducePerCombo?: boolean;
  applyMarked?: number;
  upgradedApplyMarked?: number;
  retainBlockTurns?: number;
  thornsGain?: number;
  upgradedThornsGain?: number;
  damageFromBlockRatio?: number;
  upgradedDamageFromBlockRatio?: number;
  doubleCurrentBlock?: boolean;
  applyRad?: number;
  upgradedApplyRad?: number;
  aoeApplyRad?: number;
  upgradedAoeApplyRad?: number;
  doubleTargetRad?: boolean;
  detonateRadMultiplier?: number;
  upgradedDetonateRadMultiplier?: number;
  spawnGadgetId?: string;
  spawnGadgetCount?: number;
  upgradedSpawnGadgetCount?: number;
  gadgetTurretGain?: number;
  upgradedGadgetTurretGain?: number;
  damagePerGadgetPlayed?: number;
  upgradedDamagePerGadgetPlayed?: number;
  exhaust?: boolean;
  removeExhaustOnUpgrade?: boolean;
  isToken?: boolean;
  ownerNpcName?: string;
}

export interface DeckCardEntry {
  uid: string;
  defId: string;
  upgraded: boolean;
}

export interface CardInstance {
  uid: string;
  defId: string;
  upgraded?: boolean;
  isToken?: boolean;
}

export type EnemyIntentType =
  | "ATTACK"
  | "HEAVY_ATTACK"
  | "GUARD_HEAL"
  | "STEAL_LOOT"
  | "RAD_HOWL";

export interface EnemyIntent {
  type: EnemyIntentType;
  value: number;
  label: string;
}

export interface EnemyTemplate {
  id: string;
  name: string;
  subtitle: string;
  maxHp: number;
  isHuman?: boolean;
  isElite?: boolean;
  isBoss?: boolean;
  intents: EnemyIntent[];
  lootCount: number;
  capReward: number;
  xpReward?: number;
}

export interface ActiveEnemy {
  uid: string;
  templateId: string;
  name: string;
  subtitle: string;
  hp: number;
  maxHp: number;
  block: number;
  attackDebuff: number;
  radStacks?: number;
  markedTurns?: number;
  isHuman?: boolean;
  intentIndex: number;
  currentIntent: EnemyIntent;
  lootCount: number;
  capReward: number;
  xpReward?: number;
}

// ==================== 类《这是我的战争》城市选图与横版建筑剖面 ====================

export type CityLocationId =
  | "ruined_mart"
  | "shelled_clinic"
  | "scrap_shipyard"
  | "cryo_reactor";

export interface CityLocationDef {
  id: CityLocationId;
  code: string;
  name: string;
  shortName: string;
  subtitle: string;
  imageUrl: string;
  dangerRating: 1 | 2 | 3 | 4;
  dangerLabel: string;
  mapX: number; // 百分比 10..90
  mapY: number; // 百分比 15..85
  lootPreviewIds: IngredientId[];
  tagSummary: string;
  primaryLootDesc: string;
  tacticalNote: string;
}

export type BuildingObjectKind =
  | "EXIT_DOOR"
  | "SUPPLY_CABINET"
  | "LOCKED_WEAPON_CRATE"
  | "INTEL_COLD_VAULT"
  | "TRAP_LOOT_CACHE"
  | "COMMISSION_TARGET"
  | "WORKBENCH"
  | "NEUTRAL_SURVIVOR";

export interface BuildingInteractable {
  id: string;
  floor: 1 | 2 | 3;
  x: number; // 百分比 6..94
  kind: BuildingObjectKind;
  label: string;
  subtitle: string;
  locked?: boolean;
  lockDc?: number;
  used: boolean;
  survivorName?: string;
  survivorPrompt?: string;
}

export interface BuildingLadder {
  id: string;
  x: number;
  lowerFloor: 1 | 2;
  upperFloor: 2 | 3;
}

export interface BuildingPatrolEnemy {
  id: string;
  floor: 1 | 2 | 3;
  x: number;
  minX: number;
  maxX: number;
  facing: "left" | "right";
  name: string;
  subtitle: string;
  enemyIds: string[];
  isElite?: boolean;
  isBoss?: boolean;
  isCommissionGuard?: boolean;
  defeated: boolean;
}

export interface BuildingExploreState {
  locationId: CityLocationId;
  locationName: string;
  floorLabels: [string, string, string];
  playerFloor: 1 | 2 | 3;
  playerX: number;
  playerFacing: "left" | "right";
  ladders: BuildingLadder[];
  objects: BuildingInteractable[];
  patrols: BuildingPatrolEnemy[];
  scrapParts: number;
  activeSurvivorId?: string | null;
  exploreLog: string[];
}

export type RuinNodeType =
  | "SCAVENGE_BATTLE"
  | "SUPPLY_EVENT"
  | "ELITE_MUTANT"
  | "CAMPFIRE"
  | "INTEL_VAULT"
  | "RAIDER_AMBUSH"
  | "NPC_COMMISSION"
  | "HIRED_HITMAN"
  | "TRAP_CACHE"
  | "SAFE_EXTRACT"
  | "BOSS_LAIR";

export interface RuinMapNode {
  id: string;
  floor: 1 | 2 | 3;
  type: RuinNodeType;
  title: string;
  subtitle: string;
  dangerLabel: string;
  unlockedByNpc?: string;
  completed: boolean;
}

export interface DraftCardOption {
  defId: string;
  upgraded: boolean;
}

export interface NightRunState {
  currentFloor: 1 | 2 | 3;
  nodes: RuinMapNode[];
  activeNodeId: string | null;
  nodeMode:
    | "CITY_MAP"
    | "BUILDING_EXPLORE"
    | "MAP"
    | "COMBAT"
    | "SURVIVOR_PARLEY"
    | "WORKBENCH_UPGRADE"
    | "CRATE_CARD_DRAFT"
    | "EVENT_CHOICE"
    | "POST_COMBAT_REWARD"
    | "RUN_COMPLETE";
  selectedLocationId?: CityLocationId | null;
  building?: BuildingExploreState | null;
  activePatrolId?: string | null;
  ambushAdvantage?: boolean;
  persuadeAttemptedThisCombat?: boolean;
  turn: number;
  energy: number;
  maxEnergy: number;
  playerBlock: number;
  comboCount?: number;
  retainBlockTurns?: number;
  thorns?: number;
  gadgetTurretDmg?: number;
  gadgetsPlayedCount?: number;
  xpEarnedThisRun?: number;
  cardsCollectedThisRun?: string[];
  drawPile: CardInstance[];
  hand: CardInstance[];
  discardPile: CardInstance[];
  exhaustPile: CardInstance[];
  enemies: ActiveEnemy[];
  combatLog: string[];
  lootBag: Record<IngredientId, number>;
  capsLooted: number;
  cardChoices: string[];
  draftOptions?: DraftCardOption[];
  summaryNote: string;
  companion?: NightCompanionState | null;
}

export interface DailyLedgerStats {
  day: number;
  patronsServed: number;
  capsEarned: number;
  capsCreditIssued: number;
  xpEarnedToday?: number;
  intelUnlocked: string[];
  ambushTriggeredBy: string[];
  notableEvents: string[];
}

export interface CampaignSaveState {
  version: number;
  day: number;
  maxDays: number;
  phase: GamePhase;
  weatherIndex: number;
  caps: number;
  tavernSecurity: number;
  havenReputation: number;
  playerHp: number;
  playerMaxHp: number;
  rpg?: RpgCharacterState;
  inventory: Record<IngredientId, number>;
  npcs: Record<NpcId, QuantifiedNpcState>;
  proceduralProfiles?: Record<NpcId, NpcStaticProfile>;
  drifterCounter?: number;
  todayQueue: NpcId[];
  currentQueueIndex: number;
  currentTurnServedDrink: boolean;
  dialogueHistory: DialogueLine[];
  pendingOffer: PendingDecisionOffer | null;
  deckDefIds: string[];
  deckCards?: DeckCardEntry[];
  todayLedger: DailyLedgerStats;
  nightIntelUnlocked: boolean;
  nightIntelPatronName: string | null;
  nightAmbushTriggered: boolean;
  nightAmbushPatronName: string | null;
  nightBossWeakened: boolean;
  dailyBulletins?: DailyBulletin[];
  activeRumors?: TavernRumor[];
  nightCompanion?: NightCompanionState | null;
  activeCommission?: ActiveCommission | null;
  nightHitmanTriggered?: boolean;
  nightHitmanSponsor?: string | null;
  nightTrapCacheUnlocked?: boolean;
  nightRun: NightRunState | null;
  ruleLogs: RuleValidationLog[];
  soundEnabled: boolean;
  bgmEnabled?: boolean;
  ttsEnabled?: boolean;
  unlockedLoreIds?: string[];
}
