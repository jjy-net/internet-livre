/**
 * underwaterCommEngine.ts
 * Motor científico e de engenharia para Comunicação Subaquática (UWAC, UWOC, VLF/ELF e MI).
 * 
 * Implementa:
 * 1. Física Acústica Submarina (Equação de Mackenzie, Atenuação de Thorp, Perfil SOFAR, Perda de Propagação).
 * 2. Padrão NATO STANAG 4748 (JANUS) para descoberta e sinalização submarina interoperável.
 * 3. Comunicação Óptica Subaquática (UWOC - Blue-Green Laser/LED com modelo de Jerlov).
 * 4. Penetração Eletromagnética Submarina (VLF/ELF, Skin Depth em água salgada e Magneto-Indução MI).
 * 5. Gateway de Superfície Cross-Medium (Bóia Relé: Acústica/Óptica <-> Rádio/Satélite/Jjy Mesh).
 * 6. Síntese de Áudio Acústico via Web Audio API para transmissão e testes reais.
 * 7. Catálogo de Artigos Científicos, Padrões Militares e Projetos Oceanográficos.
 */

// ==========================================
// 1. CONSTANTES FÍSICAS E OCEANOGRÁFICAS
// ==========================================

export const OCEAN_PHYSICS = {
  DEFAULT_WATER_TEMP_C: 12.0,      // Temperatura da água em °C (média oceânica de superfície a termoclina)
  DEFAULT_SALINITY_PPT: 35.0,      // Salinidade padrão em partes por mil (ppt ou PSU)
  DEFAULT_DEPTH_METERS: 150.0,     // Profundidade do nó subaquático em metros
  WATER_SEAWATER_CONDUCTIVITY: 4.0, // Condutividade da água do mar em Siemens/metro (S/m)
  WATER_FRESHWATER_CONDUCTIVITY: 0.01, // Condutividade de água doce (S/m)
  MAGNETIC_PERMEABILITY: 4 * Math.PI * 1e-7, // Permeabilidade magnética (H/m)
  SPEED_OF_LIGHT: 299792458,       // Velocidade da luz no vácuo (m/s)
  REFRACTIVE_INDEX_WATER: 1.333,   // Índice de refração da água
};

// ==========================================
// 2. EQUAÇÕES CIENTÍFICAS DE PROPAGAÇÃO
// ==========================================

/**
 * Calcula a velocidade do som na água do mar segundo a Equação de Mackenzie (1981).
 * Válida para: Temp: 2 a 30°C, Salinidade: 25 a 40 ppt, Profundidade: 0 a 8000 m.
 * c(T, S, D) em metros por segundo (m/s).
 */
export function calculateMackenzieSoundSpeed(
  tempC: number,
  salinityPpt: number,
  depthMeters: number
): number {
  const T = Math.max(-2, Math.min(40, tempC));
  const S = Math.max(0, Math.min(45, salinityPpt));
  const D = Math.max(0, depthMeters);

  const c =
    1448.96 +
    4.591 * T -
    5.304e-2 * Math.pow(T, 2) +
    2.374e-4 * Math.pow(T, 3) +
    1.340 * (S - 35) +
    1.630e-2 * D +
    1.675e-7 * Math.pow(D, 2) -
    1.025e-2 * T * (S - 35) -
    7.139e-13 * T * Math.pow(D, 3);

  return Math.round(c * 10) / 10;
}

/**
 * Atenuação Acústica de Thorp (em dB/km) para frequências f em kHz em água do mar.
 * Baseia-se no relaxamento químico de Ácido Bórico (B(OH)3) e Sulfato de Magnésio (MgSO4).
 */
export function calculateThorpAttenuation(freqKhz: number): number {
  const f = Math.max(0.1, freqKhz);
  const f2 = f * f;

  // Fórmula simplificada de Thorp:
  const alpha =
    (0.11 * f2) / (1 + f2) +
    (44 * f2) / (4100 + f2) +
    2.75e-4 * f2 +
    0.003;

  return Math.round(alpha * 1000) / 1000;
}

