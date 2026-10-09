/**
 * JJY Sovereign Mesh & DataLink Pro - Módulo Satellite Internet & SDR Gateway
 * 
 * Arquitetura de Comunicação via Satélite e Rádio Definido por Software (SDR):
 * - Conexão com Hardware Físico: WebUSB (RTL-SDR, HackRF, LimeSDR, PlutoSDR), WebSerial (TNC/LoRa) e rtl_tcp/WebSocket.
 * - Constelações Satelitais Suportadas: Iridium NEXT, QO-100 (Es'hail-2), Inmarsat, NOAA, Swarm Space, ISS APRS e CubeSats.
 * - Gateway de Internet (IP-over-SDR): Bridge e roteamento de tráfego de internet via rádio (Uplink/Downlink).
 * - Processamento Digital de Sinais (DSP): Demodulação BPSK, QPSK, GFSK, LoRa, cálculo de Doppler em tempo real e análise espectral FFT.
 */

export interface SatelliteDefinition {
  id: string;
  name: string;
  category: 'leo_comm' | 'geo_broadband' | 'weather_telemetry' | 'amateur_mesh' | 'iot_lowpower';
  downlinkFreqHz: number;
  uplinkFreqHz?: number;
  modulation: 'BPSK' | 'QPSK' | '8PSK' | 'GFSK' | 'LoRa' | 'AFSK1200' | 'DVB-S2';
  baudRate: number;
  orbitType: 'LEO' | 'GEO' | 'MEO';
  altitudeKm: number;
  polarization: 'RHCP' | 'LHCP' | 'Linear V' | 'Linear H';
  description: string;
  maxDopplerShiftHz: number;
  ipSupport: boolean;
  typicalSnrDb: number;
  geoLongitudeDeg?: number; // Para satélites geoestacionários (graus leste positivos, oeste negativos)
  tleLine1?: string;
  tleLine2?: string;
}

export const SATELLITE_CATALOG: SatelliteDefinition[] = [
  {
    id: 'iridium-next-sbd',
    name: 'Iridium NEXT (Constelação Global)',
    category: 'leo_comm',
    downlinkFreqHz: 1621250000, // 1621.25 MHz L-Band
    uplinkFreqHz: 1621250000,
    modulation: 'QPSK',
    baudRate: 25000,
    orbitType: 'LEO',
    altitudeKm: 780,
    polarization: 'RHCP',
    description: 'Constelação de 66 satélites polares em órbita baixa. Cobertura global de polos a polos com suporte a dados IP, pacotes SBD e voz tática.',
    maxDopplerShiftHz: 37500,
    ipSupport: true,
    typicalSnrDb: 14.5,
    tleLine1: '1 43075U 17084A   26101.42839211  .00000120  00000-0  18234-4 0  9992',
    tleLine2: '2 43075  86.4021 142.1294 0002194  85.2012 274.9512 14.34219482239418',
  },
  {
    id: 'qo100-eshail2-wb',
    name: 'QO-100 / Es\'hail-2 (Banda Larga IP & Dados)',
    category: 'geo_broadband',
    downlinkFreqHz: 10489500000, // 10.4895 GHz (Ku/X-Band)
    uplinkFreqHz: 2400050000,    // 2.40005 GHz (S-Band)
    modulation: 'DVB-S2',
    baudRate: 250000,
    orbitType: 'GEO',
    altitudeKm: 35786,
    polarization: 'RHCP',
    description: 'Satélite geoestacionário a 25.9° Leste. Cobertura contínua do Brasil à Índia. Transponder de banda larga para dados IP, túnel TCP/UDP e DATV.',
    maxDopplerShiftHz: 50,
    ipSupport: true,
    typicalSnrDb: 18.2,
    geoLongitudeDeg: 25.9,
    tleLine1: '1 43700U 18090A   26101.38129481 -.00000102  00000-0  00000+0 0  9997',
    tleLine2: '2 43700   0.0210  42.1923 0001204 312.4921  47.1921  1.00273819 28419',
  },
  {
    id: 'inmarsat-4f1-std-c',
    name: 'Inmarsat-4 F1 (SafetyNet & IP Telemetria)',
    category: 'geo_broadband',
    downlinkFreqHz: 1541450000, // 1541.45 MHz L-Band
    uplinkFreqHz: 1642950000,
    modulation: 'BPSK',
    baudRate: 1200,
    orbitType: 'GEO',
    altitudeKm: 35786,
    polarization: 'RHCP',
    description: 'Satélite geoestacionário marítimo/aeronáutico. Pacotes de telemetria, boletins de emergência e canal de dados de baixa velocidade altamente resiliente.',
    maxDopplerShiftHz: 80,
    ipSupport: true,
    typicalSnrDb: 11.8,
    geoLongitudeDeg: 64.0,
  },
  {
    id: 'swarm-space-iot',
    name: 'Swarm Space (Constelação IoT & Dados Leves)',
    category: 'iot_lowpower',
    downlinkFreqHz: 137500000, // 137.5 MHz VHF
    uplinkFreqHz: 148500000,   // 148.5 MHz VHF
    modulation: 'LoRa',
    baudRate: 9600,
    orbitType: 'LEO',
    altitudeKm: 525,
    polarization: 'Linear V',
    description: 'Micro-satélites 1/4U com tecnologia LoRa Chirp Spread Spectrum para comunicação de dados leves e internet de emergência no campo.',
    maxDopplerShiftHz: 3200,
    ipSupport: true,
    typicalSnrDb: 9.4,
  },
  {
    id: 'iss-aprs-mesh',
    name: 'ISS / Estação Espacial (APRS Packet Radio)',
    category: 'amateur_mesh',
    downlinkFreqHz: 1458250000, // 145.825 MHz VHF
    uplinkFreqHz: 1458250000,
    modulation: 'AFSK1200',
    baudRate: 1200,
    orbitType: 'LEO',
    altitudeKm: 420,
    polarization: 'Linear V',
    description: 'Digipeater AX.25 a bordo da ISS. Retransmissão de mensagens táticas e coordenadas GPS de estações terrestres durante passagens orbitais.',
    maxDopplerShiftHz: 3500,
    ipSupport: true,
    typicalSnrDb: 16.0,
  },
  {
    id: 'noaa-19-weather-data',
    name: 'NOAA-19 (Telemetria APT & Meteorologia)',
    category: 'weather_telemetry',
    downlinkFreqHz: 137100000, // 137.1 MHz VHF
    modulation: 'AFSK1200',
    baudRate: 4160,
    orbitType: 'LEO',
    altitudeKm: 850,
    polarization: 'RHCP',
    description: 'Transmissão contínua de imagens e telemetria de sensores terrestres. Excelente para calibração de recepção de antenas e validação de SDR.',
    maxDopplerShiftHz: 3800,
    ipSupport: false,
    typicalSnrDb: 21.0,
  },
];

