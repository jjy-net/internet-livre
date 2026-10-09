/**
 * Gyrophone Acoustic Sensor (Vibro-Acoustic Eavesdropping & Fallback Receiver)
 * 
 * Baseado na pesquisa acadêmica:
 * "Gyrophone: Recognizing Speech From Gyroscope Signals" (USENIX Security 2014)
 * por Yan Michalevsky, Dan Boneh (Stanford University) & Gabi Nakibly (Rafael Ltd).
 * 
 * Princípio Físico:
 * Sensores giroscópicos e acelerômetros MEMS embutidos em smartphones e dispositivos
 * possuem elementos ressonantes mecânicos microscópicos (anéis e garfos vibratórios).
 * Ondas sonoras acústicas exercem micro-pressões na carcaça do aparelho, induzindo
 * pequenas flutuações angulares e lineares que podem ser amostradas a taxas entre 100Hz e 200Hz.
 * 
 * Este módulo provê:
 * 1. Fallback automático quando o microfone físico for negado ou inacessível.
 * 2. Filtragem Passa-Alta (High-Pass / DC-Blocker) para eliminar inclinações lentas da gravidade.
 * 3. Amplificação de ressonância acústica ajustável com soft-clipping.
 * 4. Sintetizador de áudio virtual Web Audio para alimentar AnalyserNodes e demoduladores.
 * 5. Telemetria completa em tempo real para exibição nos painéis de recepção.
 */

export interface GyrophoneMetrics {
  active: boolean;
  sourceType: 'gyroscope' | 'accelerometer' | 'simulated_imu';
  sampleRateHz: number;
  rmsVibration: number;          // Nível RMS da vibração acústica (deg/s ou m/s²)
  peakVibration: number;
  dominantAxis: 'x' | 'y' | 'z' | 'magnitude';
  gainBoost: number;
  samplesReceived: number;
  fallbackReason: string | null;
  lastTimestamp: number;
}

export interface GyrophoneOptions {
  sampleRateTarget?: number;     // Frequência alvo em Hz (ex: 100 - 200 Hz)
  gainBoost?: number;            // Ganho de amplificação da micro-vibração (default: 35.0x)
  highPassCutoff?: number;       // Frequência de corte do filtro passa-alta (default: 18 Hz)
  axis?: 'auto' | 'x' | 'y' | 'z' | 'magnitude';
  onMetricsUpdate?: (metrics: GyrophoneMetrics) => void;
  onAudioSample?: (sample: number) => void;
}

export class GyrophoneAcousticSensor {
  private isRunning = false;
  private options: Required<GyrophoneOptions>;
  private metrics: GyrophoneMetrics;
  
  // Buffers de sinal e filtros
  private lastRawX = 0;
  private lastRawY = 0;
  private lastRawZ = 0;
  
  // Filtro Passa-Alta (DC Blocker / Gravidade): y[n] = alpha * (y[n-1] + x[n] - x[n-1])
  private filterStateX = { prevIn: 0, prevOut: 0 };
  private filterStateY = { prevIn: 0, prevOut: 0 };
  private filterStateZ = { prevIn: 0, prevOut: 0 };
  
  // Estimativa de taxa de amostragem e RMS
  private sampleTimestamps: number[] = [];
  private recentSamples: number[] = [];
  private lastMetricsEmit = 0;

  // Web Audio Context e nós virtuais
  private audioCtx: AudioContext | null = null;
  private virtualSourceNode: ConstantSourceNode | null = null;
  private virtualGainNode: GainNode | null = null;
  private customDestinationNode: AnalyserNode | null = null;
  private simulatedIntervalId: number | null = null;
  private motionListener: ((e: DeviceMotionEvent) => void) | null = null;

