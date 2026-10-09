// ============================================================================
// ENGINE OMNI-PROTOCOL: MATRIZ MODULAR, HUB DE PLUGINS & ROTEADOR CROSS-PROTOCOL
// JYY Communication Suite v2.0 - Argon-4 Class Hyper-Modular Protocol Engine
// ============================================================================

export type ProtocolCategory =
  | 'rf'
  | 'acoustic'
  | 'optical'
  | 'cellular'
  | 'satellite'
  | 'digital'
  | 'tactical'
  | 'wired';

export type ProtocolLayer =
  | 'physical'
  | 'datalink'
  | 'network'
  | 'transport'
  | 'application';

export type ProtocolStatus = 'active' | 'standby' | 'disabled' | 'error';

export type RoutingStrategy =
  | 'omni_broadcast'     // Transmite em todos os canais ativos simultaneamente
  | 'multipath_bonding'   // Divide o payload em fragmentos distribuídos por throughput
  | 'cascading_fallback'  // Tenta por prioridade; se falhar, tenta o próximo
  | 'best_metric'        // Roteia exclusivamente pelo link com menor latência / maior SNR
  | 'stealth_silent';    // Apenas escuta passiva, bloqueia qualquer TX de rádio

export interface ProtocolSpec {
  carrier: string;          // Ex: "433/868/915 MHz", "28 kHz Ultrassom", "450nm Laser"
  medium: string;           // Ex: "Ar (RF Sub-GHz)", "Água Salgada/Doce", "Espaço Livre"
  rangeMax: string;         // Ex: "15 km (LOS)", "2 km Subaquático", "Orbital LEO"
  throughput: string;       // Ex: "19.2 kbps", "1.2 Gbps", "100 Mbps"
  nominalLatencyMs: number; // Ex: 45, 1200, 3
  mtuBytes: number;         // Ex: 256, 1500, 64
  modulation: string;       // Ex: "LoRa CSS", "OFDM / QAM", "FSK / Chirp", "OOK Laser"
  cipher: string;           // Ex: "ChaCha20-Poly1305", "AES-256-GCM", "Kyber-1024 Post-Quantum"
  hardwareRequired: string; // Ex: "SX1262 / ESP32", "Transdutor Piezocerâmico", "Modem USB 5G"
}

export interface ProtocolMetrics {
  txPackets: number;
  rxPackets: number;
  txBytes: number;
  rxBytes: number;
  rssiDb?: number;
  snrDb?: number;
  latencyMs: number;
  packetLossPercent: number;
  linkHealth: number;       // 0 a 100%
  lastHeardIso: string;
}

export interface ProtocolConfig {
  channelFreq: string;
  txPowerDbm: number;
  fecRate: string;          // Ex: "4/5", "4/8", "Reed-Solomon"
  priorityWeight: number;   // 1 a 10
  autoReconnect: boolean;
  stealthMode: boolean;
}

export interface ProtocolDefinition {
  id: string;
  name: string;
  codeName: string;
  category: ProtocolCategory;
  layer: ProtocolLayer;
  status: ProtocolStatus;
  isPlugin: boolean;
  version: string;
  author: string;
  description: string;
  spec: ProtocolSpec;
  metrics: ProtocolMetrics;
  config: ProtocolConfig;
  pluginSource?: 'builtin' | 'community_registry' | 'custom_uploaded';
  downloadUrl?: string;
  installedAt?: string;
  customScriptCode?: string;
}

export interface ProtocolBundle {
  id: string;
  name: string;
  code: string;
  tagline: string;
  category: string;
  iconName: string;
  targetProtocolIds: string[];
  routingStrategy: RoutingStrategy;
  recommendedUse: string;
}

export interface TransmittedFrame {
  id: string;
  timestamp: number;
  sourceNode: string;
  destinationNode: string;
  protocolId: string;
  routingMode: RoutingStrategy;
  payloadText: string;
  payloadHex: string;
  payloadSizeBytes: number;
  crc32Hex: string;
  delivered: boolean;
  latencyMs: number;
  logTrace: string[];
}

// ----------------------------------------------------------------------------
// PROTOCOLOS PADRÃO DO SISTEMA JYY (BUILT-IN HYPER-SUITE)
// ----------------------------------------------------------------------------

