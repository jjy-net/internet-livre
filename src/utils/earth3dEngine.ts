// ============================================================================
// ENGINE 3D EARTH GLOBE & PRIVACIDADE DIFERENCIAL (10 KM FUZZING RADIUS)
// JJY Communication Suite v2.0 - Argon-4 Class 3D Planetary Mesh System
// ============================================================================

export type LocationPrecisionMode = 'privacy_10km' | 'neighborhood_1km' | 'high_precision';

export interface LocationPrecisionOption {
  id: LocationPrecisionMode;
  name: string;
  shortName: string;
  iconName: string;
  icon: string;
  radiusKm: number;
  radiusLabel: string;
  description: string;
  recommendedFor: string;
  badgeColor: string;
  warning?: string;
}

export const LOCATION_PRECISION_OPTIONS: LocationPrecisionOption[] = [
  {
    id: 'privacy_10km',
    name: 'Segurança Máxima (Erro de 10 km)',
    shortName: '±10 km (Privacidade)',
    iconName: 'Shield',
    icon: '🛡️',
    radiusKm: 10,
    radiusLabel: '±10 km (Protegido)',
    description: 'Padrão recomendado: Adiciona erro proposital de 8 a 10 km num ângulo aleatório para proteger sua casa ou ponto de operação contra rastreamento físico.',
    recommendedFor: 'Navegação cotidiana, privacidade doméstica e proteção anti-triangulação.',
    badgeColor: 'amber',
  },
  {
    id: 'high_precision',
    name: 'Alta Precisão (Exata GPS / Metro a Metro)',
    shortName: 'GPS Exato (Resgate)',
    iconName: 'Navigation',
    icon: '🎯',
    radiusKm: 0.015,
    radiusLabel: 'GPS Real (Exato)',
    description: 'Transmite suas coordenadas GPS reais sem qualquer ofuscação. Permite que amigos localizem você ou que equipes de resgate encontrem sua posição em emergências e desastres.',
    recommendedFor: 'Operações de resgate em desastres, encontros presenciais e visada direta de rádio.',
    badgeColor: 'emerald',
    warning: 'Aviso de Segurança: Suas coordenadas geográficas exatas estarão visíveis publicamente no mapa 3D.',
  },
  {
    id: 'neighborhood_1km',
    name: 'Vizinhança / Bairro (Erro de 1 km)',
    shortName: '±1 km (Bairro)',
    iconName: 'MapPin',
    icon: '🏘️',
    radiusKm: 1.0,
    radiusLabel: '±1 km (Bairro)',
    description: 'Aproximação regional com raio de 1 km. Dá uma referência geral de bairro para malhas locais sem expor o número da sua casa.',
    recommendedFor: 'Redes comunitárias de bairro e enlaces locais sem revelar endereço residencial.',
    badgeColor: 'blue',
  },
];

export interface GlobeUserNode {
  id: string;
  callsign: string;
  fullName: string;
  fuzzyLat: number;
  fuzzyLon: number;
  fuzzRadiusKm: number; // 10 km padrão ou 0 para alta precisão
  isExactGps?: boolean;
  precisionMode?: LocationPrecisionMode;
  country: string;
  flag: string;
  city: string;
  status: 'online' | 'busy' | 'away';
  bio: string;
  transports: string[]; // Ex: ['LoRa 915M', 'Wi-Fi Mesh', 'Celular 5G', 'Satélite']
  isLocalUser?: boolean;
  isVisibleOnMap: boolean;
  lastSeen: string;
  avatarBg: string;
  signalStrengthDbm: number;
  rttMs: number;
}

export interface GlobeCamera {
  rotX: number; // Inclinação vertical (tilt) em radianos
  rotY: number; // Rotação horizontal (azimuth) em radianos
  scale: number; // Zoom
}

// ----------------------------------------------------------------------------
// ALGORITMO DE OFUSCAÇÃO PROPOSITAL DE 10 KM (DIFFERENTIAL PRIVACY FUZZING)
// ----------------------------------------------------------------------------

/**
 * Aplica um deslocamento proposital de exatamente 8 a 10 km em ângulo aleatório
 * em torno da coordenada real para garantir que ninguém saiba o endereço físico exato.
 */
