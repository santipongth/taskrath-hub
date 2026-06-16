// Client-side image utilities used to prep signature/stamp images before
// embedding them in PDF reports. All functions are pure (input -> data URL)
// and run in the browser via <canvas>.

export type ImageProcessOptions = {
  /** 0.5 – 3.0 (scale relative to source). Higher = crisper when zoomed. */
  scale?: number;
  /** 0 – 1. Strength of an unsharp-mask-style sharpen kernel. */
  sharpness?: number;
  /** Trim near-white / transparent borders around the subject. */
  autoTrim?: boolean;
  /** 0-255 luminance threshold for autoTrim (default 240). */
  trimThreshold?: number;
};

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = dataUrl;
  });
}

function trimBounds(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  threshold: number,
): { x: number; y: number; w: number; h: number } {
  let top = h, bottom = -1, left = w, right = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const isBg = a < 16 || lum >= threshold;
      if (!isBg) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  if (bottom < 0) return { x: 0, y: 0, w, h };
  const pad = 2;
  const nx = Math.max(0, left - pad);
  const ny = Math.max(0, top - pad);
  const nw = Math.min(w - nx, right - left + 1 + pad * 2);
  const nh = Math.min(h - ny, bottom - top + 1 + pad * 2);
  return { x: nx, y: ny, w: nw, h: nh };
}

/** Simple separable unsharp mask using a 3x3 kernel weighted by `amount`. */
function applySharpen(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  if (amount <= 0) return;
  const src = ctx.getImageData(0, 0, w, h);
  const dst = ctx.createImageData(w, h);
  const a = Math.min(1, Math.max(0, amount));
  const center = 1 + 4 * a;
  const side = -a;
  const s = src.data, d = dst.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const up = y > 0 ? s[i - w * 4 + c] : s[i + c];
        const dn = y < h - 1 ? s[i + w * 4 + c] : s[i + c];
        const lf = x > 0 ? s[i - 4 + c] : s[i + c];
        const rt = x < w - 1 ? s[i + 4 + c] : s[i + c];
        const v = center * s[i + c] + side * (up + dn + lf + rt);
        d[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
      d[i + 3] = s[i + 3];
    }
  }
  ctx.putImageData(dst, 0, 0);
}

export async function processImageForPdf(
  dataUrl: string,
  opts: ImageProcessOptions = {},
): Promise<string> {
  const { scale = 1, sharpness = 0, autoTrim = false, trimThreshold = 240 } = opts;
  const img = await loadImage(dataUrl);

  // 1) draw at source size, optionally trim
  const off = document.createElement("canvas");
  off.width = img.naturalWidth || img.width;
  off.height = img.naturalHeight || img.height;
  const octx = off.getContext("2d");
  if (!octx) return dataUrl;
  octx.drawImage(img, 0, 0);

  let srcX = 0, srcY = 0, srcW = off.width, srcH = off.height;
  if (autoTrim) {
    try {
      const px = octx.getImageData(0, 0, off.width, off.height);
      const b = trimBounds(px.data, off.width, off.height, trimThreshold);
      srcX = b.x; srcY = b.y; srcW = b.w; srcH = b.h;
    } catch { /* tainted canvas — skip */ }
  }

  // 2) rescale and sharpen onto output canvas
  const s = Math.max(0.25, Math.min(4, scale));
  const out = document.createElement("canvas");
  out.width = Math.max(8, Math.round(srcW * s));
  out.height = Math.max(8, Math.round(srcH * s));
  const ctx = out.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(off, srcX, srcY, srcW, srcH, 0, 0, out.width, out.height);
  if (sharpness > 0) applySharpen(ctx, out.width, out.height, sharpness);

  return out.toDataURL("image/png");
}