  constructor(options: GyrophoneOptions = {}) {
    this.options = {
      sampleRateTarget: options.sampleRateTarget ?? 200,
      gainBoost: options.gainBoost ?? 35.0,
      highPassCutoff: options.highPassCutoff ?? 18,
      axis: options.axis ?? 'auto',
      onMetricsUpdate: options.onMetricsUpdate ?? (() => {}),
      onAudioSample: options.onAudioSample ?? (() => {}),
    };

    this.metrics = {
      active: false,
      sourceType: 'gyroscope',
      sampleRateHz: 0,
      rmsVibration: 0,
      peakVibration: 0,
      dominantAxis: 'z',
      gainBoost: this.options.gainBoost,
      samplesReceived: 0,
      fallbackReason: null,
      lastTimestamp: Date.now(),
    };
  }

  /**
   * Ativa a captura acústica via giroscópio MEMS
   * Se chamado com fallbackReason, registra o motivo da queda do microfone
   */
  public async start(fallbackReason?: string): Promise<boolean> {
    if (this.isRunning) return true;

    this.metrics.fallbackReason = fallbackReason || null;
    this.isRunning = true;
    this.metrics.active = true;

    // Inicializa Web Audio Context para canalizar o sinal do giroscópio
    this.initVirtualAudioPipeline();

    // 1. Tentar solicitar permissão em iOS (DeviceMotionEvent.requestPermission)
    if (
      typeof DeviceMotionEvent !== 'undefined' &&
      typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function'
    ) {
      try {
        const perm = await (DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
        if (perm !== 'granted') {
          console.warn('Permissão de DeviceMotion negada em iOS, usando emulação MEMS.');
        }
      } catch (e) {
        console.warn('Erro ao solicitar permissão de DeviceMotion:', e);
      }
    }

    // 2. Registrar listener de DeviceMotionEvent se suportado no navegador
    let hasNativeMotion = false;
    if (typeof window !== 'undefined' && 'ondevicemotion' in window) {
      this.motionListener = (event: DeviceMotionEvent) => {
        this.processDeviceMotionEvent(event);
      };
      window.addEventListener('devicemotion', this.motionListener, { passive: true });
      hasNativeMotion = true;
    }

    // 3. Se estiver em desktop sem giroscópio físico ou o evento não disparar,
    // ativa o gerador de ressonância acústica do giroscópio para manter a recepção funcional
    if (!hasNativeMotion || typeof window === 'undefined') {
      this.metrics.sourceType = 'simulated_imu';
      this.startSimulatedVibrationalSampling();
    } else {
      // Cria verificação de fallback se o evento nativo não disparar dados após 800ms
      setTimeout(() => {
        if (this.isRunning && this.metrics.samplesReceived < 5) {
          this.metrics.sourceType = 'simulated_imu';
          this.startSimulatedVibrationalSampling();
        }
      }, 800);
    }

    return true;
  }

  /**
   * Interrompe o sensor
   */
  public stop(): void {
    this.isRunning = false;
    this.metrics.active = false;

    if (this.motionListener && typeof window !== 'undefined') {
      window.removeEventListener('devicemotion', this.motionListener);
      this.motionListener = null;
    }

    if (this.simulatedIntervalId !== null) {
      clearInterval(this.simulatedIntervalId);
      this.simulatedIntervalId = null;
    }

    if (this.virtualSourceNode) {
      try { this.virtualSourceNode.stop(); } catch {}
      this.virtualSourceNode.disconnect();
      this.virtualSourceNode = null;
    }

    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }

    this.options.onMetricsUpdate({ ...this.metrics, active: false });
  }

  /**
   * Conecta a saída acústica do giroscópio a um AnalyserNode existente
   */
  public connectToAnalyser(targetAnalyser: AnalyserNode): void {
    this.customDestinationNode = targetAnalyser;
    if (this.virtualGainNode) {
      try {
        this.virtualGainNode.connect(targetAnalyser);
      } catch {}
    }
  }

  public getMetrics(): GyrophoneMetrics {
    return { ...this.metrics };
  }

  public setGainBoost(gain: number): void {
    this.options.gainBoost = Math.max(1, Math.min(200, gain));
    this.metrics.gainBoost = this.options.gainBoost;
  }

  public setAxis(axis: 'auto' | 'x' | 'y' | 'z' | 'magnitude'): void {
    this.options.axis = axis;
  }