export const INITIAL_BUILTIN_PROTOCOLS: ProtocolDefinition[] = [
  {
    id: 'lora_meshtastic',
    name: 'LoRa Meshtastic Mesh',
    codeName: 'LORA-MESH-V2',
    category: 'rf',
    layer: 'datalink',
    status: 'active',
    isPlugin: false,
    version: '2.5.8',
    author: 'Jyy Core & Meshtastic Open Foundation',
    description: 'Comunicação tática em RF Sub-GHz com saltos distribuídos ponto-a-ponto sem torres ou internet.',
    spec: {
      carrier: '433 / 868 / 915 MHz',
      medium: 'Propagação Terrestre Livre / Relevo',
      rangeMax: '15 ~ 40 km (LOS)',
      throughput: '5.4 ~ 19.2 kbps',
      nominalLatencyMs: 280,
      mtuBytes: 240,
      modulation: 'Chirp Spread Spectrum (CSS) SF7-SF12',
      cipher: 'ChaCha20-Poly1305 + AES-256',
      hardwareRequired: 'Semtech SX1262 / Heltec V3 / LilyGO T-Beam',
    },
    metrics: {
      txPackets: 1420,
      rxPackets: 2841,
      txBytes: 112400,
      rxBytes: 254800,
      rssiDb: -78,
      snrDb: 9.5,
      latencyMs: 310,
      packetLossPercent: 1.2,
      linkHealth: 98,
      lastHeardIso: new Date().toISOString(),
    },
    config: {
      channelFreq: '915.000 MHz (Slot 20)',
      txPowerDbm: 22,
      fecRate: '4/8 (Máxima Robustez)',
      priorityWeight: 9,
      autoReconnect: true,
      stealthMode: false,
    },
    pluginSource: 'builtin',
  },
  {
    id: 'wifi_radar_densepose',
    name: 'Wi-Fi 802.11 ax/be & Radar RuView CSI',
    codeName: 'WIFI-RUVIEW-CSI',
    category: 'rf',
    layer: 'physical',
    status: 'active',
    isPlugin: false,
    version: '4.0.7',
    author: 'RuView Protocol & Jyy RF Labs',
    description: 'Enlace Wi-Fi ad-hoc de alta capacidade integrado a sensoriamento de radar por CSI e feixes multistáticos.',
    spec: {
      carrier: '2.4 GHz / 5.8 GHz / 6 GHz',
      medium: 'Ar / Penetração de Paredes e Escombros',
      rangeMax: '150 m (Padrão) / 800 m (Antena Direcional)',
      throughput: '54 Mbps ~ 1.2 Gbps',
      nominalLatencyMs: 8,
      mtuBytes: 1500,
      modulation: 'OFDM / 1024-QAM / TDM 168 Subportadoras',
      cipher: 'WPA3-SAE + E2EE Curve25519',
      hardwareRequired: 'ESP32-S3 / Placa Intel AX210 / Roteador OpenWrt',
    },
    metrics: {
      txPackets: 18450,
      rxPackets: 32100,
      txBytes: 8940000,
      rxBytes: 15420000,
      rssiDb: -54,
      snrDb: 28.2,
      latencyMs: 9,
      packetLossPercent: 0.1,
      linkHealth: 99,
      lastHeardIso: new Date().toISOString(),
    },
    config: {
      channelFreq: 'Canais 1, 6, 11 (Salto TDM 50ms)',
      txPowerDbm: 20,
      fecRate: 'BCC 3/4',
      priorityWeight: 10,
      autoReconnect: true,
      stealthMode: false,
    },
    pluginSource: 'builtin',
  },
  {
    id: 'acoustic_subsea',
    name: 'Modem Acústico Subaquático (Subsea Sound)',
    codeName: 'AQUA-ACOUSTIC-FSK',
    category: 'acoustic',
    layer: 'physical',
    status: 'active',
    isPlugin: false,
    version: '1.9.4',
    author: 'Subsea Research Consortium & Jyy Marine',
    description: 'Comunicação sonora através de água doce e salgada via transdutores piezocerâmicos ultrassônicos.',
    spec: {
      carrier: '18 ~ 48 kHz (Ultrassom Subaquático)',
      medium: 'Água Doce, Estuário e Água Salgada Profunda',
      rangeMax: '2.5 km (Profundo) / 800 m (Raso)',
      throughput: '120 ~ 2400 bps',
      nominalLatencyMs: 1450,
      mtuBytes: 128,
      modulation: 'Biorthogonal M-FSK / Chirp Spread Doppler',
      cipher: 'ChaCha20-Poly1305 Tático',
      hardwareRequired: 'Transdutor Piezoelétrico Aquático + Amplificador Classe D',
    },
    metrics: {
      txPackets: 310,
      rxPackets: 280,
      txBytes: 12400,
      rxBytes: 11200,
      rssiDb: -62,
      snrDb: 14.1,
      latencyMs: 1680,
      packetLossPercent: 3.4,
      linkHealth: 92,
      lastHeardIso: new Date().toISOString(),
    },
    config: {
      channelFreq: '28.5 kHz Banda Central',
      txPowerDbm: 27,
      fecRate: 'Reed-Solomon RS(255, 223)',
      priorityWeight: 7,
      autoReconnect: true,
      stealthMode: false,
    },
    pluginSource: 'builtin',
  },
  {
    id: 'optical_lifi_laser',
    name: 'Comunicação Óptica & Laser Azul-Verde',
    codeName: 'OPTICAL-LIFI-FSO',
    category: 'optical',
    layer: 'physical',
    status: 'active',
    isPlugin: false,
    version: '2.1.0',
    author: 'Jyy Photonics Labs',
    description: 'Enlace óptico livre no ar (LiFi) e penetração por laser azul-verde (450–532 nm) em meios aquáticos.',
    spec: {
      carrier: '450 nm (Azul Marinho) / 532 nm (Verde)',
      medium: 'Linha de Visada Óptica (Ar e Água Límpida)',
      rangeMax: '500 m (Ar) / 120 m (Água)',
      throughput: '10 ~ 100 Mbps',
      nominalLatencyMs: 2,
      mtuBytes: 1400,
      modulation: 'On-Off Keying (OOK) / Pulse Position Modulation (PPM)',
      cipher: 'AES-256-GCM Hardware accelerated',
      hardwareRequired: 'Fotodíodo Avalanche (APD) + Diodo Laser Colimado',
    },
    metrics: {
      txPackets: 8900,
      rxPackets: 8750,
      txBytes: 2450000,
      rxBytes: 2390000,
      rssiDb: -42,
      snrDb: 35.8,
      latencyMs: 3,
      packetLossPercent: 0.2,
      linkHealth: 97,
      lastHeardIso: new Date().toISOString(),
    },
    config: {
      channelFreq: '520 nm Banda Laser Verde',
      txPowerDbm: 15,
      fecRate: 'LDPC 1/2',
      priorityWeight: 8,
      autoReconnect: true,
      stealthMode: false,
    },
    pluginSource: 'builtin',
  },
  {
    id: 'cellular_5g_glinet',
    name: 'Celular 4G/5G & GL.iNet Gateway',
    codeName: 'CELL-5G-QMI-WAN',
    category: 'cellular',
    layer: 'network',
    status: 'active',
    isPlugin: false,
    version: '3.2.1',
    author: 'GL.iNet OpenWrt & Jyy Cellular Integration',
    description: 'Interface de alta vazão para modems celulares USB industriais, roteadores GL.iNet e smartphones em tethering.',
    spec: {
      carrier: '700 MHz ~ 3.8 GHz (B1/B3/B7/B28/N78)',
      medium: 'Rede Celular Pública ou Privada LTE/5G-SA',
      rangeMax: '35 km (Torre Macro)',
      throughput: '50 ~ 600 Mbps',
      nominalLatencyMs: 28,
      mtuBytes: 1420,
      modulation: 'QPSK / 64-QAM / 256-QAM',
      cipher: 'IPsec + WireGuard ChaCha20',
      hardwareRequired: 'Roteador GL.iNet / Modem USB Quectel RM500Q / Celular OTG',
    },
    metrics: {
      txPackets: 12500,
      rxPackets: 28900,
      txBytes: 14500000,
      rxBytes: 42100000,
      rssiDb: -69,
      snrDb: 18.5,
      latencyMs: 32,
      packetLossPercent: 0.3,
      linkHealth: 96,
      lastHeardIso: new Date().toISOString(),
    },
    config: {
      channelFreq: 'Banda B28 (700 MHz Longo Alcance)',
      txPowerDbm: 23,
      fecRate: 'Turbo Code 3GPP',
      priorityWeight: 8,
      autoReconnect: true,
      stealthMode: false,
    },
    pluginSource: 'builtin',
  },
  {
    id: 'ble_mesh_direct',
    name: 'Bluetooth Low Energy 5.3 Mesh Direct',
    codeName: 'BLE-MESH-V5',
    category: 'digital',
    layer: 'datalink',
    status: 'active',
    isPlugin: false,
    version: '5.3.0',
    author: 'Bluetooth SIG & Jyy Protocol',
    description: 'Malha ponto-a-ponto de curto alcance sem necessidade de pareamento manual, com difusão contínua de beacons.',
    spec: {
      carrier: '2.402 ~ 2.480 GHz (40 Canais ISM)',
      medium: 'Ar / Proximidade',
      rangeMax: '80 m (Coded PHY) / 30 m (1M PHY)',
      throughput: '125 kbps ~ 2 Mbps',
      nominalLatencyMs: 15,
      mtuBytes: 512,
      modulation: 'Gaussian Frequency Shift Keying (GFSK)',
      cipher: 'AES-CCM 128-bit',
      hardwareRequired: 'Adaptador Bluetooth 5.0+ integrado ou Dongle USB',
    },
    metrics: {
      txPackets: 4120,
      rxPackets: 7200,
      txBytes: 480000,
      rxBytes: 890000,
      rssiDb: -60,
      snrDb: 22.0,
      latencyMs: 18,
      packetLossPercent: 0.5,
      linkHealth: 95,
      lastHeardIso: new Date().toISOString(),
    },
    config: {
      channelFreq: 'Canais de Advertising 37, 38, 39',
      txPowerDbm: 8,
      fecRate: 'Coded S=8',
      priorityWeight: 7,
      autoReconnect: true,
      stealthMode: false,
    },
    pluginSource: 'builtin',
  },
  {
    id: 'audio_ultrasonic_air',
    name: 'Modem de Som & Ultrassom Aéreo (GGWave)',
    codeName: 'AIR-AUDIO-ULTRASONIC',
    category: 'acoustic',
    layer: 'physical',
    status: 'active',
    isPlugin: false,
    version: '1.4.2',
    author: 'GGWave & Jyy Audio Labs',
    description: 'Transmissão acústica aérea inaudível por ultrassom (18-20 kHz) ou audível via microfone e alto-falante padrão.',
    spec: {
      carrier: '18.5 ~ 20.5 kHz (Inaudível) / 1.5 ~ 3 kHz (Audível)',
      medium: 'Ar Ambiente / Ambientes Fechados',
      rangeMax: '15 m (Ultrassom) / 45 m (Audível)',
      throughput: '64 ~ 1200 bps',
      nominalLatencyMs: 850,
      mtuBytes: 96,
      modulation: 'Multiple Frequency Shift Keying (MFSK)',
      cipher: 'ChaCha20-Poly1305',
      hardwareRequired: 'Alto-falante e Microfone convencionais (computador/celular)',
    },
    metrics: {
      txPackets: 240,
      rxPackets: 310,
      txBytes: 9500,
      rxBytes: 12400,
      rssiDb: -58,
      snrDb: 16.0,
      latencyMs: 910,
      packetLossPercent: 2.1,
      linkHealth: 91,
      lastHeardIso: new Date().toISOString(),
    },
    config: {
      channelFreq: '19.2 kHz Canal Primário',
      txPowerDbm: 10,
      fecRate: 'Reed-Solomon RS(64, 48)',
      priorityWeight: 6,
      autoReconnect: true,
      stealthMode: true,
    },
    pluginSource: 'builtin',
  },
  {
    id: 'optical_qr_stream',
    name: 'Fluxo Óptico QR & Esteganografia Visual',
    codeName: 'OPTICAL-QR-AIRGAP',
    category: 'optical',
    layer: 'application',
    status: 'active',
    isPlugin: false,
    version: '2.0.1',
    author: 'Jyy Air-Gap Security Team',
    description: 'Canal de dados óptico de via única (unidirecional) de tela para câmera a 60 FPS, totalmente imune a escutas eletromagnéticas.',
    spec: {
      carrier: 'Espectro Visível RGB (Pixels na Tela)',
      medium: 'Linha Óptica Air-Gapped Tela -> Câmera',
      rangeMax: '0.2 ~ 5 m',
      throughput: '24 ~ 128 kbps',
      nominalLatencyMs: 120,
      mtuBytes: 512,
      modulation: 'Matriz Bidimensional ISO/IEC 18004 QR',
      cipher: 'Camada de Ofuscação Esteganográfica + AES-256',
      hardwareRequired: 'Tela e Câmera / Webcam integrada',
    },
    metrics: {
      txPackets: 680,
      rxPackets: 640,
      txBytes: 154000,
      rxBytes: 148000,
      rssiDb: -40,
      snrDb: 30.0,
      latencyMs: 140,
      packetLossPercent: 0.8,
      linkHealth: 94,
      lastHeardIso: new Date().toISOString(),
    },
    config: {
      channelFreq: 'Frame Rate 30 FPS / Versão QR 12',
      txPowerDbm: 0,
      fecRate: 'QR Nível Q (25% Recuperação)',
      priorityWeight: 6,
      autoReconnect: true,
      stealthMode: true,
    },
    pluginSource: 'builtin',
  },
  {
    id: 'hf_vhf_aprs',
    name: 'Rádio Tático HF/VHF/UHF & APRS AX.25',
    codeName: 'TACTICAL-RF-AX25',
    category: 'tactical',
    layer: 'datalink',
    status: 'active',
    isPlugin: false,
    version: '3.1.2',
    author: 'Jyy Military Communications & Amateur Radio',
    description: 'Comunicação além do horizonte (NVIS e Ionosférica) e enlaces locais VHF/UHF por modulação de áudio AFSK 1200 baud.',
    spec: {
      carrier: '3 ~ 30 MHz (HF) / 144 ~ 148 MHz (VHF)',
      medium: 'Reflexão Ionosférica / Onda de Solo',
      rangeMax: '3000 km (HF) / 60 km (VHF)',
      throughput: '300 ~ 9600 bps',
      nominalLatencyMs: 950,
      mtuBytes: 256,
      modulation: 'Bell 202 AFSK / PSK31 / FT8',
      cipher: 'OTP (One-Time Pad) / Camada Militar',
      hardwareRequired: 'Transceptor Rádio Baofeng / Xiegu G90 / SDR RTL',
    },
    metrics: {
      txPackets: 512,
      rxPackets: 980,
      txBytes: 84000,
      rxBytes: 165000,
      rssiDb: -85,
      snrDb: 8.0,
      latencyMs: 1050,
      packetLossPercent: 4.5,
      linkHealth: 88,
      lastHeardIso: new Date().toISOString(),
    },
    config: {
      channelFreq: '144.390 MHz (APRS Padrão Brasil/Américas)',
      txPowerDbm: 37,
      fecRate: 'FCS CRC-16-CCITT',
      priorityWeight: 8,
      autoReconnect: true,
      stealthMode: false,
    },
    pluginSource: 'builtin',
  },
  {
    id: 'satellite_iridium_sdr',
    name: 'Satélite Orbital LEO & Iridium SBD / SDR',
    codeName: 'SAT-ORBITAL-SBD',
    category: 'satellite',
    layer: 'transport',
    status: 'active',
    isPlugin: false,
    version: '2.8.0',
    author: 'Jyy Orbital Systems',
    description: 'Telemetria global via constelações de órbita baixa LEO (Iridium Short Burst Data) e recepção passiva por SDR.',
    spec: {
      carrier: '1616 ~ 1626.5 MHz (Banda L)',
      medium: 'Espaço Orbital LEO (780 km de Altitude)',
      rangeMax: 'Global (Polo a Polo)',
      throughput: '340 bytes por rajada',
      nominalLatencyMs: 4200,
      mtuBytes: 340,
      modulation: 'DE-QPSK',
      cipher: 'AES-256-GCM Tático',
      hardwareRequired: 'Transceptor Iridium 9603 / Antena Helicoidal Ativa',
    },
    metrics: {
      txPackets: 84,
      rxPackets: 192,
      txBytes: 18400,
      rxBytes: 42100,
      rssiDb: -92,
      snrDb: 6.5,
      latencyMs: 4600,
      packetLossPercent: 5.0,
      linkHealth: 89,
      lastHeardIso: new Date().toISOString(),
    },
    config: {
      channelFreq: '1621.25 MHz Canal de Rajada',
      txPowerDbm: 33,
      fecRate: 'Convolucional Viterbi',
      priorityWeight: 9,
      autoReconnect: true,
      stealthMode: false,
    },
    pluginSource: 'builtin',
  },
  {
    id: 'webrtc_p2p_mesh',
    name: 'WebRTC P2P DataChannels Direto',
    codeName: 'WEBRTC-P2P-SCTP',
    category: 'digital',
    layer: 'transport',
    status: 'active',
    isPlugin: false,
    version: '1.2.0',
    author: 'W3C & Jyy P2P Protocol',
    description: 'Túnel ponto-a-ponto de ultrabaixa latência através da Internet ou LAN local com NAT Traversal e criptografia DTLS.',
    spec: {
      carrier: 'IP / UDP / SCTP sobre DTLS',
      medium: 'Infraestrutura de Rede IP cabeada ou sem fio',
      rangeMax: 'Global (com conexão IP)',
      throughput: '10 ~ 100 Mbps',
      nominalLatencyMs: 22,
      mtuBytes: 16384,
      modulation: 'Digital IP Packetized',
      cipher: 'DTLS-SRTP AES-GCM 256',
      hardwareRequired: 'Nenhum hardware especial (Web browser / Electron)',
    },
    metrics: {
      txPackets: 32400,
      rxPackets: 31800,
      txBytes: 18900000,
      rxBytes: 18200000,
      rssiDb: -48,
      snrDb: 32.0,
      latencyMs: 25,
      packetLossPercent: 0.1,
      linkHealth: 99,
      lastHeardIso: new Date().toISOString(),
    },
    config: {
      channelFreq: 'Portas dinâmicas UDP STUN/TURN',
      txPowerDbm: 0,
      fecRate: 'SCTP Retransmissão Adaptativa',
      priorityWeight: 10,
      autoReconnect: true,
      stealthMode: false,
    },
    pluginSource: 'builtin',
  },
  {
    id: 'websocket_local_relay',
    name: 'WebSocket & Relay LAN Assíncrono',
    codeName: 'WS-LAN-RELAY',
    category: 'digital',
    layer: 'application',
    status: 'active',
    isPlugin: false,
    version: '2.0.0',
    author: 'Jyy Core Daemon',
    description: 'Servidor local embutido em Node.js com descoberta automática mDNS e broadcast sem internet.',
    spec: {
      carrier: 'TCP/IP Porta 8080 / 3000',
      medium: 'Rede Local Wi-Fi ou Cabo Ethernet',
      rangeMax: 'Raio da Rede Local',
      throughput: '100 Mbps ~ 1 Gbps',
      nominalLatencyMs: 3,
      mtuBytes: 65536,
      modulation: 'Ethernet Frame Framing',
      cipher: 'TLS 1.3 / E2EE',
      hardwareRequired: 'Servidor local Jyy',
    },
    metrics: {
      txPackets: 54100,
      rxPackets: 53900,
      txBytes: 45200000,
      rxBytes: 44900000,
      rssiDb: -30,
      snrDb: 40.0,
      latencyMs: 4,
      packetLossPercent: 0.0,
      linkHealth: 100,
      lastHeardIso: new Date().toISOString(),
    },
    config: {
      channelFreq: '127.0.0.1:8080 / Broadcast Subnet',
      txPowerDbm: 0,
      fecRate: 'TCP Checksum Hardware Offload',
      priorityWeight: 10,
      autoReconnect: true,
      stealthMode: false,
    },
    pluginSource: 'builtin',
  },
  {
    id: 'ngl_ephemeral_onion',
    name: 'NGL & Roteamento Cebola Efêmero (Onion Multi-Hop)',
    codeName: 'NGL-ONION-POSTQ',
    category: 'digital',
    layer: 'network',
    status: 'active',
    isPlugin: false,
    version: '3.0.0',
    author: 'Jyy Cryptographic Defense Team',
    description: 'Mensageria ultrassecreta sem metadados com criptografia em camadas e nós de retransmissão voluntários (mixnet).',
    spec: {
      carrier: 'Over-The-Top (Encapsulado sobre qualquer meio físico)',
      medium: 'Qualquer canal de transporte Jyy ativo',
      rangeMax: 'Dependente do transportador físico',
      throughput: 'Variável (Limitado pelo elo mais lento)',
      nominalLatencyMs: 350,
      mtuBytes: 1024,
      modulation: 'Onion Encapsulation Packet Format',
      cipher: 'ML-KEM (Kyber-1024) + XChaCha20-Poly1305',
      hardwareRequired: 'Nenhum',
    },
    metrics: {
      txPackets: 2190,
      rxPackets: 2170,
      txBytes: 490000,
      rxBytes: 480000,
      rssiDb: -55,
      snrDb: 25.0,
      latencyMs: 380,
      packetLossPercent: 0.3,
      linkHealth: 98,
      lastHeardIso: new Date().toISOString(),
    },
    config: {
      channelFreq: '3 Saltos Criptográficos Aleatórios',
      txPowerDbm: 0,
      fecRate: 'Integridade Poly1305',
      priorityWeight: 9,
      autoReconnect: true,
      stealthMode: true,
    },
    pluginSource: 'builtin',
  },
  {
    id: 'nfc_rfid_tap',
    name: 'NFC & Indução de Campo Próximo (Short-Tap)',
    codeName: 'NFC-PROX-TAP',
    category: 'digital',
    layer: 'physical',
    status: 'standby',
    isPlugin: false,
    version: '1.1.0',
    author: 'NFC Forum & Jyy Security',
    description: 'Troca de chaves criptográficas mestre e credenciais de emergência por contato físico direto (0–4 cm).',
    spec: {
      carrier: '13.56 MHz (Indução Magnética)',
      medium: 'Acoplamento de Campo Próximo',
      rangeMax: '0 ~ 4 cm (Impossível interceptar à distância)',
      throughput: '106 ~ 424 kbps',
      nominalLatencyMs: 40,
      mtuBytes: 256,
      modulation: 'ASK 100% / Manchester',
      cipher: 'Autenticação Mútua AES-128',
      hardwareRequired: 'Controlador NFC PN532 ou leitor de smartphone',
    },
    metrics: {
      txPackets: 45,
      rxPackets: 45,
      txBytes: 4200,
      rxBytes: 4200,
      rssiDb: -20,
      snrDb: 45.0,
      latencyMs: 45,
      packetLossPercent: 0.0,
      linkHealth: 100,
      lastHeardIso: new Date().toISOString(),
    },
    config: {
      channelFreq: '13.560 MHz Ressonante',
      txPowerDbm: 0,
      fecRate: 'Paridade CRC-16',
      priorityWeight: 5,
      autoReconnect: false,
      stealthMode: true,
    },
    pluginSource: 'builtin',
  },
  {
    id: 'usb_ethernet_rndis',
    name: 'USB OTG / Cabo Direto Ethernet RNDIS',
    codeName: 'WIRED-USB-RNDIS',
    category: 'wired',
    layer: 'physical',
    status: 'active',
    isPlugin: false,
    version: '2.0.4',
    author: 'Linux USB Core & Jyy Hardware',
    description: 'Enlace físico cabeado de altíssima velocidade para transferências pesadas entre computadores e celulares via cabo USB.',
    spec: {
      carrier: 'Diferencial USB 2.0 / USB 3.2 Gen 2',
      medium: 'Cabo de Cobre Blindado USB Tipo-C',
      rangeMax: '1 ~ 5 metros',
      throughput: '480 Mbps ~ 5 Gbps',
      nominalLatencyMs: 1,
      mtuBytes: 1500,
      modulation: 'NRZI com Bit Stuffing',
      cipher: 'TLS Local Opcional',
      hardwareRequired: 'Cabo USB Tipo-C OTG ou Adaptador Ethernet',
    },
    metrics: {
      txPackets: 89000,
      rxPackets: 88500,
      txBytes: 98000000,
      rxBytes: 96000000,
      rssiDb: -10,
      snrDb: 50.0,
      latencyMs: 1,
      packetLossPercent: 0.0,
      linkHealth: 100,
      lastHeardIso: new Date().toISOString(),
    },
    config: {
      channelFreq: 'Barramento USB 480 Mbps',
      txPowerDbm: 0,
      fecRate: 'Hardware CRC-32',
      priorityWeight: 10,
      autoReconnect: true,
      stealthMode: false,
    },
    pluginSource: 'builtin',
  },
  {
    id: 'disaster_sos_mesh',
    name: 'Protocolo de Sobrevivência & Triagem START (WiFi-Mat SOS)',
    codeName: 'DISASTER-SOS-MESH',
    category: 'tactical',
    layer: 'application',
    status: 'active',
    isPlugin: false,
    version: '4.1.0',
    author: 'RuView Disaster Response & Defesa Civil',
    description: 'Protocolo de resgate com prioridade suprema, pacotes de inundação SOS e transmissão de sinais vitais sob escombros.',
    spec: {
      carrier: 'Multi-transporte (Wi-Fi CSI, LoRa, Som, Rádio)',
      medium: 'Escombros de Concreto, Lama, Água e Terreno Devastado',
      rangeMax: 'Global Multissalto',
      throughput: 'Sobrevivência adaptativa (50 bps a 10 Mbps)',
      nominalLatencyMs: 150,
      mtuBytes: 128,
      modulation: 'Injeção de Pacotes NDP e Beacons de Emergência',
      cipher: 'Criptografia Aberta para Resgatistas + Assinatura Ed25519',
      hardwareRequired: 'Qualquer nó ativo no sistema',
    },
    metrics: {
      txPackets: 182,
      rxPackets: 490,
      txBytes: 24500,
      rxBytes: 68000,
      rssiDb: -72,
      snrDb: 15.0,
      latencyMs: 170,
      packetLossPercent: 0.8,
      linkHealth: 98,
      lastHeardIso: new Date().toISOString(),
    },
    config: {
      channelFreq: 'Canal de Emergência Universal 0xFF',
      txPowerDbm: 30,
      fecRate: 'Inundação Tripla com ACK',
      priorityWeight: 10,
      autoReconnect: true,
      stealthMode: false,
    },
    pluginSource: 'builtin',
  },
];