export function apply10kmFuzzyObfuscation(
  realLat: number,
  realLon: number,
  seedKey?: string
): {
  fuzzyLat: number;
  fuzzyLon: number;
  offsetKm: number;
  bearingDeg: number;
} {
  // Gera deslocamento pseudo-aleatório consistente por nó ou horário
  let seedNum = 0;
  if (seedKey) {
    for (let i = 0; i < seedKey.length; i++) {
      seedNum += seedKey.charCodeAt(i) * (i + 1);
    }
  } else {
    seedNum = Math.floor(Date.now() / (1000 * 3600 * 24)); // Muda no máximo a cada 24h
  }

  const pseudoRandom1 = Math.abs(Math.sin(seedNum * 12.9898)) % 1;
  const pseudoRandom2 = Math.abs(Math.cos(seedNum * 78.233)) % 1;

  // Distância entre 8.5 km e 10.0 km
  const offsetKm = 8.5 + pseudoRandom1 * 1.5;
  const bearingRad = pseudoRandom2 * 2 * Math.PI;
  const bearingDeg = Math.round((bearingRad * 180) / Math.PI);

  const EARTH_RADIUS_KM = 6371.0;
  const latRad = (realLat * Math.PI) / 180;
  const lonRad = (realLon * Math.PI) / 180;

  const distRatio = offsetKm / EARTH_RADIUS_KM;

  const fuzzyLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(distRatio) +
      Math.cos(latRad) * Math.sin(distRatio) * Math.cos(bearingRad)
  );

  const fuzzyLonRad =
    lonRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(distRatio) * Math.cos(latRad),
      Math.cos(distRatio) - Math.sin(latRad) * Math.sin(fuzzyLatRad)
    );

  const fuzzyLat = Math.round(((fuzzyLatRad * 180) / Math.PI) * 10000) / 10000;
  const fuzzyLon = Math.round(((fuzzyLonRad * 180) / Math.PI) * 10000) / 10000;

  return {
    fuzzyLat,
    fuzzyLon,
    offsetKm: Math.round(offsetKm * 10) / 10,
    bearingDeg,
  };
}

/**
 * Calcula a localização efetiva com base no nível de precisão escolhido pelo usuário:
 * - 'privacy_10km' (padrão): erro proposital de 10 km para máxima privacidade.
 * - 'high_precision': coordenadas exatas metro a metro para resgate, desastres e amigos.
 * - 'neighborhood_1km': aproximação regional de bairro de ~1 km.
 */
export function applyPrecisionToCoordinates(
  realLat: number,
  realLon: number,
  mode: LocationPrecisionMode = 'privacy_10km',
  seedKey?: string
): {
  lat: number;
  lon: number;
  radiusKm: number;
  isExact: boolean;
  offsetKm: number;
} {
  if (mode === 'high_precision') {
    return {
      lat: Math.round(realLat * 1000000) / 1000000,
      lon: Math.round(realLon * 1000000) / 1000000,
      radiusKm: 0.015, // Precisão GPS de ~15 metros
      isExact: true,
      offsetKm: 0,
    };
  }

  if (mode === 'neighborhood_1km') {
    let seedNum = 0;
    if (seedKey) {
      for (let i = 0; i < seedKey.length; i++) seedNum += seedKey.charCodeAt(i) * (i + 1);
    } else {
      seedNum = Math.floor(Date.now() / (1000 * 3600 * 24));
    }
    const p1 = Math.abs(Math.sin(seedNum * 23.456)) % 1;
    const p2 = Math.abs(Math.cos(seedNum * 45.678)) % 1;
    const offsetKm = 0.8 + p1 * 0.4;
    const bearingRad = p2 * 2 * Math.PI;

    const EARTH_RADIUS_KM = 6371.0;
    const latRad = (realLat * Math.PI) / 180;
    const lonRad = (realLon * Math.PI) / 180;
    const distRatio = offsetKm / EARTH_RADIUS_KM;

    const fuzzyLatRad = Math.asin(
      Math.sin(latRad) * Math.cos(distRatio) +
        Math.cos(latRad) * Math.sin(distRatio) * Math.cos(bearingRad)
    );
    const fuzzyLonRad =
      lonRad +
      Math.atan2(
        Math.sin(bearingRad) * Math.sin(distRatio) * Math.cos(latRad),
        Math.cos(distRatio) - Math.sin(latRad) * Math.sin(fuzzyLatRad)
      );

    return {
      lat: Math.round(((fuzzyLatRad * 180) / Math.PI) * 10000) / 10000,
      lon: Math.round(((fuzzyLonRad * 180) / Math.PI) * 10000) / 10000,
      radiusKm: 1.0,
      isExact: false,
      offsetKm: Math.round(offsetKm * 10) / 10,
    };
  }

  // Padrão de segurança: 10 km
  const fuzz = apply10kmFuzzyObfuscation(realLat, realLon, seedKey);
  return {
    lat: fuzz.fuzzyLat,
    lon: fuzz.fuzzyLon,
    radiusKm: 10.0,
    isExact: false,
    offsetKm: fuzz.offsetKm,
  };
}