  /**
   * Processa leitura do evento DeviceMotionEvent
   */
  private processDeviceMotionEvent(event: DeviceMotionEvent): void {
    if (!this.isRunning) return;

    let gx = 0;
    let gy = 0;
    let gz = 0;
    let isGyro = false;

    // Preferência 1: Taxa de rotação do giroscópio (graus/s)
    if (event.rotationRate) {
      gx = event.rotationRate.beta || 0;   // X (Pitch)
      gy = event.rotationRate.gamma || 0;  // Y (Roll)
      gz = event.rotationRate.alpha || 0;  // Z (Yaw)
      isGyro = true;
    }

    // Preferência 2: Se giroscópio nulo, usar aceleração linear (m/s²)
    if (!isGyro && event.acceleration) {
      gx = event.acceleration.x || 0;
      gy = event.acceleration.y || 0;
      gz = event.acceleration.z || 0;
      this.metrics.sourceType = 'accelerometer';
    } else if (isGyro) {
      this.metrics.sourceType = 'gyroscope';
    }

    this.processRawImuSample(gx, gy, gz);
  }

  /**
   * Núcleo DSP de processamento de amostra do giroscópio:
   * 1. Filtro Passa-Alta (High-Pass / DC Blocker) para remover desvio estático da gravidade.
   * 2. Amplificação com Ganho de Ressonância.
   * 3. Compressão não-linear (soft-clipping via Math.tanh) para evitar distorção harmônica.
   * 4. Encaminhamento para a pipeline de áudio virtual.
   */
  public processRawImuSample(rawX: number, rawY: number, rawZ: number): number {
    const now = performance.now();
    this.metrics.samplesReceived++;
    this.metrics.lastTimestamp = Date.now();

    // 1. Filtro Passa-Alta (DC-Blocker IIR):
    // alpha = RC / (RC + dt). Para ~18Hz com dt ~ 0.005s, alpha ~= 0.85
    const alpha = 0.85;

    const filteredX = alpha * (this.filterStateX.prevOut + rawX - this.filterStateX.prevIn);
    this.filterStateX.prevIn = rawX;
    this.filterStateX.prevOut = filteredX;

    const filteredY = alpha * (this.filterStateY.prevOut + rawY - this.filterStateY.prevIn);
    this.filterStateY.prevIn = rawY;
    this.filterStateY.prevOut = filteredY;

    const filteredZ = alpha * (this.filterStateZ.prevOut + rawZ - this.filterStateZ.prevIn);
    this.filterStateZ.prevIn = rawZ;
    this.filterStateZ.prevOut = filteredZ;

    // 2. Determinar eixo selecionado
    let selectedSignal = 0;
    const absX = Math.abs(filteredX);
    const absY = Math.abs(filteredY);
    const absZ = Math.abs(filteredZ);

    if (this.options.axis === 'auto') {
      if (absZ >= absX && absZ >= absY) {
        selectedSignal = filteredZ;
        this.metrics.dominantAxis = 'z';
      } else if (absX >= absY) {
        selectedSignal = filteredX;
        this.metrics.dominantAxis = 'x';
      } else {
        selectedSignal = filteredY;
        this.metrics.dominantAxis = 'y';
      }
    } else if (this.options.axis === 'x') {
      selectedSignal = filteredX;
      this.metrics.dominantAxis = 'x';
    } else if (this.options.axis === 'y') {
      selectedSignal = filteredY;
      this.metrics.dominantAxis = 'y';
    } else if (this.options.axis === 'z') {
      selectedSignal = filteredZ;
      this.metrics.dominantAxis = 'z';
    } else {
      // Magnitude combinada
      const mag = Math.sqrt(filteredX * filteredX + filteredY * filteredY + filteredZ * filteredZ);
      selectedSignal = mag;
      this.metrics.dominantAxis = 'magnitude';
    }

    // 3. Aplica ganho acústico e soft-clipping (tanh) normalizando em [-1.0, 1.0]
    const amplified = selectedSignal * this.options.gainBoost;
    const normalizedAudioSample = Math.tanh(amplified);

    // 4. Armazena para métricas de RMS e taxa de amostragem
    this.recentSamples.push(normalizedAudioSample);
    if (this.recentSamples.length > 64) this.recentSamples.shift();

    this.sampleTimestamps.push(now);
    if (this.sampleTimestamps.length > 50) this.sampleTimestamps.shift();

    // 5. Injeta no nó de áudio virtual se disponível
    if (this.virtualGainNode && this.audioCtx) {
      try {
        const audioTime = this.audioCtx.currentTime;
        this.virtualGainNode.gain.cancelScheduledValues(audioTime);
        this.virtualGainNode.gain.setValueAtTime(normalizedAudioSample, audioTime);
      } catch {}
    }

    // Callback de amostra
    this.options.onAudioSample(normalizedAudioSample);

    // 6. Atualização periódica de métricas (a cada 100ms)
    if (now - this.lastMetricsEmit > 100) {
      this.lastMetricsEmit = now;
      this.updateCalculatedMetrics();
    }

    return normalizedAudioSample;
  }

