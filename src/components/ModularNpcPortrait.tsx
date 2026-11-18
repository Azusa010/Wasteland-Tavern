import React from "react";
import { ModularAvatarParts } from "../types/game";
import { CutoutSprite } from "./CutoutSprite";

interface ModularNpcPortraitProps {
  parts: ModularAvatarParts;
  name?: string;
  trust?: number;
  tension?: number;
  className?: string;
}

export interface SomatotypePoolDef {
  id: "BURLY" | "STANDARD" | "SLENDER";
  label: string;
  shortLabel: string;
  bodies: readonly { src: string; name: string }[];
  heads: readonly { src: string; name: string }[];
}

/**
 * 三大体型严谨分池配置：
 * 每个体型池拥有专属匹配肩宽与领口比例的躯干服装贴图 + 面孔头部贴图，杜绝大头小身或比例违和
 */
export const SOMATOTYPE_POOLS: readonly SomatotypePoolDef[] = [
  {
    id: "BURLY",
    label: "魁梧壮硕体型",
    shortLabel: "壮硕",
    bodies: [
      {
        src: "/assets/npcs/modular/burly_body_0.png",
        name: "重装液压动力胸挂",
      },
      {
        src: "/assets/npcs/modular/burly_body_1.png",
        name: "轮胎护肩格斗背心",
      },
      {
        src: "/assets/npcs/modular/burly_body_2.png",
        name: "黑铁锻造重皮围裙",
      },
      {
        src: "/assets/npcs/modular/burly_body_3.png",
        name: "核冬弹链加厚棉甲",
      },
    ],
    heads: [
      {
        src: "/assets/npcs/modular/burly_head_0.png",
        name: "钢铁面罩重装壮汉",
      },
      {
        src: "/assets/npcs/modular/burly_head_1.png",
        name: "银髻爽朗掌炉大婶",
      },
      {
        src: "/assets/npcs/modular/burly_head_2.png",
        name: "独眼八字胡老佣兵",
      },
      {
        src: "/assets/npcs/modular/burly_head_3.png",
        name: "寸头烟熏铁匠硬汉",
      },
    ],
  },
  {
    id: "STANDARD",
    label: "匀称精悍体型",
    shortLabel: "标准",
    bodies: [
      {
        src: "/assets/npcs/modular/body_0.png",
        name: "铆钉皮夹克与红巾",
      },
      {
        src: "/assets/npcs/modular/body_1.png",
        name: "防辐工程服与滤罐",
      },
      {
        src: "/assets/npcs/modular/body_2.png",
        name: "补丁荒原帆布斗篷",
      },
      {
        src: "/assets/npcs/modular/body_3.png",
        name: "铁片护肩兽毛战甲",
      },
    ],
    heads: [
      {
        src: "/assets/npcs/modular/head_0.png",
        name: "刀疤沧桑硬汉",
      },
      {
        src: "/assets/npcs/modular/head_1.png",
        name: "荒原女游骑兵",
      },
      {
        src: "/assets/npcs/modular/head_2.png",
        name: "琥珀义眼老兵",
      },
      {
        src: "/assets/npcs/modular/head_3.png",
        name: "圆框铜镜信使",
      },
      {
        src: "/assets/npcs/modular/head_4.png",
        name: "暗红沙巾游牧客",
      },
    ],
  },
  {
    id: "SLENDER",
    label: "清瘦纤细体型",
    shortLabel: "纤细",
    bodies: [
      {
        src: "/assets/npcs/modular/slender_body_0.png",
        name: "避难所蓝金修身服",
      },
      {
        src: "/assets/npcs/modular/slender_body_1.png",
        name: "迷彩光学斥候披肩",
      },
      {
        src: "/assets/npcs/modular/slender_body_2.png",
        name: "战地义诊白大褂",
      },
      {
        src: "/assets/npcs/modular/slender_body_3.png",
        name: "废土朋克尖刺短甲",
      },
    ],
    heads: [
      {
        src: "/assets/npcs/modular/slender_head_0.png",
        name: "短发唇疤女斥候",
      },
      {
        src: "/assets/npcs/modular/slender_head_1.png",
        name: "单镜清癯老军医",
      },
      {
        src: "/assets/npcs/modular/slender_head_2.png",
        name: "红发侧剃朋克少女",
      },
      {
        src: "/assets/npcs/modular/slender_head_3.png",
        name: "银发神经端口档案员",
      },
    ],
  },
] as const;

const BACK_GEAR_LAYERS: readonly { src: string | null; name: string }[] = [
  { src: "/assets/npcs/modular/back_0.png", name: "焊工高压气瓶" },
  { src: "/assets/npcs/modular/back_1.png", name: "废铁瞄准长步枪" },
  { src: "/assets/npcs/modular/back_2.png", name: "短波电台背架" },
  { src: "/assets/npcs/modular/back_3.png", name: "勘探铁镐睡袋" },
  { src: "/assets/npcs/modular/back_4.png", name: "荧光菌菇采药篓" },
  { src: "/assets/npcs/modular/back_5.png", name: "交叉砍刀短管猎枪" },
  { src: null, name: "轻装无背具" },
];

const HAT_HEADGEAR_LAYERS: readonly { src: string | null; name: string }[] = [
  { src: "/assets/npcs/modular/hat_0.png", name: "宽檐废土皮帽" },
  { src: "/assets/npcs/modular/hat_1.png", name: "护目镜旧钢盔" },
  { src: "/assets/npcs/modular/hat_2.png", name: "辐射探照棒球帽" },
  { src: "/assets/npcs/modular/hat_3.png", name: "废铁尖刺头箍" },
  { src: null, name: "原生荒原发型" },
];

