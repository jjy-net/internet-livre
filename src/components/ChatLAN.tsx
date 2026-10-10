import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Lock,
  Unlock,
  Users,
  Smile,
  Shield,
  Radio,
  CheckCheck,
  Clock,
  Trash2,
  Settings,
  Wifi,
  Sparkles,
  UserPlus,
  Globe,
  Cpu,
  ExternalLink
} from 'lucide-react';
import { encryptAESGCM, decryptAESGCM } from '../utils/crypto';
import { captureGpsLocation } from '../utils/geo';

interface Peer {
  peerId: number;
  clientId: string;
  name: string;
  color: string;
  latency: number | null;
}

interface ChatMessage {
  id: string;
  fromName: string;
  fromClientId?: string;
  fromColor?: string;
  room: string;
  text: string;
  isEncrypted: boolean;
  decryptedText?: string;
  targetClientId?: string; // Para DMs privadas
  ts: number;
  self: boolean;
}

const STICKERS = [
  '😀', '😂', '😍', '😎', '🤔', '😢', '🔥', '🎉',
  '👍', '👎', '👏', '🤝', '✌️', '💪', '🙏', '🚀',
  '❤️', '💙', '💜', '✨', '⚡', '🔒', '🛡️', '☕'
];

export const ChatLAN: React.FC = () => {
  const [serverUrl, setServerUrl] = useState(() => {
    const loc = window.location;
    if (loc.protocol.startsWith('http')) {
      const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${proto}//${loc.hostname}:${loc.port || '4870'}`;
    }
    return 'ws://localhost:4870';
  });

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('jjy_chat_username') || localStorage.getItem('dl_chat_name') || `Soberano-${Math.floor(1000 + Math.random() * 9000)}`;
  });
  const [userAvatar, setUserAvatar] = useState(() => {
    return localStorage.getItem('jjy_chat_avatar') || '🛡️';
  });
  const [userColor, setUserColor] = useState(() => {
    return localStorage.getItem('dl_chat_color') || '#6366f1';
  });
  const [showUserModal, setShowUserModal] = useState(false);
  const [tempUserName, setTempUserName] = useState(userName);
  const [tempAvatar, setTempAvatar] = useState(userAvatar);

  const [clientId] = useState(() => {
    let id = localStorage.getItem('dl_chat_client_id');
    if (!id) {
      id = 'client-' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('dl_chat_client_id', id);
    }
    return id;
  });

  const [peers, setPeers] = useState<Peer[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [targetPeer, setTargetPeer] = useState<string>('all'); // 'all' ou clientId

  // Criptografia E2E
  const [encryptEnabled, setEncryptEnabled] = useState(false);
  const [secretKey, setSecretKey] = useState('datalink2026');
  const [showStickers, setShowStickers] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const connectToServer = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setConnecting(true);
    setConnectionError(null);

    try {
      const ws = new WebSocket(serverUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setConnecting(false);
        setConnectionError(null);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        // Envia hello imediatamente com dados de localização
        captureGpsLocation().then((loc) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              t: 'hello',
              clientId,
              name: userName,
              color: userColor,
              location: loc || undefined,
            }));
          }
        }).catch(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              t: 'hello',
              clientId,
              name: userName,
              color: userColor,
            }));
          }
        });
      };

      ws.onmessage = async (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.t === 'welcome') {
            setPeers(data.peers || []);
          } else if (data.t === 'peer:join') {
            setPeers((prev) => [...prev.filter((p) => p.clientId !== data.peer.clientId), data.peer]);
          } else if (data.t === 'peer:leave') {
            setPeers((prev) => prev.filter((p) => p.peerId !== data.peerId && p.clientId !== data.clientId));
          } else if (data.t === 'peer:update') {
            setPeers((prev) => prev.map((p) => (p.peerId === data.peer.peerId ? { ...p, ...data.peer } : p)));
          } else if (data.t === 'presence') {
            setPeers(data.peers || []);
          } else if (data.t === 'chat') {
            // Filtrar DMs que não são para mim nem públicas
            if (data.targetClientId && data.targetClientId !== clientId && data.fromClientId !== clientId) {
              return;
            }

            let displayText = data.text || '';
            let isEnc = false;
            if (data.enc) {
              isEnc = true;
              try {
                displayText = await decryptAESGCM(data.enc, secretKey);
              } catch {
                displayText = '[Mensagem Criptografada - Chave diferente]';
              }
            }

            setMessages((prev) => [
              ...prev,
              {
                id: data.id || String(Date.now()),
                fromName: data.fromName || 'Anônimo',
                fromClientId: data.fromClientId,
                fromColor: data.fromColor || '#94a3b8',
                room: data.room || 'geral',
                text: displayText,
                isEncrypted: isEnc,
                targetClientId: data.targetClientId,
                ts: data.ts || Date.now(),
                self: data.fromClientId === clientId,
              },
            ]);
          }
        } catch {
          // Frame binário ou outro formato ignorado
        }
      };

      ws.onerror = () => {
        setConnectionError('Não foi possível conectar ao servidor WebSocket.');
      };

      ws.onclose = () => {
        setConnected(false);
        setConnecting(false);
        wsRef.current = null;
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connectToServer();
        }, 3500);
      };
    } catch (err: unknown) {
      setConnecting(false);
      setConnectionError((err as Error).message);
    }
  }, [serverUrl, clientId, userName, userColor, secretKey]);

  useEffect(() => {
    // Tenta conectar automaticamente na montagem
    connectToServer();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setConnectionError('Conecte-se ao servidor para enviar mensagens.');
      return;
    }

    const msgId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const target = targetPeer !== 'all' ? targetPeer : undefined;

    let payload: Record<string, unknown> = {
      t: 'chat',
      id: msgId,
      room: 'geral',
      ts: Date.now(),
      targetClientId: target,
    };

    if (encryptEnabled) {
      try {
        const encrypted = await encryptAESGCM(inputText.trim(), secretKey);
        payload.enc = encrypted;
      } catch {
        payload.text = inputText.trim();
      }
    } else {
      payload.text = inputText.trim();
    }

    wsRef.current.send(JSON.stringify(payload));

    // Adiciona na visualização local
    setMessages((prev) => [
      ...prev,
      {
        id: msgId,
        fromName: userName,
        fromClientId: clientId,
        fromColor: userColor,
        room: 'geral',
        text: inputText.trim(),
        isEncrypted: encryptEnabled,
        targetClientId: target,
        ts: Date.now(),
        self: true,
      },
    ]);

    setInputText('');
  };

  const handleUpdateProfile = (newName: string, newColor: string) => {
    setUserName(newName);
    setUserColor(newColor);
    localStorage.setItem('jjy_chat_username', newName);
    localStorage.setItem('dl_chat_name', newName);
    localStorage.setItem('dl_chat_color', newColor);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ t: 'name', name: newName, color: newColor }));
    }
  };

  const handleSaveUserModal = () => {
    const finalName = tempUserName.trim() || 'Soberano';
    setUserName(finalName);
    setUserAvatar(tempAvatar);
    localStorage.setItem('jjy_chat_username', finalName);
    localStorage.setItem('dl_chat_name', finalName);
    localStorage.setItem('jjy_chat_avatar', tempAvatar);
    localStorage.setItem('jjy_chat_user_created', 'true');
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ t: 'name', name: finalName, color: userColor }));
    }
    setShowUserModal(false);
  };

  const randomizeName = () => {
    const prefixes = ['Soberano', 'Guardião', 'Operador', 'Sentinela', 'Nó', 'Cifra', 'Vanguarda'];
    const suffixes = ['Alpha', 'Beta', 'Mesh', 'RNS', 'LXMF', 'Prime', '7a'];
    const p = prefixes[Math.floor(Math.random() * prefixes.length)];
    const s = suffixes[Math.floor(Math.random() * suffixes.length)];
    const num = Math.floor(100 + Math.random() * 900);
    setTempUserName(`${p}_${s}_${num}`);
  };

  return (
    <div className="space-y-6">
      {/* BANNER CHAMATIVO: CRIAR NOVO USUÁRIO & HUB DE PROTOCOLOS SOBERANOS */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-950/80 via-slate-900/90 to-sky-950/80 backdrop-blur-md rounded-2xl border-2 border-indigo-500/40 p-5 shadow-2xl shadow-indigo-950/40">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-44 h-44 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                IDENTIDADE CRIPTOGRÁFICA
              </span>
              <span className="text-[11px] text-slate-400">Zero Cadastro • Zero Telefone</span>
            </div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>{userAvatar} Chat Soberano &amp; Malha P2P</span>
            </h2>
            <p className="text-xs text-slate-300 max-w-xl mt-0.5">
              Identidade ativa: <strong className="text-indigo-300">{userName}</strong>. Conecte-se localmente ou abra o ecossistema com Reticulum RNS, SimpleX, LoRa Mesh e Nostr.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <button
              type="button"
              onClick={() => {
                setTempUserName(userName);
                setTempAvatar(userAvatar);
                setShowUserModal(true);
              }}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Criar / Editar Usuário</span>
            </button>

            <a
              href="chat.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-sky-300 text-xs font-semibold rounded-xl border border-sky-500/30 transition-all hover:border-sky-400"
              title="Abrir Chat Soberano em tela cheia com SimpleX, Reticulum, WhatsApp, Nostr e Meshtastic"
            >
              <Globe className="w-4 h-4" />
              <span>Chat Soberano Completo ↗</span>
            </a>

            <a
              href="reticulum.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 bg-sky-950/40 hover:bg-sky-900/40 text-cyan-300 text-xs font-semibold rounded-xl border border-cyan-500/30 transition-all"
              title="Abrir Suite Reticulum Network (RNS & LXMF)"
            >
              <Cpu className="w-4 h-4" />
              <span>Suite Reticulum ↗</span>
            </a>
          </div>
        </div>
      </div>

      {/* MODAL PARA CRIAÇÃO / EDIÇÃO DE USUÁRIO */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚡</span>
                <h3 className="text-base font-bold text-white">Criar Identidade Soberana</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Crie seu perfil instantâneo sem cadastro nem telefone. Seu apelido e chaves valem para este chat e para o Chat Soberano Reticulum/SimpleX.
            </p>

            <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-slate-300">SEU APELIDO / NOME:</label>
                  <button
                    type="button"
                    onClick={randomizeName}
                    className="text-[11px] text-cyan-400 hover:underline"
                  >
                    🎲 Aleatório
                  </button>
                </div>
                <input
                  type="text"
                  value={tempUserName}
                  onChange={(e) => setTempUserName(e.target.value)}
                  placeholder="Ex: Soberano Alpha"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-semibold outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1.5">ESCOLHA SEU AVATAR:</label>
                <div className="flex gap-2">
                  {['🛡️', '🛰️', '⚡', '🦅', '🐺', '🌐', '📻'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setTempAvatar(emoji)}
                      className={`text-lg p-2 rounded-xl border transition-all ${
                        tempAvatar === emoji
                          ? 'bg-indigo-600/30 border-indigo-400 scale-110 shadow-sm'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveUserModal}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-xs font-bold text-white rounded-xl shadow-md transition-all"
              >
                Salvar &amp; Ativar Identidade
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Banner de Conexão */}
      <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Radio className={`w-5 h-5 ${connected ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
            <span
              className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${
                connected ? 'bg-emerald-500 shadow-sm shadow-emerald-500' : 'bg-slate-600'
              }`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-slate-100">Jjy LAN Relay</h3>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                  connected
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {connected ? 'Conectado' : connecting ? 'Conectando...' : 'Desconectado'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">{serverUrl}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!connected ? (
            <button
              type="button"
              onClick={connectToServer}
              disabled={connecting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all"
            >
              <Wifi className="w-3.5 h-3.5" /> {connecting ? 'Conectando...' : 'Conectar'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => wsRef.current?.close()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-semibold rounded-xl border border-rose-500/30 transition-all"
            >
              Desconectar
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all"
            title="Configurações de Rede e Perfil"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {connectionError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center justify-between">
          <span>{connectionError}</span>
          <button
            type="button"
            onClick={() => setConnectionError(null)}
            className="text-rose-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Painel de Configurações Expansível */}
      {showSettings && (
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1">
              Endereço do Servidor WebSocket
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="ws://localhost:4870 ou ws://192.168.x.x:4870"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-100"
              />
              <button
                type="button"
                onClick={connectToServer}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-xl border border-slate-700"
              >
                Salvar & Reconectar
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Dica: Inicie o servidor com <code>node server/start.js</code> na mesma máquina.
            </p>
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1">
              Seu Nome e Cor de Perfil
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={userName}
                onChange={(e) => handleUpdateProfile(e.target.value, userColor)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100"
              />
              <input
                type="color"
                value={userColor}
                onChange={(e) => handleUpdateProfile(userName, e.target.value)}
                className="w-9 h-8 rounded-xl border border-slate-700 cursor-pointer bg-transparent"
              />
            </div>
          </div>
        </div>
      )}

      {/* Chat Layout: Mensagens + Barra Lateral de Usuários */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Painel Principal do Chat */}
        <div className="lg:col-span-9 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl flex flex-col h-[560px]">
          {/* Header do Chat */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: userColor }} />
              <span className="font-semibold text-xs text-slate-200">{userName}</span>
              <span className="text-[10px] text-slate-500 font-mono">({clientId.slice(0, 8)})</span>
            </div>

            {/* Controles de Criptografia E2E */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEncryptEnabled(!encryptEnabled)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
                  encryptEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                {encryptEnabled ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                <span>{encryptEnabled ? 'Cripto E2E Ativa' : 'Sem Cripto'}</span>
              </button>

              {encryptEnabled && (
                <input
                  type="password"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder="Chave secreta..."
                  className="w-28 bg-slate-950 border border-emerald-500/40 rounded-xl px-2 py-0.5 text-xs text-emerald-300 font-mono"
                  title="Chave de criptografia compartilhada"
                />
              )}

              <button
                type="button"
                onClick={() => setMessages([])}
                className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
                title="Limpar mensagens"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lista de Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <Shield className="w-12 h-12 mb-3 text-slate-600" />
                <p className="text-sm font-semibold text-slate-300">Nenhuma mensagem ainda</p>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Envie uma mensagem para todos ou selecione um usuário online para conversa privada 🔒.
                </p>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.self ? 'items-end' : 'items-start'} max-w-full`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-[11px]">
                    <span
                      className="font-semibold"
                      style={{ color: m.fromColor || '#94a3b8' }}
                    >
                      {m.fromName}
                    </span>
                    {m.targetClientId && (
                      <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-[9px] font-semibold">
                        🔒 Privado
                      </span>
                    )}
                    {m.isEncrypted && (
                      <Lock className="w-3 h-3 text-emerald-400" />
                    )}
                    <span className="text-slate-500 text-[10px]">
                      {new Date(m.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm max-w-[85%] break-words shadow-sm ${
                      m.self
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700/80'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Painel de Figurinha Expansível */}
          {showStickers && (
            <div className="p-3 border-t border-slate-800 bg-slate-950/80 grid grid-cols-8 gap-2">
              {STICKERS.map((stk) => (
                <button
                  key={stk}
                  type="button"
                  onClick={() => {
                    setInputText((prev) => prev + stk);
                    setShowStickers(false);
                  }}
                  className="p-2 text-lg hover:bg-slate-800 rounded-xl transition-all"
                >
                  {stk}
                </button>
              ))}
            </div>
          )}

          {/* Campo de Entrada e Envio */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/40 flex items-center gap-2">
            {/* Destinatário (Público vs Privado) */}
            <select
              value={targetPeer}
              onChange={(e) => setTargetPeer(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-300 max-w-[120px] truncate"
            >
              <option value="all">🌐 Todos</option>
              {peers.map((p) => (
                <option key={p.clientId} value={p.clientId}>
                  🔒 {p.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setShowStickers(!showStickers)}
              className="p-2 text-slate-400 hover:text-amber-400 rounded-xl hover:bg-slate-800 transition-all"
            >
              <Smile className="w-5 h-5" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') sendMessage();
              }}
              placeholder={targetPeer === 'all' ? 'Mensagem pública para a rede...' : 'Mensagem privada (DM)...'}
              className="flex-1 bg-slate-900/90 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />

            <button
              type="button"
              onClick={sendMessage}
              disabled={!inputText.trim() || !connected}
              className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl shadow-md transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Barra Lateral: Pares Online na LAN */}
        <div className="lg:col-span-3 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-4 shadow-xl flex flex-col h-[560px]">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <h4 className="font-semibold text-xs text-slate-200">Dispositivos na Rede</h4>
            </div>
            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-600/20 text-indigo-300 border border-indigo-500/30">
              {peers.length + (connected ? 1 : 0)}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {/* Você mesmo */}
            {connected && (
              <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: userColor }} />
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block truncate max-w-[110px]">
                      {userName} (Você)
                    </span>
                    <span className="text-[9px] text-emerald-400 font-mono">Online</span>
                  </div>
                </div>
              </div>
            )}

            {/* Outros pares */}
            {peers.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                Nenhum outro dispositivo detectado na rede ainda.
              </div>
            ) : (
              peers.map((p) => (
                <button
                  key={p.clientId}
                  type="button"
                  onClick={() => setTargetPeer(p.clientId)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                    targetPeer === p.clientId
                      ? 'bg-indigo-600/20 border-indigo-500/50'
                      : 'bg-slate-950/40 hover:bg-slate-800/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    <div className="truncate max-w-[110px]">
                      <span className="text-xs font-semibold text-slate-200 block truncate">
                        {p.name}
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono">
                        {p.latency !== null ? `${p.latency}ms` : 'ativo'}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-indigo-400 hover:underline">DM</span>
                </button>
              ))
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800 text-[10px] text-slate-500 text-center">
            Abra <code>http://[IP]:4870</code> em outro computador ou celular na mesma rede Wi-Fi para conversar.
          </div>
        </div>
      </div>
    </div>
  );
};
