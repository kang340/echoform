# 资产与许可 / ASSETS & LICENSES

ECHOFORM 的一个重要设计约束是：**不依赖任何来路不明的 3D 资产、HDRI、贴图或音频采样。** 建筑、材质、粒子、示例声景与海报全部在运行时由代码生成。

本文档记录所有第三方依赖、字体与原创资产的来源和许可，便于审计与二次发布。

---

## 1. 原创资产（本项目所有）

| 资产 | 位置 | 作者 / 来源 | 许可 |
| --- | --- | --- | --- |
| 全部程序化建筑几何（拱、侧殿、柱、环、碎片、旋梯、粒子） | `src/three/` | ECHOFORM Studio，原创 | 随项目代码，MIT |
| 全部 GLSL 着色器（光核、地面、粒子、后处理调色） | `src/three/shaders.ts` | ECHOFORM Studio，原创 | 随项目代码，MIT |
| 32 秒示例声景《ÉTUDE NO. 01》 | `src/lib/demo-audio.ts` | ECHOFORM Studio，原创；运行时 PCM 合成 | 随项目代码，MIT |
| 界面、图标、版式、动效 | `src/`、`src/styles.css` | ECHOFORM Studio，原创 | 随项目代码，MIT |
| 海报模板与合成逻辑 | `src/lib/poster.ts` | ECHOFORM Studio，原创 | 随项目代码，MIT |
| 文案、建筑命名、宣传语 | `src/lib/design.ts`、`docs/PROMO.md` | ECHOFORM Studio，原创 | 品牌内容，保留权利 |
| 截图、海报、演示影像 | `media/`、`shots/` | ECHOFORM Studio，原创 | 品牌内容，保留权利 |

> 示例声景不使用任何第三方录音、采样包、循环或 AI 生成音频。它由代码中的音符、包络、脉冲与混响网络逐样本合成，因此可以随源码自由复制。

---

## 2. 运行时依赖

| 依赖 | 版本 | 用途 | 许可 | 上游 |
| --- | --- | --- | --- | --- |
| React | 19.3.1 | UI 运行时 | MIT | https://github.com/facebook/react |
| React DOM | 19.3.1 | UI 渲染 | MIT | https://github.com/facebook/react |
| Three.js | 0.186.1 | WebGL2 场景、几何、材质、后处理 | MIT | https://github.com/mrdoob/three.js |
| @fontsource/instrument-serif | 5.3.0 | 字体打包 | MIT（包） / OFL-1.1（字体） | https://fontsource.org/fonts/instrument-serif |
| @fontsource-variable/manrope | 5.3.0 | 字体打包 | MIT（包） / OFL-1.1（字体） | https://fontsource.org/fonts/manrope |

## 3. 开发依赖

| 依赖 | 版本 | 许可 | 上游 |
| --- | --- | --- | --- |
| Vite | 8.3.4 | MIT | https://github.com/vitejs/vite |
| @vitejs/plugin-react | 6.1.2 | MIT | https://github.com/vitejs/vite-plugin-react |
| TypeScript | 5.9.3 | Apache-2.0 | https://github.com/microsoft/TypeScript |
| @types/react | 19.3.0 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @types/react-dom | 19.3.0 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @types/three | 0.186.0 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped |
| playwright-core | 1.64.1 | Apache-2.0 | https://github.com/microsoft/playwright |

完整的传递依赖树与许可证文本可通过以下命令查看：

```bash
npm ls --all
# 或
npx license-checker --summary
```

发布时请保留 `node_modules` 中对应包的 `LICENSE` 文件，或在构建产物的“关于”页面附上上述清单。

---

## 4. 字体

### Instrument Serif
- 设计：Rodrigo Fuenzalida / FragType
- 许可：SIL Open Font License 1.1
- 来源：https://fonts.google.com/specimen/Instrument+Serif
- 用途：标题、建筑名称、百分比数字

### Manrope
- 设计：Mikhail Sharanda
- 许可：SIL Open Font License 1.1
- 来源：https://fonts.google.com/specimen/Manrope
- 用途：界面、标签、数据、英文小字

### 中文
本项目**不打包中文字体**。中文使用系统字体回退：

```
"Noto Serif SC", "Songti SC", "STSong", "SimSun", serif
```

这样避免分发体积巨大的 CJK 字体，也避免字体许可问题。若部署环境没有中文衬线字体，会回退到系统默认衬线体；版式仍可读。

---

## 5. 明确未使用的资产

以下内容**没有**在本项目中使用，特此说明：

- 没有第三方 HDRI / 环境贴图。
- 没有第三方 3D 模型（`.glb`、`.gltf`、`.obj`、`.fbx`）。
- 没有第三方纹理、材质扫描或 PBR 贴图。
- 没有第三方音频采样、音乐片段或循环。
- 没有第三方图标库、UI 套件或模板。
- 没有从网络抓取的建筑照片作为贴图。

场景中的“石材”“玻璃”“金属”“膜”都是程序化材质：用粗糙度、透射、清漆、渐变与噪声在着色器中构造。

---

## 6. 品牌与内容许可

- **源代码**：MIT。可自由使用、修改、分发，需保留版权声明。
- **ECHOFORM 名称、标识、文案、截图、海报与演示影像**：© 2026 ECHOFORM Studio，保留所有权利。未经书面许可，不得用于商业再发布、训练数据或品牌背书。
- 若你基于本项目做公开演示，欢迎注明 “Built with ECHOFORM”，并链接回本仓库。

---

## 7. 合规检查清单

发布前请确认：

- [ ] `package-lock.json` 已提交，依赖版本可复现。
- [ ] 保留了 React、Three.js、Vite、TypeScript、Playwright 的 LICENSE 文本（或关于页链接）。
- [ ] 字体以 `@fontsource` 打包，未单独再分发字体文件。
- [ ] 未把示例声景替换为未授权音乐。
- [ ] 未把 `media/` 中的品牌截图用于第三方商业宣传。
- [ ] 若部署在公网，麦克风功能使用 HTTPS。

---

*最后更新：2026-10-18*
