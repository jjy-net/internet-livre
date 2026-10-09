/**
 * nsiteEngine.ts
 * Motor Criptográfico, Gerenciador de Nsite (NIP-5A) e Integração Blossom / Nostr
 * para a Rede JJY - Internet Livre.
 *
 * Suporta:
 * - Geração de chaves secp256k1 BIP-340 / Bech32 (nsec / npub) compatíveis com Nostr NIP-19
 * - Construção de eventos Kind 34128 / NIP-5A (Publicação estática na Web Descentralizada)
 * - Monitoramento e teste de conectividade de Relays Nostr (WebSocket)
 * - Monitoramento e teste de servidores de armazenamento Blossom (HTTP Blobs)
 * - Geração de comandos CLI nsyte e workflows de CI/CD (GitHub Actions)
 * - Hash SHA-256 de arquivos via Web Crypto API
 * - Armazenamento persistente e criptografia de cofre de chaves
 */

import { computeHash, encryptAESGCM, decryptAESGCM } from './crypto';

// ============================================================================
// 1. CRIPTOGRAFIA SECP256K1 & BECH32 (NOSTR NIP-19 & BIP-340)
// ============================================================================

// Parâmetros da curva elíptica secp256k1
const SECP256K1_P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2Fn;
const SECP256K1_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;
const SECP256K1_GX = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798n;
const SECP256K1_GY = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8n;

interface Point {
  x: bigint;
  y: bigint;
}

function mod(n: bigint, m: bigint): bigint {
  const result = n % m;
  return result >= 0n ? result : result + m;
}

function modInverse(k: bigint, m: bigint): bigint {
  if (k === 0n) throw new Error('Divisão por zero no corpo modular');
  let [r0, r1] = [m, mod(k, m)];
  let [s0, s1] = [0n, 1n];
  while (r1 !== 0n) {
    const q = r0 / r1;
    [r0, r1] = [r1, r0 - q * r1];
    [s0, s1] = [s1, s0 - q * s1];
  }
  if (r0 !== 1n) throw new Error('Não invertível');
  return mod(s0, m);
}

function pointAdd(P: Point | null, Q: Point | null): Point | null {
  if (!P) return Q;
  if (!Q) return P;
  if (P.x === Q.x && P.y !== Q.y) return null;

  let lambda: bigint;
  if (P.x === Q.x && P.y === Q.y) {
    if (P.y === 0n) return null;
    lambda = mod(3n * P.x * P.x * modInverse(2n * P.y, SECP256K1_P), SECP256K1_P);
  } else {
    lambda = mod((Q.y - P.y) * modInverse(Q.x - P.x, SECP256K1_P), SECP256K1_P);
  }

  const x3 = mod(lambda * lambda - P.x - Q.x, SECP256K1_P);
  const y3 = mod(lambda * (P.x - x3) - P.y, SECP256K1_P);
  return { x: x3, y: y3 };
}

function scalarMultiply(k: bigint, P: Point): Point | null {
  let result: Point | null = null;
  let addend: Point | null = P;
  let scalar = mod(k, SECP256K1_N);

  while (scalar > 0n) {
    if (scalar & 1n) {
      result = pointAdd(result, addend);
    }
    addend = pointAdd(addend, addend);
    scalar >>= 1n;
  }
  return result;
}

/**
 * Deriva a chave pública Nostr (x-only 32 bytes BIP-340) a partir de uma chave privada em hexadecimal
 */
export function secp256k1GetPublicKey(privateKeyHex: string): string {
  const cleanHex = privateKeyHex.trim().toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{64}$/.test(cleanHex)) {
    throw new Error('Chave privada inválida: deve conter exatamente 64 caracteres hexadecimais.');
  }

  const d = BigInt('0x' + cleanHex);
  if (d <= 0n || d >= SECP256K1_N) {
    throw new Error('Chave privada fora dos limites da curva secp256k1.');
  }

  const G: Point = { x: SECP256K1_GX, y: SECP256K1_GY };
  const point = scalarMultiply(d, G);
  if (!point) {
    throw new Error('Falha ao calcular ponto da chave pública.');
  }

  return point.x.toString(16).padStart(64, '0');
}