// 仅作用于服装、背具与帽具图层的废土旧化染洗滤镜（保持面孔肤色自然纯净）
const COAT_DYE_FILTERS: readonly { className: string; name: string }[] = [
  { className: "npc-dye-0", name: "焦褐原色皮蜡" },
  { className: "npc-dye-1", name: "核冬灰绿涂层" },
  { className: "npc-dye-2", name: "暗铁烟熏油蜡" },
  { className: "npc-dye-3", name: "锈金琥珀旧染" },
  { className: "npc-dye-4", name: "避难所冷灰褐" },
];

export const MODULAR_PART_LABELS = {
  bodyBuild: SOMATOTYPE_POOLS.map((p) => p.label),
  backGear: BACK_GEAR_LAYERS.map((b) => b.name),
  headgear: HAT_HEADGEAR_LAYERS.map((h) => h.name),
  paletteIndex: COAT_DYE_FILTERS.map((c) => c.name),
} as const;

export function resolveModularSelection(parts: ModularAvatarParts) {
  const buildIdx =
    Math.abs(parts.bodyBuild ?? parts.neckwear ?? 1) % SOMATOTYPE_POOLS.length;
  const pool = SOMATOTYPE_POOLS[buildIdx];

  const bodyIdx = Math.abs(parts.coatStyle) % pool.bodies.length;
  const headIdx = Math.abs(parts.faceShape) % pool.heads.length;
  const backIdx = Math.abs(parts.backGear) % BACK_GEAR_LAYERS.length;
  const rawHatIdx = Math.abs(parts.headgear) % HAT_HEADGEAR_LAYERS.length;
  const dyeIdx = Math.abs(parts.paletteIndex) % COAT_DYE_FILTERS.length;

  // 解剖与头型兼容保护：
  // 1) 标准体型第5张脸（暗红沙巾游牧兜帽）自带完整包头风帽，仅可叠戴宽檐皮帽或保持原生风帽
  // 2) 壮硕体型第2张脸（高盘银髻大婶）盘发高耸，跳过压发钢盔/棒球帽以防穿模
  let effectiveHat = HAT_HEADGEAR_LAYERS[rawHatIdx];
  if (buildIdx === 1 && headIdx === 4 && rawHatIdx !== 0 && rawHatIdx !== 4) {
    effectiveHat = { src: null, name: "游牧包头风帽" };
  } else if (
    buildIdx === 0 &&
    headIdx === 1 &&
    (rawHatIdx === 1 || rawHatIdx === 2)
  ) {
    effectiveHat = { src: null, name: "高盘银白发髻" };
  }

  return {
    buildIdx,
    headIdx,
    pool,
    body: pool.bodies[bodyIdx],
    head: pool.heads[headIdx],
    back: BACK_GEAR_LAYERS[backIdx],
    hat: effectiveHat,
    dye: COAT_DYE_FILTERS[dyeIdx],
  };
}

const COAT_DYE_FILTER_VALUES: readonly string[] = [
  "none",
  "hue-rotate(14deg) saturate(0.88) brightness(0.96)",
  "hue-rotate(-10deg) saturate(0.84) contrast(1.04) brightness(0.93)",
  "sepia(0.18) saturate(1.08) brightness(1.02)",
  "hue-rotate(24deg) saturate(0.76) brightness(0.95)",
];

interface HeadRigProfile {
  dy: number;
  chinX: number;
  chinY: number;
  jawLeftX: number;
  jawLeftY: number;
  jawRightX: number;
  jawRightY: number;
  hairLeftMaxX?: number;
  hairLeftMaxY?: number;
  hairRightMinX?: number;
  hairRightMaxY?: number;
  skinSample?: readonly [number, number];
  isClothHood?: boolean;
}

interface BodyRigProfile {
  eraseMannequin?: { x1: number; y1: number; x2: number; y2: number };
  eraseMannequinDarkDashes?: { x1: number; y1: number; x2: number; y2: number };
  backArchCenterY: number;
  backArchSideY: number;
  backArchHalfW: number;
  outerNeckHalfW: number;
  neckExtendToY: number;
  neckFadeRange: readonly [number, number];
  cavityMaxLuma: number;
  cavityBox: readonly [number, number, number, number];
  innerSkinFadeRange?: readonly [number, number];
  innerSkinHalfW?: number;
  harmonizeSkin?: boolean;
}

const CANVAS_W = 600;
const CANVAS_H = 800;

/**
 * 13 张面孔精确下颌线/双下巴/垂发保护区轮廓（600x800 原始像素坐标）：
 * 将面孔图层精准拆分为：
 * - Plane 4（下颌骨墨线以上 + 两侧垂发）：位于衣领前上方，完整保留下巴与发丝轮廓
 * - Plane 2（下颌骨以下的颈柱与斜方肌）：收束进衣领开口内部并被前衣领/背带自然遮挡
 */
