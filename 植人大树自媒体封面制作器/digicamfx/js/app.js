/**
 * 数码胶片 DigiCamFX — App Logic v2
 * 架构：组件化状态驱动，为未来 React Native 移植预留接口
 *
 * ─ 模块边界 ─────────────────────────────────────────────────────
 *  filters.js    → 纯数据（相机预设、FAQ）
 *  processor.js  → 纯函数（图像处理，无副作用）
 *  app.js        → UI 状态管理 + DOM 交互
 * ────────────────────────────────────────────────────────────────
 */

'use strict';

// ═══════════════════════════════════════════════════════════════
//  Toast 提示与 Alert 覆盖
// ═══════════════════════════════════════════════════════════════
window.showToast = function(msg, type = "info") {
  const toast = document.getElementById('modern-toast');
  if (!toast) return;
  const icon = type === 'error' ? '❌' : (type === 'success' ? '✅' : '✨');
  toast.innerHTML = `${icon} <span style="margin-left:4px;">${msg}</span>`;
  toast.classList.add("show");
  if (window._toastTimer) clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
};
window.alert = function(msg) {
  window.showToast(msg, 'error');
};

// 默认滑块参数常量
const DEFAULTS = {
  intensity: 80,
  grain:     50,
  chroma:    50,
  vignette:  50,
  bloom:     50,
  artifacts: 30,
  lightleak:      50,
  imperfections:  30,
};

// ═══════════════════════════════════════════════════════════════
//  全局状态（移植时可替换为 Zustand / Redux）
// ═══════════════════════════════════════════════════════════════
const State = (() => {
  let _state = {
    // 图像
    srcImageData: null,
    originalCanvas: null,
    processedCanvas: null,
    imageName: '',
    imageW: 0,
    imageH: 0,

    // 批量模式
    batchItems: [],        // [{ file, name, srcImageData, processed }]
    activeIndex: 0,

    // 滤镜
    filterId: 'canon_ixus',

    // 比较滑块
    splitX: 0.5,
    draggingHandle: false,

    // 处理参数
    params: { ...DEFAULTS },

    // 时间戳
    timestampOn:   true,
    timestampDate: '2005-10-24',
    tsMode:        'classic',

    // 胶片效果
    filmBorder: 'none',   // 'none' | 'thin' | 'sprocket'
    flashFlare: false,    // boolean: 开关 Huji 闪光点
    filmSeed:   Math.floor(Math.random() * 99999) + 1,  // 每次上传新图重新生成

    // 视图模式
    viewMode: 'processed',

    // 系统
    processing: false,
    debounce: null,
  };

  // 订阅者列表（移植时可替换为 Redux middleware）
  const _subs = [];

  return {
    get: () => _state,
    set(patch) {
      _state = { ..._state, ...patch };
      _subs.forEach(fn => fn(_state));
    },
    patch(key, val) { this.set({ [key]: val }); },
    subscribe(fn) { _subs.push(fn); return () => _subs.splice(_subs.indexOf(fn), 1); },
  };
})();

// ═══════════════════════════════════════════════════════════════
//  DOM 工具
// ═══════════════════════════════════════════════════════════════
const $ = id => document.getElementById(id);
const el = (tag, attrs = {}, children = []) => {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else e.setAttribute(k, v);
  });
  children.forEach(c => e.append(typeof c === 'string' ? document.createTextNode(c) : c));
  return e;
};

// ═══════════════════════════════════════════════════════════════
//  初始化
// ═══════════════════════════════════════════════════════════════
function init() {
  renderCameraList();
  renderMobileCameraStrip();
  renderGallery();
  renderFAQ();
  bindSliders();
  bindTimestamp();
  bindViewToggle();
  bindTimestampMode();
  bindFilmEffects();
  bindUploadZone();
  bindCompareHandle();
  bindButtons();
  bindKeyboard();
  bindMobileControls();
  registerServiceWorker();

  const ro = new ResizeObserver(() => {
    if (State.get().processedCanvas) renderCompare();
  });
  ro.observe($('compare-container'));

  const roSbs = new ResizeObserver(() => {
    if (State.get().viewMode === 'sidebyside' && State.get().processedCanvas) {
      renderSideBySide();
    }
  });
  roSbs.observe($('compare-sidebyside'));
}

// ═══════════════════════════════════════════════════════════════
//  相机列表
// ═══════════════════════════════════════════════════════════════
function renderCameraList() {
  const list = $('camera-list');
  list.innerHTML = '';
  FILTERS.forEach(f => {
    const item = el('button', {
      class: 'camera-item' + (f.id === State.get().filterId ? ' active' : ''),
      'data-id': f.id,
      role: 'radio',
      'aria-checked': f.id === State.get().filterId ? 'true' : 'false',
    });
    const dot  = el('span', { class: 'camera-swatch', style: `background:${f.accentColor}` });
    const info = el('div',  { class: 'camera-item-info' });
    info.append(
      el('span', { class: 'camera-item-name' }, [f.name]),
      el('span', { class: 'camera-item-year' }, [f.year])
    );
    item.append(dot, info);
    item.addEventListener('click', () => selectFilter(f.id));
    list.appendChild(item);
  });
}