/**
 * Perda de Transmissão Acústica (Transmission Loss - TL em dB) a uma distância R (metros).
 * TL = k * 10 * log10(R) + alpha * (R / 1000)
 * k = 20 para espalhamento esférico (águas profundas), k = 10 para cilíndrico (águas rasas).
 */
export function calculateAcousticTransmissionLoss(
  rangeMeters: number,
  freqKhz: number,
  isShallowWater = false
): number {
  const R = Math.max(1, rangeMeters);
  const k = isShallowWater ? 10 : 20;
  const alphaDbPerKm = calculateThorpAttenuation(freqKhz);
  const spreadingLoss = k * Math.log10(R);
  const absorptionLoss = alphaDbPerKm * (R / 1000);
  return Math.round((spreadingLoss + absorptionLoss) * 10) / 10;
}

/**
 * Efeito Pelicular / Profundidade de Penetração Eletromagnética (Skin Depth delta em metros).
 * delta = 1 / sqrt(pi * f * mu * sigma) ~= 503 / sqrt(sigma * f)
 */
export function calculateElectromagneticSkinDepth(
  freqHz: number,
  conductivitySm = OCEAN_PHYSICS.WATER_SEAWATER_CONDUCTIVITY
): number {
  if (freqHz <= 0 || conductivitySm <= 0) return 0;
  const delta = 503.29 / Math.sqrt(conductivitySm * freqHz);
  return Math.round(delta * 100) / 100;
}

/**
 * Modelos de Água Jerlov para Comunicação Óptica Subaquática (UWOC).
 * Coeficiente de atenuação de feixe c(lambda) em m^-1 para luz azul/verde (~470-520nm).
 */
export interface JerlovWaterType {
  id: string;
  name: string;
  description: string;
  extinctionCoeff: number; // m^-1
  typicalMaxRangeMeters: number; // alcance para link de ~10 Mbps
  optimalWavelengthNm: number;
}

export const JERLOV_WATER_TYPES: JerlovWaterType[] = [
  {
    id: 'jerlov_i',
    name: 'Jerlov Tipo I (Oceânica Ultra-Límpida)',
    description: 'Águas abissais profundas, oceano aberto com mínima clorofila e sem sedimentos.',
    extinctionCoeff: 0.056,
    typicalMaxRangeMeters: 85,
    optimalWavelengthNm: 470, // Azul
  },
  {
    id: 'jerlov_ii',
    name: 'Jerlov Tipo II (Oceânica Média)',
    description: 'Águas oceânicas com moderada densidade de fitoplâncton e partículas em suspensão.',
    extinctionCoeff: 0.15,
    typicalMaxRangeMeters: 45,
    optimalWavelengthNm: 488, // Azul-ciano
  },
  {
    id: 'jerlov_iii',
    name: 'Jerlov Tipo III (Água Costeira Limpa)',
    description: 'Plataforma continental com presença de matéria orgânica dissolvida (CDOM).',
    extinctionCoeff: 0.398,
    typicalMaxRangeMeters: 20,
    optimalWavelengthNm: 520, // Verde
  },
  {
    id: 'jerlov_coastal_turbid',
    name: 'Costeira Turva / Porto Fluvial',
    description: 'Águas portuárias e estuários com alta concentração de sedimentos e lama.',
    extinctionCoeff: 1.25,
    typicalMaxRangeMeters: 6,
    optimalWavelengthNm: 532, // Verde esmeralda
  },
];

/**
 * Estima a atenuação óptica e throughput para link UWOC com base na distância e tipo Jerlov.
 */
export function calculateOpticalLinkPerformance(
  rangeMeters: number,
  txPowerMilliwatts: number,
  waterType: JerlovWaterType
) {
  const c = waterType.extinctionCoeff;
  const R = Math.max(0.5, rangeMeters);
  // Perda por lei de Beer-Lambert com dispersão geométrica simplificada:
  const transmissionRatio = Math.exp(-c * R) / (R * 0.2 + 1);
  const rxPowerMw = txPowerMilliwatts * transmissionRatio;

  // Throughput estimado baseado na potência recebida
  let dataRateMbps = 0;
  if (rxPowerMw > 0.05) dataRateMbps = 50;
  else if (rxPowerMw > 0.01) dataRateMbps = 25;
  else if (rxPowerMw > 0.002) dataRateMbps = 10;
  else if (rxPowerMw > 0.0005) dataRateMbps = 2;
  else if (rxPowerMw > 0.0001) dataRateMbps = 0.5;

  return {
    rxPowerMw: Math.max(0, rxPowerMw),
    attenuationDb: Math.round(10 * Math.log10(1 / Math.max(1e-12, transmissionRatio)) * 10) / 10,
    dataRateMbps,
    isLinked: rxPowerMw > 0.0001,
  };
}

