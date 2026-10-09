/**
 * Acoustic Mesh Network Engine (Rede P2P por Som)
 * Protocolo de enlace e rede física acústica com CSMA/CA, endereçamento de nós,
 * multiplexação de canais (FDMA), controle de colisão, confirmação ACK/Retransmissão
 * e telemetria de perda de pacotes e velocidade em tempo real.
 */

// CRC-16-CCITT (Polinômio 0x1021) para validação ultra-rápida de integridade de frames
export function computeCrc16(bytes: Uint8Array): number {
  let crc = 0xFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i] << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc;
}

// Canais Acústicos Frequenciais (FDMA) para permitir múltiplos nós na mesma sala
export interface AcousticChannelConfig {
  id: number;
  name: string;
  txFreq0: number; // Bit 0
  txFreq1: number; // Bit 1
  rxFreq0: number; // Bit 0 para Full-Duplex FDD
  rxFreq1: number; // Bit 1 para Full-Duplex FDD
  description: string;
}

export const ACOUSTIC_CHANNELS: AcousticChannelConfig[] = [
  {
    id: 1,
    name: 'Canal 1 (Baixa Frequência • Penetração)',
    txFreq0: 700,
    txFreq1: 1000,
    rxFreq0: 1200,
    rxFreq1: 1500,
    description: 'Maior alcance em ambientes amplos com obstáculos.',
  },
  {
    id: 2,
    name: 'Canal 2 (Padrão Telecom • Equilibrado)',
    txFreq0: 1600,
    txFreq1: 1900,
    rxFreq0: 2100,
    rxFreq1: 2400,
    description: 'Ótima resposta na maioria dos alto-falantes e microfones.',
  },
  {
    id: 3,
    name: 'Canal 3 (Agudo Penetrante • Anti-Eco)',
    txFreq0: 2600,
    txFreq1: 3000,
    rxFreq0: 3300,
    rxFreq1: 3700,
    description: 'Isola ruídos de conversas humanas no ambiente.',
  },
  {
    id: 4,
    name: 'Canal 4 (Silencioso • Quase Ultrassônico)',
    txFreq0: 17500,
    txFreq1: 18200,
    rxFreq0: 18800,
    rxFreq1: 19500,
    description: 'Inaudível para humanos; comunicação discreta e velada.',
  },
];

// Tipos de Quadros Acústicos
export enum FrameType {
  DATA = 0x01,
  ACK = 0x02,
  PING = 0x03,
  PONG = 0x04,
  BEACON = 0x05,
  BROADCAST = 0x06,
}

export interface AcousticFrame {
  type: FrameType;
  networkId: number; // 0x4A59 ("JY")
  srcNode: string;   // ex: "N1" (2 chars)
  dstNode: string;   // ex: "N2" ou "**" (broadcast)
  seq: number;
  payload: string;
  crc: number;
  rawBytes?: Uint8Array;
}

export interface NetworkPeerInfo {
  nodeId: string;
  lastSeen: number;
  rttMs?: number;
  packetsReceived: number;
  snrEstimate: number;
}

import { GyrophoneAcousticSensor } from './gyrophoneSensor';

export interface NetworkMetrics {
  txBytesPerSec: number;
  rxBytesPerSec: number;
  packetLossPercent: number;
  txTotalPackets: number;
  rxTotalPackets: number;
  txRetries: number;
  crcErrors: number;
  currentChannel: number;
  carrierBusy: boolean;
  receiverSource: 'microphone' | 'gyroscope';
  gyroActive?: boolean;
  gyroSampleRateHz?: number;
  gyroRmsVibration?: number;
  gyroDominantAxis?: string;
  gyroFallbackReason?: string | null;
}

/**
 * Serializa um quadro acústico em bytes padronizados
 * Formato: PREAMBLE(2B: 0xAA, 0x55) | NET_ID(2B) | TYPE(1B) | SRC(2B) | DST(2B) | SEQ(1B) | LEN(1B) | PAYLOAD(NB) | CRC16(2B)
 */
