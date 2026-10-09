/**
 * JJY Sovereign Mesh - Gestão de Vizinhança e LQI (Spec 39: jjy-vizinhanca)
 * Portado da especificação oficial em Rust (crates/jjy-vizinhanca)
 * 
 * Gerencia o ciclo de vida dos vizinhos diretos (Candidato -> Ativo -> Inativo),
 * computa a métrica LQI (0 a 1000) e ordena os melhores enlaces para encaminhamento.
 */

export type EstadoVizinho = 'Candidato' | 'Ativo' | 'Inativo';
export type MeioEnlace = 'Acoustic' | 'UDP' | 'BLE' | 'WebRTC' | 'Virtual';

export interface Vizinho {
  peerId: string;
  estado: EstadoVizinho;
  qualidade: number;      // LQI 0 a 1000 (inicial = 500)
  ultimoContatoTick: number;
  promocoes: number;
  rebaixamentos: number;
  meio: MeioEnlace;
  rttMs?: number;
}

export interface ConfigVizinhanca {
  maxAtivos: number;              // Padrão: 8
  maxCandidatos: number;          // Padrão: 16
  qualidadeInicial: number;       // Padrão: 500
  minQualidadePromocao: number;   // Padrão: 300
  thresholdInativo: number;       // Ticks sem contato para virar Inativo (Padrão: 30)
  thresholdRemocao: number;       // Ticks sem contato para ser removido (Padrão: 60)
}

export const CONFIG_VIZINHANCA_PADRAO: ConfigVizinhanca = {
  maxAtivos: 8,
  maxCandidatos: 16,
  qualidadeInicial: 500,
  minQualidadePromocao: 300,
  thresholdInativo: 30,
  thresholdRemocao: 60,
};

export class GestorVizinhanca {
  private vizinhos: Map<string, Vizinho> = new Map();
  private config: ConfigVizinhanca;
  private currentTick = 0;

  constructor(config: Partial<ConfigVizinhanca> = {}) {
    this.config = { ...CONFIG_VIZINHANCA_PADRAO, ...config };
  }

  public tick(): void {
    this.currentTick++;

    // Avalia inatividade e remoção
    for (const [peerId, viz] of Array.from(this.vizinhos.entries())) {
      const dt = this.currentTick - viz.ultimoContatoTick;

      if (dt >= this.config.thresholdRemocao) {
        this.vizinhos.delete(peerId);
      } else if (dt >= this.config.thresholdInativo && viz.estado !== 'Inativo') {
        viz.estado = 'Inativo';
      }
    }
  }

  public getTickAtual(): number {
    return this.currentTick;
  }

  public adicionar(peerId: string, meio: MeioEnlace = 'Acoustic'): boolean {
    if (this.vizinhos.has(peerId)) return false;

    // Se atingiu limite de candidatos, descarta o de menor qualidade
    const candidatos = Array.from(this.vizinhos.values()).filter((v) => v.estado === 'Candidato');
    if (candidatos.length >= this.config.maxCandidatos) {
      candidatos.sort((a, b) => a.qualidade - b.qualidade);
      if (candidatos[0]) {
        this.vizinhos.delete(candidatos[0].peerId);
      }
    }

    const viz: Vizinho = {
      peerId,
      estado: 'Candidato',
      qualidade: this.config.qualidadeInicial,
      ultimoContatoTick: this.currentTick,
      promocoes: 0,
      rebaixamentos: 0,
      meio,
    };

    this.vizinhos.set(peerId, viz);
    return true;
  }

  public promover(peerId: string): boolean {
    const viz = this.vizinhos.get(peerId);
    if (!viz) return false;

    const ativosCount = Array.from(this.vizinhos.values()).filter((v) => v.estado === 'Ativo').length;
    if (ativosCount >= this.config.maxAtivos) return false;
    if (viz.qualidade < this.config.minQualidadePromocao) return false;

    if (viz.estado !== 'Ativo') {
      viz.estado = 'Ativo';
      viz.promocoes++;
      return true;
    }
    return false;
  }

  public rebaixar(peerId: string): boolean {
    const viz = this.vizinhos.get(peerId);
    if (!viz) return false;

    if (viz.estado === 'Ativo') {
      viz.estado = 'Candidato';
      viz.rebaixamentos++;
      return true;
    }
    return false;
  }

  public contato(peerId: string, rttMs?: number): void {
    const viz = this.vizinhos.get(peerId);
    if (!viz) {
      this.adicionar(peerId);
      return;
    }
    viz.ultimoContatoTick = this.currentTick;
    if (rttMs !== undefined) viz.rttMs = rttMs;
    if (viz.estado === 'Inativo') {
      viz.estado = 'Candidato';
    }
  }

  public atualizarQualidade(peerId: string, delta: number): void {
    const viz = this.vizinhos.get(peerId);
    if (!viz) return;
    viz.qualidade = Math.max(0, Math.min(1000, viz.qualidade + delta));
  }

  public vizinho(peerId: string): Vizinho | undefined {
    return this.vizinhos.get(peerId);
  }

  public todos(): Vizinho[] {
    return Array.from(this.vizinhos.values()).sort((a, b) => b.qualidade - a.qualidade);
  }

  public ativos(): Vizinho[] {
    return this.todos().filter((v) => v.estado === 'Ativo');
  }

  public candidatos(): Vizinho[] {
    return this.todos().filter((v) => v.estado === 'Candidato');
  }

  public inativos(): Vizinho[] {
    return this.todos().filter((v) => v.estado === 'Inativo');
  }

  public melhores(n: number): Vizinho[] {
    return this.ativos().slice(0, n);
  }

  public piores(n: number): Vizinho[] {
    return this.ativos().slice(-n).reverse();
  }

  public resumo(): string {
    const at = this.ativos().length;
    const can = this.candidatos().length;
    const ina = this.inativos().length;
    return `${at} ativos, ${can} candidatos, ${ina} inativos (total: ${this.vizinhos.size})`;
  }
}
