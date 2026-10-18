import { useCallback, useMemo, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import {
  formatTime,
  noteName,
  STYLES,
  styleByKey,
  type CameraMode,
  type DesignSpec,
  type ExperienceSettings,
  type LightParams,
  type MaterialParams,
  type StyleKey,
  type VoiceScore,
} from '../types';
import type { EngineStats } from '../three/engine';
import {
  Camera,
  Compass,
  Download,
  Folder,
  Fullscreen,
  Info,
  Logo,
  Mic,
  Orbit,
  Pause,
  Play,
  Restart,
  Save,
  Share,
  Sliders,
  Spark,
  Video,
  Volume,
  VolumeOff,
  Walk,
} from './Icons';

export type PanelTab = 'form' | 'light' | 'score';

interface WorkbenchProps {
  design: DesignSpec;
  score: VoiceScore | null;
  settings: ExperienceSettings;
  time: number;
  playing: boolean;
  shared: boolean;
  muted: boolean;
  cameraMode: CameraMode;
  panelOpen: boolean;
  panelTab: PanelTab;
  stats: EngineStats | null;
  accent: string;
  onPlay: () => void;
  onSeek: (time: number) => void;
  onReplay: () => void;
  onStyle: (style: StyleKey) => void;
  onCamera: (mode: CameraMode) => void;
  onTogglePanel: () => void;
  onPanelTab: (tab: PanelTab) => void;
  onMaterials: (patch: Partial<MaterialParams>) => void;
  onLights: (patch: Partial<LightParams>) => void;
  onScreenshot: () => void;
  onVideo: () => void;
  onShare: () => void;
  onSave: () => void;
  onExportParams: () => void;
  onOpenPresets: () => void;
  onInfo: () => void;
  onMute: () => void;
  onFullscreen: () => void;
  onNew: () => void;
  onResetSettings: () => void;
}

const CAMERA_ITEMS: { key: CameraMode; label: string; icon: typeof Orbit; hint: string }[] = [
  { key: 'orbit', label: '轨道', icon: Orbit, hint: '拖动旋转 · 滚轮缩放' },
  { key: 'roam', label: '漫游', icon: Walk, hint: '拖动视线 · WASD 移动 · QE 升降' },
  { key: 'guide', label: '导览', icon: Compass, hint: '镜头自动巡游' },
];

const Range = ({
  label,
  en,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  format,
}: {
  label: string;
  en: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (value: number) => string;
}) => {
  const percentage = ((value - min) / (max - min)) * 100;
  return (
    <label className="range-control">
      <span className="range-head">
        <span>
          {label}
          <small>{en}</small>
        </span>
        <b>{format ? format(value) : value.toFixed(2)}</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ '--range-fill': `${percentage}%` } as CSSProperties}
      />
    </label>
  );
};

