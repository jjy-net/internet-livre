import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Bot, Send, Settings, Plus, Trash2, Check, X, Copy, RefreshCw,
  Server, Globe, Cpu, Download, Play, Square, ChevronDown, ChevronRight,
  Wrench, Code, Thermometer, Hash, MessageSquare, Layers, Search,
  AlertTriangle, CheckCircle2, Loader2, ExternalLink, Eye, EyeOff,
  Zap, Brain, Shield, Plug, ArrowRight, RotateCcw, Save,
  Terminal, FileJson, Sparkles, Network, HardDrive, Cloud,
} from 'lucide-react';

/* ========================================================================== *
 * TIPOS & INTERFACES                                                         *
 * ========================================================================== */

interface LlmProvider {
  id: string;
  name: string;
  type: 'ollama' | 'lmstudio' | 'openai' | 'anthropic' | 'openrouter' | 'custom';
  baseUrl: string;
  apiKey?: string;
  enabled: boolean;
  models?: LlmModel[];
  status: 'online' | 'offline' | 'checking' | 'error';
  lastChecked?: number;
}

interface LlmModel {
  id: string;
  name: string;
  providerId: string;
  size?: string;
  quantization?: string;
  parameters?: string;
  family?: string;
  installed?: boolean;
  downloading?: boolean;
  downloadProgress?: number;
}

interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
  model?: string;
  provider?: string;
  toolCallId?: string;
  toolName?: string;
  tokens?: { prompt: number; completion: number };
  error?: boolean;
}

interface ToolFunction {
  id: string;
  name: string;
  description: string;
  parameters: string; // JSON Schema string
  enabled: boolean;
}

interface HarnessConfig {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  systemPrompt: string;
  stream: boolean;
  contextWindow: number;
}

interface ChatSession {
  id: string;
  name: string;
  messages: ChatMessage[];
  providerId: string;
  modelId: string;
  created: number;
  updated: number;
}

type TabId = 'chat' | 'providers' | 'models' | 'tools' | 'config';

/* ========================================================================== *
 * CONSTANTES                                                                  *
 * ========================================================================== */

const STORAGE_KEYS = {
  providers: 'jjy_ai_providers_v1',
  sessions: 'jjy_ai_sessions_v1',
  activeSession: 'jjy_ai_active_session_v1',
  config: 'jjy_ai_harness_config_v1',
  tools: 'jjy_ai_tools_v1',
};

const DEFAULT_CONFIG: HarnessConfig = {
  temperature: 0.7,
  maxTokens: 4096,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  systemPrompt: 'Você é um assistente de IA especializado em redes, comunicação e segurança. Responda de forma clara e técnica quando necessário.',
  stream: true,
  contextWindow: 8192,
};

const PROVIDER_TEMPLATES: Record<string, Partial<LlmProvider>> = {
  ollama: { name: 'Ollama (Local)', type: 'ollama', baseUrl: 'http://localhost:11434', enabled: true },
  lmstudio: { name: 'LM Studio (Local)', type: 'lmstudio', baseUrl: 'http://localhost:1234', enabled: true },
  openai: { name: 'OpenAI', type: 'openai', baseUrl: 'https://api.openai.com/v1', enabled: true },
  anthropic: { name: 'Anthropic', type: 'anthropic', baseUrl: 'https://api.anthropic.com', enabled: true },
  openrouter: { name: 'OpenRouter', type: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', enabled: true },
  custom: { name: 'Endpoint Personalizado', type: 'custom', baseUrl: 'http://localhost:8080/v1', enabled: true },
};

const POPULAR_MODELS: { name: string; tag: string; size: string; desc: string }[] = [
  { name: 'llama3.1', tag: 'llama3.1:8b', size: '4.7 GB', desc: 'Meta Llama 3.1 8B — ótimo equilíbrio qualidade/velocidade' },
  { name: 'llama3.1:70b', tag: 'llama3.1:70b', size: '39 GB', desc: 'Meta Llama 3.1 70B — alta capacidade, requer GPU potente' },
  { name: 'mistral', tag: 'mistral:7b', size: '4.1 GB', desc: 'Mistral 7B — rápido e eficiente para uso geral' },
  { name: 'mixtral', tag: 'mixtral:8x7b', size: '26 GB', desc: 'Mixtral 8×7B MoE — excelente para código e raciocínio' },
  { name: 'codellama', tag: 'codellama:13b', size: '7.4 GB', desc: 'Code Llama 13B — especializado em programação' },
  { name: 'phi3', tag: 'phi3:mini', size: '2.3 GB', desc: 'Microsoft Phi-3 Mini — compacto e capaz' },
  { name: 'gemma2', tag: 'gemma2:9b', size: '5.4 GB', desc: 'Google Gemma 2 9B — performático e leve' },
  { name: 'qwen2.5', tag: 'qwen2.5:7b', size: '4.4 GB', desc: 'Qwen 2.5 7B — forte em multilíngue e código' },
  { name: 'deepseek-coder-v2', tag: 'deepseek-coder-v2:16b', size: '8.9 GB', desc: 'DeepSeek Coder V2 — excelente para código' },
  { name: 'nomic-embed-text', tag: 'nomic-embed-text', size: '274 MB', desc: 'Embeddings de texto para RAG e busca semântica' },
];

const DEFAULT_TOOLS: ToolFunction[] = [
  {
    id: 'net_scan',
    name: 'network_scan',
    description: 'Escaneia a rede local e retorna dispositivos conectados com IP, MAC e hostname',
    parameters: JSON.stringify({
      type: 'object',
      properties: {
        subnet: { type: 'string', description: 'Sub-rede a escanear (ex: 192.168.1.0/24)' },
        timeout: { type: 'number', description: 'Timeout em ms por host', default: 1000 },
      },
      required: ['subnet'],
    }, null, 2),
    enabled: true,
  },
  {
    id: 'port_check',
    name: 'port_check',
    description: 'Verifica se uma porta específica está aberta em um host',
    parameters: JSON.stringify({
      type: 'object',
      properties: {
        host: { type: 'string', description: 'IP ou hostname do alvo' },
        port: { type: 'number', description: 'Porta a verificar' },
      },
      required: ['host', 'port'],
    }, null, 2),
    enabled: true,
  },
  {
    id: 'dns_resolve',
    name: 'dns_resolve',
    description: 'Resolve um domínio para seus registros DNS (A, AAAA, MX, TXT, etc.)',
    parameters: JSON.stringify({
      type: 'object',
      properties: {
        domain: { type: 'string', description: 'Domínio a resolver' },
        recordType: { type: 'string', enum: ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME'], default: 'A' },
      },
      required: ['domain'],
    }, null, 2),
    enabled: true,
  },
  {
    id: 'http_request',
    name: 'http_request',
    description: 'Faz uma requisição HTTP e retorna status, headers e corpo da resposta',
    parameters: JSON.stringify({
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL completa da requisição' },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'], default: 'GET' },
        headers: { type: 'object', description: 'Headers customizados' },
        body: { type: 'string', description: 'Corpo da requisição (para POST/PUT)' },
      },
      required: ['url'],
    }, null, 2),
    enabled: true,
  },
];