/**
 * Fórmula de Haversine para cálculo de distância entre duas coordenadas geográficas
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// ----------------------------------------------------------------------------
// COORDENADAS POLIGONAIS DOS CONTINENTES (OFFLINE 3D VECTOR GLOBE)
// ----------------------------------------------------------------------------

export interface GeoPolygon {
  name: string;
  points: [number, number][]; // [Latitude, Longitude]
}

export const WORLD_CONTINENT_POLYGONS: GeoPolygon[] = [
  // América do Sul
  {
    name: 'América do Sul',
    points: [
      [12.0, -72.0], [10.5, -61.0], [5.0, -52.0], [-1.0, -48.0], [-5.0, -35.0],
      [-13.0, -38.5], [-23.0, -41.0], [-25.0, -48.0], [-34.0, -53.0], [-41.0, -62.0],
      [-52.0, -68.0], [-55.0, -66.0], [-50.0, -75.0], [-42.0, -74.0], [-33.0, -71.5],
      [-18.0, -70.0], [-5.0, -81.0], [2.0, -79.0], [8.0, -77.0], [12.0, -72.0]
    ],
  },
  // América do Norte & Central
  {
    name: 'América do Norte',
    points: [
      [71.0, -156.0], [60.0, -165.0], [55.0, -160.0], [58.0, -135.0], [48.0, -124.0],
      [38.0, -123.0], [32.0, -117.0], [23.0, -110.0], [18.0, -104.0], [15.0, -93.0],
      [8.5, -83.0], [8.0, -77.0], [15.0, -84.0], [21.0, -89.0], [26.0, -97.0],
      [29.0, -94.0], [30.0, -84.0], [25.0, -80.0], [35.0, -75.0], [44.0, -66.0],
      [51.0, -56.0], [62.0, -65.0], [70.0, -75.0], [72.0, -125.0], [71.0, -156.0]
    ],
  },
  // África
  {
    name: 'África',
    points: [
      [37.0, 10.0], [32.0, 32.0], [27.0, 34.0], [13.0, 43.0], [12.0, 51.0],
      [-1.0, 41.0], [-10.0, 40.0], [-26.0, 33.0], [-34.0, 18.0], [-22.0, 14.0],
      [-5.0, 12.0], [4.0, 9.0], [5.0, 1.0], [5.0, -7.0], [14.0, -17.0],
      [21.0, -17.0], [35.0, -6.0], [37.0, 10.0]
    ],
  },
  // Europa
  {
    name: 'Europa',
    points: [
      [36.0, -9.0], [43.0, -9.0], [46.0, -1.0], [48.0, -5.0], [54.0, 9.0],
      [58.0, 5.0], [71.0, 26.0], [67.0, 32.0], [60.0, 30.0], [55.0, 21.0],
      [46.0, 30.0], [42.0, 28.0], [38.0, 24.0], [40.0, 18.0], [44.0, 12.0],
      [36.0, 15.0], [36.0, -5.0], [36.0, -9.0]
    ],
  },
  // Ásia
  {
    name: 'Ásia',
    points: [
      [71.0, 70.0], [76.0, 100.0], [70.0, 178.0], [60.0, 162.0], [52.0, 142.0],
      [40.0, 128.0], [34.0, 120.0], [22.0, 114.0], [10.0, 105.0], [1.0, 104.0],
      [15.0, 96.0], [21.0, 89.0], [8.0, 77.0], [24.0, 68.0], [25.0, 56.0],
      [13.0, 44.0], [30.0, 34.0], [41.0, 28.0], [55.0, 38.0], [60.0, 60.0],
      [71.0, 70.0]
    ],
  },
  // Austrália & Oceania
  {
    name: 'Austrália',
    points: [
      [-12.0, 131.0], [-10.5, 142.0], [-19.0, 146.0], [-27.0, 153.0], [-37.0, 150.0],
      [-38.0, 144.0], [-35.0, 136.0], [-32.0, 128.0], [-34.0, 115.0], [-22.0, 113.0],
      [-15.0, 124.0], [-12.0, 131.0]
    ],
  },
  // Groenlândia
  {
    name: 'Groenlândia',
    points: [
      [83.0, -30.0], [80.0, -18.0], [70.0, -22.0], [60.0, -43.0], [65.0, -52.0],
      [75.0, -58.0], [78.0, -68.0], [82.0, -50.0], [83.0, -30.0]
    ],
  },
  // Antártida
  {
    name: 'Antártida',
    points: [
      [-65.0, -64.0], [-68.0, -60.0], [-73.0, -20.0], [-70.0, 15.0], [-66.0, 50.0],
      [-65.0, 95.0], [-67.0, 140.0], [-72.0, 170.0], [-78.0, -170.0], [-74.0, -110.0],
      [-71.0, -80.0], [-65.0, -64.0]
    ],
  },
  // Reino Unido e Irlanda
  {
    name: 'Reino Unido & Irlanda',
    points: [
      [58.5, -5.0], [58.0, -2.0], [52.5, 1.8], [50.0, -0.5], [50.0, -5.5],
      [53.0, -4.5], [55.0, -6.0], [55.5, -7.5], [51.5, -10.0], [53.5, -9.5],
      [55.0, -6.0], [58.5, -5.0]
    ],
  },
  // Japão
  {
    name: 'Japão',
    points: [
      [45.0, 142.0], [43.0, 145.5], [40.0, 142.0], [35.5, 140.5], [33.5, 135.5],
      [31.0, 130.5], [33.5, 129.5], [36.0, 136.0], [40.5, 139.5], [45.0, 142.0]
    ],
  },
  // Nova Zelândia
  {
    name: 'Nova Zelândia',
    points: [
      [-34.5, 173.0], [-37.5, 178.0], [-41.5, 175.0], [-46.5, 169.0], [-46.0, 166.5],
      [-41.0, 172.0], [-38.0, 174.5], [-34.5, 173.0]
    ],
  },
  // Madagascar
  {
    name: 'Madagascar',
    points: [
      [-12.0, 49.0], [-16.0, 50.0], [-25.0, 47.0], [-25.5, 45.0], [-20.0, 44.0],
      [-15.0, 46.5], [-12.0, 49.0]
    ],
  },
];

// ----------------------------------------------------------------------------
// COORDENADAS DE MEGACIDADES GLOBAIS (LUZES NOTURNAS / CITY LIGHTS)
// ----------------------------------------------------------------------------

export interface GlobalCityLight {
  name: string;
  lat: number;
  lon: number;
  brightness: number; // 0.4 a 1.0
}

export const GLOBAL_MEGACITIES: GlobalCityLight[] = [
  // América do Sul
  { name: 'São Paulo', lat: -23.5505, lon: -46.6333, brightness: 1.0 },
  { name: 'Rio de Janeiro', lat: -22.9068, lon: -43.1729, brightness: 0.95 },
  { name: 'Brasília', lat: -15.7975, lon: -47.8919, brightness: 0.8 },
  { name: 'Buenos Aires', lat: -34.6037, lon: -58.3816, brightness: 0.95 },
  { name: 'Santiago', lat: -33.4489, lon: -70.6693, brightness: 0.85 },
  { name: 'Lima', lat: -12.0464, lon: -77.0428, brightness: 0.85 },
  { name: 'Bogotá', lat: 4.7110, lon: -74.0721, brightness: 0.85 },
  // América do Norte
  { name: 'Nova York', lat: 40.7128, lon: -74.0060, brightness: 1.0 },
  { name: 'Los Angeles', lat: 34.0522, lon: -118.2437, brightness: 1.0 },
  { name: 'Chicago', lat: 41.8781, lon: -87.6298, brightness: 0.9 },
  { name: 'Cidade do México', lat: 19.4326, lon: -99.1332, brightness: 0.95 },
  { name: 'Toronto', lat: 43.6532, lon: -79.3832, brightness: 0.85 },
  // Europa
  { name: 'Londres', lat: 51.5074, lon: -0.1278, brightness: 1.0 },
  { name: 'Paris', lat: 48.8566, lon: 2.3522, brightness: 1.0 },
  { name: 'Berlim', lat: 52.5200, lon: 13.4050, brightness: 0.85 },
  { name: 'Madri', lat: 40.4168, lon: -3.7038, brightness: 0.85 },
  { name: 'Roma', lat: 41.9028, lon: 12.4964, brightness: 0.8 },
  { name: 'Lisboa', lat: 38.7223, lon: -9.1393, brightness: 0.8 },
  // África & Oriente Médio
  { name: 'Cairo', lat: 30.0444, lon: 31.2357, brightness: 0.9 },
  { name: 'Joanesburgo', lat: -26.2041, lon: 28.0473, brightness: 0.8 },
  { name: 'Dubai', lat: 25.2048, lon: 55.2708, brightness: 1.0 },
  { name: 'Istambul', lat: 41.0082, lon: 28.9784, brightness: 0.9 },
  // Ásia & Oceania
  { name: 'Tóquio', lat: 35.6762, lon: 139.6503, brightness: 1.0 },
  { name: 'Seul', lat: 37.5665, lon: 126.9780, brightness: 0.95 },
  { name: 'Pequim', lat: 39.9042, lon: 116.4074, brightness: 0.95 },
  { name: 'Xangai', lat: 31.2304, lon: 121.4737, brightness: 1.0 },
  { name: 'Hong Kong', lat: 22.3193, lon: 114.1694, brightness: 0.95 },
  { name: 'Singapura', lat: 1.3521, lon: 103.8198, brightness: 0.95 },
  { name: 'Mumbai', lat: 19.0760, lon: 72.8777, brightness: 0.95 },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093, brightness: 0.9 },
];

// ----------------------------------------------------------------------------
// SATÉLITES ORBITAIS 3D (LEO / GEO MESH RELAYS & TELEMETRIA SDR)
// ----------------------------------------------------------------------------

export interface OrbitingSatellite {
  id: string;
  name: string;
  catalogCode: string;
  type: 'LEO' | 'GEO' | 'MEO';
  altitudeKm: number;
  inclinationDeg: number;
  periodMinutes: number;
  speedKmh: number;
  freqDownlink: string;
  freqUplink: string;
  modulation: string;
  color: string;
  footprintRadiusKm: number;
  description: string;
  // Deslocamento de fase orbital inicial (radianos)
  initialPhaseRad: number;
  // Longitude fixa para GEO
  geoLongitudeDeg?: number;
}

export const ORBITING_SATELLITES: OrbitingSatellite[] = [
  {
    id: 'sat_iss',
    name: 'ISS / Estação Espacial',
    catalogCode: 'NORAD 25544',
    type: 'LEO',
    altitudeKm: 420,
    inclinationDeg: 51.64,
    periodMinutes: 92.9,
    speedKmh: 27600,
    freqDownlink: '145.825 MHz',
    freqUplink: '145.825 MHz',
    modulation: 'AFSK1200 / APRS',
    color: '#06b6d4', // Cyan
    footprintRadiusKm: 2200,
    description: 'Digipeater AX.25 tático a bordo da Estação Espacial Internacional. Retransmite pacotes e telemetria de nós amadores.',
    initialPhaseRad: 0.45,
  },
  {
    id: 'sat_jjy_mesh1',
    name: 'JJY-SAT-1 (Mesh Relay)',
    catalogCode: 'JJY-ORB-01',
    type: 'LEO',
    altitudeKm: 550,
    inclinationDeg: 45.0,
    periodMinutes: 95.6,
    speedKmh: 27300,
    freqDownlink: '437.550 MHz',
    freqUplink: '437.550 MHz',
    modulation: 'LoRa CSS 125kHz',
    color: '#10b981', // Emerald
    footprintRadiusKm: 2600,
    description: 'Satélite Cubesat 3U dedicado para retransmissão de mensagens da rede livre JJY e internet de emergência descentralizada.',
    initialPhaseRad: 2.1,
  },
  {
    id: 'sat_iridium',
    name: 'Iridium NEXT-104',
    catalogCode: 'NORAD 43075',
    type: 'LEO',
    altitudeKm: 780,
    inclinationDeg: 86.4,
    periodMinutes: 100.4,
    speedKmh: 26800,
    freqDownlink: '1621.25 MHz',
    freqUplink: '1621.25 MHz',
    modulation: 'QPSK (L-Band)',
    color: '#38bdf8', // Sky Blue
    footprintRadiusKm: 3100,
    description: 'Satélite em órbita polar baixa fornecendo conectividade inter-satélite e enlace IP global resiliente.',
    initialPhaseRad: 3.8,
  },
  {
    id: 'sat_noaa19',
    name: 'NOAA-19 Weather APT',
    catalogCode: 'NORAD 33591',
    type: 'LEO',
    altitudeKm: 850,
    inclinationDeg: 98.7,
    periodMinutes: 102.1,
    speedKmh: 26500,
    freqDownlink: '137.100 MHz',
    freqUplink: 'N/A (RX Only)',
    modulation: 'FM / AFSK 4.1kHz',
    color: '#a855f7', // Purple
    footprintRadiusKm: 3300,
    description: 'Satélite meteorológico de órbita heliossíncrona transmitindo imagens da Terra em tempo real e telemetria aberta.',
    initialPhaseRad: 5.2,
  },
  {
    id: 'sat_swarm',
    name: 'Swarm Space-BEE IoT',
    catalogCode: 'NORAD 47522',
    type: 'LEO',
    altitudeKm: 525,
    inclinationDeg: 97.5,
    periodMinutes: 95.1,
    speedKmh: 27400,
    freqDownlink: '137.500 MHz',
    freqUplink: '148.500 MHz',
    modulation: 'LoRa 9600 Baud',
    color: '#f59e0b', // Amber
    footprintRadiusKm: 2500,
    description: 'Constelação de micro-satélites de ultrabaixo consumo para troca de mensagens curtas de emergência e sensores.',
    initialPhaseRad: 1.2,
  },
  {
    id: 'sat_qo100',
    name: 'QO-100 / Es\'hail-2 (GEO)',
    catalogCode: 'NORAD 43700',
    type: 'GEO',
    altitudeKm: 35786,
    inclinationDeg: 0.05,
    periodMinutes: 1436,
    speedKmh: 11070,
    freqDownlink: '10.489 GHz (Ku)',
    freqUplink: '2.400 GHz (S)',
    modulation: 'DVB-S2 / SSB',
    color: '#ec4899', // Pink
    footprintRadiusKm: 8500,
    description: 'Satélite geoestacionário permanente posicionado a 25.9° Leste. Cobertura do Brasil ao Sudeste Asiático.',
    initialPhaseRad: 0,
    geoLongitudeDeg: 25.9,
  },
];

// ----------------------------------------------------------------------------
// NÓS DE USUÁRIOS ATIVOS NA REDE (PEERS VISÍVEIS COM FUZZING DE 10 KM)
// ----------------------------------------------------------------------------

export const INITIAL_GLOBE_PEERS: GlobeUserNode[] = [
  {
    id: 'peer_sp_01',
    callsign: 'PIRATININGA-DX',
    fullName: 'Carlos Mendonça',
    fuzzyLat: -23.5912,
    fuzzyLon: -46.6854,
    fuzzRadiusKm: 10,
    country: 'Brasil',
    flag: '🇧🇷',
    city: 'São Paulo, SP',
    status: 'online',
    bio: 'Operador de rádio amador e gateway LoRa Meshtastic 915MHz na zona sul. Pronto para conversar e trocar pacotes!',
    transports: ['LoRa Meshtastic', 'Wi-Fi Radar', 'WebRTC'],
    isVisibleOnMap: true,
    lastSeen: 'Agora há pouco',
    avatarBg: 'from-cyan-600 to-blue-600',
    signalStrengthDbm: -68,
    rttMs: 24,
  },
  {
    id: 'peer_rj_02',
    callsign: 'GUANABARA-LINK',
    fullName: 'Mariana Duarte',
    fuzzyLat: -22.9514,
    fuzzyLon: -43.2351,
    fuzzRadiusKm: 10,
    country: 'Brasil',
    flag: '🇧🇷',
    city: 'Rio de Janeiro, RJ',
    status: 'online',
    bio: 'Estudante de engenharia e entusiasta de telecomunicações. Testando nós mesh e modem de áudio aéreo.',
    transports: ['Celular 5G', 'Som GGWave', 'LoRa 915M'],
    isVisibleOnMap: true,
    lastSeen: '1 min atrás',
    avatarBg: 'from-emerald-600 to-teal-600',
    signalStrengthDbm: -74,
    rttMs: 38,
  },
  {
    id: 'peer_curitiba_03',
    callsign: 'PINHEIRO-MESH',
    fullName: 'Rodrigo Becker',
    fuzzyLat: -25.4621,
    fuzzyLon: -49.3102,
    fuzzRadiusKm: 10,
    country: 'Brasil',
    flag: '🇧🇷',
    city: 'Curitiba, PR',
    status: 'online',
    bio: 'Operador de estação meteorológica e nó repetidor JJY. Aberto para bater papo sobre segurança e P2P.',
    transports: ['Wi-Fi 802.11', 'Rádio HF APRS', 'NGL Onion'],
    isVisibleOnMap: true,
    lastSeen: '3 min atrás',
    avatarBg: 'from-purple-600 to-indigo-600',
    signalStrengthDbm: -62,
    rttMs: 19,
  },
  {
    id: 'peer_salvador_04',
    callsign: 'FAROL-BARRA',
    fullName: 'Lucas Santiago',
    fuzzyLat: -12.9321,
    fuzzyLon: -38.4812,
    fuzzRadiusKm: 10,
    country: 'Brasil',
    flag: '🇧🇷',
    city: 'Salvador, BA',
    status: 'away',
    bio: 'Navegador marítimo e radioamador. Explorando modems acústicos subaquáticos e comunicação costeira.',
    transports: ['Acústico Subsea', 'LoRa 915M', 'Satélite'],
    isVisibleOnMap: true,
    lastSeen: '12 min atrás',
    avatarBg: 'from-amber-600 to-orange-600',
    signalStrengthDbm: -82,
    rttMs: 56,
  },
  {
    id: 'peer_brasilia_05',
    callsign: 'ALVORADA-NET',
    fullName: 'Fernanda Albuquerque',
    fuzzyLat: -15.8210,
    fuzzyLon: -47.9512,
    fuzzRadiusKm: 10,
    country: 'Brasil',
    flag: '🇧🇷',
    city: 'Brasília, DF',
    status: 'online',
    bio: 'Pesquisadora de redes descentralizadas e proteção de privacidade. Pode me chamar!',
    transports: ['WebRTC P2P', 'Wi-Fi Radar', 'Celular 5G'],
    isVisibleOnMap: true,
    lastSeen: 'Agora',
    avatarBg: 'from-pink-600 to-rose-600',
    signalStrengthDbm: -55,
    rttMs: 14,
  },
  {
    id: 'peer_lisboa_06',
    callsign: 'TEJO-NAVIGATOR',
    fullName: 'Tiago Santos',
    fuzzyLat: 38.7421,
    fuzzyLon: -9.1823,
    fuzzRadiusKm: 10,
    country: 'Portugal',
    flag: '🇵🇹',
    city: 'Lisboa, Portugal',
    status: 'online',
    bio: 'Desenvolvedor e entusiasta de rádios definidos por software (SDR) e comunicações de emergência.',
    transports: ['LoRa 868M', 'Satélite Iridium', 'WebRTC'],
    isVisibleOnMap: true,
    lastSeen: '5 min atrás',
    avatarBg: 'from-sky-600 to-indigo-600',
    signalStrengthDbm: -79,
    rttMs: 145,
  },
  {
    id: 'peer_buenosaires_07',
    callsign: 'PLATA-NODE',
    fullName: 'Matías Fernandez',
    fuzzyLat: -34.6312,
    fuzzyLon: -58.4215,
    fuzzRadiusKm: 10,
    country: 'Argentina',
    flag: '🇦🇷',
    city: 'Buenos Aires, Argentina',
    status: 'busy',
    bio: 'Estação mesh no centro. Monitorando enlaces de HF e pacotes táticos.',
    transports: ['Rádio HF', 'LoRa Meshtastic', 'GL.iNet 4G'],
    isVisibleOnMap: true,
    lastSeen: '8 min atrás',
    avatarBg: 'from-blue-600 to-cyan-600',
    signalStrengthDbm: -88,
    rttMs: 95,
  },
  {
    id: 'peer_tokyo_08',
    callsign: 'SHIBUYA-WAVE',
    fullName: 'Kenji Takahashi',
    fuzzyLat: 35.6580,
    fuzzyLon: 139.7310,
    fuzzRadiusKm: 10,
    country: 'Japão',
    flag: '🇯🇵',
    city: 'Tóquio, Japão',
    status: 'online',
    bio: 'Testando comunicação óptica LiFi e laser infravermelho de alta velocidade através de edifícios.',
    transports: ['Laser Óptico', 'Wi-Fi 802.11be', 'WebRTC'],
    isVisibleOnMap: true,
    lastSeen: 'Agora',
    avatarBg: 'from-rose-600 to-red-600',
    signalStrengthDbm: -71,
    rttMs: 220,
  },
];

// ----------------------------------------------------------------------------
// CÁLCULO DO TERMINADOR SOLAR EM TEMPO REAL (DIA / NOITE TERRESTRE)
// ----------------------------------------------------------------------------

export interface SubsolarPoint {
  lat: number;
  lon: number;
}

/**
 * Calcula o ponto subsolar (onde o sol está no zênite exato a 90°)
 * baseado na data e hora UTC atual do sistema.
 */