// ==========================================
// 3. PADRÃO NATO STANAG 4748 (JANUS)
// ==========================================

export interface JanusPacketHeader {
  version: number;          // 1 bit (0 = Baseline)
  appClass: number;        // 7 bits (0 = Generic, 1 = Emergency, 2 = AUV Telemetry, 3 = Chat, 4 = Gateway)
  senderId: number;        // 8 bits ID do nó
  destId: number;          // 8 bits (255 = Broadcast)
  nodeDepthMeters: number; // 8 bits (resolução 2m)
  latitudeMicro: number;   // Posição codificada
  longitudeMicro: number;
  crc16: number;           // Checksum de integridade
}

export const JANUS_SPEC = {
  STANDARD_NAME: 'NATO STANAG 4748 (JANUS)',
  CENTER_FREQ_HZ: 11520,      // 11.52 kHz
  BANDWIDTH_HZ: 4160,         // 9.44 kHz a 13.6 kHz
  CARRIER_LOWER_HZ: 9440,
  CARRIER_UPPER_HZ: 13600,
  NUM_CHIRP_SLOTS: 13,        // 13 sub-bandas FHSS
  BIT_RATE_BPS: 80,           // Taxa nominal ultra-robusta de broadcast
  PREAMBLE_SYMBOLS: 32,
  PAYLOAD_BITS: 64,
  MAX_ACOUSTIC_RANGE_KM: 12.0, // Alcance acústico nominal
};

/**
 * Cria pacote formatado compatível com JANUS STANAG 4748.
 */
export function buildJanusPacket(
  appClass: number,
  senderId: number,
  destId: number,
  depthMeters: number,
  textMessage: string
) {
  const timestamp = Date.now();
  const rawPayload = `${senderId}>${destId}|C${appClass}|D${Math.round(depthMeters)}m|${textMessage}`;
  
  // Cálculo de CRC16 simulado
  let crc = 0xffff;
  for (let i = 0; i < rawPayload.length; i++) {
    crc = ((crc >> 8) ^ (rawPayload.charCodeAt(i) & 0xff)) & 0xffff;
  }

  return {
    rawPayload,
    crcHex: crc.toString(16).toUpperCase().padStart(4, '0'),
    appClass,
    senderId,
    destId,
    depthMeters,
    timestamp,
    spec: JANUS_SPEC.STANDARD_NAME,
    freqCenterKhz: JANUS_SPEC.CENTER_FREQ_HZ / 1000,
  };
}

// ==========================================
// 4. SISTEMAS FÍSICOS E MODALIDADES DE CANAL
// ==========================================

export type SubseaPhysicalChannel = 'acoustic_janus' | 'acoustic_whoi' | 'optical_bluecomm' | 'em_vlf_elf' | 'magneto_inductive';

export interface PhysicalChannelProfile {
  id: SubseaPhysicalChannel;
  name: string;
  mediumType: 'Som (Ultrassom/Acústico)' | 'Luz (Óptico Azul/Verde)' | 'EM (VLF/ELF Militar)' | 'Campo Próximo (Magneto-Indução)';
  frequencyRange: string;
  speedOfSignal: string;
  dataRate: string;
  typicalMaxRange: string;
  penetrationDepth: string;
  idealApplication: string;
  keyChallenge: string;
}

