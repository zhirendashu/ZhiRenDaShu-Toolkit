// DigiCamFX — Image Processing Engine
// Canvas 2D pixel-level CCD physics simulation

class DigiCamProcessor {
  /**
   * Main process function
   * @param {ImageData} srcImageData - Source pixels
   * @param {Object} filterParams   - Camera preset parameters
   * @param {Object} userParams     - { intensity, grain, chroma, vignette, bloom, lightleak, imperfections } 0-100
   * @param {Object} stampParams    - { enabled: bool, date: string, mode: string }
   * @param {Object} effectParams   - { filmBorder, flashFlare, seed, lut, lutStrength }
   * @returns {HTMLCanvasElement}   - Fully processed canvas
   */
  static process(srcImageData, filterParams, userParams, stampParams, effectParams = {}) {
    const w = srcImageData.width;
    const h = srcImageData.height;
    let src = srcImageData.data;
    const seed = effectParams.seed || 42;

    // ── PASS 0: Film LUT (applied before CCD grade) ──────────────
    // Apply to a copy so we don't mutate the original
    let workData;
    if (effectParams.lut) {
      const copy = new ImageData(
        new Uint8ClampedArray(srcImageData.data),
        w, h
      );
      lutEngine.apply(copy, effectParams.lut, effectParams.lutStrength ?? 1.0);
      workData = copy.data;
    } else {
      workData = src;
    }

    // Normalize user params to multipliers
    const intensity      = userParams.intensity / 100;
    const grainMult      = (userParams.grain         / 50);
    const chromaMult     = (userParams.chroma        / 50);
    const vigMult        = (userParams.vignette      / 50);
    const bloomMult      = (userParams.bloom         / 50);
    const lightLeakMult  = ((userParams.lightleak      ?? 50) / 50);
    const imperfectMult  = ((userParams.imperfections  ?? 30) / 50);

    // Effective filter parameters scaled by intensity
    const brightness = filterParams.brightness * intensity;
    const contrast   = 1 + (filterParams.contrast - 1) * intensity;
    const saturation = 1 + (filterParams.saturation - 1) * intensity;
    const warmth     = filterParams.warmth * intensity;
    const tint       = (filterParams.tint || 0) * intensity;
    const noise      = filterParams.baseNoise * grainMult * intensity;
    const shadowR    = filterParams.shadowTint.r * intensity;
    const shadowG    = filterParams.shadowTint.g * intensity;
    const shadowB    = filterParams.shadowTint.b * intensity;
    const hiliteR    = filterParams.highlightTint.r * intensity;
    const hiliteG    = filterParams.highlightTint.g * intensity;
    const hiliteB    = filterParams.highlightTint.b * intensity;

    // ── PASS 1: Per-pixel colour grade ──────────────────────────
    const graded = new Uint8ClampedArray(workData.length);

    for (let i = 0; i < workData.length; i += 4) {
      let r = workData[i];
      let g = workData[i + 1];
      let b = workData[i + 2];

      // Brightness
      r += brightness;
      g += brightness;
      b += brightness;

      // Contrast (around grey 128)
      r = (r - 128) * contrast + 128;
      g = (g - 128) * contrast + 128;
      b = (b - 128) * contrast + 128;

      // Colour temperature / warmth
      r += warmth;
      b -= warmth * 0.55;
      g += warmth * 0.08;

      // Tint (green channel shift)
      g += tint;

      // Luminance-based split toning
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      // Shadows (lum 0→0.3)
      const shadowW = Math.max(0, 1 - lum / 0.32);
      r += shadowR * shadowW;
      g += shadowG * shadowW;
      b += shadowB * shadowW;

      // Highlights (lum 0.68→1.0)
      const hiliteW = Math.max(0, (lum - 0.66) / 0.34);
      r += hiliteR * hiliteW;
      g += hiliteG * hiliteW;
      b += hiliteB * hiliteW;

      // Saturation (grey anchor)
      if (saturation !== 1) {
        const grey = 0.299 * r + 0.587 * g + 0.114 * b;
        r = grey + (r - grey) * saturation;
        g = grey + (g - grey) * saturation;
        b = grey + (b - grey) * saturation;
      }

      // Luminance noise (per-pixel seeded random)
      if (noise > 0) {
        const n = (Math.random() * 2 - 1) * noise * 2.2;
        r += n;
        g += n * 0.88;
        b += n * 1.14;
      }

      graded[i]     = Math.max(0, Math.min(255, r));
      graded[i + 1] = Math.max(0, Math.min(255, g));
      graded[i + 2] = Math.max(0, Math.min(255, b));
      graded[i + 3] = src[i + 3];
    }

    // ── PASS 2: Chromatic aberration ────────────────────────────
    const chromaAmt = Math.round(
      filterParams.baseChromaticAberration * chromaMult * intensity * 1.6
    );
    const finalPixels = chromaAmt > 0
      ? DigiCamProcessor._chromaAberration(graded, w, h, chromaAmt)
      : graded;

    // ── Build working canvas ─────────────────────────────────────
    const canvas = document.createElement('canvas');
    canvas.width  = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(new ImageData(finalPixels, w, h), 0, 0);

    // ── PASS 3: Bloom ────────────────────────────────────────────
    const bloomStrength = filterParams.baseBloom * bloomMult * intensity;
    if (bloomStrength > 0.04) {
      DigiCamProcessor._bloom(ctx, w, h, bloomStrength, filterParams.bloomThreshold);
    }

    // ── PASS 3.5: Light Leaks ────────────────────────────────────
    const leakStr = (filterParams.baseLightLeak || 0) * lightLeakMult * intensity;
    if (leakStr > 0.015) {
      DigiCamProcessor._lightLeak(ctx, w, h, leakStr, seed);
    }

    // ── PASS 4: Vignette ─────────────────────────────────────────
    const vigStrength = filterParams.baseVignette * vigMult * intensity;
    if (vigStrength > 0.04) {
      DigiCamProcessor._vignette(ctx, w, h, vigStrength);
    }

    // ── PASS 4.5: Film Imperfections (scratches + dust) ──────────
    const impStr = (filterParams.baseImperfections || 0) * imperfectMult * intensity;
    if (impStr > 0.01) {
      DigiCamProcessor._filmImperfections(ctx, w, h, impStr, seed);
    }

    // ── PASS 5: Timestamp ─────────────────────────────────────────
    if (stampParams && stampParams.enabled && stampParams.date) {
      DigiCamProcessor._timestamp(ctx, w, h, stampParams.date, stampParams.mode || 'classic');
    }

    // ── PASS 5.5: Flash Flare (Huji-style) ───────────────────────
    const flareEnabled = effectParams.flashFlare === true;
    const flareStr = flareEnabled
      ? Math.max(0.35, (filterParams.baseFlashFlare || 0)) * intensity
      : 0;
    if (flareStr > 0.02) {
      DigiCamProcessor._flashFlare(ctx, w, h, flareStr, filterParams.flashFlarePos || 'topright');
    }

    // ── VHS 隔行扫描线（仅 VHS 录像带预设）──────────────────────
    if (filterParams.interlace) {
      for (let iy = 0; iy < h; iy += 2) {
        ctx.fillStyle = 'rgba(0,0,0,0.20)';
        ctx.fillRect(0, iy, w, 1);
      }
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.04;
      ctx.fillStyle = '#002200';
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // ── PASS 6: Film Border (last — frames everything) ────────────
    const borderType = effectParams.filmBorder || 'none';
    if (borderType !== 'none') {
      DigiCamProcessor._filmBorder(ctx, w, h, borderType);
    }

    return canvas;
  }

  // ── Chromatic aberration: shift R right, B left ──────────────
  static _chromaAberration(src, w, h, amt) {
    const out = new Uint8ClampedArray(src.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const ri = (y * w + Math.min(w - 1, x + amt)) * 4;
        const bi = (y * w + Math.max(0, x - amt)) * 4;
        out[i]     = src[ri];       // R from right
        out[i + 1] = src[i + 1];   // G centre
        out[i + 2] = src[bi + 2];  // B from left
        out[i + 3] = src[i + 3];
      }
    }
    return out;
  }

