/**
 * wifiRadarEngine.ts
 * Motor científico e de engenharia para Wi-Fi Multi-Canal, Padrão IEEE 802.11bf (Wi-Fi Sensing),
 * Câmera de Ondas Eletromagnéticas Through-Wall, RuView, DensePose (CMU/FAIR) e Bettercap Recon.
 * 
 * Referências e Tecnologias Integradas:
 * 1. RuView (https://github.com/ruvnet/RuView): Visão através de paredes com ESP32-S3 e CSI.
 * 2. DensePose (arXiv:1802.00434 / FAIR Detectron2): Reconstrução da malha UV e esqueleto de 24 partes corporais a partir de perturbações de rádio Wi-Fi.
 * 3. Linecast (https://github.com/ashuttl/linecast): Streaming e visualização de sinais RF e espectrograma cascata.
 * 4. Bettercap (https://www.bettercap.org/usage/web_ui/): Reconhecimento de eventos de rádio, APs e clientes em tempo real.
 * 5. Padrão IEEE 802.11bf (Wi-Fi SENS): Ratificado em setembro de 2025 para sensoriamento nativo por radiofrequência.
 */

// ==========================================
// 1. PADRÕES WI-FI & MULTI-CANAL (MLO)
// ==========================================

export type WifiGeneration = 'wifi7_be' | 'wifi6e_ax' | 'wifi6_ax' | 'wifi5_ac' | 'wifi4_n';

export interface WifiStandardProfile {
  id: WifiGeneration;
  marketingName: string;
  ieeeStandard: string;
  frequencyBands: string[];
  maxChannelWidthMhz: number;
  modulation: string;
  mimoStreamCount: string;
  sensingCapability: string;
  features: string[];
}

export const WIFI_STANDARDS_CATALOG: WifiStandardProfile[] = [
  {
    id: 'wifi7_be',
    marketingName: 'Wi-Fi 7 (Extremely High Throughput)',
    ieeeStandard: 'IEEE 802.11be',
    frequencyBands: ['2.4 GHz', '5 GHz', '6 GHz'],
    maxChannelWidthMhz: 320,
    modulation: '4096-QAM (12 bits/símbolo)',
    mimoStreamCount: 'Até 16x16 MU-MIMO',
    sensingCapability: 'Nativa IEEE 802.11bf SENS (Resolução milimétrica com 320 MHz)',
    features: [
      'Multi-Link Operation (MLO) - Transmissão simultânea agregada em 2.4 + 5 + 6 GHz',
      'Canais ultra-largos de 320 MHz na banda de 6 GHz',
      'Preamble Puncturing para evasão de interferência em tempo real',
      'Latência ultra-baixa determinística (< 5 ms)',
    ],
  },
  {
    id: 'wifi6e_ax',
    marketingName: 'Wi-Fi 6E (Banda Limpa de 6 GHz)',
    ieeeStandard: 'IEEE 802.11ax',
    frequencyBands: ['2.4 GHz', '5 GHz', '6 GHz (UNII-5 a UNII-8)'],
    maxChannelWidthMhz: 160,
    modulation: '1024-QAM',
    mimoStreamCount: '8x8 MU-MIMO',
    sensingCapability: 'Alta precisão em 6 GHz livre de interferência legado',
    features: [
      'Espectro adicional de 1200 MHz na banda de 6 GHz',
      '14 canais adicionais de 80 MHz ou 7 canais de 160 MHz',
      'OFDMA em uplink e downlink para multiplexação de múltiplos sensores',
    ],
  },
  {
    id: 'wifi6_ax',
    marketingName: 'Wi-Fi 6 (High Efficiency)',
    ieeeStandard: 'IEEE 802.11ax',
    frequencyBands: ['2.4 GHz', '5 GHz'],
    maxChannelWidthMhz: 160,
    modulation: '1024-QAM',
    mimoStreamCount: '8x8 MU-MIMO',
    sensingCapability: 'Suporte a CSI fino com subportadoras espaçadas em 78.125 kHz',
    features: [
      'Target Wake Time (TWT) para economia de energia em sensores IoT',
      'BSS Coloring para reuso espacial de frequência em densidade alta',
      'Canais DFS com detecção de radares meteorológicos',
    ],
  },
  {
    id: 'wifi5_ac',
    marketingName: 'Wi-Fi 5 (Gigabit Wi-Fi)',
    ieeeStandard: 'IEEE 802.11ac Wave 2',
    frequencyBands: ['5 GHz'],
    maxChannelWidthMhz: 80,
    modulation: '256-QAM',
    mimoStreamCount: '4x4 MU-MIMO',
    sensingCapability: 'Suporte clássico CSI via placas Intel 5300 ou Atheros 9300',
    features: [
      'Beamforming explícito para concentração direcionada de energia',
      'Canais de 80 MHz consolidados no padrão da indústria',
    ],
  },
];

// ==========================================
// 2. FÍSICA DE ATENUAÇÃO ATRAVÉS DE PAREDES
// ==========================================

export interface WallMaterialProfile {
  id: string;
  name: string;
  attenuationDb24Ghz: number;
  attenuationDb5Ghz: number;
  dielectricConstant: number;
  radarTransparency: 'Alta' | 'Média' | 'Baixa' | 'Opaca';
  description: string;
}

export const WALL_MATERIALS: WallMaterialProfile[] = [
  {
    id: 'drywall',
    name: 'Drywall / Gesso Acartonado (10 cm)',
    attenuationDb24Ghz: 1.5,
    attenuationDb5Ghz: 2.2,
    dielectricConstant: 2.8,
    radarTransparency: 'Alta',
    description: 'Excelente para tomografia RF. O sinal passa quase sem distorção com clara visão de alvos.',
  },
  {
    id: 'wood',
    name: 'Madeira / Portas e Compensados (5 cm)',
    attenuationDb24Ghz: 2.8,
    attenuationDb5Ghz: 4.1,
    dielectricConstant: 3.5,
    radarTransparency: 'Alta',
    description: 'Baixa atenuação com reflexão limpa de corpos em movimento atrás da estrutura.',
  },
  {
    id: 'brick',
    name: 'Alvenaria / Tijolo Cerâmico Furado (15 cm)',
    attenuationDb24Ghz: 5.4,
    attenuationDb5Ghz: 8.9,
    dielectricConstant: 4.6,
    radarTransparency: 'Média',
    description: 'Atenuação moderada. Permite detectar movimentação humana com algoritmos de ganho adaptativo.',
  },
  {
    id: 'concrete',
    name: 'Concreto Armado com Ferragem (20 cm)',
    attenuationDb24Ghz: 14.5,
    attenuationDb5Ghz: 22.0,
    dielectricConstant: 7.2,
    radarTransparency: 'Baixa',
    description: 'Alta perda por absorção e gaiola de Faraday parcial. Requer reflexões indiretas por frestas.',
  },
  {
    id: 'metal',
    name: 'Chapa Metálica / Espelho Blindado',
    attenuationDb24Ghz: 45.0,
    attenuationDb5Ghz: 60.0,
    dielectricConstant: 1000,
    radarTransparency: 'Opaca',
    description: 'Reflexão total de 100% da onda incidente. Bloqueia a visão direta através da superfície.',
  },
];

