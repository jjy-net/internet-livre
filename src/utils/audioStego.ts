/**
 * Esteganografia em Áudio / Músicas com Criptografia Assimétrica (RSA-OAEP) e Simétrica (AES-GCM)
 * Permite camuflar mensagens secretas em qualquer arquivo de áudio (MP3, WAV, OGG, M4A)
 * ou carreador sonoro sintético sem alteração audível ao ouvido humano (LSB 16-bit PCM / -96dB SNR).
 */

import { encryptAsymmetric, decryptAsymmetric, encryptAESGCM, decryptAESGCM } from './crypto';

// Tabela estática para cálculo ultra-rápido de integridade CRC-32
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[i] = c >>> 0;
}

export function computeCRC32(bytes: Uint8Array): number {
  let crc = 0 ^ (-1);
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

export interface AudioStegoOptions {
  channel?: 'both' | 'left' | 'right';
  stride?: number; // 1 = consecutivo, 2 = a cada 2 samples, 4 = espalhado
  encryption?: 'none' | 'asymmetric_rsa' | 'symmetric_aes';
  publicKeyPem?: string;
  secretKey?: string;
}

export interface StegoStats {
  carrierDuration: number;
  sampleRate: number;
  totalSamples: number;
  capacityBytes: number;
  usedBytes: number;
  capacityPercent: number;
  snrEstimateDb: number;
  channels: number;
}

export interface ExtractedStegoResult {
  success: boolean;
  message: string;
  isEncrypted: boolean;
  encryptionType: 'none' | 'asymmetric_rsa' | 'symmetric_aes';
  timestamp?: number;
  payloadBytes: number;
  error?: string;
}

const MAGIC_SIGNATURE = [0x4A, 0x59, 0x59, 0x53, 0x54, 0x45, 0x47, 0x00]; // "JYYSTEG\0" (8 bytes)

/**
 * Decodifica qualquer arquivo de áudio aceito pelo navegador (MP3, WAV, AAC, OGG, FLAC) em um AudioBuffer
 */
export async function decodeAudioFile(fileOrBlob: Blob): Promise<AudioBuffer> {
  const arrayBuffer = await fileOrBlob.arrayBuffer();
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioContextClass();
  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    return audioBuffer;
  } finally {
    if (audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => {});
    }
  }
}

/**
 * Gera um carreador musical sintético offline (acordes suaves e harmônicos relaxantes)
 * para testes imediatos sem necessitar de arquivo MP3 externo
 */
export function generateSyntheticCarrier(durationSeconds = 12, sampleRate = 44100): AudioBuffer {
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioContextClass();
  const frameCount = Math.floor(sampleRate * durationSeconds);
  const buffer = audioCtx.createBuffer(2, frameCount, sampleRate);
  audioCtx.close().catch(() => {});

  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Acordes de música ambiente relaxante (Cmaj9 / Fmaj9 / Am7)
  const baseFrequencies = [261.63, 329.63, 392.0, 493.88, 523.25]; // C4, E4, G4, B4, C5

  for (let i = 0; i < frameCount; i++) {
    const t = i / sampleRate;
    let sampleL = 0;
    let sampleR = 0;

    for (let f = 0; f < baseFrequencies.length; f++) {
      const freq = baseFrequencies[f];
      const lfo = Math.sin(2 * Math.PI * 0.2 * t + f);
      const amp = 0.08 / (f + 1);

      sampleL += Math.sin(2 * Math.PI * freq * t + lfo) * amp;
      sampleR += Math.cos(2 * Math.PI * (freq * 1.002) * t + lfo) * amp;
    }

    // Envelope suave de entrada e saída (fade-in / fade-out)
    const envelope = Math.min(1, Math.min(t / 0.5, (durationSeconds - t) / 0.5));
    left[i] = sampleL * envelope;
    right[i] = sampleR * envelope;
  }

  return buffer;
}

