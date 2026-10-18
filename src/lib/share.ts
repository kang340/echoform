import { designFromBlueprint } from './design';
import type { DesignSpec, Phrase, StyleKey, VoiceScore } from '../types';

interface CompactPhrase {
  i: number;
  s: number;
  e: number;
  d: number;
  en: number;
  br: number;
  p: number;
  pn: number;
  o: number;
  pa: number;
  r: number;
}

interface Blueprint {
  v: 1;
  s: StyleKey;
  f: string;
  t: number;
  sum: VoiceScore['summary'];
  ph: CompactPhrase[];
  p: number[];
}

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const fromBase64Url = (value: string): Uint8Array => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const compactPhrase = (phrase: Phrase): CompactPhrase => ({
  i: phrase.index,
  s: Math.round(phrase.start * 100) / 100,
  e: Math.round(phrase.end * 100) / 100,
  d: Math.round(phrase.duration * 100) / 100,
  en: Math.round(phrase.energy * 1000) / 1000,
  br: Math.round(phrase.brightness * 1000) / 1000,
  p: Math.round(phrase.pitch * 10) / 10,
  pn: Math.round(phrase.pitchNorm * 1000) / 1000,
  o: phrase.onsets,
  pa: Math.round(phrase.pauseAfter * 100) / 100,
  r: Math.round(phrase.rise * 1000) / 1000,
});

const expandPhrase = (phrase: CompactPhrase): Phrase => ({
  index: phrase.i,
  start: phrase.s,
  end: phrase.e,
  duration: phrase.d,
  energy: phrase.en,
  brightness: phrase.br,
  pitch: phrase.p,
  pitchNorm: phrase.pn,
  onsets: phrase.o,
  pauseAfter: phrase.pa,
  rise: phrase.r,
});

// Links are external input: validate before generating geometry or allocating arrays.
const inRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

const validBlueprint = (value: unknown): value is Blueprint => {
  if (!value || typeof value !== 'object') return false;
  const b = value as Blueprint;
  if (b.v !== 1 || !['crystal', 'machine', 'organic'].includes(b.s)) return false;
  if (typeof b.f !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(b.f)) return false;
  if (!inRange(b.t, 0.1, 75) || !b.sum || typeof b.sum !== 'object') return false;
  const ranges: Record<string, [number, number]> = {
    duration: [0.1, 75], sampleRate: [8000, 384000], peak: [0, 100], rms: [0, 100],
    db: [-200, 100], dynamicRange: [0, 200], pitchMedian: [0, 24000],
    pitchMin: [0, 24000], pitchMax: [0, 24000], pitchRange: [0, 200],
    brightness: [0, 1], low: [0, 1], mid: [0, 1], high: [0, 1],
    silenceRatio: [0, 1], onsetRate: [0, 1000], bpm: [0, 1000],
    density: [0, 1], regularity: [0, 1], warmth: [0, 1],
  };
  const summary = b.sum as unknown as Record<string, unknown>;
  if (!Object.entries(ranges).every(([key, [min, max]]) => inRange(summary[key], min, max))) return false;
  if (!['rootNote', 'keyLabel', 'character', 'characterEn'].every(
    (key) => typeof summary[key] === 'string' && (summary[key] as string).length <= 120,
  )) return false;
  if (!Array.isArray(b.p) || b.p.length < 1 || b.p.length > 2048 || !b.p.every((p) => inRange(p, 0, 1))) return false;
  if (!Array.isArray(b.ph) || b.ph.length < 1 || b.ph.length > 64) return false;
  return b.ph.every((p) => p && typeof p === 'object'
    && Number.isInteger(p.i) && inRange(p.i, 0, 1000)
    && inRange(p.s, 0, b.t + 0.02) && inRange(p.e, p.s, b.t + 0.02)
    && inRange(p.d, 0, b.t + 0.02) && inRange(p.pa, 0, 75)
    && inRange(p.en, 0, 1) && inRange(p.br, 0, 1)
    && inRange(p.p, 0, 24000) && inRange(p.pn, 0, 1)
    && Number.isInteger(p.o) && inRange(p.o, 0, 1000) && inRange(p.r, -1, 1));
};

export const encodeBlueprint = (design: DesignSpec, score: VoiceScore): string => {
  const blueprint: Blueprint = {
    v: 1,
    s: design.style,
    f: design.fingerprint,
    t: design.duration,
    sum: score.summary,
    ph: score.phrases.map(compactPhrase),
    p: design.pulse.map((value) => Math.round(value * 100) / 100),
  };
  const json = JSON.stringify(blueprint);
  return toBase64Url(new TextEncoder().encode(json));
};

export const decodeBlueprint = (value: string): DesignSpec | null => {
  try {
    if (value.length > 100_000 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
    const bytes = fromBase64Url(value);
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!validBlueprint(parsed)) return null;
    const phrases = parsed.ph.map(expandPhrase);
    const summary = { ...parsed.sum, duration: parsed.t };
    return designFromBlueprint(parsed.f, parsed.s, summary, phrases, parsed.p);
  } catch {
    return null;
  }
};

export const buildShareUrl = (design: DesignSpec, score: VoiceScore): string => {
  const encoded = encodeBlueprint(design, score);
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = `b=${encoded}`;
  return url.toString();
};

export const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      textarea.remove();
      return ok;
    } catch {
      return false;
    }
  }
};

export const readBlueprintFromUrl = (): DesignSpec | null => {
  const url = new URL(window.location.href);
  const value = new URLSearchParams(url.hash.slice(1)).get('b') ?? url.searchParams.get('b');
  if (!value) return null;
  return decodeBlueprint(value);
};