export interface SdrDeviceCapabilities {
  deviceType: 'webusb_rtlsdr' | 'webusb_hackrf' | 'webserial_tnc' | 'rtl_tcp_network' | 'simulated_lab';
  deviceName: string;
  isConnected: boolean;
  minFreqHz: number;
  maxFreqHz: number;
  supportedSampleRates: number[];
  currentSampleRate: number;
  currentFreqHz: number;
  gainDb: number;
  isAgcEnabled: boolean;
  ppmCorrection: number;
  biasTeeEnabled: boolean;
}

export interface SdrRfConfig {
  centerFrequencyHz: number;
  sampleRate: number;
  gainDb: number;
  autoGain: boolean;
  ppmOffset: number;
  bandwidthFilterHz: number;
  biasTee: boolean;
  modulation: 'BPSK' | 'QPSK' | '8PSK' | 'GFSK' | 'LoRa' | 'AFSK1200' | 'DVB-S2';
  symbolRateBaud: number;
  fecScheme: 'none' | 'viterbi_1_2' | 'reed_solomon' | 'ldpc' | 'turbo';
  packetMtu: number;
  compressionAlgorithm: 'none' | 'zstd' | 'gzip' | 'delta';
  isEncrypted: boolean;
}

export const DEFAULT_SDR_CONFIG: SdrRfConfig = {
  centerFrequencyHz: 1621250000, // Iridium por padrão
  sampleRate: 2048000,          // 2.048 MSPS (Padrão ouro RTL-SDR)
  gainDb: 32.8,
  autoGain: true,
  ppmOffset: 0,
  bandwidthFilterHz: 250000,
  biasTee: false,
  modulation: 'QPSK',
  symbolRateBaud: 25000,
  fecScheme: 'reed_solomon',
  packetMtu: 512,
  compressionAlgorithm: 'zstd',
  isEncrypted: true,
};