export const PHYSICAL_CHANNELS_CATALOG: PhysicalChannelProfile[] = [
  {
    id: 'acoustic_janus',
    name: 'Acústico JANUS (NATO STANAG 4748)',
    mediumType: 'Som (Ultrassom/Acústico)',
    frequencyRange: '9.44 kHz - 13.6 kHz (Centro: 11.52 kHz)',
    speedOfSignal: '~1.500 m/s (Velocidade do som na água)',
    dataRate: '80 bps a 320 bps',
    typicalMaxRange: '5 km a 15 km (Longo alcance)',
    penetrationDepth: 'Atravessa todo o leito oceânico / termoclina',
    idealApplication: 'Descoberta interoperável, SOS militar, handshaking entre submarinos e AUVs.',
    keyChallenge: 'Altíssima latência (propagação sonora lenta), reverberação e efeito Doppler severo.',
  },
  {
    id: 'acoustic_whoi',
    name: 'Acústico WHOI Micro-Modem (Banda Média)',
    mediumType: 'Som (Ultrassom/Acústico)',
    frequencyRange: '20 kHz - 30 kHz (Ultrassom)',
    speedOfSignal: '~1.500 m/s',
    dataRate: '1.2 kbps a 5.4 kbps (PSK/DSSS)',
    typicalMaxRange: '2 km a 4 km',
    penetrationDepth: 'Totalmente submerso até fossas abissais',
    idealApplication: 'Telemetria de sensores oceanográficos, comando de ROVs/AUVs, controle DART.',
    keyChallenge: 'Atenuação crescente em altas frequências acima de 30 kHz (absorção de Thorp).',
  },
  {
    id: 'optical_bluecomm',
    name: 'Óptico Subaquático UWOC (Laser/LED 470-520nm)',
    mediumType: 'Luz (Óptico Azul/Verde)',
    frequencyRange: '470 nm (Azul) / 525 nm (Verde esmeralda)',
    speedOfSignal: '~225.000 km/s (Velocidade da luz na água: c / 1.33)',
    dataRate: '5 Mbps a 100 Mbps (Streaming de vídeo subsea)',
    typicalMaxRange: '10 m a 120 m (Curto alcance)',
    penetrationDepth: 'Visada direta (Line-of-Sight) em coluna de água',
    idealApplication: 'Docagem de AUVs, download de gigabytes de dados de sensores, inspeção de óleo & gás.',
    keyChallenge: 'Extinção drástica por turbidez, sedimentos e espalhamento de partículas (Jerlov).',
  },
  {
    id: 'em_vlf_elf',
    name: 'Eletromagnético VLF / ELF (Naval Submarine)',
    mediumType: 'EM (VLF/ELF Militar)',
    frequencyRange: 'ELF: 30-300 Hz | VLF: 10-30 kHz (Ex: 24 kHz Cutler NAA)',
    speedOfSignal: '~300.000 km/s (no ar) / reduzida na água',
    dataRate: '1 caractere a cada poucos minutos (ELF) a 50 bps (VLF)',
    typicalMaxRange: 'Global / Milhares de km (Ar até penetrar oceano)',
    penetrationDepth: 'ELF: 20-40 metros | VLF: 2-3 metros (Antena rebocada)',
    idealApplication: 'Transmissão de ordens de comando estratégico para submarinos nucleares submersos.',
    keyChallenge: 'Antenas colossais (quilômetros de cabos na superfície) e baixíssima taxa de dados.',
  },
  {
    id: 'magneto_inductive',
    name: 'Magneto-Indução (MI - Near-Field Magnetic)',
    mediumType: 'Campo Próximo (Magneto-Indução)',
    frequencyRange: '100 kHz a 1 MHz (Bobinas de indução magnética)',
    speedOfSignal: 'Quase instantâneo (campo magnético acoplado)',
    dataRate: '10 kbps a 100 kbps',
    typicalMaxRange: '5 m a 35 m',
    penetrationDepth: 'Atravessa interface ar-água, lodo e concreto sem reflexão',
    idealApplication: 'Comunicação através de cascos fechados, leito de areia submarina, e transição água-ar.',
    keyChallenge: 'Atenuação magnética cúbica com a distância (1/R³).',
  },
];

// ==========================================
// 5. NÓS DA REDE SUBMARINA & GATEWAY DE SUPERFÍCIE
// ==========================================

export type SubseaNodeType = 'submarine' | 'auv' | 'diver' | 'seafloor_sensor' | 'surface_buoy' | 'satellite' | 'coastal_station';

