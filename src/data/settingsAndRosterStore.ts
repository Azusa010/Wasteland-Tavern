import { useEffect, useState } from "react";
import {
  CompanionSkillKind,
  MainNpcId,
  NpcCompanionSkillDef,
  NpcStaticProfile,
} from "../types/game";

export type LlmProviderPreset = "gemini" | "opencode" | "modelscope" | "custom";
export type TtsProviderPreset =
  | "gemini_tts"
  | "openai_tts"
  | "browser_speech"
  | "off";
export type ImageProviderPreset =
  | "wasteland_flux"
  | "modelscope"
  | "custom_openai"
  | "sd_webui";

export interface LlmApiSettings {
  provider: LlmProviderPreset;
  baseUrl: string;
  model: string;
}

export interface TtsApiSettings {
  provider: TtsProviderPreset;
  baseUrl: string;
  model: string;
  voice: string;
}

export interface ImageApiSettings {
  provider: ImageProviderPreset;
  baseUrl: string;
  model: string;
  lockWastelandStyle: boolean;
}

export interface AudioSystemSettings {
  bgmEnabled: boolean;
  bgmVolume: number; // 0..100
  sfxEnabled: boolean;
  sfxVolume: number; // 0..100
  ttsEnabled: boolean;
  ttsVolume: number; // 0..100
}

export interface SystemSettingsState {
  llm: LlmApiSettings;
  tts: TtsApiSettings;
  image: ImageApiSettings;
  audio: AudioSystemSettings;
}

export interface NpcPortraitOverride {
  portraitUrl?: string;
  combatSpriteUrl?: string;
}

export interface ProtagonistOverride {
  name?: string;
  avatarUrl?: string;
  combatSpriteUrl?: string;
}

export interface CustomPatronRecord {
  id: string;
  enabled: boolean;
  name: string;
  title: string;
  faction: string;
  bio: string;
  personaPrompt: string;
  speechStyle: string;
  favoriteNotes: string[];
  dislikedNotes: string[];
  portraitUrl: string;
  combatSpriteUrl: string;
  companionSkillKind: CompanionSkillKind;
}

export interface CharacterRosterState {
  protagonist: ProtagonistOverride;
  npcOverrides: Partial<Record<MainNpcId, NpcPortraitOverride>>;
  customPatrons: CustomPatronRecord[];
}

const SETTINGS_STORAGE_KEY = "wasteland_system_settings_v1";
const ROSTER_STORAGE_KEY = "wasteland_character_roster_v1";

export const LLM_PRESET_DEFAULTS: Record<
  LlmProviderPreset,
  { label: string; subtitle: string; baseUrl: string; model: string }
> = {
  gemini: {
    label: "Gemini 官方通道",
    subtitle: "服务端原生 JSON 结构化推理（免配即用）",
    baseUrl: "https://generativelanguage.googleapis.com",
    model: "gemini-4-hydrogen",
  },
  opencode: {
    label: "OpenCode 网关",
    subtitle: "OpenAI 兼容推理网关（读取 OPENCODE_API_KEY）",
    baseUrl: "https://opencode.ai/zen/go/v1",
    model: "hy4-flash-free",
  },
  modelscope: {
    label: "魔搭 ModelScope",
    subtitle: "通义千问 / DeepSeek 兼容接口（读取 MODELSCOPE_API_KEY）",
    baseUrl: "https://api-inference.modelscope.cn/v1",
    model: "Qwen/Qwen2.5-72B-Instruct",
  },
  custom: {
    label: "自定义 OpenAI 兼容",
    subtitle: "支持本地 Ollama / vLLM 或任意 /v1/chat/completions 端点",
    baseUrl: "http://127.0.0.1:11434/v1",
    model: "qwen2.5:14b",
  },
};

export const TTS_PRESET_DEFAULTS: Record<
  TtsProviderPreset,
  { label: string; subtitle: string; baseUrl: string; model: string; voice: string }
