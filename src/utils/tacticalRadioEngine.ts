/**
 * JYY Sovereign Mesh & DataLink Pro - Motor de Rádio Tático Universal (UHF, VHF, HF, FM, AM)
 * 
 * Orquestrador de Comunicação e Controle de Rádio Frequência:
 * - Suporte a Bandas: UHF (300-3000 MHz), VHF (30-300 MHz), HF (3-30 MHz), FM Comercial (87.5-108 MHz), AM Aviação/PX
 * - Modulações: NBFM, WFM, AM, USB, LSB, CW (Morse), AFSK1200 (Bell 202), GFSK, LoRa, DMR Digital
 * - Automação e PTT: Controle por VOX acústico, WebSerial CAT Control (RTS/DTR), tons CTCSS/DCS e sequenciador
 * - Chat de Pacotes RF e Transferência de Arquivos Fragmentados com verificação CRC32 e ARQ seletivo
 * - Portadora Mutável, Direcionável e Escalável como camada física (PHY bearer) da malha descentralizada
 */

export interface RadioBandPreset {
  id: string;
  name: string;
  band: 'UHF' | 'VHF' | 'HF' | 'FM_BROADCAST';
  frequencyHz: number;
  mode: 'NBFM' | 'WFM' | 'AM' | 'USB' | 'LSB' | 'CW' | 'AFSK1200' | 'GFSK' | 'LoRa' | 'DMR';
  channelSpacingKhz: number;
  powerWatts: number;
  description: string;
  ctcssDefault?: number;
  stepHz: number;
}

export const RADIO_PRESETS: RadioBandPreset[] = [
  {
    id: 'uhf-70cm-calling',
    name: 'UHF 70cm Chamada Geral (433.500 MHz)',
    band: 'UHF',
    frequencyHz: 433500000,
    mode: 'NBFM',
    channelSpacingKhz: 25,
    powerWatts: 5,
    description: 'Frequência de chamada tática na banda amadora de 70cm. Excelente penetração urbana e comunicação local.',
    stepHz: 12500,
  },
  {
    id: 'uhf-pmr446-ch1',
    name: 'UHF PMR446 Canal 1 (446.00625 MHz)',
    band: 'UHF',
    frequencyHz: 446006250,
    mode: 'NBFM',
    channelSpacingKhz: 12.5,
    powerWatts: 0.5,
    description: 'Banda livre europeia/internacional PMR446. Compatível com walkie-talkies comerciais e rádios de mão.',
    stepHz: 6250,
  },
  {
    id: 'uhf-frs-gmrs-ch1',
    name: 'UHF FRS/GMRS Canal 1 (462.5625 MHz)',
    band: 'UHF',
    frequencyHz: 462562500,
    mode: 'NBFM',
    channelSpacingKhz: 25,
    powerWatts: 2,
    description: 'Banda livre americana de uso comum em walkie-talkies (Cobra, Motorola, Baofeng).',
    stepHz: 12500,
  },
  {
    id: 'vhf-2m-calling',
    name: 'VHF 2m Chamada Geral (146.520 MHz)',
    band: 'VHF',
    frequencyHz: 146520000,
    mode: 'NBFM',
    channelSpacingKhz: 20,
    powerWatts: 50,
    description: 'Frequência nacional de chamada direta (Simplex) em 2 metros. Grande alcance em campo aberto e colinas.',
    stepHz: 5000,
  },
  {
    id: 'vhf-aprs-packet',
    name: 'VHF APRS Packet Radio (144.390 MHz)',
    band: 'VHF',
    frequencyHz: 144390000,
    mode: 'AFSK1200',
    channelSpacingKhz: 25,
    powerWatts: 10,
    description: 'Padrão mundial de troca de pacotes táticos, coordenadas GPS e mensagens descentralizadas AX.25.',
    stepHz: 5000,
  },
  {
    id: 'vhf-marine-ch16',
    name: 'VHF Marítimo Canal 16 Socorro (156.800 MHz)',
    band: 'VHF',
    frequencyHz: 156800000,
    mode: 'NBFM',
    channelSpacingKhz: 25,
    powerWatts: 25,
    description: 'Canal internacional de chamada de emergência e segurança marítima. Escuta passiva prioritária.',
    stepHz: 25000,
  },
  {
    id: 'vhf-aviation-emergency',
    name: 'VHF Aviação Emergência AM (121.500 MHz)',
    band: 'VHF',
    frequencyHz: 121500000,
    mode: 'AM',
    channelSpacingKhz: 25,
    powerWatts: 10,
    description: 'Frequência de emergência aeronáutica internacional em modulação AM analógica pura.',
    stepHz: 25000,
  },
  {
    id: 'hf-40m-nvis',
    name: 'HF 40m Emergência Regional NVIS (7.100 MHz)',
    band: 'HF',
    frequencyHz: 7100000,
    mode: 'LSB',
    channelSpacingKhz: 3,
    powerWatts: 100,
    description: 'Propagação NVIS ionosférica para comunicação sem zona de silêncio em raio de até 500 km em áreas montanhosas.',
    stepHz: 1000,
  },
  {
    id: 'hf-11m-px-ch19',
    name: 'HF 11m PX Estrada Canal 19 (27.185 MHz)',
    band: 'HF',
    frequencyHz: 27185000,
    mode: 'AM',
    channelSpacingKhz: 10,
    powerWatts: 4,
    description: 'Faixa do Cidadão (PX) canal dos caminhoneiros e postos rodoviários. AM/USB com grande difusão popular.',
    stepHz: 10000,
  },
  {
    id: 'fm-broadcast-data',
    name: 'FM Comercial Broadcast Data (102.5 MHz)',
    band: 'FM_BROADCAST',
    frequencyHz: 102500000,
    mode: 'WFM',
    channelSpacingKhz: 200,
    powerWatts: 1000,
    description: 'Radiodifusão FM de banda larga com subportadora RDS para envio de boletins informativos em massa.',
    stepHz: 100000,
  },
];

