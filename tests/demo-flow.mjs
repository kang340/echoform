import { baseUrl, projectPath, launchOptions } from './config.mjs';
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const out = projectPath("shots");
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  ...launchOptions,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (msg) => logs.push(`${msg.type()}: ${msg.text()}`));
page.on('pageerror', (error) => logs.push(`PAGEERROR: ${error.stack || error.message}`));
await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await page.getByRole('button', { name: /聆听示例/ }).click();
await page.waitForFunction(() => window.__ECHOFORM__?.getState().phase === 'analyzing', null, { timeout: 10000 });
await page.waitForTimeout(1100);
await page.screenshot({ path: `${out}/02-analysis.png` });
await page.waitForFunction(() => window.__ECHOFORM__?.getState().phase === 'ready', null, { timeout: 45000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/03-ready.png` });
const state = await page.evaluate(() => {
  const s = window.__ECHOFORM__.getState();
  return {
    phase: s.phase,
    time: s.time,
    playing: s.playing,
    hasAudio: s.hasAudio,
    settings: s.settings,
    stats: s.stats,
    design: s.design
      ? {
          name: s.design.name,
          nameZh: s.design.nameZh,
          duration: s.design.duration,
          style: s.design.style,
          fingerprint: s.design.fingerprint,
          archCount: s.design.archCount,
          chamberCount: s.design.chamberCount,
          columnCount: s.design.columnCount,
          spireCount: s.design.spireCount,
          stairSteps: s.design.stairSteps,
          particleCount: s.design.particleCount,
          phraseMarks: s.design.phraseMarks,
          metrics: s.design.metrics,
          description: s.design.description,
        }
      : null,
  };
});
console.log(JSON.stringify({ state, logs }, null, 2));
await browser.close();
