/**
 * Modem de Áudio Multifrequência (FSK, Bell 202, Ultrassônico, Morse CW e DTMF)
 * Transmissão acústica ponto-a-ponto via Web Audio API
 */

export const FREQ_BIT_0 = 800;
export const FREQ_BIT_1 = 1200;
export const FREQ_START = 1500;

export interface AudioModemProfile {
  id: 'standard' | 'bell202' | 'ultrasonic';
  name: string;
  description: string;
  bit0Freq: number;
  bit1Freq: number;
  startFreq: number;
  range0: [number, number];
  range1: [number, number];
}

export const AUDIO_MODEM_PROFILES: Record<string, AudioModemProfile> = {
  standard: {
    id: 'standard',
    name: 'FSK Padrão Audível',
    description: '800Hz / 1200Hz — Alta compatibilidade e alcance em qualquer alto-falante',
    bit0Freq: 800,
    bit1Freq: 1200,
    startFreq: 1500,
    range0: [740, 860],
    range1: [1140, 1260],
  },
  bell202: {
    id: 'bell202',
    name: 'Bell 202 Telecom',
    description: '1200Hz / 2200Hz — Padrão histórico de rádio modems e AFSK',
    bit0Freq: 2200,
    bit1Freq: 1200,
    startFreq: 1700,
    range0: [2100, 2300],
    range1: [1100, 1300],
  },
  ultrasonic: {
    id: 'ultrasonic',
    name: 'Quase-Ultrassônico Discreto',
    description: '18000Hz / 19000Hz — Transmissão imperceptível ao ouvido humano',
    bit0Freq: 18000,
    bit1Freq: 19000,
    startFreq: 17500,
    range0: [17800, 18300],
    range1: [18800, 19300],
  },
};

// Dicionário Internacional de Código Morse
export const MORSE_TABLE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.',
  G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..',
  M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.',
  S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
  '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', '!': '-.-.--',
  '/': '-..-.', '@': '.--.-.', ' ': ' ',
};

export const REVERSE_MORSE_TABLE: Record<string, string> = Object.entries(MORSE_TABLE).reduce(
  (acc, [char, code]) => {
    if (code !== ' ') acc[code] = char;
    return acc;
  },
  {} as Record<string, string>
);

// Frequências padrão DTMF (Dual-Tone Multi-Frequency)
export const DTMF_FREQS: Record<string, [number, number]> = {
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1477], 'A': [697, 1633],
  '4': [770, 1209], '5': [770, 1336], '6': [770, 1477], 'B': [770, 1633],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1477], 'C': [852, 1633],
  '*': [941, 1209], '0': [941, 1336], '#': [941, 1477], 'D': [941, 1633],
};

export interface TransmitOptions {
  baudRate?: number;
  profileId?: 'standard' | 'bell202' | 'ultrasonic';
  volume?: number; // 0.0 a 1.0
  waveType?: OscillatorType;
  onProgress?: (current: number, total: number) => void;
}

export class AudioModemTransmitter {
  private ctx: AudioContext | null = null;
  private isTransmitting = false;
  private calibOsc: OscillatorNode | null = null;
  private calibGain: GainNode | null = null;

