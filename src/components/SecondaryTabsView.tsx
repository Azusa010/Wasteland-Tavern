import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Plus,
  Shuffle,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import {
  ARTWORK_ASSETS,
  CARD_LIBRARY,
  DRINK_PRESETS,
  INGREDIENT_LIST,
  MAIN_NPC_ORDER,
  resolveNpcProfile,
} from "../data/gameConfig";
import {
  ARCHETYPE_META,
  createDefaultRpgState,
  getNormalizedDeckCards,
  PERK_LIBRARY,
  resolveCardStats,
  RPG_ATTRIBUTE_META,
} from "../data/rpgAndCards";
import {
  DEFAULT_UNLOCKED_LORE_IDS,
  LORE_CATEGORY_META,
  LoreCategory,
  WASTELAND_LORE_DB,
} from "../data/wastelandLore";
import {
  CampaignSaveState,
  CardArchetype,
  ModularAvatarParts,
  NpcStaticProfile,
  RpgAttributeKey,
  WorkspaceTab,
} from "../types/game";
import { computeRumorAggregate } from "../engine/ruleEngine";
import { soundFx } from "../utils/sound";
import { ArtworkImage } from "./ArtworkImage";
import { CutoutSprite } from "./CutoutSprite";
import { IllustratedGameCard } from "./IllustratedGameCard";
import {
  MODULAR_PART_LABELS,
  ModularNpcPortrait,
  SOMATOTYPE_POOLS,
  describeModularParts,
  resolveModularSelection,
} from "./ModularNpcPortrait";

interface SecondaryTabsViewProps {
  activeTab: Exclude<WorkspaceTab, "STAGE">;
  state: CampaignSaveState;
  providerInfo: { provider: string; modelName: string } | null;
  onAllocateStat?: (attr: RpgAttributeKey) => void;
  onSelectPerk?: (perkId: string) => void;
  onUpgradeCard?: (cardUid: string) => void;
  onClose?: () => void;
}

type JournalBookmarkSection =
  | "REGULARS"
  | "DRIFTERS"
  | "RUMORS"
  | "LORE"
  | "COMPOSITOR";

