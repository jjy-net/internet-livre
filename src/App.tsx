import React, { useState, useEffect } from 'react';
import {
  QrCode,
  MessageSquare,
  Layers,
  Volume2,
  Lightbulb,
  Shield,
  Image as ImageIcon,
  Radio,
  Download,
  Info,
  CheckCircle2,
  Lock,
  ExternalLink,
  ShieldAlert,
  Camera,
  Cpu,
  Satellite,
  RadioTower,
  Waves,
  Smartphone,
  Wifi,
  Flame,
  Share2,
  Globe,
  Unlock,
  BookOpen,
  Fingerprint,
  Shuffle,
  Check,
  Copy,
  X,
} from 'lucide-react';
import { getPrivacyShieldManager } from './utils/antiFingerprintEngine';
import { QRStudio } from './components/QRStudio';
import { ChatLAN } from './components/ChatLAN';
import { FileTransfer } from './components/FileTransfer';
import { AudioModemView } from './components/AudioModemView';
import { LightModemView } from './components/LightModemView';
import { CryptoToolsView } from './components/CryptoToolsView';
import { StegoToolsView } from './components/StegoToolsView';
import { NetworkHubView } from './components/NetworkHubView';
import { AdminDashboard } from './components/AdminDashboard';
import { RemoteMonitorView } from './components/RemoteMonitorView';
import { EmergencyAlertModal } from './components/EmergencyAlertModal';
import { JjyMeshProtocolView } from './components/JjyMeshProtocolView';
import { SatelliteInternetView } from './components/SatelliteInternetView';
import { TacticalRadioView } from './components/TacticalRadioView';
import { UnderwaterInternetView } from './components/UnderwaterInternetView';
import { LoraMeshView } from './components/LoraMeshView';
import { CellularGatewayView } from './components/CellularGatewayView';
import { WifiRadarView } from './components/WifiRadarView';
import { DisasterInternetView } from './components/DisasterInternetView';
import { ProtocolHubView } from './components/ProtocolHubView';
import { Earth3dMapView } from './components/Earth3dMapView';
import { FreeInternetManifestoView } from './components/FreeInternetManifestoView';
import { DocumentationProjectView } from './components/DocumentationProjectView';