// Tabela de 50 Sub-tons CTCSS Padrão (Hz)
export const CTCSS_TONES: number[] = [
  67.0, 69.3, 71.9, 74.4, 77.0, 79.7, 82.5, 85.4, 88.5, 91.5,
  94.8, 97.4, 100.0, 103.5, 107.2, 110.9, 114.8, 118.8, 123.0, 127.3,
  131.8, 136.5, 141.3, 146.2, 151.4, 156.7, 162.2, 167.9, 173.8, 179.9,
  186.2, 192.8, 199.5, 203.5, 206.5, 210.7, 218.1, 225.7, 229.1, 233.6,
  241.8, 250.3, 254.1,
];

export interface RadioChatMessage {
  id: string;
  senderCallsign: string;
  recipientCallsign: string; // 'CQ' para broadcast geral ou indicativo específico
  text: string;
  frequencyHz: number;
  modulation: string;
  timestamp: number;
  snrDb?: number;
  isConfirmedAck?: boolean;
  hopCount: number;
}

export interface RadioFileChunk {
  fileId: string;
  fileName: string;
  fileSizeBytes: number;
  totalChunks: number;
  chunkIndex: number;
  payloadBase64: string;
  crc32: number;
}

export interface TacticalRadioStatus {
  vfoFreqHz: number;
  vfoSubFreqHz: number;
  activeVfo: 'A' | 'B';
  mode: RadioBandPreset['mode'];
  powerWatts: number;
  squelchLevel: number; // 0 (aberto) a 10 (fechado)
  ctcssToneHz: number | null; // null = sem subtom
  isTransmitting: boolean; // PTT Ativo (TX)
  isReceiving: boolean; // Canal ocupado (RX)
  smeterValue: number; // S1 a S9 (+30dB)
  reverseRepeater: boolean;
  duplexOffsetHz: number; // Ex: -600 kHz para repetidora VHF
  channelBusy: boolean;
  voxEnabled: boolean;
  beaconIntervalMinutes: number;
  isDigipeaterActive: boolean;
  callsign: string;
}

