/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Radio, SlidersHorizontal, Users } from "lucide-react";
import { CodexOverlayModal } from "./components/CodexOverlayModal";
import { DayTavernView } from "./components/DayTavernView";
import { NightRoguelikeView } from "./components/NightRoguelikeView";
import { PipBoyDuskView } from "./components/PipBoyDuskView";
import {
  DrawerPanelMode,
  SettingsAndRosterDrawer,
} from "./components/SettingsAndRosterDrawer";
import {
  EndingView,
  ManualSaveSlot,
  SaveAndPresetModal,
  TitleScreen,
} from "./components/TransitionAndSaveModals";
import {
  CARD_LIBRARY,
  generateDailyBulletins,
  WEATHER_CYCLE,
  resolveNpcProfile,
} from "./data/gameConfig";
import {
  ensureRpgState,
  getNormalizedDeckCards,
  syncDeckDefIdsFromDeckCards,
} from "./data/rpgAndCards";
import {
  LLM_PRESET_DEFAULTS,
  loadSystemSettings,
  saveSystemSettings,
  useSettingsAndRoster,
} from "./data/settingsAndRosterStore";
import { DEFAULT_UNLOCKED_LORE_IDS } from "./data/wastelandLore";
import {
  allocateRpgStatPoint,
  attemptCombatPersuade,
  closeWorkbenchToExplore,
  createInitialCampaign,
  createJudgeShowcasePreset,
  createNightRunState,
  draftNightCardReward,
  endPlayerCombatTurn,
  interactBuildingObject,
  inviteNightCompanion,
  mergeLootBags,
  moveAndStepBuildingExplore,
  nowTimeLabel,
  playCombatCard,
  populateDailyQueueWithDrifter,
  pushTavernRumor,
  RawLlmTurnInput,
  resolvePendingOfferChoice,
  resolveShowdownVerdict,
  resolveSurvivorParley,
  seedActiveRumor,
  selectNightCityLocation,
  selectRpgPerk,
  startBuildingPatrolCombat,
  summonExtraProceduralPatron,
  syncCustomPatronsIntoCampaign,
  uid,
  upgradeDeckCard,
  validateAndApplyNpcTurn,
} from "./engine/ruleEngine";
import {
  CampaignSaveState,
  CityLocationId,
  CraftedDrink,
  IngredientId,
  NpcId,
  RpgAttributeKey,
  ShowdownVerdictChoice,
  WorkspaceTab,
} from "./types/game";
import { soundFx } from "./utils/sound";

const AUTO_SAVE_KEY = "wasteland_tavern_save_v1";
const SLOTS_SAVE_KEY = "wasteland_tavern_slots_v1";

function normalizeLoadedCampaign(parsed: CampaignSaveState): CampaignSaveState {
  const copy = structuredClone(parsed);
  copy.activeRumors = copy.activeRumors || [];
  if (copy.bgmEnabled === undefined) copy.bgmEnabled = true;
  if (copy.ttsEnabled === undefined) copy.ttsEnabled = true;
  if (!copy.unlockedLoreIds || copy.unlockedLoreIds.length === 0) {
    copy.unlockedLoreIds = [...DEFAULT_UNLOCKED_LORE_IDS];
  }
  if (!copy.dailyBulletins || copy.dailyBulletins.length === 0) {
    const queueProfiles = (copy.todayQueue || []).map((id) =>
      resolveNpcProfile(copy, id)
    );
    copy.dailyBulletins = generateDailyBulletins(copy.day || 1, queueProfiles);
  }
  ensureRpgState(copy);
  copy.deckCards = getNormalizedDeckCards(copy);
  syncDeckDefIdsFromDeckCards(copy);
  if (copy.nightRun && copy.nightRun.nodeMode === "MAP") {
    copy.nightRun = createNightRunState(copy);
  }
  return copy;
}

function getLatestNpcLineId(target: CampaignSaveState): string {
  for (let i = target.dialogueHistory.length - 1; i >= 0; i--) {
    if (target.dialogueHistory[i].speaker === "NPC") {
      return target.dialogueHistory[i].id;
    }
  }
  return "";
}

