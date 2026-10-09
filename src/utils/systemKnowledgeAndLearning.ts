/**
 * systemKnowledgeAndLearning.ts
 * Motor de Aprendizado Contínuo, Base de Conhecimento e Diagnóstico de Falhas
 * Jjy Sovereign Mesh v2.0
 * 
 * Funcionalidades:
 * 1. Base enciclopédica de todo o sistema JJY (todos os 20+ módulos/abas, protocolos e hardware).
 * 2. Catálogo inteligente de resolução de falhas comuns e troubleshooting.
 * 3. Auto-diagnóstico em tempo real (APIs Web, WebRTC, Bluetooth, Serial, Áudio, WebGL, GPS e Relatório de Nó).
 * 4. Buffer de captura de erros e exceções de runtime em tempo real.
 * 5. Sistema de aprendizado dinâmico persistente (usuário ensina e a IA memoriza regras, correções e preferências).
 */

import { DiagnosticoNo, RelatorioSaude } from './jjyDiagnostico';
import { UserActionSuggestion, parseUserActionSuggestions } from './userConnectionAiEngine';

// ============================================================================
// TIPOS E INTERFACES DA BASE DE CONHECIMENTO & APRENDIZADO
// ============================================================================

export type KnowledgeCategory =
  | 'system_feature'
  | 'failure_fix'
  | 'user_preference'
  | 'hardware_note'
  | 'faq';

export interface LearnedKnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: KnowledgeCategory;
  triggerKeywords: string[];
  source: 'user_taught' | 'auto_learned_diagnostic' | 'default_system';
  createdAt: number;
  updatedAt: number;
  usageCount: number;
}

export interface SystemModuleInfo {
  id: string;
  name: string;
  category: 'rede' | 'radio' | 'seguranca' | 'utilitarios' | 'sobrevivencia';
  summary: string;
  howItWorks: string;
  hardwareNeeded: string;
  offlineCapable: boolean;
  commonFailures: string[];
  actionTabId: string;
}

export interface SystemFailureRecord {
  id: string;
  subsystem: string;
  symptom: string;
  cause: string;
  solution: string;
  suggestedAction?: {
    type: string;
    targetId: string;
    label: string;
  };
  keywords: string[];
}

export interface LiveDiagnosticResult {
  timestamp: number;
  overallHealth: 'healthy' | 'degraded' | 'critical';
  apis: {
    bluetooth: { supported: boolean; details: string };
    serial: { supported: boolean; details: string };
    usb: { supported: boolean; details: string };
    audio: { supported: boolean; details: string };
    camera: { supported: boolean; details: string };
    webrtc: { supported: boolean; details: string };
    webgl: { supported: boolean; details: string };
    geolocation: { supported: boolean; details: string };
    online: { supported: boolean; details: string };
  };
  activeIssues: string[];
  recentErrors: { timestamp: number; message: string; source?: string }[];
  recommendedActions: UserActionSuggestion[];
  markdownReport: string;
}

// ============================================================================
// SINGLETON DO DIAGNÓSTICO DE NÓ E BUFFER DE ERROS DE RUNTIME
// ============================================================================

export const globalNodeDiagnostic = new DiagnosticoNo();

interface RuntimeErrorMessage {
  timestamp: number;
  message: string;
  source?: string;
}

const RUNTIME_ERROR_BUFFER_MAX = 20;
const runtimeErrorBuffer: RuntimeErrorMessage[] = [];

// Interceptor de Erros e Rejeições Não Tratadas do Navegador
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    try {
      const msg = event.message || 'Erro não especificado de script';
      const src = event.filename ? `${event.filename}:${event.lineno}` : 'script';
      runtimeErrorBuffer.unshift({ timestamp: Date.now(), message: msg, source: src });
      if (runtimeErrorBuffer.length > RUNTIME_ERROR_BUFFER_MAX) runtimeErrorBuffer.pop();
      globalNodeDiagnostic.gerarAlerta('Atencao', 'Runtime', `${msg} (${src})`);
    } catch {}
  });

  window.addEventListener('unhandledrejection', (event) => {
    try {
      const reason = event.reason ? String(event.reason) : 'Promise rejeitada sem tratamento';
      runtimeErrorBuffer.unshift({ timestamp: Date.now(), message: reason, source: 'Promise' });
      if (runtimeErrorBuffer.length > RUNTIME_ERROR_BUFFER_MAX) runtimeErrorBuffer.pop();
      globalNodeDiagnostic.gerarAlerta('Atencao', 'Async', `Falha assíncrona: ${reason}`);
    } catch {}
  });
}

export function recordSystemEventError(subsystem: string, errorMsg: string): void {
  runtimeErrorBuffer.unshift({ timestamp: Date.now(), message: errorMsg, source: subsystem });
  if (runtimeErrorBuffer.length > RUNTIME_ERROR_BUFFER_MAX) runtimeErrorBuffer.pop();
  globalNodeDiagnostic.atualizarSubsistema(subsystem, 'Degradado', errorMsg);
}

// ============================================================================
// CATÁLOGO COMPLETO DE MÓDULOS E RECURSOS DO SISTEMA JJY
// ============================================================================

