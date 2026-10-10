import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Network,
  Shield,
  Key,
  Terminal,
  Send,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Download,
  RefreshCw,
  Cpu,
  Radio,
  Globe,
  BookOpen,
  Layers,
  Zap,
  Sliders,
  ArrowRight,
  FileText,
  Lock,
  MessageSquare,
  Compass,
  Play,
  Sparkles,
  HelpCircle,
  ExternalLink,
  HardDrive,
  Activity,
  Plus,
  Trash2,
} from 'lucide-react';

import {
  createNewIdentity,
  deriveDestinationHash,
  executeRnsCliCommand,
  generateRandomHex,
  generateReticulumConfigFile,
  INITIAL_LXMF_MESSAGES,
  INITIAL_RNS_IDENTITIES,
  INITIAL_RNS_INTERFACES,
  INITIAL_RNS_PACKETS,
  INITIAL_RNS_PATHS,
  LxmfMessage,
  ReticulumDestination,
  ReticulumIdentity,
  ReticulumInterfaceConfig,
  ReticulumPacket,
  ReticulumRoutingPath,
} from '../utils/reticulumEngine';

export interface ReticulumNetworkViewProps {
  onNavigateToMesh?: () => void;
  onNavigateToLora?: () => void;
  onNavigateToMonitor?: () => void;
}

type ReticulumTab = 'aprenda' | 'identidades' | 'configurador' | 'terminal' | 'lxmf' | 'rotas';

