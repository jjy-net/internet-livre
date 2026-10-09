import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot,
  Sparkles,
  Send,
  Zap,
  Radio,
  Bluetooth,
  Wifi,
  Volume2,
  VolumeX,
  Shield,
  ShieldAlert,
  Sliders,
  RotateCcw,
  X,
  Minimize2,
  Maximize2,
  Brain,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  HelpCircle,
  Activity,
  Mic,
  MicOff,
  Flame,
  Satellite,
  Compass,
  Cpu,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  Search,
  Wrench,
  BookOpen,
} from 'lucide-react';
import {
  UserChatMessage,
  UserActionSuggestion,
  UserConnectionRule,
  UserAiConfig,
  loadUserAiConfig,
  saveUserAiConfig,
  loadUserConnectionRules,
  addUserConnectionRule,
  removeUserConnectionRule,
  loadUserChatHistory,
  saveUserChatHistory,
  queryUserConnectionAi,
  executeUserConnectionAction,
  loadAllLearnedKnowledge,
  learnNewKnowledge,
  removeLearnedKnowledge,
  searchKnowledgeBase,
  runLiveSystemDiagnostics,
  LearnedKnowledgeItem,
  LiveDiagnosticResult,
} from '../utils/userConnectionAiEngine';
import { KnowledgeCategory } from '../utils/systemKnowledgeAndLearning';
import { protocolHubEngine, ProtocolDefinition } from '../utils/protocolHubEngine';

interface UserAiChatPopupProps {
  onNavigate?: (tab: string) => void;
  currentTab?: string;
}

