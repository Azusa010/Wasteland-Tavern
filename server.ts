import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { retrieveContextualLoreBlock } from "./src/data/wastelandLore.ts";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface MemoryPayload {
  day: number;
  summary: string;
  impactTag: string;
}

interface SecretAgendaPayload {
  isUndercover: boolean;
  surfaceAlibi: string;
  trueIdentity: string;
  secretGoal: string;
  slipIntoxicationThreshold: number;
  clueAlreadyExposed?: boolean;
}

interface RumorPayload {
  title: string;
  detail: string;
  tone?: string;
}

interface NpcProfilePayload {
  id: string;
  name: string;
  title: string;
  faction?: string;
  personaPrompt: string;
  speechStyle: string;
  favoriteNotes: string[];
  dislikedNotes: string[];
  secretAgenda?: SecretAgendaPayload;
}

interface NpcStatsPayload {
  trust: number;
  intoxication: number;
  tension: number;
  debtCaps: number;
  visits: number;
  unlockedCardGiven: boolean;
}

interface ServedDrinkPayload {
  name: string;
  ingredientsText: string;
  pourStyle: "standard" | "generous" | "watered";
  potency: number;
  soothing: number;
  purification: number;
  suggestedPrice: number;
  matchedPreferences: string[];
  triggeredDislike: boolean;
}

interface RuntimeLlmConfig {
  provider?: "gemini" | "opencode" | "modelscope" | "custom";
  baseUrl?: string;
  model?: string;
  /** 前端配置的密钥，优先于服务端环境变量 */
  apiKey?: string;
}

interface RuntimeTtsConfig {
  provider?: "gemini_tts" | "openai_tts" | "browser_speech" | "off";
  baseUrl?: string;
  model?: string;
  voice?: string;
  /** 前端配置的密钥，优先于服务端环境变量 */
  apiKey?: string;
}

interface RuntimeImageConfig {
  provider?: "wasteland_flux" | "modelscope" | "custom_openai" | "sd_webui";
  baseUrl?: string;
  model?: string;
  /** 前端配置的密钥，优先于服务端环境变量 */
  apiKey?: string;
}

interface NpcTurnResponse {
  dialogue: string;
  innerThought: string;
  moodLabel: string;
  trustDelta: number;
  intoxicationDelta: number;
  tensionDelta: number;
  proposedAction:
    | "CHAT_ONLY"
    | "PAY_FULL"
    | "BARGAIN"
    | "ASK_CREDIT"
    | "REPAY_DEBT"
    | "SHARE_RUIN_INTEL"
    | "GIFT_SIGNATURE_CARD"
    | "OFFER_COMMISSION"
    | "PROVOKE_BRAWL";
  offerCaps: number;
  memoryNote: string;
  clueRevealed?: boolean;
  slippedClue?: string;
}

function getModelScopeToken(): string {
  return (
    process.env.MODELSCOPE_API_KEY ||
    process.env.MODELSCOPE_SDK_TOKEN ||
    process.env.DASHSCOPE_API_KEY ||
    ""
  ).trim();
}

function getEnvDefaultProviderMode(): "opencode" | "modelscope" | "gemini" {
  const configured = (process.env.LLM_PROVIDER || "").toLowerCase().trim();
  const hasMs = Boolean(getModelScopeToken());
  const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());

  if (
    configured === "opencode" &&
    Boolean(process.env.OPENCODE_API_KEY?.trim() || hasMs)
  ) {
    return "opencode";
  }
  if (configured === "modelscope" && hasMs) {
    return "modelscope";
  }
  // 若部署在魔搭创空间（无 GEMINI_API_KEY 但注入了 MODELSCOPE_API_KEY / MODELSCOPE_SDK_TOKEN），自动启用魔搭通道！
  if (!hasGemini && hasMs) {
    return "modelscope";
  }
  return "gemini";
}

function sanitizeFreeGeminiModel(requested?: string): string {
  const m = (requested || "").trim();
  if (!m) return "gemini-4-hydrogen";
  const lower = m.toLowerCase();
  // 严格阻断付费等级 Gemini 模型，确保未绑定付费密钥时 100% 稳定可用
  if (
    lower.includes("argon") ||
    lower.includes("carbon") ||
    lower.includes("nano-banana") ||
    lower.includes("-image") ||
    lower.includes("-pro")
  ) {
    return "gemini-4-hydrogen";
  }
  return m;
}

function sanitizeFreeGeminiTtsModel(requested?: string): string {
  const m = (requested || "").trim();
  if (m === "gemini-3.8-flash-tts" || m === "gemini-3.8-flash-lite-tts") {
    return m;
  }
  return "gemini-3.8-flash-lite-tts";
}

function extractJsonObject(raw: string): NpcTurnResponse {
  const trimmed = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(trimmed) as NpcTurnResponse;
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as NpcTurnResponse;
    }
    throw new Error("模型返回格式无法解析为有效 JSON。");
  }
}

function sanitizeDialogueQuotes(text: string): string {
  if (!text) return "";
  return text
    .trim()
    .replace(/^[「『“"]+/, "")
    .replace(/[」』”"]+$/, "")
    .trim();
}

const ttsAudioCache = new Map<string, string>();
const TTS_CACHE_LIMIT = 40;

function mapPresetToGeminiVoice(
  preset?: string,
  explicitVoice?: string
): "Fenrir" | "Charon" | "Kore" | "Zephyr" | "Puck" {
  if (
    explicitVoice === "Fenrir" ||
    explicitVoice === "Charon" ||
    explicitVoice === "Kore" ||
    explicitVoice === "Zephyr" ||
    explicitVoice === "Puck"
  ) {
    return explicitVoice;
  }
  switch (preset) {
    case "gruff_male":
      return "Fenrir";
    case "calm_synth":
      return "Charon";
    case "warm_female":
      return "Kore";
    case "agile_female":
      return "Zephyr";
    case "sly_merchant":
    case "brisk_drifter":
    default:
      return "Puck";
  }
}

function wrapPcmAsWavDataUrl(base64Data: string, mimeType = ""): string {
  const rawBuf = Buffer.from(base64Data, "base64");
  if (
    rawBuf.length >= 4 &&
    rawBuf.toString("ascii", 0, 4) === "RIFF"
  ) {
    return `data:audio/wav;base64,${base64Data}`;
  }
  if (/mp3|mpeg|ogg|webm/i.test(mimeType)) {
    return `data:${mimeType};base64,${base64Data}`;
  }

  const rateMatch = mimeType.match(/rate=(\d+)/i);
  const sampleRate = rateMatch ? Number(rateMatch[1]) || 24000 : 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + rawBuf.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(rawBuf.length, 40);

  const wavBuf = Buffer.concat([header, rawBuf]);
  return `data:audio/wav;base64,${wavBuf.toString("base64")}`;
}

function createGeminiClient(apiKeyOverride?: string): GoogleGenAI {
  const apiKey = apiKeyOverride?.trim() || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "尚未配置 GEMINI_API_KEY，请在前端系统设置中填写 API Key 或检查服务端环境变量。"
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isAuthOrInvalid =
        msg.includes("400") ||
        msg.includes("401") ||
        msg.includes("403") ||
        msg.includes("API_KEY_INVALID") ||
        msg.includes("PERMISSION_DENIED");
      if (isAuthOrInvalid || attempt === maxRetries) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 450 * Math.pow(2, attempt)));
    }
  }
  throw lastErr;
}

