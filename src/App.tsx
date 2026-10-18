import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { analyseLive, analyzeBuffer } from './lib/analysis';
import { AudioEngine } from './lib/audio-engine';
import { createDemoAudio } from './lib/demo-audio';
import { buildDesign, scoreFromDesign } from './lib/design';
import { downloadBlob, createPoster } from './lib/poster';
import { loadPreferences, loadPresets, savePreferences, savePreset, deletePreset } from './lib/presets';
import { buildShareUrl, copyText, readBlueprintFromUrl } from './lib/share';
import { exportCinematicVideo } from './lib/video';
import { EchoformEngine, type EngineStats } from './three/engine';
import {
  DEFAULT_LIGHTS,
  DEFAULT_MATERIALS,
  EMPTY_LIVE,
  STYLES,
  clamp,
  formatTime,
  styleByKey,
  type CameraMode,
  type DesignSpec,
  type ExperienceSettings,
  type LiveFeature,
  type Phase,
  type StyleKey,
  type UserPreset,
  type VoiceScore,
} from './types';
import AnalysisOverlay from './components/AnalysisOverlay';
import { Intro } from './components/Intro';
import RecordingOverlay from './components/RecordingOverlay';
import Workbench, { type PanelTab } from './components/Workbench';
import {
  ExportProgress,
  InfoModal,
  PosterModal,
  PresetsModal,
  ShareModal,
  Toast,
  VideoModal,
  CoachMark,
} from './components/Modals';
import { ArrowRight, Logo, Spark } from './components/Icons';

type ModalType = 'poster' | 'video' | 'share' | 'presets' | 'info' | null;

interface AnalysisState {
  progress: number;
  label: string;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const isMobile = (): boolean => window.matchMedia('(max-width: 760px)').matches;

const initialSettings = (): ExperienceSettings => {
  const prefs = loadPreferences();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const style =
    prefs?.style && STYLES.some((item) => item.key === prefs.style) ? prefs.style : 'crystal';
  return {
    style,
    materials: { ...DEFAULT_MATERIALS, ...(prefs?.materials ?? {}) },
    lights: { ...DEFAULT_LIGHTS, ...(prefs?.lights ?? {}) },
    quality: prefs?.quality ?? (isMobile() ? 'balanced' : 'high'),
    autoRotate: prefs?.autoRotate ?? !reducedMotion,
  };
};

const analysisLabel = (progress: number): string => {
  if (progress < 0.28) return 'READING THE VOICE / 读取声纹';
  if (progress < 0.5) return 'MEASURING PITCH / 提取音高';
  if (progress < 0.74) return 'COMPOSING THE PLAN / 编排空间';
  if (progress < 0.96) return 'CASTING THE STRUCTURE / 浇筑结构';
  return 'THE SPACE IS READY / 建筑已就绪';
};

const friendlyError = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.name === 'NotAllowedError' || error.message === 'MIC_DENIED') {
      return '麦克风权限没有开启。请在地址栏允许麦克风，或改为上传一段音频。';
    }
    if (error.name === 'NotFoundError') return '没有检测到可用的麦克风。你仍然可以上传音频文件。';
    if (error.message === 'MIC_UNSUPPORTED') return '当前环境无法访问麦克风，请使用 HTTPS 或 localhost，或改为上传音频。';
    if (error.name === 'NotReadableError') return '麦克风似乎被其他程序占用。请关闭占用的程序后重试。';
    if (error.name === 'SecurityError' || error.message.includes('secure')) {
      return '麦克风需要 HTTPS 或 localhost 环境。请使用安全连接访问。';
    }
    if (error.message === 'TOO_SHORT') return '这段声音太短了，至少需要 1 秒。再说一句吧。';
    if (error.message === 'TOO_LONG') return '作品最长支持 75 秒。请选择更短的片段。';
    if (error.message === 'VIDEO_UNSUPPORTED') return '当前浏览器不支持影像录制，请使用最新版 Chrome 或 Edge。';
    if (error.message === 'REC_UNSUPPORTED') return '当前浏览器不支持麦克风录音，请改为上传音频文件。';
    if (error.message === 'POSTER_ENCODE_FAILED' || error.message === 'CAPTURE_FAILED') {
      return '画面捕获失败，请稍后再试。';
    }
    return error.message;
  }
  return '发生了一个意外错误，请重试。';
};

