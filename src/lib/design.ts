import {
  clamp,
  styleByKey,
  type ArchSpec,
  type BridgeSpec,
  type ChamberSpec,
  type ColumnSpec,
  type DesignSpec,
  type Phrase,
  type RingSpec,
  type ShardSpec,
  type StairSpec,
  type StyleKey,
  type VoiceScore,
} from '../types';
import { hashString } from './analysis';

const TAU = Math.PI * 2;

const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pick = <T>(rng: () => number, values: readonly T[]): T =>
  values[Math.min(values.length - 1, Math.floor(rng() * values.length))];

const resample = (values: number[], length: number): number[] => {
  if (!values.length) return new Array(length).fill(0);
  return Array.from({ length }, (_, index) => {
    const position = (index / Math.max(1, length - 1)) * (values.length - 1);
    const left = Math.floor(position);
    const right = Math.min(values.length - 1, left + 1);
    const mix = position - left;
    return values[left] + (values[right] - values[left]) * mix;
  });
};

const safePhrases = (score: VoiceScore): Phrase[] => {
  if (score.phrases.length >= 3) return score.phrases.slice(0, 9);
  const count = clamp(score.phrases.length + 2, 3, 6);
  const duration = score.duration;
  return Array.from({ length: count }, (_, index) => {
    const start = (duration * index) / count;
    const end = (duration * (index + 1)) / count;
    const inside = score.frames.filter((frame) => frame.t >= start && frame.t <= end);
    const energy = clamp(
      inside.reduce((sum, frame) => sum + frame.rms, 0) / Math.max(1, inside.length) / 0.2,
      0.15,
      1,
    );
    const pitch = score.summary.pitchMedian || 165;
    return {
      index,
      start,
      end,
      duration: end - start,
      energy,
      brightness: score.summary.brightness,
      pitch,
      pitchNorm: clamp(Math.log2(Math.max(55, pitch) / 55) / Math.log2(1200 / 55), 0, 1),
      onsets: Math.round(score.onsets.length / count),
      pauseAfter: duration / count / 4,
      rise: 0.1,
    };
  });
};

const titleForStyle = (
  style: StyleKey,
  seed: number,
  summary: VoiceScore['summary'],
): { name: string; nameZh: string } => {
  const rng = mulberry32(seed);
  const english: Record<StyleKey, string[]> = {    crystal: [
      'VESPER OF THE LOW ARC',
      'AUREOLE IN THREE BREATHS',
      'THE PALE RELIQUARY',
      'NOCTURNE FOR AN EMPTY NAVE',
      'CATHEDRAL OF SLOW LIGHT',
      'THE SUSPENDED CHOIR',
    ],
    machine: [
      'ENGINE OF FIRST LIGHT',
      'THE PULSE ASSEMBLY',
      'MERIDIAN / SIGNAL 07',
      'A MACHINE FOR LISTENING',
      'THE CALIBRATION HALL',
      'ORBITAL FOUNDRY',
    ],
    organic: [
      'THE BREATHING REEF',
      'MEMBRANE FOR A SINGLE VOICE',
      'A SOFT MACHINE GROWS',
      'THE TIDAL CHAMBER',
      'SHELL OF HELD AIR',
      'WHERE THE VOICE SETTLES',
    ],
  };
  const chinese: Record<StyleKey, string[]> = {
    crystal: ['低拱的晚祷', '缓息的光环', '苍白圣髑堂', '空殿夜曲', '慢光大教堂', '悬浮唱诗席'],
    machine: ['初光引擎', '脉冲装配体', '子午线 / 信号 07', '聆听机器', '校准大厅', '轨道铸造厂'],
    organic: ['呼吸礁', '独声之膜', '柔软机器生长时', '潮汐腔体', '持气的壳', '声音停靠之处'],
  };
  const offset = Math.floor(rng() * english[style].length);
  return {
    name: english[style][offset % english[style].length],
    nameZh: pick(rng, chinese[style]),
  };
};