function resolveOpenAiCompatibleCredentials(
  mode: "opencode" | "modelscope" | "custom",
  overrideBaseUrl?: string,
  overrideModel?: string,
  overrideApiKey?: string
): { apiKey: string; baseUrl: string; model: string; allowKeyless: boolean } {
  const clientApiKey = overrideApiKey?.trim() || "";
  if (mode === "opencode") {
    const apiKey =
      clientApiKey || process.env.OPENCODE_API_KEY?.trim() || getModelScopeToken();
    const baseUrl = (
      overrideBaseUrl?.trim() ||
      process.env.OPENCODE_BASE_URL ||
      process.env.MODELSCOPE_BASE_URL ||
      "https://opencode.ai/zen/go/v1"
    ).replace(/\/$/, "");
    const model =
      overrideModel?.trim() ||
      process.env.OPENCODE_MODEL ||
      process.env.MODELSCOPE_MODEL ||
      "hy4-flash-free";
    return { apiKey, baseUrl, model, allowKeyless: false };
  }

  if (mode === "modelscope") {
    const apiKey = clientApiKey || getModelScopeToken();
    const isDashScope =
      !process.env.MODELSCOPE_API_KEY &&
      !process.env.MODELSCOPE_SDK_TOKEN &&
      Boolean(process.env.DASHSCOPE_API_KEY);
    const baseUrl = (
      overrideBaseUrl?.trim() ||
      process.env.MODELSCOPE_BASE_URL ||
      (isDashScope
        ? "https://dashscope.aliyuncs.com/compatible-mode/v1"
        : "https://api-inference.modelscope.cn/v1")
    ).replace(/\/$/, "");
    const model =
      overrideModel?.trim() ||
      process.env.MODELSCOPE_MODEL ||
      (isDashScope ? "qwen-plus" : "Qwen/Qwen2.5-72B-Instruct");
    return { apiKey, baseUrl, model, allowKeyless: false };
  }

  const apiKey =
    clientApiKey ||
    process.env.CUSTOM_LLM_API_KEY?.trim() ||
    process.env.OPENCODE_API_KEY?.trim() ||
    getModelScopeToken();
  const baseUrl = (
    overrideBaseUrl?.trim() ||
    process.env.CUSTOM_LLM_BASE_URL ||
    "http://127.0.0.1:11434/v1"
  ).replace(/\/$/, "");
  const model =
    overrideModel?.trim() || process.env.CUSTOM_LLM_MODEL || "qwen2.5:14b";
  const isLocal =
    baseUrl.includes("127.0.0.1") ||
    baseUrl.includes("localhost") ||
    baseUrl.includes("0.0.0.0");
  return { apiKey, baseUrl, model, allowKeyless: isLocal };
}

async function generateViaOpenAICompatible(
  mode: "opencode" | "modelscope" | "custom",
  systemInstruction: string,
  userPrompt: string,
  sessionKey: string,
  overrideBaseUrl?: string,
  overrideModel?: string,
  overrideApiKey?: string
): Promise<{ result: NpcTurnResponse; modelName: string }> {
  const { apiKey, baseUrl, model, allowKeyless } =
    resolveOpenAiCompatibleCredentials(
      mode,
      overrideBaseUrl,
      overrideModel,
      overrideApiKey
    );

  if (!apiKey && !allowKeyless) {
    const envHint =
      mode === "opencode"
        ? "OPENCODE_API_KEY"
        : mode === "modelscope"
        ? "MODELSCOPE_API_KEY"
        : "CUSTOM_LLM_API_KEY";
    throw new Error(
      `尚未配置 ${envHint} 密钥，请在前端系统设置中填写 API Key，或检查服务端环境变量。`
    );
  }

  const schemaHint = `请严格只输出合法的 JSON 对象（不要包含 Markdown 代码块），字段如下：
{
  "dialogue": "角色对酒馆老板说的话（中文，60-130字，贴合人设口吻与废土氛围）",
  "innerThought": "角色此刻的微表情或动作神态描写（18-40字，第三人称，不要用第一人称）",
  "moodLabel": "简短情绪词，如：警惕审视 / 微醺失言 / 恼火按枪 / 感激敞怀",
  "trustDelta": 整数(-15到18),
  "intoxicationDelta": 整数(0到25),
  "tensionDelta": 整数(-22到25),
  "proposedAction": "只能取以下之一: CHAT_ONLY | PAY_FULL | BARGAIN | ASK_CREDIT | REPAY_DEBT | SHARE_RUIN_INTEL | GIFT_SIGNATURE_CARD | OFFER_COMMISSION | PROVOKE_BRAWL",
  "offerCaps": 整数(提议支付或归还的瓶盖数，无交易填0),
  "memoryNote": "浓缩成一句话的跨天记忆摘要（20-45字，若仅寒暄可简写）",
  "clueRevealed": 布尔值(true表示本轮微醺或受盘问说漏了真实身份破绽，否则false),
  "slippedClue": "若clueRevealed为true，用20-38字简述刚刚漏嘴暴露的具体破绽证据；否则填\"\""
}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  if (mode === "opencode" || baseUrl.includes("opencode.ai")) {
    headers["x-opencode-session"] = sessionKey;
  }

  const endpoint = baseUrl.endsWith("/chat/completions")
    ? baseUrl
    : `${baseUrl}/chat/completions`;

  const resp = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${systemInstruction}\n\n${schemaHint}` },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(
      `推理接口响应异常 (${resp.status}): ${errText.slice(0, 240)}`
    );
  }

  const payload = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const rawContent = payload.choices?.[0]?.message?.content || "";
  if (!rawContent.trim()) {
    throw new Error("模型返回了空内容，请稍后重试。");
  }
  return {
    result: extractJsonObject(rawContent),
    modelName: model,
  };
}