const HEAD_RIG_PROFILES: Record<string, HeadRigProfile> = {
  burly_head_0: {
    dy: 24,
    chinX: 300,
    chinY: 329,
    jawLeftX: 212,
    jawLeftY: 286,
    jawRightX: 388,
    jawRightY: 286,
    skinSample: [300, 170],
  },
  burly_head_1: {
    dy: 22,
    chinX: 324,
    chinY: 335,
    jawLeftX: 232,
    jawLeftY: 282,
    jawRightX: 392,
    jawRightY: 296,
    hairLeftMaxX: 225,
    hairLeftMaxY: 294,
    hairRightMinX: 394,
    hairRightMaxY: 296,
    skinSample: [310, 200],
  },
  burly_head_2: {
    dy: 24,
    chinX: 304,
    chinY: 329,
    jawLeftX: 216,
    jawLeftY: 286,
    jawRightX: 388,
    jawRightY: 288,
    skinSample: [310, 175],
  },
  burly_head_3: {
    dy: 24,
    chinX: 310,
    chinY: 329,
    jawLeftX: 222,
    jawLeftY: 286,
    jawRightX: 384,
    jawRightY: 288,
    skinSample: [305, 180],
  },

  head_0: {
    dy: 18,
    chinX: 314,
    chinY: 316,
    jawLeftX: 238,
    jawLeftY: 276,
    jawRightX: 368,
    jawRightY: 280,
    skinSample: [310, 185],
  },
  head_1: {
    dy: 18,
    chinX: 316,
    chinY: 307,
    jawLeftX: 250,
    jawLeftY: 272,
    jawRightX: 360,
    jawRightY: 276,
    hairLeftMaxX: 246,
    hairLeftMaxY: 322,
    skinSample: [315, 200],
  },
  head_2: {
    dy: 18,
    chinX: 316,
    chinY: 319,
    jawLeftX: 238,
    jawLeftY: 278,
    jawRightX: 374,
    jawRightY: 284,
    skinSample: [305, 175],
  },
  head_3: {
    dy: 18,
    chinX: 314,
    chinY: 306,
    jawLeftX: 246,
    jawLeftY: 272,
    jawRightX: 360,
    jawRightY: 276,
    skinSample: [310, 195],
  },
  head_4: {
    dy: 18,
    chinX: 304,
    chinY: 320,
    jawLeftX: 210,
    jawLeftY: 292,
    jawRightX: 404,
    jawRightY: 294,
    isClothHood: true,
  },

  slender_head_0: {
    dy: 20,
    chinX: 300,
    chinY: 314,
    jawLeftX: 256,
    jawLeftY: 282,
    jawRightX: 344,
    jawRightY: 282,
    hairLeftMaxX: 263,
    hairLeftMaxY: 332,
    hairRightMinX: 339,
    hairRightMaxY: 322,
    skinSample: [300, 215],
  },
  slender_head_1: {
    dy: 20,
    chinX: 300,
    chinY: 326,
    jawLeftX: 254,
    jawLeftY: 288,
    jawRightX: 346,
    jawRightY: 288,
    hairLeftMaxX: 257,
    hairLeftMaxY: 308,
    skinSample: [300, 190],
  },
  slender_head_2: {
    dy: 20,
    chinX: 310,
    chinY: 315,
    jawLeftX: 266,
    jawLeftY: 280,
    jawRightX: 354,
    jawRightY: 282,
    hairLeftMaxX: 266,
    hairLeftMaxY: 344,
    skinSample: [310, 210],
  },
  slender_head_3: {
    dy: 20,
    chinX: 300,
    chinY: 314,
    jawLeftX: 256,
    jawLeftY: 280,
    jawRightX: 344,
    jawRightY: 280,
    skinSample: [300, 215],
  },
};

/**
 * 12 套躯干领口精确三维遮挡配置（600x800 像素坐标）：
 * 区分后领口弧线、领内深色空腔、假人颈口残线清理、颈根向下延展补洞与前翻领/背带/围巾遮挡
 */
