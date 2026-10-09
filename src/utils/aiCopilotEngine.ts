/**
 * JJY Sovereign Mesh & DataLink Pro - Motor de IA Copilot Tático Universal (SOC Ally)
 * 
 * Suporte Universal:
 * - 100% Offline: Motor Heurístico Nativo, Ollama Local e LM Studio / llama.cpp / Jan.ai
 * - Nuvem: Google Gemini, OpenAI, Anthropic Claude, Groq, DeepSeek, OpenRouter e Endpoints Customizados
 * - Descoberta Automática de Modelos Locais via HTTP (/api/tags e /v1/models)
 * - Integração profunda com MCP (Model Context Protocol) para Tool Calling
 */

import {
  MCP_TOOLS_CATALOG,
  McpToolDefinition,
  convertMcpToOpenAiTools,
  convertMcpToGeminiTools,
  formatMcpToolsForSystemPrompt,
} from './mcpRouter';
import {
  runMobileOfflineInference,
  MOBILE_OFFLINE_MODELS,
  MobileDeviceCapabilities,
  detectMobileDeviceCapabilities,
  isMobileModelCached,
  cacheMobileModelForOffline,
  removeCachedMobileModel,
} from './mobileOfflineAi';

export interface CopilotLearnedRule {
  id: string;
  rule: string;
  category: 'security' | 'architecture' | 'network' | 'admin_note';
  createdAt: number;
}

export interface CopilotActionSuggestion {
  type: 'quarantine' | 'unquarantine' | 'lockdown' | 'eject' | 'kill_sensors' | 'freeze_screen' | 'ban_ip' | 'jjy_penalize' | 'jjy_pardon';
  label: string;
  targetId?: string;
  targetName?: string;
  payload?: Record<string, unknown>;
  isMcpExecution?: boolean;
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  actions?: CopilotActionSuggestion[];
  providerUsed?: CopilotProvider;
  modelUsed?: string;
  mcpToolsInvoked?: { toolName: string; arguments: Record<string, unknown> }[];
  metrics?: {
    responseTimeMs?: number;
    tokensPerSecond?: number;
    hardwareUsed?: string;
    isFullyOffline?: boolean;
  };
}

export type CopilotProvider =
  | 'offline'
  | 'mobile_offline'
  | 'ollama'
  | 'lmstudio'
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'groq'
  | 'deepseek'
  | 'openrouter'
  | 'together'
  | 'mistral'
  | 'perplexity'
  | 'huggingface'
  | 'xai'
  | 'custom';

export interface CopilotConfig {
  provider: CopilotProvider;
  activeModel: string;
  // Parâmetros de Inferência
  temperature: number;
  topP: number;
  maxTokens: number;
  // Mobile Offline AI
  mobileModelId: string;
  // Ollama
  ollamaEndpoint: string;
  ollamaModel: string;
  // LM Studio / Local OpenAI Compatible
  lmstudioEndpoint: string;
  lmstudioModel: string;
  // Gemini
  geminiApiKey: string;
  geminiModel: string;
  // OpenAI
  openaiApiKey: string;
  openaiModel: string;
  openaiEndpoint: string;
  // Anthropic Claude
  anthropicApiKey: string;
  anthropicModel: string;
  // Groq
  groqApiKey: string;
  groqModel: string;
  // DeepSeek
  deepseekApiKey: string;
  deepseekModel: string;
  // OpenRouter
  openrouterApiKey: string;
  openrouterModel: string;
  // Together AI
  togetherApiKey: string;
  togetherModel: string;
  // Mistral AI
  mistralApiKey: string;
  mistralModel: string;
  // Perplexity AI
  perplexityApiKey: string;
  perplexityModel: string;
  // HuggingFace
  huggingfaceApiKey: string;
  huggingfaceModel: string;
  // xAI (Grok)
  xaiApiKey: string;
  xaiModel: string;
  // Custom API
  customEndpoint: string;
  customApiKey: string;
  customModel: string;
  // MCP & Comportamento
  enableMcpTools: boolean;
  autoAnalyzeAnomalies: boolean;
  discoveredLocalModels: string[];
  // Controle de Energia e Modelos Instalados pelo Painel
  isAiPowered: boolean;
  customLocalModels: CustomLocalModelRecord[];
}

export interface CustomLocalModelRecord {
  id: string;
  name: string;
  fileName?: string;
  source: 'ollama_download' | 'gguf_file' | 'custom_url';
  sizeBytes?: number;
  sizeFormatted?: string;
  installedAt: number;
  status: 'installed' | 'installing' | 'failed';
  downloadProgress?: number;
  quantization?: string;
}