export const SecondaryTabsView: React.FC<SecondaryTabsViewProps> = ({
  activeTab,
  state,
  providerInfo,
  onAllocateStat,
  onSelectPerk,
  onUpgradeCard,
  onClose,
}) => {
  const [archFilter, setArchFilter] = useState<"ALL" | CardArchetype>("ALL");

  // ==================== 旧皮面双页摊开手记本状态 ====================
  const [journalSection, setJournalSection] = useState<JournalBookmarkSection>(
    activeTab === "LORE" ? "LORE" : "REGULARS"
  );
  const [regularPageIdx, setRegularPageIdx] = useState(0);
  const [drifterPageIdx, setDrifterPageIdx] = useState(0);
  const [loreCategoryFilter, setLoreCategoryFilter] = useState<
    "ALL" | LoreCategory
  >("ALL");
  const [selectedLoreId, setSelectedLoreId] = useState<string>(
    WASTELAND_LORE_DB[0].id
  );

  useEffect(() => {
    if (activeTab === "LORE") {
      setJournalSection("LORE");
    } else if (activeTab === "PATRONS") {
      setJournalSection((prev) => (prev === "LORE" ? "REGULARS" : prev));
    }
  }, [activeTab]);

  // 三大体型分池模块化拼装画册状态
  const [previewParts, setPreviewParts] = useState<ModularAvatarParts>({
    bodyBuild: 0,
    paletteIndex: 0,
    backGear: 0,
    coatStyle: 0,
    neckwear: 0,
    faceShape: 0,
    featureMark: 0,
    eyeStyle: 0,
    headgear: 4,
  });
  const [previewMood, setPreviewMood] = useState<"calm" | "warm" | "angry">(
    "calm"
  );

  const rpg = state.rpg || createDefaultRpgState();
  const deckCards = useMemo(() => getNormalizedDeckCards(state), [state]);

  const filteredDeckEntries = useMemo(() => {
    return deckCards.filter((entry) => {
      if (archFilter === "ALL") return true;
      const stats = resolveCardStats(entry.defId, entry.upgraded);
      return stats.archetype === archFilter;
    });
  }, [deckCards, archFilter]);

  const proceduralList = useMemo(
    () => Object.values(state.proceduralProfiles || {}),
    [state.proceduralProfiles]
  );

  const unlockedLoreSet = useMemo(
    () =>
      new Set<string>(
        state.unlockedLoreIds && state.unlockedLoreIds.length > 0
          ? state.unlockedLoreIds
          : DEFAULT_UNLOCKED_LORE_IDS
      ),
    [state.unlockedLoreIds]
  );

  const filteredLoreList = useMemo(
    () =>
      WASTELAND_LORE_DB.filter(
        (entry) =>
          loreCategoryFilter === "ALL" || entry.category === loreCategoryFilter
      ),
    [loreCategoryFilter]
  );

  // ==================== PATRONS / LORE：双页摊开旧皮面酒保手记本与废土档案 ====================
  if (activeTab === "PATRONS" || activeTab === "LORE") {
    const isRegularSection = journalSection === "REGULARS";
    const isCompositorSection = journalSection === "COMPOSITOR";
    const isRumorsSection = journalSection === "RUMORS";
    const isLoreSection = journalSection === "LORE";

    const activePatronList: NpcStaticProfile[] = isRegularSection
      ? MAIN_NPC_ORDER.map((id) => resolveNpcProfile(state, id))
      : proceduralList.map((p) => resolveNpcProfile(state, p.id));

    const currentPageIdx = isRegularSection
      ? Math.min(regularPageIdx, Math.max(0, activePatronList.length - 1))
      : Math.min(drifterPageIdx, Math.max(0, activePatronList.length - 1));

    const currentProfile: NpcStaticProfile | null =
      !isCompositorSection &&
      !isRumorsSection &&
      !isLoreSection &&
      activePatronList.length > 0
        ? activePatronList[currentPageIdx]
        : null;

    const activeLoreEntry =
      filteredLoreList.find((e) => e.id === selectedLoreId) ||
      filteredLoreList[0] ||
      WASTELAND_LORE_DB[0];
    const activeLoreIdx = Math.max(
      0,
      filteredLoreList.findIndex((e) => e.id === activeLoreEntry.id)
    );
    const isActiveLoreUnlocked = unlockedLoreSet.has(activeLoreEntry.id);

    const rumorAgg = computeRumorAggregate(state);

    const currentNpcState = currentProfile
      ? state.npcs[currentProfile.id] || {
          id: currentProfile.id,
          trust: 40,
          intoxication: 0,
          tension: 24,
          debtCaps: 0,
          visits: 0,
          unlockedCardGiven: false,
          intelSharedToday: false,
          memories: [],
        }
      : null;

    const currentSigCard =
      currentProfile?.signatureCardId &&
      CARD_LIBRARY[currentProfile.signatureCardId]
        ? CARD_LIBRARY[currentProfile.signatureCardId]
        : null;

    const handleFlipPage = (delta: -1 | 1) => {
      if (activePatronList.length <= 1) return;
      soundFx.playPaperRustle();
      const next =
        (currentPageIdx + delta + activePatronList.length) %
        activePatronList.length;
      if (isRegularSection) setRegularPageIdx(next);
      else setDrifterPageIdx(next);
    };

    const resolvedPreview = resolveModularSelection(previewParts);

    return (
      <div className="relative w-full max-w-[1220px] mx-auto my-auto select-none">
        {/* 右侧伸出的实体牛皮纸分类书签条（桌面端伸出皮面右缘，移动端横向排布于顶缘） */}
        <div className="flex lg:flex-col items-stretch gap-1.5 mb-2 lg:mb-0 lg:absolute lg:-right-5 lg:top-[15%] z-30">
          {(
            [
              {
                id: "REGULARS" as const,
                label: "熟客名录",
                badge: `${MAIN_NPC_ORDER.length}`,
                bg: "from-[#D9B683] to-[#B88F56] text-[#231409] border-[#5C3D1E]",
              },
              {
                id: "DRIFTERS" as const,
                label: "过客速写",
                badge: `${proceduralList.length}`,
                bg: "from-[#C7B489] to-[#9E895D] text-[#21150B] border-[#4E3E22]",
              },
              {
                id: "RUMORS" as const,
                label: "江湖风评",
                badge: `${(state.activeRumors || []).length}`,
                bg: "from-[#BA9E72] to-[#8F7045] text-[#221307] border-[#4B361B]",
              },
              {
                id: "LORE" as const,
                label: "废土档案",
                badge: `${unlockedLoreSet.size}/${WASTELAND_LORE_DB.length}`,
                bg: "from-[#B5C69A] to-[#7D9260] text-[#17220D] border-[#384A24]",
              },
              {
                id: "COMPOSITOR" as const,
                label: "拼装图谱",
                badge: "3体型",
                bg: "from-[#D49B6A] to-[#AA6E3F] text-[#231208] border-[#5E3216]",
              },
            ] as const
          ).map((tab) => {
            const active = journalSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  soundFx.playPaperRustle();
                  setJournalSection(tab.id);
                }}
                className={`px-3 py-2 lg:pl-5 lg:pr-3.5 lg:py-3 rounded-t-md lg:rounded-t-none lg:rounded-r-md border-2 bg-gradient-to-b font-display font-bold text-xs sm:text-sm shadow-[4px_6px_14px_rgba(0,0,0,0.65)] transition-transform cursor-pointer flex items-center justify-between gap-2 ${
                  tab.bg
                } ${
                  active
                    ? "lg:translate-x-2 ring-2 ring-[#F7D7A8]/70"
                    : "opacity-85 hover:opacity-100 lg:hover:translate-x-1"
                }`}
              >
                <span className="lg:[writing-mode:vertical-rl] tracking-widest">
                  {tab.label}
                </span>
                <span className="font-mono-num text-[10px] px-1.5 py-0.5 rounded-xs bg-black/15">
                  {tab.badge}
                </span>
              </button>
            );
          })}

          {onClose && (
            <button
              type="button"
              onClick={() => {
                soundFx.playPaperRustle();
                onClose();
              }}
              className="ml-auto lg:ml-0 lg:mt-3 px-3 py-2 lg:pl-5 lg:pr-3 lg:py-3 rounded-t-md lg:rounded-t-none lg:rounded-r-md border-2 border-[#3E110E] bg-gradient-to-b from-[#8F2820] to-[#5E1611] text-[#FCE8E6] font-display font-bold text-xs shadow-[4px_6px_14px_rgba(0,0,0,0.75)] hover:brightness-110 transition-all cursor-pointer flex items-center gap-1"
              title="合上手记本 [ESC]"
            >
              <span className="lg:[writing-mode:vertical-rl] tracking-widest">
                合上手记
              </span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 手记本书体主体：桌面端真实旧皮面双页摊开贴图，窄屏自适应双页牛皮纸 */}
        <div className="relative w-full lg:aspect-[16/10] rounded-xl overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.95)] bg-[#23150C] border-2 border-[#4A301D] lg:border-0 lg:bg-transparent">
          {/* 真实生成的旧皮面双页摊开空白手记本贴图（桌面端铺满书体底层） */}
          <img
            src={ARTWORK_ASSETS.journalSpreadBg}
            alt="摊开的旧皮面酒保手记本"
            draggable={false}
            className="hidden lg:block absolute inset-0 w-full h-full object-fill pointer-events-none select-none"
          />

          {/* 左右双页内容排版容器（精准对齐手记贴图的左页 x:10%..48.5% 与右页 x:51.5%..89.5%） */}
          <div className="relative z-10 w-full h-full grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-0 p-4 sm:p-6 lg:p-0">
            {/* ==================== 左页：胶带贴相片速写 + 橡胶印章 + 口味外貌批注 ==================== */}
            <div className="kraft-paper-3d lg:!bg-none lg:!shadow-none lg:border-0 rounded-md p-4 sm:p-5 lg:pt-[11%] lg:pb-[10.5%] lg:pl-[20.5%] lg:pr-[5.5%] flex flex-col justify-between text-[#24160C] min-h-[430px] lg:min-h-0 overflow-hidden">
              {!isCompositorSection && !isRumorsSection && !isLoreSection ? (
                currentProfile && currentNpcState ? (
                  <motion.div
                    key={`left_${currentProfile.id}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18 }}
                    className="h-full flex flex-col justify-between gap-2.5"
                  >
                    {/* 页眉：本组人物快速书签索引条 */}
                    <div className="flex flex-wrap items-center gap-1 border-b border-[#7A5835]/35 pb-1.5">
                      {activePatronList.map((item, idx) => {
                        const selected = idx === currentPageIdx;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              soundFx.playPaperRustle();
                              if (isRegularSection) setRegularPageIdx(idx);
                              else setDrifterPageIdx(idx);
                            }}
                            className={`px-2 py-0.5 rounded-xs text-[11px] font-medium transition-colors cursor-pointer ${
                              selected
                                ? "bg-[#3A2212] text-[#F5E6CE] font-bold shadow-xs"
                                : "bg-[#B89768]/35 hover:bg-[#A68354]/45 text-[#3D2614]"
                            }`}
                          >
                            {String(idx + 1).padStart(2, "0")}.{item.name}
                          </button>
                        );
                      })}
                    </div>

                    {/* 核心视觉：美纹纸胶带粘贴的人物相片速写卡 + 倾斜红绿橡胶印章 */}
                    <div className="relative mx-auto my-1 w-48 sm:w-54 h-52 sm:h-58 flex items-center justify-center">
                      {/* 相片衬纸底卡 */}
                      <div className="relative w-full h-full -rotate-[1.4deg] rounded-xs bg-gradient-to-b from-[#F5EBD6] via-[#EAD8B8] to-[#DEC59C] border border-[#8A6B44] p-2 pb-6 shadow-[0_10px_22px_rgba(32,18,6,0.34)] flex flex-col justify-between">
                        {/* 左上与右上半透明皱纹胶带（Masking Tape） */}
                        <span
                          aria-hidden="true"
                          className="absolute -top-2.5 -left-4 w-16 h-5 -rotate-[28deg] bg-[#E8D5A7]/85 border border-[#BEA06A]/65 shadow-[0_2px_4px_rgba(0,0,0,0.2)] pointer-events-none"
                        />
                        <span
                          aria-hidden="true"
                          className="absolute -top-2 -right-4 w-16 h-5 rotate-[27deg] bg-[#E8D5A7]/85 border border-[#BEA06A]/65 shadow-[0_2px_4px_rgba(0,0,0,0.2)] pointer-events-none"
                        />

                        {/* 相片内框：无背景透明立绘跃然纸上 */}
                        <div className="relative flex-1 w-full rounded-xs border border-[#B5966B]/60 bg-[radial-gradient(circle_at_50%_42%,rgba(255,248,232,0.85),rgba(205,176,132,0.55))] overflow-hidden flex items-end justify-center pt-1">
                          {currentProfile.portraitUrl ? (
                            currentProfile.portraitUrl.startsWith("/assets/") &&
                            currentProfile.portraitUrl.endsWith(".png") ? (
                              <ArtworkImage
                                src={currentProfile.portraitUrl}
                                alt={currentProfile.name}
                                fallbackTitle={currentProfile.name}
                                className="w-full h-full object-contain object-bottom drop-shadow-[0_6px_10px_rgba(38,22,8,0.38)]"
                                tone="warm"
                              />
                            ) : (
                              <CutoutSprite
                                src={currentProfile.portraitUrl}
                                alt={currentProfile.name}
                                cropMode="none"
                                className="w-full h-full object-contain object-bottom drop-shadow-[0_6px_10px_rgba(38,22,8,0.38)]"
                              />
                            )
                          ) : currentProfile.modularParts ? (
                            <ModularNpcPortrait
                              parts={currentProfile.modularParts}
                              name={currentProfile.name}
                              trust={currentNpcState.trust}
                              tension={currentNpcState.tension}
                              className="drop-shadow-[0_6px_10px_rgba(38,22,8,0.38)]"
                            />
                          ) : null}
                        </div>

                        {/* 相片白边手写编号底栏 */}
                        <div className="pt-1 flex items-center justify-between text-[10px] font-mono-num text-[#5A3E24]">
                          <span>
                            FILE #{String(currentPageIdx + 1).padStart(2, "0")}
                          </span>
                          <span className="truncate max-w-[120px]">
                            {currentProfile.faction}
                          </span>
                        </div>
                      </div>

                      {/* 盖在相片右下角的双圈做旧红/绿橡胶印章 */}
                      <div className="absolute -bottom-1 -right-4 rotate-[-8deg] px-2.5 py-1 rounded-xs border-2 border-[#8B2318] bg-[#F4E6CE]/92 text-[#8B2318] font-mono-num text-[10px] font-bold tracking-wider uppercase shadow-sm pointer-events-none">
                        {currentProfile.isMainCharacter
                          ? "核心熟客 · MAIN"
                          : "荒原过客 · DRIFT"}
                      </div>

                      <div
                        className={`absolute top-2 -left-4 rotate-[7deg] px-2 py-0.5 rounded-xs border-2 font-mono-num text-[10px] font-bold tracking-wider bg-[#F4E6CE]/90 pointer-events-none ${
                          currentNpcState.unlockedCardGiven
                            ? "border-[#1E5631] text-[#1E5631]"
                            : currentNpcState.debtCaps > 0
                            ? "border-[#9E2A22] text-[#9E2A22]"
                            : "border-[#6B4423] text-[#6B4423]"
                        }`}
                      >
                        {currentNpcState.unlockedCardGiven
                          ? "信物已入库"
                          : currentNpcState.debtCaps > 0
                          ? `赊欠 ${currentNpcState.debtCaps} 盖`
                          : `光顾 ${currentNpcState.visits} 回`}
                      </div>
                    </div>

                    {/* 相片下方：酒保手写口味批注与体型速写 */}
                    <div className="space-y-1.5 text-xs border-t border-[#7A5835]/35 pt-2">
                      <p className="leading-snug">
                        <strong className="text-[#1E5631]">【偏爱酒味】</strong>
                        <span className="text-[#2D1C10]">
                          {currentProfile.favoriteNotes.join(" · ")}
                        </span>
                      </p>
                      <p className="leading-snug">
                        <strong className="text-[#8B2318]">【忌讳雷区】</strong>
                        <span className="text-[#2D1C10]">
                          {currentProfile.dislikedNotes.join(" · ")}
                        </span>
                      </p>
                      {!currentProfile.isMainCharacter &&
                        currentProfile.modularParts && (
                          <p className="text-[11px] text-[#4E3520] leading-snug bg-[#B89768]/25 rounded-xs px-2 py-1 border border-[#7A5835]/25">
                            <strong>外貌速写：</strong>
                            {describeModularParts(currentProfile.modularParts)}
                          </p>
                        )}
                    </div>

                    {/* 左下角页码与上一页翻页 */}
                    <div className="flex items-center justify-between pt-1 text-[11px] font-mono-num text-[#5A3E24]">
                      <button
                        type="button"
                        disabled={activePatronList.length <= 1}
                        onClick={() => handleFlipPage(-1)}
                        className="px-2 py-0.5 rounded-xs border border-[#7A5835]/45 bg-[#C5A474]/35 hover:bg-[#B38E5B]/50 disabled:opacity-35 flex items-center gap-1 cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>上一页</span>
                      </button>
                      <span>
                        PAGE {currentPageIdx * 2 + 1} /{" "}
                        {activePatronList.length * 2}
                      </span>
                    </div>
                  </motion.div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#4E3520]">
                    <p className="font-display text-lg font-bold">
                      尚未登记过路散客速写
                    </p>
                    <p className="text-xs mt-2 leading-relaxed">
                      在白昼吧台接待排队的荒原散客或点击「加迎散客」后，酒保将在此页贴上其外貌速写与口味印章。
                    </p>
                  </div>
                )
              ) : isLoreSection ? (
                /* 废土档案左页：分类检索标签 + 零号街区世界观词条索引目录 */
                <div className="h-full flex flex-col justify-between gap-2">
                  <div className="border-b-2 border-[#5C3E22]/50 pb-1.5">
                    <div className="flex items-center justify-between text-[10px] font-mono-num text-[#5A3E24]">
                      <span className="font-bold tracking-wider text-[#1E5631]">
                        SECTOR-0 LORE CODEX
                      </span>
                      <span>
                        已核实 {unlockedLoreSet.size} / {WASTELAND_LORE_DB.length} 篇
                      </span>
                    </div>
                    <h3 className="font-display text-lg font-bold text-[#1E1209] mt-0.5">
                      零号街区风物与势力档案库
                    </h3>
                  </div>

                  {/* 分类筛选按钮条 */}
                  <div className="flex flex-wrap items-center gap-1 pb-1 border-b border-[#7A5835]/30">
                    {(
                      [
                        { id: "ALL" as const, label: "全部" },
                        { id: "GEOGRAPHY" as const, label: "地理" },
                        { id: "FACTIONS" as const, label: "势力" },
                        { id: "DRINKS_ECONOMY" as const, label: "酒单" },
                        { id: "CREATURES_HAZARDS" as const, label: "生态" },
                        { id: "FIGURES_SECRETS" as const, label: "秘闻" },
                      ] as const
                    ).map((cat) => {
                      const active = loreCategoryFilter === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            soundFx.playCaliperTick();
                            setLoreCategoryFilter(cat.id);
                          }}
                          className={`px-2 py-0.5 rounded-xs text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer border ${
                            active
                              ? "bg-[#3A2312] text-[#F6E7CE] border-[#241409]"
                              : "bg-[#D5B789]/45 hover:bg-[#C6A370]/65 text-[#3B2514] border-[#7A5835]/45"
                          }`}
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* 词条滚动名录 */}
                  <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1.5 kraft-scroll">
                    {filteredLoreList.map((entry) => {
                      const unlocked = unlockedLoreSet.has(entry.id);
                      const selected = activeLoreEntry.id === entry.id;
                      const catMeta = LORE_CATEGORY_META[entry.category];
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => {
                            soundFx.playPaperRustle();
                            setSelectedLoreId(entry.id);
                          }}
                          className={`w-full text-left rounded-xs p-2 border transition-colors cursor-pointer ${
                            selected
                              ? "bg-[#3A2312] text-[#F7E8D0] border-[#1E1108] shadow-xs"
                              : unlocked
                              ? "bg-[#EBD9B9]/75 hover:bg-[#E2CAA2]/90 text-[#1E1209] border-[#7A5835]/45"
                              : "bg-[#D8C29D]/45 hover:bg-[#CEB48B]/65 text-[#5A422B] border-[#7A5835]/30"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[10px] font-mono-num">
                            <span
                              className={
                                selected
                                  ? "text-[#E59A3C]"
                                  : "text-[#6B4A2B]"
                              }
                            >
                              {entry.code} · {catMeta.shortLabel}
                            </span>
                            <span
                              className={
                                selected
                                  ? unlocked
                                    ? "text-[#86EFAC]"
                                    : "text-[#FCD34D]"
                                  : unlocked
                                  ? "text-[#1E5631] font-semibold"
                                  : "text-[#8B2318]"
                              }
                            >
                              {unlocked ? "已收录" : "待探听"}
                            </span>
                          </div>
                          <p className="font-display font-bold text-xs mt-0.5 truncate">
                            {entry.title}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="text-[10px] text-[#5A3E24] font-mono-num pt-1 border-t border-[#7A5835]/35 flex items-center justify-between">
                    <span>与吧台来客聊及对应风物将自动核实收录</span>
                    <span>AI CANON DB</span>
                  </div>
                </div>
              ) : isRumorsSection ? (
                /* 江湖风评左页：截获加密通缉电报剪报 + 今夜助战/委托登记 */
                <div className="h-full flex flex-col justify-between gap-2.5">
                  <div className="border-b-2 border-[#5C3E22]/50 pb-1.5">
                    <span className="font-mono-num text-[10px] font-bold tracking-wider text-[#8B2318] block">
                      INTERCEPTED BULLETINS · DAY {String(state.day).padStart(2, "0")}
                    </span>
                    <h3 className="font-display text-lg font-bold text-[#1E1209]">
                      截获通缉电报与夜探契约单
                    </h3>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2 kraft-scroll">
                    {(state.dailyBulletins || []).map((bul) => (
                      <div
                        key={bul.id}
                        className="rounded-xs bg-[#EBD9B9]/75 border border-[#7A5835]/50 p-2.5 space-y-1 shadow-xs"
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono-num">
                          <span className="font-bold text-[#8B2318]">
                            [{bul.code}] 加密电传
                          </span>
                          {bul.bountyCaps > 0 && (
                            <span className="px-1.5 py-0.5 rounded-xs bg-[#8B2318]/12 border border-[#8B2318]/45 text-[#8B2318] font-bold">
                              悬赏 {bul.bountyCaps} 盖
                            </span>
                          )}
                        </div>
                        <p className="font-display font-bold text-xs text-[#1E1209]">
                          {bul.title}
                        </p>
                        <p className="text-[11px] text-[#3B2514] leading-snug">
                          {bul.clueHint}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xs bg-[#C2A06E]/35 border border-[#7A5835]/45 p-2.5 space-y-1 text-xs">
                    <p className="font-bold text-[#1E1209]">
                      今夜同行伙伴与委托契约：
                    </p>
                    <p className="text-[11px] text-[#2D1C10]">
                      · 助战席：
                      {state.nightCompanion
                        ? `「${state.nightCompanion.name}」（${state.nightCompanion.skillName}）`
                        : "暂未签约常客（信任≥55可在吧台卷宗邀约）"}
                    </p>
                    <p className="text-[11px] text-[#2D1C10]">
                      · 专属委托：
                      {state.activeCommission
                        ? `《${state.activeCommission.title}》[+${state.activeCommission.rewardCaps}盖]`
                        : "暂无生效夜间委托"}
                    </p>
                  </div>
                </div>
              ) : (
                /* 拼装图谱左页：胶带粘贴实时三体型拼装预览卡 */
                <div className="h-full flex flex-col justify-between gap-2.5">
                  <div className="flex items-center justify-between border-b border-[#7A5835]/35 pb-1.5">
                    <div>
                      <span className="font-mono-num text-[10px] font-bold tracking-wider text-[#8B2318] block">
                        ANATOMY & GEAR SKETCHBOOK
                      </span>
                      <h3 className="font-display text-lg font-bold text-[#1E1209]">
                        废土过客三体型拼装速写
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playPaperRustle();
                        const nextBuild = Math.floor(Math.random() * 3);
                        const pool = SOMATOTYPE_POOLS[nextBuild];
                        setPreviewParts({
                          bodyBuild: nextBuild,
                          paletteIndex: Math.floor(Math.random() * 5),
                          backGear: Math.floor(
                            Math.random() * MODULAR_PART_LABELS.backGear.length
                          ),
                          coatStyle: Math.floor(
                            Math.random() * pool.bodies.length
                          ),
                          neckwear: nextBuild,
                          faceShape: Math.floor(
                            Math.random() * pool.heads.length
                          ),
                          featureMark: 0,
                          eyeStyle: 0,
                          headgear: Math.floor(
                            Math.random() * MODULAR_PART_LABELS.headgear.length
                          ),
                        });
                      }}
                      className="px-2.5 py-1 rounded-xs border-2 border-[#8B2318] bg-[#F3E4C8] hover:bg-[#EAD3AC] text-[#8B2318] text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      <span>随机速写</span>
                    </button>
                  </div>

                  {/* 胶带贴实时拼装相片 */}
                  <div className="relative mx-auto my-1 w-52 sm:w-58 h-58 sm:h-64 flex items-center justify-center">
                    <div className="relative w-full h-full -rotate-1 rounded-xs bg-gradient-to-b from-[#F5EBD6] via-[#EAD8B8] to-[#DEC59C] border border-[#8A6B44] p-2 pb-6 shadow-[0_10px_22px_rgba(32,18,6,0.34)] flex flex-col justify-between">
                      <span
                        aria-hidden="true"
                        className="absolute -top-2.5 -left-4 w-16 h-5 -rotate-[28deg] bg-[#E8D5A7]/85 border border-[#BEA06A]/65 shadow-xs pointer-events-none"
                      />
                      <span
                        aria-hidden="true"
                        className="absolute -top-2 -right-4 w-16 h-5 rotate-[26deg] bg-[#E8D5A7]/85 border border-[#BEA06A]/65 shadow-xs pointer-events-none"
                      />
                      <div className="relative flex-1 w-full rounded-xs border border-[#B5966B]/60 bg-[radial-gradient(circle_at_50%_42%,rgba(255,248,232,0.88),rgba(205,176,132,0.55))] overflow-hidden flex items-end justify-center">
                        <ModularNpcPortrait
                          parts={previewParts}
                          name="拼装速写客"
                          trust={previewMood === "warm" ? 78 : 45}
                          tension={previewMood === "angry" ? 82 : 22}
                          className="drop-shadow-[0_6px_12px_rgba(38,22,8,0.4)]"
                        />
                      </div>
                      <div className="pt-1 flex items-center justify-between text-[10px] font-mono-num text-[#5A3E24]">
                        <span>POOL · {resolvedPreview.pool.id}</span>
                        <span>AI PAPER-DOLL</span>
                      </div>
                    </div>

                    {/* 体型印章 */}
                    <div className="absolute -bottom-1 -right-3 rotate-[-6deg] px-2.5 py-1 rounded-xs border-2 border-[#1E5631] bg-[#F4E6CE]/95 text-[#1E5631] font-mono-num text-[11px] font-bold shadow-xs pointer-events-none">
                      {resolvedPreview.pool.label}
                    </div>
                  </div>

                  <p className="text-xs text-[#3A2514] bg-[#B89768]/30 rounded-xs px-2.5 py-1.5 border border-[#7A5835]/30 leading-relaxed">
                    <strong>当前组合：</strong>
                    {describeModularParts(previewParts)}
                  </p>
                </div>
              )}
            </div>

            {/* ==================== 右页：钢笔墨水笔迹记录 + 刻度墨水条 + 跨日记忆手札 ==================== */}
            <div className="kraft-paper-3d lg:!bg-none lg:!shadow-none lg:border-0 rounded-md p-4 sm:p-5 lg:pt-[12%] lg:pb-[10.5%] lg:pl-[5.5%] lg:pr-[20.5%] flex flex-col justify-between text-[#23150B] min-h-[430px] lg:min-h-0 overflow-hidden">
              {!isCompositorSection && !isRumorsSection && !isLoreSection ? (
                currentProfile && currentNpcState ? (
                  <motion.div
                    key={`right_${currentProfile.id}`}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18 }}
                    className="h-full flex flex-col justify-between gap-2.5 bg-[linear-gradient(to_bottom,transparent_25px,rgba(92,62,34,0.14)_26px)] bg-[length:100%_26px]"
                  >
                    {/* 右页抬头：姓名、头衔与酒保人物小传笔迹 */}
                    <div className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-2 border-b-2 border-[#5C3E22]/50 pb-1">
                        <h2 className="font-display text-xl sm:text-2xl font-bold text-[#1A0F07]">
                          {currentProfile.name}
                        </h2>
                        <span className="font-mono-num text-[11px] text-[#6B4A2B]">
                          {currentProfile.title}
                        </span>
                      </div>
                      <p className="text-xs sm:text-[13px] text-[#2E1C0F] leading-[24px]">
                        {currentProfile.bio}
                      </p>
                    </div>

                    {/* 钢笔手绘四维量化刻度墨水条 */}
                    <div className="rounded-xs bg-[#C2A06E]/30 border border-[#7A5835]/40 p-2.5 space-y-2 text-xs">
                      <div>
                        <div className="flex items-center justify-between font-mono-num text-[11px]">
                          <span className="font-bold text-[#24160C]">
                            信任刻度（密道≥{currentProfile.intelThreshold} · 信物≥
                            {currentProfile.giftCardThreshold}）
                          </span>
                          <strong className="text-[#1E5631]">
                            {currentNpcState.trust}/100
                          </strong>
                        </div>
                        <div className="h-2 mt-0.5 rounded-xs bg-[#A9885A]/70 border border-[#6B4A2B]/55 overflow-hidden">
                          <div
                            className="h-full bg-[#245C34] origin-left transition-transform duration-200"
                            style={{
                              transform: `scaleX(${currentNpcState.trust / 100})`,
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between font-mono-num text-[11px]">
                          <span className="font-bold text-[#24160C]">
                            危险张力（冲突临界 ≥
                            {currentProfile.brawlTensionThreshold}）
                          </span>
                          <strong className="text-[#8B2318]">
                            {currentNpcState.tension}/100
                          </strong>
                        </div>
                        <div className="h-2 mt-0.5 rounded-xs bg-[#A9885A]/70 border border-[#6B4A2B]/55 overflow-hidden">
                          <div
                            className="h-full bg-[#92271E] origin-left transition-transform duration-200"
                            style={{
                              transform: `scaleX(${currentNpcState.tension / 100})`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#7A5835]/30 font-mono-num text-[11px] text-[#3B2514]">
                        <span>微醺松弛：{currentNpcState.intoxication}/100</span>
                        <span>赊账欠款：{currentNpcState.debtCaps} 瓶盖</span>
                      </div>

                      {currentSigCard && (
                        <div className="pt-1 border-t border-[#7A5835]/30 flex items-center justify-between gap-2 text-[11px]">
                          <span className="truncate text-[#2B1A0D]">
                            <strong>信物卡：</strong>《{currentSigCard.name}》
                          </span>
                          <span
                            className={`font-bold shrink-0 ${
                              currentNpcState.unlockedCardGiven
                                ? "text-[#1E5631]"
                                : "text-[#6B4A2B]"
                            }`}
                          >
                            {currentNpcState.unlockedCardGiven
                              ? "✓ 已赠予牌库"
                              : "待信任解锁"}
                          </span>
                        </div>
                      )}

                      {currentNpcState.clueExposed &&
                        currentProfile.secretAgenda?.trueIdentity && (
                          <div className="pt-1 border-t border-[#8B2318]/35 text-[11px] text-[#7A1C14]">
                            <strong>【侦探识破真身】</strong>
                            {currentProfile.secretAgenda.trueIdentity}
                            {currentNpcState.showdownResolved && (
                              <span className="ml-1 font-mono-num">
                                （已裁决：{currentNpcState.showdownResolved}）
                              </span>
                            )}
                          </div>
                        )}
                    </div>

                    {/* 跨天持久化酒保手写交集记录 */}
                    <div className="flex-1 min-h-0 flex flex-col">
                      <p className="font-display font-bold text-xs sm:text-sm text-[#1E1209] mb-1">
                        酒保跨日笔迹摘录（{currentNpcState.memories.length} 条）：
                      </p>
                      <div className="flex-1 max-h-34 lg:max-h-36 overflow-y-auto pr-1 space-y-1.5 kraft-scroll">
                        {currentNpcState.memories.length === 0 ? (
                          <p className="text-xs italic text-[#5C4026] leading-relaxed">
                            —— 墨水未落：此人尚未在吧台留下深谈或酒账记录，待推门饮酒后自动记入本页。
                          </p>
                        ) : (
                          [...currentNpcState.memories]
                            .reverse()
                            .map((mem, idx) => (
                              <div
                                key={idx}
                                className="text-xs leading-snug text-[#26170C] border-l-2 border-[#7A5835]/60 pl-2"
                              >
                                <span className="font-mono-num font-bold text-[#8B2318]">
                                  第{mem.day}天
                                </span>
                                <span className="mx-1 text-[#6B4A2B]">·</span>
                                <span className="font-semibold text-[#4A301A]">
                                  [{mem.impactTag}]
                                </span>{" "}
                                <span>{mem.summary}</span>
                              </div>
                            ))
                        )}
                      </div>
                    </div>

                    {/* 右下角声望汇总与下一页翻页 */}
                    <div className="flex items-center justify-between pt-1 text-[11px] font-mono-num text-[#5A3E24]">
                      <span>酒馆声望 {state.havenReputation}</span>
                      <button
                        type="button"
                        disabled={activePatronList.length <= 1}
                        onClick={() => handleFlipPage(1)}
                        className="px-2 py-0.5 rounded-xs border border-[#7A5835]/45 bg-[#C5A474]/35 hover:bg-[#B38E5B]/50 disabled:opacity-35 flex items-center gap-1 cursor-pointer"
                      >
                        <span>下一页</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-[#5C4026]">
                    点击右侧「熟客名录」或「拼装图谱」书签翻阅。
                  </div>
                )
              ) : isLoreSection ? (
                /* 废土档案右页：钢笔正本详述 + 侦探酒保核验批注（或未解锁机密涂黑探听指引） */
                <motion.div
                  key={`lore_right_${activeLoreEntry.id}`}
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.16 }}
                  className="h-full flex flex-col justify-between gap-2.5 bg-[linear-gradient(to_bottom,transparent_25px,rgba(92,62,34,0.14)_26px)] bg-[length:100%_26px]"
                >
                  <div className="border-b-2 border-[#5C3E22]/50 pb-1.5">
                    <div className="flex items-center justify-between gap-2 text-[10px] font-mono-num text-[#5A3E24]">
                      <span>
                        {activeLoreEntry.code} ·{" "}
                        {LORE_CATEGORY_META[activeLoreEntry.category].label}
                      </span>
                      <span
                        className={
                          isActiveLoreUnlocked
                            ? "font-bold text-[#1E5631]"
                            : "font-bold text-[#8B2318]"
                        }
                      >
                        {isActiveLoreUnlocked ? "已核实正本" : "传闻待核实"}
                      </span>
                    </div>
                    <h3 className="font-display text-lg sm:text-xl font-bold text-[#1A0F07] mt-0.5">
                      {activeLoreEntry.title}
                    </h3>
                  </div>

                  {isActiveLoreUnlocked ? (
                    <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2.5 kraft-scroll">
                      <p className="text-xs font-bold text-[#4A2E16] border-l-2 border-[#8B2318] pl-2.5 leading-relaxed">
                        {activeLoreEntry.summary}
                      </p>
                      <p className="text-xs sm:text-[13px] text-[#24150B] whitespace-pre-line leading-[25px]">
                        {activeLoreEntry.detail}
                      </p>
                      <div className="rounded-xs bg-[#C2A06E]/38 border border-[#7A5835]/50 p-2.5 space-y-1">
                        <span className="text-[11px] font-bold text-[#1E5631] block">
                          酒保侦探核验批注：
                        </span>
                        <p className="text-[11px] text-[#2E1C0F] leading-relaxed">
                          {activeLoreEntry.detectiveHint}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 min-h-0 flex flex-col justify-center gap-3 py-2">
                      <div className="rounded-xs bg-[#D4B689]/45 border border-dashed border-[#7A5835]/65 p-4 space-y-2.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#8B2318]">
                          <Lock className="w-3.5 h-3.5 shrink-0" />
                          <span>该篇废土风物细节尚未在吧台求证收录</span>
                        </div>
                        <p className="text-xs text-[#4A311B] leading-relaxed">
                          提要：{activeLoreEntry.summary}
                        </p>
                        <div
                          aria-hidden="true"
                          className="font-mono-num text-[11px] text-[#6B4A2B]/55 select-none leading-relaxed"
                        >
                          ████████ ██████ ████████████ ████
                          <br />
                          ██████ ██████████ ████████ ██████
                        </div>
                      </div>

                      <div className="rounded-xs bg-[#EBD9B9]/80 border border-[#8B2318]/45 p-3 space-y-1">
                        <span className="text-[11px] font-bold text-[#8B2318] block">
                          吧台探听解锁线索：
                        </span>
                        <p className="text-xs text-[#24150B] leading-relaxed">
                          {activeLoreEntry.unlockHint}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-[#7A5835]/35 text-[11px] font-mono-num text-[#5A3E24]">
                    <button
                      type="button"
                      disabled={filteredLoreList.length <= 1}
                      onClick={() => {
                        soundFx.playPaperRustle();
                        const prevIdx =
                          (activeLoreIdx - 1 + filteredLoreList.length) %
                          filteredLoreList.length;
                        setSelectedLoreId(filteredLoreList[prevIdx].id);
                      }}
                      className="px-2 py-0.5 rounded-xs border border-[#7A5835]/45 bg-[#C5A474]/35 hover:bg-[#B38E5B]/50 disabled:opacity-35 flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>上一篇</span>
                    </button>
                    <span>
                      ENTRY {activeLoreIdx + 1} / {filteredLoreList.length}
                    </span>
                    <button
                      type="button"
                      disabled={filteredLoreList.length <= 1}
                      onClick={() => {
                        soundFx.playPaperRustle();
                        const nextIdx =
                          (activeLoreIdx + 1) % filteredLoreList.length;
                        setSelectedLoreId(filteredLoreList[nextIdx].id);
                      }}
                      className="px-2 py-0.5 rounded-xs border border-[#7A5835]/45 bg-[#C5A474]/35 hover:bg-[#B38E5B]/50 disabled:opacity-35 flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    >
                      <span>下一篇</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              ) : isRumorsSection ? (
                /* 江湖风评右页：全馆流传流言风评板与进店心态修正汇总 */
                <div className="h-full flex flex-col justify-between gap-2.5 bg-[linear-gradient(to_bottom,transparent_25px,rgba(92,62,34,0.14)_26px)] bg-[length:100%_26px]">
                  <div className="border-b-2 border-[#5C3E22]/50 pb-1.5">
                    <span className="font-mono-num text-[10px] font-bold tracking-wider text-[#1E5631] block">
                      WASTELAND WORD-OF-MOUTH LEDGER
                    </span>
                    <h3 className="font-display text-lg font-bold text-[#1A0F07]">
                      荒原流传酒馆风评录（{(state.activeRumors || []).length} 条生效）
                    </h3>
                  </div>

                  <div className="rounded-xs bg-[#C2A06E]/35 border border-[#7A5835]/45 p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono-num">
                    <span>
                      进店初始信任修正：
                      <strong
                        className={
                          rumorAgg.trustMod >= 0
                            ? "text-[#1E5631]"
                            : "text-[#8B2318]"
                        }
                      >
                        {rumorAgg.trustMod >= 0 ? `+${rumorAgg.trustMod}` : rumorAgg.trustMod}
                      </strong>
                    </span>
                    <span>
                      进店初始张力修正：
                      <strong
                        className={
                          rumorAgg.tensionMod <= 0
                            ? "text-[#1E5631]"
                            : "text-[#8B2318]"
                        }
                      >
                        {rumorAgg.tensionMod > 0 ? `+${rumorAgg.tensionMod}` : rumorAgg.tensionMod}
                      </strong>
                    </span>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2 kraft-scroll">
                    {(state.activeRumors || []).length === 0 ? (
                      <p className="text-xs italic text-[#5C4026] leading-relaxed">
                        —— 荒原上暂未传开特别风声。你在吧台慷慨倒酒、赊账救急、拆穿暗探，或在牛皮纸卷宗里托客人主动放风，都会生出实打实的江湖风评并传进后续来客耳中。
                      </p>
                    ) : (
                      (state.activeRumors || []).map((rumor) => (
                        <div
                          key={rumor.id}
                          className="rounded-xs bg-[#EBD9B9]/70 border-l-4 border-[#7A5835] p-2.5 space-y-1"
                        >
                          <div className="flex items-center justify-between text-[10px] font-mono-num">
                            <span
                              className={`font-bold ${
                                rumor.tone === "WARM"
                                  ? "text-[#1E5631]"
                                  : rumor.tone === "RUTHLESS"
                                  ? "text-[#8B2318]"
                                  : "text-[#6B4A2B]"
                              }`}
                            >
                              {rumor.tone === "WARM"
                                ? "仁义口碑"
                                : rumor.tone === "RUTHLESS"
                                ? "铁腕凶名"
                                : "悬赏暗流"}{" "}
                              · 信任{rumor.trustMod >= 0 ? `+${rumor.trustMod}` : rumor.trustMod} / 张力
                              {rumor.tensionMod > 0 ? `+${rumor.tensionMod}` : rumor.tensionMod}
                            </span>
                            <span className="text-[#5A3E24]">
                              余 {rumor.remainingDays} 日
                            </span>
                          </div>
                          <p className="font-display font-bold text-xs text-[#1E1209]">
                            《{rumor.title}》
                          </p>
                          <p className="text-[11px] text-[#3B2514] leading-snug">
                            {rumor.detail}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="text-[11px] text-[#5A3E24] font-mono-num flex items-center justify-between pt-1 border-t border-[#7A5835]/35">
                    <span>提示：在吧台展开客人牛皮纸卷宗即可主动托人散播口风</span>
                    <span>RUMOR ENGINE</span>
                  </div>
                </div>
              ) : (
                /* 拼装图谱右页：三大体型分池严谨切换台 */
                <div className="h-full flex flex-col justify-between gap-2.5 bg-[linear-gradient(to_bottom,transparent_25px,rgba(92,62,34,0.14)_26px)] bg-[length:100%_26px]">
                  <div>
                    <h4 className="font-display text-base sm:text-lg font-bold text-[#1A0F07] border-b-2 border-[#5C3E22]/50 pb-1">
                      三大体型严谨分池与五官装束部件库
                    </h4>
                    <p className="text-xs text-[#4A311B] mt-1 leading-relaxed">
                      壮硕、标准、纤细三大体型各自匹配专属肩颈比例服装与面孔池，共计 12 套体型服装、13 张废土面孔、5 款帽具与 7 款背具。
                    </p>
                  </div>

                  {/* 1. 身体体型池三选一印章切换 */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-[#3D2614] block">
                      ① 选择身体体型池（切换体型自动同步对应比例面孔与服装）：
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {SOMATOTYPE_POOLS.map((pool, idx) => {
                        const selected = resolvedPreview.buildIdx === idx;
                        return (
                          <button
                            key={pool.id}
                            type="button"
                            onClick={() => {
                              soundFx.playCaliperTick();
                              setPreviewParts((prev) => ({
                                ...prev,
                                bodyBuild: idx,
                                neckwear: idx,
                                coatStyle: 0,
                                faceShape: 0,
                              }));
                            }}
                            className={`py-2 px-2 rounded-xs border-2 text-xs font-bold transition-all cursor-pointer ${
                              selected
                                ? "border-[#8B2318] bg-[#3A2212] text-[#F6E7CE] shadow-sm"
                                : "border-[#7A5835]/50 bg-[#C9A97A]/40 hover:bg-[#B89462]/55 text-[#2B1A0D]"
                            }`}
                          >
                            {pool.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. 躯干、面孔、帽具、背具、旧化色泽与神态光影切换 */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playCaliperTick();
                        setPreviewParts((prev) => ({
                          ...prev,
                          coatStyle:
                            (prev.coatStyle + 1) %
                            resolvedPreview.pool.bodies.length,
                        }));
                      }}
                      className="p-2 rounded-xs border border-[#7A5835]/55 bg-[#C9A97A]/38 hover:bg-[#B89462]/55 text-left cursor-pointer"
                    >
                      <span className="block text-[10px] text-[#5C3E22]">
                        ② 躯干服装（{resolvedPreview.pool.shortLabel}池{" "}
                        {(previewParts.coatStyle %
                          resolvedPreview.pool.bodies.length) +
                          1}
                        /{resolvedPreview.pool.bodies.length}）
                      </span>
                      <strong className="block text-[#1E1209] truncate mt-0.5">
                        {resolvedPreview.body.name}
                      </strong>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playCaliperTick();
                        setPreviewParts((prev) => ({
                          ...prev,
                          faceShape:
                            (prev.faceShape + 1) %
                            resolvedPreview.pool.heads.length,
                        }));
                      }}
                      className="p-2 rounded-xs border border-[#7A5835]/55 bg-[#C9A97A]/38 hover:bg-[#B89462]/55 text-left cursor-pointer"
                    >
                      <span className="block text-[10px] text-[#5C3E22]">
                        ③ 面孔五官（{resolvedPreview.pool.shortLabel}池{" "}
                        {(previewParts.faceShape %
                          resolvedPreview.pool.heads.length) +
                          1}
                        /{resolvedPreview.pool.heads.length}）
                      </span>
                      <strong className="block text-[#1E1209] truncate mt-0.5">
                        {resolvedPreview.head.name}
                      </strong>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playCaliperTick();
                        setPreviewParts((prev) => ({
                          ...prev,
                          headgear:
                            (prev.headgear + 1) %
                            MODULAR_PART_LABELS.headgear.length,
                        }));
                      }}
                      className="p-2 rounded-xs border border-[#7A5835]/55 bg-[#C9A97A]/38 hover:bg-[#B89462]/55 text-left cursor-pointer"
                    >
                      <span className="block text-[10px] text-[#5C3E22]">
                        ④ 头顶帽具（点击切换）
                      </span>
                      <strong className="block text-[#1E1209] truncate mt-0.5">
                        {resolvedPreview.hat.name}
                      </strong>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playCaliperTick();
                        setPreviewParts((prev) => ({
                          ...prev,
                          backGear:
                            (prev.backGear + 1) %
                            MODULAR_PART_LABELS.backGear.length,
                        }));
                      }}
                      className="p-2 rounded-xs border border-[#7A5835]/55 bg-[#C9A97A]/38 hover:bg-[#B89462]/55 text-left cursor-pointer"
                    >
                      <span className="block text-[10px] text-[#5C3E22]">
                        ⑤ 背部装备（点击切换）
                      </span>
                      <strong className="block text-[#1E1209] truncate mt-0.5">
                        {resolvedPreview.back.name}
                      </strong>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playCaliperTick();
                        setPreviewParts((prev) => ({
                          ...prev,
                          paletteIndex:
                            (prev.paletteIndex + 1) %
                            MODULAR_PART_LABELS.paletteIndex.length,
                        }));
                      }}
                      className="p-2 rounded-xs border border-[#7A5835]/55 bg-[#C9A97A]/38 hover:bg-[#B89462]/55 text-left cursor-pointer"
                    >
                      <span className="block text-[10px] text-[#5C3E22]">
                        ⑥ 废土旧化染洗
                      </span>
                      <strong className="block text-[#1E1209] truncate mt-0.5">
                        {resolvedPreview.dye.name}
                      </strong>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playCaliperTick();
                        setPreviewMood((prev) =>
                          prev === "calm"
                            ? "warm"
                            : prev === "warm"
                            ? "angry"
                            : "calm"
                        );
                      }}
                      className="p-2 rounded-xs border border-[#8B2318]/50 bg-[#D6B07D]/45 hover:bg-[#C69C65]/60 text-left cursor-pointer"
                    >
                      <span className="block text-[10px] text-[#6B241B]">
                        ⑦ 吧台张力光影测试
                      </span>
                      <strong className="block text-[#8B2318] truncate mt-0.5">
                        {previewMood === "calm"
                          ? "常态暖光"
                          : previewMood === "warm"
                          ? "松弛微醺"
                          : "高危冷峻"}
                      </strong>
                    </button>
                  </div>

                  <div className="text-[11px] text-[#5A3E24] font-mono-num flex items-center justify-between pt-1 border-t border-[#7A5835]/35">
                    <span>透明 PNG 纸娃娃叠层 · 零 SVG 矢量拼凑</span>
                    <span>WASTELAND CODEX</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === "DECK") {
    const upgradedCount = deckCards.filter((c) => c.upgraded).length;
    return (
      <div className="space-y-6">
        {/* 昼夜通用掌柜 RPG 等级、四维属性检定与辐射专长面板 */}
        <div className="rounded-xl border border-[#E59A3C]/30 bg-[#221914] p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F5D096]/12 pb-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono-num text-[#E59A3C]">
                <span>WASTELAND RPG PROFILE</span>
                <span>·</span>
                <span>LV.{rpg.level}</span>
                <span>·</span>
                <span>
                  EXP {rpg.xp}/{rpg.nextLevelXp}
                </span>
              </div>
              <h3 className="font-display text-lg font-bold text-[#FDF5EB] mt-0.5">
                掌柜四维属性与专长（昼夜检定与战斗实时生效）
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-mono-num">
              <span className="text-[#D6BFA9]">
                可分配属性点{" "}
                <strong className="text-[#4ADE80]">{rpg.statPoints}</strong>
              </span>
              <span className="text-[#8C7765]">·</span>
              <span className="text-[#D6BFA9]">
                待选专长{" "}
                <strong className="text-[#4ADE80]">
                  {rpg.pendingPerkChoices}
                </strong>
              </span>
              <span className="text-[#8C7765]">·</span>
              <span className="text-[#D6BFA9]">
                卡牌升级点{" "}
                <strong className="text-[#E59A3C]">{rpg.upgradeTokens}</strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(["STR", "AGI", "ELO", "CHA"] as RpgAttributeKey[]).map((key) => {
              const meta = RPG_ATTRIBUTE_META[key];
              const val = rpg.attributes[key] || 2;
              return (
                <div
                  key={key}
                  className="rounded-lg border border-[#F5D096]/14 bg-[#19120E] p-3 flex flex-col justify-between gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-display font-bold text-sm text-[#FDF5EB]">
                        {meta.name}
                      </span>
                      <span className="ml-1.5 font-mono-num text-xs text-[#E59A3C]">
                        {meta.code}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono-num text-xl font-bold text-[#FDF5EB]">
                        {val}
                      </span>
                      {rpg.statPoints > 0 && onAllocateStat && (
                        <button
                          type="button"
                          onClick={() => onAllocateStat(key)}
                          className="px-2 py-1 rounded bg-[#E59A3C] hover:bg-[#F0A84B] text-[#1A110B] font-mono-num text-xs font-bold flex items-center gap-0.5 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>加点</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-[11px] text-[#BDA58E] space-y-0.5 leading-snug">
                    <p>白昼：{meta.dayEffect}</p>
                    <p className="text-[#9E8874]">黑夜：{meta.nightEffect}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 专长选择或已解锁专长展示 */}
          {rpg.pendingPerkChoices > 0 && onSelectPerk ? (
            <div className="pt-2 border-t border-[#F5D096]/12 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#4ADE80]">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>
                  升级专长可选（剩余 {rpg.pendingPerkChoices} 项，点击立即习得）：
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {PERK_LIBRARY.filter(
                  (p) => !rpg.unlockedPerks.includes(p.id)
                ).map((perk) => (
                  <button
                    key={perk.id}
                    type="button"
                    onClick={() => onSelectPerk(perk.id)}
                    className="text-left rounded-lg border border-[#4ADE80]/35 bg-[#162119] hover:bg-[#1E2E22] p-3 transition-colors cursor-pointer space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-bold text-xs text-[#ECFDF5]">
                        《{perk.name}》
                      </span>
                      <span className="font-mono-num text-[10px] text-[#4ADE80] shrink-0">
                        习得 →
                      </span>
                    </div>
                    <p className="text-[11px] text-[#A7F3D0]/85 leading-snug">
                      {perk.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : rpg.unlockedPerks.length > 0 ? (
            <div className="pt-2 border-t border-[#F5D096]/12 flex flex-wrap items-center gap-2 text-xs text-[#D6BFA9]">
              <span className="text-[#9E8874]">已习得专长：</span>
              {rpg.unlockedPerks.map((pid, idx) => {
                const perk = PERK_LIBRARY.find((p) => p.id === pid);
                if (!perk) return null;
                return (
                  <React.Fragment key={pid}>
                    {idx > 0 && <span className="text-[#8C7765]">·</span>}
                    <span
                      className="font-semibold text-[#F7D7A8]"
                      title={perk.description}
                    >
                      《{perk.name}》
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* 四大 Combo 流派筛选与牌组升星列表 */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#F5D096]/12 pb-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#FDF5EB]">
              黑夜废墟四大流派牌库与 +1 升星改装
            </h2>
            <p className="text-xs text-[#BDA58E] mt-1">
              当前牌组共{" "}
              <span className="font-mono-num font-semibold text-[#E59A3C]">
                {deckCards.length}
              </span>{" "}
              张卡牌 · 已升至 +1 星{" "}
              <span className="font-mono-num font-semibold text-[#4ADE80]">
                {upgradedCount}
              </span>{" "}
              张 · 可用升级点{" "}
              <span className="font-mono-num font-semibold text-[#E59A3C]">
                {rpg.upgradeTokens}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#18120F] border border-[#F5D096]/12">
            {(
              [
                { id: "ALL" as const, label: "全部流派" },
                { id: "GUNSLINGER" as const, label: "枪火连击" },
                { id: "JUGGERNAUT" as const, label: "废铁重甲" },
                { id: "RAD_BIO" as const, label: "辐射生化" },
                { id: "GADGETEER" as const, label: "拾荒机关" },
                { id: "NEUTRAL" as const, label: "基础通用" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setArchFilter(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  archFilter === tab.id
                    ? "bg-[#E59A3C] text-[#1B1410] font-semibold"
                    : "text-[#C7B099] hover:text-[#FAF0E6]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredDeckEntries.map((entry) => {
            const stats = resolveCardStats(entry.defId, entry.upgraded);
            const nextPreview = !entry.upgraded
              ? resolveCardStats(entry.defId, true)
              : null;
            const canUpgrade =
              !entry.upgraded && rpg.upgradeTokens > 0 && Boolean(onUpgradeCard);
            return (
              <IllustratedGameCard
                key={entry.uid}
                stats={stats}
                upgraded={entry.upgraded}
                theme="warm"
                upgradePreviewText={
                  nextPreview && rpg.upgradeTokens > 0
                    ? nextPreview.description
                    : undefined
                }
              >
                {canUpgrade && onUpgradeCard && (
                  <button
                    type="button"
                    onClick={() => onUpgradeCard(entry.uid)}
                    className="w-full py-1.5 px-3 rounded-lg bg-[#E59A3C] hover:bg-[#F2A94E] text-[#1A110B] font-semibold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                  >
                    <Wrench className="w-3.5 h-3.5 shrink-0" />
                    <span>升至 +1 星 (-1升级点)</span>
                  </button>
                )}
              </IllustratedGameCard>
            );
          })}
        </div>

        {/* 冷藏箱食材完整清点（全手绘贴图） */}
        <div className="pt-4 border-t border-[#F5D096]/12">
          <h3 className="font-display text-lg font-bold text-[#FDF5EB] mb-3">
            酒馆冷藏箱现存食材明细
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {INGREDIENT_LIST.map((ing) => (
              <div
                key={ing.id}
                className="rounded-lg border border-[#F5D096]/12 bg-[#241B16] p-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-14 h-14 rounded border border-[#E59A3C]/35 overflow-hidden shrink-0 bg-[#120D0A]">
                    <ArtworkImage
                      src={ing.imageUrl}
                      alt={ing.name}
                      fallbackTitle={ing.name}
                      className="w-full h-full object-cover"
                      tone="warm"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#FDF5EB] truncate">
                      {ing.name}
                    </p>
                    <p className="text-xs text-[#B59E88] mt-0.5 truncate">
                      {ing.subtitle}
                    </p>
                    <p className="text-[11px] text-[#9E8874] mt-1">
                      风味：{ing.flavorTags.join(" · ")}
                    </p>
                  </div>
                </div>
                <span className="font-mono-num text-xl font-bold text-[#E59A3C] shrink-0">
                  ×{state.inventory[ing.id] || 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 招牌成品酒谱贴图图鉴 */}
        <div className="pt-4 border-t border-[#F5D096]/12">
          <h3 className="font-display text-lg font-bold text-[#FDF5EB] mb-3">
            吧台招牌成品特调图鉴
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {DRINK_PRESETS.map((drink) => (
              <div
                key={drink.id}
                className="rounded-lg border border-[#F5D096]/12 bg-[#241B16] p-3 flex items-center gap-3"
              >
                <div className="w-14 h-14 rounded border border-[#E59A3C]/40 overflow-hidden shrink-0 bg-[#120D0A]">
                  <ArtworkImage
                    src={drink.imageUrl}
                    alt={drink.name}
                    fallbackTitle={drink.name}
                    className="w-full h-full object-cover"
                    tone="warm"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#FDF5EB] truncate">
                      《{drink.name}》
                    </p>
                    <span className="font-mono-num text-xs font-semibold text-[#E59A3C] shrink-0">
                      {drink.suggestedPrice} 盖
                    </span>
                  </div>
                  <p className="text-xs text-[#B59E88] mt-0.5 line-clamp-1">
                    {drink.tagline}
                  </p>
                  <p className="text-[11px] text-[#9E8874] mt-1">
                    {drink.flavorNotes.join(" · ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // activeTab === "INSPECTOR"
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-[#F5D096]/12 pb-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#FDF5EB]">
            AI 自主决策与游戏规则层强校验透视记录
          </h2>
          <p className="text-xs text-[#BDA58E] mt-1">
            直观展示「大模型行为意图输出 → 确定性规则阈值核验 → 游戏世界状态闭环变更」全链路日志
          </p>
        </div>
        {providerInfo && (
          <p className="text-xs text-[#D6BFA9] font-mono-num">
            当前推理网关：{providerInfo.provider} · {providerInfo.modelName}
          </p>
        )}
      </div>

      {state.ruleLogs.length === 0 ? (
        <div className="rounded-xl border border-[#F5D096]/14 bg-[#241B16] p-8 text-center text-sm text-[#BDA58E]">
          当前尚无交互校验记录。回到当前场景与任意客人交谈或递上一杯特调后，此处将实时记录状态量化变更与规则层裁决结果。
        </div>
      ) : (
        <div className="space-y-3">
          {state.ruleLogs.map((log) => (
            <div
              key={log.id}
              className="rounded-xl border border-[#F5D096]/14 bg-[#241B16] p-5 space-y-2.5 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-[#C7B099]">
                <div>
                  <span className="font-semibold text-[#FDF5EB] text-sm">
                    {log.npcName}
                  </span>
                  <span className="mx-2 text-[#8C7765]">·</span>
                  <span className="font-mono-num">
                    第 {log.day} 天 {log.timestamp}
                  </span>
                  <span className="mx-2 text-[#8C7765]">·</span>
                  <span className="font-mono-num">
                    AI 提议动作：{log.rawProposedAction}
                  </span>
                </div>
                <span
                  className={`font-semibold ${
                    log.passedValidation
                      ? "text-emerald-400"
                      : "text-amber-400"
                  }`}
                >
                  {log.passedValidation
                    ? "规则阈值核验通过"
                    : "规则层拦截/覆写修正"}
                </span>
              </div>

              <div className="font-mono-num text-[#D6BFA9] bg-[#1B1410] rounded-lg px-3.5 py-2 border border-[#F5D096]/10">
                量化状态变迁：信任 {log.quantifiedBefore.trust}→
                {log.quantifiedAfter.trust} ／ 张力 {log.quantifiedBefore.tension}→
                {log.quantifiedAfter.tension} ／ 醉意{" "}
                {log.quantifiedBefore.intoxication}→
                {log.quantifiedAfter.intoxication} ／ 欠款{" "}
                {log.quantifiedBefore.debtCaps}→{log.quantifiedAfter.debtCaps}
              </div>

              <p className="text-[#E6D5C3]">
                <strong className="text-[#C7B099]">规则校验逻辑：</strong>
                {log.ruleCheckSummary}
              </p>
              <p className="text-[#FAF0E6]">
                <strong className="text-[#E59A3C]">最终执行裁决：</strong>
                {log.enforcedOutcome}（{log.worldMutation}）
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
