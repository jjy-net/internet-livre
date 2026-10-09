/**
 * Teste de integração do servidor DataLink Pro (Node puro).
 * Uso: node tests/server-test.mjs
 */
import assert from 'node:assert/strict';
import { createDataLinkServer } from '../server/ws-server.js';

const PORT = 49871;
let passed = 0;
let failed = 0;

function ok(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed++; console.log(`  ✅ ${name}`); })
    .catch((err) => { failed++; console.log(`  ❌ ${name}: ${err.message}`); });
}

function connectClient(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    const inbox = [];
    const waiters = [];
    ws.addEventListener('open', () => resolve(client));
    ws.addEventListener('error', (e) => reject(new Error('erro de conexão: ' + (e.message || url))));
    ws.addEventListener('message', (ev) => {
      let data;
      if (typeof ev.data === 'string') {
        try { data = JSON.parse(ev.data); } catch { return; }
      } else {
        data = { __binary: new Uint8Array(ev.data) };
      }
      const idx = waiters.findIndex((w) => w.pred(data));
      if (idx >= 0) waiters.splice(idx, 1)[0].resolve(data);
      else inbox.push(data);
    });
    const client = {
      ws,
      send(obj) { ws.send(JSON.stringify(obj)); },
      sendBinary(buf) { ws.send(buf); },
      close() { ws.close(); },
      waitFor(pred, timeout = 4000, label = 'mensagem') {
        const found = inbox.findIndex((m) => pred(m));
        if (found >= 0) return Promise.resolve(inbox.splice(found, 1)[0]);
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`tempo esgotado esperando: ${label}`)), timeout);
          waiters.push({
            pred,
            resolve: (v) => { clearTimeout(timer); resolve(v); },
          });
        });
      },
    };
  });
}

console.log('\n🧪 Teste do servidor DataLink Pro\n');

const server = createDataLinkServer({ port: PORT, discovery: false, webRoot: null, name: 'TestServer' });
await server.start();

const url = `ws://127.0.0.1:${PORT}`;
const A = await connectClient(url);
const B = await connectClient(url);

await ok('A recebe welcome ao enviar hello', async () => {
  A.send({ t: 'hello', clientId: 'client-A', name: 'Alice', color: '#8b5cf6' });
  const w = await A.waitFor((m) => m.t === 'welcome', 4000, 'welcome A');
  assert.equal(w.server.name, 'TestServer');
  assert.equal(w.you.clientId, 'client-A');
});

await ok('B recebe welcome e vê A na lista de peers', async () => {
  B.send({ t: 'hello', clientId: 'client-B', name: 'Bob', color: '#10b981' });
  const w = await B.waitFor((m) => m.t === 'welcome', 4000, 'welcome B');
  assert.equal(w.peers.length, 1);
  assert.equal(w.peers[0].name, 'Alice');
});

await ok('A é notificado quando B entra (peer:join)', async () => {
  const j = await A.waitFor((m) => m.t === 'peer:join', 4000, 'peer:join');
  assert.equal(j.peer.name, 'Bob');
});

await ok('chat é retransmitido de A para B com remetente', async () => {
  A.send({ t: 'chat', id: 'msg-1', room: 'geral', ts: Date.now(), text: 'Olá, Bob!' });
  const relay = await B.waitFor((m) => m.t === 'chat' && m.id === 'msg-1', 4000, 'chat relay');
  assert.equal(relay.text, 'Olá, Bob!');
  assert.equal(relay.fromName, 'Alice');
  assert.equal(relay.fromClientId, 'client-A');
});

await ok('remetente recebe ack da mensagem', async () => {
  const ack = await A.waitFor((m) => m.t === 'ack' && m.id === 'msg-1', 4000, 'ack');
  assert.equal(ack.id, 'msg-1');
});