  // ── Highlight bloom ──────────────────────────────────────────
  static _bloom(ctx, w, h, strength, threshold) {
    const imgData = ctx.getImageData(0, 0, w, h);
    const px = imgData.data;

    // Extract bright areas only
    const bloomCanvas = document.createElement('canvas');
    bloomCanvas.width  = w;
    bloomCanvas.height = h;
    const bCtx = bloomCanvas.getContext('2d');
    const bData = bCtx.createImageData(w, h);

    for (let i = 0; i < px.length; i += 4) {
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      if (lum > threshold) {
        const f = Math.min(1, ((lum - threshold) / (255 - threshold)) * 1.6);
        bData.data[i]     = px[i] * f;
        bData.data[i + 1] = px[i + 1] * f;
        bData.data[i + 2] = px[i + 2] * f;
        bData.data[i + 3] = 255;
      }
    }
    bCtx.putImageData(bData, 0, 0);

    // Blur the bloom layer (GPU-accelerated via browser)
    const blurAmt = Math.max(5, Math.round(w * 0.013));
    const blurCanvas = document.createElement('canvas');
    blurCanvas.width  = w;
    blurCanvas.height = h;
    const blurCtx = blurCanvas.getContext('2d');
    blurCtx.filter = `blur(${blurAmt}px)`;
    blurCtx.drawImage(bloomCanvas, 0, 0);
    blurCtx.filter = 'none';

    // Screen-blend onto main canvas
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = Math.min(0.95, strength * 1.3);
    ctx.drawImage(blurCanvas, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // ── Radial vignette ───────────────────────────────────────────
  static _vignette(ctx, w, h, strength) {
    const cx = w / 2;
    const cy = h / 2;
    const inner = Math.min(w, h) * 0.33;
    const outer = Math.max(w, h) * 0.82;
    const g = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${Math.min(0.92, strength * 0.88)})`);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  // ── Timestamp dispatcher ──────────────────────────────────────
  static _timestamp(ctx, w, h, dateStr, mode) {
    switch (mode) {
      case 'lcd':        return DigiCamProcessor._timestampLCD(ctx, w, h, dateStr);
      case 'dotmatrix':  return DigiCamProcessor._timestampDotMatrix(ctx, w, h, dateStr);
      case 'eightbit':   return DigiCamProcessor._timestampEightBit(ctx, w, h, dateStr);
      case 'white':      return DigiCamProcessor._timestampWhite(ctx, w, h, dateStr);
      default:           return DigiCamProcessor._timestampClassic(ctx, w, h, dateStr);
    }
  }

  // ── ① 经典橙色（原版相机样式）────────────────────────────────
  static _timestampClassic(ctx, w, h, dateStr) {
    const scale = Math.min(1, w / 800);
    const fSize = Math.max(14, Math.round(30 * scale));
    const pad   = Math.max(12, Math.round(22 * scale));
    ctx.font = `bold ${fSize}px "Courier New", Courier, monospace`;
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.shadowColor = '#f97316'; ctx.shadowBlur = fSize * 1.0;
    ctx.fillStyle = '#f97316';
    ctx.fillText(dateStr, w - pad, h - pad);
    ctx.shadowBlur = fSize * 0.3; ctx.fillStyle = '#fed7aa';
    ctx.fillText(dateStr, w - pad, h - pad);
    ctx.shadowBlur = 0;
  }

  // ── ② LCD 绿色（诺基亚 / 卡西欧 LCD 屏）─────────────────────
  static _timestampLCD(ctx, w, h, dateStr) {
    const scale = Math.min(1, w / 800);
    const fSize = Math.max(13, Math.round(27 * scale));
    const pad   = Math.max(10, Math.round(18 * scale));
    // Background pill
    ctx.font = `bold ${fSize}px "Courier New", Courier, monospace`;
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    const tw = ctx.measureText(dateStr).width;
    const bx = w - pad - tw - 6;
    const by = h - pad - fSize - 6;
    ctx.fillStyle = 'rgba(0,18,0,0.72)';
    DigiCamProcessor._roundRect(ctx, bx, by, tw + 12, fSize + 10, 3);
    ctx.fill();
    ctx.shadowColor = '#00ff44'; ctx.shadowBlur = fSize * 0.7;
    ctx.fillStyle = '#00ff44';
    ctx.fillText(dateStr, w - pad, h - pad);
    ctx.shadowBlur = fSize * 0.2; ctx.fillStyle = '#aaffc0';
    ctx.fillText(dateStr, w - pad, h - pad);
    ctx.shadowBlur = 0;
  }

  // ── ③ 点阵时间戳（LED 发光点阵字体）─────────────────────────
  static _timestampDotMatrix(ctx, w, h, dateStr) {
    const DOT_FONT = {
      '0': [0b01110,0b10001,0b10011,0b10101,0b11001,0b10001,0b01110],
      '1': [0b00100,0b01100,0b00100,0b00100,0b00100,0b00100,0b01110],
      '2': [0b01110,0b10001,0b00001,0b00010,0b00100,0b01000,0b11111],
      '3': [0b01110,0b10001,0b00001,0b00110,0b00001,0b10001,0b01110],
      '4': [0b00010,0b00110,0b01010,0b10010,0b11111,0b00010,0b00010],
      '5': [0b11111,0b10000,0b11110,0b00001,0b00001,0b10001,0b01110],
      '6': [0b01110,0b10000,0b10000,0b11110,0b10001,0b10001,0b01110],
      '7': [0b11111,0b00001,0b00010,0b00100,0b01000,0b01000,0b01000],
      '8': [0b01110,0b10001,0b10001,0b01110,0b10001,0b10001,0b01110],
      '9': [0b01110,0b10001,0b10001,0b01111,0b00001,0b00001,0b01110],
      ' ': [0,0,0,0,0,0,0],
      "'":[0b00100,0b00100,0b01000,0,0,0,0],
      '.': [0,0,0,0,0,0b01100,0b01100],
      '-': [0,0,0,0b11111,0,0,0],
    };
    const scale = Math.min(1, w / 800);
    const dot   = Math.max(2, Math.round(4 * scale));   // dot radius
    const gap   = Math.max(1, Math.round(1.5 * scale)); // gap between dots
    const step  = dot + gap;
    const charW = 5 * step + gap * 2;
    const charH = 7 * step;
    const pad   = Math.max(10, Math.round(18 * scale));

    const totalW = dateStr.length * charW;
    const startX = w - pad - totalW;
    const startY = h - pad - charH;

    // Background
    ctx.fillStyle = 'rgba(8,4,0,0.78)';
    DigiCamProcessor._roundRect(ctx, startX - gap*2, startY - gap*2,
      totalW + gap*4, charH + gap*4, 3);
    ctx.fill();

    // Inactive dots (very dim)
    ctx.fillStyle = 'rgba(180,90,10,0.12)';
    for (let ci = 0; ci < dateStr.length; ci++) {
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          const dx = startX + ci * charW + col * step + dot / 2;
          const dy = startY + row * step + dot / 2;
          ctx.beginPath(); ctx.arc(dx, dy, dot / 2, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // Active dots (bright amber)
    ctx.shadowColor = '#ff9900'; ctx.shadowBlur = dot * 2.5;
    ctx.fillStyle = '#ffcc44';
    for (let ci = 0; ci < dateStr.length; ci++) {
      const glyph = DOT_FONT[dateStr[ci]] || DOT_FONT[' '];
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          if ((glyph[row] >> (4 - col)) & 1) {
            const dx = startX + ci * charW + col * step + dot / 2;
            const dy = startY + row * step + dot / 2;
            ctx.beginPath(); ctx.arc(dx, dy, dot / 2, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    }
    ctx.shadowBlur = 0;
  }

  // ── ④ 8-bit 像素字体（低分辨率缩放上采样）────────────────────
  static _timestampEightBit(ctx, w, h, dateStr) {
    const scale   = Math.min(1, w / 800);
    const pixelSz = Math.max(2, Math.round(3 * scale)); // pixel block size
    const fSizeSmall = 8;  // render tiny, then scale up
    const upScale    = Math.max(2, Math.round(4 * scale));
    const pad        = Math.max(10, Math.round(18 * scale));

    // Render at tiny resolution
    const tmp = document.createElement('canvas');
    const tw  = dateStr.length * (fSizeSmall * 0.65 + 1) + 4;
    const th  = fSizeSmall + 4;
    tmp.width  = Math.ceil(tw);
    tmp.height = Math.ceil(th);
    const tc = tmp.getContext('2d');
    tc.font = `bold ${fSizeSmall}px "Courier New", monospace`;
    tc.fillStyle = '#000';
    tc.fillRect(0, 0, tmp.width, tmp.height);
    tc.fillStyle = '#ffffff';
    tc.textBaseline = 'top'; tc.textAlign = 'left';
    tc.fillText(dateStr, 2, 2);

    // Scale up without smoothing
    const dstW = tmp.width  * upScale;
    const dstH = tmp.height * upScale;
    const dstX = w - pad - dstW;
    const dstY = h - pad - dstH;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // Outer glow in orange
    const offscr = document.createElement('canvas');
    offscr.width = dstW; offscr.height = dstH;
    const oc = offscr.getContext('2d');
    oc.imageSmoothingEnabled = false;
    oc.drawImage(tmp, 0, 0, tmp.width, tmp.height, 0, 0, dstW, dstH);
    ctx.shadowColor = '#ff6600'; ctx.shadowBlur = upScale * 3;
    ctx.globalAlpha = 0.6;
    ctx.drawImage(offscr, dstX, dstY);
    ctx.shadowBlur = 0;
    // Main pixel color (white-orange)
    ctx.globalAlpha = 1;
    // Tint to orange
    oc.globalCompositeOperation = 'source-atop';
    oc.fillStyle = '#ff8c00'; oc.fillRect(0, 0, dstW, dstH);
    ctx.drawImage(offscr, dstX, dstY);
    ctx.imageSmoothingEnabled = true;
    ctx.restore();
  }

  // ── ⑤ 纯白简约（现代感）──────────────────────────────────────
  static _timestampWhite(ctx, w, h, dateStr) {
    const scale = Math.min(1, w / 800);
    const fSize = Math.max(13, Math.round(26 * scale));
    const pad   = Math.max(10, Math.round(18 * scale));
    ctx.font = `300 ${fSize}px "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6;
    ctx.fillStyle = 'rgba(255,255,255,0.90)';
    ctx.fillText(dateStr, w - pad, h - pad);
    ctx.shadowBlur = 0;
  }

  // ── Rounded rect helper ───────────────────────────────────────
  static _roundRect(ctx, x, y, rw, rh, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + rw - r, y);
    ctx.quadraticCurveTo(x + rw, y,       x + rw, y + r);
    ctx.lineTo(x + rw, y + rh - r);
    ctx.quadraticCurveTo(x + rw, y + rh,  x + rw - r, y + rh);
    ctx.lineTo(x + r, y + rh);
    ctx.quadraticCurveTo(x, y + rh,       x, y + rh - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y,            x + r, y);
    ctx.closePath();
  }

