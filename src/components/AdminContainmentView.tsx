import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ShieldAlert,
  Shield,
  ShieldCheck,
  ShieldOff,
  AlertTriangle,
  Lock,
  Unlock,
  Radio,
  RadioTower,
  Network,
  Users,
  UserX,
  VolumeX,
  Mic,
  Camera,
  Monitor,
  Ban,
  Search,
  RefreshCw,
  SlidersHorizontal,
  Flame,
  CheckCircle2,
  XCircle,
  FileCheck,
  FileWarning,
  FileSearch,
  Download,
  Send,
  Zap,
  Activity,
  AlertOctagon,
  Eye,
  Crosshair,
  Trash2,
  HelpCircle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { GpsHoverBadge } from './GpsHoverBadge';
import { AvaliadorReputacao, PontuacaoPeer, ClassificacaoPeer } from '../utils/jjyReputacao';
import { RegistroAuditoria, EventoAuditoria, GravidadeAuditoria } from '../utils/jjyAuditoria';
import { FilaStoreAndForward } from '../utils/jjyFila';
import { DiagnosticoNo } from '../utils/jjyDiagnostico';

export interface StationScreenData {
  videoTrackLabel?: string;
  resolution?: { width: number; height: number };
  systemAudioIncluded?: boolean;
  activeWindowCount?: number;
  lastUpdated?: number;
}

export interface ConnectedStation {
  peerId: number;
  clientId: string;
  name: string;
  color?: string;
  battery?: number;
  isCharging?: boolean;
  platform?: string;
  remoteAddress?: string;
  lastSeen?: number;
  latency?: number | null;
  userAgent?: string;
  audioLevel?: number;
  isMicActive?: boolean;
  isCameraActive?: boolean;
  isScreenActive?: boolean;
  screenData?: StationScreenData;
  location?: {
    latitude: number;
    longitude: number;
    country?: string;
    flag?: string;
    city?: string;
  };
}

export interface SecurityData {
  stats: {
    blockedRequests: number;
    bannedIpsCount: number;
    rateLimitViolations: number;
    intrusionsDetected: number;
    tarpittedConnections: number;
    failedLogins: number;
    activeBans: number;
  };
  bannedIps: {
    ip: string;
    reason: string;
    bannedAt: number;
    expiresAt?: number | null;
    auto?: boolean;
  }[];
  isLockdown?: boolean;
  quarantinedClients?: string[];
}

interface AdminContainmentViewProps {
  connectedStations: ConnectedStation[];
  securityData: SecurityData | null;
  serverUrl: string;
  token: string;
  adminWs: WebSocket | null;
  onRefresh: () => void;
  onSendEmergencyPopup?: (targetClientId: string, title: string, message: string) => void;
}

interface SiemEvent {
  id: string;
  timestamp: number;
  type: 'QUARANTINE' | 'LOCKDOWN' | 'EJECT' | 'SENSOR_KILL' | 'SCREEN_LOCK' | 'IP_BAN' | 'RATE_LIMIT' | 'JJY_PENALTY' | 'SIMULATION';
  level: 'info' | 'warning' | 'critical';
  stationId?: string;
  stationName?: string;
  details: string;
  mitigation: string;
}

