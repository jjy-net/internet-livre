/**
 * JJY — Motor Criptográfico Soberano FIDO U2F & FIDO2 / WebAuthn (RFC 8809 / RFC 8152 / RFC 8949)
 * 100% Offline e Soberano: Sem dependências externas de nuvem, telemetria ou pacotes de terceiros.
 *
 * Suporta:
 *  - Chaves de segurança físicas USB/NFC (YubiKey, Feitian, SoloKeys, Titan Security Key, etc.)
 *  - Autenticadores biométricos de plataforma (Windows Hello, Touch ID, Face ID, PIN TPM)
 *  - Criptografia assimétrica nativa do Node.js: ECDSA P-256 (ES256), RSA (RS256) e Ed25519 (EdDSA)
 *  - Decodificador CBOR puro conforme RFC 8949
 */
import crypto from 'node:crypto';

/* ------------------------------------------------------------------ */
/* Utilitários de Codificação Base64URL conforme RFC 4648              */
/* ------------------------------------------------------------------ */
export function bufferToBase64Url(buf) {
  return Buffer.from(buf).toString('base64url');
}

export function base64UrlToBuffer(str) {
  return Buffer.from(str, 'base64url');
}

export function generateRandomChallenge(bytes = 32) {
  return bufferToBase64Url(crypto.randomBytes(bytes));
}

/* ------------------------------------------------------------------ */
/* Decodificador CBOR Nativo Completo (RFC 8949)                       */
/* ------------------------------------------------------------------ */
export function decodeCbor(buf) {
  let offset = 0;
  const buffer = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);

  function decode() {
    if (offset >= buffer.length) throw new Error('Buffer CBOR truncado');
    const first = buffer[offset++];
    const major = first >> 5;
    const info = first & 0x1f;

    let val;
    if (info < 24) {
      val = info;
    } else if (info === 24) {
      if (offset + 1 > buffer.length) throw new Error('Truncado em UInt8');
      val = buffer.readUInt8(offset);
      offset += 1;
    } else if (info === 25) {
      if (offset + 2 > buffer.length) throw new Error('Truncado em UInt16');
      val = buffer.readUInt16BE(offset);
      offset += 2;
    } else if (info === 26) {
      if (offset + 4 > buffer.length) throw new Error('Truncado em UInt32');
      val = buffer.readUInt32BE(offset);
      offset += 4;
    } else if (info === 27) {
      if (offset + 8 > buffer.length) throw new Error('Truncado em UInt64');
      const hi = buffer.readUInt32BE(offset);
      const lo = buffer.readUInt32BE(offset + 4);
      offset += 8;
      val = hi * 2 ** 32 + lo;
    } else {
      throw new Error(`Informação adicional CBOR não suportada: ${info}`);
    }

    // Major 0: Inteiro positivo
    if (major === 0) return val;

    // Major 1: Inteiro negativo (-1 - val)
    if (major === 1) return -1 - val;

    // Major 2: Byte String (Buffer)
    if (major === 2) {
      if (offset + val > buffer.length) throw new Error('Byte string truncada');
      const slice = buffer.subarray(offset, offset + val);
      offset += val;
      return slice;
    }

    // Major 3: Texto UTF-8
    if (major === 3) {
      if (offset + val > buffer.length) throw new Error('String truncada');
      const str = buffer.toString('utf8', offset, offset + val);
      offset += val;
      return str;
    }

    // Major 4: Array de elementos
    if (major === 4) {
      const arr = [];
      for (let i = 0; i < val; i++) arr.push(decode());
      return arr;
    }

    // Major 5: Mapa de pares chave/valor
    if (major === 5) {
      const map = {};
      for (let i = 0; i < val; i++) {
        const k = decode();
        const v = decode();
        map[k] = v;
      }
      return map;
    }

    // Major 6: Tag semântica (ignora tag e retorna o conteúdo)
    if (major === 6) {
      return decode();
    }

    // Major 7: Valores simples (false, true, null, undefined)
    if (major === 7) {
      if (val === 20) return false;
      if (val === 21) return true;
      if (val === 22) return null;
      if (val === 23) return undefined;
      return val;
    }

    throw new Error(`Tipo maior CBOR desconhecido: ${major}`);
  }

  const result = decode();
  return { result, remainingOffset: offset };
}