/* ========================================================================== *
 * UTILIDADES DE ARMAZENAMENTO                                                 *
 * ========================================================================== */

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveJson(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ========================================================================== *
 * ENGINE: Comunicação com Provedores LLM                                      *
 * ========================================================================== */

async function checkProviderStatus(provider: LlmProvider): Promise<'online' | 'offline' | 'error'> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);

    if (provider.type === 'ollama') {
      const res = await fetch(`${provider.baseUrl}/api/tags`, { signal: ctrl.signal });
      clearTimeout(timer);
      return res.ok ? 'online' : 'error';
    }

    if (provider.type === 'lmstudio') {
      const res = await fetch(`${provider.baseUrl}/v1/models`, { signal: ctrl.signal });
      clearTimeout(timer);
      return res.ok ? 'online' : 'error';
    }

    // OpenAI-compatible
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`;

    const endpoint = provider.type === 'anthropic'
      ? `${provider.baseUrl}/v1/messages`
      : `${provider.baseUrl}/models`;

    const res = await fetch(endpoint, { signal: ctrl.signal, headers });
    clearTimeout(timer);
    return (res.ok || res.status === 401) ? 'online' : 'error';
  } catch {
    return 'offline';
  }
}

async function fetchModels(provider: LlmProvider): Promise<LlmModel[]> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`;

    if (provider.type === 'ollama') {
      const res = await fetch(`${provider.baseUrl}/api/tags`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.models || []).map((m: any) => ({
        id: m.name || m.model,
        name: m.name || m.model,
        providerId: provider.id,
        size: m.size ? `${(m.size / 1e9).toFixed(1)} GB` : undefined,
        parameters: m.details?.parameter_size,
        family: m.details?.family,
        quantization: m.details?.quantization_level,
        installed: true,
      }));
    }

    if (provider.type === 'lmstudio') {
      const res = await fetch(`${provider.baseUrl}/v1/models`, { headers });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.data || []).map((m: any) => ({
        id: m.id, name: m.id, providerId: provider.id, installed: true,
      }));
    }

    // OpenAI-compatible (openai, openrouter, custom)
    const res = await fetch(`${provider.baseUrl}/models`, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).map((m: any) => ({
      id: m.id, name: m.id, providerId: provider.id,
    }));
  } catch { return []; }
}

async function pullOllamaModel(
  baseUrl: string, modelTag: string,
  onProgress: (pct: number, status: string) => void,
  signal?: AbortSignal
): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelTag, stream: true }),
      signal,
    });
    if (!res.ok || !res.body) return false;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          if (json.total && json.completed) {
            onProgress(Math.round((json.completed / json.total) * 100), json.status || 'baixando');
          } else {
            onProgress(-1, json.status || 'preparando');
          }
        } catch {}
      }
    }
    return true;
  } catch { return false; }
}

interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (full: string, usage?: { prompt: number; completion: number }) => void;
  onError: (err: string) => void;
  onToolCall?: (call: { id: string; name: string; arguments: string }) => void;
}

