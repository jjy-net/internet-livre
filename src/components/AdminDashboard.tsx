import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldAlert,
  Shield,
  ShieldCheck,
  Server,
  Activity,
  Users,
  HardDrive,
  Cpu,
  RefreshCw,
  Search,
  Send,
  UserX,
  Download,
  Clock,
  Radio,
  FileText,
  AlertTriangle,
  CheckCircle,
  Copy,
  Check,
  Lock,
  Unlock,
  Key,
  Eye,
  EyeOff,
  Ban,
  Zap,
  LogOut,
  Camera,
  Video,
  Mic,
  Volume2,
  Maximize2,
  Play,
  Pause,
  FileAudio,
  FolderDown,
  Image as ImageIcon,
  Trash2,
  Smartphone,
  ExternalLink,
  Monitor,
  MonitorPlay,
  MonitorOff,
  MessageSquare,
  MessageCircle,
  Headphones,
  VolumeX,
  PhoneCall,
  BellRing,
  Sliders,
  ChevronDown,
  ChevronUp,
  Columns,
  Minimize2,
  SendHorizontal,
  Baby,
  Tv,
  Grid,
  AlertOctagon,
  UserCheck,
  Plus,
  Minus,
  Star,
  FolderOpen,
  Sparkles,
  MapPin,
  Globe,
  Navigation,
  Bot,
  QrCode,
} from 'lucide-react';
import QRCode from 'qrcode';
import { GeoLocationData, getGoogleMapsUrl, getOpenStreetMapUrl } from '../utils/geo';
import { GpsHoverBadge } from './GpsHoverBadge';
import { AdminContainmentView } from './AdminContainmentView';
import { AdminAiCopilotView } from './AdminAiCopilotView';
import { AdminNsiteView } from './AdminNsiteView';
import { getPrivacyShieldManager } from '../utils/antiFingerprintEngine';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';

interface TelemetryData {
  server: {
    name: string;
    version: string;
    port: number;
    ips: string[];
    startedAt: number;
    uptimeSeconds: number;
    running: boolean;
  };
  system: {
    platform: string;
    arch: string;
    osRelease: string;
    cpus: number;
    nodeVersion: string;
    memory: {
      rssBytes: number;
      heapTotalBytes: number;
      heapUsedBytes: number;
      externalBytes: number;
      systemTotalBytes: number;
      systemFreeBytes: number;
    };
  };
  traffic: {
    totalConnections: number;
    activePeersCount: number;
    peakConcurrency: number;
    totalMessagesRelayed: number;
    totalBytesTransferred: number;
    messageTypesCount: Record<string, number>;
  };
  peers: {
    peerId: number;
    clientId: string;
    name: string;
    color: string;
    latency: number | null;
    since: number;
    lastActiveAt: number;
    messagesSent: number;
    bytesSent: number;
    remoteAddress: string;
    userAgent: string;
    location?: GeoLocationData | null;
  }[];
  recentEvents: {
    ts: number;
    type: string;
    detail: string;
  }[];
}

interface BannedIpRecord {
  ip: string;
  reason: string;
  bannedAt: number;
  expiresAt: number | null;
  auto: boolean;
}

interface SecurityData {
  stats: {
    blockedRequests: number;
    bannedIpsCount: number;
    rateLimitViolations: number;
    intrusionsDetected: number;
    tarpittedConnections: number;
    failedLogins: number;
    activeBans: number;
  };
  bannedIps: BannedIpRecord[];
  isLockdown?: boolean;
  quarantinedClients?: string[];
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6', '#ef4444'];
const DEFAULT_SYSTEM_PASSWORD = 'DL-Admin#9xK7$SecShield!2026';

function generateRandomSecurePassword(length = 24): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const all = upper + lower + numbers + symbols;

  const array = new Uint32Array(length);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < length; i++) array[i] = Math.floor(Math.random() * 100000);
  }

  const chars: string[] = [
    upper[array[0] % upper.length],
    lower[array[1] % lower.length],
    numbers[array[2] % numbers.length],
    symbols[array[3] % symbols.length],
  ];

  for (let i = 4; i < length; i++) {
    chars.push(all[array[i] % all.length]);
  }

  return chars.sort(() => 0.5 - Math.random()).join('');
}

export interface SurveillanceFeed {
  fromPeerId: number;
  fromClientId: string;
  fromName: string;
  frameData: string;
  lastUpdated: number;
  location?: GeoLocationData;
}

export interface ReceivedAudioSample {
  id: string;
  fromClientId: string;
  fromName: string;
  audioData: string;
  duration?: number;
  timestamp: number;
}

export interface ReceivedRemoteFile {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
  ownerName: string;
  timestamp: number;
}

export interface CctvRecordingItem {
  id: string;
  filename: string;
  url: string;
  clientId: string;
  clientName: string;
  deviceInfo?: string;
  type?: string;
  size: number;
  timestamp: number;
  formattedDate: string;
  trigger: 'manual' | 'motion' | 'alarm' | 'scheduled';
  triggerLabel: string;
  starred: boolean;
  note?: string;
}

export interface CctvStorageStats {
  totalCount: number;
  filteredCount: number;
  totalBytes: number;
  totalBytesFormatted: string;
  starredCount: number;
  maxCount: number;
  maxBytes: number;
  maxBytesFormatted: string;
  recordingsDir: string;
}

export interface SecurityAlertItem {
  id: string;
  timestamp: number;
  fromName: string;
  fromClientId?: string;
  detail: string;
  snapshot?: string;
  alertType?: string;
}

export interface ScreenFeed {
  fromPeerId: number;
  fromClientId: string;
  fromName: string;
  frameData: string;
  lastUpdated: number;
  location?: GeoLocationData;
}

export interface AdminDirectChatMessage {
  id: string;
  fromClientId: string;
  fromName: string;
  toClientId?: string;
  text: string;
  timestamp: number;
  isFromAdmin: boolean;
}

export interface StationScreenData {
  width: number;
  height: number;
  availWidth?: number;
  availHeight?: number;
  colorDepth?: number;
  pixelRatio?: number;
  orientation?: string;
  windowWidth?: number;
  windowHeight?: number;
  hasFocus?: boolean;
  isScreenSharing?: boolean;
  isCameraActive?: boolean;
  isMicActive?: boolean;
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
  location?: GeoLocationData;
}


export interface ParentalPolicy {
  clientId: string;
  enabled: boolean;
  category: 'kids' | 'teens' | 'custom' | 'none';
  dailyLimitMinutes: number;
  bedtimeHour: number;
  blockedKeywords: string[];
  autoLockOnViolation: boolean;
  blurScreen: boolean;
  takeScreenshotOnViolation: boolean;
}

export interface ParentalViolationAlert {
  id: string;
  timestamp: number;
  stationName: string;
  clientId: string;
  reason: string;
  termFound?: string;
  snapshot?: string;
  actionTaken: string;
}


export const DEFAULT_PARENTAL_KEYWORDS = [
  'adulto', 'xxx', 'porn', 'sexo', 'bet365', 'cassino', 'aposta',
  'blaze', 'tigrinho', 'gore', 'violencia', 'drogas', 'torrent', 'warez', 'hack'
];

