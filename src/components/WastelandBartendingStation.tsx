import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, BookOpen, RotateCcw, Sparkles, X, Check } from "lucide-react";
import {
  ARTWORK_ASSETS,
  BARTEND_TOOL_META,
  BartendToolId,
  DRINK_PRESETS,
  INGREDIENT_LIST,
  INGREDIENT_PREP_CHAIN,
  INGREDIENTS,
  computeCraftedDrink,
} from "../data/gameConfig";
import {
  CraftedDrink,
  DrinkRecipePreset,
  IngredientId,
  PourStyle,
} from "../types/game";
import { soundFx } from "../utils/sound";
import { ArtworkImage } from "./ArtworkImage";
import { CutoutSprite } from "./CutoutSprite";
import { WastelandTooltip } from "./WastelandTooltip";

interface WastelandBartendingStationProps {
  inventory: Record<IngredientId, number>;
  patronName: string;
  alreadyServedThisTurn: boolean;
  isLoadingAi: boolean;
  hasPendingOffer: boolean;
  onClose: () => void;
  onServeDrink: (drink: CraftedDrink, note: string) => void;
}

interface ActiveToolSlot {
  uid: string;
  ingredientId: IngredientId;
  stageIndex: number; // 0 or 1
  clicksDone: number;
  readyToAdvance: boolean; // Stage 0 finished, waiting to move to Stage 1 tool
}

interface PreparedShot {
  uid: string;
  ingredientId: IngredientId;
  label: string;
}

type DragPayload =
  | { kind: "RAW"; ingredientId: IngredientId }
  | { kind: "INTERMEDIATE"; fromTool: BartendToolId }
  | { kind: "PREPARED"; uid: string };

const TOOL_ORDER: BartendToolId[] = [
  "PEEL_BOARD",
  "CRANK_JUICER",
  "IRON_MORTAR",
  "CHARCOAL_FILTER",
];

function makeLocalId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export const WastelandBartendingStation: React.FC<
  WastelandBartendingStationProps
