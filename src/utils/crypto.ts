/**
 * Utilitários criptográficos seguros offline (Web Crypto API)
 */

export async function computeHash(data: string | ArrayBuffer, algorithm: 'SHA-256' | 'SHA-512' = 'SHA-256'): Promise<string> {
  let buffer: ArrayBuffer;
  if (typeof data === 'string') {
    buffer = new TextEncoder().encode(data).buffer;
  } else {
    buffer = data;
  }
  const hashBuffer = await crypto.subtle.digest(algorithm, buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function encryptAESGCM(plaintext: string, secretKey: string): Promise<string> {
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
  return btoa(String.fromCharCode(...combined));
}

export async function decryptAESGCM(ciphertextBase64: string, secretKey: string): Promise<string> {
  const enc = new TextEncoder();
  const combined = Uint8Array.from(atob(ciphertextBase64), (c) => c.charCodeAt(0));
  if (combined.length < 28) throw new Error('Ciphertext inválido ou muito curto');
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

export function generateRandomKey(length = 32, useSpecialChars = true): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' +
    (useSpecialChars ? '!@#$%^&*()-_=+[]{}' : '');
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  let res = '';
  for (let i = 0; i < length; i++) {
    res += chars[array[i] % chars.length];
  }
  return res;
}

// ==========================================
// Criptografia Assimétrica (RSA-OAEP 2048-bit)
// ==========================================

export interface AsymmetricKeyPair {
  publicKeyPem: string;
  privateKeyPem: string;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function toPem(base64: string, label: string): string {
  const lines = base64.match(/.{1,64}/g)?.join('\n') || base64;
  return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----`;
}

function fromPem(pem: string): string {
  return pem.replace(/-----BEGIN [^-]+-----/g, '')
            .replace(/-----END [^-]+-----/g, '')
            .replace(/\s+/g, '');
}

/**
 * Gera um par de chaves RSA-OAEP 2048-bit no formato PEM padrão
 */
export async function generateAsymmetricKeyPair(): Promise<AsymmetricKeyPair> {
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

  const publicKeyPem = toPem(arrayBufferToBase64(spki), 'PUBLIC KEY');
  const privateKeyPem = toPem(arrayBufferToBase64(pkcs8), 'RSA PRIVATE KEY');

  return { publicKeyPem, privateKeyPem };
}

/**
 * Importa chave pública RSA em formato PEM
 */
export async function importPublicKey(pem: string): Promise<CryptoKey> {
  const cleanB64 = fromPem(pem);
  const buffer = base64ToArrayBuffer(cleanB64);
  return await crypto.subtle.importKey(
    'spki',
    buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['encrypt']
  );
}

/**
 * Importa chave privada RSA em formato PEM
 */
export async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const cleanB64 = fromPem(pem);
  const buffer = base64ToArrayBuffer(cleanB64);
  return await crypto.subtle.importKey(
    'pkcs8',
    buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['decrypt']
  );
}

/**
 * Criptografa mensagem com a chave pública do destinatário usando criptografia híbrida (RSA-OAEP + AES-256-GCM)
 */
export async function encryptAsymmetric(plaintext: string, publicKeyPem: string): Promise<string> {
  const pubKey = await importPublicKey(publicKeyPem);

  // Chave simétrica efêmera AES-256-GCM para comportar mensagens de qualquer tamanho com máxima performance
  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintextBytes = new TextEncoder().encode(plaintext);
  const encryptedData = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintextBytes);

  // Criptografa a chave simétrica com a chave pública RSA
  const encryptedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pubKey, rawAesKey);

  const envelope = {
    alg: 'RSA-OAEP+AES-GCM',
    k: arrayBufferToBase64(encryptedKey),
    iv: arrayBufferToBase64(iv.buffer),
    d: arrayBufferToBase64(encryptedData),
  };

  return btoa(JSON.stringify(envelope));
}

/**
 * Descriptografa mensagem usando a chave privada RSA do receptor
 */
export async function decryptAsymmetric(envelopeBase64: string, privateKeyPem: string): Promise<string> {
  const privKey = await importPrivateKey(privateKeyPem);

  let envelope: { alg: string; k: string; iv: string; d: string };
  try {
    const jsonStr = atob(envelopeBase64);
    envelope = JSON.parse(jsonStr);
  } catch {
    throw new Error('Envelope de criptografia assimétrica inválido ou corrompido');
  }

  const encKeyBuffer = base64ToArrayBuffer(envelope.k);
  const iv = new Uint8Array(base64ToArrayBuffer(envelope.iv));
  const encDataBuffer = base64ToArrayBuffer(envelope.d);

  // Recupera a chave simétrica com a chave privada RSA
  const rawAesKey = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privKey, encKeyBuffer);
  const aesKey = await crypto.subtle.importKey('raw', rawAesKey, { name: 'AES-GCM' }, false, ['decrypt']);

  // Descriptografa o payload com AES-GCM
  const decryptedBytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, encDataBuffer);
  return new TextDecoder().decode(decryptedBytes);
}