/**
 * Converte Float32 [-1.0, 1.0] para PCM 16-bit inteiro com clamp
 */
function floatTo16Bit(val: number): number {
  const s = Math.max(-1, Math.min(1, val));
  return s < 0 ? Math.floor(s * 0x8000) : Math.floor(s * 0x7FFF);
}

/**
 * Converte PCM 16-bit inteiro para Float32
 */
function int16ToFloat(val: number): number {
  return val < 0 ? val / 0x8000 : val / 0x7FFF;
}

/**
 * Embutir mensagem esteganográfica em áudio (LSB de 16-bit PCM)
 */
export async function embedMessageInAudio(
  audioBuffer: AudioBuffer,
  message: string,
  options: AudioStegoOptions = {}
): Promise<{ wavBlob: Blob; wavUrl: string; stats: StegoStats }> {
  const channelMode = options.channel || 'both';
  const stride = Math.max(1, Math.min(16, options.stride || 1));
  const encryption = options.encryption || 'none';

  let rawPayloadString = message;
  let flagEnc = 0x00;

  if (encryption === 'asymmetric_rsa') {
    if (!options.publicKeyPem) throw new Error('Chave Pública RSA necessária para criptografia assimétrica.');
    rawPayloadString = await encryptAsymmetric(message, options.publicKeyPem);
    flagEnc = 0x01; // RSA
  } else if (encryption === 'symmetric_aes') {
    if (!options.secretKey) throw new Error('Senha secreta necessária para criptografia AES.');
    rawPayloadString = await encryptAESGCM(message, options.secretKey);
    flagEnc = 0x02; // AES
  }

  // Pacote JSON interno com carimbo e mensagem
  const packetObj = {
    v: 1,
    ts: Date.now(),
    d: rawPayloadString,
    e: encryption,
  };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(packetObj));
  const payloadLen = payloadBytes.length;
  const payloadCrc = computeCRC32(payloadBytes);

  // Montagem do frame de dados
  // 8 bytes: Magic | 1 byte: Version(0x01) | 1 byte: Flags | 1 byte: Stride | 1 byte: Reserved | 4 bytes: Length | 4 bytes: CRC32 | N bytes: Payload
  const headerLen = 8 + 1 + 1 + 1 + 1 + 4 + 4;
  const totalPacketBytes = headerLen + payloadLen;
  const fullPacket = new Uint8Array(totalPacketBytes);

  // 1. Magic
  fullPacket.set(MAGIC_SIGNATURE, 0);
  // 2. Version
  fullPacket[8] = 0x01;
  // 3. Flags (bit 0-1: enc, bit 2: channelMode)
  let flagChannel = 0x00;
  if (channelMode === 'left') flagChannel = 0x04;
  if (channelMode === 'right') flagChannel = 0x08;
  fullPacket[9] = flagEnc | flagChannel;
  // 4. Stride
  fullPacket[10] = stride;
  // 5. Reserved
  fullPacket[11] = 0x00;

  // 6. Length (Uint32 BE)
  const view = new DataView(fullPacket.buffer, fullPacket.byteOffset, fullPacket.byteLength);
  view.setUint32(12, payloadLen, false);
  // 7. CRC32 (Uint32 BE)
  view.setUint32(16, payloadCrc, false);
  // 8. Payload
  fullPacket.set(payloadBytes, headerLen);

  const totalBits = totalPacketBytes * 8;
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const frameCount = audioBuffer.length;

  // Extrair canais para 16-bit PCM
  const chData: Int16Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    const floatArr = audioBuffer.getChannelData(ch);
    const intArr = new Int16Array(frameCount);
    for (let i = 0; i < frameCount; i++) {
      intArr[i] = floatTo16Bit(floatArr[i]);
    }
    chData.push(intArr);
  }

  // Verificar capacidade disponível
  let usableSamplesCount = 0;
  if (numChannels === 1 || channelMode === 'left' || channelMode === 'right') {
    usableSamplesCount = Math.floor(frameCount / stride);
  } else {
    usableSamplesCount = Math.floor((frameCount * 2) / stride);
  }

  if (totalBits > usableSamplesCount) {
    throw new Error(
      `O áudio selecionado (${(audioBuffer.duration).toFixed(1)}s) suporta até ${Math.floor(usableSamplesCount / 8)} bytes com o intervalo atual. O pacote requer ${totalPacketBytes} bytes. Use um áudio mais longo ou reduza o intervalo.`
    );
  }

  // Embutir bits via LSB
  let bitIndex = 0;
  outerLoop:
  for (let i = 0; i < frameCount; i += stride) {
    for (let ch = 0; ch < numChannels; ch++) {
      if (channelMode === 'left' && ch !== 0) continue;
      if (channelMode === 'right' && ch !== 1) continue;

      if (bitIndex < totalBits) {
        const bytePos = Math.floor(bitIndex / 8);
        const bitOffset = 7 - (bitIndex % 8); // MSB primeiro para cada byte
        const bit = (fullPacket[bytePos] >> bitOffset) & 1;

        // Modifica apenas o LSB (bit 0) do valor PCM de 16 bits (-96 dB alteração inaudível)
        let sample = chData[ch][i];
        sample = (sample & ~1) | bit;
        chData[ch][i] = sample;

        bitIndex++;
        if (bitIndex >= totalBits) {
          break outerLoop;
        }
      }
    }
  }

  // Gerar WAV PCM 16-bit
  const wavBlob = encodeWAV(chData, numChannels, sampleRate);
  const wavUrl = URL.createObjectURL(wavBlob);

  const stats: StegoStats = {
    carrierDuration: audioBuffer.duration,
    sampleRate,
    totalSamples: frameCount * numChannels,
    capacityBytes: Math.floor(usableSamplesCount / 8),
    usedBytes: totalPacketBytes,
    capacityPercent: Math.min(100, Math.round((totalBits / usableSamplesCount) * 1000) / 10),
    snrEstimateDb: 98.2, // Relação Sinal-Ruído estimada para 16-bit LSB
    channels: numChannels,
  };

  return { wavBlob, wavUrl, stats };
}