// ==========================================
// 3. MODELOS DENSEPOSE & RUVIEW (CSI-TO-BODY)
// ==========================================

export interface DensePoseJoint {
  name: string;
  x: number;
  y: number;
  confidence: number;
}

export interface DensePoseSkeleton {
  joints: DensePoseJoint[];
  uvSegments: { partId: number; name: string; color: string; areaPercent: number }[];
  isLocked: boolean;
  posture: 'Em Pé (Caminhando)' | 'Sentado' | 'Agachado' | 'Imóvel (Respirando)' | 'Queda Suspeita';
}

export const DENSEPOSE_SMPL_PARTS = [
  { id: 1, name: 'Cabeça / Face', color: '#f43f5e' },
  { id: 2, name: 'Pescoço', color: '#fb7185' },
  { id: 3, name: 'Tórax / Peito', color: '#06b6d4' },
  { id: 4, name: 'Abdômen / Lombar', color: '#0ea5e9' },
  { id: 5, name: 'Braço Superior Dir.', color: '#10b981' },
  { id: 6, name: 'Braço Superior Esq.', color: '#34d399' },
  { id: 7, name: 'Antebraço / Mão Dir.', color: '#a7f3d0' },
  { id: 8, name: 'Antebraço / Mão Esq.', color: '#6ee7b7' },
  { id: 9, name: 'Coxa Direita', color: '#f59e0b' },
  { id: 10, name: 'Coxa Esquerda', color: '#fbbf24' },
  { id: 11, name: 'Canela / Pé Dir.', color: '#fde047' },
  { id: 12, name: 'Canela / Pé Esq.', color: '#fef08a' },
];

/**
 * Gera as coordenadas do esqueleto DensePose com 17 articulações COCO
 * e animação proporcional ao movimento e respiração.
 */
export function generateDensePoseSkeleton(
  baseX: number,
  baseY: number,
  walkAngle: number,
  isWalking: boolean,
  breathingPulse: number
): DensePoseSkeleton {
  const armSwing = isWalking ? Math.sin(walkAngle * 2) * 16 : 0;
  const legSwing = isWalking ? Math.cos(walkAngle * 2) * 18 : 0;
  const chestExpansion = breathingPulse * 2;

  // 17 Articulações anatômicas padrão COCO
  const joints: DensePoseJoint[] = [
    { name: 'Nose', x: baseX, y: baseY - 48, confidence: 0.95 },
    { name: 'Left_Eye', x: baseX - 3, y: baseY - 51, confidence: 0.92 },
    { name: 'Right_Eye', x: baseX + 3, y: baseY - 51, confidence: 0.92 },
    { name: 'Left_Ear', x: baseX - 7, y: baseY - 49, confidence: 0.88 },
    { name: 'Right_Ear', x: baseX + 7, y: baseY - 49, confidence: 0.88 },
    { name: 'Left_Shoulder', x: baseX - 16 - chestExpansion, y: baseY - 34, confidence: 0.96 },
    { name: 'Right_Shoulder', x: baseX + 16 + chestExpansion, y: baseY - 34, confidence: 0.96 },
    { name: 'Left_Elbow', x: baseX - 22 + armSwing, y: baseY - 18, confidence: 0.91 },
    { name: 'Right_Elbow', x: baseX + 22 - armSwing, y: baseY - 18, confidence: 0.91 },
    { name: 'Left_Wrist', x: baseX - 25 + armSwing * 1.3, y: baseY - 2, confidence: 0.85 },
    { name: 'Right_Wrist', x: baseX + 25 - armSwing * 1.3, y: baseY - 2, confidence: 0.85 },
    { name: 'Left_Hip', x: baseX - 11, y: baseY + 4, confidence: 0.94 },
    { name: 'Right_Hip', x: baseX + 11, y: baseY + 4, confidence: 0.94 },
    { name: 'Left_Knee', x: baseX - 13 + legSwing, y: baseY + 26, confidence: 0.92 },
    { name: 'Right_Knee', x: baseX + 13 - legSwing, y: baseY + 26, confidence: 0.92 },
    { name: 'Left_Ankle', x: baseX - 15 + legSwing * 1.4, y: baseY + 48, confidence: 0.89 },
    { name: 'Right_Ankle', x: baseX + 15 - legSwing * 1.4, y: baseY + 48, confidence: 0.89 },
  ];

  return {
    joints,
    uvSegments: DENSEPOSE_SMPL_PARTS.map((p) => ({
      partId: p.id,
      name: p.name,
      color: p.color,
      areaPercent: Math.round(8 + Math.random() * 4),
    })),
    isLocked: true,
    posture: isWalking ? 'Em Pé (Caminhando)' : 'Imóvel (Respirando)',
  };
}

// ==========================================
// 4. MODELOS DE RECONHECIMENTO ESTILO BETTERCAP
// ==========================================

export interface BettercapWifiAp {
  bssid: string;
  essid: string;
  channel: number;
  frequencyGhz: string;
  rssiDbm: number;
  encryption: 'WPA3-SAE' | 'WPA2-PSK' | 'OPEN';
  vendor: string;
  clientsCount: number;
  csiCapable: boolean;
  lastSeenSecAgo: number;
}

export interface BettercapEventStreamItem {
  id: string;
  timestamp: string;
  tag: 'wifi.ap.new' | 'wifi.client.probe' | 'csi.disturbance' | 'densepose.locked' | 'radar.tripwire';
  level: 'info' | 'warning' | 'critical';
  message: string;
  rawPayload?: string;
}