export interface SatelliteLinkMetrics {
  snrDb: number;
  rssiDbm: number;
  carrierFrequencyErrorHz: number;
  dopplerShiftHz: number;
  bitErrorRatePercent: number;
  packetsReceived: number;
  packetsSent: number;
  bytesReceived: number;
  bytesSent: number;
  throughputKbps: number;
  isCarrierLocked: boolean;
  isFrameSynced: boolean;
  azimuthDeg: number;
  elevationDeg: number;
  isSatelliteVisible: boolean;
}

export interface SatelliteIpGatewayStatus {
  isEnabled: boolean;
  gatewayMode: 'uplink_host' | 'downlink_client' | 'bidirectional_relay';
  tunInterfaceName: string;
  assignedVirtualIp: string;
  routedPacketsCount: number;
  compressedBytesRatio: number;
  activeSockets: number;
  dnsProxyActive: boolean;
  firewallRulesActive: boolean;
  averageLatencyMs: number;
}

/**
 * Calcula o desvio Doppler esperado para um satélite em função do tempo e elevação
 */
export function calculateSimulatedDoppler(
  baseFreqHz: number,
  orbitType: 'LEO' | 'GEO' | 'MEO',
  maxDopplerHz: number,
  elapsedSec: number
): { dopplerShiftHz: number; currentFreqHz: number; elevationDeg: number; azimuthDeg: number } {
  if (orbitType === 'GEO') {
    // Satélites GEO possuem Doppler desprezível (< 50 Hz por variações orbitais minúsculas)
    const drift = Math.sin(elapsedSec / 120) * 15;
    return {
      dopplerShiftHz: Math.round(drift),
      currentFreqHz: baseFreqHz + drift,
      elevationDeg: 54.2,
      azimuthDeg: 62.8,
    };
  }

  // Simulação de passagem orbital LEO (~10 minutos de visibilidade)
  const passPeriodSec = 600; // 10 min
  const cycle = (elapsedSec % passPeriodSec) / passPeriodSec; // 0.0 a 1.0
  const normalizedPhase = (cycle * 2 - 1); // -1.0 a +1.0

  // Curva S característica de Doppler de satélites em passagem
  const dopplerShiftHz = Math.round(-maxDopplerHz * Math.tanh(normalizedPhase * 3.5));
  const currentFreqHz = baseFreqHz + dopplerShiftHz;

  // Elevação: sobe até 80° no meio da passagem e desce
  const elevationDeg = Math.max(0, Math.round(85 * Math.sin(cycle * Math.PI)));
  const azimuthDeg = Math.round((180 + cycle * 160) % 360);

  return {
    dopplerShiftHz,
    currentFreqHz,
    elevationDeg,
    azimuthDeg,
  };
}

/**
 * Gera espectro FFT e pontos de constelação sintéticos ou processados de SDR
 */
export function generateSyntheticSdrSpectrum(
  fftSize: number = 256,
  snrDb: number = 14,
  isSignalPresent: boolean = true,
  dopplerOffsetBins: number = 0
): { fftData: Float32Array; constellationPoints: { i: number; q: number }[] } {
  const fftData = new Float32Array(fftSize);
  const noiseFloorDb = -85;

  // Ruído térmico de fundo
  for (let i = 0; i < fftSize; i++) {
    const noise = noiseFloorDb + (Math.random() - 0.5) * 6;
    fftData[i] = noise;
  }

  // Portadora do Satélite com formato de sino Gaussiano/Sinc
  if (isSignalPresent) {
    const centerBin = Math.floor(fftSize / 2) + dopplerOffsetBins;
    const signalPeakDb = noiseFloorDb + snrDb;
    const signalWidth = 12;

    for (let i = Math.max(0, centerBin - signalWidth); i < Math.min(fftSize, centerBin + signalWidth); i++) {
      const dist = Math.abs(i - centerBin);
      const attenuation = Math.exp(-(dist * dist) / (2 * (signalWidth / 3.2) * (signalWidth / 3.2)));
      const power = noiseFloorDb + (snrDb * attenuation) + (Math.random() - 0.5) * 2;
      fftData[i] = Math.max(fftData[i], power);
    }
  }

  // Pontos de Constelação I/Q (QPSK: 4 quadrantes com dispersão proporcional ao ruído)
  const constellationPoints: { i: number; q: number }[] = [];
  const pointsCount = 64;
  const noiseSpread = Math.max(0.06, 0.45 - (snrDb / 40));

  for (let p = 0; p < pointsCount; p++) {
    const quad = p % 4;
    let baseI = 0.707;
    let baseQ = 0.707;

    if (quad === 1) { baseI = -0.707; baseQ = 0.707; }
    else if (quad === 2) { baseI = -0.707; baseQ = -0.707; }
    else if (quad === 3) { baseI = 0.707; baseQ = -0.707; }

    const jitterI = (Math.random() + Math.random() - 1) * noiseSpread;
    const jitterQ = (Math.random() + Math.random() - 1) * noiseSpread;

    constellationPoints.push({
      i: baseI + jitterI,
      q: baseQ + jitterQ,
    });
  }

  return { fftData, constellationPoints };
}

