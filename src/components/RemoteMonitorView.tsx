import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Bell,
  BellOff,
  FolderSync,
  Upload,
  Download,
  Shield,
  Eye,
  Radio,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  FileText,
  Trash2,
  HardDrive,
  Maximize2,
  Volume2,
  VolumeX,
  PhoneCall,
  Smartphone,
  ExternalLink,
  Copy,
  Check,
  HelpCircle,
  Image as ImageIcon,
  FileAudio,
  Square,
  Lock,
  Unlock,
  Monitor,
  MonitorPlay,
  MonitorOff,
  Baby,
  SendHorizontal,
  MessageSquare,
  MapPin,
  Globe,
} from 'lucide-react';
import { captureGpsLocation, GeoLocationData, getGoogleMapsUrl } from '../utils/geo';

interface RemoteFrame {
  fromPeerId: number;
  fromName: string;
  frameData: string;
  timestamp: number;
}

interface MotionSnapshot {
  id: string;
  timestamp: number;
  imageData: string;
  label: string;
}

interface SharedRemoteFile {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
  ownerName: string;
  timestamp: number;
}

const DEFAULT_SYSTEM_PASSWORD = 'DL-Admin#9xK7$SecShield!2026';

export const RemoteMonitorView: React.FC = () => {
  // Estado de Servidor e WebSocket
  const [serverUrl, setServerUrl] = useState(() => {
    const loc = window.location;
    if (loc.protocol.startsWith('http')) {
      return `${loc.protocol.replace('http', 'ws')}//${loc.hostname}:${loc.port || '4870'}`;
    }
    return 'ws://localhost:4870';
  });

  const [connected, setConnected] = useState(false);
  const [myPeerName, setMyPeerName] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('dl_remote_station_name');
        if (saved) return saved;
      } catch {}
    }
    if (typeof navigator === 'undefined') return 'Estação-1000';
    const ua = navigator.userAgent || '';
    const isAndroid = /Android/i.test(ua);
    const isIPhone = /iPhone/i.test(ua);
    const isIPad = /iPad/i.test(ua);
    const isMobile = isAndroid || isIPhone || isIPad || /Mobile/i.test(ua);
    const rand = Math.floor(100 + Math.random() * 900);
    if (isAndroid) return `📱 Android-${rand}`;
    if (isIPhone) return `📱 iPhone-${rand}`;
    if (isIPad) return `📱 iPad-${rand}`;
    if (isMobile) return `📱 Celular-${rand}`;
    return `💻 PC-${rand}`;
  });
  const myClientIdRef = useRef<string>(
    (typeof window !== 'undefined' && localStorage.getItem('dl_remote_station_client_id')) ||
    ('station_' + Math.random().toString(36).substring(2, 9))
  );

  useEffect(() => {
    if (typeof window !== 'undefined' && myClientIdRef.current) {
      try {
        localStorage.setItem('dl_remote_station_client_id', myClientIdRef.current);
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && myPeerName) {
      try {
        localStorage.setItem('dl_remote_station_name', myPeerName);
      } catch {}
    }
  }, [myPeerName]);
  const wsRef = useRef<WebSocket | null>(null);

  // Detecção e Configurações de Múltiplos Dispositivos Móveis
  const isMobileDevice = typeof navigator !== 'undefined' &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent || '');
  const [mobileFacingMode, setMobileFacingMode] = useState<'environment' | 'user'>('environment');
  const [screenSourceType, setScreenSourceType] = useState<'display' | 'camera_env' | 'camera_user' | 'snapshot'>('display');

  // Modo de Tela: Computador (Desktop) vs Smartphone (Celular)
  const [screenDeviceMode, setScreenDeviceMode] = useState<'mobile' | 'desktop'>(isMobileDevice ? 'mobile' : 'desktop');
  const [screenRequestFromAdmin, setScreenRequestFromAdmin] = useState(false);

  // Diagnóstico de Compatibilidade com Câmera / Contexto Seguro
  const isMediaDevicesAvailable = typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function';

  const isSecureContext = typeof window !== 'undefined' && (
    window.isSecureContext ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );

  const [showMobileGuide, setShowMobileGuide] = useState(false);
  const [copiedFlagUrl, setCopiedFlagUrl] = useState(false);
  const [copiedServerOrigin, setCopiedServerOrigin] = useState(false);

  // Câmera & Microfone Locais (com suporte completo a Frontal / Traseira e Múltiplas Lentes)
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraDeviceId, setSelectedCameraDeviceId] = useState<string>('');
  const [cameraStatusMessage, setCameraStatusMessage] = useState<{ text: string; type: 'info' | 'error' | 'warning' } | null>(null);

  // Sistema de Toasts Elegantes (Substitui os alerts invasivos)
  const [toastNotification, setToastNotification] = useState<{ text: string; type: 'info' | 'success' | 'warning' | 'error' } | null>(null);
  const showToast = useCallback((text: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setToastNotification({ text, type });
    setTimeout(() => {
      setToastNotification((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  }, []);

  const [micActive, setMicActive] = useState(true);
  const [broadcastStream, setBroadcastStream] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);
  const [lastCapturedPhoto, setLastCapturedPhoto] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const motionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const locationRef = useRef<GeoLocationData | null>(null);
  const toggleCameraFacingRef = useRef<(() => Promise<void> | void) | null>(null);
  const startCameraRef = useRef<((targetFacing?: 'user' | 'environment', targetDeviceId?: string) => Promise<void>) | null>(null);

  // Detecção de Movimento
  const [motionDetectionActive, setMotionDetectionActive] = useState(true);
  const [motionSensitivity, setMotionSensitivity] = useState(30); // Limiar
  const [motionDetectedCount, setMotionDetectedCount] = useState(0);
  const [lastMotionTime, setLastMotionTime] = useState<number | null>(null);
  const prevFrameDataRef = useRef<Uint8ClampedArray | null>(null);
  const [snapshots, setSnapshots] = useState<MotionSnapshot[]>([]);

  // Notificações Web
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  // Monitoramento Remoto (Feeds de outras máquinas)
  const [remoteFeeds, setRemoteFeeds] = useState<Record<string, RemoteFrame>>({});
  const [selectedRemoteFeed, setSelectedRemoteFeed] = useState<string | null>(null);

  // Arquivos Compartilhados Remotos
  const [sharedFiles, setSharedFiles] = useState<SharedRemoteFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Gravação de Áudio do Microfone para o Administrador
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioRecordingDuration, setAudioRecordingDuration] = useState(0);
  const [lastAudioSentTime, setLastAudioSentTime] = useState<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Compartilhamento e Captura de Tela (Screen Data & Stream)
  const [screenActive, setScreenActive] = useState(false);
  const [lastScreenSentTime, setLastScreenSentTime] = useState<number | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // --- CONTENÇÃO & BLOQUEIO DE SEGURANÇA / CONTROLE PARENTAL ---
  const [isTerminalLocked, setIsTerminalLocked] = useState(false);
  const [terminalLockReason, setTerminalLockReason] = useState('Dispositivo Bloqueado pela Administração.');
  const [adminUnlockPin, setAdminUnlockPin] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [currentTimeStr, setCurrentTimeStr] = useState(() => new Date().toLocaleTimeString('pt-BR'));

  // --- CONTROLE PARENTAL CLIENT-SIDE ---
  const [parentalPolicy, setParentalPolicy] = useState<{
    enabled: boolean;
    category: 'kids' | 'teens' | 'custom' | 'none';
    dailyLimitMinutes: number;
    bedtimeHour: number;
    blockedKeywords: string[];
    autoLockOnViolation: boolean;
    blurScreen: boolean;
    takeScreenshotOnViolation: boolean;
  }>({
    enabled: true,
    category: 'teens',
    dailyLimitMinutes: 120,
    bedtimeHour: 22,
    blockedKeywords: ['adulto', 'xxx', 'porn', 'sexo', 'bet365', 'cassino', 'aposta', 'blaze', 'tigrinho', 'gore', 'hack'],
    autoLockOnViolation: true,
    blurScreen: false,
    takeScreenshotOnViolation: true,
  });

  // 1. Inicializar Permissões de Notificação
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setNotificationPermission(perm);
        if (perm === 'granted') {
          new Notification('Jjy: Notificações Ativadas', {
            body: 'Alertas de segurança e recebimento de arquivos habilitados com sucesso.',
            icon: '/favicon.ico',
          });
        }
      } catch (err) {
        console.error('Erro ao pedir permissão de notificação:', err);
      }
    }
  };

  const triggerNotification = useCallback((title: string, body: string) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
        });
      } catch {
        // Fallback
      }
    }
  }, []);

  // Alerta Sonoro Contínuo e Silenciamento
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const [incomingIntercom, setIncomingIntercom] = useState<{ fromName: string; timestamp: number } | null>(null);
  const [isUserIntercomActive, setIsUserIntercomActive] = useState(false);
  const userIntercomRecorderRef = useRef<MediaRecorder | null>(null);
  const userIntercomStreamRef = useRef<MediaStream | null>(null);

  const playAlertSound = useCallback(() => {
    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtxClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // Ignora erro de áudio
    }
  }, []);

  // Som Melodioso de Chamada Individual (Chime de 4 Notas)
  const playChimeSound = useCallback(() => {
    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return;
      const ctx = new AudioCtxClass();
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
        gain.gain.setValueAtTime(0.25, ctx.currentTime + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.12);
        osc.stop(ctx.currentTime + idx * 0.12 + 0.45);
      });
    } catch {}
  }, []);

  // Desligar Alarme Sonoro Clicando Nele
  const handleSilenceAlarm = useCallback(() => {
    setIsAlarmActive(false);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        t: 'silence-alert',
        room: 'general',
        targetClientId: myClientIdRef.current,
        fromClientId: myClientIdRef.current,
        fromName: myPeerName,
        timestamp: Date.now(),
      }));
    }
    showToast('Alarme sonoro desligado com sucesso.', 'info');
  }, [myPeerName]);

  // Loop de repetição de sirene enquanto o alarme estiver ativo
  useEffect(() => {
    if (!isAlarmActive) return;
    const interval = setInterval(() => {
      playAlertSound();
    }, 1400);
    return () => clearInterval(interval);
  }, [isAlarmActive, playAlertSound]);

  // Transmissão de Áudio ao Vivo (Interfone do Usuário para o Administrador)
  const startUserIntercom = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      userIntercomStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      userIntercomRecorderRef.current = recorder;
      const audioChunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = reader.result as string;
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              t: 'intercom-audio',
              room: 'general',
              targetClientId: 'admin',
              audioData: base64Data,
              fromClientId: myClientIdRef.current,
              fromName: myPeerName,
              isLive: true,
              timestamp: Date.now(),
            }));
            showToast('🎙️ Mensagem de voz transmitida à Administração!', 'success');
          }
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      setIsUserIntercomActive(true);
      showToast('🎙️ Interfone aberto: Fale agora! Clique novamente para enviar.', 'info');
    } catch {
      showToast('Permissão de microfone negada para interfone.', 'error');
    }
  };

  const stopUserIntercom = () => {
    if (userIntercomRecorderRef.current && userIntercomRecorderRef.current.state !== 'inactive') {
      userIntercomRecorderRef.current.stop();
    }
    setIsUserIntercomActive(false);
  };

  // 2. Conectar ao WebSocket do DataLink
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: NodeJS.Timeout;

    const connect = () => {
      try {
        ws = new WebSocket(serverUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          ws.send(JSON.stringify({
            t: 'hello',
            clientId: myClientIdRef.current,
            name: myPeerName,
            color: '#10b981',
          }));

          const sendTelemetry = async () => {
            let batteryLevel: number | undefined;
            let isCharging: boolean | undefined;
            if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
              try {
                const b = await (navigator as any).getBattery();
                batteryLevel = Math.round(b.level * 100);
                isCharging = b.charging;
              } catch {}
            }
            const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
            const platform = isMobile ? (/Android/i.test(navigator.userAgent) ? 'Android' : 'iOS') : 'Computador';
            
            if (!locationRef.current) {
              try {
                locationRef.current = await captureGpsLocation();
              } catch {}
            }

            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                t: 'device-telemetry',
                room: 'monitor',
                fromClientId: myClientIdRef.current,
                battery: batteryLevel,
                isCharging,
                platform,
                fromName: myPeerName,
                location: locationRef.current || undefined,
              }));
            }
          };
          setTimeout(sendTelemetry, 400);
        };

        ws.onclose = () => {
          setConnected(false);
          reconnectTimer = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          ws.close();
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.t === 'stream-frame') {
              setRemoteFeeds((prev) => ({
                ...prev,
                [data.from]: {
                  fromPeerId: data.from,
                  fromName: data.fromName || 'Estação Remota',
                  frameData: data.frameData,
                  timestamp: Date.now(),
                },
              }));
            } else if (data.t === 'remote-alert') {
              playAlertSound();
              triggerNotification(
                `🚨 Alerta de Segurança: ${data.fromName}`,
                data.detail || 'Movimento ou som detectado no computador remoto!'
              );
              if (data.snapshot) {
                setSnapshots((prev) => [
                  {
                    id: 'snap_' + Date.now(),
                    timestamp: Date.now(),
                    imageData: data.snapshot,
                    label: `Remoto (${data.fromName})`,
                  },
                  ...prev.slice(0, 19),
                ]);
              }
            } else if (data.t === 'file-offer') {
              setSharedFiles((prev) => {
                if (prev.some((f) => f.id === data.file.id)) return prev;
                triggerNotification(
                  '📁 Novo Arquivo Compartilhado',
                  `${data.fromName} disponibilizou "${data.file.name}" na rede.`
                );
                return [data.file, ...prev];
              });
            } else if (data.t === 'remote-command') {
              if (data.action === 'alert') {
                setIsAlarmActive(true);
                playAlertSound();
                triggerNotification(
                  '🚨 ALARME DISPARADO PELO ADMINISTRADOR',
                  'O Administrador acionou o alarme de segurança. Clique no aviso na tela para desligar o som.'
                );
              } else if (data.action === 'request-photo') {
                if (cameraActive && videoRef.current && canvasRef.current) {
                  const video = videoRef.current;
                  const canvas = canvasRef.current;
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    canvas.width = 640;
                    canvas.height = 480;
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const photoData = canvas.toDataURL('image/jpeg', 0.8);
                    setLastCapturedPhoto(photoData);
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                      wsRef.current.send(JSON.stringify({
                        t: 'stream-frame',
                        room: 'monitor',
                        fromClientId: myClientIdRef.current,
                        frameData: photoData,
                        fromName: myPeerName,
                        location: locationRef.current || undefined,
                      }));
                    }
                  }
                } else {
                  photoInputRef.current?.click();
                }
                triggerNotification('📸 Foto Solicitada pelo Administrador', 'Abra a câmera e capture a foto para a Central.');
              } else if (data.action === 'request-audio') {
                playAlertSound();
                if (audioInputRef.current) {
                  audioInputRef.current.click();
                }
                triggerNotification('🎙️ Áudio Solicitado pelo Administrador', 'A Central solicitou uma gravação de voz deste dispositivo.');
              } else if (data.action === 'request-screen') {
                playAlertSound();
                triggerNotification('🖥️ Tela Solicitada pelo Administrador', 'A Central solicitou a visualização da tela deste dispositivo.');
                if (typeof sendScreenTelemetry === 'function') sendScreenTelemetry();
                if (screenActive) {
                  captureAndSendScreenFrame();
                  showToast('Central solicitou atualização da transmissão de tela.', 'info');
                } else {
                  setScreenRequestFromAdmin(true);
                }
              } else if (data.action === 'lock') {
                setIsTerminalLocked(true);
                setTerminalLockReason(data.reason || 'Dispositivo Bloqueado pela Administração.');
                playAlertSound();
                triggerNotification('🔒 Dispositivo Bloqueado', 'O acesso a este computador foi bloqueado pelo administrador.');
              } else if (data.action === 'unlock') {
                setIsTerminalLocked(false);
                setUnlockError(null);
                triggerNotification('🔓 Dispositivo Desbloqueado', 'Acesso liberado pelo administrador.');
              } else if (data.action === 'set-parental') {
                if (data.policy) {
                  setParentalPolicy(data.policy);
                  triggerNotification('🛡️ Diretriz Parental Atualizada', 'As configurações de moderação foram atualizadas pela Central.');
                }
              } else if (data.action === 'switch-camera') {
                if (toggleCameraFacingRef.current) {
                  toggleCameraFacingRef.current();
                }
                triggerNotification('🔄 Câmera Alternada', 'A Central do Administrador inverteu a câmera deste dispositivo.');
              } else if (data.action === 'quarantine') {
                setIsTerminalLocked(true);
                setTerminalLockReason(data.reason || '🔒 Estação isolada em quarentena preventiva de segurança pelo Administrador.');
                playAlertSound();
                triggerNotification('🛑 Quarentena de Segurança', 'Seu terminal foi isolado administrativamente.');
              } else if (data.action === 'unquarantine') {
                setIsTerminalLocked(false);
                setTerminalLockReason('');
                triggerNotification('🟢 Quarentena Revogada', 'Seu terminal foi liberado pela Administração.');
              } else if (data.action === 'freeze-screen') {
                setIsTerminalLocked(true);
                setTerminalLockReason(data.reason || '🔒 ACESSO BLOQUEADO POR VIOLAÇÃO DE SEGURANÇA (SOC DEFESA)');
                playAlertSound();
                triggerNotification('🔒 Tela Bloqueada pelo Administrador', 'Violação de segurança detectada.');
              } else if (data.action === 'kill-sensors') {
                if (mediaStreamRef.current) {
                  mediaStreamRef.current.getTracks().forEach((track) => track.stop());
                  mediaStreamRef.current = null;
                }
                setCameraActive(false);
                if (screenStreamRef.current) {
                  screenStreamRef.current.getTracks().forEach((track) => track.stop());
                  screenStreamRef.current = null;
                }
                setScreenActive(false);
                triggerNotification('🔇 Sensores Cortados', 'Câmera, tela e microfone foram cortados remotamente pelo Administrador.');
              } else if (data.action === 'eject') {
                setIsTerminalLocked(true);
                setTerminalLockReason('⛔ SESSÃO TERMINADA PELO ADMINISTRADOR POR VIOLAÇÃO DE SEGURANÇA.');
                if (wsRef.current) {
                  wsRef.current.close(4003, 'Sessão encerrada por contenção administrativa');
                }
                triggerNotification('⛔ Sessão Encerrada', 'Você foi desconectado pelo Administrador.');
              }
            } else if (data.t === 'silence-alert') {
              const isForMe = !data.targetClientId || data.targetClientId === 'all' || data.targetClientId === myClientIdRef.current;
              if (isForMe) {
                setIsAlarmActive(false);
                showToast('Alarme sonoro silenciado pela Central.', 'info');
              }
            } else if (data.t === 'play-sound') {
              const isForMe = !data.targetClientId || data.targetClientId === 'all' || data.targetClientId === myClientIdRef.current;
              if (isForMe) {
                playChimeSound();
                triggerNotification('🔔 Chamada da Central', 'O Administrador enviou um toque sonoro de atenção.');
                showToast('🔔 Sinal sonoro individual recebido da Central!', 'info');
              }
            } else if (data.t === 'intercom-audio') {
              const isForMe = !data.targetClientId || data.targetClientId === 'all' || data.targetClientId === myClientIdRef.current;
              if (isForMe && data.audioData) {
                try {
                  const audio = new Audio(data.audioData);
                  audio.play().catch(() => {});
                  setIncomingIntercom({
                    fromName: data.fromName || 'Administrador Central',
                    timestamp: Date.now(),
                  });
                  setTimeout(() => setIncomingIntercom(null), 8000);
                  showToast(`🔊 Interfone: ${data.fromName || 'Administrador'} falando ao vivo!`, 'info');
                } catch {}
              }
            }
          } catch {
            // Ignora frames não-JSON
          }
        };
      } catch {
        reconnectTimer = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, [serverUrl, myPeerName, playAlertSound, triggerNotification]);

  // 2.5 Ticker de Relógio Digital e Horário de Dormir (Bedtime Parental)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString('pt-BR'));

      // Verificação de Bedtime (Horário de Dormir)
      if (parentalPolicy.enabled && parentalPolicy.bedtimeHour !== undefined) {
        const currentHour = now.getHours();
        const isBedtime = parentalPolicy.bedtimeHour === 0 ? (currentHour >= 0 && currentHour < 6) : (currentHour >= parentalPolicy.bedtimeHour || currentHour < 6);
        if (isBedtime && !isTerminalLocked) {
          setIsTerminalLocked(true);
          setTerminalLockReason('Horário de Dormir Atingido (Bedtime) - Dispositivo Bloqueado por Controle Parental.');
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              t: 'parental-alert',
              room: 'monitor',
              fromClientId: myClientIdRef.current,
              fromName: myPeerName,
              reason: 'Horário de Dormir Atingido (Bedtime)',
              actionTaken: 'Dispositivo bloqueado automaticamente',
            }));
          }
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isTerminalLocked, parentalPolicy]);

  // 2.6 Monitor de Digitação para Detecção de Palavras Proibidas (Parental Control)
  useEffect(() => {
    if (!parentalPolicy.enabled || !parentalPolicy.blockedKeywords || parentalPolicy.blockedKeywords.length === 0) return;

    let buffer = '';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.length === 1) {
        buffer += e.key.toLowerCase();
        if (buffer.length > 50) buffer = buffer.slice(-50);

        for (const word of parentalPolicy.blockedKeywords) {
          if (word.length >= 3 && buffer.includes(word.toLowerCase())) {
            buffer = '';
            let snapshotData: string | undefined;
            if (canvasRef.current) {
              try {
                snapshotData = canvasRef.current.toDataURL('image/jpeg', 0.6);
              } catch {}
            }

            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                t: 'parental-alert',
                room: 'monitor',
                fromClientId: myClientIdRef.current,
                fromName: myPeerName,
                reason: 'Palavra ou conteúdo impróprio digitado',
                termFound: word,
                actionTaken: parentalPolicy.autoLockOnViolation ? 'Terminal bloqueado e notificado' : 'Notificado ao Administrador',
                snapshot: snapshotData,
              }));
            }

            if (parentalPolicy.autoLockOnViolation) {
              setIsTerminalLocked(true);
              setTerminalLockReason(`Violação de Diretriz Parental: O termo "${word}" é bloqueado neste computador.`);
              playAlertSound();
            }
            break;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [parentalPolicy, playAlertSound]);

  // 2.5 Enumeração Automática de Câmeras Disponíveis
  useEffect(() => {
    if (navigator?.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setAvailableCameras(videoInputs);
      }).catch(() => {});
    }
  }, [cameraActive]);

  // 3. Ativar Câmera e Microfone (com suporte dinâmico a Frontal / Traseira e sem alerts invasivos)
  const startCamera = async (targetFacing?: 'user' | 'environment', targetDeviceId?: string) => {
    setCameraStatusMessage(null);
    if (!navigator?.mediaDevices?.getUserMedia) {
      setShowMobileGuide(true);
      setCameraStatusMessage({
        text: 'Navegador bloqueou acesso aos sensores via HTTP. Acesse pelo HTTPS (porta 4873) para liberar o vídeo.',
        type: 'warning',
      });
      return;
    }

    const desiredFacing = targetFacing || cameraFacingMode;
    const deviceId = targetDeviceId || selectedCameraDeviceId;

    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }

      let stream: MediaStream | null = null;
      const videoConstraints: MediaTrackConstraints = deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: { ideal: desiredFacing }, width: { ideal: 1280 }, height: { ideal: 720 } };

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: micActive,
        });
      } catch {
        // Fallback 1: Sem áudio (caso o microfone seja restrito)
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: false,
          });
        } catch {
          // Fallback 2: facingMode ideal simplificado
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: desiredFacing },
              audio: false,
            });
          } catch {
            // Fallback 3: Qualquer câmera genérica disponível
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          }
        }
      }

      if (!stream) throw new Error('Não foi possível obter o fluxo de vídeo da câmera.');

      mediaStreamRef.current = stream;
      setCameraFacingMode(desiredFacing);
      if (targetDeviceId) setSelectedCameraDeviceId(targetDeviceId);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.muted = true;
        try {
          await videoRef.current.play();
        } catch {}
      }

      setCameraActive(true);
      setCameraStatusMessage(null);

      // Notifica o servidor
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          t: 'device-telemetry',
          room: 'monitor',
          fromClientId: myClientIdRef.current,
          fromName: myPeerName,
          isCameraActive: true,
          cameraFacing: desiredFacing,
          audioLevel: 0,
        }));
      }

      // Medidor de áudio se disponível
      const hasAudio = stream.getAudioTracks().length > 0;
      if (hasAudio) {
        try {
          const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioCtxClass) {
            const audioCtx = new AudioCtxClass();
            audioContextRef.current = audioCtx;
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);
            analyserRef.current = analyser;

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const updateMeter = () => {
              if (!mediaStreamRef.current || !analyserRef.current) return;
              analyserRef.current.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
              const avg = sum / dataArray.length;
              setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
              requestAnimationFrame(updateMeter);
            };
            updateMeter();
          }
        } catch {}
      }
    } catch (err) {
      const errName = (err as Error).name;
      let msg = 'Erro ao acessar câmera: ' + (err as Error).message;
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        msg = 'Permissão de câmera negada no navegador. Permita o acesso ao ícone de cadeado para transmitir vídeo.';
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        msg = 'Nenhuma câmera detectada neste dispositivo.';
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        msg = 'Câmera já está em uso por outro aplicativo ou processo.';
      }
      setCameraStatusMessage({ text: msg, type: 'error' });
    }
  };

  const toggleCameraFacing = async () => {
    const nextFacing: 'user' | 'environment' = cameraFacingMode === 'user' ? 'environment' : 'user';
    setCameraFacingMode(nextFacing);
    if (cameraActive) {
      await startCamera(nextFacing);
    }
    showToast(nextFacing === 'user' ? '🤳 Câmera Frontal Selecionada' : '📷 Câmera Traseira Selecionada', 'info');
  };

  startCameraRef.current = startCamera;
  toggleCameraFacingRef.current = toggleCameraFacing;

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setCameraActive(false);
    setAudioLevel(0);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        t: 'device-telemetry',
        room: 'monitor',
        fromClientId: myClientIdRef.current,
        fromName: myPeerName,
        isCameraActive: false,
      }));
    }
  };

  // Garante que o elemento <video> receba o stream assim que estiver montado
  useEffect(() => {
    if (cameraActive && mediaStreamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== mediaStreamRef.current) {
        videoRef.current.srcObject = mediaStreamRef.current;
      }
      videoRef.current.setAttribute('playsinline', 'true');
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive]);

  const toggleMic = () => {
    if (mediaStreamRef.current) {
      const audioTracks = mediaStreamRef.current.getAudioTracks();
      audioTracks.forEach((t) => {
        t.enabled = !micActive;
      });
      setMicActive(!micActive);
    }
  };

  // 4. Captura Nativa de Foto do Celular (Funciona 100% via HTTP em qualquer smartphone)
  const handleMobilePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1280;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
        }
        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
        const now = Date.now();
        setLastCapturedPhoto(dataUrl);

        setSnapshots((prev) => [
          {
            id: 'snap_' + now,
            timestamp: now,
            imageData: dataUrl,
            label: `Foto do Celular (${myPeerName})`,
          },
          ...prev.slice(0, 19),
        ]);

        // Transmite a foto imediatamente para todos os computadores na LAN
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            t: 'stream-frame',
            room: 'monitor',
            fromClientId: myClientIdRef.current,
            frameData: dataUrl,
            fromName: myPeerName,
            location: locationRef.current || undefined,
          }));

          wsRef.current.send(JSON.stringify({
            t: 'remote-alert',
            room: 'monitor',
            alertType: 'snapshot',
            detail: `Nova captura de ambiente transmitida por ${myPeerName}!`,
            snapshot: dataUrl,
            fromName: myPeerName,
          }));
        }

        triggerNotification('Foto do Ambiente Transmitida', 'Sua foto foi enviada com exclusividade para o Painel do Administrador.');
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Gravação de Áudio do Microfone & Transmissão ao Administrador
  const startAudioRecording = async () => {
    try {
      let stream = mediaStreamRef.current;
      if (!stream || stream.getAudioTracks().length === 0) {
        if (!navigator?.mediaDevices?.getUserMedia) {
          showToast('Gravação contínua não suportada neste contexto HTTP. Utilize o botão nativo abaixo ou acesse via HTTPS.', 'warning');
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      audioChunksRef.current = [];
      const mime = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mime });
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              t: 'audio-sample',
              room: 'monitor',
              fromClientId: myClientIdRef.current,
              audioData: dataUrl,
              duration: audioRecordingDuration,
              fromName: myPeerName,
            }));
            setLastAudioSentTime(Date.now());
            showToast('🎙️ Amostra de áudio transmitida à Central!', 'success');
            triggerNotification('🎙️ Áudio Transmitido', 'Gravação de voz enviada com exclusividade para o Administrador.');
          }
        };
        reader.readAsDataURL(blob);
      };

      recorder.start();
      setIsRecordingAudio(true);
      setAudioRecordingDuration(0);

      const timer = setInterval(() => {
        setAudioRecordingDuration((d) => d + 1);
      }, 1000);
      recordingTimerRef.current = timer;
    } catch (err) {
      showToast('Não foi possível gravar áudio: ' + (err as Error).message, 'error');
    }
  };

  const stopAudioRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecordingAudio(false);
  };

  const handleMobileAudioCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          t: 'audio-sample',
          room: 'monitor',
          fromClientId: myClientIdRef.current,
          audioData: dataUrl,
          duration: 0,
          fromName: myPeerName,
        }));
        setLastAudioSentTime(Date.now());
        triggerNotification('🎙️ Áudio Transmitido', `"${file.name}" enviado com exclusividade para o Administrador.`);
      }
    };
    reader.readAsDataURL(file);
  };

  // 4.5 Compartilhamento e Captura de Tela (Screen Data & Stream)
  const getScreenTelemetryData = useCallback(() => {
    return {
      width: typeof window !== 'undefined' ? window.screen.width : 1920,
      height: typeof window !== 'undefined' ? window.screen.height : 1080,
      availWidth: typeof window !== 'undefined' ? window.screen.availWidth : 1920,
      availHeight: typeof window !== 'undefined' ? window.screen.availHeight : 1080,
      colorDepth: typeof window !== 'undefined' ? window.screen.colorDepth : 24,
      pixelRatio: typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1,
      orientation: typeof window !== 'undefined' && window.screen.orientation ? window.screen.orientation.type : (typeof window !== 'undefined' && window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'),
      windowWidth: typeof window !== 'undefined' ? window.innerWidth : 1280,
      windowHeight: typeof window !== 'undefined' ? window.innerHeight : 720,
      hasFocus: typeof document !== 'undefined' ? document.hasFocus() : true,
      isScreenSharing: screenActive,
      isCameraActive: cameraActive,
      isMicActive: micActive,
      lastUpdated: Date.now(),
    };
  }, [screenActive, cameraActive, micActive]);

  const sendScreenTelemetry = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        t: 'screen-telemetry',
        room: 'monitor',
        fromClientId: myClientIdRef.current,
        fromName: myPeerName,
        screenData: getScreenTelemetryData(),
      }));
    }
  }, [getScreenTelemetryData, myPeerName]);

  const captureAndSendScreenFrame = useCallback(() => {
    const video = screenVideoRef.current;
    const stream = screenStreamRef.current;
    if (!video || !stream) return;

    const track = stream.getVideoTracks()[0];
    if (track && track.readyState === 'ended') {
      stopScreenShare();
      return;
    }

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    if (video.paused) {
      video.play().catch(() => {});
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    // Se o elemento ainda não decodificou o primeiro frame, aguarda o próximo ciclo
    if (!vw || !vh) {
      return;
    }

    if (!screenCanvasRef.current) {
      screenCanvasRef.current = document.createElement('canvas');
    }
    const canvas = screenCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const maxDim = 1280;
    let w = vw;
    let h = vh;
    if (w > maxDim || h > maxDim) {
      if (w > h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
    }
    canvas.width = w;
    canvas.height = h;

    try {
      ctx.drawImage(video, 0, 0, w, h);
      const frameData = canvas.toDataURL('image/jpeg', 0.65);
      setLastScreenSentTime(Date.now());
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        // Envia como tela oficial
        wsRef.current.send(JSON.stringify({
          t: 'screen-frame',
          room: 'monitor',
          fromClientId: myClientIdRef.current,
          fromName: myPeerName,
          frameData,
          timestamp: Date.now(),
          location: locationRef.current || undefined,
        }));

        // Envia também como stream-frame para o mural de CFTV e ronda
        wsRef.current.send(JSON.stringify({
          t: 'stream-frame',
          room: 'monitor',
          fromClientId: myClientIdRef.current,
          fromName: `${myPeerName} (Tela)`,
          frameData,
          location: locationRef.current || undefined,
        }));
      }
    } catch (err) {
      console.warn('Erro ao processar frame de tela:', err);
    }
  }, [myPeerName]);

  // 3. Captura Instantânea de Print de Tela do Celular (Compatibilidade Universal Mobile)
  const handleMobileScreenSnapshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1280;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
        }
        const frameData = canvas.toDataURL('image/jpeg', 0.75);
        setLastScreenSentTime(Date.now());
        setScreenActive(true);
        setScreenSourceType('snapshot');

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          // Envia como tela
          wsRef.current.send(JSON.stringify({
            t: 'screen-frame',
            room: 'monitor',
            fromClientId: myClientIdRef.current,
            fromName: myPeerName,
            frameData,
            timestamp: Date.now(),
            isSnapshot: true,
            location: locationRef.current || undefined,
          }));

          // Envia também como stream-frame da câmera e alerta para que apareça em todos os painéis
          wsRef.current.send(JSON.stringify({
            t: 'stream-frame',
            room: 'monitor',
            fromClientId: myClientIdRef.current,
            fromName: myPeerName,
            frameData,
            location: locationRef.current || undefined,
          }));

          wsRef.current.send(JSON.stringify({
            t: 'remote-alert',
            room: 'monitor',
            alertType: 'screen-snapshot',
            detail: `Captura de tela enviada por ${myPeerName}!`,
            snapshot: frameData,
            fromName: myPeerName,
          }));
        }
        triggerNotification('📱 Print de Tela Transmitido', 'A captura da tela do celular foi entregue com sucesso à Central.');
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 4. Compartilhamento de Tela & Transmissão Multi-Celulares
  const startScreenShare = async (forcedSource?: 'display' | 'camera_env' | 'camera_user') => {
    try {
      let stream: MediaStream | null = null;
      let usedSource: 'display' | 'camera_env' | 'camera_user' = 'display';

      const isHttpRemote = typeof window !== 'undefined' &&
        window.location.protocol === 'http:' &&
        !['localhost', '127.0.0.1'].includes(window.location.hostname);

      // 1. Tenta captura nativa de tela (getDisplayMedia) se não for câmera forçada
      const wantsDisplay = forcedSource === 'display' || !forcedSource;
      if (wantsDisplay && typeof navigator !== 'undefined' && navigator.mediaDevices?.getDisplayMedia) {
        try {
          // Utiliza restrições limpas e universais (sem cursor desktop-only que falha no Android)
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false,
          });
          usedSource = 'display';
        } catch (displayErr: any) {
          console.warn('getDisplayMedia (video+audio) falhou, tentando apenas video:true:', displayErr);
          if (displayErr?.name === 'NotAllowedError') {
            showToast('Compartilhamento de tela cancelado pelo usuário.', 'info');
            return;
          }
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            usedSource = 'display';
          } catch (displayErr2: any) {
            console.warn('getDisplayMedia falhou totalmente:', displayErr2);
            if (displayErr2?.name === 'NotAllowedError') {
              showToast('Compartilhamento de tela cancelado pelo usuário.', 'info');
              return;
            }
          }
        }
      }

      // 2. Se for solicitado câmera específica ou fallback inteligente:
      if (!stream && (forcedSource === 'camera_user' || forcedSource === 'camera_env')) {
        const targetFacing = forcedSource === 'camera_user' ? 'user' : 'environment';
        usedSource = forcedSource;

        if (navigator?.mediaDevices?.getUserMedia) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { ideal: targetFacing },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
              audio: false,
            });
          } catch {
            try {
              stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            } catch (cameraErr) {
              console.warn('Câmera móvel não acessível via getUserMedia:', cameraErr);
            }
          }
        }
      }

      // 3. Se obteve fluxo de vídeo ao vivo (seja tela nativa ou câmera do aparelho):
      if (stream) {
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach((track) => track.stop());
        }
        screenStreamRef.current = stream;
        setScreenSourceType(usedSource);
        setScreenActive(true);

        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = stream;
          screenVideoRef.current.setAttribute('playsinline', 'true');
          screenVideoRef.current.muted = true;
          screenVideoRef.current.onloadedmetadata = () => {
            screenVideoRef.current?.play().catch(() => {});
            setTimeout(captureAndSendScreenFrame, 50);
            setTimeout(captureAndSendScreenFrame, 150);
            setTimeout(captureAndSendScreenFrame, 350);
            setTimeout(captureAndSendScreenFrame, 700);
          };
          try {
            await screenVideoRef.current.play();
          } catch {}
        }

        const label = usedSource === 'display'
          ? '🖥️ Tela do Aparelho (Ao Vivo)'
          : usedSource === 'camera_env'
          ? '📱 Câmera Traseira (Como Tela)'
          : '🤳 Câmera Frontal (Como Tela)';

        showToast(label + ' conectada com sucesso!', 'success');
        triggerNotification(label, 'Transmissão em tempo real conectada à Central do Administrador.');

        setTimeout(captureAndSendScreenFrame, 100);
        setTimeout(captureAndSendScreenFrame, 300);
        setTimeout(captureAndSendScreenFrame, 600);
        setTimeout(captureAndSendScreenFrame, 1000);
        sendScreenTelemetry();

        const track = stream.getVideoTracks()[0];
        if (track) {
          track.onended = () => {
            stopScreenShare();
          };
        }
        return;
      }

      // 4. Se não foi possível obter stream nativo de vídeo (ex: restrição HTTP no celular ou iOS):
      if (isHttpRemote) {
        setScreenRequestFromAdmin(true);
        showToast('🔒 No celular, a transmissão contínua exige HTTPS (:4873) ou Envio de Print.', 'warning');
        return;
      }

      if (isMobileDevice) {
        // No celular, se o sistema operacional não suporta getDisplayMedia via web (ex: iOS ou navegador móvel restrito),
        // abre diretamente o seletor para enviar Print da Tela em 1 clique
        showToast('📸 Abrindo seletor para enviar Print da Tela ao Administrador...', 'info');
        const input = document.getElementById('mobile-screen-snapshot-input');
        if (input) input.click();
        return;
      }

      showToast('Captura contínua de tela não suportada neste navegador. Utilize a opção de Enviar Print ou acesse via HTTPS.', 'warning');
    } catch (err) {
      console.warn('Compartilhamento de tela finalizado:', err);
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    setScreenActive(false);
    sendScreenTelemetry();
  };

  const toggleMobileCameraFacing = () => {
    const next = mobileFacingMode === 'environment' ? 'user' : 'environment';
    setMobileFacingMode(next);
    if (screenActive && (screenSourceType === 'camera_env' || screenSourceType === 'camera_user')) {
      startScreenShare(next === 'user' ? 'camera_user' : 'camera_env');
    }
  };

  // Loop contínuo de envio de frames de tela
  useEffect(() => {
    if (!screenActive) return;
    const timer = setInterval(captureAndSendScreenFrame, 800);
    return () => clearInterval(timer);
  }, [screenActive, captureAndSendScreenFrame]);

  // Garante que o stream de tela seja mantido tocando no elemento <video>
  useEffect(() => {
    if (screenActive && screenStreamRef.current && screenVideoRef.current) {
      const v = screenVideoRef.current;
      if (v.srcObject !== screenStreamRef.current) {
        v.srcObject = screenStreamRef.current;
      }
      v.setAttribute('playsinline', 'true');
      v.muted = true;
      v.play().catch(() => {});
    }
  }, [screenActive]);

  // Telemetria periódica de áudio & dados de tela e GPS
  useEffect(() => {
    const timer = setInterval(async () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        if (!locationRef.current) {
          try {
            locationRef.current = await captureGpsLocation();
          } catch {}
        }
        wsRef.current.send(JSON.stringify({
          t: 'device-telemetry',
          room: 'monitor',
          fromClientId: myClientIdRef.current,
          fromName: myPeerName,
          audioLevel,
          isMicActive: micActive,
          isCameraActive: cameraActive,
          isScreenActive: screenActive,
          screenData: getScreenTelemetryData(),
          location: locationRef.current || undefined,
        }));
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [audioLevel, micActive, cameraActive, screenActive, getScreenTelemetryData, myPeerName]);

  // 5. Detecção de Movimento & Transmissão de Vídeo Contínuo (Loop de Canvas)
  useEffect(() => {
    if (!cameraActive) return;

    let isCapturing = false;
    const interval = setInterval(() => {
      if (isCapturing) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const motionCanvas = motionCanvasRef.current;
      if (!video || !canvas) return;

      if (mediaStreamRef.current && video.srcObject !== mediaStreamRef.current) {
        video.srcObject = mediaStreamRef.current;
        video.play().catch(() => {});
      }
      if (video.paused && mediaStreamRef.current) {
        video.play().catch(() => {});
      }

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;

      isCapturing = true;
      try {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const maxDim = 640;
        let w = vw;
        let h = vh;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(video, 0, 0, w, h);

        // Transmissão para o Administrador e outras estações na rede
        if (broadcastStream && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const frameData = canvas.toDataURL('image/jpeg', 0.5);
          wsRef.current.send(JSON.stringify({
            t: 'stream-frame',
            room: 'monitor',
            fromClientId: myClientIdRef.current,
            frameData,
            fromName: myPeerName,
            location: locationRef.current || undefined,
          }));
        }

      // Detecção de Movimento
      if (motionDetectionActive && motionCanvas) {
        const mCtx = motionCanvas.getContext('2d');
        if (mCtx) {
          motionCanvas.width = 64;
          motionCanvas.height = 48;
          mCtx.drawImage(video, 0, 0, 64, 48);
          const currentData = mCtx.getImageData(0, 0, 64, 48).data;

          if (prevFrameDataRef.current) {
            let diffCount = 0;
            const totalPixels = 64 * 48;
            for (let i = 0; i < currentData.length; i += 4) {
              const diffR = Math.abs(currentData[i] - prevFrameDataRef.current[i]);
              const diffG = Math.abs(currentData[i + 1] - prevFrameDataRef.current[i + 1]);
              const diffB = Math.abs(currentData[i + 2] - prevFrameDataRef.current[i + 2]);
              if (diffR + diffG + diffB > motionSensitivity * 3) {
                diffCount++;
              }
            }

            const percentChanged = (diffCount / totalPixels) * 100;
            if (percentChanged > 6) { // Mais de 6% da imagem alterou
              const now = Date.now();
              setMotionDetectedCount((c) => c + 1);
              setLastMotionTime(now);

              const snapshotData = canvas.toDataURL('image/jpeg', 0.7);
              setSnapshots((prev) => [
                {
                  id: 'snap_' + now,
                  timestamp: now,
                  imageData: snapshotData,
                  label: `Movimento Local (${Math.round(percentChanged)}% variação)`,
                },
                ...prev.slice(0, 19),
              ]);

              playAlertSound();
              triggerNotification(
                '🚨 Movimento Detectado!',
                `Atividade identificada na câmera vigiada (${Math.round(percentChanged)}% de variação).`
              );

              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                  t: 'remote-alert',
                  room: 'monitor',
                  alertType: 'motion',
                  detail: `Movimento detectado no ambiente vigiado por ${myPeerName}!`,
                  snapshot: snapshotData,
                  fromName: myPeerName,
                }));
              }
            }
          }
          prevFrameDataRef.current = new Uint8ClampedArray(currentData);
        }
      }
    } finally {
      isCapturing = false;
    }
  }, 400); // 2.5 frames por segundo

    return () => clearInterval(interval);
  }, [cameraActive, broadcastStream, motionDetectionActive, motionSensitivity, myPeerName, playAlertSound, triggerNotification]);

  // 6. Envio de Arquivos na Rede Local
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      showToast('Tamanho máximo recomendado para transferência direta é de 25 MB.', 'warning');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const sharedFile: SharedRemoteFile = {
        id: 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        dataUrl,
        ownerName: myPeerName,
        timestamp: Date.now(),
      };

      setSharedFiles((prev) => [sharedFile, ...prev]);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          t: 'file-offer',
          room: 'monitor',
          file: sharedFile,
          fromName: myPeerName,
        }));
      }

      setIsUploading(false);
      triggerNotification('Arquivo Compartilhado', `"${file.name}" está pronto para acesso remoto.`);
    };

    reader.readAsDataURL(file);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="space-y-6">
      {/* ======================================================== */}
      {/* ======================================================== */}
      {/* TELA DE BLOQUEIO DE SEGURANÇA & CONTROLE PARENTAL        */}
      {/* ======================================================== */}
      {isTerminalLocked && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center select-none text-slate-100 animate-in fade-in">
          <div className="max-w-md w-full space-y-6">
            <div className="flex items-center justify-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-widest bg-rose-500/10 border border-rose-500/30 px-4 py-1.5 rounded-full mx-auto w-fit">
              <Lock className="w-4 h-4" /> CONTENÇÃO DE ACESSO & SEGURANÇA
            </div>

            <div className="space-y-3">
              <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400 shadow-2xl shadow-rose-900/50">
                <Lock className="w-10 h-10 animate-pulse" />
              </div>

              <h1 className="text-2xl font-black text-white tracking-tight">
                {myPeerName} — ACESSO RESTRITO
              </h1>

              <div className="font-mono text-3xl font-extrabold text-amber-400 py-1">
                {currentTimeStr}
              </div>

              <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-2">
                <p className="font-semibold text-rose-300">
                  {terminalLockReason}
                </p>
                <p className="text-[11px] text-slate-400">
                  O acesso a este dispositivo foi temporariamente suspenso pela administração de segurança ou política parental.
                </p>
              </div>
            </div>

            {/* Desbloqueio com Senha de Administrador */}
            <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Desbloqueio do Administrador:</span>
                <span className="text-[10px] text-slate-500">PIN Master</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={adminUnlockPin}
                  onChange={(e) => {
                    setAdminUnlockPin(e.target.value);
                    setUnlockError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (adminUnlockPin === DEFAULT_SYSTEM_PASSWORD || adminUnlockPin === '1234' || adminUnlockPin === 'admin') {
                        setIsTerminalLocked(false);
                        setAdminUnlockPin('');
                        setUnlockError(null);
                      } else {
                        setUnlockError('Senha incorreta.');
                      }
                    }
                  }}
                  placeholder="Digite o PIN de administrador..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (adminUnlockPin === DEFAULT_SYSTEM_PASSWORD || adminUnlockPin === '1234' || adminUnlockPin === 'admin') {
                      setIsTerminalLocked(false);
                      setAdminUnlockPin('');
                      setUnlockError(null);
                    } else {
                      setUnlockError('Senha incorreta.');
                    }
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                >
                  Desbloquear
                </button>
              </div>
              {unlockError && (
                <p className="text-[10px] text-rose-400 font-semibold">{unlockError}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* BANNER DE ALARME SONORO ATIVO (DESLIGAR CLICANDO NELE)    */}
      {/* ======================================================== */}
      {isAlarmActive && (
        <div
          onClick={handleSilenceAlarm}
          className="bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white p-4 rounded-2xl border-2 border-red-300 shadow-2xl flex items-center justify-between cursor-pointer animate-pulse transition-all select-none"
          title="Clique para desligar e silenciar o alarme imediatamente"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black/30 rounded-xl">
              <VolumeX className="w-7 h-7 text-white animate-bounce" />
            </div>
            <div>
              <div className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                <span>🚨 ALARME SONORO DISPARADO PELA CENTRAL</span>
                <span className="text-[10px] bg-white text-red-700 px-2 py-0.5 rounded-full font-black">SIRENE ATIVA</span>
              </div>
              <p className="text-xs text-red-100 font-medium">
                O Administrador acionou a sirene. <strong>Clique neste aviso para desligar o som imediatamente!</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSilenceAlarm();
            }}
            className="px-4 py-2.5 bg-black/40 hover:bg-black/60 border border-white/50 text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <VolumeX className="w-4 h-4 text-red-300" />
            <span>🔇 Desligar Alarme</span>
          </button>
        </div>
      )}

      {/* BANNER DE INTERFONE AO VIVO DA ADMINISTRAÇÃO */}
      {incomingIntercom && (
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-4 rounded-2xl border-2 border-emerald-400 shadow-2xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-black/20 rounded-xl">
              <Volume2 className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <div className="font-black text-xs sm:text-sm uppercase tracking-wider">
                🔊 INTERFONE AO VIVO: {incomingIntercom.fromName}
              </div>
              <div className="text-xs text-emerald-100 font-medium">
                Administrador transmitindo voz ao vivo pelo alto-falante.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={isUserIntercomActive ? stopUserIntercom : startUserIntercom}
            className="px-3.5 py-2 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-400 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
          >
            <Mic className="w-4 h-4 text-emerald-300" />
            <span>{isUserIntercomActive ? '🔴 Enviando Voz...' : '🎙️ Responder (Falar)'}</span>
          </button>
        </div>
      )}

      {/* Top Banner de Monitoramento & Acesso Remoto */}
      <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Radio className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100">Nó Transmissor de Câmera & Microfone</h2>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-semibold ${
                connected
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              }`}>
                {connected ? 'LAN CONECTADO' : 'OFFLINE'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Vigilância de ambiente • Transmissão exclusiva para o Painel do Administrador • Microfone & Arquivos
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {notificationPermission !== 'granted' ? (
            <button
              type="button"
              onClick={requestNotificationPermission}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold rounded-xl border border-indigo-500/40 transition-all"
            >
              <Bell className="w-3.5 h-3.5" /> Ativar Notificações
            </button>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-300 text-xs font-semibold rounded-xl border border-emerald-500/30">
              <Bell className="w-3.5 h-3.5 text-emerald-400" /> Notificações Ativas
            </span>
          )}

          <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs font-mono text-slate-300">
            <span className="text-slate-500">Nó:</span>
            <input
              type="text"
              value={myPeerName}
              onChange={(e) => setMyPeerName(e.target.value)}
              className="bg-transparent text-slate-200 font-bold focus:outline-none w-28"
            />
          </div>
        </div>
      </div>

      {/* PAINEL DE DISPARO RÁPIDO DO CELULAR (1-TOQUE) */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-purple-950/40 rounded-2xl border border-emerald-500/30 p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-xs text-emerald-300 uppercase tracking-wider">
              Disparo Rápido do Dispositivo para a Central
            </h3>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30 font-semibold">
            100% COMPATÍVEL NO CELULAR
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Ação Interfone: Conversa com o Administrador */}
          <button
            type="button"
            onClick={isUserIntercomActive ? stopUserIntercom : startUserIntercom}
            className={`py-3.5 px-4 font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 text-center border ${
              isUserIntercomActive
                ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 shadow-rose-950/50 animate-pulse'
                : 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white border-emerald-400/40 shadow-emerald-950/40'
            }`}
            title="Pressione para falar ao vivo com o Administrador (Interfone bidirecional)"
          >
            {isUserIntercomActive ? (
              <>
                <Radio className="w-4 h-4 shrink-0 animate-ping" />
                <span>🔴 Falando... (Clique p/ Enviar)</span>
              </>
            ) : (
              <>
                <PhoneCall className="w-4 h-4 shrink-0" />
                <span>🎙️ Interfone / Falar com Admin</span>
              </>
            )}
          </button>

          {/* Ação 1: Tirar Foto */}
          <label className="py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-900/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 text-center">
            <Camera className="w-4 h-4 shrink-0" />
            <span>📸 Tirar Foto & Transmitir</span>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleMobilePhotoCapture}
              className="hidden"
            />
          </label>

          {/* Ação 2: Gravar Áudio */}
          <label className="py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-900/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 text-center">
            <Mic className="w-4 h-4 shrink-0" />
            <span>🎙️ Gravar Áudio do Celular</span>
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              capture={"user" as any}
              onChange={handleMobileAudioCapture}
              className="hidden"
            />
          </label>

          {/* Ação 3: Compartilhar Tela — Seletor Adaptativo Computador vs Smartphone */}
          <div className="space-y-2 p-3 bg-slate-950/60 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-indigo-400" />
                <span>Modo de Tela:</span>
              </span>
              <div className="inline-flex items-center bg-slate-900 p-0.5 rounded-xl border border-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setScreenDeviceMode('desktop')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                    screenDeviceMode === 'desktop'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Monitor className="w-3 h-3" />
                  <span>💻 Computador</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScreenDeviceMode('mobile')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                    screenDeviceMode === 'mobile'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Smartphone className="w-3 h-3" />
                  <span>📱 Smartphone</span>
                </button>
              </div>
            </div>

            {screenActive ? (
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={stopScreenShare}
                  className="flex-1 py-3 px-3 font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 text-center text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-rose-900/30 ring-2 ring-rose-400"
                >
                  <Monitor className="w-4 h-4 shrink-0" />
                  <span>⏹️ Parar Transmissão</span>
                </button>
                {(screenSourceType === 'camera_env' || screenSourceType === 'camera_user' || isMobileDevice) && (
                  <button
                    type="button"
                    onClick={toggleMobileCameraFacing}
                    className="px-3.5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                    title="Alternar entre Câmera Traseira e Frontal"
                  >
                    <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin-once" />
                    <span>{mobileFacingMode === 'environment' ? '🤳 Frontal' : '📷 Traseira'}</span>
                  </button>
                )}
              </div>
            ) : screenDeviceMode === 'desktop' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => startScreenShare('display')}
                  className="py-3 px-3 font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 text-center text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 shadow-indigo-900/30"
                >
                  <Monitor className="w-4 h-4 shrink-0" />
                  <span>🖥️ Compartilhar Tela / Janela</span>
                </button>
                <button
                  type="button"
                  onClick={() => startScreenShare('camera_user')}
                  className="py-3 px-3 font-bold text-xs rounded-xl border border-indigo-500/30 bg-slate-900 hover:bg-slate-800 text-indigo-300 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 text-center"
                >
                  <Camera className="w-4 h-4 shrink-0" />
                  <span>📹 Webcam como Tela</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => startScreenShare('display')}
                    className="py-3 px-3 font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 text-center text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 shadow-indigo-900/30"
                    title="Inicia transmissão da tela do celular ao vivo"
                  >
                    <Monitor className="w-4 h-4 shrink-0" />
                    <span>🖥️ Transmitir Tela do Aparelho (Ao Vivo)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('mobile-screen-snapshot-input');
                      if (input) input.click();
                    }}
                    className="py-3 px-3 bg-slate-900 hover:bg-slate-800 text-slate-100 text-xs font-bold rounded-xl border border-indigo-500/40 flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                    title="Envie uma captura de tela recente ou print da tela do celular"
                  >
                    <Upload className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>📸 Enviar Print da Tela</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => startScreenShare('camera_env')}
                    className="py-2.5 px-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl border border-slate-800 flex items-center justify-center gap-1.5 transition-all"
                    title="Transmite a câmera traseira do celular como fonte de tela"
                  >
                    <Camera className="w-3.5 h-3.5 text-slate-400" />
                    <span>📷 Câmera Traseira</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => startScreenShare('camera_user')}
                    className="py-2.5 px-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl border border-slate-800 flex items-center justify-center gap-1.5 transition-all"
                    title="Transmite a câmera frontal (selfie) como fonte de tela"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                    <span>🤳 Câmera Frontal</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Ação 4: Enviar Arquivo */}
          <label className="py-3.5 px-4 bg-gradient-to-r from-slate-800 to-slate-700 hover:bg-slate-700 text-slate-100 font-bold text-xs rounded-xl border border-slate-600 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 text-center">
            <Upload className="w-4 h-4 shrink-0 text-purple-400" />
            <span>📁 Enviar Arquivo à Central</span>
            <input
              type="file"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Indicadores de Entrega */}
        <div className="flex items-center flex-wrap gap-3 text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
          <span className="flex items-center gap-1">
            <CheckCircle className={`w-3.5 h-3.5 ${lastCapturedPhoto ? 'text-emerald-400' : 'text-slate-600'}`} />
            <span>Foto: {lastCapturedPhoto ? 'Transmitida' : 'Aguardando captura'}</span>
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle className={`w-3.5 h-3.5 ${lastAudioSentTime ? 'text-indigo-400' : 'text-slate-600'}`} />
            <span>Áudio: {lastAudioSentTime ? `Enviado às ${new Date(lastAudioSentTime).toLocaleTimeString('pt-BR')}` : 'Aguardando gravação'}</span>
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle className={`w-3.5 h-3.5 ${sharedFiles.length > 0 ? 'text-purple-400' : 'text-slate-600'}`} />
            <span>Arquivos: {sharedFiles.length} enviado(s)</span>
          </span>
        </div>
      </div>

      {/* Alerta Amigável para Celular em Rede HTTP */}
      {!isMediaDevicesAvailable && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-200 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Smartphone className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-300 block">
                  Dispositivo Móvel Detectado via HTTP Local
                </span>
                <p className="text-[11px] text-amber-200/80 mt-0.5">
                  Navegadores móveis bloqueiam o vídeo ao vivo contínuo em endereços <code>http://</code> que não sejam localhost.
                  Você pode usar a <strong>Câmera Nativa do Celular</strong> para fotos instantâneas imediatas ou seguir o guia rápido do Chrome para liberar vídeo ao vivo contínuo.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowMobileGuide(true)}
              className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl font-semibold text-xs border border-amber-500/40 shrink-0 flex items-center gap-1"
            >
              <HelpCircle className="w-3.5 h-3.5" /> Ver Guia do Celular
            </button>
          </div>
        </div>
      )}

      {/* Grid: Transmissão Local da Câmera & Visualizador de Câmeras Remotas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Painel 1: Transmissão da Câmera do Computador ou Celular Local */}
        <div className="lg:col-span-6 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
          {window.location.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(window.location.hostname) && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-base">🔒</span>
                <div>
                  <p className="font-bold text-amber-300">Câmera no Celular sem Internet:</p>
                  <p className="text-[11px] text-slate-300">Para liberar a Câmera e Microfone sem internet, acesse via HTTPS Seguro.</p>
                </div>
              </div>
              <a
                href={`https://${window.location.hostname}:4873`}
                className="shrink-0 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl text-center transition-colors"
              >
                Abrir em HTTPS (Porta 4873) 🔒
              </a>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-emerald-400" />
              <h3 className="font-semibold text-xs text-slate-200 uppercase tracking-wider">
                Câmera do Computador / Celular Local
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {cameraActive && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-400">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" /> AO VIVO
                </span>
              )}
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {cameraFacingMode === 'user' ? '🤳 Frontal' : '📷 Traseira'}
              </span>
            </div>
          </div>

          {/* Barra de Seleção e Alternância Rápida de Câmera */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-950/70 rounded-xl border border-slate-800 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-medium">Lente:</span>
              <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setCameraFacingMode('user');
                    if (cameraActive) startCamera('user');
                    else showToast('🤳 Câmera Frontal selecionada para o próximo início.', 'info');
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1 ${
                    cameraFacingMode === 'user'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>🤳 Frontal</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCameraFacingMode('environment');
                    if (cameraActive) startCamera('environment');
                    else showToast('📷 Câmera Traseira selecionada para o próximo início.', 'info');
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1 ${
                    cameraFacingMode === 'environment'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>📷 Traseira</span>
                </button>
              </div>

              <button
                type="button"
                onClick={toggleCameraFacing}
                title="Inverter entre Câmera Frontal e Traseira"
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors flex items-center gap-1 text-[11px]"
              >
                <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Inverter</span>
              </button>
            </div>

            {availableCameras.length > 1 && (
              <select
                value={selectedCameraDeviceId}
                onChange={(e) => {
                  setSelectedCameraDeviceId(e.target.value);
                  if (cameraActive) {
                    startCamera(cameraFacingMode, e.target.value);
                  }
                }}
                className="bg-slate-900 border border-slate-700 text-slate-200 text-[11px] rounded-lg px-2 py-1 outline-none max-w-[190px] truncate"
              >
                <option value="">Câmera Automática ({cameraFacingMode === 'user' ? 'Frontal' : 'Traseira'})</option>
                {availableCameras.map((device, idx) => (
                  <option key={device.deviceId || idx} value={device.deviceId}>
                    {device.label || `Câmera ${idx + 1}`}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Alerta Não-Bloqueante se houver aviso de câmera */}
          {cameraStatusMessage && (
            <div className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 border ${
              cameraStatusMessage.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : cameraStatusMessage.type === 'warning'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
            }`}>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{cameraStatusMessage.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setCameraStatusMessage(null)}
                className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

          {/* Elementos ocultos permanentemente montados para garantir captura e transmissão contínua */}
          <canvas ref={canvasRef} className="hidden" />
          <canvas ref={motionCanvasRef} className="hidden" />
          <canvas ref={screenCanvasRef} className="hidden" />
          <input
            id="mobile-screen-snapshot-input"
            type="file"
            accept="image/*"
            onChange={handleMobileScreenSnapshot}
            className="hidden"
          />

          <div className="relative aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
            {/* O elemento de vídeo da câmera permanece SEMPRE montado para garantir persistência do ref e stream imediato */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`w-full h-full object-cover transform ${
                cameraFacingMode === 'user' ? '-scale-x-100' : 'scale-x-100'
              } ${cameraActive && !screenActive ? 'block' : 'hidden'}`}
            />

            {/* O elemento de vídeo da tela (permanece sempre com aceleração ativa sem display:none) */}
            <video
              ref={screenVideoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-contain"
              style={
                screenActive
                  ? { display: 'block' }
                  : { position: 'absolute', top: 0, left: 0, width: '1px', height: '1px', opacity: 0, pointerEvents: 'none', zIndex: -1 }
              }
            />

            {screenActive ? (
              <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-indigo-500/60 font-mono text-[10px] text-indigo-300 flex items-center gap-2 z-10">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                <span>TRANSMITINDO AO VIVO ({screenSourceType === 'display' ? 'TELA DO APARELHO' : screenSourceType === 'camera_user' ? 'CÂMERA FRONTAL' : screenSourceType === 'snapshot' ? 'PRINT DA TELA' : 'CÂMERA TRASEIRA'})</span>
              </div>
            ) : cameraActive ? (
              <>
                {/* HUD Overlay de Monitoramento */}
                <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-[10px] text-slate-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>TRANSMITINDO NA LAN AO VIVO ({cameraFacingMode === 'user' ? 'FRONTAL' : 'TRASEIRA'})</span>
                </div>

                {/* VU Meter de Áudio */}
                <div className="absolute bottom-3 left-3 right-3 bg-slate-950/80 backdrop-blur-md p-2 rounded-xl border border-slate-700/60 flex items-center gap-3">
                  <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 transition-all duration-75"
                      style={{ width: `${audioLevel}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 w-8 text-right">{audioLevel}%</span>
                </div>
              </>
            ) : lastCapturedPhoto ? (
              <div className="relative w-full h-full">
                <img src={lastCapturedPhoto} alt="Última captura" className="w-full h-full object-cover" />
                <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono text-[10px] text-emerald-300">
                  📸 ÚLTIMA FOTO DO CELULAR TRANSMITIDA
                </div>
              </div>
            ) : (
              <div className="text-center p-6 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                  <CameraOff className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-slate-200">Câmera e Tela em Repouso</h4>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Inicie a tela ao vivo, câmera ou envie um print para transmitir à Central.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Botões de Ação para Câmera */}
          <div className="space-y-2.5">
            {/* Botão de Captura Nativa do Celular (Sempre funciona, mesmo via HTTP) */}
            <label className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-900/30 flex items-center justify-center gap-2 cursor-pointer transition-all">
              <Camera className="w-4 h-4" />
              <span>📸 Tirar Foto com Câmera do Celular & Transmitir</span>
              <input
                type="file"
                accept="image/*"
                capture={cameraFacingMode}
                onChange={handleMobilePhotoCapture}
                className="hidden"
              />
            </label>

            {/* Controles para Vídeo ao Vivo Contínuo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {!cameraActive ? (
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-all col-span-2"
                >
                  <Camera className="w-4 h-4" /> Ativar Vídeo ao Vivo
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-all col-span-2"
                >
                  <CameraOff className="w-4 h-4" /> Desligar Vídeo
                </button>
              )}

              <button
                type="button"
                onClick={toggleCameraFacing}
                title="Inverter entre Câmera Frontal e Traseira"
                className="py-2.5 text-xs font-semibold rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                <RefreshCw className="w-4 h-4 text-cyan-400" />
                <span>{cameraFacingMode === 'user' ? '🤳 Frontal' : '📷 Traseira'}</span>
              </button>

              <button
                type="button"
                onClick={toggleMic}
                disabled={!cameraActive}
                className={`py-2.5 text-xs font-semibold rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                  micActive
                    ? 'bg-slate-800 text-slate-200 border-slate-700'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                } disabled:opacity-50`}
              >
                {micActive ? <Mic className="w-4 h-4 text-emerald-400" /> : <MicOff className="w-4 h-4 text-rose-400" />}
                <span>{micActive ? 'Mic Ligado' : 'Mic Mudo'}</span>
              </button>
            </div>
          </div>

          {motionDetectionActive && (
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-1.5 font-semibold text-amber-400">
                  <Shield className="w-3.5 h-3.5" /> Sensor Óptico de Movimento Ativo
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {motionDetectedCount} detecção(ões)
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-400 shrink-0">Sensibilidade:</span>
                <input
                  type="range"
                  min="10"
                  max="60"
                  value={motionSensitivity}
                  onChange={(e) => setMotionSensitivity(parseInt(e.target.value, 10))}
                  className="flex-1 accent-amber-500"
                />
                <span className="text-[11px] font-mono text-slate-300">{motionSensitivity}</span>
              </div>
            </div>
          )}
        </div>

        {/* Painel 2: Nó Sensor de Microfone & Transmissão de Áudio para o Administrador */}
        <div className="lg:col-span-6 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mic className="w-5 h-5 text-emerald-400" />
              <h3 className="font-semibold text-xs text-slate-200 uppercase tracking-wider">
                Microfone & Gravação de Áudio para o Administrador
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              TRANSMISSÃO PRIVADA
            </span>
          </div>

          {/* Card do Microfone / VU Meter e Status */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isRecordingAudio
                    ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400 animate-pulse'
                    : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                }`}>
                  <Mic className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-200 block">
                    {isRecordingAudio ? 'Gravando Áudio do Ambiente...' : 'Microfone em Prontidão'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {isRecordingAudio
                      ? `Tempo: ${audioRecordingDuration}s (o áudio será enviado diretamente à Central)`
                      : lastAudioSentTime
                      ? `Último áudio enviado às ${new Date(lastAudioSentTime).toLocaleTimeString('pt-BR')}`
                      : 'Nenhum áudio gravado recentemente'}
                  </span>
                </div>
              </div>

              {cameraActive && (
                <div className="text-right">
                  <span className="text-[10px] font-mono text-slate-400 block">Volume Ambiente</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">{audioLevel}%</span>
                </div>
              )}
            </div>

            {/* VU Meter de Áudio em Tempo Real */}
            <div className="space-y-1">
              <div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 transition-all duration-75"
                  style={{ width: `${cameraActive ? audioLevel : isRecordingAudio ? 65 : 0}%` }}
                />
              </div>
            </div>

            {/* Botões de Gravação de Áudio */}
            <div className="space-y-2 pt-1">
              {!isRecordingAudio ? (
                <button
                  type="button"
                  onClick={startAudioRecording}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition-all"
                >
                  <Mic className="w-4 h-4" />
                  <span>🎙️ Iniciar Gravação de Áudio (Microfone)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopAudioRecording}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md animate-pulse transition-all"
                >
                  <Square className="w-4 h-4" />
                  <span>⏹️ Parar & Transmitir ao Administrador ({audioRecordingDuration}s)</span>
                </button>
              )}

              {/* Gravação Nativa de Voz no Celular (Funciona 100% via HTTP no smartphone) */}
              <label className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-all">
                <Smartphone className="w-4 h-4 text-indigo-400" />
                <span>📱 Gravar com Gravador Nativo do Celular</span>
                <input
                  type="file"
                  accept="audio/*"
                  capture={"user" as any}
                  onChange={handleMobileAudioCapture}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Aviso de Segurança e Privacidade Blue Team */}
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-300 block">
                Privacidade & Exclusividade do Administrador
              </span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Por política defensiva de isolamento de rede, as transmissões de câmera, fotos e microfone desta estação são enviadas com exclusividade para o <strong>Painel do Administrador Autenticado</strong>. Usuários comuns não têm acesso aos feeds uns dos outros.
              </p>
            </div>
          </div>

          {/* Galeria de Snapshots de Movimento */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span>Capturas Recentes de Movimento ({snapshots.length})</span>
              {snapshots.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSnapshots([])}
                  className="text-slate-500 hover:text-rose-400 text-[11px] flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Limpar
                </button>
              )}
            </div>

            <div className="h-32 overflow-x-auto flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              {snapshots.length === 0 ? (
                <span className="text-xs text-slate-500 mx-auto">
                  Nenhum movimento registrado até o momento.
                </span>
              ) : (
                snapshots.map((snap) => (
                  <div key={snap.id} className="relative w-36 h-24 rounded-lg overflow-hidden shrink-0 border border-slate-800 group">
                    <img src={snap.imageData} alt="Snapshot" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-1.5 text-[9px] font-mono text-slate-200">
                      {new Date(snap.timestamp).toLocaleTimeString('pt-BR')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Painel 3: Central Remota de Arquivos (LAN Drop & Remote Explorer) */}
      <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FolderSync className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-sm text-slate-100">
              Compartilhamento & Acesso Remoto a Arquivos
            </h3>
          </div>

          <label className="cursor-pointer px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-md transition-all">
            <Upload className="w-4 h-4" />
            <span>{isUploading ? 'Enviando...' : 'Enviar Arquivo para Máquinas Remotas'}</span>
            <input type="file" onChange={handleFileUpload} className="hidden" disabled={isUploading} />
          </label>
        </div>

        <p className="text-xs text-slate-400">
          Envie ou solicite arquivos diretamente entre seus computadores pela rede local sem depender da internet.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-medium">
                <th className="py-2.5 px-3">Nome do Arquivo</th>
                <th className="py-2.5 px-3">Tamanho</th>
                <th className="py-2.5 px-3">Origem</th>
                <th className="py-2.5 px-3">Data</th>
                <th className="py-2.5 px-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sharedFiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Nenhum arquivo compartilhado na rede ainda. Clique em "Enviar Arquivo" acima.
                  </td>
                </tr>
              ) : (
                sharedFiles.map((file) => (
                  <tr key={file.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-200 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-400" />
                      <span>{file.name}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">
                      {formatFileSize(file.size)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {file.ownerName}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">
                      {new Date(file.timestamp).toLocaleTimeString('pt-BR')}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <a
                        href={file.dataUrl}
                        download={file.name}
                        className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all"
                      >
                        <Download className="w-3.5 h-3.5" /> Baixar
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Guia Rápido de Liberação de Câmera no Chrome Android */}
      {showMobileGuide && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowMobileGuide(false)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-100">
                  Como Liberar Câmera ao Vivo no Celular
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileGuide(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              O Google Chrome no Android e outros navegadores móveis bloqueiam a câmera ao vivo quando o site está em <code>http://</code> comum. Veja como liberar sem precisar de internet:
            </p>

            <div className="space-y-3">
              {/* Opção Recomendada: HTTPS Seguro Offline */}
              <div className="p-3 bg-emerald-950/40 rounded-2xl border border-emerald-500/40 space-y-2">
                <span className="font-bold text-xs text-emerald-300 flex items-center gap-1.5">
                  ⭐ Opção Recomendada: Modo HTTPS Seguro Offline (Sem Internet)
                </span>
                <p className="text-[11px] text-slate-300">
                  O servidor já roda com Certificado Digital SSL próprio na porta <strong>4873</strong>. Basta tocar no botão abaixo:
                </p>
                <a
                  href={`https://${window.location.hostname}:4873`}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                  🔒 Abrir Agora via HTTPS (Porta 4873)
                </a>
                <p className="text-[10px] text-emerald-200/80">
                  💡 <em>Nota:</em> O navegador dirá <strong>"Sua conexão não é particular"</strong> (porque o certificado foi gerado offline no seu PC). Basta tocar em <strong>"Avançado"</strong> e depois em <strong>"Continuar para o site"</strong> para liberar a câmera e o microfone!
                </p>
              </div>

              {/* Opção 1: Câmera Nativa sem configuração */}
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
                <span className="font-bold text-xs text-amber-400 block">
                  Opção 2: Usar Foto Nativa do Celular (Pronto Agora)
                </span>
                <p className="text-[11px] text-slate-400">
                  Basta clicar no botão roxo <strong>"📸 Tirar Foto com Câmera do Celular & Transmitir"</strong>. Ele abre o app de câmera nativo do celular sem nenhuma configuração necessária.
                </p>
              </div>

              {/* Opção 3: Flag do Chrome Android para quem quer usar HTTP */}
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                <span className="font-bold text-xs text-slate-300 block">
                  Opção 3: Liberar HTTP via flags do Chrome
                </span>
                <ol className="text-[11px] text-slate-400 space-y-1 list-decimal pl-4">
                  <li>No Chrome, digite: <code className="text-amber-300 bg-slate-900 px-1 py-0.5 rounded">chrome://flags</code></li>
                  <li>Pesquise por <code className="text-amber-300 bg-slate-900 px-1 py-0.5 rounded">unsafely-treat-insecure-origin-as-secure</code></li>
                  <li>Ative (Enabled), adicione <code className="text-amber-300">{window.location.origin}</code> e reinicie o navegador.</li>
                </ol>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowMobileGuide(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
            >
              Entendido, Fechar Guia
            </button>
          </div>
        </div>
      )}

      {/* Modal de Solicitação de Tela Remota da Central do Administrador */}
      {screenRequestFromAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-indigo-500/50 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl shadow-indigo-950/80 text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center mx-auto text-indigo-400 animate-pulse">
              <Monitor className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Central Solicitou sua Tela</h3>
              <p className="text-xs text-slate-300">
                O Administrador solicitou visualizar a tela ou câmera ao vivo deste dispositivo. Escolha como deseja transmitir:
              </p>
            </div>
            <div className="space-y-2 pt-2">
              {window.location.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(window.location.hostname) && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-left text-xs text-amber-200 space-y-1.5">
                  <p className="font-bold text-amber-300 flex items-center gap-1.5">
                    <span>🔒</span> Conexão HTTP no Celular:
                  </p>
                  <p className="text-[11px] text-slate-300">
                    O navegador móvel bloqueia o compartilhamento ao vivo contínuo em conexões HTTP. Para transmitir ao vivo sem bloqueios, abra via HTTPS seguro:
                  </p>
                  <a
                    href={`https://${window.location.hostname}:4873`}
                    className="block w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg text-center transition-colors shadow-md"
                  >
                    🔒 Abrir em HTTPS (Porta 4873)
                  </a>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setScreenRequestFromAdmin(false);
                  startScreenShare('display');
                }}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl font-bold text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                <Monitor className="w-4 h-4" /> 🖥️ Transmitir Tela do Aparelho (Ao Vivo)
              </button>
              <button
                type="button"
                onClick={() => {
                  setScreenRequestFromAdmin(false);
                  const input = document.getElementById('mobile-screen-snapshot-input');
                  if (input) input.click();
                }}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                <Upload className="w-4 h-4 text-white" /> 📸 Enviar Print da Tela (Universal: HTTP ou HTTPS)
              </button>
              <button
                type="button"
                onClick={() => {
                  setScreenRequestFromAdmin(false);
                  startScreenShare('camera_env');
                }}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-xs border border-slate-700 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                <Camera className="w-4 h-4 text-emerald-400" /> 📷 Transmitir Câmera Traseira como Tela
              </button>
              <button
                type="button"
                onClick={() => {
                  setScreenRequestFromAdmin(false);
                  startScreenShare('camera_user');
                }}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-xs border border-slate-700 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                <Smartphone className="w-4 h-4 text-cyan-400" /> 🤳 Transmitir Câmera Frontal como Tela
              </button>
              <button
                type="button"
                onClick={() => setScreenRequestFromAdmin(false)}
                className="w-full py-1.5 text-slate-500 hover:text-slate-400 text-[11px]"
              >
                Dispensar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Não-Bloqueante Elegante (Substituto dos Popups de Erro Nativos) */}
      {toastNotification && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full animate-in slide-in-from-bottom-3 duration-200">
          <div className={`p-3.5 rounded-2xl shadow-2xl backdrop-blur-xl border flex items-center gap-3 text-xs ${
            toastNotification.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/40 text-rose-200 shadow-rose-950/50'
              : toastNotification.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200 shadow-emerald-950/50'
              : toastNotification.type === 'warning'
              ? 'bg-amber-950/90 border-amber-500/40 text-amber-200 shadow-amber-950/50'
              : 'bg-slate-900/90 border-slate-700/60 text-slate-200 shadow-slate-950/50'
          }`}>
            {toastNotification.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            ) : toastNotification.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : toastNotification.type === 'warning' ? (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            ) : (
              <Check className="w-5 h-5 text-cyan-400 shrink-0" />
            )}
            <span className="flex-1 font-medium leading-relaxed">{toastNotification.text}</span>
            <button
              type="button"
              onClick={() => setToastNotification(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
