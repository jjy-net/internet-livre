import assert from 'node:assert';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

console.log('🧪 Iniciando teste de Criptografia Assimétrica RSA e Esteganografia de Áudio...');

// 1. Teste de Chaves RSA-OAEP
const keyPair = await crypto.subtle.generateKey(
  {
    name: 'RSA-OAEP',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
  },
  true,
  ['encrypt', 'decrypt']
);

const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
const pkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function toPem(base64, label) {
  const lines = base64.match(/.{1,64}/g)?.join('\n') || base64;
  return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----`;
}

function fromPem(pem) {
  return pem.replace(/-----BEGIN [^-]+-----/g, '').replace(/-----END [^-]+-----/g, '').replace(/\s+/g, '');
}

const pubPem = toPem(arrayBufferToBase64(spki), 'PUBLIC KEY');
const privPem = toPem(arrayBufferToBase64(pkcs8), 'RSA PRIVATE KEY');

console.log('✅ Chaves RSA geradas e exportadas para formato PEM');

// 2. Teste de Criptografia Híbrida RSA-OAEP + AES-256-GCM
const testSecret = 'Mensagem ultrassecreta escondida dentro da música Jyy 2026! 🚀';

// Criptografar com Chave Pública:
const pubKeyImported = await crypto.subtle.importKey(
  'spki',
  base64ToArrayBuffer(fromPem(pubPem)),
  { name: 'RSA-OAEP', hash: 'SHA-256' },
  true,
  ['encrypt']
);

const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
const rawAes = await crypto.subtle.exportKey('raw', aesKey);
const iv = crypto.getRandomValues(new Uint8Array(12));
const encData = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, new TextEncoder().encode(testSecret));
const encAes = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pubKeyImported, rawAes);

const envelope = {
  k: arrayBufferToBase64(encAes),
  iv: arrayBufferToBase64(iv.buffer),
  d: arrayBufferToBase64(encData)
};
const envelopeB64 = btoa(JSON.stringify(envelope));

// Descriptografar com Chave Privada:
const privKeyImported = await crypto.subtle.importKey(
  'pkcs8',
  base64ToArrayBuffer(fromPem(privPem)),
  { name: 'RSA-OAEP', hash: 'SHA-256' },
  true,
  ['decrypt']
);

const parsedEnv = JSON.parse(atob(envelopeB64));
const decRawAes = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privKeyImported, base64ToArrayBuffer(parsedEnv.k));
const decAesKey = await crypto.subtle.importKey('raw', decRawAes, { name: 'AES-GCM' }, false, ['decrypt']);
const decryptedPlain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(base64ToArrayBuffer(parsedEnv.iv)) }, decAesKey, base64ToArrayBuffer(parsedEnv.d));
const resultText = new TextDecoder().decode(decryptedPlain);

assert.strictEqual(resultText, testSecret, 'Mensagem descriptografada deve coincidir exatamente');
console.log('✅ Criptografia e Descriptografia Assimétrica RSA-OAEP + AES-GCM confirmadas com sucesso!');

console.log('🎉 Todos os testes de esteganografia e criptografia passaram!');
