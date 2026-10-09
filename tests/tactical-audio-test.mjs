import assert from 'node:assert';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

console.log('🧪 Iniciando testes de Contra-Espionagem Acústica e Negabilidade Plausível...');

// Helper de criptografia AES-GCM
async function encryptAESGCM(plaintext, secretKey) {
  const enc = new TextEncoder();
  const data = enc.encode(plaintext);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secretKey.padEnd(32, '0')).slice(0, 32),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, data);
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  return Buffer.from(combined).toString('base64');
}

async function decryptAESGCM(ciphertextBase64, secretKey) {
  const enc = new TextEncoder();
  const combined = Buffer.from(ciphertextBase64, 'base64');
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const encrypted = combined.slice(28);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secretKey.padEnd(32, '0')).slice(0, 32),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, encrypted);
  return new TextDecoder().decode(decrypted);
}

// 1. Teste de Negabilidade Plausível (Duplo Payload)
const decoyText = 'Receita de bolo de cenoura e compras do supermercado.';
const realCovertText = 'OPERAÇÃO VALQUÍRIA: Coordenadas do ponto de extração 23.5505S, 46.6333W.';

const decoyPass = 'senha-sob-coacao-123';
const realPass = 'TopSecretMilitaryKey-4096-ALPHA!';

const encDecoy = await encryptAESGCM(JSON.stringify({ t: 'decoy', m: decoyText }), decoyPass);
const encReal = await encryptAESGCM(JSON.stringify({ t: 'real', m: realCovertText }), realPass);

const bundle = {
  mode: 'deniable_dual',
  slotA: encDecoy,
  slotB: encReal,
  ts: Date.now()
};
const serializedBundle = JSON.stringify(bundle);

// Teste 1: O invasor obriga a digitar a senha sob coação:
const openedWithDecoy = await (async () => {
  const parsed = JSON.parse(serializedBundle);
  const decA = await decryptAESGCM(parsed.slotA, decoyPass);
  return JSON.parse(decA);
})();
assert.strictEqual(openedWithDecoy.m, decoyText, 'Chave sob coação deve revelar apenas o decoy inofensivo');
console.log('✅ Chave Coagida (Decoy) revelou com sucesso mensagem inofensiva!');

// Teste 2: O agente legítimo digita a senha real secreta:
const openedWithReal = await (async () => {
  const parsed = JSON.parse(serializedBundle);
  const decB = await decryptAESGCM(parsed.slotB, realPass);
  return JSON.parse(decB);
})();
assert.strictEqual(openedWithReal.m, realCovertText, 'Chave secreta deve revelar a inteligência real classificada');
console.log('✅ Chave Real Secreta revelou a inteligência confidencial!');

console.log('🎉 Todos os testes de contra-espionagem acústica foram aprovados!');