// ============================================================================
// 2. BECH32 CODIFICAÇÃO & DECODIFICAÇÃO (BIP-173 / NIP-19)
// ============================================================================

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function bech32Polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const b = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((b >> i) & 1) chk ^= GEN[i];
    }
  }
  return chk;
}

function bech32HrpExpand(hrp: string): number[] {
  const ret: number[] = [];
  for (let p = 0; p < hrp.length; ++p) {
    ret.push(hrp.charCodeAt(p) >> 5);
  }
  ret.push(0);
  for (let p = 0; p < hrp.length; ++p) {
    ret.push(hrp.charCodeAt(p) & 31);
  }
  return ret;
}

function convertBits(data: number[], fromBits: number, toBits: number, pad: boolean): number[] {
  let acc = 0;
  let bits = 0;
  const ret: number[] = [];
  const maxv = (1 << toBits) - 1;
  for (const value of data) {
    if (value < 0 || (value >> fromBits) !== 0) {
      throw new Error('Valor inválido para conversão de bits');
    }
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      ret.push((acc >> bits) & maxv);
    }
  }
  if (pad) {
    if (bits > 0) {
      ret.push((acc << (toBits - bits)) & maxv);
    }
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv)) {
    throw new Error('Bits excedentes inválidos na conversão');
  }
  return ret;
}

export function hexToBech32(prefix: 'nsec' | 'npub' | 'note', hexStr: string): string {
  const clean = hexStr.trim().toLowerCase().replace(/^0x/, '');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.substring(i, i + 2), 16));
  }
  const words = convertBits(bytes, 8, 5, true);
  const hrpExpanded = bech32HrpExpand(prefix);
  const values = hrpExpanded.concat(words).concat([0, 0, 0, 0, 0, 0]);
  const polymod = bech32Polymod(values) ^ 1;
  const checksum: number[] = [];
  for (let i = 0; i < 6; ++i) {
    checksum.push((polymod >> (5 * (5 - i))) & 31);
  }
  let ret = prefix + '1';
  for (const w of words.concat(checksum)) {
    ret += BECH32_CHARSET.charAt(w);
  }
  return ret;
}

export function bech32ToHex(bech32Str: string): { prefix: string; hex: string } {
  const str = bech32Str.trim().toLowerCase();
  const sep = str.lastIndexOf('1');
  if (sep <= 0 || sep + 7 > str.length) {
    throw new Error('String Bech32 inválida ou malformada.');
  }
  const prefix = str.substring(0, sep);
  const dataChars = str.substring(sep + 1);
  const words: number[] = [];
  for (let i = 0; i < dataChars.length; i++) {
    const idx = BECH32_CHARSET.indexOf(dataChars.charAt(i));
    if (idx === -1) throw new Error(`Caractere inválido na string Bech32: ${dataChars.charAt(i)}`);
    words.push(idx);
  }
  const hrpExpanded = bech32HrpExpand(prefix);
  if (bech32Polymod(hrpExpanded.concat(words)) !== 1) {
    throw new Error('Checksum Bech32 incorreto.');
  }
  const dataWords = words.slice(0, words.length - 6);
  const bytes = convertBits(dataWords, 5, 8, false);
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  return { prefix, hex };
}

export interface NostrKeyPair {
  privateKeyHex: string;
  publicKeyHex: string;
  nsec: string;
  npub: string;
  createdAt: number;
}

/**
 * Gera um novo par criptográfico seguro de chaves Nostr (secp256k1)
 */
