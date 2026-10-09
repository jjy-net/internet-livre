import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Play,
  Square,
  Activity,
  Info,
  Sliders,
  Radio,
  Copy,
  Check,
  RotateCcw,
  MapPin,
  Sparkles,
  Layers,
  Zap,
  Trash2,
  AlertTriangle,
  Compass,
  Repeat,
  Headphones,
  Music,
  Camera,
  Wifi,
} from 'lucide-react';
import {
  AudioModemTransmitter,
  AUDIO_MODEM_PROFILES,
  FREQ_BIT_0,
  FREQ_BIT_1,
  MORSE_TABLE,
} from '../utils/audio';
import { captureGpsLocation } from '../utils/geo';
import { AudioStegoView } from './AudioStegoView';
import { AudioVisualTransceiver } from './AudioVisualTransceiver';
import { AcousticNetworkView } from './AcousticNetworkView';
import { GyrophoneAcousticSensor, GyrophoneMetrics } from '../utils/gyrophoneSensor';

type DisplayMode = 'spectrum' | 'curve' | 'waterfall' | 'waveform';

interface TransmissionHistoryItem {
  id: string;
  type: 'tx' | 'rx';
  mode: string;
  text: string;
  timestamp: number;
}

export const AudioModemView: React.FC = () => {
  // Modo Principal: Modem Acústico | Rede P2P por Som | Esteganografia | Imagem/Vídeo SSTV
  const [activeFeatureTab, setActiveFeatureTab] = useState<'modem' | 'network' | 'stego' | 'sstv'>('modem');

  // Transmissor States
  const [inputText, setInputText] = useState('JJY-RADIO');
  const [baudRate, setBaudRate] = useState(20);
  const [modulationMode, setModulationMode] = useState<'standard' | 'bell202' | 'ultrasonic' | 'morse' | 'dtmf' | 'calibration'>('standard');
  const [volume, setVolume] = useState(0.35);
  const [waveType, setWaveType] = useState<OscillatorType>('sine');
  const [loopTransmit, setLoopTransmit] = useState(false);
  const [morseWpm, setMorseWpm] = useState(15);
  const [calibFreq, setCalibFreq] = useState(1000);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Receptor & Espectro States
  const [isListening, setIsListening] = useState(false);
  const [receiverSource, setReceiverSource] = useState<'microphone' | 'gyroscope'>('microphone');
  const [forceGyroMode, setForceGyroMode] = useState(false);
  const [gyroMetrics, setGyroMetrics] = useState<GyrophoneMetrics | null>(null);
  const [gyroGain, setGyroGain] = useState(35);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('spectrum');
  const [receivedText, setReceivedText] = useState('');
  const [detectedFreq, setDetectedFreq] = useState<number | null>(null);
  const [peakMagnitude, setPeakMagnitude] = useState<number>(0);
  const [detectedBit, setDetectedBit] = useState<0 | 1 | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(100);
  const [freezeSpectrum, setFreezeSpectrum] = useState(false);
  const [history, setHistory] = useState<TransmissionHistoryItem[]>([]);
  const [copiedHistoryId, setCopiedHistoryId] = useState<string | null>(null);

  // Refs de Áudio e Canvas
  const transmitterRef = useRef<AudioModemTransmitter | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const gyroSensorRef = useRef<GyrophoneAcousticSensor | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waterfallCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Refs de Recepção FSK
  const lastBitSampleTimeRef = useRef<number>(0);
  const detectedBitStreakRef = useRef<{ bit: number; count: number }>({ bit: -1, count: 0 });
  const byteBitsRef = useRef<number[]>([]);
  const loopRef = useRef(false);

  useEffect(() => {
    loopRef.current = loopTransmit;
  }, [loopTransmit]);

  // Transmissão de Mensagem
  const startTransmission = async () => {
    if (!inputText.trim() || isTransmitting) return;
    setIsTransmitting(true);
    setProgress({ current: 0, total: 0 });

    const tx = new AudioModemTransmitter();
    transmitterRef.current = tx;

    const currentMsg = inputText.trim();

    try {
      do {
        if (modulationMode === 'morse') {
          await tx.transmitMorse(currentMsg, morseWpm, 800, volume, (current, total) => {
            setProgress({ current, total });
          });
        } else if (modulationMode === 'dtmf') {
          await tx.transmitDtmf(currentMsg, 0.15, volume, (current, total) => {
            setProgress({ current, total });
          });
        } else {
          // FSK (standard, bell202, ultrasonic)
          await tx.transmit(currentMsg, {
            baudRate,
            profileId: modulationMode as 'standard' | 'bell202' | 'ultrasonic',
            volume,
            waveType,
            onProgress: (current, total) => {
              setProgress({ current, total });
            },
          });
        }

        // Registra no histórico
        setHistory((prev) => [
          {
            id: 'tx-' + Date.now(),
            type: 'tx',
            mode: modulationMode.toUpperCase(),
            text: currentMsg,
            timestamp: Date.now(),
          },
          ...prev.slice(0, 19),
        ]);

        if (loopRef.current) {
          await new Promise((res) => setTimeout(res, 800));
        }
      } while (loopRef.current && transmitterRef.current?.active);
    } finally {
      setIsTransmitting(false);
      transmitterRef.current = null;
    }
  };

  const stopTransmission = () => {
    loopRef.current = false;
    setLoopTransmit(false);
    if (transmitterRef.current) {
      transmitterRef.current.stop();
      setIsTransmitting(false);
    }
  };

  // Tom Contínuo de Calibração
  const toggleCalibrationTone = () => {
    if (isCalibrating) {
      if (transmitterRef.current) {
        transmitterRef.current.stopCalibrationTone();
      }
      setIsCalibrating(false);
    } else {
      const tx = transmitterRef.current || new AudioModemTransmitter();
      transmitterRef.current = tx;
      tx.startCalibrationTone(calibFreq, volume, waveType);
      setIsCalibrating(true);
    }
  };

  const handleCalibFreqChange = (newFreq: number) => {
    setCalibFreq(newFreq);
    if (isCalibrating && transmitterRef.current) {
      transmitterRef.current.setCalibrationFrequency(newFreq);
    }
  };

  // Ações Rápidas de Presets
  const sendPreset = (text: string) => {
    setInputText(text);
  };

  const sendGpsLocationViaSound = async () => {
    setStatusMessage('Capturando sinal GPS para envio acústico...');
    try {
      const loc = await captureGpsLocation();
      if (loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
        const gpsString = `LOC:${loc.latitude.toFixed(4)},${loc.longitude.toFixed(4)}`;
        setInputText(gpsString);
        setStatusMessage(`Coordenadas prontas para transmissão: ${gpsString}`);
      } else {
        setStatusMessage('GPS não disponível ou permissão recusada.');
      }
    } catch {
      setStatusMessage('Falha ao obter sinal GPS para transmissão acústica.');
    }
  };

  // Escuta via Giroscópio MEMS (Gyrophone - Fallback Acústico por Vibração)
  const startGyroReceiver = async (reason: string) => {
    try {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }

      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.25;
      analyserRef.current = analyser;

      const gyro = new GyrophoneAcousticSensor({
        gainBoost: gyroGain,
        onMetricsUpdate: (m) => setGyroMetrics(m),
      });
      gyroSensorRef.current = gyro;
      gyro.connectToAnalyser(analyser);
      await gyro.start(reason);

      setReceiverSource('gyroscope');
      setIsListening(true);
      setStatusMessage(`🛰️ Fallback Ativo: Giroscópio MEMS captando vibrações sonoras (${reason})`);
      renderSpectrumVisualizer();
    } catch (err) {
      console.error('Erro ao iniciar receptor por giroscópio:', err);
      setStatusMessage('Falha ao inicializar receptor de vibração por giroscópio.');
    }
  };

  // Escuta via Microfone (com fallback automático para Giroscópio)
  const startListening = async (preferGyro = false) => {
    setStatusMessage(null);

    // Se usuário forçou giroscópio ou selecionou modo IMU
    if (preferGyro || forceGyroMode) {
      await startGyroReceiver('Modo Giroscópio MEMS selecionado');
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      console.warn('getUserMedia indisponível. Ativando fallback para Giroscópio MEMS...');
      await startGyroReceiver('Microfone indisponível no ambiente (HTTPS/Localhost)');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      analyserRef.current = analyser;

      setReceiverSource('microphone');
      setGyroMetrics(null);
      setIsListening(true);
      renderSpectrumVisualizer();
    } catch {
      console.warn('Falha no acesso ao microfone físico. Acionando fallback automático para Giroscópio MEMS...');
      await startGyroReceiver('Microfone negado ou sem dispositivo de áudio');
    }
  };

  const stopListening = () => {
    setIsListening(false);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (gyroSensorRef.current) {
      gyroSensorRef.current.stop();
      gyroSensorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  // Renderizador do Monitor de Espectro
  const renderSpectrumVisualizer = useCallback(() => {
    if (!analyserRef.current || !audioContextRef.current) return;
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const freqData = new Uint8Array(bufferLength);
    const timeData = new Uint8Array(bufferLength);

    analyser.getByteFrequencyData(freqData);
    analyser.getByteTimeDomainData(timeData);

    const nyquist = audioContextRef.current.sampleRate / 2;
    let maxVal = 0;
    let maxIndex = 0;

    for (let i = 0; i < bufferLength; i++) {
      if (freqData[i] > maxVal) {
        maxVal = freqData[i];
        maxIndex = i;
      }
    }

    const peakFreq = Math.round((maxIndex * nyquist) / bufferLength);
    const now = Date.now();

    if (maxVal > threshold) {
      setDetectedFreq(peakFreq);
      setPeakMagnitude(Math.round((maxVal / 255) * 100));

      // Decodificação baseada no perfil ativo
      let bitDetected: 0 | 1 | -1 = -1;
      const profile = AUDIO_MODEM_PROFILES[modulationMode] || AUDIO_MODEM_PROFILES.standard;

      if (peakFreq >= profile.range0[0] && peakFreq <= profile.range0[1]) {
        bitDetected = 0;
      } else if (peakFreq >= profile.range1[0] && peakFreq <= profile.range1[1]) {
        bitDetected = 1;
      }

      setDetectedBit(bitDetected === -1 ? null : bitDetected);

      if (bitDetected !== -1) {
        if (detectedBitStreakRef.current.bit === bitDetected) {
          detectedBitStreakRef.current.count++;
        } else {
          detectedBitStreakRef.current = { bit: bitDetected, count: 1 };
        }

        if (detectedBitStreakRef.current.count === 2 && now - lastBitSampleTimeRef.current > 35) {
          lastBitSampleTimeRef.current = now;
          byteBitsRef.current.push(bitDetected);

          if (byteBitsRef.current.length >= 10) {
            const candidate = byteBitsRef.current.slice(-10);
            if (candidate[0] === 0 && candidate[9] === 1) {
              let charCode = 0;
              for (let b = 0; b < 8; b++) {
                charCode |= candidate[b + 1] << b;
              }
              if (charCode >= 32 && charCode <= 126) {
                const char = String.fromCharCode(charCode);
                setReceivedText((prev) => {
                  const updated = prev + char;
                  return updated;
                });
                byteBitsRef.current = [];
              }
            } else if (byteBitsRef.current.length > 24) {
              byteBitsRef.current = byteBitsRef.current.slice(-10);
            }
          }
        }
      }
    } else {
      setDetectedFreq(null);
      setPeakMagnitude(0);
      setDetectedBit(null);
    }

    // Desenhar no Canvas com os 4 Modos
    const canvas = canvasRef.current;
    if (canvas && !freezeSpectrum) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const width = canvas.width;
        const height = canvas.height;

        if (displayMode === 'spectrum') {
          // 1. ANALISADOR DE ESPECTRO EM BARRAS FFT
          ctx.fillStyle = '#060913';
          ctx.fillRect(0, 0, width, height);

          // Grade de fundo
          ctx.strokeStyle = '#1e293b40';
          ctx.lineWidth = 1;
          for (let y = 0; y < height; y += height / 4) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
          }

          const barCount = 96;
          const barWidth = width / barCount;
          const maxDisplayFreq = 3000;
          const maxBin = Math.floor((maxDisplayFreq / nyquist) * bufferLength);

          for (let i = 0; i < barCount; i++) {
            const binIndex = Math.floor((i / barCount) * maxBin);
            const value = freqData[binIndex] || 0;
            const barHeight = (value / 255) * (height - 20);
            const freqAtBar = (binIndex * nyquist) / bufferLength;

            const isTargetZone =
              (freqAtBar >= 740 && freqAtBar <= 860) ||
              (freqAtBar >= 1140 && freqAtBar <= 1260);

            // Gradiente dinâmico por potência
            if (value > 200) {
              ctx.fillStyle = '#ef4444'; // Vermelho quente
            } else if (value > 140) {
              ctx.fillStyle = '#f59e0b'; // Amarelo
            } else if (isTargetZone) {
              ctx.fillStyle = '#10b981'; // Verde FSK
            } else {
              ctx.fillStyle = '#38bdf880'; // Ciano
            }

            ctx.fillRect(i * barWidth, height - barHeight - 16, barWidth - 1.5, barHeight);
          }

          // Rótulos de frequências na base
          ctx.fillStyle = '#64748b';
          ctx.font = '9px monospace';
          ctx.fillText('0 Hz', 4, height - 4);
          ctx.fillText('800 Hz (Bit 0)', width * 0.26, height - 4);
          ctx.fillText('1200 Hz (Bit 1)', width * 0.40, height - 4);
          ctx.fillText('3000 Hz', width - 45, height - 4);
        } else if (displayMode === 'curve') {
          // 2. CURVA SUAVE DE DENSIDADE ESPECTRAL
          ctx.fillStyle = '#060913';
          ctx.fillRect(0, 0, width, height);

          ctx.beginPath();
          ctx.moveTo(0, height);
          const maxDisplayFreq = 3000;
          const maxBin = Math.floor((maxDisplayFreq / nyquist) * bufferLength);
          const step = Math.max(1, Math.floor(maxBin / width));

          for (let x = 0; x < width; x++) {
            const binIndex = Math.min(bufferLength - 1, x * step);
            const val = freqData[binIndex] / 255;
            const y = height - val * (height - 20) - 10;
            ctx.lineTo(x, y);
          }

          ctx.lineTo(width, height);
          ctx.closePath();

          const grad = ctx.createLinearGradient(0, 0, 0, height);
          grad.addColorStop(0, '#10b98180');
          grad.addColorStop(0.5, '#06b6d440');
          grad.addColorStop(1, '#06091300');
          ctx.fillStyle = grad;
          ctx.fill();

          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else if (displayMode === 'waveform') {
          // 3. OSCILOSCÓPIO NO DOMÍNIO DO TEMPO
          ctx.fillStyle = '#060913';
          ctx.fillRect(0, 0, width, height);

          // Linha de centro
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, height / 2);
          ctx.lineTo(width, height / 2);
          ctx.stroke();

          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.beginPath();

          const sliceWidth = width / bufferLength;
          let x = 0;
          for (let i = 0; i < bufferLength; i++) {
            const v = timeData[i] / 128.0;
            const y = (v * height) / 2;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
          }
          ctx.stroke();
        } else if (displayMode === 'waterfall') {
          // 4. CASCATA ESPECTROGRÁFICA (WATERFALL DISPLAY)
          if (!waterfallCanvasRef.current) {
            waterfallCanvasRef.current = document.createElement('canvas');
            waterfallCanvasRef.current.width = width;
            waterfallCanvasRef.current.height = height;
          }

          const wf = waterfallCanvasRef.current;
          const wfCtx = wf.getContext('2d');
          if (wfCtx) {
            // Rola 1 pixel para baixo
            wfCtx.drawImage(wf, 0, 0, width, height - 1, 0, 1, width, height - 1);

            // Gera nova linha espectral no topo
            const imgData = wfCtx.createImageData(width, 1);
            const maxDisplayFreq = 3000;
            const maxBin = Math.floor((maxDisplayFreq / nyquist) * bufferLength);

            for (let x = 0; x < width; x++) {
              const binIndex = Math.floor((x / width) * maxBin);
              const val = freqData[binIndex] || 0;

              // Heatmap: Escuro -> Azul -> Ciano -> Verde -> Amarelo -> Vermelho
              let r = 0, g = 0, b = 0;
              if (val < 64) {
                b = val * 4;
              } else if (val < 128) {
                g = (val - 64) * 4;
                b = 255;
              } else if (val < 192) {
                r = (val - 128) * 4;
                g = 255;
              } else {
                r = 255;
                g = 255 - (val - 192) * 4;
              }

              const pixelIdx = x * 4;
              imgData.data[pixelIdx] = r;
              imgData.data[pixelIdx + 1] = g;
              imgData.data[pixelIdx + 2] = b;
              imgData.data[pixelIdx + 3] = 255;
            }
            wfCtx.putImageData(imgData, 0, 0);

            // Copia para o canvas principal
            ctx.drawImage(wf, 0, 0);
          }
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(renderSpectrumVisualizer);
  }, [displayMode, freezeSpectrum, modulationMode, threshold]);

  useEffect(() => {
    return () => {
      stopTransmission();
      stopListening();
    };
  }, []);

  const copyHistoryItem = (item: TransmissionHistoryItem) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(item.text);
      setCopiedHistoryId(item.id);
      setTimeout(() => setCopiedHistoryId(null), 2000);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Seletor de Modo Principal */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => setActiveFeatureTab('modem')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeFeatureTab === 'modem'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Radio className="w-4 h-4 text-indigo-300" />
          <span>Modem Acústico & Monitor de Espectro FFT</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFeatureTab('network')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeFeatureTab === 'network'
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Wifi className="w-4 h-4 text-cyan-300" />
          <span>Rede P2P por Som (Mesh Full-Duplex)</span>
          <span className="text-[9px] bg-white/20 text-white px-1.5 py-0.2 rounded-full font-bold">
            Novo
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFeatureTab('sstv')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeFeatureTab === 'sstv'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Camera className="w-4 h-4 text-emerald-300" />
          <span>Imagem & Vídeo por Som (SSTV)</span>
          <span className="text-[9px] bg-white/20 text-white px-1.5 py-0.2 rounded-full font-bold">
            Novo
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFeatureTab('stego')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeFeatureTab === 'stego'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Music className="w-4 h-4 text-purple-300" />
          <span>Esteganografia em Músicas (RSA)</span>
        </button>
      </div>

      {activeFeatureTab === 'network' ? (
        <AcousticNetworkView />
      ) : activeFeatureTab === 'stego' ? (
        <AudioStegoView />
      ) : activeFeatureTab === 'sstv' ? (
        <AudioVisualTransceiver />
      ) : (
        <>
          {/* Banner de Apresentação e Guia Tático */}
          <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-start gap-3">
              <Radio className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div className="text-xs text-indigo-300 space-y-1">
                <h4 className="font-bold text-sm text-indigo-200">
                  Modem Acústico Multifrequência & Analisador de Espectro
                </h4>
                <p className="text-slate-300">
                  Comunicação por ondas sonoras offline (FSK, Bell 202, Ultrassom, Morse CW e DTMF). Permite transmitir e decodificar dados pelo ar entre dispositivos sem Wi-Fi, Bluetooth ou cabos.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={sendGpsLocationViaSound}
                className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                title="Capturar coordenadas GPS e carregar para transmissão acústica"
              >
                <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                <span>Transmitir Meu GPS por Som</span>
              </button>
            </div>
          </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PAINEL DO TRANSMISSOR DE SOM */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-indigo-400" />
              <h3 className="font-bold text-sm text-slate-100">Transmissor Acústico</h3>
            </div>
            {isTransmitting && (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                TRANSMITINDO AR
              </span>
            )}
          </div>

          {/* Seleção do Modo de Modulação */}
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">
              Protocolo de Modulação & Canal
            </label>
            <div className="grid grid-cols-3 gap-1.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setModulationMode('standard')}
                className={`p-2 rounded-xl border text-center transition-all ${
                  modulationMode === 'standard'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <span>FSK Audível</span>
                <span className="block text-[9px] font-mono text-slate-300 opacity-80">800/1200Hz</span>
              </button>

              <button
                type="button"
                onClick={() => setModulationMode('bell202')}
                className={`p-2 rounded-xl border text-center transition-all ${
                  modulationMode === 'bell202'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <span>Bell 202</span>
                <span className="block text-[9px] font-mono text-slate-300 opacity-80">1200/2200Hz</span>
              </button>

              <button
                type="button"
                onClick={() => setModulationMode('ultrasonic')}
                className={`p-2 rounded-xl border text-center transition-all ${
                  modulationMode === 'ultrasonic'
                    ? 'bg-purple-600 text-white border-purple-500 shadow-md'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <span>Ultrassom</span>
                <span className="block text-[9px] font-mono text-slate-300 opacity-80">18-19 kHz</span>
              </button>

              <button
                type="button"
                onClick={() => setModulationMode('morse')}
                className={`p-2 rounded-xl border text-center transition-all ${
                  modulationMode === 'morse'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <span>Morse CW</span>
                <span className="block text-[9px] font-mono text-slate-300 opacity-80">Dit/Dah</span>
              </button>

              <button
                type="button"
                onClick={() => setModulationMode('dtmf')}
                className={`p-2 rounded-xl border text-center transition-all ${
                  modulationMode === 'dtmf'
                    ? 'bg-cyan-600 text-white border-cyan-500 shadow-md'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <span>DTMF Tons</span>
                <span className="block text-[9px] font-mono text-slate-300 opacity-80">Discagem</span>
              </button>

              <button
                type="button"
                onClick={() => setModulationMode('calibration')}
                className={`p-2 rounded-xl border text-center transition-all ${
                  modulationMode === 'calibration'
                    ? 'bg-amber-600 text-white border-amber-500 shadow-md'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <span>Calibração</span>
                <span className="block text-[9px] font-mono text-slate-300 opacity-80">Tom Contínuo</span>
              </button>
            </div>
          </div>

          {/* Campo de Texto para Transmissão */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-slate-400 font-medium">
                Mensagem a Transmitir
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => sendPreset('SOS')}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-300"
                >
                  SOS
                </button>
                <button
                  type="button"
                  onClick={() => sendPreset('PING-TEST')}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-300"
                >
                  PING
                </button>
                <button
                  type="button"
                  onClick={() => sendPreset('JJY-SECURE')}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-300"
                >
                  JJY
                </button>
              </div>
            </div>

            <textarea
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Digite o texto para envio pelo ar..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 font-mono resize-none focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Configurações Avançadas de Modulação */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs">
            {/* Velocidade / Baud ou WPM */}
            <div>
              <span className="text-slate-400 block mb-1">
                {modulationMode === 'morse' ? 'Velocidade Morse (WPM):' : 'Taxa Baud (bps):'}
              </span>
              {modulationMode === 'morse' ? (
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="5"
                    max="35"
                    value={morseWpm}
                    onChange={(e) => setMorseWpm(Number(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                  <span className="font-mono text-emerald-400 font-bold">{morseWpm}</span>
                </div>
              ) : (
                <div className="flex gap-1">
                  {[10, 20, 30, 40].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setBaudRate(rate)}
                      className={`flex-1 py-1 rounded text-[11px] font-semibold border ${
                        baudRate === rate
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      {rate}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Controle de Volume */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-400">Potência / Ganho:</span>
                <span className="font-mono text-indigo-300 font-bold">{Math.round(volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1.0"
                step="0.05"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>

            {/* Forma de Onda */}
            <div>
              <span className="text-slate-400 block mb-1">Forma de Onda:</span>
              <div className="flex gap-1">
                {(['sine', 'triangle', 'square'] as OscillatorType[]).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWaveType(w)}
                    className={`flex-1 py-1 rounded text-[10px] uppercase font-semibold border ${
                      waveType === w
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            {/* Modo Loop / Farol Contínuo */}
            <div className="flex items-center justify-between pt-3">
              <span className="text-slate-300 font-medium flex items-center gap-1">
                <Repeat className="w-3 h-3 text-indigo-400" /> Repetição (Beacon):
              </span>
              <button
                type="button"
                onClick={() => setLoopTransmit(!loopTransmit)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                  loopTransmit
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}
              >
                {loopTransmit ? 'ATIVO' : 'DESLIGADO'}
              </button>
            </div>
          </div>

          {/* Modo de Calibração com Tom Contínuo */}
          {modulationMode === 'calibration' && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-amber-300 font-semibold">
                <span>Tom de Calibração Contínuo:</span>
                <span className="font-mono text-sm font-bold text-amber-200">{calibFreq} Hz</span>
              </div>
              <input
                type="range"
                min="100"
                max="19000"
                step="50"
                value={calibFreq}
                onChange={(e) => handleCalibFreqChange(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={toggleCalibrationTone}
                  className={`w-full py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                    isCalibrating
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-amber-600 hover:bg-amber-500 text-white'
                  }`}
                >
                  {isCalibrating ? 'Parar Tom Contínuo' : 'Gerar Tom Contínuo de Calibração'}
                </button>
              </div>
            </div>
          )}

          {/* Barra de Progresso da Transmissão */}
          {isTransmitting && progress.total > 0 && (
            <div className="space-y-1.5 animate-in fade-in">
              <div className="flex justify-between text-xs font-mono text-indigo-300">
                <span>Emitindo pacote acústico...</span>
                <span>{Math.round((progress.current / progress.total) * 100)}% ({progress.current}/{progress.total} bits)</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all duration-75"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Botões de Ação do Transmissor */}
          <div className="pt-1">
            {!isTransmitting ? (
              <button
                type="button"
                onClick={startTransmission}
                disabled={!inputText.trim()}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-teal-600 hover:from-indigo-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50"
              >
                <Play className="w-4 h-4" /> Emitir Sinal Acústico pelo Alto-falante
              </button>
            ) : (
              <button
                type="button"
                onClick={stopTransmission}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-600/30"
              >
                <Square className="w-4 h-4" /> Interromper Transmissão Sonora
              </button>
            )}
          </div>
        </div>

        {/* PAINEL DO RECEPTOR & MONITOR DE ESPECTRO */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-sm text-slate-100">Monitor de Espectro FFT</h3>
            </div>

            {/* Alternador de Modos de Exibição do Espectro */}
            <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => setDisplayMode('spectrum')}
                className={`px-2 py-0.5 rounded-lg font-semibold transition-all ${
                  displayMode === 'spectrum' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Barras FFT de espectro"
              >
                Barras
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('curve')}
                className={`px-2 py-0.5 rounded-lg font-semibold transition-all ${
                  displayMode === 'curve' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Curva contínua de densidade espectral"
              >
                Curva
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('waterfall')}
                className={`px-2 py-0.5 rounded-lg font-semibold transition-all ${
                  displayMode === 'waterfall' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Sonograma em cascata (Waterfall SDR)"
              >
                Cascata
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('waveform')}
                className={`px-2 py-0.5 rounded-lg font-semibold transition-all ${
                  displayMode === 'waveform' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Osciloscópio de onda no domínio do tempo"
              >
                Onda
              </button>
            </div>
          </div>

          {/* Tela Principal do Monitor de Espectro (Canvas de Alta Fidelidade) */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner">
            <canvas ref={canvasRef} width={480} height={160} className="w-full h-44 block" />

            {/* HUD / Informações Sobrepostas no Monitor de Espectro */}
            <div className="absolute top-2.5 left-2.5 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
              <span className="text-[10px] font-mono text-slate-300 font-bold bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800 backdrop-blur-md">
                {displayMode.toUpperCase()} • {isListening ? 'ONLINE' : 'SENSOR PAUSADO'}
              </span>
            </div>

            {/* Pico de Frequência e Indicador de Bit Decodificado */}
            <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
              {detectedFreq ? (
                <div className="flex items-center gap-1.5 bg-slate-950/90 backdrop-blur-md px-2.5 py-1 rounded-xl border border-emerald-500/50 shadow-lg font-mono text-xs">
                  <span className="text-emerald-300 font-bold">{detectedFreq} Hz</span>
                  <span className="text-[10px] text-slate-400">({peakMagnitude}%)</span>
                  {detectedBit !== null && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                      detectedBit === 1 ? 'bg-emerald-500 text-black' : 'bg-cyan-500 text-black'
                    }`}>
                      BIT {detectedBit}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-[10px] font-mono text-slate-500 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
                  {isListening ? 'Buscando Portadora...' : 'Espectro em Espera'}
                </span>
              )}

              <button
                type="button"
                onClick={() => setFreezeSpectrum(!freezeSpectrum)}
                className={`p-1 rounded-lg border text-[10px] font-mono transition-all ${
                  freezeSpectrum
                    ? 'bg-amber-600 text-white border-amber-500'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
                title="Congelar tela do espectro"
              >
                {freezeSpectrum ? 'DESCONGELAR' : 'FREEZE'}
              </button>
            </div>

            {/* Marcadores de Calibração de Canal */}
            <div className="absolute bottom-1 right-2.5 text-[9px] font-mono text-slate-500">
              Canal: {AUDIO_MODEM_PROFILES[modulationMode]?.name || 'Padrão'}
            </div>
          </div>

          {/* Controle de Sensibilidade / Squelch de Entrada */}
          <div className="flex items-center justify-between gap-3 p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono">
            <span className="text-slate-400 text-[11px] flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" /> Squelch / Sensibilidade:
            </span>
            <div className="flex items-center gap-2 flex-1 max-w-[200px]">
              <input
                type="range"
                min="30"
                max="220"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
              <span className="text-emerald-400 font-bold">{threshold}</span>
            </div>
          </div>

          {/* Telemetria Especial do Receptor por Giroscópio (Gyrophone MEMS) */}
          {receiverSource === 'gyroscope' && isListening && (
            <div className="p-3.5 bg-gradient-to-r from-amber-500/15 via-slate-900/90 to-amber-500/10 border border-amber-500/40 rounded-xl space-y-2 animate-in fade-in shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                  <span>🛰️ RECEPTOR: GIROSCÓPIO MEMS (Acoustic Gyrophone)</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30 font-bold">
                  {gyroMetrics?.sourceType === 'simulated_imu' ? 'SIMULAÇÃO MEMS' : 'HARDWARE IMU REAL'}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-[10px] font-mono pt-0.5">
                <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[9px]">AMOSTRAGEM:</span>
                  <span className="font-bold text-emerald-400 text-xs">{gyroMetrics?.sampleRateHz || 0} Hz</span>
                </div>
                <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[9px]">EIXO RESSONANTE:</span>
                  <span className="font-bold text-indigo-400 text-xs">Eixo {gyroMetrics?.dominantAxis?.toUpperCase() || 'Z'}</span>
                </div>
                <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[9px]">VIBRAÇÃO RMS:</span>
                  <span className="font-bold text-amber-300 text-xs">{(gyroMetrics?.rmsVibration || 0).toFixed(4)}</span>
                </div>
                <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[9px]">GANHO BOOST:</span>
                  <span className="font-bold text-cyan-400 text-xs">{gyroMetrics?.gainBoost || gyroGain}x</span>
                </div>
              </div>

              {gyroMetrics?.fallbackReason && (
                <div className="text-[10px] font-mono text-amber-400/90 flex items-center gap-1.5 pt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>Motivo: {gyroMetrics.fallbackReason}</span>
                </div>
              )}

              {/* Ajuste de Ganho Acústico do Giroscópio */}
              <div className="flex items-center justify-between gap-3 pt-1 text-[11px] font-mono text-slate-300">
                <span className="text-slate-400">Sensibilidade Acústica do Giroscópio:</span>
                <div className="flex items-center gap-2 flex-1 max-w-[160px]">
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={gyroGain}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setGyroGain(val);
                      if (gyroSensorRef.current) gyroSensorRef.current.setGainBoost(val);
                    }}
                    className="w-full accent-amber-500"
                  />
                  <span className="text-amber-300 font-bold">{gyroGain}x</span>
                </div>
              </div>
            </div>
          )}

          {/* Mensagem Decodificada pelo Sensor */}
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 flex-wrap gap-1">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                <span>Dados Decodificados pelo Sensor Acústico:</span>
              </span>

              <div className="flex items-center gap-2">
                {/* Badge de Origem da Recepção */}
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                  receiverSource === 'gyroscope'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  {receiverSource === 'gyroscope' ? '🛰️ Giroscópio MEMS' : '🎤 Microfone Padrão'}
                </span>

                {receivedText && (
                  <button
                    type="button"
                    onClick={() => setReceivedText('')}
                    className="text-[11px] text-slate-500 hover:text-slate-300 font-mono"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            <div className="min-h-14 bg-slate-900/70 rounded-xl p-3 font-mono text-xs text-emerald-300 break-all select-all border border-slate-800/80 shadow-inner flex items-center">
              {receivedText ? (
                <span className="font-bold">{receivedText}</span>
              ) : (
                <span className="text-slate-500 italic">
                  {isListening
                    ? receiverSource === 'gyroscope'
                      ? '🛰️ Giroscópio MEMS ativo: aguardando vibrações acústicas de tons no chassi...'
                      : '🎤 Microfone ativo: aguardando tons sonoros no ambiente para decodificação...'
                    : 'Ative o microfone receptor ou giroscópio para escutar.'}
                </span>
              )}
            </div>
          </div>

          {/* Botões de Controle de Escuta (Microfone e Giroscópio) */}
          <div className="pt-1">
            {!isListening ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => startListening(false)}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                >
                  <Mic className="w-4 h-4 text-emerald-400" /> Ativar Microfone Físico
                </button>
                <button
                  type="button"
                  onClick={() => startListening(true)}
                  className="py-2.5 bg-gradient-to-r from-amber-600/30 to-indigo-600/30 hover:from-amber-600/50 hover:to-indigo-600/50 text-amber-200 text-xs font-bold rounded-xl border border-amber-500/40 flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                  title="Captar áudio através das vibrações do giroscópio MEMS"
                >
                  <Activity className="w-4 h-4 text-amber-400" /> 🛰️ Escutar por Giroscópio MEMS
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={stopListening}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-rose-600/30"
              >
                <MicOff className="w-4 h-4" /> Desativar Receptor Acústico ({receiverSource === 'gyroscope' ? 'Giroscópio MEMS' : 'Microfone'})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* HISTÓRICO DE TRANSMISSÕES E RECEPÇÕES ACÚSTICAS */}
      {history.length > 0 && (
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Headphones className="w-4 h-4 text-indigo-400" />
              <span>Registro de Sessão Acústica ({history.length} Eventos)</span>
            </h4>
            <button
              type="button"
              onClick={() => setHistory([])}
              className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 font-mono"
            >
              <Trash2 className="w-3.5 h-3.5" /> Limpar Histórico
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {history.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-col justify-between gap-2"
              >
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className={`px-1.5 py-0.2 rounded font-bold ${
                    item.type === 'tx' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {item.type === 'tx' ? 'EMITIDO (TX)' : 'RECEBIDO (RX)'} • {item.mode}
                  </span>
                  <span className="text-slate-500 text-[10px]">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <div className="font-mono text-xs text-slate-200 font-bold break-all bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  {item.text}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => copyHistoryItem(item)}
                    className="text-[10px] font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1"
                  >
                    {copiedHistoryId === item.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
