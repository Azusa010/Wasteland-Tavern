import { loadSystemSettings } from "../data/settingsAndRosterStore";
import { GamePhase, NpcStaticProfile } from "../types/game";

export type VoicePresetId =
  | "gruff_male"
  | "warm_female"
  | "calm_synth"
  | "sly_merchant"
  | "agile_female";

export interface SpeakingStatus {
  isSpeaking: boolean;
  lineId: string | null;
}

const SFX_PATHS = {
  doorEnter: "/assets/audio/sfx_door_enter.wav",
  shakerMix: "/assets/audio/sfx_shaker_mix.wav",
  pourDrink: "/assets/audio/sfx_pour_drink.wav",
  bottleCaps: "/assets/audio/sfx_bottle_caps.wav",
  brawlAlert: "/assets/audio/sfx_brawl_alert.wav",
  verdictStamp: "/assets/audio/sfx_verdict_stamp.wav",
  cardAttack: "/assets/audio/sfx_card_attack.wav",
  cardGuard: "/assets/audio/sfx_card_guard.wav",
  cardScavenge: "/assets/audio/sfx_card_scavenge.wav",
} as const;

const BGM_PATHS = {
  dayTavern: "/assets/audio/bgm_tavern_day.wav",
  nightRuins: "/assets/audio/bgm_ruins_night.wav",
} as const;