  async transmit(
    text: string,
    options: TransmitOptions = {}
  ): Promise<void> {
    if (this.isTransmitting) return;
    this.isTransmitting = true;

    const {
      baudRate = 20,
      profileId = 'standard',
      volume = 0.25,
      waveType = 'sine',
      onProgress,
    } = options;

    const profile = AUDIO_MODEM_PROFILES[profileId] || AUDIO_MODEM_PROFILES.standard;

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    const bitDuration = 1 / Math.max(5, Math.min(60, baudRate)); // segundos por bit
    const bytes = new TextEncoder().encode(text);
    const bits: number[] = [];

    // Preâmbulo de sincronização e identificação
    for (let i = 0; i < 4; i++) bits.push(1, 0);

    // Bits de dados com start (0) e stop (1) bits por byte (UART 8N1)
    for (const byte of bytes) {
      bits.push(0); // start bit
      for (let b = 0; b < 8; b++) {
        bits.push((byte >> b) & 1);
      }
      bits.push(1); // stop bit
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = waveType;
    gain.gain.setValueAtTime(Math.max(0.01, Math.min(1.0, volume)), this.ctx.currentTime);
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    let t = this.ctx.currentTime + 0.05;
    osc.start(t);

    // Tom inicial de aviso/sincronismo
    osc.frequency.setValueAtTime(profile.startFreq, t);
    t += 0.2;

    for (let i = 0; i < bits.length; i++) {
      if (!this.isTransmitting) break;
      const freq = bits[i] === 1 ? profile.bit1Freq : profile.bit0Freq;
      osc.frequency.setValueAtTime(freq, t);
      t += bitDuration;
      if (onProgress) onProgress(i + 1, bits.length);
    }

    // Tom final
    osc.frequency.setValueAtTime(profile.startFreq, t);
    t += 0.1;
    gain.gain.setValueAtTime(0, t);
    osc.stop(t);

    await new Promise((resolve) => setTimeout(resolve, (t - this.ctx!.currentTime) * 1000 + 100));
    this.isTransmitting = false;
    await this.ctx.close();
    this.ctx = null;
  }

  // Transmissão em Código Morse Acústico (CW)
  async transmitMorse(
    text: string,
    wpm = 15,
    freq = 800,
    volume = 0.25,
    onProgress?: (charIndex: number, totalChars: number) => void
  ): Promise<void> {
    if (this.isTransmitting) return;
    this.isTransmitting = true;

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    // Duração do "dit" baseada em WPM (Paris formula: 1200 / wpm em ms)
    const dotDuration = 1.2 / Math.max(5, Math.min(40, wpm)); // em segundos
    const dashDuration = dotDuration * 3;
    const interElementGap = dotDuration;
    const interCharGap = dotDuration * 3;
    const wordGap = dotDuration * 7;

    const upper = text.toUpperCase();
    let t = this.ctx.currentTime + 0.05;

    for (let c = 0; c < upper.length; c++) {
      if (!this.isTransmitting) break;
      const char = upper[c];
      const morse = MORSE_TABLE[char];

      if (onProgress) onProgress(c + 1, upper.length);

      if (!morse || char === ' ') {
        t += wordGap;
        continue;
      }

      for (let i = 0; i < morse.length; i++) {
        if (!this.isTransmitting) break;
        const symbol = morse[i];
        const dur = symbol === '-' ? dashDuration : dotDuration;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(volume, t + 0.005);
        gain.gain.setValueAtTime(volume, t + dur - 0.005);
        gain.gain.linearRampToValueAtTime(0, t + dur);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + dur);

        t += dur + interElementGap;
      }

      t += interCharGap;
    }

    await new Promise((resolve) => setTimeout(resolve, (t - this.ctx!.currentTime) * 1000 + 100));
    this.isTransmitting = false;
    await this.ctx.close();
    this.ctx = null;
  }

  // Transmissão de Tons DTMF Telefônicos
  async transmitDtmf(
    digits: string,
    digitDuration = 0.15,
    volume = 0.25,
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    if (this.isTransmitting) return;
    this.isTransmitting = true;

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    const clean = digits.toUpperCase().replace(/[^0-9A-D*#]/g, '');
    let t = this.ctx.currentTime + 0.05;

    for (let i = 0; i < clean.length; i++) {
      if (!this.isTransmitting) break;
      const char = clean[i];
      const freqs = DTMF_FREQS[char];
      if (!freqs) continue;

      if (onProgress) onProgress(i + 1, clean.length);

      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      const gain2 = this.ctx.createGain();

      osc1.frequency.setValueAtTime(freqs[0], t);
      osc2.frequency.setValueAtTime(freqs[1], t);

      gain1.gain.setValueAtTime(volume / 2, t);
      gain2.gain.setValueAtTime(volume / 2, t);

      osc1.connect(gain1);
      osc2.connect(gain2);
      gain1.connect(this.ctx.destination);
      gain2.connect(this.ctx.destination);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + digitDuration);
      osc2.stop(t + digitDuration);

      t += digitDuration + 0.08;
    }

    await new Promise((resolve) => setTimeout(resolve, (t - this.ctx!.currentTime) * 1000 + 100));
    this.isTransmitting = false;
    await this.ctx.close();
    this.ctx = null;
  }

  // Tom Contínuo de Calibração Espectral
  startCalibrationTone(freq = 1000, volume = 0.2, waveType: OscillatorType = 'sine'): void {
    this.stopCalibrationTone();
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = waveType;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();

    this.calibOsc = osc;
    this.calibGain = gain;
  }

  setCalibrationFrequency(freq: number): void {
    if (this.calibOsc && this.ctx) {
      this.calibOsc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    }
  }

  stopCalibrationTone(): void {
    if (this.calibOsc) {
      try {
        this.calibOsc.stop();
        this.calibOsc.disconnect();
      } catch {}
      this.calibOsc = null;
    }
    if (this.calibGain) {
      try { this.calibGain.disconnect(); } catch {}
      this.calibGain = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }

  stop(): void {
    this.isTransmitting = false;
    this.stopCalibrationTone();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }

  get active(): boolean {
    return this.isTransmitting;
  }
}
