import {
  clamp,
  type FeatureFrame,
  type LiveFeature,
  type Phrase,
  type VoiceScore,
  type VoiceSummary,
} from '../types';

const TWO_PI = Math.PI * 2;

class FFT {
  readonly size: number;
  private readonly levels: number;
  private readonly cosTable: Float32Array;
  private readonly sinTable: Float32Array;
  private readonly reverse: Uint32Array;

  constructor(size: number) {
    this.size = size;
    this.levels = Math.round(Math.log2(size));
    this.cosTable = new Float32Array(size / 2);
    this.sinTable = new Float32Array(size / 2);
    for (let i = 0; i < size / 2; i += 1) {
      this.cosTable[i] = Math.cos((TWO_PI * i) / size);
      this.sinTable[i] = Math.sin((TWO_PI * i) / size);
    }
    this.reverse = new Uint32Array(size);
    for (let i = 0; i < size; i += 1) {
      let value = i;
      let bit = 0;
      for (let j = 0; j < this.levels; j += 1) {
        bit = (bit << 1) | (value & 1);
        value >>= 1;
      }
      this.reverse[i] = bit;
    }
  }

  transform(real: Float32Array, imag: Float32Array): void {
    const n = this.size;
    for (let i = 0; i < n; i += 1) {
      const j = this.reverse[i];
      if (j > i) {
        let tmp = real[i];
        real[i] = real[j];
        real[j] = tmp;
        tmp = imag[i];
        imag[i] = imag[j];
        imag[j] = tmp;
      }
    }

    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1;
      const step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = i, k = 0; j < i + half; j += 1, k += step) {
          const l = j + half;
          const tre = real[l] * this.cosTable[k] + imag[l] * this.sinTable[k];
          const tim = -real[l] * this.sinTable[k] + imag[l] * this.cosTable[k];
          real[l] = real[j] - tre;
          imag[l] = imag[j] - tim;
          real[j] += tre;
          imag[j] += tim;
        }
      }
    }
  }
}

const hzToMel = (hz: number): number => 2595 * Math.log10(1 + hz / 700);
const melToHz = (mel: number): number => 700 * (Math.pow(10, mel / 2595) - 1);

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const MODE_ZH = ['小调', '大调'];
const MODE_EN = ['minor', 'major'];

export const hashString = (input: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const makeRng = (seed: number): (() => number) => {
  let state = seed || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 4294967296) % 1;
  };
};

const median = (values: number[]): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const percentile = (values: number[], fraction: number): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[clamp(Math.round(fraction * (sorted.length - 1)), 0, sorted.length - 1)];
};

const normalizedMagnitude = (spectrum: Float32Array, frequency: number, sampleRate: number, fftSize: number): number => {
  const position = (frequency * fftSize) / sampleRate;
  const left = Math.floor(position);
  const right = Math.min(left + 1, spectrum.length - 1);
  const mix = position - left;
  const a = left >= 0 ? spectrum[left] : 0;
  const b = right >= 0 ? spectrum[right] : 0;
  return a + (b - a) * mix;
};

const weightedMagnitude = (
  spectrum: Float32Array,
  frequency: number,
  sampleRate: number,
  fftSize: number,
): number => {
  const magnitude = normalizedMagnitude(spectrum, frequency, sampleRate, fftSize);
  // A gentle high-frequency tilt and log compression stop a loud bass drone
  // from winning every pitch decision over the voice above it.
  return Math.log1p(Math.max(0, magnitude) * 24) * Math.pow(Math.max(60, frequency) / 220, 0.34);
};

const interpolatedPeak = (
  spectrum: Float32Array,
  aroundHz: number,
  sampleRate: number,
  fftSize: number,
): number => {
  const center = Math.round((aroundHz * fftSize) / sampleRate);
  let peak = center;
  for (let i = center - 2; i <= center + 2; i += 1) {
    if (i > 0 && i < spectrum.length - 1 && spectrum[i] > spectrum[peak]) peak = i;
  }
  const left = spectrum[peak - 1] ?? 0;
  const middle = spectrum[peak] ?? 0;
  const right = spectrum[peak + 1] ?? 0;
  const denominator = left - 2 * middle + right;
  const delta = Math.abs(denominator) > 1e-9 ? (0.5 * (left - right)) / denominator : 0;
  return ((peak + clamp(delta, -0.5, 0.5)) * sampleRate) / fftSize;
};