> = {
  gemini_tts: {
    label: "Gemini 角色语音",
    subtitle: "按酒客性格与微醺程度动态匹配声线",
    baseUrl: "https://generativelanguage.googleapis.com",
    model: "gemini-3.8-flash-lite-tts",
    voice: "auto",
  },
  openai_tts: {
    label: "OpenAI / 自定义语音",
    subtitle: "调用兼容 /v1/audio/speech 音频流端点",
    baseUrl: "https://api.openai.com/v1",
    model: "tts-1",
    voice: "onyx",
  },
  browser_speech: {
    label: "本地系统合成",
    subtitle: "零延迟离线调用本机中文语音引擎",
    baseUrl: "local://speechSynthesis",
    model: "zh-CN-System",
    voice: "auto",
  },
  off: {
    label: "静默纯文字",
    subtitle: "关闭语音合成，仅保留打字机气泡与拟音",
    baseUrl: "",
    model: "",
    voice: "auto",
  },
};

export const IMAGE_PRESET_DEFAULTS: Record<
  ImageProviderPreset,
  { label: string; subtitle: string; baseUrl: string; model: string }
> = {
  wasteland_flux: {
    label: "废土手绘直连 (Flux)",
    subtitle: "服务端免密钥代理生图，自动锁定粗黑线废土水粉画风",
    baseUrl: "https://image.pollinations.ai",
    model: "flux",
  },
  modelscope: {
    label: "魔搭文生图 API",
    subtitle: "调用魔搭社区 Flux / SDXL 推理端点（需配置服务端密钥）",
    baseUrl: "https://api-inference.modelscope.cn/v1",
    model: "MusePublic/489_ckpt_flux_1",
  },
  custom_openai: {
    label: "自定义 OpenAI 生图",
    subtitle: "兼容任意 /v1/images/generations 标准生图接口",
    baseUrl: "https://api.openai.com/v1",
    model: "dall-e-3",
  },
  sd_webui: {
    label: "本地 SD WebUI",
    subtitle: "连接本地 Stable Diffusion /sdapi/v1/txt2img 接口",
    baseUrl: "http://127.0.0.1:7860",
    model: "wasteland_xl",
  },
};

export const COMPANION_SKILL_PRESETS: Record<
  CompanionSkillKind,
  NpcCompanionSkillDef
> = {
  ASSAULT_SCAVENGE: {
    name: "废墟侧翼掩护",
    desc: "每回合结束造成 5 点掩护射击伤害，每 2 回合顺手搜刮 1 份调酒原料。",
    kind: "ASSAULT_SCAVENGE",
    value: 5,
  },
  SHOTGUN_AOE: {
    name: "双管霰弹压制",
    desc: "每回合结束向敌方全体轰出 4 点范围散射伤害。",
    kind: "SHOTGUN_AOE",
    value: 4,
  },
  OPTIC_SHIELD: {
    name: "光学力场校准",
    desc: "每回合结束为掌柜加固 +5 点护甲，并削弱首名敌人 2 点攻击。",
    kind: "OPTIC_SHIELD",
    value: 5,
  },
  DART_CAPS: {
    name: "暗算回收飞镖",
    desc: "每回合结束点射造成 4 点伤害，并从战场搜回 +3 枚瓶盖。",
    kind: "DART_CAPS",
    value: 4,
  },
  HEAVY_BLOW: {
    name: "液压重锤破甲",
    desc: "每回合结束猛砸首名敌人造成 7 点高额重击伤害。",
    kind: "HEAVY_BLOW",
    value: 7,
  },
  FIELD_MEDIC: {
    name: "战地应急包扎",
    desc: "每回合结束为掌柜恢复 +3 点生命，并补枪造成 4 点掩护伤害。",
    kind: "FIELD_MEDIC",
    value: 4,
  },
};

export const FLAVOR_TAG_OPTIONS: string[] = [
  "烈酒",
  "辛辣",
  "醇厚",
  "温和",
  "饱腹",
  "净辐",
  "冰爽",
  "安神",
  "奇异",
  "微甜",
  "低刺激",
  "焦香",
];

