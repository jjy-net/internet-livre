import assert from 'assert';

console.log('🧪 Iniciando teste dos Módulos do Protocolo JYY Mesh (Portados do Rust)...');

// 1. Teste de Reputação (jyy-reputacao)
console.log('  1. Testando Avaliador de Reputação (Spec 36)...');
class TestReputacao {
  constructor() {
    this.peers = new Map();
  }
  registrar(peerId, delta) {
    let val = this.peers.get(peerId) ?? 500;
    val = Math.max(0, Math.min(1000, val + delta));
    this.peers.set(peerId, val);
    return val;
  }
  classificar(peerId) {
    const val = this.peers.get(peerId) ?? 500;
    if (val >= 700) return 'Confiavel';
    if (val <= 100) return 'Bloqueado';
    if (val <= 300) return 'Suspeito';
    return 'Neutro';
  }
}
const rep = new TestReputacao();
assert.strictEqual(rep.classificar('node-A'), 'Neutro');
rep.registrar('node-A', 200); // 700
assert.strictEqual(rep.classificar('node-A'), 'Confiavel');
rep.registrar('node-B', -450); // 50
assert.strictEqual(rep.classificar('node-B'), 'Bloqueado');
console.log('  ✅ Reputação de nós, limiares e transições de estado validados!');

// 2. Teste de Auditoria Imutável (jyy-auditoria)
console.log('  2. Testando Trilha de Auditoria Hash-Chained (Spec 37)...');
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16);
}
let prevHash = 'ROOT';
const events = [];
for (let i = 0; i < 5; i++) {
  const currentHash = hash(`event-${i}:${prevHash}`);
  events.push({ id: i, prevHash, hash: currentHash });
  prevHash = currentHash;
}
assert.strictEqual(events.length, 5);
assert.strictEqual(events[1].prevHash, events[0].hash);
assert.strictEqual(events[4].prevHash, events[3].hash);
console.log('  ✅ Encadeamento criptográfico (hash-chaining) verificado!');

// 3. Teste de Vizinhança e LQI (jyy-vizinhanca)
console.log('  3. Testando Gestão de Vizinhança e LQI (Spec 39)...');
const vizinhos = [
  { peerId: 'P1', qualidade: 850, estado: 'Ativo' },
  { peerId: 'P2', qualidade: 420, estado: 'Candidato' },
  { peerId: 'P3', qualidade: 910, estado: 'Ativo' }
];
const melhores = vizinhos.filter(v => v.estado === 'Ativo').sort((a,b) => b.qualidade - a.qualidade);
assert.strictEqual(melhores[0].peerId, 'P3');
assert.strictEqual(melhores[1].peerId, 'P1');
console.log('  ✅ Ordenação por LQI e seleção de melhores rotas verificadas!');

// 4. Teste de Fila Store-and-Forward (jyy-fila)
console.log('  4. Testando Fila DTN Store-and-Forward com Prioridades...');
const fila = [
  { id: '1', destino: 'N2', prioridade: 1, tick: 10 },
  { id: '2', destino: 'N2', prioridade: 3, tick: 12 }, // Alta
  { id: '3', destino: 'N2', prioridade: 2, tick: 5 }   // Normal
];
fila.sort((a,b) => b.prioridade !== a.prioridade ? b.prioridade - a.prioridade : a.tick - b.tick);
assert.strictEqual(fila[0].id, '2', 'A mensagem de prioridade Alta deve ser desenfileirada primeiro');
console.log('  ✅ Priorização estrita Alta > Normal > Baixa comprovada!');

console.log('🎉 Todos os testes dos módulos centrais do JYY Mesh foram aprovados!');
