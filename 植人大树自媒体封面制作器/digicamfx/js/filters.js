/**
 * 数码胶片 DigiCamFX — Camera & Film Presets v3
 * 13 款预设，覆盖 CCD 年代相机、诺基亚手机、VHS 录像带、胶卷、IG 流行风格
 *
 * params 字段说明：
 *  brightness            整体亮度偏移 (-30 ~ +30)
 *  contrast              对比度倍数 (0.7 ~ 1.5)
 *  saturation            饱和度倍数 (0.4 ~ 2.0)
 *  warmth                暖色偏移，正→暖 负→冷 (-30 ~ +30)
 *  tint                  绿色偏移，负→洋红 正→绿 (-15 ~ +15)
 *  shadowTint            阴影区 RGB 色调 { r, g, b }
 *  highlightTint         高光区 RGB 色调 { r, g, b }
 *  baseNoise             基础颗粒量 (0 ~ 80)
 *  baseChromaticAberration 基础色差量 (0 ~ 8)
 *  baseVignette          基础暗角 (0 ~ 1)
 *  baseBloom             基础高光溢出 (0 ~ 1)
 *  bloomThreshold        高光溢出阈值 (0 ~ 255)
 *  baseJpegArtifacts     基础 JPEG 压缩块 (0 ~ 1)
 *  interlace             是否叠加 VHS 隔行扫描线 (boolean)
 *  baseLightLeak         漏光基础强度 (0 ~ 1)
 *  baseImperfections     胶片缺陷基础强度：划痕+尘点 (0 ~ 1)
 *  baseFlashFlare        闪光眩光基础强度 (0 ~ 1, 0=关闭)
 *  flashFlarePos         闪光位置 'topright'|'topleft'|'bottomright'|'center'
 */

