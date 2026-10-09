/**
 * JYY Sovereign Mesh - Agendador Tático de Tarefas & EMCON (Spec: jyy-agenda)
 * Portado da especificação oficial em Rust (crates/jyy-agenda)
 * 
 * Permite agendar transmissões e ações por ticks ou tempo real (UmaVez ou Periódica),
 * gerenciar janelas de silêncio de rádio/acústico (EMCON - Emission Control) e disparos.
 */

export type RepeticaoTarefa = 'UmaVez' | 'Periodica';
export type EstadoTarefa = 'Ativa' | 'Pausada' | 'Concluida';

export interface TarefaAgendada {
  id: number;
  tag: string;
  repeticao: RepeticaoTarefa;
  intervaloTicks: number;
  tickProximo: number;
  estado: EstadoTarefa;
  totalExecucoes: number;
  descricao: string;
  payload?: string;
}

export interface DisparoAgenda {
  tarefaId: number;
  tag: string;
  tick: number;
  execucaoNumero: number;
  payload?: string;
}

export class AgendaTarefas {
  private tarefas: TarefaAgendada[] = [];
  private nextId = 0;
  private currentTick = 0;
  private emconSilencioAtivo = false; // Controle de Silêncio de Emissão (EMCON)

  public tick(): DisparoAgenda[] {
    this.currentTick++;
    const disparos: DisparoAgenda[] = [];

    // Se estiver em silêncio de emissão total (EMCON), posterga tarefas ativas
    if (this.emconSilencioAtivo) {
      return disparos;
    }

    for (const t of this.tarefas) {
      if (t.estado === 'Ativa' && this.currentTick >= t.tickProximo) {
        t.totalExecucoes++;
        disparos.push({
          tarefaId: t.id,
          tag: t.tag,
          tick: this.currentTick,
          execucaoNumero: t.totalExecucoes,
          payload: t.payload,
        });

        if (t.repeticao === 'Periodica') {
          t.tickProximo = this.currentTick + t.intervaloTicks;
        } else {
          t.estado = 'Concluida';
        }
      }
    }

    return disparos;
  }

  public getTickAtual(): number {
    return this.currentTick;
  }

  public isEmconAtivo(): boolean {
    return this.emconSilencioAtivo;
  }

  public setEmconSilencio(ativo: boolean): void {
    this.emconSilencioAtivo = ativo;
  }

  public agendarUmaVez(tag: string, emTicks: number, descricao: string, payload?: string): number {
    const id = this.nextId++;
    const tarefa: TarefaAgendada = {
      id,
      tag,
      repeticao: 'UmaVez',
      intervaloTicks: emTicks,
      tickProximo: this.currentTick + emTicks,
      estado: 'Ativa',
      totalExecucoes: 0,
      descricao,
      payload,
    };
    this.tarefas.push(tarefa);
    return id;
  }

  public agendarPeriodica(tag: string, intervaloTicks: number, descricao: string, payload?: string): number {
    const id = this.nextId++;
    const tarefa: TarefaAgendada = {
      id,
      tag,
      repeticao: 'Periodica',
      intervaloTicks: Math.max(1, intervaloTicks),
      tickProximo: this.currentTick + Math.max(1, intervaloTicks),
      estado: 'Ativa',
      totalExecucoes: 0,
      descricao,
      payload,
    };
    this.tarefas.push(tarefa);
    return id;
  }

  public pausar(id: number): boolean {
    const t = this.tarefas.find((x) => x.id === id);
    if (t && t.estado === 'Ativa') {
      t.estado = 'Pausada';
      return true;
    }
    return false;
  }

  public reativar(id: number): boolean {
    const t = this.tarefas.find((x) => x.id === id);
    if (t && t.estado === 'Pausada') {
      t.estado = 'Ativa';
      t.tickProximo = this.currentTick + t.intervaloTicks;
      return true;
    }
    return false;
  }

  public cancelar(id: number): boolean {
    const initLen = this.tarefas.length;
    this.tarefas = this.tarefas.filter((x) => x.id !== id);
    return this.tarefas.length < initLen;
  }

  public todas(): TarefaAgendada[] {
    return [...this.tarefas];
  }
}
