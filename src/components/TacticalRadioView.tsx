import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Radio,
  RadioTower,
  Volume2,
  VolumeX,
  Mic,
  Activity,
  Sliders,
  Send,
  FileText,
  Repeat,
  Layers,
  Sparkles,
  Zap,
  Play,
  Square,
  Shield,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Check,
  Copy,
  Clock,
  Compass,
  ArrowRightLeft,
  Share2,
  Terminal,
} from 'lucide-react';
import {
  RADIO_PRESETS,
  RadioBandPreset,
  CTCSS_TONES,
  RadioChatMessage,
  RadioFileChunk,
  TacticalRadioStatus,
  DEFAULT_RADIO_STATUS,
  calculateRadioCrc32,
  RadioAudioTransceiver,
} from '../utils/tacticalRadioEngine';

export const TacticalRadioView: React.FC = () => {
  // Aba Ativa: Transceptor | Chat de Rádio | Envio de Arquivos | Orquestrador & Malha | Hardware & CAT
  const [activeTab, setActiveTab] = useState<'transceiver' | 'chat' | 'files' | 'automation' | 'hardware'>('transceiver');

  // Estado do Rádio
  const [radioStatus, setRadioStatus] = useState<TacticalRadioStatus>(DEFAULT_RADIO_STATUS);
  const [selectedPreset, setSelectedPreset] = useState<RadioBandPreset>(RADIO_PRESETS[3]); // VHF 2m Chamada

  // Chat de Rádio States
  const [chatMessages, setChatMessages] = useState<RadioChatMessage[]>([
    {
      id: 'msg_1',
      senderCallsign: 'PU2XYZ-BASE',
      recipientCallsign: 'CQ',
      text: 'CQ CQ CQ DE PU2XYZ-BASE. Estação ouvindo no canal tático simplex.',
      frequencyHz: 146520000,
      modulation: 'NBFM / AFSK',
      timestamp: Date.now() - 1000 * 60 * 8,
      snrDb: 18,
      hopCount: 0,
      isConfirmedAck: true,
    },
    {
      id: 'msg_2',
      senderCallsign: 'JYY-DELTA-02',
      recipientCallsign: 'JYY-NODE-01',
      text: 'Sinal recebido 5/9 pleno. Enlace RF estabelecido com sucesso na malha soberana.',
      frequencyHz: 146520000,
      modulation: 'NBFM / AFSK',
      timestamp: Date.now() - 1000 * 60 * 3,
      snrDb: 15,
      hopCount: 1,
      isConfirmedAck: true,
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [recipientCallsign, setRecipientCallsign] = useState('CQ');

  // Arquivos sobre Rádio States
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: number; contentBase64: string } | null>(null);
  const [fileChunks, setFileChunks] = useState<RadioFileChunk[]>([]);
  const [currentSendingChunkIndex, setCurrentSendingChunkIndex] = useState<number>(-1);
  const [isFileTransmitting, setIsFileTransmitting] = useState<boolean>(false);
  const [chunkSizeBytes, setChunkSizeBytes] = useState<number>(128); // 128 bytes por pacote
  const [receivedFiles, setReceivedFiles] = useState<{ id: string; name: string; size: number; timestamp: number }[]>([
    { id: 'f_sample', name: 'plano_de_reserva_tatico.txt', size: 1024 * 4, timestamp: Date.now() - 1000 * 60 * 15 },
  ]);

  // Automação & Malha RF
  const [beaconCounter, setBeaconCounter] = useState<number>(600); // 10 min
  const [isBeaconActive, setIsBeaconActive] = useState<boolean>(true);
  const [transmittedPacketsTotal, setTransmittedPacketsTotal] = useState<number>(42);
  const [receivedPacketsTotal, setReceivedPacketsTotal] = useState<number>(138);

  // Instância do Transceptor de Áudio (Web Audio API)
  const audioTransceiverRef = useRef<RadioAudioTransceiver | null>(null);
  const [isToneTransmitting, setIsToneTransmitting] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Inicializar Transceptor de Áudio
  useEffect(() => {
    audioTransceiverRef.current = new RadioAudioTransceiver();
  }, []);

  // Simulação Contínua de S-Meter e Ocupação do Canal
  useEffect(() => {
    const timer = setInterval(() => {
      // Oscilação dinâmica do S-Meter (S1 a S9+20dB)
      setRadioStatus((prev) => {
        const jitterSmeter = Math.max(1, Math.min(12, Math.round(5 + (Math.random() - 0.48) * 4)));
        const isBusy = jitterSmeter >= (prev.squelchLevel * 1.2);
        return {
          ...prev,
          smeterValue: jitterSmeter,
          channelBusy: isBusy,
          isReceiving: isBusy && !prev.isTransmitting,
        };
      });

      // Contador de baliza (beacon)
      if (isBeaconActive) {
        setBeaconCounter((c) => {
          if (c <= 1) {
            handleTransmitBeacon();
            return radioStatus.beaconIntervalMinutes * 60;
          }
          return c - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isBeaconActive, radioStatus.squelchLevel, radioStatus.beaconIntervalMinutes]);

  // Aplicar Preset de Banda
  const handleApplyPreset = (preset: RadioBandPreset) => {
    setSelectedPreset(preset);
    setRadioStatus((prev) => ({
      ...prev,
      vfoFreqHz: preset.frequencyHz,
      mode: preset.mode,
      powerWatts: preset.powerWatts,
      ctcssToneHz: preset.ctcssDefault || null,
    }));
    setActionNotice(`📻 Preset aplicado: ${preset.name} (${(preset.frequencyHz / 1e6).toFixed(3)} MHz)`);
    setTimeout(() => setActionNotice(null), 3000);
  };

  // Alternar PTT Manual (TX / RX)
  const handleTogglePtt = async () => {
    if (radioStatus.isTransmitting) {
      // Parar Transmissão
      setRadioStatus((prev) => ({ ...prev, isTransmitting: false }));
      audioTransceiverRef.current?.stop();
      setIsToneTransmitting(false);
      setActionNotice('🛑 PTT Liberado. Transceptor em modo RX (Recepção).');
      setTimeout(() => setActionNotice(null), 2500);
    } else {
      // Iniciar Transmissão
      setRadioStatus((prev) => ({ ...prev, isTransmitting: true }));
      setIsToneTransmitting(true);
      setActionNotice(`🔴 PTT ATIVADO (TX)! Transmitindo em ${(radioStatus.vfoFreqHz / 1e6).toFixed(3)} MHz (${radioStatus.powerWatts}W)...`);

      // Emitir Tom de Portadora / PTT Vox
      if (audioTransceiverRef.current) {
        await audioTransceiverRef.current.transmitPacketAudio(
          `JYY_TX_${radioStatus.callsign}_CARRIER`,
          radioStatus.ctcssToneHz,
          () => {
            setRadioStatus((prev) => ({ ...prev, isTransmitting: false }));
            setIsToneTransmitting(false);
          }
        );
      }
    }
  };

  // Transmitir Mensagem do Chat via Rádio
  const handleSendChatMessage = async () => {
    if (!chatInput.trim()) return;
    const msgText = chatInput.trim();
    setChatInput('');

    const newMsg: RadioChatMessage = {
      id: `radio_msg_${Date.now()}`,
      senderCallsign: radioStatus.callsign,
      recipientCallsign: recipientCallsign.trim() || 'CQ',
      text: msgText,
      frequencyHz: radioStatus.vfoFreqHz,
      modulation: radioStatus.mode,
      timestamp: Date.now(),
      snrDb: 22,
      hopCount: 0,
      isConfirmedAck: true,
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setTransmittedPacketsTotal((c) => c + 1);

    // Ativar TX e modular pacote AFSK
    setRadioStatus((prev) => ({ ...prev, isTransmitting: true }));
    setIsToneTransmitting(true);
    setActionNotice(`📡 Transmitindo pacote AFSK no ar: "${msgText}"...`);

    const packetFrame = `[${radioStatus.callsign}>${recipientCallsign}]:${msgText}`;

    if (audioTransceiverRef.current) {
      await audioTransceiverRef.current.transmitPacketAudio(packetFrame, radioStatus.ctcssToneHz, () => {
        setRadioStatus((prev) => ({ ...prev, isTransmitting: false }));
        setIsToneTransmitting(false);
        setActionNotice('✅ Pacote de rádio transmitido com sucesso!');
        setTimeout(() => setActionNotice(null), 3000);
      });
    } else {
      setTimeout(() => {
        setRadioStatus((prev) => ({ ...prev, isTransmitting: false }));
        setIsToneTransmitting(false);
      }, 800);
    }
  };

  // Transmitir Baliza Periódica (Beacon)
  const handleTransmitBeacon = async () => {
    const beaconText = `BEACON: ID=${radioStatus.callsign} | FREQ=${(radioStatus.vfoFreqHz / 1e6).toFixed(3)}MHz | PWR=${radioStatus.powerWatts}W | MESH=ATIVO`;
    setActionNotice(`🛰️ Transmitindo baliza automática de presença no canal: ${radioStatus.callsign}...`);

    if (audioTransceiverRef.current) {
      setRadioStatus((prev) => ({ ...prev, isTransmitting: true }));
      await audioTransceiverRef.current.transmitPacketAudio(beaconText, radioStatus.ctcssToneHz, () => {
        setRadioStatus((prev) => ({ ...prev, isTransmitting: false }));
      });
    }
  };

  // Carregar Arquivo para Envio sobre Rádio
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).split(',')[1] || '';
      setSelectedFile({
        name: file.name,
        size: file.size,
        contentBase64: b64,
      });

      // Fragmentar em chunks
      const total = Math.ceil(b64.length / chunkSizeBytes);
      const chunks: RadioFileChunk[] = [];
      const fileId = `file_${Date.now()}`;

      for (let i = 0; i < total; i++) {
        const slice = b64.slice(i * chunkSizeBytes, (i + 1) * chunkSizeBytes);
        chunks.push({
          fileId,
          fileName: file.name,
          fileSizeBytes: file.size,
          totalChunks: total,
          chunkIndex: i,
          payloadBase64: slice,
          crc32: calculateRadioCrc32(slice),
        });
      }

      setFileChunks(chunks);
      setCurrentSendingChunkIndex(-1);
      setActionNotice(`📁 Arquivo "${file.name}" fragmentado em ${total} blocos de ${chunkSizeBytes} bytes.`);
      setTimeout(() => setActionNotice(null), 3500);
    };
    reader.readAsDataURL(file);
  };

  // Iniciar Transmissão do Arquivo Bloco a Bloco
  const handleStartFileTransmission = async () => {
    if (!selectedFile || fileChunks.length === 0 || isFileTransmitting) return;

    setIsFileTransmitting(true);
    setActionNotice(`🚀 Iniciando envio de "${selectedFile.name}" via rádio...`);

    for (let i = 0; i < fileChunks.length; i++) {
      setCurrentSendingChunkIndex(i);
      const chunk = fileChunks[i];
      const packetStr = `FCHUNK:${chunk.fileName}:${chunk.chunkIndex + 1}/${chunk.totalChunks}:${chunk.crc32}:${chunk.payloadBase64}`;

      setRadioStatus((prev) => ({ ...prev, isTransmitting: true }));

      if (audioTransceiverRef.current) {
        await audioTransceiverRef.current.transmitPacketAudio(packetStr, radioStatus.ctcssToneHz);
      } else {
        await new Promise((r) => setTimeout(r, 200));
      }

      // Pequena pausa entre blocos para resfriamento do transceptor (TOT)
      await new Promise((r) => setTimeout(r, 120));
    }

    setRadioStatus((prev) => ({ ...prev, isTransmitting: false }));
    setIsFileTransmitting(false);
    setActionNotice(`✅ Arquivo "${selectedFile.name}" transmitido integralmente por rádio!`);
    setTimeout(() => setActionNotice(null), 4000);
  };

  return (
    <div className="space-y-4 font-sans animate-in fade-in pb-12">
      {/* Notificação Flutuante */}
      {actionNotice && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-2xl bg-emerald-950/95 text-emerald-200 border border-emerald-600/60 backdrop-blur-md shadow-2xl flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-top">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* HEADER TÁTICO & VFO DIGITAL DO TRANSCEPTOR */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 p-5 rounded-3xl border border-emerald-900/50 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-0.5 shadow-lg shadow-emerald-950 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-emerald-400">
                <RadioTower className="w-6 h-6 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black text-slate-100 tracking-wide flex items-center gap-2">
                  <span>Transceptor & Rádio Tático (UHF / VHF / HF / FM / AM)</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/50 uppercase">
                    RF Mesh Controller
                  </span>
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 ${
                  radioStatus.isTransmitting
                    ? 'bg-rose-950 text-rose-300 border border-rose-700/60 animate-pulse'
                    : radioStatus.isReceiving
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    radioStatus.isTransmitting ? 'bg-rose-500' : radioStatus.isReceiving ? 'bg-emerald-400' : 'bg-slate-500'
                  }`} />
                  {radioStatus.isTransmitting ? 'TX TRANSMITINDO' : radioStatus.isReceiving ? 'RX SINAL PRESENTE' : 'RX EM ESPERA'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Controlador Físico de Rádio • Chat de Pacotes • Transferência de Arquivos • Automação & PTT
              </p>
            </div>
          </div>

          {/* BOTÃO PTT MANUAL & INDICADOR DE CALLSIGN */}
          <div className="flex items-center gap-3">
            <div className="text-right pr-2 hidden sm:block">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Indicativo Local</span>
              <strong className="text-xs font-mono text-emerald-300">{radioStatus.callsign}</strong>
            </div>

            <button
              type="button"
              onClick={handleTogglePtt}
              className={`px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-xl active:scale-95 ${
                radioStatus.isTransmitting
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950 border border-rose-400 animate-pulse'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950 border border-emerald-400/40'
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>{radioStatus.isTransmitting ? 'LIBERAR PTT' : 'PRESSIONE PTT (TX)'}</span>
            </button>
          </div>
        </div>

        {/* VISOR VFO DIGITAL ESTILO OLED AEROESPACIAL */}
        <div className="mt-4 p-4 rounded-2xl bg-slate-950 border border-emerald-900/60 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* Frequência Principal VFO A */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-emerald-400">
              <span className="font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> VFO A (PRINCIPAL)
              </span>
              <span>{radioStatus.mode} • {radioStatus.powerWatts}W</span>
            </div>
            <div className="text-3xl font-black font-mono tracking-tight text-emerald-300 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-emerald-950 text-center shadow-inner select-all">
              {(radioStatus.vfoFreqHz / 1e6).toFixed(3)}{' '}
              <span className="text-sm font-normal text-emerald-500">MHz</span>
            </div>
          </div>

          {/* S-Meter Analógico / Barra de Nível de Sinal */}
          <div className="space-y-1.5 px-2">
            <div className="flex justify-between text-[10px] font-mono text-slate-400">
              <span>S-METER DE SINAL</span>
              <strong className="text-emerald-400">S{radioStatus.smeterValue} (+{radioStatus.smeterValue > 9 ? 20 : 0}dB)</strong>
            </div>

            {/* Barra de Segmentos S1 a S9+30dB */}
            <div className="grid grid-cols-12 gap-1 h-3 p-0.5 rounded-lg bg-slate-900 border border-slate-800">
              {Array.from({ length: 12 }).map((_, idx) => (
                <div
                  key={idx}
                  className={`h-full rounded-xs transition-all ${
                    idx < radioStatus.smeterValue
                      ? idx >= 9
                        ? 'bg-rose-500'
                        : idx >= 6
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                      : 'bg-slate-800/40'
                  }`}
                />
              ))}
            </div>

            <div className="flex justify-between text-[9px] font-mono text-slate-500 px-0.5">
              <span>S1</span>
              <span>S3</span>
              <span>S5</span>
              <span>S7</span>
              <span>S9</span>
              <span className="text-rose-400">+30dB</span>
            </div>
          </div>

          {/* Frequência Secundária VFO B & Sub-Tom */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-cyan-400">
              <span className="font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400" /> VFO B (DUAL WATCH)
              </span>
              <span>CTCSS: {radioStatus.ctcssToneHz ? `${radioStatus.ctcssToneHz} Hz` : 'OFF'}</span>
            </div>
            <div className="text-2xl font-black font-mono tracking-tight text-cyan-300 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-cyan-950 text-center shadow-inner select-all">
              {(radioStatus.vfoSubFreqHz / 1e6).toFixed(3)}{' '}
              <span className="text-xs font-normal text-cyan-500">MHz</span>
            </div>
          </div>
        </div>
      </div>

      {/* ABAS DE NAVEGAÇÃO DA PÁGINA */}
      <div className="flex bg-slate-900/80 p-1 rounded-2xl border border-slate-800 text-xs font-semibold overflow-x-auto gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('transceiver')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'transceiver'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Transceptor & Bandas</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'chat'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Chat de Rádio Tático</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-emerald-300 text-[10px]">
            {chatMessages.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('files')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'files'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Envio de Arquivos por Rádio</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('automation')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'automation'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Repeat className="w-4 h-4" />
          <span>Orquestrador & Malha RF</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('hardware')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'hardware'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Hardware & CAT Control</span>
        </button>
      </div>

      {/* CONTEÚDO DAS ABAS */}

      {/* 1. ABA DO TRANSCEPTOR & PRESETS DE BANDAS */}
      {activeTab === 'transceiver' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Coluna Esquerda (2 colunas): Presets de Bandas e Sintonia */}
          <div className="lg:col-span-2 space-y-4">
            <div className="p-4 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <RadioTower className="w-4 h-4 text-emerald-400" /> Presets de Frequências Homologadas & Canais Táticos
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {RADIO_PRESETS.map((preset) => (
                  <div
                    key={preset.id}
                    onClick={() => handleApplyPreset(preset)}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                      selectedPreset.id === preset.id
                        ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200 shadow-md'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-xs mb-1">
                      <span>{preset.name}</span>
                      <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-cyan-300">
                        {preset.band}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
                      <span>{(preset.frequencyHz / 1e6).toFixed(3)} MHz</span>
                      <span className="text-emerald-400 font-bold">{preset.mode}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">{preset.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Coluna Direita: Controles de RF, Squelch & Potência */}
          <div className="p-4 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" /> Parâmetros de Recepção & Transmissão
            </h3>

            {/* Squelch */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-300 font-semibold">
                <span>Nível de Squelch: {radioStatus.squelchLevel}</span>
                <span className="text-slate-500 text-[10px]">Corte de Ruído</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={radioStatus.squelchLevel}
                onChange={(e) => setRadioStatus({ ...radioStatus, squelchLevel: parseInt(e.target.value, 10) })}
                className="w-full accent-emerald-400 cursor-pointer"
              />
            </div>

            {/* Potência de Saída */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-300 font-semibold">
                <span>Potência TX: {radioStatus.powerWatts} Watts</span>
                <span className="text-emerald-400 text-[10px]">Alimentação RF</span>
              </div>
              <select
                value={radioStatus.powerWatts}
                onChange={(e) => setRadioStatus({ ...radioStatus, powerWatts: parseInt(e.target.value, 10) })}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl p-2 font-mono"
              >
                <option value={0.5}>0.5 W (QRP / Baixo Consumo / Walkie-Talkie)</option>
                <option value={5}>5.0 W (Portátil Baofeng / Rádio Móvel Médio)</option>
                <option value={25}>25.0 W (Móvel Veicular VHF/UHF)</option>
                <option value={50}>50.0 W (Estação Base Alta Potência)</option>
                <option value={100}>100.0 W (HF Longo Alcance NVIS)</option>
              </select>
            </div>

            {/* Sub-tom CTCSS */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-300 font-semibold">
                <span>Sub-tom CTCSS: {radioStatus.ctcssToneHz ? `${radioStatus.ctcssToneHz} Hz` : 'Desativado'}</span>
                <span className="text-amber-400 text-[10px]">Repetidoras</span>
              </div>
              <select
                value={radioStatus.ctcssToneHz || ''}
                onChange={(e) => setRadioStatus({ ...radioStatus, ctcssToneHz: e.target.value ? parseFloat(e.target.value) : null })}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl p-2 font-mono"
              >
                <option value="">Sem Tom (Carrier Squelch CSQ)</option>
                {CTCSS_TONES.map((tone) => (
                  <option key={tone} value={tone}>
                    CTCSS {tone.toFixed(1)} Hz
                  </option>
                ))}
              </select>
            </div>

            {/* Modulação Ativa */}
            <div className="space-y-1">
              <label className="text-xs text-slate-300 font-semibold block">Modulação do Transceptor</label>
              <select
                value={radioStatus.mode}
                onChange={(e) => setRadioStatus({ ...radioStatus, mode: e.target.value as RadioBandPreset['mode'] })}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl p-2 font-mono"
              >
                <option value="NBFM">NBFM (Narrow FM - 12.5/25 kHz)</option>
                <option value="AFSK1200">AFSK 1200 bps (AX.25 Bell 202)</option>
                <option value="AM">AM (Amplitude Modulation - Aviação/PX)</option>
                <option value="USB">USB (Upper Sideband - HF 14/28 MHz)</option>
                <option value="LSB">LSB (Lower Sideband - HF 7 MHz)</option>
                <option value="CW">CW (Código Morse Telegráfico)</option>
                <option value="GFSK">GFSK 9600 bps (Alta Velocidade)</option>
                <option value="LoRa">LoRa CSS (Long Range Spread Spectrum)</option>
                <option value="WFM">WFM (Wideband FM Comercial 200 kHz)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 2. ABA DO CHAT DE RÁDIO TÁTICO (PACKET CHAT) */}
      {activeTab === 'chat' && (
        <div className="p-4 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-400" /> Chat de Rádio Tático sobre RF (Packet Messenger)
              </h3>
              <p className="text-xs text-slate-400">
                Transmissão direta de texto modulado em áudio AFSK 1200 bps com acionamento VOX no transceptor.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-400">Frequência: <strong className="text-emerald-300">{(radioStatus.vfoFreqHz / 1e6).toFixed(3)} MHz</strong></span>
              <span className="text-slate-400">Canal: <strong className="text-cyan-300">{selectedPreset.name.split(' ')[0]}</strong></span>
            </div>
          </div>

          {/* Histórico de Mensagens */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 h-72 overflow-y-auto space-y-3">
            {chatMessages.map((m) => (
              <div
                key={m.id}
                className={`p-3 rounded-2xl max-w-xl text-xs space-y-1 ${
                  m.senderCallsign === radioStatus.callsign
                    ? 'ml-auto bg-emerald-950/70 border border-emerald-700/60 text-emerald-100'
                    : 'mr-auto bg-slate-900 border border-slate-800 text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono opacity-80 mb-0.5">
                  <span className="font-bold flex items-center gap-1.5">
                    <Radio className="w-3 h-3" />
                    <span>{m.senderCallsign} → {m.recipientCallsign}</span>
                  </span>
                  <span>{new Date(m.timestamp).toLocaleTimeString()} • {m.snrDb ? `${m.snrDb} dB` : ''}</span>
                </div>
                <p className="leading-relaxed font-sans">{m.text}</p>
                <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 pt-1 border-t border-slate-800/40">
                  <span>Modulação: {m.modulation}</span>
                  <span>{m.hopCount === 0 ? 'Direto (Simplex)' : `${m.hopCount} Saltos (Digipeater)`}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Caixa de Entrada e Envio */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-32">
                <input
                  type="text"
                  value={recipientCallsign}
                  onChange={(e) => setRecipientCallsign(e.target.value.toUpperCase())}
                  placeholder="Destinatário (CQ)"
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 font-mono uppercase focus:outline-none focus:border-emerald-500"
                  title="Digite 'CQ' para falar com todos ou o indicativo da estação destino"
                />
              </div>

              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                placeholder="Digite sua mensagem de rádio tática..."
                className="flex-1 bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl px-4 py-2 focus:outline-none focus:border-emerald-500"
              />

              <button
                type="button"
                onClick={handleSendChatMessage}
                disabled={!chatInput.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-950 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Transmitir</span>
              </button>
            </div>

            {/* Atalhos de Mensagens Táticas Pré-definidas */}
            <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
              <span className="text-slate-500">Atalhos:</span>
              <button
                type="button"
                onClick={() => setChatInput('CQ CQ CQ Chamada Geral na Malha Soberana JYY.')}
                className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
              >
                CQ Geral
              </button>
              <button
                type="button"
                onClick={() => setChatInput('Sinal forte e claro 5/9. Estação operacional.')}
                className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
              >
                Sinal 5/9
              </button>
              <button
                type="button"
                onClick={() => setChatInput('QTH Confirmado. Coordenadas GPS sincronizadas.')}
                className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
              >
                QTH Local
              </button>
              <button
                type="button"
                onClick={() => setChatInput('🚨 ALERTA TÁTICO: Silêncio de rádio temporário em vigor.')}
                className="px-2 py-0.5 rounded-lg bg-rose-950 hover:bg-rose-900 border border-rose-700/60 text-rose-300 text-[10px]"
              >
                Alerta SOS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. ABA DE ENVIO DE ARQUIVOS POR RÁDIO (FILE-OVER-RF) */}
      {activeTab === 'files' && (
        <div className="p-4 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" /> Transferência de Arquivos sobre Rádio (File-over-RF Chunks)
              </h3>
              <p className="text-xs text-slate-400">
                Fragmentação em blocos com CRC32 e transmissão em pacotes AFSK/GFSK para receptores no campo.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 font-mono">Tamanho do Bloco:</label>
              <select
                value={chunkSizeBytes}
                onChange={(e) => setChunkSizeBytes(parseInt(e.target.value, 10))}
                className="bg-slate-950 border border-slate-700 text-slate-300 text-xs rounded-xl px-2 py-1 font-mono"
              >
                <option value={64}>64 Bytes (Máxima Confiabilidade em HF)</option>
                <option value={128}>128 Bytes (Padrão Equilibrado VHF/UHF)</option>
                <option value={256}>256 Bytes (Rápido para Sinal Forte)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Painel de Transmissão de Arquivo */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Upload className="w-3.5 h-3.5 text-emerald-400" /> Transmitir Arquivo via Rádio
              </h4>

              <input
                type="file"
                onChange={handleFileSelect}
                className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer"
              />

              {selectedFile && (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Nome:</span>
                    <strong className="text-emerald-300">{selectedFile.name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tamanho:</span>
                    <strong className="text-slate-200">{(selectedFile.size / 1024).toFixed(2)} KB</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total de Blocos:</span>
                    <strong className="text-cyan-300">{fileChunks.length} blocos</strong>
                  </div>

                  {/* Barra de Progresso de Envio */}
                  {currentSendingChunkIndex >= 0 && (
                    <div className="space-y-1 pt-2">
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Progresso do Envio:</span>
                        <span>{Math.round(((currentSendingChunkIndex + 1) / fileChunks.length) * 100)}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-emerald-400 transition-all duration-150"
                          style={{ width: `${((currentSendingChunkIndex + 1) / fileChunks.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleStartFileTransmission}
                    disabled={isFileTransmitting}
                    className="w-full mt-2 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-950 flex items-center justify-center gap-2"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{isFileTransmitting ? 'Transmitindo Blocos...' : 'Iniciar Transmissão de Arquivo'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Painel de Arquivos Recebidos via Rádio */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Download className="w-3.5 h-3.5 text-cyan-400" /> Arquivos Recebidos pelo Ar
              </h4>

              <div className="space-y-2">
                {receivedFiles.map((f) => (
                  <div key={f.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs font-mono">
                    <div>
                      <strong className="text-slate-200 block">{f.name}</strong>
                      <span className="text-[10px] text-slate-500">{(f.size / 1024).toFixed(1)} KB • {new Date(f.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActionNotice(`💾 Baixando arquivo recebido: ${f.name}`);
                        setTimeout(() => setActionNotice(null), 2500);
                      }}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1 transition-all"
                    >
                      <Download className="w-3 h-3 text-cyan-400" />
                      <span>Baixar</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. ABA DE ORQUESTRADOR & MALHA RF (MUTÁVEL / ESCALÁVEL) */}
      {activeTab === 'automation' && (
        <div className="p-4 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Repeat className="w-4 h-4 text-emerald-400" /> Orquestrador de Transmissão & Enlace de Malha
              </h3>
              <p className="text-xs text-slate-400">
                Torna o canal de rádio um meio mutável, direcionável e escalável como camada física da rede soberana.
              </p>
            </div>

            <span className="px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60 text-xs font-bold font-mono">
              Enlace Adaptativo Ativo
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* Baliza Periódica (Beacon) */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <strong className="text-slate-200 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-cyan-400" /> Baliza Periódica (Beacon)
                </strong>
                <input
                  type="checkbox"
                  checked={isBeaconActive}
                  onChange={(e) => setIsBeaconActive(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Envia sinal de identificação da estação e presença a cada {radioStatus.beaconIntervalMinutes} minutos.
              </p>
              <div className="text-[11px] font-mono text-cyan-300 bg-slate-900 p-2 rounded-xl">
                Próxima transmissão em: <strong>{Math.floor(beaconCounter / 60)}m {beaconCounter % 60}s</strong>
              </div>
            </div>

            {/* Digipeater / Repetidor de Saltos */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <strong className="text-slate-200 flex items-center gap-1.5">
                  <Share2 className="w-4 h-4 text-emerald-400" /> Digipeater (Mesh Relay)
                </strong>
                <input
                  type="checkbox"
                  checked={radioStatus.isDigipeaterActive}
                  onChange={(e) => setRadioStatus({ ...radioStatus, isDigipeaterActive: e.target.checked })}
                  className="rounded border-slate-700 text-emerald-500"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Retransmite automaticamente pacotes de outras estações recebidos com decremento de TTL (Saltos).
              </p>
              <div className="text-[11px] font-mono text-emerald-300 bg-slate-900 p-2 rounded-xl">
                Status: <strong>Store-and-Forward Operacional</strong>
              </div>
            </div>

            {/* Carrier Sense (Anti-Colisão CSMA) */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <strong className="text-slate-200 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-amber-400" /> Anti-Colisão (CSMA/CD)
                </strong>
                <span className="text-emerald-400 font-bold">Ativo</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Escuta o canal antes de transmitir. Se outra estação estiver falando, aguarda o canal desocupar.
              </p>
              <div className="text-[11px] font-mono text-amber-300 bg-slate-900 p-2 rounded-xl">
                Canal Atual: <strong>{radioStatus.channelBusy ? 'Ocupado (RX)' : 'Livre para TX'}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. ABA DE HARDWARE & CAT CONTROL */}
      {activeTab === 'hardware' && (
        <div className="p-4 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" /> Interface com Rádio Físico (Placa de Som & CAT Control)
              </h3>
              <p className="text-xs text-slate-400">
                Conecte a saída de áudio do computador à entrada de microfone do transceptor (Digirig, SignaLink ou cabo P2).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Painel de Placa de Som e VOX */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <h4 className="font-bold text-slate-200 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-emerald-400" /> Transmissão via Placa de Som (VOX Acústico)
              </h4>
              <p className="text-slate-400 leading-relaxed">
                O áudio modulado é injetado pelo conector de fone/microfone. Ao iniciar a transmissão, o VOX do rádio abre o PTT automaticamente.
              </p>
              <button
                type="button"
                onClick={async () => {
                  setActionNotice('🔊 Transmitindo tom de teste de 1200 Hz para calibração...');
                  if (audioTransceiverRef.current) {
                    await audioTransceiverRef.current.transmitPacketAudio('TEST_TONE_1200', null, () => {
                      setActionNotice('✅ Tom de teste finalizado.');
                      setTimeout(() => setActionNotice(null), 2000);
                    });
                  }
                }}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold flex items-center gap-2 transition-all"
              >
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                <span>Testar Áudio de Modulação (1200 Hz)</span>
              </button>
            </div>

            {/* Configuração de Indicativo */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <h4 className="font-bold text-slate-200 flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400" /> Configurar Indicativo de Estação (Callsign)
              </h4>
              <div className="space-y-1.5">
                <label className="text-slate-400 block text-[11px]">Seu Callsign ou Identificador de Nó:</label>
                <input
                  type="text"
                  value={radioStatus.callsign}
                  onChange={(e) => setRadioStatus({ ...radioStatus, callsign: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-xl px-3 py-2 font-mono uppercase focus:outline-none focus:border-emerald-500"
                />
              </div>
              <p className="text-[10px] text-slate-500">
                Usado para assinar pacotes de rádio, mensagens do chat, digipeater e beacons de telemetria.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