function renderMobileCameraStrip() {
  const strip = $('mobile-camera-strip');
  strip.innerHTML = '';
  FILTERS.forEach(f => {
    const pill = el('button', {
      class: 'mobile-cam-pill' + (f.id === State.get().filterId ? ' active' : ''),
      'data-id': f.id,
    });
    const dot = el('span', { class: 'mobile-cam-dot', style: `background:${f.accentColor}` });
    pill.append(dot, document.createTextNode(f.name));
    pill.addEventListener('click', () => selectFilter(f.id));
    strip.appendChild(pill);
  });
}

function selectFilter(id) {
  State.patch('filterId', id);
  // Update sidebar
  document.querySelectorAll('.camera-item').forEach(el => {
    const active = el.dataset.id === id;
    el.classList.toggle('active', active);
    el.setAttribute('aria-checked', active ? 'true' : 'false');
  });
  // Update mobile strip
  document.querySelectorAll('.mobile-cam-pill').forEach(el => {
    el.classList.toggle('active', el.dataset.id === id);
  });
  // Update gallery
  document.querySelectorAll('.gallery-card').forEach(el => {
    el.classList.toggle('active', el.dataset.id === id);
  });
  // Update chip
  const f = FILTERS.find(f => f.id === id);
  $('chip-filter').textContent = f.name;
  if (State.get().srcImageData) scheduleProcess();
}

// ═══════════════════════════════════════════════════════════════
//  画廊（实际滤镜预览）
// ═══════════════════════════════════════════════════════════════
function renderGallery() {
  const grid = $('gallery-grid');
  grid.innerHTML = '';

  const scene     = DigiCamProcessor.generateTestScene(400, 300);
  const sceneCtx  = scene.getContext('2d');
  const sceneData = sceneCtx.getImageData(0, 0, 400, 300);

  FILTERS.forEach((f, i) => {
    const proc = DigiCamProcessor.process(
      sceneData, f.params,
      { intensity: 88, grain: 58, chroma: 58, vignette: 62, bloom: 64 },
      { enabled: true, date: `'05 10 ${String(20 + i).padStart(2,'0')}` }
    );

    const card = el('a', {
      class: 'gallery-card' + (f.id === State.get().filterId ? ' active' : ''),
      href: '#app-shell',
      'data-id': f.id,
      role: 'listitem',
    });
    const img = el('img', {
      src: proc.toDataURL('image/jpeg', 0.85),
      alt: `${f.name} 滤镜预览`,
      loading: 'lazy',
    });

    const overlay = el('div', { class: 'gallery-overlay' });
    const tag  = el('div', { class: 'gallery-tag-chip' }, [f.tag]);
    const info = el('div', { class: 'gallery-info' });
    info.append(
      el('span', { class: 'gallery-cam-name' }, [f.name]),
      el('span', { class: 'gallery-cam-date' }, [`20${f.year.slice(-2)}.10.24`])
    );
    const stamp = el('div', { class: 'gallery-stamp' }, [`'${f.year.slice(-2)} 10 24`]);

    overlay.append(tag, info, stamp);
    card.append(img, overlay);
    card.addEventListener('click', () => selectFilter(f.id));
    grid.appendChild(card);
  });
}

// ═══════════════════════════════════════════════════════════════
//  FAQ
// ═══════════════════════════════════════════════════════════════
const FAQ_ZH = [
  { q: '数码胶片是什么？', a: '数码胶片（DigiCamFX）是一款基于浏览器的照片处理工具，模拟 2000 年代初 CCD 数码相机的真实质感——色彩偏移、高光溢出、颗粒感，完全还原千禧年代的数码摄影风格。' },
  { q: '完全免费吗？', a: '是的，完全免费。无水印、无账号、无导出限制。我们认为优秀的创作工具应该向所有人开放。' },
  { q: '我的照片会上传到服务器吗？', a: '绝对不会。所有处理都在您的浏览器本地完成，使用 Canvas 2D API。数码胶片采用"零知识"设计，我们不会接收任何您的图片数据。' },
  { q: '支持手机使用吗？', a: '支持。数码胶片完全响应式，在 iOS 和 Android 浏览器上均可正常使用，您还可以将其添加到主屏幕作为 PWA App 使用。' },
  { q: '与 Instagram 滤镜有什么区别？', a: 'Instagram 滤镜只是简单的颜色叠加。数码胶片模拟了 CCD 传感器的真实物理特性——包括色差算法、拜尔噪点、高光阈值溢出和镜头暗角衰减，效果更真实、更有氛围。' },
  { q: '可以用于商业项目吗？', a: '可以。处理后的图片没有任何使用限制，可用于社交媒体、商业推广、专辑封面、编辑设计等任何场景。' },
  { q: '色差（Chromatic Aberration）是什么？', a: '色差是一种镜头光学像差，不同波长的光在焦点位置略有偏差，导致高对比度边缘出现彩色条纹。早期 CCD 相机的镜头普遍存在这种效果，数码胶片在像素级别精确还原了这一特性。' },
  { q: '为什么照片看起来"坏掉"但感觉很好？', a: '现代相机用 AI 算法过度修正了一切，把照片的"质感"也磨掉了。早期 CCD 的"缺陷"——噪点、溢光、色偏——恰恰创造了独特的氛围和情绪。数码胶片让您选择以情绪胜过技术完美。' },
];