const autocorrelationPitch = (
  samples: Float32Array,
  sampleRate: number,
  aroundHz: number,
): number => {
  const minLag = Math.max(4, Math.floor(sampleRate / (aroundHz * 1.18)));
  const maxLag = Math.min(samples.length - 3, Math.ceil(sampleRate / (aroundHz * 0.85)));
  if (maxLag - minLag < 3) return aroundHz;
  const correlations: number[] = [];
  let bestLag = minLag;
  let best = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let dot = 0;
    let energyA = 0;
    let energyB = 0;
    for (let i = 0; i < samples.length - lag; i += 2) {
      const a = samples[i];
      const b = samples[i + lag];
      dot += a * b;
      energyA += a * a;
      energyB += b * b;
    }
    const correlation = dot / Math.sqrt(energyA * energyB + 1e-9);
    correlations.push(correlation);
    if (correlation > best) {
      best = correlation;
      bestLag = lag;
    }
  }
  const index = bestLag - minLag;
  if (index <= 0 || index >= correlations.length - 1) return sampleRate / bestLag;
  const left = correlations[index - 1];
  const right = correlations[index + 1];
  const denominator = left - 2 * best + right;
  const delta = Math.abs(denominator) > 1e-9 ? (0.5 * (left - right)) / denominator : 0;
  const lag = bestLag + clamp(delta, -0.5, 0.5);
  const refined = sampleRate / lag;
  return refined > aroundHz * 0.8 && refined < aroundHz * 1.25 ? refined : sampleRate / bestLag;
};