export function generateNostrKeyPair(): NostrKeyPair {
  const privBytes = new Uint8Array(32);
  let valid = false;
  let privHex = '';
  let d = 0n;

  while (!valid) {
    crypto.getRandomValues(privBytes);
    privHex = Array.from(privBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    d = BigInt('0x' + privHex);
    if (d > 0n && d < SECP256K1_N) {
      valid = true;
    }
  }

  const pubHex = secp256k1GetPublicKey(privHex);
  const nsec = hexToBech32('nsec', privHex);
  const npub = hexToBech32('npub', pubHex);

  return {
    privateKeyHex: privHex,
    publicKeyHex: pubHex,
    nsec,
    npub,
    createdAt: Date.now()
  };
}

/**
 * Importa uma chave Nostr a partir de string nsec ou hex
 */
export function importNostrPrivateKey(inputKey: string): NostrKeyPair {
  const clean = inputKey.trim();
  let privHex = '';

  if (clean.toLowerCase().startsWith('nsec1')) {
    const parsed = bech32ToHex(clean);
    if (parsed.prefix !== 'nsec') {
      throw new Error(`Prefixo incorreto: esperado 'nsec', recebido '${parsed.prefix}'`);
    }
    privHex = parsed.hex;
  } else {
    privHex = clean.replace(/^0x/, '').toLowerCase();
  }

  if (!/^[0-9a-f]{64}$/.test(privHex)) {
    throw new Error('Chave privada inválida: deve conter 64 caracteres hexadecimais ou formato nsec1...');
  }

  const pubHex = secp256k1GetPublicKey(privHex);
  const nsec = hexToBech32('nsec', privHex);
  const npub = hexToBech32('npub', pubHex);

  return {
    privateKeyHex: privHex,
    publicKeyHex: pubHex,
    nsec,
    npub,
    createdAt: Date.now()
  };
}

// ============================================================================
// 3. ESTRUTURAS DE DADOS & ESPECIFICAÇÃO NSITE (NIP-5A & BLOSSOM)
// ============================================================================

export interface BlossomServerConfig {
  url: string;
  name: string;
  isDefault: boolean;
  isReachable?: boolean;
  latencyMs?: number;
  lastChecked?: number;
  error?: string;
}

export interface NostrRelayConfig {
  url: string;
  name: string;
  read: boolean;
  write: boolean;
  isOnline?: boolean;
  latencyMs?: number;
  lastChecked?: number;
  error?: string;
}

export interface NsiteDeployFile {
  path: string;
  sizeBytes: number;
  mimeType: string;
  sha256: string;
  blossomServer?: string;
  isUploaded?: boolean;
}

export interface NsiteDeployLog {
  id: string;
  siteId: string;
  siteName: string;
  timestamp: number;
  status: 'success' | 'failed' | 'in_progress';
  filesCount: number;
  totalSizeBytes: number;
  manifestHash: string;
  manifestEventId?: string;
  gatewayUrl: string;
  logs: string[];
}

export interface NsiteConfig {
  id: string;
  name: string;
  slug: string;
  description: string;
  isDefaultSite: boolean;
  status: 'active' | 'deploying' | 'draft' | 'archived';
  // Configurações de Build & Roteamento
  rootDir: string;
  fallbackFile: string;
  buildScript: string;
  deployCommand: string;
  // Identidade Nostr & Chaves
  npub: string;
  pubkeyHex: string;
  nsecMasked?: string;
  nsecEncrypted?: string;
  nbunksec?: string;
  useNip07Extension?: boolean;
  nip05Identifier?: string;
  customDomain?: string;
  // Servidores
  blossomServers: string[];
  relays: string[];
  // Metadados de Deploy
  lastDeployedAt?: number;
  deployedFilesCount?: number;
  totalSizeBytes?: number;
  manifestHash?: string;
  lastGatewayUrl?: string;
  tags: string[];
}

// Servidores Blossom Padrão de Alta Disponibilidade
export const DEFAULT_BLOSSOM_SERVERS: BlossomServerConfig[] = [
  { url: 'https://blossom.primal.net', name: 'Primal Blossom Global', isDefault: true },
  { url: 'https://cdn.satellite.earth', name: 'Satellite CDN Blossom', isDefault: true },
  { url: 'https://blossom.nostr.hu', name: 'Nostr HU Blossom Europe', isDefault: false },
  { url: 'https://nostr.download', name: 'Nostr Download Blossom', isDefault: false },
  { url: 'https://blossom.band', name: 'Band Blossom Relay Node', isDefault: false }
];

// Relays Nostr Padrão
export const DEFAULT_NOSTR_RELAYS: NostrRelayConfig[] = [
  { url: 'wss://relay.damus.io', name: 'Damus Global Relay', read: true, write: true },
  { url: 'wss://nos.lol', name: 'Nos.lol Fast Relay', read: true, write: true },
  { url: 'wss://relay.primal.net', name: 'Primal High-Speed', read: true, write: true },
  { url: 'wss://nostr.mom', name: 'Nostr Mom Community', read: true, write: true },
  { url: 'wss://relay.snort.social', name: 'Snort Social Relay', read: true, write: true }
];

// Configuração Padrão do Site Atual (JJY Mesh)
export const DEFAULT_JJY_NSITE_CONFIG: NsiteConfig = {
  id: 'nsite_jjy_main',
  name: 'JJY Mesh - Internet Livre (Site Principal)',
  slug: 'jjy-mesh',
  description: 'Portal principal da rede mesh resiliente, sem censura e multiprotocolo JJY.',
  isDefaultSite: true,
  status: 'active',
  rootDir: './dist',
  fallbackFile: '/index.html',
  buildScript: 'npm run build',
  deployCommand: 'nsyte deploy ./dist --fallback=/index.html --name jjy-mesh',
  npub: 'npub1jjymesh888freeinternet999protocol777unhackable',
  pubkeyHex: '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
  nsecMasked: 'nsec1••••••••••••••••••••••••••••••••••••••••••••••••••••••••',
  useNip07Extension: false,
  nip05Identifier: 'mesh@jjy.net',
  customDomain: 'jjy.mesh',
  blossomServers: ['https://blossom.primal.net', 'https://cdn.satellite.earth'],
  relays: ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'],
  lastDeployedAt: Date.now() - 3600000 * 2,
  deployedFilesCount: 34,
  totalSizeBytes: 2450000,
  manifestHash: '4f53cda18c2d4e3a9b1c7a8d5e2f1a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f',
  lastGatewayUrl: 'https://nsite.run/npub1jjymesh888freeinternet999protocol777unhackable',
  tags: ['producao', 'spa-vite', 'mesh', 'fallback-index']
};

export const SAMPLE_TEMPLATE_NSITES: NsiteConfig[] = [
  DEFAULT_JJY_NSITE_CONFIG,
  {
    id: 'nsite_jjy_docs',
    name: 'JJY Manuais & Manuais de Sobrevivência Offline',
    slug: 'jjy-docs',
    description: 'Documentação técnica tática, guias de antenas LoRa, frequências e protocolos de rádio.',
    isDefaultSite: false,
    status: 'draft',
    rootDir: './docs-dist',
    fallbackFile: '/index.html',
    buildScript: 'npm run docs:build',
    deployCommand: 'nsyte deploy ./docs-dist --fallback=/index.html --name jjy-docs',
    npub: 'npub1tacticaldocs444manuals777offlineguides222resilience',
    pubkeyHex: 'c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5',
    nsecMasked: 'nsec1••••••••••••••••••••••••••••••••••••••••••••••••••••••••',
    blossomServers: ['https://blossom.primal.net', 'https://blossom.nostr.hu'],
    relays: ['wss://relay.damus.io', 'wss://nos.lol'],
    tags: ['manuais', 'documentacao', 'offline']
  },
  {
    id: 'nsite_jjy_sos',
    name: 'JJY SOS - Canal de Emergência & Catástrofe',
    slug: 'jjy-sos',
    description: 'Espelho leve e ultra-otimizado para comunicação de socorro em áreas sem conectividade convencional.',
    isDefaultSite: false,
    status: 'draft',
    rootDir: './sos-dist',
    fallbackFile: '/index.html',
    buildScript: 'npm run build:sos',
    deployCommand: 'nsyte deploy ./sos-dist --fallback=/index.html --name jjy-sos',
    npub: 'npub1emergencysos999disasterrelief555humanitarianaid1',
    pubkeyHex: 'e029c78d0f1a4e1b8a9c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a',
    nsecMasked: 'nsec1••••••••••••••••••••••••••••••••••••••••••••••••••••••••',
    blossomServers: ['https://blossom.primal.net', 'https://cdn.satellite.earth'],
    relays: ['wss://relay.damus.io', 'wss://relay.primal.net', 'wss://nostr.mom'],
    tags: ['sos', 'emergencia', 'leve', 'desastre']
  }
];

// ============================================================================
// 4. PERSISTÊNCIA LOCAL (LOCALSTORAGE)
// ============================================================================

const STORAGE_KEY_NSITES = 'jjy_nsite_configs_v1';
const STORAGE_KEY_BLOSSOM = 'jjy_nsite_blossom_servers_v1';
const STORAGE_KEY_RELAYS = 'jjy_nsite_relays_v1';
const STORAGE_KEY_LOGS = 'jjy_nsite_deploy_logs_v1';
const STORAGE_KEY_VAULT_KEYS = 'jjy_nsite_vault_keys_v1';

export function loadAllNsiteConfigs(): NsiteConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_NSITES);
    if (!raw) {
      saveAllNsiteConfigs(SAMPLE_TEMPLATE_NSITES);
      return SAMPLE_TEMPLATE_NSITES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return SAMPLE_TEMPLATE_NSITES;
  } catch {
    return SAMPLE_TEMPLATE_NSITES;
  }
}