function renderFAQ() {
  const list = $('faq-list');
  list.innerHTML = '';
  FAQ_ZH.forEach(({ q, a }) => {
    const details = el('details', { class: 'faq-item', role: 'listitem' });
    const summary = el('summary', { class: 'faq-q' });
    summary.append(document.createTextNode(q), el('span', { class: 'faq-chevron' }, ['›']));
    const ans = el('div', { class: 'faq-a' }, [a]);
    details.append(summary, ans);
    list.appendChild(details);
  });
}

// ═══════════════════════════════════════════════════════════════
//  上传区
// ═══════════════════════════════════════════════════════════════
function bindUploadZone() {
  const zone = $('upload-zone');
  const inp  = $('file-input');

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', ()  => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    const imgs = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
    if (imgs.length) handleFiles(imgs);
  });
  zone.addEventListener('click', e => {
    if (!e.target.closest('.upload-link')) inp.click();
  });
  zone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') inp.click(); });
  $('upload-trigger').addEventListener('click', e => { e.stopPropagation(); inp.click(); });
  inp.addEventListener('change', e => {
    if (e.target.files.length) handleFiles([...e.target.files]);
    inp.value = '';
  });
}

// ═══════════════════════════════════════════════════════════════
//  文件加载
// ═══════════════════════════════════════════════════════════════
function loadImg(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload  = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = rej;
    img.src = url;
  });
}

function imgToData(img) {
  const MAX = 1920;
  let w = img.naturalWidth, h = img.naturalHeight;
  if (Math.max(w, h) > MAX) {
    const s = MAX / Math.max(w, h);
    w = Math.round(w * s); h = Math.round(h * s);
  }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  return c.getContext('2d').getImageData(0, 0, w, h);
}

function dataToCanvas(data) {
  const c = document.createElement('canvas');
  c.width = data.width; c.height = data.height;
  c.getContext('2d').putImageData(data, 0, 0);
  return c;
}

async function handleFiles(files) {
  if (files.length === 1) {
    State.set({ batchItems: [], activeIndex: 0 });
    $('btn-export-all').style.display = 'none';
    $('batch-strip-wrap').classList.remove('visible');
    await loadSingle(files[0]);
  } else {
    State.patch('batchItems', files.map(f => ({ file: f, name: f.name, srcImageData: null, processed: null })));
    $('btn-export-all').style.display = '';
    $('batch-strip-wrap').classList.add('visible');
    await loadBatchAt(0);
    buildBatchStrip();
  }
}

async function loadSingle(file) {
  setStatus('加载中…');
  const img  = await loadImg(file);
  const data = imgToData(img);
  State.set({
    srcImageData:   data,
    originalCanvas: dataToCanvas(data),
    imageName: file.name,
    imageW: data.width, imageH: data.height,
  });
  showWorkspace();
  await processAndRender();
}

async function loadBatchAt(idx) {
  const items = State.get().batchItems;
  if (!items[idx].srcImageData) {
    setStatus(`加载 ${idx+1}/${items.length}…`);
    const img  = await loadImg(items[idx].file);
    items[idx].srcImageData = imgToData(img);
  }
  const data = items[idx].srcImageData;
  State.set({
    srcImageData:   data,
    originalCanvas: dataToCanvas(data),
    activeIndex: idx,
    imageName: items[idx].file.name,
    imageW: data.width, imageH: data.height,
  });
  showWorkspace();
  await processAndRender();
  document.querySelectorAll('.batch-thumb').forEach((t, i) =>
    t.classList.toggle('active', i === idx));
}

// ═══════════════════════════════════════════════════════════════
//  工作区切换
// ═══════════════════════════════════════════════════════════════
function showWorkspace() {
  $('upload-zone').style.display = 'none';
  $('workspace').style.display   = '';
  $('view-toggle-bar').style.display = '';  // 显示视图切换条
  updateSizeChip();
}

function updateSizeChip() {
  const { imageW, imageH } = State.get();
  if (!imageW) return;
  const chip = $('chip-size');
  chip.textContent = `${imageW} × ${imageH}`;
  chip.style.display = '';
  $('export-size-info').textContent = `${imageW} × ${imageH} px`;
}

