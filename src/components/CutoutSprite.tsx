import React, { useEffect, useState } from "react";

interface CutoutSpriteProps {
  src: string;
  alt: string;
  className?: string;
  flipHorizontal?: boolean;
  dimmed?: boolean;
  cropMode?: "bottom" | "all" | "none";
}

const cutoutCache = new Map<string, string>();
const inflightMap = new Map<string, Promise<string>>();

function processSpriteCutout(
  src: string,
  cropMode: "bottom" | "all" | "none"
): Promise<string> {
  if (src.endsWith(".png")) {
    return Promise.resolve(src);
  }
  const cacheKey = `${src}__${cropMode}`;
  const cached = cutoutCache.get(cacheKey);
  if (cached) {
    return Promise.resolve(cached);
  }
  const existing = inflightMap.get(cacheKey);
  if (existing) {
    return existing;
  }

  const job = new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const maxSide = cropMode === "all" ? 480 : 400;
        const scale = Math.min(
          1,
          maxSide / Math.max(1, img.naturalWidth, img.naturalHeight)
        );
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(src);
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        const cornerCoords = [
          [0, 0],
          [w - 1, 0],
          [0, h - 1],
          [w - 1, h - 1],
        ];
        let bgR = 0;
        let bgG = 0;
        let bgB = 0;
        let bgA = 0;
        for (const [cx, cy] of cornerCoords) {
          const ci = (cy * w + cx) * 4;
          bgR += data[ci];
          bgG += data[ci + 1];
          bgB += data[ci + 2];
          bgA += data[ci + 3];
        }
        bgR /= 4;
        bgG /= 4;
        bgB /= 4;
        bgA /= 4;

        const total = w * h;

        // 若上传图片本身已带透明通道（四角平均 alpha < 36），直接保留原有透明抠图并仅做边缘裁切
        if (bgA < 36) {
          let minX = w;
          let maxX = 0;
          let minY = h;
          let maxY = 0;
          for (let idx = 0; idx < total; idx++) {
            const p = idx * 4;
            if (data[p + 3] > 24) {
              const cx = idx % w;
              const cy = (idx - cx) / w;
              if (cx < minX) minX = cx;
              if (cx > maxX) maxX = cx;
              if (cy < minY) minY = cy;
              if (cy > maxY) maxY = cy;
            }
          }
          if (cropMode !== "none" && maxX > minX + 8 && maxY > minY + 8) {
            const padX = cropMode === "all" ? 1 : Math.min(3, minX, w - 1 - maxX);
            const padTop = cropMode === "all" ? 1 : Math.min(3, minY);
            const padBottom = cropMode === "all" ? 1 : 0;
            const sx = Math.max(0, minX - padX);
            const sy = Math.max(0, minY - padTop);
            const sw = Math.min(w - sx, maxX - minX + 1 + padX * 2);
            const sh = Math.min(h - sy, maxY - sy + 1 + padBottom);
            const outCanvas = document.createElement("canvas");
            outCanvas.width = sw;
            outCanvas.height = sh;
            const outCtx = outCanvas.getContext("2d");
            if (outCtx) {
              outCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
              const url = outCanvas.toDataURL("image/png");
              cutoutCache.set(cacheKey, url);
              resolve(url);
              return;
            }
          }
          const rawPng = canvas.toDataURL("image/png");
          cutoutCache.set(cacheKey, rawPng);
          resolve(rawPng);
          return;
        }

        // 检查四角颜色一致性（判断是否为本地上传的任意纯色底，如白底、灰底、绿幕、纯色底）
        let maxCornerSpreadSq = 0;
        for (const [cx, cy] of cornerCoords) {
          const ci = (cy * w + cx) * 4;
          const dr = data[ci] - bgR;
          const dg = data[ci + 1] - bgG;
          const db = data[ci + 2] - bgB;
          maxCornerSpreadSq = Math.max(
            maxCornerSpreadSq,
            dr * dr + dg * dg + db * db
          );
        }
        const isCustomDataImage = src.startsWith("data:");
        const isUniformSolidBg = maxCornerSpreadSq <= 28 * 28;

        const bgLum = bgR * 0.299 + bgG * 0.587 + bgB * 0.114;
        const isLightBg = bgLum >= 175;

        const visited = new Uint8Array(total);
        const exteriorBg = new Uint8Array(total);
        const queue = new Int32Array(total);
        let head = 0;
        let tail = 0;

        // Light backdrop (#FFFFFF / cream): black ink outline (0,0,0) acts as an impenetrable wall.
        // Custom uniform solid backdrop (chroma green / blue / gray): flood-fill matching solid color.
        // Dark studio backdrop (#0A0E14): strict threshold (<=14) so pure black ink outline (0,0,0) is NEVER breached!
        const maxDistSq = isLightBg
          ? 54 * 54
          : isCustomDataImage && isUniformSolidBg && bgLum > 24
          ? 42 * 42
          : 14 * 14;

        const trySeed = (idx: number) => {
          if (visited[idx]) return;
          visited[idx] = 1;
          const p = idx * 4;
          const r = data[p];
          const g = data[p + 1];
          const b = data[p + 2];
          const dr = r - bgR;
          const dg = g - bgG;
          const db = b - bgB;
          const distSq = dr * dr + dg * dg + db * db;
          const lum = r * 0.299 + g * 0.587 + b * 0.114;

          if (isLightBg) {
            if (distSq <= maxDistSq && lum >= 195) {
              exteriorBg[idx] = 1;
              queue[tail++] = idx;
            }
          } else if (isCustomDataImage && isUniformSolidBg && bgLum > 24) {
            if (distSq <= maxDistSq && lum >= 18) {
              exteriorBg[idx] = 1;
              queue[tail++] = idx;
            }
          } else {
            if (distSq <= maxDistSq && lum >= 4 && lum <= 36) {
              exteriorBg[idx] = 1;
              queue[tail++] = idx;
            }
          }
        };

        for (let x = 0; x < w; x++) {
          trySeed(x);
          trySeed((h - 1) * w + x);
        }
        for (let y = 1; y < h - 1; y++) {
          trySeed(y * w);
          trySeed(y * w + (w - 1));
        }

        while (head < tail) {
          const cur = queue[head++];
          const cx = cur % w;
          const cy = (cur - cx) / w;

          if (cx > 0) trySeed(cur - 1);
          if (cx < w - 1) trySeed(cur + 1);
          if (cy > 0) trySeed(cur - w);
          if (cy < h - 1) trySeed(cur + w);
        }

        let minX = w;
        let maxX = 0;
        let minY = h;
        let maxY = 0;

        for (let idx = 0; idx < total; idx++) {
          const p = idx * 4;
          if (exteriorBg[idx]) {
            data[p + 3] = 0;
            continue;
          }
          const cx = idx % w;
          const cy = (idx - cx) / w;
          const touchesBg =
            (cx > 0 && exteriorBg[idx - 1]) ||
            (cx < w - 1 && exteriorBg[idx + 1]) ||
            (cy > 0 && exteriorBg[idx - w]) ||
            (cy < h - 1 && exteriorBg[idx + w]);

          if (touchesBg) {
            const dr = data[p] - bgR;
            const dg = data[p + 1] - bgG;
            const db = data[p + 2] - bgB;
            const dist = Math.sqrt(dr * dr + dg * dg + db * db);
            if (isLightBg && dist < 80) {
              // De-fringe any white anti-aliased edge pixels touching the exterior
              const alphaRatio = Math.max(0.15, Math.min(1, (dist - 35) / 45));
              data[p + 3] = Math.round(alphaRatio * 255);
              // Darken white halo toward ink edge
              data[p] = Math.round(data[p] * alphaRatio);
              data[p + 1] = Math.round(data[p + 1] * alphaRatio);
              data[p + 2] = Math.round(data[p + 2] * alphaRatio);
            } else if (!isLightBg && dist < 24) {
              data[p + 3] = Math.round(
                Math.max(45, Math.min(255, ((dist - 10) / 14) * 255))
              );
            }
          }

          if (data[p + 3] > 24) {
            if (cx < minX) minX = cx;
            if (cx > maxX) maxX = cx;
            if (cy < minY) minY = cy;
            if (cy > maxY) maxY = cy;
          }
        }

        ctx.putImageData(imageData, 0, 0);

        if (cropMode !== "none" && maxX > minX + 8 && maxY > minY + 8) {
          const padX = cropMode === "all" ? 1 : Math.min(3, minX, w - 1 - maxX);
          const padTop = cropMode === "all" ? 1 : Math.min(3, minY);
          const padBottom = cropMode === "all" ? 1 : 0;
          const sx = Math.max(0, minX - padX);
          const sy = Math.max(0, minY - padTop);
          const sw = Math.min(w - sx, maxX - minX + 1 + padX * 2);
          const sh = Math.min(h - sy, maxY - sy + 1 + padBottom);

          const outCanvas = document.createElement("canvas");
          outCanvas.width = sw;
          outCanvas.height = sh;
          const outCtx = outCanvas.getContext("2d");
          if (outCtx) {
            outCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
            const url = outCanvas.toDataURL("image/png");
            cutoutCache.set(cacheKey, url);
            resolve(url);
            return;
          }
        }

        const fallbackUrl = canvas.toDataURL("image/png");
        cutoutCache.set(cacheKey, fallbackUrl);
        resolve(fallbackUrl);
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  }).finally(() => {
    inflightMap.delete(cacheKey);
  });

  inflightMap.set(cacheKey, job);
  return job;
}

export const CutoutSprite: React.FC<CutoutSpriteProps> = ({
  src,
  alt,
  className = "",
  flipHorizontal = false,
  dimmed = false,
  cropMode = "bottom",
}) => {
  const cacheKey = `${src}__${cropMode}`;
  const [resolvedUrl, setResolvedUrl] = useState<string>(() => {
    if (src.endsWith(".png")) return src;
    return cutoutCache.get(cacheKey) || src;
  });

  useEffect(() => {
    let active = true;
    processSpriteCutout(src, cropMode).then((url) => {
      if (active) {
        setResolvedUrl(url);
      }
    });
    return () => {
      active = false;
    };
  }, [src, cropMode]);

  return (
    <img
      src={resolvedUrl}
      alt={alt}
      draggable={false}
      referrerPolicy="no-referrer"
      className={`select-none ${
        cropMode === "all" ? "object-fill" : "object-contain object-bottom"
      } transition-opacity duration-150 ${
        flipHorizontal ? "-scale-x-100" : ""
      } ${dimmed ? "opacity-45 saturate-50" : ""} ${className}`}
    />
  );
};
