import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Activity,
  Users,
  Radio,
  Clock,
  Inbox,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Zap,
  RotateCcw,
  Plus,
  RefreshCw,
  Send,
  Sliders,
  Lock,
  Eye,
  VolumeX,
  Volume2,
  Cpu,
  FileText,
  Search,
  Trash2,
  Wifi,
  ExternalLink,
  Share2,
  Key,
  Terminal,
  SlidersHorizontal,
  Signal,
  Battery,
  MapPin,
  Compass,
  Check,
  Copy,
  Sparkles,
  Smartphone,
  Download,
} from 'lucide-react';
import {
  AvaliadorReputacao,
  PontuacaoPeer,
  ClassificacaoPeer,
} from '../utils/jjyReputacao';
import {
  RegistroAuditoria,
  EventoAuditoria,
  GravidadeAuditoria,
  OrigemAuditoria,
} from '../utils/jjyAuditoria';
import {
  GestorVizinhanca,
  Vizinho,
  EstadoVizinho,
  MeioEnlace,
} from '../utils/jjyVizinhanca';
import {
  FilaStoreAndForward,
  EntradaFila,
  PrioridadeMensagem,
} from '../utils/jjyFila';
import {
  DiagnosticoNo,
  RelatorioSaude,
  EstadoSaude,
} from '../utils/jjyDiagnostico';
import {
  AgendaTarefas,
  TarefaAgendada,
  DisparoAgenda,
} from '../utils/jjyAgenda';
import {
  LORA_REGIONS,
  LORA_MODEM_PRESETS,
  LORA_HARDWARE_PROFILES,
  MeshtasticNode,
  INITIAL_MESH_NODES,
  calculateLoraTimeOnAir,
  connectWebSerialPort,
  sendWebSerialCommand,
  SerialPortController,
  MeshtasticSovereignConfig,
  loadMeshtasticSovereignConfig,
  saveMeshtasticSovereignConfig,
  generateRandomMeshtasticPsk,
  convertSnrRssiToLqi,
} from '../utils/loraMeshEngine';

type MeshSubTab = 'reputacao' | 'auditoria' | 'vizinhanca' | 'fila' | 'diagnostico' | 'agenda' | 'meshtastic';

