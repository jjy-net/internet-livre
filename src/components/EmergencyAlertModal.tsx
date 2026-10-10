import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldAlert, AlertTriangle, Info, Volume2, VolumeX, CheckCircle2, BellRing, Radio, X } from 'lucide-react';

export interface EmergencyAlertData {
  id: string;
  title: string;
  message: string;
  level?: 'critical' | 'warning' | 'info';
  timestamp?: number;
  senderName?: string;
  targetClientId?: string;
}

interface EmergencyAlertModalProps {
  serverUrl?: string;
  clientId?: string;
  userName?: string;
  isAdmin?: boolean;
}

export const EmergencyAlertModal: React.FC<EmergencyAlertModalProps> = ({
  serverUrl: propServerUrl,
  clientId: propClientId,
  userName: propUserName,
  isAdmin = false,
}) => {
  const [currentAlert, setCurrentAlert] = useState<EmergencyAlertData | null>(null);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [isSirenActive, setIsSirenActive] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sirenIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const vibrationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const getBaseId = () => {
    if (propClientId) return propClientId;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('dl_chat_client_id');
      if (stored) return stored;
    }
    const generated = 'client-' + Math.random().toString(36).substring(2, 9);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('dl_chat_client_id', generated);
      } catch {}
    }
    return generated;
  };

  const baseClientIdRef = useRef<string>(getBaseId());
  const clientIdRef = useRef<string>(`${baseClientIdRef.current}-alert`);
  const userNameRef = useRef<string>(
    propUserName || (typeof window !== 'undefined' ? localStorage.getItem('dl_chat_name') : null) || 'Usuário Local'
  );

  useEffect(() => {
    if (propClientId) {
      baseClientIdRef.current = propClientId;
      clientIdRef.current = `${propClientId}-alert`;
    }
    if (propUserName) {
      userNameRef.current = propUserName;
    }
  }, [propClientId, propUserName]);

  // Desbloqueia o AudioContext no primeiro toque/clique do usuário (política autoplay)
  useEffect(() => {
    const unlockAudio = () => {
      try {
        const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtxClass) {
          if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
            audioCtxRef.current = new AudioCtxClass();
          }
          if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume().catch(() => {});
          }
        }
      } catch {}
    };

    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('touchstart', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  const effectiveServerUrl = propServerUrl || (() => {
    const loc = window.location;
    if (loc.protocol.startsWith('http')) {
      const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
      const isViteDev = loc.port === '3000' || loc.port === '5173';
      const targetPort = isViteDev ? '4870' : (loc.port || '4870');
      return `${proto}//${loc.hostname}:${targetPort}`;
    }
    return 'ws://localhost:4870';
  })();

  // 1. Iniciar Sirene Contínua com Web Audio API
  const startSiren = useCallback(() => {
    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return;

      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioCtxClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      let highTone = true;
      const playBeep = () => {
        try {
          if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') return;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = highTone ? 'sawtooth' : 'sine';
          osc.frequency.setValueAtTime(highTone ? 880 : 587, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(highTone ? 750 : 440, ctx.currentTime + 0.28);

          gain.gain.setValueAtTime(0.25, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start();
          osc.stop(ctx.currentTime + 0.3);
          highTone = !highTone;
        } catch {}
      };

      playBeep();
      if (sirenIntervalRef.current) clearInterval(sirenIntervalRef.current);
      sirenIntervalRef.current = setInterval(playBeep, 350);
      setIsSirenActive(true);

      // Vibração contínua em celulares/tablets
      if ('vibrate' in navigator) {
        navigator.vibrate([400, 200, 400, 200, 400]);
        if (vibrationIntervalRef.current) clearInterval(vibrationIntervalRef.current);
        vibrationIntervalRef.current = setInterval(() => {
          navigator.vibrate([400, 200, 400, 200, 400]);
        }, 1800);
      }
    } catch {}
  }, []);

  // 2. Parar Sirene e Vibração
  const stopSiren = useCallback(() => {
    if (sirenIntervalRef.current) {
      clearInterval(sirenIntervalRef.current);
      sirenIntervalRef.current = null;
    }
    if (vibrationIntervalRef.current) {
      clearInterval(vibrationIntervalRef.current);
      vibrationIntervalRef.current = null;
    }
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      try {
        audioCtxRef.current.close().catch(() => {});
      } catch {}
      audioCtxRef.current = null;
    }
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    setIsSirenActive(false);
  }, []);

  // 3. Disparar Notificação OS / Service Worker mesmo com a tela/aba em segundo plano
  const triggerOsNotification = useCallback((alert: EmergencyAlertData) => {
    const title = `🚨 ${alert.title || 'ALERTA DO ADMINISTRADOR'}`;
    const body = `${alert.message}\n(Enviado por: ${alert.senderName || 'Central'})`;

    // Via Service Worker (ativa na tela de bloqueio e centro de notificações do Windows/Android)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        title,
        body,
        tag: 'urgent-admin-popup-' + alert.id,
      });
    }

    // Fallback nativo Web Notification
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body,
            icon: '/icon.svg',
            badge: '/icon.svg',
            requireInteraction: true, // Mantém ativo até o usuário clicar
            tag: 'urgent-admin-popup-' + alert.id,
          });
        } catch {}
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then((perm) => {
          if (perm === 'granted') {
            try {
              new Notification(title, { body, requireInteraction: true });
            } catch {}
          }
        });
      }
    }
  }, []);

  // 4. Receber Alerta
  const handleIncomingAlert = useCallback((alert: EmergencyAlertData) => {
    const myId = clientIdRef.current;
    const baseId = baseClientIdRef.current;
    // Se o alerta for para outra estação específica, ignora
    if (alert.targetClientId && alert.targetClientId !== 'all' && alert.targetClientId !== myId && alert.targetClientId !== baseId) {
      return;
    }
    // Administradores não recebem seus próprios popups de estação se estiverem no console
    if (isAdmin) {
      return;
    }

    setCurrentAlert(alert);
    setHasAcknowledged(false);
    startSiren();
    triggerOsNotification(alert);

    // Aviso por voz sintetizada de emergência
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(`${alert.title}. ${alert.message}`);
        utter.lang = 'pt-BR';
        utter.rate = 1.05;
        window.speechSynthesis.speak(utter);
      } catch {}
    }
  }, [isAdmin, startSiren, triggerOsNotification]);

  const [liveIntercomNotice, setLiveIntercomNotice] = useState<string | null>(null);

  // Tocar som de chamada/chime individual enviado pela administração
  const playIndividualChime = useCallback(() => {
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
        gain.gain.setValueAtTime(0.3, ctx.currentTime + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.12);
        osc.stop(ctx.currentTime + idx * 0.12 + 0.45);
      });
    } catch {}
  }, []);

  // Tocar áudio ao vivo do interfone
  const playIncomingIntercom = useCallback((audioData: string, fromName?: string) => {
    try {
      const audio = new Audio(audioData);
      audio.play().catch(() => {});
      setLiveIntercomNotice(fromName || 'Administrador Central');
      setTimeout(() => setLiveIntercomNotice(null), 6000);
    } catch {}
  }, []);

  // 5. Desligar Sirene & Silenciar / Fechar Alerta Imediatamente (ao clicar no alerta ou botão de desligar)
  const handleSilenceAndDismiss = useCallback(() => {
    stopSiren();
    if (currentAlert) {
      const silencePayload = {
        t: 'silence-alert',
        room: 'general',
        alertId: currentAlert.id,
        targetClientId: baseClientIdRef.current,
        fromClientId: baseClientIdRef.current,
        clientId: clientIdRef.current,
        baseClientId: baseClientIdRef.current,
        fromName: userNameRef.current,
        timestamp: Date.now(),
      };
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(silencePayload));
        wsRef.current.send(JSON.stringify({
          t: 'alert-ack',
          room: 'general',
          alertId: currentAlert.id,
          clientId: clientIdRef.current,
          baseClientId: baseClientIdRef.current,
          clientName: userNameRef.current,
          timestamp: Date.now(),
        }));
      }
    }
    setCurrentAlert(null);
    setHasAcknowledged(false);
  }, [currentAlert, stopSiren]);

  // 6. Confirmar Recebimento (Ciente)
  const handleAcknowledge = () => {
    if (!currentAlert) return;
    stopSiren();
    setHasAcknowledged(true);

    // Toca som sutil de confirmação
    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        const ctx = new AudioCtxClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {}

    // Envia ACK para o servidor/administrador via WebSocket
    const ackPayload = {
      t: 'alert-ack',
      room: 'general',
      alertId: currentAlert.id,
      clientId: clientIdRef.current,
      baseClientId: baseClientIdRef.current,
      clientName: userNameRef.current,
      timestamp: Date.now(),
    };

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(ackPayload));
    }

    setTimeout(() => {
      setCurrentAlert(null);
      setHasAcknowledged(false);
    }, 600);
  };

  // 7. Conexão WebSocket de escuta contínua de alertas em segundo plano
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      try {
        ws = new WebSocket(effectiveServerUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(JSON.stringify({
            t: 'hello',
            clientId: clientIdRef.current,
            baseClientId: baseClientIdRef.current,
            isAlertListener: true,
            name: userNameRef.current,
            color: '#3b82f6',
          }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const myId = clientIdRef.current;
            const baseId = baseClientIdRef.current;
            const isForMe = !data.targetClientId ||
              data.targetClientId === 'all' ||
              data.targetClientId === myId ||
              (baseId && data.targetClientId === baseId);

            if (data.t === 'admin-popup') {
              handleIncomingAlert({
                id: data.id || 'alert_' + Date.now(),
                title: data.title || 'COMUNICADO URGENTE DA ADMINISTRAÇÃO',
                message: data.message || data.text || 'Favor verificar com a recepção.',
                level: data.level || 'critical',
                timestamp: data.timestamp || Date.now(),
                senderName: data.senderName || data.fromName || 'Administrador Central',
                targetClientId: data.targetClientId,
              });
            } else if (data.t === 'remote-command' && data.action === 'alert') {
              handleIncomingAlert({
                id: 'remote_alert_' + Date.now(),
                title: '🚨 ALARME DISPARADO PELA CENTRAL',
                message: data.reason || 'O Administrador acionou a sirene de atenção neste terminal.',
                level: 'critical',
                timestamp: Date.now(),
                senderName: 'Administrador Central',
                targetClientId: data.targetClientId,
              });
            } else if (data.t === 'network-lockdown') {
              if (data.enabled && !isAdmin) {
                handleIncomingAlert({
                  id: 'lockdown_' + Date.now(),
                  title: '🚨 LOCKDOWN DE REDE ATIVADO (DEFCON 1)',
                  message: data.reason || 'O Administrador congelou o tráfego da rede para contenção de incidente.',
                  level: 'critical',
                  timestamp: Date.now(),
                  senderName: 'Administrador Central (SOC)',
                });
              } else if (!data.enabled) {
                stopSiren();
                setCurrentAlert(null);
              }
            } else if (data.t === 'remote-command' && (data.action === 'freeze-screen' || data.action === 'quarantine' || data.action === 'eject')) {
              if (isForMe && !isAdmin) {
                handleIncomingAlert({
                  id: 'containment_' + Date.now(),
                  title: data.action === 'eject' ? '⛔ SESSÃO ENCERRADA PELO ADMINISTRADOR' : '🔒 CONTENÇÃO ZERO-TRUST ATIVADA',
                  message: data.reason || 'Sua estação foi colocada sob restrição de segurança pela Administração.',
                  level: 'critical',
                  timestamp: Date.now(),
                  senderName: 'Administrador Central (SOC)',
                });
              }
            } else if (data.t === 'silence-alert') {
              if (isForMe) {
                stopSiren();
                setCurrentAlert(null);
              }
            } else if (data.t === 'play-sound') {
              if (isForMe && !isAdmin) {
                playIndividualChime();
              }
            } else if (data.t === 'intercom-audio') {
              if (isForMe && !isAdmin && data.audioData) {
                playIncomingIntercom(data.audioData, data.fromName);
              }
            }
          } catch {}
        };

        ws.onclose = () => {
          reconnectTimeout = setTimeout(connect, 4000);
        };
      } catch {
        reconnectTimeout = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      stopSiren();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [effectiveServerUrl, handleIncomingAlert, stopSiren, playIndividualChime, playIncomingIntercom, isAdmin]);

  const isCritical = !currentAlert?.level || currentAlert?.level === 'critical';

  return (
    <>
      {/* Notificação de Áudio ao Vivo (Interfone da Administração) */}
      {liveIntercomNotice && (
        <div className="fixed top-5 right-5 z-[999999999] bg-emerald-950/95 border-2 border-emerald-500 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="p-2 bg-emerald-500/20 rounded-xl">
            <Volume2 className="w-6 h-6 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-300">Áudio ao Vivo da Central</div>
            <div className="text-sm font-bold text-white">{liveIntercomNotice} está transmitindo voz...</div>
          </div>
        </div>
      )}

      {currentAlert && (
        <div
          id="emergency-alert-overlay"
          onClick={handleSilenceAndDismiss}
          className="fixed inset-0 z-[99999999] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-200 select-none cursor-pointer"
          style={{ touchAction: 'none' }}
          title="Clique em qualquer lugar para silenciar e fechar o alerta"
        >
          {/* Luz Estroboscópica de Fundo */}
          <div className={`absolute inset-0 ${isCritical ? 'bg-red-600/10' : 'bg-amber-600/10'} animate-pulse pointer-events-none`} />

          {/* Caixa do Pop-up (clique dentro não propaga a menos que seja no banner/botões) */}
          <div
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full max-w-lg bg-slate-900 border-2 ${
              isCritical ? 'border-red-500 shadow-red-500/50' : 'border-amber-500 shadow-amber-500/40'
            } shadow-2xl rounded-3xl p-6 sm:p-8 text-white overflow-hidden animate-in zoom-in-95 duration-200 cursor-default`}
          >
            {/* Banner Superior Pulsante - Clicável para desligar imediatamente */}
            <div
              onClick={handleSilenceAndDismiss}
              className={`absolute top-0 left-0 right-0 py-2.5 px-4 ${
                isCritical ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-700 hover:to-rose-700' : 'bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-600 hover:from-amber-700 hover:to-yellow-700'
              } text-white font-extrabold text-xs sm:text-sm uppercase tracking-widest text-center shadow-md flex items-center justify-between gap-2 cursor-pointer transition-colors`}
              title="Clique para desligar o som e fechar"
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                <span>{isCritical ? '🚨 ALERTA MÁXIMO DA ADMINISTRAÇÃO' : '⚠️ COMUNICADO DA ADMINISTRAÇÃO'}</span>
              </div>
              <span className="text-[11px] bg-black/40 px-2 py-0.5 rounded-full border border-white/30 flex items-center gap-1 font-black">
                <VolumeX className="w-3 h-3" /> Desligar Alerta [X]
              </span>
            </div>

            <div className="pt-6 sm:pt-7 text-center">
              {/* Ícone com Efeito Sirene - Clicável para silenciar */}
              <button
                type="button"
                onClick={handleSilenceAndDismiss}
                className={`inline-flex items-center justify-center p-4 rounded-3xl ${
                  isCritical ? 'bg-red-500/20 hover:bg-red-500/30 border-red-500/40' : 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40'
                } border mb-4 animate-bounce cursor-pointer group transition-all`}
                title="Clique no ícone para desligar o som da sirene"
              >
                {isCritical ? (
                  <ShieldAlert className="w-12 h-12 sm:w-16 sm:h-16 text-red-400 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)] group-hover:scale-110 transition-transform" />
                ) : (
                  <AlertTriangle className="w-12 h-12 sm:w-16 sm:h-16 text-amber-400 drop-shadow-[0_0_15px_rgba(245,158,11,0.8)] group-hover:scale-110 transition-transform" />
                )}
              </button>

              {/* Título do Alerta */}
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2 uppercase">
                {currentAlert.title}
              </h2>

              {/* Dados do Remetente */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs text-slate-300 mb-5">
                <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                <span>Enviado por: <strong className="text-white">{currentAlert.senderName || 'Administrador Central'}</strong></span>
                <span>•</span>
                <span>{currentAlert.timestamp ? new Date(currentAlert.timestamp).toLocaleTimeString() : 'Agora'}</span>
              </div>

              {/* Corpo da Mensagem (Texto Destacado) */}
              <div className={`p-4 sm:p-5 rounded-2xl bg-slate-950/80 border ${
                isCritical ? 'border-red-500/30' : 'border-amber-500/30'
              } text-left mb-5 shadow-inner`}>
                <p className="text-sm sm:text-base text-slate-100 font-medium leading-relaxed whitespace-pre-wrap break-words">
                  {currentAlert.message}
                </p>
              </div>

              {/* Status da Sirene e Atalho de Desligamento */}
              <div className="flex items-center justify-center gap-2 text-xs text-rose-300/90 mb-4 font-semibold">
                <BellRing className="w-4 h-4 animate-spin text-rose-400" />
                <span>Sirene ativa • Clique para desligar a qualquer momento</span>
              </div>

              {/* Botão Primário: DESLIGAR SIRENE / FECHAR IMEDIATO */}
              <button
                type="button"
                onClick={handleSilenceAndDismiss}
                className={`w-full mb-3 py-3.5 px-5 rounded-2xl ${
                  isCritical
                    ? 'bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 border-red-400/40 shadow-red-950/60'
                    : 'bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 border-amber-400/40 shadow-amber-950/60'
                } text-white font-black text-sm uppercase shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 border`}
              >
                <VolumeX className="w-5 h-5 text-white animate-pulse" />
                <span>🔇 Desligar Alerta & Silenciar Sirene</span>
              </button>

              {/* Botão Secundário de Confirmação (Ciente) */}
              <button
                type="button"
                onClick={handleAcknowledge}
                disabled={hasAcknowledged}
                className={`w-full py-3 px-6 rounded-2xl font-bold text-sm tracking-wide uppercase shadow-md transition-all flex items-center justify-center gap-2 ${
                  hasAcknowledged
                    ? 'bg-emerald-600 text-white cursor-default'
                    : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 active:scale-95 cursor-pointer'
                }`}
              >
                {hasAcknowledged ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 animate-bounce" />
                    <span>CONFIRMADO COM SUCESSO!</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Confirmar Recebimento (Estou Ciente)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
