/**
 * loraMeshEngine.ts
 * Motor de comunicação para redes LoRa (Long Range) e Meshtastic.
 * 
 * Funcionalidades:
 * 1. Conexão WebSerial direta com placas Meshtastic e chips UART/USB básicos (EBYTE E22/E32, Reyax RYLR, Arduino/ESP32).
 * 2. Suporte a frequências regulatórias (BR_915 Brasil, US_915, EU_868, etc.) e modens LoRa (LongFast, LongModerate, etc.).
 * 3. Cálculos de RF: Time-on-Air (ToA), Link Budget, Sensibilidade do receptor e Throughput efetivo.
 * 4. Gerenciamento de Nós Mesh (descoberta, RSSI, SNR, saltos de rota, telemetria de bateria e GPS).
 * 5. Código de Firmware C++ para Arduino/ESP32 DIY com módulos SX1276 / SX1278 / SX1262.
 */

// ==========================================
// 1. CONFIGURAÇÕES REGULATÓRIAS E PRESETS
// ==========================================

export interface LoraRegion {
  id: string;
  name: string;
  freqRangeMhz: string;
  defaultFreqMhz: number;
  maxPowerDbm: number;
  dutyCycleLimitPercent?: number;
  description: string;
}

export const LORA_REGIONS: LoraRegion[] = [
  {
    id: 'BR_915',
    name: 'Brasil (Anatel 915 - 928 MHz)',
    freqRangeMhz: '915.0 - 928.0 MHz',
    defaultFreqMhz: 915.0,
    maxPowerDbm: 30, // 1 Watt permitido com espalhamento espectral
    description: 'Banda ISM brasileira homologada pela Anatel para LoRa e Meshtastic (Slot padrão 915.0 MHz).',
  },
  {
    id: 'US_915',
    name: 'Estados Unidos (FCC 902 - 928 MHz)',
    freqRangeMhz: '902.0 - 928.0 MHz',
    defaultFreqMhz: 906.875,
    maxPowerDbm: 30,
    description: 'Banda ISM FCC para as Américas com canal padrão LongFast em 906.875 MHz.',
  },
  {
    id: 'EU_868',
    name: 'Europa (ETSI 868 MHz)',
    freqRangeMhz: '868.0 - 870.0 MHz',
    defaultFreqMhz: 869.525,
    maxPowerDbm: 14,
    dutyCycleLimitPercent: 1.0,
    description: 'Banda europeia com restrição severa de Duty Cycle de 1% (tempo máximo de transmissão no ar).',
  },
  {
    id: 'AS_923',
    name: 'Ásia / Oceania (920 - 925 MHz)',
    freqRangeMhz: '920.0 - 925.0 MHz',
    defaultFreqMhz: 923.0,
    maxPowerDbm: 16,
    description: 'Padrão utilizado no Japão, Sudeste Asiático, Austrália e Nova Zelândia.',
  },
  {
    id: 'EU_433',
    name: 'Global ISM 433 MHz (SX1278 Ra-02)',
    freqRangeMhz: '433.05 - 434.79 MHz',
    defaultFreqMhz: 433.175,
    maxPowerDbm: 10,
    dutyCycleLimitPercent: 10.0,
    description: 'Frequência muito popular em módulos de baixo custo como Ra-02 SX1278 de 433 MHz.',
  },
];

export interface LoraModemPreset {
  id: string;
  name: string;
  bandwidthKhz: number;
  spreadingFactor: number;
  codingRate: string;
  nominalBitrateBps: number;
  description: string;
}

export const LORA_MODEM_PRESETS: LoraModemPreset[] = [
  {
    id: 'LONG_FAST',
    name: 'LongFast (Meshtastic Default)',
    bandwidthKhz: 250,
    spreadingFactor: 11,
    codingRate: '4/5',
    nominalBitrateBps: 1074,
    description: 'Padrão comunitário mundial do Meshtastic: excelente balanço entre longo alcance e velocidade.',
  },
  {
    id: 'LONG_SLOW',
    name: 'LongSlow (Alcance Extremo / DX)',
    bandwidthKhz: 125,
    spreadingFactor: 12,
    codingRate: '4/8',
    nominalBitrateBps: 183,
    description: 'Máxima penetração através de montanhas e florestas (sensibilidade até -148 dBm), porém muito lento.',
  },
  {
    id: 'LONG_MODERATE',
    name: 'LongModerate (Balanceado)',
    bandwidthKhz: 250,
    spreadingFactor: 10,
    codingRate: '4/5',
    nominalBitrateBps: 1953,
    description: 'Ideal para redes urbanas densas com repetidores nos topos de edifícios.',
  },
  {
    id: 'MEDIUM_FAST',
    name: 'MediumFast (Média Distância)',
    bandwidthKhz: 250,
    spreadingFactor: 9,
    codingRate: '4/5',
    nominalBitrateBps: 3516,
    description: 'Maior velocidade para envio de mensagens com menor tempo no ar.',
  },
  {
    id: 'SHORT_FAST',
    name: 'ShortFast (Alta Velocidade)',
    bandwidthKhz: 500,
    spreadingFactor: 7,
    codingRate: '4/5',
    nominalBitrateBps: 21875,
    description: 'Curto alcance (1-3 km em visada direta) com taxa de dados acima de 21 kbps para envio rápido de arquivos.',
  },
];