export const SYSTEM_MODULES_CATALOG: SystemModuleInfo[] = [
  {
    id: 'globe',
    name: 'Globo 3D Tático & Mapa Soberano',
    category: 'utilitarios',
    summary: 'Visualização tridimensional global dos nós da malha, telemetria em tempo real, satélites LEO (Starlink/Iridium) e posicionamento geoespacial soberano.',
    howItWorks: 'Renderiza a Terra em WebGL com esferas táteis, nós geolocalizados, arcos de enlace P2P e controle de privacidade de localização (10km fuzzed por segurança ou alta precisão para emergências e amigos).',
    hardwareNeeded: 'Nenhum hardware especial. Requer apenas navegador com suporte a WebGL e aceleração de hardware.',
    offlineCapable: true,
    commonFailures: ['Tela preta ou WebGL Context Lost', 'GPS desativado ou permissão negada', 'Dispositivo fraco com taxa de quadros baixa'],
    actionTabId: 'globe',
  },
  {
    id: 'free_internet',
    name: 'Manifesto da Internet Livre & Redes Autônomas',
    category: 'sobrevivencia',
    summary: 'Princípios fundamentais de soberania digital, direito à comunicação sem provedores centrais, arquitetura anti-censura e segurança coletiva.',
    howItWorks: 'Apresenta a doutrina e arquitetura descentralizada do JJY Sovereign Mesh, orientando a operação em zonas de conflito ou colapso de infraestrutura.',
    hardwareNeeded: 'Nenhum.',
    offlineCapable: true,
    commonFailures: ['Nenhuma falha técnica.'],
    actionTabId: 'free_internet',
  },
  {
    id: 'docs',
    name: 'Documentação do Projeto & Engenharia',
    category: 'utilitarios',
    summary: 'Manuais técnicos, diagramas de blocos, esquemas de rádio e especificações formais de cada camada do ecossistema.',
    howItWorks: 'Biblioteca offline com guia passo a passo para operadores de rádio amador, socorristas e usuários civis.',
    hardwareNeeded: 'Nenhum.',
    offlineCapable: true,
    commonFailures: ['Nenhuma falha técnica.'],
    actionTabId: 'docs',
  },
  {
    id: 'chat',
    name: 'Chat LAN / P2P Descentralizado',
    category: 'rede',
    summary: 'Mensageria local instantânea criptografada ponta a ponta sem servidor central, operando em redes locais, Wi-Fi sem internet ou Bluetooth.',
    howItWorks: 'Descobre vizinhos na rede por broadcast e WebSockets locais, transmitindo textos com assinatura e criptografia ChaCha20/Kyber.',
    hardwareNeeded: 'Nenhum para Wi-Fi/LAN. Para Bluetooth, requer adaptador Bluetooth BLE nativo.',
    offlineCapable: true,
    commonFailures: ['Roteador com isolamento de clientes (AP Isolation)', 'Firewall bloqueando porta de broadcast', 'Nenhum colega no mesmo Wi-Fi'],
    actionTabId: 'chat',
  },
  {
    id: 'qr',
    name: 'QR Studio (Fluxo Óptico Air-Gap)',
    category: 'seguranca',
    summary: 'Transmissão de dados sem emitir nenhuma onda de rádio, projetando sequências de QR Codes a 30-60 FPS de uma tela para a câmera de outro aparelho.',
    howItWorks: 'Fatia arquivos e mensagens em pedaços binários codificados em QR Codes dinâmicos com correção de erro Reed-Solomon.',
    hardwareNeeded: 'Tela em um aparelho e câmera/webcam no outro. Imune a grampos e guerra eletrônica RF.',
    offlineCapable: true,
    commonFailures: ['Permissão de câmera negada', 'Câmera fora de foco ou ambiente muito escuro', 'Brilho da tela emissora muito baixo'],
    actionTabId: 'qr',
  },
  {
    id: 'files',
    name: 'Transferência de Arquivos Chunks P2P',
    category: 'utilitarios',
    summary: 'Envio resiliente de arquivos fatiados em blocos com hash SHA-256 e retransmissão seletiva de pacotes perdidos.',
    howItWorks: 'Permite enviar fotos, documentos e áudios via Wi-Fi local, cabo USB OTG ou enlaces de rádio.',
    hardwareNeeded: 'Nenhum hardware extra (opcional cabo USB tipo C OTG para modo RNDIS com velocidade de 480 Mbps).',
    offlineCapable: true,
    commonFailures: ['Arquivo muito grande para canais de rádio de baixa velocidade', 'Desconexão abrupta no meio do envio'],
    actionTabId: 'files',
  },
  {
    id: 'sound',
    name: 'Modem de Som & Ultrassom (Air-Audio GGWave)',
    category: 'radio',
    summary: 'Comunicação através de ondas sonoras aéreas pelos alto-falantes e microfones, incluindo modo ultrassônico inaudível (18-20 kHz).',
    howItWorks: 'Modula dados digitais em frequências de áudio (FSK/Bell 202/GGWave). Em modo ultrassom, humanos não escutam nada, mas aparelhos trocam mensagens.',
    hardwareNeeded: 'Alto-falante e microfone padrão do celular ou computador.',
    offlineCapable: true,
    commonFailures: ['Microfone desativado ou silenciado no sistema operacional', 'Capinha de celular atenuando frequências ultrassônicas acima de 18 kHz', 'Barulho ambiente excessivo'],
    actionTabId: 'sound',
  },
  {
    id: 'light',
    name: 'Modem de Luz (LiFi / VLC Óptico)',
    category: 'radio',
    summary: 'Transmissão de dados através de pulsos de luz visível ou flash LED da câmera do celular.',
    howItWorks: 'Liga e desliga a fonte de luz em padrões de código Morse / modulação OOK de alta velocidade que a câmera capta e decodifica.',
    hardwareNeeded: 'Câmera e tela ou lanterna LED.',
    offlineCapable: true,
    commonFailures: ['Distância excessiva entre lanterna e lente', 'Luz solar direta saturando o sensor óptico'],
    actionTabId: 'light',
  },
  {
    id: 'crypto',
    name: 'Ferramentas Criptográficas Pós-Quânticas',
    category: 'seguranca',
    summary: 'Criptografia de última geração com Kyber-1024, ChaCha20-Poly1305, curvas elípticas Ed25519 e cofres soberanos de chaves.',
    howItWorks: 'Gera pares de chaves criptográficas em memória local, assina mensagens digitalmente e cifra conteúdos que computadores quânticos não conseguem quebrar.',
    hardwareNeeded: 'Nenhum.',
    offlineCapable: true,
    commonFailures: ['Perda de frase semente ou chave privada se o cache do navegador for apagado'],
    actionTabId: 'crypto',
  },
  {
    id: 'stego',
    name: 'Esteganografia Tática (StegoTools)',
    category: 'seguranca',
    summary: 'Ocultação de mensagens secretas dentro de fotos aparentemente normais (PNG/JPEG) ou arquivos de áudio WAV.',
    howItWorks: 'Substitui os bits menos significativos (LSB) dos pixels ou amostras sonoras com os dados criptografados, tornando a mensagem indetectável a filtros.',
    hardwareNeeded: 'Nenhum.',
    offlineCapable: true,
    commonFailures: ['Compressão excessiva por mensageiros que redimensionam fotos eliminando os bits LSB'],
    actionTabId: 'stego',
  },
  {
    id: 'network',
    name: 'Topologia de Rede & Radar de Enlaces',
    category: 'rede',
    summary: 'Mapeamento das conexões locais, latência RTT, qualidade do sinal e análise de vizinhança.',
    howItWorks: 'Mede a integridade dos saltos entre aparelhos e traça rotas ideais no barramento.',
    hardwareNeeded: 'Nenhum.',
    offlineCapable: true,
    commonFailures: ['Nenhuma estação conectada na rede local'],
    actionTabId: 'network',
  },
  {
    id: 'mesh',
    name: 'Protocolo JJY Mesh Sovereign & Diagnóstico',
    category: 'rede',
    summary: 'Motor central da malha com reputação de nós, fila DTN para mensagens assíncronas e autodiagnóstico formal de subsistemas.',
    howItWorks: 'Implementa a especificação jjy-diagnostico e tolerância a atrasos (Store-and-Forward), permitindo que mensagens caminhem de aparelho em aparelho.',
    hardwareNeeded: 'Nenhum.',
    offlineCapable: true,
    commonFailures: ['Subsistema acústico ou WebRTC em estado degradado'],
    actionTabId: 'mesh',
  },
  {
    id: 'protocols',
    name: 'Barramento Omni de Protocolos (Protocol Hub)',
    category: 'rede',
    summary: 'Central de gerenciamento de todas as portadoras: LoRa, BLE Mesh, Áudio, Satélite, Cabo RNDIS e Rádio Tático.',
    howItWorks: 'Permite ligar, desligar e ajustar frequências e potências de transmissão com um clique ou aplicando pacotes pré-configurados.',
    hardwareNeeded: 'Depende do protocolo ativado.',
    offlineCapable: true,
    commonFailures: ['Tentar ativar WebSerial ou WebBluetooth em navegador não suportado (ex: Firefox/Safari)'],
    actionTabId: 'protocols',
  },
  {
    id: 'satellite',
    name: 'Internet Satélite & Telemetria Orbital SDR',
    category: 'radio',
    summary: 'Conexão e escuta de satélites de órbita baixa (LEO) como Iridium SBD, Starlink Mini e satélites meteorológicos NOAA via dongle RTL-SDR.',
    howItWorks: 'Comunica em 1621 MHz (Iridium) ou usa receptores de rádio definidos por software (SDR) na porta USB para captar telemetria espacial.',
    hardwareNeeded: 'Módulo Iridium 9603 / RockBLOCK ou Dongle USB RTL-SDR (R$ 150).',
    offlineCapable: true,
    commonFailures: ['Falta de visão desobstruída do céu aberto', 'Driver WinUSB/Zadig não instalado para o dongle SDR'],
    actionTabId: 'satellite',
  },
  {
    id: 'radio',
    name: 'Rádio Tático HF/VHF/UHF & APRS AX.25',
    category: 'radio',
    summary: 'Integração de rádios amadores convencionais (Baofeng UV-5R, rádios de viatura ou estações base HF) via cabo de áudio simples.',
    howItWorks: 'Transforma a placa de som do computador em modem digital de rádio (AFSK 1200 baud / Bell 202) na frequência 144.390 MHz ou bandas HF para saltos ionosféricos.',
    hardwareNeeded: 'Cabo P2/P3 entre o rádio portátil e o fone/microfone do PC, e um rádio comunicador.',
    offlineCapable: true,
    commonFailures: ['Volume do rádio muito alto causando distorção do áudio (clipping)', 'Frequência de rádio descalibrada'],
    actionTabId: 'radio',
  },
  {
    id: 'underwater',
    name: 'Internet Subaquática Acústica',
    category: 'radio',
    summary: 'Transmissão de dados através de líquidos e água utilizando frequências acústicas de 1 a 12 kHz.',
    howItWorks: 'Transdutores piezoelétricos ou hidrofones modulam ondas mecânicas na água, onde ondas de rádio convencionais morrem após poucos centímetros.',
    hardwareNeeded: 'Transdutor acústico subaquático ou cápsula piezo vedada ligada à saída de áudio amplificada.',
    offlineCapable: true,
    commonFailures: ['Reflexões acústicas em piscinas rasas causando eco excessivo'],
    actionTabId: 'underwater',
  },
  {
    id: 'lora',
    name: 'Rádio LoRa Meshtastic (Long-Range Mesh)',
    category: 'radio',
    summary: 'A espinha dorsal de longo alcance do projeto. Malha de rádio que atinge de 15 a 40 km por salto sem nenhuma torre de celular ou internet.',
    howItWorks: 'Opera em 915 MHz (Brasil/Américas) com modulação chirp spread spectrum (CSS). Comunica com placas USB via WebSerial no navegador.',
    hardwareNeeded: 'Placa LoRa como Heltec WiFi LoRa 32 V3 (chip SX1262), LilyGO T-Beam ou Ebyte E22 conectada via USB.',
    offlineCapable: true,
    commonFailures: ['Porta serial COM já em uso por outro programa', 'Permissão serial cancelada na janela do navegador', 'Antena desconectada queimando o chip de transmissão'],
    actionTabId: 'lora',
  },
  {
    id: 'cellular',
    name: 'Gateway Celular & Fallback de Emergência',
    category: 'rede',
    summary: 'Canal de redundância que aproveita redes 2G/3G/4G/5G e SMS tático PDU quando disponíveis, comutando automaticamente quando a conexão cai.',
    howItWorks: 'Detecta perda de conectividade e roteia pacotes prioritários através de modems celulares ou tethering móvel.',
    hardwareNeeded: 'Modem USB 4G ou smartphone roteando conexão.',
    offlineCapable: true,
    commonFailures: ['Torre de celular fora do ar ou sem saldo de dados'],
    actionTabId: 'cellular',
  },
  {
    id: 'wifi',
    name: 'Radar Wi-Fi RuView & Detecção Passiva',
    category: 'seguranca',
    summary: 'Usa sinais Wi-Fi para detectar presença humana, movimentação e respiração através de paredes via Channel State Information (CSI).',
    howItWorks: 'Analisa as microperturbações na propagação das ondas de rádio Wi-Fi refletidas em corpos biológicos.',
    hardwareNeeded: 'Placa Wi-Fi compatível com CSI (como placas Intel ou ESP32-S3 em modo monitor).',
    offlineCapable: true,
    commonFailures: ['Adaptador Wi-Fi padrão que não expõe métricas de sinal CSI de baixo nível'],
    actionTabId: 'wifi',
  },
  {
    id: 'disaster',
    name: 'Internet de Desastres & Triagem START SOS',
    category: 'sobrevivencia',
    summary: 'Modo extremo de resgate para desastres naturais (enchentes, deslizamentos, terremotos). Transmite beacons de socorro com sinais vitais e coordenadas.',
    howItWorks: 'Dispara rajadas SOS contínuas em todos os meios (LoRa, Som, Wi-Fi CSI e Rádio Tático) de forma simultânea.',
    hardwareNeeded: 'Qualquer dispositivo móvel ou PC.',
    offlineCapable: true,
    commonFailures: ['Bateria fraca no dispositivo de emergência'],
    actionTabId: 'disaster',
  },
  {
    id: 'remote',
    name: 'Monitoramento & Inspeção Remota Defensiva',
    category: 'seguranca',
    summary: 'Painel para coordenadores e equipes de resposta monitorarem estações conectadas, solicitarem telemetria autorizada e emitirem sirenes de alerta.',
    howItWorks: 'Transmite comandos de controle seguro pela rede local criptografada com permissão explícita.',
    hardwareNeeded: 'Nenhum.',
    offlineCapable: true,
    commonFailures: ['Estação remota com firewall bloqueando porta de gerenciamento'],
    actionTabId: 'remote',
  },
  {
    id: 'nsite',
    name: 'Nsite & Hospedagem Descentralizada Nostr (NIP-5A)',
    category: 'utilitarios',
    summary: 'Publicação e hospedagem permanente e incensurável de sites estáticos usando o protocolo Nostr (evento Kind 34128) e armazenamento descentralizado de blobs no Blossom.',
    howItWorks: 'Calcula o hash SHA-256 de cada arquivo compilado do site, envia os blobs para servidores Blossom distribuídos, constrói o manifesto NIP-5A assinado com chave privada Nostr (nsec) e propaga para relays.',
    hardwareNeeded: 'Nenhum hardware especial. Utiliza Web Crypto API, WebSocket para relays e HTTP para servidores Blossom.',
    offlineCapable: false,
    commonFailures: [
      'Relay Nostr inacessível ou rejeitando WebSocket',
      'Servidor Blossom sem resposta ou com erro de CORS',
      'Chave nsec incorreta ou ausente para assinar evento Kind 34128',
      'Rota SPA 404 por falta do fallback index.html',
    ],
    actionTabId: 'admin',
  },
];

