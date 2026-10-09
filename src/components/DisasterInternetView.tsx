import React, { useState, useEffect, useRef } from 'react';
import {
  Flame,
  AlertTriangle,
  Radio,
  Shield,
  Zap,
  RefreshCw,
  Compass,
  Cpu,
  Layers,
  Terminal,
  Activity,
  HardDrive,
  Globe,
  ShieldAlert,
  Hammer,
  Sparkles,
} from 'lucide-react';

export const DisasterInternetView: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pulseEmpCount, setPulseEmpCount] = useState<number>(0);
  const [simulatedNodesActive, setSimulatedNodesActive] = useState<number>(142);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    '⚡ [INIT]: Protocolo de Comunicação para Guerra & Desastres Naturais inicializado.',
    '🛡️ [EMP SHIELD]: Blindagem eletromagnética contra pulsos atômicos e tempestades solares ativada.',
    '📡 [AUTO-MESH]: Roteamento ad-hoc sem servidores centrais, satélites comerciais ou DNS da Internet.',
    '🌊 [DESASTRES]: Suporte a colapso de torres de celular, enchentes, terremotos e apagão elétrico.',
    '⚠️ [AVISO DO SISTEMA]: MÓDULO EM CONSTRUÇÃO E HOMOLOGAÇÃO TÁTICA.',
  ]);

  // Terminal de log com mensagens automáticas
  useEffect(() => {
    const messages = [
      '🛰️ Escaneando canais de socorro em HF/VHF (Frequências de emergência IARU)...',
      '📦 Fragmentando pacotes de sobrevivência em micro-mensagens tolerantes a atraso (DTN)...',
      '🔒 Gerando chaves criptográficas offline de curva elíptica para nós de campo...',
      '🔋 Monitorando baterias LiFePO4 e conversores solares dos bunkers de comunicação...',
      '🛠️ Engenharia de resiliência: Camadas de transporte via Som, Luz, Rádio e LoRa unificadas.',
      '🚧 Módulo em construção ativa: Recursos táticos finais sendo compilados...',
    ];

    let index = 0;
    const interval = setInterval(() => {
      setTerminalLogs((prev) => [...prev.slice(-12), messages[index % messages.length]]);
      index++;
      setSimulatedNodesActive((prev) => prev + Math.floor((Math.random() - 0.4) * 3));
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  // Animação Criativa no Canvas (Rede Tática de Sobrevivência com Pulso EMP e Reconstrução da Malha)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;

    // Gerar nós de emergência na tela
    const numNodes = 36;
    const nodes: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      type: 'bunker' | 'repeater' | 'drone' | 'hospital';
      isSurviving: boolean;
      pulsePhase: number;
    }[] = [];

    const w = canvas.width;
    const h = canvas.height;

    for (let i = 0; i < numNodes; i++) {
      nodes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        type: i % 4 === 0 ? 'bunker' : i % 4 === 1 ? 'drone' : i % 4 === 2 ? 'hospital' : 'repeater',
        isSurviving: true,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    // Ondas de choque do pulso EMP
    const shockwaves: { x: number; y: number; r: number; maxR: number; opacity: number }[] = [];

    const render = () => {
      time += 0.03;
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, w, h);

      // Grade hexagonal de fundo tático militar
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
      ctx.lineWidth = 1;
      const hexSize = 38;
      for (let x = 0; x < w + hexSize; x += hexSize * 1.5) {
        for (let y = 0; y < h + hexSize; y += hexSize * Math.sqrt(3)) {
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const angle = (k * Math.PI) / 3;
            const hx = x + hexSize * 0.5 * Math.cos(angle);
            const hy = y + hexSize * 0.5 * Math.sin(angle);
            if (k === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }

      // Atualizar nós
      nodes.forEach((node) => {
        node.x += node.vx;
        node.y += node.vy;

        if (node.x < 20 || node.x > w - 20) node.vx *= -1;
        if (node.y < 20 || node.y > h - 20) node.vy *= -1;

        node.pulsePhase += 0.05;
      });

      // Conexões de sobrevivência (Linhas de malha resiliente entre nós próximos)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 130) {
            const alpha = (1 - dist / 130) * 0.6;
            ctx.strokeStyle = `rgba(245, 158, 11, ${alpha})`; // Âmbar emergência
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();

            // Partícula de pacote de dados correndo na linha
            const particleT = (time * 1.5 + (i + j)) % 1;
            const px = nodes[i].x + (nodes[j].x - nodes[i].x) * particleT;
            const py = nodes[i].y + (nodes[j].y - nodes[i].y) * particleT;
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(px, py, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Desenhar nós
      nodes.forEach((node) => {
        const pulse = Math.sin(node.pulsePhase) * 2;
        let color = '#f59e0b';
        let label = 'NÓ';

        if (node.type === 'bunker') {
          color = '#10b981';
          label = 'BUNKER';
        } else if (node.type === 'hospital') {
          color = '#ef4444';
          label = 'HOSPITAL';
        } else if (node.type === 'drone') {
          color = '#06b6d4';
          label = 'DRONE-RELÉ';
        }

        // Halo de sinal de sobrevivência
        ctx.fillStyle = `${color}22`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 14 + pulse, 0, Math.PI * 2);
        ctx.fill();

        // Núcleo do nó
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Rótulo minúsculo
        ctx.fillStyle = '#94a3b8';
        ctx.font = '8px monospace';
        ctx.fillText(label, node.x + 8, node.y + 3);
      });

      // Ondas de choque do pulso EMP
      for (let s = shockwaves.length - 1; s >= 0; s--) {
        const sw = shockwaves[s];
        sw.r += 6;
        sw.opacity = Math.max(0, 1 - sw.r / sw.maxR);

        ctx.strokeStyle = `rgba(244, 63, 94, ${sw.opacity * 0.8})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
        ctx.stroke();

        if (sw.r >= sw.maxR) {
          shockwaves.splice(s, 1);
        }
      }

      // Efeito de radar central de varredura de área de desastre
      const centerX = w * 0.5;
      const centerY = h * 0.5;
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, 90, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Linha de varredura rotativa
      const scanAngle = time * 1.8;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + Math.cos(scanAngle) * 90, centerY + Math.sin(scanAngle) * 90);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    // Função de pulso EMP disparada externamente
    (canvas as unknown as { triggerEmp: (x: number, y: number) => void }).triggerEmp = (x, y) => {
      shockwaves.push({
        x: x || w * 0.5,
        y: y || h * 0.5,
        r: 10,
        maxR: Math.max(w, h),
        opacity: 1,
      });
    };

    return () => cancelAnimationFrame(animId);
  }, []);

  // Disparar pulso EMP tático interativo
  const handleTriggerEmp = () => {
    setPulseEmpCount((prev) => prev + 1);
    const canvas = canvasRef.current;
    if (canvas && (canvas as unknown as { triggerEmp: (x: number, y: number) => void }).triggerEmp) {
      (canvas as unknown as { triggerEmp: (x: number, y: number) => void }).triggerEmp(
        canvas.width * (0.3 + Math.random() * 0.4),
        canvas.height * (0.3 + Math.random() * 0.4)
      );
    }
    setTerminalLogs((prev) => [
      ...prev,
      `💥 [PULSO EMP DISPARADO]: Simulação de colapso de infraestrutura regional #${pulseEmpCount + 1}.`,
      `🛡️ [RESILIÊNCIA JJY]: Nós reiniciando comunicação em modo estritamente autônomo.`,
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Tático de Emergência */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-amber-950/40 to-slate-900 border border-amber-800/50 p-6 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-mono uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" /> Comunicação Crítica & Contingência Máxima
              </span>
              <span className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-mono">
                War-Ready / Disaster Mesh
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono">
                Zero Infraestrutura Dependente
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Internet para Guerra & Desastres Naturais</span>
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Sistema de sobrevivência de telecomunicações para cenários de <strong>guerra eletrônica, ataques de pulso eletromagnético (EMP), tempestades solares extremas, desastres climáticos e apagões elétricos globais</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleTriggerEmp}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold text-xs transition-all shadow-lg shadow-amber-950 flex items-center gap-2"
            >
              <Zap className="w-4 h-4 text-yellow-300" />
              <span>Simular Pulso EMP / Testar Resiliência</span>
            </button>
          </div>
        </div>
      </div>

      {/* Caixa de Aviso de Em Construção com Animação Criativa */}
      <div className="relative rounded-3xl overflow-hidden border border-amber-800/40 bg-slate-950 shadow-2xl">
        {/* Banner de Aviso de Em Construção */}
        <div className="p-4 bg-gradient-to-r from-amber-950/60 via-slate-900 to-amber-950/60 border-b border-amber-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Hammer className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-amber-200 flex items-center gap-2">
                <span>Módulo de Contingência Extrema em Construção</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Em Desenvolvimento
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Os protocolos e motores de sobrevivência física estão sendo homologados. Visualize a malha tática simulada abaixo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{simulatedNodesActive} Nós em Malha</span>
            </span>
          </div>
        </div>

        {/* Canvas da Animação Criativa */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={960}
            height={460}
            className="w-full h-[400px] md:h-[480px] object-cover"
          />

          {/* Holograma Flutuante de Mensagem */}
          <div className="absolute top-6 left-6 max-w-md bg-slate-950/85 backdrop-blur-md p-4 rounded-2xl border border-amber-800/50 space-y-2 text-xs">
            <span className="font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider text-[11px] font-mono">
              <ShieldAlert className="w-4 h-4 text-amber-400" /> Arquitetura de Sobrevivência Post-Collapse
            </span>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              Quando torres de operadoras são destruídas, cabos de fibra óptica submarinos são cortados e servidores centrais saem do ar, a malha Jjy opera de forma <strong>estritamente descentralizada P2P</strong> através de rádio HF/VHF, LoRa, acústica na água e feixes de luz ópticos.
            </p>
            <div className="flex flex-wrap gap-2 text-[10px] font-mono pt-1 text-slate-400">
              <span className="px-2 py-0.5 bg-slate-900 rounded border border-slate-800">✓ Blindagem EMP</span>
              <span className="px-2 py-0.5 bg-slate-900 rounded border border-slate-800">✓ Roteamento DTN</span>
              <span className="px-2 py-0.5 bg-slate-900 rounded border border-slate-800">✓ Bunkers Autónomos</span>
            </div>
          </div>

          {/* Legenda dos Nós Táticos */}
          <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 bg-slate-950/85 backdrop-blur-md p-3 rounded-2xl border border-slate-800 text-xs">
            <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Bunker de Sobrevivência
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-cyan-400 inline-block" /> Drone Repetidor Autônomo
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" /> Ponto Hospitalar / Resgate
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> Repetidor Tático de Colina
              </span>
            </div>

            <button
              type="button"
              onClick={handleTriggerEmp}
              className="px-3 py-1 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/50 text-amber-300 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5"
            >
              <Zap className="w-3 h-3 text-yellow-300" />
              <span>Testar Onda EMP</span>
            </button>
          </div>
        </div>
      </div>

      {/* Terminal de Inicialização dos Protocolos */}
      <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-sm text-slate-100">Log de Inicialização dos Protocolos de Emergência</h3>
          </div>
          <span className="text-[10px] font-mono text-slate-500">Live Resilience Feed</span>
        </div>

        <div className="space-y-1.5 font-mono text-xs text-slate-300 max-h-[160px] overflow-y-auto pr-1">
          {terminalLogs.map((log, i) => (
            <div
              key={i}
              className={`leading-relaxed ${
                log.includes('⚡')
                  ? 'text-amber-300 font-bold'
                  : log.includes('💥')
                  ? 'text-rose-400 font-bold'
                  : log.includes('🛡️')
                  ? 'text-emerald-400'
                  : log.includes('⚠️')
                  ? 'text-yellow-400 font-bold'
                  : 'text-slate-400'
              }`}
            >
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