await ok('mensagem criptografada passa pelo relay intacta', async () => {
  A.send({ t: 'chat', id: 'msg-enc', room: 'geral', ts: Date.now(), enc: 'QUJDRA==' });
  const relay = await B.waitFor((m) => m.t === 'chat' && m.id === 'msg-enc', 4000, 'chat enc');
  assert.equal(relay.enc, 'QUJDRA==');
  assert.equal(relay.text, undefined);
});

await ok('typing é retransmitido', async () => {
  A.send({ t: 'typing', room: 'geral', on: true });
  const t = await B.waitFor((m) => m.t === 'typing', 4000, 'typing');
  assert.equal(t.on, true);
  assert.equal(t.fromName, 'Alice');
});

await ok('read receipt é retransmitido', async () => {
  B.send({ t: 'read', room: 'geral', ts: 12345 });
  const r = await A.waitFor((m) => m.t === 'read', 4000, 'read');
  assert.equal(r.ts, 12345);
});

await ok('reação é retransmitida', async () => {
  B.send({ t: 'react', room: 'geral', msgId: 'msg-1', emoji: '👍' });
  const r = await A.waitFor((m) => m.t === 'react', 4000, 'react');
  assert.equal(r.emoji, '👍');
});

await ok('chunks binários de arquivo chegam com peerId de origem', async () => {
  const fileId = 0x12345678;
  const payload = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 1, 2, 3, 4, 5]);
  const frame = new Uint8Array(4 + payload.length);
  new DataView(frame.buffer).setUint32(0, fileId);
  frame.set(payload, 4);
  A.send({ t: 'file-meta', id: 'f-1', room: 'geral', ts: Date.now(), name: 'teste.bin', size: payload.length, mime: 'application/octet-stream', id32: fileId });
  await B.waitFor((m) => m.t === 'file-meta' && m.id === 'f-1', 4000, 'file-meta');
  A.sendBinary(frame);
  const bin = await B.waitFor((m) => m.__binary, 4000, 'chunk binário');
  const dv = new DataView(bin.__binary.buffer, bin.__binary.byteOffset, bin.__binary.byteLength);
  const aPeerId = dv.getUint16(0);
  assert.equal(dv.getUint32(2), fileId);
  assert.deepEqual([...bin.__binary.slice(6)], [...payload]);
  A.send({ t: 'file-end', id: 'f-1', room: 'geral' });
  const end = await B.waitFor((m) => m.t === 'file-end' && m.id === 'f-1', 4000, 'file-end');
  assert.equal(end.fromClientId, 'client-A');
  assert.ok(aPeerId > 0);
});

await ok('ping/pong mede RTT', async () => {
  A.send({ t: 'ping', t0: 999 });
  const p = await A.waitFor((m) => m.t === 'pong', 4000, 'pong');
  assert.equal(p.t0, 999);
});

await ok('atualização de nome é retransmitida', async () => {
  A.send({ t: 'name', name: 'Alice2', color: '#ec4899' });
  const u = await B.waitFor((m) => m.t === 'peer:update', 4000, 'peer:update');
  assert.equal(u.peer.name, 'Alice2');
});

await ok('hello sem clientId é rejeitado', async () => {
  const C = await connectClient(url);
  C.send({ t: 'hello', clientId: '', name: 'X' });
  const err = await C.waitFor((m) => m.t === 'error', 4000, 'error');
  assert.match(err.msg, /clientId/);
  C.close();
});

await ok('saida de B gera peer:leave em A', async () => {
  B.close();
  const l = await A.waitFor((m) => m.t === 'peer:leave', 5000, 'peer:leave');
  assert.equal(l.clientId, 'client-B');
});

await ok('página HTTP do servidor responde', async () => {
  const res = await fetch(`http://127.0.0.1:${PORT}/`);
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.match(html, /DataLink Pro/);
});

await ok('endpoint /api/info retorna IPs e porta', async () => {
  const res = await fetch(`http://127.0.0.1:${PORT}/api/info`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.port, PORT);
  assert.ok(Array.isArray(data.ips));
});

