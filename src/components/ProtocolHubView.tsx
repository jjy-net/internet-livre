import React, { useState, useEffect, useRef } from 'react';
import {
  Share2,
  Cpu,
  Radio,
  Wifi,
  Waves,
  Lightbulb,
  Smartphone,
  Bluetooth,
  Volume2,
  VolumeX,
  QrCode,
  RadioTower,
  Satellite,
  Network,
  Shield,
  ShieldAlert,
  Flame,
  Cable,
  Download,
  Upload,
  Plus,
  Trash2,
  RefreshCw,
  Send,
  Zap,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Play,
  Sliders,
  Sparkles,
  Layers,
  Search,
  Filter,
  Terminal,
  Check,
  ChevronDown,
  ChevronUp,
  FileCode,
  Info,
} from 'lucide-react';
import {
  protocolHubEngine,
  ProtocolDefinition,
  ProtocolCategory,
  ProtocolStatus,
  RoutingStrategy,
  ProtocolBundle,
  TransmittedFrame,
  REGISTRY_AVAILABLE_PLUGINS,
  PROTOCOL_BUNDLES,
  calculateCrc32,
  stringToHexDump,
} from '../utils/protocolHubEngine';

// Sintetizador Web Audio API para feedback sonoro tático sci-fi
class SoundEffects {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public playBeep(freq = 880, type: OscillatorType = 'sine', duration = 0.08, volume = 0.1) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Audio não suportado ou bloqueado pelo navegador
    }
  }

  public playTxChirp() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1800, now + 0.15);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    } catch {
      // Ignorar erro
    }
  }

  public playAlert() {
    this.playBeep(440, 'triangle', 0.1, 0.15);
    setTimeout(() => this.playBeep(880, 'triangle', 0.15, 0.15), 100);
  }
}

const sfx = new SoundEffects();

