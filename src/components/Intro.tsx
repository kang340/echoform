import { useRef, type CSSProperties } from 'react';
import { STYLES, type StyleKey } from '../types';
import { ArrowRight, Info, Logo, Mic, Upload, Music } from './Icons';

interface IntroProps {
  style: StyleKey;
  busy: boolean;
  onStyle: (style: StyleKey) => void;
  onRecord: () => void;
  onDemo: () => void;
  onFile: (file: File) => void;
  onInfo: () => void;
}

export const Intro = ({ style, busy, onStyle, onRecord, onDemo, onFile, onInfo }: IntroProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const active = STYLES.find((item) => item.key === style) ?? STYLES[0];

  return (
    <div className="intro">
      <header className="site-header">
        <button className="brand" onClick={onInfo} aria-label="关于 ECHOFORM">
          <Logo size={31} />
          <span className="brand-lockup">
            <span className="brand-name">ECHOFORM</span>
            <span className="brand-sub">声音建筑师</span>
          </span>
        </button>
        <div className="site-header-center">
          <span>GENERATIVE SOUND ARCHITECTURE</span>
          <span className="header-rule" />
          <span>VOL. 001</span>
        </div>
        <button className="text-button" onClick={onInfo}>
          <Info size={15} />
          关于作品
        </button>
      </header>

      <div className="intro-axis" aria-hidden>
        <span>LISTEN</span>
        <span className="axis-line" />
        <span>SPEAK</span>
        <span className="axis-line" />
        <span>BUILD</span>
        <span className="axis-line" />
        <span>WALK</span>
      </div>

      <div className="intro-side-note" aria-hidden>
        <span>34° 12′ N</span>
        <span>118° 15′ E</span>
        <span className="side-note-mark">◌</span>
      </div>

      <div className="intro-copy">
        <p className="eyebrow">
          <span className="status-dot" />
          A VOICE-TO-ARCHITECTURE EXPERIENCE
        </p>
        <h1 className="intro-title">
          让你的声音
          <br />
          <em>成为一座建筑</em>
        </h1>
        <p className="intro-description">
          说一句话，唱一段旋律，或只是呼吸。
          <br />
          音高、响度、节奏与停顿，将在这里变成拱券、光柱、阶梯与空厅。
        </p>
        <p className="intro-index">
          <span>01</span> LISTEN TO YOURSELF <span className="intro-index-line" /> 声音不是配乐，是材料
        </p>
      </div>

      <div className="intro-actions">
        <button className={`mic-button ${busy ? 'is-busy' : ''}`} onClick={onRecord} disabled={busy}>
          <span className="mic-ring mic-ring-outer" />
          <span className="mic-ring mic-ring-inner" />
          <span className="mic-core">
            <Mic size={30} />
          </span>
          <span className="mic-label">开始说话</span>
        </button>
        <div className="secondary-actions">
          <button className="quiet-action" onClick={() => inputRef.current?.click()} disabled={busy}>
            <Upload size={15} />
            上传音频
          </button>
          <span className="action-divider" />
          <button className="quiet-action" onClick={onDemo} disabled={busy}>
            <Music size={15} />
            聆听示例
          </button>
        </div>
        <p className="mic-hint">
          <span className="hint-key">5–20 SEC</span>
          一段话即可。停顿会留下空厅。
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac,.aac"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
            event.target.value = '';
          }}
        />
      </div>

      <div className="style-selector intro-style-selector">
        <div className="style-selector-head">
          <span>ART DIRECTION</span>
          <span>三种建筑语言</span>
        </div>
        {STYLES.map((item) => (
          <button
            key={item.key}
            className={`style-pill ${style === item.key ? 'is-active' : ''}`}
            onClick={() => onStyle(item.key)}
            style={{ '--pill-accent': item.accent } as CSSProperties}
          >
            <span className="style-pill-index">{item.index}</span>
            <span className="style-pill-copy">
              <span>{item.label}</span>
              <small>{item.labelEn}</small>
            </span>
            <span className="style-pill-dot" />
          </button>
        ))}
        <p className="style-caption" style={{ color: active.accent }}>
          {active.tagline}
        </p>
      </div>

      <footer className="intro-footer">
        <span>ECHOFORM © 2026</span>
        <span className="footer-center">声音在这里拥有体积</span>
        <button className="footer-link" onClick={onInfo}>
          创作方法 <ArrowRight size={13} />
        </button>
      </footer>
    </div>
  );
};
