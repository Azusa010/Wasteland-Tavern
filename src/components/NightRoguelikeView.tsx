import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ARTWORK_ASSETS,
  describeEnemyIntentDetail,
  INGREDIENT_LIST,
  INGREDIENTS,
  NPC_PROFILES,
  resolveCompanionSpriteUrl,
  resolveEnemySpriteUrl,
  resolveIntentIconUrl,
  resolveProtagonistSprites,
} from "../data/gameConfig";
import { useSettingsAndRoster } from "../data/settingsAndRosterStore";
import {
  ARCHETYPE_META,
  CITY_LOCATIONS,
  compute2d6SuccessChancePct,
  createDefaultRpgState,
  getNormalizedDeckCards,
  PERK_LIBRARY,
  resolveCardStats,
  ResolvedCardStats,
  RPG_ATTRIBUTE_META,
} from "../data/rpgAndCards";
import { getEffectiveCardCost } from "../engine/ruleEngine";
import {
  ActiveEnemy,
  BuildingInteractable,
  BuildingPatrolEnemy,
  CampaignSaveState,
  CityLocationId,
  IngredientId,
  NightCompanionState,
  RpgAttributeKey,
} from "../types/game";
import { soundFx } from "../utils/sound";
import { ArtworkImage } from "./ArtworkImage";
import { CutoutSprite } from "./CutoutSprite";
import { IllustratedGameCard } from "./IllustratedGameCard";
import {
  describeModularParts,
  ModularNpcCombatSprite,
  ModularNpcPortrait,
} from "./ModularNpcPortrait";
import { WastelandTooltip } from "./WastelandTooltip";

interface NightRoguelikeViewProps {
  state: CampaignSaveState;
  onSelectCityLocation: (locationId: CityLocationId) => void;
  onMoveExplore: (
    floor: 1 | 2 | 3,
    x: number,
    facing: "left" | "right"
  ) => void;
  onInteractObject: (objectId: string) => void;
  onEngagePatrol: (patrolId: string, isBackstab: boolean) => void;
  onResolveSurvivorParley: (
    mode: "ELO_PERSUADE" | "CHA_CHARM" | "CAPS_TRADE" | "LEAVE"
  ) => void;
  onCloseWorkbench: () => void;
  onUpgradeCard: (cardUid: string, preferBuildingScrap?: boolean) => void;
  onAllocateStat: (attr: RpgAttributeKey) => void;
  onSelectPerk: (perkId: string) => void;
  onPlayCard: (cardUid: string, targetEnemyUid?: string) => void;
  onAttemptCombatPersuade: (targetEnemyUid?: string) => void;
  onEndTurn: () => void;
  onDraftCardOption: (optionIndex: number | null) => void;
  onFinishNightReturnDawn: () => void;
}

interface CardDragState {
  cardUid: string;
  stats: ResolvedCardStats;
  upgraded: boolean;
  effectiveCost: number;
  targeted: boolean;
  startX: number;
  startY: number;
  curX: number;
  curY: number;
  hoveredEnemyUid: string | null;
}

interface FloatingCombatPopup {
  id: string;
  target: "player" | "companion" | string; // enemy.uid
  text: string;
  tone: "damage" | "block" | "rad" | "heal" | "combo" | "loot";
}

interface EnemyVfxBurst {
  kind: "slash" | "blast" | "rad" | "zap";
  ts: number;
}

interface DyingEnemyGhost {
  enemy: ActiveEnemy;
  finalDamage: number;
  expiresAt: number;
}

interface CastCardGhost {
  id: string;
  stats: ResolvedCardStats;
  upgraded: boolean;
  effectiveCost: number;
}

interface PreCombatSnapshot {
  kind: "PLAY_CARD" | "END_TURN";
  playerHp: number;
  playerBlock: number;
  capsLooted: number;
  comboCount: number;
  enemies: ActiveEnemy[];
}

function doesCardRequireEnemyTarget(stats: ResolvedCardStats): boolean {
  if (stats.aoeDamage > 0 || stats.detonateRadMultiplier > 0) {
    return false;
  }
  if (stats.damage > 0 || stats.damageFromBlockRatio > 0) {
    return true;
  }
  if ((stats.applyRad > 0 && stats.aoeApplyRad === 0) || stats.doubleTargetRad) {
    return true;
  }
  if (stats.applyMarked > 0 && stats.weakenEnemyAttack === 0) {
    return true;
  }
  return false;
}

function resolveObjectSpriteUrl(kind: BuildingInteractable["kind"]): string {
  switch (kind) {
    case "EXIT_DOOR":
      return ARTWORK_ASSETS.propExitBlastDoor;
    case "LOCKED_WEAPON_CRATE":
    case "COMMISSION_TARGET":
      return ARTWORK_ASSETS.propWeaponCrate;
    case "WORKBENCH":
      return ARTWORK_ASSETS.propTinkerWorkbench;
    case "NEUTRAL_SURVIVOR":
      return ARTWORK_ASSETS.charNeutralSurvivor;
    case "SUPPLY_CABINET":
    case "INTEL_COLD_VAULT":
    case "TRAP_LOOT_CACHE":
    default:
      return ARTWORK_ASSETS.propSupplyLocker;
  }
}

function resolveShortObjectTag(obj: BuildingInteractable): string {
  if (obj.used && obj.kind !== "EXIT_DOOR" && obj.kind !== "WORKBENCH") {
    return "已空";
  }
  switch (obj.kind) {
    case "EXIT_DOOR":
      return "撤离门";
    case "LOCKED_WEAPON_CRATE":
      return obj.locked ? "重锁箱" : "武器箱";
    case "WORKBENCH":
      return "改装台";
    case "NEUTRAL_SURVIVOR":
      return "幸存者";
    case "INTEL_COLD_VAULT":
      return "暗号冷柜";
    case "TRAP_LOOT_CACHE":
      return "遗落箱";
    case "COMMISSION_TARGET":
      return "委托物";
    case "SUPPLY_CABINET":
    default:
      return "物资柜";
  }
}

/**
 * 同行伙伴全身战斗立绘：
 * - 4位核心命名熟客使用专属手绘全身战斗立绘
 * - 普通随机过客依然采用多层纸娃娃模块化拼装（背具+躯干+面孔+领口+帽具+体型匹配战术长裤战靴）
 */
export const CompanionCombatFigure: React.FC<{
  companion: NightCompanionState;
  flipHorizontal?: boolean;
  heightClass: string;
}> = ({ companion, flipHorizontal = false, heightClass }) => {
  const isNamedMain =
    companion.npcId === "ash_scavenger" ||
    companion.npcId === "k7_synth" ||
    companion.npcId === "buck_raider" ||
    companion.npcId === "mori_merchant" ||
    Boolean(companion.combatSpriteUrl);

  if (!isNamedMain && companion.modularParts) {
    return (
      <ModularNpcCombatSprite
        parts={companion.modularParts}
        name={companion.name}
        flipHorizontal={flipHorizontal}
        className={`w-auto ${heightClass} drop-shadow-[0_10px_18px_rgba(0,0,0,0.95)]`}
      />
    );
  }

  return (
    <CutoutSprite
      src={resolveCompanionSpriteUrl(companion)}
      alt={companion.name}
      flipHorizontal={flipHorizontal}
      className={`w-auto ${heightClass} drop-shadow-[0_10px_18px_rgba(0,0,0,0.95)]`}
    />
  );
};

/**
 * 分段式图形化生命槽与铆钉装甲槽（附带详细悬停说明）
 */