export const INITIAL_BETTERCAP_APS: BettercapWifiAp[] = [
  {
    bssid: 'DC:A6:32:8B:10:4A',
    essid: 'Jjy-Tactical-AP',
    channel: 36,
    frequencyGhz: '5.180 GHz (UNII-1)',
    rssiDbm: -48,
    encryption: 'WPA3-SAE',
    vendor: 'GL.iNet / Espressif',
    clientsCount: 4,
    csiCapable: true,
    lastSeenSecAgo: 1,
  },
  {
    bssid: '74:83:C2:59:E1:90',
    essid: 'RuView-Sensor-Node-01',
    channel: 36,
    frequencyGhz: '5.180 GHz',
    rssiDbm: -56,
    encryption: 'WPA2-PSK',
    vendor: 'Espressif ESP32-S3',
    clientsCount: 1,
    csiCapable: true,
    lastSeenSecAgo: 2,
  },
  {
    bssid: 'A4:C3:F0:12:88:62',
    essid: 'Neighbor-5G-Home',
    channel: 149,
    frequencyGhz: '5.745 GHz',
    rssiDbm: -82,
    encryption: 'WPA2-PSK',
    vendor: 'TP-Link Corporation',
    clientsCount: 2,
    csiCapable: false,
    lastSeenSecAgo: 14,
  },
];

// ==========================================
// 5. RADAR & DETECÇÃO DE INTRUSOS
// ==========================================

export type IntruderClassification = 'HUMAN_WALKING' | 'HUMAN_BREATHING' | 'PET_ANIMAL' | 'ENVIRONMENTAL_NOISE';

export interface DetectedRadarTarget {
  id: string;
  label: string;
  xMeters: number;
  yMeters: number;
  isBehindWall: boolean;
  velocityMps: number;
  dopplerShiftHz: number;
  csiVariancePercent: number;
  classification: IntruderClassification;
  confidencePercent: number;
  breathingRateBpm?: number;
  lastDetectedMsAgo: number;
}

export interface IntruderAlarmEvent {
  id: string;
  timestamp: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
  targetCoords: { x: number; y: number };
  dopplerShiftHz: number;
  csiPerturbation: number;
  classification: IntruderClassification;
}

export interface WifiSensingNode {
  id: string;
  name: string;
  role: 'AP_TRANSMITTER' | 'RX_RECEIVER' | 'CLIENT_STATION';
  xMeters: number;
  yMeters: number;
  band: '2.4 GHz' | '5 GHz' | '6 GHz';
  channel: number;
  status: 'active' | 'calibrating' | 'idle';
}

export const INITIAL_SENSING_NODES: WifiSensingNode[] = [
  {
    id: 'ap_master',
    name: 'Roteador Wi-Fi 7 Master (AP TX)',
    role: 'AP_TRANSMITTER',
    xMeters: 1.2,
    yMeters: 1.0,
    band: '5 GHz',
    channel: 36,
    status: 'active',
  },
  {
    id: 'node_rx1',
    name: 'Repetidor Sensor RX-1',
    role: 'RX_RECEIVER',
    xMeters: 6.8,
    yMeters: 1.2,
    band: '5 GHz',
    channel: 36,
    status: 'active',
  },
  {
    id: 'node_rx2',
    name: 'Repetidor Sensor RX-2 (Atrás da Parede)',
    role: 'RX_RECEIVER',
    xMeters: 6.8,
    yMeters: 5.0,
    band: '5 GHz',
    channel: 36,
    status: 'active',
  },
  {
    id: 'client_mesh',
    name: 'Nó Cliente Mesh (Jjy Host)',
    role: 'CLIENT_STATION',
    xMeters: 1.5,
    yMeters: 4.8,
    band: '5 GHz',
    channel: 36,
    status: 'active',
  },
];

// ==========================================
// 6. CÁLCULO DOPPLER & CSI SUBCARRIER
// ==========================================

export function calculateDopplerShiftHz(velocityMps: number, carrierFreqGhz = 5.0): number {
  const c = 299792458;
  const fc = carrierFreqGhz * 1e9;
  const fd = (2 * velocityMps * fc) / c;
  return Math.round(fd * 10) / 10;
}

export function generateCsiSubcarrierProfile(disturbanceLevel: number): {
  subcarriers: number[];
  phasesRad: number[];
} {
  const subcarriers: number[] = [];
  const phasesRad: number[] = [];
  const baseNoise = disturbanceLevel * 0.4;

  for (let i = 0; i < 64; i++) {
    const baseAmp = 35 + Math.sin(i * 0.15) * 12 + Math.cos(i * 0.3) * 6;
    const ripple = (Math.random() - 0.5) * baseNoise * 15;
    subcarriers.push(Math.max(5, Math.round(baseAmp + ripple)));

    const basePhase = (i / 64) * Math.PI * 2 - Math.PI;
    const phaseJitter = (Math.random() - 0.5) * baseNoise * 0.8;
    phasesRad.push(Math.round((basePhase + phaseJitter) * 100) / 100);
  }

  return { subcarriers, phasesRad };
}

// ==========================================
// 7. FIRMWARE ESP32-S3 RUVIEW CSI CAPTURE
// ==========================================

export const RUVIEW_ESP32_CSI_SKETCH = `/*
 * RUVIEW ESP32-S3 CSI HARVESTER FIRMWARE
 * Baseado no pipeline do projeto RuView (https://github.com/ruvnet/RuView)
 * Captura dados de Channel State Information (CSI) das subportadoras Wi-Fi
 * e faz streaming via USB Serial (921600 bps) para inferencia DensePose.
 */

#include <stdio.h>
#include "esp_wifi.h"
#include "esp_event.h"
#include "nvs_flash.h"
#include "esp_log.h"

#define CSI_FRAME_HEADER "RUVIEW_CSI"

void wifi_csi_rx_callback(void *ctx, wifi_csi_info_t *info) {
  if (!info || !info->buf) return;

  wifi_csi_data_t *csi_data = &info->len;
  int8_t *csi_buf = (int8_t *)info->buf;

  // Header de pacote RuView para o Jjy
  printf("%s,%02X:%02X:%02X:%02X:%02X:%02X,%d,%d,%d,",
         CSI_FRAME_HEADER,
         info->mac[0], info->mac[1], info->mac[2],
         info->mac[3], info->mac[4], info->mac[5],
         info->rx_ctrl.rssi,
         info->rx_ctrl.channel,
         info->len);

  // Imprime amplitudes I e Q das 64 subportadoras OFDM:
  for (int i = 0; i < info->len; i++) {
    printf("%d ", csi_buf[i]);
  }
  printf("\\n");
}

void setup_ruview_csi() {
  nvs_flash_init();
  wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
  esp_wifi_init(&cfg);
  esp_wifi_set_mode(WIFI_MODE_STA);
  esp_wifi_start();

  // Ativacao do CSI Hardware Sensing
  wifi_csi_config_t csi_config = {
    .lltf_en = true,
    .htltf_en = true,
    .stbc_htltf2_en = true,
    .ltf_merge_en = true,
    .channel_filter_en = false,
    .manu_scale = false,
    .shift = false,
  };

  esp_wifi_set_csi_config(&csi_config);
  esp_wifi_set_csi_rx_cb(wifi_csi_rx_callback, NULL);
  esp_wifi_set_csi(true);
}
`;