// ============================================================================
// BASE DE FALHAS E GUIA DE TROUBLESHOOTING
// ============================================================================

export const COMMON_FAILURES_KNOWLEDGE: SystemFailureRecord[] = [
  // Falhas LoRa
  {
    id: 'fail_lora_serial_busy',
    subsystem: 'LoRa Meshtastic',
    symptom: 'Porta serial não abre, erro "Failed to open serial port" ou "Access Denied"',
    cause: 'Outro programa (como Arduino IDE, Cura, PuTTY ou outra aba do navegador) está com a porta serial USB bloqueada.',
    solution: 'Feche o Arduino IDE, monitores seriais ou outras abas abertas. Desconecte o cabo USB da placa LoRa e conecte novamente após 3 segundos.',
    suggestedAction: { type: 'lora_connect_serial', targetId: '115200', label: 'Tentar Reconectar LoRa USB' },
    keywords: ['lora', 'serial', 'porta', 'bloqueada', 'ocupada', 'access denied', 'com', 'usb'],
  },
  {
    id: 'fail_lora_freq_mismatch',
    subsystem: 'LoRa Meshtastic',
    symptom: 'Placa LoRa envia pacotes mas o colega não recebe nenhuma mensagem',
    cause: 'Incompatibilidade de frequência regional (ex: uma placa configurada em 868 MHz Europa e outra em 915 MHz Brasil) ou presets diferentes (um em LongFast e outro em MediumFast).',
    solution: 'Ambas as placas DEVEM estar exatamente na mesma frequência (915.000 MHz no Brasil) e no mesmo preset de canal (recomendado LongFast).',
    suggestedAction: { type: 'set_lora_preset', targetId: 'BR_915', label: 'Aplicar Preset Padrão BR-915 LongFast' },
    keywords: ['lora', 'nao recebe', 'não recebe', 'alcance', 'frequencia', '868', '915', 'preset'],
  },

  // Falhas Bluetooth
  {
    id: 'fail_bluetooth_unsupported',
    subsystem: 'Bluetooth BLE Mesh',
    symptom: 'Erro "navigator.bluetooth is undefined" ou botão de Bluetooth não faz nada',
    cause: 'O navegador atual não suporta Web Bluetooth (ex: Firefox ou Safari) ou o Bluetooth está desativado nas configurações do sistema operacional.',
    solution: '1. Use o Google Chrome, Microsoft Edge, Brave ou Opera.\n2. Verifique se o Bluetooth do computador ou celular está ligado.\n3. Em conexões celulares diretas, utilize o "Ponto de Acesso Bluetooth" nativo e abra o Chat LAN.',
    suggestedAction: { type: 'bluetooth_connect', targetId: 'start_scan', label: 'Tentar Busca Bluetooth Novamente' },
    keywords: ['bluetooth', 'blotuf', 'ble', 'undefined', 'nao suporta', 'não abre', 'safari', 'firefox'],
  },
  {
    id: 'fail_bluetooth_pairing_cancelled',
    subsystem: 'Bluetooth BLE Mesh',
    symptom: 'Aparelho do amigo não aparece na janela de busca Bluetooth',
    cause: 'O aparelho remoto não está em modo de anúncio BLE (advertising) ou está fora do raio de alcance de 30 a 80 metros.',
    solution: 'Peça para o amigo abrir a página do JJY e clicar em "Ativar Bluetooth" no popup ao mesmo tempo. Aproxime os aparelhos para o pareamento inicial.',
    suggestedAction: { type: 'activate_protocol', targetId: 'ble_mesh_direct', label: 'Ativar Beacon BLE Mesh' },
    keywords: ['bluetooth', 'sumiu', 'nao acha', 'não encontra', 'dispositivo', 'parear'],
  },

  // Falhas de Áudio / Som
  {
    id: 'fail_audio_mic_permission',
    subsystem: 'Modem Acústico de Som',
    symptom: 'Modem de Som não escuta nada, espectrograma estático ou tela de áudio muda',
    cause: 'O navegador bloqueou a permissão de acesso ao microfone.',
    solution: 'Clique no ícone de cadeado na barra de endereços do navegador (ao lado da URL), autorize a permissão de "Microfone" e recarregue a página.',
    suggestedAction: { type: 'navigate_tab', targetId: 'sound', label: 'Abrir Painel Modem de Som' },
    keywords: ['som', 'audio', 'áudio', 'microfone', 'mudo', 'espectrograma', 'permissao'],
  },
  {
    id: 'fail_audio_ultrasonic_attenuation',
    subsystem: 'Modem Acústico de Som',
    symptom: 'Mensagens em modo ultrassom (18-20 kHz) falham ou chegam corrompidas',
    cause: 'A capinha do celular ou o filtro anti-ruído do sistema operacional está cortando frequências acima de 16 kHz.',
    solution: '1. Retire capas espessas do celular que tapem o orifício do microfone.\n2. Se o ambiente for barulhento, mude para o modo audível FSK (Bell 202) que possui maior robustez a ruídos mecânicos.',
    suggestedAction: { type: 'activate_protocol', targetId: 'audio_ultrasonic_air', label: 'Reajustar Modem de Som' },
    keywords: ['ultrassom', '18khz', 'corrompido', 'inaudivel', 'falha som'],
  },

  // Falhas Chat LAN / Wi-Fi
  {
    id: 'fail_chat_ap_isolation',
    subsystem: 'Chat LAN / WebRTC',
    symptom: 'Dois computadores no mesmo Wi-Fi não conseguem se enxergar no Chat LAN',
    cause: 'O roteador Wi-Fi está com o recurso de segurança "AP Isolation" (Isolamento de Clientes) ativado, impedindo que aparelhos na mesma rede conversem entre si.',
    solution: '1. Se puder acessar o roteador, desative a opção "AP Isolation / Client Isolation".\n2. Alternativa sem roteador: ative o "Roteador Wi-Fi / Ponto de Acesso" no celular de um dos participantes e conecte o outro aparelho nele.',
    suggestedAction: { type: 'navigate_tab', targetId: 'chat', label: 'Abrir Chat LAN' },
    keywords: ['chat', 'lan', 'amigos', 'nao vejo', 'não aparece', 'mesmo wifi', 'ap isolation', 'isolamento'],
  },

  // Falhas QR Studio
  {
    id: 'fail_qr_camera_focus',
    subsystem: 'QR Studio',
    symptom: 'Câmera não lê a sequência animada de QR Codes',
    cause: 'Brilho da tela emissora muito fraco, reflexo de lâmpada no vidro ou distância inadequada.',
    solution: '1. Aumente o brilho da tela do emissor para 100%.\n2. Mantenha os aparelhos a cerca de 25 a 40 cm de distância com ângulo reto.\n3. No painel do QR Studio, reduza a taxa para 15 FPS se o aparelho receptor for mais lento.',
    suggestedAction: { type: 'navigate_tab', targetId: 'qr', label: 'Abrir QR Studio' },
    keywords: ['qr', 'camera', 'câmera', 'nao le', 'não lê', 'foco', 'brilho', 'fps'],
  },

  // Falhas Globo 3D
  {
    id: 'fail_globe_webgl',
    subsystem: 'Globo 3D',
    symptom: 'Globo 3D fica preto ou dá erro "WebGL context could not be created"',
    cause: 'Aceleração de hardware desativada no navegador ou driver de vídeo do sistema travado.',
    solution: 'No Chrome/Edge: acesse Configurações ➔ Sistema ➔ Marque "Usar aceleração gráfica quando disponível" e reinicie o navegador.',
    suggestedAction: { type: 'navigate_tab', targetId: 'globe', label: 'Abrir Globo 3D' },
    keywords: ['globo', '3d', 'preto', 'webgl', 'trava', 'aceleração'],
  },

  // Falhas Satélite / SDR
  {
    id: 'fail_satellite_sdr_driver',
    subsystem: 'Internet Satélite & SDR',
    symptom: 'Dongle RTL-SDR USB conectado não é reconhecido pelo WebUSB',
    cause: 'No Windows, o driver padrão do Windows instala o dongle como receptor de TV DVB-T em vez de WinUSB genérico.',
    solution: 'Baixe o utilitário Zadig (zadig.akeo.ie), selecione o dispositivo RTL2838 e instale o driver "WinUSB". Após isso, o navegador terá acesso direto.',
    suggestedAction: { type: 'navigate_tab', targetId: 'satellite', label: 'Abrir Painel Satélite' },
    keywords: ['satelite', 'satélite', 'sdr', 'rtl', 'rtl-sdr', 'zadig', 'webusb', 'winusb'],
  },

  // Falhas Nsite / Nostr / Blossom
  {
    id: 'fail_nsite_blossom_timeout',
    subsystem: 'Nsite & Blossom (NIP-5A)',
    symptom: 'Upload de blobs estáticos para o Blossom falha ou dá erro de timeout',
    cause: 'Servidor Blossom específico indisponível ou bloqueio de CORS / firewall de rede.',
    solution: 'Adicione servidores Blossom alternativos de alta disponibilidade (como https://blossom.primal.net ou https://cdn.satellite.earth) no Gerenciador de Nsite na Área Administrativa e execute o teste de conectividade.',
    suggestedAction: { type: 'navigate_tab', targetId: 'admin', label: 'Abrir Configurações Nsite' },
    keywords: ['nsite', 'blossom', 'timeout', 'upload', 'blob', 'deploy'],
  },
  {
    id: 'fail_nsite_relay_rejected',
    subsystem: 'Nsite Nostr (Kind 34128)',
    symptom: 'Manifesto do site não é publicado nos relays Nostr ou acusa erro de assinatura',
    cause: 'Chave privada nsec ausente, inválida ou relay exigindo autenticação NIP-42.',
    solution: 'Gere um novo par de chaves ou importe sua nsec no Cofre de Chaves do Nsite, ou conecte uma extensão de navegador NIP-07 (ex: Alby, nos2x) para assinar sem expor sua chave privada.',
    suggestedAction: { type: 'navigate_tab', targetId: 'admin', label: 'Gerenciar Chaves no Nsite' },
    keywords: ['nsite', 'relay', 'kind 34128', 'manifesto', 'assinatura', 'nsec', 'npub'],
  },
];