async function generateViaGemini(
  systemInstruction: string,
  userPrompt: string,
  requestedModel?: string,
  apiKeyOverride?: string
): Promise<{ result: NpcTurnResponse; modelName: string }> {
  const ai = createGeminiClient(apiKeyOverride);
  const modelName = sanitizeFreeGeminiModel(requestedModel);
  const response = await ai.models.generateContent({
    model: modelName,
    contents: userPrompt,
    config: {
      systemInstruction,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          dialogue: {
            type: Type.STRING,
            description: "角色对酒馆老板说的中文台词，60到130字，极具废土生活气息与个人口吻。",
          },
          innerThought: {
            type: Type.STRING,
            description: "第三人称吧台神态与小动作描写，18到40字，不要带括号。",
          },
          moodLabel: {
            type: Type.STRING,
            description: "四字以内的当前神态标签，例如：紧绷戒备、微醺失言、拍桌恼火、真诚感激。",
          },
          trustDelta: {
            type: Type.INTEGER,
            description: "本轮信任度变化建议值，范围 -15 到 18。",
          },
          intoxicationDelta: {
            type: Type.INTEGER,
            description: "本轮醉意松弛度变化建议值，范围 0 到 25。",
          },
          tensionDelta: {
            type: Type.INTEGER,
            description: "本轮危险张力变化建议值，范围 -22 到 25。",
          },
          proposedAction: {
            type: Type.STRING,
            description:
              "NPC自主提议的行为决策：CHAT_ONLY, PAY_FULL, BARGAIN, ASK_CREDIT, REPAY_DEBT, SHARE_RUIN_INTEL, GIFT_SIGNATURE_CARD, OFFER_COMMISSION, PROVOKE_BRAWL 之一。",
          },
          offerCaps: {
            type: Type.INTEGER,
            description: "NPC提议支付、砍价后出价或归还欠款的瓶盖数量（0到35）。",
          },
          memoryNote: {
            type: Type.STRING,
            description: "用客观简练的一句话记录本轮互动关键事实，供跨天持久化记忆使用（20到45字）。",
          },
          clueRevealed: {
            type: Type.BOOLEAN,
            description: "若角色携有伪装身份且本轮因醉意达标或遭盘问说漏嘴露出破绽，填 true，否则 false。",
          },
          slippedClue: {
            type: Type.STRING,
            description: "若 clueRevealed 为 true，简述漏嘴暴露的矛盾证据（20到38字），否则填 空字符串。",
          },
        },
        required: [
          "dialogue",
          "innerThought",
          "moodLabel",
          "trustDelta",
          "intoxicationDelta",
          "tensionDelta",
          "proposedAction",
          "offerCaps",
          "memoryNote",
          "clueRevealed",
          "slippedClue",
        ],
      },
    },
  });

  const text = (response.text ?? "").trim();
  if (!text) {
    throw new Error("大模型返回了空响应，请稍后重试。");
  }
  return {
    result: JSON.parse(text) as NpcTurnResponse,
    modelName,
  };
}

async function runNpcInference(
  systemInstruction: string,
  userPrompt: string,
  sessionKey: string,
  llmConfig?: RuntimeLlmConfig
): Promise<{ result: NpcTurnResponse; provider: string; modelName: string }> {
  let mode = llmConfig?.provider || getEnvDefaultProviderMode();
  let effectiveBaseUrl = llmConfig?.baseUrl;
  let effectiveModel = llmConfig?.model;

  // 魔搭创空间零配置自适应：若客户端默认请求 gemini 但容器内未配 GEMINI_API_KEY 而配了魔搭 Token，自动无缝切至 modelscope
  if (
    mode === "gemini" &&
    !process.env.GEMINI_API_KEY?.trim() &&
    Boolean(getModelScopeToken())
  ) {
    mode = "modelscope";
    effectiveBaseUrl = undefined;
    effectiveModel = undefined;
  }

  if (mode === "opencode" || mode === "modelscope" || mode === "custom") {
    const { result, modelName } = await withRetry(() =>
      generateViaOpenAICompatible(
        mode,
        systemInstruction,
        userPrompt,
        sessionKey,
        effectiveBaseUrl,
        effectiveModel,
        llmConfig?.apiKey
      )
    );
    return { result, provider: mode, modelName };
  }

  const { result, modelName } = await withRetry(() =>
    generateViaGemini(
      systemInstruction,
      userPrompt,
      effectiveModel,
      llmConfig?.apiKey
    )
  );
  return { result, provider: "gemini", modelName };
}