// ═══════════════════════════════════════════════════════════════
//  批量缩略图条
// ═══════════════════════════════════════════════════════════════
function buildBatchStrip() {
  const strip = $('batch-strip');
  strip.innerHTML = '';
  const items = State.get().batchItems;
  $('batch-count').textContent = `${items.length} 张`;

  items.forEach((item, i) => {
    const thumb = el('div', {
      class: 'batch-thumb' + (i === State.get().activeIndex ? ' active' : ''),
      role: 'listitem', tabindex: '0', 'aria-label': `第 ${i+1} 张图片`,
    });

    // 小缩略图
    const tc = document.createElement('canvas');
    const d  = item.srcImageData;
    const ratio = d.width / d.height;
    tc.width = 64; tc.height = Math.round(64 / ratio);
    const tempCtx = tc.getContext('2d');
    const temp = document.createElement('canvas');
    temp.width = d.width; temp.height = d.height;
    temp.getContext('2d').putImageData(d, 0, 0);
    tempCtx.drawImage(temp, 0, 0, tc.width, tc.height);
    tc.style.cssText = 'width:64px;height:48px;object-fit:cover;display:block;';

    const num = el('div', { class: 'batch-thumb-num' }, [String(i + 1)]);
    thumb.append(tc, num);
    thumb.addEventListener('click', () => loadBatchAt(i));
    thumb.addEventListener('keydown', e => { if (e.key === 'Enter') loadBatchAt(i); });
    strip.appendChild(thumb);
  });
}

// ═══════════════════════════════════════════════════════════════
//  图像处理
// ═══════════════════════════════════════════════════════════════
async function processAndRender() {
  const s = State.get();
  if (!s.srcImageData || s.processing) return;
  State.patch('processing', true);
  setStatus('处理中…');

  await new Promise(r => setTimeout(r, 8)); // 让 UI 更新

  const filter = FILTERS.find(f => f.id === s.filterId);
  const stamp = {
    enabled: s.timestampOn,
    date:    formatDate(s.timestampDate),
    mode:    s.tsMode,
  };
  const effectParams = {
    filmBorder: s.filmBorder,
    flashFlare: s.flashFlare,
    seed:       s.filmSeed,
  };

  const processed = DigiCamProcessor.process(
    s.srcImageData, filter.params, s.params, stamp, effectParams
  );

  // ── JPEG 压缩块（最后一步，因为是相机保存时才压缩）──
  const artifactsMult = (s.params.artifacts / 50);   // 50 = 1x
  const effectiveArtifacts = filter.params.baseJpegArtifacts * artifactsMult * (s.params.intensity / 100);
  const finalCanvas = await DigiCamProcessor.applyJpegArtifacts(processed, effectiveArtifacts);

  // 更新批量项目
  if (s.batchItems.length > 0) {
    s.batchItems[s.activeIndex].processed = finalCanvas;
  }

  State.set({ processedCanvas: finalCanvas, processing: false });

  // 设置 display canvas 的原始尺寸
  const canvas = $('display-canvas');
  canvas.width  = s.srcImageData.width;
  canvas.height = s.srcImageData.height;

  fitCanvas();
  renderCompare();

  setStatus('完成');
}

function scheduleProcess() {
  const s = State.get();
  clearTimeout(s.debounce);
  State.patch('debounce', setTimeout(processAndRender, 130));
}

// ═══════════════════════════════════════════════════════════════
//  画布适配（ResizeObserver 驱动）
// ═══════════════════════════════════════════════════════════════
function fitCanvas() {
  const s = State.get();
  if (!s.srcImageData) return;
  const container = $('compare-container');
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  const ia = s.srcImageData.width / s.srcImageData.height;

  let dw, dh;
  if (cw / ch > ia) { dh = ch; dw = Math.round(ch * ia); }
  else               { dw = cw; dh = Math.round(cw / ia); }

  const canvas = $('display-canvas');
  Object.assign(canvas.style, {
    width:    dw + 'px',
    height:   dh + 'px',
    left:     Math.round((cw - dw) / 2) + 'px',
    top:      Math.round((ch - dh) / 2) + 'px',
  });

  // 同步手柄位置
  const handle = $('compare-handle');
  handle.style.height = dh + 'px';
  handle.style.top    = Math.round((ch - dh) / 2) + 'px';
  handle.style.left   = (Math.round((cw - dw) / 2) + dw * s.splitX) + 'px';
}

// ═══════════════════════════════════════════════════════════════
//  比较视图渲染
// ═══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
//  比较视图渲染 —— 分发器
// ══════════════════════════════════════════════════════════════
function renderCompare() {
  const mode = State.get().viewMode;
  if (mode === 'split')      { renderSplitCompare();  return; }
  if (mode === 'sidebyside') { renderSideBySide();    return; }
  renderProcessedOnly();
}

// ── 模式①：仅展示处理后全图（默认）─────────────────────────────
function renderProcessedOnly() {
  const s = State.get();
  if (!s.processedCanvas) return;

  // 切换容器
  $('compare-container').style.display    = '';
  $('compare-sidebyside').style.display   = 'none';
  $('compare-sidebyside').classList.remove('active');

  // 隐藏分割线元素
  $('compare-handle').style.display = 'none';
  document.querySelectorAll('.compare-label').forEach(l => l.style.display = 'none');

  const canvas = $('display-canvas');
  canvas.width  = s.processedCanvas.width;
  canvas.height = s.processedCanvas.height;
  canvas.getContext('2d').drawImage(s.processedCanvas, 0, 0);
  fitCanvas();
}

