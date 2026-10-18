import { baseUrl, projectPath, launchOptions } from './config.mjs';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  ...launchOptions,
  headless: true,
  args: [],
});

const measure = (page, ms) => page.evaluate((duration) => new Promise((resolve) => {
  const frames = [];
  let last = performance.now();
  const start = last;
  const tick = (now) => {
    frames.push(now - last);
    last = now;
    if (now - start < duration) requestAnimationFrame(tick);
    else {
      const sorted = [...frames].sort((a, b) => a - b);
      const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
      resolve({
        frames: frames.length,
        seconds: +((now - start) / 1000).toFixed(2),
        fps: +(frames.length / ((now - start) / 1000)).toFixed(1),
        p50: +at(0.5).toFixed(1),
        p95: +at(0.95).toFixed(1),
      });
    }
  };
  requestAnimationFrame(tick);
}), ms);

async function scenario(name, viewport, scale, options = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: scale, isMobile: options.mobile ?? false, hasTouch: options.mobile ?? false });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (options.quality) {
    await page.addInitScript((quality) => {
      localStorage.setItem('echoform.preferences.v1', JSON.stringify({ quality }));
    }, options.quality);
  }
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: /聆听示例/ }).click();
  await page.waitForFunction(() => window.__ECHOFORM__?.getState().phase === 'ready', null, { timeout: 120000 });
  await page.waitForTimeout(1600);
  const before = await page.evaluate(() => {
    const s = window.__ECHOFORM__.getState();
    const gl = window.__ECHOFORM__.engine.renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { dpr: s.stats?.dpr, quality: s.settings.quality, drawCalls: s.stats?.drawCalls, triangles: s.stats?.triangles, analysisMs: s.score?.analysisMs, duration: s.score?.duration, renderer: gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) };
  });
  const sample = await measure(page, 5000);
  await page.waitForTimeout(3500);
  const after = await page.evaluate(() => {
    const s = window.__ECHOFORM__.getState();
    return { dpr: s.stats?.dpr, drawCalls: s.stats?.drawCalls, triangles: s.stats?.triangles, fpsSample: s.stats?.fps, camera: s.cameraMode };
  });
  await context.close();
  return { name, viewport, scale, ...before, sample, after, errors };
}

const results = [];
results.push(await scenario('desktop-1440p-1x', { width: 1440, height: 900 }, 1));
results.push(await scenario('desktop-1080p-1x', { width: 1920, height: 1080 }, 1));
results.push(await scenario('desktop-1280-2x', { width: 1280, height: 800 }, 2));
results.push(await scenario('mobile-390-2x', { width: 390, height: 844 }, 2, { mobile: true }));
results.push(await scenario('stress-1440p-2x', { width: 2560, height: 1440 }, 2));
results.push(await scenario('stress-4k-2x', { width: 3840, height: 2160 }, 2));
console.log(JSON.stringify(results, null, 2));
await browser.close();