export const ReticulumNetworkView: React.FC<ReticulumNetworkViewProps> = ({
  onNavigateToMesh,
  onNavigateToLora,
  onNavigateToMonitor,
}) => {
  // Aba ativa e modo
  const [activeTab, setActiveTab] = useState<ReticulumTab>('aprenda');
  const [userLevel, setUserLevel] = useState<'beginner' | 'advanced'>('beginner');

  // Estado das Identidades e Destinos
  const [identities, setIdentities] = useState<ReticulumIdentity[]>(INITIAL_RNS_IDENTITIES);
  const [selectedIdentityIndex, setSelectedIdentityIndex] = useState<number>(0);
  const [newIdentityAlias, setNewIdentityAlias] = useState<string>('');
  const [selectedAppName, setSelectedAppName] = useState<string>('lxmf.delivery');
  const [customAspects, setCustomAspects] = useState<string>('node,sovereign');

  // Estado das Interfaces & Config
  const [interfaces, setInterfaces] = useState<ReticulumInterfaceConfig[]>(INITIAL_RNS_INTERFACES);
  const [enableTransport, setEnableTransport] = useState<boolean>(true);
  const [shareNodeInfo, setShareNodeInfo] = useState<boolean>(true);
  const [copiedConfig, setCopiedConfig] = useState<boolean>(false);

  // Terminal Virtual CLI
  const [cliInput, setCliInput] = useState<string>('rnstatus');
  const [cliHistory, setCliHistory] = useState<Array<{ cmd: string; out: string; success: boolean }>>([
    {
      cmd: 'rnstatus',
      out: executeRnsCliCommand('rnstatus', INITIAL_RNS_INTERFACES, INITIAL_RNS_PATHS, INITIAL_RNS_IDENTITIES).output,
      success: true,
    },
  ]);

  // LXMF Messenger
  const [lxmfMessages, setLxmfMessages] = useState<LxmfMessage[]>(INITIAL_LXMF_MESSAGES);
  const [newMsgTitle, setNewMsgTitle] = useState<string>('');
  const [newMsgContent, setNewMsgContent] = useState<string>('');
  const [targetDestinationHash, setTargetDestinationHash] = useState<string>(
    '82a93b41c0e81254bf69d45e0a1b2c3d'
  );
  const [isSendingLxmf, setIsSendingLxmf] = useState<boolean>(false);

  // Rotas e Sniffer
  const [paths, setPaths] = useState<ReticulumRoutingPath[]>(INITIAL_RNS_PATHS);
  const [packets, setPackets] = useState<ReticulumPacket[]>(INITIAL_RNS_PACKETS);

  // Tutorial Interativo (Passo a Passo)
  const [tutorialStep, setTutorialStep] = useState<number>(1);
  const [tutorialProgress, setTutorialProgress] = useState<Record<number, boolean>>({ 1: true });

  // Utilitário de cópia
  const [copiedTextKey, setCopiedTextKey] = useState<string | null>(null);

  const activeIdentity = useMemo(
    () => identities[selectedIdentityIndex] || identities[0],
    [identities, selectedIdentityIndex]
  );

  const currentDestinationHash = useMemo(() => {
    if (!activeIdentity) return '';
    const aspectsList = customAspects.split(',').map((s) => s.trim()).filter(Boolean);
    return deriveDestinationHash(activeIdentity.publicKeyHex, selectedAppName, aspectsList);
  }, [activeIdentity, selectedAppName, customAspects]);

  const generatedConfigFile = useMemo(() => {
    return generateReticulumConfigFile(interfaces, enableTransport, shareNodeInfo);
  }, [interfaces, enableTransport, shareNodeInfo]);

  // Função para executar comando no terminal
  const handleRunCommand = (commandToRun?: string) => {
    const cmd = (commandToRun || cliInput).trim();
    if (!cmd) return;
    const res = executeRnsCliCommand(cmd, interfaces, paths, identities);
    setCliHistory((prev) => [...prev, { cmd: res.command, out: res.output, success: res.success }]);
    setCliInput('');
  };

  // Gerar nova identidade
  const handleCreateIdentity = () => {
    const alias = newIdentityAlias.trim() || `Nó Reticulum #${identities.length + 1}`;
    const newId = createNewIdentity(alias);
    setIdentities((prev) => [newId, ...prev]);
    setSelectedIdentityIndex(0);
    setNewIdentityAlias('');
  };

  // Enviar Mensagem LXMF
  const handleSendLxmf = () => {
    if (!newMsgContent.trim()) return;
    setIsSendingLxmf(true);

    const targetPath = paths.find((p) => p.destinationHash === targetDestinationHash);
    const targetAlias = targetPath ? targetPath.destinationAlias : 'Destino Remoto RNS';

    const newMsg: LxmfMessage = {
      id: `lxmf_${Date.now().toString(36)}`,
      timestamp: Date.now(),
      sourceDestinationHash: currentDestinationHash,
      sourceAlias: activeIdentity.alias,
      targetDestinationHash,
      targetAlias,
      title: newMsgTitle.trim() || 'Mensagem Segura LXMF',
      content: newMsgContent.trim(),
      state: 'TRANSMITTING',
      deliveryReceiptReceived: false,
      wireBytesLength: 120 + newMsgContent.length,
    };

    setLxmfMessages((prev) => [newMsg, ...prev]);
    setNewMsgContent('');
    setNewMsgTitle('');

    // Simula transmissão com confirmação de entrega
    setTimeout(() => {
      setLxmfMessages((prev) =>
        prev.map((m) =>
          m.id === newMsg.id
            ? { ...m, state: 'DELIVERED', deliveryReceiptReceived: true, rttMs: Math.floor(180 + Math.random() * 90) }
            : m
        )
      );
      setIsSendingLxmf(false);

      // Injeta pacote correspondente no sniffer
      const newPkt: ReticulumPacket = {
        id: `pkt_rns_${Date.now().toString(36)}`,
        timestamp: Date.now(),
        packetType: 'DATA',
        destinationHash: targetDestinationHash,
        destinationType: 'LINK',
        hops: targetPath ? targetPath.hops : 1,
        interfaceName: targetPath ? targetPath.nextHopInterface : 'AutoMesh-Local',
        rawLengthBytes: newMsg.wireBytesLength,
        summary: `LXMF E2EE Entregue com Sucesso: "${newMsg.title}"`,
      };
      setPackets((prev) => [newPkt, ...prev]);
    }, 1500);
  };

  // Cópia de texto com feedback
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTextKey(key);
    setTimeout(() => setCopiedTextKey(null), 2000);
  };

  // Download do arquivo config
  const handleDownloadConfig = () => {
    const blob = new Blob([generatedConfigFile], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* ==================================================================== */}
      {/* HEADER DA SUÍTE RETICULUM                                           */}
      {/* ==================================================================== */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Logo & Título */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-cyan-500/20 border border-indigo-500/40 text-indigo-400 shadow-lg shadow-indigo-500/10">
              <Network className="w-6 h-6 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-indigo-500 ring-2 ring-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                  Reticulum Network
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono font-semibold">
                    RNS Stack
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-400">
                Pilha de Rede Criptográfica Soberana: Zero IP • Zero Autoridades • Roteamento Universal
              </p>
            </div>
          </div>

          {/* Seletor de Modo (Iniciante / Avançado) e Ações */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <button
                onClick={() => {
                  setUserLevel('beginner');
                  setActiveTab('aprenda');
                }}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  userLevel === 'beginner'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🎓 Modo Iniciante
              </button>
              <button
                onClick={() => {
                  setUserLevel('advanced');
                  if (activeTab === 'aprenda') setActiveTab('identidades');
                }}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  userLevel === 'advanced'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ⚡ Modo Avançado
              </button>
            </div>

            {onNavigateToMonitor && (
              <button
                onClick={onNavigateToMonitor}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 border border-slate-700 transition-colors"
                title="Abrir MeshMonitor Meshtastic"
              >
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">MeshMonitor</span>
              </button>
            )}

            {onNavigateToLora && (
              <button
                onClick={onNavigateToLora}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 border border-slate-700 transition-colors"
                title="Abrir LoRa Chat"
              >
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">LoRa</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* NAVEGAÇÃO ENTRE ABAS                                                 */}
      {/* ==================================================================== */}
      <nav className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-slate-800">
          <button
            onClick={() => setActiveTab('aprenda')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'aprenda'
                ? 'bg-slate-900 text-indigo-400 border-indigo-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/50'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Aprenda o Reticulum</span>
          </button>

          <button
            onClick={() => setActiveTab('identidades')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'identidades'
                ? 'bg-slate-900 text-cyan-400 border-cyan-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/50'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Identidades & Destinos (rnid)</span>
          </button>

          <button
            onClick={() => setActiveTab('configurador')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'configurador'
                ? 'bg-slate-900 text-emerald-400 border-emerald-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/50'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Configurador (~/.reticulum/config)</span>
          </button>

          <button
            onClick={() => setActiveTab('terminal')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'terminal'
                ? 'bg-slate-900 text-purple-400 border-purple-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/50'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Terminal CLI (rnstatus / rnpath)</span>
          </button>

          <button
            onClick={() => setActiveTab('lxmf')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'lxmf'
                ? 'bg-slate-900 text-pink-400 border-pink-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/50'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Mensageiro LXMF (E2EE)</span>
          </button>

          <button
            onClick={() => setActiveTab('rotas')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'rotas'
                ? 'bg-slate-900 text-amber-400 border-amber-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/50'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Rotas & Sniffer RNS</span>
          </button>
        </div>
      </nav>

      {/* ==================================================================== */}
      {/* CONTEÚDO PRINCIPAL                                                   */}
      {/* ==================================================================== */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-6">
        {/* ================================================================== */}
        {/* ABA 1: APRENDA O RETICULUM (GUIA INICIANTE & SIMULADOR VISUAL)     */}
        {/* ================================================================== */}
        {activeTab === 'aprenda' && (
          <div className="space-y-8">
            {/* Banner Conceitual de Impacto */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-950 border border-indigo-500/30 p-6 sm:p-8 shadow-2xl">
              <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
              <div className="relative z-10 max-w-3xl space-y-3">
                <span className="px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-mono font-bold uppercase tracking-wider inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Redes Criptográficas Descentralizadas
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  O que é o Reticulum e por que ele é revolucionário?
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  O <strong>Reticulum Network Stack (RNS)</strong> foi criado pelo desenvolvedor Mark Qvist com uma missão clara:
                  construir uma rede que funcione <strong>sem provedores de internet (ISPs), sem servidores DNS, sem endereços IP e sem controle governamental</strong>.
                  Ele conecta rádios LoRa, transceptores amadores VHF/UHF, Wi-Fi local e a própria internet sob uma única camada criptográfica inquebrável.
                </p>
              </div>
            </div>

            {/* Comparativo Didático: Internet Tradicional vs Reticulum */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-rose-900/30 shadow-md space-y-4">
                <div className="flex items-center gap-3 text-rose-400 pb-3 border-b border-rose-900/40">
                  <Globe className="w-5 h-5" />
                  <h3 className="text-base font-bold text-white">A Internet Tradicional (TCP/IP)</h3>
                </div>
                <ul className="space-y-3 text-xs text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5" />
                    <span><strong>Depende de ISPs e cabos:</strong> Se o provedor cortar seu sinal ou um cabo submarino for rompido, você fica sem rede.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5" />
                    <span><strong>Endereços IP rastreáveis:</strong> Cada pacote revela seu endereço IP geográfico e provedor de origem.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5" />
                    <span><strong>Servidores Centrais:</strong> Nomes de domínio dependem de DNS e certificados de autoridades centrais (CAs).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5" />
                    <span><strong>Bloqueios e Censura:</strong> Governos e empresas podem derrubar roteamento BGP ou censurar serviços com facilidade.</span>
                  </li>
                </ul>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900/60 border border-indigo-500/30 shadow-md space-y-4">
                <div className="flex items-center gap-3 text-indigo-400 pb-3 border-b border-indigo-500/40">
                  <Network className="w-5 h-5" />
                  <h3 className="text-base font-bold text-white">A Rede Reticulum (RNS)</h3>
                </div>
                <ul className="space-y-3 text-xs text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5" />
                    <span><strong>Zero IP, Zero Servidores:</strong> Não existem números de IP. Endereços são <em>Hashes de 16 bytes</em> derivados de chaves públicas.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5" />
                    <span><strong>Roteia sobre Qualquer Meio:</strong> Funciona em rádio LoRa (RNode), rádio amador VHF/UHF (KISS), cabo direto, Wi-Fi local ou TCP.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5" />
                    <span><strong>Criptografia Nativa Inegociável:</strong> Todo pacote é assinado com Ed25519 e túneis usam troca de chaves X25519 com Forward Secrecy.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5" />
                    <span><strong>Auto-Cura e Sobrevivência:</strong> Se parte da rede cair, os pacotes encontram caminhos alternativos automaticamente por saltos.</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Simulador Interativo Passo a Passo: "Como o Reticulum Funciona" */}
            <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    Simulador Interativo: Ciclo de Vida de uma Conexão Reticulum
                  </h3>
                  <p className="text-xs text-slate-400">
                    Acompanhe visualmente como uma máquina descobre, conecta e conversa com outra sem internet convencional.
                  </p>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 font-mono font-bold">
                  Passo {tutorialStep} de 6
                </span>
              </div>

              {/* Botões dos 6 Passos */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {[
                  { num: 1, label: '1. Identidade', icon: Key },
                  { num: 2, label: '2. Destino', icon: Lock },
                  { num: 3, label: '3. Announce', icon: Radio },
                  { num: 4, label: '4. Rota / Saltos', icon: Compass },
                  { num: 5, label: '5. Link Seguro', icon: Shield },
                  { num: 6, label: '6. Mensagem LXMF', icon: Send },
                ].map((s) => (
                  <button
                    key={s.num}
                    onClick={() => {
                      setTutorialStep(s.num);
                      setTutorialProgress((p) => ({ ...p, [s.num]: true }));
                    }}
                    className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      tutorialStep === s.num
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
                        : tutorialProgress[s.num]
                        ? 'bg-slate-950 text-slate-300 border-slate-700 hover:border-slate-600'
                        : 'bg-slate-950 text-slate-500 border-slate-800'
                    }`}
                  >
                    <s.icon className="w-4 h-4" />
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>

              {/* Caixa Explicativa e Demonstração do Passo */}
              <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                {tutorialStep === 1 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Key className="w-4 h-4 text-cyan-400" /> Passo 1: Geração da Identidade Criptográfica (Ed25519)
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      No Reticulum, você não faz cadastro e ninguém lhe atribui um login ou IP. Seu rádio gera localmente um par de chaves assimétricas Ed25519 e X25519.
                      Sua <strong>Chave Pública</strong> é a sua assinatura digital que prova matematicamente quem você é.
                    </p>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-cyan-300 break-all">
                      Sua Chave Pública Gerada: <strong>{activeIdentity.publicKeyHex}</strong>
                    </div>
                  </div>
                )}

                {tutorialStep === 2 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Lock className="w-4 h-4 text-emerald-400" /> Passo 2: Derivação do Endereço de Destino (16 Bytes)
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Em vez de um domínio como `site.com` ou um IP como `192.168.1.50`, o Reticulum calcula um <strong>Destination Hash</strong> de exatamente 16 bytes (32 caracteres hexadecimais),
                      combinando sua chave pública com o nome do aplicativo (ex: `lxmf.delivery`).
                    </p>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-emerald-400 break-all">
                      Seu Hash de Destino Derivado: &lt;<strong>{currentDestinationHash}</strong>&gt;
                    </div>
                  </div>
                )}

                {tutorialStep === 3 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Radio className="w-4 h-4 text-purple-400" /> Passo 3: Emissão do Announce na Malha
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Quando seu nó fica online, ele transmite um pacote pequeno chamado <strong>Announce</strong>. Esse pacote contém seu Destination Hash e uma assinatura digital.
                      Todos os nós ao redor ouvem esse anúncio e aprendem que você existe, sem precisar de um servidor central.
                    </p>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-purple-300">
                      [TX ANNOUNCE] &lt;{currentDestinationHash.slice(0, 16)}...&gt; saltos=0 via RNode-LoRa-915 (154 bytes)
                    </div>
                  </div>
                )}

                {tutorialStep === 4 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Compass className="w-4 h-4 text-amber-400" /> Passo 4: Construção da Rota (Paths) por Saltos
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Cada repetidor ou estação intermediária que ouve seu Announce anota na sua memória interna: &quot;Para entregar um pacote a este hash, basta enviar pela interface X com N saltos&quot;.
                      A tabela de roteamento é dinâmica, auto-configurada e tem expiração automática.
                    </p>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-amber-300">
                      Tabela de Rotas Atualizada: 4 destinos mapeados • Roteador mais próximo a 1 salto (5.4 kbps)
                    </div>
                  </div>
                )}

                {tutorialStep === 5 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Shield className="w-4 h-4 text-sky-400" /> Passo 5: Estabelecimento de um Link Seguro com Forward Secrecy
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Antes de trocar dados sensíveis, dois nós criam um <strong>Link</strong>: uma sessão criptográfica temporária com troca de chaves Diffie-Hellman efêmeras (X25519).
                      Mesmo que um rádio seja capturado fisicamente no futuro, as mensagens transmitidas no passado não podem ser descriptografadas.
                    </p>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-sky-300">
                      [LINK ESTABLISHED] Sessão efêmera ativa com &lt;82a9...2c3d&gt; (NomadNet Central) • Cifra: AES-128 / Fernet
                    </div>
                  </div>
                )}

                {tutorialStep === 6 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Send className="w-4 h-4 text-emerald-400" /> Passo 6: Transmissão Livre de Mensagens e Arquivos (LXMF)
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Agora você pode enviar e receber mensagens de texto, imagens pequenas, micro-blogs do NomadNet ou arquivos com o protocolo LXMF.
                      Quando o destino recebe o pacote, ele envia automaticamente de volta uma prova criptográfica (Proof) confirmando a entrega.
                    </p>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-emerald-400">
                      [PROOF RECEIVED] Entrega garantida e confirmada com RTT de 240 ms.
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2">
                  <button
                    disabled={tutorialStep <= 1}
                    onClick={() => setTutorialStep((s) => Math.max(1, s - 1))}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-40 cursor-pointer"
                  >
                    ← Passo Anterior
                  </button>
                  <button
                    onClick={() => {
                      if (tutorialStep < 6) {
                        setTutorialStep((s) => s + 1);
                        setTutorialProgress((p) => ({ ...p, [tutorialStep + 1]: true }));
                      } else {
                        setActiveTab('identidades');
                      }
                    }}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white cursor-pointer"
                  >
                    {tutorialStep < 6 ? 'Próximo Passo →' : 'Criar Minha Identidade Agora'}
                  </button>
                </div>
              </div>
            </div>

            {/* Como Rodar no Mundo Real (Guia Rápido) */}
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-cyan-400" />
                Como Instalar e Rodar o Reticulum Oficial no seu Computador ou Raspberry Pi
              </h3>
              <p className="text-xs text-slate-400">
                O Reticulum é distribuído como um pacote Python oficial de código aberto mantido por Mark Qvist:
              </p>
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 space-y-2">
                <div className="text-slate-500"># 1. Instalar o Reticulum Network Stack via pip</div>
                <div className="text-emerald-400">pip install rns</div>
                <div className="text-slate-500 mt-2"># 2. Iniciar o daemon de segundo plano do Reticulum</div>
                <div className="text-cyan-400">rnsd</div>
                <div className="text-slate-500 mt-2"># 3. Conferir suas interfaces e taxa de dados</div>
                <div className="text-amber-400">rnstatus</div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* ABA 2: IDENTIDADES & DESTINOS (rnid)                                */}
        {/* ================================================================== */}
        {activeTab === 'identidades' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lista e Criação de Identidades */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md space-y-5">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-cyan-400" />
                  Identidades Reticulum Locais
                </h3>
                <p className="text-xs text-slate-400">
                  Pares de chaves Ed25519 que representam seus rádios e operadores soberanos
                </p>
              </div>

              {/* Formulário para Nova Identidade */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="text-xs text-slate-300 font-semibold block">Nome / Rótulo da Identidade:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ex: Rádio Base Tático"
                    value={newIdentityAlias}
                    onChange={(e) => setNewIdentityAlias(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    onClick={handleCreateIdentity}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Criar</span>
                  </button>
                </div>
              </div>

              {/* Lista de Identidades Existentes */}
              <div className="space-y-2">
                {identities.map((id, index) => (
                  <div
                    key={id.id}
                    onClick={() => setSelectedIdentityIndex(index)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      selectedIdentityIndex === index
                        ? 'bg-cyan-950/20 border-cyan-500/50 shadow-sm'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-xs text-white">{id.alias}</strong>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(id.createdTimestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-cyan-400 font-mono truncate">
                      Hash: &lt;{id.hash}&gt;
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Painel de Detalhes da Identidade & Calculadora de Destinos */}
            <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  Calculadora Criptográfica de Destino Reticulum
                </h3>
                <p className="text-xs text-slate-400">
                  Os Destinos são endpoints de 16-bytes derivados deterministicamente do par de chaves e da aplicação.
                </p>
              </div>

              {/* Chaves da Identidade Ativa */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1">Identidade Selecionada:</span>
                  <span className="text-white font-bold text-sm">{activeIdentity.alias}</span>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-slate-400">Chave Pública Ed25519 (Hex 32-bytes):</span>
                    <button
                      onClick={() => handleCopy(activeIdentity.publicKeyHex, 'pubkey')}
                      className="text-cyan-400 hover:text-cyan-300 font-mono text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedTextKey === 'pubkey' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedTextKey === 'pubkey' ? 'Copiado!' : 'Copiar'}</span>
                    </button>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-cyan-300 text-[11px] break-all">
                    {activeIdentity.publicKeyHex}
                  </div>
                </div>

                {activeIdentity.privateKeyHex && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-slate-400">Chave Privada (Segredo de Assinatura):</span>
                      <button
                        onClick={() => handleCopy(activeIdentity.privateKeyHex!, 'privkey')}
                        className="text-rose-400 hover:text-rose-300 font-mono text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        {copiedTextKey === 'privkey' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedTextKey === 'privkey' ? 'Copiada!' : 'Copiar'}</span>
                      </button>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-rose-300 text-[11px] break-all">
                      {activeIdentity.privateKeyHex}
                    </div>
                  </div>
                )}
              </div>

              {/* Derivação de Destino */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider text-slate-400">
                  Parâmetros de Derivação de Destino
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Nome da Aplicação (App Name):</label>
                    <select
                      value={selectedAppName}
                      onChange={(e) => setSelectedAppName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="lxmf.delivery">lxmf.delivery (Mensageiro E2EE P2P)</option>
                      <option value="nomadnet.page">nomadnet.page (Páginas Offline & BBS)</option>
                      <option value="rncp.file">rncp.file (Transferência de Arquivos)</option>
                      <option value="jyy.chat">jyy.chat (Chat Mesh Soberano)</option>
                      <option value="custom.app">custom.app (Aplicação Customizada)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Aspectos Adicionais (separados por vírgula):</label>
                    <input
                      type="text"
                      value={customAspects}
                      onChange={(e) => setCustomAspects(e.target.value)}
                      placeholder="ex: node, sovereign, primary"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                {/* Hash Resultante */}
                <div className="pt-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-emerald-400 font-bold">Destination Hash Calculado (16 Bytes / 32 Hex):</span>
                    <button
                      onClick={() => handleCopy(currentDestinationHash, 'desthash')}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedTextKey === 'desthash' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedTextKey === 'desthash' ? 'Hash Copiado!' : 'Copiar Hash'}</span>
                    </button>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/40 text-emerald-300 font-mono text-sm font-bold tracking-wider break-all">
                    &lt;{currentDestinationHash}&gt;
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* ABA 3: CONFIGURADOR DE INTERFACES (~/.reticulum/config)            */}
        {/* ================================================================== */}
        {activeTab === 'configurador' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gerenciador Visual de Interfaces */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-emerald-400" />
                    Interfaces de Comunicação Ativas
                  </h3>
                  <p className="text-xs text-slate-400">
                    O Reticulum multiplexa rádio LoRa, Wi-Fi local, cabos e internet
                  </p>
                </div>
              </div>

              {/* Opções Globais */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-white font-bold">Habilitar Roteamento de Trânsito (enable_transport):</span>
                    <p className="text-[11px] text-slate-500">Permite que este nó encaminhe pacotes de outros nós como repetidor</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableTransport}
                    onChange={(e) => setEnableTransport(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-0 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between border-t border-slate-800 pt-3">
                  <div>
                    <span className="text-white font-bold">Compartilhar Informações do Nó (share_node_info):</span>
                    <p className="text-[11px] text-slate-500">Facilita descoberta e visualização em mapas públicos de nós</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={shareNodeInfo}
                    onChange={(e) => setShareNodeInfo(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-0 cursor-pointer"
                  />
                </div>
              </div>

              {/* Lista de Interfaces */}
              <div className="space-y-3">
                {interfaces.map((iface) => (
                  <div
                    key={iface.id}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            iface.enabled ? 'bg-emerald-500' : 'bg-slate-600'
                          }`}
                        />
                        <strong className="text-white text-sm">{iface.name}</strong>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 font-mono">
                          {iface.type}
                        </span>
                      </div>

                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-400">
                        <span>{iface.enabled ? 'Ativa' : 'Desativada'}</span>
                        <input
                          type="checkbox"
                          checked={iface.enabled}
                          onChange={(e) => {
                            setInterfaces((prev) =>
                              prev.map((i) => (i.id === iface.id ? { ...i, enabled: e.target.checked } : i))
                            );
                          }}
                          className="w-4 h-4"
                        />
                      </label>
                    </div>

                    <div className="text-slate-400 text-[11px] font-mono">
                      {iface.type === 'AutoInterface' && 'Auto-descoberta zero-conf local via IPv6/UDP broadcast'}
                      {iface.type === 'TCPClientInterface' && `Alvo: ${iface.targetHost}:${iface.targetPort}`}
                      {iface.type === 'TCPServerInterface' && `Porta de Escuta: ${iface.listenIp}:${iface.listenPort}`}
                      {iface.type === 'RNodeInterface' &&
                        `Porta: ${iface.port} • Freq: ${iface.frequencyMhz} MHz • SF${iface.spreadingFactor} • BW ${iface.bandwidthKhz} kHz • TX ${iface.txPowerDbm} dBm`}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visualizador de Configuração ~/.reticulum/config */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-cyan-400" />
                      Visualizador ~/.reticulum/config
                    </h3>
                    <p className="text-xs text-slate-400">Arquivo pronto para ser salvo diretamente no seu sistema</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedConfigFile);
                        setCopiedConfig(true);
                        setTimeout(() => setCopiedConfig(false), 2000);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedConfig ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedConfig ? 'Copiado!' : 'Copiar'}</span>
                    </button>

                    <button
                      onClick={handleDownloadConfig}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Baixar config</span>
                    </button>
                  </div>
                </div>

                <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 max-h-[480px] overflow-y-auto scrollbar-thin">
                  <pre className="font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {generatedConfigFile}
                  </pre>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400">
                💡 <strong>Dica de Instalação:</strong> No Linux ou Mac, salve este arquivo em <code>~/.reticulum/config</code>. No Windows, salve em <code>%USERPROFILE%\.reticulum\config</code>.
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* ABA 4: TERMINAL DE FERRAMENTAS CLI (rnstatus / rnpath / rnprobe)    */}
        {/* ================================================================== */}
        {activeTab === 'terminal' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-purple-400" />
                    Terminal Virtual de Utilitários Oficiais Reticulum
                  </h3>
                  <p className="text-xs text-slate-400">
                    Teste interativamente os comandos oficiais do RNS: <code>rnstatus</code>, <code>rnpath</code>, <code>rnprobe</code>, <code>rnid</code> e <code>rnodeconf</code>.
                  </p>
                </div>

                {/* Atalhos de Comandos Rápidos */}
                <div className="flex flex-wrap gap-1.5">
                  {['rnstatus', 'rnpath', 'rnprobe 82a93b41c0e81254bf69d45e0a1b2c3d', 'rnodeconf', 'rnid'].map((quickCmd) => (
                    <button
                      key={quickCmd}
                      onClick={() => handleRunCommand(quickCmd)}
                      className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-purple-300 border border-purple-500/30 text-[11px] font-mono cursor-pointer transition-colors"
                    >
                      {quickCmd.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Janela de Terminal Preto / Retrô */}
              <div className="rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden font-mono text-xs">
                {/* Barra do Terminal */}
                <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-slate-400 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                    <span className="ml-2 text-slate-300 font-semibold">rns-session @ sovereign-node</span>
                  </div>
                  <button
                    onClick={() => setCliHistory([])}
                    className="text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    Limpar
                  </button>
                </div>

                {/* Histórico do Terminal */}
                <div className="p-4 space-y-4 max-h-[420px] overflow-y-auto scrollbar-thin">
                  {cliHistory.map((item, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center gap-2 text-slate-400">
                        <span className="text-emerald-400 font-bold">rns@sovereign:~$</span>
                        <span className="text-white font-bold">{item.cmd}</span>
                      </div>
                      <pre className="text-slate-300 whitespace-pre-wrap leading-relaxed pl-4 border-l-2 border-slate-800 py-1">
                        {item.out}
                      </pre>
                    </div>
                  ))}
                </div>

                {/* Linha de Entrada do Prompt */}
                <div className="p-3 bg-slate-900/50 border-t border-slate-800/80 flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">rns@sovereign:~$</span>
                  <input
                    type="text"
                    value={cliInput}
                    onChange={(e) => setCliInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRunCommand();
                    }}
                    placeholder="Digite um comando (ex: rnstatus, rnpath, rnprobe <hash>)..."
                    className="flex-1 bg-transparent border-none text-white focus:outline-none font-mono text-xs"
                  />
                  <button
                    onClick={() => handleRunCommand()}
                    className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs cursor-pointer"
                  >
                    Executar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* ABA 5: MENSAGEIRO LXMF (P2P E2EE)                                  */}
        {/* ================================================================== */}
        {activeTab === 'lxmf' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Compositor de Mensagens LXMF */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-pink-400" />
                  Compositor de Mensagens LXMF
                </h3>
                <p className="text-xs text-slate-400">
                  Lightweight eXtensible Message Format: Mensagens autônomas P2P com recibo criptográfico
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Destino Alvo (Destination Hash 16-Bytes):</label>
                  <select
                    value={targetDestinationHash}
                    onChange={(e) => setTargetDestinationHash(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono text-[11px] focus:outline-none focus:border-pink-500"
                  >
                    {paths.map((p) => (
                      <option key={p.destinationHash} value={p.destinationHash}>
                        {p.destinationAlias} ({p.destinationHash.slice(0, 10)}...)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Assunto / Título:</label>
                  <input
                    type="text"
                    placeholder="Título da Mensagem..."
                    value={newMsgTitle}
                    onChange={(e) => setNewMsgTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Conteúdo da Mensagem:</label>
                  <textarea
                    rows={4}
                    placeholder="Escreva sua mensagem soberana para a malha Reticulum..."
                    value={newMsgContent}
                    onChange={(e) => setNewMsgContent(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-pink-500 resize-none"
                  />
                </div>

                <button
                  onClick={handleSendLxmf}
                  disabled={isSendingLxmf || !newMsgContent.trim()}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  <Send className={`w-4 h-4 ${isSendingLxmf ? 'animate-bounce' : ''}`} />
                  <span>{isSendingLxmf ? 'Transmitindo via Link RNS...' : 'Disparar Pacote LXMF na Malha'}</span>
                </button>
              </div>
            </div>

            {/* Lista de Mensagens Recebidas / Transmitidas */}
            <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  Feed de Mensagens LXMF Autenticadas ({lxmfMessages.length})
                </h3>
                <span className="text-xs text-slate-400 font-mono">Cifra: Ed25519 + ChaCha20</span>
              </div>

              <div className="space-y-4 max-h-[520px] overflow-y-auto scrollbar-thin">
                {lxmfMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                      <div className="flex items-center gap-2">
                        <strong className="text-white text-sm">{msg.title}</strong>
                        <span
                          className={`px-2 py-0.2 rounded font-bold text-[9px] ${
                            msg.state === 'DELIVERED'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {msg.state === 'DELIVERED' ? 'ENTREGUE & COMPROVADO' : 'TRANSMITINDO'}
                        </span>
                      </div>
                      <span className="text-slate-500 font-mono">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-mono">
                      <span>De: <strong className="text-cyan-300">{msg.sourceAlias}</strong></span>
                      <span>→ Para: <strong className="text-purple-300">{msg.targetAlias}</strong></span>
                      {msg.rttMs && <span className="text-amber-400">RTT: {msg.rttMs} ms</span>}
                      <span>({msg.wireBytesLength} bytes na malha)</span>
                    </div>

                    <p className="text-slate-200 leading-relaxed pt-1 border-t border-slate-800/80">
                      {msg.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* ABA 6: RADAR DE ROTAS & SNIFFER RNS                                */}
        {/* ================================================================== */}
        {activeTab === 'rotas' && (
          <div className="space-y-6">
            {/* Tabela de Rotas / Paths */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Compass className="w-4 h-4 text-amber-400" />
                    Tabela de Rotas Ativas (Reticulum Path Table)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Rotas descobertas probabilisticamente através de Announces com métricas de saltos
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Destino (Destination Hash)</th>
                      <th className="py-2.5 px-3">Nome / Alias</th>
                      <th className="py-2.5 px-3">Saltos (Hops)</th>
                      <th className="py-2.5 px-3">Interface de Saída</th>
                      <th className="py-2.5 px-3">Taxa de Dados</th>
                      <th className="py-2.5 px-3">Expira em</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {paths.map((p) => (
                      <tr key={p.destinationHash} className="hover:bg-slate-850">
                        <td className="py-2.5 px-3 text-cyan-300">&lt;{p.destinationHash.slice(0, 16)}...&gt;</td>
                        <td className="py-2.5 px-3 text-white font-sans font-semibold">{p.destinationAlias}</td>
                        <td className="py-2.5 px-3 text-amber-400 font-bold">{p.hops} salto(s)</td>
                        <td className="py-2.5 px-3 text-slate-300">{p.nextHopInterface}</td>
                        <td className="py-2.5 px-3 text-emerald-400">{(p.rateBps / 1000).toFixed(1)} kbps</td>
                        <td className="py-2.5 px-3 text-slate-400">{p.expiresSeconds}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sniffer de Pacotes Reticulum */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    Sniffer de Pacotes Brutos Reticulum (Wire Format)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Inspeção dos pacotes binários transitando sobre as interfaces físicas
                  </p>
                </div>
              </div>

              <div className="space-y-2 font-mono text-xs max-h-[360px] overflow-y-auto scrollbar-thin">
                {packets.map((pkt) => (
                  <div
                    key={pkt.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          pkt.packetType === 'ANNOUNCE'
                            ? 'bg-purple-500/20 text-purple-300'
                            : pkt.packetType === 'DATA'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : pkt.packetType === 'LINK_REQUEST'
                            ? 'bg-cyan-500/20 text-cyan-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {pkt.packetType}
                      </span>
                      <span className="text-slate-300 font-sans">{pkt.summary}</span>
                    </div>

                    <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                      <span>{pkt.interfaceName}</span>
                      <span>{pkt.rawLengthBytes}B</span>
                      <span>{new Date(pkt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
