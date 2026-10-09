/**
 * cellularModemEngine.ts
 * Motor de comunicação celular (3G, 4G LTE, 5G NR), compatibilidade GL.iNet (OpenWrt)
 * e gerenciamento de tethering móvel (USB, Wi-Fi Repeater WISP, Bluetooth PAN).
 * 
 * Funcionalidades:
 * 1. Catálogo de Roteadores GL.iNet suportados (Spitz AX GL-X3000, Beryl AX, Slate AX, Opal, etc.).
 * 2. Modos de Tethering de Celular (USB RNDIS / Apple CDC-NCM, Wi-Fi Hotspot WISP, Bluetooth PAN).
 * 3. Parâmetros de RF Celular (RSRP, RSRQ, SINR, CSQ, Bandas LTE B1/B3/B7/B28 e 5G n78 3.5GHz).
 * 4. Presets de APN para operadoras móveis brasileiras e mundiais (Vivo, Claro, TIM, Algar, etc.).
 * 5. Mangle de TTL e HL (TTL 64 / 65) para contornar restrições de tethering de operadoras no GL.iNet.
 * 6. Interpretador e simulador de Comandos AT de modems celulares (Quectel, Fibocom, Huawei, ZTE).
 * 7. Cliente de API REST para roteadores GL.iNet (IP padrão 192.168.8.1).
 */

// ==========================================
// 1. MODELOS DE ROTEADORES GL.iNet
// ==========================================

export interface GlinetRouterModel {
  id: string;
  name: string;
  category: '5G Gateway' | '4G LTE Gateway' | 'Wi-Fi 6 Travel Router' | 'Mini Router';
  internalCellularModem: boolean;
  supportedModemChips?: string[];
  usbTetheringSupported: boolean;
  repeaterSupported: boolean;
  defaultIp: string;
  description: string;
}

export const GLINET_ROUTERS_CATALOG: GlinetRouterModel[] = [
  {
    id: 'gl_x3000',
    name: 'Spitz AX (GL-X3000)',
    category: '5G Gateway',
    internalCellularModem: true,
    supportedModemChips: ['Quectel RM520N-GL (5G NR Sub-6GHz)', 'Dual SIM Failover'],
    usbTetheringSupported: true,
    repeaterSupported: true,
    defaultIp: '192.168.8.1',
    description: 'Roteador 5G Wi-Fi 6 industrial com modem Quectel interno, dual SIM e portas Gigabit Ethernet.',
  },
  {
    id: 'gl_xe3000',
    name: 'Puli AX (GL-XE3000)',
    category: '5G Gateway',
    internalCellularModem: true,
    supportedModemChips: ['Quectel RM520N-GL 5G', 'Bateria interna de 6400mAh'],
    usbTetheringSupported: true,
    repeaterSupported: true,
    defaultIp: '192.168.8.1',
    description: 'Versão portátil com bateria recarregável do Spitz AX, ideal para operações táticas em campo.',
  },
  {
    id: 'gl_mt3000',
    name: 'Beryl AX (GL-MT3000)',
    category: 'Wi-Fi 6 Travel Router',
    internalCellularModem: false,
    usbTetheringSupported: true,
    repeaterSupported: true,
    defaultIp: '192.168.8.1',
    description: 'Roteador de bolso Wi-Fi 6 com porta USB 3.0 para tethering de celular Android/iPhone ou dongles 4G/5G.',
  },
  {
    id: 'gl_axt1800',
    name: 'Slate AX (GL-AXT1800)',
    category: 'Wi-Fi 6 Travel Router',
    internalCellularModem: false,
    usbTetheringSupported: true,
    repeaterSupported: true,
    defaultIp: '192.168.8.1',
    description: 'Roteador de viagem de alta performance com três portas Gigabit e USB para tethering móvel.',
  },
  {
    id: 'gl_sft1200',
    name: 'Opal (GL-SFT1200)',
    category: 'Mini Router',
    internalCellularModem: false,
    usbTetheringSupported: true,
    repeaterSupported: true,
    defaultIp: '192.168.8.1',
    description: 'Roteador compacto e acessível com suporte a tethering USB de celular e modo repetidor Wi-Fi.',
  },
  {
    id: 'gl_e750',
    name: 'Mudi (GL-E750)',
    category: '4G LTE Gateway',
    internalCellularModem: true,
    supportedModemChips: ['Quectel EP06-E / EP06-A LTE Cat 6'],
    usbTetheringSupported: true,
    repeaterSupported: true,
    defaultIp: '192.168.8.1',
    description: 'Roteador de bolso com modem 4G LTE interno, display OLED e bateria de 7000mAh para privacidade total.',
  },
];

