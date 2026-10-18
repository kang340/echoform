import { chromium } from 'playwright-core';
import { launchOptions } from '../tests/config.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const root = path.dirname(fileURLToPath(import.meta.url));
const ffmpeg = process.env.FFMPEG_PATH || 'C:/Users/hkang/anaconda3/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';
await fs.mkdir(path.join(root, 'assets'), { recursive: true });
const browser = await chromium.launch({ ...launchOptions, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('PAGEERROR:', e.message));
await page.route('**/promo-capture', route => route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0;background:#070706"><div id="stage" style="width:1280px;height:720px"><canvas id="c"></canvas></div></body></html>' }));
await page.goto('http://127.0.0.1:5178/promo-capture');
console.log('Preparing source engine and original sound analysis...');
const designInfo = await page.evaluate(async () => {
  const [{ EchoformEngine }, { createDemoAudio }, { analyzeBuffer }, { buildDesign }, types] = await Promise.all([import('/src/three/engine.ts'), import('/src/lib/demo-audio.ts'), import('/src/lib/analysis.ts'), import('/src/lib/design.ts'), import('/src/types.ts')]);
  const score = await analyzeBuffer(await createDemoAudio());
  const engine = new EchoformEngine(document.querySelector('#c'), document.querySelector('#stage'));
  cancelAnimationFrame(engine.animationId);
  engine.resizeObserver.disconnect();
  engine.renderer.setPixelRatio(1); engine.composer.setPixelRatio(1);
  engine.renderer.setSize(1280, 720, false); engine.composer.setSize(1280, 720);
  engine.camera.aspect = 1280 / 720; engine.camera.updateProjectionMatrix();
  window.film = { engine, score, buildDesign, types };
  window.prepareShot = style => {
    const settings = { style, quality: 'high', autoRotate: false, materials: types.DEFAULT_MATERIALS, lights: types.DEFAULT_LIGHTS };
    engine.applySettings(settings);
    const design = buildDesign(score, style);
    engine.setDesign(design); engine.setPhase('ready'); engine.clearLive();
    engine.cameraTween = null; engine.controls.enabled = false; engine.controls.autoRotate = false;
    engine.elapsed = 0; engine.setTimeline(design.duration);
    window.film.design = design;
    return { height: design.height, radius: design.radius, duration: design.duration };
  };
  window.renderFrame = (kind, frame, frames) => {
    const { design: d } = window.film;
    const u = frame / Math.max(1, frames - 1);
    const angle = kind === 'machine' ? -0.55 + u * 0.62 : kind === 'organic' ? 0.4 + u * 0.48 : 0.52 + u * 0.42;
    const distance = Math.max(32, Math.min(72, Math.max(d.radius * 2.48, d.height * 1.36)));
    const progress = kind === 'growth' ? 0.02 + Math.pow(u, 0.8) * 0.98 : 1;
    engine.setTimeline(d.duration * progress); engine.elapsed = frame / 30; engine.updateScene(1 / 30);
    if (kind === 'interior') {
      const r = d.radius * (1.22 - u * 0.56);
      engine.camera.position.set(Math.sin(0.65 - u * 0.4) * r, d.height * (0.24 + u * 0.08), Math.cos(0.65 - u * 0.4) * r);
      engine.camera.lookAt(0, d.height * (0.42 + u * 0.09), 0);
    } else {
      const scale = kind === 'hero' ? 1.04 - u * 0.06 : 1.03;
      engine.camera.position.set(Math.sin(angle) * distance * scale, d.height * (0.6 + u * 0.035), Math.cos(angle) * distance * scale);
      engine.camera.lookAt(0, d.height * 0.42, 0);
    }
    engine.renderer.info.reset(); engine.composer.render();
    return engine.canvas.toDataURL('image/png').split(',')[1];
  };
  return window.prepareShot('crystal');
});
console.log(JSON.stringify(designInfo));
const shots = [ ['hero', 'crystal', 4.6], ['growth', 'crystal', 7.6], ['crystal', 'crystal', 4.6], ['machine', 'machine', 4.6], ['organic', 'organic', 4.6], ['interior', 'crystal', 4.6] ];
const previewOnly = process.argv.includes('--stills');
for (const [name, style, seconds] of shots) {
  const out = path.join(root, 'assets', name + '.mp4');
  await page.evaluate(s => window.prepareShot(s), style);
  const frames = Math.round(seconds * 30);
  const png = Buffer.from(await page.evaluate(([k, i, n]) => window.renderFrame(k, i, n), [name, Math.floor(frames * 0.65), frames]), 'base64');
  await fs.writeFile(path.join(root, 'assets', name + '-still.png'), png);
  if (previewOnly) { console.log('Still:', name); continue; }
  try { if ((await fs.stat(out)).size > 100000) { console.log('Cached:', name); continue; } } catch {}
  const encoder = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '17', '-g', '30', '-keyint_min', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = ''; encoder.stderr.on('data', b => err += b);
  const start = Date.now();
  for (let i = 0; i < frames; i++) {
    const b64 = await page.evaluate(([k, i, n]) => window.renderFrame(k, i, n), [name, i, frames]);
    if (!encoder.stdin.write(Buffer.from(b64, 'base64'))) await once(encoder.stdin, 'drain');
    if (i % 30 === 0) console.log(`${name}: ${i}/${frames} (${((Date.now()-start)/1000).toFixed(0)}s)`);
  }
  encoder.stdin.end(); const [code] = await once(encoder, 'close');
  if (code) throw new Error(err);
  console.log('Done:', name);
}
await browser.close();