export function saveAllNsiteConfigs(configs: NsiteConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_NSITES, JSON.stringify(configs));
  } catch (err) {
    console.error('Erro ao salvar configurações de Nsite:', err);
  }
}

export function loadBlossomServers(): BlossomServerConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BLOSSOM);
    if (!raw) return DEFAULT_BLOSSOM_SERVERS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_BLOSSOM_SERVERS;
  } catch {
    return DEFAULT_BLOSSOM_SERVERS;
  }
}

export function saveBlossomServers(servers: BlossomServerConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_BLOSSOM, JSON.stringify(servers));
  } catch (err) {
    console.error('Erro ao salvar servidores Blossom:', err);
  }
}

export function loadNostrRelays(): NostrRelayConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RELAYS);
    if (!raw) return DEFAULT_NOSTR_RELAYS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_NOSTR_RELAYS;
  } catch {
    return DEFAULT_NOSTR_RELAYS;
  }
}

export function saveNostrRelays(relays: NostrRelayConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_RELAYS, JSON.stringify(relays));
  } catch (err) {
    console.error('Erro ao salvar relays Nostr:', err);
  }
}

export function loadDeployLogs(): NsiteDeployLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOGS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDeployLog(log: NsiteDeployLog): void {
  try {
    const existing = loadDeployLogs();
    const updated = [log, ...existing].slice(0, 50); // manter últimos 50
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(updated));
  } catch (err) {
    console.error('Erro ao salvar log de deploy:', err);
  }
}

