import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Sparkles,
  Send,
  Zap,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Settings,
  Brain,
  Plus,
  X,
  VolumeX,
  Ban,
  CheckCircle2,
  Copy,
  Check,
  Radio,
  FileCode,
  Lightbulb,
  ExternalLink,
  MessageSquare,
  ArrowRight,
  Database,
  Terminal,
  Cpu,
  Layers,
  Search,
  HardDrive,
  Globe,
  SlidersHorizontal,
  Power,
  PowerOff,
  FolderUp,
  HardDriveDownload,
  DownloadCloud,
  Play,
  Smartphone,
  QrCode,
  Mic,
  MicOff,
  Volume2,
  Download,
  Gauge,
  Activity,
  Sliders,
} from 'lucide-react';
import QRCode from 'qrcode';
import { HardwareTelemetryHUD } from './HardwareTelemetryHUD';
import {
  CopilotMessage,
  CopilotConfig,
  CopilotLearnedRule,
  CopilotActionSuggestion,
  CopilotProvider,
  LiveSystemSnapshot,
  CustomLocalModelRecord,
  loadCopilotConfig,
  saveCopilotConfig,
  loadLearnedRules,
  addLearnedRule,
  removeLearnedRule,
  loadCustomLocalModels,
  saveCustomLocalModels,
  pullOllamaModelStream,
  deleteOllamaModel,
  runOfflineHeuristicCopilot,
  queryGeminiApi,
  queryOllamaApi,
  queryAnthropicApi,
  queryOpenAiCompatibleEndpoint,
  fetchLocalOllamaModels,
  fetchOpenAiCompatibleModels,
} from '../utils/aiCopilotEngine';
import {
  runMobileOfflineInference,
  MOBILE_OFFLINE_MODELS,
  MobileDeviceCapabilities,
  detectMobileDeviceCapabilities,
  isMobileModelCached,
  cacheMobileModelForOffline,
  removeCachedMobileModel,
} from '../utils/mobileOfflineAi';
import { MCP_TOOLS_CATALOG, McpToolDefinition } from '../utils/mcpRouter';

export interface ConnectedStation {
  peerId: number;
  clientId: string;
  name: string;
  color?: string;
  battery?: number;
  isCharging?: boolean;
  platform?: string;
  remoteAddress?: string;
  lastSeen?: number;
  latency?: number | null;
  userAgent?: string;
  audioLevel?: number;
  isMicActive?: boolean;
  isCameraActive?: boolean;
  isScreenActive?: boolean;
}

export interface SecurityData {
  stats: {
    blockedRequests: number;
    bannedIpsCount: number;
    rateLimitViolations: number;
    intrusionsDetected: number;
    tarpittedConnections: number;
    failedLogins: number;
    activeBans: number;
  };
  bannedIps: {
    ip: string;
    reason: string;
    bannedAt: number;
    expiresAt?: number | null;
    auto?: boolean;
  }[];
  isLockdown?: boolean;
  quarantinedClients?: string[];
}

interface AdminAiCopilotViewProps {
  connectedStations: ConnectedStation[];
  securityData: SecurityData | null;
  serverUrl: string;
  token: string;
  adminWs: WebSocket | null;
  onRefreshTelemetry: () => void;
  onExecuteContainmentAction?: (action: CopilotActionSuggestion) => Promise<boolean>;
}

