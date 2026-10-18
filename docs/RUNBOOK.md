# ECHOFORM 运行与部署手册 / RUNBOOK

本文档面向第一次接触仓库的开发者、设计师与运维同学。目标是：**在 10 分钟内本地跑起来，在 30 分钟内上线。**

---

## 1. 环境要求

| 项目 | 最低 | 推荐 |
| --- | --- | --- |
| Node.js | 22.18 | 24 LTS |
| 包管理器 | npm 10 | npm 10 |
| 浏览器 | Chrome / Edge 120+，Safari 16.4+，Firefox 121+ | Chrome / Edge 最新版 |
| GPU | 支持 WebGL2，1 GB 显存 | 独立显卡或 Apple Silicon |
| 麦克风 | 可选 | 有，用于“开始说话” |
| 系统 | Windows / macOS / Linux | 任意 |

> 没有麦克风也能完整使用：上传音频或点击“聆听示例”。

---

## 2. 本地开发

```bash
cd ECHOFORM
npm ci
npm run dev
```

打开 **http://127.0.0.1:5178/**。

开发服务器固定端口 `5178`，`strictPort: true`。如果端口被占用，先结束占用进程：

```bash
# Windows PowerShell
Get-NetTCPConnection -LocalPort 5178 | Select-Object OwningProcess
Stop-Process -Id <PID>

# macOS / Linux
lsof -i :5178
kill <PID>
```

### 首次加载慢？

- 首次会编译 Three.js 与着色器，约 1–3 秒。
- 点击“聆听示例”后，示例声景在本地合成（约 1–3 秒），随后进入分析。
- 真实 GPU 上建筑生成后应稳定在 60 FPS 以上；若低于 30 FPS，检查是否误用了软件渲染。

---

## 3. 生产构建

```bash
npm run build
npm run preview
```

- `npm run build` = `tsc -b && vite build --configLoader native`，产物在 `dist/`。
- `npm run preview` 默认 **http://127.0.0.1:4178/**。
- Vite 8 在某些 Windows 环境仍可能因子进程 `EPERM` 失败，此时直接执行：

```bash
npx tsc -b
npx vite build --configLoader native
npx vite preview --configLoader native --port 4178
```

`vite.config.ts` 已设置 `base: './'`，因此 `dist/` 可以放在任意子路径（GitHub Pages、对象存储、CDN）。

### 构建产物

```
dist/
  index.html
  assets/
    index-*.js
    three-*.js
    index-*.css
    *.woff2
  favicon.svg
```

没有后端、没有 API、没有数据库。

---

## 4. 部署

### 4.1 Vercel

1. 导入仓库。
2. Framework Preset：**Vite**。
3. Build Command：`npm run build`。
4. Output Directory：`dist`。
5. Node.js Version：24。
6. 部署后打开域名，允许麦克风。推荐 Node.js 24 LTS；最低版本为 22.18。

### 4.2 Netlify

`netlify.toml`：

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

### 4.3 Cloudflare Pages

- Build command：`npm run build`
- Build output directory：`dist`
- Node version：24

### 4.4 GitHub Pages

```bash
# Settings → Pages → Source 选择 GitHub Actions
git push origin main
```

工作流自动构建、执行异常路径回归测试并部署 `dist/`。PR 只运行验证，不发布。

因为 `base: './'`，不需要修改仓库名路径。若使用自定义 404，请把 `index.html` 复制为 `404.html`。

### 4.5 Nginx（自托管）

```nginx
server {
  listen 443 ssl http2;
  server_name echoform.example.com;

  ssl_certificate     /etc/letsencrypt/live/echoform.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/echoform.example.com/privkey.pem;

  root /var/www/echoform/dist;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location ~* \.(js|css|woff2|png|jpg|svg|mp4)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
  }

  add_header X-Content-Type-Options "nosniff";
  add_header Referrer-Policy "strict-origin-when-cross-origin";
}
```

**麦克风必须 HTTPS**（`localhost` 例外）。如果通过反向代理，确保 `Permissions-Policy: microphone=(self)` 没有被禁用。

### 4.6 Docker