// ==========================================
// 2. HARDWARES E MODOS DE CHIP USB
// ==========================================

export type LoraHardwareMode = 'meshtastic_usb' | 'ebyte_e32_transparent' | 'reyax_at_commands' | 'arduino_diy_bridge';

export interface LoraHardwareProfile {
  id: LoraHardwareMode;
  name: string;
  defaultBaudRate: number;
  description: string;
  chipFamily: string;
  typicalBoards: string[];
}

export const LORA_HARDWARE_PROFILES: LoraHardwareProfile[] = [
  {
    id: 'meshtastic_usb',
    name: 'Dispositivo Meshtastic (Oficial / Custom)',
    defaultBaudRate: 115200,
    description: 'Comunicação serial nativa com firmware Meshtastic em nós ESP32 ou nRF52.',
    chipFamily: 'ESP32 / nRF52840 + SX1262',
    typicalBoards: ['LilyGO T-Beam', 'Heltec LoRa32 v3', 'RAK WisBlock 4631', 'Station G2', 'Seeed Xiao ESP32-S3'],
  },
  {
    id: 'ebyte_e32_transparent',
    name: 'EBYTE E22 / E32 (UART Transparente)',
    defaultBaudRate: 9600,
    description: 'Módulos LoRa comerciais prontos com interface UART transparente conectada a conversor USB-Serial (CH340/CP2102).',
    chipFamily: 'EBYTE SX1276 / SX1262 UART',
    typicalBoards: ['EBYTE E32-915T20D', 'EBYTE E22-900T30D (1 Watt)', 'EBYTE E32-433T20D'],
  },
  {
    id: 'reyax_at_commands',
    name: 'Reyax RYLR898 / RYLR998 (Comandos AT)',
    defaultBaudRate: 115200,
    description: 'Módulos LoRa industriais controlados via comandos ASCII AT (ex: AT+SEND=...).',
    chipFamily: 'Semtech SX1276 + MCU AT',
    typicalBoards: ['Reyax RYLR896', 'Reyax RYLR998', 'RAK3172 LoRa AT'],
  },
  {
    id: 'arduino_diy_bridge',
    name: 'Arduino / ESP32 DIY Bridge (Modem Simples)',
    defaultBaudRate: 115200,
    description: 'Qualquer placa Arduino Uno/Nano ou ESP32 com chip LoRa barato (Ra-02, SX1278, SX1262) rodando sketch de modem serial.',
    chipFamily: 'Ra-02 / SX1278 / SX1262',
    typicalBoards: ['Arduino Nano + Ra-02 (433MHz)', 'ESP32 DevKit + SX1262 SPI', 'Raspberry Pi Pico + LoRa'],
  },
];

// ==========================================
// 3. CÁLCULO DE TIME-ON-AIR E RF
// ==========================================

/**
 * Calcula o Tempo no Ar (Time on Air - ToA) em milissegundos para um pacote LoRa.
 * Fórmula Semtech baseada em preâmbulo, SF, BW e payload.
 */
export function calculateLoraTimeOnAir(
  payloadBytes: number,
  sf: number,
  bwKhz: number,
  codingRateNum = 5, // 4/5 = 5
  preambleLength = 8
): { toaMs: number; symbolDurationMs: number } {
  const bwHz = bwKhz * 1000;
  // Duração de 1 símbolo LoRa: Ts = 2^SF / BW
  const symbolDurationMs = (Math.pow(2, sf) / bwHz) * 1000;

  // Duração do preâmbulo: Tpreamble = (Npreamble + 4.25) * Ts
  const preambleTimeMs = (preambleLength + 4.25) * symbolDurationMs;

  // Número de símbolos de payload (LowDataRateOptimize = 1 se SF >= 11 e BW <= 125)
  const ldro = sf >= 11 && bwKhz <= 125 ? 1 : 0;
  const numBits = 8 * payloadBytes - 4 * sf + 28 + 16; // 16 bits de CRC
  const denom = 4 * (sf - 2 * ldro);
  const payloadSymbols = 8 + Math.max(0, Math.ceil(numBits / denom) * codingRateNum);

  const payloadTimeMs = payloadSymbols * symbolDurationMs;
  const toaMs = Math.round((preambleTimeMs + payloadTimeMs) * 10) / 10;

  return {
    toaMs,
    symbolDurationMs: Math.round(symbolDurationMs * 100) / 100,
  };
}