const BODY_RIG_PROFILES: Record<string, BodyRigProfile> = {
  burly_body_0: {
    backArchCenterY: 334,
    backArchSideY: 318,
    backArchHalfW: 76,
    outerNeckHalfW: 72,
    neckExtendToY: 414,
    neckFadeRange: [402, 418],
    cavityMaxLuma: 22,
    cavityBox: [222, 305, 378, 412],
  },
  burly_body_1: {
    backArchCenterY: 298,
    backArchSideY: 282,
    backArchHalfW: 68,
    outerNeckHalfW: 66,
    neckExtendToY: 392,
    neckFadeRange: [362, 392],
    cavityMaxLuma: 22,
    cavityBox: [230, 278, 370, 376],
    innerSkinFadeRange: [360, 392],
    innerSkinHalfW: 48,
    harmonizeSkin: true,
  },
  burly_body_2: {
    backArchCenterY: 304,
    backArchSideY: 286,
    backArchHalfW: 64,
    outerNeckHalfW: 62,
    neckExtendToY: 392,
    neckFadeRange: [364, 392],
    cavityMaxLuma: 20,
    cavityBox: [234, 260, 366, 362],
    innerSkinFadeRange: [352, 386],
    innerSkinHalfW: 44,
    harmonizeSkin: true,
  },
  burly_body_3: {
    backArchCenterY: 298,
    backArchSideY: 278,
    backArchHalfW: 66,
    outerNeckHalfW: 64,
    neckExtendToY: 400,
    neckFadeRange: [388, 404],
    cavityMaxLuma: 22,
    cavityBox: [234, 290, 366, 396],
  },

  body_0: {
    backArchCenterY: 318,
    backArchSideY: 292,
    backArchHalfW: 52,
    outerNeckHalfW: 52,
    neckExtendToY: 356,
    neckFadeRange: [342, 360],
    cavityMaxLuma: 22,
    cavityBox: [244, 304, 350, 342],
  },
  body_1: {
    backArchCenterY: 320,
    backArchSideY: 300,
    backArchHalfW: 50,
    outerNeckHalfW: 50,
    neckExtendToY: 366,
    neckFadeRange: [352, 368],
    cavityMaxLuma: 22,
    cavityBox: [252, 312, 348, 356],
  },
  body_2: {
    backArchCenterY: 304,
    backArchSideY: 286,
    backArchHalfW: 42,
    outerNeckHalfW: 46,
    neckExtendToY: 344,
    neckFadeRange: [330, 348],
    cavityMaxLuma: 22,
    cavityBox: [266, 294, 334, 334],
  },
  body_3: {
    backArchCenterY: 306,
    backArchSideY: 288,
    backArchHalfW: 58,
    outerNeckHalfW: 56,
    neckExtendToY: 414,
    neckFadeRange: [398, 416],
    cavityMaxLuma: 22,
    cavityBox: [242, 296, 358, 412],
  },

  slender_body_0: {
    eraseMannequin: { x1: 254, y1: 306, x2: 346, y2: 336 },
    backArchCenterY: 334,
    backArchSideY: 322,
    backArchHalfW: 48,
    outerNeckHalfW: 48,
    neckExtendToY: 388,
    neckFadeRange: [358, 388],
    cavityMaxLuma: -1,
    cavityBox: [0, 0, 0, 0],
    innerSkinFadeRange: [340, 386],
    innerSkinHalfW: 42,
    harmonizeSkin: true,
  },
  slender_body_1: {
    eraseMannequin: { x1: 256, y1: 281, x2: 344, y2: 298 },
    backArchCenterY: 298,
    backArchSideY: 284,
    backArchHalfW: 48,
    outerNeckHalfW: 48,
    neckExtendToY: 378,
    neckFadeRange: [364, 380],
    cavityMaxLuma: -1,
    cavityBox: [0, 0, 0, 0],
    harmonizeSkin: true,
  },
  slender_body_2: {
    backArchCenterY: 294,
    backArchSideY: 282,
    backArchHalfW: 46,
    outerNeckHalfW: 46,
    neckExtendToY: 376,
    neckFadeRange: [362, 378],
    cavityMaxLuma: -1,
    cavityBox: [0, 0, 0, 0],
  },
  slender_body_3: {
    eraseMannequin: { x1: 254, y1: 288, x2: 348, y2: 315 },
    eraseMannequinDarkDashes: { x1: 260, y1: 372, x2: 342, y2: 381 },
    backArchCenterY: 320,
    backArchSideY: 312,
    backArchHalfW: 52,
    outerNeckHalfW: 54,
    neckExtendToY: 404,
    neckFadeRange: [382, 406],
    cavityMaxLuma: -1,
    cavityBox: [0, 0, 0, 0],
    innerSkinFadeRange: [378, 404],
    innerSkinHalfW: 46,
    harmonizeSkin: true,
  },
};

const modularImgCache = new Map<string, Promise<HTMLImageElement>>();
const modularPixelsCache = new Map<string, Uint8ClampedArray>();
const modularCompositeUrlCache = new Map<string, string>();
const modularCompositeInflight = new Map<string, Promise<string>>();

function extractAssetKey(src: string): string {
  const file = src.split("/").pop() || "";
  return file.replace(".png", "");
}

function loadModularImage(src: string): Promise<HTMLImageElement> {
  const cached = modularImgCache.get(src);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
  modularImgCache.set(src, promise);
  return promise;
}

async function getModularPixels(
  src: string,
  filterCss = "none"
): Promise<Uint8ClampedArray> {
  const key = `${src}|${filterCss}`;
  const cached = modularPixelsCache.get(key);
  if (cached) return cached;

  const img = await loadModularImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Canvas 2D context unavailable");
  }
  if (filterCss && filterCss !== "none") {
    ctx.filter = filterCss;
  }
  ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
  const data = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H).data;
  modularPixelsCache.set(key, data);
  return data;
}

function blendRgba(
  dst: Uint8ClampedArray,
  idx: number,
  r: number,
  g: number,
  b: number,
  a: number
) {
  if (a <= 0) return;
  const sa = a / 255;
  const da = dst[idx + 3] / 255;
  const outA = sa + da * (1 - sa);
  if (outA <= 0.001) return;
  dst[idx] = Math.round((r * sa + dst[idx] * da * (1 - sa)) / outA);
  dst[idx + 1] = Math.round((g * sa + dst[idx + 1] * da * (1 - sa)) / outA);
  dst[idx + 2] = Math.round((b * sa + dst[idx + 2] * da * (1 - sa)) / outA);
  dst[idx + 3] = Math.round(outA * 255);
}

function getHeadPlane4AlphaFactor(
  hx: number,
  hy: number,
  hp: HeadRigProfile
): number {
  if (
    hp.hairLeftMaxX !== undefined &&
    hp.hairLeftMaxY !== undefined &&
    hx <= hp.hairLeftMaxX &&
    hy <= hp.hairLeftMaxY
  ) {
    return 1;
  }
  if (
    hp.hairRightMinX !== undefined &&
    hp.hairRightMaxY !== undefined &&
    hx >= hp.hairRightMinX &&
    hy <= hp.hairRightMaxY
  ) {
    return 1;
  }

  if (hx <= hp.jawLeftX) {
    if (hy <= hp.jawLeftY - 1.5) return 1;
    if (hy >= hp.jawLeftY + 1.5) return 0;
    return 1 - (hy - (hp.jawLeftY - 1.5)) / 3;
  }
  if (hx >= hp.jawRightX) {
    if (hy <= hp.jawRightY - 1.5) return 1;
    if (hy >= hp.jawRightY + 1.5) return 0;
    return 1 - (hy - (hp.jawRightY - 1.5)) / 3;
  }

  let jawY: number;
  if (hx <= hp.chinX) {
    const t = (hp.chinX - hx) / Math.max(1, hp.chinX - hp.jawLeftX);
    jawY = hp.chinY - (hp.chinY - hp.jawLeftY) * t * t;
  } else {
    const t = (hx - hp.chinX) / Math.max(1, hp.jawRightX - hp.chinX);
    jawY = hp.chinY - (hp.chinY - hp.jawRightY) * t * t;
  }
  if (hy <= jawY - 1.0) return 1;
  if (hy >= jawY + 2.0) return 0;
  return 1 - (hy - (jawY - 1.0)) / 3.0;
}