export const DEFAULT_COPILOT_CONFIG: CopilotConfig = {
  provider: 'offline',
  activeModel: 'Nativo Offline (Zero-Config)',
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 2048,
  mobileModelId: 'sentinel-nano-heuristic',
  ollamaEndpoint: 'http://localhost:11434',
  ollamaModel: 'llama3:latest',
  lmstudioEndpoint: 'http://localhost:1234/v1',
  lmstudioModel: 'local-model',
  geminiApiKey: '',
  geminiModel: 'gemini-1.5-flash',
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  openaiEndpoint: 'https://api.openai.com/v1',
  anthropicApiKey: '',
  anthropicModel: 'claude-3-5-haiku-20241022',
  groqApiKey: '',
  groqModel: 'llama-3.3-70b-versatile',
  deepseekApiKey: '',
  deepseekModel: 'deepseek-chat',
  openrouterApiKey: '',
  openrouterModel: 'openrouter/auto',
  togetherApiKey: '',
  togetherModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  mistralApiKey: '',
  mistralModel: 'mistral-large-latest',
  perplexityApiKey: '',
  perplexityModel: 'sonar',
  huggingfaceApiKey: '',
  huggingfaceModel: 'meta-llama/Llama-3.2-3B-Instruct',
  xaiApiKey: '',
  xaiModel: 'grok-beta',
  customEndpoint: 'http://localhost:8080/v1',
  customApiKey: '',
  customModel: 'default',
  enableMcpTools: true,
  autoAnalyzeAnomalies: true,
  discoveredLocalModels: [],
  isAiPowered: true,
  customLocalModels: [],
};

const CONFIG_STORAGE_KEY = 'datalink_copilot_config_v2';
const MEMORY_STORAGE_KEY = 'datalink_copilot_memory';
const CUSTOM_MODELS_STORAGE_KEY = 'datalink_copilot_custom_models';

export function loadCopilotConfig(): CopilotConfig {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) return { ...DEFAULT_COPILOT_CONFIG, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_COPILOT_CONFIG;
}

export function saveCopilotConfig(cfg: CopilotConfig): void {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cfg));
  } catch {}
}

export function loadCustomLocalModels(): CustomLocalModelRecord[] {
  try {
    const raw = localStorage.getItem(CUSTOM_MODELS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveCustomLocalModels(models: CustomLocalModelRecord[]): void {
  try {
    localStorage.setItem(CUSTOM_MODELS_STORAGE_KEY, JSON.stringify(models));
  } catch {}
}

/**
 * Faz download e instalação de qualquer modelo no Ollama com streaming de progresso
 */
export async function pullOllamaModelStream(
  endpoint: string = 'http://localhost:11434',
  modelName: string,
  onUpdate: (data: { status: string; completed?: number; total?: number; percent?: number }) => void
): Promise<boolean> {
  const cleanEndpoint = endpoint.replace(/\/+$/, '');
  const url = `${cleanEndpoint}/api/pull`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: modelName, stream: true }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Falha ao iniciar download no Ollama (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        let percent: number | undefined;
        if (json.total && json.completed && json.total > 0) {
          percent = Math.round((json.completed / json.total) * 100);
        }
        onUpdate({
          status: json.status || 'Instalando camadas...',
          completed: json.completed,
          total: json.total,
          percent,
        });
      } catch {}
    }
  }

  return true;
}

/**
 * Remove/Desinstala um modelo local do Ollama
 */
