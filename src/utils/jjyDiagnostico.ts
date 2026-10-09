/**
 * JJY Sovereign Mesh - Autodiagnóstico e Relatório de Saúde (Spec: jjy-diagnostico)
 * Portado da especificação oficial em Rust (crates/jjy-diagnostico)
 * 
 * Rastreia a saúde de todos os subsistemas do nó (Criptografia, Enlace, Áudio,
 * Roteamento, Fila DTN, Auditoria) e gera níveis de alerta globais.
 */

export type EstadoSaude = 'Saudavel' | 'Degradado' | 'Falha';
export type NivelAlerta = 'Normal' | 'Atencao' | 'Critico';

export interface StatusSubsistema {
  nome: string;
  estado: EstadoSaude;
  tickUltimaAtualizacao: number;
  detalhes: string;
}

export interface AlertaNo {
  id: number;
  nivel: NivelAlerta;
  subsistema: string;
  mensagem: string;
  tickCriacao: number;
  timestamp: number;
}

export interface RelatorioSaude {
  nivelAlertaGlobal: NivelAlerta;
  tickInicio: number;
  tickAtual: number;
  uptimeTicks: number;
  totalSubsistemas: number;
  numSaudaveis: number;
  numDegradados: number;
  numFalhas: number;
  subsistemas: StatusSubsistema[];
  alertasRecentes: AlertaNo[];
}

export class DiagnosticoNo {
  private subsistemas: Map<string, StatusSubsistema> = new Map();
  private alertas: AlertaNo[] = [];
  private nextAlertaId = 0;
  private tickInicio = 0;
  private currentTick = 0;

  constructor() {
    this.tickInicio = 0;
    this.currentTick = 0;

    // Inicializa subsistemas padrão do nó
    this.atualizarSubsistema('Criptografia', 'Saudavel', 'Chaves e algoritmos operacionais');
    this.atualizarSubsistema('Enlace Acústico', 'Saudavel', 'Driver de áudio e demodulação prontos');
    this.atualizarSubsistema('Enlace WebRTC/LAN', 'Saudavel', 'Interface de rede ativa');
    this.atualizarSubsistema('Roteador Mesh', 'Saudavel', 'Tabela de rotas e vizinhança operacional');
    this.atualizarSubsistema('Fila DTN', 'Saudavel', 'Buffer de mensagens offline pronto');
    this.atualizarSubsistema('Auditoria', 'Saudavel', 'Trilha imutável hash-chained ativa');
  }

  public tick(): void {
    this.currentTick++;
  }

  public getTickAtual(): number {
    return this.currentTick;
  }

  public atualizarSubsistema(nome: string, estado: EstadoSaude, detalhes: string): void {
    this.subsistemas.set(nome, {
      nome,
      estado,
      tickUltimaAtualizacao: this.currentTick,
      detalhes,
    });

    if (estado === 'Falha') {
      this.gerarAlerta('Critico', nome, `Falha crítica detectada no subsistema ${nome}: ${detalhes}`);
    } else if (estado === 'Degradado') {
      this.gerarAlerta('Atencao', nome, `Degradação operacional no subsistema ${nome}: ${detalhes}`);
    }
  }

  public gerarAlerta(nivel: NivelAlerta, subsistema: string, mensagem: string): AlertaNo {
    const alerta: AlertaNo = {
      id: this.nextAlertaId++,
      nivel,
      subsistema,
      mensagem,
      tickCriacao: this.currentTick,
      timestamp: Date.now(),
    };
    this.alertas.unshift(alerta);
    if (this.alertas.length > 50) this.alertas.pop();
    return alerta;
  }

  public obterRelatorio(): RelatorioSaude {
    const subs = Array.from(this.subsistemas.values());
    const numSaudaveis = subs.filter((s) => s.estado === 'Saudavel').length;
    const numDegradados = subs.filter((s) => s.estado === 'Degradado').length;
    const numFalhas = subs.filter((s) => s.estado === 'Falha').length;

    let nivelAlertaGlobal: NivelAlerta = 'Normal';
    if (numFalhas > 0) {
      nivelAlertaGlobal = 'Critico';
    } else if (numDegradados > 0) {
      nivelAlertaGlobal = 'Atencao';
    }

    return {
      nivelAlertaGlobal,
      tickInicio: this.tickInicio,
      tickAtual: this.currentTick,
      uptimeTicks: this.currentTick - this.tickInicio,
      totalSubsistemas: subs.length,
      numSaudaveis,
      numDegradados,
      numFalhas,
      subsistemas: subs,
      alertasRecentes: this.alertas.slice(0, 10),
    };
  }

  public limparAlertas(): void {
    this.alertas = [];
  }
}
