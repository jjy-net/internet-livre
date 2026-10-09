// Utilitário de Geolocalização por GPS e País para Telemetria de Estações Jjy

export interface GeoLocationData {
  latitude: number;
  longitude: number;
  accuracy?: number; // em metros
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  timestamp?: number;
  country?: string;
  countryCode?: string;
  flag?: string;
  city?: string;
  region?: string;
  source?: 'gps' | 'network' | 'ip' | 'timezone';
}

// Mapeamento offline de fusos horários para países e bandeiras
const TIMEZONE_TO_COUNTRY: Record<string, { country: string; code: string; flag: string }> = {
  // Brasil
  'America/Sao_Paulo': { country: 'Brasil', code: 'BR', flag: '🇧🇷' },
  'America/Fortaleza': { country: 'Brasil', code: 'BR', flag: '🇧🇷' },
  'America/Cuiaba': { country: 'Brasil', code: 'BR', flag: '🇧🇷' },
  'America/Manaus': { country: 'Brasil', code: 'BR', flag: '🇧🇷' },
  'America/Belem': { country: 'Brasil', code: 'BR', flag: '🇧🇷' },
  'America/Bahia': { country: 'Brasil', code: 'BR', flag: '🇧🇷' },
  'America/Recife': { country: 'Brasil', code: 'BR', flag: '🇧🇷' },
  'America/Campo_Grande': { country: 'Brasil', code: 'BR', flag: '🇧🇷' },
  'America/Porto_Velho': { country: 'Brasil', code: 'BR', flag: '🇧🇷' },
  'America/Boa_Vista': { country: 'Brasil', code: 'BR', flag: '🇧🇷' },
  'America/Rio_Branco': { country: 'Brasil', code: 'BR', flag: '🇧🇷' },
  'America/Maceio': { country: 'Brasil', code: 'BR', flag: '🇧🇷' },
  'America/Araguaina': { country: 'Brasil', code: 'BR', flag: '🇧🇷' },
  'America/Noronha': { country: 'Brasil', code: 'BR', flag: '🇧🇷' },

  // Portugal
  'Europe/Lisbon': { country: 'Portugal', code: 'PT', flag: '🇵🇹' },
  'Atlantic/Madeira': { country: 'Portugal', code: 'PT', flag: '🇵🇹' },
  'Atlantic/Azores': { country: 'Portugal', code: 'PT', flag: '🇵🇹' },

  // Estados Unidos & Canadá
  'America/New_York': { country: 'Estados Unidos', code: 'US', flag: '🇺🇸' },
  'America/Chicago': { country: 'Estados Unidos', code: 'US', flag: '🇺🇸' },
  'America/Los_Angeles': { country: 'Estados Unidos', code: 'US', flag: '🇺🇸' },
  'America/Denver': { country: 'Estados Unidos', code: 'US', flag: '🇺🇸' },
  'America/Toronto': { country: 'Canadá', code: 'CA', flag: '🇨🇦' },

  // América do Sul
  'America/Buenos_Aires': { country: 'Argentina', code: 'AR', flag: '🇦🇷' },
  'America/Cordoba': { country: 'Argentina', code: 'AR', flag: '🇦🇷' },
  'America/Santiago': { country: 'Chile', code: 'CL', flag: '🇨🇱' },
  'America/Montevideo': { country: 'Uruguai', code: 'UY', flag: '🇺🇾' },
  'America/Asuncion': { country: 'Paraguai', code: 'PY', flag: '🇵🇾' },
  'America/Bogota': { country: 'Colômbia', code: 'CO', flag: '🇨🇴' },
  'America/Lima': { country: 'Peru', code: 'PE', flag: '🇵🇪' },

  // Europa
  'Europe/London': { country: 'Reino Unido', code: 'GB', flag: '🇬🇧' },
  'Europe/Madrid': { country: 'Espanha', code: 'ES', flag: '🇪🇸' },
  'Europe/Paris': { country: 'França', code: 'FR', flag: '🇫🇷' },
  'Europe/Berlin': { country: 'Alemanha', code: 'DE', flag: '🇩🇪' },
  'Europe/Rome': { country: 'Itália', code: 'IT', flag: '🇮🇹' },
  'Europe/Amsterdam': { country: 'Holanda', code: 'NL', flag: '🇳🇱' },
  'Europe/Zurich': { country: 'Suíça', code: 'CH', flag: '🇨🇭' },

  // Ásia / Oceania
  'Asia/Tokyo': { country: 'Japão', code: 'JP', flag: '🇯🇵' },
  'Australia/Sydney': { country: 'Austrália', code: 'AU', flag: '🇦🇺' },
};