const Timeline = ({
  design,
  score,
  time,
  playing,
  shared,
  muted,
  onPlay,
  onSeek,
  onReplay,
  onMute,
}: {
  design: DesignSpec;
  score: VoiceScore | null;
  time: number;
  playing: boolean;
  shared: boolean;
  muted: boolean;
  onPlay: () => void;
  onSeek: (time: number) => void;
  onReplay: () => void;
  onMute: () => void;
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const duration = design.duration;
  const progress = Math.min(1, Math.max(0, time / Math.max(0.1, duration)));
  const waveform = useMemo(() => {
    const source = score?.waveform ?? design.pulse;
    return Array.from({ length: 168 }, (_, index) => {
      const position = (index / 167) * (source.length - 1);
      const left = Math.floor(position);
      const right = Math.min(source.length - 1, left + 1);
      const value = source[left] + (source[right] - source[left]) * (position - left);
      return Math.max(0.035, Math.min(1, value));
    });
  }, [score, design.pulse]);

  const seekFromEvent = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      onSeek(ratio * duration);
    },
    [duration, onSeek],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    seekFromEvent(event.clientX);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (draggingRef.current) seekFromEvent(event.clientX);
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore lost pointer capture.
    }
  };

  return (
    <div className={`timeline ${shared ? 'is-shared' : ''}`}>
      <div className="timeline-transport">
        <button className="play-button" onClick={onPlay} aria-label={playing ? '暂停' : '播放'} disabled={shared}>
          {playing ? <Pause size={17} /> : <Play size={17} />}
        </button>
        <button className="transport-small" onClick={onReplay} aria-label="从头重播" disabled={shared}>
          <Restart size={15} />
        </button>
        <div className="timeline-clock">
          <b>{formatTime(time)}</b>
          <span>/ {formatTime(duration)}</span>
        </div>
      </div>

      <div className="timeline-main">
        <div className="timeline-meta">
          <span>VOICE TIMELINE</span>
          <span className="timeline-phrases">
            {design.phraseMarks.length} BREATHS
            {design.metrics.silenceRatio > 0.12 ? ` · ${Math.round(design.metrics.silenceRatio * 100)}% SILENCE` : ''}
          </span>
        </div>
        <div
          ref={trackRef}
          className="timeline-track"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="slider"
          aria-label="声音时间轴"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={time}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') onSeek(Math.max(0, time - 1));
            if (event.key === 'ArrowRight') onSeek(Math.min(duration, time + 1));
          }}
        >
          <div className="timeline-wave">
            {waveform.map((value, index) => (
              <span
                key={index}
                className={index / waveform.length <= progress ? 'is-played' : ''}
                style={{ height: `${Math.round(value * 100)}%` }}
              />
            ))}
          </div>
          <div className="timeline-progress" style={{ width: `${progress * 100}%` }} />
          {design.phraseMarks.map((mark, index) => (
            <span
              key={`${mark.t}-${index}`}
              className="phrase-marker"
              style={{ left: `${(mark.t / duration) * 100}%` }}
              title={`第 ${index + 1} 次呼吸`}
            >
              <i />
              <em>{String(index + 1).padStart(2, '0')}</em>
            </span>
          ))}
          <span className="timeline-head" style={{ left: `${progress * 100}%` }} />
        </div>
      </div>

      <div className="timeline-end">
        <span className="timeline-seed">SEED {design.fingerprint.slice(0, 6).toUpperCase()}</span>
        <button className="transport-small" onClick={onMute} aria-label={muted ? '取消静音' : '静音'}>
          {muted ? <VolumeOff size={15} /> : <Volume size={15} />}
        </button>
        {shared && <span className="shared-badge">SHARED FORM · 无音频</span>}
      </div>
    </div>
  );
};

