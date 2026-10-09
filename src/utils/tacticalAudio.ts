/**
 * COMSEC & SIGINT Tactical Audio Suite
 * Módulo de Contra-Espionagem Acústica, Esteganografia com Dispersão Pseudo-Aleatória (PRNG/DSSS),
 * Criptografia com Negabilidade Plausível (Duplo Payload), Esteganografia Espectrográfica Visual
 * e Gerador de Mascaramento Acústico Anti-Grampo (Speech Jammer).
 */

import { computeHash, encryptAESGCM, decryptAESGCM, encryptAsymmetric, decryptAsymmetric } from './crypto';

// =========================================================================
// 1. GERADOR PRNG CRIPTOGRÁFICO BASEADO EM HMAC/SHA-256 PARA DISPERSÃO DSSS
// =========================================================================

/**
 * Gerador de números pseudo-aleatórios derivado da chave secreta (Permutação Fisher-Yates determinística)
 * Garante que os bits sejam espalhados de forma caótica em todo o áudio,
 * tornando o sinal esteganográfico estatisticamente idêntico a ruído branco térmico.
 */
export async function deriveSampleIndices(
  secretSeed: string,
  totalAvailableSamples: number,
  bitsNeeded: number
): Promise<number[]> {
  if (bitsNeeded > totalAvailableSamples) {
    throw new Error('Capacidade insuficiente no áudio para o tamanho do payload criptográfico.');
  }

  // Deriva fluxo de bytes de semente via SHA-256 recursivo
  const indices = new Int32Array(totalAvailableSamples);
  for (let i = 0; i < totalAvailableSamples; i++) indices[i] = i;

  let currentHash = await computeHash(secretSeed, 'SHA-256');
  let hashBytes = new Uint8Array(
    currentHash.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
  );
  let hashIdx = 0;

  // Algoritmo Fisher-Yates parcial com PRNG seguro
  for (let i = totalAvailableSamples - 1; i >= totalAvailableSamples - bitsNeeded; i--) {
    if (hashIdx + 4 >= hashBytes.length) {
      currentHash = await computeHash(currentHash + i.toString(), 'SHA-256');
      hashBytes = new Uint8Array(
        currentHash.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
      );
      hashIdx = 0;
    }

    const randVal =
      (hashBytes[hashIdx] << 24) |
      (hashBytes[hashIdx + 1] << 16) |
      (hashBytes[hashIdx + 2] << 8) |
      hashBytes[hashIdx + 3];
    hashIdx += 4;

    const j = Math.abs(randVal) % (i + 1);
    const temp = indices[i];
    indices[i] = indices[j];
    indices[j] = temp;
  }

  const selected: number[] = [];
  for (let i = totalAvailableSamples - 1; i >= totalAvailableSamples - bitsNeeded; i--) {
    selected.push(indices[i]);
  }
  return selected;
}

// =========================================================================
// 2. CRIPTOGRAFIA COM NEGABILIDADE PLAUSÍVEL (PLAUSIBLE DENIABILITY)
// =========================================================================

export interface PlausibleDeniabilityPackage {
  v: 2;
  salt: string;
  // Bloco cifrado misturado que contém o payload falso e o payload real
  chaff: string;
}

/**
 * Cria pacote duplo:
 * - Senha Coagida / Chave de Falsa Confissão decodifica: 'Mensagem Inofensiva / Decoy'
 * - Senha Real Secreta decodifica: 'Mensagem Real Ultrassecreta'
 */
export async function createPlausibleDeniabilityPayload(
  decoyMessage: string,
  decoyPassword: string,
  realMessage: string,
  realPassword: string
): Promise<string> {
  const encDecoy = await encryptAESGCM(JSON.stringify({ t: 'decoy', m: decoyMessage }), decoyPassword);
  const encReal = await encryptAESGCM(JSON.stringify({ t: 'real', m: realMessage }), realPassword);

  const bundle = {
    mode: 'deniable_dual',
    slotA: encDecoy,
    slotB: encReal,
    ts: Date.now(),
  };

  return JSON.stringify(bundle);
}