export function createDefaultSettings(): SystemSettingsState {
  return {
    llm: {
      provider: "gemini",
      baseUrl: LLM_PRESET_DEFAULTS.gemini.baseUrl,
      model: LLM_PRESET_DEFAULTS.gemini.model,
    },
    tts: {
      provider: "gemini_tts",
      baseUrl: TTS_PRESET_DEFAULTS.gemini_tts.baseUrl,
      model: TTS_PRESET_DEFAULTS.gemini_tts.model,
      voice: "auto",
    },
    image: {
      provider: "wasteland_flux",
      baseUrl: IMAGE_PRESET_DEFAULTS.wasteland_flux.baseUrl,
      model: IMAGE_PRESET_DEFAULTS.wasteland_flux.model,
      lockWastelandStyle: true,
    },
    audio: {
      bgmEnabled: true,
      bgmVolume: 75,
      sfxEnabled: true,
      sfxVolume: 80,
      ttsEnabled: true,
      ttsVolume: 90,
    },
  };
}

export function createDefaultRoster(): CharacterRosterState {
  return {
    protagonist: {},
    npcOverrides: {},
    customPatrons: [],
  };
}

let cachedSettings: SystemSettingsState | null = null;
let cachedRoster: CharacterRosterState | null = null;
const storeListeners = new Set<() => void>();

function notifyStoreListeners() {
  storeListeners.forEach((fn) => fn());
}

export function loadSystemSettings(): SystemSettingsState {
  if (cachedSettings) return cachedSettings;
  const defaults = createDefaultSettings();
  if (typeof window === "undefined") {
    cachedSettings = defaults;
    return defaults;
  }
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      cachedSettings = defaults;
      return defaults;
    }
    const parsed = JSON.parse(raw) as Partial<SystemSettingsState>;
    cachedSettings = {
      llm: { ...defaults.llm, ...(parsed.llm || {}) },
      tts: { ...defaults.tts, ...(parsed.tts || {}) },
      image: { ...defaults.image, ...(parsed.image || {}) },
      audio: { ...defaults.audio, ...(parsed.audio || {}) },
    };
    return cachedSettings;
  } catch {
    cachedSettings = defaults;
    return defaults;
  }
}

export function saveSystemSettings(next: SystemSettingsState): void {
  cachedSettings = structuredClone(next);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(cachedSettings));
    } catch {
      // ignore storage quota errors
    }
  }
  notifyStoreListeners();
}

export function loadCharacterRoster(): CharacterRosterState {
  if (cachedRoster) return cachedRoster;
  const defaults = createDefaultRoster();
  if (typeof window === "undefined") {
    cachedRoster = defaults;
    return defaults;
  }
  try {
    const raw = localStorage.getItem(ROSTER_STORAGE_KEY);
    if (!raw) {
      cachedRoster = defaults;
      return defaults;
    }
    const parsed = JSON.parse(raw) as Partial<CharacterRosterState>;
    cachedRoster = {
      protagonist: { ...(parsed.protagonist || {}) },
      npcOverrides: { ...(parsed.npcOverrides || {}) },
      customPatrons: Array.isArray(parsed.customPatrons)
        ? parsed.customPatrons
        : [],
    };
    return cachedRoster;
  } catch {
    cachedRoster = defaults;
    return defaults;
  }
}

export function saveCharacterRoster(next: CharacterRosterState): boolean {
  const cloned = structuredClone(next);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(cloned));
    } catch {
      return false;
    }
  }
  cachedRoster = cloned;
  notifyStoreListeners();
  return true;
}

export function subscribeSettingsAndRoster(listener: () => void): () => void {
  storeListeners.add(listener);
  return () => {
    storeListeners.delete(listener);
  };
}

export function useSettingsAndRoster(): {
  settings: SystemSettingsState;
  roster: CharacterRosterState;
} {
  const [, setTick] = useState(0);
  useEffect(() => {
    return subscribeSettingsAndRoster(() => {
      setTick((t) => t + 1);
    });
  }, []);
  return {
    settings: loadSystemSettings(),
    roster: loadCharacterRoster(),
  };
}

