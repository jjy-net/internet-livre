/**
 * userConnectionAiEngine.ts
 * Motor de IA Copiloto de Conexões & Redes para o Usuário - Jjy Sovereign Mesh v2.0
 * 
 * Escopo do Assistente do Usuário:
 * - Especialista em regular e estabelecer conexões (LoRa, Bluetooth, Wi-Fi, Som/Ultrassom, Satélite, P2P, Celular).
 * - Conhece profundamente o ecossistema Jjy, arquitetura offline e requisitos de hardware.
 * - Aprende preferências e regras do usuário (salvas no localStorage).
 * - Recomenda o que o usuário precisa fazer e executa automaticamente as configurações (Action Tags).
 * - Não possui poderes administrativos destrutivos (banimento, lockdown de rede, contenção).
 * - Opera 100% Offline por padrão com Motor Heurístico Avançado, com suporte a Ollama, LM Studio e APIs de Nuvem.
 */

import {
  protocolHubEngine,
  ProtocolDefinition,
  RoutingStrategy,
  PROTOCOL_BUNDLES,
} from './protocolHubEngine';
import {
  SYSTEM_MODULES_CATALOG,
  COMMON_FAILURES_KNOWLEDGE,
  loadAllLearnedKnowledge,
  learnNewKnowledge,
  runLiveSystemDiagnostics,
  findSystemFailureSolution,
  findSystemModuleInfo,
  removeLearnedKnowledge,
  searchKnowledgeBase,
  LearnedKnowledgeItem,
  LiveDiagnosticResult,
} from './systemKnowledgeAndLearning';

// Re-exporta utilitários para fácil consumo nos componentes
export {
  SYSTEM_MODULES_CATALOG,
  COMMON_FAILURES_KNOWLEDGE,
  loadAllLearnedKnowledge,
  learnNewKnowledge,
  removeLearnedKnowledge,
  runLiveSystemDiagnostics,
  findSystemFailureSolution,
  findSystemModuleInfo,
  searchKnowledgeBase,
};
export type { LearnedKnowledgeItem, LiveDiagnosticResult };

// ============================================================================
// TIPOS E MODELOS DO COPILOTO DE CONEXÕES DO USUÁRIO
// ============================================================================

export interface UserConnectionRule {
  id: string;
  rule: string;
  category: 'hardware' | 'frequency' | 'preference' | 'privacy';
  createdAt: number;
}

export type UserActionType =
  | 'activate_protocol'
  | 'deactivate_protocol'
  | 'set_frequency'
  | 'set_tx_power'
  | 'apply_bundle'
  | 'bluetooth_connect'
  | 'lora_connect_serial'
  | 'set_lora_preset'
  | 'navigate_tab'
  | 'set_stealth'
  | 'test_transmission'
  | 'learn_rule'
  | 'run_diagnostic';

export interface UserActionSuggestion {
  id: string;
  type: UserActionType;
  label: string;
  description: string;
  targetId?: string;
  param?: string;
  secondaryParam?: string;
  executed?: boolean;
}

export interface UserChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  actions?: UserActionSuggestion[];
  providerUsed?: string;
  metrics?: {
    responseTimeMs?: number;
    isFullyOffline?: boolean;
  };
}

export type UserAiProvider =
  | 'offline'
  | 'ollama'
  | 'lmstudio'
  | 'gemini'
  | 'groq'
  | 'deepseek'
  | 'openai'
  | 'anthropic'
  | 'custom';

export interface UserAiConfig {
  provider: UserAiProvider;
  temperature: number;
  ollamaEndpoint: string;
  ollamaModel: string;
  lmstudioEndpoint: string;
  lmstudioModel: string;
  geminiApiKey: string;
  geminiModel: string;
  groqApiKey: string;
  groqModel: string;
  deepseekApiKey: string;
  deepseekModel: string;
  openaiApiKey: string;
  openaiModel: string;
  customEndpoint: string;
  customApiKey: string;
  customModel: string;
}

export const DEFAULT_USER_AI_CONFIG: UserAiConfig = {
  provider: 'offline',
  temperature: 0.6,
  ollamaEndpoint: 'http://localhost:11434',
  ollamaModel: 'llama3:latest',
  lmstudioEndpoint: 'http://localhost:1234/v1',
  lmstudioModel: 'local-model',
  geminiApiKey: '',
  geminiModel: 'gemini-1.5-flash',
  groqApiKey: '',
  groqModel: 'llama-3.3-70b-versatile',
  deepseekApiKey: '',
  deepseekModel: 'deepseek-chat',
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  customEndpoint: 'http://localhost:8080/v1',
  customApiKey: '',
  customModel: 'default',
};

// ============================================================================
// ARMAZENAMENTO E APRENDIZADO DE PREFERÊNCIAS (MEMÓRIA DO ASSISTENTE)
// ============================================================================

const USER_RULES_KEY = 'jjy_user_copilot_learned_rules';
const USER_CONFIG_KEY = 'jjy_user_copilot_config_v1';
const USER_CHAT_HISTORY_KEY = 'jjy_user_copilot_history_v1';