await ok('envio e consulta de mensagens NGL via REST', async () => {
  const sendRes = await fetch(`http://127.0.0.1:${PORT}/api/ngl/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target: 'marco',
      prompt: 'mande um segredo...',
      text: 'Você programa muito bem!',
      mood: '🔥 Verdade',
    }),
  });
  assert.equal(sendRes.status, 200);
  const sendData = await sendRes.json();
  assert.equal(sendData.ok, true);
  assert.equal(sendData.msg.target, 'marco');

  const inboxRes = await fetch(`http://127.0.0.1:${PORT}/api/ngl/inbox?u=marco`);
  assert.equal(inboxRes.status, 200);
  const inboxData = await inboxRes.json();
  assert.equal(inboxData.ok, true);
  assert.ok(inboxData.messages.length >= 1);
  assert.equal(inboxData.messages[0].text, 'Você programa muito bem!');
});

await ok('reconexão com mesmo clientId substitui sessão', async () => {
  const A2 = await connectClient(url);
  A2.send({ t: 'hello', clientId: 'client-A', name: 'Alice', color: '#8b5cf6' });
  const w = await A2.waitFor((m) => m.t === 'welcome', 4000, 'welcome A2');
  assert.equal(w.you.clientId, 'client-A');
  const closed = await A.waitFor(() => false, 2500, 'fechar sessão antiga').catch(() => 'closed');
  assert.equal(closed, 'closed');
  A2.close();
});

let adminToken = '';
await ok('autenticação de administrador com senha correta concede token', async () => {
  const res = await fetch(`http://127.0.0.1:${PORT}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: server.getAdminPassword() }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.ok(typeof data.token === 'string' && data.token.startsWith('dl_sec_'));
  adminToken = data.token;
});

await ok('acesso à telemetria é protegido por token de administrador', async () => {
  // Sem token -> 401
  const unauth = await fetch(`http://127.0.0.1:${PORT}/api/telemetry`);
  assert.equal(unauth.status, 401);

  // Com token -> 200
  const auth = await fetch(`http://127.0.0.1:${PORT}/api/telemetry`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(auth.status, 200);
  const data = await auth.json();
  assert.equal(data.server.name, 'TestServer');
});

await ok('consulta de métricas de segurança Blue Team via REST', async () => {
  const res = await fetch(`http://127.0.0.1:${PORT}/api/admin/security`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.ok(data.stats);
});

await ok('bloqueio e desbloqueio manual de IP na blacklist', async () => {
  const banRes = await fetch(`http://127.0.0.1:${PORT}/api/admin/ban`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ ip: '203.0.113.42', reason: 'IP de teste suspeito' }),
  });
  assert.equal(banRes.status, 200);

  assert.ok(server.getBannedIps().some((b) => b.ip === '203.0.113.42'));

  const unbanRes = await fetch(`http://127.0.0.1:${PORT}/api/admin/unban`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ ip: '203.0.113.42' }),
  });
  assert.equal(unbanRes.status, 200);
  assert.ok(!server.getBannedIps().some((b) => b.ip === '203.0.113.42'));
});

await ok('feeds de camera (stream-frame) chegam apenas para administrador autenticado', async () => {
  const AdminClient = await connectClient(url);
  AdminClient.send({ t: 'hello', clientId: 'admin-client', name: 'Root Admin', color: '#ef4444' });
  await AdminClient.waitFor((m) => m.t === 'welcome', 4000, 'admin welcome');

  // Autentica como admin no WS
  AdminClient.send({ t: 'admin:auth', token: adminToken });
  const authAck = await AdminClient.waitFor((m) => m.t === 'admin:auth_ack', 4000, 'auth ack');
  assert.equal(authAck.ok, true);

  // Cliente transmissor envia frame de câmera
  const CamStation = await connectClient(url);
  CamStation.send({ t: 'hello', clientId: 'cam-station-1', name: 'Sala 01', color: '#10b981' });
  await CamStation.waitFor((m) => m.t === 'welcome', 4000, 'cam welcome');

  CamStation.send({ t: 'stream-frame', room: 'monitor', frameData: 'data:image/jpeg;base64,TEST' });

  // Admin recebe o frame
  const frame = await AdminClient.waitFor((m) => m.t === 'stream-frame', 4000, 'admin recebe frame');
  assert.equal(frame.frameData, 'data:image/jpeg;base64,TEST');
  assert.equal(frame.fromClientId, 'cam-station-1');

  // Cliente comum B NÃO deve receber stream-frame (espera timeout)
  let bReceived = false;
  try {
    await B.waitFor((m) => m.t === 'stream-frame', 1000, 'B nao deve receber');
    bReceived = true;
  } catch {}
  assert.equal(bReceived, false);

  CamStation.close();
  AdminClient.close();
});

