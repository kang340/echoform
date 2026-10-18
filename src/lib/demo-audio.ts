/**
 * ECHOFORM's built-in étude is synthesized entirely in the browser at runtime.
 * No third-party recording or sample library is embedded, so the demo is
 * original, deterministic and free to redistribute with the project.
 *
 * The renderer writes PCM directly instead of relying on OfflineAudioContext:
 * it is faster, deterministic and cannot stall when the browser's audio service
 * is busy or the tab has been backgrounded.
 */
export const DEMO_DURATION = 32;

const RATE = 32000;
const TAU = Math.PI * 2;
const LENGTH = Math.floor(RATE * DEMO_DURATION);

const midi = (note: number): number => 440 * Math.pow(2, (note - 69) / 12);
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

type Wave = 'sine' | 'triangle' | 'saw';

interface VoiceOptions {
  start: number;
  duration: number;
  frequency: number;
  gain: number;
  pan?: number;
  wave?: Wave;
  attack?: number;
  release?: number;
  filter?: number;
  vibrato?: number;
  partials?: { ratio: number; gain: number; wave?: Wave }[];
}

const panGains = (pan: number): [number, number] => {
  const angle = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4;
  return [Math.cos(angle), Math.sin(angle)];
};

const waveform = (wave: Wave, phase: number): number => {
  if (wave === 'sine') return Math.sin(phase);
  if (wave === 'triangle') return (2 / Math.PI) * Math.asin(Math.sin(phase));
  const wrapped = phase / TAU;
  return 2 * (wrapped - Math.floor(wrapped + 0.5));
};

interface Mix {
  left: Float32Array;
  right: Float32Array;
}

const addVoice = (mix: Mix, options: VoiceOptions): void => {
  const {
    start,
    duration,
    frequency,
    gain,
    pan = 0,
    wave = 'sine',
    attack = 0.08,
    release = 0.6,
    filter = 4200,
    vibrato = 0,
    partials = [{ ratio: 1, gain: 1, wave }],
  } = options;
  if (duration <= 0 || frequency <= 0) return;
  const [leftGain, rightGain] = panGains(pan);
  const from = Math.max(0, Math.floor(start * RATE));
  const to = Math.min(LENGTH, Math.ceil((start + duration + release) * RATE));
  if (to <= from) return;

  partials.forEach((partial) => {
    const ratio = partial.ratio || 1;
    const partialWave = partial.wave ?? wave;
    const partialGain = gain * (partial.gain ?? 1);
    if (partialGain <= 0.00001) return;
    const omega = (TAU * frequency * ratio) / RATE;
    const alpha = 1 - Math.exp((-TAU * Math.min(filter * ratio, RATE * 0.46)) / RATE);
    let phase = 0;
    let filtered = 0;
    for (let index = from; index < to; index += 1) {
      const local = index / RATE - start;
      if (local < 0) continue;
      let envelope: number;
      if (local < attack) {
        const progress = local / Math.max(0.0001, attack);
        envelope = progress * progress * (3 - 2 * progress);
      } else if (local < duration) {
        envelope = 1;
      } else {
        const progress = (local - duration) / Math.max(0.0001, release);
        envelope = progress >= 1 ? 0 : Math.pow(1 - progress, 2.4);
      }
      if (envelope <= 0) continue;
      const vibratoPhase = vibrato ? TAU * 4.7 * local : 0;
      const bend = vibrato ? 1 + Math.sin(vibratoPhase) * vibrato * 0.0022 : 1;
      phase += omega * bend;
      if (phase > TAU) phase -= TAU;
      const raw = waveform(partialWave, phase);
      filtered += alpha * (raw - filtered);
      const sample = filtered * envelope * partialGain;
      mix.left[index] += sample * leftGain;
      mix.right[index] += sample * rightGain;
    }
  });
};

const addPulse = (mix: Mix, start: number, strength: number): void => {
  const duration = 0.62;
  const from = Math.max(0, Math.floor(start * RATE));
  const to = Math.min(LENGTH, Math.ceil((start + duration) * RATE));
  let phase = 0;
  let noiseState = 0x9912ae + Math.floor(start * 1000);
  let previousNoise = 0;
  for (let index = from; index < to; index += 1) {
    const local = index / RATE - start;
    if (local < 0) continue;
    const sweep = 72 * Math.exp(-local * 7.4) + 38;
    phase += (TAU * sweep) / RATE;
    const body =
      Math.sin(phase) * Math.exp(-local * 5.2) * (1 - Math.exp(-local * 220)) * 0.34 * strength;
    noiseState ^= noiseState << 13;
    noiseState ^= noiseState >>> 17;
    noiseState ^= noiseState << 5;
    const noise = ((noiseState >>> 0) / 4294967296) * 2 - 1;
    const highNoise = noise - previousNoise;
    previousNoise = noise;
    const tick = highNoise * Math.exp(-local * 32) * 0.028 * strength;
    const pan = local < 0.06 ? -0.25 : 0.12;
    const [leftGain, rightGain] = panGains(pan);
    mix.left[index] += (body + tick) * leftGain;
    mix.right[index] += (body + tick) * rightGain;
  }
};