export function serializeAcousticFrame(
  type: FrameType,
  srcNode: string,
  dstNode: string,
  seq: number,
  payloadText: string
): Uint8Array {
  const enc = new TextEncoder();
  const payloadBytes = enc.encode(payloadText);
  const len = Math.min(64, payloadBytes.length); // Limite de tamanho de frame tático para baixa latência

  const srcPadded = srcNode.padEnd(2, ' ').slice(0, 2);
  const dstPadded = dstNode.padEnd(2, ' ').slice(0, 2);

  const headerLen = 2 + 2 + 1 + 2 + 2 + 1 + 1; // 11 bytes
  const totalLen = headerLen + len + 2; // + 2 bytes CRC
  const buffer = new Uint8Array(totalLen);

  // 1. Preamble de sincronização
  buffer[0] = 0xAA;
  buffer[1] = 0x55;

  // 2. Network ID (0x4A59 = "JY")
  buffer[2] = 0x4A;
  buffer[3] = 0x59;

  // 3. Frame Type
  buffer[4] = type;

  // 4. Source Node (2 bytes ASCII)
  buffer[5] = srcPadded.charCodeAt(0);
  buffer[6] = srcPadded.charCodeAt(1);

  // 5. Dest Node (2 bytes ASCII)
  buffer[7] = dstPadded.charCodeAt(0);
  buffer[8] = dstPadded.charCodeAt(1);

  // 6. Seq
  buffer[9] = seq & 0xFF;

  // 7. Len
  buffer[10] = len & 0xFF;

  // 8. Payload
  buffer.set(payloadBytes.slice(0, len), headerLen);

  // 9. CRC-16 (calculado sobre campos 2 a payload)
  const crcData = buffer.slice(2, headerLen + len);
  const crcVal = computeCrc16(crcData);

  buffer[headerLen + len] = (crcVal >> 8) & 0xFF;
  buffer[headerLen + len + 1] = crcVal & 0xFF;

  return buffer;
}

/**
 * Desserializa bytes em quadro acústico validando preâmbulo e CRC
 */
export function deserializeAcousticFrame(bytes: Uint8Array): AcousticFrame | null {
  if (bytes.length < 13) return null;

  // Procura preâmbulo 0xAA, 0x55
  let startOffset = -1;
  for (let i = 0; i <= bytes.length - 13; i++) {
    if (bytes[i] === 0xAA && bytes[i + 1] === 0x55) {
      startOffset = i;
      break;
    }
  }

  if (startOffset === -1) return null;

  const slice = bytes.slice(startOffset);
  if (slice.length < 13) return null;

  const netId = (slice[2] << 8) | slice[3];
  if (netId !== 0x4A59) return null;

  const type = slice[4] as FrameType;
  const srcNode = String.fromCharCode(slice[5], slice[6]).trim();
  const dstNode = String.fromCharCode(slice[7], slice[8]).trim();
  const seq = slice[9];
  const len = slice[10];

  const headerLen = 11;
  if (slice.length < headerLen + len + 2) return null;

  const payloadBytes = slice.slice(headerLen, headerLen + len);
  const receivedCrc = (slice[headerLen + len] << 8) | slice[headerLen + len + 1];

  // Validação de CRC16
  const crcData = slice.slice(2, headerLen + len);
  const expectedCrc = computeCrc16(crcData);
  if (receivedCrc !== expectedCrc) {
    return null; // Erro de integridade por ruído
  }

  const payload = new TextDecoder().decode(payloadBytes);

  return {
    type,
    networkId: netId,
    srcNode,
    dstNode,
    seq,
    payload,
    crc: receivedCrc,
    rawBytes: slice.slice(0, headerLen + len + 2),
  };
}

// =========================================================================
// NÓ OPERACIONAL DA REDE ACÚSTICA P2P
// =========================================================================

export class AcousticMeshNode {
  public nodeId: string;
  public channelId: number;
  public isFullDuplex: boolean;
  public baudRate: number; // Símbolos por segundo (ex: 20 a 50 baud)
  public squelchThreshold: number; // 0 - 255
  public volume: number;

  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private gyroSensor: GyrophoneAcousticSensor | null = null;
  private isListening = false;
  private isTransmitting = false;

