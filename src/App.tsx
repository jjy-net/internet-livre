import { useState, useRef, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';

type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

// PWA Install types
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface QRSettings {
  errorCorrectionLevel: ErrorCorrectionLevel;
  size: number;
  margin: number;
  darkColor: string;
  lightColor: string;
}

function App() {
  const [content, setContent] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [settings, setSettings] = useState<QRSettings>({
    errorCorrectionLevel: 'M',
    size: 300,
    margin: 4,
    darkColor: '#000000',
    lightColor: '#ffffff',
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(true);
  const [history, setHistory] = useState<{ content: string; settings: QRSettings; timestamp: number }[]>([]);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generateQR = useCallback(async () => {
    if (!content.trim()) {
      setError('Por favor, insira algum conteúdo para gerar o QR Code.');
      return;
    }

    setIsGenerating(true);
    setError(null);

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

      const dataUrl = canvas.toDataURL('image/png');
      setQrDataUrl(dataUrl);

      // Add to history
      setHistory((prev) => {
        const newHistory = [
          { content: content.trim(), settings: { ...settings }, timestamp: Date.now() },
          ...prev.filter((h) => h.content !== content.trim()),
        ].slice(0, 20);
        return newHistory;
      });
    } catch (err) {
      setError('Erro ao gerar QR Code. Verifique o conteúdo e tente novamente.');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  }, [content, settings]);

  // Auto-generate on content change with debounce
  useEffect(() => {
    if (content.trim()) {
      const timer = setTimeout(() => {
        generateQR();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [content, settings]);

  // Handle paste event
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text');
      if (text) {
        setContent(text);
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  // PWA Install handling
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstallable(false);
      setIsInstalled(true);
    };

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      setShowInstallGuide(true);
      return;
    }

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstallable(false);
      setIsInstalled(true);
    }
  };

  const downloadQR = (format: 'png' | 'svg') => {
    if (!qrDataUrl) return;

    if (format === 'png') {
      const link = document.createElement('a');
      link.download = `qrcode-${Date.now()}.png`;
      link.href = qrDataUrl;
      link.click();
    } else {
      QRCode.toString(content.trim(), {
        type: 'svg',
        errorCorrectionLevel: settings.errorCorrectionLevel,
        width: settings.size,
        margin: settings.margin,
        color: {
          dark: settings.darkColor,
          light: settings.lightColor,
        },
      }).then((svg) => {
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `qrcode-${Date.now()}.svg`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      });
    }
  };

  const copyToClipboard = async () => {
    if (!qrDataUrl) return;
    try {
      const response = await fetch(qrDataUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
    } catch {
      // Fallback: copy data URL as text
      await navigator.clipboard.writeText(qrDataUrl);
    }
  };

  const loadFromHistory = (item: { content: string; settings: QRSettings }) => {
    setContent(item.content);
    setSettings(item.settings);
  };

  const errorCorrectionInfo: Record<ErrorCorrectionLevel, { label: string; description: string; percentage: string }> = {
    L: { label: 'Baixa (L)', description: 'Recupera ~7% dos dados', percentage: '7%' },
    M: { label: 'Média (M)', description: 'Recupera ~15% dos dados', percentage: '15%' },
    Q: { label: 'Quartil (Q)', description: 'Recupera ~25% dos dados', percentage: '25%' },
    H: { label: 'Alta (H)', description: 'Recupera ~30% dos dados', percentage: '30%' },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-sm bg-white/5">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold">Gerador de QR Code</h1>
              <p className="text-xs text-gray-400">Funciona 100% Offline</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30">
              ● Offline
            </span>
            {isInstalled ? (
              <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full border border-blue-500/30">
                ✓ Instalado
              </span>
            ) : isInstallable ? (
              <button
                onClick={handleInstall}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded-full border border-purple-500/50 transition-all flex items-center gap-1.5 shadow-lg shadow-purple-500/20"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Instalar App
              </button>
            ) : (
              <button
                onClick={() => setShowInstallGuide(true)}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-gray-300 text-xs rounded-full border border-white/10 transition-all"
              >
                📥 Como Instalar
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel - Input & Settings */}
          <div className="space-y-6">
            {/* Input Area */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Conteúdo
                </h2>
                <span className="text-xs text-gray-400">{content.length} caracteres</span>
              </div>

              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Cole ou digite aqui: texto, URL, senha, e-mail, telefone, Wi-Fi, qualquer conteúdo..."
                className="w-full h-40 bg-black/30 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 font-mono text-sm"
              />

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setContent('')}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-300 transition-all"
                >
                  Limpar
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.readText().then(setContent).catch(() => {});
                  }}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-300 transition-all"
                >
                  📋 Colar da Área de Transferência
                </button>
              </div>

              {error && (
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>

            {/* Settings */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="w-full flex items-center justify-between mb-4"
              >
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Configurações
                </h2>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${showSettings ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showSettings && (
                <div className="space-y-5">
                  {/* Error Correction Level */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Correção de Erro
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(errorCorrectionInfo) as ErrorCorrectionLevel[]).map((level) => (
                        <button
                          key={level}
                          onClick={() => setSettings({ ...settings, errorCorrectionLevel: level })}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            settings.errorCorrectionLevel === level
                              ? 'bg-purple-500/20 border-purple-500/50 ring-1 ring-purple-500/30'
                              : 'bg-white/5 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          <div className="font-semibold text-sm">{errorCorrectionInfo[level].label}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{errorCorrectionInfo[level].description}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Size */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Tamanho: {settings.size}px
                    </label>
                    <input
                      type="range"
                      min="100"
                      max="800"
                      step="50"
                      value={settings.size}
                      onChange={(e) => setSettings({ ...settings, size: parseInt(e.target.value) })}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>100px</span>
                      <span>800px</span>
                    </div>
                  </div>

                  {/* Margin */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Margem: {settings.margin} módulos
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="1"
                      value={settings.margin}
                      onChange={(e) => setSettings({ ...settings, margin: parseInt(e.target.value) })}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>

                  {/* Colors */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Cor Escura (QR)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={settings.darkColor}
                          onChange={(e) => setSettings({ ...settings, darkColor: e.target.value })}
                          className="w-10 h-10 rounded-lg border border-white/20 cursor-pointer bg-transparent"
                        />
                        <input
                          type="text"
                          value={settings.darkColor}
                          onChange={(e) => setSettings({ ...settings, darkColor: e.target.value })}
                          className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Cor Clara (Fundo)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={settings.lightColor}
                          onChange={(e) => setSettings({ ...settings, lightColor: e.target.value })}
                          className="w-10 h-10 rounded-lg border border-white/20 cursor-pointer bg-transparent"
                        />
                        <input
                          type="text"
                          value={settings.lightColor}
                          onChange={(e) => setSettings({ ...settings, lightColor: e.target.value })}
                          className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Preset Colors */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Temas Rápidos
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { dark: '#000000', light: '#ffffff', name: 'Clássico' },
                        { dark: '#1a1a2e', light: '#e0e0e0', name: 'Elegante' },
                        { dark: '#2d1b69', light: '#f0e6ff', name: 'Roxo' },
                        { dark: '#004d40', light: '#e0f2f1', name: 'Verde' },
                        { dark: '#b71c1c', light: '#ffebee', name: 'Vermelho' },
                        { dark: '#0d47a1', light: '#e3f2fd', name: 'Azul' },
                        { dark: '#e65100', light: '#fff3e0', name: 'Laranja' },
                        { dark: '#ffffff', light: '#1a1a1a', name: 'Invertido' },
                      ].map((preset) => (
                        <button
                          key={preset.name}
                          onClick={() =>
                            setSettings({
                              ...settings,
                              darkColor: preset.dark,
                              lightColor: preset.light,
                            })
                          }
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs transition-all"
                        >
                          <div
                            className="w-4 h-4 rounded border border-white/20"
                            style={{ background: `linear-gradient(135deg, ${preset.dark} 50%, ${preset.light} 50%)` }}
                          />
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Templates */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
                Modelos Rápidos
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setContent('https://')}
                  className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-left transition-all"
                >
                  <span className="text-lg">🔗</span>
                  <div className="text-xs text-gray-400 mt-1">URL / Link</div>
                </button>
                <button
                  onClick={() => setContent('WIFI:T:WPA;S:NomeDaRede;P:Senha;;')}
                  className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-left transition-all"
                >
                  <span className="text-lg">📶</span>
                  <div className="text-xs text-gray-400 mt-1">Wi-Fi</div>
                </button>
                <button
                  onClick={() => setContent('mailto:email@exemplo.com')}
                  className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-left transition-all"
                >
                  <span className="text-lg">📧</span>
                  <div className="text-xs text-gray-400 mt-1">E-mail</div>
                </button>
                <button
                  onClick={() => setContent('tel:+5511999999999')}
                  className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-left transition-all"
                >
                  <span className="text-lg">📱</span>
                  <div className="text-xs text-gray-400 mt-1">Telefone</div>
                </button>
                <button
                  onClick={() => setContent('BEGIN:VCARD\nVERSION:3.0\nFN:Nome\nTEL:+5511999999999\nEMAIL:email@exemplo.com\nEND:VCARD')}
                  className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-left transition-all"
                >
                  <span className="text-lg">👤</span>
                  <div className="text-xs text-gray-400 mt-1">Contato (vCard)</div>
                </button>
                <button
                  onClick={() => setContent('smsto:+5511999999999:Mensagem')}
                  className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-left transition-all"
                >
                  <span className="text-lg">💬</span>
                  <div className="text-xs text-gray-400 mt-1">SMS</div>
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel - QR Code Output */}
          <div className="space-y-6">
            {/* QR Code Display */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                QR Code Gerado
              </h2>

              <div className="flex flex-col items-center">
                <div
                  className="rounded-2xl overflow-hidden shadow-2xl shadow-purple-500/10 border border-white/10"
                  style={{ backgroundColor: settings.lightColor }}
                >
                  <canvas ref={canvasRef} className="block" />
                </div>

                {!qrDataUrl && !isGenerating && (
                  <div className="text-center py-12 text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    <p className="text-sm">Digite ou cole algo para gerar o QR Code</p>
                    <p className="text-xs mt-1 text-gray-600">Ctrl+V para colar rapidamente</p>
                  </div>
                )}

                {isGenerating && (
                  <div className="text-center py-12">
                    <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                    <p className="text-sm text-gray-400">Gerando...</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {qrDataUrl && (
                <div className="mt-6 flex flex-wrap gap-2 justify-center">
                  <button
                    onClick={() => downloadQR('png')}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-xl text-sm font-medium transition-all flex items-center gap-2 shadow-lg shadow-purple-500/20"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Baixar PNG
                  </button>
                  <button
                    onClick={() => downloadQR('svg')}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Baixar SVG
                  </button>
                  <button
                    onClick={copyToClipboard}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copiar Imagem
                  </button>
                </div>
              )}
            </div>

            {/* Info Panel */}
            {qrDataUrl && (
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Informações</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-black/20 rounded-lg p-3">
                    <div className="text-xs text-gray-500">Correção de Erro</div>
                    <div className="font-medium mt-0.5">{errorCorrectionInfo[settings.errorCorrectionLevel].label}</div>
                  </div>
                  <div className="bg-black/20 rounded-lg p-3">
                    <div className="text-xs text-gray-500">Tamanho</div>
                    <div className="font-medium mt-0.5">{settings.size} × {settings.size}px</div>
                  </div>
                  <div className="bg-black/20 rounded-lg p-3">
                    <div className="text-xs text-gray-500">Caracteres</div>
                    <div className="font-medium mt-0.5">{content.length}</div>
                  </div>
                  <div className="bg-black/20 rounded-lg p-3">
                    <div className="text-xs text-gray-500">Proteção</div>
                    <div className="font-medium mt-0.5">{errorCorrectionInfo[settings.errorCorrectionLevel].percentage} recuperação</div>
                  </div>
                </div>
              </div>
            )}

            {/* History */}
            {history.length > 0 && (
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Histórico Recente
                  </h3>
                  <button
                    onClick={() => setHistory([])}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    Limpar
                  </button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {history.map((item, index) => (
                    <button
                      key={item.timestamp}
                      onClick={() => loadFromHistory(item)}
                      className="w-full text-left p-3 bg-black/20 hover:bg-black/30 rounded-lg transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-300 truncate flex-1 mr-2">
                          {item.content.substring(0, 50)}{item.content.length > 50 ? '...' : ''}
                        </span>
                        <span className="text-xs text-gray-600 shrink-0">
                          Nível {item.settings.errorCorrectionLevel}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {new Date(item.timestamp).toLocaleTimeString('pt-BR')}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Install Guide Modal */}
        {showInstallGuide && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowInstallGuide(false)}>
            <div className="bg-gray-900 border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span className="text-2xl">💻</span>
                  Instalar no Windows 11
                </h2>
                <button
                  onClick={() => setShowInstallGuide(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                  <p className="text-sm text-purple-300">
                    <strong>💡 Dica rápida:</strong> Este app pode ser instalado como um programa no seu Windows 11! 
                    Ele terá ícone na área de trabalho e abrirá em janela própria, funcionando 100% offline.
                  </p>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-200">Como instalar:</h3>
                  
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 bg-purple-600 rounded-full flex items-center justify-center text-sm font-bold shrink-0">1</span>
                      <div>
                        <p className="font-medium text-gray-200">Usando Microsoft Edge</p>
                        <p className="text-sm text-gray-400 mt-1">
                          Clique no ícone de <strong>"..."</strong> no canto superior direito → <strong>"Apps"</strong> → <strong>"Instalar este site como aplicativo"</strong>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 bg-purple-600 rounded-full flex items-center justify-center text-sm font-bold shrink-0">2</span>
                      <div>
                        <p className="font-medium text-gray-200">Usando Google Chrome</p>
                        <p className="text-sm text-gray-400 mt-1">
                          Clique no ícone de <strong>instalação</strong> (⊕) na barra de endereço → <strong>"Instalar"</strong>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 bg-purple-600 rounded-full flex items-center justify-center text-sm font-bold shrink-0">3</span>
                      <div>
                        <p className="font-medium text-gray-200">Botão de Instalação</p>
                        <p className="text-sm text-gray-400 mt-1">
                          Se disponível, clique no botão <strong>"Instalar App"</strong> que aparece no topo da página
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mt-4">
                  <p className="text-sm text-green-300">
                    <strong>✅ Após instalar:</strong> O app aparecerá no Menu Iniciar e na Área de Trabalho. 
                    Funciona 100% offline, sem necessidade de internet!
                  </p>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                  <p className="text-sm text-blue-300">
                    <strong>📝 Nota:</strong> Para usar offline, acesse o app pelo menos uma vez com internet. 
                    Depois disso, funcionará mesmo sem conexão.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowInstallGuide(false)}
                className="w-full mt-6 px-4 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-medium transition-all"
              >
                Entendi!
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center text-gray-500 text-sm border-t border-white/5 pt-8">
          <p>🔒 Seus dados nunca saem do seu dispositivo. Tudo é processado localmente.</p>
          <p className="mt-1 text-xs text-gray-600">Funciona 100% offline • Sem rastreamento • Sem servidor</p>
          <p className="mt-2 text-xs text-gray-600">💡 Instale como app no Windows 11 para ter um "executável" offline</p>
        </footer>
      </main>
    </div>
  );
}

export default App;