export interface SubseaNetworkNode {
  id: string;
  name: string;
  type: SubseaNodeType;
  depthMeters: number;
  latitude: number;
  longitude: number;
  batteryPercent: number;
  activeChannels: SubseaPhysicalChannel[];
  surfaceLinkType?: 'iridium_satellite' | 'tactical_vhf' | 'wifi_mesh' | 'none';
  status: 'online' | 'transmitting' | 'silent_running' | 'warning';
}

export const INITIAL_SUBSEA_NODES: SubseaNetworkNode[] = [
  {
    id: 'sub_01',
    name: 'Submarino Tático Almirante (SSN-01)',
    type: 'submarine',
    depthMeters: 280,
    latitude: -23.125,
    longitude: -44.231,
    batteryPercent: 94,
    activeChannels: ['acoustic_janus', 'em_vlf_elf', 'optical_bluecomm'],
    surfaceLinkType: 'none',
    status: 'online',
  },
  {
    id: 'buoy_alpha',
    name: 'Bóia Gateway de Superfície (Relé Cross-Medium)',
    type: 'surface_buoy',
    depthMeters: 0, // Na linha da água com hidrofone a 15m
    latitude: -23.120,
    longitude: -44.225,
    batteryPercent: 98,
    activeChannels: ['acoustic_janus', 'acoustic_whoi', 'optical_bluecomm', 'magneto_inductive'],
    surfaceLinkType: 'iridium_satellite',
    status: 'online',
  },
  {
    id: 'auv_scout',
    name: 'AUV Autônomo Scout-X4 (Pesquisa & Inspeção)',
    type: 'auv',
    depthMeters: 140,
    latitude: -23.135,
    longitude: -44.240,
    batteryPercent: 82,
    activeChannels: ['acoustic_whoi', 'optical_bluecomm'],
    surfaceLinkType: 'none',
    status: 'online',
  },
  {
    id: 'sensor_bottom',
    name: 'Estação Sísmica / Alerta DART (Fundo Oceânico)',
    type: 'seafloor_sensor',
    depthMeters: 850,
    latitude: -23.110,
    longitude: -44.210,
    batteryPercent: 77,
    activeChannels: ['acoustic_janus', 'acoustic_whoi'],
    surfaceLinkType: 'none',
    status: 'online',
  },
  {
    id: 'sat_relay',
    name: 'Satélite LEO Relay (Segmento Orbital)',
    type: 'satellite',
    depthMeters: -550000, // 550 km no espaço
    latitude: -23.0,
    longitude: -44.0,
    batteryPercent: 100,
    activeChannels: [],
    surfaceLinkType: 'iridium_satellite',
    status: 'online',
  },
  {
    id: 'coast_soc',
    name: 'Centro de Operações Naval Costeiro (SOC)',
    type: 'coastal_station',
    depthMeters: -12, // Em terra
    latitude: -22.95,
    longitude: -43.18,
    batteryPercent: 100,
    activeChannels: [],
    surfaceLinkType: 'tactical_vhf',
    status: 'online',
  },
];

// ==========================================
// 6. ROTEADOR DE MENSAGENS E FILA MULTI-CANAL
// ==========================================

export interface CrossMediumMessage {
  id: string;
  sourceNodeId: string;
  sourceNodeName: string;
  targetNodeId: string;
  targetNodeName: string;
  content: string;
  channelUsed: SubseaPhysicalChannel | 'satellite_rf' | 'radio_rf';
  timestamp: string;
  hopsCount: number;
  routedViaGateway: boolean;
  status: 'subsea_transmitted' | 'relayed_by_buoy' | 'delivered_to_mesh' | 'broadcasted';
  metrics: {
    latencyMs: number;
    estimatedThroughput: string;
    acousticFreqKhz?: number;
    depthMeters: number;
    crcValid: boolean;
  };
}

// ==========================================
// 7. WEB AUDIO TRANSCEIVER (EMISSOR DE SOM SUBMARINO)
// ==========================================

let audioCtxInstance: AudioContext | null = null;

function getSubseaAudioContext(): AudioContext {
  if (!audioCtxInstance || audioCtxInstance.state === 'closed') {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtxInstance = new AudioContextClass();
  }
  if (audioCtxInstance.state === 'suspended') {
    audioCtxInstance.resume();
  }
  return audioCtxInstance;
}