// ── 模式②：拖拽分割对比───────────────────────────────────────
function renderSplitCompare() {
  const s = State.get();
  if (!s.originalCanvas || !s.processedCanvas) return;

  // 切换容器
  $('compare-container').style.display    = '';
  $('compare-sidebyside').style.display   = 'none';
  $('compare-sidebyside').classList.remove('active');

  // 显示分割线元素
  $('compare-handle').style.display = '';
  document.querySelectorAll('.compare-label').forEach(l => l.style.display = '');

  const canvas = $('display-canvas');
  const ctx    = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const sx = Math.round(w * s.splitX);

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(s.originalCanvas,  0, 0, sx,     h,  0, 0, sx,     h);
  ctx.drawImage(s.processedCanvas, sx, 0, w - sx, h, sx, 0, w - sx, h);

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(sx - 1, 0, 2, h);
  ctx.restore();

  // 同步手柄位置
  const container = $('compare-container');
  const cw = container.clientWidth, ch = container.clientHeight;
  const ia = w / h;
  let dw, dh;
  if (cw / ch > ia) { dh = ch; dw = Math.round(ch * ia); }
  else               { dw = cw; dh = Math.round(cw / ia); }
  const ox = Math.round((cw - dw) / 2);
  const oy = Math.round((ch - dh) / 2);

  const handle = $('compare-handle');
  handle.style.left   = (ox + dw * s.splitX) + 'px';
  handle.style.top    = oy + 'px';
  handle.style.height = dh + 'px';
  handle.setAttribute('aria-valuenow', Math.round(s.splitX * 100));
}

// ── 模式③：并排对比─────────────────────────────────────────────────
function renderSideBySide() {
  const s = State.get();
  if (!s.originalCanvas || !s.processedCanvas) return;

  // 切换容器
  $('compare-container').style.display  = 'none';
  $('compare-sidebyside').style.display = 'flex';
  $('compare-sidebyside').classList.add('active');

  const container = $('compare-sidebyside');
  // 每个面板可用宽度
  const panelW = Math.floor(container.clientWidth / 2 - 1);
  const panelH = container.clientHeight;
  if (panelW < 10 || panelH < 10) return;

  const ia = s.originalCanvas.width / s.originalCanvas.height;
  let dw, dh;
  if (panelW / panelH > ia) { dh = panelH; dw = Math.round(panelH * ia); }
  else                       { dw = panelW; dh = Math.round(panelW / ia); }

  function fitSbs(canvas, src) {
    canvas.width  = src.width;
    canvas.height = src.height;
    Object.assign(canvas.style, { width: dw + 'px', height: dh + 'px' });
    canvas.getContext('2d').drawImage(src, 0, 0);
  }
  fitSbs($('canvas-orig-sbs'), s.originalCanvas);
  fitSbs($('canvas-proc-sbs'), s.processedCanvas);
}

// ═══════════════════════════════════════════════════════════════
//  比较手柄拖拽
// ═══════════════════════════════════════════════════════════════
function bindCompareHandle() {
  const handle = $('compare-handle');
  const container = $('compare-container');

  function moveTo(clientX) {
    const s = State.get();
    if (!s.srcImageData) return;
    const cw = container.clientWidth, ch = container.clientHeight;
    const ia = s.srcImageData.width / s.srcImageData.height;
    let dw;
    if (cw / ch > ia) dw = Math.round(ch * ia);
    else               dw = cw;
    const ox  = Math.round((cw - dw) / 2);
    const rect = container.getBoundingClientRect();
    const raw  = (clientX - rect.left - ox) / dw;
    State.patch('splitX', Math.max(0.02, Math.min(0.98, raw)));
    renderCompare();
  }

  handle.addEventListener('mousedown', e => {
    e.preventDefault(); State.patch('draggingHandle', true);
    const onMove = e => moveTo(e.clientX);
    const onUp   = () => { State.patch('draggingHandle', false); document.removeEventListener('mousemove', onMove); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp, { once: true });
  });

  handle.addEventListener('touchstart', e => {
    e.preventDefault(); State.patch('draggingHandle', true);
    const onMove = e => moveTo(e.touches[0].clientX);
    const onEnd  = () => { State.patch('draggingHandle', false); document.removeEventListener('touchmove', onMove); };
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd, { once: true });
  }, { passive: false });

  // 点击画布也可移动
  container.addEventListener('click', e => {
    if (!State.get().draggingHandle) moveTo(e.clientX);
  });
}

// ══════════════════════════════════════════════════════════════
//  视图模式切换
// ══════════════════════════════════════════════════════════════
function bindViewToggle() {
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.viewmode;
      State.patch('viewMode', mode);
      document.querySelectorAll('.view-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.viewmode === mode)
      );
      // 分割对比模式需要初始化 canvas 尺寸
      if (mode === 'split') {
        const s = State.get();
        const canvas = $('display-canvas');
        if (s.srcImageData) {
          canvas.width  = s.srcImageData.width;
          canvas.height = s.srcImageData.height;
          fitCanvas();
        }
      }
      renderCompare();
    });
  });
}

