import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { baseUrl, projectPath, launchOptions } from './config.mjs';

const browser = await chromium.launch(launchOptions);
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Disabled', 'SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('Disabled', 'SecurityError'); };
  });
  await page.goto(baseUrl);
  await page.setInputFiles('input[type=file]', projectPath('tests/fixtures/voice-test.wav'));
  await page.waitForFunction(() => window.__ECHOFORM__?.getState().phase === 'ready', null, { timeout: 45000 });
  await page.waitForFunction(() => document.querySelector('.workbench-top'));
  assert.equal(await page.locator('.toast-error').count(), 0);

  const result = await page.evaluate(async () => {
    const { encodeBlueprint, decodeBlueprint, buildShareUrl } = await import('/src/lib/share.ts');
    const { AudioEngine } = await import('/src/lib/audio-engine.ts');
    const state = window.__ECHOFORM__.getState();
    const encoded = encodeBlueprint(state.design, state.score);
    const restored = decodeBlueprint(encoded);
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(
      encoded.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))));
    const encode = value => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    const malformed = [
      { ...payload, s: 'unknown' }, { ...payload, t: -1 },
      { ...payload, p: [null] }, { ...payload, ph: [{ ...payload.ph[0], o: 1e9 }] },
      { ...payload, sum: { ...payload.sum, rms: null } },
    ];
    const rejected = malformed.every(p => decodeBlueprint(encode(p)) === null)
      && decodeBlueprint('a'.repeat(100001)) === null;
    const live1 = window.__ECHOFORM__.audio.getLiveAnalyser();
    const live2 = window.__ECHOFORM__.audio.getLiveAnalyser();

    // Use real audio nodes/stream, then simulate a recorder constructor failure.
    const engine = new AudioEngine();
    const audioContext = await engine.ensureContext();
    const destination = audioContext.createMediaStreamDestination();
    const track = destination.stream.getAudioTracks()[0];
    const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
    const originalRecorder = window.MediaRecorder;
    let failed = false;
    try {
      navigator.mediaDevices.getUserMedia = async () => destination.stream;
      window.MediaRecorder = class {
        static isTypeSupported() { return true; }
        constructor() { throw new Error('RECORDER_FAILED'); }
      };
      try { await engine.startRecording(); } catch { failed = true; }
    } finally {
      navigator.mediaDevices.getUserMedia = originalGetUserMedia;
      window.MediaRecorder = originalRecorder;
      engine.dispose();
    }
    return {
      restored: restored?.fingerprint === state.design.fingerprint,
      rejected, reused: live1.frequency === live2.frequency && live1.time === live2.time,
      released: failed && track.readyState === 'ended',
      url: buildShareUrl(state.design, state.score),
    };
  });
  assert.equal(result.restored, true, 'Valid blueprint should round-trip');
  assert.equal(result.rejected, true, 'Invalid links must be rejected');
  assert.equal(result.reused, true, 'Live analysis must reuse buffers');
  assert.equal(result.released, true, 'Recorder failure must release microphone tracks');
  const url = new URL(result.url);
  assert.equal(url.search, '');
  assert.ok(url.hash.startsWith('#b='));
  await page.goto(result.url);
  await page.waitForFunction(() => window.__ECHOFORM__?.getState().phase === 'ready', null, { timeout: 30000 });
  await page.locator('[data-action="video"]').click();
  await page.waitForSelector('.video-modal video', { timeout: 45000 });
  const videoSize = await page.locator('.video-modal video').evaluate(async video =>
    (await (await fetch(video.src)).blob()).size);
  assert.ok(videoSize > 1000, 'Shared buildings must export a real video without original audio');
  await page.keyboard.press('Escape');
  await page.locator('.new-piece').click();
  await page.waitForFunction(() => window.__ECHOFORM__?.getState().phase === 'intro');
  assert.equal(new URL(page.url()).hash, '', 'Reset must clear shared blueprint');
  assert.deepEqual(errors, []);
  console.log('PASS: disabled storage, blueprints, hash sharing/reset, analyser reuse, microphone cleanup, silent video');
} finally {
  await browser.close();
}