// ==========================================
// 2. MODALIDADES DE TETHERING DE CELULAR
// ==========================================

export type CellularTetheringMode = 'usb_tethering' | 'wifi_repeater' | 'bluetooth_pan' | 'glinet_internal_modem';

export interface TetheringModeInfo {
  id: CellularTetheringMode;
  name: string;
  medium: string;
  typicalMaxSpeed: string;
  latencyMs: string;
  powerConsumption: string;
  setupComplexity: string;
  description: string;
  stepsAndroid: string[];
  stepsIos: string[];
}

export const TETHERING_MODES_INFO: TetheringModeInfo[] = [
  {
    id: 'usb_tethering',
    name: 'Tethering USB (Cabo Direto)',
    medium: 'Cabo USB Tipo-C / Lightning',
    typicalMaxSpeed: 'Até 1 Gbps+ (5G Sub-6 / USB 3.0)',
    latencyMs: '10 a 25 ms (Mínima latência)',
    powerConsumption: 'Carrega o celular pelo roteador / PC',
    setupComplexity: 'Fácil (Plug & Play)',
    description: 'Melhor método em desempenho e estabilidade. O celular atua como uma placa de rede RNDIS ou CDC-NCM de altíssima velocidade.',
    stepsAndroid: [
      'Conecte o celular com cabo USB no roteador GL.iNet ou no computador.',
      'No Android: Vá em Configurações > Rede e Internet > Ponto de acesso e tethering.',
      'Ative a chave "Vínculo USB" (USB Tethering).',
      'O sistema reconhecerá a interface de rede (rndis0 / usb0) imediatamente.',
    ],
    stepsIos: [
      'Conecte o iPhone via cabo USB ao computador ou roteador GL.iNet.',
      'No iPhone: Vá em Ajustes > Acesso Pessoal (Personal Hotspot).',
      'Ative a chave "Permitir Acesso a Outros".',
      'Quando perguntado na tela do iPhone, toque em "Confiar neste Computador".',
    ],
  },
  {
    id: 'wifi_repeater',
    name: 'Repetidor Wi-Fi (WISP Hotspot)',
    medium: 'Wi-Fi 2.4 GHz / 5 GHz',
    typicalMaxSpeed: '50 a 300 Mbps',
    latencyMs: '20 a 45 ms',
    powerConsumption: 'Média / Alta no celular',
    setupComplexity: 'Sem fios',
    description: 'O celular cria um ponto de acesso Wi-Fi portátil e o roteador GL.iNet conecta nele como cliente WISP, repetindo a internet para a rede.',
    stepsAndroid: [
      'No Android: Ative o "Ponto de Acesso Wi-Fi" (Roteador Wi-Fi).',
      'Defina o nome da rede (SSID) e a senha WPA2/WPA3.',
      'No GL.iNet ou no Jjy: Vá em Internet > Repeater e faça uma varredura das redes Wi-Fi.',
      'Selecione a rede do celular, insira a senha e conecte.',
    ],
    stepsIos: [
      'No iPhone: Vá em Ajustes > Acesso Pessoal.',
      'Ative "Permitir Acesso a Outros" e anote a Senha do Wi-Fi.',
      'Mantenha a tela do iPhone aberta na tela de Acesso Pessoal durante a conexão inicial.',
      'No GL.iNet ou Jjy: Conecte à rede Wi-Fi do iPhone.',
    ],
  },
  {
    id: 'bluetooth_pan',
    name: 'Bluetooth PAN Tethering',
    medium: 'Bluetooth 4.2 / 5.0 / 5.3',
    typicalMaxSpeed: '1 a 3 Mbps',
    latencyMs: '50 a 120 ms',
    powerConsumption: 'Ultra Baixa (Economiza bateria)',
    setupComplexity: 'Requer pareamento prévio',
    description: 'Ideal para envio de mensagens de texto e telemetria leve com o mínimo consumo de bateria em situações off-grid.',
    stepsAndroid: [
      'No Android: Ative o Bluetooth e vá em Ponto de Acesso > Vínculo Bluetooth.',
      'Pareie o celular com o computador ou dispositivo GL.iNet.',
      'Conecte à rede PAN (Personal Area Network).',
    ],
    stepsIos: [
      'No iPhone: Ative o Bluetooth e o Acesso Pessoal.',
      'Pareie o iPhone com o computador via Bluetooth.',
      'Selecione o iPhone como conexão de rede nos ajustes Bluetooth do sistema operacional.',
    ],
  },
  {
    id: 'glinet_internal_modem',
    name: 'Modem Celular Integrado (GL.iNet 4G/5G)',
    medium: 'Slot Nano-SIM / eSIM no Roteador',
    typicalMaxSpeed: 'Até 2.5 Gbps (Quectel RM520N 5G)',
    latencyMs: '12 a 30 ms',
    powerConsumption: 'Alimentado pela fonte do roteador',
    setupComplexity: 'Inserir Chip SIM',
    description: 'Utiliza o modem 4G/5G interno embutido em roteadores GL.iNet como Spitz AX ou Puli AX.',
    stepsAndroid: [
      'Insira o chip Nano-SIM da operadora no slot SIM 1 ou SIM 2 do roteador GL.iNet.',
      'Ligue o roteador e aguarde os LEDs de 4G/5G acenderem.',
      'Configure o APN da operadora se necessário.',
    ],
    stepsIos: [
      'Mesmo procedimento via painel web do GL.iNet (192.168.8.1).',
    ],
  },
];

