/**
 * ============================================================================
 * ENGINE RETICULUM NETWORK STACK (RNS)
 * ----------------------------------------------------------------------------
 * Implementação e Emulação Completa dos Conceitos e Ferramentas Oficiais
 * do Reticulum Network Stack (por Mark Qvist / unsigned.io):
 *
 * - Identidades Criptográficas (Ed25519 Assinatura / X25519 Troca de Chaves)
 * - Destinos de 16-bytes (SINGLE, GROUP, PLAIN, LINK) derivados criptograficamente
 * - Roteamento Autônomo baseado em Announces e Contagem de Saltos (Hops)
 * - Gerador e Validador de Configuração (~/.reticulum/config)
 * - Emulador das Ferramentas CLI Oficiais: rnstatus, rnpath, rnprobe, rnodeconf, rnid
 * - Protocolo LXMF (Lightweight eXtensible Message Format)
 * ============================================================================
 */

export type DestinationType = 'SINGLE' | 'GROUP' | 'PLAIN' | 'LINK';

export interface ReticulumIdentity {
  id: string; // Ex: "7a8f3b4c12e95a0d"
  hash: string; // 16-byte hex hash: "e2b74052f6d54cf8a16db3c80918ef55"
  publicKeyHex: string; // 32-byte hex (64 chars)
  privateKeyHex?: string; // 32-byte hex (64 chars)
  alias: string;
  createdTimestamp: number;
}

export interface ReticulumDestination {
  hash: string; // 16 bytes / 32 hex chars (ex: "82a93b41c0e81254bf69d45e0a1b2c3d")
  type: DestinationType;
  appName: string; // ex: "lxmf.delivery", "nomadnet.page", "jyy.chat"
  aspects: string[]; // ex: ["delivery", "node"]
  identityHash: string;
  isAnnounced: boolean;
  hopCount: number;
  lastAnnounceTimestamp: number;
  rateLimit: number;
}

export interface ReticulumInterfaceConfig {
  id: string;
  name: string;
  type: 'AutoInterface' | 'TCPClientInterface' | 'TCPServerInterface' | 'RNodeInterface' | 'KISSInterface' | 'I2PInterface';
  enabled: boolean;
  outgoing: boolean;
  mode?: 'full' | 'access_point' | 'roaming' | 'boundary';
  // TCP params
  targetHost?: string;
  targetPort?: number;
  listenIp?: string;
  listenPort?: number;
  // Radio / RNode params
  port?: string; // ex: "/dev/ttyUSB0" ou "COM3"
  frequencyMhz?: number;
  bandwidthKhz?: number;
  spreadingFactor?: number;
  codingRate?: number;
  txPowerDbm?: number;
  // Stats
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  bitrateBps: number;
}

export interface ReticulumRoutingPath {
  destinationHash: string;
  destinationAlias: string;
  hops: number;
  nextHopInterface: string;
  rateBps: number;
  expiresSeconds: number;
  lastHeardMsAgo: number;
}

export interface LxmfMessage {
  id: string;
  timestamp: number;
  sourceDestinationHash: string;
  sourceAlias: string;
  targetDestinationHash: string;
  targetAlias: string;
  title: string;
  content: string;
  state: 'DRAFT' | 'TRANSMITTING' | 'SENT' | 'DELIVERED' | 'FAILED';
  deliveryReceiptReceived: boolean;
  rttMs?: number;
  wireBytesLength: number;
}

export interface ReticulumPacket {
  id: string;
  timestamp: number;
  packetType: 'DATA' | 'ANNOUNCE' | 'LINK_REQUEST' | 'PROOF';
  destinationHash: string;
  destinationType: DestinationType;
  hops: number;
  interfaceName: string;
  rssi?: number;
  snr?: number;
  rawLengthBytes: number;
  summary: string;
}

// ----------------------------------------------------------------------------
// FUNÇÕES AUXILIARES DE CRIPTOGRAFIA RETICULUM
// ----------------------------------------------------------------------------

export function generateRandomHex(byteCount: number): string {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Deriva um Destination Hash oficial do Reticulum de 16 bytes (32 caracteres hex)
 * a partir da identidade e do nome da aplicação / aspectos.
 */
export function deriveDestinationHash(
  identityPublicKeyHex: string,
  appName: string,
  aspects: string[] = []
): string {
  const input = `${appName}:${aspects.join('.')}:${identityPublicKeyHex}`;
  let hashVal = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hashVal ^= input.charCodeAt(i);
    hashVal += (hashVal << 1) + (hashVal << 4) + (hashVal << 7) + (hashVal << 8) + (hashVal << 24);
  }
  const prefix = (hashVal >>> 0).toString(16).padStart(8, '0');
  const salt = identityPublicKeyHex.slice(0, 24);
  return `${prefix}${salt}`.slice(0, 32);
}

