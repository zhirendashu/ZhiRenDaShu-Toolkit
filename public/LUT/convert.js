/**
 * ZhiRenDaShu Toolkit - LUT & XMP 智能转换脚本
 * 运行方式: node LUT/convert.js
 * 作用: 扫描 LUT 文件夹下的 .cube 3D 滤镜与 Lightroom .xmp 预设，自动输出为 CCD 模拟器可以直接载入的 JS 格式
 */

const fs = require('fs');
const path = require('path');

const lutDir = __dirname;
const outputJSPath = path.join(lutDir, 'lut_data.js');

console.log('🚀 开始扫描 LUT 目录下的预设文件...');

const presets = [];

try {
  const files = fs.readdirSync(lutDir);
  
  files.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    const filePath = path.join(lutDir, file);
    const filterId = 'custom_' + path.basename(file, ext).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const filterName = path.basename(file, ext);

    if (ext === '.cube') {
      console.log(`[CUBE] 发现 3D LUT 文件: ${file} -> 解析中...`);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = parseCube(content);
        if (parsed) {
          // Convert float array to Base64 of Uint8 bytes (0..255)
          const bytes = Buffer.alloc(parsed.data.length);
          for (let i = 0; i < parsed.data.length; i++) {
            bytes[i] = Math.min(255, Math.max(0, Math.round(parsed.data[i] * 255)));
          }
          const base64Data = bytes.toString('base64');

          presets.push({
            id: filterId,
            name: filterName,
            type: 'cube',
            size: parsed.size,
            data: base64Data
          });
          console.log(`  └─ 解析成功! 3D 尺寸: ${parsed.size}x${parsed.size}x${parsed.size} (已压缩为 Base64)`);
        }
      } catch (err) {
        console.error(`  ❌ 解析 CUBE 失败: ${file}`, err.message);
      }
    } else if (ext === '.xmp') {
      console.log(`[XMP] 发现 Lightroom 预设: ${file} -> 解析中...`);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = parseXmp(content);
        if (parsed) {
          presets.push({
            id: filterId,
            name: filterName,
            type: 'xmp',
            params: parsed
          });
          console.log(`  └─ 解析成功! 提取 Lightroom 参数数: ${Object.keys(parsed).length}`);
        }
      } catch (err) {
        console.error(`  ❌ 解析 XMP 失败: ${file}`, err.message);
      }
    }
  });

  // 输出 JS 文件
  const outputJS = `// 自动生成的自定义 3D LUT & XMP 预设数据。不需要手动修改。
window.CUSTOM_PRESETS = ${JSON.stringify(presets, null, 2)};
`;
  fs.writeFileSync(outputJSPath, outputJS, 'utf-8');
  console.log(`\n✅ 转换完成! 成功输出预设集合到: ${outputJSPath}`);
  console.log('💡 刷新网页数码胶片 CCD 模拟器，新滤镜将自动加载到相机列表中。');

} catch (err) {
  console.error('❌ 执行失败:', err);
}

// ── CUBE 3D LUT 解析算法 ───────────────────────────────────────
function parseCube(text) {
  const lines = text.split(/\r?\n/);
  let size = 0;
  const data = [];

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;

    const parts = line.split(/\s+/);
    if (parts[0] === 'LUT_3D_SIZE') {
      size = parseInt(parts[1], 10);
      continue;
    }
    // 忽略其他配置关键字如 TITLE, DOMAIN_MIN/MAX
    if (isNaN(parseFloat(parts[0]))) continue;

    if (parts.length >= 3) {
      const r = parseFloat(parts[0]);
      const g = parseFloat(parts[1]);
      const b = parseFloat(parts[2]);
      data.push(r, g, b);
    }
  }

  if (size === 0 || data.length !== size * size * size * 3) {
    throw new Error(`数据点数量不匹配。预期 ${size * size * size * 3} 个值，实际得到 ${data.length} 个值。`);
  }

  return { size, data };
}

