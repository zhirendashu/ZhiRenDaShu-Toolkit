/**
 * DigiCamFX — LUT Engine v1
 * 标准 .cube 格式 3D LUT 解析器 + 三线性插值应用器
 * 纯前端实现，零依赖，支持 LUT_3D_SIZE 33 / 64
 *
 * 使用方法：
 *   const lut = await LUTEngine.load('lut/xxx.cube');
 *   const result = LUTEngine.apply(imageData, lut, 1.0);
 */

class LUTEngine {
  constructor() {
    this._cache   = new Map(); // path → {size, data: Float32Array}
    this._loading = new Map(); // path → Promise (防止重复加载)
  }

  /**
   * 加载并缓存 .cube 文件
   * @param {string} path  - 相对路径或 URL
   * @returns {Promise<{size:number, data:Float32Array}>}
   */
  async load(path) {
    if (this._cache.has(path))   return this._cache.get(path);
    if (this._loading.has(path)) return this._loading.get(path);

    const promise = fetch(path)
      .then(r => {
        if (!r.ok) throw new Error(`LUT load failed: ${r.status} ${path}`);
        return r.text();
      })
      .then(text => {
        const lut = this._parse(text);
        this._cache.set(path, lut);
        this._loading.delete(path);
        return lut;
      })
      .catch(err => {
        this._loading.delete(path);
        console.error('[LUTEngine]', err);
        return null;
      });

    this._loading.set(path, promise);
    return promise;
  }

  /** 解析 .cube 文本为 LUT 对象 */
  _parse(text) {
    let size = 33;
    const values = [];
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      if (t.startsWith('#'))  continue;
      if (t.startsWith('TITLE'))  continue;
      if (t.startsWith('LUT_3D_SIZE')) {
        size = parseInt(t.split(/\s+/)[1], 10);
        continue;
      }
      if (t.startsWith('LUT_')  || t.startsWith('DOMAIN')) continue;
      const parts = t.split(/\s+/);
      if (parts.length >= 3) {
        const r = parseFloat(parts[0]);
        const g = parseFloat(parts[1]);
        const b = parseFloat(parts[2]);
        if (!isNaN(r)) {
          values.push(r, g, b);
        }
      }
    }
    return { size, data: new Float32Array(values) };
  }

  /**
   * 应用 3D LUT 到 ImageData（三线性插值）
   * @param {ImageData} imageData  - 将被原地修改
   * @param {{size:number, data:Float32Array}} lut
   * @param {number} strength      - 混合强度 0.0 ~ 1.0
   * @returns {ImageData}
   */
  apply(imageData, lut, strength = 1.0) {
    if (!lut || !lut.data || strength < 0.01) return imageData;
    const { size, data } = lut;
    const d  = imageData.data;
    const s1 = size - 1;
    const sz = size;
    const sz2 = size * size;

    for (let i = 0; i < d.length; i += 4) {
      const r0 = d[i]   / 255;
      const g0 = d[i+1] / 255;
      const b0 = d[i+2] / 255;

      // Grid position
      const rx = r0 * s1;
      const gy = g0 * s1;
      const bz = b0 * s1;

      const ri = Math.min(s1 - 1, Math.floor(rx));
      const gi = Math.min(s1 - 1, Math.floor(gy));
      const bi = Math.min(s1 - 1, Math.floor(bz));

      const rf = rx - ri;
      const gf = gy - gi;
      const bf = bz - bi;

      // 8 corners base offset (B is outermost axis in .cube format)
      const base = (bi * sz2 + gi * sz + ri) * 3;

      for (let c = 0; c < 3; c++) {
        const v000 = data[base                     + c];
        const v100 = data[base + 3                 + c];
        const v010 = data[base + sz * 3            + c];
        const v110 = data[base + sz * 3 + 3        + c];
        const v001 = data[base + sz2 * 3           + c];
        const v101 = data[base + sz2 * 3 + 3       + c];
        const v011 = data[base + sz2 * 3 + sz * 3  + c];
        const v111 = data[base + sz2 * 3 + sz * 3 + 3 + c];

        // Trilinear interpolation
        const v =
          v000 * (1-rf) * (1-gf) * (1-bf) +
          v100 *    rf  * (1-gf) * (1-bf) +
          v010 * (1-rf) *    gf  * (1-bf) +
          v110 *    rf  *    gf  * (1-bf) +
          v001 * (1-rf) * (1-gf) *    bf  +
          v101 *    rf  * (1-gf) *    bf  +
          v011 * (1-rf) *    gf  *    bf  +
          v111 *    rf  *    gf  *    bf;

        // Blend with original
        const orig = d[i + c] / 255;
        d[i + c] = Math.max(0, Math.min(255,
          Math.round((orig * (1 - strength) + v * strength) * 255)
        ));
      }
      // Alpha unchanged
    }
    return imageData;
  }

  /** 清除缓存（节省内存） */
  clearCache() {
    this._cache.clear();
  }
}

// ════════════════════════════════════════════════════════════════
//  胶片色彩预设定义
//  每款 LUT 都有创意命名，来自你提供的真实胶片扫描数据
// ════════════════════════════════════════════════════════════════