// Cofre de chaves com criptografia AES-GCM
export async function savePrivateKeyToVault(siteId: string, nsec: string, passphrase?: string): Promise<string> {
  let storedVal = nsec;
  if (passphrase && passphrase.length >= 6) {
    storedVal = await encryptAESGCM(nsec, passphrase);
  }
  const rawVault = localStorage.getItem(STORAGE_KEY_VAULT_KEYS) || '{}';
  const vault = JSON.parse(rawVault);
  vault[siteId] = {
    storedVal,
    isEncrypted: Boolean(passphrase && passphrase.length >= 6),
    updatedAt: Date.now()
  };
  localStorage.setItem(STORAGE_KEY_VAULT_KEYS, JSON.stringify(vault));
  return storedVal;
}

export async function getPrivateKeyFromVault(siteId: string, passphrase?: string): Promise<string | null> {
  try {
    const rawVault = localStorage.getItem(STORAGE_KEY_VAULT_KEYS);
    if (!rawVault) return null;
    const vault = JSON.parse(rawVault);
    const entry = vault[siteId];
    if (!entry) return null;
    if (entry.isEncrypted) {
      if (!passphrase) throw new Error('Chave protegida por senha mestre. Informe a senha.');
      return await decryptAESGCM(entry.storedVal, passphrase);
    }
    return entry.storedVal;
  } catch (err) {
    throw err;
  }
}