const FILTERS = [

  // ── ① Canon IXUS ─────────────────────────────────────────────
  {
    id: 'canon_ixus',
    name: 'Canon IXUS',
    year: '2003',
    tag: 'IMG_001',
    description: '暖橙溢出 · 高光偏色 · 经典随拍机感',
    accentColor: '#f97316',
    params: {
      brightness: 8,   contrast: 1.12, saturation: 1.15, warmth: 18, tint: 0,
      shadowTint:    { r: 2,  g: -2, b: -12 },
      highlightTint: { r: 22, g: 8,  b: -8  },
      baseNoise: 22, baseChromaticAberration: 2.5, baseVignette: 0.45,
      baseBloom: 0.42, bloomThreshold: 185, baseJpegArtifacts: 0.55,
      baseLightLeak: 0.35, baseImperfections: 0.18,
      baseFlashFlare: 0, flashFlarePos: 'topright',
    }
  },

  // ── ② Sony T7 ────────────────────────────────────────────────
  {
    id: 'sony_cybershot',
    name: 'Sony T7',
    year: '2005',
    tag: 'IMG_002',
    description: '冷蓝高饱 · 锐利 CCD · 索尼科学',
    accentColor: '#3b82f6',
    params: {
      brightness: 3,   contrast: 1.18, saturation: 1.38, warmth: -13, tint: 3,
      shadowTint:    { r: -8,  g: 2,  b: 18 },
      highlightTint: { r: -14, g: 5,  b: 24 },
      baseNoise: 15, baseChromaticAberration: 1.5, baseVignette: 0.28,
      baseBloom: 0.32, bloomThreshold: 210, baseJpegArtifacts: 0.35,
      baseLightLeak: 0.08, baseImperfections: 0.12,
      baseFlashFlare: 0, flashFlarePos: 'topright',
    }
  },

  // ── ③ Kodak C300 ─────────────────────────────────────────────
  {
    id: 'kodak_easyshare',
    name: 'Kodak C300',
    year: '2004',
    tag: 'IMG_003',
    description: '暖金怀旧 · 重颗粒 · 暗部褪色',
    accentColor: '#eab308',
    params: {
      brightness: -3,  contrast: 1.06, saturation: 0.95, warmth: 24, tint: -3,
      shadowTint:    { r: -8, g: -8, b: -20 },
      highlightTint: { r: 28, g: 16, b: -14 },
      baseNoise: 40, baseChromaticAberration: 1.2, baseVignette: 0.62,
      baseBloom: 0.28, bloomThreshold: 192, baseJpegArtifacts: 0.75,
      baseLightLeak: 0.55, baseImperfections: 0.42,
      baseFlashFlare: 0, flashFlarePos: 'topright',
    }
  },

  // ── ④ Y2K Neon ───────────────────────────────────────────────
  {
    id: 'y2k_neon',
    name: 'Y2K Neon',
    year: '2001',
    tag: 'IMG_004',
    description: '极饱和 · 紫洋红 · 重色差 · 世纪之交',
    accentColor: '#a855f7',
    params: {
      brightness: 12,  contrast: 1.30, saturation: 1.60, warmth: -6, tint: 8,
      shadowTint:    { r: 14, g: -5, b: 28 },
      highlightTint: { r: 28, g: -14, b: 38 },
      baseNoise: 32, baseChromaticAberration: 5.0, baseVignette: 0.58,
      baseBloom: 0.72, bloomThreshold: 165, baseJpegArtifacts: 0.80,
      baseLightLeak: 0.62, baseImperfections: 0.28,
      baseFlashFlare: 0.68, flashFlarePos: 'topright',
    }
  },

  // ── ⑤ Casio EX-Z4 ────────────────────────────────────────────
  {
    id: 'casio_exilim',
    name: 'Casio EX-Z4',
    year: '2004',
    tag: 'IMG_005',
    description: '青冷调 · 清晰高光 · 卡西欧锐利感',
    accentColor: '#06b6d4',
    params: {
      brightness: 5,   contrast: 1.14, saturation: 1.12, warmth: -9, tint: 1,
      shadowTint:    { r: -12, g: 5,  b: 14 },
      highlightTint: { r: -7,  g: 12, b: 20 },
      baseNoise: 22, baseChromaticAberration: 1.5, baseVignette: 0.32,
      baseBloom: 0.20, bloomThreshold: 215, baseJpegArtifacts: 0.40,
      baseLightLeak: 0.10, baseImperfections: 0.18,
      baseFlashFlare: 0, flashFlarePos: 'topright',
    }
  },

  // ── ⑥ Fuji FinePix ───────────────────────────────────────────
  {
    id: 'fuji_finepix',
    name: 'Fuji FinePix',
    year: '2002',
    tag: 'IMG_006',
    description: '自然绿调 · 胶片平衡 · 轻微暖意',
    accentColor: '#22c55e',
    params: {
      brightness: 4,   contrast: 1.10, saturation: 1.12, warmth: 7, tint: 6,
      shadowTint:    { r: -6, g: 12, b: -7 },
      highlightTint: { r: 10, g: 20, b: -7 },
      baseNoise: 18, baseChromaticAberration: 1.0, baseVignette: 0.38,
      baseBloom: 0.26, bloomThreshold: 205, baseJpegArtifacts: 0.28,
      baseLightLeak: 0.22, baseImperfections: 0.20,
      baseFlashFlare: 0, flashFlarePos: 'topright',
    }
  },

  // ── ⑦ Samsung Digimax ────────────────────────────────────────
  {
    id: 'samsung_digimax',
    name: 'Samsung Digimax',
    year: '2003',
    tag: 'IMG_007',
    description: '洋红粉调 · 重颗粒 · 低保真 CCD',
    accentColor: '#ec4899',
    params: {
      brightness: 10,  contrast: 1.04, saturation: 1.25, warmth: 8, tint: -6,
      shadowTint:    { r: 14, g: -8, b: 2  },
      highlightTint: { r: 28, g: -10, b: 18 },
      baseNoise: 50, baseChromaticAberration: 3.8, baseVignette: 0.54,
      baseBloom: 0.35, bloomThreshold: 178, baseJpegArtifacts: 0.90,
      baseLightLeak: 0.45, baseImperfections: 0.52,
      baseFlashFlare: 0.45, flashFlarePos: 'topleft',
    }
  },

  // ── ⑧ 一次性相机 (Disposable Camera) ─────────────────────────
  {
    id: 'disposable',
    name: '一次性相机',
    year: '1999',
    tag: 'DISP_001',
    description: '闪光过曝 · 绿色暗部 · 重颗粒 · IG 首选',
    accentColor: '#84cc16',
    params: {
      brightness: 22,  contrast: 1.18, saturation: 1.28, warmth: 20, tint: -6,
      shadowTint:    { r: -6, g: 16, b: -10 },
      highlightTint: { r: 28, g: 14, b: -15 },
      baseNoise: 52, baseChromaticAberration: 3.2, baseVignette: 0.72,
      baseBloom: 0.60, bloomThreshold: 162, baseJpegArtifacts: 0.68,
      baseLightLeak: 0.82, baseImperfections: 0.50,
      baseFlashFlare: 0.92, flashFlarePos: 'topright',  // Huji 特征闪光！
    }
  },

  // ── ⑨ 诺基亚 N95 (Nokia N-series) ────────────────────────────
  {
    id: 'nokia_n95',
    name: '诺基亚 N95',
    year: '2006',
    tag: 'NOKIA_001',
    description: '紫调阴影 · 轻微褪色 · 手机 CCD 颗粒感',
    accentColor: '#8b5cf6',
    params: {
      brightness: 4,   contrast: 1.06, saturation: 0.90, warmth: 8, tint: -4,
      shadowTint:    { r: 10, g: -6, b: 18 },
      highlightTint: { r: 12, g: 5,  b: -5 },
      baseNoise: 42, baseChromaticAberration: 2.2, baseVignette: 0.44,
      baseBloom: 0.20, bloomThreshold: 205, baseJpegArtifacts: 0.88,
      baseLightLeak: 0.18, baseImperfections: 0.40,
      baseFlashFlare: 0, flashFlarePos: 'topright',
    }
  },

  // ── ⑩ VHS 录像带 (VHS Camcorder) ─────────────────────────────
  {
    id: 'vhs',
    name: 'VHS 录像带',
    year: '1995',
    tag: 'VHS_001',
    description: '隔行扫描 · 绿偏色 · 褪色录像 · 复古感',
    accentColor: '#10b981',
    params: {
      brightness: -6,  contrast: 0.86, saturation: 0.58, warmth: -10, tint: 6,
      shadowTint:    { r: -12, g: 14, b: -6 },
      highlightTint: { r: -8,  g: 16, b: 10 },
      baseNoise: 58, baseChromaticAberration: 4.2, baseVignette: 0.36,
      baseBloom: 0.14, bloomThreshold: 208, baseJpegArtifacts: 0,
      interlace: true,
      baseLightLeak: 0, baseImperfections: 0.65,
      baseFlashFlare: 0, flashFlarePos: 'topright',
    }
  },

  // ── ⑪ 拍立得 (Polaroid) ──────────────────────────────────────
  {
    id: 'polaroid',
    name: '拍立得',
    year: '1990',
    tag: 'POLAR_001',
    description: '奶油褪色 · 低反差 · 暖黄氛围 · 静谧感',
    accentColor: '#f59e0b',
    params: {
      brightness: 16,  contrast: 0.88, saturation: 0.84, warmth: 22, tint: 2,
      shadowTint:    { r: 12, g: 8,  b: -8 },
      highlightTint: { r: 25, g: 18, b: 6  },
      baseNoise: 16, baseChromaticAberration: 0.5, baseVignette: 0.38,
      baseBloom: 0.20, bloomThreshold: 220, baseJpegArtifacts: 0.22,
      baseLightLeak: 0.65, baseImperfections: 0.28,
      baseFlashFlare: 0, flashFlarePos: 'topright',
    }
  },

  // ── ⑫ 少女心事 (Coquette / Soft Pink) ───────────────────────
  {
    id: 'soft_pink',
    name: '少女心事',
    year: '2024',
    tag: 'COQUETTE',
    description: '梦幻粉调 · 柔光溢出 · IG 女性首选风格',
    accentColor: '#f472b6',
    params: {
      brightness: 18,  contrast: 0.93, saturation: 1.18, warmth: 16, tint: -10,
      shadowTint:    { r: 18, g: 5,  b: 10 },
      highlightTint: { r: 32, g: 12, b: 18 },
      baseNoise: 14, baseChromaticAberration: 0.8, baseVignette: 0.28,
      baseBloom: 0.48, bloomThreshold: 185, baseJpegArtifacts: 0.12,
      baseLightLeak: 0.42, baseImperfections: 0.10,
      baseFlashFlare: 0.58, flashFlarePos: 'topleft',
    }
  },

  // ── ⑬ 哥特学院 (Dark Academia) ───────────────────────────────
  {
    id: 'dark_academia',
    name: '哥特学院',
    year: '2023',
    tag: 'DARK_001',
    description: '暖棕阴郁 · 高反差 · 低饱和 · 文艺沉浸感',
    accentColor: '#92400e',
    params: {
      brightness: -14, contrast: 1.28, saturation: 0.76, warmth: 20, tint: -2,
      shadowTint:    { r: 12, g: 6,  b: -12 },
      highlightTint: { r: 22, g: 14, b: -10 },
      baseNoise: 32, baseChromaticAberration: 1.4, baseVignette: 0.68,
      baseBloom: 0.22, bloomThreshold: 212, baseJpegArtifacts: 0.32,
      baseLightLeak: 0, baseImperfections: 0.48,
      baseFlashFlare: 0, flashFlarePos: 'topright',
    }
  },

];