export const DEFAULT_RADIO_STATUS: TacticalRadioStatus = {
  vfoFreqHz: 146520000,
  vfoSubFreqHz: 433500000,
  activeVfo: 'A',
  mode: 'NBFM',
  powerWatts: 5,
  squelchLevel: 3,
  ctcssToneHz: null,
  isTransmitting: false,
  isReceiving: false,
  smeterValue: 5,
  reverseRepeater: false,
  duplexOffsetHz: 0,
  channelBusy: false,
  voxEnabled: true,
  beaconIntervalMinutes: 10,
  isDigipeaterActive: true,
  callsign: 'JYY-NODE-01',
};

/**
 * Cálculo simples e ultra-rápido de Checksum CRC32 para integridade de pacotes de rádio
 */
export function calculateRadioCrc32(data: string): number {
  let crc = 0 ^ -1;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ data.charCodeAt(i)) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const CRC32_TABLE: number[] = (() => {
  let c: number;
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

/**
 * Transmissor Acústico AFSK / Tom PTT de Rádio (Web Audio API)
 * Gera o áudio modulado na saída da placa de som para alimentar a entrada de microfone do rádio
 */
export class RadioAudioTransceiver {
  private audioCtx: AudioContext | null = null;
  private isTxActive: boolean = false;

  public init() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
  }

  /**
   * Toca Tom de Acionamento PTT e Transmissão de Pacote AFSK Bell 202
   * (Mark: 1200 Hz, Space: 2200 Hz + Preâmbulo de sincronismo)
   */
  public async transmitPacketAudio(
    packetPayload: string,
    subtoneHz: number | null = null,
    onFinish?: () => void
  ): Promise<boolean> {
    this.init();
    if (!this.audioCtx) return false;

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    this.isTxActive = true;
    const ctx = this.audioCtx;

    // 1. Duração do preâmbulo (Lead-in para abrir o VOX do rádio) = 250ms
    const leadInTime = 0.25;
    const bitDuration = 1 / 1200; // 1200 bps AFSK
    const bits: number[] = [];

    // Preâmbulo de sincronismo (Flags 0x7E repetidas: 01111110)
    for (let f = 0; f < 10; f++) {
      bits.push(0, 1, 1, 1, 1, 1, 1, 0);
    }

    // Converter string do pacote em bits
    for (let i = 0; i < packetPayload.length; i++) {
      const byte = packetPayload.charCodeAt(i);
      for (let b = 0; b < 8; b++) {
        bits.push((byte >> b) & 1);
      }
    }

    // Flag final 0x7E
    bits.push(0, 1, 1, 1, 1, 1, 1, 0);

    const totalDuration = leadInTime + bits.length * bitDuration + 0.1;
    const sampleRate = ctx.sampleRate;
    const totalSamples = Math.ceil(totalDuration * sampleRate);
    const audioBuffer = ctx.createBuffer(1, totalSamples, sampleRate);
    const channelData = audioBuffer.getChannelData(0);

    // Preencher buffer com o sinal modulado AFSK
    let currentPhase = 0;
    let subTonePhase = 0;

    for (let s = 0; s < totalSamples; s++) {
      const t = s / sampleRate;
      let freq = 1200; // Tom padrão

      if (t >= leadInTime && t < leadInTime + bits.length * bitDuration) {
        const bitIdx = Math.floor((t - leadInTime) / bitDuration);
        const bitVal = bits[bitIdx] || 0;
        freq = bitVal === 1 ? 1200 : 2200; // Mark 1200 Hz / Space 2200 Hz
      }

      currentPhase += (2 * Math.PI * freq) / sampleRate;
      let sampleVal = Math.sin(currentPhase) * 0.75;

      // Adicionar sub-tom CTCSS se configurado (baixa frequência inaudível 67-254 Hz)
      if (subtoneHz) {
        subTonePhase += (2 * Math.PI * subtoneHz) / sampleRate;
        sampleVal += Math.sin(subTonePhase) * 0.15;
      }

      channelData[s] = Math.max(-1, Math.min(1, sampleVal));
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    return new Promise((resolve) => {
      source.onended = () => {
        this.isTxActive = false;
        if (onFinish) onFinish();
        resolve(true);
      };
      source.start();
    });
  }

  public stop() {
    this.isTxActive = false;
  }

  public isTransmitting(): boolean {
    return this.isTxActive;
  }
}
