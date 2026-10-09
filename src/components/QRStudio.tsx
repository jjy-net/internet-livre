import React, { useState, useRef, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import confetti from 'canvas-confetti';
import {
  QrCode,
  Download,
  Copy,
  Camera,
  Upload,
  Check,
  RefreshCw,
  Palette,
  Sliders,
  FileCode,
  Trash2,
  Sparkles,
  Wifi,
  Mail,
  Phone,
  MessageSquare,
  User,
  CreditCard
} from 'lucide-react';

type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

interface QRSettings {
  errorCorrectionLevel: ErrorCorrectionLevel;
  size: number;
  margin: number;
  darkColor: string;
  lightColor: string;
}

export const QRStudio: React.FC = () => {
  const [content, setContent] = useState('https://github.com');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState<QRSettings>({
    errorCorrectionLevel: 'M',
    size: 320,
    margin: 4,
    darkColor: '#000000',
    lightColor: '#ffffff',
  });
  const [history, setHistory] = useState<{ content: string; timestamp: number }[]>(() => {
    try {
      const saved = localStorage.getItem('dl_qr_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanAnimFrame = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateQR = useCallback(async () => {
    if (!content.trim()) {
      setQrDataUrl(null);
      return;
    }
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;

      await QRCode.toCanvas(canvas, content.trim(), {
        errorCorrectionLevel: settings.errorCorrectionLevel,
        width: settings.size,
        margin: settings.margin,
        color: {
          dark: settings.darkColor,
          light: settings.lightColor,
        },
      });

      const url = canvas.toDataURL('image/png');
      setQrDataUrl(url);

      // Save to history
      setHistory((prev) => {
        const item = { content: content.trim(), timestamp: Date.now() };
        const updated = [item, ...prev.filter((h) => h.content !== content.trim())].slice(0, 15);
        try {
          localStorage.setItem('dl_qr_history', JSON.stringify(updated));
        } catch { /* ignore */ }
        return updated;
      });
    } catch (err) {
      console.error('Falha ao gerar QR:', err);
    }
  }, [content, settings]);

  useEffect(() => {
    const timer = setTimeout(generateQR, 200);
    return () => clearTimeout(timer);
  }, [generateQR]);

  const downloadPNG = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.download = `qrcode-${Date.now()}.png`;
    a.href = qrDataUrl;
    a.click();
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
  };

  const downloadSVG = async () => {
    if (!content.trim()) return;
    const svgStr = await QRCode.toString(content.trim(), {
      type: 'svg',
      errorCorrectionLevel: settings.errorCorrectionLevel,
      width: settings.size,
      margin: settings.margin,
      color: { dark: settings.darkColor, light: settings.lightColor },
    });
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `qrcode-${Date.now()}.svg`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyImage = async () => {
    if (!qrDataUrl) return;
    try {
      const res = await fetch(qrDataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      confetti({ particleCount: 30, spread: 50 });
    } catch {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Camera Scanning with jsQR
  const startCamera = async () => {
    setCameraError(null);
    setScannedResult(null);
    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError('Câmera indisponível: Em conexões HTTP em rede local, navegadores móveis desativam a câmera ao vivo. Use localhost ou ative o flag chrome://flags.');
      setIsScanning(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        requestAnimationFrame(tickScanner);
      }
    } catch (err: unknown) {
      setCameraError('Câmera não permitida ou indisponível.');
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    setIsScanning(false);
    if (scanAnimFrame.current) cancelAnimationFrame(scanAnimFrame.current);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const tickScanner = () => {
    if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      scanAnimFrame.current = requestAnimationFrame(tickScanner);
      return;
    }

    const video = videoRef.current;
    const offscreen = document.createElement('canvas');
    offscreen.width = video.videoWidth;
    offscreen.height = video.videoHeight;
    const ctx = offscreen.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
      const imgData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
      const code = jsQR(imgData.data, imgData.width, imgData.height);
      if (code && code.data) {
        setScannedResult(code.data);
        confetti({ particleCount: 50, spread: 70 });
        stopCamera();
        return;
      }
    }
    scanAnimFrame.current = requestAnimationFrame(tickScanner);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const offscreen = document.createElement('canvas');
        offscreen.width = img.width;
        offscreen.height = img.height;
        const ctx = offscreen.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
          const code = jsQR(imgData.data, imgData.width, imgData.height);
          if (code && code.data) {
            setScannedResult(code.data);
            confetti({ particleCount: 50 });
          } else {
            setScannedResult('Nenhum QR Code legível encontrado na imagem.');
          }
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const themes = [
    { name: 'Clássico', dark: '#000000', light: '#ffffff' },
    { name: 'Jyy', dark: '#6366f1', light: '#ffffff' },
    { name: 'Dark Cyber', dark: '#38bdf8', light: '#0f172a' },
    { name: 'Esmeralda', dark: '#059669', light: '#ecfdf5' },
    { name: 'Vinho', dark: '#991b1b', light: '#fff1f2' },
    { name: 'Púrpura', dark: '#9333ea', light: '#faf5ff' },
    { name: 'Neon', dark: '#e11d48', light: '#18181b' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Painel Esquerdo: Entrada e Configurações */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card Entrada */}
          <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-slate-100">Conteúdo do QR Code</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">{content.length} caracteres</span>
            </div>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Digite texto, URL, mensagem, Wi-Fi, chave Pix ou qualquer dado..."
              rows={4}
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl p-3.5 text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
            />

            {/* Modelos Rápidos */}
            <div className="mt-4">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Modelos Pré-definidos
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setContent('https://')}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 hover:bg-slate-800 text-xs text-slate-200 rounded-lg border border-slate-700/60 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> URL / Site
                </button>
                <button
                  type="button"
                  onClick={() => setContent('WIFI:T:WPA;S:MinhaRede;P:SenhaForte123;;')}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 hover:bg-slate-800 text-xs text-slate-200 rounded-lg border border-slate-700/60 transition-all"
                >
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" /> Wi-Fi
                </button>
                <button
                  type="button"
                  onClick={() => setContent('mailto:contato@jyy.local?subject=Jyy')}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 hover:bg-slate-800 text-xs text-slate-200 rounded-lg border border-slate-700/60 transition-all"
                >
                  <Mail className="w-3.5 h-3.5 text-amber-400" /> E-mail
                </button>
                <button
                  type="button"
                  onClick={() => setContent('tel:+5511999998888')}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 hover:bg-slate-800 text-xs text-slate-200 rounded-lg border border-slate-700/60 transition-all"
                >
                  <Phone className="w-3.5 h-3.5 text-blue-400" /> Telefone
                </button>
                <button
                  type="button"
                  onClick={() => setContent('https://wa.me/5511999998888?text=Ola%20Jyy')}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 hover:bg-slate-800 text-xs text-slate-200 rounded-lg border border-slate-700/60 transition-all"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-green-400" /> WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setContent('BEGIN:VCARD\nVERSION:3.0\nFN:Usuario Jyy\nTEL:+5511999998888\nEND:VCARD')}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 hover:bg-slate-800 text-xs text-slate-200 rounded-lg border border-slate-700/60 transition-all"
                >
                  <User className="w-3.5 h-3.5 text-purple-400" /> Contato vCard
                </button>
                <button
                  type="button"
                  onClick={() => setContent('00020126360014BR.GOV.BCB.PIX0114+5511999999995204000053039865802BR5913Jyy6009Sao Paulo62070503***6304')}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 hover:bg-slate-800 text-xs text-slate-200 rounded-lg border border-slate-700/60 transition-all"
                >
                  <CreditCard className="w-3.5 h-3.5 text-cyan-400" /> Chave Pix
                </button>
                <button
                  type="button"
                  onClick={() => setContent('')}
                  className="flex items-center gap-2 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-xs text-rose-300 rounded-lg border border-rose-500/30 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Limpar
                </button>
              </div>
            </div>
          </div>

          {/* Card Configurações Visuais */}
          <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-400" />
              <h3 className="font-semibold text-slate-100">Personalização & Qualidade</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1.5">
                  Correção de Erro (ECC)
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['L', 'M', 'Q', 'H'] as ErrorCorrectionLevel[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setSettings({ ...settings, errorCorrectionLevel: lvl })}
                      className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                        settings.errorCorrectionLevel === lvl
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1.5">
                  Tamanho: {settings.size}px
                </label>
                <input
                  type="range"
                  min={180}
                  max={600}
                  step={20}
                  value={settings.size}
                  onChange={(e) => setSettings({ ...settings, size: Number(e.target.value) })}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Temas Rápidos */}
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-2">
                <Palette className="w-3.5 h-3.5 text-indigo-400" />
                <span>Paletas de Cores</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {themes.map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => setSettings({ ...settings, darkColor: t.dark, lightColor: t.light })}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50 text-xs text-slate-300 hover:bg-slate-800 transition-all"
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-slate-600"
                      style={{ background: `linear-gradient(135deg, ${t.dark} 50%, ${t.light} 50%)` }}
                    />
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Painel Direito: Visualizador e Download */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl flex flex-col items-center">
            <h3 className="font-semibold text-slate-100 mb-4 self-start flex items-center gap-2">
              <QrCode className="w-4 h-4 text-indigo-400" />
              <span>Visualização ao Vivo</span>
            </h3>

            {/* Canvas QR Code */}
            <div
              className="p-4 rounded-2xl shadow-2xl border border-slate-800 transition-transform duration-200"
              style={{ backgroundColor: settings.lightColor }}
            >
              <canvas ref={canvasRef} className="max-w-full h-auto block rounded-lg" />
            </div>

            {/* Ações de Download & Cópia */}
            <div className="w-full mt-6 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={downloadPNG}
                disabled={!qrDataUrl}
                className="flex items-center justify-center gap-2 px-3 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/25 transition-all"
              >
                <Download className="w-4 h-4" /> PNG
              </button>
              <button
                type="button"
                onClick={downloadSVG}
                disabled={!content.trim()}
                className="flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all"
              >
                <FileCode className="w-4 h-4 text-indigo-400" /> SVG
              </button>
              <button
                type="button"
                onClick={copyImage}
                disabled={!qrDataUrl}
                className="flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>

          {/* Scanner de QR Code Integrado */}
          <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>Scanner de QR Code</span>
              </h3>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {isScanning ? (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video border border-slate-800">
                  <video ref={videoRef} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 border-2 border-indigo-500/50 rounded-xl pointer-events-none animate-pulse" />
                </div>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg transition-all"
                >
                  Parar Câmera
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all"
                >
                  <Camera className="w-4 h-4 text-emerald-400" /> Usar Câmera
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all"
                >
                  <Upload className="w-4 h-4 text-indigo-400" /> Carregar Foto
                </button>
              </div>
            )}

            {cameraError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl">
                {cameraError}
              </div>
            )}

            {scannedResult && (
              <div className="p-3.5 bg-slate-950/80 border border-emerald-500/40 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" /> Conteúdo Detectado:
                  </span>
                  <button
                    type="button"
                    onClick={() => setContent(scannedResult)}
                    className="text-xs text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Usar no Gerador
                  </button>
                </div>
                <p className="text-xs font-mono text-slate-200 break-all select-all">{scannedResult}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Histórico Recente */}
      {history.length > 0 && (
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-sm text-slate-200">Histórico de Códigos Criados</h4>
            <button
              type="button"
              onClick={() => {
                setHistory([]);
                localStorage.removeItem('dl_qr_history');
              }}
              className="text-xs text-slate-400 hover:text-rose-400 transition-colors"
            >
              Limpar Histórico
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {history.map((h, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setContent(h.content)}
                className="text-left p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800/80 transition-all group"
              >
                <p className="text-xs font-mono text-slate-300 truncate group-hover:text-indigo-400">
                  {h.content}
                </p>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  {new Date(h.timestamp).toLocaleTimeString('pt-BR')}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