export const ProtocolHubView: React.FC = () => {
  const [protocols, setProtocols] = useState<ProtocolDefinition[]>([]);
  const [activeTab, setActiveTab] = useState<'matrix' | 'dispatcher' | 'plugins' | 'builder' | 'bundles'>('matrix');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProtocolId, setSelectedProtocolId] = useState<string | null>(null);
  const [expandedConfigId, setExpandedConfigId] = useState<string | null>(null);

  // Roteador e Despachante
  const [routingStrategy, setRoutingStrategy] = useState<RoutingStrategy>('multipath_bonding');
  const [dispatcherText, setDispatcherText] = useState('SOS SINAIS VITAIS SOBREVIVENTE: SPO2 98% RPM 16 LOCAL: -23.5505,-46.6333 ALT: 760m');
  const [dispatcherTarget, setDispatcherTarget] = useState<string>('');
  const [dispatchHistory, setDispatchHistory] = useState<TransmittedFrame[]>([]);
  const [latestFrame, setLatestFrame] = useState<TransmittedFrame | null>(null);
  const [isTransmitting, setIsTransmitting] = useState(false);

  // Audio Mute
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Loja de Plugins
  const [registryPlugins, setRegistryPlugins] = useState<ProtocolDefinition[]>(REGISTRY_AVAILABLE_PLUGINS);
  const [installingPluginId, setInstallingPluginId] = useState<string | null>(null);

  // Criador de Plugins (Builder)
  const [customProto, setCustomProto] = useState({
    name: 'Tactical Drone DataLink V1',
    codeName: 'DRONE-LINK-V1',
    category: 'rf' as ProtocolCategory,
    carrier: '5.8 GHz Banda Analógica/Digital',
    rangeMax: '8.5 km',
    throughput: '25 Mbps Vídeo / 115 kbps Telemetria',
    mtuBytes: 512,
    nominalLatencyMs: 12,
    modulation: 'COFDM QPSK com Diversidade Espacial',
    cipher: 'ChaCha20-Poly1305 + HMAC',
    hardwareRequired: 'Transmissor VTX 5.8GHz / Dongle RTL-SDR',
    description: 'Protocolo de telemetria e vídeo de baixa latência para veículos aéreos não tripulados e drones de reconhecimento.',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refreshProtocols();
    setRoutingStrategy(protocolHubEngine.getRoutingStrategy());
    setDispatchHistory(protocolHubEngine.getHistory());
  }, []);

  const refreshProtocols = () => {
    setProtocols(protocolHubEngine.getAllProtocols());
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sfx.enabled = next;
    if (next) sfx.playBeep(1200, 'sine', 0.05);
  };

  const handleStatusChange = (id: string, newStatus: ProtocolStatus) => {
    protocolHubEngine.setProtocolStatus(id, newStatus);
    refreshProtocols();
    sfx.playBeep(newStatus === 'active' ? 900 : 400, 'sine', 0.06);
  };

  const handleStrategyChange = (st: RoutingStrategy) => {
    protocolHubEngine.setRoutingStrategy(st);
    setRoutingStrategy(st);
    sfx.playBeep(1000, 'triangle', 0.08);
  };

  const handleApplyBundle = (bundle: ProtocolBundle) => {
    protocolHubEngine.applyBundle(bundle.id);
    refreshProtocols();
    setRoutingStrategy(protocolHubEngine.getRoutingStrategy());
    sfx.playAlert();
    alert(`Conjunto "${bundle.name}" ativado com sucesso! Estratégia configurada para: ${bundle.routingStrategy.toUpperCase()}`);
  };

  const handleDispatch = () => {
    if (!dispatcherText.trim()) return;
    setIsTransmitting(true);
    sfx.playTxChirp();

    setTimeout(() => {
      const frame = protocolHubEngine.dispatchFrame(
        dispatcherText,
        dispatcherTarget || undefined,
        routingStrategy
      );
      setLatestFrame(frame);
      setDispatchHistory(protocolHubEngine.getHistory());
      refreshProtocols();
      setIsTransmitting(false);
      sfx.playBeep(1400, 'sine', 0.09);
    }, 400);
  };

  const handleInstallRegistryPlugin = (plugin: ProtocolDefinition) => {
    setInstallingPluginId(plugin.id);
    sfx.playBeep(700, 'triangle', 0.05);
    setTimeout(() => {
      protocolHubEngine.installPlugin({ ...plugin });
      refreshProtocols();
      setInstallingPluginId(null);
      sfx.playAlert();
    }, 800);
  };

  const handleUninstallPlugin = (id: string) => {
    if (confirm('Deseja realmente desinstalar este plugin de protocolo?')) {
      protocolHubEngine.uninstallPlugin(id);
      refreshProtocols();
      sfx.playBeep(350, 'sawtooth', 0.1);
    }
  };

  const handleCreateCustomProtocol = (e: React.FormEvent) => {
    e.preventDefault();
    const newId = 'custom_' + customProto.codeName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const newProto: ProtocolDefinition = {
      id: newId,
      name: customProto.name,
      codeName: customProto.codeName.toUpperCase(),
      category: customProto.category,
      layer: 'datalink',
      status: 'active',
      isPlugin: true,
      version: '1.0.0',
      author: 'Usuário Jyy (Studio Custom)',
      description: customProto.description,
      spec: {
        carrier: customProto.carrier,
        medium: 'Camada de Rádio / Óptica Customizada',
        rangeMax: customProto.rangeMax,
        throughput: customProto.throughput,
        nominalLatencyMs: Number(customProto.nominalLatencyMs) || 20,
        mtuBytes: Number(customProto.mtuBytes) || 256,
        modulation: customProto.modulation,
        cipher: customProto.cipher,
        hardwareRequired: customProto.hardwareRequired,
      },
      metrics: {
        txPackets: 0,
        rxPackets: 0,
        txBytes: 0,
        rxBytes: 0,
        latencyMs: Number(customProto.nominalLatencyMs) || 20,
        packetLossPercent: 0,
        linkHealth: 100,
        lastHeardIso: new Date().toISOString(),
      },
      config: {
        channelFreq: customProto.carrier,
        txPowerDbm: 20,
        fecRate: 'Reed-Solomon RS(255,223)',
        priorityWeight: 8,
        autoReconnect: true,
        stealthMode: false,
      },
      pluginSource: 'custom_uploaded',
      installedAt: new Date().toISOString(),
    };

    protocolHubEngine.installPlugin(newProto);
    refreshProtocols();
    sfx.playAlert();
    setActiveTab('matrix');
    alert(`Protocolo customizado "${newProto.name}" compilado e instalado no sistema!`);
  };

  const handleExportProtocol = (p: ProtocolDefinition) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(p, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `${p.codeName.toLowerCase()}-protocol.jyyproto`);
    dlAnchorElem.click();
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (parsed.id && parsed.name && parsed.spec) {
          protocolHubEngine.installPlugin(parsed);
          refreshProtocols();
          sfx.playAlert();
          alert(`Protocolo "${parsed.name}" importado e carregado no Omni-Bus com sucesso!`);
        } else {
          alert('Arquivo inválido: Não contém a assinatura de protocolo JYY.');
        }
      } catch {
        alert('Erro ao processar o arquivo .jyyproto.');
      }
    };
    reader.readAsText(file);
  };

  const handleKillSwitch = () => {
    if (confirm('🚨 ATIVAR SILÊNCIO RF / MODO STEALTH IMEDIATO?\nTodos os protocolos emissores de rádio e lasers serão colocados em Standby/Desativados instantaneamente para evasão de Guerra Eletrônica.')) {
      protocols.forEach((p) => {
        if (p.category === 'rf' || p.category === 'tactical' || p.category === 'cellular') {
          protocolHubEngine.setProtocolStatus(p.id, 'standby');
        }
      });
      protocolHubEngine.setRoutingStrategy('stealth_silent');
      setRoutingStrategy('stealth_silent');
      refreshProtocols();
      sfx.playBeep(220, 'sawtooth', 0.3);
      alert('Modo Stealth Engajado. Emissões de RF silenciadas.');
    }
  };

  const activeCount = protocols.filter((p) => p.status === 'active').length;
  const standbyCount = protocols.filter((p) => p.status === 'standby').length;
  const disabledCount = protocols.filter((p) => p.status === 'disabled').length;

  const filteredProtocols = protocols.filter((p) => {
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.codeName.toLowerCase().includes(q) ||
        p.spec.carrier.toLowerCase().includes(q) ||
        p.spec.modulation.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getCategoryIcon = (cat: ProtocolCategory) => {
    switch (cat) {
      case 'rf':
        return <Wifi className="w-4 h-4 text-cyan-400" />;
      case 'acoustic':
        return <Waves className="w-4 h-4 text-blue-400" />;
      case 'optical':
        return <Lightbulb className="w-4 h-4 text-emerald-400" />;
      case 'cellular':
        return <Smartphone className="w-4 h-4 text-green-400" />;
      case 'satellite':
        return <Satellite className="w-4 h-4 text-purple-400" />;
      case 'tactical':
        return <RadioTower className="w-4 h-4 text-amber-400" />;
      case 'wired':
        return <Cable className="w-4 h-4 text-indigo-400" />;
      case 'digital':
      default:
        return <Cpu className="w-4 h-4 text-pink-400" />;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* ==================================================================== */}
      {/* HEADER MASTER & BARRA TELEMÉTRICA CIBERNÉTICA                         */}
      {/* ==================================================================== */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/60 to-slate-950 border border-indigo-500/30 p-6 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                <Share2 className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                ARGON-4 HYPER-ROUTER ENGINE
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ● STATUS: OMNI-BUS ONLINE
              </span>
              <span className="text-[10px] font-mono text-slate-400 border border-slate-800 bg-slate-900/60 px-2 py-0.5 rounded-md">
                16 PROTOCOLOS CANÔNICOS + REPOSITÓRIO DINÂMICO
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              Matriz de Protocolos & Hub de Plugins
              <Sparkles className="w-6 h-6 text-indigo-400 animate-spin" style={{ animationDuration: '8s' }} />
            </h1>
            <p className="text-sm text-slate-300 max-w-3xl">
              Plataforma universal de transporte físico e digital: agregue rádio LoRa, Wi-Fi CSI Radar, ultrassom subaquático,
              laser óptico, satélites LEO, celular 5G e instale novos protocolos como plugins modulares a quente.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleToggleSound}
              className={`p-2.5 rounded-xl border transition-all flex items-center gap-2 text-xs font-semibold ${
                soundEnabled
                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 hover:bg-indigo-600/30'
                  : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:bg-slate-800'
              }`}
              title="Ativar/Desativar áudio tático sci-fi"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">{soundEnabled ? 'Sons Ativos' : 'Mudo'}</span>
            </button>

            <button
              onClick={handleKillSwitch}
              className="px-3.5 py-2.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/50 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-rose-900/20"
              title="Modo Furtivo Total: Desativa todas as transmissões de rádio"
            >
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Silêncio RF / Evasão</span>
            </button>

            <button
              onClick={() => {
                protocolHubEngine.resetToDefaults();
                refreshProtocols();
                sfx.playAlert();
              }}
              className="p-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold transition-all"
              title="Redefinir para os 16 protocolos canônicos"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* MTRX TELEMETRY CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Protocolos Ativos</div>
            <div className="text-xl font-bold text-emerald-400 flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              {activeCount} <span className="text-xs text-slate-500 font-normal">/ {protocols.length}</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Em Espera (Standby)</div>
            <div className="text-xl font-bold text-amber-400 mt-0.5">{standbyCount}</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Desativados</div>
            <div className="text-xl font-bold text-slate-400 mt-0.5">{disabledCount}</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Estratégia de Roteamento</div>
            <div className="text-xs font-bold text-cyan-400 mt-1 truncate uppercase">
              {routingStrategy.replace('_', ' ')}
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Saúde Agregada da Malha</div>
            <div className="text-xl font-bold text-indigo-400 mt-0.5">98.4%</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Modo Físico Híbrido</div>
            <div className="text-xs font-bold text-emerald-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              BONDING OK
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* DIAGRAMA TOPOLÓGICO VISUAL DE ENLACES FÍSICOS (SVG DINÂMICO)         */}
      {/* ==================================================================== */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-slate-800 gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Topologia Espacial Multi-Canal (Omni-Graph)
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Modo de Enlace:</span>
            <select
              value={routingStrategy}
              onChange={(e) => handleStrategyChange(e.target.value as RoutingStrategy)}
              className="bg-slate-950 border border-slate-700 text-cyan-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 font-mono"
            >
              <option value="multipath_bonding">Multipath Bonding (Fracionado)</option>
              <option value="omni_broadcast">Omni-Broadcast (Todos os canais)</option>
              <option value="cascading_fallback">Cascading Fallback (Prioridade)</option>
              <option value="best_metric">Best Metric (Menor Latência)</option>
              <option value="stealth_silent">Stealth Silent (Escuta Passiva)</option>
            </select>
          </div>
        </div>

        {/* SVG Híbrido Cibernético */}
        <div className="relative w-full h-48 md:h-56 bg-slate-950/80 rounded-xl border border-slate-800/80 overflow-hidden flex items-center justify-center">
          <svg className="w-full h-full" viewBox="0 0 800 240" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.8" />
              </linearGradient>
              <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Linhas de feixe interligando o centro aos nós físicos */}
            <line x1="400" y1="120" x2="100" y2="40" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="4 4" className="animate-pulse" />
            <line x1="400" y1="120" x2="250" y2="30" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="4 4" />
            <line x1="400" y1="120" x2="550" y2="30" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 4" />
            <line x1="400" y1="120" x2="700" y2="40" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="4 4" />
            <line x1="400" y1="120" x2="120" y2="200" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 4" />
            <line x1="400" y1="120" x2="280" y2="210" stroke="#ec4899" strokeWidth="1.5" strokeDasharray="4 4" />
            <line x1="400" y1="120" x2="520" y2="210" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="4 4" />
            <line x1="400" y1="120" x2="680" y2="200" stroke="#14b8a6" strokeWidth="1.5" strokeDasharray="4 4" />

            {/* Círculo Central Omni-Core */}
            <circle cx="400" cy="120" r="32" fill="#1e1b4b" stroke="url(#glowGrad)" strokeWidth="3" filter="url(#neonGlow)" />
            <circle cx="400" cy="120" r="16" fill="#4f46e5" className="animate-ping" opacity="0.3" />
            <text x="400" y="117" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">JYY OMNI</text>
            <text x="400" y="129" textAnchor="middle" fill="#38bdf8" fontSize="8" fontFamily="monospace">ROUTER</text>

            {/* Nós Periféricos com Labels */}
            {/* Nó 1: LoRa Sub-GHz */}
            <circle cx="100" cy="40" r="18" fill="#082f49" stroke="#06b6d4" strokeWidth="2" />
            <text x="100" y="43" textAnchor="middle" fill="#38bdf8" fontSize="8" fontWeight="bold">LoRa 915M</text>

            {/* Nó 2: Acústico Submarino */}
            <circle cx="250" cy="30" r="18" fill="#172554" stroke="#3b82f6" strokeWidth="2" />
            <text x="250" y="33" textAnchor="middle" fill="#60a5fa" fontSize="8" fontWeight="bold">Acústico 28k</text>

            {/* Nó 3: Óptico LiFi */}
            <circle cx="550" cy="30" r="18" fill="#064e3b" stroke="#10b981" strokeWidth="2" />
            <text x="550" y="33" textAnchor="middle" fill="#34d399" fontSize="8" fontWeight="bold">Laser 532nm</text>

            {/* Nó 4: Satélite Iridium */}
            <circle cx="700" cy="40" r="18" fill="#3b0764" stroke="#a855f7" strokeWidth="2" />
            <text x="700" y="43" textAnchor="middle" fill="#c084fc" fontSize="8" fontWeight="bold">Satélite LEO</text>

            {/* Nó 5: Rádio HF/VHF */}
            <circle cx="120" cy="200" r="18" fill="#451a03" stroke="#f59e0b" strokeWidth="2" />
            <text x="120" y="203" textAnchor="middle" fill="#fbbf24" fontSize="8" fontWeight="bold">HF APRS</text>

            {/* Nó 6: Som Aéreo GGWave */}
            <circle cx="280" cy="210" r="18" fill="#500724" stroke="#ec4899" strokeWidth="2" />
            <text x="280" y="213" textAnchor="middle" fill="#f472b6" fontSize="8" fontWeight="bold">Som 19kHz</text>

            {/* Nó 7: Wi-Fi CSI Radar */}
            <circle cx="520" cy="210" r="18" fill="#1e1b4b" stroke="#6366f1" strokeWidth="2" />
            <text x="520" y="213" textAnchor="middle" fill="#818cf8" fontSize="8" fontWeight="bold">Wi-Fi 802.11</text>

            {/* Nó 8: Celular 5G GL.iNet */}
            <circle cx="680" cy="200" r="18" fill="#042f2e" stroke="#14b8a6" strokeWidth="2" />
            <text x="680" y="203" textAnchor="middle" fill="#2dd4bf" fontSize="8" fontWeight="bold">5G GL.iNet</text>
          </svg>

          {/* Dica do Hub */}
          <div className="absolute bottom-2 right-3 text-[10px] font-mono text-slate-400 bg-slate-900/90 px-2.5 py-1 rounded-md border border-slate-800">
            Multi-Path Dynamic Cross-Bonding: ATIVO
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* ABAS PRINCIPAIS DO OMNI-HUB                                          */}
      {/* ==================================================================== */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto scrollbar-none pb-1">
        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'matrix'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-500'
              : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Network className="w-4 h-4 text-cyan-400" />
          <span>Matriz de Protocolos ({protocols.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('dispatcher')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'dispatcher'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-500'
              : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span>Despachante & Barramento de Pacotes</span>
          {dispatchHistory.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px]">
              {dispatchHistory.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('plugins')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'plugins'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-500'
              : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Download className="w-4 h-4 text-purple-400" />
          <span>Loja de Plugins ({registryPlugins.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('builder')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'builder'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-500'
              : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <FileCode className="w-4 h-4 text-amber-400" />
          <span>Criador de Protocolo / Studio</span>
        </button>

        <button
          onClick={() => setActiveTab('bundles')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'bundles'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-500'
              : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Zap className="w-4 h-4 text-rose-400" />
          <span>Conjuntos Táticos & Presets ({PROTOCOL_BUNDLES.length})</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* ABA 1: MATRIZ DE PROTOCOLOS                                          */}
      {/* ==================================================================== */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          {/* Barra de Filtros e Busca */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2 flex-1 max-w-md bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por protocolo, modulação, frequência..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-full"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-white text-xs">
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'rf', label: 'Rádio RF' },
                { id: 'acoustic', label: 'Acústico/Submarino' },
                { id: 'optical', label: 'Óptico/Luz' },
                { id: 'cellular', label: 'Celular 5G' },
                { id: 'satellite', label: 'Satélite' },
                { id: 'tactical', label: 'Tático' },
                { id: 'digital', label: 'Digital/P2P' },
                { id: 'wired', label: 'Cabo/USB' },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setCategoryFilter(filter.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    categoryFilter === filter.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid de Cards dos Protocolos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProtocols.map((proto) => {
              const isConfigExpanded = expandedConfigId === proto.id;

              return (
                <div
                  key={proto.id}
                  className={`relative rounded-xl border transition-all flex flex-col justify-between overflow-hidden ${
                    proto.status === 'active'
                      ? 'bg-slate-900/90 border-slate-700/80 hover:border-indigo-500/60 shadow-lg'
                      : proto.status === 'standby'
                      ? 'bg-slate-950/70 border-amber-900/40 opacity-80'
                      : 'bg-slate-950/40 border-slate-900 opacity-50'
                  }`}
                >
                  {/* Indicador de Status Superior */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700">
                          {getCategoryIcon(proto.category)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-white">{proto.name}</h3>
                            {proto.isPlugin && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                PLUGIN
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-cyan-400">{proto.codeName}</div>
                        </div>
                      </div>

                      {/* Botões de Troca Rápida de Estado */}
                      <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                        <button
                          onClick={() => handleStatusChange(proto.id, 'active')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                            proto.status === 'active'
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-500 hover:text-emerald-400'
                          }`}
                          title="Ativar protocolo na malha"
                        >
                          ON
                        </button>
                        <button
                          onClick={() => handleStatusChange(proto.id, 'standby')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                            proto.status === 'standby'
                              ? 'bg-amber-600 text-white'
                              : 'text-slate-500 hover:text-amber-400'
                          }`}
                          title="Colocar em espera (standby)"
                        >
                          STBY
                        </button>
                        <button
                          onClick={() => handleStatusChange(proto.id, 'disabled')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                            proto.status === 'disabled'
                              ? 'bg-rose-600 text-white'
                              : 'text-slate-500 hover:text-rose-400'
                          }`}
                          title="Desativar completamente"
                        >
                          OFF
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                      {proto.description}
                    </p>

                    {/* Especificações Técnicas em Miniatura */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80">
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase">Portadora/Freq</span>
                        <span className="text-cyan-300 truncate block">{proto.spec.carrier}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase">Throughput</span>
                        <span className="text-emerald-300 truncate block">{proto.spec.throughput}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase">Alcance Máximo</span>
                        <span className="text-indigo-300 truncate block">{proto.spec.rangeMax}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase">Latência Nominal</span>
                        <span className="text-amber-300 truncate block">{proto.spec.nominalLatencyMs} ms</span>
                      </div>
                    </div>

                    {/* Métricas ao Vivo */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-slate-400">Saúde do Enlace:</span>
                        <span className="text-emerald-400 font-bold">{proto.metrics.linkHealth}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full"
                          style={{ width: `${proto.metrics.linkHealth}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-0.5">
                        <span>TX: {proto.metrics.txPackets} pkts</span>
                        <span>RX: {proto.metrics.rxPackets} pkts</span>
                        <span>Perda: {proto.metrics.packetLossPercent}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Rodapé do Card com Ações */}
                  <div className="bg-slate-950/90 border-t border-slate-800/80 px-4 py-2.5 flex items-center justify-between">
                    <button
                      onClick={() => setExpandedConfigId(isConfigExpanded ? null : proto.id)}
                      className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>{isConfigExpanded ? 'Ocultar Ajustes' : 'Parâmetros'}</span>
                      {isConfigExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setDispatcherTarget(proto.id);
                          setActiveTab('dispatcher');
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        title="Despachar pacote específico por este protocolo"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleExportProtocol(proto)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        title="Exportar manifesto .jyyproto"
                      >
                        <Upload className="w-3.5 h-3.5" />
                      </button>

                      {proto.isPlugin && (
                        <button
                          onClick={() => handleUninstallPlugin(proto.id)}
                          className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 transition-colors"
                          title="Desinstalar plugin"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Painel Expansível de Ajustes do Protocolo */}
                  {isConfigExpanded && (
                    <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3 text-xs animate-fadeIn">
                      <div className="space-y-1">
                        <label className="text-slate-400 text-[11px] font-mono block">Canal / Frequência:</label>
                        <input
                          type="text"
                          value={proto.config.channelFreq}
                          onChange={(e) => {
                            protocolHubEngine.updateProtocolConfig(proto.id, { channelFreq: e.target.value });
                            refreshProtocols();
                          }}
                          className="w-full bg-slate-900 border border-slate-800 text-cyan-300 px-2 py-1.5 rounded text-xs font-mono focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-slate-400 text-[11px] font-mono block">
                            Potência TX ({proto.config.txPowerDbm} dBm):
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="40"
                            value={proto.config.txPowerDbm}
                            onChange={(e) => {
                              protocolHubEngine.updateProtocolConfig(proto.id, { txPowerDbm: Number(e.target.value) });
                              refreshProtocols();
                            }}
                            className="w-full accent-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="text-slate-400 text-[11px] font-mono block">
                            Prioridade ({proto.config.priorityWeight}/10):
                          </label>
                          <input
                            type="range"
                            min="1"
                            max="10"
                            value={proto.config.priorityWeight}
                            onChange={(e) => {
                              protocolHubEngine.updateProtocolConfig(proto.id, { priorityWeight: Number(e.target.value) });
                              refreshProtocols();
                            }}
                            className="w-full accent-cyan-500"
                          />
                        </div>
                      </div>

                      <div className="pt-1 flex items-center justify-between text-[11px] font-mono text-slate-400">
                        <span>Criptografia:</span>
                        <span className="text-indigo-400">{proto.spec.cipher}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                        <span>Hardware Mínimo:</span>
                        <span className="text-slate-300 truncate max-w-[180px]">{proto.spec.hardwareRequired}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ABA 2: DESPACHANTE & BARRAMENTO DE PACOTES (TERMINAL OMNI)           */}
      {/* ==================================================================== */}
      {activeTab === 'dispatcher' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Painel de Transmissão */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-emerald-400" />
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      Despachante Unificado Omni-Bus
                    </h2>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    SISTEMA EM COMUNICAÇÃO ATIVA
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Mensagem / Payload Tático para Transmissão:
                  </label>
                  <textarea
                    rows={4}
                    value={dispatcherText}
                    onChange={(e) => setDispatcherText(e.target.value)}
                    placeholder="Digite a mensagem, comando em texto ou coordenadas para enviar na rede..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />

                  {/* Sugestões Rápidas de Payload */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      'SOS SOBREVIVENTE SINAIS VITAIS OK',
                      'PING DISCOVERY MESH REQ ALL_NODES',
                      'GPS COORDS: -23.5505,-46.6333 ALT:760m',
                      'ENCRYPTED ONION ROUTE TEST ML-KEM',
                    ].map((sug, i) => (
                      <button
                        key={i}
                        onClick={() => setDispatcherText(sug)}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[10px] font-mono transition-colors"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Canal de Saída:
                    </label>
                    <select
                      value={dispatcherTarget}
                      onChange={(e) => setDispatcherTarget(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl p-2.5 focus:outline-none focus:border-indigo-500 font-mono"
                    >
                      <option value="">Roteamento Automático (Seguir Estratégia Ativa)</option>
                      {protocols
                        .filter((p) => p.status === 'active')
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} [{p.spec.carrier}]
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Estratégia de Transporte:
                    </label>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300 flex items-center justify-between">
                      <span className="uppercase">{routingStrategy.replace('_', ' ')}</span>
                      <span className="text-[10px] text-emerald-400">● ATIVA</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleDispatch}
                  disabled={isTransmitting}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  {isTransmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Transpondo Enlaces Físicos & Injetando Frames...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-amber-300" />
                      <span>Transmitir Pacote no Barramento Omni</span>
                    </>
                  )}
                </button>
              </div>

              {/* Inspetor de Frame Recente (Hex Dump & Header) */}
              {latestFrame && (
                <div className="bg-slate-900/90 border border-indigo-500/40 rounded-2xl p-5 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-indigo-400" />
                      <h3 className="text-xs font-bold text-white uppercase font-mono">
                        Frame Canônico JYY-V4: {latestFrame.id}
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                      CRC32: 0x{latestFrame.crc32Hex} | LATÊNCIA: {latestFrame.latencyMs} ms
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] font-mono text-slate-400 uppercase">Hex Dump do Payload:</div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 break-all select-all">
                      {latestFrame.payloadHex}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] font-mono text-slate-400 uppercase">Log de Rastreamento de Saltos:</div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1 max-h-40 overflow-y-auto">
                      {latestFrame.logTrace.map((log, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-cyan-500">▶</span>
                          <span>{log}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Histórico Recente de Transmissões */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    Histórico de Disparos
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    {dispatchHistory.length} frames
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {dispatchHistory.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs">
                      Nenhum pacote transmitido ainda nesta sessão.
                    </div>
                  ) : (
                    dispatchHistory.map((h) => (
                      <div
                        key={h.id}
                        className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1.5 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-indigo-400 font-bold">{h.id}</span>
                          <span className="text-slate-500">{new Date(h.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-xs text-white truncate font-mono">{h.payloadText}</p>
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
                          <span className="text-cyan-400">{h.routingMode.toUpperCase()}</span>
                          <span className="text-emerald-400">CRC 0x{h.crc32Hex}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 text-center">
                <span className="text-[11px] text-slate-500 font-mono">
                  Compatível com Repasse em Camadas Físicas Simultâneas
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ABA 3: LOJA DE PLUGINS & REGISTRO DE PROTOCOLOS                      */}
      {/* ==================================================================== */}
      {activeTab === 'plugins' && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Download className="w-5 h-5 text-purple-400" />
                Repositório de Plugins de Protocolo
              </h2>
              <p className="text-xs text-slate-300">
                Baixe e instale drivers e codecs de protocolos militares, satelitais e industriais com um clique.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportFile}
                accept=".jyyproto,.json"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all flex items-center gap-2"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Importar Arquivo .jyyproto</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {registryPlugins.map((plugin) => {
              const isInstalled = protocols.some((p) => p.id === plugin.id);
              const isInstalling = installingPluginId === plugin.id;

              return (
                <div
                  key={plugin.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all shadow-md"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-slate-800 border border-slate-700">
                          {getCategoryIcon(plugin.category)}
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-white">{plugin.name}</h3>
                          <span className="text-[10px] font-mono text-purple-400">{plugin.codeName}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                        v{plugin.version}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {plugin.description}
                    </p>

                    <div className="space-y-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 font-mono text-[11px]">
                      <div className="flex justify-between text-slate-400">
                        <span>Portadora:</span>
                        <span className="text-cyan-300">{plugin.spec.carrier}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Throughput:</span>
                        <span className="text-emerald-300">{plugin.spec.throughput}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Hardware:</span>
                        <span className="text-slate-300 truncate max-w-[150px]">{plugin.spec.hardwareRequired}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    {isInstalled ? (
                      <div className="w-full py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center text-xs font-bold text-emerald-400 flex items-center justify-center gap-1.5">
                        <Check className="w-4 h-4" />
                        <span>Instalado na Matriz</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleInstallRegistryPlugin(plugin)}
                        disabled={isInstalling}
                        className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-purple-600/20 disabled:opacity-50"
                      >
                        {isInstalling ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Carregando Driver...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            <span>Instalar Plugin</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ABA 4: CRIADOR DE PROTOCOLOS / PLUGIN STUDIO                         */}
      {/* ==================================================================== */}
      {activeTab === 'builder' && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-1">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileCode className="w-5 h-5 text-amber-400" />
              Plugin Studio: Crie e Compile Novos Protocolos
            </h2>
            <p className="text-xs text-slate-300">
              Defina parâmetros físicos, taxas de transmissão, MTU e especificações de modulação para integrar hardware personalizado à rede Jyy.
            </p>
          </div>

          <form onSubmit={handleCreateCustomProtocol} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Nome do Protocolo:</label>
                <input
                  type="text"
                  required
                  value={customProto.name}
                  onChange={(e) => setCustomProto({ ...customProto, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded-xl p-2.5 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Codinome / ID:</label>
                <input
                  type="text"
                  required
                  value={customProto.codeName}
                  onChange={(e) => setCustomProto({ ...customProto, codeName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-cyan-400 text-xs rounded-xl p-2.5 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Categoria Física:</label>
                <select
                  value={customProto.category}
                  onChange={(e) => setCustomProto({ ...customProto, category: e.target.value as ProtocolCategory })}
                  className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded-xl p-2.5 focus:outline-none focus:border-indigo-500"
                >
                  <option value="rf">Rádio RF (Sub-GHz / Micro-ondas)</option>
                  <option value="acoustic">Acústico / Ultrassom Aquático e Aéreo</option>
                  <option value="optical">Óptico / Laser / FSO / LiFi</option>
                  <option value="cellular">Rede Celular WAN / 4G / 5G</option>
                  <option value="satellite">Satélite Orbital LEO / GEO</option>
                  <option value="tactical">Tático Militar / HF NVIS / APRS</option>
                  <option value="wired">Cabo / USB / Serial / Ethernet</option>
                  <option value="digital">Digital / P2P / WebRTC</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Portadora / Frequência:</label>
                <input
                  type="text"
                  required
                  value={customProto.carrier}
                  onChange={(e) => setCustomProto({ ...customProto, carrier: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded-xl p-2.5 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Alcance Máximo:</label>
                <input
                  type="text"
                  required
                  value={customProto.rangeMax}
                  onChange={(e) => setCustomProto({ ...customProto, rangeMax: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded-xl p-2.5 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Vazão (Throughput):</label>
                <input
                  type="text"
                  required
                  value={customProto.throughput}
                  onChange={(e) => setCustomProto({ ...customProto, throughput: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-emerald-400 text-xs rounded-xl p-2.5 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Modulação:</label>
                <input
                  type="text"
                  required
                  value={customProto.modulation}
                  onChange={(e) => setCustomProto({ ...customProto, modulation: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded-xl p-2.5 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Criptografia / Cifra:</label>
                <input
                  type="text"
                  required
                  value={customProto.cipher}
                  onChange={(e) => setCustomProto({ ...customProto, cipher: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded-xl p-2.5 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-semibold text-slate-300 block">Hardware Necessário:</label>
                <input
                  type="text"
                  required
                  value={customProto.hardwareRequired}
                  onChange={(e) => setCustomProto({ ...customProto, hardwareRequired: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded-xl p-2.5 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-semibold text-slate-300 block">Descrição e Aplicação:</label>
                <textarea
                  rows={2}
                  required
                  value={customProto.description}
                  onChange={(e) => setCustomProto({ ...customProto, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded-xl p-2.5 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3 border-t border-slate-800">
              <button
                type="submit"
                className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>Compilar & Instalar Plugin no Sistema</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ABA 5: CONJUNTOS TÁTICOS & PRESETS (PROTOCOL BUNDLES)                */}
      {/* ==================================================================== */}
      {activeTab === 'bundles' && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-1">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-rose-400" />
              Conjuntos Táticos & Presets Operacionais
            </h2>
            <p className="text-xs text-slate-300">
              Ative instantaneamente suites completas de protocolos otimizadas para missões específicas (desastres, submarino, stealth, urbana ou espacial).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {PROTOCOL_BUNDLES.map((bundle) => {
              return (
                <div
                  key={bundle.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all shadow-xl"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                        {bundle.category.toUpperCase()}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">{bundle.code}</span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-white">{bundle.name}</h3>
                      <p className="text-xs text-indigo-300 mt-0.5">{bundle.tagline}</p>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      {bundle.recommendedUse}
                    </p>

                    <div className="space-y-1.5 pt-2">
                      <span className="text-[10px] font-mono text-slate-400 uppercase block">
                        Protocolos Integrados ({bundle.targetProtocolIds.length}):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {bundle.targetProtocolIds.map((pid) => {
                          const proto = protocols.find((p) => p.id === pid);
                          return (
                            <span
                              key={pid}
                              className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-cyan-300 border border-slate-800"
                            >
                              {proto?.codeName || pid}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleApplyBundle(bundle)}
                    className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-rose-600 hover:from-indigo-500 hover:to-rose-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-900/20"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Engajar Conjunto {bundle.name}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