export const JjyMeshProtocolView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MeshSubTab>(() => {
    try {
      const stored = sessionStorage.getItem('jjy_mesh_subtab') || localStorage.getItem('jjy_mesh_subtab');
      if (stored === 'meshtastic') return 'meshtastic';
      if (stored && ['reputacao', 'auditoria', 'vizinhanca', 'fila', 'diagnostico', 'agenda', 'meshtastic'].includes(stored)) {
        return stored as MeshSubTab;
      }
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('meshtastic')) return 'meshtastic';
      const search = new URLSearchParams(window.location.search);
      if (search.get('subtab') === 'meshtastic' || search.get('tab') === 'meshtastic') return 'meshtastic';
    } catch {}
    return 'reputacao';
  });

  const handleSelectSubTab = (subtab: MeshSubTab) => {
    setActiveTab(subtab);
    try {
      sessionStorage.setItem('jjy_mesh_subtab', subtab);
      localStorage.setItem('jjy_mesh_subtab', subtab);
    } catch {}
  };

  useEffect(() => {
    const handleSubtabSync = (e?: any) => {
      try {
        const target = e?.detail || sessionStorage.getItem('jjy_mesh_subtab') || localStorage.getItem('jjy_mesh_subtab');
        if (target && ['reputacao', 'auditoria', 'vizinhanca', 'fila', 'diagnostico', 'agenda', 'meshtastic'].includes(target)) {
          setActiveTab(target as MeshSubTab);
        } else if (window.location.hash.toLowerCase().includes('meshtastic')) {
          setActiveTab('meshtastic');
        }
      } catch {}
    };

    window.addEventListener('jjy_mesh_subtab_change', handleSubtabSync);
    window.addEventListener('hashchange', handleSubtabSync);
    window.addEventListener('storage', handleSubtabSync);
    return () => {
      window.removeEventListener('jjy_mesh_subtab_change', handleSubtabSync);
      window.removeEventListener('hashchange', handleSubtabSync);
      window.removeEventListener('storage', handleSubtabSync);
    };
  }, []);

  // Instâncias dos subsistemas
  const avaliadorRef = useRef<AvaliadorReputacao>(new AvaliadorReputacao());
  const auditoriaRef = useRef<RegistroAuditoria>(new RegistroAuditoria());
  const vizinhancaRef = useRef<GestorVizinhanca>(new GestorVizinhanca());
  const filaRef = useRef<FilaStoreAndForward>(new FilaStoreAndForward());
  const diagnosticoRef = useRef<DiagnosticoNo>(new DiagnosticoNo());
  const agendaRef = useRef<AgendaTarefas>(new AgendaTarefas());

  // Estados locais para re-renderização
  const [currentTick, setCurrentTick] = useState(0);
  const [peersReputacao, setPeersReputacao] = useState<PontuacaoPeer[]>([]);
  const [eventosAuditoria, setEventosAuditoria] = useState<EventoAuditoria[]>([]);
  const [vizinhos, setVizinhos] = useState<Vizinho[]>([]);
  const [mensagensFila, setMensagensFila] = useState<EntradaFila[]>([]);
  const [relatorioSaude, setRelatorioSaude] = useState<RelatorioSaude | null>(null);
  const [tarefasAgenda, setTarefasAgenda] = useState<TarefaAgendada[]>([]);
  const [isEmconActive, setIsEmconActive] = useState(false);
  const [disparosRecentes, setDisparosRecentes] = useState<DisparoAgenda[]>([]);

  // Formulários e Filtros
  const [novoPeerId, setNovoPeerId] = useState('');
  const [filtroGravidade, setFiltroGravidade] = useState<string>('todos');
  const [filtroOrigem, setFiltroOrigem] = useState<string>('todos');
  const [buscaAudit, setBuscaAudit] = useState('');

  // Formulário Fila DTN
  const [filaDestino, setFilaDestino] = useState('NÓ-BRAVO');
  const [filaConteudo, setFilaConteudo] = useState('Relatório tático de reconhecimento');
  const [filaPrioridade, setFilaPrioridade] = useState<PrioridadeMensagem>('Normal');

  // Formulário Agenda
  const [agendaTag, setAgendaTag] = useState('BEACON-TÁTICO');
  const [agendaIntervalo, setAgendaIntervalo] = useState(15);
  const [agendaTipo, setAgendaTipo] = useState<'UmaVez' | 'Periodica'>('Periodica');

  // Estados para Refinamento do Meshtastic Sovereign Mesh
  const [meshtasticConfig, setMeshtasticConfig] = useState<MeshtasticSovereignConfig>(loadMeshtasticSovereignConfig);
  const [meshtasticNodes, setMeshtasticNodes] = useState<MeshtasticNode[]>(INITIAL_MESH_NODES);
  const [serialCtrl, setSerialCtrl] = useState<SerialPortController | null>(null);
  const [serialLogs, setSerialLogs] = useState<string[]>([
    '[INIT] Subsistema RF Meshtastic inicializado.',
    '[READY] Slot 915.000 MHz sincronizado com o JJY Chat.'
  ]);
  const [meshtasticTestMsg, setMeshtasticTestMsg] = useState('JJY Sovereign Mesh Beacon - Canal Seguro Ativo');
  const [meshtasticSyncToast, setMeshtasticSyncToast] = useState('');
  const [isSerialConnecting, setIsSerialConnecting] = useState(false);
  const [selectedMeshtasticNodeId, setSelectedMeshtasticNodeId] = useState('^all');
  const [copiedKeyToast, setCopiedKeyToast] = useState(false);

  // Handlers do Meshtastic Sovereign Mesh
  const handleUpdateMeshtasticConfig = (patch: Partial<MeshtasticSovereignConfig>) => {
    const updated = { ...meshtasticConfig, ...patch };
    setMeshtasticConfig(updated);
    saveMeshtasticSovereignConfig(updated);
    setMeshtasticSyncToast('Configuração RF salva e sincronizada com JJY Chat!');
    setTimeout(() => setMeshtasticSyncToast(''), 3000);
  };

  const handleGenerateNewPsk = () => {
    const newKey = generateRandomMeshtasticPsk();
    handleUpdateMeshtasticConfig({
      channelKeyPsk: newKey,
      channelPskType: 'custom_aes256',
    });
  };

  const handleBridgeMeshtasticToJjy = () => {
    const viz = vizinhancaRef.current;
    const rep = avaliadorRef.current;
    const aud = auditoriaRef.current;

    meshtasticNodes.forEach((n) => {
      viz.adicionar(n.shortName, 'LoRa_RF');
      const lqi = convertSnrRssiToLqi(n.rssi, n.snr);
      viz.atualizarQualidade(n.shortName, lqi);
      if (lqi >= 300) {
        viz.promover(n.shortName);
      }
      rep.registrarCooperacao(n.shortName);
      rep.registrarSucesso(n.shortName);
      aud.info(
        'Malha',
        `Nó Meshtastic [${n.nodeId}] ${n.longName} (${n.role}) integrado com LQI ${lqi}/1000 via RF 915MHz`,
        n.shortName
      );
    });

    atualizarTodosOsEstados();
    setMeshtasticSyncToast('Nós Meshtastic integrados à Vizinhança e Reputação do JJY!');
    setTimeout(() => setMeshtasticSyncToast(''), 3500);
  };

  const handleConnectSerial = async () => {
    if (serialCtrl?.isConnected) {
      try {
        await serialCtrl.port?.close();
      } catch (e) {
        console.warn('Erro ao fechar serial:', e);
      }
      setSerialCtrl(null);
      handleUpdateMeshtasticConfig({ serialConnected: false });
      setSerialLogs((prev) => [...prev, '[DISCONNECT] Porta USB desconectada.']);
      return;
    }

    setIsSerialConnecting(true);
    setSerialLogs((prev) => [...prev, `[SERIAL] Solicitando porta USB (${meshtasticConfig.baudRate} bps)...`]);

    const ctrl = await connectWebSerialPort(
      meshtasticConfig.baudRate,
      (chunk) => {
        setSerialLogs((prev) => [...prev.slice(-30), `[RX] ${chunk.trim()}`]);
        auditoriaRef.current.info('Malha', `Pacote RF recebido via USB: ${chunk.trim().slice(0, 40)}`);
        atualizarTodosOsEstados();
      },
      (err) => {
        setSerialLogs((prev) => [...prev, `[ERROR] ${err}`]);
      }
    );

    setIsSerialConnecting(false);
    if (ctrl) {
      setSerialCtrl(ctrl);
      handleUpdateMeshtasticConfig({ serialConnected: true });
      setSerialLogs((prev) => [...prev, '[CONNECTED] Hardware Meshtastic conectado com sucesso via USB.']);
      auditoriaRef.current.info('Malha', 'Dispositivo Meshtastic USB conectado ao núcleo');
      atualizarTodosOsEstados();
    }
  };

  const handleSendMeshtasticPacket = async () => {
    if (!meshtasticTestMsg.trim()) return;
    const curModem = LORA_MODEM_PRESETS.find((p) => p.id === meshtasticConfig.modemPresetId) || LORA_MODEM_PRESETS[0];
    const { toaMs } = calculateLoraTimeOnAir(meshtasticTestMsg.length, curModem.spreadingFactor, curModem.bandwidthKhz);

    const logEntry = `[TX] Destino=${selectedMeshtasticNodeId} Ch=${meshtasticConfig.channelName} ToA=${toaMs}ms Payload="${meshtasticTestMsg}"`;
    setSerialLogs((prev) => [...prev.slice(-30), logEntry]);

    if (serialCtrl?.isConnected) {
      await sendWebSerialCommand(serialCtrl, `${meshtasticTestMsg}\n`);
    }

    auditoriaRef.current.info(
      'Malha',
      `Transmissão RF Meshtastic: ToA ${toaMs}ms, SF${curModem.spreadingFactor}, HopLimit=${meshtasticConfig.hopLimit}`,
      selectedMeshtasticNodeId === '^all' ? undefined : selectedMeshtasticNodeId
    );

    if (meshtasticConfig.bridgeWithJjyFila) {
      filaRef.current.enfileirar(
        selectedMeshtasticNodeId,
        `[LoRa Mesh] ${meshtasticTestMsg}`,
        'Alta',
        180
      );
    }

    atualizarTodosOsEstados();
    setMeshtasticSyncToast(`Pacote RF transmitido (ToA: ${toaMs}ms)!`);
    setTimeout(() => setMeshtasticSyncToast(''), 3000);
  };

  const handleOpenJjyChatMeshtastic = () => {
    saveMeshtasticSovereignConfig(meshtasticConfig);
    localStorage.setItem('jjy_chat_model', 'meshtastic');
    window.open('/chat.html?model=meshtastic', '_blank');
  };

  // Inicialização de dados demonstrativos realistas do JJY Mesh
  useEffect(() => {
    const rep = avaliadorRef.current;
    const aud = auditoriaRef.current;
    const viz = vizinhancaRef.current;
    const fil = filaRef.current;

    // Popula nós na reputação
    rep.registrarSucesso('NÓ-ALPHA');
    rep.registrarSucesso('NÓ-ALPHA');
    rep.registrarSucesso('NÓ-ALPHA');
    for (let i = 0; i < 110; i++) rep.registrarSucesso('NÓ-ALPHA'); // Confiável

    rep.registrarSucesso('NÓ-BRAVO'); // Neutro
    rep.registrarCooperacao('NÓ-BRAVO');

    for (let i = 0; i < 6; i++) rep.registrarInfracao('NÓ-DELTA'); // Suspeito
    for (let i = 0; i < 12; i++) rep.registrarInfracao('NÓ-ZULU'); // Bloqueado

    // Popula vizinhança
    viz.adicionar('NÓ-ALPHA', 'Acoustic');
    viz.atualizarQualidade('NÓ-ALPHA', 380);
    viz.promover('NÓ-ALPHA');

    viz.adicionar('NÓ-BRAVO', 'UDP');
    viz.atualizarQualidade('NÓ-BRAVO', 120);
    viz.promover('NÓ-BRAVO');

    viz.adicionar('NÓ-CHARLIE', 'BLE');
    viz.adicionar('NÓ-DELTA', 'Acoustic');

    // Popula eventos de auditoria
    aud.info('Malha', 'Nó local inicializado na frequência soberana JJY', undefined);
    aud.info('Reputacao', 'Nó NÓ-ALPHA promovido a Confiável (Score: 720)', 'NÓ-ALPHA');
    aud.aviso('Guard', 'NÓ-DELTA apresentou pacotes desordenados (-50 pts)', 'NÓ-DELTA');
    aud.erro('Reputacao', 'NÓ-ZULU excedeu limiar de segurança e foi Bloqueado', 'NÓ-ZULU');

    // Popula fila DTN
    fil.enfileirar('NÓ-BRAVO', 'Coordenadas do ponto de extração: -23.5505, -46.6333', 'Alta', 600);
    fil.enfileirar('NÓ-CHARLIE', 'Chave efêmera pós-quântica ML-KEM-768 enviada', 'Normal', 400);

    // Agenda inicial
    agendaRef.current.agendarPeriodica('BEACON-HEARTBEAT', 20, 'Transmissão periódica de presença na malha');

    atualizarTodosOsEstados();

    // Sincronização em tempo real de configurações vindas do Chat ou abas paralelas
    const handleExternalSync = () => {
      setMeshtasticConfig(loadMeshtasticSovereignConfig());
    };
    window.addEventListener('jjy_mesh_sync', handleExternalSync);
    window.addEventListener('storage', handleExternalSync);

    return () => {
      window.removeEventListener('jjy_mesh_sync', handleExternalSync);
      window.removeEventListener('storage', handleExternalSync);
    };
  }, []);

  const atualizarTodosOsEstados = () => {
    setCurrentTick(avaliadorRef.current.getTickAtual());
    setPeersReputacao(avaliadorRef.current.todos());
    setEventosAuditoria(auditoriaRef.current.todos());
    setVizinhos(vizinhancaRef.current.todos());
    setMensagensFila(filaRef.current.todas());
    setRelatorioSaude(diagnosticoRef.current.obterRelatorio());
    setTarefasAgenda(agendaRef.current.todas());
    setIsEmconActive(agendaRef.current.isEmconAtivo());
  };

  // Tick Manual / Avanço do Relógio Lógico do Nó
  const handleAvancarTick = (quantidade = 1) => {
    for (let i = 0; i < quantidade; i++) {
      avaliadorRef.current.tick();
      auditoriaRef.current.tick();
      vizinhancaRef.current.tick();
      filaRef.current.tick();
      diagnosticoRef.current.tick();
      const disparos = agendaRef.current.tick();
      if (disparos.length > 0) {
        setDisparosRecentes((prev) => [...disparos, ...prev].slice(0, 15));
        for (const d of disparos) {
          auditoriaRef.current.info('Malha', `Agenda: Disparo da tarefa [${d.tag}] (execução #${d.execucaoNumero})`);
        }
      }
    }
    atualizarTodosOsEstados();
  };

  // Handlers de Reputação
  const handleAddPeer = () => {
    if (!novoPeerId.trim()) return;
    avaliadorRef.current.registrarSucesso(novoPeerId.trim().toUpperCase());
    vizinhancaRef.current.adicionar(novoPeerId.trim().toUpperCase(), 'Acoustic');
    auditoriaRef.current.info('Reputacao', `Novo peer [${novoPeerId.trim().toUpperCase()}] adicionado manualmente`);
    setNovoPeerId('');
    atualizarTodosOsEstados();
  };

  const handleSimularSucesso = (id: string) => {
    avaliadorRef.current.registrarSucesso(id);
    vizinhancaRef.current.contato(id, Math.floor(Math.random() * 40 + 20));
    vizinhancaRef.current.atualizarQualidade(id, 15);
    auditoriaRef.current.info('Reputacao', `Transmissão com sucesso para ${id} (+2 pts)`, id);
    atualizarTodosOsEstados();
  };

  const handleSimularFalha = (id: string) => {
    avaliadorRef.current.registrarFalha(id);
    vizinhancaRef.current.atualizarQualidade(id, -30);
    auditoriaRef.current.aviso('Reputacao', `Falha de entrega acústica com ${id} (-5 pts)`, id);
    atualizarTodosOsEstados();
  };

  const handleSimularInfracao = (id: string) => {
    avaliadorRef.current.registrarInfracao(id);
    vizinhancaRef.current.atualizarQualidade(id, -150);
    auditoriaRef.current.erro('Guard', `Infração ou checksum inválido detectado de ${id} (-50 pts)`, id);
    diagnosticoRef.current.gerarAlerta('Atencao', 'Guard', `Possível nó malicioso detectado: ${id}`);
    atualizarTodosOsEstados();
  };

  const handlePerdoar = (id: string) => {
    avaliadorRef.current.perdoar(id);
    auditoriaRef.current.info('Reputacao', `Nó ${id} reabilitado manualmente para 500 pontos`, id);
    atualizarTodosOsEstados();
  };

  const handleDecair = () => {
    avaliadorRef.current.decair();
    auditoriaRef.current.info('Reputacao', 'Decaimento temporal aplicado a todos os peers');
    atualizarTodosOsEstados();
  };

  // Handlers de Vizinhança
  const handlePromover = (id: string) => {
    if (vizinhancaRef.current.promover(id)) {
      auditoriaRef.current.info('Malha', `Vizinho ${id} promovido a Ativo no roteamento`, id);
      atualizarTodosOsEstados();
    }
  };

  const handleRebaixar = (id: string) => {
    if (vizinhancaRef.current.rebaixar(id)) {
      auditoriaRef.current.aviso('Malha', `Vizinho ${id} rebaixado para Candidato`, id);
      atualizarTodosOsEstados();
    }
  };

  // Handlers da Fila Store-and-Forward
  const handleEnfileirarMensagem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!filaDestino.trim() || !filaConteudo.trim()) return;

    const res = filaRef.current.enfileirar(filaDestino.toUpperCase(), filaConteudo, filaPrioridade);
    if (res.sucesso) {
      auditoriaRef.current.info(
        'Malha',
        `Mensagem DTN enfileirada para ${filaDestino.toUpperCase()} [Prioridade: ${filaPrioridade}]`,
        filaDestino.toUpperCase()
      );
      setFilaConteudo('');
      atualizarTodosOsEstados();
    }
  };

  const handleDespacharMensagem = (id: string, destino: string) => {
    filaRef.current.confirmarEntrega(id);
    auditoriaRef.current.info('Malha', `Mensagem DTN entregue com sucesso a ${destino}`, destino);
    avaliadorRef.current.registrarSucesso(destino);
    atualizarTodosOsEstados();
  };

  // Handlers da Agenda
  const handleAgendarTarefa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agendaTag.trim()) return;

    if (agendaTipo === 'Periodica') {
      agendaRef.current.agendarPeriodica(agendaTag.toUpperCase(), agendaIntervalo, 'Tarefa agendada via painel tático');
    } else {
      agendaRef.current.agendarUmaVez(agendaTag.toUpperCase(), agendaIntervalo, 'Tarefa agendada pontual');
    }

    auditoriaRef.current.info('Governanca', `Nova tarefa agendada: [${agendaTag.toUpperCase()}] a cada ${agendaIntervalo} ticks`);
    atualizarTodosOsEstados();
  };

  const toggleEmcon = () => {
    const novoStatus = !isEmconActive;
    agendaRef.current.setEmconSilencio(novoStatus);
    setIsEmconActive(novoStatus);
    if (novoStatus) {
      auditoriaRef.current.critico('Malha', 'SILÊNCIO DE RÁDIO EMCON ATIVADO! Nenhuma emissão permitida.');
      diagnosticoRef.current.atualizarSubsistema('Enlace Acústico', 'Degradado', 'Silêncio EMCON ativo (escuta passiva apenas)');
    } else {
      auditoriaRef.current.info('Malha', 'Silêncio EMCON desativado. Transmissões liberadas.');
      diagnosticoRef.current.atualizarSubsistema('Enlace Acústico', 'Saudavel', 'Driver acústico em plena operação');
    }
    atualizarTodosOsEstados();
  };

  // Renderizador de Badge de Classificação
  const renderClassificacaoBadge = (c: ClassificacaoPeer) => {
    switch (c) {
      case 'Confiavel':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
            <CheckCircle2 className="w-3.5 h-3.5" /> Confiável
          </span>
        );
      case 'Neutro':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1.5 shadow-sm">
            <HelpCircle className="w-3.5 h-3.5" /> Neutro
          </span>
        );
      case 'Suspeito':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 shadow-sm">
            <AlertTriangle className="w-3.5 h-3.5" /> Suspeito
          </span>
        );
      case 'Bloqueado':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5 shadow-sm">
            <XCircle className="w-3.5 h-3.5" /> Bloqueado
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* CABEÇALHO TÁTICO SOVEREIGN PROTOCOL */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white tracking-tight">
                  Protocolo JJY Sovereign Mesh
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                  RUST ENGINE SPEC v0
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Núcleo de Reputação, Auditoria Criptográfica, Vizinhança LQI, Fila DTN e Autodiagnóstico
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Relógio Lógico / Ticks */}
            <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 font-mono text-xs flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span className="text-slate-400">Tick:</span>
              <span className="text-cyan-300 font-bold">{currentTick}</span>
              <button
                type="button"
                onClick={() => handleAvancarTick(1)}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-bold transition-all ml-1"
                title="Avançar 1 tick lógico"
              >
                +1
              </button>
              <button
                type="button"
                onClick={() => handleAvancarTick(10)}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-bold transition-all"
                title="Avançar 10 ticks lógicos"
              >
                +10
              </button>
            </div>

            {/* Controle EMCON */}
            <button
              type="button"
              onClick={toggleEmcon}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
                isEmconActive
                  ? 'bg-rose-600 text-white shadow-rose-600/30 animate-pulse'
                  : 'bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300'
              }`}
              title="Controle de Emissão Silenciosa (Radio & Acoustic Silence)"
            >
              {isEmconActive ? (
                <>
                  <VolumeX className="w-4 h-4" />
                  <span>EMCON ATIVO (SILÊNCIO)</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-slate-400" />
                  <span>EMCON: NORMAL</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* NAVEGAÇÃO DE SUB-ABAS (Baseadas nos Crates Oficiais) */}
        <div className="flex items-center gap-1.5 mt-5 border-t border-slate-800/80 pt-4 overflow-x-auto text-xs font-semibold">
          <button
            type="button"
            onClick={() => handleSelectSubTab('reputacao')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'reputacao'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Reputação (Spec 36)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-950/80 text-cyan-200 font-mono">
              {peersReputacao.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSubTab('auditoria')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'auditoria'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Trilha de Auditoria (Spec 37)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-950/80 text-cyan-200 font-mono">
              {eventosAuditoria.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSubTab('vizinhanca')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'vizinhanca'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Vizinhança & LQI (Spec 39)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-950/80 text-cyan-200 font-mono">
              {vizinhos.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSubTab('fila')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'fila'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>Fila DTN Store-and-Forward</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-950/80 text-cyan-200 font-mono">
              {mensagensFila.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSubTab('diagnostico')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'diagnostico'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Saúde do Nó</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              relatorioSaude?.nivelAlertaGlobal === 'Normal' ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'
            }`}>
              {relatorioSaude?.nivelAlertaGlobal || 'Normal'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSubTab('agenda')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'agenda'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Agenda & EMCON</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-950/80 text-cyan-200 font-mono">
              {tarefasAgenda.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSubTab('meshtastic')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'meshtastic'
                ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow-lg shadow-emerald-950/60 ring-1 ring-emerald-400/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Radio className="w-4 h-4 text-emerald-400" />
            <span className="font-bold">Meshtastic & RF (Spec 42)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-950/80 text-emerald-300 font-mono font-bold border border-emerald-500/30">
              {meshtasticConfig.frequencyMhz.toFixed(1)} MHz
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. ABA DE REPUTAÇÃO DE PEERS (jjy-reputacao) */}
      {/* ========================================================================= */}
      {activeTab === 'reputacao' && (
        <div className="space-y-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  <span>Avaliador de Reputação Descentralizada (0 a 1000 pontos)</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Pontuações determinísticas sem ponto flutuante: Sucessos (+2), Falhas (-5), Cooperações (+1), Infrações (-50)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDecair}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all"
                  title="Aplica decaimento de 1 ponto em direção à neutralidade (500) para todos os nós"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Decair (-1 ao Neutro)</span>
                </button>
              </div>
            </div>

            {/* Cadastro de Novo Nó */}
            <div className="flex items-center gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800">
              <input
                type="text"
                placeholder="ID do Novo Peer (Ex: NÓ-ECHO)"
                value={novoPeerId}
                onChange={(e) => setNovoPeerId(e.target.value.toUpperCase())}
                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500 flex-1"
              />
              <button
                type="button"
                onClick={handleAddPeer}
                disabled={!novoPeerId.trim()}
                className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-md transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Peer
              </button>
            </div>

            {/* Tabela de Peers */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                    <th className="py-2.5 px-3">PEER ID</th>
                    <th className="py-2.5 px-3">STATUS</th>
                    <th className="py-2.5 px-3">SCORE (0-1000)</th>
                    <th className="py-2.5 px-3 text-center">SUCESSOS</th>
                    <th className="py-2.5 px-3 text-center">FALHAS</th>
                    <th className="py-2.5 px-3 text-center">COOPERAÇÃO</th>
                    <th className="py-2.5 px-3 text-center">INFRAÇÕES</th>
                    <th className="py-2.5 px-3 text-right">AÇÕES RÁPIDAS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {peersReputacao.map((p) => (
                    <tr key={p.peerId} className="hover:bg-slate-800/30 transition-all">
                      <td className="py-3 px-3 font-bold text-slate-200">
                        {p.peerId}
                      </td>
                      <td className="py-3 px-3">
                        {renderClassificacaoBadge(p.classificacao)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${
                            p.valor >= 700 ? 'text-emerald-400' : p.valor <= 100 ? 'text-rose-400' : p.valor <= 300 ? 'text-amber-400' : 'text-blue-400'
                          }`}>
                            {p.valor}
                          </span>
                          <div className="w-24 bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                            <div
                              className={`h-full ${
                                p.valor >= 700 ? 'bg-emerald-500' : p.valor <= 100 ? 'bg-rose-500' : p.valor <= 300 ? 'bg-amber-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${(p.valor / 1000) * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center text-emerald-400 font-bold">{p.sucessos}</td>
                      <td className="py-3 px-3 text-center text-rose-400 font-bold">{p.falhas}</td>
                      <td className="py-3 px-3 text-center text-cyan-400 font-bold">{p.cooperacoes}</td>
                      <td className="py-3 px-3 text-center text-amber-400 font-bold">{p.infracoes}</td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSimularSucesso(p.peerId)}
                            className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30 text-[10px] font-bold"
                            title="Registrar Sucesso (+2)"
                          >
                            +Sucesso
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSimularFalha(p.peerId)}
                            className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded border border-rose-500/30 text-[10px] font-bold"
                            title="Registrar Falha (-5)"
                          >
                            -Falha
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSimularInfracao(p.peerId)}
                            className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded border border-amber-500/30 text-[10px] font-bold"
                            title="Registrar Infração de Protocolo (-50)"
                          >
                            !Infração
                          </button>
                          {p.valor !== 500 && (
                            <button
                              type="button"
                              onClick={() => handlePerdoar(p.peerId)}
                              className="px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 rounded border border-blue-500/30 text-[10px]"
                              title="Restaurar para pontuação neutra de 500"
                            >
                              Perdoar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ABA DE TRILHA DE AUDITORIA IMUTÁVEL (jjy-auditoria) */}
      {/* ========================================================================= */}
      {activeTab === 'auditoria' && (
        <div className="space-y-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span>Trilha de Auditoria Criptográfica (Hash-Chaining)</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Registro sequencial imutável onde cada entrada encadeia o hash da anterior, garantindo integridade contra adulterações
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    auditoriaRef.current.limpar();
                    atualizarTodosOsEstados();
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 text-xs rounded-xl border border-slate-700 flex items-center gap-1 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Limpar Log
                </button>
              </div>
            </div>

            {/* Barra de Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block mb-1">Filtrar por Gravidade:</span>
                <select
                  value={filtroGravidade}
                  onChange={(e) => setFiltroGravidade(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-slate-200 font-mono text-xs"
                >
                  <option value="todos">Todas as Gravidades</option>
                  <option value="Info">Info (Informativo)</option>
                  <option value="Aviso">Aviso (Degradação)</option>
                  <option value="Erro">Erro (Falha de Envio)</option>
                  <option value="Critico">Crítico (Segurança/Violação)</option>
                </select>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">Filtrar por Subsistema:</span>
                <select
                  value={filtroOrigem}
                  onChange={(e) => setFiltroOrigem(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-slate-200 font-mono text-xs"
                >
                  <option value="todos">Todos os Subsistemas</option>
                  <option value="Malha">Malha Mesh</option>
                  <option value="Reputacao">Reputação</option>
                  <option value="Governanca">Governança</option>
                  <option value="Guard">Guard / Firewall</option>
                  <option value="Multi">Multi-Hop</option>
                  <option value="Audio">Áudio Acústico</option>
                </select>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">Busca Textual:</span>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Filtrar eventos..."
                    value={buscaAudit}
                    onChange={(e) => setBuscaAudit(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-slate-200 text-xs font-mono focus:outline-none"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                </div>
              </div>
            </div>

            {/* Lista de Eventos Hash-Chained */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {eventosAuditoria
                .filter((e) => {
                  if (filtroGravidade !== 'todos' && e.gravidade !== filtroGravidade) return false;
                  if (filtroOrigem !== 'todos' && e.origem !== filtroOrigem) return false;
                  if (buscaAudit && !e.descricao.toLowerCase().includes(buscaAudit.toLowerCase()) && !e.peerId?.toLowerCase().includes(buscaAudit.toLowerCase())) return false;
                  return true;
                })
                .slice()
                .reverse()
                .map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 font-mono text-xs flex flex-col gap-1.5 hover:border-slate-700 transition-all"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">#{ev.id}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ev.gravidade === 'Critico'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : ev.gravidade === 'Erro'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : ev.gravidade === 'Aviso'
                            ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        }`}>
                          {ev.gravidade.toUpperCase()}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                          {ev.origem}
                        </span>
                        {ev.peerId && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-bold">
                            {ev.peerId}
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] text-slate-500 flex items-center gap-2">
                        <span>Tick: {ev.tick}</span>
                        <span>•</span>
                        <span>{new Date(ev.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    <div className="text-slate-200 text-xs">
                      {ev.descricao}
                    </div>

                    <div className="text-[9px] text-slate-500 pt-1 border-t border-slate-900 flex items-center justify-between">
                      <span>Hash Anterior: <code className="text-slate-400">{ev.hashAnterior}</code></span>
                      <span>Hash Atual: <code className="text-cyan-400 font-bold">{ev.hash}</code></span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. ABA DE VIZINHANÇA & LQI (jjy-vizinhanca) */}
      {/* ========================================================================= */}
      {activeTab === 'vizinhanca' && (
        <div className="space-y-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-cyan-400" />
                  <span>Gestão de Vizinhança Direta & Métrica LQI (Spec 39)</span>
                </h3>
                <p className="text-xs text-slate-400">
                  {vizinhancaRef.current.resumo()} • Transição de nós (Candidato ➔ Ativo ➔ Inativo)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {vizinhos.map((v) => (
                <div
                  key={v.peerId}
                  className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col justify-between gap-3 shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-slate-100 font-mono">
                        {v.peerId}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        v.estado === 'Ativo'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : v.estado === 'Candidato'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {v.estado}
                      </span>
                    </div>

                    {/* Métrica LQI */}
                    <div className="space-y-1 mb-2">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-slate-400">LQI (Link Quality):</span>
                        <span className="text-cyan-300 font-bold">{v.qualidade} / 1000</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                        <div
                          className="bg-cyan-500 h-full"
                          style={{ width: `${(v.qualidade / 1000) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
                      <div>Meio: <strong className="text-slate-200">{v.meio}</strong></div>
                      <div>RTT: <strong className="text-slate-200">{v.rttMs ?? 24} ms</strong></div>
                      <div>Promoções: <strong className="text-emerald-400">{v.promocoes}</strong></div>
                      <div>Rebaixamentos: <strong className="text-rose-400">{v.rebaixamentos}</strong></div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-900">
                    {v.estado === 'Candidato' && (
                      <button
                        type="button"
                        onClick={() => handlePromover(v.peerId)}
                        className="flex-1 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-500/40"
                      >
                        Promover a Ativo
                      </button>
                    )}
                    {v.estado === 'Ativo' && (
                      <button
                        type="button"
                        onClick={() => handleRebaixar(v.peerId)}
                        className="flex-1 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 text-xs font-semibold rounded-lg border border-amber-500/40"
                      >
                        Rebaixar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        vizinhancaRef.current.contato(v.peerId, Math.floor(Math.random() * 30 + 15));
                        atualizarTodosOsEstados();
                      }}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700"
                      title="Simular Ping / Contato"
                    >
                      Ping
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. ABA DE FILA DTN STORE-AND-FORWARD (jjy-fila) */}
      {/* ========================================================================= */}
      {activeTab === 'fila' && (
        <div className="space-y-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Inbox className="w-4 h-4 text-cyan-400" />
                    <span>Fila Store-and-Forward para Peers Offline (DTN)</span>
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                    ASSINATURAS OTP BLINDADAS (ZERO METADADOS EXPOSTOS)
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Mensagens armazenadas localmente para entrega imediata quando o destinatário reaparecer na malha (Provas OTP e tokens cegos ao relay)
                </p>
              </div>
            </div>

            {/* Formulário de Enfileiramento */}
            <form onSubmit={handleEnfileirarMensagem} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-300 block">
                Enfileirar Mensagem para Nó Desconectado / Ausente:
              </span>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Destinatário (Ex: NÓ-BRAVO)"
                  value={filaDestino}
                  onChange={(e) => setFilaDestino(e.target.value.toUpperCase())}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono"
                  required
                />

                <select
                  value={filaPrioridade}
                  onChange={(e) => setFilaPrioridade(e.target.value as PrioridadeMensagem)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono"
                >
                  <option value="Alta">Prioridade: Alta (Entrega Imediata)</option>
                  <option value="Normal">Prioridade: Normal</option>
                  <option value="Baixa">Prioridade: Baixa (Segundo plano)</option>
                </select>

                <button
                  type="submit"
                  className="py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg shadow-md flex items-center justify-center gap-1.5 transition-all"
                >
                  <Send className="w-3.5 h-3.5" /> Enfileirar no Buffer DTN
                </button>
              </div>

              <textarea
                rows={2}
                placeholder="Conteúdo confidencial para retransmissão..."
                value={filaConteudo}
                onChange={(e) => setFilaConteudo(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500 resize-none"
                required
              />
            </form>

            {/* Lista de Mensagens Pendentes na Fila */}
            <div className="space-y-2">
              <span className="text-xs text-slate-400 font-bold block">
                Mensagens no Buffer ({mensagensFila.length} Pendentes):
              </span>

              {mensagensFila.length === 0 ? (
                <div className="p-5 text-center text-slate-500 text-xs italic bg-slate-950/60 rounded-xl border border-slate-800">
                  Nenhuma mensagem pendente no buffer store-and-forward.
                </div>
              ) : (
                mensagensFila.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs flex items-center justify-between flex-wrap gap-2"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          msg.prioridade === 'Alta'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : msg.prioridade === 'Normal'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {msg.prioridade}
                        </span>
                        <span className="font-bold text-slate-200">➔ {msg.destinoPeerId}</span>
                        <span className="text-slate-500 text-[10px]">({msg.bytesTamanho} bytes)</span>
                      </div>
                      <div className="text-slate-300 text-xs break-all">
                        "{msg.conteudo}"
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDespacharMensagem(msg.id, msg.destinoPeerId)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition-all shadow-sm"
                        title="Simular entrega do pacote ao peer que se conectou"
                      >
                        Despachar Entrega
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. ABA DE SAÚDE E DIAGNÓSTICO DO NÓ (jjy-diagnostico) */}
      {/* ========================================================================= */}
      {activeTab === 'diagnostico' && (
        <div className="space-y-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span>Autodiagnóstico e Integridade dos Subsistemas</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Uptime do nó: {relatorioSaude?.uptimeTicks || 0} ticks • Monitoramento contínuo
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                  relatorioSaude?.nivelAlertaGlobal === 'Normal'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : relatorioSaude?.nivelAlertaGlobal === 'Atencao'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}>
                  <span className="w-2 h-2 rounded-full bg-current animate-ping" />
                  NÍVEL GLOBAL: {relatorioSaude?.nivelAlertaGlobal?.toUpperCase() || 'NORMAL'}
                </span>
              </div>
            </div>

            {/* Grid dos Subsistemas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {relatorioSaude?.subsistemas.map((sub) => (
                <div
                  key={sub.nome}
                  className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5 font-mono text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">{sub.nome}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      sub.estado === 'Saudavel'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : sub.estado === 'Degradado'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}>
                      {sub.estado}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans">
                    {sub.detalhes}
                  </p>
                </div>
              ))}
            </div>

            {/* Alertas Recentes */}
            {relatorioSaude && relatorioSaude.alertasRecentes.length > 0 && (
              <div className="pt-2 space-y-2">
                <span className="text-xs text-slate-400 font-bold block">
                  Alertas Operacionais do Diagnóstico:
                </span>
                <div className="space-y-1.5">
                  {relatorioSaude.alertasRecentes.map((alerta) => (
                    <div
                      key={alerta.id}
                      className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={`w-4 h-4 ${alerta.nivel === 'Critico' ? 'text-rose-400' : 'text-amber-400'}`} />
                        <span className="text-slate-300">[{alerta.subsistema}] {alerta.mensagem}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">Tick {alerta.tickCriacao}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. ABA DE AGENDA TÁTICA & SILÊNCIO EMCON (jjy-agenda) */}
      {/* ========================================================================= */}
      {activeTab === 'agenda' && (
        <div className="space-y-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span>Agendador Tático de Transmissões & Silêncio EMCON</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Temporizador baseado em ticks com controle de janelas de silêncio e ações periódicas
                </p>
              </div>
            </div>

            {/* Programar Tarefa */}
            <form onSubmit={handleAgendarTarefa} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-300 block">
                Programar Nova Tarefa Agendada:
              </span>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <input
                  type="text"
                  placeholder="Tag (Ex: BEACON-SOM)"
                  value={agendaTag}
                  onChange={(e) => setAgendaTag(e.target.value.toUpperCase())}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono"
                  required
                />
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={agendaIntervalo}
                  onChange={(e) => setAgendaIntervalo(Number(e.target.value))}
                  placeholder="Intervalo (ticks)"
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono"
                  required
                />
                <select
                  value={agendaTipo}
                  onChange={(e) => setAgendaTipo(e.target.value as 'UmaVez' | 'Periodica')}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono"
                >
                  <option value="Periodica">Periódica (A cada N ticks)</option>
                  <option value="UmaVez">Uma Vez (Após N ticks)</option>
                </select>
                <button
                  type="submit"
                  className="py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg shadow-md transition-all flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Agendar
                </button>
              </div>
            </form>

            {/* Lista de Tarefas Ativas */}
            <div className="space-y-2">
              <span className="text-xs text-slate-400 font-bold block">
                Tarefas Programadas ({tarefasAgenda.length}):
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {tarefasAgenda.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-cyan-300">[{t.tag}]</span>
                        <span className="text-slate-500 text-[10px]">#{t.id}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 text-slate-400">
                          {t.repeticao} ({t.intervaloTicks}t)
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 pt-1">
                        Próximo disparo: tick {t.tickProximo} • Execuções: {t.totalExecucoes}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Disparos Recentes */}
            {disparosRecentes.length > 0 && (
              <div className="pt-2 space-y-2">
                <span className="text-xs text-slate-400 font-bold block">
                  Últimos Disparos Concluídos da Agenda:
                </span>
                <div className="space-y-1 font-mono text-xs">
                  {disparosRecentes.map((d, idx) => (
                    <div key={idx} className="p-2 bg-slate-950/80 rounded-lg border border-slate-800/80 text-emerald-400 flex justify-between">
                      <span>✓ Disparo da tarefa [{d.tag}] (Execução #{d.execucaoNumero})</span>
                      <span className="text-slate-500">Tick {d.tick}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. ABA DE REFINAMENTO MESHTASTIC & LORA RF (Spec 42: jjy-meshtastic)      */}
      {/* ========================================================================= */}
      {activeTab === 'meshtastic' && (
        <div className="space-y-6">
          {/* BANNER SUPERIOR DE SINCRONIZAÇÃO E CONTROLE */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/40 border border-emerald-500/30 rounded-2xl p-5 shadow-2xl backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between flex-wrap gap-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <Radio className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-white tracking-tight">
                      Protocolo JJY Meshtastic Sovereign Mesh
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                      SPEC 42: jjy-meshtastic
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Refinamento de Rádio LoRa RF, Criptografia AES-256 de Canal, Bridging com o JJY Core e Sincronização em Tempo Real com o JJY Chat
                  </p>
                </div>
              </div>

              {/* Botões de Ação do Topo */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleBridgeMeshtasticToJjy}
                  className="px-3.5 py-2 rounded-xl bg-cyan-600/90 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer hover:shadow-cyan-500/20"
                  title="Injetar nós Meshtastic na Gestão de Vizinhança e Reputação do JJY"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Integrar com Vizinhança JJY</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenJjyChatMeshtastic}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-900/40 cursor-pointer"
                  title="Abrir JJY Chat configurado nativamente com este canal Meshtastic"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Abrir JJY Chat no Modo Meshtastic</span>
                </button>
              </div>
            </div>

            {/* Faixa de Parâmetros Ativos */}
            <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-emerald-500/40 text-emerald-300 font-bold">
                  📻 {meshtasticConfig.frequencyMhz.toFixed(3)} MHz ({meshtasticConfig.regionId})
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-cyan-500/30 text-cyan-300">
                  ⚡ Modem: {meshtasticConfig.modemPresetId}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                  📡 Canal: #{meshtasticConfig.channelName}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-purple-500/30 text-purple-300">
                  🔒 {meshtasticConfig.channelPskType === 'default_public' ? 'Chave Aberta (AQ==)' : 'Chave Militar AES-256'}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-amber-500/30 text-amber-300">
                  🦘 Hop Limit: {meshtasticConfig.hopLimit}
                </span>
              </div>

              {meshtasticSyncToast && (
                <div className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-sans font-bold text-xs animate-bounce flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>{meshtasticSyncToast}</span>
                </div>
              )}
            </div>
          </div>

          {/* GRADE PRINCIPAL: 3 COLUNAS DE REFINAMENTO */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* 1. CAMADA FÍSICA RF & MODULAÇÃO LORA */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-400" />
                  <span>1. Camada Física RF (Rádio LoRa)</span>
                </h4>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                  PHY LAYER
                </span>
              </div>

              {/* Região Regulamentar */}
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-semibold">
                  Região & Frequência Regulamentar:
                </label>
                <select
                  value={meshtasticConfig.regionId}
                  onChange={(e) => {
                    const r = LORA_REGIONS.find((reg) => reg.id === e.target.value);
                    if (r) {
                      handleUpdateMeshtasticConfig({
                        regionId: r.id,
                        frequencyMhz: r.defaultFreqMhz,
                        txPowerDbm: Math.min(meshtasticConfig.txPowerDbm, r.maxPowerDbm),
                      });
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none"
                >
                  {LORA_REGIONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.freqRangeMhz})
                    </option>
                  ))}
                </select>
              </div>

              {/* Frequência Customizada em MHz */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-slate-400 font-semibold">Frequência Central Exata (MHz):</label>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {meshtasticConfig.frequencyMhz.toFixed(3)} MHz
                  </span>
                </div>
                <input
                  type="number"
                  step="0.025"
                  min="400"
                  max="930"
                  value={meshtasticConfig.frequencyMhz}
                  onChange={(e) => handleUpdateMeshtasticConfig({ frequencyMhz: parseFloat(e.target.value) || 915.0 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Preset de Modem LoRa */}
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-semibold">Modulação LoRa (Modem Preset):</label>
                <select
                  value={meshtasticConfig.modemPresetId}
                  onChange={(e) => handleUpdateMeshtasticConfig({ modemPresetId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none"
                >
                  {LORA_MODEM_PRESETS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — SF{m.spreadingFactor} / BW {m.bandwidthKhz}kHz ({m.nominalBitrateBps} bps)
                    </option>
                  ))}
                </select>
                {(() => {
                  const selPreset = LORA_MODEM_PRESETS.find((p) => p.id === meshtasticConfig.modemPresetId);
                  return selPreset ? (
                    <p className="text-[11px] text-slate-400 mt-1.5 italic bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                      ℹ️ {selPreset.description}
                    </p>
                  ) : null;
                })()}
              </div>

              {/* Potência TX (dBm) */}
              <div>
                <div className="flex justify-between items-center mb-1 text-xs">
                  <span className="text-slate-400 font-semibold">Potência de Transmissão (TX Power):</span>
                  <span className="font-mono text-emerald-400 font-bold">{meshtasticConfig.txPowerDbm} dBm (~{Math.round(Math.pow(10, meshtasticConfig.txPowerDbm / 10))} mW)</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="30"
                  value={meshtasticConfig.txPowerDbm}
                  onChange={(e) => handleUpdateMeshtasticConfig({ txPowerDbm: parseInt(e.target.value, 10) })}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* SyncWord & Preamble */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1 font-semibold">SyncWord LoRa:</span>
                  <input
                    type="text"
                    value={`0x${meshtasticConfig.syncWord.toString(16).toUpperCase()}`}
                    onChange={(e) => {
                      const val = parseInt(e.target.value.replace('0x', ''), 16);
                      if (!isNaN(val)) handleUpdateMeshtasticConfig({ syncWord: val });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-slate-200 font-mono text-xs"
                    title="0x2B é o padrão Meshtastic comunitário aberto"
                  />
                </div>
                <div>
                  <span className="text-slate-400 block mb-1 font-semibold">Sensibilidade Est.:</span>
                  <div className="p-1.5 bg-slate-950 rounded-lg border border-slate-800 text-cyan-300 font-mono text-xs">
                    -137 dBm
                  </div>
                </div>
              </div>
            </div>

            {/* 2. TOPOLOGIA, ROTEAMENTO & IDENTIDADE DO NÓ */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <span>2. Roteamento Mesh & Identidade</span>
                </h4>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                  NETWORK LAYER
                </span>
              </div>

              {/* Papel do Nó */}
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-semibold">Papel do Nó na Rede (Node Role):</label>
                <select
                  value={meshtasticConfig.nodeRole}
                  onChange={(e) => handleUpdateMeshtasticConfig({ nodeRole: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                >
                  <option value="CLIENT">CLIENT (Dispositivo Pessoal / Celular)</option>
                  <option value="ROUTER">ROUTER (Repetidor com Prioridade Alta)</option>
                  <option value="REPEATER">REPEATER (Repetidor Puro Solar)</option>
                  <option value="TRACKER">TRACKER (Mochila / Beacon GPS)</option>
                  <option value="SENSOR">SENSOR (Telemetria Ambiental / Baixo Consumo)</option>
                </select>
              </div>

              {/* Hop Limit */}
              <div>
                <div className="flex justify-between items-center mb-1 text-xs">
                  <span className="text-slate-400 font-semibold">Limite Máximo de Saltos (Hop Limit / TTL):</span>
                  <span className="font-mono text-cyan-300 font-bold">{meshtasticConfig.hopLimit} Saltos</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="7"
                  value={meshtasticConfig.hopLimit}
                  onChange={(e) => handleUpdateMeshtasticConfig({ hopLimit: parseInt(e.target.value, 10) })}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                  <span>1 (Direto)</span>
                  <span>3 (Padrão Meshtastic)</span>
                  <span>7 (Máx Anti-Storm)</span>
                </div>
              </div>

              {/* Perfil de Hardware Conectado */}
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-semibold">Driver de Hardware USB / UART:</label>
                <select
                  value={meshtasticConfig.hardwareMode}
                  onChange={(e) => {
                    const prof = LORA_HARDWARE_PROFILES.find((p) => p.id === e.target.value);
                    handleUpdateMeshtasticConfig({
                      hardwareMode: e.target.value as any,
                      baudRate: prof ? prof.defaultBaudRate : 115200,
                    });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                >
                  {LORA_HARDWARE_PROFILES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.defaultBaudRate} bps)
                    </option>
                  ))}
                </select>
              </div>

              {/* Baud Rate */}
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-semibold">Velocidade da Porta Serial (Baud Rate):</label>
                <select
                  value={meshtasticConfig.baudRate}
                  onChange={(e) => handleUpdateMeshtasticConfig({ baudRate: parseInt(e.target.value, 10) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                >
                  <option value="115200">115200 bps (Meshtastic ESP32 / nRF52 Padrão)</option>
                  <option value="9600">9600 bps (EBYTE E22/E32 Transparente)</option>
                  <option value="57600">57600 bps</option>
                  <option value="38400">38400 bps</option>
                </select>
              </div>

              {/* Modo EMCON Silencioso */}
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-200 block">Modo Silencioso EMCON</span>
                  <span className="text-[11px] text-slate-400">Suspende beacons e transmissões ativas de RF</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleUpdateMeshtasticConfig({ emconSilenceMode: !meshtasticConfig.emconSilenceMode })}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    meshtasticConfig.emconSilenceMode
                      ? 'bg-rose-600 text-white shadow-rose-600/30'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {meshtasticConfig.emconSilenceMode ? 'SILÊNCIO ATIVO' : 'NORMAL (TX OK)'}
                </button>
              </div>
            </div>

            {/* 3. CRIPTOGRAFIA DE CANAL & CHAVES SOBERANAS */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-purple-400" />
                  <span>3. Criptografia & Chave PSK do Canal</span>
                </h4>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                  AES-256 E2E
                </span>
              </div>

              {/* Nome do Canal */}
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-semibold">Nome do Canal Meshtastic:</label>
                <input
                  type="text"
                  value={meshtasticConfig.channelName}
                  onChange={(e) => handleUpdateMeshtasticConfig({ channelName: e.target.value })}
                  placeholder="ex: LongFast-JYY ou Tatico-Alfa"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 font-mono focus:border-purple-500 focus:outline-none"
                />
              </div>

              {/* Tipo de Chave PSK */}
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-semibold">Tipo de Criptografia:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdateMeshtasticConfig({ channelPskType: 'default_public', channelKeyPsk: 'AQ==' })}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      meshtasticConfig.channelPskType === 'default_public'
                        ? 'bg-purple-600/20 border-purple-500 text-purple-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    Pública Aberta (AQ==)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (meshtasticConfig.channelKeyPsk === 'AQ==') handleGenerateNewPsk();
                      else handleUpdateMeshtasticConfig({ channelPskType: 'custom_aes256' });
                    }}
                    className={`p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      meshtasticConfig.channelPskType === 'custom_aes256'
                        ? 'bg-purple-600/20 border-purple-500 text-purple-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    Militar Privada (AES-256)
                  </button>
                </div>
              </div>

              {/* Chave Base64 */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-slate-400 font-semibold">Chave de Cifra (Base64 PSK):</label>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(meshtasticConfig.channelKeyPsk);
                      setCopiedKeyToast(true);
                      setTimeout(() => setCopiedKeyToast(false), 2000);
                    }}
                    className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer font-bold"
                  >
                    {copiedKeyToast ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKeyToast ? 'Copiada!' : 'Copiar'}</span>
                  </button>
                </div>
                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-purple-300 break-all select-all">
                  {meshtasticConfig.channelKeyPsk}
                </div>
              </div>

              {/* Botão Gerar Nova Chave */}
              <button
                type="button"
                onClick={handleGenerateNewPsk}
                className="w-full py-2 px-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Gerar Nova Chave Efêmera AES-256 (32 Bytes)</span>
              </button>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Hash do Canal:</span>
                  <span className="font-mono text-slate-300 font-bold">0x8F21B9 (LongFast)</span>
                </div>
                <div className="flex justify-between">
                  <span>Assinatura Digital de Nós:</span>
                  <span className="text-emerald-400 font-bold">Ed25519 Ativa</span>
                </div>
              </div>
            </div>
          </div>

          {/* PAINEL DE BRIDGING COM SUBSISTEMAS DO JJY SOVEREIGN MESH */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-cyan-400" />
                  <span>Bridging: Integração com os Subsistemas do JJY Sovereign Mesh</span>
                </h4>
                <p className="text-xs text-slate-400">
                  Os nós LoRa Meshtastic alimentam o Avaliador de Reputação (Spec 36), a Vizinhança LQI (Spec 39) e a Fila DTN
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBridgeMeshtasticToJjy}
                  className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Integrar Nós na Malha JJY Agora</span>
                </button>
              </div>
            </div>

            {/* Tabela de Nós Meshtastic com LQI Calculado */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {meshtasticNodes.map((node) => {
                const lqi = convertSnrRssiToLqi(node.rssi, node.snr);
                return (
                  <div
                    key={node.nodeId}
                    className="p-4 bg-slate-950 rounded-xl border border-slate-800 hover:border-slate-700 transition-all space-y-2 shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="font-bold text-xs text-white font-mono">{node.shortName}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                          {node.nodeId}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                        {node.role}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 font-semibold">{node.longName}</div>
                    <div className="text-[11px] text-slate-400">{node.hardwareModel}</div>

                    {/* Barra de LQI Calculado para o JJY Mesh */}
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-slate-400">LQI Calculado (JJY Spec 39):</span>
                        <span className="text-cyan-300 font-bold">{lqi} / 1000</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                        <div className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full" style={{ width: `${(lqi / 1000) * 100}%` }} />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1 text-[10px] font-mono text-slate-400 pt-1">
                      <div>RSSI: <strong className="text-slate-200">{node.rssi} dBm</strong></div>
                      <div>SNR: <strong className="text-slate-200">+{node.snr} dB</strong></div>
                      <div>Saltos: <strong className="text-slate-200">{node.hopsAway}</strong></div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Checkboxes de Integração */}
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={meshtasticConfig.bridgeWithJjyReputacao}
                  onChange={(e) => handleUpdateMeshtasticConfig({ bridgeWithJjyReputacao: e.target.checked })}
                  className="rounded accent-emerald-500"
                />
                <span>Alimentar Reputação (Spec 36)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={meshtasticConfig.bridgeWithJjyVizinhanca}
                  onChange={(e) => handleUpdateMeshtasticConfig({ bridgeWithJjyVizinhanca: e.target.checked })}
                  className="rounded accent-emerald-500"
                />
                <span>Alimentar Vizinhança LQI (Spec 39)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={meshtasticConfig.bridgeWithJjyFila}
                  onChange={(e) => handleUpdateMeshtasticConfig({ bridgeWithJjyFila: e.target.checked })}
                  className="rounded accent-emerald-500"
                />
                <span>Fila DTN Store-and-Forward</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={meshtasticConfig.bridgeWithJjyAuditoria}
                  onChange={(e) => handleUpdateMeshtasticConfig({ bridgeWithJjyAuditoria: e.target.checked })}
                  className="rounded accent-emerald-500"
                />
                <span>Trilha de Auditoria Criptográfica</span>
              </label>
            </div>
          </div>

          {/* PAINEL INFERIOR: HARDWARE WEBSERIAL & TESTADOR DE PACOTES RF */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* HARDWARE WEBSERIAL USB / BLE */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>Conexão Serial USB & Monitor RF</span>
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleConnectSerial}
                    disabled={isSerialConnecting}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
                      serialCtrl?.isConnected
                        ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>{serialCtrl?.isConnected ? 'Desconectar USB' : 'Conectar USB (WebSerial)'}</span>
                  </button>
                </div>
              </div>

              {/* Console de Logs Serial */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs space-y-1 h-48 overflow-y-auto">
                {serialLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className={`${
                      log.startsWith('[TX]')
                        ? 'text-cyan-400'
                        : log.startsWith('[RX]')
                        ? 'text-emerald-400 font-bold'
                        : log.startsWith('[ERROR]')
                        ? 'text-rose-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {log}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Placas suportadas: LilyGO T-Beam, Heltec LoRa32 v3, RAK WisBlock, EBYTE E22/E32.</span>
                <button
                  type="button"
                  onClick={() => setSerialLogs(['[LOGS LIMPOS] Monitor reiniciado.'])}
                  className="hover:text-slate-200 transition-colors"
                >
                  Limpar logs
                </button>
              </div>
            </div>

            {/* TESTADOR DE TIME-ON-AIR (ToA) & INJETOR DE PACOTES */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
                  <span>Calculador de Time-on-Air (ToA) & Injetor</span>
                </h4>
                {(() => {
                  const curModem = LORA_MODEM_PRESETS.find((p) => p.id === meshtasticConfig.modemPresetId) || LORA_MODEM_PRESETS[0];
                  const { toaMs } = calculateLoraTimeOnAir(meshtasticTestMsg.length, curModem.spreadingFactor, curModem.bandwidthKhz);
                  return (
                    <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-cyan-500/40">
                      ToA: {toaMs} ms
                    </span>
                  );
                })()}
              </div>

              {/* Destino do Pacote */}
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-semibold">Destinatário do Pacote RF:</label>
                <select
                  value={selectedMeshtasticNodeId}
                  onChange={(e) => setSelectedMeshtasticNodeId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                >
                  <option value="^all">Broadcast para Toda a Rede (^all)</option>
                  {meshtasticNodes.map((n) => (
                    <option key={n.nodeId} value={n.nodeId}>
                      {n.shortName} — {n.longName} ({n.nodeId})
                    </option>
                  ))}
                </select>
              </div>

              {/* Payload de Teste */}
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-semibold">Mensagem / Payload RF:</label>
                <input
                  type="text"
                  value={meshtasticTestMsg}
                  onChange={(e) => setMeshtasticTestMsg(e.target.value)}
                  placeholder="Digite mensagem para calcular ToA e injetar na malha..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* Métricas RF Calculadas */}
              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Payload:</span>
                  <span className="text-slate-200 font-bold">{meshtasticTestMsg.length} bytes</span>
                </div>
                <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Taxa Bruta:</span>
                  <span className="text-emerald-400 font-bold">
                    {LORA_MODEM_PRESETS.find((p) => p.id === meshtasticConfig.modemPresetId)?.nominalBitrateBps || 1074} bps
                  </span>
                </div>
                <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Alcance Est.:</span>
                  <span className="text-cyan-300 font-bold">12 - 25 km</span>
                </div>
              </div>

              {/* Botão de Envio de Teste */}
              <button
                type="button"
                onClick={handleSendMeshtasticPacket}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Transmitir Pacote de Teste na Malha RF</span>
              </button>

              <div className="pt-1">
                <a
                  href="#meshmonitor"
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span>Abrir MeshMonitor: Telemetria Completa, Traceroute & Sniffer</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