/* ------------------------------------------------------------------ */
/* Parser de AuthenticatorData & Attested Credential (RFC 8809)       */
/* ------------------------------------------------------------------ */
export function parseAuthData(authData) {
  const buf = Buffer.isBuffer(authData) ? authData : Buffer.from(authData);
  if (buf.length < 37) {
    throw new Error('authData muito curto (< 37 bytes obrigatórios)');
  }

  const rpIdHash = buf.subarray(0, 32);
  const flags = buf[32];
  const userPresent = (flags & 0x01) !== 0;       // UP (User Present)
  const userVerified = (flags & 0x04) !== 0;      // UV (User Verified)
  const attestedCredData = (flags & 0x40) !== 0;  // AT (Attested Credential Data)
  const extensionData = (flags & 0x80) !== 0;     // ED (Extension Data)
  const signCount = buf.readUInt32BE(33);

  let credential = null;
  let remainingOffset = 37;

  if (attestedCredData) {
    if (buf.length < 55) throw new Error('authData com AT truncado (< 55 bytes)');
    const aaguid = buf.subarray(37, 53);
    const credentialIdLen = buf.readUInt16BE(53);
    if (buf.length < 55 + credentialIdLen) {
      throw new Error('authData com ID de credencial incompleto');
    }
    const credentialId = buf.subarray(55, 55 + credentialIdLen);

    // O COSE Key começa imediatamente no byte seguinte ao credentialId
    const coseBuffer = buf.subarray(55 + credentialIdLen);
    const { result: coseKey, remainingOffset: coseConsumed } = decodeCbor(coseBuffer);
    remainingOffset = 55 + credentialIdLen + coseConsumed;

    credential = {
      aaguid,
      credentialId,
      coseKey,
    };
  }

  return {
    rpIdHash,
    flags,
    userPresent,
    userVerified,
    signCount,
    credential,
    remainingOffset,
  };
}

/* ------------------------------------------------------------------ */
/* Conversor de Chave Pública COSE para JWK (RFC 8152 / RFC 7517)     */
/* ------------------------------------------------------------------ */
export function coseToJwk(cose) {
  if (!cose || typeof cose !== 'object') {
    throw new Error('COSE Key inválido ou ausente');
  }

  const kty = cose[1]; // 1: kty (Key Type)
  const alg = cose[3]; // 3: alg (Algorithm)

  // 1. EC2 — Curvas Elípticas (Ex: P-256 / ES256, usado por quase todas as YubiKeys)
  if (kty === 2) {
    const crv = cose[-1]; // -1: crv (1 = P-256)
    if (crv !== 1) throw new Error(`Curva elíptica COSE não suportada: crv=${crv}`);
    const x = cose[-2];
    const y = cose[-3];
    if (!Buffer.isBuffer(x) || !Buffer.isBuffer(y)) {
      throw new Error('Coordenadas X/Y ausentes ou inválidas na chave COSE EC2');
    }
    return {
      jwk: {
        kty: 'EC',
        crv: 'P-256',
        x: bufferToBase64Url(x),
        y: bufferToBase64Url(y),
      },
      alg: alg || -7, // ES256 (-7)
    };
  }

  // 2. RSA (Ex: RS256, comum em alguns chips TPM / Windows Hello)
  if (kty === 3) {
    const n = cose[-1]; // Modulus
    const e = cose[-2]; // Exponent
    if (!Buffer.isBuffer(n) || !Buffer.isBuffer(e)) {
      throw new Error('Parâmetros RSA ausentes na chave COSE');
    }
    return {
      jwk: {
        kty: 'RSA',
        n: bufferToBase64Url(n),
        e: bufferToBase64Url(e),
      },
      alg: alg || -257, // RS256 (-257)
    };
  }

  // 3. OKP — Octet Key Pair (Ex: Ed25519 / EdDSA)
  if (kty === 1) {
    const crv = cose[-1];
    if (crv !== 6) throw new Error(`Curva OKP não suportada: crv=${crv}`);
    const x = cose[-2];
    if (!Buffer.isBuffer(x)) throw new Error('Parâmetro X ausente no OKP');
    return {
      jwk: {
        kty: 'OKP',
        crv: 'Ed25519',
        x: bufferToBase64Url(x),
      },
      alg: alg || -8, // EdDSA (-8)
    };
  }

  throw new Error(`Tipo de chave COSE não suportado: kty=${kty}`);
}

/* ------------------------------------------------------------------ */
/* Validador de ClientDataJSON (RFC 8809 Seção 5.1)                   */
/* ------------------------------------------------------------------ */
export function validateClientData(clientDataInput, expectedType, expectedChallenge, expectedOrigin) {
  let clientDataBuf;
  if (Buffer.isBuffer(clientDataInput)) {
    clientDataBuf = clientDataInput;
  } else if (typeof clientDataInput === 'string') {
    clientDataBuf = base64UrlToBuffer(clientDataInput);
  } else {
    throw new Error('clientDataJSON deve ser Buffer ou string base64url');
  }

  let clientData;
  try {
    clientData = JSON.parse(clientDataBuf.toString('utf8'));
  } catch {
    throw new Error('clientDataJSON não é um JSON válido');
  }

  if (clientData.type !== expectedType) {
    throw new Error(`Tipo de operação WebAuthn inesperado: esperado "${expectedType}", recebido "${clientData.type}"`);
  }

  if (clientData.challenge !== expectedChallenge) {
    throw new Error('Desafio (challenge) WebAuthn inválido ou expirado');
  }

  // Verificação de origem — exige correspondência exata (protocolo + host + porta)
  if (expectedOrigin && clientData.origin) {
    const clientOrigin = String(clientData.origin).replace(/\/+$/, '');
    const expected = String(expectedOrigin).replace(/\/+$/, '');
    if (clientOrigin !== expected) {
      throw new Error(`Origem incompatível: ${clientData.origin} vs ${expectedOrigin}`);
    }
  }

  return { clientData, clientDataBuf };
}