// ==========================================
// 4. ESTRUTURA DE NÓS MESH & PACOTES
// ==========================================

export interface MeshtasticNode {
  nodeId: string;           // Ex: "!a4b892c0"
  shortName: string;        // Ex: "T-BEM"
  longName: string;         // Ex: "LilyGO T-Beam Alpha"
  hardwareModel: string;    // Ex: "T-BEAM v1.1"
  batteryPercent?: number;  // 0 - 100%
  voltage?: number;         // Ex: 4.12 V
  rssi: number;             // Ex: -84 dBm
  snr: number;              // Ex: +8.5 dB
  hopsAway: number;         // 0 = direto, 1 = repetidor, etc.
  latitude?: number;
  longitude?: number;
  altitudeMeters?: number;
  lastHeardSecAgo: number;
  role: 'CLIENT' | 'ROUTER' | 'REPEATER' | 'TRACKER';
}

export interface LoraMeshMessage {
  id: string;
  fromNodeId: string;
  fromName: string;
  toNodeId: string;         // "^all" para broadcast
  channelName: string;      // "Primary", "Public", "Tático", etc.
  text: string;
  timestamp: string;
  rssi?: number;
  snr?: number;
  hopsCount: number;
  isAckReceived?: boolean;
  rawHexPayload?: string;
}

export const INITIAL_MESH_NODES: MeshtasticNode[] = [
  {
    nodeId: '!38f1a04b',
    shortName: 'ME-01',
    longName: 'Nó Local USB (Este Dispositivo)',
    hardwareModel: 'Heltec LoRa32 v3',
    batteryPercent: 96,
    voltage: 4.18,
    rssi: -52,
    snr: 12.0,
    hopsAway: 0,
    latitude: -23.5505,
    longitude: -46.6333,
    altitudeMeters: 760,
    lastHeardSecAgo: 2,
    role: 'CLIENT',
  },
  {
    nodeId: '!7c92b4e1',
    shortName: 'TB-REP',
    longName: 'Repetidor Pico da Serra (T-Beam)',
    hardwareModel: 'LilyGO T-Beam v1.2',
    batteryPercent: 88,
    voltage: 4.02,
    rssi: -86,
    snr: 7.2,
    hopsAway: 1,
    latitude: -23.4980,
    longitude: -46.5920,
    altitudeMeters: 1140,
    lastHeardSecAgo: 45,
    role: 'ROUTER',
  },
  {
    nodeId: '!a14d59f3',
    shortName: 'RAK-03',
    longName: 'Mochila Tática WisBlock',
    hardwareModel: 'RAK WisBlock 4631 Solar',
    batteryPercent: 74,
    voltage: 3.89,
    rssi: -94,
    snr: 3.5,
    hopsAway: 2,
    latitude: -23.5820,
    longitude: -46.6850,
    altitudeMeters: 790,
    lastHeardSecAgo: 110,
    role: 'TRACKER',
  },
];

// ==========================================
// 5. DRIVER WEBSERIAL PARA NAVEGADOR
// ==========================================

export interface WebSerialPortLike {
  open: (options: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
  readable?: { pipeTo: (destination: WritableStream) => Promise<void> };
  writable?: WritableStream;
}

export interface SerialPortController {
  isConnected: boolean;
  port: WebSerialPortLike | null;
  reader: ReadableStreamDefaultReader<Uint8Array> | null;
  writer: WritableStreamDefaultWriter<Uint8Array> | null;
}

/**
 * Conecta a uma porta serial USB pelo navegador via WebSerial API.
 */
export async function connectWebSerialPort(
  baudRate: number,
  onDataReceived: (chunk: string) => void,
  onError: (err: string) => void
): Promise<SerialPortController | null> {
  const navSerial = (navigator as unknown as { serial?: { requestPort: () => Promise<WebSerialPortLike> } }).serial;
  if (!navSerial) {
    onError('WebSerial API não é suportada neste navegador. Use Chrome, Edge ou Opera.');
    return null;
  }

  try {
    const port = await navSerial.requestPort();
    await port.open({ baudRate });

    const textDecoder = new TextDecoderStream();
    port.readable?.pipeTo(textDecoder.writable).catch((e: unknown) => console.warn('Pipe read:', e));
    const reader = (textDecoder.readable as unknown as ReadableStream<Uint8Array>).getReader();

    const textEncoder = new TextEncoderStream();
    textEncoder.readable.pipeTo(port.writable as unknown as WritableStream<Uint8Array>).catch((e: unknown) => console.warn('Pipe write:', e));
    const writer = (textEncoder.writable as unknown as WritableStream<Uint8Array>).getWriter();

    // Loop de leitura assíncrona
    (async () => {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            onDataReceived(value as unknown as string);
          }
        }
      } catch (err: unknown) {
        console.warn('Erro na leitura serial:', err);
      }
    })();

    return {
      isConnected: true,
      port,
      reader: reader as unknown as ReadableStreamDefaultReader<Uint8Array>,
      writer: writer as unknown as WritableStreamDefaultWriter<Uint8Array>,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('No port selected')) {
      onError(`Erro ao abrir porta USB: ${msg}`);
    }
    return null;
  }
}