export function customPatronToStaticProfile(
  record: CustomPatronRecord
): NpcStaticProfile {
  const skill =
    COMPANION_SKILL_PRESETS[record.companionSkillKind] ||
    COMPANION_SKILL_PRESETS.ASSAULT_SCAVENGE;
  const fav =
    record.favoriteNotes.length > 0 ? record.favoriteNotes : ["醇厚", "温和"];
  const dis =
    record.dislikedNotes.length > 0 ? record.dislikedNotes : ["辛辣"];

  return {
    id: record.id,
    isMainCharacter: false,
    name: record.name.trim() || "无名荒原客",
    title: record.title.trim() || "自由佣兵",
    faction: record.faction.trim() || "荒原独行者",
    portraitUrl: record.portraitUrl,
    combatSpriteUrl: record.combatSpriteUrl || record.portraitUrl,
    personaPrompt:
      record.personaPrompt.trim() ||
      `你是常在东区废墟活动的「${record.name}」（${record.title}），性格鲜明，来零号酒馆喝一杯歇脚。`,
    speechStyle:
      record.speechStyle.trim() || "干练沉稳，带着废土风霜与冷幽默。",
    bio:
      record.bio.trim() ||
      record.personaPrompt.trim() ||
      "由掌柜收录入人物库的原创废土酒客，白昼推门饮酒叙旧，入夜可受邀并肩深入废墟。",
    favoriteNotes: fav,
    dislikedNotes: dis,
    signatureCardId: "card_adrenaline_shot",
    intelThreshold: 54,
    giftCardThreshold: 68,
    brawlTensionThreshold: 78,
    quickTopics: [
      "最近荒原哪条路好走？",
      "今晚想喝点什么风味的特调？",
      "入夜敢不敢搭把手一起去废墟闯一趟？",
    ],
    secretAgenda: {
      isUndercover: false,
      codeName: "CUSTOM-01",
      surfaceAlibi: `来自「${record.faction || "荒原自由盟"}」的${
        record.title || "熟面孔"
      }，身份清白可靠。`,
      trueIdentity: `${record.faction || "荒原自由盟"} · ${
        record.title || "同行者"
      }`,
      secretGoal: "在零号酒馆歇脚品酒，若投缘便与掌柜结伴夜探废墟。",
      probeKeywords: [],
      slipIntoxicationThreshold: 99,
      defaultClueText: "",
      bountyCaps: 0,
      hushCaps: 0,
      commissionTitle: `协助${record.name}取回遗落物资箱`,
      commissionDesc: "前往第 2 层废墟搜出遗落的私人物资箱，黎明交接重谢。",
    },
    companionSkill: skill,
  };
}

/**
 * 将玩家本地上传的图片或远端生成的 Base64 立绘压缩至合适尺寸（防止超出 localStorage 配额），
 * 同时保留透明 PNG 的 Alpha 通道，或保留纯色背景供 CutoutSprite 自动边缘抠图。
 */
export function compressImageDataUrl(
  rawUrl: string,
  maxDim = 560
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const scale = Math.min(
          1,
          maxDim / Math.max(1, img.naturalWidth, img.naturalHeight)
        );
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(rawUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);

        // 检测是否含有半透明/全透明像素：若有则用 image/webp 保留透明通道，否则用高质量 jpeg
        const sample = ctx.getImageData(0, 0, w, h).data;
        let hasAlpha = false;
        for (let i = 3; i < sample.length; i += 16) {
          if (sample[i] < 245) {
            hasAlpha = true;
            break;
          }
        }
        if (hasAlpha) {
          const webpUrl = canvas.toDataURL("image/webp", 0.86);
          resolve(webpUrl.startsWith("data:image/webp") ? webpUrl : canvas.toDataURL("image/png"));
        } else {
          resolve(canvas.toDataURL("image/jpeg", 0.86));
        }
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("图片解码失败，请更换 PNG / JPG / WebP 文件。"));
    img.src = rawUrl;
  });
}

export function readAndCompressLocalImageFile(
  file: File,
  maxDim = 560
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const rawDataUrl = String(reader.result || "");
        const compressed = await compressImageDataUrl(rawDataUrl, maxDim);
        resolve(compressed);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("读取本地图片文件失败。"));
    reader.readAsDataURL(file);
  });
}
