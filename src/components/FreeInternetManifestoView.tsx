import React, { useState } from 'react';
import {
  Globe,
  Radio,
  Wifi,
  ShieldCheck,
  Zap,
  Users,
  Compass,
  Layers,
  Unlock,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Share2,
  Activity,
  Heart,
  Satellite,
  Waves,
  Lightbulb,
  Smartphone,
  Plus,
  RefreshCw,
} from 'lucide-react';

interface MeshSimulatorNode {
  id: string;
  name: string;
  type: 'wifi' | 'lora' | 'hf' | 'satellite' | 'acoustic';
  rangeKm: number;
  throughput: string;
  hardware: string;
}

export const FreeInternetManifestoView: React.FC<{ onNavigateToGlobe?: () => void; onNavigateToProtocols?: () => void }> = ({
  onNavigateToGlobe,
  onNavigateToProtocols,
}) => {
  // Simulador de Cobertura da Rede Livre
  const [nodes, setNodes] = useState<MeshSimulatorNode[]>([
    {
      id: 'node_1',
      name: 'Estação Central (Seu Nó Jyy)',
      type: 'wifi',
      rangeKm: 0.3,
      throughput: '54 ~ 300 Mbps',
      hardware: 'Computador / Celular Atual',
    },
    {
      id: 'node_2',
      name: 'Repetidor LoRa da Vizinhança',
      type: 'lora',
      rangeKm: 18.0,
      throughput: '19.2 kbps',
      hardware: 'ESP32 + Semtech SX1262 (R$ 80)',
    },
    {
      id: 'node_3',
      name: 'Enlace Regional Longa Distância',
      type: 'hf',
      rangeKm: 450.0,
      throughput: '1.2 kbps',
      hardware: 'Rádio Amador VHF/HF Baofeng / Xiegu',
    },
  ]);

  const [activeTab, setActiveTab] = useState<'manifesto' | 'pillars' | 'simulator' | 'guide'>('manifesto');
  const [copiedLink, setCopiedLink] = useState(false);

  // Métricas calculadas da simulação
  const totalCoverageKm = nodes.reduce((acc, n) => acc + n.rangeKm, 0);
  const totalNodesCount = nodes.length;
  const estimatedRedundancy = Math.min(99.9, 85 + nodes.length * 4.5);

  const handleAddNode = (type: 'wifi' | 'lora' | 'hf' | 'satellite' | 'acoustic') => {
    const templates: Record<string, Omit<MeshSimulatorNode, 'id'>> = {
      wifi: {
        name: `Nó Wi-Fi Mesh #${nodes.length + 1}`,
        type: 'wifi',
        rangeKm: 0.5,
        throughput: '100 Mbps',
        hardware: 'Roteador Wi-Fi ou Celular',
      },
      lora: {
        name: `Gateway LoRa Meshtastic #${nodes.length + 1}`,
        type: 'lora',
        rangeKm: 25.0,
        throughput: '19.2 kbps',
        hardware: 'Módulo Heltec V3 / LilyGO',
      },
      hf: {
        name: `Estação Rádio Tático #${nodes.length + 1}`,
        type: 'hf',
        rangeKm: 600.0,
        throughput: '2.4 kbps',
        hardware: 'Transceptor Rádio + Cabo de Áudio',
      },
      satellite: {
        name: `Terminal Satélite LEO #${nodes.length + 1}`,
        type: 'satellite',
        rangeKm: 2500.0,
        throughput: '150 Mbps',
        hardware: 'Antena Starlink Mini ou Iridium SBD',
      },
      acoustic: {
        name: `Boia Acústica Aquática #${nodes.length + 1}`,
        type: 'acoustic',
        rangeKm: 2.5,
        throughput: '1.2 kbps',
        hardware: 'Transdutor Piezoelétrico Subaquático',
      },
    };

    const newN: MeshSimulatorNode = {
      id: 'node_' + Math.random().toString(36).substring(2, 7),
      ...templates[type],
    };

    setNodes([...nodes, newN]);
  };

  const handleRemoveNode = (id: string) => {
    if (nodes.length <= 1) return;
    setNodes(nodes.filter((n) => n.id !== id));
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } else {
      alert('Link da Rede Livre: ' + window.location.href);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* ==================================================================== */}
      {/* HERO SECTION: MANIFESTO DA INTERNET LIVRE & SOBERANA                 */}
      {/* ==================================================================== */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950/70 to-slate-950 border border-indigo-500/30 p-6 md:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-emerald-500/15 via-cyan-500/10 to-transparent rounded-full blur-3xl pointer-events-none -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none -ml-24 -mb-24" />

        <div className="relative z-10 max-w-4xl space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm">
              <Unlock className="w-3.5 h-3.5 text-emerald-400" />
              REDE 100% DESCENTRALIZADA & SOBERANA
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              ● ZERO PROVEDORES OBRIGATÓRIOS
            </span>
            <span className="text-xs font-mono text-slate-400 border border-slate-800 bg-slate-900/80 px-2.5 py-1 rounded-full">
              IMUNE A CENSURA & BLACKOUTS
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
            Nossa Internet Livre: <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-300 to-indigo-400">
              A Comunicação que Ninguém Pode Derrubar.
            </span>
          </h1>

          <p className="text-sm md:text-base text-slate-300 leading-relaxed max-w-3xl">
            A internet convencional foi construída sobre cabos corporativos, torres centralizadas e provedores que podem ser desligados,
            bloqueados ou censurados a qualquer momento. A <strong>Internet Livre Jyy</strong> devolve a rede para as pessoas:
            ela conecta você diretamente a outros seres humanos por ondas de rádio, Wi-Fi mesh, som, luz e satélites,
            sem depender de mensalidade, servidores centrais ou sinal de celular.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {onNavigateToGlobe && (
              <button
                onClick={onNavigateToGlobe}
                className="px-6 py-3 bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 hover:from-emerald-500 hover:to-cyan-400 text-white font-bold rounded-2xl shadow-xl shadow-emerald-900/30 transition-all flex items-center gap-2 text-sm"
              >
                <Globe className="w-4 h-4 text-emerald-100" />
                <span>Explorar Globo 3D & Pessoas</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {onNavigateToProtocols && (
              <button
                onClick={onNavigateToProtocols}
                className="px-5 py-3 bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-2xl font-semibold text-sm transition-all flex items-center gap-2"
              >
                <Radio className="w-4 h-4 text-cyan-400" />
                <span>Ver Todos os Protocolos Físicos</span>
              </button>
            )}

            <button
              onClick={handleShare}
              className="px-4 py-3 bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-2xl font-semibold text-sm transition-all flex items-center gap-2"
            >
              <Share2 className="w-4 h-4 text-indigo-400" />
              <span>{copiedLink ? '✓ Link Copiado!' : 'Convidar Amigos'}</span>
            </button>
          </div>
        </div>

        {/* 4 Indicadores Rápidos de Liberdade Digital */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8 pt-6 border-t border-slate-800/80">
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Custo de Operação</div>
            <div className="text-xl font-black text-emerald-400 mt-0.5">R$ 0,00</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Livre de mensalidades e taxas</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Ponto Único de Falha</div>
            <div className="text-xl font-black text-cyan-400 mt-0.5">ZERO (0)</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Malha mesh auto-regenerativa</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Privacidade Física</div>
            <div className="text-xl font-black text-amber-400 mt-0.5">± 10 km</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Fuzzing de proteção domiciliar</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Criptografia</div>
            <div className="text-xl font-black text-indigo-400 mt-0.5">Pós-Quântica</div>
            <div className="text-[11px] text-slate-400 mt-0.5">ML-KEM Kyber + XChaCha20</div>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* ABAS NAVEGÁVEIS: MANIFESTO, PILARES, SIMULADOR, GUIA                 */}
      {/* ==================================================================== */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto scrollbar-none pb-1">
        {[
          { id: 'manifesto', label: 'Manifesto & Filosofia', icon: <Heart className="w-4 h-4 text-rose-400" /> },
          { id: 'pillars', label: 'Os 6 Pilares Técnicos', icon: <Layers className="w-4 h-4 text-cyan-400" /> },
          { id: 'simulator', label: 'Simulador de Rede Livre', icon: <Activity className="w-4 h-4 text-emerald-400" /> },
          { id: 'guide', label: 'Como Começar em 4 Passos', icon: <Compass className="w-4 h-4 text-amber-400" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-500'
                : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ==================================================================== */}
      {/* ABA 1: MANIFESTO & FILOSOFIA DA REDE                                 */}
      {/* ==================================================================== */}
      {activeTab === 'manifesto' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-5 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl">
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-amber-400" />
              O Manifesto da Comunicação Autônoma
            </h2>

            <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
              <p>
                A comunicação é um direito humano inalienável. No mundo moderno, falar com outra pessoa a quilômetros de distância
                passou a depender de gigantes da tecnologia, cabos de fibra ótica pertencentes a conglomerados e torres de celular
                que podem ser silenciadas por decisões burocráticas, desastres climáticos ou conflitos geopolíticos.
              </p>

              <blockquote className="border-l-4 border-emerald-500 pl-4 py-1.5 my-3 text-slate-200 italic font-medium bg-emerald-500/5 rounded-r-xl">
                "Se para falar com o seu vizinho você precisa pedir autorização a um servidor do outro lado do oceano, você não tem uma rede de comunicação: você tem uma permissão de uso revogável."
              </blockquote>

              <p>
                A <strong>Internet Livre</strong> nasce do princípio de que qualquer dispositivo eletrônico capaz de emitir ondas
                ou pulsos de luz — seja seu smartphone, notebook, um roteador doméstico ou um microcontrolador de 15 dólares —
                pode e deve atuar como uma estação transmissora soberana.
              </p>

              <p>
                Ao conectar pessoas de nó em nó (Peer-to-Peer), as mensagens saltam de um aparelho para o outro através do espaço físico.
                Não há servidor central para ser apreendido. Não há cabo mestre para ser cortado. Quanto mais pessoas usam, mais forte,
                rápida e abrangente a rede se torna.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-800 flex flex-wrap gap-3">
              <span className="px-3 py-1 rounded-full text-xs font-mono bg-slate-950 text-cyan-300 border border-slate-800">
                ✓ 100% Offline-First
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-mono bg-slate-950 text-emerald-300 border border-slate-800">
                ✓ Imune a Jammers & Bloqueios
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-mono bg-slate-950 text-purple-300 border border-slate-800">
                ✓ P2P sem Intermediários
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-mono bg-slate-950 text-amber-300 border border-slate-800">
                ✓ Software & Hardware Acessíveis
              </span>
            </div>
          </div>

          {/* Card Lateral: Comparação Direta */}
          <div className="space-y-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <h3 className="font-bold text-sm text-white uppercase tracking-wider font-mono text-cyan-400">
                Comparativo Estratégico
              </h3>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-900/40 space-y-1">
                  <span className="font-bold text-rose-300 block">Internet Comercial Tradicional:</span>
                  <ul className="text-slate-400 space-y-1 list-disc list-inside">
                    <li>Ponto centralizado sujeito a censura</li>
                    <li>Cai quando a eletricidade da torre falha</li>
                    <li>Rastreia sua localização física exata</li>
                    <li>Cobrança mensal e dependência de operadoras</li>
                  </ul>
                </div>

                <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-900/40 space-y-1">
                  <span className="font-bold text-emerald-300 block">Nossa Internet Livre Jyy:</span>
                  <ul className="text-slate-300 space-y-1 list-disc list-inside">
                    <li>Malha mesh auto-regenerativa sem servidor</li>
                    <li>Continua funcionando em blackouts por bateria</li>
                    <li>Ofuscação de 10 km para sua segurança física</li>
                    <li>100% gratuita, livre e perpétua</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-900/50 to-slate-900 border border-indigo-500/30 rounded-2xl p-5 text-center space-y-3">
              <h4 className="font-bold text-sm text-white">Pronto para se conectar?</h4>
              <p className="text-xs text-slate-300">
                Veja os operadores online agora mesmo no Globo 3D da Terra.
              </p>
              {onNavigateToGlobe && (
                <button
                  onClick={onNavigateToGlobe}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/30 flex items-center justify-center gap-1.5"
                >
                  <Globe className="w-4 h-4" />
                  <span>Abrir Globo 3D Agora</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ABA 2: OS 6 PILARES TÉCNICOS DA INTERNET LIVRE                       */}
      {/* ==================================================================== */}
      {activeTab === 'pillars' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            {
              icon: <Users className="w-6 h-6 text-cyan-400" />,
              title: '1. Descentralização Radical P2P',
              tagline: 'Zero Servidores Centrais',
              description: 'Cada aparelho conectado é um roteador completo. As mensagens navegam em saltos múltiplos (multi-hop) até alcançar o destinatário, eliminando qualquer ponto central vulnerável.',
              badge: 'Arquitetura Mesh',
            },
            {
              icon: <Radio className="w-6 h-6 text-emerald-400" />,
              title: '2. Multi-Transporte Físico Híbrido',
              tagline: 'Rádio, Som, Luz e Satélite',
              description: 'Se o Wi-Fi for bloqueado, o sistema salta automaticamente para rádio LoRa, som ultrassônico inaudível, laser óptico, satélites de baixa órbita ou cabos USB diretos.',
              badge: 'Multi-Camada',
            },
            {
              icon: <ShieldCheck className="w-6 h-6 text-purple-400" />,
              title: '3. Criptografia Inviolável de Ponta a Ponta',
              tagline: 'Pronta para a Era Pós-Quântica',
              description: 'Suas mensagens são lacradas no seu dispositivo com algoritmos modernos (ML-KEM Kyber-1024 e XChaCha20-Poly1305). Nenhum nó repetidor intermediário consegue ler seus dados.',
              badge: 'Post-Quantum E2EE',
            },
            {
              icon: <Compass className="w-6 h-6 text-amber-400" />,
              title: '4. Privacidade Espacial Garantida (10 km)',
              tagline: 'Anti-Triangulação Física',
              description: 'Nenhum usuário tem sua residência ou ponto exato revelado. O sistema aplica um deslocamento gaussiano de 10 km nos mapas públicos, protegendo sua integridade física contra perseguições.',
              badge: 'Differential Privacy',
            },
            {
              icon: <Zap className="w-6 h-6 text-rose-400" />,
              title: '5. Tolerância Extrema a Desastres & Guerras',
              tagline: 'Store-and-Forward (DTN)',
              description: 'Mesmo sem conexão direta no momento, os nós guardam pacotes em trânsito e os entregam quando encontram outro operador na rua ou no trabalho. Funciona em tempestades, enchentes e colapsos.',
              badge: 'Resiliência DTN',
            },
            {
              icon: <Unlock className="w-6 h-6 text-indigo-400" />,
              title: '6. Hardware Acessível & Aberto',
              tagline: 'De Celulares a Placas de R$ 50',
              description: 'Você não precisa de equipamentos caros. Use seu computador atual, celulares antigos como repetidores ou chips ESP32 e rádios Baofeng baratos que qualquer pessoa pode adquirir.',
              badge: 'Democratização',
            },
          ].map((pillar, i) => (
            <div
              key={i}
              className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all shadow-xl"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    {pillar.icon}
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                    {pillar.badge}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white">{pillar.title}</h3>
                  <div className="text-xs text-indigo-400 font-mono mt-0.5">{pillar.tagline}</div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {pillar.description}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Status:</span>
                <span className="text-emerald-400 flex items-center gap-1 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> ATIVO NO SISTEMA
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ==================================================================== */}
      {/* ABA 3: SIMULADOR DE COBERTURA DA REDE LIVRE                          */}
      {/* ==================================================================== */}
      {activeTab === 'simulator' && (
        <div className="space-y-6">
          {/* Barra de Métricas Agregadas do Simulador */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="space-y-0.5">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Alcance Linear Acumulado</span>
              <div className="text-2xl font-black text-emerald-400">{totalCoverageKm.toFixed(1)} km</div>
              <span className="text-[11px] text-slate-400">Cobertura da malha em saltos</span>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Estações e Nós na Malha</span>
              <div className="text-2xl font-black text-cyan-400">{totalNodesCount} Nós</div>
              <span className="text-[11px] text-slate-400">Roteadores ativos</span>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Resiliência à Falhas</span>
              <div className="text-2xl font-black text-indigo-400">{estimatedRedundancy.toFixed(1)}%</div>
              <span className="text-[11px] text-slate-400">Probabilidade de entrega sem falha</span>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Dependência de Servidores</span>
              <div className="text-2xl font-black text-rose-400">0.0%</div>
              <span className="text-[11px] text-slate-400">Soberania total local</span>
            </div>
          </div>

          {/* Adicionar Novos Nós à Malha Livre */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              Adicionar Nó Transmissor ao Simulador da Sua Cidade
            </h3>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleAddNode('wifi')}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5"
              >
                <Wifi className="w-3.5 h-3.5" />
                <span>+ Nó Wi-Fi Mesh Local (300m)</span>
              </button>

              <button
                onClick={() => handleAddNode('lora')}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-xl text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>+ Gateway LoRa Meshtastic (25km)</span>
              </button>

              <button
                onClick={() => handleAddNode('hf')}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>+ Estação Rádio Tático HF (600km)</span>
              </button>

              <button
                onClick={() => handleAddNode('satellite')}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-purple-300 rounded-xl text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5"
              >
                <Satellite className="w-3.5 h-3.5" />
                <span>+ Terminal Satélite LEO (2500km)</span>
              </button>

              <button
                onClick={() => handleAddNode('acoustic')}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-blue-300 rounded-xl text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5"
              >
                <Waves className="w-3.5 h-3.5" />
                <span>+ Boia Subaquática Acústica (2.5km)</span>
              </button>
            </div>
          </div>

          {/* Lista de Nós na Malha Simulada */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {nodes.map((n, idx) => (
              <div
                key={n.id}
                className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-md"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-indigo-300 border border-slate-800">
                      SALTO #{idx + 1}
                    </span>
                    {nodes.length > 1 && (
                      <button
                        onClick={() => handleRemoveNode(n.id)}
                        className="text-slate-500 hover:text-rose-400 text-xs font-bold"
                        title="Remover nó da malha"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-white">{n.name}</h4>
                    <span className="text-[10px] font-mono text-cyan-400 uppercase">{n.type}</span>
                  </div>

                  <div className="space-y-1 text-xs font-mono bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                    <div className="flex justify-between text-slate-400">
                      <span>Raio de Ação:</span>
                      <span className="text-emerald-400 font-bold">{n.rangeKm} km</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Vazão Típica:</span>
                      <span className="text-cyan-300">{n.throughput}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Hardware:</span>
                      <span className="text-slate-300 truncate max-w-[130px]">{n.hardware}</span>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Pronto para Roteamento de Pacotes</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ABA 4: COMO COMEÇAR EM 4 PASSOS SIMPLES                              */}
      {/* ==================================================================== */}
      {activeTab === 'guide' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            {
              step: 'Passo 1',
              title: 'Ative sua Presença no Mapa 3D',
              description: 'Vá até o Globo 3D da Terra e ative o botão "Quero ser visto no mapa". Sua localização já é protegida automaticamente com o raio de 10 km. Você poderá ver e conversar com quem estiver na sua região.',
              badge: 'Gratuito e Imediato',
            },
            {
              step: 'Passo 2',
              title: 'Crie Conexões Locais por Wi-Fi ou Bluetooth',
              description: 'Mesmo sem internet na sua casa ou rua, o aplicativo Jyy permite conversar e transferir arquivos por Wi-Fi Direct, rede local e Bluetooth com qualquer vizinho num raio de 50 a 150 metros.',
              badge: 'Zero Hardware Adicional',
            },
            {
              step: 'Passo 3',
              title: 'Conecte um Rádio LoRa (Alcance de 15 a 40 km)',
              description: 'Para conectar bairros vizinhos ou cidades próximas sem internet, conecte qualquer chip LoRa SX1262 (Heltec V3 ou LilyGO T-Beam) na porta USB. O Jyy reconhece automaticamente e cria enlaces de rádio.',
              badge: 'Custo: ~R$ 80 uma única vez',
            },
            {
              step: 'Passo 4',
              title: 'Seja um Guardião da Comunicação Comunitária',
              description: 'Em dias de fortes chuvas, colapsos elétricos ou emergências, você e sua comunidade terão uma rede ativa para socorro, troca de informações de saúde e coordenação sem depender de ninguém.',
              badge: 'Segurança e Soberania',
            },
          ].map((item, i) => (
            <div
              key={i}
              className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-3 shadow-xl flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30">
                    {item.step}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {item.badge}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white">{item.title}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-500">Jyy Sovereign Suite</span>
                {i === 0 && onNavigateToGlobe && (
                  <button
                    onClick={onNavigateToGlobe}
                    className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    <span>Ir para o Globo 3D</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