// ============================================================================
// 5. TESTADORES DE REDE & CONECTIVIDADE (WEBSOCKET RELAYS & BLOSSOM SERVERS)
// ============================================================================

/**
 * Testa conectividade WebSocket com um relay Nostr
 */
export async function testNostrRelayConnection(relayUrl: string, timeoutMs = 4000): Promise<{ isOnline: boolean; latencyMs: number; error?: string }> {
  const startTime = performance.now();
  return new Promise((resolve) => {
    let ws: WebSocket | null = null;
    let timer: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (ws) {
        ws.onopen = null;
        ws.onerror = null;
        ws.onclose = null;
        try {
          ws.close();
        } catch {
          // ignore
        }
      }
    };

    timer = setTimeout(() => {
      cleanup();
      resolve({ isOnline: false, latencyMs: timeoutMs, error: 'Tempo limite esgotado (Timeout 4s)' });
    }, timeoutMs);

    try {
      ws = new WebSocket(relayUrl);
      ws.onopen = () => {
        const latency = Math.round(performance.now() - startTime);
        cleanup();
        resolve({ isOnline: true, latencyMs: latency });
      };
      ws.onerror = () => {
        const latency = Math.round(performance.now() - startTime);
        cleanup();
        resolve({ isOnline: false, latencyMs: latency, error: 'Falha de conexão WebSocket / Handshake rejeitado' });
      };
    } catch (err: any) {
      cleanup();
      resolve({ isOnline: false, latencyMs: 0, error: err?.message || 'Erro ao inicializar WebSocket' });
    }
  });
}

/**
 * Testa conectividade HTTP com um servidor Blossom
 */
export async function testBlossomServerConnection(serverUrl: string, timeoutMs = 4000): Promise<{ isReachable: boolean; latencyMs: number; error?: string }> {
  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Tenta HEAD ou GET na raiz ou /public
    const cleanUrl = serverUrl.replace(/\/+$/, '');
    const response = await fetch(`${cleanUrl}/`, {
      method: 'HEAD',
      signal: controller.signal,
      mode: 'cors'
    }).catch(async () => {
      // Se HEAD falhar por CORS ou 405, tenta GET
      return await fetch(`${cleanUrl}/`, {
        method: 'GET',
        signal: controller.signal,
        mode: 'no-cors'
      });
    });

    clearTimeout(timeoutId);
    const latency = Math.round(performance.now() - startTime);
    return { isReachable: true, latencyMs: latency };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const latency = Math.round(performance.now() - startTime);
    const isTimeout = err?.name === 'AbortError';
    return {
      isReachable: false,
      latencyMs: latency,
      error: isTimeout ? 'Tempo limite esgotado (Timeout 4s)' : (err?.message || 'Servidor inacessível')
    };
  }
}