/**
 * Emite uma rajada acústica FSK real pelo alto-falante / transdutor piezelétrico.
 * Usa tons audíveis (ex: 2.4 kHz Mark, 3.2 kHz Space) para teste ou tons ultrassônicos (11.5 kHz JANUS).
 */
export async function playSubseaAcousticBurst(
  frequencyKhz: number,
  durationSec = 0.8,
  isJanusChirp = false
): Promise<void> {
  const ctx = getSubseaAudioContext();
  const startTime = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  const centerHz = frequencyKhz * 1000;

  if (isJanusChirp) {
    // Chirp acústico JANUS com varredura linear de 9.4 kHz a 13.6 kHz (ou ajustado)
    osc.type = 'sine';
    osc.frequency.setValueAtTime(centerHz * 0.85, startTime);
    osc.frequency.linearRampToValueAtTime(centerHz * 1.15, startTime + durationSec * 0.7);
    osc.frequency.linearRampToValueAtTime(centerHz, startTime + durationSec);
  } else {
    // Pulso clássico de sonar / FSK
    osc.type = 'sine';
    osc.frequency.setValueAtTime(centerHz, startTime);
  }

  // Envelope anti-click e decaimento realista de eco submarino
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.35, startTime + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.15, startTime + durationSec * 0.6);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + durationSec + 0.05);

  return new Promise((resolve) => setTimeout(resolve, durationSec * 1000));
}

/**
 * Emite sequência de pulsos simulando a transmissão de um pacote JANUS completo.
 */
export async function playJanusTransmissionSequence(
  onStepProgress?: (step: number, total: number) => void
): Promise<void> {
  const tones = [11520, 10200, 12800, 11520, 9800, 13200, 11520]; // Padrão de frequências JANUS
  for (let i = 0; i < tones.length; i++) {
    onStepProgress?.(i + 1, tones.length);
    // Para conforto auditivo em alto-falantes comerciais de computadores,
    // transpomos levemente para a banda audível alta (~2.8 kHz a 3.8 kHz) ou modo real:
    const audFreqKhz = (tones[i] / 1000) > 6 ? 2.8 + (i % 3) * 0.5 : tones[i] / 1000;
    await playSubseaAcousticBurst(audFreqKhz, 0.12, i === 0);
    await new Promise((r) => setTimeout(r, 40));
  }
}

// ==========================================
// 8. PAPERS CIENTÍFICOS & SISTEMAS MILITARES
// ==========================================

export interface ScientificUnderwaterPaper {
  id: string;
  title: string;
  authors: string;
  organization: string;
  year: number;
  standardOrType: string;
  doiOrUrl: string;
  summary: string;
  keyContributions: string[];
}