// ==========================================
// 8. REDES WI-FI E DISPOSITIVOS CONECTADOS
// ==========================================

export interface WifiNetwork {
  id: string;
  ssid: string;
  bssid: string;
  rssiDbm: number;
  channel: number;
  frequencyGhz: string;
  security: 'WPA3-Personal' | 'WPA2-PSK' | 'OPEN' | 'WPA3-Enterprise';
  qualityPercent: number;
  isConnected: boolean;
  ipSubnet: string;
  gatewayIp: string;
  generation: WifiGeneration;
  phyMode: string;
}

export type DeviceRole = 'TX_TRANSMITTER' | 'RX_RECEIVER' | 'TARGET_MONITORED' | 'MESH_STATION' | 'IDLE';

export interface WifiDiscoveredDevice {
  id: string;
  name: string;
  ip: string;
  mac: string;
  vendor: string;
  deviceType: 'router' | 'esp32_sensor' | 'smartphone' | 'laptop' | 'iot' | 'mesh_node';
  rssiDbm: number;
  channel: number;
  band: '2.4 GHz' | '5 GHz' | '6 GHz';
  csiCapable: boolean;
  role: DeviceRole;
  distanceMeters: number;
  linkSpeedMbps: number;
  txPowerDbm: number;
  csiPacketRateHz: number;
  isOnline: boolean;
  xMeters: number;
  yMeters: number;
  zMeters: number;
  lastSeenSecAgo: number;
  statusNote: string;
}

export interface WifiRadarPair {
  txDeviceId: string;
  rxDeviceId: string;
  fresnelZoneRadiusMeters: number;
  carrierFreqGhz: number;
  subcarriersCount: number;
  snrDb: number;
  coherenceBandwidthMhz: number;
  pathLossDb: number;
  activeDistanceMeters: number;
  csiDisturbanceScore: number;
}

export interface UserRouterProfile {
  id: string;
  name: string;
  ssid: string;
  gatewayIp: string;
  mac: string;
  vendor: string;
  band: '2.4 GHz' | '5 GHz' | '6 GHz';
  channel: number;
  txPowerDbm: number;
  csiSupported: boolean;
  xMeters: number;
  yMeters: number;
  zMeters: number;
  isAutoDetected: boolean;
}

export const COMMON_ROUTER_GATEWAYS = [
  { ip: '192.168.1.1', desc: 'Padrão Mais Comum (TP-Link, Asus, Vivo Fibra, Netgear, Zyxel)' },
  { ip: '192.168.0.1', desc: 'Padrão Comum (Claro / Net Virtua, D-Link, TP-Link)' },
  { ip: '192.168.15.1', desc: 'Vivo Fibra HGU (Mitrastar / Askey)' },
  { ip: '192.168.18.1', desc: 'Oi Fibra / ZTE / Huawei' },
  { ip: '192.168.3.1', desc: 'Huawei / Honor / Roteadores Mesh' },
  { ip: '10.0.0.1', desc: 'MikroTik / Apple AirPort / Redes Empresariais' },
  { ip: '192.168.8.1', desc: 'GL.iNet / Modems 4G/5G / OpenWrt' },
  { ip: '192.168.100.1', desc: 'Modems Fibra Óptica GPON' },
];

