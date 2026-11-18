import {
  CampaignSaveState,
  CardDef,
  CraftedDrink,
  DailyBulletin,
  DrinkRecipePreset,
  EnemyIntentType,
  EnemyTemplate,
  IngredientDef,
  IngredientId,
  MainNpcId,
  ModularAvatarParts,
  NpcCompanionSkillDef,
  NpcId,
  NpcSecretAgenda,
  NpcStaticProfile,
  PourStyle,
  QuantifiedNpcState,
  TavernRumor,
} from "../types/game";
import {
  COMBO_CARD_LIBRARY,
  EXPANDED_REWARD_CARD_POOL,
} from "./rpgAndCards";
import {
  customPatronToStaticProfile,
  loadCharacterRoster,
} from "./settingsAndRosterStore";

export const ARTWORK_ASSETS = {
  titleEarly: "/src/assets/images/title_stage_early_1794901446103.jpg",
  titleThriving: "/src/assets/images/title_stage_thriving_1794901447138.jpg",
  tavernDay: "/src/assets/images/tavern_bar_day_1794898795731.jpg",
  // 纯正辐射废土铁皮防空洞酒馆第一人称背景与桌面/手记真实材质贴图
  tavernFpvHall: "/src/assets/images/wasteland_fpv_bunker_bar_1794908556307.jpg",
  barCounterTex: "/src/assets/images/bar_counter_surface_tex_1794908559963.jpg",
  journalSpreadBg: "/src/assets/images/journal_open_spread_bg_1794908565427.jpg",
  ruinsNight: "/src/assets/images/wasteland_ruins_night_1794898797282.jpg",
  nightCityMap: "/src/assets/images/night_city_aerial_map_1794966547784.jpg",
  locRuinedMart: "/src/assets/images/loc_ruined_mart_1794966550617.jpg",
  locShelledClinic: "/src/assets/images/loc_shelled_clinic_1794966552824.jpg",
  locScrapShipyard: "/src/assets/images/loc_scrap_shipyard_1794966555068.jpg",
  locCryoReactor: "/src/assets/images/loc_cryo_reactor_1794966556656.jpg",
  // 前景吧台全套真实手绘实物资产贴图（透明抠图 PNG）
  propPipboyBezel: "/assets/props/pipboy_bezel.png",
  propShakerCooler: "/assets/props/shaker_cooler.png",
  propBrassCoaster: "/assets/props/brass_coaster.png",
  propClipboardClip: "/assets/props/clipboard_clip.png",
  // 4位核心主角专属手绘无背景透明抠图立绘
  ashScavenger: "/assets/npcs/main_ash.png",
  k7Synth: "/assets/npcs/main_k7.png",
  buckRaider: "/assets/npcs/main_buck.png",
  moriMerchant: "/assets/npcs/main_mori.png",
  // 6种调酒原材料统一画风手绘贴图
  ingRadWater: "/src/assets/images/ing_rad_water_1794903457498.jpg?v=2",
  ingMutantPotato: "/src/assets/images/ing_mutant_potato_1794903457614.jpg?v=2",
  ingRustMalt: "/src/assets/images/ing_rust_malt_1794903458713.jpg?v=2",
  ingGlowShroom: "/src/assets/images/ing_glow_shroom_1794903459840.jpg?v=2",
  ingCalmHerb: "/src/assets/images/ing_calm_herb_1794903460875.jpg?v=2",
  ingCryoMint: "/src/assets/images/ing_cryo_mint_1794903462563.jpg",
  // 6款调制成品酒统一画风手绘贴图（含5大招牌酒 + 自由混调私酿）
  drinkRustGutBuster: "/src/assets/images/drink_rust_gut_buster_1794903463530.jpg",
  drinkAshWarmBrew: "/src/assets/images/drink_ash_warm_brew_1794903465650.jpg?v=2",
  drinkLuminescentCoolant: "/src/assets/images/drink_luminescent_coolant_1794903466326.jpg",
  drinkCaravanGoldTonic: "/src/assets/images/drink_caravan_gold_tonic_1794903468406.jpg",
  drinkWastelandLullaby: "/src/assets/images/drink_wasteland_lullaby_1794903471401.jpg",
  drinkCustomHouseBlend: "/src/assets/images/drink_custom_house_blend_1794903469692.jpg",
  // 黑夜据点剖面探索、战斗舞台、主角/常客全身战斗立绘、模块化腿部、意图图标与统一艺术牌框
  interiorCutawayFloors: "/src/assets/images/interior_cutaway_floors_1794967260041.jpg",
  combatArenaBackdrop: "/src/assets/images/combat_arena_backdrop_1794967261698.jpg",
  charBartenderScavenger: "/src/assets/images/protagonist_bartender_full_1794970565867.jpg",
  charBartenderAvatar: "/src/assets/images/protagonist_bartender_avatar_1794970569235.jpg",
  charNeutralSurvivor: "/src/assets/images/char_neutral_survivor_1794967265757.jpg",
  combatNpcAsh: "/src/assets/images/combat_npc_ash_1794970573587.jpg",
  combatNpcK7: "/src/assets/images/combat_npc_k7_v2_1794973699063.jpg",
  combatNpcBuck: "/src/assets/images/combat_npc_buck_1794970578651.jpg",
  combatNpcMori: "/src/assets/images/combat_npc_mori_1794970580038.jpg",
  modularLegsBurly: "/src/assets/images/modular_legs_burly_1794970582181.jpg",
  modularLegsStandard: "/src/assets/images/modular_legs_standard_1794970584055.jpg",
  modularLegsSlender: "/src/assets/images/modular_legs_slender_1794970585502.jpg",
  intentIconAttack: "/src/assets/images/intent_icon_attack_1794970587154.jpg",
  intentIconHeavy: "/src/assets/images/intent_icon_heavy_1794970588768.jpg",
  intentIconGuard: "/src/assets/images/intent_icon_guard_1794970590627.jpg",
  intentIconRad: "/src/assets/images/intent_icon_rad_1794970591548.jpg",
  intentIconSteal: "/src/assets/images/intent_icon_steal_1794970594823.jpg",
  cardFrameCommon: "/src/assets/images/card_frame_iron_unified_1794973701244.jpg",
  cardFrameRare: "/src/assets/images/card_frame_rare_1794970598857.jpg",
  cardFrameSignature: "/src/assets/images/card_frame_signature_unified_1794973700801.jpg",
  enemyAshRats: "/src/assets/images/enemy_ash_rats_1794967265908.jpg",
  enemyRadHound: "/src/assets/images/enemy_rad_hound_1794967267765.jpg",
  enemyHumanRaider: "/src/assets/images/enemy_human_raider_1794967270696.jpg",
  enemySyndicateHitman: "/src/assets/images/enemy_syndicate_hitman_1794967272065.jpg",
  enemySentryBot: "/src/assets/images/enemy_sentry_bot_1794967274870.jpg",
  enemyFrostClawBoss: "/src/assets/images/enemy_frost_claw_boss_1794967274781.jpg",
  propExitBlastDoor: "/src/assets/images/prop_exit_blast_door_1794967276782.jpg",
  propSupplyLocker: "/src/assets/images/prop_supply_locker_1794967277698.jpg",
  propWeaponCrate: "/src/assets/images/prop_weapon_crate_1794967279287.jpg",
  propTinkerWorkbench: "/src/assets/images/prop_tinker_workbench_1794967280502.jpg",
  cardArtGunslinger: "/src/assets/images/card_art_gunslinger_1794967283207.jpg",
  cardArtJuggernaut: "/src/assets/images/card_art_juggernaut_1794967283663.jpg",
  cardArtRadBio: "/src/assets/images/card_art_rad_bio_1794967284235.jpg",
  cardArtGadgetTrap: "/src/assets/images/card_art_gadget_trap_1794967285822.jpg",
  cardArtMeleeWrench: "/src/assets/images/card_art_melee_wrench_1794967287678.jpg",
  cardArtScavengeLoot: "/src/assets/images/card_art_scavenge_loot_1794967288931.jpg",
  // 独立调酒台场景、可互动分阶段酒杯、四大加工器具与皮革配方谱手绘资产
  bartendStationBg: "/src/assets/images/bartend_station_bg_1794978325590.jpg",
  propGlassEmpty: "/src/assets/images/prop_glass_empty_1794978326799.jpg",
  propGlassFillBase: "/src/assets/images/prop_glass_fill_base_1794978328043.jpg",
  propGlassFillMid: "/src/assets/images/prop_glass_fill_mid_1794978330223.jpg",
  propGlassFillFull: "/src/assets/images/prop_glass_fill_full_1794978331569.jpg",
  toolPeelBoard: "/src/assets/images/tool_peel_board_1794978333650.jpg",
  toolCrankJuicer: "/src/assets/images/tool_crank_juicer_1794978335713.jpg",
  toolIronMortar: "/src/assets/images/tool_iron_mortar_1794978336209.jpg",
  toolCharcoalFilter: "/src/assets/images/tool_charcoal_filter_1794978339103.jpg",
  propRecipeCodex: "/src/assets/images/prop_recipe_codex_1794978338126.jpg",
} as const;