type ActiveTab = 'globe' | 'free_internet' | 'docs' | 'qr' | 'chat' | 'files' | 'sound' | 'light' | 'crypto' | 'stego' | 'network' | 'mesh' | 'protocols' | 'satellite' | 'radio' | 'underwater' | 'lora' | 'cellular' | 'wifi' | 'disaster' | 'remote' | 'admin';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('globe');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [currentSyntheticMac, setCurrentSyntheticMac] = useState(
    getPrivacyShieldManager().getMacState().currentMac
  );
  const [copiedMac, setCopiedMac] = useState(false);

  useEffect(() => {
    const unsub = getPrivacyShieldManager().subscribe(({ macState }) => {
      setCurrentSyntheticMac(macState.currentMac);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstallable(false);
      setIsInstalled(true);
    };

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
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

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'globe', label: 'Globo 3D (Início)', icon: <Globe className="w-4 h-4 text-emerald-400" />, badge: 'Principal' },
    { id: 'free_internet', label: 'Nossa Internet Livre', icon: <Unlock className="w-4 h-4 text-cyan-400" />, badge: 'Soberana' },
    { id: 'docs', label: 'Documentação do Projeto', icon: <BookOpen className="w-4 h-4 text-amber-400" />, badge: 'Docs' },
    { id: 'chat', label: 'Chat LAN', icon: <MessageSquare className="w-4 h-4" />, badge: 'P2P' },
    { id: 'qr', label: 'QR Studio', icon: <QrCode className="w-4 h-4" /> },
    { id: 'files', label: 'Arquivos Chunks', icon: <Layers className="w-4 h-4" /> },
    { id: 'sound', label: 'Modem de Som', icon: <Volume2 className="w-4 h-4" /> },
    { id: 'light', label: 'Modem de Luz', icon: <Lightbulb className="w-4 h-4" /> },
    { id: 'crypto', label: 'Criptografia', icon: <Shield className="w-4 h-4" /> },
    { id: 'stego', label: 'Esteganografia', icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'network', label: 'Rede & Servidor', icon: <Radio className="w-4 h-4" /> },
    { id: 'mesh', label: 'Protocolo JJY Mesh', icon: <Cpu className="w-4 h-4 text-cyan-400" />, badge: 'Core' },
    { id: 'protocols', label: 'Protocolos & Plugins', icon: <Share2 className="w-4 h-4 text-violet-400" />, badge: 'Omni' },
    { id: 'satellite', label: 'Internet Satélite & SDR', icon: <Satellite className="w-4 h-4 text-sky-400" />, badge: 'Orbital' },
    { id: 'radio', label: 'Rádio UHF/VHF & HF', icon: <RadioTower className="w-4 h-4 text-emerald-400" />, badge: 'RF' },
    { id: 'underwater', label: 'Internet Subaquática', icon: <Waves className="w-4 h-4 text-cyan-400" />, badge: 'Subsea' },
    { id: 'lora', label: 'Rádio LoRa & Meshtastic', icon: <Radio className="w-4 h-4 text-emerald-400" />, badge: 'LoRa' },
    { id: 'cellular', label: 'Internet Celular 4G/5G & GL.iNet', icon: <Smartphone className="w-4 h-4 text-emerald-400" />, badge: '5G' },
    { id: 'wifi', label: 'Wi-Fi Radar & Visão RF', icon: <Wifi className="w-4 h-4 text-cyan-400" />, badge: 'Radar' },
    { id: 'disaster', label: 'Internet Guerra & Desastres', icon: <Flame className="w-4 h-4 text-amber-500" />, badge: 'Tático' },
    { id: 'remote', label: 'Câmera & Transmissor', icon: <Camera className="w-4 h-4 text-emerald-400" />, badge: 'Sensor' },
    { id: 'admin', label: 'Administrador (Recepção)', icon: <ShieldAlert className="w-4 h-4 text-rose-400" />, badge: 'Admin' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base tracking-tight text-white">Jjy</h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                  v2.0.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Suite de Transmissão & Comunicação Offline</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPrivacyModal(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all cursor-pointer"
              title="Blindagem de Identidade: MAC & Anti-Fingerprint Ativos"
            >
              <Fingerprint className="w-3.5 h-3.5 text-cyan-400" />
              <span>Shield: {currentSyntheticMac.slice(0, 8)}...</span>
            </button>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              100% Offline
            </span>

            {isInstalled ? (
              <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 text-xs rounded-full border border-indigo-500/30 font-medium">
                ✓ Instalado
              </span>
            ) : isInstallable ? (
              <button
                type="button"
                onClick={handleInstallClick}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all"
              >
                <Download className="w-3.5 h-3.5" /> Instalar App
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowInstallGuide(true)}
                className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700 transition-all"
              >
                <Info className="w-3.5 h-3.5" /> Como Instalar
              </button>
            )}

            <a
              href="/Jjy.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white text-xs font-semibold rounded-xl shadow-md transition-all"
              title="Abrir Perguntas e Mensagens Anônimas Jjy"
            >
              🔥 Jjy Anônimo
            </a>
          </div>
        </div>

        {/* Barra de Navegação Horizontal das Ferramentas */}
        <div className="max-w-7xl mx-auto px-4 overflow-x-auto scrollbar-none flex gap-1.5 pb-2 pt-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 border border-indigo-500'
                    : 'bg-slate-900/60 hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-indigo-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full">
        {activeTab === 'globe' && <Earth3dMapView />}
        {activeTab === 'free_internet' && (
          <FreeInternetManifestoView
            onNavigateToGlobe={() => setActiveTab('globe')}
            onNavigateToProtocols={() => setActiveTab('protocols')}
          />
        )}
        {activeTab === 'docs' && (
          <DocumentationProjectView
            onNavigateToGlobe={() => setActiveTab('globe')}
            onNavigateToFreeInternet={() => setActiveTab('free_internet')}
            onNavigateToProtocols={() => setActiveTab('protocols')}
            onNavigateToWifi={() => setActiveTab('wifi')}
          />
        )}
        {activeTab === 'chat' && <ChatLAN />}
        {activeTab === 'qr' && <QRStudio />}
        {activeTab === 'files' && <FileTransfer />}
        {activeTab === 'sound' && <AudioModemView />}
        {activeTab === 'light' && <LightModemView />}
        {activeTab === 'crypto' && <CryptoToolsView />}
        {activeTab === 'stego' && <StegoToolsView />}
        {activeTab === 'network' && <NetworkHubView />}
        {activeTab === 'mesh' && <JjyMeshProtocolView />}
        {activeTab === 'protocols' && <ProtocolHubView />}
        {activeTab === 'satellite' && <SatelliteInternetView />}
        {activeTab === 'radio' && <TacticalRadioView />}
        {activeTab === 'underwater' && <UnderwaterInternetView />}
        {activeTab === 'lora' && <LoraMeshView />}
        {activeTab === 'cellular' && <CellularGatewayView />}
        {activeTab === 'wifi' && <WifiRadarView />}
        {activeTab === 'disaster' && <DisasterInternetView />}
        {activeTab === 'remote' && <RemoteMonitorView />}
        {activeTab === 'admin' && <AdminDashboard />}
      </main>

      {/* Modal de Instalação PWA / Desktop */}
      {showInstallGuide && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowInstallGuide(false)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <span>💻</span> Instalação como Aplicativo Desktop
              </h3>
              <button
                type="button"
                onClick={() => setShowInstallGuide(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              O Jjy pode ser executado e instalado de três maneiras fáceis:
            </p>

            <div className="space-y-2.5">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-xs font-bold text-indigo-400 block mb-0.5">1. PWA no Navegador (Chrome / Edge)</span>
                <span className="text-[11px] text-slate-400">
                  Clique no ícone de instalar na barra de endereços (⊕) ou no botão &quot;Instalar App&quot;.
                </span>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-xs font-bold text-emerald-400 block mb-0.5">2. Executável Portable (.EXE)</span>
                <span className="text-[11px] text-slate-400">
                  Execute o script <code>criar-executavel.bat</code> na pasta para gerar o executável standalone do Windows na pasta <code>release/</code>.
                </span>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-xs font-bold text-purple-400 block mb-0.5">3. Servidor de Rede Local</span>
                <span className="text-[11px] text-slate-400">
                  Dê duplo clique em <code>iniciar-servidor.bat</code> para permitir que qualquer celular ou PC na mesma rede acesse via Wi-Fi.
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowInstallGuide(false)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all"
            >
              Entendido!
            </button>
          </div>
        </div>
      )}

      {/* Modal de Blindagem de Identidade & Anti-Fingerprint */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-cyan-800/60 rounded-3xl max-w-md w-full p-6 shadow-2xl shadow-cyan-950/60 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5 text-cyan-400">
                <div className="p-2.5 rounded-2xl bg-cyan-950 border border-cyan-600/50">
                  <Fingerprint className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-100 tracking-wide">
                    Blindagem de MAC & Impressão Digital
                  </h3>
                  <span className="text-[11px] text-cyan-400 font-semibold">IEEE 802 LAA / Anti-Fingerprint Ativo</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Sua estação está navegando com identidade ofuscada. Rastreadores, operadores de rede maliciosos e scripts de fingerprinting recebem dados sintéticos efêmeros.
            </p>

            <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Endereço MAC Efêmero:</span>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950 px-1.5 py-0.2 rounded border border-emerald-800">
                  LAA Ativo
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-base font-bold text-cyan-300">{currentSyntheticMac}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(currentSyntheticMac);
                    setCopiedMac(true);
                    setTimeout(() => setCopiedMac(false), 2000);
                  }}
                  className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 text-xs flex items-center gap-1"
                >
                  {copiedMac ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80">
                <span className="text-slate-500 block text-[10px] font-bold">CANVAS POISONING</span>
                <span className="text-emerald-400 font-semibold">Ativo (Ruído LSB)</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80">
                <span className="text-slate-500 block text-[10px] font-bold">GPU WEBGL</span>
                <span className="text-emerald-400 font-semibold">Camuflada (Intel UHD)</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80">
                <span className="text-slate-500 block text-[10px] font-bold">AUDIOCONTEXT</span>
                <span className="text-emerald-400 font-semibold">Jitter DSP Ativo</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80">
                <span className="text-slate-500 block text-[10px] font-bold">WEBRTC LAN SHIELD</span>
                <span className="text-emerald-400 font-semibold">Host IP Bloqueado</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const newMac = getPrivacyShieldManager().rotateMacNow();
                  setCurrentSyntheticMac(newMac);
                }}
                className="flex-1 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Rotacionar MAC Agora</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowPrivacyModal(false);
                  setActiveTab('admin');
                }}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-all"
              >
                Painel SOC
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up de Emergência e Alertas do Administrador (Ativo globalmente com sirene e confirmação) */}
      <EmergencyAlertModal isAdmin={activeTab === 'admin'} />

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 bg-slate-950/80 text-center text-[11px] text-slate-500">
        <p>🔒 100% Offline • Criptografia Nativa Web Crypto • Seus dados nunca saem do seu computador ou rede local.</p>
      </footer>
    </div>
  );
};

export default App;
