import { baseUrl, projectPath, launchOptions } from './config.mjs';
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const out = projectPath("shots");
const artifacts = projectPath("tests/artifacts");
await fs.mkdir(out, { recursive: true });
await fs.mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({
  ...launchOptions,
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
const logs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`PAGEERROR: ${e.stack || e.message}`));
await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.waitForTimeout(1400);
await page.setInputFiles('input[type=file]', projectPath("tests/fixtures/voice-test.wav"));
await page.waitForFunction(() => window.__ECHOFORM__?.getState().phase === 'ready', null, { timeout: 45000 });
await page.evaluate(() => {
  const { audio, engine } = window.__ECHOFORM__;
  audio.pause();
  engine.setTimeline(6.4);
});
await page.waitForTimeout(1200);

// Poster
await page.locator('[data-action="poster"]').click();
await page.waitForSelector('.poster-modal img', { timeout: 30000 });
await page.waitForFunction(() => {
  const img = document.querySelector('.poster-modal img');
  return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0;
});
const posterInfo = await page.evaluate(() => {
  const img = document.querySelector('.poster-modal img');
  return img ? { w: img.naturalWidth, h: img.naturalHeight, src: img.src.slice(0, 30) } : null;
});
const posterDownload = page.waitForEvent('download', { timeout: 30000 });
await page.locator('.poster-modal .primary-action').click();
const poster = await posterDownload;
await poster.saveAs(path.join(artifacts, 'poster.png'));
const posterSize = (await fs.stat(path.join(artifacts, 'poster.png'))).size;
const posterMagic = (await fs.readFile(path.join(artifacts, 'poster.png'))).subarray(0, 8).toString('hex');
await page.locator('.poster-modal .text-action').click();
await page.waitForTimeout(400);

// Parameter JSON
const jsonDownload = page.waitForEvent('download', { timeout: 20000 });
await page.locator('.studio-actions button').nth(1).click();
const jsonFile = await jsonDownload;
await jsonFile.saveAs(path.join(artifacts, 'design.json'));
const exported = JSON.parse(await fs.readFile(path.join(artifacts, 'design.json'), 'utf8'));
await page.waitForTimeout(300);

// Share
await page.locator('[data-action="share"]').click();
await page.waitForFunction(() => {
  const input = document.querySelector('.share-url-row input');
  return input instanceof HTMLInputElement && input.value.startsWith('http');
}, null, { timeout: 30000 });
const shareUrl = await page.locator('.share-url-row input').inputValue();
await page.screenshot({ path: `${out}/44-share.png` });
await page.locator('.share-modal .text-action').click();
await page.waitForTimeout(300);

const sharedPage = await context.newPage();
const sharedLogs = [];
sharedPage.on('pageerror', (e) => sharedLogs.push(e.message));
await sharedPage.goto(shareUrl, { waitUntil: 'networkidle' });
await sharedPage.waitForFunction(() => window.__ECHOFORM__?.getState().phase === 'ready', null, { timeout: 30000 });
const sharedState = await sharedPage.evaluate(() => {
  const s = window.__ECHOFORM__.getState();
  return { phase: s.phase, hasAudio: s.hasAudio, name: s.design?.name, fingerprint: s.design?.fingerprint, time: s.time };
});
await sharedPage.screenshot({ path: `${out}/45-shared.png` });
await sharedPage.close();

// Video
await page.locator('[data-action="video"]').click();
await page.waitForSelector('.export-progress, .video-modal', { timeout: 20000 });
await page.waitForSelector('.video-modal video', { timeout: 30000 });
await page.waitForTimeout(1000);
const videoInfo = await page.evaluate(async () => {
  const video = document.querySelector('.video-modal video');
  if (!(video instanceof HTMLVideoElement)) return null;
  if (video.readyState < 1) {
    await new Promise((resolve) => video.addEventListener('loadedmetadata', resolve, { once: true }));
  }
  return { duration: video.duration, videoWidth: video.videoWidth, videoHeight: video.videoHeight, src: video.src.slice(0, 30) };
});
const videoDownload = page.waitForEvent('download', { timeout: 30000 });
await page.locator('.video-modal .primary-action').click();
const videoFile = await videoDownload;
await videoFile.saveAs(path.join(artifacts, 'film.mp4'));
const videoSize = (await fs.stat(path.join(artifacts, 'film.mp4'))).size;
await page.screenshot({ path: `${out}/46-video-modal.png` });

console.log(JSON.stringify({
  posterInfo,
  posterSize,
  posterMagic,
  exported: { format: exported.format, style: exported.settings.style, name: exported.design.name, source: exported.source },
  share: { length: shareUrl.length, url: shareUrl.slice(0, 120), sharedState, sharedLogs },
  videoInfo,
  videoSize,
  logs,
}, null, 2));
await browser.close();
