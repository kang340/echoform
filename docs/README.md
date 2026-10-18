# 文档索引 / DOCS

| 文档 | 内容 | 适合谁 |
| --- | --- | --- |
| [../README.md](../README.md) | 产品介绍、体验、技术栈、快速开始 | 所有人 |
| [RUNBOOK.md](RUNBOOK.md) | 本地运行、构建、部署、故障排查 | 开发者 / 运维 |
| [ASSETS_LICENSES.md](ASSETS_LICENSES.md) | 原创资产、依赖、字体、许可 | 法务 / 发布者 |
| [PERFORMANCE.md](PERFORMANCE.md) | 帧率、压力测试、自适应、瓶颈 | 工程 / 性能 |
| [QA.md](QA.md) | 验收矩阵、缺陷记录、已知限制 | 产品 / QA |
| [PROMO.md](PROMO.md) | 中英文宣传文案、脚本、提案 | 市场 / 内容 |
| [DESIGN_NOTES.md](DESIGN_NOTES.md) | 声音→建筑映射与视觉系统 | 设计 / 评审 |

## 快速命令

```bash
npm run dev          # 本地开发
npm run build        # 生产构建
npm run preview      # 预览构建
npm run test:analysis
npm run test:interactions
npm run test:capture
npm run test:sharing
npm run test:mobile
npm run test:perf
npm run film         # 生成 32 秒演示影像与海报
```

## 关键文件

- `src/lib/design.ts`：声音 → `DesignSpec` 的核心映射。
- `src/lib/analysis.ts`：FFT、音高、乐句与指纹。
- `src/three/engine.ts`：场景、材质、灯光、相机与性能自适应。
- `src/lib/demo-audio.ts`：原创示例声景（PCM 合成）。
- `tests/`：真实 Chrome 验收脚本。
- `media/`：最终海报、影像与精选截图。