// ══════════════════════════════════════════════════════════════
//  时间戳样式选择
// ══════════════════════════════════════════════════════════════
function bindTimestampMode() {
  document.querySelectorAll('.ts-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const mode = pill.dataset.tsmode;
      State.patch('tsMode', mode);
      document.querySelectorAll('.ts-pill').forEach(p => {
        p.classList.toggle('active', p.dataset.tsmode === mode);
        p.setAttribute('aria-pressed', p.dataset.tsmode === mode ? 'true' : 'false');
      });
      if (State.get().srcImageData) scheduleProcess();
    });
  });
}

// ═══════════════════════════════════════════════════════════════
//  滑块
// ═══════════════════════════════════════════════════════════════
// 参数名中文映射
const PARAM_NAMES = {
  intensity: '处理强度',
  grain: '胶片颗粒',
  chroma: '色差',
  vignette: '暗角',
  bloom: '高光溢出',
  artifacts: 'JPEG压缩块',
  lightleak: '漏光强度',
  imperfections: '划痕尘点',
};

function bindSliders() {
  const pairs = [
    ['intensity',      'slider-intensity',      'val-intensity'],
    ['grain',          'slider-grain',          'val-grain'],
    ['chroma',         'slider-chroma',         'val-chroma'],
    ['vignette',       'slider-vignette',       'val-vignette'],
    ['bloom',          'slider-bloom',          'val-bloom'],
    ['artifacts',      'slider-artifacts',      'val-artifacts'],
    ['lightleak',      'slider-lightleak',      'val-lightleak'],
    ['imperfections',  'slider-imperfections',  'val-imperfections'],
  ];
  // 桌面版
  pairs.forEach(([key, sliderId, valId]) => {
    const slider = $(sliderId), valEl = $(valId);
    slider.value = State.get().params[key];
    valEl.textContent = slider.value + '%';
    updateSliderTrack(slider);
    
    slider.addEventListener('input', () => {
      const v = parseInt(slider.value);
      valEl.textContent = v + '%';
      State.get().params[key] = v;
      updateSliderTrack(slider);
      // 同步移动端滑块
      const ms = $('m-slider-' + key);
      if (ms) { ms.value = v; $('m-val-' + key).textContent = v + '%'; updateSliderTrack(ms); }
      if (State.get().srcImageData) scheduleProcess();
    });

    // 双击重置
    slider.addEventListener('dblclick', () => {
      const v = DEFAULTS[key];
      slider.value = v;
      valEl.textContent = v + '%';
      State.get().params[key] = v;
      updateSliderTrack(slider);
      // 同步移动端滑块
      const ms = $('m-slider-' + key);
      if (ms) { ms.value = v; $('m-val-' + key).textContent = v + '%'; updateSliderTrack(ms); }
      if (State.get().srcImageData) scheduleProcess();
      window.showToast(`${PARAM_NAMES[key]} 已重置`, "success");
    });
  });

  // 移动端版（同步）
  pairs.forEach(([key, , ]) => {
    const ms = $('m-slider-' + key), mv = $('m-val-' + key);
    if (!ms) return;
    ms.value = State.get().params[key];
    mv.textContent = ms.value + '%';
    updateSliderTrack(ms);
    
    ms.addEventListener('input', () => {
      const v = parseInt(ms.value);
      mv.textContent = v + '%';
      State.get().params[key] = v;
      updateSliderTrack(ms);
      // 同步桌面滑块
      const ds = $('slider-' + key);
      if (ds) { ds.value = v; $('val-' + key).textContent = v + '%'; updateSliderTrack(ds); }
      if (State.get().srcImageData) scheduleProcess();
    });

    // 双击重置
    ms.addEventListener('dblclick', () => {
      const v = DEFAULTS[key];
      ms.value = v;
      mv.textContent = v + '%';
      State.get().params[key] = v;
      updateSliderTrack(ms);
      // 同步桌面滑块
      const ds = $('slider-' + key);
      if (ds) { ds.value = v; $('val-' + key).textContent = v + '%'; updateSliderTrack(ds); }
      if (State.get().srcImageData) scheduleProcess();
      window.showToast(`${PARAM_NAMES[key]} 已重置`, "success");
    });
  });
}

function updateSliderTrack(slider) {
  const pct = ((slider.value - slider.min) / (slider.max - slider.min) * 100).toFixed(1) + '%';
  slider.style.setProperty('--pct', pct);
}

// ═══════════════════════════════════════════════════════════════
//  时间戳控制
// ═══════════════════════════════════════════════════════════════
function bindTimestamp() {
  const ck   = $('toggle-ts-chk');
  const di   = $('date-input');
  const mck  = $('m-toggle-ts');
  const mdi  = $('m-date-input');

  function syncTs(on, date) {
    State.set({ timestampOn: on, timestampDate: date });
    [di, mdi].forEach(el => el.style.opacity = on ? '1' : '0.4');
    if (State.get().srcImageData) scheduleProcess();
  }

  ck.addEventListener('change', () => { mck.checked = ck.checked; syncTs(ck.checked, di.value); });
  di.addEventListener('change', () => { mdi.value   = di.value;   syncTs(ck.checked, di.value); });
  mck.addEventListener('change', () => { ck.checked  = mck.checked; syncTs(mck.checked, mdi.value); });
  mdi.addEventListener('change', () => { di.value    = mdi.value;   syncTs(ck.checked, mdi.value); });
}

