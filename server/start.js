#!/usr/bin/env node
/**
 * DataLink Pro — Servidor standalone.
 *
 * Uso:
 *   node server/start.js [--porta=4870] [--sem-web] [--sem-descoberta] [--nome=MeuPC]
 *
 * Sobe o servidor WebSocket + HTTP na porta padrão (4870):
 *   - Outros computadores/celulares na rede abrem  http://SEU-IP:4870
 *     no navegador e entram no chat na hora.
 *   - Apps DataLink (Electron ou navegador) conectam em  ws://SEU-IP:4870
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createDataLinkServer, getLocalIPs, DEFAULT_PORT } from './ws-server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const opts = { port: DEFAULT_PORT, httpsPort: undefined, serve: true, discovery: true, name: undefined };
  for (const arg of argv) {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    const value = rest.join('=');
    switch (key) {
      case 'porta':
      case 'port':
      case 'p':
        opts.port = parseInt(value, 10) || DEFAULT_PORT;
        break;
      case 'https-porta':
      case 'https-port':
        opts.httpsPort = parseInt(value, 10);
        break;
      case 'sem-web':
      case 'no-serve':
        opts.serve = false;
        break;
      case 'sem-descoberta':
      case 'no-discovery':
        opts.discovery = false;
        break;
      case 'nome':
      case 'name':
        opts.name = value || undefined;
        break;
    }
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
const distDir = path.join(__dirname, '..', 'dist');
const publicDir = path.join(__dirname, '..', 'public');
const webRoot = opts.serve
  ? (fs.existsSync(path.join(distDir, 'index.html')) ? distDir : (fs.existsSync(publicDir) ? publicDir : null))
  : null;

const server = createDataLinkServer({
  port: opts.port,
  httpsPort: opts.httpsPort,
  webRoot,
  discovery: opts.discovery,
  name: opts.name,
});

server.events.on('peer:join', (p) => console.log(`  → ${p.name} entrou (${server.getPeers().length} online)`));
server.events.on('peer:leave', (p) => console.log(`  ← ${p.name || '?'} saiu (${server.getPeers().length} online)`));
server.events.on('log', (m) => console.log(`  [i] ${m}`));

try {
  const port = await server.start();
  const info = server.getInfo();
  const httpsPort = info.httpsPort;
  const ips = getLocalIPs();
  const line = '─'.repeat(58);
  console.log(`\n  🔗 Jjy — Servidor v${info.version} (Dual HTTP + HTTPS Offline)`);
  console.log(`  ${line}`);
  if (webRoot) {
    console.log('  🌐 Acesso HTTP Padrão (Computadores e Painel Local):');
    console.log(`     http://localhost:${port}`);
    for (const ip of ips) console.log(`     http://${ip}:${port}`);
    console.log('');
    if (httpsPort) {
      console.log('  🔒 Acesso HTTPS OFFLINE (OBRIGATÓRIO para CÂMERA e MICROFONE no Celular):');
      console.log(`     https://localhost:${httpsPort}`);
      for (const ip of ips) console.log(`     https://${ip}:${httpsPort}`);
      console.log('     ℹ️  No celular: abra o link acima e clique em "Avançado -> Continuar"');
      console.log('');
    }
    console.log('  🔥 Jjy Mensagens Anônimas:');
    console.log(`     http://localhost:${port}/Jjy.html`);
    for (const ip of ips) console.log(`     http://${ip}:${port}/Jjy.html`);
  } else {
    console.log('  ⚠️  Pasta web estática não encontrada — servindo apenas WebSocket.');
  }
  console.log('');
  console.log('  📡 WebSocket para apps Jjy:');
  console.log(`     ws://localhost:${port}`);
  for (const ip of ips) console.log(`     ws://${ip}:${port}`);
  if (httpsPort) {
    console.log(`     wss://localhost:${httpsPort}`);
    for (const ip of ips) console.log(`     wss://${ip}:${httpsPort}`);
  }
  console.log('');
  console.log('  🛡️  Segurança & Blue Team Defensivo:');
  console.log(`     Senha de Administrador: ${server.getAdminPassword()}`);
  console.log('     Proteções Ativas: Rate Limiting, Fail2Ban, Anti-DDoS, Tarpit, Blacklist, HTTPS LAN');
  console.log(`  ${line}`);
  console.log('  Pressione Ctrl+C para encerrar.\n');
} catch (err) {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ❌ A porta ${opts.port} já está em uso.`);
    console.error('     Use outra porta:  node server/start.js --porta=4871\n');
  } else {
    console.error('\n  ❌ Erro ao iniciar servidor:', err.message, '\n');
  }
  process.exit(1);
}

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\n  Encerrando servidor...');
  await server.stop();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