const characterDescription = (score: VoiceScore, design: Omit<DesignSpec, 'description' | 'name' | 'nameZh'>): string => {
  const { summary } = score;
  const parts: string[] = [];
  parts.push(`${design.archCount} 道拱肋从 ${summary.rootNote === '—' ? '无声' : summary.rootNote} 的音高生长`);
  parts.push(`${design.phraseMarks.length} 次呼吸围合成侧殿`);
  const pauses = design.phraseMarks.filter((mark) => mark.pause > 0.3).length;
  if (summary.silenceRatio > 0.16 && pauses > 0) {
    parts.push(`停顿留下 ${pauses} 座空厅`);
  } else {
    parts.push('几乎没有停顿，整座建筑保持连续');
  }
  if (summary.high > 0.22 || summary.brightness > 0.32) {
    parts.push(`${design.columnCount} 根高频光柱刺入穹顶`);
  }
  return parts.join('，') + '。';
};

export const buildDesign = (score: VoiceScore, style: StyleKey): DesignSpec => {
  const summary = score.summary;
  const phrases = safePhrases(score);
  const seed = hashString(`${score.fingerprint}:${style}:${Math.round(summary.pitchMedian)}`);
  const rng = mulberry32(seed);
  const meta = styleByKey(style);
  const energy = clamp(summary.rms / 0.2, 0.08, 1);
  const pitchGlobal = clamp(
    Math.log2(Math.max(55, summary.pitchMedian || 110) / 55) / Math.log2(1200 / 55),
    0,
    1,
  );
  const rhythm = summary.density;
  const silence = summary.silenceRatio;

  const scale = clamp(0.88 + energy * 0.32, 0.9, 1.2);
  const height = (17 + pitchGlobal * 8 + energy * 4.5) * scale;
  const radius = (12.2 + energy * 3.6 + (1 - silence) * 2.1) * scale;
  const symmetry = clamp(6 + Math.round(summary.regularity * 4 + summary.brightness * 3), 6, 12);
  const archCount =
    style === 'machine'
      ? clamp(6 + Math.round(summary.regularity * 3), 6, 9)
      : clamp(7 + Math.round(summary.brightness * 4), 7, 12);
  const chamberCount = clamp(phrases.length + (summary.duration > 18 ? 1 : 0), 3, 8);
  const columnCount = clamp(
    Math.round(16 + summary.high * 26 + rhythm * 16 + (style === 'machine' ? 8 : 0)),
    20,
    58,
  );
  const stairSteps = clamp(Math.round(22 + score.onsets.length * 0.9 + energy * 10), 24, 66);
  const particleCount = clamp(
    Math.round(900 + summary.high * 3200 + rhythm * 1800 + (style === 'organic' ? 600 : 0)),
    700,
    5600,
  );
  const spireCount = clamp(2 + Math.round(summary.pitchRange / 8), 2, 6);
  const ribbonCount = clamp(3 + Math.round(summary.pitchRange / 5), 3, 9);
  const ringCount = clamp(3 + Math.round(summary.dynamicRange / 12), 3, 9);

  const phraseWeightTotal = phrases.reduce(
    (sum, phrase) => sum + Math.max(0.55, phrase.duration) + phrase.pauseAfter * 0.7,
    0,
  );
  let cursor = rng() * TAU;
  const chamberAngles: number[] = [];
  for (let i = 0; i < chamberCount; i += 1) {
    const phrase = phrases[i % phrases.length];
    const portion = (Math.max(0.55, phrase.duration) + phrase.pauseAfter * 0.7) / phraseWeightTotal;
    chamberAngles.push(cursor);
    cursor += portion * TAU * (style === 'organic' ? 0.92 : 1);
  }

  const arches: ArchSpec[] = Array.from({ length: archCount }, (_, index) => {
    const phrase = phrases[index % phrases.length];
    const pitchNorm = phrase.pitchNorm || pitchGlobal;
    const jitter = (rng() - 0.5) * 0.06;
    return {
      angle: (index / archCount) * TAU + jitter + (style === 'crystal' ? 0.06 : 0),
      height: height * (0.76 + pitchNorm * 0.27) * (style === 'crystal' ? 1.02 : 1),
      span: radius * (0.82 + phrase.energy * 0.2),
      width: 0.28 + phrase.energy * 0.34 + (style === 'crystal' ? -0.06 : 0.08),
      depth: 0.72 + summary.low * 0.9,
      birth: phrase.start,
      tone: clamp(phrase.brightness, 0.1, 0.95),
      pitch: phrase.pitch,
    };
  });

  const chambers: ChamberSpec[] = Array.from({ length: chamberCount }, (_, index) => {
    const phrase = phrases[index % phrases.length];
    const pause = phrase.pauseAfter + (rng() - 0.5) * 0.12;
    return {
      angle: chamberAngles[index],
      radius: radius * (0.68 + (index % 2) * 0.1 + rng() * 0.05),
      height: (3.4 + phrase.energy * 3.8 + phrase.pitchNorm * 3.2) * scale,
      width: (2.1 + phrase.energy * 2.2 + summary.low * 0.9) * scale,
      birth: phrase.start,
      pauseAfter: Math.max(0, pause),
      energy: phrase.energy,
      tone: phrase.brightness,
      floors: clamp(1 + Math.round(phrase.onsets / 5), 1, 3),
    };
  });

  const columns: ColumnSpec[] = Array.from({ length: columnCount }, (_, index) => {
    const frameIndex = Math.min(
      score.frames.length - 1,
      Math.max(0, Math.round((index / Math.max(1, columnCount - 1)) * (score.frames.length - 1))),
    );
    const frame = score.frames[frameIndex];
    const phrase = phrases[Math.floor((index / columnCount) * phrases.length)] ?? phrases[0];
    const tone = frame ? clamp(frame.high * 0.65 + frame.centroid * 0.6, 0.08, 1) : 0.4;
    return {
      angle: (index / columnCount) * TAU + (rng() - 0.5) * 0.06,
      radius: radius * (0.92 + rng() * 0.12),
      height: height * (0.32 + (frame?.pitchNorm ?? 0.4) * 0.55 + (rng() - 0.5) * 0.05),
      thickness: (0.09 + summary.low * 0.1 + (style === 'machine' ? 0.06 : 0)) * scale,
      birth: (frame?.t ?? phrase.start) * 0.58,
      tone,
      kind: Math.floor(rng() * 3),
    };
  });

  const rings: RingSpec[] = Array.from({ length: ringCount }, (_, index) => {
    const phrase = phrases[index % phrases.length];
    return {
      y: height * (0.26 + (index / Math.max(1, ringCount - 1)) * 0.58) + (rng() - 0.5) * 1.2,
      radius: radius * (0.26 + rng() * 0.48),
      thickness: 0.045 + rng() * 0.09 + summary.low * 0.06,
      tilt: (rng() - 0.5) * (style === 'machine' ? 0.5 : 0.16),
      birth: phrase.start + (index / ringCount) * (score.duration * 0.25),
      kind: index % 3,
    };
  });

  const shards: ShardSpec[] = Array.from({ length: clamp(12 + Math.round(summary.high * 26), 12, 36) }, (_, index) => {
    const phrase = phrases[index % phrases.length];
    const angle = rng() * TAU;
    const shardRadius = radius * (0.18 + rng() * 0.8);
    return {
      angle,
      radius: shardRadius,
      y: 2 + rng() * height * 0.86,
      size: 0.18 + rng() * 0.64 + summary.high * 0.4,
      birth: phrase.start + rng() * Math.max(0.2, phrase.duration),
      tone: clamp(phrase.brightness + (rng() - 0.5) * 0.3, 0.08, 1),
      spin: rng() * TAU,
    };
  });

  const stairBirth = (phrases[Math.min(1, phrases.length - 1)]?.start ?? 0) * 0.55;
  const stairHeight = height * (0.44 + summary.regularity * 0.12);
  const stairs: StairSpec = {
    steps: stairSteps,
    turns: 2.1 + summary.regularity * 1.4 + energy * 0.35,
    radius: 2.7 + summary.low * 2.1,
    height: stairHeight,
    birth: stairBirth,
    stepBirths: Array.from({ length: stairSteps }, (_, index) => {
      const onset = score.onsets[index % Math.max(1, score.onsets.length)];
      const fallback = stairBirth + (index / stairSteps) * (score.duration - stairBirth) * 0.72;
      return onset ? stairBirth + (onset / Math.max(0.1, score.duration)) * (score.duration - stairBirth) : fallback;
    }),
    direction: rng() > 0.5 ? 1 : -1,
  };

  const bridgeCount = clamp(Math.round(chamberCount / 2), 2, 4);
  const bridges: BridgeSpec[] = Array.from({ length: bridgeCount }, (_, index) => {
    const chamber = chambers[(index * 2) % chambers.length];
    const y = height * (0.22 + index * 0.1);
    const targetAngle = chamber.angle + (rng() > 0.5 ? 0.3 : -0.3);
    return {
      fromAngle: chamber.angle,
      toAngle: targetAngle,
      radius: chamber.radius,
      y,
      length: chamber.radius - stairs.radius * 0.7,
      birth: chamber.birth + chamber.height * 0.02,
      tone: chamber.tone,
    };
  });

  const pulse = resample(
    score.frames.map((frame) => clamp(frame.rms * 4.2, 0, 1)),
    128,
  );
  const phraseMarks = (score.phrases.length ? score.phrases : phrases).map((phrase) => ({
    t: phrase.start,
    energy: phrase.energy,
    brightness: phrase.brightness,
    pause: phrase.pauseAfter,
  }));

  const title = titleForStyle(style, seed, summary);

  const partial: Omit<DesignSpec, 'description'> = {
    v: 1,
    seed,
    style,
    name: title.name,
    nameZh: title.nameZh,
    fingerprint: score.fingerprint,
    duration: score.duration,
    scale,
    height,
    radius,
    symmetry,
    archCount,
    chamberCount,
    columnCount,
    stairSteps,
    particleCount,
    spireCount,
    ribbonCount,
    ringCount,
    arches,
    chambers,
    columns,
    rings,
    shards,
    stairs,
    bridges,
    pulse,
    phraseMarks,
    metrics: summary,
    palette: meta.palette,
  };

  return {
    ...partial,
    description: characterDescription(score, partial),
  };
};