const LUT_PRESETS = [

  // ── 关闭 ─────────────────────────────────────────────────────
  {
    id:    'none',
    name:  '无 LUT',
    tag:   '—',
    file:  null,
    desc:  '不应用胶片色彩科学，仅使用 CCD 相机预设',
    color: '#555',
  },

  // ── DAZZ 原生 LUT 系列（64³，DAZZ App 真实胶片模拟）─────────

  {
    id:    'velvia',
    name:  'Velvia 鲜艳',
    tag:   'FUJI',
    file:  'lut/DAZZ 原生lut/GR F-Velvia.cube',
    desc:  '富士 Velvia 50 · 超高饱和 · 深邃鲜艳 · 自然风景必备',
    color: '#22c55e',
  },
  {
    id:    'kodak400',
    name:  '柯达暗房',
    tag:   'KODAK',
    file:  'lut/DAZZ 原生lut/D Exp - KD400.cube',
    desc:  'Kodak 400 暗部显影 · 电影暖调 · 层次丰富',
    color: '#f59e0b',
  },
  {
    id:    'classicu',
    name:  '传奇经典',
    tag:   'CLASS',
    file:  'lut/DAZZ 原生lut/Class U.cube',
    desc:  'Class U 经典色调 · 沉稳大气 · 时光质感',
    color: '#a78bfa',
  },
  {
    id:    'instant_sq',
    name:  '方块拍立得',
    tag:   'INST',
    file:  'lut/DAZZ 原生lut/Inst SQ.cube',
    desc:  '方形即时相机 · 奶油褪色 · 暖意满满',
    color: '#fb923c',
  },
  {
    id:    'infrared',
    name:  '红外幻境',
    tag:   'IR',
    file:  'lut/DAZZ 原生lut/IR-400.cube',
    desc:  '红外感光胶片 · 梦幻色移 · 超现实氛围',
    color: '#f43f5e',
  },
  {
    id:    'holga',
    name:  '霞光晨雾',
    tag:   'HOGA',
    file:  'lut/DAZZ 原生lut/HOGA.cube',
    desc:  'Holga 玩具相机 · 柔焦暖雾 · 胶片渗光感',
    color: '#fbbf24',
  },
  {
    id:    'dclassic',
    name:  '默片时代',
    tag:   'DCLS',
    file:  'lut/DAZZ 原生lut/DClassic.cube',
    desc:  '经典默片色调 · 褪色质感 · 岁月痕迹',
    color: '#9ca3af',
  },
  {
    id:    'halffilm',
    name:  '半格胶片',
    tag:   'HALF',
    file:  'lut/DAZZ 原生lut/D Half-FNT16.cube',
    desc:  '半格相机 · FNT16 胶卷 · 精致颗粒',
    color: '#60a5fa',
  },
  {
    id:    'kodak_ccf',
    name:  '发色 CCF400',
    tag:   'CCF',
    file:  'lut/DAZZ 原生lut/D Exp - CCF400.cube',
    desc:  'CCF400 显影 · 暗部绿调 · 特色发色',
    color: '#4ade80',
  },
  {
    id:    'gold200_dazz',
    name:  '黄金日系',
    tag:   'KG',
    file:  'lut/DAZZ 原生lut/S Classic-KG200.cube',
    desc:  'Kodak Gold 200 · 黄金暖调 · 日系清新感',
    color: '#facc15',
  },

  // ── Kodak 5207 电影胶片系列 ───────────────────────────────────

  {
    id:    'cinema5207',
    name:  '好莱坞电影',
    tag:   '5207',
    file:  'lut/Kodak 5207/【标准】Kodak 5207-S.cube',
    desc:  'Kodak Vision3 5207 · 专业电影胶片 · 细腻肤色',
    color: '#c084fc',
  },

  // ── SP3000 扫描仪 × Gold 200 系列 ────────────────────────────

  {
    id:    'ultramax',
    name:  '极彩 Ultramax',
    tag:   'UMAX',
    file:  'lut/SP3000&GOLD200/realcolor ultramax400.cube',
    desc:  '柯达 Ultramax 400 真实色彩 · 高饱和 · 鲜艳活泼',
    color: '#f97316',
  },
  {
    id:    'gold200_sp',
    name:  '黄金年代',
    tag:   'SP×G',
    file:  'lut/SP3000&GOLD200/【原始】Sp3000 x Gold200.cube',
    desc:  'SP3000 精扫 × Kodak Gold 200 · 暖金质感 · 胶片感极强',
    color: '#d97706',
  },

  // ── 日杂系列 ─────────────────────────────────────────────────

  {
    id:    'japan_air',
    name:  '日系空气',
    tag:   'JP',
    file:  'lut/植人大树 日杂/日系空气感.cube',
    desc:  '日系杂志风 · 高亮空气感 · 清新透彻',
    color: '#38bdf8',
  },
  {
    id:    'tokyo',
    name:  '东京写真',
    tag:   'TKY',
    file:  'lut/植人大树 日杂/japan1.cube',
    desc:  '东京胶片日记 · 柔和淡雅 · 青春气息',
    color: '#a3e635',
  },

  // ── 香港印象系列（33³，加载最快！）───────────────────────────

  {
    id:    'hk_cinema',
    name:  '港风电影',
    tag:   'HK',
    file:  'lut/香港印象/港风电影.cube',
    desc:  '港式电影质感 · 王家卫美学 · 橙青互补',
    color: '#fb923c',
  },
  {
    id:    'kinetic1',
    name:  '动感 Kinetic',
    tag:   'K·01',
    file:  'lut/香港印象/Kinetic 01.cube',
    desc:  '城市霓虹冷调 · Gamut 色彩科学 · 现代电影感',
    color: '#818cf8',
  },
  {
    id:    'kinetic3',
    name:  '霓虹追光',
    tag:   'K·03',
    file:  'lut/香港印象/Kinetic 03.cube',
    desc:  '霓虹光追迹 · 深邃蓝调 · 夜游城市',
    color: '#2dd4bf',
  },
  {
    id:    'kinetic5',
    name:  '赛博余晖',
    tag:   'K·05',
    file:  'lut/香港印象/Kinetic 05.cube',
    desc:  '赛博朋克余晖 · 冷暖撞色 · 科技感',
    color: '#e879f9',
  },

];

// ─── 全局单例 ─────────────────────────────────────────────────
const lutEngine = new LUTEngine();