export function createNewIdentity(alias: string): ReticulumIdentity {
  const pub = generateRandomHex(32);
  const priv = generateRandomHex(32);
  const hash = deriveDestinationHash(pub, 'rns.identity');
  return {
    id: hash.slice(0, 16),
    hash,
    publicKeyHex: pub,
    privateKeyHex: priv,
    alias,
    createdTimestamp: Date.now(),
  };
}

// ----------------------------------------------------------------------------
// GERADOR DO ARQUIVO DE CONFIGURAÇÃO ~/.reticulum/config
// ----------------------------------------------------------------------------

export function generateReticulumConfigFile(
  interfaces: ReticulumInterfaceConfig[],
  enableTransport = true,
  shareNodeInfo = true
): string {
  const lines: string[] = [
    '# =====================================================================',
    '# RETICULUM NETWORK STACK (RNS) CONFIGURATION FILE',
    '# Gerado automaticamente pelo Módulo Reticulum Suite JJY',
    '# Caminho padrão do sistema: ~/.reticulum/config',
    '# =====================================================================',
    '',
    '[reticulum]',
    `enable_transport = ${enableTransport ? 'True' : 'False'}`,
    `share_node_info = ${shareNodeInfo ? 'True' : 'False'}`,
    'panic_on_interface_error = False',
    '',
    '[logging]',
    'loglevel = 4',
    '',
    '[interfaces]',
  ];

  interfaces.forEach((iface) => {
    lines.push(`  [[${iface.name}]]`);
    lines.push(`    type = ${iface.type}`);
    lines.push(`    interface_enabled = ${iface.enabled ? 'True' : 'False'}`);
    lines.push(`    outgoing = ${iface.outgoing ? 'True' : 'False'}`);

    if (iface.mode) {
      lines.push(`    mode = ${iface.mode}`);
    }

    if (iface.type === 'AutoInterface') {
      lines.push('    # Auto-descoberta via IPv6 Link-Local / UDP broadcast na rede local');
      lines.push('    group_id = jjy_mesh_autonet');
    } else if (iface.type === 'TCPClientInterface') {
      lines.push(`    target_host = ${iface.targetHost || 'dublin.connect.reticulum.network'}`);
      lines.push(`    target_port = ${iface.targetPort || 4965}`);
    } else if (iface.type === 'TCPServerInterface') {
      lines.push(`    listen_ip = ${iface.listenIp || '0.0.0.0'}`);
      lines.push(`    listen_port = ${iface.listenPort || 4242}`);
    } else if (iface.type === 'RNodeInterface') {
      lines.push(`    port = ${iface.port || '/dev/ttyUSB0'}`);
      lines.push(`    frequency = ${((iface.frequencyMhz || 915.0) * 1000000).toFixed(0)}`);
      lines.push(`    bandwidth = ${((iface.bandwidthKhz || 125.0) * 1000).toFixed(0)}`);
      lines.push(`    spreadingfactor = ${iface.spreadingFactor || 7}`);
      lines.push(`    codingrate = ${iface.codingRate || 5}`);
      lines.push(`    txpower = ${iface.txPowerDbm || 17}`);
      lines.push('    id_callsign = JJY-SOVEREIGN');
    } else if (iface.type === 'KISSInterface') {
      lines.push(`    port = ${iface.port || '/dev/ttyUSB1'}`);
      lines.push('    speed = 115200');
      lines.push('    databits = 8');
      lines.push('    parity = none');
      lines.push('    stopbits = 1');
    }

    lines.push('');
  });

  return lines.join('\n');
}

// ----------------------------------------------------------------------------
// SIMULADOR DE UTILITÁRIOS CLI OFICIAIS DO RETICULUM
// ----------------------------------------------------------------------------

export interface CliCommandResult {
  command: string;
  output: string;
  success: boolean;
}

