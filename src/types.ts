export type StyleKey = 'crystal' | 'machine' | 'organic';

export type Phase =
  | 'intro'
  | 'recording'
  | 'analyzing'
  | 'composing'
  | 'ready'
  | 'error';

export type CameraMode = 'orbit' | 'roam' | 'guide';

export type QualityTier = 'high' | 'balanced' | 'low';

export interface StyleMeta {
  key: StyleKey;
  index: string;
  label: string;
  labelEn: string;
  tagline: string;
  description: string;
  accent: string;
  accentRgb: [number, number, number];
  palette: string[];
  materials: string;
}

export const STYLES: StyleMeta[] = [
  {
    key: 'crystal',
    index: '01',
    label: '水晶圣殿',
    labelEn: 'CRYSTAL SANCTUM',
    tagline: '光穿过声音的骨骼',
    description:
      '尖拱、悬浮晶簇与乳白石材。低频凝成厚重的拱券，高频化作穿过拱顶的细光。像一座刚刚从海底升起的教堂。',
    accent: '#d9c79d',
    accentRgb: [217, 199, 157],
    palette: ['#080a0b', '#d8c497', '#9dd7de', '#e9e5da', '#57504a'],
    materials: '洞石 / 烟晶 / 抛光黄铜',
  },
  {
    key: 'machine',
    index: '02',
    label: '未来机械',
    labelEn: 'NEO MACHINE',
    tagline: '一座为信号而建的机器',
    description:
      '分段式承重环、钛合金骨架与精密光栅。节奏成为舱段的排列语法，每一拍都在校准这座仍在运转的声音机器。',
    accent: '#76e5ff',
    accentRgb: [118, 229, 255],
    palette: ['#05070a', '#6ee7ff', '#ff7a45', '#9aa6b2', '#e4f4ff'],
    materials: '枪灰钛 / 阳极氧化铝 / 信号灯',
  },
  {
    key: 'organic',
    index: '03',
    label: '流体有机',
    labelEn: 'FLUID ORGANIC',
    tagline: '声音在这里呼吸',
    description:
      '没有一条直线。声带般的膜、珍珠母贝的弧面与缓慢开合的腔体，让建筑呈现出近似生物的温柔与不安。',
    accent: '#f2b0a0',
    accentRgb: [242, 176, 160],
    palette: ['#080809', '#f0b4a2', '#81c9bd', '#efe0d4', '#6d554f'],
    materials: '珠母贝 / 半透膜 / 拉丝银',
  },
];

export const styleByKey = (key: StyleKey): StyleMeta =>
  STYLES.find((style) => style.key === key) ?? STYLES[0];

export interface FeatureFrame {
  t: number;
  rms: number;
  db: number;
  low: number;
  mid: number;
  high: number;
  centroid: number;
  flux: number;
  pitch: number;
  pitchNorm: number;
  onset: boolean;
  active: boolean;
}

export interface Phrase {
  index: number;
  start: number;
  end: number;
  duration: number;
  energy: number;
  brightness: number;
  pitch: number;
  pitchNorm: number;
  onsets: number;
  pauseAfter: number;
  rise: number;
}

export interface VoiceSummary {
  duration: number;
  sampleRate: number;
  peak: number;
  rms: number;
  db: number;
  dynamicRange: number;
  pitchMedian: number;
  pitchMin: number;
  pitchMax: number;
  pitchRange: number;
  brightness: number;
  low: number;
  mid: number;
  high: number;
  silenceRatio: number;
  onsetRate: number;
  bpm: number;
  density: number;
  regularity: number;
  warmth: number;
  rootNote: string;
  keyLabel: string;
  character: string;
  characterEn: string;
}

export interface VoiceScore {
  version: number;
  duration: number;
  frames: FeatureFrame[];
  onsets: number[];
  phrases: Phrase[];
  summary: VoiceSummary;
  fingerprint: string;
  waveform: number[];
  analysisMs: number;
}