const estimatePitch = (
  spectrum: Float32Array,
  sampleRate: number,
  fftSize: number,
  samples?: Float32Array,
  minHz = 55,
  maxHz = 960,
): { hz: number; confidence: number } => {
  const ratios = 120;
  const candidates = Math.ceil(ratios * Math.log2(maxHz / minHz));
  const spacing = Math.pow(maxHz / minHz, 1 / candidates);
  const scores = new Float32Array(candidates + 1);
  let bestIndex = 0;
  let bestScore = 0;
  let totalScore = 0;

  for (let i = 0; i <= candidates; i += 1) {
    const f0 = minHz * Math.pow(spacing, i);
    let score = 0;
    for (let h = 1; h <= 8; h += 1) {
      const frequency = f0 * h;
      if (frequency > sampleRate * 0.44) break;
      const weight = 1 / Math.pow(h, 0.4);
      score += weightedMagnitude(spectrum, frequency, sampleRate, fftSize) * weight;
    }
    if (f0 < 78) score *= 0.78 + 0.22 * (f0 / 78);
    scores[i] = score;
    totalScore += score;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  if (!bestScore) return { hz: 0, confidence: 0 };

  const left = scores[Math.max(0, bestIndex - 1)];
  const right = scores[Math.min(candidates, bestIndex + 1)];
  const denominator = left - 2 * bestScore + right;
  const delta = Math.abs(denominator) > 1e-9 ? (0.5 * (left - right)) / denominator : 0;
  const refined = minHz * Math.pow(spacing, bestIndex + clamp(delta, -1, 1));
  // A coarse 2048-point FFT snaps a pure low note to the nearest bin. Use the
  // parabolic peak only when that peak is prominent and close to the candidate,
  // so a missing fundamental still keeps its harmonic-sum estimate.
  const peak = interpolatedPeak(spectrum, refined, sampleRate, fftSize);
  const peakBin = Math.round((peak * fftSize) / sampleRate);
  let maxMagnitude = 0;
  for (let i = 1; i < spectrum.length; i += 1) {
    if (spectrum[i] > maxMagnitude) maxMagnitude = spectrum[i];
  }
  const prominent = (spectrum[peakBin] ?? 0) > maxMagnitude * 0.18;
  const ratio = peak / Math.max(1, refined);
  const corrected = prominent && ratio > 0.9 && ratio < 1.1 ? peak : refined;
  const average = totalScore / (candidates + 1) || 1e-8;
  const confidence = clamp(bestScore / average / 3.2, 0, 1);
  const hz = samples ? autocorrelationPitch(samples, sampleRate, corrected) : corrected;
  return { hz, confidence };
};

const spectralCentroid = (spectrum: Float32Array, sampleRate: number, fftSize: number): number => {
  let weighted = 0;
  let total = 0;
  for (let i = 2; i < spectrum.length; i += 1) {
    const frequency = (i * sampleRate) / fftSize;
    if (frequency > 12000) break;
    const magnitude = spectrum[i];
    weighted += frequency * magnitude;
    total += magnitude;
  }
  if (total <= 1e-8) return 0;
  return weighted / total;
};

const bandPower = (
  spectrum: Float32Array,
  sampleRate: number,
  fftSize: number,
  lowHz: number,
  highHz: number,
): number => {
  const start = Math.max(1, Math.floor((lowHz * fftSize) / sampleRate));
  const end = Math.min(spectrum.length - 1, Math.ceil((highHz * fftSize) / sampleRate));
  let sum = 0;
  for (let i = start; i <= end; i += 1) sum += spectrum[i] * spectrum[i];
  return sum;
};

const levelDb = (rms: number): number => (rms > 0 ? 20 * Math.log10(rms) : -120);

const noteLabel = (hz: number): { note: string; keyLabel: string; root: number } => {
  if (!hz) return { note: '—', keyLabel: '自由调性', root: -1 };
  const midi = 69 + 12 * Math.log2(hz / 440);
  const rounded = Math.round(midi);
  const root = ((rounded % 12) + 12) % 12;
  return {
    note: `${NOTE_NAMES[root]}${Math.floor(rounded / 12) - 1}`,
    keyLabel: NOTE_NAMES[root],
    root,
  };
};

const estimateKey = (chroma: number[]): { root: number; mode: number; score: number } => {
  let best = { root: 0, mode: 0, score: -Infinity };
  for (let mode = 0; mode < 2; mode += 1) {
    const profile = mode === 0 ? MINOR_PROFILE : MAJOR_PROFILE;
    for (let root = 0; root < 12; root += 1) {
      let score = 0;
      for (let pc = 0; pc < 12; pc += 1) {
        score += chroma[(pc + root) % 12] * profile[pc];
      }
      if (score > best.score) best = { root, mode, score };
    }
  }
  return best;
};

const buildPhrases = (
  frames: FeatureFrame[],
  onsets: number[],
  duration: number,
  sampleRate: number,
): Phrase[] => {
  const active = frames.filter((frame) => frame.active);
  if (!active.length) return [];

  // Phrases are the sounding spans, not the silences between them. A pause
  // becomes an empty hall through phrase.pauseAfter, never a phrase itself.
  const spans: { start: number; end: number }[] = [];
  let runStart = -1;
  for (let i = 0; i < frames.length; i += 1) {
    const frame = frames[i];
    if (frame.active && runStart === -1) runStart = frame.t;
    if (!frame.active && runStart !== -1) {
      const end = frames[i - 1]?.t ?? frame.t;
      if (end - runStart >= 0.24) spans.push({ start: runStart, end });
      runStart = -1;
    }
  }
  if (runStart !== -1) {
    const end = frames[frames.length - 1].t + 0.03;
    if (end - runStart >= 0.24) spans.push({ start: runStart, end });
  }

  if (!spans.length) {
    const count = duration < 8 ? 3 : Math.min(5, Math.max(3, Math.round(duration / 5)));
    for (let i = 0; i < count; i += 1) {
      spans.push({ start: (duration * i) / count, end: (duration * (i + 1)) / count });
    }
  } else if (spans.length === 1 && spans[0].end - spans[0].start > 11) {
    // A single sustained sound is still one breath, but long continuous takes
    // need architectural cadence; split only at its quietest interior moment.
    const span = spans[0];
    const inside = frames.filter(
      (frame) => frame.t > span.start + 1.2 && frame.t < span.end - 1.2,
    );
    if (inside.length) {
      const quietest = inside.reduce((best, frame) => (frame.rms < best.rms ? frame : best), inside[0]);
      const split = quietest.t;
      spans.splice(0, 1, { start: span.start, end: split }, { start: split, end: span.end });
    }
  }
  if (spans.length > 9) {
    const merged: { start: number; end: number }[] = [];
    const bucket = Math.ceil(spans.length / 7);
    for (let i = 0; i < spans.length; i += bucket) {
      merged.push({ start: spans[i].start, end: spans[Math.min(i + bucket - 1, spans.length - 1)].end });
    }
    spans.splice(0, spans.length, ...merged);
  }

  return spans.map((span, index) => {
    const inside = frames.filter((frame) => frame.t >= span.start - 0.02 && frame.t <= span.end + 0.02);
    const voiced = inside.filter((frame) => frame.pitch > 0);
    const totalEnergy = inside.reduce((sum, frame) => sum + frame.rms, 0) || 1;
    const pitch =
      voiced.reduce((sum, frame) => sum + frame.pitch * Math.max(0.01, frame.rms), 0) / totalEnergy ||
      estimateFallbackPitch(inside);
    const brightness =
      inside.reduce((sum, frame) => sum + frame.centroid * frame.rms, 0) / totalEnergy;
    const energy = clamp(
      inside.reduce((sum, frame) => sum + frame.rms, 0) / Math.max(1, inside.length) / 0.22,
      0,
      1,
    );
    const onsetsInside = onsets.filter((time) => time >= span.start && time <= span.end);
    const next = spans[index + 1];
    const pauseAfter = next ? Math.max(0, next.start - span.end) : Math.max(0, duration - span.end);
    const startPitch = voiced[0]?.pitch ?? pitch;
    const endPitch = voiced[voiced.length - 1]?.pitch ?? pitch;
    return {
      index,
      start: span.start,
      end: span.end,
      duration: span.end - span.start,
      energy,
      brightness: clamp(brightness, 0, 1),
      pitch: Math.round(pitch * 10) / 10,
      pitchNorm: clamp(Math.log2(Math.max(40, pitch) / 55) / Math.log2(1200 / 55), 0, 1),
      onsets: onsetsInside.length,
      pauseAfter,
      rise: clamp((endPitch - startPitch) / 220, -1, 1),
    };
  });
};

const estimateFallbackPitch = (frames: FeatureFrame[]): number => {
  const weighted = frames.reduce((sum, frame) => sum + frame.pitchNorm * frame.rms, 0);
  const total = frames.reduce((sum, frame) => sum + frame.rms, 0) || 1;
  return 55 * Math.pow(1200 / 55, clamp(weighted / total, 0, 1));
};

const computeBpm = (onsets: number[], duration: number): { bpm: number; regularity: number } => {
  if (onsets.length < 3) return { bpm: 68, regularity: 0.22 };
  const intervals: number[] = [];
  for (let i = 1; i < onsets.length; i += 1) {
    const interval = onsets[i] - onsets[i - 1];
    if (interval > 0.16 && interval < 2.4) intervals.push(interval);
  }
  if (!intervals.length) return { bpm: 72, regularity: 0.2 };
  const center = median(intervals);
  let bpm = 60 / center;
  while (bpm < 58) bpm *= 2;
  while (bpm > 168) bpm /= 2;
  bpm = clamp(bpm, 52, 176);
  const deviations = intervals.map((interval) => Math.abs(interval - center));
  const regularity = clamp(1 - median(deviations) / Math.max(0.15, center), 0, 1);
  return { bpm: Math.round(bpm), regularity };
};

const chooseCharacter = (summary: Omit<VoiceSummary, 'character' | 'characterEn'>): { zh: string; en: string } => {
  const candidates = [
    { value: summary.pitchMedian + summary.brightness * 120, zh: '上升', en: 'ASCENT' },
    { value: summary.low * 100 + summary.dynamicRange * 0.8, zh: '沉降', en: 'DESCENT' },
    { value: summary.silenceRatio * 170 + summary.pitchRange * 0.4, zh: '悬浮', en: 'SUSPENSION' },
    { value: summary.regularity * 80 + summary.onsetRate * 30, zh: '脉冲', en: 'PULSE' },
    { value: summary.brightness * 150 + summary.high * 60, zh: '辉光', en: 'AUREOLE' },
  ];
  candidates.sort((a, b) => b.value - a.value);
  return { zh: candidates[0].zh, en: candidates[0].en };
};

export interface AnalysisProgress {
  stage: number;
  progress: number;
  label: string;
}

export const analyzeBuffer = async (
  buffer: AudioBuffer,
  onProgress?: (progress: AnalysisProgress) => void,
): Promise<VoiceScore> => {
  const started = performance.now();
  const source = buffer.getChannelData(0);
  const channels = buffer.numberOfChannels;
  const length = source.length;
  const sampleRate = buffer.sampleRate;
  const frameSize = 2048;
  const hop = 1024;
  const frameCount = Math.max(1, Math.floor((length - frameSize) / hop) + 1);
  const mono = new Float32Array(length);
  for (let channel = 0; channel < channels; channel += 1) {
    const data = channel === 0 ? source : buffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) mono[i] += data[i] / channels;
  }

  const window = new Float32Array(frameSize);
  let windowSum = 0;
  for (let i = 0; i < frameSize; i += 1) {
    window[i] = 0.5 - 0.5 * Math.cos((TWO_PI * i) / (frameSize - 1));
    windowSum += window[i];
  }
  const windowNorm = 2 / windowSum;
  const fft = new FFT(frameSize);
  const real = new Float32Array(frameSize);
  const imag = new Float32Array(frameSize);
  const magnitudes = new Float32Array(frameSize / 2);
  let previousSpectrum = new Float32Array(frameSize / 2);

  const frames: FeatureFrame[] = [];
  let peak = 0;
  let totalRms = 0;
  let totalLow = 0;
  let totalMid = 0;
  let totalHigh = 0;
  let totalCentroid = 0;
  let totalFlux = 0;
  let activeCount = 0;
  const pitchSamples = new Float32Array(frameSize);

  for (let frame = 0; frame < frameCount; frame += 1) {
    const offset = frame * hop;
    let sumSquares = 0;
    for (let i = 0; i < frameSize; i += 1) {
      const sample = mono[offset + i] ?? 0;
      sumSquares += sample * sample;
      real[i] = sample * window[i];
      pitchSamples[i] = sample;
      imag[i] = 0;
    }
    const rms = Math.sqrt(sumSquares / frameSize);
    peak = Math.max(peak, rms);
    totalRms += rms;

    fft.transform(real, imag);
    let flux = 0;
    for (let i = 0; i < frameSize / 2; i += 1) {
      const magnitude = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) * windowNorm;
      magnitudes[i] = magnitude;
      const delta = magnitude - previousSpectrum[i];
      if (delta > 0) flux += delta;
    }
    flux /= frameSize / 2;
    previousSpectrum = magnitudes.slice();

    const lowPower = bandPower(magnitudes, sampleRate, frameSize, 30, 180);
    const midPower = bandPower(magnitudes, sampleRate, frameSize, 180, 1400);
    const highPower = bandPower(magnitudes, sampleRate, frameSize, 1400, 11000);
    const bandTotal = lowPower + midPower + highPower;
    const low = bandTotal > 1e-10 ? lowPower / bandTotal : 0;
    const mid = bandTotal > 1e-10 ? midPower / bandTotal : 0;
    const high = bandTotal > 1e-10 ? highPower / bandTotal : 0;
    const centroidHz = spectralCentroid(magnitudes, sampleRate, frameSize);
    const centroid = clamp(Math.log2(Math.max(40, centroidHz) / 80) / Math.log2(12000 / 80), 0, 1);
    const pitchResult = rms > 0.004 ? estimatePitch(magnitudes, sampleRate, frameSize, pitchSamples) : { hz: 0, confidence: 0 };
    const pitch = pitchResult.confidence > 0.05 ? pitchResult.hz : 0;

    totalLow += low;
    totalMid += mid;
    totalHigh += high;
    totalCentroid += centroid;

    frames.push({
      t: offset / sampleRate,
      rms,
      db: levelDb(rms),
      low,
      mid,
      high,
      centroid,
      flux,
      pitch,
      pitchNorm: clamp(Math.log2(Math.max(55, pitch || 55) / 55) / Math.log2(1200 / 55), 0, 1),
      onset: false,
      active: false,
    });

    if (frame % 80 === 0) {
      onProgress?.({
        stage: 1,
        progress: frame / frameCount,
        label: 'READING THE VOICE',
      });
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }

  const rmsValues = frames.map((frame) => frame.rms);
  const threshold = Math.max(0.006, percentile(rmsValues, 0.34) * 0.82, peak * 0.034);
  for (const frame of frames) {
    frame.active = frame.rms >= threshold;
    if (frame.active) activeCount += 1;
  }

  const fluxValues = frames.map((frame) => frame.flux);
  const fluxMedian = median(fluxValues);
  const fluxMean = fluxValues.reduce((sum, value) => sum + value, 0) / Math.max(1, fluxValues.length);
  const fluxStd = Math.sqrt(
    fluxValues.reduce((sum, value) => sum + Math.pow(value - fluxMean, 2), 0) / Math.max(1, fluxValues.length),
  );
  const onsetThreshold = fluxMedian + fluxStd * 0.75;
  const onsets: number[] = [];
  let lastOnset = -1;
  for (let i = 1; i < frames.length - 1; i += 1) {
    const frame = frames[i];
    if (!frame.active) continue;
    if (frame.t - lastOnset < 0.105) continue;
    const local = frames.slice(Math.max(0, i - 8), i + 1);
    const localMean = local.reduce((sum, item) => sum + item.flux, 0) / local.length;
    const risingEnergy = frame.rms > frames[i - 1].rms * 1.15 || frame.flux > localMean * 1.35;
    if (frame.flux > onsetThreshold && risingEnergy) {
      frame.onset = true;
      onsets.push(frame.t);
      lastOnset = frame.t;
      totalFlux += frame.flux;
    }
  }

  onProgress?.({ stage: 2, progress: 0.75, label: 'MAPPING THE SPACE' });
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  const phrases = buildPhrases(frames, onsets, buffer.duration, sampleRate);
  const voicedPitch = frames.filter((frame) => frame.pitch > 0).map((frame) => frame.pitch);
  const pitchMedian = median(voicedPitch);
  const pitchMin = voicedPitch.length ? percentile(voicedPitch, 0.08) : 0;
  const pitchMax = voicedPitch.length ? percentile(voicedPitch, 0.92) : 0;
  const pitchRange = pitchMin && pitchMax ? 12 * Math.log2(pitchMax / pitchMin) : 0;
  const dynamicRange = percentile(frames.map((frame) => frame.db), 0.94) - percentile(frames.map((frame) => frame.db), 0.1);
  const silenceRatio = 1 - activeCount / Math.max(1, frames.length);
  const bpmInfo = computeBpm(onsets, buffer.duration);
  const avgFrameCount = Math.max(1, frames.length);
  const low = totalLow / avgFrameCount;
  const mid = totalMid / avgFrameCount;
  const high = totalHigh / avgFrameCount;
  const brightness = clamp(totalCentroid / avgFrameCount, 0, 1);
  const note = noteLabel(pitchMedian);

  const chroma = new Array(12).fill(0);
  for (const frame of frames) {
    if (!frame.pitch || !frame.active) continue;
    const midi = Math.round(69 + 12 * Math.log2(frame.pitch / 440));
    const pc = ((midi % 12) + 12) % 12;
    chroma[pc] += frame.rms;
  }
  const key = estimateKey(chroma);
  const keyLabel = note.root >= 0 ? `${NOTE_NAMES[key.root]} · ${MODE_ZH[key.mode]}` : '自由调性';

  const baseSummary: Omit<VoiceSummary, 'character' | 'characterEn'> = {
    duration: buffer.duration,
    sampleRate,
    peak,
    rms: totalRms / avgFrameCount,
    db: levelDb(totalRms / avgFrameCount),
    dynamicRange: clamp(dynamicRange, 0, 96),
    pitchMedian: Math.round(pitchMedian * 10) / 10,
    pitchMin: Math.round(pitchMin * 10) / 10,
    pitchMax: Math.round(pitchMax * 10) / 10,
    pitchRange: Math.round(pitchRange * 10) / 10,
    brightness,
    low,
    mid,
    high,
    silenceRatio,
    onsetRate: onsets.length / Math.max(1, buffer.duration),
    bpm: bpmInfo.bpm,
    density: clamp(onsets.length / Math.max(1, buffer.duration) / 3.4, 0, 1),
    regularity: bpmInfo.regularity,
    warmth: clamp(low / Math.max(0.001, low + high), 0, 1),
    rootNote: note.note,
    keyLabel,
  };
  const character = chooseCharacter(baseSummary);
  const summary: VoiceSummary = {
    ...baseSummary,
    character: character.zh,
    characterEn: character.en,
  };

  const waveform = new Array(180).fill(0);
  const bucket = Math.max(1, Math.floor(frames.length / waveform.length));
  for (let i = 0; i < waveform.length; i += 1) {
    let max = 0;
    for (let j = i * bucket; j < Math.min(frames.length, (i + 1) * bucket); j += 1) {
      max = Math.max(max, frames[j].rms);
    }
    waveform[i] = clamp(max / Math.max(0.002, peak), 0, 1);
  }

  const fingerprintSource = [
    Math.round(summary.pitchMedian),
    Math.round(summary.bpm),
    Math.round(summary.brightness * 100),
    Math.round(summary.silenceRatio * 100),
    Math.round(summary.dynamicRange),
    onsets.slice(0, 28).map((time) => Math.round(time * 10)).join(','),
    phrases.map((phrase) => `${Math.round(phrase.energy * 100)}:${Math.round(phrase.pitch)}`).join('|'),
  ].join('::');
  const fingerprint = hashString(fingerprintSource).toString(16).padStart(8, '0');

  return {
    version: 1,
    duration: buffer.duration,
    frames,
    onsets,
    phrases,
    summary,
    fingerprint,
    waveform,
    analysisMs: Math.round(performance.now() - started),
  };
};