// ── XMP Lightroom 预设解析算法 ───────────────────────────────────────
function parseXmp(xmlText) {
  const params = {};

  const getAttr = (name) => {
    // 匹配 crs:Attribute="Value"
    const regex = new RegExp(`crs:${name}="([^"]+)"`, 'i');
    const match = xmlText.match(regex);
    if (match) return match[1];

    // 匹配 <crs:Attribute>Value</crs:Attribute>
    const tagRegex = new RegExp(`<crs:${name}>([^<]+)</crs:${name}>`, 'i');
    const tagMatch = xmlText.match(tagRegex);
    if (tagMatch) return tagMatch[1];

    return null;
  };

  // 提取经典调色滑块，并映射为我们 CCD 模拟器 params 兼容数值
  const exposure = parseFloat(getAttr('Exposure2012') || '0');
  const contrast = parseFloat(getAttr('Contrast2012') || '0');
  const saturation = parseFloat(getAttr('Saturation') || '0');
  const vibrance = parseFloat(getAttr('Vibrance') || '0');
  const temp = parseFloat(getAttr('Temperature') || '0');
  const tint = parseFloat(getAttr('Tint') || '0');
  const shadows = parseFloat(getAttr('Shadows2012') || '0');
  const highlights = parseFloat(getAttr('Highlights2012') || '0');

  // HSL、色彩微调提取 (简版映射)
  const shadowTintB = parseFloat(getAttr('ShadowTint') || '0'); // 阴影色彩倾斜色相

  // 转换算法：映射到 CCD 模拟器的参数基准
  // 1. 亮度 (brightness): -100 ~ 100 映射到 -15 ~ 15
  params.brightness = Math.round(exposure * 12);
  
  // 2. 对比度 (contrast): -100 ~ 100 -> 1.0 + (contrast/100)*0.5
  params.contrast = Math.round((1 + (contrast / 100) * 0.45) * 100) / 100;
  
  // 3. 饱和度 (saturation): -100 ~ 100 -> 1.0 + (sat + vib/2)/100 * 0.6
  const satScale = (saturation + vibrance * 0.5) / 100;
  params.saturation = Math.round((1 + satScale * 0.5) * 100) / 100;

  // 4. 色温 (warmth): -100 ~ 100 -> -20 ~ 20
  // Lightroom XMP 的 Temperature 通常是绝对开尔文色温差或 -100~100 相对值
  const tempVal = temp > 2000 ? (temp - 5500) / 150 : temp; // 如果是绝对色温则折算
  params.warmth = Math.round(Math.min(25, Math.max(-25, tempVal * 0.25)));

  // 5. 色调 (tint): -15 ~ 15
  params.tint = Math.round(Math.min(15, Math.max(-15, tint * 0.2)));

  // 6. 阴影调色 & 高光调色 (Split Toning 映射)
  // XMP Split Toning 包含 HighlightHue, HighlightSaturation, ShadowHue, ShadowSaturation
  const hiHue = parseFloat(getAttr('SplitToningHighlightHue') || '0');
  const hiSat = parseFloat(getAttr('SplitToningHighlightSaturation') || '0');
  const shHue = parseFloat(getAttr('SplitToningShadowHue') || '0');
  const shSat = parseFloat(getAttr('SplitToningShadowSaturation') || '0');

  const shadowRGB = hslToRgb(shHue, shSat / 100);
  const highlightRGB = hslToRgb(hiHue, hiSat / 100);

  // 映射到 shadowTint / highlightTint
  // 我们的强度范围大概在 -30 ~ 30
  params.shadowTint = {
    r: Math.round((shadowRGB.r - 128) * 0.2),
    g: Math.round((shadowRGB.g - 128) * 0.2),
    b: Math.round((shadowRGB.b - 128) * 0.2)
  };
  
  params.highlightTint = {
    r: Math.round((highlightRGB.r - 128) * 0.2),
    g: Math.round((highlightRGB.g - 128) * 0.2),
    b: Math.round((highlightRGB.b - 128) * 0.2)
  };

  // 默认加入少许噪点和暗角作为胶片底味
  params.baseNoise = 20;
  params.baseChromaticAberration = 2.0;
  params.baseVignette = 0.4;
  params.baseBloom = 0.3;
  params.bloomThreshold = 200;
  params.baseJpegArtifacts = 0.5;
  params.baseLightLeak = 0.2;
  params.baseImperfections = 0.15;
  params.baseFlashFlare = 0;
  params.flashFlarePos = 'topright';

  return params;
}

// 辅助色相转换函数
function hslToRgb(h, s) {
  // 我们假定亮度 L 为 0.5 来还原 RGB
  h = h % 360;
  const c = (1 - Math.abs(2 * 0.5 - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = 0.5 - c / 2;
  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else if (300 <= h && h < 360) { r = c; g = 0; b = x; }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}