export async function deleteOllamaModel(
  endpoint: string = 'http://localhost:11434',
  modelName: string
): Promise<boolean> {
  const cleanEndpoint = endpoint.replace(/\/+$/, '');
  const url = `${cleanEndpoint}/api/delete`;

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function loadLearnedRules(): CopilotLearnedRule[] {
  try {
    const raw = localStorage.getItem(MEMORY_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [
    {
      id: 'default_rule_1',
      rule: 'O Administrador Central é a autoridade máxima e única com permissão de disparo de DEFCON 1 e CFTV.',
      category: 'security',
      createdAt: Date.now() - 3600000,
    },
    {
      id: 'default_rule_2',
      rule: 'Estações com latência > 1500ms ou spoofing de GPS (0,0) devem ser isoladas em quarentena preventiva.',
      category: 'security',
      createdAt: Date.now() - 3600000,
    },
    {
      id: 'default_rule_3',
      rule: 'O canal acústico opera em 18-20kHz com fallback sísmico no Giroscópio se o microfone for bloqueado.',
      category: 'architecture',
      createdAt: Date.now() - 3600000,
    },
  ];
}

export function saveLearnedRules(rules: CopilotLearnedRule[]): void {
  try {
    localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(rules));
  } catch {}
}

export function addLearnedRule(ruleText: string, category: CopilotLearnedRule['category'] = 'admin_note'): CopilotLearnedRule {
  const rules = loadLearnedRules();
  const newRule: CopilotLearnedRule = {
    id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    rule: ruleText.trim(),
    category,
    createdAt: Date.now(),
  };
  rules.push(newRule);
  saveLearnedRules(rules);
  return newRule;
}

export function removeLearnedRule(id: string): void {
  const rules = loadLearnedRules().filter((r) => r.id !== id);
  saveLearnedRules(rules);
}

// ============================================================================
// DESCOBERTA AUTOMÁTICA DE MODELOS LOCAIS (Ollama & LM Studio / llama.cpp)
// ============================================================================

/**
 * Consulta a API local do Ollama para listar todos os modelos baixados na máquina
 */
export async function fetchLocalOllamaModels(endpoint: string = 'http://localhost:11434'): Promise<string[]> {
  const cleanEndpoint = endpoint.replace(/\/+$/, '');
  const url = `${cleanEndpoint}/api/tags`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data.models)) {
      return data.models.map((m: { name?: string; model?: string }) => m.name || m.model || '').filter(Boolean);
    }
  } catch {
    clearTimeout(timeoutId);
  }
  return [];
}

/**
 * Consulta qualquer endpoint compatível com OpenAI (LM Studio, LocalAI, Jan, vLLM)
 */
export async function fetchOpenAiCompatibleModels(baseUrl: string, apiKey?: string): Promise<string[]> {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const url = `${cleanBase}/models`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);

  try {
    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data.data)) {
      return data.data.map((m: { id?: string }) => m.id || '').filter(Boolean);
    }
  } catch {
    clearTimeout(timeoutId);
  }
  return [];
}

// ============================================================================
// CONTEXT BUILDER & KNOWLEDGE SYSTEM
// ============================================================================

export interface LiveSystemSnapshot {
  serverUrl: string;
  isLockdown: boolean;
  quarantinedCount: number;
  quarantinedList: string[];
  connectedStations: {
    clientId: string;
    name: string;
    ip?: string;
    platform?: string;
    latency?: number | null;
    isCamera?: boolean;
    isMic?: boolean;
    isScreen?: boolean;
  }[];
  bannedIpsCount: number;
  bannedIps: string[];
  securityStats: {
    blockedRequests: number;
    intrusionsDetected: number;
    rateLimitViolations: number;
    failedLogins: number;
  };
  auditTrailCount: number;
}