function loadAutoSaveFromStorage(): CampaignSaveState | null {
  try {
    const raw = localStorage.getItem(AUTO_SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CampaignSaveState;
    if (parsed && typeof parsed.day === "number" && parsed.npcs) {
      return normalizeLoadedCampaign(parsed);
    }
    return null;
  } catch {
    return null;
  }
}

function loadSlotsFromStorage(): Record<1 | 2 | 3, ManualSaveSlot | null> {
  const empty: Record<1 | 2 | 3, ManualSaveSlot | null> = {
    1: null,
    2: null,
    3: null,
  };
  try {
    const raw = localStorage.getItem(SLOTS_SAVE_KEY);
    if (!raw) return empty;
    return { ...empty, ...JSON.parse(raw) };
  } catch {
    return empty;
  }
}

export default function App() {
  const [autoSavePreview, setAutoSavePreview] =
    useState<CampaignSaveState | null>(() => loadAutoSaveFromStorage());
  const [manualSlots, setManualSlots] = useState<
    Record<1 | 2 | 3, ManualSaveSlot | null>
  >(() => loadSlotsFromStorage());

  const [state, setState] = useState<CampaignSaveState>(() =>
    createInitialCampaign()
  );
  const { settings } = useSettingsAndRoster();
  const [codexTab, setCodexTab] = useState<Exclude<
    WorkspaceTab,
    "STAGE"
  > | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [inGameDrawerMode, setInGameDrawerMode] =
    useState<DrawerPanelMode | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [toastBanner, setToastBanner] = useState<string | null>(null);
  const [providerInfo, setProviderInfo] = useState<{
    provider: string;
    modelName: string;
  } | null>(null);

  const greetedKeyRef = useRef<string>("");
  const lastSpokenLineIdRef = useRef<string>("");

  // 同步音效/电台BGM/角色TTS及三级音量滑杆与自动写入本地进度
  useEffect(() => {
    soundFx.setEnabled(state.soundEnabled);
    soundFx.setBgmEnabled(state.bgmEnabled !== false);
    soundFx.setTtsEnabled(state.ttsEnabled !== false);
    soundFx.setVolumes({
      bgmVolume: settings.audio.bgmVolume,
      sfxVolume: settings.audio.sfxVolume,
      ttsVolume: settings.audio.ttsVolume,
    });
    soundFx.setScenePhase(state.phase);
    if (state.phase !== "TITLE") {
      try {
        localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(state));
        setAutoSavePreview(state);
      } catch {
        // ignore storage quota errors
      }
    }
  }, [state, settings.audio]);

  // 当白昼酒馆收到新生成的 NPC 台词时，自动按人物声线朗读语音
  useEffect(() => {
    if (state.phase !== "DAY_TAVERN" || state.ttsEnabled === false) return;
    const latestId = getLatestNpcLineId(state);
    if (!latestId || latestId === lastSpokenLineIdRef.current) return;
    lastSpokenLineIdRef.current = latestId;

    const latestLine = state.dialogueHistory.find((d) => d.id === latestId);
    const currentNpcId = state.todayQueue[state.currentQueueIndex];
    if (!latestLine || !currentNpcId) return;
    const profile = resolveNpcProfile(state, currentNpcId);
    const npcState = state.npcs[currentNpcId];
    soundFx.speakNpcLine({
      lineId: latestLine.id,
      text: latestLine.text,
      profile,
      intoxication: npcState?.intoxication || 0,
    });
  }, [state]);

  const handleToggleSound = useCallback(() => {
    setState((prev) => {
      const nextVal = !prev.soundEnabled;
      const cur = loadSystemSettings();
      saveSystemSettings({
        ...cur,
        audio: { ...cur.audio, sfxEnabled: nextVal },
      });
      return { ...prev, soundEnabled: nextVal };
    });
  }, []);

  const handleToggleBgm = useCallback(() => {
    setState((prev) => {
      const nextVal = prev.bgmEnabled === false;
      const cur = loadSystemSettings();
      saveSystemSettings({
        ...cur,
        audio: { ...cur.audio, bgmEnabled: nextVal },
      });
      return { ...prev, bgmEnabled: nextVal };
    });
  }, []);

  const handleToggleTts = useCallback(() => {
    setState((prev) => {
      const nextVal = prev.ttsEnabled === false;
      const cur = loadSystemSettings();
      saveSystemSettings({
        ...cur,
        audio: { ...cur.audio, ttsEnabled: nextVal },
      });
      return { ...prev, ttsEnabled: nextVal };
    });
  }, []);

  const handleAudioFlagsSynced = useCallback(
    (flags: { bgmEnabled: boolean; sfxEnabled: boolean; ttsEnabled: boolean }) => {
      setState((prev) => ({
        ...prev,
        bgmEnabled: flags.bgmEnabled,
        soundEnabled: flags.sfxEnabled,
        ttsEnabled: flags.ttsEnabled,
      }));
    },
    []
  );

  const handleRosterUpdated = useCallback((appendToTodayQueue?: boolean) => {
    setState((prev) =>
      syncCustomPatronsIntoCampaign(prev, Boolean(appendToTodayQueue))
    );
  }, []);

  useEffect(() => {
    fetch("/api/provider-info")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.provider) {
          setProviderInfo(data);
          // 若当前浏览器尚未手动保存过设置，且服务端默认处于魔搭 ModelScope 环境，自动对齐预设通道
          if (
            !localStorage.getItem("wasteland_system_settings_v1") &&
            (data.provider === "modelscope" || data.provider === "opencode")
          ) {
            const cur = loadSystemSettings();
            const providerKey =
              data.provider === "modelscope" ? "modelscope" : "opencode";
            const preset = LLM_PRESET_DEFAULTS[providerKey];
            saveSystemSettings({
              ...cur,
              llm: {
                ...cur.llm,
                provider: providerKey,
                baseUrl: preset.baseUrl,
                model: data.modelName || preset.model,
              },
            });
          }
        }
      })
      .catch(() => {});
  }, []);

  const showBanner = useCallback((msg: string | null) => {
    if (!msg) return;
    setToastBanner(msg);
  }, []);

  useEffect(() => {
    if (!toastBanner) return;
    const timer = setTimeout(() => setToastBanner(null), 4500);
    return () => clearTimeout(timer);
  }, [toastBanner]);

  const handleSaveToManualSlot = (slotId: 1 | 2 | 3) => {
    const d = new Date();
    const savedAt = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes()
    ).padStart(2, "0")}`;

    const nextSlots: Record<1 | 2 | 3, ManualSaveSlot | null> = {
      ...manualSlots,
      [slotId]: {
        slotId,
        savedAt,
        state: structuredClone(state),
      },
    };
    setManualSlots(nextSlots);
    try {
      localStorage.setItem(SLOTS_SAVE_KEY, JSON.stringify(nextSlots));
    } catch {
      // ignore quota error
    }
    showBanner(`已记录至归档位 0${slotId}`);
  };

  // 白昼新客人推门进店自动请求开场白
  const triggerPatronGreeting = useCallback(
    async (targetState: CampaignSaveState) => {
      const npcId: NpcId = targetState.todayQueue[targetState.currentQueueIndex];
      const profile = resolveNpcProfile(targetState, npcId);
      const npcState = targetState.npcs[npcId] || {
        id: npcId,
        trust: 42,
        intoxication: 0,
        tension: 24,
        debtCaps: 0,
        visits: 0,
        unlockedCardGiven: false,
        intelSharedToday: false,
        memories: [],
      };
      const weatherDesc =
        WEATHER_CYCLE[(targetState.day - 1) % WEATHER_CYCLE.length];

      setIsLoadingAi(true);
      setAiError(null);
      soundFx.playDoorBell();

      try {
        const resp = await fetch("/api/npc/greet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            npc: {
              id: profile.id,
              name: profile.name,
              title: profile.title,
              faction: profile.faction,
              personaPrompt: profile.personaPrompt,
              speechStyle: profile.speechStyle,
              favoriteNotes: profile.favoriteNotes,
              dislikedNotes: profile.dislikedNotes,
              secretAgenda: profile.secretAgenda
                ? {
                    ...profile.secretAgenda,
                    clueAlreadyExposed: Boolean(npcState.clueExposed),
                  }
                : undefined,
            },
            stats: {
              trust: npcState.trust,
              intoxication: npcState.intoxication,
              tension: npcState.tension,
              debtCaps: npcState.debtCaps,
              visits: npcState.visits,
              unlockedCardGiven: npcState.unlockedCardGiven,
            },
            memories: npcState.memories,
            activeRumors: targetState.activeRumors || [],
            day: targetState.day,
            weatherDesc,
            llmConfig: loadSystemSettings().llm,
          }),
        });

        const data = await resp.json();
        if (!resp.ok || data.error) {
          throw new Error(data.error || `请求失败 (${resp.status})`);
        }

        setState((prev) => {
          const resolution = validateAndApplyNpcTurn(
            prev,
            npcId,
            data as RawLlmTurnInput
          );
          if (resolution.systemBanner) {
            soundFx.playBottleCaps();
            showBanner(resolution.systemBanner);
          }
          return resolution.nextState;
        });
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "角色进门问候生成失败，请重试。";
        setAiError(msg);
      } finally {
        setIsLoadingAi(false);
      }
    },
    [showBanner]
  );

  useEffect(() => {
    if (
      state.phase === "DAY_TAVERN" &&
      state.dialogueHistory.length === 0 &&
      !isLoadingAi
    ) {
      const key = `d${state.day}_q${state.currentQueueIndex}`;
      if (greetedKeyRef.current !== key) {
        greetedKeyRef.current = key;
        triggerPatronGreeting(state);
      }
    }
  }, [state, isLoadingAi, triggerPatronGreeting]);

  const handleSendChat = async (message: string) => {
    const npcId = state.todayQueue[state.currentQueueIndex];
    const profile = resolveNpcProfile(state, npcId);
    const npcState = state.npcs[npcId];
    const weatherDesc = WEATHER_CYCLE[(state.day - 1) % WEATHER_CYCLE.length];

    const updatedHistory = [
      ...state.dialogueHistory,
      {
        id: uid("dlg"),
        speaker: "PLAYER" as const,
        speakerName: "酒馆老板",
        text: message,
        timestamp: nowTimeLabel(),
      },
    ];

    setState((prev) => ({
      ...prev,
      dialogueHistory: updatedHistory,
    }));
    setIsLoadingAi(true);
    setAiError(null);

    try {
      const resp = await fetch("/api/npc/interact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          npc: {
            id: profile.id,
            name: profile.name,
            title: profile.title,
            faction: profile.faction,
            personaPrompt: profile.personaPrompt,
            speechStyle: profile.speechStyle,
            favoriteNotes: profile.favoriteNotes,
            dislikedNotes: profile.dislikedNotes,
            secretAgenda: profile.secretAgenda
              ? {
                  ...profile.secretAgenda,
                  clueAlreadyExposed: Boolean(npcState.clueExposed),
                }
              : undefined,
          },
          stats: {
            trust: npcState.trust,
            intoxication: npcState.intoxication,
            tension: npcState.tension,
            debtCaps: npcState.debtCaps,
            visits: npcState.visits,
            unlockedCardGiven: npcState.unlockedCardGiven,
          },
          memories: npcState.memories,
          activeRumors: state.activeRumors || [],
          day: state.day,
          weatherDesc,
          dialogueHistory: updatedHistory.map((d) => ({
            speaker: d.speakerName,
            text: d.text,
          })),
          playerMessage: message,
          llmConfig: loadSystemSettings().llm,
        }),
      });

      const data = await resp.json();
      if (!resp.ok || data.error) {
        throw new Error(data.error || `请求失败 (${resp.status})`);
      }

      setState((prev) => {
        const resolution = validateAndApplyNpcTurn(
          prev,
          npcId,
          data as RawLlmTurnInput,
          undefined,
          message
        );
        if (resolution.systemBanner) {
          soundFx.playBottleCaps();
          showBanner(resolution.systemBanner);
        }
        return resolution.nextState;
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "对话请求异常，请稍后重试。";
      setAiError(msg);
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleServeDrink = async (drink: CraftedDrink, note: string) => {
    const npcId = state.todayQueue[state.currentQueueIndex];
    const profile = resolveNpcProfile(state, npcId);
    const npcState = state.npcs[npcId];
    const weatherDesc = WEATHER_CYCLE[(state.day - 1) % WEATHER_CYCLE.length];

    const nextInv = { ...state.inventory };
    if (drink.pourStyle === "watered") {
      [drink.ingredients[0], drink.ingredients[1], "rad_water" as IngredientId].forEach(
        (id) => {
          nextInv[id] = Math.max(0, (nextInv[id] || 0) - 1);
        }
      );
    } else {
      drink.ingredients.forEach((id) => {
        nextInv[id] = Math.max(0, (nextInv[id] || 0) - 1);
      });
      if (drink.pourStyle === "generous") {
        const extraId = drink.ingredients[0];
        nextInv[extraId] = Math.max(0, (nextInv[extraId] || 0) - 1);
      }
    }

    const pourLabel =
      drink.pourStyle === "generous"
        ? "（特意多倒了满满半杯）"
        : drink.pourStyle === "watered"
        ? "（悄悄兑了辐射水省料）"
        : "";

    const actionText = `推过一杯调制好的《${drink.name}》${pourLabel}${
      note ? `：「${note}」` : "。"
    }`;

    const updatedHistory = [
      ...state.dialogueHistory,
      {
        id: uid("dlg"),
        speaker: "PLAYER" as const,
        speakerName: "酒馆老板 · 递酒",
        text: actionText,
        servedDrinkVisual: {
          name: drink.name,
          imageUrl: drink.imageUrl,
          ingredientsText: drink.ingredientsText,
          pourStyle: drink.pourStyle,
          suggestedPrice: drink.suggestedPrice,
          potency: drink.potency,
          soothing: drink.soothing,
          purification: drink.purification,
        },
        timestamp: nowTimeLabel(),
      },
    ];

    soundFx.playPourDrink();
    setState((prev) => ({
      ...prev,
      inventory: nextInv,
      dialogueHistory: updatedHistory,
    }));
    setIsLoadingAi(true);
    setAiError(null);

    const matchedPreferences = drink.flavorTags.filter((t) =>
      profile.favoriteNotes.includes(t)
    );
    const triggeredDislike = drink.flavorTags.some((t) =>
      profile.dislikedNotes.includes(t)
    );

    try {
      const resp = await fetch("/api/npc/interact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          npc: {
            id: profile.id,
            name: profile.name,
            title: profile.title,
            faction: profile.faction,
            personaPrompt: profile.personaPrompt,
            speechStyle: profile.speechStyle,
            favoriteNotes: profile.favoriteNotes,
            dislikedNotes: profile.dislikedNotes,
            secretAgenda: profile.secretAgenda
              ? {
                  ...profile.secretAgenda,
                  clueAlreadyExposed: Boolean(npcState.clueExposed),
                }
              : undefined,
          },
          stats: {
            trust: npcState.trust,
            intoxication: npcState.intoxication,
            tension: npcState.tension,
            debtCaps: npcState.debtCaps,
            visits: npcState.visits,
            unlockedCardGiven: npcState.unlockedCardGiven,
          },
          memories: npcState.memories,
          activeRumors: state.activeRumors || [],
          day: state.day,
          weatherDesc,
          dialogueHistory: updatedHistory.map((d) => ({
            speaker: d.speakerName,
            text: d.text,
          })),
          playerMessage: note,
          servedDrink: {
            name: drink.name,
            ingredientsText: drink.ingredientsText,
            pourStyle: drink.pourStyle,
            potency: drink.potency,
            soothing: drink.soothing,
            purification: drink.purification,
            suggestedPrice: drink.suggestedPrice,
            matchedPreferences,
            triggeredDislike,
          },
          llmConfig: loadSystemSettings().llm,
        }),
      });

      const data = await resp.json();
      if (!resp.ok || data.error) {
        throw new Error(data.error || `递酒品鉴请求失败 (${resp.status})`);
      }

      setState((prev) => {
        const resolution = validateAndApplyNpcTurn(
          prev,
          npcId,
          data as RawLlmTurnInput,
          drink,
          note
        );
        if (resolution.systemBanner) {
          soundFx.playBottleCaps();
          showBanner(resolution.systemBanner);
        } else if (resolution.nextState.pendingOffer?.type === "BRAWL_CRISIS") {
          soundFx.playAlert();
        }
        return resolution.nextState;
      });
    } catch (err: unknown) {
      setState((prev) => ({
        ...prev,
        inventory: state.inventory,
      }));
      const msg =
        err instanceof Error
          ? err.message
          : "递酒响应失败，已退还配料，请重试。";
      setAiError(msg);
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleResolveOffer = (
    accept: boolean,
    diceMode?: "PRIMARY_DICE" | "ALT_DICE"
  ) => {
    const { nextState, banner } = resolvePendingOfferChoice(
      state,
      accept,
      diceMode
    );
    if (accept || diceMode) {
      soundFx.playBottleCaps();
    } else {
      soundFx.playAlert();
    }
    showBanner(banner);
    setState({
      ...nextState,
      dialogueHistory: [
        ...nextState.dialogueHistory,
        {
          id: uid("sys"),
          speaker: "SYSTEM",
          speakerName: "吧台账本",
          text: banner,
          timestamp: nowTimeLabel(),
        },
      ],
    });
  };

  const handleAllocateStat = (attr: RpgAttributeKey) => {
    const { nextState, banner } = allocateRpgStatPoint(state, attr);
    if (banner) {
      soundFx.playPipBoyBeep();
      showBanner(banner);
    }
    setState(nextState);
  };

  const handleSelectPerk = (perkId: string) => {
    const { nextState, banner } = selectRpgPerk(state, perkId);
    if (banner) {
      soundFx.playVerdictStamp();
      showBanner(banner);
    }
    setState(nextState);
  };

  const handleUpgradeCard = (cardUid: string, preferBuildingScrap = false) => {
    const { nextState, banner } = upgradeDeckCard(
      state,
      cardUid,
      preferBuildingScrap
    );
    if (banner) {
      soundFx.playBottleCaps();
      showBanner(banner);
    }
    setState(nextState);
  };

  const handleResolveShowdown = (choice: ShowdownVerdictChoice) => {
    const npcId = state.todayQueue[state.currentQueueIndex];
    const { nextState, banner } = resolveShowdownVerdict(state, npcId, choice);
    if (!banner) return;
    soundFx.playVerdictStamp();
    if (choice === "EXPOSE_BOUNTY") {
      soundFx.playAlert();
    } else {
      soundFx.playBottleCaps();
    }
    showBanner(banner);
    setState(nextState);
  };

  const handleSeedRumor = (templateId: string) => {
    const npcId = state.todayQueue[state.currentQueueIndex];
    const { nextState, banner } = seedActiveRumor(state, npcId, templateId);
    if (banner) {
      soundFx.playPaperRustle();
      showBanner(banner);
    }
    setState(nextState);
  };

  const handleInviteCompanion = () => {
    const npcId = state.todayQueue[state.currentQueueIndex];
    const { nextState, banner } = inviteNightCompanion(state, npcId);
    if (banner) {
      soundFx.playBottleCaps();
      showBanner(banner);
    }
    setState(nextState);
  };

  const handleNextPatronOrDusk = () => {
    soundFx.stopSpeaking();
    const currentNpcId = state.todayQueue[state.currentQueueIndex];
    const nextNpcs = structuredClone(state.npcs);
    if (nextNpcs[currentNpcId]) {
      nextNpcs[currentNpcId].visits += 1;
    }

    if (state.currentQueueIndex < state.todayQueue.length - 1) {
      greetedKeyRef.current = "";
      lastSpokenLineIdRef.current = "";
      setState({
        ...state,
        npcs: nextNpcs,
        currentQueueIndex: state.currentQueueIndex + 1,
        currentTurnServedDrink: false,
        dialogueHistory: [],
        pendingOffer: null,
      });
      setAiError(null);
    } else {
      setState({
        ...state,
        npcs: nextNpcs,
        phase: "DUSK_LEDGER",
        pendingOffer: null,
      });
    }
  };

  const handleSummonExtraDrifter = () => {
    soundFx.stopSpeaking();
    greetedKeyRef.current = "";
    lastSpokenLineIdRef.current = "";
    setAiError(null);
    setState((prev) => summonExtraProceduralPatron(prev));
  };

  const handleStartNightRun = () => {
    const nightRun = createNightRunState(state);
    setState({
      ...state,
      phase: "NIGHT_ROGUELIKE",
      nightRun,
    });
    setCodexTab(null);
  };

  const handleSelectCityLocation = (locationId: CityLocationId) => {
    soundFx.playPipBoyBeep();
    setState((prev) => selectNightCityLocation(prev, locationId));
  };

  const handleMoveExplore = (
    floor: 1 | 2 | 3,
    x: number,
    facing: "left" | "right"
  ) => {
    setState((prev) => {
      const next = moveAndStepBuildingExplore(prev, floor, x, facing);
      if (
        prev.nightRun?.nodeMode === "BUILDING_EXPLORE" &&
        next.nightRun?.nodeMode === "COMBAT"
      ) {
        if (next.nightRun.ambushAdvantage) {
          soundFx.playCardAction("attack");
          showBanner("绕后潜行成功！发动【先手偷袭】，首回合能量+1且全体敌人挂易伤标记！");
        } else {
          soundFx.playAlert();
          showBanner("踏入巡逻视野，进入遭遇牌局！");
        }
      }
      return next;
    });
  };

  const handleInteractObject = (objectId: string) => {
    soundFx.playCardAction("scavenge");
    const { nextState, banner } = interactBuildingObject(state, objectId);
    if (banner) showBanner(banner);
    setState(nextState);
  };

  const handleEngagePatrol = (patrolId: string, isBackstab: boolean) => {
    if (isBackstab) {
      soundFx.playCardAction("attack");
      showBanner("发动【绕后先手偷袭】！首回合 +1 能量、+1 连击并标记敌方全体！");
    } else {
      soundFx.playAlert();
    }
    setState((prev) => startBuildingPatrolCombat(prev, patrolId, isBackstab));
  };

  const handleResolveSurvivorParley = (
    mode: "ELO_PERSUADE" | "CHA_CHARM" | "CAPS_TRADE" | "LEAVE"
  ) => {
    const { nextState, banner } = resolveSurvivorParley(state, mode);
    soundFx.playBottleCaps();
    if (banner) showBanner(banner);
    setState(nextState);
  };

  const handleCloseWorkbench = () => {
    soundFx.playPipBoyBeep();
    setState((prev) => closeWorkbenchToExplore(prev));
  };

  const handleAttemptCombatPersuade = (targetEnemyUid?: string) => {
    const { nextState, banner } = attemptCombatPersuade(state, targetEnemyUid);
    soundFx.playBottleCaps();
    if (banner) showBanner(banner);
    setState(nextState);
  };

  const handleDraftCardOption = (optionIndex: number | null) => {
    soundFx.playBottleCaps();
    const { nextState, banner } = draftNightCardReward(state, optionIndex);
    if (banner) showBanner(banner);
    setState(nextState);
  };

  const handleFinishNightReturnDawn = () => {
    soundFx.playDoorBell();
    greetedKeyRef.current = "";
    setState((prev) => {
      if (!prev.nightRun) return prev;
      const next = structuredClone(prev);
      const run = next.nightRun!;

      next.inventory = mergeLootBags(next.inventory, run.lootBag);
      next.caps += run.capsLooted;
      next.inventory.rad_water += 2;
      next.inventory.mutant_potato += 1;

      if (next.activeCommission?.completed) {
        const comm = next.activeCommission;
        next.caps += comm.rewardCaps;
        const patronState = next.npcs[comm.npcId];
        if (patronState) {
          patronState.trust = Math.min(100, patronState.trust + 8);
          patronState.memories.push({
            day: next.day,
            impactTag: "办妥委托",
            summary: `老板连夜潜入废墟办妥了《${comm.title}》，黎明交接并领走 ${comm.rewardCaps} 枚瓶盖酬金。`,
          });
        }
        pushTavernRumor(next, {
          day: next.day + 1,
          title: "掌柜言出必行·连夜替熟客办妥废墟私活",
          detail: `连「${comm.npcName}」托付的险活都能一夜办妥，荒原熟客愈发信得过这家酒馆。`,
          tone: "WARM",
          trustMod: 4,
          tensionMod: -3,
          remainingDays: 2,
          nightBonus: null,
        });
        showBanner(
          `黎明交接委托《${comm.title}》：额外入账 +${comm.rewardCaps} 瓶盖！`
        );
      }

      next.activeRumors = (next.activeRumors || [])
        .map((r) => ({ ...r, remainingDays: r.remainingDays - 1 }))
        .filter((r) => r.remainingDays > 0);

      Object.keys(next.npcs).forEach((id) => {
        next.npcs[id].intoxication = Math.max(
          0,
          next.npcs[id].intoxication - 35
        );
        next.npcs[id].tension = Math.max(10, next.npcs[id].tension - 8);
        next.npcs[id].intelSharedToday = false;
        next.npcs[id].rumorSeededToday = false;
      });

      const nextDay = next.day + 1;
      next.day = nextDay;
      next.weatherIndex = (nextDay - 1) % WEATHER_CYCLE.length;
      next.nightRun = null;
      next.nightIntelUnlocked = false;
      next.nightIntelPatronName = null;
      next.nightAmbushTriggered = false;
      next.nightAmbushPatronName = null;
      next.nightBossWeakened = false;
      next.nightCompanion = null;
      next.activeCommission = null;
      next.nightHitmanTriggered = false;
      next.nightHitmanSponsor = null;
      next.nightTrapCacheUnlocked = false;

      if (nextDay === next.maxDays + 1) {
        next.phase = "ENDING";
        return next;
      }

      next.phase = "DAY_TAVERN";
      next.currentTurnServedDrink = false;
      next.dialogueHistory = [];
      next.pendingOffer = null;
      next.todayLedger = {
        day: nextDay,
        patronsServed: 0,
        capsEarned: 0,
        capsCreditIssued: 0,
        intelUnlocked: [],
        ambushTriggeredBy: [],
        notableEvents: [],
      };
      return populateDailyQueueWithDrifter(next, nextDay);
    });
  };

  // ==================== 游戏初始主界面（无任何网页顶栏/底栏，纯正 Steam 全屏入口） ====================
  if (state.phase === "TITLE") {
    return (
      <>
        <TitleScreen
          savedPreview={autoSavePreview}
          onStartFresh={() => {
            greetedKeyRef.current = "";
            lastSpokenLineIdRef.current = "";
            const audioCfg = loadSystemSettings().audio;
            const fresh = createInitialCampaign();
            fresh.phase = "DAY_TAVERN";
            fresh.soundEnabled = audioCfg.sfxEnabled;
            fresh.bgmEnabled = audioCfg.bgmEnabled;
            fresh.ttsEnabled = audioCfg.ttsEnabled;
            setState(fresh);
          }}
          onOpenLoadArchive={() => setSaveModalOpen(true)}
          onContinueSave={() => {
            if (!autoSavePreview) return;
            const resumed = syncCustomPatronsIntoCampaign(
              structuredClone(autoSavePreview),
              false
            );
            greetedKeyRef.current =
              resumed.dialogueHistory.length > 0
                ? `resumed_${Date.now()}`
                : "";
            lastSpokenLineIdRef.current = getLatestNpcLineId(resumed);
            setState(resumed);
          }}
          onAudioFlagsSynced={handleAudioFlagsSynced}
          onRosterUpdated={handleRosterUpdated}
        />

        <SaveAndPresetModal
          isOpen={saveModalOpen}
          isFromTitle={true}
          currentState={state}
          autoSavePreview={autoSavePreview}
          manualSlots={manualSlots}
          onClose={() => setSaveModalOpen(false)}
          onSaveToSlot={handleSaveToManualSlot}
          onLoadState={(loaded) => {
            const norm = syncCustomPatronsIntoCampaign(
              normalizeLoadedCampaign(loaded),
              false
            );
            greetedKeyRef.current =
              norm.dialogueHistory.length > 0 ? `loaded_${Date.now()}` : "";
            lastSpokenLineIdRef.current = getLatestNpcLineId(norm);
            setState(norm);
          }}
          onLoadJudgePreset={() => {
            greetedKeyRef.current = "";
            lastSpokenLineIdRef.current = "";
            setState(
              syncCustomPatronsIntoCampaign(createJudgeShowcasePreset(), false)
            );
          }}
          onToggleSound={handleToggleSound}
          onToggleBgm={handleToggleBgm}
          onToggleTts={handleToggleTts}
          onReturnToTitle={() => {}}
        />
      </>
    );
  }

  // ==================== 游戏局内完整全视口 HUD 与舞台 ====================
  const isNightBackdrop = state.phase === "NIGHT_ROGUELIKE";
  const isFirstPersonDayTavern = state.phase === "DAY_TAVERN";

  return (
    <div
      className={`min-h-screen lg:h-screen lg:overflow-hidden flex flex-col select-none transition-colors duration-200 ${
        isNightBackdrop
          ? "bg-[#0F141A] text-slate-100"
          : "bg-[#140F0C] text-[#F3EAE0]"
      }`}
    >
      {isFirstPersonDayTavern ? (
        <DayTavernView
          state={state}
          isLoadingAi={isLoadingAi}
          aiError={aiError}
          toastBanner={toastBanner}
          onRetryGreet={() => triggerPatronGreeting(state)}
          onSendChat={handleSendChat}
          onServeDrink={handleServeDrink}
          onResolveOffer={handleResolveOffer}
          onResolveShowdown={handleResolveShowdown}
          onSeedRumor={handleSeedRumor}
          onInviteCompanion={handleInviteCompanion}
          onNextPatronOrDusk={handleNextPatronOrDusk}
          onSummonExtraDrifter={handleSummonExtraDrifter}
          onOpenCodexTab={(tab) => setCodexTab(tab)}
          onOpenSaveModal={() => setSaveModalOpen(true)}
          onToggleBgm={handleToggleBgm}
          onToggleTts={handleToggleTts}
          onToggleSound={handleToggleSound}
          onOpenSettings={() => setInGameDrawerMode("SETTINGS")}
          onOpenRoster={() => setInGameDrawerMode("ROSTER")}
          onReturnToTitle={() => {
            soundFx.stopSpeaking();
            setCodexTab(null);
            setInGameDrawerMode(null);
            setState((prev) => ({ ...prev, phase: "TITLE" }));
          }}
        />
      ) : (
        <>
          {/* 局内黄铜卡尺仪器顶栏（黄昏/夜晚/终局阶段） */}
          <header
            className={`h-13 shrink-0 flex items-center justify-between gap-8 px-6 border-b ${
              isNightBackdrop
                ? "border-slate-800 bg-[#0B1015]"
                : "border-[#F5D096]/14 bg-[#100C0A]"
            }`}
          >
            <button
              type="button"
              onClick={() => {
                soundFx.playCaliperTick();
                setCodexTab(null);
                setState((prev) => ({ ...prev, phase: "TITLE" }));
              }}
              className="font-display text-lg font-bold tracking-wider text-[#FDF5EB] hover:text-[#E59A3C] transition-colors whitespace-nowrap shrink-0"
            >
              废土酒馆
            </button>

            <nav
              aria-label="局内系统图鉴"
              className="hidden md:flex items-center gap-6 text-xs font-medium"
            >
              <button
                type="button"
                onClick={() => {
                  soundFx.playCaliperTick();
                  setCodexTab(null);
                }}
                className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  codexTab === null
                    ? "border-[#E59A3C] text-[#FDF5EB] font-semibold"
                    : "border-transparent text-[#B59E88] hover:text-[#FAF0E6]"
                }`}
              >
                当前场景
              </button>
              {(
                [
                  { id: "PATRONS", label: "常客手记" },
                  { id: "LORE", label: "废土档案" },
                  { id: "DECK", label: "探险牌库" },
                  { id: "INSPECTOR", label: "规则日志" },
                ] as const
              ).map((item) => {
                const active = codexTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      soundFx.playCaliperTick();
                      setCodexTab(active ? null : item.id);
                    }}
                    className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? "border-[#E59A3C] text-[#FDF5EB] font-semibold"
                        : "border-transparent text-[#B59E88] hover:text-[#FAF0E6]"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  soundFx.playCaliperTick();
                  handleToggleBgm();
                }}
                className={`px-2.5 py-1.5 rounded border text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  state.bgmEnabled !== false
                    ? "border-[#E59A3C]/45 bg-[#221914] text-[#F7D7A8]"
                    : "border-slate-700 bg-slate-900/60 text-slate-400"
                }`}
                title="切换电台背景音乐 (BGM)"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>{state.bgmEnabled !== false ? "电台" : "静音"}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundFx.playCaliperTick();
                  setInGameDrawerMode("ROSTER");
                }}
                className="px-2.5 py-1.5 rounded border border-[#E59A3C]/35 bg-[#221914] hover:bg-[#2F231C] text-xs font-medium text-[#FAF0E6] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                title="打开人物库"
              >
                <Users className="w-3.5 h-3.5 text-[#E59A3C]" />
                <span>人物库</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundFx.playCaliperTick();
                  setInGameDrawerMode("SETTINGS");
                }}
                className="px-2.5 py-1.5 rounded border border-[#E59A3C]/35 bg-[#221914] hover:bg-[#2F231C] text-xs font-medium text-[#FAF0E6] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                title="打开系统设置"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#E59A3C]" />
                <span>设置</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundFx.playCaliperTick();
                  setSaveModalOpen(true);
                }}
                className="px-3.5 py-1.5 rounded border border-[#E59A3C]/35 bg-[#221914] hover:bg-[#2F231C] text-xs font-medium text-[#FAF0E6] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                存档系统
              </button>
            </div>
          </header>

          {toastBanner && (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-lg border border-amber-400/50 bg-[#0D131A]/95 text-xs font-medium text-amber-200 shadow-2xl pointer-events-none">
              {toastBanner}
            </div>
          )}

          {/* 局内 16:9 游戏主舞台视口 */}
          <main
            className={`flex-1 min-h-0 w-full mx-auto overflow-y-auto lg:overflow-hidden ${
              state.phase === "DUSK_LEDGER"
                ? "max-w-[1520px] px-2 sm:px-4 py-2"
                : "max-w-[1480px] px-3 sm:px-6 py-3"
            }`}
          >
            {state.phase === "DUSK_LEDGER" ? (
              <PipBoyDuskView
                state={state}
                onHealWithCaps={() => {
                  if (state.caps < 8 || state.playerHp >= state.playerMaxHp) {
                    return;
                  }
                  const hasVaultPerk = Boolean(
                    state.rpg?.unlockedPerks.includes("perk_vault_constitution")
                  );
                  const healAmt = hasVaultPerk ? 22 : 15;
                  soundFx.playBottleCaps();
                  setState((prev) => ({
                    ...prev,
                    caps: prev.caps - 8,
                    playerHp: Math.min(prev.playerMaxHp, prev.playerHp + healAmt),
                  }));
                  showBanner(`战地针剂包扎完毕：恢复 +${healAmt} 生命`);
                }}
                onAllocateStat={handleAllocateStat}
                onSelectPerk={handleSelectPerk}
                onUpgradeCard={(cardUid) => handleUpgradeCard(cardUid, false)}
                onStartNightRun={handleStartNightRun}
              />
            ) : state.phase === "NIGHT_ROGUELIKE" ? (
              <div className="h-full overflow-y-auto theme-night">
                <NightRoguelikeView
                  state={state}
                  onSelectCityLocation={handleSelectCityLocation}
                  onMoveExplore={handleMoveExplore}
                  onInteractObject={handleInteractObject}
                  onEngagePatrol={handleEngagePatrol}
                  onResolveSurvivorParley={handleResolveSurvivorParley}
                  onCloseWorkbench={handleCloseWorkbench}
                  onUpgradeCard={handleUpgradeCard}
                  onAllocateStat={handleAllocateStat}
                  onSelectPerk={handleSelectPerk}
                  onPlayCard={(cardUid, targetEnemyUid) => {
                    const inst = state.nightRun?.hand.find(
                      (c) => c.uid === cardUid
                    );
                    const cat = inst
                      ? CARD_LIBRARY[inst.defId]?.category
                      : undefined;
                    soundFx.playCardAction(
                      cat === "GUARD"
                        ? "guard"
                        : cat === "SCAVENGE"
                        ? "scavenge"
                        : "attack"
                    );
                    setState((prev) =>
                      playCombatCard(prev, cardUid, targetEnemyUid)
                    );
                  }}
                  onAttemptCombatPersuade={handleAttemptCombatPersuade}
                  onEndTurn={() => {
                    soundFx.playCardAction("guard");
                    setState((prev) => endPlayerCombatTurn(prev));
                  }}
                  onDraftCardOption={handleDraftCardOption}
                  onFinishNightReturnDawn={handleFinishNightReturnDawn}
                />
              </div>
            ) : (
              <EndingView
                state={state}
                onContinueEndless={() => {
                  greetedKeyRef.current = "";
                  lastSpokenLineIdRef.current = "";
                  setState((prev) =>
                    populateDailyQueueWithDrifter(
                      {
                        ...prev,
                        maxDays: prev.maxDays + 7,
                        phase: "DAY_TAVERN",
                        currentTurnServedDrink: false,
                        dialogueHistory: [],
                      },
                      prev.day
                    )
                  );
                }}
                onRestartNewGame={() => {
                  greetedKeyRef.current = "";
                  lastSpokenLineIdRef.current = "";
                  const fresh = createInitialCampaign();
                  fresh.phase = "DAY_TAVERN";
                  fresh.soundEnabled = state.soundEnabled;
                  fresh.bgmEnabled = state.bgmEnabled !== false;
                  fresh.ttsEnabled = state.ttsEnabled !== false;
                  setState(fresh);
                }}
              />
            )}
          </main>
        </>
      )}

      {/* 游戏原生半透明叠层图鉴（不离开当前酒馆/废墟舞台） */}
      <CodexOverlayModal
        activeTab={codexTab}
        state={state}
        providerInfo={providerInfo}
        onAllocateStat={handleAllocateStat}
        onSelectPerk={handleSelectPerk}
        onUpgradeCard={(cardUid) => handleUpgradeCard(cardUid, false)}
        onClose={() => setCodexTab(null)}
      />

      {/* 多槽位存档与系统控制舱 */}
      <SaveAndPresetModal
        isOpen={saveModalOpen}
        isFromTitle={false}
        currentState={state}
        autoSavePreview={autoSavePreview}
        manualSlots={manualSlots}
        onClose={() => setSaveModalOpen(false)}
        onSaveToSlot={handleSaveToManualSlot}
        onLoadState={(loaded) => {
          const norm = normalizeLoadedCampaign(loaded);
          greetedKeyRef.current =
            norm.dialogueHistory.length > 0 ? `loaded_${Date.now()}` : "";
          lastSpokenLineIdRef.current = getLatestNpcLineId(norm);
          setState(norm);
          setCodexTab(null);
        }}
        onLoadJudgePreset={() => {
          greetedKeyRef.current = "";
          lastSpokenLineIdRef.current = "";
          setState(createJudgeShowcasePreset());
          setCodexTab(null);
        }}
        onToggleSound={handleToggleSound}
        onToggleBgm={handleToggleBgm}
        onToggleTts={handleToggleTts}
        onOpenSettings={() => setInGameDrawerMode("SETTINGS")}
        onOpenRoster={() => setInGameDrawerMode("ROSTER")}
        onReturnToTitle={() => {
          soundFx.stopSpeaking();
          setCodexTab(null);
          setInGameDrawerMode(null);
          setState((prev) => ({ ...prev, phase: "TITLE" }));
        }}
      />

      {/* 局内随时呼出的同一套半透黄铜「人物库 / 系统设置」面板 */}
      {inGameDrawerMode && (
        <SettingsAndRosterDrawer
          mode={inGameDrawerMode}
          presentation="ingame_overlay"
          inDayTavern={state.phase === "DAY_TAVERN"}
          onSwitchMode={(m) => setInGameDrawerMode(m)}
          onClose={() => setInGameDrawerMode(null)}
          onAudioFlagsSynced={handleAudioFlagsSynced}
          onRosterUpdated={handleRosterUpdated}
          onNotify={showBanner}
        />
      )}
    </div>
  );
}
