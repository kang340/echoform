import type { AudioEngine } from './audio-engine';
import type { EchoformEngine } from '../three/engine';

interface VideoExportOptions {
  engine: EchoformEngine;
  audio: AudioEngine;
  duration: number;
  onProgress?: (progress: number, elapsed: number) => void;
}

interface VideoExportResult {
  blob: Blob;
  mimeType: string;
  duration: number;
}

const supportedVideoMime = (): string => {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const exportCinematicVideo = async ({
  engine,
  audio,
  duration,
  onProgress,
}: VideoExportOptions): Promise<VideoExportResult> => {
  const mimeType = supportedVideoMime();
  if (!mimeType) throw new Error('VIDEO_UNSUPPORTED');
  const exportDuration = Math.min(45, Math.max(4, duration));
  // Shared buildings have no audio context until the first interaction.
  await audio.ensureContext();
  let canvasStream: MediaStream | null = null;
  let audioDestination: MediaStreamAudioDestinationNode | null = null;
  let recorder: MediaRecorder | null = null;
  const chunks: BlobPart[] = [];
  try {
    engine.setCaptureMode();
    await sleep(850);
    canvasStream = engine.captureStream(30);
    audioDestination = audio.createAnalyserDestination();
    audio.connectExportDestination(audioDestination);
    const combined = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioDestination.stream.getAudioTracks(),
    ]);
    recorder = new MediaRecorder(combined, {
      mimeType, videoBitsPerSecond: 9_000_000, audioBitsPerSecond: 160_000,
    });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    let recordingError: Error | null = null;
    const finished = new Promise<void>((resolve) => {
      recorder!.addEventListener('stop', () => resolve(), { once: true });
      recorder!.addEventListener('error', () => {
        recordingError = new Error('VIDEO_RECORDING_FAILED');
        resolve();
      }, { once: true });
    });
    recorder.start(250);
    await audio.play(0);
    const started = performance.now();
    while (performance.now() - started < (exportDuration + 0.15) * 1000) {
      await sleep(150);
      if (recordingError) throw recordingError;
      const elapsed = Math.min(exportDuration, (performance.now() - started) / 1000);
      onProgress?.(elapsed / exportDuration, elapsed);
    }
    if (recorder.state !== 'inactive') recorder.stop();
    await finished;
    if (recordingError) throw recordingError;
  } finally {
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch { /* Recorder may already have stopped. */ }
    }
    audio.pause();
    if (audioDestination) audio.disconnectExportDestination(audioDestination);
    canvasStream?.getTracks().forEach((track) => track.stop());
    audioDestination?.stream.getTracks().forEach((track) => track.stop());
    engine.restoreInteractionMode();
  }

  const blob = new Blob(chunks, { type: mimeType.split(';')[0] || 'video/webm' });
  return {
    blob,
    mimeType: blob.type,
    duration: exportDuration,
  };
};