const RoamPad = ({ engine }: { engine: EchoformEngine }) => {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef(false);
  const [active, setActive] = useState(false);

  const update = (event: ReactPointerEvent<HTMLDivElement>) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const radius = rect.width / 2;
    let dx = (event.clientX - (rect.left + radius)) / radius;
    let dy = (event.clientY - (rect.top + radius)) / radius;
    const length = Math.hypot(dx, dy);
    if (length > 1) {
      dx /= length;
      dy /= length;
    }
    engine.setRoamInput(dx, -dy);
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(${dx * radius * 0.52}px, ${dy * radius * 0.52}px)`;
    }
  };

  const reset = () => {
    activeRef.current = false;
    setActive(false);
    engine.setRoamInput(0, 0);
    if (knobRef.current) knobRef.current.style.transform = 'translate(0px, 0px)';
  };

  return (
    <div className={`roam-pad ${active ? 'is-active' : ''}`}>
      <div
        ref={baseRef}
        className="roam-pad-base"
        onPointerDown={(event) => {
          activeRef.current = true;
          setActive(true);
          event.currentTarget.setPointerCapture(event.pointerId);
          update(event);
        }}
        onPointerMove={(event) => {
          if (activeRef.current) update(event);
        }}
        onPointerUp={(event) => {
          reset();
          try {
            event.currentTarget.releasePointerCapture(event.pointerId);
          } catch {
            // Pointer capture may already be released.
          }
        }}
        onPointerCancel={reset}
      >
        <span className="roam-pad-cross roam-pad-cross-x" />
        <span className="roam-pad-cross roam-pad-cross-y" />
        <div ref={knobRef} className="roam-pad-knob" />
      </div>
      <div className="roam-pad-copy">
        <b>移动</b>
        <span>右侧拖动视线</span>
      </div>
    </div>
  );
};

const App = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<EchoformEngine | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);
  if (!audioRef.current) audioRef.current = new AudioEngine();

  const [settings, setSettings] = useState<ExperienceSettings>(initialSettings);
  const [phase, setPhase] = useState<Phase>('intro');
  const [design, setDesign] = useState<DesignSpec | null>(null);
  const [score, setScore] = useState<VoiceScore | null>(null);
  const [hasAudio, setHasAudio] = useState(false);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [live, setLive] = useState<LiveFeature>(EMPTY_LIVE);
  const [analysis, setAnalysis] = useState<AnalysisState>({ progress: 0, label: 'READING THE VOICE' });
  const [busy, setBusy] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalType>(null);
  const [posterUrl, setPosterUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoMime, setVideoMime] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [presets, setPresets] = useState<UserPreset[]>(() => loadPresets());
  const [toast, setToast] = useState<{ message: string; kind: 'info' | 'success' | 'error' } | null>(null);
  const [coach, setCoach] = useState(false);
  const [panelOpen, setPanelOpen] = useState(!isMobile());
  const [panelTab, setPanelTab] = useState<PanelTab>('form');
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit');
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [muted, setMuted] = useState(false);
  const [hudHidden, setHudHidden] = useState(false);
  const [stats, setStats] = useState<EngineStats | null>(null);
  const [source, setSource] = useState<{ kind: 'demo' | 'microphone' | 'file'; name: string } | null>(null);

  const phaseRef = useRef(phase);
  const designRef = useRef(design);
  const scoreRef = useRef(score);
  const settingsRef = useRef(settings);
  const timeRef = useRef(time);
  const hasAudioRef = useRef(hasAudio);
  const busyRef = useRef(busy);
  const mutedRef = useRef(muted);
  const cameraModeRef = useRef(cameraMode);
  const modalRef = useRef(modal);
  const exportingRef = useRef(exporting);

  phaseRef.current = phase;
  designRef.current = design;
  scoreRef.current = score;
  settingsRef.current = settings;
  timeRef.current = time;
  hasAudioRef.current = hasAudio;
  busyRef.current = busy;
  cameraModeRef.current = cameraMode;
  mutedRef.current = muted;
  modalRef.current = modal;
  exportingRef.current = exporting;

  const startDemoRef = useRef<() => void>(() => undefined);
  const recordRef = useRef<() => void>(() => undefined);
  const stopRef = useRef<() => void>(() => undefined);
  const screenshotRef = useRef<() => void>(() => undefined);
  const videoRef = useRef<() => void>(() => undefined);

  const accent = useMemo(() => styleByKey(settings.style).accent, [settings.style]);
  const shared = Boolean(design) && !hasAudio;

  const showToast = useCallback((message: string, kind: 'info' | 'success' | 'error' = 'info') => {
    setToast({ message, kind });
  }, []);

  const fail = useCallback(
    (error: unknown) => {
      const message = friendlyError(error);
      engineRef.current?.clearLive();
      engineRef.current?.setPhase('intro');
      engineRef.current?.setDesign(null);
      setPhase('intro');
      setDesign(null);
      setScore(null);
      setHasAudio(false);
      setBusy(false);
      setModal(null);
      showToast(message, 'error');
    },
    [showToast],
  );

  const processBuffer = useCallback(
    async (buffer: AudioBuffer, kind: 'demo' | 'microphone' | 'file', name: string) => {
      const startedAt = performance.now();
      setBusy(true);
      setPhase('analyzing');
      setHasAudio(false);
      setAnalysis({ progress: 0.24, label: analysisLabel(0.24) });
      engineRef.current?.setPhase('analyzing');
      engineRef.current?.clearLive();
      try {
        const result = await analyzeBuffer(buffer, (progress) => {
          const mapped = 0.27 + progress.progress * 0.51;
          setAnalysis({ progress: mapped, label: analysisLabel(mapped) });
        });
        scoreRef.current = result;
        setScore(result);
        setAnalysis({ progress: 0.82, label: analysisLabel(0.82) });
        await sleep(260);

        const nextDesign = buildDesign(result, settingsRef.current.style);
        designRef.current = nextDesign;
        setDesign(nextDesign);
        audioRef.current?.setBuffer(buffer);
        engineRef.current?.setDesign(nextDesign);
        engineRef.current?.setTimeline(0);
        setAnalysis({ progress: 0.94, label: analysisLabel(0.94) });
        await sleep(850);
        setAnalysis({ progress: 1, label: analysisLabel(1) });
        await sleep(360);

        // Give the analysis tableau enough time to read as a deliberate scene.
        const remaining = 2400 - (performance.now() - startedAt);
        if (remaining > 0) await sleep(remaining);

        designRef.current = nextDesign;
        setDesign(nextDesign);
        setSource({ kind, name });
        setHasAudio(true);
        setTime(0);
        timeRef.current = 0;
        setPhase('ready');
        phaseRef.current = 'ready';
        engineRef.current?.setTimeline(0);
        engineRef.current?.setPhase('ready');
        await audioRef.current?.play(0);
        setPlaying(true);
        setCoach(true);
      } catch (error) {
        fail(error);
      } finally {
        setBusy(false);
      }
    },
    [fail],
  );

  const startRecording = useCallback(async () => {
    if (busyRef.current) return;
    const audio = audioRef.current;
    if (!audio) return;
    setBusy(true);
    try {
      await audio.ensureContext();
      audio.stop();
      await audio.startRecording();
      engineRef.current?.setPhase('recording');
      setLive(EMPTY_LIVE);
      setRecordingTime(0);
      setPhase('recording');
      phaseRef.current = 'recording';
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }, [fail]);

  const finishRecording = useCallback(async () => {
    if (phaseRef.current !== 'recording') return;
    const audio = audioRef.current;
    if (!audio) return;
    setPhase('analyzing');
    phaseRef.current = 'analyzing';
    engineRef.current?.setPhase('analyzing');
    engineRef.current?.clearLive();
    setBusy(true);
    try {
      const { blob, duration } = await audio.stopRecording();
      if (duration < 0.8) throw new Error('TOO_SHORT');
      const buffer = await audio.decode(await blob.arrayBuffer());
      if (buffer.duration < 0.65) throw new Error('TOO_SHORT');
      await processBuffer(buffer, 'microphone', `VOICE_TAKE_${new Date().toISOString().slice(11, 19).replace(/:/g, '')}.webm`);
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }, [fail, processBuffer]);

  const cancelRecording = useCallback(() => {
    audioRef.current?.cancelRecording();
    engineRef.current?.clearLive();
    engineRef.current?.setPhase('intro');
    setPhase('intro');
    setRecordingTime(0);
    setLive(EMPTY_LIVE);
  }, []);

  const startDemo = useCallback(async () => {
    if (busyRef.current) return;
    const audio = audioRef.current;
    if (!audio) return;
    setBusy(true);
    try {
      await audio.ensureContext();
      audio.stop();
      setPhase('analyzing');
      phaseRef.current = 'analyzing';
      engineRef.current?.setPhase('analyzing');
      setAnalysis({ progress: 0.015, label: 'SYNTHESIZING THE STUDY / 合成示例声景' });
      const synthTimer = window.setInterval(() => {
        setAnalysis((previous) =>
          previous.progress >= 0.22
            ? previous
            : {
                progress: Math.min(0.22, previous.progress + 0.028),
                label: 'SYNTHESIZING THE STUDY / 合成示例声景',
              },
        );
      }, 520);
      try {
        const buffer = await createDemoAudio(audio.sampleRate);
        await processBuffer(buffer, 'demo', 'ECHOFORM · ÉTUDE NO. 01');
      } finally {
        window.clearInterval(synthTimer);
      }
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }, [fail, processBuffer]);

  const handleFile = useCallback(
    async (file: File) => {
      if (busyRef.current) return;
      if (file.size > 48 * 1024 * 1024) {
        showToast('音频文件超过 48 MB，请选择更短的片段。', 'error');
        return;
      }
      const audio = audioRef.current;
      if (!audio) return;
      setBusy(true);
      setPhase('analyzing');
      phaseRef.current = 'analyzing';
      engineRef.current?.setPhase('analyzing');
      setAnalysis({ progress: 0.02, label: 'DECODING AUDIO / 读取音频' });
      try {
        await audio.ensureContext();
        audio.stop();
        const buffer = await audio.loadArrayBuffer(await file.arrayBuffer());
        if (buffer.duration > 75) throw new Error('TOO_LONG');
        if (buffer.duration < 0.65) throw new Error('TOO_SHORT');
        await processBuffer(buffer, 'file', file.name);
      } catch (error) {
        fail(error);
      } finally {
        setBusy(false);
      }
    },
    [fail, processBuffer, showToast],
  );

  const resetProject = useCallback(() => {
    const audio = audioRef.current;
    audio?.stop();
    audio?.clearBuffer();
    setDesign(null);
    setScore(null);
    setHasAudio(false);
    setTime(0);
    timeRef.current = 0;
    setPlaying(false);
    setPhase('intro');
    phaseRef.current = 'intro';
    engineRef.current?.setPhase('intro');
    engineRef.current?.setDesign(null);
    setModal(null);
    setCoach(false);
    setCameraMode('orbit');
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    const currentDesign = designRef.current;
    if (!audio || !currentDesign || !hasAudioRef.current) return;
    if (audio.isPlaying) {
      audio.pause();
      setPlaying(false);
      return;
    }
    const current = audio.currentTime >= currentDesign.duration - 0.08 ? 0 : audio.currentTime;
    await audio.play(current);
    engineRef.current?.setTimeline(current);
    setTime(current);
    setPlaying(true);
  }, []);

  const seek = useCallback((nextTime: number) => {
    const currentDesign = designRef.current;
    if (!currentDesign) return;
    const value = clamp(nextTime, 0, currentDesign.duration);
    setTime(value);
    timeRef.current = value;
    engineRef.current?.setTimeline(value);
    if (hasAudioRef.current) {
      audioRef.current?.seek(value);
      setPlaying(audioRef.current?.isPlaying ?? false);
    }
  }, []);

  const replay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !hasAudioRef.current) return;
    await audio.play(0);
    engineRef.current?.setTimeline(0);
    setTime(0);
    setPlaying(true);
  }, []);

  const changeStyle = useCallback((style: StyleKey) => {
    const nextSettings = { ...settingsRef.current, style };
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
    engineRef.current?.applySettings(nextSettings);
    const currentDesign = designRef.current;
    if (currentDesign) {
      const currentScore = scoreRef.current ?? scoreFromDesign(currentDesign);
      const nextDesign = buildDesign(currentScore, style);
      designRef.current = nextDesign;
      setDesign(nextDesign);
      engineRef.current?.setDesign(nextDesign);
      engineRef.current?.setPhase(phaseRef.current === 'ready' ? 'ready' : phaseRef.current);
      engineRef.current?.setTimeline(timeRef.current);
    }
  }, []);

  const changeCamera = useCallback((mode: CameraMode) => {
    engineRef.current?.setCameraMode(mode);
    setCameraMode(mode);
  }, []);

  const updateMaterials = useCallback((patch: Partial<ExperienceSettings['materials']>) => {
    setSettings((prev) => ({ ...prev, materials: { ...prev.materials, ...patch } }));
  }, []);

  const updateLights = useCallback((patch: Partial<ExperienceSettings['lights']>) => {
    setSettings((prev) => ({ ...prev, lights: { ...prev.lights, ...patch } }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      materials: { ...DEFAULT_MATERIALS },
      lights: { ...DEFAULT_LIGHTS },
      autoRotate: true,
    }));
    showToast('材质与灯光已恢复到初始状态。', 'success');
  }, [showToast]);

  const takeScreenshot = useCallback(async () => {
    if (!designRef.current || busyRef.current) return;
    setBusy(true);
    try {
      await document.fonts.ready;
      const engine = engineRef.current;
      if (!engine) throw new Error('CAPTURE_FAILED');
      const raw = await engine.capture(2560, 1440);
      const poster = await createPoster(raw, designRef.current, 2560, 1440);
      const url = URL.createObjectURL(poster);
      setPosterUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return url;
      });
      setModal('poster');
      showToast('已生成 2560 × 1440 艺术海报。', 'success');
    } catch (error) {
      showToast(friendlyError(error), 'error');
    } finally {
      setBusy(false);
    }
  }, [showToast]);

  const exportVideo = useCallback(async () => {
    if (!designRef.current || exportingRef.current) return;
    const audio = audioRef.current;
    const engine = engineRef.current;
    if (!audio || !engine) return;
    setExporting(true);
    exportingRef.current = true;
    setExportProgress(0);
    const wasMuted = mutedRef.current;
    audio.setVolume(0.9);
    if (!hasAudioRef.current) showToast('该作品没有原始音频，将导出静音影像。', 'info');
    try {
      const result = await exportCinematicVideo({
        engine,
        audio,
        duration: designRef.current.duration,
        onProgress: (progress) => setExportProgress(progress),
      });
      const url = URL.createObjectURL(result.blob);
      setVideoUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return url;
      });
      setVideoDuration(result.duration);
      setVideoMime(result.mimeType);
      setModal('video');
      showToast('影像导出完成。', 'success');
    } catch (error) {
      showToast(friendlyError(error), 'error');
    } finally {
      setExporting(false);
      exportingRef.current = false;
      audio.setVolume(wasMuted ? 0 : 0.9);
      engine.restoreInteractionMode();
      setCameraMode('orbit');
      setPlaying(false);
    }
  }, [showToast]);

  const openShare = useCallback(async () => {
    const currentDesign = designRef.current;
    if (!currentDesign) return;
    setModal('share');
    setShareLoading(true);
    setCopied(false);
    setShareUrl('');
    try {
      const currentScore = scoreRef.current ?? scoreFromDesign(currentDesign);
      await sleep(80);
      const url = buildShareUrl(currentDesign, currentScore);
      setShareUrl(url);
    } catch {
      showToast('分享链接生成失败，请下载参数文件。', 'error');
    } finally {
      setShareLoading(false);
    }
  }, [showToast]);

  const copyShareUrl = useCallback(async () => {
    if (!shareUrl) return;
    const ok = await copyText(shareUrl);
    setCopied(ok);
    showToast(ok ? '分享链接已复制。' : '复制失败，请手动选择链接。', ok ? 'success' : 'error');
  }, [shareUrl, showToast]);

  const exportParams = useCallback(() => {
    const currentDesign = designRef.current;
    if (!currentDesign) return;
    const payload = {
      format: 'echoform.design.v1',
      exportedAt: new Date().toISOString(),
      app: 'ECHOFORM · Voice Architecture',
      audioEmbedded: false,
      source,
      settings: settingsRef.current,
      design: currentDesign,
      notes: {
        deterministic: 'The geometry is derived from the design payload and its seed.',
        audio: 'Original audio is processed locally and is not included in this parameter file.',
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `ECHOFORM_${currentDesign.name.replace(/[^a-zA-Z0-9]+/g, '_')}_${currentDesign.fingerprint}.json`);
    showToast('参数文件已下载。', 'success');
  }, [showToast, source]);

  const saveProject = useCallback(() => {
    const currentDesign = designRef.current;
    if (!currentDesign) return;
    const preset: UserPreset = {
      id: `${currentDesign.fingerprint}-${Date.now()}`,
      title: currentDesign.name,
      createdAt: Date.now(),
      design: currentDesign,
      settings: settingsRef.current,
    };
    setPresets(savePreset(preset));
    showToast('作品已保存至本地展厅。音频不会写入展厅。', 'success');
  }, [showToast]);

  const loadPreset = useCallback((preset: UserPreset) => {
    const audio = audioRef.current;
    audio?.stop();
    audio?.clearBuffer();
    setHasAudio(false);
    const derivedScore = scoreFromDesign(preset.design);
    scoreRef.current = derivedScore;
    setScore(derivedScore);
    designRef.current = preset.design;
    setDesign(preset.design);
    settingsRef.current = preset.settings;
    setSettings(preset.settings);
    setTime(preset.design.duration);
    timeRef.current = preset.design.duration;
    setPlaying(false);
    setPhase('ready');
    phaseRef.current = 'ready';
    setModal(null);
    setCameraMode('orbit');
    engineRef.current?.applySettings(preset.settings);
    engineRef.current?.setDesign(preset.design);
    engineRef.current?.setPhase('ready');
    engineRef.current?.setTimeline(preset.design.duration);
    showToast('已载入本地展厅作品。分享链接不包含原始音频。', 'info');
  }, [showToast]);

  const removePreset = useCallback((id: string) => {
    setPresets(deletePreset(id));
    showToast('作品已从展厅移除。', 'success');
  }, [showToast]);

  const toggleMute = useCallback(() => {
    setMuted((previous) => !previous);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      showToast('当前浏览器不允许全屏。', 'error');
    }
  }, [showToast]);

  const getLiveAnalyser = useCallback(() => audioRef.current?.getLiveAnalyser() ?? null, []);

  // Engine lifecycle and shared blueprint boot.
  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    let engine: EchoformEngine | null = null;
    try {
      engine = new EchoformEngine(canvas, stage);
      engineRef.current = engine;
      engine.onStats = (nextStats) => setStats(nextStats);
      engine.applySettings(settingsRef.current);
      const audio = audioRef.current!;
      audio.onEnded = () => setPlaying(false);
      audio.setVolume(mutedRef.current ? 0 : 0.9);

      const sharedDesign = readBlueprintFromUrl();
      if (sharedDesign) {
        const derivedScore = scoreFromDesign(sharedDesign);
        designRef.current = sharedDesign;
        scoreRef.current = derivedScore;
        setDesign(sharedDesign);
        setScore(derivedScore);
        setHasAudio(false);
        setPhase('ready');
        phaseRef.current = 'ready';
        setTime(sharedDesign.duration);
        timeRef.current = sharedDesign.duration;
        const nextSettings = { ...settingsRef.current, style: sharedDesign.style };
        settingsRef.current = nextSettings;
        setSettings(nextSettings);
        engine.applySettings(nextSettings);
        engine.setDesign(sharedDesign);
        engine.setPhase('ready');
        engine.setTimeline(sharedDesign.duration);
        window.setTimeout(() => {
          setToast({
            message: '这是一个共享建筑。原始音频未随链接传输，你仍可以自由探索与导出。',
            kind: 'info',
          });
        }, 900);
      } else {
        engine.setPhase('intro');
      }
      setInitialized(true);
    } catch (error) {
      setFatal(
        error instanceof Error && error.message.includes('WebGL')
          ? '你的浏览器暂时无法启动 WebGL。请开启硬件加速后刷新页面。'
          : '三维展厅初始化失败。请刷新页面，或使用最新版 Chrome / Edge。',
      );
    }

    return () => {
      engine?.dispose();
      engineRef.current = null;
      audioRef.current?.dispose();
      audioRef.current = null;
    };
  }, []);

  // Keep the look, preferences and audio gain in sync.
  useEffect(() => {
    engineRef.current?.applySettings(settings);
    savePreferences(settings);
    const meta = styleByKey(settings.style);
    document.documentElement.style.setProperty('--accent', meta.accent);
    document.documentElement.style.setProperty('--accent-rgb', meta.accentRgb.join(', '));
    document.documentElement.dataset.echoformStyle = settings.style;
  }, [settings]);

  useEffect(() => {
    audioRef.current?.setVolume(muted ? 0 : 0.9);
  }, [muted]);

  // Frame loop: pulse, recording level, playback time.
  useEffect(() => {
    if (!initialized) return;
    let frame = 0;
    let lastUi = 0;
    let lastLive = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const audio = audioRef.current;
      const engine = engineRef.current;
      if (!audio || !engine) return;

      if (phaseRef.current === 'recording') {
        const data = audio.getLiveAnalyser();
        if (data) {
          const feature = analyseLive(data.frequency, data.time, data.sampleRate, data.fftSize);
          engine.setLive(feature);
          if (now - lastLive > 70) {
            setLive(feature);
            setRecordingTime(audio.recordingElapsed);
            lastLive = now;
          }
        }
        return;
      }

      if (phaseRef.current === 'ready' && designRef.current && hasAudioRef.current) {
        const current = audio.currentTime;
        engine.setTimeline(current);
        if (now - lastUi > 90) {
          setTime(current);
          setPlaying(audio.isPlaying);
          lastUi = now;
        }
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [initialized]);

  // Auto-stop at 45 seconds.
  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = window.setTimeout(() => {
      void finishRecording();
    }, 45_000);
    return () => window.clearTimeout(timer);
  }, [finishRecording, phase]);

  // Coach is transient.
  useEffect(() => {
    if (!coach) return;
    const timer = window.setTimeout(() => setCoach(false), 9000);
    return () => window.clearTimeout(timer);
  }, [coach]);

  // Global keys.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (event.key === 'Escape') {
        if (modalRef.current) setModal(null);
        else if (phaseRef.current === 'recording') cancelRecording();
        return;
      }
      if (modalRef.current) return;
      if (phaseRef.current === 'recording') {
        if (event.code === 'Space') {
          event.preventDefault();
          void finishRecording();
        }
        return;
      }
      if (phaseRef.current !== 'ready') return;
      if (event.code === 'Space') {
        event.preventDefault();
        void togglePlay();
      } else if (event.code === 'KeyR') {
        void replay();
      } else if (event.code === 'KeyH') {
        setHudHidden((previous) => !previous);
      } else if (event.code === 'KeyF') {
        void toggleFullscreen();
      } else if (event.code === 'KeyC') {
        const order: CameraMode[] = ['orbit', 'roam', 'guide'];
        const next = order[(order.indexOf(cameraMode) + 1) % order.length];
        changeCamera(next);
      } else if (event.code === 'Digit1') {
        changeStyle('crystal');
      } else if (event.code === 'Digit2') {
        changeStyle('machine');
      } else if (event.code === 'Digit3') {
        changeStyle('organic');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    cameraMode,
    cancelRecording,
    changeCamera,
    changeStyle,
    finishRecording,
    replay,
    toggleFullscreen,
    togglePlay,
  ]);

  // Debug bridge used by the automated browser QA suite.
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__ECHOFORM__ = {
      get engine() {
        return engineRef.current;
      },
      get audio() {
        return audioRef.current;
      },
      getState: () => ({
        phase: phaseRef.current,
        time: timeRef.current,
        playing: audioRef.current?.isPlaying ?? false,
        hasAudio: hasAudioRef.current,
        cameraMode: cameraModeRef.current,
        design: designRef.current,
        score: scoreRef.current,
        settings: settingsRef.current,
        stats: engineRef.current?.getStats() ?? null,
      }),
      startDemo: () => startDemoRef.current(),
      startRecording: () => recordRef.current(),
      stopRecording: () => stopRef.current(),
      screenshot: () => screenshotRef.current(),
      exportVideo: () => videoRef.current(),
    };
  }, []);

  startDemoRef.current = () => {
    void startDemo();
  };
  recordRef.current = () => {
    void startRecording();
  };
  stopRef.current = () => {
    void finishRecording();
  };
  screenshotRef.current = () => {
    void takeScreenshot();
  };
  videoRef.current = () => {
    void exportVideo();
  };

  const rootStyle = {
    '--accent': accent,
    '--accent-rgb': styleByKey(settings.style).accentRgb.join(', '),
  } as CSSProperties;

  if (fatal) {
    return (
      <div className="fatal-screen">
        <Logo size={42} />
        <h1>ECHOFORM</h1>
        <p>{fatal}</p>
        <a href="./">重新进入展厅</a>
      </div>
    );
  }

  return (
    <div
      className={`app-root phase-${phase} style-${settings.style} ${hudHidden ? 'is-hud-hidden' : ''}`}
      style={rootStyle}
      data-style={settings.style}
    >
      <div ref={stageRef} className="stage">
        <canvas ref={canvasRef} className="webgl-canvas" aria-label="实时生成的声音建筑三维展厅" />
      </div>
      <div className="screen-atmosphere" aria-hidden>
        <div className="screen-grain" />
        <div className="screen-vignette" />
        <div className="screen-frame">
          <span className="frame-corner frame-tl" />
          <span className="frame-corner frame-tr" />
          <span className="frame-corner frame-bl" />
          <span className="frame-corner frame-br" />
        </div>
      </div>

      {phase === 'intro' && (
        <Intro
          style={settings.style}
          busy={busy}
          onStyle={changeStyle}
          onRecord={startRecording}
          onDemo={startDemo}
          onFile={handleFile}
          onInfo={() => setModal('info')}
        />
      )}

      {phase === 'recording' && (
        <RecordingOverlay
          elapsed={recordingTime}
          maxDuration={45}
          live={live}
          accent={accent}
          getAnalyser={getLiveAnalyser}
          onStop={finishRecording}
          onCancel={cancelRecording}
        />
      )}

      {(phase === 'analyzing' || phase === 'composing') && (
        <AnalysisOverlay
          progress={analysis.progress}
          label={analysis.label}
          styleLabel={styleByKey(settings.style).label}
        />
      )}

      {phase === 'ready' && design && (
        <Workbench
          design={design}
          score={score}
          settings={settings}
          time={time}
          playing={playing}
          shared={shared}
          muted={muted}
          cameraMode={cameraMode}
          panelOpen={panelOpen}
          panelTab={panelTab}
          stats={stats}
          accent={accent}
          onPlay={togglePlay}
          onSeek={seek}
          onReplay={replay}
          onStyle={changeStyle}
          onCamera={changeCamera}
          onTogglePanel={() => setPanelOpen((previous) => !previous)}
          onPanelTab={setPanelTab}
          onMaterials={updateMaterials}
          onLights={updateLights}
          onScreenshot={takeScreenshot}
          onVideo={exportVideo}
          onShare={openShare}
          onSave={saveProject}
          onExportParams={exportParams}
          onOpenPresets={() => setModal('presets')}
          onInfo={() => setModal('info')}
          onMute={toggleMute}
          onFullscreen={toggleFullscreen}
          onNew={resetProject}
          onResetSettings={resetSettings}
        />
      )}

      {phase === 'ready' && cameraMode === 'roam' && engineRef.current && (
        <RoamPad engine={engineRef.current} />
      )}

      {coach && phase === 'ready' && <CoachMark onClose={() => setCoach(false)} />}

      {phase === 'ready' && hudHidden && (
        <button className="hud-restore" onClick={() => setHudHidden(false)}>
          H
        </button>
      )}

      {exporting && (
        <ExportProgress
          progress={exportProgress}
          label="RECORDING THE FILM / 正在录制影像"
          detail={`导览镜头 · 30 FPS · ${formatTime(design?.duration ?? 0)} · 请保持页面在前台`}
        />
      )}

      {modal === 'poster' && posterUrl && design && (
        <PosterModal
          url={posterUrl}
          design={design}
          onDownload={() => {
            fetch(posterUrl)
              .then((response) => response.blob())
              .then((blob) => downloadBlob(blob, `ECHOFORM_${design.fingerprint}_poster.png`))
              .catch(() => showToast('下载失败，请重试。', 'error'));
          }}
          onShare={() => {
            setModal(null);
            void openShare();
          }}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'video' && videoUrl && design && (
        <VideoModal
          url={videoUrl}
          duration={videoDuration}
          format={videoMime}
          design={design}
          onDownload={() => {
            const extension = videoMime.includes('mp4') ? 'mp4' : 'webm';
            fetch(videoUrl)
              .then((response) => response.blob())
              .then((blob) => downloadBlob(blob, `ECHOFORM_${design.fingerprint}_film.${extension}`))
              .catch(() => showToast('下载失败，请重试。', 'error'));
          }}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'share' && design && (
        <ShareModal
          url={shareUrl}
          loading={shareLoading}
          copied={copied}
          design={design}
          onCopy={copyShareUrl}
          onExportParams={exportParams}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'presets' && (
        <PresetsModal
          presets={presets}
          onLoad={loadPreset}
          onDelete={removePreset}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'info' && <InfoModal onClose={() => setModal(null)} />}

      {toast && (
        <Toast
          message={toast.message}
          kind={toast.kind}
          onClose={() => setToast(null)}
        />
      )}

      {phase === 'intro' && (
        <div className="intro-corner-signature" aria-hidden>
          <Spark size={12} />
          <span>A GENERATIVE VOICE EXPERIMENT</span>
          <ArrowRight size={12} />
        </div>
      )}
    </div>
  );
};

export default App;