/**
 * Extrai e decodifica mensagem oculta de um arquivo de áudio WAV
 */
export async function extractMessageFromAudio(
  audioData: Blob | ArrayBuffer,
  privateKeyPem?: string,
  secretKey?: string
): Promise<ExtractedStegoResult> {
  let arrayBuffer: ArrayBuffer;
  if (audioData instanceof Blob) {
    arrayBuffer = await audioData.arrayBuffer();
  } else {
    arrayBuffer = audioData;
  }

  // Decodifica PCM a partir do arquivo WAV ou via AudioContext
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioContextClass();
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  } catch (err) {
    throw new Error('Falha ao decodificar arquivo de áudio. Certifique-se que é um formato válido (WAV/MP3).');
  } finally {
    if (audioCtx.state !== 'closed') audioCtx.close().catch(() => {});
  }

  const numChannels = audioBuffer.numberOfChannels;
  const frameCount = audioBuffer.length;
  const chData: Int16Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    const floatArr = audioBuffer.getChannelData(ch);
    const intArr = new Int16Array(frameCount);
    for (let i = 0; i < frameCount; i++) {
      intArr[i] = floatTo16Bit(floatArr[i]);
    }
    chData.push(intArr);
  }

  // Tentar padrões comuns de leitura (both, left, right com strides comuns)
  const channelModes: ('both' | 'left' | 'right')[] = ['both', 'left', 'right'];
  const strideCandidates = [1, 2, 4, 8];

  for (const stride of strideCandidates) {
    for (const channelMode of channelModes) {
      const extracted = tryExtractWithParams(chData, numChannels, frameCount, channelMode, stride);
      if (extracted) {
        // Encontrou pacote válido com assinatura e CRC!
        return await processExtractedPayload(extracted, privateKeyPem, secretKey);
      }
    }
  }

  return {
    success: false,
    message: '',
    isEncrypted: false,
    encryptionType: 'none',
    payloadBytes: 0,
    error: 'Nenhuma mensagem esteganográfica oculta do padrão Jyy foi detectada neste áudio.',
  };
}

