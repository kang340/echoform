export type RecordingMime = 'audio/webm' | 'audio/mp4' | 'audio/ogg';

const supportedMime = (): string => {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
};

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

export class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  analyser: AnalyserNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private startAt = 0;
  private offset = 0;
  private buffer: AudioBuffer | null = null;
  private playing = false;
  private volume = 0.9;
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private micSource: MediaStreamAudioSourceNode | null = null;
  private silentGain: GainNode | null = null;
  private recordingStart = 0;
  private recordingMime = '';
  private liveFrequency = new Float32Array(0);
  private liveTime = new Float32Array(0);
  onEnded: (() => void) | null = null;
  onLevel: ((level: number) => void) | null = null;

  async ensureContext(): Promise<AudioContext> {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.72;
      this.analyser.minDecibels = -92;
      this.analyser.maxDecibels = -8;
      this.master.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    return this.ctx;
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 48000;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  get isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  get recordingElapsed(): number {
    if (!this.ctx || !this.isRecording) return 0;
    return Math.max(0, this.ctx.currentTime - this.recordingStart);
  }

  get currentTime(): number {
    if (!this.ctx) return 0;
    if (!this.playing) return this.offset;
    const elapsed = this.ctx.currentTime - this.startAt + this.offset;
    if (this.buffer) return Math.min(this.buffer.duration, elapsed);
    return Math.max(0, elapsed);
  }

  get duration(): number {
    return this.buffer?.duration ?? 0;
  }

  get currentBuffer(): AudioBuffer | null {
    return this.buffer;
  }

  setVolume(value: number): void {
    this.volume = value;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(value, this.ctx.currentTime, 0.03);
    }
  }

  async decode(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    const ctx = await this.ensureContext();
    return ctx.decodeAudioData(arrayBuffer.slice(0));
  }

  async loadArrayBuffer(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    this.stop();
    const decoded = await this.decode(arrayBuffer);
    this.buffer = decoded;
    this.offset = 0;
    return decoded;
  }

  async loadBlob(blob: Blob): Promise<AudioBuffer> {
    return this.loadArrayBuffer(await blob.arrayBuffer());
  }

  setBuffer(buffer: AudioBuffer): void {
    this.stop();
    this.buffer = buffer;
    this.offset = 0;
  }

  clearBuffer(): void {
    this.stop();
    this.buffer = null;
    this.offset = 0;
  }

  async play(from = 0, loop = false): Promise<void> {
    if (!this.buffer) return;
    const ctx = await this.ensureContext();
    this.stopSource();
    const source = ctx.createBufferSource();
    source.buffer = this.buffer;
    source.loop = loop;
    source.loopStart = 0;
    source.loopEnd = this.buffer.duration;
    source.connect(this.master!);
    const safeFrom = Math.max(0, Math.min(this.buffer.duration - 0.01, from));
    this.source = source;
    this.offset = safeFrom;
    this.startAt = ctx.currentTime;
    this.playing = true;
    source.onended = () => {
      if (this.source !== source) return;
      this.source = null;
      this.playing = false;
      this.offset = loop ? safeFrom : this.buffer?.duration ?? 0;
      this.onEnded?.();
    };
    source.start(0, safeFrom);
  }

  pause(): void {
    if (!this.playing) return;
    this.offset = this.currentTime;
    this.stopSource();
    this.playing = false;
  }

  seek(seconds: number): void {
    this.offset = Math.max(0, seconds);
    if (this.playing) {
      void this.play(this.offset);
    }
  }

  stop(): void {
    this.stopSource();
    this.playing = false;
    this.offset = 0;
  }

  private stopSource(): void {
    if (this.source) {
      const source = this.source;
      this.source = null;
      source.onended = null;
      try {
        source.stop();
      } catch {
        // The source may already have ended.
      }
      source.disconnect();
    }
  }

  getLiveAnalyser(): { frequency: Float32Array; time: Float32Array; sampleRate: number; fftSize: number } | null {
    const analyser = this.micAnalyser ?? this.analyser;
    if (!analyser) return null;
    if (this.liveFrequency.length !== analyser.frequencyBinCount) {
      this.liveFrequency = new Float32Array(analyser.frequencyBinCount);
      this.liveTime = new Float32Array(analyser.fftSize);
    }
    const frequency = this.liveFrequency;
    const time = this.liveTime;
    analyser.getFloatFrequencyData(frequency);
    analyser.getFloatTimeDomainData(time);
    return {
      frequency,
      time,
      sampleRate: this.ctx?.sampleRate ?? 48000,
      fftSize: analyser.fftSize,
    };
  }

  async startRecording(): Promise<{ mimeType: string; stream: MediaStream }> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('MIC_UNSUPPORTED');
    }
    if (typeof MediaRecorder === 'undefined') throw new Error('REC_UNSUPPORTED');
    this.cancelRecording();
    const ctx = await this.ensureContext();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      },
      video: false,
    });
    this.stream = stream;
    try {
      this.micSource = ctx.createMediaStreamSource(stream);
      this.micAnalyser = ctx.createAnalyser();
      this.micAnalyser.fftSize = 2048;
      this.micAnalyser.smoothingTimeConstant = 0.68;
      this.micAnalyser.minDecibels = -92;
      this.micAnalyser.maxDecibels = -8;
      this.silentGain = ctx.createGain();
      this.silentGain.gain.value = 0.00001;
      this.micSource.connect(this.micAnalyser);
      this.micAnalyser.connect(this.silentGain);
      this.silentGain.connect(ctx.destination);
      this.chunks = [];
      const mimeType = supportedMime();
      this.recordingMime = mimeType;
      this.mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128000 }) : new MediaRecorder(stream);
      this.recordingMime = this.mediaRecorder.mimeType || mimeType;
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.chunks.push(event.data);
      };
      this.mediaRecorder.start(200);
      this.recordingStart = ctx.currentTime;
      return { mimeType: this.recordingMime, stream };
    } catch (error) {
      this.cancelRecording();
      throw error;
    }
  }

  async stopRecording(): Promise<{ blob: Blob; duration: number }> {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      throw new Error('NOT_RECORDING');
    }
    const recorder = this.mediaRecorder;
    const duration = this.recordingElapsed;
    try {
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          recorder.removeEventListener('stop', onStop);
          recorder.removeEventListener('error', onError);
        };
        const onStop = () => { cleanup(); resolve(); };
        const onError = () => { cleanup(); reject(new Error('RECORDER_FAILED')); };
        recorder.addEventListener('stop', onStop);
        recorder.addEventListener('error', onError);
        try { recorder.stop(); } catch (error) { cleanup(); reject(error); }
      });
      await wait(60);
      return { blob: new Blob(this.chunks, { type: this.recordingMime || 'audio/webm' }), duration };
    } finally {
      this.cancelRecording();
    }
  }

  cancelRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.ondataavailable = null;
      try {
        this.mediaRecorder.stop();
      } catch {
        // Ignore invalid recorder state.
      }
    }
    this.teardownRecording();
  }

  private teardownRecording(): void {
    this.mediaRecorder = null;
    this.chunks = [];
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch {
        // Already disconnected.
      }
      this.micSource = null;
    }
    if (this.micAnalyser) {
      try {
        this.micAnalyser.disconnect();
      } catch {
        // Already disconnected.
      }
      this.micAnalyser = null;
    }
    if (this.silentGain) {
      try {
        this.silentGain.disconnect();
      } catch {
        // Already disconnected.
      }
      this.silentGain = null;
    }
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
  }

  createAnalyserDestination(): MediaStreamAudioDestinationNode {
    if (!this.ctx || !this.master) throw new Error('AUDIO_NOT_READY');
    return this.ctx.createMediaStreamDestination();
  }

  connectExportDestination(destination: MediaStreamAudioDestinationNode): void {
    if (!this.master) return;
    this.master.connect(destination);
  }

  disconnectExportDestination(destination: MediaStreamAudioDestinationNode): void {
    try {
      this.master?.disconnect(destination);
    } catch {
      // Destination already disconnected.
    }
  }

  async suspend(): Promise<void> {
    if (this.ctx?.state === 'running') await this.ctx.suspend();
  }

  async resume(): Promise<void> {
    if (this.ctx?.state === 'suspended') await this.ctx.resume();
  }

  dispose(): void {
    this.stop();
    this.cancelRecording();
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.master?.disconnect();
    if (this.ctx) {
      void this.ctx.close();
    }
    this.ctx = null;
    this.master = null;
    this.analyser = null;
  }
}