> = ({
  inventory,
  patronName,
  alreadyServedThisTurn,
  isLoadingAi,
  hasPendingOffer,
  onClose,
  onServeDrink,
}) => {
  // 四大加工器具上的在制物料
  const [toolSlots, setToolSlots] = useState<
    Record<BartendToolId, ActiveToolSlot | null>
  >({
    PEEL_BOARD: null,
    CRANK_JUICER: null,
    IRON_MORTAR: null,
    CHARCOAL_FILTER: null,
  });
  // 工具点击动画脉冲计数
  const [toolPulse, setToolPulse] = useState<Record<BartendToolId, number>>({
    PEEL_BOARD: 0,
    CRANK_JUICER: 0,
    IRON_MORTAR: 0,
    CHARCOAL_FILTER: 0,
  });

  // 已加工完毕、等待倒入酒杯的备料碟
  const [preparedTray, setPreparedTray] = useState<PreparedShot[]>([]);
  // 已倒入互动酒杯的 0..3 层调酒材料
  const [glassItems, setGlassItems] = useState<IngredientId[]>([]);
  const [glassPulse, setGlassPulse] = useState(0);

  // 是否已完成摇壶混调
  const [isShaking, setIsShaking] = useState(false);
  const [isMixed, setIsMixed] = useState(false);

  // 上酒前份量与附言
  const [pourStyle, setPourStyle] = useState<PourStyle>("standard");
  const [serveNote, setServeNote] = useState("");

  // 配方书开合、当前翻阅酒品与置顶引导配方
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    DRINK_PRESETS[0].id
  );
  const [pinnedPreset, setPinnedPreset] = useState<DrinkRecipePreset | null>(
    null
  );

  // 当前拖拽载荷（用于高亮可放置目标）
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [ statusHint, setStatusHint ] = useState<string | null>(null);

  const flashHint = (msg: string) => {
    setStatusHint(msg);
    window.setTimeout(() => {
      setStatusHint((cur) => (cur === msg ? null : cur));
    }, 2200);
  };

  // 计算当前台面已占用的原材料数量，防止超额取料
  const committedCounts = useMemo(() => {
    const map: Partial<Record<IngredientId, number>> = {};
    TOOL_ORDER.forEach((t) => {
      const slot = toolSlots[t];
      if (slot) {
        map[slot.ingredientId] = (map[slot.ingredientId] || 0) + 1;
      }
    });
    preparedTray.forEach((shot) => {
      map[shot.ingredientId] = (map[shot.ingredientId] || 0) + 1;
    });
    glassItems.forEach((id) => {
      map[id] = (map[id] || 0) + 1;
    });
    return map;
  }, [toolSlots, preparedTray, glassItems]);

  const getAvailableRaw = (id: IngredientId): number => {
    return Math.max(0, (inventory[id] || 0) - (committedCounts[id] || 0));
  };

  // 检查某款配方库存是否足够一键制作
  const canCraftPreset = (preset: DrinkRecipePreset): boolean => {
    const req: Partial<Record<IngredientId, number>> = {};
    preset.ingredients.forEach((id) => {
      req[id] = (req[id] || 0) + 1;
    });
    return (Object.keys(req) as IngredientId[]).every(
      (id) => (inventory[id] || 0) >= (req[id] || 0)
    );
  };

  // 计算成品酒与三种倒酒份量的库存校验
  const craftedDrink = useMemo<CraftedDrink | null>(() => {
    if (glassItems.length < 3) return null;
    const tuple: [IngredientId, IngredientId, IngredientId] = [
      glassItems[0],
      glassItems[1],
      glassItems[2],
    ];
    return computeCraftedDrink(tuple, pourStyle);
  }, [glassItems, pourStyle]);

  const pourStyleMissing = useMemo<string | null>(() => {
    if (glassItems.length < 3) return null;
    const req: Partial<Record<IngredientId, number>> = {};
    if (pourStyle === "watered") {
      [glassItems[0], glassItems[1], "rad_water" as IngredientId].forEach(
        (id) => {
          req[id] = (req[id] || 0) + 1;
        }
      );
    } else {
      glassItems.slice(0, 3).forEach((id) => {
        req[id] = (req[id] || 0) + 1;
      });
      if (pourStyle === "generous") {
        const base = glassItems[0];
        req[base] = (req[base] || 0) + 1;
      }
    }
    for (const id of Object.keys(req) as IngredientId[]) {
      const need = req[id] || 0;
      const have = inventory[id] || 0;
      if (have < need) {
        return `缺 ${INGREDIENTS[id].name}`;
      }
    }
    return null;
  }, [glassItems, pourStyle, inventory]);

  const playToolSfx = (tool: BartendToolId) => {
    if (tool === "PEEL_BOARD") soundFx.playKnifeChop();
    else if (tool === "CRANK_JUICER") soundFx.playJuicerCrank();
    else if (tool === "IRON_MORTAR") soundFx.playMortarGrind();
    else soundFx.playWaterFilter();
  };

  // 清空台面重配
  const handleResetWorkbench = () => {
    soundFx.playCaliperTick();
    setToolSlots({
      PEEL_BOARD: null,
      CRANK_JUICER: null,
      IRON_MORTAR: null,
      CHARCOAL_FILTER: null,
    });
    setPreparedTray([]);
    setGlassItems([]);
    setIsMixed(false);
    setIsShaking(false);
    setPourStyle("standard");
  };

  // 将原材料放置到指定加工器具（第 1 道工序）
  const placeRawOnTool = (ingId: IngredientId, targetTool?: BartendToolId) => {
    if (alreadyServedThisTurn) {
      flashHint("本轮已上过酒");
      return;
    }
    if (glassItems.length >= 3 && isMixed) {
      flashHint("杯中已调好，请先上酒或清空重配");
      return;
    }
    if (getAvailableRaw(ingId) <= 0) {
      flashHint(`${INGREDIENTS[ingId].name} 库存不足`);
      return;
    }
    const chain = INGREDIENT_PREP_CHAIN[ingId];
    const firstTool = chain.steps[0].tool;
    const chosenTool = targetTool || firstTool;
    if (chosenTool !== firstTool) {
      flashHint(`需先用「${BARTEND_TOOL_META[firstTool].name}」处理`);
      return;
    }
    if (toolSlots[firstTool]) {
      flashHint(`${BARTEND_TOOL_META[firstTool].name} 正在占用中`);
      return;
    }

    soundFx.playCaliperTick();
    setToolSlots((prev) => ({
      ...prev,
      [firstTool]: {
        uid: makeLocalId(),
        ingredientId: ingId,
        stageIndex: 0,
        clicksDone: 0,
        readyToAdvance: false,
      },
    }));
  };

  // 将已完成第 1 道工序的半成品转移到第 2 道工序器具
  const transferIntermediateToNextTool = (fromTool: BartendToolId) => {
    const slot = toolSlots[fromTool];
    if (!slot || !slot.readyToAdvance) return;
    const chain = INGREDIENT_PREP_CHAIN[slot.ingredientId];
    const nextStep = chain.steps[slot.stageIndex + 1];
    if (!nextStep) return;

    if (toolSlots[nextStep.tool]) {
      flashHint(`${BARTEND_TOOL_META[nextStep.tool].name} 正在占用中`);
      return;
    }

    soundFx.playCaliperTick();
    setToolSlots((prev) => ({
      ...prev,
      [fromTool]: null,
      [nextStep.tool]: {
        uid: slot.uid,
        ingredientId: slot.ingredientId,
        stageIndex: slot.stageIndex + 1,
        clicksDone: 0,
        readyToAdvance: false,
      },
    }));
  };

  // 点击正在载有物料的器具进行加工（削皮 / 压榨 / 研磨 / 滴滤）
  const handleOperateTool = (tool: BartendToolId) => {
    const slot = toolSlots[tool];
    if (!slot) return;

    if (slot.readyToAdvance) {
      transferIntermediateToNextTool(tool);
      return;
    }

    const chain = INGREDIENT_PREP_CHAIN[slot.ingredientId];
    const stepSpec = chain.steps[slot.stageIndex];
    const nextClicks = slot.clicksDone + 1;

    playToolSfx(tool);
    setToolPulse((prev) => ({ ...prev, [tool]: prev[tool] + 1 }));

    if (nextClicks < stepSpec.clicks) {
      setToolSlots((prev) => ({
        ...prev,
        [tool]: {
          ...slot,
          clicksDone: nextClicks,
        },
      }));
      return;
    }

    // 当前工序完成：检查是否还有第 2 道工序
    const hasNextStage = slot.stageIndex + 1 < chain.steps.length;
    if (hasNextStage) {
      const nextTool = chain.steps[slot.stageIndex + 1].tool;
      if (!toolSlots[nextTool]) {
        // 若下一台器具空闲，直接流转过去方便继续操作
        setToolSlots((prev) => ({
          ...prev,
          [tool]: null,
          [nextTool]: {
            uid: slot.uid,
            ingredientId: slot.ingredientId,
            stageIndex: slot.stageIndex + 1,
            clicksDone: 0,
            readyToAdvance: false,
          },
        }));
      } else {
        setToolSlots((prev) => ({
          ...prev,
          [tool]: {
            ...slot,
            clicksDone: nextClicks,
            readyToAdvance: true,
          },
        }));
      }
      return;
    }

    // 全部加工完成 → 送入备料碟（待倒入酒杯）
    setToolSlots((prev) => ({ ...prev, [tool]: null }));
    setPreparedTray((prev) => [
      ...prev,
      {
        uid: slot.uid,
        ingredientId: slot.ingredientId,
        label: chain.preparedLabel,
      },
    ]);
  };

  // 将备好的调酒材料倒入中央互动酒杯
  const pourPreparedIntoGlass = (shotUid?: string) => {
    if (glassItems.length >= 3) {
      flashHint("酒杯已满三层，请点击右侧摇酒壶混调");
      return;
    }
    const target = shotUid
      ? preparedTray.find((s) => s.uid === shotUid)
      : preparedTray[0];
    if (!target) return;

    soundFx.playPourDrink();
    setPreparedTray((prev) => prev.filter((s) => s.uid !== target.uid));
    setGlassItems((prev) => [...prev, target.ingredientId]);
    setGlassPulse((p) => p + 1);
    setIsMixed(false);
  };

  // 摇壶混调
  const handleShakeMix = () => {
    if (glassItems.length < 3 || isShaking || isMixed) return;
    soundFx.playShakerMix();
    setIsShaking(true);
    window.setTimeout(() => {
      setIsShaking(false);
      setIsMixed(true);
    }, 520);
  };

  // 配方书「一键制作」
  const handleQuickCraftPreset = (preset: DrinkRecipePreset) => {
    if (alreadyServedThisTurn) {
      flashHint("本轮已上过酒");
      return;
    }
    if (!canCraftPreset(preset)) {
      flashHint("原料库存不足，无法一键调制");
      return;
    }
    setIsBookOpen(false);
    setPinnedPreset(preset);
    setToolSlots({
      PEEL_BOARD: null,
      CRANK_JUICER: null,
      IRON_MORTAR: null,
      CHARCOAL_FILTER: null,
    });
    setPreparedTray([]);
    setPourStyle("standard");
    setGlassItems([...preset.ingredients]);
    setGlassPulse((p) => p + 1);
    soundFx.playPourDrink();
    setIsShaking(true);
    window.setTimeout(() => {
      soundFx.playShakerMix();
    }, 160);
    window.setTimeout(() => {
      setIsShaking(false);
      setIsMixed(true);
    }, 560);
  };

  // 根据杯中材料层数选择对应的手绘酒杯状态素材
  const currentGlassSprite = useMemo(() => {
    if (glassItems.length === 0) return ARTWORK_ASSETS.propGlassEmpty;
    if (glassItems.length === 1) return ARTWORK_ASSETS.propGlassFillBase;
    if (glassItems.length === 2) return ARTWORK_ASSETS.propGlassFillMid;
    return ARTWORK_ASSETS.propGlassFillFull;
  }, [glassItems.length]);

  const selectedBookPreset = useMemo(
    () =>
      DRINK_PRESETS.find((p) => p.id === selectedPresetId) || DRINK_PRESETS[0],
    [selectedPresetId]
  );

  const canConfirmServe =
    Boolean(craftedDrink) &&
    isMixed &&
    !alreadyServedThisTurn &&
    !isLoadingAi &&
    !hasPendingOffer &&
    !pourStyleMissing;

  // 判断某台工具是否为当前拖拽物料的有效放置点
  const isToolValidDropTarget = (tool: BartendToolId): boolean => {
    if (!dragPayload || toolSlots[tool]) return false;
    if (dragPayload.kind === "RAW") {
      return (
        INGREDIENT_PREP_CHAIN[dragPayload.ingredientId].steps[0].tool === tool
      );
    }
    if (dragPayload.kind === "INTERMEDIATE") {
      const fromSlot = toolSlots[dragPayload.fromTool];
      if (!fromSlot || !fromSlot.readyToAdvance) return false;
      const nextStep =
        INGREDIENT_PREP_CHAIN[fromSlot.ingredientId].steps[
          fromSlot.stageIndex + 1
        ];
      return nextStep?.tool === tool;
    }
    return false;
  };

  return (
    <div className="fixed inset-0 z-50 w-screen h-screen overflow-hidden select-none bg-[#0D0906] text-[#F3EAE0] flex flex-col">
      {/* 独立废土调酒台木纹与钨丝暖光场景背景 */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <ArtworkImage
          src={ARTWORK_ASSETS.bartendStationBg}
          alt="酒馆独立调酒台"
          className="w-full h-full object-cover object-center"
          tone="warm"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A0705]/52 via-transparent to-[#090604]/78" />
      </div>

      {/* 极简顶栏：返回吧台 · 置顶配方微标（可选） · 清空台面 */}
      <header className="relative z-20 flex items-center justify-between gap-4 px-5 sm:px-8 py-3.5 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              soundFx.playCaliperLock();
              onClose();
            }}
            className="px-3.5 py-1.5 rounded border border-[#C88A4B]/55 bg-[#160F0A]/90 hover:bg-[#261A11] text-xs sm:text-sm font-medium text-[#FDF5EB] flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-lg"
          >
            <ArrowLeft className="w-4 h-4 text-[#E59A3C]" />
            <span>返回吧台</span>
          </button>
          <span className="hidden sm:inline text-xs text-[#D6BFA9]/75">
            待客 · {patronName}
          </span>
        </div>

        {/* 若在配方书中点击了「按谱手调」，在此静默显示三步进度 */}
        {pinnedPreset && (
          <div className="hidden md:flex items-center gap-3 px-3.5 py-1 rounded border border-[#E59A3C]/40 bg-[#17100B]/88 text-xs">
            <span className="font-display font-bold text-[#F7D7A8]">
              《{pinnedPreset.name}》
            </span>
            <span className="text-[#8C7765]">·</span>
            <div className="flex items-center gap-2.5">
              {pinnedPreset.ingredients.map((ingId, idx) => {
                const matched = glassItems[idx] === ingId;
                return (
                  <span
                    key={`${ingId}_${idx}`}
                    className={`flex items-center gap-1 whitespace-nowrap ${
                      matched ? "text-[#4ADE80]" : "text-[#D6BFA9]/80"
                    }`}
                  >
                    {matched && <Check className="w-3 h-3" />}
                    <span>
                      {idx + 1}.{INGREDIENTS[ingId].name}
                    </span>
                  </span>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setPinnedPreset(null)}
              className="text-[#9E8874] hover:text-[#FDF5EB] ml-1 cursor-pointer"
              aria-label="取消置顶配方"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          {statusHint && (
            <span className="text-xs text-[#F7D7A8] bg-[#24160D]/90 border border-[#E59A3C]/45 px-2.5 py-1 rounded whitespace-nowrap">
              {statusHint}
            </span>
          )}
          <button
            type="button"
            onClick={handleResetWorkbench}
            disabled={
              glassItems.length === 0 &&
              preparedTray.length === 0 &&
              TOOL_ORDER.every((t) => !toolSlots[t])
            }
            className="px-3 py-1.5 rounded border border-[#F5D096]/22 bg-[#160F0A]/85 hover:border-[#E59A3C]/55 disabled:opacity-35 text-xs text-[#E3CEB9] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#E59A3C]" />
            <span>清空重配</span>
          </button>
        </div>
      </header>

      {/* 主操作区：左侧冷藏原材列 + 中央宽幅实木调酒桌面（四大器具 + 中央酒杯摇壶 + 右上配方谱） */}
      <main className="relative z-10 flex-1 min-h-0 px-4 sm:px-8 pb-4 flex flex-col lg:flex-row gap-5 items-stretch max-w-[1520px] w-full mx-auto">
        {/* 左侧：冷藏原材架（支持点击直接上台，或拖拽至对应器具） */}
        <aside className="lg:w-[196px] shrink-0 flex lg:flex-col justify-center gap-2 overflow-x-auto lg:overflow-y-auto py-1">
          {INGREDIENT_LIST.map((ing) => {
            const avail = getAvailableRaw(ing.id);
            const chain = INGREDIENT_PREP_CHAIN[ing.id];
            const firstToolName = BARTEND_TOOL_META[chain.steps[0].tool].name;
            return (
              <WastelandTooltip
                key={ing.id}
                title={ing.name}
                subtitle={`可用 ×${avail} · 首步：${firstToolName}`}
                description={`工序：${chain.shortStepSummary}\n风味：${ing.flavorTags.join(" / ")}`}
              >
                <div
                  draggable={avail > 0 && !alreadyServedThisTurn}
                  onDragStart={(e) => {
                    if (avail <= 0) return;
                    e.dataTransfer.effectAllowed = "move";
                    setDragPayload({ kind: "RAW", ingredientId: ing.id });
                  }}
                  onDragEnd={() => setDragPayload(null)}
                  onClick={() => placeRawOnTool(ing.id)}
                  className={`group shrink-0 w-[124px] lg:w-full rounded-md border px-2.5 py-2 flex items-center gap-2.5 transition-all ${
                    avail <= 0
                      ? "border-[#F5D096]/10 bg-[#120C08]/65 opacity-45 cursor-not-allowed"
                      : "border-[#C88A4B]/38 bg-[#17100A]/86 hover:bg-[#251910] hover:border-[#E59A3C] cursor-grab active:cursor-grabbing shadow-md"
                  }`}
                >
                  <div className="relative w-11 h-11 rounded overflow-hidden border border-[#F5D096]/22 bg-[#0B0806] shrink-0">
                    <ArtworkImage
                      src={ing.imageUrl}
                      alt={ing.name}
                      className="w-full h-full object-cover"
                      tone="warm"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[#FAF0E6] truncate">
                      {ing.name}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-[#C9A882] mt-0.5">
                      <span className="font-mono-num font-bold text-[#E59A3C]">
                        ×{avail}
                      </span>
                      <span className="text-[10px] text-[#9E8874] truncate">
                        {BARTEND_TOOL_META[chain.steps[0].tool].shortVerb}
                      </span>
                    </div>
                  </div>
                </div>
              </WastelandTooltip>
            );
          })}
        </aside>

        {/* 中央实木工作台：上层四器具与配方书 · 下层备料碟 + 互动酒杯 + 黄铜雪克壶 */}
        <div className="flex-1 min-h-0 flex flex-col justify-between gap-3 py-1">
          {/* 上排：四大加工器具 + 右侧皮革配方书 */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-5 items-end pt-1">
            {TOOL_ORDER.map((toolId) => {
              const meta = BARTEND_TOOL_META[toolId];
              const slot = toolSlots[toolId];
              const isDropValid = isToolValidDropTarget(toolId);
              const chain = slot
                ? INGREDIENT_PREP_CHAIN[slot.ingredientId]
                : null;
              const stepSpec =
                slot && chain ? chain.steps[slot.stageIndex] : null;
              const nextToolMeta =
                slot?.readyToAdvance && chain
                  ? BARTEND_TOOL_META[chain.steps[slot.stageIndex + 1].tool]
                  : null;

              return (
                <WastelandTooltip
                  key={toolId}
                  title={meta.name}
                  subtitle={meta.shortVerb}
                  description={meta.hint}
                >
                  <div
                    onDragOver={(e) => {
                      if (isDropValid) {
                        e.preventDefault();
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (!dragPayload) return;
                      if (dragPayload.kind === "RAW") {
                        placeRawOnTool(dragPayload.ingredientId, toolId);
                      } else if (dragPayload.kind === "INTERMEDIATE") {
                        const fromSlot = toolSlots[dragPayload.fromTool];
                        if (fromSlot) {
                          const next =
                            INGREDIENT_PREP_CHAIN[fromSlot.ingredientId].steps[
                              fromSlot.stageIndex + 1
                            ];
                          if (next?.tool === toolId) {
                            transferIntermediateToNextTool(
                              dragPayload.fromTool
                            );
                          }
                        }
                      }
                      setDragPayload(null);
                    }}
                    onClick={() => {
                      if (slot) {
                        handleOperateTool(toolId);
                      }
                    }}
                    className={`relative flex flex-col items-center justify-end p-2 rounded-xl transition-all ${
                      isDropValid
                        ? "ring-2 ring-[#E59A3C] bg-[#E59A3C]/12 scale-[1.03]"
                        : slot
                        ? "cursor-pointer hover:scale-[1.03]"
                        : "opacity-92 hover:opacity-100"
                    }`}
                  >
                    {/* 器具贴图本体 */}
                    <motion.div
                      key={`${toolId}_${toolPulse[toolId]}`}
                      animate={
                        toolPulse[toolId] > 0
                          ? toolId === "PEEL_BOARD"
                            ? { rotate: [0, -6, 4, 0], y: [0, 3, 0] }
                            : toolId === "CRANK_JUICER"
                            ? { rotate: [0, 5, -4, 0], scale: [1, 1.05, 1] }
                            : toolId === "IRON_MORTAR"
                            ? { y: [0, 7, -2, 0], scale: [1, 0.96, 1] }
                            : { scale: [1, 1.04, 1] }
                          : {}
                      }
                      transition={{ duration: 0.18 }}
                      className="w-24 h-24 sm:w-30 sm:h-30 xl:w-34 xl:h-34 flex items-center justify-center"
                    >
                      <CutoutSprite
                        src={meta.imageUrl}
                        alt={meta.name}
                        cropMode="all"
                        className="w-full h-full object-contain drop-shadow-[0_14px_22px_rgba(0,0,0,0.88)]"
                      />
                    </motion.div>

                    {/* 若器具上有在制物料：浮现物料缩略章与点击进度 */}
                    {slot && stepSpec && (
                      <div
                        draggable={slot.readyToAdvance}
                        onDragStart={(e) => {
                          if (!slot.readyToAdvance) return;
                          e.stopPropagation();
                          setDragPayload({
                            kind: "INTERMEDIATE",
                            fromTool: toolId,
                          });
                        }}
                        onDragEnd={() => setDragPayload(null)}
                        className="absolute -top-1 right-1 sm:right-2 flex items-center gap-1.5 px-2 py-1 rounded border border-[#E59A3C] bg-[#18100A]/95 shadow-lg"
                      >
                        <div className="w-6 h-6 rounded-xs overflow-hidden border border-[#F5D096]/35 shrink-0">
                          <ArtworkImage
                            src={INGREDIENTS[slot.ingredientId].imageUrl}
                            alt={INGREDIENTS[slot.ingredientId].name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="font-mono-num text-[11px] font-bold text-[#F7D7A8] whitespace-nowrap">
                          {slot.readyToAdvance && nextToolMeta
                            ? `移至${nextToolMeta.shortVerb}`
                            : `${stepSpec.verb} ${slot.clicksDone}/${stepSpec.clicks}`}
                        </span>
                      </div>
                    )}

                    {/* 器具底座克制微标 */}
                    <span
                      className={`mt-1 text-xs font-medium tracking-wide whitespace-nowrap ${
                        slot ? "text-[#F7D7A8] font-bold" : "text-[#D6BFA9]/80"
                      }`}
                    >
                      {slot && stepSpec
                        ? slot.readyToAdvance && nextToolMeta
                          ? `点击送往${nextToolMeta.name}`
                          : `点击${stepSpec.verb}`
                        : meta.name}
                    </span>
                  </div>
                </WastelandTooltip>
              );
            })}

            {/* 第 5 席位：皮革装帧《调酒配方书》 */}
            <div className="col-span-2 sm:col-span-1 flex flex-col items-center justify-end p-2">
              <button
                type="button"
                onClick={() => {
                  soundFx.playPaperRustle();
                  setIsBookOpen(true);
                }}
                className="group flex flex-col items-center cursor-pointer focus:outline-none"
              >
                <div className="w-24 h-24 sm:w-28 sm:h-28 xl:w-32 xl:h-32 flex items-center justify-center">
                  <CutoutSprite
                    src={ARTWORK_ASSETS.propRecipeCodex}
                    alt="调酒配方书"
                    cropMode="all"
                    className="w-full h-full object-contain drop-shadow-[0_14px_22px_rgba(0,0,0,0.9)] group-hover:-translate-y-1.5 group-hover:scale-[1.04] transition-transform duration-200"
                  />
                </div>
                <span className="mt-1 px-2.5 py-0.5 rounded border border-[#C88A4B]/50 bg-[#18100A]/88 text-xs font-display font-bold text-[#F7D7A8] group-hover:border-[#E59A3C] flex items-center gap-1 whitespace-nowrap">
                  <BookOpen className="w-3 h-3 text-[#E59A3C]" />
                  <span>配方谱</span>
                </span>
              </button>
            </div>
          </div>

          {/* 下排核心焦点：左备料碟 · 中央可互动分阶段酒杯 · 右黄铜雪克摇酒壶 */}
          <div className="flex-1 min-h-0 flex flex-col justify-end">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center py-1">
              {/* 左：已加工待入杯备料碟 */}
              <div className="md:col-span-4 flex flex-col items-center md:items-end justify-center gap-2">
                {preparedTray.length > 0 && (
                  <div className="flex flex-wrap items-center justify-center md:justify-end gap-2.5">
                    {preparedTray.map((shot) => (
                      <motion.button
                        key={shot.uid}
                        type="button"
                        initial={{ opacity: 0, scale: 0.88, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        draggable
                        onDragStart={() =>
                          setDragPayload({ kind: "PREPARED", uid: shot.uid })
                        }
                        onDragEnd={() => setDragPayload(null)}
                        onClick={() => pourPreparedIntoGlass(shot.uid)}
                        title="拖入酒杯或点击倒入酒杯"
                        className="group px-3 py-2 rounded-lg border border-[#E59A3C]/75 bg-[#1B120B]/92 hover:bg-[#2A1C12] shadow-[0_10px_24px_rgba(0,0,0,0.85)] flex items-center gap-2.5 cursor-grab active:cursor-grabbing"
                      >
                        <div className="w-9 h-9 rounded-full overflow-hidden border border-[#E59A3C] shrink-0">
                          <ArtworkImage
                            src={INGREDIENTS[shot.ingredientId].imageUrl}
                            alt={shot.label}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="text-left">
                          <span className="block text-xs font-bold text-[#FDF5EB] whitespace-nowrap">
                            {shot.label}
                          </span>
                          <span className="block text-[10px] text-[#E59A3C] whitespace-nowrap">
                            点击或拖入酒杯 →
                          </span>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>

              {/* 中央焦点：可互动分阶段酒杯（0空杯 / 1底层原浆 / 2双色旋流 / 3满杯待摇） */}
              <div className="md:col-span-4 flex flex-col items-center justify-center">
                <div
                  onDragOver={(e) => {
                    if (
                      dragPayload?.kind === "PREPARED" &&
                      glassItems.length < 3
                    ) {
                      e.preventDefault();
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragPayload?.kind === "PREPARED") {
                      pourPreparedIntoGlass(dragPayload.uid);
                    }
                    setDragPayload(null);
                  }}
                  onClick={() => {
                    if (preparedTray.length > 0 && glassItems.length < 3) {
                      pourPreparedIntoGlass(preparedTray[0].uid);
                    } else if (glassItems.length === 3 && !isMixed) {
                      handleShakeMix();
                    }
                  }}
                  className={`relative flex flex-col items-center justify-center p-2 rounded-2xl transition-all ${
                    dragPayload?.kind === "PREPARED" && glassItems.length < 3
                      ? "ring-2 ring-[#E59A3C] bg-[#E59A3C]/12 scale-105"
                      : preparedTray.length > 0 && glassItems.length < 3
                      ? "cursor-pointer hover:scale-[1.03]"
                      : glassItems.length === 3 && !isMixed
                      ? "cursor-pointer"
                      : ""
                  }`}
                >
                  {/* 底座黄铜杯垫 */}
                  <img
                    src={ARTWORK_ASSETS.propBrassCoaster}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    className="absolute bottom-1 w-44 sm:w-52 h-16 object-contain opacity-90 pointer-events-none"
                  />

                  {/* 酒杯分阶段实体贴图 */}
                  <motion.div
                    key={`glass_${glassItems.length}_${glassPulse}_${
                      isMixed ? "mixed" : "raw"
                    }`}
                    animate={
                      isShaking
                        ? {
                            x: [0, -10, 10, -8, 8, -4, 0],
                            rotate: [0, -5, 5, -4, 4, 0],
                          }
                        : { scale: [0.95, 1.03, 1], y: [4, -2, 0] }
                    }
                    transition={{ duration: isShaking ? 0.48 : 0.22 }}
                    className="relative z-10 w-36 h-36 sm:w-44 sm:h-44 xl:w-48 xl:h-48 flex items-center justify-center mb-3"
                  >
                    <CutoutSprite
                      src={currentGlassSprite}
                      alt="互动调酒杯"
                      cropMode="all"
                      className="w-full h-full object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.95)]"
                    />
                  </motion.div>

                  {/* 杯内三层材料微标 */}
                  <div className="relative z-20 flex items-center gap-2 mt-1">
                    {[0, 1, 2].map((idx) => {
                      const ingId = glassItems[idx];
                      return (
                        <div
                          key={idx}
                          className={`w-7 h-7 rounded-full border flex items-center justify-center overflow-hidden ${
                            ingId
                              ? "border-[#E59A3C] bg-[#160F0A]"
                              : "border-[#F5D096]/25 bg-[#120C08]/75"
                          }`}
                          title={
                            ingId
                              ? INGREDIENTS[ingId].name
                              : `第 ${idx + 1} 层待注入`
                          }
                        >
                          {ingId ? (
                            <ArtworkImage
                              src={INGREDIENTS[ingId].imageUrl}
                              alt={INGREDIENTS[ingId].name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="font-mono-num text-[10px] text-[#8C7765]">
                              {idx + 1}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 右：黄铜摇酒混调壶（满三层后激活摇匀） */}
              <div className="md:col-span-4 flex flex-col items-center md:items-start justify-center">
                {glassItems.length === 3 && !isMixed && (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, x: 10 }}
                    animate={
                      isShaking
                        ? {
                            opacity: 1,
                            x: [0, -8, 9, -7, 7, 0],
                            rotate: [0, -10, 10, -8, 8, 0],
                          }
                        : { opacity: 1, x: 0 }
                    }
                    transition={{ duration: isShaking ? 0.48 : 0.2 }}
                    onClick={handleShakeMix}
                    className="group flex items-center gap-3 px-4 py-2.5 rounded-xl border border-[#E59A3C] bg-[#22160D]/92 hover:bg-[#312014] shadow-[0_12px_30px_rgba(0,0,0,0.9)] cursor-pointer"
                  >
                    <img
                      src={ARTWORK_ASSETS.propShakerCooler}
                      alt="摇酒混调"
                      draggable={false}
                      className="w-16 h-16 object-contain group-hover:scale-105 transition-transform"
                    />
                    <div className="text-left">
                      <span className="block font-display text-sm font-bold text-[#FDF5EB] whitespace-nowrap">
                        点击摇匀成酒
                      </span>
                      <span className="block text-xs text-[#E59A3C] whitespace-nowrap">
                        融合三层风味
                      </span>
                    </div>
                  </motion.button>
                )}

                {isMixed && craftedDrink && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-[#C88A4B]/55 bg-[#17100A]/90 shadow-xl"
                  >
                    <div className="w-14 h-14 rounded-lg border border-[#E59A3C]/65 overflow-hidden shrink-0 bg-[#0B0806]">
                      <ArtworkImage
                        src={craftedDrink.imageUrl}
                        alt={craftedDrink.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-display text-sm sm:text-base font-bold text-[#FDF5EB] whitespace-nowrap">
                          《{craftedDrink.name}》
                        </span>
                        <span className="font-mono-num text-xs font-bold text-[#E59A3C] whitespace-nowrap">
                          {craftedDrink.suggestedPrice} 盖
                        </span>
                      </div>
                      <p className="font-mono-num text-xs text-[#C9A882] mt-0.5 whitespace-nowrap">
                        烈 {craftedDrink.potency} · 抚 {craftedDrink.soothing} · 净{" "}
                        {craftedDrink.purification}
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* 底栏：上酒控制托盘（保留 掺水 / 正常 / 多倒半杯 三档份量调节与上酒按钮） */}
            <div className="mt-1 min-h-[62px] flex items-center justify-center">
              {isMixed && craftedDrink ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full max-w-[860px] rounded-xl border border-[#C88A4B]/55 bg-[#150E09]/94 px-4 py-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.92)] flex flex-wrap items-center justify-between gap-3"
                >
                  {/* 掺水 / 正常 / 多倒半杯 */}
                  <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0D0805] border border-[#F5D096]/15">
                    {(
                      [
                        { id: "watered" as const, label: "掺水" },
                        { id: "standard" as const, label: "正常" },
                        { id: "generous" as const, label: "多倒半杯" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          soundFx.playCaliperTick();
                          setPourStyle(opt.id);
                        }}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                          pourStyle === opt.id
                            ? "bg-[#E59A3C] text-[#1B1410] font-bold"
                            : "text-[#C9A882] hover:text-[#FDF5EB]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* 选填短附言 */}
                  <input
                    type="text"
                    value={serveNote}
                    onChange={(e) => setServeNote(e.target.value)}
                    placeholder="递酒附言（选填）"
                    className="flex-1 min-w-[150px] rounded border border-[#F5D096]/18 bg-[#0C0805] px-3 py-1.5 text-xs text-[#FAF0E6] placeholder:text-[#7D6A59] focus:outline-none focus:border-[#E59A3C]"
                  />

                  {/* 缺料提示或上酒主按钮 */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    {pourStyleMissing && (
                      <span className="text-xs text-[#FCA5A5] whitespace-nowrap">
                        {pourStyleMissing}
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={!canConfirmServe}
                      onClick={() => {
                        if (!craftedDrink) return;
                        soundFx.playPourDrink();
                        onServeDrink(craftedDrink, serveNote.trim());
                      }}
                      className="px-5 py-2 rounded-lg bg-[#E59A3C] hover:bg-[#F0A84B] disabled:opacity-35 text-[#1B1410] text-xs sm:text-sm font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>
                        {alreadyServedThisTurn
                          ? "本轮已上酒"
                          : `上酒 · 《${craftedDrink.name}》`}
                      </span>
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="text-xs text-[#C9A882]/70 tracking-wide text-center">
                  {glassItems.length === 0 && preparedTray.length === 0
                    ? "取左侧原材至器具加工，制好后入杯（或打开右上「配方谱」）"
                    : glassItems.length < 3
                    ? `已注入 ${glassItems.length} / 3 层调酒材料`
                    : "点击右侧摇酒壶混调"}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ==================== 摊开的《废土调酒配方书》 ==================== */}
      {isBookOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 sm:p-8"
          onClick={() => setIsBookOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[860px] rounded-xl border-2 border-[#8C6239] overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.95)] text-[#24170C]"
          >
            {/* 泛黄羊皮纸摊开底图 */}
            <div className="absolute inset-0 z-0 pointer-events-none">
              <ArtworkImage
                src={ARTWORK_ASSETS.journalSpreadBg}
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-[#EAD6B3]/82" />
            </div>

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 min-h-[430px]">
              {/* 左页：酒品名录 */}
              <div className="md:col-span-5 p-5 sm:p-6 border-b md:border-b-0 md:border-r border-[#8C6843]/35 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[#8C6843]/30 pb-2">
                    <h3 className="font-display text-lg font-bold text-[#1E130A]">
                      零号酒馆配方谱
                    </h3>
                    <span className="font-mono-num text-xs text-[#6E5036]">
                      5 款招牌
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {DRINK_PRESETS.map((preset) => {
                      const selected = preset.id === selectedBookPreset.id;
                      const craftable = canCraftPreset(preset);
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            soundFx.playPaperRustle();
                            setSelectedPresetId(preset.id);
                          }}
                          className={`w-full px-3 py-2.5 rounded-md border flex items-center gap-3 text-left transition-colors cursor-pointer ${
                            selected
                              ? "border-[#5C3A1E] bg-[#D5B98B] shadow-xs"
                              : "border-transparent hover:bg-[#DFC69D]/65"
                          }`}
                        >
                          <div className="w-10 h-10 rounded border border-[#6E5036]/45 overflow-hidden shrink-0">
                            <ArtworkImage
                              src={preset.imageUrl}
                              alt={preset.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-display text-sm font-bold text-[#1E130A] truncate">
                                {preset.name}
                              </span>
                              <span className="font-mono-num text-xs font-bold text-[#7A3E12] shrink-0">
                                {preset.suggestedPrice} 盖
                              </span>
                            </div>
                            <p className="text-[11px] text-[#5C4026] truncate mt-0.5">
                              {preset.flavorNotes.join(" · ")}
                              {!craftable ? " · 缺料" : ""}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <p className="text-[11px] text-[#6E5036]">
                  注：任意三份已加工材料混调均可制成私房混酿。
                </p>
              </div>

              {/* 右页：选中酒品的制作步骤 + 按谱手调 / 一键制作 */}
              <div className="md:col-span-7 p-5 sm:p-7 flex flex-col justify-between gap-5">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <div className="w-16 h-16 rounded-lg border-2 border-[#6E4E2E] overflow-hidden shrink-0 shadow-md">
                        <ArtworkImage
                          src={selectedBookPreset.imageUrl}
                          alt={selectedBookPreset.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <h4 className="font-display text-xl font-bold text-[#1E130A]">
                          《{selectedBookPreset.name}》
                        </h4>
                        <p className="text-xs text-[#5C4026] mt-0.5">
                          {selectedBookPreset.flavorNotes.join(" · ")} · 售价{" "}
                          {selectedBookPreset.suggestedPrice} 盖
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsBookOpen(false)}
                      className="p-1.5 rounded hover:bg-[#D5B98B] text-[#5C4026] cursor-pointer"
                      aria-label="合上配方谱"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 三步工序明细 */}
                  <div className="space-y-2.5 pt-2 border-t border-[#8C6843]/30">
                    {selectedBookPreset.ingredients.map((ingId, idx) => {
                      const ing = INGREDIENTS[ingId];
                      const chain = INGREDIENT_PREP_CHAIN[ingId];
                      const haveCount = inventory[ingId] || 0;
                      const neededTotal = selectedBookPreset.ingredients.filter(
                        (x) => x === ingId
                      ).length;
                      const enough = haveCount >= neededTotal;

                      return (
                        <div
                          key={`${ingId}_${idx}`}
                          className="flex items-center justify-between gap-3 px-3 py-2 rounded border border-[#8C6843]/30 bg-[#E2CAA0]/65"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="font-mono-num text-xs font-bold text-[#7A3E12] shrink-0">
                              0{idx + 1}.
                            </span>
                            <div className="w-8 h-8 rounded overflow-hidden border border-[#6E5036]/40 shrink-0">
                              <ArtworkImage
                                src={ing.imageUrl}
                                alt={ing.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <span className="block text-xs font-bold text-[#1E130A] truncate">
                                {ing.name}
                              </span>
                              <span className="block text-[11px] text-[#5C4026] truncate">
                                {chain.shortStepSummary}
                              </span>
                            </div>
                          </div>

                          <span
                            className={`font-mono-num text-xs font-bold shrink-0 ${
                              enough ? "text-[#1E5631]" : "text-[#9E2A22]"
                            }`}
                          >
                            存 {haveCount}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 底部双操作：按谱手调 vs 一键制作 */}
                <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-[#8C6843]/30">
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playPaperRustle();
                      setPinnedPreset(selectedBookPreset);
                      setIsBookOpen(false);
                    }}
                    className="px-4 py-2 rounded-md border border-[#5C3A1E] bg-transparent hover:bg-[#D5B98B] text-xs sm:text-sm font-semibold text-[#24170C] whitespace-nowrap cursor-pointer"
                  >
                    按谱手调
                  </button>

                  <button
                    type="button"
                    disabled={
                      !canCraftPreset(selectedBookPreset) ||
                      alreadyServedThisTurn
                    }
                    onClick={() => handleQuickCraftPreset(selectedBookPreset)}
                    className="px-5 py-2 rounded-md bg-[#2A190E] hover:bg-[#3D2515] disabled:opacity-40 text-xs sm:text-sm font-bold text-[#FAF0E6] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-[#E59A3C]" />
                    <span>
                      {canCraftPreset(selectedBookPreset)
                        ? "一键制作"
                        : "原料不足"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