function tryExtractWithParams(
  chData: Int16Array[],
  numChannels: number,
  frameCount: number,
  channelMode: 'both' | 'left' | 'right',
  stride: number
): { payloadBytes: Uint8Array; flags: number; version: number } | null {
  const headerLen = 8 + 1 + 1 + 1 + 1 + 4 + 4; // 20 bytes = 160 bits
  const headerBits: number[] = [];

  let bitCount = 0;
  for (let i = 0; i < frameCount && bitCount < 160; i += stride) {
    for (let ch = 0; ch < numChannels; ch++) {
      if (channelMode === 'left' && ch !== 0) continue;
      if (channelMode === 'right' && ch !== 1) continue;

      headerBits.push(chData[ch][i] & 1);
      bitCount++;
      if (bitCount >= 160) break;
    }
  }

  if (headerBits.length < 160) return null;

  // Reconstrói 20 bytes do cabeçalho
  const headerBytes = new Uint8Array(headerLen);
  for (let b = 0; b < headerLen; b++) {
    let byteVal = 0;
    for (let bit = 0; bit < 8; bit++) {
      byteVal = (byteVal << 1) | headerBits[b * 8 + bit];
    }
    headerBytes[b] = byteVal;
  }

  // Valida Assinatura Mágica
  for (let m = 0; m < MAGIC_SIGNATURE.length; m++) {
    if (headerBytes[m] !== MAGIC_SIGNATURE[m]) return null;
  }

  const version = headerBytes[8];
  const flags = headerBytes[9];
  const storedStride = headerBytes[10];

  // Se o stride salvo no header for diferente do atual, descartar
  if (storedStride !== stride) return null;

  const view = new DataView(headerBytes.buffer);
  const payloadLen = view.getUint32(12, false);
  const payloadCrc = view.getUint32(16, false);

  if (payloadLen <= 0 || payloadLen > 50 * 1024 * 1024) return null; // Limite de sanidade de 50MB

  const totalBitsNeeded = (headerLen + payloadLen) * 8;
  const allBits: number[] = [];

  let readBits = 0;
  for (let i = 0; i < frameCount && readBits < totalBitsNeeded; i += stride) {
    for (let ch = 0; ch < numChannels; ch++) {
      if (channelMode === 'left' && ch !== 0) continue;
      if (channelMode === 'right' && ch !== 1) continue;

      allBits.push(chData[ch][i] & 1);
      readBits++;
      if (readBits >= totalBitsNeeded) break;
    }
  }

  if (allBits.length < totalBitsNeeded) return null;

  // Extrai bytes do payload
  const payloadBytes = new Uint8Array(payloadLen);
  for (let b = 0; b < payloadLen; b++) {
    let byteVal = 0;
    const startBit = (headerLen + b) * 8;
    for (let bit = 0; bit < 8; bit++) {
      byteVal = (byteVal << 1) | allBits[startBit + bit];
    }
    payloadBytes[b] = byteVal;
  }

  // Valida CRC32 para garantir integridade e descartar falsos positivos
  const calcCrc = computeCRC32(payloadBytes);
  if (calcCrc !== payloadCrc) {
    return null;
  }

  return { payloadBytes, flags, version };
}