function buildSystemInstruction(
  npc: NpcProfilePayload,
  stats: NpcStatsPayload,
  day: number,
  weatherDesc: string,
  activeRumors?: RumorPayload[],
  loreContext?: {
    playerMessage?: string;
    recentDialogueText?: string;
    servedDrinkName?: string;
  }
): string {
  const { promptBlock: lorePromptBlock } = retrieveContextualLoreBlock({
    npc: {
      id: npc.id,
      name: npc.name,
      title: npc.title,
      faction: npc.faction,
    },
    playerMessage: loreContext?.playerMessage,
    recentDialogueText: loreContext?.recentDialogueText,
    servedDrinkName: loreContext?.servedDrinkName,
    weatherDesc,
    rumorTitles: (activeRumors || []).map((r) => r.title),
    topK: 5,
  });

  const rumorSection =
    activeRumors && activeRumors.length > 0
      ? `\n【当前荒原与酒馆流传的江湖风评（客人进店前已耳闻，请在寒暄或态度里自然流露反应）】\n${activeRumors
          .slice(0, 3)
          .map((r) => `- 《${r.title}》：${r.detail}`)
          .join("\n")}`
      : "";

  const agenda = npc.secretAgenda;
  const agendaSection = agenda?.isUndercover
    ? `\n【表里双层身份与侦探酒保套话规则】
- 对外伪装口供：${agenda.surfaceAlibi}
- 隐秘真实身份：${agenda.trueIdentity}
- 暗中真实企图：${agenda.secretGoal}
- 催醉失言阈值：醉意 >= ${agenda.slipIntoxicationThreshold}
- 扮演要求：若当前醉意较低且未喝高烈度酒，请维持表面口供，被试探时略显掩饰或警觉（clueRevealed 设为 false）；一旦醉意已达到或本轮喝酒后预估达到 ${agenda.slipIntoxicationThreshold} 以上（或遭老板精准盘问底细），请在台词与动作里不慎说漏嘴暴露与表面身份矛盾的破绽细节，并将 clueRevealed 设为 true，在 slippedClue 写明漏嘴证据！`
    : `\n【身份底细】${agenda?.surfaceAlibi || "言行坦荡的废土常客，无伪装身份（clueRevealed 保持 false）。"}`;

  return `你正在扮演核战废土叙事经营游戏《废土酒馆》中的角色：「${npc.name}」（${npc.title}${
    npc.faction ? ` · ${npc.faction}` : ""
  }）。
现在是第 ${day} 天白昼营业时段，门外环境：${weatherDesc}。

${lorePromptBlock}

【角色核心人设】${npc.personaPrompt}
【说话口吻与习惯】${npc.speechStyle}
【饮品偏好】偏爱：${npc.favoriteNotes.join("、")}；厌恶：${npc.dislikedNotes.join("、")}。${rumorSection}${agendaSection}
【当前角色量化状态】
- 信任度 (trust): ${stats.trust}/100
- 醉意松弛度 (intoxication): ${stats.intoxication}/100
- 危险张力 (tension): ${stats.tension}/100
- 历史赊账欠款 (debtCaps): ${stats.debtCaps} 瓶盖
- 历史到访次数: ${stats.visits} 次
- 专属卡牌是否已赠出: ${stats.unlockedCardGiven ? "已赠出" : "未赠出"}

【行为决策提议准则（必须严格遵守以供游戏规则引擎校验）】
1. 若本轮老板尚未端上酒品（仅为推门入座或对话试探），proposedAction 通常选 "CHAT_ONLY"；若 stats.debtCaps > 0 且 stats.trust >= 45 且刚进门或谈及旧账，可提议 "REPAY_DEBT"；若 stats.trust >= 60 且在深谈废墟麻烦事，可提议 "OFFER_COMMISSION"（委托老板今夜去废墟办一件私活）；若言语极具挑衅导致预估张力 >= 78，可提议 "PROVOKE_BRAWL"。
2. 若本轮老板端上了酒品：
   - 仔细感受酒品的配料、烈度、安抚度、净辐值，以及老板是「慷慨多倒半杯 (generous)」、「标准份量 (standard)」还是「偷偷兑水省料 (watered)」！多倒半杯务必点出人情提升 trustDelta；发现兑水则不满或冷笑并提升 tensionDelta！
   - 当饮品契合喜好且 trust 较高时：若尚未赠出专属卡且预估新 trust >= 68，优先提议 "GIFT_SIGNATURE_CARD"；否则若预估新 trust >= 60 可提议 "OFFER_COMMISSION" 或 "SHARE_RUIN_INTEL"；否则选 "PAY_FULL"。
   - 当手头紧、爱讲价或对饮品挑剔时：提议 "BARGAIN"（offerCaps 设为建议售价的 60%-80%）或 "ASK_CREDIT"（offerCaps 设为 0）。
   - 当饮品踩雷或遭到羞辱且预估新 tension >= 78 时：提议 "PROVOKE_BRAWL"。
3. 台词必须自然鲜活，严禁在台词中直接说出英文变量名或机械分值，要把过去记忆与酒馆江湖流言自然融进对话里。
4. 世界观强一致性约束：凡涉及地名、势力、物价、酒水或异兽，必须严格依据上方【核心世界观铁律】【角色认知边界】与【本轮动态召回的世界观词条】作答；严禁点现代洋酒（如威士忌、伏特加、龙舌兰、啤酒），严禁报出失真的高额瓶盖数，严禁跨越自身认知边界剧透他人秘密！`;
}

function buildWastelandImagePrompt(
  userPrompt: string,
  slotKind: "portrait" | "combat_full",
  lockWastelandStyle: boolean
): string {
  const cleanSubject = userPrompt.trim() || "weathered wasteland drifter in patched leather trench coat";
  if (!lockWastelandStyle) {
    return `${cleanSubject}, single character isolated on pure solid white #FFFFFF background, no text, no watermark`;
  }
  if (slotKind === "combat_full") {
    return `Full-body 2D game character standing combat sprite from head to boots, three-quarter stance facing right, complete legs and tactical wasteland boots clearly visible, ${cleanSubject}. Bold hand-drawn black comic ink outlines, gritty post-apocalyptic Fallout graphic novel gouache painting style, muted warm ochre brass and weathered leather tones, single character centered, isolated on a completely flat pure solid white #FFFFFF studio background, zero background props, no shadow box, no text, no frame`;
  }
  return `2D graphic novel character half-body bust portrait from waist up, expressive eyes and weathered features, ${cleanSubject}. Bold hand-drawn black comic ink outlines, gritty post-apocalyptic Fallout graphic novel gouache painting style, muted warm ochre brass and weathered leather tones, single character centered, isolated on a completely flat pure solid white #FFFFFF studio background, zero background clutter, no text, no frame`;
}

async function fetchUrlAsBase64DataUrl(
  imageUrl: string,
  timeoutMs = 38000
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "WastelandTavern/1.0",
        Accept: "image/*,*/*;q=0.8",
      },
    });
    if (!resp.ok) {
      throw new Error(`图像下载响应异常 (${resp.status})`);
    }
    const contentType = resp.headers.get("content-type") || "image/jpeg";
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length < 256) {
      throw new Error("返回的图像数据异常过小，请稍后重试。");
    }
    const mime = contentType.startsWith("image/")
      ? contentType.split(";")[0]
      : "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } finally {
    clearTimeout(timer);
  }
}