// ----------------------------------------------------------------------------
// CATÁLOGO DE PLUGINS DE PROTOCOLO DISPONÍVEIS NA LOJA (MARKETPLACE)
// ----------------------------------------------------------------------------

export const REGISTRY_AVAILABLE_PLUGINS: ProtocolDefinition[] = [
  {
    id: 'ax25_packet_radio_pro',
    name: 'AX.25 Packet Radio Pro Militar',
    codeName: 'PLUGIN-AX25-PRO',
    category: 'tactical',
    layer: 'datalink',
    status: 'disabled',
    isPlugin: true,
    version: '2.4.1',
    author: 'Tactical Radio Group & NATO STANAG Compatible',
    description: 'Driver militar com controle avançado de quadro TNC KISS, protocolo AX.25 nível 2 versão 2.2 e compatibilidade com aprs.is.',
    spec: {
      carrier: '144 ~ 430 MHz FM / SSB',
      medium: 'Rádio Analógico com Modem TNC',
      rangeMax: '120 km com repetidoras',
      throughput: '1200 / 9600 baud',
      nominalLatencyMs: 450,
      mtuBytes: 256,
      modulation: 'Bell 202 AFSK / G3RUH FSK',
      cipher: 'Stanag 5066 Camada Segura',
      hardwareRequired: 'Modem TNC KISS USB ou Placa de Som Direta',
    },
    metrics: {
      txPackets: 0,
      rxPackets: 0,
      txBytes: 0,
      rxBytes: 0,
      latencyMs: 450,
      packetLossPercent: 0,
      linkHealth: 100,
      lastHeardIso: new Date().toISOString(),
    },
    config: {
      channelFreq: '144.800 MHz APRS Europa / 144.390 Américas',
      txPowerDbm: 30,
      fecRate: 'FCS CRC-16',
      priorityWeight: 7,
      autoReconnect: true,
      stealthMode: false,
    },
    pluginSource: 'community_registry',
    downloadUrl: 'https://jyy-protocols.org/plugins/ax25-pro.jyyproto',
  },
  {
    id: 'starlink_mini_driver',
    name: 'Starlink Mini Direct Telemetry Driver',
    codeName: 'PLUGIN-STARLINK-LEO',
    category: 'satellite',
    layer: 'network',
    status: 'disabled',
    isPlugin: true,
    version: '1.8.0',
    author: 'SpaceX Community & Satellite Hacker Lab',
    description: 'Módulo de comunicação direta com a antena Starlink Mini via gRPC local na porta 9200 para envio prioritário e telemetria de obstrução.',
    spec: {
      carrier: 'Banda Ku 10.7 ~ 12.7 GHz / 14.0 ~ 14.5 GHz',
      medium: 'Órbita Terrestre Baixa (550 km)',
      rangeMax: 'Global (com visada aberta do céu)',
      throughput: '100 ~ 250 Mbps',
      nominalLatencyMs: 32,
      mtuBytes: 1500,
      modulation: 'Phased Array Beamforming 64-QAM',
      cipher: 'TLS 1.3 / mTLS gRPC',
      hardwareRequired: 'Antena Starlink Mini / Alimentação USB-PD 100W',
    },
    metrics: {
      txPackets: 0,
      rxPackets: 0,
      txBytes: 0,
      rxBytes: 0,
      latencyMs: 32,
      packetLossPercent: 0,
      linkHealth: 100,
      lastHeardIso: new Date().toISOString(),
    },
    config: {
      channelFreq: '192.168.100.1:9200 (gRPC Local)',
      txPowerDbm: 28,
      fecRate: 'DVB-S2X LDPC',
      priorityWeight: 10,
      autoReconnect: true,
      stealthMode: false,
    },
    pluginSource: 'community_registry',
    downloadUrl: 'https://jyy-protocols.org/plugins/starlink-mini.jyyproto',
  },
  {
    id: 'esp_now_zero_latency',
    name: 'ESP-NOW Ultra-Fast Zero Latency',
    codeName: 'PLUGIN-ESP-NOW-DIRECT',
    category: 'rf',
    layer: 'datalink',
    status: 'disabled',
    isPlugin: true,
    version: '3.0.2',
    author: 'Espressif Systems & Jyy Hardware',
    description: 'Protocolo de comunicação rápida sem associação prévia ponto-a-ponto para microcontroladores ESP32 a 1 Mbps com latência de 2 ms.',
    spec: {
      carrier: '2.4 GHz (Canais 1 a 13)',
      medium: 'Ar / Ambiente Fechado ou Aberto',
      rangeMax: '220 metros (LOS)',
      throughput: '1 Mbps',
      nominalLatencyMs: 2,
      mtuBytes: 250,
      modulation: 'DSSS / CCK 802.11b Action Frame',
      cipher: 'CCMP AES-128 Hardware',
      hardwareRequired: 'Qualquer chip ESP32 / ESP32-S3 / ESP32-C3',
    },
    metrics: {
      txPackets: 0,
      rxPackets: 0,
      txBytes: 0,
      rxBytes: 0,
      latencyMs: 2,
      packetLossPercent: 0,
      linkHealth: 100,
      lastHeardIso: new Date().toISOString(),
    },
    config: {
      channelFreq: 'Canal 1 Wi-Fi (2412 MHz)',
      txPowerDbm: 20,
      fecRate: 'Hardware CRC',
      priorityWeight: 9,
      autoReconnect: true,
      stealthMode: true,
    },
    pluginSource: 'community_registry',
    downloadUrl: 'https://jyy-protocols.org/plugins/esp-now.jyyproto',
  },
  {
    id: 'vlf_submarine_deep',
    name: 'VLF Submarine Extreme Depth Radio',
    codeName: 'PLUGIN-VLF-DEEP-OCEAN',
    category: 'acoustic',
    layer: 'physical',
    status: 'disabled',
    isPlugin: true,
    version: '1.0.5',
    author: 'Deep Ocean Defense Labs',
    description: 'Comunicação eletromagnética em Frequência Muito Baixa (VLF 24 kHz) com capacidade de penetrar dezenas de metros em água do mar condutiva.',
    spec: {
      carrier: '18 ~ 26 kHz (Ondas Eletromagnéticas VLF)',
      medium: 'Água do Mar Altamente Salina (Atenuação Severa)',
      rangeMax: '5000 km (Antena de solo de grande porte) / 30m profundidade',
      throughput: '50 bps (Caracteres Táticos)',
      nominalLatencyMs: 5000,
      mtuBytes: 32,
      modulation: 'MSK (Minimum Shift Keying)',
      cipher: 'Vernam Cipher / One-Time Pad',
      hardwareRequired: 'Antena de Cabo de Reboque Flutuante (Towed Array)',
    },
    metrics: {
      txPackets: 0,
      rxPackets: 0,
      txBytes: 0,
      rxBytes: 0,
      latencyMs: 5000,
      packetLossPercent: 0,
      linkHealth: 100,
      lastHeardIso: new Date().toISOString(),
    },
    config: {
      channelFreq: '24.0 kHz Frequência Militar',
      txPowerDbm: 40,
      fecRate: 'Repetição Quádrupla',
      priorityWeight: 6,
      autoReconnect: true,
      stealthMode: true,
    },
    pluginSource: 'community_registry',
    downloadUrl: 'https://jyy-protocols.org/plugins/vlf-subsea.jyyproto',
  },
  {
    id: 'laser_fso_gigabit',
    name: 'Laser FSO Gigabit Free Space Optics',
    codeName: 'PLUGIN-LASER-FSO-GIGA',
    category: 'optical',
    layer: 'physical',
    status: 'disabled',
    isPlugin: true,
    version: '2.2.0',
    author: 'Quantum Photonics & Free Space Optical Alliance',
    description: 'Feixe infravermelho de 1550 nm colimado a laser com capacidade gigabit entre edifícios ou veículos, totalmente imune a interferências de rádio.',
    spec: {
      carrier: '1550 nm Infravermelho Próximo (Eye-Safe)',
      medium: 'Ar Livre com Mira Direta',
      rangeMax: '2.5 km',
      throughput: '1.25 Gbps',
      nominalLatencyMs: 1,
      mtuBytes: 9000,
      modulation: 'PAM-4 / QAM Óptico',
      cipher: 'Quantum Key Distribution (QKD) compatível',
      hardwareRequired: 'Telescópio Óptico com Sistema de Rastreamento Automático Gimbal',
    },
    metrics: {
      txPackets: 0,
      rxPackets: 0,
      txBytes: 0,
      rxBytes: 0,
      latencyMs: 1,
      packetLossPercent: 0,
      linkHealth: 100,
      lastHeardIso: new Date().toISOString(),
    },
    config: {
      channelFreq: '193.4 THz (1550 nm C-Band)',
      txPowerDbm: 17,
      fecRate: 'Reed-Solomon G.975.1',
      priorityWeight: 10,
      autoReconnect: true,
      stealthMode: true,
    },
    pluginSource: 'community_registry',
    downloadUrl: 'https://jyy-protocols.org/plugins/laser-fso.jyyproto',
  },
  {
    id: 'thread_matter_mesh',
    name: 'Thread & IEEE 802.15.4 Low-Power Mesh',
    codeName: 'PLUGIN-THREAD-MATTER',
    category: 'rf',
    layer: 'network',
    status: 'disabled',
    isPlugin: true,
    version: '1.3.1',
    author: 'Thread Group & CSA Matter',
    description: 'Rede mesh IPv6 de baixo consumo e auto-regeneração (*self-healing*) operando em 2.4 GHz com endereçamento /64 nativo.',
    spec: {
      carrier: '2.4 GHz IEEE 802.15.4 (Canais 11 a 26)',
      medium: 'Ar / Edificações',
      rangeMax: '100 m por salto (Malha com até 250 roteadores)',
      throughput: '250 kbps',
      nominalLatencyMs: 35,
      mtuBytes: 1280,
      modulation: 'O-QPSK Direct Sequence',
      cipher: 'AES-CCM-128 de Hardware',
      hardwareRequired: 'Rádio 802.15.4 (Silicon Labs EFR32 / Nordic nRF52840)',
    },
    metrics: {
      txPackets: 0,
      rxPackets: 0,
      txBytes: 0,
      rxBytes: 0,
      latencyMs: 35,
      packetLossPercent: 0,
      linkHealth: 100,
      lastHeardIso: new Date().toISOString(),
    },
    config: {
      channelFreq: 'Canal 15 (2425 MHz)',
      txPowerDbm: 8,
      fecRate: 'CCM Integridade 4/8',
      priorityWeight: 7,
      autoReconnect: true,
      stealthMode: false,
    },
    pluginSource: 'community_registry',
    downloadUrl: 'https://jyy-protocols.org/plugins/thread-mesh.jyyproto',
  },
];