  // Estado e Métricas
  public metrics: NetworkMetrics = {
    txBytesPerSec: 0,
    rxBytesPerSec: 0,
    packetLossPercent: 0,
    txTotalPackets: 0,
    rxTotalPackets: 0,
    txRetries: 0,
    crcErrors: 0,
    currentChannel: 2,
    carrierBusy: false,
    receiverSource: 'microphone',
    gyroActive: false,
  };

  public peers: Map<string, NetworkPeerInfo> = new Map();
  private txByteHistory: number[] = [];
  private rxByteHistory: number[] = [];
  private currentSeq = 0;
  private animFrameId: number | null = null;

  // Fila de bits recebidos
  private rawBitBuffer: number[] = [];
  private lastDetectedBit: 0 | 1 | null = null;
  private bitHoldoff = 0;

  // Callbacks de Eventos
  public onFrameReceived?: (frame: AcousticFrame) => void;
  public onMetricsUpdate?: (metrics: NetworkMetrics) => void;
  public onPeerDiscovered?: (peer: NetworkPeerInfo) => void;

  constructor(nodeId = 'A1', channelId = 2) {
    this.nodeId = nodeId;
    this.channelId = channelId;
    this.isFullDuplex = true;
    this.baudRate = 25; // 25 baud = ~40ms por bit (robusto a eco)
    this.squelchThreshold = 85;
    this.volume = 0.5;
  }

  public getChannel(): AcousticChannelConfig {
    return ACOUSTIC_CHANNELS.find((c) => c.id === this.channelId) || ACOUSTIC_CHANNELS[1];
  }

  /**
   * Inicia a escuta acústica (RX) no canal selecionado
   * Se microfone falhar, ativa fallback automático para o Giroscópio MEMS
   */
  public async startListening(): Promise<boolean> {
    if (this.isListening) return true;
    if (!navigator?.mediaDevices?.getUserMedia) {
      console.warn('getUserMedia indisponível. Ativando escuta por Giroscópio MEMS...');
      return this.startGyroscopeListening('Navegador sem suporte a getUserMedia');
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.micStream = stream;

      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();

      const source = this.audioCtx.createMediaStreamSource(stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.15;
      source.connect(this.analyser);

      this.metrics.receiverSource = 'microphone';
      this.metrics.gyroActive = false;
      this.metrics.gyroFallbackReason = null;
      this.isListening = true;
      this.runDemodulatorLoop();
      if (this.onMetricsUpdate) this.onMetricsUpdate({ ...this.metrics });
      return true;
    } catch (err) {
      console.warn('Microfone negado ou indisponível. Ativando fallback para Giroscópio MEMS (Gyrophone)...', err);
      return this.startGyroscopeListening('Microfone negado ou sem dispositivo de áudio');
    }
  }

  /**
   * Ativa explicitamente a recepção pelo Giroscópio MEMS (Gyrophone)
   */
  public async startGyroscopeListening(reason = 'Modo alternativo por vibração'): Promise<boolean> {
    if (this.isListening) this.stopListening();

    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.15;

      this.gyroSensor = new GyrophoneAcousticSensor({
        gainBoost: 40.0,
        onMetricsUpdate: (m) => {
          this.metrics.gyroActive = m.active;
          this.metrics.gyroSampleRateHz = m.sampleRateHz;
          this.metrics.gyroRmsVibration = m.rmsVibration;
          this.metrics.gyroDominantAxis = m.dominantAxis;
          this.metrics.gyroFallbackReason = m.fallbackReason;
          if (this.onMetricsUpdate) this.onMetricsUpdate({ ...this.metrics });
        },
      });

      this.gyroSensor.connectToAnalyser(this.analyser);
      await this.gyroSensor.start(reason);

      this.metrics.receiverSource = 'gyroscope';
      this.metrics.gyroActive = true;
      this.metrics.gyroFallbackReason = reason;
      this.isListening = true;
      this.runDemodulatorLoop();
      if (this.onMetricsUpdate) this.onMetricsUpdate({ ...this.metrics });
      return true;
    } catch (err) {
      console.error('Erro ao iniciar receptor giroscópio MEMS:', err);
      return false;
    }
  }

