import { baseUrl, projectPath, launchOptions } from './config.mjs';
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ ...launchOptions, headless: true });
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.setInputFiles('input[type=file]', projectPath("tests/fixtures/tone-low-110.wav"));
await page.waitForFunction(() => window.__ECHOFORM__?.getState().phase === 'ready', null, { timeout: 45000 });
const data = await page.evaluate(() => {
  const s = window.__ECHOFORM__.getState();
  const frames = s.score.frames;
  const pitches = frames.map((f) => Math.round(f.pitch * 10) / 10);
  const active = frames.filter((f) => f.pitch > 0).map((f) => Math.round(f.pitch * 10) / 10);
  return {
    summary: { pitchMedian: s.score.summary.pitchMedian, pitchMin: s.score.summary.pitchMin, pitchMax: s.score.summary.pitchMax, low: s.score.summary.low },
    first: pitches.slice(0, 30),
    activeMiddle: active.slice(30, 70),
    activeCount: active.length,
    frameCount: frames.length,
  };
});
console.log(JSON.stringify(data, null, 2));
await browser.close();
