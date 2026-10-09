// ============================================================================
// ENGINE 3D EARTH GLOBE & PRIVACIDADE DIFERENCIAL (10 KM FUZZING RADIUS)
// JYY Communication Suite v2.0 - Argon-4 Class 3D Planetary Mesh System
// ============================================================================

export interface GlobeUserNode {
  id: string;
  callsign: string;
  fullName: string;
  fuzzyLat: number;
  fuzzyLon: number;
  fuzzRadiusKm: number; // Sempre 10 km para privacidade estrita
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
    bio: 'Operador de estação meteorológica e nó repetidor JYY. Aberto para bater papo sobre segurança e P2P.',
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
