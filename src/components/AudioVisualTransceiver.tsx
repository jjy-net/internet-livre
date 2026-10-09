import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Image as ImageIcon,
  Video,
  Radio,
  Volume2,
  VolumeX,
  Play,
  Square,
  Download,
  Upload,
  RefreshCw,
  Sparkles,
  Sliders,
  Eye,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  Layers,
  Activity,
  Film,
  Sun,
  Contrast,
  Check,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  SstvResolution,
  SstvColorMode,
  SSTV_RESOLUTIONS,
  resizeImageToCanvas,
  encodeImageToSstvAudio,
  encodeVideoToSstvAudio,
  FREQ_SYNC,
  FREQ_BLACK,
  FREQ_WHITE,
  getFlirColor,
} from '../utils/sstvAudio';

export const AudioVisualTransceiver: React.FC = () => {
  // Sub-abas: Transmissor (TX) vs Receptor (RX)
  const [activeTab, setActiveTab] = useState<'tx' | 'rx'>('tx');

  // --- ESTADO DO TRANSMISSOR (TX) ---
  const [sourceType, setSourceType] = useState<'upload' | 'camera' | 'preset'>('preset');
  const [resolution, setResolution] = useState<SstvResolution>('64x64');
  const [colorMode, setColorMode] = useState<SstvColorMode>('grayscale');
  const [scanSpeed, setScanSpeed] = useState<number>(6); // ms por pixel
  const [isVideoMode, setIsVideoMode] = useState<boolean>(false);
  const [videoFps, setVideoFps] = useState<number>(1);

  // Mídia selecionada para TX
  const [sourceImageFile, setSourceImageFile] = useState<File | null>(null);
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null);
  const [videoFrames, setVideoFrames] = useState<HTMLCanvasElement[]>([]);
  const [isCapturingCamera, setIsCapturingCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Áudio gerado de TX
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [txWavUrl, setTxWavUrl] = useState<string | null>(null);
  const [txDuration, setTxDuration] = useState<number>(0);
  const [isPlayingTx, setIsPlayingTx] = useState(false);
  const [txProgressPercent, setTxProgressPercent] = useState(0);

  // Refs de TX
  const txAudioRef = useRef<HTMLAudioElement | null>(null);
  const videoFeedRef = useRef<HTMLVideoElement | null>(null);
  const txPreviewRef = useRef<HTMLCanvasElement | null>(null);

  // --- ESTADO DO RECEPTOR (RX) ---
  const [isListeningRx, setIsListeningRx] = useState(false);
  const [rxProgressLine, setRxProgressLine] = useState(0);
  const [totalRxLines, setTotalRxLines] = useState(64);
  const [rxDetectedFreq, setRxDetectedFreq] = useState<number | null>(null);
  const [rxStatusText, setRxStatusText] = useState('Pronto para receber');
  const [rxBrightness, setRxBrightness] = useState(1.0);
  const [rxContrast, setRxContrast] = useState(1.0);

  // Refs de RX
  const rxCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rxAudioCtxRef = useRef<AudioContext | null>(null);
  const rxAnalyserRef = useRef<AnalyserNode | null>(null);
  const rxStreamRef = useRef<MediaStream | null>(null);
  const rxAnimFrameRef = useRef<number | null>(null);

  // Inicializa imagem preset de teste
  useEffect(() => {
    generatePresetImage('radar');
  }, [resolution, colorMode]);

  // Gera imagem pré-definida militar para teste imediato
  const generatePresetImage = (type: 'radar' | 'target' | 'logo') => {
    const res = SSTV_RESOLUTIONS[resolution];
    const canvas = document.createElement('canvas');
    canvas.width = res.width;
    canvas.height = res.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fundo escuro
    ctx.fillStyle = '#060913';
    ctx.fillRect(0, 0, res.width, res.height);

    if (type === 'radar') {
      // Grade de Radar Tático
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1;
      ctx.strokeRect(2, 2, res.width - 4, res.height - 4);
      // Círculos concêntricos
      const cx = res.width / 2;
      const cy = res.height / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, res.width * 0.4, 0, 2 * Math.PI);
      ctx.arc(cx, cy, res.width * 0.2, 0, 2 * Math.PI);
      ctx.stroke();
      // Linhas cruzadas
      ctx.beginPath();
      ctx.moveTo(cx, 0); ctx.lineTo(cx, res.height);
      ctx.moveTo(0, cy); ctx.lineTo(res.width, cy);
      ctx.stroke();
      // Texto identificador
      ctx.fillStyle = '#38bdf8';
      ctx.font = `bold ${Math.max(7, Math.floor(res.width * 0.12))}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('JYY-SSTV', cx, cy - 4);
    } else if (type === 'target') {
      // Alvo Tático
      const cx = res.width / 2;
      const cy = res.height / 2;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(cx, cy, res.width * 0.35, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = '#060913';
      ctx.beginPath();
      ctx.arc(cx, cy, res.width * 0.22, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, res.width * 0.08, 0, 2 * Math.PI);
      ctx.fill();
    } else {
      // Logo Jyy
      ctx.fillStyle = '#6366f1';
      ctx.font = `bold ${Math.max(10, Math.floor(res.width * 0.3))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('JYY', res.width / 2, res.height / 2);
    }

    setPreviewCanvas(canvas);
    renderPreviewToElement(canvas);
  };

  const renderPreviewToElement = (sourceCanvas: HTMLCanvasElement) => {
    if (!txPreviewRef.current) return;
    const dest = txPreviewRef.current;
    dest.width = sourceCanvas.width;
    dest.height = sourceCanvas.height;
    const dCtx = dest.getContext('2d');
    if (dCtx) {
      dCtx.drawImage(sourceCanvas, 0, 0);
    }
  };

  // Carregar imagem de arquivo do usuário
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSourceImageFile(file);
    setSourceType('upload');
    setTxWavUrl(null);

    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const res = SSTV_RESOLUTIONS[resolution];
        const resized = resizeImageToCanvas(img, res.width, res.height);
        setPreviewCanvas(resized);
        renderPreviewToElement(resized);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Iniciar Câmera / Webcam
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
      setCameraStream(stream);
      setIsCapturingCamera(true);
      setSourceType('camera');
      if (videoFeedRef.current) {
        videoFeedRef.current.srcObject = stream;
        videoFeedRef.current.play();
      }
    } catch {
      alert('Não foi possível acessar a câmera do dispositivo.');
    }
  };

  const capturePhotoFromCamera = () => {
    if (!videoFeedRef.current) return;
    const res = SSTV_RESOLUTIONS[resolution];
    const canvas = resizeImageToCanvas(videoFeedRef.current, res.width, res.height);
    setPreviewCanvas(canvas);
    renderPreviewToElement(canvas);
    stopCamera();
    confetti({ particleCount: 30, origin: { y: 0.7 } });
  };

  const captureVideoClipFromCamera = async () => {
    if (!videoFeedRef.current) return;
    const res = SSTV_RESOLUTIONS[resolution];
    const frames: HTMLCanvasElement[] = [];

    // Captura 4 frames sequenciais com intervalo de 600ms
    for (let i = 0; i < 4; i++) {
      if (videoFeedRef.current) {
        const c = resizeImageToCanvas(videoFeedRef.current, res.width, res.height);
        frames.push(c);
      }
      await new Promise((r) => setTimeout(r, 600));
    }

    setVideoFrames(frames);
    setIsVideoMode(true);
    if (frames.length > 0) {
      setPreviewCanvas(frames[0]);
      renderPreviewToElement(frames[0]);
    }
    stopCamera();
    confetti({ particleCount: 40 });
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
    setIsCapturingCamera(false);
  };

  // Gerar Áudio SSTV (Transmissão de Imagem/Vídeo)
  const handleGenerateAudioTx = async () => {
    if (!previewCanvas) return;
    setIsGeneratingAudio(true);
    setTxWavUrl(null);

    try {
      let result: { audioBuffer: AudioBuffer; wavBlob: Blob; wavUrl: string; durationSec: number };

      if (isVideoMode && videoFrames.length > 0) {
        result = await encodeVideoToSstvAudio(videoFrames, videoFps, {
          resolution,
          colorMode,
          pixelDurationMs: scanSpeed,
        });
      } else {
        result = await encodeImageToSstvAudio(previewCanvas, {
          resolution,
          colorMode,
          pixelDurationMs: scanSpeed,
        });
      }

      setTxWavUrl(result.wavUrl);
      setTxDuration(result.durationSec);
      confetti({ particleCount: 50, origin: { y: 0.6 } });
    } catch (err: unknown) {
      alert('Falha ao modular imagem em áudio: ' + (err as Error).message);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // =========================================================================
  // RECEPTOR EM TEMPO REAL (RX DECODER VIA MICROFONE OU ARQUIVO)
  // =========================================================================

  const startListeningRx = async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      alert('Microfone indisponível ou conexão insegura.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      rxStreamRef.current = stream;

      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtxClass();
      rxAudioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.2;
      source.connect(analyser);
      rxAnalyserRef.current = analyser;

      const res = SSTV_RESOLUTIONS[resolution];
      setTotalRxLines(res.height);
      setRxProgressLine(0);

      // Prepara o canvas receptor
      if (rxCanvasRef.current) {
        rxCanvasRef.current.width = res.width;
        rxCanvasRef.current.height = res.height;
        const cCtx = rxCanvasRef.current.getContext('2d');
        if (cCtx) {
          cCtx.fillStyle = '#060913';
          cCtx.fillRect(0, 0, res.width, res.height);
        }
      }

      setIsListeningRx(true);
      setRxStatusText('Sintonizando frequências SSTV (1200 - 2300 Hz)...');
      runRxDecodingLoop(res.width, res.height);
    } catch {
      alert('Não foi possível inicializar captura do microfone.');
    }
  };

  const stopListeningRx = () => {
    setIsListeningRx(false);
    if (rxAnimFrameRef.current) cancelAnimationFrame(rxAnimFrameRef.current);
    if (rxStreamRef.current) {
      rxStreamRef.current.getTracks().forEach((t) => t.stop());
      rxStreamRef.current = null;
    }
    if (rxAudioCtxRef.current) {
      rxAudioCtxRef.current.close().catch(() => {});
      rxAudioCtxRef.current = null;
    }
    setRxStatusText('Receptor em espera.');
  };

  // Loop de Decodificação de Scanlines em Tempo Real
  const runRxDecodingLoop = (width: number, height: number) => {
    let currentY = 0;
    let currentX = 0;
    let hasDetectedSync = false;
    let syncHoldoff = 0;

    const decodeFrame = () => {
      if (!rxAnalyserRef.current || !rxAudioCtxRef.current) return;
      const analyser = rxAnalyserRef.current;
      const bufferLength = analyser.frequencyBinCount;
      const freqData = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(freqData);

      const nyquist = rxAudioCtxRef.current.sampleRate / 2;

      // Encontrar frequência de pico na faixa de 1100 Hz a 2400 Hz
      let peakBin = 0;
      let peakVal = 0;
      const minBin = Math.floor((1100 / nyquist) * bufferLength);
      const maxBin = Math.floor((2400 / nyquist) * bufferLength);

      for (let b = minBin; b < maxBin; b++) {
        if (freqData[b] > peakVal) {
          peakVal = freqData[b];
          peakBin = b;
        }
      }

      const dominantFreq = (peakBin * nyquist) / bufferLength;
      setRxDetectedFreq(Math.round(dominantFreq));

      // Se houver sinal acima do limiar de ruído
      if (peakVal > 70) {
        // Detecção do pulso de sincronismo de linha (1200 Hz +/- 80 Hz)
        if (Math.abs(dominantFreq - FREQ_SYNC) < 90 && syncHoldoff === 0) {
          hasDetectedSync = true;
          currentX = 0;
          currentY++;
          setRxProgressLine(currentY);
          syncHoldoff = 10; // Evita falsos disparos no mesmo pulso
          setRxStatusText(`Decodificando Linha ${currentY}/${height}...`);

          if (currentY >= height) {
            currentY = 0;
            confetti({ particleCount: 60, origin: { y: 0.6 } });
          }
        }

        if (syncHoldoff > 0) syncHoldoff--;

        // Converte frequência de 1500Hz - 2300Hz de volta para o pixel
        if (hasDetectedSync && dominantFreq >= 1450 && dominantFreq <= 2350) {
          const normVal = Math.max(0, Math.min(1, (dominantFreq - FREQ_BLACK) / (FREQ_WHITE - FREQ_BLACK)));
          const rawByte = Math.round(normVal * 255);

          // Ajustes de Brilho e Contraste
          const adjusted = Math.max(0, Math.min(255, (rawByte - 128) * rxContrast + 128 + (rxBrightness - 1) * 60));

          if (rxCanvasRef.current && currentY < height && currentX < width) {
            const ctx = rxCanvasRef.current.getContext('2d');
            if (ctx) {
              if (colorMode === 'nvg') {
                ctx.fillStyle = `rgb(0, ${adjusted}, 0)`;
              } else if (colorMode === 'flir') {
                const [r, g, b] = getFlirColor(adjusted);
                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
              } else {
                ctx.fillStyle = `rgb(${adjusted}, ${adjusted}, ${adjusted})`;
              }

              ctx.fillRect(currentX, currentY, 1, 1);
              currentX++;
            }
          }
        }
      }

      rxAnimFrameRef.current = requestAnimationFrame(decodeFrame);
    };

    rxAnimFrameRef.current = requestAnimationFrame(decodeFrame);
  };

  // Carregar arquivo de áudio WAV para decodificar
  const handleDecodeAudioFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRxStatusText('Carregando e analisando arquivo acústico...');
    const audioEl = new Audio(URL.createObjectURL(file));

    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtxClass();
    rxAudioCtxRef.current = ctx;

    const source = ctx.createMediaElementSource(audioEl);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    rxAnalyserRef.current = analyser;

    const res = SSTV_RESOLUTIONS[resolution];
    setTotalRxLines(res.height);
    setRxProgressLine(0);

    if (rxCanvasRef.current) {
      rxCanvasRef.current.width = res.width;
      rxCanvasRef.current.height = res.height;
      const cCtx = rxCanvasRef.current.getContext('2d');
      if (cCtx) {
        cCtx.fillStyle = '#060913';
        cCtx.fillRect(0, 0, res.width, res.height);
      }
    }

    setIsListeningRx(true);
    audioEl.play();
    runRxDecodingLoop(res.width, res.height);

    audioEl.onended = () => {
      setIsListeningRx(false);
      setRxStatusText('Decodificação concluída!');
      confetti({ particleCount: 50 });
    };
  };

  // Salvar imagem do receptor
  const saveReceivedImage = () => {
    if (!rxCanvasRef.current) return;
    const url = rxCanvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `imagem-recebida-sstv-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Banner de Apresentação */}
      <div className="p-4 bg-gradient-to-r from-slate-950 via-indigo-950/40 to-slate-950 border border-indigo-500/40 rounded-2xl flex items-center justify-between flex-wrap gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/20 border border-indigo-500/50 rounded-xl text-indigo-400">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-100 uppercase tracking-widest flex items-center gap-2">
              Transmissor e Receptor de Imagem & Vídeo por Som (SSTV)
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full font-mono">
                Slow-Scan TV • FM Subcarrier
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Envio e recepção de fotos, mapas táticos e mini-vídeos através de ondas sonoras ou rádios comunicadores (Walkie-Talkie).
            </p>
          </div>
        </div>

        {/* Alternador TX / RX */}
        <div className="flex items-center gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('tx')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'tx'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Transmitir (TX)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rx')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'rx'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Receber (RX)
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: TRANSMISSOR (TX) - ENVIO DE IMAGEM E VÍDEO */}
      {/* ========================================================================= */}
      {activeTab === 'tx' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Painel Esquerdo: Entrada e Parâmetros */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> 1. Origem da Mídia a Transmitir
              </h3>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setIsVideoMode(!isVideoMode)}
                  className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                    isVideoMode
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {isVideoMode ? 'Modo: Vídeo / Clipes' : 'Modo: Imagem Estática'}
                </button>
              </div>
            </div>

            {/* Seletores de Origem */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => { setSourceType('preset'); generatePresetImage('radar'); }}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  sourceType === 'preset'
                    ? 'bg-indigo-950/60 border-indigo-500 text-indigo-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                }`}
              >
                <span>🎯</span>
                <span className="block mt-1">Presets Táticos</span>
              </button>

              <label
                className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all ${
                  sourceType === 'upload'
                    ? 'bg-indigo-950/60 border-indigo-500 text-indigo-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                }`}
              >
                <Upload className="w-4 h-4 mx-auto" />
                <span className="block mt-1 truncate">
                  {sourceImageFile ? sourceImageFile.name : 'Subir Foto'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={startCamera}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  sourceType === 'camera'
                    ? 'bg-indigo-950/60 border-indigo-500 text-indigo-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                }`}
              >
                <Camera className="w-4 h-4 mx-auto" />
                <span className="block mt-1">Webcam / Foto</span>
              </button>
            </div>

            {/* Presets Rápidos */}
            {sourceType === 'preset' && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => generatePresetImage('radar')}
                  className="px-2.5 py-1 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-slate-300"
                >
                  Radar Militar
                </button>
                <button
                  type="button"
                  onClick={() => generatePresetImage('target')}
                  className="px-2.5 py-1 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-slate-300"
                >
                  Alvo de Grade
                </button>
                <button
                  type="button"
                  onClick={() => generatePresetImage('logo')}
                  className="px-2.5 py-1 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-slate-300"
                >
                  Logo Jyy
                </button>
              </div>
            )}

            {/* Captura da Câmera Ativa */}
            {isCapturingCamera && (
              <div className="p-3 bg-slate-950 rounded-xl border border-indigo-500/50 space-y-3">
                <div className="relative rounded-lg overflow-hidden bg-black aspect-video max-h-48 mx-auto">
                  <video
                    ref={videoFeedRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={capturePhotoFromCamera}
                    className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-all"
                  >
                    📸 Capturar Foto
                  </button>
                  <button
                    type="button"
                    onClick={captureVideoClipFromCamera}
                    className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-all"
                  >
                    🎥 Gravar Clipe de Vídeo (4 Frames)
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* AJUSTES DE QUALIDADE E TRANSMISSÃO */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" /> 2. Ajustes de Qualidade e Velocidade
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">Resolução do Fax Acústico:</span>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value as SstvResolution)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs"
                  >
                    <option value="32x32">32x32 (Ultra-Rápido • 3s)</option>
                    <option value="64x64">64x64 (Padrão SSTV • 8s)</option>
                    <option value="128x128">128x128 (Alta Definição • 20s)</option>
                    <option value="160x120">160x120 (Fax Retangular)</option>
                  </select>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">Modo de Cor / Filtro:</span>
                  <select
                    value={colorMode}
                    onChange={(e) => setColorMode(e.target.value as SstvColorMode)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs"
                  >
                    <option value="grayscale">Escala de Cinza (Mais Resistente)</option>
                    <option value="rgb">RGB Colorido Completo</option>
                    <option value="nvg">Visão Noturna NVG (Fósforo Verde)</option>
                    <option value="flir">Térmico FLIR (Infravermelho)</option>
                  </select>
                </div>
              </div>

              {/* Slider de Velocidade */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Tempo por Pixel (Velocidade):</span>
                  <span className="font-mono text-indigo-400 font-bold">{scanSpeed} ms ({Math.round(1000 / scanSpeed)} px/s)</span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={16}
                  value={scanSpeed}
                  onChange={(e) => setScanSpeed(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
                <span className="text-[10px] text-slate-500 block">
                  Velocidades menores (3ms) transmitem mais rápido; velocidades maiores (12ms) resistem melhor a ruídos de eco e alto-falantes distantes.
                </span>
              </div>
            </div>

            {/* Botão de Geração */}
            <button
              type="button"
              disabled={isGeneratingAudio || !previewCanvas}
              onClick={handleGenerateAudioTx}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              {isGeneratingAudio ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Modulando scanlines em sinal sonoro...</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" />
                  <span>Gerar Sinal de Som da {isVideoMode ? 'Sequência de Vídeo' : 'Imagem'}</span>
                </>
              )}
            </button>
          </div>

          {/* Painel Direito: Preview e Emissão Acústica */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl">
            <div>
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4 text-emerald-400" /> Pré-Visualização & Emissão de Som
              </h3>

              {/* Canvas de Preview */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col items-center justify-center space-y-3">
                <div className="border-2 border-indigo-500/50 rounded-lg p-1 bg-black shadow-inner">
                  <canvas
                    ref={txPreviewRef}
                    className="image-rendering-pixelated max-h-48 max-w-full"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>

                <div className="flex items-center justify-between w-full text-[11px] text-slate-400 font-mono">
                  <span>Resolução: {SSTV_RESOLUTIONS[resolution].width}x{SSTV_RESOLUTIONS[resolution].height}</span>
                  <span>Modo: {colorMode.toUpperCase()}</span>
                  {isVideoMode && <span className="text-purple-400">Frames: {videoFrames.length}</span>}
                </div>
              </div>

              {/* Player do Sinal de Áudio SSTV Gerado */}
              {txWavUrl && (
                <div className="bg-slate-950 p-4 rounded-xl border border-indigo-500/40 space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Áudio Pronto para Transmissão
                    </span>
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-mono">
                      Duração: {txDuration.toFixed(1)}s
                    </span>
                  </div>

                  <audio
                    ref={txAudioRef}
                    src={txWavUrl}
                    controls
                    className="w-full mt-2"
                  />

                  <p className="text-[11px] text-slate-400 leading-relaxed italic">
                    🔊 Dê play no áudio acima ou toque perto do receptor. O receptor detectará o tom de sincronismo de 1200 Hz e pintará a imagem linha a linha!
                  </p>

                  <a
                    href={txWavUrl}
                    download={`sstv-${isVideoMode ? 'video' : 'foto'}-${Date.now()}.wav`}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    <Download className="w-4 h-4" />
                    <span>Baixar Arquivo de Áudio da Imagem (.wav)</span>
                  </a>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400">
              💡 <strong>Como transmitir para outro aparelho:</strong> Aumente o volume do alto-falante e abra o modo <em>Receptor (RX)</em> no outro computador ou celular. A foto será desenhada na tela dele conforme o som é emitido!
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: RECEPTOR (RX) - DECODIFICADOR EM TEMPO REAL */}
      {/* ========================================================================= */}
      {activeTab === 'rx' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Painel Esquerdo: Controles de Escuta e Ajustes */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <Radio className="w-4 h-4" /> 1. Fonte do Sinal de Recepção
            </h3>

            {/* Botão de Ativação do Microfone */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={isListeningRx ? stopListeningRx : startListeningRx}
                className={`w-full py-3.5 rounded-xl text-xs font-bold shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  isListeningRx
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/40 animate-pulse'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                }`}
              >
                {isListeningRx ? (
                  <>
                    <VolumeX className="w-5 h-5" />
                    <span>PARAR RECEPTOR ACÚSTICO (EM ESCUTA ATIVA)</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-5 h-5" />
                    <span>ATIVAR ESCUTA DO MICROFONE EM TEMPO REAL</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="flex-1 border-t border-slate-800"></span>
                <span>ou decodificar de um arquivo gravado</span>
                <span className="flex-1 border-t border-slate-800"></span>
              </div>

              <label className="border border-dashed border-slate-800 hover:border-emerald-500/60 bg-slate-950 p-3 rounded-xl flex items-center justify-center gap-2 text-xs text-slate-300 cursor-pointer transition-all">
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>Carregar Áudio SSTV (.wav / .mp3)</span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleDecodeAudioFile}
                  className="hidden"
                />
              </label>
            </div>

            {/* Ajustes de Recepção */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-amber-400" /> 2. Filtros de Imagem Recebida
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Sun className="w-3.5 h-3.5" /> Brilho:
                    </span>
                    <span className="font-mono text-slate-200">{rxBrightness.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    value={rxBrightness}
                    onChange={(e) => setRxBrightness(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Contrast className="w-3.5 h-3.5" /> Contraste:
                    </span>
                    <span className="font-mono text-slate-200">{rxContrast.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={2.5}
                    step={0.1}
                    value={rxContrast}
                    onChange={(e) => setRxContrast(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* HUD de Monitoramento */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Status do Receptor:</span>
                <span className="font-bold text-emerald-400">{rxStatusText}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Frequência Detectada:</span>
                <span className="font-bold text-indigo-400">
                  {rxDetectedFreq ? `${rxDetectedFreq} Hz` : '---'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Progresso da Imagem:</span>
                <span className="font-bold text-slate-200">
                  Linha {rxProgressLine} de {totalRxLines} ({Math.round((rxProgressLine / totalRxLines) * 100)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Painel Direito: Canvas de Desenho da Linha em Tempo Real */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" /> Fax Acústico em Formação (Scanlines)
                </h3>
                <span className="text-[10px] text-emerald-400 font-mono">
                  {isListeningRx ? '● RECEBENDO' : '○ ESPERANDO SINAL'}
                </span>
              </div>

              {/* Canvas da Imagem Recebida */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col items-center justify-center space-y-3">
                <div className="border-2 border-emerald-500/50 rounded-lg p-1 bg-black shadow-inner">
                  <canvas
                    ref={rxCanvasRef}
                    className="image-rendering-pixelated max-h-56 max-w-full"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>

                {/* Barra de Progresso de Linhas */}
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-75"
                    style={{ width: `${Math.min(100, (rxProgressLine / totalRxLines) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Botão de Salvar Imagem Recebida */}
              <button
                type="button"
                onClick={saveReceivedImage}
                className="w-full mt-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <Download className="w-4 h-4" />
                <span>Salvar Imagem Recebida (.png)</span>
              </button>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400">
              🛰️ <strong>Dica de Recepção:</strong> Mantenha o microfone próximo da fonte de som e evite ruídos estridentes ao redor. Conforme as frequências são emitidas, você verá a imagem sendo desenhada linha por linha na tela!
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
