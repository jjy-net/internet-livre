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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const VERSION = '2.0.0';
export const DEFAULT_PORT = 4870;
export const DEFAULT_HTTPS_PORT = 4873;
export const DISCOVERY_PORT = 48777;
export const DEFAULT_ADMIN_PASSWORD = 'DL-Admin#9xK7$SecShield!2026';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_TEXT_MESSAGE = 32 * 1024 * 1024;        // 32 MB (fotos base64, telas e JSON)
const MAX_BINARY_MESSAGE = 64 * 1024 * 1024;      // 64 MB (chunks de arquivo)
const MAX_PEERS = 64;
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
    const safeTitle = String(title || 'ALERTA DO ADMINISTRADOR').replace(/["`$\\]/g, ' ').slice(0, 100);
    const safeMsg = String(message || 'Mensagem urgente da Central de Administração').replace(/["`$\\]/g, ' ').slice(0, 300);
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

export function getSslCredentials(certPath, passphrase = 'jyy_secure_ssl') {
  try {
    const targetPath = certPath || path.join(__dirname, 'cert.pfx');
    if (!fs.existsSync(targetPath)) {
      if (process.platform === 'win32') {
        const localIps = getLocalIPs();
        const safePass = String(passphrase || 'jyy2026').replace(/["`$\\]/g, '');
        const dnsNames = ['localhost', '127.0.0.1', ...localIps].map(n => `"${n.replace(/[^0-9a-zA-Z.:-]/g, '')}"`).join(',');
        const psScript = `$cert = New-SelfSignedCertificate -DnsName ${dnsNames} -CertStoreLocation "cert:\\CurrentUser\\My" -NotAfter (Get-Date).AddYears(10) -KeyLength 2048 -FriendlyName "Jyy-LAN-SSL"; $pwd = ConvertTo-SecureString -String "${safePass}" -Force -AsPlainText; Export-PfxCertificate -Cert $cert -FilePath "${targetPath.replace(/\\/g, '\\\\')}" -Password $pwd | Out-Null;`;
        execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript}"`, { stdio: 'ignore' });
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
    enableUserLimit: false,     // Acionar restrição por número de usuários
    maxUsersLimit: 30,          // Limite máximo de usuários conectados
    autoIpBanEnabled: false,    // Desativado por padrão: Administrador não deve ter restrição de IP
    rateLimitEnabled: true,
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
    return normalizeIp(req.headers['x-forwarded-for'] || req.socket?.remoteAddress);
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
      const hashCandidate = crypto.createHash('sha256').update(candidate).digest();
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
    // Permite uso da senha de administrador com verificação timing-safe
    if (verifyAdminPassword(token)) return true;
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
    } else {
      try {
        const u = new URL(req.url, 'http://localhost');
        token = u.searchParams.get('token') || '';
      } catch {}
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

  function peerInfo(p) {
    return {
      peerId: p.peerId,
      clientId: p.clientId,
      name: p.name,
      color: p.color,
      latency: p.latency ?? null,
      since: p.since,
      messagesSent: p.messagesSent || 0,
      bytesSent: p.bytesSent || 0,
      remoteAddress: p.remoteAddress || '127.0.0.1',
      userAgent: p.userAgent || 'Desconhecido',
      lastActiveAt: p.lastActiveAt || p.since,
      location: p.location || null,
    };
  }

  function broadcastSend(obj, exceptPeerId) {
    for (const p of peers.values()) {
      if (p.peerId !== exceptPeerId && p.hello) p.conn.sendText(obj);
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

    // Mensagens Anônimas Jyy / NGL via WebSocket
    if (msg.t === 'jyy:send' || msg.t === 'ngl:send') {
      const target = String(msg.target || '').trim().toLowerCase();
      const text = String(msg.text || '').trim();
      if (!target || !text) {
        peer.conn.sendText({ t: msg.t === 'jyy:send' ? 'jyy:ack' : 'ngl:ack', ok: false, error: 'target e text são obrigatórios' });
        return;
      }
      const nglMsg = {
        id: msg.id || ('jyy_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex')),
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
      logEvent('jyy_send', `Mensagem anônima Jyy para @${target} via WebSocket`);
      events.emit('ngl:message', nglMsg);
      events.emit('jyy:message', nglMsg);

      for (const p of peers.values()) {
        if (p.hello) {
          p.conn.sendText({ t: 'jyy:message', msg: nglMsg });
          p.conn.sendText({ t: 'ngl:message', msg: nglMsg });
        }
      }
      peer.conn.sendText({ t: msg.t === 'jyy:send' ? 'jyy:ack' : 'ngl:ack', ok: true, id: nglMsg.id, msg: nglMsg });
      return;
    }

    if (msg.t === 'jyy:get_inbox' || msg.t === 'ngl:get_inbox') {
      const target = String(msg.target || peer.name || '').trim().toLowerCase();
      const list = nglStore.get(target) || [];
      peer.conn.sendText({ t: msg.t === 'jyy:get_inbox' ? 'jyy:inbox' : 'ngl:inbox', target, messages: list });
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
      // Limite dinâmico por número de usuários configurável na área administrativa
      const isPeerAdmin = Boolean(
        peer.isAdmin ||
        (msg.adminToken && validateAdminToken(msg.adminToken))
      );
      if (isPeerAdmin) {
        peer.isAdmin = true;
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
      logEvent('join', `${peer.name} (${peer.clientId}) conectado via ${peer.remoteAddress}`);

      peer.conn.sendText({
        t: 'welcome',
        you: peerInfo(peer),
        peers: [...peers.values()].filter((p) => p.hello && p !== peer && !p.isAlertListener).map(peerInfo),
        server: {
          name: serverName,
          version: VERSION,
          port: actualPort,
          ips: getLocalIPs(),
          startedAt,
        },
      });
      if (!peer.isAlertListener) {
        broadcastSend({ t: 'peer:join', peer: peerInfo(peer) }, peer.peerId);
        events.emit('peer:join', peerInfo(peer));
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

    if (msg.t === 'name') {
      peer.name = String(msg.name || peer.name).slice(0, 40).trim() || peer.name;
      if (/^#[0-9a-fA-F]{6}$/.test(msg.color || '')) peer.color = msg.color;
      broadcastSend({ t: 'peer:update', peer: peerInfo(peer) });
      peer.conn.sendText({ t: 'you:update', peer: peerInfo(peer) });
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
          broadcastSend({ t: 'peer:leave', peerId: peer.peerId, clientId: peer.clientId });
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
          // CORS headers para chamadas do frontend
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

          if (req.method === 'OPTIONS') {
            res.writeHead(204).end();
            return;
          }

          const clientIp = getClientIp(req);
          const isLocal = isLoopbackOrLocal(clientIp);
          const isAdmin = checkAdminAuth(req);

          // Rota direta de emergência para auto-desbloqueio (Apenas Localhost ou Admin)
          if (req.url === '/api/unban-self' || req.url === '/api/unban-local') {
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
          const maxReqs = (req.url === '/api/admin/login') ? 15 : 180;
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
          const isCctvUpload = req.url.startsWith('/api/cctv');
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
          if (req.url === '/ngl' || req.url === '/ngl/' || req.url === '/jyy' || req.url === '/jyy/') {
            res.writeHead(302, { Location: '/Jyy.html' }).end();
            return;
          }
          if (req.url === '/chat' || req.url === '/chat/') {
            res.writeHead(302, { Location: '/DataLink-Chat.html' }).end();
            return;
          }

          // API REST de Informações de Rede e Servidor (Pública)
          if (req.url === '/api/info' || req.url === '/api/network') {
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
          if (req.url === '/api/admin/login' && req.method === 'POST') {
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
                if (verifyAdminPassword(password)) {
                  failedLogins.delete(clientIp);
                  const token = createAdminSession(clientIp);
                  logEvent('admin_login', `Login de administrador concedido para ${clientIp}`);
                  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                  res.end(JSON.stringify({ ok: true, token, expiresIn: 43200 }));
                  return;
                }

                // Senha incorreta: Registro e Fail2Ban
                securityStats.failedLogins++;
                const failRecord = failedLogins.get(clientIp) || { count: 0, lastAttempt: Date.now() };
                failRecord.count++;
                failRecord.lastAttempt = Date.now();
                failedLogins.set(clientIp, failRecord);
                logEvent('security_auth_fail', `Falha de autenticação admin de ${clientIp} (${failRecord.count}/5)`);

                if (failRecord.count >= 5) {
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
                  attemptsRemaining: Math.max(0, 5 - failRecord.count),
                }));
              } catch {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
                  .end(JSON.stringify({ ok: false, error: 'JSON inválido' }));
              }
            });
            return;
          }

          // API REST: Logout de Administrador
          if (req.url === '/api/admin/logout' && req.method === 'POST') {
            const auth = req.headers['authorization'] || '';
            const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
            if (token) adminSessions.delete(token);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          // API REST: Checar Status de Autenticação do Administrador
          if (req.url === '/api/admin/status' && req.method === 'GET') {
            const isAuthed = checkAdminAuth(req);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true, authenticated: isAuthed }));
            return;
          }

          // API REST: Métricas de Segurança Blue Team
          if (req.url === '/api/admin/security' && req.method === 'GET') {
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
          if (req.url === '/api/admin/ban' && req.method === 'POST') {
            if (!checkAdminAuth(req)) {
              securityStats.blockedRequests++;
              res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, error: 'Autenticação de administrador necessária' }));
              return;
            }
            let body = '';
            req.on('data', (c) => { body += c; });
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
          if (req.url === '/api/admin/unban' && req.method === 'POST') {
            if (!checkAdminAuth(req)) {
              securityStats.blockedRequests++;
              res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, error: 'Autenticação de administrador necessária' }));
              return;
            }
            let body = '';
            req.on('data', (c) => { body += c; });
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
          if (req.url === '/api/admin/unban-all' && req.method === 'POST') {
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
          if (req.url === '/api/admin/config' && req.method === 'GET') {
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
          if (req.url === '/api/admin/config' && req.method === 'POST') {
            if (!checkAdminAuth(req)) {
              res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' })
                .end(JSON.stringify({ ok: false, error: 'Autenticação de administrador necessária' }));
              return;
            }
            let body = '';
            req.on('data', (c) => { body += c; });
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
          if (req.url === '/api/telemetry' || req.url === '/api/admin/metrics') {
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

          // API REST: Jyy / NGL Mensagens Anônimas
          if ((req.url === '/api/jyy/send' || req.url === '/api/ngl/send') && req.method === 'POST') {
            let body = '';
            req.on('data', (c) => { body += c; });
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
                  id: data.id || ('jyy_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex')),
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
                logEvent('jyy_send', `Mensagem anônima Jyy para @${target} via HTTP REST`);
                events.emit('ngl:message', nglMsg);
                events.emit('jyy:message', nglMsg);

                // Notifica em tempo real clientes conectados via WebSocket
                for (const p of peers.values()) {
                  if (p.hello) {
                    p.conn.sendText({ t: 'jyy:message', msg: nglMsg });
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

          if ((req.url.startsWith('/api/jyy/inbox') || req.url.startsWith('/api/ngl/inbox')) && req.method === 'GET') {
            const parsedUrl = new URL(req.url, 'http://localhost');
            const target = (parsedUrl.searchParams.get('u') || parsedUrl.searchParams.get('user') || '').trim().toLowerCase();
            const list = nglStore.get(target) || [];
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true, target, messages: list }));
            return;
          }

          if ((req.url === '/api/jyy/delete' || req.url === '/api/ngl/delete') && req.method === 'POST') {
            let body = '';
            req.on('data', (c) => { body += c; });
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

          // API REST de Ações Administrativas (Protegida)
          if (req.url === '/api/admin/action' && req.method === 'POST') {
            if (!checkAdminAuth(req)) {
              securityStats.blockedRequests++;
              res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, error: 'Autenticação de administrador necessária' }));
              return;
            }
            let body = '';
            req.on('data', (c) => { body += c; });
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
          if (req.url.startsWith('/api/cctv/recordings') && req.method === 'GET') {
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

          if (req.url === '/api/cctv/recordings/save' && req.method === 'POST') {
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

          if (req.url === '/api/cctv/recordings/toggle-star' && req.method === 'POST') {
            if (!checkAdminAuth(req)) {
              securityStats.blockedRequests++;
              res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, error: 'Autenticação de administrador necessária' }));
              return;
            }
            let body = '';
            req.on('data', (c) => { body += c; });
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

          if (req.url === '/api/cctv/recordings/delete' && req.method === 'POST') {
            if (!checkAdminAuth(req)) {
              securityStats.blockedRequests++;
              res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, error: 'Autenticação de administrador necessária' }));
              return;
            }
            let body = '';
            req.on('data', (c) => { body += c; });
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

          if (req.url === '/api/cctv/open-folder' && req.method === 'POST') {
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

          const isRootRequest = (req.url === '/' || req.url === '/index.html');
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
            const list = [...peers.values()].filter((p) => p.hello).map(peerInfo);
            broadcastSend({ t: 'presence', peers: list });
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
          }, 60000);
          cleanupTimer.unref?.();

          if (enableDiscovery) {
            try {
              beacon = startBeacon({
                port: DISCOVERY_PORT,
                info: { app: 'jyy', v: VERSION, name: serverName, port: actualPort, ips: getLocalIPs() },
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

    events,
  };

  return server;
}