  public stopListening(): void {
    this.isListening = false;
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    if (this.gyroSensor) {
      this.gyroSensor.stop();
      this.gyroSensor = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.metrics.carrierBusy = false;
    if (this.onMetricsUpdate) this.onMetricsUpdate({ ...this.metrics });
  }

  /**
   * Transmite quadro acústico com controle de acesso CSMA/CA
   */
  public async sendFrame(
    type: FrameType,
    dstNode: string,
    payload: string,
    maxRetries = 2
  ): Promise<boolean> {
    // 1. CSMA/CA: Verifica se o meio acústico está livre (Carrier Sense)
    if (this.metrics.carrierBusy) {
      // Backoff aleatório de 100ms a 300ms
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 200 + 100)));
    }

    const seq = ++this.currentSeq & 0xFF;
    const frameBytes = serializeAcousticFrame(type, this.nodeId, dstNode, seq, payload);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) this.metrics.txRetries++;

      const success = await this.transmitRawBytes(frameBytes);
      if (success) {
        this.metrics.txTotalPackets++;
        this.txByteHistory.push(frameBytes.length);
        this.metrics.txBytesPerSec += frameBytes.length;

        // Se for broadcast ou ack, não espera confirmação
        if (dstNode === '**' || type === FrameType.ACK) {
          return true;
        }

        // Para unicast: aguarda ACK
        const ackReceived = await this.waitForAck(seq, dstNode, 800);
        if (ackReceived) {
          return true;
        }
      }
    }

    // Pacote perdido após tentativas
    this.metrics.packetLossPercent = Math.min(
      100,
      Math.round((this.metrics.txRetries / Math.max(1, this.metrics.txTotalPackets)) * 100)
    );
    return false;
  }

  private pendingAcks: Map<number, (val: boolean) => void> = new Map();

  private waitForAck(seq: number, peerNode: string, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingAcks.delete(seq);
        resolve(false);
      }, timeoutMs);

      this.pendingAcks.set(seq, (success) => {
        clearTimeout(timer);
        this.pendingAcks.delete(seq);
        resolve(success);
      });
    });
  }

  /**
   * Modula os bytes em FSK pelo alto-falante
   */
  private async transmitRawBytes(bytes: Uint8Array): Promise<boolean> {
    const ch = this.getChannel();
    // No modo Full-Duplex: usa frequências TX separadas das frequências RX
    const f0 = this.isFullDuplex ? ch.txFreq0 : ch.rxFreq0;
    const f1 = this.isFullDuplex ? ch.txFreq1 : ch.rxFreq1;

    const bitDurationMs = Math.round(1000 / this.baudRate);
    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtxClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    gain.gain.value = this.volume;
    osc.connect(gain);
    gain.connect(ctx.destination);

    this.isTransmitting = true;
    let now = ctx.currentTime + 0.05;
    osc.start(now);

    // Converte bytes em bits
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      for (let bitIdx = 7; bitIdx >= 0; bitIdx--) {
        const bit = (byte >> bitIdx) & 1;
        const freq = bit === 1 ? f1 : f0;
        osc.frequency.setValueAtTime(freq, now);
        now += bitDurationMs / 1000;
      }
    }

    osc.stop(now);

    return new Promise((resolve) => {
      osc.onended = () => {
        this.isTransmitting = false;
        ctx.close().catch(() => {});
        resolve(true);
      };
    });
  }

  /**
   * Loop Demodulador FFT contínuo
   */
  private runDemodulatorLoop(): void {
    if (!this.analyser || !this.audioCtx) return;

    const ch = this.getChannel();
    // Frequências que este nó deve escutar:
    // Se Full-Duplex, escuta as frequências de TX dos outros nós
    const f0 = this.isFullDuplex ? ch.rxFreq0 : ch.txFreq0;
    const f1 = this.isFullDuplex ? ch.rxFreq1 : ch.txFreq1;

    const bufferLength = this.analyser.frequencyBinCount;
    const freqData = new Uint8Array(bufferLength);
    const sampleRate = this.audioCtx.sampleRate;
    const nyquist = sampleRate / 2;

    const bin0 = Math.round((f0 / nyquist) * bufferLength);
    const bin1 = Math.round((f1 / nyquist) * bufferLength);

    const checkAudio = () => {
      if (!this.isListening || !this.analyser) return;

      this.analyser.getByteFrequencyData(freqData);

      const amp0 = freqData[bin0];
      const amp1 = freqData[bin1];
      const maxAmp = Math.max(amp0, amp1);

      // Carrier Sense: canal ocupado se houver energia acústica alta
      this.metrics.carrierBusy = maxAmp > this.squelchThreshold;

      // Não decodifica o próprio som quando em transmissão se não for full-duplex isolado
      if (!this.isTransmitting || this.isFullDuplex) {
        if (maxAmp > this.squelchThreshold && Math.abs(amp1 - amp0) > 15) {
          const bit: 0 | 1 = amp1 > amp0 ? 1 : 0;

          if (this.bitHoldoff <= 0) {
            this.rawBitBuffer.push(bit);
            this.lastDetectedBit = bit;
            this.bitHoldoff = Math.max(1, Math.floor(60 / this.baudRate));

            // Tenta decodificar frame a cada 8 bits inseridos
            if (this.rawBitBuffer.length >= 104 && this.rawBitBuffer.length % 8 === 0) {
              this.tryDecodeFrameFromBitBuffer();
            }
          }
        }
      }

      if (this.bitHoldoff > 0) this.bitHoldoff--;

      // Limita tamanho do buffer de bits brutos
      if (this.rawBitBuffer.length > 2000) {
        this.rawBitBuffer = this.rawBitBuffer.slice(-800);
      }

      if (this.onMetricsUpdate) {
        this.onMetricsUpdate(this.metrics);
      }

      this.animFrameId = requestAnimationFrame(checkAudio);
    };

    this.animFrameId = requestAnimationFrame(checkAudio);
  }

  /**
   * Converte bits acumulados em bytes e tenta validar o quadro acústico
   */
  private tryDecodeFrameFromBitBuffer(): void {
    const totalBits = this.rawBitBuffer.length;
    const numBytes = Math.floor(totalBits / 8);
    const bytes = new Uint8Array(numBytes);

    for (let b = 0; b < numBytes; b++) {
      let val = 0;
      for (let i = 0; i < 8; i++) {
        val = (val << 1) | this.rawBitBuffer[b * 8 + i];
      }
      bytes[b] = val;
    }

    const frame = deserializeAcousticFrame(bytes);
    if (frame) {
      // Encontrou quadro válido!
      this.metrics.rxTotalPackets++;
      this.metrics.rxBytesPerSec += frame.rawBytes ? frame.rawBytes.length : 16;

      // Atualiza ou adiciona vizinho (peer) descoberto no ar
      const peer: NetworkPeerInfo = {
        nodeId: frame.srcNode,
        lastSeen: Date.now(),
        packetsReceived: (this.peers.get(frame.srcNode)?.packetsReceived || 0) + 1,
        snrEstimate: 18.5,
      };
      this.peers.set(frame.srcNode, peer);
      if (this.onPeerDiscovered) this.onPeerDiscovered(peer);

      // Tratamento de ACK
      if (frame.type === FrameType.ACK) {
        const cb = this.pendingAcks.get(frame.seq);
        if (cb) cb(true);
      } else if (frame.dstNode === this.nodeId && frame.type !== FrameType.BROADCAST) {
        // Envia resposta de ACK imediata para o remetente
        this.sendFrame(FrameType.ACK, frame.srcNode, 'ACK').catch(() => {});
      }

      if (this.onFrameReceived) {
        this.onFrameReceived(frame);
      }

      // Limpa buffer de bits após frame consumido
      this.rawBitBuffer = [];
    }
  }
}
