import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Activity,
  Radio,
  Signal,
  Battery,
  Compass,
  MapPin,
  Cpu,
  Terminal,
  QrCode,
  Layers,
  Play,
  Pause,
  Download,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Copy,
  Check,
  ArrowRight,
  Zap,
  Shield,
  Sun,
  Droplets,
  Thermometer,
  Gauge,
  Wind,
  Wifi,
  Usb,
  Share2,
  FileText,
  BarChart3,
  Navigation,
  Globe,
  SlidersHorizontal,
  Network,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import QRCode from 'qrcode';

import {
  calculateBearingDegrees,
  calculateDistanceKm,
  executeTracerouteSimulation,
  exportPacketsToCsv,
  exportPacketsToJson,
  generateMeshtasticShareUrl,
  getLqiQuality,
  INITIAL_ALERTS,
  INITIAL_MONITOR_CHANNELS,
  INITIAL_MONITOR_NODES,
  INITIAL_MONITOR_PACKETS,
  INITIAL_TELEMETRY_SERIES,
  MeshAlert,
  MeshChannelConfig,
  MeshNodeInfo,
  MeshPacket,
  NodeRole,
  PacketType,
  TracerouteResult,
} from '../utils/meshMonitorEngine';

export interface MeshMonitorViewProps {
  onNavigateToMesh?: () => void;
  onNavigateToLora?: () => void;
}

type MonitorTab = 'telemetria' | 'topologia' | 'diretorio' | 'traceroute' | 'sniffer' | 'canais' | 'ponte';