const SegmentedVitalBars: React.FC<{
  hp: number;
  maxHp: number;
  block: number;
  retainTurns?: number;
  thorns?: number;
  compact?: boolean;
  tone?: "player" | "enemy";
  unitLabel?: string;
}> = ({
  hp,
  maxHp,
  block,
  retainTurns = 0,
  thorns = 0,
  compact = false,
  tone = "player",
  unitLabel = "酒馆掌柜",
}) => {
  const safeMax = Math.max(1, maxHp);
  const ratio = Math.max(0, Math.min(1, hp / safeMax));
  const segCount = compact ? 8 : 12;
  const filledSegs = Math.ceil(ratio * segCount);

  return (
    <WastelandTooltip
      title={`${unitLabel} · 生命与护甲`}
      subtitle={`HP ${hp}/${maxHp}`}
      description={
        tone === "player"
          ? "受到常规攻击时优先消耗蓝色钢甲；辐射腐蚀伤害会穿透护甲。升级或习得《避难所强健体魄》可提升生命上限。"
          : "将敌方生命削减至 0 即可击倒；人类敌人在残血（≤55%）时更容易被口才劝降。"
      }
      details={[
        {
          label: "当前生命",
          value: `${hp} / ${maxHp}`,
          tone: ratio <= 0.35 ? "rose" : "emerald",
        },
        {
          label: "当前护甲",
          value: `${block} 点`,
          tone: "sky",
        },
        ...(retainTurns > 0
          ? [
              {
                label: "护甲保留",
                value: `剩余 ${retainTurns} 回合不清空`,
                tone: "sky" as const,
              },
            ]
          : []),
        ...(thorns > 0
          ? [
              {
                label: "荆棘反伤",
                value: `每次受击自动反震 ${thorns} 点伤害`,
                tone: "amber" as const,
              },
            ]
          : []),
      ]}
    >
      <div
        className={
          compact ? "space-y-1 w-32 sm:w-36" : "space-y-1.5 w-40 sm:w-48"
        }
      >
        <div className="relative h-4 rounded-sm border border-slate-700/90 bg-[#090D12] p-0.5 flex items-center gap-0.5 shadow-inner">
          {Array.from({ length: segCount }).map((_, idx) => {
            const lit = idx < filledSegs && hp > 0;
            return (
              <span
                key={idx}
                className={`h-full flex-1 rounded-[1px] transition-colors ${
                  lit
                    ? tone === "player"
                      ? ratio <= 0.3
                        ? "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.65)]"
                        : "bg-gradient-to-b from-emerald-400 to-emerald-600"
                      : "bg-gradient-to-b from-rose-400 to-rose-700"
                    : "bg-slate-800/70"
                }`}
              />
            );
          })}
          <span className="absolute inset-0 flex items-center justify-center font-mono-num text-[10px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] pointer-events-none">
            {hp}/{maxHp}
          </span>
        </div>

        {(block > 0 || retainTurns > 0 || thorns > 0 || tone === "player") && (
          <div className="relative h-3.5 rounded-sm border border-sky-800/80 bg-[#08111A] overflow-hidden flex items-center">
            <div
              className="h-full bg-gradient-to-r from-sky-600 via-sky-400 to-cyan-300 transition-all duration-200"
              style={{
                width: `${Math.min(100, (block / 25) * 100)}%`,
              }}
            />
            <div className="absolute inset-0 px-1.5 flex items-center justify-between font-mono-num text-[9px] font-bold text-sky-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
              <span>甲 {block}</span>
              {(retainTurns > 0 || thorns > 0) && (
                <span className="text-amber-200">
                  {retainTurns > 0 ? `固${retainTurns}` : ""}
                  {retainTurns > 0 && thorns > 0 ? "·" : ""}
                  {thorns > 0 ? `刺${thorns}` : ""}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </WastelandTooltip>
  );
};

const POPUP_TONE_CLASS: Record<FloatingCombatPopup["tone"], string> = {
  damage:
    "text-rose-300 border-rose-400/80 bg-[#2C0B12]/92 shadow-[0_6px_18px_rgba(244,63,94,0.45)]",
  block:
    "text-sky-200 border-sky-400/80 bg-[#0B2233]/92 shadow-[0_6px_18px_rgba(56,189,248,0.45)]",
  rad: "text-lime-200 border-lime-400/80 bg-[#14280B]/92 shadow-[0_6px_18px_rgba(163,230,53,0.45)]",
  heal: "text-emerald-200 border-emerald-400/80 bg-[#09291B]/92 shadow-[0_6px_18px_rgba(52,211,153,0.45)]",
  combo:
    "text-amber-200 border-amber-400/80 bg-[#2B1B09]/92 shadow-[0_6px_18px_rgba(245,158,11,0.45)]",
  loot: "text-orange-200 border-orange-400/80 bg-[#2A1508]/92 shadow-[0_6px_18px_rgba(251,146,60,0.45)]",
};

export const NightRoguelikeView: React.FC<NightRoguelikeViewProps> = ({
  state,
  onSelectCityLocation,
  onMoveExplore,
  onInteractObject,
  onEngagePatrol,
  onResolveSurvivorParley,
  onCloseWorkbench,
  onUpgradeCard,
  onAllocateStat,
  onSelectPerk,
  onPlayCard,
  onAttemptCombatPersuade,
  onEndTurn,
  onDraftCardOption,
  onFinishNightReturnDawn,
}) => {
  const run = state.nightRun;
  const rpg = state.rpg || createDefaultRpgState();
  useSettingsAndRoster();
  const protagonistSprites = resolveProtagonistSprites();
  const [previewLocationId, setPreviewLocationId] = useState<CityLocationId>(
    run?.selectedLocationId || "ruined_mart"
  );
  const [selectedEnemyUid, setSelectedEnemyUid] = useState<string | null>(null);
  const [showRpgQuickModal, setShowRpgQuickModal] = useState(false);

  // ==================== 杀戮尖塔式拖拽指向与战斗演出动效状态 ====================
  const [dragState, setDragState] = useState<CardDragState | null>(null);
  const [playerAnim, setPlayerAnim] = useState<
    "idle" | "attack" | "guard" | "rad" | "scavenge" | "hit"
  >("idle");
  const [shieldPulseTs, setShieldPulseTs] = useState<number>(0);
  const [companionAssistTs, setCompanionAssistTs] = useState<number>(0);
  const [enemyCounterWaveTs, setEnemyCounterWaveTs] = useState<number>(0);
  const [castCardGhost, setCastCardGhost] = useState<CastCardGhost | null>(
    null
  );
  const [enemyVfxMap, setEnemyVfxMap] = useState<Record<string, EnemyVfxBurst>>(
    {}
  );
  const [floatingPopups, setFloatingPopups] = useState<FloatingCombatPopup[]>(
    []
  );
  const [dyingEnemies, setDyingEnemies] = useState<DyingEnemyGhost[]>([]);

  const preActionSnapshotRef = useRef<PreCombatSnapshot | null>(null);

  const pushPopups = (items: Omit<FloatingCombatPopup, "id">[]) => {
    if (items.length === 0) return;
    const stamped: FloatingCombatPopup[] = items.map((it, idx) => ({
      ...it,
      id: `pop_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
    }));
    setFloatingPopups((prev) => [...prev, ...stamped]);
    window.setTimeout(() => {
      const ids = new Set(stamped.map((s) => s.id));
      setFloatingPopups((prev) => prev.filter((p) => !ids.has(p.id)));
    }, 980);
  };

  const activeTargetUid = useMemo(() => {
    if (!run || run.enemies.length === 0) return undefined;
    if (
      selectedEnemyUid &&
      run.enemies.some((e) => e.uid === selectedEnemyUid && e.hp > 0)
    ) {
      return selectedEnemyUid;
    }
    return run.enemies.find((e) => e.hp > 0)?.uid;
  }, [run, selectedEnemyUid]);

  // 对比打牌/结束回合前后的精确状态变化，生成受击震动、护盾波纹、击毙残影与跳字
  useEffect(() => {
    const snap = preActionSnapshotRef.current;
    if (!snap || !run) return;
    preActionSnapshotRef.current = null;

    const newPopups: Omit<FloatingCombatPopup, "id">[] = [];
    const vfxUpdates: Record<string, EnemyVfxBurst> = {};
    const now = Date.now();

    // 1. 掌柜生命/护甲/瓶盖变动反馈
    const hpDelta = state.playerHp - snap.playerHp;
    const blockDelta = run.playerBlock - snap.playerBlock;
    const capsDelta = run.capsLooted - snap.capsLooted;

    if (hpDelta < 0) {
      newPopups.push({
        target: "player",
        text: `${hpDelta} 生命`,
        tone: "damage",
      });
      setPlayerAnim("hit");
      window.setTimeout(() => setPlayerAnim("idle"), 420);
    } else if (hpDelta > 0) {
      newPopups.push({
        target: "player",
        text: `+${hpDelta} 生命`,
        tone: "heal",
      });
    }

    if (snap.kind === "PLAY_CARD" && blockDelta > 0) {
      newPopups.push({
        target: "player",
        text: `+${blockDelta} 护甲`,
        tone: "block",
      });
      setShieldPulseTs(now);
    } else if (snap.kind === "END_TURN" && snap.playerBlock > run.playerBlock && hpDelta === 0) {
      const absorbed = snap.playerBlock - run.playerBlock;
      if (absorbed > 0) {
        newPopups.push({
          target: "player",
          text: `格挡 -${absorbed}`,
          tone: "block",
        });
        setShieldPulseTs(now);
      }
    }

    if (capsDelta > 0) {
      newPopups.push({
        target: "player",
        text: `+${capsDelta} 瓶盖`,
        tone: "loot",
      });
    }

    // 2. 敌军受击伤害、辐射腐蚀与击倒残影反馈
    const newlyKilled: DyingEnemyGhost[] = [];
    snap.enemies.forEach((prevEnemy) => {
      if (prevEnemy.hp <= 0) return;
      const curEnemy = run.enemies.find((e) => e.uid === prevEnemy.uid);
      const curHp = curEnemy ? curEnemy.hp : 0;
      const curBlock = curEnemy ? curEnemy.block : 0;
      const curRad = curEnemy ? curEnemy.radStacks || 0 : 0;

      const lostHp = Math.max(0, prevEnemy.hp - Math.max(0, curHp));
      const lostBlock = Math.max(0, prevEnemy.block - curBlock);
      const totalDmg = lostHp + lostBlock;
      const gainedRad = Math.max(0, curRad - (prevEnemy.radStacks || 0));

      if (totalDmg > 0) {
        vfxUpdates[prevEnemy.uid] = {
          kind: gainedRad > 0 ? "rad" : totalDmg >= 12 ? "blast" : "slash",
          ts: now,
        };
        newPopups.push({
          target: prevEnemy.uid,
          text:
            curHp <= 0
              ? `-${totalDmg} 击毙!`
              : lostBlock > 0 && lostHp === 0
              ? `破甲 -${lostBlock}`
              : `-${totalDmg}`,
          tone: lostBlock > 0 && lostHp === 0 ? "block" : "damage",
        });
      }

      if (gainedRad > 0) {
        if (!vfxUpdates[prevEnemy.uid]) {
          vfxUpdates[prevEnemy.uid] = { kind: "rad", ts: now };
        }
        newPopups.push({
          target: prevEnemy.uid,
          text: `☢ +${gainedRad}`,
          tone: "rad",
        });
      }

      if (curHp <= 0 && prevEnemy.hp > 0) {
        newlyKilled.push({
          enemy: {
            ...prevEnemy,
            hp: 0,
            block: 0,
          },
          finalDamage: Math.max(1, totalDmg),
          expiresAt: now + 520,
        });
      }
    });

    if (Object.keys(vfxUpdates).length > 0) {
      setEnemyVfxMap((prev) => ({ ...prev, ...vfxUpdates }));
    }

    if (newlyKilled.length > 0) {
      setDyingEnemies((prev) => [...prev, ...newlyKilled]);
      window.setTimeout(() => {
        const tNow = Date.now();
        setDyingEnemies((prev) => prev.filter((g) => g.expiresAt > tNow));
      }, 540);
    }

    pushPopups(newPopups);
  }, [state, run]);

  const triggerPlayCardWithVfx = (
    cardUid: string,
    targetEnemyUid?: string
  ) => {
    if (!run || run.nodeMode !== "COMBAT") return;
    const cardInst = run.hand.find((c) => c.uid === cardUid);
    if (!cardInst) return;
    const st = resolveCardStats(cardInst.defId, cardInst.upgraded);
    const effCost = getEffectiveCardCost(cardInst, run);
    if (run.energy < effCost) return;

    const resolvedTarget = targetEnemyUid || activeTargetUid;
    if (resolvedTarget) {
      setSelectedEnemyUid(resolvedTarget);
    }

    // 记录快照用于精确结算跳字
    preActionSnapshotRef.current = {
      kind: "PLAY_CARD",
      playerHp: state.playerHp,
      playerBlock: run.playerBlock,
      capsLooted: run.capsLooted,
      comboCount: run.comboCount || 0,
      enemies: run.enemies.map((e) => ({ ...e })),
    };

    // 播放音效与角色出招动画
    const isAttackCard =
      st.damage > 0 ||
      st.aoeDamage > 0 ||
      st.damageFromBlockRatio > 0 ||
      st.detonateRadMultiplier > 0;
    const isRadCard =
      st.applyRad > 0 || st.aoeApplyRad > 0 || st.doubleTargetRad;

    if (isAttackCard) {
      soundFx.playCardAction("attack");
      setPlayerAnim("attack");
    } else if (st.block > 0 || st.doubleCurrentBlock) {
      soundFx.playCardAction("guard");
      setPlayerAnim("guard");
      setShieldPulseTs(Date.now());
    } else if (isRadCard) {
      soundFx.playCardAction("attack");
      setPlayerAnim("rad");
    } else {
      soundFx.playCardAction("scavenge");
      setPlayerAnim("scavenge");
    }

    const ghostId = `cast_${Date.now()}`;
    setCastCardGhost({
      id: ghostId,
      stats: st,
      upgraded: Boolean(cardInst.upgraded),
      effectiveCost: effCost,
    });

    window.setTimeout(() => {
      setPlayerAnim((cur) => (cur === "hit" ? cur : "idle"));
    }, 380);
    window.setTimeout(() => {
      setCastCardGhost((cur) => (cur?.id === ghostId ? null : cur));
    }, 420);

    onPlayCard(cardUid, resolvedTarget);
  };

  const triggerEndTurnWithVfx = () => {
    if (!run || run.nodeMode !== "COMBAT") return;
    preActionSnapshotRef.current = {
      kind: "END_TURN",
      playerHp: state.playerHp,
      playerBlock: run.playerBlock,
      capsLooted: run.capsLooted,
      comboCount: run.comboCount || 0,
      enemies: run.enemies.map((e) => ({ ...e })),
    };

    const now = Date.now();
    if (run.companion) {
      setCompanionAssistTs(now);
      pushPopups([
        {
          target: "companion",
          text: run.companion.skillName,
          tone: "combo",
        },
      ]);
    }
    setEnemyCounterWaveTs(now);
    soundFx.playCardAction("guard");
    onEndTurn();
  };

  // ==================== 杀戮尖塔式手牌拖拽全局监听 ====================
  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (ev: PointerEvent) => {
      const hitEl = document
        .elementFromPoint(ev.clientX, ev.clientY)
        ?.closest("[data-enemy-uid]") as HTMLElement | null;
      const hoveredUid = hitEl?.dataset.enemyUid || null;
      setDragState((prev) =>
        prev
          ? {
              ...prev,
              curX: ev.clientX,
              curY: ev.clientY,
              hoveredEnemyUid: hoveredUid,
            }
          : null
      );
    };

    const handlePointerUp = (ev: PointerEvent) => {
      const current = dragState;
      setDragState(null);
      const travel = Math.hypot(
        ev.clientX - current.startX,
        ev.clientY - current.startY
      );

      // 轻点（位移 < 12px）：快捷打出到当前选中敌人
      if (travel < 12) {
        triggerPlayCardWithVfx(current.cardUid, activeTargetUid);
        return;
      }

      if (current.targeted) {
        const hitEl = document
          .elementFromPoint(ev.clientX, ev.clientY)
          ?.closest("[data-enemy-uid]") as HTMLElement | null;
        const dropTargetUid =
          hitEl?.dataset.enemyUid || current.hoveredEnemyUid;
        if (dropTargetUid) {
          triggerPlayCardWithVfx(current.cardUid, dropTargetUid);
        }
      } else {
        // 非指向型卡牌（防御/全体轰炸/搜刮/战术）：向上拖出牌区超过 65px 即可释放
        if (ev.clientY < current.startY - 65) {
          triggerPlayCardWithVfx(current.cardUid, activeTargetUid);
        }
      }
    };

    const handlePointerCancel = () => {
      setDragState(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  });

  const building = run?.building || null;

  const nearbyClimbUpLadder = useMemo(() => {
    if (!building) return null;
    return (
      building.ladders.find(
        (l) =>
          l.lowerFloor === building.playerFloor &&
          Math.abs(l.x - building.playerX) <= 10
      ) || null
    );
  }, [building]);

  const nearbyClimbDownLadder = useMemo(() => {
    if (!building) return null;
    return (
      building.ladders.find(
        (l) =>
          l.upperFloor === building.playerFloor &&
          Math.abs(l.x - building.playerX) <= 10
      ) || null
    );
  }, [building]);

  const nearbyObject = useMemo((): BuildingInteractable | null => {
    if (!building) return null;
    const candidates = building.objects
      .filter(
        (o) =>
          o.floor === building.playerFloor &&
          (!o.used || o.kind === "EXIT_DOOR" || o.kind === "WORKBENCH") &&
          Math.abs(o.x - building.playerX) <= 11
      )
      .sort(
        (a, b) =>
          Math.abs(a.x - building.playerX) - Math.abs(b.x - building.playerX)
      );
    return candidates[0] || null;
  }, [building]);

  const nearbyBackstabPatrol = useMemo((): BuildingPatrolEnemy | null => {
    if (!building) return null;
    return (
      building.patrols.find((p) => {
        if (p.defeated || p.floor !== building.playerFloor) return false;
        const dx = building.playerX - p.x;
        const dist = Math.abs(dx);
        const isBehind =
          (p.facing === "right" && dx < 0) || (p.facing === "left" && dx > 0);
        return isBehind && dist <= 18;
      }) || null
    );
  }, [building]);

  useEffect(() => {
    if (
      !run ||
      run.nodeMode !== "BUILDING_EXPLORE" ||
      !building ||
      showRpgQuickModal
    ) {
      return;
    }

    const stepSize =
      6 + Math.min(3, Math.max(0, (rpg.attributes.AGI || 2) - 2));

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "a" || e.key === "ArrowLeft") {
        e.preventDefault();
        onMoveExplore(
          building.playerFloor,
          Math.max(6, building.playerX - stepSize),
          "left"
        );
      } else if (key === "d" || e.key === "ArrowRight") {
        e.preventDefault();
        onMoveExplore(
          building.playerFloor,
          Math.min(94, building.playerX + stepSize),
          "right"
        );
      } else if (key === "w" || e.key === "ArrowUp") {
        if (nearbyClimbUpLadder) {
          e.preventDefault();
          onMoveExplore(
            nearbyClimbUpLadder.upperFloor,
            nearbyClimbUpLadder.x,
            building.playerFacing
          );
        }
      } else if (key === "s" || e.key === "ArrowDown") {
        if (nearbyClimbDownLadder) {
          e.preventDefault();
          onMoveExplore(
            nearbyClimbDownLadder.lowerFloor,
            nearbyClimbDownLadder.x,
            building.playerFacing
          );
        }
      } else if (key === "e" || key === " ") {
        e.preventDefault();
        if (nearbyBackstabPatrol) {
          onEngagePatrol(nearbyBackstabPatrol.id, true);
        } else if (nearbyObject) {
          onInteractObject(nearbyObject.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    run,
    building,
    rpg.attributes.AGI,
    nearbyClimbUpLadder,
    nearbyClimbDownLadder,
    nearbyBackstabPatrol,
    nearbyObject,
    showRpgQuickModal,
    onMoveExplore,
    onEngagePatrol,
    onInteractObject,
  ]);

  if (!run) return null;

  const lootedIngredientEntries = INGREDIENT_LIST.filter(
    (ing) => (run.lootBag[ing.id] || 0) > 0
  );
  const totalLootCount = (Object.keys(run.lootBag) as IngredientId[]).reduce(
    (sum, k) => sum + (run.lootBag[k] || 0),
    0
  );
  const unspentRpg = (rpg.statPoints || 0) + (rpg.pendingPerkChoices || 0);
  const xpPct = Math.max(
    4,
    Math.min(100, Math.round((rpg.xp / Math.max(1, rpg.nextLevelXp)) * 100))
  );

  const handleSmartWalkOrObjectClick = (
    targetX: number,
    objectToInteractId?: string
  ) => {
    if (!building) return;
    const curX = building.playerX;
    const minSeg = Math.min(curX, targetX);
    const maxSeg = Math.max(curX, targetX);

    const blockingEnemy = building.patrols.find(
      (p) =>
        !p.defeated &&
        p.floor === building.playerFloor &&
        p.x > minSeg + 1 &&
        p.x < maxSeg - 1
    );

    if (blockingEnemy) {
      const approachX =
        curX < blockingEnemy.x ? blockingEnemy.x - 5 : blockingEnemy.x + 5;
      onMoveExplore(
        building.playerFloor,
        approachX,
        targetX >= curX ? "right" : "left"
      );
      return;
    }

    if (objectToInteractId) {
      onInteractObject(objectToInteractId);
    } else {
      onMoveExplore(
        building.playerFloor,
        targetX,
        targetX >= curX ? "right" : "left"
      );
    }
  };

  const selectedCityLoc =
    CITY_LOCATIONS.find((l) => l.id === previewLocationId) || CITY_LOCATIONS[0];
  const deckCards = getNormalizedDeckCards(state);

  const isActivelyDragging = Boolean(
    dragState &&
      Math.hypot(
        dragState.curX - dragState.startX,
        dragState.curY - dragState.startY
      ) >= 12
  );
  const isUntargetedReadyToCast = Boolean(
    isActivelyDragging &&
      dragState &&
      !dragState.targeted &&
      dragState.curY < dragState.startY - 65
  );

  // 计算二次贝塞尔准星轨迹节点（无 SVG，纯 GPU transform 发光战术导引链）
  const bezierBeads = useMemo(() => {
    if (!isActivelyDragging || !dragState || !dragState.targeted) return [];
    const { startX, startY, curX, curY } = dragState;
    const ctrlX = (startX + curX) * 0.5;
    const ctrlY = Math.min(startY, curY) - 115;
    const count = 15;
    const nodes: Array<{ x: number; y: number; deg: number; t: number }> = [];
    for (let i = 1; i <= count; i++) {
      const t = i / (count + 1);
      const inv = 1 - t;
      const x = inv * inv * startX + 2 * inv * t * ctrlX + t * t * curX;
      const y = inv * inv * startY + 2 * inv * t * ctrlY + t * t * curY;
      const dx = 2 * inv * (ctrlX - startX) + 2 * t * (curX - ctrlX);
      const dy = 2 * inv * (ctrlY - startY) + 2 * t * (curY - ctrlY);
      const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
      nodes.push({ x, y, deg, t });
    }
    return nodes;
  }, [isActivelyDragging, dragState]);

  // 合并存活敌军与刚被击毙的短暂受击残影，确保终结一击有完整刀光与跳字演出
  const visibleArenaEnemies = useMemo(() => {
    if (!run) return [];
    const aliveIds = new Set(
      run.enemies.filter((e) => e.hp > 0).map((e) => e.uid)
    );
    const list: Array<{ enemy: ActiveEnemy; isDying: boolean }> = run.enemies
      .filter((e) => e.hp > 0)
      .map((enemy) => ({ enemy, isDying: false }));
    dyingEnemies.forEach((ghost) => {
      if (!aliveIds.has(ghost.enemy.uid)) {
        list.push({ enemy: ghost.enemy, isDying: true });
      }
    });
    return list;
  }, [run, dyingEnemies]);

  return (
    <div className="space-y-3 text-slate-100 pb-3 h-full flex flex-col">
      {/* ==================== 图形化角色状态仪表盘（全图标 + 全项悬停详情说明） ==================== */}
      {run.nodeMode !== "CITY_MAP" && (
        <section className="rounded-xl border border-slate-800/90 bg-[#0E141C] px-3.5 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-lg">
          <div className="flex items-center gap-3">
            {/* 掌柜特写半身肖像框（修复立绘裁切问题） */}
            <WastelandTooltip
              title={`零号酒馆掌柜 · LV.${rpg.level}`}
              subtitle={`经验 ${rpg.xp}/${rpg.nextLevelXp}`}
              description="白昼调酒社交与黑夜废墟搜刮共享同一套等级与属性成长。点击头像随时打开哔哔小子分配属性点或习得专长。"
              details={[
                {
                  label: "力量 (STR)",
                  value: `${rpg.attributes.STR} 点（近战与破拆加成）`,
                  tone: "rose",
                },
                {
                  label: "敏捷 (AGI)",
                  value: `${rpg.attributes.AGI} 点（护甲与开锁闪避）`,
                  tone: "sky",
                },
                {
                  label: "口才 (ELO)",
                  value: `${rpg.attributes.ELO} 点（套话与残血劝降）`,
                  tone: "emerald",
                },
                {
                  label: "魅力 (CHA)",
                  value: `${rpg.attributes.CHA} 点（小费与幸存者赠礼）`,
                  tone: "amber",
                },
              ]}
            >
              <button
                type="button"
                onClick={() => setShowRpgQuickModal(true)}
                className="relative w-12 h-12 rounded-lg border-2 border-amber-500/75 bg-[#080B10] overflow-hidden shrink-0 cursor-pointer group"
              >
                <CutoutSprite
                  src={protagonistSprites.avatarUrl}
                  alt={protagonistSprites.name}
                  cropMode="none"
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform"
                />
                <span className="absolute top-0 left-0 px-1 py-[1px] rounded-br bg-amber-500 text-[#140E08] font-mono-num text-[9px] font-extrabold leading-none">
                  LV.{rpg.level}
                </span>
                <span className="absolute inset-x-0 bottom-0 h-1 bg-black/80 block">
                  <span
                    style={{ width: `${xpPct}%` }}
                    className="h-full bg-emerald-400 block"
                  />
                </span>
              </button>
            </WastelandTooltip>

            <SegmentedVitalBars
              hp={state.playerHp}
              maxHp={state.playerMaxHp}
              block={run.nodeMode === "COMBAT" ? run.playerBlock : 0}
              retainTurns={run.retainBlockTurns || 0}
              thorns={run.thorns || 0}
              tone="player"
              unitLabel="酒馆掌柜"
            />

            {building && (
              <WastelandTooltip
                title={building.locationName}
                subtitle={building.floorLabels[building.playerFloor - 1]}
                description="横版三层废墟建筑剖面。支持键盘 WASD / 方向键走位爬梯、E 键搜柜或背刺，也可直接用鼠标点击任意位置与设施。"
                details={[
                  {
                    label: "当前所在楼层",
                    value: building.floorLabels[building.playerFloor - 1],
                    tone: "amber",
                  },
                  {
                    label: "撤离点位置",
                    value: "1F 最左侧防爆门（随时带走战利品）",
                    tone: "emerald",
                  },
                ]}
              >
                <div className="hidden sm:flex flex-col pl-2 border-l border-slate-800 cursor-help">
                  <span className="font-display text-sm font-bold text-slate-100 leading-tight">
                    {building.locationName}
                  </span>
                  <span className="font-mono-num text-[11px] text-amber-400/90">
                    {building.floorLabels[building.playerFloor - 1]}
                  </span>
                </div>
              </WastelandTooltip>
            )}
          </div>

          {/* 右侧：实物贴图资源徽章（全部支持悬停查看详细说明） */}
          <div className="flex flex-wrap items-center gap-2">
            <WastelandTooltip
              title="本趟已搜刮瓶盖"
              subtitle={`+${run.capsLooted} 瓶盖`}
              description="废土硬通货。可通过搜翻柜子、拾荒机关牌、击败敌人或口才劝降获取，撤离回酒馆后并入营业总金库。"
              details={[
                {
                  label: "酒馆金库现存",
                  value: `${state.caps} 枚瓶盖`,
                  tone: "amber",
                },
                {
                  label: "撤离后预计总计",
                  value: `${state.caps + run.capsLooted} 枚瓶盖`,
                  tone: "emerald",
                },
              ]}
            >
              <div className="h-9 px-2.5 rounded-lg border border-amber-500/40 bg-[#17130D] flex items-center gap-2 cursor-help">
                <img
                  src={ARTWORK_ASSETS.propBrassCoaster}
                  alt="瓶盖"
                  className="w-6 h-6 rounded-full object-cover shrink-0"
                />
                <span className="font-mono-num text-xs font-bold text-amber-300">
                  +{run.capsLooted}
                </span>
              </div>
            </WastelandTooltip>

            {building && (
              <WastelandTooltip
                title="废铁改装零件"
                subtitle={`持有 ×${building.scrapParts}`}
                description="在废墟物资柜、军火箱与巡逻敌人身上拆解出的精密齿轮弹簧。前往建筑内的「钳工改装台」每满 3 枚即可将任意卡牌免费升至 ★+1 星！"
                details={[
                  {
                    label: "工作台升星消耗",
                    value: "3 枚零件 / 张",
                    tone: "sky",
                  },
                  {
                    label: "角色永久升级点",
                    value: `${rpg.upgradeTokens} 点`,
                    tone: "amber",
                  },
                ]}
              >
                <div className="h-9 px-2.5 rounded-lg border border-sky-500/35 bg-[#0D1620] flex items-center gap-2 cursor-help">
                  <ArtworkImage
                    src={ARTWORK_ASSETS.propTinkerWorkbench}
                    alt="零件"
                    className="w-6 h-6 rounded object-cover shrink-0"
                    tone="cold"
                  />
                  <span className="font-mono-num text-xs font-bold text-sky-200">
                    ×{building.scrapParts}
                  </span>
                </div>
              </WastelandTooltip>
            )}

            {/* 战利品食材实物缩略图架 */}
            <div className="h-9 px-2 rounded-lg border border-slate-700/80 bg-[#0A0F15] flex items-center gap-1.5">
              {lootedIngredientEntries.length > 0 ? (
                lootedIngredientEntries.map((ing) => (
                  <WastelandTooltip
                    key={ing.id}
                    title={`${ing.name} ×${run.lootBag[ing.id]}`}
                    subtitle={ing.flavorTags.join(" · ")}
                    description={`${ing.subtitle}。明日白昼调酒的核心原料，撤离返航后自动存入吧台冷藏箱。`}
                    details={[
                      {
                        label: "酒精度 / 安抚 / 净辐",
                        value: `+${ing.potencyBonus} / +${ing.soothingBonus} / +${ing.purificationBonus}`,
                        tone: "emerald",
                      },
                      {
                        label: "吧台冷藏箱现存",
                        value: `${state.inventory[ing.id] || 0} 份`,
                        tone: "amber",
                      },
                    ]}
                  >
                    <div className="relative w-6 h-6 rounded border border-slate-600 overflow-hidden shrink-0 cursor-help">
                      <ArtworkImage
                        src={ing.imageUrl}
                        alt={ing.name}
                        className="w-full h-full object-cover"
                        tone="warm"
                      />
                      <span className="absolute bottom-0 right-0 px-0.5 bg-black/85 font-mono-num text-[9px] font-bold text-amber-300 leading-none">
                        {run.lootBag[ing.id]}
                      </span>
                    </div>
                  </WastelandTooltip>
                ))
              ) : (
                <WastelandTooltip
                  title="搜刮原料背囊"
                  subtitle="当前 0 份"
                  description="翻找建筑各层的物资柜、特供冷柜或在战斗中打出「拾荒搜刮」类卡牌，即可收获明日调酒所需的废土原料。"
                  details={[
                    {
                      label: "已装袋总数",
                      value: `${totalLootCount} 份`,
                      tone: "slate",
                    },
                  ]}
                >
                  <div className="flex items-center gap-1.5 px-0.5 opacity-65 cursor-help">
                    <ArtworkImage
                      src={ARTWORK_ASSETS.propSupplyLocker}
                      alt="搜刮包"
                      className="w-6 h-6 rounded object-cover"
                      tone="cold"
                    />
                    <span className="font-mono-num text-xs text-slate-400">
                      0
                    </span>
                  </div>
                </WastelandTooltip>
              )}
            </div>

            {/* 同行伙伴立绘章 */}
            {run.companion && (
              <WastelandTooltip
                title={`同行助战 · ${run.companion.name}`}
                subtitle={run.companion.title}
                description="白天在酒馆盛情款待并赢得高度信任后主动随行护航。每场战斗在你的回合结束时自动施展专属援护技！"
                details={[
                  {
                    label: "每回合自动援护",
                    value: run.companion.skillName,
                    tone: "emerald",
                  },
                  {
                    label: "技能效果",
                    value: run.companion.skillDesc,
                    tone: "amber",
                  },
                  ...(run.companion.modularParts
                    ? [
                        {
                          label: "外貌装束",
                          value: describeModularParts(
                            run.companion.modularParts
                          ),
                          tone: "slate" as const,
                        },
                      ]
                    : []),
                ]}
              >
                <div className="h-9 pr-2.5 pl-1 rounded-lg border border-emerald-500/45 bg-[#0C1D16] flex items-center gap-2 cursor-help">
                  <div className="w-7 h-7 rounded overflow-hidden bg-[#07110D] border border-emerald-400/50 shrink-0">
                    {run.companion.modularParts &&
                    !NPC_PROFILES[
                      run.companion.npcId as keyof typeof NPC_PROFILES
                    ] ? (
                      <ModularNpcPortrait
                        parts={run.companion.modularParts}
                        name={run.companion.name}
                        className="w-full h-full"
                      />
                    ) : (
                      <CutoutSprite
                        src={
                          run.companion.portraitUrl ||
                          resolveCompanionSpriteUrl(run.companion)
                        }
                        alt={run.companion.name}
                        className="w-full h-full object-cover object-top"
                      />
                    )}
                  </div>
                  <span className="font-mono-num text-xs font-semibold text-emerald-200 whitespace-nowrap">
                    {run.companion.name}
                  </span>
                </div>
              </WastelandTooltip>
            )}

            {/* 哔哔小子战地加点入口 */}
            <WastelandTooltip
              title="哔哔小子 3000 战地终端"
              subtitle={`LV.${rpg.level}`}
              description="随时打开查看四维属性（力量/敏捷/口才/魅力）与辐射风专长，若有升级未分配点数可现场加点生效。"
              details={[
                {
                  label: "未分配属性点",
                  value: `${rpg.statPoints || 0} 点`,
                  tone: (rpg.statPoints || 0) > 0 ? "emerald" : "slate",
                },
                {
                  label: "待习得专长",
                  value: `${rpg.pendingPerkChoices || 0} 项`,
                  tone: (rpg.pendingPerkChoices || 0) > 0 ? "amber" : "slate",
                },
              ]}
            >
              <button
                type="button"
                onClick={() => setShowRpgQuickModal(true)}
                className={`h-9 px-2.5 rounded-lg border flex items-center gap-1.5 cursor-pointer transition-colors ${
                  unspentRpg > 0
                    ? "border-emerald-400 bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-200"
                    : "border-slate-700 bg-[#121A24] hover:border-slate-500 text-slate-300"
                }`}
              >
                <img
                  src={ARTWORK_ASSETS.propPipboyBezel}
                  alt="哔哔小子"
                  className="w-6 h-6 object-contain shrink-0"
                />
                <span className="font-mono-num text-xs font-bold whitespace-nowrap">
                  {unspentRpg > 0 ? `+${unspentRpg}` : `LV.${rpg.level}`}
                </span>
              </button>
            </WastelandTooltip>
          </div>
        </section>
      )}

      {/* ==================== 阶段一：《这是我的战争》风手绘俯瞰废墟地图与克制侦察卡 ==================== */}
      {run.nodeMode === "CITY_MAP" && (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <div className="lg:col-span-8 xl:col-span-9 relative min-h-[420px] lg:min-h-[520px] rounded-xl border border-slate-800/90 bg-[#0A0E13] overflow-hidden shadow-2xl">
            <ArtworkImage
              src={ARTWORK_ASSETS.nightCityMap}
              alt="灰烬裂谷夜间俯瞰地图"
              fallbackTitle="灰烬裂谷"
              className="absolute inset-0 w-full h-full object-cover opacity-95"
              tone="cold"
            />
            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_95px_rgba(5,8,12,0.85)] bg-gradient-to-t from-[#070A0E]/55 via-transparent to-[#070A0E]/35" />

            <div className="absolute top-4 left-5 z-10 pointer-events-none">
              <span className="font-mono-num text-[11px] tracking-widest text-slate-300/75 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
                零号街区 · 夜探选点
              </span>
            </div>

            {unspentRpg > 0 && (
              <button
                type="button"
                onClick={() => setShowRpgQuickModal(true)}
                className="absolute top-3.5 right-4 z-20 px-3 py-1.5 rounded-lg border border-emerald-500/45 bg-[#0B1318]/90 hover:bg-[#122026] text-xs font-mono-num text-emerald-300 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <img
                  src={ARTWORK_ASSETS.propPipboyBezel}
                  alt="加点"
                  className="w-4 h-4 object-contain"
                />
                <span>角色加点 +{unspentRpg}</span>
              </button>
            )}

            {/* 零号酒馆地堡起点锚点 */}
            <div
              style={{ left: "15%", top: "78%" }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
            >
              <WastelandTooltip
                title="零号防空洞酒馆（大本营）"
                subtitle={`DAY 0${state.day}`}
                description="你的地下铁皮酒馆大本营。今夜可挑选一处城市废墟建筑潜入搜刮原料与新卡牌，随时从据点 1F 防爆门撤回。"
                details={[
                  {
                    label: "当前生命",
                    value: `${state.playerHp}/${state.playerMaxHp}`,
                    tone: "emerald",
                  },
                  {
                    label: "库存瓶盖",
                    value: `${state.caps} 枚`,
                    tone: "amber",
                  },
                ]}
              >
                <div className="flex flex-col items-center cursor-help">
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-emerald-400/80 bg-[#0B1512] shadow-[0_4px_14px_rgba(0,0,0,0.9)]">
                    <ArtworkImage
                      src={ARTWORK_ASSETS.tavernDay}
                      alt="零号酒馆"
                      className="w-full h-full object-cover"
                      tone="warm"
                    />
                  </div>
                  <span className="mt-1 text-[11px] font-medium text-slate-300/90 tracking-wide drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)] whitespace-nowrap">
                    零号酒馆
                  </span>
                </div>
              </WastelandTooltip>
            </div>

            {CITY_LOCATIONS.map((loc) => {
              const selected = loc.id === previewLocationId;
              const hasHook =
                (loc.id === "shelled_clinic" && state.nightIntelUnlocked) ||
                (loc.id === "cryo_reactor" && state.nightBossWeakened) ||
                Boolean(
                  state.activeCommission && !state.activeCommission.completed
                );
              const romanDanger =
                loc.dangerRating === 1
                  ? "Ⅰ"
                  : loc.dangerRating === 2
                  ? "Ⅱ"
                  : loc.dangerRating === 3
                  ? "Ⅲ"
                  : "Ⅳ";

              return (
                <div
                  key={loc.id}
                  style={{ left: `${loc.mapX}%`, top: `${loc.mapY}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 ${
                    selected ? "z-30" : "z-20"
                  }`}
                >
                  <WastelandTooltip
                    title={loc.name}
                    subtitle={loc.dangerLabel}
                    description={loc.subtitle}
                    details={[
                      {
                        label: "态势特征",
                        value: loc.tagSummary,
                        tone: loc.dangerRating >= 3 ? "amber" : "slate",
                      },
                      {
                        label: "主要物产",
                        value: loc.lootPreviewIds
                          .map((id) => INGREDIENTS[id]?.name)
                          .filter(Boolean)
                          .join("、"),
                        tone: "emerald",
                      },
                      {
                        label: "操作方式",
                        value: "单击预览详情 · 双击直接潜入",
                        tone: "sky",
                      },
                    ]}
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewLocationId(loc.id)}
                      onDoubleClick={() => onSelectCityLocation(loc.id)}
                      className={`group flex flex-col items-center transition-transform duration-150 cursor-pointer focus:outline-none ${
                        selected ? "scale-105" : "hover:scale-105"
                      }`}
                    >
                      <div
                        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 transition-colors shadow-[0_10px_28px_rgba(0,0,0,0.92)] bg-[#0B0F14] ${
                          selected
                            ? "border-[#E59A3C] ring-4 ring-[#E59A3C]/22"
                            : "border-slate-400/55 opacity-85 group-hover:opacity-100 group-hover:border-slate-200"
                        }`}
                      >
                        <ArtworkImage
                          src={loc.imageUrl}
                          alt={loc.name}
                          fallbackTitle={loc.shortName}
                          className="w-full h-full object-cover"
                          tone="cold"
                        />
                      </div>

                      <div
                        className={`mt-1.5 px-2 py-0.5 rounded bg-[#090D12]/88 backdrop-blur-[2px] flex items-center gap-1.5 text-xs whitespace-nowrap transition-colors ${
                          selected
                            ? "text-[#FDF5EB] font-semibold"
                            : "text-slate-300 group-hover:text-white"
                        }`}
                      >
                        {hasHook && (
                          <span className="text-[#E59A3C] text-[10px]">◆</span>
                        )}
                        <span>{loc.shortName}</span>
                        <span
                          className={`font-mono-num text-[11px] ${
                            loc.dangerRating >= 4
                              ? "text-rose-400"
                              : loc.dangerRating === 3
                              ? "text-amber-400"
                              : "text-slate-400"
                          }`}
                        >
                          {romanDanger}
                        </span>
                      </div>
                    </button>
                  </WastelandTooltip>
                </div>
              );
            })}
          </div>

          <aside className="lg:col-span-4 xl:col-span-3 rounded-xl border border-slate-800/90 bg-[#0D1218] p-5 flex flex-col justify-between gap-6">
            <div className="space-y-5">
              <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden border border-slate-800 bg-[#070A0E]">
                <ArtworkImage
                  src={selectedCityLoc.imageUrl}
                  alt={selectedCityLoc.name}
                  fallbackTitle={selectedCityLoc.name}
                  className="w-full h-full object-cover"
                  tone="cold"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0D1218]/75 via-transparent to-transparent pointer-events-none" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono-num">
                  <span
                    className={
                      selectedCityLoc.dangerRating >= 4
                        ? "text-rose-400 font-semibold"
                        : selectedCityLoc.dangerRating === 3
                        ? "text-amber-400 font-semibold"
                        : "text-slate-300"
                    }
                  >
                    {selectedCityLoc.dangerLabel}
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-400 truncate">
                    {selectedCityLoc.tagSummary}
                  </span>
                </div>

                <h2 className="font-display text-2xl font-bold text-slate-100 tracking-wide">
                  {selectedCityLoc.name}
                </h2>

                <p className="text-xs text-slate-400 leading-relaxed pt-0.5">
                  {selectedCityLoc.subtitle}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
                  主要物产
                </span>
                <div className="flex items-center gap-2">
                  {selectedCityLoc.lootPreviewIds.map((ingId) => {
                    const ing = INGREDIENTS[ingId];
                    if (!ing) return null;
                    return (
                      <WastelandTooltip
                        key={ingId}
                        title={ing.name}
                        subtitle={`库存 ×${state.inventory[ingId] || 0}`}
                        description={ing.subtitle}
                        details={[
                          {
                            label: "风味标签",
                            value: ing.flavorTags.join(" · "),
                            tone: "amber",
                          },
                          {
                            label: "吧台现存",
                            value: `${state.inventory[ingId] || 0} 份`,
                            tone:
                              (state.inventory[ingId] || 0) <= 1
                                ? "rose"
                                : "emerald",
                          },
                        ]}
                      >
                        <div className="w-9 h-9 rounded border border-slate-700/80 bg-[#080B0F] overflow-hidden shrink-0 cursor-help">
                          <ArtworkImage
                            src={ing.imageUrl}
                            alt={ing.name}
                            fallbackTitle={ing.name}
                            className="w-full h-full object-cover"
                            tone="warm"
                          />
                        </div>
                      </WastelandTooltip>
                    );
                  })}
                </div>
              </div>

              {(run.companion ||
                (selectedCityLoc.id === "shelled_clinic" &&
                  state.nightIntelUnlocked) ||
                (selectedCityLoc.id === "cryo_reactor" &&
                  state.nightBossWeakened) ||
                (state.activeCommission &&
                  !state.activeCommission.completed) ||
                state.nightTrapCacheUnlocked) && (
                <div className="pt-3 border-t border-slate-800/60 space-y-1.5 text-xs text-slate-300">
                  {run.companion && (
                    <p className="text-emerald-300/90">
                      同行 · {run.companion.name}（{run.companion.skillName}）
                    </p>
                  )}
                  {selectedCityLoc.id === "shelled_clinic" &&
                    state.nightIntelUnlocked && (
                      <p className="text-amber-300/90">
                        暗号 · 二层特供冷柜已解锁
                      </p>
                    )}
                  {selectedCityLoc.id === "cryo_reactor" &&
                    state.nightBossWeakened && (
                      <p className="text-amber-300/90">
                        情报 · 深层巨钳兽已负伤
                      </p>
                    )}
                  {state.activeCommission &&
                    !state.activeCommission.completed && (
                      <p className="text-amber-300/90 truncate">
                        委托 · {state.activeCommission.title}
                      </p>
                    )}
                  {state.nightTrapCacheUnlocked && (
                    <p className="text-emerald-300/90">
                      线索 · 一层遗落暗探补给箱
                    </p>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => onSelectCityLocation(selectedCityLoc.id)}
              className="w-full py-2.5 px-5 rounded-lg bg-[#E59A3C] hover:bg-[#F0A84B] text-[#140F0A] font-semibold text-sm flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <span>潜入据点 →</span>
            </button>
          </aside>
        </div>
      )}

      {/* ==================== 阶段二：全手绘贴图三层建筑横版剖面探索（全身角色+全身伙伴+全设施Tooltip） ==================== */}
      {run.nodeMode === "BUILDING_EXPLORE" && building && (
        <div className="relative rounded-xl border border-slate-800 bg-[#080B10] overflow-hidden shadow-2xl">
          <div className="relative h-[474px] sm:h-[510px] select-none">
            <ArtworkImage
              src={ARTWORK_ASSETS.interiorCutawayFloors}
              alt={building.locationName}
              fallbackTitle={building.locationName}
              className="absolute inset-0 w-full h-full object-cover"
              tone="cold"
            />
            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_80px_rgba(4,7,11,0.8)]" />

            <div className="relative z-10 h-full grid grid-rows-3">
              {([3, 2, 1] as const).map((floorNum) => {
                const isPlayerOnThisFloor = building.playerFloor === floorNum;
                const floorLabel = building.floorLabels[floorNum - 1];
                const floorObjects = building.objects.filter(
                  (o) => o.floor === floorNum
                );
                const floorPatrols = building.patrols.filter(
                  (p) => p.floor === floorNum && !p.defeated
                );

                return (
                  <div
                    key={floorNum}
                    onClick={(e) => {
                      if (!isPlayerOnThisFloor) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pct = Math.round(
                        ((e.clientX - rect.left) / Math.max(1, rect.width)) *
                          100
                      );
                      handleSmartWalkOrObjectClick(
                        Math.max(6, Math.min(94, pct))
                      );
                    }}
                    className={`relative border-b border-black/60 overflow-hidden transition-colors duration-200 ${
                      isPlayerOnThisFloor
                        ? "bg-transparent cursor-pointer"
                        : "bg-[#05080C]/52"
                    }`}
                  >
                    <div className="absolute top-2 left-3 z-10 pointer-events-none">
                      <span
                        className={`px-1.5 py-0.5 rounded bg-black/65 font-mono-num text-[10px] tracking-wider ${
                          isPlayerOnThisFloor
                            ? "text-amber-300 font-bold"
                            : "text-slate-400/80"
                        }`}
                      >
                        {floorLabel}
                      </span>
                    </div>

                    {/* 贯通楼板的锈铁扶梯（带悬停说明） */}
                    {building.ladders
                      .filter(
                        (lad) =>
                          lad.lowerFloor === floorNum ||
                          lad.upperFloor === floorNum
                      )
                      .map((lad) => {
                        const goesUp = lad.lowerFloor === floorNum;
                        const targetFloor = goesUp
                          ? lad.upperFloor
                          : lad.lowerFloor;
                        const isNearLadder =
                          isPlayerOnThisFloor &&
                          Math.abs(lad.x - building.playerX) <= 10;

                        return (
                          <div
                            key={`${lad.id}_f${floorNum}`}
                            style={{ left: `${lad.x}%` }}
                            className="absolute top-0 bottom-1.5 -translate-x-1/2 z-15"
                          >
                            <WastelandTooltip
                              title={
                                goesUp
                                  ? `锈铁扶梯（通往 ${lad.upperFloor}F）`
                                  : `锈铁扶梯（下至 ${lad.lowerFloor}F）`
                              }
                              subtitle={goesUp ? "按 W / ↑" : "按 S / ↓"}
                              description="连通上下楼层的金属检修梯。可直接点击梯子跨层移动，或走到梯口按 W / S 键攀爬。"
                              className="h-full block"
                            >
                              <button
                                type="button"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  if (isPlayerOnThisFloor) {
                                    onMoveExplore(
                                      targetFloor,
                                      lad.x,
                                      building.playerFacing
                                    );
                                  } else if (
                                    building.playerFloor === targetFloor
                                  ) {
                                    onMoveExplore(
                                      floorNum,
                                      lad.x,
                                      building.playerFacing
                                    );
                                  }
                                }}
                                className={`h-full w-8 flex flex-col justify-between py-1.5 border-x-[3px] cursor-pointer transition-colors ${
                                  isNearLadder
                                    ? "border-amber-400 bg-amber-950/35 shadow-[0_0_16px_rgba(245,158,11,0.35)]"
                                    : "border-[#6E4B2A]/85 bg-black/35 hover:border-amber-400/85"
                                }`}
                              >
                                {Array.from({ length: 7 }).map((_, rIdx) => (
                                  <span
                                    key={rIdx}
                                    className="w-full h-[3px] bg-gradient-to-r from-[#52371E] via-[#9A6B3B] to-[#52371E] block shadow-sm"
                                  />
                                ))}
                                {isNearLadder && (
                                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-1 py-0.5 rounded bg-amber-400 text-[#140E08] font-mono-num text-[9px] font-extrabold whitespace-nowrap shadow">
                                    {goesUp ? `W↑` : `S↓`}
                                  </span>
                                )}
                              </button>
                            </WastelandTooltip>
                          </div>
                        );
                      })}

                    {/* 本层真实手绘交互设施与中立幸存者立绘（带详细检定概率 Tooltip） */}
                    {floorObjects.map((obj) => {
                      const isExit = obj.kind === "EXIT_DOOR";
                      const isBench = obj.kind === "WORKBENCH";
                      const isSurvivor = obj.kind === "NEUTRAL_SURVIVOR";
                      const isCrate =
                        obj.kind === "LOCKED_WEAPON_CRATE" ||
                        obj.kind === "COMMISSION_TARGET";
                      const isDepleted = Boolean(
                        obj.used && !isExit && !isBench
                      );
                      const isNearObj =
                        isPlayerOnThisFloor &&
                        !isDepleted &&
                        Math.abs(obj.x - building.playerX) <= 11;

                      const spriteSizeClass = isExit
                        ? "h-[86px] sm:h-[96px]"
                        : isSurvivor
                        ? "h-[90px] sm:h-[100px]"
                        : isBench
                        ? "h-[80px] sm:h-[90px]"
                        : isCrate
                        ? "h-[64px] sm:h-[72px]"
                        : "h-[78px] sm:h-[88px]";

                      const lockAttr: RpgAttributeKey =
                        (rpg.attributes.AGI || 2) >= (rpg.attributes.STR || 2)
                          ? "AGI"
                          : "STR";
                      const lockChance = compute2d6SuccessChancePct(
                        rpg,
                        lockAttr,
                        8
                      );

                      return (
                        <div
                          key={obj.id}
                          style={{ left: `${obj.x}%` }}
                          className="absolute bottom-1.5 -translate-x-1/2 z-20"
                        >
                          <WastelandTooltip
                            title={obj.label}
                            subtitle={resolveShortObjectTag(obj)}
                            description={obj.subtitle}
                            details={[
                              {
                                label: "当前状态",
                                value: isDepleted
                                  ? "已搜刮清空"
                                  : isNearObj
                                  ? "已在交互距离内（按 E 或点击）"
                                  : "点击自动走向并交互",
                                tone: isDepleted
                                  ? "slate"
                                  : isNearObj
                                  ? "amber"
                                  : "emerald",
                              },
                              ...(obj.kind === "LOCKED_WEAPON_CRATE" &&
                              obj.locked &&
                              !isDepleted
                                ? [
                                    {
                                      label: `开锁检定 (${lockAttr})`,
                                      value: `无伤巧开率 ${lockChance}%（失手可强砸但擦伤 3HP）`,
                                      tone: "sky" as const,
                                    },
                                  ]
                                : []),
                            ]}
                          >
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                if (!isPlayerOnThisFloor) return;
                                handleSmartWalkOrObjectClick(obj.x, obj.id);
                              }}
                              className={`group flex flex-col items-center focus:outline-none transition-transform duration-150 ${
                                isDepleted
                                  ? "cursor-default"
                                  : "hover:scale-105 cursor-pointer"
                              }`}
                            >
                              <div
                                className={`relative flex items-end justify-center ${
                                  isNearObj
                                    ? "drop-shadow-[0_0_12px_rgba(245,158,11,0.85)]"
                                    : "drop-shadow-[0_6px_10px_rgba(0,0,0,0.9)]"
                                }`}
                              >
                                <CutoutSprite
                                  src={resolveObjectSpriteUrl(obj.kind)}
                                  alt={obj.label}
                                  dimmed={isDepleted}
                                  className={`w-auto ${spriteSizeClass}`}
                                />
                              </div>

                              <span
                                className={`-mt-1 px-1.5 py-0.5 rounded font-mono-num text-[10px] leading-none whitespace-nowrap transition-opacity ${
                                  isDepleted
                                    ? "bg-black/65 text-slate-500"
                                    : isNearObj
                                    ? "bg-amber-400 text-[#140E08] font-extrabold shadow"
                                    : "bg-black/78 text-slate-200 opacity-85 group-hover:opacity-100"
                                }`}
                              >
                                {isNearObj
                                  ? `[E] ${resolveShortObjectTag(obj)}`
                                  : resolveShortObjectTag(obj)}
                              </span>
                            </button>
                          </WastelandTooltip>
                        </div>
                      );
                    })}

                    {/* 本层真实手绘巡逻敌人精灵（带朝向红光锥与背刺说明 Tooltip） */}
                    {floorPatrols.map((patrol) => {
                      const playerBehind =
                        isPlayerOnThisFloor &&
                        ((patrol.facing === "right" &&
                          building.playerX < patrol.x) ||
                          (patrol.facing === "left" &&
                            building.playerX > patrol.x));
                      const primaryEnemyId =
                        patrol.enemyIds[0] || "scrap_looter";
                      const enemySpriteClass = patrol.isBoss
                        ? "h-[116px] sm:h-[128px]"
                        : patrol.isElite
                        ? "h-[98px] sm:h-[108px]"
                        : "h-[86px] sm:h-[96px]";

                      return (
                        <div
                          key={patrol.id}
                          style={{ left: `${patrol.x}%` }}
                          className="absolute bottom-1.5 -translate-x-1/2 z-25 flex flex-col items-center transition-all duration-200"
                        >
                          <div
                            aria-hidden="true"
                            className={`absolute bottom-4 w-28 h-16 pointer-events-none ${
                              patrol.facing === "right"
                                ? "left-1/2 bg-gradient-to-r from-rose-500/32 to-transparent [clip-path:polygon(0_38%,100%_0,100%_100%,0_65%)]"
                                : "right-1/2 bg-gradient-to-l from-rose-500/32 to-transparent [clip-path:polygon(100%_38%,0_0,0_100%,100%_65%)]"
                            }`}
                          />

                          <WastelandTooltip
                            title={patrol.name}
                            subtitle={
                              patrol.isBoss
                                ? "据点首领"
                                : patrol.isElite
                                ? "精英强敌"
                                : "巡逻敌军"
                            }
                            description={patrol.subtitle}
                            details={[
                              {
                                label: "警戒朝向",
                                value:
                                  patrol.facing === "right"
                                    ? "面朝右侧（红色光锥方向）"
                                    : "面朝左侧（红色光锥方向）",
                                tone: "rose",
                              },
                              {
                                label: "潜行战术",
                                value: playerBehind
                                  ? "★ 已绕至背后！点击发动先手偷袭（首回合 +1 能量、+4 护甲、全敌挂标记）"
                                  : "绕到红光反方向背侧可触发先手偷袭优势",
                                tone: playerBehind ? "amber" : "sky",
                              },
                            ]}
                          >
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                if (!isPlayerOnThisFloor) return;
                                onEngagePatrol(patrol.id, playerBehind);
                              }}
                              className="relative group flex flex-col items-center cursor-pointer focus:outline-none hover:scale-105 transition-transform"
                            >
                              {playerBehind && (
                                <span className="mb-0.5 px-1.5 py-0.5 rounded bg-amber-400 text-[#140E08] font-mono-num text-[10px] font-extrabold whitespace-nowrap shadow">
                                  ★ 偷袭
                                </span>
                              )}
                              <CutoutSprite
                                src={resolveEnemySpriteUrl(primaryEnemyId)}
                                alt={patrol.name}
                                flipHorizontal={patrol.facing === "right"}
                                className={`w-auto ${enemySpriteClass} drop-shadow-[0_6px_12px_rgba(0,0,0,0.95)]`}
                              />
                              <span className="-mt-1 px-1.5 py-0.5 rounded bg-[#260D12]/90 border border-rose-500/50 font-mono-num text-[10px] text-rose-200 leading-none whitespace-nowrap">
                                {patrol.name.slice(0, 6)}
                              </span>
                            </button>
                          </WastelandTooltip>
                        </div>
                      );
                    })}

                    {/* 玩家操控的酒馆掌柜全身立绘 + 同行伙伴全身战斗立绘 */}
                    {isPlayerOnThisFloor && (
                      <>
                        {run.companion && (
                          <div
                            style={{
                              left: `${Math.max(
                                5,
                                Math.min(
                                  95,
                                  building.playerFacing === "right"
                                    ? building.playerX - 6.5
                                    : building.playerX + 6.5
                                )
                              )}%`,
                            }}
                            className="absolute bottom-1.5 -translate-x-1/2 z-28 pointer-events-none transition-all duration-200 opacity-95"
                          >
                            <CompanionCombatFigure
                              companion={run.companion}
                              flipHorizontal={building.playerFacing === "left"}
                              heightClass="h-[88px] sm:h-[98px]"
                            />
                          </div>
                        )}

                        <div
                          style={{ left: `${building.playerX}%` }}
                          className="absolute bottom-1.5 -translate-x-1/2 z-30 flex flex-col items-center pointer-events-none transition-all duration-150"
                        >
                          <div
                            aria-hidden="true"
                            className={`absolute bottom-6 w-32 h-16 pointer-events-none ${
                              building.playerFacing === "right"
                                ? "left-1/2 bg-gradient-to-r from-amber-300/30 to-transparent [clip-path:polygon(0_38%,100%_4%,100%_96%,0_64%)]"
                                : "right-1/2 bg-gradient-to-l from-amber-300/30 to-transparent [clip-path:polygon(100%_38%,0_4%,0_96%,100%_64%)]"
                            }`}
                          />

                          <CutoutSprite
                            src={protagonistSprites.combatSpriteUrl}
                            alt={protagonistSprites.name}
                            flipHorizontal={building.playerFacing === "left"}
                            className="w-auto h-[96px] sm:h-[108px] drop-shadow-[0_0_14px_rgba(229,154,60,0.45)]"
                          />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-3.5 py-2.5 bg-[#0D131B] border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  onMoveExplore(
                    building.playerFloor,
                    Math.max(6, building.playerX - 7),
                    "left"
                  )
                }
                className="px-2.5 py-1 rounded border border-slate-700 bg-slate-800/90 hover:bg-slate-700 font-mono-num text-xs whitespace-nowrap cursor-pointer"
              >
                ← A
              </button>
              <button
                type="button"
                onClick={() =>
                  onMoveExplore(
                    building.playerFloor,
                    Math.min(94, building.playerX + 7),
                    "right"
                  )
                }
                className="px-2.5 py-1 rounded border border-slate-700 bg-slate-800/90 hover:bg-slate-700 font-mono-num text-xs whitespace-nowrap cursor-pointer"
              >
                D →
              </button>

              {nearbyClimbUpLadder && (
                <button
                  type="button"
                  onClick={() =>
                    onMoveExplore(
                      nearbyClimbUpLadder.upperFloor,
                      nearbyClimbUpLadder.x,
                      building.playerFacing
                    )
                  }
                  className="px-2.5 py-1 rounded border border-amber-500/60 bg-amber-950/60 hover:bg-amber-900/70 text-amber-200 font-mono-num text-xs font-bold whitespace-nowrap cursor-pointer"
                >
                  ↑ {nearbyClimbUpLadder.upperFloor}F [W]
                </button>
              )}

              {nearbyClimbDownLadder && (
                <button
                  type="button"
                  onClick={() =>
                    onMoveExplore(
                      nearbyClimbDownLadder.lowerFloor,
                      nearbyClimbDownLadder.x,
                      building.playerFacing
                    )
                  }
                  className="px-2.5 py-1 rounded border border-amber-500/60 bg-amber-950/60 hover:bg-amber-900/70 text-amber-200 font-mono-num text-xs font-bold whitespace-nowrap cursor-pointer"
                >
                  ↓ {nearbyClimbDownLadder.lowerFloor}F [S]
                </button>
              )}

              {nearbyBackstabPatrol && (
                <button
                  type="button"
                  onClick={() =>
                    onEngagePatrol(nearbyBackstabPatrol.id, true)
                  }
                  className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono-num text-xs font-extrabold whitespace-nowrap cursor-pointer shadow"
                >
                  ★ 背刺「{nearbyBackstabPatrol.name}」[E]
                </button>
              )}

              {nearbyObject && (
                <button
                  type="button"
                  onClick={() => onInteractObject(nearbyObject.id)}
                  className="px-3 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono-num text-xs font-extrabold whitespace-nowrap cursor-pointer shadow"
                >
                  {nearbyObject.label} [E]
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <p className="text-xs text-slate-400 truncate max-w-md">
                {building.exploreLog[0]}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (building.playerFloor === 1 && building.playerX <= 22) {
                    onInteractObject("obj_exit");
                  } else {
                    handleSmartWalkOrObjectClick(
                      8,
                      building.playerFloor === 1 ? "obj_exit" : undefined
                    );
                  }
                }}
                className="px-2.5 py-1 rounded border border-emerald-500/50 bg-emerald-950/45 hover:bg-emerald-900/60 text-emerald-300 font-mono-num text-xs whitespace-nowrap shrink-0 cursor-pointer"
              >
                {building.playerFloor === 1 ? "撤离返航" : "回1F撤离门"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 现场交互一：中立幸存者立绘交涉舞台 ==================== */}
      {run.nodeMode === "SURVIVOR_PARLEY" && building && (
        <div className="max-w-3xl mx-auto rounded-xl border border-lime-500/40 bg-[#0E1614] overflow-hidden shadow-2xl">
          {(() => {
            const surv = building.objects.find(
              (o) => o.id === building.activeSurvivorId
            );
            const eloChance = compute2d6SuccessChancePct(rpg, "ELO", 9);
            const chaChance = compute2d6SuccessChancePct(rpg, "CHA", 9);
            return (
              <div className="grid grid-cols-1 md:grid-cols-12">
                <div className="md:col-span-5 relative min-h-[240px] bg-[#080D0C] flex items-end justify-center overflow-hidden border-b md:border-b-0 md:border-r border-slate-800">
                  <ArtworkImage
                    src={ARTWORK_ASSETS.interiorCutawayFloors}
                    alt="废墟角落"
                    className="absolute inset-0 w-full h-full object-cover opacity-30"
                    tone="cold"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0E1614] via-transparent to-black/40" />
                  <CutoutSprite
                    src={ARTWORK_ASSETS.charNeutralSurvivor}
                    alt={surv?.survivorName || "幸存者"}
                    className="relative z-10 h-[220px] w-auto drop-shadow-[0_10px_20px_rgba(0,0,0,0.95)]"
                  />
                </div>

                <div className="md:col-span-7 p-5 space-y-4">
                  <div>
                    <span className="font-mono-num text-[11px] text-lime-400">
                      幸存者偶遇
                    </span>
                    <h2 className="font-display text-xl font-bold text-white mt-0.5">
                      {surv?.survivorName || "落单的拾荒客"}
                    </h2>
                    <p className="text-xs text-slate-300 leading-relaxed mt-1.5">
                      {surv?.survivorPrompt}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => onResolveSurvivorParley("ELO_PERSUADE")}
                      className="w-full p-3 rounded-lg border border-emerald-500/50 bg-[#12241C] hover:bg-[#183126] text-left cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs font-mono-num text-emerald-300">
                        <span>2d6 + 口才({rpg.attributes.ELO}) vs 9</span>
                        <strong>{eloChance}%</strong>
                      </div>
                      <p className="font-bold text-sm text-white mt-0.5">
                        分享安全路线换取稀有卡与草药
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => onResolveSurvivorParley("CHA_CHARM")}
                      className="w-full p-3 rounded-lg border border-amber-500/50 bg-[#241C11] hover:bg-[#302516] text-left cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs font-mono-num text-amber-300">
                        <span>2d6 + 魅力({rpg.attributes.CHA}) vs 9</span>
                        <strong>{chaChance}%</strong>
                      </div>
                      <p className="font-bold text-sm text-white mt-0.5">
                        温言赠饮（回 8 生命 + 三选一全升 +1 星）
                      </p>
                    </button>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onResolveSurvivorParley("CAPS_TRADE")}
                        className="p-2.5 rounded-lg border border-slate-700 bg-[#141D26] hover:border-amber-400 text-left cursor-pointer"
                      >
                        <span className="block font-mono-num text-[11px] text-amber-300">
                          -6 瓶盖
                        </span>
                        <span className="font-bold text-xs text-white">
                          买下物资与新卡
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onResolveSurvivorParley("LEAVE")}
                        className="p-2.5 rounded-lg border border-slate-800 bg-[#0E141B] hover:bg-slate-800/70 text-left cursor-pointer"
                      >
                        <span className="block font-mono-num text-[11px] text-slate-400">
                          暂留点位
                        </span>
                        <span className="font-bold text-xs text-slate-200">
                          收起武器离开
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ==================== 现场交互二：废土钳工改装台（统一艺术牌框升星） ==================== */}
      {run.nodeMode === "WORKBENCH_UPGRADE" && (
        <div className="rounded-xl border border-sky-500/45 bg-[#0E1620] p-5 space-y-4 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg border border-sky-400/50 bg-[#080D14] overflow-hidden shrink-0">
                <CutoutSprite
                  src={ARTWORK_ASSETS.propTinkerWorkbench}
                  alt="钳工改装台"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-white">
                  钳工改装台 · 卡牌升至 ★+1 星
                </h2>
                <p className="font-mono-num text-xs text-slate-400">
                  废铁零件 ×{building?.scrapParts || 0}（3枚升星） · 升级点 ×
                  {rpg.upgradeTokens}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onCloseWorkbench}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white whitespace-nowrap cursor-pointer"
            >
              返回建筑
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {deckCards.map((entry) => {
              const cur = resolveCardStats(entry.defId, entry.upgraded);
              const upg = resolveCardStats(entry.defId, true);
              const canScrap = Boolean(building && building.scrapParts >= 3);
              const canToken = rpg.upgradeTokens > 0;

              return (
                <IllustratedGameCard
                  key={entry.uid}
                  stats={cur}
                  upgraded={entry.upgraded}
                  upgradePreviewText={
                    !entry.upgraded ? upg.description : undefined
                  }
                  compact
                >
                  {!entry.upgraded && (
                    <div className="flex flex-col gap-1">
                      {canScrap && (
                        <button
                          type="button"
                          onClick={() => onUpgradeCard(entry.uid, true)}
                          className="w-full py-1 px-2 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 text-[11px] font-bold whitespace-nowrap cursor-pointer"
                        >
                          3 零件升 ★+1
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={!canToken}
                        onClick={() => onUpgradeCard(entry.uid, false)}
                        className="w-full py-1 px-2 rounded border border-amber-400/70 bg-amber-950/40 hover:bg-amber-900/50 disabled:opacity-30 text-amber-200 text-[11px] font-bold whitespace-nowrap cursor-pointer"
                      >
                        1 升级点升 ★+1
                      </button>
                    </div>
                  )}
                </IllustratedGameCard>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== 阶段三：横版地堡实景战斗舞台 + 攻击/护盾动效 + 杀戮尖塔式拖拽打牌 ==================== */}
      {run.nodeMode === "COMBAT" && (
        <div className="space-y-3">
          {/* 上半部：真实手绘地堡交火舞台 */}
          <div
            className={`relative min-h-[296px] sm:min-h-[328px] rounded-xl border transition-colors duration-150 bg-[#090D12] overflow-hidden shadow-2xl flex flex-col justify-between ${
              isUntargetedReadyToCast
                ? "border-emerald-400 ring-2 ring-emerald-400/35"
                : "border-slate-800"
            }`}
          >
            <ArtworkImage
              src={ARTWORK_ASSETS.combatArenaBackdrop}
              alt="地堡遭遇战舞台"
              fallbackTitle="遭遇战"
              className="absolute inset-0 w-full h-full object-cover"
              tone="cold"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#070A0F]/90 via-[#070A0F]/20 to-[#070A0F]/65 pointer-events-none" />

            {/* 非指向型手牌拖入战场时的光幕提示 */}
            {isActivelyDragging && dragState && !dragState.targeted && (
              <div
                className={`absolute inset-x-0 top-9 flex justify-center z-30 pointer-events-none`}
              >
                <span
                  className={`px-3 py-1 rounded-md border font-mono-num text-xs font-bold shadow-lg ${
                    isUntargetedReadyToCast
                      ? "border-emerald-300 bg-emerald-950/92 text-emerald-200"
                      : "border-amber-400/60 bg-black/80 text-amber-200"
                  }`}
                >
                  {isUntargetedReadyToCast
                    ? `★ 松开鼠标立即施放《${dragState.stats.name}》`
                    : `↑ 继续向上拖入战场施放《${dragState.stats.name}》`}
                </span>
              </div>
            )}

            {/* 出牌瞬间飞入战场中央的残影特效 */}
            <AnimatePresence>
              {castCardGhost && (
                <motion.div
                  key={castCardGhost.id}
                  initial={{ opacity: 0.95, y: 95, scale: 0.86, rotate: -4 }}
                  animate={{
                    opacity: [0.98, 1, 0],
                    y: [95, -8, -54],
                    scale: [0.86, 1.04, 0.55],
                    rotate: [-4, 2, 0],
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="absolute left-1/2 bottom-6 -translate-x-1/2 w-[132px] z-35 pointer-events-none"
                >
                  <IllustratedGameCard
                    stats={castCardGhost.stats}
                    upgraded={castCardGhost.upgraded}
                    effectiveCost={castCardGhost.effectiveCost}
                    disableTooltip
                    compact
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* 舞台顶部战况条 */}
            <div className="relative z-10 px-4 pt-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-mono-num text-xs">
                <WastelandTooltip
                  title={`第 ${run.turn} 回合`}
                  description="每回合开始自动恢复满行动能量并补充手牌。可将单攻牌拖动到指定敌人身上精准打击，或将防御/范围牌向上拖入战场释放。"
                >
                  <span className="px-2 py-0.5 rounded bg-black/70 border border-slate-700 text-amber-300 font-bold cursor-help">
                    TURN {String(run.turn).padStart(2, "0")}
                  </span>
                </WastelandTooltip>

                {run.ambushAdvantage && (
                  <WastelandTooltip
                    title="★ 潜行背刺先手优势"
                    description="从巡逻敌人背后成功发起突袭：首回合额外获得 +1 点行动能量、+4 点初始护甲，并使全体敌军挂载 1 回合锁定标记（受击 +35%）！"
                  >
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/60 text-amber-200 font-bold cursor-help">
                      ★ 先手偷袭
                    </span>
                  </WastelandTooltip>
                )}
              </div>

              {run.combatLog[0] && (
                <p className="px-2.5 py-0.5 rounded bg-black/65 text-[11px] text-slate-200 max-w-xl truncate">
                  {run.combatLog[0]}
                </p>
              )}
            </div>

            {/* 舞台中央对峙角色层 */}
            <div className="relative z-10 px-4 sm:px-8 pb-3 pt-2 grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
              {/* 左侧我方阵地：同行伙伴全身立绘 + 掌柜全身立绘 + 护盾/突刺动效 */}
              <div className="lg:col-span-5 flex flex-col items-start gap-2">
                <div className="flex items-end gap-3.5">
                  {run.companion && (
                    <WastelandTooltip
                      title={`${run.companion.name} · ${run.companion.title}`}
                      subtitle="同行助战"
                      description={`每当你点击「结束回合」时，${run.companion.name}会自动出手施展《${run.companion.skillName}》：${run.companion.skillDesc}`}
                    >
                      <motion.div
                        key={`comp_${companionAssistTs}`}
                        animate={
                          companionAssistTs > 0
                            ? { x: [0, 32, -4, 0], scale: [1, 1.06, 1] }
                            : { x: 0, scale: 1 }
                        }
                        transition={{ duration: 0.36, ease: "easeOut" }}
                        className="relative flex flex-col items-center cursor-help"
                      >
                        {/* 伙伴头顶飘字 */}
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center gap-1">
                          <AnimatePresence>
                            {floatingPopups
                              .filter((p) => p.target === "companion")
                              .map((p) => (
                                <motion.span
                                  key={p.id}
                                  initial={{ opacity: 0, y: 10, scale: 0.85 }}
                                  animate={{ opacity: 1, y: -12, scale: 1 }}
                                  exit={{ opacity: 0, y: -24 }}
                                  transition={{ duration: 0.55 }}
                                  className={`px-2 py-0.5 rounded border font-mono-num text-[10px] font-extrabold whitespace-nowrap ${
                                    POPUP_TONE_CLASS[p.tone]
                                  }`}
                                >
                                  {p.text}
                                </motion.span>
                              ))}
                          </AnimatePresence>
                        </div>

                        <CompanionCombatFigure
                          companion={run.companion}
                          heightClass="h-[126px] sm:h-[146px]"
                        />
                        <span className="-mt-1 px-1.5 py-0.5 rounded bg-emerald-950/90 border border-emerald-500/50 font-mono-num text-[10px] text-emerald-200 whitespace-nowrap">
                          {run.companion.skillName}
                        </span>
                      </motion.div>
                    </WastelandTooltip>
                  )}

                  {/* 掌柜全身战斗立绘 + 突刺/防御钢盾波纹/受击震动 */}
                  <WastelandTooltip
                    title={`零号掌柜 · LV.${rpg.level}`}
                    subtitle={`STR ${rpg.attributes.STR} · AGI ${rpg.attributes.AGI}`}
                    description="力量高于 2 时提升近战与重甲砸击伤害；敏捷高于 2 时提升防御牌获取的护甲值。"
                    details={[
                      {
                        label: "当前护甲",
                        value: `${run.playerBlock} 点`,
                        tone: "sky",
                      },
                      {
                        label: "枪火连击点",
                        value: `${run.comboCount || 0} 点`,
                        tone: "amber",
                      },
                    ]}
                  >
                    <motion.div
                      animate={
                        playerAnim === "attack"
                          ? {
                              x: [0, 62, -6, 0],
                              rotate: [0, 5, -1, 0],
                              scale: [1, 1.07, 1],
                            }
                          : playerAnim === "guard"
                          ? { scale: [1, 1.06, 1], y: [0, -4, 0] }
                          : playerAnim === "rad"
                          ? { x: [0, 26, 0], scale: [1, 1.05, 1] }
                          : playerAnim === "scavenge"
                          ? { y: [0, -10, 0], scale: [1, 1.04, 1] }
                          : playerAnim === "hit"
                          ? { x: [0, -18, 12, -8, 0] }
                          : { x: 0, y: 0, rotate: 0, scale: 1 }
                      }
                      transition={{ duration: 0.34, ease: "easeOut" }}
                      className="relative flex flex-col items-center cursor-help"
                    >
                      {/* 掌柜头顶浮动数值（+护甲 / -生命 / +回血 / +瓶盖） */}
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center gap-1">
                        <AnimatePresence>
                          {floatingPopups
                            .filter((p) => p.target === "player")
                            .map((p) => (
                              <motion.span
                                key={p.id}
                                initial={{ opacity: 0, y: 12, scale: 0.82 }}
                                animate={{ opacity: 1, y: -14, scale: 1.02 }}
                                exit={{ opacity: 0, y: -28 }}
                                transition={{ duration: 0.65 }}
                                className={`px-2 py-0.5 rounded border font-mono-num text-xs font-extrabold whitespace-nowrap ${
                                  POPUP_TONE_CLASS[p.tone]
                                }`}
                              >
                                {p.text}
                              </motion.span>
                            ))}
                        </AnimatePresence>
                      </div>

                      {/* 防御护甲展开光盾动效 */}
                      <AnimatePresence>
                        {shieldPulseTs > 0 && (
                          <motion.div
                            key={`shield_${shieldPulseTs}`}
                            initial={{ opacity: 0.92, scale: 0.62 }}
                            animate={{ opacity: 0, scale: 1.32 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.52, ease: "easeOut" }}
                            className="absolute inset-x-[-18px] top-3 bottom-2 rounded-t-full rounded-b-2xl border-[3px] border-sky-300 bg-gradient-to-b from-cyan-300/35 via-sky-500/20 to-transparent shadow-[0_0_28px_rgba(56,189,248,0.85)] pointer-events-none z-20"
                          />
                        )}
                      </AnimatePresence>

                      {/* 攻击出招前冲流光弧 */}
                      <AnimatePresence>
                        {playerAnim === "attack" && (
                          <motion.div
                            key="atk_arc"
                            initial={{ opacity: 0.95, x: 8, scaleX: 0.6 }}
                            animate={{ opacity: 0, x: 74, scaleX: 1.35 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className="absolute right-[-36px] top-1/3 w-20 h-16 rounded-r-full border-r-4 border-amber-300 bg-gradient-to-r from-transparent to-amber-400/35 pointer-events-none z-20"
                          />
                        )}
                      </AnimatePresence>

                      <CutoutSprite
                        src={protagonistSprites.combatSpriteUrl}
                        alt={protagonistSprites.name}
                        className={`h-[142px] sm:h-[164px] w-auto drop-shadow-[0_12px_22px_rgba(0,0,0,0.95)] ${
                          playerAnim === "hit"
                            ? "brightness-150 saturate-150"
                            : ""
                        }`}
                      />
                    </motion.div>
                  </WastelandTooltip>
                </div>

                {/* 掌柜脚下分段血甲条 + 四流派图形化连携圆章 */}
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <SegmentedVitalBars
                    hp={state.playerHp}
                    maxHp={state.playerMaxHp}
                    block={run.playerBlock}
                    retainTurns={run.retainBlockTurns || 0}
                    thorns={run.thorns || 0}
                    compact
                    tone="player"
                    unitLabel="酒馆掌柜"
                  />

                  <WastelandTooltip
                    title="枪火连击流 · 连击点"
                    subtitle={`当前 ×${run.comboCount || 0}`}
                    description="本回合每打出一张枪火连击组件都会累计连击点：《废铁加特林弹幕》按 1+连击点多段扫射，《死眼处决》每点连击降低 1 点耗能！"
                  >
                    <div
                      className={`h-8 px-2 rounded border flex items-center gap-1.5 cursor-help ${
                        (run.comboCount || 0) > 0
                          ? "border-amber-400 bg-[#291B0C]/90 text-amber-200"
                          : "border-slate-700/80 bg-black/65 text-slate-400"
                      }`}
                    >
                      <ArtworkImage
                        src={ARTWORK_ASSETS.cardArtGunslinger}
                        alt="连击"
                        className="w-5 h-5 rounded-xs object-cover"
                        tone="cold"
                      />
                      <span className="font-mono-num text-xs font-bold">
                        ×{run.comboCount || 0}
                      </span>
                    </div>
                  </WastelandTooltip>

                  <WastelandTooltip
                    title="拾荒机关流 · 磁暴与陷阱计数"
                    subtitle={`电击 ${run.gadgetTurretDmg || 0} · 已投 ${
                      run.gadgetsPlayedCount || 0
                    }`}
                    description="架设《自制磁暴线圈》后，每打出一张 0 费衍生机关或搜刮牌都会自动电击随机敌人；累计触发次数越高，《破片风暴投掷器》群伤越猛烈！"
                  >
                    <div
                      className={`h-8 px-2 rounded border flex items-center gap-1.5 cursor-help ${
                        (run.gadgetTurretDmg || 0) > 0 ||
                        (run.gadgetsPlayedCount || 0) > 0
                          ? "border-orange-400 bg-[#29150A]/90 text-orange-200"
                          : "border-slate-700/80 bg-black/65 text-slate-400"
                      }`}
                    >
                      <ArtworkImage
                        src={ARTWORK_ASSETS.cardArtGadgetTrap}
                        alt="机关"
                        className="w-5 h-5 rounded-xs object-cover"
                        tone="cold"
                      />
                      <span className="font-mono-num text-xs font-bold">
                        {run.gadgetTurretDmg || 0}/{run.gadgetsPlayedCount || 0}
                      </span>
                    </div>
                  </WastelandTooltip>
                </div>
              </div>

              {/* 右侧敌方编队：手绘意图图标 + 拖拽准星锁定高亮 + 受击斩击/爆炸动效 + 状态全悬浮提示 */}
              <div className="lg:col-span-7 flex flex-wrap items-end justify-end gap-4 sm:gap-6">
                {visibleArenaEnemies.map(({ enemy, isDying }) => {
                  const isTargeted = enemy.uid === activeTargetUid;
                  const isDragHovered =
                    isActivelyDragging &&
                    dragState?.targeted &&
                    dragState.hoveredEnemyUid === enemy.uid;

                  const effectiveIntentVal = Math.max(
                    1,
                    enemy.currentIntent.value - enemy.attackDebuff
                  );
                  const intentMeta = describeEnemyIntentDetail(
                    enemy.currentIntent.type,
                    effectiveIntentVal,
                    enemy.currentIntent.value
                  );
                  const intentIconUrl = resolveIntentIconUrl(
                    enemy.currentIntent.type
                  );
                  const cleanIntentLabel = enemy.currentIntent.label.replace(
                    /\s+\+?\d+$/,
                    ""
                  );

                  const persuadable =
                    !isDying &&
                    enemy.isHuman &&
                    !run.persuadeAttemptedThisCombat;
                  const lowHp = enemy.hp <= Math.ceil(enemy.maxHp * 0.55);
                  const persuadePct = persuadable
                    ? compute2d6SuccessChancePct(rpg, "ELO", lowHp ? 8 : 10)
                    : 0;

                  const vfx = enemyVfxMap[enemy.uid];
                  const recentlyHit = Boolean(
                    vfx && Date.now() - vfx.ts < 520
                  );

                  const spriteHeightClass =
                    enemy.templateId === "frost_claw_boss"
                      ? "h-[154px] sm:h-[178px]"
                      : enemy.templateId === "sentry_bot" ||
                        enemy.templateId === "syndicate_hitman" ||
                        enemy.templateId === "raider_ambusher"
                      ? "h-[136px] sm:h-[156px]"
                      : "h-[120px] sm:h-[140px]";

                  return (
                    <motion.div
                      key={enemy.uid}
                      data-enemy-uid={isDying ? undefined : enemy.uid}
                      animate={
                        isDying
                          ? {
                              opacity: [1, 0.85, 0],
                              x: [0, 16, 24],
                              y: [0, 6, 26],
                              scale: [1, 0.96, 0.84],
                            }
                          : recentlyHit
                          ? { x: [0, 16, -12, 8, 0] }
                          : enemyCounterWaveTs > 0 &&
                            Date.now() - enemyCounterWaveTs < 450 &&
                            enemy.currentIntent.type !== "GUARD_HEAL"
                          ? { x: [0, -48, 6, 0] }
                          : { x: 0, y: 0, opacity: 1, scale: 1 }
                      }
                      transition={{
                        duration: isDying ? 0.48 : 0.34,
                        ease: "easeOut",
                      }}
                      className={`relative flex flex-col items-center gap-1 rounded-xl px-1.5 py-1 transition-all ${
                        isDragHovered
                          ? "ring-2 ring-rose-400 bg-rose-500/15 scale-105 shadow-[0_0_26px_rgba(244,63,94,0.48)]"
                          : ""
                      }`}
                    >
                      {/* 敌人头顶伤害/破甲/辐射飘字 */}
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none flex flex-col items-center gap-1">
                        <AnimatePresence>
                          {floatingPopups
                            .filter((p) => p.target === enemy.uid)
                            .map((p) => (
                              <motion.span
                                key={p.id}
                                initial={{ opacity: 0, y: 14, scale: 0.8 }}
                                animate={{ opacity: 1, y: -16, scale: 1.08 }}
                                exit={{ opacity: 0, y: -32 }}
                                transition={{ duration: 0.68 }}
                                className={`px-2 py-0.5 rounded border font-mono-num text-xs font-extrabold whitespace-nowrap ${
                                  POPUP_TONE_CLASS[p.tone]
                                }`}
                              >
                                {p.text}
                              </motion.span>
                            ))}
                        </AnimatePresence>
                      </div>

                      {/* 人类残血口才劝降按钮（带详细成功率说明） */}
                      {persuadable && (
                        <WastelandTooltip
                          title={`口才劝降 · ${enemy.name}`}
                          subtitle={`成功率 ${persuadePct}%`}
                          description="每场战斗限尝试 1 次，不消耗行动能量！对人类匪徒或买凶杀手投掷 2d6 + 口才(ELO)，成功可令其直接弃械撤退并留下瓶盖。"
                          details={[
                            {
                              label: "检定难度",
                              value: lowHp
                                ? "DC 8（敌方已残血，极易动摇！）"
                                : "DC 10（敌方血量尚高，压低至55%更稳）",
                              tone: lowHp ? "emerald" : "amber",
                            },
                            {
                              label: "你的口才加成",
                              value: `+${rpg.attributes.ELO}`,
                              tone: "emerald",
                            },
                          ]}
                        >
                          <button
                            type="button"
                            onClick={() => onAttemptCombatPersuade(enemy.uid)}
                            className="mb-0.5 px-2 py-0.5 rounded border border-emerald-400 bg-emerald-950/90 hover:bg-emerald-900 text-emerald-200 font-mono-num text-[10px] font-bold whitespace-nowrap cursor-pointer shadow"
                          >
                            劝降 {persuadePct}%
                          </button>
                        </WastelandTooltip>
                      )}

                      {/* 敌方头顶手绘意图图标徽章（Requirement #3 & #4） */}
                      {!isDying && (
                        <WastelandTooltip
                          title={`${intentMeta.title} · ${cleanIntentLabel}`}
                          subtitle={
                            enemy.currentIntent.type === "GUARD_HEAL"
                              ? `+${enemy.currentIntent.value} 护甲`
                              : `${effectiveIntentVal} 点伤害`
                          }
                          description={intentMeta.summary}
                          details={[
                            {
                              label: "基础数值",
                              value: `${enemy.currentIntent.value}`,
                              tone: "slate",
                            },
                            ...(enemy.attackDebuff > 0
                              ? [
                                  {
                                    label: "攻击削弱修正",
                                    value: `-${enemy.attackDebuff} 点`,
                                    tone: "sky" as const,
                                  },
                                ]
                              : []),
                          ]}
                        >
                          <div
                            className={`px-2 py-0.5 rounded-md border flex items-center gap-1.5 font-mono-num text-xs font-extrabold whitespace-nowrap shadow-md cursor-help ${
                              enemy.currentIntent.type === "GUARD_HEAL"
                                ? "border-sky-400/80 bg-[#0C1E2E]/95 text-sky-200"
                                : enemy.currentIntent.type === "RAD_HOWL"
                                ? "border-lime-400/80 bg-[#14260D]/95 text-lime-200"
                                : enemy.currentIntent.type === "HEAVY_ATTACK"
                                ? "border-amber-400/90 bg-[#331014]/95 text-amber-200"
                                : "border-rose-400/85 bg-[#2B1016]/95 text-rose-200"
                            }`}
                          >
                            <CutoutSprite
                              src={intentIconUrl}
                              alt={cleanIntentLabel}
                              cropMode="all"
                              className="w-5 h-5 sm:w-6 sm:h-6 object-contain shrink-0"
                            />
                            <span className="text-[11px]">
                              {cleanIntentLabel}
                            </span>
                            <span className="text-xs font-black">
                              {enemy.currentIntent.type === "GUARD_HEAL"
                                ? `+${enemy.currentIntent.value}`
                                : `${effectiveIntentVal}`}
                            </span>
                          </div>
                        </WastelandTooltip>
                      )}

                      {/* 敌方全身精灵 + 刀光/爆炸/辐射受击特效层 */}
                      <WastelandTooltip
                        title={enemy.name}
                        subtitle={enemy.isHuman ? "人类武装单位" : "废土变异/机械体"}
                        description={
                          enemy.isHuman
                            ? "点击设为默认攻击目标，或直接将单攻手牌拖拽到此单位身上释放。残血时可用口才劝降。"
                            : "点击设为默认攻击目标，或直接将单攻手牌拖拽到此单位身上释放。"
                        }
                        details={[
                          {
                            label: "生命与护甲",
                            value: `HP ${enemy.hp}/${enemy.maxHp} · 护甲 ${enemy.block}`,
                            tone: "rose",
                          },
                          ...((enemy.markedTurns || 0) > 0
                            ? [
                                {
                                  label: "◎ 锁定标记",
                                  value: `受击伤害 +35%（剩余 ${enemy.markedTurns} 回合）`,
                                  tone: "amber" as const,
                                },
                              ]
                            : []),
                          ...((enemy.radStacks || 0) > 0
                            ? [
                                {
                                  label: "☢ 辐射腐蚀",
                                  value: `${enemy.radStacks} 层（回合末直伤并可引爆）`,
                                  tone: "lime" as const,
                                },
                              ]
                            : []),
                        ]}
                        disabled={Boolean(isActivelyDragging)}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (!isDying) setSelectedEnemyUid(enemy.uid);
                          }}
                          className="relative group flex flex-col items-center cursor-pointer focus:outline-none"
                        >
                          {/* 受击斩击光痕 / 重击爆裂 / 辐射腐蚀光环 */}
                          <AnimatePresence>
                            {vfx && Date.now() - vfx.ts < 480 && (
                              <motion.div
                                key={`hitfx_${vfx.ts}`}
                                initial={{ opacity: 1, scale: 0.55 }}
                                animate={{ opacity: 0, scale: 1.28 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.42, ease: "easeOut" }}
                                className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
                              >
                                {vfx.kind === "rad" ? (
                                  <div className="w-28 h-28 rounded-full border-4 border-lime-300 bg-lime-400/35 shadow-[0_0_28px_rgba(163,230,53,0.95)]" />
                                ) : vfx.kind === "blast" ? (
                                  <div className="relative w-32 h-32 flex items-center justify-center">
                                    <span className="absolute inset-2 rounded-full border-4 border-amber-200 bg-orange-500/45 shadow-[0_0_32px_rgba(249,115,22,0.95)]" />
                                    <span className="w-36 h-2 bg-gradient-to-r from-transparent via-amber-100 to-transparent -rotate-35 block" />
                                    <span className="absolute w-36 h-2 bg-gradient-to-r from-transparent via-rose-300 to-transparent rotate-35 block" />
                                  </div>
                                ) : (
                                  <div className="relative w-32 h-32 flex items-center justify-center">
                                    <span className="w-36 h-2.5 rounded-full bg-gradient-to-r from-transparent via-amber-200 to-transparent -rotate-[38deg] shadow-[0_0_18px_rgba(251,191,36,0.95)] block" />
                                    <span className="absolute w-28 h-1.5 rounded-full bg-gradient-to-r from-transparent via-rose-400 to-transparent -rotate-[22deg] translate-y-2 block" />
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <CutoutSprite
                            src={resolveEnemySpriteUrl(enemy.templateId)}
                            alt={enemy.name}
                            className={`w-auto ${spriteHeightClass} transition-transform duration-150 ${
                              recentlyHit
                                ? "brightness-150 contrast-125"
                                : isDragHovered
                                ? "scale-108 drop-shadow-[0_0_20px_rgba(244,63,94,0.9)]"
                                : isTargeted
                                ? "scale-105 drop-shadow-[0_0_16px_rgba(245,158,11,0.65)]"
                                : "opacity-92 group-hover:opacity-100 group-hover:scale-105 drop-shadow-[0_10px_18px_rgba(0,0,0,0.95)]"
                            }`}
                          />

                          {/* 脚下战术锁定靶环 */}
                          <span
                            className={`-mt-2 w-24 h-3 rounded-full border transition-all ${
                              isDragHovered
                                ? "border-rose-400 bg-rose-500/40 shadow-[0_0_18px_rgba(244,63,94,0.9)]"
                                : isTargeted
                                ? "border-amber-400 bg-amber-400/25 shadow-[0_0_14px_rgba(245,158,11,0.65)]"
                                : "border-slate-600/50 bg-black/50"
                            }`}
                          />
                        </button>
                      </WastelandTooltip>

                      {/* 敌方名牌、分段血甲槽与状态图标豆（每个状态均可悬停查看详细规则） */}
                      <div className="flex flex-col items-center gap-1 pt-0.5">
                        <span
                          className={`font-display text-xs font-bold ${
                            isDragHovered
                              ? "text-rose-300"
                              : isTargeted
                              ? "text-amber-300"
                              : "text-slate-200"
                          }`}
                        >
                          {enemy.name}
                        </span>

                        <SegmentedVitalBars
                          hp={enemy.hp}
                          maxHp={enemy.maxHp}
                          block={enemy.block}
                          compact
                          tone="enemy"
                          unitLabel={enemy.name}
                        />

                        {((enemy.markedTurns || 0) > 0 ||
                          (enemy.radStacks || 0) > 0 ||
                          enemy.attackDebuff > 0) && (
                          <div className="flex items-center gap-1 font-mono-num text-[10px]">
                            {(enemy.markedTurns || 0) > 0 && (
                              <WastelandTooltip
                                title="◎ 锁定标记"
                                subtitle={`剩余 ${enemy.markedTurns} 回合`}
                                description="枪火连击流核心易伤状态：处于锁定标记下的敌人受到所有攻击伤害提高 +35%！"
                              >
                                <span className="px-1.5 py-0.5 rounded bg-amber-950/90 border border-amber-400/70 text-amber-300 font-bold cursor-help">
                                  ◎{enemy.markedTurns}
                                </span>
                              </WastelandTooltip>
                            )}
                            {(enemy.radStacks || 0) > 0 && (
                              <WastelandTooltip
                                title="☢ 辐射腐蚀"
                                subtitle={`${enemy.radStacks} 层`}
                                description="辐射生化流持续腐蚀状态：每回合结束时无视敌方护甲造成等同于层数的真实伤害（随后层数减半），也可通过《盖革催化》翻倍或《脏弹超载引爆》瞬间结算群伤回血！"
                              >
                                <span className="px-1.5 py-0.5 rounded bg-lime-950/90 border border-lime-400/70 text-lime-300 font-bold cursor-help">
                                  ☢{enemy.radStacks}
                                </span>
                              </WastelandTooltip>
                            )}
                            {enemy.attackDebuff > 0 && (
                              <WastelandTooltip
                                title="攻击力削弱"
                                subtitle={`-${enemy.attackDebuff} 攻击`}
                                description="受闪光震慑或麻醉针影响，该敌人本场战斗攻击造成的伤害降低。"
                              >
                                <span className="px-1.5 py-0.5 rounded bg-sky-950/90 border border-sky-400/60 text-sky-200 font-bold cursor-help">
                                  -{enemy.attackDebuff}攻
                                </span>
                              </WastelandTooltip>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 下半部：图形化黄铜能量电池排 + 统一艺术金属牌框手牌区（支持拖拽瞄准与点击快出） */}
          <div className="rounded-xl border border-slate-800 bg-[#0E141C] p-3.5 space-y-3 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <WastelandTooltip
                  title="核子行动能量电池"
                  subtitle={`${run.energy} / ${run.maxEnergy}`}
                  description="打出卡牌需消耗左上角标明的能量点数；0 费衍生机关牌无需耗能。每回合开始自动充能回满。"
                >
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700/90 bg-[#080C11] cursor-help">
                    {Array.from({
                      length: Math.max(run.maxEnergy, run.energy),
                    }).map((_, idx) => {
                      const lit = idx < run.energy;
                      return (
                        <span
                          key={idx}
                          className={`w-4 h-6 rounded-xs border-2 flex items-center justify-center transition-all ${
                            lit
                              ? "border-amber-300 bg-gradient-to-t from-amber-600 via-amber-400 to-yellow-200 shadow-[0_0_10px_rgba(245,158,11,0.75)]"
                              : "border-slate-700 bg-[#121820] opacity-45"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-3 rounded-[1px] ${
                              lit ? "bg-white/80" : "bg-slate-800"
                            }`}
                          />
                        </span>
                      );
                    })}
                    <span className="ml-1.5 font-mono-num text-xs font-extrabold text-amber-300">
                      {run.energy}/{run.maxEnergy}
                    </span>
                  </div>
                </WastelandTooltip>

                <div className="hidden sm:flex items-center gap-2 font-mono-num text-[11px] text-slate-300">
                  <WastelandTooltip
                    title="抽牌堆"
                    subtitle={`${run.drawPile.length} 张`}
                    description="下回合及打出过牌卡时从抽牌堆抽取。抽牌堆耗尽时会自动将弃牌堆洗回。"
                  >
                    <span className="px-2 py-1 rounded border border-slate-800 bg-[#0A0F15] cursor-help">
                      抽牌 {run.drawPile.length}
                    </span>
                  </WastelandTooltip>

                  <WastelandTooltip
                    title="弃牌堆"
                    subtitle={`${run.discardPile.length} 张`}
                    description="已打出或回合结束弃置的非消耗卡牌暂存于此，抽牌堆空时重新洗入。"
                  >
                    <span className="px-2 py-1 rounded border border-slate-800 bg-[#0A0F15] cursor-help">
                      弃牌 {run.discardPile.length}
                    </span>
                  </WastelandTooltip>

                  {run.exhaustPile.length > 0 && (
                    <WastelandTooltip
                      title="消耗堆"
                      subtitle={`${run.exhaustPile.length} 张`}
                      description="带有「消耗」词条的强力卡牌或一次性飞盘陷阱打出后移入此处，本场战斗不再洗回。"
                    >
                      <span className="px-2 py-1 rounded border border-slate-800 bg-[#0A0F15] text-purple-300 cursor-help">
                        消耗 {run.exhaustPile.length}
                      </span>
                    </WastelandTooltip>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="hidden md:inline font-mono-num text-[11px] text-slate-400">
                  拖拽单攻牌指向目标敌人 · 亦可轻点快捷出牌
                </span>
                <WastelandTooltip
                  title="结束本回合"
                  description="结算同行伙伴自动援护技、敌方辐射腐蚀伤害，随后敌军按头顶意图图标依次行动。"
                >
                  <button
                    type="button"
                    onClick={triggerEndTurnWithVfx}
                    className="px-5 py-2 rounded-lg bg-[#E59A3C] hover:bg-[#F0A84B] text-[#140E08] font-bold text-xs whitespace-nowrap cursor-pointer transition-colors shadow"
                  >
                    结束回合
                  </button>
                </WastelandTooltip>
              </div>
            </div>

            {/* 统一辐射装饰艺术金属牌框手牌区 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
              {run.hand.map((cardInst) => {
                const st = resolveCardStats(cardInst.defId, cardInst.upgraded);
                const effCost = getEffectiveCardCost(cardInst, run);
                const playable = run.energy >= effCost;
                const arch = ARCHETYPE_META[st.archetype];
                const targeted = doesCardRequireEnemyTarget(st);

                const liveFooter =
                  st.damageFromBlockRatio > 0
                    ? `可砸 ${Math.round(
                        (run.playerBlock + st.block) * st.damageFromBlockRatio
                      )} 伤`
                    : st.hitsPerCombo
                    ? `连射 ${1 + (run.comboCount || 0)} 段`
                    : cardInst.isToken
                    ? "0费机关"
                    : targeted
                    ? "拖拽选敌"
                    : arch.badgeText;

                return (
                  <IllustratedGameCard
                    key={cardInst.uid}
                    stats={st}
                    upgraded={cardInst.upgraded}
                    effectiveCost={effCost}
                    disabled={!playable}
                    isDraggingSource={
                      Boolean(isActivelyDragging) &&
                      dragState?.cardUid === cardInst.uid
                    }
                    disableTooltip={Boolean(isActivelyDragging)}
                    onPointerDown={(ev) => {
                      if (!playable || ev.button !== 0) return;
                      ev.preventDefault();
                      const rect = ev.currentTarget.getBoundingClientRect();
                      setDragState({
                        cardUid: cardInst.uid,
                        stats: st,
                        upgraded: Boolean(cardInst.upgraded),
                        effectiveCost: effCost,
                        targeted,
                        startX: rect.left + rect.width * 0.5,
                        startY: rect.top + rect.height * 0.35,
                        curX: ev.clientX,
                        curY: ev.clientY,
                        hoveredEnemyUid: null,
                      });
                    }}
                    footerNote={liveFooter}
                    compact
                  />
                );
              })}
            </div>
          </div>

          {/* 杀戮尖塔式全局拖拽准星弧线 / 浮动卡牌特效（Portal 至顶层） */}
          {isActivelyDragging &&
            dragState &&
            typeof document !== "undefined" &&
            createPortal(
              <div className="fixed inset-0 z-[9990] pointer-events-none select-none">
                {dragState.targeted ? (
                  <>
                    {/* 二次贝塞尔战术导引光弧节点 */}
                    {bezierBeads.map((b, idx) => (
                      <span
                        key={idx}
                        style={{
                          left: b.x,
                          top: b.y,
                          transform: `translate(-50%, -50%) rotate(${b.deg}deg) scale(${
                            0.72 + b.t * 0.48
                          })`,
                        }}
                        className={`fixed w-3.5 h-1.5 rounded-full border ${
                          dragState.hoveredEnemyUid
                            ? "border-rose-200 bg-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.95)]"
                            : "border-amber-200 bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.85)]"
                        }`}
                      />
                    ))}

                    {/* 指针末端十字机械准星 */}
                    <div
                      style={{ left: dragState.curX, top: dragState.curY }}
                      className={`fixed -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border-2 flex items-center justify-center transition-transform ${
                        dragState.hoveredEnemyUid
                          ? "border-rose-400 bg-rose-500/20 scale-115 shadow-[0_0_22px_rgba(244,63,94,0.95)]"
                          : "border-amber-300 bg-amber-400/15 shadow-[0_0_16px_rgba(245,158,11,0.8)]"
                      }`}
                    >
                      <span className="w-6 h-0.5 bg-current block text-amber-200" />
                      <span className="absolute w-0.5 h-6 bg-current block text-amber-200" />
                      <span
                        className={`absolute -bottom-6 px-1.5 py-0.5 rounded font-mono-num text-[10px] font-extrabold whitespace-nowrap ${
                          dragState.hoveredEnemyUid
                            ? "bg-rose-500 text-white"
                            : "bg-black/85 text-amber-200 border border-amber-400/50"
                        }`}
                      >
                        {dragState.hoveredEnemyUid
                          ? `松手命中 · ${dragState.stats.name}`
                          : "拖至目标敌人"}
                      </span>
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      left: dragState.curX,
                      top: dragState.curY,
                      transform: `translate(-50%, -55%) rotate(${Math.max(
                        -12,
                        Math.min(12, (dragState.curX - dragState.startX) * 0.05)
                      )}deg)`,
                    }}
                    className={`fixed w-[156px] transition-shadow ${
                      isUntargetedReadyToCast
                        ? "drop-shadow-[0_0_28px_rgba(52,211,153,0.85)] scale-105"
                        : "drop-shadow-[0_18px_32px_rgba(0,0,0,0.9)]"
                    }`}
                  >
                    <IllustratedGameCard
                      stats={dragState.stats}
                      upgraded={dragState.upgraded}
                      effectiveCost={dragState.effectiveCost}
                      disableTooltip
                      compact
                    />
                  </div>
                )}
              </div>,
              document.body
            )}
        </div>
      )}

      {/* ==================== 军火箱撬锁 / 战后三选一插画卡牌构筑 ==================== */}
      {(run.nodeMode === "POST_COMBAT_REWARD" ||
        run.nodeMode === "CRATE_CARD_DRAFT") && (
        <div className="max-w-4xl mx-auto rounded-xl border border-slate-800 bg-[#0F161F] p-6 space-y-5 shadow-2xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-lg border border-amber-500/50 bg-[#090D12] overflow-hidden shrink-0">
                <CutoutSprite
                  src={ARTWORK_ASSETS.propWeaponCrate}
                  alt="战术军火箱"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <span className="font-mono-num text-xs text-emerald-400">
                  {run.nodeMode === "CRATE_CARD_DRAFT"
                    ? "军火箱开启"
                    : "战利品构筑"}
                </span>
                <h2 className="font-display text-2xl font-bold text-white">
                  挑选 1 张战术卡牌入库
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onDraftCardOption(null)}
              className="px-3.5 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 font-mono-num text-xs text-amber-300 whitespace-nowrap cursor-pointer"
            >
              拆解换 +6 瓶盖
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {(run.draftOptions || []).map((opt, idx) => {
              const st = resolveCardStats(opt.defId, opt.upgraded);
              return (
                <IllustratedGameCard
                  key={`${opt.defId}_${idx}`}
                  stats={st}
                  upgraded={opt.upgraded}
                  onClick={() => onDraftCardOption(idx)}
                  footerNote="点击收录进探险牌库 →"
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== 撤离返航物资盘点 ==================== */}
      {run.nodeMode === "RUN_COMPLETE" && (
        <div className="max-w-2xl mx-auto rounded-xl border border-slate-800 bg-[#0F161F] p-6 space-y-5 shadow-2xl">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-lg border border-emerald-500/50 bg-[#080C10] overflow-hidden shrink-0">
              <CutoutSprite
                src={ARTWORK_ASSETS.propExitBlastDoor}
                alt="撤离防爆门"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="font-mono-num text-xs text-emerald-400">
                安全返航 · LV.{rpg.level}
              </span>
              <h2 className="font-display text-2xl font-bold text-white">
                今夜废墟收获盘点
              </h2>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {run.summaryNote}
          </p>

          <div className="rounded-lg border border-slate-800 bg-[#090E14] p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 pb-3 font-mono-num text-xs">
              <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                <img
                  src={ARTWORK_ASSETS.propBrassCoaster}
                  alt="瓶盖"
                  className="w-5 h-5 rounded-full object-cover"
                />
                <span>+{run.capsLooted} 瓶盖</span>
              </div>
              <span className="text-slate-600">·</span>
              <span className="text-emerald-300 font-bold">
                +{run.xpEarnedThisRun || 0} XP
              </span>
              {(run.cardsCollectedThisRun || []).length > 0 && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="text-sky-300 truncate">
                    新卡：{run.cardsCollectedThisRun!.join("、")}
                  </span>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
              {INGREDIENT_LIST.map((ing) => {
                const count = run.lootBag[ing.id] || 0;
                return (
                  <WastelandTooltip
                    key={ing.id}
                    title={ing.name}
                    subtitle={`本趟 +${count}`}
                    description={ing.subtitle}
                    details={[
                      {
                        label: "返航后总库存",
                        value: `${(state.inventory[ing.id] || 0) + count} 份`,
                        tone: "emerald",
                      },
                    ]}
                  >
                    <div
                      className={`w-full p-2 rounded-lg border flex items-center gap-2.5 text-xs cursor-help ${
                        count > 0
                          ? "border-slate-700 bg-[#131C27]"
                          : "border-slate-800/60 bg-[#0B1017] opacity-55"
                      }`}
                    >
                      <div className="w-9 h-9 rounded border border-slate-700 overflow-hidden shrink-0">
                        <ArtworkImage
                          src={ing.imageUrl}
                          alt={ing.name}
                          className="w-full h-full object-cover"
                          tone="warm"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block text-slate-200 truncate">
                          {ing.name}
                        </span>
                        <span
                          className={`font-mono-num font-bold ${
                            count > 0 ? "text-emerald-400" : "text-slate-500"
                          }`}
                        >
                          +{count}
                        </span>
                      </div>
                    </div>
                  </WastelandTooltip>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={onFinishNightReturnDawn}
            className="w-full py-3 px-5 rounded-lg bg-[#E59A3C] hover:bg-[#F0A84B] text-[#140E08] font-bold text-sm cursor-pointer transition-colors"
          >
            {state.day >= state.maxDays
              ? "推开黎明酒馆大门 · 揭晓七日终局评价"
              : `返回酒馆迎接第 ${state.day + 1} 天黎明营业`}
          </button>
        </div>
      )}

      {/* ==================== 哔哔小子战地加点与专长习得浮层（带详细属性悬停介绍） ==================== */}
      {showRpgQuickModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl rounded-xl border border-emerald-500/50 bg-[#0B1511] p-5 space-y-4 text-emerald-100 shadow-2xl max-h-[86vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-emerald-500/25 pb-2.5">
              <div className="flex items-center gap-2.5">
                <img
                  src={ARTWORK_ASSETS.propPipboyBezel}
                  alt="Pip-Boy"
                  className="w-8 h-8 object-contain"
                />
                <div>
                  <span className="font-mono-num text-xs text-emerald-400">
                    PIP-BOY · LV.{rpg.level}（XP {rpg.xp}/{rpg.nextLevelXp}）
                  </span>
                  <h3 className="font-display text-lg font-bold text-white">
                    角色属性与专长（剩余属性点 {rpg.statPoints}）
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRpgQuickModal(false)}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 font-mono-num text-xs text-slate-200 cursor-pointer"
              >
                关闭
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(["STR", "AGI", "ELO", "CHA"] as RpgAttributeKey[]).map((k) => {
                const m = RPG_ATTRIBUTE_META[k];
                return (
                  <WastelandTooltip
                    key={k}
                    title={`${m.name} (${m.code})`}
                    subtitle={`当前 ${rpg.attributes[k]} 点`}
                    description={`白昼效用：${m.dayEffect}；黑夜效用：${m.nightEffect}`}
                    className="w-full block"
                  >
                    <div className="rounded-lg border border-emerald-500/30 bg-[#08110D] p-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-mono-num text-xs font-bold text-white">
                          {m.name} ({m.code}) · {rpg.attributes[k]}
                        </p>
                        <p className="text-[11px] text-emerald-200/80 mt-0.5">
                          {m.nightEffect}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={rpg.statPoints <= 0}
                        onClick={() => onAllocateStat(k)}
                        className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 text-slate-950 font-mono-num text-xs font-bold shrink-0 cursor-pointer"
                      >
                        +1
                      </button>
                    </div>
                  </WastelandTooltip>
                );
              })}
            </div>

            {rpg.pendingPerkChoices > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-amber-300">
                  可选新专长（{rpg.pendingPerkChoices}）：
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PERK_LIBRARY.filter(
                    (p) => !rpg.unlockedPerks.includes(p.id)
                  ).map((perk) => (
                    <div
                      key={perk.id}
                      className="rounded-lg border border-amber-400/40 bg-[#1A160B] p-2.5 flex items-start justify-between gap-2"
                    >
                      <div className="text-xs">
                        <strong className="text-amber-200">
                          《{perk.name}》
                        </strong>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          {perk.description}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSelectPerk(perk.id)}
                        className="px-2 py-1 rounded bg-amber-400 text-slate-950 text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        习得
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