export function buildSystemKnowledgePrompt(snapshot: LiveSystemSnapshot, includeMcpCatalog = true): string {
  const rules = loadLearnedRules();
  const rulesText = rules.map((r, i) => `${i + 1}. [${r.category.toUpperCase()}] ${r.rule}`).join('\n');

  const stationsSummary = snapshot.connectedStations.length > 0
    ? snapshot.connectedStations.map((s) => 
        `- Estação "${s.name}" (ID: \`${s.clientId}\`, IP: \`${s.ip || '127.0.0.1'}\`, OS: ${s.platform || 'N/A'}, Latência: ${s.latency ?? '—'}ms, Câmera: ${s.isCamera ? 'Ativa' : 'Inativa'}, Mic: ${s.isMic ? 'Ativo' : 'Inativo'})`
      ).join('\n')
    : 'Nenhuma estação cliente conectada no momento.';

  const mcpSection = includeMcpCatalog
    ? `\n### 🛠️ CATÁLOGO DE FERRAMENTAS MCP DISPONÍVEIS:\n${formatMcpToolsForSystemPrompt(MCP_TOOLS_CATALOG)}\n`
    : '';

  return `Você é o **Sentinel AI**, copiloto de cibersegurança e aliado tático do Administrador do ecossistema DataLink Pro & JJY Sovereign Mesh.
Sua missão é auxiliar no controle de usuários, detecção de ameaças, prevenção de fraudes, integridade de dados e execução tática de segurança.

### 🏛️ ARQUITETURA DO SISTEMA:
1. **JJY Sovereign Mesh Protocol (Portado do Rust):**
   - **Spec 36 (Reputação 0 a 1000):** Confiável (>=700), Neutro (301-699), Suspeito (101-300), Bloqueado (<=100). Penalidades por violação (-50) e bônus por cooperação (+1).
   - **Spec 37 (Auditoria Hash-Chain):** Trilha imutável encadeada por SHA.
   - **Spec 38 (Fila DTN Store-and-Forward):** Entrega tolerante a atraso com prioridades e TTL.
   - **Spec 39 (Vizinhança & LQI):** Qualidade de enlace acústico e RF.
   - **Spec 40/41:** Autodiagnóstico e agenda de ticks EMCON.

2. **Modem Acústico & Modo Sísmico:**
   - Ultrassom (18-20kHz) e audível (FSK/BPSK).
   - Esteganografia em músicas com criptografia assimétrica.
   - Transmissão de fotos/vídeos com controle ARQ de perda de pacotes.
   - **Modo Sísmico via Giroscópio:** Usa o acelerômetro/giroscópio como microfone de contato mecânico se o microfone for desativado.

3. **Módulos Administrativos:**
   - CFTV (DVR local, fotos periódicas, tela ao vivo).
   - Controle Parental (filtros sensíveis).
   - Blue Team (Fail2Ban, WAF, Tarpit).
   - Contenção Zero-Trust (DEFCON 1 Lockdown, Quarentena Criptográfica, Kill-Switch 4003, Corte de Sensores, Congelamento de Tela).
${mcpSection}
### 📡 TELEMETRIA AO VIVO DA REDE (STATUS ATUAL):
- **Lockdown DEFCON 1:** ${snapshot.isLockdown ? '🚨 ATIVADO (Tráfego Congelado)' : '🟢 DESATIVADO (Normal)'}
- **Estações Conectadas:** ${snapshot.connectedStations.length}
- **Nós Quarentenados:** ${snapshot.quarantinedCount} [${snapshot.quarantinedList.join(', ') || 'Nenhum'}]
- **IPs Banidos (Fail2Ban):** ${snapshot.bannedIpsCount} [${snapshot.bannedIps.join(', ') || 'Nenhum'}]
- **Requisições Bloqueadas (WAF):** ${snapshot.securityStats.blockedRequests}
- **Violações de Rate Limit:** ${snapshot.securityStats.rateLimitViolations}
- **Intrusões:** ${snapshot.securityStats.intrusionsDetected}
- **Blocos no Ledger de Auditoria:** ${snapshot.auditTrailCount}

### 🖥️ ESTAÇÕES CONECTADAS ATIVAS:
${stationsSummary}

### 🧠 MEMÓRIA DE REGRAS APRENDIDAS DO ADMINISTRADOR:
${rulesText}

### ⚡ FORMATO DE AÇÕES:
Quando sugerir uma ação prática de contenção ou invocar uma ferramenta MCP, você pode incluir a tag de ação rápida:
- \`[ACTION:quarantine:ID_DA_ESTACAO:Nome]\`
- \`[ACTION:unquarantine:ID_DA_ESTACAO:Nome]\`
- \`[ACTION:lockdown:enable]\` ou \`[ACTION:lockdown:disable]\`
- \`[ACTION:kill_sensors:ID_DA_ESTACAO:Nome]\`
- \`[ACTION:freeze_screen:ID_DA_ESTACAO:Nome]\`
- \`[ACTION:eject:ID_DA_ESTACAO:Nome]\`
- \`[ACTION:ban_ip:ENDERECO_IP:Motivo]\`
O painel renderiza botões de 1 clique para o administrador validar e disparar imediatamente.`;
}

// Extrai ações interativas sugeridas no texto ou chamadas MCP
export function parseActionSuggestions(text: string, stations: LiveSystemSnapshot['connectedStations']): { reply: string; actions: CopilotActionSuggestion[] } {
  const actions: CopilotActionSuggestion[] = [];
  const regex = /\[ACTION:(quarantine|unquarantine|lockdown|eject|kill_sensors|freeze_screen|ban_ip):([^:\]]+)(?::([^\]]+))?\]/g;

  let cleanText = text;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const actionType = match[1];
    const targetParam = match[2];
    const optionalLabel = match[3];

    if (actionType === 'quarantine') {
      const station = stations.find((s) => s.clientId === targetParam) || { clientId: targetParam, name: optionalLabel || targetParam };
      actions.push({
        type: 'quarantine',
        label: `🛑 Quarentenar "${station.name}"`,
        targetId: station.clientId,
        targetName: station.name,
      });
    } else if (actionType === 'unquarantine') {
      const station = stations.find((s) => s.clientId === targetParam) || { clientId: targetParam, name: optionalLabel || targetParam };
      actions.push({
        type: 'unquarantine',
        label: `🟢 Liberar "${station.name}" da Quarentena`,
        targetId: station.clientId,
        targetName: station.name,
      });
    } else if (actionType === 'lockdown') {
      const enable = targetParam === 'enable' || targetParam === 'true';
      actions.push({
        type: 'lockdown',
        label: enable ? '🚨 Ativar Lockdown (DEFCON 1)' : '🟢 Desativar Lockdown',
        payload: { enable },
      });
    } else if (actionType === 'eject') {
      const station = stations.find((s) => s.clientId === targetParam) || { clientId: targetParam, name: optionalLabel || targetParam };
      actions.push({
        type: 'eject',
        label: `⚡ Ejetar Sessão de "${station.name}"`,
        targetId: station.clientId,
        targetName: station.name,
      });
    } else if (actionType === 'kill_sensors') {
      const station = stations.find((s) => s.clientId === targetParam) || { clientId: targetParam, name: optionalLabel || targetParam };
      actions.push({
        type: 'kill_sensors',
        label: `🔇 Cortar Sensores de "${station.name}"`,
        targetId: station.clientId,
        targetName: station.name,
      });
    } else if (actionType === 'freeze_screen') {
      const station = stations.find((s) => s.clientId === targetParam) || { clientId: targetParam, name: optionalLabel || targetParam };
      actions.push({
        type: 'freeze_screen',
        label: `🔒 Travar Tela de "${station.name}"`,
        targetId: station.clientId,
        targetName: station.name,
      });
    } else if (actionType === 'ban_ip') {
      actions.push({
        type: 'ban_ip',
        label: `🛡️ Banir IP "${targetParam}"`,
        payload: { ip: targetParam, reason: optionalLabel || 'Violação de segurança sugerida pela IA' },
      });
    }
  }

  cleanText = cleanText.replace(regex, '').trim();
  return { reply: cleanText, actions };
}