// ==========================================
// 3. PRESETS DE APN DE OPERADORAS MÓVEIS
// ==========================================

export interface CarrierApnPreset {
  carrier: string;
  country: string;
  apn: string;
  user: string;
  pass: string;
  ipType: 'IPv4' | 'IPv4v6';
  preferredBands: string;
}

export const CARRIER_APN_PRESETS: CarrierApnPreset[] = [
  {
    carrier: 'Vivo Brasil',
    country: 'Brasil',
    apn: 'zap.vivo.com.br',
    user: 'vivo',
    pass: 'vivo',
    ipType: 'IPv4v6',
    preferredBands: 'B28 (700MHz), B3 (1800MHz), B7 (2600MHz), n78 (3.5GHz 5G)',
  },
  {
    carrier: 'Claro Brasil',
    country: 'Brasil',
    apn: 'claro.com.br',
    user: 'claro',
    pass: 'claro',
    ipType: 'IPv4v6',
    preferredBands: 'B28, B3, B7, n78 (5G Standalone)',
  },
  {
    carrier: 'TIM Brasil',
    country: 'Brasil',
    apn: 'timbrasil.br',
    user: 'tim',
    pass: 'tim',
    ipType: 'IPv4v6',
    preferredBands: 'B28 (700MHz), B3, B1, n78 (3.5GHz 5G)',
  },
  {
    carrier: 'Algar Telecom',
    country: 'Brasil',
    apn: 'algar.br',
    user: 'algar',
    pass: 'algar',
    ipType: 'IPv4v6',
    preferredBands: 'B3, B7, n78',
  },
  {
    carrier: 'T-Mobile US',
    country: 'EUA',
    apn: 'fast.t-mobile.com',
    user: '',
    pass: '',
    ipType: 'IPv4v6',
    preferredBands: 'B2, B4, B12, B71, n41, n71 (Ultra Capacity)',
  },
  {
    carrier: 'Verizon Wireless',
    country: 'EUA',
    apn: 'vzwinternet',
    user: '',
    pass: '',
    ipType: 'IPv4v6',
    preferredBands: 'B13, B66, n77 (C-Band)',
  },
  {
    carrier: 'Vodafone Europe',
    country: 'Europa',
    apn: 'live.vodafone.com',
    user: '',
    pass: '',
    ipType: 'IPv4v6',
    preferredBands: 'B20 (800MHz), B3, B7, n78',
  },
];

// ==========================================
// 4. PARÂMETROS DE SINAL CELULAR & QUALIDADE RF
// ==========================================

export type CellularTech = '5G_SA' | '5G_NSA' | '4G_LTE_ADV' | '4G_LTE' | '3G_HSPA' | '2G_EDGE' | 'NO_SIGNAL';

export interface CellularSignalMetrics {
  tech: CellularTech;
  carrierName: string;
  rsrpDbm: number;       // Reference Signal Received Power: -140 a -44 dBm
  rsrqDb: number;        // Reference Signal Received Quality: -20 a -3 dB
  sinrDb: number;        // Signal-to-Interference-plus-Noise Ratio: -10 a +30 dB
  csq: number;           // 0 a 31
  primaryBand: string;   // Ex: "B28 (700 MHz)" ou "n78 (3.5 GHz)"
  caBandsCount: number;  // Carrier Aggregation (ex: 3CA)
  barsCount: number;     // 0 a 5 barras
  downloadMbps: number;
  uploadMbps: number;
  pingMs: number;
  dataUsageMb: number;
}

export function classifySignalQuality(rsrpDbm: number): {
  rating: 'Excelente' | 'Boa' | 'Moderada' | 'Fraca' | 'Sem Sinal';
  colorClass: string;
} {
  if (rsrpDbm >= -80) return { rating: 'Excelente', colorClass: 'text-emerald-400' };
  if (rsrpDbm >= -95) return { rating: 'Boa', colorClass: 'text-sky-400' };
  if (rsrpDbm >= -105) return { rating: 'Moderada', colorClass: 'text-amber-400' };
  if (rsrpDbm >= -120) return { rating: 'Fraca', colorClass: 'text-rose-400' };
  return { rating: 'Sem Sinal', colorClass: 'text-slate-500' };
}

