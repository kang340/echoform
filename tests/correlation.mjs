import { baseUrl, projectPath, launchOptions } from './config.mjs';
import { chromium } from 'playwright-core';

const files = [
  ['tone-low-110', projectPath("tests/fixtures/tone-low-110.wav")],
  ['tone-bright-220', projectPath("tests/fixtures/tone-bright-220.wav")],
  ['tone-loud-220', projectPath("tests/fixtures/tone-loud-220.wav")],
  ['tone-quiet-220', projectPath("tests/fixtures/tone-quiet-220.wav")],
  ['phrases-330', projectPath("tests/fixtures/phrases-330.wav")],
  ['phrases-330-repeat', projectPath("tests/fixtures/phrases-330.wav")],
];
const browser = await chromium.launch({ ...launchOptions, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const logs = [];
page.on('pageerror', (e) => logs.push(`PAGEERROR: ${e.message}`));
await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const results = [];
for (const [label, file] of files) {
  if (label !== files[0][0]) {
    await page.locator('.new-piece').click();
    await page.waitForFunction(() => window.__ECHOFORM__?.getState().phase === 'intro', null, { timeout: 15000 });
  }
  await page.setInputFiles('input[type=file]', file);
  await page.waitForFunction(() => window.__ECHOFORM__?.getState().phase === 'ready', null, { timeout: 45000 });
  await page.waitForTimeout(700);
  results.push(await page.evaluate((name) => {
    const s = window.__ECHOFORM__.getState();
    const d = s.design;
    return {
      fixture: name,
      fingerprint: d.fingerprint,
      name: d.name,
      height: +d.height.toFixed(2),
      radius: +d.radius.toFixed(2),
      scale: +d.scale.toFixed(3),
      arches: d.archCount,
      archDepth: +d.arches[0].depth.toFixed(2),
      columns: d.columnCount,
      particles: d.particleCount,
      spires: d.spireCount,
      stairs: d.stairSteps,
      chambers: d.chamberCount,
      phrases: d.phraseMarks.length,
      phrasePauses: d.phraseMarks.map((p) => +p.pause.toFixed(2)),
      silence: +d.metrics.silenceRatio.toFixed(2),
      low: +d.metrics.low.toFixed(2),
      mid: +d.metrics.mid.toFixed(2),
      high: +d.metrics.high.toFixed(3),
      brightness: +d.metrics.brightness.toFixed(2),
      pitch: d.metrics.pitchMedian,
      bpm: d.metrics.bpm,
      description: d.description,
    };
  }, label));
}
console.log(JSON.stringify({ results, logs }, null, 2));
await browser.close();