/**
 * Converte tool calls do MCP (OpenAI/Gemini/Groq/Ollama) em sugestões de ação práticas
 */
export function convertMcpCallsToActionSuggestions(
  toolCalls: { name: string; args: Record<string, unknown> }[],
  stations: LiveSystemSnapshot['connectedStations']
): CopilotActionSuggestion[] {
  const actions: CopilotActionSuggestion[] = [];

  for (const tc of toolCalls) {
    const name = tc.name;
    const args = tc.args || {};

    if (name === 'soc_quarantine_node') {
      const cid = String(args.clientId || '');
      const station = stations.find((s) => s.clientId === cid) || { clientId: cid, name: cid };
      actions.push({
        type: 'quarantine',
        label: `🛑 [MCP] Quarentenar "${station.name}"`,
        targetId: station.clientId,
        targetName: station.name,
        isMcpExecution: true,
      });
    } else if (name === 'soc_release_quarantine') {
      const cid = String(args.clientId || '');
      const station = stations.find((s) => s.clientId === cid) || { clientId: cid, name: cid };
      actions.push({
        type: 'unquarantine',
        label: `🟢 [MCP] Liberar "${station.name}"`,
        targetId: station.clientId,
        targetName: station.name,
        isMcpExecution: true,
      });
    } else if (name === 'soc_trigger_lockdown') {
      const enable = Boolean(args.enable);
      actions.push({
        type: 'lockdown',
        label: enable ? '🚨 [MCP] Ativar Lockdown (DEFCON 1)' : '🟢 [MCP] Desativar Lockdown',
        payload: { enable, reason: args.reason },
        isMcpExecution: true,
      });
    } else if (name === 'soc_kill_sensors') {
      const cid = String(args.clientId || '');
      const station = stations.find((s) => s.clientId === cid) || { clientId: cid, name: cid };
      actions.push({
        type: 'kill_sensors',
        label: `🔇 [MCP] Cortar Sensores de "${station.name}"`,
        targetId: station.clientId,
        targetName: station.name,
        isMcpExecution: true,
      });
    } else if (name === 'soc_freeze_screen') {
      const cid = String(args.clientId || '');
      const station = stations.find((s) => s.clientId === cid) || { clientId: cid, name: cid };
      actions.push({
        type: 'freeze_screen',
        label: `🔒 [MCP] Travar Tela de "${station.name}"`,
        targetId: station.clientId,
        targetName: station.name,
        isMcpExecution: true,
      });
    } else if (name === 'soc_eject_session') {
      const cid = String(args.clientId || '');
      const station = stations.find((s) => s.clientId === cid) || { clientId: cid, name: cid };
      actions.push({
        type: 'eject',
        label: `⚡ [MCP] Ejetar Sessão de "${station.name}"`,
        targetId: station.clientId,
        targetName: station.name,
        isMcpExecution: true,
      });
    } else if (name === 'soc_ban_ip') {
      const ip = String(args.ip || '');
      actions.push({
        type: 'ban_ip',
        label: `🛡️ [MCP] Banir IP "${ip}"`,
        payload: { ip, reason: args.reason, durationHours: args.durationHours || 24 },
        isMcpExecution: true,
      });
    }
  }

  return actions;
}