// ============================================================================
// ARMAZENAMENTO E APRENDIZADO CONTÍNUO (MEMÓRIA EXPANDIDA DO CHAT)
// ============================================================================

const LEARNED_KNOWLEDGE_KEY = 'jjy_chat_learned_knowledge_v2';

export function loadAllLearnedKnowledge(): LearnedKnowledgeItem[] {
  try {
    const raw = localStorage.getItem(LEARNED_KNOWLEDGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}

  // Conhecimentos iniciais padrão da semente de aprendizado
  return [
    {
      id: 'kn_default_1',
      title: 'Frequência Oficial LoRa Brasil',
      content: 'A frequência regulatória oficial para o protocolo LoRa no Brasil é 915.000 MHz (Banda ISM regulamentada pela Anatel), usando preferencialmente o Slot 20 e preset LongFast.',
      category: 'hardware_note',
      triggerKeywords: ['lora', 'brasil', '915', 'anatel', 'frequencia'],
      source: 'default_system',
      createdAt: Date.now() - 300000,
      updatedAt: Date.now() - 300000,
      usageCount: 1,
    },
    {
      id: 'kn_default_2',
      title: 'Comunicação Offline Local sem Internet',
      content: 'O sistema opera 100% desconectado da internet. Para vizinhos e amigos, utilize o Chat LAN no mesmo Wi-Fi, BLE Mesh 5.3 a curta distância (80m) ou Rádio LoRa para alcances de 15 a 40 km.',
      category: 'system_feature',
      triggerKeywords: ['sem internet', 'offline', 'vizinho', 'amigo', 'localmente'],
      source: 'default_system',
      createdAt: Date.now() - 250000,
      updatedAt: Date.now() - 250000,
      usageCount: 1,
    },
    {
      id: 'kn_default_3',
      title: 'Resolução para Falha de AP Isolation',
      content: 'Quando o Chat LAN não encontra amigos no mesmo Wi-Fi comercial, ative o Ponto de Acesso (roteador) do próprio smartphone para criar uma rede local pura e sem bloqueios de isolamento.',
      category: 'failure_fix',
      triggerKeywords: ['ap isolation', 'isolamento', 'chat lan nao acha', 'wifi comercial'],
      source: 'default_system',
      createdAt: Date.now() - 200000,
      updatedAt: Date.now() - 200000,
      usageCount: 1,
    },
    {
      id: 'kn_default_4',
      title: 'Privacidade de Localização no Globo 3D',
      content: 'Por segurança e privacidade, a localização padrão é aproximada com fuzzing de 10 km. Para resgates em desastres ou localização exata por amigos de confiança, altere a precisão para Alta Precisão no painel do Globo 3D.',
      category: 'user_preference',
      triggerKeywords: ['globo', 'localizacao', 'precisao', '10km', 'fuzzing', 'privacidade'],
      source: 'default_system',
      createdAt: Date.now() - 150000,
      updatedAt: Date.now() - 150000,
      usageCount: 1,
    },
    {
      id: 'kn_default_5',
      title: 'Hospedagem Descentralizada Nsite com Nostr e Blossom',
      content: 'O projeto JJY suporta publicação descentralizada via Nsite (NIP-5A). O comando padrão é "npm run deploy:nsite", que compila com Vite e publica a pasta ./dist com fallback=/index.html nos servidores Blossom e relays Nostr.',
      category: 'system_feature',
      triggerKeywords: ['nsite', 'nsyte', 'blossom', 'nip-5a', 'kind 34128', 'hospedagem', 'deploy descentralizado', 'nostr site'],
      source: 'default_system',
      createdAt: Date.now() - 100000,
      updatedAt: Date.now() - 100000,
      usageCount: 1,
    },
  ];
}

export function saveAllLearnedKnowledge(items: LearnedKnowledgeItem[]): void {
  try {
    localStorage.setItem(LEARNED_KNOWLEDGE_KEY, JSON.stringify(items));
  } catch {}
}

export function learnNewKnowledge(
  title: string,
  content: string,
  category: KnowledgeCategory = 'faq',
  keywords: string[] = []
): LearnedKnowledgeItem {
  const current = loadAllLearnedKnowledge();
  const autoKeywords = Array.from(
    new Set([
      ...keywords.map((k) => k.toLowerCase().trim()),
      ...title.toLowerCase().split(/\s+/).filter((w) => w.length > 2),
    ])
  );

  const newItem: LearnedKnowledgeItem = {
    id: 'kn_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    title: title.trim(),
    content: content.trim(),
    category,
    triggerKeywords: autoKeywords,
    source: 'user_taught',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    usageCount: 0,
  };

  current.unshift(newItem);
  saveAllLearnedKnowledge(current);
  return newItem;
}

export function removeLearnedKnowledge(id: string): void {
  const filtered = loadAllLearnedKnowledge().filter((item) => item.id !== id);
  saveAllLearnedKnowledge(filtered);
}

export function searchKnowledgeBase(query: string): LearnedKnowledgeItem[] {
  const items = loadAllLearnedKnowledge();
  const q = query.toLowerCase().trim();
  if (!q) return items;

  const terms = q.split(/\s+/).filter((t) => t.length > 1);

  return items.filter((item) => {
    const textTarget = `${item.title} ${item.content} ${item.triggerKeywords.join(' ')}`.toLowerCase();
    return terms.some((term) => textTarget.includes(term));
  });
}

// ============================================================================
// AUTO-DIAGNÓSTICO AO VIVO DE SUBSISTEMAS & HARDWARE
// ============================================================================

export function runLiveSystemDiagnostics(): LiveDiagnosticResult {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const isOnline = nav ? nav.onLine : true;

  // Verificação de Suporte a Web Bluetooth
  const hasBluetooth = Boolean(nav && 'bluetooth' in nav);
  const bluetoothDetails = hasBluetooth
    ? 'API Web Bluetooth 5.3 disponível no navegador.'
    : 'Não suportado neste navegador (necessário Chrome/Edge/Opera).';

  // Verificação de Suporte a Web Serial (USB LoRa)
  const hasSerial = Boolean(nav && 'serial' in nav);
  const serialDetails = hasSerial
    ? 'API WebSerial disponível para modems USB e placas LoRa SX1262.'
    : 'WebSerial não suportado (necessário navegador baseado em Chromium no Desktop).';

  // Verificação de Suporte a Web USB
  const hasUsb = Boolean(nav && 'usb' in nav);
  const usbDetails = hasUsb
    ? 'API WebUSB disponível para dongles SDR e adaptadores.'
    : 'WebUSB indisponível no navegador atual.';

  // Verificação de Áudio (Microfone & AudioContext)
  const hasAudioContext = typeof window !== 'undefined' && Boolean(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
  const hasAudioApi = Boolean(nav && nav.mediaDevices && nav.mediaDevices.getUserMedia);
  const audioSupported = hasAudioContext && hasAudioApi;
  const audioDetails = audioSupported
    ? 'AudioContext e captura de microfone prontos para modems acústicos e ultrassom.'
    : 'Captura de áudio indisponível ou permissões não concedidas.';

  // Verificação de Câmera (QR Studio & Light Modem)
  const hasCamera = Boolean(nav && nav.mediaDevices);
  const cameraDetails = hasCamera
    ? 'Interface de mídia pronta para câmera e fluxo óptico QR Studio.'
    : 'Dispositivo sem acesso a câmeras detectadas.';

  // Verificação de WebRTC
  const hasWebRtc = typeof window !== 'undefined' && typeof RTCPeerConnection !== 'undefined';
  const webrtcDetails = hasWebRtc
    ? 'Stack WebRTC peer-to-peer operacional para malhas LAN descentralizadas.'
    : 'WebRTC desabilitado ou não suportado.';

  // Verificação de WebGL (Globo 3D)
  let hasWebGL = false;
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      hasWebGL = Boolean(
        canvas.getContext('webgl') || canvas.getContext('experimental-webgl') || canvas.getContext('webgl2')
      );
    } catch {}
  }
  const webglDetails = hasWebGL
    ? 'Aceleração gráfica WebGL operacional para renderização do Globo 3D.'
    : 'WebGL indisponível (renderização 3D será degradada).';

  // Verificação de Geolocalização
  const hasGeo = Boolean(nav && 'geolocation' in nav);
  const geoDetails = hasGeo
    ? 'API de coordenadas GPS disponível no navegador.'
    : 'GPS indisponível.';

  // Coleta de falhas ativas
  const activeIssues: string[] = [];
  if (!hasBluetooth) activeIssues.push('Bluetooth nativo não suportado neste navegador (use Chrome/Edge).');
  if (!hasSerial) activeIssues.push('Comunicação USB LoRa direta requer navegador Chrome ou Edge.');
  if (!hasWebGL) activeIssues.push('Aceleração de hardware WebGL indisponível para o Globo 3D.');
  if (runtimeErrorBuffer.length > 0) {
    activeIssues.push(`${runtimeErrorBuffer.length} advertências registradas no buffer recente de erros.`);
  }

  // Avaliação de Saúde Geral
  let overallHealth: LiveDiagnosticResult['overallHealth'] = 'healthy';
  if (activeIssues.length >= 2 || !hasAudioContext) {
    overallHealth = 'degraded';
  }
  if (!hasWebRtc && !hasAudioContext) {
    overallHealth = 'critical';
  }

  // Gera ações recomendadas
  const recommendedActions: UserActionSuggestion[] = [];
  if (hasSerial) {
    recommendedActions.push({
      id: 'diag_lora',
      type: 'lora_connect_serial',
      label: 'Conectar Rádio LoRa USB (915 MHz)',
      description: 'Ativar porta serial do rádio LoRa',
      targetId: '115200',
    });
  }
  if (hasBluetooth) {
    recommendedActions.push({
      id: 'diag_ble',
      type: 'bluetooth_connect',
      label: 'Iniciar Busca Bluetooth BLE Mesh',
      description: 'Procurar dispositivos Bluetooth próximos',
      targetId: 'start_scan',
    });
  }
  recommendedActions.push({
    id: 'diag_test_enlace',
    type: 'test_transmission',
    label: 'Testar Enlace de Comunicação',
    description: 'Disparar pacote de teste',
    targetId: 'websocket_local_relay',
  });

  // Relatório consolidado em Markdown
  const healthBadge =
    overallHealth === 'healthy'
      ? '🟢 **SISTEMA OPERACIONAL & SAUDÁVEL**'
      : overallHealth === 'degraded'
      ? '🟡 **SISTEMA OPERACIONAL COM DEGRADAÇÃO PARCIAL**'
      : '🔴 **FALHA CRÍTICA DETECTADA**';

  const markdownReport = `### 🩺 Relatório de Auto-Diagnóstico do Nó Jjy
${healthBadge}
*Executado em: ${new Date().toLocaleTimeString('pt-BR')}*

| Subsistema / Recurso | Status | Diagnóstico |
| :--- | :---: | :--- |
| **Rádio LoRa (WebSerial)** | ${hasSerial ? '✅ Ativo' : '⚠️ Indisponível'} | ${serialDetails} |
| **Bluetooth BLE Mesh** | ${hasBluetooth ? '✅ Ativo' : '⚠️ Indisponível'} | ${bluetoothDetails} |
| **Modem Acústico & Som** | ${audioSupported ? '✅ Ativo' : '❌ Falha'} | ${audioDetails} |
| **Câmera & Fluxo QR** | ${hasCamera ? '✅ Ativo' : '⚠️ Ausente'} | ${cameraDetails} |
| **Enlace WebRTC LAN** | ${hasWebRtc ? '✅ Ativo' : '❌ Falha'} | ${webrtcDetails} |
| **Globo 3D (WebGL)** | ${hasWebGL ? '✅ Ativo' : '⚠️ Sem GPU'} | ${webglDetails} |
| **Conexão Externa** | ${isOnline ? '🌐 Com Internet' : '🔒 100% Offline (Soberano)'} | Modo de rede atual do dispositivo. |

${
  activeIssues.length > 0
    ? `#### ⚠️ Pontos de Atenção Identificados:\n${activeIssues.map((i) => `• ${i}`).join('\n')}\n`
    : '✨ *Todos os subsistemas essenciais para malha soberana e rádio estão disponíveis!*'
}