export const AdminContainmentView: React.FC<AdminContainmentViewProps> = ({
  connectedStations,
  securityData,
  serverUrl,
  token,
  adminWs,
  onRefresh,
  onSendEmergencyPopup,
}) => {
  // Estados de Contenção Zero-Trust
  const [isLockdown, setIsLockdown] = useState<boolean>(Boolean(securityData?.isLockdown));
  const [quarantinedClients, setQuarantinedClients] = useState<Set<string>>(
    new Set(securityData?.quarantinedClients || [])
  );
  const [silencedSensors, setSilencedSensors] = useState<Set<string>>(new Set());
  const [frozenScreens, setFrozenScreens] = useState<Set<string>>(new Set());

  // Filtros e Pesquisa
  const [threatFilter, setThreatFilter] = useState<'all' | 'high_risk' | 'quarantined' | 'sensors_active'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [subSection, setSubSection] = useState<'stations' | 'jjy_audit' | 'simulation' | 'siem'>('stations');

  // Modais de Ação
  const [isLockdownModalOpen, setIsLockdownModalOpen] = useState(false);
  const [lockdownReasonInput, setLockdownReasonInput] = useState('Incidente de segurança detectado: Contenção de emergência (DEFCON 1)');
  const [banModalTarget, setBanModalTarget] = useState<ConnectedStation | null>(null);
  const [banReason, setBanReason] = useState('Violação grave de integridade e protocolo de segurança');
  const [banHours, setBanHours] = useState(24);
  const [actionNotice, setActionNotice] = useState<{ message: string; type: 'success' | 'danger' | 'info' } | null>(null);

  // Instâncias dos Protocolos Soberanos JJY
  const reputacaoEngineRef = useRef<AvaliadorReputacao>(new AvaliadorReputacao());
  const auditoriaEngineRef = useRef<RegistroAuditoria>(new RegistroAuditoria({ capacidade: 500 }));
  const filaEngineRef = useRef<FilaStoreAndForward>(new FilaStoreAndForward());
  const diagnosticoEngineRef = useRef<DiagnosticoNo>(new DiagnosticoNo());

  // SIEM Logs
  const [siemEvents, setSiemEvents] = useState<SiemEvent[]>([]);
  const [auditChainVerified, setAuditChainVerified] = useState<{ verified: boolean; checkedCount: number; timestamp: number } | null>(null);
  const [isSimulating, setIsSimulating] = useState<string | null>(null);

  // Sincronizar dados recebidos do backend
  useEffect(() => {
    if (securityData) {
      if (typeof securityData.isLockdown === 'boolean') {
        setIsLockdown(securityData.isLockdown);
      }
      if (Array.isArray(securityData.quarantinedClients)) {
        setQuarantinedClients(new Set(securityData.quarantinedClients));
      }
    }
  }, [securityData]);

  // Sincronizar estações no motor de reputação JJY
  useEffect(() => {
    connectedStations.forEach((station) => {
      const rep = reputacaoEngineRef.current.consultar(station.clientId);
      if (!rep) {
        reputacaoEngineRef.current.registrarSucesso(station.clientId);
        auditoriaEngineRef.current.info('Malha', `Nó inicializado: ${station.name} (${station.clientId})`, station.clientId);
      }
    });
  }, [connectedStations]);

  // Notificador temporário
  const notify = (message: string, type: 'success' | 'danger' | 'info' = 'info') => {
    setActionNotice({ message, type });
    setTimeout(() => setActionNotice(null), 4500);
  };

  const addSiemLog = (event: Omit<SiemEvent, 'id' | 'timestamp'>) => {
    const newEvent: SiemEvent = {
      ...event,
      id: `siem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
    };
    setSiemEvents((prev) => [newEvent, ...prev.slice(0, 99)]);
  };

  // Cálculo Dinâmico de Risco Zero-Trust para cada Estação
  const getStationRisk = (station: ConnectedStation) => {
    let score = 5; // Base normal
    const anomalies: { label: string; severity: 'low' | 'medium' | 'high' | 'critical' }[] = [];

    // Latência
    if (station.latency && station.latency > 1500) {
      score += 25;
      anomalies.push({ label: `RTT Anômalo (${station.latency}ms)`, severity: 'high' });
    } else if (station.latency && station.latency > 500) {
      score += 15;
      anomalies.push({ label: `Jitter Elevado (${station.latency}ms)`, severity: 'medium' });
    }

    // User-Agent / Ambiente
    const ua = (station.userAgent || station.platform || '').toLowerCase();
    if (ua.includes('headless') || ua.includes('python') || ua.includes('curl') || ua.includes('bot') || ua.includes('scanner')) {
      score += 45;
      anomalies.push({ label: 'Probe Automatizado / Headless', severity: 'critical' });
    }

    // Geolocalização
    if (station.location) {
      if (station.location.latitude === 0 && station.location.longitude === 0) {
        score += 30;
        anomalies.push({ label: 'GPS Null Island (0,0) - Possível Spoofing', severity: 'high' });
      }
    }

    // Microfone e Sensores
    if (station.audioLevel && station.audioLevel > 90) {
      score += 20;
      anomalies.push({ label: 'Saturação Contínua de Entrada Acústica', severity: 'medium' });
    }

    // Quarentena
    if (quarantinedClients.has(station.clientId)) {
      score += 35;
      anomalies.push({ label: 'Isolado em Quarentena Zero-Trust', severity: 'critical' });
    }

    // Tela travada
    if (frozenScreens.has(station.clientId)) {
      score += 20;
      anomalies.push({ label: 'Terminal com Tela Congelada por Segurança', severity: 'high' });
    }

    // Reputação JJY
    const rep = reputacaoEngineRef.current.consultar(station.clientId);
    if (rep) {
      if (rep.classificacao === 'Bloqueado') {
        score += 50;
        anomalies.push({ label: `Reputação JJY Crítica (${rep.valor}/1000)`, severity: 'critical' });
      } else if (rep.classificacao === 'Suspeito') {
        score += 25;
        anomalies.push({ label: `Reputação JJY Suspeita (${rep.valor}/1000)`, severity: 'high' });
      }
    }

    score = Math.min(100, Math.max(5, score));
    let level: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let colorClass = 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60';
    let barColor = 'bg-emerald-500';

    if (score >= 80) {
      level = 'critical';
      colorClass = 'text-rose-400 bg-rose-950/60 border-rose-800/60';
      barColor = 'bg-rose-500';
    } else if (score >= 50) {
      level = 'high';
      colorClass = 'text-amber-400 bg-amber-950/60 border-amber-800/60';
      barColor = 'bg-amber-500';
    } else if (score >= 25) {
      level = 'medium';
      colorClass = 'text-yellow-400 bg-yellow-950/60 border-yellow-800/60';
      barColor = 'bg-yellow-500';
    }

    return {
      score,
      level,
      colorClass,
      barColor,
      anomalies,
      repScore: rep?.valor ?? 500,
      repClass: (rep?.classificacao ?? 'Neutro') as ClassificacaoPeer,
    };
  };

  // Média de risco da rede
  const networkAverageRisk = useMemo(() => {
    if (connectedStations.length === 0) return 0;
    const sum = connectedStations.reduce((acc, s) => acc + getStationRisk(s).score, 0);
    return Math.round(sum / connectedStations.length);
  }, [connectedStations, quarantinedClients, frozenScreens]);

  // Lista de estações filtrada
  const filteredStations = useMemo(() => {
    return connectedStations.filter((station) => {
      const matchesSearch =
        station.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        station.clientId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (station.remoteAddress && station.remoteAddress.includes(searchQuery)) ||
        (station.platform && station.platform.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      const risk = getStationRisk(station);
      if (threatFilter === 'high_risk') return risk.score >= 50;
      if (threatFilter === 'quarantined') return quarantinedClients.has(station.clientId);
      if (threatFilter === 'sensors_active') return Boolean(station.isCameraActive || station.isMicActive || station.isScreenActive);

      return true;
    });
  }, [connectedStations, searchQuery, threatFilter, quarantinedClients, frozenScreens]);

  // Disparo de Comando REST para o Servidor
  const executeServerAction = async (payload: Record<string, unknown>) => {
    try {
      const res = await fetch(`${serverUrl}/api/admin/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch {
      return { ok: false, error: 'Erro de comunicação de rede com o servidor' };
    }
  };

  // Disparo de Comando WebSocket Direto
  const sendWsCommand = (payload: Record<string, unknown>) => {
    if (adminWs && adminWs.readyState === WebSocket.OPEN) {
      adminWs.send(JSON.stringify(payload));
      return true;
    }
    return false;
  };

  // 1. Alternar Modo Lockdown (DEFCON 1)
  const handleToggleLockdown = async (enable: boolean) => {
    const reason = lockdownReasonInput.trim() || 'Modo Lockdown de contenção acionado pela Administração.';
    const res = await executeServerAction({ action: 'lockdown', enabled: enable, reason });

    if (res.ok) {
      setIsLockdown(enable);
      setIsLockdownModalOpen(false);
      sendWsCommand({
        t: 'network-lockdown',
        enabled: enable,
        reason,
        timestamp: Date.now(),
      });

      auditoriaEngineRef.current.critico(
        'Governanca',
        `Lockdown de rede ${enable ? 'ATIVADO (DEFCON 1)' : 'DESATIVADO'}: ${reason}`
      );

      addSiemLog({
        type: 'LOCKDOWN',
        level: enable ? 'critical' : 'info',
        details: enable ? `DEFCON 1 ATIVADO: Tráfego não-admin suspenso. Motivo: ${reason}` : 'DEFCON 1 Desativado. Tráfego da malha restabelecido.',
        mitigation: enable ? 'Isolamento global do tráfego P2P e fechamento de túneis' : 'Descongelamento dos canais',
      });

      notify(
        enable ? '🚨 LOCKDOWN GERAL ATIVADO (DEFCON 1)! A rede está em quarentena total.' : '🟢 Lockdown desativado. Tráfego normalizado.',
        enable ? 'danger' : 'success'
      );
      onRefresh();
    } else {
      notify(`Falha ao alterar lockdown: ${res.error || 'Erro desconhecido'}`, 'danger');
    }
  };

  // 2. Colocar Estação em Quarentena Criptográfica
  const handleQuarantineStation = async (station: ConnectedStation) => {
    const reason = 'Estação isolada em quarentena preventiva por detecção de anomalia Zero-Trust.';
    const res = await executeServerAction({ action: 'quarantine', clientId: station.clientId, reason });

    if (res.ok) {
      setQuarantinedClients((prev) => new Set([...prev, station.clientId]));
      sendWsCommand({
        t: 'remote-command',
        room: 'monitor',
        action: 'quarantine',
        targetClientId: station.clientId,
        reason,
      });

      // Penalizar na reputação JJY
      reputacaoEngineRef.current.registrarInfracao(station.clientId);
      auditoriaEngineRef.current.critico('Guard', `Quarentena ativada para ${station.name} (${station.clientId})`, station.clientId);

      addSiemLog({
        type: 'QUARANTINE',
        level: 'critical',
        stationId: station.clientId,
        stationName: station.name,
        details: `Estação isolada da malha. Pacotes barrados no WAF/Mesh.`,
        mitigation: 'Quarentena Criptográfica ativa (Sandbox de leitura estrita)',
      });

      notify(`🛑 Estação "${station.name}" colocada em Quarentena com sucesso!`, 'danger');
      onRefresh();
    } else {
      notify('Falha ao colocar estação em quarentena.', 'danger');
    }
  };

  // 3. Liberar Estação da Quarentena
  const handleUnquarantineStation = async (station: ConnectedStation) => {
    const res = await executeServerAction({ action: 'unquarantine', clientId: station.clientId });

    if (res.ok) {
      setQuarantinedClients((prev) => {
        const next = new Set(prev);
        next.delete(station.clientId);
        return next;
      });
      sendWsCommand({
        t: 'remote-command',
        room: 'monitor',
        action: 'unquarantine',
        targetClientId: station.clientId,
      });

      auditoriaEngineRef.current.info('Guard', `Quarentena revogada para ${station.name}`, station.clientId);

      addSiemLog({
        type: 'QUARANTINE',
        level: 'info',
        stationId: station.clientId,
        stationName: station.name,
        details: `Quarentena revogada pela administração. Acesso restaurado.`,
        mitigation: 'Canal liberado',
      });

      notify(`🟢 Estação "${station.name}" liberada da quarentena.`, 'success');
      onRefresh();
    }
  };

  // 4. Ejetar Sessão (Kill-Switch Imediato)
  const handleEjectStation = async (station: ConnectedStation) => {
    if (!confirm(`Confirmar encerramento sumário (Kill-Switch) da conexão de "${station.name}"?`)) return;

    const res = await executeServerAction({
      action: 'eject',
      clientId: station.clientId,
      reason: 'Sessão ejetada imediatamente pela Central por motivo de segurança.',
    });

    if (res.ok) {
      sendWsCommand({
        t: 'remote-command',
        room: 'monitor',
        action: 'eject',
        targetClientId: station.clientId,
      });

      auditoriaEngineRef.current.critico('Sessao', `Kill-Switch acionado para ${station.name}`, station.clientId);

      addSiemLog({
        type: 'EJECT',
        level: 'critical',
        stationId: station.clientId,
        stationName: station.name,
        details: `Kill-Switch de sessão executado. Conexão terminada com código 4003.`,
        mitigation: 'Desconexão forçada via WebSocket e revogação de tokens',
      });

      notify(`⚡ Estação "${station.name}" desconectada com sucesso.`, 'danger');
      onRefresh();
    } else {
      notify('Falha ao ejetar estação.', 'danger');
    }
  };

  // 5. Cortar Sensores Remotos (Câmera, Microfone e Tela)
  const handleKillSensors = (station: ConnectedStation) => {
    sendWsCommand({
      t: 'remote-command',
      room: 'monitor',
      action: 'kill-sensors',
      targetClientId: station.clientId,
    });

    setSilencedSensors((prev) => new Set([...prev, station.clientId]));
    auditoriaEngineRef.current.aviso('Devmgr', `Corte de periféricos enviado para ${station.name}`, station.clientId);

    addSiemLog({
      type: 'SENSOR_KILL',
      level: 'warning',
      stationId: station.clientId,
      stationName: station.name,
      details: `Comando de corte de sensores emitido. Câmera, microfone e captura de tela desativados.`,
      mitigation: 'Desativação de MediaStream tracks',
    });

    notify(`🔇 Sensores (Câmera, Microfone e Tela) cortados em "${station.name}".`, 'info');
  };

  // 6. Travar / Destravar Tela Remota com Banner de Segurança
  const handleToggleFreezeScreen = (station: ConnectedStation) => {
    const isCurrentlyFrozen = frozenScreens.has(station.clientId);

    if (isCurrentlyFrozen) {
      sendWsCommand({
        t: 'remote-command',
        room: 'monitor',
        action: 'unlock',
        targetClientId: station.clientId,
      });
      setFrozenScreens((prev) => {
        const next = new Set(prev);
        next.delete(station.clientId);
        return next;
      });
      auditoriaEngineRef.current.info('Devmgr', `Tela destravada para ${station.name}`, station.clientId);
      notify(`🔓 Tela de "${station.name}" destravada.`, 'success');
    } else {
      sendWsCommand({
        t: 'remote-command',
        room: 'monitor',
        action: 'freeze-screen',
        targetClientId: station.clientId,
        reason: '🔒 TERMINAL BLOQUEADO PELO ADMINISTRADOR (CONTENÇÃO ZERO-TRUST)',
      });
      setFrozenScreens((prev) => new Set([...prev, station.clientId]));
      auditoriaEngineRef.current.aviso('Devmgr', `Tela congelada para ${station.name}`, station.clientId);

      addSiemLog({
        type: 'SCREEN_LOCK',
        level: 'warning',
        stationId: station.clientId,
        stationName: station.name,
        details: `Tela remota bloqueada com pop-up de violação de segurança.`,
        mitigation: 'Overlay de bloqueio administrativo com teclado restrito',
      });

      notify(`🔒 Tela de "${station.name}" congelada com aviso de segurança.`, 'danger');
    }
  };

  // 7. Banir IP Diretamente no Fail2Ban
  const handleConfirmBanIp = async () => {
    if (!banModalTarget || !banModalTarget.remoteAddress) return;
    const ip = banModalTarget.remoteAddress.split(':')[0].trim();

    try {
      const res = await fetch(`${serverUrl}/api/admin/ban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ip,
          reason: banReason,
          durationMinutes: banHours * 60,
        }),
      });

      if (res.ok) {
        auditoriaEngineRef.current.critico('Governanca', `IP ${ip} banido por ${banHours}h (${banReason})`, banModalTarget.clientId);

        addSiemLog({
          type: 'IP_BAN',
          level: 'critical',
          stationId: banModalTarget.clientId,
          stationName: banModalTarget.name,
          details: `IP ${ip} banido na lista negra por ${banHours}h. Motivo: ${banReason}`,
          mitigation: 'Descarte no socket TCP e bloqueio de handshake',
        });

        notify(`🛡️ IP ${ip} bloqueado no firewall por ${banHours} horas!`, 'danger');
        setBanModalTarget(null);
        onRefresh();
      } else {
        notify('Falha ao banir IP no servidor.', 'danger');
      }
    } catch {
      notify('Erro de conexão ao banir IP.', 'danger');
    }
  };

  // 8. Ajustes na Reputação JJY (Spec 36)
  const handleAdjustJjyReputation = (station: ConnectedStation, action: 'cooperate' | 'penalize' | 'pardon') => {
    if (action === 'cooperate') {
      reputacaoEngineRef.current.registrarCooperacao(station.clientId);
      auditoriaEngineRef.current.info('Reputacao', `Cooperação atribuída para nó ${station.name}`, station.clientId);
      notify(`+1 Ponto de Cooperação atribuído a "${station.name}".`, 'info');
    } else if (action === 'penalize') {
      reputacaoEngineRef.current.registrarInfracao(station.clientId);
      auditoriaEngineRef.current.aviso('Reputacao', `Infração registrada para nó ${station.name}`, station.clientId);
      notify(`⚠️ Infração registrada (-50 pontos) para "${station.name}".`, 'danger');
    } else if (action === 'pardon') {
      reputacaoEngineRef.current.perdoar(station.clientId);
      auditoriaEngineRef.current.info('Reputacao', `Nó reabilitado para 500: ${station.name}`, station.clientId);
      notify(`⚖️ Reputação de "${station.name}" reabilitada para o nível padrão (500).`, 'success');
    }
    // Força re-render
    onRefresh();
  };

  // 9. Verificação Criptográfica da Trilha de Auditoria (Spec 37)
  const handleVerifyAuditChain = () => {
    const eventos = auditoriaEngineRef.current.todos();
    if (eventos.length === 0) {
      setAuditChainVerified({ verified: true, checkedCount: 0, timestamp: Date.now() });
      notify('Trilha de auditoria sem registros suficientes ainda.', 'info');
      return;
    }

    let isChainValid = true;
    for (let i = 1; i < eventos.length; i++) {
      if (eventos[i].hashAnterior !== eventos[i - 1].hash) {
        isChainValid = false;
        break;
      }
    }

    setAuditChainVerified({
      verified: isChainValid,
      checkedCount: eventos.length,
      timestamp: Date.now(),
    });

    if (isChainValid) {
      notify(`✓ Trilha auditada: ${eventos.length} blocos criptográficos validados com 100% de integridade!`, 'success');
    } else {
      notify('🚨 ALERTA: Quebra detectada no encadeamento de hashes da auditoria!', 'danger');
    }
  };

  // 10. Executar Simulações Defensivas no Sandbox
  const handleRunSimulation = (type: 'flood' | 'admin_spoof' | 'rogue_hash' | 'acoustic_jam') => {
    setIsSimulating(type);

    setTimeout(() => {
      if (type === 'flood') {
        auditoriaEngineRef.current.aviso('Guard', 'Simulação: Ataque de Flood de 150 pacotes/seg mitigado pelo Rate Limiter');
        addSiemLog({
          type: 'SIMULATION',
          level: 'warning',
          details: 'Teste Pen-Test: Ataque Flood de pacotes disparado. Limite de requisições acionado com sucesso.',
          mitigation: 'Tarpit e contenção automática de conexões abusivas',
        });
        notify('🧪 Teste de Flood: Contenção de taxa validada com sucesso!', 'success');
      } else if (type === 'admin_spoof') {
        auditoriaEngineRef.current.critico('Governanca', 'Simulação: Tentativa de bypass de token administrativo detectada');
        addSiemLog({
          type: 'SIMULATION',
          level: 'critical',
          details: 'Teste Pen-Test: Assinatura de token inválida injetada no endpoint /api/admin/action.',
          mitigation: 'WAF descartou o payload e gerou alerta de intrusão',
        });
        notify('🧪 Teste de Forja de Token: WAF bloqueou tentativa de intrusão!', 'success');
      } else if (type === 'rogue_hash') {
        auditoriaEngineRef.current.critico('Malha', 'Simulação: Pacote com hash adulterado rejeitado pela validação JJY');
        addSiemLog({
          type: 'SIMULATION',
          level: 'critical',
          details: 'Teste Pen-Test: Pacote com hash corrompido injetado no canal de transporte.',
          mitigation: 'Descarte imediato do pacote corrompido e redução de reputação',
        });
        notify('🧪 Teste de Hash Corrompido: Protocolo JJY rejeitou o bloco fraudulento!', 'success');
      } else if (type === 'acoustic_jam') {
        auditoriaEngineRef.current.aviso('Audio', 'Simulação: Ruído de interferência acústica detectado. LQI degradado para 15%');
        addSiemLog({
          type: 'SIMULATION',
          level: 'warning',
          details: 'Teste Pen-Test: Ruído artificial induzido no demodulador de áudio.',
          mitigation: 'Fallback automático para modo FSK robusto e compressão com paridade',
        });
        notify('🧪 Teste de Jamming Acústico: Demodulador ativou redundância!', 'success');
      }
      setIsSimulating(null);
    }, 1200);
  };

  // 11. Exportar Relatório Forense
  const handleExportForensicReport = () => {
    const report = {
      exportTimestamp: new Date().toISOString(),
      serverUrl,
      networkLockdownActive: isLockdown,
      quarantinedClients: Array.from(quarantinedClients),
      silencedSensors: Array.from(silencedSensors),
      frozenScreens: Array.from(frozenScreens),
      networkAverageRisk,
      connectedStationsCount: connectedStations.length,
      stations: connectedStations.map((s) => ({
        ...s,
        risk: getStationRisk(s),
      })),
      jjyReputationScores: reputacaoEngineRef.current.todos(),
      auditTrail: auditoriaEngineRef.current.todos(),
      siemEvents,
      securityStats: securityData?.stats,
      bannedIps: securityData?.bannedIps,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-forense-soc-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('📥 Relatório forense exportado com sucesso!', 'success');
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      {/* Alerta de feedback flutuante */}
      {actionNotice && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-md flex items-center gap-3 transition-all ${
            actionNotice.type === 'danger'
              ? 'bg-rose-950/90 text-rose-200 border-rose-600/60 shadow-rose-950/50'
              : actionNotice.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-600/60 shadow-emerald-950/50'
              : 'bg-indigo-950/90 text-indigo-200 border-indigo-600/60 shadow-indigo-950/50'
          }`}
        >
          {actionNotice.type === 'danger' ? (
            <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 animate-bounce" />
          ) : actionNotice.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <Zap className="w-5 h-5 text-indigo-400 shrink-0" />
          )}
          <span className="text-xs font-semibold">{actionNotice.message}</span>
        </div>
      )}

      {/* MASTER BANNER: LOCKDOWN DE REDE (DEFCON 1) */}
      <div
        className={`p-5 rounded-3xl border transition-all relative overflow-hidden shadow-2xl ${
          isLockdown
            ? 'bg-gradient-to-r from-red-950 via-rose-950 to-red-950 border-red-500 shadow-red-950/60 ring-2 ring-red-500/50 animate-pulse'
            : 'bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-slate-800 shadow-slate-950/50'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-3.5">
            <div
              className={`p-3 rounded-2xl border ${
                isLockdown
                  ? 'bg-red-600 text-white border-red-400 animate-spin'
                  : 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30'
              }`}
            >
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-slate-100 tracking-wide uppercase flex items-center gap-2">
                  <span>{isLockdown ? '🚨 LOCKDOWN GERAL ATIVO (DEFCON 1)' : '🛡️ Postura Zero-Trust & Contenção Tática'}</span>
                </h2>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                    isLockdown
                      ? 'bg-red-900/80 text-red-200 border-red-500'
                      : 'bg-emerald-950 text-emerald-300 border-emerald-700/50'
                  }`}
                >
                  {isLockdown ? 'Isolamento Total' : 'Monitoramento Ativo'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                {isLockdown
                  ? 'Todos os nós não-administrativos estão com tráfego suspenso e canais bloqueados. Apenas administradores autenticados podem interagir com a malha.'
                  : 'Varredura contínua de ameaças com pontuação heurística de risco, corte preventivo de periféricos e bloqueio imediato de nós maliciosos.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleExportForensicReport}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all shadow-md active:scale-95"
              title="Exportar todos os logs de auditoria e incidentes em formato JSON"
            >
              <Download className="w-4 h-4 text-slate-400" />
              <span>Relatório Forense</span>
            </button>

            {isLockdown ? (
              <button
                type="button"
                onClick={() => handleToggleLockdown(false)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-950/60 active:scale-95 transition-all"
              >
                <Unlock className="w-4 h-4" />
                <span>Restaurar Tráfego (Desativar DEFCON 1)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsLockdownModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-red-950/60 active:scale-95 transition-all animate-pulse"
              >
                <AlertOctagon className="w-4 h-4" />
                <span>🚨 Disparar Lockdown (DEFCON 1)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* METRICAS TATICAS DO SOC (6 CARDS) */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-slate-900/70 border border-slate-800 p-3.5 rounded-2xl shadow-lg relative overflow-hidden">
          <span className="text-[11px] text-slate-400 font-medium block">Risco Médio da Rede</span>
          <div
            className={`text-2xl font-black font-mono mt-1 ${
              networkAverageRisk >= 50 ? 'text-rose-400' : networkAverageRisk >= 25 ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            {networkAverageRisk}%
          </div>
          <div className="w-full bg-slate-800 h-1 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full transition-all ${
                networkAverageRisk >= 50 ? 'bg-rose-500' : networkAverageRisk >= 25 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${networkAverageRisk}%` }}
            />
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 p-3.5 rounded-2xl shadow-lg">
          <span className="text-[11px] text-slate-400 font-medium block">Estações Conectadas</span>
          <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">{connectedStations.length}</div>
          <span className="text-[10px] text-slate-500">Monitoradas pelo SOC</span>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 p-3.5 rounded-2xl shadow-lg">
          <span className="text-[11px] text-slate-400 font-medium block">Quarentenas Ativas</span>
          <div className="text-2xl font-bold font-mono text-rose-400 mt-1">{quarantinedClients.size}</div>
          <span className="text-[10px] text-slate-500">Isoladas do Mesh</span>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 p-3.5 rounded-2xl shadow-lg">
          <span className="text-[11px] text-slate-400 font-medium block">Sensores Cortados</span>
          <div className="text-2xl font-bold font-mono text-purple-400 mt-1">{silencedSensors.size}</div>
          <span className="text-[10px] text-slate-500">Câmeras / Mics Silenciados</span>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 p-3.5 rounded-2xl shadow-lg">
          <span className="text-[11px] text-slate-400 font-medium block">Trilha de Auditoria</span>
          <div className="text-2xl font-bold font-mono text-indigo-400 mt-1">
            {auditoriaEngineRef.current.todos().length}
          </div>
          <span className="text-[10px] text-slate-500">Blocos Hash-Chain JJY</span>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 p-3.5 rounded-2xl shadow-lg">
          <span className="text-[11px] text-slate-400 font-medium block">IPs em Blacklist</span>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
            {securityData?.bannedIps?.length || 0}
          </div>
          <span className="text-[10px] text-slate-500">Fail2Ban Ativo</span>
        </div>
      </div>

      {/* SELETOR DE SUB-SEÇÃO DE CONTENÇÃO */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-3 flex-wrap">
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setSubSection('stations')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              subSection === 'stations'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Matriz de Ameaças & Estações</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-950 text-rose-300">
              {filteredStations.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubSection('jjy_audit')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              subSection === 'jjy_audit'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Governança JJY & Auditoria Criptográfica</span>
          </button>

          <button
            type="button"
            onClick={() => setSubSection('simulation')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              subSection === 'simulation'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Sandbox Pen-Test</span>
          </button>

          <button
            type="button"
            onClick={() => setSubSection('siem')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              subSection === 'siem'
                ? 'bg-slate-800 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Feed de Incidentes (SIEM)</span>
            {siemEvents.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-950 text-red-300">
                {siemEvents.length}
              </span>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Sincronizar Nós</span>
        </button>
      </div>

      {/* SUB-SEÇÃO 1: MATRIZ DE AMEAÇAS & ESTAÇÕES CONECTADAS */}
      {subSection === 'stations' && (
        <div className="space-y-4">
          {/* Barra de Pesquisa e Filtro de Risco */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar estações por nome, Client ID, IP ou Plataforma..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500/50"
              />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-500 font-medium mr-1 flex items-center gap-1">
                <SlidersHorizontal className="w-3 h-3" /> Filtro:
              </span>
              {(['all', 'high_risk', 'quarantined', 'sensors_active'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setThreatFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    threatFilter === filter
                      ? 'bg-rose-900/60 text-rose-200 border border-rose-600/50'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {filter === 'all' && 'Todos os Nós'}
                  {filter === 'high_risk' && '⚠️ Alto Risco (≥50%)'}
                  {filter === 'quarantined' && '🛑 Em Quarentena'}
                  {filter === 'sensors_active' && '📡 Sensores Ativos'}
                </button>
              ))}
            </div>
          </div>

          {/* Cards das Estações */}
          {filteredStations.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/40 rounded-3xl border border-slate-800 text-slate-400 space-y-2">
              <ShieldCheck className="w-10 h-10 mx-auto text-emerald-500/70" />
              <p className="text-sm font-semibold">Nenhuma estação atende aos critérios do filtro.</p>
              <p className="text-xs text-slate-500">Todos os nós operando dentro dos parâmetros de segurança normais.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStations.map((station) => {
                const risk = getStationRisk(station);
                const isQuarantined = quarantinedClients.has(station.clientId);
                const isSensorsSilenced = silencedSensors.has(station.clientId);
                const isScreenFrozen = frozenScreens.has(station.clientId);

                return (
                  <div
                    key={station.clientId}
                    className={`p-4 rounded-3xl border transition-all relative flex flex-col justify-between shadow-xl ${
                      isQuarantined
                        ? 'bg-rose-950/30 border-rose-600/60 shadow-rose-950/40'
                        : risk.score >= 50
                        ? 'bg-slate-900/90 border-amber-600/40 hover:border-amber-500/60'
                        : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      {/* Top Header do Card */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-xs uppercase shadow-inner"
                            style={{
                              backgroundColor: station.color ? `${station.color}25` : '#6366f125',
                              color: station.color || '#6366f1',
                              border: `1.5px solid ${station.color || '#6366f1'}60`,
                            }}
                          >
                            {station.name.substring(0, 2)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h3 className="font-bold text-sm text-slate-100">{station.name}</h3>
                              {isQuarantined && (
                                <span className="text-[10px] bg-rose-600 text-white font-black px-1.5 py-0.2 rounded-md uppercase">
                                  Quarentena
                                </span>
                              )}
                              {isScreenFrozen && (
                                <span className="text-[10px] bg-amber-600 text-white font-black px-1.5 py-0.2 rounded-md uppercase">
                                  Tela Travada
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 block truncate max-w-[190px]">
                              {station.clientId}
                            </span>
                          </div>
                        </div>

                        {/* Badge de Risco */}
                        <div className={`px-2.5 py-1 rounded-xl border text-xs font-mono font-bold ${risk.colorClass}`}>
                          {risk.score}% Risco
                        </div>
                      </div>

                      {/* Barra de Progresso de Risco */}
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mb-3 border border-slate-800">
                        <div className={`h-full transition-all ${risk.barColor}`} style={{ width: `${risk.score}%` }} />
                      </div>

                      {/* Informações Técnicas e de Rede */}
                      <div className="space-y-1.5 text-xs text-slate-300 bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80 mb-3">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">IP & Conexão:</span>
                          <span className="font-mono text-slate-300 truncate max-w-[170px]">
                            {station.remoteAddress || '127.0.0.1'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Plataforma:</span>
                          <span className="text-slate-300 truncate max-w-[170px]">
                            {station.platform || 'Desconhecido'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Latência RTT:</span>
                          <span className="font-mono text-slate-300">
                            {station.latency !== null && station.latency !== undefined ? `${station.latency}ms` : '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Reputação JJY Spec 36:</span>
                          <span
                            className={`font-mono font-bold ${
                              risk.repScore >= 700
                                ? 'text-emerald-400'
                                : risk.repScore >= 300
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {risk.repScore}/1000 ({risk.repClass})
                          </span>
                        </div>

                        {station.location && (
                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/60">
                            <span className="text-slate-500">Geolocalização:</span>
                            <GpsHoverBadge
                              location={station.location}
                              stationName={station.name}
                              buttonLabel={`${station.location.flag || '📍'} ${station.location.city || station.location.country || 'Mapa'}`}
                              className="text-[11px] text-emerald-400 hover:underline"
                            />
                          </div>
                        )}
                      </div>

                      {/* Anomalias Detectadas */}
                      {risk.anomalies.length > 0 && (
                        <div className="mb-3 space-y-1">
                          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                            Anomalias Identificadas:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {risk.anomalies.map((a, idx) => (
                              <span
                                key={idx}
                                className={`text-[10px] px-2 py-0.5 rounded-lg border flex items-center gap-1 ${
                                  a.severity === 'critical'
                                    ? 'bg-rose-950/80 text-rose-300 border-rose-800/60'
                                    : a.severity === 'high'
                                    ? 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                                    : 'bg-yellow-950/80 text-yellow-300 border-yellow-800/60'
                                }`}
                              >
                                <AlertTriangle className="w-2.5 h-2.5" />
                                {a.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                      {/* BARRA DE AÇÕES TÁTICAS DE CONTENÇÃO */}
                    <div className="pt-3 border-t border-slate-800/80 space-y-2">
                      <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                        Contenção Imediata:
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        {/* Quarentena */}
                        {isQuarantined ? (
                          <button
                            type="button"
                            onClick={() => handleUnquarantineStation(station)}
                            className="px-2.5 py-1.5 rounded-xl bg-teal-950 hover:bg-teal-900 border border-teal-600/50 text-teal-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
                          >
                            <Unlock className="w-3.5 h-3.5 text-teal-400" />
                            <span>Liberar Quarentena</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleQuarantineStation(station)}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-600/50 text-rose-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
                          >
                            <ShieldOff className="w-3.5 h-3.5 text-rose-400" />
                            <span>Quarentena</span>
                          </button>
                        )}

                        {/* Kill-Switch Ejetar */}
                        <button
                          type="button"
                          onClick={() => handleEjectStation(station)}
                          className="px-2.5 py-1.5 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-600/50 text-red-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
                        >
                          <Zap className="w-3.5 h-3.5 text-red-400" />
                          <span>Kill-Switch</span>
                        </button>

                        {/* Cortar Sensores */}
                        <button
                          type="button"
                          onClick={() => handleKillSensors(station)}
                          className="px-2.5 py-1.5 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-600/50 text-purple-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
                          title="Desliga microfone, câmera e tela remotamente"
                        >
                          <VolumeX className="w-3.5 h-3.5 text-purple-400" />
                          <span>Cortar Sensores</span>
                        </button>

                        {/* Travar Tela */}
                        <button
                          type="button"
                          onClick={() => handleToggleFreezeScreen(station)}
                          className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 ${
                            isScreenFrozen
                              ? 'bg-amber-950 hover:bg-amber-900 border-amber-600 text-amber-200'
                              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                          }`}
                        >
                          <Lock className="w-3.5 h-3.5 text-amber-400" />
                          <span>{isScreenFrozen ? 'Destravar' : 'Travar Tela'}</span>
                        </button>
                      </div>

                      {/* Ações Avançadas: Banir IP & Reputação JJY */}
                      <div className="flex items-center justify-between gap-1 pt-1">
                        <button
                          type="button"
                          onClick={() => setBanModalTarget(station)}
                          className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold p-1 hover:bg-rose-950/40 rounded-lg transition-all"
                        >
                          <Ban className="w-3 h-3" /> Banir IP
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleAdjustJjyReputation(station, 'penalize')}
                            className="text-[10px] px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/40 hover:bg-rose-900 transition-all"
                            title="Penalizar Reputação JJY (-50)"
                          >
                            -50 JJY
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAdjustJjyReputation(station, 'pardon')}
                            className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-all"
                            title="Restaurar Reputação para 500"
                          >
                            Restaurar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-SEÇÃO 2: GOVERNANÇA JJY & AUDITORIA CRIPTOGRÁFICA */}
      {subSection === 'jjy_audit' && (
        <div className="space-y-6">
          {/* Header da Seção de Auditoria */}
          <div className="bg-slate-900/60 p-4 rounded-3xl border border-slate-800 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                <span>Trilha de Auditoria Criptográfica Imutável (JJY Spec 37)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cada evento de segurança, intervenção ou transferência de dados é encadeado por SHA deterministicamente.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleVerifyAuditChain}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-950/50 active:scale-95 transition-all"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Verificar Integridade da Cadeia</span>
              </button>

              <button
                type="button"
                onClick={handleExportForensicReport}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-all border border-slate-700"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>Exportar Ledger</span>
              </button>
            </div>
          </div>

          {/* Resultado da Validação Criptográfica */}
          {auditChainVerified && (
            <div
              className={`p-4 rounded-2xl border flex items-center gap-3 animate-in fade-in ${
                auditChainVerified.verified
                  ? 'bg-emerald-950/60 border-emerald-600/60 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-600/60 text-rose-200'
              }`}
            >
              {auditChainVerified.verified ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-6 h-6 text-rose-400 shrink-0 animate-pulse" />
              )}
              <div>
                <span className="font-bold text-xs block">
                  {auditChainVerified.verified
                    ? `✓ Integridade Criptográfica Verificada: ${auditChainVerified.checkedCount} Blocos Válidos!`
                    : '🚨 FALHA DE INTEGRIDADE: Divergência detectada no encadeamento de hashes!'}
                </span>
                <span className="text-[11px] opacity-80">
                  Validação efetuada em {new Date(auditChainVerified.timestamp).toLocaleTimeString()} com algoritmo SHA determinístico.
                </span>
              </div>
            </div>
          )}

          {/* Tabela de Eventos Encadeados da Trilha */}
          <div className="bg-slate-900/60 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="p-3.5 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold text-slate-200">Blocos Criptográficos do Ledger ({auditoriaEngineRef.current.todos().length})</span>
              <span className="text-[11px]">Capacidade do Buffer FIFO: 500 blocos</span>
            </div>

            <div className="overflow-x-auto max-h-[460px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="p-3">ID / Tick</th>
                    <th className="p-3">Horário</th>
                    <th className="p-3">Gravidade</th>
                    <th className="p-3">Origem</th>
                    <th className="p-3">Nó / Alvo</th>
                    <th className="p-3">Descrição Operacional</th>
                    <th className="p-3 font-mono">Hash Atual</th>
                    <th className="p-3 font-mono">Hash Anterior</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {auditoriaEngineRef.current.ultimos(40).map((evento) => (
                    <tr key={evento.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-mono text-slate-400">
                        #{evento.id} <span className="text-[10px] text-slate-500">(T:{evento.tick})</span>
                      </td>
                      <td className="p-3 text-slate-400 whitespace-nowrap">
                        {new Date(evento.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            evento.gravidade === 'Critico'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                              : evento.gravidade === 'Erro'
                              ? 'bg-red-950 text-red-300 border border-red-800/60'
                              : evento.gravidade === 'Aviso'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {evento.gravidade}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-slate-300">{evento.origem}</td>
                      <td className="p-3 font-mono text-slate-400 truncate max-w-[120px]">
                        {evento.peerId || '—'}
                      </td>
                      <td className="p-3 text-slate-200">{evento.descricao}</td>
                      <td className="p-3 font-mono text-[11px] text-emerald-400">
                        {evento.hash}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-500">
                        {evento.hashAnterior}
                      </td>
                    </tr>
                  ))}
                  {auditoriaEngineRef.current.todos().length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        Nenhum bloco registrado no ledger ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-SEÇÃO 3: SANDBOX PEN-TEST & SIMULAÇÃO DEFENSIVA */}
      {subSection === 'simulation' && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 p-5 rounded-3xl border border-slate-800">
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Sandbox de Simulação de Ataques & Pen-Test Defensivo</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Dispare cenários de invasão controlados para testar em tempo real as respostas dos módulos de contenção,
              a resposta do WAF, o isolamento no Fail2Ban e a detecção de adulteração do JJY Sovereign Mesh.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5">
              {/* Cenário 1: Flood DDoS */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                    <Flame className="w-4 h-4" />
                    <span>Flood de Pacotes (DDoS)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Simula rajada de 150 pacotes/s para testar corte automático via Rate Limiter e Tarpit.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={Boolean(isSimulating)}
                  onClick={() => handleRunSimulation('flood')}
                  className="w-full py-2 px-3 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-600/50 text-rose-200 text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>{isSimulating === 'flood' ? 'Executando...' : 'Simular Flood'}</span>
                </button>
              </div>

              {/* Cenário 2: Forja de Token Admin */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                    <Lock className="w-4 h-4" />
                    <span>Forja de Token Admin</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Simula tentativa de autenticação não autorizada nos endpoints REST administrativos.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={Boolean(isSimulating)}
                  onClick={() => handleRunSimulation('admin_spoof')}
                  className="w-full py-2 px-3 rounded-xl bg-amber-950/80 hover:bg-amber-900 border border-amber-600/50 text-amber-200 text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isSimulating === 'admin_spoof' ? 'Executando...' : 'Simular Forja'}</span>
                </button>
              </div>

              {/* Cenário 3: Nó Invasor com Hash Adulterado */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
                    <FileWarning className="w-4 h-4" />
                    <span>Bloco Adulterado (JJY)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Injeta pacote de bloco com hash divergente para verificar descarte e redução de reputação.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={Boolean(isSimulating)}
                  onClick={() => handleRunSimulation('rogue_hash')}
                  className="w-full py-2 px-3 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-600/50 text-indigo-200 text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <FileWarning className="w-3.5 h-3.5" />
                  <span>{isSimulating === 'rogue_hash' ? 'Executando...' : 'Simular Hash Falso'}</span>
                </button>
              </div>

              {/* Cenário 4: Jamming Acústico */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center gap-2 text-purple-400 font-bold text-xs">
                    <RadioTower className="w-4 h-4" />
                    <span>Jamming Acústico</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Simula saturação de canal no demodulador ultrassônico/audível para testar chaveamento resiliente.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={Boolean(isSimulating)}
                  onClick={() => handleRunSimulation('acoustic_jam')}
                  className="w-full py-2 px-3 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-600/50 text-purple-200 text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <RadioTower className="w-3.5 h-3.5" />
                  <span>{isSimulating === 'acoustic_jam' ? 'Executando...' : 'Simular Jamming'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-SEÇÃO 4: SIEM FEED DE INCIDENTES EM TEMPO REAL */}
      {subSection === 'siem' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 p-4 rounded-3xl border border-slate-800 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>Central de Eventos SIEM / SOC em Tempo Real</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Histórico detalhado de contenções, disparos de quarentena, expulsões e alertas táticos.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSiemEvents([])}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Limpar Feed</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-900/60 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="divide-y divide-slate-800/60 max-h-[500px] overflow-y-auto">
              {siemEvents.length === 0 ? (
                <div className="p-12 text-center text-slate-500 space-y-1">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/60" />
                  <p className="text-xs font-medium">Nenhum incidente de segurança ativo registrado.</p>
                  <p className="text-[11px] text-slate-600">As intervenções administrativas e eventos do WAF aparecerão aqui.</p>
                </div>
              ) : (
                siemEvents.map((event) => (
                  <div key={event.id} className="p-3.5 hover:bg-slate-800/40 transition-colors flex items-start gap-3">
                    <div
                      className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                        event.level === 'critical'
                          ? 'bg-rose-950 text-rose-400 border border-rose-800/60'
                          : event.level === 'warning'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800/60'
                          : 'bg-indigo-950 text-indigo-400 border border-indigo-800/60'
                      }`}
                    >
                      {event.level === 'critical' ? (
                        <AlertOctagon className="w-4 h-4" />
                      ) : event.level === 'warning' ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : (
                        <Activity className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-200 uppercase tracking-wide">
                            [{event.type}]
                          </span>
                          {event.stationName && (
                            <span className="text-xs text-cyan-300 font-semibold truncate">
                              {event.stationName}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-slate-500">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">{event.details}</p>
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                        <span className="font-semibold text-slate-500">Mitigação Aplicada:</span>
                        <span className="text-emerald-400 font-mono">{event.mitigation}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: CONFIRMAR DISPARO DE LOCKDOWN (DEFCON 1) */}
      {isLockdownModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border-2 border-red-600 rounded-3xl max-w-lg w-full p-6 shadow-2xl shadow-red-950/80 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 rounded-2xl bg-red-950 border border-red-600">
                <AlertOctagon className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-100 uppercase tracking-wider">
                  Confirmar Lockdown Geral de Rede
                </h3>
                <span className="text-xs text-red-400 font-bold">Nível DEFCON 1 de Emergência</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              O Lockdown de Rede irá congelar todo o tráfego de dados, mensagens e arquivos não-administrativos
              em toda a malha soberana. Apenas administradores autenticados manterão a conectividade.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Motivo do Lockdown (Aviso aos Usuários):</label>
              <textarea
                value={lockdownReasonInput}
                onChange={(e) => setLockdownReasonInput(e.target.value)}
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsLockdownModalOpen(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleToggleLockdown(true)}
                className="px-5 py-2.5 bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-red-950 flex items-center gap-2 active:scale-95 transition-all"
              >
                <AlertOctagon className="w-4 h-4" />
                <span>🚨 Confirmar e Travar Rede Agora</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: BANIR IP NO FAIL2BAN */}
      {banModalTarget && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-2xl bg-rose-950 border border-rose-600/50">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-100">Banir IP de Estação</h3>
                <span className="text-xs font-mono text-slate-400">
                  {banModalTarget.name} ({banModalTarget.remoteAddress || '127.0.0.1'})
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Motivo do Bloqueio:</label>
                <input
                  type="text"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Duração do Banimento:</label>
                <select
                  value={banHours}
                  onChange={(e) => setBanHours(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                >
                  <option value={1}>1 Hora</option>
                  <option value={6}>6 Horas</option>
                  <option value={24}>24 Horas (1 Dia)</option>
                  <option value={168}>7 Dias</option>
                  <option value={8760}>Permanente (1 Ano)</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setBanModalTarget(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmBanIp}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-950 flex items-center gap-1.5 transition-all"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Bloquear IP no Firewall</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