export const SCIENTIFIC_SUBSEA_PAPERS: ScientificUnderwaterPaper[] = [
  {
    id: 'janus_stanag_4748',
    title: 'JANUS: A Open, Interoperable Digital Underwater Acoustic Communications Standard (NATO STANAG 4748)',
    authors: 'J. Alves, R. Petroccia, K. Pelekanakis, J. R. Potter',
    organization: 'NATO Science & Technology Organization - Centre for Maritime Research & Experimentation (CMRE)',
    year: 2017,
    standardOrType: 'NATO Military Standard (STANAG 4748)',
    doiOrUrl: 'https://www.cmre.nato.int/research/underwater-communications/janus',
    summary:
      'Primeiro padrão internacionalmente adotado para comunicação digital acústica submarina. Define frequência de 11.5 kHz, modulação FHSS, tolerância a multicaminho severo e descoberta universal de ativos navais e AUVs.',
    keyContributions: [
      'Eliminação da incompatibilidade entre modems proprietários de diferentes fabricantes navais.',
      'Canal comum de chamada universal (Universal Calling Channel) para cooperação submarina aliada.',
      'Protocolo de handshake para migração para frequências maiores de dados após contato inicial.',
    ],
  },
  {
    id: 'mit_tarf_2018',
    title: 'Enabling Direct Bi-directional Acoustic-RF Communication Across the Air-Water Interface (TARF)',
    authors: 'F. Tonolini, F. Adib',
    organization: 'Massachusetts Institute of Technology (MIT CSAIL / Media Lab)',
    year: 2018,
    standardOrType: 'ACM SIGCOMM Best Paper',
    doiOrUrl: 'https://www.media.mit.edu/projects/tarf/overview/',
    summary:
      'Demonstrou a comunicação direta entre nós submersos e drones/estações aéreas sem bóia física através da leitura de microvibrações na superfície da água (sub-micrométricas) usando radar de onda milimétrica (mmWave Radar).',
    keyContributions: [
      'Quebra da barreira física de reflexão de 99.9% de energia sonora na interface água-ar.',
      'Medição de modulação de fase no reflexo do radar mmWave provocada por pulsos acústicos subaquáticos.',
      'Potencial futuro para comunicação sem intermediários físicos flutuantes.',
    ],
  },
  {
    id: 'whoi_micromodem_2',
    title: 'The WHOI Micro-Modem 2: A Compact Acoustic Communications and Navigation Architecture',
    authors: 'L. Freitag, M. Grund, S. Singh, J. Partan, P. Koski, K. Ball',
    organization: 'Woods Hole Oceanographic Institution (WHOI)',
    year: 2005,
    standardOrType: 'Oceanographic Architecture Standard',
    doiOrUrl: 'https://acomms.whoi.edu/micro-modem/',
    summary:
      'Arquitetura de modem acústico de baixo consumo de energia padrão para veículos autônomos subaquáticos (AUVs) e redes oceanográficas de fundo de mar. Suporta FSK, PSK e equalização em tempo real de canal multipath.',
    keyContributions: [
      'Algoritmo DFE (Decision Feedback Equalizer) para combater espalhamento temporal do som.',
      'Capacidade de navegação de linha de base longa (LBL / USBL) com telemetria combinada.',
      'Implementação padrão de referência adotada pela marinha americana e institutos de pesquisa marinha.',
    ],
  },
  {
    id: 'bluecomm_uwoc_sonardyne',
    title: 'High-Bandwidth Underwater Wireless Optical Communications for Deep-Water Robotic Systems',
    authors: 'D. Giles, S. Neasham, A. E. Adams',
    organization: 'Sonardyne International / Newcastle University',
    year: 2019,
    standardOrType: 'Industrial Field Paper (IEEE Oceans)',
    doiOrUrl: 'https://www.sonardyne.com/products/bluecomm-underwater-optical-communication/',
    summary:
      'Sistema de comunicação óptica subaquática de alta velocidade utilizando matrizes de LEDs azuis de 470 nm de alta potência com fotomultiplicadores de silício (SiPM) e moduladores digitais capazes de transmitir até 500 Mbps em água do mar.',
    keyContributions: [
      'Transmissão de vídeo de alta definição 4K em tempo real de submarinos e ROVs submersos sem cabo umbilical.',
      'Rejeição ativa de luz ambiente solar até 150m de profundidade.',
      'Integração híbrida óptica-acústica para máxima versatilidade.',
    ],
  },
  {
    id: 'seaweb_network',
    title: 'Seaweb: Acoustic Network Architecture for Undersea Surveillance and Sensor Grid',
    authors: 'J. A. Rice, B. Creber, C. Fletcher, P. Baxley, K. Rogers',
    organization: 'US Naval Postgraduate School & Space and Naval Warfare Systems Center (SPAWAR)',
    year: 2002,
    standardOrType: 'US Navy Tactical Defense Report',
    doiOrUrl: 'https://apps.dtic.mil/sti/citations/ADA404746',
    summary:
      'Rede tática pioneira com dezenas de nós acústicos de leito oceânico conectados a bóias de superfície com gateways de satélite e rádio de linha de visada, permitindo monitoramento de frotas e tsunamis.',
    keyContributions: [
      'Pioneirismo em arquitetura de gateway de superfície com roteamento de pacotes cross-medium.',
      'Roteamento autônomo multi-hop em canais acústicos com degradação graciosa.',
      'Fundamentação para as atuais redes de detecção de tsunamis NOAA DART.',
    ],
  },
];
