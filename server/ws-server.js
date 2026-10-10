/**
 * DataLink Pro — Servidor WebSocket + HTTP estático em Node puro.
 * Sem dependências externas: implementa o protocolo RFC 6455 diretamente.
 *
 * Recursos:
 *  - Handshake WebSocket (upgrade HTTP)
 *  - Frames de texto e binários (com fragmentação, ping/pong, close)
 *  - Presença de pares (peer join/leave/update) + latência medida
 *  - Relay de mensagens (chat, typing, read, react, arquivos)
 *  - Servidor de arquivos estáticos (serve o app web na mesma porta)
 *  - Beacon UDP de descoberta na LAN
 */
import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execSync, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { startBeacon } from './discovery.js';
import {
  generateRandomChallenge,
  verifyRegistrationCredential,
  verifyAuthenticationAssertion,
} from './webauthn.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Carregar variáveis de ambiente de .env se existir na raiz do projeto
try {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!(key in process.env)) {
          process.env[key] = val;
        }
      }
    }
  }
} catch {}

export const VERSION = '2.0.0';
export const DEFAULT_PORT = 4870;
export const DEFAULT_HTTPS_PORT = 4873;
export const DISCOVERY_PORT = 48777;

// SEGURANÇA: Senha de administrador via variável de ambiente ou gerada automaticamente
function generateSecurePassword() {
  return 'DL-' + crypto.randomBytes(12).toString('base64url');
}
export const DEFAULT_ADMIN_PASSWORD = process.env.DATALINK_ADMIN_PASSWORD || generateSecurePassword();

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/* ------------------------------------------------------------------ */
/* TOTP (RFC 6238) — Autenticação de dois fatores offline              */
/* ------------------------------------------------------------------ */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let bits = 0, value = 0, output = '';
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(str) {
  str = str.replace(/[= ]/g, '').toUpperCase();
  let bits = 0, value = 0;
  const output = [];
  for (let i = 0; i < str.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(str[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xFF);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20)); // 160 bits
}

function computeHotp(secret, counter) {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  for (let i = 7; i >= 0; i--) {
    buf[i] = counter & 0xff;
    counter = Math.floor(counter / 256);
  }
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) |
               ((hmac[offset + 1] & 0xff) << 16) |
               ((hmac[offset + 2] & 0xff) << 8) |
               (hmac[offset + 3] & 0xff);
  return String(code % 1000000).padStart(6, '0');
}

function verifyTotp(secret, token, window = 1) {
  const counter = Math.floor(Date.now() / 30000);
  for (let i = -window; i <= window; i++) {
    const expected = computeHotp(secret, counter + i);
    // Comparação timing-safe
    if (expected.length === token.length) {
      const a = Buffer.from(expected);
      const b = Buffer.from(token);
      if (crypto.timingSafeEqual(a, b)) return true;
    }
  }
  return false;
}

function buildTotpUri(secret, label = 'Jjy Admin', issuer = 'Jjy') {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
const MAX_TEXT_MESSAGE = 32 * 1024 * 1024;        // 32 MB (fotos base64, telas e JSON)
const MAX_BINARY_MESSAGE = 64 * 1024 * 1024;      // 64 MB (chunks de arquivo)
const MAX_PEERS = 64;
const MAX_POST_BODY = 1024 * 1024;               // 1 MB — limite para corpo de requisições POST API
const HELLO_TIMEOUT = 15000;
const LIVENESS_INTERVAL = 20000;
const RELAY_TYPES = new Set(['chat', 'typing', 'read', 'react', 'file-meta', 'file-end', 'stream-frame', 'remote-alert', 'file-offer', 'file-request', 'audio-sample', 'remote-command', 'device-telemetry', 'screen-frame', 'screen-telemetry', 'terminal-session', 'parental-policy', 'parental-alert', 'admin-popup', 'alert-ack', 'silence-alert', 'play-sound', 'intercom-audio', 'location:update', 'network-lockdown']);

// Fila de alertas de emergência pendentes (para entrega imediata se o usuário abrir o navegador após o envio)
const pendingEmergencyAlerts = new Map();
function savePendingAlert(alertMsg) {
  const target = String(alertMsg.targetClientId || 'all').trim();
  pendingEmergencyAlerts.set(target, {
    ...alertMsg,
    expiresAt: Date.now() + 600000 // 10 minutos de retenção
  });
}

// Disparo nativo do Windows (PowerShell MessageBox) para alertar mesmo se o navegador estiver fechado no host Windows
function triggerWindowsNativeAlert(title, message) {
  if (process.platform !== 'win32') return;
  try {
    // SEGURANÇA: Sanitização rigorosa contra injeção de PowerShell — remove TODOS os caracteres perigosos
    const safeTitle = String(title || 'ALERTA DO ADMINISTRADOR').replace(/[^a-zA-Z0-9À-ú\s.,!?:;\-()]/g, '').slice(0, 100);
    const safeMsg = String(message || 'Mensagem urgente da Central de Administração').replace(/[^a-zA-Z0-9À-ú\s.,!?:;\-()]/g, '').slice(0, 300);
    const psScript = `[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.MessageBox]::Show("${safeMsg}", "${safeTitle}", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Warning)`;
    const child = spawn('powershell', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', psScript], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
  } catch {
    // Silencia qualquer exceção de processo no SO
  }
}

/* ------------------------------------------------------------------ */
/* Conexão WebSocket individual                                        */
/* ------------------------------------------------------------------ */

class WsConnection extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.fragments = [];
    this.fragmentedOpcode = 0;
    this.alive = true;
    this.closed = false;
    this.messagesThisSecond = 0;
    this.rateResetTimer = setInterval(() => { this.messagesThisSecond = 0; }, 1000);
    this.rateResetTimer.unref?.();

    socket.on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      try {
        this._parseFrames();
      } catch {
        this.close(1002, 'Erro de protocolo');
      }
    });
    socket.on('close', () => this._cleanup());
    socket.on('error', () => this._cleanup());
  }

  _cleanup() {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.rateResetTimer);
    this.emit('close');
  }

  _parseFrames() {
    while (this.buffer.length >= 2) {
      const b0 = this.buffer[0];
      const b1 = this.buffer[1];
      const fin = (b0 & 0x80) !== 0;
      const rsv = b0 & 0x70;
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let offset = 2;

      if (rsv !== 0) throw new Error('RSV diferente de zero');
      if (!masked) throw new Error('Frame de cliente sem máscara');

      if (len === 126) {
        if (this.buffer.length < offset + 2) return;
        len = this.buffer.readUInt16BE(offset);
        offset += 2;
      } else if (len === 127) {
        if (this.buffer.length < offset + 8) return;
        const big = this.buffer.readBigUInt64BE(offset);
        if (big > BigInt(MAX_BINARY_MESSAGE)) throw new Error('Payload grande demais');
        len = Number(big);
        offset += 8;
      }

      const isControl = opcode >= 0x8;
      if (isControl && (!fin || len > 125)) throw new Error('Frame de controle inválido');

      const total = offset + 4 + len; // +4 = chave de máscara
      if (this.buffer.length < total) return;

      const maskKey = this.buffer.subarray(offset, offset + 4);
      const payload = Buffer.from(this.buffer.subarray(offset + 4, total));
      for (let i = 0; i < payload.length; i++) payload[i] ^= maskKey[i & 3];
      this.buffer = this.buffer.subarray(total);

      // Limite de taxa simples (anti abuso)
      if (++this.messagesThisSecond > 500) {
        this.close(1008, 'Excesso de mensagens');
        return;
      }

      if (opcode === 0x8) { // close
        this.close(1000);
        return;
      } else if (opcode === 0x9) { // ping
        this._sendFrame(0xa, payload);
      } else if (opcode === 0xa) { // pong
        this.alive = true;
        this.emit('pong');
      } else if (opcode === 0x0) { // continuação
        if (!this.fragmentedOpcode) throw new Error('Continuação sem início');
        this.fragments.push(payload);
        if (fin) this._emitMessage();
      } else if (opcode === 0x1 || opcode === 0x2) { // texto / binário
        this.fragments = [payload];
        this.fragmentedOpcode = opcode;
        if (fin) this._emitMessage();
      } else {
        throw new Error('Opcode desconhecido: ' + opcode);
      }
    }
  }

  _emitMessage() {
    const full = Buffer.concat(this.fragments);
    const opcode = this.fragmentedOpcode;
    this.fragments = [];
    this.fragmentedOpcode = 0;
    const limit = opcode === 0x1 ? MAX_TEXT_MESSAGE : MAX_BINARY_MESSAGE;
    if (full.length > limit) {
      this.close(1009, 'Mensagem grande demais');
      return;
    }
    this.emit('message', opcode === 0x1 ? 'text' : 'binary', full);
  }

  _sendFrame(opcode, payload) {
    if (this.closed || this.socket.destroyed) return;
    const len = payload.length;
    let header;
    if (len < 126) {
      header = Buffer.alloc(2);
      header[1] = len;
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }
    header[0] = 0x80 | opcode; // FIN + opcode (servidor não mascara)
    try {
      this.socket.write(Buffer.concat([header, payload]));
    } catch {
      this._cleanup();
    }
  }

  sendText(obj) {
    this._sendFrame(0x1, Buffer.from(JSON.stringify(obj), 'utf8'));
  }

  sendBinary(buf) {
    this._sendFrame(0x2, buf);
  }

  sendPing(payload = Buffer.alloc(0)) {
    this._sendFrame(0x9, payload);
  }

  close(code = 1000, reason = '') {
    if (this.closed) return;
    try {
      const reasonBuf = Buffer.from(reason, 'utf8');
      const payload = Buffer.alloc(2 + reasonBuf.length);
      payload.writeUInt16BE(code, 0);
      reasonBuf.copy(payload, 2);
      this._sendFrame(0x8, payload);
      this.socket.end();
    } catch { /* ignore */ }
    const t = setTimeout(() => {
      try { this.socket.destroy(); } catch { /* ignore */ }
      this._cleanup();
    }, 300);
    t.unref?.();
  }
}

/* ------------------------------------------------------------------ */
/* Arquivos estáticos                                                  */
/* ------------------------------------------------------------------ */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.bat': 'text/plain; charset=utf-8',
};

function serveStatic(req, res, webRoot) {
  let urlPath;
  try {
    urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('URL inválida');
    return;
  }
  if (urlPath.includes('\0')) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Caractere nulo rejeitado');
    return;
  }
  if (urlPath.endsWith('/')) urlPath += 'index.html';

  const rootResolved = path.resolve(webRoot || path.join(__dirname, '..', 'public'));
  const recordingsDir = path.resolve(path.join(__dirname, '..', 'recordings'));
  const publicDir = path.resolve(path.join(__dirname, '..', 'public'));

  let targetRoot = rootResolved;
  let relativePath = urlPath;

  if (urlPath.startsWith('/recordings/')) {
    targetRoot = recordingsDir;
    relativePath = urlPath.replace(/^\/recordings\/?/, '');
  }

  // Previne path traversal: normaliza e remove quaisquer prefixos '..'
  const safeRelative = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.resolve(path.join(targetRoot, safeRelative));

  // Trava de segurança: filePath DEVE estar estritamente contido dentro de targetRoot
  if (!filePath.startsWith(targetRoot + path.sep) && filePath !== targetRoot) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Acesso negado');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    let target = filePath;
    if (err || !stat.isFile()) {
      if (urlPath.startsWith('/recordings/')) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Gravação não encontrada');
        return;
      }
      // Fallback seguro para a pasta public/
      const pubTarget = path.resolve(path.join(publicDir, safeRelative));
      if ((pubTarget.startsWith(publicDir + path.sep) || pubTarget === publicDir) && fs.existsSync(pubTarget) && fs.statSync(pubTarget).isFile()) {
        target = pubTarget;
      } else if (!path.posix.extname(urlPath)) {
        // SPA fallback: sem extensão → index.html
        target = path.join(rootResolved, 'index.html');
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Não encontrado');
        return;
      }
    }
    fs.stat(target, (err2, stat2) => {
      if (err2 || !stat2.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Não encontrado');
        return;
      }
      const ext = path.extname(target).toLowerCase();
      const headers = {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(self)',
        'X-XSS-Protection': '1; mode=block',
      };
      res.writeHead(200, headers);
      fs.createReadStream(target).pipe(res);
    });
  });
}

