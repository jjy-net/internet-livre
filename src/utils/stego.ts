/**
 * Esteganografia LSB (Least Significant Bit) para esconder texto em imagens
 */

export function encodeStego(canvas: HTMLCanvasElement, message: string): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível obter contexto 2D');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  const enc = new TextEncoder();
  const msgBytes = enc.encode(message);
  const totalBytes = msgBytes.length;

  // Precisamos de 4 bytes para o tamanho + msgBytes
  const header = new Uint8Array(4);
  new DataView(header.buffer).setUint32(0, totalBytes);
  const fullPayload = new Uint8Array(4 + totalBytes);
  fullPayload.set(header, 0);
  fullPayload.set(msgBytes, 4);

  // Cada byte precisa de 8 bits -> 8 canais de cores (pulando alfa)
  const totalBits = fullPayload.length * 8;
  const availableBits = Math.floor(data.length / 4) * 3; // RGB
  if (totalBits > availableBits) {
    throw new Error(`Imagem muito pequena! Suporta até ${Math.floor(availableBits / 8) - 4} bytes, mensagem tem ${totalBytes} bytes.`);
  }

  let bitIdx = 0;
  for (let i = 0; i < fullPayload.length; i++) {
    const byte = fullPayload[i];
    for (let b = 7; b >= 0; b--) {
      const bit = (byte >> b) & 1;
      // Calcula índice no array data (pulando canais alpha: 3, 7, 11...)
      const pixelIdx = Math.floor(bitIdx / 3);
      const colorChannel = bitIdx % 3;
      const dataIdx = pixelIdx * 4 + colorChannel;
      data[dataIdx] = (data[dataIdx] & 0xfe) | bit;
      bitIdx++;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

export function decodeStego(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível obter contexto 2D');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  // Primeiro lê 32 bits (4 bytes) para saber o tamanho da mensagem
  let bitIdx = 0;
  const headerBytes = new Uint8Array(4);
  for (let i = 0; i < 4; i++) {
    let byte = 0;
    for (let b = 7; b >= 0; b--) {
      const pixelIdx = Math.floor(bitIdx / 3);
      const colorChannel = bitIdx % 3;
      const dataIdx = pixelIdx * 4 + colorChannel;
      const bit = data[dataIdx] & 1;
      byte = (byte << 1) | bit;
      bitIdx++;
    }
    headerBytes[i] = byte;
  }

  const msgLen = new DataView(headerBytes.buffer).getUint32(0);
  const availableBytes = Math.floor((Math.floor(data.length / 4) * 3) / 8) - 4;
  if (msgLen <= 0 || msgLen > availableBytes || msgLen > 500000) {
    throw new Error('Nenhuma mensagem esteganográfica detectada nesta imagem ou formato incompatível.');
  }

  const msgBytes = new Uint8Array(msgLen);
  for (let i = 0; i < msgLen; i++) {
    let byte = 0;
    for (let b = 7; b >= 0; b--) {
      const pixelIdx = Math.floor(bitIdx / 3);
      const colorChannel = bitIdx % 3;
      const dataIdx = pixelIdx * 4 + colorChannel;
      const bit = data[dataIdx] & 1;
      byte = (byte << 1) | bit;
      bitIdx++;
    }
    msgBytes[i] = byte;
  }

  return new TextDecoder().decode(msgBytes);
}
