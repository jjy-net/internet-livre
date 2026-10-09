import assert from 'node:assert';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

console.log('🧪 Iniciando teste de TCP Acústico (Selective Repeat ARQ, SACK e Chunks)...');

// Helper SHA-256
async function computeHash(buffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 1. Simulação de um documento/arquivo a transmitir por som
const originalDoc = 'RELATÓRIO CONFIDENCIAL DE TELEMETRIA ACÚSTICA P2P: Todos os nós operando em 18 kHz.';
const docBytes = new TextEncoder().encode(originalDoc);
const docHash = await computeHash(docBytes.buffer);

const chunkSize = 20; // 20 bytes por chunk acústico
const totalChunks = Math.ceil(docBytes.length / chunkSize);

const meta = {
  fileId: 'DOC1',
  fileName: 'relatorio-tatico.txt',
  fileSize: docBytes.length,
  mimeType: 'text/plain',
  totalChunks,
  chunkSize,
  sha256: docHash,
  isCompressed: false
};

// 2. Fatiamento em chunks
const chunks = [];
for (let i = 0; i < totalChunks; i++) {
  const start = i * chunkSize;
  const end = Math.min(docBytes.length, start + chunkSize);
  chunks.push(docBytes.slice(start, end));
}

assert.strictEqual(chunks.length, totalChunks, 'Número de chunks deve coincidir');

// 3. Simulação de Recepção com Perda de Pacote (Drop do chunk 1)
const receivedChunks = new Array(totalChunks).fill(null);
receivedChunks[0] = chunks[0];
// chunk 1 foi perdido no ruído ambiente!
receivedChunks[2] = chunks[2];
receivedChunks[3] = chunks[3];
receivedChunks[4] = chunks[4];

// Identificação de chunks faltantes (SACK)
const missing = [];
for (let i = 0; i < totalChunks; i++) {
  if (!receivedChunks[i]) missing.push(i);
}
assert.deepStrictEqual(missing, [1], 'Receptor deve identificar que falta exatamente o chunk 1');
console.log('✅ SACK identificou chunk faltante com precisão cirúrgica: chunks faltantes =', missing);

// 4. Retransmissão seletiva exclusiva do chunk faltante (Selective Repeat)
receivedChunks[1] = chunks[1]; // Remetente retransmite apenas o chunk 1!

// 5. Remontagem do arquivo e validação de Hash SHA-256
let totalBytes = 0;
for (const c of receivedChunks) totalBytes += c.length;
const assembled = new Uint8Array(totalBytes);
let off = 0;
for (const c of receivedChunks) {
  assembled.set(c, off);
  off += c.length;
}

const reassembledHash = await computeHash(assembled.buffer);
assert.strictEqual(reassembledHash, docHash, 'Hash SHA-256 deve ser 100% idêntico');
const reassembledText = new TextDecoder().decode(assembled);
assert.strictEqual(reassembledText, originalDoc, 'Documento reconstruído idêntico');

console.log('✅ Reconstrução bit-a-bit e validação SHA-256 aprovada!');
console.log('🎉 Teste do TCP Acústico com Selective Repeat ARQ e SACK concluído com sucesso!');
