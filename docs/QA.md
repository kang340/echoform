# QA 与验收报告 / QUALITY ASSURANCE

> 验收日期：2026-10-18
> 浏览器：Google Chrome 155（真实 GPU：NVIDIA RTX 4060 Ti / D3D11）
> 自动化：Playwright-core 1.64.1
> 结论：**通过**。所有核心流程在真实浏览器中跑通，无阻断性缺陷；已修复 9 个影响体验或可信度的问题。

---

## 1. 验收范围

| 维度 | 覆盖内容 |
| --- | --- |
| 声音 → 建筑 | 低频、高频、响度、音高、停顿、乐句、确定性 |
| 生成流程 | 示例、麦克风、文件上传、分析、浇筑、重放 |
| 交互 | 风格、材质/灯光滑杆、镜头三模式、WASD、时间轴、HUD |
| 输出 | 海报 PNG、参数 JSON、分享链接、MP4、720p/1080p |
| 多端 | 1600×1000 桌面、1440p、1080p、390×844 移动、4K 压力 |
| 稳定性 | 连续运行、风格切换、重复生成、控制台错误 |

---

## 2. 测试结果

### 2.1 声音相关性（`tests/correlation.mjs`）

| 用例 | 预期 | 实际 | 结果 |
| --- | --- | --- | --- |
| 110 Hz 纯低音 | 低频占优、拱更厚 | `low = 1.0`，`archDepth = 1.62` | ✅ |
| 明亮锯齿 220 Hz | 高频柱列与粒子增加 | `brightness = 0.72`，`columns = 34`，`particles = 2963` | ✅ |
| 220 Hz 响度 0.8 | 更高更大 | `height = 30.12` | ✅ |
| 220 Hz 响度 0.2 | 更矮更小 | `height = 20.4` | ✅ |
| 4 个带停顿乐句 | 4 个乐句 / 4 座空厅 | `phrases = 4`，`chambers = 4`，`pauses = 4` | ✅ |
| 同一文件重复导入 | 指纹与几何一致 | 指纹 `65f11a3d`，全部参数逐位一致 | ✅ |
| 440 Hz / 220 Hz 音高 | 精确 | 110 / 220 / 330 Hz 均精确；220 Hz 锯齿为 220.1 Hz | ✅ |

### 2.2 核心交互（`tests/interactions.mjs`）

| 用例 | 实际 | 结果 |
| --- | --- | --- |
| 三种风格切换 | `machine / organic / crystal` 均生效，palette 独立 | ✅ |
| 材质滑杆 | `gloss 0.2`、`transmission 0.9` 写入并与材质同步 | ✅ |
| 灯光滑杆 | `key 0.3`、`warmth 0.9` 生效 | ✅ |
| 镜头切换 | `orbit → roam → guide → orbit` 均正确 | ✅ |
| 桌面 WASD 漫游 | 1.5 秒移动 **19.64 单位**，无 tween 冲突 | ✅ |
| 时间轴点击 55% | `time = 3.85 / 7`，暂停状态正确 | ✅ |
| `H` 隐藏 HUD | `.app-root.is-hud-hidden` 出现，再按恢复 | ✅ |
| 数字键切换风格 | `2` → `machine` | ✅ |
| 保存作品 | toast “作品已保存至本地展厅”，预设数 1 | ✅ |
| 加载预设 | `hasAudio = false`，风格与名称恢复 | ✅ |

### 2.3 麦克风与文件（`tests/mic-file.mjs`）

| 用例 | 实际 | 结果 |
| --- | --- | --- |
| 麦克风录制 2.6 s | 生成 3.6 s 作品；`hasAudio = true` | ✅ |
| 录制后停止并浇筑 | `phase = ready`，无错误 | ✅ |
| 上传 7 s WAV | `duration = 7`，`hasAudio = true` | ✅ |
| 本地展厅 | 保存后预设数 1 | ✅ |
| 截图 | `40-recording.png` … `43-presets.png` | ✅ |

### 2.4 导出与分享（`tests/exports-share.mjs`）