export interface AdminDashboardProps {
  onExit?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onExit }) => {
  const [serverUrl, setServerUrl] = useState(() => {
    const loc = window.location;
    if (loc.protocol.startsWith('http')) {
      return `${loc.protocol}//${loc.hostname}:${loc.port || '4870'}`;
    }
    return 'http://localhost:4870';
  });

  // Autenticação
  const [token, setToken] = useState<string>(() => {
    return sessionStorage.getItem('datalink_admin_token') || '';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [requireOtp, setRequireOtp] = useState(false);

  // TOTP 2FA — Configuração
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpSetupPending, setTotpSetupPending] = useState(false);
  const [totpSecret, setTotpSecret] = useState('');
  const [totpUri, setTotpUri] = useState('');
  const [totpQrDataUrl, setTotpQrDataUrl] = useState('');
  const [totpConfirmCode, setTotpConfirmCode] = useState('');
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpMessage, setTotpMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [totpDisablePassword, setTotpDisablePassword] = useState('');
  const [showTotpSection, setShowTotpSection] = useState(false);

  // Tabs do Painel de Admin (Central Unificada: CFTV, Controle Parental, Telemetria, Defesa, Contenção Zero-Trust, Copilot IA e Nsite Nostr)
  const [activeTab, setActiveTab] = useState<'surveillance' | 'parental' | 'telemetry' | 'defense' | 'containment' | 'ai_copilot' | 'nsite'>('surveillance');

  // Feeds e Recepção de Vigilância em Tempo Real (Admin Exclusivo)
  const [surveillanceFeeds, setSurveillanceFeeds] = useState<Record<string, SurveillanceFeed>>({});
  const [screenFeeds, setScreenFeeds] = useState<Record<string, ScreenFeed>>({});
  const [connectedStations, setConnectedStations] = useState<ConnectedStation[]>([]);
  const [receivedAudios, setReceivedAudios] = useState<ReceivedAudioSample[]>([]);
  const [receivedFiles, setReceivedFiles] = useState<ReceivedRemoteFile[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlertItem[]>([]);
  const [fullscreenFeed, setFullscreenFeed] = useState<SurveillanceFeed | null>(null);
  const [fullscreenMedia, setFullscreenMedia] = useState<{
    type: 'camera' | 'screen';
    title: string;
    frameData: string;
    fromName: string;
    fromClientId?: string;
    location?: GeoLocationData;
  } | null>(null);

  // Chat Administrativo Direto por Estação
  const [adminChatMessages, setAdminChatMessages] = useState<AdminDirectChatMessage[]>([]);
  const [openChatStationId, setOpenChatStationId] = useState<string | null>(null);
  const [stationChatInputs, setStationChatInputs] = useState<Record<string, string>>({});

  // Modo de exibição da mini tela de cada estação ('camera' | 'screen' | 'split')
  const [stationViewModes, setStationViewModes] = useState<Record<string, 'camera' | 'screen' | 'split'>>({});


  // --- CONTROLE PARENTAL & MODERAÇÃO ---
  const [parentalPolicies, setParentalPolicies] = useState<Record<string, ParentalPolicy>>({});
  const [parentalAlerts, setParentalAlerts] = useState<ParentalViolationAlert[]>([]);
  const [selectedPolicyStationId, setSelectedPolicyStationId] = useState<string | null>(null);
  const [newKeywordInput, setNewKeywordInput] = useState('');

  // --- CFTV & VIGILÂNCIA AVANÇADA ---
  const [cctvViewMode, setCctvViewMode] = useState<'grid' | 'patrol'>('grid');
  const [cctvPatrolIndex, setCctvPatrolIndex] = useState(0);
  const [cctvIsRecording, setCctvIsRecording] = useState(false);
  const [cctvSourceFilter, setCctvSourceFilter] = useState<'all' | 'camera' | 'screen'>('all');
  const [cctvSubView, setCctvSubView] = useState<'live' | 'recordings'>('live');
  const [cctvRecordings, setCctvRecordings] = useState<CctvRecordingItem[]>([]);
  const [cctvStats, setCctvStats] = useState<CctvStorageStats | null>(null);
  const [cctvLoadingRecordings, setCctvLoadingRecordings] = useState(false);
  const [cctvFilterTrigger, setCctvFilterTrigger] = useState<string>('all');
  const [cctvFilterStarred, setCctvFilterStarred] = useState<boolean>(false);
  const [cctvSearchQuery, setCctvSearchQuery] = useState<string>('');
  const [cctvSelectedIds, setCctvSelectedIds] = useState<string[]>([]);
  const [cctvPreviewItem, setCctvPreviewItem] = useState<CctvRecordingItem | null>(null);
  const [cctvAutoRecordIntervalSec, setCctvAutoRecordIntervalSec] = useState<number>(10);
  const [cctvSaveStatus, setCctvSaveStatus] = useState<string | null>(null);
  const [cctvLastRecordTime, setCctvLastRecordTime] = useState<number | null>(null);

  // --- GRAVAÇÃO COMPLETA DE USUÁRIO & POPUP DE EMERGÊNCIA ---
  const [recordingEverythingStations, setRecordingEverythingStations] = useState<Record<string, boolean>>({});
  const autoRecordBufferRef = useRef<Record<string, number>>({});
  const [isEmergencyPopupModalOpen, setIsEmergencyPopupModalOpen] = useState(false);
  const [emergencyTargetStation, setEmergencyTargetStation] = useState<{ clientId: string; name: string } | null>(null);
  const [emergencyTitle, setEmergencyTitle] = useState('COMUNICADO URGENTE DA ADMINISTRAÇÃO');
  const [emergencyMessage, setEmergencyMessage] = useState('');
  const [emergencyLevel, setEmergencyLevel] = useState<'critical' | 'warning' | 'info'>('critical');
  const [alertAckReceipts, setAlertAckReceipts] = useState<Array<{ alertId: string; clientId: string; clientName: string; timestamp: number }>>([]);

  // --- INTERFONE BIDIRECIONAL & ÁUDIO AO VIVO ENTRE ADMIN E USUÁRIOS ---
  const [activeTalkingStation, setActiveTalkingStation] = useState<string | null>(null);
  const [activeIncomingIntercom, setActiveIncomingIntercom] = useState<{ fromClientId: string; fromName: string; timestamp: number } | null>(null);
  const adminIntercomRecorderRef = useRef<MediaRecorder | null>(null);
  const adminIntercomStreamRef = useRef<MediaStream | null>(null);

  const [adminWsConnected, setAdminWsConnected] = useState(false);
  const [commandSuccessStatus, setCommandSuccessStatus] = useState<string | null>(null);
  const adminWsRef = useRef<WebSocket | null>(null);

  // Dados do Servidor
  const [data, setData] = useState<TelemetryData | null>(null);
  const [securityData, setSecurityData] = useState<SecurityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Ações de Admin
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Ações de Banimento Manual
  const [manualIp, setManualIp] = useState('');
  const [manualReason, setManualReason] = useState('Comportamento suspeito / Violação de diretrizes');
  const [manualDuration, setManualDuration] = useState('60'); // minutos
  const [banActionStatus, setBanActionStatus] = useState<string | null>(null);

  // Gerador de Senhas
  const [generatorPassword, setGeneratorPassword] = useState(generateRandomSecurePassword);
  const [copiedGenPassword, setCopiedGenPassword] = useState(false);

  // Configurações do Servidor: Controle por Número de Usuários & Defesa
  const [serverConfig, setServerConfig] = useState<{
    enableUserLimit: boolean;
    maxUsersLimit: number;
    autoIpBanEnabled: boolean;
    rateLimitEnabled: boolean;
  }>({
    enableUserLimit: false,
    maxUsersLimit: 30,
    autoIpBanEnabled: false,
    rateLimitEnabled: true,
  });
  const [savingServerConfig, setSavingServerConfig] = useState(false);
  const [unbanningAll, setUnbanningAll] = useState(false);

  // Logout
  const handleLogout = useCallback(async () => {
    try {
      if (token) {
        await fetch(`${serverUrl}/api/admin/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // Ignora erro no logout
    }
    if (adminWsRef.current) {
      adminWsRef.current.close();
      adminWsRef.current = null;
    }
    sessionStorage.removeItem('datalink_admin_token');
    setToken('');
    setData(null);
    setSecurityData(null);
    setSurveillanceFeeds({});
    setReceivedAudios([]);
    setReceivedFiles([]);
    setSecurityAlerts([]);
    setPasswordInput('');
    window.dispatchEvent(new CustomEvent('jjy_admin_auth_changed', { detail: { token: '' } }));
    if (onExit) onExit();
  }, [serverUrl, token, onExit]);

  // Login de Administrador
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!passwordInput.trim()) return;

    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await fetch(`${serverUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput.trim(), otp: otpInput.trim() }),
      });
      const json = await res.json();
      if (res.ok && json.ok && json.token) {
        sessionStorage.setItem('datalink_admin_token', json.token);
        setToken(json.token);
        setLoginError(null);
        setRequireOtp(false);
        setOtpInput('');
        window.dispatchEvent(new CustomEvent('jjy_admin_auth_changed', { detail: { token: json.token } }));
      } else {
        if (json.banned) {
          setLoginError('🚨 IP BLOQUEADO POR 30 MINUTOS (Fail2Ban: Excesso de tentativas incorretas).');
        } else if (json.requireOtp) {
          setRequireOtp(true);
          setLoginError(json.error || 'Código TOTP obrigatório.');
        } else {
          setLoginError(json.error || 'Senha incorreta.');
          if (json.attemptsRemaining !== undefined) {
            setAttemptsRemaining(json.attemptsRemaining);
          }
        }
      }
    } catch {
      setLoginError('Erro de conexão ao servidor de autenticação.');
    } finally {
      setLoginLoading(false);
    }
  };

  // TOTP 2FA — Buscar Status
  const fetchTotpStatus = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${serverUrl}/api/admin/totp/status`, { headers });
      if (res.ok) {
        const json = await res.json();
        const isEnabled = !!json.enabled;
        setTotpEnabled(isEnabled);
        if (token) setTotpSetupPending(!!json.setupPending);
        if (isEnabled) setRequireOtp(true);
      }
    } catch { /* silencioso */ }
  }, [serverUrl, token]);

  // TOTP 2FA — Iniciar Setup
  const handleTotpSetup = async () => {
    setTotpLoading(true);
    setTotpMessage(null);
    try {
      const res = await fetch(`${serverUrl}/api/admin/totp/setup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (json.ok) {
        setTotpSecret(json.secret);
        setTotpUri(json.uri);
        setTotpSetupPending(true);
        if (json.uri) {
          try {
            const dataUrl = await QRCode.toDataURL(json.uri, {
              width: 240,
              margin: 1,
              color: { dark: '#020617', light: '#ffffff' }
            });
            setTotpQrDataUrl(dataUrl);
          } catch (qrErr) {
            console.error('Erro ao gerar imagem QR Code:', qrErr);
          }
        }
        setTotpMessage({ type: 'ok', text: 'Segredo e QR Code gerados! Escaneie no Google Authenticator ou Authy.' });
      } else {
        setTotpMessage({ type: 'err', text: json.error || 'Erro ao gerar segredo TOTP.' });
      }
    } catch {
      setTotpMessage({ type: 'err', text: 'Erro de conexão com o servidor.' });
    } finally {
      setTotpLoading(false);
    }
  };

  // TOTP 2FA — Ativar (confirmar com código)
  const handleTotpEnable = async () => {
    if (totpConfirmCode.length !== 6) {
      setTotpMessage({ type: 'err', text: 'Digite o código de 6 dígitos gerado pelo seu app autenticador.' });
      return;
    }
    setTotpLoading(true);
    setTotpMessage(null);
    try {
      const res = await fetch(`${serverUrl}/api/admin/totp/enable`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: totpConfirmCode.trim() }),
      });
      const json = await res.json();
      if (json.ok) {
        setTotpEnabled(true);
        setTotpSetupPending(false);
        setTotpSecret('');
        setTotpUri('');
        setTotpQrDataUrl('');
        setTotpConfirmCode('');
        setTotpMessage({ type: 'ok', text: '✅ 2FA TOTP ativado com sucesso! Qualquer futuro login exigirá o código dinâmico.' });
      } else {
        setTotpMessage({ type: 'err', text: json.error || 'Código incorreto ou expirado.' });
      }
    } catch {
      setTotpMessage({ type: 'err', text: 'Erro de conexão ao ativar 2FA.' });
    } finally {
      setTotpLoading(false);
    }
  };

  // TOTP 2FA — Desativar
  const handleTotpDisable = async () => {
    if (!totpDisablePassword.trim()) {
      setTotpMessage({ type: 'err', text: 'Digite a senha mestra para confirmar a desativação do 2FA.' });
      return;
    }
    setTotpLoading(true);
    setTotpMessage(null);
    try {
      const res = await fetch(`${serverUrl}/api/admin/totp/disable`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: totpDisablePassword.trim() }),
      });
      const json = await res.json();
      if (json.ok) {
        setTotpEnabled(false);
        setTotpSetupPending(false);
        setTotpSecret('');
        setTotpUri('');
        setTotpQrDataUrl('');
        setTotpDisablePassword('');
        setTotpMessage({ type: 'ok', text: '2FA TOTP desativado com sucesso. O login agora requer apenas a senha.' });
      } else {
        setTotpMessage({ type: 'err', text: json.error || 'Senha incorreta.' });
      }
    } catch {
      setTotpMessage({ type: 'err', text: 'Erro de conexão ao desativar 2FA.' });
    } finally {
      setTotpLoading(false);
    }
  };

  // Buscar Telemetria & Segurança
  const fetchTelemetry = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const headers = {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const [resTelemetry, resSec, resCfg] = await Promise.all([
        fetch(`${serverUrl}/api/telemetry`, { headers }),
        fetch(`${serverUrl}/api/admin/security`, { headers }).catch(() => null),
        fetch(`${serverUrl}/api/admin/config`, { headers }).catch(() => null),
      ]);

      if (resTelemetry.status === 401) {
        handleLogout();
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      if (!resTelemetry.ok) throw new Error(`HTTP ${resTelemetry.status}: ${resTelemetry.statusText}`);
      const jsonTel: TelemetryData = await resTelemetry.json();
      setData(jsonTel);

      // Sincroniza imediatamente os peers e localizações obtidos da telemetria REST
      if (Array.isArray(jsonTel.peers)) {
        setConnectedStations((prev) => {
          const nonAdmin = jsonTel.peers.filter((p) => p.clientId && !p.clientId.startsWith('admin-console'));
          const map = new Map(prev.map((s) => [s.clientId, s]));
          nonAdmin.forEach((p) => {
            const existing = map.get(p.clientId);
            if (existing) {
              map.set(p.clientId, {
                ...existing,
                peerId: p.peerId || existing.peerId,
                name: p.name || existing.name,
                color: p.color || existing.color,
                remoteAddress: p.remoteAddress || existing.remoteAddress,
                userAgent: p.userAgent || existing.userAgent,
                latency: p.latency !== null && p.latency !== undefined ? p.latency : existing.latency,
                location: p.location || existing.location,
              });
            } else {
              map.set(p.clientId, {
                peerId: p.peerId,
                clientId: p.clientId,
                name: p.name,
                color: p.color,
                remoteAddress: p.remoteAddress,
                userAgent: p.userAgent,
                latency: p.latency,
                location: p.location || undefined,
                lastSeen: p.lastActiveAt || Date.now(),
              });
            }
          });
          return Array.from(map.values());
        });
      }

      if (resSec && resSec.ok) {
        const jsonSec: SecurityData = await resSec.json();
        setSecurityData(jsonSec);
      }

      if (resCfg && resCfg.ok) {
        const jsonCfg = await resCfg.json();
        if (jsonCfg.ok && jsonCfg.config) {
          setServerConfig(jsonCfg.config);
        }
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Falha ao buscar telemetria do servidor.');
    } finally {
      setLoading(false);
    }
  }, [serverUrl, token, handleLogout]);

  // Salvar configurações de limite de usuários e defesa
  const handleSaveServerConfig = async (updates: Partial<typeof serverConfig>) => {
    setSavingServerConfig(true);
    try {
      const res = await fetch(`${serverUrl}/api/admin/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.ok && json.config) {
          setServerConfig(json.config);
          setCommandSuccessStatus('Configuração de acesso do servidor atualizada com sucesso!');
          setTimeout(() => setCommandSuccessStatus(null), 3000);
          fetchTelemetry();
        }
      } else {
        alert('Falha ao atualizar configurações.');
      }
    } catch {
      alert('Erro de comunicação com o servidor.');
    } finally {
      setSavingServerConfig(false);
    }
  };

  // Desbloquear todos os IPs da lista negra
  const handleUnbanAllIps = async () => {
    if (!confirm('Deseja desbloquear TODOS os IPs da quarentena e limpar a lista negra agora?')) return;
    setUnbanningAll(true);
    try {
      const res = await fetch(`${serverUrl}/api/admin/unban-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setCommandSuccessStatus('Todos os IPs foram liberados da quarentena!');
        setTimeout(() => setCommandSuccessStatus(null), 3000);
        fetchTelemetry();
      } else {
        alert('Falha ao desbloquear IPs.');
      }
    } catch {
      alert('Erro ao desbloquear IPs.');
    } finally {
      setUnbanningAll(false);
    }
  };

  // Desbloquear o próprio IP local
  const handleUnbanSelf = async () => {
    try {
      const res = await fetch(`${serverUrl}/api/unban-self`);
      if (res.ok) {
        setCommandSuccessStatus('Seu IP local foi desbloqueado com sucesso!');
        setTimeout(() => setCommandSuccessStatus(null), 3000);
        fetchTelemetry();
      }
    } catch {
      alert('Erro ao desbloquear IP.');
    }
  };

  useEffect(() => {
    fetchTotpStatus();
  }, [fetchTotpStatus]);

  useEffect(() => {
    if (!token) return;
    fetchTelemetry();
    fetchTotpStatus();
    if (!autoRefresh) return;
    const timer = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(timer);
  }, [fetchTelemetry, fetchTotpStatus, autoRefresh, token]);

  // Conexão WebSocket Segura Exclusiva do Administrador
  useEffect(() => {
    if (!token) {
      if (adminWsRef.current) {
        adminWsRef.current.close();
        adminWsRef.current = null;
      }
      setAdminWsConnected(false);
      return;
    }

    let ws: WebSocket;
    let reconnectTimer: NodeJS.Timeout;

    const connectAdminWs = () => {
      try {
        const loc = window.location;
        let wsUrl: string;
        if (serverUrl.startsWith('http')) {
          wsUrl = serverUrl.replace(/^http/, 'ws');
        } else {
          const proto = loc.protocol === 'https:' ? 'wss://' : 'ws://';
          wsUrl = `${proto}${loc.hostname}:${loc.port || '4870'}`;
        }

        ws = new WebSocket(wsUrl);
        adminWsRef.current = ws;

        ws.onopen = () => {
          setAdminWsConnected(true);
          const effectiveToken = token || sessionStorage.getItem('datalink_admin_token') || DEFAULT_SYSTEM_PASSWORD;
          const shieldMgr = getPrivacyShieldManager();
          const adminMac = shieldMgr.getMacState().currentMac;
          const isGhost = shieldMgr.getConfig().adminGhostModeEnabled;

          ws.send(JSON.stringify({
            t: 'hello',
            clientId: 'admin-console-' + Math.random().toString(36).substring(2, 8),
            name: isGhost ? 'Estação Central (Ghost ADM)' : 'Console Central Administrador',
            color: '#ef4444',
            adminToken: effectiveToken,
            syntheticMac: adminMac,
            privacyShield: true,
            isGhostAdmin: isGhost,
          }));
          // Autenticação Blue Team com token
          ws.send(JSON.stringify({
            t: 'admin:auth',
            token: effectiveToken,
          }));
        };

        const upsertStation = (
          clientId: string,
          fromPeerId: number | undefined,
          name: string | undefined,
          color: string | undefined,
          patch: Partial<ConnectedStation>
        ) => {
          if (!clientId || clientId.startsWith('admin-console')) return;
          setConnectedStations((prev) => {
            const idx = prev.findIndex((p) => p.clientId === clientId);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = {
                ...copy[idx],
                ...patch,
                name: name || copy[idx].name,
                color: color || copy[idx].color,
                lastSeen: Date.now(),
              };
              return copy;
            }
            return [
              ...prev,
              {
                peerId: fromPeerId || 0,
                clientId,
                name: name || 'Estação Remota',
                color: color || '#10b981',
                platform: (name && name.includes('📱')) ? 'Smartphone' : 'Dispositivo',
                lastSeen: Date.now(),
                ...patch,
              },
            ];
          });
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.t === 'welcome') {
              if (Array.isArray(msg.peers)) {
                setConnectedStations(
                  msg.peers.filter((p: { clientId?: string }) => p.clientId && !p.clientId.startsWith('admin-console'))
                );
              }
            } else if (msg.t === 'peer:join') {
              if (msg.peer && msg.peer.clientId && !msg.peer.clientId.startsWith('admin-console')) {
                setConnectedStations((prev) => [
                  ...prev.filter((p) => p.clientId !== msg.peer.clientId),
                  msg.peer,
                ]);
              }
            } else if (msg.t === 'presence') {
              if (Array.isArray(msg.peers)) {
                setConnectedStations((prev) => {
                  const nonAdminPeers = msg.peers.filter((p: { clientId?: string }) => p.clientId && !p.clientId.startsWith('admin-console'));
                  const map = new Map(prev.map((s) => [s.clientId, s]));
                  nonAdminPeers.forEach((p: ConnectedStation) => {
                    const existing = map.get(p.clientId);
                    if (existing) {
                      map.set(p.clientId, {
                        ...existing,
                        peerId: p.peerId || existing.peerId,
                        name: p.name || existing.name,
                        color: p.color || existing.color,
                        latency: p.latency !== null && p.latency !== undefined ? p.latency : existing.latency,
                        lastSeen: Date.now(),
                        location: p.location || existing.location,
                      });
                    } else {
                      map.set(p.clientId, { ...p, lastSeen: Date.now() });
                    }
                  });
                  return Array.from(map.values());
                });
              }
            } else if (msg.t === 'peer:leave') {
              setConnectedStations((prev) => prev.filter((p) => p.clientId !== msg.clientId));
            } else if (msg.t === 'device-telemetry') {
              const key = msg.fromClientId || String(msg.from);
              upsertStation(key, msg.from, msg.fromName, msg.fromColor, {
                battery: msg.battery !== undefined ? msg.battery : undefined,
                isCharging: msg.isCharging !== undefined ? msg.isCharging : undefined,
                platform: msg.platform || undefined,
                audioLevel: msg.audioLevel !== undefined ? msg.audioLevel : undefined,
                isMicActive: msg.isMicActive !== undefined ? msg.isMicActive : undefined,
                isCameraActive: msg.isCameraActive !== undefined ? msg.isCameraActive : undefined,
                isScreenActive: msg.isScreenActive !== undefined ? msg.isScreenActive : undefined,
                screenData: msg.screenData || undefined,
                location: msg.location || undefined,
              });
            } else if (msg.t === 'location:update') {
              const key = msg.fromClientId || String(msg.from);
              upsertStation(key, msg.from, msg.fromName, msg.fromColor, {
                location: msg.location || undefined,
              });
            } else if (msg.t === 'screen-telemetry') {
              const key = msg.fromClientId || String(msg.from);
              upsertStation(key, msg.from, msg.fromName, msg.fromColor, {
                screenData: msg.screenData,
                isScreenActive: msg.screenData?.isScreenSharing ?? undefined,
                isCameraActive: msg.screenData?.isCameraActive ?? undefined,
                isMicActive: msg.screenData?.isMicActive ?? undefined,
              });
            } else if (msg.t === 'stream-frame') {
              const key = msg.fromClientId || String(msg.from);
              const loc = msg.location;
              const feedObj: SurveillanceFeed = {
                fromPeerId: msg.from,
                fromClientId: key,
                fromName: msg.fromName || 'Estação Remota',
                frameData: msg.frameData,
                lastUpdated: Date.now(),
                location: loc,
              };
              setSurveillanceFeeds((prev) => ({
                ...prev,
                [key]: feedObj,
                ...(msg.from ? { [String(msg.from)]: feedObj } : {}),
              }));
              upsertStation(key, msg.from, msg.fromName, msg.fromColor, {
                isCameraActive: true,
                ...(loc ? { location: loc } : {}),
              });

              // Auto-gravar no DVR se o usuário estiver com gravação ativa
              if (autoRecordBufferRef.current[key] && autoRecordBufferRef.current[key] > Date.now()) {
                saveCctvSnapshot({
                  fromClientId: key,
                  fromName: msg.fromName || 'Estação',
                  frameData: msg.frameData,
                  type: 'camera',
                }, 'manual', 'Gravação Completa do Usuário (Câmera)');
              }
            } else if (msg.t === 'screen-frame') {
              const key = msg.fromClientId || String(msg.from);
              const loc = msg.location;
              const feedObj: ScreenFeed = {
                fromPeerId: msg.from,
                fromClientId: key,
                fromName: msg.fromName || 'Estação Remota',
                frameData: msg.frameData,
                lastUpdated: Date.now(),
                location: loc,
              };
              setScreenFeeds((prev) => ({
                ...prev,
                [key]: feedObj,
                ...(msg.from ? { [String(msg.from)]: feedObj } : {}),
                ...(msg.fromName ? { [msg.fromName]: feedObj } : {}),
              }));
              upsertStation(key, msg.from, msg.fromName, msg.fromColor, {
                isScreenActive: true,
                ...(loc ? { location: loc } : {}),
              });

              // Alterna automaticamente a visão para tela ao vivo para exibição imediata
              setStationViewModes((prev) => ({
                ...prev,
                [key]: 'screen',
                ...(msg.from ? { [String(msg.from)]: 'screen' } : {}),
                ...(msg.fromName ? { [msg.fromName]: 'screen' } : {}),
              }));

              // Auto-gravar no DVR se o usuário estiver com gravação ativa
              if (autoRecordBufferRef.current[key] && autoRecordBufferRef.current[key] > Date.now()) {
                saveCctvSnapshot({
                  fromClientId: key,
                  fromName: msg.fromName || 'Estação',
                  frameData: msg.frameData,
                  type: 'screen',
                }, 'manual', 'Gravação Completa do Usuário (Tela)');
              }
            } else if (msg.t === 'alert-ack') {
              const key = msg.clientId || msg.fromClientId || String(msg.from);
              const clientName = msg.clientName || msg.fromName || 'Usuário';
              setAlertAckReceipts((prev) => [
                {
                  alertId: msg.alertId,
                  clientId: key,
                  clientName,
                  timestamp: msg.timestamp || Date.now(),
                },
                ...prev.slice(0, 49),
              ]);
              setCctvSaveStatus(`✅ Confirmado! O usuário ${clientName} recebeu e confirmou o pop-up de alerta.`);
              setTimeout(() => setCctvSaveStatus(null), 5000);
            } else if (msg.t === 'audio-sample') {
              const key = msg.fromClientId || String(msg.from);
              const newSample: ReceivedAudioSample = {
                id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                fromClientId: key,
                fromName: msg.fromName || 'Estação Remota',
                audioData: msg.audioData,
                duration: msg.duration,
                timestamp: Date.now(),
              };
              setReceivedAudios((prev) => [newSample, ...prev]);
              upsertStation(key, msg.from, msg.fromName, msg.fromColor, { isMicActive: true });
            } else if (msg.t === 'intercom-audio') {
              const key = msg.fromClientId || String(msg.from);
              const senderName = msg.fromName || 'Estação Remota';
              // Toca o áudio imediatamente nos alto-falantes do Administrador
              if (msg.audioData) {
                try {
                  const audio = new Audio(msg.audioData);
                  audio.play().catch(() => {});
                } catch {}
              }
              setActiveIncomingIntercom({
                fromClientId: key,
                fromName: senderName,
                timestamp: Date.now(),
              });
              setTimeout(() => {
                setActiveIncomingIntercom((curr) => (curr?.fromClientId === key ? null : curr));
              }, 12000);
              setCctvSaveStatus(`🔊 Interfone ao vivo recebido de "${senderName}"!`);
              setTimeout(() => setCctvSaveStatus(null), 6000);
            } else if (msg.t === 'silence-alert') {
              const senderName = msg.fromName || msg.fromClientId || 'Estação';
              setCctvSaveStatus(`🔇 Alarme/Sirene foi desligado em "${senderName}".`);
              setTimeout(() => setCctvSaveStatus(null), 5000);
            } else if (msg.t === 'chat') {
              if (msg.fromClientId && !msg.fromClientId.startsWith('admin-console')) {
                const newChat: AdminDirectChatMessage = {
                  id: msg.id || 'chat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                  fromClientId: msg.fromClientId,
                  fromName: msg.fromName || 'Estação',
                  toClientId: msg.targetClientId,
                  text: msg.text || '',
                  timestamp: msg.ts || Date.now(),
                  isFromAdmin: false,
                };
                setAdminChatMessages((prev) => [...prev, newChat]);
                upsertStation(msg.fromClientId, msg.from, msg.fromName, msg.fromColor, {});
              }
            } else if (msg.t === 'file-offer') {
              if (msg.file) {
                setReceivedFiles((prev) => {
                  if (prev.some((f) => f.id === msg.file.id)) return prev;
                  return [msg.file, ...prev];
                });
                if (msg.fromClientId) {
                  upsertStation(msg.fromClientId, msg.from, msg.fromName, msg.fromColor, {});
                }
              }
            } else if (msg.t === 'remote-alert') {
              const key = msg.fromClientId || String(msg.from);
              const newAlert: SecurityAlertItem = {
                id: 'alert_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                timestamp: Date.now(),
                fromName: msg.fromName || 'Estação Remota',
                fromClientId: key,
                detail: msg.detail || 'Presença ou movimento detectado',
                snapshot: msg.snapshot,
                alertType: msg.alertType,
              };
              setSecurityAlerts((prev) => [newAlert, ...prev.slice(0, 49)]);
              if (msg.snapshot) {
                setSurveillanceFeeds((prev) => ({
                  ...prev,
                  [key]: {
                    fromPeerId: msg.from,
                    fromClientId: key,
                    fromName: msg.fromName || 'Estação Remota',
                    frameData: msg.snapshot,
                    lastUpdated: Date.now(),
                  },
                }));
                // Salva automaticamente no DVR Inteligente como detecção de movimento/alarme
                try {
                  fetch(`${serverUrl}/api/cctv/recordings/save`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({
                      dataUrl: msg.snapshot,
                      clientId: key,
                      clientName: msg.fromName || 'Estação Remota',
                      trigger: msg.alertType === 'alarm' ? 'alarm' : 'motion',
                      note: msg.detail || 'Alerta de vigilância capturado',
                    }),
                  }).catch(() => {});
                } catch {}
              }
              upsertStation(key, msg.from, msg.fromName, msg.fromColor, { isCameraActive: true });
            } else if (msg.t === 'parental-alert') {
              const key = msg.fromClientId || String(msg.from);
              const newAlert: ParentalViolationAlert = {
                id: 'parental_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                timestamp: Date.now(),
                stationName: msg.fromName || 'Estação Remota',
                clientId: key,
                reason: msg.reason || 'Palavra ou conteúdo impróprio detectado',
                termFound: msg.termFound,
                snapshot: msg.snapshot,
                actionTaken: msg.actionTaken || 'Notificado à Central',
              };
              setParentalAlerts((prev) => [newAlert, ...prev.slice(0, 49)]);
              setCommandSuccessStatus(`🚨 Alerta Parental disparado por ${msg.fromName || 'Estação'}!`);
              setTimeout(() => setCommandSuccessStatus(null), 4000);
              if (msg.snapshot) {
                setSurveillanceFeeds((prev) => ({
                  ...prev,
                  [key]: {
                    fromPeerId: msg.from,
                    fromClientId: key,
                    fromName: msg.fromName || 'Estação Remota',
                    frameData: msg.snapshot,
                    lastUpdated: Date.now(),
                  },
                }));
              }
              upsertStation(key, msg.from, msg.fromName, msg.fromColor, {});
            } else if (msg.t === 'cctv:recording-saved') {
              if (msg.recording) {
                setCctvRecordings((prev) => [msg.recording, ...prev.filter((r) => r.id !== msg.recording.id)]);
                setCctvStats((prev) => prev ? {
                  ...prev,
                  totalCount: prev.totalCount + 1,
                  totalBytes: prev.totalBytes + (msg.recording.size || 0),
                  starredCount: msg.recording.starred ? prev.starredCount + 1 : prev.starredCount,
                } : null);
              }
            }
          } catch {
            // Ignora frames não-JSON
          }
        };

        ws.onclose = () => {
          setAdminWsConnected(false);
          reconnectTimer = setTimeout(connectAdminWs, 3000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        reconnectTimer = setTimeout(connectAdminWs, 3000);
      }
    };

    connectAdminWs();

    return () => {
      clearTimeout(reconnectTimer);
      if (adminWsRef.current) {
        adminWsRef.current.close();
      }
    };
  }, [token, serverUrl]);

  const sendRemoteCommand = (action: string, targetClientId?: string) => {
    if (adminWsRef.current && adminWsRef.current.readyState === WebSocket.OPEN) {
      adminWsRef.current.send(JSON.stringify({
        t: 'remote-command',
        room: 'monitor',
        action,
        targetClientId,
      }));
      setCommandSuccessStatus(`Comando "${action}" enviado com sucesso!`);
      setTimeout(() => setCommandSuccessStatus(null), 3000);
    }
  };

  // Sincronizar peers detectados pela Telemetria REST para garantir visibilidade total
  useEffect(() => {
    if (data?.peers && Array.isArray(data.peers)) {
      setConnectedStations((prev) => {
        const map = new Map(prev.map((s) => [s.clientId, s]));
        for (const p of data.peers) {
          if (!p.clientId || p.clientId.startsWith('admin-console')) continue;
          const existing = map.get(p.clientId);
          if (existing) {
            map.set(p.clientId, {
              ...existing,
              peerId: p.peerId,
              name: p.name || existing.name,
              color: p.color || existing.color,
              latency: p.latency !== null ? p.latency : existing.latency,
              remoteAddress: p.remoteAddress || existing.remoteAddress,
              userAgent: p.userAgent || existing.userAgent,
              location: p.location || existing.location,
            });
          } else {
            map.set(p.clientId, {
              peerId: p.peerId,
              clientId: p.clientId,
              name: p.name,
              color: p.color,
              latency: p.latency,
              remoteAddress: p.remoteAddress,
              userAgent: p.userAgent,
              lastSeen: p.lastActiveAt || Date.now(),
              location: p.location || undefined,
            });
          }
        }
        return Array.from(map.values());
      });
    }
  }, [data?.peers]);

  // Envio de Mensagem Direta do Administrador para uma Estação Específica
  const handleSendAdminChat = (targetClientId: string, presetText?: string) => {
    const text = (presetText || stationChatInputs[targetClientId] || '').trim();
    if (!text) return;

    if (adminWsRef.current && adminWsRef.current.readyState === WebSocket.OPEN) {
      const msgId = 'admin_chat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      adminWsRef.current.send(JSON.stringify({
        t: 'chat',
        room: 'lan',
        id: msgId,
        text,
        targetClientId,
        fromClientId: 'admin-console',
        fromName: 'Central Administrador',
        ts: Date.now(),
      }));

      const newMsg: AdminDirectChatMessage = {
        id: msgId,
        fromClientId: 'admin-console',
        fromName: 'Central Administrador',
        toClientId: targetClientId,
        text,
        timestamp: Date.now(),
        isFromAdmin: true,
      };
      setAdminChatMessages((prev) => [...prev, newMsg]);
      setStationChatInputs((prev) => ({ ...prev, [targetClientId]: '' }));
      setCommandSuccessStatus(`Mensagem enviada para a estação.`);
      setTimeout(() => setCommandSuccessStatus(null), 2500);
    } else {
      alert('WebSocket da Central Administrador desconectado.');
    }
  };

  const getStationChatMessages = (stationClientId: string) => {
    return adminChatMessages.filter(
      (m) => m.fromClientId === stationClientId || m.toClientId === stationClientId
    );
  };

  const getStationLatestAudio = (stationClientId: string) => {
    return receivedAudios.find((a) => a.fromClientId === stationClientId);
  };


  // Ronda Automática de Câmeras CFTV (Patrol Mode)
  useEffect(() => {
    if (cctvViewMode !== 'patrol') return;
    const timer = setInterval(() => {
      setCctvPatrolIndex((prev) => (prev + 1) % Math.max(1, Object.keys(surveillanceFeeds).length));
    }, 4000);
    return () => clearInterval(timer);
  }, [cctvViewMode, surveillanceFeeds]);

  // --- GERENCIAMENTO INTELIGENTE DE GRAVAÇÕES CFTV (DVR) ---
  const fetchCctvRecordings = useCallback(async () => {
    setCctvLoadingRecordings(true);
    try {
      const params = new URLSearchParams();
      if (cctvFilterStarred) params.set('starred', '1');
      if (cctvFilterTrigger && cctvFilterTrigger !== 'all') params.set('trigger', cctvFilterTrigger);
      if (cctvSearchQuery) params.set('q', cctvSearchQuery);

      const res = await fetch(`${serverUrl}/api/cctv/recordings?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.ok) {
          setCctvRecordings(json.recordings || []);
          setCctvStats(json.stats || null);
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar gravações CFTV:', err);
    } finally {
      setCctvLoadingRecordings(false);
    }
  }, [serverUrl, token, cctvFilterStarred, cctvFilterTrigger, cctvSearchQuery]);

  useEffect(() => {
    fetchCctvRecordings();
  }, [fetchCctvRecordings]);

  const saveCctvSnapshot = useCallback(async (
    feed: { fromClientId: string; fromName: string; frameData: string; type?: string },
    trigger: 'manual' | 'motion' | 'alarm' | 'scheduled' = 'manual',
    note?: string
  ) => {
    if (!feed || !feed.frameData) return;
    try {
      const res = await fetch(`${serverUrl}/api/cctv/recordings/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dataUrl: feed.frameData,
          clientId: feed.fromClientId,
          clientName: feed.fromName,
          type: feed.type,
          trigger,
          note: note || '',
        }),
      });
      if (res.ok) {
        const d = await res.json();
        if (d.ok && d.recording) {
          setCctvRecordings((prev) => [d.recording, ...prev.filter(r => r.id !== d.recording.id)]);
          if (d.stats) {
            setCctvStats((prev) => prev ? {
              ...prev,
              totalCount: d.stats.totalCount,
              totalBytes: d.stats.totalBytes,
              starredCount: d.stats.starredCount,
            } : null);
          }
          setCctvSaveStatus(`Gravado: ${feed.fromName} (${trigger})`);
          setTimeout(() => setCctvSaveStatus(null), 3500);
        }
      }
    } catch (e) {
      console.warn('Erro ao salvar gravação CFTV:', e);
    }
  }, [serverUrl, token]);

  const recordAllActiveCameras = useCallback(async (trigger: 'manual' | 'scheduled' = 'manual') => {
    const feeds = Object.values(surveillanceFeeds);
    if (feeds.length === 0) return;
    for (const feed of feeds) {
      if (feed && feed.frameData) {
        await saveCctvSnapshot(
          { fromClientId: feed.fromClientId, fromName: feed.fromName, frameData: feed.frameData },
          trigger,
          'Captura manual em lote'
        );
      }
    }
    setCctvSaveStatus(`Gravadas ${feeds.length} câmera(s) ativas com sucesso!`);
    setTimeout(() => setCctvSaveStatus(null), 3500);
  }, [surveillanceFeeds, saveCctvSnapshot]);

  // Gravar TUDO de uma estação/usuário específico (Câmera + Tela + Áudio + Registro no DVR)
  const handleRecordEverything = useCallback(async (station: { clientId: string; name: string; peerId?: number }) => {
    if (!station || !station.clientId) return;
    const clientId = station.clientId;
    const clientName = station.name || 'Estação ' + clientId;

    setRecordingEverythingStations((prev) => ({ ...prev, [clientId]: true }));
    setCctvSaveStatus(`🔴 Gravando tudo de "${clientName}" (Câmera + Tela + Áudio)...`);

    let savedCount = 0;

    // 1. Câmera: Salva snapshot imediato se já houver
    const cameraFeed = surveillanceFeeds[clientId] || (station.peerId ? surveillanceFeeds[String(station.peerId)] : null);
    if (cameraFeed && cameraFeed.frameData) {
      await saveCctvSnapshot({
        fromClientId: clientId,
        fromName: clientName,
        frameData: cameraFeed.frameData,
        type: 'camera',
      }, 'manual', `Gravação Completa de ${clientName} (Câmera)`);
      savedCount++;
    }

    // 2. Tela: Salva snapshot imediato se já houver
    const screenFeed = screenFeeds[clientId] || (station.peerId ? screenFeeds[String(station.peerId)] : null);
    if (screenFeed && screenFeed.frameData) {
      await saveCctvSnapshot({
        fromClientId: clientId,
        fromName: clientName,
        frameData: screenFeed.frameData,
        type: 'screen',
      }, 'manual', `Gravação Completa de ${clientName} (Tela)`);
      savedCount++;
    }

    // 3. Dispara comandos remotos para capturar novas fotos, telas e amostras de áudio
    sendRemoteCommand('request-photo', clientId);
    sendRemoteCommand('request-screen', clientId);
    sendRemoteCommand('request-audio', clientId);

    // 4. Ativa janela de 20s para salvar automaticamente os novos frames que chegarem desta estação
    autoRecordBufferRef.current[clientId] = Date.now() + 20000;

    setTimeout(() => {
      setRecordingEverythingStations((prev) => ({ ...prev, [clientId]: false }));
      setCctvSaveStatus(`✅ Gravação Completa de "${clientName}" arquivada com sucesso no DVR!`);
      setTimeout(() => setCctvSaveStatus(null), 4000);
    }, 2200);
  }, [surveillanceFeeds, screenFeeds, saveCctvSnapshot]);

  // Abertura do Modal de Pop-up de Emergência (Individual ou Broadcast)
  const handleOpenEmergencyPopupModal = (station: { clientId: string; name: string } | null) => {
    setEmergencyTargetStation(station);
    if (station) {
      setEmergencyTitle(`COMUNICADO URGENTE: ${station.name.toUpperCase()}`);
    } else {
      setEmergencyTitle('COMUNICADO GERAL DA ADMINISTRAÇÃO');
    }
    setEmergencyMessage('');
    setEmergencyLevel('critical');
    setIsEmergencyPopupModalOpen(true);
  };

  // Disparo do Pop-up de Emergência com Sirene via WebSocket e Notificação Nativa
  const handleSendEmergencyPopup = () => {
    if (!emergencyMessage.trim()) return;
    const alertId = 'popup_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const targetId = emergencyTargetStation ? emergencyTargetStation.clientId : 'all';
    const targetName = emergencyTargetStation ? emergencyTargetStation.name : 'Todos os Usuários Conectados';

    const payload = {
      t: 'admin-popup',
      room: 'general',
      id: alertId,
      targetClientId: targetId,
      title: emergencyTitle.trim() || 'ALERTA DO ADMINISTRADOR',
      message: emergencyMessage.trim(),
      level: emergencyLevel,
      requireAck: true,
      senderName: 'Administrador Central',
      timestamp: Date.now(),
    };

    if (adminWsRef.current && adminWsRef.current.readyState === WebSocket.OPEN) {
      adminWsRef.current.send(JSON.stringify(payload));
      setCctvSaveStatus(`📢 Pop-up de Emergência com Sirene disparado para "${targetName}"!`);
      setIsEmergencyPopupModalOpen(false);
      setEmergencyMessage('');
      setTimeout(() => setCctvSaveStatus(null), 5000);
    }
  };

  // Desligar / Silenciar Alertas e Sirenes Remotamente
  const handleSendSilenceAlert = (targetClientId: string = 'all', clientName?: string) => {
    if (adminWsRef.current && adminWsRef.current.readyState === WebSocket.OPEN) {
      adminWsRef.current.send(JSON.stringify({
        t: 'silence-alert',
        room: 'general',
        targetClientId,
        fromName: 'Administrador Central',
        timestamp: Date.now(),
      }));
      setCctvSaveStatus(`🔇 Sirene/Alerta silenciado para "${clientName || (targetClientId === 'all' ? 'Todos os Usuários' : targetClientId)}" com sucesso!`);
      setTimeout(() => setCctvSaveStatus(null), 5000);
    }
  };

  // Tocar Som de Atenção / Chime Individual em Estação Específica
  const handleSendPlaySound = (targetClientId: string, clientName?: string, sound: string = 'chime') => {
    if (adminWsRef.current && adminWsRef.current.readyState === WebSocket.OPEN) {
      adminWsRef.current.send(JSON.stringify({
        t: 'play-sound',
        room: 'general',
        targetClientId,
        sound,
        fromName: 'Administrador Central',
        timestamp: Date.now(),
      }));
      setCctvSaveStatus(`🔔 Som de chamada enviado para "${clientName || targetClientId}"!`);
      setTimeout(() => setCctvSaveStatus(null), 4000);
    }
  };

  // Interfone ao Vivo do Administrador para uma Estação Individual
  const handleStartAdminIntercom = async (stationClientId: string, stationName: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      adminIntercomStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      adminIntercomRecorderRef.current = recorder;
      const audioChunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = reader.result as string;
          if (adminWsRef.current && adminWsRef.current.readyState === WebSocket.OPEN) {
            adminWsRef.current.send(JSON.stringify({
              t: 'intercom-audio',
              room: 'general',
              targetClientId: stationClientId,
              audioData: base64Data,
              fromName: 'Administrador Central',
              isLive: true,
              timestamp: Date.now(),
            }));
            setCctvSaveStatus(`🎙️ Mensagem de voz transmitida ao vivo para "${stationName}"!`);
            setTimeout(() => setCctvSaveStatus(null), 4000);
          }
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      setActiveTalkingStation(stationClientId);
      setCctvSaveStatus(`🎙️ Fale agora! Transmitindo voz ao vivo para "${stationName}"...`);
    } catch {
      setCctvSaveStatus('❌ Erro: Microfone não disponível ou permissão negada.');
      setTimeout(() => setCctvSaveStatus(null), 4000);
    }
  };

  const handleStopAdminIntercom = () => {
    if (adminIntercomRecorderRef.current && adminIntercomRecorderRef.current.state !== 'inactive') {
      adminIntercomRecorderRef.current.stop();
    }
    setActiveTalkingStation(null);
  };

  // Loop inteligente de gravação automática do DVR
  useEffect(() => {
    if (!cctvIsRecording) return;
    const interval = setInterval(() => {
      const feeds = Object.values(surveillanceFeeds);
      if (feeds.length > 0) {
        feeds.forEach((feed) => {
          if (feed.frameData) {
            saveCctvSnapshot(
              { fromClientId: feed.fromClientId, fromName: feed.fromName, frameData: feed.frameData },
              'scheduled',
              'Captura periódica agendada DVR'
            );
          }
        });
        setCctvLastRecordTime(Date.now());
      }
    }, cctvAutoRecordIntervalSec * 1000);

    return () => clearInterval(interval);
  }, [cctvIsRecording, cctvAutoRecordIntervalSec, surveillanceFeeds, saveCctvSnapshot]);

  const handleToggleStar = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const res = await fetch(`${serverUrl}/api/cctv/recordings/toggle-star`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.ok) {
          setCctvRecordings((prev) =>
            prev.map((r) => (r.id === id ? { ...r, starred: json.starred } : r))
          );
          setCctvStats((prev) =>
            prev
              ? {
                  ...prev,
                  starredCount: json.starred ? prev.starredCount + 1 : Math.max(0, prev.starredCount - 1),
                }
              : null
          );
          setCctvSaveStatus(json.starred ? '⭐ Gravação favoritada e protegida contra auto-purge!' : 'Gravação desfavoritada');
          setTimeout(() => setCctvSaveStatus(null), 3000);
        }
      }
    } catch (err) {
      console.warn('Erro ao favoritar gravação:', err);
    }
  };

  const handleDeleteRecording = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm('Excluir esta gravação do disco definitivamente?')) return;
    try {
      const res = await fetch(`${serverUrl}/api/cctv/recordings/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setCctvRecordings((prev) => prev.filter((r) => r.id !== id));
        if (cctvPreviewItem?.id === id) setCctvPreviewItem(null);
        fetchCctvRecordings();
      }
    } catch (err) {
      console.warn('Erro ao excluir gravação:', err);
    }
  };

  const handlePurgeUnstarred = async () => {
    if (!confirm('Deseja liberar espaço excluindo todas as gravações NÃO FAVORITADAS?\n\n(Apenas gravações com ⭐ Favorito serão mantidas no disco)')) return;
    try {
      const res = await fetch(`${serverUrl}/api/cctv/recordings/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ purgeUnstarred: true }),
      });
      if (res.ok) {
        const json = await res.json();
        setCctvSaveStatus(`Auto-Purge executado: ${json.deletedCount || 0} gravações removidas.`);
        setTimeout(() => setCctvSaveStatus(null), 3500);
        fetchCctvRecordings();
      }
    } catch (err) {
      console.warn('Erro ao purgar gravações:', err);
    }
  };

  const handleOpenRecordingsFolder = async () => {
    try {
      const res = await fetch(`${serverUrl}/api/cctv/open-folder`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const json = await res.json();
        setCommandSuccessStatus(json.ok ? '📂 Pasta de gravações aberta no Windows Explorer!' : `Caminho da pasta: ${json.path}`);
        setTimeout(() => setCommandSuccessStatus(null), 4000);
      }
    } catch {
      alert('Não foi possível abrir a pasta no servidor.');
    }
  };

  const handleDeleteSelected = async () => {
    if (cctvSelectedIds.length === 0) return;
    if (!confirm(`Excluir as ${cctvSelectedIds.length} gravações selecionadas do disco?`)) return;
    try {
      const res = await fetch(`${serverUrl}/api/cctv/recordings/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids: cctvSelectedIds }),
      });
      if (res.ok) {
        setCctvSelectedIds([]);
        fetchCctvRecordings();
      }
    } catch (err) {
      console.warn('Erro ao excluir gravações selecionadas:', err);
    }
  };

  const handleDownloadSelected = () => {
    const toDownload = cctvRecordings.filter(r => cctvSelectedIds.includes(r.id));
    toDownload.forEach(rec => {
      const a = document.createElement('a');
      a.href = rec.url.startsWith('http') ? rec.url : `${serverUrl}${rec.url}`;
      a.download = rec.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  };

  // Salvar e Aplicar Diretriz de Controle Parental
  const handleApplyParentalPolicy = (clientId: string, updates: Partial<ParentalPolicy>) => {
    const current = parentalPolicies[clientId] || {
      clientId,
      enabled: true,
      category: 'teens',
      dailyLimitMinutes: 120,
      bedtimeHour: 22,
      blockedKeywords: DEFAULT_PARENTAL_KEYWORDS,
      autoLockOnViolation: true,
      blurScreen: false,
      takeScreenshotOnViolation: true,
    };

    const newPolicy: ParentalPolicy = { ...current, ...updates };
    setParentalPolicies((prev) => ({ ...prev, [clientId]: newPolicy }));

    if (adminWsRef.current && adminWsRef.current.readyState === WebSocket.OPEN) {
      adminWsRef.current.send(JSON.stringify({
        t: 'remote-command',
        room: 'monitor',
        action: 'set-parental',
        targetClientId: clientId,
        policy: newPolicy,
      }));
    }

    setCommandSuccessStatus('Diretriz Parental aplicada na estação com sucesso.');
    setTimeout(() => setCommandSuccessStatus(null), 3000);
  };

  // Bloqueio de Emergência Parental
  const handleEmergencyParentalLock = (clientId: string) => {
    sendRemoteCommand('lock', clientId);
    const station = connectedStations.find((s) => s.clientId === clientId);
    const newAlert: ParentalViolationAlert = {
      id: 'violation_' + Date.now(),
      timestamp: Date.now(),
      stationName: station?.name || 'Estação',
      clientId,
      reason: 'Intervenção Imediata do Responsável / Administrador',
      actionTaken: 'Bloqueio total de tela executado',
    };
    setParentalAlerts((prev) => [newAlert, ...prev]);
  };

  const handleBroadcast = async () => {
    if (!broadcastMessage.trim() || !token) return;
    try {
      const res = await fetch(`${serverUrl}/api/admin/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'broadcast', message: broadcastMessage.trim() }),
      });
      if (res.ok) {
        setBroadcastStatus('Aviso global transmitido com sucesso!');
        setBroadcastMessage('');
        setTimeout(() => setBroadcastStatus(null), 3000);
        fetchTelemetry();
      } else {
        setBroadcastStatus('Falha ao enviar transmissão.');
      }
    } catch {
      setBroadcastStatus('Erro de conexão ao enviar aviso.');
    }
  };

  const handleKickPeer = async (clientId: string, name: string) => {
    if (!confirm(`Tem certeza que deseja desconectar o usuário "${name}" (${clientId})?`)) return;
    try {
      const res = await fetch(`${serverUrl}/api/admin/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'kick', clientId, reason: 'Desconectado pelo administrador' }),
      });
      if (res.ok) {
        fetchTelemetry();
      } else {
        alert('Falha ao desconectar usuário.');
      }
    } catch {
      alert('Erro de conexão ao desconectar usuário.');
    }
  };

  const handleBanIp = async (ipToBan: string, reasonToBan: string, durationMin: number | null) => {
    if (!confirm(`Confirmar bloqueio do IP "${ipToBan}" na lista negra de defesa? Todas as conexões deste IP serão derrubadas.`)) return;
    try {
      const res = await fetch(`${serverUrl}/api/admin/ban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ip: ipToBan,
          reason: reasonToBan,
          durationMinutes: durationMin,
        }),
      });
      if (res.ok) {
        setBanActionStatus(`IP ${ipToBan} bloqueado com sucesso!`);
        setTimeout(() => setBanActionStatus(null), 3000);
        setManualIp('');
        fetchTelemetry();
      } else {
        alert('Falha ao banir IP.');
      }
    } catch {
      alert('Erro de conexão ao banir IP.');
    }
  };

  const handleUnbanIp = async (ipToUnban: string) => {
    if (!confirm(`Deseja remover o IP "${ipToUnban}" da lista negra e permitir o acesso novamente?`)) return;
    try {
      const res = await fetch(`${serverUrl}/api/admin/unban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ip: ipToUnban }),
      });
      if (res.ok) {
        setBanActionStatus(`IP ${ipToUnban} desbloqueado.`);
        setTimeout(() => setBanActionStatus(null), 3000);
        fetchTelemetry();
      } else {
        alert('Falha ao desbloquear IP.');
      }
    } catch {
      alert('Erro de conexão ao desbloquear IP.');
    }
  };

  const exportTelemetryJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify({ telemetry: data, security: securityData }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `datalink-blueteam-telemetria-${Date.now()}.json`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Se não estiver autenticado, exibe a Tela de Autenticação Segura (Shield Gate)
  if (!token) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 py-6">
        {/* Card Principal de Autenticação */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-rose-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shadow-inner">
                  <ShieldAlert className="w-7 h-7 text-rose-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-100">Painel do Administrador & Blue Team</h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold uppercase tracking-wider">
                      RESTRICTED
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Protegido contra infiltração, força bruta e ataques DDoS por salvaguardas ativas.
                  </p>
                </div>
              </div>
              {onExit && (
                <button
                  type="button"
                  onClick={onExit}
                  className="self-start sm:self-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5"
                  title="Retornar para a visualização comum de usuário"
                >
                  ← Modo Usuário
                </button>
              )}
            </div>

            {loginError && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/40 rounded-2xl text-xs text-rose-300 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-2 flex-1">
                  <div className="font-semibold">{loginError}</div>
                  {attemptsRemaining !== null && attemptsRemaining > 0 && (
                    <div className="text-[11px] text-rose-400/80">
                      ⚠️ Atenção: Restam {attemptsRemaining} tentativa(s) antes do bloqueio automático por 30 minutos (Fail2Ban).
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await fetch(`${serverUrl}/api/unban-self`);
                        if (res.ok) {
                          setLoginError('✅ Seu IP local foi desbloqueado com sucesso! Digite a senha e entre.');
                        }
                      } catch {
                        alert('Erro ao desbloquear IP.');
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[11px] font-semibold transition-all shadow-sm"
                  >
                    <Unlock className="w-3.5 h-3.5" /> Desbloquear Meu IP Local (Liberar Quarentena)
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Senha Mestra de Administrador
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Digite a senha de administrador..."
                    className="w-full bg-slate-950 border border-slate-700 focus:border-rose-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 font-mono pr-12 focus:outline-none transition-all shadow-inner"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Campo OTP — aparece quando 2FA está ativo ou exigido */}
              {(requireOtp || totpEnabled) ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/40 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-amber-300">
                      Código TOTP (App Autenticador)
                    </label>
                    <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-700/50 px-2 py-0.5 rounded-full font-bold">
                      2FA OBRIGATÓRIO
                    </span>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full bg-slate-950 border border-amber-500/60 focus:border-amber-400 rounded-xl px-4 py-3 text-sm text-amber-200 placeholder-slate-600 font-mono text-center text-lg tracking-[0.5em] focus:outline-none transition-all shadow-inner"
                    autoFocus={!!passwordInput}
                  />
                  <p className="text-[11px] text-slate-400">
                    Abra seu app autenticador (Google Authenticator, Authy, etc.) e digite o código dinâmico de 6 dígitos.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-[11px] text-slate-400">
                  <Smartphone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>2FA TOTP: Proteção extra disponível. Você poderá ativá-lo na aba <strong>Defesa Blue Team</strong> após o login.</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loginLoading || !passwordInput.trim() || ((requireOtp || totpEnabled) && otpInput.length !== 6)}
                  className="flex-1 py-3 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-rose-900/30 flex items-center justify-center gap-2 transition-all"
                >
                  {loginLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Verificando Credenciais...
                    </>
                  ) : (requireOtp || totpEnabled) ? (
                    <>
                      <ShieldCheck className="w-4 h-4" /> Verificar Senha + 2FA e Entrar
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" /> Desbloquear Painel de Controle
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPasswordInput(DEFAULT_SYSTEM_PASSWORD);
                    setLoginError(null);
                  }}
                  className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1.5"
                  title="Preencher com a senha mestra gerada pelo servidor"
                >
                  <Key className="w-3.5 h-3.5 text-amber-400" /> Preencher Senha Padrão
                </button>
              </div>
            </form>

            {/* Aviso da Senha Inicial do Servidor */}
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-400" /> Senha Inicial Segura Gerada pelo Servidor:
                </span>
                <span className="text-[10px] text-emerald-400 font-mono font-semibold">256-BIT ENTROPIA</span>
              </div>
              <div className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-xl border border-slate-800 font-mono text-amber-300 text-xs">
                <code>{DEFAULT_SYSTEM_PASSWORD}</code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(DEFAULT_SYSTEM_PASSWORD);
                    alert('Senha copiada para a área de transferência!');
                  }}
                  className="text-slate-400 hover:text-slate-200 transition-colors ml-2"
                  title="Copiar senha"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Você também pode definir uma senha personalizada ao iniciar o servidor via variável de ambiente{' '}
                <code>DATALINK_ADMIN_PASSWORD</code>.
              </p>
            </div>
          </div>
        </div>

        {/* Gerador de Senhas Seguras Blue Team */}
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Gerador de Senha Criptográfica Blue Team
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setGeneratorPassword(generateRandomSecurePassword(28));
                setCopiedGenPassword(false);
              }}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Gerar Nova
            </button>
          </div>

          <div className="flex items-center justify-between bg-slate-950 px-3 py-2.5 rounded-xl border border-slate-800 font-mono text-xs text-slate-200">
            <span className="truncate mr-2 text-emerald-300">{generatorPassword}</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(generatorPassword);
                setCopiedGenPassword(true);
                setTimeout(() => setCopiedGenPassword(false), 2000);
              }}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1 shrink-0 transition-colors"
            >
              {copiedGenPassword ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedGenPassword ? 'Copiado!' : 'Copiar'}</span>
            </button>
          </div>
        </div>

        {/* Status de Segurança e 2FA */}
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-3xl p-5 shadow-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${totpEnabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  2FA (TOTP RFC 6238)
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${totpEnabled ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                  {totpEnabled ? 'ATIVO NO SERVIDOR' : 'DESATIVADO'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {totpEnabled 
                  ? 'Login protegido por autenticação em dois fatores offline (Google Authenticator / Authy).'
                  : 'Camada de proteção extra que pode ser ativada na aba Defesa Blue Team após o login.'}
              </p>
            </div>
          </div>
        </div>

        {/* Mecanismos de Defesa Ativos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 bg-slate-900/40 border border-slate-800/80 rounded-2xl text-xs space-y-1">
            <div className="flex items-center gap-1.5 text-rose-400 font-semibold">
              <Ban className="w-4 h-4" /> Fail2Ban Ativo
            </div>
            <p className="text-[11px] text-slate-400">
              5 tentativas erradas de senha bloqueiam o IP de origem por 30 minutos automaticamente.
            </p>
          </div>

          <div className="p-3.5 bg-slate-900/40 border border-slate-800/80 rounded-2xl text-xs space-y-1">
            <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
              <Zap className="w-4 h-4" /> Anti-DDoS & Tarpit
            </div>
            <p className="text-[11px] text-slate-400">
              Rate Limiting estrito e Tarpit defensivo retêm requisições abusivas sem estressar a RAM.
            </p>
          </div>

          <div className="p-3.5 bg-slate-900/40 border border-slate-800/80 rounded-2xl text-xs space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <Shield className="w-4 h-4" /> Memory & Buffer Armor
            </div>
            <p className="text-[11px] text-slate-400">
              Payloads truncados em 64KB e WAF anti-injeção bloqueiam estouro de buffer e traversal.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Visualização Autenticada
  const messageDistributionData = data?.traffic.messageTypesCount
    ? Object.entries(data.traffic.messageTypesCount)
        .filter(([, val]) => val > 0)
        .map(([name, value]) => ({ name, value }))
    : [];

  const memoryChartData = data?.system.memory
    ? [
        { name: 'Heap Usado', MB: Math.round(data.system.memory.heapUsedBytes / (1024 * 1024)) },
        { name: 'Heap Total', MB: Math.round(data.system.memory.heapTotalBytes / (1024 * 1024)) },
        { name: 'RSS', MB: Math.round(data.system.memory.rssBytes / (1024 * 1024)) },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Top Banner de Controle do Administrador */}
      <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100">Painel do Administrador & Blue Team</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                SESSÃO AUTORIZADA
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('defense');
                  setShowTotpSection(true);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
                  totpEnabled
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/50 hover:bg-emerald-900/60'
                    : 'bg-amber-950/80 text-amber-300 border-amber-600/50 hover:bg-amber-900/60'
                }`}
                title="Configurar 2FA TOTP na aba de Defesa"
              >
                <Smartphone className="w-3 h-3" />
                <span>2FA: {totpEnabled ? 'ATIVO' : 'DESATIVADO (CONFIGURAR)'}</span>
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Defesa ativa contra infiltração • Monitoramento em tempo real • Quarentena de IPs
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Alternador de Abas */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('surveillance')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'surveillance'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Câmeras & CFTV</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                {Object.keys(surveillanceFeeds).length}
              </span>
            </button>


            <button
              type="button"
              onClick={() => setActiveTab('parental')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'parental'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Baby className="w-3.5 h-3.5" />
              <span>Controle Parental</span>
              {parentalAlerts.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-950 text-rose-300 border border-rose-700/50 animate-pulse">
                  {parentalAlerts.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('telemetry')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'telemetry'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" /> Telemetria
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('defense')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'defense'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" /> Defesa Blue Team ({securityData?.bannedIps?.length || 0})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('containment')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'containment'
                  ? 'bg-rose-700 text-white shadow-sm ring-1 ring-rose-400'
                  : 'text-rose-400/90 hover:text-rose-200 hover:bg-rose-950/40'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>Contenção Zero-Trust & SOC</span>
              {securityData?.isLockdown && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-600 text-white font-bold animate-pulse">
                  DEFCON 1
                </span>
              )}
              {!securityData?.isLockdown && securityData?.quarantinedClients && securityData.quarantinedClients.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-950 text-rose-300 border border-rose-700/50">
                  {securityData.quarantinedClients.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ai_copilot')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'ai_copilot'
                  ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-sm ring-1 ring-cyan-400'
                  : 'text-cyan-400/90 hover:text-cyan-200 hover:bg-cyan-950/40'
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-cyan-400" />
              <span>Copilot IA & Aliado SOC</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-700/50 flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" /> IA
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('nsite')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'nsite'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm ring-1 ring-emerald-400'
                  : 'text-emerald-400/90 hover:text-emerald-200 hover:bg-emerald-950/40'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>Nsite & Nostr</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                NIP-5A
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={fetchTelemetry}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
              autoRefresh
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            Auto (3s): {autoRefresh ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            onClick={exportTelemetryJson}
            disabled={!data}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all"
            title="Exportar dados de telemetria e segurança em JSON"
          >
            <Download className="w-3.5 h-3.5" /> Exportar
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold rounded-xl transition-all"
            title="Encerrar sessão de administrador"
          >
            <LogOut className="w-3.5 h-3.5" /> Sair
          </button>

          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold rounded-xl transition-all"
              title="Alternar para a visualização comum de usuário"
            >
              ← Modo Usuário
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchTelemetry}
            className="text-xs font-semibold text-rose-400 hover:underline"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {commandSuccessStatus && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/40 rounded-2xl text-xs font-semibold text-emerald-400 flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> {commandSuccessStatus}
        </div>
      )}

      {/* ABA: CENTRAL DE VIGILÂNCIA, CÂMERAS & ÁUDIO (ADMIN EXCLUSIVO) */}
      {activeTab === 'surveillance' && (
        <div className="space-y-6">
          {/* Banner de Controle e Notificação de Exclusividade */}
          <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <Camera className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-100">
                    Central de Vigilância & Recepção Centralizada
                  </h3>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-semibold ${
                    adminWsConnected
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  }`}>
                    {adminWsConnected ? 'CANAL EXCLUSIVO ADMIN: ATIVO' : 'CONECTANDO...'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Somente você (Administrador) tem acesso para receber feeds de vídeo, escutar áudios do microfone e baixar arquivos das estações.
                </p>
              </div>
            </div>

            {/* Ações Rápidas de Comando do Administrador */}
            <div className="flex items-center flex-wrap gap-2">
              <button
                type="button"
                onClick={() => sendRemoteCommand('request-photo')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-semibold rounded-xl transition-all"
                title="Solicita que todas as câmeras conectadas tirem e enviem uma foto"
              >
                <Camera className="w-3.5 h-3.5" /> Pedir Foto de Todos
              </button>
              <button
                type="button"
                onClick={() => sendRemoteCommand('switch-camera')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-semibold rounded-xl transition-all"
                title="Solicita que todos os dispositivos conectados invertam a câmera (Frontal / Traseira)"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Inverter Câmeras
              </button>
              <button
                type="button"
                onClick={() => sendRemoteCommand('alert')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold rounded-xl transition-all"
                title="Dispara alarme sonoro nas estações remotas"
              >
                <Volume2 className="w-3.5 h-3.5" /> Disparar Alarme Geral
              </button>
              <button
                type="button"
                onClick={() => handleSendSilenceAlert('all', 'Todos os Usuários')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-semibold rounded-xl transition-all shadow-sm"
                title="Desligar e silenciar todas as sirenes ou alarmes ativos em todas as estações"
              >
                <VolumeX className="w-3.5 h-3.5" /> Desligar Sirenes Gerais
              </button>
              {securityAlerts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSecurityAlerts([])}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold rounded-xl transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Limpar Alertas ({securityAlerts.length})
                </button>
              )}
            </div>
          </div>

          {/* Alerta de Status de Gravação DVR */}
          {cctvSaveStatus && (
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/40 rounded-2xl text-xs font-semibold text-indigo-300 flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>{cctvSaveStatus}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Central Admin</span>
            </div>
          )}

          {/* Banner de Interfone ao Vivo Recebido de Usuário */}
          {activeIncomingIntercom && (
            <div className="p-4 bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border-2 border-emerald-500/80 rounded-2xl shadow-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 rounded-xl">
                  <Volume2 className="w-6 h-6 text-emerald-400 animate-pulse" />
                </div>
                <div>
                  <div className="font-black text-xs sm:text-sm text-white uppercase tracking-wider flex items-center gap-2">
                    <span>🔊 INTERFONE AO VIVO DA ESTAÇÃO: {activeIncomingIntercom.fromName}</span>
                    <span className="text-[10px] bg-emerald-500 text-black px-2 py-0.5 rounded-full font-black animate-pulse">VOZ ATIVA</span>
                  </div>
                  <div className="text-xs text-emerald-300 font-medium">
                    O áudio foi reproduzido no console. Você pode responder com sua voz ao vivo!
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (activeTalkingStation === activeIncomingIntercom.fromClientId) {
                      handleStopAdminIntercom();
                    } else {
                      handleStartAdminIntercom(activeIncomingIntercom.fromClientId, activeIncomingIntercom.fromName);
                    }
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
                    activeTalkingStation === activeIncomingIntercom.fromClientId
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/60'
                  }`}
                >
                  <Radio className="w-4 h-4" />
                  <span>{activeTalkingStation === activeIncomingIntercom.fromClientId ? '🔴 Falando... (Clique p/ Encerrar)' : `🎙️ Responder ${activeIncomingIntercom.fromName}`}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveIncomingIntercom(null)}
                  className="px-2 py-1.5 text-slate-400 hover:text-white text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Sub-Navegação: Mural Ao Vivo vs Gerenciador de Arquivos & Gravações */}
          <div className="flex items-center flex-wrap gap-2 bg-slate-900/90 p-2 rounded-2xl border border-slate-800 shadow-xl">
            <button
              type="button"
              onClick={() => setCctvSubView('live')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                cctvSubView === 'live'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>Mural Ao Vivo (CFTV & Ronda)</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-black/40 font-mono">
                {Object.keys(surveillanceFeeds).length} Câmeras
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCctvSubView('recordings');
                fetchCctvRecordings();
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                cctvSubView === 'recordings'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              <span>Gerenciador de Arquivos & Gravações</span>
              {cctvStats ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-black/40 font-mono text-purple-200">
                  {cctvStats.totalCount} arquivos • {cctvStats.totalBytesFormatted}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-black/40 font-mono">
                  DVR Local
                </span>
              )}
            </button>
          </div>

          {cctvSubView === 'live' && (
            <div className="space-y-6">
              {/* Cards de Resumo / KPIs de Vigilância */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-3.5 shadow-xl">
              <div className="flex items-center justify-between text-slate-400 mb-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wider">Dispositivos</span>
                <Smartphone className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-xl font-bold text-slate-100 font-mono">
                {connectedStations.length}
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {connectedStations.length > 0 ? 'Conectados na rede' : 'Aguardando nós'}
              </span>
            </div>

            <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-3.5 shadow-xl">
              <div className="flex items-center justify-between text-slate-400 mb-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wider">Câmeras Ativas</span>
                <Camera className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-bold text-slate-100 font-mono">
                {Object.keys(surveillanceFeeds).length}
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {Object.keys(surveillanceFeeds).length > 0 ? 'Transmitindo vídeo' : 'Em repouso'}
              </span>
            </div>

            <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-3.5 shadow-xl">
              <div className="flex items-center justify-between text-slate-400 mb-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wider">Áudios Recebidos</span>
                <Mic className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-xl font-bold text-slate-100 font-mono">
                {receivedAudios.length}
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Gravações de microfone
              </span>
            </div>

            <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-3.5 shadow-xl">
              <div className="flex items-center justify-between text-slate-400 mb-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wider">Arquivos</span>
                <FolderDown className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-xl font-bold text-slate-100 font-mono">
                {receivedFiles.length}
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Transferências finalizadas
              </span>
            </div>

            <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-3.5 shadow-xl">
              <div className="flex items-center justify-between text-slate-400 mb-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wider">Alertas</span>
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl font-bold text-slate-100 font-mono">
                {securityAlerts.length}
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Detecções de movimento
              </span>
            </div>
          </div>

          {/* PAINEL DE DISPOSITIVOS E CELULARES CONECTADOS NA REDE */}
          <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-xs text-slate-200 uppercase tracking-wider">
                  Dispositivos & Celulares Conectados ({connectedStations.length})
                </h3>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleOpenEmergencyPopupModal(null)}
                  className="px-3 py-1.5 bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-red-950/50 border border-red-400/40 transition-all active:scale-95"
                  title="Disparar Pop-up de Alerta em tela cheia com Sirene e confirmação obrigatória para TODOS os usuários"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-white animate-pulse" />
                  <span>📢 Alerta Pop-up Geral (Todos)</span>
                </button>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  Detecção automática de nós na rede local
                </span>
              </div>
            </div>

            {/* Fita de Confirmação de Leitura de Alertas (ACK) */}
            {alertAckReceipts.length > 0 && (
              <div className="p-3 bg-emerald-950/50 border border-emerald-500/40 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>Confirmações de Leitura Recebidas (Pop-ups Cientes):</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {alertAckReceipts.slice(0, 5).map((ack, idx) => (
                    <span key={idx} className="px-2.5 py-0.5 rounded-full bg-emerald-900/80 border border-emerald-500/50 text-[11px] text-emerald-200 font-mono shadow-sm">
                      ✓ <strong>{ack.clientName}</strong> ({new Date(ack.timestamp).toLocaleTimeString()})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {connectedStations.length === 0 ? (
              <div className="p-6 bg-slate-950/60 rounded-xl border border-slate-800 text-center space-y-2">
                <Smartphone className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">
                  Nenhum celular ou computador conectado no momento. Abra <code className="text-indigo-400">http://192.168.8.106:4870</code> no celular para conectar este dispositivo como sensor.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {connectedStations.map((station) => {
                  const cameraFeed = surveillanceFeeds[station.clientId] ||
                    (station.peerId ? surveillanceFeeds[String(station.peerId)] : undefined) ||
                    Object.values(surveillanceFeeds).find((f) => f.fromClientId === station.clientId || (station.peerId && f.fromPeerId === station.peerId) || f.fromName === station.name);
                  const hasCamera = !!cameraFeed || !!station.isCameraActive;

                  const screenFeed = screenFeeds[station.clientId] ||
                    (station.peerId ? screenFeeds[String(station.peerId)] : undefined) ||
                    (station.name ? screenFeeds[station.name] : undefined) ||
                    Object.values(screenFeeds).find((f) => f.fromClientId === station.clientId || (station.peerId && f.fromPeerId === station.peerId) || f.fromName === station.name);
                  const hasScreen = !!screenFeed || !!station.isScreenActive;
                  const screenData = station.screenData || {
                    width: 1920,
                    height: 1080,
                    windowWidth: 1280,
                    windowHeight: 720,
                    colorDepth: 24,
                    pixelRatio: 1,
                    orientation: 'landscape',
                    hasFocus: true,
                  };
                  const latestAudio = getStationLatestAudio(station.clientId);
                  const stationChats = getStationChatMessages(station.clientId);
                  const isChatOpen = openChatStationId === station.clientId;
                  const isScreenFresh = !!(screenFeed && (Date.now() - (screenFeed.lastUpdated || 0)) < 30000);
                  const isCameraFresh = !!(cameraFeed && (Date.now() - (cameraFeed.lastUpdated || 0)) < 30000);
                  const defaultMode = hasScreen
                    ? 'screen'
                    : isCameraFresh
                    ? 'camera'
                    : hasCamera
                    ? 'camera'
                    : 'screen';
                  const viewMode = stationViewModes[station.clientId] || (station.peerId ? stationViewModes[String(station.peerId)] : undefined) || (station.name ? stationViewModes[station.name] : undefined) || defaultMode;

                  return (
                    <div
                      key={station.clientId}
                      className="bg-slate-950/90 rounded-2xl border border-slate-800 hover:border-slate-700/80 p-4 shadow-xl transition-all space-y-4 flex flex-col justify-between"
                    >
                      {/* Top: Header do Usuário */}
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-md"
                              style={{
                                backgroundColor: `${station.color || '#10b981'}25`,
                                color: station.color || '#10b981',
                                border: `1px solid ${station.color || '#10b981'}50`,
                              }}
                            >
                              {station.platform?.includes('Android') || station.platform?.includes('iOS') ? (
                                <Smartphone className="w-4 h-4" />
                              ) : (
                                <Monitor className="w-4 h-4" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-bold text-slate-100 truncate block">
                                  {station.name}
                                </span>
                                {station.latency !== null && station.latency !== undefined && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                                    {station.latency}ms
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono truncate block">
                                {station.clientId} • {station.remoteAddress || 'LAN'} • {station.platform || 'Dispositivo'}
                              </span>
                              {(() => {
                                const stLoc = station.location || data?.peers?.find((p) => p.clientId === station.clientId || String(p.peerId) === String(station.peerId))?.location || {
                                  latitude: -23.5505,
                                  longitude: -46.6333,
                                  country: 'Brasil',
                                  countryCode: 'BR',
                                  flag: '🇧🇷',
                                  source: 'network' as const,
                                  accuracy: 15,
                                  timestamp: Date.now(),
                                };
                                return (
                                  <div className="mt-1">
                                    <GpsHoverBadge
                                      location={stLoc}
                                      stationName={station.name}
                                      buttonLabel="Mapa"
                                      placement="bottom"
                                    />
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-semibold flex items-center gap-1 ${
                                hasCamera
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : hasScreen
                                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${hasCamera ? 'bg-rose-400 animate-ping' : 'bg-emerald-400'}`} />
                              {hasCamera ? 'CAM AO VIVO' : hasScreen ? 'TELA AO VIVO' : 'ONLINE'}
                            </span>
                            {station.battery !== undefined && (
                              <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                                <Zap className={`w-3 h-3 ${station.isCharging ? 'text-amber-400' : 'text-slate-400'}`} />
                                {station.battery}% {station.isCharging ? '⚡' : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Alternador de Visão da Mini Tela */}
                        <div className="flex items-center justify-between bg-slate-900/90 p-1 rounded-xl border border-slate-800/80 text-[11px] mb-3">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setStationViewModes((prev) => ({ ...prev, [station.clientId]: 'camera' }))}
                              className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all ${
                                viewMode === 'camera'
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <Camera className="w-3 h-3" />
                              <span>Câmera</span>
                              {hasCamera && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => setStationViewModes((prev) => ({ ...prev, [station.clientId]: 'screen' }))}
                              className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all ${
                                viewMode === 'screen'
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <Monitor className="w-3 h-3" />
                              <span>Tela ao Vivo</span>
                              {hasScreen && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => setStationViewModes((prev) => ({ ...prev, [station.clientId]: 'split' }))}
                              className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all ${
                                viewMode === 'split'
                                  ? 'bg-purple-600 text-white shadow-sm'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                              title="Ver Câmera e Tela lado a lado"
                            >
                              <Columns className="w-3 h-3" />
                              <span>Split</span>
                            </button>
                          </div>

                          <span className="text-[10px] text-slate-500 font-mono pr-1.5">
                            {viewMode === 'camera' ? (hasCamera ? 'Transmissão' : 'Standby') : viewMode === 'screen' ? (hasScreen ? 'Captura Ativa' : 'Resolução') : 'Duplo'}
                          </span>
                        </div>

                        {/* MINI TELA COM CÂMERA E DADOS DE TELA */}
                        <div className="space-y-3">
                          {viewMode === 'camera' && (
                            <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center group shadow-inner">
                              {hasCamera && cameraFeed ? (
                                <>
                                  <img
                                    src={cameraFeed.frameData}
                                    alt={`Câmera de ${station.name}`}
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-emerald-300 flex items-center gap-1.5 border border-slate-800">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                                    <span>AO VIVO • {new Date(cameraFeed.lastUpdated).toLocaleTimeString('pt-BR')}</span>
                                  </div>
                                  {/* Tag de País e Localização GPS no Quadro da Câmera com Mouse Over */}
                                  {(() => {
                                    const stLoc = station.location || cameraFeed.location || data?.peers?.find((p) => p.clientId === station.clientId || String(p.peerId) === String(station.peerId))?.location || {
                                      latitude: -23.5505,
                                      longitude: -46.6333,
                                      country: 'Brasil',
                                      countryCode: 'BR',
                                      flag: '🇧🇷',
                                      source: 'network' as const,
                                      timestamp: Date.now(),
                                    };
                                    return (
                                      <div className="absolute bottom-2 left-2 z-20 pointer-events-auto">
                                        <GpsHoverBadge
                                          location={stLoc}
                                          stationName={station.name}
                                          buttonLabel="Mapa"
                                          className="bg-slate-950/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700/80 shadow-lg text-[11px] font-mono text-emerald-300 hover:border-emerald-500/50"
                                          placement="top"
                                        />
                                      </div>
                                    );
                                  })()}
                                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const stLoc = station.location || cameraFeed.location || data?.peers?.find((p) => p.clientId === station.clientId || String(p.peerId) === String(station.peerId))?.location;
                                        setFullscreenMedia({
                                          type: 'camera',
                                          title: `Câmera ao Vivo — ${station.name}`,
                                          frameData: cameraFeed.frameData,
                                          fromName: station.name,
                                          fromClientId: station.clientId,
                                          location: stLoc || undefined,
                                        });
                                      }}
                                      className="p-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 rounded-lg border border-slate-700"
                                      title="Expandir para tela cheia"
                                    >
                                      <Maximize2 className="w-3 h-3" />
                                    </button>
                                    <a
                                      href={cameraFeed.frameData}
                                      download={`camera-${station.name}-${Date.now()}.jpg`}
                                      className="p-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 rounded-lg border border-slate-700"
                                      title="Baixar imagem"
                                    >
                                      <Download className="w-3 h-3" />
                                    </a>
                                  </div>
                                </>
                              ) : (
                                <div className="text-center p-4 space-y-2">
                                  <Camera className="w-7 h-7 text-slate-600 mx-auto" />
                                  <p className="text-[11px] text-slate-400">Câmera em espera neste dispositivo</p>
                                  <div className="flex items-center justify-center gap-2 flex-wrap">
                                    {hasScreen && screenFeed && (
                                      <button
                                        type="button"
                                        onClick={() => setStationViewModes((prev) => ({
                                          ...prev,
                                          [station.clientId]: 'screen',
                                          ...(station.peerId ? { [String(station.peerId)]: 'screen' } : {}),
                                          ...(station.name ? { [station.name]: 'screen' } : {}),
                                        }))}
                                        className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-[10px] font-bold inline-flex items-center gap-1 shadow-md animate-pulse"
                                      >
                                        <Monitor className="w-3 h-3" /> Ver Tela ao Vivo Transmitida
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => sendRemoteCommand('request-photo', station.clientId)}
                                      className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 rounded-lg text-[10px] font-semibold inline-flex items-center gap-1"
                                    >
                                      <Camera className="w-3 h-3" /> Solicitar Foto Agora
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {viewMode === 'screen' && (
                            <div className="space-y-2">
                              {hasScreen && screenFeed ? (
                                <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center group shadow-inner">
                                  <img
                                    src={screenFeed.frameData}
                                    alt={`Tela de ${station.name}`}
                                    className="w-full h-full object-contain"
                                  />
                                  <div className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-cyan-300 flex items-center gap-1.5 border border-slate-800">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                    <span>TELA TRANSMITIDA • {new Date(screenFeed.lastUpdated).toLocaleTimeString('pt-BR')}</span>
                                  </div>
                                  {/* Tag de País e Localização GPS no Quadro da Tela com Mouse Over */}
                                  {(() => {
                                    const stLoc = station.location || screenFeed.location || data?.peers?.find((p) => p.clientId === station.clientId || String(p.peerId) === String(station.peerId))?.location || {
                                      latitude: -23.5505,
                                      longitude: -46.6333,
                                      country: 'Brasil',
                                      countryCode: 'BR',
                                      flag: '🇧🇷',
                                      source: 'network' as const,
                                      timestamp: Date.now(),
                                    };
                                    return (
                                      <div className="absolute bottom-2 left-2 z-20 pointer-events-auto">
                                        <GpsHoverBadge
                                          location={stLoc}
                                          stationName={station.name}
                                          buttonLabel="Mapa"
                                          className="bg-slate-950/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700/80 shadow-lg text-[11px] font-mono text-cyan-300 hover:border-cyan-500/50"
                                          placement="top"
                                        />
                                      </div>
                                    );
                                  })()}
                                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const stLoc = station.location || screenFeed.location || data?.peers?.find((p) => p.clientId === station.clientId || String(p.peerId) === String(station.peerId))?.location;
                                        setFullscreenMedia({
                                          type: 'screen',
                                          title: `Tela Remota — ${station.name}`,
                                          frameData: screenFeed.frameData,
                                          fromName: station.name,
                                          fromClientId: station.clientId,
                                          location: stLoc || undefined,
                                        });
                                      }}
                                      className="p-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 rounded-lg border border-slate-700"
                                      title="Expandir tela cheia"
                                    >
                                      <Maximize2 className="w-3 h-3" />
                                    </button>
                                    <a
                                      href={screenFeed.frameData}
                                      download={`tela-${station.name}-${Date.now()}.jpg`}
                                      className="p-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 rounded-lg border border-slate-700"
                                      title="Baixar frame da tela"
                                    >
                                      <Download className="w-3 h-3" />
                                    </a>
                                  </div>
                                </div>
                              ) : (
                                <div className="relative aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex flex-col items-center justify-center p-4 text-center space-y-2">
                                  <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                                    <Monitor className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <span className="text-xs font-bold text-slate-200 block">Tela em Espera</span>
                                    <span className="text-[11px] text-slate-400 block">Nenhuma transmissão de tela recebida ainda deste dispositivo.</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setStationViewModes((prev) => ({ ...prev, [station.clientId]: 'screen' }));
                                      sendRemoteCommand('request-screen', station.clientId);
                                    }}
                                    className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                                  >
                                    <MonitorPlay className="w-3.5 h-3.5" /> Pedir Transmissão de Tela
                                  </button>
                                </div>
                              )}

                              {/* Dados Técnicos de Tela */}
                              <div className="bg-slate-900/80 rounded-xl border border-slate-800/80 p-2.5 space-y-2">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                                    <Monitor className="w-3.5 h-3.5 text-indigo-400" /> Dados da Tela do Usuário
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => sendRemoteCommand('request-screen', station.clientId)}
                                    className="px-2 py-0.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 rounded text-[10px] font-semibold flex items-center gap-1"
                                    title="Pedir captura/compartilhamento de tela ou transmissão de celular"
                                  >
                                    <MonitorPlay className="w-3 h-3" />
                                    <span>{station.name.includes('📱') ? '📱 Pedir Câmera/Tela' : '🖥️ Pedir Tela'}</span>
                                  </button>
                                </div>

                                <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                                  <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800 flex justify-between items-center">
                                    <span className="text-slate-400">Resolução:</span>
                                    <span className="text-indigo-300 font-bold">{screenData.width || 1920}×{screenData.height || 1080}</span>
                                  </div>
                                  <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800 flex justify-between items-center">
                                    <span className="text-slate-400">Janela:</span>
                                    <span className="text-slate-200">{screenData.windowWidth || 1280}×{screenData.windowHeight || 720}</span>
                                  </div>
                                  <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800 flex justify-between items-center">
                                    <span className="text-slate-400">Orientação:</span>
                                    <span className="text-slate-200">{screenData.orientation?.includes('portrait') ? '📱 Retrato' : '🖥️ Paisagem'}</span>
                                  </div>
                                  <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800 flex justify-between items-center">
                                    <span className="text-slate-400">Cores / DPI:</span>
                                    <span className="text-slate-200">{screenData.colorDepth || 24}b • {screenData.pixelRatio || 1}x</span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                                  <span className="flex items-center gap-1">
                                    <span className={`w-1.5 h-1.5 rounded-full ${screenData.hasFocus !== false ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                    {screenData.hasFocus !== false ? 'Aplicativo Ativo em Foco' : 'Segundo Plano'}
                                  </span>
                                  <span>{hasScreen ? '🟢 Compartilhando' : '⚪ Stream Inativo'}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {viewMode === 'split' && (
                            <div className="grid grid-cols-2 gap-2">
                              {/* Lado Câmera */}
                              <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
                                {hasCamera && cameraFeed ? (
                                  <img src={cameraFeed.frameData} alt="Câmera" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="text-center p-2">
                                    <Camera className="w-4 h-4 text-slate-600 mx-auto mb-1" />
                                    <span className="text-[9px] text-slate-500 block">Sem Câmera</span>
                                  </div>
                                )}
                                <span className="absolute bottom-1 left-1 bg-black/80 backdrop-blur-xs px-1.5 py-0.5 rounded text-[9px] font-mono text-emerald-300 flex items-center gap-1">
                                  <span>CAM</span>
                                  <span>{(station.location?.flag || '🇧🇷')}</span>
                                </span>
                              </div>

                              {/* Lado Tela */}
                              <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
                                {hasScreen && screenFeed ? (
                                  <img src={screenFeed.frameData} alt="Tela" className="w-full h-full object-contain" />
                                ) : (
                                  <div className="text-center p-2 font-mono text-[9px] text-indigo-300">
                                    <Monitor className="w-4 h-4 text-slate-600 mx-auto mb-1" />
                                    <span>{screenData.width || 1920}×{screenData.height || 1080}</span>
                                  </div>
                                )}
                                <span className="absolute bottom-1 left-1 bg-black/80 backdrop-blur-xs px-1.5 py-0.5 rounded text-[9px] font-mono text-cyan-300 flex items-center gap-1">
                                  <span>TELA</span>
                                  <span>{(station.location?.flag || '🇧🇷')}</span>
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* ÁUDIO DE MONITORAMENTO */}
                        <div className="bg-slate-900/70 rounded-xl border border-slate-800/80 p-2.5 mt-3 space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                              <Headphones className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Áudio de Monitoramento</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => sendRemoteCommand('request-audio', station.clientId)}
                                className="px-2 py-0.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 rounded text-[10px] font-semibold flex items-center gap-1"
                                title="Solicitar gravação de áudio do microfone do usuário"
                              >
                                <Mic className="w-3 h-3" /> Pedir Áudio
                              </button>
                            </div>
                          </div>

                          {/* VU Meter Visual / Nível de Atividade Sonora */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span>Atividade Sonora no Ambiente:</span>
                              <span className="font-mono text-slate-200 font-semibold">{station.audioLevel || 0}%</span>
                            </div>
                            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800 flex">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-500 via-yellow-400 to-rose-500 transition-all duration-300"
                                style={{ width: `${Math.max(4, Math.min(100, station.audioLevel || 0))}%` }}
                              />
                            </div>
                          </div>

                          {/* Player do Último Áudio Gravado */}
                          {latestAudio ? (
                            <div className="pt-1 border-t border-slate-800/80 space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-slate-400">
                                <span className="flex items-center gap-1">
                                  <FileAudio className="w-3 h-3 text-emerald-400" /> Última Gravação
                                </span>
                                <span className="font-mono">{new Date(latestAudio.timestamp).toLocaleTimeString('pt-BR')}</span>
                              </div>
                              <audio controls src={latestAudio.audioData} className="w-full h-7" />
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-500 italic">
                              Nenhuma gravação de áudio recebida ainda.
                            </div>
                          )}
                        </div>

                        {/* ÁREA PARA INICIAR CHAT COM O USUÁRIO */}
                        <div className="bg-slate-900/70 rounded-xl border border-slate-800/80 p-2.5 mt-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => setOpenChatStationId(isChatOpen ? null : station.clientId)}
                              className="flex items-center gap-2 text-xs font-bold text-slate-200 hover:text-white transition-colors"
                            >
                              <MessageCircle className="w-4 h-4 text-indigo-400" />
                              <span>Área de Chat Direto</span>
                              {stationChats.length > 0 && (
                                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                                  {stationChats.length}
                                </span>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => setOpenChatStationId(isChatOpen ? null : station.clientId)}
                              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                            >
                              <span>{isChatOpen ? 'Recolher' : 'Iniciar Chat'}</span>
                              {isChatOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          </div>

                          {isChatOpen && (
                            <div className="space-y-2 pt-2 border-t border-slate-800/80">
                              {/* Mensagens Recentes */}
                              <div className="max-h-36 overflow-y-auto space-y-1.5 p-1 text-xs font-sans">
                                {stationChats.length === 0 ? (
                                  <p className="text-[11px] text-slate-500 text-center py-2">
                                    Nenhuma mensagem trocada ainda com {station.name}. Digite abaixo para iniciar o chat em tempo real.
                                  </p>
                                ) : (
                                  stationChats.map((msg) => (
                                    <div
                                      key={msg.id}
                                      className={`flex flex-col ${msg.isFromAdmin ? 'items-end' : 'items-start'}`}
                                    >
                                      <div
                                        className={`max-w-[85%] rounded-xl px-2.5 py-1.5 text-[11px] leading-relaxed ${
                                          msg.isFromAdmin
                                            ? 'bg-indigo-600 text-white rounded-tr-none'
                                            : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700'
                                        }`}
                                      >
                                        <span className="font-semibold text-[9px] block opacity-75 mb-0.5">
                                          {msg.isFromAdmin ? 'Você (Admin)' : msg.fromName}
                                        </span>
                                        <span>{msg.text}</span>
                                      </div>
                                      <span className="text-[9px] text-slate-500 mt-0.5 px-1 font-mono">
                                        {new Date(msg.timestamp).toLocaleTimeString('pt-BR')}
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>

                              {/* Atalhos Rápidos de Envio */}
                              <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                                <button
                                  type="button"
                                  onClick={() => handleSendAdminChat(station.clientId, '⚠️ Atenção: Por favor responda a Central.')}
                                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9px] shrink-0 border border-slate-700"
                                >
                                  ⚠️ Atenção
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSendAdminChat(station.clientId, '📸 Por favor, envie uma foto da câmera.')}
                                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9px] shrink-0 border border-slate-700"
                                >
                                  📸 Pedir Foto
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSendAdminChat(station.clientId, '🖥️ Por favor, compartilhe sua tela com a Central.')}
                                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9px] shrink-0 border border-slate-700"
                                >
                                  🖥️ Pedir Tela
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSendAdminChat(station.clientId, '👍 Mensagem recebida com sucesso!')}
                                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9px] shrink-0 border border-slate-700"
                                >
                                  👍 Ok
                                </button>
                              </div>

                              {/* Campo de Digitação do Administrador */}
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={stationChatInputs[station.clientId] || ''}
                                  onChange={(e) => setStationChatInputs((prev) => ({ ...prev, [station.clientId]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSendAdminChat(station.clientId);
                                  }}
                                  placeholder={`Mensagem para ${station.name}...`}
                                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSendAdminChat(station.clientId)}
                                  className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow transition-colors shrink-0"
                                  title="Enviar mensagem"
                                >
                                  <SendHorizontal className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Ações Especiais de Alto Impacto: Gravar Tudo no DVR & Disparar Popup com Sirene */}
                      <div className="pt-3 border-t border-slate-800/80 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleRecordEverything(station)}
                            disabled={recordingEverythingStations[station.clientId]}
                            className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 border ${
                              recordingEverythingStations[station.clientId]
                                ? 'bg-rose-950/80 border-rose-500 text-rose-200 animate-pulse'
                                : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 border-rose-400/40 text-white shadow-rose-950/40'
                            }`}
                            title="Gravar TUDO deste usuário: Salva Câmera + Tela + Microfone arquivados no DVR do Servidor"
                          >
                            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                            <span>{recordingEverythingStations[station.clientId] ? 'Gravando Tudo...' : '🔴 Gravar Tudo'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEmergencyPopupModal(station)}
                            className="py-2 px-2.5 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 border border-amber-400/40 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-950/40 active:scale-95"
                            title="Disparar Pop-up de Alerta em tela cheia com Sirene e confirmação obrigatória para este usuário"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-white" />
                            <span>📢 Popup Alerta</span>
                          </button>
                        </div>

                        {/* Linha Interfone, Som Individual & Silenciar Alerta */}
                        <div className="grid grid-cols-3 gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (activeTalkingStation === station.clientId) {
                                handleStopAdminIntercom();
                              } else {
                                handleStartAdminIntercom(station.clientId, station.name);
                              }
                            }}
                            className={`py-1.5 px-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all border shadow-sm ${
                              activeTalkingStation === station.clientId
                                ? 'bg-rose-600 border-rose-400 text-white animate-pulse'
                                : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/40'
                            }`}
                            title="Falar ao vivo pelo microfone diretamente com este usuário (Interfone)"
                          >
                            <Radio className="w-3 h-3 shrink-0" />
                            <span>{activeTalkingStation === station.clientId ? '🔴 Falando...' : '🎙️ Falar PTT'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSendPlaySound(station.clientId, station.name)}
                            className="py-1.5 px-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-all"
                            title="Tocar som de chamada/atenção individual na estação deste usuário"
                          >
                            <Volume2 className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>🔔 Som</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSendSilenceAlert(station.clientId, station.name)}
                            className="py-1.5 px-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-all"
                            title="Desligar/Silenciar alarme ou sirene ativa neste usuário"
                          >
                            <VolumeX className="w-3 h-3 text-rose-400 shrink-0" />
                            <span>🔇 Desligar</span>
                          </button>
                        </div>

                        {/* Bottom: Ações Rápidas de Comando do Administrador */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => sendRemoteCommand('request-photo', station.clientId)}
                            className="flex-1 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-all"
                            title="Solicitar foto imediata"
                          >
                            <Camera className="w-3 h-3" /> Foto
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setStationViewModes((prev) => ({ ...prev, [station.clientId]: 'screen' }));
                              sendRemoteCommand('request-screen', station.clientId);
                            }}
                            className="flex-1 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-all"
                            title="Solicitar visualização de tela do aparelho ao vivo"
                          >
                            <Monitor className="w-3 h-3" />
                            <span>{station.name.includes('📱') ? '📱 Pedir Tela' : '🖥️ Pedir Tela'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => sendRemoteCommand('request-audio', station.clientId)}
                            className="flex-1 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-all"
                            title="Solicitar gravação de áudio do microfone"
                          >
                            <Mic className="w-3 h-3" /> Áudio
                          </button>
                          <button
                            type="button"
                            onClick={() => sendRemoteCommand('switch-camera', station.clientId)}
                            className="p-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 rounded-xl text-[11px] font-semibold transition-all flex items-center gap-1"
                            title="Inverter câmera deste dispositivo (Frontal / Traseira)"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => sendRemoteCommand('alert', station.clientId)}
                            className="p-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-[11px] font-semibold transition-all"
                            title="Disparar alarme sonoro nesta estação"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleKickPeer(station.clientId, station.name)}
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-[11px] font-semibold transition-all"
                            title="Desconectar usuário da rede"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 1. MURAL DE CÂMERAS & DISPOSITIVOS CONECTADOS */}
          {(() => {
            const uniqueCams = new Map();
            Object.values(surveillanceFeeds).forEach((f) => {
              const k = f.fromClientId || String(f.fromPeerId);
              uniqueCams.set(k, f);
            });
            const camList = Array.from(uniqueCams.values());

            const uniqueScreens = new Map();
            Object.values(screenFeeds).forEach((f) => {
              const k = f.fromClientId || String(f.fromPeerId);
              uniqueScreens.set(k, f);
            });
            const screenList = Array.from(uniqueScreens.values());
            const resolveLocation = (clientId: string, peerId?: number, name?: string) => {
              const st = connectedStations.find((s) => s.clientId === clientId || (peerId && s.peerId === peerId) || s.name === name);
              if (st?.location) return st.location;
              const dp = data?.peers?.find((p) => p.clientId === clientId || (peerId && p.peerId === peerId) || p.name === name);
              if (dp?.location) return dp.location;
              return {
                latitude: -23.5505,
                longitude: -46.6333,
                accuracy: 15,
                country: 'Brasil',
                countryCode: 'BR',
                flag: '🇧🇷',
                city: 'São Paulo',
                source: 'network' as const,
                timestamp: Date.now(),
              };
            };

            const cctvFeedsList: Array<{
              key: string;
              fromClientId: string;
              fromName: string;
              frameData: string;
              lastUpdated: number;
              type: 'camera' | 'screen';
              location?: GeoLocationData;
            }> = [];

            if (cctvSourceFilter === 'all' || cctvSourceFilter === 'camera') {
              camList.forEach((f) => {
                cctvFeedsList.push({
                  key: f.fromClientId || String(f.fromPeerId),
                  fromClientId: f.fromClientId,
                  fromName: f.fromName,
                  frameData: f.frameData,
                  lastUpdated: f.lastUpdated,
                  type: 'camera',
                  location: f.location || resolveLocation(f.fromClientId, f.fromPeerId, f.fromName),
                });
              });
            }

            if (cctvSourceFilter === 'all' || cctvSourceFilter === 'screen') {
              screenList.forEach((f) => {
                cctvFeedsList.push({
                  key: 'screen_' + (f.fromClientId || String(f.fromPeerId)),
                  fromClientId: f.fromClientId,
                  fromName: `${f.fromName} (Tela)`,
                  frameData: f.frameData,
                  lastUpdated: f.lastUpdated,
                  type: 'screen',
                  location: f.location || resolveLocation(f.fromClientId, f.fromPeerId, f.fromName),
                });
              });
            }

            return (
              <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Video className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-semibold text-xs text-slate-200 uppercase tracking-wider">
                      Mural CFTV em Tempo Real ({cctvFeedsList.length} Transmissões Ativas)
                    </h3>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] bg-rose-500/10 text-rose-300 border border-rose-500/30 font-semibold font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                      {cctvIsRecording ? 'CFTV GRAVANDO' : 'CFTV PAUSADO'}
                    </span>
                  </div>

                  <div className="flex items-center flex-wrap gap-2">
                    {/* Filtro de Tipo de Feed (Todos / Câmeras / Telas) */}
                    <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setCctvSourceFilter('all')}
                        className={`px-2 py-1 rounded-lg font-semibold transition-all ${
                          cctvSourceFilter === 'all'
                            ? 'bg-slate-700 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Todos ({camList.length + screenList.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCctvSourceFilter('camera')}
                        className={`px-2 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all ${
                          cctvSourceFilter === 'camera'
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Camera className="w-3 h-3" /> Câmeras ({camList.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCctvSourceFilter('screen')}
                        className={`px-2 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all ${
                          cctvSourceFilter === 'screen'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Monitor className="w-3 h-3" /> Telas ({screenList.length})
                      </button>
                    </div>

                    {/* Alternador de Modo Mosaico vs Ronda */}
                    <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setCctvViewMode('grid')}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                          cctvViewMode === 'grid'
                            ? 'bg-emerald-600 text-white shadow'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Grid className="w-3.5 h-3.5" /> Mosaico
                      </button>
                      <button
                        type="button"
                        onClick={() => setCctvViewMode('patrol')}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                          cctvViewMode === 'patrol'
                            ? 'bg-emerald-600 text-white shadow'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Tv className="w-3.5 h-3.5" /> Ronda Automática
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => recordAllActiveCameras('manual')}
                      disabled={cctvFeedsList.length === 0}
                      className="px-2.5 py-1 text-xs font-semibold rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 transition-all flex items-center gap-1.5 shadow"
                      title="Salvar um snapshot de todas as câmeras ativas imediatamente no DVR"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Salvar Todas</span>
                    </button>

                    <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setCctvIsRecording(!cctvIsRecording)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 ${
                          cctvIsRecording
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm shadow-rose-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                        }`}
                        title="Alternar gravação contínua periódica no disco local"
                      >
                        <span className={`w-2 h-2 rounded-full ${cctvIsRecording ? 'bg-rose-500 animate-pulse' : 'bg-slate-500'}`} />
                        <span>{cctvIsRecording ? 'DVR ATIVO' : 'DVR PAUSADO'}</span>
                      </button>

                      {cctvIsRecording && (
                        <select
                          value={cctvAutoRecordIntervalSec}
                          onChange={(e) => setCctvAutoRecordIntervalSec(Number(e.target.value))}
                          className="bg-slate-900 border border-slate-700 text-slate-200 text-[11px] rounded-lg px-1.5 py-0.5 focus:outline-none"
                          title="Intervalo de gravação periódica do DVR"
                        >
                          <option value={5}>5s</option>
                          <option value={10}>10s</option>
                          <option value={30}>30s</option>
                          <option value={60}>1m</option>
                        </select>
                      )}
                    </div>
                  </div>
                </div>

                {cctvFeedsList.length === 0 ? (
                  <div className="text-center py-12 px-4 bg-slate-950/80 rounded-2xl border border-slate-800/80 space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                      <Camera className="w-7 h-7" />
                    </div>
                    <div className="max-w-md mx-auto space-y-1">
                      <h4 className="text-sm font-semibold text-slate-200">
                        Nenhum feed de vídeo ou tela recebido no momento
                      </h4>
                      <p className="text-xs text-slate-400">
                        Inicie a câmera ou compartilhe a tela nos celulares/PCs da rede local. Para solicitar imediatamente, use o botão <strong>"Pedir Foto de Todos"</strong> no topo da página.
                      </p>
                    </div>
                  </div>
                ) : cctvViewMode === 'patrol' ? (
                  /* MODO RONDA AUTOMÁTICA (PATROL) */
                  (() => {
                    const activeFeed = cctvFeedsList[cctvPatrolIndex % cctvFeedsList.length] || cctvFeedsList[0];
                    return (
                      <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl space-y-3 p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                            <h4 className="font-bold text-sm text-slate-100">
                              Ronda CFTV: Feed {((cctvPatrolIndex % cctvFeedsList.length) + 1)} de {cctvFeedsList.length} — {activeFeed.fromName}
                            </h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setCctvPatrolIndex((prev) => (prev - 1 + cctvFeedsList.length) % cctvFeedsList.length)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700"
                            >
                              ◀ Anterior
                            </button>
                            <button
                              type="button"
                              onClick={() => setCctvPatrolIndex((prev) => (prev + 1) % cctvFeedsList.length)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700"
                            >
                              Próxima ▶
                            </button>
                            <button
                              type="button"
                              onClick={() => setFullscreenMedia({
                                type: activeFeed.type,
                                title: activeFeed.fromName,
                                frameData: activeFeed.frameData,
                                fromName: activeFeed.fromName,
                                fromClientId: activeFeed.fromClientId,
                                location: activeFeed.location,
                              })}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow"
                            >
                              <Maximize2 className="w-3 h-3" /> Tela Cheia
                            </button>
                          </div>
                        </div>

                        <div className="relative aspect-video max-h-[500px] w-full rounded-xl overflow-hidden bg-black flex items-center justify-center border border-slate-800">
                          <img
                            src={activeFeed.frameData}
                            alt={activeFeed.fromName}
                            className="w-full h-full object-contain"
                          />
                          <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 text-xs font-mono text-emerald-400 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                            AO VIVO • {activeFeed.fromName} • #{((cctvPatrolIndex % cctvFeedsList.length) + 1).toString().padStart(2, '0')}
                          </div>

                          {/* TAG DE LOCALIZAÇÃO GPS / PAÍS NA RONDA COM MOUSE OVER */}
                          <div className="absolute top-3 right-3 z-20 pointer-events-auto">
                            <GpsHoverBadge
                              location={activeFeed.location}
                              stationName={activeFeed.fromName}
                              buttonLabel="Ver no Mapa"
                              className="bg-slate-950/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 shadow-2xl text-xs font-mono text-emerald-300 hover:border-emerald-500/50"
                              placement="bottom"
                            />
                          </div>
                          <div className="absolute bottom-3 right-3 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => sendRemoteCommand('request-photo', activeFeed.fromClientId)}
                              className="px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 backdrop-blur shadow"
                            >
                              <Camera className="w-3.5 h-3.5" /> Pedir Foto
                            </button>
                            <button
                              type="button"
                              onClick={() => sendRemoteCommand('switch-camera', activeFeed.fromClientId)}
                              className="px-3 py-1.5 bg-purple-600/80 hover:bg-purple-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 backdrop-blur shadow"
                              title="Inverter câmera frontal/traseira deste feed"
                            >
                              <RefreshCw className="w-3.5 h-3.5" /> Inverter Câmera
                            </button>
                            <button
                              type="button"
                              onClick={() => sendRemoteCommand('alert', activeFeed.fromClientId)}
                              className="px-3 py-1.5 bg-amber-600/80 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 backdrop-blur shadow"
                            >
                              <Volume2 className="w-3.5 h-3.5" /> Alarme
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cctvFeedsList.map((feed) => (
                      <div
                        key={feed.key}
                        className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-lg flex flex-col group"
                      >
                        {/* Top bar do card */}
                        <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span className={`w-2 h-2 rounded-full animate-pulse shrink-0 ${feed.type === 'camera' ? 'bg-emerald-400' : 'bg-cyan-400'}`} />
                            <span className="font-bold text-slate-200 truncate">{feed.fromName}</span>
                            <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border font-semibold shrink-0 ${
                              feed.type === 'camera'
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                            }`}>
                              {feed.type === 'camera' ? 'CAM' : 'TELA'}
                            </span>
                            {feed.location && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                                <span>{feed.location.flag || '🇧🇷'}</span>
                                <span className="font-semibold">{feed.location.country || 'Brasil'}</span>
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {new Date(feed.lastUpdated).toLocaleTimeString('pt-BR')}
                          </span>
                        </div>

                        {/* Frame de Vídeo/Tela */}
                        <div className="relative aspect-video bg-black overflow-hidden flex items-center justify-center">
                          <img
                            src={feed.frameData}
                            alt={feed.fromName}
                            className="w-full h-full object-cover"
                          />
                          {/* Badge de Localização e Coordenadas GPS com Link no Quadro do Mosaico com Mouse Over */}
                          <div className="absolute bottom-2 left-2 z-20 pointer-events-auto">
                            <GpsHoverBadge
                              location={feed.location}
                              stationName={feed.fromName}
                              buttonLabel="Mapa"
                              className="bg-slate-950/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700/80 shadow-xl text-[11px] font-mono text-emerald-300 hover:border-emerald-500/50"
                              placement="top"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setFullscreenMedia({
                              type: feed.type,
                              title: feed.fromName,
                              frameData: feed.frameData,
                              fromName: feed.fromName,
                              fromClientId: feed.fromClientId,
                              location: feed.location,
                            })}
                            className="absolute top-2 right-2 p-1.5 bg-slate-950/80 hover:bg-slate-900 text-slate-200 rounded-lg border border-slate-700/80 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            title="Expandir para tela cheia"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Ações remotas da câmera/tela */}
                        <div className="p-3 bg-slate-900/60 border-t border-slate-800 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                const st = connectedStations.find((s) => s.clientId === feed.fromClientId) || {
                                  clientId: feed.fromClientId,
                                  name: feed.fromName,
                                };
                                handleRecordEverything(st);
                              }}
                              className="px-2.5 py-1 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all shadow-sm active:scale-95"
                              title="Gravar tudo deste usuário: Câmera + Tela + Microfone arquivados no DVR"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                              <span>🔴 Gravar Tudo</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => saveCctvSnapshot({
                                fromClientId: feed.fromClientId,
                                fromName: feed.fromName,
                                frameData: feed.frameData,
                                type: feed.type,
                              }, 'manual', 'Captura manual do mural')}
                              className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all"
                              title="Salvar gravação no DVR do Servidor agora"
                            >
                              <Camera className="w-3 h-3 text-rose-400" /> Gravar DVR
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const st = connectedStations.find((s) => s.clientId === feed.fromClientId) || {
                                  clientId: feed.fromClientId,
                                  name: feed.fromName,
                                };
                                handleOpenEmergencyPopupModal(st);
                              }}
                              className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all"
                              title="Disparar Pop-up de Alerta em tela cheia com Sirene para este usuário"
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-400" /> Popup
                            </button>
                            <button
                              type="button"
                              onClick={() => sendRemoteCommand('request-photo', feed.fromClientId)}
                              className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all"
                              title="Solicitar foto imediata"
                            >
                              <Camera className="w-3 h-3" /> Pedir Foto
                            </button>
                            <button
                              type="button"
                              onClick={() => sendRemoteCommand('switch-camera', feed.fromClientId)}
                              className="px-2.5 py-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all"
                              title="Inverter câmera (Frontal / Traseira)"
                            >
                              <RefreshCw className="w-3 h-3" /> Inverter
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (activeTalkingStation === feed.fromClientId) {
                                  handleStopAdminIntercom();
                                } else {
                                  handleStartAdminIntercom(feed.fromClientId, feed.fromName);
                                }
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all border ${
                                activeTalkingStation === feed.fromClientId
                                  ? 'bg-rose-600 text-white border-rose-400 animate-pulse'
                                  : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/40'
                              }`}
                              title="Falar ao vivo pelo microfone diretamente com este usuário"
                            >
                              <Radio className="w-3 h-3" />
                              <span>{activeTalkingStation === feed.fromClientId ? 'Falando...' : 'Falar'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSendPlaySound(feed.fromClientId, feed.fromName)}
                              className="px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all"
                              title="Tocar som individual de atenção na estação deste usuário"
                            >
                              <Volume2 className="w-3 h-3 text-amber-400" /> Som
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSendSilenceAlert(feed.fromClientId, feed.fromName)}
                              className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all"
                              title="Desligar/Silenciar alarme sonoro ativo deste usuário"
                            >
                              <VolumeX className="w-3 h-3 text-rose-400" /> Desligar
                            </button>
                          </div>

                          <a
                            href={feed.frameData}
                            download={`captura-${feed.fromName}-${Date.now()}.jpg`}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-all"
                            title="Baixar imagem capturada"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* 2. RECEPÇÃO DE ÁUDIO DO MICROFONE & GRAVAÇÕES */}
          <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileAudio className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-xs text-slate-200 uppercase tracking-wider">
                  Áudios do Microfone & Gravações Recebidas ({receivedAudios.length})
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                Player nativo com reprodução direta
              </span>
            </div>

            {receivedAudios.length === 0 ? (
              <div className="text-center py-8 px-4 bg-slate-950/80 rounded-2xl border border-slate-800/80 space-y-2">
                <Mic className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">
                  Nenhum arquivo de áudio ou gravação recebida ainda. Quando um dispositivo gravar áudio pelo microfone e enviar, ele aparecerá aqui para ser reproduzido.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {receivedAudios.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-2.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-semibold text-slate-200">
                        <Mic className="w-4 h-4 text-emerald-400" />
                        <span>{item.fromName}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(item.timestamp).toLocaleTimeString('pt-BR')}
                      </span>
                    </div>

                    <audio
                      controls
                      src={item.audioData}
                      className="w-full h-8"
                    />

                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                      <span>{item.duration ? `${item.duration}s` : 'Gravação de voz'}</span>
                      <a
                        href={item.audioData}
                        download={`audio-${item.fromName}-${Date.now()}.webm`}
                        className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" /> Baixar Áudio
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. ARQUIVOS RECEBIDOS DAS ESTAÇÕES REMOTAS */}
          <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderDown className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-xs text-slate-200 uppercase tracking-wider">
                  Arquivos Recebidos das Estações ({receivedFiles.length})
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                Acesso direto pelo Administrador
              </span>
            </div>

            {receivedFiles.length === 0 ? (
              <div className="text-center py-8 px-4 bg-slate-950/80 rounded-2xl border border-slate-800/80 space-y-2">
                <FolderDown className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">
                  Nenhum arquivo enviado pelos nós remotos até o momento.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80 rounded-2xl border border-slate-800 overflow-hidden bg-slate-950">
                {receivedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-900/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-purple-400" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-slate-200 block truncate max-w-xs md:max-w-md">
                          {file.name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {((file.size || 0) / 1024).toFixed(1)} KB • Enviado por {file.ownerName} às {new Date(file.timestamp).toLocaleTimeString('pt-BR')}
                        </span>
                      </div>
                    </div>

                    <a
                      href={file.dataUrl}
                      download={file.name}
                      className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" /> Baixar
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. GALERIA DE ALERTAS DE DETECÇÃO DE MOVIMENTO */}
          {securityAlerts.length > 0 && (
            <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <h3 className="font-semibold text-xs text-slate-200 uppercase tracking-wider">
                    Alertas Ópticos de Presença / Movimento ({securityAlerts.length})
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {securityAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden space-y-1.5 p-2"
                  >
                    {alert.snapshot ? (
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
                        <img src={alert.snapshot} alt="Alerta" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="aspect-video rounded-lg bg-slate-900 flex items-center justify-center text-slate-500">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                      </div>
                    )}
                    <div className="text-[11px] font-semibold text-slate-200 truncate">
                      {alert.fromName}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {new Date(alert.timestamp).toLocaleTimeString('pt-BR')} • {alert.detail}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
            </div>
          )}

          {/* VIEW: GERENCIADOR INTELIGENTE DE ARQUIVOS & GRAVAÇÕES CFTV */}
          {cctvSubView === 'recordings' && (
            <div className="space-y-6">
              {/* Painel Superior: Cota e Gerenciamento Inteligente de Disco */}
              <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                      <HardDrive className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                        Gerenciador Inteligente de Gravações CFTV (DVR Local)
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-semibold">
                          FIFO RETENÇÃO ATIVA
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400">
                        Armazenamento em disco sem nuvem, com proteção de favoritos e auto-purge inteligente de arquivos antigos.
                      </p>
                    </div>
                  </div>

                  {/* Ações Globais de Arquivos */}
                  <div className="flex items-center flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleOpenRecordingsFolder}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all"
                      title="Abre a pasta local 'recordings' diretamente no Windows Explorer"
                    >
                      <FolderOpen className="w-4 h-4" /> Abrir Pasta no Windows
                    </button>

                    <button
                      type="button"
                      onClick={handlePurgeUnstarred}
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-semibold rounded-xl transition-all"
                      title="Exclui gravações não favoritadas para liberar espaço no disco imediatamente"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-amber-400" /> Limpar Não-Favoritos
                    </button>

                    <button
                      type="button"
                      onClick={fetchCctvRecordings}
                      disabled={cctvLoadingRecordings}
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl transition-all"
                      title="Recarregar lista de gravações"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${cctvLoadingRecordings ? 'animate-spin' : ''}`} />
                      Atualizar
                    </button>
                  </div>
                </div>

                {/* Barra de Progresso e Métricas de Cota */}
                {cctvStats && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-3 border-t border-slate-800">
                    <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 space-y-1">
                      <span className="text-[10px] uppercase font-semibold text-slate-400">Espaço em Disco</span>
                      <div className="text-lg font-bold text-slate-100 font-mono">
                        {cctvStats.totalBytesFormatted} / {cctvStats.maxBytesFormatted}
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full ${
                            (cctvStats.totalBytes / cctvStats.maxBytes) > 0.85
                              ? 'bg-rose-500'
                              : (cctvStats.totalBytes / cctvStats.maxBytes) > 0.65
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(3, (cctvStats.totalBytes / cctvStats.maxBytes) * 100))}%` }}
                        />
                      </div>
                    </div>

                    <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 space-y-1">
                      <span className="text-[10px] uppercase font-semibold text-slate-400">Total de Gravações</span>
                      <div className="text-lg font-bold text-slate-100 font-mono">
                        {cctvStats.totalCount} / {cctvStats.maxCount} arquivos
                      </div>
                      <span className="text-[10px] text-slate-500 block truncate font-mono">
                        {cctvStats.filteredCount} exibidos na busca
                      </span>
                    </div>

                    <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 space-y-1">
                      <span className="text-[10px] uppercase font-semibold text-slate-400">Favoritos / Blindados</span>
                      <div className="text-lg font-bold text-amber-400 font-mono flex items-center gap-1.5">
                        <Star className="w-4 h-4 fill-amber-400" />
                        {cctvStats.starredCount} protegidos
                      </div>
                      <span className="text-[10px] text-slate-500 block truncate">
                        Nunca apagados pelo auto-purge
                      </span>
                    </div>

                    <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 space-y-1">
                      <span className="text-[10px] uppercase font-semibold text-slate-400">Pasta no Computador</span>
                      <div className="text-xs font-mono text-indigo-300 truncate font-semibold" title={cctvStats.recordingsDir}>
                        ...\{cctvStats.recordingsDir.split('\\').slice(-2).join('\\')}
                      </div>
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Acesso offline local 100%
                      </span>
                    </div>
                  </div>
                )}

                {/* Aviso Inteligente de Retenção */}
                <div className="p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-xl text-xs text-indigo-200 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong>Política Inteligente FIFO:</strong> Quando o armazenamento atingir 500 MB ou 500 fotos/vídeos, o DVR descarta automaticamente as capturas mais antigas sem favoritos para manter o disco desocupado. Arquivos marcados com a <strong>⭐ Estrela (Favorito)</strong> estão blindados e permanecem no computador até você apagá-los manualmente.
                  </p>
                </div>
              </div>

              {/* Barra de Filtros, Pesquisa e Ações em Lote */}
              <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center flex-wrap gap-2 flex-1 min-w-[260px]">
                  {/* Campo de Busca */}
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={cctvSearchQuery}
                      onChange={(e) => setCctvSearchQuery(e.target.value)}
                      placeholder="Buscar por câmera, data ou anotação..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Filtro por Gatilho */}
                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setCctvFilterTrigger('all')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                        cctvFilterTrigger === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setCctvFilterTrigger('motion')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
                        cctvFilterTrigger === 'motion' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <AlertTriangle className="w-3 h-3" /> Movimento
                    </button>
                    <button
                      type="button"
                      onClick={() => setCctvFilterTrigger('alarm')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
                        cctvFilterTrigger === 'alarm' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Volume2 className="w-3 h-3" /> Alarme
                    </button>
                    <button
                      type="button"
                      onClick={() => setCctvFilterTrigger('scheduled')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
                        cctvFilterTrigger === 'scheduled' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Clock className="w-3 h-3" /> Agendado
                    </button>
                    <button
                      type="button"
                      onClick={() => setCctvFilterTrigger('manual')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
                        cctvFilterTrigger === 'manual' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Camera className="w-3 h-3" /> Manual
                    </button>
                  </div>

                  {/* Filtro de Apenas Favoritos */}
                  <button
                    type="button"
                    onClick={() => setCctvFilterStarred(!cctvFilterStarred)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                      cctvFilterStarred
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${cctvFilterStarred ? 'fill-amber-400 text-amber-400' : ''}`} />
                    Apenas Favoritos
                  </button>
                </div>

                {/* Ações em Lote (Seleção Múltipla) */}
                <div className="flex items-center gap-2">
                  {cctvRecordings.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (cctvSelectedIds.length === cctvRecordings.length) {
                          setCctvSelectedIds([]);
                        } else {
                          setCctvSelectedIds(cctvRecordings.map(r => r.id));
                        }
                      }}
                      className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded-lg bg-slate-950 border border-slate-800"
                    >
                      {cctvSelectedIds.length === cctvRecordings.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                    </button>
                  )}

                  {cctvSelectedIds.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={handleDownloadSelected}
                        className="flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow"
                      >
                        <Download className="w-3 h-3" /> Baixar ({cctvSelectedIds.length})
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteSelected}
                        className="flex items-center gap-1 px-3 py-1 bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-semibold shadow"
                      >
                        <Trash2 className="w-3 h-3" /> Excluir ({cctvSelectedIds.length})
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Galeria de Gravações CFTV */}
              {cctvRecordings.length === 0 ? (
                <div className="text-center py-16 px-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                    <FolderOpen className="w-8 h-8" />
                  </div>
                  <div className="max-w-md mx-auto space-y-1">
                    <h4 className="text-sm font-semibold text-slate-200">
                      Nenhuma gravação encontrada
                    </h4>
                    <p className="text-xs text-slate-400">
                      {cctvFilterStarred || cctvFilterTrigger !== 'all' || cctvSearchQuery
                        ? 'Nenhum arquivo corresponde aos filtros aplicados. Tente limpar os filtros acima.'
                        : 'As gravações automáticas ou manuais salvas das câmeras e celulares aparecerão listadas aqui com miniaturas e metadados.'}
                    </p>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCctvSubView('live');
                          recordAllActiveCameras('manual');
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-lg"
                      >
                        <Camera className="w-4 h-4" /> Ir para Mural e Gravar Agora
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {cctvRecordings.map((rec) => {
                    const isSelected = cctvSelectedIds.includes(rec.id);
                    const recUrl = rec.url.startsWith('http') ? rec.url : `${serverUrl}${rec.url}`;

                    const triggerBadge = {
                      motion: { label: 'Movimento', icon: AlertTriangle, bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
                      alarm: { label: 'Alarme', icon: Volume2, bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
                      scheduled: { label: 'Agendado', icon: Clock, bg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' },
                      manual: { label: 'Manual', icon: Camera, bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
                    }[rec.trigger] || { label: 'Captura', icon: Camera, bg: 'bg-slate-700 text-slate-200 border-slate-600' };

                    const IconComp = triggerBadge.icon;

                    return (
                      <div
                        key={rec.id}
                        className={`bg-slate-950 rounded-2xl border transition-all overflow-hidden flex flex-col group ${
                          isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {/* Header do Card com Checkbox e Favorito */}
                        <div className="p-2.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                setCctvSelectedIds(prev =>
                                  prev.includes(rec.id) ? prev.filter(x => x !== rec.id) : [...prev, rec.id]
                                );
                              }}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-0 bg-slate-900 border-slate-700 cursor-pointer"
                            />
                            <span className="font-bold text-slate-200 truncate block text-[11px]" title={rec.clientName}>
                              {rec.clientName}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => handleToggleStar(rec.id, e)}
                              className={`p-1.5 rounded-lg border transition-all ${
                                rec.starred
                                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                                  : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-amber-400'
                              }`}
                              title={rec.starred ? 'Favoritado (Blindado contra exclusão)' : 'Favoritar (Proteger contra auto-purge)'}
                            >
                              <Star className={`w-3.5 h-3.5 ${rec.starred ? 'fill-amber-400' : ''}`} />
                            </button>
                          </div>
                        </div>

                        {/* Thumbnail com Zoom e Overlay */}
                        <div
                          onClick={() => setCctvPreviewItem(rec)}
                          className="relative aspect-video bg-black overflow-hidden cursor-pointer flex items-center justify-center"
                        >
                          <img
                            src={recUrl}
                            alt={rec.clientName}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />

                          {/* Badge de Gatilho */}
                          <div className="absolute top-2 left-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border backdrop-blur-md ${triggerBadge.bg}`}>
                              <IconComp className="w-2.5 h-2.5" />
                              {triggerBadge.label}
                            </span>
                          </div>

                          {/* Badge de Tamanho */}
                          <div className="absolute top-2 right-2">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-black/70 text-slate-300 backdrop-blur-md border border-slate-700/60">
                              {(rec.size / 1024).toFixed(0)} KB
                            </span>
                          </div>

                          {/* Botão de Ver ao passar mouse */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-semibold backdrop-blur flex items-center gap-1">
                              <Maximize2 className="w-3.5 h-3.5" /> Visualizar
                            </span>
                          </div>
                        </div>

                        {/* Informações da Gravação */}
                        <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span className="font-mono">{rec.formattedDate}</span>
                              {rec.starred && (
                                <span className="text-amber-400 font-semibold text-[9px] flex items-center gap-0.5">
                                  <Star className="w-2.5 h-2.5 fill-amber-400" /> BLINDADO
                                </span>
                              )}
                            </div>
                            {rec.note && (
                              <p className="text-[11px] text-slate-300 line-clamp-1 italic">
                                "{rec.note}"
                              </p>
                            )}
                          </div>

                          {/* Rodapé do Card com Ações */}
                          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                            <a
                              href={recUrl}
                              download={rec.filename}
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1 py-1 px-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-all"
                            >
                              <Download className="w-3 h-3" /> Baixar
                            </a>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteRecording(rec.id, e)}
                              className="p-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-[10px] font-semibold transition-all"
                              title="Excluir arquivo do disco"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal de Tela Cheia de Câmera */}
      {fullscreenFeed && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-4 sm:p-6 animate-in fade-in">
          <div className="flex items-center justify-between text-slate-200 pb-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <h3 className="text-base font-bold text-white">
                Transmissão Ao Vivo: {fullscreenFeed.fromName}
              </h3>
              {(() => {
                const loc = fullscreenFeed.location || connectedStations.find((s) => s.clientId === fullscreenFeed.fromClientId)?.location || data?.peers?.find((p) => p.clientId === fullscreenFeed.fromClientId)?.location || {
                  country: 'Brasil',
                  flag: '🇧🇷',
                  latitude: -23.5505,
                  longitude: -46.6333,
                };
                return (
                  <GpsHoverBadge
                    location={loc}
                    stationName={fullscreenFeed.fromName}
                    buttonLabel="Mapa"
                    className="px-2.5 py-1 bg-slate-800/90 rounded-xl border border-slate-700 text-xs font-mono text-emerald-300 hover:border-emerald-500/50"
                    placement="bottom"
                  />
                );
              })()}
              <span className="text-xs font-mono text-slate-400">
                Atualizado às {new Date(fullscreenFeed.lastUpdated).toLocaleTimeString('pt-BR')}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => sendRemoteCommand('request-photo', fullscreenFeed.fromClientId)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all"
              >
                <Camera className="w-3.5 h-3.5" /> Pedir Foto
              </button>
              <button
                type="button"
                onClick={() => sendRemoteCommand('switch-camera', fullscreenFeed.fromClientId)}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all"
                title="Inverter câmera frontal / traseira"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Inverter Câmera
              </button>
              <button
                type="button"
                onClick={() => sendRemoteCommand('alert', fullscreenFeed.fromClientId)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all"
              >
                <Volume2 className="w-3.5 h-3.5" /> Alarme
              </button>
              <button
                type="button"
                onClick={() => setFullscreenFeed(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-all"
              >
                Fechar
              </button>
            </div>
          </div>

          <div className="flex-1 rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-slate-800">
            <img
              src={fullscreenFeed.frameData}
              alt={fullscreenFeed.fromName}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </div>
      )}


      {/* ABA: CONTROLE PARENTAL & MODERAÇÃO FAMILIAR */}
      {activeTab === 'parental' && (
        <div className="space-y-6">
          {/* Header do Controle Parental */}
          <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Baby className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-100">
                    Central de Controle Parental & Moderação de Conteúdo
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold">
                    PROTEÇÃO ATIVA
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Defina limites de tempo de tela, horário de dormir (bedtime), bloqueio de termos e flagrante fotográfico automático.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  connectedStations.forEach((s) => {
                    handleApplyParentalPolicy(s.clientId, {
                      category: 'kids',
                      dailyLimitMinutes: 60,
                      bedtimeHour: 21,
                      autoLockOnViolation: true,
                    });
                  });
                }}
                className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                title="Aplica o Perfil Infantil em todos os computadores"
              >
                <Baby className="w-3.5 h-3.5" /> Aplicar Modo Infantil Geral
              </button>
              {parentalAlerts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setParentalAlerts([])}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Limpar Alertas ({parentalAlerts.length})
                </button>
              )}
            </div>
          </div>

          {/* Duas Colunas: Configuração por Máquina (Esquerda) e Auditoria de Infrações (Direita) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Coluna Esquerda: Seletor e Configuração de Diretriz (7 Colunas) */}
            <div className="lg:col-span-7 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-400" />
                  <h3 className="font-semibold text-xs text-slate-200 uppercase tracking-wider">
                    Configuração de Diretriz Parental
                  </h3>
                </div>
                {/* Seletor de Estação Alvo */}
                <select
                  value={selectedPolicyStationId || (connectedStations[0]?.clientId || '')}
                  onChange={(e) => setSelectedPolicyStationId(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-slate-200 rounded-xl text-xs px-3 py-1.5 focus:outline-none focus:border-purple-500"
                >
                  {connectedStations.length === 0 ? (
                    <option value="">Nenhuma máquina conectada</option>
                  ) : (
                    connectedStations.map((s) => (
                      <option key={s.clientId} value={s.clientId}>
                        {s.name} ({s.clientId.substring(0, 8)})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {(() => {
                const targetClientId = selectedPolicyStationId || (connectedStations[0]?.clientId || 'default');
                const policy = parentalPolicies[targetClientId] || {
                  clientId: targetClientId,
                  enabled: true,
                  category: 'teens',
                  dailyLimitMinutes: 120,
                  bedtimeHour: 22,
                  blockedKeywords: DEFAULT_PARENTAL_KEYWORDS,
                  autoLockOnViolation: true,
                  blurScreen: false,
                  takeScreenshotOnViolation: true,
                };

                return (
                  <div className="space-y-4 text-xs">
                    {/* Perfis Rápidos */}
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1.5">
                        Perfil de Moderação Recomendado
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => handleApplyParentalPolicy(targetClientId, {
                            category: 'kids',
                            dailyLimitMinutes: 60,
                            bedtimeHour: 21,
                            autoLockOnViolation: true,
                            blockedKeywords: [...DEFAULT_PARENTAL_KEYWORDS, 'youtube', 'tiktok'],
                          })}
                          className={`p-3 rounded-2xl border text-left transition-all ${
                            policy.category === 'kids'
                              ? 'bg-purple-600/20 border-purple-500 text-purple-200 shadow'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <div className="font-bold flex items-center gap-1.5 text-xs text-purple-300">
                            👶 Modo Criança (Kids)
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">
                            Máx 60m • Dormir às 21h • Filtro estrito
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleApplyParentalPolicy(targetClientId, {
                            category: 'teens',
                            dailyLimitMinutes: 180,
                            bedtimeHour: 23,
                            autoLockOnViolation: true,
                            blockedKeywords: DEFAULT_PARENTAL_KEYWORDS,
                          })}
                          className={`p-3 rounded-2xl border text-left transition-all ${
                            policy.category === 'teens'
                              ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <div className="font-bold flex items-center gap-1.5 text-xs text-indigo-300">
                            🧒 Adolescente (Teens)
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">
                            Máx 3h • Dormir às 23h • Anti-apostas
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleApplyParentalPolicy(targetClientId, { category: 'custom' })}
                          className={`p-3 rounded-2xl border text-left transition-all ${
                            policy.category === 'custom'
                              ? 'bg-amber-600/20 border-amber-500 text-amber-200 shadow'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <div className="font-bold flex items-center gap-1.5 text-xs text-amber-300">
                            ⚙️ Personalizado
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">
                            Ajuste livre de limites e palavras
                          </p>
                        </button>
                      </div>
                    </div>

                    {/* Controles de Tempo & Horário de Dormir */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">
                          Limite Diário de Uso:
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={15}
                            max={360}
                            step={15}
                            value={policy.dailyLimitMinutes}
                            onChange={(e) => handleApplyParentalPolicy(targetClientId, { dailyLimitMinutes: Number(e.target.value) })}
                            className="flex-1 accent-purple-500 cursor-pointer"
                          />
                          <span className="font-mono text-purple-400 font-bold w-16 text-right">
                            {policy.dailyLimitMinutes} min
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">
                          Horário Limite Noturno (Bedtime):
                        </label>
                        <select
                          value={policy.bedtimeHour}
                          onChange={(e) => handleApplyParentalPolicy(targetClientId, { bedtimeHour: Number(e.target.value) })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-200"
                        >
                          <option value={20}>20:00 (Oito da noite)</option>
                          <option value={21}>21:00 (Nove da noite)</option>
                          <option value={22}>22:00 (Dez da noite)</option>
                          <option value={23}>23:00 (Onze da noite)</option>
                          <option value={0}>00:00 (Meia-noite)</option>
                        </select>
                      </div>
                    </div>

                    {/* Editor de Palavras-Chave Bloqueadas (Blacklist) */}
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1.5">
                        Palavras-Chave e Termos Proibidos ({policy.blockedKeywords?.length || 0})
                      </label>
                      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-950 rounded-2xl border border-slate-800">
                        {(policy.blockedKeywords || []).map((kw, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px]"
                          >
                            <span>{kw}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const next = policy.blockedKeywords.filter((k) => k !== kw);
                                handleApplyParentalPolicy(targetClientId, { blockedKeywords: next });
                              }}
                              className="text-rose-400 hover:text-white text-xs font-bold"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="text"
                          value={newKeywordInput}
                          onChange={(e) => setNewKeywordInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newKeywordInput.trim()) {
                              const word = newKeywordInput.trim().toLowerCase();
                              if (!policy.blockedKeywords.includes(word)) {
                                handleApplyParentalPolicy(targetClientId, {
                                  blockedKeywords: [...policy.blockedKeywords, word],
                                });
                              }
                              setNewKeywordInput('');
                            }
                          }}
                          placeholder="Adicionar novo termo bloqueado (ex: cassino, gore)..."
                          className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!newKeywordInput.trim()) return;
                            const word = newKeywordInput.trim().toLowerCase();
                            if (!policy.blockedKeywords.includes(word)) {
                              handleApplyParentalPolicy(targetClientId, {
                                blockedKeywords: [...policy.blockedKeywords, word],
                              });
                            }
                            setNewKeywordInput('');
                          }}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold shadow"
                        >
                          + Adicionar
                        </button>
                      </div>
                    </div>

                    {/* Ações Automáticas */}
                    <div className="space-y-2 pt-1 border-t border-slate-800/80">
                      <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={policy.autoLockOnViolation}
                          onChange={(e) => handleApplyParentalPolicy(targetClientId, { autoLockOnViolation: e.target.checked })}
                          className="rounded accent-purple-500"
                        />
                        <span>Bloquear tela do computador imediatamente em caso de tentativa de acesso impróprio</span>
                      </label>
                      <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={policy.takeScreenshotOnViolation}
                          onChange={(e) => handleApplyParentalPolicy(targetClientId, { takeScreenshotOnViolation: e.target.checked })}
                          className="rounded accent-purple-500"
                        />
                        <span>Capturar screenshot da tela como evidência para o painel do administrador</span>
                      </label>
                    </div>

                    {/* Botões de Ação na Estação */}
                    <div className="pt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleApplyParentalPolicy(targetClientId, {})}
                        className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold uppercase tracking-wider text-xs shadow-lg shadow-purple-900/30 flex items-center justify-center gap-1.5 transition-all"
                      >
                        <CheckCircle className="w-4 h-4" /> Salvar & Transmitir Diretriz
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEmergencyParentalLock(targetClientId)}
                        className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold uppercase tracking-wider text-xs shadow-lg shadow-rose-900/30 flex items-center justify-center gap-1.5 transition-all"
                        title="Bloquear imediatamente a máquina selecionada"
                      >
                        <Lock className="w-4 h-4" /> Bloqueio de Emergência
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Coluna Direita: Auditoria & Histórico de Violações com Flagrantes (5 Colunas) */}
            <div className="lg:col-span-5 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4 flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <AlertOctagon className="w-5 h-5 text-rose-400" />
                  <h3 className="font-semibold text-xs text-slate-200 uppercase tracking-wider">
                    Alertas & Flagrantes Registrados ({parentalAlerts.length})
                  </h3>
                </div>
              </div>

              {parentalAlerts.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-center space-y-2">
                  <ShieldCheck className="w-10 h-10 text-emerald-400/60 mx-auto" />
                  <h4 className="text-sm font-semibold text-slate-200">
                    Nenhuma violação registrada
                  </h4>
                  <p className="text-xs text-slate-500 max-w-xs">
                    Todas as estações monitoradas estão em conformidade com as diretrizes de moderação parental.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[580px] pr-1">
                  {parentalAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="p-3 bg-slate-950 rounded-2xl border border-rose-500/30 space-y-2 shadow"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-200 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                          {alert.stationName}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(alert.timestamp).toLocaleTimeString('pt-BR')}
                        </span>
                      </div>

                      <div className="text-xs text-rose-300">
                        {alert.reason}
                        {alert.termFound && (
                          <span className="ml-1 px-1.5 py-0.2 bg-rose-500/20 text-rose-200 font-bold rounded">
                            "{alert.termFound}"
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] text-slate-400">
                        Ação: <span className="text-slate-300 font-semibold">{alert.actionTaken}</span>
                      </div>

                      {alert.snapshot && (
                        <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-slate-800">
                          <img
                            src={alert.snapshot}
                            alt="Evidência da infração"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setFullscreenMedia({
                              type: 'screen',
                              title: `Flagrante: ${alert.stationName}`,
                              frameData: alert.snapshot!,
                              fromName: alert.stationName,
                            })}
                            className="absolute top-1.5 right-1.5 p-1 bg-black/80 hover:bg-black text-white rounded text-[10px] flex items-center gap-1"
                          >
                            <Maximize2 className="w-3 h-3" /> Ver Prova
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ABA 1: TELEMETRIA & REDE */}
      {activeTab === 'telemetry' && (
        <div className="space-y-6">
          {/* Grid de KPIs Principais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* KPI 1: Uptime */}
            <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-4 shadow-xl">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Uptime do Servidor</span>
                <Clock className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-xl font-bold text-slate-100 font-mono">
                {data ? formatUptime(data.server.uptimeSeconds) : '--'}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Desde {data ? new Date(data.server.startedAt).toLocaleTimeString('pt-BR') : '--'}
              </span>
            </div>

            {/* KPI 2: Usuários Online */}
            <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-4 shadow-xl">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Usuários Ativos</span>
                <Users className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-bold text-emerald-400 font-mono">
                {data ? data.traffic.activePeersCount : '--'}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Pico de concorrência: {data?.traffic.peakConcurrency || 0}
              </span>
            </div>

            {/* KPI 3: Total de Mensagens */}
            <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-4 shadow-xl">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Mensagens Processadas</span>
                <Activity className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-xl font-bold text-purple-400 font-mono">
                {data ? data.traffic.totalMessagesRelayed : '--'}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {data ? data.traffic.totalConnections : 0} conexões no total
              </span>
            </div>

            {/* KPI 4: Dados Transferidos */}
            <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-4 shadow-xl">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Tráfego de Dados</span>
                <HardDrive className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl font-bold text-amber-400 font-mono">
                {data ? formatBytes(data.traffic.totalBytesTransferred) : '--'}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                RAM Heap: {data ? formatBytes(data.system.memory.heapUsedBytes) : '--'}
              </span>
            </div>
          </div>

          {/* Gráficos de Telemetria */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-xs text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  <span>Distribuição de Tráfego por Tipo</span>
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">
                  Total: {data?.traffic.totalMessagesRelayed || 0}
                </span>
              </div>

              <div className="h-56 w-full">
                {messageDistributionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={messageDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {messageDistributionData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '0.75rem',
                          fontSize: '12px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    Nenhuma mensagem processada ainda para gerar gráfico.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-xs text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <span>Consumo de Memória (Node.js)</span>
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">
                  {data?.system.platform} ({data?.system.arch}) • {data?.system.nodeVersion}
                </span>
              </div>

              <div className="h-56 w-full">
                {memoryChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={memoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} unit="MB" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '0.75rem',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="MB" fill="#10b981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    Carregando métricas de memória...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Painel Especial de Geolocalização por GPS & Distribuição Geográfica de Países */}
          <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold text-sm text-slate-100 flex items-center gap-2">
                  <span>Geolocalização por GPS & País de Origem dos Usuários</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                    GPS AO VIVO
                  </span>
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {data?.peers.filter((p) => p.location?.source === 'gps').length || 0} de {data?.peers.length || 0} estações com sinal de satélite ativo
              </span>
            </div>

            {/* Resumo de Países Detectados */}
            {data?.peers && data.peers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.peers.map((peer) => {
                  const loc = peer.location;
                  const isGps = loc?.source === 'gps';
                  const countryName = loc?.country || 'Brasil';
                  const countryFlag = loc?.flag || '🇧🇷';
                  const lat = loc ? loc.latitude : -23.5505;
                  const lon = loc ? loc.longitude : -46.6333;

                  return (
                    <div
                      key={peer.clientId}
                      className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl" title={countryName}>
                            {countryFlag}
                          </span>
                          <div>
                            <div className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: peer.color }} />
                              <span>{peer.name}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {countryName} {loc?.city ? `• ${loc.city}` : ''}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                            isGps
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                          }`}
                        >
                          {isGps ? '🛰️ SINAL GPS' : '🌐 REDE / LAN'}
                        </span>
                      </div>

                      <div className="space-y-1.5 pt-1 border-t border-slate-900">
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                          <span>Coordenadas:</span>
                          <span className="text-slate-200 font-semibold">
                            {lat.toFixed(5)}, {lon.toFixed(5)}
                          </span>
                        </div>
                        {loc?.accuracy && (
                          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                            <span>Precisão GPS:</span>
                            <span className="text-emerald-400 font-semibold">±{loc.accuracy} metros</span>
                          </div>
                        )}
                        {loc?.speed !== null && loc?.speed !== undefined && (
                          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                            <span>Velocidade:</span>
                            <span className="text-amber-400 font-semibold">{loc.speed} km/h</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <a
                          href={getGoogleMapsUrl(lat, lon)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-1.5 px-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-[10px] font-bold text-center flex items-center justify-center gap-1 transition-all"
                        >
                          <MapPin className="w-3 h-3 text-indigo-400" />
                          <span>Google Maps</span>
                        </a>
                        <a
                          href={getOpenStreetMapUrl(lat, lon)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-[10px] font-bold text-center flex items-center justify-center gap-1 transition-all"
                        >
                          <Navigation className="w-3 h-3 text-emerald-400" />
                          <span>OpenStreetMap</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 bg-slate-950/60 rounded-xl border border-slate-800 text-center space-y-1">
                <Globe className="w-6 h-6 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">Nenhum usuário conectado para exibir telemetria de GPS e país.</p>
              </div>
            )}
          </div>

          {/* Tabela de Usuários Conectados com Ações de Kick e Ban */}
          <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-sm text-slate-100">
                  Sessões e Usuários Conectados ({data?.peers.length || 0})
                </h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-medium">
                    <th className="py-2.5 px-3">Usuário</th>
                    <th className="py-2.5 px-3">Client ID</th>
                    <th className="py-2.5 px-3">IP Remoto</th>
                    <th className="py-2.5 px-3">📍 País & GPS</th>
                    <th className="py-2.5 px-3">Ping (RTT)</th>
                    <th className="py-2.5 px-3">Msgs / Tráfego</th>
                    <th className="py-2.5 px-3">Dispositivo</th>
                    <th className="py-2.5 px-3 text-right">Ações Defensivas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {!data?.peers || data.peers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        Nenhum usuário conectado no momento.
                      </td>
                    </tr>
                  ) : (
                    data.peers.map((peer) => {
                      const cleanIp = peer.remoteAddress.replace(/^.*:/, '');
                      const loc = peer.location;
                      return (
                        <tr key={peer.clientId} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3 flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: peer.color }} />
                            <span className="font-semibold text-slate-200">{peer.name}</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-400">
                            <div className="flex items-center gap-1.5">
                              <span>{peer.clientId.slice(0, 10)}...</span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(peer.clientId);
                                  setCopiedId(peer.clientId);
                                  setTimeout(() => setCopiedId(null), 1500);
                                }}
                                className="text-slate-500 hover:text-slate-300"
                              >
                                {copiedId === peer.clientId ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-300">
                            {cleanIp}
                          </td>
                          <td className="py-2.5 px-3">
                            {loc ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 font-semibold text-slate-100">
                                  <span className="text-sm">{loc.flag || '🌐'}</span>
                                  <span>{loc.country || 'Brasil'}</span>
                                  {loc.city && (
                                    <span className="text-[10px] text-slate-400 font-normal">({loc.city})</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 flex-wrap">
                                  <span className="bg-slate-800/80 px-1 py-0.5 rounded text-slate-300">
                                    {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                                  </span>
                                  {loc.accuracy && (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                                      ±{loc.accuracy}m
                                    </span>
                                  )}
                                  <GpsHoverBadge
                                    location={loc}
                                    stationName={peer.name}
                                    buttonLabel="Mapa"
                                    showCoordinates={false}
                                    placement="bottom"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1 text-slate-300 font-medium">
                                  <span>🇧🇷 Brasil</span>
                                  <span className="text-[10px] text-slate-500 font-mono">(LAN)</span>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono">GPS Standby</span>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            {peer.latency !== null ? (
                              <span
                                className={`font-semibold ${
                                  peer.latency < 50
                                    ? 'text-emerald-400'
                                    : peer.latency < 150
                                    ? 'text-amber-400'
                                    : 'text-rose-400'
                                }`}
                              >
                                {peer.latency} ms
                              </span>
                            ) : (
                              <span className="text-slate-500">--</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-300">
                            {peer.messagesSent} msgs • {formatBytes(peer.bytesSent)}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-400 max-w-[180px] truncate" title={peer.userAgent}>
                            {peer.userAgent}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleKickPeer(peer.clientId, peer.name)}
                                className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1"
                                title="Desconectar cliente imediatamente"
                              >
                                <UserX className="w-3 h-3" /> Kick
                              </button>
                              <button
                                type="button"
                                onClick={() => handleBanIp(cleanIp, `Banido via sessão ativa (${peer.name})`, 60)}
                                className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1"
                                title="Banir este IP na lista negra e derrubar conexão"
                              >
                                <Ban className="w-3 h-3" /> Banir IP
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Broadcast & Eventos */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-rose-400" />
                <h3 className="font-semibold text-xs text-slate-200 uppercase tracking-wider">
                  Transmissão Global do Sistema (Broadcast)
                </h3>
              </div>
              <textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Digite o comunicado do administrador..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 font-mono resize-none focus:outline-none focus:border-rose-500 transition-colors"
              />
              <button
                type="button"
                onClick={handleBroadcast}
                disabled={!broadcastMessage.trim()}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-md transition-all"
              >
                <Send className="w-4 h-4" /> Enviar Aviso a Todos
              </button>
              {broadcastStatus && (
                <div className="p-2.5 bg-slate-950 border border-emerald-500/40 rounded-xl text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> {broadcastStatus}
                </div>
              )}
            </div>

            <div className="lg:col-span-7 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-xs text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span>Log de Eventos de Rede & Conexões</span>
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">
                  Últimos {data?.recentEvents.length || 0} eventos
                </span>
              </div>

              <div className="h-44 overflow-y-auto bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] space-y-1.5">
                {!data?.recentEvents || data.recentEvents.length === 0 ? (
                  <div className="text-slate-500 text-center py-4">Nenhum evento registrado ainda.</div>
                ) : (
                  data.recentEvents.slice().reverse().map((ev, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-slate-500 shrink-0">
                        [{new Date(ev.ts).toLocaleTimeString('pt-BR')}]
                      </span>
                      <span
                        className={`font-semibold shrink-0 uppercase text-[10px] px-1 py-0.2 rounded ${
                          ev.type === 'join'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : ev.type === 'leave'
                            ? 'bg-amber-500/20 text-amber-300'
                            : ev.type.startsWith('security')
                            ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40'
                            : 'bg-indigo-500/20 text-indigo-300'
                        }`}
                      >
                        {ev.type}
                      </span>
                      <span className="text-slate-300 truncate">{ev.detail}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: CENTRAL DE DEFESA BLUE TEAM & BLOQUEIO DE IPS */}
      {activeTab === 'defense' && (
        <div className="space-y-6">
          {/* Card de Configuração e Status da Autenticação 2FA TOTP */}
          <div className="bg-slate-900/80 backdrop-blur-xl border border-amber-500/30 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${
                  totpEnabled
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                }`}>
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                      Autenticação em Dois Fatores (2FA TOTP Offline)
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      totpEnabled
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/50'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {totpEnabled ? 'PROTEÇÃO ATIVA' : 'DESATIVADO'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Padrão RFC 6238 compatível com Google Authenticator, Authy, Proton Authenticator e 1Password. 100% offline sem internet.
                  </p>
                </div>
              </div>

              {!totpEnabled && !totpSetupPending && (
                <button
                  type="button"
                  onClick={handleTotpSetup}
                  disabled={totpLoading}
                  className="px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer"
                >
                  {totpLoading ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Gerando Chave...</>
                  ) : (
                    <><ShieldCheck className="w-4 h-4" /> Configurar 2FA Agora</>
                  )}
                </button>
              )}
            </div>

            {/* Mensagem de Feedback */}
            {totpMessage && (
              <div className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
                totpMessage.type === 'ok'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
              }`}>
                {totpMessage.type === 'ok' ? <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />}
                <span>{totpMessage.text}</span>
              </div>
            )}

            {/* Fluxo de Configuração do Setup Pendente (QR Code + Chave + Confirmação) */}
            {!totpEnabled && totpSetupPending && totpSecret && (
              <div className="p-5 bg-slate-950/80 rounded-2xl border border-amber-500/30 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  {/* Lado Esquerdo: Imagem do QR Code gerado */}
                  <div className="flex flex-col items-center text-center p-4 bg-slate-900/60 rounded-2xl border border-slate-800">
                    <span className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <QrCode className="w-4 h-4" /> 1. Escaneie com seu Celular
                    </span>
                    {totpQrDataUrl ? (
                      <div className="p-3 bg-white rounded-2xl shadow-xl">
                        <img src={totpQrDataUrl} alt="QR Code TOTP" className="w-48 h-48 block" />
                      </div>
                    ) : (
                      <div className="w-48 h-48 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-500 text-xs">
                        Carregando QR Code...
                      </div>
                    )}
                    <p className="text-[11px] text-slate-400 mt-3 max-w-xs">
                      Abra o <strong>Google Authenticator</strong> ou <strong>Authy</strong> no seu celular e aponte a câmera para o QR Code acima.
                    </p>
                  </div>

                  {/* Lado Direito: Chave Secreta manual e Confirmação com código */}
                  <div className="space-y-4">
                    <div>
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                        <Key className="w-4 h-4 text-amber-400" /> 2. Chave Secreta Manual
                      </span>
                      <div className="flex items-center gap-2 bg-slate-900 px-3 py-2.5 rounded-xl border border-slate-800">
                        <code className="flex-1 text-xs font-mono text-amber-200 break-all select-all">{totpSecret}</code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(totpSecret);
                            setTotpMessage({ type: 'ok', text: 'Chave secreta copiada para a área de transferência!' });
                          }}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1 shrink-0 font-medium transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copiar
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                        3. Digite o Código de 6 dígitos gerado
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={totpConfirmCode}
                        onChange={(e) => setTotpConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl px-4 py-3 text-emerald-300 placeholder-slate-600 font-mono text-center text-xl tracking-[0.5em] focus:outline-none transition-all shadow-inner"
                      />
                    </div>

                    <div className="flex items-center gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={handleTotpEnable}
                        disabled={totpLoading || totpConfirmCode.length !== 6}
                        className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        {totpLoading ? (
                          <><RefreshCw className="w-4 h-4 animate-spin" /> Validando...</>
                        ) : (
                          <><CheckCircle className="w-4 h-4" /> Validar e Ativar 2FA</>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setTotpSetupPending(false);
                          setTotpSecret('');
                          setTotpUri('');
                          setTotpQrDataUrl('');
                          setTotpConfirmCode('');
                          setTotpMessage(null);
                        }}
                        className="px-3.5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Painel Quando 2FA Já Está Ativo */}
            {totpEnabled && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-emerald-300 block">
                      Proteção Dupla em Vigor
                    </span>
                    <p className="text-[11px] text-slate-400">
                      O acesso ao painel SOC do administrador requer senha mestra e código gerado pelo aplicativo autenticador a cada 30 segundos.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="password"
                    value={totpDisablePassword}
                    onChange={(e) => setTotpDisablePassword(e.target.value)}
                    placeholder="Senha para desativar..."
                    className="w-44 bg-slate-950 border border-slate-700 focus:border-rose-500 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 font-mono focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleTotpDisable}
                    disabled={totpLoading || !totpDisablePassword.trim()}
                    className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {totpLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Unlock className="w-3.5 h-3.5" />}
                    <span>Desativar</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Métricas de Defesa Cibernética */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-2xl shadow-lg">
              <span className="text-[11px] text-slate-400 font-medium block">Requisições Bloqueadas</span>
              <div className="text-xl font-bold font-mono text-rose-400 mt-1">
                {securityData?.stats.blockedRequests || 0}
              </div>
              <span className="text-[10px] text-slate-500">Filtradas no WAF</span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-2xl shadow-lg">
              <span className="text-[11px] text-slate-400 font-medium block">IPs em Quarentena</span>
              <div className="text-xl font-bold font-mono text-amber-400 mt-1">
                {securityData?.bannedIps.length || 0}
              </div>
              <span className="text-[10px] text-slate-500">Na Blacklist</span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-2xl shadow-lg">
              <span className="text-[11px] text-slate-400 font-medium block">Violações Anti-DDoS</span>
              <div className="text-xl font-bold font-mono text-purple-400 mt-1">
                {securityData?.stats.rateLimitViolations || 0}
              </div>
              <span className="text-[10px] text-slate-500">Rate Limiter ativo</span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-2xl shadow-lg">
              <span className="text-[11px] text-slate-400 font-medium block">Intrusões Mitigadas</span>
              <div className="text-xl font-bold font-mono text-rose-400 mt-1">
                {securityData?.stats.intrusionsDetected || 0}
              </div>
              <span className="text-[10px] text-slate-500">Scanners & Exploits</span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-2xl shadow-lg">
              <span className="text-[11px] text-slate-400 font-medium block">Conexões no Tarpit</span>
              <div className="text-xl font-bold font-mono text-indigo-400 mt-1">
                {securityData?.stats.tarpittedConnections || 0}
              </div>
              <span className="text-[10px] text-slate-500">Sockets retidos</span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-2xl shadow-lg">
              <span className="text-[11px] text-slate-400 font-medium block">Falhas de Senha</span>
              <div className="text-xl font-bold font-mono text-slate-200 mt-1">
                {securityData?.stats.failedLogins || 0}
              </div>
              <span className="text-[10px] text-slate-500">Fail2Ban vigiando</span>
            </div>
          </div>

          {/* Card Prioritário: Controle de Acesso por Número de Usuários & Salvaguardas Administrativas */}
          <div className="bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-indigo-950/40 backdrop-blur-xl border border-indigo-500/30 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center shadow-inner">
                  <Users className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-100">
                      Controle de Acesso por Número de Usuários
                    </h3>
                    <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold uppercase tracking-wider">
                      ADMIN ISENTO
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Defina e acione o limite de lotação simultânea de estações conectadas ao servidor.
                  </p>
                </div>
              </div>

              {/* Botões de Ação Imediata de Quarentena */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleUnbanSelf}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all shadow-sm"
                  title="Garante que seu IP local nunca esteja bloqueado"
                >
                  <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Desbloquear Meu IP</span>
                </button>
                <button
                  type="button"
                  onClick={handleUnbanAllIps}
                  disabled={unbanningAll}
                  className="px-3 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-semibold rounded-xl border border-rose-500/30 flex items-center gap-1.5 transition-all shadow-sm"
                  title="Remove todos os IPs da lista negra"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${unbanningAll ? 'animate-spin' : ''}`} />
                  <span>Limpar Quarentena Geral</span>
                </button>
              </div>
            </div>

            {/* Aviso de Isenção do Administrador */}
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-start gap-3 text-xs text-emerald-300">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-emerald-200 block">Privilégio Mestre Garantido:</span>
                <span>
                  O Administrador (computador local e conexões autenticadas) <strong>nunca é bloqueado</strong> por limite de conexões ou lista negra de IP. Mesmo com capacidade cheia, o painel do administrador entra imediatamente com vaga mestre prioritária.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Opção 1: Acionar por Número de Usuários */}
              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-400" />
                    Acionar Limite de Usuários
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={serverConfig.enableUserLimit}
                      onChange={(e) => {
                        const updated = { ...serverConfig, enableUserLimit: e.target.checked };
                        setServerConfig(updated);
                        handleSaveServerConfig({ enableUserLimit: e.target.checked });
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
                  </label>
                </div>
                <p className="text-[11px] text-slate-400">
                  {serverConfig.enableUserLimit
                    ? 'Ativado: Novas estações serão pausadas quando o número máximo for atingido.'
                    : 'Desativado: O servidor aceita novas conexões sem barreira de quantidade.'}
                </p>
                <div className="pt-1">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      serverConfig.enableUserLimit
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {serverConfig.enableUserLimit ? '● RESTRIÇÃO POR USUÁRIOS ATIVA' : '○ ENTRADA LIVRE (SEM TRAVA)'}
                  </span>
                </div>
              </div>

              {/* Opção 2: Quantidade Máxima Permitida */}
              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Capacidade Máxima Permitida
                  </span>
                  <span className="font-mono text-sm font-bold text-indigo-400">
                    {serverConfig.maxUsersLimit} usuários
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={serverConfig.maxUsersLimit}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                      setServerConfig((prev) => ({ ...prev, maxUsersLimit: val }));
                    }}
                    className="flex-1 bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono text-center focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveServerConfig({ maxUsersLimit: serverConfig.maxUsersLimit })}
                    disabled={savingServerConfig}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all shrink-0"
                  >
                    {savingServerConfig ? 'Salvando...' : 'Aplicar'}
                  </button>
                </div>

                {/* Seleção Rápida de Capacidade */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {[5, 10, 20, 30, 50, 100].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setServerConfig((prev) => ({ ...prev, maxUsersLimit: preset }));
                        handleSaveServerConfig({ maxUsersLimit: preset });
                      }}
                      className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
                        serverConfig.maxUsersLimit === preset
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Opção 3: Bloqueio Automático de IP (Fail2Ban) */}
              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Shield className="w-4 h-4 text-rose-400" />
                    Bloqueio Automático por IP
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={serverConfig.autoIpBanEnabled}
                      onChange={(e) => {
                        const updated = { ...serverConfig, autoIpBanEnabled: e.target.checked };
                        setServerConfig(updated);
                        handleSaveServerConfig({ autoIpBanEnabled: e.target.checked });
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600" />
                  </label>
                </div>
                <p className="text-[11px] text-slate-400">
                  {serverConfig.autoIpBanEnabled
                    ? 'Ativado: IPs com tentativas repetidas são colocados na quarentena por 30min.'
                    : 'Desativado (Recomendado): Evita que computadores da rede sejam trancados na lista negra.'}
                </p>
                <div className="pt-1">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      serverConfig.autoIpBanEnabled
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {serverConfig.autoIpBanEnabled ? '● FAIL2BAN ATIVO' : '● PROTEÇÃO SEGURA (SEM BANIMENTO CEGO)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Barra de Lotação em Tempo Real */}
            <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Lotação do Servidor em Tempo Real:
                </span>
                <span className="font-mono text-slate-200">
                  <strong>{connectedStations.length}</strong> estações ativas /{' '}
                  <span className="text-indigo-400">
                    {serverConfig.enableUserLimit ? `${serverConfig.maxUsersLimit} vagas` : 'Ilimitado'}
                  </span>
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-500 ${
                    connectedStations.length >= serverConfig.maxUsersLimit && serverConfig.enableUserLimit
                      ? 'bg-rose-500'
                      : connectedStations.length >= (serverConfig.maxUsersLimit * 0.8) && serverConfig.enableUserLimit
                      ? 'bg-amber-500'
                      : 'bg-gradient-to-r from-indigo-500 to-emerald-400'
                  }`}
                  style={{
                    width: serverConfig.enableUserLimit
                      ? `${Math.min(100, Math.round((connectedStations.length / serverConfig.maxUsersLimit) * 100))}%`
                      : '15%',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Formulário de Banimento Manual de IP & Gerador de Senha */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <Ban className="w-5 h-5 text-rose-400" />
                <h3 className="font-semibold text-xs text-slate-200 uppercase tracking-wider">
                  Bloquear Endereço IP Manualmente (Blacklist / Quarentena)
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                Bloqueia imediatamente qualquer acesso HTTP e fecha conexões WebSocket ativas provenientes deste IP.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                    Endereço IP Alvo
                  </label>
                  <input
                    type="text"
                    value={manualIp}
                    onChange={(e) => setManualIp(e.target.value)}
                    placeholder="Ex: 192.168.1.150 ou 203.0.113.1"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                    Duração do Bloqueio
                  </label>
                  <select
                    value={manualDuration}
                    onChange={(e) => setManualDuration(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-rose-500"
                  >
                    <option value="15">15 Minutos (Temporário)</option>
                    <option value="60">1 Hora (Padrão)</option>
                    <option value="1440">24 Horas (Dia inteiro)</option>
                    <option value="0">Permanente (Até remoção manual)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                  Motivo da Aplicação da Sanção
                </label>
                <input
                  type="text"
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  placeholder="Motivo do bloqueio..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!manualIp.trim()) {
                    alert('Por favor, informe o IP.');
                    return;
                  }
                  const dur = manualDuration === '0' ? null : parseInt(manualDuration, 10);
                  handleBanIp(manualIp.trim(), manualReason.trim(), dur);
                }}
                disabled={!manualIp.trim()}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
              >
                <Ban className="w-4 h-4" /> Adicionar IP à Blacklist de Defesa
              </button>
            </div>

            {/* Gerador de Senhas Seguras Blue Team */}
            <div className="lg:col-span-5 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-semibold text-xs text-slate-200 uppercase tracking-wider">
                    Gerador de Senha Criptográfica
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setGeneratorPassword(generateRandomSecurePassword(28));
                    setCopiedGenPassword(false);
                  }}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Gerar Nova
                </button>
              </div>

              <p className="text-[11px] text-slate-400">
                Gere novas chaves mestras de alta entropia para substituição de credenciais e auditoria de segurança.
              </p>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between font-mono text-xs text-emerald-300">
                  <span className="truncate mr-2">{generatorPassword}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generatorPassword);
                      setCopiedGenPassword(true);
                      setTimeout(() => setCopiedGenPassword(false), 2000);
                    }}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1 shrink-0"
                  >
                    {copiedGenPassword ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedGenPassword ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
                <div className="text-[10px] text-slate-500 flex items-center justify-between">
                  <span>Comprimento: {generatorPassword.length} caracteres</span>
                  <span className="text-emerald-400 font-semibold">Entropia: Forte (Blue Team Shield)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabela de IPs Bloqueados na Blacklist */}
          <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-rose-400" />
                <h3 className="font-semibold text-sm text-slate-100">
                  Lista Negra de IPs em Quarentena ({securityData?.bannedIps?.length || 0})
                </h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-medium">
                    <th className="py-2.5 px-3">Endereço IP</th>
                    <th className="py-2.5 px-3">Origem do Bloqueio</th>
                    <th className="py-2.5 px-3">Motivo / Diagnóstico</th>
                    <th className="py-2.5 px-3">Data do Bloqueio</th>
                    <th className="py-2.5 px-3">Expiração</th>
                    <th className="py-2.5 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {!securityData?.bannedIps || securityData.bannedIps.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Nenhum IP bloqueado no momento. Sistema operando sem ameaças ativas.
                      </td>
                    </tr>
                  ) : (
                    securityData.bannedIps.map((b) => (
                      <tr key={b.ip} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-rose-300">
                          {b.ip}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              b.auto
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            }`}
                          >
                            {b.auto ? '🤖 Fail2Ban Automático' : '👤 Administrador'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 max-w-[280px] truncate" title={b.reason}>
                          {b.reason}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 font-mono">
                          {new Date(b.bannedAt).toLocaleTimeString('pt-BR')}
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          {b.expiresAt ? (
                            <span className="text-amber-400">
                              Até {new Date(b.expiresAt).toLocaleTimeString('pt-BR')}
                            </span>
                          ) : (
                            <span className="text-rose-400 font-semibold">Permanente</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleUnbanIp(b.ip)}
                            className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1"
                          >
                            <Unlock className="w-3 h-3" /> Desbloquear
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Doutrina Blue Team & Mitigação Defensiva */}
          <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              <h3 className="font-semibold text-xs text-slate-200 uppercase tracking-wider">
                Doutrina Blue Team: Por que usamos Tarpit & Fail2Ban em vez de 'Hack-Back'
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400 pt-1">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1">
                <span className="font-semibold text-slate-200 block">🛑 Defensive Tarpit (Teergrube)</span>
                <p className="text-[11px] text-slate-400">
                  Em vez de tentar infectar o atacante (o que é ilegal e ineficaz contra proxies), o servidor retém
                  a conexão do scanner transmitindo 1 byte a cada poucos segundos. Isso esgota as conexões do invasor
                  sem consumir recursos do nosso servidor.
                </p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1">
                <span className="font-semibold text-slate-200 block">🛡️ Defesa contra Buffer Overflow</span>
                <p className="text-[11px] text-slate-400">
                  O servidor bloqueia corpos de requisição maiores que 64KB no nível de socket antes de alocar na RAM,
                  impedindo estouro de buffer, Memory Leak ou ataque de negação de serviço (DoS) direcionado ao servidor.
                </p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1">
                <span className="font-semibold text-slate-200 block">⚡ Fail2Ban & Rate Limiter</span>
                <p className="text-[11px] text-slate-400">
                  Qualquer tentativa de força bruta na senha é cortada na 5ª tentativa. Varreduras de vulnerabilidades
                  conhecidas (WAF) resultam em quarentena instantânea por 1 hora.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 6: CONTENÇÃO ZERO-TRUST, RESPOSTA A INCIDENTES E SOC */}
      {activeTab === 'containment' && (
        <AdminContainmentView
          connectedStations={connectedStations}
          securityData={securityData}
          serverUrl={serverUrl}
          token={token}
          adminWs={adminWsRef.current}
          onRefresh={fetchTelemetry}
          onSendEmergencyPopup={(targetClientId, title, message) => {
            setEmergencyTargetStation(connectedStations.find((s) => s.clientId === targetClientId) || null);
            setEmergencyTitle(title);
            setEmergencyMessage(message);
            setIsEmergencyPopupModalOpen(true);
          }}
        />
      )}

      {/* ABA 7: COPILOT IA & ALIADO SOC TÁTICO */}
      {activeTab === 'ai_copilot' && (
        <AdminAiCopilotView
          connectedStations={connectedStations}
          securityData={securityData}
          serverUrl={serverUrl}
          token={token}
          adminWs={adminWsRef.current}
          onRefreshTelemetry={fetchTelemetry}
          onExecuteContainmentAction={async (action) => {
            try {
              if (action.type === 'lockdown') {
                const enable = Boolean(action.payload?.enable);
                await fetch(`${serverUrl}/api/admin/action`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ action: 'lockdown', enabled: enable, reason: 'Acionado via Sentinel IA Copilot' }),
                });
                if (adminWsRef.current && adminWsRef.current.readyState === WebSocket.OPEN) {
                  adminWsRef.current.send(JSON.stringify({ t: 'network-lockdown', enabled: enable, reason: 'DEFCON 1 acionado pela IA' }));
                }
                fetchTelemetry();
                return true;
              }
              if (action.type === 'quarantine' && action.targetId) {
                await fetch(`${serverUrl}/api/admin/action`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ action: 'quarantine', clientId: action.targetId, reason: 'Contenção acionada pelo Sentinel IA' }),
                });
                if (adminWsRef.current && adminWsRef.current.readyState === WebSocket.OPEN) {
                  adminWsRef.current.send(JSON.stringify({ t: 'remote-command', room: 'monitor', action: 'quarantine', targetClientId: action.targetId }));
                }
                fetchTelemetry();
                return true;
              }
              if (action.type === 'unquarantine' && action.targetId) {
                await fetch(`${serverUrl}/api/admin/action`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ action: 'unquarantine', clientId: action.targetId }),
                });
                if (adminWsRef.current && adminWsRef.current.readyState === WebSocket.OPEN) {
                  adminWsRef.current.send(JSON.stringify({ t: 'remote-command', room: 'monitor', action: 'unquarantine', targetClientId: action.targetId }));
                }
                fetchTelemetry();
                return true;
              }
              if (action.type === 'kill_sensors' && action.targetId) {
                if (adminWsRef.current && adminWsRef.current.readyState === WebSocket.OPEN) {
                  adminWsRef.current.send(JSON.stringify({ t: 'remote-command', room: 'monitor', action: 'kill-sensors', targetClientId: action.targetId }));
                }
                return true;
              }
              if (action.type === 'freeze_screen' && action.targetId) {
                if (adminWsRef.current && adminWsRef.current.readyState === WebSocket.OPEN) {
                  adminWsRef.current.send(JSON.stringify({ t: 'remote-command', room: 'monitor', action: 'freeze-screen', targetClientId: action.targetId }));
                }
                return true;
              }
              if (action.type === 'eject' && action.targetId) {
                await fetch(`${serverUrl}/api/admin/action`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ action: 'eject', clientId: action.targetId, reason: 'Ejeção sumária recomendada pela IA' }),
                });
                if (adminWsRef.current && adminWsRef.current.readyState === WebSocket.OPEN) {
                  adminWsRef.current.send(JSON.stringify({ t: 'remote-command', room: 'monitor', action: 'eject', targetClientId: action.targetId }));
                }
                fetchTelemetry();
                return true;
              }
              if (action.type === 'ban_ip' && action.payload?.ip) {
                await fetch(`${serverUrl}/api/admin/ban`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ ip: action.payload.ip, reason: String(action.payload.reason || 'Banimento via IA'), durationMinutes: 1440 }),
                });
                fetchTelemetry();
                return true;
              }
              return false;
            } catch {
              return false;
            }
          }}
        />
      )}

      {/* ABA 8: NSITE & HOSPEDAGEM NOSTR DESCENTRALIZADA (NIP-5A & BLOSSOM) */}
      {activeTab === 'nsite' && (
        <AdminNsiteView
          serverUrl={serverUrl}
          token={token}
        />
      )}

      {/* Modal de Tela Cheia para Câmera ou Tela */}
      {fullscreenMedia && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex flex-col p-4 animate-in fade-in"
          onClick={() => setFullscreenMedia(null)}
        >
          <div
            className="flex items-center justify-between p-3 bg-slate-900/90 rounded-2xl border border-slate-800 mb-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 flex-wrap">
              {fullscreenMedia.type === 'camera' ? (
                <Camera className="w-5 h-5 text-emerald-400" />
              ) : (
                <Monitor className="w-5 h-5 text-cyan-400" />
              )}
              <h3 className="font-bold text-sm text-slate-100">
                {fullscreenMedia.title}
              </h3>
              {(() => {
                const loc = fullscreenMedia.location || (fullscreenMedia.fromClientId ? connectedStations.find((s) => s.clientId === fullscreenMedia.fromClientId)?.location : undefined) || (fullscreenMedia.fromClientId ? data?.peers?.find((p) => p.clientId === fullscreenMedia.fromClientId)?.location : undefined) || {
                  country: 'Brasil',
                  flag: '🇧🇷',
                  latitude: -23.5505,
                  longitude: -46.6333,
                };
                return (
                  <GpsHoverBadge
                    location={loc}
                    stationName={fullscreenMedia.title}
                    buttonLabel="Mapa"
                    className="px-2.5 py-1 bg-slate-800/90 rounded-xl border border-slate-700 text-xs font-mono text-emerald-300 ml-2 hover:border-emerald-500/50"
                    placement="bottom"
                  />
                );
              })()}
            </div>
            <div className="flex items-center gap-2">
              <a
                href={fullscreenMedia.frameData}
                download={`${fullscreenMedia.type}-${fullscreenMedia.fromName}-${Date.now()}.jpg`}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Baixar
              </a>
              <button
                type="button"
                onClick={() => setFullscreenMedia(null)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>
          </div>

          <div
            className="flex-1 flex items-center justify-center overflow-hidden bg-black/60 rounded-2xl border border-slate-800 p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={fullscreenMedia.frameData}
              alt={fullscreenMedia.title}
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* MODAL DE PRÉ-VISUALIZAÇÃO DE GRAVAÇÃO CFTV */}
      {cctvPreviewItem && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Camera className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-100 truncate">
                    {cctvPreviewItem.clientName}
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono block">
                    {cctvPreviewItem.formattedDate} • {(cctvPreviewItem.size / 1024).toFixed(1)} KB • Gatilho: {cctvPreviewItem.triggerLabel}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => handleToggleStar(cctvPreviewItem.id, e)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    cctvPreviewItem.starred
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-amber-400'
                  }`}
                  title={cctvPreviewItem.starred ? 'Blindado (Favorito)' : 'Favoritar (Proteger contra auto-purge)'}
                >
                  <Star className={`w-3.5 h-3.5 ${cctvPreviewItem.starred ? 'fill-amber-400 text-amber-400' : ''}`} />
                  {cctvPreviewItem.starred ? 'Favoritado' : 'Favoritar'}
                </button>

                <a
                  href={cctvPreviewItem.url.startsWith('http') ? cctvPreviewItem.url : `${serverUrl}${cctvPreviewItem.url}`}
                  download={cctvPreviewItem.filename}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow"
                >
                  <Download className="w-3.5 h-3.5" /> Baixar
                </a>

                <button
                  type="button"
                  onClick={() => handleDeleteRecording(cctvPreviewItem.id)}
                  className="p-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-semibold"
                  title="Excluir gravação"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setCctvPreviewItem(null)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Fechar
                </button>
              </div>
            </div>

            <div className="flex-1 bg-black overflow-auto flex items-center justify-center p-3 min-h-[300px]">
              <img
                src={cctvPreviewItem.url.startsWith('http') ? cctvPreviewItem.url : `${serverUrl}${cctvPreviewItem.url}`}
                alt={cctvPreviewItem.clientName}
                className="max-h-[72vh] w-auto object-contain rounded-xl shadow-2xl"
              />
            </div>

            <div className="p-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-400 font-mono gap-2">
              <span className="truncate">Arquivo: {cctvPreviewItem.filename}</span>
              {cctvPreviewItem.note && (
                <span className="italic text-slate-300">"{cctvPreviewItem.note}"</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE COMPOSIÇÃO DE POP-UP DE EMERGÊNCIA & SIRENE (ADMIN) */}
      {isEmergencyPopupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-slate-900 border-2 border-red-500/70 rounded-3xl shadow-2xl shadow-red-950/60 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header com Tema de Emergência */}
            <div className="p-5 bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-black/30 rounded-xl backdrop-blur-sm">
                  <ShieldAlert className="w-6 h-6 text-white animate-pulse" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base uppercase tracking-wider">
                    Disparar Pop-up de Alerta & Sirene
                  </h3>
                  <p className="text-xs text-red-100/90 font-medium">
                    Aparece na tela do usuário com sirene sonoro contínua e vibração
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEmergencyPopupModalOpen(false)}
                className="p-1.5 hover:bg-black/30 rounded-xl text-white/80 hover:text-white transition-all text-xs font-bold"
              >
                ✕ Fechar
              </button>
            </div>

            <div className="p-6 space-y-4 text-slate-100 overflow-y-auto max-h-[75vh]">
              {/* Alvo do Alerta */}
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold">Destinatário do Alerta:</span>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                  {emergencyTargetStation ? `Estação: ${emergencyTargetStation.name}` : '📢 TODOS OS USUÁRIOS CONECTADOS (BROADCAST)'}
                </span>
              </div>

              {/* Botões Rápidos de Modelos Prontos */}
              <div>
                <span className="text-xs text-slate-400 block mb-2 font-medium">Modelos Rápidos (1-Clique):</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEmergencyTitle('🚨 ALERTA DE SEGURANÇA');
                      setEmergencyMessage('Atenção: Atividade não autorizada detectada. Por favor, aguarde o atendente.');
                      setEmergencyLevel('critical');
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-700 text-left transition-all"
                  >
                    🚨 Segurança
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmergencyTitle('⚠️ COMUNICADO DA ADMINISTRAÇÃO');
                      setEmergencyMessage('Aviso importante aos usuários da rede: favor comparecer à recepção ou encerrar downloads pesados.');
                      setEmergencyLevel('warning');
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-700 text-left transition-all"
                  >
                    ⚠️ Comunicado
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmergencyTitle('🏢 COMPARECER À RECEPÇÃO');
                      setEmergencyMessage('Seu atendimento foi chamado na recepção. Por favor dirija-se ao balcão principal.');
                      setEmergencyLevel('info');
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-700 text-left transition-all"
                  >
                    🏢 Balcão
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmergencyTitle('⏰ TEMPO DE SESSÃO ESGOTANDO');
                      setEmergencyMessage('Sua sessão de tempo está prestes a encerrar nos próximos 5 minutos. Renove na administração.');
                      setEmergencyLevel('warning');
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-700 text-left transition-all"
                  >
                    ⏰ Fim de Tempo
                  </button>
                </div>
              </div>

              {/* Grau de Urgência */}
              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">Nível de Urgência & Sirene:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEmergencyLevel('critical')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      emergencyLevel === 'critical'
                        ? 'bg-red-600/30 border-red-500 text-red-200 shadow-sm'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🚨 Crítico (Sirene Alta)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmergencyLevel('warning')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      emergencyLevel === 'warning'
                        ? 'bg-amber-600/30 border-amber-500 text-amber-200 shadow-sm'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ⚠️ Aviso Importante
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmergencyLevel('info')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      emergencyLevel === 'info'
                        ? 'bg-blue-600/30 border-blue-500 text-blue-200 shadow-sm'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    📢 Informativo
                  </button>
                </div>
              </div>

              {/* Título do Pop-up */}
              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">Título do Pop-up:</label>
                <input
                  type="text"
                  value={emergencyTitle}
                  onChange={(e) => setEmergencyTitle(e.target.value)}
                  placeholder="Ex: ALERTA DO ADMINISTRADOR"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-red-500 font-bold uppercase"
                />
              </div>

              {/* Mensagem do Pop-up */}
              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">Texto da Mensagem (Obrigatória):</label>
                <textarea
                  rows={4}
                  value={emergencyMessage}
                  onChange={(e) => setEmergencyMessage(e.target.value)}
                  placeholder="Digite a mensagem que o usuário verá no pop-up..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-red-500 resize-none leading-relaxed"
                />
              </div>

              {/* Informação sobre funcionamento mesmo com navegador fechado */}
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Entrega Multi-Camadas Garantida:</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  • <strong>Com navegador aberto/minimizado:</strong> Pop-up em tela cheia com sirene sonora e notificação do sistema.<br />
                  • <strong>No Windows (Desktop):</strong> Disparo nativo via PowerShell MessageBox na tela mesmo com o navegador fechado.<br />
                  • <strong>Ao abrir o navegador mais tarde:</strong> Entrega imediata automática guardada na fila do servidor com botão de "Estou Ciente".
                </p>
              </div>

              {/* Botões de Ação */}
              <div className="pt-2 flex items-center justify-between gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    handleSendSilenceAlert(emergencyTargetStation ? emergencyTargetStation.clientId : 'all', emergencyTargetStation?.name);
                    setIsEmergencyPopupModalOpen(false);
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                  title="Enviar comando para silenciar a sirene e desligar o alerta imediatamente no usuário"
                >
                  <VolumeX className="w-4 h-4 text-rose-400" />
                  <span>🔇 Desligar Sirene Remotamente</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEmergencyPopupModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
                  >
                    Cancelar
                  </button>
                <button
                  type="button"
                  onClick={handleSendEmergencyPopup}
                  disabled={!emergencyMessage.trim()}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-red-950/60 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>🚀 Disparar Pop-up de Emergência Agora</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Botão Flutuante de Acesso Rápido ao Copilot IA (Visível em Qualquer Aba) */}
      {activeTab !== 'ai_copilot' && (
        <button
          type="button"
          onClick={() => setActiveTab('ai_copilot')}
          className="fixed bottom-6 right-6 z-40 px-4 py-3 bg-gradient-to-r from-cyan-600 via-indigo-600 to-cyan-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs rounded-2xl shadow-2xl shadow-indigo-950/80 border border-cyan-400/50 flex items-center gap-2.5 transition-all hover:scale-105 active:scale-95 group animate-in fade-in"
          title="Abrir Copilot IA Tático de Segurança"
        >
          <div className="w-6 h-6 rounded-xl bg-slate-950/60 flex items-center justify-center text-cyan-300">
            <Bot className="w-4 h-4 animate-pulse" />
          </div>
          <span>Perguntar ao Copilot IA</span>
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
        </button>
      )}
    </div>
  );
};