export const designFromBlueprint = (  fingerprint: string,
  style: StyleKey,
  summary: VoiceScore['summary'],
  phrases: Phrase[],
  pulse: number[],
): DesignSpec => {
  const frames = pulse.map((value, index) => ({
    t: (index / Math.max(1, pulse.length - 1)) * summary.duration,
    rms: value / 4.2,
    db: -30,
    low: summary.low,
    mid: summary.mid,
    high: value * summary.high,
    centroid: summary.brightness,
    flux: 0,
    pitch: summary.pitchMedian,
    pitchNorm: Math.log2(Math.max(55, summary.pitchMedian) / 55) / Math.log2(1200 / 55),
    onset: false,
    active: value > 0.08,
  }));
  const score: VoiceScore = {
    version: 1,
    duration: summary.duration,
    frames,
    onsets: phrases.flatMap((phrase) => Array.from({ length: phrase.onsets }, (_, index) => phrase.start + (phrase.duration * index) / Math.max(1, phrase.onsets))),
    phrases,
    summary,
    fingerprint,
    waveform: pulse,
    analysisMs: 0,
  };
  return buildDesign(score, style);
};

export const scoreFromDesign = (design: DesignSpec): VoiceScore => {
  const pulse = design.pulse.length ? design.pulse : [0.1];
  const frames = pulse.map((value, index) => {
    const t = (index / Math.max(1, pulse.length - 1)) * design.duration;
    return {
      t,
      rms: Math.max(0.002, value / 4.2),
      db: value > 0.08 ? -24 : -68,
      low: design.metrics.low,
      mid: design.metrics.mid,
      high: value * design.metrics.high,
      centroid: design.metrics.brightness,
      flux: 0,
      pitch: design.metrics.pitchMedian,
      pitchNorm: Math.log2(Math.max(55, design.metrics.pitchMedian) / 55) / Math.log2(1200 / 55),
      onset: false,
      active: value > 0.08,
    };
  });
  const marks = design.phraseMarks.length
    ? design.phraseMarks
    : [{ t: 0, energy: 0.5, brightness: design.metrics.brightness, pause: 0 }];
  const phrases: Phrase[] = marks.map((mark, index) => {
    const next = marks[index + 1];
    const end = next ? next.t : design.duration;
    return {
      index,
      start: mark.t,
      end,
      duration: Math.max(0.12, end - mark.t),
      energy: mark.energy,
      brightness: mark.brightness,
      pitch: design.metrics.pitchMedian,
      pitchNorm: Math.log2(Math.max(55, design.metrics.pitchMedian) / 55) / Math.log2(1200 / 55),
      onsets: Math.max(1, Math.round(mark.energy * 5)),
      pauseAfter: mark.pause,
      rise: 0.1,
    };
  });
  const onsets = phrases.flatMap((phrase) =>
    Array.from({ length: phrase.onsets }, (_, index) => phrase.start + (phrase.duration * index) / phrase.onsets),
  );
  return {
    version: 1,
    duration: design.duration,
    frames,
    onsets,
    phrases,
    summary: design.metrics,
    fingerprint: design.fingerprint,
    waveform: pulse,
    analysisMs: 0,
  };
};
