import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Heart, Plus, Shield, Sparkles, Wrench } from "lucide-react";
import { INGREDIENT_LIST } from "../data/gameConfig";
import {
  ARCHETYPE_META,
  createDefaultRpgState,
  getNormalizedDeckCards,
  PERK_LIBRARY,
  resolveCardStats,
  RPG_ATTRIBUTE_META,
} from "../data/rpgAndCards";
import {
  CampaignSaveState,
  CardArchetype,
  RpgAttributeKey,
} from "../types/game";
import { soundFx } from "../utils/sound";
import { IllustratedGameCard } from "./IllustratedGameCard";
import { CompanionCombatFigure } from "./NightRoguelikeView";
import { WastelandTooltip } from "./WastelandTooltip";

interface PipBoyDuskViewProps {
  state: CampaignSaveState;
  onHealWithCaps: () => void;
  onAllocateStat: (attr: RpgAttributeKey) => void;
  onSelectPerk: (perkId: string) => void;
  onUpgradeCard: (cardUid: string) => void;
  onStartNightRun: () => void;
}

type PipDuskTab = "STAT" | "RPG" | "DECK" | "PREP";

export const PipBoyDuskView: React.FC<PipBoyDuskViewProps> = ({
  state,
  onHealWithCaps,
  onAllocateStat,
  onSelectPerk,
  onUpgradeCard,
  onStartNightRun,
}) => {
  const rpg = state.rpg || createDefaultRpgState();
  const hasPendingRpg =
    (rpg.statPoints || 0) > 0 || (rpg.pendingPerkChoices || 0) > 0;

  const [activeTab, setActiveTab] = useState<PipDuskTab>("STAT");
  const [archFilter, setArchFilter] = useState<"ALL" | CardArchetype>("ALL");

  const deckCards = useMemo(() => getNormalizedDeckCards(state), [state]);

  const filteredDeck = useMemo(() => {
    return deckCards.filter((entry) => {
      if (archFilter === "ALL") return true;
      const resolved = resolveCardStats(entry.defId, entry.upgraded);
      return resolved.archetype === archFilter;
    });
  }, [deckCards, archFilter]);

  const archetypeCounts = useMemo(() => {
    const map: Record<CardArchetype, number> = {
      NEUTRAL: 0,
      GUNSLINGER: 0,
      JUGGERNAUT: 0,
      RAD_BIO: 0,
      GADGETEER: 0,
    };
    deckCards.forEach((c) => {
      const st = resolveCardStats(c.defId, c.upgraded);
      map[st.archetype] = (map[st.archetype] || 0) + 1;
    });
    return map;
  }, [deckCards]);

  const healAmount = rpg.unlockedPerks.includes("perk_vault_constitution")
    ? 22
    : 15;

  const xpRatio = Math.min(
    100,
    Math.round((rpg.xp / Math.max(1, rpg.nextLevelXp)) * 100)
  );

  return (
    <div className="h-full w-full flex items-center justify-center py-1 sm:py-2 select-none">
      {/* 抬腕特写军绿重金属哔哔小子 3000 终端机壳 */}
      <div className="relative w-full max-w-[1220px] h-full max-h-[760px] rounded-[26px] border-4 border-[#3B4436] bg-gradient-to-b from-[#272E23] via-[#1C2219] to-[#131811] p-3 sm:p-5 shadow-[0_28px_80px_rgba(0,0,0,0.95),inset_0_2px_0_rgba(255,255,255,0.08)] flex flex-col lg:flex-row gap-3 sm:gap-4 overflow-hidden">
        {/* 四角工业沉头铆钉 */}
        <span
          aria-hidden="true"
          className="hidden sm:block absolute top-2.5 left-2.5 w-3 h-3 rounded-full border border-[#56634E] bg-[#141812]"
        />
        <span
          aria-hidden="true"
          className="hidden sm:block absolute top-2.5 right-2.5 w-3 h-3 rounded-full border border-[#56634E] bg-[#141812]"
        />
        <span
          aria-hidden="true"
          className="hidden sm:block absolute bottom-2.5 left-2.5 w-3 h-3 rounded-full border border-[#56634E] bg-[#141812]"
        />
        <span
          aria-hidden="true"
          className="hidden sm:block absolute bottom-2.5 right-2.5 w-3 h-3 rounded-full border border-[#56634E] bg-[#141812]"
        />

        {/* 左侧护腕金属铭牌与状态指示柱（桌面端呈现抬腕机械结构感） */}
        <aside className="hidden lg:flex w-44 shrink-0 flex-col justify-between rounded-xl border border-[#414C3B] bg-[#161B14] p-3.5 text-[#A7F3D0] font-mono-num">
          <div className="space-y-2">
            <div className="border-b border-[#4ADE80]/20 pb-2">
              <p className="text-[10px] text-[#86EFAC]/75">PIP-OS TERMINAL</p>
              <p className="text-sm font-bold text-[#DCFCE7] mt-0.5">
                黄昏打烊结算机
              </p>
            </div>
            <div className="space-y-1.5 text-xs pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[#86EFAC]/70">营业天数</span>
                <strong className="text-[#4ADE80]">
                  D0{state.day}/0{state.maxDays}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#86EFAC]/70">掌柜等级</span>
                <strong className="text-[#4ADE80]">LV.{rpg.level}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#86EFAC]/70">库存瓶盖</span>
                <strong className="text-[#FBBF24]">{state.caps}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#86EFAC]/70">生命状态</span>
                <strong className="text-[#4ADE80]">
                  {state.playerHp}/{state.playerMaxHp}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#86EFAC]/70">酒馆耐久</span>
                <strong className="text-[#DCFCE7]">{state.tavernSecurity}%</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#86EFAC]/70">避风声望</span>
                <strong className="text-[#DCFCE7]">{state.havenReputation}</strong>
              </div>
            </div>
          </div>

          {/* 实体频道快切旋钮区 */}
          <div className="space-y-2 border-t border-[#4ADE80]/20 pt-3">
            <p className="text-[10px] text-[#86EFAC]/70">机械拨盘通道</p>
            {(
              [
                { id: "STAT" as const, label: "01. 营业统计" },
                {
                  id: "RPG" as const,
                  label: `02. 等级专长${hasPendingRpg ? " (!)" : ""}`,
                },
                {
                  id: "DECK" as const,
                  label: `03. 牌组升星${rpg.upgradeTokens > 0 ? ` (${rpg.upgradeTokens})` : ""}`,
                },
                { id: "PREP" as const, label: "04. 夜探整备" },
              ] as const
            ).map((knob) => {
              const active = activeTab === knob.id;
              return (
                <button
                  key={knob.id}
                  type="button"
                  onClick={() => {
                    soundFx.playPipBoyBeep();
                    setActiveTab(knob.id);
                  }}
                  className={`w-full px-2.5 py-1.5 rounded border text-left text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? "border-[#4ADE80] bg-[#1F3A26] text-[#DCFCE7] font-bold"
                      : "border-[#3C4A38] bg-[#111610] text-[#86EFAC]/75 hover:text-[#DCFCE7]"
                  }`}
                >
                  {knob.label}
                </button>
              );
            })}
          </div>
        </aside>

        {/* 中央主荧光绿弧面 CRT 终端视窗 */}
        <div className="pipboy-crt flex-1 min-w-0 rounded-2xl border-2 border-[#4ADE80]/45 p-4 sm:p-6 flex flex-col justify-between text-[#4ADE80] overflow-hidden">
          {/* 顶部荧光绿页签导航栏 */}
          <div className="shrink-0 border-b border-[#4ADE80]/30 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <div className="flex items-center gap-2 font-mono-num text-xs text-[#86EFAC]">
                <span>DAY {String(state.day).padStart(2, "0")} · 黄昏打烊盘点终端</span>
                <span>·</span>
                <span>
                  LV.{rpg.level} ({rpg.xp}/{rpg.nextLevelXp} XP)
                </span>
              </div>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-[#DCFCE7] pipboy-glow mt-0.5">
                哔哔小子每日营业统计与夜探整备
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#051208]/90 border border-[#4ADE80]/30">
              {(
                [
                  { id: "STAT" as const, label: "营业账目" },
                  {
                    id: "RPG" as const,
                    label: hasPendingRpg
                      ? `角色专长 +${(rpg.statPoints || 0) + (rpg.pendingPerkChoices || 0)}`
                      : "角色专长",
                  },
                  {
                    id: "DECK" as const,
                    label:
                      rpg.upgradeTokens > 0
                        ? `牌组升星 +${rpg.upgradeTokens}`
                        : "牌组升星",
                  },
                  { id: "PREP" as const, label: "物资与包扎" },
                ] as const
              ).map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      soundFx.playPipBoyBeep();
                      setActiveTab(tab.id);
                    }}
                    className={`px-3 py-1.5 rounded text-xs font-mono-num font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? "bg-[#4ADE80] text-[#05180B]"
                        : "text-[#86EFAC] hover:bg-[#4ADE80]/15"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 中部可滚动页签主内容区 */}
          <div className="flex-1 min-h-0 overflow-y-auto py-4 pr-1">
            {activeTab === "STAT" && (
              <motion.div
                key="tab_stat"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16 }}
                className="space-y-4"
              >
                {/* 四格核心账目读数 */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-mono-num">
                  <div className="rounded-lg border border-[#4ADE80]/30 bg-[#071B0D]/80 p-3.5">
                    <span className="text-xs text-[#86EFAC]/80 block">
                      今日接待酒客
                    </span>
                    <strong className="text-2xl font-bold text-[#DCFCE7] pipboy-glow mt-1 block">
                      {state.todayLedger.patronsServed} 位
                    </strong>
                  </div>

                  <div className="rounded-lg border border-[#4ADE80]/30 bg-[#071B0D]/80 p-3.5">
                    <span className="text-xs text-[#86EFAC]/80 block">
                      今日实收瓶盖
                    </span>
                    <strong className="text-2xl font-bold text-[#FBBF24] mt-1 block">
                      +{state.todayLedger.capsEarned}
                    </strong>
                  </div>

                  <div className="rounded-lg border border-[#4ADE80]/30 bg-[#071B0D]/80 p-3.5">
                    <span className="text-xs text-[#86EFAC]/80 block">
                      人情赊账待还
                    </span>
                    <strong className="text-2xl font-bold text-[#DCFCE7] mt-1 block">
                      {state.todayLedger.capsCreditIssued} 盖
                    </strong>
                  </div>

                  <div className="rounded-lg border border-[#4ADE80]/30 bg-[#071B0D]/80 p-3.5">
                    <span className="text-xs text-[#86EFAC]/80 block">
                      今日历练经验
                    </span>
                    <strong className="text-2xl font-bold text-[#4ADE80] pipboy-glow mt-1 block">
                      +{state.todayLedger.xpEarnedToday || 0} XP
                    </strong>
                  </div>
                </div>

                {/* 今夜废墟昼夜因果态势扫描 */}
                <div className="rounded-lg border border-[#4ADE80]/30 bg-[#06160B]/85 p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-[#4ADE80]/20 pb-2">
                    <h2 className="font-bold text-sm text-[#DCFCE7]">
                      今夜城市废墟昼夜因果态势扫描
                    </h2>
                    <span className="font-mono-num text-[#86EFAC]">
                      4 处废墟建筑可选
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[#BBF7D0] leading-relaxed">
                    {state.nightCompanion && (
                      <p>
                        · 同行助战：「{state.nightCompanion.name}」已背上装备就位（战斗每回合末自动施展「{state.nightCompanion.skillName}」）
                      </p>
                    )}
                    {state.activeCommission && (
                      <p className="text-[#FDE68A]">
                        · 专属委托：废墟顶层已标出《{state.activeCommission.title}》，取回后黎明交差领 +{state.activeCommission.rewardCaps} 瓶盖
                      </p>
                    )}
                    {state.nightIntelUnlocked && (
                      <p>
                        · 熟客密道：「{state.nightIntelPatronName}」留下的暗号已点亮废墟 2F「免锁特供医药冷藏室」
                      </p>
                    )}
                    {state.nightTrapCacheUnlocked && (
                      <p>
                        · 设局收获：被假坐标坑进盲区的暗探在废墟 1F 留下了「诱敌遗落补给箱」
                      </p>
                    )}
                    {state.nightBossWeakened && (
                      <p>
                        · 首领削弱：「极寒地底冷却核芯」顶层巨钳兽初始生命已削减 20%
                      </p>
                    )}
                    {state.nightHitmanTriggered && (
                      <p className="text-[#FCA5A5]">
                        · 高危警报：「{state.nightHitmanSponsor}」幕后势力已派出精英买凶猎手在废墟 2F 巡逻（残血可用口才劝降）
                      </p>
                    )}
                    {state.nightAmbushTriggered && (
                      <p className="text-[#FCA5A5]">
                        · 仇家伏击：白天与「{state.nightAmbushPatronName}」结怨，今晚废墟 2F 驻有铁锈伏击手
                      </p>
                    )}
                    {state.todayLedger.notableEvents.map((ev, idx) => (
                      <p key={idx} className="text-[#86EFAC]">
                        · 营业纪要：{ev}
                      </p>
                    ))}
                    {!state.nightCompanion &&
                      !state.activeCommission &&
                      !state.nightIntelUnlocked &&
                      !state.nightTrapCacheUnlocked &&
                      !state.nightHitmanTriggered &&
                      !state.nightAmbushTriggered && (
                        <p className="text-[#86EFAC]/85">
                          · 今晚街区风平浪静，建议在城市废墟地图选择所需食材据点潜行搜刮，注意从敌人背后靠近触发先手偷袭。
                        </p>
                      )}
                  </div>
                </div>

                {(hasPendingRpg || rpg.upgradeTokens > 0) && (
                  <div className="rounded-lg border border-[#FBBF24]/55 bg-[#241D07]/75 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#FDE68A]">
                    <span>
                      提示：当前尚有未使用的成长奖励（属性点 {rpg.statPoints} · 待选专长{" "}
                      {rpg.pendingPerkChoices} · 卡牌升级点 {rpg.upgradeTokens}），建议出发前完成加点与升星！
                    </span>
                    <div className="flex items-center gap-2">
                      {hasPendingRpg && (
                        <button
                          type="button"
                          onClick={() => setActiveTab("RPG")}
                          className="px-2.5 py-1 rounded bg-[#FBBF24] text-[#1A1305] font-bold whitespace-nowrap cursor-pointer"
                        >
                          前往加点选专长
                        </button>
                      )}
                      {rpg.upgradeTokens > 0 && (
                        <button
                          type="button"
                          onClick={() => setActiveTab("DECK")}
                          className="px-2.5 py-1 rounded border border-[#FBBF24] text-[#FDE68A] font-bold whitespace-nowrap cursor-pointer"
                        >
                          前往升星卡牌
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "RPG" && (
              <motion.div
                key="tab_rpg"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16 }}
                className="space-y-4"
              >
                {/* 等级经验条 */}
                <div className="rounded-lg border border-[#4ADE80]/30 bg-[#071B0D]/80 p-3.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 font-mono-num text-xs">
                    <span className="font-bold text-sm text-[#DCFCE7]">
                      废土掌柜等级 LV.{rpg.level}（昼夜共享成长）
                    </span>
                    <span className="text-[#86EFAC]">
                      可用属性点：<strong className="text-[#FBBF24]">{rpg.statPoints}</strong>{" "}
                      · 待选专长：<strong className="text-[#FBBF24]">{rpg.pendingPerkChoices}</strong>
                    </span>
                  </div>
                  <div className="h-2.5 rounded bg-[#041007] border border-[#4ADE80]/30 overflow-hidden">
                    <div
                      className="h-full bg-[#4ADE80] origin-left transition-transform duration-200"
                      style={{ transform: `scaleX(${xpRatio / 100})` }}
                    />
                  </div>
                  <p className="text-[11px] text-[#86EFAC]/85 font-mono-num">
                    当前经验 {rpg.xp} / {rpg.nextLevelXp} XP · 每次升级获得：+6 最大生命、+2 基础属性点、+1 卡牌升级点、+1 辐射风专长
                  </p>
                </div>

                {/* 四维属性面板 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(["STR", "AGI", "ELO", "CHA"] as RpgAttributeKey[]).map(
                    (key) => {
                      const meta = RPG_ATTRIBUTE_META[key];
                      const val = rpg.attributes[key] || 2;
                      return (
                        <WastelandTooltip
                          key={key}
                          title={`${meta.name} (${meta.code}) · 当前 ${val} 点`}
                          subtitle="昼夜通用基础属性"
                          description={`白昼互动：${meta.dayEffect}。黑夜探索与牌局：${meta.nightEffect}。`}
                          details={[
                            {
                              label: "2d6 检定修正",
                              value: `+${val}`,
                              tone: "emerald",
                            },
                            {
                              label: "剩余属性点",
                              value: `${rpg.statPoints} 点`,
                              tone: rpg.statPoints > 0 ? "amber" : "slate",
                            },
                          ]}
                          className="w-full block"
                        >
                          <div className="rounded-lg border border-[#4ADE80]/30 bg-[#071B0D]/80 p-3.5 flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 font-mono-num">
                                <strong className="text-sm text-[#DCFCE7]">
                                  {meta.name} ({meta.code})
                                </strong>
                                <span className="text-base font-bold text-[#4ADE80] pipboy-glow">
                                  {val} 点
                                </span>
                              </div>
                              <p className="text-[11px] text-[#BBF7D0] leading-snug">
                                白昼：{meta.dayEffect}
                              </p>
                              <p className="text-[11px] text-[#86EFAC]/85 leading-snug">
                                黑夜：{meta.nightEffect}
                              </p>
                            </div>

                            <button
                              type="button"
                              disabled={rpg.statPoints <= 0}
                              onClick={() => {
                                soundFx.playPipBoyBeep();
                                onAllocateStat(key);
                              }}
                              className="px-2.5 py-1.5 rounded border border-[#4ADE80] bg-[#163820] hover:bg-[#20502E] disabled:opacity-30 text-[#DCFCE7] font-mono-num text-xs font-bold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>加点</span>
                            </button>
                          </div>
                        </WastelandTooltip>
                      );
                    }
                  )}
                </div>

                {/* 辐射风专长 (Perks) 列表 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <h3 className="font-bold text-[#DCFCE7]">
                      辐射风专精专长（已习得 {rpg.unlockedPerks.length}/{PERK_LIBRARY.length}）
                    </h3>
                    {rpg.pendingPerkChoices > 0 && (
                      <span className="font-mono-num font-bold text-[#FBBF24]">
                        可立即习得 {rpg.pendingPerkChoices} 项新专长！
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {PERK_LIBRARY.map((perk) => {
                      const unlocked = rpg.unlockedPerks.includes(perk.id);
                      const canUnlock = !unlocked && rpg.pendingPerkChoices > 0;
                      return (
                        <div
                          key={perk.id}
                          className={`rounded-lg border p-3 flex items-start justify-between gap-2.5 ${
                            unlocked
                              ? "border-[#4ADE80] bg-[#12311B]/85"
                              : "border-[#4ADE80]/25 bg-[#06150B]/80"
                          }`}
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 text-xs font-mono-num">
                              <strong className="text-[#DCFCE7]">
                                《{perk.name}》
                              </strong>
                              <span className="text-[#86EFAC]/80">
                                · {perk.archetypeTag}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#BBF7D0]/90 leading-snug">
                              {perk.description}
                            </p>
                          </div>
                          {unlocked ? (
                            <span className="font-mono-num text-[11px] font-bold text-[#4ADE80] shrink-0">
                              已习得
                            </span>
                          ) : canUnlock ? (
                            <button
                              type="button"
                              onClick={() => {
                                soundFx.playVerdictStamp();
                                onSelectPerk(perk.id);
                              }}
                              className="px-2.5 py-1 rounded bg-[#FBBF24] hover:bg-[#FCD34D] text-[#181205] text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              习得专长
                            </button>
                          ) : (
                            <span className="font-mono-num text-[11px] text-[#86EFAC]/45 shrink-0">
                              升级解锁
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "DECK" && (
              <motion.div
                key="tab_deck"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16 }}
                className="space-y-3.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-[#4ADE80]/30 bg-[#071B0D]/80 p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2 font-mono-num">
                    <span className="text-[#DCFCE7] font-bold">
                      探险牌组 {deckCards.length} 张
                    </span>
                    <span>·</span>
                    <span className="text-[#FBBF24] font-bold">
                      可用卡牌升级点：{rpg.upgradeTokens}
                    </span>
                    <span>·</span>
                    <span className="text-[#86EFAC]">
                      枪火{archetypeCounts.GUNSLINGER} / 重甲{archetypeCounts.JUGGERNAUT} / 辐射{archetypeCounts.RAD_BIO} / 机关{archetypeCounts.GADGETEER}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    {(
                      [
                        { id: "ALL" as const, label: "全部" },
                        { id: "GUNSLINGER" as const, label: "枪火连击" },
                        { id: "JUGGERNAUT" as const, label: "废铁重甲" },
                        { id: "RAD_BIO" as const, label: "辐射生化" },
                        { id: "GADGETEER" as const, label: "拾荒机关" },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setArchFilter(f.id)}
                        className={`px-2 py-1 rounded text-[11px] font-mono-num whitespace-nowrap shrink-0 cursor-pointer ${
                          archFilter === f.id
                            ? "bg-[#4ADE80] text-[#06180B] font-bold"
                            : "text-[#86EFAC] hover:bg-[#4ADE80]/15"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredDeck.map((entry) => {
                    const cur = resolveCardStats(entry.defId, entry.upgraded);
                    const nextPreview = resolveCardStats(entry.defId, true);
                    return (
                      <IllustratedGameCard
                        key={entry.uid}
                        stats={cur}
                        upgraded={entry.upgraded}
                        theme="pipboy"
                        compact
                        upgradePreviewText={
                          !entry.upgraded ? nextPreview.description : undefined
                        }
                      >
                        {!entry.upgraded && (
                          <button
                            type="button"
                            disabled={rpg.upgradeTokens <= 0}
                            onClick={() => {
                              soundFx.playBottleCaps();
                              onUpgradeCard(entry.uid);
                            }}
                            className="w-full py-1.5 px-3 rounded border border-[#4ADE80] bg-[#173D22] hover:bg-[#215430] disabled:opacity-30 text-xs font-mono-num font-bold text-[#DCFCE7] flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            <span>
                              {rpg.upgradeTokens > 0
                                ? "升至 +1 星（-1升级点）"
                                : "可在废墟工作台用零件升星"}
                            </span>
                          </button>
                        )}
                      </IllustratedGameCard>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {activeTab === "PREP" && (
              <motion.div
                key="tab_prep"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16 }}
                className="space-y-4"
              >
                {/* 战地包扎医疗舱 */}
                <div className="rounded-lg border border-[#4ADE80]/35 bg-[#071B0D]/85 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-mono-num text-sm font-bold text-[#DCFCE7]">
                      <Shield className="w-4 h-4 text-[#4ADE80]" />
                      <span>
                        当前探险生命：{state.playerHp} / {state.playerMaxHp} HP
                      </span>
                    </div>
                    <p className="text-xs text-[#86EFAC]">
                      出发前可消耗 8 枚瓶盖使用抗辐急救绷带，立即恢复 +{healAmount} 点生命值。
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={
                      state.caps < 8 || state.playerHp >= state.playerMaxHp
                    }
                    onClick={onHealWithCaps}
                    className="px-4 py-2 rounded border border-[#4ADE80] bg-[#183E24] hover:bg-[#225632] disabled:opacity-35 text-xs font-mono-num font-bold text-[#DCFCE7] flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Heart className="w-4 h-4 text-[#4ADE80]" />
                    <span>战地包扎（-8 瓶盖 / +{healAmount} 生命）</span>
                  </button>
                </div>

                {state.nightCompanion && (
                  <div className="rounded-lg border border-[#4ADE80]/35 bg-[#071B0D]/85 p-3.5 flex items-center gap-4">
                    <div className="h-24 w-20 rounded border border-[#4ADE80]/40 bg-[#041007] flex items-end justify-center overflow-hidden shrink-0">
                      <CompanionCombatFigure
                        companion={state.nightCompanion}
                        heightClass="h-[92px]"
                      />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <span className="font-mono-num text-[11px] text-[#86EFAC]">
                        今夜同行战斗员已就位
                      </span>
                      <h4 className="font-display text-base font-bold text-[#DCFCE7]">
                        {state.nightCompanion.name} · {state.nightCompanion.skillName}
                      </h4>
                      <p className="text-xs text-[#BBF7D0] leading-snug">
                        {state.nightCompanion.skillDesc}
                      </p>
                    </div>
                  </div>
                )}

                {/* 冷藏柜食材盘点（指导今夜选哪个废墟据点） */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-[#DCFCE7]">
                    吧台冷藏箱剩余原料清点（悬停查看调酒加成，按缺口挑选今夜废墟据点）
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 font-mono-num">
                    {INGREDIENT_LIST.map((ing) => {
                      const count = state.inventory[ing.id] || 0;
                      return (
                        <WastelandTooltip
                          key={ing.id}
                          title={ing.name}
                          subtitle={`库存 ×${count}`}
                          description={ing.subtitle}
                          details={[
                            {
                              label: "酒精度 / 安抚 / 净辐",
                              value: `+${ing.potencyBonus} / +${ing.soothingBonus} / +${ing.purificationBonus}`,
                              tone: "emerald",
                            },
                            {
                              label: "风味标签",
                              value: ing.flavorTags.join(" · "),
                              tone: "amber",
                            },
                          ]}
                          className="w-full block"
                        >
                          <div className="rounded-lg border border-[#4ADE80]/25 bg-[#06160B]/80 p-3 flex items-center justify-between gap-2 cursor-help">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[#DCFCE7] truncate">
                                {ing.name}
                              </p>
                              <p className="text-[10px] text-[#86EFAC]/75 truncate">
                                {ing.flavorTags.join(" · ")}
                              </p>
                            </div>
                            <span
                              className={`text-lg font-bold shrink-0 ${
                                count <= 1 ? "text-[#FCA5A5]" : "text-[#4ADE80]"
                              }`}
                            >
                              ×{count}
                            </span>
                          </div>
                        </WastelandTooltip>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* 底部荧光绿终端出发操作栏 */}
          <div className="shrink-0 border-t border-[#4ADE80]/30 pt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono-num text-[#86EFAC]">
              <button
                type="button"
                disabled={state.caps < 8 || state.playerHp >= state.playerMaxHp}
                onClick={onHealWithCaps}
                className="px-3 py-1.5 rounded border border-[#4ADE80]/45 bg-[#0A2211] hover:bg-[#13381D] disabled:opacity-35 text-[#DCFCE7] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Heart className="w-3.5 h-3.5 text-[#4ADE80]" />
                <span>快捷包扎 (-8盖/+{healAmount}HP)</span>
              </button>
              <span>
                HP {state.playerHp}/{state.playerMaxHp} · 瓶盖 {state.caps} · 牌组{" "}
                {deckCards.length} 张
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                soundFx.playPipBoyBeep();
                onStartNightRun();
              }}
              className="px-6 py-2.5 rounded-lg bg-[#4ADE80] hover:bg-[#86EFAC] text-[#041609] font-bold text-sm flex items-center justify-center gap-2 whitespace-nowrap shrink-0 shadow-[0_0_24px_rgba(74,222,128,0.35)] cursor-pointer transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span>展开城市废墟地图（潜入夜探）</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