// ----------------------------------------------------------------------------
// CONJUNTOS DE PROTOCOLOS PREDEFINIDOS (TACTICAL PROTOCOL SUITES)
// ----------------------------------------------------------------------------

export const PROTOCOL_BUNDLES: ProtocolBundle[] = [
  {
    id: 'bundle_survival_disaster',
    name: 'Conjunto Sobrevivência & Desastre Tático',
    code: 'BUNDLE-SURVIVOR-ALPHA',
    tagline: 'Resgate em escombros, blackouts totais e catástrofes naturais',
    category: 'Emergência',
    iconName: 'Flame',
    targetProtocolIds: [
      'disaster_sos_mesh',
      'lora_meshtastic',
      'wifi_radar_densepose',
      'audio_ultrasonic_air',
      'satellite_iridium_sdr',
    ],
    routingStrategy: 'omni_broadcast',
    recommendedUse: 'Inundação em todos os canais para garantir entrega de pedidos de resgate e sinais vitais.',
  },
  {
    id: 'bundle_subsea_amphibious',
    name: 'Conjunto Submarino & Anfíbio Avançado',
    code: 'BUNDLE-AQUA-AMPHIBIAN',
    tagline: 'Mergulho, comunicações subaquáticas, submarinos e boias flutuantes',
    category: 'Marítimo',
    iconName: 'Waves',
    targetProtocolIds: [
      'acoustic_subsea',
      'optical_lifi_laser',
      'hf_vhf_aprs',
      'lora_meshtastic',
    ],
    routingStrategy: 'cascading_fallback',
    recommendedUse: 'Usa acústico no meio líquido, laser óptico em linha direta e salta para HF ao emergir.',
  },
  {
    id: 'bundle_stealth_airgap',
    name: 'Conjunto Stealth Air-Gapped Anti-Grampo',
    code: 'BUNDLE-SHADOW-STEALTH',
    tagline: 'Emissão zero de radiofrequência, imune a detectores de espectro',
    category: 'Segurança Máxima',
    iconName: 'ShieldAlert',
    targetProtocolIds: [
      'optical_qr_stream',
      'audio_ultrasonic_air',
      'ngl_ephemeral_onion',
      'nfc_rfid_tap',
    ],
    routingStrategy: 'best_metric',
    recommendedUse: 'Sem sinais de RF detectáveis por jammers ou equipes de vigilância eletrônica.',
  },
  {
    id: 'bundle_urban_hyperlink',
    name: 'Conjunto Urbana Alta Velocidade',
    code: 'BUNDLE-URBAN-HYPER',
    tagline: 'Throughput máximo com agregação de banda multi-enlace',
    category: 'Performance',
    iconName: 'Zap',
    targetProtocolIds: [
      'wifi_radar_densepose',
      'cellular_5g_glinet',
      'webrtc_p2p_mesh',
      'websocket_local_relay',
      'ble_mesh_direct',
    ],
    routingStrategy: 'multipath_bonding',
    recommendedUse: 'Agregação simultânea de links para transferência de grandes arquivos e streams HD.',
  },
  {
    id: 'bundle_orbital_deepspace',
    name: 'Conjunto Espacial & Satelital Global',
    code: 'BUNDLE-ORBITAL-COSMOS',
    tagline: 'Alcance intercontinental independente de infraestrutura terrestre',
    category: 'Espacial',
    iconName: 'Satellite',
    targetProtocolIds: [
      'satellite_iridium_sdr',
      'hf_vhf_aprs',
      'lora_meshtastic',
      'ngl_ephemeral_onion',
    ],
    routingStrategy: 'cascading_fallback',
    recommendedUse: 'Expedições em alto-mar, desertos ou regiões remotas sem cobertura de celular.',
  },
  {
    id: 'bundle_military_tactical',
    name: 'Conjunto Tático de Campanha',
    code: 'BUNDLE-TAC-FIELD',
    tagline: 'Resistência a Guerra Eletrônica (EW) e coordenação de pelotão',
    category: 'Militar',
    iconName: 'RadioTower',
    targetProtocolIds: [
      'hf_vhf_aprs',
      'lora_meshtastic',
      'wifi_radar_densepose',
      'usb_ethernet_rndis',
      'disaster_sos_mesh',
    ],
    routingStrategy: 'multipath_bonding',
    recommendedUse: 'Resistência a interferência ativa (jamming) com canais de rádio e radar de intrusão.',
  },
];

