/**
 * Acoustic Transport Layer (TCP Acústico sobre Som)
 * Protocolo de Transporte Confiável para Documentos, Imagens e Arquivos via Ondas Sonoras.
 * Implementa:
 * - Selective Repeat ARQ (Selective Acknowledgment - SACK)
 * - Janela Deslizante de Burst de Chunks (Windowed Transmission)
 * - Compressão Nativa GZIP (CompressionStream)
 * - Matriz de Integridade por Chunk e Validação Criptográfica SHA-256
 */

import { computeHash } from './crypto';
import { computeCrc16, serializeAcousticFrame, deserializeAcousticFrame, FrameType } from './acousticNetwork';

export interface AcousticFileMetadata {
  fileId: string;       // ID único de 4 caracteres
  fileName: string;
  fileSize: number;     // Tamanho em bytes
  mimeType: string;
  totalChunks: number;
  chunkSize: number;
  sha256: string;
  isCompressed: boolean;
}

export type ChunkStatus = 'pending' | 'sending' | 'acked' | 'lost';

export interface TransferProgress {
  fileId: string;
  fileName: string;
  totalBytes: number;
  transferredBytes: number;
  totalChunks: number;
  completedChunks: number;
  percent: number;
  chunkStates: ChunkStatus[];
  speedBytesPerSec: number;
  etaSeconds: number;
  retransmissionsCount: number;
  isReceiving: boolean;
}

/**
 * Comprime bytes usando CompressionStream('gzip') nativo
 */
export async function compressData(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') return data;
  try {
    const stream = new Blob([data.buffer as ArrayBuffer]).stream().pipeThrough(new CompressionStream('gzip'));
    const compressedBlob = await new Response(stream).blob();
    const arr = new Uint8Array(await compressedBlob.arrayBuffer());
    // Retorna comprimido apenas se realmente reduziu o tamanho
    return arr.length < data.length ? arr : data;
  } catch {
    return data;
  }
}

/**
 * Descomprime bytes usando DecompressionStream('gzip') nativo
 */
export async function decompressData(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') return data;
  try {
    const stream = new Blob([data.buffer as ArrayBuffer]).stream().pipeThrough(new DecompressionStream('gzip'));
    const decompressedBlob = await new Response(stream).blob();
    return new Uint8Array(await decompressedBlob.arrayBuffer());
  } catch {
    return data;
  }
}

/**
 * Serializa pacote de metadados de arquivo (FILE_META)
 */
export function encodeFileMetaPayload(meta: AcousticFileMetadata): string {
  return JSON.stringify({
    id: meta.fileId,
    n: meta.fileName,
    s: meta.fileSize,
    m: meta.mimeType,
    tc: meta.totalChunks,
    cs: meta.chunkSize,
    h: meta.sha256,
    c: meta.isCompressed ? 1 : 0,
  });
}

/**
 * Desserializa pacote de metadados de arquivo
 */
export function decodeFileMetaPayload(payloadText: string): AcousticFileMetadata | null {
  try {
    const obj = JSON.parse(payloadText);
    return {
      fileId: obj.id,
      fileName: obj.n,
      fileSize: obj.s,
      mimeType: obj.m,
      totalChunks: obj.tc,
      chunkSize: obj.cs,
      sha256: obj.h,
      isCompressed: obj.c === 1,
    };
  } catch {
    return null;
  }
}

/**
 * Serializa payload de Chunk (FILE_CHUNK)
 * Formato: FILE_ID(4 chars) | CHUNK_INDEX(Uint16 BE) | RAW_CHUNK_BASE64
 */
export function encodeFileChunkPayload(fileId: string, chunkIndex: number, chunkBytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < chunkBytes.length; i++) binary += String.fromCharCode(chunkBytes[i]);
  const b64 = btoa(binary);
  return `${fileId.padEnd(4, ' ').slice(0, 4)}:${chunkIndex}:${b64}`;
}

export function decodeFileChunkPayload(payloadText: string): { fileId: string; chunkIndex: number; chunkBytes: Uint8Array } | null {
  try {
    const parts = payloadText.split(':');
    if (parts.length < 3) return null;
    const fileId = parts[0].trim();
    const chunkIndex = parseInt(parts[1], 10);
    const b64 = parts.slice(2).join(':');

    const binary = atob(b64);
    const chunkBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) chunkBytes[i] = binary.charCodeAt(i);

    return { fileId, chunkIndex, chunkBytes };
  } catch {
    return null;
  }
}