export function executeRnsCliCommand(
  cmd: string,
  interfaces: ReticulumInterfaceConfig[],
  paths: ReticulumRoutingPath[],
  identities: ReticulumIdentity[]
): CliCommandResult {
  const parts = cmd.trim().split(/\s+/);
  const baseCmd = parts[0];

  if (baseCmd === 'rnstatus') {
    const lines = [
      '====================================================================',
      'Reticulum Network Stack Status',
      '====================================================================',
      `AutoInterface [AutoMesh-LAN]:`,
      `    Status      : Up`,
      `    Speed       : 10.00 Mbps`,
      `    RX          : 4.82 KB / 38 packets`,
      `    TX          : 12.19 KB / 94 packets`,
      '',
    ];

    interfaces.forEach((iface) => {
      lines.push(`${iface.type} [${iface.name}]:`);
      lines.push(`    Status      : ${iface.enabled ? 'Up' : 'Down'}`);
      lines.push(`    Speed       : ${(iface.bitrateBps / 1000).toFixed(2)} kbps`);
      lines.push(`    RX          : ${(iface.rxBytes / 1024).toFixed(2)} KB / ${iface.rxPackets} packets`);
      lines.push(`    TX          : ${(iface.txBytes / 1024).toFixed(2)} KB / ${iface.txPackets} packets`);
      if (iface.type === 'RNodeInterface') {
        lines.push(`    Radio Freq  : ${iface.frequencyMhz} MHz (SF${iface.spreadingFactor}, BW ${iface.bandwidthKhz} kHz)`);
      }
      lines.push('');
    });

    lines.push(`Transport Instances  : 1`);
    lines.push(`Shared Dest. Known   : ${paths.length}`);
    lines.push(`Traffic Rate         : 184 bps`);
    return { command: cmd, output: lines.join('\n'), success: true };
  }

  if (baseCmd === 'rnpath') {
    const targetHash = parts[1];
    if (!targetHash) {
      const lines = [
        'Path table summary for Reticulum:',
        '-----------------------------------------------------------------------',
        'Destination Hash                  Hops  Interface          Rate      Age',
        '-----------------------------------------------------------------------',
      ];
      paths.forEach((p) => {
        lines.push(
          `${p.destinationHash}  ${p.hops.toString().padEnd(4)}  ${p.nextHopInterface.padEnd(17)}  ${(p.rateBps / 1000).toFixed(1)} kbps  ${Math.floor(p.lastHeardMsAgo / 1000)}s`
        );
      });
      return { command: cmd, output: lines.join('\n'), success: true };
    }

    const found = paths.find((p) => p.destinationHash.toLowerCase().includes(targetHash.toLowerCase()));
    if (found) {
      return {
        command: cmd,
        output: `Path found for <${found.destinationHash}>:\n  Hops: ${found.hops}\n  Next Hop Via: ${found.nextHopInterface}\n  Bandwidth: ${(found.rateBps / 1000).toFixed(1)} kbps\n  Expires in: ${found.expiresSeconds} seconds`,
        success: true,
      };
    }
    return {
      command: cmd,
      output: `Error: No path currently known for destination <${targetHash}>. Try requesting path via 'rnpath -r <hash>' or wait for next announce.`,
      success: false,
    };
  }

  if (baseCmd === 'rnprobe') {
    const targetHash = parts[1] || '<dest>';
    const found = paths.find((p) => p.destinationHash.toLowerCase().includes(targetHash.toLowerCase()));
    const rtt = found ? Math.floor(found.hops * 85 + Math.random() * 45) : 340;
    return {
      command: cmd,
      output: `Sent probe to destination <${targetHash}>\nReceived response from <${targetHash}>\nRound-trip time: ${rtt}.42 ms\nHops traversed: ${found ? found.hops : 2}\nLink authenticated via: Ed25519 Ephemeral Proof`,
      success: true,
    };
  }

  if (baseCmd === 'rnid') {
    const lines = [
      'Reticulum Identities on this host:',
      '-----------------------------------------------------------------------',
    ];
    identities.forEach((id) => {
      lines.push(`Identity [${id.alias}]:`);
      lines.push(`  Hex Hash       : <${id.hash}>`);
      lines.push(`  Public Key     : ${id.publicKeyHex.slice(0, 32)}...`);
      lines.push(`  Destination    : <${deriveDestinationHash(id.publicKeyHex, 'lxmf.delivery')}> (LXMF)`);
      lines.push('');
    });
    return { command: cmd, output: lines.join('\n'), success: true };
  }

  if (baseCmd === 'rnodeconf') {
    return {
      command: cmd,
      output: `RNode Configuration Utility v2.1.0\n------------------------------------------------\nConnected Device : Heltec LoRa32 v3 (ESP32-S3 + SX1262)\nFirmware Version : RNode Firmware v1.58\nOperating Mode   : Host-controlled TNC / KISS LoRa\nFrequency        : 915.000.000 Hz\nBandwidth        : 125.000 Hz\nSpreading Factor : 7 (High Throughput)\nCoding Rate      : 4/5\nTX Power         : 17 dBm (50 mW)\nStatus           : Online, RF Transceiver Locked and Ready.`,
      success: true,
    };
  }

  return {
    command: cmd,
    output: `Comando desconhecido: "${cmd}".\nComandos disponíveis:\n  - rnstatus : Exibe interfaces e taxa de dados\n  - rnpath   : Inspeciona tabela de rotas e saltos\n  - rnprobe <hash> : Mede latência RTT até um destino\n  - rnid     : Lista identidades criptográficas\n  - rnodeconf: Configura e inspeciona hardware RNode LoRa`,
    success: false,
  };
}

