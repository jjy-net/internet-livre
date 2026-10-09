import assert from 'node:assert';

console.log('🧪 Iniciando teste de Transmissão de Imagens e Vídeo por Som (SSTV)...');

// Teste de cálculo de frequências SSTV
const FREQ_BLACK = 1500;
const FREQ_WHITE = 2300;

function pixelToFreq(val) {
  return FREQ_BLACK + (val / 255) * (FREQ_WHITE - FREQ_BLACK);
}

function freqToPixel(freq) {
  const norm = (freq - FREQ_BLACK) / (FREQ_WHITE - FREQ_BLACK);
  return Math.max(0, Math.min(255, Math.round(norm * 255)));
}

// Validação dos extremos
assert.strictEqual(pixelToFreq(0), 1500, 'Pixel preto deve mapear para 1500 Hz');
assert.strictEqual(pixelToFreq(255), 2300, 'Pixel branco deve mapear para 2300 Hz');

// Validação de recuperação de pixel
const testVal = 128;
const testFreq = pixelToFreq(testVal);
const recoveredVal = freqToPixel(testFreq);
assert.strictEqual(recoveredVal, testVal, 'Valor de brilho deve ser recuperado com precisão');

console.log('✅ Modulação e Demodulação de Frequência de Imagem validada!');
console.log('🎉 Testes de SSTV e Vídeo por Som aprovados com sucesso!');
