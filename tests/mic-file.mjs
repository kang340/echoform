import { baseUrl, projectPath, launchOptions } from './config.mjs';
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';

const out = projectPath("shots");
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  ...launchOptions,
  headless: true,
  args: [
        '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--use-file-for-fake-audio-capture=' + projectPath('tests/fixtures/voice-test.wav'),
  ],
});
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  permissions: ['microphone'],
});
const page = await context.newPage();
const logs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`PAGEERROR: ${e.stack || e.message}`));
await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.waitForTimeout(1600);

await page.locator('.mic-button').click();
await page.waitForFunction(() => window.__ECHOFORM__?.getState().phase === 'recording', null, { timeout: 15000 });
await page.waitForTimeout(2600);
await page.screenshot({ path: `${out}/40-recording.png` });
const during = await page.evaluate(() => window.__ECHOFORM__.getState());
await page.locator('.stop-button').click();
await page.waitForFunction(() => ['ready', 'intro'].includes(window.__ECHOFORM__?.getState().phase), null, { timeout: 45000 });
await page.waitForTimeout(2200);
const micState = await page.evaluate(() => {
  const s = window.__ECHOFORM__.getState();
  return {
    phase: s.phase,
    hasAudio: s.hasAudio,
    duration: s.design?.duration,
    name: s.design?.name,
    phrases: s.design?.phraseMarks.length,
    metrics: s.design?.metrics,
  };
});
await page.screenshot({ path: `${out}/41-mic-building.png` });

await page.locator('.new-piece').click();
await page.waitForTimeout(900);
await page.setInputFiles('input[type=file]', projectPath("tests/fixtures/voice-test.wav"));
await page.waitForFunction(() => ['ready', 'intro'].includes(window.__ECHOFORM__?.getState().phase), null, { timeout: 45000 });
await page.waitForTimeout(2000);
const fileState = await page.evaluate(() => {
  const s = window.__ECHOFORM__.getState();
  return {
    phase: s.phase,
    hasAudio: s.hasAudio,
    duration: s.design?.duration,
    name: s.design?.name,
    phrases: s.design?.phraseMarks.length,
    metrics: s.design?.metrics,
  };
});
await page.screenshot({ path: `${out}/42-file-building.png` });

const saveButton = page.locator('[data-action="save"]');
await saveButton.click();
await page.waitForTimeout(500);
await page.locator('.studio-links button').first().click();
await page.waitForTimeout(500);
const presetCount = await page.locator('.preset-item').count();
await page.screenshot({ path: `${out}/43-presets.png` });

console.log(JSON.stringify({ during, micState, fileState, presetCount, logs }, null, 2));
await browser.close();