/**
 * Estima o país e bandeira a partir do fuso horário e idioma do navegador
 */
export function estimateCountryFromEnvironment(): { country: string; code: string; flag: string } {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_TO_COUNTRY[tz]) {
      return TIMEZONE_TO_COUNTRY[tz];
    }
    // Verificação por idioma do navegador (pt-BR, en-US, etc.)
    const lang = (typeof navigator !== 'undefined' && (navigator.language || (navigator as any).userLanguage)) || '';
    if (lang.toLowerCase().includes('br') || lang.toLowerCase() === 'pt') {
      return { country: 'Brasil', code: 'BR', flag: '🇧🇷' };
    }
    if (lang.toLowerCase().includes('pt-pt')) {
      return { country: 'Portugal', code: 'PT', flag: '🇵🇹' };
    }
    if (lang.toLowerCase().includes('us')) {
      return { country: 'Estados Unidos', code: 'US', flag: '🇺🇸' };
    }
  } catch {}
  return { country: 'Brasil', code: 'BR', flag: '🇧🇷' };
}

/**
 * Estima o país a partir de coordenadas geográficas
 */
export function estimateCountryFromCoordinates(lat: number, lon: number): { country: string; code: string; flag: string } {
  // Caixa delimitadora aproximada do Brasil: Lat [-33.75, 5.27], Lon [-73.98, -34.79]
  if (lat >= -34.0 && lat <= 5.5 && lon >= -74.0 && lon <= -34.0) {
    return { country: 'Brasil', code: 'BR', flag: '🇧🇷' };
  }
  // Portugal: Lat [36.9, 42.2], Lon [-9.5, -6.1]
  if (lat >= 36.5 && lat <= 42.5 && lon >= -10.0 && lon <= -6.0) {
    return { country: 'Portugal', code: 'PT', flag: '🇵🇹' };
  }
  // Estados Unidos Continental: Lat [24.5, 49.4], Lon [-125.0, -66.9]
  if (lat >= 24.0 && lat <= 49.5 && lon >= -125.5 && lon <= -66.0) {
    return { country: 'Estados Unidos', code: 'US', flag: '🇺🇸' };
  }
  // Fallback baseado no fuso
  return estimateCountryFromEnvironment();
}

/**
 * Captura a localização por GPS real do navegador com suporte a precisão e fallback
 */
export function captureGpsLocation(): Promise<GeoLocationData | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      // Sem suporte à API de geolocalização no navegador
      const env = estimateCountryFromEnvironment();
      resolve({
        latitude: -23.5505,
        longitude: -46.6333,
        country: env.country,
        countryCode: env.code,
        flag: env.flag,
        source: 'timezone',
        timestamp: Date.now(),
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy, altitude, speed, heading } = pos.coords;
        const countryData = estimateCountryFromCoordinates(latitude, longitude);

        const loc: GeoLocationData = {
          latitude: Math.round(latitude * 1000000) / 1000000,
          longitude: Math.round(longitude * 1000000) / 1000000,
          accuracy: accuracy ? Math.round(accuracy) : undefined,
          altitude: altitude !== null ? Math.round(altitude) : null,
          speed: speed !== null ? Math.round(speed * 3.6) : null, // km/h
          heading: heading !== null ? Math.round(heading) : null,
          timestamp: pos.timestamp || Date.now(),
          country: countryData.country,
          countryCode: countryData.code,
          flag: countryData.flag,
          source: 'gps',
        };

        resolve(loc);
      },
      (_err) => {
        // Se usuário negou ou deu timeout, usa estimativa de fuso para não deixar a telemetria vazia
        const env = estimateCountryFromEnvironment();
        resolve({
          latitude: -23.5505,
          longitude: -46.6333,
          country: env.country,
          countryCode: env.code,
          flag: env.flag,
          source: 'network',
          timestamp: Date.now(),
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60000,
      }
    );
  });
}

/**
 * Retorna link do Google Maps para abrir a coordenada
 */
export function getGoogleMapsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps?q=${lat},${lon}`;
}

/**
 * Retorna link do OpenStreetMap para abrir a coordenada
 */
export function getOpenStreetMapUrl(lat: number, lon: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;
}
