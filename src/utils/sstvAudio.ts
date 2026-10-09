/**
 * SSTV & Video-over-Audio Engine
 * Transmissão e Recepção de Imagens e Vídeos através de Ondas Sonoras / Rádio Acústico.
 * Implementa modulação contínua por varredura de linha (Scanlines em FM subcarrier)
 * compatível com padrões mundiais de fax acústico e Slow-Scan TV (ISS / Rádio Amador / Telecomunicações).
 */

export type SstvResolution = '32x32' | '64x64' | '128x128' | '160x120';
export type SstvColorMode = 'grayscale' | 'rgb' | 'nvg' | 'flir';

export interface SstvOptions {
  resolution?: SstvResolution;
  colorMode?: SstvColorMode;
  pixelDurationMs?: number; // ex: 4ms (Rápido), 8ms (Normal), 16ms (Alta Fidelidade)
  sampleRate?: number;
}

export interface SstvResolutionConfig {
  width: number;
  height: number;
}

export const SSTV_RESOLUTIONS: Record<SstvResolution, SstvResolutionConfig> = {
  '32x32': { width: 32, height: 32 },
  '64x64': { width: 64, height: 64 },
  '128x128': { width: 128, height: 128 },
  '160x120': { width: 160, height: 120 },
};

// Frequências padronizadas SSTV (Hz)
export const FREQ_LEADER = 1900;     // Tom de alerta / preâmbulo
export const FREQ_SYNC = 1200;       // Tom de sincronismo horizontal de linha
export const FREQ_FRAME_SYNC = 2100; // Tom de sincronismo de quadro de vídeo
export const FREQ_BLACK = 1500;      // 0 de luminância (preto)
export const FREQ_WHITE = 2300;      // 255 de luminância (branco)

/**
 * Converte qualquer imagem ou frame de vídeo em um canvas de resolução padronizada
 */
export function resizeImageToCanvas(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
  }
  return canvas;
}

/**
 * Mapeia intensidade de cor para paleta térmica FLIR
 */
export function getFlirColor(intensity: number): [number, number, number] {
  const norm = Math.max(0, Math.min(255, intensity)) / 255;
  let r = 0, g = 0, b = 0;
  if (norm < 0.33) {
    b = Math.floor(norm * 3 * 255);
  } else if (norm < 0.66) {
    b = Math.floor((1 - (norm - 0.33) * 3) * 255);
    r = Math.floor((norm - 0.33) * 3 * 255);
  } else {
    r = 255;
    g = Math.floor((norm - 0.66) * 3 * 255);
    b = Math.floor((norm - 0.66) * 3 * 150);
  }
  return [r, g, b];
}

/**
 * Codifica um quadro de imagem em um AudioBuffer com modulação SSTV por varredura contínua de linha
 */
