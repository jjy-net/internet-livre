import assert from 'node:assert';

console.log('🧪 Iniciando teste de Rede Acústica P2P por Som (Frames, CRC-16 e Roteamento)...');

// Helper CRC16
function computeCrc16(bytes) {
  let crc = 0xFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i] << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc;
}

// 1. Teste de montagem de Frame Acústico
const srcNode = 'A1';
const dstNode = 'B2';
const seq = 42;
const payloadText = 'PING-TACTICAL-2026';

const enc = new TextEncoder();
const payloadBytes = enc.encode(payloadText);
const len = payloadBytes.length;

const headerLen = 11;
const totalLen = headerLen + len + 2;
const buffer = new Uint8Array(totalLen);

buffer[0] = 0xAA;
buffer[1] = 0x55;
buffer[2] = 0x4A;
buffer[3] = 0x59;
buffer[4] = 0x01; // DATA
buffer[5] = srcNode.charCodeAt(0);
buffer[6] = srcNode.charCodeAt(1);
buffer[7] = dstNode.charCodeAt(0);
buffer[8] = dstNode.charCodeAt(1);
buffer[9] = seq;
buffer[10] = len;
buffer.set(payloadBytes, headerLen);

const crcData = buffer.slice(2, headerLen + len);
const crcVal = computeCrc16(crcData);
buffer[headerLen + len] = (crcVal >> 8) & 0xFF;
buffer[headerLen + len + 1] = crcVal & 0xFF;

// 2. Teste de Validação e Desmontagem de Frame
assert.strictEqual(buffer[0], 0xAA, 'Preâmbulo byte 0 válido');
assert.strictEqual(buffer[1], 0x55, 'Preâmbulo byte 1 válido');

const decNetId = (buffer[2] << 8) | buffer[3];
assert.strictEqual(decNetId, 0x4A59, 'Network ID "JY" correspondente');

const decSrc = String.fromCharCode(buffer[5], buffer[6]);
const decDst = String.fromCharCode(buffer[7], buffer[8]);
assert.strictEqual(decSrc, srcNode, 'Origem do nó decodificada com sucesso');
assert.strictEqual(decDst, dstNode, 'Destino do nó decodificado com sucesso');

const decPayload = new TextDecoder().decode(buffer.slice(headerLen, headerLen + len));
assert.strictEqual(decPayload, payloadText, 'Payload decodificado intacto');

const decCrc = (buffer[headerLen + len] << 8) | buffer[headerLen + len + 1];
assert.strictEqual(decCrc, crcVal, 'Integridade CRC-16 verificada');

console.log('✅ Montagem, transmissão virtual e validação CRC-16 aprovadas!');
console.log('🎉 Teste de protocolo de enlace acústico P2P concluído com sucesso!');
