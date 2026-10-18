interface AnalysisOverlayProps {
  progress: number;
  label: string;
  styleLabel: string;
}

const STAGES = [
  { zh: '解析声纹', en: 'READ THE SIGNAL' },
  { zh: '提取音高', en: 'MEASURE PITCH' },
  { zh: '编排空间', en: 'COMPOSE THE PLAN' },
  { zh: '浇筑结构', en: 'CAST THE FORM' },
];

const AnalysisOverlay = ({ progress, label, styleLabel }: AnalysisOverlayProps) => {
  const percentage = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  const currentStage = Math.min(3, Math.floor((percentage / 100) * 4));
  const arcs = [32, 58, 84, 110, 138];

  return (
    <div className="analysis-overlay">
      <div className="analysis-left">
        <p className="eyebrow">
          <span className="status-dot is-warm" />
          FABRICATION SEQUENCE / 构筑中
        </p>
        <div className="analysis-title">
          <span className="analysis-number">{String(percentage).padStart(2, '0')}</span>
          <span className="analysis-percent">%</span>
        </div>
        <p className="analysis-current-label">{label}</p>
        <div className="analysis-progress">
          <span style={{ width: `${percentage}%` }} />
        </div>
        <ol className="analysis-stages">
          {STAGES.map((stage, index) => (
            <li
              key={stage.en}
              className={
                index < currentStage ? 'is-done' : index === currentStage ? 'is-current' : ''
              }
            >
              <span className="stage-index">0{index + 1}</span>
              <span className="stage-name">{stage.zh}</span>
              <span className="stage-en">{stage.en}</span>
              <span className="stage-state">
                {index < currentStage ? 'OK' : index === currentStage ? '···' : '—'}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="analysis-blueprint" aria-hidden>
        <svg viewBox="0 0 420 420" fill="none">
          <defs>
            <linearGradient id="bp-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e8d9be" stopOpacity=".7" />
              <stop offset="1" stopColor="#e8d9be" stopOpacity=".04" />
            </linearGradient>
          </defs>
          <g opacity=".16" stroke="#e8d9be" strokeWidth=".5">
            {Array.from({ length: 11 }, (_, i) => (
              <line key={`v${i}`} x1={40 + i * 34} y1="46" x2={40 + i * 34} y2="376" />
            ))}
            {Array.from({ length: 10 }, (_, i) => (
              <line key={`h${i}`} x1="42" y1={52 + i * 36} x2="380" y2={52 + i * 36} />
            ))}
          </g>
          <g stroke="url(#bp-fade)" strokeWidth="1.1">
            {arcs.map((radius, index) => (
              <path
                key={radius}
                className="blueprint-arc"
                style={{ animationDelay: `${index * 0.15}s` }}
                d={`M ${210 - radius * 1.55} 368 C ${210 - radius * 1.72} 220, ${210 - radius * 0.9} 96, 210 52 C ${210 + radius * 0.9} 96, ${210 + radius * 1.72} 220, ${210 + radius * 1.55} 368`}
                pathLength={1}
              />
            ))}
            <line x1="64" y1="368" x2="356" y2="368" strokeDasharray="3 7" />
            <line x1="210" y1="44" x2="210" y2="380" strokeDasharray="2 8" opacity=".5" />
            <circle cx="210" cy="214" r="3.5" fill="#e8d9be" stroke="none" />
            <circle cx="210" cy="214" r="12" strokeDasharray="2 5" opacity=".5" />
          </g>
          <g fill="#e8d9be" fontSize="7.5" fontFamily="Manrope, sans-serif" opacity=".56" letterSpacing="1">
            <text x="44" y="38">PLAN 01 / RADIAL NAVE</text>
            <text x="284" y="404">SEED — {percentage}%</text>
            <text x="44" y="404">STYLE / {styleLabel}</text>
          </g>
        </svg>
        <div className="blueprint-scan" />
      </div>

      <p className="analysis-footnote">
        正在把一段 {label.includes('浇筑') ? '已完成分析的声音' : '正在分析的声音'} 翻译成可进入的空间。
      </p>
    </div>
  );
};

export default AnalysisOverlay;
