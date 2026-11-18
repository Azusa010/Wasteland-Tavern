import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Flame,
  Moon,
  RotateCcw,
  Download,
  Upload,
  Volume2,
  VolumeX,
  Radio,
  Mic,
  MicOff,
  X,
  HeartHandshake,
  Save,
  FolderOpen,
  Home,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { ARTWORK_ASSETS, NPC_ORDER, NPC_PROFILES } from "../data/gameConfig";
import { CampaignSaveState } from "../types/game";
import { soundFx } from "../utils/sound";
import { ArtworkImage } from "./ArtworkImage";
import {
  DrawerPanelMode,
  SettingsAndRosterDrawer,
} from "./SettingsAndRosterDrawer";

export interface ManualSaveSlot {
  slotId: 1 | 2 | 3;
  savedAt: string;
  state: CampaignSaveState;
}

function getPhaseShortName(phase: CampaignSaveState["phase"]): string {
  switch (phase) {
    case "DAY_TAVERN":
      return "白昼营业";
    case "DUSK_LEDGER":
      return "黄昏盘点";
    case "NIGHT_ROGUELIKE":
      return "黑夜拾荒";
    case "ENDING":
      return "终局铭刻";
    default:
      return "待开张";
  }
}

interface TitleScreenProps {
  savedPreview: CampaignSaveState | null;
  onStartFresh: () => void;
  onOpenLoadArchive: () => void;
  onContinueSave: () => void;
  onAudioFlagsSynced?: (flags: {
    bgmEnabled: boolean;
    sfxEnabled: boolean;
    ttsEnabled: boolean;
  }) => void;
  onRosterUpdated?: (appendToTodayQueue?: boolean) => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  savedPreview,
  onStartFresh,
  onOpenLoadArchive,
  onContinueSave,
  onAudioFlagsSynced,
  onRosterUpdated,
}) => {
  const hasContinue = Boolean(savedPreview);
  const [selectedIndex, setSelectedIndex] = useState<number>(() =>
    hasContinue ? 2 : 0
  );
  const [activeDrawerMode, setActiveDrawerMode] =
    useState<DrawerPanelMode | null>(null);
  const [titleNotice, setTitleNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!titleNotice) return;
    const t = setTimeout(() => setTitleNotice(null), 3500);
    return () => clearTimeout(t);
  }, [titleNotice]);

  // 根据游戏进度动态关联主界面背景画作
  const dynamicBackdrop = useMemo(() => {
    if (!savedPreview) {
      return {
        src: ARTWORK_ASSETS.titleEarly,
        alt: "荒原暮色中尚未开张的铁皮小酒馆",
        stageNote: "",
      };
    }
    if (savedPreview.phase === "NIGHT_ROGUELIKE") {
      return {
        src: ARTWORK_ASSETS.ruinsNight,
        alt: "核冬寒月下的黑夜废墟营地",
        stageNote: `第 ${String(savedPreview.day).padStart(2, "0")} 日 · 黑夜废墟探险中`,
      };
    }
    if (savedPreview.day >= 5 || savedPreview.havenReputation >= 46) {
      return {
        src: ARTWORK_ASSETS.titleThriving,
        alt: "风雪中灯火通明的废土避风港酒馆",
        stageNote: `第 ${String(savedPreview.day).padStart(2, "0")} 日 · 荒原避风港 · 声望 ${savedPreview.havenReputation}`,
      };
    }
    if (savedPreview.day >= 2 || savedPreview.havenReputation >= 28) {
      return {
        src: ARTWORK_ASSETS.tavernDay,
        alt: "昏黄钨丝灯下的废土酒馆吧台",
        stageNote: `第 ${String(savedPreview.day).padStart(2, "0")} 日 · ${getPhaseShortName(savedPreview.phase)} · 瓶盖 ${savedPreview.caps}`,
      };
    }
    return {
      src: ARTWORK_ASSETS.titleEarly,
      alt: "荒原初创期的铁皮小酒馆",
      stageNote: `第 ${String(savedPreview.day).padStart(2, "0")} 日 · ${getPhaseShortName(savedPreview.phase)}`,
    };
  }, [savedPreview]);

  const menuItems = useMemo(
    () => [
      {
        id: "new_game",
        scaleCode: "00.0",
        label: "推门营业（从第1天开张）",
        disabled: false,
        action: () => {
          setActiveDrawerMode(null);
          onStartFresh();
        },
      },
      {
        id: "load_game",
        scaleCode: "10.0",
        label: "载入存档",
        disabled: false,
        action: () => {
          setActiveDrawerMode(null);
          onOpenLoadArchive();
        },
      },
      {
        id: "continue_game",
        scaleCode: "20.0",
        label: "继续上次进度",
        disabled: !hasContinue,
        action: () => {
          if (hasContinue) {
            setActiveDrawerMode(null);
            onContinueSave();
          }
        },
      },
      {
        id: "character_roster",
        scaleCode: "30.0",
        label: "人物库",
        disabled: false,
        action: () => {
          setActiveDrawerMode((prev) => (prev === "ROSTER" ? null : "ROSTER"));
        },
      },
      {
        id: "system_settings",
        scaleCode: "40.0",
        label: "系统设置",
        disabled: false,
        action: () => {
          setActiveDrawerMode((prev) =>
            prev === "SETTINGS" ? null : "SETTINGS"
          );
        },
      },
    ],
    [hasContinue, onStartFresh, onOpenLoadArchive, onContinueSave]
  );

  // 键盘上下移动卡尺游标与回车确认（输入框聚焦时自动让位）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement | null)?.tagName || "";
      if (
        targetTag === "INPUT" ||
        targetTag === "TEXTAREA" ||
        targetTag === "SELECT"
      ) {
        if (e.key === "Escape" && activeDrawerMode) {
          setActiveDrawerMode(null);
        }
        return;
      }

      if (e.key === "Escape" && activeDrawerMode) {
        e.preventDefault();
        soundFx.playCaliperTick();
        setActiveDrawerMode(null);
        return;
      }

      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = (prev + 1) % menuItems.length;
          soundFx.playCaliperTick();
          return next;
        });
      } else if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = (prev - 1 + menuItems.length) % menuItems.length;
          soundFx.playCaliperTick();
          return next;
        });
      } else if (e.key === "Enter" || e.key === " ") {
        const current = menuItems[selectedIndex];
        if (current && !current.disabled) {
          e.preventDefault();
          soundFx.playCaliperLock();
          current.action();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuItems, selectedIndex, activeDrawerMode]);

  const ROW_HEIGHT = 54;

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden select-none bg-[#0B0908]">
      {/* 全屏动态关联游戏进度的手绘背景层 */}
      <div className="absolute inset-0">
        <ArtworkImage
          src={dynamicBackdrop.src}
          alt={dynamicBackdrop.alt}
          className="w-full h-full object-cover scale-[1.01] transition-opacity duration-500"
          tone={savedPreview?.phase === "NIGHT_ROGUELIKE" ? "cold" : "warm"}
        />
        {/* 克制的左侧暗角渐变，保留右侧大面积画作留白 */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B0908]/92 via-[#0B0908]/45 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0908]/75 via-transparent to-[#0B0908]/25" />
      </div>

      {/* 主界面前景层：极简留白构图（左上标题 + 左下游标卡尺菜单） */}
      <div className="relative z-10 w-full h-full flex flex-col justify-between px-10 sm:px-16 lg:px-24 py-14 sm:py-20">
        {/* 左上游戏主标题（无多余宣传文案） */}
        <div className="space-y-3 max-w-md">
          <h1 className="font-display text-5xl sm:text-6xl font-bold tracking-[0.1em] text-[#FDF5EB] drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)]">
            废土酒馆
          </h1>
          <div className="flex items-center gap-3">
            <span className="w-10 h-px bg-[#E59A3C]/65" />
            <span className="font-mono-num text-[11px] tracking-[0.38em] text-[#D6BFA9]/70">
              WASTELAND TAVERN
            </span>
          </div>
        </div>

        {/* 左下机械游标卡尺式选项组件 + 右下极浅进度锚点 */}
        <div className="flex items-end justify-between gap-8">
          <nav
            aria-label="主界面菜单"
            className="relative flex items-stretch"
            style={{ height: `${menuItems.length * ROW_HEIGHT}px` }}
          >
            {/* 游标卡尺主尺导轨 (Main Scale Rail) */}
            <div className="relative w-14 shrink-0 mr-4">
              {/* 主尺金属竖梁 */}
              <div className="absolute right-2 top-0 bottom-0 w-px bg-[#E59A3C]/30" />
              <div className="absolute right-0 top-0 bottom-0 w-px bg-[#F5D096]/12" />

              {/* 精密毫米与厘米刻度蚀刻线（对应 00..40 五档游标） */}
              {Array.from({ length: 33 }).map((_, idx) => {
                const isMajor = idx % 8 === 0;
                const isMid = idx % 4 === 0 && !isMajor;
                const topPct = (idx / 32) * 100;
                return (
                  <div
                    key={idx}
                    className="absolute right-2 flex items-center justify-end"
                    style={{ top: `${topPct}%`, transform: "translateY(-50%)" }}
                  >
                    {isMajor && (
                      <span className="font-mono-num text-[10px] text-[#C9A882]/45 mr-2">
                        {String((idx / 8) * 10).padStart(2, "0")}
                      </span>
                    )}
                    <span
                      className={`block h-px ${
                        isMajor
                          ? "w-4 bg-[#E59A3C]/60"
                          : isMid
                          ? "w-2.5 bg-[#F5D096]/35"
                          : "w-1.5 bg-[#F5D096]/18"
                      }`}
                    />
                  </div>
                );
              })}

              {/* 滑动副尺游标与卡爪头 (Sliding Vernier Cursor) */}
              <div
                className="absolute right-[-6px] left-0 pointer-events-none transition-transform duration-150 ease-out"
                style={{
                  height: `${ROW_HEIGHT}px`,
                  transform: `translateY(${selectedIndex * ROW_HEIGHT}px)`,
                }}
              >
                <div className="relative w-full h-full flex items-center justify-end">
                  {/* 游标黄铜滑块背板与防滑滚花纹 */}
                  <div className="w-11 h-11 rounded-sm border border-[#E59A3C]/80 bg-[#1E1611]/95 shadow-[0_0_20px_rgba(229,154,60,0.18)] flex items-center justify-between px-1.5">
                    <div className="flex flex-col gap-[3px] opacity-55">
                      <span className="w-1 h-px bg-[#E59A3C]" />
                      <span className="w-1 h-px bg-[#E59A3C]" />
                      <span className="w-1 h-px bg-[#E59A3C]" />
                      <span className="w-1 h-px bg-[#E59A3C]" />
                    </div>
                    <span className="font-mono-num text-[10px] font-semibold text-[#E59A3C]">
                      {menuItems[selectedIndex]?.scaleCode}
                    </span>
                  </div>
                  {/* 游标零刻度准星指针 */}
                  <span className="w-3 h-[2px] bg-[#E59A3C]" />
                </div>
              </div>
            </div>

            {/* 右侧卡爪夹持选项列 */}
            <div className="relative flex flex-col w-72 sm:w-84">
              {/* 随游标同步滑动的上下精密卡爪框线 (Caliper Measuring Jaws) */}
              <div
                className="absolute inset-x-0 pointer-events-none transition-transform duration-150 ease-out"
                style={{
                  height: `${ROW_HEIGHT}px`,
                  transform: `translateY(${selectedIndex * ROW_HEIGHT}px)`,
                }}
              >
                <div className="w-full h-full relative bg-gradient-to-r from-[#E59A3C]/12 via-[#E59A3C]/4 to-transparent">
                  {/* 上卡爪线与斜切尖角 */}
                  <div className="absolute top-1.5 left-0 right-4 h-px bg-gradient-to-r from-[#E59A3C]/85 via-[#E59A3C]/35 to-transparent" />
                  <div className="absolute top-1.5 left-0 w-px h-2.5 bg-[#E59A3C]" />
                  {/* 下卡爪线与斜切尖角 */}
                  <div className="absolute bottom-1.5 left-0 right-4 h-px bg-gradient-to-r from-[#E59A3C]/85 via-[#E59A3C]/35 to-transparent" />
                  <div className="absolute bottom-1.5 left-0 w-px h-2.5 bg-[#E59A3C]" />
                </div>
              </div>

              {menuItems.map((item, idx) => {
                const isSelected = selectedIndex === idx;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={item.disabled}
                    onMouseEnter={() => {
                      if (selectedIndex !== idx) {
                        setSelectedIndex(idx);
                        soundFx.playCaliperTick();
                      }
                    }}
                    onFocus={() => {
                      if (selectedIndex !== idx) {
                        setSelectedIndex(idx);
                        soundFx.playCaliperTick();
                      }
                    }}
                    onClick={() => {
                      if (item.disabled) return;
                      soundFx.playCaliperLock();
                      item.action();
                    }}
                    style={{ height: `${ROW_HEIGHT}px` }}
                    className={`relative z-10 text-left px-5 flex items-center justify-between transition-all duration-150 focus:outline-none ${
                      item.disabled
                        ? "text-[#8C7765]/40 cursor-not-allowed"
                        : isSelected
                        ? "text-[#FDF5EB] translate-x-1 cursor-pointer"
                        : "text-[#C7B099]/75 hover:text-[#FDF5EB] cursor-pointer"
                    }`}
                  >
                    <span
                      className={`font-display text-lg sm:text-xl tracking-wide whitespace-nowrap ${
                        isSelected && !item.disabled ? "font-bold" : "font-semibold"
                      }`}
                    >
                      {item.label}
                    </span>

                    {item.disabled ? (
                      <span className="font-mono-num text-[11px] text-[#8C7765]/45 whitespace-nowrap ml-3">
                        无记录
                      </span>
                    ) : (item.id === "character_roster" &&
                        activeDrawerMode === "ROSTER") ||
                      (item.id === "system_settings" &&
                        activeDrawerMode === "SETTINGS") ? (
                      <span className="font-mono-num text-[11px] text-[#E59A3C] whitespace-nowrap ml-3">
                        已展开
                      </span>
                    ) : (
                      <span
                        className={`font-mono-num text-xs transition-opacity duration-150 ${
                          isSelected
                            ? "opacity-90 text-[#E59A3C]"
                            : "opacity-0"
                        }`}
                      >
                        ┤
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* 右侧：展开半透黄铜暗板（30.0 人物库 / 40.0 系统设置），收起时保留完整画作留白 */}
          {activeDrawerMode ? (
            <div className="flex-1 flex justify-end min-w-0 z-20">
              <SettingsAndRosterDrawer
                mode={activeDrawerMode}
                presentation="title_inline"
                onSwitchMode={(m) => {
                  setActiveDrawerMode(m);
                  setSelectedIndex(m === "ROSTER" ? 3 : 4);
                }}
                onClose={() => setActiveDrawerMode(null)}
                onAudioFlagsSynced={onAudioFlagsSynced}
                onRosterUpdated={onRosterUpdated}
                onNotify={(msg) => setTitleNotice(msg)}
              />
            </div>
          ) : (
            dynamicBackdrop.stageNote && (
              <div className="hidden sm:block text-right font-mono-num text-xs text-[#D6BFA9]/50 tracking-wider">
                {dynamicBackdrop.stageNote}
              </div>
            )
          )}
        </div>
      </div>

      {titleNotice && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-sm border border-[#E59A3C]/60 bg-[#120D0A]/95 text-xs text-[#F7D7A8] shadow-2xl pointer-events-none">
          {titleNotice}
        </div>
      )}
    </div>
  );
};

interface DuskLedgerViewProps {
  state: CampaignSaveState;
  onHealWithCaps: () => void;
  onStartNightRun: () => void;
}

export const DuskLedgerView: React.FC<DuskLedgerViewProps> = ({
  state,
  onHealWithCaps,
  onStartNightRun,
}) => {
  const canHeal = state.caps >= 8 && state.playerHp < state.playerMaxHp;

  return (
    <div className="h-full flex items-center justify-center py-4">
      <div className="w-full max-w-3xl rounded-xl border border-[#F5D096]/18 bg-[#211813]/95 p-8 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#F5D096]/12 pb-4">
          <div>
            <p className="font-mono-num text-xs text-[#E59A3C]">
              DAY {String(state.day).padStart(2, "0")} · 黄昏打烊盘点
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#FDF5EB] mt-1">
              拉下铁皮卷帘门，清点今日账本
            </h2>
          </div>
          <Flame className="w-6 h-6 text-[#E59A3C] shrink-0" />
        </div>

        <div className="grid grid-cols-3 gap-4 text-xs">
          <div className="rounded-lg bg-[#17110E] border border-[#F5D096]/10 p-4">
            <span className="text-[#9E8874] block">今日招待客人</span>
            <span className="font-mono-num text-2xl font-bold text-[#FDF5EB] mt-1 block">
              {state.todayLedger.patronsServed} 位
            </span>
          </div>
          <div className="rounded-lg bg-[#17110E] border border-[#F5D096]/10 p-4">
            <span className="text-[#9E8874] block">实收瓶盖</span>
            <span className="font-mono-num text-2xl font-bold text-[#E59A3C] mt-1 block">
              +{state.todayLedger.capsEarned}
            </span>
          </div>
          <div className="rounded-lg bg-[#17110E] border border-[#F5D096]/10 p-4">
            <span className="text-[#9E8874] block">记入赊账</span>
            <span className="font-mono-num text-2xl font-bold text-[#FAF0E6] mt-1 block">
              {state.todayLedger.capsCreditIssued}
            </span>
          </div>
        </div>

        <div className="rounded-lg bg-[#17110E] border border-[#F5D096]/12 p-4 space-y-1.5 text-xs leading-relaxed">
          <p className="font-semibold text-[#E6CCB2]">今夜废墟昼夜因果态势：</p>
          {state.nightCompanion && (
            <p className="text-teal-300">
              · 同行助战：「{state.nightCompanion.name}」已背上装备就位（战斗每回合自动触发「{state.nightCompanion.skillName}」）
            </p>
          )}
          {state.activeCommission && (
            <p className="text-amber-300">
              · 专属委托：第 2 层已点亮《{state.activeCommission.title}》（办妥后黎明额外领 +{state.activeCommission.rewardCaps} 瓶盖）
            </p>
          )}
          {state.nightTrapCacheUnlocked && (
            <p className="text-emerald-300">
              · 设局生效：第 2 层已刷出无伤捡漏点「假坐标诱敌战利品箱」
            </p>
          )}
          {state.nightIntelUnlocked ? (
            <p className="text-emerald-400">
              · 「{state.nightIntelPatronName}」留下的暗号已点亮第 2 层「隐藏高产医药冷藏室」
            </p>
          ) : (
            !state.nightTrapCacheUnlocked && (
              <p className="text-[#B59E88]">
                · 今夜未获额外冷藏室密道坐标，按扇区态势潜入搜刮
              </p>
            )
          )}
          {state.nightHitmanTriggered && (
            <p className="text-[#EF6B63] font-semibold">
              · 高危警报：白昼拆穿「{state.nightHitmanSponsor || "潜伏者"}」领赏，第 2 层出现「买凶清算猎手」精英伏击！
            </p>
          )}
          {state.nightAmbushTriggered && (
            <p className="text-[#EF6B63]">
              · 警报：白昼冲突结仇，第 2 层窄巷出现冷枪伏击反应
            </p>
          )}
          {state.nightBossWeakened && (
            <p className="text-amber-300">
              · 情报/设局生效：第 3 层首领巨钳兽初始生命已削减 20%
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!canHeal}
              onClick={onHealWithCaps}
              className="px-4 py-2.5 rounded-lg border border-[#F5D096]/22 hover:bg-[#32241C] disabled:opacity-40 text-xs text-[#FAF0E6] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <HeartHandshake className="w-4 h-4 text-emerald-400" />
              战地包扎（-8 瓶盖 / +15 生命）
            </button>
            <span className="text-xs text-[#B59E88] font-mono-num">
              HP {state.playerHp}/{state.playerMaxHp}
            </span>
          </div>

          <button
            type="button"
            onClick={onStartNightRun}
            className="px-6 py-3 rounded-lg bg-[#E59A3C] hover:bg-[#F0A84B] text-[#1B1410] text-sm font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center justify-center gap-2"
          >
            <Moon className="w-4 h-4" />
            潜入黑夜废墟（卡牌搜刮）
          </button>
        </div>
      </div>
    </div>
  );
};

interface EndingViewProps {
  state: CampaignSaveState;
  onContinueEndless: () => void;
  onRestartNewGame: () => void;
}

export const EndingView: React.FC<EndingViewProps> = ({
  state,
  onContinueEndless,
  onRestartNewGame,
}) => {
  const highTrustCount = NPC_ORDER.filter(
    (id) => state.npcs[id].trust >= 70
  ).length;
  const unlockedCardsCount = NPC_ORDER.filter(
    (id) => state.npcs[id].unlockedCardGiven
  ).length;

  let endingTitle = "风雪中的微弱孤灯";
  let endingBackdrop: string = ARTWORK_ASSETS.titleEarly;
  let endingDesc =
    "七个昼夜过去了，你的铁皮小酒馆在核冬寒潮里撑了下来。只要吧台那盏钨丝灯还亮着，荒原上总有人知道哪里还能喝上一口热酒。";

  if (highTrustCount >= 3 && state.tavernSecurity >= 70) {
    endingTitle = "荒原灯塔：所有人最后的落脚点";
    endingBackdrop = ARTWORK_ASSETS.titleThriving;
    endingDesc =
      "暴风雪席卷废墟之夜，阿灰替你加固了铁皮屋顶，巴克扛着霰弹枪守在门廊，K-7 调校好了恒温净水器，莫里的驼队把这里定为了荒原免战驿站。你真正把这家小酒馆开成了所有人的归宿。";
  } else if (
    state.npcs.k7_synth.trust >= 72 &&
    state.npcs.ash_scavenger.trust >= 68
  ) {
    endingTitle = "地下铁微光庇护所";
    endingBackdrop = ARTWORK_ASSETS.tavernDay;
    endingDesc =
      "你替逃亡合成人保守了秘密，也温暖了饥寒交迫的拾荒客。酒馆地窖下建起了互助净水站，暗夜里多了一条不问出身的安全通道。";
  } else if (state.caps >= 130) {
    endingTitle = "铁锈十字路口的传奇掌柜";
    endingBackdrop = ARTWORK_ASSETS.titleThriving;
    endingDesc =
      "凭借精明的调酒手艺与过人的夜探胆识，你的瓶盖箱装得满满当当，酒馆名号响彻整片东区废墟。";
  }

  return (
    <div className="h-full flex items-center justify-center py-4">
      <div className="w-full max-w-3xl rounded-xl border border-[#E59A3C]/35 bg-[#211813] overflow-hidden shadow-2xl">
        <div className="h-56 relative">
          <ArtworkImage
            src={endingBackdrop}
            alt={endingTitle}
            className="w-full h-full object-cover"
            tone="warm"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#211813] via-[#211813]/45 to-transparent" />
          <div className="absolute bottom-4 left-8 right-8">
            <p className="font-mono-num text-xs text-[#E59A3C]">
              CHAPTER COMPLETE · 第 {state.day - 1} 日终局铭刻
            </p>
            <h2 className="font-display text-3xl font-bold text-[#FDF5EB] mt-1">
              {endingTitle}
            </h2>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <p className="text-sm sm:text-base text-[#E6D5C3] leading-relaxed">
            {endingDesc}
          </p>

          <div className="grid grid-cols-4 gap-3 text-xs">
            <div className="rounded-lg bg-[#17110E] p-3.5 border border-[#F5D096]/10">
              <span className="text-[#9E8874] block">结余瓶盖</span>
              <span className="font-mono-num text-lg font-bold text-[#E59A3C]">
                {state.caps}
              </span>
            </div>
            <div className="rounded-lg bg-[#17110E] p-3.5 border border-[#F5D096]/10">
              <span className="text-[#9E8874] block">至交常客</span>
              <span className="font-mono-num text-lg font-bold text-[#FDF5EB]">
                {highTrustCount}/{NPC_ORDER.length}
              </span>
            </div>
            <div className="rounded-lg bg-[#17110E] p-3.5 border border-[#F5D096]/10">
              <span className="text-[#9E8874] block">常客信物卡</span>
              <span className="font-mono-num text-lg font-bold text-emerald-400">
                {unlockedCardsCount}/4
              </span>
            </div>
            <div className="rounded-lg bg-[#17110E] p-3.5 border border-[#F5D096]/10">
              <span className="text-[#9E8874] block">收留声望</span>
              <span className="font-mono-num text-lg font-bold text-[#FAF0E6]">
                {state.havenReputation}
              </span>
            </div>
          </div>

          <div className="space-y-1 text-xs text-[#C7B099]">
            {NPC_ORDER.map((id) => (
              <p key={id}>
                · {NPC_PROFILES[id].name}：信任{" "}
                <span className="font-mono-num text-[#E59A3C]">
                  {state.npcs[id].trust}/100
                </span>{" "}
                · 记忆{" "}
                <span className="font-mono-num">
                  {state.npcs[id].memories.length}
                </span>{" "}
                条
              </p>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onContinueEndless}
              className="px-6 py-2.5 rounded-lg bg-[#E59A3C] hover:bg-[#F0A84B] text-[#1B1410] text-sm font-semibold transition-colors whitespace-nowrap"
            >
              继续无尽经营
            </button>
            <button
              type="button"
              onClick={onRestartNewGame}
              className="px-5 py-2.5 rounded-lg border border-[#F5D096]/22 hover:bg-[#31241D] text-sm text-[#FAF0E6] transition-colors whitespace-nowrap flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              开启新周目
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface SaveModalProps {
  isOpen: boolean;
  isFromTitle: boolean;
  currentState: CampaignSaveState;
  autoSavePreview: CampaignSaveState | null;
  manualSlots: Record<1 | 2 | 3, ManualSaveSlot | null>;
  onClose: () => void;
  onSaveToSlot: (slotId: 1 | 2 | 3) => void;
  onLoadState: (target: CampaignSaveState) => void;
  onLoadJudgePreset: () => void;
  onToggleSound: () => void;
  onToggleBgm: () => void;
  onToggleTts: () => void;
  onOpenSettings?: () => void;
  onOpenRoster?: () => void;
  onReturnToTitle: () => void;
}

export const SaveAndPresetModal: React.FC<SaveModalProps> = ({
  isOpen,
  isFromTitle,
  currentState,
  autoSavePreview,
  manualSlots,
  onClose,
  onSaveToSlot,
  onLoadState,
  onLoadJudgePreset,
  onToggleSound,
  onToggleBgm,
  onToggleTts,
  onOpenSettings,
  onOpenRoster,
  onReturnToTitle,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleExportJson = () => {
    const target = isFromTitle && autoSavePreview ? autoSavePreview : currentState;
    const blob = new Blob([JSON.stringify(target, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wasteland-tavern-day${target.day}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as CampaignSaveState;
        if (parsed && typeof parsed.day === "number" && parsed.npcs) {
          onLoadState(parsed);
          onClose();
        }
      } catch {
        // ignore invalid save file
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 select-none"
      role="dialog"
      aria-modal="true"
      aria-label="存档舱"
    >
      <div className="w-full max-w-2xl rounded-xl border border-[#E59A3C]/35 bg-[#1B1410] p-6 sm:p-7 space-y-5 text-[#F3EAE0] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#F5D096]/12 pb-3.5">
          <div className="flex items-center gap-3">
            <span className="font-mono-num text-xs text-[#E59A3C]">ARCHIVE</span>
            <h3 className="font-display text-xl font-bold text-[#FDF5EB]">
              {isFromTitle ? "载入存档记录" : "存档与系统控制"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-[#2E221B] text-[#C7B099]"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 存档槽位列表（自动存档 + 3个独立卡尺归档槽 + 第3日章节预设档） */}
        <div className="space-y-2.5 max-h-[52vh] overflow-y-auto pr-1">
          {/* 自动存档槽 */}
          <div className="rounded-lg border border-[#F5D096]/16 bg-[#241B16] px-4 py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono-num text-[#E59A3C]">AUTO</span>
                <span className="font-semibold text-[#FDF5EB]">自动进度记录</span>
              </div>
              {autoSavePreview ? (
                <p className="font-mono-num text-xs text-[#BDA58E] mt-1">
                  第 {String(autoSavePreview.day).padStart(2, "0")} 日 ·{" "}
                  {getPhaseShortName(autoSavePreview.phase)} · 瓶盖{" "}
                  {autoSavePreview.caps} · 声望 {autoSavePreview.havenReputation}
                </p>
              ) : (
                <p className="text-xs text-[#8C7765] mt-1">暂无自动存档记录</p>
              )}
            </div>
            <button
              type="button"
              disabled={!autoSavePreview}
              onClick={() => {
                if (!autoSavePreview) return;
                soundFx.playCaliperLock();
                onLoadState(autoSavePreview);
                onClose();
              }}
              className="px-3.5 py-1.5 rounded bg-[#E59A3C] hover:bg-[#F0A84B] disabled:opacity-30 text-[#1B1410] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              载入
            </button>
          </div>

          {/* 3 个手动存档位 */}
          {([1, 2, 3] as const).map((slotId) => {
            const slot = manualSlots[slotId];
            return (
              <div
                key={slotId}
                className="rounded-lg border border-[#F5D096]/14 bg-[#221914] px-4 py-3 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono-num text-[#C9A882]">
                      SLOT 0{slotId}
                    </span>
                    <span className="font-semibold text-[#FDF5EB]">
                      手动归档位 0{slotId}
                    </span>
                    {slot && (
                      <span className="font-mono-num text-[11px] text-[#8C7765]">
                        · {slot.savedAt}
                      </span>
                    )}
                  </div>
                  {slot ? (
                    <p className="font-mono-num text-xs text-[#BDA58E] mt-1">
                      第 {String(slot.state.day).padStart(2, "0")} 日 ·{" "}
                      {getPhaseShortName(slot.state.phase)} · 瓶盖{" "}
                      {slot.state.caps} · 声望 {slot.state.havenReputation}
                    </p>
                  ) : (
                    <p className="text-xs text-[#8C7765] mt-1">空白归档槽</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!isFromTitle && (
                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playBottleCaps();
                        onSaveToSlot(slotId);
                      }}
                      className="px-3 py-1.5 rounded border border-[#F5D096]/22 hover:border-[#E59A3C] text-xs text-[#FAF0E6] transition-colors whitespace-nowrap flex items-center gap-1"
                    >
                      <Save className="w-3.5 h-3.5 text-[#E59A3C]" />
                      记录
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!slot}
                    onClick={() => {
                      if (!slot) return;
                      soundFx.playCaliperLock();
                      onLoadState(slot.state);
                      onClose();
                    }}
                    className="px-3.5 py-1.5 rounded bg-[#31241D] hover:bg-[#E59A3C] hover:text-[#1B1410] disabled:opacity-30 text-xs font-medium text-[#FAF0E6] transition-colors whitespace-nowrap"
                  >
                    载入
                  </button>
                </div>
              </div>
            );
          })}

          {/* 内置章节档案（第 3 日熟客记忆节点） */}
          <div className="rounded-lg border border-[#E59A3C]/30 bg-[#271C15] px-4 py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono-num text-[#E59A3C]">CHAPTER 03</span>
                <span className="font-semibold text-[#FDF5EB]">
                  中期节点档案（侦探电报·流言生态·阿灰同行已激活）
                </span>
              </div>
              <p className="text-xs text-[#BDA58E] mt-1">
                第 03 日 · 白昼营业 · 含加密通缉电报、全馆流言风评、阿灰助战与莫里旧账记忆链
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                soundFx.playCaliperLock();
                onLoadJudgePreset();
                onClose();
              }}
              className="px-3.5 py-1.5 rounded border border-[#E59A3C]/60 hover:bg-[#E59A3C] hover:text-[#1B1410] text-xs font-semibold text-[#F7D7A8] transition-colors whitespace-nowrap shrink-0"
            >
              载入章节
            </button>
          </div>
        </div>

        {/* 底部工具控制栏 */}
        <div className="pt-3.5 border-t border-[#F5D096]/12 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 rounded border border-[#F5D096]/18 bg-[#140F0C] hover:border-[#E59A3C] flex items-center gap-1.5 whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5 text-[#E59A3C]" />
              读取文件
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={handleExportJson}
              className="px-3 py-2 rounded border border-[#F5D096]/18 bg-[#140F0C] hover:border-[#E59A3C] flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-[#E59A3C]" />
              导出文件
            </button>

            <button
              type="button"
              onClick={onToggleBgm}
              className="px-2.5 py-2 rounded border border-[#F5D096]/18 bg-[#140F0C] hover:bg-[#271D17] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Radio
                className={`w-3.5 h-3.5 ${
                  currentState.bgmEnabled !== false
                    ? "text-emerald-400"
                    : "text-[#8C7765]"
                }`}
              />
              {currentState.bgmEnabled !== false ? "电台开启" : "电台静音"}
            </button>

            <button
              type="button"
              onClick={onToggleTts}
              className="px-2.5 py-2 rounded border border-[#F5D096]/18 bg-[#140F0C] hover:bg-[#271D17] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              {currentState.ttsEnabled !== false ? (
                <>
                  <Mic className="w-3.5 h-3.5 text-emerald-400" />
                  人声开启
                </>
              ) : (
                <>
                  <MicOff className="w-3.5 h-3.5 text-[#8C7765]" />
                  人声关闭
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onToggleSound}
              className="px-2.5 py-2 rounded border border-[#F5D096]/18 bg-[#140F0C] hover:bg-[#271D17] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              {currentState.soundEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  音效开启
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-[#8C7765]" />
                  音效静音
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onOpenRoster && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenRoster();
                }}
                className="px-3 py-2 rounded border border-[#E59A3C]/35 hover:bg-[#2F221B] text-[#F7D7A8] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-[#E59A3C]" />
                人物库
              </button>
            )}
            {onOpenSettings && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="px-3 py-2 rounded border border-[#E59A3C]/35 hover:bg-[#2F221B] text-[#F7D7A8] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#E59A3C]" />
                系统设置
              </button>
            )}
            {!isFromTitle && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onReturnToTitle();
                }}
                className="px-3.5 py-2 rounded border border-[#F5D096]/20 hover:bg-[#2F221B] text-[#D6BFA9] flex items-center gap-1.5 whitespace-nowrap"
              >
                <Home className="w-3.5 h-3.5" />
                退回主界面
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-[#2E221B] hover:bg-[#3B2C23] text-[#FAF0E6] font-medium whitespace-nowrap"
            >
              关闭 [ESC]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
