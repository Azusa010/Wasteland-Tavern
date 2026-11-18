import React, { useMemo } from "react";
import { ARTWORK_ASSETS } from "../data/gameConfig";
import { ARCHETYPE_META, ResolvedCardStats } from "../data/rpgAndCards";
import { ArtworkImage } from "./ArtworkImage";
import { CutoutSprite } from "./CutoutSprite";
import { TooltipDetailRow, WastelandTooltip } from "./WastelandTooltip";

interface IllustratedGameCardProps {
  stats: ResolvedCardStats;
  upgraded?: boolean;
  effectiveCost?: number;
  disabled?: boolean;
  onClick?: () => void;
  onPointerDown?: React.PointerEventHandler<HTMLElement>;
  isDraggingSource?: boolean;
  disableTooltip?: boolean;
  footerNote?: string;
  upgradePreviewText?: string;
  theme?: "dark" | "pipboy" | "warm";
  compact?: boolean;
  children?: React.ReactNode;
}

const KEYWORD_TOKEN_REGEX =
  /(\d+\s*点?(?:范围|全体|多段)?伤害|\+\d+\s*点?伤害|伤害\s*\+\d+|连射\s*\d*\s*段?|\+?\d+\s*点?护甲|护甲翻倍|护甲保留\s*\d*\s*回合|保留护甲|荆棘反伤\s*\+?\d*|\d+%\s*护甲值|锁定标记(?:\s*\d+\s*回合)?|连击(?:\s*\+\d+|点)?|耗能\s*-\d+|\+?\d+\s*层辐射(?:腐蚀)?|辐射(?:腐蚀|层数)(?:翻倍)?|引爆(?:所有)?辐射|降低(?:敌方)?\s*\d+\s*点?攻击|-\d+\s*点?攻击|0\s*费|锯片飞盘|电弧绊雷|磁暴线圈|搜刮(?:\s*\d+\s*份)?(?:食材|零件|原料)?|\+\d+\s*(?:枚)?瓶盖|恢复\s*\+?\d+\s*点?生命|回复\s*\+?\d+\s*生命|抽\s*\d+\s*张牌|\+\d+\s*点?(?:行动)?能量|返还\s*\d+\s*点?能量|消耗)/g;

function classifyTokenColor(token: string, pipboy: boolean): string {
  if (pipboy) {
    if (/伤害|连射/.test(token)) return "text-[#FCA5A5] font-bold";
    if (/护甲|荆棘/.test(token)) return "text-[#7DD3FC] font-bold";
    if (/锁定标记|连击|耗能|瓶盖|0\s*费|锯片|绊雷|线圈|搜刮/.test(token)) {
      return "text-[#FDE047] font-bold";
    }
    return "text-[#86EFAC] font-bold";
  }

  if (/伤害|连射/.test(token)) {
    return "text-rose-300 font-bold drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]";
  }
  if (/护甲|荆棘/.test(token)) {
    return "text-sky-300 font-bold drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]";
  }
  if (/锁定标记|连击|耗能/.test(token)) {
    return "text-amber-300 font-bold drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]";
  }
  if (/辐射|攻击/.test(token)) {
    return "text-lime-300 font-bold drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]";
  }
  if (/0\s*费|锯片|绊雷|线圈|搜刮|瓶盖/.test(token)) {
    return "text-orange-300 font-bold drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]";
  }
  if (/生命|抽\s*\d+\s*张牌|能量/.test(token)) {
    return "text-emerald-300 font-bold drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]";
  }
  if (/消耗/.test(token)) {
    return "text-purple-300 font-semibold";
  }
  return "text-amber-200 font-semibold";
}

export const HighlightedCardText: React.FC<{
  text: string;
  pipboy?: boolean;
}> = ({ text, pipboy = false }) => {
  const parts = useMemo(() => text.split(KEYWORD_TOKEN_REGEX), [text]);
  return (
    <>
      {parts.map((seg, idx) => {
        if (!seg) return null;
        if (idx % 2 === 1) {
          return (
            <span key={idx} className={classifyTokenColor(seg, pipboy)}>
              {seg}
            </span>
          );
        }
        return <React.Fragment key={idx}>{seg}</React.Fragment>;
      })}
    </>
  );
};

function resolveUnifiedFrameUrl(rarity: ResolvedCardStats["rarity"]): string {
  if (rarity === "signature") {
    return ARTWORK_ASSETS.cardFrameSignature;
  }
  if (rarity === "rare") {
    return ARTWORK_ASSETS.cardFrameRare;
  }
  return ARTWORK_ASSETS.cardFrameCommon;
}