function isBodySkinPixel(
  bodyKey: string,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number
): boolean {
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  if (luma < 85) return false;
  if (r <= g + 10 || g <= b + 8 || r <= b + 28) return false;
  if (r - g > 76) return false;

  if (bodyKey === "burly_body_2") {
    return (
      (x >= 255 && x <= 345 && y >= 335 && y <= 395) ||
      ((x < 135 || x > 465) && y > 560)
    );
  }
  if (bodyKey === "burly_body_1") {
    return (
      (x >= 245 && x <= 355 && y >= 340 && y <= 440) ||
      ((x < 155 || x > 445) && y > 370)
    );
  }
  if (bodyKey === "slender_body_0") {
    return x >= 262 && x <= 338 && y >= 320 && y <= 465;
  }
  if (bodyKey === "slender_body_1") {
    return (x < 175 || x > 425) && y > 500 && y < 670;
  }
  if (bodyKey === "slender_body_3") {
    return (
      (x >= 252 && x <= 348 && y >= 372 && y <= 425) ||
      ((x < 190 || x > 410) && y > 495 && y < 680)
    );
  }
  return false;
}

async function buildCompositedModularUrl(
  resolved: ReturnType<typeof resolveModularSelection>
): Promise<string> {
  const dyeIdx = COAT_DYE_FILTERS.findIndex(
    (d) => d.className === resolved.dye.className
  );
  const filterCss = COAT_DYE_FILTER_VALUES[Math.max(0, dyeIdx)] || "none";
  const cacheKey = `${resolved.back.src || "none"}|${resolved.body.src}|${
    resolved.head.src
  }|${resolved.hat.src || "none"}|${filterCss}`;

  const hit = modularCompositeUrlCache.get(cacheKey);
  if (hit) return hit;

  const inflight = modularCompositeInflight.get(cacheKey);
  if (inflight) return inflight;

  const task = (async () => {
    const bodyKey = extractAssetKey(resolved.body.src);
    const headKey = extractAssetKey(resolved.head.src);
    const bp = BODY_RIG_PROFILES[bodyKey] || BODY_RIG_PROFILES.body_0;
    const hp = HEAD_RIG_PROFILES[headKey] || HEAD_RIG_PROFILES.head_0;

    const [backData, bodyRawData, bodyDyedData, headData, hatData] =
      await Promise.all([
        resolved.back.src
          ? getModularPixels(resolved.back.src, filterCss)
          : Promise.resolve(null),
        getModularPixels(resolved.body.src, "none"),
        filterCss === "none"
          ? getModularPixels(resolved.body.src, "none")
          : getModularPixels(resolved.body.src, filterCss),
        getModularPixels(resolved.head.src, "none"),
        resolved.hat.src
          ? getModularPixels(resolved.hat.src, filterCss)
          : Promise.resolve(null),
      ]);

    const out = new Uint8ClampedArray(CANVAS_W * CANVAS_H * 4);

    // 采样头部真实肤色以协调锁骨/小臂肤色（避免苍白义体头配暖橘色锁骨或染洗偏色）
    let headSkin: [number, number, number] | null = null;
    if (hp.skinSample) {
      const [sx, sy] = hp.skinSample;
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let cnt = 0;
      for (let oy = -6; oy <= 6; oy += 3) {
        for (let ox = -6; ox <= 6; ox += 3) {
          const si = ((sy + oy) * CANVAS_W + (sx + ox)) * 4;
          if (headData[si + 3] > 200 && headData[si] > 90) {
            sr += headData[si];
            sg += headData[si + 1];
            sb += headData[si + 2];
            cnt++;
          }
        }
      }
      if (cnt > 0) {
        headSkin = [sr / cnt, sg / cnt, sb / cnt];
      }
    }

    // 拷贝经服饰旧化滤镜处理后的躯干，并还原/协调裸露皮肤区（不让衣物染色污染小臂与锁骨肤色）
    const bodyClean = new Uint8ClampedArray(bodyDyedData);
    if (bp.eraseMannequinDarkDashes) {
      const { x1, y1, x2, y2 } = bp.eraseMannequinDarkDashes;
      for (let y = y1; y <= y2; y++) {
        for (let x = x1; x <= x2; x++) {
          const i = (y * CANVAS_W + x) * 4;
          const luma =
            0.299 * bodyRawData[i] +
            0.587 * bodyRawData[i + 1] +
            0.114 * bodyRawData[i + 2];
          if (luma < 55) {
            bodyClean[i + 3] = 0;
          }
        }
      }
    }
    if (bp.eraseMannequin) {
      const { x1, y1, x2, y2 } = bp.eraseMannequin;
      for (let y = y1; y <= y2; y++) {
        for (let x = x1; x <= x2; x++) {
          bodyClean[(y * CANVAS_W + x) * 4 + 3] = 0;
        }
      }
    }

    if (bp.harmonizeSkin) {
      const refLuma = 0.299 * 236 + 0.587 * 184 + 0.114 * 144;
      const headLuma = headSkin
        ? Math.max(
            1,
            0.299 * headSkin[0] + 0.587 * headSkin[1] + 0.114 * headSkin[2]
          )
        : refLuma;
      const scaleR = headSkin ? headSkin[0] / headLuma / (236 / refLuma) : 1;
      const scaleG = headSkin ? headSkin[1] / headLuma / (184 / refLuma) : 1;
      const scaleB = headSkin ? headSkin[2] / headLuma / (144 / refLuma) : 1;
      const lumaGain = headSkin
        ? Math.max(0.82, Math.min(1.12, headLuma / refLuma))
        : 1;
      const mix = headSkin ? 0.78 : 0;

      for (let y = 315; y < CANVAS_H; y++) {
        for (let x = 0; x < CANVAS_W; x++) {
          const i = (y * CANVAS_W + x) * 4;
          if (bodyClean[i + 3] < 40) continue;
          const rr = bodyRawData[i];
          const rg = bodyRawData[i + 1];
          const rb = bodyRawData[i + 2];
          if (!isBodySkinPixel(bodyKey, x, y, rr, rg, rb)) continue;
          bodyClean[i] = Math.min(
            255,
            Math.round(rr * (1 - mix + mix * scaleR * lumaGain))
          );
          bodyClean[i + 1] = Math.min(
            255,
            Math.round(rg * (1 - mix + mix * scaleG * lumaGain))
          );
          bodyClean[i + 2] = Math.min(
            255,
            Math.round(rb * (1 - mix + mix * scaleB * lumaGain))
          );
        }
      }
    }

    // Plane 0: 背部装备
    if (backData) {
      for (let i = 0; i < CANVAS_W * CANVAS_H * 4; i += 4) {
        blendRgba(
          out,
          i,
          backData[i],
          backData[i + 1],
          backData[i + 2],
          backData[i + 3]
        );
      }
    }

    // Plane 1: 躯干底层（包含后衣领内壁、双肩与胸腹）
    for (let i = 0; i < CANVAS_W * CANVAS_H * 4; i += 4) {
      blendRgba(
        out,
        i,
        bodyClean[i],
        bodyClean[i + 1],
        bodyClean[i + 2],
        bodyClean[i + 3]
      );
    }

    // 提取颈底横向肤色截面，供深 V 领或原透明颈洞平滑向下延伸填充
    const dy = hp.dy;
    const neckSampleY = headKey.startsWith("burly")
      ? 352
      : headKey.startsWith("slender")
      ? 340
      : 336;
    const neckRowRgb: Array<[number, number, number] | null> = new Array(
      CANVAS_W
    ).fill(null);
    let fallbackSkin: [number, number, number] = headSkin
      ? [
          Math.round(headSkin[0]),
          Math.round(headSkin[1]),
          Math.round(headSkin[2]),
        ]
      : [195, 138, 102];

    for (let sx = 280; sx <= 320; sx += 4) {
      const si = (neckSampleY * CANVAS_W + sx) * 4;
      if (headData[si + 3] > 180) {
        fallbackSkin = [headData[si], headData[si + 1], headData[si + 2]];
        break;
      }
    }

    let validMinX = 300;
    let validMaxX = 300;
    for (let x = 220; x <= 380; x++) {
      const si = (neckSampleY * CANVAS_W + x) * 4;
      if (
        headData[si + 3] > 160 &&
        (headData[si] > 28 || headData[si + 1] > 24)
      ) {
        neckRowRgb[x] = [headData[si], headData[si + 1], headData[si + 2]];
        if (x < validMinX) validMinX = x;
        if (x > validMaxX) validMaxX = x;
      }
    }

    // Plane 2: 颈柱层（两侧收束进衣领宽度内，杜绝斜方肌压穿翻领/背带；深领口自动向下延伸填补空洞）
    const maxNeckSrcY = headKey.startsWith("burly")
      ? 356
      : headKey.startsWith("slender")
      ? 343
      : hp.isClothHood
      ? 348
      : 339;
    const extStartDstY = maxNeckSrcY + dy;
    const extEndDstY = bp.neckExtendToY;
    const maxHalfW = bp.outerNeckHalfW;
    const [fadeStart, fadeEnd] = bp.neckFadeRange;

    for (let y = Math.max(0, 240 + dy); y <= extEndDstY; y++) {
      const hy = y - dy;
      let vertMask = 1;
      if (y > fadeStart) {
        vertMask = Math.max(
          0,
          1 - (y - fadeStart) / Math.max(1, fadeEnd - fadeStart)
        );
      }

      for (let x = 300 - maxHalfW - 8; x <= 300 + maxHalfW + 8; x++) {
        const absDx = Math.abs(x - 300);
        if (absDx > maxHalfW + 6) continue;
        let horizMask = 1;
        if (absDx > maxHalfW - 4) {
          horizMask = Math.max(0, 1 - (absDx - (maxHalfW - 4)) / 10);
        }

        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;

        if (hy >= 0 && hy <= maxNeckSrcY) {
          const hi = (hy * CANVAS_W + x) * 4;
          a = headData[hi + 3];
          if (a === 0) continue;
          r = headData[hi];
          g = headData[hi + 1];
          b = headData[hi + 2];
        } else if (hy > maxNeckSrcY && !hp.isClothHood) {
          const baseHalfW = headKey.startsWith("burly")
            ? 56
            : headKey.startsWith("slender")
            ? 40
            : 46;
          const depthT = Math.min(
            1,
            (y - extStartDstY) / Math.max(12, extEndDstY - extStartDstY)
          );
          const colHalfW = Math.min(maxHalfW, baseHalfW + depthT * 16);
          if (absDx > colHalfW + 4) continue;
          const colMask =
            absDx > colHalfW - 4
              ? Math.max(0, 1 - (absDx - (colHalfW - 4)) / 8)
              : 1;
          const normX = (x - 300) / Math.max(1, colHalfW);
          const mappedX = Math.round(
            300 + normX * ((validMaxX - validMinX) * 0.45)
          );
          const clampedX = Math.max(
            validMinX + 2,
            Math.min(validMaxX - 2, mappedX)
          );
          const base = neckRowRgb[clampedX] || fallbackSkin;
          const shade = 1 - 0.2 * depthT;
          r = Math.round(base[0] * shade);
          g = Math.round(base[1] * shade);
          b = Math.round(base[2] * shade);
          a = Math.round(255 * colMask);
        } else {
          continue;
        }

        const finalA = Math.round(a * horizMask * vertMask);
        if (finalA > 0) {
          blendRgba(out, (y * CANVAS_W + x) * 4, r, g, b, finalA);
        }
      }
    }

    // Plane 3: 前衣领 / 翻领 / 背带 / 围巾 / 护喉甲真实遮挡层（精确压在颈柱之上、下巴之下）
    const [cx1, cy1, cx2, cy2] = bp.cavityBox;
    for (let y = bp.backArchSideY; y <= 440; y++) {
      for (let x = 160; x <= 440; x++) {
        const bi = (y * CANVAS_W + x) * 4;
        const ba = bodyClean[bi + 3];
        if (ba < 16) continue;
        const br = bodyClean[bi];
        const bg = bodyClean[bi + 1];
        const bb = bodyClean[bi + 2];

        const dxNorm = (x - 300) / bp.backArchHalfW;
        if (Math.abs(dxNorm) < 1.0) {
          const archY =
            bp.backArchCenterY -
            (bp.backArchCenterY - bp.backArchSideY) * dxNorm * dxNorm;
          if (y < archY) continue;
        }

        if (
          bp.cavityMaxLuma > 0 &&
          x >= cx1 &&
          x <= cx2 &&
          y >= cy1 &&
          y <= cy2
        ) {
          const luma = 0.299 * br + 0.587 * bg + 0.114 * bb;
          if (luma <= bp.cavityMaxLuma) continue;
          if (luma <= bp.cavityMaxLuma + 18) {
            const rimFactor = (luma - bp.cavityMaxLuma) / 18;
            blendRgba(out, bi, br, bg, bb, Math.round(ba * rimFactor));
            continue;
          }
        }

        if (
          bp.innerSkinFadeRange &&
          bp.innerSkinHalfW !== undefined &&
          Math.abs(x - 300) <= bp.innerSkinHalfW
        ) {
          if (
            isBodySkinPixel(
              bodyKey,
              x,
              y,
              bodyRawData[bi],
              bodyRawData[bi + 1],
              bodyRawData[bi + 2]
            )
          ) {
            const [s0, s1] = bp.innerSkinFadeRange;
            if (y <= s0) continue;
            if (y < s1) {
              const sf = (y - s0) / (s1 - s0);
              blendRgba(out, bi, br, bg, bb, Math.round(ba * sf));
              continue;
            }
          }
        }

        blendRgba(out, bi, br, bg, bb, ba);
      }
    }

    // Plane 4: 头部主体、下颌轮廓线、胡须与两侧垂发（完整位于后衣领与高围巾前上方）
    for (let hy = 0; hy < CANVAS_H; hy++) {
      const y = hy + dy;
      if (y < 0 || y >= CANVAS_H) continue;
      for (let x = 0; x < CANVAS_W; x++) {
        const hi = (hy * CANVAS_W + x) * 4;
        const ha = headData[hi + 3];
        if (ha === 0) continue;
        const p4 = getHeadPlane4AlphaFactor(x, hy, hp);
        if (p4 <= 0.001) continue;
        blendRgba(
          out,
          (y * CANVAS_W + x) * 4,
          headData[hi],
          headData[hi + 1],
          headData[hi + 2],
          Math.round(ha * p4)
        );
      }
    }

    // Plane 5: 帽具/头盔（按三大体型颅宽自适应微缩对齐）
    if (hatData) {
      const hatScaleX = headKey.startsWith("burly")
        ? 1.07
        : headKey.startsWith("slender")
        ? 0.95
        : 1.0;
      const hatScaleY = headKey.startsWith("burly")
        ? 1.03
        : headKey.startsWith("slender")
        ? 0.97
        : 1.0;
      const pivotX = 300;
      const pivotY = 175;
      for (let y = 0; y < 380; y++) {
        const hy = Math.round((y - dy - pivotY) / hatScaleY + pivotY);
        if (hy < 0 || hy >= CANVAS_H) continue;
        for (let x = 100; x < 500; x++) {
          const hx = Math.round((x - pivotX) / hatScaleX + pivotX);
          if (hx < 0 || hx >= CANVAS_W) continue;
          const hi = (hy * CANVAS_W + hx) * 4;
          if (hatData[hi + 3] === 0) continue;
          blendRgba(
            out,
            (y * CANVAS_W + x) * 4,
            hatData[hi],
            hatData[hi + 1],
            hatData[hi + 2],
            hatData[hi + 3]
          );
        }
      }
    }

    const outCanvas = document.createElement("canvas");
    outCanvas.width = CANVAS_W;
    outCanvas.height = CANVAS_H;
    const outCtx = outCanvas.getContext("2d");
    if (!outCtx) {
      throw new Error("Output canvas context unavailable");
    }
    const outImageData = outCtx.createImageData(CANVAS_W, CANVAS_H);
    outImageData.data.set(out);
    outCtx.putImageData(outImageData, 0, 0);

    const url = await new Promise<string>((resolveUrl) => {
      outCanvas.toBlob((blob) => {
        if (blob) {
          resolveUrl(URL.createObjectURL(blob));
        } else {
          resolveUrl(outCanvas.toDataURL("image/png"));
        }
      }, "image/png");
    });

    modularCompositeUrlCache.set(cacheKey, url);
    modularCompositeInflight.delete(cacheKey);
    return url;
  })();

  modularCompositeInflight.set(cacheKey, task);
  return task;
}

