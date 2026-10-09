import assert from 'assert';

/**
 * Teste do Sensor de Áudio por Giroscópio (Gyrophone MEMS)
 * Baseado no paper da Stanford University (USENIX Security 2014)
 */

console.log('🧪 Iniciando teste de Giroscópio como Microfone Acústico (Gyrophone MEMS)...');

// Implementação isolada de teste do algoritmo DSP do Gyrophone
class TestGyrophoneDsp {
  constructor(gainBoost = 35.0, alpha = 0.85) {
    this.gainBoost = gainBoost;
    this.alpha = alpha;
    this.filterStateX = { prevIn: 0, prevOut: 0 };
    this.filterStateY = { prevIn: 0, prevOut: 0 };
    this.filterStateZ = { prevIn: 0, prevOut: 0 };
    this.recentSamples = [];
    this.samplesReceived = 0;
  }

  processSample(rawX, rawY, rawZ) {
    this.samplesReceived++;

    // 1. Filtro Passa-Alta (High-Pass / DC-Blocker) para remover gravidade/inclinação
    const fx = this.alpha * (this.filterStateX.prevOut + rawX - this.filterStateX.prevIn);
    this.filterStateX.prevIn = rawX;
    this.filterStateX.prevOut = fx;

    const fy = this.alpha * (this.filterStateY.prevOut + rawY - this.filterStateY.prevIn);
    this.filterStateY.prevIn = rawY;
    this.filterStateY.prevOut = fy;

    const fz = this.alpha * (this.filterStateZ.prevOut + rawZ - this.filterStateZ.prevIn);
    this.filterStateZ.prevIn = rawZ;
    this.filterStateZ.prevOut = fz;

    // 2. Determinar eixo dominante
    let dominantAxis = 'z';
    let selectedSignal = fz;
    const ax = Math.abs(fx), ay = Math.abs(fy), az = Math.abs(fz);
    if (az >= ax && az >= ay) {
      dominantAxis = 'z';
      selectedSignal = fz;
    } else if (ax >= ay) {
      dominantAxis = 'x';
      selectedSignal = fx;
    } else {
      dominantAxis = 'y';
      selectedSignal = fy;
    }

    // 3. Amplificação de ressonância acústica e soft-clipping
    const amplified = selectedSignal * this.gainBoost;
    const audioSample = Math.tanh(amplified);

    this.recentSamples.push(audioSample);
    if (this.recentSamples.length > 50) this.recentSamples.shift();

    return { audioSample, dominantAxis, fx, fy, fz };
  }

  getRms() {
    if (this.recentSamples.length === 0) return 0;
    const sumSq = this.recentSamples.reduce((acc, s) => acc + s * s, 0);
    return Math.sqrt(sumSq / this.recentSamples.length);
  }
}

// TESTE 1: Remoção de gravidade (DC Offset de 9.8 m/s² ou inclinação constante de 45 deg)
const dsp = new TestGyrophoneDsp(30.0);
console.log('  1. Testando rejeição de gravidade/inclinação estática...');
for (let i = 0; i < 60; i++) {
  // Simulando dispositivo inclinado estático com 45 graus no eixo X e 9.8 de gravidade no Z
  dsp.processSample(45.0, 0.0, 9.8);
}
const staticOut = dsp.processSample(45.0, 0.0, 9.8);
// O filtro passa-alta deve atenuar o valor estático quase a zero
assert(Math.abs(staticOut.fx) < 0.05, `O DC estático em X deveria ser filtrado, mas obteve: ${staticOut.fx}`);
assert(Math.abs(staticOut.fz) < 0.05, `A gravidade estática em Z deveria ser filtrada, mas obteve: ${staticOut.fz}`);
console.log(`  ✅ Gravidade e inclinação estática eliminadas pelo filtro DC-Blocker (fx=${staticOut.fx.toFixed(4)}, fz=${staticOut.fz.toFixed(4)})`);

// TESTE 2: Detecção de micro-vibração acústica (onda senoidal sonora de 120Hz modulando o eixo Z)
console.log('  2. Testando captação de vibração acústica no eixo Z...');
const dspAcoustic = new TestGyrophoneDsp(35.0);
let maxDetectedAudio = 0;
for (let n = 0; n < 100; n++) {
  // Micro-vibração acústica de 0.08 deg/s a ~100Hz
  const vibrationZ = Math.sin(n * 0.4) * 0.08;
  const res = dspAcoustic.processSample(0.005, 0.005, vibrationZ);
  if (Math.abs(res.audioSample) > maxDetectedAudio) {
    maxDetectedAudio = Math.abs(res.audioSample);
  }
}

const rms = dspAcoustic.getRms();
assert(rms > 0.05, `RMS acústico deveria ser detectável, obteve: ${rms}`);
assert(maxDetectedAudio > 0.2, `Pico de áudio deveria ser amplificado, obteve: ${maxDetectedAudio}`);
console.log(`  ✅ Vibração acústica captada e amplificada com sucesso! RMS=${rms.toFixed(4)}, Pico=${maxDetectedAudio.toFixed(4)}`);

// TESTE 3: Verificação de eixo dominante
console.log('  3. Testando detecção de eixo de maior vibração...');
const dspAxis = new TestGyrophoneDsp();
// Excita o eixo Y (Roll) com vibração forte
let lastDominant = '';
for (let i = 0; i < 20; i++) {
  const res = dspAxis.processSample(0.01, Math.sin(i) * 0.15, 0.01);
  lastDominant = res.dominantAxis;
}
assert.strictEqual(lastDominant, 'y', `Eixo dominante deveria ser 'y', obteve: ${lastDominant}`);
console.log(`  ✅ Eixo dominante identificado corretamente: '${lastDominant}'`);

console.log('🎉 Todos os testes de processamento acústico por Giroscópio (Gyrophone) passaram com êxito!');
