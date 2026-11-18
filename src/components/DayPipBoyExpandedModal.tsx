import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Minimize2, Sparkles, ArrowUpRight } from "lucide-react";
import {
  ARTWORK_ASSETS,
  INGREDIENT_LIST,
  resolveNpcProfile,
  resolveProtagonistSprites,
} from "../data/gameConfig";
import {
  compute2d6SuccessChancePct,
  createDefaultRpgState,
  PERK_LIBRARY,
  RPG_ATTRIBUTE_META,
} from "../data/rpgAndCards";
import { CampaignSaveState, RpgAttributeKey } from "../types/game";
import { soundFx } from "../utils/sound";
import { ArtworkImage } from "./ArtworkImage";
import { CutoutSprite } from "./CutoutSprite";
import { ModularNpcPortrait } from "./ModularNpcPortrait";
import { WastelandTooltip } from "./WastelandTooltip";

export type ExpandedPipTab = "OVERVIEW" | "BAR_STOCK" | "BULLETINS" | "RUMORS";

interface DayPipBoyExpandedModalProps {
  state: CampaignSaveState;
  initialTab: ExpandedPipTab;
  onClose: () => void;
  onOpenDeckAndPerks: () => void;
  onInspectCurrentPatron: () => void;
}

export const DayPipBoyExpandedModal: React.FC<DayPipBoyExpandedModalProps> = ({
  state,
  initialTab,
  onClose,
  onOpenDeckAndPerks,
  onInspectCurrentPatron,
}) => {
  const [activeTab, setActiveTab] = useState<ExpandedPipTab>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const rpg = state.rpg || createDefaultRpgState();
  const unspentRpgCount =
    (rpg.statPoints || 0) +
    (rpg.pendingPerkChoices || 0) +
    (rpg.upgradeTokens || 0);

  const protagonist = useMemo(() => resolveProtagonistSprites(), []);

  const totalDebt = useMemo(
    () =>
      Object.values(state.npcs).reduce((sum, n) => sum + (n?.debtCaps || 0), 0),
    [state.npcs]
  );

  const unlockedPerkDefs = useMemo(
    () => PERK_LIBRARY.filter((p) => rpg.unlockedPerks.includes(p.id)),
    [rpg.unlockedPerks]
  );

  const bulletins = state.dailyBulletins || [];
  const rumors = state.activeRumors || [];
  const rumorTrustNet = rumors.reduce((s, r) => s + r.trustMod, 0);
  const rumorTensionNet = rumors.reduce((s, r) => s + r.tensionMod, 0);

  const hpPct = Math.max(
    0,
    Math.min(
      100,
      Math.round((state.playerHp / Math.max(1, state.playerMaxHp)) * 100)
    )
  );
  const secPct = Math.max(0, Math.min(100, state.tavernSecurity));
  const xpPct = Math.max(
    0,
    Math.min(100, Math.round((rpg.xp / Math.max(1, rpg.nextLevelXp)) * 100))
  );

  const intelTags = [
    state.nightCompanion ? `同行 · ${state.nightCompanion.name}` : null,
    state.activeCommission ? `委托 · ${state.activeCommission.title}` : null,
    state.nightIntelUnlocked ? `密道 · ${state.nightIntelPatronName}` : null,
    state.nightBossWeakened ? "首领弱点" : null,
    state.nightAmbushTriggered || state.nightHitmanTriggered ? "夜路伏击警戒" : null,
  ].filter(Boolean) as string[];

  return (
    <div
      className="fixed inset-0 z-50 bg-[#070605]/78 backdrop-blur-xs flex items-center justify-center p-4 sm:p-8 select-none"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="状态终端"
        className="relative w-full max-w-[820px] rounded-[22px] border-4 border-[#4A5238] bg-gradient-to-b from-[#333928] via-[#1F251A] to-[#141811] p-3.5 sm:p-5 shadow-[0_32px_90px_rgba(0,0,0,0.96),inset_0_2px_0_rgba(235,224,182,0.18)]"
      >
        {/* 四角一字沉头铆钉 */}
        <span
          aria-hidden="true"
          className="hidden sm:block absolute top-2.5 left-2.5 w-3 h-3 rounded-full border border-[#656E4E] bg-[#161A12]"
        />
        <span
          aria-hidden="true"
          className="hidden sm:block absolute top-2.5 right-2.5 w-3 h-3 rounded-full border border-[#656E4E] bg-[#161A12]"
        />
        <span
          aria-hidden="true"
          className="hidden sm:block absolute bottom-2.5 left-2.5 w-3 h-3 rounded-full border border-[#656E4E] bg-[#161A12]"
        />
        <span
          aria-hidden="true"
          className="hidden sm:block absolute bottom-2.5 right-2.5 w-3 h-3 rounded-full border border-[#656E4E] bg-[#161A12]"
        />

        {/* 内凹荧光绿 CRT 屏（克制留白、仅保留核心读数，详述全部收进悬停提示） */}
        <div className="pipboy-crt rounded-xl border-3 border-[#2C3427] px-5 py-4 sm:px-8 sm:py-6 text-[#4ADE80] font-mono-num min-h-[430px] max-h-[76vh] flex flex-col justify-between gap-6 overflow-y-auto">
          {/* 顶栏：极简四页签 + 收起键 */}
          <div className="flex items-center justify-between gap-3 border-b border-[#4ADE80]/25 pb-3 shrink-0">
            <div className="flex items-center gap-2 sm:gap-3">
              {(
                [
                  { id: "OVERVIEW" as const, label: "状态" },
                  {
                    id: "BAR_STOCK" as const,
                    label: `队列 · ${state.currentQueueIndex + 1}/${state.todayQueue.length}`,
                  },
                  {
                    id: "BULLETINS" as const,
                    label: `电报 · ${bulletins.length}`,
                  },
                  {
                    id: "RUMORS" as const,
                    label: `风评 · ${rumors.length}`,
                  },
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
                    className={`px-3 py-1 rounded-xs text-xs sm:text-sm tracking-wide transition-colors cursor-pointer ${
                      active
                        ? "bg-[#4ADE80]/22 text-[#ECFCCB] font-bold border border-[#4ADE80]/75"
                        : "text-[#86EFAC]/70 hover:text-[#DCFCE7] border border-transparent"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              {unspentRpgCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playPipBoyBeep();
                    onClose();
                    onOpenDeckAndPerks();
                  }}
                  className="px-2.5 py-1 rounded-xs border border-[#FBBF24]/70 bg-[#FBBF24]/15 hover:bg-[#FBBF24]/25 text-[#FDE68A] text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>+{unspentRpgCount}</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              )}

              <span className="hidden sm:inline text-xs text-[#86EFAC]/65">
                DAY {String(state.day).padStart(2, "0")}
              </span>

              <button
                type="button"
                onClick={() => {
                  soundFx.playPipBoyBeep();
                  onClose();
                }}
                title="收起 (ESC)"
                className="p-1.5 rounded-xs border border-[#4ADE80]/35 hover:border-[#4ADE80] bg-[#071A0E] text-[#86EFAC] hover:text-[#ECFCCB] transition-colors cursor-pointer"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 主视窗 */}
          <div className="flex-1 flex flex-col justify-center">
            {activeTab === "OVERVIEW" && (
              <div className="space-y-7">
                {/* 上半：掌柜肖像与四维核心读数（大字留白） */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  {/* 掌柜头像 + 等级条 */}
                  <div className="md:col-span-4 flex items-center gap-4">
                    <div className="w-16 h-16 sm:w-18 sm:h-18 rounded border border-[#4ADE80]/45 bg-[#081C0E] overflow-hidden shrink-0">
                      {protagonist.avatarUrl.startsWith("data:") ? (
                        <CutoutSprite
                          src={protagonist.avatarUrl}
                          alt={protagonist.name}
                          cropMode="none"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <ArtworkImage
                          src={protagonist.avatarUrl}
                          alt={protagonist.name}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="text-sm font-bold text-[#ECFCCB] truncate">
                        {protagonist.name}
                      </div>
                      <div className="flex items-baseline justify-between text-xs text-[#86EFAC]">
                        <strong className="text-base text-[#4ADE80] pipboy-glow">
                          LV.{rpg.level}
                        </strong>
                        <span>
                          {rpg.xp}/{rpg.nextLevelXp}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-xs bg-[#041008] border border-[#4ADE80]/30 overflow-hidden">
                        <div
                          className="h-full bg-[#4ADE80]"
                          style={{ width: `${xpPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 四大经营生存指标 */}
                  <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <WastelandTooltip
                      title="瓶盖金库 (CAPS)"
                      subtitle={`今日进账 +${state.todayLedger.capsEarned} · 外欠 ${totalDebt}`}
                      description="用于黄昏包扎、垫付赊账、赎买情报与废墟交易。"
                    >
                      <div className="rounded border border-[#4ADE80]/22 bg-[#06150B]/65 px-3.5 py-3 cursor-help">
                        <span className="block text-[10px] text-[#86EFAC]/65">
                          CAPS
                        </span>
                        <strong className="block text-2xl text-[#FBBF24] pipboy-glow mt-1">
                          {state.caps}
                        </strong>
                      </div>
                    </WastelandTooltip>

                    <WastelandTooltip
                      title="掌柜生命 (HP)"
                      subtitle={`${state.playerHp} / ${state.playerMaxHp}`}
                      description="昼夜共享生命状态；可在黄昏打烊阶段消耗瓶盖包扎。"
                    >
                      <div className="rounded border border-[#4ADE80]/22 bg-[#06150B]/65 px-3.5 py-3 cursor-help">
                        <span className="block text-[10px] text-[#86EFAC]/65">
                          HP
                        </span>
                        <strong className="block text-xl text-[#ECFCCB] pipboy-glow mt-1">
                          {state.playerHp}
                          <span className="text-xs text-[#86EFAC]/65">
                            /{state.playerMaxHp}
                          </span>
                        </strong>
                        <div className="h-1 mt-2 bg-[#041008] overflow-hidden">
                          <div
                            className={
                              hpPct <= 35
                                ? "h-full bg-[#F87171]"
                                : "h-full bg-[#4ADE80]"
                            }
                            style={{ width: `${hpPct}%` }}
                          />
                        </div>
                      </div>
                    </WastelandTooltip>

                    <WastelandTooltip
                      title="防空洞耐久 (SEC)"
                      subtitle={`${state.tavernSecurity}%`}
                      description="吧台与防爆门完整度；平息闹事或拆穿内鬼可稳固耐久。"
                    >
                      <div className="rounded border border-[#4ADE80]/22 bg-[#06150B]/65 px-3.5 py-3 cursor-help">
                        <span className="block text-[10px] text-[#86EFAC]/65">
                          SEC
                        </span>
                        <strong className="block text-xl text-[#ECFCCB] pipboy-glow mt-1">
                          {state.tavernSecurity}%
                        </strong>
                        <div className="h-1 mt-2 bg-[#041008] overflow-hidden">
                          <div
                            className="h-full bg-[#4ADE80]"
                            style={{ width: `${secPct}%` }}
                          />
                        </div>
                      </div>
                    </WastelandTooltip>

                    <WastelandTooltip
                      title="街区声望 (REP)"
                      subtitle={`${state.havenReputation}`}
                      description="影响结局走向与熟客信任评价。"
                    >
                      <div className="rounded border border-[#4ADE80]/22 bg-[#06150B]/65 px-3.5 py-3 cursor-help">
                        <span className="block text-[10px] text-[#86EFAC]/65">
                          REP
                        </span>
                        <strong className="block text-2xl text-[#ECFCCB] pipboy-glow mt-1">
                          {state.havenReputation}
                        </strong>
                      </div>
                    </WastelandTooltip>
                  </div>
                </div>

                {/* 中段：四维属性（仅列代号+点数+常规检定率，详细效果悬停显示） */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  {(["STR", "AGI", "ELO", "CHA"] as RpgAttributeKey[]).map(
                    (key) => {
                      const meta = RPG_ATTRIBUTE_META[key];
                      const val = rpg.attributes[key] || 0;
                      const dc8 = compute2d6SuccessChancePct(rpg, key, 8);
                      return (
                        <WastelandTooltip
                          key={key}
                          title={`${meta.name} (${meta.code}) · ${val}`}
                          subtitle={`常规 DC8 成功率 ${dc8}%`}
                          description={`白昼：${meta.dayEffect}\n黑夜：${meta.nightEffect}`}
                        >
                          <div className="rounded border border-[#4ADE80]/20 bg-[#06150B]/50 px-4 py-3 flex items-center justify-between cursor-help hover:border-[#4ADE80]/55 transition-colors">
                            <div>
                              <span className="block text-xs font-bold text-[#DCFCE7]">
                                {meta.name}
                              </span>
                              <span className="block text-[10px] text-[#86EFAC]/60 mt-0.5">
                                {meta.code} · {dc8}%
                              </span>
                            </div>
                            <span className="text-2xl font-bold text-[#4ADE80] pipboy-glow">
                              {val}
                            </span>
                          </div>
                        </WastelandTooltip>
                      );
                    }
                  )}
                </div>

                {/* 下段：专长与今夜动态微标（极简标签排布，无冗余废话） */}
                {(unlockedPerkDefs.length > 0 || intelTags.length > 0) && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#4ADE80]/18">
                    {unlockedPerkDefs.map((perk) => (
                      <WastelandTooltip
                        key={perk.id}
                        title={perk.name}
                        subtitle={perk.archetypeTag}
                        description={perk.description}
                      >
                        <span className="px-2.5 py-1 rounded-xs border border-[#4ADE80]/40 bg-[#4ADE80]/12 text-xs text-[#ECFCCB] cursor-help">
                          {perk.name}
                        </span>
                      </WastelandTooltip>
                    ))}
                    {intelTags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-xs border border-[#86EFAC]/25 bg-[#06150B]/70 text-xs text-[#86EFAC]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "BAR_STOCK" && (
              <div className="space-y-7">
                {/* 今日队列 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {state.todayQueue.map((npcId, idx) => {
                    const p = resolveNpcProfile(state, npcId);
                    const ns = state.npcs[npcId];
                    const isCurrent = idx === state.currentQueueIndex;
                    const isDone = idx < state.currentQueueIndex;
                    return (
                      <WastelandTooltip
                        key={`${npcId}_${idx}`}
                        title={`${p.name} · ${p.title}`}
                        subtitle={`${p.faction} · 喜好：${p.favoriteNotes.join("/")}`}
                        description={p.bio}
                      >
                        <div
                          onClick={() => {
                            if (isCurrent) {
                              soundFx.playPaperRustle();
                              onClose();
                              onInspectCurrentPatron();
                            }
                          }}
                          className={`rounded border p-3 flex items-center gap-3 transition-colors ${
                            isCurrent
                              ? "border-[#4ADE80] bg-[#0C2614]/85 cursor-pointer"
                              : isDone
                              ? "border-[#4ADE80]/15 bg-[#051109]/50 opacity-60"
                              : "border-[#4ADE80]/22 bg-[#06150B]/65"
                          }`}
                        >
                          <div className="w-11 h-11 rounded border border-[#4ADE80]/30 bg-[#040E07] overflow-hidden shrink-0">
                            {p.portraitUrl ? (
                              p.portraitUrl.startsWith("/assets/") &&
                              p.portraitUrl.endsWith(".png") ? (
                                <ArtworkImage
                                  src={p.portraitUrl}
                                  alt={p.name}
                                  className="w-full h-full object-contain object-top"
                                />
                              ) : (
                                <CutoutSprite
                                  src={p.portraitUrl}
                                  alt={p.name}
                                  cropMode="none"
                                  className="w-full h-full object-contain object-top"
                                />
                              )
                            ) : p.modularParts ? (
                              <ModularNpcPortrait
                                parts={p.modularParts}
                                name={p.name}
                                trust={ns?.trust ?? 40}
                                tension={ns?.tension ?? 25}
                                className="w-full h-full"
                              />
                            ) : (
                              <ArtworkImage
                                src={ARTWORK_ASSETS.ashScavenger}
                                alt={p.name}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-bold text-[#ECFCCB] truncate">
                                {p.name}
                              </span>
                              <span className="text-[10px] text-[#86EFAC]/75 shrink-0">
                                {isCurrent ? "在座" : isDone ? "已离" : "候场"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2.5 text-[11px] text-[#86EFAC] mt-1">
                              <span>信 {ns?.trust ?? 40}</span>
                              <span>警 {ns?.tension ?? 25}</span>
                              <span>醺 {ns?.intoxication ?? 0}</span>
                            </div>
                          </div>
                        </div>
                      </WastelandTooltip>
                    );
                  })}
                </div>

                {/* 冰柜 6 原料图标架 */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 pt-2 border-t border-[#4ADE80]/18">
                  {INGREDIENT_LIST.map((ing) => {
                    const count = state.inventory[ing.id] || 0;
                    return (
                      <WastelandTooltip
                        key={ing.id}
                        title={ing.name}
                        subtitle={`库存 ×${count}`}
                        description={`烈度 ${ing.potencyBonus >= 0 ? `+${ing.potencyBonus}` : ing.potencyBonus} · 安抚 ${ing.soothingBonus >= 0 ? `+${ing.soothingBonus}` : ing.soothingBonus} · 净辐 ${ing.purificationBonus >= 0 ? `+${ing.purificationBonus}` : ing.purificationBonus}`}
                      >
                        <div
                          className={`rounded border p-2 text-center cursor-help ${
                            count === 0
                              ? "border-[#EF4444]/40 bg-[#1F0B0B]/45 opacity-75"
                              : "border-[#4ADE80]/22 bg-[#06150B]/65"
                          }`}
                        >
                          <div className="w-12 h-12 mx-auto rounded overflow-hidden bg-[#040C06] border border-[#4ADE80]/25">
                            <ArtworkImage
                              src={ing.imageUrl}
                              alt={ing.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="text-xs font-bold text-[#ECFCCB] mt-1.5">
                            ×{count}
                          </div>
                          <div className="text-[10px] text-[#86EFAC]/75 truncate">
                            {ing.name}
                          </div>
                        </div>
                      </WastelandTooltip>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "BULLETINS" && (
              <div>
                {bulletins.length === 0 ? (
                  <div className="py-16 text-center text-xs text-[#86EFAC]/60 tracking-widest">
                    — 今日频段静默 —
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {bulletins.map((b) => (
                      <div
                        key={b.id}
                        className="rounded border border-[#4ADE80]/28 bg-[#06150B]/70 p-4 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[#ECFCCB]">
                            [{b.code}] {b.title}
                          </span>
                          {b.bountyCaps > 0 && (
                            <span className="px-2 py-0.5 rounded-xs border border-[#FBBF24]/55 text-[#FDE68A] text-[11px] font-bold shrink-0">
                              赏 {b.bountyCaps}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#BBF7D0]/85 leading-relaxed">
                          {b.clueHint}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "RUMORS" && (
              <div className="space-y-4">
                {rumors.length > 0 && (
                  <div className="flex items-center justify-end gap-4 text-xs text-[#86EFAC]">
                    <span>
                      信任 {rumorTrustNet >= 0 ? `+${rumorTrustNet}` : rumorTrustNet}
                    </span>
                    <span>
                      警惕{" "}
                      {rumorTensionNet >= 0
                        ? `+${rumorTensionNet}`
                        : rumorTensionNet}
                    </span>
                  </div>
                )}

                {rumors.length === 0 ? (
                  <div className="py-16 text-center text-xs text-[#86EFAC]/60 tracking-widest">
                    — 暂无街区流言 —
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {rumors.map((r) => (
                      <div
                        key={r.id}
                        className="rounded border border-[#4ADE80]/28 bg-[#06150B]/70 p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[#ECFCCB]">
                            《{r.title}》
                          </span>
                          <span className="text-[11px] text-[#86EFAC]/75 shrink-0">
                            {r.remainingDays}d · 信
                            {r.trustMod >= 0 ? `+${r.trustMod}` : r.trustMod} 警
                            {r.tensionMod >= 0
                              ? `+${r.tensionMod}`
                              : r.tensionMod}
                          </span>
                        </div>
                        <p className="text-xs text-[#BBF7D0]/85 leading-relaxed">
                          {r.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
