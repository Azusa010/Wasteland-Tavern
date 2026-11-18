import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Send,
  ArrowRight,
  RotateCcw,
  AlertTriangle,
  UserPlus,
  X,
  MessageSquareText,
  ChevronUp,
  Volume2,
  VolumeX,
  Radio,
  Mic,
  MicOff,
  SlidersHorizontal,
  Users,
  Maximize2,
} from "lucide-react";
import {
  ARTWORK_ASSETS,
  RUMOR_SEED_TEMPLATES,
  WEATHER_CYCLE,
  resolveNpcProfile,
} from "../data/gameConfig";
import {
  compute2d6SuccessChancePct,
  createDefaultRpgState,
  RPG_ATTRIBUTE_META,
} from "../data/rpgAndCards";
import {
  CampaignSaveState,
  CraftedDrink,
  IngredientId,
  PourStyle,
  ShowdownVerdictChoice,
  WorkspaceTab,
} from "../types/game";
import {
  cleanDialogueQuotes,
  soundFx,
  SpeakingStatus,
} from "../utils/sound";
import { ArtworkImage } from "./ArtworkImage";
import { CutoutSprite } from "./CutoutSprite";
import {
  ModularNpcPortrait,
  describeModularParts,
} from "./ModularNpcPortrait";
import {
  DayPipBoyExpandedModal,
  ExpandedPipTab,
} from "./DayPipBoyExpandedModal";
import { WastelandBartendingStation } from "./WastelandBartendingStation";
import { WastelandTooltip } from "./WastelandTooltip";

interface DayTavernViewProps {
  state: CampaignSaveState;
  isLoadingAi: boolean;
  aiError: string | null;
  toastBanner: string | null;
  onRetryGreet: () => void;
  onSendChat: (message: string) => void;
  onServeDrink: (drink: CraftedDrink, note: string) => void;
  onResolveOffer: (
    accept: boolean,
    diceMode?: "PRIMARY_DICE" | "ALT_DICE"
  ) => void;
  onResolveShowdown: (choice: ShowdownVerdictChoice) => void;
  onSeedRumor: (templateId: string) => void;
  onInviteCompanion: () => void;
  onNextPatronOrDusk: () => void;
  onSummonExtraDrifter: () => void;
  onOpenCodexTab: (tab: Exclude<WorkspaceTab, "STAGE">) => void;
  onOpenSaveModal: () => void;
  onToggleBgm: () => void;
  onToggleTts: () => void;
  onToggleSound: () => void;
  onOpenSettings: () => void;
  onOpenRoster: () => void;
  onReturnToTitle: () => void;
}

type WalkPhase = "ENTERING" | "AT_BAR" | "EXITING_LEFT";

function pourStyleLabel(style: PourStyle): string {
  if (style === "generous") return "多倒半杯";
  if (style === "watered") return "掺水";
  return "正常";
}