async function processExtractedPayload(
  extracted: { payloadBytes: Uint8Array; flags: number; version: number },
  privateKeyPem?: string,
  secretKey?: string
): Promise<ExtractedStegoResult> {
  const encFlag = extracted.flags & 0x03;
  let encType: 'none' | 'asymmetric_rsa' | 'symmetric_aes' = 'none';
  if (encFlag === 0x01) encType = 'asymmetric_rsa';
  if (encFlag === 0x02) encType = 'symmetric_aes';

  let rawJson = '';
  try {
    rawJson = new TextDecoder().decode(extracted.payloadBytes);
  } catch {
    return {
      success: false,
      message: '',
      isEncrypted: encType !== 'none',
      encryptionType: encType,
      payloadBytes: extracted.payloadBytes.length,
      error: 'Não foi possível decodificar os bytes recuperados.',
    };
  }

  let packet: { v: number; ts: number; d: string; e: string };
  try {
    packet = JSON.parse(rawJson);
  } catch {
    // Pode ser texto cru legado
    return {
      success: true,
      message: rawJson,
      isEncrypted: false,
      encryptionType: 'none',
      payloadBytes: extracted.payloadBytes.length,
    };
  }

  if (encType === 'asymmetric_rsa') {
    if (!privateKeyPem || !privateKeyPem.trim()) {
      return {
        success: false,
        message: '',
        isEncrypted: true,
        encryptionType: 'asymmetric_rsa',
        timestamp: packet.ts,
        payloadBytes: extracted.payloadBytes.length,
        error: 'Esta mensagem está criptografada com Chave Pública RSA. Forneça sua Chave Privada correspondente para descriptografar.',
      };
    }

    try {
      const decrypted = await decryptAsymmetric(packet.d, privateKeyPem.trim());
      return {
        success: true,
        message: decrypted,
        isEncrypted: true,
        encryptionType: 'asymmetric_rsa',
        timestamp: packet.ts,
        payloadBytes: extracted.payloadBytes.length,
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: '',
        isEncrypted: true,
        encryptionType: 'asymmetric_rsa',
        timestamp: packet.ts,
        payloadBytes: extracted.payloadBytes.length,
        error: 'Chave Privada incorreta ou incompatível com a chave pública utilizada: ' + (err as Error).message,
      };
    }
  }

  if (encType === 'symmetric_aes') {
    if (!secretKey || !secretKey.trim()) {
      return {
        success: false,
        message: '',
        isEncrypted: true,
        encryptionType: 'symmetric_aes',
        timestamp: packet.ts,
        payloadBytes: extracted.payloadBytes.length,
        error: 'Esta mensagem está protegida por senha AES. Forneça a senha para descriptografar.',
      };
    }

    try {
      const decrypted = await decryptAESGCM(packet.d, secretKey.trim());
      return {
        success: true,
        message: decrypted,
        isEncrypted: true,
        encryptionType: 'symmetric_aes',
        timestamp: packet.ts,
        payloadBytes: extracted.payloadBytes.length,
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: '',
        isEncrypted: true,
        encryptionType: 'symmetric_aes',
        timestamp: packet.ts,
        payloadBytes: extracted.payloadBytes.length,
        error: 'Senha incorreta para a mensagem criptografada.',
      };
    }
  }

  return {
    success: true,
    message: packet.d,
    isEncrypted: false,
    encryptionType: 'none',
    timestamp: packet.ts,
    payloadBytes: extracted.payloadBytes.length,
  };
}

/**
 * Codifica canais PCM 16-bit em um arquivo Blob padrão RIFF/WAVE
 */
function encodeWAV(chData: Int16Array[], numChannels: number, sampleRate: number): Blob {
  const frameCount = chData[0].length;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = frameCount * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // 1. "RIFF" chunk
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // 2. "fmt " subchunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM subchunk size
  view.setUint16(20, 1, true); // AudioFormat: 1 (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // 16 bits per sample

  // 3. "data" subchunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave PCM samples
  let offset = 44;
  for (let i = 0; i < frameCount; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      view.setInt16(offset, chData[ch][i], true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