export const WEATHER_CYCLE: string[] = [
  "铁锈色微尘风，能见度尚可，远处商道偶有驼铃声",
  "轻度辐射酸雾，空气里带着旧电池般的酸涩气味",
  "核冬寒潮南下，干冷灰烬像细雪一样敲打酒馆铁皮窗",
  "少见的澄澈黄昏，废墟高架桥后透出暖金色的落日余晖",
  "磁暴雷云压境，收音机里满是断续的静电杂音",
  "干热沙暴过境，每个推门进来的人靴子里都灌满了沙砾",
  "黎明前的漫长静夜，荒原各方势力都在寻找最后的避风港",
];

export const INGREDIENTS: Record<IngredientId, IngredientDef> = {
  rad_water: {
    id: "rad_water",
    name: "蒸馏辐射水",
    subtitle: "基础清冽液体 · 稀释与净底",
    imageUrl: ARTWORK_ASSETS.ingRadWater,
    rarity: "common",
    potencyBonus: 0,
    soothingBonus: 1,
    purificationBonus: 2,
    flavorTags: ["清冽", "净辐", "低刺激"],
    capValue: 2,
  },
  mutant_potato: {
    id: "mutant_potato",
    name: "变异土豆原浆",
    subtitle: "辛辣淀粉发酵 · 烈度与饱腹",
    imageUrl: ARTWORK_ASSETS.ingMutantPotato,
    rarity: "common",
    potencyBonus: 3,
    soothingBonus: 1,
    purificationBonus: 0,
    flavorTags: ["辛辣", "饱腹", "烈酒"],
    capValue: 3,
  },
  rust_malt: {
    id: "rust_malt",
    name: "铁锈烘麦芽",
    subtitle: "焦苦浓郁麦香 · 醇厚回甘",
    imageUrl: ARTWORK_ASSETS.ingRustMalt,
    rarity: "common",
    potencyBonus: 2,
    soothingBonus: 2,
    purificationBonus: 0,
    flavorTags: ["醇厚", "焦香", "烈酒"],
    capValue: 3,
  },
  glow_shroom: {
    id: "glow_shroom",
    name: "幽光菌菇露",
    subtitle: "地下冷库特产 · 奇异微光与净辐",
    imageUrl: ARTWORK_ASSETS.ingGlowShroom,
    rarity: "uncommon",
    potencyBonus: 1,
    soothingBonus: 1,
    purificationBonus: 4,
    flavorTags: ["净辐", "奇异", "微甜"],
    capValue: 5,
  },
  calm_herb: {
    id: "calm_herb",
    name: "荒原安神草",
    subtitle: "舒缓紧绷神经 · 显著压制暴躁张力",
    imageUrl: ARTWORK_ASSETS.ingCalmHerb,
    rarity: "uncommon",
    potencyBonus: 0,
    soothingBonus: 4,
    purificationBonus: 1,
    flavorTags: ["安神", "温和", "草本"],
    capValue: 5,
  },
  cryo_mint: {
    id: "cryo_mint",
    name: "核冬冰薄荷",
    subtitle: "极寒废墟结晶 · 精密降温与醒脑",
    imageUrl: ARTWORK_ASSETS.ingCryoMint,
    rarity: "rare",
    potencyBonus: 1,
    soothingBonus: 3,
    purificationBonus: 3,
    flavorTags: ["冰爽", "低刺激", "净辐", "微甜"],
    capValue: 7,
  },
};

export const INGREDIENT_LIST: IngredientDef[] = Object.values(INGREDIENTS);

export type BartendToolId =
  | "PEEL_BOARD"
  | "CRANK_JUICER"
  | "IRON_MORTAR"
  | "CHARCOAL_FILTER";

export interface PrepStageSpec {
  tool: BartendToolId;
  verb: string;
  clicks: number;
  resultLabel: string;
}

export interface IngredientPrepChain {
  ingredientId: IngredientId;
  rawLabel: string;
  preparedLabel: string;
  steps: PrepStageSpec[];
  shortStepSummary: string;
}

export const BARTEND_TOOL_META: Record<
  BartendToolId,
  {
    id: BartendToolId;
    name: string;
    shortVerb: string;
    imageUrl: string;
    hint: string;
  }
> = {
  PEEL_BOARD: {
    id: "PEEL_BOARD",
    name: "削皮砧板",
    shortVerb: "去皮",
    imageUrl: ARTWORK_ASSETS.toolPeelBoard,
    hint: "处理块茎外皮与冻结冰壳（变异土豆 / 核冬冰薄荷）",
  },
  CRANK_JUICER: {
    id: "CRANK_JUICER",
    name: "齿轮榨汁机",
    shortVerb: "榨汁",
    imageUrl: ARTWORK_ASSETS.toolCrankJuicer,
    hint: "压榨多汁菌盖与去皮块茎（幽光菌菇 / 去皮土豆块）",
  },
  IRON_MORTAR: {
    id: "IRON_MORTAR",
    name: "废铁石臼",
    shortVerb: "研磨",
    imageUrl: ARTWORK_ASSETS.toolIronMortar,
    hint: "碾碎烘麦、草叶与净薄荷（铁锈麦芽 / 安神草 / 净叶薄荷）",
  },
  CHARCOAL_FILTER: {
    id: "CHARCOAL_FILTER",
    name: "炭芯滤水壶",
    shortVerb: "净滤",
    imageUrl: ARTWORK_ASSETS.toolCharcoalFilter,
    hint: "滴滤提纯基底水源（蒸馏辐射水）",
  },
};

export const INGREDIENT_PREP_CHAIN: Record<IngredientId, IngredientPrepChain> = {
  rad_water: {
    ingredientId: "rad_water",
    rawLabel: "原罐辐射水",
    preparedLabel: "清冽净底水",
    steps: [
      {
        tool: "CHARCOAL_FILTER",
        verb: "滴滤",
        clicks: 2,
        resultLabel: "清冽净底水",
      },
    ],
    shortStepSummary: "炭芯滤壶滴滤 → 入杯",
  },
  mutant_potato: {
    ingredientId: "mutant_potato",
    rawLabel: "带皮变异土豆",
    preparedLabel: "辛辣土豆浆",
    steps: [
      {
        tool: "PEEL_BOARD",
        verb: "削皮",
        clicks: 2,
        resultLabel: "去皮土豆块",
      },
      {
        tool: "CRANK_JUICER",
        verb: "压浆",
        clicks: 2,
        resultLabel: "辛辣土豆浆",
      },
    ],
    shortStepSummary: "砧板削皮 → 榨汁机压浆 → 入杯",
  },
  rust_malt: {
    ingredientId: "rust_malt",
    rawLabel: "整粒铁锈麦",
    preparedLabel: "焦香麦芽粉",
    steps: [
      {
        tool: "IRON_MORTAR",
        verb: "碾碎",
        clicks: 2,
        resultLabel: "焦香麦芽粉",
      },
    ],
    shortStepSummary: "石臼碾碎 → 入杯",
  },
  glow_shroom: {
    ingredientId: "glow_shroom",
    rawLabel: "鲜采幽光菇",
    preparedLabel: "幽光菌纯露",
    steps: [
      {
        tool: "CRANK_JUICER",
        verb: "榨露",
        clicks: 2,
        resultLabel: "幽光菌纯露",
      },
    ],
    shortStepSummary: "榨汁机榨露 → 入杯",
  },
  calm_herb: {
    ingredientId: "calm_herb",
    rawLabel: "干束安神草",
    preparedLabel: "安神草萃汁",
    steps: [
      {
        tool: "IRON_MORTAR",
        verb: "捣汁",
        clicks: 2,
        resultLabel: "安神草萃汁",
      },
    ],
    shortStepSummary: "石臼捣汁 → 入杯",
  },
  cryo_mint: {
    ingredientId: "cryo_mint",
    rawLabel: "冻壳冰薄荷",
    preparedLabel: "冰薄荷晶露",
    steps: [
      {
        tool: "PEEL_BOARD",
        verb: "去壳",
        clicks: 2,
        resultLabel: "净叶冰薄荷",
      },
      {
        tool: "IRON_MORTAR",
        verb: "捣晶",
        clicks: 2,
        resultLabel: "冰薄荷晶露",
      },
    ],
    shortStepSummary: "砧板去冰壳 → 石臼捣晶 → 入杯",
  },
};