const CompositedModularTorso: React.FC<{
  resolved: ReturnType<typeof resolveModularSelection>;
  alt: string;
}> = ({ resolved, alt }) => {
  const dyeIdx = COAT_DYE_FILTERS.findIndex(
    (d) => d.className === resolved.dye.className
  );
  const filterCss = COAT_DYE_FILTER_VALUES[Math.max(0, dyeIdx)] || "none";
  const cacheKey = `${resolved.back.src || "none"}|${resolved.body.src}|${
    resolved.head.src
  }|${resolved.hat.src || "none"}|${filterCss}`;

  const [compositedUrl, setCompositedUrl] = React.useState<string | null>(
    () => modularCompositeUrlCache.get(cacheKey) || null
  );

  React.useEffect(() => {
    let cancelled = false;
    const immediate = modularCompositeUrlCache.get(cacheKey);
    if (immediate) {
      setCompositedUrl(immediate);
      return;
    }
    buildCompositedModularUrl(resolved)
      .then((url) => {
        if (!cancelled) {
          setCompositedUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCompositedUrl(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [cacheKey, resolved]);

  if (!compositedUrl) {
    return <div className="w-full h-full" aria-hidden="true" />;
  }

  return (
    <img
      src={compositedUrl}
      alt={alt}
      draggable={false}
      className="absolute inset-0 w-full h-full object-contain object-bottom"
    />
  );
};

/**
 * 基于手绘透明抠图 PNG 素材与像素级六平面解剖合成引擎（背具 + 躯干后领 + 收束延展颈柱 + 前翻领/背带遮挡 + 下巴垂发前景 + 自适应帽具）
 * 彻底消除脖子压穿翻领、水平硬切痕、假人颈圈残影与肤色断层
 */
export const ModularNpcPortrait: React.FC<ModularNpcPortraitProps> = ({
  parts,
  name = "废土过客",
  tension = 25,
  className = "",
}) => {
  const resolved = resolveModularSelection(parts);
  const isHighTension = tension >= 68;

  return (
    <div
      role="img"
      aria-label={`${name}手绘拼接立绘`}
      className={`relative w-full h-full flex items-end justify-center select-none pointer-events-none ${
        isHighTension ? "brightness-[0.97] contrast-[1.05]" : ""
      } ${className}`}
    >
      <div className="relative h-full aspect-[3/4] max-w-full mx-auto">
        <CompositedModularTorso resolved={resolved} alt={name} />
      </div>
    </div>
  );
};

export const MODULAR_COMBAT_LEGS_BY_BUILD = [
  "/src/assets/images/modular_legs_burly_1794970582181.jpg",
  "/src/assets/images/modular_legs_standard_1794970584055.jpg",
  "/src/assets/images/modular_legs_slender_1794970585502.jpg",
] as const;

/**
 * 普通散客全身模块化战斗拼装立绘（像素级无缝上半身 + 体型匹配战靴绑腿）
 */
export const ModularNpcCombatSprite: React.FC<{
  parts: ModularAvatarParts;
  name?: string;
  flipHorizontal?: boolean;
  className?: string;
}> = ({ parts, name = "助战同伴", flipHorizontal = false, className = "" }) => {
  const resolved = resolveModularSelection(parts);
  const dyeClass = resolved.dye.className;
  const legsSrc =
    MODULAR_COMBAT_LEGS_BY_BUILD[resolved.buildIdx] ||
    MODULAR_COMBAT_LEGS_BY_BUILD[1];

  const legsWidthClass =
    resolved.buildIdx === 0
      ? "w-[86%]"
      : resolved.buildIdx === 2
      ? "w-[74%]"
      : "w-[80%]";

  return (
    <div
      role="img"
      aria-label={`${name}全身模块化战斗立绘`}
      className={`relative aspect-[5/9] select-none pointer-events-none flex items-end justify-center ${
        flipHorizontal ? "-scale-x-100" : ""
      } ${className}`}
    >
      {/* 下半身：匹配体型池的腰带、战术裤、护膝与重型战靴 */}
      <div
        className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-[54%] ${legsWidthClass} flex items-end justify-center ${dyeClass}`}
      >
        <CutoutSprite
          src={legsSrc}
          alt=""
          className="w-full h-full object-contain object-bottom"
        />
      </div>

      {/* 上半身：像素级六平面无缝合成躯干与头脸 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[58%]">
        <div className="relative w-full h-full">
          <CompositedModularTorso resolved={resolved} alt={name} />
        </div>
      </div>
    </div>
  );
};

export function describeModularParts(parts: ModularAvatarParts): string {
  const r = resolveModularSelection(parts);
  return `${r.pool.label} · ${r.body.name} · ${r.head.name} · ${r.hat.name} · ${r.back.name}`;
}
