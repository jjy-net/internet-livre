/**
 * JJY Sovereign Mesh - Trilha de Auditoria Imutável (Spec 37: jjy-auditoria)
 * Portado da especificação oficial em Rust (crates/jjy-auditoria)
 * 
 * Registra eventos operacionais e de segurança de forma determinística
 * com encadeamento de hash (hash-chaining) imutável.
 */

export type GravidadeAuditoria = 'Info' | 'Aviso' | 'Erro' | 'Critico';

export type OrigemAuditoria =
  | 'Malha'
  | 'Reputacao'
  | 'Governanca'
  | 'Guard'
  | 'Multi'
  | 'Plugin'
  | 'Devmgr'
  | 'Estatistica'
  | 'Audio'
  | 'Sessao';

export interface EventoAuditoria {
  id: number;
  tick: number;
  timestamp: number;
  gravidade: GravidadeAuditoria;
  origem: OrigemAuditoria;
  peerId?: string;
  descricao: string;
  hashAnterior: string;
  hash: string;
}

export interface ConfigAuditoria {
  capacidade: number;               // Tamanho do buffer circular FIFO (padrão: 500)
  gravidadeMinima: GravidadeAuditoria; // Padrão: 'Info'
}

const ORDEM_GRAVIDADE: Record<GravidadeAuditoria, number> = {
  Info: 0,
  Aviso: 1,
  Erro: 2,
  Critico: 3,
};

function simpleHash(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
}

export class RegistroAuditoria {
  private eventos: EventoAuditoria[] = [];
  private nextId = 0;
  private currentTick = 0;
  private descartadosCount = 0;
  private config: ConfigAuditoria;
  private lastHash = '0000000000000000';

  constructor(config: Partial<ConfigAuditoria> = {}) {
    this.config = {
      capacidade: config.capacidade ?? 500,
      gravidadeMinima: config.gravidadeMinima ?? 'Info',
    };
  }

  public tick(): void {
    this.currentTick++;
  }

  public getTickAtual(): number {
    return this.currentTick;
  }

  public registrar(
    gravidade: GravidadeAuditoria,
    origem: OrigemAuditoria,
    peerId: string | undefined,
    descricao: string
  ): EventoAuditoria | null {
    if (ORDEM_GRAVIDADE[gravidade] < ORDEM_GRAVIDADE[this.config.gravidadeMinima]) {
      return null;
    }

    const id = this.nextId++;
    const timestamp = Date.now();
    const hashAnterior = this.lastHash;
    const rawData = `${id}:${this.currentTick}:${gravidade}:${origem}:${peerId || ''}:${descricao}:${hashAnterior}`;
    const hash = simpleHash(rawData);
    this.lastHash = hash;

    const evento: EventoAuditoria = {
      id,
      tick: this.currentTick,
      timestamp,
      gravidade,
      origem,
      peerId,
      descricao,
      hashAnterior,
      hash,
    };

    if (this.eventos.length >= this.config.capacidade) {
      this.eventos.shift();
      this.descartadosCount++;
    }

    this.eventos.push(evento);
    return evento;
  }

  public info(origem: OrigemAuditoria, descricao: string, peerId?: string): EventoAuditoria | null {
    return this.registrar('Info', origem, peerId, descricao);
  }

  public aviso(origem: OrigemAuditoria, descricao: string, peerId?: string): EventoAuditoria | null {
    return this.registrar('Aviso', origem, peerId, descricao);
  }

  public erro(origem: OrigemAuditoria, descricao: string, peerId?: string): EventoAuditoria | null {
    return this.registrar('Erro', origem, peerId, descricao);
  }

  public critico(origem: OrigemAuditoria, descricao: string, peerId?: string): EventoAuditoria | null {
    return this.registrar('Critico', origem, peerId, descricao);
  }

  public consultar(id: number): EventoAuditoria | undefined {
    return this.eventos.find((e) => e.id === id);
  }

  public todos(): EventoAuditoria[] {
    return [...this.eventos];
  }

  public ultimos(n: number): EventoAuditoria[] {
    return this.eventos.slice(-n).reverse();
  }

  public porGravidade(minGravidade: GravidadeAuditoria): EventoAuditoria[] {
    const minVal = ORDEM_GRAVIDADE[minGravidade];
    return this.eventos.filter((e) => ORDEM_GRAVIDADE[e.gravidade] >= minVal);
  }

  public porOrigem(origem: OrigemAuditoria): EventoAuditoria[] {
    return this.eventos.filter((e) => e.origem === origem);
  }

  public porPeer(peerId: string): EventoAuditoria[] {
    return this.eventos.filter((e) => e.peerId === peerId);
  }

  public getDescartados(): number {
    return this.descartadosCount;
  }

  public limpar(): void {
    this.eventos = [];
  }
}
