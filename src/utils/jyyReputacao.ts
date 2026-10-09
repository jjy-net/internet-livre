/**
 * JYY Sovereign Mesh - Módulo de Reputação de Peers (Spec 36: jyy-reputacao)
 * Portado da especificação oficial em Rust (crates/jyy-reputacao)
 * 
 * Atribui e calcula dinamicamente a confiança de cada nó vizinho (PeerId)
 * através de pontuações de 0 a 1000 (inicial = 500) e estados de classificação:
 * - Confiavel (>= 700)
 * - Neutro (301 a 699)
 * - Suspeito (101 a 300)
 * - Bloqueado (<= 100)
 */

export type ClassificacaoPeer = 'Confiavel' | 'Neutro' | 'Suspeito' | 'Bloqueado';

export interface PontuacaoPeer {
  peerId: string;
  valor: number;            // 0 a 1000
  sucessos: number;         // Transmissões bem-sucedidas
  falhas: number;           // Falhas de entrega
  cooperacoes: number;      // Pacotes encaminhados como relay
  infracoes: number;        // Anomalias ou pacotes corrompidos/violados
  ultimoEventoTick: number; // Tick lógico da última interação
  classificacao: ClassificacaoPeer;
}

export interface ConfigReputacao {
  ganhoSucesso: number;      // Padrão: 2
  perdaFalha: number;        // Padrão: 5
  ganhoCooperacao: number;   // Padrão: 1
  perdaInfracao: number;     // Padrão: 50
  decaimento: number;        // Padrão: 1 ponto em direção a 500 por tick de decaimento
  limiarConfiavel: number;   // Padrão: 700
  limiarSuspeito: number;    // Padrão: 300
  limiarBloqueado: number;   // Padrão: 100
  pontuacaoInicial: number;  // Padrão: 500
}

export const CONFIG_REPUTACAO_PADRAO: ConfigReputacao = {
  ganhoSucesso: 2,
  perdaFalha: 5,
  ganhoCooperacao: 1,
  perdaInfracao: 50,
  decaimento: 1,
  limiarConfiavel: 700,
  limiarSuspeito: 300,
  limiarBloqueado: 100,
  pontuacaoInicial: 500,
};

export class AvaliadorReputacao {
  private peers: Map<string, PontuacaoPeer> = new Map();
  private config: ConfigReputacao;
  private currentTick = 0;

  constructor(config: Partial<ConfigReputacao> = {}) {
    this.config = { ...CONFIG_REPUTACAO_PADRAO, ...config };
  }

  public tick(): void {
    this.currentTick++;
  }

  public getTickAtual(): number {
    return this.currentTick;
  }

  private obterOuCriar(peerId: string): PontuacaoPeer {
    let p = this.peers.get(peerId);
    if (!p) {
      p = {
        peerId,
        valor: this.config.pontuacaoInicial,
        sucessos: 0,
        falhas: 0,
        cooperacoes: 0,
        infracoes: 0,
        ultimoEventoTick: this.currentTick,
        classificacao: 'Neutro',
      };
      this.peers.set(peerId, p);
    }
    return p;
  }

  private atualizarClassificacao(p: PontuacaoPeer): void {
    if (p.valor >= this.config.limiarConfiavel) {
      p.classificacao = 'Confiavel';
    } else if (p.valor <= this.config.limiarBloqueado) {
      p.classificacao = 'Bloqueado';
    } else if (p.valor <= this.config.limiarSuspeito) {
      p.classificacao = 'Suspeito';
    } else {
      p.classificacao = 'Neutro';
    }
  }

  /**
   * Registra entrega bem-sucedida (+2 pontos por padrão)
   */
  public registrarSucesso(peerId: string): void {
    const p = this.obterOuCriar(peerId);
    p.sucessos++;
    p.ultimoEventoTick = this.currentTick;
    p.valor = Math.min(1000, p.valor + this.config.ganhoSucesso);
    this.atualizarClassificacao(p);
  }

  /**
   * Registra falha de entrega (-5 pontos por padrão)
   */
  public registrarFalha(peerId: string): void {
    const p = this.obterOuCriar(peerId);
    p.falhas++;
    p.ultimoEventoTick = this.currentTick;
    p.valor = Math.max(0, p.valor - this.config.perdaFalha);
    this.atualizarClassificacao(p);
  }

  /**
   * Registra cooperação de roteamento relay (+1 ponto por padrão)
   */
  public registrarCooperacao(peerId: string): void {
    const p = this.obterOuCriar(peerId);
    p.cooperacoes++;
    p.ultimoEventoTick = this.currentTick;
    p.valor = Math.min(1000, p.valor + this.config.ganhoCooperacao);
    this.atualizarClassificacao(p);
  }

  /**
   * Registra infração grave ou corrupção de pacote (-50 pontos por padrão)
   */
  public registrarInfracao(peerId: string): void {
    const p = this.obterOuCriar(peerId);
    p.infracoes++;
    p.ultimoEventoTick = this.currentTick;
    p.valor = Math.max(0, p.valor - this.config.perdaInfracao);
    this.atualizarClassificacao(p);
  }

  /**
   * Decaimento temporal: puxa reputações altas ou baixas suavemente em direção à neutralidade (500)
   */
  public decair(): void {
    for (const p of this.peers.values()) {
      if (p.valor > this.config.pontuacaoInicial) {
        p.valor = Math.max(this.config.pontuacaoInicial, p.valor - this.config.decaimento);
      } else if (p.valor < this.config.pontuacaoInicial) {
        p.valor = Math.min(this.config.pontuacaoInicial, p.valor + this.config.decaimento);
      }
      this.atualizarClassificacao(p);
    }
  }

  /**
   * Reabilita um nó penalizado, restaurando-o para Neutro (500)
   */
  public perdoar(peerId: string): boolean {
    const p = this.peers.get(peerId);
    if (!p) return false;
    p.valor = this.config.pontuacaoInicial;
    p.falhas = 0;
    p.infracoes = 0;
    p.classificacao = 'Neutro';
    return true;
  }

  public classificar(peerId: string): ClassificacaoPeer {
    const p = this.peers.get(peerId);
    return p ? p.classificacao : 'Neutro';
  }

  public consultar(peerId: string): PontuacaoPeer | undefined {
    return this.peers.get(peerId);
  }

  public todos(): PontuacaoPeer[] {
    return Array.from(this.peers.values()).sort((a, b) => b.valor - a.valor);
  }

  public confiaveis(): PontuacaoPeer[] {
    return this.todos().filter((p) => p.classificacao === 'Confiavel');
  }

  public suspeitos(): PontuacaoPeer[] {
    return this.todos().filter((p) => p.classificacao === 'Suspeito');
  }

  public bloqueados(): PontuacaoPeer[] {
    return this.todos().filter((p) => p.classificacao === 'Bloqueado');
  }

  public remover(peerId: string): boolean {
    return this.peers.delete(peerId);
  }
}