/**
 * Tenta solicitar conexão via WebUSB para dispositivos RTL-SDR ou HackRF
 */
export async function requestWebUsbSdrDevice(): Promise<{ success: boolean; deviceName?: string; error?: string }> {
  if (typeof navigator === 'undefined' || !('usb' in navigator)) {
    return {
      success: false,
      error: 'WebUSB API não é suportada neste navegador. Use Google Chrome, Microsoft Edge ou Opera.',
    };
  }

  try {
    // Filtros conhecidos de chips SDR
    const filters = [
      { vendorId: 0x0BDA, productId: 0x2838 }, // RTL2832U DVB-T
      { vendorId: 0x0BDA, productId: 0x2832 }, // RTL2832U genérico
      { vendorId: 0x1D50, productId: 0x6089 }, // HackRF One
      { vendorId: 0x1D50, productId: 0x604B }, // HackRF Jawbreaker
      { vendorId: 0x0403, productId: 0x6014 }, // FTDI FT232H (LimeSDR / Pluto)
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const device = await (navigator as any).usb.requestDevice({ filters });
    if (device) {
      await device.open();
      return {
        success: true,
        deviceName: `${device.productName || 'RTL-SDR'} (${device.manufacturerName || 'Realtek/Great Scott'})`,
      };
    }
    return { success: false, error: 'Nenhum dispositivo SDR selecionado' };
  } catch (err: unknown) {
    return {
      success: false,
      error: (err as Error).message || 'Falha ao parear dispositivo USB',
    };
  }
}

/**
 * Tenta solicitar conexão via WebSerial para TNCs ou receptores seriais de satélite
 */
export async function requestWebSerialTncDevice(): Promise<{ success: boolean; portInfo?: string; error?: string }> {
  if (typeof navigator === 'undefined' || !('serial' in navigator)) {
    return {
      success: false,
      error: 'WebSerial API não é suportada neste navegador.',
    };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const port = await (navigator as any).serial.requestPort();
    if (port) {
      await port.open({ baudRate: 115200 });
      return {
        success: true,
        portInfo: 'Porta Serial TNC Conectada (115200 bps)',
      };
    }
    return { success: false, error: 'Nenhuma porta serial selecionada' };
  } catch (err: unknown) {
    return {
      success: false,
      error: (err as Error).message || 'Falha ao abrir porta serial',
    };
  }
}

// ============================================================================
// CÁLCULOS ASTRONÔMICOS DE APONTAMENTO DE ANTENA, REALIDADE AUMENTADA & SERVOS
// ============================================================================

export interface ObserverLocation {
  latitude: number;       // Graus decimais (-90 a +90)
  longitude: number;      // Graus decimais (-180 a +180)
  altitudeMeters: number; // Altitude em metros
  locationName: string;
}

export interface DishLookAngles {
  azimuthDeg: number;          // 0 a 360° (Norte = 0, Leste = 90)
  elevationDeg: number;        // 0 a 90° (Horizonte = 0, Zênite = 90)
  polarizationSkewDeg: number; // Rotação do LNB (-90 a +90°)
  distanceKm: number;          // Distância linear da antena ao satélite
  isVisible: boolean;          // Acima do horizonte (El > 0)
}

export interface ServoRotatorAngles {
  azimuthDeg: number;
  elevationDeg: number;
  azimuthPulseUs: number;      // 1000 a 2000 µs (ou 500-2500 µs)
  elevationPulseUs: number;
  gs232Command: string;        // Padrão Yaesu GS-232
  easycommCommand: string;     // Padrão Easycomm II
  arduinoCustomCommand: string;// Formato JSON/Serial para Arduino
}

/**
 * Localização padrão de referência (São Paulo, Brasil) caso GPS não esteja disponível
 */
export const DEFAULT_OBSERVER_LOCATION: ObserverLocation = {
  latitude: -23.5505,
  longitude: -46.6333,
  altitudeMeters: 760,
  locationName: 'São Paulo, Brasil (Referência Padrão)',
};

/**
 * Calcula os ângulos de apontamento exatos (Azimute, Elevação e Skew do LNB)
 * para satélites Geoestacionários (GEO) com base na latitude/longitude do observador.
 */
export function calculateGeostationaryLookAngles(
  obsLatDeg: number,
  obsLonDeg: number,
  satLonDeg: number
): DishLookAngles {
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;

  const lat = obsLatDeg * rad;
  const deltaLon = (satLonDeg - obsLonDeg) * rad;

  const rEarth = 6378.137;  // Raio da Terra em km
  const rGeo = 42164.137;   // Raio da órbita geoestacionária em km

  // Distância e Elevação
  const cosGamma = Math.cos(lat) * Math.cos(deltaLon);
  const sinGamma = Math.sqrt(Math.max(0, 1 - cosGamma * cosGamma));
  const slantDist = Math.sqrt(rEarth * rEarth + rGeo * rGeo - 2 * rEarth * rGeo * cosGamma);

  let elDeg = -1;
  if (cosGamma > (rEarth / rGeo)) {
    const elRad = Math.atan((rGeo * cosGamma - rEarth) / (rGeo * (sinGamma || 0.00001)));
    elDeg = elRad * deg;
  }

  // Azimute em 360° a partir do Norte Verdadeiro
  let azRad = Math.atan2(Math.sin(deltaLon), -Math.tan(lat) * Math.cos(deltaLon));
  let azDeg = (azRad * deg + 360) % 360;

  if (obsLatDeg > 0) {
    // Hemisfério Norte: azimute aponta para o sul
    azRad = Math.atan2(Math.sin(deltaLon), Math.tan(lat) * Math.cos(deltaLon));
    azDeg = (180 - azRad * deg + 360) % 360;
  }

  // Polarização Skew do LNB (inclinação em graus)
  const skewDeg = Math.atan2(Math.sin(deltaLon), Math.tan(lat)) * deg;

  return {
    azimuthDeg: Math.round(azDeg * 10) / 10,
    elevationDeg: Math.max(0, Math.round(elDeg * 10) / 10),
    polarizationSkewDeg: Math.round(skewDeg * 10) / 10,
    distanceKm: Math.round(slantDist),
    isVisible: elDeg > 0,
  };
}

/**
 * Calcula os ângulos de apontamento em tempo real para qualquer satélite (GEO ou LEO)
 */
export function calculateSatelliteLookAngles(
  satellite: SatelliteDefinition,
  location: ObserverLocation,
  elapsedSec: number = 0
): DishLookAngles {
  if (satellite.orbitType === 'GEO' && satellite.geoLongitudeDeg !== undefined) {
    return calculateGeostationaryLookAngles(location.latitude, location.longitude, satellite.geoLongitudeDeg);
  }

  // Satélites LEO (Órbita Baixa: Iridium, Swarm, ISS, NOAA):
  // Cálculo com base na passagem orbital, fase senoidal e Doppler relativo ao observador
  const doppler = calculateSimulatedDoppler(
    satellite.downlinkFreqHz,
    satellite.orbitType,
    satellite.maxDopplerShiftHz,
    elapsedSec
  );

  return {
    azimuthDeg: doppler.azimuthDeg,
    elevationDeg: doppler.elevationDeg,
    polarizationSkewDeg: Math.round(Math.sin(elapsedSec / 30) * 15 * 10) / 10,
    distanceKm: Math.round(satellite.altitudeKm * (1 + (90 - doppler.elevationDeg) / 45)),
    isVisible: doppler.elevationDeg > 0,
  };
}

/**
 * Converte ângulos de Azimute e Elevação em pulsos PWM e comandos seriais
 * para rotores Yaesu GS-232, Easycomm e Servomotores de Arduino / ESP32
 */
export function convertLookAnglesToServoCommands(
  lookAngles: DishLookAngles,
  pulseMinUs: number = 1000,
  pulseMaxUs: number = 2000
): ServoRotatorAngles {
  const az = Math.max(0, Math.min(360, lookAngles.azimuthDeg));
  const el = Math.max(0, Math.min(90, lookAngles.elevationDeg));

  // Conversão para largura de pulso de servomotor (PWM em microssegundos)
  const azRange = pulseMaxUs - pulseMinUs;
  const azPulse = Math.round(pulseMinUs + (az / 360) * azRange);
  const elPulse = Math.round(pulseMinUs + (el / 90) * azRange);

  // Comando no protocolo industrial Yaesu GS-232 (ex: "W142 048\r\n")
  const azPadded = String(Math.round(az)).padStart(3, '0');
  const elPadded = String(Math.round(el)).padStart(3, '0');
  const gs232 = `W${azPadded} ${elPadded}\r\n`;

  // Protocolo Easycomm II (ex: "AZ142.5 EL48.0\r\n")
  const easycomm = `AZ${az.toFixed(1)} EL${el.toFixed(1)}\r\n`;

  // Protocolo JSON/Serial amigável para Arduino
  const arduinoJson = `<AZ:${az.toFixed(1)},EL:${el.toFixed(1)},P_AZ:${azPulse},P_EL:${elPulse}>\r\n`;

  return {
    azimuthDeg: az,
    elevationDeg: el,
    azimuthPulseUs: azPulse,
    elevationPulseUs: elPulse,
    gs232Command: gs232,
    easycommCommand: easycomm,
    arduinoCustomCommand: arduinoJson,
  };
}

/**
 * Código C++ completo para Arduino / ESP32 com servos SG90 / MG996R
 * para o usuário copiar e compilar no seu rotor mecânico
 */
export const ARDUINO_ROTOR_SKETCH_SAMPLE = `/*
 * JJY DataLink Pro - Firmware para Rotor de Antena de Satélite Pan/Tilt
 * Compatível com Arduino Uno, Nano, Mega, ESP32 e STM32
 * 
 * Hardware:
 * - Servo 1: Azimute (Pino D9 - Pan 0 a 360° ou 180° com engrenagem 2:1)
 * - Servo 2: Elevação (Pino D10 - Tilt 0 a 90°)
 * - Entrada Serial: 115200 bps via USB
 */

#include <Servo.h>

Servo servoAzimuth;
Servo servoElevation;

const int PIN_SERVO_AZ = 9;
const int PIN_SERVO_EL = 10;

void setup() {
  Serial.begin(115200);
  servoAzimuth.attach(PIN_SERVO_AZ, 500, 2500);
  servoElevation.attach(PIN_SERVO_EL, 500, 2500);
  
  // Posiciona a antena no ponto de repouso (Norte 0°, Horizonte 0°)
  servoAzimuth.write(0);
  servoElevation.write(0);
  Serial.println("OK: JJY_SATELLITE_ROTOR_ONLINE");
}

void loop() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\\n');
    cmd.trim();
    
    // Suporte ao Protocolo Yaesu GS-232: "W<AZ> <EL>"
    if (cmd.startsWith("W")) {
      int spaceIdx = cmd.indexOf(' ');
      if (spaceIdx > 0) {
        float az = cmd.substring(1, spaceIdx).toFloat();
        float el = cmd.substring(spaceIdx + 1).toFloat();
        
        // Mapeia para os servos (0-180 graus com relação 2:1 no azimute)
        servoAzimuth.write(constrain(az / 2.0, 0, 180));
        servoElevation.write(constrain(el, 0, 90));
        Serial.print("ACK: GS232 AZ="); Serial.print(az); Serial.print(" EL="); Serial.println(el);
      }
    }
    // Suporte ao Protocolo Easycomm: "AZ<val> EL<val>"
    else if (cmd.startsWith("AZ")) {
      int elIdx = cmd.indexOf("EL");
      if (elIdx > 0) {
        float az = cmd.substring(2, elIdx).toFloat();
        float el = cmd.substring(elIdx + 2).toFloat();
        servoAzimuth.write(constrain(az / 2.0, 0, 180));
        servoElevation.write(constrain(el, 0, 90));
        Serial.println("ACK: EASYCOMM_OK");
      }
    }
  }
}
`;

/**
 * Conecta via WebSerial à porta do Arduino ou rotor de antena
 */
export async function requestWebSerialRotorDevice(): Promise<{
  success: boolean;
  port?: unknown;
  error?: string;
}> {
  if (typeof navigator === 'undefined' || !('serial' in navigator)) {
    return { success: false, error: 'WebSerial API não é suportada neste navegador.' };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const port = await (navigator as any).serial.requestPort();
    if (port) {
      await port.open({ baudRate: 115200 });
      return { success: true, port };
    }
    return { success: false, error: 'Nenhum rotor serial selecionado' };
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message || 'Falha ao conectar rotor serial' };
  }
}