export const DRINK_PRESETS: DrinkRecipePreset[] = [
  {
    id: "rust_gut_buster",
    name: "铁锈烧刀子",
    tagline: "一口烧穿喉咙的废土硬汉烈酒",
    imageUrl: ARTWORK_ASSETS.drinkRustGutBuster,
    ingredients: ["mutant_potato", "mutant_potato", "rust_malt"],
    suggestedPrice: 14,
    flavorNotes: ["烈酒", "辛辣", "醇厚"],
  },
  {
    id: "ash_warm_brew",
    name: "废墟暖胃甜麦饮",
    tagline: "温和驱寒、带着焦麦香的落脚点热饮",
    imageUrl: ARTWORK_ASSETS.drinkAshWarmBrew,
    ingredients: ["rad_water", "mutant_potato", "rust_malt"],
    suggestedPrice: 11,
    flavorNotes: ["饱腹", "醇厚", "温和"],
  },
  {
    id: "luminescent_coolant",
    name: "荧光净辐冷萃",
    tagline: "专为过热神经与辐射体质调配的清冽特饮",
    imageUrl: ARTWORK_ASSETS.drinkLuminescentCoolant,
    ingredients: ["rad_water", "glow_shroom", "cryo_mint"],
    suggestedPrice: 18,
    flavorNotes: ["净辐", "冰爽", "低刺激"],
  },
  {
    id: "caravan_gold_tonic",
    name: "商队金算盘特调",
    tagline: "层次奇诡、回味微甜的老江湖私房酒",
    imageUrl: ARTWORK_ASSETS.drinkCaravanGoldTonic,
    ingredients: ["rust_malt", "glow_shroom", "calm_herb"],
    suggestedPrice: 17,
    flavorNotes: ["奇异", "微甜", "醇厚"],
  },
  {
    id: "wasteland_lullaby",
    name: "荒原安魂曲",
    tagline: "平息火药味与噩梦的草本镇静饮",
    imageUrl: ARTWORK_ASSETS.drinkWastelandLullaby,
    ingredients: ["rad_water", "calm_herb", "cryo_mint"],
    suggestedPrice: 16,
    flavorNotes: ["安神", "温和", "冰爽"],
  },
];

export function computeCraftedDrink(
  slots: [IngredientId, IngredientId, IngredientId],
  pourStyle: PourStyle
): CraftedDrink {
  const items = slots.map((id) => INGREDIENTS[id]);
  const sortedIds = [...slots].sort().join("|");
  const matchedPreset = DRINK_PRESETS.find(
    (p) => [...p.ingredients].sort().join("|") === sortedIds
  );

  let potency = items.reduce((sum, i) => sum + i.potencyBonus, 0);
  let soothing = items.reduce((sum, i) => sum + i.soothingBonus, 0);
  let purification = items.reduce((sum, i) => sum + i.purificationBonus, 0);
  const rawCost = items.reduce((sum, i) => sum + i.capValue, 0);

  const tagSet = new Set<string>();
  items.forEach((item) => item.flavorTags.forEach((t) => tagSet.add(t)));

  if (pourStyle === "generous") {
    potency = Math.min(10, potency + 1);
    soothing = Math.min(10, soothing + 2);
    tagSet.add("足量厚道");
  } else if (pourStyle === "watered") {
    potency = Math.max(0, potency - 2);
    soothing = Math.max(0, soothing - 1);
    tagSet.add("兑水寡淡");
  }

  const name = matchedPreset
    ? pourStyle === "generous"
      ? `满杯·${matchedPreset.name}`
      : pourStyle === "watered"
      ? `淡味·${matchedPreset.name}`
      : matchedPreset.name
    : `${items[0].name.slice(0, 2)}${items[1].name.slice(0, 2)}私酿`;

  // 确保任何配方与自由混调都有严丝合缝的统一手绘成品酒贴图
  let imageUrl: string = ARTWORK_ASSETS.drinkCustomHouseBlend;
  if (matchedPreset) {
    imageUrl = matchedPreset.imageUrl;
  } else if (slots.includes("cryo_mint") && slots.includes("glow_shroom")) {
    imageUrl = ARTWORK_ASSETS.drinkLuminescentCoolant;
  } else if (potency >= 7) {
    imageUrl = ARTWORK_ASSETS.drinkRustGutBuster;
  } else if (soothing >= 7 && slots.includes("calm_herb")) {
    imageUrl = ARTWORK_ASSETS.drinkWastelandLullaby;
  }

  const suggestedPrice = matchedPreset
    ? matchedPreset.suggestedPrice
    : Math.max(9, Math.round(rawCost * 1.55));

  return {
    name,
    imageUrl,
    ingredients: slots,
    ingredientsText: items.map((i) => i.name).join(" + "),
    pourStyle,
    potency: Math.min(10, potency),
    soothing: Math.min(10, soothing),
    purification: Math.min(10, purification),
    suggestedPrice,
    flavorTags: Array.from(tagSet),
  };
}

