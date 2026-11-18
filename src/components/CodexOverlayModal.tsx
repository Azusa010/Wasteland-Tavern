import React, { useEffect } from "react";
import { X } from "lucide-react";
import { SecondaryTabsView } from "./SecondaryTabsView";
import { CampaignSaveState, RpgAttributeKey, WorkspaceTab } from "../types/game";

interface CodexOverlayModalProps {
  activeTab: Exclude<WorkspaceTab, "STAGE"> | null;
  state: CampaignSaveState;
  providerInfo: { provider: string; modelName: string } | null;
  onAllocateStat?: (attr: RpgAttributeKey) => void;
  onSelectPerk?: (perkId: string) => void;
  onUpgradeCard?: (cardUid: string) => void;
  onClose: () => void;
}

export const CodexOverlayModal: React.FC<CodexOverlayModalProps> = ({
  activeTab,
  state,
  providerInfo,
  onAllocateStat,
  onSelectPerk,
  onUpgradeCard,
  onClose,
}) => {
  useEffect(() => {
    if (!activeTab) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTab, onClose]);

  if (!activeTab) return null;

  // 「常客手记」与「废土档案」直接以无框摊开旧皮面双页手记本实物呈现，不套现代网页深色弹窗壳
  if (activeTab === "PATRONS" || activeTab === "LORE") {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/82 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label={
          activeTab === "LORE" ? "零号街区废土档案风物志" : "酒保旧皮面常客手记本"
        }
      >
        <SecondaryTabsView
          activeTab={activeTab}
          state={state}
          providerInfo={providerInfo}
          onAllocateStat={onAllocateStat}
          onSelectPerk={onSelectPerk}
          onUpgradeCard={onUpgradeCard}
          onClose={onClose}
        />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/82 backdrop-blur-xs flex items-center justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-6xl max-h-[88vh] flex flex-col rounded-xl border border-[#E59A3C]/35 bg-[#1B1410] shadow-2xl overflow-hidden">
        <div className="px-6 py-3.5 border-b border-[#F5D096]/12 bg-[#140F0C] flex items-center justify-between shrink-0">
          <span className="font-mono-num text-xs text-[#E59A3C]">
            CODEX OVERLAY ·{" "}
            {activeTab === "DECK"
              ? "掌柜 RPG 档案与四流派牌库"
              : "AI 规则校验日志"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded bg-[#2A1F19] hover:bg-[#3A2B23] text-xs text-[#FAF0E6] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>返回场景 [ESC]</span>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <SecondaryTabsView
            activeTab={activeTab}
            state={state}
            providerInfo={providerInfo}
            onAllocateStat={onAllocateStat}
            onSelectPerk={onSelectPerk}
            onUpgradeCard={onUpgradeCard}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
};