async function sendChatRequest(
  provider: LlmProvider,
  model: string,
  messages: { role: string; content: string; tool_call_id?: string; name?: string }[],
  config: HarnessConfig,
  tools: ToolFunction[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`;

  const enabledTools = tools.filter((t) => t.enabled);

  if (provider.type === 'ollama') {
    // Ollama native API
    const body: any = {
      model,
      messages,
      stream: config.stream,
      options: {
        temperature: config.temperature,
        num_predict: config.maxTokens,
        top_p: config.topP,
        frequency_penalty: config.frequencyPenalty,
        presence_penalty: config.presencePenalty,
      },
    };
    if (enabledTools.length > 0) {
      body.tools = enabledTools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: JSON.parse(t.parameters) },
      }));
    }

    const res = await fetch(`${provider.baseUrl}/api/chat`, {
      method: 'POST', headers, body: JSON.stringify(body), signal,
    });
    if (!res.ok) { callbacks.onError(`Erro ${res.status}: ${await res.text()}`); return; }

    if (config.stream && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '', full = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            if (json.message?.tool_calls) {
              for (const tc of json.message.tool_calls) {
                callbacks.onToolCall?.({
                  id: tc.id || uid(),
                  name: tc.function?.name || '',
                  arguments: typeof tc.function?.arguments === 'string'
                    ? tc.function.arguments
                    : JSON.stringify(tc.function?.arguments || {}),
                });
              }
            }
            if (json.message?.content) {
              full += json.message.content;
              callbacks.onToken(json.message.content);
            }
            if (json.done) {
              callbacks.onDone(full, json.eval_count ? { prompt: json.prompt_eval_count || 0, completion: json.eval_count } : undefined);
            }
          } catch {}
        }
      }
    } else {
      const data = await res.json();
      const content = data.message?.content || '';
      callbacks.onToken(content);
      callbacks.onDone(content);
    }
    return;
  }

  // OpenAI-compatible API (openai, lmstudio, openrouter, custom)
  const body: any = {
    model,
    messages,
    stream: config.stream,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    top_p: config.topP,
    frequency_penalty: config.frequencyPenalty,
    presence_penalty: config.presencePenalty,
  };
  if (enabledTools.length > 0) {
    body.tools = enabledTools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: JSON.parse(t.parameters) },
    }));
  }

  const endpoint = provider.type === 'lmstudio'
    ? `${provider.baseUrl}/v1/chat/completions`
    : `${provider.baseUrl}/chat/completions`;

  const res = await fetch(endpoint, {
    method: 'POST', headers, body: JSON.stringify(body), signal,
  });
  if (!res.ok) { callbacks.onError(`Erro ${res.status}: ${await res.text()}`); return; }

  if (config.stream && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '', full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.replace(/^data: /, '').trim();
        if (!trimmed || trimmed === '[DONE]') { if (trimmed === '[DONE]') callbacks.onDone(full); continue; }
        try {
          const json = JSON.parse(trimmed);
          const delta = json.choices?.[0]?.delta;
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.function?.name) {
                callbacks.onToolCall?.({
                  id: tc.id || uid(),
                  name: tc.function.name,
                  arguments: tc.function.arguments || '',
                });
              }
            }
          }
          if (delta?.content) {
            full += delta.content;
            callbacks.onToken(delta.content);
          }
          if (json.usage) {
            callbacks.onDone(full, { prompt: json.usage.prompt_tokens, completion: json.usage.completion_tokens });
          }
        } catch {}
      }
    }
  } else {
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    callbacks.onToken(content);
    callbacks.onDone(content, data.usage ? { prompt: data.usage.prompt_tokens, completion: data.usage.completion_tokens } : undefined);
  }
}

/* ========================================================================== *
 * SUBCOMPONENTES                                                              *
 * ========================================================================== */

const StatusDot: React.FC<{ status: LlmProvider['status'] }> = ({ status }) => {
  const colors = { online: 'bg-emerald-400', offline: 'bg-slate-500', checking: 'bg-yellow-400 animate-pulse', error: 'bg-rose-400' };
  const labels = { online: 'Online', offline: 'Offline', checking: 'Verificando…', error: 'Erro' };
  return (
    <span className="flex items-center gap-1.5 text-[10px] font-mono">
      <span className={`w-2 h-2 rounded-full ${colors[status]}`} />
      {labels[status]}
    </span>
  );
};

const ProviderIcon: React.FC<{ type: LlmProvider['type']; className?: string }> = ({ type, className = 'w-5 h-5' }) => {
  const icons: Record<string, React.ReactNode> = {
    ollama: <HardDrive className={className} />,
    lmstudio: <Cpu className={className} />,
    openai: <Sparkles className={className} />,
    anthropic: <Brain className={className} />,
    openrouter: <Network className={className} />,
    custom: <Server className={className} />,
  };
  return <>{icons[type] || <Globe className={className} />}</>;
};

/* ========================================================================== *
 * PAINEL: PROVEDORES                                                          *
 * ========================================================================== */

const ProvidersPanel: React.FC<{
  providers: LlmProvider[];
  onUpdate: (providers: LlmProvider[]) => void;
  onRefresh: (id: string) => void;
}> = ({ providers, onUpdate, onRefresh }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<LlmProvider>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const startAdd = (templateKey: string) => {
    const tpl = PROVIDER_TEMPLATES[templateKey];
    setForm({ ...tpl, id: uid(), status: 'offline' as const });
    setEditId('new');
    setShowAdd(false);
  };

  const startEdit = (p: LlmProvider) => {
    setForm({ ...p });
    setEditId(p.id);
  };

  const saveProvider = () => {
    if (!form.name || !form.baseUrl) return;
    const provider: LlmProvider = {
      id: form.id || uid(),
      name: form.name,
      type: form.type || 'custom',
      baseUrl: form.baseUrl.replace(/\/+$/, ''),
      apiKey: form.apiKey,
      enabled: form.enabled !== false,
      status: 'offline',
    };
    if (editId === 'new') {
      onUpdate([...providers, provider]);
    } else {
      onUpdate(providers.map((p) => (p.id === editId ? provider : p)));
    }
    setEditId(null);
    setForm({});
  };

  const removeProvider = (id: string) => {
    onUpdate(providers.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <Server className="w-4 h-4 text-indigo-400" />
          Provedores LLM
        </h2>
        <button
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar
        </button>
      </div>

      {/* Seletor de tipo */}
      {showAdd && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800">
          <span className="col-span-full text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Escolha o tipo de provedor</span>
          {Object.entries(PROVIDER_TEMPLATES).map(([key, tpl]) => (
            <button
              key={key}
              type="button"
              onClick={() => startAdd(key)}
              className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 transition-all text-left"
            >
              <ProviderIcon type={tpl.type!} className="w-4 h-4 text-indigo-400 flex-none" />
              <div className="min-w-0">
                <span className="text-xs font-semibold text-slate-200 block truncate">{tpl.name}</span>
                <span className="text-[10px] text-slate-500">
                  {tpl.type === 'ollama' || tpl.type === 'lmstudio' ? 'Local' : 'Remoto'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Formulário de edição */}
      {editId && (
        <div className="p-4 bg-slate-900 rounded-xl border border-indigo-500/30 space-y-3">
          <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
            {editId === 'new' ? 'Novo Provedor' : 'Editar Provedor'}
          </span>
          <div className="grid gap-2.5">
            <label className="block">
              <span className="text-[11px] text-slate-400 font-semibold">Nome</span>
              <input
                className="mt-1 w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:border-indigo-500 focus:outline-none transition-colors"
                value={form.name || ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Meu Ollama Local"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-400 font-semibold">URL Base</span>
              <input
                className="mt-1 w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono focus:border-indigo-500 focus:outline-none transition-colors"
                value={form.baseUrl || ''}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                placeholder="http://localhost:11434"
              />
            </label>
            {(form.type !== 'ollama' && form.type !== 'lmstudio') && (
              <label className="block">
                <span className="text-[11px] text-slate-400 font-semibold">Chave de API</span>
                <div className="relative mt-1">
                  <input
                    className="w-full px-3 py-2 pr-9 text-sm bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono focus:border-indigo-500 focus:outline-none transition-colors"
                    type={showKeys[editId] ? 'text' : 'password'}
                    value={form.apiKey || ''}
                    onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                    placeholder="sk-..."
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    onClick={() => setShowKeys({ ...showKeys, [editId]: !showKeys[editId] })}
                  >
                    {showKeys[editId] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </label>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={saveProvider} className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-1.5 transition-colors">
              <Check className="w-3.5 h-3.5" /> Salvar
            </button>
            <button type="button" onClick={() => { setEditId(null); setForm({}); }} className="px-4 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de provedores */}
      <div className="space-y-2">
        {providers.length === 0 && !showAdd && (
          <div className="text-center py-8 text-slate-500">
            <Server className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum provedor configurado</p>
            <p className="text-xs mt-1">Clique em "Adicionar" para conectar um LLM local ou remoto</p>
          </div>
        )}
        {providers.map((p) => (
          <div
            key={p.id}
            className={`p-3 rounded-xl border transition-colors ${
              p.enabled ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-slate-950 border-slate-900 opacity-60'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${p.status === 'online' ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                <ProviderIcon type={p.type} className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-200 truncate">{p.name}</span>
                  <StatusDot status={p.status} />
                </div>
                <span className="text-[11px] text-slate-500 font-mono truncate block">{p.baseUrl}</span>
              </div>
              <div className="flex items-center gap-1 flex-none">
                <button type="button" onClick={() => onRefresh(p.id)} className="p-1.5 text-slate-500 hover:text-indigo-400 rounded-lg hover:bg-slate-800 transition-colors" title="Testar conexão">
                  <RefreshCw className={`w-3.5 h-3.5 ${p.status === 'checking' ? 'animate-spin' : ''}`} />
                </button>
                <button type="button" onClick={() => startEdit(p)} className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-slate-800 transition-colors" title="Editar">
                  <Settings className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => removeProvider(p.id)} className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors" title="Remover">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {p.models && p.models.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-800/60 flex flex-wrap gap-1.5">
                {p.models.slice(0, 6).map((m) => (
                  <span key={m.id} className="px-2 py-0.5 text-[10px] font-mono bg-slate-950 text-slate-400 rounded border border-slate-800">
                    {m.name}
                  </span>
                ))}
                {p.models.length > 6 && (
                  <span className="px-2 py-0.5 text-[10px] font-mono text-slate-500">+{p.models.length - 6}</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Guia de instalação rápida */}
      <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5" /> Instalação Rápida — Ollama
        </span>
        <div className="text-[11px] text-slate-500 space-y-1.5 font-mono">
          <p className="text-slate-400">1. Instale o Ollama:</p>
          <code className="block px-2 py-1 bg-slate-900 rounded text-cyan-300 select-all">curl -fsSL https://ollama.com/install.sh | sh</code>
          <p className="text-slate-400 pt-1">2. Baixe um modelo:</p>
          <code className="block px-2 py-1 bg-slate-900 rounded text-cyan-300 select-all">ollama pull llama3.1:8b</code>
          <p className="text-slate-400 pt-1">3. Adicione o provedor Ollama acima e conecte.</p>
        </div>
      </div>
    </div>
  );
};

/* ========================================================================== *
 * PAINEL: MODELOS                                                             *
 * ========================================================================== */

const ModelsPanel: React.FC<{
  providers: LlmProvider[];
  onPull: (providerId: string, tag: string) => void;
  onDelete: (providerId: string, modelId: string) => void;
  pullStatus: Record<string, { progress: number; status: string }>;
}> = ({ providers, onPull, onDelete, pullStatus }) => {
  const [search, setSearch] = useState('');
  const [showCatalog, setShowCatalog] = useState(false);

  const ollamaProviders = providers.filter((p) => p.type === 'ollama' && p.status === 'online');
  const allModels = providers.flatMap((p) => (p.models || []).map((m) => ({ ...m, providerName: p.name, providerType: p.type })));
  const filteredModels = search
    ? allModels.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
    : allModels;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          Modelos Disponíveis
          <span className="text-xs text-slate-500 font-normal">({allModels.length})</span>
        </h2>
        {ollamaProviders.length > 0 && (
          <button
            type="button"
            onClick={() => setShowCatalog(!showCatalog)}
            className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Catálogo
          </button>
        )}
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:border-indigo-500 focus:outline-none transition-colors"
          placeholder="Buscar modelo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Catálogo Ollama */}
      {showCatalog && ollamaProviders.length > 0 && (
        <div className="space-y-2 p-3 bg-slate-950 rounded-xl border border-emerald-800/40">
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
            Modelos Populares para Instalar via Ollama
          </span>
          {POPULAR_MODELS.map((pm) => {
            const pulling = pullStatus[pm.tag];
            const alreadyInstalled = allModels.some((m) => m.name === pm.tag || m.name === pm.name);
            return (
              <div key={pm.tag} className="flex items-center gap-3 p-2 rounded-lg bg-slate-900 border border-slate-800">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-200">{pm.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{pm.size}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">{pm.desc}</p>
                  {pulling && (
                    <div className="mt-1.5">
                      <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-mono">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {pulling.status} {pulling.progress >= 0 ? `${pulling.progress}%` : ''}
                      </div>
                      {pulling.progress >= 0 && (
                        <div className="mt-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${pulling.progress}%` }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {alreadyInstalled ? (
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Instalado</span>
                ) : !pulling ? (
                  <button
                    type="button"
                    onClick={() => onPull(ollamaProviders[0].id, pm.tag)}
                    className="px-2.5 py-1 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1 transition-colors flex-none"
                  >
                    <Download className="w-3 h-3" /> Instalar
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Lista de modelos instalados */}
      <div className="space-y-1.5">
        {filteredModels.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <Cpu className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">{search ? 'Nenhum modelo encontrado' : 'Nenhum modelo disponível'}</p>
            <p className="text-xs mt-1">{search ? 'Tente outro termo' : 'Conecte um provedor e carregue seus modelos'}</p>
          </div>
        )}
        {filteredModels.map((m) => (
          <div key={`${m.providerId}-${m.id}`} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
            <Cpu className="w-4 h-4 text-indigo-400 flex-none" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-slate-200 block truncate">{m.name}</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-slate-500">{m.providerName}</span>
                {m.size && <span className="text-[10px] text-slate-600 font-mono">{m.size}</span>}
                {m.parameters && <span className="text-[10px] text-slate-600 font-mono">{m.parameters}</span>}
                {m.quantization && <span className="text-[10px] text-slate-600 font-mono">Q{m.quantization}</span>}
              </div>
            </div>
            {m.providerType === 'ollama' && (
              <button type="button" onClick={() => onDelete(m.providerId, m.id)} className="p-1 text-slate-600 hover:text-rose-400 rounded transition-colors" title="Remover modelo">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ========================================================================== *
 * PAINEL: FERRAMENTAS (Function Calling)                                      *
 * ========================================================================== */

const ToolsPanel: React.FC<{
  tools: ToolFunction[];
  onUpdate: (tools: ToolFunction[]) => void;
}> = ({ tools, onUpdate }) => {
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<ToolFunction>>({});

  const startNew = () => {
    setForm({ id: uid(), name: '', description: '', parameters: '{\n  "type": "object",\n  "properties": {},\n  "required": []\n}', enabled: true });
    setEditId('new');
  };

  const startEdit = (t: ToolFunction) => {
    setForm({ ...t });
    setEditId(t.id);
  };

  const save = () => {
    if (!form.name || !form.description) return;
    // Validar JSON
    try { JSON.parse(form.parameters || '{}'); } catch { return; }
    const tool: ToolFunction = {
      id: form.id || uid(),
      name: form.name,
      description: form.description,
      parameters: form.parameters || '{}',
      enabled: form.enabled !== false,
    };
    if (editId === 'new') {
      onUpdate([...tools, tool]);
    } else {
      onUpdate(tools.map((t) => (t.id === editId ? tool : t)));
    }
    setEditId(null);
    setForm({});
  };

  const toggleTool = (id: string) => {
    onUpdate(tools.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <Wrench className="w-4 h-4 text-indigo-400" />
          Ferramentas (Function Calling)
          <span className="text-xs text-slate-500 font-normal">({tools.filter((t) => t.enabled).length} ativas)</span>
        </h2>
        <button type="button" onClick={startNew} className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-1.5 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Nova Ferramenta
        </button>
      </div>

      {editId && (
        <div className="p-4 bg-slate-900 rounded-xl border border-indigo-500/30 space-y-3">
          <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
            {editId === 'new' ? 'Nova Ferramenta' : 'Editar Ferramenta'}
          </span>
          <div className="grid gap-2.5">
            <label className="block">
              <span className="text-[11px] text-slate-400 font-semibold">Nome da Função</span>
              <input
                className="mt-1 w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono focus:border-indigo-500 focus:outline-none"
                value={form.name || ''}
                onChange={(e) => setForm({ ...form, name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                placeholder="minha_funcao"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-400 font-semibold">Descrição</span>
              <input
                className="mt-1 w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:border-indigo-500 focus:outline-none"
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="O que esta ferramenta faz"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-400 font-semibold">Parâmetros (JSON Schema)</span>
              <textarea
                className="mt-1 w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono focus:border-indigo-500 focus:outline-none resize-y"
                rows={8}
                value={form.parameters || ''}
                onChange={(e) => setForm({ ...form, parameters: e.target.value })}
                spellCheck={false}
              />
            </label>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={save} className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-1.5 transition-colors">
              <Check className="w-3.5 h-3.5" /> Salvar
            </button>
            <button type="button" onClick={() => { setEditId(null); setForm({}); }} className="px-4 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {tools.map((t) => (
          <div key={t.id} className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${t.enabled ? 'bg-slate-900 border-slate-800' : 'bg-slate-950 border-slate-900 opacity-60'}`}>
            <button type="button" onClick={() => toggleTool(t.id)} className={`p-1.5 rounded-md border transition-colors ${t.enabled ? 'bg-emerald-950 border-emerald-700 text-emerald-400' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
              {t.enabled ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
            </button>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-slate-200 font-mono">{t.name}</span>
              <p className="text-[10px] text-slate-400 truncate">{t.description}</p>
            </div>
            <button type="button" onClick={() => startEdit(t)} className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-slate-800 transition-colors">
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => onUpdate(tools.filter((x) => x.id !== t.id))} className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ========================================================================== *
 * PAINEL: CONFIGURAÇÕES DO HARNESS                                            *
 * ========================================================================== */

const ConfigPanel: React.FC<{
  config: HarnessConfig;
  onUpdate: (config: HarnessConfig) => void;
}> = ({ config, onUpdate }) => {
  const set = <K extends keyof HarnessConfig>(key: K, val: HarnessConfig[K]) => onUpdate({ ...config, [key]: val });

  const Slider: React.FC<{ label: string; hint: string; value: number; min: number; max: number; step: number; field: keyof HarnessConfig }> = ({
    label, hint, value, min, max, step, field,
  }) => (
    <label className="block">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-slate-400 font-semibold">{label}</span>
        <span className="text-[11px] text-indigo-400 font-mono font-bold">{value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => set(field, parseFloat(e.target.value))}
        className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-indigo-500"
      />
      <span className="text-[9px] text-slate-600 mt-0.5 block">{hint}</span>
    </label>
  );

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
        <Settings className="w-4 h-4 text-indigo-400" />
        Configurações do Harness
      </h2>

      <div className="space-y-4 p-4 bg-slate-900 rounded-xl border border-slate-800">
        <Slider label="Temperatura" hint="0 = preciso, 2 = criativo" value={config.temperature} min={0} max={2} step={0.05} field="temperature" />
        <Slider label="Máximo de Tokens" hint="Limite de tokens na resposta" value={config.maxTokens} min={128} max={32768} step={128} field="maxTokens" />
        <Slider label="Top P" hint="Amostragem de núcleo" value={config.topP} min={0} max={1} step={0.05} field="topP" />
        <Slider label="Penalidade de Frequência" hint="Reduz repetições" value={config.frequencyPenalty} min={0} max={2} step={0.05} field="frequencyPenalty" />
        <Slider label="Penalidade de Presença" hint="Incentiva novos tópicos" value={config.presencePenalty} min={0} max={2} step={0.05} field="presencePenalty" />
        <Slider label="Janela de Contexto" hint="Mensagens anteriores enviadas" value={config.contextWindow} min={512} max={131072} step={512} field="contextWindow" />

        <label className="flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-semibold">Streaming</span>
          <button
            type="button"
            role="switch"
            aria-checked={config.stream}
            onClick={() => set('stream', !config.stream)}
            className={`w-9 h-5 rounded-full p-0.5 transition-colors ${config.stream ? 'bg-indigo-600' : 'bg-slate-700'}`}
          >
            <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${config.stream ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </label>
      </div>

      <div className="space-y-2">
        <span className="text-[11px] text-slate-400 font-semibold block">Prompt do Sistema</span>
        <textarea
          className="w-full px-3 py-2.5 text-sm bg-slate-950 border border-slate-700 rounded-lg text-slate-100 focus:border-indigo-500 focus:outline-none resize-y"
          rows={4}
          value={config.systemPrompt}
          onChange={(e) => set('systemPrompt', e.target.value)}
          placeholder="Instruções de sistema para o modelo…"
        />
      </div>

      <button
        type="button"
        onClick={() => onUpdate(DEFAULT_CONFIG)}
        className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg flex items-center gap-1.5 transition-colors"
      >
        <RotateCcw className="w-3 h-3" />
        Restaurar Padrões
      </button>
    </div>
  );
};

/* ========================================================================== *
 * COMPONENTE PRINCIPAL                                                        *
 * ========================================================================== */

export const AiRedesView: React.FC = () => {
  const [tab, setTab] = useState<TabId>('chat');
  const [providers, setProviders] = useState<LlmProvider[]>(() => loadJson(STORAGE_KEYS.providers, []));
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadJson(STORAGE_KEYS.sessions, []));
  const [activeSessionId, setActiveSessionId] = useState<string>(() => loadJson(STORAGE_KEYS.activeSession, ''));
  const [config, setConfig] = useState<HarnessConfig>(() => loadJson(STORAGE_KEYS.config, DEFAULT_CONFIG));
  const [tools, setTools] = useState<ToolFunction[]>(() => loadJson(STORAGE_KEYS.tools, DEFAULT_TOOLS));

  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [pullStatus, setPullStatus] = useState<Record<string, { progress: number; status: string }>>({});

  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showSessionList, setShowSessionList] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  // Persistir estado
  useEffect(() => { saveJson(STORAGE_KEYS.providers, providers); }, [providers]);
  useEffect(() => { saveJson(STORAGE_KEYS.sessions, sessions); }, [sessions]);
  useEffect(() => { saveJson(STORAGE_KEYS.activeSession, activeSessionId); }, [activeSessionId]);
  useEffect(() => { saveJson(STORAGE_KEYS.config, config); }, [config]);
  useEffect(() => { saveJson(STORAGE_KEYS.tools, tools); }, [tools]);

  // Auto-scroll
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeSession?.messages?.length, streamContent]);

  // Listar modelos ao atualizar provedores
  const allModels = useMemo(() => providers.flatMap((p) => (p.models || []).map((m) => ({ ...m, providerName: p.name }))), [providers]);

  // Auto-selecionar primeiro provedor/modelo
  useEffect(() => {
    if (!selectedProvider && providers.length > 0) {
      const online = providers.find((p) => p.status === 'online' && p.models?.length);
      if (online) {
        setSelectedProvider(online.id);
        setSelectedModel(online.models![0].id);
      } else if (providers[0]) {
        setSelectedProvider(providers[0].id);
      }
    }
  }, [providers, selectedProvider]);

  // Checar status dos provedores ao montar
  useEffect(() => {
    providers.forEach((p) => refreshProvider(p.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshProvider = useCallback(async (id: string) => {
    setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'checking' } : p)));
    const provider = providers.find((p) => p.id === id);
    if (!provider) return;

    const status = await checkProviderStatus(provider);
    let models: LlmModel[] = [];
    if (status === 'online') {
      models = await fetchModels(provider);
    }

    setProviders((prev) => prev.map((p) =>
      p.id === id ? { ...p, status, models, lastChecked: Date.now() } : p
    ));
  }, [providers]);

  const handlePull = useCallback(async (providerId: string, tag: string) => {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return;

    setPullStatus((prev) => ({ ...prev, [tag]: { progress: 0, status: 'iniciando' } }));

    const ok = await pullOllamaModel(provider.baseUrl, tag, (progress, status) => {
      setPullStatus((prev) => ({ ...prev, [tag]: { progress, status } }));
    });

    if (ok) {
      setPullStatus((prev) => { const n = { ...prev }; delete n[tag]; return n; });
      refreshProvider(providerId);
    } else {
      setPullStatus((prev) => ({ ...prev, [tag]: { progress: -1, status: 'falha ao baixar' } }));
    }
  }, [providers, refreshProvider]);

  const handleDeleteModel = useCallback(async (providerId: string, modelId: string) => {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider || provider.type !== 'ollama') return;
    try {
      await fetch(`${provider.baseUrl}/api/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelId }),
      });
      refreshProvider(providerId);
    } catch {}
  }, [providers, refreshProvider]);

  // ---- Sessões de Chat ----
  const newSession = useCallback(() => {
    const session: ChatSession = {
      id: uid(), name: `Chat ${sessions.length + 1}`,
      messages: [], providerId: selectedProvider, modelId: selectedModel,
      created: Date.now(), updated: Date.now(),
    };
    setSessions((prev) => [...prev, session]);
    setActiveSessionId(session.id);
    setStreamContent('');
  }, [sessions.length, selectedProvider, selectedModel]);

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId('');
      setStreamContent('');
    }
  }, [activeSessionId]);

  // ---- Enviar mensagem ----
  const sendMessage = useCallback(async () => {
    if (!input.trim() || isGenerating) return;

    const provider = providers.find((p) => p.id === selectedProvider);
    if (!provider) return;

    let sessionId = activeSessionId;
    let currentSession = activeSession;

    // Criar sessão se não existir
    if (!currentSession) {
      const s: ChatSession = {
        id: uid(), name: input.trim().slice(0, 40),
        messages: [], providerId: selectedProvider, modelId: selectedModel,
        created: Date.now(), updated: Date.now(),
      };
      setSessions((prev) => [...prev, s]);
      setActiveSessionId(s.id);
      sessionId = s.id;
      currentSession = s;
    }

    const userMsg: ChatMessage = {
      id: uid(), role: 'user', content: input.trim(), timestamp: Date.now(),
    };

    const updatedMessages = [...(currentSession?.messages || []), userMsg];
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, messages: updatedMessages, updated: Date.now() } : s)));
    setInput('');
    setIsGenerating(true);
    setStreamContent('');

    // Preparar mensagens para a API
    const apiMessages: { role: string; content: string }[] = [];
    if (config.systemPrompt) {
      apiMessages.push({ role: 'system', content: config.systemPrompt });
    }
    // Janela de contexto
    const contextMsgs = updatedMessages.slice(-Math.max(2, Math.floor(config.contextWindow / 500)));
    for (const m of contextMsgs) {
      apiMessages.push({ role: m.role, content: m.content });
    }

    const abort = new AbortController();
    abortRef.current = abort;

    let fullResponse = '';

    await sendChatRequest(provider, selectedModel, apiMessages, config, tools, {
      onToken: (token) => {
        fullResponse += token;
        setStreamContent((prev) => prev + token);
      },
      onDone: (full, usage) => {
        const assistantMsg: ChatMessage = {
          id: uid(), role: 'assistant', content: full || fullResponse, timestamp: Date.now(),
          model: selectedModel, provider: provider.name, tokens: usage,
        };
        setSessions((prev) => prev.map((s) =>
          s.id === sessionId ? { ...s, messages: [...updatedMessages, assistantMsg], updated: Date.now() } : s
        ));
        setStreamContent('');
        setIsGenerating(false);
      },
      onError: (err) => {
        const errorMsg: ChatMessage = {
          id: uid(), role: 'assistant', content: `⚠️ Erro: ${err}`, timestamp: Date.now(),
          model: selectedModel, provider: provider.name, error: true,
        };
        setSessions((prev) => prev.map((s) =>
          s.id === sessionId ? { ...s, messages: [...updatedMessages, errorMsg], updated: Date.now() } : s
        ));
        setStreamContent('');
        setIsGenerating(false);
      },
      onToolCall: (call) => {
        const toolMsg: ChatMessage = {
          id: uid(), role: 'tool', content: `Chamou: ${call.name}(${call.arguments})`,
          timestamp: Date.now(), toolCallId: call.id, toolName: call.name,
        };
        setSessions((prev) => prev.map((s) =>
          s.id === sessionId ? { ...s, messages: [...s.messages, toolMsg], updated: Date.now() } : s
        ));
      },
    }, abort.signal);
  }, [input, isGenerating, providers, selectedProvider, selectedModel, activeSessionId, activeSession, config, tools]);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
    setStreamContent('');
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const copyMessage = useCallback((content: string) => {
    navigator.clipboard.writeText(content).catch(() => {});
  }, []);

  // Provider e Model selecionados
  const currentProvider = providers.find((p) => p.id === selectedProvider);
  const currentModels = currentProvider?.models || [];

  const TABS: { id: TabId; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'chat', label: 'Chat', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'providers', label: 'Provedores', icon: <Server className="w-4 h-4" />, count: providers.length },
    { id: 'models', label: 'Modelos', icon: <Layers className="w-4 h-4" />, count: allModels.length },
    { id: 'tools', label: 'Ferramentas', icon: <Wrench className="w-4 h-4" />, count: tools.filter((t) => t.enabled).length },
    { id: 'config', label: 'Config', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-950 border border-indigo-600/50">
              <Brain className="w-5 h-5 text-indigo-400" />
            </div>
            IA de Redes
          </h1>
          <p className="text-xs text-slate-400 mt-1">Instale e conecte qualquer LLM local ou remoto — chat, function calling e harness completo.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
              tab === t.id
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
            {t.count !== undefined && (
              <span className={`text-[10px] px-1.5 rounded-full font-mono ${tab === t.id ? 'bg-indigo-600/30 text-indigo-300' : 'bg-slate-800 text-slate-500'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Chat Tab */}
      {tab === 'chat' && (
        <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 280px)' }}>
          {/* Seletor de modelo + sessão */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {/* Model picker */}
            <div className="relative flex-1 min-w-[200px]">
              <button
                type="button"
                onClick={() => setShowModelPicker(!showModelPicker)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg hover:border-indigo-500/50 transition-colors text-left"
              >
                {currentProvider ? (
                  <>
                    <ProviderIcon type={currentProvider.type} className="w-3.5 h-3.5 text-indigo-400 flex-none" />
                    <span className="text-slate-200 font-semibold truncate">{selectedModel || 'Selecionar modelo'}</span>
                    <StatusDot status={currentProvider.status} />
                  </>
                ) : (
                  <span className="text-slate-500">Selecione um provedor primeiro →</span>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 ml-auto flex-none" />
              </button>

              {showModelPicker && (
                <div className="absolute top-full left-0 right-0 mt-1 z-20 max-h-60 overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg shadow-xl">
                  {providers.map((p) => (
                    <div key={p.id}>
                      <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-950 sticky top-0 flex items-center gap-1.5">
                        <ProviderIcon type={p.type} className="w-3 h-3" />
                        {p.name}
                        <StatusDot status={p.status} />
                      </div>
                      {(p.models || []).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => { setSelectedProvider(p.id); setSelectedModel(m.id); setShowModelPicker(false); }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-800 transition-colors flex items-center gap-2 ${
                            selectedProvider === p.id && selectedModel === m.id ? 'text-indigo-300 bg-indigo-600/10' : 'text-slate-300'
                          }`}
                        >
                          <Cpu className="w-3 h-3 flex-none" />
                          <span className="truncate">{m.name}</span>
                          {m.size && <span className="text-[9px] text-slate-600 ml-auto font-mono flex-none">{m.size}</span>}
                        </button>
                      ))}
                      {(!p.models || p.models.length === 0) && (
                        <span className="block px-3 py-2 text-[10px] text-slate-600 italic">
                          {p.status === 'online' ? 'Nenhum modelo' : 'Provedor offline'}
                        </span>
                      )}
                    </div>
                  ))}
                  {providers.length === 0 && (
                    <div className="px-3 py-4 text-center">
                      <p className="text-xs text-slate-500">Nenhum provedor configurado</p>
                      <button type="button" onClick={() => setTab('providers')} className="text-xs text-indigo-400 hover:underline mt-1">
                        Adicionar provedor →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sessões */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSessionList(!showSessionList)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-300 max-w-[100px] truncate">{activeSession?.name || 'Novo Chat'}</span>
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </button>
              {showSessionList && (
                <div className="absolute top-full right-0 mt-1 z-20 w-64 max-h-52 overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg shadow-xl">
                  <button type="button" onClick={() => { newSession(); setShowSessionList(false); }}
                    className="w-full text-left px-3 py-2 text-xs text-indigo-400 hover:bg-slate-800 flex items-center gap-2 border-b border-slate-800">
                    <Plus className="w-3.5 h-3.5" /> Novo Chat
                  </button>
                  {sessions.map((s) => (
                    <div key={s.id} className="flex items-center group">
                      <button type="button" onClick={() => { setActiveSessionId(s.id); setShowSessionList(false); setStreamContent(''); }}
                        className={`flex-1 text-left px-3 py-2 text-xs truncate hover:bg-slate-800 ${s.id === activeSessionId ? 'text-indigo-300' : 'text-slate-300'}`}>
                        {s.name}
                        <span className="text-[9px] text-slate-600 ml-1">({s.messages.length})</span>
                      </button>
                      <button type="button" onClick={() => deleteSession(s.id)} className="p-1 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 mr-1">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button type="button" onClick={newSession} className="p-2 text-slate-400 hover:text-indigo-400 bg-slate-900 border border-slate-700 rounded-lg hover:border-indigo-500/50 transition-colors" title="Novo Chat">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Área de mensagens */}
          <div className="flex-1 min-h-[300px] max-h-[calc(100vh-420px)] overflow-y-auto rounded-xl bg-slate-950 border border-slate-800 p-4 space-y-3">
            {(!activeSession || activeSession.messages.length === 0) && !streamContent && (
              <div className="flex flex-col items-center justify-center h-full min-h-[250px] text-center">
                <div className="p-4 rounded-2xl bg-indigo-950/50 border border-indigo-600/20 mb-3">
                  <Brain className="w-10 h-10 text-indigo-400" />
                </div>
                <h3 className="text-sm font-bold text-slate-200">IA de Redes</h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Conecte um LLM local (Ollama, LM Studio) ou remoto (OpenAI, Anthropic, OpenRouter) e comece a conversar com function calling e harness completo.
                </p>
                {providers.length === 0 && (
                  <button type="button" onClick={() => setTab('providers')} className="mt-3 px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-1.5 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Configurar Primeiro Provedor
                  </button>
                )}
              </div>
            )}

            {activeSession?.messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed relative group ${
                  msg.role === 'user'
                    ? 'bg-indigo-600/20 text-slate-100 border border-indigo-500/20'
                    : msg.role === 'tool'
                    ? 'bg-amber-950/30 text-amber-200 border border-amber-700/30'
                    : msg.error
                    ? 'bg-rose-950/30 text-rose-200 border border-rose-700/30'
                    : 'bg-slate-900 text-slate-200 border border-slate-800'
                }`}>
                  {msg.role === 'assistant' && msg.model && (
                    <div className="flex items-center gap-1.5 mb-1.5 text-[10px] text-slate-500">
                      <Cpu className="w-3 h-3" />
                      <span className="font-mono">{msg.model}</span>
                      {msg.tokens && (
                        <span className="text-slate-600">· {msg.tokens.prompt + msg.tokens.completion} tokens</span>
                      )}
                    </div>
                  )}
                  {msg.role === 'tool' && (
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] text-amber-400">
                      <Wrench className="w-3 h-3" />
                      <span className="font-mono font-bold">{msg.toolName || 'Ferramenta'}</span>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                  <button
                    type="button"
                    onClick={() => copyMessage(msg.content)}
                    className="absolute top-2 right-2 p-1 text-slate-600 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                    title="Copiar"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}

            {/* Streaming */}
            {streamContent && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm bg-slate-900 text-slate-200 border border-indigo-500/30 leading-relaxed">
                  <div className="flex items-center gap-1.5 mb-1.5 text-[10px] text-indigo-400">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="font-mono">{selectedModel}</span>
                  </div>
                  <div className="whitespace-pre-wrap break-words">{streamContent}<span className="animate-pulse text-indigo-400">▊</span></div>
                </div>
              </div>
            )}

            {isGenerating && !streamContent && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-4 py-3 bg-slate-900 border border-slate-800 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                  <span className="text-xs text-slate-400">Gerando resposta…</span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="mt-3 flex gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                className="w-full px-4 py-3 pr-12 text-sm bg-slate-900 border border-slate-700 rounded-xl text-slate-100 focus:border-indigo-500 focus:outline-none resize-none transition-colors placeholder:text-slate-600"
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={selectedModel ? `Mensagem para ${selectedModel}…` : 'Selecione um modelo acima para começar…'}
                disabled={!selectedProvider || isGenerating}
              />
              <div className="absolute right-2 bottom-2 flex gap-1">
                {tools.filter((t) => t.enabled).length > 0 && (
                  <span className="p-1 text-emerald-500" title={`${tools.filter((t) => t.enabled).length} ferramentas ativas`}>
                    <Wrench className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </div>
            {isGenerating ? (
              <button type="button" onClick={stopGeneration} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl flex items-center gap-1.5 transition-colors flex-none" title="Parar geração">
                <Square className="w-4 h-4" />
              </button>
            ) : (
              <button type="button" onClick={sendMessage} disabled={!input.trim() || !selectedProvider} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl flex items-center gap-1.5 transition-colors flex-none" title="Enviar mensagem">
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Info bar */}
          <div className="flex items-center justify-between mt-2 text-[10px] text-slate-600">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3 h-3" />
              {currentProvider?.type === 'ollama' || currentProvider?.type === 'lmstudio' ? '100% Local — dados nunca saem da sua máquina' : 'Conexão externa — dados enviados ao provedor'}
            </span>
            <span>Shift+Enter para nova linha</span>
          </div>
        </div>
      )}

      {/* Outros tabs */}
      {tab === 'providers' && (
        <ProvidersPanel providers={providers} onUpdate={setProviders} onRefresh={refreshProvider} />
      )}
      {tab === 'models' && (
        <ModelsPanel providers={providers} onPull={handlePull} onDelete={handleDeleteModel} pullStatus={pullStatus} />
      )}
      {tab === 'tools' && (
        <ToolsPanel tools={tools} onUpdate={setTools} />
      )}
      {tab === 'config' && (
        <ConfigPanel config={config} onUpdate={setConfig} />
      )}
    </div>
  );
};