export const MeshMonitorView: React.FC<MeshMonitorViewProps> = ({
  onNavigateToMesh,
  onNavigateToLora,
}) => {
  // Estado Principal
  const [activeTab, setActiveTab] = useState<MonitorTab>('telemetria');
  const [nodes, setNodes] = useState<MeshNodeInfo[]>(INITIAL_MONITOR_NODES);
  const [packets, setPackets] = useState<MeshPacket[]>(INITIAL_MONITOR_PACKETS);
  const [channels, setChannels] = useState<MeshChannelConfig[]>(INITIAL_MONITOR_CHANNELS);
  const [selectedChannelIndex, setSelectedChannelIndex] = useState<number>(0);
  const [alerts, setAlerts] = useState<MeshAlert[]>(INITIAL_ALERTS);

  // Conectividade
  const [connectionMode, setConnectionMode] = useState<'simulator' | 'webserial' | 'tcp' | 'mqtt'>('simulator');
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isSimulatingTraffic, setIsSimulatingTraffic] = useState<boolean>(true);
  const [tcpHost, setTcpHost] = useState<string>('192.168.4.1');
  const [tcpPort, setTcpPort] = useState<number>(4403);
  const [baudRate, setBaudRate] = useState<number>(115200);

  // Seleções e Filtros
  const [selectedNodeId, setSelectedNodeId] = useState<string>(INITIAL_MONITOR_NODES[0].id);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');
  const [packetTypeFilter, setPacketTypeFilter] = useState<string>('ALL');
  const [isSnifferPaused, setIsSnifferPaused] = useState<boolean>(false);
  const [selectedPacket, setSelectedPacket] = useState<MeshPacket | null>(INITIAL_MONITOR_PACKETS[0]);

  // Traceroute
  const [tracerouteTargetId, setTracerouteTargetId] = useState<string>(INITIAL_MONITOR_NODES[1].id);
  const [tracerouteResult, setTracerouteResult] = useState<TracerouteResult | null>(null);
  const [isExecutingTraceroute, setIsExecutingTraceroute] = useState<boolean>(false);

  // QR Code de Canal Meshtastic
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedPsk, setCopiedPsk] = useState<boolean>(false);
  const [copiedShareUrl, setCopiedShareUrl] = useState<boolean>(false);

  // Nó Local
  const localNode = useMemo(() => nodes.find((n) => n.isLocal) || nodes[0], [nodes]);
  const activeChannel = useMemo(() => channels[selectedChannelIndex] || channels[0], [channels, selectedChannelIndex]);
  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId) || localNode, [nodes, selectedNodeId, localNode]);

  // Estatísticas Agregadas
  const onlineCount = useMemo(() => nodes.filter((n) => Date.now() - n.lastHeard < 300000).length, [nodes]);
  const avgSnr = useMemo(() => {
    if (nodes.length === 0) return 0;
    const total = nodes.reduce((acc, curr) => acc + curr.snr, 0);
    return Math.round((total / nodes.length) * 10) / 10;
  }, [nodes]);
  const avgRssi = useMemo(() => {
    if (nodes.length === 0) return 0;
    const total = nodes.reduce((acc, curr) => acc + curr.rssi, 0);
    return Math.round(total / nodes.length);
  }, [nodes]);

  // Geração do QR Code quando o canal muda
  useEffect(() => {
    const url = generateMeshtasticShareUrl(activeChannel);
    QRCode.toDataURL(url, {
      width: 256,
      margin: 2,
      color: {
        dark: '#0284c7', // cyan-600
        light: '#020617', // slate-950
      },
    })
      .then((dataUrl) => setQrCodeDataUrl(dataUrl))
      .catch((err) => console.error('Erro ao gerar QR Code Meshtastic:', err));
  }, [activeChannel]);

  // Loop de Simulação de Tráfego em Segundo Plano (quando ativo)
  useEffect(() => {
    if (!isSimulatingTraffic || !isConnected) return;

    const interval = setInterval(() => {
      // Simula flutuação leve de telemetria
      setNodes((prevNodes) =>
        prevNodes.map((n) => {
          if (n.isLocal) {
            return {
              ...n,
              lastHeard: Date.now(),
              voltage: Math.round((4.16 + (Math.sin(Date.now() / 20000) * 0.03)) * 100) / 100,
            };
          }
          return n;
        })
      );

      // Gera um pacote aleatório se sniffer não estiver pausado
      if (!isSnifferPaused) {
        const types: PacketType[] = ['TELEMETRY_APP', 'TEXT_MESSAGE_APP', 'POSITION_APP', 'ROUTING_APP'];
        const randomType = types[Math.floor(Math.random() * types.length)];
        const randomFromIndex = 1 + Math.floor(Math.random() * (nodes.length - 1));
        const sender = nodes[randomFromIndex] || nodes[1];

        let summary = 'Pacote recebido da malha';
        if (randomType === 'TELEMETRY_APP') {
          summary = `Bat: ${sender.batteryPercent}% (${sender.voltage}V) • SNR: ${sender.snr}dB`;
        } else if (randomType === 'POSITION_APP' && sender.position) {
          summary = `Pos: ${sender.position.lat.toFixed(4)}, ${sender.position.lon.toFixed(4)} Alt: ${sender.position.alt}m`;
        } else if (randomType === 'TEXT_MESSAGE_APP') {
          summary = `Msg Cifrada: [E2EE Canal #${activeChannel.name}] "Beacon periódico OK"`;
        } else if (randomType === 'ROUTING_APP') {
          summary = `Roteamento: Descoberta de vizinhança (${sender.neighborCount} enlaces ativos)`;
        }

        const newPkt: MeshPacket = {
          id: `pkt_${Date.now().toString(36)}`,
          timestamp: Date.now(),
          from: sender.id,
          fromName: sender.shortName,
          to: randomType === 'TEXT_MESSAGE_APP' ? localNode.id : '^all',
          toName: randomType === 'TEXT_MESSAGE_APP' ? localNode.shortName : 'Broadcast Geral',
          channelName: `#${activeChannel.name}`,
          type: randomType,
          hopLimit: 3,
          hopStart: sender.hopsAway,
          snr: Math.round((sender.snr + (Math.random() * 2 - 1)) * 10) / 10,
          rssi: sender.rssi + Math.floor(Math.random() * 4 - 2),
          payloadSummary: summary,
          crcOk: true,
        };

        setPackets((prev) => [newPkt, ...prev.slice(0, 49)]);
      }
    }, 7000);

    return () => clearInterval(interval);
  }, [isSimulatingTraffic, isConnected, isSnifferPaused, nodes, activeChannel, localNode]);

  // Função para Disparar Traceroute
  const handleRunTraceroute = () => {
    setIsExecutingTraceroute(true);
    setTracerouteResult(null);

    setTimeout(() => {
      const result = executeTracerouteSimulation(tracerouteTargetId, nodes);
      setTracerouteResult(result);
      setIsExecutingTraceroute(false);

      // Adiciona aos pacotes do sniffer
      const traceroutePkt: MeshPacket = {
        id: `pkt_tr_${Date.now().toString(36)}`,
        timestamp: Date.now(),
        from: localNode.id,
        fromName: localNode.shortName,
        to: result.targetId,
        toName: result.targetName,
        channelName: `#${activeChannel.name}`,
        type: 'TRACEROUTE_APP',
        hopLimit: 3,
        hopStart: 0,
        snr: localNode.snr,
        rssi: localNode.rssi,
        payloadSummary: `Traceroute concluído: ${result.hops.length} saltos, RTT: ${result.totalRttMs}ms`,
        crcOk: true,
      };
      setPackets((prev) => [traceroutePkt, ...prev]);
    }, 1200);
  };

  // Exportadores de Arquivo
  const handleDownloadJson = () => {
    const jsonStr = exportPacketsToJson(packets);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meshmonitor-packets-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = () => {
    const csvStr = exportPacketsToCsv(packets);
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meshmonitor-packets-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Conexão WebSerial Real (se suportado pelo navegador)
  const handleConnectWebSerial = async () => {
    if (!('serial' in navigator)) {
      alert('A Web Serial API não é suportada neste navegador. Utilize Google Chrome, Microsoft Edge ou Opera.');
      return;
    }
    try {
      // @ts-expect-error WebSerial navigator type
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate });
      setConnectionMode('webserial');
      setIsConnected(true);
      alert('Conectado com sucesso à porta serial USB do rádio Meshtastic!');
    } catch (err) {
      console.error('Falha na conexão WebSerial:', err);
    }
  };

  // Gerador de Nova Chave AES-256 para o Canal
  const handleGenerateNewPsk = () => {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    let binary = '';
    randomBytes.forEach((b) => (binary += String.fromCharCode(b)));
    const base64Psk = btoa(binary);

    setChannels((prev) =>
      prev.map((c, idx) =>
        idx === selectedChannelIndex
          ? { ...c, psk: base64Psk, pskType: 'custom_aes256' }
          : c
      )
    );
  };

  // Nós filtrados
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      const matchRole = selectedRoleFilter === 'ALL' || n.role === selectedRoleFilter;
      const matchSearch =
        n.shortName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.longName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.hardware.toLowerCase().includes(searchQuery.toLowerCase());
      return matchRole && matchSearch;
    });
  }, [nodes, selectedRoleFilter, searchQuery]);

  // Pacotes filtrados no sniffer
  const filteredPackets = useMemo(() => {
    return packets.filter((p) => {
      if (packetTypeFilter === 'ALL') return true;
      return p.type === packetTypeFilter;
    });
  }, [packets, packetTypeFilter]);

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* ==================================================================== */}
      {/* BARRA SUPERIOR / STATUS DA MALHA & NÓ MESTRE                        */}
      {/* ==================================================================== */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Título & Badge de Status */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500/20 via-cyan-500/20 to-blue-600/20 border border-emerald-500/40 text-emerald-400 shadow-lg shadow-emerald-500/10">
              <Activity className="w-6 h-6 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-slate-950 animate-ping" />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                  MeshMonitor
                  <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-semibold">
                    Meshtastic v2.5+
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-400">
                Monitoramento Completo de Telemetria, Topologia e Rádio LoRa JJY
              </p>
            </div>
          </div>

          {/* Nó Local & Conexão */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <Radio className="w-4 h-4 text-cyan-400" />
              <div>
                <span className="text-slate-400">Nó Mestre:</span>{' '}
                <strong className="text-white">{localNode.shortName}</strong>
                <span className="text-slate-500 text-[11px] ml-1">({localNode.hardware.split(' ')[0]})</span>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <Battery className="w-4 h-4 text-emerald-400" />
              <span>
                <strong className="text-emerald-400">{localNode.batteryPercent}%</strong>{' '}
                <span className="text-slate-400">({localNode.voltage}V)</span>
              </span>
              {localNode.isCharging && (
                <span className="text-[10px] text-amber-300 flex items-center gap-0.5 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  <Sun className="w-3 h-3" /> +{localNode.solarCurrentMa}mA
                </span>
              )}
            </div>

            <button
              onClick={() => setIsConnected(!isConnected)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer border ${
                isConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
              }`}
              title="Alternar estado de conexão com o rádio"
            >
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              {isConnected ? (connectionMode === 'simulator' ? 'Simulador Ativo' : 'Rádio Online') : 'Desconectado'}
            </button>

            {/* Links rápidos para módulos relacionados */}
            {onNavigateToMesh && (
              <button
                onClick={onNavigateToMesh}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 border border-slate-700 transition-colors"
                title="Abrir Protocolo JJY Mesh"
              >
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">JJY Mesh</span>
              </button>
            )}
            {onNavigateToLora && (
              <button
                onClick={onNavigateToLora}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 border border-slate-700 transition-colors"
                title="Abrir Console LoRa & Meshtastic"
              >
                <Radio className="w-3.5 h-3.5 text-purple-400" />
                <span className="hidden sm:inline">LoRa Chat</span>
              </button>
            )}
            <a
              href="#reticulum"
              className="px-2.5 py-1.5 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 text-xs font-semibold flex items-center gap-1 border border-indigo-500/40 transition-colors"
              title="Abrir Reticulum Network Stack (RNS)"
            >
              <Network className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Reticulum</span>
            </a>
          </div>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* 5 CARDS DE MÉTRICAS RÁPIDAS (KPIs)                                  */}
      {/* ==================================================================== */}
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {/* KPI 1: Nós Online */}
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Nós na Malha</span>
              <Signal className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{onlineCount}</span>
              <span className="text-xs text-slate-400">/ {nodes.length} nós</span>
            </div>
            <div className="mt-1 text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              100% de cobertura
            </div>
          </div>

          {/* KPI 2: Ocupação do Canal */}
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Airtime Canal</span>
              <Gauge className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">12.4%</span>
              <span className="text-[11px] text-slate-400">TX: 2.1%</span>
            </div>
            <div className="mt-1 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-1.5 rounded-full" style={{ width: '12.4%' }} />
            </div>
          </div>

          {/* KPI 3: Qualidade de Enlace (SNR/RSSI) */}
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Enlace Médio (LQI)</span>
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-400">+{avgSnr}</span>
              <span className="text-xs text-slate-400">dB SNR</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400 font-mono">
              RSSI: <span className="text-cyan-300">{avgRssi} dBm</span>
            </div>
          </div>

          {/* KPI 4: Pacotes Capturados */}
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Pacotes Sniffados</span>
              <Terminal className="w-4 h-4 text-purple-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{packets.length}</span>
              <span className="text-[11px] text-purple-400 font-semibold">100% CRC OK</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Taxa PDR: <strong className="text-emerald-400">99.2%</strong>
            </div>
          </div>

          {/* KPI 5: Canal LoRa Ativo */}
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm shadow-sm flex flex-col justify-between col-span-2 md:col-span-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Canal Ativo</span>
              <Shield className="w-4 h-4 text-sky-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-xl font-black text-cyan-300 truncate">#{activeChannel.name}</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400 flex items-center justify-between">
              <span>915.0 MHz</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono">LongFast</span>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* ABAS DO MESHMONITOR                                                 */}
      {/* ==================================================================== */}
      <nav className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-slate-800">
          <button
            onClick={() => setActiveTab('telemetria')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'telemetria'
                ? 'bg-slate-900 text-cyan-400 border-cyan-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/50'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Telemetria & Gráficos 24h</span>
          </button>

          <button
            onClick={() => setActiveTab('topologia')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'topologia'
                ? 'bg-slate-900 text-emerald-400 border-emerald-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/50'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Topologia & Radar RF</span>
          </button>

          <button
            onClick={() => setActiveTab('diretorio')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'diretorio'
                ? 'bg-slate-900 text-purple-400 border-purple-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/50'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Diretório & Sensores ({nodes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('traceroute')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'traceroute'
                ? 'bg-slate-900 text-amber-400 border-amber-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/50'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Traceroute Hop-by-Hop</span>
          </button>

          <button
            onClick={() => setActiveTab('sniffer')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'sniffer'
                ? 'bg-slate-900 text-sky-400 border-sky-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/50'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Sniffer de Pacotes & DPI</span>
          </button>

          <button
            onClick={() => setActiveTab('canais')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'canais'
                ? 'bg-slate-900 text-pink-400 border-pink-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/50'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Canais & QR Share</span>
          </button>

          <button
            onClick={() => setActiveTab('ponte')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'ponte'
                ? 'bg-slate-900 text-indigo-400 border-indigo-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/50'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Ponte Serial / IP / MQTT</span>
          </button>
        </div>
      </nav>

      {/* ==================================================================== */}
      {/* CONTEÚDO PRINCIPAL (RENDERIZADO POR ABA)                             */}
      {/* ==================================================================== */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-6">
        {/* ================================================================== */}
        {/* TAB 1: TELEMETRIA & GRÁFICOS 24H                                   */}
        {/* ================================================================== */}
        {activeTab === 'telemetria' && (
          <div className="space-y-6">
            {/* Linha de Alertas Rápidos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {alerts.map((alt) => (
                <div
                  key={alt.id}
                  className={`p-4 rounded-2xl border flex items-start gap-3.5 transition-all ${
                    alt.severity === 'critical'
                      ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                      : alt.severity === 'warning'
                      ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                      : 'bg-cyan-950/30 border-cyan-500/40 text-cyan-200'
                  }`}
                >
                  <div className="mt-0.5">
                    {alt.severity === 'critical' && <XCircle className="w-5 h-5 text-rose-400" />}
                    {alt.severity === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                    {alt.severity === 'info' && <CheckCircle2 className="w-5 h-5 text-cyan-400" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold">{alt.title}</h4>
                      <span className="text-[10px] opacity-70">
                        {new Date(alt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs mt-1 text-slate-300 leading-relaxed">{alt.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Painéis com Recharts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico 1: Bateria & Geração Solar */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Battery className="w-4 h-4 text-emerald-400" />
                      Telemetria de Energia: Bateria (%) vs Solar (mA)
                    </h3>
                    <p className="text-xs text-slate-400">Ciclo de carga e flutuação nas últimas 6 horas</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                    Nó Mestre ME-01
                  </span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={INITIAL_TELEMETRY_SERIES} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorBat" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="colorSolar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="timeStr" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '0.75rem' }}
                        labelStyle={{ color: '#94a3b8', fontSize: '12px' }}
                      />
                      <Area type="monotone" dataKey="batteryPercent" name="Bateria (%)" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorBat)" />
                      <Area type="monotone" dataKey="solarMa" name="Painel Solar (mA)" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorSolar)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 mt-2 px-2">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Bateria: 96% (4.18V)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Geração Solar: Pico 420 mA</span>
                </div>
              </div>

              {/* Gráfico 2: Ocupação do Canal & Relação Sinal/Ruído (SNR) */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Signal className="w-4 h-4 text-cyan-400" />
                      Airtime do Canal (%) & Histórico de SNR (dB)
                    </h3>
                    <p className="text-xs text-slate-400">Congestionamento RF e sensibilidade de recepção</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono">
                    915.0 MHz SF11
                  </span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={INITIAL_TELEMETRY_SERIES} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="timeStr" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '0.75rem' }}
                        labelStyle={{ color: '#94a3b8', fontSize: '12px' }}
                      />
                      <Bar dataKey="channelUtil" name="Ocupação do Canal (%)" fill="#0284c7" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="snr" name="SNR Médio (dB)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 mt-2 px-2">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sky-600" /> Airtime: 12.4% (Excelente margem)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> SNR: +12.5 dB (Limpo e estável)</span>
                </div>
              </div>
            </div>

            {/* Painel de Sensores Ambientais dos Nós de Campo */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-rose-400" />
                Telemetria de Campo (BME680 / BME280 dos Nós Remotos)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {nodes
                  .filter((n) => n.environment)
                  .map((n) => {
                    const env = n.environment!;
                    return (
                      <div key={n.id} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                        <div className="flex items-center justify-between mb-2">
                          <strong className="text-xs text-white flex items-center gap-1.5">
                            <Radio className="w-3.5 h-3.5 text-cyan-400" />
                            {n.shortName}
                          </strong>
                          <span className="text-[10px] text-slate-500">{n.role}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2 rounded bg-slate-900">
                            <span className="text-slate-400 block text-[10px] flex items-center gap-1">
                              <Thermometer className="w-3 h-3 text-rose-400" /> Temperatura
                            </span>
                            <span className="text-white font-bold">{env.temperatureC}°C</span>
                          </div>
                          <div className="p-2 rounded bg-slate-900">
                            <span className="text-slate-400 block text-[10px] flex items-center gap-1">
                              <Droplets className="w-3 h-3 text-cyan-400" /> Umidade
                            </span>
                            <span className="text-white font-bold">{env.relativeHumidity}%</span>
                          </div>
                          <div className="p-2 rounded bg-slate-900">
                            <span className="text-slate-400 block text-[10px] flex items-center gap-1">
                              <Gauge className="w-3 h-3 text-amber-400" /> Pressão
                            </span>
                            <span className="text-white font-bold">{env.barometricPressureHpa} hPa</span>
                          </div>
                          <div className="p-2 rounded bg-slate-900">
                            <span className="text-slate-400 block text-[10px] flex items-center gap-1">
                              <Wind className="w-3 h-3 text-emerald-400" /> IAQ (Ar)
                            </span>
                            <span className="text-white font-bold">
                              {env.iaqScore ? `${env.iaqScore} (Bom)` : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 2: TOPOLOGIA & RADAR RF                                        */}
        {/* ================================================================== */}
        {activeTab === 'topologia' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Visualizador do Radar */}
            <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md flex flex-col items-center">
              <div className="w-full flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Compass className="w-4 h-4 text-emerald-400" />
                    Radar Tático de Radiofrequência LoRa
                  </h3>
                  <p className="text-xs text-slate-400">Distribuição espacial e qualidade do enlace RF com o Nó Mestre</p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                  Alcance Máx: 35 km
                </span>
              </div>

              {/* Canvas/Radar Simulado com SVG */}
              <div className="relative w-full max-w-md aspect-square bg-slate-950 rounded-full border border-slate-800 flex items-center justify-center p-4 overflow-hidden shadow-inner">
                {/* Círculos concêntricos de distância */}
                <div className="absolute inset-4 rounded-full border border-slate-800/60" />
                <div className="absolute inset-16 rounded-full border border-slate-800/80" />
                <div className="absolute inset-28 rounded-full border border-slate-800/90" />
                {/* Linhas cruzadas de mira */}
                <div className="absolute w-full h-px bg-slate-800/60" />
                <div className="absolute h-full w-px bg-slate-800/60" />

                {/* Marcadores de Distância */}
                <span className="absolute top-5 text-[10px] font-mono text-slate-600">30 km</span>
                <span className="absolute top-17 text-[10px] font-mono text-slate-600">15 km</span>
                <span className="absolute top-29 text-[10px] font-mono text-slate-600">5 km</span>

                {/* Centro: Nó Mestre Local */}
                <div className="z-10 flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-xs shadow-lg shadow-emerald-500/50 ring-4 ring-emerald-500/20">
                    ME
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 mt-1 bg-slate-900/80 px-1.5 py-0.5 rounded">
                    Mestre Local
                  </span>
                </div>

                {/* Nós Remotos plotados com ângulo e distância */}
                {nodes
                  .filter((n) => !n.isLocal && n.position && localNode.position)
                  .map((n) => {
                    const distKm = calculateDistanceKm(
                      localNode.position!.lat,
                      localNode.position!.lon,
                      n.position!.lat,
                      n.position!.lon
                    );
                    const bearing = calculateBearingDegrees(
                      localNode.position!.lat,
                      localNode.position!.lon,
                      n.position!.lat,
                      n.position!.lon
                    );
                    const lqi = getLqiQuality(n.snr, n.rssi);

                    // Converte em coordenadas polares relativas ao centro
                    const maxKm = 35;
                    const r = Math.min(130, Math.max(35, (distKm / maxKm) * 140));
                    const angleRad = ((bearing - 90) * Math.PI) / 180;
                    const x = r * Math.cos(angleRad);
                    const y = r * Math.sin(angleRad);

                    const isSelected = selectedNodeId === n.id;

                    return (
                      <div
                        key={n.id}
                        onClick={() => setSelectedNodeId(n.id)}
                        style={{
                          transform: `translate(${x}px, ${y}px)`,
                        }}
                        className={`absolute z-20 flex flex-col items-center cursor-pointer transition-transform hover:scale-110 ${
                          isSelected ? 'scale-125' : ''
                        }`}
                      >
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] text-slate-950 shadow-md"
                          style={{ backgroundColor: lqi.color }}
                        >
                          {n.shortName.slice(0, 3)}
                        </div>
                        <span
                          className={`text-[9px] font-mono mt-0.5 px-1 py-0.2 rounded whitespace-nowrap ${
                            isSelected
                              ? 'bg-cyan-500 text-slate-950 font-bold'
                              : 'bg-slate-900/90 text-slate-300'
                          }`}
                        >
                          {n.shortName} ({distKm}km)
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Painel do Nó Selecionado */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Radio className="w-5 h-5 text-cyan-400" />
                    <div>
                      <h4 className="text-sm font-bold text-white">{selectedNode.longName}</h4>
                      <span className="text-[11px] text-slate-400 font-mono">{selectedNode.id}</span>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                    {selectedNode.role}
                  </span>
                </div>

                <div className="mt-4 space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Hardware:</span>
                      <span className="text-white font-medium">{selectedNode.hardware}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Firmware:</span>
                      <span className="text-cyan-300 font-mono">{selectedNode.firmwareVersion}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Distância do Mestre:</span>
                      <span className="text-emerald-400 font-bold">
                        {selectedNode.position && localNode.position
                          ? `${calculateDistanceKm(
                              localNode.position.lat,
                              localNode.position.lon,
                              selectedNode.position.lat,
                              selectedNode.position.lon
                            )} km (${calculateBearingDegrees(
                              localNode.position.lat,
                              localNode.position.lon,
                              selectedNode.position.lat,
                              selectedNode.position.lon
                            )}°)`
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Saltos (Hops):</span>
                      <span className="text-white font-bold">{selectedNode.hopsAway} saltos</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Sinal RF:</span>
                      <span className="text-white font-mono">
                        SNR: <strong className="text-emerald-400">+{selectedNode.snr} dB</strong> • RSSI:{' '}
                        <strong className="text-cyan-400">{selectedNode.rssi} dBm</strong>
                      </span>
                    </div>
                  </div>

                  {selectedNode.notes && (
                    <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-slate-300 text-xs italic">
                      &quot;{selectedNode.notes}&quot;
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <button
                  onClick={() => {
                    setTracerouteTargetId(selectedNode.id);
                    setActiveTab('traceroute');
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  <Zap className="w-4 h-4" />
                  <span>Executar Traceroute para este Nó</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 3: DIRETÓRIO DE NÓS & SENSORES                                */}
        {/* ================================================================== */}
        {activeTab === 'diretorio' && (
          <div className="space-y-4">
            {/* Barra de Filtros */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar nós por nome, ID ou rádio..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                {['ALL', 'ROUTER', 'REPEATER', 'TRACKER', 'CLIENT'].map((role) => (
                  <button
                    key={role}
                    onClick={() => setSelectedRoleFilter(role)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      selectedRoleFilter === role
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {role === 'ALL' ? 'Todos os Papéis' : role}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid de Cards de Nós */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredNodes.map((node) => {
                const lqi = getLqiQuality(node.snr, node.rssi);
                return (
                  <div
                    key={node.id}
                    className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/90 shadow-md flex flex-col justify-between hover:border-slate-700 transition-all"
                  >
                    <div>
                      {/* Cabeçalho do Card */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center font-black text-cyan-400">
                            {node.shortName}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                              {node.longName}
                              {node.isLocal && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  LOCAL
                                </span>
                              )}
                            </h4>
                            <span className="text-[11px] text-slate-400 font-mono">{node.id}</span>
                          </div>
                        </div>

                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${lqi.badgeBg}`}>
                          {lqi.label}
                        </span>
                      </div>

                      {/* Informações de Hardware & Rádio */}
                      <div className="mt-4 space-y-2 text-xs">
                        <div className="text-slate-400 text-[11px] truncate">{node.hardware}</div>

                        {/* Barra de Bateria */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400 flex items-center gap-1">
                              <Battery className="w-3.5 h-3.5 text-emerald-400" /> Bateria:
                            </span>
                            <span className="text-white font-bold">
                              {node.batteryPercent}% ({node.voltage}V)
                            </span>
                          </div>
                          <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${
                                node.batteryPercent > 50
                                  ? 'bg-emerald-500'
                                  : node.batteryPercent > 20
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${node.batteryPercent}%` }}
                            />
                          </div>
                        </div>

                        {/* Sensores Ambientais se houver */}
                        {node.environment && (
                          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 grid grid-cols-3 gap-2 text-[11px]">
                            <div>
                              <span className="text-slate-500 block text-[9px]">TEMP</span>
                              <span className="text-white font-bold">{node.environment.temperatureC}°C</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[9px]">UMID</span>
                              <span className="text-white font-bold">{node.environment.relativeHumidity}%</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[9px]">PRESSÃO</span>
                              <span className="text-white font-bold">{node.environment.barometricPressureHpa} hPa</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Rodapé & Ações */}
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-500 text-[11px]">
                        Ouvido há {Math.floor((Date.now() - node.lastHeard) / 1000)}s
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setTracerouteTargetId(node.id);
                            setActiveTab('traceroute');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-semibold cursor-pointer text-[11px]"
                        >
                          Traceroute
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 4: TRACEROUTE HOP-BY-HOP                                      */}
        {/* ================================================================== */}
        {activeTab === 'traceroute' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg">
              <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                Diagnóstico de Rota LoRa (Traceroute Hop-by-Hop)
              </h3>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                Descubra o trajeto exato dos pacotes de rádio entre o Nó Mestre e qualquer estação remota, medindo o atraso (RTT) e a perda de sinal (SNR) em cada repetidor intermediário.
              </p>

              {/* Seletor do Nó Destino */}
              <div className="flex flex-col sm:flex-row gap-3 items-center">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Selecione o Nó de Destino:
                  </label>
                  <select
                    value={tracerouteTargetId}
                    onChange={(e) => setTracerouteTargetId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    {nodes
                      .filter((n) => !n.isLocal)
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.shortName} - {n.longName} ({n.hardware.split(' ')[0]}) [{n.hopsAway} saltos]
                        </option>
                      ))}
                  </select>
                </div>

                <div className="sm:mt-5 w-full sm:w-auto">
                  <button
                    onClick={handleRunTraceroute}
                    disabled={isExecutingTraceroute}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${isExecutingTraceroute ? 'animate-spin' : ''}`} />
                    <span>{isExecutingTraceroute ? 'Rastreando Rota...' : 'Disparar Traceroute'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Resultado Visual do Traceroute */}
            {tracerouteResult && (
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Traceroute Concluído para {tracerouteResult.targetName}
                    </h4>
                    <span className="text-xs text-slate-400 font-mono">
                      Timestamp: {new Date(tracerouteResult.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Latência Total (RTT):</span>
                    <strong className="text-lg font-black text-amber-400 font-mono">
                      {tracerouteResult.totalRttMs} ms
                    </strong>
                  </div>
                </div>

                {/* Linha do Tempo / Diagrama Passo-a-Passo de Saltos */}
                <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-emerald-500 via-cyan-500 to-amber-500">
                  {tracerouteResult.hops.map((hop, index) => (
                    <div key={hop.hopIndex} className="relative flex items-start gap-4">
                      {/* Marcador Numérico */}
                      <div className="absolute -left-6 w-6 h-6 rounded-full bg-slate-950 border-2 border-cyan-400 text-cyan-400 flex items-center justify-center font-bold text-[10px] shadow-sm">
                        {hop.hopIndex}
                      </div>

                      {/* Conteúdo do Salto */}
                      <div className="flex-1 p-4 rounded-xl bg-slate-950 border border-slate-800/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="text-xs font-bold text-white">{hop.nodeName}</h5>
                            <span className="text-[10px] text-slate-400 font-mono">({hop.nodeId})</span>
                          </div>
                          <span className="text-[11px] text-slate-500 block mt-0.5">{hop.hardware}</span>
                        </div>

                        <div className="flex items-center gap-4 text-xs font-mono">
                          <div>
                            <span className="text-slate-500 block text-[9px]">SINAL</span>
                            <span className="text-emerald-400 font-bold">+{hop.snr} dB</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px]">RSSI</span>
                            <span className="text-cyan-400 font-bold">{hop.rssi} dBm</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px]">ATRASO</span>
                            <span className="text-amber-400 font-bold">+{hop.delayMs} ms</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 5: SNIFFER DE PACOTES & DPI                                    */}
        {/* ================================================================== */}
        {activeTab === 'sniffer' && (
          <div className="space-y-4">
            {/* Controles do Sniffer */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSnifferPaused(!isSnifferPaused)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSnifferPaused
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {isSnifferPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  {isSnifferPaused ? 'Retomar Captura' : 'Pausar Captura'}
                </button>

                <button
                  onClick={() => setPackets([])}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition-colors"
                >
                  Limpar Buffer
                </button>
              </div>

              {/* Filtro de Tipo de Pacote */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 hidden sm:inline">Tipo:</span>
                <select
                  value={packetTypeFilter}
                  onChange={(e) => setPacketTypeFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none"
                >
                  <option value="ALL">Todos os Tipos ({packets.length})</option>
                  <option value="TELEMETRY_APP">TELEMETRY</option>
                  <option value="POSITION_APP">POSITION</option>
                  <option value="TEXT_MESSAGE_APP">TEXT_MESSAGE</option>
                  <option value="ROUTING_APP">ROUTING</option>
                  <option value="TRACEROUTE_APP">TRACEROUTE</option>
                </select>
              </div>

              {/* Botões de Exportação */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadJson}
                  className="px-3 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>JSON</span>
                </button>
                <button
                  onClick={handleDownloadCsv}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
              </div>
            </div>

            {/* Tabela do Sniffer */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-md">
              <div className="overflow-x-auto max-h-[500px] scrollbar-thin">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-semibold sticky top-0 z-10 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Hora</th>
                      <th className="py-2.5 px-3">Tipo</th>
                      <th className="py-2.5 px-3">Origem</th>
                      <th className="py-2.5 px-3">Destino</th>
                      <th className="py-2.5 px-3">Canal</th>
                      <th className="py-2.5 px-3">SNR/RSSI</th>
                      <th className="py-2.5 px-3">Payload Decodificado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {filteredPackets.map((pkt) => {
                      const isSelected = selectedPacket?.id === pkt.id;
                      return (
                        <tr
                          key={pkt.id}
                          onClick={() => setSelectedPacket(pkt)}
                          className={`hover:bg-slate-800/40 cursor-pointer transition-colors ${
                            isSelected ? 'bg-cyan-950/40' : ''
                          }`}
                        >
                          <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                            {new Date(pkt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                pkt.type === 'TELEMETRY_APP'
                                  ? 'bg-emerald-500/10 text-emerald-300'
                                  : pkt.type === 'POSITION_APP'
                                  ? 'bg-cyan-500/10 text-cyan-300'
                                  : pkt.type === 'TEXT_MESSAGE_APP'
                                  ? 'bg-purple-500/10 text-purple-300'
                                  : 'bg-amber-500/10 text-amber-300'
                              }`}
                            >
                              {pkt.type.replace('_APP', '')}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-white font-bold whitespace-nowrap">{pkt.fromName}</td>
                          <td className="py-2 px-3 text-slate-300 whitespace-nowrap">{pkt.toName}</td>
                          <td className="py-2 px-3 text-sky-400 whitespace-nowrap">{pkt.channelName}</td>
                          <td className="py-2 px-3 text-slate-300 whitespace-nowrap">
                            +{pkt.snr}dB / {pkt.rssi}dBm
                          </td>
                          <td className="py-2 px-3 text-slate-300 max-w-md truncate font-sans">
                            {pkt.payloadSummary}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Inspetor de Pacote Selecionado */}
            {selectedPacket && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-cyan-400" /> Inspetor DPI: Pacote {selectedPacket.id}
                  </span>
                  <span className="text-emerald-400 font-mono text-[11px]">CRC Válido (Check: OK)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-400">
                  <div>Origem Hex: <span className="text-white font-mono">{selectedPacket.from}</span></div>
                  <div>Destino Hex: <span className="text-white font-mono">{selectedPacket.to}</span></div>
                  <div>Hop Limit Restante: <span className="text-cyan-300 font-mono">{selectedPacket.hopLimit}</span></div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 font-mono text-[11px] break-all">
                  {selectedPacket.payloadSummary}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 6: CANAIS & COMPARTILHAMENTO QR CODE                           */}
        {/* ================================================================== */}
        {activeTab === 'canais' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lista e Configuração de Canais */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md space-y-5">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-pink-400" />
                  Gerenciamento de Canais Cifrados (AES-256)
                </h3>
                <p className="text-xs text-slate-400">Selecione o canal para sincronizar ou compartilhar com operadores</p>
              </div>

              {/* Seletor de Canais */}
              <div className="space-y-3">
                {channels.map((chan, idx) => (
                  <div
                    key={chan.name}
                    onClick={() => setSelectedChannelIndex(idx)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedChannelIndex === idx
                        ? 'bg-pink-950/20 border-pink-500/50 shadow-sm'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-xs text-white flex items-center gap-2">
                        #{chan.name}
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                          Canal {chan.index}
                        </span>
                      </strong>
                      <span className="text-[11px] text-pink-400 font-mono">{chan.modemPreset.split(' ')[0]}</span>
                    </div>

                    <div className="mt-2 text-xs text-slate-400 font-mono truncate">
                      PSK: {chan.pskType === 'default_public' ? 'Chave Pública Meshtastic Padrão' : chan.psk}
                    </div>
                  </div>
                ))}
              </div>

              {/* Ações no Canal Ativo */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300 font-semibold">Chave de Criptografia PSK:</span>
                  <button
                    onClick={handleGenerateNewPsk}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                  >
                    Gerar Nova Chave AES-256
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={activeChannel.psk}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(activeChannel.psk);
                      setCopiedPsk(true);
                      setTimeout(() => setCopiedPsk(false), 2000);
                    }}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
                    title="Copiar PSK"
                  >
                    {copiedPsk ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Gerador de QR Code Meshtastic */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md flex flex-col items-center justify-between text-center">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center justify-center gap-2">
                  <QrCode className="w-4 h-4 text-cyan-400" />
                  QR Code Oficial de Emparelhamento Meshtastic
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Aponte a câmera do aplicativo oficial Meshtastic para importar instantaneamente as configurações deste canal.
                </p>
              </div>

              {/* Imagem do QR Code */}
              <div className="my-6 p-4 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner flex items-center justify-center">
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="Meshtastic QR Code"
                    className="w-56 h-56 rounded-xl border border-slate-800 shadow-md"
                  />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center text-slate-600 text-xs">
                    Gerando QR Code...
                  </div>
                )}
              </div>

              <div className="w-full space-y-2">
                <button
                  onClick={() => {
                    const url = generateMeshtasticShareUrl(activeChannel);
                    navigator.clipboard.writeText(url);
                    setCopiedShareUrl(true);
                    setTimeout(() => setCopiedShareUrl(false), 2000);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  {copiedShareUrl ? <Check className="w-4 h-4 text-emerald-300" /> : <Share2 className="w-4 h-4" />}
                  <span>{copiedShareUrl ? 'Link Copiado!' : 'Copiar URL meshtastic://'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 7: PONTE SERIAL / IP / MQTT                                    */}
        {/* ================================================================== */}
        {activeTab === 'ponte' && (
          <div className="max-w-3xl mx-auto p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
                Configuração da Interface de Rádio & Ponte de Comunicação
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Conecte seu navegador diretamente ao hardware físico via WebSerial USB, rede local WiFi/TCP ou broker MQTT.
              </p>
            </div>

            {/* Modo de Conexão */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => setConnectionMode('simulator')}
                className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                  connectionMode === 'simulator'
                    ? 'bg-indigo-950/40 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-xs flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" /> Simulador de Campo
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Gera telemetria e pacotes sem hardware físico</p>
              </button>

              <button
                onClick={handleConnectWebSerial}
                className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                  connectionMode === 'webserial'
                    ? 'bg-indigo-950/40 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-xs flex items-center gap-2">
                  <Usb className="w-4 h-4 text-cyan-400" /> WebSerial USB
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Conexão direta com ESP32 / NRF52 via cabo USB</p>
              </button>

              <button
                onClick={() => setConnectionMode('tcp')}
                className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                  connectionMode === 'tcp'
                    ? 'bg-indigo-950/40 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-xs flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-amber-400" /> WiFi / TCP (4403)
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Conexão via IP do rádio na mesma rede Wi-Fi</p>
              </button>
            </div>

            {/* Detalhes do Modo Selecionado */}
            {connectionMode === 'webserial' && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-xs font-semibold text-slate-300">Baud Rate da Porta Serial:</span>
                <select
                  value={baudRate}
                  onChange={(e) => setBaudRate(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                >
                  <option value={115200}>115200 bps (Padrão Meshtastic)</option>
                  <option value={921600}>921600 bps (Alta Velocidade ESP32-S3)</option>
                  <option value={57600}>57600 bps</option>
                </select>
                <button
                  onClick={handleConnectWebSerial}
                  className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Solicitar Permissão de Porta Serial USB
                </button>
              </div>
            )}

            {connectionMode === 'tcp' && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-slate-400 block mb-1">IP do Nó Meshtastic:</label>
                    <input
                      type="text"
                      value={tcpHost}
                      onChange={(e) => setTcpHost(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Porta:</label>
                    <input
                      type="number"
                      value={tcpPort}
                      onChange={(e) => setTcpPort(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                    />
                  </div>
                </div>
                <button
                  onClick={() => alert(`Tentando estabelecer socket TCP com ${tcpHost}:${tcpPort}...`)}
                  className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Conectar Socket TCP
                </button>
              </div>
            )}

            {connectionMode === 'simulator' && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-semibold">Geração de Tráfego de Fundo:</span>
                  <button
                    onClick={() => setIsSimulatingTraffic(!isSimulatingTraffic)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                      isSimulatingTraffic
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isSimulatingTraffic ? 'Ativo (a cada 7s)' : 'Pausado'}
                  </button>
                </div>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  O simulador injeta pacotes realistas de posição GPS, telemetria climática BME680, mensagens de texto e atualizações de vizinhança para testes completos do sistema em ambiente de bancada.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