export interface ArchSpec {
  angle: number;
  height: number;
  span: number;
  width: number;
  depth: number;
  birth: number;
  tone: number;
  pitch: number;
}

export interface ChamberSpec {
  angle: number;
  radius: number;
  height: number;
  width: number;
  birth: number;
  pauseAfter: number;
  energy: number;
  tone: number;
  floors: number;
}

export interface ColumnSpec {
  angle: number;
  radius: number;
  height: number;
  thickness: number;
  birth: number;
  tone: number;
  kind: number;
}

export interface RingSpec {
  y: number;
  radius: number;
  thickness: number;
  tilt: number;
  birth: number;
  kind: number;
}

export interface ShardSpec {
  angle: number;
  radius: number;
  y: number;
  size: number;
  birth: number;
  tone: number;
  spin: number;
}

export interface StairSpec {
  steps: number;
  turns: number;
  radius: number;
  height: number;
  birth: number;
  stepBirths: number[];
  direction: number;
}

export interface BridgeSpec {
  fromAngle: number;
  toAngle: number;
  radius: number;
  y: number;
  length: number;
  birth: number;
  tone: number;
}

export interface DesignSpec {
  v: number;
  seed: number;
  style: StyleKey;
  name: string;
  nameZh: string;
  fingerprint: string;
  duration: number;
  scale: number;
  height: number;
  radius: number;
  symmetry: number;
  archCount: number;
  chamberCount: number;
  columnCount: number;
  stairSteps: number;
  particleCount: number;
  spireCount: number;
  ribbonCount: number;
  ringCount: number;
  arches: ArchSpec[];
  chambers: ChamberSpec[];
  columns: ColumnSpec[];
  rings: RingSpec[];
  shards: ShardSpec[];
  stairs: StairSpec;
  bridges: BridgeSpec[];
  pulse: number[];
  phraseMarks: { t: number; energy: number; brightness: number; pause: number }[];
  metrics: VoiceSummary;
  palette: string[];
  description: string;
}

export interface MaterialParams {
  gloss: number;
  transmission: number;
  exposure: number;
  bloom: number;
  clarity: number;
}

export interface LightParams {
  key: number;
  rim: number;
  warmth: number;
  ambient: number;
}

export interface ExperienceSettings {
  style: StyleKey;
  materials: MaterialParams;
  lights: LightParams;
  quality: QualityTier;
  autoRotate: boolean;
}

export const DEFAULT_MATERIALS: MaterialParams = {
  gloss: 0.68,
  transmission: 0.5,
  exposure: 1.0,
  bloom: 0.52,
  clarity: 0.5,
};

export const DEFAULT_LIGHTS: LightParams = {
  key: 1,
  rim: 0.9,
  warmth: 0.5,
  ambient: 0.45,
};

export interface UserPreset {
  id: string;
  title: string;
  createdAt: number;
  design: DesignSpec;
  settings: ExperienceSettings;
}

export interface LiveFeature {
  rms: number;
  low: number;
  mid: number;
  high: number;
  centroid: number;
  pitch: number;
  pitchNorm: number;
  onset: boolean;
}

export const EMPTY_LIVE: LiveFeature = {
  rms: 0,
  low: 0,
  mid: 0,
  high: 0,
  centroid: 0.25,
  pitch: 0,
  pitchNorm: 0,
  onset: false,
};

export interface AudioPayload {
  kind: 'demo' | 'microphone' | 'file';
  buffer: AudioBuffer;
  fileName: string;
  mimeType: string;
}

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const smoothstep = (t: number): number => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

export const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const noteName = (frequency: number): string => {
  if (!frequency || frequency < 20) return '—';
  const notes = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const midi = 69 + 12 * Math.log2(frequency / 440);
  const rounded = Math.round(midi);
  const octave = Math.floor(rounded / 12) - 1;
  return `${notes[((rounded % 12) + 12) % 12]}${octave}`;
};
