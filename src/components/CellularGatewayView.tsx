import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Radio,
  Wifi,
  Usb,
  Cpu,
  Layers,
  Activity,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Shield,
  Zap,
  Terminal,
  Copy,
  Check,
  Send,
  ArrowRight,
  Server,
  Lock,
  Compass,
  FileText,
  HelpCircle,
  Share2,
} from 'lucide-react';
import {
  GLINET_ROUTERS_CATALOG,
  GlinetRouterModel,
  TETHERING_MODES_INFO,
  CellularTetheringMode,
  TetheringModeInfo,
  CARRIER_APN_PRESETS,
  CarrierApnPreset,
  CellularSignalMetrics,
  classifySignalQuality,
  GLINET_TTL_MANGLE_SCRIPT,
  COMMON_CELLULAR_AT_COMMANDS,
  CellularAtCommandDef,
} from '../utils/cellularModemEngine';

export const CellularGatewayView: React.FC = () => {
  type CellularTab = 'dashboard' | 'tethering_guide' | 'glinet' | 'at_terminal' | 'bridge';
  const [activeTab, setActiveTab] = useState<CellularTab>('dashboard');

  // Estado da Conexão Celular
  const [selectedRouterId, setSelectedRouterId] = useState<string>('gl_x3000');
  const [selectedTetherMode, setSelectedTetherMode] = useState<CellularTetheringMode>('usb_tethering');
  const [selectedCarrierIndex, setSelectedCarrierIndex] = useState<number>(0);
  const [routerIp, setRouterIp] = useState<string>('192.168.8.1');

  // Telemetria Celular 5G em Tempo Real
  const [metrics, setMetrics] = useState<CellularSignalMetrics>({
    tech: '5G_SA',
    carrierName: 'Vivo Brasil',
    rsrpDbm: -76,
    rsrqDb: -9,
    sinrDb: 21.5,
    csq: 28,
    primaryBand: 'n78 (3.5 GHz 5G Standalone)',
    caBandsCount: 3,
    barsCount: 5,
    downloadMbps: 312.4,
    uploadMbps: 54.8,
    pingMs: 16,
    dataUsageMb: 1420.5,
  });

  const [isTrafficSimRunning, setIsTrafficSimRunning] = useState<boolean>(true);
  const [isCopiedTtl, setIsCopiedTtl] = useState<boolean>(false);

  // Terminal de Comandos AT
  const [atHistory, setAtHistory] = useState<{ cmd: string; resp: string; explanation?: string }[]>([
    {
      cmd: 'AT+CSQ',
      resp: '+CSQ: 28,99\nOK',
      explanation: 'Sinal Rádio: RSSI 28 de 31 (~ -57 dBm, Excelente).',
    },
    {
      cmd: 'AT+COPS?',
      resp: '+COPS: 0,0,"Vivo",11\nOK',
      explanation: 'Registrado na rede Vivo em modo 5G/NR (11).',
    },
    {
      cmd: 'AT+QNWINFO',
      resp: '+QNWINFO: "NR5G-SA","72406","NR5G BAND 78",627300\nOK',
      explanation: 'Conectado em 5G Standalone, Banda n78 (3.5 GHz), Canal 627300.',
    },
  ]);
  const [inputAtCommand, setInputAtCommand] = useState<string>('');

  // Opções de Ponte Jjy
  const [enableJjyCellularBridge, setEnableJjyCellularBridge] = useState<boolean>(true);
  const [useSecureDns, setUseSecureDns] = useState<boolean>(true);

  const currentRouter = GLINET_ROUTERS_CATALOG.find((r) => r.id === selectedRouterId) || GLINET_ROUTERS_CATALOG[0];
  const currentTether = TETHERING_MODES_INFO.find((t) => t.id === selectedTetherMode) || TETHERING_MODES_INFO[0];
  const currentApn = CARRIER_APN_PRESETS[selectedCarrierIndex] || CARRIER_APN_PRESETS[0];
  const signalQuality = classifySignalQuality(metrics.rsrpDbm);

  // Simulação de flutuação suave das métricas de sinal e tráfego
  useEffect(() => {
    if (!isTrafficSimRunning) return;
    const interval = setInterval(() => {
      setMetrics((prev) => {
        const jitterDl = (Math.random() - 0.5) * 15;
        const jitterUl = (Math.random() - 0.5) * 4;
        const deltaUsage = (prev.downloadMbps / 8) * 0.1;
        return {
          ...prev,
          downloadMbps: Math.max(10, Math.round((prev.downloadMbps + jitterDl) * 10) / 10),
          uploadMbps: Math.max(2, Math.round((prev.uploadMbps + jitterUl) * 10) / 10),
          pingMs: Math.max(12, Math.round(16 + (Math.random() - 0.5) * 4)),
          dataUsageMb: Math.round((prev.dataUsageMb + deltaUsage) * 10) / 10,
        };
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [isTrafficSimRunning]);

  // Enviar comando AT
  const handleSendAtCommand = () => {
    if (!inputAtCommand.trim()) return;
    const rawCmd = inputAtCommand.trim().toUpperCase();

    const matchedDef = COMMON_CELLULAR_AT_COMMANDS.find(
      (c) => c.command.toUpperCase() === rawCmd
    );

    let simulatedResponse = 'OK';
    let explanation = 'Comando aceito pelo modem celular.';

    if (matchedDef) {
      simulatedResponse = matchedDef.sampleResponse;
      explanation = matchedDef.explanation;
    } else if (rawCmd.startsWith('AT+CSQ')) {
      simulatedResponse = `+CSQ: ${metrics.csq},99\nOK`;
      explanation = `Sinal atual: ${metrics.csq} (~ ${metrics.rsrpDbm} dBm).`;
    } else if (rawCmd.startsWith('AT+COPS?')) {
      simulatedResponse = `+COPS: 0,0,"${currentApn.carrier}",11\nOK`;
      explanation = `Conectado na operadora ${currentApn.carrier}.`;
    } else if (rawCmd.startsWith('AT+QNWINFO')) {
      simulatedResponse = `+QNWINFO: "NR5G-SA","72406","NR5G BAND 78",627300\nOK`;
      explanation = `Tecnologia: 5G Standalone Banda n78 (3.5 GHz).`;
    } else {
      simulatedResponse = 'OK';
      explanation = 'Comando padrão executado.';
    }

    setAtHistory((prev) => [
      ...prev,
      { cmd: rawCmd, resp: simulatedResponse, explanation },
    ]);
    setInputAtCommand('');
  };

  // Copiar regras de TTL
  const handleCopyTtlRules = () => {
    navigator.clipboard.writeText(GLINET_TTL_MANGLE_SCRIPT);
    setIsCopiedTtl(true);
    setTimeout(() => setIsCopiedTtl(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Cyber-5G */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-emerald-950/40 to-slate-900 border border-emerald-800/40 p-6 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono uppercase tracking-wider flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" /> Gateway Celular 3G / 4G / 5G
              </span>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono">
                GL.iNet OpenWrt Compatible
              </span>
              <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[10px] font-mono">
                USB / Wi-Fi / Bluetooth Tethering
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Internet Celular & Roteadores GL.iNet</span>
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Use <strong>qualquer smartphone (Android / iPhone)</strong> ou roteador <strong>GL.iNet</strong> como um modem 5G de alta velocidade conectado ao Jjy via cabo USB (RNDIS/NCM), repetidor Wi-Fi (WISP) ou Bluetooth PAN com contorno de tethering TTL.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <a
              href={`http://${routerIp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs transition-all flex items-center gap-2 shadow-lg"
              title="Abre a interface Web do GL.iNet no navegador"
            >
              <ExternalLink className="w-4 h-4 text-cyan-400" />
              <span>Painel GL.iNet ({routerIp})</span>
            </a>
          </div>
        </div>
      </div>

      {/* Navegação entre Abas */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-800/80 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'dashboard'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Activity className="w-4 h-4 text-emerald-300" />
          <span>Telemetria & Sinal 5G</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tethering_guide')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'tethering_guide'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Smartphone className="w-4 h-4 text-cyan-300" />
          <span>Assistente Tethering Celular</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('glinet')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'glinet'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Server className="w-4 h-4 text-amber-300" />
          <span>Painel GL.iNet & Multi-WAN</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('at_terminal')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'at_terminal'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Terminal className="w-4 h-4 text-purple-300" />
          <span>Terminal de Comandos AT</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('bridge')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'bridge'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Share2 className="w-4 h-4 text-rose-300" />
          <span>Ponte de Internet Jjy</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* ABA 1: TELEMETRIA & PAINEL DE SINAL 5G                   */}
      {/* ======================================================== */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Cartões de Status de Sinal e Throughput */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Cartão de Velocidade de Download */}
            <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                <span>Taxa de Download</span>
                <span className="text-emerald-400 font-bold">5G SA</span>
              </div>
              <div className="text-3xl font-black font-mono text-emerald-300 flex items-baseline gap-1">
                <span>{metrics.downloadMbps}</span>
                <span className="text-xs text-slate-400 font-normal">Mbps</span>
              </div>
              <div className="flex justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
                <span>Upload: {metrics.uploadMbps} Mbps</span>
                <span className="text-sky-300">Ping: {metrics.pingMs} ms</span>
              </div>
            </div>

            {/* Cartão de RSRP / Força do Sinal */}
            <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                <span>Potência RSRP (Sinal)</span>
                <span className={`font-bold ${signalQuality.colorClass}`}>{signalQuality.rating}</span>
              </div>
              <div className="text-3xl font-black font-mono text-sky-300 flex items-baseline gap-1">
                <span>{metrics.rsrpDbm}</span>
                <span className="text-xs text-slate-400 font-normal">dBm</span>
              </div>
              <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800/80">
                {[1, 2, 3, 4, 5].map((bar) => (
                  <div
                    key={bar}
                    className={`h-2 flex-1 rounded-sm ${
                      bar <= metrics.barsCount ? 'bg-emerald-400' : 'bg-slate-800'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Cartão de RSRQ & SINR */}
            <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                <span>Qualidade SINR / RSRQ</span>
                <span className="text-purple-400 font-bold">MIMO 4x4</span>
              </div>
              <div className="text-3xl font-black font-mono text-purple-300 flex items-baseline gap-1">
                <span>+{metrics.sinrDb}</span>
                <span className="text-xs text-slate-400 font-normal">dB</span>
              </div>
              <div className="flex justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
                <span>RSRQ: {metrics.rsrqDb} dB</span>
                <span>CSQ: {metrics.csq}/31</span>
              </div>
            </div>

            {/* Cartão de Dados Trafegados */}
            <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
                <span>Consumo da Sessão</span>
                <span className="text-amber-400 font-bold">Tethering</span>
              </div>
              <div className="text-3xl font-black font-mono text-amber-300 flex items-baseline gap-1">
                <span>{(metrics.dataUsageMb / 1024).toFixed(2)}</span>
                <span className="text-xs text-slate-400 font-normal">GB</span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/80 truncate">
                Operadora: {metrics.carrierName}
              </div>
            </div>
          </div>

          {/* Detalhes da Banda e Agregação de Portadoras (Carrier Aggregation) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-4">
              <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                    <Radio className="w-4 h-4 text-emerald-400" /> Configuração Espectral & Bandas Conectadas
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    3CA Ativo (Agregação Tripla)
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-emerald-300 block">Portadora Primária (PCC):</span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        Banda n78 (3500 MHz) • 100 MHz de Largura de Banda (5G SA)
                      </span>
                    </div>
                    <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg text-[10px] font-mono font-bold">
                      256-QAM DL
                    </span>
                  </div>

                  <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-sky-300 block">Portadora Secundária 1 (SCC1):</span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        Banda B3 (1800 MHz LTE) • 20 MHz FDD
                      </span>
                    </div>
                    <span className="px-2 py-1 bg-sky-500/20 text-sky-300 rounded-lg text-[10px] font-mono font-bold">
                      64-QAM
                    </span>
                  </div>

                  <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-purple-300 block">Portadora Secundária 2 (SCC2):</span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        Banda B28 (700 MHz LTE APT) • 10 MHz FDD (Penetração em Edifícios)
                      </span>
                    </div>
                    <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded-lg text-[10px] font-mono font-bold">
                      64-QAM
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-4">
              <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
                <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" /> Perfil de APN da Operadora Móvel
                </h3>

                <div className="space-y-2">
                  <label className="text-xs font-mono text-slate-400">Selecionar Operadora:</label>
                  <select
                    value={selectedCarrierIndex}
                    onChange={(e) => {
                      const idx = parseInt(e.target.value);
                      setSelectedCarrierIndex(idx);
                      setMetrics((prev) => ({
                        ...prev,
                        carrierName: CARRIER_APN_PRESETS[idx].carrier,
                      }));
                    }}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 text-xs font-mono"
                  >
                    {CARRIER_APN_PRESETS.map((apn, i) => (
                      <option key={i} value={i}>
                        {apn.carrier} ({apn.country}) - {apn.apn}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">APN:</span>
                    <strong className="text-cyan-300">{currentApn.apn}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Protocolo IP:</span>
                    <strong className="text-slate-200">{currentApn.ipType} (Dual Stack)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Bandas Recomendadas:</span>
                    <span className="text-emerald-400 text-[10px] text-right truncate max-w-[200px]">
                      {currentApn.preferredBands}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 2: ASSISTENTE DE TETHERING DO CELULAR (PASSO A PASSO)*/}
      {/* ======================================================== */}
      {activeTab === 'tethering_guide' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-4">
            <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" /> Método de Conexão do Celular
              </h3>

              <div className="space-y-2">
                {TETHERING_MODES_INFO.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setSelectedTetherMode(mode.id)}
                    className={`w-full p-3.5 rounded-2xl border text-left transition-all ${
                      selectedTetherMode === mode.id
                        ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-md shadow-emerald-950'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-center text-xs font-bold mb-1">
                      <span className="text-emerald-300">{mode.name}</span>
                      <span className="text-[10px] font-mono text-slate-400">{mode.typicalMaxSpeed}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">{mode.description}</p>
                    <div className="flex gap-4 mt-2 text-[10px] font-mono text-slate-500">
                      <span>Latência: {mode.latencyMs}</span>
                      <span>Configuração: {mode.setupComplexity}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" /> Como Ativar no Smartphone ({currentTether.name})
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  Android & iPhone
                </span>
              </div>

              {/* Instruções Android */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2.5 text-xs">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <span>🤖</span> Celulares Android (Samsung, Xiaomi, Motorola, etc.)
                </span>
                <ol className="space-y-1.5 text-slate-300 text-[11px] list-decimal list-inside leading-relaxed">
                  {currentTether.stepsAndroid.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>

              {/* Instruções iOS */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2.5 text-xs">
                <span className="font-bold text-sky-400 flex items-center gap-1.5">
                  <span>🍎</span> Apple iPhone (iOS)
                </span>
                <ol className="space-y-1.5 text-slate-300 text-[11px] list-decimal list-inside leading-relaxed">
                  {currentTether.stepsIos.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>

              {/* Dica de Cabo de Dados */}
              <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-amber-900/40 text-xs text-amber-300/90 flex items-start gap-2.5">
                <Zap className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-[11px] leading-relaxed">
                  <strong>Atenção ao cabo USB:</strong> Certifique-se de utilizar um cabo USB de dados completo (Tipo-C ou Lightning certificado). Cabos baratos exclusivamente de carregamento não possuem as linhas D+ e D- necessárias para o tethering RNDIS.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 3: PAINEL GL.iNet & REGRAS DE MANGLE TTL OPENWRT     */}
      {/* ======================================================== */}
      {activeTab === 'glinet' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-4">
            <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <Server className="w-4 h-4 text-amber-400" /> Roteadores GL.iNet Suportados
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  OpenWrt Native
                </span>
              </div>

              <div className="space-y-2">
                {GLINET_ROUTERS_CATALOG.map((router) => (
                  <button
                    key={router.id}
                    type="button"
                    onClick={() => {
                      setSelectedRouterId(router.id);
                      setRouterIp(router.defaultIp);
                    }}
                    className={`w-full p-3.5 rounded-2xl border text-left transition-all ${
                      selectedRouterId === router.id
                        ? 'bg-amber-950/40 border-amber-500 text-white shadow-md shadow-amber-950'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-center text-xs font-bold mb-1">
                      <span className="text-amber-300">{router.name}</span>
                      <span className="text-[10px] font-mono text-slate-400">{router.category}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">{router.description}</p>
                    <div className="mt-1.5 flex gap-3 text-[10px] font-mono text-slate-500">
                      <span>IP Padrão: {router.defaultIp}</span>
                      <span>USB Tethering: Sim</span>
                      {router.internalCellularModem && <span className="text-emerald-400">Modem 5G Interno</span>}
                    </div>
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <label className="text-xs font-mono text-slate-400 block mb-1">Endereço IP do GL.iNet na Rede:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={routerIp}
                    onChange={(e) => setRouterIp(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white"
                  />
                  <a
                    href={`http://${routerIp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Acessar Painel Web</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-4">
            <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" /> TTL Mangle (Desbloqueio de Franquia Tethering)
                  </h3>
                  <p className="text-[11px] text-slate-400 pt-0.5">
                    Evite que as operadoras limitem ou bloqueiem a velocidade do roteamento celular.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCopyTtlRules}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                >
                  {isCopiedTtl ? <Check className="w-3.5 h-3.5 text-yellow-300" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopiedTtl ? 'Copiado!' : 'Copiar Script'}</span>
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                As operadoras verificam o campo TTL dos pacotes IP. Se o TTL for 63, elas detectam que o tráfego veio de um computador através de tethering e reduzem a velocidade. Ao fixar o <strong>TTL em 65</strong> no firewall do GL.iNet, o pacote chega à torre com TTL 64 idêntico a dados gerados dentro do próprio celular!
              </p>

              <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
                <pre className="p-4 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-[300px] leading-relaxed">
                  {GLINET_TTL_MANGLE_SCRIPT}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 4: TERMINAL DE COMANDOS AT CELULAR                   */}
      {/* ======================================================== */}
      {activeTab === 'at_terminal' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-4">
            <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 flex flex-col h-[520px]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-purple-400" />
                  <h3 className="font-bold text-sm text-slate-100">Console de Diagnóstico AT do Modem Celular</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setAtHistory([])}
                  className="text-[10px] font-mono text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
                >
                  Limpar Console
                </button>
              </div>

              {/* Histórico AT */}
              <div className="flex-1 overflow-y-auto space-y-3 font-mono text-xs py-4 pr-1">
                {atHistory.map((item, i) => (
                  <div key={i} className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80 space-y-1">
                    <div className="text-purple-300 font-bold flex items-center gap-1.5">
                      <span className="text-slate-500">&gt;</span> {item.cmd}
                    </div>
                    <pre className="text-emerald-300 text-[11px] whitespace-pre-wrap leading-relaxed">{item.resp}</pre>
                    {item.explanation && (
                      <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-900 font-sans">
                        💡 {item.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Campo de Envio de Comando AT */}
              <div className="pt-3 border-t border-slate-800 flex gap-2">
                <input
                  type="text"
                  value={inputAtCommand}
                  onChange={(e) => setInputAtCommand(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendAtCommand()}
                  placeholder="Digite comando AT (Ex: AT+CSQ, AT+COPS?, AT+QNWINFO)..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={handleSendAtCommand}
                  disabled={!inputAtCommand.trim()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Executar</span>
                </button>
              </div>
            </div>
          </div>

          {/* Comandos Rápidos Prontos */}
          <div className="lg:col-span-4 space-y-4">
            <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-3">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" /> Comandos AT Essenciais
              </h3>

              <div className="space-y-2">
                {COMMON_CELLULAR_AT_COMMANDS.map((cmdDef, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setInputAtCommand(cmdDef.command);
                    }}
                    className="w-full text-left p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs transition-all"
                  >
                    <div className="font-mono text-purple-300 font-bold">{cmdDef.command}</div>
                    <span className="text-[11px] text-slate-400 block">{cmdDef.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 5: PONTE DE INTERNET PARA A REDE JJY                 */}
      {/* ======================================================== */}
      {activeTab === 'bridge' && (
        <div className="space-y-5">
          <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-rose-400" /> Ponte de Internet Móvel ➔ Rede Jjy Mesh
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
                Cellular Gateway Active
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
              Compartilhe a conexão 3G/4G/5G do celular ou do roteador GL.iNet com todos os outros computadores e dispositivos conectados à rede local, ao rádio tático ou à malha LoRa.
            </p>

            <div className="space-y-3 max-w-xl">
              <label className="flex items-center justify-between p-4 bg-slate-950 rounded-2xl border border-slate-800 cursor-pointer">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-200 block">Ativar Gateway de Internet Celular</span>
                  <span className="text-[10px] text-slate-400">
                    Permite que nós sem internet na rede usem esta máquina como rota padrão.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={enableJjyCellularBridge}
                  onChange={(e) => setEnableJjyCellularBridge(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-slate-950 rounded-2xl border border-slate-800 cursor-pointer">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-200 block">DNS Seguro Criptografado (DoH)</span>
                  <span className="text-[10px] text-slate-400">
                    Cloudflare 1.1.1.1 / Quad9 para evitar monitoramento e censura da operadora.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={useSecureDns}
                  onChange={(e) => setUseSecureDns(e.target.checked)}
                  className="w-4 h-4 accent-cyan-500 rounded"
                />
              </label>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 text-xs font-mono">
              <span className="text-slate-400 block font-bold">Topologia de Compartilhamento Celular:</span>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                <span className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-emerald-400">
                  📱 Celular 5G (SIM / Antena)
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                <span className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-cyan-400">
                  ⚡ Cabo USB / Roteador GL.iNet
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                <span className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-purple-400">
                  🛡️ Jjy Host Gateway
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                <span className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-amber-400">
                  🌐 Rede Local & Mesh Off-Grid
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