// ============================================================================
// 6. PROCESSAMENTO DE ARQUIVOS & MANIFESTO NIP-5A (KIND 34128)
// ============================================================================

/**
 * Calcula o hash SHA-256 de um arquivo ou ArrayBuffer
 */
export async function calculateFileSha256(data: ArrayBuffer): Promise<string> {
  return await computeHash(data, 'SHA-256');
}

/**
 * Envia um blob de arquivo diretamente a um servidor Blossom via HTTP PUT /upload
 */
export async function uploadBlobToBlossom(
  serverUrl: string,
  data: ArrayBuffer,
  mimeType: string,
  authHeader?: string
): Promise<{ success: boolean; sha256: string; url?: string; error?: string }> {
  try {
    const sha256 = await calculateFileSha256(data);
    const cleanUrl = serverUrl.replace(/\/+$/, '');
    const headers: Record<string, string> = {
      'Content-Type': mimeType || 'application/octet-stream',
    };
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    const res = await fetch(`${cleanUrl}/upload`, {
      method: 'PUT',
      headers,
      body: data,
    });
    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      return { success: true, sha256, url: json.url || `${cleanUrl}/${sha256}` };
    } else {
      return { success: false, sha256, error: `HTTP ${res.status}: ${res.statusText}` };
    }
  } catch (err: any) {
    return { success: false, sha256: '', error: err?.message || 'Falha de rede / CORS' };
  }
}

/**
 * Detecta MIME type básico por extensão de arquivo
 */
export function getMimeTypeFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'html':
    case 'htm':
      return 'text/html; charset=utf-8';
    case 'css':
      return 'text/css; charset=utf-8';
    case 'js':
    case 'mjs':
      return 'application/javascript; charset=utf-8';
    case 'json':
      return 'application/json';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'svg':
      return 'image/svg+xml';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'ico':
      return 'image/x-icon';
    case 'txt':
      return 'text/plain; charset=utf-8';
    case 'md':
      return 'text/markdown; charset=utf-8';
    case 'wasm':
      return 'application/wasm';
    default:
      return 'application/octet-stream';
  }
}

export interface Nip5aManifestEvent {
  kind: number; // 34128
  pubkey: string;
  created_at: number;
  tags: string[][];
  content: string;
}

/**
 * Constrói o evento Nostr NIP-5A (Kind 34128) mapeando arquivos para hashes SHA-256
 */
export function buildNip5aManifestEvent(
  siteConfig: NsiteConfig,
  files: NsiteDeployFile[],
  blossomServerUrl: string
): Nip5aManifestEvent {
  const now = Math.floor(Date.now() / 1000);
  const tags: string[][] = [
    ['d', siteConfig.slug || 'jjy-mesh'],
    ['name', siteConfig.name],
    ['description', siteConfig.description],
    ['fallback', siteConfig.fallbackFile || '/index.html'],
    ['server', blossomServerUrl],
    ['client', 'JJY-Mesh-Nsite-Manager-v2']
  ];

  if (siteConfig.nip05Identifier) {
    tags.push(['nip05', siteConfig.nip05Identifier]);
  }

  // Tags para cada arquivo: ["f", path, sha256, mime, size]
  for (const f of files) {
    tags.push([
      'f',
      f.path.startsWith('/') ? f.path : `/${f.path}`,
      f.sha256,
      f.mimeType,
      String(f.sizeBytes)
    ]);
  }

  return {
    kind: 34128,
    pubkey: siteConfig.pubkeyHex,
    created_at: now,
    tags,
    content: JSON.stringify({
      generator: 'JJY Internet Livre Nsite Builder',
      version: '2.0.0',
      totalFiles: files.length,
      totalBytes: files.reduce((acc, curr) => acc + curr.sizeBytes, 0),
      timestamp: Date.now()
    })
  };
}

