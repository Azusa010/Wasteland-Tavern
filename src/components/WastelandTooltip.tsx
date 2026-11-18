import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface TooltipDetailRow {
  label: string;
  value: string;
  tone?: "amber" | "emerald" | "rose" | "sky" | "lime" | "orange" | "purple" | "slate";
}

interface WastelandTooltipProps {
  title: string;
  subtitle?: string;
  description?: string;
  details?: TooltipDetailRow[];
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

const TONE_TEXT_CLASS: Record<NonNullable<TooltipDetailRow["tone"]>, string> = {
  amber: "text-amber-300",
  emerald: "text-emerald-300",
  rose: "text-rose-300",
  sky: "text-sky-300",
  lime: "text-lime-300",
  orange: "text-orange-300",
  purple: "text-purple-300",
  slate: "text-slate-200",
};

export const WastelandTooltip: React.FC<WastelandTooltipProps> = ({
  title,
  subtitle,
  description,
  details,
  disabled = false,
  className = "inline-flex",
  children,
}) => {
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (disabled && coords) {
      setCoords(null);
    }
  }, [disabled, coords]);

  const handleEnter = (e: React.MouseEvent) => {
    if (disabled) return;
    setCoords({ x: e.clientX, y: e.clientY });
  };

  const handleMove = (e: React.MouseEvent) => {
    if (disabled) return;
    setCoords({ x: e.clientX, y: e.clientY });
  };

  const handleLeave = () => {
    setCoords(null);
  };

  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  let left = 0;
  let top = 0;
  if (coords) {
    const panelW = 290;
    const panelH = 190;
    left =
      coords.x + 18 + panelW > vw
        ? Math.max(12, coords.x - panelW - 14)
        : coords.x + 16;
    top =
      coords.y + 18 + panelH > vh
        ? Math.max(12, coords.y - panelH - 12)
        : coords.y + 16;
  }

  return (
    <div
      onMouseEnter={handleEnter}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={className}
    >
      {children}
      {coords &&
        !disabled &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{ left, top }}
            className="fixed z-[9999] w-[276px] sm:w-[296px] rounded-lg border-2 border-amber-500/65 bg-[#0A0F15]/96 p-3 shadow-[0_16px_38px_rgba(0,0,0,0.92)] pointer-events-none backdrop-blur-xs space-y-2 text-left"
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-1.5">
              <strong className="font-display text-sm font-bold text-amber-200 leading-snug">
                {title}
              </strong>
              {subtitle && (
                <span className="font-mono-num text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-400/35 text-amber-300 whitespace-nowrap shrink-0">
                  {subtitle}
                </span>
              )}
            </div>

            {description && (
              <p className="text-xs text-slate-200/95 leading-relaxed">
                {description}
              </p>
            )}

            {details && details.length > 0 && (
              <div className="pt-1 border-t border-slate-800/80 space-y-1">
                {details.map((row, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-2 text-[11px]"
                  >
                    <span className="text-slate-400 shrink-0">{row.label}</span>
                    <span
                      className={`font-mono-num font-semibold text-right ${
                        TONE_TEXT_CLASS[row.tone || "slate"]
                      }`}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