  // ─────────────────────────────────────────────────────────────
  //  NEW FILM EFFECTS
  // ─────────────────────────────────────────────────────────────

  /**
   * Light Leaks — radial gradient orbs at corners (screen blend)
   * Uses seeded pseudo-random so same image always gets same leak.
   */
  static _lightLeak(ctx, w, h, strength, seed) {
    if (strength < 0.015) return;
    const rng = n => ((Math.sin(seed * 127.1 + n * 311.7) * 43758.5453) % 1 + 1) % 1;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // 1-2 corner orbs
    const numLeaks = rng(0) < 0.45 ? 1 : 2;
    for (let li = 0; li < numLeaks; li++) {
      const corner = Math.floor(rng(li * 7 + 1) * 4);
      const cx = corner % 2 === 0 ? 0 : w;
      const cy = corner < 2 ? 0 : h;
      const r  = Math.max(w, h) * (0.38 + rng(li * 7 + 2) * 0.42);
      const hue = 15 + rng(li * 7 + 3) * 32;  // 15°=orange → 47°=warm yellow
      const a1  = Math.min(1, strength * (0.52 + rng(li * 7 + 4) * 0.38));
      const a2  = Math.min(1, strength * (0.14 + rng(li * 7 + 5) * 0.14));
      const g   = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0,    `hsla(${hue},100%,62%,${a1})`);
      g.addColorStop(0.35, `hsla(${hue+8},95%,55%,${a2*0.7})`);
      g.addColorStop(0.7,  `hsla(${hue+15},85%,50%,${a2*0.18})`);
      g.addColorStop(1,    'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    // Optional edge streak
    if (rng(20) < strength * 0.55) {
      const isTop = rng(21) < 0.5;
      const sg = ctx.createLinearGradient(0, isTop?0:h, w*rng(22)*0.65, isTop?h*0.28:h*0.72);
      sg.addColorStop(0, `rgba(255,138,38,${strength*0.28})`);
      sg.addColorStop(0.4, `rgba(255,100,20,${strength*0.06})`);
      sg.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  /**
   * Film Imperfections — vertical scratches + dust spots.
   * Seeded so results are stable per-image.
   */
  static _filmImperfections(ctx, w, h, strength, seed) {
    if (strength < 0.01) return;
    const rng = n => ((Math.sin(seed * 311.7 + n * 127.1) * 43758.5453) % 1 + 1) % 1;
    ctx.save();

    // Vertical scratches
    const numS = Math.floor(rng(0) * strength * 3.5);
    for (let s = 0; s < numS; s++) {
      const x      = Math.round(rng(s*11+1) * w);
      const opac   = (0.08 + rng(s*11+2) * 0.44) * Math.min(1, strength * 1.5);
      const bright = rng(s*11+3) > 0.38;
      const thin   = rng(s*11+4) > 0.32;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      for (let st = 1; st <= 14; st++) {
        const sy = (st / 14) * h;
        ctx.lineTo(x + (rng(s*100+st) - 0.5) * 1.3, sy);
      }
      ctx.strokeStyle = bright
        ? `rgba(255,245,228,${opac})`
        : `rgba(10,8,5,${opac*0.72})`;
      ctx.lineWidth = thin ? 0.5 : (1 + rng(s*11+5) * 0.8);
      ctx.stroke();
    }

    // Dust spots
    const numD = Math.floor(3 + rng(50) * strength * 15);
    for (let d = 0; d < numD; d++) {
      const dx   = rng(d*5+100) * w;
      const dy   = rng(d*5+101) * h;
      const r    = 0.5 + rng(d*5+102) * 1.9 * strength;
      const dark = rng(d*5+103) > 0.25;
      const op   = (0.22 + rng(d*5+104) * 0.58) * Math.min(1, strength * 1.4);
      ctx.globalAlpha = op;
      ctx.fillStyle   = dark ? '#050400' : 'rgba(255,252,232,0.95)';
      ctx.beginPath();
      ctx.arc(dx, dy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /**
   * Flash Flare — Huji-style lens flare with hot orb + anamorphic streak.
   * position: 'topright' | 'topleft' | 'bottomright' | 'bottomleft' | 'center'
   */
  static _flashFlare(ctx, w, h, strength, position) {
    if (strength < 0.02) return;
    const pos = {
      topright:    [w * 0.82, h * 0.09],
      topleft:     [w * 0.18, h * 0.09],
      bottomright: [w * 0.82, h * 0.91],
      bottomleft:  [w * 0.18, h * 0.91],
      center:      [w * 0.50, h * 0.50],
    };
    const [fx, fy] = pos[position] || pos.topright;
    const r = Math.min(w, h) * (0.13 + strength * 0.10);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // Wide warm glow
    const g1 = ctx.createRadialGradient(fx, fy, 0, fx, fy, r * 2.4);
    g1.addColorStop(0,    `rgba(255,205,130,${strength*0.52})`);
    g1.addColorStop(0.35, `rgba(255,160, 70,${strength*0.20})`);
    g1.addColorStop(0.75, `rgba(255, 90, 25,${strength*0.05})`);
    g1.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, w, h);

    // Hot core
    const g2 = ctx.createRadialGradient(fx, fy, 0, fx, fy, r * 0.48);
    g2.addColorStop(0,    `rgba(255,255,242,${strength*0.92})`);
    g2.addColorStop(0.45, `rgba(255,232,185,${strength*0.55})`);
    g2.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, w, h);

    // Film burn at corner
    const corner = position.includes('right') ? [w,0] : [0,0];
    if (!position.includes('bottom')) {
      const burn = ctx.createRadialGradient(corner[0],corner[1],0, corner[0],corner[1], w*0.52);
      burn.addColorStop(0, `rgba(255,155,35,${strength*0.26})`);
      burn.addColorStop(0.5, `rgba(255,110,18,${strength*0.08})`);
      burn.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = burn;
      ctx.fillRect(0, 0, w, h);
    }

    // Anamorphic horizontal streak
    const sh = Math.max(1, Math.round(r * 0.048));
    const sw = Math.min(w * 0.62, r * 4.2);
    const sg = ctx.createLinearGradient(fx-sw, fy, fx+sw, fy);
    sg.addColorStop(0,    'rgba(255,200,100,0)');
    sg.addColorStop(0.48, `rgba(255,228,165,${strength*0.42})`);
    sg.addColorStop(0.52, `rgba(255,245,200,${strength*0.52})`);
    sg.addColorStop(1,    'rgba(255,200,100,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(Math.max(0,fx-sw), fy-sh, Math.min(w, sw*2), sh*2);

    ctx.restore();
  }

  /**
   * Film Border — 'thin' matte or 'sprocket' 35mm film strip.
   */
  static _filmBorder(ctx, w, h, type) {
    if (!type || type === 'none') return;

    if (type === 'thin') {
      const b = Math.round(Math.max(w, h) * 0.018);
      ctx.fillStyle = '#000';
      ctx.fillRect(0,       0,       w,     b);       // top
      ctx.fillRect(0,       h-b,     w,     b);       // bottom
      ctx.fillRect(0,       b,       b,     h-b*2);   // left
      ctx.fillRect(w-b,     b,       b,     h-b*2);   // right
    } else if (type === 'sprocket') {
      const bH   = Math.round(h * 0.072);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0,   w, bH);
      ctx.fillRect(0, h-bH, w, bH);

      // Separator lines
      ctx.fillStyle = '#191919';
      ctx.fillRect(0, bH,   w, 1);
      ctx.fillRect(0, h-bH-1, w, 1);

      // Sprocket holes
      const hW  = Math.round(bH * 0.52);
      const hH  = Math.round(bH * 0.62);
      const hR  = Math.round(hW * 0.22);
      const gap = Math.round(hW * 2.75);
      const n   = Math.max(2, Math.floor((w - hW) / gap));
      const x0  = Math.round((w - (n-1)*gap) / 2);
      const yt  = Math.round(bH * 0.19);
      const yb  = h - bH + yt;

      for (let i = 0; i < n; i++) {
        const hx = Math.round(x0 + i*gap - hW/2);
        ctx.fillStyle = '#0c0c0c';
        DigiCamProcessor._roundRect(ctx, hx, yt, hW, hH, hR); ctx.fill();
        DigiCamProcessor._roundRect(ctx, hx, yb, hW, hH, hR); ctx.fill();
        ctx.strokeStyle = 'rgba(55,55,55,0.75)';
        ctx.lineWidth = 0.6;
        DigiCamProcessor._roundRect(ctx, hx, yt, hW, hH, hR); ctx.stroke();
        DigiCamProcessor._roundRect(ctx, hx, yb, hW, hH, hR); ctx.stroke();
      }
    }
  }

  // ── Generate demo test scene (for gallery previews) ───────────
  static generateTestScene(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');

    // Sky gradient (twilight)
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.62);
    sky.addColorStop(0,   '#0f1924');
    sky.addColorStop(0.3, '#b85540');
    sky.addColorStop(0.65,'#e8924a');
    sky.addColorStop(1,   '#f5d87a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h * 0.62);

    // Ground
    const gnd = ctx.createLinearGradient(0, h * 0.62, 0, h);
    gnd.addColorStop(0, '#274012');
    gnd.addColorStop(1, '#111a07');
    ctx.fillStyle = gnd;
    ctx.fillRect(0, h * 0.62, w, h);

    // Sun glow on horizon
    const sun = ctx.createRadialGradient(w * 0.62, h * 0.59, 0, w * 0.62, h * 0.59, h * 0.3);
    sun.addColorStop(0,   '#ffffff');
    sun.addColorStop(0.1, '#fff9c4');
    sun.addColorStop(0.4, 'rgba(255,210,80,0.6)');
    sun.addColorStop(1,   'rgba(255,150,0,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);

    // Building silhouettes
    ctx.fillStyle = '#0c1016';
    ctx.fillRect(w * 0.05, h * 0.30, w * 0.08, h * 0.32);  // bldg 1
    ctx.fillRect(w * 0.08, h * 0.22, w * 0.025, h * 0.08); // spire
    ctx.fillRect(w * 0.18, h * 0.37, w * 0.10, h * 0.25);  // bldg 2
    ctx.fillRect(w * 0.22, h * 0.29, w * 0.03, h * 0.08);  // spire 2
    ctx.fillRect(w * 0.33, h * 0.34, w * 0.07, h * 0.28);  // bldg 3
    ctx.fillRect(w * 0.80, h * 0.42, w * 0.12, h * 0.20);  // bldg 4
    ctx.fillRect(w * 0.88, h * 0.36, w * 0.03, h * 0.06);  // spire 4

    // Lit windows
    ctx.fillStyle = 'rgba(255,215,130,0.7)';
    const wins = [
      [0.06,0.32],[0.09,0.39],[0.07,0.45],[0.11,0.36],
      [0.20,0.38],[0.24,0.44],[0.21,0.50],[0.19,0.55],
      [0.34,0.36],[0.37,0.43],[0.35,0.50],
      [0.82,0.44],[0.85,0.50],[0.83,0.56],[0.87,0.44],
    ];
    wins.forEach(([wx,wy]) => {
      ctx.fillRect(w*wx, h*wy, w*0.012, h*0.017);
    });

    // Foreground street
    const street = ctx.createLinearGradient(0, h * 0.78, 0, h);
    street.addColorStop(0, '#1a1a2a');
    street.addColorStop(1, '#0a0a10');
    ctx.fillStyle = street;
    ctx.fillRect(0, h * 0.78, w, h);

    // Street light glow
    const sl = ctx.createRadialGradient(w*0.5, h*0.6, 0, w*0.5, h*0.6, h*0.12);
    sl.addColorStop(0, 'rgba(255,240,200,0.35)');
    sl.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = sl;
    ctx.fillRect(0, h*0.5, w, h);

    return c;
  }

  /**
   * JPEG Artifacts — encode canvas as low-quality JPEG and decode back.
   * This is the most authentic method: real DCT block compression artifacts.
   *
   * @param {HTMLCanvasElement} canvas   - Input (already processed by .process())
   * @param {number} effectiveStrength   - 0 (none) → 1 (maximum blocks)
   * @returns {Promise<HTMLCanvasElement>}
   */
  static applyJpegArtifacts(canvas, effectiveStrength) {
    if (effectiveStrength < 0.015) return Promise.resolve(canvas);

    // Map strength → JPEG quality with a curve that feels natural
    // strength 0   → quality ≈ 0.92  (barely visible)
    // strength 0.3 → quality ≈ 0.30  (moderate, 2000s point-and-shoot)
    // strength 0.7 → quality ≈ 0.10  (heavy lo-fi)
    // strength 1.0 → quality ≈ 0.04  (extreme)
    const t = Math.min(1, effectiveStrength);
    const quality = Math.max(0.04, Math.pow(1 - t, 2.4) * 0.88 + 0.04);

    // Encode as low-quality JPEG
    const dataUrl = canvas.toDataURL('image/jpeg', quality);

    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const out = document.createElement('canvas');
        out.width  = canvas.width;
        out.height = canvas.height;
        out.getContext('2d').drawImage(img, 0, 0, out.width, out.height);
        resolve(out);
      };
      // data: URLs decode near-synchronously in all modern browsers
      img.src = dataUrl;
    });
  }
}