function welcomePage(port) {
  const ips = getLocalIPs();
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>DataLink Pro — Servidor</title>
<style>body{font-family:system-ui,sans-serif;background:#0f0f1a;color:#e5e7eb;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{background:#1a1a2e;border:1px solid #333355;border-radius:16px;padding:32px 40px;max-width:560px;text-align:center}
h1{background:linear-gradient(90deg,#a78bfa,#f472b6);-webkit-background-clip:text;background-clip:text;color:transparent;margin:0 0 8px}
code{background:#0f0f1a;padding:2px 8px;border-radius:6px;color:#a78bfa}li{margin:6px 0;text-align:left}</style></head>
<body><div class="card"><h1>🔗 Servidor DataLink Pro ativo</h1>
<p>O app web ainda não foi compilado nesta pasta. Para usá-lo:</p>
<ul><li>Rode <code>npm run build</code> para gerar o <code>dist/</code> e reinicie o servidor, ou</li>
<li>Rode <code>npm run dev</code> (Vite) e conecte o app em <code>ws://IP:${port}</code></li></ul>
<p>Endereços na rede:</p><ul>${ips.map((ip) => `<li><code>http://${ip}:${port}</code></li>`).join('') || '<li><code>http://localhost:' + port + '</code></li>'}</ul>
</div></body></html>`;
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

export function getLocalIPs() {
  const lanIps = [];
  const vpnIps = [];
  const ifaces = os.networkInterfaces();
  for (const [name, list] of Object.entries(ifaces)) {
    const isVirtual = /vpn|tap|tun|wireguard|proton|virtual|vethernet|docker|wsl/i.test(name);
    for (const iface of list || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (isVirtual) {
          vpnIps.push(iface.address);
        } else {
          lanIps.push(iface.address);
        }
      }
    }
  }
  // Prioriza redes LAN padrão (192.168.x.x é o padrão universal de roteadores Wi-Fi)
  lanIps.sort((a, b) => {
    if (a.startsWith('192.168.') && !b.startsWith('192.168.')) return -1;
    if (!a.startsWith('192.168.') && b.startsWith('192.168.')) return 1;
    return 0;
  });
  return [...new Set([...lanIps, ...vpnIps])];
}

export const COLOR_PALETTE = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'];

export function randomColor() {
  return COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
}

export function getSslCredentials(certPath, passphrase = 'jjy_secure_ssl') {
  try {
    const targetPath = certPath || path.join(__dirname, 'cert.pfx');
    if (!fs.existsSync(targetPath)) {
      if (process.platform === 'win32') {
        const localIps = getLocalIPs();
        // SEGURANÇA: Sanitização whitelist rigorosa — apenas alfanuméricos, pontos e hífens
        const safePass = String(passphrase || 'jjy2026').replace(/[^a-zA-Z0-9_\-!@#$%&*]/g, '');
        const dnsEntries = ['localhost', '127.0.0.1', ...localIps]
          .map(n => String(n).replace(/[^0-9a-zA-Z.:-]/g, ''))
          .filter(n => n.length > 0 && n.length < 64);
        if (dnsEntries.length === 0) throw new Error('Nenhum endereço válido para certificado');
        // SEGURANÇA: Usa arquivo temporário para o script PowerShell em vez de interpolação na linha de comando
        const safePath = targetPath.replace(/\\/g, '\\\\');
        const dnsNames = dnsEntries.map(n => `"${n}"`).join(',');
        const psScript = [
          `$cert = New-SelfSignedCertificate -DnsName ${dnsNames} -CertStoreLocation "cert:\\CurrentUser\\My" -NotAfter (Get-Date).AddYears(10) -KeyLength 2048 -FriendlyName "Jjy-LAN-SSL"`,
          `$pwd = ConvertTo-SecureString -String "${safePass}" -Force -AsPlainText`,
          `Export-PfxCertificate -Cert $cert -FilePath "${safePath}" -Password $pwd | Out-Null`,
        ].join('; ');
        const psFile = path.join(os.tmpdir(), `jjy_ssl_${Date.now()}.ps1`);
        fs.writeFileSync(psFile, psScript, 'utf8');
        try {
          execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile}"`, { stdio: 'ignore', timeout: 30000 });
        } finally {
          try { fs.unlinkSync(psFile); } catch { /* ignorar */ }
        }
      }
    }
    if (fs.existsSync(targetPath)) {
      return {
        pfx: fs.readFileSync(targetPath),
        passphrase,
      };
    }
  } catch {
    // Falha silenciosa se não for possível gerar
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Servidor DataLink                                                   */
/* ------------------------------------------------------------------ */

export function createDataLinkServer(options = {}) {
  const webRoot = options.webRoot || null;
  const serverName = options.name || os.hostname() || 'DataLink';
  const enableDiscovery = options.discovery !== false;

  const events = new EventEmitter();
  const peers = new Map();          // peerId -> peer
  const byClientId = new Map();     // clientId -> peer
  let nextPeerId = 1;
  let httpServer = null;
  let httpsServer = null;
  let beacon = null;
  let livenessTimer = null;
  let presenceTimer = null;
  let cleanupTimer = null;
  let running = false;
  let actualPort = options.port ?? DEFAULT_PORT;
  let actualHttpsPort = options.httpsPort ?? (actualPort + 3);
  let startedAt = Date.now();

  // Segurança Administrativa & Defesa Blue Team
  const adminPassword = options.adminPassword || process.env.DATALINK_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  const adminSessions = new Map();     // token -> { token, ip, createdAt, expiresAt }
  const bannedIps = new Map();         // ip -> { ip, reason, bannedAt, expiresAt, auto }

  // TOTP (2FA offline) — estado persistido em arquivo local
  const totpStatePath = path.join(__dirname, '.totp-state.json');
  let totpState = { enabled: false, secret: null, setupPending: false, pendingSecret: null };
  try {
    if (fs.existsSync(totpStatePath)) {
      const raw = JSON.parse(fs.readFileSync(totpStatePath, 'utf8'));
      if (raw && typeof raw === 'object') totpState = { ...totpState, ...raw };
    }
  } catch { /* estado inicial se arquivo corrompido */ }
  function saveTotpState() {
    try { fs.writeFileSync(totpStatePath, JSON.stringify(totpState), 'utf8'); } catch { /* ignorar */ }
  }

  // FIDO U2F / WebAuthn (Autenticação por Hardware e Biometria Offline) — estado persistido em arquivo local
  const webauthnStatePath = path.join(__dirname, '.webauthn-state.json');
  let webauthnState = { enabled: false, credentials: [] };
  try {
    if (fs.existsSync(webauthnStatePath)) {
      const raw = JSON.parse(fs.readFileSync(webauthnStatePath, 'utf8'));
      if (raw && typeof raw === 'object' && Array.isArray(raw.credentials)) {
        webauthnState = { enabled: Boolean(raw.enabled), credentials: raw.credentials };
      }
    }
  } catch { /* estado inicial se arquivo corrompido */ }
  function saveWebauthnState() {
    try { fs.writeFileSync(webauthnStatePath, JSON.stringify(webauthnState, null, 2), 'utf8'); } catch { /* ignorar */ }
  }

  // Desafios ativos de WebAuthn: challenge -> { challenge, type: 'register'|'login', rpId, createdAt, clientIp }
  const activeWebAuthnChallenges = new Map();

  function getEffectiveRp(req) {
    const hostHeader = (req.headers['host'] || '').split(':')[0] || 'localhost';
    const isLocal = hostHeader === 'localhost' || hostHeader === '127.0.0.1';
    const rpId = isLocal ? 'localhost' : hostHeader;
    const proto = req.socket?.encrypted ? 'https' : 'http';
    const port = (req.headers['host'] || '').split(':')[1] || String(actualPort);
    const defaultPort = (proto === 'https' && port === '443') || (proto === 'http' && port === '80');
    const origin = defaultPort ? `${proto}://${rpId}` : `${proto}://${rpId}:${port}`;
    return { rpId, origin };
  }
  const failedLogins = new Map();      // ip -> { count, lastAttempt }
  const rateLimits = new Map();        // ip -> { count, windowStart, violations }
  const securityStats = {
    blockedRequests: 0,
    bannedIpsCount: 0,
    rateLimitViolations: 0,
    intrusionsDetected: 0,
    tarpittedConnections: 0,
    failedLogins: 0,
  };

  // Configurações dinâmicas de acesso do servidor (Configuráveis via Área Administrativa)
  const serverConfig = {
    enableUserLimit: false,
    maxUsersLimit: 30,
    autoIpBanEnabled: false,
    rateLimitEnabled: true,
    trustProxy: !!process.env.DATALINK_TRUST_PROXY,
  };

  // Contenção Zero-Trust & Defesa Tática (SOC)
  let isNetworkLockdown = false;
  const quarantinedClients = new Set();

  function normalizeIp(rawIp) {
    if (!rawIp) return '127.0.0.1';
    let ip = String(rawIp).trim();
    if (ip.includes(',')) ip = ip.split(',')[0].trim();
    ip = ip.replace(/^::ffff:/, '');
    if (ip === '::1' || ip === 'localhost') return '127.0.0.1';
    return ip;
  }

  function isLoopbackOrLocal(rawIp) {
    if (!rawIp) return true;
    const norm = normalizeIp(rawIp);
    if (norm === '127.0.0.1' || norm === '::1' || norm === 'localhost' || norm === '::') return true;
    try {
      const localIps = getLocalIPs();
      if (localIps.includes(norm)) return true;
    } catch {}
    return false;
  }

  function getClientIp(req) {
    const remoteAddr = req.socket?.remoteAddress;
    if (serverConfig.trustProxy && isLoopbackOrLocal(normalizeIp(remoteAddr))) {
      const forwarded = req.headers['x-forwarded-for'];
      if (forwarded) {
        return normalizeIp(forwarded.split(',')[0].trim());
      }
    }
    return normalizeIp(remoteAddr);
  }

  function isIpBanned(ip, req = null) {
    const norm = normalizeIp(ip);
    // ADMINISTRADOR / LOCALHOST NUNCA É BLOQUEADO
    if (isLoopbackOrLocal(norm)) return false;
    if (req && checkAdminAuth(req)) return false;

    const record = bannedIps.get(norm);
    if (!record) return false;
    if (record.expiresAt && Date.now() > record.expiresAt) {
      bannedIps.delete(norm);
      securityStats.bannedIpsCount = bannedIps.size;
      logEvent('security_unban', `Bloqueio temporário do IP ${norm} expirou.`);
      return false;
    }
    return true;
  }

  function banIp(ip, reason = 'Atividade maliciosa detectada', durationMinutes = null, auto = false) {
    const norm = normalizeIp(ip);
    // NUNCA banir localhost / loopback / IPs locais da máquina do administrador
    if (isLoopbackOrLocal(norm)) {
      logEvent('security_bypass', `Ignorando bloqueio para IP local/administrador: ${norm}`);
      return false;
    }
    // Se o bloqueio automático de IP estiver desativado nas configurações do servidor, ignora bans automáticos
    if (auto && !serverConfig.autoIpBanEnabled) {
      logEvent('security_auto_disabled', `Bloqueio automático ignorado para ${norm} (Fail2Ban desativado pelo administrador)`);
      return false;
    }

    const now = Date.now();
    const expiresAt = durationMinutes ? (now + durationMinutes * 60 * 1000) : null;
    bannedIps.set(norm, {
      ip: norm,
      reason,
      bannedAt: now,
      expiresAt,
      auto,
    });
    securityStats.bannedIpsCount = bannedIps.size;
    logEvent('security_ban', `IP ${norm} bloqueado (${auto ? 'Fail2Ban / Auto' : 'Manual'}): ${reason}`);

    // Derruba imediatamente conexões ativas desse IP (exceto administradores)
    for (const p of peers.values()) {
      if (!p.isAdmin && normalizeIp(p.remoteAddress) === norm) {
        try { p.conn.close(4003, 'Conexão encerrada: IP bloqueado pela segurança Blue Team'); } catch {}
      }
    }
    return true;
  }

  function unbanIp(ip) {
    const norm = normalizeIp(ip);
    if (bannedIps.has(norm)) {
      bannedIps.delete(norm);
      securityStats.bannedIpsCount = bannedIps.size;
      logEvent('security_unban', `IP ${norm} desbloqueado.`);
      return true;
    }
    return false;
  }

  function verifyAdminPassword(candidate) {
    if (typeof candidate !== 'string' || !candidate) return false;
    try {
      const cleanCandidate = candidate.trim();
      const hashCandidate = crypto.createHash('sha256').update(cleanCandidate).digest();
      const hashExpected = crypto.createHash('sha256').update(adminPassword).digest();
      return crypto.timingSafeEqual(hashCandidate, hashExpected);
    } catch {
      return false;
    }
  }

  function createAdminSession(ip) {
    const token = 'dl_sec_' + crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    adminSessions.set(token, {
      token,
      ip: normalizeIp(ip),
      createdAt: now,
      expiresAt: now + (12 * 3600 * 1000), // 12h
    });
    return token;
  }

  function validateAdminToken(token) {
    if (!token || typeof token !== 'string') return false;
    const session = adminSessions.get(token);
    if (session) {
      if (Date.now() > session.expiresAt) {
        adminSessions.delete(token);
        return false;
      }
      session.expiresAt = Date.now() + (12 * 3600 * 1000);
      return true;
    }
    return false;
  }

  function checkAdminAuth(req) {
    const auth = req.headers['authorization'] || '';
    let token = '';
    if (auth.startsWith('Bearer ')) {
      token = auth.slice(7).trim();
    }
    return validateAdminToken(token);
  }

  function checkRateLimit(ip, maxRequests = 120, windowMs = 60000) {
    const norm = normalizeIp(ip);
    // Localhost / loopback e administrador NUNCA sofrem restrição de rate limit
    if (isLoopbackOrLocal(norm) || !serverConfig.rateLimitEnabled) {
      return { ok: true, remaining: 9999 };
    }
    const now = Date.now();
    let entry = rateLimits.get(norm);
    if (!entry || now - entry.windowStart > windowMs) {
      entry = { count: 1, windowStart: now, violations: entry?.violations || 0 };
      rateLimits.set(norm, entry);
      return { ok: true, remaining: maxRequests - 1 };
    }
    entry.count++;
    if (entry.count > maxRequests) {
      entry.violations++;
      securityStats.rateLimitViolations++;
      if (entry.violations >= 5 && serverConfig.autoIpBanEnabled) {
        banIp(norm, 'Fail2Ban: Excesso de requisições persistente (Mitigação Anti-DDoS)', 15, true);
      }
      return { ok: false, retryAfter: Math.ceil((entry.windowStart + windowMs - now) / 1000) };
    }
    return { ok: true, remaining: maxRequests - entry.count };
  }

  const INTRUSION_PATTERNS = [
    /\.\.[\/\\]/,
    /%2e%2e/i,
    /\b(union\s+select|select\s+.+\s+from|insert\s+into|drop\s+table)\b/i,
    /<script[\s>]/i,
    /\/(etc\/passwd|proc\/self|windows\/system32)/i,
    /\.(env|git|svn|htaccess|bak|config)/i,
    /\b(phpinfo|wp-admin|xmlrpc\.php|phpmyadmin)\b/i,
    /[;&|`]\s*(cat|ls|rm|sh|bash|powershell|cmd\.exe)/i,
  ];

  function checkIntrusion(urlStr, bodyStr = '') {
    for (const pat of INTRUSION_PATTERNS) {
      if (pat.test(urlStr) || (bodyStr && pat.test(bodyStr))) {
        return pat.source;
      }
    }
    return null;
  }

  function runDefensiveTarpit(res, reason) {
    securityStats.tarpittedConnections++;
    securityStats.blockedRequests++;
    try {
      res.writeHead(403, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-BlueTeam-Shield': 'Tarpit-Engaged',
      });
      res.write(`[BLUETEAM SHIELD] Conexão retida defensivamente: ${reason}.\n`);
      let ticks = 0;
      const timer = setInterval(() => {
        ticks++;
        if (res.writableEnded || res.destroyed || ticks >= 10) {
          clearInterval(timer);
          try { res.end(); } catch {}
          return;
        }
        try {
          res.write('.\n');
        } catch {
          clearInterval(timer);
        }
      }, 3000);
      timer.unref?.();
      res.on('close', () => clearInterval(timer));
    } catch {}
  }

  // Repositório de Mensagens Anônimas NGL
  const nglStore = new Map();
  const MAX_NGL_PER_USER = 100;

  // Repositório Inteligente de Gravações & Arquivos CFTV
  const recordingsDir = path.resolve(path.join(__dirname, '..', 'recordings'));
  const recordingsIndexFile = path.join(recordingsDir, 'recordings-index.json');
  const MAX_RECORDINGS_COUNT = 500;
  const MAX_RECORDINGS_BYTES = 500 * 1024 * 1024; // 500 MB de cota

  function ensureRecordingsDir() {
    try {
      if (!fs.existsSync(recordingsDir)) {
        fs.mkdirSync(recordingsDir, { recursive: true });
      }
    } catch (e) {
      events.emit('log', `Aviso CFTV: Não foi possível criar pasta recordings (${e.message})`);
    }
  }

  function loadRecordingsIndex() {
    ensureRecordingsDir();
    try {
      if (fs.existsSync(recordingsIndexFile)) {
        const raw = fs.readFileSync(recordingsIndexFile, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      events.emit('log', `Aviso ao ler recordings-index.json: ${e.message}`);
    }
    return [];
  }

  function saveRecordingsIndex(list) {
    ensureRecordingsDir();
    try {
      fs.writeFileSync(recordingsIndexFile, JSON.stringify(list, null, 2), 'utf8');
    } catch (e) {
      events.emit('log', `Erro ao gravar recordings-index.json: ${e.message}`);
    }
  }

  // Quota inteligente: Purga FIFO de arquivos NÃO favoritados quando o limite for atingido
  function enforceRecordingsQuota(list) {
    let totalBytes = list.reduce((sum, r) => sum + (r.size || 0), 0);
    let changed = false;

    while ((list.length > MAX_RECORDINGS_COUNT || totalBytes > MAX_RECORDINGS_BYTES) && list.some(r => !r.starred)) {
      const oldestUnstarredIdx = list.reduce((oldIdx, cur, idx) => {
        if (cur.starred) return oldIdx;
        if (oldIdx === -1) return idx;
        return (cur.timestamp < list[oldIdx].timestamp) ? idx : oldIdx;
      }, -1);

      if (oldestUnstarredIdx === -1) break;

      const toRemove = list[oldestUnstarredIdx];
      list.splice(oldestUnstarredIdx, 1);
      changed = true;
      totalBytes -= (toRemove.size || 0);

      try {
        const diskFile = path.join(recordingsDir, toRemove.filename);
        if (fs.existsSync(diskFile)) fs.unlinkSync(diskFile);
        logEvent('cctv_purge', `Auto-Purge Inteligente FIFO: ${toRemove.filename} removido para liberar espaço.`);
      } catch {}
    }

    if (changed) {
      saveRecordingsIndex(list);
    }
    return list;
  }

  // Telemetria do Servidor
  const telemetry = {
    totalConnections: 0,
    totalMessagesRelayed: 0,
    totalBytesTransferred: 0,
    peakConcurrency: 0,
    messageTypesCount: {
      chat: 0,
      typing: 0,
      read: 0,
      react: 0,
      ngl: 0,
      'file-meta': 0,
      'file-end': 0,
      binary: 0,
    },
    eventLog: [],
  };

  function logEvent(type, detail) {
    telemetry.eventLog.push({ ts: Date.now(), type, detail });
    if (telemetry.eventLog.length > 100) telemetry.eventLog.shift();
  }

  function sanitizeLocation(loc) {
    if (!loc || typeof loc !== 'object') return null;
    const lat = Number(loc.latitude);
    const lon = Number(loc.longitude);
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return null;
    }
    const accuracy = typeof loc.accuracy === 'number' && loc.accuracy >= 0 ? Math.round(loc.accuracy * 10) / 10 : undefined;
    const altitude = typeof loc.altitude === 'number' ? Math.round(loc.altitude * 10) / 10 : null;
    const speed = typeof loc.speed === 'number' && loc.speed >= 0 ? Math.round(loc.speed * 10) / 10 : null;
    const country = typeof loc.country === 'string' && loc.country.trim() ? loc.country.trim().slice(0, 50) : 'Brasil';
    const countryCode = typeof loc.countryCode === 'string' && loc.countryCode.trim() ? loc.countryCode.trim().slice(0, 5).toUpperCase() : 'BR';
    const flag = typeof loc.flag === 'string' && loc.flag.trim() ? loc.flag.trim().slice(0, 10) : '🇧🇷';
    const city = typeof loc.city === 'string' ? loc.city.trim().slice(0, 50) : undefined;
    const region = typeof loc.region === 'string' ? loc.region.trim().slice(0, 50) : undefined;
    const source = typeof loc.source === 'string' ? loc.source.trim().slice(0, 20) : 'gps';

    return {
      latitude: lat,
      longitude: lon,
      accuracy,
      altitude,
      speed,
      country,
      countryCode,
      flag,
      city,
      region,
      source,
      timestamp: loc.timestamp || Date.now(),
    };
  }

  function getTelemetrySnapshot() {
    const mem = process.memoryUsage();
    const uptime = Math.floor((Date.now() - startedAt) / 1000);
    const activePeers = [...peers.values()].filter((p) => p.hello).map((p) => ({
      peerId: p.peerId,
      clientId: p.clientId,
      name: p.name,
      color: p.color,
      latency: p.latency ?? null,
      since: p.since,
      lastActiveAt: p.lastActiveAt || p.since,
      messagesSent: p.messagesSent || 0,
      bytesSent: p.bytesSent || 0,
      remoteAddress: p.remoteAddress || '127.0.0.1',
      userAgent: p.userAgent || 'Desconhecido',
      location: p.location || null,
      syntheticMac: p.syntheticMac || null,
      privacyShield: Boolean(p.privacyShield),
      isGhostAdmin: Boolean(p.isGhostAdmin),
      isAdmin: Boolean(p.isAdmin),
    }));

    return {
      server: {
        name: serverName,
        version: VERSION,
        port: actualPort,
        ips: getLocalIPs(),
        startedAt,
        uptimeSeconds: uptime,
        running,
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        osRelease: os.release(),
        cpus: os.cpus().length,
        nodeVersion: process.version,
        memory: {
          rssBytes: mem.rss,
          heapTotalBytes: mem.heapTotal,
          heapUsedBytes: mem.heapUsed,
          externalBytes: mem.external,
          systemTotalBytes: os.totalmem(),
          systemFreeBytes: os.freemem(),
        },
      },
      traffic: {
        totalConnections: telemetry.totalConnections,
        activePeersCount: activePeers.length,
        peakConcurrency: telemetry.peakConcurrency,
        totalMessagesRelayed: telemetry.totalMessagesRelayed,
        totalBytesTransferred: telemetry.totalBytesTransferred,
        messageTypesCount: { ...telemetry.messageTypesCount },
      },
      peers: activePeers,
      recentEvents: telemetry.eventLog.slice(-50),
    };
  }

  function maskIpForPrivacy(ip) {
    if (!ip) return '0.0.0.0';
    if (ip === '127.0.0.1' || ip === '::1') return '127.0.0.1 (Local Seguro)';
    if (ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
      }
    }
    if (ip.includes(':')) {
      const parts = ip.split(':');
      return `${parts.slice(0, 3).join(':')}:****:****`;
    }
    return '***.***.***.***';
  }

  function sanitizeUserAgent(ua) {
    if (!ua || ua === 'Desconhecido') return 'Nó JJY Soberano P2P';
    if (ua.includes('Electron')) return 'JJY Desktop App (Soberano)';
    if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) return 'Dispositivo Móvel JJY';
    return 'Estação de Trabalho JJY P2P';
  }

  function peerInfo(p, isRecipientAdmin = false) {
    const isGhost = Boolean(p.isGhostAdmin || (p.isAdmin && p.privacyShield));
    if (isGhost && !isRecipientAdmin) {
      return null; // Oculta totalmente o administrador de nós não autorizados (Ghost Mode)
    }

    return {
      peerId: p.peerId,
      clientId: p.clientId,
      name: isGhost && !isRecipientAdmin ? 'Nó Seguro Camuflado' : p.name,
      color: p.color,
      latency: p.latency ?? null,
      since: p.since,
      messagesSent: p.messagesSent || 0,
      bytesSent: p.bytesSent || 0,
      remoteAddress: isRecipientAdmin ? (p.remoteAddress || '127.0.0.1') : maskIpForPrivacy(p.remoteAddress),
      userAgent: isRecipientAdmin ? (p.userAgent || 'Desconhecido') : sanitizeUserAgent(p.userAgent),
      lastActiveAt: p.lastActiveAt || p.since,
      location: p.location || null,
      syntheticMac: p.syntheticMac || null,
      privacyShield: Boolean(p.privacyShield),
      isGhostAdmin: isGhost,
    };
  }

  function broadcastSend(obj, exceptPeerId, adminOnly = false) {
    for (const p of peers.values()) {
      if (p.peerId !== exceptPeerId && p.hello) {
        if (adminOnly && !p.isAdmin) continue;
        p.conn.sendText(obj);
      }
    }
  }

  function handleTextMessage(peer, raw) {
    peer.lastActiveAt = Date.now();
    let msg;
    try {
      msg = JSON.parse(raw.toString('utf8'));
    } catch {
      peer.conn.sendText({ t: 'error', msg: 'JSON inválido' });
      return;
    }
    if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return;

    if (msg.t === 'ping') {
      peer.conn.sendText({ t: 'pong', t0: msg.t0 });
      return;
    }

    // Comandos de Administrador e Telemetria (Protegidos)
    if (msg.t === 'admin:auth') {
      const isAuthorized = validateAdminToken(msg.token);
      if (isAuthorized) {
        peer.isAdmin = true;
        peer.conn.sendText({ t: 'admin:auth_ack', ok: true });
        logEvent('admin_ws_auth', `Sessão WebSocket promovida para Admin (${peer.name})`);
      } else {
        peer.isAdmin = false;
        peer.conn.sendText({ t: 'admin:auth_ack', ok: false, error: 'Token de administrador inválido' });
      }
      return;
    }

    if (msg.t === 'admin:get_telemetry') {
      if (!validateAdminToken(msg.token)) {
        peer.conn.sendText({ t: 'admin:ack', action: 'telemetry', ok: false, error: 'Token de administrador inválido ou expirado' });
        return;
      }
      peer.conn.sendText({ t: 'admin:telemetry', data: getTelemetrySnapshot() });
      return;
    }

    if (msg.t === 'admin:kick') {
      if (!validateAdminToken(msg.token)) {
        peer.conn.sendText({ t: 'admin:ack', action: 'kick', ok: false, error: 'Token de administrador inválido ou expirado' });
        return;
      }
      const targetClientId = msg.clientId;
      const target = byClientId.get(targetClientId);
      if (target) {
        logEvent('admin_kick', `Usuário ${target.name} (${target.clientId}) expulso pelo administrador`);
        target.conn.close(4001, msg.reason || 'Desconectado pelo administrador');
        peer.conn.sendText({ t: 'admin:ack', action: 'kick', targetClientId, ok: true });
      } else {
        peer.conn.sendText({ t: 'admin:ack', action: 'kick', targetClientId, ok: false, error: 'Usuário não encontrado' });
      }
      return;
    }

    if (msg.t === 'admin:broadcast') {
      if (!validateAdminToken(msg.token)) {
        peer.conn.sendText({ t: 'admin:ack', action: 'broadcast', ok: false, error: 'Token de administrador inválido ou expirado' });
        return;
      }
      const broadcastMsg = {
        t: 'chat',
        id: 'admin-' + Date.now(),
        room: 'geral',
        fromName: '🚨 ADMINISTRADOR',
        fromColor: '#ef4444',
        text: String(msg.text || '').slice(0, 500),
        ts: Date.now(),
      };
      logEvent('broadcast', `Aviso global enviado: ${broadcastMsg.text}`);
      for (const p of peers.values()) {
        if (p.hello) p.conn.sendText(broadcastMsg);
      }
      peer.conn.sendText({ t: 'admin:ack', action: 'broadcast', ok: true });
      return;
    }

    // Mensagens Anônimas Jjy / NGL via WebSocket
    if (msg.t === 'jjy:send' || msg.t === 'ngl:send') {
      const target = String(msg.target || '').trim().toLowerCase();
      const text = String(msg.text || '').trim();
      if (!target || !text) {
        peer.conn.sendText({ t: msg.t === 'jjy:send' ? 'jjy:ack' : 'ngl:ack', ok: false, error: 'target e text são obrigatórios' });
        return;
      }
      const nglMsg = {
        id: msg.id || ('jjy_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex')),
        target,
        prompt: String(msg.prompt || '').trim(),
        text: text.slice(0, 500),
        mood: String(msg.mood || '🤫 Segredo').trim(),
        timestamp: msg.timestamp || Date.now(),
        read: false,
        reply: '',
      };
      if (!nglStore.has(target)) nglStore.set(target, []);
      const userList = nglStore.get(target);
      userList.unshift(nglMsg);
      if (userList.length > MAX_NGL_PER_USER) userList.pop();

      telemetry.messageTypesCount.ngl = (telemetry.messageTypesCount.ngl || 0) + 1;
      logEvent('jjy_send', `Mensagem anônima Jjy para @${target} via WebSocket`);
      events.emit('ngl:message', nglMsg);
      events.emit('jjy:message', nglMsg);

      for (const p of peers.values()) {
        if (p.hello) {
          p.conn.sendText({ t: 'jjy:message', msg: nglMsg });
          p.conn.sendText({ t: 'ngl:message', msg: nglMsg });
        }
      }
      peer.conn.sendText({ t: msg.t === 'jjy:send' ? 'jjy:ack' : 'ngl:ack', ok: true, id: nglMsg.id, msg: nglMsg });
      return;
    }

    if (msg.t === 'jjy:get_inbox' || msg.t === 'ngl:get_inbox') {
      const target = String(msg.target || peer.name || '').trim().toLowerCase();
      const list = nglStore.get(target) || [];
      peer.conn.sendText({ t: msg.t === 'jjy:get_inbox' ? 'jjy:inbox' : 'ngl:inbox', target, messages: list });
      return;
    }

    if (msg.t === 'hello') {
      const clientId = String(msg.clientId || '').slice(0, 64);
      const name = String(msg.name || 'Anônimo').slice(0, 40).trim() || 'Anônimo';
      const color = /^#[0-9a-fA-F]{6}$/.test(msg.color || '') ? msg.color : randomColor();
      if (!clientId) {
        peer.conn.sendText({ t: 'error', msg: 'clientId obrigatório' });
        peer.conn.close(1008, 'clientId obrigatório');
        return;
      }
      clearTimeout(peer.helloTimer);

      const isAlert = Boolean(msg.isAlertListener || msg.role === 'alert-listener' || clientId.endsWith('-alert'));
      peer.isAlertListener = isAlert;
      if (isAlert) {
        peer.baseClientId = msg.baseClientId || clientId.replace(/-alert$/, '');
      }

      // Reconexão com o mesmo clientId substitui a sessão antiga (não substitui se for alert listener)
      const existing = byClientId.get(clientId);
      if (existing && existing !== peer) {
        byClientId.delete(clientId);
        peers.delete(existing.peerId);
        existing.conn.close(4000, 'Sessão substituída');
      }
      // Admin só via login com 2FA — hello não promove a admin
      if (msg.adminToken && validateAdminToken(msg.adminToken)) {
        peer.isAdmin = true;
      }

      peer.syntheticMac = typeof msg.syntheticMac === 'string' ? msg.syntheticMac.slice(0, 24) : null;
      peer.privacyShield = Boolean(msg.privacyShield);
      if (peer.isAdmin && msg.isGhostAdmin !== false) {
        peer.isGhostAdmin = true;
      }

      const activeUserLimit = serverConfig.enableUserLimit ? serverConfig.maxUsersLimit : MAX_PEERS;
      if (!peer.hello && peers.size >= activeUserLimit && !peer.isAdmin) {
        peer.conn.sendText({
          t: 'error',
          msg: `Capacidade máxima de usuários atingida no servidor (${activeUserLimit} estações). Acesso restrito por limite de usuários.`
        });
        peer.conn.close(1013, 'Servidor cheio');
        return;
      }

      peer.hello = true;
      peer.clientId = clientId;
      peer.name = name;
      peer.color = color;
      peer.since = Date.now();
      const defaultLoc = {
        latitude: -23.5505,
        longitude: -46.6333,
        accuracy: 25,
        altitude: null,
        speed: null,
        country: 'Brasil',
        countryCode: 'BR',
        flag: '🇧🇷',
        city: 'São Paulo',
        source: peer.remoteAddress === '127.0.0.1' || peer.remoteAddress === '::1' ? 'local' : 'network',
        timestamp: Date.now(),
      };
      peer.location = msg.location ? (sanitizeLocation(msg.location) || defaultLoc) : defaultLoc;
      byClientId.set(clientId, peer);

      telemetry.peakConcurrency = Math.max(telemetry.peakConcurrency, peers.size);
      logEvent('join', `${peer.name} (${peer.clientId}) conectado via ${peer.remoteAddress}${peer.syntheticMac ? ` [MAC: ${peer.syntheticMac}]` : ''}`);

      const isRecipientAdmin = Boolean(peer.isAdmin);
      const visiblePeers = [...peers.values()]
        .filter((p) => p.hello && p !== peer && !p.isAlertListener)
        .map((p) => peerInfo(p, isRecipientAdmin))
        .filter(Boolean);

      peer.conn.sendText({
        t: 'welcome',
        you: peerInfo(peer, isRecipientAdmin),
        peers: visiblePeers,
        server: {
          name: serverName,
          version: VERSION,
          port: actualPort,
          ips: getLocalIPs(),
          startedAt,
        },
      });

      if (!peer.isAlertListener) {
        if (peer.isGhostAdmin) {
          // Modo Fantasma do Administrador: Notifica apenas outros administradores na rede
          broadcastSend({ t: 'peer:join', peer: peerInfo(peer, true) }, peer.peerId, true);
        } else {
          for (const targetPeer of peers.values()) {
            if (targetPeer.peerId !== peer.peerId && targetPeer.hello) {
              const info = peerInfo(peer, Boolean(targetPeer.isAdmin));
              if (info) targetPeer.conn.sendText({ t: 'peer:join', peer: info });
            }
          }
        }
        events.emit('peer:join', peerInfo(peer, true));
      }

      // Entrega imediata de alertas de emergência pendentes (caso o usuário tenha acabado de abrir o navegador)
      if (!peer.isAdmin) {
        const now = Date.now();
        for (const [targetKey, alertData] of pendingEmergencyAlerts.entries()) {
          if (alertData.expiresAt && alertData.expiresAt > now) {
            if (targetKey === 'all' || targetKey === clientId) {
              peer.conn.sendText(alertData);
            }
          }
        }
      }
      return;
    }

    if (!peer.hello) {
      peer.conn.sendText({ t: 'error', msg: 'Envie hello primeiro' });
      return;
    }

    if (msg.t === 'name' || msg.t === 'privacy:update') {
      if (msg.name) peer.name = String(msg.name).slice(0, 40).trim() || peer.name;
      if (/^#[0-9a-fA-F]{6}$/.test(msg.color || '')) peer.color = msg.color;
      if (typeof msg.syntheticMac === 'string') peer.syntheticMac = msg.syntheticMac.slice(0, 24);
      if (msg.privacyShield !== undefined) peer.privacyShield = Boolean(msg.privacyShield);
      if (msg.isGhostAdmin !== undefined && peer.isAdmin) peer.isGhostAdmin = Boolean(msg.isGhostAdmin);

      for (const targetPeer of peers.values()) {
        if (targetPeer.peerId !== peer.peerId && targetPeer.hello) {
          const info = peerInfo(peer, Boolean(targetPeer.isAdmin));
          if (info) targetPeer.conn.sendText({ t: 'peer:update', peer: info });
        }
      }
      peer.conn.sendText({ t: 'you:update', peer: peerInfo(peer, Boolean(peer.isAdmin)) });
      return;
    }

    if (RELAY_TYPES.has(msg.t)) {
      if (typeof msg.room !== 'string' || msg.room.length > 200) return;

      // Defesa Zero-Trust: Bloqueio imediato se a rede estiver em Lockdown (DEFCON 1) ou se a estação estiver Quarentenada
      if (isNetworkLockdown && !peer.isAdmin) {
        peer.conn.sendText({ t: 'error', code: 'NETWORK_LOCKDOWN', msg: 'Rede em lockdown administrativo de contenção (DEFCON 1). Tráfego suspenso.' });
        return;
      }
      if (quarantinedClients.has(peer.clientId) && !peer.isAdmin) {
        peer.conn.sendText({ t: 'error', code: 'CLIENT_QUARANTINED', msg: 'Esta estação está em quarentena de segurança pela administração.' });
        return;
      }

      const relay = { ...msg, from: peer.peerId, fromClientId: peer.clientId, fromName: peer.name, fromColor: peer.color };

      // Disparo de Popup de Emergência pelo Administrador para Estações
      if (msg.t === 'admin-popup') {
        if (!peer.isAdmin) {
          peer.conn.sendText({ t: 'error', msg: 'Acesso negado: apenas administradores podem disparar popups de emergência.' });
          return;
        }
        logEvent('admin_popup', `[ADMIN POPUP] ${peer.name} enviou alerta para ${msg.targetClientId || 'todos'}: "${msg.title || 'Alerta'}"`);
        savePendingAlert(relay);

        for (const p of peers.values()) {
          const matchTarget = !msg.targetClientId || msg.targetClientId === 'all' ||
            p.clientId === msg.targetClientId ||
            (p.baseClientId && p.baseClientId === msg.targetClientId) ||
            p.clientId === `${msg.targetClientId}-alert`;
          if (p.hello && p !== peer && matchTarget) {
            p.conn.sendText(relay);
          }
        }

        // Se o servidor estiver no Windows, executa aviso nativo do Windows (PowerShell MessageBox)
        // para garantir que mesmo com o navegador fechado no host o aviso surja na área de trabalho!
        if (process.platform === 'win32' && (!msg.targetClientId || msg.targetClientId === 'all' || isLoopbackOrLocal(peer.remoteAddress))) {
          triggerWindowsNativeAlert(msg.title || 'ALERTA DO ADMINISTRADOR', msg.message || 'Mensagem urgente da Central');
        }

        peer.conn.sendText({ t: 'admin-popup:sent', ok: true, id: msg.id, target: msg.targetClientId || 'all' });
        return;
      }

      // Confirmação de recebimento do popup (ACK) enviada pelo usuário
      if (msg.t === 'alert-ack') {
        logEvent('alert_ack', `[ACK] Usuário ${peer.name} (${peer.clientId}) confirmou recebimento do alerta ${msg.alertId}`);
        for (const p of peers.values()) {
          if (p.hello && p.isAdmin) {
            p.conn.sendText(relay);
          }
        }
        return;
      }

      // Silenciamento / Desligamento de Alerta (disparado pelo Admin ou pelo próprio Usuário clicando no alerta)
      if (msg.t === 'silence-alert') {
        const targetDesc = msg.targetClientId || 'todos';
        logEvent('silence_alert', `[SILÊNCIO] Alerta/sirene silenciado por ${peer.name} (${peer.clientId}) para ${targetDesc}`);
        for (const p of peers.values()) {
          const matchTarget = !msg.targetClientId || msg.targetClientId === 'all' ||
            p.clientId === msg.targetClientId ||
            (p.baseClientId && p.baseClientId === msg.targetClientId) ||
            p.clientId === `${msg.targetClientId}-alert`;
          if (p.hello && (matchTarget || p.isAdmin)) {
            p.conn.sendText(relay);
          }
        }
        return;
      }

      // Reprodução individual de Som / Chime / Beep para estação específica
      if (msg.t === 'play-sound') {
        logEvent('play_sound', `[SOM] Toque sonoro enviado por ${peer.name} para ${msg.targetClientId || 'todos'}`);
        for (const p of peers.values()) {
          const matchTarget = !msg.targetClientId || msg.targetClientId === 'all' ||
            p.clientId === msg.targetClientId ||
            (p.baseClientId && p.baseClientId === msg.targetClientId) ||
            p.clientId === `${msg.targetClientId}-alert`;
          if (p.hello && matchTarget) {
            p.conn.sendText(relay);
          }
        }
        return;
      }

      // Interfone / Áudio ao vivo bidirecional entre Administrador e Usuário
      if (msg.t === 'intercom-audio') {
        if (peer.isAdmin) {
          // Admin falando para uma estação específica (ou todos)
          for (const p of peers.values()) {
            const matchTarget = !msg.targetClientId || msg.targetClientId === 'all' ||
              p.clientId === msg.targetClientId ||
              (p.baseClientId && p.baseClientId === msg.targetClientId) ||
              p.clientId === `${msg.targetClientId}-alert`;
            if (p.hello && matchTarget) {
              p.conn.sendText(relay);
            }
          }
        } else {
          // Usuário falando pelo interfone para a Administração
          for (const p of peers.values()) {
            if (p.hello && p.isAdmin) {
              p.conn.sendText(relay);
            }
          }
        }
        return;
      }

      // Comando do Administrador para estações (apenas peer.isAdmin pode disparar)
      if (msg.t === 'remote-command') {
        if (!peer.isAdmin) {
          peer.conn.sendText({ t: 'error', msg: 'Acesso negado: comandos remotos exigem privilégios de Administrador.' });
          return;
        }
        for (const p of peers.values()) {
          const matchTarget = !msg.targetClientId || msg.targetClientId === 'all' ||
            p.clientId === msg.targetClientId ||
            (p.baseClientId && p.baseClientId === msg.targetClientId) ||
            p.clientId === `${msg.targetClientId}-alert`;
          if (p.hello && !p.isAdmin && matchTarget) {
            p.conn.sendText(relay);
          }
        }
        return;
      }

      // Segurança & Privacidade: Feeds de Câmera, Áudio, Alertas e Arquivos
      // Entregues EXCLUSIVAMENTE a Administradores Autenticados
      const ADMIN_ONLY_TYPES = new Set(['stream-frame', 'remote-alert', 'file-offer', 'file-request', 'audio-sample', 'device-telemetry', 'screen-frame', 'screen-telemetry', 'parental-alert', 'location:update']);
      if (ADMIN_ONLY_TYPES.has(msg.t)) {
        if ((msg.t === 'device-telemetry' || msg.t === 'location:update' || msg.t === 'stream-frame' || msg.t === 'screen-frame') && msg.location) {
          const loc = sanitizeLocation(msg.location);
          if (loc) peer.location = loc;
        }
        for (const p of peers.values()) {
          if (p.hello && p.isAdmin) {
            p.conn.sendText(relay);
          }
        }
      } else {
        broadcastSend(relay, peer.peerId);
      }

      if (msg.t === 'chat' || msg.t === 'file-meta' || msg.t === 'file-end') {
        peer.conn.sendText({ t: 'ack', id: msg.id });
      }

      // Telemetria de tráfego
      telemetry.totalMessagesRelayed++;
      telemetry.totalBytesTransferred += raw.length;
      peer.messagesSent = (peer.messagesSent || 0) + 1;
      peer.bytesSent = (peer.bytesSent || 0) + raw.length;
      if (telemetry.messageTypesCount[msg.t] !== undefined) {
        telemetry.messageTypesCount[msg.t]++;
      }
      return;
    }
  }

  function handleBinaryMessage(peer, data) {
    if (!peer.hello) return;
    peer.lastActiveAt = Date.now();
    telemetry.totalMessagesRelayed++;
    telemetry.totalBytesTransferred += data.length;
    telemetry.messageTypesCount.binary = (telemetry.messageTypesCount.binary || 0) + 1;
    peer.messagesSent = (peer.messagesSent || 0) + 1;
    peer.bytesSent = (peer.bytesSent || 0) + data.length;

    // Prefixa o peerId (2 bytes) para o receptor saber a origem
    const out = Buffer.allocUnsafe(data.length + 2);
    out.writeUInt16BE(peer.peerId, 0);
    data.copy(out, 2);
    for (const p of peers.values()) {
      if (p !== peer && p.hello) p.conn.sendBinary(out);
    }
  }

  function onConnection(conn, req) {
    telemetry.totalConnections++;
    const peer = {
      peerId: nextPeerId++,
      conn,
      hello: false,
      clientId: null,
      name: null,
      color: null,
      latency: null,
      since: Date.now(),
      lastActiveAt: Date.now(),
      messagesSent: 0,
      bytesSent: 0,
      helloTimer: null,
      pingSentAt: 0,
      remoteAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || 'Desconhecido',
      isAdmin: false,
    };
    peers.set(peer.peerId, peer);

    conn.on('pong', () => {
      if (peer.pingSentAt) peer.latency = Date.now() - peer.pingSentAt;
    });

    peer.helloTimer = setTimeout(() => {
      if (!peer.hello) conn.close(1008, 'Hello não recebido');
    }, HELLO_TIMEOUT);

    conn.on('message', (kind, data) => {
      if (kind === 'text') handleTextMessage(peer, data);
      else handleBinaryMessage(peer, data);
    });

    conn.on('close', () => {
      clearTimeout(peer.helloTimer);
      if (peers.get(peer.peerId) === peer) {
        peers.delete(peer.peerId);
        if (peer.clientId && byClientId.get(peer.clientId) === peer) byClientId.delete(peer.clientId);
        if (peer.hello && !peer.isAlertListener) {
          logEvent('leave', `${peer.name || 'Anônimo'} (${peer.clientId}) desconectou`);
          if (peer.isGhostAdmin) {
            broadcastSend({ t: 'peer:leave', peerId: peer.peerId, clientId: peer.clientId }, peer.peerId, true);
          } else {
            broadcastSend({ t: 'peer:leave', peerId: peer.peerId, clientId: peer.clientId });
          }
          events.emit('peer:leave', { peerId: peer.peerId, clientId: peer.clientId, name: peer.name });
        }
      }
    });

    events.emit('connection', { remoteAddress: peer.remoteAddress });
  }

  const server = {
    get running() { return running; },
    get port() { return actualPort; },

    start(portOverride) {
      if (running) return Promise.resolve(actualPort);
      const tryPort = portOverride ?? actualPort;
      return new Promise((resolve, reject) => {
        const requestHandler = (req, res) => {
          // CORS: Permitir origens da rede local e localhost (não wildcard aberto em produção)
          const origin = req.headers['origin'] || '';
          const allowedOriginPatterns = [
            /^https?:\/\/localhost(:\d+)?$/,
            /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
            /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
            /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
            /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$/,
          ];
          const corsOrigin = allowedOriginPatterns.some(p => p.test(origin)) ? origin : `http://localhost:${actualPort}`;
          res.setHeader('Access-Control-Allow-Origin', corsOrigin);
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          res.setHeader('Vary', 'Origin');

          if (req.method === 'OPTIONS') {
            res.writeHead(204).end();
            return;
          }

          const clientIp = getClientIp(req);
          const isLocal = isLoopbackOrLocal(clientIp);
          const isAdmin = checkAdminAuth(req);

          // Parse URL para separar pathname de query string
          // Corrige bug onde req.url inclui ?token=xxx e comparações exatas falham
          const _parsedUrl = new URL(req.url, 'http://localhost');
          const pathname = _parsedUrl.pathname;

          // Rota direta de emergência para auto-desbloqueio (Apenas Localhost ou Admin)
          if (pathname === '/api/unban-self' || pathname === '/api/unban-local') {
            if (!isLocal && !isAdmin) {
              res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, error: 'Apenas acesso local ou administrador pode autodesbloquear.' }));
              return;
            }
            unbanIp(clientIp);
            unbanIp('127.0.0.1');
            failedLogins.delete(clientIp);
            failedLogins.delete('127.0.0.1');
            rateLimits.delete(clientIp);
            rateLimits.delete('127.0.0.1');
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true, message: 'Seu IP foi liberado da quarentena com sucesso.', ip: clientIp }));
            return;
          }

          // 1. Defesa Blue Team: Verificação de Lista Negra (Blacklist / Quarentena)
          // Administrador e Localhost NUNCA sofrem restrição de IP
          if (!isLocal && !isAdmin && isIpBanned(clientIp, req)) {
            securityStats.blockedRequests++;
            res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: 'Acesso bloqueado: Este IP está temporariamente na lista negra de segurança.' }));
            return;
          }

          // 2. Defesa Blue Team: Detecção de Assinaturas de Intrusão (WAF/IDS)
          // Ignorado para administradores locais para evitar falsos positivos
          if (!isLocal && !isAdmin) {
            const intrusionMatch = checkIntrusion(req.url);
            if (intrusionMatch) {
              securityStats.intrusionsDetected++;
              logEvent('security_intrusion', `Assinatura de ataque de ${clientIp}: padrão [${intrusionMatch}] em ${req.url}`);
              if (serverConfig.autoIpBanEnabled) {
                banIp(clientIp, `Tentativa de invasão/exploit (padrão: ${intrusionMatch})`, 60, true);
              }
              runDefensiveTarpit(res, 'Assinatura maliciosa detectada');
              return;
            }
          }

          // 3. Defesa Blue Team: Rate Limiting & Anti-DDoS por IP
          const maxReqs = (pathname === '/api/admin/login') ? 15 : 180;
          const rateCheck = checkRateLimit(clientIp, maxReqs);
          if (!rateCheck.ok) {
            securityStats.blockedRequests++;
            res.writeHead(429, {
              'Content-Type': 'application/json; charset=utf-8',
              'Retry-After': String(rateCheck.retryAfter || 60),
            });
            res.end(JSON.stringify({ ok: false, error: 'Muitas requisições. Sistema Anti-DDoS ativo. Aguarde antes de tentar novamente.' }));
            return;
          }

          // 4. Defesa Blue Team: Proteção contra Buffer Overflow e Exaustão de RAM
          const isCctvUpload = pathname.startsWith('/api/cctv');
          const maxPayload = isCctvUpload ? 15 * 1024 * 1024 : 64 * 1024;
          const declaredContentLength = parseInt(req.headers['content-length'] || '0', 10);
          if (declaredContentLength > maxPayload && req.method === 'POST') {
            securityStats.blockedRequests++;
            logEvent('security_overflow', `Tentativa de payload excessivo de ${clientIp} (${declaredContentLength} bytes)`);
            res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: 'Payload excessivo rejeitado (Mitigação de Exaustão de Buffer/RAM)' }));
            return;
          }

          // Atalhos amigáveis
          if (pathname === '/ngl' || pathname === '/ngl/' || pathname === '/jjy' || pathname === '/jjy/') {
            res.writeHead(302, { Location: '/Jjy.html' }).end();
            return;
          }
          if (pathname === '/chat' || pathname === '/chat/') {
            res.writeHead(302, { Location: '/DataLink-Chat.html' }).end();
            return;
          }

          // API REST de Informações de Rede e Servidor (Pública)
          if (pathname === '/api/info' || pathname === '/api/network') {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
              ok: true,
              name: serverName,
              version: VERSION,
              port: actualPort,
              httpsPort: httpsServer ? actualHttpsPort : null,
              httpsAvailable: Boolean(httpsServer),
              ips: getLocalIPs(),
              startedAt,
            }));
            return;
          }

          // API REST: Autenticação de Administrador (Login)
          if (pathname === '/api/admin/login' && req.method === 'POST') {
            let body = '';
            let bodyTooLarge = false;
            req.on('data', (c) => {
              if (bodyTooLarge) return;
              body += c;
              if (body.length > 64 * 1024) {
                bodyTooLarge = true;
                securityStats.blockedRequests++;
                res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' })
                  .end(JSON.stringify({ ok: false, error: 'Payload excessivo' }));
                req.destroy();
              }
            });
            req.on('end', () => {
              if (bodyTooLarge) return;
              try {
                const data = JSON.parse(body || '{}');
                const password = String(data.password || '');
                const otpCode = String(data.otp || '').replace(/\s/g, '');
                if (verifyAdminPassword(password)) {
                  // Se TOTP está habilitado, exigir código OTP
                  if (totpState.enabled && totpState.secret) {
                    if (!otpCode || otpCode.length !== 6) {
                      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
                      res.end(JSON.stringify({ ok: false, error: 'Código TOTP obrigatório.', requireOtp: true }));
                      return;
                    }
                    if (!verifyTotp(totpState.secret, otpCode)) {
                      securityStats.failedLogins++;
                      logEvent('security_totp_fail', `Código TOTP inválido de ${clientIp}`);
                      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
                      res.end(JSON.stringify({ ok: false, error: 'Código TOTP inválido ou expirado.', requireOtp: true }));
                      return;
                    }
                  }
                  failedLogins.delete(clientIp);
                  unbanIp(clientIp);
                  const token = createAdminSession(clientIp);
                  logEvent('admin_login', `Login de administrador concedido para ${clientIp}${totpState.enabled ? ' (com 2FA)' : ''}`);
                  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                  res.end(JSON.stringify({ ok: true, token, expiresIn: 43200, totpEnabled: totpState.enabled }));
                  return;
                }

                // Senha incorreta: Registro e Fail2Ban
                securityStats.failedLogins++;
                const failRecord = failedLogins.get(clientIp) || { count: 0, lastAttempt: Date.now() };
                failRecord.count++;
                failRecord.lastAttempt = Date.now();
                failedLogins.set(clientIp, failRecord);
                logEvent('security_auth_fail', `Falha de autenticação admin de ${clientIp} (${failRecord.count}/5)`);

                if (!isLocal && failRecord.count >= 5) {
                  banIp(clientIp, 'Fail2Ban: 5 tentativas inválidas de senha de administrador', 30, true);
                  res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
                  res.end(JSON.stringify({
                    ok: false,
                    error: 'IP bloqueado temporariamente (30 minutos) por tentativas excessivas de login inválido (Fail2Ban).',
                    banned: true,
                  }));
                  return;
                }

                res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                  ok: false,
                  error: 'Senha de administrador incorreta.',
                  attemptsRemaining: isLocal ? 99 : Math.max(0, 5 - failRecord.count),
                }));
              } catch {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
                  .end(JSON.stringify({ ok: false, error: 'JSON inválido' }));
              }
            });
            return;
          }

          // API REST: Logout de Administrador
          if (pathname === '/api/admin/logout' && req.method === 'POST') {
            const auth = req.headers['authorization'] || '';
            const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
            if (token) adminSessions.delete(token);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          // API REST: Checar Status de Autenticação do Administrador
          if (pathname === '/api/admin/status' && req.method === 'GET') {
            const isAuthed = checkAdminAuth(req);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true, authenticated: isAuthed }));
            return;
          }

          // API REST: Métricas de Segurança Blue Team
          if (pathname === '/api/admin/security' && req.method === 'GET') {
            if (!checkAdminAuth(req)) {
              securityStats.blockedRequests++;
              res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, error: 'Autenticação necessária' }));
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
              ok: true,
              stats: { ...securityStats, activeBans: bannedIps.size },
              bannedIps: Array.from(bannedIps.values()),
              isLockdown: isNetworkLockdown,
              quarantinedClients: Array.from(quarantinedClients.values()),
            }));
            return;
          }

          // API REST: Banir IP Manualmente
          if (pathname === '/api/admin/ban' && req.method === 'POST') {
            if (!checkAdminAuth(req)) {
              securityStats.blockedRequests++;
              res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, error: 'Autenticação de administrador necessária' }));
              return;
            }
            let body = '';
            let bodyLen = 0;
            req.on('data', (c) => { bodyLen += c.length; if (bodyLen > MAX_POST_BODY) { req.destroy(); return; } body += c; });
            req.on('end', () => {
              try {
                const data = JSON.parse(body || '{}');
                const targetIp = normalizeIp(data.ip || '');
                if (!targetIp) {
                  res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
                    .end(JSON.stringify({ ok: false, error: 'IP é obrigatório' }));
                  return;
                }
                const reason = String(data.reason || 'Bloqueado manualmente pelo administrador').trim();
                const duration = data.durationMinutes ? parseInt(data.durationMinutes, 10) : null;
                banIp(targetIp, reason, duration, false);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: true, bannedIps: Array.from(bannedIps.values()) }));
              } catch {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
                  .end(JSON.stringify({ ok: false, error: 'JSON inválido' }));
              }
            });
            return;
          }

          // API REST: Desbloquear IP (Unban)
          if (pathname === '/api/admin/unban' && req.method === 'POST') {
            if (!checkAdminAuth(req)) {
              securityStats.blockedRequests++;
              res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, error: 'Autenticação de administrador necessária' }));
              return;
            }
            let body = '';
            let bodyLen = 0;
            req.on('data', (c) => { bodyLen += c.length; if (bodyLen > MAX_POST_BODY) { req.destroy(); return; } body += c; });
            req.on('end', () => {
              try {
                const data = JSON.parse(body || '{}');
                const targetIp = normalizeIp(data.ip || '');
                unbanIp(targetIp);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: true, bannedIps: Array.from(bannedIps.values()) }));
              } catch {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
                  .end(JSON.stringify({ ok: false, error: 'JSON inválido' }));
              }
            });
            return;
          }

          // API REST: Desbloquear Todos os IPs (Limpar Quarentena Geral)
          if (pathname === '/api/admin/unban-all' && req.method === 'POST') {
            if (!checkAdminAuth(req)) {
              res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' })
                .end(JSON.stringify({ ok: false, error: 'Autenticação de administrador necessária' }));
              return;
            }
            bannedIps.clear();
            failedLogins.clear();
            rateLimits.clear();
            securityStats.bannedIpsCount = 0;
            logEvent('security_unban_all', `Lista negra e quarentena limpas pelo administrador.`);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true, bannedIps: [] }));
            return;
          }

          // API REST: Configurações de Acesso & Lotação por Número de Usuários (GET)
          if (pathname === '/api/admin/config' && req.method === 'GET') {
            if (!checkAdminAuth(req)) {
              res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' })
                .end(JSON.stringify({ ok: false, error: 'Autenticação necessária' }));
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
              ok: true,
              config: serverConfig,
              connectedUsers: peers.size,
              maxUsersLimit: serverConfig.maxUsersLimit,
              enableUserLimit: serverConfig.enableUserLimit,
              autoIpBanEnabled: serverConfig.autoIpBanEnabled,
              rateLimitEnabled: serverConfig.rateLimitEnabled,
            }));
            return;
          }

          // API REST: Atualizar Configurações de Acesso & Lotação por Número de Usuários (POST)
          if (pathname === '/api/admin/config' && req.method === 'POST') {
            if (!checkAdminAuth(req)) {
              res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' })
                .end(JSON.stringify({ ok: false, error: 'Autenticação de administrador necessária' }));
              return;
            }
            let body = '';
            let bodyLen = 0;
            req.on('data', (c) => { bodyLen += c.length; if (bodyLen > MAX_POST_BODY) { req.destroy(); return; } body += c; });
            req.on('end', () => {
              try {
                const data = JSON.parse(body || '{}');
                if (data.enableUserLimit !== undefined) serverConfig.enableUserLimit = Boolean(data.enableUserLimit);
                if (data.maxUsersLimit !== undefined) serverConfig.maxUsersLimit = Math.max(1, parseInt(data.maxUsersLimit, 10) || 30);
                if (data.autoIpBanEnabled !== undefined) serverConfig.autoIpBanEnabled = Boolean(data.autoIpBanEnabled);
                if (data.rateLimitEnabled !== undefined) serverConfig.rateLimitEnabled = Boolean(data.rateLimitEnabled);
                logEvent('config_update', `Configurações atualizadas: Limite por Usuários=${serverConfig.enableUserLimit} (Máx: ${serverConfig.maxUsersLimit}), AutoBan=${serverConfig.autoIpBanEnabled}`);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: true, config: serverConfig }));
              } catch {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
                  .end(JSON.stringify({ ok: false, error: 'JSON inválido' }));
              }
            });
            return;
          }

          // API REST de Telemetria (Protegida)
          if (pathname === '/api/telemetry' || pathname === '/api/admin/metrics') {
            if (!checkAdminAuth(req)) {
              securityStats.blockedRequests++;
              res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, error: 'Acesso restrito: Token de administrador necessário' }));
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(getTelemetrySnapshot()));
            return;
          }

          // API REST: Jjy / NGL Mensagens Anônimas
          if ((pathname === '/api/jjy/send' || pathname === '/api/ngl/send') && req.method === 'POST') {
            let body = '';
            let bodyLen = 0;
            req.on('data', (c) => { bodyLen += c.length; if (bodyLen > MAX_POST_BODY) { req.destroy(); return; } body += c; });
            req.on('end', () => {
              try {
                const data = JSON.parse(body);
                const target = String(data.target || '').trim().toLowerCase();
                const text = String(data.text || '').trim();
                if (!target || !text) {
                  res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
                    .end(JSON.stringify({ ok: false, error: 'target e text são obrigatórios' }));
                  return;
                }
                const nglMsg = {
                  id: data.id || ('jjy_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex')),
                  target,
                  prompt: String(data.prompt || '').trim(),
                  text: text.slice(0, 500),
                  mood: String(data.mood || '🤫 Segredo').trim(),
                  timestamp: data.timestamp || Date.now(),
                  read: false,
                  reply: '',
                };
                if (!nglStore.has(target)) nglStore.set(target, []);
                const userList = nglStore.get(target);
                userList.unshift(nglMsg);
                if (userList.length > MAX_NGL_PER_USER) userList.pop();

                telemetry.messageTypesCount.ngl = (telemetry.messageTypesCount.ngl || 0) + 1;
                logEvent('jjy_send', `Mensagem anônima Jjy para @${target} via HTTP REST`);
                events.emit('ngl:message', nglMsg);
                events.emit('jjy:message', nglMsg);

                // Notifica em tempo real clientes conectados via WebSocket
                for (const p of peers.values()) {
                  if (p.hello) {
                    p.conn.sendText({ t: 'jjy:message', msg: nglMsg });
                    p.conn.sendText({ t: 'ngl:message', msg: nglMsg });
                  }
                }

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
                  .end(JSON.stringify({ ok: true, msg: nglMsg }));
              } catch {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
                  .end(JSON.stringify({ ok: false, error: 'JSON inválido' }));
              }
            });
            return;
          }

          if ((pathname.startsWith('/api/jjy/inbox') || pathname.startsWith('/api/ngl/inbox')) && req.method === 'GET') {
            if (!checkAdminAuth(req)) {
              res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, error: 'Autenticação necessária' }));
              return;
            }
            const parsedUrl = new URL(req.url, 'http://localhost');
            const target = (parsedUrl.searchParams.get('u') || parsedUrl.searchParams.get('user') || '').trim().toLowerCase();
            const list = nglStore.get(target) || [];
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true, target, messages: list }));
            return;
          }

          if ((pathname === '/api/jjy/delete' || pathname === '/api/ngl/delete') && req.method === 'POST') {
            if (!checkAdminAuth(req)) {
              res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, error: 'Autenticação necessária' }));
              return;
            }
            let body = '';
            let bodyLen = 0;
            req.on('data', (c) => { bodyLen += c.length; if (bodyLen > MAX_POST_BODY) { req.destroy(); return; } body += c; });
            req.on('end', () => {
              try {
                const { target, id } = JSON.parse(body);
                const tKey = String(target || '').trim().toLowerCase();
                if (nglStore.has(tKey)) {
                  if (!id) {
                    nglStore.set(tKey, []);
                  } else {
                    const list = nglStore.get(tKey).filter(m => m.id !== id);
                    nglStore.set(tKey, list);
                  }
                }
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify({ ok: true }));
              } catch {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify({ ok: false }));
              }
            });
            return;
          }

          // API REST: TOTP 2FA — Setup, Ativação, Desativação (Protegida)
          if (pathname === '/api/admin/totp/setup' && req.method === 'POST') {
            if (!checkAdminAuth(req)) {
              res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, error: 'Autenticação de administrador necessária' }));
              return;
            }
            // Gera um novo segredo pendente (não ativa até confirmar com código válido)
            const newSecret = generateTotpSecret();
            totpState.pendingSecret = newSecret;
            totpState.setupPending = true;
            saveTotpState();
            const uri = buildTotpUri(newSecret);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
              ok: true,
              secret: newSecret,
              uri,
              message: 'Escaneie o QR code no app autenticador (Google Authenticator, Aegis, etc.) e confirme com um código válido via /api/admin/totp/enable',
            }));
            return;
          }

          if (pathname === '/api/admin/totp/enable' && req.method === 'POST') {
            if (!checkAdminAuth(req)) {
              res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, error: 'Autenticação de administrador necessária' }));
              return;
            }
            let body = '';
            let bodyLen = 0;
            req.on('data', (c) => { bodyLen += c.length; if (bodyLen > MAX_POST_BODY) { req.destroy(); return; } body += c; });
            req.on('end', () => {
              try {
                const data = JSON.parse(body || '{}');
                const code = String(data.code || '').replace(/\s/g, '');
                if (!totpState.pendingSecret || !totpState.setupPending) {
                  res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                  res.end(JSON.stringify({ ok: false, error: 'Execute /api/admin/totp/setup primeiro' }));
                  return;
                }
                if (!code || code.length !== 6 || !verifyTotp(totpState.pendingSecret, code)) {
                  res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
                  res.end(JSON.stringify({ ok: false, error: 'Código TOTP inválido. Verifique o horário do dispositivo.' }));
                  return;
                }
                // Código válido — ativar TOTP
                totpState.secret = totpState.pendingSecret;
                totpState.enabled = true;
                totpState.pendingSecret = null;
                totpState.setupPending = false;
                saveTotpState();
                logEvent('admin_totp', `TOTP 2FA ativado por ${clientIp}`);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: true, message: '2FA TOTP ativado com sucesso. A partir de agora, o login exigirá senha + código OTP.' }));
              } catch {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: false, error: 'JSON inválido' }));
              }
            });
            return;
          }

          if (pathname === '/api/admin/totp/disable' && req.method === 'POST') {
            if (!checkAdminAuth(req)) {
              res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, error: 'Autenticação de administrador necessária' }));
              return;
            }
            let body = '';
            let bodyLen = 0;
            req.on('data', (c) => { bodyLen += c.length; if (bodyLen > MAX_POST_BODY) { req.destroy(); return; } body += c; });
            req.on('end', () => {
              try {
                const data = JSON.parse(body || '{}');
                const password = String(data.password || '');
                // Requer senha para desativar (proteção extra)
                if (!verifyAdminPassword(password)) {
                  res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
                  res.end(JSON.stringify({ ok: false, error: 'Senha de administrador necessária para desativar 2FA' }));
                  return;
                }
                totpState.enabled = false;
                totpState.secret = null;
                totpState.pendingSecret = null;
                totpState.setupPending = false;
                saveTotpState();
                logEvent('admin_totp', `TOTP 2FA desativado por ${clientIp}`);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: true, message: '2FA TOTP desativado.' }));
              } catch {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: false, error: 'JSON inválido' }));
              }
            });
            return;
          }

          if (pathname === '/api/admin/totp/status' && req.method === 'GET') {
            const isAuth = checkAdminAuth(req);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
              ok: true,
              enabled: !!totpState.enabled,
              setupPending: isAuth ? !!totpState.setupPending : false
            }));
            return;
          }

          /* ------------------------------------------------------------------ */
          /* WebAuthn / FIDO U2F — Endpoints REST Offline                        */
          /* ------------------------------------------------------------------ */
          if (pathname === '/api/admin/webauthn/status' && req.method === 'GET') {
            const isAuth = checkAdminAuth(req);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
              ok: true,
              enabled: Boolean(webauthnState.enabled && webauthnState.credentials.length > 0),
              count: webauthnState.credentials.length,
              credentials: isAuth ? webauthnState.credentials.map(c => ({
                id: c.id,
                name: c.name,
                alg: c.alg,
                signCount: c.signCount,
                createdAt: c.createdAt,
                lastUsedAt: c.lastUsedAt,
              })) : []
            }));
            return;
          }

          if (pathname === '/api/admin/webauthn/register-options' && req.method === 'POST') {
            if (!checkAdminAuth(req)) {
              res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, error: 'Autenticação de administrador necessária' }));
              return;
            }
            const { rpId } = getEffectiveRp(req);
            const challenge = generateRandomChallenge(32);
            activeWebAuthnChallenges.set(challenge, {
              challenge,
              type: 'register',
              rpId,
              createdAt: Date.now(),
              clientIp,
            });

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
              ok: true,
              options: {
                challenge,
                rp: {
                  name: 'JJY Sovereign Network',
                  id: rpId,
                },
                user: {
                  id: 'YWRtaW4', // base64url 'admin'
                  name: 'admin',
                  displayName: 'Administrador JJY',
                },
                pubKeyCredParams: [
                  { alg: -7, type: 'public-key' },   // ES256 (P-256)
                  { alg: -257, type: 'public-key' }, // RS256 (RSA)
                  { alg: -8, type: 'public-key' },   // Ed25519
                ],
                timeout: 60000,
                attestation: 'none',
                authenticatorSelection: {
                  userVerification: 'preferred',
                  residentKey: 'preferred',
                },
                excludeCredentials: webauthnState.credentials.map(c => ({
                  id: c.id,
                  type: 'public-key',
                })),
              },
            }));
            return;
          }

          if (pathname === '/api/admin/webauthn/register-verify' && req.method === 'POST') {
            if (!checkAdminAuth(req)) {
              res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, error: 'Autenticação de administrador necessária' }));
              return;
            }
            let body = '';
            let bodyLen = 0;
            req.on('data', (c) => { bodyLen += c.length; if (bodyLen > MAX_POST_BODY) { req.destroy(); return; } body += c; });
            req.on('end', () => {
              try {
                const data = JSON.parse(body || '{}');
                const { credential, name } = data;
                if (!credential || !credential.response) {
                  res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                  res.end(JSON.stringify({ ok: false, error: 'Dados da credencial ausentes' }));
                  return;
                }

                const clientDataBuf = Buffer.from(credential.response.clientDataJSON, 'base64url');
                const clientData = JSON.parse(clientDataBuf.toString('utf8'));
                const challengeRecord = activeWebAuthnChallenges.get(clientData.challenge);

                if (!challengeRecord || challengeRecord.type !== 'register') {
                  res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                  res.end(JSON.stringify({ ok: false, error: 'Desafio WebAuthn inválido ou expirado' }));
                  return;
                }
                activeWebAuthnChallenges.delete(clientData.challenge);

                const { origin: regOrigin } = getEffectiveRp(req);
                const verified = verifyRegistrationCredential({
                  attestationObject: credential.response.attestationObject,
                  clientDataJSON: credential.response.clientDataJSON,
                  expectedChallenge: challengeRecord.challenge,
                  expectedOrigin: regOrigin,
                  expectedRpId: challengeRecord.rpId,
                });

                webauthnState.credentials = webauthnState.credentials.filter(c => c.id !== verified.credentialId);
                const newCred = {
                  id: verified.credentialId,
                  name: String(name || `Chave FIDO #${webauthnState.credentials.length + 1}`).trim(),
                  jwk: verified.jwk,
                  alg: verified.alg,
                  signCount: verified.signCount,
                  transports: credential.response.transports || ['usb', 'nfc', 'ble', 'internal'],
                  createdAt: Date.now(),
                  lastUsedAt: null,
                };
                webauthnState.credentials.push(newCred);
                webauthnState.enabled = true;
                saveWebauthnState();

                logEvent('admin_webauthn_reg', `Nova chave FIDO U2F/WebAuthn registrada por ${clientIp}: "${newCred.name}"`);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                  ok: true,
                  message: `Chave de segurança "${newCred.name}" cadastrada com sucesso!`,
                  credential: {
                    id: newCred.id,
                    name: newCred.name,
                    createdAt: newCred.createdAt,
                  },
                }));
              } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: false, error: err.message || 'Erro ao validar registro de chave FIDO' }));
              }
            });
            return;
          }

          if (pathname === '/api/admin/webauthn/login-options' && req.method === 'POST') {
            if (!webauthnState.enabled || webauthnState.credentials.length === 0) {
              res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, error: 'Nenhuma chave FIDO registrada' }));
              return;
            }
            const { rpId } = getEffectiveRp(req);
            const challenge = generateRandomChallenge(32);
            activeWebAuthnChallenges.set(challenge, {
              challenge,
              type: 'login',
              rpId,
              createdAt: Date.now(),
              clientIp,
            });

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
              ok: true,
              options: {
                challenge,
                rpId,
                timeout: 60000,
                userVerification: 'preferred',
                allowCredentials: webauthnState.credentials.map(c => ({
                  id: c.id,
                  type: 'public-key',
                  transports: c.transports || ['usb', 'nfc', 'ble', 'internal'],
                })),
              },
            }));
            return;
          }

          if (pathname === '/api/admin/webauthn/login-verify' && req.method === 'POST') {
            let body = '';
            let bodyLen = 0;
            req.on('data', (c) => { bodyLen += c.length; if (bodyLen > MAX_POST_BODY) { req.destroy(); return; } body += c; });
            req.on('end', () => {
              try {
                const data = JSON.parse(body || '{}');
                const { assertion } = data;
                if (!assertion || !assertion.response) {
                  res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                  res.end(JSON.stringify({ ok: false, error: 'Dados de autenticação FIDO ausentes' }));
                  return;
                }

                const clientDataBuf = Buffer.from(assertion.response.clientDataJSON, 'base64url');
                const clientData = JSON.parse(clientDataBuf.toString('utf8'));
                const challengeRecord = activeWebAuthnChallenges.get(clientData.challenge);

                if (!challengeRecord || challengeRecord.type !== 'login') {
                  res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                  res.end(JSON.stringify({ ok: false, error: 'Desafio WebAuthn inválido ou expirado' }));
                  return;
                }
                activeWebAuthnChallenges.delete(clientData.challenge);

                const credId = assertion.id;
                const storedCred = webauthnState.credentials.find(c => c.id === credId);
                if (!storedCred) {
                  res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
                  res.end(JSON.stringify({ ok: false, error: 'Chave de segurança não cadastrada neste servidor' }));
                  return;
                }

                const { origin: loginOrigin } = getEffectiveRp(req);
                const verification = verifyAuthenticationAssertion({
                  authenticatorData: assertion.response.authenticatorData,
                  clientDataJSON: assertion.response.clientDataJSON,
                  signature: assertion.response.signature,
                  storedCredential: storedCred,
                  expectedChallenge: challengeRecord.challenge,
                  expectedOrigin: loginOrigin,
                  expectedRpId: challengeRecord.rpId,
                });

                if (storedCred.signCount > 0 && verification.signCount <= storedCred.signCount) {
                  logEvent('security_fido_clone', `Possível clone de chave FIDO detectado para "${storedCred.name}" de ${clientIp} (signCount ${verification.signCount} <= ${storedCred.signCount})`);
                  res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
                  res.end(JSON.stringify({ ok: false, error: 'Possível clone de autenticador detectado. Contagem de assinaturas inválida.' }));
                  return;
                }
                storedCred.signCount = verification.signCount;
                storedCred.lastUsedAt = Date.now();
                saveWebauthnState();

                failedLogins.delete(clientIp);
                unbanIp(clientIp);
                const token = createAdminSession(clientIp);
                logEvent('admin_fido_login', `Login FIDO U2F/WebAuthn autorizado para ${clientIp} usando chave "${storedCred.name}"`);

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                  ok: true,
                  token,
                  expiresIn: 43200,
                  keyName: storedCred.name,
                }));
              } catch (err) {
                securityStats.failedLogins++;
                logEvent('security_fido_fail', `Falha de autenticação FIDO de ${clientIp}: ${err.message}`);
                res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: false, error: err.message || 'Falha na validação da chave FIDO' }));
              }
            });
            return;
          }

          if (pathname === '/api/admin/webauthn/remove' && req.method === 'POST') {
            if (!checkAdminAuth(req)) {
              res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, error: 'Autenticação de administrador necessária' }));
              return;
            }
            let body = '';
            let bodyLen = 0;
            req.on('data', (c) => { bodyLen += c.length; if (bodyLen > MAX_POST_BODY) { req.destroy(); return; } body += c; });
            req.on('end', () => {
              try {
                const data = JSON.parse(body || '{}');
                const { id } = data;
                if (!id) {
                  res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                  res.end(JSON.stringify({ ok: false, error: 'ID da credencial obrigatório' }));
                  return;
                }
                const beforeCount = webauthnState.credentials.length;
                webauthnState.credentials = webauthnState.credentials.filter(c => c.id !== id);
                if (webauthnState.credentials.length === 0) {
                  webauthnState.enabled = false;
                }
                saveWebauthnState();
                logEvent('admin_webauthn_del', `Chave FIDO removida por ${clientIp} (ID: ${id})`);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                  ok: true,
                  count: webauthnState.credentials.length,
                  removed: beforeCount !== webauthnState.credentials.length,
                }));
              } catch {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: false, error: 'JSON inválido' }));
              }
            });
            return;
          }

          // API REST de Ações Administrativas (Protegida)
          if (pathname === '/api/admin/action' && req.method === 'POST') {
            if (!checkAdminAuth(req)) {
              securityStats.blockedRequests++;
              res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, error: 'Autenticação de administrador necessária' }));
              return;
            }
            let body = '';
            let bodyLen = 0;
            req.on('data', (c) => { bodyLen += c.length; if (bodyLen > MAX_POST_BODY) { req.destroy(); return; } body += c; });
            req.on('end', () => {
              try {
                const actionData = JSON.parse(body);
                if (actionData.action === 'kick') {
                  const target = byClientId.get(actionData.clientId);
                  if (target) {
                    logEvent('admin_kick', `Usuário ${target.name} (${target.clientId}) desconectado via REST API`);
                    target.conn.close(4001, actionData.reason || 'Desconectado pelo administrador');
                    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true }));
                  } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, error: 'Usuário não encontrado' }));
                  }
                  return;
                }
                if (actionData.action === 'broadcast') {
                  const broadcastMsg = {
                    t: 'chat',
                    id: 'admin-' + Date.now(),
                    room: 'geral',
                    fromName: '🚨 ADMINISTRADOR',
                    fromColor: '#ef4444',
                    text: String(actionData.message || '').slice(0, 500),
                    ts: Date.now(),
                  };
                  logEvent('broadcast', `Aviso global enviado via REST: ${broadcastMsg.text}`);
                  for (const p of peers.values()) {
                    if (p.hello) p.conn.sendText(broadcastMsg);
                  }
                  res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true }));
                  return;
                }
                if (actionData.action === 'lockdown') {
                  isNetworkLockdown = Boolean(actionData.enabled);
                  logEvent('admin_lockdown', `Lockdown de rede ${isNetworkLockdown ? 'ATIVADO (DEFCON 1)' : 'DESATIVADO'} pelo administrador`);
                  broadcastSend({
                    t: 'network-lockdown',
                    enabled: isNetworkLockdown,
                    reason: actionData.reason || 'Medida de contenção de segurança em vigor.',
                    timestamp: Date.now(),
                  });
                  res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, isLockdown: isNetworkLockdown }));
                  return;
                }
                if (actionData.action === 'quarantine') {
                  if (actionData.clientId) {
                    quarantinedClients.add(actionData.clientId);
                    logEvent('admin_quarantine', `Estação ${actionData.clientId} isolada em quarentena`);
                    const target = byClientId.get(actionData.clientId);
                    if (target) {
                      target.conn.sendText({
                        t: 'remote-command',
                        action: 'quarantine',
                        reason: actionData.reason || 'Sua estação foi colocada em quarentena preventiva.',
                      });
                    }
                  }
                  res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, quarantinedClients: Array.from(quarantinedClients) }));
                  return;
                }
                if (actionData.action === 'unquarantine') {
                  if (actionData.clientId) {
                    quarantinedClients.delete(actionData.clientId);
                    logEvent('admin_unquarantine', `Estação ${actionData.clientId} liberada da quarentena`);
                    const target = byClientId.get(actionData.clientId);
                    if (target) {
                      target.conn.sendText({
                        t: 'remote-command',
                        action: 'unquarantine',
                      });
                    }
                  }
                  res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, quarantinedClients: Array.from(quarantinedClients) }));
                  return;
                }
                if (actionData.action === 'eject') {
                  const target = byClientId.get(actionData.clientId);
                  if (target) {
                    logEvent('admin_eject', `Kill-Switch de sessão acionado para ${target.name} (${target.clientId})`);
                    target.conn.sendText({
                      t: 'remote-command',
                      action: 'eject',
                      reason: actionData.reason || 'Sessão encerrada sumariamente por violação de segurança.',
                    });
                    setTimeout(() => {
                      try { target.conn.close(4003, 'Encerrado por contenção administrativa'); } catch {}
                    }, 150);
                    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true }));
                  } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, error: 'Usuário não encontrado' }));
                  }
                  return;
                }
                res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, error: 'Ação desconhecida' }));
              } catch {
                res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, error: 'JSON inválido' }));
              }
            });
            return;
          }

          // API REST: Sistema Inteligente de Gravações CFTV (DVR Local)
          if (pathname.startsWith('/api/cctv/recordings') && req.method === 'GET') {
            if (!checkAdminAuth(req)) {
              securityStats.blockedRequests++;
              res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, error: 'Autenticação de administrador necessária' }));
              return;
            }
            const parsedUrl = new URL(req.url, 'http://localhost');
            const starredOnly = parsedUrl.searchParams.get('starred') === '1' || parsedUrl.searchParams.get('starred') === 'true';
            const triggerFilter = parsedUrl.searchParams.get('trigger');
            const clientIdFilter = parsedUrl.searchParams.get('clientId');
            const query = (parsedUrl.searchParams.get('q') || '').toLowerCase().trim();

            let list = loadRecordingsIndex();

            let filtered = list;
            if (starredOnly) {
              filtered = filtered.filter(r => r.starred);
            }
            if (triggerFilter && triggerFilter !== 'all') {
              filtered = filtered.filter(r => r.trigger === triggerFilter);
            }
            if (clientIdFilter && clientIdFilter !== 'all') {
              filtered = filtered.filter(r => r.clientId === clientIdFilter);
            }
            if (query) {
              filtered = filtered.filter(r =>
                (r.clientName && r.clientName.toLowerCase().includes(query)) ||
                (r.note && r.note.toLowerCase().includes(query)) ||
                (r.filename && r.filename.toLowerCase().includes(query))
              );
            }

            const totalBytes = list.reduce((sum, r) => sum + (r.size || 0), 0);
            const starredCount = list.filter(r => r.starred).length;

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
              ok: true,
              recordings: filtered,
              stats: {
                totalCount: list.length,
                filteredCount: filtered.length,
                totalBytes,
                totalBytesFormatted: (totalBytes / (1024 * 1024)).toFixed(2) + ' MB',
                starredCount,
                maxCount: MAX_RECORDINGS_COUNT,
                maxBytes: MAX_RECORDINGS_BYTES,
                maxBytesFormatted: (MAX_RECORDINGS_BYTES / (1024 * 1024)).toFixed(0) + ' MB',
                recordingsDir,
              }
            }));
            return;
          }

          if (pathname === '/api/cctv/recordings/save' && req.method === 'POST') {
            if (!checkAdminAuth(req)) {
              securityStats.blockedRequests++;
              res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, error: 'Autenticação de administrador necessária' }));
              return;
            }
            let body = '';
            let bodyTooLarge = false;
            req.on('data', (c) => {
              if (bodyTooLarge) return;
              body += c;
              if (body.length > 20 * 1024 * 1024) {
                bodyTooLarge = true;
                res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' })
                  .end(JSON.stringify({ ok: false, error: 'Arquivo grande demais (máx 20MB)' }));
                req.destroy();
              }
            });
            req.on('end', () => {
              if (bodyTooLarge) return;
              try {
                const data = JSON.parse(body || '{}');
                if (!data.dataUrl) {
                  res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                  res.end(JSON.stringify({ ok: false, error: 'dataUrl é obrigatório' }));
                  return;
                }

                ensureRecordingsDir();
                const matches = data.dataUrl.match(/^data:([A-Za-z0-9-+\/]+);base64,(.+)$/);
                let buffer;
                let mimeType = 'image/jpeg';
                let ext = 'jpg';

                if (matches) {
                  mimeType = matches[1];
                  buffer = Buffer.from(matches[2], 'base64');
                  if (mimeType.includes('png')) ext = 'png';
                  else if (mimeType.includes('webp')) ext = 'webp';
                  else if (mimeType.includes('webm')) ext = 'webm';
                  else if (mimeType.includes('mp4')) ext = 'mp4';
                  else ext = 'jpg';
                } else {
                  buffer = Buffer.from(data.dataUrl, 'base64');
                }

                const now = Date.now();
                const safeName = String(data.clientName || 'camera').toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
                const filename = `cctv_${safeName}_${now}_${crypto.randomBytes(3).toString('hex')}.${ext}`;
                const filePathOnDisk = path.join(recordingsDir, filename);

                fs.writeFileSync(filePathOnDisk, buffer);

                const trigger = data.trigger || 'manual';
                const triggerMap = {
                  manual: 'Captura Manual',
                  motion: 'Movimento Detectado',
                  alarm: 'Alarme / SOS',
                  scheduled: 'Gravação Agendada',
                };

                const newRec = {
                  id: 'rec_' + now + '_' + crypto.randomBytes(4).toString('hex'),
                  filename,
                  url: '/recordings/' + filename,
                  clientId: String(data.clientId || 'unknown').slice(0, 64),
                  clientName: String(data.clientName || 'Câmera').slice(0, 64),
                  deviceInfo: String(data.deviceInfo || '').slice(0, 128),
                  type: mimeType,
                  size: buffer.length,
                  timestamp: now,
                  formattedDate: new Date(now).toLocaleString('pt-BR'),
                  trigger,
                  triggerLabel: triggerMap[trigger] || 'Captura',
                  starred: Boolean(data.starred),
                  note: String(data.note || '').slice(0, 200),
                };

                const list = loadRecordingsIndex();
                list.unshift(newRec);
                enforceRecordingsQuota(list);
                saveRecordingsIndex(list);

                logEvent('cctv_saved', `Gravação CFTV salva: ${filename} (${(newRec.size / 1024).toFixed(1)} KB) [${newRec.triggerLabel}]`);

                // Notifica clientes admin conectados via WebSocket
                for (const p of peers.values()) {
                  if (p.hello && p.isAdmin) {
                    p.conn.sendText({ t: 'cctv:recording-saved', recording: newRec });
                  }
                }

                const totalBytes = list.reduce((sum, r) => sum + (r.size || 0), 0);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                  ok: true,
                  recording: newRec,
                  stats: {
                    totalCount: list.length,
                    totalBytes,
                    starredCount: list.filter(r => r.starred).length,
                  }
                }));
              } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: false, error: err.message }));
              }
            });
            return;
          }

          if (pathname === '/api/cctv/recordings/toggle-star' && req.method === 'POST') {
            if (!checkAdminAuth(req)) {
              securityStats.blockedRequests++;
              res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, error: 'Autenticação de administrador necessária' }));
              return;
            }
            let body = '';
            let bodyLen = 0;
            req.on('data', (c) => { bodyLen += c.length; if (bodyLen > MAX_POST_BODY) { req.destroy(); return; } body += c; });
            req.on('end', () => {
              try {
                const data = JSON.parse(body || '{}');
                const id = String(data.id || '');
                const list = loadRecordingsIndex();
                const rec = list.find(r => r.id === id);
                if (!rec) {
                  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                  res.end(JSON.stringify({ ok: false, error: 'Gravação não encontrada' }));
                  return;
                }
                rec.starred = !rec.starred;
                saveRecordingsIndex(list);
                logEvent('cctv_star', `Gravação ${rec.filename} ${rec.starred ? 'favoritada (protegida)' : 'desfavoritada'}`);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: true, id: rec.id, starred: rec.starred }));
              } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: false, error: err.message }));
              }
            });
            return;
          }

          if (pathname === '/api/cctv/recordings/delete' && req.method === 'POST') {
            if (!checkAdminAuth(req)) {
              securityStats.blockedRequests++;
              res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, error: 'Autenticação de administrador necessária' }));
              return;
            }
            let body = '';
            let bodyLen = 0;
            req.on('data', (c) => { bodyLen += c.length; if (bodyLen > MAX_POST_BODY) { req.destroy(); return; } body += c; });
            req.on('end', () => {
              try {
                const data = JSON.parse(body || '{}');
                let list = loadRecordingsIndex();
                let deletedCount = 0;

                if (data.purgeUnstarred) {
                  const toKeep = [];
                  for (const r of list) {
                    if (r.starred) {
                      toKeep.push(r);
                    } else {
                      try {
                        const diskFile = path.join(recordingsDir, path.basename(r.filename));
                        if (fs.existsSync(diskFile)) fs.unlinkSync(diskFile);
                        deletedCount++;
                      } catch {}
                    }
                  }
                  list = toKeep;
                } else if (data.all) {
                  for (const r of list) {
                    try {
                      const diskFile = path.join(recordingsDir, path.basename(r.filename));
                      if (fs.existsSync(diskFile)) fs.unlinkSync(diskFile);
                      deletedCount++;
                    } catch {}
                  }
                  list = [];
                } else if (Array.isArray(data.ids) && data.ids.length > 0) {
                  const idSet = new Set(data.ids);
                  list = list.filter(r => {
                    if (idSet.has(r.id)) {
                      try {
                        const diskFile = path.join(recordingsDir, path.basename(r.filename));
                        if (fs.existsSync(diskFile)) fs.unlinkSync(diskFile);
                        deletedCount++;
                      } catch {}
                      return false;
                    }
                    return true;
                  });
                } else if (data.id) {
                  const targetId = String(data.id);
                  const target = list.find(r => r.id === targetId);
                  if (target) {
                    try {
                      const diskFile = path.join(recordingsDir, path.basename(target.filename));
                      if (fs.existsSync(diskFile)) fs.unlinkSync(diskFile);
                    } catch {}
                    list = list.filter(r => r.id !== targetId);
                    deletedCount = 1;
                  }
                }

                saveRecordingsIndex(list);
                logEvent('cctv_delete', `${deletedCount} gravação(ões) excluída(s)`);

                const totalBytes = list.reduce((sum, r) => sum + (r.size || 0), 0);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                  ok: true,
                  deletedCount,
                  stats: {
                    totalCount: list.length,
                    totalBytes,
                    starredCount: list.filter(r => r.starred).length,
                  }
                }));
              } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: false, error: err.message }));
              }
            });
            return;
          }

          if (pathname === '/api/cctv/open-folder' && req.method === 'POST') {
            if (!checkAdminAuth(req)) {
              securityStats.blockedRequests++;
              res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, error: 'Autenticação de administrador necessária' }));
              return;
            }
            ensureRecordingsDir();
            try {
              if (os.platform() === 'win32') {
                const child = spawn('explorer.exe', [recordingsDir], { detached: true, stdio: 'ignore' });
                child.unref();
              } else if (os.platform() === 'darwin') {
                const child = spawn('open', [recordingsDir], { detached: true, stdio: 'ignore' });
                child.unref();
              } else {
                const child = spawn('xdg-open', [recordingsDir], { detached: true, stdio: 'ignore' });
                child.unref();
              }
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: true, path: recordingsDir }));
            } catch (err) {
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, path: recordingsDir, error: err.message }));
            }
            return;
          }

          const isRootRequest = (pathname === '/' || pathname === '/index.html');
          if (isRootRequest && (!webRoot || !fs.existsSync(path.join(webRoot, 'index.html')))) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(welcomePage(actualPort));
            return;
          }

          const publicDir = path.resolve(path.join(__dirname, '..', 'public'));
          const effectiveRoot = (webRoot && fs.existsSync(webRoot)) ? webRoot : (fs.existsSync(publicDir) ? publicDir : null);

          if (effectiveRoot) {
            serveStatic(req, res, effectiveRoot);
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(welcomePage(actualPort));
          }
        };

        const upgradeHandler = (req, socket, head) => {
          const clientIp = getClientIp(req);
          const isLocal = isLoopbackOrLocal(clientIp);
          const isAdmin = checkAdminAuth(req);

          if (!isLocal && !isAdmin && isIpBanned(clientIp, req)) {
            securityStats.blockedRequests++;
            socket.write('HTTP/1.1 403 Forbidden\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nIP Bloqueado');
            socket.destroy();
            return;
          }

          // Capping de conexões simultâneas por IP (máx 15 por IP para estações remotas)
          if (!isLocal && !isAdmin) {
            let sameIpCount = 0;
            for (const p of peers.values()) {
              if (normalizeIp(p.remoteAddress) === clientIp) sameIpCount++;
            }
            if (sameIpCount >= 15) {
              securityStats.blockedRequests++;
              socket.write('HTTP/1.1 429 Too Many Requests\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nLimite de conexoes por IP atingido');
              socket.destroy();
              return;
            }
          }

          const key = req.headers['sec-websocket-key'];
          const version = req.headers['sec-websocket-version'];
          if (!key || version !== '13') {
            socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
            return;
          }
          const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
          socket.write(
            'HTTP/1.1 101 Switching Protocols\r\n' +
            'Upgrade: websocket\r\n' +
            'Connection: Upgrade\r\n' +
            `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
          );
          socket.setNoDelay(true);
          const conn = new WsConnection(socket);
          if (head && head.length) conn.buffer = Buffer.from(head);
          onConnection(conn, req);
        };

        httpServer = http.createServer(requestHandler);
        httpServer.on('upgrade', upgradeHandler);

        httpServer.on('error', (err) => {
          if (!running) {
            httpServer = null;
            reject(err);
          } else {
            events.emit('error', err);
          }
        });

        // Configuração HTTPS Offline Simultânea (com certificado autoassinado)
        const sslCreds = getSslCredentials(options.certPath, options.certPassphrase);
        if (sslCreds) {
          try {
            httpsServer = https.createServer(sslCreds, requestHandler);
            httpsServer.on('upgrade', upgradeHandler);
            httpsServer.on('error', (err) => {
              events.emit('log', `Aviso HTTPS: ${err.message}`);
            });
          } catch (sslErr) {
            events.emit('log', `Não foi possível iniciar HTTPS: ${sslErr.message}`);
            httpsServer = null;
          }
        }

        httpServer.listen(tryPort, '0.0.0.0', () => {
          actualPort = httpServer.address().port;
          running = true;
          startedAt = Date.now();

          if (httpsServer) {
            httpsServer.listen(actualHttpsPort, '0.0.0.0', () => {
              actualHttpsPort = httpsServer.address().port;
              events.emit('log', `Servidor HTTPS seguro ativo na porta ${actualHttpsPort}`);
            });
          }

          livenessTimer = setInterval(() => {
            const now = Date.now();
            for (const p of peers.values()) {
              if (!p.conn.alive) {
                p.conn.close(1001, 'Tempo esgotado');
                continue;
              }
              p.conn.alive = false;
              p.pingSentAt = now;
              p.conn.sendPing();
            }
          }, LIVENESS_INTERVAL);
          livenessTimer.unref?.();

          presenceTimer = setInterval(() => {
            const list = [...peers.values()].filter((p) => p.hello).map((p) => peerInfo(p, false)).filter(Boolean);
            const adminList = [...peers.values()].filter((p) => p.hello).map((p) => peerInfo(p, true)).filter(Boolean);
            for (const p of peers.values()) {
              if (p.hello) {
                p.conn.sendText({ t: 'presence', peers: p.isAdmin ? adminList : list });
              }
            }
          }, LIVENESS_INTERVAL);
          presenceTimer.unref?.();

          cleanupTimer = setInterval(() => {
            const now = Date.now();
            for (const [token, session] of adminSessions.entries()) {
              if (now > session.expiresAt) adminSessions.delete(token);
            }
            for (const [ip, b] of bannedIps.entries()) {
              if (b.expiresAt && now > b.expiresAt) bannedIps.delete(ip);
            }
            for (const [ip, r] of rateLimits.entries()) {
              if (now - r.windowStart > 120000) rateLimits.delete(ip);
            }
            for (const [ip, f] of failedLogins.entries()) {
              if (now - f.lastAttempt > 3600000) failedLogins.delete(ip);
            }
            // Limpar alertas de emergência expirados
            for (const [target, alert] of pendingEmergencyAlerts.entries()) {
              if (now > alert.expiresAt) pendingEmergencyAlerts.delete(target);
            }
            // Limpar desafios WebAuthn expirados (> 2 minutos)
            for (const [ch, data] of activeWebAuthnChallenges.entries()) {
              if (now - data.createdAt > 120000) activeWebAuthnChallenges.delete(ch);
            }
          }, 60000);
          cleanupTimer.unref?.();

          if (enableDiscovery) {
            try {
              beacon = startBeacon({
                port: DISCOVERY_PORT,
                info: { app: 'jjy', v: VERSION, name: serverName, port: actualPort, ips: getLocalIPs() },
                interval: 2500,
              });
            } catch (err) {
              events.emit('log', `Descoberta UDP indisponível: ${err.message}`);
              beacon = null;
            }
          }

          events.emit('started', { port: actualPort, httpsPort: httpsServer ? actualHttpsPort : null });
          resolve(actualPort);
        });
      });
    },

    stop() {
      return new Promise((resolve) => {
        running = false;
        clearInterval(livenessTimer);
        clearInterval(presenceTimer);
        if (cleanupTimer) { clearInterval(cleanupTimer); cleanupTimer = null; }
        if (beacon) { try { beacon.close(); } catch { /* ignore */ } beacon = null; }
        for (const p of [...peers.values()]) {
          try { p.conn.close(1001, 'Servidor encerrado'); } catch { /* ignore */ }
        }
        peers.clear();
        byClientId.clear();
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        if (httpsServer) {
          try { httpsServer.close(); } catch { /* ignore */ }
          httpsServer = null;
        }
        if (httpServer) {
          httpServer.close(finish);
          const t = setTimeout(finish, 800);
          t.unref?.();
          httpServer = null;
        } else finish();
      });
    },

    getInfo() {
      return {
        running,
        port: actualPort,
        httpsPort: httpsServer ? actualHttpsPort : null,
        httpsAvailable: Boolean(httpsServer),
        name: serverName,
        version: VERSION,
        ips: getLocalIPs(),
        peerCount: [...peers.values()].filter((p) => p.hello).length,
        webRoot,
        startedAt,
      };
    },

    getPeers() {
      return [...peers.values()].filter((p) => p.hello).map(peerInfo);
    },

    getTelemetry() {
      return getTelemetrySnapshot();
    },

    getAdminPassword() {
      return adminPassword;
    },

    getSecurityStats() {
      return { ...securityStats, activeBans: bannedIps.size };
    },

    getBannedIps() {
      return Array.from(bannedIps.values());
    },

    banIp(ip, reason, durationMinutes, auto) {
      return banIp(ip, reason, durationMinutes, auto);
    },

    unbanIp(ip) {
      return unbanIp(ip);
    },

    validateAdminToken(token) {
      return validateAdminToken(token);
    },

    getWebAuthnStatus() {
      return {
        enabled: Boolean(webauthnState.enabled && webauthnState.credentials.length > 0),
        count: webauthnState.credentials.length,
      };
    },

    getWebAuthnCredentials() {
      return webauthnState.credentials;
    },

    events,
  };

  return server;
}
