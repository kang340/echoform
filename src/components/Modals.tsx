import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { formatTime, STYLES, styleByKey, type DesignSpec, type UserPreset } from '../types';
import {
  ArrowRight,
  Camera,
  Check,
  Close,
  Download,
  Link,
  Music,
  Save,
  Share,
  Spark,
  Trash,
  Video,
} from './Icons';

const Modal = ({
  children,
  onClose,
  className = '',
  label,
}: {
  children: ReactNode;
  onClose: () => void;
  className?: string;
  label: string;
}) => {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className={`modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button ref={closeRef} className="modal-close" onClick={onClose} aria-label="关闭">
          <Close size={18} />
        </button>
        {children}
      </div>
    </div>
  );
};

interface PosterModalProps {
  url: string;
  design: DesignSpec;
  onDownload: () => void;
  onShare: () => void;
  onClose: () => void;
}

export const PosterModal = ({ url, design, onDownload, onShare, onClose }: PosterModalProps) => (
  <Modal onClose={onClose} className="poster-modal" label="作品海报">
    <div className="modal-kicker">
      <Camera size={14} />
      FRAME 01 / EXPORTED POSTER
    </div>
    <h2 className="modal-title">声音的立面</h2>
    <p className="modal-subtitle">
      {design.name} · {design.nameZh}
    </p>
    <div className="poster-frame">
      <img src={url} alt={`${design.name} 的声音建筑海报`} />
    </div>
    <div className="modal-actions-row">
      <button className="primary-action" onClick={onDownload}>
        <Download size={16} />
        下载 2560 × 1440
      </button>
      <button className="secondary-action" onClick={onShare}>
        <Share size={16} />
        分享建筑
      </button>
      <button className="text-action" onClick={onClose}>
        返回建筑
        <ArrowRight size={14} />
      </button>
    </div>
    <p className="modal-note">海报由当前实时渲染画面与作品声学数据合成。建议保留原始 PNG 用于印刷。</p>
  </Modal>
);

interface VideoModalProps {
  url: string;
  duration: number;
  format: string;
  design: DesignSpec;
  onDownload: () => void;
  onClose: () => void;
}

export const VideoModal = ({ url, duration, format, design, onDownload, onClose }: VideoModalProps) => (
  <Modal onClose={onClose} className="video-modal" label="影像预览">
    <div className="modal-kicker">
      <Video size={14} />
      FILM 01 / 30 FPS
    </div>
    <h2 className="modal-title">一段会生长的影像</h2>
    <p className="modal-subtitle">
      {design.nameZh} · {formatTime(duration)} · WITH SOUND
    </p>
    <div className="video-frame">
      <video src={url} controls autoPlay loop playsInline />
    </div>
    <div className="modal-actions-row">
      <button className="primary-action" onClick={onDownload}>
        <Download size={16} />
        下载影像
      </button>
      <span className="export-meta">
        {format.includes('mp4') ? 'MP4 · H.264 / AAC' : 'WEBM · VP9 / OPUS'} · 30 FPS
      </span>
      <button className="text-action" onClick={onClose}>
        返回建筑
        <ArrowRight size={14} />
      </button>
    </div>
    <p className="modal-note">
      影像以导览镜头录制，并包含作品原声。优先使用 MP4；浏览器不支持时自动回退到 WebM。
    </p>
  </Modal>
);

interface ShareModalProps {
  url: string;
  loading: boolean;
  copied: boolean;
  design: DesignSpec;
  onCopy: () => void;
  onExportParams: () => void;
  onClose: () => void;
}

export const ShareModal = ({
  url,
  loading,
  copied,
  design,
  onCopy,
  onExportParams,
  onClose,
}: ShareModalProps) => {
  const meta = styleByKey(design.style);
  return (
    <Modal onClose={onClose} className="share-modal" label="分享作品">
      <div className="modal-kicker">
        <Link size={14} />
        SHARE THE ARCHITECTURE
      </div>
      <h2 className="modal-title">让另一个人走进来</h2>
      <p className="modal-subtitle">
        分享链接携带完整建筑参数与声学指纹，但不包含原始音频。
      </p>
      <div className="share-card">
        <div className="share-art" style={{ '--share-accent': meta.accent } as CSSProperties}>
          <span className="share-index">{meta.index}</span>
          <div>
            <span>{meta.labelEn}</span>
            <b>{design.name}</b>
            <small>{design.nameZh}</small>
          </div>
          <Spark size={20} />
        </div>
        <div className="share-url-row">
          <input readOnly value={loading ? '正在封装建筑参数…' : url} aria-label="分享链接" />
          <button className="primary-action copy-button" onClick={onCopy} disabled={loading}>
            {copied ? <Check size={15} /> : <Link size={15} />}
            {copied ? '已复制' : '复制链接'}
          </button>
        </div>
      </div>
      <div className="share-facts">
        <div>
          <span>SEED</span>
          <b>{design.fingerprint.toUpperCase()}</b>
        </div>
        <div>
          <span>STYLE</span>
          <b>{meta.label}</b>
        </div>
        <div>
          <span>DURATION</span>
          <b>{formatTime(design.duration)}</b>
        </div>
        <div>
          <span>PHRASES</span>
          <b>{String(design.phraseMarks.length).padStart(2, '0')}</b>
        </div>
      </div>
      <div className="modal-actions-row">
        <button className="secondary-action" onClick={onExportParams}>
          <Download size={16} />
          下载参数文件
        </button>
        <span className="share-caption">
          推荐配文：我的声音长成了一座建筑。 / My voice became a building. #ECHOFORM
        </span>
        <button className="text-action" onClick={onClose}>
          返回建筑
          <ArrowRight size={14} />
        </button>
      </div>
    </Modal>
  );
};

interface PresetsModalProps {
  presets: UserPreset[];
  onLoad: (preset: UserPreset) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const PresetsModal = ({ presets, onLoad, onDelete, onClose }: PresetsModalProps) => (
  <Modal onClose={onClose} className="presets-modal" label="我的展厅">
    <div className="modal-kicker">
      <Save size={14} />
      LOCAL COLLECTION / 本地收藏
    </div>
    <h2 className="modal-title">我的展厅</h2>
    <p className="modal-subtitle">作品只保存在当前浏览器。载入后可以继续探索、调整灯光并重新导出。</p>
    {presets.length === 0 ? (
      <div className="empty-presets">
        <Spark size={26} />
        <p>展厅还没有作品。</p>
        <span>完成一次声音建筑后，点击「保存作品」即可收藏。</span>
      </div>
    ) : (
      <div className="preset-list">
        {presets.map((preset) => {
          const meta = styleByKey(preset.settings.style);
          return (
            <article key={preset.id} className="preset-item">
              <button className="preset-main" onClick={() => onLoad(preset)}>
                <span className="preset-index">{meta.index}</span>
                <span className="preset-copy">
                  <b>{preset.design.name}</b>
                  <small>
                    {preset.design.nameZh} · {meta.label} · {formatTime(preset.design.duration)}
                  </small>
                </span>
                <span className="preset-date">
                  {new Date(preset.createdAt).toLocaleDateString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                  })}
                </span>
                <ArrowRight size={15} />
              </button>
              <button
                className="preset-delete"
                onClick={() => onDelete(preset.id)}
                aria-label={`删除 ${preset.design.name}`}
              >
                <Trash size={15} />
              </button>
            </article>
          );
        })}
      </div>
    )}
    <p className="modal-note">参数文件包含几何、材质与灯光设置；音频不会写入本地展厅。</p>
  </Modal>
);

export const InfoModal = ({ onClose }: { onClose: () => void }) => (
  <Modal onClose={onClose} className="info-modal" label="关于 ECHOFORM">
    <div className="modal-kicker">
      <Spark size={14} />
      ABOUT THE WORK / 作品说明
    </div>
    <h2 className="modal-title info-title">
      ECHOFORM
      <span>声音建筑师</span>
    </h2>
    <p className="info-lead">
      一次把声带振动翻译成空间秩序的尝试。这里没有随机的频谱柱，只有可以被解释、被重访、被走进的建筑。
    </p>

    <div className="info-columns">
      <section>
        <h3>声音如何成为建筑</h3>
        <div className="mapping-table">
          <div>
            <span>低频</span>
            <p>拱券、基座与厚重墙体</p>
          </div>
          <div>
            <span>高频</span>
            <p>细长光柱、晶簇与悬浮尖顶</p>
          </div>
          <div>
            <span>音高</span>
            <p>拱顶高度、旋梯半径与垂直比例</p>
          </div>
          <div>
            <span>响度</span>
            <p>整体尺度、构件厚度与曝光</p>
          </div>
          <div>
            <span>节奏</span>
            <p>侧殿排布、阶梯数量与环带密度</p>
          </div>
          <div>
            <span>停顿</span>
            <p>空厅、缺口与建筑之间的距离</p>
          </div>
          <div>
            <span>音色</span>
            <p>材质、粒子运动与光色</p>
          </div>
          <div>
            <span>时长</span>
            <p>建筑展开的节拍与镜头路径</p>
          </div>
        </div>
      </section>
      <section>
        <h3>一种可重复的声音诗学</h3>
        <p>
          每一次分析都会生成一枚声学指纹。它决定建筑的主音、拱肋数量、侧殿方位与微观细节。只要声音相同，建筑就可以被精确重建；换一种风格，同一段声音会显露出完全不同的性格。
        </p>
        <h3>隐私</h3>
        <p>
          麦克风与音频文件只在本机浏览器中处理，不会上传服务器。分享链接只包含建筑参数与声学摘要。
        </p>
        <h3>技术</h3>
        <p>Custom FFT & YIN-inspired pitch estimation · Web Audio API · Three.js · WebGL shaders · deterministic procedural modelling</p>
      </section>
    </div>

    <div className="info-credits">
      <div>
        <h4>THREE ART DIRECTIONS</h4>
        {STYLES.map((style) => (
          <span key={style.key}>
            <i style={{ background: style.accent }} />
            {style.label} / {style.labelEn}
          </span>
        ))}
      </div>
      <div>
        <h4>ASSETS & LICENSE</h4>
        <p>
          全部几何、着色器、界面图形与内置示例声景均为本项目原创生成。字体 Instrument Serif 与 Manrope
          以 SIL Open Font License 使用；Three.js 以 MIT 许可证使用。完整清单见交付文档。
        </p>
      </div>
    </div>
    <p className="info-footer">ECHOFORM · VOICE ARCHITECTURE · VERSION 1.0 · 2026</p>
  </Modal>
);

export const ExportProgress = ({
  progress,
  label,
  detail,
}: {
  progress: number;
  label: string;
  detail: string;
}) => (
  <div className="export-progress" role="status" aria-live="polite">
    <div className="export-progress-inner">
      <div className="export-rings" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <p className="eyebrow">
        <span className="record-dot" />
        {label}
      </p>
      <div className="export-number">{Math.round(progress * 100)}<small>%</small></div>
      <div className="export-bar">
        <span style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <p className="export-detail">{detail}</p>
    </div>
  </div>
);

export const Toast = ({
  message,
  kind = 'info',
  onClose,
}: {
  message: string;
  kind?: 'info' | 'error' | 'success';
  onClose: () => void;
}) => {
  useEffect(() => {
    const timeout = window.setTimeout(onClose, 3800);
    return () => window.clearTimeout(timeout);
    // The callback identity changes with playback renders; the timer should not reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);
  return (
    <div className={`toast toast-${kind}`} role="status">
      <span className="toast-dot" />
      <p>{message}</p>
      <button onClick={onClose} aria-label="关闭提示">
        <Close size={14} />
      </button>
    </div>
  );
};

export const CoachMark = ({ onClose }: { onClose: () => void }) => (
  <div className="coach-mark">
    <span className="coach-icon">
      <Music size={16} />
    </span>
    <div>
      <b>建筑已生成</b>
      <p>拖动旋转 · 滚轮缩放 · 按 1/2/3 更换风格 · 进入「漫游」走进它</p>
    </div>
    <button onClick={onClose} aria-label="关闭提示">
      <Close size={15} />
    </button>
  </div>
);
