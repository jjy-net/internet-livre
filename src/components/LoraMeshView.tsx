import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  Cpu,
  Wifi,
  Terminal,
  Send,
  Zap,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Compass,
  Layers,
  Shield,
  Copy,
  Check,
  Usb,
  Activity,
  Battery,
  Signal,
  ArrowRight,
  ExternalLink,
  BookOpen,
  MapPin,
  HelpCircle,
  Play,
  Share2,
} from 'lucide-react';
import {
  LORA_REGIONS,
  LoraRegion,
  LORA_MODEM_PRESETS,
  LoraModemPreset,
  LORA_HARDWARE_PROFILES,
  LoraHardwareProfile,
  LoraHardwareMode,
  calculateLoraTimeOnAir,
  MeshtasticNode,
  LoraMeshMessage,
  INITIAL_MESH_NODES,
  SerialPortController,
  connectWebSerialPort,
  sendWebSerialCommand,
  ARDUINO_LORA_FIRMWARE_SKETCH,
} from '../utils/loraMeshEngine';

export const LoraMeshView: React.FC = () => {
  type LoraTab = 'chat' | 'hardware' | 'nodes' | 'rf_config' | 'firmware' | 'bridge';
  const [activeTab, setActiveTab] = useState<LoraTab>('chat');

  // Região e Preset de Modem
  const [selectedRegionId, setSelectedRegionId] = useState<string>('BR_915');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('LONG_FAST');
  const [txPowerDbm, setTxPowerDbm] = useState<number>(20); // 20 dBm (100 mW)
  const [customFreqMhz, setCustomFreqMhz] = useState<number>(915.0);

  // Hardware e Conexão WebSerial
  const [selectedHardwareMode, setSelectedHardwareMode] = useState<LoraHardwareMode>('meshtastic_usb');
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [serialController, setSerialController] = useState<SerialPortController | null>(null);
  const [serialLogs, setSerialLogs] = useState<string[]>([
    '[INIT] Subsistema LoRa / Meshtastic iniciado.',
    '[INFO] Pronto para conexao USB Serial ou simulacao mesh.',
  ]);
  const [manualSerialCmd, setManualSerialCmd] = useState<string>('');
  const [isCopiedFirmware, setIsCopiedFirmware] = useState<boolean>(false);

  // Nós Mesh e Mensagens
  const [nodes, setNodes] = useState<MeshtasticNode[]>(INITIAL_MESH_NODES);
  const [messages, setMessages] = useState<LoraMeshMessage[]>([
    {
      id: 'msg_01',
      fromNodeId: '!7c92b4e1',
      fromName: 'Repetidor Pico da Serra',
      toNodeId: '^all',
      channelName: '#geral-915',
      text: 'Baliza Mesh Ativa: Enlace repetidor 1140m altitude operacional em 915.0 MHz.',
      timestamp: '14:28:10',
      rssi: -86,
      snr: 7.2,
      hopsCount: 1,
      isAckReceived: true,
    },
    {
      id: 'msg_02',
      fromNodeId: '!a14d59f3',
      fromName: 'Mochila Tática WisBlock',
      toNodeId: '^all',
      channelName: '#geral-915',
      text: 'Telemetria GPS: Lat -23.582, Lon -46.685. Bateria 74% (3.89V).',
      timestamp: '14:30:45',
      rssi: -94,
      snr: 3.5,
      hopsCount: 2,
      isAckReceived: true,
    },
  ]);

  const [inputMessage, setInputMessage] = useState<string>('');
  const [activeChannel, setActiveChannel] = useState<string>('#geral-915');
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);

  // Integração com Bridge Jjy
  const [isJjyBridgeActive, setIsJjyBridgeActive] = useState<boolean>(true);

  const logsEndRef = useRef<HTMLDivElement | null>(null);

  // Obter região e preset atuais
  const currentRegion = LORA_REGIONS.find((r) => r.id === selectedRegionId) || LORA_REGIONS[0];
  const currentPreset = LORA_MODEM_PRESETS.find((p) => p.id === selectedPresetId) || LORA_MODEM_PRESETS[0];
  const currentHardware = LORA_HARDWARE_PROFILES.find((h) => h.id === selectedHardwareMode) || LORA_HARDWARE_PROFILES[0];

  // Cálculo de Time-on-Air para a mensagem atual
  const payloadLen = inputMessage.trim().length || 24;
  const toaCalc = calculateLoraTimeOnAir(
    payloadLen,
    currentPreset.spreadingFactor,
    currentPreset.bandwidthKhz
  );

  // Rolar logs seriais automaticamente
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [serialLogs]);

  // Conectar à porta Serial USB via WebSerial
  const handleConnectSerial = async () => {
    if (serialController && serialController.isConnected) {
      try {
        await serialController.reader?.cancel();
        await serialController.writer?.close();
        await serialController.port?.close();
      } catch (e) {
        console.warn('Erro ao fechar porta:', e);
      }
      setSerialController(null);
      setSerialLogs((prev) => [...prev, '[DISCONNECTED] Porta USB desconectada pelo usuario.']);
      return;
    }

    setSerialLogs((prev) => [...prev, `[SERIAL] Solicitando porta USB @ ${baudRate} bps...`]);

    const controller = await connectWebSerialPort(
      baudRate,
      (receivedChunk) => {
        // Tratar dados recebidos do hardware USB
        setSerialLogs((prev) => [...prev.slice(-150), `[RX RAW] ${receivedChunk.trim()}`]);

        // Se contiver mensagem formatada ou texto
        if (receivedChunk.includes('[RX_MSG]') || receivedChunk.includes('DATA=')) {
          const newMsg: LoraMeshMessage = {
            id: `msg_usb_${Date.now()}`,
            fromNodeId: '!usb_remote',
            fromName: 'Nó Remoto RF (Via USB)',
            toNodeId: '^all',
            channelName: activeChannel,
            text: receivedChunk.replace(/\[RX_MSG\].*DATA=/, '').trim() || receivedChunk.trim(),
            timestamp: new Date().toLocaleTimeString(),
            rssi: -78,
            snr: 8.0,
            hopsCount: 0,
            isAckReceived: true,
          };
          setMessages((prev) => [newMsg, ...prev]);
        }
      },
      (errorMsg) => {
        setSerialLogs((prev) => [...prev, `[ERROR] ${errorMsg}`]);
      }
    );

    if (controller) {
      setSerialController(controller);
      setSerialLogs((prev) => [
        ...prev,
        `[SUCCESS] Conectado com sucesso ao dispositivo LoRa USB (${currentHardware.name})!`,
        `[CONFIG] Frequencia: ${customFreqMhz} MHz | Preset: ${currentPreset.name}`,
      ]);
    }
  };

  // Enviar comando manual para a porta serial
  const handleSendSerialCommand = async () => {
    if (!manualSerialCmd.trim() || !serialController) return;
    const cmd = manualSerialCmd.trim() + '\n';
    await sendWebSerialCommand(serialController, cmd);
    setSerialLogs((prev) => [...prev, `[TX MANUAL] ${manualSerialCmd.trim()}`]);
    setManualSerialCmd('');
  };

  // Enviar mensagem LoRa Mesh
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isTransmitting) return;
    setIsTransmitting(true);

    const textToSend = inputMessage.trim();
    const newMsg: LoraMeshMessage = {
      id: `msg_${Date.now()}`,
      fromNodeId: '!38f1a04b',
      fromName: 'ME-01 (Este Dispositivo)',
      toNodeId: '^all',
      channelName: activeChannel,
      text: textToSend,
      timestamp: new Date().toLocaleTimeString(),
      rssi: -52,
      snr: 12.0,
      hopsCount: 0,
      isAckReceived: true,
    };

    setMessages((prev) => [newMsg, ...prev]);

    // Se a porta USB estiver conectada, despachar via hardware real
    if (serialController && serialController.isConnected) {
      let formattedCmd = textToSend;
      if (selectedHardwareMode === 'reyax_at_commands') {
        formattedCmd = `AT+SEND=0,${textToSend.length},${textToSend}\r\n`;
      } else {
        formattedCmd = `${textToSend}\n`;
      }
      await sendWebSerialCommand(serialController, formattedCmd);
      setSerialLogs((prev) => [
        ...prev,
        `[TX RF] Transmitindo via hardware USB (${toaCalc.toaMs}ms ToA): ${textToSend}`,
      ]);
    } else {
      // Simulação de transmissão
      setSerialLogs((prev) => [
        ...prev,
        `[SIMULACAO TX] Pacote transmitido em ${customFreqMhz} MHz (ToA: ${toaCalc.toaMs}ms)`,
      ]);
    }

    setInputMessage('');
    setTimeout(() => {
      setIsTransmitting(false);
    }, Math.max(500, toaCalc.toaMs));
  };

  // Copiar código de Firmware
  const handleCopyFirmware = () => {
    navigator.clipboard.writeText(ARDUINO_LORA_FIRMWARE_SKETCH);
    setIsCopiedFirmware(true);
    setTimeout(() => setIsCopiedFirmware(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Cyber-LoRa */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-emerald-950/40 to-slate-900 border border-emerald-800/40 p-6 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono uppercase tracking-wider flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-400" /> Rádio LoRa & Meshtastic Mesh
              </span>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono">
                {currentRegion.name.split(' ')[0]} {customFreqMhz} MHz
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-mono">
                USB WebSerial Pronta
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Rede LoRa Descentralizada & Rádio USB</span>
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Integração com <strong>Meshtastic</strong> (LilyGO T-Beam, Heltec LoRa32, RAK WisBlock) e suporte a{' '}
              <strong>chips UART/USB básicos</strong> (EBYTE E22/E32, Reyax, Arduino/ESP32 DIY) para criar uma interface de comunicação sem internet por quilômetros de distância.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href="#meshmonitor"
              className="px-4 py-2.5 rounded-2xl font-bold text-xs bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white shadow-lg flex items-center gap-2 transition-all cursor-pointer"
              title="Abrir MeshMonitor: Central de Telemetria e Monitoramento Meshtastic"
            >
              <Activity className="w-4 h-4 text-cyan-200" />
              <span>Abrir MeshMonitor</span>
            </a>

            <button
              type="button"
              onClick={handleConnectSerial}
              className={`px-4 py-2.5 rounded-2xl font-bold text-xs transition-all flex items-center gap-2 shadow-lg ${
                serialController?.isConnected
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950'
              }`}
            >
              <Usb className="w-4 h-4" />
              <span>{serialController?.isConnected ? 'Desconectar USB' : 'Conectar USB (WebSerial)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navegação entre Abas */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-800/80 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'chat'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Send className="w-4 h-4 text-emerald-300" />
          <span>Chat & Terminal Mesh</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('hardware')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'hardware'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Usb className="w-4 h-4 text-cyan-300" />
          <span>Hardware USB & Serial Log</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('nodes')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'nodes'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <MapPin className="w-4 h-4 text-yellow-300" />
          <span>Nós Descobertos ({nodes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rf_config')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'rf_config'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Sliders className="w-4 h-4 text-purple-300" />
          <span>Frequências & Modens</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('firmware')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'firmware'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Cpu className="w-4 h-4 text-sky-300" />
          <span>Firmware DIY (Arduino/ESP32)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('bridge')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'bridge'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Share2 className="w-4 h-4 text-amber-300" />
          <span>Ponte Jjy Mesh (Transporte)</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* ABA 1: CHAT & TERMINAL TÁTICO LORA MESH                  */}
      {/* ======================================================== */}
      {activeTab === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-4">
            <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 flex flex-col h-[520px]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-bold text-sm text-slate-100">Terminal Mesh RF ({customFreqMhz} MHz)</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {currentPreset.name.split(' ')[0]}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Canal:</span>
                  <select
                    value={activeChannel}
                    onChange={(e) => setActiveChannel(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-emerald-300 px-2.5 py-1 rounded-xl text-xs font-mono"
                  >
                    <option value="#geral-915">#geral-915 (Público)</option>
                    <option value="#tatico-alpha">#tatico-alpha (Privado)</option>
                    <option value="#emergencia-sos">#emergencia-sos (Prioridade)</option>
                  </select>
                </div>
              </div>

              {/* Lista de Mensagens */}
              <div className="flex-1 overflow-y-auto space-y-3 py-4 pr-1">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-3.5 rounded-2xl border border-slate-800 bg-slate-950/80 text-xs space-y-1.5 transition-all hover:border-slate-700"
                  >
                    <div className="flex justify-between items-center text-[11px] font-mono">
                      <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                        <Signal className="w-3.5 h-3.5 text-emerald-500" /> {msg.fromName}{' '}
                        <span className="text-slate-500 text-[10px]">({msg.fromNodeId})</span>
                      </span>
                      <span className="text-slate-500">{msg.timestamp}</span>
                    </div>

                    <p className="text-slate-100 font-sans text-xs leading-relaxed">{msg.text}</p>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-900">
                      <div className="flex items-center gap-3">
                        <span className="text-sky-300">Canal: {msg.channelName}</span>
                        <span>Saltos: {msg.hopsCount === 0 ? 'Direto' : `${msg.hopsCount} hops`}</span>
                        {msg.rssi !== undefined && <span className="text-amber-400">RSSI: {msg.rssi} dBm</span>}
                        {msg.snr !== undefined && <span className="text-emerald-400">SNR: {msg.snr} dB</span>}
                      </div>
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> ACK Confirmado
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Indicador de Time-on-Air e Caixa de Envio */}
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                  <span>
                    Tamanho do Pacote: <strong className="text-slate-200">{payloadLen} bytes</strong>
                  </span>
                  <span>
                    Tempo no Ar Estimado (ToA): <strong className="text-emerald-400">{toaCalc.toaMs} ms</strong>
                  </span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Digite mensagem para transmitir via rádio LoRa..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isTransmitting}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-emerald-950 flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isTransmitting ? 'Transmitindo RF...' : 'Transmitir'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Coluna Direita: Presets Rápidos e Status */}
          <div className="lg:col-span-4 space-y-4">
            <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-3">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" /> Presets Táticos Rápidos
              </h3>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setInputMessage('MAYDAY SOS: Coordenadas Lat -23.5505 Lon -46.6333. Resgate urgente requerido.')}
                  className="w-full text-left p-2.5 bg-slate-950 hover:bg-slate-800 border border-rose-900/50 rounded-xl text-xs text-rose-300 font-mono transition-all"
                >
                  🚨 [SOS] Alerta de Resgate Emergencial
                </button>

                <button
                  type="button"
                  onClick={() => setInputMessage('CHECK PING: Verificando repetidores da rota mesh. Favor confirmar com ACK.')}
                  className="w-full text-left p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs text-sky-300 font-mono transition-all"
                >
                  📡 [PING] Teste de Rota e Repetidores
                </button>

                <button
                  type="button"
                  onClick={() => setInputMessage('SITREP NÓ ME-01: Bateria 96%, Tensão 4.18V. Estação base operando normal.')}
                  className="w-full text-left p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs text-emerald-300 font-mono transition-all"
                >
                  🔋 [TELEMETRIA] SitRep de Bateria
                </button>

                <button
                  type="button"
                  onClick={() => setInputMessage('QSO ABERTO: Estação portátil em escuta na frequência 915.0 MHz.')}
                  className="w-full text-left p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs text-amber-300 font-mono transition-all"
                >
                  📻 [QSO] Chamada Geral de Escuta
                </button>
              </div>
            </div>

            {/* Status da Interface Serial */}
            <div className="p-4 bg-slate-900/70 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <span className="font-bold text-slate-300 block">Status do Hardware USB:</span>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    serialController?.isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                  }`}
                />
                <span className="font-mono text-slate-300">
                  {serialController?.isConnected ? 'Dispositivo USB Conectado' : 'Modo Simulação Mesh Ativo'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {serialController?.isConnected
                  ? `Comunicação direta a ${baudRate} bps. Dados recebidos do ar são injetados automaticamente.`
                  : 'Conecte sua placa LoRa via USB (WebSerial) para enviar e receber do rádio de verdade.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 2: HARDWARE USB & TERMINAL SERIAL EM TEMPO REAL     */}
      {/* ======================================================== */}
      {activeTab === 'hardware' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-5">
            <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Usb className="w-4 h-4 text-cyan-400" /> Configuração da Interface USB Serial
              </h3>

              {/* Seletor de Modo de Hardware */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-400">Modelo do Chip / Placa Conectada:</label>
                <div className="grid grid-cols-1 gap-2">
                  {LORA_HARDWARE_PROFILES.map((hw) => (
                    <button
                      key={hw.id}
                      type="button"
                      onClick={() => {
                        setSelectedHardwareMode(hw.id);
                        setBaudRate(hw.defaultBaudRate);
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        selectedHardwareMode === hw.id
                          ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-md shadow-emerald-950'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs font-bold mb-1">
                        <span className="text-emerald-300">{hw.name}</span>
                        <span className="text-[10px] font-mono text-slate-400">{hw.defaultBaudRate} bps</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">{hw.description}</p>
                      <div className="mt-1.5 text-[10px] font-mono text-slate-500 truncate">
                        Exemplos: {hw.typicalBoards.join(', ')}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Seletor de Baud Rate */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-mono text-slate-400">Velocidade da Porta Serial (Baud Rate):</label>
                <select
                  value={baudRate}
                  onChange={(e) => setBaudRate(parseInt(e.target.value))}
                  disabled={serialController?.isConnected}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 text-xs font-mono"
                >
                  <option value={9600}>9600 bps (Padrão EBYTE E32)</option>
                  <option value={57600}>57600 bps (Módulos RAK AT)</option>
                  <option value={115200}>115200 bps (Meshtastic / ESP32 DIY)</option>
                  <option value={921600}>921600 bps (Alta velocidade ESP32)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleConnectSerial}
                className={`w-full py-3 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg ${
                  serialController?.isConnected
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950'
                }`}
              >
                <Usb className="w-4 h-4" />
                <span>{serialController?.isConnected ? 'Desconectar Porta USB' : 'Conectar via WebSerial'}</span>
              </button>
            </div>
          </div>

          {/* Console Serial TX/RX */}
          <div className="lg:col-span-7 space-y-4">
            <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 flex flex-col h-[520px]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-bold text-sm text-slate-100">Console Serial TX/RX (Ao Vivo)</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSerialLogs([])}
                  className="text-[10px] font-mono text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
                >
                  Limpar Log
                </button>
              </div>

              {/* Janela de Logs */}
              <div className="flex-1 overflow-y-auto space-y-1 font-mono text-xs py-3 pr-1 text-slate-300">
                {serialLogs.map((log, i) => (
                  <div
                    key={i}
                    className={`leading-relaxed ${
                      log.includes('[ERROR]')
                        ? 'text-rose-400'
                        : log.includes('[SUCCESS]')
                        ? 'text-emerald-400 font-bold'
                        : log.includes('[TX')
                        ? 'text-sky-300'
                        : log.includes('[RX')
                        ? 'text-amber-300'
                        : 'text-slate-400'
                    }`}
                  >
                    {log}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>

              {/* Envio de Comandos Manuais */}
              <div className="pt-3 border-t border-slate-800 flex gap-2">
                <input
                  type="text"
                  value={manualSerialCmd}
                  onChange={(e) => setManualSerialCmd(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendSerialCommand()}
                  placeholder={
                    selectedHardwareMode === 'reyax_at_commands'
                      ? 'Ex: AT+SEND=0,5,HELLO ou AT+ADDRESS?'
                      : 'Digite comando ou payload para enviar via serial...'
                  }
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleSendSerialCommand}
                  disabled={!serialController?.isConnected}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 3: NÓS DESCOBERTOS & RADAR MESH                      */}
      {/* ======================================================== */}
      {activeTab === 'nodes' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {nodes.map((node) => (
              <div
                key={node.nodeId}
                className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-3 hover:border-slate-700 transition-all shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {node.role}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">{node.lastHeardSecAgo}s atrás</span>
                </div>

                <div>
                  <h4 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                    <span>{node.longName}</span>
                  </h4>
                  <span className="text-xs font-mono text-emerald-400">
                    {node.shortName} • {node.nodeId}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px]">Sinal RSSI:</span>
                    <strong className="text-amber-400">{node.rssi} dBm</strong>
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px]">SNR (Ruído):</span>
                    <strong className="text-emerald-400">+{node.snr} dB</strong>
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px]">Bateria:</span>
                    <strong className="text-sky-300">
                      {node.batteryPercent}% ({node.voltage}V)
                    </strong>
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px]">Saltos / Rota:</span>
                    <strong className="text-purple-300">
                      {node.hopsAway === 0 ? 'Direto (0)' : `${node.hopsAway} Hops`}
                    </strong>
                  </div>
                </div>

                {node.latitude && node.longitude && (
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>
                      GPS: {node.latitude.toFixed(4)}, {node.longitude.toFixed(4)}
                    </span>
                    <span>Alt: {node.altitudeMeters}m</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 4: CONFIGURAÇÃO DE RÁDIO & FREQUÊNCIAS              */}
      {/* ======================================================== */}
      {activeTab === 'rf_config' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-5">
            <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" /> Parâmetros de Rádio Frequência
              </h3>

              {/* Seletor de Região */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-400">Região Regulamentar (Plano de Frequência):</label>
                <div className="space-y-2">
                  {LORA_REGIONS.map((reg) => (
                    <button
                      key={reg.id}
                      type="button"
                      onClick={() => {
                        setSelectedRegionId(reg.id);
                        setCustomFreqMhz(reg.defaultFreqMhz);
                      }}
                      className={`w-full p-3 rounded-2xl border text-left transition-all ${
                        selectedRegionId === reg.id
                          ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-md shadow-emerald-950'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs font-bold mb-0.5">
                        <span className="text-emerald-300">{reg.name}</span>
                        <span className="font-mono text-[10px] text-slate-400">{reg.freqRangeMhz}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">{reg.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Frequência Customizada */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Frequência Central de Operação:</span>
                  <strong className="text-emerald-300">{customFreqMhz.toFixed(3)} MHz</strong>
                </div>
                <input
                  type="number"
                  step="0.125"
                  value={customFreqMhz}
                  onChange={(e) => setCustomFreqMhz(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-mono text-white"
                />
              </div>

              {/* Potência TX */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Potência de Transmissão (TX Power):</span>
                  <strong className="text-amber-300">
                    {txPowerDbm} dBm (~{Math.round(Math.pow(10, txPowerDbm / 10))} mW)
                  </strong>
                </div>
                <input
                  type="range"
                  min="2"
                  max="30"
                  step="1"
                  value={txPowerDbm}
                  onChange={(e) => setTxPowerDbm(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-5">
            <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" /> Presets de Modem & Throughput
              </h3>

              <div className="space-y-2">
                {LORA_MODEM_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedPresetId(preset.id)}
                    className={`w-full p-3 rounded-2xl border text-left transition-all ${
                      selectedPresetId === preset.id
                        ? 'bg-cyan-950/40 border-cyan-500 text-white shadow-md shadow-cyan-950'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-center text-xs font-bold mb-1">
                      <span className="text-cyan-300">{preset.name}</span>
                      <span className="font-mono text-[10px] text-emerald-400">~{preset.nominalBitrateBps} bps</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">{preset.description}</p>
                    <div className="flex gap-4 mt-1.5 text-[10px] font-mono text-slate-500">
                      <span>BW: {preset.bandwidthKhz} kHz</span>
                      <span>SF: {preset.spreadingFactor}</span>
                      <span>CR: {preset.codingRate}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Informação Técnica de Sensibilidade */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 text-xs">
                <span className="font-bold text-slate-300 block">Link Budget & Sensibilidade Máxima:</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Com SF11 e BW 250kHz (LongFast), o receptor Semtech SX1262 atinge sensibilidade de{' '}
                  <strong className="text-emerald-300">-137 dBm</strong>. Com potência TX de 20 dBm, o Link Budget total é de{' '}
                  <strong className="text-cyan-300">157 dB</strong>, permitindo alcance de 5 a 25 km em áreas suburbanas e mais de 100 km em linha de visada direta entre montanhas!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 5: FIRMWARE C++ DIY PARA ARDUINO / ESP32             */}
      {/* ======================================================== */}
      {activeTab === 'firmware' && (
        <div className="space-y-5">
          <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400" /> Firmware C++ para Arduino / ESP32 com LoRa DIY
                </h3>
                <p className="text-xs text-slate-300">
                  Transforme qualquer placa barata (Arduino Nano + Ra-02 ou ESP32 + SX1262) em um modem USB do Jjy.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopyFirmware}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 self-start md:self-auto"
              >
                {isCopiedFirmware ? <Check className="w-4 h-4 text-yellow-300" /> : <Copy className="w-4 h-4" />}
                <span>{isCopiedFirmware ? 'Código Copiado!' : 'Copiar Código C++'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                <strong className="text-emerald-400 block font-mono">Pinout Arduino Nano / Uno (SPI):</strong>
                <span className="text-[11px] text-slate-400 font-mono block">
                  NSS: D10 | RST: D9 | DIO0: D2 | MOSI: D11 | MISO: D12 | SCK: D13
                </span>
              </div>
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                <strong className="text-cyan-400 block font-mono">Pinout ESP32 DevKit (SPI):</strong>
                <span className="text-[11px] text-slate-400 font-mono block">
                  NSS: GPIO 5 | RST: GPIO 14 | DIO0: GPIO 2 | MOSI: 23 | MISO: 19 | SCK: 18
                </span>
              </div>
            </div>

            {/* Visualizador de Código */}
            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
              <pre className="p-4 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-[420px] leading-relaxed">
                {ARDUINO_LORA_FIRMWARE_SKETCH}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 6: PONTE JJY MESH (TRANSPORTE MULTI-MEIOS)           */}
      {/* ======================================================== */}
      {activeTab === 'bridge' && (
        <div className="space-y-5">
          <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-amber-400" /> Ponte de Roteamento LoRa ➔ Rede Jjy Mesh
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                Cross-Transport Active
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
              Quando a Ponte está ativa, o hardware LoRa conectado à USB atua como a <strong>camada física sem fio</strong> para todo o ecossistema Jjy. Mensagens do Chat LAN, alertas de emergência e arquivos fragmentados são divididos e transmitidos pelo rádio, permitindo conversar com outros computadores mesmo sem sinal de celular, internet ou roteador Wi-Fi!
            </p>

            <label className="flex items-center justify-between p-4 bg-slate-950 rounded-2xl border border-slate-800 cursor-pointer max-w-xl">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-200 block">Habilitar LoRa como Interface de Rede Jjy</span>
                <span className="text-[10px] text-slate-400">
                  Roteia automaticamente pacotes P2P pelo rádio USB conectado.
                </span>
              </div>
              <input
                type="checkbox"
                checked={isJjyBridgeActive}
                onChange={(e) => setIsJjyBridgeActive(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded"
              />
            </label>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 text-xs font-mono">
              <span className="text-slate-400 block font-bold">Topologia Multi-Meios em Operação:</span>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                <span className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-emerald-400">
                  1. Usuário Jjy (PC / Celular)
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                <span className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-cyan-400">
                  2. Porta USB Serial (115200 bps)
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                <span className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-amber-400">
                  3. Transmissão LoRa RF (915.0 MHz)
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                <span className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-emerald-400">
                  4. Outros Nós Jjy no Campo
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
