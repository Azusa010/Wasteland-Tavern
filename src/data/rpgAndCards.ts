import {
  BuildingExploreState,
  BuildingInteractable,
  BuildingLadder,
  BuildingPatrolEnemy,
  CampaignSaveState,
  CardArchetype,
  CardDef,
  CityLocationDef,
  CityLocationId,
  DeckCardEntry,
  DiceRollResult,
  RpgAttributeKey,
  RpgCharacterState,
  RpgPerkDef,
} from "../types/game";

export const ARCHETYPE_META: Record<
  CardArchetype,
  { label: string; shortLabel: string; accentClass: string; badgeText: string }
> = {
  NEUTRAL: {
    label: "通用废土生存",
    shortLabel: "通用",
    accentClass: "text-slate-300",
    badgeText: "基础战术",
  },
  GUNSLINGER: {
    label: "枪火连击流",
    shortLabel: "枪火连击",
    accentClass: "text-amber-400",
    badgeText: "连击·标记",
  },
  JUGGERNAUT: {
    label: "废铁重甲流",
    shortLabel: "废铁重甲",
    accentClass: "text-sky-300",
    badgeText: "蓄甲·盾猛",
  },
  RAD_BIO: {
    label: "辐射生化流",
    shortLabel: "辐射生化",
    accentClass: "text-lime-400",
    badgeText: "叠辐·引爆",
  },
  GADGETEER: {
    label: "拾荒机关流",
    shortLabel: "拾荒机关",
    accentClass: "text-orange-300",
    badgeText: "0费·搜刮",
  },
};

export const RPG_ATTRIBUTE_META: Record<
  RpgAttributeKey,
  {
    name: string;
    code: string;
    dayEffect: string;
    nightEffect: string;
  }
> = {
  STR: {
    name: "力量",
    code: "STR",
    dayEffect: "吧台闹事可执行「重拳镇场 (2d6+力量)」免损耐久压服刺头",
    nightEffect: "提高废墟重锁军火箱撬锁成功率，每超 2 点近战与盾猛伤害 +1",
  },
  AGI: {
    name: "敏捷",
    code: "AGI",
    dayEffect: "吧台危机可执行「闪电夺械 (2d6+敏捷)」反制拔枪恶客",
    nightEffect: "提升横版探索移速与绕后偷袭判定范围，每超 2 点开局护甲 +2",
  },
  ELO: {
    name: "口才",
    code: "ELO",
    dayEffect: "砍价可执行「巧舌溢价 (2d6+口才)」全价成交，降低套话醉意门槛",
    nightEffect: "横版废墟交涉中立幸存者，牌局中可「劝降缴械」残血人类敌人",
  },
  CHA: {
    name: "魅力",
    code: "CHA",
    dayEffect: "每次递酒额外增加信任度，降低散播流言与邀约同行门槛",
    nightEffect: "增强同行伙伴助战威力，提升搜出稀有/已升星卡牌概率",
  },
};

export const PERK_LIBRARY: readonly RpgPerkDef[] = [
  {
    id: "perk_gunslinger",
    code: "PERK-01",
    name: "荒原快枪手",
    archetypeTag: "枪火连击",
    description:
      "每回合打出的第 1 张攻击牌额外提供 +1 连击点，并对目标施加 1 回合锁定标记。",
  },
  {
    id: "perk_scrap_barricade",
    code: "PERK-02",
    name: "废铁移动堡垒",
    archetypeTag: "废铁重甲",
    description:
      "每场战斗开局获得 +6 护甲，且每回合结束时自动保留最多 10 点未消耗护甲。",
  },
  {
    id: "perk_rad_chemist",
    code: "PERK-03",
    name: "核子同位素学者",
    archetypeTag: "辐射生化",
    description:
      "所有施加辐射腐蚀的效果额外 +2 层，且回合末辐射结算伤害提高 40%。",
  },
  {
    id: "perk_gadget_tinker",
    code: "PERK-04",
    name: "巧手拾荒机关师",
    archetypeTag: "拾荒机关",
    description:
      "每场战斗首回合自动往手牌塞入 1 张《0费·锯片飞盘》，每回合首张 0 费牌抽 1 张牌。",
  },
  {
    id: "perk_iron_barkeep",
    code: "PERK-05",
    name: "防空洞铁腕掌柜",
    archetypeTag: "昼夜检定",
    description:
      "白昼与黑夜的所有 2d6 属性掷骰检定最终点数恒定 +2，且成功时额外获得 +10 XP。",
  },
  {
    id: "perk_vault_constitution",
    code: "PERK-06",
    name: "避难所强健体魄",
    archetypeTag: "生存续航",
    description:
      "立即提升 +12 最大生命并回满差值，黄昏战地包扎与战斗回血效果提升 50%。",
  },
  {
    id: "perk_blackmarket_eye",
    code: "PERK-07",
    name: "黑市军火鉴宝眼",
    archetypeTag: "构筑升星",
    description:
      "立即获得 +2 点卡牌升级点，且废墟武器箱与战后选牌高概率直接刷出 +1 升星卡。",
  },
  {
    id: "perk_inspirational",
    code: "PERK-08",
    name: "并肩领袖气场",
    archetypeTag: "伙伴协同",
    description:
      "同行助战伙伴每回合支援伤害与护甲提高 60%，且战斗首回合上限能量 +1。",
  },
] as const;

export function xpForNextLevel(level: number): number {
  return 85 + (level - 1) * 55;
}

export function createDefaultRpgState(): RpgCharacterState {
  return {
    level: 1,
    xp: 0,
    nextLevelXp: xpForNextLevel(1),
    statPoints: 1, // 开局附赠 1 点自由属性点供玩家塑造初始倾向
    upgradeTokens: 1, // 开局附赠 1 枚改装升星点
    pendingPerkChoices: 0,
    attributes: {
      STR: 2,
      AGI: 2,
      ELO: 2,
      CHA: 2,
    },
    unlockedPerks: [],
    lastDiceCheck: null,
  };
}

export function ensureRpgState(state: CampaignSaveState): RpgCharacterState {
  if (!state.rpg) {
    state.rpg = createDefaultRpgState();
  }
  return state.rpg;
}