export const UserAiChatPopup: React.FC<UserAiChatPopupProps> = ({ onNavigate, currentTab }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [activeDrawer, setActiveDrawer] = useState<'none' | 'knowledge' | 'diagnostics' | 'config'>('none');

  // Mensagens e Estado de Entrada
  const [messages, setMessages] = useState<UserChatMessage[]>(() => {
    const saved = loadUserChatHistory();
    return saved.length > 0 ? saved : [];
  });
  const [inputText, setInputText] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);

  // Configuração e Memória
  const [config, setConfig] = useState<UserAiConfig>(loadUserAiConfig);
  const [rules, setRules] = useState<UserConnectionRule[]>(loadUserConnectionRules);
  const [learnedKnowledge, setLearnedKnowledge] = useState<LearnedKnowledgeItem[]>(loadAllLearnedKnowledge);
  const [knowledgeSearchQuery, setKnowledgeSearchQuery] = useState<string>('');
  const [newKnowledgeTitle, setNewKnowledgeTitle] = useState<string>('');
  const [newKnowledgeContent, setNewKnowledgeContent] = useState<string>('');
  const [newKnowledgeCategory, setNewKnowledgeCategory] = useState<KnowledgeCategory>('failure_fix');
  const [liveDiag, setLiveDiag] = useState<LiveDiagnosticResult | null>(() => runLiveSystemDiagnostics());

  // Protocolos Ativos para Telemetria em Tempo Real
  const [activeProtocols, setActiveProtocols] = useState<ProtocolDefinition[]>(() =>
    protocolHubEngine.getActiveProtocols()
  );

  // Notificações Flutuantes no Popup
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Reconhecimento de Voz (Web Speech API)
  const [isListening, setIsListening] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const refreshProtocols = useCallback(() => {
    setActiveProtocols(protocolHubEngine.getActiveProtocols());
  }, []);

  useEffect(() => {
    window.addEventListener('jjy_protocol_changed', refreshProtocols);
    return () => window.removeEventListener('jjy_protocol_changed', refreshProtocols);
  }, [refreshProtocols]);

  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setIsMinimized(false);
    };
    window.addEventListener('jjy_open_ai_chat', handleOpen);
    return () => window.removeEventListener('jjy_open_ai_chat', handleOpen);
  }, []);

  const showToast = useCallback((msg: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
      inputRef.current?.focus();
    }
  }, [messages, isOpen, isMinimized]);

  // Salva histórico no storage quando muda
  useEffect(() => {
    if (messages.length > 0) {
      saveUserChatHistory(messages);
    }
  }, [messages]);

  // Envio de Mensagem para o Assistente
  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputText).trim();
    if (!prompt || isTyping) return;

    setInputText('');
    const userMsg: UserChatMessage = {
      id: 'msg_user_' + Date.now(),
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setIsTyping(true);

    try {
      const response = await queryUserConnectionAi(prompt, newHistory, config);

      const assistantMsg: UserChatMessage = {
        id: 'msg_asst_' + Date.now(),
        role: 'assistant',
        content: response.reply,
        timestamp: Date.now(),
        actions: response.actions,
        providerUsed: config.provider,
        metrics: response.metrics,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      refreshProtocols();
      setRules(loadUserConnectionRules());
    } catch {
      const errorMsg: UserChatMessage = {
        id: 'msg_err_' + Date.now(),
        role: 'assistant',
        content: '⚠️ Ocorreu uma oscilação na resposta da IA. O modo offline heurístico de contingência foi ativado. Diga o que deseja conectar (ex: *quero ligar o LoRa*) para que eu possa ajustar para você!',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  // Execução de Ação Individual
  const handleExecuteAction = async (msgId: string, action: UserActionSuggestion) => {
    const result = await executeUserConnectionAction(action, {
      onNavigateTab: (tab) => {
        if (onNavigate) onNavigate(tab);
      },
    });

    if (result.success) {
      showToast(result.message, 'success');
      // Marca ação como executada visualmente
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === msgId && m.actions) {
            return {
              ...m,
              actions: m.actions.map((a) => (a.id === action.id ? { ...a, executed: true } : a)),
            };
          }
          return m;
        })
      );
      refreshProtocols();
    } else {
      showToast(result.message, 'error');
    }
  };

  // Execução em Lote de Todas as Ações Sugeridas
  const handleExecuteAllActions = async (msgId: string, actions: UserActionSuggestion[]) => {
    let successCount = 0;
    for (const action of actions) {
      if (!action.executed) {
        const res = await executeUserConnectionAction(action, {
          onNavigateTab: (tab) => {
            if (onNavigate) onNavigate(tab);
          },
        });
        if (res.success) successCount++;
      }
    }
    showToast(`✓ ${successCount} configurações aplicadas com sucesso!`, 'success');
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === msgId && m.actions) {
          return {
            ...m,
            actions: m.actions.map((a) => ({ ...a, executed: true })),
          };
        }
        return m;
      })
    );
    refreshProtocols();
  };

  // Limpar Conversa
  const handleClearChat = () => {
    setMessages([]);
    localStorage.removeItem('jjy_user_copilot_history_v1');
    showToast('Histórico de conversa reiniciado.', 'info');
  };

  // Adicionar Conhecimento ou Resolução de Falha Manualmente
  const handleAddKnowledge = () => {
    if (!newKnowledgeTitle.trim() || !newKnowledgeContent.trim()) {
      showToast('Preencha o título e o conteúdo do aprendizado.', 'error');
      return;
    }
    learnNewKnowledge(newKnowledgeTitle, newKnowledgeContent, newKnowledgeCategory);
    setLearnedKnowledge(loadAllLearnedKnowledge());
    setNewKnowledgeTitle('');
    setNewKnowledgeContent('');
    showToast('Conhecimento memorizado com sucesso!', 'success');
  };

  // Remover Conhecimento Aprendido
  const handleRemoveKnowledge = (id: string) => {
    removeLearnedKnowledge(id);
    setLearnedKnowledge(loadAllLearnedKnowledge());
    showToast('Item removido da base de aprendizado.', 'info');
  };

  // Executar Auto-Diagnóstico Imediato e Enviar ao Chat
  const handleTriggerLiveDiagnosis = () => {
    const diag = runLiveSystemDiagnostics();
    setLiveDiag(diag);
    handleSendMessage('Diagnosticar falhas do sistema');
    setActiveDrawer('none');
  };

  // Salvar Configurações de IA
  const handleSaveConfig = (updated: Partial<UserAiConfig>) => {
    const next = { ...config, ...updated };
    setConfig(next);
    saveUserAiConfig(next);
    showToast('Configurações do Assistente salvas!', 'success');
  };

  // Ativação de Ditado por Voz
  const toggleVoiceInput = () => {
    // @ts-expect-error Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Reconhecimento de voz não suportado neste navegador.', 'error');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setIsListening(true);
      // @ts-expect-error Web Speech API event
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText((prev) => (prev ? prev + ' ' + transcript : transcript));
        }
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  // Renderizar Ícone Adequado para a Ação
  const renderActionIcon = (type: UserActionSuggestion['type']) => {
    switch (type) {
      case 'activate_protocol':
        return <Zap className="w-4 h-4 text-emerald-400" />;
      case 'deactivate_protocol':
        return <VolumeX className="w-4 h-4 text-rose-400" />;
      case 'bluetooth_connect':
        return <Bluetooth className="w-4 h-4 text-cyan-400" />;
      case 'lora_connect_serial':
      case 'set_lora_preset':
        return <Radio className="w-4 h-4 text-emerald-400" />;
      case 'set_frequency':
        return <Sliders className="w-4 h-4 text-indigo-400" />;
      case 'apply_bundle':
        return <Layers className="w-4 h-4 text-purple-400" />;
      case 'set_stealth':
        return <Shield className="w-4 h-4 text-amber-400" />;
      case 'navigate_tab':
        return <ExternalLink className="w-4 h-4 text-indigo-300" />;
      case 'test_transmission':
        return <Activity className="w-4 h-4 text-cyan-400" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-indigo-400" />;
    }
  };

  // ==========================================================================
  // RENDERIZAÇÃO DO BOTÃO FLUTUANTE (QUANDO FECHADO)
  // ==========================================================================
  if (!isOpen) {
    return (
      <div className="fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-[99999] flex items-center gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="group relative flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white rounded-full shadow-[0_10px_35px_rgba(79,70,229,0.55)] border-2 border-indigo-300/60 transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-xl ring-4 ring-indigo-500/25"
          title="Abrir Assistente IA de Conexões (Regulador & Conexões Automáticas)"
        >
          {/* Pulso animado */}
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-90" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-400 border-2 border-slate-950" />
          </span>

          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shadow-inner">
            <Bot className="w-5 h-5 text-white animate-pulse" />
          </div>

          <div className="text-left">
            <span className="text-xs font-black block leading-tight tracking-wide text-white drop-shadow">IA Conexões</span>
            <span className="text-[10px] text-indigo-100 font-semibold block leading-tight">LoRa • BLE • Wi-Fi P2P</span>
          </div>
        </button>
      </div>
    );
  }

  // ==========================================================================
  // RENDERIZAÇÃO DA BARRA MINIMIZADA (QUANDO MINIMIZADO)
  // ==========================================================================
  if (isMinimized) {
    return (
      <div className="fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-[99999] bg-slate-900 border-2 border-indigo-500/60 rounded-2xl shadow-2xl p-2.5 flex items-center gap-3 backdrop-blur-xl">
        <div className="w-7 h-7 rounded-xl bg-indigo-600 flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div className="text-xs font-bold text-slate-200">
          <span>Assistente IA</span>
          <span className="text-[10px] block text-emerald-400 font-normal">
            {activeProtocols.length} enlaces ativos
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            title="Expandir"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // RENDERIZAÇÃO DA JANELA PRINCIPAL FLUTUANTE (POPUP ABERTO)
  // ==========================================================================
  return (
    <div className="fixed bottom-6 right-6 z-[99999] w-[95vw] sm:w-[480px] h-[640px] max-h-[88vh] flex flex-col bg-slate-900/95 border-2 border-indigo-500/50 rounded-3xl shadow-[0_20px_60px_rgba(15,23,42,0.9)] shadow-indigo-950/80 backdrop-blur-2xl overflow-hidden font-sans animate-in fade-in zoom-in-95">
      {/* Toast de Notificação Interno */}
      {notification && (
        <div
          className={`absolute top-16 left-4 right-4 z-50 p-2.5 rounded-xl text-xs font-semibold shadow-lg backdrop-blur-md border animate-in slide-in-from-top-2 flex items-center gap-2 ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-700/60'
              : notification.type === 'error'
              ? 'bg-rose-950/90 text-rose-200 border-rose-700/60'
              : 'bg-indigo-950/90 text-indigo-200 border-indigo-700/60'
          }`}
        >
          <span className="text-base">
            {notification.type === 'success' ? '✓' : notification.type === 'error' ? '✕' : 'ℹ'}
          </span>
          <span className="flex-1 text-[11px] leading-tight">{notification.msg}</span>
        </div>
      )}

      {/* HEADER DO POPUP */}
      <header className="px-4 py-3 bg-slate-950/90 border-b border-indigo-900/40 flex items-center justify-between select-none">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-950" />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-sm text-slate-100 tracking-tight">Jjy Connect IA</h3>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                P2P Link
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Regular & Estabelecer Conexões</p>
          </div>
        </div>

        {/* Toolbar de Ações Rápidas no Header */}
        <div className="flex items-center gap-1 text-slate-400">
          {/* Botão de Diagnóstico de Falhas */}
          <button
            type="button"
            onClick={() => {
              if (activeDrawer === 'diagnostics') {
                setActiveDrawer('none');
              } else {
                setLiveDiag(runLiveSystemDiagnostics());
                setActiveDrawer('diagnostics');
              }
            }}
            className={`p-1.5 rounded-lg transition-all relative ${
              activeDrawer === 'diagnostics'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'hover:bg-slate-800 hover:text-rose-400'
            }`}
            title="Auto-Diagnóstico de Falhas e Saúde do Nó"
          >
            <Activity className="w-4 h-4" />
            {liveDiag && liveDiag.overallHealth !== 'healthy' && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            )}
          </button>

          {/* Botão de Base de Conhecimento & Aprendizado */}
          <button
            type="button"
            onClick={() => setActiveDrawer(activeDrawer === 'knowledge' ? 'none' : 'knowledge')}
            className={`p-1.5 rounded-lg transition-all relative ${
              activeDrawer === 'knowledge'
                ? 'bg-indigo-600 text-white'
                : 'hover:bg-slate-800 hover:text-slate-200'
            }`}
            title="Base de Conhecimento & Aprendizado Contínuo"
          >
            <Brain className="w-4 h-4" />
            {learnedKnowledge.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-cyan-500 text-[8px] font-bold text-slate-950 flex items-center justify-center">
                {learnedKnowledge.length}
              </span>
            )}
          </button>

          {/* Botão de Configurações de IA */}
          <button
            type="button"
            onClick={() => setActiveDrawer(activeDrawer === 'config' ? 'none' : 'config')}
            className={`p-1.5 rounded-lg transition-all ${
              activeDrawer === 'config'
                ? 'bg-indigo-600 text-white'
                : 'hover:bg-slate-800 hover:text-slate-200'
            }`}
            title="Configurações do Motor de IA"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleClearChat}
            className="p-1.5 hover:bg-slate-800 hover:text-rose-400 rounded-lg transition-all"
            title="Limpar Conversa"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="p-1.5 hover:bg-slate-800 hover:text-slate-200 rounded-lg transition-all"
            title="Minimizar"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-slate-800 hover:text-rose-400 rounded-lg transition-all"
            title="Fechar Popup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* BARRA DE STATUS DOS ENLACES ATIVOS */}
      <div className="px-3.5 py-1.5 bg-slate-950/70 border-b border-slate-800/80 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          <span className="text-[10px] text-slate-400 font-semibold whitespace-nowrap">Status:</span>
          {activeProtocols.slice(0, 3).map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px] font-medium whitespace-nowrap"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {p.codeName}
            </span>
          ))}
          {activeProtocols.length > 3 && (
            <span className="text-[10px] text-slate-500 font-mono">+{activeProtocols.length - 3} mais</span>
          )}
        </div>

        <div className="flex items-center gap-1 whitespace-nowrap">
          <span className="text-[10px] font-mono text-cyan-400 font-bold bg-cyan-950/50 px-1.5 py-0.2 rounded border border-cyan-800/40">
            {config.provider === 'offline' ? '100% Offline' : config.provider.toUpperCase()}
          </span>
        </div>
      </div>

      {/* GAVETA: AUTO-DIAGNÓSTICO DE FALHAS EM TEMPO REAL */}
      {activeDrawer === 'diagnostics' && (
        <div className="bg-slate-950 border-b border-rose-900/40 p-4 space-y-3.5 max-h-[320px] overflow-y-auto animate-in slide-in-from-top text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-rose-300">
              <Activity className="w-4 h-4 text-rose-400 animate-pulse" />
              <span>Auto-Diagnóstico de Falhas & Saúde do Nó</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveDrawer('none')}
              className="text-[11px] text-slate-400 hover:text-white"
            >
              ✕ Fechar
            </button>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Testa ativamente as permissões do navegador, APIs de rádio e WebSockets para identificar qualquer falha de hardware ou enlace.
          </p>

          {/* Cards Rápidos de Saúde das APIs */}
          {liveDiag && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Rádio LoRa USB</span>
                  {liveDiag.apis.serial.supported ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                  )}
                </div>
                <span className="text-[10px] text-slate-400 block truncate">{liveDiag.apis.serial.details}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Bluetooth BLE</span>
                  {liveDiag.apis.bluetooth.supported ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                  )}
                </div>
                <span className="text-[10px] text-slate-400 block truncate">{liveDiag.apis.bluetooth.details}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Modem Acústico</span>
                  {liveDiag.apis.audio.supported ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                  )}
                </div>
                <span className="text-[10px] text-slate-400 block truncate">{liveDiag.apis.audio.details}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Câmera / QR</span>
                  {liveDiag.apis.camera.supported ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                  )}
                </div>
                <span className="text-[10px] text-slate-400 block truncate">{liveDiag.apis.camera.details}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">WebRTC LAN</span>
                  {liveDiag.apis.webrtc.supported ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                  )}
                </div>
                <span className="text-[10px] text-slate-400 block truncate">{liveDiag.apis.webrtc.details}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Globo 3D GPU</span>
                  {liveDiag.apis.webgl.supported ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                  )}
                </div>
                <span className="text-[10px] text-slate-400 block truncate">{liveDiag.apis.webgl.details}</span>
              </div>
            </div>
          )}

          {/* Botão de Disparo do Diagnóstico Completo no Chat */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-400">
              Estado Geral: <strong className="text-white uppercase">{liveDiag?.overallHealth}</strong>
            </span>
            <button
              type="button"
              onClick={handleTriggerLiveDiagnosis}
              className="px-3.5 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
            >
              <Activity className="w-3.5 h-3.5" /> Rodar Diagnóstico e Enviar ao Chat
            </button>
          </div>
        </div>
      )}

      {/* GAVETA: BASE DE CONHECIMENTO & APRENDIZADO CONTÍNUO */}
      {activeDrawer === 'knowledge' && (
        <div className="bg-slate-950 border-b border-indigo-900/40 p-4 space-y-3.5 max-h-[320px] overflow-y-auto animate-in slide-in-from-top text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-indigo-300">
              <Brain className="w-4 h-4 text-cyan-400" />
              <span>Base de Aprendizado & Conhecimento ({learnedKnowledge.length} memorizados)</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveDrawer('none')}
              className="text-[11px] text-slate-400 hover:text-white"
            >
              ✕ Fechar
            </button>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Aqui estão todas as regras, especificações de hardware e correções de falhas que a IA aprendeu com você ou do sistema.
          </p>

          {/* Campo de Busca no Aprendizado */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={knowledgeSearchQuery}
              onChange={(e) => setKnowledgeSearchQuery(e.target.value)}
              placeholder="Pesquisar nos conhecimentos aprendidos..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Lista de Conhecimentos Aprendidos */}
          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
            {(knowledgeSearchQuery ? searchKnowledgeBase(knowledgeSearchQuery) : learnedKnowledge).map((k) => (
              <div
                key={k.id}
                className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-start justify-between gap-2 text-xs hover:border-slate-700 transition-colors"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-200 text-xs">{k.title}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 uppercase">
                      {k.category === 'failure_fix' ? '🛠️ Falha/Fix' : k.category === 'hardware_note' ? '📻 Hardware' : k.category}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed line-clamp-2">{k.content}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveKnowledge(k.id)}
                  className="p-1 text-slate-500 hover:text-rose-400 rounded shrink-0"
                  title="Esquecer este conhecimento"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Formulário para Ensinar Novo Conhecimento */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 block">Ensinar Novo Conhecimento ou Solução de Falha:</span>
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newKnowledgeTitle}
                  onChange={(e) => setNewKnowledgeTitle(e.target.value)}
                  placeholder="Título (ex: Antena LoRa do Posto de Comando)"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <select
                  value={newKnowledgeCategory}
                  onChange={(e) => setNewKnowledgeCategory(e.target.value as KnowledgeCategory)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-2 text-xs text-slate-300"
                >
                  <option value="failure_fix">🛠️ Correção de Falha</option>
                  <option value="hardware_note">📻 Hardware/Antena</option>
                  <option value="user_preference">⚙️ Preferência</option>
                  <option value="faq">❓ Dúvida/FAQ</option>
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newKnowledgeContent}
                  onChange={(e) => setNewKnowledgeContent(e.target.value)}
                  placeholder="Descrição da regra, sintoma ou solução..."
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddKnowledge}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Memorizar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GAVETA: CONFIGURAÇÕES DE MOTOR IA */}
      {activeDrawer === 'config' && (
        <div className="bg-slate-950 border-b border-indigo-900/40 p-4 space-y-3 max-h-[300px] overflow-y-auto animate-in slide-in-from-top text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-indigo-300">
              <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
              <span>Provedor de Inteligência Artificial</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveDrawer('none')}
              className="text-[11px] text-slate-400 hover:text-white"
            >
              ✕ Fechar
            </button>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Selecione o Provedor:</label>
            <select
              value={config.provider}
              onChange={(e) => handleSaveConfig({ provider: e.target.value as UserAiConfig['provider'] })}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-slate-200 text-xs"
            >
              <option value="offline">⚡ Nativo Offline Jjy (Zero-Config Heurístico)</option>
              <option value="ollama">🦙 Ollama Local (http://localhost:11434)</option>
              <option value="lmstudio">💻 LM Studio Local (http://localhost:1234/v1)</option>
              <option value="gemini">✨ Google Gemini API</option>
              <option value="groq">⚡ Groq Cloud (Llama 3.3 Ultra-Rápido)</option>
              <option value="deepseek">🐋 DeepSeek API</option>
              <option value="openai">🤖 OpenAI (GPT-4o Mini)</option>
            </select>
          </div>

          {config.provider === 'gemini' && (
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Chave Gemini API:</label>
              <input
                type="password"
                value={config.geminiApiKey}
                onChange={(e) => handleSaveConfig({ geminiApiKey: e.target.value })}
                placeholder="AIzaSy..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-white"
              />
            </div>
          )}

          {config.provider === 'ollama' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Endpoint Ollama:</label>
                <input
                  type="text"
                  value={config.ollamaEndpoint}
                  onChange={(e) => handleSaveConfig({ ollamaEndpoint: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Modelo Ollama:</label>
                <input
                  type="text"
                  value={config.ollamaModel}
                  onChange={(e) => handleSaveConfig({ ollamaModel: e.target.value })}
                  placeholder="llama3:latest"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-1.5 text-xs text-white"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* FEED DE MENSAGENS */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
        {/* Mensagem de Boas-Vindas se Vazio */}
        {messages.length === 0 && (
          <div className="p-4 rounded-2xl bg-gradient-to-b from-indigo-950/40 to-slate-950 border border-indigo-500/20 space-y-3 text-center my-auto">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 mx-auto flex items-center justify-center text-indigo-300">
              <Bot className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-100">Como posso ajudar com nosso sistema hoje?</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                Tiro dúvidas sobre todo nosso sistema, diagnostico falhas que surgirem e aprendo com você para regular e estabelecer conexões soberanas!
              </p>
            </div>

            {/* Chips de Dúvidas / Falhas / Comandos Rápidos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-2 text-left">
              <button
                type="button"
                onClick={() => handleSendMessage('Diagnosticar falhas do sistema')}
                className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-rose-500/30 hover:border-rose-500 text-[11px] text-slate-300 hover:text-white transition-all flex items-center gap-2 group"
              >
                <Activity className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
                <span>🩺 Diagnosticar Falhas do Sistema</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendMessage('Como funciona todo o nosso sistema?')}
                className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/50 text-[11px] text-slate-300 hover:text-white transition-all flex items-center gap-2 group"
              >
                <BookOpen className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                <span>🌐 Como Funciona Todo o Sistema?</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendMessage('Quero me conectar por um rádio LoRa')}
                className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-emerald-500/50 text-[11px] text-slate-300 hover:text-white transition-all flex items-center gap-2 group"
              >
                <Radio className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span>📻 Conectar via Rádio LoRa (915MHz)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendMessage('Quero conversar por bluetooth com amigos localmente')}
                className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/50 text-[11px] text-slate-300 hover:text-white transition-all flex items-center gap-2 group"
              >
                <Bluetooth className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                <span>🔵 Conversar por Bluetooth Local</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendMessage('O que fazer se o Bluetooth ou rádio der erro?')}
                className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/50 text-[11px] text-slate-300 hover:text-white transition-all flex items-center gap-2 group"
              >
                <Wrench className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                <span>🛠️ O que Fazer se Der Erro ou Falha?</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendMessage('O que você já aprendeu sobre o sistema?')}
                className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/50 text-[11px] text-slate-300 hover:text-white transition-all flex items-center gap-2 group"
              >
                <Brain className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                <span>🧠 O que Você já Aprendeu?</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendMessage('Estou em área de emergência e desastre sem internet')}
                className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-rose-500/50 text-[11px] text-slate-300 hover:text-white transition-all flex items-center gap-2 group"
              >
                <Flame className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
                <span>🚨 Emergência & Desastre (SOS)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendMessage('Quero ativar o modo furtivo sem emissão de rádio')}
                className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-purple-500/50 text-[11px] text-slate-300 hover:text-white transition-all flex items-center gap-2 group"
              >
                <Shield className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
                <span>🤫 Modo Furtivo (Zero RF / QR)</span>
              </button>
            </div>
          </div>
        )}

        {/* Lista de Mensagens */}
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-2`}
            >
              <div
                className={`max-w-[90%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                  isUser
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-br-xs shadow-md shadow-indigo-600/20'
                    : 'bg-slate-950/90 border border-slate-800/90 text-slate-200 rounded-bl-xs shadow-md'
                }`}
              >
                {/* Cabeçalho da Mensagem do Assistente */}
                {!isUser && (
                  <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-slate-800/60 text-[10px] text-indigo-300 font-semibold">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    <span>Jjy LinkPilot</span>
                    {m.metrics && (
                      <span className="text-slate-500 font-mono ml-auto">
                        {m.metrics.isFullyOffline ? '⚡ Offline' : '🌐 Nuvem'} • {m.metrics.responseTimeMs}ms
                      </span>
                    )}
                  </div>
                )}

                {/* Conteúdo formatado da mensagem */}
                <div className="whitespace-pre-line break-words space-y-1">
                  {m.content}
                </div>

                {/* CARTÕES DE AÇÕES AUTOMATIZADAS RECOMENDADAS PELA IA */}
                {m.actions && m.actions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                        <Zap className="w-3 h-3 text-cyan-400" />
                        Configurações Recomendadas ({m.actions.length})
                      </span>

                      {/* Botão para aplicar todas de uma vez */}
                      {m.actions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleExecuteAllActions(m.id, m.actions!)}
                          className="text-[10px] font-bold text-cyan-300 hover:text-white px-2 py-0.5 rounded-md bg-cyan-950 border border-cyan-700/50 hover:bg-cyan-900 transition-all flex items-center gap-1"
                        >
                          ⚡ Aplicar Tudo
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {m.actions.map((act) => (
                        <div
                          key={act.id}
                          className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                            act.executed
                              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                              : 'bg-slate-900/90 border-slate-800 hover:border-indigo-500/50 text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="p-1 rounded-lg bg-slate-950 border border-slate-800">
                              {renderActionIcon(act.type)}
                            </div>
                            <div className="truncate">
                              <span className="font-bold text-[11px] block truncate">{act.label}</span>
                              <span className="text-[9px] text-slate-400 block truncate">{act.description}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleExecuteAction(m.id, act)}
                            disabled={act.executed}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                              act.executed
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm hover:scale-105 active:scale-95'
                            }`}
                          >
                            {act.executed ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span>Configurado!</span>
                              </>
                            ) : (
                              <>
                                <Zap className="w-3 h-3" />
                                <span>Configurar</span>
                              </>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Indicador de Digitação */}
        {isTyping && (
          <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold p-2">
            <Bot className="w-4 h-4 animate-spin" />
            <span>Consultando matriz de protocolos e preparando conexões...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* FOOTER & CAMPO DE ENTRADA */}
      <footer className="p-3 bg-slate-950 border-t border-slate-800/80 space-y-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ex: Quero ligar meu rádio LoRa em 915 MHz..."
              className="w-full bg-slate-900 border border-slate-700/80 rounded-2xl pl-3.5 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 shadow-inner"
            />

            {/* Botão de Ditado por Voz */}
            <button
              type="button"
              onClick={toggleVoiceInput}
              className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-all ${
                isListening
                  ? 'text-rose-400 bg-rose-950/60 animate-pulse'
                  : 'text-slate-400 hover:text-white'
              }`}
              title={isListening ? 'Ouvindo microfone...' : 'Falar por voz'}
            >
              {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={!inputText.trim() || isTyping}
            className="p-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-40 disabled:hover:scale-100 text-white shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title="Enviar mensagem"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
          <span>🔒 Regulador de Conexões • 100% Privado</span>
          <span className="text-cyan-400 font-medium">Jjy Autonomous LinkPilot</span>
        </div>
      </footer>
    </div>
  );
};