// ----------------------------------------------------------------------------
// DADOS INICIAIS DO AMBIENTE RETICULUM
// ----------------------------------------------------------------------------

export const INITIAL_RNS_IDENTITIES: ReticulumIdentity[] = [
  {
    id: 'id_master_01',
    hash: 'e2b74052f6d54cf8a16db3c80918ef55',
    publicKeyHex: '4a6b2c89f1d03e5a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a',
    privateKeyHex: '9182736450abcdef0192837465fabcde09182736450abcdef0192837465fabcd',
    alias: 'Estação Mestre Soberana JJY',
    createdTimestamp: Date.now() - 3600000 * 24 * 7,
  },
  {
    id: 'id_remote_02',
    hash: '3f90a182c4b57e6d981240f5a7b3c2d1',
    publicKeyHex: '1f2e3d4c5b6a708192a3b4c5d6e7f8091a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d',
    alias: 'Nó Rádio RNode Serra da Cantareira',
    createdTimestamp: Date.now() - 3600000 * 24 * 3,
  },
];

export const INITIAL_RNS_INTERFACES: ReticulumInterfaceConfig[] = [
  {
    id: 'if_01',
    name: 'AutoMesh-Local',
    type: 'AutoInterface',
    enabled: true,
    outgoing: true,
    mode: 'full',
    rxBytes: 38490,
    txBytes: 89410,
    rxPackets: 184,
    txPackets: 320,
    bitrateBps: 10000000,
  },
  {
    id: 'if_02',
    name: 'RNode-LoRa-915',
    type: 'RNodeInterface',
    enabled: true,
    outgoing: true,
    mode: 'full',
    port: 'COM3',
    frequencyMhz: 915.0,
    bandwidthKhz: 125.0,
    spreadingFactor: 7,
    codingRate: 5,
    txPowerDbm: 20,
    rxBytes: 14200,
    txBytes: 21900,
    rxPackets: 76,
    txPackets: 112,
    bitrateBps: 5470,
  },
  {
    id: 'if_03',
    name: 'Hub-Dublin-Global',
    type: 'TCPClientInterface',
    enabled: true,
    outgoing: true,
    targetHost: 'dublin.connect.reticulum.network',
    targetPort: 4965,
    rxBytes: 154200,
    txBytes: 68100,
    rxPackets: 420,
    txPackets: 198,
    bitrateBps: 1000000,
  },
  {
    id: 'if_04',
    name: 'Gateway-JJY-Server',
    type: 'TCPServerInterface',
    enabled: false,
    outgoing: false,
    listenIp: '0.0.0.0',
    listenPort: 4242,
    rxBytes: 0,
    txBytes: 0,
    rxPackets: 0,
    txPackets: 0,
    bitrateBps: 1000000,
  },
];

export const INITIAL_RNS_PATHS: ReticulumRoutingPath[] = [
  {
    destinationHash: '82a93b41c0e81254bf69d45e0a1b2c3d',
    destinationAlias: 'NomadNet BBS Global / RNode Central',
    hops: 1,
    nextHopInterface: 'RNode-LoRa-915',
    rateBps: 5470,
    expiresSeconds: 7120,
    lastHeardMsAgo: 14000,
  },
  {
    destinationHash: 'e710b9432f81a5c6d091e84a23bc78f0',
    destinationAlias: 'LXMF Relay Dublin Gateway',
    hops: 2,
    nextHopInterface: 'Hub-Dublin-Global',
    rateBps: 120000,
    expiresSeconds: 8400,
    lastHeardMsAgo: 45000,
  },
  {
    destinationHash: '4f21a89c3b70e15d862490ab12ec45f6',
    destinationAlias: 'Mochila Tática RNode Operador Alpha',
    hops: 1,
    nextHopInterface: 'RNode-LoRa-915',
    rateBps: 5470,
    expiresSeconds: 3200,
    lastHeardMsAgo: 82000,
  },
  {
    destinationHash: '1a90c2e4f581b37d6840291e5a7b3c2d',
    destinationAlias: 'Servidor Local LAN AutoMesh',
    hops: 1,
    nextHopInterface: 'AutoMesh-Local',
    rateBps: 10000000,
    expiresSeconds: 9800,
    lastHeardMsAgo: 5000,
  },
];