function buildCardTooltipDetails(
  stats: ResolvedCardStats,
  displayCost: number,
  footerNote?: string
): TooltipDetailRow[] {
  const rows: TooltipDetailRow[] = [
    {
      label: "所属流派",
      value: ARCHETYPE_META[stats.archetype].label,
      tone:
        stats.archetype === "GUNSLINGER"
          ? "amber"
          : stats.archetype === "JUGGERNAUT"
          ? "sky"
          : stats.archetype === "RAD_BIO"
          ? "lime"
          : stats.archetype === "GADGETEER"
          ? "orange"
          : "slate",
    },
    {
      label: "行动耗能",
      value:
        displayCost < stats.baseCost
          ? `${displayCost} 点（原 ${stats.baseCost} 点）`
          : `${displayCost} 点能量`,
      tone: displayCost === 0 ? "emerald" : "amber",
    },
  ];

  if (stats.applyMarked > 0) {
    rows.push({
      label: "◎ 锁定标记",
      value: "目标受击伤害提高 +35%",
      tone: "amber",
    });
  }
  if (stats.comboGain > 0 || stats.hitsPerCombo || stats.costReducePerCombo) {
    rows.push({
      label: "枪火连击",
      value: "本回合每打出一张连击牌累积连击点，强化弹幕与终结技",
      tone: "amber",
    });
  }
  if (
    stats.retainBlockTurns > 0 ||
    stats.thornsGain > 0 ||
    stats.damageFromBlockRatio > 0
  ) {
    rows.push({
      label: "废铁重甲",
      value:
        stats.thornsGain > 0
          ? `受击自动反伤 ${stats.thornsGain} 点；护甲可跨回合保留`
          : "护甲保留不清空，可转化为重盾猛击伤害",
      tone: "sky",
    });
  }
  if (
    stats.applyRad > 0 ||
    stats.aoeApplyRad > 0 ||
    stats.doubleTargetRad ||
    stats.detonateRadMultiplier > 0
  ) {
    rows.push({
      label: "☢ 辐射腐蚀",
      value: "敌方回合末承受层数无视护甲伤害，可翻倍催化或引爆吸血",
      tone: "lime",
    });
  }
  if (
    stats.spawnGadgetId ||
    stats.spawnGadgetCount > 0 ||
    stats.gadgetTurretGain > 0 ||
    stats.bonusCaps > 0
  ) {
    rows.push({
      label: "拾荒机关",
      value: "衍生 0 费陷阱与飞盘，配合磁暴线圈自动追击电击",
      tone: "orange",
    });
  }
  if (stats.exhaust) {
    rows.push({
      label: "消耗词条",
      value: "本场战斗打出后移入消耗堆，直到战斗结束",
      tone: "purple",
    });
  }
  if (footerNote) {
    rows.push({
      label: "实时结算",
      value: footerNote,
      tone: "emerald",
    });
  }

  return rows;
}