/**
 * Tenta abrir o pacote com a senha fornecida: se for a senha do chamariz,
 * retorna a mensagem falsa. Se for a senha real, retorna a mensagem ultra-secreta.
 */
export async function extractDeniableMessage(
  jsonPayload: string,
  passwordAttempt: string
): Promise<{ type: 'decoy' | 'real' | 'single'; message: string }> {
  try {
    const bundle = JSON.parse(jsonPayload);
    if (bundle.mode === 'deniable_dual') {
      // Tentar descriptografar slot A (decoy)
      try {
        const decA = await decryptAESGCM(bundle.slotA, passwordAttempt);
        const parsedA = JSON.parse(decA);
        if (parsedA.t === 'decoy') return { type: 'decoy', message: parsedA.m };
      } catch {
        // Não é slot A, tenta slot B
      }

      // Tentar descriptografar slot B (real)
      try {
        const decB = await decryptAESGCM(bundle.slotB, passwordAttempt);
        const parsedB = JSON.parse(decB);
        if (parsedB.t === 'real') return { type: 'real', message: parsedB.m };
      } catch {
        // Senha não bate com nenhum dos slots
      }

      throw new Error('Chave/Senha incorreta: não foi possível descriptografar nenhum dos compartimentos.');
    }
  } catch (err: unknown) {
    if ((err as Error).message.includes('Chave/Senha')) throw err;
  }

  // Tenta descriptografia simples comum
  const plain = await decryptAESGCM(jsonPayload, passwordAttempt);
  return { type: 'single', message: plain };
}

// =========================================================================
// 3. ESTEGANOGRAFIA ESPECTROGRÁFICA (DESENHAR TEXTO NO ESPECTRO FFT)
// =========================================================================

/**
 * Matriz de glifos 5x7 simples para renderização de caracteres em frequências sonoras
 */
const FONT_5X7: Record<string, number[]> = {
  ' ': [0, 0, 0, 0, 0],
  'A': [0x7C, 0x12, 0x11, 0x12, 0x7C],
  'B': [0x7F, 0x49, 0x49, 0x49, 0x36],
  'C': [0x3E, 0x41, 0x41, 0x41, 0x22],
  'D': [0x7F, 0x41, 0x41, 0x22, 0x1C],
  'E': [0x7F, 0x49, 0x49, 0x49, 0x41],
  'F': [0x7F, 0x09, 0x09, 0x09, 0x01],
  'G': [0x3E, 0x41, 0x49, 0x49, 0x7A],
  'H': [0x7F, 0x08, 0x08, 0x08, 0x7F],
  'I': [0x00, 0x41, 0x7F, 0x41, 0x00],
  'J': [0x20, 0x40, 0x41, 0x3F, 0x01],
  'K': [0x7F, 0x08, 0x14, 0x22, 0x41],
  'L': [0x7F, 0x40, 0x40, 0x40, 0x40],
  'M': [0x7F, 0x02, 0x0C, 0x02, 0x7F],
  'N': [0x7F, 0x04, 0x08, 0x10, 0x7F],
  'O': [0x3E, 0x41, 0x41, 0x41, 0x3E],
  'P': [0x7F, 0x09, 0x09, 0x09, 0x06],
  'Q': [0x3E, 0x41, 0x51, 0x21, 0x5E],
  'R': [0x7F, 0x09, 0x19, 0x29, 0x46],
  'S': [0x46, 0x49, 0x49, 0x49, 0x31],
  'T': [0x01, 0x01, 0x7F, 0x01, 0x01],
  'U': [0x3F, 0x40, 0x40, 0x40, 0x3F],
  'V': [0x1F, 0x20, 0x40, 0x20, 0x1F],
  'W': [0x7F, 0x20, 0x18, 0x20, 0x7F],
  'X': [0x63, 0x14, 0x08, 0x14, 0x63],
  'Y': [0x07, 0x08, 0x70, 0x08, 0x07],
  'Z': [0x61, 0x51, 0x49, 0x45, 0x43],
  '0': [0x3E, 0x51, 0x49, 0x45, 0x3E],
  '1': [0x00, 0x42, 0x7F, 0x40, 0x00],
  '2': [0x42, 0x61, 0x51, 0x49, 0x46],
  '3': [0x21, 0x41, 0x45, 0x4B, 0x31],
  '4': [0x18, 0x14, 0x12, 0x7F, 0x10],
  '5': [0x27, 0x45, 0x45, 0x45, 0x39],
  '6': [0x3C, 0x4A, 0x49, 0x49, 0x30],
  '7': [0x01, 0x71, 0x09, 0x05, 0x03],
  '8': [0x36, 0x49, 0x49, 0x49, 0x36],
  '9': [0x06, 0x49, 0x49, 0x29, 0x1E],
  '-': [0x08, 0x08, 0x08, 0x08, 0x08],
  ':': [0x00, 0x36, 0x36, 0x00, 0x00],
  '!': [0x00, 0x00, 0x5F, 0x00, 0x00],
  '.': [0x00, 0x40, 0x60, 0x00, 0x00],
};