export const DayTavernView: React.FC<DayTavernViewProps> = ({
  state,
  isLoadingAi,
  aiError,
  toastBanner,
  onRetryGreet,
  onSendChat,
  onServeDrink,
  onResolveOffer,
  onResolveShowdown,
  onSeedRumor,
  onInviteCompanion,
  onNextPatronOrDusk,
  onSummonExtraDrifter,
  onOpenCodexTab,
  onOpenSaveModal,
  onToggleBgm,
  onToggleTts,
  onToggleSound,
  onOpenSettings,
  onOpenRoster,
  onReturnToTitle,
}) => {
  const currentNpcId = state.todayQueue[state.currentQueueIndex];
  const profile = resolveNpcProfile(state, currentNpcId);
  const npcState = state.npcs[currentNpcId] || {
    id: currentNpcId,
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
  };
  const weatherDesc = WEATHER_CYCLE[(state.day - 1) % WEATHER_CYCLE.length];
  const rpg = state.rpg || createDefaultRpgState();
  const unspentRpgCount =
    (rpg.statPoints || 0) +
    (rpg.pendingPerkChoices || 0) +
    (rpg.upgradeTokens || 0);

  // 客人右进左出走路状态机
  const [walkPhase, setWalkPhase] = useState<WalkPhase>("ENTERING");
  const pendingExitActionRef = useRef<"NEXT" | "EXTRA" | null>(null);

  // 克制交互层开关：牛皮纸档案（仅点击客人后开启）、调酒抽屉（点击吧台酒壶开启）、完整对话记录框、快捷话术条
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [isBartenderOpen, setIsBartenderOpen] = useState(false);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [showQuickTopics, setShowQuickTopics] = useState(false);

  // 哔哔小子 CRT 荧光绿三频道切换（状态 / 加密电报 / 江湖风评）与抬腕放大终端开关
  const [pipChannel, setPipChannel] = useState<"STATS" | "BULLETINS" | "RUMORS">(
    "STATS"
  );
  const [isPipExpanded, setIsPipExpanded] = useState(false);
  const [bulletinIdx, setBulletinIdx] = useState(0);
  const [speakingStatus, setSpeakingStatus] = useState<SpeakingStatus>({
    isSpeaking: false,
    lineId: null,
  });

  useEffect(() => {
    return soundFx.subscribeSpeaking(setSpeakingStatus);
  }, []);

  // 回话输入与吧台杯垫上的成品酒实物
  const [chatInput, setChatInput] = useState("");
  const [servedCounterDrink, setServedCounterDrink] =
    useState<CraftedDrink | null>(null);

  // 每当切换到新客人时：重置桌面状态，触发「从右侧大门走进吧台」动画与脚步声
  useEffect(() => {
    setIsDossierOpen(false);
    setIsBartenderOpen(false);
    setIsTranscriptOpen(false);
    setIsPipExpanded(false);
    setShowQuickTopics(false);
    setServedCounterDrink(null);
    pendingExitActionRef.current = null;
    setWalkPhase("ENTERING");
    soundFx.playFootsteps(4);

    const enterTimer = setTimeout(() => {
      setWalkPhase("AT_BAR");
    }, 950);
    return () => clearTimeout(enterTimer);
  }, [currentNpcId, state.day, state.currentQueueIndex]);

  // ESC 关闭当前打开的调酒台、放大终端或牛皮纸手札
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isBartenderOpen) setIsBartenderOpen(false);
        else if (isPipExpanded) setIsPipExpanded(false);
        else if (isDossierOpen) setIsDossierOpen(false);
        else if (isTranscriptOpen) setIsTranscriptOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPipExpanded, isDossierOpen, isBartenderOpen, isTranscriptOpen]);

  // 若从存档恢复且当前回合已上过酒，从对话记录恢复杯垫上的成品酒展示
  useEffect(() => {
    if (state.currentTurnServedDrink && !servedCounterDrink) {
      const lastServed = [...state.dialogueHistory]
        .reverse()
        .find((d) => d.servedDrinkVisual)?.servedDrinkVisual;
      if (lastServed) {
        setServedCounterDrink({
          name: lastServed.name,
          imageUrl: lastServed.imageUrl,
          ingredients: ["rad_water", "mutant_potato", "rust_malt"],
          ingredientsText: lastServed.ingredientsText,
          pourStyle: lastServed.pourStyle,
          potency: lastServed.potency,
          soothing: lastServed.soothing,
          purification: lastServed.purification,
          suggestedPrice: lastServed.suggestedPrice,
          flavorTags: [],
        });
      }
    }
  }, [state.currentTurnServedDrink, state.dialogueHistory, servedCounterDrink]);

  const totalIngredientCount = useMemo(
    () =>
      (Object.keys(state.inventory) as IngredientId[]).reduce(
        (sum, k) => sum + (state.inventory[k] || 0),
        0
      ),
    [state.inventory]
  );

  const isLastPatronToday =
    state.currentQueueIndex >= state.todayQueue.length - 1;

  // 提取当前客人最新一句台词用于头顶说话气泡
  const latestNpcLine = useMemo(() => {
    for (let i = state.dialogueHistory.length - 1; i >= 0; i--) {
      if (state.dialogueHistory[i].speaker === "NPC") {
        return state.dialogueHistory[i];
      }
    }
    return null;
  }, [state.dialogueHistory]);

  // 触发客人向左走出吧台，走完再切换下一位客人或打烊
  const triggerLeftWalkOut = (mode: "NEXT" | "EXTRA") => {
    if (walkPhase !== "AT_BAR" || isLoadingAi) return;
    setIsDossierOpen(false);
    setIsBartenderOpen(false);
    setIsTranscriptOpen(false);
    pendingExitActionRef.current = mode;
    setWalkPhase("EXITING_LEFT");
    soundFx.playFootsteps(4);

    setTimeout(() => {
      const action = pendingExitActionRef.current;
      pendingExitActionRef.current = null;
      if (action === "EXTRA") {
        onSummonExtraDrifter();
      } else {
        onNextPatronOrDusk();
      }
    }, 820);
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !chatInput.trim() ||
      isLoadingAi ||
      state.pendingOffer ||
      walkPhase !== "AT_BAR"
    ) {
      return;
    }
    onSendChat(chatInput.trim());
    setChatInput("");
    setShowQuickTopics(false);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none bg-[#100B08] text-[#F3EAE0]">
      {/* ==================== LAYER 1: 第一人称酒保视角远景废土防空洞酒馆大厅 ==================== */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <ArtworkImage
          src={ARTWORK_ASSETS.tavernFpvHall}
          alt="第一人称辐射防空洞酒馆内景"
          className="w-full h-full object-cover object-center"
          tone="warm"
        />
        {/* 克制空间景深压暗，完整保留水泥波纹铁皮墙、防爆铁门与破损霓虹灯牌质感 */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#090807]/42 via-transparent to-[#0B0806]/78" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_34%,rgba(229,154,60,0.09),transparent_64%)]" />
      </div>

      {/* 极克制的左上门廊环境微标 + 右上防空洞电台/人声微调拨钮（不设网页顶栏） */}
      <div className="absolute top-3.5 left-5 z-10 pointer-events-none hidden sm:flex items-center gap-2 text-[11px] text-[#D6BFA9]/70 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
        <span className="font-mono-num text-[#E59A3C]/90 whitespace-nowrap">
          DAY {String(state.day).padStart(2, "0")}
        </span>
        <span>·</span>
        <span className="truncate max-w-md">{weatherDesc}</span>
      </div>

      <div className="absolute top-3 right-4 sm:right-5 z-35 flex items-center gap-1.5 text-[11px]">
        <button
          type="button"
          onClick={() => {
            soundFx.playCaliperTick();
            onToggleBgm();
          }}
          className={`px-2 py-1 rounded border flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer backdrop-blur-xs ${
            state.bgmEnabled !== false
              ? "border-[#E59A3C]/50 bg-[#18100A]/85 text-[#F7D7A8]"
              : "border-[#F5D096]/18 bg-[#120C08]/75 text-[#8C7765]"
          }`}
          title="切换废土电台背景音乐 (BGM)"
        >
          <Radio className="w-3 h-3" />
          <span>电台</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundFx.playCaliperTick();
            onToggleTts();
          }}
          className={`px-2 py-1 rounded border flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer backdrop-blur-xs ${
            state.ttsEnabled !== false
              ? "border-[#E59A3C]/50 bg-[#18100A]/85 text-[#F7D7A8]"
              : "border-[#F5D096]/18 bg-[#120C08]/75 text-[#8C7765]"
          }`}
          title="切换客人语音自动播报 (TTS)"
        >
          {state.ttsEnabled !== false ? (
            <Mic className="w-3 h-3" />
          ) : (
            <MicOff className="w-3 h-3" />
          )}
          <span>人声</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onToggleSound();
          }}
          className={`px-2 py-1 rounded border flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer backdrop-blur-xs ${
            state.soundEnabled
              ? "border-[#E59A3C]/50 bg-[#18100A]/85 text-[#F7D7A8]"
              : "border-[#F5D096]/18 bg-[#120C08]/75 text-[#8C7765]"
          }`}
          title="切换拟音音效 (SFX)"
        >
          {state.soundEnabled ? (
            <Volume2 className="w-3 h-3" />
          ) : (
            <VolumeX className="w-3 h-3" />
          )}
          <span className="hidden md:inline">音效</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundFx.playCaliperTick();
            onOpenRoster();
          }}
          className="px-2 py-1 rounded border border-[#E59A3C]/45 bg-[#18100A]/85 hover:bg-[#261A12] text-[#F7D7A8] flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer backdrop-blur-xs"
          title="打开人物库（替换立绘或新建原创酒客）"
        >
          <Users className="w-3 h-3 text-[#E59A3C]" />
          <span>人物库</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundFx.playCaliperTick();
            onOpenSettings();
          }}
          className="px-2 py-1 rounded border border-[#E59A3C]/45 bg-[#18100A]/85 hover:bg-[#261A12] text-[#F7D7A8] flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer backdrop-blur-xs"
          title="打开系统设置（LLM / TTS / 生图 API 与音量）"
        >
          <SlidersHorizontal className="w-3 h-3 text-[#E59A3C]" />
          <span>设置</span>
        </button>
      </div>

      {/* ==================== LAYER 2 & 3: 中景走道无背景抠图客人 + 紧贴头侧说话气泡 ==================== */}
      <div className="absolute inset-x-0 bottom-[clamp(182px,24.2%,222px)] top-4 z-20 flex items-end justify-center pointer-events-none">
        <motion.div
          key={`${state.day}_${state.currentQueueIndex}_${currentNpcId}`}
          initial={{ x: "44vw", y: 0, opacity: 0, scale: 0.92 }}
          animate={
            walkPhase === "ENTERING"
              ? {
                  x: "0vw",
                  y: [0, -14, 0, -13, 0, -11, 0, -7, 0],
                  rotate: [0, -1.4, 1.2, -1.1, 0.8, 0],
                  opacity: [0, 1, 1, 1, 1],
                  scale: 1,
                }
              : walkPhase === "EXITING_LEFT"
              ? {
                  x: "-46vw",
                  y: [0, -13, 0, -13, 0, -11, 0],
                  rotate: [0, -1.5, 1.2, -1.3, 0.8, 0],
                  opacity: [1, 1, 1, 0.75, 0],
                  scale: 0.92,
                }
              : {
                  x: "0vw",
                  y: 0,
                  rotate: 0,
                  opacity: 1,
                  scale: 1,
                }
          }
          transition={
            walkPhase === "ENTERING"
              ? { duration: 0.95, ease: [0.22, 1, 0.36, 1] }
              : walkPhase === "EXITING_LEFT"
              ? { duration: 0.82, ease: [0.4, 0, 0.85, 0.6] }
              : { duration: 0.25 }
          }
          className="relative h-[min(67vh,504px)] min-h-[320px] aspect-[3/4] w-auto flex items-end justify-center pointer-events-auto"
        >
          {/* 无背景透明抠图客人立绘主体（点击展开牛皮纸档案） */}
          <button
            type="button"
            disabled={walkPhase !== "AT_BAR"}
            onClick={() => {
              soundFx.playPaperRustle();
              setIsDossierOpen((prev) => !prev);
            }}
            aria-label={`点击查看${profile.name}的牛皮纸档案`}
            className="group relative w-full h-full bg-transparent border-0 p-0 cursor-pointer focus:outline-none"
          >
            {profile.portraitUrl ? (
              profile.portraitUrl.startsWith("/assets/") &&
              profile.portraitUrl.endsWith(".png") ? (
                <ArtworkImage
                  src={profile.portraitUrl}
                  alt={profile.name}
                  fallbackTitle={profile.name}
                  className="w-full h-full object-contain object-bottom drop-shadow-[0_18px_28px_rgba(0,0,0,0.92)] group-hover:drop-shadow-[0_0_18px_rgba(229,154,60,0.42)] group-hover:scale-[1.015] transition-all duration-200"
                  tone="warm"
                />
              ) : (
                <CutoutSprite
                  src={profile.portraitUrl}
                  alt={profile.name}
                  cropMode="none"
                  className="w-full h-full object-contain object-bottom drop-shadow-[0_18px_28px_rgba(0,0,0,0.92)] group-hover:drop-shadow-[0_0_18px_rgba(229,154,60,0.42)] group-hover:scale-[1.015] transition-all duration-200"
                />
              )
            ) : profile.modularParts ? (
              <ModularNpcPortrait
                parts={profile.modularParts}
                name={profile.name}
                trust={npcState.trust}
                tension={npcState.tension}
                className="drop-shadow-[0_18px_28px_rgba(0,0,0,0.92)] group-hover:drop-shadow-[0_0_18px_rgba(229,154,60,0.42)] group-hover:scale-[1.015] transition-all duration-200"
              />
            ) : (
              <ArtworkImage
                src={ARTWORK_ASSETS.ashScavenger}
                alt={profile.name}
                fallbackTitle={profile.name}
                className="w-full h-full object-contain object-bottom drop-shadow-[0_18px_28px_rgba(0,0,0,0.92)]"
                tone="warm"
              />
            )}

            {/* 稳立于吧台木沿上方的黄铜名牌（彻底避免被前景吧台遮切） */}
            <div
              className={`absolute bottom-11 sm:bottom-12 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded border shadow-[0_6px_16px_rgba(0,0,0,0.9)] flex items-center gap-2 whitespace-nowrap pointer-events-none ${
                npcState.clueExposed && !npcState.showdownResolved
                  ? "bg-[#2A110E]/95 border-[#EF4444]/85"
                  : "bg-[#160F0A]/92 border-[#C88A4B]/55"
              }`}
            >
              <span className="font-display font-bold text-xs sm:text-sm text-[#FDF5EB]">
                {profile.name}
              </span>
              <span className="text-[#8C7765] text-[10px]">·</span>
              <span
                className={`text-[11px] transition-colors ${
                  npcState.clueExposed && !npcState.showdownResolved
                    ? "text-[#FCA5A5] font-bold"
                    : "text-[#E59A3C] group-hover:text-[#F6B458]"
                }`}
              >
                {npcState.clueExposed && !npcState.showdownResolved
                  ? "破绽已抓获·点击摊牌"
                  : isDossierOpen
                  ? "合上手札"
                  : "点击查验"}
              </span>
            </div>
          </button>

          {/* 紧贴人物脸颊右侧的美漫纸质说话气泡（支持动态思考「。。。」与单句语音重播） */}
          {walkPhase === "AT_BAR" &&
            (latestNpcLine || isLoadingAi || aiError) && (
              <div
                className={`absolute z-30 max-sm:left-1/2 max-sm:-translate-x-1/2 max-sm:-top-20 sm:top-[10%] sm:left-[68%] lg:left-[69%] pointer-events-auto ${
                  isLoadingAi && !aiError
                    ? "w-fit min-w-[116px]"
                    : "max-sm:w-[86vw] sm:w-[275px] lg:w-[332px]"
                }`}
              >
                <motion.div
                  key={
                    aiError
                      ? "err"
                      : isLoadingAi
                      ? "generating_dots"
                      : latestNpcLine?.id || "idle"
                  }
                  initial={{ opacity: 0, x: -8, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ duration: 0.18 }}
                  className="relative rounded-xl border-2 border-[#1B120C] bg-[#F3E7D3] text-[#1E140C] px-3.5 py-2.5 shadow-[0_14px_34px_rgba(0,0,0,0.85)]"
                >
                  {/* 桌面端：指向客人嘴角的左侧尖尾巴 */}
                  <svg
                    viewBox="0 0 24 20"
                    className="hidden sm:block absolute -left-4 top-5 w-5 h-4 text-[#F3E7D3]"
                    aria-hidden="true"
                  >
                    <path
                      d="M 24 3 L 2 11 L 24 18 Z"
                      fill="currentColor"
                      stroke="#1B120C"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                    />
                  </svg>

                  {/* 窄屏端：指向客人头顶的下侧尖尾巴 */}
                  <svg
                    viewBox="0 0 20 16"
                    className="sm:hidden absolute left-1/2 -translate-x-1/2 -bottom-3.5 w-4 h-3.5 text-[#F3E7D3]"
                    aria-hidden="true"
                  >
                    <path
                      d="M 2 0 L 10 14 L 18 0 Z"
                      fill="currentColor"
                      stroke="#1B120C"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                    />
                  </svg>

                  {aiError ? (
                    <div className="flex items-center justify-between gap-2.5 text-xs text-[#7F1D1D]">
                      <div className="flex items-start gap-1.5">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{aiError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={onRetryGreet}
                        className="px-2 py-1 rounded bg-[#7F1D1D] text-[#FEF2F2] font-semibold shrink-0 whitespace-nowrap flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        重试
                      </button>
                    </div>
                  ) : isLoadingAi ? (
                    <div
                      className="flex flex-col items-start gap-1.5 py-0.5 px-1"
                      aria-label={`${profile.name}正在酝酿回应`}
                    >
                      <span className="text-[11px] font-semibold text-[#6E5036]">
                        {profile.name}
                      </span>
                      <div className="flex items-center gap-2 h-5 px-1">
                        {[0, 1, 2].map((dotIdx) => (
                          <motion.span
                            key={dotIdx}
                            animate={{
                              y: [0, -5, 0],
                              opacity: [0.35, 1, 0.35],
                              scale: [0.9, 1.15, 0.9],
                            }}
                            transition={{
                              duration: 0.9,
                              repeat: Infinity,
                              ease: "easeInOut",
                              delay: dotIdx * 0.18,
                            }}
                            className="w-2.5 h-2.5 rounded-full bg-[#2B1B10] inline-block"
                          />
                        ))}
                      </div>
                    </div>
                  ) : latestNpcLine ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[11px] text-[#6E5036]">
                        <span className="font-semibold truncate">
                          {latestNpcLine.speakerName}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            soundFx.speakNpcLine({
                              lineId: latestNpcLine.id,
                              text: latestNpcLine.text,
                              profile,
                              intoxication: npcState.intoxication,
                              force: true,
                            })
                          }
                          className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                            speakingStatus.isSpeaking &&
                            speakingStatus.lineId === latestNpcLine.id
                              ? "border-[#8B261D]/60 bg-[#8B261D]/15 text-[#7F1D1D]"
                              : "border-[#8C6843]/45 bg-[#E7D5B8] hover:bg-[#DEC6A1] text-[#4E3622]"
                          }`}
                          title="点击朗读或停止当前台词语音"
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>
                            {speakingStatus.isSpeaking &&
                            speakingStatus.lineId === latestNpcLine.id
                              ? "停止"
                              : "语音"}
                          </span>
                        </button>
                      </div>
                      {latestNpcLine.subtext && (
                        <p className="text-xs text-[#7A593C] italic leading-snug">
                          （{cleanDialogueQuotes(latestNpcLine.subtext)}）
                        </p>
                      )}
                      <p className="text-xs sm:text-sm leading-relaxed font-medium text-[#1A110A] max-h-44 overflow-y-auto pr-0.5 kraft-scroll">
                        「{cleanDialogueQuotes(latestNpcLine.text)}」
                      </p>
                    </div>
                  ) : null}
                </motion.div>
              </div>
            )}
        </motion.div>
      </div>

      {/* ==================== LAYER 4: 近景第一人称真实贴图铁皮补丁厚木吧台桌面 ==================== */}
      <section
        aria-label="第一人称酒馆吧台操作台"
        className="absolute inset-x-0 bottom-0 z-30 h-[29%] min-h-[214px] max-h-[260px] flex flex-col justify-between shadow-[0_-18px_42px_rgba(0,0,0,0.92)]"
      >
        {/* 吧台桌面真实材质贴图底层（旧木板 + 铆钉锈铁补丁 + 铜包边 + 散落瓶盖） */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden border-t-2 border-[#B88042]/70">
          <img
            src={ARTWORK_ASSETS.barCounterTex}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="w-full h-full object-cover object-center brightness-[0.86] contrast-[1.06]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#170E08]/38 via-[#120B06]/56 to-[#0B0704]/78" />
        </div>

        {/* 吧台前缘立体金属包角高光细线 */}
        <div className="relative z-10 h-1.5 w-full shrink-0 bg-gradient-to-r from-[#3D2714]/80 via-[#D69649]/55 to-[#3D2714]/80 border-b border-black/70" />

        {/* 吧台台面三区：左嵌真实金属外壳哔哔小子 · 中央真实黄铜杯垫与克制回话窄栏 · 右侧真实手绘摇酒壶冰柜 */}
        <div className="relative z-10 flex-1 min-h-0 px-3 sm:px-6 py-2">
          <div className="h-full max-w-[1480px] mx-auto grid grid-cols-12 gap-3 sm:gap-5 items-stretch">
            {/* 1. 左角机身嵌入：真实手绘军绿钢壳贴图 + 经典废土荧光绿 CRT「哔哔小子」屏幕 */}
            <div className="col-span-12 sm:col-span-4 lg:col-span-3 flex flex-col justify-between min-h-0">
              <div className="relative flex-1 min-h-[128px] flex items-center justify-center">
                {/* 铆接于哔哔小子军绿钢壳上沿的实体光学放大拨键 */}
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playPipBoyBeep();
                    setIsPipExpanded(true);
                  }}
                  aria-label="放大状态终端"
                  title="放大状态终端"
                  className="group absolute -top-2.5 right-[16%] z-40 px-1.5 py-0.5 rounded-sm border-2 border-[#10140D] bg-gradient-to-b from-[#606746] via-[#3D432D] to-[#24291B] hover:from-[#6F7852] hover:via-[#495136] hover:to-[#2D3422] shadow-[0_4px_10px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(238,228,190,0.36)] hover:shadow-[0_0_12px_rgba(74,222,128,0.35),inset_0_1px_0_rgba(238,228,190,0.5)] flex items-center gap-1 transition-all cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] shadow-[0_0_5px_#4ADE80]" />
                  <span className="px-1.5 py-0.5 rounded-xs bg-[#081D0F] border border-[#4ADE80]/55 group-hover:border-[#86EFAC] text-[#86EFAC] group-hover:text-[#ECFCCB] font-mono-num text-[10px] font-bold leading-none flex items-center gap-1">
                    <Maximize2 className="w-2.5 h-2.5 text-[#4ADE80]" />
                    <span>放大</span>
                  </span>
                </button>

                {/* 右侧机械滚花旋钮热区（点击同样可抬腕放大终端） */}
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playPipBoyBeep();
                    setIsPipExpanded(true);
                  }}
                  aria-label="拨动右侧旋钮放大状态版"
                  title="拨动机械旋钮：放大哔哔小子详细状态终端"
                  className="absolute right-[1.5%] top-[16%] bottom-[16%] w-[15%] z-35 bg-transparent border-0 cursor-pointer"
                />

                {/* 内嵌荧光绿 CRT 屏幕（强制单行频道页签，杜绝竖排折行挤压） */}
                <div className="pipboy-crt absolute z-30 left-[11.5%] right-[19.5%] top-[13.5%] bottom-[14.5%] rounded-sm px-2 py-1 flex flex-col justify-between text-[#4ADE80] font-mono-num overflow-hidden shadow-[inset_0_0_16px_rgba(0,0,0,0.95)]">
                  <div className="flex items-center justify-between gap-1 text-[9px] lg:text-[10px] text-[#4ADE80]/90 border-b border-[#4ADE80]/25 pb-0.5 leading-none shrink-0">
                    <div className="flex items-center gap-0.5 min-w-0">
                      {(
                        [
                          { id: "STATS" as const, label: "状态" },
                          {
                            id: "BULLETINS" as const,
                            label: `电报·${(state.dailyBulletins || []).length}`,
                          },
                          {
                            id: "RUMORS" as const,
                            label: `风评·${(state.activeRumors || []).length}`,
                          },
                        ] as const
                      ).map((ch) => (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => {
                            soundFx.playPipBoyBeep();
                            setPipChannel(ch.id);
                          }}
                          className={`px-1 py-0.5 rounded-xs whitespace-nowrap shrink-0 leading-none transition-colors cursor-pointer ${
                            pipChannel === ch.id
                              ? "bg-[#4ADE80]/25 text-[#DCFCE7] font-bold"
                              : "text-[#4ADE80]/70 hover:text-[#86EFAC]"
                          }`}
                        >
                          {ch.label}
                        </button>
                      ))}
                    </div>
                    <span className="whitespace-nowrap shrink-0 text-[9px] text-[#86EFAC]">
                      LV.{rpg.level} · {state.currentQueueIndex + 1}/{state.todayQueue.length}
                    </span>
                  </div>

                  {pipChannel === "STATS" ? (
                    <div className="grid grid-cols-2 gap-x-2.5 gap-y-0.5 text-[11px] leading-tight py-0.5">
                      <WastelandTooltip
                        title="瓶盖金库 (CAPS)"
                        subtitle={`${state.caps} 枚`}
                        description="零号酒馆运营资金。用于战地包扎、垫付人情赊账、夜间幸存者交易及维持七日经营运转。"
                      >
                        <div className="flex items-center justify-between cursor-help">
                          <span className="text-[#4ADE80]/70 text-[10px]">
                            CAPS
                          </span>
                          <strong className="pipboy-glow text-xs lg:text-sm">
                            {state.caps}
                          </strong>
                        </div>
                      </WastelandTooltip>

                      <WastelandTooltip
                        title="掌柜生命 (HP)"
                        subtitle={`${state.playerHp}/${state.playerMaxHp}`}
                        description="昼夜共享生命状态。白天遭闹事袭击或夜晚废墟战斗均会消耗生命；可在黄昏哔哔小子消耗瓶盖包扎。"
                      >
                        <div className="flex items-center justify-between cursor-help">
                          <span className="text-[#4ADE80]/70 text-[10px]">
                            HP
                          </span>
                          <strong className="pipboy-glow text-xs lg:text-sm">
                            {state.playerHp}/{state.playerMaxHp}
                          </strong>
                        </div>
                      </WastelandTooltip>

                      <WastelandTooltip
                        title="防空洞酒馆耐久 (SEC)"
                        subtitle={`${state.tavernSecurity}%`}
                        description="铁皮卷帘门与吧台防暴结构完整度。平息冲突或拆穿通缉犯可提升耐久；放任醉汉砸店会损耗耐久。"
                      >
                        <div className="flex items-center justify-between cursor-help">
                          <span className="text-[#4ADE80]/70 text-[10px]">
                            SEC
                          </span>
                          <strong className="pipboy-glow text-[11px]">
                            {state.tavernSecurity}%
                          </strong>
                        </div>
                      </WastelandTooltip>

                      <WastelandTooltip
                        title={`掌柜等级 LV.${rpg.level} (XP)`}
                        subtitle={`${rpg.xp}/${rpg.nextLevelXp}`}
                        description={`力量 ${rpg.attributes.STR} · 敏捷 ${rpg.attributes.AGI} · 口才 ${rpg.attributes.ELO} · 魅力 ${rpg.attributes.CHA}。点击下方「牌库」随时加点选专长。`}
                      >
                        <div className="flex items-center justify-between cursor-help">
                          <span className="text-[#4ADE80]/70 text-[10px]">
                            XP
                          </span>
                          <strong className="pipboy-glow text-[11px]">
                            {rpg.xp}/{rpg.nextLevelXp}
                          </strong>
                        </div>
                      </WastelandTooltip>
                    </div>
                  ) : pipChannel === "BULLETINS" ? (
                    (() => {
                      const list = state.dailyBulletins || [];
                      const item = list[bulletinIdx % Math.max(1, list.length)];
                      return item ? (
                        <div
                          onClick={() => {
                            if (list.length > 1) {
                              soundFx.playPipBoyBeep();
                              setBulletinIdx((i) => (i + 1) % list.length);
                            }
                          }}
                          className="flex-1 min-h-0 py-0.5 flex flex-col justify-center cursor-pointer"
                          title="点击切换下一封截获电报"
                        >
                          <div className="flex items-center justify-between text-[9px] text-[#86EFAC]">
                            <span className="truncate font-bold">
                              [{item.code}] {item.title}
                            </span>
                            {item.bountyCaps > 0 && (
                              <span className="shrink-0 ml-1">
                                赏{item.bountyCaps}
                              </span>
                            )}
                          </div>
                          <p className="text-[9px] lg:text-[10px] text-[#BBF7D0]/90 line-clamp-2 leading-snug mt-0.5">
                            {item.clueHint}
                          </p>
                        </div>
                      ) : (
                        <div className="text-[10px] text-[#4ADE80]/75 py-1">
                          今日暂无加密通缉电报
                        </div>
                      );
                    })()
                  ) : (
                    (() => {
                      const rumors = state.activeRumors || [];
                      const top = rumors[0];
                      const trustSum = rumors.reduce(
                        (s, r) => s + r.trustMod,
                        0
                      );
                      const tenSum = rumors.reduce(
                        (s, r) => s + r.tensionMod,
                        0
                      );
                      return (
                        <div className="flex-1 min-h-0 py-0.5 flex flex-col justify-center">
                          <div className="flex items-center justify-between text-[9px] text-[#86EFAC]">
                            <span className="truncate font-bold">
                              {top ? `《${top.title}》` : "暂无流传风评"}
                            </span>
                            <span className="shrink-0 ml-1">
                              信{trustSum >= 0 ? `+${trustSum}` : trustSum}/张
                              {tenSum >= 0 ? `+${tenSum}` : tenSum}
                            </span>
                          </div>
                          <p className="text-[9px] lg:text-[10px] text-[#BBF7D0]/85 line-clamp-2 leading-snug mt-0.5">
                            {top
                              ? top.detail
                              : "在牛皮纸手札托熟客放风可改变进店初始态度"}
                          </p>
                        </div>
                      );
                    })()
                  )}

                  <div className="text-[9px] lg:text-[10px] text-[#86EFAC] truncate border-t border-[#4ADE80]/25 pt-0.5 leading-tight">
                    {toastBanner
                      ? `> ${toastBanner}`
                      : state.nightCompanion
                      ? `> 助战:${state.nightCompanion.name}${
                          state.activeCommission
                            ? ` · 委托:${state.activeCommission.title}`
                            : ""
                        }`
                      : state.nightIntelUnlocked
                      ? `> 冷库密道 (${state.nightIntelPatronName})`
                      : `> 原料 ${totalIngredientCount} · 点「电报」查验潜伏悬赏`}
                  </div>
                </div>

                {/* 顶层真实手绘做旧金属外壳与旋钮贴图（中空透明视窗） */}
                <img
                  src={ARTWORK_ASSETS.propPipboyBezel}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="relative z-20 w-full h-full object-fill pointer-events-none select-none drop-shadow-[0_10px_20px_rgba(0,0,0,0.92)]"
                />
              </div>

              {/* 哔哔小子下沿实体金属按键列 */}
              <div className="grid grid-cols-6 gap-1 pt-1 text-[11px]">
                  {(
                    [
                      { label: "手记", action: () => onOpenCodexTab("PATRONS"), alert: false },
                      { label: "档案", action: () => onOpenCodexTab("LORE"), alert: false },
                      {
                        label: unspentRpgCount > 0 ? `牌库+${unspentRpgCount}` : "牌库",
                        action: () => onOpenCodexTab("DECK"),
                        alert: unspentRpgCount > 0,
                      },
                      { label: "日志", action: () => onOpenCodexTab("INSPECTOR"), alert: false },
                      { label: "存档", action: onOpenSaveModal, alert: false },
                      { label: "菜单", action: onReturnToTitle, alert: false },
                    ] as const
                  ).map((btn) => (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={() => {
                        soundFx.playPipBoyBeep();
                        btn.action();
                      }}
                      className={`py-1 px-1 rounded-xs border font-medium transition-colors whitespace-nowrap text-center shadow-[0_3px_8px_rgba(0,0,0,0.75)] cursor-pointer ${
                        btn.alert
                          ? "border-[#4ADE80] bg-[#1E3A24] text-[#DCFCE7] font-bold"
                          : "border-[#56614F]/80 bg-[#1B2119]/92 hover:bg-[#2A3527] hover:border-[#4ADE80]/65 text-[#A7F3D0]"
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
              </div>
            </div>

            {/* 2. 吧台中央：真实手绘八角黄铜软木杯垫实物区 / 议价单 + 底部克制窄回话栏 */}
            <div className="col-span-12 sm:col-span-5 lg:col-span-6 flex flex-col justify-between min-w-0">
              {/* 台面中央：议价/赊账/冲突裁决单 或 八角黄铜杯垫与成品酒实物 */}
              <div className="flex-1 flex items-center justify-center px-1">
                {state.pendingOffer ? (
                  state.pendingOffer.type === "SETTLEMENT_RECEIPT" ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.18 }}
                      className="w-full rounded-md border-2 border-[#D99B4E] bg-[#F2E3C9] text-[#22150B] px-3.5 py-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-[0_12px_30px_rgba(0,0,0,0.92)]"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5 font-mono-num text-[11px] font-bold text-[#7F231A]">
                          <span>吧台结账与情报签收单</span>
                          <span>·</span>
                          <span className="text-[#1E5631]">
                            实收 +
                            {(state.pendingOffer.offeredCaps || 0) +
                              (state.pendingOffer.tipCaps || 0) +
                              (state.pendingOffer.repaidDebtCaps || 0)}{" "}
                            瓶盖
                          </span>
                          {state.pendingOffer.intelUnlockedNote && (
                            <>
                              <span>·</span>
                              <span className="text-[#1D4ED8]">
                                附：废墟冷库密道图
                              </span>
                            </>
                          )}
                          {state.pendingOffer.weakenedBossNote && (
                            <>
                              <span>·</span>
                              <span className="text-[#1D4ED8]">
                                附：首领弱点图纸
                              </span>
                            </>
                          )}
                          {state.pendingOffer.giftCardName && (
                            <>
                              <span>·</span>
                              <span className="text-[#92400E]">
                                信物卡《{state.pendingOffer.giftCardName}》
                              </span>
                            </>
                          )}
                          <span>·</span>
                          <span className="text-[#5C3E22]">
                            +{state.pendingOffer.xpReward || 16} XP
                          </span>
                        </div>
                        <p className="text-xs text-[#2B1B10] line-clamp-2 leading-snug">
                          {state.pendingOffer.description}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onResolveOffer(true)}
                        className="px-3.5 py-2 rounded bg-[#1E5631] hover:bg-[#256B3D] text-[#F4FBF6] text-xs font-bold whitespace-nowrap shrink-0 shadow-sm cursor-pointer transition-colors"
                      >
                        清点入账（收下瓶盖与情报）
                      </button>
                    </motion.div>
                  ) : (
                    <div className="w-full rounded-md border border-[#E59A3C]/75 bg-[#22160F]/96 px-3 py-2 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2 shadow-[0_10px_26px_rgba(0,0,0,0.88)]">
                      <div className="min-w-0 flex-1">
                        <span className="font-mono-num text-[10px] text-[#E59A3C] block">
                          {state.pendingOffer.type === "BARGAIN"
                            ? "吧台讲价 · 可掷口才骰子"
                            : state.pendingOffer.type === "ASK_CREDIT"
                            ? "请求赊账 · 人情立据"
                            : state.pendingOffer.type === "COMMISSION_OFFER"
                            ? `夜间私活委托${
                                state.pendingOffer.suggestedPrice > 0
                                  ? ` · 含酒钱 +${state.pendingOffer.suggestedPrice} 盖`
                                  : ""
                              }`
                            : "吧台冲突 · 可掷力量/敏捷骰子镇场"}
                        </span>
                        <p className="text-xs text-[#FAF0E6] line-clamp-2">
                          {state.pendingOffer.description}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {state.pendingOffer.diceOption && (
                          <WastelandTooltip
                            title={`${state.pendingOffer.diceOption.label}（属性掷骰）`}
                            subtitle={`难度 DC ${state.pendingOffer.diceOption.dc}`}
                            description={state.pendingOffer.diceOption.hint}
                            details={[
                              {
                                label: "检定公式",
                                value: `2d6 + ${
                                  RPG_ATTRIBUTE_META[
                                    state.pendingOffer.diceOption.attr
                                  ].name
                                }(${
                                  rpg.attributes[
                                    state.pendingOffer.diceOption.attr
                                  ]
                                })`,
                                tone: "emerald",
                              },
                            ]}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                onResolveOffer(true, "PRIMARY_DICE")
                              }
                              className="px-2.5 py-1.5 rounded border border-[#4ADE80]/70 bg-[#14301D] hover:bg-[#1B4227] text-[#BBF7D0] text-[11px] font-mono-num font-bold whitespace-nowrap cursor-pointer"
                            >
                              🎲 {state.pendingOffer.diceOption.label}[2d6+
                              {
                                RPG_ATTRIBUTE_META[
                                  state.pendingOffer.diceOption.attr
                                ].name
                              }
                              ·
                              {compute2d6SuccessChancePct(
                                rpg,
                                state.pendingOffer.diceOption.attr,
                                state.pendingOffer.diceOption.dc
                              )}
                              %]
                            </button>
                          </WastelandTooltip>
                        )}
                        {state.pendingOffer.altDiceOption && (
                          <WastelandTooltip
                            title={`${state.pendingOffer.altDiceOption.label}（属性掷骰）`}
                            subtitle={`难度 DC ${state.pendingOffer.altDiceOption.dc}`}
                            description={state.pendingOffer.altDiceOption.hint}
                            details={[
                              {
                                label: "检定公式",
                                value: `2d6 + ${
                                  RPG_ATTRIBUTE_META[
                                    state.pendingOffer.altDiceOption.attr
                                  ].name
                                }(${
                                  rpg.attributes[
                                    state.pendingOffer.altDiceOption.attr
                                  ]
                                })`,
                                tone: "sky",
                              },
                            ]}
                          >
                            <button
                              type="button"
                              onClick={() => onResolveOffer(true, "ALT_DICE")}
                              className="px-2.5 py-1.5 rounded border border-[#38BDF8]/70 bg-[#102636] hover:bg-[#16354B] text-[#BAE6FD] text-[11px] font-mono-num font-bold whitespace-nowrap cursor-pointer"
                            >
                              🎲 {state.pendingOffer.altDiceOption.label}[2d6+
                              {
                                RPG_ATTRIBUTE_META[
                                  state.pendingOffer.altDiceOption.attr
                                ].name
                              }
                              ·
                              {compute2d6SuccessChancePct(
                                rpg,
                                state.pendingOffer.altDiceOption.attr,
                                state.pendingOffer.altDiceOption.dc
                              )}
                              %]
                            </button>
                          </WastelandTooltip>
                        )}
                        <button
                          type="button"
                          onClick={() => onResolveOffer(true)}
                          className="px-2.5 py-1.5 rounded bg-[#E59A3C] hover:bg-[#F0A84B] text-[#1B1410] text-xs font-bold whitespace-nowrap cursor-pointer"
                        >
                          {state.pendingOffer.type === "BARGAIN"
                            ? `让利(${state.pendingOffer.offeredCaps}盖)`
                            : state.pendingOffer.type === "ASK_CREDIT"
                            ? "准许记账"
                            : state.pendingOffer.type === "COMMISSION_OFFER"
                            ? `接单(赏${state.pendingOffer.offeredCaps}盖)`
                            : "免单熄火"}
                        </button>
                        <button
                          type="button"
                          onClick={() => onResolveOffer(false)}
                          className="px-2.5 py-1.5 rounded border border-[#F5D096]/25 hover:bg-[#3A2B22] text-[#F3EAE0] text-xs whitespace-nowrap cursor-pointer"
                        >
                          {state.pendingOffer.type === "BARGAIN"
                            ? `硬收(${state.pendingOffer.suggestedPrice}盖)`
                            : state.pendingOffer.type === "ASK_CREDIT" ||
                              state.pendingOffer.type === "COMMISSION_OFFER"
                            ? "婉拒"
                            : "轰出酒馆"}
                        </button>
                      </div>
                    </div>
                  )
                ) : npcState.clueExposed &&
                  !npcState.showdownResolved &&
                  profile.secretAgenda?.isUndercover ? (
                  <div className="w-full rounded-md border border-[#EF4444]/75 bg-[#24110E]/95 px-3 py-2 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2 shadow-[0_10px_26px_rgba(0,0,0,0.9)]">
                    <div className="min-w-0">
                      <span className="font-mono-num text-[10px] text-[#FCA5A5] font-bold block">
                        SHOWDOWN · 识破伪装（{profile.secretAgenda.trueIdentity}）
                      </span>
                      <p className="text-[11px] text-[#FDE8E8] line-clamp-1">
                        破绽：{npcState.exposedClueNote}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onResolveShowdown("EXPOSE_BOUNTY")}
                        className="px-2 py-1 rounded bg-[#B91C1C] hover:bg-[#DC2626] text-[#FEF2F2] text-[11px] font-bold whitespace-nowrap cursor-pointer"
                        title="当面拍出电报领赏，安全耐久+8，但幕后势力今晚将派买凶杀手伏击"
                      >
                        拆穿领赏(+{profile.secretAgenda.bountyCaps}盖)
                      </button>
                      <button
                        type="button"
                        onClick={() => onResolveShowdown("BLACKMAIL_SHELTER")}
                        className="px-2 py-1 rounded bg-[#E59A3C] hover:bg-[#F0A84B] text-[#1B1410] text-[11px] font-bold whitespace-nowrap cursor-pointer"
                        title="收封口费替其遮掩，对方感恩并在今夜加入同行助战席"
                      >
                        封口包庇(+{profile.secretAgenda.hushCaps}盖·同行)
                      </button>
                      <button
                        type="button"
                        onClick={() => onResolveShowdown("FEED_FALSE_INTEL")}
                        className="px-2 py-1 rounded border border-[#F5D096]/40 bg-[#2C1E15] hover:bg-[#3D2A1D] text-[#FAF0E6] text-[11px] font-semibold whitespace-nowrap cursor-pointer"
                        title="看破不说破，喂假坐标引其替你踩坑，今晚解锁诱敌战利品箱并削弱首领20%"
                      >
                        喂假坐标设局
                      </button>
                    </div>
                  </div>
                ) : servedCounterDrink ? (
                  <div className="flex items-center gap-3.5 px-4 py-1.5 rounded-lg border border-[#C88A4B]/45 bg-[#150D08]/86 shadow-[0_10px_24px_rgba(0,0,0,0.85)]">
                    {/* 成品酒立在真实黄铜软木杯垫上 */}
                    <div className="relative w-16 h-16 sm:w-18 sm:h-18 flex items-center justify-center shrink-0">
                      <img
                        src={ARTWORK_ASSETS.propBrassCoaster}
                        alt=""
                        aria-hidden="true"
                        draggable={false}
                        className="absolute inset-x-0 bottom-0 w-full h-7 object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.9)]"
                      />
                      <div className="relative z-10 w-12 h-12 sm:w-13 sm:h-13 -mt-2 rounded-md border border-[#E59A3C]/65 overflow-hidden bg-[#0E0906] shadow-[0_6px_14px_rgba(0,0,0,0.85)]">
                        <ArtworkImage
                          src={servedCounterDrink.imageUrl}
                          alt={servedCounterDrink.name}
                          fallbackTitle={servedCounterDrink.name}
                          className="w-full h-full object-cover"
                          tone="warm"
                        />
                      </div>
                    </div>
                    <div className="text-xs">
                      <p className="font-display font-bold text-sm text-[#FDF5EB]">
                        《{servedCounterDrink.name}》
                      </p>
                      <p className="font-mono-num text-[11px] text-[#D6B48C]">
                        {pourStyleLabel(servedCounterDrink.pourStyle)} · 标价{" "}
                        {servedCounterDrink.suggestedPrice} 瓶盖
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3.5 text-xs text-[#C7B099]">
                    <img
                      src={ARTWORK_ASSETS.propBrassCoaster}
                      alt="八角黄铜软木杯垫"
                      draggable={false}
                      className="w-14 h-11 sm:w-16 sm:h-12 object-contain drop-shadow-[0_8px_14px_rgba(0,0,0,0.88)]"
                    />
                    <span className="hidden md:inline drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
                      点击客人查验牛皮纸手札 · 点击右侧摇酒壶冰柜配酒
                    </span>
                  </div>
                )}
              </div>

              {/* 可折叠快捷话术细条（仅点击「话术」时浮现，保持默认画面极度克制） */}
              {showQuickTopics && !state.pendingOffer && walkPhase === "AT_BAR" && (
                <div className="flex flex-wrap items-center gap-1.5 pb-1.5">
                  {profile.quickTopics.map((topic, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={isLoadingAi}
                      onClick={() => {
                        setShowQuickTopics(false);
                        onSendChat(topic);
                      }}
                      className="px-2.5 py-1 rounded border border-[#E59A3C]/40 bg-[#22160E]/95 hover:bg-[#342217] text-xs text-[#F3EAE0] truncate max-w-[240px] cursor-pointer"
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              )}

              {/* 底部克制窄回话与翻看记录栏 */}
              <div className="flex items-center gap-1.5 sm:gap-2 pt-1.5 border-t border-[#F5D096]/15">
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playCaliperTick();
                    setIsTranscriptOpen((prev) => !prev);
                  }}
                  className={`px-2.5 py-2 rounded border text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer ${
                    isTranscriptOpen
                      ? "border-[#E59A3C] bg-[#332318] text-[#FDF5EB]"
                      : "border-[#F5D096]/22 bg-[#160F0A]/92 hover:border-[#E59A3C]/55 text-[#E3CEB9]"
                  }`}
                  title="打开完整对话框记录"
                >
                  <MessageSquareText className="w-3.5 h-3.5 text-[#E59A3C]" />
                  <span className="hidden md:inline">对话框</span>
                  <span className="font-mono-num text-[11px]">
                    ({state.dialogueHistory.length})
                  </span>
                </button>

                {!state.pendingOffer && (
                  <button
                    type="button"
                    disabled={isLoadingAi || walkPhase !== "AT_BAR"}
                    onClick={() => {
                      soundFx.playCaliperTick();
                      setShowQuickTopics((prev) => !prev);
                    }}
                    className="px-2.5 py-2 rounded border border-[#F5D096]/22 bg-[#160F0A]/92 hover:border-[#E59A3C]/55 text-xs text-[#E3CEB9] flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <span>话术</span>
                    <ChevronUp
                      className={`w-3.5 h-3.5 transition-transform ${
                        showQuickTopics ? "rotate-180 text-[#E59A3C]" : ""
                      }`}
                    />
                  </button>
                )}

                <form
                  onSubmit={handleChatSubmit}
                  className="flex-1 flex items-center gap-1.5 min-w-0"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={
                      isLoadingAi ||
                      Boolean(state.pendingOffer) ||
                      walkPhase !== "AT_BAR"
                    }
                    placeholder={`回话给 ${profile.name}…`}
                    className="flex-1 min-w-0 rounded border border-[#F5D096]/22 bg-[#0F0A06]/92 px-3 py-1.5 text-xs sm:text-sm text-[#FAF0E6] placeholder:text-[#8C7765] focus:outline-none focus:border-[#E59A3C]"
                  />
                  <button
                    type="submit"
                    disabled={
                      isLoadingAi ||
                      !chatInput.trim() ||
                      Boolean(state.pendingOffer) ||
                      walkPhase !== "AT_BAR"
                    }
                    className="px-3 py-1.5 rounded border border-[#F5D096]/25 bg-[#281B12]/95 hover:bg-[#3A281C] disabled:opacity-35 text-xs font-medium text-[#FAF0E6] shrink-0 flex items-center gap-1 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5 text-[#E59A3C]" />
                    <span className="hidden sm:inline">搭话</span>
                  </button>
                </form>

                {/* 若吧台中央有待签收账单，提示先点击入账；签收完毕后解锁送客 */}
                {state.pendingOffer?.type === "SETTLEMENT_RECEIPT" ? (
                  <button
                    type="button"
                    onClick={() => onResolveOffer(true)}
                    className="px-3 py-1.5 rounded bg-[#1E5631] hover:bg-[#256B3D] text-[#F4FBF6] text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    点击签收账单
                  </button>
                ) : (
                  state.currentTurnServedDrink &&
                  !state.pendingOffer && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isLastPatronToday && state.todayQueue.length < 7 && (
                        <button
                          type="button"
                          disabled={isLoadingAi || walkPhase !== "AT_BAR"}
                          onClick={() => triggerLeftWalkOut("EXTRA")}
                          className="px-2.5 py-1.5 rounded border border-[#F5D096]/28 bg-[#241912]/95 hover:border-[#E59A3C] text-xs text-[#FAF0E6] flex items-center gap-1 cursor-pointer"
                          title="加迎一位门外过路散客"
                        >
                          <UserPlus className="w-3.5 h-3.5 text-[#E59A3C]" />
                          <span className="hidden xl:inline">散客</span>
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isLoadingAi || walkPhase !== "AT_BAR"}
                        onClick={() => triggerLeftWalkOut("NEXT")}
                        className="px-3 py-1.5 rounded bg-[#E59A3C] hover:bg-[#F0A84B] disabled:opacity-45 text-[#1B1410] text-xs font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer"
                      >
                        <span>{isLastPatronToday ? "送客打烊" : "送客迎新"}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* 3. 右侧吧台真实贴图实物道具：黄铜雪克摇酒壶 + 铁皮压力表冷藏冰柜（点击进入独立调酒界面） */}
            <div className="hidden sm:flex sm:col-span-3 lg:col-span-3 items-stretch">
              <button
                type="button"
                disabled={walkPhase !== "AT_BAR"}
                onClick={() => {
                  soundFx.playShakerMix();
                  setIsBartenderOpen(true);
                }}
                className="group w-full rounded-lg border border-[#B88042]/45 bg-[#170F09]/82 hover:bg-[#22160E]/90 hover:border-[#E59A3C]/85 disabled:opacity-45 px-2.5 py-2 flex items-center justify-between gap-2.5 text-left transition-all cursor-pointer shadow-[0_10px_24px_rgba(0,0,0,0.85)]"
              >
                <div className="relative w-24 lg:w-28 h-24 lg:h-28 shrink-0 flex items-center justify-center -my-1">
                  <img
                    src={ARTWORK_ASSETS.propShakerCooler}
                    alt="进入调酒台"
                    draggable={false}
                    className="w-full h-full object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.92)] group-hover:-translate-y-1 group-hover:scale-[1.03] transition-transform duration-200"
                  />
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <span className="font-mono-num text-[10px] text-[#E59A3C] block">
                    {state.currentTurnServedDrink ? "已上酒" : `原材 ×${totalIngredientCount}`}
                  </span>
                  <p className="font-display text-sm lg:text-base font-bold text-[#FDF5EB] truncate">
                    进入调酒台
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 移动端窄屏快捷调酒入口 */}
      <button
        type="button"
        disabled={walkPhase !== "AT_BAR"}
        onClick={() => {
          soundFx.playShakerMix();
          setIsBartenderOpen(true);
        }}
        className="sm:hidden fixed right-3 bottom-[212px] z-35 px-3 py-2 rounded-lg border border-[#E59A3C] bg-[#261910] disabled:opacity-45 text-xs font-bold text-[#FDF5EB] shadow-xl whitespace-nowrap"
      >
        进入调酒台
      </button>

      {/* ==================== OVERLAY A: 立体牛皮纸客人信息手札（仅点击客人后显示！） ==================== */}
      {isDossierOpen && walkPhase === "AT_BAR" && (
        <div className="absolute z-40 top-8 left-4 sm:left-8 lg:left-[calc(50%-490px)] w-[90vw] max-w-[332px] pointer-events-auto">
          <motion.div
            initial={{ opacity: 0, x: -18, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="kraft-paper-3d relative rounded-md border border-[#6E4E2E] p-4 pt-7 text-[#23170E]"
          >
            {/* 顶部真实手绘做旧黄铜燕尾票据夹实物贴图 */}
            <img
              src={ARTWORK_ASSETS.propClipboardClip}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="absolute -top-6 left-1/2 -translate-x-1/2 w-24 h-12 object-contain pointer-events-none select-none drop-shadow-[0_6px_10px_rgba(0,0,0,0.65)]"
            />

            <div className="flex items-start justify-between border-b-2 border-[#7D5A36]/45 pb-2.5">
              <div>
                <p className="font-mono-num text-[10px] font-bold tracking-wider text-[#7F231A]">
                  PATRON DOSSIER · {profile.isMainCharacter ? "熟客卷宗" : "散客手札"}
                </p>
                <h3 className="font-display text-xl font-bold text-[#1D1209] mt-0.5">
                  {profile.name}
                </h3>
                <p className="text-xs font-medium text-[#4E3622]">
                  {profile.faction} · {profile.title} · 到访 {npcState.visits + 1} 次
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundFx.playPaperRustle();
                  setIsDossierOpen(false);
                }}
                className="p-1 rounded hover:bg-[#8C663E]/25 text-[#3D2917] cursor-pointer"
                aria-label="合上牛皮纸档案"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 space-y-2.5 text-xs max-h-[52vh] overflow-y-auto pr-1 kraft-scroll">
              <p className="text-[#362415] leading-relaxed">{profile.bio}</p>

              {!profile.isMainCharacter && profile.modularParts && (
                <p className="text-[11px] text-[#5C4026] bg-[#C3A170]/45 rounded px-2.5 py-1.5 border border-[#8C663E]/35">
                  外貌速写：{describeModularParts(profile.modularParts)}
                </p>
              )}

              {/* 表面口供与侦探破绽红章核验栏 */}
              {profile.secretAgenda && (
                <div className="rounded bg-[#C3A170]/55 border border-[#8C663E]/45 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-[#3B2614]">【表面口供】</strong>
                    {profile.secretAgenda.isUndercover && !npcState.clueExposed && (
                      <span className="font-mono-num text-[10px] text-[#7F231A]">
                        催醉失言 ≥ {profile.secretAgenda.slipIntoxicationThreshold}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] leading-snug text-[#2C1C0E]">
                    {profile.secretAgenda.surfaceAlibi}
                  </p>

                  {npcState.clueExposed && profile.secretAgenda.isUndercover && (
                    <div className="mt-1.5 pt-1.5 border-t border-[#8B261D]/35 space-y-1.5">
                      <p className="text-[11px] font-bold text-[#8B1E16]">
                        【抓获口供破绽 · {profile.secretAgenda.trueIdentity}】
                      </p>
                      <p className="text-[11px] text-[#4E1611] leading-snug">
                        {npcState.exposedClueNote}
                      </p>
                      {!npcState.showdownResolved ? (
                        <div className="grid grid-cols-3 gap-1 pt-1">
                          <button
                            type="button"
                            onClick={() => onResolveShowdown("EXPOSE_BOUNTY")}
                            className="py-1 px-1 rounded-xs bg-[#8B2318] hover:bg-[#A3291C] text-[#FCE8E6] font-bold text-[10px] cursor-pointer"
                          >
                            拆穿+{profile.secretAgenda.bountyCaps}盖
                          </button>
                          <button
                            type="button"
                            onClick={() => onResolveShowdown("BLACKMAIL_SHELTER")}
                            className="py-1 px-1 rounded-xs bg-[#245C34] hover:bg-[#2D7040] text-[#E8F8ED] font-bold text-[10px] cursor-pointer"
                          >
                            包庇+{profile.secretAgenda.hushCaps}盖
                          </button>
                          <button
                            type="button"
                            onClick={() => onResolveShowdown("FEED_FALSE_INTEL")}
                            className="py-1 px-1 rounded-xs bg-[#3A2212] hover:bg-[#4F2F19] text-[#F6E7CE] font-bold text-[10px] cursor-pointer"
                          >
                            喂假坐标
                          </button>
                        </div>
                      ) : (
                        <p className="font-mono-num text-[10px] font-bold text-[#1F4E28]">
                          ✓ 已执行摊牌裁决：{npcState.showdownResolved}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 口味红蓝钢印栏 */}
              <div className="rounded bg-[#C9A878]/55 border border-[#8C663E]/40 p-2.5 space-y-1">
                <p>
                  <strong className="text-[#1F4E28]">偏爱风味：</strong>
                  <span>{profile.favoriteNotes.join(" · ")}</span>
                </p>
                <p>
                  <strong className="text-[#8B261D]">忌讳雷区：</strong>
                  <span>{profile.dislikedNotes.join(" · ")}</span>
                </p>
              </div>

              {/* 钢笔刻度式四维状态 */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between font-mono-num text-[11px]">
                  <span className="font-semibold">
                    信任刻度（情报{profile.intelThreshold}/同行55/赠卡{profile.giftCardThreshold}）
                  </span>
                  <span className="font-bold text-[#1F4E28]">{npcState.trust}/100</span>
                </div>
                <div className="h-2 rounded-xs bg-[#A88658] border border-[#6E4E2E]/50 overflow-hidden">
                  <div
                    className="h-full bg-[#2E6B38] origin-left transition-transform duration-200"
                    style={{ transform: `scaleX(${npcState.trust / 100})` }}
                  />
                </div>

                <div className="flex items-center justify-between font-mono-num text-[11px] pt-1">
                  <span className="font-semibold">
                    危险张力（临界 {profile.brawlTensionThreshold}）
                  </span>
                  <span className="font-bold text-[#8B261D]">
                    {npcState.tension}/100
                  </span>
                </div>
                <div className="h-2 rounded-xs bg-[#A88658] border border-[#6E4E2E]/50 overflow-hidden">
                  <div
                    className="h-full bg-[#9E2A22] origin-left transition-transform duration-200"
                    style={{ transform: `scaleX(${npcState.tension / 100})` }}
                  />
                </div>

                <div className="flex items-center justify-between font-mono-num text-[11px] pt-1.5 text-[#3D2917]">
                  <span>微醺 {npcState.intoxication}/100</span>
                  <span>·</span>
                  <span>欠账 {npcState.debtCaps} 盖</span>
                  <span>·</span>
                  <span>{npcState.unlockedCardGiven ? "信物已赠" : "信物未赠"}</span>
                </div>
              </div>

              {/* 夜探伙伴邀约 + 托熟客散播江湖口风 */}
              <div className="pt-2 border-t border-[#7D5A36]/35 space-y-2">
                {profile.companionSkill && (
                  <div className="flex items-center justify-between gap-2 rounded bg-[#BFA070]/45 border border-[#7D5A36]/40 px-2.5 py-1.5">
                    <div className="min-w-0">
                      <span className="block text-[10px] font-bold text-[#2D1D10] truncate">
                        助战技：{profile.companionSkill.name}
                      </span>
                      <span className="block text-[10px] text-[#4E3622] truncate">
                        {profile.companionSkill.desc}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={
                        npcState.trust < 55 ||
                        state.nightCompanion?.npcId === currentNpcId
                      }
                      onClick={onInviteCompanion}
                      className="px-2 py-1 rounded-xs bg-[#3A2212] hover:bg-[#52311B] disabled:opacity-40 text-[#F6E7CE] text-[10px] font-bold shrink-0 cursor-pointer"
                    >
                      {state.nightCompanion?.npcId === currentNpcId
                        ? "已同行"
                        : npcState.trust >= 55
                        ? "签约助战"
                        : "需信任55"}
                    </button>
                  </div>
                )}

                <div className="space-y-1">
                  <span className="block font-bold text-[11px] text-[#2D1D10]">
                    托其散播酒馆风声（{npcState.trust >= 50 ? "熟客免费" : "润喉费 6 盖"}）：
                  </span>
                  {npcState.rumorSeededToday ? (
                    <p className="text-[11px] text-[#1F4E28] font-medium">
                      ✓ 今日已托此人向集市散出风声
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-1">
                      {RUMOR_SEED_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => onSeedRumor(tpl.id)}
                          className="px-2 py-1 rounded-xs border border-[#7D5A36]/50 bg-[#C8A878]/50 hover:bg-[#B89460]/65 text-left flex items-center justify-between gap-1 text-[11px] text-[#23150B] cursor-pointer"
                        >
                          <span className="font-semibold truncate">{tpl.label}</span>
                          <span className="font-mono-num text-[10px] text-[#5C3E22] shrink-0">
                            {tpl.shortTag}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 前尘跨天记忆手记 */}
              <div className="pt-2 border-t border-[#7D5A36]/35 space-y-1">
                <p className="font-bold text-[#2D1D10]">前尘记忆摘录：</p>
                {npcState.memories.length === 0 ? (
                  <p className="text-[#5C4026]">尚无过往交集记录。</p>
                ) : (
                  [...npcState.memories].reverse().map((m, idx) => (
                    <p key={idx} className="text-[11px] leading-snug text-[#2E1E11]">
                      <strong className="font-mono-num text-[#7F231A]">
                        D0{m.day}
                      </strong>{" "}
                      [{m.impactTag}] {m.summary}
                    </p>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ==================== OVERLAY B: 完整对话框记录层（点击底部窄栏「对话框」展开） ==================== */}
      {isTranscriptOpen && (
        <div className="absolute z-40 bottom-[29%] left-1/2 -translate-x-1/2 w-[92vw] max-w-2xl rounded-xl border border-[#E59A3C]/45 bg-[#18110C]/96 shadow-[0_20px_55px_rgba(0,0,0,0.9)] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#F5D096]/14 bg-[#120C08] flex items-center justify-between text-xs">
            <span className="font-display font-bold text-[#FDF5EB]">
              吧台对话记录 · {profile.name}
            </span>
            <button
              type="button"
              onClick={() => setIsTranscriptOpen(false)}
              className="text-[#C9A882] hover:text-[#FDF5EB] flex items-center gap-1 cursor-pointer"
            >
              <span>收起</span>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-[42vh] overflow-y-auto p-4 space-y-3">
            {state.dialogueHistory.length === 0 ? (
              <p className="text-xs text-[#9E8874] text-center py-4">
                客人正在落座，尚无对话记录。
              </p>
            ) : (
              state.dialogueHistory.map((line) => {
                if (line.speaker === "SYSTEM") {
                  return (
                    <div
                      key={line.id}
                      className="py-1.5 px-3 rounded border border-[#E59A3C]/35 bg-[#281C14] text-xs text-[#F7D7A8]"
                    >
                      {line.text}
                    </div>
                  );
                }
                const isPlayer = line.speaker === "PLAYER";
                return (
                  <div
                    key={line.id}
                    className={`flex flex-col ${
                      isPlayer ? "items-end" : "items-start"
                    }`}
                  >
                    <span className="text-[10px] text-[#9E8874] mb-0.5">
                      {line.speakerName} · {line.timestamp}
                    </span>
                    <div
                      className={`max-w-lg rounded-lg px-3.5 py-2 text-xs sm:text-sm leading-relaxed ${
                        isPlayer
                          ? "bg-[#312319] text-[#FAF0E6] border border-[#F5D096]/18"
                          : "bg-[#130E0A] text-[#F3EAE0] border border-[#F5D096]/12"
                      }`}
                    >
                      {line.servedDrinkVisual && (
                        <div className="mb-2 p-2 rounded border border-[#E59A3C]/40 bg-[#1B130E] flex items-center gap-2.5">
                          <div className="w-11 h-11 rounded border border-[#E59A3C]/50 overflow-hidden shrink-0">
                            <ArtworkImage
                              src={line.servedDrinkVisual.imageUrl}
                              alt={line.servedDrinkVisual.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="text-xs">
                            <p className="font-bold text-[#FDF5EB]">
                              《{line.servedDrinkVisual.name}》
                            </p>
                            <p className="text-[11px] text-[#C7B099]">
                              {line.servedDrinkVisual.ingredientsText}
                            </p>
                          </div>
                        </div>
                      )}
                      {line.subtext && (
                        <p className="text-xs text-[#C9A882] italic mb-1">
                          {cleanDialogueQuotes(line.subtext)}
                        </p>
                      )}
                      <p>
                        {line.speaker === "NPC"
                          ? cleanDialogueQuotes(line.text)
                          : line.text}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ==================== OVERLAY C: 独立全屏调酒操作台界面 ==================== */}
      {isBartenderOpen && (
        <WastelandBartendingStation
          inventory={state.inventory}
          patronName={profile.name}
          alreadyServedThisTurn={state.currentTurnServedDrink}
          isLoadingAi={isLoadingAi}
          hasPendingOffer={Boolean(state.pendingOffer)}
          onClose={() => setIsBartenderOpen(false)}
          onServeDrink={(drink, note) => {
            setServedCounterDrink(drink);
            setIsBartenderOpen(false);
            onServeDrink(drink, note);
          }}
        />
      )}

      {/* ==================== OVERLAY D: 哔哔小子近景放大详细状态终端 ==================== */}
      {isPipExpanded && (
        <DayPipBoyExpandedModal
          state={state}
          initialTab={
            (pipChannel === "BULLETINS"
              ? "BULLETINS"
              : pipChannel === "RUMORS"
              ? "RUMORS"
              : "OVERVIEW") as ExpandedPipTab
          }
          onClose={() => setIsPipExpanded(false)}
          onOpenDeckAndPerks={() => onOpenCodexTab("DECK")}
          onInspectCurrentPatron={() => setIsDossierOpen(true)}
        />
      )}
    </div>
  );
};
