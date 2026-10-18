import { useEffect, useRef } from 'react';

interface AnalyserPayload {
  frequency: Float32Array;
  time: Float32Array;
  sampleRate: number;
  fftSize: number;
}

interface LiveScopeProps {
  active: boolean;
  getAnalyser: () => AnalyserPayload | null;
  accent?: string;
  className?: string;
}

export const LiveScope = ({ active, getAnalyser, accent = '#e7d8bb', className }: LiveScopeProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    let frame = 0;
    let smoothed = new Float32Array(72);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const draw = () => {
      frame = requestAnimationFrame(draw);
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      context.clearRect(0, 0, width, height);
      if (!active) return;
      const payload = getAnalyser();
      if (!payload) return;

      const bars = 72;
      if (smoothed.length !== bars) smoothed = new Float32Array(bars);
      const binCount = payload.frequency.length;
      const step = Math.max(1, Math.floor(binCount * 0.55 / bars));
      for (let i = 0; i < bars; i += 1) {
        let sum = 0;
        for (let j = 0; j < step; j += 1) {
          const value = payload.frequency[Math.min(binCount - 1, i * step + j)];
          sum += Math.max(-100, Math.min(0, value));
        }
        const db = sum / step;
        const level = Math.max(0.025, Math.min(1, (db + 82) / 68));
        smoothed[i] += (level - smoothed[i]) * 0.28;
      }

      const barWidth = width / bars;
      context.save();
      context.shadowBlur = 12;
      context.shadowColor = accent;
      for (let i = 0; i < bars; i += 1) {
        const value = smoothed[i];
        const h = Math.max(1.2, value * height * 0.9);
        const x = i * barWidth + barWidth * 0.28;
        const y = (height - h) / 2;
        const gradient = context.createLinearGradient(0, y, 0, y + h);
        gradient.addColorStop(0, `${accent}22`);
        gradient.addColorStop(0.5, accent);
        gradient.addColorStop(1, `${accent}33`);
        context.fillStyle = gradient;
        context.globalAlpha = 0.28 + value * 0.72;
        context.fillRect(x, y, Math.max(0.8, barWidth * 0.44), h);
      }
      context.restore();

      // A hairline center pulse.
      context.strokeStyle = `${accent}55`;
      context.lineWidth = 0.6;
      context.beginPath();
      context.moveTo(0, height / 2);
      context.lineTo(width, height / 2);
      context.stroke();
    };
    draw();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [active, getAnalyser, accent]);

  return <canvas ref={canvasRef} className={className ?? 'live-scope'} aria-hidden />;
};

export const getAnalyserPayload = (analyser: AnalyserNode | null): AnalyserPayload | null => {
  if (!analyser) return null;
  const frequency = new Float32Array(analyser.frequencyBinCount);
  const time = new Float32Array(analyser.fftSize);
  analyser.getFloatFrequencyData(frequency);
  analyser.getFloatTimeDomainData(time);
  return {
    frequency,
    time,
    sampleRate: analyser.context.sampleRate,
    fftSize: analyser.fftSize,
  };
};
