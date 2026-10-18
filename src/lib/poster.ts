import { formatTime, styleByKey, type DesignSpec } from '../types';

const loadImage = (blob: Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('POSTER_IMAGE_FAILED'));
    };
    image.src = url;
  });

const drawTrackingText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
): void => {
  let cursor = x;
  for (const char of text) {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + tracking;
  }
};

export const createPoster = async (
  screenshot: Blob,
  design: DesignSpec,
  width = 2560,
  height = 1440,
): Promise<Blob> => {
  await document.fonts.ready;
  const image = await loadImage(screenshot);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const scale = width / 2560;
  const meta = styleByKey(design.style);

  // Cover crop the WebGL frame.
  const imageRatio = image.width / image.height;
  const targetRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;
  let offsetX = 0;
  let offsetY = 0;
  if (imageRatio > targetRatio) {
    drawWidth = height * imageRatio;
    offsetX = (width - drawWidth) / 2;
  } else {
    drawHeight = width / imageRatio;
    offsetY = (height - drawHeight) / 2;
  }
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

  const topGradient = ctx.createLinearGradient(0, 0, 0, height * 0.32);
  topGradient.addColorStop(0, 'rgba(3,3,3,0.78)');
  topGradient.addColorStop(1, 'rgba(3,3,3,0)');
  ctx.fillStyle = topGradient;
  ctx.fillRect(0, 0, width, height * 0.34);

  const bottomGradient = ctx.createLinearGradient(0, height * 0.48, 0, height);
  bottomGradient.addColorStop(0, 'rgba(3,3,3,0)');
  bottomGradient.addColorStop(0.55, 'rgba(3,3,3,0.5)');
  bottomGradient.addColorStop(1, 'rgba(3,3,3,0.96)');
  ctx.fillStyle = bottomGradient;
  ctx.fillRect(0, height * 0.4, width, height * 0.6);

  ctx.strokeStyle = 'rgba(231,220,200,0.22)';
  ctx.lineWidth = 1 * scale;
  const margin = 72 * scale;
  ctx.strokeRect(margin, margin, width - margin * 2, height - margin * 2);

  // Corner registration marks.
  ctx.strokeStyle = 'rgba(231,220,200,0.65)';
  const mark = 20 * scale;
  for (const [x, y, sx, sy] of [
    [margin, margin, 1, 1],
    [width - margin, margin, -1, 1],
    [margin, height - margin, 1, -1],
    [width - margin, height - margin, -1, -1],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x, y + sy * mark);
    ctx.lineTo(x, y);
    ctx.lineTo(x + sx * mark, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#ece2cf';
  ctx.font = `600 ${21 * scale}px "Manrope Variable", Manrope, sans-serif`;
  ctx.textBaseline = 'middle';
  drawTrackingText(ctx, 'ECHOFORM', margin + 26 * scale, margin + 28 * scale, 8 * scale);
  ctx.fillStyle = 'rgba(236,226,207,0.58)';
  ctx.font = `500 ${13 * scale}px "Manrope Variable", Manrope, sans-serif`;
  drawTrackingText(ctx, 'VOICE ARCHITECTURE / 声音建筑师', margin + 220 * scale, margin + 28 * scale, 3.4 * scale);

  ctx.fillStyle = 'rgba(236,226,207,0.55)';
  ctx.font = `500 ${13 * scale}px "Manrope Variable", Manrope, sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText(meta.labelEn, width - margin - 26 * scale, margin + 28 * scale);
  ctx.textAlign = 'left';

  const baseline = height - margin - 84 * scale;
  ctx.fillStyle = '#f0e7d5';
  ctx.font = `400 ${84 * scale}px "Instrument Serif", "Times New Roman", serif`;
  ctx.fillText(design.name, margin + 26 * scale, baseline - 122 * scale);
  ctx.fillStyle = 'rgba(240,231,213,0.9)';
  ctx.font = `400 ${37 * scale}px "Noto Serif SC", "Songti SC", serif`;
  ctx.fillText(design.nameZh, margin + 28 * scale, baseline - 58 * scale);

  ctx.strokeStyle = 'rgba(236,226,207,0.38)';
  ctx.beginPath();
  ctx.moveTo(margin + 26 * scale, baseline);
  ctx.lineTo(width - margin - 26 * scale, baseline);
  ctx.stroke();

  ctx.fillStyle = 'rgba(236,226,207,0.54)';
  ctx.font = `500 ${12 * scale}px "Manrope Variable", Manrope, sans-serif`;
  const stats = [
    `PITCH ${design.metrics.rootNote}`,
    `TEMPO ${design.metrics.bpm} BPM`,
    `VOICE ${formatTime(design.duration)}`,
    `SILENCE ${Math.round(design.metrics.silenceRatio * 100)}%`,
    `SEED ${design.fingerprint.toUpperCase()}`,
  ];
  stats.forEach((stat, index) => {
    drawTrackingText(ctx, stat, margin + 28 * scale + index * 286 * scale, baseline + 40 * scale, 1.4 * scale);
  });

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(236,226,207,0.44)';
  ctx.font = `500 ${11 * scale}px "Manrope Variable", Manrope, sans-serif`;
  drawTrackingText(ctx, 'A GENERATIVE SOUND ARTWORK', width - margin - 360 * scale, height - margin - 34 * scale, 3 * scale);
  ctx.textAlign = 'left';

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('POSTER_ENCODE_FAILED'));
    }, 'image/png');
  });
};

export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
};