/* ------------------------------------------------------------------ */
/* Verificação Completa de Registro de Nova Chave (Registration)      */
/* ------------------------------------------------------------------ */
export function verifyRegistrationCredential({
  attestationObject,
  clientDataJSON,
  expectedChallenge,
  expectedOrigin,
  expectedRpId,
}) {
  // 1. Valida clientData
  const { clientDataBuf } = validateClientData(
    clientDataJSON,
    'webauthn.create',
    expectedChallenge,
    expectedOrigin
  );

  // 2. Decodifica attestationObject
  const attestationBuf = Buffer.isBuffer(attestationObject)
    ? attestationObject
    : base64UrlToBuffer(attestationObject);
  const { result: attObject } = decodeCbor(attestationBuf);

  if (!attObject || !attObject.authData) {
    throw new Error('attestationObject inválido: authData não encontrado');
  }

  // 3. Processa authData e extrai a chave pública COSE
  const parsedAuth = parseAuthData(attObject.authData);
  if (!parsedAuth.userPresent) {
    throw new Error('Presença do usuário não confirmada pela chave');
  }

  if (!parsedAuth.credential) {
    throw new Error('Chave de hardware não forneceu dados de credencial (AT flag ausente)');
  }

  // 4. Valida se o rpIdHash bate com o rpId esperado (correspondência exata)
  if (expectedRpId) {
    const expectedHash = crypto.createHash('sha256').update(expectedRpId).digest();
    if (!crypto.timingSafeEqual(parsedAuth.rpIdHash, expectedHash)) {
      throw new Error('rpIdHash da chave não corresponde ao domínio do servidor');
    }
  }

  // 5. Converte a chave COSE para JWK padrão
  const { jwk, alg } = coseToJwk(parsedAuth.credential.coseKey);
  const credentialId = bufferToBase64Url(parsedAuth.credential.credentialId);

  return {
    credentialId,
    jwk,
    alg,
    signCount: parsedAuth.signCount,
    aaguid: bufferToBase64Url(parsedAuth.credential.aaguid),
    fmt: attObject.fmt || 'none',
  };
}

/* ------------------------------------------------------------------ */
/* Verificação Completa de Login com Chave FIDO (Authentication)      */
/* ------------------------------------------------------------------ */
export function verifyAuthenticationAssertion({
  authenticatorData,
  clientDataJSON,
  signature,
  storedCredential,
  expectedChallenge,
  expectedOrigin,
  expectedRpId,
}) {
  if (!storedCredential || !storedCredential.jwk) {
    throw new Error('Credencial não encontrada ou corrompida no servidor');
  }

  // 1. Valida clientData
  const { clientDataBuf } = validateClientData(
    clientDataJSON,
    'webauthn.get',
    expectedChallenge,
    expectedOrigin
  );

  // 2. Extrai e valida authenticatorData
  const authDataBuf = Buffer.isBuffer(authenticatorData)
    ? authenticatorData
    : base64UrlToBuffer(authenticatorData);
  const sigBuf = Buffer.isBuffer(signature) ? signature : base64UrlToBuffer(signature);

  if (authDataBuf.length < 37) {
    throw new Error('authenticatorData inválido (< 37 bytes)');
  }

  const rpIdHash = authDataBuf.subarray(0, 32);
  const flags = authDataBuf[32];
  const userPresent = (flags & 0x01) !== 0;

  if (!userPresent) {
    throw new Error('Presença do usuário não confirmada pela chave física (User Present = false)');
  }

  if (expectedRpId) {
    const expectedHash = crypto.createHash('sha256').update(expectedRpId).digest();
    if (!crypto.timingSafeEqual(rpIdHash, expectedHash)) {
      throw new Error('rpIdHash da chave não corresponde ao domínio do servidor');
    }
  }

  const signCount = authDataBuf.readUInt32BE(33);

  // 3. Monta os dados que foram assinados: authData || sha256(clientDataJSON)
  const clientDataHash = crypto.createHash('sha256').update(clientDataBuf).digest();
  const signedData = Buffer.concat([authDataBuf, clientDataHash]);

  // 4. Instancia a chave pública armazenada
  const publicKey = crypto.createPublicKey({ key: storedCredential.jwk, format: 'jwk' });
  const verifyAlgorithm = storedCredential.alg === -8 ? null : 'SHA256';

  // 5. Validação da assinatura criptográfica
  const isValid = crypto.verify(verifyAlgorithm, signedData, publicKey, sigBuf);
  if (!isValid) {
    throw new Error('Assinatura criptográfica da chave FIDO U2F / WebAuthn inválida ou rejeitada');
  }

  return {
    verified: true,
    signCount,
  };
}