// ============================================================================
// 7. GERADORES DE SCRIPTS, CLI & CI/CD
// ============================================================================

/**
 * Gera o comando CLI completo `nsyte deploy`
 */
export function generateNsyteCliCommand(config: NsiteConfig): string {
  const parts: string[] = ['nsyte deploy', config.rootDir];

  if (config.fallbackFile) {
    parts.push(`--fallback=${config.fallbackFile}`);
  }
  if (config.slug) {
    parts.push(`--name=${config.slug}`);
  }
  if (config.blossomServers && config.blossomServers.length > 0) {
    for (const b of config.blossomServers) {
      parts.push(`--blossom-server=${b}`);
    }
  }
  if (config.relays && config.relays.length > 0) {
    for (const r of config.relays) {
      parts.push(`--relay=${r}`);
    }
  }

  return parts.join(' ');
}

/**
 * Gera o script completo para package.json e terminal
 */
export function generateFullDeployScript(config: NsiteConfig): string {
  const cli = generateNsyteCliCommand(config);
  if (config.buildScript) {
    return `${config.buildScript} && ${cli}`;
  }
  return cli;
}

/**
 * Gera o arquivo `.github/workflows/deploy-nsite.yml` para CI/CD automático
 */
export function generateGitHubWorkflowYaml(config: NsiteConfig): string {
  const relaysList = config.relays.map((r) => `            ${r}`).join('\n');
  const blossomList = config.blossomServers.map((b) => `            ${b}`).join('\n');

  return `# GitHub Actions Workflow - Deploy Automático Nsite (Nostr/Blossom)
# Gerado pelo Painel Administrativo JJY Mesh Internet Livre
name: Deploy Nsite para Nostr & Blossom

on:
  push:
    branches: [main, master]
  workflow_dispatch:

jobs:
  deploy-nsite:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout do Repositório
        uses: actions/checkout@v4

      - name: Configurar Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Instalar Dependências
        run: npm ci

      - name: Compilar Projeto (Build)
        run: ${config.buildScript || 'npm run build'}

      - name: Deploy para Nostr & Blossom via Nsite Action
        uses: sandwichfarm/nsite-action@v1
        with:
          # Segredo configurado nas variáveis do repositório (Settings > Secrets > Actions)
          # Use o token gerado via 'nsyte ci' ou chave nostr connect bunker
          nsec: \${{ secrets.NOSTR_NSITE_KEY }}
          dir: '${config.rootDir}'
          fallback: '${config.fallbackFile}'
          name: '${config.slug}'
          relays: |
${relaysList}
          blossom-servers: |
${blossomList}
`;
}

/**
 * Gera URLs de Gateway público para visualizar o site
 */
export function getPublicGatewayUrls(npub: string, slug?: string): { name: string; url: string; description: string }[] {
  const cleanNpub = npub.trim();
  return [
    {
      name: 'Nsite.run Gateway (Padrão)',
      url: `https://nsite.run/${cleanNpub}${slug && slug !== 'jjy-mesh' ? `?name=${slug}` : ''}`,
      description: 'Gateway oficial do ecossistema Nsite com cache edge e CDN distribuída.'
    },
    {
      name: 'Subdomínio Nsite.run',
      url: `https://${cleanNpub.slice(0, 16)}.nsite.run`,
      description: 'Acesso via subdomínio direto vinculado ao prefixo de chave pública.'
    },
    {
      name: 'NostrDeploy Gateway Alternativo',
      url: `https://${cleanNpub}.nostrdeploy.com`,
      description: 'Gateway secundário de alta velocidade com resolução DNS pública.'
    }
  ];
}

/**
 * Encurtador amigável de chave npub/nsec
 */
export function formatKeyCompact(key: string, startChars = 8, endChars = 6): string {
  if (!key) return '';
  if (key.length <= startChars + endChars + 3) return key;
  return `${key.slice(0, startChars)}...${key.slice(-endChars)}`;
}