export const NPC_PROFILES: Record<MainNpcId, NpcStaticProfile> = {
  ash_scavenger: {
    id: "ash_scavenger",
    isMainCharacter: true,
    name: "阿灰",
    title: "零号街区拾荒客",
    faction: "独行拾荒者",
    portraitUrl: ARTWORK_ASSETS.ashScavenger,
    combatSpriteUrl: ARTWORK_ASSETS.combatNpcAsh,
    bio: "常年钻在核冬地下铁与坍塌超市里翻找零件的年轻拾荒客。嘴上总说只认瓶盖不认人，但谁对她有过一饭一酒之恩，她能记一辈子。",
    personaPrompt:
      "你是21岁的废土独行拾荒者阿灰。机警、嘴硬心软、说话干脆利落，总背着沉甸甸的扳手与撬棍。白天跑完废墟又饿又冷，想喝点暖胃饱腹或能缓解疲劳的酒水，讨厌寡淡兑水的假酒。",
    speechStyle:
      "短句为主，带一点街头俏皮和嘴硬，习惯称呼玩家为「老板」或「掌柜的」，常提到地下管网、生锈零件和东区废墟。",
    favoriteNotes: ["饱腹", "醇厚", "温和", "微甜"],
    dislikedNotes: ["兑水寡淡"],
    signatureCardId: "sig_ash_crowbar",
    intelThreshold: 55,
    giftCardThreshold: 72,
    brawlTensionThreshold: 82,
    quickTopics: [
      "今天在东区废墟翻到什么好货了？",
      "看你脸色冻得发白，想喝口暖胃的？",
      "外头都在传咱们酒馆的风声，你在集市听到了吗？",
    ],
    secretAgenda: {
      isUndercover: false,
      codeName: "CLEAN-01",
      surfaceAlibi: "在零号街区靠翻找管网旧零件换瓶盖维生的坦荡独行拾荒客。",
      trueIdentity: "零号街区独行拾荒客（底细清白）",
      secretGoal: "攒够过冬口粮并替地窖孤儿换净水滤芯。",
      probeKeywords: [],
      slipIntoxicationThreshold: 99,
      defaultClueText: "",
      bountyCaps: 0,
      hushCaps: 0,
      commissionTitle: "撬开坍塌地铁信号箱",
      commissionDesc: "肃清守在信号箱旁的失控无人机，替阿灰取回精密继电器。",
    },
    companionSkill: {
      name: "撬棍突袭·顺手摸宝",
      desc: "每回合结束对首名敌人造成 5 点伤害，每 2 回合顺手搜刮 1 份废墟食材。",
      kind: "ASSAULT_SCAVENGE",
      value: 5,
    },
  },
  k7_synth: {
    id: "k7_synth",
    isMainCharacter: true,
    name: "伊恩 · K-7",
    title: "逃亡的第三代合成人",
    faction: "脱网仿生体",
    portraitUrl: ARTWORK_ASSETS.k7Synth,
    combatSpriteUrl: ARTWORK_ASSETS.combatNpcK7,
    bio: "自称来自北境哨站的钟表与净水滤芯修缮匠，颌骨边缘却有一道极浅的仿生接缝。他害怕北方公司猎犬追踪，只能饮用纯净降温的冷饮冷却过载核心。",
    personaPrompt:
      "你是逃亡的第三代合成人 K-7（对外化名钟表匠伊恩）。克制、礼貌、略带疏离与哲学忧郁。你的仿生内循环害怕高烈度粗糙烈酒，偏爱净辐、冰爽、低刺激或安神的特饮。清醒时你会谨慎维持『北境钟表滤芯匠』的表面口供；若微醺松弛或被问及北方实验室、猎犬、体温回路时，可能不慎流露仿生编号破绽。",
    speechStyle:
      "克制温和，偶有微妙的精密比喻（如体温、噪声、回路、记忆扇区），对善意格外珍视。",
    favoriteNotes: ["净辐", "冰爽", "低刺激", "安神"],
    dislikedNotes: ["辛辣", "烈酒", "兑水寡淡"],
    signatureCardId: "sig_k7_shield",
    intelThreshold: 58,
    giftCardThreshold: 74,
    brawlTensionThreshold: 80,
    quickTopics: [
      "外头北方猎犬刚贴了悬赏电报，你真是普通钟表匠？",
      "你的核心温度看起来有点偏高，要来杯冷萃吗？",
      "放心，在我这间铁皮吧台没人查你的出厂回路。",
    ],
    secretAgenda: {
      isUndercover: true,
      codeName: "SYNTH-K7",
      surfaceAlibi: "自称从北境哨站南下谋生的精密钟表与净水滤芯修缮匠。",
      trueIdentity: "北方公司重金通缉的脱网第三代仿生合成人（编号 K-7）",
      secretGoal: "躲避猎犬追捕组，寻找能抹除体内定位信标的地下通道。",
      probeKeywords: ["北方", "合成人", "猎犬", "接缝", "回路", "编号", "钟表", "实验室"],
      slipIntoxicationThreshold: 22,
      defaultClueText:
        "微醺间下意识抬手按住颌骨金属接缝，脱口提到「K-7扇区冷却液过载」，与钟表匠口供完全不符！",
      bountyCaps: 28,
      hushCaps: 18,
      commissionTitle: "击毁地下铁猎犬信标站",
      commissionDesc: "潜入第 2 层管网摧毁北方公司投放的合成人追踪信标机。",
    },
    companionSkill: {
      name: "超频光学偏折盾",
      desc: "每回合结束为酒馆老板展开仿生护盾，自动获得 +6 点护甲并震慑首名敌人 3 点伤害。",
      kind: "OPTIC_SHIELD",
      value: 6,
    },
  },
  buck_raider: {
    id: "buck_raider",
    isMainCharacter: true,
    name: "老铁锤 · 巴克",
    title: "金盆洗手的掠夺者头目",
    faction: "铁锈帮旧部",
    portraitUrl: ARTWORK_ASSETS.buckRaider,
    combatSpriteUrl: ARTWORK_ASSETS.combatNpcBuck,
    bio: "左肩还留着弹孔铁甲的退役掠夺者老兵。厌倦了烧杀抢掠想找个安静吧台喝口真酒，但脾气依旧火爆——最恨酒保偷偷兑水糊弄，最服气敢多倒半杯真烈酒的实在人。",
    personaPrompt:
      "你是五十多岁的退役掠夺者头目巴克。嗓门洪亮、江湖气重、恩怨分明。你只爱够劲的辛辣烈酒和焦香麦芽，最痛恨兑水假酒或被人看不起。如果老板给你多倒半杯烈酒，你会拍着胸脯认他当兄弟，甚至愿意带霰弹枪陪老板夜闯废墟！",
    speechStyle:
      "豪爽粗粝，常敲着铁皮酒杯说话，爱提当年废土跑帮派的旧事。",
    favoriteNotes: ["烈酒", "辛辣", "醇厚", "足量厚道"],
    dislikedNotes: ["兑水寡淡", "低刺激"],
    signatureCardId: "sig_buck_shotgun",
    intelThreshold: 58,
    giftCardThreshold: 70,
    brawlTensionThreshold: 76,
    quickTopics: [
      "巴克老哥，今天还是老规矩要够劲的？",
      "最近铁锈帮那帮混小子还在废墟设卡吗？",
      "今晚废墟硬茬不少，喝痛快了敢不敢搭把手？",
    ],
    secretAgenda: {
      isUndercover: false,
      codeName: "CLEAN-02",
      surfaceAlibi: "早已退帮洗手、靠护送散商换酒喝的铁锈帮老头目。",
      trueIdentity: "金盆洗手的退役掠夺者老兵（言行一致）",
      secretGoal: "喝一口不掺水的烈酒，顺便替旧部清理背叛帮规的败类。",
      probeKeywords: [],
      slipIntoxicationThreshold: 99,
      defaultClueText: "",
      bountyCaps: 0,
      hushCaps: 0,
      commissionTitle: "肃清铁锈帮叛徒哨卡",
      commissionDesc: "前往第 2 层街区替巴克教训私设黑卡劫掠平民的帮派败类。",
    },
    companionSkill: {
      name: "双管铁砂压制轰击",
      desc: "每回合结束拔出短管霰弹枪轰击全场，对所有存活敌人造成 5 点范围伤害。",
      kind: "SHOTGUN_AOE",
      value: 5,
    },
  },
  mori_merchant: {
    id: "mori_merchant",
    isMainCharacter: true,
    name: "老算盘 · 莫里",
    title: "满嘴跑火车的商队老头",
    faction: "双头牛游商团",
    portraitUrl: ARTWORK_ASSETS.moriMerchant,
    combatSpriteUrl: ARTWORK_ASSETS.combatNpcMori,
    bio: "戴着裂片圆眼镜的荒原老行商，大衣里挂满了叮当乱响的旧钥匙和瓶盖袋。表面只卖滤水壶与咸肉罐头，大衣夹层里却疑似藏着违禁冷库密钥。",
    personaPrompt:
      "你是走南闯北的废土老行商莫里。精明诙谐、爱讲荒诞奇闻、总想砍价或赊小账，但绝对讲商道信用。对外你坚称只倒腾正经罐头百货；但喝到微醺（醉意较高）且被问起黑市密钥、违禁账本时，你会漏嘴说出自己正替黑市藏着一把军用冷库暗锁密钥！偏爱奇异、微甜、醇厚的特调。",
    speechStyle:
      "慢条斯理又妙语连珠，喜欢推眼镜、摸瓶盖袋，开口就是某年某月在几号避难所外头的见闻。",
    favoriteNotes: ["奇异", "微甜", "醇厚", "安神"],
    dislikedNotes: ["兑水寡淡"],
    signatureCardId: "sig_mori_dart",
    intelThreshold: 54,
    giftCardThreshold: 70,
    brawlTensionThreshold: 85,
    quickTopics: [
      "莫里老爷子，听说你大衣夹层里可不止罐头和滤芯吧？",
      "先说好，小本生意经不起你对半砍价啊。",
      "听说深层冷库有大块头守着，你黑市消息灵通给透个底？",
    ],
    secretAgenda: {
      isUndercover: true,
      codeName: "SMUGGLE-88",
      surfaceAlibi: "只做罐头、盐巴与旧滤芯买卖的守法双头牛老行商。",
      trueIdentity: "私藏旧时代军用冷库暗锁密钥与走私账册的黑市大掮客",
      secretGoal: "避开商道稽查队耳目，暗中转手一批高纯度核冬冰薄荷。",
      probeKeywords: ["夹层", "黑市", "密钥", "账本", "走私", "违禁", "冷库"],
      slipIntoxicationThreshold: 26,
      defaultClueText:
        "酒劲上头拍大衣口袋时掉出半截盖有军用铅封的冷库磁卡，嘴里嘟囔着「这批走私冰薄荷绝不能让稽查队截胡」！",
      bountyCaps: 24,
      hushCaps: 20,
      commissionTitle: "回收遗落的黑市铅封账匣",
      commissionDesc: "替莫里从第 2 层废墟暗哨手中夺回装有密钥的铅封铁匣。",
    },
    companionSkill: {
      name: "冷箭飞镖·顺手摸金",
      desc: "每回合结束射出黑市毒镖造成 4 点伤害，并替老板额外摸回 +3 枚瓶盖。",
      kind: "DART_CAPS",
      value: 4,
    },
  },
};

export const MAIN_NPC_ORDER: MainNpcId[] = [
  "ash_scavenger",
  "buck_raider",
  "k7_synth",
  "mori_merchant",
];

export const NPC_ORDER = MAIN_NPC_ORDER;

// ==================== 可复用素材自动拼接：过路废土客生成器 ====================

interface ProceduralArchetype {
  roleTitle: string;
  faction: string;
  bio: string;
  personaTemplate: string;
  speechStyle: string;
  favoriteNotes: string[];
  dislikedNotes: string[];
  preferredParts: Partial<ModularAvatarParts>;
  quickTopics: string[];
}

const PROCEDURAL_NAMES = [
  "重锤·阿泰",
  "锈钉·阿澈",
  "灰雀·琳达",
  "红炉·樊婶",
  "独眼·老韩",
  "白霜·诺拉",
  "铜管·麦克斯",
  "夜枭·秦",
  "电弧·花火",
  "铁轨·大熊",
  "沙砾·罗恩",
  "银针·陆大夫",
  "扳机·科尔",
  "煤渣·老周",
  "燧石·艾娃",
  "微光·零玖",
  "钢牙·巴顿",
  "风滚草·老唐",
];

