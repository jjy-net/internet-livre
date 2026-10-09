/**
 * JYY Sovereign Mesh & DataLink Pro - Roteador de Ferramentas MCP (Model Context Protocol)
 * 
 * Permite que qualquer LLM (local ou em nuvem) descubra, consulte e execute ferramentas
 * operacionais e táticas no sistema com verificação de segurança e governança.
 */

export interface McpToolParameter {
  type: string;
  description: string;
  required?: boolean;
  enum?: string[];
  default?: unknown;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  category: 'mesh' | 'containment' | 'cctv' | 'defense' | 'audit' | 'telemetry';
  parameters: {
    type: 'object';
    properties: Record<string, McpToolParameter>;
    required: string[];
  };
}

export interface McpToolExecutionRequest {
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface McpToolExecutionResult {
  toolName: string;
  success: boolean;
  result?: unknown;
  error?: string;
  timestamp: number;
}

/**
 * Catálogo Oficial de Ferramentas MCP do Sistema
 */
export const MCP_TOOLS_CATALOG: McpToolDefinition[] = [
  {
    name: 'soc_get_network_telemetry',
    description: 'Obtém a telemetria completa da rede em tempo real: estações conectadas, status de lockdown DEFCON 1, quarentenas, latências, e métricas do WAF/Fail2Ban.',
    category: 'telemetry',
    parameters: {
      type: 'object',
      properties: {
        filterHighRiskOnly: {
          type: 'boolean',
          description: 'Se true, filtra apenas nós com pontuação de risco elevada (anomalias, spoofing ou jitter).',
        },
      },
      required: [],
    },
  },
  {
    name: 'soc_trigger_lockdown',
    description: 'Ativa ou desativa o modo de emergência LOCKDOWN DEFCON 1 na malha, suspendendo todo o tráfego de dados não-administrativo.',
    category: 'containment',
    parameters: {
      type: 'object',
      properties: {
        enable: {
          type: 'boolean',
          description: 'true para ativar o lockdown DEFCON 1, false para restaurar o tráfego normal.',
        },
        reason: {
          type: 'string',
          description: 'Motivo administrativo para o lockdown que será transmitido aos nós.',
        },
      },
      required: ['enable'],
    },
  },
  {
    name: 'soc_quarantine_node',
    description: 'Coloca um nó ou estação cliente em Quarentena Criptográfica, isolando-o de transmitir para outros nós na malha.',
    category: 'containment',
    parameters: {
      type: 'object',
      properties: {
        clientId: {
          type: 'string',
          description: 'O Client ID único da estação alvo.',
        },
        reason: {
          type: 'string',
          description: 'Motivo da quarentena preventiva.',
        },
      },
      required: ['clientId'],
    },
  },
  {
    name: 'soc_release_quarantine',
    description: 'Remove um nó da Quarentena Criptográfica, restaurando sua conectividade normal.',
    category: 'containment',
    parameters: {
      type: 'object',
      properties: {
        clientId: {
          type: 'string',
          description: 'O Client ID único da estação.',
        },
      },
      required: ['clientId'],
    },
  },
  {
    name: 'soc_kill_sensors',
    description: 'Emite comando de segurança para desligar remotamente câmera, microfone e compartilhamento de tela de uma estação cliente.',
    category: 'containment',
    parameters: {
      type: 'object',
      properties: {
        clientId: {
          type: 'string',
          description: 'O Client ID único da estação alvo.',
        },
      },
      required: ['clientId'],
    },
  },
  {
    name: 'soc_freeze_screen',
    description: 'Bloqueia e congela a tela do terminal remoto exibindo um banner administrativo de segurança.',
    category: 'containment',
    parameters: {
      type: 'object',
      properties: {
        clientId: {
          type: 'string',
          description: 'O Client ID único da estação alvo.',
        },
        message: {
          type: 'string',
          description: 'Mensagem de bloqueio a ser exibida.',
        },
      },
      required: ['clientId'],
    },
  },
  {
    name: 'soc_eject_session',
    description: 'Aciona o Kill-Switch de sessão, derrubando a conexão WebSocket do invasor imediatamente.',
    category: 'containment',
    parameters: {
      type: 'object',
      properties: {
        clientId: {
          type: 'string',
          description: 'O Client ID da estação a ser desconectada.',
        },
        reason: {
          type: 'string',
          description: 'Justificativa do término da sessão.',
        },
      },
      required: ['clientId'],
    },
  },
  {
    name: 'soc_ban_ip',
    description: 'Insere o endereço IP na lista negra do firewall Fail2Ban, descartando handshakes na camada de transporte.',
    category: 'defense',
    parameters: {
      type: 'object',
      properties: {
        ip: {
          type: 'string',
          description: 'Endereço IP a ser bloqueado.',
        },
        reason: {
          type: 'string',
          description: 'Motivo do banimento.',
        },
        durationHours: {
          type: 'number',
          description: 'Tempo de duração do banimento em horas (ex: 24).',
        },
      },
      required: ['ip'],
    },
  },
  {
    name: 'jyy_verify_audit_chain',
    description: 'Executa verificação criptográfica completa (SHA Hash-Chain Spec 37) em todos os blocos registrados do ledger.',
    category: 'audit',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'jyy_inspect_peer_reputation',
    description: 'Consulta a pontuação de reputação Soberana JYY (0 a 1000 - Spec 36), infrações, sucessos e cooperações de um nó.',
    category: 'mesh',
    parameters: {
      type: 'object',
      properties: {
        peerId: {
          type: 'string',
          description: 'Identificador do nó (Client ID).',
        },
      },
      required: ['peerId'],
    },
  },
  {
    name: 'jyy_penalize_reputation',
    description: 'Aplica penalidade na pontuação de reputação JYY de um nó por comportamento anômalo ou pacote corrompido.',
    category: 'mesh',
    parameters: {
      type: 'object',
      properties: {
        peerId: {
          type: 'string',
          description: 'Identificador do nó.',
        },
        reason: {
          type: 'string',
          description: 'Motivo da penalidade.',
        },
      },
      required: ['peerId'],
    },
  },
  {
    name: 'soc_cctv_request_snapshot',
    description: 'Solicita captura e envio de foto remota da câmera de um terminal para inspeção tática no painel CFTV.',
    category: 'cctv',
    parameters: {
      type: 'object',
      properties: {
        clientId: {
          type: 'string',
          description: 'O Client ID da estação que deve capturar a foto.',
        },
      },
      required: ['clientId'],
    },
  },
];

/**
 * Converte o catálogo MCP para o esquema padrão de Tool Calling da OpenAI / Ollama / Groq
 */
export function convertMcpToOpenAiTools(tools: McpToolDefinition[] = MCP_TOOLS_CATALOG) {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

/**
 * Converte o catálogo MCP para o formato do Google Gemini Function Declarations
 */
export function convertMcpToGeminiTools(tools: McpToolDefinition[] = MCP_TOOLS_CATALOG) {
  return [
    {
      function_declarations: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      })),
    },
  ];
}

/**
 * Converte o catálogo MCP para formato de texto de sistema (para modelos que não suportam tools nativas)
 */
export function formatMcpToolsForSystemPrompt(tools: McpToolDefinition[] = MCP_TOOLS_CATALOG): string {
  return tools
    .map((t) => {
      const params = Object.entries(t.parameters.properties)
        .map(([k, v]) => `${k} (${v.type}${v.required ? ', obrigatório' : ''}): ${v.description}`)
        .join('; ');
      return `- **${t.name}**: ${t.description}\n  Parâmetros: ${params || 'Nenhum'}`;
    })
    .join('\n\n');
}
