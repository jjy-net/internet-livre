import React, { useState, useRef, useEffect } from 'react';
import { Lightbulb, Play, Square, Eye, Info, Maximize2 } from 'lucide-react';

export const LightModemView: React.FC = () => {
  const [inputText, setInputText] = useState('SOS');
  const [bitDurationMs, setBitDurationMs] = useState(120);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [currentLightState, setCurrentLightState] = useState<boolean | null>(null); // true = branco (1), false = preto (0)
  const [currentBitIndex, setCurrentBitIndex] = useState(0);
  const [totalBits, setTotalBits] = useState(0);

  // Receptor via câmera
  const [isReceiving, setIsReceiving] = useState(false);
  const [brightness, setBrightness] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const flasherTimeoutRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const startLightTransmission = () => {
    if (!inputText.trim()) return;
    setIsTransmitting(true);

    const bytes = new TextEncoder().encode(inputText.trim());
    const bits: number[] = [];

    // Preâmbulo
    bits.push(1, 0, 1, 0, 1, 0);

    for (const byte of bytes) {
      bits.push(0); // start bit
      for (let b = 0; b < 8; b++) {
        bits.push((byte >> b) & 1);
      }
      bits.push(1); // stop bit
    }

    setTotalBits(bits.length);
    let idx = 0;

    const tick = () => {
      if (idx >= bits.length) {
        setIsTransmitting(false);
        setCurrentLightState(null);
        return;
      }
      setCurrentBitIndex(idx);
      setCurrentLightState(bits[idx] === 1);
      idx++;
      flasherTimeoutRef.current = window.setTimeout(tick, bitDurationMs);
    };

    tick();
  };

  const stopLightTransmission = () => {
    setIsTransmitting(false);
    setCurrentLightState(null);
    if (flasherTimeoutRef.current) clearTimeout(flasherTimeoutRef.current);
  };

  // Câmera receptora
  const startCameraReceiver = async () => {
    setStatusMessage(null);
    if (!navigator?.mediaDevices?.getUserMedia) {
      setStatusMessage('Câmera indisponível: Em conexões HTTP em rede local, navegadores móveis desativam a câmera ao vivo. Use HTTPS (porta 4873) ou localhost.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsReceiving(true);
        sampleLuminance();
      }
    } catch {
      setStatusMessage('Não foi possível acessar a câmera para sensor de luminosidade.');
    }
  };

  const stopCameraReceiver = () => {
    setIsReceiving(false);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
  };

  const sampleLuminance = () => {
    if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(sampleLuminance);
      return;
    }

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 48;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, 64, 48);
      const imgData = ctx.getImageData(0, 0, 64, 48);
      let sum = 0;
      for (let i = 0; i < imgData.data.length; i += 4) {
        // Luminância perceptiva Y = 0.299R + 0.587G + 0.114B
        const r = imgData.data[i];
        const g = imgData.data[i + 1];
        const b = imgData.data[i + 2];
        sum += 0.299 * r + 0.587 * g + 0.114 * b;
      }
      const avg = Math.round(sum / (imgData.data.length / 4));
      setBrightness(avg);
    }

    animFrameRef.current = requestAnimationFrame(sampleLuminance);
  };

  useEffect(() => {
    return () => {
      stopLightTransmission();
      stopCameraReceiver();
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-300">
          <strong>Modem Óptico por Luz:</strong> Transmite dados codificados em pulsos binários de brilho na tela (Branco = 1, Preto = 0). O receptor aponta a câmera para a tela para decodificar os fótons.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transmissor */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold text-slate-100">Transmissor de Luz da Tela</h3>
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">
              Mensagem de Texto
            </label>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Digite texto curto..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-mono"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Duração por Bit: {bitDurationMs}ms</span>
            <input
              type="range"
              min={60}
              max={300}
              step={20}
              value={bitDurationMs}
              onChange={(e) => setBitDurationMs(Number(e.target.value))}
              className="w-32 accent-amber-500"
            />
          </div>

          {/* Área de Flash Óptico */}
          <div
            className="w-full h-40 rounded-2xl border border-slate-700 flex items-center justify-center transition-colors duration-75 shadow-inner"
            style={{
              backgroundColor: currentLightState === null ? '#0f172a' : currentLightState ? '#ffffff' : '#000000',
            }}
          >
            {isTransmitting && (
              <span
                className={`font-mono text-xs font-bold px-3 py-1 rounded-full ${
                  currentLightState ? 'text-black bg-white/70' : 'text-white bg-black/70'
                }`}
              >
                Bit #{currentBitIndex + 1}/{totalBits} : {currentLightState ? '1' : '0'}
              </span>
            )}
          </div>

          <div className="pt-2">
            {!isTransmitting ? (
              <button
                type="button"
                onClick={startLightTransmission}
                disabled={!inputText.trim()}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-600/25 transition-all"
              >
                <Play className="w-4 h-4" /> Iniciar Pulso Óptico
              </button>
            ) : (
              <button
                type="button"
                onClick={stopLightTransmission}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <Square className="w-4 h-4" /> Parar Luz
              </button>
            )}
          </div>
        </div>

        {/* Receptor Óptico por Câmera */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-indigo-400" />
              <h3 className="font-semibold text-slate-100">Sensor Óptico (Câmera)</h3>
            </div>
            {isReceiving && (
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Luz: {brightness}/255
              </span>
            )}
          </div>

          <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border border-slate-800 flex items-center justify-center">
            <video ref={videoRef} className="w-full h-full object-cover" />
            {isReceiving && (
              <div className="absolute bottom-2 left-2 right-2 bg-slate-950/80 backdrop-blur-sm p-2 rounded-xl flex items-center justify-between text-xs font-mono">
                <span>Nível detectado: {brightness > 128 ? 'ALTO (Bit 1)' : 'BAIXO (Bit 0)'}</span>
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: brightness > 128 ? '#ffffff' : '#334155' }} />
              </div>
            )}
          </div>

          {statusMessage && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center justify-between gap-2">
              <span>{statusMessage}</span>
              <button type="button" onClick={() => setStatusMessage(null)} className="text-amber-400 hover:text-white">✕</button>
            </div>
          )}

          <div className="pt-2">
            {!isReceiving ? (
              <button
                type="button"
                onClick={startCameraReceiver}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-all"
              >
                <Eye className="w-4 h-4 text-indigo-400" /> Ativar Sensor de Luminosidade
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCameraReceiver}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <Square className="w-4 h-4" /> Desativar Sensor
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