const StudioPanel = ({
  design,
  settings,
  panelTab,
  shared,
  stats,
  onTab,
  onMaterials,
  onLights,
  onStyle,
  onSave,
  onExportParams,
  onOpenPresets,
  onResetSettings,
  onClose,
}: {
  design: DesignSpec;
  settings: ExperienceSettings;
  panelTab: PanelTab;
  shared: boolean;
  stats: EngineStats | null;
  onTab: (tab: PanelTab) => void;
  onMaterials: (patch: Partial<MaterialParams>) => void;
  onLights: (patch: Partial<LightParams>) => void;
  onStyle: (style: StyleKey) => void;
  onSave: () => void;
  onExportParams: () => void;
  onOpenPresets: () => void;
  onResetSettings: () => void;
  onClose: () => void;
}) => {
  const activeStyle = styleByKey(settings.style);
  const { metrics } = design;
  return (
    <aside className="studio-panel" aria-label="创作控制面板">
      <div className="studio-head">
        <div>
          <span className="studio-kicker">ECHOFORM STUDIO</span>
          <h2>控制室</h2>
        </div>
        <button className="panel-close" onClick={onClose} aria-label="关闭面板">
          <span />
          <span />
        </button>
      </div>

      <div className="studio-tabs" role="tablist">
        {[
          { key: 'form' as const, index: '01', label: '形体' },
          { key: 'light' as const, index: '02', label: '光' },
          { key: 'score' as const, index: '03', label: '档案' },
        ].map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={panelTab === tab.key}
            className={panelTab === tab.key ? 'is-active' : ''}
            onClick={() => onTab(tab.key)}
          >
            <span>{tab.index}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="studio-body">
        {panelTab === 'form' && (
          <>
            <section className="studio-section">
              <div className="section-label">
                <span>艺术风格</span>
                <small>ART DIRECTION</small>
              </div>
              <div className="studio-style-list">
                {STYLES.map((style) => (
                  <button
                    key={style.key}
                    className={settings.style === style.key ? 'is-active' : ''}
                    onClick={() => onStyle(style.key)}
                    style={{ '--style-accent': style.accent } as CSSProperties}
                  >
                    <span className="studio-style-index">{style.index}</span>
                    <span>
                      <b>{style.label}</b>
                      <small>{style.labelEn}</small>
                    </span>
                    <i />
                  </button>
                ))}
              </div>
              <p className="style-description">{activeStyle.description}</p>
            </section>

            <section className="studio-section">
              <div className="section-label">
                <span>材料</span>
                <small>MATERIAL RESPONSE</small>
              </div>
              <Range
                label="光泽"
                en="GLOSS"
                value={settings.materials.gloss}
                onChange={(value) => onMaterials({ gloss: value })}
              />
              <Range
                label="透光"
                en="TRANSMISSION"
                value={settings.materials.transmission}
                onChange={(value) => onMaterials({ transmission: value })}
              />
              <Range
                label="清晰度"
                en="CLARITY"
                value={settings.materials.clarity}
                onChange={(value) => onMaterials({ clarity: value })}
              />
            </section>
          </>
        )}

        {panelTab === 'light' && (
          <>
            <section className="studio-section">
              <div className="section-label">
                <span>影像曝光</span>
                <small>IMAGE</small>
              </div>
              <Range
                label="曝光"
                en="EXPOSURE"
                value={settings.materials.exposure}
                min={0.55}
                max={1.6}
                onChange={(value) => onMaterials({ exposure: value })}
              />
              <Range
                label="辉光"
                en="BLOOM"
                value={settings.materials.bloom}
                onChange={(value) => onMaterials({ bloom: value })}
              />
              <Range
                label="色温"
                en="WARMTH"
                value={settings.lights.warmth}
                onChange={(value) => onLights({ warmth: value })}
              />
            </section>
            <section className="studio-section">
              <div className="section-label">
                <span>灯光布置</span>
                <small>LIGHTING</small>
              </div>
              <Range
                label="主光"
                en="KEY LIGHT"
                value={settings.lights.key}
                max={2}
                onChange={(value) => onLights({ key: value })}
              />
              <Range
                label="轮廓光"
                en="RIM LIGHT"
                value={settings.lights.rim}
                max={2}
                onChange={(value) => onLights({ rim: value })}
              />
              <Range
                label="环境光"
                en="AMBIENT"
                value={settings.lights.ambient}
                max={2}
                onChange={(value) => onLights({ ambient: value })}
              />
            </section>
          </>
        )}

        {panelTab === 'score' && (
          <>
            <section className="studio-section">
              <div className="section-label">
                <span>声学指纹</span>
                <small>ACOUSTIC FINGERPRINT</small>
              </div>
              <div className="score-grid">
                <div>
                  <span>主音</span>
                  <b>{metrics.rootNote}</b>
                </div>
                <div>
                  <span>调性</span>
                  <b>{metrics.keyLabel.split(' · ')[1] ?? metrics.keyLabel}</b>
                </div>
                <div>
                  <span>脉冲</span>
                  <b>{metrics.bpm} BPM</b>
                </div>
                <div>
                  <span>静默</span>
                  <b>{Math.round(metrics.silenceRatio * 100)}%</b>
                </div>
                <div>
                  <span>动态</span>
                  <b>{Math.round(metrics.dynamicRange)} dB</b>
                </div>
                <div>
                  <span>音域</span>
                  <b>{Math.round(metrics.pitchRange)} st</b>
                </div>
              </div>
            </section>
            <section className="studio-section">
              <div className="section-label">
                <span>建筑翻译</span>
                <small>ARCHITECTURAL TRANSLATION</small>
              </div>
              <ul className="translation-list">
                <li>
                  <span>{String(design.archCount).padStart(2, '0')}</span>
                  道低频拱肋
                </li>
                <li>
                  <span>{String(design.columnCount).padStart(2, '0')}</span>
                  根高频光柱
                </li>
                <li>
                  <span>{String(design.chamberCount).padStart(2, '0')}</span>
                  座呼吸侧殿
                </li>
                <li>
                  <span>{String(design.stairSteps).padStart(2, '0')}</span>
                  级螺旋阶梯
                </li>
              </ul>
              <p className="score-description">{design.description}</p>
            </section>
          </>
        )}
      </div>

      <div className="studio-footer">
        <div className="studio-actions">
          <button onClick={onSave}>
            <Save size={14} />
            保存作品
          </button>
          <button onClick={onExportParams}>
            <Download size={14} />
            参数文件
          </button>
        </div>
        <div className="studio-links">
          <button onClick={onOpenPresets}>
            <Folder size={13} />
            我的展厅
          </button>
          <button onClick={onResetSettings}>重置参数</button>
        </div>
        <div className="studio-status">
          <span className={shared ? 'is-shared' : ''}>{shared ? 'SHARED · 静态建筑' : 'LIVE COMPOSITION'}</span>
          <span>{stats ? `${stats.fps} FPS · ${stats.drawCalls} CALLS` : 'RENDERING'}</span>
        </div>
      </div>
    </aside>
  );
};

export const Workbench = ({
  design,
  score,
  settings,
  time,
  playing,
  shared,
  muted,
  cameraMode,
  panelOpen,
  panelTab,
  stats,
  accent,
  onPlay,
  onSeek,
  onReplay,
  onStyle,
  onCamera,
  onTogglePanel,
  onPanelTab,
  onMaterials,
  onLights,
  onScreenshot,
  onVideo,
  onShare,
  onSave,
  onExportParams,
  onOpenPresets,
  onInfo,
  onMute,
  onFullscreen,
  onNew,
  onResetSettings,
}: WorkbenchProps) => {
  const activeCamera = CAMERA_ITEMS.find((item) => item.key === cameraMode) ?? CAMERA_ITEMS[0];
  const styleMeta = styleByKey(settings.style);
  return (
    <div className="workbench" style={{ '--accent': accent } as CSSProperties}>
      <header className="workbench-top">
        <button className="brand brand-compact" onClick={onInfo} aria-label="关于作品">
          <Logo size={27} />
          <span className="brand-lockup">
            <span className="brand-name">ECHOFORM</span>
            <span className="brand-sub">声音建筑师</span>
          </span>
        </button>

        <div className="workbench-style-switch" role="tablist" aria-label="艺术风格">
          {STYLES.map((style) => (
            <button
              key={style.key}
              role="tab"
              data-style={style.key}
              aria-selected={settings.style === style.key}
              className={settings.style === style.key ? 'is-active' : ''}
              onClick={() => onStyle(style.key)}
            >
              <span>{style.index}</span>
              {style.label}
            </button>
          ))}
        </div>

        <div className="workbench-actions">
          <button
            className="camera-cycle"
            data-camera-cycle
            onClick={() => {
              const order: CameraMode[] = ['orbit', 'roam', 'guide'];
              onCamera(order[(order.indexOf(cameraMode) + 1) % order.length]);
            }}
            title={`镜头 · ${activeCamera.label}（点击切换）`}
            aria-label={`切换镜头，当前${activeCamera.label}`}
          >
            <activeCamera.icon size={16} />
          </button>
          <div className="camera-switch" aria-label="镜头模式">
            {CAMERA_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  data-camera={item.key}
                  title={item.hint}
                  aria-label={item.key === 'guide' ? '导览' : item.label}
                  className={cameraMode === item.key ? 'is-active' : ''}
                  onClick={() => onCamera(item.key)}
                >
                  <Icon size={16} />
                </button>
              );
            })}
          </div>
          <span className="top-divider" />
          <button className="icon-button" data-action="poster" onClick={onScreenshot} aria-label="生成截图" title="生成艺术海报">
            <Camera size={18} />
          </button>
          <button className="icon-button" data-action="video" onClick={onVideo} aria-label="导出视频" title="导出影像">
            <Video size={18} />
          </button>
          <button className="icon-button" data-action="share" onClick={onShare} aria-label="分享作品" title="分享建筑">
            <Share size={18} />
          </button>
          <button className="icon-button" data-action="save" onClick={onSave} aria-label="保存作品" title="保存至展厅">
            <Save size={18} />
          </button>
          <button
            className={`icon-button panel-toggle ${panelOpen ? 'is-active' : ''}`}
            onClick={onTogglePanel}
            aria-label="打开控制室"
            aria-expanded={panelOpen}
            title="控制室"
          >
            <Sliders size={18} />
          </button>
        </div>
      </header>

      <section className="workbench-identity">
        <div className="identity-top">
          <span className="status-dot" />
          <span>VOICE ARCHITECTURE / {styleMeta.labelEn}</span>
          <span className="identity-number">NO. {design.fingerprint.slice(0, 3).toUpperCase()}</span>
        </div>
        <h1>{design.name}</h1>
        <p className="identity-cn">{design.nameZh}</p>
        <p className="identity-desc">{design.description}</p>
        <div className="identity-meta">
          <span>{design.phraseMarks.length} BREATHS</span>
          <span>{design.archCount} ARCHES</span>
          <span>{design.columnCount} COLUMNS</span>
        </div>
        <button className="new-piece" onClick={onNew}>
          <Mic size={14} />
          再做一座
        </button>
      </section>

      <div className="camera-hint">
        <span className="camera-hint-icon">
          {cameraMode === 'roam' ? <Walk size={14} /> : cameraMode === 'guide' ? <Compass size={14} /> : <Orbit size={14} />}
        </span>
        {activeCamera.hint}
      </div>

      <button
        className={`studio-mobile-handle ${panelOpen ? 'is-hidden' : ''}`}
        onClick={onTogglePanel}
        aria-label="打开控制室"
      >
        <Sliders size={16} />
        <span>控制室</span>
      </button>

      <div className={`studio-shell ${panelOpen ? 'is-open' : ''}`}>
        <StudioPanel
          design={design}
          settings={settings}
          panelTab={panelTab}
          shared={shared}
          stats={stats}
          onTab={onPanelTab}
          onMaterials={onMaterials}
          onLights={onLights}
          onStyle={onStyle}
          onSave={onSave}
          onExportParams={onExportParams}
          onOpenPresets={onOpenPresets}
          onResetSettings={onResetSettings}
          onClose={onTogglePanel}
        />
      </div>

      <div className="acoustic-card">
        <div className="acoustic-head">
          <span>声学档案</span>
          <small>VOICE PRINT</small>
          <Spark size={13} />
        </div>
        <div className="acoustic-character">
          <b>{design.metrics.character}</b>
          <span>{design.metrics.characterEn}</span>
        </div>
        <div className="acoustic-grid">
          <div>
            <span>KEY</span>
            <b>{design.metrics.keyLabel}</b>
          </div>
          <div>
            <span>PITCH</span>
            <b>{noteName(design.metrics.pitchMedian)}</b>
          </div>
          <div>
            <span>PULSE</span>
            <b>{design.metrics.bpm} BPM</b>
          </div>
          <div>
            <span>SILENCE</span>
            <b>{Math.round(design.metrics.silenceRatio * 100)}%</b>
          </div>
        </div>
        <div className="acoustic-bars" aria-hidden>
          {Array.from({ length: 26 }, (_, index) => {
            const source = design.pulse;
            const value = source[Math.floor((index / 26) * source.length)] ?? 0;
            return <i key={index} style={{ height: `${Math.max(8, value * 100)}%` }} />;
          })}
        </div>
      </div>

      <Timeline
        design={design}
        score={score}
        time={time}
        playing={playing}
        shared={shared}
        muted={muted}
        onPlay={onPlay}
        onSeek={onSeek}
        onReplay={onReplay}
        onMute={onMute}
      />

      <button className="fullscreen-button" onClick={onFullscreen} aria-label="全屏" title="全屏">
        <Fullscreen size={16} />
      </button>
      <button className="info-fab" onClick={onInfo} aria-label="关于作品" title="关于作品">
        <Info size={15} />
      </button>
    </div>
  );
};

export default Workbench;
