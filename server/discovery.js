/**
 * DataLink Pro — Descoberta automática na LAN via UDP.
 *
 * O servidor transmite um "beacon" periódico em broadcast; outros apps
 * DataLink na rede escutam e mostram o servidor na aba Rede, sem precisar
 * digitar IP manualmente.
 */
import dgram from 'node:dgram';

export const DISCOVERY_PORT = 48777;
const MAGIC = 'DATALINKPRO1';

/**
 * Transmite beacon periódico anunciando o servidor.
 * @returns {{close: () => void}}
 */
export function startBeacon({ port = DISCOVERY_PORT, info = {}, interval = 2500 } = {}) {
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  const payload = Buffer.from(JSON.stringify({ magic: MAGIC, ...info }), 'utf8');

  socket.on('error', () => { /* beacon é melhor-esforço */ });
  socket.bind(() => {
    try { socket.setBroadcast(true); } catch { /* ignore */ }
  });

  const timer = setInterval(() => {
    // Atualiza IPs a cada envio (rede pode mudar)
    const fresh = Buffer.from(JSON.stringify({ magic: MAGIC, ...info }), 'utf8');
    try {
      socket.send(fresh, 0, fresh.length, port, '255.255.255.255');
    } catch { /* ignore */ }
  }, interval);
  timer.unref?.();

  // Envia imediatamente também
  try { socket.send(payload, 0, payload.length, port, '255.255.255.255'); } catch { /* ignore */ }

  return {
    close() {
      clearInterval(timer);
      try { socket.close(); } catch { /* ignore */ }
    },
  };
}

/**
 * Escuta beacons de servidores DataLink na rede.
 * @param {{onFound: (server: object) => void}} opts
 * @returns {{close: () => void, getServers: () => object[]}}
 */
export function startListener({ onFound } = {}) {
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  const servers = new Map(); // `${ip}:${port}` -> info

  socket.on('message', (msg, rinfo) => {
    try {
      const data = JSON.parse(msg.toString('utf8'));
      if (data.magic !== MAGIC || (data.app !== 'jyy' && data.app !== 'datalink-pro')) return;
      const ip = rinfo.address;
      const key = `${ip}:${data.port}`;
      const entry = {
        key,
        ip,
        port: data.port,
        name: data.name || ip,
        version: data.v,
        lastSeen: Date.now(),
      };
      const known = servers.get(key);
      servers.set(key, entry);
      if (onFound && (!known || known.ip !== entry.ip || !known.version || known.version !== entry.version || known.name !== entry.name)) {
        onFound(entry);
      }
    } catch { /* pacotes inválidos são ignorados */ }
  });

  socket.on('error', () => { /* ignore */ });
  socket.bind(DISCOVERY_PORT, '0.0.0.0');

  // Remove servidores não vistos há 15s
  const pruneTimer = setInterval(() => {
    const cutoff = Date.now() - 15000;
    for (const [key, s] of servers) {
      if (s.lastSeen < cutoff) servers.delete(key);
    }
  }, 5000);
  pruneTimer.unref?.();

  return {
    getServers() {
      return [...servers.values()].filter((s) => s.lastSeen > Date.now() - 15000);
    },
    close() {
      clearInterval(pruneTimer);
      try { socket.close(); } catch { /* ignore */ }
    },
  };
}