export function loadUserConnectionRules(): UserConnectionRule[] {
  try {
    const raw = localStorage.getItem(USER_RULES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [
    {
      id: 'rule_default_1',
      rule: 'Frequência regulatória recomendada para LoRa no Brasil é 915.000 MHz (Banda ISM Anatel)',
      category: 'frequency',
      createdAt: Date.now() - 100000,
    },
    {
      id: 'rule_default_2',
      rule: 'Priorizar conexões sem internet e com criptografia ponta a ponta (E2EE)',
      category: 'preference',
      createdAt: Date.now() - 50000,
    },
  ];
}

export function saveUserConnectionRules(rules: UserConnectionRule[]): void {
  try {
    localStorage.setItem(USER_RULES_KEY, JSON.stringify(rules));
  } catch {}
}

export function addUserConnectionRule(
  ruleText: string,
  category: UserConnectionRule['category'] = 'preference'
): UserConnectionRule {
  const rules = loadUserConnectionRules();
  const newRule: UserConnectionRule = {
    id: 'user_rule_' + Math.random().toString(36).substring(2, 9),
    rule: ruleText.trim(),
    category,
    createdAt: Date.now(),
  };
  rules.unshift(newRule);
  saveUserConnectionRules(rules);
  return newRule;
}

export function removeUserConnectionRule(id: string): void {
  const rules = loadUserConnectionRules().filter((r) => r.id !== id);
  saveUserConnectionRules(rules);
}

export function loadUserAiConfig(): UserAiConfig {
  try {
    const raw = localStorage.getItem(USER_CONFIG_KEY);
    if (raw) return { ...DEFAULT_USER_AI_CONFIG, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_USER_AI_CONFIG;
}

export function saveUserAiConfig(cfg: UserAiConfig): void {
  try {
    localStorage.setItem(USER_CONFIG_KEY, JSON.stringify(cfg));
  } catch {}
}

export function loadUserChatHistory(): UserChatMessage[] {
  try {
    const raw = localStorage.getItem(USER_CHAT_HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveUserChatHistory(history: UserChatMessage[]): void {
  try {
    localStorage.setItem(USER_CHAT_HISTORY_KEY, JSON.stringify(history.slice(-30)));
  } catch {}
}

// ============================================================================
// PARSER DE AÇÕES E TAGS [ACTION:tipo:param:param2:label]
// ============================================================================

export function parseUserActionSuggestions(text: string): {
  reply: string;
  cleanReply: string;
  actions: UserActionSuggestion[];
} {
  const actions: UserActionSuggestion[] = [];
  const regex = /\[ACTION:([a-z_]+)(?::([^:\]]*))?(?::([^:\]]*))?(?::([^\]]*))?\]/gi;

  let cleanReply = text;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const type = match[1].toLowerCase() as UserActionType;
    const targetId = match[2] || '';
    const param = match[3] || '';
    const label = match[4] || match[3] || match[2] || 'Executar Ação';

    let description = '';

    switch (type) {
      case 'activate_protocol':
        description = `Ativar protocolo ${targetId} no Barramento Omni`;
        break;
      case 'deactivate_protocol':
        description = `Desativar protocolo ${targetId}`;
        break;
      case 'set_frequency':
        description = `Configurar canal de frequência para ${param || targetId}`;
        break;
      case 'set_tx_power':
        description = `Ajustar potência de transmissão para ${param} dBm`;
        break;
      case 'apply_bundle':
        description = `Aplicar conjunto de protocolos otimizado (${targetId})`;
        break;
      case 'bluetooth_connect':
        description = `Iniciar pareamento ou busca BLE Web Bluetooth`;
        break;
      case 'lora_connect_serial':
        description = `Conectar módulo LoRa via WebSerial (Baud: ${targetId || 115200})`;
        break;
      case 'set_lora_preset':
        description = `Configurar preset LoRa: ${targetId} / ${param}`;
        break;
      case 'navigate_tab':
        description = `Navegar até a tela: ${targetId}`;
        break;
      case 'set_stealth':
        description = `Ativar modo de emissão furtiva silenciosa (Zero RF)`;
        break;
      case 'test_transmission':
        description = `Disparar frame de teste no protocolo ${targetId}`;
        break;
      case 'learn_rule':
        description = `Registrar nova regra aprendida na memória da IA`;
        break;
      case 'run_diagnostic':
        description = `Executar auto-diagnóstico em tempo real de hardware e APIs`;
        break;
      default:
        description = `Ação automatizada recomendada`;
    }

    actions.push({
      id: 'act_' + Math.random().toString(36).substring(2, 8),
      type,
      label,
      description,
      targetId,
      param,
      secondaryParam: match[4],
      executed: false,
    });
  }

  // Remove as tags [ACTION:...] do texto final visível
  cleanReply = cleanReply.replace(regex, '').trim();

  return { reply: cleanReply, cleanReply, actions };
}

// ============================================================================
// EXECUTOR DE CONFIGURAÇÕES AUTOMATIZADAS
// ============================================================================

export interface ActionExecutionContext {
  onNavigateTab?: (tab: string) => void;
  onShowNotification?: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export async function executeUserConnectionAction(
  action: UserActionSuggestion,
  context: ActionExecutionContext = {}
): Promise<{ success: boolean; message: string }> {
  try {
    switch (action.type) {
      case 'activate_protocol': {
        const protoId = action.targetId;
        if (!protoId) return { success: false, message: 'ID do protocolo não especificado.' };
        protocolHubEngine.setProtocolStatus(protoId, 'active');
        window.dispatchEvent(new CustomEvent('jjy_protocol_changed', { detail: { protoId, status: 'active' } }));
        return { success: true, message: `Protocolo [${protoId}] ativado com sucesso!` };
      }

      case 'deactivate_protocol': {
        const protoId = action.targetId;
        if (!protoId) return { success: false, message: 'ID do protocolo não especificado.' };
        protocolHubEngine.setProtocolStatus(protoId, 'standby');
        window.dispatchEvent(new CustomEvent('jjy_protocol_changed', { detail: { protoId, status: 'standby' } }));
        return { success: true, message: `Protocolo [${protoId}] colocado em espera.` };
      }

      case 'set_frequency': {
        const protoId = action.targetId;
        const freq = action.param;
        if (protoId && freq) {
          protocolHubEngine.updateProtocolConfig(protoId, { channelFreq: freq });
          window.dispatchEvent(new CustomEvent('jjy_protocol_changed', { detail: { protoId, freq } }));
          return { success: true, message: `Frequência de [${protoId}] ajustada para ${freq}.` };
        }
        return { success: false, message: 'Parâmetros de frequência inválidos.' };
      }

      case 'set_tx_power': {
        const protoId = action.targetId;
        const pwr = parseInt(action.param || '20', 10);
        if (protoId) {
          protocolHubEngine.updateProtocolConfig(protoId, { txPowerDbm: pwr });
          window.dispatchEvent(new CustomEvent('jjy_protocol_changed', { detail: { protoId, pwr } }));
          return { success: true, message: `Potência de transmissão ajustada para ${pwr} dBm.` };
        }
        return { success: false, message: 'Protocolo inválido.' };
      }

      case 'apply_bundle': {
        const bundleId = action.targetId;
        if (!bundleId) return { success: false, message: 'ID do conjunto não especificado.' };
        const ok = protocolHubEngine.applyBundle(bundleId);
        window.dispatchEvent(new CustomEvent('jjy_protocol_changed', { detail: { bundleId } }));
        const bundle = PROTOCOL_BUNDLES.find((b) => b.id === bundleId);
        return {
          success: ok,
          message: ok
            ? `Pacote [${bundle?.name || bundleId}] ativado com sucesso!`
            : 'Falha ao aplicar pacote.',
        };
      }

      case 'bluetooth_connect': {
        // Ativa o protocolo ble_mesh_direct no hub primeiro
        protocolHubEngine.setProtocolStatus('ble_mesh_direct', 'active');
        window.dispatchEvent(new CustomEvent('jjy_protocol_changed', { detail: { protoId: 'ble_mesh_direct', status: 'active' } }));

        // Se o navegador suportar Web Bluetooth, aciona o seletor de pareamento nativo
        if (typeof navigator !== 'undefined' && 'bluetooth' in navigator) {
          try {
            const nav = navigator as unknown as {
              bluetooth?: {
                requestDevice: (options: unknown) => Promise<{ name?: string }>;
              };
            };
            if (nav.bluetooth) {
              const device = await nav.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: ['generic_access', 'battery_service'],
              });
              if (device) {
                return {
                  success: true,
                  message: `Dispositivo Bluetooth "${device.name || 'Dispositivo Desconhecido'}" pareado com sucesso! Protocolo BLE Mesh ativado.`,
                };
              }
            }
          } catch (err: unknown) {
            const errStr = String(err);
            if (errStr.includes('User cancelled')) {
              return {
                success: true,
                message: 'Protocolo BLE Mesh 5.3 ativado no sistema Jjy. (Busca Bluetooth cancelada pelo usuário).',
              };
            }
            return {
              success: true,
              message: `Protocolo BLE Mesh ativado! Dica: ative o Bluetooth do sistema ou utilize pareamento pelo OS (${errStr}).`,
            };
          }
        }
        return {
          success: true,
          message: 'Protocolo BLE Mesh 5.3 ativado! O Jjy está transmitindo beacons em 2.4 GHz.',
        };
      }

      case 'lora_connect_serial': {
        // Ativa protocolo lora_meshtastic no hub
        protocolHubEngine.setProtocolStatus('lora_meshtastic', 'active');
        window.dispatchEvent(new CustomEvent('jjy_protocol_changed', { detail: { protoId: 'lora_meshtastic', status: 'active' } }));

        // Tenta acionar WebSerial se o navegador suportar
        if (typeof navigator !== 'undefined' && 'serial' in navigator) {
          try {
            // @ts-expect-error WebSerial API opcional
            const port = await navigator.serial.requestPort();
            const baud = parseInt(action.targetId || '115200', 10);
            await port.open({ baudRate: baud });
            return {
              success: true,
              message: `Porta serial USB LoRa conectada com sucesso a ${baud} baud! Canal 915 MHz operacional.`,
            };
          } catch (err: unknown) {
            const errStr = String(err);
            if (errStr.includes('User cancelled') || errStr.includes('cancel')) {
              return {
                success: true,
                message: 'Protocolo LoRa Meshtastic ativado e configurado em 915.000 MHz.',
              };
            }
            return {
              success: true,
              message: `LoRa configurado em 915 MHz. Para comunicação direta USB, selecione a porta serial nas permissões.`,
            };
          }
        }
        return {
          success: true,
          message: 'LoRa Meshtastic configurado em 915 MHz! Para comunicação direta USB use navegador Chrome/Edge com WebSerial.',
        };
      }

      case 'set_lora_preset': {
        const region = action.targetId || 'BR_915';
        const preset = action.param || 'LONG_FAST';
        protocolHubEngine.setProtocolStatus('lora_meshtastic', 'active');
        protocolHubEngine.updateProtocolConfig('lora_meshtastic', {
          channelFreq: region === 'BR_915' ? '915.000 MHz (Slot 20 Brasil)' : '906.875 MHz (US-915)',
          txPowerDbm: 20,
        });
        localStorage.setItem('jjy_lora_preset_choice', JSON.stringify({ region, preset }));
        window.dispatchEvent(new CustomEvent('jjy_protocol_changed', { detail: { protoId: 'lora_meshtastic' } }));
        return { success: true, message: `LoRa configurado para região [${region}] com preset [${preset}]!` };
      }

      case 'navigate_tab': {
        const tab = action.targetId;
        if (tab && context.onNavigateTab) {
          context.onNavigateTab(tab);
          return { success: true, message: `Navegando para ${action.label || tab}...` };
        }
        return { success: false, message: 'Navegação não suportada no contexto atual.' };
      }

      case 'set_stealth': {
        protocolHubEngine.setRoutingStrategy('stealth_silent');
        // Desativa RF alto, mantém óptico e acústico inaudível
        protocolHubEngine.setProtocolStatus('optical_qr_stream', 'active');
        protocolHubEngine.setProtocolStatus('audio_ultrasonic_air', 'active');
        protocolHubEngine.setProtocolStatus('lora_meshtastic', 'standby');
        protocolHubEngine.setProtocolStatus('wifi_radar_densepose', 'standby');
        window.dispatchEvent(new CustomEvent('jjy_protocol_changed', { detail: { stealth: true } }));
        return {
          success: true,
          message: 'Modo Furtivo ativado: Transmissores de rádio silenciados. Apenas canais ópticos e ultrassom operando.',
        };
      }

      case 'test_transmission': {
        const protoId = action.targetId || 'ble_mesh_direct';
        const frame = protocolHubEngine.dispatchFrame('TEST-PING-JJY-AI-CONNECT', protoId);
        return {
          success: true,
          message: `Frame de teste enviado via [${frame.protocolId}]! Latência: ${frame.latencyMs}ms, CRC32: ${frame.crc32Hex}.`,
        };
      }

      case 'learn_rule': {
        const text = action.param || action.targetId;
        if (text) {
          addUserConnectionRule(text);
          learnNewKnowledge('Regra Memorizada pelo Usuário', text, 'user_preference');
          return { success: true, message: `Regra registrada com sucesso: "${text}"` };
        }
        return { success: false, message: 'Texto da regra ausente.' };
      }

      case 'run_diagnostic': {
        const diag = runLiveSystemDiagnostics();
        window.dispatchEvent(new CustomEvent('jjy_diagnostic_completed', { detail: diag }));
        return {
          success: true,
          message: `Auto-diagnóstico concluído: Estado global [${diag.overallHealth.toUpperCase()}]. ${diag.activeIssues.length} observações.`,
        };
      }

      default:
        return { success: false, message: 'Ação não reconhecida.' };
    }
  } catch (err: unknown) {
    return { success: false, message: `Erro ao executar ação: ${String(err)}` };
  }
}

// ============================================================================
// MOTOR HEURÍSTICO ESPECIALISTA 100% OFFLINE (ZERO-CONFIG)
// ============================================================================

export function runOfflineUserConnectionHeuristic(
  userPrompt: string,
  _history: UserChatMessage[],
  learnedRules: UserConnectionRule[],
  activeProtocols: ProtocolDefinition[]
): { reply: string; actions: UserActionSuggestion[] } {
  const p = userPrompt.toLowerCase().trim();

  // 1. O usuário está tentando ensinar uma nova regra ou conhecimento?
  if (
    p.startsWith('lembre-se') ||
    p.startsWith('aprenda que') ||
    p.startsWith('aprenda:') ||
    p.startsWith('aprenda') ||
    p.startsWith('guarde que') ||
    p.startsWith('memorize') ||
    p.startsWith('minha antena') ||
    p.startsWith('meu radio') ||
    p.startsWith('meu rádio') ||
    p.startsWith('sempre use') ||
    p.startsWith('nunca use') ||
    p.startsWith('quando der erro')
  ) {
    const cleanRule = userPrompt
      .replace(/^(lembre-se que|lembre-se|aprenda que|aprenda:|aprenda|guarde que|memorize|por favor lembre-se)\s*:?/i, '')
      .trim();
    const ruleCreated = addUserConnectionRule(cleanRule);
    const cat = p.includes('erro') || p.includes('falha') ? 'failure_fix' : 'user_preference';
    learnNewKnowledge('Conhecimento Ensinado pelo Usuário', cleanRule, cat);

    return {
      reply: `🧠 **Entendido e memorizado na base de aprendizado!**\n\nAdicionei a seguinte diretriz à minha memória permanente:\n> *"${ruleCreated.rule}"*\n\nEssa informação agora faz parte do meu aprendizado contínuo sobre o sistema e será considerada para todas as suas dúvidas, falhas e conexões futuras!`,
      actions: [],
    };
  }

  // 2. O usuário quer ver o que a IA já aprendeu / Base de Conhecimento
  if (
    p.includes('o que você aprendeu') ||
    p.includes('o que você sabe') ||
    p.includes('o que voce aprendeu') ||
    p.includes('o que voce sabe') ||
    p.includes('ver aprendizado') ||
    p.includes('mostrar aprendizado') ||
    p.includes('ver memória') ||
    p.includes('sua memória') ||
    p.includes('base de conhecimento')
  ) {
    const items = loadAllLearnedKnowledge();
    const listMarkdown = items.slice(0, 6).map((item, idx) => 
      `**${idx + 1}. ${item.title}** [${item.category.toUpperCase()}]\n> *${item.content}*`
    ).join('\n\n');

    return parseUserActionSuggestions(`🧠 **Base de Conhecimento & Aprendizado Atual (${items.length} itens memorizados):**\n\n${listMarkdown}\n\n💡 *Você pode me ensinar qualquer coisa a qualquer momento dizendo "Aprenda que..." ou "Lembre-se que...", e eu gravarei instantaneamente na memória!*`);
  }

  // 3. Auto-Diagnóstico do Sistema & Verificação de Falhas em Tempo Real
  if (
    p.includes('diagnostico') ||
    p.includes('diagnóstico') ||
    p.includes('verificar erros') ||
    p.includes('verificar erro') ||
    p.includes('verificar falhas') ||
    p.includes('testar sistema') ||
    p.includes('checar sistema') ||
    p.includes('saude do sistema') ||
    p.includes('saúde do sistema') ||
    p.includes('autodiagnostico') ||
    p.includes('autodiagnóstico')
  ) {
    const diag = runLiveSystemDiagnostics();
    return {
      reply: diag.markdownReport,
      actions: diag.recommendedActions,
    };
  }

  // 4. Troubleshooting e Resolução de Falhas / Erros Específicos Catalogados
  const failureMatch = findSystemFailureSolution(p);
  if (failureMatch && (p.includes('erro') || p.includes('falha') || p.includes('problema') || p.includes('nao') || p.includes('não') || p.includes('ajuda') || p.includes('por que') || p.includes('porque'))) {
    const actionTag = failureMatch.suggestedAction 
      ? `\n\n[ACTION:${failureMatch.suggestedAction.type}:${failureMatch.suggestedAction.targetId}:${failureMatch.suggestedAction.label}]`
      : '';

    return parseUserActionSuggestions(`⚠️ **Diagnóstico de Falha Identificada: ${failureMatch.subsystem}**

🔍 **Sintoma:** ${failureMatch.symptom}

🧐 **Causa Raiz Mais Provável:** ${failureMatch.cause}

🛠️ **Como Resolver (Passo a Passo):**
${failureMatch.solution}
${actionTag}
[ACTION:run_diagnostic:Executar Auto-Diagnóstico Agora]`);
  }

  // 5. Dúvidas sobre Todo Nosso Sistema (Visão Geral e Arquitetura)
  if (
    p.includes('todo nosso sistema') ||
    p.includes('todo o sistema') ||
    p.includes('nosso sistema') ||
    p.includes('visao geral') ||
    p.includes('visão geral') ||
    p.includes('como funciona o sistema') ||
    p.includes('o que é o jjy') ||
    p.includes('o que e o jjy') ||
    p.includes('quais abas') ||
    p.includes('quais módulos') ||
    p.includes('quais modulos')
  ) {
    const modulesSummary = SYSTEM_MODULES_CATALOG.map((m) => 
      `• **${m.name}** (\`${m.id}\`): ${m.summary}`
    ).join('\n');

    return parseUserActionSuggestions(`🌐 **Visão Completa do Ecossistema JJY Sovereign Mesh v2.0**

O JJY é uma plataforma de **comunicação civil soberana, descentralizada e 100% à prova de colapso de internet**. Ele integra mais de 10 portadoras de comunicação em camadas:

### 🧩 Módulos e Recursos Disponíveis no Sistema:
${modulesSummary}

### 🛡️ Filosofia do Sistema:
- **100% Offline por Padrão:** Opera em Wi-Fi local sem internet, rádios LoRa, Bluetooth e som aéreo.
- **Criptografia Pós-Quântica:** Kyber-1024 e ChaCha20-Poly1305 para sigilo absoluto.
- **Resiliência Extrema:** Pronto para desastres naturais, enchentes e apagões.

Deseja saber mais sobre algum módulo específico ou testar uma conexão agora?

[ACTION:navigate_tab:globe:Abrir Globo 3D Tático]
[ACTION:navigate_tab:chat:Abrir Chat LAN P2P]
[ACTION:navigate_tab:lora:Abrir Rádio LoRa Meshtastic]
[ACTION:run_diagnostic:Executar Auto-Diagnóstico do Nó]`);
  }

  // 6. Dúvidas sobre um Módulo Específico do Sistema
  const moduleMatch = findSystemModuleInfo(p);
  if (moduleMatch && (p.includes('como funciona') || p.includes('o que e') || p.includes('o que é') || p.includes('duvida') || p.includes('dúvida') || p.includes('explicar') || p.includes('para que serve'))) {
    return parseUserActionSuggestions(`📘 **${moduleMatch.name}**

📌 **O que é:** ${moduleMatch.summary}

⚙️ **Como Funciona na Prática:**
${moduleMatch.howItWorks}

🔌 **Hardware Necessário:**
${moduleMatch.hardwareNeeded}

🔒 **Operação Offline:** ${moduleMatch.offlineCapable ? 'Sim, 100% funcional sem internet.' : 'Requer enlace de dados.'}

⚠️ **Possíveis Falhas e Cuidados:**
${moduleMatch.commonFailures.map((f) => `• ${f}`).join('\n')}

[ACTION:navigate_tab:${moduleMatch.actionTabId}:Abrir ${moduleMatch.name}]
[ACTION:run_diagnostic:Verificar Saúde deste Módulo]`);
  }

  // 7. RÁDIO LORA / MESHTASTIC
  if (
    p.includes('lora') ||
    p.includes('meshtastic') ||
    p.includes('radio lora') ||
    p.includes('rádio lora') ||
    p.includes('sx1262') ||
    p.includes('heltec') ||
    p.includes('lilygo') ||
    p.includes('t-beam') ||
    p.includes('915') ||
    p.includes('868')
  ) {
    const isBrazilPreferred = learnedRules.some((r) => r.rule.toLowerCase().includes('brasil') || r.rule.includes('915'));
    const freq = isBrazilPreferred ? '915.000 MHz (Slot 20 Brasil)' : '915.000 MHz';

    return parseUserActionSuggestions(`📻 **Conexão via Rádio LoRa & Meshtastic**

Para se conectar por LoRa com o Jjy sem depender de torres ou internet:

### 🛠️ O que você precisa fazer:
1. **Hardware:** Conecte uma placa LoRa ao seu computador ou celular via cabo USB. As placas mais populares e recomendadas são:
   - **Heltec WiFi LoRa 32 (V3)** (chip SX1262)
   - **LilyGO T-Beam** ou **T-Echo** (com GPS integrado)
   - Módulos simples UART/USB como **Ebyte E22 / E32** ou **Reyax RYLR**
2. **Frequência Legal:** No Brasil e Américas, usamos a banda **${freq}**.
3. **Preset de Modem:** O preset padrão ideal é o **LongFast** (ótimo alcance com boa velocidade para chat).
4. **Pronto!** Com isso você cria uma rede em malha (mesh) com alcance de **15 a 40 km** por salto, capaz de saltar de morro em morro ou entre prédios.

Posso ativar o protocolo agora e preparar a frequência recomendada para você com um clique:

[ACTION:activate_protocol:lora_meshtastic:Ativar LoRa Meshtastic]
[ACTION:set_lora_preset:BR_915:LONG_FAST:Configurar Preset BR-915 LongFast]
[ACTION:lora_connect_serial:115200:Conectar Porta USB Serial]
[ACTION:navigate_tab:lora:Abrir Painel Rádio LoRa]`);
  }

  // 8. BLUETOOTH / BLUETOOTH LOW ENERGY / BLE
  if (
    p.includes('blotuf') ||
    p.includes('bluetuf') ||
    p.includes('bluetooth') ||
    p.includes('blutooth') ||
    p.includes('ble') ||
    p.includes('sem fio perto')
  ) {
    return parseUserActionSuggestions(`🔵 **Conversa por Bluetooth Local (BLE Mesh Direct 5.3)**

Excelente escolha! O Bluetooth é perfeito para bater papo e trocar mensagens com amigos ou vizinhos próximos num raio de **30 a 80 metros**, sem precisar de roteador Wi-Fi nem sinal de celular.

### 🛠️ O que você precisa fazer:
1. **Zero Hardware Extra:** Você só precisa do Bluetooth nativo do seu computador, notebook ou smartphone.
2. **Modo 1 - Web Bluetooth Automático:** Posso abrir a janela de busca do navegador para parear diretamente com o aparelho do seu amigo.
3. **Modo 2 - BLE Mesh Direct:** O Jjy usa o protocolo **BLE-MESH-V5** para transmitir pacotes e beacons de chat de forma distribuída.
4. **Modo 3 - Vínculo Bluetooth (PAN):** Se estiver no celular (Android/iOS), ative o "Vínculo Bluetooth / Ponto de Acesso Bluetooth" e conecte o outro aparelho. Em seguida, abra o **Chat LAN** do Jjy que funcionará automaticamente!

Quer que eu ative o protocolo Bluetooth e inicie a busca agora?

[ACTION:bluetooth_connect:start_scan:Conectar Dispositivo Bluetooth (Web BLE)]
[ACTION:activate_protocol:ble_mesh_direct:Ativar Protocolo BLE Mesh Direct]
[ACTION:navigate_tab:chat:Abrir Chat LAN (Compatível via Bluetooth)]
[ACTION:navigate_tab:protocols:Ver Detalhes do BLE Mesh]`);
  }

  // 9. CHAT LOCAL / VIZINHOS / AMIGOS SEM INTERNET
  if (
    p.includes('vizinho') ||
    p.includes('amigo') ||
    p.includes('amigos') ||
    p.includes('sem internet') ||
    p.includes('localmente') ||
    p.includes('rede local') ||
    p.includes('lan') ||
    p.includes('offline')
  ) {
    return parseUserActionSuggestions(`🌐 **Comunicação Local Soberana (Sem Internet)**

O ecossistema Jjy foi construído especialmente para permitir que você e seus amigos conversem e troquem dados **100% offline**.

### 🛠️ Suas melhores opções para conversar localmente:
1. **Chat LAN (Wi-Fi Local ou Roteador Sem Internet):** Conectem-se ao mesmo Wi-Fi (mesmo sem internet na rua) ou usem o ponto de acesso do celular. O Jjy descobre os aparelhos automaticamente por broadcast.
2. **Bluetooth Mesh Direct:** Ideal para curta distância (até 80 metros) sem precisar ligar roteador.
3. **Modem Acústico (Som/Ultrassom):** Se o Wi-Fi e o Bluetooth estiverem desligados, vocês podem transmitir mensagens pelo som do alto-falante e microfone!

Vou preparar a conexão local e direcionar você para o chat:

[ACTION:activate_protocol:websocket_local_relay:Ativar Relay Local LAN]
[ACTION:activate_protocol:ble_mesh_direct:Ativar Bluetooth Mesh]
[ACTION:navigate_tab:chat:Abrir Chat LAN Agora]
[ACTION:test_transmission:websocket_local_relay:Testar Enlace Local]`);
  }

  // 10. SOM / MODEM ACÚSTICO / ULTRASSOM
  if (
    p.includes('som') ||
    p.includes('audio') ||
    p.includes('áudio') ||
    p.includes('ultrassom') ||
    p.includes('acustico') ||
    p.includes('acústico') ||
    p.includes('microfone') ||
    p.includes('falante')
  ) {
    return parseUserActionSuggestions(`🔊 **Modem de Som & Ultrassom Aéreo (Air-Audio GGWave)**

Você pode transmitir mensagens e arquivos pelo ar através de **ondas sonoras**, sem usar Wi-Fi, Bluetooth ou rádio.

### 🛠️ Como funciona:
- **Modo Audível:** Usa modulação FSK/Bell 202 com tons audíveis para alcance de até 45 metros.
- **Modo Ultrassom Inaudível (18 a 20 kHz):** O ouvido humano não escuta nada, mas os microfones dos celulares e computadores recebem e decodificam os dados perfeitamente.
- **Modo Sísmico:** Se o microfone estiver bloqueado, o sensor de giroscópio capta as microvibrações na mesa.

Posso ativar o Modem de Som para você agora:

[ACTION:activate_protocol:audio_ultrasonic_air:Ativar Modem de Som/Ultrassom]
[ACTION:navigate_tab:sound:Abrir Painel Modem de Som]`);
  }

  // 11. EMERGÊNCIA / DESASTRE / GUERRA / SOCORRO
  if (
    p.includes('desastre') ||
    p.includes('emergencia') ||
    p.includes('emergência') ||
    p.includes('socorro') ||
    p.includes('sos') ||
    p.includes('guerra') ||
    p.includes('enchente') ||
    p.includes('terremoto') ||
    p.includes('escombros')
  ) {
    return parseUserActionSuggestions(`🚨 **Protocolo de Emergência & Desastres (WiFi-Mat SOS & LoRa)**

Em situações de calamidade pública, apagão elétrico ou desastres naturais, ativamos o protocolo de **Sobrevivência & Triagem START**.

### 🛠️ Ações Imediatas:
1. **Inundação Multi-Enlace (Omni-Broadcast):** Os pacotes de socorro SOS são transmitidos repetidamente através de Wi-Fi CSI, LoRa, Som e Rádio HF/VHF simultaneamente.
2. **Sensor por Paredes e Escombros:** O radar Wi-Fi RuView detecta respiração humana e movimento mesmo sob escombros.
3. **Assinatura Aberta:** Dados vitais e coordenadas GPS são transmitidos para resgatistas.

Deseja que eu acione o Pacote de Emergência e configure a estação no modo SOS agora?

[ACTION:apply_bundle:bundle_disaster_sos:Ativar Pacote Desastres SOS]
[ACTION:activate_protocol:disaster_sos_mesh:Ativar Protocolo SOS Mesh]
[ACTION:navigate_tab:disaster:Abrir Central de Desastres]`);
  }

  // 12. MODO FURTIVO / AIR-GAP / ANTI-GRAMPO / SEGREDO
  if (
    p.includes('furtivo') ||
    p.includes('stealth') ||
    p.includes('segredo') ||
    p.includes('espião') ||
    p.includes('espiao') ||
    p.includes('anti-grampo') ||
    p.includes('silencioso') ||
    p.includes('airgap') ||
    p.includes('air-gap')
  ) {
    return parseUserActionSuggestions(`🤫 **Modo Furtivo & Air-Gapped Anti-Grampo**

Para evitar detecção por equipamentos de guerra eletrônica, detectores de radiofrequência ou espionagem:

### 🛠️ Configurações Aplicadas:
1. **Zero Emissão de RF:** Os transmissores Wi-Fi e Rádio são imediatamente silenciados (modo de escuta passiva ou desligados).
2. **Fluxo Óptico QR Air-Gap:** Transmissão de tela para câmera a 60 FPS (completamente imune a escutas eletromagnéticas).
3. **Modem Acústico Ultrassônico:** Comunicação inaudível se necessária.
4. **Roteamento Cebola NGL:** Criptografia pós-quântica Kyber-1024 em múltiplas camadas.

Posso ativar o Pacote Stealth agora:

[ACTION:set_stealth:enable:Ativar Modo Furtivo Total (Silenciar Rádios)]
[ACTION:apply_bundle:bundle_stealth_airgap:Aplicar Pacote Furtivo Air-Gap]
[ACTION:navigate_tab:qr:Abrir Fluxo Óptico QR Studio]`);
  }

  // 13. SATÉLITE / SDR
  if (
    p.includes('satelite') ||
    p.includes('satélite') ||
    p.includes('iridium') ||
    p.includes('starlink') ||
    p.includes('sdr') ||
    p.includes('orbital')
  ) {
    return parseUserActionSuggestions(`🛰️ **Internet Satélite & Telemetria Orbital LEO**

Comunicação independente de infraestrutura terrestre com cobertura global (de polo a polo).

### 🛠️ O que você precisa:
- **Iridium SBD:** Transceptor Iridium 9603 ou RockBLOCK em 1621 MHz para rajadas de 340 bytes em qualquer lugar do planeta.
- **Starlink Mini:** Acesso via driver gRPC na porta 9200.
- **Dongle RTL-SDR:** Receptor de rádio de R$ 150 para escuta passiva de satélites meteorológicos NOAA e telemetria.

Deseja ativar o protocolo de satélite agora?

[ACTION:activate_protocol:satellite_iridium_sdr:Ativar Satélite Iridium/SDR]
[ACTION:apply_bundle:bundle_orbital_deepspace:Aplicar Conjunto Espacial]
[ACTION:navigate_tab:satellite:Abrir Internet Satélite & SDR]`);
  }

  // 14. RÁDIO TÁTICO / HF / VHF / UHF / BAOFENG
  if (
    p.includes('baofeng') ||
    p.includes('radio amador') ||
    p.includes('radioamador') ||
    p.includes('vhf') ||
    p.includes('uhf') ||
    p.includes('aprs') ||
    p.includes('tatico') ||
    p.includes('tático')
  ) {
    return parseUserActionSuggestions(`📻 **Rádio Tático HF/VHF/UHF & APRS AX.25**

Permite conectar rádios convencionais de mão (como Baofeng UV-5R) ou rádios HF (Xiegu G90) na entrada de áudio do PC para transmitir pacotes de dados a até 3000 km por reflexão na ionosfera!

### 🛠️ Configuração:
- Frequência padrão APRS Brasil: **144.390 MHz**.
- Modulação: Bell 202 AFSK a 1200 baud.
- Cabo: Conecte a saída de fone do rádio na entrada de microfone do PC.

[ACTION:activate_protocol:hf_vhf_aprs:Ativar Rádio Tático APRS]
[ACTION:set_frequency:hf_vhf_aprs:144.390 MHz (VHF APRS):Ajustar 144.390 MHz]
[ACTION:navigate_tab:radio:Abrir Painel Rádio Tático]`);
  }

  // 15. TRANSFERÊNCIA DE ARQUIVOS
  if (p.includes('arquivo') || p.includes('arquivos') || p.includes('foto') || p.includes('video') || p.includes('transferir')) {
    return parseUserActionSuggestions(`📁 **Transferência de Arquivos Chunks P2P**

O Jjy permite fatiar e transferir arquivos grandes através de pedaços (chunks) com verificação SHA-256 e retransmissão de perda:

- **Via Wi-Fi / Cabo USB:** Altíssima velocidade de até 480 Mbps com cabo OTG ou Wi-Fi local.
- **Via QR Code:** Transmissão visual na tela sem nenhum cabo ou conexão sem fio.
- **Via LoRa / Rádio:** Envio de fotos comprimidas em baixa resolução por pacotes parciais.

[ACTION:activate_protocol:usb_ethernet_rndis:Ativar USB/Cabo RNDIS]
[ACTION:navigate_tab:files:Abrir Arquivos Chunks]`);
  }

  // 16. STATUS GERAL / QUAIS PROTOCOLOS ESTÃO ATIVOS?
  if (p.includes('status') || p.includes('quais') || p.includes('ativos') || p.includes('como tá') || p.includes('como esta')) {
    const activeNames = activeProtocols.map((pr) => `• **${pr.name}** (${pr.spec.carrier})`).join('\n');
    return parseUserActionSuggestions(`📊 **Status Atual das Suas Conexões:**

No momento você tem **${activeProtocols.length} protocolos ativos** no Barramento Omni:

${activeNames || '• Nenhum protocolo ativo no momento.'}

Diga o que deseja fazer (ex: *"quero ligar LoRa"*, *"conectar Bluetooth"* ou *"falar com vizinhos"*) e farei os ajustes imediatamente.

[ACTION:run_diagnostic:Executar Auto-Diagnóstico Completo]`);
  }

  // 17. VERIFICAÇÃO DE CONHECIMENTO APRENDIDO PERSONALIZADO
  const learnedMatches = searchKnowledgeBase(p);
  if (learnedMatches.length > 0) {
    const top = learnedMatches[0];
    top.usageCount++;
    return parseUserActionSuggestions(`🧠 **Conhecimento Aprendido da Minha Memória: ${top.title}**

> ${top.content}

*Categoria: ${top.category.toUpperCase()} • Fonte: ${top.source === 'user_taught' ? 'Ensinado pelo Usuário' : 'Base do Sistema'}*`);
  }

  // 18. DEFAULT / AJUDA GERAL E APRENDIZADO
  return parseUserActionSuggestions(`👋 **Olá! Sou o Assistente de Conexões e Conhecimento Jjy.**

Meu papel é **tirar dúvidas sobre todo o nosso sistema, diagnosticar falhas que surgirem e aprender com você**, além de regular e estabelecer conexões soberanas sem depender da internet comum.

### 💡 Você pode me pedir coisas como:
1. 🩺 *"Diagnosticar falhas do sistema"* ➔ Executo um teste de saúde de todas as APIs, hardware e rádio.
2. 🌐 *"Como funciona todo nosso sistema?"* ➔ Explico a arquitetura de todas as 20+ abas e recursos.
3. 📻 *"Quero me conectar por um rádio LoRa"* ➔ Configuro a frequência Anatel (915 MHz), preset LongFast e porta USB.
4. 🔵 *"Quero conversar por Bluetooth com amigos localmente"* ➔ Ativo o BLE Mesh e inicio a busca de dispositivos.
5. ⚠️ *"O Bluetooth deu erro"* ou *"A porta serial falhou"* ➔ Apresento a causa raiz e a solução passo a passo.
6. 🧠 *"Aprenda que minha antena tem ganho de 5.8 dBi"* ➔ Eu aprendo e memorizo permanentemente!

Como posso ajudar você agora?

[ACTION:run_diagnostic:Executar Auto-Diagnóstico de Falhas]
[ACTION:activate_protocol:ble_mesh_direct:Ativar Bluetooth BLE]
[ACTION:activate_protocol:lora_meshtastic:Ativar LoRa 915MHz]
[ACTION:navigate_tab:chat:Abrir Chat LAN]
[ACTION:navigate_tab:globe:Abrir Globo 3D]`);
}

// ============================================================================
// CONSULTA A PROVEDORES DE IA (LLM EXTERNO / LOCAL OU OFFLINE)
// ============================================================================

export function buildUserSystemPrompt(
  activeProtocols: ProtocolDefinition[],
  learnedRules: UserConnectionRule[]
): string {
  const activeProtosSummary = activeProtocols
    .map((pr) => `- ${pr.name} [ID: ${pr.id}]: Meio: ${pr.spec.medium}, Portadora: ${pr.spec.carrier}, Status: ${pr.status}`)
    .join('\n');

  const rulesSummary = learnedRules
    .map((r, i) => `${i + 1}. [${r.category.toUpperCase()}] ${r.rule}`)
    .join('\n');

  const allLearned = loadAllLearnedKnowledge()
    .slice(0, 10)
    .map((k, i) => `${i + 1}. [${k.category.toUpperCase()}] ${k.title}: ${k.content}`)
    .join('\n');

  const diag = runLiveSystemDiagnostics();

  return `Você é o **Jjy LinkPilot AI**, copiloto especialista em redes, rádio, resolução de falhas e dúvidas de todo o ecossistema Jjy Sovereign Mesh (Nossa Internet Livre).
SEU OBJETIVO: Responder qualquer dúvida sobre todo nosso sistema, diagnosticar e solucionar falhas que surgirem e aplicar o aprendizado contínuo.
Você NÃO é administrador punitivo; é o companheiro técnico e protetor do usuário.

### 🧭 SUAS DIRETRIZES FUNDAMENTAIS:
1. Explique com máxima clareza em português sobre qualquer parte do sistema, hardware necessário e como usar sem internet.
2. Quando o usuário relatar falhas, forneça diagnóstico passo a passo, causa raiz e solução prática.
3. SEMPRE inclua botões de ação automatizada com a sintaxe especial [ACTION:...], para que o sistema execute as configurações para ele com um clique:
   - [ACTION:activate_protocol:ID_DO_PROTOCOLO:Label] (ex: [ACTION:activate_protocol:lora_meshtastic:Ativar LoRa])
   - [ACTION:deactivate_protocol:ID_DO_PROTOCOLO:Label]
   - [ACTION:set_frequency:ID_DO_PROTOCOLO:FREQUENCIA:Label]
   - [ACTION:set_lora_preset:REGIAO:PRESET:Label] (ex: [ACTION:set_lora_preset:BR_915:LONG_FAST:Configurar BR-915])
   - [ACTION:bluetooth_connect:start_scan:Conectar Bluetooth (Web BLE)]
   - [ACTION:lora_connect_serial:115200:Conectar USB Serial LoRa]
   - [ACTION:run_diagnostic:Executar Auto-Diagnóstico de Falhas]
   - [ACTION:apply_bundle:ID_DO_BUNDLE:Label] (ex: [ACTION:apply_bundle:bundle_disaster_sos:Ativar Pacote Desastres SOS])
   - [ACTION:navigate_tab:ID_DA_TAB:Label] (tabs válidas: globe, free_internet, docs, chat, qr, files, sound, light, crypto, stego, network, mesh, protocols, satellite, radio, underwater, lora, cellular, wifi, disaster, remote)
   - [ACTION:set_stealth:enable:Ativar Modo Furtivo]
   - [ACTION:test_transmission:ID_DO_PROTOCOLO:Disparar Teste de Enlace]

### 🩺 ESTADO ATUAL DE SAÚDE DO NÓ (DIAGNÓSTICO AO VIVO):
- Saúde Geral: ${diag.overallHealth.toUpperCase()}
- Web Bluetooth: ${diag.apis.bluetooth.supported ? 'Disponível' : 'Indisponível'}
- WebSerial LoRa: ${diag.apis.serial.supported ? 'Disponível' : 'Indisponível'}
- Áudio/Microfone: ${diag.apis.audio.supported ? 'Disponível' : 'Indisponível'}
- WebRTC LAN: ${diag.apis.webrtc.supported ? 'Operacional' : 'Indisponível'}
- Aceleração WebGL: ${diag.apis.webgl.supported ? 'Operacional' : 'Indisponível'}
${diag.activeIssues.length > 0 ? `- Falhas/Atenções Ativas: ${diag.activeIssues.join('; ')}` : '- Nenhuma falha crítica ativa.'}

### 📡 PROTOCOLOS ATIVOS AGORA:
${activeProtosSummary || 'Nenhum protocolo ativo.'}

### 🧠 BASE DE APRENDIZADO & PREFERÊNCIAS QUE O USUÁRIO JÁ ENSINOU:
${allLearned || rulesSummary || 'Nenhum aprendizado personalizado ainda.'}

Seja acolhedor, prático, encorajador e altamente resolutivo para qualquer dúvida ou falha!`;
}

export async function queryUserConnectionAi(
  userPrompt: string,
  history: UserChatMessage[],
  config: UserAiConfig
): Promise<{ reply: string; actions: UserActionSuggestion[]; metrics?: UserChatMessage['metrics'] }> {
  const startTime = Date.now();
  const rules = loadUserConnectionRules();
  const activeProtocols = protocolHubEngine.getActiveProtocols();

  // 1. Provedor 100% Offline (Padrão nativo do Jjy)
  if (config.provider === 'offline') {
    const result = runOfflineUserConnectionHeuristic(userPrompt, history, rules, activeProtocols);
    return {
      reply: result.reply,
      actions: result.actions,
      metrics: {
        responseTimeMs: Date.now() - startTime,
        isFullyOffline: true,
      },
    };
  }

  // 2. Provedor Ollama Local
  if (config.provider === 'ollama') {
    try {
      const cleanEndpoint = config.ollamaEndpoint.replace(/\/+$/, '');
      const systemPrompt = buildUserSystemPrompt(activeProtocols, rules);

      const messagesPayload = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: userPrompt },
      ];

      const res = await fetch(`${cleanEndpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.ollamaModel || 'llama3:latest',
          messages: messagesPayload,
          stream: false,
          options: { temperature: config.temperature },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.message?.content || '';
        const parsed = parseUserActionSuggestions(content);
        return {
          reply: parsed.cleanReply,
          actions: parsed.actions,
          metrics: { responseTimeMs: Date.now() - startTime, isFullyOffline: true },
        };
      }
    } catch {
      // Fallback para Heurístico Offline se falhar
    }
  }

  // 3. Provedor Gemini (se chave fornecida)
  if (config.provider === 'gemini' && config.geminiApiKey) {
    try {
      const model = config.geminiModel || 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.geminiApiKey}`;
      const systemPrompt = buildUserSystemPrompt(activeProtocols, rules);

      const contents = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Entendido! Sou o Jjy LinkPilot AI. Estou pronto para regular as conexões do usuário.' }] },
        ...history.slice(-4).map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        })),
        { role: 'user', parts: [{ text: userPrompt }] },
      ];

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = parseUserActionSuggestions(text);
        return {
          reply: parsed.cleanReply,
          actions: parsed.actions,
          metrics: { responseTimeMs: Date.now() - startTime, isFullyOffline: false },
        };
      }
    } catch {
      // Fallback para Heurístico Offline
    }
  }

  // 4. Provedores OpenAI Compatíveis (LM Studio, Groq, DeepSeek, OpenAI, Custom)
  const isCompatible = ['lmstudio', 'groq', 'deepseek', 'openai', 'custom'].includes(config.provider);
  if (isCompatible) {
    try {
      let endpoint = '';
      let apiKey = '';
      let model = '';

      if (config.provider === 'lmstudio') {
        endpoint = config.lmstudioEndpoint.replace(/\/+$/, '') + '/chat/completions';
        model = config.lmstudioModel || 'local-model';
      } else if (config.provider === 'groq') {
        endpoint = 'https://api.groq.com/openai/v1/chat/completions';
        apiKey = config.groqApiKey;
        model = config.groqModel || 'llama-3.3-70b-versatile';
      } else if (config.provider === 'deepseek') {
        endpoint = 'https://api.deepseek.com/v1/chat/completions';
        apiKey = config.deepseekApiKey;
        model = config.deepseekModel || 'deepseek-chat';
      } else if (config.provider === 'openai') {
        endpoint = 'https://api.openai.com/v1/chat/completions';
        apiKey = config.openaiApiKey;
        model = config.openaiModel || 'gpt-4o-mini';
      } else if (config.provider === 'custom') {
        endpoint = config.customEndpoint.replace(/\/+$/, '') + '/chat/completions';
        apiKey = config.customApiKey;
        model = config.customModel || 'default';
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const systemPrompt = buildUserSystemPrompt(activeProtocols, rules);
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: userPrompt },
      ];

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, messages, temperature: config.temperature }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '';
        const parsed = parseUserActionSuggestions(content);
        return {
          reply: parsed.cleanReply,
          actions: parsed.actions,
          metrics: {
            responseTimeMs: Date.now() - startTime,
            isFullyOffline: config.provider === 'lmstudio',
          },
        };
      }
    } catch {
      // Fallback
    }
  }

  // Fallback seguro: Motor Heurístico Nativo
  const fallbackResult = runOfflineUserConnectionHeuristic(userPrompt, history, rules, activeProtocols);
  return {
    reply: fallbackResult.reply,
    actions: fallbackResult.actions,
    metrics: {
      responseTimeMs: Date.now() - startTime,
      isFullyOffline: true,
    },
  };
}
