import { baseUrl, projectPath, launchOptions } from './config.mjs';
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const artifacts = projectPath("media");
await fs.mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ ...launchOptions, headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  acceptDownloads: true,
});
const page = await context.newPage();
const logs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`PAGEERROR: ${e.message}`));

await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.waitForTimeout(1600);
await page.getByRole('button', { name: /聆听示例/ }).click();
await page.waitForFunction(() => window.__ECHOFORM__?.getState().phase === 'ready', null, { timeout: 120000 });
await page.waitForTimeout(1200);
const design = await page.evaluate(() => {
  const s = window.__ECHOFORM__.getState();
  return { name: s.design.name, nameZh: s.design.nameZh, duration: s.design.duration, fingerprint: s.design.fingerprint };
});

// Poster at the same late, fully-grown moment as the film.
await page.locator('[data-action="poster"]').click();
await page.waitForSelector('.poster-modal img', { timeout: 30000 });
await page.waitForFunction(() => {
  const img = document.querySelector('.poster-modal img');
  return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0;
});
const posterDownload = page.waitForEvent('download', { timeout: 30000 });
await page.locator('.poster-modal .primary-action').click();
const poster = await posterDownload;
await poster.saveAs(path.join(artifacts, 'poster.png'));
await page.locator('.poster-modal .text-action').click();
await page.waitForTimeout(500);

await page.locator('[data-action="video"]').click();
await page.waitForSelector('.export-progress', { timeout: 30000 });
const startedAt = Date.now();
await page.waitForSelector('.video-modal video', { timeout: 180000 });
const videoInfo = await page.evaluate(async () => {
  const video = document.querySelector('.video-modal video');
  if (!(video instanceof HTMLVideoElement)) return null;
  if (video.readyState < 1) {
    await new Promise((resolve) => video.addEventListener('loadedmetadata', resolve, { once: true }));
  }
  return {
    duration: video.duration,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    src: video.src.slice(0, 30),
  };
});
await page.waitForTimeout(800);
await page.screenshot({ path: projectPath("shots/60-video-ready.png") });
const download = page.waitForEvent('download', { timeout: 60000 });
await page.locator('.video-modal .primary-action').click();
const file = await download;
await file.saveAs(path.join(artifacts, 'ECHOFORM-demo.mp4'));
const size = (await fs.stat(path.join(artifacts, 'ECHOFORM-demo.mp4'))).size;

console.log(JSON.stringify({
  design,
  videoInfo,
  size,
  exportMs: Date.now() - startedAt,
  logs: logs.filter((line) => line.includes('PAGEERROR')),
}, null, 2));
await browser.close();