// ============================================================================
// MOTOR HEURÍSTICO OFFLINE (100% NATIVO / ZERO-CONFIG)
// ============================================================================

export function runOfflineHeuristicCopilot(
  userPrompt: string,
  snapshot: LiveSystemSnapshot
): { reply: string; actions: CopilotActionSuggestion[] } {
  const query = userPrompt.toLowerCase().trim();
  const stations = snapshot.connectedStations;

  // Análise de ameaças
  if (query.includes('ameaça') || query.includes('analis') || query.includes('anomalia') || query.includes('suspeit') || query.includes('risco') || query.includes('mcp')) {
    const highRisk = stations.filter((s) => (s.latency && s.latency > 1000) || (s.platform && s.platform.toLowerCase().includes('headless')));
    if (highRisk.length > 0) {
      const s = highRisk[0];
      const reply = `🔍 **[Sentinel Heurístico Offline] Análise Tática de Ameaças:**\n\nIdentifiquei **${highRisk.length} nó(s)** com comportamento anômalo:\n\n` +
        highRisk.map((n) => `• **${n.name}** (\`${n.clientId}\`): IP \`${n.ip || '127.0.0.1'}\`, Latência **${n.latency}ms** (RTT anômalo), OS: \`${n.platform}\`.`).join('\n') +
        `\n\nRecomendo contenção preventiva via Quarentena Zero-Trust e corte de sensores para neutralizar sondagens.\n\n` +
        `[ACTION:quarantine:${s.clientId}:${s.name}] [ACTION:kill_sensors:${s.clientId}:${s.name}]`;
      return parseActionSuggestions(reply, stations);
    }

    if (stations.length === 0) {
      return {
        reply: `🛡️ **[Sentinel Heurístico Offline] Diagnóstico da Malha:**\n\nNão há nós conectados no momento. O sistema está protegido.\n\n` +
          `• WAF: ${snapshot.securityStats.blockedRequests} requisições filtradas.\n` +
          `• Fail2Ban: ${snapshot.bannedIpsCount} IPs em quarentena.\n` +
          `• DEFCON 1: ${snapshot.isLockdown ? 'ATIVO' : 'DESATIVADO'}.`,
        actions: [],
      };
    }

    const first = stations[0];
    return {
      reply: `✅ **[Sentinel Heurístico Offline] Status Seguro:** Todas as ${stations.length} estações conectadas operam com latência normal e sem violações de protocolo.\n\nDeseja realizar uma auditoria específica no nó "${first.name}"?`,
      actions: [],
    };
  }

  // Lockdown
  if (query.includes('lockdown') || query.includes('defcon') || query.includes('parar tudo')) {
    if (snapshot.isLockdown) {
      return parseActionSuggestions(`🚨 **A rede já está em modo LOCKDOWN DEFCON 1!**\n\nO tráfego de dados regular está suspenso.\n\n[ACTION:lockdown:disable]`, stations);
    }
    return parseActionSuggestions(`⚠️ **Lockdown de Emergência (DEFCON 1):**\n\nIsola o tráfego P2P globalmente mantendo apenas o controle do Administrador.\n\n[ACTION:lockdown:enable]`, stations);
  }

  // Quarentena
  if (query.includes('quarentena') || query.includes('isolar')) {
    if (stations.length > 0) {
      const target = stations[0];
      return parseActionSuggestions(`🛑 **Quarentena Criptográfica:**\n\nIsola o nó "${target.name}" na malha Mesh em sandbox de leitura estrita.\n\n[ACTION:quarantine:${target.clientId}:${target.name}] [ACTION:kill_sensors:${target.clientId}:${target.name}]`, stations);
    }
    return { reply: 'Nenhuma estação ativa conectada para isolamento.', actions: [] };
  }

  // Protocolo JJY
  if (query.includes('jjy') || query.includes('spec') || query.includes('reputa') || query.includes('auditoria')) {
    return {
      reply: `🏛️ **Protocolo JJY Sovereign Mesh (Specs 36 a 41):**\n\n` +
        `• **Spec 36 (Reputação):** Pontuação de 0 a 1000 (Inicial: 500). Limiar confiável >=700, suspeito <=300, bloqueado <=100.\n` +
        `• **Spec 37 (Auditoria Hash-Chain):** Registros encadeados por SHA determinístico. Blocos imutáveis.\n` +
        `• **Spec 38 (DTN Store-and-Forward):** Fila de mensagens offline prioritária.\n` +
        `• **Spec 39 (Vizinhança & LQI):** Análise de enlace e SNR acústico/RF.\n` +
        `• **MCP Tools:** ${MCP_TOOLS_CATALOG.length} ferramentas operacionais ativas.`,
      actions: [],
    };
  }

  // Modem acústico e giroscópio
  if (query.includes('som') || query.includes('acustic') || query.includes('giroscopio') || query.includes('esteganografia')) {
    return {
      reply: `🎙️ **Modem de Som Acústico & Modo Sísmico:**\n\n` +
        `• Comunicação Full-Duplex ultrassônica (18-20kHz) e audível (FSK/BPSK).\n` +
        `• Esteganografia em arquivos de música e canais de áudio.\n` +
        `• **Fallback Sísmico via Giroscópio:** Converte micro-vibrações da carcaça do aparelho através do sensor de movimento quando o microfone está bloqueado pelo sistema operacional.`,
      actions: [],
    };
  }

  return {
    reply: `Entendido, Administrador. O **Sentinel AI** está em prontidão operacional analisando as **${stations.length} estações** ativas.\n\n` +
      `Posso auxiliá-lo a:\n` +
      `• Analisar ameaças e anomalias de rede.\n` +
      `• Executar ferramentas MCP de contenção (Quarentena, Corte de Sensores, Bloqueio).\n` +
      `• Gerenciar o modo Lockdown DEFCON 1.\n` +
      `• Tirar dúvidas sobre o protocolo JJY e modems acústicos.`,
    actions: [],
  };
}