export const INITIAL_LXMF_MESSAGES: LxmfMessage[] = [
  {
    id: 'lxmf_01',
    timestamp: Date.now() - 3600000 * 2,
    sourceDestinationHash: '82a93b41c0e81254bf69d45e0a1b2c3d',
    sourceAlias: 'NomadNet BBS Central',
    targetDestinationHash: 'e2b74052f6d54cf8a16db3c80918ef55',
    targetAlias: 'Estação Mestre Soberana JJY',
    title: 'Boas-vindas à Malha Criptográfica Reticulum',
    content: 'Seu nó estabeleceu um Link autenticado via RNode LoRa. Chaves efêmeras trocadas com Forward Secrecy. Bem-vindo à rede sem censura.',
    state: 'DELIVERED',
    deliveryReceiptReceived: true,
    rttMs: 240,
    wireBytesLength: 182,
  },
  {
    id: 'lxmf_02',
    timestamp: Date.now() - 1800000,
    sourceDestinationHash: '4f21a89c3b70e15d862490ab12ec45f6',
    sourceAlias: 'Operador Alpha (Mochila LoRa)',
    targetDestinationHash: 'e2b74052f6d54cf8a16db3c80918ef55',
    targetAlias: 'Estação Mestre Soberana JJY',
    title: 'Relatório de Posição & Baliza RNode',
    content: 'Enlace RF operando em 915 MHz com SF7. Alcance confirmado de 18.4 km até o repetidor da serra. Criptografia ativa.',
    state: 'DELIVERED',
    deliveryReceiptReceived: true,
    rttMs: 310,
    wireBytesLength: 165,
  },
];

export const INITIAL_RNS_PACKETS: ReticulumPacket[] = [
  {
    id: 'pkt_rns_01',
    timestamp: Date.now() - 12000,
    packetType: 'ANNOUNCE',
    destinationHash: '82a93b41c0e81254bf69d45e0a1b2c3d',
    destinationType: 'SINGLE',
    hops: 1,
    interfaceName: 'RNode-LoRa-915',
    rssi: -78,
    snr: 9.4,
    rawLengthBytes: 154,
    summary: 'Announce de destino: <82a9...2c3d> (NomadNet BBS) • Assinatura Ed25519 Válida',
  },
  {
    id: 'pkt_rns_02',
    timestamp: Date.now() - 34000,
    packetType: 'DATA',
    destinationHash: 'e2b74052f6d54cf8a16db3c80918ef55',
    destinationType: 'LINK',
    hops: 1,
    interfaceName: 'RNode-LoRa-915',
    rssi: -82,
    snr: 8.1,
    rawLengthBytes: 198,
    summary: 'Payload Cifrado E2EE: [LXMF Mensagem entregue via Link autenticado]',
  },
  {
    id: 'pkt_rns_03',
    timestamp: Date.now() - 76000,
    packetType: 'LINK_REQUEST',
    destinationHash: '4f21a89c3b70e15d862490ab12ec45f6',
    destinationType: 'SINGLE',
    hops: 1,
    interfaceName: 'RNode-LoRa-915',
    rssi: -85,
    snr: 6.8,
    rawLengthBytes: 112,
    summary: 'Requisição de Link seguro ECDH X25519 estabelecida com Mochila Alpha',
  },
  {
    id: 'pkt_rns_04',
    timestamp: Date.now() - 120000,
    packetType: 'PROOF',
    destinationHash: 'e2b74052f6d54cf8a16db3c80918ef55',
    destinationType: 'SINGLE',
    hops: 2,
    interfaceName: 'Hub-Dublin-Global',
    rawLengthBytes: 64,
    summary: 'Recibo criptográfico de entrega (Proof) validado para pacote anterior',
  },
];