export const analyseLive = (
  frequencyData: Float32Array,
  timeData: Float32Array,
  sampleRate: number,
  fftSize: number,
): LiveFeature => {
  let sumSquares = 0;
  for (let i = 0; i < timeData.length; i += 1) sumSquares += timeData[i] * timeData[i];
  const rms = Math.sqrt(sumSquares / Math.max(1, timeData.length));
  const spectrum = new Float32Array(frequencyData.length);
  for (let i = 0; i < frequencyData.length; i += 1) {
    spectrum[i] = Math.pow(10, frequencyData[i] / 20);
  }
  const lowPower = bandPower(spectrum, sampleRate, fftSize, 30, 180);
  const midPower = bandPower(spectrum, sampleRate, fftSize, 180, 1400);
  const highPower = bandPower(spectrum, sampleRate, fftSize, 1400, 11000);
  const totalPower = lowPower + midPower + highPower;
  const low = totalPower > 1e-12 ? lowPower / totalPower : 0;
  const mid = totalPower > 1e-12 ? midPower / totalPower : 0;
  const high = totalPower > 1e-12 ? highPower / totalPower : 0;
  const centroidHz = spectralCentroid(spectrum, sampleRate, fftSize);
  const centroid = clamp(Math.log2(Math.max(40, centroidHz) / 80) / Math.log2(12000 / 80), 0, 1);
  const pitch = rms > 0.009 ? estimatePitch(spectrum, sampleRate, fftSize, timeData).hz : 0;
  return {
    rms: clamp(rms * 3.2, 0, 1),
    low,
    mid,
    high,
    centroid,
    pitch,
    pitchNorm: clamp(Math.log2(Math.max(55, pitch || 55) / 55) / Math.log2(1200 / 55), 0, 1),
    onset: false,
  };
};