/**
 * Sintetiza áudio que pinta palavras e mensagens diretamente no Espectrograma FFT / Cascata
 * Frequências padrão: 15.000 Hz a 19.500 Hz (próximo ao ultrassom, silencioso para adultos)
 */
export function generateSpectrogramPainterAudio(
  text: string,
  minFreq = 14000,
  maxFreq = 19000,
  charDurationMs = 120,
  sampleRate = 44100
): AudioBuffer {
  const cleanText = text.toUpperCase().replace(/[^A-Z0-9\s\-:\.!]/g, ' ');
  const chars = cleanText.split('');

  // 7 linhas de frequência correspondentes aos 7 bits de altura da fonte 5x7
  const numRows = 7;
  const rowFreqs: number[] = [];
  for (let r = 0; r < numRows; r++) {
    rowFreqs.push(minFreq + (r / (numRows - 1)) * (maxFreq - minFreq));
  }

  const columns: number[] = [];
  // Espaço inicial
  columns.push(0, 0);

  for (const ch of chars) {
    const glyph = FONT_5X7[ch] || FONT_5X7[' '];
    for (const colByte of glyph) {
      columns.push(colByte);
    }
    // Espaçamento de 1 coluna entre caracteres
    columns.push(0);
  }
  columns.push(0, 0);

  const colDurationSec = (charDurationMs / 6) / 1000;
  const colSamples = Math.floor(colDurationSec * sampleRate);
  const totalSamples = columns.length * colSamples;

  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioContextClass();
  const buffer = audioCtx.createBuffer(2, totalSamples, sampleRate);
  audioCtx.close().catch(() => {});

  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  for (let c = 0; c < columns.length; c++) {
    const colByte = columns[c];
    const startSample = c * colSamples;

    for (let s = 0; s < colSamples; s++) {
      const idx = startSample + s;
      const t = idx / sampleRate;
      let val = 0;

      // Cada bit no byte ativa um oscilador na linha de frequência correspondente
      for (let r = 0; r < numRows; r++) {
        if ((colByte >> r) & 1) {
          const freq = rowFreqs[r];
          // Amplitude ajustada para evitar distorção harmônica
          val += Math.sin(2 * Math.PI * freq * t) * 0.08;
        }
      }

      // Envelope trapezoidal suave para evitar cliques de transição
      const env = Math.sin((s / colSamples) * Math.PI);
      const finalSample = val * env;
      left[idx] = finalSample;
      right[idx] = finalSample;
    }
  }

  return buffer;
}

// =========================================================================
// 4. MASCARAMENTO ACÚSTICO ANTI-GRAMPO / SPEECH JAMMER (CONTRA-ESPIONAGEM)
// =========================================================================

export type AcousticMaskMode = 'pink_noise' | 'speech_babble' | 'ultrasonic_shield' | 'chaos_comb';

/**
 * Gera ruído de mascaramento físico para neutralizar microfones ocultos, gravadores e grampos.
 * Os modos utilizam espectros calibrados com as frequências fundamentais da voz humana (300Hz - 3400Hz).
 */