// ============================================================================
// CONECTORES DE APIS UNIVERSAIS (Ollama, LM Studio, OpenAI, Gemini, Claude, Groq, DeepSeek)
// ============================================================================

export interface GenerationParams {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

/**
 * Cliente Universal para Endpoints Compatíveis com OpenAI (LM Studio, OpenAI, Groq, DeepSeek, OpenRouter, Together, Mistral, Perplexity, HuggingFace, xAI, Custom)
 */
export async function queryOpenAiCompatibleEndpoint(
  baseUrl: string,
  apiKey: string,
  modelName: string,
  userPrompt: string,
  snapshot: LiveSystemSnapshot,
  enableMcp = true,
  params?: GenerationParams
): Promise<{ reply: string; actions: CopilotActionSuggestion[]; modelUsed: string }> {
  const systemPrompt = buildSystemKnowledgePrompt(snapshot, !enableMcp);
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const url = `${cleanBase}/chat/completions`;

  const payload: Record<string, unknown> = {
    model: modelName,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: params?.temperature ?? 0.4,
    top_p: params?.topP ?? 0.9,
    max_tokens: params?.maxTokens ?? 2048,
  };

  // Se MCP Tools estiver ativado, envia o catálogo oficial no formato padrão de Function Calling
  if (enableMcp) {
    payload.tools = convertMcpToOpenAiTools(MCP_TOOLS_CATALOG);
    payload.tool_choice = 'auto';
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha no endpoint ${cleanBase} (${response.status}): ${errorText.slice(0, 150)}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  let replyText = choice?.message?.content || '';

  // Processa Tool Calls retornadas pelo modelo
  const toolCalls: { name: string; args: Record<string, unknown> }[] = [];
  if (choice?.message?.tool_calls && Array.isArray(choice.message.tool_calls)) {
    for (const tc of choice.message.tool_calls) {
      try {
        const parsedArgs = typeof tc.function?.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function?.arguments || {};
        toolCalls.push({ name: tc.function?.name, args: parsedArgs });
      } catch {}
    }
  }

  // Extrai ações via MCP e regex
  const textActions = parseActionSuggestions(replyText, snapshot.connectedStations);
  const mcpActions = convertMcpCallsToActionSuggestions(toolCalls, snapshot.connectedStations);
  const combinedActions = [...mcpActions, ...textActions.actions];

  if (toolCalls.length > 0 && !replyText) {
    replyText = `⚡ **[MCP Tool Call Executada]** A IA invocou as seguintes ferramentas operacionais:\n\n` +
      toolCalls.map((t) => `• Ferramenta: \`${t.name}\` com parâmetros \`${JSON.stringify(t.args)}\``).join('\n') +
      `\n\nConfirme a execução tática nos botões abaixo:`;
  }

  return {
    reply: replyText || textActions.reply,
    actions: combinedActions,
    modelUsed: modelName,
  };
}

/**
 * Cliente Google Gemini (com suporte a Function Calling MCP)
 */
export async function queryGeminiApi(
  apiKey: string,
  modelName: string,
  userPrompt: string,
  snapshot: LiveSystemSnapshot,
  enableMcp = true
): Promise<{ reply: string; actions: CopilotActionSuggestion[]; modelUsed: string }> {
  const systemPrompt = buildSystemKnowledgePrompt(snapshot, !enableMcp);
  const effectiveModel = modelName || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${apiKey}`;

  const body: Record<string, unknown> = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1024,
    },
  };

  if (enableMcp) {
    body.tools = convertMcpToGeminiTools(MCP_TOOLS_CATALOG);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha na API Gemini (${response.status}): ${errorText.slice(0, 150)}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  let rawReply = '';
  const toolCalls: { name: string; args: Record<string, unknown> }[] = [];

  for (const part of parts) {
    if (part.text) rawReply += part.text;
    if (part.functionCall) {
      toolCalls.push({ name: part.functionCall.name, args: part.functionCall.args || {} });
    }
  }

  const textActions = parseActionSuggestions(rawReply, snapshot.connectedStations);
  const mcpActions = convertMcpCallsToActionSuggestions(toolCalls, snapshot.connectedStations);

  if (toolCalls.length > 0 && !rawReply) {
    rawReply = `⚡ **[MCP Tool Call]** Chamada da ferramenta Gemini: \`${toolCalls.map((t) => t.name).join(', ')}\``;
  }

  return {
    reply: rawReply || textActions.reply,
    actions: [...mcpActions, ...textActions.actions],
    modelUsed: effectiveModel,
  };
}

/**
 * Cliente Anthropic Claude
 */
export async function queryAnthropicApi(
  apiKey: string,
  modelName: string,
  userPrompt: string,
  snapshot: LiveSystemSnapshot
): Promise<{ reply: string; actions: CopilotActionSuggestion[]; modelUsed: string }> {
  const systemPrompt = buildSystemKnowledgePrompt(snapshot, true);
  const effectiveModel = modelName || 'claude-3-5-haiku-20241022';
  const url = 'https://api.anthropic.com/v1/messages';

  const body = {
    model: effectiveModel,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Falha na API Anthropic (${response.status}): ${errText.slice(0, 150)}`);
  }

  const data = await response.json();
  const rawReply = data.content?.[0]?.text || '';
  const textActions = parseActionSuggestions(rawReply, snapshot.connectedStations);

  return {
    reply: textActions.reply,
    actions: textActions.actions,
    modelUsed: effectiveModel,
  };
}

/**
 * Cliente Ollama Local Oficial
 */
export async function queryOllamaApi(
  endpoint: string,
  modelName: string,
  userPrompt: string,
  snapshot: LiveSystemSnapshot,
  enableMcp = true
): Promise<{ reply: string; actions: CopilotActionSuggestion[]; modelUsed: string }> {
  const cleanEndpoint = (endpoint || 'http://localhost:11434').replace(/\/+$/, '');
  const systemPrompt = buildSystemKnowledgePrompt(snapshot, !enableMcp);
  const url = `${cleanEndpoint}/api/chat`;

  const payload: Record<string, unknown> = {
    model: modelName || 'llama3:latest',
    stream: false,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  };

  if (enableMcp) {
    payload.tools = convertMcpToOpenAiTools(MCP_TOOLS_CATALOG);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Ollama offline ou inacessível em ${cleanEndpoint} (${response.status})`);
  }

