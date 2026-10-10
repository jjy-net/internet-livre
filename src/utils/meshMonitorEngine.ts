/**
 * ============================================================================
 * ENGINE MESHMONITOR: MONITORAMENTO COMPLETO PARA REDES MESHTASTIC & JJY MESH
 * ----------------------------------------------------------------------------
 * Suporte a:
 * - Telemetria em Tempo Real (Bateria, Tensão, Solar, Clima BME680/280, GPS)
 * - Sniffer de Pacotes & DPI (Text, Position, Telemetry, Routing, Traceroute)
 * - Traceroute Hop-by-Hop com Análise de RTT & SNR
 * - Topologia de Rádio & Matriz de Enlaces RF
 * - Gestão de Canais & Geração de QR Code para Compartilhamento (meshtastic://)
 * - Watchdog de Saúde da Malha & Alertas Automáticos
 * ============================================================================
 */

export type NodeRole = 'CLIENT' | 'CLIENT_MUTE' | 'ROUTER' | 'ROUTER_LATE' | 'REPEATER' | 'TRACKER' | 'SENSOR';

export interface MeshPosition {
  lat: number;
  lon: number;
  alt: number;
  time: number;
  satsInView?: number;
  dop?: number;
}

export interface MeshEnvironmentTelemetry {
  temperatureC: number;
  relativeHumidity: number;
  barometricPressureHpa: number;
  gasResistanceKOhms?: number;
  iaqScore?: number; // Indoor Air Quality (0 - 500)
}

export interface MeshNodeInfo {
  id: string; // Ex: "!38f1a04b"
  numId: number;
  shortName: string;
  longName: string;
  mac: string;
  hardware: string;
  role: NodeRole;
  firmwareVersion: string;
  batteryPercent: number;
  voltage: number;
  isCharging: boolean;
  solarCurrentMa?: number;
  lastHeard: number; // Unix ms
  hopsAway: number;
  snr: number; // dB
  rssi: number; // dBm
  channel: number;
  position?: MeshPosition;
  environment?: MeshEnvironmentTelemetry;
  neighborCount: number;
  isLocal?: boolean;
  isFavorite?: boolean;
  notes?: string;
}

export type PacketType =
  | 'TEXT_MESSAGE_APP'
  | 'POSITION_APP'
  | 'TELEMETRY_APP'
  | 'ROUTING_APP'
  | 'TRACEROUTE_APP'
  | 'ADMIN_APP'
  | 'NEIGHBORINFO_APP';

export interface MeshPacket {
  id: string;
  timestamp: number;
  from: string;
  fromName: string;
  to: string;
  toName: string;
  channelName: string;
  type: PacketType;
  hopLimit: number;
  hopStart: number;
  snr: number;
  rssi: number;
  payloadSummary: string;
  rawPayloadHex?: string;
  decodedDetails?: Record<string, unknown>;
  crcOk: boolean;
}

export interface MeshChannelConfig {
  index: number;
  name: string;
  psk: string;
  pskType: 'default_public' | 'custom_aes256';
  modemPreset: string;
  frequencyMhz: number;
  uplinkEnabled: boolean;
  downlinkEnabled: boolean;
}

export interface TracerouteHop {
  hopIndex: number;
  nodeId: string;
  nodeName: string;
  hardware: string;
  snr: number;
  rssi: number;
  delayMs: number;
}

export interface TracerouteResult {
  targetId: string;
  targetName: string;
  timestamp: number;
  hops: TracerouteHop[];
  totalRttMs: number;
  status: 'SUCCESS' | 'TIMEOUT' | 'UNREACHABLE';
}

export interface MeshAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  timestamp: number;
  nodeId?: string;
}

export interface MeshNetworkStats {
  totalNodes: number;
  onlineNodes: number;
  channelUtilPercent: number; // Airtime ocupação %
  txAirUtilPercent: number;
  avgSnr: number;
  avgRssi: number;
  packetsReceived: number;
  packetsTransmitted: number;
  packetLossPercent: number;
  networkDiameterHops: number;
}

export interface TelemetryHistoryPoint {
  timeStr: string;
  timestamp: number;
  batteryPercent: number;
  voltage: number;
  solarMa: number;
  channelUtil: number;
  snr: number;
}