export function grantRpgXp(
  state: CampaignSaveState,
  amount: number
): { leveledUp: boolean; newLevel: number; gainedLevels: number } {
  if (amount <= 0) {
    const rpg = ensureRpgState(state);
    return { leveledUp: false, newLevel: rpg.level, gainedLevels: 0 };
  }
  const rpg = ensureRpgState(state);
  rpg.xp += Math.round(amount);
  if (state.phase === "DAY_TAVERN") {
    state.todayLedger.xpEarnedToday =
      (state.todayLedger.xpEarnedToday || 0) + Math.round(amount);
  }
  if (state.nightRun) {
    state.nightRun.xpEarnedThisRun =
      (state.nightRun.xpEarnedThisRun || 0) + Math.round(amount);
  }

  let gainedLevels = 0;
  while (rpg.xp >= rpg.nextLevelXp) {
    rpg.xp -= rpg.nextLevelXp;
    rpg.level += 1;
    gainedLevels += 1;
    rpg.nextLevelXp = xpForNextLevel(rpg.level);
    rpg.statPoints += 2;
    rpg.upgradeTokens += 1;
    rpg.pendingPerkChoices += 1;
    state.playerMaxHp += 6;
    state.playerHp = Math.min(state.playerMaxHp, state.playerHp + 8);
  }

  return {
    leveledUp: gainedLevels > 0,
    newLevel: rpg.level,
    gainedLevels,
  };
}

export function compute2d6SuccessChancePct(
  rpg: RpgCharacterState | undefined,
  attr: RpgAttributeKey,
  dc: number
): number {
  const r = rpg || createDefaultRpgState();
  const attrVal = r.attributes[attr] || 2;
  const perkBonus = r.unlockedPerks.includes("perk_iron_barkeep") ? 2 : 0;
  const neededOn2d6 = dc - attrVal - perkBonus;
  let winningCombos = 0;
  for (let d1 = 1; d1 <= 6; d1++) {
    for (let d2 = 1; d2 <= 6; d2++) {
      if (d1 + d2 >= neededOn2d6) winningCombos++;
    }
  }
  return Math.round((winningCombos / 36) * 100);
}