const PROCEDURAL_ARCHETYPES: ProceduralArchetype[] = [
  {
    roleTitle: "重装动力甲拆解工",
    faction: "废铁船坞重工组",
    bio: "体格魁梧如铁塔的重装拆解工，胸前挂着旧时代液压动力骨架残件，呼吸面罩下嗓音浑厚如闷雷，干完体力活能一口闷掉整杯烈酒。",
    personaTemplate:
      "你是体格壮硕的废土动力甲拆解工。力大无穷、脾气耿直豪爽，拆了一整天生锈装甲板又渴又饿，钟爱烈酒、饱腹、足量厚道的饮品，最烦小家子气兑水。",
    speechStyle: "瓮声瓮气、实在豪爽，常提液压钳、反应堆铅板和船坞苦力活。",
    favoriteNotes: ["烈酒", "饱腹", "醇厚", "足量厚道"],
    dislikedNotes: ["兑水寡淡", "低刺激"],
    preferredParts: {
      bodyBuild: 0,
      coatStyle: 0,
      faceShape: 0,
      backGear: 0,
      headgear: 4,
    },
    quickTopics: [
      "今天船坞那边拆出旧时代动力核心了吗？",
      "看你这身液压骨架够沉的，来杯满杯烈酒解乏？",
      "重工区夜里有什么失控机甲在游荡吗？",
    ],
  },
  {
    roleTitle: "荒原巡路快信使",
    faction: "灰烬邮差行会",
    bio: "背着短波电台在各防空洞聚落间送信的独行邮差，脚程极快但神经高度紧绷，急需冰爽或净辐饮品提神降温。",
    personaTemplate:
      "你是穿越辐射区送信的荒原信使。警觉敏锐、语速偏快，刚甩掉两只辐射猎犬跑进酒馆喘口气，偏爱冰爽、净辐、清冽的饮品，不想喝太烈容易误事的酒。",
    speechStyle: "简短机敏，常提到路况、风向、哨卡和加密电报。",
    favoriteNotes: ["冰爽", "净辐", "清冽", "微甜"],
    dislikedNotes: ["烈酒", "兑水寡淡"],
    preferredParts: {
      bodyBuild: 1,
      coatStyle: 0,
      faceShape: 3,
      backGear: 2,
      headgear: 2,
    },
    quickTopics: [
      "外头商道今天好走吗？有没有掠夺者设卡？",
      "跑了几十里灰烬路，来杯冰爽提神的？",
      "信使行会最近有什么新鲜传闻？",
    ],
  },
  {
    roleTitle: "废墟狙击女斥候",
    faction: "高架桥守望哨",
    bio: "身形矫健纤细的高架桥轻装斥候，披着破损光学迷彩披肩，唇角留着细疤，目光像鹰一样锐利。",
    personaTemplate:
      "你是驻守断桥高处的废墟女斥候。冷静克制、观察入微，夜间还要值哨所以偏爱冰爽、净辐、草本或低刺激的清醒特调，厌恶辛辣劣酒。",
    speechStyle: "干净利落、冷静敏锐，常提到视野、风速、制高点与变异兽动向。",
    favoriteNotes: ["冰爽", "净辐", "草本", "低刺激"],
    dislikedNotes: ["辛辣", "烈酒", "兑水寡淡"],
    preferredParts: {
      bodyBuild: 2,
      coatStyle: 1,
      faceShape: 0,
      backGear: 1,
      headgear: 4,
    },
    quickTopics: [
      "高架桥哨塔今天视野怎么样？",
      "今晚还要值夜哨？给你调杯清醒净辐的。",
      "从桥顶望过去，哪片废墟夜里最危险？",
    ],
  },
  {
    roleTitle: "黑铁铺掌炉大婶",
    faction: "地下集市互助灶",
    bio: "膀大腰圆、挽着花白发髻的铁匠铺兼大锅灶掌勺大婶，系着厚重牛皮围裙，笑声敞亮，最懂品鉴粮食发酵的醇厚真味。",
    personaTemplate:
      "你是地下集市人缘极好的掌炉铁匠大婶。热心肠、嗓门亮、眼里揉不得沙子。你干了一天炉火活想喝口醇厚、微甜或温和润嗓的好酒，最瞧不起掺水假酒。",
    speechStyle: "亲切爽利的大姐大口吻，爱拿炖锅、炉火和集市家长里短打比方。",
    favoriteNotes: ["醇厚", "微甜", "温和", "饱腹"],
    dislikedNotes: ["兑水寡淡"],
    preferredParts: {
      bodyBuild: 0,
      coatStyle: 2,
      faceShape: 1,
      backGear: 4,
      headgear: 4,
    },
    quickTopics: [
      "大婶今天集市炉子忙坏了吧，喝口润嗓子的？",
      "最近集市上大伙都在愁什么紧俏物资？",
      "尝尝我这杯手艺，够不够实在？",
    ],
  },
  {
    roleTitle: "高压管网老焊工",
    faction: "防空洞工程队",
    bio: "常年猫在幽暗潮湿的防空洞蒸汽管道里抢修阀门，钢盔护目镜上总沾着焊渣，最馋一口醇厚驱寒的麦芽烈饮。",
    personaTemplate:
      "你是在废土地下管网干了十几年的老焊工。性格实在、说话直爽，干完重活嗓子冒烟，喜欢醇厚、辛辣或饱腹的实在酒水，反感兑水糊弄。",
    speechStyle: "朴实干脆，爱用焊枪、气压阀和防空洞管道打比方。",
    favoriteNotes: ["醇厚", "辛辣", "饱腹"],
    dislikedNotes: ["兑水寡淡"],
    preferredParts: {
      bodyBuild: 1,
      coatStyle: 1,
      faceShape: 0,
      backGear: 0,
      headgear: 1,
    },
    quickTopics: [
      "今天防空洞蒸汽阀的辐射泄漏稳住了吗？",
      "焊了一整天铁板，来杯够劲解乏的？",
      "你在下层管网见过没被翻过的储藏室吗？",
    ],
  },
  {
    roleTitle: "战地义诊老军医",
    faction: "绿洲巡回医疗站",
    bio: "清癯消瘦、戴着黄铜单边放大镜片的白发老军医，泛黄白大褂里插满试剂瓶，背着发光菌菇药篓四处救治辐射病人。",
    personaTemplate:
      "你是走南闯北的废土战地老军医。温和儒雅、医术精湛但身心俱疲。你极懂品鉴草本、安神、净辐与奇异菌菇配方的调酒，讨厌刺喉伤胃的劣质烈酒。",
    speechStyle: "温和慢条斯理，偶尔点评酒里的菌菇活性、草药成色与安神功效。",
    favoriteNotes: ["安神", "净辐", "草本", "奇异"],
    dislikedNotes: ["辛辣", "烈酒", "兑水寡淡"],
    preferredParts: {
      bodyBuild: 2,
      coatStyle: 2,
      faceShape: 1,
      backGear: 4,
      headgear: 4,
    },
    quickTopics: [
      "老先生，最近核冬冻伤和辐射病人多吗？",
      "请您品鉴一下这杯幽光菌菇与安神草的配比。",
      "深层冷库里真有高纯度的核冬冰薄荷吗？",
    ],
  },
  {
    roleTitle: "独眼破城重装老兵",
    faction: "北境自由佣兵",
    bio: "虎背熊腰、留着浓密八字胡的独眼退役重装佣兵，披着挂满黄铜弹链的加厚防寒甲，背后交叉背着砍刀与短管霰弹枪。",
    personaTemplate:
      "你是替商队卖命护卫的魁梧独眼老佣兵。冷峻硬派、认钱也认人情。刚打完一场硬仗进店歇脚，钟爱烈酒、辛辣、足量厚道的硬汉饮品，被怠慢时容易拍桌发火。",
    speechStyle: "低沉粗犷、江湖味十足，说到重火力和荒原怪物弱点时格外内行。",
    favoriteNotes: ["烈酒", "辛辣", "足量厚道"],
    dislikedNotes: ["兑水寡淡", "低刺激"],
    preferredParts: {
      bodyBuild: 0,
      coatStyle: 3,
      faceShape: 2,
      backGear: 5,
      headgear: 3,
    },
    quickTopics: [
      "押完这一趟重镖，今晚总算能喘口气了吧？",
      "看你霰弹枪管还热着，外头刚交过火？",
      "给硬汉满上一杯够烈不掺水的真酒！",
    ],
  },
  {
    roleTitle: "蒙面沙暴勘探客",
    faction: "自由掘金人",
    bio: "裹着暗红防沙面巾与宽檐旧皮帽的遗迹掘金客，背着重型鹤嘴镐专挖旧时代掩体，爱喝微甜奇异的新鲜特调。",
    personaTemplate:
      "你是痴迷发掘旧时代地堡的蒙面勘探客。神秘健谈、带点小精明，有时手头紧会想讲个小价，但喝到微甜、奇异或醇厚的好酒会大方分享废墟暗门情报！",
    speechStyle: "带着面巾闷响却神采飞扬，喜欢比划旧时代避难所的暗格构造。",
    favoriteNotes: ["微甜", "奇异", "醇厚", "净辐"],
    dislikedNotes: ["兑水寡淡"],
    preferredParts: {
      bodyBuild: 1,
      coatStyle: 2,
      faceShape: 4,
      backGear: 3,
      headgear: 0,
    },
    quickTopics: [
      "今天又在哪座防空洞底下挖到旧时代好货了？",
      "来杯层次奇特的特调给你洗洗沙尘？",
      "深层废墟那边有什么机关暗门要留神？",
    ],
  },
  {
    roleTitle: "废土朋克改装师",
    faction: "霓虹焊枪帮",
    bio: "身材纤瘦敏捷的红发侧剃朋克少女，穿着尖刺短皮甲与缠绷带护腕，专精改装激光瞄具与旧时代电子锁。",
    personaTemplate:
      "你是古灵精怪的废土朋克武器改装师。嘴快心直、喜欢新奇刺激的风味，偏爱奇异、冰爽、微甜的特调饮品，讨厌死气沉沉的寡淡兑水酒。",
    speechStyle: "俏皮跳脱，爱夹杂改装术语、电火花和霓虹灯牌的比喻。",
    favoriteNotes: ["奇异", "冰爽", "微甜"],
    dislikedNotes: ["兑水寡淡"],
    preferredParts: {
      bodyBuild: 2,
      coatStyle: 3,
      faceShape: 2,
      backGear: 5,
      headgear: 3,
    },
    quickTopics: [
      "最近又捣鼓出什么稀奇古怪的改装件了？",
      "给你调一杯泛着荧光的新潮特饮尝尝？",
      "冷库那台安保机甲的电子锁有什么破绽吗？",
    ],
  },
];

