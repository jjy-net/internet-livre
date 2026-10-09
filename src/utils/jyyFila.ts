/**
 * JYY Sovereign Mesh - Fila de Mensagens Store-and-Forward (Spec: jyy-fila)
 * Portado da especificação oficial em Rust (crates/jyy-fila)
 * 
 * Permite enfileirar mensagens criptografadas para peers offline com prioridade
 * (Alta > Normal > Baixa), TTL e controle de tentativas de reenvio.
 */

export type PrioridadeMensagem = 'Alta' | 'Normal' | 'Baixa';

export interface EntradaFila {
  id: string;
  destinoPeerId: string;
  prioridade: PrioridadeMensagem;
  conteudo: string;
  bytesTamanho: number;
  tickCriacao: number;
  timestamp: number;
  tentativas: number;
  ttlTicks: number;
}

export interface ConfigFila {
  capacidadePorPeer: number;  // Padrão: 64
  capacidadeTotal: number;    // Padrão: 1024
  ttlPadraoTicks: number;     // Padrão: 500 ticks
  maxTentativas: number;      // Padrão: 10
  maxTamanhoBytes: number;    // Padrão: 4096
}

export const CONFIG_FILA_PADRAO: ConfigFila = {
  capacidadePorPeer: 64,
  capacidadeTotal: 1024,
  ttlPadraoTicks: 500,
  maxTentativas: 10,
  maxTamanhoBytes: 4096,
};

const PESO_PRIORIDADE: Record<PrioridadeMensagem, number> = {
  Alta: 3,
  Normal: 2,
  Baixa: 1,
};

export class FilaStoreAndForward {
  private itens: EntradaFila[] = [];
  private config: ConfigFila;
  private currentTick = 0;
  private entreguesCount = 0;
  private expiradasCount = 0;

  constructor(config: Partial<ConfigFila> = {}) {
    this.config = { ...CONFIG_FILA_PADRAO, ...config };
  }

  public tick(): void {
    this.currentTick++;

    // Remove expirados por TTL
    const novosItens: EntradaFila[] = [];
    for (const item of this.itens) {
      if (this.currentTick - item.tickCriacao > item.ttlTicks) {
        this.expiradasCount++;
      } else {
        novosItens.push(item);
      }
    }
    this.itens = novosItens;
  }

  public getTickAtual(): number {
    return this.currentTick;
  }

  public enfileirar(
    destinoPeerId: string,
    conteudo: string,
    prioridade: PrioridadeMensagem = 'Normal',
    ttlTicks = this.config.ttlPadraoTicks
  ): { sucesso: boolean; id?: string; erro?: string } {
    const bytesTamanho = new Blob([conteudo]).size;

    if (bytesTamanho > this.config.maxTamanhoBytes) {
      return { sucesso: false, erro: `Mensagem excede o limite de ${this.config.maxTamanhoBytes} bytes` };
    }

    if (this.itens.length >= this.config.capacidadeTotal) {
      return { sucesso: false, erro: 'Fila global da malha cheia' };
    }

    const porPeer = this.itens.filter((i) => i.destinoPeerId === destinoPeerId);
    if (porPeer.length >= this.config.capacidadePorPeer) {
      return { sucesso: false, erro: `Fila cheia para o peer ${destinoPeerId}` };
    }

    const id = 'msg-' + Math.random().toString(36).substring(2, 8) + '-' + Date.now();
    const entrada: EntradaFila = {
      id,
      destinoPeerId,
      prioridade,
      conteudo,
      bytesTamanho,
      tickCriacao: this.currentTick,
      timestamp: Date.now(),
      tentativas: 0,
      ttlTicks,
    };

    this.itens.push(entrada);
    return { sucesso: true, id };
  }

  /**
   * Retorna a próxima mensagem mais prioritária destinada a um peer que acabou de se conectar
   */
  public desenfileirarProxima(destinoPeerId: string): EntradaFila | null {
    const candidatos = this.itens.filter((i) => i.destinoPeerId === destinoPeerId);
    if (candidatos.length === 0) return null;

    // Ordena por Prioridade (Alta > Normal > Baixa) e por FIFO (menor tickCriacao)
    candidatos.sort((a, b) => {
      const diffPrioridade = PESO_PRIORIDADE[b.prioridade] - PESO_PRIORIDADE[a.prioridade];
      if (diffPrioridade !== 0) return diffPrioridade;
      return a.tickCriacao - b.tickCriacao;
    });

    const escolhida = candidatos[0];
    escolhida.tentativas++;
    return escolhida;
  }

  public confirmarEntrega(id: string): boolean {
    const idx = this.itens.findIndex((i) => i.id === id);
    if (idx !== -1) {
      this.itens.splice(idx, 1);
      this.entreguesCount++;
      return true;
    }
    return false;
  }

  public registrarFalhaTentativa(id: string): void {
    const item = this.itens.find((i) => i.id === id);
    if (item) {
      item.tentativas++;
      if (item.tentativas >= this.config.maxTentativas) {
        this.itens = this.itens.filter((i) => i.id !== id);
        this.expiradasCount++;
      }
    }
  }

  public remover(id: string): boolean {
    const initialLen = this.itens.length;
    this.itens = this.itens.filter((i) => i.id !== id);
    return this.itens.length < initialLen;
  }

  public todas(): EntradaFila[] {
    return [...this.itens].sort((a, b) => PESO_PRIORIDADE[b.prioridade] - PESO_PRIORIDADE[a.prioridade]);
  }

  public paraPeer(destinoPeerId: string): EntradaFila[] {
    return this.itens.filter((i) => i.destinoPeerId === destinoPeerId);
  }

  public total(): number {
    return this.itens.length;
  }

  public getMetricas(): { total: number; entregues: number; expiradas: number } {
    return {
      total: this.itens.length,
      entregues: this.entreguesCount,
      expiradas: this.expiradasCount,
    };
  }
}
