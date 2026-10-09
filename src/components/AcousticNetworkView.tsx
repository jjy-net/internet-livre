import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Radio,
  Wifi,
  Activity,
  Send,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Users,
  Repeat,
  Volume2,
  VolumeX,
  Gauge,
  Sparkles,
  RefreshCw,
  Layers,
  Zap,
  Clock,
  Check,
  Compass,
  FileText,
  Download,
  Upload,
  Image as ImageIcon,
  FileUp,
  FileCheck,
  Binary,
  FileDown,
  Eye,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  AcousticMeshNode,
  ACOUSTIC_CHANNELS,
  FrameType,
  AcousticFrame,
  NetworkPeerInfo,
  NetworkMetrics,
} from '../utils/acousticNetwork';
import {
  AcousticFileMetadata,
  TransferProgress,
  compressData,
  encodeFileMetaPayload,
  decodeFileMetaPayload,
  encodeFileChunkPayload,
  decodeFileChunkPayload,
  encodeSackPayload,
  decodeSackPayload,
  AcousticIncomingFileSession,
  ChunkStatus,
} from '../utils/acousticTransport';
import { computeHash } from '../utils/crypto';

interface CompletedFileItem {
  id: string;
  name: string;
  size: number;
  mime: string;
  blob: Blob;
  url: string;
  verified: boolean;
  receivedAt: string;
  srcNode: string;
}