export const AdminAiCopilotView: React.FC<AdminAiCopilotViewProps> = ({
  connectedStations,
  securityData,
  serverUrl,
  token,
  adminWs,
  onRefreshTelemetry,
  onExecuteContainmentAction,
}) => {
  // Configurações do Provedor de IA
  const [config, setConfig] = useState<CopilotConfig>(loadCopilotConfig());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [isMcpModalOpen, setIsMcpModalOpen] = useState(false);
  const [learnedRules, setLearnedRules] = useState<CopilotLearnedRule[]>(loadLearnedRules());
  const [newRuleInput, setNewRuleInput] = useState('');
  const [newRuleCategory, setNewRuleCategory] = useState<CopilotLearnedRule['category']>('admin_note');

  // Descoberta de modelos locais
  const [isScanningLocalModels, setIsScanningLocalModels] = useState(false);
  const [discoveredModels, setDiscoveredModels] = useState<string[]>(config.discoveredLocalModels || []);

  // Controle de Energia da IA e Modelos Customizados
  const [customModels, setCustomModels] = useState<CustomLocalModelRecord[]>(loadCustomLocalModels());
  const [isInstallerOpen, setIsInstallerOpen] = useState(false);
  const [installerTab, setInstallerTab] = useState<'download' | 'gguf' | 'manage'>('download');

  // Aba Download (Ollama Pull)
  const [pullModelInput, setPullModelInput] = useState('deepseek-r1:1.5b');
  const [isPulling, setIsPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState<{
    status: string;
    percent?: number;
    completed?: number;
    total?: number;
    error?: string;
  } | null>(null);

  // Aba GGUF (Upload de Arquivo Local)
  const [selectedGgufFile, setSelectedGgufFile] = useState<File | null>(null);
  const [ggufFriendlyName, setGgufFriendlyName] = useState('');
  const [ggufQuantization, setGgufQuantization] = useState('Q4_K_M');
  const [isGgufRegistered, setIsGgufRegistered] = useState(false);

  // Mobile Pocket AI (100% Offline para Celular)
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  const [mobileCapabilities, setMobileCapabilities] = useState<MobileDeviceCapabilities | null>(null);
  const [cachedModelIds, setCachedModelIds] = useState<string[]>([]);
  const [cachingProgress, setCachingProgress] = useState<{ modelId: string; percent: number; status: string } | null>(null);
  const [mobileQrDataUrl, setMobileQrDataUrl] = useState<string>('');
  const [mobileSimulatorPrompt, setMobileSimulatorPrompt] = useState('Status da rede e modem por som');
  const [mobileSimulatorOutput, setMobileSimulatorOutput] = useState('');
  const [isMobileSimulatorLoading, setIsMobileSimulatorLoading] = useState(false);

  // Parâmetros de Inferência e Voz TTS/STT
  const [isParamsOpen, setIsParamsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [speechRecognitionInstance, setSpeechRecognitionInstance] = useState<any>(null);

  // Métricas em Tempo Real da IA & Hardware HUD
  const [isHardwareHudOpen, setIsHardwareHudOpen] = useState(true);
  const [lastMetrics, setLastMetrics] = useState<{
    latencyMs?: number;
    tokensPerSecond?: number;
    hardwareUsed?: string;
    tokensEstimated?: number;
  }>({
    latencyMs: 85,
    tokensPerSecond: 42,
    hardwareUsed: 'Nativo Local',
    tokensEstimated: 50,
  });

  // Histórico de Mensagens do Chat
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'welcome_1',
      role: 'assistant',
      content: `👋 **Olá, Administrador! Sou o Sentinel AI, seu Copilot Tático de Segurança.**\n\nEstou conectado ao núcleo do sistema e monitorando **${connectedStations.length} estações** ativas.\n\nCompreendo toda a arquitetura da rede, incluindo o protocolo **JJY Soberano (Specs 36 a 41)**, os **Modems Acústicos com fallback em Giroscópio**, o controle de **Lan House**, **Controle Parental** e o módulo de **Contenção Zero-Trust (DEFCON 1)**.\n\nPossuo **${MCP_TOOLS_CATALOG.length} ferramentas MCP** ativas para isolamento, quarentena e diagnósticos. Como posso apoiá-lo agora?`,
      timestamp: Date.now(),
      providerUsed: 'offline',
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [executedActions, setExecutedActions] = useState<Set<string>>(new Set());
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Rolagem suave até a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Escanear modelos locais na montagem do componente se ainda não escaneados
  useEffect(() => {
    handleScanLocalModels();

    // Detectar hardware do aparelho para IA móvel
    detectMobileDeviceCapabilities().then((cap) => {
      setMobileCapabilities(cap);
    });

    try {
      const cached = JSON.parse(localStorage.getItem('jjy_mobile_cached_models') || '[]');
      setCachedModelIds(cached);
    } catch {}

    // Gerar QR Code para acesso do smartphone na rede
    const mobileAccessUrl = `${serverUrl || window.location.origin}/?mode=mobile_ai&token=${token}`;
    QRCode.toDataURL(mobileAccessUrl, { width: 220, margin: 2, color: { dark: '#06b6d4', light: '#020617' } })
      .then((url) => setMobileQrDataUrl(url))
      .catch(() => {});
  }, [serverUrl, token]);

  // Alternar Liga / Desliga da IA
  const handleToggleAiPower = () => {
    const newPowerState = !config.isAiPowered;
    const updated = { ...config, isAiPowered: newPowerState };
    setConfig(updated);
    saveCopilotConfig(updated);
    if (newPowerState) {
      setActionNotice('🟢 Sentinel AI Copilot LIGADO e operacional!');
      setMessages((prev) => [
        ...prev,
        {
          id: `sys_power_${Date.now()}`,
          role: 'assistant',
          content: '⚡ **Sentinel AI Reativado.** O motor tático de IA está online e pronto para processar dúvidas, telemetria da rede ou ferramentas MCP.',
          timestamp: Date.now(),
          providerUsed: config.provider,
          modelUsed: config.activeModel,
        },
      ]);
    } else {
      setActionNotice('🔴 Sentinel AI Copilot DESLIGADO pelo Administrador.');
      setMessages((prev) => [
        ...prev,
        {
          id: `sys_power_${Date.now()}`,
          role: 'system',
          content: '🛑 **Sentinel AI Desligado.** O Administrador suspendeu o processamento autônomo e inferência de IA. O sistema está operando em Modo Tático Manual.',
          timestamp: Date.now(),
          providerUsed: 'offline',
        },
      ]);
    }
    setTimeout(() => setActionNotice(null), 3500);
  };

  // Iniciar Pull / Download de modelo no Ollama
  const handleStartPullModel = async (targetNameOverride?: string) => {
    const targetModel = (targetNameOverride || pullModelInput).trim();
    if (!targetModel || isPulling) return;

    setIsPulling(true);
    setPullProgress({ status: `Iniciando download no Ollama (${config.ollamaEndpoint})...` });

    try {
      await pullOllamaModelStream(config.ollamaEndpoint, targetModel, (data) => {
        setPullProgress({
          status: data.status,
          percent: data.percent,
          completed: data.completed,
          total: data.total,
        });
      });

      const newRecord: CustomLocalModelRecord = {
        id: `ollama_${Date.now()}`,
        name: targetModel,
        source: 'ollama_download',
        installedAt: Date.now(),
        status: 'installed',
        downloadProgress: 100,
      };

      const updatedCustom = [newRecord, ...customModels.filter((m) => m.name !== targetModel)];
      setCustomModels(updatedCustom);
      saveCustomLocalModels(updatedCustom);

      const allDiscovered = Array.from(new Set([...discoveredModels, targetModel]));
      setDiscoveredModels(allDiscovered);

      const updatedConfig: CopilotConfig = {
        ...config,
        provider: 'ollama',
        activeModel: targetModel,
        ollamaModel: targetModel,
        discoveredLocalModels: allDiscovered,
      };
      setConfig(updatedConfig);
      saveCopilotConfig(updatedConfig);

      setPullProgress(null);
      setActionNotice(`🎉 Modelo "${targetModel}" instalado no Ollama e ativado!`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: unknown) {
      setPullProgress({
        status: 'Falha no download',
        error: (err as Error).message || 'Certifique-se de que o Ollama está rodando no computador.',
      });
    } finally {
      setIsPulling(false);
    }
  };

  // Seleção de arquivo de modelo GGUF
  const handleGgufFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedGgufFile(file);
    setIsGgufRegistered(false);

    const base = file.name.replace(/\.(gguf|bin|pt|onnx)$/i, '');
    setGgufFriendlyName(base);

    const quantMatch = file.name.match(/(q\d[a-z0-9_]*|fp16|bf16|f32)/i);
    if (quantMatch) {
      setGgufQuantization(quantMatch[0].toUpperCase());
    }
  };

  // Registrar modelo GGUF no catálogo do sistema
  const handleRegisterGgufModel = () => {
    if (!selectedGgufFile || !ggufFriendlyName.trim()) return;

    const sizeFormatted = (selectedGgufFile.size / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    const newRecord: CustomLocalModelRecord = {
      id: `gguf_${Date.now()}`,
      name: ggufFriendlyName.trim(),
      fileName: selectedGgufFile.name,
      source: 'gguf_file',
      sizeBytes: selectedGgufFile.size,
      sizeFormatted,
      installedAt: Date.now(),
      status: 'installed',
      quantization: ggufQuantization,
    };

    const updatedCustom = [newRecord, ...customModels.filter((m) => m.name !== newRecord.name)];
    setCustomModels(updatedCustom);
    saveCustomLocalModels(updatedCustom);

    const allDiscovered = Array.from(new Set([...discoveredModels, newRecord.name]));
    setDiscoveredModels(allDiscovered);

    const updatedConfig: CopilotConfig = {
      ...config,
      provider: 'lmstudio',
      activeModel: newRecord.name,
      lmstudioModel: newRecord.name,
      discoveredLocalModels: allDiscovered,
    };
    setConfig(updatedConfig);
    saveCopilotConfig(updatedConfig);

    setIsGgufRegistered(true);
    setActionNotice(`💾 Modelo GGUF "${newRecord.name}" (${sizeFormatted}) registrado e ativado!`);
    setTimeout(() => setActionNotice(null), 4000);
  };

  // Excluir modelo customizado / Ollama
  const handleDeleteCustomModel = async (model: CustomLocalModelRecord) => {
    if (model.source === 'ollama_download') {
      try {
        await deleteOllamaModel(config.ollamaEndpoint, model.name);
      } catch {}
    }

    const updated = customModels.filter((m) => m.id !== model.id);
    setCustomModels(updated);
    saveCustomLocalModels(updated);

    const updatedDiscovered = discoveredModels.filter((m) => m !== model.name);
    setDiscoveredModels(updatedDiscovered);

    if (config.activeModel === model.name) {
      const fallbackConfig: CopilotConfig = {
        ...config,
        provider: 'offline',
        activeModel: 'Nativo Heurístico (Zero-Config)',
        discoveredLocalModels: updatedDiscovered,
      };
      setConfig(fallbackConfig);
      saveCopilotConfig(fallbackConfig);
    }

    setActionNotice(`🗑️ Modelo "${model.name}" removido.`);
    setTimeout(() => setActionNotice(null), 3000);
  };

  // Varrer Modelos Locais (Ollama & LM Studio)
  const handleScanLocalModels = async () => {
    setIsScanningLocalModels(true);
    try {
      const ollamaModels = await fetchLocalOllamaModels(config.ollamaEndpoint);
      const lmStudioModels = await fetchOpenAiCompatibleModels(config.lmstudioEndpoint);
      const customLoaded = loadCustomLocalModels();
      setCustomModels(customLoaded);

      const all = Array.from(new Set([...ollamaModels, ...lmStudioModels, ...customLoaded.map((c) => c.name)])).filter(Boolean);
      setDiscoveredModels(all);
      const updated = { ...config, discoveredLocalModels: all };
      setConfig(updated);
      saveCopilotConfig(updated);
      if (all.length > 0) {
        setActionNotice(`🔍 Encontrados ${all.length} modelo(s) local(is) instalados no seu computador!`);
        setTimeout(() => setActionNotice(null), 3500);
      }
    } finally {
      setIsScanningLocalModels(false);
    }
  };

  // Snapshot dos dados em tempo real da rede
  const getLiveSnapshot = (): LiveSystemSnapshot => {
    return {
      serverUrl,
      isLockdown: Boolean(securityData?.isLockdown),
      quarantinedCount: securityData?.quarantinedClients?.length || 0,
      quarantinedList: securityData?.quarantinedClients || [],
      connectedStations: connectedStations.map((s) => ({
        clientId: s.clientId,
        name: s.name,
        ip: s.remoteAddress,
        platform: s.platform,
        latency: s.latency,
        isCamera: s.isCameraActive,
        isMic: s.isMicActive,
        isScreen: s.isScreenActive,
      })),
      bannedIpsCount: securityData?.bannedIps?.length || 0,
      bannedIps: securityData?.bannedIps?.map((b) => b.ip) || [],
      securityStats: {
        blockedRequests: securityData?.stats.blockedRequests || 0,
        intrusionsDetected: securityData?.stats.intrusionsDetected || 0,
        rateLimitViolations: securityData?.stats.rateLimitViolations || 0,
        failedLogins: securityData?.stats.failedLogins || 0,
      },
      auditTrailCount: 38,
    };
  };

  // Enviar mensagem para a IA
  const handleSendMessage = async (textToSend?: string) => {
    if (!config.isAiPowered) {
      setActionNotice('⚠️ A IA está DESLIGADA. Ligue a IA no botão do topo para utilizá-la.');
      return;
    }

    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt || isLoading) return;

    const userMessage: CopilotMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputPrompt('');
    setIsLoading(true);

    const snapshot = getLiveSnapshot();
    const enableMcp = config.enableMcpTools;

    try {
      let replyText = '';
      let actions: CopilotActionSuggestion[] = [];
      let providerUsed = config.provider;
      let modelUsed = config.activeModel;

      if (config.provider === 'gemini' && config.geminiApiKey) {
        try {
          const res = await queryGeminiApi(config.geminiApiKey, config.geminiModel, prompt, snapshot, enableMcp);
          replyText = res.reply;
          actions = res.actions;
          modelUsed = res.modelUsed;
        } catch (err: unknown) {
          replyText = `⚠️ **[Falha no Gemini API]:** ${(err as Error).message}\n\n*Alternando para o Motor Heurístico Local Offline...*\n\n`;
          const fallback = runOfflineHeuristicCopilot(prompt, snapshot);
          replyText += fallback.reply;
          actions = fallback.actions;
          providerUsed = 'offline';
        }
      } else if (config.provider === 'ollama') {
        try {
          const res = await queryOllamaApi(config.ollamaEndpoint, config.ollamaModel, prompt, snapshot, enableMcp);
          replyText = res.reply;
          actions = res.actions;
          modelUsed = res.modelUsed;
        } catch (err: unknown) {
          replyText = `⚠️ **[Falha no Ollama Local em ${config.ollamaEndpoint}]:** ${(err as Error).message}\n\n*Alternando para o Motor Heurístico Local Offline...*\n\n`;
          const fallback = runOfflineHeuristicCopilot(prompt, snapshot);
          replyText += fallback.reply;
          actions = fallback.actions;
          providerUsed = 'offline';
        }
      } else if (config.provider === 'lmstudio') {
        try {
          const res = await queryOpenAiCompatibleEndpoint(config.lmstudioEndpoint, '', config.lmstudioModel, prompt, snapshot, enableMcp);
          replyText = res.reply;
          actions = res.actions;
          modelUsed = res.modelUsed;
        } catch (err: unknown) {
          replyText = `⚠️ **[Falha no LM Studio / Servidor Local em ${config.lmstudioEndpoint}]:** ${(err as Error).message}\n\n*Alternando para o Motor Heurístico Local Offline...*\n\n`;
          const fallback = runOfflineHeuristicCopilot(prompt, snapshot);
          replyText += fallback.reply;
          actions = fallback.actions;
          providerUsed = 'offline';
        }
      } else if (config.provider === 'openai' && config.openaiApiKey) {
        try {
          const res = await queryOpenAiCompatibleEndpoint(config.openaiEndpoint, config.openaiApiKey, config.openaiModel, prompt, snapshot, enableMcp);
          replyText = res.reply;
          actions = res.actions;
          modelUsed = res.modelUsed;
        } catch (err: unknown) {
          replyText = `⚠️ **[Falha no OpenAI API]:** ${(err as Error).message}\n\n*Alternando para o Motor Heurístico Local Offline...*\n\n`;
          const fallback = runOfflineHeuristicCopilot(prompt, snapshot);
          replyText += fallback.reply;
          actions = fallback.actions;
          providerUsed = 'offline';
        }
      } else if (config.provider === 'anthropic' && config.anthropicApiKey) {
        try {
          const res = await queryAnthropicApi(config.anthropicApiKey, config.anthropicModel, prompt, snapshot);
          replyText = res.reply;
          actions = res.actions;
          modelUsed = res.modelUsed;
        } catch (err: unknown) {
          replyText = `⚠️ **[Falha no Anthropic API]:** ${(err as Error).message}\n\n*Alternando para o Motor Heurístico Local Offline...*\n\n`;
          const fallback = runOfflineHeuristicCopilot(prompt, snapshot);
          replyText += fallback.reply;
          actions = fallback.actions;
          providerUsed = 'offline';
        }
      } else if (config.provider === 'groq' && config.groqApiKey) {
        try {
          const res = await queryOpenAiCompatibleEndpoint('https://api.groq.com/openai/v1', config.groqApiKey, config.groqModel, prompt, snapshot, enableMcp);
          replyText = res.reply;
          actions = res.actions;
          modelUsed = res.modelUsed;
        } catch (err: unknown) {
          replyText = `⚠️ **[Falha no Groq API]:** ${(err as Error).message}\n\n*Alternando para o Motor Heurístico Local Offline...*\n\n`;
          const fallback = runOfflineHeuristicCopilot(prompt, snapshot);
          replyText += fallback.reply;
          actions = fallback.actions;
          providerUsed = 'offline';
        }
      } else if (config.provider === 'deepseek' && config.deepseekApiKey) {
        try {
          const res = await queryOpenAiCompatibleEndpoint('https://api.deepseek.com', config.deepseekApiKey, config.deepseekModel, prompt, snapshot, enableMcp);
          replyText = res.reply;
          actions = res.actions;
          modelUsed = res.modelUsed;
        } catch (err: unknown) {
          replyText = `⚠️ **[Falha no DeepSeek API]:** ${(err as Error).message}\n\n*Alternando para o Motor Heurístico Local Offline...*\n\n`;
          const fallback = runOfflineHeuristicCopilot(prompt, snapshot);
          replyText += fallback.reply;
          actions = fallback.actions;
          providerUsed = 'offline';
        }
      } else if (config.provider === 'openrouter' && config.openrouterApiKey) {
        try {
          const res = await queryOpenAiCompatibleEndpoint(
            'https://openrouter.ai/api/v1',
            config.openrouterApiKey,
            config.openrouterModel,
            prompt,
            snapshot,
            enableMcp,
            { temperature: config.temperature, topP: config.topP, maxTokens: config.maxTokens }
          );
          replyText = res.reply;
          actions = res.actions;
          modelUsed = res.modelUsed;
        } catch (err: unknown) {
          replyText = `⚠️ **[Falha no OpenRouter API]:** ${(err as Error).message}\n\n*Alternando para o Motor Heurístico Local Offline...*\n\n`;
          const fallback = runOfflineHeuristicCopilot(prompt, snapshot);
          replyText += fallback.reply;
          actions = fallback.actions;
          providerUsed = 'offline';
        }
      } else if (config.provider === 'together' && config.togetherApiKey) {
        try {
          const res = await queryOpenAiCompatibleEndpoint(
            'https://api.together.xyz/v1',
            config.togetherApiKey,
            config.togetherModel,
            prompt,
            snapshot,
            enableMcp,
            { temperature: config.temperature, topP: config.topP, maxTokens: config.maxTokens }
          );
          replyText = res.reply;
          actions = res.actions;
          modelUsed = res.modelUsed;
        } catch (err: unknown) {
          replyText = `⚠️ **[Falha no Together AI]:** ${(err as Error).message}\n\n*Alternando para o Motor Heurístico Local Offline...*\n\n`;
          const fallback = runOfflineHeuristicCopilot(prompt, snapshot);
          replyText += fallback.reply;
          actions = fallback.actions;
          providerUsed = 'offline';
        }
      } else if (config.provider === 'mistral' && config.mistralApiKey) {
        try {
          const res = await queryOpenAiCompatibleEndpoint(
            'https://api.mistral.ai/v1',
            config.mistralApiKey,
            config.mistralModel,
            prompt,
            snapshot,
            enableMcp,
            { temperature: config.temperature, topP: config.topP, maxTokens: config.maxTokens }
          );
          replyText = res.reply;
          actions = res.actions;
          modelUsed = res.modelUsed;
        } catch (err: unknown) {
          replyText = `⚠️ **[Falha no Mistral AI]:** ${(err as Error).message}\n\n*Alternando para o Motor Heurístico Local Offline...*\n\n`;
          const fallback = runOfflineHeuristicCopilot(prompt, snapshot);
          replyText += fallback.reply;
          actions = fallback.actions;
          providerUsed = 'offline';
        }
      } else if (config.provider === 'perplexity' && config.perplexityApiKey) {
        try {
          const res = await queryOpenAiCompatibleEndpoint(
            'https://api.perplexity.ai',
            config.perplexityApiKey,
            config.perplexityModel,
            prompt,
            snapshot,
            enableMcp,
            { temperature: config.temperature, topP: config.topP, maxTokens: config.maxTokens }
          );
          replyText = res.reply;
          actions = res.actions;
          modelUsed = res.modelUsed;
        } catch (err: unknown) {
          replyText = `⚠️ **[Falha no Perplexity AI]:** ${(err as Error).message}\n\n*Alternando para o Motor Heurístico Local Offline...*\n\n`;
          const fallback = runOfflineHeuristicCopilot(prompt, snapshot);
          replyText += fallback.reply;
          actions = fallback.actions;
          providerUsed = 'offline';
        }
      } else if (config.provider === 'huggingface' && config.huggingfaceApiKey) {
        try {
          const res = await queryOpenAiCompatibleEndpoint(
            'https://api-inference.huggingface.co/v1',
            config.huggingfaceApiKey,
            config.huggingfaceModel,
            prompt,
            snapshot,
            enableMcp,
            { temperature: config.temperature, topP: config.topP, maxTokens: config.maxTokens }
          );
          replyText = res.reply;
          actions = res.actions;
          modelUsed = res.modelUsed;
        } catch (err: unknown) {
          replyText = `⚠️ **[Falha no HuggingFace Inference]:** ${(err as Error).message}\n\n*Alternando para o Motor Heurístico Local Offline...*\n\n`;
          const fallback = runOfflineHeuristicCopilot(prompt, snapshot);
          replyText += fallback.reply;
          actions = fallback.actions;
          providerUsed = 'offline';
        }
      } else if (config.provider === 'xai' && config.xaiApiKey) {
        try {
          const res = await queryOpenAiCompatibleEndpoint(
            'https://api.x.ai/v1',
            config.xaiApiKey,
            config.xaiModel,
            prompt,
            snapshot,
            enableMcp,
            { temperature: config.temperature, topP: config.topP, maxTokens: config.maxTokens }
          );
          replyText = res.reply;
          actions = res.actions;
          modelUsed = res.modelUsed;
        } catch (err: unknown) {
          replyText = `⚠️ **[Falha no xAI Grok]:** ${(err as Error).message}\n\n*Alternando para o Motor Heurístico Local Offline...*\n\n`;
          const fallback = runOfflineHeuristicCopilot(prompt, snapshot);
          replyText += fallback.reply;
          actions = fallback.actions;
          providerUsed = 'offline';
        }
      } else if (config.provider === 'mobile_offline') {
        try {
          const mobileRes = await runMobileOfflineInference(prompt, config.mobileModelId, {
            nodesCount: connectedStations.length,
            isLockdown: Boolean(securityData?.isLockdown),
            quarantinedCount: securityData?.quarantinedClients?.length || 0,
            batteryLevel: mobileCapabilities?.batteryStatus?.level,
          });
          replyText = mobileRes.reply;
          providerUsed = 'mobile_offline';
          modelUsed = `Mobile Offline (${config.mobileModelId})`;
        } catch {
          const fallback = runOfflineHeuristicCopilot(prompt, snapshot);
          replyText = fallback.reply;
          actions = fallback.actions;
          providerUsed = 'offline';
        }
      } else if (config.provider === 'custom') {
        try {
          const res = await queryOpenAiCompatibleEndpoint(
            config.customEndpoint,
            config.customApiKey,
            config.customModel,
            prompt,
            snapshot,
            enableMcp,
            { temperature: config.temperature, topP: config.topP, maxTokens: config.maxTokens }
          );
          replyText = res.reply;
          actions = res.actions;
          modelUsed = res.modelUsed;
        } catch (err: unknown) {
          replyText = `⚠️ **[Falha no Endpoint Customizado]:** ${(err as Error).message}\n\n*Alternando para o Motor Heurístico Local Offline...*\n\n`;
          const fallback = runOfflineHeuristicCopilot(prompt, snapshot);
          replyText += fallback.reply;
          actions = fallback.actions;
          providerUsed = 'offline';
        }
      } else {
        // Motor Heurístico Offline Padrão
        const res = runOfflineHeuristicCopilot(prompt, snapshot);
        replyText = res.reply;
        actions = res.actions;
        providerUsed = 'offline';
        modelUsed = 'Sentinel Heurístico Nativo';
      }

      // Calcular telemetria e velocidade da inferência
      const inferDurationMs = Math.round(performance.now() - (userMessage.timestamp || Date.now()));
      const estimatedTokens = Math.max(25, Math.round(replyText.length * 0.38));
      const tokensPerSec = Math.round((estimatedTokens / Math.max(0.1, inferDurationMs / 1000)));

      setLastMetrics({
        latencyMs: inferDurationMs,
        tokensPerSecond: tokensPerSec,
        tokensEstimated: estimatedTokens,
        hardwareUsed:
          config.provider === 'mobile_offline'
            ? 'Mobile WebGPU/WASM'
            : config.provider === 'offline'
            ? 'Motor Heurístico Local'
            : config.provider === 'ollama' || config.provider === 'lmstudio'
            ? 'GPU/CPU Host Local'
            : 'Nuvem Tática API',
      });

      const botMessage: CopilotMessage = {
        id: `bot_${Date.now()}`,
        role: 'assistant',
        content: replyText,
        timestamp: Date.now(),
        actions,
        providerUsed,
        modelUsed,
        metrics: {
          responseTimeMs: inferDurationMs,
          tokensPerSecond: tokensPerSec,
          hardwareUsed:
            config.provider === 'mobile_offline'
              ? 'WebGPU Mobile'
              : config.provider === 'offline'
              ? 'Local CPU'
              : 'Nuvem',
          isFullyOffline: config.provider === 'offline' || config.provider === 'mobile_offline' || config.provider === 'ollama' || config.provider === 'lmstudio',
        },
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err: unknown) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot_err_${Date.now()}`,
          role: 'assistant',
          content: `❌ Ocorreu uma falha ao processar a instrução: ${(err as Error).message}`,
          timestamp: Date.now(),
          providerUsed: 'offline',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Síntese de Voz TTS (SpeechSynthesis API nativa offline)
  const handleToggleSpeak = (msgId: string, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setActionNotice('⚠️ Síntese de voz não suportada pelo navegador.');
      return;
    }

    if (speakingMessageId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#`_•]/g, '').slice(0, 450);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.05;
    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);
    setSpeakingMessageId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  // Entrada de Voz STT (SpeechRecognition API)
  const handleToggleVoiceInput = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setActionNotice('⚠️ Reconhecimento de voz não suportado pelo navegador.');
      return;
    }

    if (isListening && speechRecognitionInstance) {
      speechRecognitionInstance.stop();
      setIsListening(false);
      return;
    }

    try {
      const recog = new SpeechRec();
      recog.lang = 'pt-BR';
      recog.continuous = false;
      recog.interimResults = false;

      recog.onstart = () => {
        setIsListening(true);
        setActionNotice('🎙️ Ouvindo... Fale sua instrução para o Sentinel AI.');
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recog.onresult = (event: any) => {
        const spoken = event.results[0]?.[0]?.transcript;
        if (spoken) {
          setInputPrompt((prev) => (prev ? `${prev} ${spoken}` : spoken));
          setActionNotice(`🗣️ Reconhecido: "${spoken}"`);
        }
      };

      recog.onerror = () => {
        setIsListening(false);
        setActionNotice('⚠️ Falha ao capturar microfone.');
      };

      recog.onend = () => {
        setIsListening(false);
      };

      recog.start();
      setSpeechRecognitionInstance(recog);
    } catch {
      setIsListening(false);
    }
  };

  // Armazenar modelo no cache do celular para uso 100% offline
  const handleCacheMobileModel = async (modelId: string) => {
    setCachingProgress({ modelId, percent: 10, status: 'Iniciando alocação de armazenamento...' });
    try {
      await cacheMobileModelForOffline(modelId, (percent, status) => {
        setCachingProgress({ modelId, percent, status });
      });

      const updated = Array.from(new Set([...cachedModelIds, modelId]));
      setCachedModelIds(updated);
      setActionNotice(`📱 Modelo gravado no cache do dispositivo com sucesso!`);
      setTimeout(() => {
        setCachingProgress(null);
        setActionNotice(null);
      }, 3000);
    } catch (err: unknown) {
      setCachingProgress({ modelId, percent: 0, status: `Erro: ${(err as Error).message}` });
    }
  };

  // Remover modelo do cache do celular
  const handleRemoveCachedMobileModel = async (modelId: string) => {
    await removeCachedMobileModel(modelId);
    setCachedModelIds((prev) => prev.filter((id) => id !== modelId));
    setActionNotice('🗑️ Modelo removido do cache do celular.');
    setTimeout(() => setActionNotice(null), 2500);
  };

  // Executar teste no Simulador Mobile Pocket AI
  const handleTestMobileSimulator = async () => {
    if (!mobileSimulatorPrompt.trim() || isMobileSimulatorLoading) return;
    setIsMobileSimulatorLoading(true);
    try {
      const res = await runMobileOfflineInference(mobileSimulatorPrompt, config.mobileModelId, {
        nodesCount: connectedStations.length,
        isLockdown: Boolean(securityData?.isLockdown),
        quarantinedCount: securityData?.quarantinedClients?.length || 0,
        batteryLevel: mobileCapabilities?.batteryStatus?.level,
      });
      setMobileSimulatorOutput(res.reply);
    } finally {
      setIsMobileSimulatorLoading(false);
    }
  };

  // Exportar histórico da conversa em Markdown
  const handleExportChatMarkdown = () => {
    const lines = [
      `# Relatório de Auditoria Tática - Sentinel AI Copilot`,
      `*Gerado em: ${new Date().toLocaleString()}*`,
      `*Provedor: ${config.provider} | Modelo: ${config.activeModel}*`,
      `---`,
      ``,
    ];

    for (const m of messages) {
      const roleName = m.role === 'user' ? 'ADMINISTRADOR' : m.role === 'system' ? 'SISTEMA' : 'SENTINEL AI';
      lines.push(`### [${new Date(m.timestamp).toLocaleTimeString()}] ${roleName}`);
      lines.push(m.content);
      if (m.actions && m.actions.length > 0) {
        lines.push(`*Ações MCP sugeridas:* ${m.actions.map((a) => a.label).join(', ')}`);
      }
      lines.push(``);
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentinel-ai-audit-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setActionNotice('📄 Relatório de auditoria exportado com sucesso!');
    setTimeout(() => setActionNotice(null), 3000);
  };

  // Executar Ação Tática Sugerida pela IA ou MCP
  const handleTriggerAction = async (action: CopilotActionSuggestion, messageId: string, actionIndex: number) => {
    const actionKey = `${messageId}_${actionIndex}`;
    if (executedActions.has(actionKey)) return;

    let success = false;

    if (onExecuteContainmentAction) {
      success = await onExecuteContainmentAction(action);
    } else {
      try {
        if (action.type === 'lockdown') {
          const enable = Boolean(action.payload?.enable);
          await fetch(`${serverUrl}/api/admin/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ action: 'lockdown', enabled: enable, reason: 'Disparado via Sentinel Copilot IA / MCP' }),
          });
          if (adminWs && adminWs.readyState === WebSocket.OPEN) {
            adminWs.send(JSON.stringify({ t: 'network-lockdown', enabled: enable, reason: 'DEFCON 1 acionado pela IA' }));
          }
          success = true;
        } else if (action.type === 'quarantine' && action.targetId) {
          await fetch(`${serverUrl}/api/admin/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ action: 'quarantine', clientId: action.targetId, reason: 'Contenção acionada pelo Sentinel IA / MCP' }),
          });
          if (adminWs && adminWs.readyState === WebSocket.OPEN) {
            adminWs.send(JSON.stringify({ t: 'remote-command', room: 'monitor', action: 'quarantine', targetClientId: action.targetId }));
          }
          success = true;
        } else if (action.type === 'unquarantine' && action.targetId) {
          await fetch(`${serverUrl}/api/admin/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ action: 'unquarantine', clientId: action.targetId }),
          });
          if (adminWs && adminWs.readyState === WebSocket.OPEN) {
            adminWs.send(JSON.stringify({ t: 'remote-command', room: 'monitor', action: 'unquarantine', targetClientId: action.targetId }));
          }
          success = true;
        } else if (action.type === 'kill_sensors' && action.targetId) {
          if (adminWs && adminWs.readyState === WebSocket.OPEN) {
            adminWs.send(JSON.stringify({ t: 'remote-command', room: 'monitor', action: 'kill-sensors', targetClientId: action.targetId }));
          }
          success = true;
        } else if (action.type === 'freeze_screen' && action.targetId) {
          if (adminWs && adminWs.readyState === WebSocket.OPEN) {
            adminWs.send(JSON.stringify({ t: 'remote-command', room: 'monitor', action: 'freeze-screen', targetClientId: action.targetId }));
          }
          success = true;
        } else if (action.type === 'eject' && action.targetId) {
          await fetch(`${serverUrl}/api/admin/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ action: 'eject', clientId: action.targetId, reason: 'Ejeção via Sentinel IA' }),
          });
          if (adminWs && adminWs.readyState === WebSocket.OPEN) {
            adminWs.send(JSON.stringify({ t: 'remote-command', room: 'monitor', action: 'eject', targetClientId: action.targetId }));
          }
          success = true;
        } else if (action.type === 'ban_ip' && action.payload?.ip) {
          await fetch(`${serverUrl}/api/admin/ban`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ip: action.payload.ip, reason: 'Banimento tático via MCP / IA', durationMinutes: 1440 }),
          });
          success = true;
        }
      } catch {
        success = false;
      }
    }

    if (success) {
      setExecutedActions((prev) => new Set([...prev, actionKey]));
      setActionNotice(`✓ Ação "${action.label}" executada com sucesso na malha!`);
      setTimeout(() => setActionNotice(null), 4000);
      onRefreshTelemetry();
    } else {
      setActionNotice(`❌ Falha ao executar "${action.label}". Verifique a conexão.`);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  // Salvar Regra de Aprendizado
  const handleSaveRule = () => {
    if (!newRuleInput.trim()) return;
    const created = addLearnedRule(newRuleInput.trim(), newRuleCategory);
    setLearnedRules((prev) => [...prev, created]);
    setNewRuleInput('');
    setActionNotice('🧠 Nova regra memorizada pelo Sentinel AI!');
    setTimeout(() => setActionNotice(null), 3000);
  };

  // Remover Regra
  const handleRemoveRule = (id: string) => {
    removeLearnedRule(id);
    setLearnedRules((prev) => prev.filter((r) => r.id !== id));
  };

  // Salvar Configurações de Provedores
  const handleSaveConfig = () => {
    saveCopilotConfig(config);
    setIsSettingsOpen(false);
    setActionNotice('⚙️ Configurações de IA salvas com sucesso!');
    setTimeout(() => setActionNotice(null), 3000);
  };

  // Alternador Rápido de Modelo / Provedor
  const handleQuickSwitchModel = (provider: CopilotProvider, modelName: string) => {
    const updated = { ...config, provider, activeModel: modelName };
    if (provider === 'ollama') updated.ollamaModel = modelName;
    if (provider === 'lmstudio') updated.lmstudioModel = modelName;
    if (provider === 'gemini') updated.geminiModel = modelName;
    if (provider === 'openai') updated.openaiModel = modelName;
    if (provider === 'anthropic') updated.anthropicModel = modelName;
    if (provider === 'groq') updated.groqModel = modelName;
    if (provider === 'deepseek') updated.deepseekModel = modelName;
    if (provider === 'openrouter') updated.openrouterModel = modelName;

    setConfig(updated);
    saveCopilotConfig(updated);
    setActionNotice(`Switched to: ${modelName} (${provider.toUpperCase()})`);
    setTimeout(() => setActionNotice(null), 3000);
  };

  // Formatação simples de Markdown
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('### ')) {
        return (
          <h4 key={idx} className="text-xs font-bold text-slate-100 uppercase tracking-wider mt-2.5 mb-1 text-cyan-300">
            {line.replace('### ', '')}
          </h4>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <h3 key={idx} className="text-sm font-bold text-slate-100 mt-3 mb-1 text-cyan-400">
            {line.replace('## ', '')}
          </h3>
        );
      }
      if (line.startsWith('• ') || line.startsWith('- ')) {
        return (
          <div key={idx} className="flex items-start gap-1.5 text-xs text-slate-300 my-0.5 pl-1">
            <span className="text-cyan-400">•</span>
            <span>{renderInlineStyles(line.slice(2))}</span>
          </div>
        );
      }
      if (!line.trim()) {
        return <div key={idx} className="h-1.5" />;
      }
      return (
        <p key={idx} className="text-xs text-slate-200 leading-relaxed my-0.5">
          {renderInlineStyles(line)}
        </p>
      );
    });
  };

  const renderInlineStyles = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-slate-100">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-cyan-300 font-mono text-[11px]">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  const quickPromptSuggestions = [
    '🔍 Analisar estações com anomalias de rede agora',
    '🚨 O que fazer se sofrermos um ataque de Flood DDoS?',
    '📊 Resumir reputação JJY e saúde dos nós',
    '🛠️ Listar e testar ferramentas MCP ativas',
    '🎙️ Como funciona a transmissão sísmica por giroscópio?',
  ];

  return (
    <div className="space-y-4 animate-in fade-in pb-10">
      {/* Notificação Flutuante */}
      {actionNotice && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-2xl bg-indigo-950/90 text-indigo-200 border border-indigo-600/60 backdrop-blur-md shadow-2xl flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-top">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* HEADER DO COPILOT & QUICK SWITCHER */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/50 to-slate-900 p-4.5 rounded-3xl border border-indigo-900/50 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-cyan-500 to-teal-400 p-0.5 shadow-lg shadow-indigo-950 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-cyan-400">
                <Bot className="w-6 h-6 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black text-slate-100 tracking-wide flex items-center gap-2">
                  <span>Sentinel AI Copilot</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/50 uppercase">
                    Universal LLM & MCP
                  </span>
                </h2>

                {/* Seletor Rápido de Provedor e Modelo */}
                <select
                  value={`${config.provider}:${config.activeModel}`}
                  onChange={(e) => {
                    const [p, m] = e.target.value.split(':');
                    handleQuickSwitchModel(p as CopilotProvider, m);
                  }}
                  className="bg-slate-950 border border-slate-700 text-cyan-300 text-xs rounded-xl px-2.5 py-1 font-mono focus:outline-none focus:border-cyan-500 cursor-pointer shadow-inner"
                >
                  <optgroup label="📱 IA para Celular (100% Offline)">
                    <option value="mobile_offline:sentinel-nano-heuristic">📱 Celular: Sentinel Nano (0 MB Instantâneo)</option>
                    <option value="mobile_offline:smollm2-135m-mobile">📱 Celular: SmolLM2 135M (~142 MB WebGPU)</option>
                    <option value="mobile_offline:qwen2.5-0.5b-mobile">📱 Celular: Qwen 2.5 0.5B (~398 MB)</option>
                    <option value="mobile_offline:llama3.2-1b-mobile">📱 Celular: Llama 3.2 1B (~880 MB)</option>
                  </optgroup>

                  <optgroup label="🟢 100% Offline Host (Sem Internet)">
                    <option value="offline:Nativo Heurístico (Zero-Config)">Motor Heurístico Nativo SOC</option>
                    {discoveredModels.map((m) => (
                      <option key={`disc_${m}`} value={`ollama:${m}`}>
                        Ollama: {m}
                      </option>
                    ))}
                    {customModels.map((cm) => (
                      <option key={`cust_${cm.id}`} value={`${cm.source === 'ollama_download' ? 'ollama' : 'lmstudio'}:${cm.name}`}>
                        📦 {cm.name} ({cm.sizeFormatted || cm.quantization || 'Custom'})
                      </option>
                    ))}
                    <option value="lmstudio:local-model">LM Studio / llama.cpp</option>
                  </optgroup>

                  <optgroup label="⚡ Nuvem de Alta Velocidade (Ultra-Fast)">
                    <option value="groq:llama-3.3-70b-versatile">Groq: Llama 3.3 70B Versatile</option>
                    <option value="groq:deepseek-r1-distill-llama-70b">Groq: DeepSeek R1 70B Distill</option>
                    <option value="together:meta-llama/Llama-3.3-70B-Instruct-Turbo">Together AI: Llama 3.3 70B Turbo</option>
                    <option value="deepseek:deepseek-chat">DeepSeek-V3 Chat Oficial</option>
                    <option value="deepseek:deepseek-reasoner">DeepSeek-R1 Reasoner Oficial</option>
                  </optgroup>

                  <optgroup label="✨ Google Gemini">
                    <option value="gemini:gemini-2.0-flash">Gemini 2.0 Flash</option>
                    <option value="gemini:gemini-1.5-pro">Gemini 1.5 Pro</option>
                    <option value="gemini:gemini-1.5-flash">Gemini 1.5 Flash</option>
                  </optgroup>

                  <optgroup label="🧠 OpenAI & Anthropic Claude">
                    <option value="openai:gpt-4o">OpenAI GPT-4o</option>
                    <option value="openai:gpt-4o-mini">OpenAI GPT-4o-mini</option>
                    <option value="openai:o3-mini">OpenAI o3-mini</option>
                    <option value="anthropic:claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                    <option value="anthropic:claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                  </optgroup>

                  <optgroup label="🌐 Hubs Expandidos (Mistral, Perplexity, xAI, OpenRouter)">
                    <option value="mistral:mistral-large-latest">Mistral Large Latest</option>
                    <option value="perplexity:sonar">Perplexity Sonar (Web Grounding)</option>
                    <option value="xai:grok-beta">xAI Grok Beta</option>
                    <option value="huggingface:meta-llama/Llama-3.2-3B-Instruct">HuggingFace Inference</option>
                    <option value="openrouter:openrouter/auto">OpenRouter Auto Routing</option>
                    <option value="custom:default">Endpoint Customizado Local/Remoto</option>
                  </optgroup>
                </select>
              </div>

              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Raciocínio com telemetria da malha Mesh, catálogo de ferramentas MCP e suporte 100% offline para smartphone.
              </p>
            </div>
          </div>

          {/* Botões de Ação do Header */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* BOTÃO MASTER LIGA / DESLIGA DA IA */}
            <button
              type="button"
              onClick={handleToggleAiPower}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
                config.isAiPowered
                  ? 'bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/70 text-emerald-300'
                  : 'bg-rose-950 hover:bg-rose-900 border border-rose-500 text-rose-200 animate-pulse'
              }`}
              title={config.isAiPowered ? 'Clique para DESLIGAR a IA (Silenciar/Standby)' : 'Clique para LIGAR o Sentinel AI'}
            >
              {config.isAiPowered ? (
                <>
                  <Power className="w-3.5 h-3.5 text-emerald-400" />
                  <span>IA Ligada</span>
                </>
              ) : (
                <>
                  <PowerOff className="w-3.5 h-3.5 text-rose-400" />
                  <span>IA Desligada</span>
                </>
              )}
            </button>

            {/* BOTÃO DE IA PARA CELULAR OFFLINE */}
            <button
              type="button"
              onClick={() => setIsMobileModalOpen(true)}
              className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600/30 via-teal-600/20 to-cyan-600/30 hover:from-emerald-600/40 hover:to-cyan-600/40 border border-emerald-500/60 text-emerald-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95 animate-pulse"
              title="Abrir Central de IA para Celular 100% Offline e QR Code"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span>IA para Celular Offline</span>
            </button>

            {/* BOTÃO INSTALAR / CARREGAR PRÓPRIA LLM */}
            <button
              type="button"
              onClick={() => setIsInstallerOpen(true)}
              className="px-3 py-1.5 bg-gradient-to-r from-teal-950 to-indigo-950 hover:from-teal-900 hover:to-indigo-900 border border-teal-600/70 text-teal-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95"
              title="Carregar arquivo de modelo próprio .GGUF ou baixar direto do Ollama"
            >
              <HardDriveDownload className="w-3.5 h-3.5 text-teal-400" />
              <span>Instalar / Carregar LLM</span>
              {customModels.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-teal-800 text-teal-100 text-[10px] font-bold">
                  {customModels.length}
                </span>
              )}
            </button>

            {/* BOTÃO DO MONITOR DE HARDWARE & TELEMETRIA */}
            <button
              type="button"
              onClick={() => setIsHardwareHudOpen(!isHardwareHudOpen)}
              className={`px-2.5 py-1.5 border text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-sm ${
                isHardwareHudOpen
                  ? 'bg-cyan-950 border-cyan-500 text-cyan-200'
                  : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
              title="Exibir ou ocultar monitor de CPU, Memória RAM, Placa de Vídeo, Buffers e Tokens/s"
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Hardware & Tokens</span>
            </button>

            {/* BOTÃO DE PARÂMETROS DE GERAÇÃO */}
            <button
              type="button"
              onClick={() => setIsParamsOpen(!isParamsOpen)}
              className={`px-2.5 py-1.5 border text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-sm ${
                isParamsOpen
                  ? 'bg-cyan-950 border-cyan-500 text-cyan-200'
                  : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
              title="Ajustar Temperatura, Top-P e Tokens"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
              <span>Parâmetros</span>
            </button>

            <button
              type="button"
              onClick={handleScanLocalModels}
              disabled={isScanningLocalModels}
              className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
              title="Varrer modelos instalados no Ollama (localhost:11434) e LM Studio"
            >
              <Search className={`w-3.5 h-3.5 text-cyan-400 ${isScanningLocalModels ? 'animate-spin' : ''}`} />
              <span>{isScanningLocalModels ? 'Varrendo...' : `Locais (${discoveredModels.length})`}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMcpModalOpen(true)}
              className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
              title="Ver ferramentas MCP disponíveis"
            >
              <Cpu className="w-3.5 h-3.5 text-teal-400" />
              <span>MCP ({MCP_TOOLS_CATALOG.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMemoryOpen(true)}
              className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
              title="Ver e adicionar regras aprendidas pela IA"
            >
              <Brain className="w-3.5 h-3.5 text-indigo-400" />
              <span>Memória ({learnedRules.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
              title="Configurar chaves de API e endpoints"
            >
              <Settings className="w-3.5 h-3.5 text-cyan-400" />
              <span>Configurar</span>
            </button>

            <button
              type="button"
              onClick={handleExportChatMarkdown}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs rounded-xl transition-all"
              title="Exportar auditoria da conversa em Markdown"
            >
              <Download className="w-3.5 h-3.5 text-slate-300" />
            </button>

            <button
              type="button"
              onClick={() =>
                setMessages([
                  {
                    id: `msg_${Date.now()}`,
                    role: 'assistant',
                    content: '🧹 Conversa reinicializada. Como posso ajudar com a segurança do sistema?',
                    timestamp: Date.now(),
                    providerUsed: 'offline',
                  },
                ])
              }
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs rounded-xl transition-all"
              title="Limpar histórico da conversa"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* GAVETA DE PARÂMETROS AVANÇADOS (SLIDERS) */}
        {isParamsOpen && (
          <div className="mt-3.5 p-3.5 bg-slate-950/90 rounded-2xl border border-cyan-900/50 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs animate-in slide-in-from-top">
            <div>
              <div className="flex justify-between text-slate-300 font-semibold mb-1">
                <span>Temperatura: {config.temperature ?? 0.7}</span>
                <span className="text-[10px] text-cyan-400">{config.temperature < 0.4 ? 'Preciso/Tático' : 'Criativo'}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={config.temperature ?? 0.7}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  const updated = { ...config, temperature: val };
                  setConfig(updated);
                  saveCopilotConfig(updated);
                }}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 font-semibold mb-1">
                <span>Top-P Sampling: {config.topP ?? 0.9}</span>
                <span className="text-[10px] text-teal-400">Nucleus Sampling</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={config.topP ?? 0.9}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  const updated = { ...config, topP: val };
                  setConfig(updated);
                  saveCopilotConfig(updated);
                }}
                className="w-full accent-teal-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 font-semibold mb-1">
                <span>Max Tokens: {config.maxTokens ?? 2048}</span>
                <span className="text-[10px] text-indigo-400">Comprimento Resposta</span>
              </div>
              <input
                type="range"
                min="256"
                max="4096"
                step="128"
                value={config.maxTokens ?? 2048}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  const updated = { ...config, maxTokens: val };
                  setConfig(updated);
                  saveCopilotConfig(updated);
                }}
                className="w-full accent-indigo-400 cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Fita de Telemetria Contextual com Métricas em Tempo Real */}
        <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-2">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${config.isAiPowered ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`} />
              <strong className="text-slate-300">{connectedStations.length}</strong> Nós Conectados
            </span>
            <span className="flex items-center gap-1.5">
              <Power className={`w-3.5 h-3.5 ${config.isAiPowered ? 'text-emerald-400' : 'text-rose-400'}`} />
              IA Power: <strong className={config.isAiPowered ? 'text-emerald-400' : 'text-rose-400'}>
                {config.isAiPowered ? 'Ativa' : 'Desligada'}
              </strong>
            </span>
            <span className="flex items-center gap-1.5 font-mono">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Latência: <strong className="text-amber-300">{lastMetrics.latencyMs ?? 85}ms</strong>
            </span>
            <span className="flex items-center gap-1.5 font-mono">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              Velocidade: <strong className="text-cyan-300">{lastMetrics.tokensPerSecond ?? 42} t/s</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <strong className="text-slate-300">{securityData?.quarantinedClients?.length || 0}</strong> Quarentenas
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-cyan-400" />
              DEFCON 1: <strong className={securityData?.isLockdown ? 'text-rose-400' : 'text-emerald-400'}>
                {securityData?.isLockdown ? 'Ativo' : 'Normal'}
              </strong>
            </span>
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-teal-400" />
              MCP: <strong className={config.enableMcpTools ? 'text-teal-400' : 'text-slate-500'}>
                {config.enableMcpTools ? 'On' : 'Off'}
              </strong>
            </span>
          </div>

          <button
            type="button"
            onClick={onRefreshTelemetry}
            className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Atualizar Contexto
          </button>
        </div>
      </div>

      {/* PAINEL DE HARDWARE: CPU, RAM, GPU, BUFFERS & TOKENS/S */}
      {isHardwareHudOpen && (
        <HardwareTelemetryHUD
          serverUrl={serverUrl}
          token={token}
          adminWs={adminWs}
          lastMetrics={lastMetrics}
          activeModelName={config.activeModel}
          provider={config.provider}
          maxTokensLimit={config.maxTokens ?? 2048}
          currentContextTokens={messages.reduce((acc, m) => acc + Math.round(m.content.length / 4), 0)}
          onFlushBuffers={() => {
            setActionNotice('🧹 Buffers de memória e filas transitórias esvaziados com sucesso!');
            setTimeout(() => setActionNotice(null), 3000);
          }}
        />
      )}

      {/* ÁREA PRINCIPAL DO CHAT */}
      <div className="bg-slate-900/60 rounded-3xl border border-slate-800 flex flex-col h-[540px] shadow-xl overflow-hidden">
        {/* Stream de Mensagens */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {/* Banner Tático de IA Desligada */}
          {!config.isAiPowered && (
            <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-600/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-900/60 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                  <PowerOff className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-bold text-rose-200">Sentinel AI Copilot Desligado pelo Administrador</h4>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    O processamento autônomo, chamadas de inferência de modelo e APIs externas estão suspensos. Modo Tático Manual ativo.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleAiPower}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shrink-0 transition-all shadow-md shadow-rose-950 active:scale-95"
              >
                <Power className="w-4 h-4" /> Ligar IA Agora
              </button>
            </div>
          )}

          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                    isUser
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-950'
                      : 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-md shadow-indigo-950'
                  }`}
                >
                  {isUser ? 'AD' : <Bot className="w-4 h-4" />}
                </div>

                {/* Balão da Mensagem */}
                <div
                  className={`p-3.5 rounded-2xl space-y-2 text-xs transition-all ${
                    isUser
                      ? 'bg-rose-950/70 border border-rose-600/40 text-slate-100 shadow-md rounded-tr-none'
                      : 'bg-slate-950/80 border border-slate-800 text-slate-200 shadow-md rounded-tl-none'
                  }`}
                >
                  {/* Conteúdo formatado */}
                  <div>{renderFormattedContent(msg.content)}</div>

                  {/* Ações Táticas Recomendadas ou MCP */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/80 space-y-1.5 mt-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Ações / Execução de Ferramentas MCP:
                      </span>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {msg.actions.map((act, actIdx) => {
                          const actionKey = `${msg.id}_${actIdx}`;
                          const isDone = executedActions.has(actionKey);

                          return (
                            <button
                              key={actIdx}
                              type="button"
                              disabled={isDone}
                              onClick={() => handleTriggerAction(act, msg.id, actIdx)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
                                isDone
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/60 cursor-default'
                                  : act.type === 'lockdown' || act.type === 'quarantine' || act.type === 'eject'
                                  ? 'bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-600/60 hover:border-rose-400'
                                  : 'bg-indigo-950 hover:bg-indigo-900 text-indigo-200 border border-indigo-600/60 hover:border-indigo-400'
                              }`}
                            >
                              {isDone ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Executado com Sucesso</span>
                                </>
                              ) : (
                                <>
                                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                                  <span>{act.label}</span>
                                </>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Rodapé da mensagem com TTS, Copiar e Métricas */}
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-slate-800/60 mt-1">
                    <div className="flex items-center gap-2">
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {!isUser && (
                        <>
                          <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400 px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800">
                            {msg.modelUsed || msg.providerUsed || 'offline'}
                          </span>
                          {msg.metrics?.responseTimeMs && (
                            <span className="font-mono text-[9px] text-amber-400/80">
                              ⚡ {msg.metrics.responseTimeMs}ms
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {!isUser && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleSpeak(msg.id, msg.content)}
                          className="p-1 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-900 transition-colors"
                          title={speakingMessageId === msg.id ? 'Parar leitura por voz' : 'Ouvir resposta (Síntese de Voz Offline)'}
                        >
                          {speakingMessageId === msg.id ? (
                            <VolumeX className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(msg.content);
                            setActionNotice('📋 Resposta copiada para a área de transferência!');
                            setTimeout(() => setActionNotice(null), 2000);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors"
                          title="Copiar texto"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Indicador de Digitação */}
          {isLoading && (
            <div className="flex gap-3 max-w-[80%] mr-auto items-center text-xs text-slate-400">
              <div className="w-8 h-8 rounded-xl bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.4s]" />
                <span className="text-[11px] text-slate-400 ml-1">Sentinel AI executando raciocínio ({config.activeModel})...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Sugestões de Prompt Rápido */}
        <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800/80 overflow-x-auto flex items-center gap-1.5 no-scrollbar">
          <span className="text-[10px] text-slate-500 uppercase font-bold shrink-0 flex items-center gap-1">
            <Lightbulb className="w-3 h-3 text-amber-400" /> Sugestões:
          </span>
          {quickPromptSuggestions.map((sug, i) => (
            <button
              key={i}
              type="button"
              disabled={isLoading || !config.isAiPowered}
              onClick={() => handleSendMessage(sug)}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 hover:border-slate-700 text-slate-300 whitespace-nowrap transition-all active:scale-95 shrink-0"
            >
              {sug}
            </button>
          ))}
        </div>

        {/* Input Bar com Microfone STT integrado */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
          {/* Botão de Entrada por Voz (STT) */}
          <button
            type="button"
            onClick={handleToggleVoiceInput}
            disabled={!config.isAiPowered}
            className={`p-2.5 rounded-2xl border text-xs transition-all flex items-center justify-center shrink-0 ${
              isListening
                ? 'bg-rose-950 border-rose-500 text-rose-300 animate-pulse shadow-md shadow-rose-950'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-cyan-300'
            }`}
            title={isListening ? 'Parar gravação de voz' : 'Falar comando por voz (STT)'}
          >
            {isListening ? <MicOff className="w-4 h-4 text-rose-400" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            type="text"
            placeholder={
              !config.isAiPowered
                ? 'IA DESLIGADA pelo administrador. Clique em "Ligar IA" no topo para reativar...'
                : isListening
                ? 'Gravando sua voz... Fale agora...'
                : `Pergunte ao Sentinel AI (${config.activeModel}) sobre a rede ou peça para executar ferramentas MCP...`
            }
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={isLoading || !config.isAiPowered}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
          />

          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!inputPrompt.trim() || isLoading || !config.isAiPowered}
            className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-2xl transition-all shadow-md shadow-indigo-950 flex items-center gap-1.5 active:scale-95 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Enviar</span>
          </button>
        </div>
      </div>

      {/* MODAL 1: FERRAMENTAS MCP DO SISTEMA */}
      {isMcpModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-950 text-teal-400 border border-teal-800/50">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100">Catálogo de Ferramentas MCP (Model Context Protocol)</h3>
                  <p className="text-xs text-slate-400">Ferramentas que qualquer LLM pode acionar autonomamente</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMcpModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
              <span className="text-slate-300 font-semibold">Tool Calling via MCP Ativado:</span>
              <button
                type="button"
                onClick={() => {
                  const updated = { ...config, enableMcpTools: !config.enableMcpTools };
                  setConfig(updated);
                  saveCopilotConfig(updated);
                }}
                className={`px-3 py-1 rounded-xl font-bold transition-all ${
                  config.enableMcpTools
                    ? 'bg-teal-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {config.enableMcpTools ? '✓ Ativado' : '✕ Desativado'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs">
              {MCP_TOOLS_CATALOG.map((tool) => (
                <div key={tool.name} className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-cyan-300">{tool.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-400 uppercase font-mono">
                      {tool.category}
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">{tool.description}</p>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Parâmetros: {Object.keys(tool.parameters.properties).join(', ') || 'nenhum'}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsMcpModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIGURAÇÃO DE PROVEDORES DE IA UNIVERSAL */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800/50">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100">Configuração de Provedores e APIs de LLM</h3>
                  <p className="text-xs text-slate-400">Suporte universal para LLMs locais 100% offline ou nuvem</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Ollama Local */}
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                <span className="font-bold text-cyan-400 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" /> Ollama Local (100% Offline)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-400 block mb-1">Endpoint:</label>
                    <input
                      type="text"
                      value={config.ollamaEndpoint}
                      onChange={(e) => setConfig({ ...config, ollamaEndpoint: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Modelo:</label>
                    <input
                      type="text"
                      value={config.ollamaModel}
                      onChange={(e) => setConfig({ ...config, ollamaModel: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* LM Studio Local */}
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5" /> LM Studio / LocalAI / llama.cpp (100% Offline)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-400 block mb-1">Endpoint Base:</label>
                    <input
                      type="text"
                      value={config.lmstudioEndpoint}
                      onChange={(e) => setConfig({ ...config, lmstudioEndpoint: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">ID do Modelo:</label>
                    <input
                      type="text"
                      value={config.lmstudioModel}
                      onChange={(e) => setConfig({ ...config, lmstudioModel: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Google Gemini */}
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Google Gemini
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-400 block mb-1">API Key:</label>
                    <input
                      type="password"
                      placeholder="AIzaSy..."
                      value={config.geminiApiKey}
                      onChange={(e) => setConfig({ ...config, geminiApiKey: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Modelo:</label>
                    <input
                      type="text"
                      value={config.geminiModel}
                      onChange={(e) => setConfig({ ...config, geminiModel: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* OpenAI, DeepSeek & Groq */}
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                <span className="font-bold text-purple-400 flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5" /> OpenAI, DeepSeek & Groq APIs
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-slate-400 block mb-1">OpenAI Key:</label>
                    <input
                      type="password"
                      placeholder="sk-..."
                      value={config.openaiApiKey}
                      onChange={(e) => setConfig({ ...config, openaiApiKey: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">DeepSeek Key:</label>
                    <input
                      type="password"
                      placeholder="sk-..."
                      value={config.deepseekApiKey}
                      onChange={(e) => setConfig({ ...config, deepseekApiKey: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Groq Key:</label>
                    <input
                      type="password"
                      placeholder="gsk_..."
                      value={config.groqApiKey}
                      onChange={(e) => setConfig({ ...config, groqApiKey: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Together AI & Mistral */}
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                <span className="font-bold text-teal-400 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> Together AI & Mistral AI
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-400 block mb-1">Together API Key:</label>
                    <input
                      type="password"
                      placeholder="tog_..."
                      value={config.togetherApiKey}
                      onChange={(e) => setConfig({ ...config, togetherApiKey: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Mistral API Key:</label>
                    <input
                      type="password"
                      placeholder="mis_..."
                      value={config.mistralApiKey}
                      onChange={(e) => setConfig({ ...config, mistralApiKey: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Perplexity & xAI Grok */}
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                <span className="font-bold text-amber-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> Perplexity & xAI (Grok)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-400 block mb-1">Perplexity Key:</label>
                    <input
                      type="password"
                      placeholder="pplx-..."
                      value={config.perplexityApiKey}
                      onChange={(e) => setConfig({ ...config, perplexityApiKey: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">xAI (Grok) Key:</label>
                    <input
                      type="password"
                      placeholder="xai-..."
                      value={config.xaiApiKey}
                      onChange={(e) => setConfig({ ...config, xaiApiKey: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Custom Endpoint & OpenRouter */}
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                <span className="font-bold text-indigo-400 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> Endpoint Customizado & OpenRouter
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-slate-400 block mb-1">URL Base Customizada:</label>
                    <input
                      type="text"
                      placeholder="https://sua-api.com/v1"
                      value={config.customEndpoint}
                      onChange={(e) => setConfig({ ...config, customEndpoint: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Modelo Custom:</label>
                    <input
                      type="text"
                      value={config.customModel}
                      onChange={(e) => setConfig({ ...config, customModel: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-200 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-950 transition-all"
              >
                Salvar Configurações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: MEMÓRIA & REGRAS APRENDIDAS PELA IA */}
      {isMemoryOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-950 text-indigo-400 border border-indigo-800/50">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100">Memória de Regras do Administrador</h3>
                  <p className="text-xs text-slate-400">Instruções permanentes que o Sentinel AI aprende e respeita</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMemoryOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 p-3 bg-slate-950 rounded-2xl border border-slate-800 text-xs">
              <label className="text-slate-300 font-semibold block">Ensinar Nova Regra / Observação:</label>
              <textarea
                rows={2}
                placeholder="Ex: O terminal 03 é exclusivo para a gerência e não deve ter a câmera ativada..."
                value={newRuleInput}
                onChange={(e) => setNewRuleInput(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 text-xs"
              />
              <div className="flex items-center justify-between gap-2 pt-1">
                <select
                  value={newRuleCategory}
                  onChange={(e) => setNewRuleCategory(e.target.value as CopilotLearnedRule['category'])}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-300 text-xs"
                >
                  <option value="security">Segurança</option>
                  <option value="network">Rede / Conectividade</option>
                  <option value="architecture">Arquitetura</option>
                  <option value="admin_note">Nota do Administrador</option>
                </select>
                <button
                  type="button"
                  onClick={handleSaveRule}
                  disabled={!newRuleInput.trim()}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold rounded-xl text-xs flex items-center gap-1 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Memorizar
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Regras Ativas na Memória ({learnedRules.length}):
              </span>
              {learnedRules.map((r) => (
                <div
                  key={r.id}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start justify-between gap-2 text-xs"
                >
                  <div>
                    <span className="text-[10px] uppercase font-bold text-indigo-400 px-1.5 py-0.2 rounded bg-indigo-950 border border-indigo-800/40 inline-block mb-1">
                      {r.category}
                    </span>
                    <p className="text-slate-200 leading-snug">{r.rule}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveRule(r.id)}
                    className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                    title="Excluir regra"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsMemoryOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: INSTALADOR E GERENCIADOR DE LLM LOCAL */}
      {isInstallerOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            {/* Header do Modal */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-950 text-teal-400 border border-teal-800/50">
                  <HardDriveDownload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100">Instalador & Carregador de LLMs Locais</h3>
                  <p className="text-xs text-slate-400">Instale modelos no Ollama ou vincule seus arquivos .GGUF locais</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInstallerOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Abas de Navegação */}
            <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800/80 text-xs">
              <button
                type="button"
                onClick={() => setInstallerTab('download')}
                className={`flex-1 py-1.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
                  installerTab === 'download'
                    ? 'bg-teal-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                <span>Instalar via Ollama</span>
              </button>
              <button
                type="button"
                onClick={() => setInstallerTab('gguf')}
                className={`flex-1 py-1.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
                  installerTab === 'gguf'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <FolderUp className="w-3.5 h-3.5" />
                <span>Carregar Arquivo .GGUF</span>
              </button>
              <button
                type="button"
                onClick={() => setInstallerTab('manage')}
                className={`flex-1 py-1.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
                  installerTab === 'manage'
                    ? 'bg-slate-800 text-cyan-300 shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>Gerenciar ({customModels.length})</span>
              </button>
            </div>

            {/* Conteúdo da Aba */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* ABA 1: DOWNLOAD OLLAMA */}
              {installerTab === 'download' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                    <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                      <span>Nome do Modelo no Ollama Hub:</span>
                      <span className="text-[11px] text-teal-400 font-mono">Endpoint: {config.ollamaEndpoint}</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={pullModelInput}
                        onChange={(e) => setPullModelInput(e.target.value)}
                        placeholder="Ex: deepseek-r1:1.5b, llama3.2:1b, mistral:7b, qwen2.5:0.5b..."
                        disabled={isPulling}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-teal-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleStartPullModel()}
                        disabled={isPulling || !pullModelInput.trim()}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95 shrink-0"
                      >
                        {isPulling ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <HardDriveDownload className="w-3.5 h-3.5" />}
                        <span>{isPulling ? 'Baixando...' : 'Instalar'}</span>
                      </button>
                    </div>

                    {/* Chips com Modelos Populares Recomendados */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                        Modelos Recomendados para Download com 1-Clique:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {[
                          { name: 'deepseek-r1:1.5b', desc: 'Raciocínio Leve & Tático', size: '~1.1 GB' },
                          { name: 'llama3.2:1b', desc: 'Meta Llama 3.2 Ultra-Rápido', size: '~1.3 GB' },
                          { name: 'qwen2.5:0.5b', desc: 'Nano Modelo (Ideal p/ Mini PC)', size: '~390 MB' },
                          { name: 'mistral:7b', desc: 'Equilíbrio e Alta Precisão', size: '~4.1 GB' },
                          { name: 'phi3:mini', desc: 'Microsoft Phi-3 Leve', size: '~2.2 GB' },
                          { name: 'codellama:7b', desc: 'Especialista em Scripts/Código', size: '~3.8 GB' },
                        ].map((item) => (
                          <div
                            key={item.name}
                            onClick={() => {
                              if (!isPulling) {
                                setPullModelInput(item.name);
                              }
                            }}
                            className={`p-2 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between ${
                              pullModelInput === item.name
                                ? 'bg-teal-950/60 border-teal-500 text-teal-200'
                                : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-300'
                            }`}
                          >
                            <div>
                              <div className="font-mono font-bold text-xs">{item.name}</div>
                              <div className="text-[10px] text-slate-400">{item.desc}</div>
                            </div>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-teal-400">
                              {item.size}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Progresso de Download / Streaming */}
                  {pullProgress && (
                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-teal-800/60 space-y-2 animate-in fade-in">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-teal-300 flex items-center gap-1.5">
                          <DownloadCloud className="w-4 h-4 animate-bounce text-teal-400" />
                          <span>Status do Ollama:</span>
                        </span>
                        {pullProgress.percent !== undefined && (
                          <span className="font-mono font-bold text-teal-400">{pullProgress.percent}%</span>
                        )}
                      </div>

                      <div className="text-xs font-mono text-slate-300 bg-slate-900 p-2 rounded-xl border border-slate-800 truncate">
                        {pullProgress.status}
                      </div>

                      {pullProgress.percent !== undefined && (
                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-teal-500 to-cyan-400 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, pullProgress.percent)}%` }}
                          />
                        </div>
                      )}

                      {pullProgress.completed && pullProgress.total && (
                        <div className="text-[11px] text-slate-400 text-right font-mono">
                          {(pullProgress.completed / (1024 * 1024)).toFixed(1)} MB / {(pullProgress.total / (1024 * 1024)).toFixed(1)} MB
                        </div>
                      )}

                      {pullProgress.error && (
                        <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-600 text-rose-200 text-xs flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                          <span>{pullProgress.error}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ABA 2: CARREGAR ARQUIVO GGUF */}
              {installerTab === 'gguf' && (
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-slate-950 border-2 border-dashed border-slate-700 hover:border-indigo-500/80 text-center transition-all">
                    <input
                      type="file"
                      id="ggufFileInput"
                      accept=".gguf,.bin,.pt,.onnx"
                      onChange={handleGgufFileChange}
                      className="hidden"
                    />
                    <label htmlFor="ggufFileInput" className="cursor-pointer flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-950/80 border border-indigo-700/60 flex items-center justify-center text-indigo-400 shadow-md">
                        <FolderUp className="w-6 h-6" />
                      </div>
                      <div className="text-xs font-bold text-slate-100">
                        {selectedGgufFile ? selectedGgufFile.name : 'Clique para selecionar seu arquivo de modelo local'}
                      </div>
                      <p className="text-[11px] text-slate-400 max-w-sm">
                        Suporte a arquivos compilados de pesos de modelos locais: <strong className="text-indigo-300">.GGUF, .BIN, .PT, .ONNX</strong>
                      </p>
                      {selectedGgufFile && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-900/60 text-indigo-300 text-[11px] font-mono border border-indigo-700/40">
                          Tamanho: {(selectedGgufFile.size / (1024 * 1024 * 1024)).toFixed(2)} GB
                        </span>
                      )}
                    </label>
                  </div>

                  {selectedGgufFile && (
                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                            Nome de Identificação no Sistema:
                          </label>
                          <input
                            type="text"
                            value={ggufFriendlyName}
                            onChange={(e) => setGgufFriendlyName(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                            Quantização / Precisão:
                          </label>
                          <select
                            value={ggufQuantization}
                            onChange={(e) => setGgufQuantization(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                          >
                            <option value="Q4_K_M">Q4_K_M (Recomendado / Balanceado)</option>
                            <option value="Q5_K_M">Q5_K_M (Maior Fidelidade)</option>
                            <option value="Q8_0">Q8_0 (Alta Precisão)</option>
                            <option value="FP16">FP16 / BF16 (Precisão Total)</option>
                            <option value="Q2_K">Q2_K (Ultra Compacto)</option>
                          </select>
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">
                          Será registrado no catálogo e vinculado ao motor local LM Studio / llama.cpp
                        </span>
                        <button
                          type="button"
                          onClick={handleRegisterGgufModel}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Registrar e Ativar no Painel</span>
                        </button>
                      </div>

                      {/* Guia de Modelfile do Ollama */}
                      <div className="mt-2 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                        <span className="font-bold text-cyan-400 flex items-center gap-1">
                          <Terminal className="w-3.5 h-3.5" /> Dica: Usar no Ollama via Linha de Comando:
                        </span>
                        <div className="font-mono bg-slate-950 p-2 rounded-lg text-teal-300 text-[10px] select-all overflow-x-auto">
                          echo "FROM ./{selectedGgufFile.name}" &gt; Modelfile && ollama create {ggufFriendlyName || 'meu-modelo'} -f Modelfile
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ABA 3: GERENCIAR MODELOS */}
              {installerTab === 'manage' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
                    <span>Modelos Locais Registrados no Catálogo:</span>
                    <button
                      type="button"
                      onClick={handleScanLocalModels}
                      className="text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Re-escanear
                    </button>
                  </div>

                  {customModels.length === 0 && discoveredModels.length === 0 ? (
                    <div className="p-8 text-center bg-slate-950 rounded-2xl border border-slate-800 text-slate-400 text-xs">
                      Nenhum modelo customizado registrado ainda. Use a aba "Instalar via Ollama" ou "Carregar Arquivo .GGUF".
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {customModels.map((cm) => {
                        const isActive = config.activeModel === cm.name;
                        return (
                          <div
                            key={cm.id}
                            className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                              isActive
                                ? 'bg-indigo-950/40 border-indigo-500/60 shadow-md'
                                : 'bg-slate-950 border-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`p-2 rounded-xl text-xs font-bold ${
                                  cm.source === 'ollama_download'
                                    ? 'bg-teal-950 text-teal-300 border border-teal-800/50'
                                    : 'bg-indigo-950 text-indigo-300 border border-indigo-800/50'
                                }`}
                              >
                                {cm.source === 'ollama_download' ? <DownloadCloud className="w-4 h-4" /> : <HardDrive className="w-4 h-4" />}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-slate-100 font-mono">{cm.name}</span>
                                  {isActive && (
                                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600/50 text-[10px] font-bold">
                                      Ativo Agora
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                  <span>{cm.source === 'ollama_download' ? 'Ollama Pull' : 'Arquivo GGUF'}</span>
                                  {cm.sizeFormatted && <span>• {cm.sizeFormatted}</span>}
                                  {cm.quantization && <span>• {cm.quantization}</span>}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {!isActive && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const prov = cm.source === 'ollama_download' ? 'ollama' : 'lmstudio';
                                    handleQuickSwitchModel(prov, cm.name);
                                  }}
                                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all"
                                >
                                  Ativar
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomModel(cm)}
                                className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition-colors"
                                title="Remover modelo do catálogo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Os modelos locais operam 100% offline dentro da máquina sem envio de dados.
              </span>
              <button
                type="button"
                onClick={() => setIsInstallerOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: CENTRAL MOBILE POCKET AI (IA PARA CELULAR 100% OFFLINE) */}
      {isMobileModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
            {/* Header do Modal */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-teal-500/20 text-emerald-400 border border-emerald-500/40 shadow-lg shadow-emerald-950">
                  <Smartphone className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-slate-100">Central Mobile Pocket AI - IA 100% Offline para Celular</h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600/50 text-[10px] font-bold uppercase tracking-wider">
                      WebGPU & PWA
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Execute IA no seu smartphone sem internet, sem servidor e sem consumo de dados móveis
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo com Scroll */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* CARD 1: QR CODE & CONEXÃO DO CELULAR */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-cyan-400 flex items-center gap-1.5 uppercase tracking-wider mb-2">
                      <QrCode className="w-4 h-4" /> 1. Conectar Celular à Malha (QR Code)
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Aponte a câmera do seu smartphone para o QR Code abaixo. O navegador do celular abrirá o console de IA móvel e armazenará os modelos no armazenamento persistente do aparelho:
                    </p>
                  </div>

                  <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-900 border border-slate-800/80 my-2">
                    {mobileQrDataUrl ? (
                      <img
                        src={mobileQrDataUrl}
                        alt="QR Code de Acesso para Celular"
                        className="w-40 h-40 rounded-xl shadow-lg border border-cyan-500/30 p-1 bg-slate-950"
                      />
                    ) : (
                      <div className="w-40 h-40 rounded-xl bg-slate-950 flex items-center justify-center text-xs text-slate-500">
                        Gerando QR Code...
                      </div>
                    )}
                    <span className="text-[10px] font-mono text-cyan-300 mt-2 select-all break-all text-center px-2">
                      {serverUrl || window.location.origin}/?mode=mobile_ai
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const url = `${serverUrl || window.location.origin}/?mode=mobile_ai&token=${token}`;
                        navigator.clipboard.writeText(url);
                        setActionNotice('📋 Link de acesso do celular copiado!');
                        setTimeout(() => setActionNotice(null), 2500);
                      }}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    >
                      <Copy className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Copiar Link do Celular</span>
                    </button>
                    <a
                      href={`${serverUrl || window.location.origin}/?mode=mobile_ai&token=${token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl transition-all"
                      title="Abrir em nova aba móvel"
                    >
                      <ExternalLink className="w-4 h-4 text-cyan-400" />
                    </a>
                  </div>

                  {/* Diagnóstico de Hardware do Smartphone / Dispositivo */}
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                    <span className="font-bold text-slate-200 flex items-center gap-1">
                      <Gauge className="w-3.5 h-3.5 text-emerald-400" /> Diagnóstico de IA do Aparelho Atual:
                    </span>
                    <div className="grid grid-cols-2 gap-1 text-[10px] font-mono pt-1 text-slate-400">
                      <div>WebGPU: <span className={mobileCapabilities?.hasWebGPU ? 'text-emerald-400 font-bold' : 'text-amber-400'}>{mobileCapabilities?.hasWebGPU ? '✅ Suportado' : '⚠️ CPU/WASM'}</span></div>
                      <div>RAM Est.: <span className="text-slate-200 font-bold">{mobileCapabilities?.deviceMemoryGb ? `${mobileCapabilities.deviceMemoryGb} GB` : 'Disponível'}</span></div>
                      <div>Núcleos CPU: <span className="text-slate-200 font-bold">{mobileCapabilities?.cpuCores || 4} Cores</span></div>
                      <div>Recomendado: <span className="text-cyan-400 font-bold">{mobileCapabilities?.recommendedModelId || 'sentinel-nano'}</span></div>
                    </div>
                  </div>
                </div>

                {/* CARD 2: CATÁLOGO DE MODELOS PARA CELULAR OFFLINE */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider mb-2">
                      <Download className="w-4 h-4" /> 2. Modelos Pré-Otimizados para Celular
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Clique em <strong>"Salvar no Celular"</strong> para armazenar os pesos no cache persistente do navegador do smartphone. Uma vez armazenado, o modelo funciona mesmo em <strong>Modo Avião</strong>!
                    </p>
                  </div>

                  {/* Progresso de Download / Caching se ativo */}
                  {cachingProgress && (
                    <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-600/60 space-y-1.5 animate-in fade-in">
                      <div className="flex justify-between text-xs text-emerald-300 font-semibold">
                        <span>Gravando no Cache do Aparelho:</span>
                        <span className="font-mono font-bold">{cachingProgress.percent}%</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-400 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${cachingProgress.percent}%` }}
                        />
                      </div>
                      <p className="text-[10px] font-mono text-emerald-200 truncate">{cachingProgress.status}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    {MOBILE_OFFLINE_MODELS.map((model) => {
                      const isCached = cachedModelIds.includes(model.id) || model.isZeroDownload;
                      const isActive = config.provider === 'mobile_offline' && config.mobileModelId === model.id;

                      return (
                        <div
                          key={model.id}
                          className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 text-xs ${
                            isActive
                              ? 'bg-emerald-950/40 border-emerald-500/70 shadow-md'
                              : 'bg-slate-900/90 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-slate-950 text-emerald-400 border border-slate-800 shrink-0">
                              <Smartphone className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-100">{model.name}</span>
                                {isCached && (
                                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600/50 text-[9px] font-bold">
                                    Offline Ready
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5">{model.description}</p>
                              <div className="text-[10px] font-mono text-cyan-400/90 flex gap-2 mt-0.5">
                                <span>Espaço: {model.sizeFormatted}</span>
                                <span>• Mín RAM: {model.minRamRequiredGb} GB</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1 shrink-0">
                            {isActive ? (
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-900 text-emerald-200 text-[10px] font-bold text-center">
                                Em Uso
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = {
                                    ...config,
                                    provider: 'mobile_offline' as CopilotProvider,
                                    activeModel: model.name,
                                    mobileModelId: model.id,
                                  };
                                  setConfig(updated);
                                  saveCopilotConfig(updated);
                                  setActionNotice(`📱 Modelo móvel "${model.name}" ativado!`);
                                  setTimeout(() => setActionNotice(null), 3000);
                                }}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold rounded-lg transition-all"
                              >
                                Ativar
                              </button>
                            )}

                            {!model.isZeroDownload && (
                              isCached ? (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCachedMobileModel(model.id)}
                                  className="text-[9px] text-slate-500 hover:text-rose-400 text-center transition-colors"
                                  title="Remover do cache do celular"
                                >
                                  Remover Cache
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleCacheMobileModel(model.id)}
                                  className="px-2 py-0.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-600/50 text-emerald-300 text-[9px] font-bold rounded-lg transition-all"
                                >
                                  Salvar p/ Offline
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* CARD 3: SIMULADOR DE CELULAR OFFLINE (TESTAR AGORA) */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <Activity className="w-4 h-4" /> 3. Teste em Tela: Simulador do Smartphone 100% Offline
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400">
                    Modelo Ativo: <strong className="text-emerald-300">{config.mobileModelId}</strong>
                  </span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={mobileSimulatorPrompt}
                    onChange={(e) => setMobileSimulatorPrompt(e.target.value)}
                    placeholder="Digite uma pergunta tática para testar no celular offline..."
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleTestMobileSimulator}
                    disabled={isMobileSimulatorLoading || !mobileSimulatorPrompt.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95 shrink-0"
                  >
                    {isMobileSimulatorLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    <span>Testar no Celular</span>
                  </button>
                </div>

                {mobileSimulatorOutput && (
                  <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-indigo-900/50 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1 border-b border-slate-800/80">
                      <span className="font-bold text-indigo-300 flex items-center gap-1">
                        <Smartphone className="w-3.5 h-3.5" /> Resposta Gerada pelo Smartphone (Offline Puro):
                      </span>
                      <span className="font-mono text-emerald-400">0% Internet Consumida</span>
                    </div>
                    <div className="text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-line">
                      {mobileSimulatorOutput}
                    </div>
                  </div>
                )}
              </div>

              {/* CARD 4: MODO DE FALLBACK P2P POR SOM & GIROSCÓPIO */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 flex items-start gap-3 text-xs">
                <div className="p-2 rounded-xl bg-amber-950/60 text-amber-400 border border-amber-800/50 shrink-0 mt-0.5">
                  <Radio className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h5 className="font-bold text-slate-200 text-xs">Transmissão Tática P2P via Som & Giroscópio no Celular</h5>
                  <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                    Se o smartphone estiver em ambiente de isolamento severo (sem sinal de Wi-Fi, Bluetooth ou rádio bloqueado), ele pode enviar consultas e receber instruções de contenção através do <strong>Modem Acústico Full-Duplex</strong> usando o alto-falante e microfone. Caso o microfone seja desativado pelo SO, o sensor de <strong>Giroscópio</strong> capta as ondas sonoras e microvibrações sísmicas para manter a comunicação ativa com o nó master.
                  </p>
                </div>
              </div>
            </div>

            {/* Rodapé do Modal */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                PWA pronto: Salve o link na tela inicial do celular para usar como aplicativo nativo.
              </span>
              <button
                type="button"
                onClick={() => setIsMobileModalOpen(false)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-950 active:scale-95"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