| 用例 | 实际 | 结果 |
| --- | --- | --- |
| 海报 | PNG，**2560×1440**，5.6 MB，magic `89504e47` | ✅ |
| 参数文件 | `echoform.design.v1`，style / name / source 正确 | ✅ |
| 分享链接 | 1.8 KB，打开后 `phase = ready`，`hasAudio = false`，指纹一致 | ✅ |
| 7 s 影像 | **MP4 / H.264 + AAC**，1600×1000，7.2 s，9.4 MB | ✅ |
| 32 s 演示影像 | **MP4 / H.264 + AAC**，1280×720，31.94 s，4.3 MB | ✅ |
| 画廊截图 | `44-share.png`、`45-shared.png`、`46-video-modal.png` | ✅ |

### 2.5 移动端（`tests/mobile.mjs`）

| 用例 | 实际 | 结果 |
| --- | --- | --- |
| 390×844 首屏 | 无横向滚动，标题 33 px，中文 11 px | ✅ |
| 底部把手打开面板 | 面板 1.0 s 内到位：`y = 270`，`574 px` 高 | ✅ |
| 面板不遮死建筑 | 顶部 270 px 仍可见建筑 / 可操作 | ✅ |
| 移动镜头按钮 | `orbit → roam → guide` 循环 | ✅ |
| 摇杆输入 | `[0.786, 0.476]`，`roam-pad is-active`，相机移动 | ✅ |
| 触摸拖动 | 单指旋转正常 | ✅ |
| 字体/标签 | 风格 9.5 px，滑杆标签 10 px，面板标签 9.5 px | ✅ |

### 2.6 性能（`tests/performance.mjs`）

| 场景 | 平均 FPS | p95 | 结果 |
| --- | --- | --- | --- |
| 1440×900 DPR 1 | 222.0 | 8.3 ms | ✅ |
| 1920×1080 DPR 1 | 220.4 | 8.4 ms | ✅ |
| 1280×800 DPR 2 | 233.0 | 4.3 ms | ✅ |
| 390×844 DPR 1.6 | 235.7 | 4.3 ms | ✅ |
| 2560×1440 DPR 2 | 65.3 | 45.9 ms | ✅ 可交互 |
| 3840×2160 DPR 2 | 5.1 | 750 ms | ⚠️ 极端压力，自适应降至 1.5 |

### 2.7 渲染与视觉检查

| 检查 | 结果 |
| --- | --- |
| 主截图平均亮度 | 03-ready 50.3 / 100；hero 49–80；无死黑 |
| 高光裁切 | 无 >250 的整片死白；p99 210–242 |
| 移动面板文字 | 标题峰值 RGB(239,233,220)，可读 |
| 控制台 | 无 `PAGEERROR`；仅有驱动 `X4122` 精度 warning |
| WebGL context | 连续 10 分钟无 lost |

---

## 3. 缺陷记录（已修复）