export function cleanDialogueQuotes(raw: string): string {
  if (!raw) return "";
  let s = raw.trim();
  s = s.replace(/^[「『“"']+/, "").replace(/[」』”"']+$/, "");
  s = s.replace(/[」』”"]$/g, "");
  return s.trim();
}

function cleanTextForSpeech(raw: string): string {
  const unquoted = cleanDialogueQuotes(raw);
  const withoutStage = unquoted
    .replace(/（[^）]*）/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return withoutStage || unquoted;
}

export function resolveNpcVoicePreset(profile: NpcStaticProfile): VoicePresetId {
  if (profile.id === "ash_scavenger") return "warm_female";
  if (profile.id === "buck_raider") return "gruff_male";
  if (profile.id === "k7_synth") return "calm_synth";
  if (profile.id === "mori_merchant") return "sly_merchant";

  const parts = profile.modularParts;
  if (parts) {
    const buildIdx = Math.abs(parts.bodyBuild ?? parts.neckwear ?? 1) % 3;
    const headIdx = Math.abs(parts.faceShape);
    if (buildIdx === 0) {
      return headIdx % 4 === 1 ? "warm_female" : "gruff_male";
    }
    if (buildIdx === 1) {
      const h = headIdx % 5;
      if (h === 1) return "warm_female";
      if (h === 3) return "sly_merchant";
      return "gruff_male";
    }
    if (buildIdx === 2) {
      const h = headIdx % 4;
      if (h === 0 || h === 2) return "agile_female";
      return "calm_synth";
    }
  }
  if (/女|妹|姐|柔和|清亮|轻快/.test(`${profile.personaPrompt} ${profile.speechStyle}`)) {
    return "warm_female";
  }
  return "gruff_male";
}

class WastelandAudio {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private bgmEnabled = true;
  private ttsEnabled = true;
  private bgmVolumeScale = 0.75;
  private sfxVolumeScale = 0.8;
  private ttsVolumeScale = 0.9;
  private currentPhase: GamePhase = "TITLE";

  private bgmAudio: HTMLAudioElement | null = null;
  private currentBgmTrack: string = "";
  private gestureBound = false;

  private activeTtsAudio: HTMLAudioElement | null = null;
  private ttsRequestId = 0;
  private speakingStatus: SpeakingStatus = { isSpeaking: false, lineId: null };
  private listeners = new Set<(status: SpeakingStatus) => void>();

  constructor() {
    this.bindFirstGestureUnlock();
  }

  private bindFirstGestureUnlock() {
    if (typeof window === "undefined" || this.gestureBound) return;
    this.gestureBound = true;
    const unlock = () => {
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      this.syncBgmPlayback();
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock, { passive: true });
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
  }

  public setBgmEnabled(val: boolean) {
    this.bgmEnabled = val;
    this.syncBgmPlayback();
  }

  public setTtsEnabled(val: boolean) {
    this.ttsEnabled = val;
    if (!val) {
      this.stopSpeaking();
    }
  }

  public setVolumes(opts: {
    bgmVolume?: number;
    sfxVolume?: number;
    ttsVolume?: number;
  }) {
    if (typeof opts.bgmVolume === "number") {
      this.bgmVolumeScale = Math.max(0, Math.min(1, opts.bgmVolume / 100));
      this.updateBgmDucking();
    }
    if (typeof opts.sfxVolume === "number") {
      this.sfxVolumeScale = Math.max(0, Math.min(1, opts.sfxVolume / 100));
    }
    if (typeof opts.ttsVolume === "number") {
      this.ttsVolumeScale = Math.max(0, Math.min(1, opts.ttsVolume / 100));
      if (this.activeTtsAudio) {
        this.activeTtsAudio.volume = Math.max(
          0,
          Math.min(1, 0.96 * this.ttsVolumeScale)
        );
      }
    }
  }

  public setScenePhase(phase: GamePhase) {
    this.currentPhase = phase;
    if (phase !== "DAY_TAVERN") {
      this.stopSpeaking();
    }
    this.syncBgmPlayback();
  }

  public subscribeSpeaking(
    listener: (status: SpeakingStatus) => void
  ): () => void {
    this.listeners.add(listener);
    listener(this.speakingStatus);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitSpeaking(isSpeaking: boolean, lineId: string | null) {
    this.speakingStatus = { isSpeaking, lineId };
    this.updateBgmDucking();
    this.listeners.forEach((fn) => fn(this.speakingStatus));
  }

  private getTargetBgmVolume(): number {
    const base =
      (this.currentPhase === "NIGHT_ROGUELIKE" ? 0.32 : 0.3) *
      this.bgmVolumeScale;
    const clamped = Math.max(0, Math.min(1, base));
    return this.speakingStatus.isSpeaking ? clamped * 0.36 : clamped;
  }

  private updateBgmDucking() {
    if (this.bgmAudio) {
      this.bgmAudio.volume = this.getTargetBgmVolume();
    }
  }

  private syncBgmPlayback() {
    if (typeof window === "undefined") return;
    if (!this.bgmEnabled || this.bgmVolumeScale <= 0.005) {
      if (this.bgmAudio && !this.bgmAudio.paused) {
        this.bgmAudio.pause();
      }
      return;
    }

    const desiredTrack =
      this.currentPhase === "NIGHT_ROGUELIKE"
        ? BGM_PATHS.nightRuins
        : BGM_PATHS.dayTavern;

    if (!this.bgmAudio) {
      this.bgmAudio = new Audio(desiredTrack);
      this.bgmAudio.loop = true;
      this.bgmAudio.preload = "auto";
      this.currentBgmTrack = desiredTrack;
    } else if (this.currentBgmTrack !== desiredTrack) {
      this.bgmAudio.pause();
      this.bgmAudio.src = desiredTrack;
      this.bgmAudio.loop = true;
      this.currentBgmTrack = desiredTrack;
    }

    this.bgmAudio.volume = this.getTargetBgmVolume();
    if (this.bgmAudio.paused) {
      this.bgmAudio.play().catch(() => {});
    }
  }

  private playSample(src: string, volume = 0.52, playbackRate = 1.0): boolean {
    if (!this.enabled || this.sfxVolumeScale <= 0.01 || typeof window === "undefined") {
      return false;
    }
    try {
      const audio = new Audio(src);
      audio.volume = Math.max(0, Math.min(1, volume * this.sfxVolumeScale));
      audio.playbackRate = playbackRate;
      audio.play().catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  private ensureContext(): AudioContext | null {
    if (!this.enabled || this.sfxVolumeScale <= 0.01 || typeof window === "undefined") {
      return null;
    }
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playDoorBell() {
    this.playSample(SFX_PATHS.doorEnter, 0.58);
  }

  public playShakerMix() {
    this.playSample(SFX_PATHS.shakerMix, 0.54, 0.96 + Math.random() * 0.08);
  }

  public playPourDrink() {
    this.playSample(SFX_PATHS.pourDrink, 0.6);
  }

  public playBottleCaps() {
    this.playSample(SFX_PATHS.bottleCaps, 0.55, 0.97 + Math.random() * 0.06);
  }

  public playAlert() {
    this.playSample(SFX_PATHS.brawlAlert, 0.62);
  }

  public playVerdictStamp() {
    this.playSample(SFX_PATHS.verdictStamp, 0.64);
  }

  public playCardAction(kind: "attack" | "guard" | "scavenge") {
    if (kind === "attack") {
      this.playSample(SFX_PATHS.cardAttack, 0.58);
    } else if (kind === "guard") {
      this.playSample(SFX_PATHS.cardGuard, 0.56);
    } else {
      this.playSample(SFX_PATHS.cardScavenge, 0.56);
    }
  }

  public playCaliperTick() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.032);
    gain.gain.setValueAtTime(0.05 * this.sfxVolumeScale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  public playCaliperLock() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [620, 940].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);
      gain.gain.setValueAtTime(0.065 * this.sfxVolumeScale, now + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.1);
    });
  }

  public playFootsteps(stepCount = 4) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (let i = 0; i < stepCount; i++) {
      const t = now + i * 0.19;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(i % 2 === 0 ? 112 : 96, t);
      osc.frequency.exponentialRampToValueAtTime(42, t + 0.085);
      gain.gain.setValueAtTime(0.068 * this.sfxVolumeScale, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.095);
    }
  }

  public playPaperRustle() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [420, 680, 510].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.028);
      osc.frequency.exponentialRampToValueAtTime(190, now + idx * 0.028 + 0.045);
      gain.gain.setValueAtTime(0.045 * this.sfxVolumeScale, now + idx * 0.028);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.028 + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.028);
      osc.stop(now + idx * 0.028 + 0.055);
    });
  }

  public playPipBoyBeep() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(1360, now);
    osc.frequency.setValueAtTime(1720, now + 0.03);
    gain.gain.setValueAtTime(0.032 * this.sfxVolumeScale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playKnifeChop() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(115, now + 0.055);
    gain.gain.setValueAtTime(0.085 * this.sfxVolumeScale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public playJuicerCrank() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [240, 310, 390].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.045);
      osc.frequency.exponentialRampToValueAtTime(160, now + idx * 0.045 + 0.05);
      gain.gain.setValueAtTime(0.06 * this.sfxVolumeScale, now + idx * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.045 + 0.055);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.045);
      osc.stop(now + idx * 0.045 + 0.06);
    });
  }

  public playMortarGrind() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.exponentialRampToValueAtTime(58, now + 0.09);
    gain.gain.setValueAtTime(0.11 * this.sfxVolumeScale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playWaterFilter() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [780, 1040].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.35, now + idx * 0.06 + 0.065);
      gain.gain.setValueAtTime(0.05 * this.sfxVolumeScale, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.075);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.08);
    });
  }

  public stopSpeaking() {
    this.ttsRequestId += 1;
    if (this.activeTtsAudio) {
      this.activeTtsAudio.pause();
      this.activeTtsAudio.src = "";
      this.activeTtsAudio = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    if (this.speakingStatus.isSpeaking) {
      this.emitSpeaking(false, null);
    }
  }

  public playPreviewAudioDataUrl(audioDataUrl: string) {
    this.stopSpeaking();
    const reqId = ++this.ttsRequestId;
    const audio = new Audio(audioDataUrl);
    audio.volume = Math.max(0.15, Math.min(1, 0.96 * this.ttsVolumeScale));
    this.activeTtsAudio = audio;
    this.emitSpeaking(true, "tts_test_preview");
    audio.onended = () => {
      if (this.ttsRequestId === reqId) {
        this.activeTtsAudio = null;
        this.emitSpeaking(false, null);
      }
    };
    audio.onerror = () => {
      if (this.ttsRequestId === reqId) {
        this.activeTtsAudio = null;
        this.emitSpeaking(false, null);
      }
    };
    audio.play().catch(() => {
      this.emitSpeaking(false, null);
    });
  }

  public previewBrowserSpeech(sampleText: string) {
    this.stopSpeaking();
    const reqId = ++this.ttsRequestId;
    this.speakWithBrowserSynthesis(
      sampleText,
      "gruff_male",
      0,
      reqId,
      "tts_test_preview"
    );
  }

  private speakWithBrowserSynthesis(
    spokenText: string,
    preset: VoicePresetId,
    intoxication: number,
    reqId: number,
    lineId: string
  ) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      this.emitSpeaking(false, null);
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(spokenText);
      utter.lang = "zh-CN";

      const voices = window.speechSynthesis.getVoices();
      const zhVoices = voices.filter((v) =>
        /zh|cmn|chinese/i.test(`${v.lang} ${v.name}`)
      );
      const wantsFemale = preset === "warm_female" || preset === "agile_female";
      if (zhVoices.length > 0) {
        const preferred = zhVoices.find((v) =>
          wantsFemale
            ? /xiaoxiao|xiaoyi|ting|mei|huihui|female|女/i.test(v.name)
            : /yunxi|yunjian|kangkang|male|男/i.test(v.name)
        );
        utter.voice = preferred || zhVoices[0];
      }

      const presetConfig: Record<
        VoicePresetId,
        { pitch: number; rate: number }
      > = {
        gruff_male: { pitch: 0.76, rate: 0.95 },
        warm_female: { pitch: 1.08, rate: 1.02 },
        calm_synth: { pitch: 0.92, rate: 1.03 },
        sly_merchant: { pitch: 0.88, rate: 1.06 },
        agile_female: { pitch: 1.15, rate: 1.08 },
      };
      const cfg = presetConfig[preset];
      const tipsySlow = intoxication >= 38 ? 0.91 : 1.0;
      utter.pitch = cfg.pitch;
      utter.rate = Math.max(0.8, Math.min(1.25, cfg.rate * tipsySlow));
      utter.volume = Math.max(0.05, Math.min(1, 0.96 * this.ttsVolumeScale));

      utter.onstart = () => {
        if (this.ttsRequestId === reqId) {
          this.emitSpeaking(true, lineId);
        }
      };
      utter.onend = () => {
        if (this.ttsRequestId === reqId) {
          this.emitSpeaking(false, null);
        }
      };
      utter.onerror = () => {
        if (this.ttsRequestId === reqId) {
          this.emitSpeaking(false, null);
        }
      };

      this.emitSpeaking(true, lineId);
      window.speechSynthesis.speak(utter);
    } catch {
      this.emitSpeaking(false, null);
    }
  }

  public async speakNpcLine(opts: {
    lineId: string;
    text: string;
    profile: NpcStaticProfile;
    intoxication?: number;
    force?: boolean;
  }) {
    const { lineId, text, profile, intoxication = 0, force = false } = opts;
    const ttsCfg = loadSystemSettings().tts;
    if (!force && (!this.ttsEnabled || ttsCfg.provider === "off")) return;
    if (typeof window === "undefined") return;

    if (
      force &&
      this.speakingStatus.isSpeaking &&
      this.speakingStatus.lineId === lineId
    ) {
      this.stopSpeaking();
      return;
    }

    this.stopSpeaking();
    const spokenText = cleanTextForSpeech(text);
    if (!spokenText) return;

    const reqId = ++this.ttsRequestId;
    const voicePreset = resolveNpcVoicePreset(profile);

    if (ttsCfg.provider === "browser_speech") {
      this.speakWithBrowserSynthesis(
        spokenText,
        voicePreset,
        intoxication,
        reqId,
        lineId
      );
      return;
    }

    this.emitSpeaking(true, lineId);

    try {
      const resp = await fetch("/api/npc/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: spokenText,
          npcId: profile.id,
          voicePreset,
          speechStyle: profile.speechStyle,
          intoxication,
          ttsConfig: {
            provider: ttsCfg.provider === "off" ? "gemini_tts" : ttsCfg.provider,
            baseUrl: ttsCfg.baseUrl,
            model: ttsCfg.model,
            voice: ttsCfg.voice,
            apiKey: ttsCfg.apiKey,
          },
        }),
      });
      if (this.ttsRequestId !== reqId) return;

      if (resp.ok) {
        const data = (await resp.json()) as {
          engine?: string;
          audioDataUrl?: string;
        };
        if (this.ttsRequestId !== reqId) return;

        if (data.audioDataUrl) {
          const audio = new Audio(data.audioDataUrl);
          audio.volume = Math.max(0.05, Math.min(1, 0.96 * this.ttsVolumeScale));
          audio.playbackRate = intoxication >= 40 ? 0.93 : 1.0;
          this.activeTtsAudio = audio;
          audio.onended = () => {
            if (this.ttsRequestId === reqId) {
              this.activeTtsAudio = null;
              this.emitSpeaking(false, null);
            }
          };
          audio.onerror = () => {
            if (this.ttsRequestId === reqId) {
              this.activeTtsAudio = null;
              this.speakWithBrowserSynthesis(
                spokenText,
                voicePreset,
                intoxication,
                reqId,
                lineId
              );
            }
          };
          await audio.play();
          return;
        }
      }
    } catch {
      // 无服务端 TTS 密钥或离线时自动平滑降级为本机中文角色语音
    }

    if (this.ttsRequestId !== reqId) return;
    this.speakWithBrowserSynthesis(
      spokenText,
      voicePreset,
      intoxication,
      reqId,
      lineId
    );
  }
}

export const soundFx = new WastelandAudio();
