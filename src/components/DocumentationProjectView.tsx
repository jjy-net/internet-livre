import React, { useState } from 'react';
import {
  BookOpen,
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
  Cpu,
  Download,
  Copy,
  Check,
  Server,
  FileCode,
  Terminal,
  ExternalLink,
} from 'lucide-react';

export const DocumentationProjectView: React.FC<{
  onNavigateToGlobe?: () => void;
  onNavigateToFreeInternet?: () => void;
  onNavigateToProtocols?: () => void;
  onNavigateToWifi?: () => void;
}> = ({
  onNavigateToGlobe,
  onNavigateToFreeInternet,
  onNavigateToProtocols,
  onNavigateToWifi,
}) => {
  const [activeSection, setActiveSection] = useState<'overview' | 'modules' | 'hardware' | 'vps' | 'github'>('overview');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(null), 2500);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* ==================================================================== */}
      {/* HEADER DA DOCUMENTAÇÃO                                               */}
      {/* ==================================================================== */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950/70 to-slate-950 border border-indigo-500/30 p-6 md:p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                DOCUMENTAÇÃO OFICIAL DO PROJETO JYY
              </span>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-semibold">
                ● v2.0.0 ARQUITETURA ABERTA
              </span>
              <span className="text-xs font-mono text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded-md border border-slate-800">
                SOVEREIGN P2P & MESH SUITE
              </span>
            </div>

            <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight">
              Manual Técnico & Arquitetura do Sistema
            </h1>
            <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
              Guia completo de engenharia, especificações de hardware, protocolos físicos suportados,
              funcionamento do Globo 3D, privacidade com fuzzing de 10 km e publicação na VPS e GitHub.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onNavigateToGlobe && (
              <button
                onClick={onNavigateToGlobe}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/30"
              >
                <Globe className="w-4 h-4" />
                <span>Ir para o Globo 3D</span>
              </button>
            )}

            {onNavigateToFreeInternet && (
              <button
                onClick={onNavigateToFreeInternet}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
              >
                <Unlock className="w-4 h-4" />
                <span>Internet Livre</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* ABAS DA DOCUMENTAÇÃO                                                 */}
      {/* ==================================================================== */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto scrollbar-none pb-1">
        {[
          { id: 'overview', label: '1. Visão Geral', icon: <Sparkles className="w-4 h-4 text-amber-400" /> },
          { id: 'modules', label: '2. Módulos do Sistema', icon: <Layers className="w-4 h-4 text-cyan-400" /> },
          { id: 'hardware', label: '3. Hardwares Suportados', icon: <Cpu className="w-4 h-4 text-emerald-400" /> },
          { id: 'vps', label: '4. Deploy na VPS Hostinger', icon: <Server className="w-4 h-4 text-indigo-400" /> },
          { id: 'github', label: '5. Como Publicar no GitHub', icon: <Terminal className="w-4 h-4 text-purple-400" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeSection === tab.id
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
      {/* SEÇÃO 1: VISÃO GERAL                                                 */}
      {/* ==================================================================== */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900 border border-indigo-500/40 rounded-2xl p-6 md:p-8 space-y-3 shadow-xl">
            <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/30 inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
              MANIFESTO DE CONECTIVIDADE MULTI-DISPOSITIVO
            </span>
            <p className="text-base md:text-lg text-slate-100 font-medium leading-relaxed">
              &ldquo;O sistema foi desenvolvido para funcionar em celulares, computadores e diversos outros dispositivos, 
              transformando-se em uma plataforma de interligação que permite a comunicação livre entre pessoas e máquinas. 
              A proposta é oferecer uma forma de conexão flexível, acessível e independente de uma conexão convencional com a internet, 
              possibilitando a comunicação por meio de outras tecnologias e alternativas de conectividade previstas no projeto.&rdquo;
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-4 shadow-xl">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              O que é a Internet Livre (Jyy v2.0)?
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              O <strong>Jyy</strong> é uma suíte unificada de telecomunicação descentralizada concebida sob o paradigma
              <strong> 100% Offline-First</strong>. Ele combina tecnologias de sensoriamento de radar por Wi-Fi CSI,
              rádio LoRa de longo alcance, modems acústicos subaquáticos, comunicação por pulsos de luz e criptografia
              pós-quântica, transformando qualquer computador ou celular em um <strong>nó roteador soberano</strong>.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="font-bold text-sm text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Zero Dependência de Internet
                </span>
                <p className="text-xs text-slate-400">
                  Opera em locais remotos, florestas, áreas de desastre, mar aberto ou no meio de um colapso de infraestrutura.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="font-bold text-sm text-cyan-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Multi-Meio Físico Híbrido
                </span>
                <p className="text-xs text-slate-400">
                  Os pacotes de dados pulam de ondas de rádio para som no ar, luz laser ou satélite de forma automática.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="font-bold text-sm text-purple-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Criptografia Inviolável
                </span>
                <p className="text-xs text-slate-400">
                  Chaves geradas localmente com XChaCha20-Poly1305 e ML-KEM Kyber-1024 protegendo cada mensagem.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SEÇÃO 2: MÓDULOS DO SISTEMA                                          */}
      {/* ==================================================================== */}
      {activeSection === 'modules' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            {
              title: 'Globo 3D da Terra (Início)',
              icon: <Globe className="w-5 h-5 text-emerald-400" />,
              badge: 'Descoberta Social',
              description: 'Mapa orbital tridimensional que permite encontrar outros operadores na sua cidade ou pelo mundo com raio proposital de proteção de 10 km (fuzzing). Inclui chat direto P2P.',
              action: onNavigateToGlobe,
              actionLabel: 'Abrir Globo 3D',
            },
            {
              title: 'Nossa Internet Livre & Soberana',
              icon: <Unlock className="w-5 h-5 text-cyan-400" />,
              badge: 'Manifesto & Mesh',
              description: 'Apresenta a filosofia da rede livre, os 6 pilares de soberania, um simulador interativo de malha mesh urbana e o guia para conectar vizinhos e comunidades.',
              action: onNavigateToFreeInternet,
              actionLabel: 'Abrir Internet Livre',
            },
            {
              title: 'Wi-Fi Radar & Visão Holográfica RuView',
              icon: <Wifi className="w-5 h-5 text-indigo-400" />,
              badge: 'RuView CSI DensePose',
              description: 'Sensoriamento de RF através de paredes com gráficos de frequência respiratória e cardíaca em tempo real, malha multistática N x (N-1) e seleção de dispositivos conectados.',
              action: onNavigateToWifi,
              actionLabel: 'Abrir Wi-Fi Radar',
            },
            {
              title: 'Omni-Protocol Hub & Loja de Plugins',
              icon: <Radio className="w-5 h-5 text-purple-400" />,
              badge: 'Argon-4 Class',
              description: 'Matriz com 16 protocolos físicos canônicos (LoRa, Acústico, Óptico, Celular, Satélite, Cabo) com barramento interativo de transmissão e loja para instalar novos plugins.',
              action: onNavigateToProtocols,
              actionLabel: 'Abrir Protocolos',
            },
            {
              title: 'Internet Subaquática & Anfíbia',
              icon: <Waves className="w-5 h-5 text-blue-400" />,
              badge: 'Subsea Ultrasound',
              description: 'Modem sonoro piezoelétrico operando de 18 a 48 kHz para comunicação através de água doce e salgada, acompanhado de feixe óptico azul-verde de 532 nm.',
            },
            {
              title: 'Rádio LoRa & Meshtastic Mesh',
              icon: <Radio className="w-5 h-5 text-amber-400" />,
              badge: 'Sub-GHz 915MHz',
              description: 'Comunicação tática em frequência aberta de 433/868/915 MHz com alcance de 15 a 40 km por salto, sem depender de torres celulares ou internet.',
            },
          ].map((mod, i) => (
            <div
              key={i}
              className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3 flex flex-col justify-between shadow-xl"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                      {mod.icon}
                    </div>
                    <h3 className="font-bold text-sm text-white">{mod.title}</h3>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-indigo-300 border border-slate-800">
                    {mod.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {mod.description}
                </p>
              </div>

              {mod.action && (
                <div className="pt-2 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={mod.action}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <span>{mod.actionLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ==================================================================== */}
      {/* SEÇÃO 3: HARDWARES SUPORTADOS                                        */}
      {/* ==================================================================== */}
      {activeSection === 'hardware' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-400" />
            Tabela de Compatibilidade de Hardware
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px] uppercase">
                  <th className="py-2.5 px-3">Categoria</th>
                  <th className="py-2.5 px-3">Modelo / Chipset</th>
                  <th className="py-2.5 px-3">Frequência / Meio</th>
                  <th className="py-2.5 px-3">Alcance Típico</th>
                  <th className="py-2.5 px-3">Preço Aprox.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                <tr>
                  <td className="py-2.5 px-3 text-cyan-400 font-bold">Rádio LoRa</td>
                  <td className="py-2.5 px-3 text-white">Heltec WiFi LoRa 32 V3 / Semtech SX1262</td>
                  <td className="py-2.5 px-3">433 / 868 / 915 MHz</td>
                  <td className="py-2.5 px-3 text-emerald-400">15 ~ 40 km</td>
                  <td className="py-2.5 px-3">R$ 80 ~ 120</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-cyan-400 font-bold">Wi-Fi CSI Radar</td>
                  <td className="py-2.5 px-3 text-white">ESP32-S3 Dual Core / Intel AX210</td>
                  <td className="py-2.5 px-3">2.4 / 5.8 GHz OFDM</td>
                  <td className="py-2.5 px-3 text-emerald-400">150 ~ 300 m (Através de paredes)</td>
                  <td className="py-2.5 px-3">R$ 35 ~ 60</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-cyan-400 font-bold">Rádio Analógico</td>
                  <td className="py-2.5 px-3 text-white">Baofeng UV-5R / Quansheng UV-K5</td>
                  <td className="py-2.5 px-3">VHF 144MHz / UHF 430MHz</td>
                  <td className="py-2.5 px-3 text-emerald-400">10 ~ 60 km</td>
                  <td className="py-2.5 px-3">R$ 90 ~ 150</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-cyan-400 font-bold">Acústico Subaquático</td>
                  <td className="py-2.5 px-3 text-white">Pastilha Piezocerâmica PZT + Amp Classe D</td>
                  <td className="py-2.5 px-3">18 ~ 48 kHz Ultrassom Aquático</td>
                  <td className="py-2.5 px-3 text-emerald-400">800 m ~ 2.5 km (na água)</td>
                  <td className="py-2.5 px-3">R$ 60 ~ 140</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-cyan-400 font-bold">Satélite Orbital</td>
                  <td className="py-2.5 px-3 text-white">Módulo Iridium 9603 / Antena Starlink Mini</td>
                  <td className="py-2.5 px-3">1621 MHz / Banda Ku</td>
                  <td className="py-2.5 px-3 text-emerald-400">Global (Polo a Polo)</td>
                  <td className="py-2.5 px-3">Variável</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-cyan-400 font-bold">Computador / Celular</td>
                  <td className="py-2.5 px-3 text-white">Qualquer PC Windows / Linux ou Celular</td>
                  <td className="py-2.5 px-3">Som, Câmera, Wi-Fi e Bluetooth</td>
                  <td className="py-2.5 px-3 text-emerald-400">Local e P2P</td>
                  <td className="py-2.5 px-3">R$ 0 (Seu aparelho atual)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SEÇÃO 4: DEPLOY NA VPS HOSTINGER                                     */}
      {/* ==================================================================== */}
      {activeSection === 'vps' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-4 shadow-xl">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-indigo-400" />
            Como Publicar o Nó na sua VPS Hostinger (jyy.com.br)
          </h2>

          <p className="text-xs text-slate-300 leading-relaxed">
            Com uma VPS Hostinger, você tem um servidor Linux completo com acesso root, permitindo que o nó funcione 24 horas por dia com suporte total a WebSocket, HTTPS e baixa latência.
          </p>

          <div className="space-y-3 pt-2">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-cyan-400 block font-mono">
                Passo 1: Enviar os arquivos do Windows para a VPS
              </span>
              <p className="text-xs text-slate-400">
                Dê duplo clique no arquivo <strong className="text-white">ENVIAR-PARA-VPS-HOSTINGER.bat</strong> na pasta do seu projeto. Digite o IP da VPS e os arquivos serão enviados via SCP.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-emerald-400 block font-mono">
                Passo 2: Rodar o instalador automatizado na VPS
              </span>
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between font-mono text-xs text-cyan-300">
                <code>ssh root@SEU_IP_VPS "cd /var/www/jyy && bash install-vps-hostinger.sh"</code>
                <button
                  onClick={() => copyToClipboard('cd /var/www/jyy && bash install-vps-hostinger.sh', 'vps_cmd')}
                  className="p-1 hover:text-white"
                >
                  {copiedCode === 'vps_cmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-purple-400 block font-mono">
                Passo 3: Emitir certificado SSL Gratuito (HTTPS + WSS)
              </span>
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between font-mono text-xs text-emerald-400">
                <code>sudo certbot --nginx -d jyy.com.br -d www.jyy.com.br</code>
                <button
                  onClick={() => copyToClipboard('sudo certbot --nginx -d jyy.com.br -d www.jyy.com.br', 'ssl_cmd')}
                  className="p-1 hover:text-white"
                >
                  {copiedCode === 'ssl_cmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SEÇÃO 5: COMO PUBLICAR NO GITHUB EM 1 CLIQUE                         */}
      {/* ==================================================================== */}
      {activeSection === 'github' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-5 shadow-xl">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-purple-400" />
            Publicação Automática no GitHub em 1 Clique
          </h2>

          <p className="text-xs text-slate-300 leading-relaxed">
            Se você nunca usou o GitHub antes ou não sabe criar repositórios manualmente, criamos um script que faz tudo por você de forma guiada no Windows:
          </p>

          <div className="p-5 rounded-xl bg-gradient-to-r from-purple-950/40 via-indigo-950/40 to-slate-950 border border-purple-500/30 space-y-3">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Script: CRIAR-E-PUBLICAR-NO-GITHUB.bat
            </h3>
            <p className="text-xs text-slate-300">
              Na pasta do seu projeto, dê duplo clique no arquivo:
            </p>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-emerald-400 font-bold">
              📁 CRIAR-E-PUBLICAR-NO-GITHUB.bat
            </div>
            <ol className="text-xs text-slate-400 space-y-1.5 list-decimal list-inside leading-relaxed pt-1">
              <li>O script abrirá o navegador para você entrar na sua conta do GitHub e autorizar o acesso com 1 clique.</li>
              <li>Em seguida, ele cria o repositório público com o nome <strong className="text-white">jyy</strong> na sua conta.</li>
              <li>Envia todo o código-fonte, o Globo 3D, a Internet Livre e o README formatado.</li>
              <li>Abre a página do seu repositório no seu navegador pronta para você compartilhar!</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};