// ----------------------------------------------------------------------------
// CÁLCULOS GEOGRÁFICOS E RF
// ----------------------------------------------------------------------------

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

export function calculateBearingDegrees(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round((brng + 360) % 360);
}

export function getLqiQuality(snr: number, rssi: number): {
  label: 'Excelente' | 'Bom' | 'Moderado' | 'Crítico';
  score: number; // 0 a 100
  color: string;
  badgeBg: string;
} {
  // SNR: > 6 = Excelente, 0 a 6 = Bom, -6 a 0 = Moderado, < -6 = Crítico
  // RSSI: > -80 = Excelente, -95 a -80 = Bom, -110 a -95 = Moderado, < -110 = Crítico
  const normSnr = Math.max(0, Math.min(1, (snr + 15) / 25));
  const normRssi = Math.max(0, Math.min(1, (rssi + 125) / 55));
  const score = Math.round((normSnr * 0.6 + normRssi * 0.4) * 100);

  if (score >= 75) {
    return { label: 'Excelente', score, color: '#10b981', badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
  }
  if (score >= 50) {
    return { label: 'Bom', score, color: '#38bdf8', badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' };
  }
  if (score >= 25) {
    return { label: 'Moderado', score, color: '#f59e0b', badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
  }
  return { label: 'Crítico', score, color: '#f43f5e', badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40' };
}

// ----------------------------------------------------------------------------
// CONJUNTO DE DADOS INICIAL DO MESHMONITOR
// ----------------------------------------------------------------------------

export const INITIAL_MONITOR_NODES: MeshNodeInfo[] = [
  {
    id: '!38f1a04b',
    numId: 955367499,
    shortName: 'ME-01',
    longName: 'Nó Mestre Local (Heltec V3)',
    mac: '74:4d:bd:38:f1:a0',
    hardware: 'Heltec LoRa32 v3 (ESP32-S3 + SX1262)',
    role: 'ROUTER',
    firmwareVersion: 'v2.5.8.f92a',
    batteryPercent: 96,
    voltage: 4.18,
    isCharging: true,
    solarCurrentMa: 185,
    lastHeard: Date.now() - 4000,
    hopsAway: 0,
    snr: 12.5,
    rssi: -52,
    channel: 0,
    position: {
      lat: -23.5505,
      lon: -46.6333,
      alt: 760,
      time: Date.now() - 10000,
      satsInView: 11,
      dop: 1.1,
    },
    environment: {
      temperatureC: 24.8,
      relativeHumidity: 58.2,
      barometricPressureHpa: 1014.5,
      gasResistanceKOhms: 142.5,
      iaqScore: 28,
    },
    neighborCount: 8,
    isLocal: true,
    isFavorite: true,
    notes: 'Estação base principal conectada via USB com antena collinear 5.8 dBi.',
  },
  {
    id: '!7c92b4e1',
    numId: 2089997537,
    shortName: 'PICO-REP',
    longName: 'Repetidor Pico da Serra (T-Beam)',
    mac: '24:0a:c4:7c:92:b4',
    hardware: 'LilyGO T-Beam v1.2 (AXP2101 + NEO-6M)',
    role: 'REPEATER',
    firmwareVersion: 'v2.5.8.f92a',
    batteryPercent: 88,
    voltage: 4.04,
    isCharging: true,
    solarCurrentMa: 420,
    lastHeard: Date.now() - 45000,
    hopsAway: 1,
    snr: 8.2,
    rssi: -84,
    channel: 0,
    position: {
      lat: -23.4980,
      lon: -46.5920,
      alt: 1140,
      time: Date.now() - 60000,
      satsInView: 14,
      dop: 0.9,
    },
    environment: {
      temperatureC: 19.4,
      relativeHumidity: 68.0,
      barometricPressureHpa: 890.2,
      gasResistanceKOhms: 210.0,
      iaqScore: 18,
    },
    neighborCount: 14,
    isFavorite: true,
    notes: 'Repetidor solar instalado na torre de telecomunicações a 1140m altitude.',
  },
  {
    id: '!a14d59f3',
    numId: 2706201075,
    shortName: 'WIS-MOC',
    longName: 'Mochila Tática WisBlock',
    mac: 'f8:dc:7a:a1:4d:59',
    hardware: 'RAK Wireless WisBlock 4631 (nRF52840)',
    role: 'TRACKER',
    firmwareVersion: 'v2.5.6.b18c',
    batteryPercent: 74,
    voltage: 3.89,
    isCharging: false,
    solarCurrentMa: 0,
    lastHeard: Date.now() - 110000,
    hopsAway: 1,
    snr: 4.5,
    rssi: -93,
    channel: 0,
    position: {
      lat: -23.5820,
      lon: -46.6850,
      alt: 790,
      time: Date.now() - 120000,
      satsInView: 9,
      dop: 1.4,
    },
    environment: {
      temperatureC: 26.2,
      relativeHumidity: 52.0,
      barometricPressureHpa: 1012.0,
    },
    neighborCount: 5,
    isFavorite: false,
    notes: 'Nó portátil de mochila em patrulha tática no Parque Ibirapuera.',
  },
  {
    id: '!b930e182',
    numId: 3106988418,
    shortName: 'ECH-04',
    longName: 'LilyGO T-Echo E-Ink Tracker',
    mac: 'e0:5a:1b:b9:30:e1',
    hardware: 'LilyGO T-Echo (nRF52840 + E-Paper 1.54")',
    role: 'CLIENT',
    firmwareVersion: 'v2.5.8.f92a',
    batteryPercent: 62,
    voltage: 3.78,
    isCharging: false,
    lastHeard: Date.now() - 240000,
    hopsAway: 2,
    snr: -1.8,
    rssi: -108,
    channel: 0,
    position: {
      lat: -23.5350,
      lon: -46.5400,
      alt: 745,
      time: Date.now() - 250000,
      satsInView: 8,
      dop: 1.8,
    },
    neighborCount: 4,
    isFavorite: false,
    notes: 'Dispositivo pessoal de bolso de operador da Zona Leste.',
  },
  {
    id: '!c420f8d9',
    numId: 3290495193,
    shortName: 'ST-G2',
    longName: 'Estação Gateway G2 Rural',
    mac: '30:c6:f7:c4:20:f8',
    hardware: 'Station G2 Ultra (ESP32-S3 Dual-Core)',
    role: 'ROUTER',
    firmwareVersion: 'v2.5.8.f92a',
    batteryPercent: 100,
    voltage: 13.8, // Bateria estacionária 12V
    isCharging: true,
    solarCurrentMa: 1850,
    lastHeard: Date.now() - 32000,
    hopsAway: 2,
    snr: 6.0,
    rssi: -89,
    channel: 0,
    position: {
      lat: -23.4200,
      lon: -46.7200,
      alt: 920,
      time: Date.now() - 40000,
      satsInView: 12,
      dop: 1.0,
    },
    environment: {
      temperatureC: 22.0,
      relativeHumidity: 64.0,
      barometricPressureHpa: 980.5,
      iaqScore: 12,
    },
    neighborCount: 11,
    isFavorite: true,
    notes: 'Gateway rural com conexão satelital e repetidor LoRa de alto ganho.',
  },
];

export const INITIAL_MONITOR_PACKETS: MeshPacket[] = [
  {
    id: 'pkt_001',
    timestamp: Date.now() - 15000,
    from: '!7c92b4e1',
    fromName: 'PICO-REP',
    to: '^all',
    toName: 'Broadcast Geral',
    channelName: '#LongFast',
    type: 'TELEMETRY_APP',
    hopLimit: 3,
    hopStart: 3,
    snr: 8.2,
    rssi: -84,
    payloadSummary: 'Bateria: 88% (4.04V) • Solar: 420mA • Temp: 19.4°C • Pressão: 890 hPa',
    crcOk: true,
  },
  {
    id: 'pkt_002',
    timestamp: Date.now() - 42000,
    from: '!a14d59f3',
    fromName: 'WIS-MOC',
    to: '^all',
    toName: 'Broadcast Geral',
    channelName: '#LongFast',
    type: 'POSITION_APP',
    hopLimit: 3,
    hopStart: 2,
    snr: 4.5,
    rssi: -93,
    payloadSummary: 'Lat: -23.582, Lon: -46.685, Alt: 790m, Sats: 9 (DOP 1.4)',
    crcOk: true,
  },
  {
    id: 'pkt_003',
    timestamp: Date.now() - 85000,
    from: '!c420f8d9',
    fromName: 'ST-G2',
    to: '!38f1a04b',
    toName: 'ME-01',
    channelName: '#Tatico-E2EE',
    type: 'TEXT_MESSAGE_APP',
    hopLimit: 3,
    hopStart: 1,
    snr: 6.0,
    rssi: -89,
    payloadSummary: 'Mensagem Cifrada: [E2EE ChaCha20-Poly1305]: "Enlace rural com repetidor pico ativo 100%."',
    crcOk: true,
  },
  {
    id: 'pkt_004',
    timestamp: Date.now() - 130000,
    from: '!b930e182',
    fromName: 'ECH-04',
    to: '^all',
    toName: 'Broadcast Geral',
    channelName: '#LongFast',
    type: 'ROUTING_APP',
    hopLimit: 3,
    hopStart: 1,
    snr: -1.8,
    rssi: -108,
    payloadSummary: 'Routing Discovery: Nó ECH-04 ouve 4 vizinhos (PICO-REP, ME-01, WIS-MOC)',
    crcOk: true,
  },
];

export const INITIAL_MONITOR_CHANNELS: MeshChannelConfig[] = [
  {
    index: 0,
    name: 'LongFast',
    psk: 'AQ==',
    pskType: 'default_public',
    modemPreset: 'LongFast (19.2 kbps, SF11, BW 250kHz)',
    frequencyMhz: 915.0,
    uplinkEnabled: true,
    downlinkEnabled: true,
  },
  {
    index: 1,
    name: 'JJY-Sovereign',
    psk: 'K8d9X2pQ5mW7zR1vL4nB9tC6yF3jH8s=',
    pskType: 'custom_aes256',
    modemPreset: 'MediumFast (38.4 kbps, SF9, BW 250kHz)',
    frequencyMhz: 915.2,
    uplinkEnabled: true,
    downlinkEnabled: true,
  },
  {
    index: 2,
    name: 'Emergencia-BR',
    psk: 'AQ==',
    pskType: 'default_public',
    modemPreset: 'VeryLongSlow (2.4 kbps, SF12, BW 125kHz)',
    frequencyMhz: 915.5,
    uplinkEnabled: true,
    downlinkEnabled: true,
  },
];

export const INITIAL_TELEMETRY_SERIES: TelemetryHistoryPoint[] = [
  { timeStr: '14:00', timestamp: Date.now() - 3600000 * 6, batteryPercent: 99, voltage: 4.20, solarMa: 320, channelUtil: 6.2, snr: 12.8 },
  { timeStr: '15:00', timestamp: Date.now() - 3600000 * 5, batteryPercent: 98, voltage: 4.19, solarMa: 410, channelUtil: 8.5, snr: 12.4 },
  { timeStr: '16:00', timestamp: Date.now() - 3600000 * 4, batteryPercent: 98, voltage: 4.18, solarMa: 380, channelUtil: 11.2, snr: 11.9 },
  { timeStr: '17:00', timestamp: Date.now() - 3600000 * 3, batteryPercent: 97, voltage: 4.18, solarMa: 220, channelUtil: 14.8, snr: 12.2 },
  { timeStr: '18:00', timestamp: Date.now() - 3600000 * 2, batteryPercent: 96, voltage: 4.17, solarMa: 45, channelUtil: 18.2, snr: 12.6 },
  { timeStr: '19:00', timestamp: Date.now() - 3600000 * 1, batteryPercent: 96, voltage: 4.18, solarMa: 0, channelUtil: 12.4, snr: 12.5 },
];

export const INITIAL_ALERTS: MeshAlert[] = [
  {
    id: 'alt_01',
    severity: 'info',
    title: 'Repetidor Solar Ativo',
    description: 'Nó PICO-REP operando em alta performance com 14 vizinhos na topologia.',
    timestamp: Date.now() - 600000,
    nodeId: '!7c92b4e1',
  },
  {
    id: 'alt_02',
    severity: 'warning',
    title: 'Sinal Fraco Detectado',
    description: 'Nó ECH-04 reportou SNR de -1.8 dB. Recomendado reorientar antena ou usar salto intermediário.',
    timestamp: Date.now() - 300000,
    nodeId: '!b930e182',
  },
];

// ----------------------------------------------------------------------------
// SIMULADOR DE TRACEROUTE & ROTEAMENTO
// ----------------------------------------------------------------------------

export function executeTracerouteSimulation(
  targetId: string,
  nodes: MeshNodeInfo[]
): TracerouteResult {
  const target = nodes.find((n) => n.id === targetId) || nodes[1];
  const local = nodes.find((n) => n.isLocal) || nodes[0];

  const hops: TracerouteHop[] = [];
  let totalDelay = 0;

  // Hop 0: Nó Local
  hops.push({
    hopIndex: 0,
    nodeId: local.id,
    nodeName: local.shortName,
    hardware: local.hardware,
    snr: local.snr,
    rssi: local.rssi,
    delayMs: 0,
  });

  if (target.hopsAway === 0) {
    totalDelay = 12;
  } else if (target.hopsAway === 1) {
    // 1 salto: Direto ou via repetidor
    const intermediateDelay = Math.floor(180 + Math.random() * 80);
    totalDelay = intermediateDelay;
    hops.push({
      hopIndex: 1,
      nodeId: target.id,
      nodeName: target.shortName,
      hardware: target.hardware,
      snr: target.snr,
      rssi: target.rssi,
      delayMs: intermediateDelay,
    });
  } else {
    // 2 ou mais saltos: passar pelo repetidor principal
    const rep = nodes.find((n) => n.role === 'REPEATER') || nodes[1];
    const delay1 = Math.floor(160 + Math.random() * 50);
    hops.push({
      hopIndex: 1,
      nodeId: rep.id,
      nodeName: rep.shortName,
      hardware: rep.hardware,
      snr: rep.snr,
      rssi: rep.rssi,
      delayMs: delay1,
    });

    const delay2 = Math.floor(220 + Math.random() * 90);
    totalDelay = delay1 + delay2;
    hops.push({
      hopIndex: 2,
      nodeId: target.id,
      nodeName: target.shortName,
      hardware: target.hardware,
      snr: target.snr,
      rssi: target.rssi,
      delayMs: delay2,
    });
  }

  return {
    targetId: target.id,
    targetName: target.longName,
    timestamp: Date.now(),
    hops,
    totalRttMs: totalDelay * 2 + Math.floor(Math.random() * 40),
    status: 'SUCCESS',
  };
}

// ----------------------------------------------------------------------------
// EXPORTADORES DE PACOTES
// ----------------------------------------------------------------------------

export function exportPacketsToJson(packets: MeshPacket[]): string {
  return JSON.stringify(packets, null, 2);
}

export function exportPacketsToCsv(packets: MeshPacket[]): string {
  const headers = ['ID', 'Data/Hora', 'Origem_ID', 'Origem_Nome', 'Destino', 'Canal', 'Tipo', 'Hops_Restantes', 'SNR_dB', 'RSSI_dBm', 'Payload', 'CRC_OK'];
  const rows = packets.map((p) => [
    p.id,
    new Date(p.timestamp).toISOString(),
    p.from,
    `"${p.fromName}"`,
    `"${p.toName}"`,
    p.channelName,
    p.type,
    p.hopLimit,
    p.snr,
    p.rssi,
    `"${p.payloadSummary.replace(/"/g, '""')}"`,
    p.crcOk ? 'TRUE' : 'FALSE',
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function generateMeshtasticShareUrl(channel: MeshChannelConfig): string {
  // Gera URL compatível com app oficial Meshtastic
  const payload = btoa(JSON.stringify({
    name: channel.name,
    psk: channel.psk,
    freq: channel.frequencyMhz,
  }));
  return `https://meshtastic.org/e/#${payload}`;
}