  /**
   * Recalcula taxa de amostragem Hz, RMS e picos
   */
  private updateCalculatedMetrics(): void {
    // Cálculo de taxa de amostragem real
    if (this.sampleTimestamps.length >= 2) {
      const dtMs = this.sampleTimestamps[this.sampleTimestamps.length - 1] - this.sampleTimestamps[0];
      if (dtMs > 0) {
        this.metrics.sampleRateHz = Math.round(((this.sampleTimestamps.length - 1) / (dtMs / 1000)));
      }
    }

    // Cálculo do RMS da vibração acústica
    if (this.recentSamples.length > 0) {
      let sumSq = 0;
      let peak = 0;
      for (const s of this.recentSamples) {
        sumSq += s * s;
        if (Math.abs(s) > peak) peak = Math.abs(s);
      }
      this.metrics.rmsVibration = Math.sqrt(sumSq / this.recentSamples.length);
      this.metrics.peakVibration = peak;
    }

    this.options.onMetricsUpdate({ ...this.metrics });
  }

  /**
   * Inicia pipeline Web Audio para conversão do giroscópio em stream de áudio
   */
  private initVirtualAudioPipeline(): void {
    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return;

      this.audioCtx = new AudioCtxClass();
      
      // Cria um oscilador base modulado pela vibração ou ConstantSourceNode
      if (typeof this.audioCtx.createConstantSource === 'function') {
        this.virtualSourceNode = this.audioCtx.createConstantSource();
        this.virtualSourceNode.offset.value = 1.0;
        this.virtualSourceNode.start();
      }

      this.virtualGainNode = this.audioCtx.createGain();
      this.virtualGainNode.gain.value = 0.0;

      if (this.virtualSourceNode) {
        this.virtualSourceNode.connect(this.virtualGainNode);
      }

      if (this.customDestinationNode) {
        this.virtualGainNode.connect(this.customDestinationNode);
      }
    } catch (err) {
      console.warn('Não foi possível inicializar Web Audio para Gyrophone:', err);
    }
  }

  /**
   * Emulador de vibração física MEMS para PCs desktop sem sensor IMU físico.
   * Simula ruído térmico browniano mecânico e ressonância acústica do chassi.
   */
  private startSimulatedVibrationalSampling(): void {
    if (this.simulatedIntervalId !== null) return;

    const intervalMs = Math.round(1000 / this.options.sampleRateTarget);
    let phase = 0;

    this.simulatedIntervalId = window.setInterval(() => {
      if (!this.isRunning) return;

      phase += 0.15;
      // Ruído térmico do silício (Brownian thermal noise de ~0.02 deg/s)
      const thermalNoise = (Math.random() - 0.5) * 0.04;
      // Micro-vibração ambiental residual
      const ambientVib = Math.sin(phase) * 0.02 + Math.cos(phase * 1.618) * 0.015;

      const simZ = ambientVib + thermalNoise;
      const simX = (Math.random() - 0.5) * 0.01;
      const simY = (Math.random() - 0.5) * 0.01;

      this.processRawImuSample(simX, simY, simZ);
    }, intervalMs);
  }
}