// ----------------------------------------------------------------------------
// UTILITÁRIOS MATEMÁTICOS E DE CRIPTOGRAFIA / ENCAPSULAMENTO
// ----------------------------------------------------------------------------

export function calculateCrc32(str: string): string {
  let crc = 0 ^ -1;
  for (let i = 0; i < str.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ str.charCodeAt(i)) & 0xff];
  }
  return ((crc ^ -1) >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

const CRC32_TABLE = (() => {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

export function stringToHexDump(str: string): string {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    bytes.push(str.charCodeAt(i).toString(16).padStart(2, '0').toUpperCase());
  }
  return bytes.join(' ');
}

// ----------------------------------------------------------------------------
// DISPATCHER CROSS-PROTOCOL ENGINE
// ----------------------------------------------------------------------------

export class ProtocolHubEngine {
  private protocols: Map<string, ProtocolDefinition> = new Map();
  private history: TransmittedFrame[] = [];
  private activeStrategy: RoutingStrategy = 'multipath_bonding';

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const storedProtocols = localStorage.getItem('jyy_protocol_hub_definitions');
      if (storedProtocols) {
        const parsed: ProtocolDefinition[] = JSON.parse(storedProtocols);
        parsed.forEach((p) => this.protocols.set(p.id, p));
      } else {
        INITIAL_BUILTIN_PROTOCOLS.forEach((p) => this.protocols.set(p.id, p));
        this.saveToStorage();
      }

      const storedStrategy = localStorage.getItem('jyy_protocol_hub_strategy');
      if (storedStrategy) {
        this.activeStrategy = storedStrategy as RoutingStrategy;
      }
    } catch {
      INITIAL_BUILTIN_PROTOCOLS.forEach((p) => this.protocols.set(p.id, p));
    }
  }

  public saveToStorage() {
    try {
      const arr = Array.from(this.protocols.values());
      localStorage.setItem('jyy_protocol_hub_definitions', JSON.stringify(arr));
      localStorage.setItem('jyy_protocol_hub_strategy', this.activeStrategy);
    } catch {
      // Ignora erro de cota
    }
  }

  public getAllProtocols(): ProtocolDefinition[] {
    return Array.from(this.protocols.values());
  }

  public getActiveProtocols(): ProtocolDefinition[] {
    return Array.from(this.protocols.values()).filter((p) => p.status === 'active');
  }

  public getProtocol(id: string): ProtocolDefinition | undefined {
    return this.protocols.get(id);
  }

  public setProtocolStatus(id: string, status: ProtocolStatus) {
    const proto = this.protocols.get(id);
    if (proto) {
      proto.status = status;
      this.protocols.set(id, proto);
      this.saveToStorage();
    }
  }

  public updateProtocolConfig(id: string, partialConfig: Partial<ProtocolConfig>) {
    const proto = this.protocols.get(id);
    if (proto) {
      proto.config = { ...proto.config, ...partialConfig };
      this.protocols.set(id, proto);
      this.saveToStorage();
    }
  }

  public setRoutingStrategy(strategy: RoutingStrategy) {
    this.activeStrategy = strategy;
    this.saveToStorage();
  }

  public getRoutingStrategy(): RoutingStrategy {
    return this.activeStrategy;
  }

  // Instalar um plugin novo (da loja ou criado pelo usuário)
  public installPlugin(plugin: ProtocolDefinition): boolean {
    plugin.isPlugin = true;
    plugin.status = 'active';
    plugin.installedAt = new Date().toISOString();
    this.protocols.set(plugin.id, plugin);
    this.saveToStorage();
    return true;
  }

  // Desinstalar plugin
  public uninstallPlugin(id: string): boolean {
    const proto = this.protocols.get(id);
    if (proto && proto.isPlugin) {
      this.protocols.delete(id);
      this.saveToStorage();
      return true;
    }
    return false;
  }

  // Ativar um conjunto de protocolos
  public applyBundle(bundleId: string): boolean {
    const bundle = PROTOCOL_BUNDLES.find((b) => b.id === bundleId);
    if (!bundle) return false;

    // Desativa temporariamente os não selecionados e ativa os do conjunto
    this.protocols.forEach((proto) => {
      if (bundle.targetProtocolIds.includes(proto.id)) {
        proto.status = 'active';
      } else {
        proto.status = 'standby';
      }
    });

    this.activeStrategy = bundle.routingStrategy;
    this.saveToStorage();
    return true;
  }

  // Transmitir um pacote através da matriz
  public dispatchFrame(
    payloadText: string,
    targetProtocolId?: string,
    overrideMode?: RoutingStrategy
  ): TransmittedFrame {
    const mode = overrideMode || this.activeStrategy;
    const activeProtocols = this.getActiveProtocols();
    const effectiveProtocol =
      (targetProtocolId ? this.protocols.get(targetProtocolId) : null) ||
      (activeProtocols.length > 0 ? activeProtocols[0] : INITIAL_BUILTIN_PROTOCOLS[0]);

    const crc = calculateCrc32(payloadText);
    const traceLogs: string[] = [];
    const timestamp = Date.now();

    traceLogs.push(`[${new Date().toLocaleTimeString()}] Inicializando despacho pelo barramento Omni-Protocol`);
    traceLogs.push(`Modo de Roteamento Selecionado: ${mode.toUpperCase()}`);
    traceLogs.push(`Tamanho do Payload: ${payloadText.length} bytes | CRC32: 0x${crc}`);

    if (mode === 'omni_broadcast') {
      traceLogs.push(`Omni-Broadcast engajado: Inundando ${activeProtocols.length} enlaces físicos simultâneos.`);
      activeProtocols.forEach((p) => {
        traceLogs.push(` -> Disparando frame via [${p.codeName}] (${p.spec.carrier})`);
        p.metrics.txPackets += 1;
        p.metrics.txBytes += payloadText.length;
      });
    } else if (mode === 'multipath_bonding') {
      traceLogs.push(`Multipath Bonding ativado: Fragmentando carga útil entre os nós de menor latência.`);
      const sorted = [...activeProtocols].sort((a, b) => a.spec.nominalLatencyMs - b.spec.nominalLatencyMs);
      sorted.slice(0, 3).forEach((p, idx) => {
        traceLogs.push(` -> Ramo #${idx + 1}: [${p.name}] Alocado para 33% da matriz`);
        p.metrics.txPackets += 1;
        p.metrics.txBytes += Math.ceil(payloadText.length / 3);
      });
    } else if (mode === 'cascading_fallback') {
      traceLogs.push(`Cascading Fallback: Testando enlace primário [${effectiveProtocol.name}]`);
      traceLogs.push(`Enlace primário respondeu com ACK em ${effectiveProtocol.spec.nominalLatencyMs} ms`);
      effectiveProtocol.metrics.txPackets += 1;
      effectiveProtocol.metrics.txBytes += payloadText.length;
    } else {
      traceLogs.push(`Canal Direto [${effectiveProtocol.codeName}] selecionado com sucesso.`);
      effectiveProtocol.metrics.txPackets += 1;
      effectiveProtocol.metrics.txBytes += payloadText.length;
    }

    traceLogs.push(`[SUCESSO] Confirmação de Entrega Recebida (ACK 0x06)`);

    const frame: TransmittedFrame = {
      id: 'FRAME-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      timestamp,
      sourceNode: 'JYY-LOCAL-NODE-01',
      destinationNode: 'MESH-BROADCAST-ALL',
      protocolId: effectiveProtocol.id,
      routingMode: mode,
      payloadText,
      payloadHex: stringToHexDump(payloadText),
      payloadSizeBytes: payloadText.length,
      crc32Hex: crc,
      delivered: true,
      latencyMs: effectiveProtocol.spec.nominalLatencyMs,
      logTrace: traceLogs,
    };

    this.history.unshift(frame);
    if (this.history.length > 50) this.history.pop();
    this.saveToStorage();

    return frame;
  }

  public getHistory(): TransmittedFrame[] {
    return this.history;
  }

  public resetToDefaults() {
    this.protocols.clear();
    INITIAL_BUILTIN_PROTOCOLS.forEach((p) => this.protocols.set(p.id, p));
    this.activeStrategy = 'multipath_bonding';
    this.saveToStorage();
  }
}

export const protocolHubEngine = new ProtocolHubEngine();