/**
 * Serializa payload de SACK (Selective Acknowledgment) com chunks faltantes
 * Formato: FILE_ID(4 chars) | OK_UP_TO | MISSING_INDEXES(separados por vírgula)
 */
export function encodeSackPayload(fileId: string, okUpTo: number, missingIndexes: number[]): string {
  return `${fileId}:${okUpTo}:${missingIndexes.join(',')}`;
}

export function decodeSackPayload(payloadText: string): { fileId: string; okUpTo: number; missingIndexes: number[] } | null {
  try {
    const parts = payloadText.split(':');
    if (parts.length < 3) return null;
    const fileId = parts[0].trim();
    const okUpTo = parseInt(parts[1], 10);
    const missingStr = parts[2].trim();
    const missingIndexes = missingStr ? missingStr.split(',').map((n) => parseInt(n, 10)) : [];
    return { fileId, okUpTo, missingIndexes };
  } catch {
    return null;
  }
}

// =========================================================================
// SESSÃO RECEPTORA DE ARQUIVOS (RECONSTRUÇÃO E ARQ SACK)
// =========================================================================

export class AcousticIncomingFileSession {
  public meta: AcousticFileMetadata;
  public chunks: (Uint8Array | null)[];
  public receivedCount = 0;
  public startTime: number;
  public isCompleted = false;

  constructor(meta: AcousticFileMetadata) {
    this.meta = meta;
    this.chunks = new Array(meta.totalChunks).fill(null);
    this.startTime = Date.now();
  }

  public addChunk(index: number, bytes: Uint8Array): boolean {
    if (index < 0 || index >= this.meta.totalChunks) return false;
    if (this.chunks[index] === null) {
      this.chunks[index] = bytes;
      this.receivedCount++;
      return true;
    }
    return false;
  }

  public getMissingIndexes(): number[] {
    const missing: number[] = [];
    for (let i = 0; i < this.meta.totalChunks; i++) {
      if (this.chunks[i] === null) missing.push(i);
    }
    return missing;
  }

  public getProgress(): TransferProgress {
    const chunkStates: ChunkStatus[] = this.chunks.map((c) => (c !== null ? 'acked' : 'pending'));
    const completedChunks = this.receivedCount;
    const totalChunks = this.meta.totalChunks;
    const percent = Math.round((completedChunks / totalChunks) * 100);

    const elapsedSec = Math.max(1, (Date.now() - this.startTime) / 1000);
    const transferredBytes = completedChunks * this.meta.chunkSize;
    const speed = Math.round(transferredBytes / elapsedSec);
    const remainingChunks = totalChunks - completedChunks;
    const eta = speed > 0 ? Math.round((remainingChunks * this.meta.chunkSize) / speed) : 0;

    return {
      fileId: this.meta.fileId,
      fileName: this.meta.fileName,
      totalBytes: this.meta.fileSize,
      transferredBytes: Math.min(this.meta.fileSize, transferredBytes),
      totalChunks,
      completedChunks,
      percent,
      chunkStates,
      speedBytesPerSec: speed,
      etaSeconds: eta,
      retransmissionsCount: 0,
      isReceiving: true,
    };
  }

  /**
   * Reconstrói o arquivo completo e valida com hash SHA-256
   */
  public async assembleFile(): Promise<{ blob: Blob; verified: boolean; reconstructedBytes: Uint8Array } | null> {
    if (this.receivedCount < this.meta.totalChunks) return null;

    let totalByteLen = 0;
    for (const c of this.chunks) {
      if (c) totalByteLen += c.length;
    }

    const assembled = new Uint8Array(totalByteLen);
    let offset = 0;
    for (let i = 0; i < this.chunks.length; i++) {
      const c = this.chunks[i];
      if (!c) return null;
      assembled.set(c, offset);
      offset += c.length;
    }

    // Descompressão se necessário
    let finalBytes: Uint8Array = assembled;
    if (this.meta.isCompressed) {
      finalBytes = (await decompressData(assembled)) as Uint8Array;
    }

    // Validação de hash SHA-256
    const calcHash = await computeHash(finalBytes.buffer as ArrayBuffer, 'SHA-256');
    const verified = calcHash === this.meta.sha256;

    const blob = new Blob([finalBytes.buffer as ArrayBuffer], { type: this.meta.mimeType || 'application/octet-stream' });
    this.isCompleted = true;

    return { blob, verified, reconstructedBytes: finalBytes };
  }
}