export function deriveGatewayFromLocalIp(localIp: string): string {
  if (!localIp || typeof localIp !== 'string') return '192.168.1.1';
  const parts = localIp.trim().split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.1`;
  }
  return '192.168.1.1';
}

export const INITIAL_WIFI_NETWORKS: WifiNetwork[] = [
  {
    id: 'net_user_own',
    ssid: 'Meu Roteador Wi-Fi (Rede Pessoal)',
    bssid: 'E8:48:B8:31:AA:01',
    rssiDbm: -36,
    channel: 36,
    frequencyGhz: '5.180 GHz (UNII-1)',
    security: 'WPA3-Personal',
    qualityPercent: 99,
    isConnected: true,
    ipSubnet: '192.168.1.0/24',
    gatewayIp: '192.168.1.1',
    generation: 'wifi6_ax',
    phyMode: '802.11ax (Roteador Pessoal)',
  },
  {
    id: 'net_01',
    ssid: 'Jjy-Tactical-Mesh-5G',
    bssid: 'DC:A6:32:8B:10:4A',
    rssiDbm: -45,
    channel: 36,
    frequencyGhz: '5.180 GHz (UNII-1)',
    security: 'WPA3-Personal',
    qualityPercent: 96,
    isConnected: false,
    ipSubnet: '192.168.8.0/24',
    gatewayIp: '192.168.8.1',
    generation: 'wifi7_be',
    phyMode: '802.11be (MLO 160MHz)',
  },
  {
    id: 'net_02',
    ssid: 'RuView-Sensing-Direct',
    bssid: '74:83:C2:59:E1:90',
    rssiDbm: -54,
    channel: 44,
    frequencyGhz: '5.220 GHz',
    security: 'WPA2-PSK',
    qualityPercent: 88,
    isConnected: false,
    ipSubnet: '192.168.4.0/24',
    gatewayIp: '192.168.4.1',
    generation: 'wifi6_ax',
    phyMode: '802.11ax (80MHz CSI)',
  },
  {
    id: 'net_03',
    ssid: 'GL.iNet-Flint-Tactical',
    bssid: '94:83:C4:1A:22:8F',
    rssiDbm: -61,
    channel: 149,
    frequencyGhz: '5.745 GHz',
    security: 'WPA3-Personal',
    qualityPercent: 79,
    isConnected: false,
    ipSubnet: '192.168.10.0/24',
    gatewayIp: '192.168.10.1',
    generation: 'wifi6_ax',
    phyMode: '802.11ax (160MHz)',
  },
  {
    id: 'net_04',
    ssid: 'Lab-Starlink-Gateway',
    bssid: '00:26:86:F0:3B:11',
    rssiDbm: -68,
    channel: 6,
    frequencyGhz: '2.437 GHz',
    security: 'WPA2-PSK',
    qualityPercent: 71,
    isConnected: false,
    ipSubnet: '192.168.1.0/24',
    gatewayIp: '192.168.1.1',
    generation: 'wifi5_ac',
    phyMode: '802.11ac (40MHz)',
  },
  {
    id: 'net_05',
    ssid: 'Field-Node-Emergency-2.4',
    bssid: 'E0:5A:1B:44:09:A1',
    rssiDbm: -76,
    channel: 11,
    frequencyGhz: '2.462 GHz',
    security: 'OPEN',
    qualityPercent: 55,
    isConnected: false,
    ipSubnet: '10.0.0.0/24',
    gatewayIp: '10.0.0.1',
    generation: 'wifi4_n',
    phyMode: '802.11n (20MHz Long-Range)',
  },
];

export const INITIAL_DISCOVERED_DEVICES: WifiDiscoveredDevice[] = [
  {
    id: 'dev_user_router',
    name: 'Meu Roteador Wi-Fi (Gateway Local)',
    ip: '192.168.1.1',
    mac: 'E8:48:B8:31:AA:01',
    vendor: 'Meu Roteador Pessoal (TP-Link / Asus / Vivo / Claro)',
    deviceType: 'router',
    rssiDbm: -36,
    channel: 36,
    band: '5 GHz',
    csiCapable: true,
    role: 'TX_TRANSMITTER',
    distanceMeters: 1.2,
    linkSpeedMbps: 1200,
    txPowerDbm: 23,
    csiPacketRateHz: 250,
    isOnline: true,
    xMeters: 1.2,
    yMeters: 1.0,
    zMeters: 1.5,
    lastSeenSecAgo: 0,
    statusNote: 'Seu roteador físico conectado como nó Emissor TX primário do radar holográfico.',
  },
  {
    id: 'dev_ap_router',
    name: 'GL.iNet Flint-2 (Roteador AP Master)',
    ip: '192.168.8.1',
    mac: 'DC:A6:32:8B:10:4A',
    vendor: 'GL Technologies (OpenWrt)',
    deviceType: 'router',
    rssiDbm: -42,
    channel: 36,
    band: '5 GHz',
    csiCapable: true,
    role: 'IDLE',
    distanceMeters: 1.56,
    linkSpeedMbps: 2400,
    txPowerDbm: 24,
    csiPacketRateHz: 250,
    isOnline: true,
    xMeters: 1.2,
    yMeters: 1.0,
    zMeters: 1.6,
    lastSeenSecAgo: 0,
    statusNote: 'Nó Roteador secundário disponível para mesh ou repetição.',
  },
  {
    id: 'dev_esp32_rx1',
    name: 'ESP32-S3 RuView Alpha (Sensor CSI)',
    ip: '192.168.8.142',
    mac: '74:83:C2:59:E1:90',
    vendor: 'Espressif Systems',
    deviceType: 'esp32_sensor',
    rssiDbm: -54,
    channel: 36,
    band: '5 GHz',
    csiCapable: true,
    role: 'RX_RECEIVER',
    distanceMeters: 6.88,
    linkSpeedMbps: 150,
    txPowerDbm: 18,
    csiPacketRateHz: 500,
    isOnline: true,
    xMeters: 6.8,
    yMeters: 5.0,
    zMeters: 1.2,
    lastSeenSecAgo: 1,
    statusNote: 'Nó Receptor RX Primário. Coleta matriz H(f) de 64 subportadoras atrás da parede.',
  },
  {
    id: 'dev_esp32_rx2',
    name: 'ESP32-S3 RuView Beta (Repetidor Lateral)',
    ip: '192.168.8.143',
    mac: '74:83:C2:59:E2:11',
    vendor: 'Espressif Systems',
    deviceType: 'esp32_sensor',
    rssiDbm: -58,
    channel: 36,
    band: '5 GHz',
    csiCapable: true,
    role: 'MESH_STATION',
    distanceMeters: 5.61,
    linkSpeedMbps: 150,
    txPowerDbm: 18,
    csiPacketRateHz: 400,
    isOnline: true,
    xMeters: 6.8,
    yMeters: 1.2,
    zMeters: 1.2,
    lastSeenSecAgo: 1,
    statusNote: 'Sensor auxiliar para triangulação bi-estática e eliminação de sombras.',
  },
  {
    id: 'dev_phone_user',
    name: 'Galaxy S24 Ultra (Terminal do Operador)',
    ip: '192.168.8.105',
    mac: '3C:A0:67:84:DE:21',
    vendor: 'Samsung Mobile',
    deviceType: 'smartphone',
    rssiDbm: -48,
    channel: 36,
    band: '5 GHz',
    csiCapable: true,
    role: 'IDLE',
    distanceMeters: 3.52,
    linkSpeedMbps: 1800,
    txPowerDbm: 20,
    csiPacketRateHz: 120,
    isOnline: true,
    xMeters: 1.5,
    yMeters: 4.5,
    zMeters: 1.0,
    lastSeenSecAgo: 2,
    statusNote: 'Dispositivo cliente móvel com suporte a Wi-Fi 7 MLO.',
  },
  {
    id: 'dev_laptop_jjy',
    name: 'ThinkPad X1 Carbon (Console Jjy Host)',
    ip: '192.168.8.100',
    mac: '00:28:F8:3C:99:4B',
    vendor: 'Lenovo / Intel AX211',
    deviceType: 'laptop',
    rssiDbm: -46,
    channel: 36,
    band: '5 GHz',
    csiCapable: true,
    role: 'IDLE',
    distanceMeters: 1.62,
    linkSpeedMbps: 1200,
    txPowerDbm: 20,
    csiPacketRateHz: 200,
    isOnline: true,
    xMeters: 1.8,
    yMeters: 2.5,
    zMeters: 0.9,
    lastSeenSecAgo: 0,
    statusNote: 'Placa Intel AX211 pronta para amostragem nativa de CSI via Linux/Windows driver.',
  },
  {
    id: 'dev_target_intruder',
    name: 'iPhone 15 Pro Max (Alvo Suspeito / Intruso)',
    ip: '192.168.8.118',
    mac: 'F0:18:98:C3:5A:88',
    vendor: 'Apple Inc.',
    deviceType: 'smartphone',
    rssiDbm: -67,
    channel: 36,
    band: '5 GHz',
    csiCapable: true,
    role: 'TARGET_MONITORED',
    distanceMeters: 4.85,
    linkSpeedMbps: 866,
    txPowerDbm: 16,
    csiPacketRateHz: 60,
    isOnline: true,
    xMeters: 4.5,
    yMeters: 3.8,
    zMeters: 1.1,
    lastSeenSecAgo: 1,
    statusNote: 'Dispositivo interceptado no perímetro interno. Emite sondas Wi-Fi mesmo em repouso.',
  },
  {
    id: 'dev_iot_cam',
    name: 'Câmera IP Tuya IoT (Atrás da Parede)',
    ip: '192.168.8.204',
    mac: 'D8:1F:12:AA:77:43',
    vendor: 'Tuya Smart IoT',
    deviceType: 'iot',
    rssiDbm: -72,
    channel: 36,
    band: '5 GHz',
    csiCapable: false,
    role: 'IDLE',
    distanceMeters: 5.2,
    linkSpeedMbps: 72,
    txPowerDbm: 14,
    csiPacketRateHz: 0,
    isOnline: true,
    xMeters: 5.5,
    yMeters: 4.2,
    zMeters: 2.2,
    lastSeenSecAgo: 5,
    statusNote: 'Dispositivo IoT padrão. Não suporta leitura de subportadoras CSI.',
  },
  {
    id: 'dev_esp32_doppler',
    name: 'ESP32-C6 Sensor Radar Doppler',
    ip: '192.168.8.150',
    mac: '74:83:C2:77:19:0B',
    vendor: 'Espressif Systems (Wi-Fi 6 + Zigbee)',
    deviceType: 'esp32_sensor',
    rssiDbm: -60,
    channel: 36,
    band: '2.4 GHz',
    csiCapable: true,
    role: 'IDLE',
    distanceMeters: 4.1,
    linkSpeedMbps: 150,
    txPowerDbm: 19,
    csiPacketRateHz: 300,
    isOnline: true,
    xMeters: 3.5,
    yMeters: 5.5,
    zMeters: 1.0,
    lastSeenSecAgo: 2,
    statusNote: 'Sensor com banda estreita para detecção de micro-vibração respiratória.',
  },
];

// ==========================================
// 9. CÁLCULOS FÍSICOS DE FRESNEL E ENLACE
// ==========================================

/**
 * Calcula o raio da 1ª Zona de Fresnel entre dois pontos no espaço
 * Fórmula: r = sqrt( (lambda * d1 * d2) / (d1 + d2) )
 */
export function calculateFresnelRadius(
  d1Meters: number,
  d2Meters: number,
  totalDistMeters: number,
  freqGhz = 5.0
): number {
  if (totalDistMeters <= 0.05) return 0.1;
  const c = 299792458;
  const lambda = c / (freqGhz * 1e9);
  const r = Math.sqrt((lambda * d1Meters * d2Meters) / totalDistMeters);
  return Math.round(r * 100) / 100;
}

/**
 * Calcula a distância euclidiana entre dois pontos (x1, y1) e (x2, y2)
 */
export function calculateEuclideanDistance(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.round(Math.sqrt(dx * dx + dy * dy) * 100) / 100;
}

/**
 * Estima a atenuação de trajeto em dB (Log-Distance Path Loss Model)
 */
export function calculatePathLossDb(
  distMeters: number,
  freqGhz = 5.0,
  wallLossDb = 0
): number {
  if (distMeters <= 0.5) return 20 + wallLossDb;
  // Perda em espaço livre em 1m: 20*log10(d) + 20*log10(f) + 32.44
  const fspl1m = 20 * Math.log10(freqGhz * 1000) - 27.55;
  const pathLoss = fspl1m + 28 * Math.log10(distMeters) + wallLossDb;
  return Math.round(pathLoss * 10) / 10;
}

/**
 * Estima a distância em metros a partir do RSSI e da potência de transmissão
 */
export function estimateDistanceMeters(
  rssiDbm: number,
  txPowerDbm = 20,
  pathLossExponent = 2.6
): number {
  const ratio = (txPowerDbm - rssiDbm - 40) / (10 * pathLossExponent);
  const distance = Math.pow(10, ratio);
  return Math.round(Math.min(30, Math.max(0.3, distance)) * 10) / 10;
}

/**
 * Calcula a perturbação no enlace de rádio baseada na proximidade do alvo à linha de visada TX->RX
 */
export function calculateLineDisturbance(
  txPos: { x: number; y: number },
  rxPos: { x: number; y: number },
  targetPos: { x: number; y: number },
  fresnelRadius = 0.35
): {
  distanceToBeamM: number;
  isIntersectingFresnel: boolean;
  perturbationScore: number;
} {
  // Distância ponto à reta (vetor TX -> RX)
  const dx = rxPos.x - txPos.x;
  const dy = rxPos.y - txPos.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    const dist = calculateEuclideanDistance(targetPos, txPos);
    return {
      distanceToBeamM: dist,
      isIntersectingFresnel: dist < fresnelRadius,
      perturbationScore: Math.max(10, Math.round((1 - dist / 5) * 100)),
    };
  }

  // Projeção escalar t sobre o segmento
  const t = Math.max(0, Math.min(1, ((targetPos.x - txPos.x) * dx + (targetPos.y - txPos.y) * dy) / lenSq));
  const projX = txPos.x + t * dx;
  const projY = txPos.y + t * dy;

  const distanceToBeam = calculateEuclideanDistance(targetPos, { x: projX, y: projY });
  const isIntersecting = distanceToBeam <= fresnelRadius * 1.8;

  let disturbance = 20;
  if (isIntersecting) {
    // Proximidade imediata ao feixe gera distorção maciça
    const factor = Math.max(0, 1 - distanceToBeam / (fresnelRadius * 2));
    disturbance = Math.round(55 + factor * 43);
  } else if (distanceToBeam < fresnelRadius * 4) {
    const factor = Math.max(0, 1 - distanceToBeam / (fresnelRadius * 4));
    disturbance = Math.round(25 + factor * 30);
  }

  return {
    distanceToBeamM: distanceToBeam,
    isIntersectingFresnel: isIntersecting,
    perturbationScore: Math.min(99, Math.max(15, disturbance)),
  };
}

// ==========================================
// 10. ECOSSISTEMA COMPLETO RUVIEW (COMMIT 407b46b)
// ==========================================

// --- SINAIS VITAIS (BREATHING & HEART RATE) ---
export interface VitalSignsReading {
  personId: string;
  label: string;
  breathingRateBpm: number;
  breathingWaveform: number[];
  heartRateBpm: number;
  cardiacWaveform: number[];
  breathingSnrDb: number;
  heartRateSnrDb: number;
  status: 'NORMAL' | 'TACHYPNEA' | 'BRADYPNEA' | 'TACHYCARDIA' | 'BRADYCARDIA' | 'APNEA_ALERT';
  triageClassification?: 'IMMEDIATE_RED' | 'DELAYED_YELLOW' | 'MINOR_GREEN' | 'EXPECTANT_BLACK';
}

/**
 * Gera leituras e ondas senoidais em tempo real para pneumograma (0.1-0.5 Hz)
 * e balistocardiograma micro-Doppler (0.8-2.0 Hz)
 */
export function generateVitalSignsReading(
  timeSec: number,
  personId = 'person_01',
  label = 'Alvo Monitorado',
  baseBreathing = 16,
  baseHeart = 72
): VitalSignsReading {
  const breathingFreq = baseBreathing / 60;
  const heartFreq = baseHeart / 60;

  const breathingWaveform: number[] = [];
  const cardiacWaveform: number[] = [];

  for (let i = 0; i < 40; i++) {
    const t = timeSec - (40 - i) * 0.05;
    // Onda respiratória (diafragma / expansão torácica)
    const breathVal = Math.sin(t * breathingFreq * Math.PI * 2) * 45 + Math.sin(t * breathingFreq * 4) * 8;
    breathingWaveform.push(Math.round(breathVal * 10) / 10);

    // Onda micro-Doppler cardíaca (QRS / ejeção aórtica)
    const heartVal =
      Math.sin(t * heartFreq * Math.PI * 2) * 28 +
      Math.sin(t * heartFreq * 4 * Math.PI) * 12 +
      (Math.random() - 0.5) * 4;
    cardiacWaveform.push(Math.round(heartVal * 10) / 10);
  }

  let status: VitalSignsReading['status'] = 'NORMAL';
  if (baseBreathing < 10) status = 'BRADYPNEA';
  else if (baseBreathing > 25) status = 'TACHYPNEA';
  else if (baseHeart > 100) status = 'TACHYCARDIA';
  else if (baseHeart < 50) status = 'BRADYCARDIA';

  return {
    personId,
    label,
    breathingRateBpm: Math.round(baseBreathing),
    breathingWaveform,
    heartRateBpm: Math.round(baseHeart),
    cardiacWaveform,
    breathingSnrDb: 14.8,
    heartRateSnrDb: 11.2,
    status,
  };
}

// --- REDE MESH MULTISTÁTICA (ADR-029 RuvSense) ---
export interface MultistaticMeshLink {
  id: string;
  txDeviceId: string;
  rxDeviceId: string;
  txDeviceName: string;
  rxDeviceName: string;
  channel: 1 | 6 | 11;
  virtualSubcarriersCount: 168; // 3 canais x 56 subportadoras
  attenuationDb: number;
  phaseCoherence: number;
  isIntersected: boolean;
  status: 'ACTIVE' | 'DEGRADED' | 'STANDBY';
}

export type CoherenceGateState = 'ACCEPT' | 'PREDICT_ONLY' | 'REJECT' | 'RECALIBRATE';

export function generateMultistaticLinks(
  nodes: WifiDiscoveredDevice[],
  targetPos: { x: number; y: number }
): {
  links: MultistaticMeshLink[];
  totalVirtualSubcarriers: number;
  coherenceGate: CoherenceGateState;
  activeCount: number;
} {
  const links: MultistaticMeshLink[] = [];
  const channels: (1 | 6 | 11)[] = [1, 6, 11];

  for (let i = 0; i < nodes.length; i++) {
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const tx = nodes[i];
      const rx = nodes[j];
      const linkId = `${tx.id}_to_${rx.id}`;
      const ch = channels[(i + j) % channels.length];

      const dist = calculateEuclideanDistance(
        { x: tx.xMeters, y: tx.yMeters },
        { x: rx.xMeters, y: rx.yMeters }
      );
      const fresnelR = calculateFresnelRadius(dist / 2, dist / 2, dist, 5.0);
      const disturbance = calculateLineDisturbance(
        { x: tx.xMeters, y: tx.yMeters },
        { x: rx.xMeters, y: rx.yMeters },
        targetPos,
        fresnelR
      );

      links.push({
        id: linkId,
        txDeviceId: tx.id,
        rxDeviceId: rx.id,
        txDeviceName: tx.name,
        rxDeviceName: rx.name,
        channel: ch,
        virtualSubcarriersCount: 168,
        attenuationDb: calculatePathLossDb(dist, 5.0, 4.0),
        phaseCoherence: Math.round((0.85 + Math.random() * 0.14) * 100) / 100,
        isIntersected: disturbance.isIntersectingFresnel,
        status: 'ACTIVE',
      });
    }
  }

  return {
    links,
    totalVirtualSubcarriers: links.length * 168,
    coherenceGate: 'ACCEPT',
    activeCount: links.length,
  };
}

// --- PERSISTENT FIELD MODEL & 7 EXOTIC SENSING TIERS (ADR-030) ---
export interface ExoticSensingTier {
  tierNumber: number;
  name: string;
  codename: string;
  description: string;
  activeValue: string;
  metric: string;
  status: 'OPTIMAL' | 'ACTIVE' | 'CALIBRATING';
}

export const RUVIEW_EXOTIC_TIERS: ExoticSensingTier[] = [
  {
    tierNumber: 1,
    name: 'Field Normal Modes',
    codename: 'SVD_EIGENSTRUCTURE',
    description: 'Decomposição SVD da resposta ao impulso eletromagnético da sala para isolar o corpo do ambiente.',
    activeValue: 'λ₁=48.2, λ₂=22.1, λ₃=9.4 (98% Energia)',
    metric: 'Autovalores de Espaço',
    status: 'OPTIMAL',
  },
  {
    tierNumber: 2,
    name: 'Coarse RF Tomography',
    codename: 'VOXEL_GRID_3D',
    description: 'Reconstrução volumétrica 3D da atenuação de rádio em voxels de 20cm através de paredes.',
    activeValue: '64 Voxels Ativos | Resolução 30mm RMS',
    metric: 'Voxel Density Index',
    status: 'OPTIMAL',
  },
  {
    tierNumber: 3,
    name: 'Intention Lead Signals',
    codename: 'PRE_MOVEMENT_LEAD',
    description: 'Detecção de micro-deslocamento postural e intenção motora 200 a 500 ms antes da caminhada física.',
    activeValue: 'Lead de 320ms detectado no centro de massa',
    metric: 'Antecipação Motora (ms)',
    status: 'ACTIVE',
  },
  {
    tierNumber: 4,
    name: 'Longitudinal Biomechanics',
    codename: 'GAIT_CADENCE_DRIFT',
    description: 'Monitoramento da biomecânica da marcha humana e cadência de passos ao longo de dias ou semanas.',
    activeValue: 'Cadência: 104 passos/min | Assimetria: 2.1%',
    metric: 'Estabilidade Biomecânica',
    status: 'OPTIMAL',
  },
  {
    tierNumber: 5,
    name: 'Cross-Room Continuity',
    codename: 'AETHER_PERSISTENT_ID',
    description: 'Preservação de identidade contínua de pessoas ao se moverem entre múltiplos cômodos sem câmeras.',
    activeValue: 'Zero Trocas de ID (100% Retenção em 10 min)',
    metric: 'AETHER Re-ID Score',
    status: 'OPTIMAL',
  },
  {
    tierNumber: 6,
    name: 'Invisible Interaction / Gestures',
    codename: 'MICRO_DOPPLER_GESTURES',
    description: 'Reconhecimento de gestos corporais invisíveis (empurrar, acenar, girar a mão) sem contato físico.',
    activeValue: 'Gesto Ativo: SWIPE_DIREITA (Confiança 94%)',
    metric: 'Micro-Doppler FFT Peak',
    status: 'ACTIVE',
  },
  {
    tierNumber: 7,
    name: 'Adversarial & Jamming Detection',
    codename: 'RF_PHYSICS_SANITY',
    description: 'Verificação de integridade física da portadora para bloquear ataques de replay de pacotes ou ruído falso.',
    activeValue: 'Sinal Limpo | Sem Injeção Não-Física',
    metric: 'SipHash Integrity OK',
    status: 'OPTIMAL',
  },
];

// --- MÓDULO DE DESASTRES E RESGATE START (WIFI-MAT ADR-001) ---
export interface DisasterSurvivorTarget {
  id: string;
  name: string;
  rubbleDepthMeters: number;
  breathingBpm: number;
  heartRateBpm: number;
  triageCategory: 'IMMEDIATE_RED' | 'DELAYED_YELLOW' | 'MINOR_GREEN' | 'EXPECTANT_BLACK';
  triageReason: string;
  xMeters: number;
  yMeters: number;
  zMeters: number;
  movementDetected: boolean;
}

export const INITIAL_DISASTER_SURVIVORS: DisasterSurvivorTarget[] = [
  {
    id: 'survivor_01',
    name: 'Vítima A (Sob Concreto 30cm)',
    rubbleDepthMeters: 1.8,
    breathingBpm: 28,
    heartRateBpm: 118,
    triageCategory: 'IMMEDIATE_RED',
    triageReason: 'Taquipneia severa e taquicardia sob escombros. Requer extração imediata.',
    xMeters: 4.5,
    yMeters: 3.8,
    zMeters: -0.6,
    movementDetected: false,
  },
  {
    id: 'survivor_02',
    name: 'Vítima B (Sob Madeira / Compensado)',
    rubbleDepthMeters: 0.9,
    breathingBpm: 16,
    heartRateBpm: 76,
    triageCategory: 'DELAYED_YELLOW',
    triageReason: 'Sinais vitais respiratórios e cardíacos estáveis. Sem risco iminente de colapso.',
    xMeters: 2.2,
    yMeters: 4.8,
    zMeters: -0.2,
    movementDetected: true,
  },
];

// --- IA AUTO-APRENDIZAGEM & FINGERPRINTS 128D (ADR-024) ---
export function generateEnvironmentFingerprint128(disturbance: number): number[] {
  const vec: number[] = [];
  for (let i = 0; i < 128; i++) {
    const v = Math.sin(i * 0.2 + disturbance * 0.05) * 0.8 + (Math.random() - 0.5) * 0.2;
    vec.push(Math.round(v * 1000) / 1000);
  }
  return vec;
}

// --- FIRMWARE EXPANDIDO RUVIEW COM TDM & HOP TABLE ---
export const RUVIEW_ESP32_TDM_MESH_SKETCH = `/*
 * RUVIEW ESP32-S3 TDM MULTISTATIC MESH FIRMWARE (Commit 407b46b)
 * Baseado no pipeline do projeto RuView (https://github.com/ruvnet/RuView)
 * Suporte a Channel Hopping nos Canais 1/6/11 (50ms dwell),
 * Injeção de NDP (Null Data Packet) e streaming CSI 168 subportadoras virtuais.
 */

#include <stdio.h>
#include "esp_wifi.h"
#include "esp_event.h"
#include "nvs_flash.h"
#include "esp_timer.h"

#define TDM_SLOT_TIME_MS 50
#define NUM_CHANNELS 3
const uint8_t HOP_CHANNELS[NUM_CHANNELS] = {1, 6, 11};
static uint8_t current_channel_idx = 0;

void timer_channel_hop_cb(void* arg) {
    current_channel_idx = (current_channel_idx + 1) % NUM_CHANNELS;
    esp_wifi_set_channel(HOP_CHANNELS[current_channel_idx], WIFI_SECOND_CHAN_NONE);
}

void wifi_csi_multistatic_cb(void *ctx, wifi_csi_info_t *info) {
    if (!info || !info->buf) return;
    int8_t *csi_buf = (int8_t *)info->buf;

    // Header RuView TDM Multistatic
    printf("RUVIEW_TDM,%02X:%02X:%02X:%02X:%02X:%02X,%d,CH%d,%d,",
           info->mac[0], info->mac[1], info->mac[2],
           info->mac[3], info->mac[4], info->mac[5],
           info->rx_ctrl.rssi,
           info->rx_ctrl.channel,
           info->len);

    for (int i = 0; i < info->len; i++) {
        printf("%d ", csi_buf[i]);
    }
    printf("\\n");
}

void init_ruview_multistatic() {
    nvs_flash_init();
    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    esp_wifi_init(&cfg);
    esp_wifi_set_mode(WIFI_MODE_STA);
    esp_wifi_start();

    // Configuracao de Coleta CSI Multistatica
    wifi_csi_config_t csi_config = {
        .lltf_en = true,
        .htltf_en = true,
        .stbc_htltf2_en = true,
        .ltf_merge_en = true,
        .channel_filter_en = false,
        .manu_scale = false,
        .shift = false,
    };
    esp_wifi_set_csi_config(&csi_config);
    esp_wifi_set_csi_rx_cb(wifi_csi_multistatic_cb, NULL);
    esp_wifi_set_csi(true);

    // Timer de 50ms para salto de canais TDM (1/6/11)
    const esp_timer_create_args_t hop_args = {
        .callback = &timer_channel_hop_cb,
        .name = "ruview_tdm_hop"
    };
    esp_timer_handle_t hop_timer;
    esp_timer_create(&hop_args, &hop_timer);
    esp_timer_start_periodic(hop_timer, TDM_SLOT_TIME_MS * 1000);
}
`;