export const AcousticNetworkView: React.FC = () => {
  // Sub-abas do Cockpit da Rede
  const [activeSubTab, setActiveSubTab] = useState<'chat' | 'files'>('chat');

  // Configuração do Nó Local
  const [myNodeId, setMyNodeId] = useState('N1');
  const [selectedChannel, setSelectedChannel] = useState(2);
  const [isFullDuplex, setIsFullDuplex] = useState(true);
  const [baudRate, setBaudRate] = useState(25);
  const [squelchThreshold, setSquelchThreshold] = useState(85);
  const [volume, setVolume] = useState(0.5);

  // Estado da Conexão e Rede
  const [isRunning, setIsRunning] = useState(false);
  const [metrics, setMetrics] = useState<NetworkMetrics>({
    txBytesPerSec: 0,
    rxBytesPerSec: 0,
    packetLossPercent: 0,
    txTotalPackets: 0,
    rxTotalPackets: 0,
    txRetries: 0,
    crcErrors: 0,
    currentChannel: 2,
    carrierBusy: false,
    receiverSource: 'microphone',
  });

  // Mensagens e Nós Vizinhos
  const [destinationNode, setDestinationNode] = useState('**'); // '**' = Broadcast
  const [inputMessage, setInputMessage] = useState('Olá rede acústica Jjy!');
  const [chatLog, setChatLog] = useState<{ id: string; time: string; src: string; dst: string; text: string; type: 'tx' | 'rx'; ack?: boolean }[]>([]);
  const [peersList, setPeersList] = useState<NetworkPeerInfo[]>([]);

  // --- ESTADO DO TRANSPORTE DE ARQUIVOS (TCP ACÚSTICO & SACK) ---
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [chunkSize, setChunkSize] = useState<number>(36); // bytes por chunk
  const [useGzip, setUseGzip] = useState<boolean>(true);
  const [isSendingFile, setIsSendingFile] = useState<boolean>(false);
  const [txProgress, setTxProgress] = useState<TransferProgress | null>(null);
  const [rxProgress, setRxProgress] = useState<TransferProgress | null>(null);
  const [completedFiles, setCompletedFiles] = useState<CompletedFileItem[]>([]);

  // Instâncias e Sessões de Arquivos Ativas
  const nodeRef = useRef<AcousticMeshNode | null>(null);
  const incomingSessionsRef = useRef<Map<string, AcousticIncomingFileSession>>(new Map());
  const activeTxSessionRef = useRef<{ isCancelled: boolean } | null>(null);

  // Canvas dos Gráficos
  const throughputCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const throughputHistoryRef = useRef<{ tx: number; rx: number }[]>([]);

  // Inicializar o Nó Acústico
  useEffect(() => {
    const node = new AcousticMeshNode(myNodeId, selectedChannel);
    node.isFullDuplex = isFullDuplex;
    node.baudRate = baudRate;
    node.squelchThreshold = squelchThreshold;
    node.volume = volume;

    node.onFrameReceived = (frame: AcousticFrame) => {
      handleIncomingFrame(frame);
    };

    node.onMetricsUpdate = (m: NetworkMetrics) => {
      setMetrics({ ...m });
      throughputHistoryRef.current.push({ tx: m.txBytesPerSec, rx: m.rxBytesPerSec });
      if (throughputHistoryRef.current.length > 50) {
        throughputHistoryRef.current.shift();
      }
    };

    node.onPeerDiscovered = (peer: NetworkPeerInfo) => {
      setPeersList((prev) => {
        const filtered = prev.filter((p) => p.nodeId !== peer.nodeId);
        return [...filtered, peer];
      });
    };

    nodeRef.current = node;

    return () => {
      node.stopListening();
    };
  }, []);

  // Processamento de Frames de Dados e Arquivos
  const handleIncomingFrame = async (frame: AcousticFrame) => {
    const nowStr = new Date().toLocaleTimeString('pt-BR');

    // 1. Mensagem de Chat Comum
    if (frame.type === FrameType.DATA || frame.type === FrameType.BROADCAST) {
      setChatLog((prev) => [
        ...prev.slice(-49),
        {
          id: Math.random().toString(),
          time: nowStr,
          src: frame.srcNode,
          dst: frame.dstNode,
          text: frame.payload,
          type: 'rx',
        },
      ]);
      confetti({ particleCount: 30, origin: { y: 0.6 } });
      return;
    }

    // 2. Quadro de Metadados de Arquivo (FILE_META)
    if (frame.payload.startsWith('{"id":')) {
      const meta = decodeFileMetaPayload(frame.payload);
      if (meta) {
        const session = new AcousticIncomingFileSession(meta);
        incomingSessionsRef.current.set(meta.fileId, session);
        setRxProgress(session.getProgress());
        setActiveSubTab('files');
        return;
      }
    }

    // 3. Quadro de Chunk de Arquivo (FILE_CHUNK)
    if (frame.payload.includes(':') && frame.payload.split(':').length >= 3) {
      const chunkData = decodeFileChunkPayload(frame.payload);
      if (chunkData) {
        const session = incomingSessionsRef.current.get(chunkData.fileId);
        if (session && !session.isCompleted) {
          session.addChunk(chunkData.chunkIndex, chunkData.chunkBytes);
          const prog = session.getProgress();
          setRxProgress({ ...prog });

          // Se completou todos os chunks, reconstrói o arquivo
          if (session.receivedCount >= session.meta.totalChunks) {
            const result = await session.assembleFile();
            if (result) {
              const fileUrl = URL.createObjectURL(result.blob);
              const completedItem: CompletedFileItem = {
                id: session.meta.fileId,
                name: session.meta.fileName,
                size: session.meta.fileSize,
                mime: session.meta.mimeType,
                blob: result.blob,
                url: fileUrl,
                verified: result.verified,
                receivedAt: new Date().toLocaleTimeString('pt-BR'),
                srcNode: frame.srcNode,
              };
              setCompletedFiles((prev) => [completedItem, ...prev]);
              setRxProgress(null);
              confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
            }
          }
        }
      }
    }
  };

  // Atualizar parâmetros dinâmicos no nó
  useEffect(() => {
    if (nodeRef.current) {
      nodeRef.current.nodeId = myNodeId;
      nodeRef.current.channelId = selectedChannel;
      nodeRef.current.isFullDuplex = isFullDuplex;
      nodeRef.current.baudRate = baudRate;
      nodeRef.current.squelchThreshold = squelchThreshold;
      nodeRef.current.volume = volume;
    }
  }, [myNodeId, selectedChannel, isFullDuplex, baudRate, squelchThreshold, volume]);

  // Iniciar/Pausar a Rede Acústica
  const toggleNetwork = async () => {
    if (!nodeRef.current) return;
    if (isRunning) {
      nodeRef.current.stopListening();
      setIsRunning(false);
    } else {
      const ok = await nodeRef.current.startListening();
      if (ok) {
        setIsRunning(true);
      } else {
        alert('Não foi possível ativar o microfone para a rede acústica.');
      }
    }
  };

  // Enviar Mensagem P2P / Broadcast
  const handleSendMessage = async () => {
    if (!nodeRef.current || !inputMessage.trim()) return;
    const msg = inputMessage.trim();
    const dst = destinationNode.trim() || '**';
    const nowStr = new Date().toLocaleTimeString('pt-BR');
    const type = dst === '**' ? FrameType.BROADCAST : FrameType.DATA;

    const logEntry = {
      id: Math.random().toString(),
      time: nowStr,
      src: myNodeId,
      dst: dst,
      text: msg,
      type: 'tx' as const,
      ack: false,
    };
    setChatLog((prev) => [...prev.slice(-49), logEntry]);
    setInputMessage('');

    const delivered = await nodeRef.current.sendFrame(type, dst, msg);
    if (delivered) {
      setChatLog((prev) =>
        prev.map((entry) => (entry.id === logEntry.id ? { ...entry, ack: true } : entry))
      );
    }
  };

  // Selecionar Arquivo do Usuário
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setTxProgress(null);

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
    } else {
      setFilePreviewUrl(null);
    }
  };

  // Enviar Arquivo Completo via TCP Acústico (Selective Repeat ARQ)
  const handleSendFileAcoustic = async () => {
    if (!nodeRef.current || !selectedFile) return;
    setIsSendingFile(true);

    try {
      const rawBytes = new Uint8Array(await selectedFile.arrayBuffer());
      const rawHash = await computeHash(rawBytes.buffer as ArrayBuffer, 'SHA-256');

      // 1. Compressão opcional
      let payloadToSend: Uint8Array<any> = rawBytes;
      let isComp = false;
      if (useGzip) {
        const comp = await compressData(rawBytes);
        if (comp.length < rawBytes.length) {
          payloadToSend = comp;
          isComp = true;
        }
      }

      // 2. Divisão em Chunks
      const totalChunks = Math.ceil(payloadToSend.length / chunkSize);
      const fileId = Math.random().toString(36).substring(2, 6).toUpperCase();

      const meta: AcousticFileMetadata = {
        fileId,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type,
        totalChunks,
        chunkSize,
        sha256: rawHash,
        isCompressed: isComp,
      };

      const chunkStates: ChunkStatus[] = new Array(totalChunks).fill('pending');
      const startTime = Date.now();

      const updateProgress = (completed: number, retransmits = 0) => {
        const elapsedSec = Math.max(1, (Date.now() - startTime) / 1000);
        const transferredBytes = completed * chunkSize;
        const speed = Math.round(transferredBytes / elapsedSec);
        const eta = speed > 0 ? Math.round(((totalChunks - completed) * chunkSize) / speed) : 0;

        setTxProgress({
          fileId,
          fileName: selectedFile.name,
          totalBytes: selectedFile.size,
          transferredBytes: Math.min(selectedFile.size, transferredBytes),
          totalChunks,
          completedChunks: completed,
          percent: Math.min(100, Math.round((completed / totalChunks) * 100)),
          chunkStates: [...chunkStates],
          speedBytesPerSec: speed,
          etaSeconds: eta,
          retransmissionsCount: retransmits,
          isReceiving: false,
        });
      };

      updateProgress(0);

      // 3. Transmissão do Frame de Metadados (FILE_META)
      const metaPayload = encodeFileMetaPayload(meta);
      const dst = destinationNode.trim() || '**';
      await nodeRef.current.sendFrame(FrameType.DATA, dst, metaPayload);

      // 4. Transmissão dos Chunks com Janela Deslizante
      let retransmits = 0;
      for (let i = 0; i < totalChunks; i++) {
        chunkStates[i] = 'sending';
        updateProgress(i, retransmits);

        const startByte = i * chunkSize;
        const endByte = Math.min(payloadToSend.length, startByte + chunkSize);
        const chunkSlice = payloadToSend.slice(startByte, endByte);
        const chunkPayload = encodeFileChunkPayload(fileId, i, chunkSlice);

        const delivered = await nodeRef.current.sendFrame(FrameType.DATA, dst, chunkPayload);
        if (delivered) {
          chunkStates[i] = 'acked';
        } else {
          chunkStates[i] = 'lost';
          retransmits++;
        }
        updateProgress(i + 1, retransmits);
      }

      confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
    } catch (err: unknown) {
      alert('Falha na transferência acústica do arquivo: ' + (err as Error).message);
    } finally {
      setIsSendingFile(false);
    }
  };

  // Enviar Beacon de Presença (Descoberta na Sala)
  const sendBeacon = async () => {
    if (!nodeRef.current) return;
    await nodeRef.current.sendFrame(FrameType.BEACON, '**', `BEACON:${myNodeId}`);
  };

  // Enviar Ping Acústico para medição de RTT
  const sendPing = async () => {
    if (!nodeRef.current) return;
    const target = destinationNode === '**' ? 'B2' : destinationNode;
    const start = Date.now();
    const delivered = await nodeRef.current.sendFrame(FrameType.PING, target, 'PING');
    if (delivered) {
      const rtt = Date.now() - start;
      alert(`🏓 PONG Acústico recebido de ${target}! Latência RTT: ${rtt} ms`);
    } else {
      alert(`⚠️ Nó ${target} não respondeu ao ping no canal ${selectedChannel}.`);
    }
  };

  // Renderizador do Gráfico de Throughput
  const renderGraphs = useCallback(() => {
    const canvas = throughputCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.fillStyle = '#060913';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += height / 4) {
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(width, y);
      ctx.stroke();
    }

    const history = throughputHistoryRef.current;
    if (history.length < 2) return;

    const step = width / (history.length - 1);
    const maxVal = Math.max(10, ...history.map((h) => Math.max(h.tx, h.rx)));

    // Linha de RX (Verde Esmeralda)
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    history.forEach((h, i) => {
      const x = i * step;
      const y = height - (h.rx / maxVal) * (height - 20) - 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Linha de TX (Ciano / Azul)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    history.forEach((h, i) => {
      const x = i * step;
      const y = height - (h.tx / maxVal) * (height - 20) - 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, []);

  useEffect(() => {
    const interval = setInterval(renderGraphs, 200);
    return () => clearInterval(interval);
  }, [renderGraphs]);

  const currentChConfig = ACOUSTIC_CHANNELS.find((c) => c.id === selectedChannel) || ACOUSTIC_CHANNELS[1];

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* HEADER DA REDE ACÚSTICA */}
      <div className="p-4 bg-gradient-to-r from-slate-950 via-indigo-950/40 to-slate-950 border border-indigo-500/40 rounded-2xl flex items-center justify-between flex-wrap gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border transition-all ${
            isRunning
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
              : 'bg-slate-900 border-slate-800 text-slate-500'
          }`}>
            <Wifi className={`w-5 h-5 ${isRunning ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-slate-100 uppercase tracking-widest">
                Rede Acústica P2P Mesh (Full-Duplex por Som)
              </h2>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${
                isRunning
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {isRunning ? '● REDE ATIVA' : '○ EM ESPERA'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Protocolo FSK Full-Duplex • Endereçamento Físico • Arquivos por Som (TCP SACK) • Canais FDMA
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Alternador de Sub-Abas: Chat vs Arquivos */}
          <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveSubTab('chat')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'chat'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              💬 Mensagens & Telemetria
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('files')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'files'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📁 Arquivos & Fotos (TCP Acústico)
            </button>
          </div>

          {isRunning && (
            <button
              type="button"
              onClick={() => {
                if (!nodeRef.current) return;
                if (metrics.receiverSource === 'gyroscope') {
                  nodeRef.current.startListening();
                } else {
                  nodeRef.current.startGyroscopeListening('Modo alternativo forçado');
                }
              }}
              className="px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 bg-slate-900 border-slate-700 hover:border-slate-500 text-slate-300 cursor-pointer shadow-md"
              title="Alternar sensor de captação entre Microfone Físico e Giroscópio MEMS"
            >
              {metrics.receiverSource === 'gyroscope' ? (
                <>
                  <Activity className="w-3.5 h-3.5 text-amber-400" />
                  <span>RX: Giroscópio MEMS</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>RX: Microfone</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={toggleNetwork}
            className={`px-4 py-2 rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-all cursor-pointer ${
              isRunning
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
            }`}
          >
            {isRunning ? (
              <>
                <VolumeX className="w-4 h-4" />
                <span>Desconectar</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" />
                <span>Conectar à Rede</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* CONTROLE DE CANAIS E IDENTIDADE */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
          <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider">
            Nó Local (Node ID):
          </span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              maxLength={4}
              value={myNodeId}
              onChange={(e) => setMyNodeId(e.target.value.toUpperCase())}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-sm font-mono font-extrabold text-indigo-300 text-center w-24 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={sendBeacon}
              disabled={!isRunning}
              className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1"
            >
              <Radio className="w-3.5 h-3.5 text-indigo-400" />
              <span>Anunciar Nó</span>
            </button>
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
          <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider">
            Canal Acústico (FDMA):
          </span>
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(Number(e.target.value))}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
          >
            {ACOUSTIC_CHANNELS.map((ch) => (
              <option key={ch.id} value={ch.id}>
                Canal {ch.id} ({ch.txFreq0}Hz - {ch.rxFreq1}Hz)
              </option>
            ))}
          </select>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
          <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider">
            Modo de Transmissão:
          </span>
          <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setIsFullDuplex(true)}
              className={`py-1 rounded-lg transition-all ${
                isFullDuplex ? 'bg-indigo-600 text-white' : 'text-slate-400'
              }`}
            >
              Full-Duplex (FDD)
            </button>
            <button
              type="button"
              onClick={() => setIsFullDuplex(false)}
              className={`py-1 rounded-lg transition-all ${
                !isFullDuplex ? 'bg-indigo-600 text-white' : 'text-slate-400'
              }`}
            >
              Half-Duplex
            </button>
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
          <span className="text-[11px] text-slate-400 font-bold block uppercase tracking-wider">
            Sensor de Portadora (CSMA):
          </span>
          <div className="flex items-center justify-between pt-1">
            <span className={`text-xs font-mono font-bold flex items-center gap-1.5 ${
              metrics.carrierBusy ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              <Activity className="w-4 h-4" />
              {metrics.carrierBusy ? 'AR OCUPADO (SINAL)' : 'AR LIVRE P/ TRANSMITIR'}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              Perda: {metrics.packetLossPercent}%
            </span>
          </div>
        </div>
      </div>

      {/* BANNER DE RECEPÇÃO POR GIROSCÓPIO MEMS (FALLBACK ACÚSTICO ATIVO) */}
      {metrics.receiverSource === 'gyroscope' && isRunning && (
        <div className="p-3.5 bg-gradient-to-r from-amber-500/15 via-slate-900/90 to-amber-500/10 border border-amber-500/40 rounded-2xl flex items-center justify-between flex-wrap gap-3 text-xs font-mono shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span className="font-bold text-amber-300">
              🛰️ RECEPTOR ACÚSTICO: GIROSCÓPIO MEMS (Acoustic Gyrophone Fallback Ativo)
            </span>
            <span className="text-[10px] text-amber-200/80 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
              {metrics.gyroFallbackReason || 'Microfone Bloqueado / Indisponível'}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-slate-300 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
              Amostragem: <strong className="text-emerald-400">{metrics.gyroSampleRateHz || 0} Hz</strong>
            </span>
            <span className="text-slate-300 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
              Eixo Ressonante: <strong className="text-indigo-400">Eixo {metrics.gyroDominantAxis?.toUpperCase() || 'Z'}</strong>
            </span>
            <span className="text-slate-300 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
              Vibração RMS: <strong className="text-amber-300">{(metrics.gyroRmsVibration || 0).toFixed(4)}</strong>
            </span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: ARQUIVOS, DOCUMENTOS E FOTOS POR SOM (TCP ACÚSTICO & SACK) */}
      {/* ========================================================================= */}
      {activeSubTab === 'files' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Painel Esquerdo: Seleção e Empacotamento Inteligente */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                  <FileUp className="w-4 h-4" /> 1. Empacotamento e Envio de Arquivos por Som
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">ARQ: Selective Repeat SACK</span>
              </div>

              {/* Upload do Arquivo / Foto */}
              <label className="border-2 border-dashed border-slate-800 hover:border-emerald-500/60 bg-slate-950 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all text-center space-y-2">
                {filePreviewUrl ? (
                  <img
                    src={filePreviewUrl}
                    alt="Preview"
                    className="max-h-28 rounded-lg object-contain border border-slate-800 mb-1"
                  />
                ) : (
                  <FileText className="w-8 h-8 text-emerald-400 mb-1" />
                )}
                <div className="text-xs font-bold text-slate-200">
                  {selectedFile ? selectedFile.name : 'Selecione um Documento, Foto ou Arquivo'}
                </div>
                <p className="text-[10px] text-slate-500">
                  {selectedFile
                    ? `${(selectedFile.size / 1024).toFixed(1)} KB • ${selectedFile.type || 'Binário'}`
                    : 'PDF, TXT, PNG, JPG, DOCX ou ZIP para envio sonoro'}
                </p>
                <input
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>

              {/* Ajustes de Empacotamento Inteligente */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">Tamanho do Chunk Acústico:</span>
                  <select
                    value={chunkSize}
                    onChange={(e) => setChunkSize(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs font-mono"
                  >
                    <option value={24}>24 bytes (Alta Estabilidade / Ruído Alto)</option>
                    <option value={36}>36 bytes (Equilibrado • Padrão)</option>
                    <option value={48}>48 bytes (Alta Velocidade / Silêncio)</option>
                    <option value={64}>64 bytes (Velocidade Máxima)</option>
                  </select>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">Destinatário Acústico:</span>
                  <input
                    type="text"
                    value={destinationNode}
                    onChange={(e) => setDestinationNode(e.target.value.toUpperCase())}
                    placeholder="Ex: B2 ou ** (Todos)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono font-bold text-amber-300 focus:outline-none"
                  />
                </div>
              </div>

              {/* Opção de Compressão Gzip */}
              <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={useGzip}
                    onChange={(e) => setUseGzip(e.target.checked)}
                    className="accent-emerald-500 rounded"
                  />
                  <span>Compressão Nativa GZIP (Reduz em até 70% o tempo acústico)</span>
                </label>
                <span className="text-[10px] text-emerald-400 font-mono">Ativada</span>
              </div>

              {/* Botão de Envio de Arquivo */}
              <button
                type="button"
                disabled={!isRunning || !selectedFile || isSendingFile}
                onClick={handleSendFileAcoustic}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                {isSendingFile ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Transmitindo Chunks e Gerenciando SACK...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Transmitir Arquivo por Som (TCP Acústico)</span>
                  </>
                )}
              </button>
            </div>

            {/* Painel Direito: Mosaico de Chunks em Tempo Real (BitTorrent/TCP Grid) */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl">
              <div>
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-3">
                  <Binary className="w-4 h-4 text-emerald-400" /> Matriz de Chunks & Integridade SACK
                </h3>

                {/* Status da Transmissão Ativa (TX ou RX) */}
                {(txProgress || rxProgress) ? (
                  <div className="space-y-3">
                    {(() => {
                      const p = txProgress || rxProgress!;
                      return (
                        <>
                          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono">
                            <div>
                              <span className="font-bold text-slate-200 block truncate max-w-[200px]">
                                {p.fileName}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {p.isReceiving ? 'Recebendo' : 'Enviando'}: {p.completedChunks} de {p.totalChunks} chunks ({p.percent}%)
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-emerald-400 block">{p.speedBytesPerSec} B/s</span>
                              <span className="text-[10px] text-slate-500">ETA: {p.etaSeconds}s</span>
                            </div>
                          </div>

                          {/* Barra de Progresso */}
                          <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                            <div
                              className="bg-emerald-500 h-full transition-all duration-150"
                              style={{ width: `${p.percent}%` }}
                            />
                          </div>

                          {/* Mosaico Visual de Chunks */}
                          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span>Mapeamento de Blocos do Arquivo:</span>
                              <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block"></span> Confirmado
                                </span>
                                <span className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-sm bg-sky-500 inline-block"></span> Transmitindo
                                </span>
                                <span className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-sm bg-rose-500 inline-block"></span> Re-solicitado
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-12 sm:grid-cols-16 gap-1 max-h-36 overflow-y-auto p-1">
                              {p.chunkStates.map((st, idx) => (
                                <div
                                  key={idx}
                                  title={`Chunk ${idx}: ${st}`}
                                  className={`h-4 rounded-sm transition-all flex items-center justify-center text-[8px] font-mono font-bold ${
                                    st === 'acked'
                                      ? 'bg-emerald-500 text-black'
                                      : st === 'sending'
                                      ? 'bg-sky-500 text-white animate-pulse'
                                      : st === 'lost'
                                      ? 'bg-rose-500 text-white'
                                      : 'bg-slate-800 text-slate-500'
                                  }`}
                                >
                                  {idx}
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="h-44 border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                    <Binary className="w-8 h-8 text-slate-700 animate-pulse" />
                    <p className="text-xs text-slate-400 font-semibold">Nenhuma transferência em andamento.</p>
                    <p className="text-[10px] text-slate-600 max-w-sm">
                      Ao iniciar o envio ou receber um arquivo, o mosaico de chunks mostrará o progresso bloco a bloco em tempo real.
                    </p>
                  </div>
                )}
              </div>

              {/* Lista de Arquivos Concluídos e Recebidos */}
              <div className="border-t border-slate-800 pt-3">
                <span className="text-[11px] font-bold text-slate-300 block mb-2">
                  Arquivos Recebidos e Verificados ({completedFiles.length}):
                </span>
                {completedFiles.length === 0 ? (
                  <p className="text-[11px] text-slate-600 italic">Nenhum arquivo recebido ainda nesta sessão.</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {completedFiles.map((f) => (
                      <div
                        key={f.id}
                        className="p-2.5 bg-slate-950 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5 truncate max-w-[200px]">
                          <span className="font-bold text-slate-200 block truncate">{f.name}</span>
                          <span className="text-[10px] text-emerald-400 font-mono">
                            {(f.size / 1024).toFixed(1)} KB • SHA-256 Verificado • De: {f.srcNode}
                          </span>
                        </div>
                        <a
                          href={f.url}
                          download={f.name}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm transition-all"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Baixar</span>
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 1: CHAT & TELEMETRIA P2P (TELEMETRIA E TERMINAL) */}
      {/* ========================================================================= */}
      {activeSubTab === 'chat' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráficos de Throughput e Qualidade */}
            <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" /> Telemetria de Velocidade e Fluxo Acústico
                </h3>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-sky-400">
                    <span className="w-2 h-2 rounded-full bg-sky-400 inline-block"></span>
                    TX: {metrics.txBytesPerSec} B/s ({metrics.txTotalPackets} pkts)
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                    RX: {metrics.rxBytesPerSec} B/s ({metrics.rxTotalPackets} pkts)
                  </span>
                </div>
              </div>

              {/* Gráfico Canvas */}
              <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                <canvas
                  ref={throughputCanvasRef}
                  width={640}
                  height={140}
                  className="w-full h-36 block"
                />
              </div>

              {/* Cards de Métricas de Qualidade */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Taxa Baud:</span>
                  <span className="font-bold text-indigo-400">{baudRate} baud</span>
                </div>
                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Retransmissões:</span>
                  <span className="font-bold text-amber-400">{metrics.txRetries}</span>
                </div>
                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Erros de CRC:</span>
                  <span className="font-bold text-rose-400">{metrics.crcErrors}</span>
                </div>
                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Perda Estimada:</span>
                  <span className={`font-bold ${metrics.packetLossPercent > 10 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {metrics.packetLossPercent}%
                  </span>
                </div>
              </div>
            </div>

            {/* Lista de Nós Descobertos na Sala */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-400" /> Nós Ativos na Sala ({peersList.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setPeersList([])}
                    className="text-[10px] text-slate-500 hover:text-slate-300"
                  >
                    Limpar
                  </button>
                </div>

                {peersList.length === 0 ? (
                  <div className="p-6 border border-dashed border-slate-800 rounded-xl text-center text-slate-500 text-xs space-y-1">
                    <Radio className="w-6 h-6 mx-auto text-slate-700 animate-pulse mb-1" />
                    <p>Nenhum outro nó detectado no ar.</p>
                    <p className="text-[10px]">Conecte outro computador ou celular na mesma sala para comunicar por som.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {peersList.map((peer) => (
                      <div
                        key={peer.nodeId}
                        onClick={() => setDestinationNode(peer.nodeId)}
                        className="p-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                          <span className="font-mono font-bold text-xs text-indigo-300">
                            {peer.nodeId}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          <span>{peer.packetsReceived} pkts</span>
                          <span className="ml-2 text-indigo-400">🎯 Selecionar</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400">
                💡 <strong>Inteligência de Sala:</strong> Vários computadores na mesma sala podem falar entre si. Basta cada um definir um Node ID diferente no mesmo canal!
              </div>
            </div>
          </div>

          {/* TERMINAL DE CHAT P2P E SINTONIA */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Radio className="w-4 h-4 text-indigo-400" /> Registro de Mensagens Acústicas
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">
                  Canal {selectedChannel}: {currentChConfig.txFreq0}Hz - {currentChConfig.rxFreq1}Hz
                </span>
              </div>

              <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 h-56 overflow-y-auto space-y-2.5 font-mono text-xs">
                {chatLog.length === 0 ? (
                  <div className="text-center text-slate-600 py-16 text-xs">
                    Aguardando transmissão ou recepção de dados pela rede sonora...
                  </div>
                ) : (
                  chatLog.map((log) => (
                    <div
                      key={log.id}
                      className={`p-2 rounded-lg border text-xs leading-relaxed ${
                        log.type === 'tx'
                          ? 'bg-indigo-950/30 border-indigo-500/40 text-indigo-200 ml-6'
                          : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200 mr-6'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                        <span>
                          {log.type === 'tx' ? `[TX] Eu (${log.src}) ➔ ${log.dst}` : `[RX] ${log.src} ➔ ${log.dst}`}
                        </span>
                        <span className="flex items-center gap-1">
                          {log.time}
                          {log.type === 'tx' && log.dst !== '**' && (
                            log.ack ? (
                              <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                                <Check className="w-3 h-3" /> ACK
                              </span>
                            ) : (
                              <span className="text-slate-500">...</span>
                            )
                          )}
                        </span>
                      </div>
                      <div className="select-all font-sans font-medium">{log.text}</div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="w-28 shrink-0">
                  <input
                    type="text"
                    value={destinationNode}
                    onChange={(e) => setDestinationNode(e.target.value.toUpperCase())}
                    placeholder="Destino (**)"
                    title="Endereço do nó de destino. Digite ** para Broadcast a todos na sala."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2.5 text-xs font-mono font-bold text-center text-amber-300 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Digite a mensagem para transmitir por som..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />

                <button
                  type="button"
                  disabled={!isRunning || !inputMessage.trim()}
                  onClick={handleSendMessage}
                  className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar Som</span>
                </button>
              </div>
            </div>

            {/* Sintonia Fina do Modem */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl">
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-400" /> Sintonia Fina do Modem
                </h3>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Velocidade de Modulação (Baud Rate):</span>
                    <span className="font-mono text-indigo-400 font-bold">{baudRate} baud ({Math.round(1000 / baudRate)}ms/bit)</span>
                  </div>
                  <input
                    type="range"
                    min={15}
                    max={50}
                    value={baudRate}
                    onChange={(e) => setBaudRate(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Squelch / Filtro de Ruído Ambiente:</span>
                    <span className="font-mono text-emerald-400 font-bold">{squelchThreshold}</span>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={150}
                    value={squelchThreshold}
                    onChange={(e) => setSquelchThreshold(Number(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Volume de Transmissão:</span>
                    <span className="font-mono text-amber-400 font-bold">{Math.round(volume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1.0}
                    step={0.05}
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={!isRunning}
                  onClick={sendPing}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Compass className="w-4 h-4 text-indigo-400" />
                  <span>Sonar Ping (Medir Latência RTT com {destinationNode})</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