${
  runtimeErrorBuffer.length > 0
    ? `#### 📋 Últimos Erros Registrados pelo Sistema:\n${runtimeErrorBuffer
        .slice(0, 3)
        .map((e) => `• [${new Date(e.timestamp).toLocaleTimeString('pt-BR')}] ${e.message} (${e.source || 'sistema'})`)
        .join('\n')}`
    : ''
}`;

  return {
    timestamp: Date.now(),
    overallHealth,
    apis: {
      bluetooth: { supported: hasBluetooth, details: bluetoothDetails },
      serial: { supported: hasSerial, details: serialDetails },
      usb: { supported: hasUsb, details: usbDetails },
      audio: { supported: audioSupported, details: audioDetails },
      camera: { supported: hasCamera, details: cameraDetails },
      webrtc: { supported: hasWebRtc, details: webrtcDetails },
      webgl: { supported: hasWebGL, details: webglDetails },
      geolocation: { supported: hasGeo, details: geoDetails },
      online: { supported: isOnline, details: isOnline ? 'Online' : 'Offline' },
    },
    activeIssues,
    recentErrors: [...runtimeErrorBuffer],
    recommendedActions,
    markdownReport,
  };
}

// ============================================================================
// BUSCA E INTELIGÊNCIA DE RESPOSTA SOBRE O SISTEMA E FALHAS
// ============================================================================

export function findSystemFailureSolution(userQuery: string): SystemFailureRecord | null {
  const q = userQuery.toLowerCase().trim();
  for (const failure of COMMON_FAILURES_KNOWLEDGE) {
    if (failure.keywords.some((kw) => q.includes(kw))) {
      return failure;
    }
  }
  return null;
}

export function findSystemModuleInfo(userQuery: string): SystemModuleInfo | null {
  const q = userQuery.toLowerCase().trim();
  for (const mod of SYSTEM_MODULES_CATALOG) {
    if (
      q.includes(mod.id) ||
      q.includes(mod.name.toLowerCase()) ||
      mod.name.toLowerCase().split(/\s+/).some((w) => w.length > 3 && q.includes(w))
    ) {
      return mod;
    }
  }
  return null;
}
