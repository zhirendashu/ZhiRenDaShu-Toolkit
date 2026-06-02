<div align="center">

# 🌳 ZhiRenDaShu Toolkit

**植人大树自媒体便捷工具集**

*专为内容创作者设计的纯离线、零依赖图像处理套件*

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Tools](https://img.shields.io/badge/Tools-11%20款-6366f1.svg)](#工具清单)
[![Offline](https://img.shields.io/badge/离线运行-100%25-10b981.svg)](#)
[![No Install](https://img.shields.io/badge/零安装-浏览器直开-f59e0b.svg)](#快速开始)

[🏠 作者主页](https://link3.cc/zhirendashu) · [🐛 反馈 Bug](https://link3.cc/zhirendashu) · [☕ 支持创作者](https://link3.cc/zhirendashu)

---

![ZhiRenDaShu Toolkit Preview](https://img.shields.io/badge/双击_index.html_即可启动-05070a?style=for-the-badge&logo=html5&logoColor=6366f1)

</div>

## ✨ 项目特点

- 🔒 **完全离线** — 所有处理在本地浏览器完成，图片数据不上传任何服务器
- 📦 **零安装** — 无需 Node.js / Python / 任何运行环境，双击 HTML 直接使用
- 🎨 **专业级输出** — 支持高清 4K 导出、透明背景 PNG、视频生成
- 📱 **全平台适配** — 内置小红书 / 抖音 / B站 / 微博等主流平台尺寸预设
- 🆓 **永久免费** — 无广告、无会员、无水印限制

---

## 🗂️ 工具清单

### 🖼️ 原生视觉与排版套件

| 工具 | 文件 | 核心功能 |
|------|------|----------|
| **小红书拼图大师** | `小红书拼图工具.html` | 宫格 / 长卷 / 相框 / 斜切四种排版，支持拖拽调整构图 |
| **封面比例转换工具** | `封面比例转换工具.html` | 16:9 ↔ 3:4 一键转换，模糊填充不留黑边，内置水印体系 |
| **封面精修大师** | `封面精修大师.html` | 自由添加文字与贴图，透明背景叠加色块引导语排版 |
| **图片切分神器** | `图片切分神器.html` | 九宫格信息流切割 + 斜切透明 PNG 导出 |
| **前后对比展示工具** | `前后对比展示工具.html` | Before/After 三向对比 + 自动演示视频生成（自适应竖屏） |
| **截图套壳美化大师** | `截图套壳美化大师.html` | macOS 窗口套壳 + 9款渐变背景 + 阴影发光精控 |
| **时髦加湿器** | `时髦加湿器.html` | 透明矢量 SVG 与图形混编阵列排版生成引擎 |

### 🤖 AI 物理工作站矩阵

| 工具 | 文件 | 核心功能 |
|------|------|----------|
| **AI 摄影创作中枢** | `AI摄影创作工作台.html` | 直连 AI 大模型，内置爆款文案 / 拍摄脚本 / 小红书热词提取 |
| **AI 全能水印修复** | `Gemini水印修复.html` | 反向混合算法物理级清除 Gemini 水印，100% 还原画面细节 |

### 🎨 专业美学色彩实验室

| 工具 | 文件 | 核心功能 |
|------|------|----------|
| **影视字幕配色库** | `顶级字幕配色直提库.html` | 外扩张渲染引擎，字芯与边框解耦，适配剪映等剪辑软件 |
| **Gruvbox 胶片暗房** | `Gruvbox复古胶片色库.html` | 好莱坞经典底色，大地色系完整色谱 |
| **Catppuccin 冰粉静室** | `Catppuccin色彩工作室.html` | 柔和护眼冷峻粉彩，自动生成自媒体微光清冷排版 |
| **Nippon 东方雅韵** | `NipponColors东方传统色库.html` | 28 款东方传统色谱，国风海报顶级配色参考 |

---

## 🚀 快速开始

### 方法一：本地直接使用（推荐新手）

```
1. 下载本仓库（Download ZIP 或 git clone）
2. 解压后，双击 index.html
3. 浏览器自动打开门户页，点击任意工具即可使用
```

> ⚠️ 推荐使用 **Chrome / Edge** 浏览器以获得最佳体验

### 方法二：部署到 Cloudflare Pages（推荐分享给团队）

```bash
1. 登录 https://dash.cloudflare.com
2. Workers & Pages → Create application → Pages → Upload Assets
3. 将本文件夹拖入上传区，点击 Deploy
4. 可选：绑定自定义域名，生成永久在线链接
```

### 方法三：git clone

```bash
git clone https://github.com/zhirendashu/ZhiRenDaShu-Toolkit.git
cd ZhiRenDaShu-Toolkit
# 双击 index.html 或用 Live Server 打开
```

---

## 🔄 推荐工作流

```
📸 原始素材
    ↓
小红书拼图大师   →   多图合并为一张
    ↓
封面比例转换工具  →   适配各平台尺寸
    ↓
封面精修大师     →   文字贴图最终润色
    ↓
前后对比展示工具  →   生成 Before/After 对比视频
    ↓
🎉 发布！
```

---

## 📁 目录结构

```
ZhiRenDaShu-Toolkit/
├── index.html                    # 🏠 门户首页（入口）
│
├── 小红书拼图工具.html             # 拼图排版
├── 封面比例转换工具.html            # 比例转换
├── 封面精修大师.html               # 精修加字
├── 图片切分神器.html               # 图片切割
├── 前后对比展示工具.html            # Before/After 对比
├── 截图套壳美化大师.html            # 截图美化
├── 时髦加湿器.html                 # 阵列图形生成
│
├── AI摄影创作工作台.html            # AI 创作助手
├── Gemini水印修复.html             # AI 水印清除
│
├── 顶级字幕配色直提库.html           # 字幕配色
├── Gruvbox复古胶片色库.html         # 复古色库
├── Catppuccin色彩工作室.html        # 冷色调色库
├── NipponColors东方传统色库.html     # 东方色库
│
├── catppuccin-data.js            # Catppuccin 色彩数据
├── gemini-alpha-maps.js          # Gemini 透明度映射数据
└── README.md                     # 本文件
```

---

## 🛡️ 隐私声明

本工具集**不收集任何数据**：
- ✅ 所有图片处理均在本地浏览器内存中完成
- ✅ 无服务器端代码，无任何网络请求（AI 工具除外，需用户自行配置 API Key）
- ✅ 关闭标签页即销毁所有数据

---

## 📄 开源协议

本项目基于 **[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)** 协议开源。

- ✅ 允许个人使用、学习、二次修改
- ✅ 允许分享，但须注明原作者
- ❌ 禁止用于任何商业目的
- ❌ 禁止去除作者署名后再分发

---

<div align="center">

**Made with ❤️ by [植人大树](https://link3.cc/zhirendashu)**

*如果这套工具对你有帮助，欢迎 ⭐ Star 支持，或者去作者主页请他喝杯咖啡 ☕*

</div>