/**
 * Envia string de texto ou comando para a porta serial conectada.
 */
export async function sendWebSerialCommand(
  controller: SerialPortController,
  commandText: string
): Promise<boolean> {
  if (!controller || !controller.writer) return false;
  try {
    await controller.writer.write(commandText as unknown as Uint8Array);
    return true;
  } catch (err) {
    console.warn('Erro ao escrever serial:', err);
    return false;
  }
}

// ==========================================
// 6. FIRMWARE C++ PARA ARDUINO / ESP32 DIY
// ==========================================

export const ARDUINO_LORA_FIRMWARE_SKETCH = `/*
 * JYY LORA USB SERIAL BRIDGE - FIRMWARE DIY
 * Compatível com Arduino Nano, Uno, ESP32 e módulos SX1276 / SX1278 (Ra-02) / SX1262
 * Biblioteca requerida: Sandeep Mistry "LoRa" (Instalar via Library Manager no Arduino IDE)
 * 
 * Ligações SPI no Arduino / ESP32:
 *  NSS / CS  -> D10 (Arduino) ou GPIO 5 (ESP32)
 *  RST       -> D9  (Arduino) ou GPIO 14 (ESP32)
 *  DIO0 / IRQ-> D2  (Arduino) ou GPIO 2 (ESP32)
 *  MOSI      -> D11 (Arduino) ou GPIO 23 (ESP32)
 *  MISO      -> D12 (Arduino) ou GPIO 19 (ESP32)
 *  SCK       -> D13 (Arduino) ou GPIO 18 (ESP32)
 */

#include <SPI.h>
#include <LoRa.h>

#define LORA_CS_PIN    10   // Modifique para GPIO 5 se usar ESP32
#define LORA_RST_PIN   9    // Modifique para GPIO 14 se usar ESP32
#define LORA_IRQ_PIN   2    // Modifique para GPIO 2 se usar ESP32

#define LORA_FREQUENCY 915E6  // 915 MHz (Brasil/EUA) ou 433E6 (se usar Ra-02 433MHz)

void setup() {
  Serial.begin(115200);
  while (!Serial);

  LoRa.setPins(LORA_CS_PIN, LORA_RST_PIN, LORA_IRQ_PIN);

  if (!LoRa.begin(LORA_FREQUENCY)) {
    Serial.println("[ERROR] Falha ao iniciar modulo LoRa! Verifique conexoes SPI.");
    while (1);
  }

  // Configuracao padrao de longo alcance:
  LoRa.setSpreadingFactor(11);      // SF11 (Estilo Meshtastic LongFast)
  LoRa.setSignalBandwidth(250E3);   // 250 kHz
  LoRa.setCodingRate4(5);           // 4/5
  LoRa.setPreambleLength(8);
  LoRa.setSyncWord(0x2B);           // Sync word do Meshtastic / rede aberta
  LoRa.setTxPower(20);              // 20 dBm (100 mW)

  Serial.println("[READY] JYY LoRa Bridge Ativo em 915.0 MHz (115200 bps)");
}

void loop() {
  // 1. Receber dados da USB (do app Jyy) e transmitir via LoRa RF:
  if (Serial.available() > 0) {
    String outMsg = Serial.readStringUntil('\\n');
    outMsg.trim();
    if (outMsg.length() > 0) {
      LoRa.beginPacket();
      LoRa.print(outMsg);
      LoRa.endPacket();
      Serial.print("[TX_ACK] Enviado via RF: ");
      Serial.println(outMsg);
    }
  }

  // 2. Receber pacotes LoRa do ar e encaminhar para a USB do Jyy:
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String inMsg = "";
    while (LoRa.available()) {
      inMsg += (char)LoRa.read();
    }
    
    // Formato de telemetria recebida:
    Serial.print("[RX_MSG] RSSI=");
    Serial.print(LoRa.packetRssi());
    Serial.print(" SNR=");
    Serial.print(LoRa.packetSnr());
    Serial.print(" DATA=");
    Serial.println(inMsg);
  }
}
`;