const renderDemo = (): AudioBuffer => {
  const mix: Mix = { left: new Float32Array(LENGTH), right: new Float32Array(LENGTH) };

  // Drone: the room tone under everything, tuned to the same E / A field.
  [55, 82.4069, 110, 164.8138].forEach((frequency, index) => {
    addVoice(mix, {
      start: 0,
      duration: 31.4,
      frequency,
      gain: 0.042 - index * 0.004,
      pan: (index - 1.5) * 0.18,
      wave: index % 2 ? 'sine' : 'triangle',
      attack: 2.4,
      release: 2.6,
      filter: 300 + index * 70,
    });
  });

  // Five phrases, separated by real silences. Each chord is a small choir of
  // partials rather than a single oscillator, so the material has body.
  const pads: { start: number; duration: number; notes: number[]; level: number }[] = [
    { start: 0.0, duration: 7.0, notes: [45, 48, 52, 59], level: 0.3 },
    { start: 7.6, duration: 4.8, notes: [41, 45, 48, 52, 55], level: 0.29 },
    { start: 13.2, duration: 5.2, notes: [45, 48, 52, 59, 64], level: 0.3 },
    { start: 19.0, duration: 5.9, notes: [38, 41, 45, 48, 52, 55], level: 0.31 },
    { start: 25.7, duration: 5.3, notes: [45, 49, 52, 56, 59, 64], level: 0.32 },
  ];
  pads.forEach((pad) => {
    pad.notes.forEach((note, index) => {
      const frequency = midi(note);
      const pan = (index / Math.max(1, pad.notes.length - 1) - 0.5) * 0.72;
      const gain = (pad.level / Math.max(1, pad.notes.length)) * (index === 0 ? 1.3 : 0.9);
      addVoice(mix, {
        start: pad.start,
        duration: pad.duration,
        frequency,
        gain,
        pan,
        wave: 'triangle',
        attack: 0.8 + index * 0.09,
        release: 1.8,
        filter: 760 + index * 240,
        partials: [
          { ratio: 1, gain: 0.7, wave: 'triangle' },
          { ratio: 2.001, gain: 0.16, wave: 'sine' },
          { ratio: 0.5, gain: 0.3, wave: 'sine' },
        ],
      });
    });
  });

  // A single line that walks through the nave. Vibrato is deliberately late
  // and shallow; the architecture should feel sung, not synthesized.
  const melody: { start: number; duration: number; note: number; pan: number; gain: number }[] = [
    { start: 1.9, duration: 1.25, note: 69, pan: -0.14, gain: 0.052 },
    { start: 3.3, duration: 1.0, note: 72, pan: 0.1, gain: 0.045 },
    { start: 4.55, duration: 1.3, note: 76, pan: 0.24, gain: 0.05 },
    { start: 8.4, duration: 1.1, note: 69, pan: -0.22, gain: 0.048 },
    { start: 9.7, duration: 0.9, note: 72, pan: -0.05, gain: 0.045 },
    { start: 10.85, duration: 1.2, note: 77, pan: 0.18, gain: 0.052 },
    { start: 13.9, duration: 1.4, note: 76, pan: -0.16, gain: 0.048 },
    { start: 15.55, duration: 1.2, note: 79, pan: 0.08, gain: 0.05 },
    { start: 16.95, duration: 1.1, note: 76, pan: 0.22, gain: 0.043 },
    { start: 19.75, duration: 0.9, note: 74, pan: -0.18, gain: 0.05 },
    { start: 20.85, duration: 0.9, note: 77, pan: -0.02, gain: 0.046 },
    { start: 21.95, duration: 1.1, note: 81, pan: 0.12, gain: 0.052 },
    { start: 23.25, duration: 1.2, note: 79, pan: 0.26, gain: 0.048 },
    { start: 26.4, duration: 1.7, note: 76, pan: -0.12, gain: 0.047 },
    { start: 28.3, duration: 1.9, note: 81, pan: 0.1, gain: 0.05 },
  ];
  melody.forEach((note) => {
    addVoice(mix, {
      start: note.start,
      duration: note.duration,
      frequency: midi(note.note),
      gain: note.gain * 1.35,
      pan: note.pan,
      wave: 'triangle',
      attack: 0.11,
      release: 0.7,
      filter: 2900,
      vibrato: 0.9,
      partials: [
        { ratio: 1, gain: 0.82, wave: 'triangle' },
        { ratio: 2.003, gain: 0.12, wave: 'sine' },
      ],
    });
    addVoice(mix, {
      start: note.start + 0.01,
      duration: note.duration * 0.96,
      frequency: midi(note.note + 12),
      gain: note.gain * 0.3,
      pan: -note.pan,
      wave: 'sine',
      attack: 0.2,
      release: 0.7,
      filter: 8000,
    });
  });

  // Pulse / footfall: part heartbeat, part low frame drum.
  [
    [4.7, 0.85],
    [6.2, 0.55],
    [8.1, 0.62],
    [9.55, 0.58],
    [11.1, 0.8],
    [14.7, 0.62],
    [16.2, 0.7],
    [17.4, 0.5],
    [19.45, 0.9],
    [20.6, 0.6],
    [21.5, 0.7],
    [22.45, 0.84],
    [23.8, 0.75],
    [25.9, 0.7],
    [27.2, 0.9],
    [28.9, 0.62],
  ].forEach(([time, strength]) => addPulse(mix, time, strength));

  [
    [1.2, 1318.5, -0.6, 0.018],
    [2.75, 1760, 0.55, 0.014],
    [8.9, 1568, -0.4, 0.016],
    [14.85, 2093, 0.5, 0.013],
    [20.1, 1760, -0.65, 0.016],
    [26.9, 2349.3, 0.45, 0.015],
    [29.1, 2637, -0.3, 0.012],
  ].forEach(([time, frequency, pan, level]) => {
    addVoice(mix, {
      start: time,
      duration: 2.6,
      frequency,
      gain: level,
      pan,
      wave: 'sine',
      attack: 0.2,
      release: 2.1,
      filter: 12000,
      vibrato: 0.15,
    });
  });

  // A small stereo feedback network stands in for the cathedral's stone
  // reverb. It is deterministic, cheap, and adds depth without a convolver.
  const reverbL = new Float32Array(LENGTH);
  const reverbR = new Float32Array(LENGTH);
  const delayA = Math.floor(0.083 * RATE);
  const delayB = Math.floor(0.113 * RATE);
  let dampL = 0;
  let dampR = 0;
  for (let index = 0; index < LENGTH; index += 1) {
    const tapA = index >= delayA ? reverbL[index - delayA] : 0;
    const tapB = index >= delayB ? reverbR[index - delayB] : 0;
    dampL += 0.24 * (tapA - dampL);
    dampR += 0.24 * (tapB - dampR);
    const input = (mix.left[index] + mix.right[index]) * 0.5;
    reverbL[index] = input * 0.22 + dampR * 0.68;
    reverbR[index] = input * 0.24 + dampL * 0.66;
  }

  // Post-reverb gate: the silences are part of the score, and the architecture
  // needs them to leave real voids between chambers.
  const gates: [number, number][] = [
    [6.94, 7.7],
    [12.32, 13.26],
    [18.32, 19.08],
    [24.82, 25.78],
  ];
  const outLeft = new Float32Array(LENGTH);
  const outRight = new Float32Array(LENGTH);
  let peak = 0;
  for (let index = 0; index < LENGTH; index += 1) {
    const time = index / RATE;
    let gate = 1;
    for (let g = 0; g < gates.length; g += 1) {
      const [from, to] = gates[g];
      if (time >= from && time < to) {
        const fade = Math.min(1, (time - from) / 0.15, (to - time) / 0.22);
        gate = Math.max(0.0001, fade);
      }
    }
    const fadeIn = clamp(time / 0.8, 0, 1);
    const fadeOut = time > 29.3 ? clamp(1 - (time - 29.3) / 2.5, 0, 1) : 1;
    const master = 0.86 * fadeIn * fadeOut * gate;
    const left = (mix.left[index] * 0.82 + reverbL[index] * 0.34) * master;
    const right = (mix.right[index] * 0.82 + reverbR[index] * 0.34) * master;
    outLeft[index] = left;
    outRight[index] = right;
    const level = Math.max(Math.abs(left), Math.abs(right));
    if (level > peak) peak = level;
  }

  const normalise = peak > 0.92 ? 0.92 / peak : 1;
  for (let index = 0; index < LENGTH; index += 1) {
    outLeft[index] = Math.tanh(outLeft[index] * normalise * 1.08) * 0.92;
    outRight[index] = Math.tanh(outRight[index] * normalise * 1.08) * 0.92;
  }

  const buffer = new AudioBuffer({
    length: LENGTH,
    sampleRate: RATE,
    numberOfChannels: 2,
  });
  buffer.copyToChannel(outLeft, 0);
  buffer.copyToChannel(outRight, 1);
  return buffer;
};

let cachedDemo: AudioBuffer | null = null;

export const createDemoAudio = async (_sampleRate = 48000): Promise<AudioBuffer> => {
  void _sampleRate;
  if (cachedDemo) return cachedDemo;
  // Let the analysis tableau paint before the main thread renders PCM.
  await new Promise<void>((resolve) => window.setTimeout(resolve, 40));
  cachedDemo = renderDemo();
  return cachedDemo;
};