export function getSubsolarPoint(date: Date = new Date()): SubsolarPoint {
  const startOfYear = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const dayOfYear = (date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24);

  // Declinação solar (aproximação astronômica precisa)
  const declinationDeg = -23.44 * Math.cos(((2 * Math.PI) / 365.25) * (dayOfYear + 10));

  // Longitude do meio-dia solar UTC
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const sunLonDeg = -((utcHours - 12) * 15);

  // Normalização [-180, 180]
  const normalizedLon = ((((sunLonDeg + 180) % 360) + 360) % 360) - 180;

  return {
    lat: declinationDeg,
    lon: normalizedLon,
  };
}

/**
 * Retorna o fator de iluminação solar para qualquer ponto da Terra:
 * 1.0 = Pleno dia
 * 0.0 = Noite profunda
 * 0.1 a 0.9 = Crepúsculo matutino / vespertino
 */
export function getSolarIllumination(
  lat: number,
  lon: number,
  subsolar: SubsolarPoint
): number {
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const lat2 = (subsolar.lat * Math.PI) / 180;
  const lon2 = (subsolar.lon * Math.PI) / 180;

  // Cosseno do ângulo zenital solar
  const cosZenith =
    Math.sin(lat1) * Math.sin(lat2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.cos(lon1 - lon2);

  // Zona crepuscular entre -0.12 e +0.12
  if (cosZenith >= 0.12) return 1.0;
  if (cosZenith <= -0.12) return 0.0;
  return (cosZenith + 0.12) / 0.24;
}

// ----------------------------------------------------------------------------
// RASTREAMENTO ORBITAL 3D DE SATÉLITES EM TEMPO REAL
// ----------------------------------------------------------------------------

export interface SatelliteCurrentState {
  sat: OrbitingSatellite;
  lat: number;
  lon: number;
  altFactor: number; // Raio relativo (1.0 = superfície, 1.15 = LEO, 1.45 = GEO)
  orbitalSpeedKmh: number;
}

/**
 * Determina a posição geográfica e altitude relativa do satélite no momento dado
 */
export function getSatelliteCoordinates(
  sat: OrbitingSatellite,
  elapsedSec: number
): SatelliteCurrentState {
  if (sat.type === 'GEO') {
    const geoLon = sat.geoLongitudeDeg ?? 0;
    return {
      sat,
      lat: 0,
      lon: geoLon,
      altFactor: 1.45, // Proporção visual para não sumir da tela
      orbitalSpeedKmh: sat.speedKmh,
    };
  }

  // Período orbital em segundos
  const periodSec = sat.periodMinutes * 60;
  // Fase orbital atual
  const phase = sat.initialPhaseRad + (elapsedSec * 2 * Math.PI) / periodSec;

  const incRad = (sat.inclinationDeg * Math.PI) / 180;

  // Latitude pelo movimento harmônico da inclinação
  const latRad = Math.asin(Math.sin(incRad) * Math.sin(phase));
  const latDeg = (latRad * 180) / Math.PI;

  // Longitude com deriva da rotação terrestre
  const earthRotDeriv = (elapsedSec / 86400) * 360;
  const nodeLon = Math.atan2(Math.cos(incRad) * Math.sin(phase), Math.cos(phase));
  let lonDeg = (nodeLon * 180) / Math.PI - earthRotDeriv;
  lonDeg = ((((lonDeg + 180) % 360) + 360) % 360) - 180;

  // Altitude visual escalada
  const altFactor = 1.0 + Math.min(0.28, sat.altitudeKm / 4000);

  return {
    sat,
    lat: latDeg,
    lon: lonDeg,
    altFactor,
    orbitalSpeedKmh: sat.speedKmh,
  };
}

// ----------------------------------------------------------------------------
// INTERPOLAÇÃO DE GRANDE CÍRCULO (SLERP) PARA ARCOS 3D CURVADOS NO ESPAÇO
// ----------------------------------------------------------------------------

export interface GreatCircleStep {
  lat: number;
  lon: number;
  heightOffset: number; // Altura arqueada acima do raio terrestre (0 na ponta, max no centro)
  t: number;
}

/**
 * Gera pontos ao longo do Grande Círculo entre dois pontos geográficos
 * com arqueamento parabólico para fora da esfera.
 */
export function calculateGreatCirclePath(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  steps: number = 24
): GreatCircleStep[] {
  const p1Lat = (lat1 * Math.PI) / 180;
  const p1Lon = (lon1 * Math.PI) / 180;
  const p2Lat = (lat2 * Math.PI) / 180;
  const p2Lon = (lon2 * Math.PI) / 180;

  // Vetores tridimensionais na esfera unitária
  const v1 = [
    Math.cos(p1Lat) * Math.sin(p1Lon),
    Math.sin(p1Lat),
    Math.cos(p1Lat) * Math.cos(p1Lon),
  ];
  const v2 = [
    Math.cos(p2Lat) * Math.sin(p2Lon),
    Math.sin(p2Lat),
    Math.cos(p2Lat) * Math.cos(p2Lon),
  ];

  // Produto escalar
  let dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
  dot = Math.max(-1, Math.min(1, dot));
  const omega = Math.acos(dot);

  const results: GreatCircleStep[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let x: number, y: number, z: number;

    if (omega < 0.001) {
      x = v1[0];
      y = v1[1];
      z = v1[2];
    } else {
      const sinOmega = Math.sin(omega);
      const a = Math.sin((1 - t) * omega) / sinOmega;
      const b = Math.sin(t * omega) / sinOmega;
      x = a * v1[0] + b * v2[0];
      y = a * v1[1] + b * v2[1];
      z = a * v1[2] + b * v2[2];
    }

    // Normalizar
    const len = Math.sqrt(x * x + y * y + z * z) || 1;
    x /= len;
    y /= len;
    z /= len;

    const latPt = (Math.asin(y) * 180) / Math.PI;
    const lonPt = (Math.atan2(x, z) * 180) / Math.PI;

    // Altura arqueada acima da superfície terrestre
    const arcPeak = Math.sin(Math.PI * t);
    const heightOffset = 0.16 * Math.sin(omega * 0.5) * arcPeak;

    results.push({
      lat: latPt,
      lon: lonPt,
      heightOffset,
      t,
    });
  }

  return results;
}

// ----------------------------------------------------------------------------
// ANÁLISE DE ENLACE PONTO A PONTO (PTP LINK ANALYSIS & FRESNEL ZONE)
// ----------------------------------------------------------------------------

export interface PtPLinkAnalysis {
  distanceKm: number;
  propagationDelayMs: number;
  fsplDb: number;
  fresnelRadiusMeters: number;
  estimatedHops: number;
  linkFeasibility: 'direct' | 'mesh_relayed' | 'satellite_required';
  qualityScorePct: number;
}

export function calculatePtPLinkAnalysis(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  freqMhz: number = 915
): PtPLinkAnalysis {
  const distKm = Math.max(0.1, calculateHaversineDistance(lat1, lon1, lat2, lon2));

  // Velocidade da luz no vácuo / ar (~300.000 km/s)
  const propagationDelayMs = Math.round((distKm / 299.792) * 100) / 100;

  // Free Space Path Loss: FSPL = 20*log10(d_km) + 20*log10(f_MHz) + 32.44
  const fsplDb = Math.round(
    20 * Math.log10(distKm) + 20 * Math.log10(freqMhz) + 32.44
  );

  // Raio da 1ª Zona de Fresnel no ponto médio: r = 8.65 * sqrt(d_km / (f_MHz / 1000))
  const freqGhz = Math.max(0.1, freqMhz / 1000);
  const fresnelRadiusMeters = Math.round(8.65 * Math.sqrt(distKm / freqGhz));

  let estimatedHops = 1;
  let linkFeasibility: 'direct' | 'mesh_relayed' | 'satellite_required' = 'direct';
  let qualityScorePct = 95;

  if (distKm <= 25) {
    estimatedHops = 1;
    linkFeasibility = 'direct';
    qualityScorePct = Math.max(70, Math.round(100 - distKm * 1.1));
  } else if (distKm <= 400) {
    estimatedHops = Math.min(8, Math.ceil(distKm / 35));
    linkFeasibility = 'mesh_relayed';
    qualityScorePct = Math.max(40, Math.round(85 - estimatedHops * 5));
  } else {
    estimatedHops = Math.min(14, Math.ceil(distKm / 120));
    linkFeasibility = 'satellite_required';
    qualityScorePct = Math.max(25, Math.round(70 - (distKm / 500) * 4));
  }

  return {
    distanceKm: distKm,
    propagationDelayMs,
    fsplDb,
    fresnelRadiusMeters,
    estimatedHops,
    linkFeasibility,
    qualityScorePct,
  };
}