| # | 现象 | 根因 | 修复 | 验证 |
| --- | --- | --- | --- | --- |
| 1 | 移动端整个界面左移 47 px、上移 70 px，面板被裁切 | `.app-root` 使用 `overflow: hidden`，成为可滚动容器，聚焦按钮时浏览器把内部滚动到 47/70 | 改为 `overflow: clip`，禁止程序化滚动 | 面板 x=0、y=270 |
| 2 | 高性能设备 DPR 被误降到 1.5 / 1.1 | 启动/分析长帧被计入慢帧累计 | 忽略 >400 ms 的停顿，`setDesign`/`setPhase` 重置累计 | 2× 与移动恢复 2.0 / 1.6 |
| 3 | 示例偶尔永久停在“合成示例声景” | `OfflineAudioContext` 在音频服务忙时 `startRendering` 不返回 | 改为直接 PCM 加法合成 + 缓存，不依赖音频服务 | 冷启动 8–24 s，热启动 8–10 s，均可完成 |
| 4 | 110 Hz 被识别为 117 Hz | 2048 FFT 的 bin 偏置 | 峰值插值 + 未加窗自相关，在候选 ±18% 内细化 | 110/220/330 精确 |
| 5 | 连续音被伪造出 3 个乐句 | 设计层用固定 `safePhrases` 兜底 | 优先使用 `score.phrases`，仅空结果回退 | 1 phrase / 0 pause |
| 6 | 漫游模式切换后镜头被 tween 拉回 | `setDesign` 的相机 tween 覆盖漫游 | 切换模式清空 tween；`setDesign` 先设 orbit 再 tween | WASD 移动 19.6 单位 |
| 7 | 移动端无法切到漫游 | `.camera-switch` 在 ≤1060 px 隐藏 | 增加 `.camera-cycle` 循环按钮 | guide/roam/orbit 可达 |
| 8 | 分析页数字长时间停在 02% | 合成阶段无进度回调 | 平滑推进合成进度；分析阶段改为 24%→94% | 视觉连续 |
| 9 | 中文标题与乐句数矛盾（“三次呼吸”却有 5 段） | 标题池含固定数字 | 改为“缓息的光环”等非计数标题 | 文案与数据一致 |

---

## 4. 未解决 / 已知限制

| 项 | 说明 | 影响 |
| --- | --- | --- |
| 4K + DPR 2 | 33 MP，5 FPS；自适应仅降一次到 1.5 | 极端场景；建议 1440p 或均衡质量 |
| Firefox MP4 | Firefox 一般只支持 WebM，依赖系统编码器 | 会自动回退 WebM，界面显示实际格式 |
| iOS Safari 录音 | 需要用户手势与 HTTPS；部分旧版对 `MediaRecorder` 支持有限 | 录音失败时引导上传文件 |
| 分享链接长度 | 参数编码后 1.5–3 KB | 个别聊天软件会截断；提供复制按钮 |
| 长视频导出 | 45 s 上限；导出期间需保持前台 | 后台标签会被降频 |
| 中文字体 | 不打包 CJK 字体，依赖系统宋体/Noto | 不同系统字形略有差异 |

---

## 5. 验收清单

- [x] 黑色展厅 + 呼吸光核的序幕
- [x] 说话 / 唱歌 / 上传 / 示例四种入口
- [x] 音高、响度、频谱、节奏、停顿、音色的真实映射
- [x] 三种完整艺术风格
- [x] 轨道 / 漫游 / 导览三种镜头
- [x] 材质与灯光实时调节
- [x] 时间轴同步与重放
- [x] 海报、MP4、参数、分享、存档
- [x] 移动端布局、触摸、摇杆
- [x] 真实浏览器 + 真实 GPU 的自动化验收
- [x] 性能报告与压力测试
- [x] 资产许可清单
- [x] 运行 / 部署文档
- [x] 宣传文案与 GitHub README

---

## 6. 截图索引

| 文件 | 内容 |
| --- | --- |
| `media/screenshots/intro.png` | 序幕与光核 |
| `media/screenshots/analysis.png` | 声纹分析剖面 |
| `media/screenshots/ready.png` | 建成后的中殿 |
| `media/screenshots/hero-crystal.png` | 水晶圣殿 |
| `media/screenshots/hero-machine.png` | 未来机械 |
| `media/screenshots/hero-organic.png` | 流体有机 |
| `media/screenshots/roam.png` | 隐藏 HUD 的第一人称漫游 |
| `media/screenshots/recording.png` | 麦克风录制 |
| `media/screenshots/mic.png` | 麦克风生成 |
| `media/screenshots/file.png` | 文件导入生成 |
| `media/screenshots/share.png` | 分享面板 |
| `media/screenshots/video.png` | 影像导出结果 |
| `media/screenshots/mobile-*.png` | 移动端四态 |
| `media/screenshots/poster.png` | 2560×1440 海报 |
| `media/ECHOFORM-demo.mp4` | 32 秒演示影像 |

---

*QA 由 ECHOFORM Studio 执行；原始 JSON 位于 `tests/artifacts/`。*