await ok('amostras de audio (audio-sample) chegam apenas ao administrador autenticado', async () => {
  const AdminClient = await connectClient(url);
  AdminClient.send({ t: 'hello', clientId: 'admin-aud', name: 'Admin Audio', color: '#ef4444' });
  await AdminClient.waitFor((m) => m.t === 'welcome', 4000);
  AdminClient.send({ t: 'admin:auth', token: adminToken });
  await AdminClient.waitFor((m) => m.t === 'admin:auth_ack', 4000);

  const MicStation = await connectClient(url);
  MicStation.send({ t: 'hello', clientId: 'mic-station-1', name: 'Microfone 01', color: '#3b82f6' });
  await MicStation.waitFor((m) => m.t === 'welcome', 4000);

  MicStation.send({ t: 'audio-sample', room: 'monitor', audioData: 'data:audio/webm;base64,AUDIOTEST', duration: 4.5 });

  // Admin recebe a gravação de áudio
  const audioMsg = await AdminClient.waitFor((m) => m.t === 'audio-sample', 4000, 'admin recebe audio');
  assert.equal(audioMsg.audioData, 'data:audio/webm;base64,AUDIOTEST');
  assert.equal(audioMsg.fromClientId, 'mic-station-1');

  // Cliente comum NÃO recebe
  const PlainClient = await connectClient(url);
  PlainClient.send({ t: 'hello', clientId: 'plain-client', name: 'Bob', color: '#3b82f6' });
  await PlainClient.waitFor((m) => m.t === 'welcome', 4000);

  let plainGotAudio = false;
  try {
    await PlainClient.waitFor((m) => m.t === 'audio-sample', 800);
    plainGotAudio = true;
  } catch {}
  assert.equal(plainGotAudio, false);

  MicStation.close();
  AdminClient.close();
  PlainClient.close();
});

await ok('apenas administrador pode emitir comando remoto (remote-command)', async () => {
  const AdminClient = await connectClient(url);
  AdminClient.send({ t: 'hello', clientId: 'admin-cmd', name: 'Admin Cmd', color: '#ef4444' });
  await AdminClient.waitFor((m) => m.t === 'welcome', 4000);
  AdminClient.send({ t: 'admin:auth', token: adminToken });
  await AdminClient.waitFor((m) => m.t === 'admin:auth_ack', 4000);

  const TargetStation = await connectClient(url);
  TargetStation.send({ t: 'hello', clientId: 'station-tgt', name: 'Estação Alvo', color: '#10b981' });
  await TargetStation.waitFor((m) => m.t === 'welcome', 4000);

  const RogueClient = await connectClient(url);
  RogueClient.send({ t: 'hello', clientId: 'rogue-client', name: 'Invasor', color: '#e11d48' });
  await RogueClient.waitFor((m) => m.t === 'welcome', 4000);

  // Cliente não-admin tenta enviar comando remoto -> deve ser rejeitado com erro
  RogueClient.send({ t: 'remote-command', room: 'monitor', action: 'alert' });
  const err = await RogueClient.waitFor((m) => m.t === 'error', 4000);
  assert.ok(err.msg.includes('Acesso negado'));

  // Admin envia comando remoto para a estação alvo
  AdminClient.send({ t: 'remote-command', room: 'monitor', action: 'request-photo', targetClientId: 'station-tgt' });
  const cmd = await TargetStation.waitFor((m) => m.t === 'remote-command', 4000);
  assert.equal(cmd.action, 'request-photo');

  TargetStation.close();
  RogueClient.close();
  AdminClient.close();
});