// ==========================================
// 5. REGRAS DE MANGLE TTL PARA GL.iNet / OpenWrt
// ==========================================

/**
 * Muitas operadoras móveis inspecionam o campo TTL (Time to Live) dos pacotes IP.
 * Se o pacote tiver TTL 63 (significando que passou por 1 roteador antes de sair do celular),
 * a operadora reduz a velocidade para 128 kbps ou bloqueia a franquia de tethering.
 * 
 * Regra para GL.iNet OpenWrt: Forçar TTL para 64 ou 65, fazendo com que todo o tráfego do PC
 * pareça ser tráfego gerado nativamente dentro do próprio celular!
 */
export const GLINET_TTL_MANGLE_SCRIPT = `# REGRAS DE MANGLE TTL PARA GL.iNet OPENWRT
# Acesse o GL.iNet via SSH (ssh root@192.168.8.1) ou via LuCI > Network > Firewall > Custom Rules
# Aplica TTL 65 em todas as saidas para evitar cobranca / reducao de franquia de tethering:

# Para OpenWrt com iptables (GL.iNet v3.x e anteriores):
iptables -t mangle -I POSTROUTING -o usb0 -j TTL --ttl-set 65
iptables -t mangle -I POSTROUTING -o rndis0 -j TTL --ttl-set 65
iptables -t mangle -I POSTROUTING -o wlan0 -j TTL --ttl-set 65
iptables -t mangle -I PREROUTING -i usb0 -j TTL --ttl-set 65

# Para OpenWrt moderno com nftables (GL.iNet v4.x):
nft add table ip mangle_ttl
nft add chain ip mangle_ttl postrouting { type filter hook postrouting priority mangle \\; }
nft add rule ip mangle_ttl postrouting oifname "usb0" ip ttl set 65
nft add rule ip mangle_ttl postrouting oifname "rndis0" ip ttl set 65
nft add rule ip mangle_ttl postrouting oifname "wlan-sta" ip ttl set 65

# Configurar para persistir no boot em /etc/firewall.user:
echo "iptables -t mangle -I POSTROUTING -j TTL --ttl-set 65" >> /etc/firewall.user
`;

// ==========================================
// 6. COMANDOS AT CELULARES E RESPOSTAS
// ==========================================

export interface CellularAtCommandDef {
  command: string;
  description: string;
  sampleResponse: string;
  explanation: string;
}

export const COMMON_CELLULAR_AT_COMMANDS: CellularAtCommandDef[] = [
  {
    command: 'AT+CSQ',
    description: 'Qualidade do Sinal (Signal Quality)',
    sampleResponse: '+CSQ: 26,99\nOK',
    explanation: 'Retorna RSSI de 0 a 31 (26 = ~ -61 dBm, excelente sinal) e BER de 99.',
  },
  {
    command: 'AT+COPS?',
    description: 'Operadora Atual Conectada',
    sampleResponse: '+COPS: 0,0,"Claro BR",11\nOK',
    explanation: 'Modo automático (0), formato textual, conectada na rede Claro BR em modo 5G/LTE (11).',
  },
  {
    command: 'AT+QNWINFO',
    description: 'Informações da Rede Celular (Quectel)',
    sampleResponse: '+QNWINFO: "FDD LTE","72405","LTE BAND 28",9460\nOK',
    explanation: 'Tecnologia FDD LTE, código da operadora 72405 (Claro), Banda B28 (700MHz), canal 9460.',
  },
  {
    command: 'AT+CEREG?',
    description: 'Status de Registro na Rede EPS/LTE',
    sampleResponse: '+CEREG: 0,1\nOK',
    explanation: 'Indica se o modem está registrado na rede móvel da operadora (1 = registrado na rede de origem).',
  },
  {
    command: 'AT+CGDCONT?',
    description: 'Consultar APNs e Contextos PDP Ativos',
    sampleResponse: '+CGDCONT: 1,"IPV4V6","zap.vivo.com.br","0.0.0.0",0,0\nOK',
    explanation: 'Contexto PDP ID 1 configurado com protocolo dual-stack IPv4v6 no APN zap.vivo.com.br.',
  },
  {
    command: 'AT+QRSRP',
    description: 'Leitura Detalhada de RSRP / SINR das Antenas',
    sampleResponse: '+QRSRP: -78,-82,-80,-85\nOK',
    explanation: 'Níveis de potência recebida em dBm em cada uma das 4 antenas MIMO do modem 5G.',
  },
];