function formatDate(str) {
  const p = str.split('-');
  if (p.length !== 3) return str;
  return `'${p[0].slice(-2)} ${p[1]} ${p[2]}`;
}

// ═══════════════════════════════════════════════════════════════
//  按钮
// ═══════════════════════════════════════════════════════════════
function bindButtons() {
  $('btn-new-image').addEventListener('click', () => $('file-input').click());
  $('btn-reset-params').addEventListener('click', resetParams);
  $('btn-export-png').addEventListener('click', () => exportCurrent('png'));
  $('btn-export-jpg').addEventListener('click', () => exportCurrent('jpg'));
  $('btn-export-all').addEventListener('click', exportAll);
}

function resetParams() {
  State.get().params = { ...DEFAULTS };
  ['intensity','grain','chroma','vignette','bloom','artifacts','lightleak','imperfections'].forEach(k => {
    const sl = $('slider-' + k), vl = $('val-' + k);
    if (sl) { sl.value = DEFAULTS[k]; vl.textContent = DEFAULTS[k] + '%'; updateSliderTrack(sl); }
    const ms = $('m-slider-' + k), mv = $('m-val-' + k);
    if (ms) { ms.value = DEFAULTS[k]; mv.textContent = DEFAULTS[k] + '%'; updateSliderTrack(ms); }
  });
  if (State.get().srcImageData) processAndRender();
  window.showToast("所有参数已重置为默认值", "success");
}

function exportCurrent(fmt) {
  const { processedCanvas, imageName, filterId } = State.get();
  if (!processedCanvas) {
    window.showToast("请先上传需要处理的图片", "error");
    return;
  }
  const base = (imageName || 'photo').replace(/\.[^.]+$/, '');
  downloadCanvas(processedCanvas, `digicamfx_${base}_${filterId}.${fmt}`, fmt);
  window.showToast(`图片已成功导出 (${fmt.toUpperCase()})`, "success");
}

async function exportAll() {
  const items = State.get().batchItems;
  if (!items.length) { exportCurrent('jpg'); return; }
  const btn = $('btn-export-all');
  btn.textContent = '处理中…'; btn.disabled = true;
  window.showToast(`正在批量处理并下载 ${items.length} 张图片，请稍后...`, "info");
  for (let i = 0; i < items.length; i++) {
    await loadBatchAt(i);
    await new Promise(r => setTimeout(r, 80));
    const base = items[i].name.replace(/\.[^.]+$/, '');
    downloadCanvas(State.get().processedCanvas, `digicamfx_${base}_${State.get().filterId}.jpg`, 'jpg');
    await new Promise(r => setTimeout(r, 320));
  }
  btn.textContent = '批量下载'; btn.disabled = false;
  setStatus('批量完成');
  window.showToast(`批量下载已完成，共 ${items.length} 张图片！`, "success");
}

function downloadCanvas(canvas, name, fmt) {
  const a = document.createElement('a');
  a.download = name;
  if (fmt === 'png') {
    canvas.toBlob(blob => {
      a.href = URL.createObjectURL(blob);
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    }, 'image/png');
  } else {
    a.href = canvas.toDataURL('image/jpeg', 0.92);
    a.click();
  }
}