const PROCEDURAL_UNDERCOVER_POOL: Array<{
  codeName: string;
  trueIdentity: string;
  secretGoal: string;
  probeKeywords: string[];
  probeTopic: string;
  bulletinTitle: string;
  bulletinHint: string;
  defaultClueSuffix: string;
  bountyCaps: number;
  hushCaps: number;
  commissionTitle: string;
  commissionDesc: string;
}> = [
  {
    codeName: "HOUND-14",
    trueIdentity: "北方公司潜伏暗探（合成人追捕组耳目）",
    secretGoal: "借歇脚之名排查酒馆常客名单，定位脱网合成人 K-7 的藏身处。",
    probeKeywords: ["北方", "猎犬", "电台", "名单", "合成人", "哨卡", "口令"],
    probeTopic: "看你腰间短波频段不太像普通民用台，替哪边跑差事的？",
    bulletinTitle: "截获电报 · 北方猎犬便衣耳目渗透东区",
    bulletinHint:
      "嫌犯常伪装成普通行会过客探听常客底细；催醉至微醺（醉意≥24）并盘问其电台频段或雇主口令即可套出马脚。",
    defaultClueSuffix:
      "酒意微醺时错把行会暗号说成了「北方猎犬四组回收频段」，袖口露出公司猎捕组烙印！",
    bountyCaps: 26,
    hushCaps: 17,
    commissionTitle: "截获猎犬小队密电箱",
    commissionDesc: "在废墟第 2 层伏击落单的猎犬通信兵，销毁常客排查名单。",
  },
  {
    codeName: "RUST-09",
    trueIdentity: "卷走帮派军饷潜逃的铁锈帮内鬼账房",
    secretGoal: "在酒馆混过今晚风声，天亮前带着赃款瓶盖翻越断桥逃往南境。",
    probeKeywords: ["军饷", "铁锈帮", "赃款", "账房", "断桥", "追杀", "箱子"],
    probeTopic: "外头铁锈帮正在全街搜查失窃军饷箱，你这包袱看着可不轻啊？",
    bulletinTitle: "通缉悬赏 · 铁锈帮携款潜逃内鬼",
    bulletinHint:
      "嫌犯冒充手艺人或苦力躲避追查，随身紧护沉重暗袋；多倒烈酒催醉（醉意≥24）再盘问包袱与铁锈帮动向极易失言。",
    defaultClueSuffix:
      "几口烈酒下肚后死死按住内袋，冷汗直冒地漏嘴：「那箱铁锈帮军饷老子一分都不会吐出来」！",
    bountyCaps: 25,
    hushCaps: 19,
    commissionTitle: "起出掩埋的私藏军饷匣",
    commissionDesc: "按内鬼画出的废墟坐标肃清游荡恶徒，分润埋在瓦砾下的军饷物资。",
  },
  {
    codeName: "VAULT-31",
    trueIdentity: "地下黑市违禁辐射药剂调配通缉犯",
    secretGoal: "用假身份收购高纯度幽光菌菇与冰薄荷，提炼违禁兴奋针剂牟暴利。",
    probeKeywords: ["药剂", "黑市", "针剂", "通缉", "提纯", "冷库", "买家"],
    probeTopic: "治安哨刚发了违禁兴奋针剂的通缉单，你对菌菇提纯怎么这么熟？",
    bulletinTitle: "治安急电 · 违禁辐射针剂通缉犯流窜",
    bulletinHint:
      "嫌犯熟稔草本与电子改装，常借品酒打听冷库菌菇货源；催醉至微醺（醉意≥24）后试探其黑市买家即可拆穿。",
    defaultClueSuffix:
      "微醺后盯着杯中荧光喃喃自语：「这成色提炼三支狂暴针够黑市买家出双倍价了」，彻底暴露通缉犯真身！",
    bountyCaps: 24,
    hushCaps: 18,
    commissionTitle: "接手黑市遗弃冷藏试剂箱",
    commissionDesc: "前往第 2 层冷库外围清剿变异守卫，搬回整箱高纯度调酒菌菇。",
  },
];

function buildDrifterCompanionSkill(bodyBuild: number): NpcCompanionSkillDef {
  if (bodyBuild === 0) {
    return {
      name: "重锤破甲援护",
      desc: "每回合结束抡起重型液压锤猛击首名敌人，造成 6 点高额伤害。",
      kind: "HEAVY_BLOW",
      value: 6,
    };
  }
  if (bodyBuild === 2) {
    return {
      name: "战地急救与冷枪",
      desc: "每回合结束替老板包扎恢复 +3 点生命，并点射首名敌人造成 4 点伤害。",
      kind: "FIELD_MEDIC",
      value: 4,
    };
  }
  return {
    name: "废墟侧翼掩护",
    desc: "每回合结束从侧翼火力支援造成 5 点伤害，每 2 回合顺手搜刮 1 份食材。",
    kind: "ASSAULT_SCAVENGE",
    value: 5,
  };
}

