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
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`PAGEERROR: ${e.message}`));
await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.getByRole('button', { name: /聆听示例/ }).click();
await page.waitForFunction(() => window.__ECHOFORM__?.getState().phase === 'ready', null, { timeout: 90000 });
await page.evaluate(() => {
  const { audio, engine } = window.__ECHOFORM__;
  audio.pause();
  engine.setTimeline(31.8);
});
await page.waitForTimeout(1600);
const panelClose = page.getByRole('button', { name: '关闭面板' });
if (await panelClose.isVisible()) await panelClose.click();
await page.waitForTimeout(500);

for (const [key, name] of [['Digit1', 'crystal'], ['Digit2', 'machine'], ['Digit3', 'organic']]) {
  await page.keyboard.press(key);
  await page.waitForTimeout(1400);
  await page.evaluate(() => window.__ECHOFORM__.engine.setTimeline(31.8));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/30-hero-${name}.png` });
}

const state = await page.evaluate(() => {
  const s = window.__ECHOFORM__.getState();
  return { stats: s.stats, design: { name: s.design.name, style: s.design.style, height: s.design.height, radius: s.design.radius } };
});
console.log(JSON.stringify({ state, logs }, null, 2));
await browser.close();
