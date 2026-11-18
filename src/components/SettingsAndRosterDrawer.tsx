import React, { useEffect, useRef, useState } from "react";
import {
  Check,
  Loader2,
  Mic,
  MicOff,
  Plus,
  Radio,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Volume2,
  VolumeX,
  Wifi,
  X,
} from "lucide-react";
import { ARTWORK_ASSETS, MAIN_NPC_ORDER, NPC_PROFILES } from "../data/gameConfig";
import {
  COMPANION_SKILL_PRESETS,
  compressImageDataUrl,
  CustomPatronRecord,
  FLAVOR_TAG_OPTIONS,
  IMAGE_PRESET_DEFAULTS,
  ImageProviderPreset,
  LLM_PRESET_DEFAULTS,
  LlmProviderPreset,
  loadCharacterRoster,
  loadSystemSettings,
  readAndCompressLocalImageFile,
  saveCharacterRoster,
  saveSystemSettings,
  TTS_PRESET_DEFAULTS,
  TtsProviderPreset,
  useSettingsAndRoster,
} from "../data/settingsAndRosterStore";
import { CompanionSkillKind, MainNpcId } from "../types/game";
import { soundFx } from "../utils/sound";
import { ArtworkImage } from "./ArtworkImage";
import { CutoutSprite } from "./CutoutSprite";

export type DrawerPanelMode = "ROSTER" | "SETTINGS";

interface EnvKeyStatus {
  geminiKeyConfigured: boolean;
  opencodeKeyConfigured: boolean;
  modelscopeKeyConfigured: boolean;
  customLlmKeyConfigured: boolean;
  customTtsKeyConfigured: boolean;
  imageKeyConfigured: boolean;
}

interface TestResultState {
  loading: boolean;
  ok?: boolean;
  latencyMs?: number;
  summary?: string;
  previewImageUrl?: string;
}

interface SettingsAndRosterDrawerProps {
  mode: DrawerPanelMode;
  presentation: "title_inline" | "ingame_overlay";
  inDayTavern?: boolean;
  onSwitchMode: (mode: DrawerPanelMode) => void;
  onClose: () => void;
  onAudioFlagsSynced?: (flags: {
    bgmEnabled: boolean;
    sfxEnabled: boolean;
    ttsEnabled: boolean;
  }) => void;
  onRosterUpdated?: (appendToTodayQueue?: boolean) => void;
  onNotify?: (msg: string) => void;
}

function renderCharacterSpritePreview(
  src: string,
  alt: string,
  slotKind: "portrait" | "combat_full"
) {
  const isStaticTransparentPng = src.startsWith("/assets/") && src.endsWith(".png");
  if (isStaticTransparentPng) {
    return (
      <ArtworkImage
        src={src}
        alt={alt}
        className="w-full h-full object-contain object-bottom drop-shadow-[0_10px_20px_rgba(0,0,0,0.9)]"
        tone="warm"
      />
    );
  }
  return (
    <CutoutSprite
      src={src}
      alt={alt}
      cropMode={slotKind === "combat_full" ? "bottom" : "none"}
      className="w-full h-full object-contain object-bottom drop-shadow-[0_10px_20px_rgba(0,0,0,0.9)]"
    />
  );
}

interface DualPortraitWorkbenchProps {
  subjectLabel: string;
  portraitLabel: string;
  combatLabel: string;
  portraitSrc: string;
  combatSrc: string;
  defaultPromptHint: string;
  canReset?: boolean;
  onApplyPortrait: (dataUrl: string) => void;
  onApplyCombatSprite: (dataUrl: string) => void;
  onResetBoth?: () => void;
}