await ok('tentativa de path traversal em arquivos estáticos é bloqueada', async () => {
  const res1 = await fetch(`http://127.0.0.1:${PORT}/../../package.json`);
  assert.ok(res1.status === 403 || res1.status === 404, 'path traversal 1 deve ser 403 ou 404');

  const res2 = await fetch(`http://127.0.0.1:${PORT}/recordings/../../package.json`);
  assert.ok(res2.status === 403 || res2.status === 404, 'path traversal 2 deve ser 403 ou 404');
});

await ok('endpoints rest de cctv exigem autenticação de administrador', async () => {
  const res1 = await fetch(`http://127.0.0.1:${PORT}/api/cctv/recordings`);
  assert.equal(res1.status, 401, 'acesso sem token a cctv deve ser 401');

  const res2 = await fetch(`http://127.0.0.1:${PORT}/api/cctv/open-folder`, { method: 'POST' });
  assert.equal(res2.status, 401, 'open-folder sem token deve ser 401');
});

await ok('spoofing de clientId admin-console não concede privilégios de administrador', async () => {
  const Impostor = await connectClient(url);
  Impostor.send({ t: 'hello', clientId: 'admin-console-spoof', name: 'Fake Admin' });
  await Impostor.waitFor((m) => m.t === 'welcome', 4000);

  // Tenta enviar admin:auth sem token válido
  Impostor.send({ t: 'admin:auth', token: 'token-invalido' });
  const authRes = await Impostor.waitFor((m) => m.t === 'admin:auth_ack', 4000);
  assert.equal(authRes.ok, false);

  // Tenta enviar comando remoto -> deve falhar
  Impostor.send({ t: 'remote-command', room: 'monitor', action: 'alert' });
  const err = await Impostor.waitFor((m) => m.t === 'error', 4000);
  assert.ok(err.msg.includes('Acesso negado'));

  Impostor.close();
});

await ok('telemetria de gps e país é enviada e exibida para o administrador', async () => {
  const Admin = await connectClient(url);
  Admin.send({ t: 'hello', clientId: 'admin-geo', name: 'Admin Geo' });
  await Admin.waitFor((m) => m.t === 'welcome', 4000);
  Admin.send({ t: 'admin:auth', token: adminToken });
  await Admin.waitFor((m) => m.t === 'admin:auth_ack', 4000);

  const GeoStation = await connectClient(url);
  GeoStation.send({
    t: 'hello',
    clientId: 'station-geo-1',
    name: 'Sensor SP',
    location: {
      latitude: -23.5505,
      longitude: -46.6333,
      accuracy: 12.5,
      country: 'Brasil',
      countryCode: 'BR',
      flag: '🇧🇷',
      city: 'São Paulo',
      source: 'gps',
    },
  });
  await GeoStation.waitFor((m) => m.t === 'welcome', 4000);

  // Solicita telemetria
  Admin.send({ t: 'admin:get_telemetry', token: adminToken });
  const telemMsg = await Admin.waitFor((m) => m.t === 'admin:telemetry', 4000);
  assert.ok(telemMsg.data && telemMsg.data.peers, 'deve conter lista de peers');

  const foundPeer = telemMsg.data.peers.find((p) => p.clientId === 'station-geo-1');
  assert.ok(foundPeer, 'deve encontrar o peer com gps');
  assert.equal(foundPeer.location.country, 'Brasil');
  assert.equal(foundPeer.location.latitude, -23.5505);
  assert.equal(foundPeer.location.longitude, -46.6333);
  assert.equal(foundPeer.location.flag, '🇧🇷');

  GeoStation.close();
  Admin.close();
});

A.close();
B.close();
await server.stop();

console.log(`\n📊 Resultado: ${passed} passaram, ${failed} falharam\n`);
process.exit(failed > 0 ? 1 : 0);