  const data = await response.json();
  let rawReply = data.message?.content || '';

  const toolCalls: { name: string; args: Record<string, unknown> }[] = [];
  if (data.message?.tool_calls && Array.isArray(data.message.tool_calls)) {
    for (const tc of data.message.tool_calls) {
      try {
        toolCalls.push({ name: tc.function?.name, args: tc.function?.arguments || {} });
      } catch {}
    }
  }

  const textActions = parseActionSuggestions(rawReply, snapshot.connectedStations);
  const mcpActions = convertMcpCallsToActionSuggestions(toolCalls, snapshot.connectedStations);

  if (toolCalls.length > 0 && !rawReply) {
    rawReply = `⚡ **[MCP Tool Call Ollama]** Invocou: \`${toolCalls.map((t) => t.name).join(', ')}\``;
  }

  return {
    reply: rawReply || textActions.reply,
    actions: [...mcpActions, ...textActions.actions],
    modelUsed: modelName || 'llama3:latest',
  };
}

// ============================================================================
// RE-EXPORTAÇÕES DO MÓDULO MOBILE POCKET AI (100% OFFLINE PARA CELULAR)
// ============================================================================
export {
  runMobileOfflineInference,
  MOBILE_OFFLINE_MODELS,
  detectMobileDeviceCapabilities,
  isMobileModelCached,
  cacheMobileModelForOffline,
  removeCachedMobileModel,
};
export type {
  MobileDeviceCapabilities,
  MobileModelDefinition,
  MobileInferenceResult,
} from './mobileOfflineAi';