```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

`nginx.conf` 使用 4.5 的 `try_files` 配置即可。

---

## 5. 环境变量

本项目**不需要**环境变量。没有 API key、没有服务端地址。

可选（仅用于自定义部署脚本）：

| 变量 | 作用 |
| --- | --- |
| `PORT` | `vite preview` 端口（默认 4178） |
| `BASE_PATH` | 如需部署到非相对路径，修改 `vite.config.ts` 的 `base` |

---

## 6. 浏览器与设备支持

| 功能 | Chrome | Edge | Safari | Firefox |
| --- | --- | --- | --- | --- |
| WebGL2 建筑 | ✅ | ✅ | ✅ | ✅ |
| 麦克风录音 | ✅ | ✅ | ✅（需用户手势） | ✅ |
| MP4 导出 | ✅ H.264 | ✅ | ✅（H.264，系统编码器） | ⚠️ 多为 WebM 回退 |
| WebM 导出 | ✅ | ✅ | ✅ | ✅ |
| 分享链接 | ✅ | ✅ | ✅ | ✅ |
| 移动端摇杆 | ✅ | ✅ | ✅ | ✅ |

导出的容器由浏览器能力决定：

- Chrome / Edge / Safari 新版：优先 `video/mp4;codecs=avc1.42E01E,mp4a.40.2`。
- Firefox：回退 `video/webm;codecs=vp9,opus`。
- 文件名与 MIME 由实际录制结果决定；界面会显示当前格式。

---

## 7. 常见问题

### 7.1 麦克风没有反应

- 地址必须是 `https://` 或 `http://localhost`。
- 浏览器地址栏的麦克风图标是否被阻止。
- 系统隐私设置是否允许浏览器使用麦克风。
- 其他会议软件是否独占了麦克风。
- 仍然失败时，使用“上传音频”。

### 7.2 点击示例后一直停在“合成示例声景”

- 旧版本使用 `OfflineAudioContext`，在音频服务繁忙时可能挂起；当前版本已改为 PCM 直接合成，不应再出现。
- 若仍出现，打开 DevTools Console 查看是否有 `PAGEERROR`，并提 issue 附上浏览器版本与 GPU。
- 临时方案：刷新页面，或上传任意音频。

### 7.3 画面很暗 / 过曝

- 按 `L` 打开灯光面板（或在控制室切到“光”）。
- 调整“曝光”“辉光”“主光”。
- 不同显示器 HDR / 色彩配置会显著影响观感；截图以 sRGB 为准。

### 7.4 没有声音

- 浏览器自动播放策略要求用户手势；点击示例或上传后才会播放。
- 检查左下角音量图标是否静音。
- 导出影像时音频轨来自 Web Audio，若系统静音，影像仍会包含音频。

### 7.5 导出视频失败

- 确认浏览器支持 `MediaRecorder` 与所选编码器。
- Safari 对 MP4 录制支持有限，会自动回退 WebM。
- 录制期间不要切换标签页；后台标签会被浏览器降频，导致丢帧。
- 若长时间无响应，降低窗口尺寸（1080p → 720p）后重试。

### 7.6 分享链接打不开

- 新分享链接把设计参数编码在 URL hash 中，不依赖后端，参数不随 HTTP 请求发送到托管服务；旧版 `?b=` 链接仍可读取。
- 链接很长是正常的（约 1.5–3 KB）。
- 某些聊天软件会截断长链接；建议使用“复制链接”按钮。
- 打开后没有音频是预期行为：参数不包含音频。

### 7.7 移动端面板挡住建筑

- 点击面板顶部把手或下滑关闭。
- 面板打开时仍可操作背后场景的顶部区域；关闭后恢复全屏漫游。
- 横屏体验更接近“建筑展厅”，竖屏更适合单手操作。

---

## 8. 可访问性

- 所有图标按钮都有 `aria-label`。
- 面板使用 `role="tablist"` / `role="tab"`，支持键盘焦点。
- `H` 隐藏界面后，右下角保留 `H` 按钮恢复。
- 尊重 `prefers-reduced-motion`：降低镜头缓动与粒子速度（见 `styles.css`）。
- 颜色对比以深色背景上的暖白为主；关键操作不使用纯颜色作为唯一提示。

---

## 9. 监控与日志

本项目没有服务端日志。若需要产品分析，建议只在**用户同意**后接入隐私友好的页面统计（如 Plausible），不要上传音频或设计参数。

浏览器端错误会显示为 toast；开发时可在 Console 查看 `PAGEERROR`。

---

## 10. 发布检查清单

- [ ] `npm ci && npm run build` 通过。
- [ ] `npm run preview` 下完整走通：示例 → 漫游 → 海报 → 影像 → 分享。
- [ ] 手机真机（iOS Safari / Android Chrome）测试麦克风与摇杆。
- [ ] HTTPS 已启用。
- [ ] `docs/ASSETS_LICENSES.md` 与 `LICENSE` 已随仓库发布。
- [ ] 示例声景与截图未被替换为未授权素材。
- [ ] 404 回退与静态资源缓存正确。
- [ ] 分享链接在无痕窗口可打开。

---

*最后更新：2026-10-18*