async function generateWastelandCharacterImage(opts: {
  prompt: string;
  slotKind: "portrait" | "combat_full";
  lockWastelandStyle: boolean;
  imageConfig?: RuntimeImageConfig;
}): Promise<{ imageDataUrl: string; provider: string; modelName: string }> {
  const provider = opts.imageConfig?.provider || "wasteland_flux";
  const finalPrompt = buildWastelandImagePrompt(
    opts.prompt,
    opts.slotKind,
    opts.lockWastelandStyle
  );
  const width = 576;
  const height = 768;

  if (provider === "sd_webui") {
    const baseUrl = (
      opts.imageConfig?.baseUrl?.trim() ||
      process.env.IMAGE_BASE_URL ||
      "http://127.0.0.1:7860"
    ).replace(/\/$/, "");
    const endpoint = baseUrl.endsWith("/sdapi/v1/txt2img")
      ? baseUrl
      : `${baseUrl}/sdapi/v1/txt2img`;
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: finalPrompt,
        negative_prompt:
          "text, watermark, logo, frame, border, multiple people, cropped head, cropped feet, blurry, photorealistic 3d",
        width,
        height,
        steps: 24,
        cfg_scale: 7,
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`SD WebUI 接口异常 (${resp.status}): ${errText.slice(0, 180)}`);
    }
    const data = (await resp.json()) as { images?: string[] };
    const b64 = data.images?.[0];
    if (!b64) {
      throw new Error("SD WebUI 未返回图像数据。");
    }
    return {
      imageDataUrl: b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`,
      provider,
      modelName: opts.imageConfig?.model || "sd-webui",
    };
  }

  if (provider === "modelscope" || provider === "custom_openai") {
    const clientApiKey = opts.imageConfig?.apiKey?.trim() || "";
    const apiKey =
      provider === "modelscope"
        ? clientApiKey ||
          getModelScopeToken() ||
          process.env.IMAGE_API_KEY?.trim() ||
          ""
        : clientApiKey ||
          process.env.IMAGE_API_KEY?.trim() ||
          process.env.CUSTOM_LLM_API_KEY?.trim() ||
          "";

    const baseUrl = (
      opts.imageConfig?.baseUrl?.trim() ||
      (provider === "modelscope"
        ? process.env.MODELSCOPE_BASE_URL || "https://api-inference.modelscope.cn/v1"
        : process.env.IMAGE_BASE_URL || "https://api.openai.com/v1")
    ).replace(/\/$/, "");

    const isLocal =
      baseUrl.includes("127.0.0.1") ||
      baseUrl.includes("localhost") ||
      baseUrl.includes("0.0.0.0");

    if (!apiKey && !isLocal) {
      throw new Error(
        provider === "modelscope"
          ? "尚未配置 MODELSCOPE_API_KEY / IMAGE_API_KEY，请在前端系统设置中填写 API Key，或切换至「废土手绘直连 (Flux)」免密钥通道。"
          : "尚未配置 IMAGE_API_KEY，请在前端系统设置中填写 API Key，或切换至「废土手绘直连 (Flux)」免密钥通道。"
      );
    }

    const modelName =
      opts.imageConfig?.model?.trim() ||
      process.env.IMAGE_MODEL ||
      (provider === "modelscope" ? "MusePublic/489_ckpt_flux_1" : "dall-e-3");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    if (provider === "modelscope") {
      headers["X-ModelScope-Async-Mode"] = "true";
    }

    const endpoint = baseUrl.endsWith("/images/generations")
      ? baseUrl
      : `${baseUrl}/images/generations`;

    const resp = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: modelName,
        prompt: finalPrompt,
        size: provider === "custom_openai" ? "1024x1024" : `${width}x${height}`,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`生图接口响应异常 (${resp.status}): ${errText.slice(0, 220)}`);
    }

    const json = (await resp.json()) as {
      task_id?: string;
      images?: Array<{ url?: string }>;
      data?: Array<{ url?: string; b64_json?: string }>;
    };

    // 兼容魔搭异步任务轮询
    if (json.task_id) {
      const taskBase = baseUrl.replace(/\/images\/generations$/, "");
      for (let i = 0; i < 18; i++) {
        await new Promise((r) => setTimeout(r, 1800));
        const pollResp = await fetch(`${taskBase}/tasks/${json.task_id}`, {
          headers: {
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            "X-ModelScope-Task-Type": "image_generation",
          },
        });
        if (!pollResp.ok) continue;
        const pollData = (await pollResp.json()) as {
          task_status?: string;
          output_images?: string[];
        };
        if (pollData.task_status === "SUCCEED" && pollData.output_images?.[0]) {
          const imageDataUrl = await fetchUrlAsBase64DataUrl(
            pollData.output_images[0]
          );
          return { imageDataUrl, provider, modelName };
        }
        if (pollData.task_status === "FAILED") {
          throw new Error("魔搭生图任务执行失败，请检查模型名或提示词。");
        }
      }
      throw new Error("魔搭生图任务轮询超时，请稍后重试。");
    }

    const b64 = json.data?.[0]?.b64_json;
    if (b64) {
      return {
        imageDataUrl: `data:image/png;base64,${b64}`,
        provider,
        modelName,
      };
    }
    const remoteUrl = json.data?.[0]?.url || json.images?.[0]?.url;
    if (remoteUrl) {
      const imageDataUrl = await fetchUrlAsBase64DataUrl(remoteUrl);
      return { imageDataUrl, provider, modelName };
    }
    throw new Error("生图接口未返回有效图像地址或 Base64 数据。");
  }

  // 默认免密钥通道：wasteland_flux (服务端代理拉取并转为同源 dataURL 以供客户端无损抠图)
  const fluxBase = (
    opts.imageConfig?.baseUrl?.trim() || "https://image.pollinations.ai"
  ).replace(/\/$/, "");
  const fluxModel = opts.imageConfig?.model?.trim() || "flux";
  const seed = Math.floor(10000 + Math.random() * 890000);
  const queryUrl = `${fluxBase}/prompt/${encodeURIComponent(
    finalPrompt
  )}?width=${width}&height=${height}&seed=${seed}&model=${encodeURIComponent(
    fluxModel
  )}&nologo=true`;

  const imageDataUrl = await withRetry(() => fetchUrlAsBase64DataUrl(queryUrl, 40000), 1);
  return {
    imageDataUrl,
    provider: "wasteland_flux",
    modelName: fluxModel,
  };
}

async function synthesizeViaOpenAiCompatibleTts(opts: {
  text: string;
  baseUrl?: string;
  model?: string;
  voice?: string;
  apiKey?: string;
}): Promise<string> {
  const apiKey =
    opts.apiKey?.trim() ||
    process.env.CUSTOM_TTS_API_KEY ||
    process.env.CUSTOM_LLM_API_KEY ||
    "";
  const baseUrl = (
    opts.baseUrl?.trim() ||
    process.env.CUSTOM_TTS_BASE_URL ||
    "https://api.openai.com/v1"
  ).replace(/\/$/, "");
  const isLocal =
    baseUrl.includes("127.0.0.1") ||
    baseUrl.includes("localhost") ||
    baseUrl.includes("0.0.0.0");

  if (!apiKey && !isLocal) {
    throw new Error(
      "尚未配置 CUSTOM_TTS_API_KEY，请在前端系统设置中填写 API Key 或检查服务端环境变量。"
    );
  }

  const model = opts.model?.trim() || process.env.CUSTOM_TTS_MODEL || "tts-1";
  const voice =
    opts.voice && opts.voice !== "auto" ? opts.voice.trim() : "onyx";
  const endpoint = baseUrl.endsWith("/audio/speech")
    ? baseUrl
    : `${baseUrl}/audio/speech`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const resp = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      input: opts.text,
      voice,
      response_format: "mp3",
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`语音接口响应异常 (${resp.status}): ${errText.slice(0, 180)}`);
  }

  const buf = Buffer.from(await resp.arrayBuffer());
  const contentType = resp.headers.get("content-type") || "audio/mpeg";
  const mime = contentType.startsWith("audio/")
    ? contentType.split(";")[0]
    : "audio/mpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

async function synthesizeViaGeminiTts(opts: {
  cleanText: string;
  voicePreset?: string;
  speechStyle?: string;
  intoxication?: number;
  model?: string;
  explicitVoice?: string;
  apiKey?: string;
}): Promise<string> {
  const geminiKey =
    opts.apiKey?.trim() || (process.env.GEMINI_API_KEY || "").trim();
  if (!geminiKey) {
    throw new Error(
      "尚未配置 GEMINI_API_KEY，请在前端系统设置中填写 API Key 或检查服务端环境变量。"
    );
  }

  const ai = new GoogleGenAI({
    apiKey: geminiKey,
    httpOptions: {
      apiVersion: "v1alpha",
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  const stylePrompt = [
    "Mandarin Chinese wasteland tavern patron voice acting",
    opts.speechStyle ? `character tone: ${opts.speechStyle}` : "",
    (opts.intoxication || 0) >= 32
      ? "slightly tipsy, relaxed and unguarded cadence"
      : "natural grounded conversational delivery",
  ]
    .filter(Boolean)
    .join(", ");

  const modelName = sanitizeFreeGeminiTtsModel(opts.model);
  const voiceName = mapPresetToGeminiVoice(
    opts.voicePreset,
    opts.explicitVoice
  );

  const response = await ai.models.generateContent({
    model: modelName,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: opts.cleanText,
            speechMetadata: {
              style: stylePrompt,
            },
          },
        ],
      },
    ],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName,
          },
        },
      },
    },
  });

  const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inlineData?.data) {
    throw new Error("Gemini TTS 未返回音频采样数据。");
  }
  return wrapPcmAsWavDataUrl(inlineData.data, inlineData.mimeType || "");
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "8mb" }));

  app.get("/api/provider-info", (_req, res) => {
    const mode = getEnvDefaultProviderMode();
    res.json({
      provider: mode,
      modelName:
        mode === "opencode"
          ? process.env.OPENCODE_MODEL ||
            process.env.MODELSCOPE_MODEL ||
            "hy4-flash-free"
          : mode === "modelscope"
          ? process.env.MODELSCOPE_MODEL || "Qwen/Qwen2.5-72B-Instruct"
          : "gemini-4-hydrogen",
    });
  });

  app.get("/api/settings/env-status", (_req, res) => {
    const hasMs = Boolean(getModelScopeToken());
    res.json({
      geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      opencodeKeyConfigured: Boolean(
        process.env.OPENCODE_API_KEY?.trim() || hasMs
      ),
      modelscopeKeyConfigured: hasMs,
      customLlmKeyConfigured: Boolean(process.env.CUSTOM_LLM_API_KEY?.trim()),
      customTtsKeyConfigured: Boolean(process.env.CUSTOM_TTS_API_KEY?.trim()),
      imageKeyConfigured: Boolean(
        process.env.IMAGE_API_KEY?.trim() || hasMs
      ),
    });
  });

  app.post("/api/settings/test", async (req, res) => {
    const started = Date.now();
    try {
      const {
        target,
        llmConfig,
        ttsConfig,
        imageConfig,
      }: {
        target: "llm" | "tts" | "image";
        llmConfig?: RuntimeLlmConfig;
        ttsConfig?: RuntimeTtsConfig;
        imageConfig?: RuntimeImageConfig;
      } = req.body || {};

      if (target === "llm") {
        const rawMode = llmConfig?.provider || "gemini";
        const mode =
          rawMode === "gemini" &&
          !process.env.GEMINI_API_KEY?.trim() &&
          Boolean(getModelScopeToken())
            ? "modelscope"
            : rawMode;

        if (mode === "gemini") {
          const ai = createGeminiClient(llmConfig?.apiKey);
          const modelName = sanitizeFreeGeminiModel(llmConfig?.model);
          const ping = await ai.models.generateContent({
            model: modelName,
            contents: "请仅回复四个字：信号正常",
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            },
          });
          const sample = (ping.text || "").trim().slice(0, 24) || "信号正常";
          res.json({
            ok: true,
            latencyMs: Date.now() - started,
            summary: `连通成功 · ${modelName} 返回「${sample}」`,
          });
          return;
        }

        const { apiKey, baseUrl, model, allowKeyless } =
          resolveOpenAiCompatibleCredentials(
            mode,
            rawMode === mode ? llmConfig?.baseUrl : undefined,
            rawMode === mode ? llmConfig?.model : undefined,
            rawMode === mode ? llmConfig?.apiKey : undefined
          );
        if (!apiKey && !allowKeyless) {
          res.json({
            ok: false,
            latencyMs: Date.now() - started,
            summary: `未检测到服务端对应环境变量密钥，请检查服务端环境变量配置。`,
          });
          return;
        }
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
        const endpoint = baseUrl.endsWith("/chat/completions")
          ? baseUrl
          : `${baseUrl}/chat/completions`;
        const resp = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model,
            max_tokens: 18,
            messages: [{ role: "user", content: "请仅回复：信号正常" }],
          }),
        });
        if (!resp.ok) {
          const t = await resp.text();
          res.json({
            ok: false,
            latencyMs: Date.now() - started,
            summary: `HTTP ${resp.status}：${t.slice(0, 120)}`,
          });
          return;
        }
        const j = (await resp.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const reply =
          (j.choices?.[0]?.message?.content || "响应就绪").trim().slice(0, 24);
        res.json({
          ok: true,
          latencyMs: Date.now() - started,
          summary: `连通成功 · ${model} 返回「${reply}」`,
        });
        return;
      }

      if (target === "tts") {
        const provider = ttsConfig?.provider || "gemini_tts";
        const sampleLine = "掌柜的，外头风沙大，温一杯铁锈麦酒。";
        if (provider === "off") {
          res.json({
            ok: true,
            latencyMs: 1,
            summary: "当前已设为静默纯文字模式。",
          });
          return;
        }
        if (
          provider === "browser_speech" ||
          (provider === "gemini_tts" &&
            !ttsConfig?.apiKey?.trim() &&
            !process.env.GEMINI_API_KEY?.trim())
        ) {
          res.json({
            ok: true,
            latencyMs: 2,
            browserPreviewText: sampleLine,
            summary:
              provider === "browser_speech"
                ? "本机浏览器中文语音引擎就绪，正在试播样音。"
                : "未配置 Gemini 密钥，已自动回退本机浏览器中文语音试播。",
          });
          return;
        }
        if (provider === "openai_tts") {
          const audioDataUrl = await synthesizeViaOpenAiCompatibleTts({
            text: sampleLine,
            baseUrl: ttsConfig?.baseUrl,
            model: ttsConfig?.model,
            voice: ttsConfig?.voice,
            apiKey: ttsConfig?.apiKey,
          });
          res.json({
            ok: true,
            latencyMs: Date.now() - started,
            audioDataUrl,
            summary: `自定义语音连通成功 · 正在试播酒客样音`,
          });
          return;
        }

        const audioDataUrl = await synthesizeViaGeminiTts({
          cleanText: sampleLine,
          voicePreset: "gruff_male",
          model: ttsConfig?.model,
          explicitVoice: ttsConfig?.voice,
          apiKey: ttsConfig?.apiKey,
        });
        res.json({
          ok: true,
          latencyMs: Date.now() - started,
          audioDataUrl,
          summary: `Gemini 角色语音连通成功 · 正在试播样音`,
        });
        return;
      }

      if (target === "image") {
        const gen = await generateWastelandCharacterImage({
          prompt: "wasteland bartender wearing brass goggles and leather apron",
          slotKind: "portrait",
          lockWastelandStyle: true,
          imageConfig,
        });
        res.json({
          ok: true,
          latencyMs: Date.now() - started,
          summary: `生图通道连通成功 (${gen.modelName}) · 已可在人物库实时绘制立绘`,
          previewImageDataUrl: gen.imageDataUrl,
        });
        return;
      }

      res.status(400).json({ ok: false, latencyMs: 0, summary: "未知测试目标" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.json({
        ok: false,
        latencyMs: Date.now() - started,
        summary: msg.slice(0, 180),
      });
    }
  });

  app.post("/api/image/generate", async (req, res) => {
    try {
      const {
        prompt,
        slotKind = "portrait",
        lockWastelandStyle = true,
        imageConfig,
      }: {
        prompt?: string;
        slotKind?: "portrait" | "combat_full";
        lockWastelandStyle?: boolean;
        imageConfig?: RuntimeImageConfig;
      } = req.body || {};

      if (!prompt || !prompt.trim()) {
        res.status(400).json({ error: "请先输入角色外貌、服饰或武器特征描述。" });
        return;
      }

      const generated = await generateWastelandCharacterImage({
        prompt: prompt.trim(),
        slotKind: slotKind === "combat_full" ? "combat_full" : "portrait",
        lockWastelandStyle: lockWastelandStyle !== false,
        imageConfig,
      });

      res.json(generated);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "角色立绘生成失败，请检查生图通道设置。";
      console.error("[/api/image/generate] Error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  app.post("/api/npc/greet", async (req, res) => {
    try {
      const {
        npc,
        stats,
        memories,
        day,
        weatherDesc,
        activeRumors,
        llmConfig,
      }: {
        npc: NpcProfilePayload;
        stats: NpcStatsPayload;
        memories: MemoryPayload[];
        day: number;
        weatherDesc: string;
        activeRumors?: RumorPayload[];
        llmConfig?: RuntimeLlmConfig;
      } = req.body;

      const systemInstruction = buildSystemInstruction(
        npc,
        stats,
        day,
        weatherDesc,
        activeRumors
      );
      const memoryBlock =
        memories && memories.length > 0
          ? memories
              .slice(-6)
              .map((m) => `- 第${m.day}天 [${m.impactTag}]：${m.summary}`)
              .join("\n")
          : "- 这是该客人第一次推开这家废土酒馆的门，此前尚无交集。";

      const userPrompt = `【过往跨天持久化记忆】
${memoryBlock}

【当前情境】
客人刚刚推开防爆铁门走到吧台前坐下。请结合他/她的过往记忆、外头流传的酒馆风评以及今天的废土天气，说出进门的第一句开场白，并暗示今天想喝什么口味或遇到了什么烦心事（若有伪装身份，此时尚清醒，请自然按表面身份说话）。
注意：此时老板还没调酒端上来，除非客人要主动归还旧账（stats.debtCaps > 0 且 trust >= 45 时可提议 REPAY_DEBT），否则 proposedAction 请设为 "CHAT_ONLY"，intoxicationDelta 设为 0。`;

      const sessionKey = `ses_wt_d${day}_${npc.id}`.replace(/[^a-zA-Z0-9_-]/g, "_");
      const { result, provider, modelName } = await runNpcInference(
        systemInstruction,
        userPrompt,
        sessionKey,
        llmConfig
      );
      result.dialogue = sanitizeDialogueQuotes(result.dialogue);
      res.json({ ...result, provider, modelName });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "调用角色推理服务失败，请检查配置。";
      console.error("[/api/npc/greet] Error:", message);
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/npc/interact", async (req, res) => {
    try {
      const {
        npc,
        stats,
        memories,
        day,
        weatherDesc,
        dialogueHistory,
        playerMessage,
        servedDrink,
        activeRumors,
        llmConfig,
      }: {
        npc: NpcProfilePayload;
        stats: NpcStatsPayload;
        memories: MemoryPayload[];
        day: number;
        weatherDesc: string;
        dialogueHistory: Array<{ speaker: string; text: string }>;
        playerMessage?: string;
        servedDrink?: ServedDrinkPayload;
        activeRumors?: RumorPayload[];
        llmConfig?: RuntimeLlmConfig;
      } = req.body;

      const recentChat =
        dialogueHistory && dialogueHistory.length > 0
          ? dialogueHistory
              .slice(-6)
              .map((d) => `${d.speaker}：${d.text}`)
              .join("\n")
          : "（刚落座）";

      const systemInstruction = buildSystemInstruction(
        npc,
        stats,
        day,
        weatherDesc,
        activeRumors,
        {
          playerMessage,
          recentDialogueText: recentChat,
          servedDrinkName: servedDrink?.name,
        }
      );

      const memoryBlock =
        memories && memories.length > 0
          ? memories
              .slice(-6)
              .map((m) => `- 第${m.day}天 [${m.impactTag}]：${m.summary}`)
              .join("\n")
          : "- 首次到访，尚无历史旧账。";

      let actionContext = "";
      if (servedDrink) {
        const pourDesc =
          servedDrink.pourStyle === "generous"
            ? "慷慨多倒了半杯（老板自掏额外库存招待！）"
            : servedDrink.pourStyle === "watered"
            ? "偷偷兑了辐射水省料（酒味寡淡）"
            : "标准份量";
        actionContext = `【老板刚刚推过吧台的饮品】
- 酒名：《${servedDrink.name}》
- 配方用料：${servedDrink.ingredientsText}
- 倒酒手法：${pourDesc}
- 客观属性：烈度 ${servedDrink.potency}/10 · 安抚度 ${servedDrink.soothing}/10 · 净辐值 ${servedDrink.purification}/10
- 菜单参考价：${servedDrink.suggestedPrice} 枚瓶盖
- 口味匹配结果：${
          servedDrink.matchedPreferences.length > 0
            ? `命中偏好（${servedDrink.matchedPreferences.join("、")}）`
            : "未明显命中偏好"
        }${servedDrink.triggeredDislike ? "；注意：踩中了客人讨厌的配方雷区！" : ""}
${playerMessage ? `- 老板递酒时附带说的话：「${playerMessage}」` : ""}

请让角色品尝这杯酒后给出真实细腻的反应（若角色携有伪装身份且喝下这杯酒后醉意达到催醉阈值，请在台词里微醺失言露出破绽并将 clueRevealed 设为 true），同时给出明确的 proposedAction 与 offerCaps！`;
      } else {
        actionContext = `【老板对客人说的话】
「${playerMessage || "今晚外头风沙大，先坐下暖和暖和。"}」

注意：老板目前正在吧台前与客人搭话或盘问底细，还没有端上调好的酒。请给出贴合人设与当前醉意的回应（若客人已微醺且老板追问到隐秘软肋，可失言露出破绽 clueRevealed=true），除非触发 PROVOKE_BRAWL、主动还债 REPAY_DEBT 或高信任托付委托 OFFER_COMMISSION，否则 proposedAction 保持为 "CHAT_ONLY"。`;
      }

      const userPrompt = `【过往跨天持久化记忆】
${memoryBlock}

【今日吧台近期对话】
${recentChat}

${actionContext}`;

      const sessionKey = `ses_wt_d${day}_${npc.id}`.replace(/[^a-zA-Z0-9_-]/g, "_");
      const { result, provider, modelName } = await runNpcInference(
        systemInstruction,
        userPrompt,
        sessionKey,
        llmConfig
      );
      result.dialogue = sanitizeDialogueQuotes(result.dialogue);
      res.json({ ...result, provider, modelName });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "调用角色互动服务失败，请稍后重试。";
      console.error("[/api/npc/interact] Error:", message);
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/npc/tts", async (req, res) => {
    try {
      const {
        text,
        voicePreset = "brisk_drifter",
        speechStyle = "",
        intoxication = 0,
        ttsConfig,
      }: {
        text?: string;
        voicePreset?: string;
        speechStyle?: string;
        intoxication?: number;
        ttsConfig?: RuntimeTtsConfig;
      } = req.body || {};

      const cleanText = sanitizeDialogueQuotes(String(text || "")).slice(0, 280);
      if (!cleanText) {
        res.status(400).json({ error: "缺少待合成的台词文本" });
        return;
      }

      const provider = ttsConfig?.provider || "gemini_tts";
      if (provider === "browser_speech" || provider === "off") {
        res.json({ engine: "browser-speech", voicePreset });
        return;
      }

      const cacheKey = `${provider}|${ttsConfig?.model || ""}|${
        ttsConfig?.voice || voicePreset
      }|${intoxication >= 30 ? "tipsy" : "sober"}|${cleanText}`;
      const cached = ttsAudioCache.get(cacheKey);
      if (cached) {
        res.json({
          engine: provider,
          audioDataUrl: cached,
        });
        return;
      }

      if (provider === "openai_tts") {
        const audioDataUrl = await synthesizeViaOpenAiCompatibleTts({
          text: cleanText,
          baseUrl: ttsConfig?.baseUrl,
          model: ttsConfig?.model,
          voice: ttsConfig?.voice,
          apiKey: ttsConfig?.apiKey,
        });
        if (ttsAudioCache.size >= TTS_CACHE_LIMIT) {
          const oldestKey = ttsAudioCache.keys().next().value;
          if (oldestKey) ttsAudioCache.delete(oldestKey);
        }
        ttsAudioCache.set(cacheKey, audioDataUrl);
        res.json({
          engine: "openai-tts",
          audioDataUrl,
        });
        return;
      }

      const geminiKey =
        ttsConfig?.apiKey?.trim() || (process.env.GEMINI_API_KEY || "").trim();
      if (!geminiKey) {
        res.json({
          engine: "browser-speech",
          voicePreset,
        });
        return;
      }

      const audioDataUrl = await synthesizeViaGeminiTts({
        cleanText,
        voicePreset,
        speechStyle,
        intoxication,
        model: ttsConfig?.model,
        explicitVoice: ttsConfig?.voice,
        apiKey: ttsConfig?.apiKey,
      });

      if (ttsAudioCache.size >= TTS_CACHE_LIMIT) {
        const oldestKey = ttsAudioCache.keys().next().value;
        if (oldestKey) ttsAudioCache.delete(oldestKey);
      }
      ttsAudioCache.set(cacheKey, audioDataUrl);
      res.json({
        engine: "gemini-tts",
        audioDataUrl,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[/api/npc/tts] Falling back to client voice synthesis:", msg);
      res.json({
        engine: "browser-speech",
        fallbackReason: msg,
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const imagesPath = path.resolve(__dirname, "src/assets/images");
    if (fs.existsSync(imagesPath)) {
      app.use("/src/assets/images", express.static(imagesPath));
    }
    const distPath = path.resolve(__dirname, "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (_req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Wasteland Tavern] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