export const IllustratedGameCard: React.FC<IllustratedGameCardProps> = ({
  stats,
  upgraded = false,
  effectiveCost,
  disabled = false,
  onClick,
  onPointerDown,
  isDraggingSource = false,
  disableTooltip = false,
  footerNote,
  upgradePreviewText,
  theme = "dark",
  compact = false,
  children,
}) => {
  const arch = ARCHETYPE_META[stats.archetype];
  const displayCost =
    effectiveCost !== undefined ? effectiveCost : stats.baseCost;
  const costReduced = displayCost < stats.baseCost;
  const isPipboy = theme === "pipboy";
  const frameUrl = resolveUnifiedFrameUrl(stats.rarity);

  const tooltipDesc = upgradePreviewText
    ? `${stats.description}（★升星后：${upgradePreviewText}）`
    : stats.description;

  const tooltipDetails = useMemo(
    () => buildCardTooltipDetails(stats, displayCost, footerNote),
    [stats, displayCost, footerNote]
  );

  // 边框光晕仅用于强化升级反馈或悬停手感，稀有度完全由手绘金属牌框自身颜色（钢铁灰 / 鎏金 / 赤铜）区分，绝不印“普通/稀有”字样
  const hoverRingClass = upgraded
    ? "drop-shadow-[0_10px_22px_rgba(16,185,129,0.28)]"
    : stats.rarity === "signature"
    ? "drop-shadow-[0_10px_22px_rgba(225,95,65,0.28)]"
    : stats.rarity === "rare"
    ? "drop-shadow-[0_10px_22px_rgba(245,175,55,0.28)]"
    : "drop-shadow-[0_10px_20px_rgba(0,0,0,0.72)]";

  const cardArtChassis = (
    <div
      className={`relative w-full aspect-[3/4] select-none transition-transform duration-150 ${hoverRingClass} ${
        isPipboy
          ? "sepia hue-rotate-[70deg] saturate-150 contrast-105"
          : ""
      } ${isDraggingSource ? "opacity-25 scale-95" : ""}`}
    >
      {/* 1. 统一辐射装饰艺术金属手绘牌框底盘（钢铁/鎏金/赤铜三色区分稀有度，无文字标签） */}
      <CutoutSprite
        src={frameUrl}
        alt=""
        cropMode="all"
        className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0"
      />

      {/* 2. 上部内嵌插画视窗（精准对齐金属牌框上窗内缘） */}
      <div className="absolute left-[14.2%] right-[14.2%] top-[12.4%] h-[40%] rounded-[3px] overflow-hidden bg-[#080B10] border border-black/80 shadow-[inset_0_2px_10px_rgba(0,0,0,0.92)] z-10 pointer-events-none">
        <ArtworkImage
          src={stats.imageUrl}
          alt={stats.name}
          fallbackTitle={stats.name}
          className="w-full h-full object-cover"
          tone={theme === "warm" ? "warm" : "cold"}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/15" />
        <span className="absolute bottom-1 right-1 px-1.5 py-[1px] rounded-[2px] bg-black/78 border border-white/15 font-mono-num text-[9px] text-slate-200 leading-tight">
          {arch.shortLabel}
        </span>
      </div>

      {/* 3. 左上角圆形铆钉能量耗能徽章 */}
      <div
        className={`absolute left-[3.2%] top-[2.4%] w-[17.5%] aspect-square rounded-full border-2 flex items-center justify-center font-mono-num font-extrabold shadow-[0_3px_8px_rgba(0,0,0,0.9),inset_0_1px_2px_rgba(255,255,255,0.25)] z-20 pointer-events-none ${
          compact ? "text-xs sm:text-sm" : "text-sm sm:text-base"
        } ${
          costReduced
            ? "bg-[#092C1E] border-emerald-300 text-emerald-200"
            : stats.rarity === "rare"
            ? "bg-[#2C1E0B] border-amber-300/90 text-amber-100"
            : stats.rarity === "signature"
            ? "bg-[#2D1210] border-orange-300/90 text-orange-100"
            : "bg-[#1B232D] border-slate-300/80 text-slate-100"
        }`}
      >
        {displayCost}
      </div>

      {/* 4. 中部金属横梁牌名铭牌（仅升星显示 ★+1，绝不标注稀有/普通字样） */}
      <div className="absolute left-[14.2%] right-[14.2%] top-[53.4%] h-[7.2%] px-1.5 flex items-center justify-center gap-1 bg-[#12161D]/88 border-y border-amber-200/15 z-20 pointer-events-none">
        <h4
          className={`font-display font-bold truncate leading-none tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] ${
            compact ? "text-[11px] sm:text-xs" : "text-xs sm:text-sm"
          } ${upgraded ? "text-emerald-300" : "text-[#F8EFE0]"}`}
        >
          {stats.name}
        </h4>
        {upgraded && (
          <span className="font-mono-num text-[9px] font-extrabold text-emerald-300 shrink-0">
            ★+1
          </span>
        )}
      </div>

      {/* 5. 下部深色石板词条铭牌（特殊属性与数值彩色高亮） */}
      <div className="absolute left-[15%] right-[15%] top-[61.6%] bottom-[9.4%] px-2 py-1.5 bg-[#0C1016]/90 rounded-[2px] flex flex-col justify-between overflow-hidden z-20 pointer-events-none">
        <p
          className={`leading-[1.32] text-slate-100/95 line-clamp-4 ${
            compact ? "text-[10px] sm:text-[11px]" : "text-[11px] sm:text-xs"
          }`}
        >
          <HighlightedCardText text={stats.description} pipboy={isPipboy} />
        </p>

        {(footerNote || stats.exhaust || upgradePreviewText) && (
          <div className="pt-0.5 border-t border-white/10 flex items-center justify-between gap-1 font-mono-num text-[9px] leading-none text-slate-300/90">
            <span className="truncate">
              {upgradePreviewText
                ? `★ ${upgradePreviewText}`
                : footerNote || arch.badgeText}
            </span>
            {stats.exhaust && (
              <span className="text-purple-300 font-bold shrink-0">消耗</span>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const interactiveBody =
    onClick || onPointerDown ? (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        onPointerDown={onPointerDown}
        className={`w-full text-left focus:outline-none touch-none transition-transform duration-150 ${
          disabled
            ? "opacity-45 saturate-50 cursor-not-allowed"
            : "hover:-translate-y-1.5 hover:scale-[1.02] cursor-grab active:cursor-grabbing"
        }`}
      >
        {cardArtChassis}
      </button>
    ) : (
      cardArtChassis
    );

  return (
    <div className="w-full flex flex-col gap-1.5">
      <WastelandTooltip
        title={`${stats.name}${upgraded ? " ★+1" : ""}`}
        subtitle={`${arch.shortLabel} · ${displayCost}费`}
        description={tooltipDesc}
        details={tooltipDetails}
        disabled={disableTooltip || isDraggingSource}
        className="w-full block"
      >
        {interactiveBody}
      </WastelandTooltip>

      {children && <div className="w-full">{children}</div>}
    </div>
  );
};