export function createProceduralPatron(
  day: number,
  serial: number
): { profile: NpcStaticProfile; initialState: QuantifiedNpcState } {
  const seed = day * 17 + serial * 11;
  const archIndex = (serial - 1 + (day - 1) * 2) % PROCEDURAL_ARCHETYPES.length;
  const arch = PROCEDURAL_ARCHETYPES[archIndex];
  const name = PROCEDURAL_NAMES[(serial + day * 3) % PROCEDURAL_NAMES.length];
  const id: NpcId = `drifter_d${day}_${serial}`;

  const bodyBuild = arch.preferredParts.bodyBuild ?? serial % 3;
  // 在匹配体型的专属资产池内做自然拼装变化，确保头颈肩比例严丝合缝且千人千面
  const varyWithinPool = serial >= PROCEDURAL_ARCHETYPES.length;

  const modularParts: ModularAvatarParts = {
    bodyBuild,
    paletteIndex: (seed + serial) % 5,
    backGear: varyWithinPool
      ? (seed + serial) % 7
      : (arch.preferredParts.backGear ?? seed % 7),
    coatStyle: varyWithinPool
      ? (seed + 1) % 4
      : (arch.preferredParts.coatStyle ?? seed % 4),
    neckwear: bodyBuild,
    faceShape: varyWithinPool
      ? (seed + 2) % 4
      : (arch.preferredParts.faceShape ?? seed % 4),
    featureMark: (seed + 1) % 5,
    eyeStyle: (seed + 4) % 5,
    headgear: varyWithinPool
      ? (seed + 3) % 5
      : (arch.preferredParts.headgear ?? seed % 5),
  };

  // 随机分配一张稀有实战战术卡作为该过客高信任时的赠礼
  const rareGiftPool = [
    "card_treasure_hound",
    "card_adrenaline_shot",
    "card_pipe_grenade",
    "card_deep_forage",
  ];
  const assignedCardId = rareGiftPool[serial % rareGiftPool.length];

  // 每天首个散客及多数散客携带隐秘双层身份，驱动「侦探酒保：电报比对 + 控酒套话 + 三向摊牌」核心玩法
  const isUndercover = serial % 4 !== 0;
  const undercoverTpl =
    PROCEDURAL_UNDERCOVER_POOL[(day + serial) % PROCEDURAL_UNDERCOVER_POOL.length];
  const slipThreshold = 22 + (seed % 7); // 22..28，一杯烈酒或两轮微醺即可催醉套话

  const secretAgenda: NpcSecretAgenda = isUndercover
    ? {
        isUndercover: true,
        codeName: undercoverTpl.codeName,
        surfaceAlibi: `自称是隶属「${arch.faction}」的普通${arch.roleTitle}，进店只为歇脚避寒。`,
        trueIdentity: undercoverTpl.trueIdentity,
        secretGoal: undercoverTpl.secretGoal,
        probeKeywords: undercoverTpl.probeKeywords,
        slipIntoxicationThreshold: slipThreshold,
        defaultClueText: `${name}${undercoverTpl.defaultClueSuffix}`,
        bountyCaps: undercoverTpl.bountyCaps,
        hushCaps: undercoverTpl.hushCaps,
        commissionTitle: undercoverTpl.commissionTitle,
        commissionDesc: undercoverTpl.commissionDesc,
      }
    : {
        isUndercover: false,
        codeName: "PASSER-00",
        surfaceAlibi: `隶属「${arch.faction}」的本分${arch.roleTitle}，身份与通行证核验无误。`,
        trueIdentity: `${arch.faction} · ${arch.roleTitle}`,
        secretGoal: "喝口热乎酒水歇脚，打听今晚哪条商道最安全。",
        probeKeywords: [],
        slipIntoxicationThreshold: 99,
        defaultClueText: "",
        bountyCaps: 0,
        hushCaps: 0,
        commissionTitle: "护送遗落工具箱",
        commissionDesc: "顺路从第 2 层废墟带回失落的专业工具包。",
      };

  const quickTopics = isUndercover
    ? [arch.quickTopics[0], undercoverTpl.probeTopic, arch.quickTopics[1]]
    : arch.quickTopics;

  const personaSuffix = isUndercover
    ? `【隐秘双层身份】你表面上伪装成「${arch.faction}的${arch.roleTitle}」，但真实身份其实是「${undercoverTpl.trueIdentity}」，暗中目的：${undercoverTpl.secretGoal}。清醒时务必掩饰真实身份，一旦醉意达到 ${slipThreshold} 以上或喝了烈酒被追问破绽，会在言辞间不小心说漏嘴！`
    : "";

  const profile: NpcStaticProfile = {
    id,
    isMainCharacter: false,
    name,
    title: arch.roleTitle,
    faction: arch.faction,
    modularParts,
    bio: arch.bio,
    personaPrompt: `你是过路废土客「${name}」（表面身份：${arch.roleTitle}）。${arch.personaTemplate}${personaSuffix}`,
    speechStyle: arch.speechStyle,
    favoriteNotes: arch.favoriteNotes,
    dislikedNotes: arch.dislikedNotes,
    signatureCardId: assignedCardId,
    intelThreshold: 54,
    giftCardThreshold: 68,
    brawlTensionThreshold: 78,
    quickTopics,
    secretAgenda,
    companionSkill: buildDrifterCompanionSkill(bodyBuild),
  };

  const initialState: QuantifiedNpcState = {
    id,
    trust: 40 + (seed % 9),
    intoxication: 0,
    tension: 22 + (seed % 16),
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

  return { profile, initialState };
}

/**
 * 统一解析主要常客、人物库原创酒客或自动拼接过路客档案，并实时叠加玩家在「人物库」设置的立绘替换
 */
export function resolveNpcProfile(
  state: CampaignSaveState,
  npcId: NpcId
): NpcStaticProfile {
  const roster = loadCharacterRoster();

  if (npcId in NPC_PROFILES) {
    const base = NPC_PROFILES[npcId as MainNpcId];
    const override = roster.npcOverrides[npcId as MainNpcId];
    if (!override || (!override.portraitUrl && !override.combatSpriteUrl)) {
      return base;
    }
    return {
      ...base,
      portraitUrl: override.portraitUrl || base.portraitUrl,
      combatSpriteUrl: override.combatSpriteUrl || base.combatSpriteUrl,
    };
  }

  const customMatch = roster.customPatrons.find((c) => c.id === npcId);
  if (customMatch) {
    return customPatronToStaticProfile(customMatch);
  }

  const procedural = state.proceduralProfiles?.[npcId];
  if (procedural) {
    return procedural;
  }
  return createProceduralPatron(state.day || 1, 1).profile;
}

export function resolveProtagonistSprites(): {
  name: string;
  avatarUrl: string;
  combatSpriteUrl: string;
} {
  const roster = loadCharacterRoster();
  return {
    name: roster.protagonist.name?.trim() || "酒馆掌柜",
    avatarUrl:
      roster.protagonist.avatarUrl || ARTWORK_ASSETS.charBartenderAvatar,
    combatSpriteUrl:
      roster.protagonist.combatSpriteUrl ||
      ARTWORK_ASSETS.charBartenderScavenger,
  };
}

export interface RumorSeedTemplate {
  id: string;
  label: string;
  shortTag: string;
  title: string;
  detail: string;
  tone: TavernRumor["tone"];
  trustMod: number;
  tensionMod: number;
  nightBonus: TavernRumor["nightBonus"];
}

export const RUMOR_SEED_TEMPLATES: RumorSeedTemplate[] = [
  {
    id: "seed_generous_haven",
    label: "放风：酒足情义重",
    shortTag: "后续进店信任 +8",
    title: "酒足饭饱的荒原避风港",
    detail: "集市传遍这家酒馆从不掺假水、掌柜重情义，各路拾荒客进门就先添三分亲近。",
    tone: "WARM",
    trustMod: 8,
    tensionMod: -4,
    nightBonus: null,
  },
  {
    id: "seed_iron_deterrence",
    label: "放风：后台硬莫闹事",
    shortTag: "后续进店张力 -12",
    title: "铁血掌柜坐镇·闹事者莫入",
    detail: "道上都在传酒馆老板连铁锈帮和密探都敢硬刚，刺头进门前都得先把枪栓摁回去。",
    tone: "RUTHLESS",
    trustMod: 0,
    tensionMod: -12,
    nightBonus: "CALM",
  },
  {
    id: "seed_vault_bait",
    label: "放风：冷库重宝引线",
    shortTag: "信任 +4 · 夜探爆率提升",
    title: "东区冷库暗藏旧时代重宝",
    detail: "你托熟客散出半真半假的冷库秘闻，引得各方知情人主动登门交换情报与委托。",
    tone: "CUNNING",
    trustMod: 4,
    tensionMod: -2,
    nightBonus: "LOOT",
  },
];

/**
 * 根据当日排队客人的真实双层身份，生成哔哔小子「电报」频道的加密通缉与暗线简报
 */
export function generateDailyBulletins(
  day: number,
  queueProfiles: NpcStaticProfile[]
): DailyBulletin[] {
  const bulletins: DailyBulletin[] = [];

  queueProfiles.forEach((p) => {
    if (!p.secretAgenda?.isUndercover) return;
    if (p.id === "k7_synth") {
      bulletins.push({
        id: `bul_${day}_k7`,
        code: "SYNTH-K7",
        title: "北方公司密电 · 缉拿脱网合成人",
        clueHint:
          "目标伪装成钟表滤芯匠，颌骨有极浅接缝且忌惮烈酒；微醺（醉意≥22）或谈及回路/猎犬时易露破绽。可举报领赏，亦可暗中包庇或喂假坐标反制猎犬！",
        bountyCaps: p.secretAgenda.bountyCaps,
      });
    } else if (p.id === "mori_merchant") {
      bulletins.push({
        id: `bul_${day}_mori`,
        code: "SMUGGLE-88",
        title: "商道稽查电报 · 追查军用冷库走私密钥",
        clueHint:
          "一名老行商表面只卖罐头滤芯，实则大衣夹层私藏军用冷库磁卡；催醉（醉意≥26）并盘问黑市密钥可套出实情。",
        bountyCaps: p.secretAgenda.bountyCaps,
      });
    } else {
      bulletins.push({
        id: `bul_${day}_${p.id}`,
        code: p.secretAgenda.codeName,
        title: `治安截获电报 · 警惕伪装「${p.title}」`,
        clueHint: `今日进店的某位「${p.title}」涉嫌隐瞒真身（${p.secretAgenda.trueIdentity.slice(
          0,
          10
        )}…）。调烈酒催醉（醉意≥${p.secretAgenda.slipIntoxicationThreshold}）结合话术盘问可抓获口供破绽！`,
        bountyCaps: p.secretAgenda.bountyCaps,
      });
    }
  });

  if (bulletins.length === 0) {
    bulletins.push({
      id: `bul_${day}_clear`,
      code: `RADIO-D0${day}`,
      title: "灰烬短波台 · 东区商道暂未发现潜伏密探",
      clueHint:
        "今日排队熟客底细清晰，若点击「加迎散客」招揽门外过路人，需留心比对其表面口供与微醺言辞。",
      bountyCaps: 0,
    });
  }

  return bulletins.slice(0, 3);
}

// ==================== Nighttime Roguelike Cards ====================

export const CARD_LIBRARY: Record<string, CardDef> = COMBO_CARD_LIBRARY;

export const STARTER_DECK_IDS: string[] = [
  "starter_wrench_strike",
  "starter_wrench_strike",
  "starter_iron_door",
  "starter_iron_door",
  "starter_rummage",
  "starter_bottle_slash",
  "starter_lantern_flare",
  "card_snap_aim",
  "card_weld_bulkhead",
  "card_spore_flask",
];

export const REWARD_CARD_POOL: string[] = EXPANDED_REWARD_CARD_POOL;

export const ENEMY_TEMPLATES: Record<string, EnemyTemplate> = {
  ash_rats: {
    id: "ash_rats",
    name: "变异灰烬腐鼠",
    subtitle: "嗜食发酵淀粉的废墟鼠群",
    maxHp: 22,
    lootCount: 2,
    capReward: 5,
    xpReward: 18,
    intents: [
      { type: "ATTACK", value: 6, label: "扑咬撕扯 6" },
      { type: "STEAL_LOOT", value: 5, label: "啃咬抢夺 5" },
      { type: "HEAVY_ATTACK", value: 9, label: "狂暴猛扑 9" },
    ],
  },
  rad_hound: {
    id: "rad_hound",
    name: "双头辐射猎犬",
    subtitle: "嗅觉敏锐的荒原掠食者",
    maxHp: 28,
    lootCount: 2,
    capReward: 7,
    xpReward: 22,
    intents: [
      { type: "ATTACK", value: 8, label: "利齿突袭 8" },
      { type: "RAD_HOWL", value: 6, label: "辐射嚎叫 6" },
      { type: "HEAVY_ATTACK", value: 11, label: "双首撕咬 11" },
    ],
  },
  scrap_looter: {
    id: "scrap_looter",
    name: "夜游拾荒恶徒",
    subtitle: "人类劫匪 · 残血时可用「口才」劝降缴械",
    maxHp: 32,
    isHuman: true,
    lootCount: 2,
    capReward: 9,
    xpReward: 25,
    intents: [
      { type: "ATTACK", value: 7, label: "铁管挥击 7" },
      { type: "GUARD_HEAL", value: 6, label: "掩体整备 +6" },
      { type: "HEAVY_ATTACK", value: 12, label: "阴险重劈 12" },
    ],
  },
  sentry_bot: {
    id: "sentry_bot",
    name: "失控冷库安保机甲",
    subtitle: "精英守卫 · 死守旧时代物资库",
    maxHp: 46,
    isElite: true,
    lootCount: 4,
    capReward: 15,
    xpReward: 42,
    intents: [
      { type: "GUARD_HEAL", value: 8, label: "装甲充能 +8" },
      { type: "HEAVY_ATTACK", value: 14, label: "高能电弧炮 14" },
      { type: "ATTACK", value: 10, label: "镇压扫射 10" },
    ],
  },
  raider_ambusher: {
    id: "raider_ambusher",
    name: "寻仇的铁锈伏击手",
    subtitle: "人类匪徒 · 白昼结仇报复（残血可劝降）",
    maxHp: 42,
    isHuman: true,
    isElite: true,
    lootCount: 3,
    capReward: 14,
    xpReward: 40,
    intents: [
      { type: "HEAVY_ATTACK", value: 13, label: "报复狙击 13" },
      { type: "STEAL_LOOT", value: 9, label: "劫掠扫射 9" },
      { type: "ATTACK", value: 11, label: "连环劈砍 11" },
    ],
  },
  syndicate_hitman: {
    id: "syndicate_hitman",
    name: "买凶清算猎手",
    subtitle: "人类杀手 · 因白昼拆穿密探招来（残血可劝降）",
    maxHp: 48,
    isHuman: true,
    isElite: true,
    lootCount: 4,
    capReward: 19,
    xpReward: 48,
    intents: [
      { type: "HEAVY_ATTACK", value: 14, label: "消音穿甲弹 14" },
      { type: "GUARD_HEAL", value: 8, label: "光学迷彩掩体 +8" },
      { type: "ATTACK", value: 12, label: "双枪追猎 12" },
    ],
  },
  beacon_drone: {
    id: "beacon_drone",
    name: "猎犬加密信标卫队",
    subtitle: "常客专属委托目标 · 驻守深层信标箱",
    maxHp: 38,
    isElite: true,
    lootCount: 3,
    capReward: 16,
    xpReward: 42,
    intents: [
      { type: "RAD_HOWL", value: 9, label: "脉冲干扰束 9" },
      { type: "GUARD_HEAL", value: 7, label: "力场校准 +7" },
      { type: "HEAVY_ATTACK", value: 12, label: "锁定齐射 12" },
    ],
  },
  frost_claw_boss: {
    id: "frost_claw_boss",
    name: "核冬巢穴巨钳兽",
    subtitle: "深渊核芯霸主 · 守护极寒冰薄荷",
    maxHp: 68,
    isBoss: true,
    lootCount: 5,
    capReward: 26,
    xpReward: 80,
    intents: [
      { type: "ATTACK", value: 10, label: "巨钳横扫 10" },
      { type: "GUARD_HEAL", value: 10, label: "甲壳硬化 +10" },
      { type: "HEAVY_ATTACK", value: 17, label: "碎地重砸 17" },
    ],
  },
};

export function resolveEnemySpriteUrl(templateId: string): string {
  switch (templateId) {
    case "ash_rats":
      return ARTWORK_ASSETS.enemyAshRats;
    case "rad_hound":
      return ARTWORK_ASSETS.enemyRadHound;
    case "scrap_looter":
    case "raider_ambusher":
      return ARTWORK_ASSETS.enemyHumanRaider;
    case "syndicate_hitman":
      return ARTWORK_ASSETS.enemySyndicateHitman;
    case "sentry_bot":
    case "beacon_drone":
      return ARTWORK_ASSETS.enemySentryBot;
    case "frost_claw_boss":
      return ARTWORK_ASSETS.enemyFrostClawBoss;
    default:
      return ARTWORK_ASSETS.enemyHumanRaider;
  }
}

export function resolveCompanionSpriteUrl(companion: {
  npcId?: string;
  combatSpriteUrl?: string;
  portraitUrl?: string;
  skillKind?: string;
}): string {
  const roster = loadCharacterRoster();
  if (companion.npcId && companion.npcId in NPC_PROFILES) {
    const ov = roster.npcOverrides[companion.npcId as MainNpcId];
    if (ov?.combatSpriteUrl) {
      return ov.combatSpriteUrl;
    }
  }
  if (companion.npcId) {
    const customMatch = roster.customPatrons.find(
      (c) => c.id === companion.npcId
    );
    if (customMatch?.combatSpriteUrl || customMatch?.portraitUrl) {
      return customMatch.combatSpriteUrl || customMatch.portraitUrl;
    }
  }
  if (companion.combatSpriteUrl) {
    return companion.combatSpriteUrl;
  }
  switch (companion.npcId) {
    case "ash_scavenger":
      return ARTWORK_ASSETS.combatNpcAsh;
    case "k7_synth":
      return ARTWORK_ASSETS.combatNpcK7;
    case "buck_raider":
      return ARTWORK_ASSETS.combatNpcBuck;
    case "mori_merchant":
      return ARTWORK_ASSETS.combatNpcMori;
    default:
      break;
  }
  if (companion.portraitUrl) {
    return companion.portraitUrl;
  }
  return ARTWORK_ASSETS.combatNpcAsh;
}

export function resolveIntentIconUrl(intentType: EnemyIntentType): string {
  switch (intentType) {
    case "ATTACK":
      return ARTWORK_ASSETS.intentIconAttack;
    case "HEAVY_ATTACK":
      return ARTWORK_ASSETS.intentIconHeavy;
    case "GUARD_HEAL":
      return ARTWORK_ASSETS.intentIconGuard;
    case "RAD_HOWL":
      return ARTWORK_ASSETS.intentIconRad;
    case "STEAL_LOOT":
      return ARTWORK_ASSETS.intentIconSteal;
    default:
      return ARTWORK_ASSETS.intentIconAttack;
  }
}

export function describeEnemyIntentDetail(
  intentType: EnemyIntentType,
  effectiveValue: number,
  rawValue: number
): { title: string; summary: string } {
  switch (intentType) {
    case "ATTACK":
      return {
        title: "常规猛击意图",
        summary: `敌方下回合将发动撕咬或射击，造成 ${effectiveValue} 点伤害（优先消耗你的护甲）。`,
      };
    case "HEAVY_ATTACK":
      return {
        title: "致命重击意图",
        summary: `敌方正在蓄力杀招！下回合将倾泻 ${effectiveValue} 点高额重击伤害，请及时叠甲或优先击杀。`,
      };
    case "GUARD_HEAL":
      return {
        title: "掩体加固意图",
        summary: `敌方下回合不会攻击，而是加固自身防御获得 +${rawValue} 点护甲（并小幅整备恢复）。`,
      };
    case "RAD_HOWL":
      return {
        title: "辐射侵蚀意图",
        summary: `敌方下回合将释放辐射冲击，造成 ${effectiveValue} 点伤害并干扰战场状态。`,
      };
    case "STEAL_LOOT":
      return {
        title: "劫掠扑击意图",
        summary: `敌方下回合将造成 ${effectiveValue} 点伤害，若未被护甲完全格挡还会趁乱顺走你的瓶盖！`,
      };
    default:
      return {
        title: "敌方行动意图",
        summary: `预计数值：${effectiveValue}`,
      };
  }
}


