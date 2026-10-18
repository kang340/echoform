import { baseUrl, projectPath, launchOptions } from './config.mjs';
import { chromium } from 'playwright-core';

const out = projectPath("shots");
const browser = await chromium.launch({
  ...launchOptions,
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const logs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`PAGEERROR: ${e.stack || e.message}`));
await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);

const layout = async (label) => page.evaluate((name) => {
  const rect = (selector) => {
    const element = document.querySelector(selector);
    if (!element) return null;
    const box = element.getBoundingClientRect();
    return { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) };
  };
  return {
    name,
    viewport: { w: innerWidth, h: innerHeight },
    bodyScrollWidth: document.documentElement.scrollWidth,
    bodyClientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    intro: rect('.intro-copy'),
    styleSelector: rect('.intro-style-selector'),
    primary: rect('.mic-button'),
    workbenchTop: rect('.workbench-top'),
    identity: rect('.workbench-identity'),
    timeline: rect('.timeline'),
    studio: rect('.studio-panel'),
    mobileHandle: rect('.studio-mobile-handle'),
    shellClass: document.querySelector('.studio-shell')?.className,
    shellStyle: (() => {
      const shell = document.querySelector('.studio-shell');
      if (!(shell instanceof HTMLElement)) return null;
      const cs = getComputedStyle(shell);
      return { transform: cs.transform, opacity: cs.opacity, rect: shell.getBoundingClientRect().toJSON() };
    })(),
    handleClass: document.querySelector('.studio-mobile-handle')?.className,
    hit: (() => {
      const el = document.elementFromPoint(innerWidth / 2, 719);
      return el ? `${el.tagName}.${el.className}` : null;
    })(),
  };
}, label);

const introLayout = await layout('intro');
await page.screenshot({ path: `${out}/50-mobile-intro.png`, fullPage: false });

await page.getByRole('button', { name: /聆听示例/ }).click();
await page.waitForFunction(() => window.__ECHOFORM__?.getState().phase === 'ready', null, { timeout: 45000 });
await page.waitForTimeout(1600);
const readyLayout = await layout('ready');
await page.screenshot({ path: `${out}/51-mobile-ready.png`, fullPage: false });

const handle = page.locator('.studio-mobile-handle');
const panelStart = Date.now();
if (await handle.isVisible()) {
  await handle.click();
  await page.waitForFunction(() => {
    const shell = document.querySelector('.studio-shell');
    if (!shell) return false;
    const transform = getComputedStyle(shell).transform;
    if (transform === 'none') return true;
    const match = transform.match(/matrix\(1, 0, 0, 1, 0, ([\d.]+)\)/);
    return !match || Number(match[1]) < 1;
  }, null, { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(600);
}
const panelWaitMs = Date.now() - panelStart;
const panelLayout = await layout('panel');
await page.screenshot({ path: `${out}/52-mobile-panel.png`, fullPage: false });
const panelTabs = await page.locator('.studio-tabs button').allTextContents();
const panelClose = page.getByRole('button', { name: '关闭面板' });
const hasClose = await panelClose.count();

const typography = await page.evaluate(() => {
  const size = (selector) => {
    const element = document.querySelector(selector);
    return element ? getComputedStyle(element).fontSize : null;
  };
  return {
    introTitle: size('.intro-title'),
    identityTitle: size('.workbench-identity h1'),
    identityCn: size('.identity-cn'),
    styleTab: size('.workbench-style-switch button'),
    timelineClock: size('.timeline-clock'),
    panelLabel: size('.range-head span'),
    micLabel: size('.mic-label'),
  };
});

// Enter roam on a touch device via the compact camera-cycle control.
if (hasClose && (await panelClose.isVisible())) {
  await panelClose.click();
  await page.waitForTimeout(1100);
}
await page.locator('.camera-cycle').click();
await page.waitForTimeout(1400);
const roamMode = await page.evaluate(() => window.__ECHOFORM__.getState().cameraMode);
const padBox = await page.locator('.roam-pad').boundingBox();
const roamBefore = await page.evaluate(() => {
  const e = window.__ECHOFORM__.engine;
  return { pos: e.camera.position.toArray(), display: getComputedStyle(document.querySelector('.roam-pad')).display };
});
let padActive = null;
if (padBox) {
  await page.mouse.move(padBox.x + 42, padBox.y + 42);
  await page.mouse.down();
  await page.mouse.move(padBox.x + 75, padBox.y + 22, { steps: 4 });
  await page.waitForTimeout(900);
  padActive = await page.evaluate(() => {
    const e = window.__ECHOFORM__.engine;
    return { input: [e.roamInput.x, e.roamInput.y], pos: e.camera.position.toArray(), active: document.querySelector('.roam-pad')?.className };
  });
  await page.mouse.up();
  await page.waitForTimeout(200);
}
await page.screenshot({ path: `${out}/53-mobile-roam.png`, fullPage: false });

const overflow = await page.evaluate(() => {
  const bad = [];
  for (const element of document.querySelectorAll('*')) {
    const box = element.getBoundingClientRect();
    if (box.width > 0 && (box.right > innerWidth + 2 || box.left < -2)) {
      bad.push({ tag: element.tagName, cls: String(element.className).slice(0, 60), left: Math.round(box.left), right: Math.round(box.right) });
    }
  }
  return bad.slice(0, 12);
});

console.log(JSON.stringify({ introLayout, readyLayout, panelLayout, panelWaitMs, panelTabs, hasClose, typography, roamMode, padBox, roamBefore, padActive, overflow, logs }, null, 2));
await browser.close();