// ═══════════════════════════════════════════════════════════════
//  移动端控制面板
// ═══════════════════════════════════════════════════════════════
function bindMobileControls() {
  const btn    = $('mobile-controls-btn');
  const drawer = $('mobile-controls-drawer');
  const close  = $('mobile-controls-close');

  btn.addEventListener('click', () => {
    const open = drawer.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  close.addEventListener('click', () => {
    drawer.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  });
  // 点击遮罩关闭
  document.addEventListener('click', e => {
    if (drawer.classList.contains('open') &&
        !drawer.contains(e.target) && e.target !== btn) {
      drawer.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  键盘快捷键
// ═══════════════════════════════════════════════════════════════
function bindKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    // 1-7: 切换相机
    const n = parseInt(e.key);
    if (n >= 1 && n <= FILTERS.length) { selectFilter(FILTERS[n-1].id); return; }
    // ← →: 移动分割线
    if (e.key === 'ArrowLeft')  { State.patch('splitX', Math.max(0.02, State.get().splitX - 0.04)); renderCompare(); }
    if (e.key === 'ArrowRight') { State.patch('splitX', Math.min(0.98, State.get().splitX + 0.04)); renderCompare(); }
    // R: 重置
    if (e.key === 'r' || e.key === 'R') resetParams();
  });
}

// ═══════════════════════════════════════════════════════════════
//  状态显示
// ═══════════════════════════════════════════════════════════════
function setStatus(msg) {
  const green  = ['完成', '批量完成', '系统就绪'];
  const yellow = ['加载中…', '处理中…'];
  const color  = green.some(s => msg.includes(s)) ? 'green'
               : yellow.some(s => msg.includes(s)) ? 'yellow' : 'green';

  [$('topbar-status-text'), $('ctrl-status')].forEach(el => {
    if (!el) return;
    el.textContent = msg;
    el.className   = 'ctrl-info-val ' + color;
  });
  const chip = $('chip-status');
  if (!chip) return;
  chip.textContent = msg;
  chip.className   = 'toolbar-chip ' + (color === 'green' ? 'green' : color === 'yellow' ? 'yellow' : '');
}

// ═══════════════════════════════════════════════════════════════
//  PWA Service Worker
// ═══════════════════════════════════════════════════════════════
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════
//  LUT 芯片渲染
// ═══════════════════════════════════════════════════════════════
function renderLUTChips() {
  const container = $('lut-chips');
  if (!container) return;
  container.innerHTML = '';

  LUT_PRESETS.forEach(preset => {
    const chip = el('button', {
      class: 'lut-chip' + (preset.id === State.get().lutId ? ' active' : ''),
      'data-lutid': preset.id,
      role: 'option',
      'aria-selected': preset.id === State.get().lutId ? 'true' : 'false',
      title: preset.desc,
    });
    const dot  = el('span', { class: 'lut-chip-dot', style: `background:${preset.color}` });
    const info = el('div', { class: 'lut-chip-info' });
    info.append(
      el('span', { class: 'lut-chip-name' }, [preset.name]),
      el('span', { class: 'lut-chip-tag'  }, [preset.tag]),
    );
    chip.append(dot, info);
    chip.addEventListener('click', () => selectLUT(preset.id));
    container.appendChild(chip);
  });
}

// ═══════════════════════════════════════════════════════════════
//  胶片边框 & 闪光绑定
// ═══════════════════════════════════════════════════════════════
function bindFilmEffects() {
  // ── 胶片边框 pills ──────────────────────────────────────────
  document.querySelectorAll('#border-pills .ts-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const border = pill.dataset.border;
      State.patch('filmBorder', border);
      document.querySelectorAll('#border-pills .ts-pill').forEach(p => {
        p.classList.toggle('active', p.dataset.border === border);
        p.setAttribute('aria-pressed', p.dataset.border === border ? 'true' : 'false');
      });
      if (State.get().srcImageData) scheduleProcess();
    });
  });

  // ── 闪光点开关 ────────────────────────────────────────────
  const flareChk = $('toggle-flare-chk');
  if (flareChk) {
    flareChk.checked = State.get().flashFlare;
    flareChk.addEventListener('change', () => {
      State.patch('flashFlare', flareChk.checked);
      if (State.get().srcImageData) scheduleProcess();
    });
  }
}

// ═══════════════════════════════════════════════════════════════
//  LUT 选择 & 强度滑块绑定
// ═══════════════════════════════════════════════════════════════
function bindLUT() {
  // 强度滑块
  const strengthSlider = $('slider-lut-strength');
  const strengthVal    = $('val-lut-strength');
  if (strengthSlider) {
    strengthSlider.value = State.get().lutStrength;
    if (strengthVal) strengthVal.textContent = State.get().lutStrength + '%';
    updateSliderTrack(strengthSlider);
    strengthSlider.addEventListener('input', () => {
      const v = parseInt(strengthSlider.value);
      if (strengthVal) strengthVal.textContent = v + '%';
      State.patch('lutStrength', v);
      updateSliderTrack(strengthSlider);
      if (State.get().srcImageData && State.get().lutId !== 'none') scheduleProcess();
    });
  }
}

async function selectLUT(id) {
  // 更新 chip 高亮
  document.querySelectorAll('.lut-chip').forEach(c => {
    const active = c.dataset.lutid === id;
    c.classList.toggle('active', active);
    c.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  State.patch('lutId', id);

  const preset = LUT_PRESETS.find(p => p.id === id);
  if (!preset || !preset.file) {
    // 关闭 LUT
    State.set({ loadedLUT: null });
    $('lut-strength-row').style.display = 'none';
    $('lut-status').style.display       = 'none';
    if (State.get().srcImageData) scheduleProcess();
    return;
  }

  // 显示强度滑块 & 加载状态
  $('lut-strength-row').style.display = '';
  $('lut-status').style.display       = '';
  $('lut-status-dot').className       = 'lut-status-dot loading';
  $('lut-status-text').textContent    = `加载 ${preset.name}…`;

  try {
    const lut = await lutEngine.load(preset.file);
    if (lut) {
      State.patch('loadedLUT', lut);
      $('lut-status-dot').className    = 'lut-status-dot ready';
      $('lut-status-text').textContent = `${preset.name} · ${lut.size}³ LUT`;
    } else {
      throw new Error('load failed');
    }
  } catch (e) {
    State.patch('loadedLUT', null);
    $('lut-status-dot').className    = 'lut-status-dot error';
    $('lut-status-text').textContent = '加载失败，请重试';
    console.warn('[LUT]', e);
    return;
  }

  if (State.get().srcImageData) scheduleProcess();
}

// ═══════════════════════════════════════════════════════════════
//  启动
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', init);

