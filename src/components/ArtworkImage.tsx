import React, { useState } from "react";
import { Flame } from "lucide-react";

interface ArtworkImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
  tone?: "warm" | "cold";
}

const COMIC_BORDER_TRIM_PATTERNS = [
  "ing_rad_water_",
  "ing_mutant_potato_",
  "ing_rust_malt_",
  "ing_glow_shroom_",
  "ing_calm_herb_",
  "drink_ash_warm_brew_",
];

export const ArtworkImage: React.FC<ArtworkImageProps> = ({
  src,
  alt,
  className = "",
  fallbackTitle,
  tone = "warm",
}) => {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center text-center p-6 ${
          tone === "warm"
            ? "bg-gradient-to-br from-[#2B2019] via-[#1F1713] to-[#140F0C] text-[#E6D5C3]"
            : "bg-gradient-to-br from-[#1F2933] via-[#151C24] to-[#0E1318] text-slate-300"
        } ${className}`}
        role="img"
        aria-label={alt}
      >
        <Flame className="w-7 h-7 text-[#E59A3C] mb-2 opacity-80" />
        <span className="font-display text-sm font-semibold">
          {fallbackTitle || alt}
        </span>
      </div>
    );
  }

  const needsBorderTrim = COMIC_BORDER_TRIM_PATTERNS.some((key) =>
    src.includes(key)
  );

  if (needsBorderTrim) {
    return (
      <span className={`block overflow-hidden ${className}`}>
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover scale-[1.11] block"
        />
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