export function generateAcousticMaskingAudio(
  mode: AcousticMaskMode,
  durationSeconds = 60,
  sampleRate = 44100
): AudioBuffer {
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioContextClass();
  const totalSamples = Math.floor(durationSeconds * sampleRate);
  const buffer = audioCtx.createBuffer(2, totalSamples, sampleRate);
  audioCtx.close().catch(() => {});

  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  if (mode === 'pink_noise') {
    // Ruído Rosa (1/f) calibrado - satura microfones sem causar estresse auditivo
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < totalSamples; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
      left[i] = pink;
      right[i] = pink * 0.95;
    }
  } else if (mode === 'speech_babble') {
    // Simulador de Multi-Babble Voice Jammer (sobreposição de formantes fonéticos)
    // Impede algoritmos de transcrição por IA (como Whisper) de isolar as vozes dos presentes
    const formants = [400, 750, 1200, 1800, 2400, 3100];
    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      let mixL = 0;
      let mixR = 0;
      for (let f = 0; f < formants.length; f++) {
        const jitter = Math.sin(t * (3.5 + f * 1.7)) * 80;
        const freq = formants[f] + jitter;
        const mod = Math.sin(t * (7 + f * 2.3));
        const sample = Math.sin(2 * Math.PI * freq * t) * (0.04 + mod * 0.02);
        mixL += sample;
        mixR += Math.cos(2 * Math.PI * (freq * 1.005) * t) * (0.04 - mod * 0.02);
      }
      left[i] = mixL;
      right[i] = mixR;
    }
  } else if (mode === 'ultrasonic_shield') {
    // Escudo Ultrassônico (19.5kHz a 21kHz)
    // Inaudível para ouvidos humanos, mas satura os pré-amplificadores MEMS de smartphones
    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      const sweep = 19500 + Math.sin(2 * Math.PI * 40 * t) * 1200;
      const val = Math.sin(2 * Math.PI * sweep * t) * 0.35;
      left[i] = val;
      right[i] = -val; // Inversão de fase acústica
    }
  } else {
    // Pente de Caos Acústico (Comb Multi-Tom com desfasamento)
    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      let val = 0;
      for (let k = 1; k <= 8; k++) {
        val += Math.sin(2 * Math.PI * (350 * k + Math.sin(t * k) * 50) * t) * 0.04;
      }
      left[i] = val;
      right[i] = val;
    }
  }

  return buffer;
}

// =========================================================================
// 5. SANITIZAÇÃO DE METADADOS & ANTI-FORENSE DE ÁUDIO
// =========================================================================

/**
 * Remove qualquer cabeçalho de rastreio, identificador de dispositivo,
 * carimbo de software ou chunks adicionais (ID3, INFO, LIST) de um áudio WAV
 */
export function sanitizeWavMetadata(wavBytes: Uint8Array): Uint8Array {
  // Reconstrói apenas os 44 bytes canônicos de RIFF/WAVE e o subchunk de dados puro
  const view = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength);

  // Encontra subchunk 'data'
  let dataOffset = -1;
  let dataSize = 0;

  for (let i = 12; i < wavBytes.length - 8; i++) {
    if (
      wavBytes[i] === 0x64 && // 'd'
      wavBytes[i + 1] === 0x61 && // 'a'
      wavBytes[i + 2] === 0x74 && // 't'
      wavBytes[i + 3] === 0x61    // 'a'
    ) {
      dataOffset = i + 8;
      dataSize = view.getUint32(i + 4, true);
      break;
    }
  }

  if (dataOffset === -1) {
    // Retorna inalterado se não encontrar estrutura padrão
    return wavBytes;
  }

  // Copia cabeçalho canônico limpo
  const cleanHeader = new Uint8Array(44 + dataSize);
  cleanHeader.set(wavBytes.slice(0, 36), 0);
  const cleanView = new DataView(cleanHeader.buffer);

  // Escreve tag 'data' e tamanho correto
  cleanHeader[36] = 0x64;
  cleanHeader[37] = 0x61;
  cleanHeader[38] = 0x74;
  cleanHeader[39] = 0x61;
  cleanView.setUint32(40, dataSize, true);
  cleanView.setUint32(4, 36 + dataSize, true);

  // Copia apenas os samples brutos PCM, descartando metadados de cauda
  cleanHeader.set(wavBytes.slice(dataOffset, dataOffset + dataSize), 44);

  return cleanHeader;
}
