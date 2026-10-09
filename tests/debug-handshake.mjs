import net from 'node:net';
import crypto from 'node:crypto';
import { createDataLinkServer } from '../server/ws-server.js';

const PORT = 49872;
const server = createDataLinkServer({ port: PORT, discovery: false, webRoot: null });
await server.start();

const key = crypto.randomBytes(16).toString('base64');
const sock = net.connect(PORT, '127.0.0.1', () => {
  sock.write(
    `GET / HTTP/1.1\r\n` +
    `Host: 127.0.0.1:${PORT}\r\n` +
    `Upgrade: websocket\r\n` +
    `Connection: Upgrade\r\n` +
    `Sec-WebSocket-Key: ${key}\r\n` +
    `Sec-WebSocket-Version: 13\r\n\r\n`
  );
});
sock.on('data', (d) => {
  console.log('RESPOSTA DO SERVIDOR:\n' + JSON.stringify(d.toString('latin1')));
  const expected = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  console.log('Accept esperado:', expected);
  sock.destroy();
  server.stop().then(() => process.exit(0));
});
setTimeout(() => { console.log('TIMEOUT sem resposta'); process.exit(1); }, 3000);