export function roll2d6AttributeCheck(
  rpg: RpgCharacterState,
  attr: RpgAttributeKey,
  dc: number,
  title: string
): DiceRollResult {
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  const attrVal = rpg.attributes[attr] || 2;
  const perkBonus = rpg.unlockedPerks.includes("perk_iron_barkeep") ? 2 : 0;
  const total = d1 + d2 + attrVal + perkBonus;
  const success = total >= dc;
  const attrName = RPG_ATTRIBUTE_META[attr].name;
  const summary = `掷出 [${d1}+${d2}] + ${attrName}(${attrVal})${
    perkBonus > 0 ? ` + 专长(${perkBonus})` : ""
  } = ${total} vs 难度 ${dc} · ${success ? "检定大成功！" : "检定失手"}`;

  const res: DiceRollResult = {
    id: `roll_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title,
    attr,
    dice: [d1, d2],
    attrVal,
    perkBonus,
    total,
    dc,
    success,
    summary,
  };
  rpg.lastDiceCheck = res;
  return res;
}

// ==================== 四大流派深度 Combo 卡牌总库 ====================

export const COMBO_CARD_LIBRARY: Record<string, CardDef> = {
  // -------- 基础初始牌组（全部支持 +1 升星强化） --------
  starter_wrench_strike: {
    id: "starter_wrench_strike",
    name: "管钳重击",
    upgradedName: "管钳重击 +1",
    category: "ATTACK",
    archetype: "NEUTRAL",
    cost: 1,
    rarity: "starter",
    description: "对单个目标造成 6 点近战伤害，连击 +1。",
    upgradedDescription: "对单个目标造成 9 点近战伤害，连击 +1。",
    damage: 6,
    upgradedDamage: 9,
    comboGain: 1,
  },
  starter_iron_door: {
    id: "starter_iron_door",
    name: "铁皮门板格挡",
    upgradedName: "铁皮门板格挡 +1",
    category: "GUARD",
    archetype: "JUGGERNAUT",
    cost: 1,
    rarity: "starter",
    description: "获得 6 点护甲。",
    upgradedDescription: "获得 9 点坚固护甲。",
    block: 6,
    upgradedBlock: 9,
  },
  starter_rummage: {
    id: "starter_rummage",
    name: "翻箱倒柜",
    upgradedName: "翻箱倒柜 +1",
    category: "SCAVENGE",
    archetype: "GADGETEER",
    cost: 1,
    upgradedCost: 0,
    rarity: "starter",
    description: "获得 4 点护甲，并立即从废墟搜刮 1 份食材入包。",
    upgradedDescription: "【0 费】获得 5 点护甲，并立即搜刮 1 份食材入包。",
    block: 4,
    upgradedBlock: 5,
    scavengeCount: 1,
  },
  starter_bottle_slash: {
    id: "starter_bottle_slash",
    name: "碎瓶毒刺",
    upgradedName: "碎瓶毒刺 +1",
    category: "ATTACK",
    archetype: "RAD_BIO",
    cost: 1,
    rarity: "starter",
    description: "造成 5 点伤害，施加 2 层辐射腐蚀并搜刮 1 份基础食材。",
    upgradedDescription: "造成 7 点伤害，施加 4 层辐射腐蚀并搜刮 1 份基础食材。",
    damage: 5,
    upgradedDamage: 7,
    applyRad: 2,
    upgradedApplyRad: 4,
    scavengeCount: 1,
  },
  starter_lantern_flare: {
    id: "starter_lantern_flare",
    name: "煤油提灯强光",
    upgradedName: "煤油提灯强光 +1",
    category: "TACTIC",
    archetype: "GUNSLINGER",
    cost: 1,
    upgradedCost: 0,
    rarity: "starter",
    description: "使全体敌人攻击力降低 2 点，施加 1 回合锁定标记并抽 1 张牌。",
    upgradedDescription:
      "【0 费】使全体敌人攻击力降低 2 点，施加 2 回合锁定标记并抽 1 张牌。",
    weakenEnemyAttack: 2,
    applyMarked: 1,
    upgradedApplyMarked: 2,
    drawCards: 1,
  },

  // -------- 流派一：枪火连击流 (GUNSLINGER) --------
  card_snap_aim: {
    id: "card_snap_aim",
    name: "点射校准",
    upgradedName: "点射校准 +1",
    category: "ATTACK",
    archetype: "GUNSLINGER",
    cost: 0,
    rarity: "common",
    description: "0 费造成 4 点伤害，挂 2 回合锁定标记（受击+35%），连击 +1。",
    upgradedDescription:
      "0 费造成 6 点伤害，挂 3 回合锁定标记（受击+35%），连击 +2。",
    damage: 4,
    upgradedDamage: 6,
    applyMarked: 2,
    upgradedApplyMarked: 3,
    comboGain: 1,
  },
  card_slide_reload: {
    id: "card_slide_reload",
    name: "滑铲快速上膛",
    upgradedName: "滑铲快速上膛 +1",
    category: "TACTIC",
    archetype: "GUNSLINGER",
    cost: 1,
    rarity: "common",
    description: "获得 5 点护甲，抽 2 张牌，连击 +1；若当前连击≥2 返还 1 能量。",
    upgradedDescription:
      "获得 7 点护甲，抽 2 张牌，连击 +2；若当前连击≥2 返还 1 能量。",
    block: 5,
    upgradedBlock: 7,
    drawCards: 2,
    comboGain: 1,
  },
  card_double_tap: {
    id: "card_double_tap",
    name: "土制双管连射",
    upgradedName: "土制双管连射 +1",
    category: "ATTACK",
    archetype: "GUNSLINGER",
    cost: 1,
    rarity: "common",
    description: "连续射击 2 次，每次造成 5 点伤害，连击 +1。",
    upgradedDescription: "连续射击 2 次，每次造成 7 点伤害，连击 +2。",
    damage: 5,
    upgradedDamage: 7,
    hits: 2,
    comboGain: 1,
  },
  card_gatling_barrage: {
    id: "card_gatling_barrage",
    name: "蜂巢弹幕倾泻",
    upgradedName: "蜂巢弹幕倾泻 +1",
    category: "ATTACK",
    archetype: "GUNSLINGER",
    cost: 2,
    rarity: "rare",
    description:
      "每次射击造成 5 点伤害；本回合每有 1 点连击，便额外追加射击 1 次！",
    upgradedDescription:
      "每次射击造成 7 点伤害；本回合每有 1 点连击，便额外追加射击 1 次！",
    damage: 5,
    upgradedDamage: 7,
    hits: 1,
    hitsPerCombo: true,
    comboGain: 1,
  },
  card_deadeye_finisher: {
    id: "card_deadeye_finisher",
    name: "午夜死神处决",
    upgradedName: "午夜死神处决 +1",
    category: "ATTACK",
    archetype: "GUNSLINGER",
    cost: 3,
    rarity: "rare",
    description:
      "本回合每有 1 点连击，此牌耗能 -1（最低 0 费）；造成 18 点致命狙击伤害！",
    upgradedDescription:
      "本回合每有 1 点连击，此牌耗能 -1（最低 0 费）；造成 25 点致命狙击伤害！",
    damage: 18,
    upgradedDamage: 25,
    costReducePerCombo: true,
  },

  // -------- 流派二：废铁重甲流 (JUGGERNAUT) --------
  card_scrap_buckler: {
    id: "card_scrap_buckler",
    name: "铅衬防辐重盾",
    upgradedName: "铅衬防辐重盾 +1",
    category: "GUARD",
    archetype: "JUGGERNAUT",
    cost: 1,
    rarity: "common",
    description: "获得 9 点坚固护甲，抽 1 张牌。",
    upgradedDescription: "获得 13 点坚固护甲，抽 1 张牌。",
    block: 9,
    upgradedBlock: 13,
    drawCards: 1,
  },
  card_weld_bulkhead: {
    id: "card_weld_bulkhead",
    name: "焊死防爆铁板",
    upgradedName: "焊死防爆铁板 +1",
    category: "GUARD",
    archetype: "JUGGERNAUT",
    cost: 1,
    rarity: "common",
    description: "获得 10 点护甲，且本回合未消耗的护甲完整保留至下一回合！",
    upgradedDescription:
      "获得 14 点护甲，且未来 2 个回合护甲均完整保留不消散！",
    block: 10,
    upgradedBlock: 14,
    retainBlockTurns: 1,
  },
  card_barbed_armor: {
    id: "card_barbed_armor",
    name: "倒刺铁丝网甲",
    upgradedName: "倒刺铁丝网甲 +1",
    category: "GUARD",
    archetype: "JUGGERNAUT",
    cost: 1,
    rarity: "common",
    description: "获得 7 点护甲，本场战斗获得 4 点荆棘反伤（每次受击反弹伤害）。",
    upgradedDescription:
      "获得 10 点护甲，本场战斗获得 6 点荆棘反伤（每次受击反弹伤害）。",
    block: 7,
    upgradedBlock: 10,
    thornsGain: 4,
    upgradedThornsGain: 6,
  },
  card_shield_slam: {
    id: "card_shield_slam",
    name: "铆钉盾猛重砸",
    upgradedName: "铆钉盾猛重砸 +1",
    category: "ATTACK",
    archetype: "JUGGERNAUT",
    cost: 1,
    rarity: "rare",
    description: "先获得 4 点护甲，再造成等同于你当前总护甲值 100% 的重击伤害！",
    upgradedDescription:
      "先获得 6 点护甲，再造成等同于你当前总护甲值 145% 的毁灭重砸！",
    block: 4,
    upgradedBlock: 6,
    damageFromBlockRatio: 1.0,
    upgradedDamageFromBlockRatio: 1.45,
  },
  card_overcharge_plating: {
    id: "card_overcharge_plating",
    name: "液压装甲倍增",
    upgradedName: "液压装甲倍增 +1",
    category: "GUARD",
    archetype: "JUGGERNAUT",
    cost: 2,
    upgradedCost: 1,
    rarity: "rare",
    description: "令你当前的护甲值立即翻倍，并保留至下一回合！消耗。",
    upgradedDescription:
      "【1 费】令你当前的护甲值立即翻倍，并保留至下一回合！消耗。",
    doubleCurrentBlock: true,
    retainBlockTurns: 1,
    exhaust: true,
  },

  // -------- 流派三：辐射生化流 (RAD_BIO) --------
  card_spore_flask: {
    id: "card_spore_flask",
    name: "幽光菌孢烧瓶",
    upgradedName: "幽光菌孢烧瓶 +1",
    category: "TACTIC",
    archetype: "RAD_BIO",
    cost: 1,
    rarity: "common",
    description: "对全体敌人施加 4 层辐射腐蚀（每回合受蚀掉血），并降低 1 点敌攻。",
    upgradedDescription:
      "对全体敌人施加 7 层辐射腐蚀，并降低 2 点敌方攻击力。",
    aoeApplyRad: 4,
    upgradedAoeApplyRad: 7,
    weakenEnemyAttack: 1,
    upgradedWeakenEnemyAttack: 2,
  },
  card_coolant_spray: {
    id: "card_coolant_spray",
    name: "污染冷却液喷射",
    upgradedName: "污染冷却液喷射 +1",
    category: "ATTACK",
    archetype: "RAD_BIO",
    cost: 1,
    rarity: "common",
    description: "造成 5 点伤害，对目标施加 5 层辐射腐蚀并抽 1 张牌。",
    upgradedDescription: "造成 8 点伤害，对目标施加 8 层辐射腐蚀并抽 1 张牌。",
    damage: 5,
    upgradedDamage: 8,
    applyRad: 5,
    upgradedApplyRad: 8,
    drawCards: 1,
  },
  card_geiger_catalysis: {
    id: "card_geiger_catalysis",
    name: "盖革同位素催化",
    upgradedName: "盖革同位素催化 +1",
    category: "TACTIC",
    archetype: "RAD_BIO",
    cost: 1,
    rarity: "rare",
    description: "令目标当前的辐射腐蚀层数立即翻倍！消耗。",
    upgradedDescription: "先施加 3 层辐射腐蚀，再令其辐射层数立即翻倍！（不消耗）",
    applyRad: 0,
    upgradedApplyRad: 3,
    doubleTargetRad: true,
    exhaust: true,
    removeExhaustOnUpgrade: true,
  },
  card_rad_detonation: {
    id: "card_rad_detonation",
    name: "核冬裂变引爆",
    upgradedName: "核冬裂变引爆 +1",
    category: "ATTACK",
    archetype: "RAD_BIO",
    cost: 2,
    rarity: "rare",
    description:
      "引爆目标辐射：对全体敌人造成目标辐射层数 160% 的群伤，并恢复 5 点生命！",
    upgradedDescription:
      "引爆目标辐射：对全体敌人造成目标辐射层数 230% 的毁灭群伤，并恢复 8 点生命！",
    detonateRadMultiplier: 1.6,
    upgradedDetonateRadMultiplier: 2.3,
    heal: 5,
    upgradedHeal: 8,
  },

  // -------- 流派四：拾荒机关流 (GADGETEER) --------
  card_deep_forage: {
    id: "card_deep_forage",
    name: "冷库精挑细选",
    upgradedName: "冷库精挑细选 +1",
    category: "SCAVENGE",
    archetype: "GADGETEER",
    cost: 1,
    rarity: "common",
    description: "搜刮 2 份稀有度提升食材，并往手牌塞入 1 张《0费·锯片飞盘》。消耗。",
    upgradedDescription:
      "搜刮 3 份稀有度提升食材，并往手牌塞入 2 张《0费·锯片飞盘》。消耗。",
    scavengeCount: 2,
    upgradedScavengeCount: 3,
    scavengeRareBoost: true,
    spawnGadgetId: "token_sawblade_disc",
    spawnGadgetCount: 1,
    upgradedSpawnGadgetCount: 2,
    exhaust: true,
  },
  card_strip_meter: {
    id: "card_strip_meter",
    name: "拆解旧电表",
    upgradedName: "拆解旧电表 +1",
    category: "SCAVENGE",
    archetype: "GADGETEER",
    cost: 1,
    rarity: "common",
    description: "获得 4 点护甲，搜刮 1 份食材，往手牌塞入 2 张《0费·锯片飞盘》。",
    upgradedDescription:
      "获得 6 点护甲，搜刮 1 份食材，往手牌塞入 3 张《0费·锯片飞盘》。",
    block: 4,
    upgradedBlock: 6,
    scavengeCount: 1,
    spawnGadgetId: "token_sawblade_disc",
    spawnGadgetCount: 2,
    upgradedSpawnGadgetCount: 3,
  },
  card_spring_snare: {
    id: "card_spring_snare",
    name: "弹簧电弧夹箱",
    upgradedName: "弹簧电弧夹箱 +1",
    category: "SCAVENGE",
    archetype: "GADGETEER",
    cost: 0,
    rarity: "common",
    description: "0 费获得 3 点护甲，入账 3 枚瓶盖，塞入 1 张《0费·电弧绊雷》。",
    upgradedDescription:
      "0 费获得 5 点护甲，入账 5 枚瓶盖，塞入 2 张《0费·电弧绊雷》。",
    block: 3,
    upgradedBlock: 5,
    bonusCaps: 3,
    upgradedBonusCaps: 5,
    spawnGadgetId: "token_arc_mine",
    spawnGadgetCount: 1,
    upgradedSpawnGadgetCount: 2,
  },
  card_arc_turret_rig: {
    id: "card_arc_turret_rig",
    name: "磁暴线圈机关架",
    upgradedName: "磁暴线圈机关架 +1",
    category: "TACTIC",
    archetype: "GADGETEER",
    cost: 1,
    rarity: "rare",
    description:
      "架设机关：本场战斗每打出一张 0 费牌或搜刮牌，自动电击敌方 4 点并得 2 护甲！",
    upgradedDescription:
      "架设机关：本场战斗每打出一张 0 费牌或搜刮牌，自动电击敌方 7 点并得 3 护甲！",
    gadgetTurretGain: 4,
    upgradedGadgetTurretGain: 7,
  },
  card_junk_storm: {
    id: "card_junk_storm",
    name: "废品炼金风暴",
    upgradedName: "废品炼金风暴 +1",
    category: "ATTACK",
    archetype: "GADGETEER",
    cost: 2,
    rarity: "rare",
    description:
      "造成 8 点群伤；本场战斗每打出过 1 张 0 费或搜刮牌便额外 +4 群伤，入账 4 盖！",
    upgradedDescription:
      "造成 11 点群伤；本场战斗每打出过 1 张 0 费或搜刮牌便额外 +6 群伤，入账 6 盖！",
    aoeDamage: 8,
    upgradedAoeDamage: 11,
    damagePerGadgetPlayed: 4,
    upgradedDamagePerGadgetPlayed: 6,
    bonusCaps: 4,
    upgradedBonusCaps: 6,
  },

  // -------- 通用强力支援与稀有战术卡 --------
  card_field_bandage: {
    id: "card_field_bandage",
    name: "抗辐宁急救包",
    upgradedName: "抗辐宁急救包 +1",
    category: "TACTIC",
    archetype: "NEUTRAL",
    cost: 1,
    upgradedCost: 0,
    rarity: "common",
    description: "恢复 7 点生命值，并获得 5 点护甲。消耗。",
    upgradedDescription: "【0 费】恢复 10 点生命值，并获得 7 点护甲。消耗。",
    heal: 7,
    upgradedHeal: 10,
    block: 5,
    upgradedBlock: 7,
    exhaust: true,
  },
  card_pipe_grenade: {
    id: "card_pipe_grenade",
    name: "铁罐破片震爆雷",
    upgradedName: "铁罐破片震爆雷 +1",
    category: "ATTACK",
    archetype: "GUNSLINGER",
    cost: 2,
    rarity: "rare",
    description: "对全体敌人造成 12 点爆炸伤害，并施加 2 回合锁定标记。",
    upgradedDescription: "对全体敌人造成 17 点爆炸伤害，并施加 3 回合锁定标记。",
    aoeDamage: 12,
    upgradedAoeDamage: 17,
    applyMarked: 2,
    upgradedApplyMarked: 3,
  },
  card_adrenaline_shot: {
    id: "card_adrenaline_shot",
    name: "军用捷特肾上腺针",
    upgradedName: "军用捷特肾上腺针 +1",
    category: "TACTIC",
    archetype: "GUNSLINGER",
    cost: 0,
    rarity: "rare",
    description: "立即获得 2 点行动能量，抽 2 张牌，连击 +1。消耗。",
    upgradedDescription: "立即获得 2 点行动能量，抽 3 张牌，连击 +2。消耗。",
    gainEnergy: 2,
    drawCards: 2,
    upgradedDrawCards: 3,
    comboGain: 1,
    exhaust: true,
  },
  card_treasure_hound: {
    id: "card_treasure_hound",
    name: "盖革探测仪扫荡",
    upgradedName: "盖革探测仪扫荡 +1",
    category: "SCAVENGE",
    archetype: "GADGETEER",
    cost: 1,
    rarity: "rare",
    description: "获得 6 点护甲，搜刮 2 份高稀有食材并捡取 6 枚瓶盖。",
    upgradedDescription: "获得 9 点护甲，搜刮 3 份高稀有食材并捡取 9 枚瓶盖。",
    block: 6,
    upgradedBlock: 9,
    scavengeCount: 2,
    upgradedScavengeCount: 3,
    scavengeRareBoost: true,
    bonusCaps: 6,
    upgradedBonusCaps: 9,
  },

  // -------- 四位吧台常客高信任专属信物卡（融合流派核心） --------
  sig_ash_crowbar: {
    id: "sig_ash_crowbar",
    name: "阿灰的万能撬棍",
    upgradedName: "阿灰的万能撬棍 +1",
    category: "SCAVENGE",
    archetype: "GADGETEER",
    cost: 0,
    rarity: "signature",
    ownerNpcName: "阿灰",
    description:
      "【常客信物】0 费造成 7 点伤害，搜刮 2 份稀有食材并塞入 1 张《锯片飞盘》。",
    upgradedDescription:
      "【常客信物】0 费造成 10 点伤害，搜刮 2 份稀有食材并塞入 2 张《锯片飞盘》。",
    damage: 7,
    upgradedDamage: 10,
    scavengeCount: 2,
    scavengeRareBoost: true,
    spawnGadgetId: "token_sawblade_disc",
    spawnGadgetCount: 1,
    upgradedSpawnGadgetCount: 2,
  },
  sig_k7_shield: {
    id: "sig_k7_shield",
    name: "K-7 超频光学护盾",
    upgradedName: "K-7 超频光学护盾 +1",
    category: "GUARD",
    archetype: "JUGGERNAUT",
    cost: 1,
    rarity: "signature",
    ownerNpcName: "伊恩 · K-7",
    description:
      "【常客信物】获得 15 点护甲并保留至下回合，抽 2 张牌。",
    upgradedDescription:
      "【常客信物】获得 21 点护甲并保留至下回合，抽 2 张牌。",
    block: 15,
    upgradedBlock: 21,
    retainBlockTurns: 1,
    drawCards: 2,
  },
  sig_buck_shotgun: {
    id: "sig_buck_shotgun",
    name: "狂犬霰弹轰击",
    upgradedName: "狂犬霰弹轰击 +1",
    category: "ATTACK",
    archetype: "GUNSLINGER",
    cost: 1,
    rarity: "signature",
    ownerNpcName: "狂犬 · 巴克",
    description:
      "【常客信物】对全体敌人造成 15 点轰击，削弱 2 点敌攻，连击 +2。",
    upgradedDescription:
      "【常客信物】对全体敌人造成 21 点轰击，削弱 3 点敌攻，连击 +2。",
    aoeDamage: 15,
    upgradedAoeDamage: 21,
    weakenEnemyAttack: 2,
    upgradedWeakenEnemyAttack: 3,
    comboGain: 2,
  },
  sig_mori_dart: {
    id: "sig_mori_dart",
    name: "老算盘的淬毒飞镖",
    upgradedName: "老算盘的淬毒飞镖 +1",
    category: "TACTIC",
    archetype: "RAD_BIO",
    cost: 1,
    rarity: "signature",
    ownerNpcName: "老算盘 · 莫里",
    description:
      "【常客信物】造成 8 点伤害，施加 6 层辐射腐蚀，入账 8 枚瓶盖并抽 1 张牌。",
    upgradedDescription:
      "【常客信物】造成 11 点伤害，施加 9 层辐射腐蚀，入账 12 枚瓶盖并抽 2 张牌。",
    damage: 8,
    upgradedDamage: 11,
    applyRad: 6,
    upgradedApplyRad: 9,
    bonusCaps: 8,
    upgradedBonusCaps: 12,
    drawCards: 1,
    upgradedDrawCards: 2,
  },

  // -------- 战斗内衍生 0 费机关 Token 卡 --------
  token_sawblade_disc: {
    id: "token_sawblade_disc",
    name: "锯片飞盘",
    upgradedName: "精锻锯片飞盘 +1",
    category: "ATTACK",
    archetype: "GADGETEER",
    cost: 0,
    rarity: "token",
    isToken: true,
    exhaust: true,
    description: "【0费机关】造成 5 点切割伤害，连击 +1。打出后消耗。",
    upgradedDescription: "【0费机关】造成 8 点切割伤害，连击 +1。打出后消耗。",
    damage: 5,
    upgradedDamage: 8,
    comboGain: 1,
  },
  token_arc_mine: {
    id: "token_arc_mine",
    name: "电弧绊雷",
    upgradedName: "高能电弧绊雷 +1",
    category: "TACTIC",
    archetype: "GADGETEER",
    cost: 0,
    rarity: "token",
    isToken: true,
    exhaust: true,
    description: "【0费机关】获得 3 点护甲，对目标施加 4 层辐射腐蚀。消耗。",
    upgradedDescription: "【0费机关】获得 5 点护甲，对目标施加 6 层辐射腐蚀。消耗。",
    block: 3,
    upgradedBlock: 5,
    applyRad: 4,
    upgradedApplyRad: 6,
  },
};

export const EXPANDED_REWARD_CARD_POOL: string[] = Object.values(
  COMBO_CARD_LIBRARY
)
  .filter(
    (c) =>
      (c.rarity === "common" || c.rarity === "rare") && !c.isToken
  )
  .map((c) => c.id);

export interface ResolvedCardStats {
  id: string;
  name: string;
  imageUrl: string;
  category: CardDef["category"];
  archetype: CardArchetype;
  baseCost: number;
  rarity: CardDef["rarity"];
  description: string;
  damage: number;
  hits: number;
  aoeDamage: number;
  block: number;
  heal: number;
  drawCards: number;
  gainEnergy: number;
  scavengeCount: number;
  scavengeRareBoost: boolean;
  bonusCaps: number;
  weakenEnemyAttack: number;
  comboGain: number;
  hitsPerCombo: boolean;
  costReducePerCombo: boolean;
  applyMarked: number;
  retainBlockTurns: number;
  thornsGain: number;
  damageFromBlockRatio: number;
  doubleCurrentBlock: boolean;
  applyRad: number;
  aoeApplyRad: number;
  doubleTargetRad: boolean;
  detonateRadMultiplier: number;
  spawnGadgetId?: string;
  spawnGadgetCount: number;
  gadgetTurretGain: number;
  damagePerGadgetPlayed: number;
  exhaust: boolean;
  ownerNpcName?: string;
}

const CARD_ART_PATHS = {
  gunslinger: "/src/assets/images/card_art_gunslinger_1794967283207.jpg",
  juggernaut: "/src/assets/images/card_art_juggernaut_1794967283663.jpg",
  radBio: "/src/assets/images/card_art_rad_bio_1794967284235.jpg",
  gadgetTrap: "/src/assets/images/card_art_gadget_trap_1794967285822.jpg",
  meleeWrench: "/src/assets/images/card_art_melee_wrench_1794967287678.jpg",
  scavengeLoot: "/src/assets/images/card_art_scavenge_loot_1794967288931.jpg",
} as const;

export function resolveCardArtUrl(def: CardDef): string {
  if (
    def.id === "starter_wrench_strike" ||
    def.id === "starter_bottle_slash" ||
    def.id === "sig_ash_crowbar"
  ) {
    return CARD_ART_PATHS.meleeWrench;
  }
  if (
    def.id === "starter_rummage" ||
    def.id === "card_deep_forage" ||
    def.id === "card_treasure_hound" ||
    def.id === "card_field_bandage"
  ) {
    return CARD_ART_PATHS.scavengeLoot;
  }
  switch (def.archetype) {
    case "GUNSLINGER":
      return CARD_ART_PATHS.gunslinger;
    case "JUGGERNAUT":
      return CARD_ART_PATHS.juggernaut;
    case "RAD_BIO":
      return CARD_ART_PATHS.radBio;
    case "GADGETEER":
      return CARD_ART_PATHS.gadgetTrap;
    default:
      return def.category === "SCAVENGE"
        ? CARD_ART_PATHS.scavengeLoot
        : CARD_ART_PATHS.meleeWrench;
  }
}

export function resolveCardStats(
  defId: string,
  upgraded = false
): ResolvedCardStats {
  const def =
    COMBO_CARD_LIBRARY[defId] || COMBO_CARD_LIBRARY.starter_wrench_strike;
  const u = Boolean(upgraded);
  const comboBonusOnUpgrade =
    u &&
    (def.id === "card_snap_aim" ||
      def.id === "card_slide_reload" ||
      def.id === "card_double_tap" ||
      def.id === "card_adrenaline_shot")
      ? 1
      : 0;

  return {
    id: def.id,
    name: u ? def.upgradedName || `${def.name} +1` : def.name,
    imageUrl: resolveCardArtUrl(def),
    category: def.category,
    archetype: def.archetype || "NEUTRAL",
    baseCost: u && def.upgradedCost !== undefined ? def.upgradedCost : def.cost,
    rarity: def.rarity,
    description:
      u && def.upgradedDescription ? def.upgradedDescription : def.description,
    damage: u && def.upgradedDamage !== undefined ? def.upgradedDamage : def.damage || 0,
    hits: u && def.upgradedHits !== undefined ? def.upgradedHits : def.hits || 1,
    aoeDamage:
      u && def.upgradedAoeDamage !== undefined
        ? def.upgradedAoeDamage
        : def.aoeDamage || 0,
    block: u && def.upgradedBlock !== undefined ? def.upgradedBlock : def.block || 0,
    heal: u && def.upgradedHeal !== undefined ? def.upgradedHeal : def.heal || 0,
    drawCards:
      u && def.upgradedDrawCards !== undefined
        ? def.upgradedDrawCards
        : def.drawCards || 0,
    gainEnergy:
      u && def.upgradedGainEnergy !== undefined
        ? def.upgradedGainEnergy
        : def.gainEnergy || 0,
    scavengeCount:
      u && def.upgradedScavengeCount !== undefined
        ? def.upgradedScavengeCount
        : def.scavengeCount || 0,
    scavengeRareBoost: Boolean(def.scavengeRareBoost),
    bonusCaps:
      u && def.upgradedBonusCaps !== undefined
        ? def.upgradedBonusCaps
        : def.bonusCaps || 0,
    weakenEnemyAttack:
      u && def.upgradedWeakenEnemyAttack !== undefined
        ? def.upgradedWeakenEnemyAttack
        : def.weakenEnemyAttack || 0,
    comboGain: (def.comboGain || 0) + comboBonusOnUpgrade,
    hitsPerCombo: Boolean(def.hitsPerCombo),
    costReducePerCombo: Boolean(def.costReducePerCombo),
    applyMarked:
      u && def.upgradedApplyMarked !== undefined
        ? def.upgradedApplyMarked
        : def.applyMarked || 0,
    retainBlockTurns: u && def.id === "card_weld_bulkhead" ? 2 : def.retainBlockTurns || 0,
    thornsGain:
      u && def.upgradedThornsGain !== undefined
        ? def.upgradedThornsGain
        : def.thornsGain || 0,
    damageFromBlockRatio:
      u && def.upgradedDamageFromBlockRatio !== undefined
        ? def.upgradedDamageFromBlockRatio
        : def.damageFromBlockRatio || 0,
    doubleCurrentBlock: Boolean(def.doubleCurrentBlock),
    applyRad:
      u && def.upgradedApplyRad !== undefined
        ? def.upgradedApplyRad
        : def.applyRad || 0,
    aoeApplyRad:
      u && def.upgradedAoeApplyRad !== undefined
        ? def.upgradedAoeApplyRad
        : def.aoeApplyRad || 0,
    doubleTargetRad: Boolean(def.doubleTargetRad),
    detonateRadMultiplier:
      u && def.upgradedDetonateRadMultiplier !== undefined
        ? def.upgradedDetonateRadMultiplier
        : def.detonateRadMultiplier || 0,
    spawnGadgetId: def.spawnGadgetId,
    spawnGadgetCount:
      u && def.upgradedSpawnGadgetCount !== undefined
        ? def.upgradedSpawnGadgetCount
        : def.spawnGadgetCount || 0,
    gadgetTurretGain:
      u && def.upgradedGadgetTurretGain !== undefined
        ? def.upgradedGadgetTurretGain
        : def.gadgetTurretGain || 0,
    damagePerGadgetPlayed:
      u && def.upgradedDamagePerGadgetPlayed !== undefined
        ? def.upgradedDamagePerGadgetPlayed
        : def.damagePerGadgetPlayed || 0,
    exhaust: def.removeExhaustOnUpgrade && u ? false : Boolean(def.exhaust),
    ownerNpcName: def.ownerNpcName,
  };
}

export function getNormalizedDeckCards(state: CampaignSaveState): DeckCardEntry[] {
  if (state.deckCards && state.deckCards.length > 0) {
    return state.deckCards;
  }
  return (state.deckDefIds || []).map((defId, idx) => ({
    uid: `dc_${idx}_${defId}`,
    defId,
    upgraded: false,
  }));
}

export function syncDeckDefIdsFromDeckCards(state: CampaignSaveState): void {
  if (state.deckCards) {
    state.deckDefIds = state.deckCards.map((c) => c.defId);
  }
}

// ==================== 类《这是我的战争》灰烬裂谷四大城市据点 ====================

export const CITY_LOCATIONS: readonly CityLocationDef[] = [
  {
    id: "ruined_mart",
    code: "01",
    name: "坍塌百货超市",
    shortName: "百货超市",
    subtitle: "断桥西侧半塌卖场，二楼窗后偶有微弱烛火。",
    imageUrl: "/src/assets/images/loc_ruined_mart_1794966550617.jpg",
    dangerRating: 1,
    dangerLabel: "危险 Ⅰ",
    mapX: 25,
    mapY: 54,
    lootPreviewIds: ["mutant_potato", "rust_malt", "rad_water"],
    tagSummary: "口粮 · 改装台 · 幸存者",
    primaryLootDesc: "土豆原浆 · 烘麦芽 · 蒸馏水",
    tacticalNote: "视野开阔，阁楼偶有拾荒客落脚。",
  },
  {
    id: "shelled_clinic",
    code: "02",
    name: "战前医药冷库",
    shortName: "医药冷库",
    subtitle: "地下恒温药库尚未断电，防爆门内泛着冷雾。",
    imageUrl: "/src/assets/images/loc_shelled_clinic_1794966552824.jpg",
    dangerRating: 2,
    dangerLabel: "危险 Ⅱ",
    mapX: 54,
    mapY: 28,
    lootPreviewIds: ["glow_shroom", "calm_herb", "rad_water"],
    tagSummary: "草药 · 菌菇 · 密道冷柜",
    primaryLootDesc: "幽光菌菇 · 安神草 · 医药箱",
    tacticalNote: "走廊狭长，持通风口暗号可直入特供冷库。",
  },
  {
    id: "scrap_shipyard",
    code: "03",
    name: "废铁船坞重工仓",
    shortName: "废铁船坞",
    subtitle: "干涸运河边的旧拆船厂，夜间有武装匪徒守火。",
    imageUrl: "/src/assets/images/loc_scrap_shipyard_1794966555068.jpg",
    dangerRating: 3,
    dangerLabel: "危险 Ⅲ",
    mapX: 73,
    mapY: 72,
    lootPreviewIds: ["rust_malt", "mutant_potato", "calm_herb"],
    tagSummary: "重锁武器箱 · 零件 · 瓶盖",
    primaryLootDesc: "军火武器箱 · 废铁零件 · 瓶盖",
    tacticalNote: "塔吊林立，驻守匪徒较多。",
  },
  {
    id: "cryo_reactor",
    code: "04",
    name: "极寒冷却核芯",
    shortName: "冷却核芯",
    subtitle: "裂谷深渊下的冷却竖井，霜雾封死了底层栈桥。",
    imageUrl: "/src/assets/images/loc_cryo_reactor_1794966556656.jpg",
    dangerRating: 4,
    dangerLabel: "危险 Ⅳ",
    mapX: 83,
    mapY: 24,
    lootPreviewIds: ["cryo_mint", "glow_shroom", "calm_herb"],
    tagSummary: "冰薄荷 · 稀有卡 · 裂谷巨兽",
    primaryLootDesc: "核冬冰薄荷 · 幽光菌菇 · 稀有武器箱",
    tacticalNote: "底层盘踞重甲巨钳兽。",
  },
] as const;

/**
 * 为玩家在城市大地图选定的建筑生成完整的「三层横版剖面实操探索结构」
 */
export function createCutawayBuildingForLocation(
  campaign: CampaignSaveState,
  locationId: CityLocationId
): BuildingExploreState {
  const loc =
    CITY_LOCATIONS.find((l) => l.id === locationId) || CITY_LOCATIONS[0];

  const ladders: BuildingLadder[] =
    locationId === "shelled_clinic"
      ? [
          { id: "lad_1_2_a", x: 34, lowerFloor: 1, upperFloor: 2 },
          { id: "lad_1_2_b", x: 78, lowerFloor: 1, upperFloor: 2 },
          { id: "lad_2_3_a", x: 56, lowerFloor: 2, upperFloor: 3 },
        ]
      : locationId === "scrap_shipyard"
      ? [
          { id: "lad_1_2_a", x: 28, lowerFloor: 1, upperFloor: 2 },
          { id: "lad_2_3_a", x: 48, lowerFloor: 2, upperFloor: 3 },
          { id: "lad_1_2_b", x: 82, lowerFloor: 1, upperFloor: 2 },
        ]
      : [
          { id: "lad_1_2_a", x: 32, lowerFloor: 1, upperFloor: 2 },
          { id: "lad_2_3_a", x: 66, lowerFloor: 2, upperFloor: 3 },
        ];

  const objects: BuildingInteractable[] = [
    {
      id: "obj_exit",
      floor: 1,
      x: 8,
      kind: "EXIT_DOOR",
      label: "撤离防爆门",
      subtitle: "随时携带已搜刮食材、瓶盖与新卡牌安全返航回酒馆",
      used: false,
    },
    {
      id: "obj_f1_cabinet",
      floor: 1,
      x: 46,
      kind: "SUPPLY_CABINET",
      label:
        locationId === "shelled_clinic"
          ? "急诊药剂储物柜"
          : locationId === "scrap_shipyard"
          ? "焊工补给铁皮柜"
          : "货架残存物资箱",
      subtitle: "搜翻获取调酒原料、改装零件与经验值",
      used: false,
    },
    {
      id: "obj_f1_crate",
      floor: 1,
      x: 86,
      kind: "LOCKED_WEAPON_CRATE",
      label: "上锁战术军火箱",
      subtitle: "撬开锁扣可从 3 张流派卡牌中挑选 1 张永久入库",
      locked: true,
      lockDc: 8,
      used: false,
    },
    {
      id: "obj_f2_workbench",
      floor: 2,
      x: 20,
      kind: "WORKBENCH",
      label: "废土钳工改装台",
      subtitle: "消耗卡牌升级点（或 3 个废铁零件）将牌库任意卡牌升至 +1 星",
      used: false,
    },
    {
      id: "obj_f2_survivor",
      floor: 2,
      x: 52,
      kind: "NEUTRAL_SURVIVOR",
      label: "躲藏的拾荒幸存者",
      subtitle: "非敌对单位 · 可用「口才/魅力」掷骰交涉换取稀有卡与草药",
      used: false,
      survivorName:
        locationId === "shelled_clinic"
          ? "旧诊所药剂学徒·林恩"
          : locationId === "scrap_shipyard"
          ? "断臂老铆工·铁叔"
          : "迷路的驼队脚夫·小豆",
      survivorPrompt:
        "「别开枪！我只是进来找点净水滤芯的……你要是肯好好说话，我可以把刚摸到的战术卡和草药匀给你！」",
    },
    {
      id: "obj_f3_cabinet",
      floor: 3,
      x: 24,
      kind: "SUPPLY_CABINET",
      label:
        locationId === "cryo_reactor"
          ? "极寒冰晶培养舱"
          : "顶层密封冷藏柜",
      subtitle: "高概率搜出核冬冰薄荷与幽光菌菇露",
      used: false,
    },
    {
      id: "obj_f3_crate",
      floor: 3,
      x: 88,
      kind: "LOCKED_WEAPON_CRATE",
      label: "重锁特种武器柜",
      subtitle: "高稀有度流派核心卡三选一（力量检定撬锁无损开启）",
      locked: true,
      lockDc: 9,
      used: false,
    },
  ];

  // 注入白昼因果特殊交互物！
  if (campaign.nightIntelUnlocked) {
    objects.push({
      id: "obj_intel_vault",
      floor: 2,
      x: 84,
      kind: "INTEL_COLD_VAULT",
      label: `暗号密室（${campaign.nightIntelPatronName || "熟客"}）`,
      subtitle: "白昼常客暗号点亮：免战斗直接搬空高产菌菇、冰薄荷与瓶盖！",
      used: false,
    });
  }

  if (campaign.nightTrapCacheUnlocked) {
    objects.push({
      id: "obj_trap_cache",
      floor: 1,
      x: 68,
      kind: "TRAP_LOOT_CACHE",
      label: "假坐标诱敌遗落箱",
      subtitle: "白昼被你用假情报坑进盲区的暗探丢下的整箱稀有补给！",
      used: false,
    });
  }

  if (campaign.activeCommission && !campaign.activeCommission.completed) {
    objects.push({
      id: "obj_commission_box",
      floor: 3,
      x: 46,
      kind: "COMMISSION_TARGET",
      label: `委托物 · ${campaign.activeCommission.title}`,
      subtitle: `取回后黎明交差可领 +${campaign.activeCommission.rewardCaps} 枚瓶盖重酬！`,
      used: false,
    });
  }

  // 生成各楼层带视野朝向的巡逻敌人（支持绕后偷袭！）
  const patrols: BuildingPatrolEnemy[] = [
    {
      id: "patrol_f1",
      floor: 1,
      x: 62,
      minX: 52,
      maxX: 76,
      facing: "right",
      name:
        locationId === "scrap_shipyard" ? "船坞拾荒恶徒" : "废墟游荡鼠群",
      subtitle: "正面红光为警戒视野，趁其背对靠近可发动【先手偷袭】！",
      enemyIds:
        locationId === "scrap_shipyard"
          ? ["scrap_looter", "ash_rats"]
          : ["ash_rats", "rad_hound"],
      defeated: false,
    },
  ];

  if (campaign.nightHitmanTriggered) {
    patrols.push({
      id: "patrol_f2_hitman",
      floor: 2,
      x: 70,
      minX: 58,
      maxX: 80,
      facing: "left",
      name: "买凶清算猎手（白昼拆穿报复）",
      subtitle: `受「${campaign.nightHitmanSponsor || "潜伏幕后"}」重金雇佣的精英杀手`,
      enemyIds: ["syndicate_hitman", "scrap_looter"],
      isElite: true,
      defeated: false,
    });
  } else if (campaign.nightAmbushTriggered) {
    patrols.push({
      id: "patrol_f2_ambush",
      floor: 2,
      x: 70,
      minX: 58,
      maxX: 80,
      facing: "left",
      name: "寻仇铁锈伏击手",
      subtitle: `因白昼与${campaign.nightAmbushPatronName || "恶客"}冲突赶来报复`,
      enemyIds: ["raider_ambusher", "scrap_looter"],
      isElite: true,
      defeated: false,
    });
  } else {
    patrols.push({
      id: "patrol_f2_guard",
      floor: 2,
      x: 70,
      minX: 60,
      maxX: 82,
      facing: "right",
      name:
        locationId === "shelled_clinic"
          ? "失控冷库安保机甲"
          : "夜游劫掠匪徒",
      subtitle: "守卫二楼深处物资通道",
      enemyIds:
        locationId === "shelled_clinic"
          ? ["sentry_bot"]
          : ["scrap_looter", "rad_hound"],
      isElite: locationId === "shelled_clinic",
      defeated: false,
    });
  }

  patrols.push({
    id: "patrol_f3_top",
    floor: 3,
    x: 68,
    minX: 54,
    maxX: 82,
    facing: "left",
    name:
      locationId === "cryo_reactor"
        ? "核冬巢穴巨钳兽（区域霸主）"
        : campaign.activeCommission && !campaign.activeCommission.completed
        ? "猎犬加密信标卫队"
        : "深层重装守卫",
    subtitle:
      locationId === "cryo_reactor" && campaign.nightBossWeakened
        ? "白昼情报生效：首领初始生命已削减 20%！"
        : "镇守顶层核心军火箱与极品食材",
    enemyIds:
      locationId === "cryo_reactor"
        ? ["frost_claw_boss"]
        : campaign.activeCommission && !campaign.activeCommission.completed
        ? ["beacon_drone", "rad_hound"]
        : ["sentry_bot"],
    isElite: locationId !== "cryo_reactor",
    isBoss: locationId === "cryo_reactor",
    isCommissionGuard: Boolean(
      campaign.activeCommission && !campaign.activeCommission.completed
    ),
    defeated: false,
  });

  const floorLabels: [string, string, string] =
    locationId === "shelled_clinic"
      ? ["1F 门诊门厅", "B1 恒温药库", "B2 深层菌室"]
      : locationId === "cryo_reactor"
      ? ["1F 泵站入口", "B1 冷却管网", "B2 反应核芯"]
      : ["1F 底层门厅", "2F 中层内室", "3F 顶层阁楼"];

  return {
    locationId,
    locationName: loc.name,
    floorLabels,
    playerFloor: 1,
    playerX: 12,
    playerFacing: "right",
    ladders,
    objects,
    patrols,
    scrapParts: 2,
    activeSurvivorId: null,
    exploreLog: [`潜入「${loc.name}」`],
  };
}