export const createDemoScoreFromSeed = (seed: number): VoiceScore => {
  // Used only for opening a shared link without the original audio. It rebuilds
  // the same architectural language from the design payload; this fallback is
  // never used for a locally generated piece.
  const rng = makeRng(seed);
  const duration = 28;
  const frames: FeatureFrame[] = Array.from({ length: 280 }, (_, index) => {
    const t = (index / 280) * duration;
    const active = Math.sin(index * 0.17 + rng() * 0.2) > -0.55;
    return {
      t,
      rms: active ? 0.08 + rng() * 0.12 : 0.004,
      db: active ? -22 : -70,
      low: rng(),
      mid: rng(),
      high: rng(),
      centroid: 0.25 + rng() * 0.5,
      flux: rng() * 0.1,
      pitch: active ? 110 + rng() * 220 : 0,
      pitchNorm: active ? rng() : 0,
      onset: false,
      active,
    };
  });
  const summary: VoiceSummary = {
    duration,
    sampleRate: 48000,
    peak: 0.2,
    rms: 0.1,
    db: -20,
    dynamicRange: 38,
    pitchMedian: 180,
    pitchMin: 90,
    pitchMax: 400,
    pitchRange: 27,
    brightness: 0.54,
    low: 0.6,
    mid: 0.5,
    high: 0.4,
    silenceRatio: 0.18,
    onsetRate: 1.2,
    bpm: 76,
    density: 0.34,
    regularity: 0.55,
    warmth: 0.6,
    rootNote: 'F2',
    keyLabel: 'F · 小调',
    character: '悬浮',
    characterEn: 'SUSPENSION',
  };
  return {
    version: 1,
    duration,
    frames,
    onsets: [],
    phrases: [],
    summary,
    fingerprint: seed.toString(16).padStart(8, '0'),
    waveform: Array.from({ length: 180 }, () => 0.2 + rng() * 0.8),
    analysisMs: 0,
  };
};