const DualPortraitWorkbench: React.FC<DualPortraitWorkbenchProps> = ({
  subjectLabel,
  portraitLabel,
  combatLabel,
  portraitSrc,
  combatSrc,
  defaultPromptHint,
  canReset = false,
  onApplyPortrait,
  onApplyCombatSprite,
  onResetBoth,
}) => {
  const [activeSlot, setActiveSlot] = useState<"portrait" | "combat_full">(
    "portrait"
  );
  const [promptText, setPromptText] = useState(defaultPromptHint);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setPromptText(defaultPromptHint);
    setStatusMsg(null);
    setIsError(false);
  }, [defaultPromptHint, subjectLabel]);

  const handleLocalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setStatusMsg("正在解析本地图片并抠除纯色背景…");
      setIsError(false);
      const dataUrl = await readAndCompressLocalImageFile(file, 560);
      if (activeSlot === "portrait") {
        onApplyPortrait(dataUrl);
      } else {
        onApplyCombatSprite(dataUrl);
      }
      soundFx.playCaliperLock();
      setStatusMsg(
        `已载入${activeSlot === "portrait" ? portraitLabel : combatLabel}（纯色底自动透明化）`
      );
    } catch (err: unknown) {
      setIsError(true);
      setStatusMsg(err instanceof Error ? err.message : "上传解析失败");
    }
  };

  const handleGenerateViaApi = async () => {
    if (!promptText.trim() || isGenerating) return;
    setIsGenerating(true);
    setIsError(false);
    setStatusMsg(
      `正在调用生图通道绘制${
        activeSlot === "portrait" ? portraitLabel : combatLabel
      }…`
    );

    try {
      const settings = loadSystemSettings();
      const resp = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText.trim(),
          slotKind: activeSlot,
          lockWastelandStyle: settings.image.lockWastelandStyle,
          imageConfig: {
            provider: settings.image.provider,
            baseUrl: settings.image.baseUrl,
            model: settings.image.model,
          },
        }),
      });
      const data = (await resp.json()) as {
        imageDataUrl?: string;
        error?: string;
        modelName?: string;
      };
      if (!resp.ok || !data.imageDataUrl) {
        throw new Error(data.error || `生图失败 (${resp.status})`);
      }

      const compressed = await compressImageDataUrl(data.imageDataUrl, 560);
      if (activeSlot === "portrait") {
        onApplyPortrait(compressed);
      } else {
        onApplyCombatSprite(compressed);
      }
      soundFx.playBottleCaps();
      setStatusMsg(
        `绘制完成（${data.modelName || "手绘通道"}）· 已自动抠图并应用至${
          activeSlot === "portrait" ? portraitLabel : combatLabel
        }`
      );
    } catch (err: unknown) {
      setIsError(true);
      setStatusMsg(
        err instanceof Error ? err.message : "调用图片生成 API 失败，请检查设置。"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* 双立绘并列预览画框 */}
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            {
              id: "portrait" as const,
              code: "SLOT A",
              label: portraitLabel,
              src: portraitSrc,
              hint: "白昼吧台 / 状态栏展示",
            },
            {
              id: "combat_full" as const,
              code: "SLOT B",
              label: combatLabel,
              src: combatSrc,
              hint: "黑夜探索 / 牌局全身站姿",
            },
          ] as const
        ).map((slot) => {
          const selected = activeSlot === slot.id;
          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => {
                soundFx.playCaliperTick();
                setActiveSlot(slot.id);
              }}
              className={`group relative rounded-sm border p-2.5 text-left transition-colors cursor-pointer flex flex-col justify-between h-56 sm:h-62 ${
                selected
                  ? "border-[#E59A3C] bg-[#1C140E]/90 shadow-[inset_0_0_24px_rgba(229,154,60,0.08)]"
                  : "border-[#F5D096]/16 bg-[#130E0B]/75 hover:border-[#E59A3C]/45"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono-num shrink-0">
                <span
                  className={
                    selected ? "text-[#E59A3C] font-semibold" : "text-[#9E8874]"
                  }
                >
                  {slot.code} · {slot.label}
                </span>
                {selected && (
                  <span className="text-[#E59A3C] tracking-wider">编辑中</span>
                )}
              </div>

              <div className="relative flex-1 min-h-0 my-1.5 rounded-xs bg-[radial-gradient(circle_at_50%_62%,rgba(229,154,60,0.12),rgba(10,8,7,0.85))] border border-[#F5D096]/10 overflow-hidden flex items-end justify-center p-1">
                {renderCharacterSpritePreview(
                  slot.src,
                  `${subjectLabel}-${slot.label}`,
                  slot.id
                )}
              </div>

              <p className="text-[10px] text-[#9E8874] truncate shrink-0">
                {slot.hint}
              </p>
            </button>
          );
        })}
      </div>

      {/* 立绘注入控制区：AI 描述生图 + 本地上传 */}
      <div className="rounded-sm border border-[#F5D096]/16 bg-[#140F0C]/85 p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-[#E6D5C3] font-medium">
            目标槽位：
            <strong className="text-[#E59A3C] ml-1">
              {activeSlot === "portrait" ? portraitLabel : combatLabel}
            </strong>
          </span>
          <div className="flex items-center gap-2">
            {canReset && onResetBoth && (
              <button
                type="button"
                onClick={() => {
                  soundFx.playCaliperTick();
                  onResetBoth();
                  setStatusMsg("已恢复原版手绘立绘");
                  setIsError(false);
                }}
                className="px-2 py-0.5 rounded-xs border border-[#F5D096]/20 hover:border-[#E59A3C]/60 text-[11px] text-[#B59E88] hover:text-[#FDF5EB] flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                恢复原版
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1 rounded-xs border border-[#E59A3C]/45 bg-[#221812] hover:bg-[#2F2119] text-[11px] text-[#F7D7A8] flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3 h-3 text-[#E59A3C]" />
              本地上传图片
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleLocalUpload}
              className="hidden"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="text"
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="输入外貌、穿搭与武器特征（英文或中文皆可，自动锁定废土手绘画风）"
            className="flex-1 rounded-xs border border-[#F5D096]/18 bg-[#0C0907] px-2.5 py-1.5 text-xs text-[#FAF0E6] placeholder:text-[#7D6A59] focus:outline-none focus:border-[#E59A3C]"
          />
          <button
            type="button"
            disabled={isGenerating || !promptText.trim()}
            onClick={handleGenerateViaApi}
            className="px-3.5 py-1.5 rounded-xs bg-[#E59A3C] hover:bg-[#F0A84B] disabled:opacity-40 text-[#1B1410] text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                绘制中…
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                API 生成立绘
              </>
            )}
          </button>
        </div>

        {statusMsg && (
          <p
            className={`text-[11px] leading-snug ${
              isError ? "text-[#EF6B63]" : "text-[#C9A882]"
            }`}
          >
            {statusMsg}
          </p>
        )}
      </div>
    </div>
  );
};

export const SettingsAndRosterDrawer: React.FC<SettingsAndRosterDrawerProps> = ({
  mode,
  presentation,
  inDayTavern = false,
  onSwitchMode,
  onClose,
  onAudioFlagsSynced,
  onRosterUpdated,
  onNotify,
}) => {
  const { settings, roster } = useSettingsAndRoster();

  // 系统设置子页签
  const [settingsTab, setSettingsTab] = useState<
    "LLM" | "TTS" | "IMAGE" | "AUDIO"
  >("LLM");

  // 人物库子页签
  const [rosterTab, setRosterTab] = useState<
    "PROTAGONIST" | "REGULARS" | "CUSTOM"
  >("PROTAGONIST");
  const [selectedRegularId, setSelectedRegularId] =
    useState<MainNpcId>("ash_scavenger");
  const [editingCustomId, setEditingCustomId] = useState<string | "NEW">("NEW");

  // 服务端环境变量就绪状态（不含任何密钥明文）
  const [envStatus, setEnvStatus] = useState<EnvKeyStatus | null>(null);
  const [llmTest, setLlmTest] = useState<TestResultState>({ loading: false });
  const [ttsTest, setTtsTest] = useState<TestResultState>({ loading: false });
  const [imgTest, setImgTest] = useState<TestResultState>({ loading: false });

  // 原创酒客编辑表单
  const [draftCustom, setDraftCustom] = useState<CustomPatronRecord>(() => ({
    id: `custom_npc_${Date.now().toString(36)}`,
    enabled: true,
    name: "",
    title: "荒原赏金猎人",
    faction: "自由拾荒盟",
    bio: "常在东区铁道巡游的独行枪手，话不多但极重承诺。",
    personaPrompt:
      "常在东区铁道巡游的独行赏金猎人，看淡生死，酒品极佳，若信任掌柜便愿意入夜持枪护航。",
    speechStyle: "简短冷峻，偶尔带着冷幽默，从不说废话。",
    favoriteNotes: ["烈酒", "醇厚"],
    dislikedNotes: ["微甜"],
    portraitUrl: ARTWORK_ASSETS.charNeutralSurvivor,
    combatSpriteUrl: ARTWORK_ASSETS.charNeutralSurvivor,
    companionSkillKind: "ASSAULT_SCAVENGE",
  }));

  const refreshEnvStatus = () => {
    fetch("/api/settings/env-status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setEnvStatus(d as EnvKeyStatus);
      })
      .catch(() => {});
  };

  useEffect(() => {
    refreshEnvStatus();
  }, []);

  useEffect(() => {
    if (presentation !== "ingame_overlay") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presentation, onClose]);

  const selectCustomForEdit = (rec: CustomPatronRecord) => {
    setEditingCustomId(rec.id);
    setDraftCustom(structuredClone(rec));
  };

  const startBlankCustomPatron = () => {
    setEditingCustomId("NEW");
    setDraftCustom({
      id: `custom_npc_${Date.now().toString(36)}`,
      enabled: true,
      name: "",
      title: "荒原赏金猎人",
      faction: "自由拾荒盟",
      bio: "常在东区铁道巡游的独行枪手，话不多但极重承诺。",
      personaPrompt:
        "常在东区铁道巡游的独行赏金猎人，看淡生死，酒品极佳，若信任掌柜便愿意入夜持枪护航。",
      speechStyle: "简短冷峻，偶尔带着冷幽默，从不说废话。",
      favoriteNotes: ["烈酒", "醇厚"],
      dislikedNotes: ["微甜"],
      portraitUrl: ARTWORK_ASSETS.charNeutralSurvivor,
      combatSpriteUrl: ARTWORK_ASSETS.charNeutralSurvivor,
      companionSkillKind: "ASSAULT_SCAVENGE",
    });
  };

  const updateSettings = (updater: (cur: typeof settings) => typeof settings) => {
    const next = updater(structuredClone(loadSystemSettings()));
    saveSystemSettings(next);
    soundFx.setEnabled(next.audio.sfxEnabled);
    soundFx.setBgmEnabled(next.audio.bgmEnabled);
    soundFx.setTtsEnabled(next.audio.ttsEnabled);
    soundFx.setVolumes({
      bgmVolume: next.audio.bgmVolume,
      sfxVolume: next.audio.sfxVolume,
      ttsVolume: next.audio.ttsVolume,
    });
    onAudioFlagsSynced?.({
      bgmEnabled: next.audio.bgmEnabled,
      sfxEnabled: next.audio.sfxEnabled,
      ttsEnabled: next.audio.ttsEnabled,
    });
  };

  const runApiConnectivityTest = async (target: "llm" | "tts" | "image") => {
    const cur = loadSystemSettings();
    const setTargetState =
      target === "llm"
        ? setLlmTest
        : target === "tts"
        ? setTtsTest
        : setImgTest;

    setTargetState({ loading: true });
    soundFx.playCaliperTick();

    try {
      const resp = await fetch("/api/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          llmConfig: cur.llm,
          ttsConfig: cur.tts,
          imageConfig: cur.image,
        }),
      });
      const data = (await resp.json()) as {
        ok?: boolean;
        latencyMs?: number;
        summary?: string;
        audioDataUrl?: string;
        browserPreviewText?: string;
        previewImageDataUrl?: string;
      };

      if (target === "tts" && data.ok) {
        if (data.audioDataUrl) {
          soundFx.playPreviewAudioDataUrl(data.audioDataUrl);
        } else if (data.browserPreviewText) {
          soundFx.previewBrowserSpeech(data.browserPreviewText);
        }
      }

      setTargetState({
        loading: false,
        ok: Boolean(data.ok),
        latencyMs: data.latencyMs,
        summary: data.summary || (data.ok ? "连通正常" : "连通异常"),
        previewImageUrl: data.previewImageDataUrl,
      });
    } catch (err: unknown) {
      setTargetState({
        loading: false,
        ok: false,
        summary: err instanceof Error ? err.message : "网络请求异常",
      });
    }
  };

  const handleSaveCustomPatron = (appendToday = false) => {
    if (!draftCustom.name.trim()) {
      onNotify?.("请先填写原创酒客的姓名");
      return;
    }
    const curRoster = structuredClone(loadCharacterRoster());
    const normalized: CustomPatronRecord = {
      ...draftCustom,
      name: draftCustom.name.trim(),
      title: draftCustom.title.trim() || "自由旅人",
      faction: draftCustom.faction.trim() || "荒原散客",
      personaPrompt:
        draftCustom.personaPrompt.trim() ||
        `来自${draftCustom.faction || "荒原"}的${draftCustom.title || "旅人"}「${draftCustom.name.trim()}」。`,
      bio:
        draftCustom.bio.trim() ||
        draftCustom.personaPrompt.trim() ||
        "掌柜收录的原创废土酒客。",
    };

    const existingIdx = curRoster.customPatrons.findIndex(
      (c) => c.id === normalized.id
    );
    if (existingIdx >= 0) {
      curRoster.customPatrons[existingIdx] = normalized;
    } else {
      curRoster.customPatrons.push(normalized);
    }

    const ok = saveCharacterRoster(curRoster);
    if (!ok) {
      onNotify?.("浏览器本地存储空间不足，请精简立绘数量后重试");
      return;
    }
    setEditingCustomId(normalized.id);
    soundFx.playBottleCaps();
    onRosterUpdated?.(appendToday);
    onNotify?.(
      appendToday
        ? `已收录「${normalized.name}」并排入今日吧台队列`
        : `已保存原创酒客「${normalized.name}」至人物库`
    );
  };

  const handleDeleteCustomPatron = (id: string) => {
    const curRoster = structuredClone(loadCharacterRoster());
    curRoster.customPatrons = curRoster.customPatrons.filter((c) => c.id !== id);
    saveCharacterRoster(curRoster);
    if (editingCustomId === id) {
      startBlankCustomPatron();
    }
    soundFx.playCaliperTick();
    onRosterUpdated?.(false);
  };

  const regularBase = NPC_PROFILES[selectedRegularId];
  const regularOverride = roster.npcOverrides[selectedRegularId];
  const regularDefaultCombatUrl =
    selectedRegularId === "ash_scavenger"
      ? ARTWORK_ASSETS.combatNpcAsh
      : selectedRegularId === "k7_synth"
      ? ARTWORK_ASSETS.combatNpcK7
      : selectedRegularId === "buck_raider"
      ? ARTWORK_ASSETS.combatNpcBuck
      : ARTWORK_ASSETS.combatNpcMori;

  const panelBody = (
    <div
      className={`w-full max-w-[650px] ${
        presentation === "title_inline"
          ? "h-[min(78vh,680px)]"
          : "h-[min(86vh,730px)]"
      } rounded-sm border border-[#E59A3C]/38 bg-[#110D0A]/88 backdrop-blur-md text-[#F3EAE0] shadow-[0_24px_64px_rgba(0,0,0,0.92)] flex flex-col overflow-hidden select-none`}
    >
      {/* 顶部黄铜刻度标尺头栏 */}
      <div className="px-6 py-4 border-b border-[#F5D096]/14 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-5">
          {(
            [
              { id: "ROSTER" as const, code: "30.0", label: "人物库" },
              { id: "SETTINGS" as const, code: "40.0", label: "系统设置" },
            ] as const
          ).map((item) => {
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  soundFx.playCaliperTick();
                  onSwitchMode(item.id);
                }}
                className={`pb-1 border-b-2 transition-colors flex items-baseline gap-2 cursor-pointer ${
                  active
                    ? "border-[#E59A3C] text-[#FDF5EB]"
                    : "border-transparent text-[#9E8874] hover:text-[#E6D5C3]"
                }`}
              >
                <span className="font-mono-num text-[11px] text-[#E59A3C]">
                  {item.code}
                </span>
                <span className="font-display text-lg font-bold tracking-wide">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            soundFx.playCaliperTick();
            onClose();
          }}
          className="p-1.5 rounded-xs border border-transparent hover:border-[#F5D096]/20 hover:bg-[#241A14] text-[#B59E88] hover:text-[#FDF5EB] transition-colors cursor-pointer"
          aria-label="收起面板"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ==================== 40.0 系统设置内容区 ==================== */}
      {mode === "SETTINGS" ? (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* 二级细线导航栏 */}
          <div className="px-6 pt-3 border-b border-[#F5D096]/12 flex items-center gap-6 text-xs shrink-0 overflow-x-auto">
            {(
              [
                { id: "LLM" as const, code: "01", label: "LLM API" },
                { id: "TTS" as const, code: "02", label: "TTS API" },
                { id: "IMAGE" as const, code: "03", label: "图片生成 API" },
                { id: "AUDIO" as const, code: "04", label: "电台与声效" },
              ] as const
            ).map((tab) => {
              const active = settingsTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    soundFx.playCaliperTick();
                    setSettingsTab(tab.id);
                  }}
                  className={`pb-2.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                    active
                      ? "border-[#E59A3C] text-[#FDF5EB] font-semibold"
                      : "border-transparent text-[#9E8874] hover:text-[#E6D5C3]"
                  }`}
                >
                  <span className="font-mono-num text-[10px] text-[#E59A3C]/85">
                    {tab.code}
                  </span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
            {settingsTab === "LLM" && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#C9A882] font-medium">
                      推理通道预设
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playCaliperTick();
                        refreshEnvStatus();
                      }}
                      className="font-mono-num text-[11px] text-[#C9A882] hover:text-[#E59A3C] flex items-center gap-1 cursor-pointer"
                      title="重新检测服务端 Secrets / .env 密钥注入状态"
                    >
                      <RotateCcw className="w-3 h-3" />
                      刷新服务端密钥状态
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(
                      Object.keys(LLM_PRESET_DEFAULTS) as LlmProviderPreset[]
                    ).map((key) => {
                      const preset = LLM_PRESET_DEFAULTS[key];
                      const active = settings.llm.provider === key;
                      const ready =
                        key === "gemini"
                          ? envStatus?.geminiKeyConfigured !== false
                          : key === "opencode"
                          ? Boolean(envStatus?.opencodeKeyConfigured)
                          : key === "modelscope"
                          ? Boolean(envStatus?.modelscopeKeyConfigured)
                          : true;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            soundFx.playCaliperTick();
                            updateSettings((cur) => ({
                              ...cur,
                              llm: {
                                provider: key,
                                baseUrl: preset.baseUrl,
                                model: preset.model,
                              },
                            }));
                          }}
                          className={`p-3 rounded-sm border text-left transition-colors cursor-pointer ${
                            active
                              ? "border-[#E59A3C] bg-[#1F1610]"
                              : "border-[#F5D096]/14 bg-[#15100C]/70 hover:border-[#E59A3C]/40"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[#FDF5EB]">
                              {preset.label}
                            </span>
                            <span
                              className={`font-mono-num text-[10px] ${
                                ready ? "text-emerald-400/90" : "text-[#9E8874]"
                              }`}
                            >
                              {key === "custom"
                                ? "自定义"
                                : ready
                                ? "已就绪"
                                : "需环境变量"}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#9E8874] mt-1 leading-snug">
                            {preset.subtitle}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs text-[#C9A882] mb-1">
                      接口地址 (Base URL)
                    </label>
                    <input
                      type="text"
                      value={settings.llm.baseUrl}
                      disabled={settings.llm.provider === "gemini"}
                      onChange={(e) =>
                        updateSettings((cur) => ({
                          ...cur,
                          llm: { ...cur.llm, baseUrl: e.target.value },
                        }))
                      }
                      placeholder="https://api.openai.com/v1"
                      className="w-full rounded-xs border border-[#F5D096]/18 bg-[#0C0907] disabled:opacity-50 px-3 py-2 font-mono-num text-xs text-[#FAF0E6] focus:outline-none focus:border-[#E59A3C]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-[#C9A882]">
                        模型名称 (Model ID)
                      </label>
                      {settings.llm.provider === "gemini" && (
                        <div className="flex items-center gap-1.5">
                          {["gemini-4-hydrogen", "gemini-3.1-flash-lite"].map(
                            (m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() =>
                                  updateSettings((cur) => ({
                                    ...cur,
                                    llm: { ...cur.llm, model: m },
                                  }))
                                }
                                className={`px-1.5 py-0.5 rounded-xs border font-mono-num text-[10px] cursor-pointer ${
                                  settings.llm.model === m
                                    ? "border-[#E59A3C] text-[#E59A3C]"
                                    : "border-[#F5D096]/15 text-[#9E8874] hover:text-[#FAF0E6]"
                                }`}
                              >
                                {m}
                              </button>
                            )
                          )}
                        </div>
                      )}
                    </div>
                    <input
                      type="text"
                      value={settings.llm.model}
                      onChange={(e) =>
                        updateSettings((cur) => ({
                          ...cur,
                          llm: { ...cur.llm, model: e.target.value },
                        }))
                      }
                      placeholder="gemini-4-hydrogen"
                      className="w-full rounded-xs border border-[#F5D096]/18 bg-[#0C0907] px-3 py-2 font-mono-num text-xs text-[#FAF0E6] focus:outline-none focus:border-[#E59A3C]"
                    />
                  </div>

                  <div className="rounded-xs border border-[#F5D096]/14 bg-[#15100C]/80 px-3 py-2 flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-[#9E8874]">
                      服务端密钥槽位（AI Studio 右上角 Secrets 或本地 .env）：
                    </span>
                    <span className="font-mono-num text-[#F7D7A8] shrink-0">
                      {settings.llm.provider === "gemini"
                        ? "GEMINI_API_KEY"
                        : settings.llm.provider === "opencode"
                        ? "OPENCODE_API_KEY"
                        : settings.llm.provider === "modelscope"
                        ? "MODELSCOPE_API_KEY"
                        : "CUSTOM_LLM_API_KEY"}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#F5D096]/12 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={llmTest.loading}
                    onClick={() => runApiConnectivityTest("llm")}
                    className="px-4 py-2 rounded-xs border border-[#E59A3C]/65 bg-[#241912] hover:bg-[#E59A3C] hover:text-[#1B1410] text-xs font-semibold text-[#F7D7A8] transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    {llmTest.loading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Wifi className="w-3.5 h-3.5" />
                    )}
                    <span>连通测试</span>
                  </button>

                  {llmTest.summary && (
                    <p
                      className={`text-xs font-mono-num flex-1 text-right ${
                        llmTest.ok ? "text-emerald-400" : "text-[#EF6B63]"
                      }`}
                    >
                      {llmTest.latencyMs ? `[${llmTest.latencyMs}ms] ` : ""}
                      {llmTest.summary}
                    </p>
                  )}
                </div>
              </>
            )}

            {settingsTab === "TTS" && (
              <>
                <div className="space-y-2">
                  <span className="block text-xs text-[#C9A882] font-medium">
                    语音合成通道预设
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(
                      Object.keys(TTS_PRESET_DEFAULTS) as TtsProviderPreset[]
                    ).map((key) => {
                      const preset = TTS_PRESET_DEFAULTS[key];
                      const active = settings.tts.provider === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            soundFx.playCaliperTick();
                            updateSettings((cur) => ({
                              ...cur,
                              tts: {
                                provider: key,
                                baseUrl: preset.baseUrl,
                                model: preset.model,
                                voice: preset.voice,
                              },
                              audio: {
                                ...cur.audio,
                                ttsEnabled: key !== "off",
                              },
                            }));
                          }}
                          className={`p-3 rounded-sm border text-left transition-colors cursor-pointer ${
                            active
                              ? "border-[#E59A3C] bg-[#1F1610]"
                              : "border-[#F5D096]/14 bg-[#15100C]/70 hover:border-[#E59A3C]/40"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[#FDF5EB]">
                              {preset.label}
                            </span>
                            {active && (
                              <Check className="w-3.5 h-3.5 text-[#E59A3C]" />
                            )}
                          </div>
                          <p className="text-[11px] text-[#9E8874] mt-1 leading-snug">
                            {preset.subtitle}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {settings.tts.provider !== "off" &&
                  settings.tts.provider !== "browser_speech" && (
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="block text-xs text-[#C9A882] mb-1">
                          语音接口地址 (Base URL)
                        </label>
                        <input
                          type="text"
                          value={settings.tts.baseUrl}
                          disabled={settings.tts.provider === "gemini_tts"}
                          onChange={(e) =>
                            updateSettings((cur) => ({
                              ...cur,
                              tts: { ...cur.tts, baseUrl: e.target.value },
                            }))
                          }
                          placeholder="https://api.openai.com/v1"
                          className="w-full rounded-xs border border-[#F5D096]/18 bg-[#0C0907] disabled:opacity-50 px-3 py-2 font-mono-num text-xs text-[#FAF0E6] focus:outline-none focus:border-[#E59A3C]"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-[#C9A882] mb-1">
                            语音模型 (Model)
                          </label>
                          <input
                            type="text"
                            value={settings.tts.model}
                            onChange={(e) =>
                              updateSettings((cur) => ({
                                ...cur,
                                tts: { ...cur.tts, model: e.target.value },
                              }))
                            }
                            placeholder="gemini-3.8-flash-lite-tts"
                            className="w-full rounded-xs border border-[#F5D096]/18 bg-[#0C0907] px-3 py-2 font-mono-num text-xs text-[#FAF0E6] focus:outline-none focus:border-[#E59A3C]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-[#C9A882] mb-1">
                            默认声线标识 (Voice)
                          </label>
                          <input
                            type="text"
                            value={settings.tts.voice}
                            onChange={(e) =>
                              updateSettings((cur) => ({
                                ...cur,
                                tts: { ...cur.tts, voice: e.target.value },
                              }))
                            }
                            placeholder="auto / Fenrir / Kore / onyx"
                            className="w-full rounded-xs border border-[#F5D096]/18 bg-[#0C0907] px-3 py-2 font-mono-num text-xs text-[#FAF0E6] focus:outline-none focus:border-[#E59A3C]"
                          />
                        </div>
                      </div>

                      <div className="rounded-xs border border-[#F5D096]/14 bg-[#15100C]/80 px-3 py-2 flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-[#9E8874]">
                          服务端密钥槽位（Secrets 面板或本地 .env）：
                        </span>
                        <span className="font-mono-num text-[#F7D7A8] shrink-0">
                          {settings.tts.provider === "gemini_tts"
                            ? `GEMINI_API_KEY · ${
                                envStatus?.geminiKeyConfigured !== false
                                  ? "已注入"
                                  : "未配置"
                              }`
                            : `CUSTOM_TTS_API_KEY · ${
                                envStatus?.customTtsKeyConfigured
                                  ? "已注入"
                                  : "未配置"
                              }`}
                        </span>
                      </div>
                    </div>
                  )}

                <div className="pt-2 border-t border-[#F5D096]/12 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={ttsTest.loading}
                    onClick={() => runApiConnectivityTest("tts")}
                    className="px-4 py-2 rounded-xs border border-[#E59A3C]/65 bg-[#241912] hover:bg-[#E59A3C] hover:text-[#1B1410] text-xs font-semibold text-[#F7D7A8] transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    {ttsTest.loading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                    <span>试听连通测试</span>
                  </button>

                  {ttsTest.summary && (
                    <p
                      className={`text-xs font-mono-num flex-1 text-right ${
                        ttsTest.ok ? "text-emerald-400" : "text-[#EF6B63]"
                      }`}
                    >
                      {ttsTest.latencyMs ? `[${ttsTest.latencyMs}ms] ` : ""}
                      {ttsTest.summary}
                    </p>
                  )}
                </div>
              </>
            )}

            {settingsTab === "IMAGE" && (
              <>
                <div className="space-y-2">
                  <span className="block text-xs text-[#C9A882] font-medium">
                    立绘生成通道预设（供「30.0 人物库」实时绘制角色）
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(
                      Object.keys(IMAGE_PRESET_DEFAULTS) as ImageProviderPreset[]
                    ).map((key) => {
                      const preset = IMAGE_PRESET_DEFAULTS[key];
                      const active = settings.image.provider === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            soundFx.playCaliperTick();
                            updateSettings((cur) => ({
                              ...cur,
                              image: {
                                ...cur.image,
                                provider: key,
                                baseUrl: preset.baseUrl,
                                model: preset.model,
                              },
                            }));
                          }}
                          className={`p-3 rounded-sm border text-left transition-colors cursor-pointer ${
                            active
                              ? "border-[#E59A3C] bg-[#1F1610]"
                              : "border-[#F5D096]/14 bg-[#15100C]/70 hover:border-[#E59A3C]/40"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[#FDF5EB]">
                              {preset.label}
                            </span>
                            <span className="font-mono-num text-[10px] text-[#E59A3C]">
                              {key === "wasteland_flux" ? "免配直连" : "接口代理"}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#9E8874] mt-1 leading-snug">
                            {preset.subtitle}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs text-[#C9A882] mb-1">
                      生图接口地址 (Base URL)
                    </label>
                    <input
                      type="text"
                      value={settings.image.baseUrl}
                      onChange={(e) =>
                        updateSettings((cur) => ({
                          ...cur,
                          image: { ...cur.image, baseUrl: e.target.value },
                        }))
                      }
                      placeholder="https://image.pollinations.ai"
                      className="w-full rounded-xs border border-[#F5D096]/18 bg-[#0C0907] px-3 py-2 font-mono-num text-xs text-[#FAF0E6] focus:outline-none focus:border-[#E59A3C]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#C9A882] mb-1">
                      生图模型名称 (Model)
                    </label>
                    <input
                      type="text"
                      value={settings.image.model}
                      onChange={(e) =>
                        updateSettings((cur) => ({
                          ...cur,
                          image: { ...cur.image, model: e.target.value },
                        }))
                      }
                      placeholder="flux"
                      className="w-full rounded-xs border border-[#F5D096]/18 bg-[#0C0907] px-3 py-2 font-mono-num text-xs text-[#FAF0E6] focus:outline-none focus:border-[#E59A3C]"
                    />
                  </div>

                  <div className="rounded-xs border border-[#F5D096]/14 bg-[#15100C]/80 px-3 py-2 flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-[#9E8874]">
                      服务端密钥槽位（Secrets 面板或本地 .env）：
                    </span>
                    <span className="font-mono-num text-[#F7D7A8] shrink-0">
                      {settings.image.provider === "wasteland_flux" ||
                      settings.image.provider === "sd_webui"
                        ? "无需密钥（直连可用）"
                        : settings.image.provider === "modelscope"
                        ? `MODELSCOPE_API_KEY / IMAGE_API_KEY · ${
                            envStatus?.imageKeyConfigured ? "已注入" : "未配置"
                          }`
                        : `IMAGE_API_KEY · ${
                            envStatus?.imageKeyConfigured ? "已注入" : "未配置"
                          }`}
                    </span>
                  </div>

                  <label className="flex items-center justify-between gap-3 py-2 px-3 rounded-xs border border-[#F5D096]/14 bg-[#15100C]/75 cursor-pointer">
                    <div>
                      <span className="text-xs font-medium text-[#FDF5EB] block">
                        自动锁定废土手绘统一画风与纯白抠图底
                      </span>
                      <span className="text-[11px] text-[#9E8874]">
                        附加美漫粗黑勾线、旧黄铜水粉质感与纯白底描述，确保完美去背入戏
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.image.lockWastelandStyle}
                      onChange={(e) =>
                        updateSettings((cur) => ({
                          ...cur,
                          image: {
                            ...cur.image,
                            lockWastelandStyle: e.target.checked,
                          },
                        }))
                      }
                      className="accent-[#E59A3C] w-4 h-4 shrink-0"
                    />
                  </label>
                </div>

                <div className="pt-2 border-t border-[#F5D096]/12 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    disabled={imgTest.loading}
                    onClick={() => runApiConnectivityTest("image")}
                    className="px-4 py-2 rounded-xs border border-[#E59A3C]/65 bg-[#241912] hover:bg-[#E59A3C] hover:text-[#1B1410] text-xs font-semibold text-[#F7D7A8] transition-colors flex items-center gap-2 shrink-0 cursor-pointer"
                  >
                    {imgTest.loading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>生图连通测试</span>
                  </button>

                  <div className="flex items-center gap-3 min-w-0">
                    {imgTest.previewImageUrl && (
                      <div className="w-11 h-14 rounded-xs border border-[#E59A3C]/50 bg-[#0B0908] overflow-hidden shrink-0">
                        <CutoutSprite
                          src={imgTest.previewImageUrl}
                          alt="测试样图"
                          cropMode="none"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                    {imgTest.summary && (
                      <p
                        className={`text-xs font-mono-num leading-snug ${
                          imgTest.ok ? "text-emerald-400" : "text-[#EF6B63]"
                        }`}
                      >
                        {imgTest.latencyMs ? `[${imgTest.latencyMs}ms] ` : ""}
                        {imgTest.summary}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}

            {settingsTab === "AUDIO" && (
              <div className="space-y-4">
                {(
                  [
                    {
                      key: "bgm" as const,
                      label: "废土电台音乐 (BGM)",
                      desc: "白昼酒馆爵士蓝调与黑夜废墟寒风环境配乐",
                      enabled: settings.audio.bgmEnabled,
                      volume: settings.audio.bgmVolume,
                      iconOn: <Radio className="w-4 h-4 text-[#E59A3C]" />,
                      iconOff: <Radio className="w-4 h-4 text-[#7D6A59]" />,
                      onToggle: () =>
                        updateSettings((cur) => ({
                          ...cur,
                          audio: {
                            ...cur.audio,
                            bgmEnabled: !cur.audio.bgmEnabled,
                          },
                        })),
                      onVolume: (v: number) =>
                        updateSettings((cur) => ({
                          ...cur,
                          audio: { ...cur.audio, bgmVolume: v },
                        })),
                    },
                    {
                      key: "sfx" as const,
                      label: "环境与交互拟音 (SFX)",
                      desc: "摇酒壶、推杯、清点瓶盖、游标卡尺与卡牌打击声",
                      enabled: settings.audio.sfxEnabled,
                      volume: settings.audio.sfxVolume,
                      iconOn: <Volume2 className="w-4 h-4 text-[#E59A3C]" />,
                      iconOff: <VolumeX className="w-4 h-4 text-[#7D6A59]" />,
                      onToggle: () =>
                        updateSettings((cur) => ({
                          ...cur,
                          audio: {
                            ...cur.audio,
                            sfxEnabled: !cur.audio.sfxEnabled,
                          },
                        })),
                      onVolume: (v: number) =>
                        updateSettings((cur) => ({
                          ...cur,
                          audio: { ...cur.audio, sfxVolume: v },
                        })),
                    },
                    {
                      key: "tts" as const,
                      label: "自动角色语音播报 (TTS)",
                      desc: "酒客落座与品酒回话时自动朗读台词（播放时自动压低电台音量）",
                      enabled: settings.audio.ttsEnabled,
                      volume: settings.audio.ttsVolume,
                      iconOn: <Mic className="w-4 h-4 text-[#E59A3C]" />,
                      iconOff: <MicOff className="w-4 h-4 text-[#7D6A59]" />,
                      onToggle: () =>
                        updateSettings((cur) => ({
                          ...cur,
                          audio: {
                            ...cur.audio,
                            ttsEnabled: !cur.audio.ttsEnabled,
                          },
                        })),
                      onVolume: (v: number) =>
                        updateSettings((cur) => ({
                          ...cur,
                          audio: { ...cur.audio, ttsVolume: v },
                        })),
                    },
                  ] as const
                ).map((row) => (
                  <div
                    key={row.key}
                    className="p-4 rounded-sm border border-[#F5D096]/14 bg-[#16110D]/80 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        {row.enabled ? row.iconOn : row.iconOff}
                        <div>
                          <span className="text-xs font-semibold text-[#FDF5EB] block">
                            {row.label}
                          </span>
                          <span className="text-[11px] text-[#9E8874]">
                            {row.desc}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          soundFx.playCaliperTick();
                          row.onToggle();
                        }}
                        className={`px-3 py-1 rounded-xs border font-mono-num text-xs transition-colors cursor-pointer ${
                          row.enabled
                            ? "border-[#E59A3C]/70 bg-[#261B13] text-[#F7D7A8]"
                            : "border-[#F5D096]/16 bg-[#100C09] text-[#8C7765]"
                        }`}
                      >
                        {row.enabled ? "ON" : "MUTE"}
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={row.volume}
                        disabled={!row.enabled}
                        onChange={(e) => row.onVolume(Number(e.target.value))}
                        className="flex-1 accent-[#E59A3C] cursor-pointer disabled:opacity-35"
                      />
                      <span className="w-11 text-right font-mono-num text-xs text-[#E59A3C]">
                        {row.volume}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ==================== 30.0 人物库内容区 ==================== */
        <div className="flex-1 min-h-0 flex flex-col">
          {/* 二级细线导航栏 */}
          <div className="px-6 pt-3 border-b border-[#F5D096]/12 flex items-center gap-6 text-xs shrink-0 overflow-x-auto">
            {(
              [
                { id: "PROTAGONIST" as const, code: "01", label: "主角掌柜" },
                { id: "REGULARS" as const, code: "02", label: "现有熟客 (4)" },
                {
                  id: "CUSTOM" as const,
                  code: "03",
                  label: `原创酒客 (${roster.customPatrons.length})`,
                },
              ] as const
            ).map((tab) => {
              const active = rosterTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    soundFx.playCaliperTick();
                    setRosterTab(tab.id);
                  }}
                  className={`pb-2.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                    active
                      ? "border-[#E59A3C] text-[#FDF5EB] font-semibold"
                      : "border-transparent text-[#9E8874] hover:text-[#E6D5C3]"
                  }`}
                >
                  <span className="font-mono-num text-[10px] text-[#E59A3C]/85">
                    {tab.code}
                  </span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
            {/* 01 · 自定义主角掌柜 */}
            {rosterTab === "PROTAGONIST" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-display text-base font-bold text-[#FDF5EB]">
                      零号酒馆掌柜 · 形象档案
                    </h4>
                    <p className="text-[11px] text-[#9E8874]">
                      自定义状态栏肖像与黑夜据点探索 / 卡牌战斗时的全身站姿立绘
                    </p>
                  </div>
                </div>

                <DualPortraitWorkbench
                  subjectLabel="酒馆掌柜"
                  portraitLabel="日常状态肖像"
                  combatLabel="黑夜全身战斗立绘"
                  portraitSrc={
                    roster.protagonist.avatarUrl ||
                    ARTWORK_ASSETS.charBartenderAvatar
                  }
                  combatSrc={
                    roster.protagonist.combatSpriteUrl ||
                    ARTWORK_ASSETS.charBartenderScavenger
                  }
                  defaultPromptHint="rugged wasteland tavern bartender wearing brass goggles, leather apron over armored trench coat, holding a modified shotgun"
                  canReset={Boolean(
                    roster.protagonist.avatarUrl ||
                      roster.protagonist.combatSpriteUrl
                  )}
                  onApplyPortrait={(dataUrl) => {
                    const next = structuredClone(loadCharacterRoster());
                    next.protagonist.avatarUrl = dataUrl;
                    saveCharacterRoster(next);
                    onRosterUpdated?.(false);
                  }}
                  onApplyCombatSprite={(dataUrl) => {
                    const next = structuredClone(loadCharacterRoster());
                    next.protagonist.combatSpriteUrl = dataUrl;
                    saveCharacterRoster(next);
                    onRosterUpdated?.(false);
                  }}
                  onResetBoth={() => {
                    const next = structuredClone(loadCharacterRoster());
                    next.protagonist = {};
                    saveCharacterRoster(next);
                    onRosterUpdated?.(false);
                  }}
                />
              </div>
            )}

            {/* 02 · 替换现有熟客双立绘 */}
            {rosterTab === "REGULARS" && (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  {MAIN_NPC_ORDER.map((npcId) => {
                    const p = NPC_PROFILES[npcId];
                    const hasOv = Boolean(
                      roster.npcOverrides[npcId]?.portraitUrl ||
                        roster.npcOverrides[npcId]?.combatSpriteUrl
                    );
                    const active = selectedRegularId === npcId;
                    return (
                      <button
                        key={npcId}
                        type="button"
                        onClick={() => {
                          soundFx.playCaliperTick();
                          setSelectedRegularId(npcId);
                        }}
                        className={`px-2.5 py-2 rounded-sm border text-left transition-colors cursor-pointer ${
                          active
                            ? "border-[#E59A3C] bg-[#211711]"
                            : "border-[#F5D096]/14 bg-[#140F0C]/70 hover:border-[#E59A3C]/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold text-[#FDF5EB] truncate">
                            {p.name}
                          </span>
                          {hasOv && (
                            <span className="w-1.5 h-1.5 bg-[#E59A3C] shrink-0" />
                          )}
                        </div>
                        <span className="text-[10px] text-[#9E8874] block truncate mt-0.5">
                          {p.title}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <DualPortraitWorkbench
                  subjectLabel={regularBase.name}
                  portraitLabel="白昼吧台立绘"
                  combatLabel="黑夜助战全身立绘"
                  portraitSrc={
                    regularOverride?.portraitUrl ||
                    regularBase.portraitUrl ||
                    ARTWORK_ASSETS.ashScavenger
                  }
                  combatSrc={
                    regularOverride?.combatSpriteUrl || regularDefaultCombatUrl
                  }
                  defaultPromptHint={`${regularBase.name}, ${regularBase.title}, wasteland survivor in weathered gear`}
                  canReset={Boolean(
                    regularOverride?.portraitUrl ||
                      regularOverride?.combatSpriteUrl
                  )}
                  onApplyPortrait={(dataUrl) => {
                    const next = structuredClone(loadCharacterRoster());
                    next.npcOverrides[selectedRegularId] = {
                      ...(next.npcOverrides[selectedRegularId] || {}),
                      portraitUrl: dataUrl,
                    };
                    saveCharacterRoster(next);
                    onRosterUpdated?.(false);
                  }}
                  onApplyCombatSprite={(dataUrl) => {
                    const next = structuredClone(loadCharacterRoster());
                    next.npcOverrides[selectedRegularId] = {
                      ...(next.npcOverrides[selectedRegularId] || {}),
                      combatSpriteUrl: dataUrl,
                    };
                    saveCharacterRoster(next);
                    onRosterUpdated?.(false);
                  }}
                  onResetBoth={() => {
                    const next = structuredClone(loadCharacterRoster());
                    delete next.npcOverrides[selectedRegularId];
                    saveCharacterRoster(next);
                    onRosterUpdated?.(false);
                  }}
                />
              </div>
            )}

            {/* 03 · 新建与管理原创酒客 */}
            {rosterTab === "CUSTOM" && (
              <div className="space-y-3.5">
                {/* 已收录原创角色条 */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playCaliperTick();
                      startBlankCustomPatron();
                    }}
                    className={`px-3 py-1.5 rounded-xs border text-xs flex items-center gap-1.5 cursor-pointer ${
                      editingCustomId === "NEW"
                        ? "border-[#E59A3C] bg-[#241912] text-[#FDF5EB] font-semibold"
                        : "border-[#F5D096]/18 bg-[#140F0C] text-[#C9A882] hover:border-[#E59A3C]/50"
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5 text-[#E59A3C]" />
                    新建原创酒客
                  </button>

                  {roster.customPatrons.map((rec) => {
                    const selected = editingCustomId === rec.id;
                    return (
                      <div
                        key={rec.id}
                        className={`flex items-center rounded-xs border ${
                          selected
                            ? "border-[#E59A3C] bg-[#241912]"
                            : "border-[#F5D096]/16 bg-[#15100C]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            soundFx.playCaliperTick();
                            selectCustomForEdit(rec);
                          }}
                          className="px-2.5 py-1.5 text-xs text-[#FDF5EB] cursor-pointer"
                        >
                          {rec.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomPatron(rec.id)}
                          className="px-1.5 py-1.5 text-[#8C7765] hover:text-[#EF6B63] cursor-pointer"
                          title="移出人物库"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* 人设字段表单 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-[#C9A882] mb-1">
                      姓名
                    </label>
                    <input
                      type="text"
                      value={draftCustom.name}
                      onChange={(e) =>
                        setDraftCustom((d) => ({ ...d, name: e.target.value }))
                      }
                      placeholder="例：红隼 / 老铁砧"
                      className="w-full rounded-xs border border-[#F5D096]/18 bg-[#0C0907] px-2.5 py-1.5 text-xs text-[#FAF0E6] focus:outline-none focus:border-[#E59A3C]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#C9A882] mb-1">
                      头衔身份
                    </label>
                    <input
                      type="text"
                      value={draftCustom.title}
                      onChange={(e) =>
                        setDraftCustom((d) => ({ ...d, title: e.target.value }))
                      }
                      placeholder="荒原赏金猎人"
                      className="w-full rounded-xs border border-[#F5D096]/18 bg-[#0C0907] px-2.5 py-1.5 text-xs text-[#FAF0E6] focus:outline-none focus:border-[#E59A3C]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#C9A882] mb-1">
                      所属派系
                    </label>
                    <input
                      type="text"
                      value={draftCustom.faction}
                      onChange={(e) =>
                        setDraftCustom((d) => ({
                          ...d,
                          faction: e.target.value,
                        }))
                      }
                      placeholder="自由拾荒盟"
                      className="w-full rounded-xs border border-[#F5D096]/18 bg-[#0C0907] px-2.5 py-1.5 text-xs text-[#FAF0E6] focus:outline-none focus:border-[#E59A3C]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-[#C9A882] mb-1">
                      性格背景（供白昼 LLM 扮演）
                    </label>
                    <textarea
                      rows={2}
                      value={draftCustom.personaPrompt}
                      onChange={(e) =>
                        setDraftCustom((d) => ({
                          ...d,
                          personaPrompt: e.target.value,
                          bio: e.target.value,
                        }))
                      }
                      placeholder="描述角色过往经历、性格底色与来酒馆的目的…"
                      className="w-full rounded-xs border border-[#F5D096]/18 bg-[#0C0907] px-2.5 py-1.5 text-xs text-[#FAF0E6] focus:outline-none focus:border-[#E59A3C] resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#C9A882] mb-1">
                      说话口吻与夜间助战技
                    </label>
                    <input
                      type="text"
                      value={draftCustom.speechStyle}
                      onChange={(e) =>
                        setDraftCustom((d) => ({
                          ...d,
                          speechStyle: e.target.value,
                        }))
                      }
                      placeholder="说话口吻，如：沙哑豪爽、爱开冷玩笑"
                      className="w-full rounded-xs border border-[#F5D096]/18 bg-[#0C0907] px-2.5 py-1.5 text-xs text-[#FAF0E6] focus:outline-none focus:border-[#E59A3C] mb-1.5"
                    />
                    <select
                      value={draftCustom.companionSkillKind}
                      onChange={(e) =>
                        setDraftCustom((d) => ({
                          ...d,
                          companionSkillKind: e.target
                            .value as CompanionSkillKind,
                        }))
                      }
                      className="w-full rounded-xs border border-[#F5D096]/18 bg-[#0C0907] px-2.5 py-1.5 text-xs text-[#F7D7A8] focus:outline-none focus:border-[#E59A3C]"
                    >
                      {(
                        Object.keys(
                          COMPANION_SKILL_PRESETS
                        ) as CompanionSkillKind[]
                      ).map((k) => (
                        <option key={k} value={k}>
                          助战技：{COMPANION_SKILL_PRESETS[k].name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 饮酒口味偏好快选 */}
                <div className="space-y-1">
                  <span className="block text-[11px] text-[#C9A882]">
                    偏爱饮品风味（点击切换，匹配调酒可快速提升信任邀约夜探）：
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {FLAVOR_TAG_OPTIONS.map((tag) => {
                      const liked = draftCustom.favoriteNotes.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() =>
                            setDraftCustom((d) => {
                              const exists = d.favoriteNotes.includes(tag);
                              const nextFav = exists
                                ? d.favoriteNotes.filter((t) => t !== tag)
                                : [...d.favoriteNotes.slice(0, 3), tag];
                              return {
                                ...d,
                                favoriteNotes: nextFav,
                                dislikedNotes: d.dislikedNotes.filter(
                                  (t) => t !== tag
                                ),
                              };
                            })
                          }
                          className={`px-2 py-0.5 rounded-xs border text-[11px] cursor-pointer ${
                            liked
                              ? "border-[#E59A3C] bg-[#291C12] text-[#F7D7A8]"
                              : "border-[#F5D096]/14 bg-[#120D0A] text-[#9E8874] hover:text-[#FAF0E6]"
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 原创酒客双立绘工作台 */}
                <DualPortraitWorkbench
                  subjectLabel={draftCustom.name || "原创酒客"}
                  portraitLabel="白昼进店立绘"
                  combatLabel="黑夜同行战斗立绘"
                  portraitSrc={draftCustom.portraitUrl}
                  combatSrc={draftCustom.combatSpriteUrl}
                  defaultPromptHint={
                    draftCustom.name
                      ? `${draftCustom.title} ${draftCustom.name}, post-apocalyptic wasteland survivor, distinct outfit and weapon`
                      : "charismatic wasteland bounty hunter in patched duster coat with brass shoulder armor and revolver"
                  }
                  onApplyPortrait={(dataUrl) =>
                    setDraftCustom((d) => ({
                      ...d,
                      portraitUrl: dataUrl,
                      combatSpriteUrl:
                        d.combatSpriteUrl === ARTWORK_ASSETS.charNeutralSurvivor
                          ? dataUrl
                          : d.combatSpriteUrl,
                    }))
                  }
                  onApplyCombatSprite={(dataUrl) =>
                    setDraftCustom((d) => ({ ...d, combatSpriteUrl: dataUrl }))
                  }
                />

                {/* 保存入库操作行 */}
                <div className="pt-2 border-t border-[#F5D096]/14 flex flex-wrap items-center justify-between gap-2.5">
                  <label className="flex items-center gap-2 text-xs text-[#C9A882] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draftCustom.enabled !== false}
                      onChange={(e) =>
                        setDraftCustom((d) => ({
                          ...d,
                          enabled: e.target.checked,
                        }))
                      }
                      className="accent-[#E59A3C]"
                    />
                    允许在营业日推门光顾酒馆
                  </label>

                  <div className="flex items-center gap-2">
                    {inDayTavern && (
                      <button
                        type="button"
                        onClick={() => handleSaveCustomPatron(true)}
                        className="px-3 py-2 rounded-xs border border-[#E59A3C]/65 bg-[#241912] hover:bg-[#332319] text-xs font-semibold text-[#F7D7A8] flex items-center gap-1.5 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-[#E59A3C]" />
                        保存并排入今日队列
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSaveCustomPatron(false)}
                      className="px-4 py-2 rounded-xs bg-[#E59A3C] hover:bg-[#F0A84B] text-[#1B1410] text-xs font-bold cursor-pointer"
                    >
                      保存至人物库
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (presentation === "title_inline") {
    return panelBody;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/62 backdrop-blur-[2px] flex items-center justify-end p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={mode === "SETTINGS" ? "系统设置" : "人物库"}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {panelBody}
    </div>
  );
};