export async function encodeImageToSstvAudio(
  canvas: HTMLCanvasElement,
  options: SstvOptions = {}
): Promise<{ audioBuffer: AudioBuffer; wavBlob: Blob; wavUrl: string; durationSec: number }> {
  const sampleRate = options.sampleRate || 44100;
  const pixelDurationMs = options.pixelDurationMs || 6;
  const colorMode = options.colorMode || 'grayscale';

  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível obter contexto 2D do canvas');

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Cálculo de tempos em segundos
  const leaderSec = 0.25;
  const breakSec = 0.03;
  const syncPulseSec = 0.009;
  const porchSec = 0.003;
  const pixelSec = pixelDurationMs / 1000;

  // Número de canais de cor a varrer por linha
  const channelCount = colorMode === 'rgb' ? 3 : 1;
  const lineSec = syncPulseSec + porchSec + (width * pixelSec * channelCount);
  const totalDuration = leaderSec + breakSec + leaderSec + (height * lineSec) + 0.1;
  const totalSamples = Math.floor(totalDuration * sampleRate);

  const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtxClass();
  const audioBuffer = audioCtx.createBuffer(1, totalSamples, sampleRate);
  audioCtx.close().catch(() => {});

  const channel = audioBuffer.getChannelData(0);
  let sampleIndex = 0;
  let phase = 0;

  // Função interna para gerar tons sinusoidais com fase contínua
  const appendTone = (freq: number, durationSeconds: number, amplitude = 0.8) => {
    const numSamples = Math.floor(durationSeconds * sampleRate);
    const phaseInc = (2 * Math.PI * freq) / sampleRate;

    for (let i = 0; i < numSamples && sampleIndex < totalSamples; i++) {
      channel[sampleIndex++] = Math.sin(phase) * amplitude;
      phase += phaseInc;
      if (phase > 2 * Math.PI) phase -= 2 * Math.PI;
    }
  };

  // 1. Preâmbulo / Cabeçalho de Alerta
  appendTone(FREQ_LEADER, leaderSec, 0.85);
  appendTone(FREQ_SYNC, breakSec, 0.85);
  appendTone(FREQ_LEADER, leaderSec, 0.85);

  // 2. Varredura Linha a Linha (Scanlines)
  for (let y = 0; y < height; y++) {
    // Pulso de sincronismo horizontal de início de linha
    appendTone(FREQ_SYNC, syncPulseSec, 0.9);
    appendTone(FREQ_BLACK, porchSec, 0.8);

    if (colorMode === 'rgb') {
      // 3 Varreduras por linha: R, G e B
      for (let c = 0; c < 3; c++) {
        for (let x = 0; x < width; x++) {
          const pixelOffset = (y * width + x) * 4;
          const val = data[pixelOffset + c];
          const freq = FREQ_BLACK + (val / 255) * (FREQ_WHITE - FREQ_BLACK);
          appendTone(freq, pixelSec, 0.8);
        }
      }
    } else {
      // Varredura de Luminância Monocromática / NVG / FLIR
      for (let x = 0; x < width; x++) {
        const pixelOffset = (y * width + x) * 4;
        const r = data[pixelOffset];
        const g = data[pixelOffset + 1];
        const b = data[pixelOffset + 2];
        // Luminância ITU-R BT.601
        const luminance = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        const freq = FREQ_BLACK + (luminance / 255) * (FREQ_WHITE - FREQ_BLACK);
        appendTone(freq, pixelSec, 0.8);
      }
    }
  }

  // Tom de encerramento
  appendTone(FREQ_LEADER, 0.1, 0.7);

  // Codificação WAV 16-bit PCM
  const wavBlob = encodeMonoWav(channel, sampleRate);
  const wavUrl = URL.createObjectURL(wavBlob);

  return { audioBuffer, wavBlob, wavUrl, durationSec: totalDuration };
}

/**
 * Codifica uma sequência de quadros (Vídeo por Som) em um único sinal de áudio SSTV
 */
export async function encodeVideoToSstvAudio(
  frames: HTMLCanvasElement[],
  fps = 1,
  options: SstvOptions = {}
): Promise<{ audioBuffer: AudioBuffer; wavBlob: Blob; wavUrl: string; durationSec: number }> {
  const sampleRate = options.sampleRate || 44100;
  const audioBuffers: AudioBuffer[] = [];

  for (let f = 0; f < frames.length; f++) {
    const frameResult = await encodeImageToSstvAudio(frames[f], options);
    audioBuffers.push(frameResult.audioBuffer);
  }

  // Concatena todos os quadros com separador de quadro
  let totalLength = 0;
  const frameSepSamples = Math.floor(0.18 * sampleRate);
  for (const b of audioBuffers) {
    totalLength += b.length + frameSepSamples;
  }

  const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtxClass();
  const concatenatedBuffer = audioCtx.createBuffer(1, totalLength, sampleRate);
  audioCtx.close().catch(() => {});

  const out = concatenatedBuffer.getChannelData(0);
  let offset = 0;
  let phase = 0;

  for (let f = 0; f < audioBuffers.length; f++) {
    const src = audioBuffers[f].getChannelData(0);
    out.set(src, offset);
    offset += src.length;

    // Pulso divisor de quadro (FRAME_SYNC a 2100Hz)
    const phaseInc = (2 * Math.PI * FREQ_FRAME_SYNC) / sampleRate;
    for (let s = 0; s < frameSepSamples && offset < totalLength; s++) {
      out[offset++] = Math.sin(phase) * 0.85;
      phase += phaseInc;
      if (phase > 2 * Math.PI) phase -= 2 * Math.PI;
    }
  }

  const wavBlob = encodeMonoWav(out, sampleRate);
  const wavUrl = URL.createObjectURL(wavBlob);
  const durationSec = totalLength / sampleRate;

  return { audioBuffer: concatenatedBuffer, wavBlob, wavUrl, durationSec };
}

/**
 * Codifica array mono float32 em Blob WAV de 16 bits
 */
function encodeMonoWav(samples: Float32Array, sampleRate: number): Blob {
  const numSamples = samples.length;
  const bytesPerSample = 2;
  const dataSize = numSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const intVal = s < 0 ? Math.floor(s * 0x8000) : Math.floor(s * 0x7FFF);
    view.setInt16(offset, intVal, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}
