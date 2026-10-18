import { formatTime, noteName, type LiveFeature } from '../types';
import { Close, Stop } from './Icons';
import { LiveScope } from './LiveScope';

interface RecordingOverlayProps {
  elapsed: number;
  maxDuration: number;
  live: LiveFeature;
  accent: string;
  getAnalyser: () => {
    frequency: Float32Array;
    time: Float32Array;
    sampleRate: number;
    fftSize: number;
  } | null;
  onStop: () => void;
  onCancel: () => void;
}

const RecordingOverlay = ({
  elapsed,
  maxDuration,
  live,
  accent,
  getAnalyser,
  onStop,
  onCancel,
}: RecordingOverlayProps) => {
  const tenths = Math.floor((elapsed % 1) * 10);
  const level = Math.min(100, Math.round(live.rms * 100));
  const pitchPosition = Math.min(96, Math.max(4, live.pitchNorm * 100));

  return (
    <div className="recording-overlay">
      <div className="recording-top">
        <div className="recording-statusline">
          <span className="record-dot" />
          <span>RECORDING / 正在聆听</span>
          <span className="recording-channel">CH. 01 · MONO</span>
        </div>
        <button className="icon-button close-recording" onClick={onCancel} aria-label="取消录音">
          <Close size={18} />
        </button>
      </div>

      <div className="recording-center-mark" aria-hidden>
        <span className="mark-h" />
        <span className="mark-v" />
        <span className="mark-corner mark-tl" />
        <span className="mark-corner mark-tr" />
        <span className="mark-corner mark-bl" />
        <span className="mark-corner mark-br" />
      </div>

      <div className="recording-timer-block">
        <p className="eyebrow">YOUR VOICE IS BEING MEASURED</p>
        <div className="recording-timer">
          {formatTime(elapsed)}
          <span className="timer-tenths">.{tenths}</span>
        </div>
        <p className="recording-instruction">
          继续说，或者停下来。
          <br />
          <span>停顿会在建筑里留下一座空厅。</span>
        </p>
      </div>

      <aside className="pitch-ruler" aria-label={`当前音高 ${live.pitch ? noteName(live.pitch) : '未检测'}`}>
        <span className="pitch-ruler-label">PITCH</span>
        <div className="pitch-track">
          <span className="pitch-tick" style={{ top: '4%' }} />
          <span className="pitch-tick" style={{ top: '24%' }} />
          <span className="pitch-tick" style={{ top: '48%' }} />
          <span className="pitch-tick" style={{ top: '72%' }} />
          <span className="pitch-tick" style={{ top: '96%' }} />
          <span className="pitch-marker" style={{ top: `${100 - pitchPosition}%`, background: accent }} />
        </div>
        <span className="pitch-note">{live.pitch ? noteName(live.pitch) : '—'}</span>
        <span className="pitch-hz">{live.pitch ? `${Math.round(live.pitch)} Hz` : 'SILENCE'}</span>
      </aside>

      <div className="recording-bottom">
        <div className="live-readout">
          <div className="live-readout-head">
            <span>LIVE SPECTRUM</span>
            <span>
              LEVEL <b>{level}</b>
            </span>
            <span>
              LIMIT <b>{formatTime(maxDuration)}</b>
            </span>
          </div>
          <LiveScope
            active
            getAnalyser={getAnalyser}
            accent={accent}
            className="recording-scope"
          />
          <div className="live-level-track">
            <span style={{ width: `${level}%`, background: accent }} />
          </div>
        </div>

        <div className="recording-actions">
          <button className="stop-button" onClick={onStop} aria-label="结束录音并构筑建筑">
            <span className="stop-circle">
              <Stop size={20} />
            </span>
            <span className="stop-text">
              结束并构筑
              <small>BUILD THE SPACE</small>
            </span>
          </button>
          <button className="recording-cancel" onClick={onCancel}>
            取消并返回
          </button>
        </div>
      </div>

      <p className="recording-privacy">音频只在你的设备上处理 · AUDIO STAYS ON THIS DEVICE</p>
    </div>
  );
};

export default RecordingOverlay;
