import { baseUrl, projectPath, launchOptions } from './config.mjs';
import { chromium } from 'playwright-core';

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
await page.waitForTimeout(1200);
await page.setInputFiles('input[type=file]', projectPath("tests/fixtures/voice-test.wav"));
await page.waitForFunction(() => window.__ECHOFORM__?.getState().phase === 'ready', null, { timeout: 45000 });
await page.waitForTimeout(1500);

const base = await page.evaluate(() => {
  const s = window.__ECHOFORM__.getState();
  return { name: s.design.name, style: s.settings.style, fp: s.design.fingerprint, camera: s.cameraMode, palette: s.design.palette, cameraPos: window.__ECHOFORM__.engine.camera.position.toArray() };
});

const styleResults = [];
for (const expected of ['machine', 'organic', 'crystal']) {
  await page.locator(`[data-style="${expected}"]`).click();
  await page.waitForTimeout(1800);
  styleResults.push(await page.evaluate(() => {
    const s = window.__ECHOFORM__.getState();
    const e = window.__ECHOFORM__.engine;
    return {
      style: s.settings.style,
      name: s.design.name,
      fp: s.design.fingerprint,
      palette: s.design.palette,
      arches: s.design.archCount,
      columns: s.design.columnCount,
      drawCalls: s.stats?.drawCalls,
      triangle: s.stats?.triangles,
      glassColor: e.materials.glass.color.getHexString(),
      accent: e.materials.accentColor.getHexString(),
    };
  }));
  if (styleResults.at(-1).style !== expected) throw new Error(`style ${expected} failed`);
}

async function setRange(index, value) {
  const input = page.locator('.studio-body .range-control input[type=range]').nth(index);
  await input.evaluate((element, next) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(element, String(next));
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  await page.waitForTimeout(400);
}
await setRange(0, 0.2); // gloss
await setRange(1, 0.9); // transmission
await page.locator('.studio-tabs button').nth(1).click(); // light tab
await page.waitForTimeout(500);
await setRange(3, 0.3); // key light
await setRange(2, 0.9); // warmth
const materialState = await page.evaluate(() => {
  const s = window.__ECHOFORM__.getState();
  const e = window.__ECHOFORM__.engine;
  return {
    materials: s.settings.materials,
    lights: s.settings.lights,
    roughness: e.materials.main.roughness,
    transmission: e.materials.glass.transmission,
    keyIntensity: e.keyLight.intensity,
    exposure: e.renderer.toneMappingExposure,
  };
});

// Camera modes and roaming.
await page.locator('[data-camera="roam"]').click();
await page.waitForTimeout(900);
const roamBefore = await page.evaluate(() => ({
  mode: window.__ECHOFORM__.getState().cameraMode,
  pos: window.__ECHOFORM__.engine.camera.position.toArray(),
  pad: (() => { const el = document.querySelector('.roam-pad'); return el ? getComputedStyle(el).display : null; })(),
}));
await page.keyboard.down('w');
await page.waitForTimeout(1500);
const roamHeld = await page.evaluate(() => {
  const e = window.__ECHOFORM__.engine;
  return {
    keys: Array.from(e.roamKeys),
    tween: Boolean(e.cameraTween),
    mode: e.cameraMode,
    pos: e.camera.position.toArray(),
  };
});
await page.keyboard.up('w');
const roamAfter = await page.evaluate(() => ({
  mode: window.__ECHOFORM__.getState().cameraMode,
  pos: window.__ECHOFORM__.engine.camera.position.toArray(),
}));
await page.locator('[data-camera="guide"]').click();
await page.waitForTimeout(900);
const guideMode = await page.evaluate(() => window.__ECHOFORM__.getState().cameraMode);
await page.locator('[data-camera="orbit"]').click();
await page.waitForTimeout(700);

// Timeline scrub.
const track = page.locator('.timeline-track');
const box = await track.boundingBox();
if (box) await page.mouse.click(box.x + box.width * 0.55, box.y + box.height / 2);
await page.waitForTimeout(500);
const timelineState = await page.evaluate(() => {
  const s = window.__ECHOFORM__.getState();
  return { time: s.time, duration: s.design.duration, playing: s.playing };
});

// HUD hide and restore.
await page.keyboard.press('h');
await page.waitForTimeout(500);
const hudHidden = await page.evaluate(() => document.querySelector('.app-root')?.className);
await page.keyboard.press('h');
await page.waitForTimeout(400);

// Style keyboard shortcut.
await page.keyboard.press('2');
await page.waitForTimeout(1200);
const keyboardStyle = await page.evaluate(() => window.__ECHOFORM__.getState().settings.style);

// Preset save / load.
await page.locator('[data-action="save"]').click();
await page.waitForTimeout(600);
const savedToast = await page.locator('.toast').textContent().catch(() => null);
await page.locator('.studio-links button').first().click();
await page.waitForTimeout(700);
const presetCount = await page.locator('.preset-item').count();
const loadButton = page.locator('.preset-main').first();
if (await loadButton.count()) await loadButton.click();
await page.waitForTimeout(1200);
const loaded = await page.evaluate(() => {
  const s = window.__ECHOFORM__.getState();
  return { hasAudio: s.hasAudio, style: s.settings.style, name: s.design?.name, phase: s.phase };
});
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

console.log(JSON.stringify({
  base,
  styleResults,
  materialState,
  roamBefore,
  roamAfter,
  roamHeld,
  moved: Math.hypot(roamAfter.pos[0] - roamBefore.pos[0], roamAfter.pos[2] - roamBefore.pos[2]),
  guideMode,
  timelineState,
  hudHidden,
  keyboardStyle,
  savedToast,
  presetCount,
  loaded,
  logs,
}, null, 2));
await browser.close();
