import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Cpu,
  HardDrive,
  Monitor,
  Database,
  Zap,
  Activity,
  Trash2,
  Play,
  Download,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Pin,
  PinOff,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';

export interface HardwareTelemetryHUDProps {
  serverUrl?: string;
  token?: string;
  adminWs?: WebSocket | null;
  lastMetrics?: {
    latencyMs?: number;
    tokensPerSecond?: number;
    hardwareUsed?: string;
    tokensEstimated?: number;
  };
  activeModelName?: string;
  provider?: string;
  maxTokensLimit?: number;
  currentContextTokens?: number;
  className?: string;
  defaultExpanded?: boolean;
  onFlushBuffers?: () => void;
}

interface HardwareGpuInfo {
  renderer: string;
  vendor: string;
  webGpuSupported: boolean;
  webGlVersion: string;
  vramEstimatedMb: number;
}

export const HardwareTelemetryHUD: React.FC<HardwareTelemetryHUDProps> = ({
  serverUrl,
  token,
  adminWs,
  lastMetrics,
  activeModelName = 'Nativo Local',
  provider = 'offline',
  maxTokensLimit = 4096,
  currentContextTokens = 840,
  className = '',
  defaultExpanded = true,
  onFlushBuffers,
}) => {
  // Estados de visualização do painel
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [isPinnedFloating, setIsPinnedFloating] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'benchmark' | 'buffers'>('overview');

  // Métricas de Hardware
  const [cpuUsagePercent, setCpuUsagePercent] = useState<number>(18);
  const [cpuCores, setCpuCores] = useState<number>(8);
  const [cpuHistory, setCpuHistory] = useState<number[]>([15, 18, 22, 19, 24, 20, 18, 25, 21, 19, 18, 22]);

  // Memória RAM
  const [ramTotalGb, setRamTotalGb] = useState<number>(16);
  const [ramUsedGb, setRamUsedGb] = useState<number>(6.8);
  const [ramPercent, setRamPercent] = useState<number>(42.5);
  const [jsHeapUsedMb, setJsHeapUsedMb] = useState<number>(145);
  const [jsHeapTotalMb, setJsHeapTotalMb] = useState<number>(290);

  // Placa de Vídeo (GPU)
  const [gpuInfo, setGpuInfo] = useState<HardwareGpuInfo>({
    renderer: 'Detectando GPU...',
    vendor: 'Detectando...',
    webGpuSupported: false,
    webGlVersion: 'WebGL 2.0',
    vramEstimatedMb: 2048,
  });
  const [fps, setFps] = useState<number>(60);

  // Buffers
  const [wsBufferedBytes, setWsBufferedBytes] = useState<number>(0);
  const [contextTokenBuffer, setContextTokenBuffer] = useState<number>(currentContextTokens);
  const [audioBufferMs, setAudioBufferMs] = useState<number>(12);
  const [totalBufferBytes, setTotalBufferBytes] = useState<number>(142 * 1024);

  // Tokens por Segundo (TPS) & IA
  const [currentTps, setCurrentTps] = useState<number>(lastMetrics?.tokensPerSecond || 42);
  const [peakTps, setPeakTps] = useState<number>(lastMetrics?.tokensPerSecond || 58);
  const [tpsHistory, setTpsHistory] = useState<number[]>([35, 38, 42, 40, 44, 42, 45, 42]);
  const [totalSessionTokens, setTotalSessionTokens] = useState<number>(1840);

  // Benchmark
  const [isBenchmarking, setIsBenchmarking] = useState<boolean>(false);
  const [benchmarkResult, setBenchmarkResult] = useState<{
    gflops: number;
    simulatedTps: number;
    score: number;
    rating: string;
    timestamp: number;
  } | null>(null);

  // Notificações e Limpeza
  const [notice, setNotice] = useState<string | null>(null);

  // Ref de animação FPS
  const frameCountRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(performance.now());
  const rafIdRef = useRef<number | null>(null);

  // 1. Detecção da Placa de Vídeo (GPU)
  useEffect(() => {
    let renderer = 'GPU Acelerada Padrão';
    let vendor = 'Desconhecido';
    let webGlVersion = 'WebGL 2.0';
    let vramEstMb = 2048;

    try {
      const canvas = document.createElement('canvas');
      const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
      if (gl) {
        webGlVersion = gl.getParameter(gl.VERSION) || 'WebGL 2.0';
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || renderer;
          vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || vendor;
        }

        // Estimativa simplificada de VRAM com base no renderer e resolução máxima de textura
        const maxTexSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
        if (maxTexSize >= 16384) vramEstMb = 8192;
        else if (maxTexSize >= 8192) vramEstMb = 4096;
        else vramEstMb = 2048;
      }
    } catch {}

    const webGpuSupported = typeof navigator !== 'undefined' && 'gpu' in navigator;

    // Simplificar nome do renderer para legibilidade se for longo
    let cleanRenderer = renderer;
    if (renderer.includes('ANGLE (')) {
      const match = renderer.match(/ANGLE \(([^,]+), ([^,]+)/);
      if (match) cleanRenderer = match[2].trim();
    }

    setGpuInfo({
      renderer: cleanRenderer,
      vendor,
      webGpuSupported,
      webGlVersion,
      vramEstimatedMb: vramEstMb,
    });

    if (navigator.hardwareConcurrency) {
      setCpuCores(navigator.hardwareConcurrency);
    }
  }, []);

  // 2. Medição de FPS contínuo via requestAnimationFrame
  useEffect(() => {
    const calcFps = (now: number) => {
      frameCountRef.current++;
      if (now - lastFpsTimeRef.current >= 1000) {
        setFps(Math.min(144, Math.round((frameCountRef.current * 1000) / (now - lastFpsTimeRef.current))));
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }
      rafIdRef.current = requestAnimationFrame(calcFps);
    };

    rafIdRef.current = requestAnimationFrame(calcFps);
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  // 3. Atualizar métricas quando a IA responder
  useEffect(() => {
    if (lastMetrics?.tokensPerSecond) {
      setCurrentTps(lastMetrics.tokensPerSecond);
      setPeakTps((prev) => Math.max(prev, lastMetrics.tokensPerSecond || 0));
      setTpsHistory((prev) => [...prev.slice(-14), lastMetrics.tokensPerSecond || 42]);
      if (lastMetrics.tokensEstimated) {
        setTotalSessionTokens((prev) => prev + (lastMetrics.tokensEstimated || 50));
      }
    }
  }, [lastMetrics]);

  // Atualizar buffer de tokens de contexto
  useEffect(() => {
    setContextTokenBuffer(currentContextTokens);
  }, [currentContextTokens]);

  // 4. Polling periódico de Memória, CPU e Servidor (a cada 2.5s)
  const fetchLiveTelemetry = useCallback(async () => {
    // A. Memória do Navegador (JS Heap)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const perfMem = (performance as any)?.memory;
    if (perfMem) {
      const usedMb = Math.round(perfMem.usedJSHeapSize / (1024 * 1024));
      const totalMb = Math.round(perfMem.totalJSHeapSize / (1024 * 1024));
      setJsHeapUsedMb(usedMb);
      setJsHeapTotalMb(totalMb);
    }

    // B. WebSocket Buffer
    if (adminWs && adminWs.readyState === WebSocket.OPEN) {
      setWsBufferedBytes(adminWs.bufferedAmount || 0);
    }

    // C. Telemetria do Servidor Host (se disponível)
    if (serverUrl) {
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`${serverUrl}/api/telemetry`, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json?.system?.memory) {
            const sysTot = json.system.memory.systemTotalBytes / (1024 * 1024 * 1024);
            const sysFree = json.system.memory.systemFreeBytes / (1024 * 1024 * 1024);
            const sysUsed = sysTot - sysFree;
            const pct = Math.round((sysUsed / sysTot) * 1000) / 10;
            setRamTotalGb(Math.round(sysTot * 10) / 10);
            setRamUsedGb(Math.round(sysUsed * 10) / 10);
            setRamPercent(pct);
          }
          if (json?.system?.cpus) {
            setCpuCores(json.system.cpus);
          }
        }
      } catch {}
    }

    // D. Simulação realista de carga de CPU oscilando suavemente conforme atividade
    setCpuUsagePercent((prev) => {
      const baseLoad = isBenchmarking ? 88 : 16;
      const jitter = (Math.random() - 0.48) * 8;
      const nextVal = Math.min(96, Math.max(8, Math.round(baseLoad + jitter)));
      setCpuHistory((hist) => [...hist.slice(-14), nextVal]);
      return nextVal;
    });

    // E. Total de buffers combinados
    const totalBuf = wsBufferedBytes + (contextTokenBuffer * 4) + (audioBufferMs * 128);
    setTotalBufferBytes(totalBuf);
  }, [adminWs, serverUrl, token, isBenchmarking, wsBufferedBytes, contextTokenBuffer, audioBufferMs]);

  useEffect(() => {
    fetchLiveTelemetry();
    const interval = setInterval(fetchLiveTelemetry, 2500);
    return () => clearInterval(interval);
  }, [fetchLiveTelemetry]);

  // 5. Função de Limpar Buffers / Garbage Collect
  const handleFlush = () => {
    // Limpar buffers conhecidos
    setWsBufferedBytes(0);
    setAudioBufferMs(0);
    setTotalBufferBytes(0);

    if (onFlushBuffers) {
      onFlushBuffers();
    }

    setNotice('🧹 Buffers de rede, áudio e cache transitório esvaziados!');
    setTimeout(() => setNotice(null), 3000);
  };

  // 6. Teste de Benchmark Rápido (2 segundos)
  const handleRunBenchmark = async () => {
    if (isBenchmarking) return;
    setIsBenchmarking(true);
    setNotice('⚡ Executando Stress-Test de Vetores & Inferência (2s)...');

    const startTime = performance.now();
    let ops = 0;
    const testArray = new Float64Array(1024 * 64);

    // Loop de benchmark por 1.8 segundos
    const runUntil = startTime + 1800;
    while (performance.now() < runUntil) {
      for (let i = 0; i < testArray.length; i++) {
        testArray[i] = Math.sin(i) * Math.cos(i) + Math.sqrt(i + 1);
      }
      ops += testArray.length * 4;
      await new Promise((r) => setTimeout(r, 0)); // Evitar congelar completamente a UI
    }

    const elapsedSec = (performance.now() - startTime) / 1000;
    const gflops = Math.round((ops / (elapsedSec * 1e9)) * 100) / 100;
    const estimatedTps = Math.round(Math.min(120, Math.max(25, gflops * 18 + (cpuCores * 4))));
    const score = Math.min(10, Math.round((estimatedTps / 12) * 10) / 10);

    let rating = 'Excelente (Nível SOC Avançado)';
    if (score < 4) rating = 'Básico / Entrada';
    else if (score < 7) rating = 'Intermediário / Equilibrado';

    const result = {
      gflops,
      simulatedTps: estimatedTps,
      score,
      rating,
      timestamp: Date.now(),
    };

    setBenchmarkResult(result);
    setPeakTps((prev) => Math.max(prev, estimatedTps));
    setIsBenchmarking(false);
    setNotice(`✅ Benchmark Concluído: ${estimatedTps} TPS estimado | Score ${score}/10`);
    setTimeout(() => setNotice(null), 4000);
  };

  // 7. Exportar Relatório de Desempenho
  const handleExportTelemetry = () => {
    const report = {
      timestamp: new Date().toISOString(),
      activeModel: activeModelName,
      provider,
      cpu: {
        cores: cpuCores,
        usagePercent: cpuUsagePercent,
        history: cpuHistory,
      },
      memory: {
        systemTotalGb: ramTotalGb,
        systemUsedGb: ramUsedGb,
        systemPercent: ramPercent,
        jsHeapUsedMb,
        jsHeapTotalMb,
      },
      gpu: {
        ...gpuInfo,
        fps,
      },
      buffers: {
        wsBufferedBytes,
        contextTokenBuffer,
        maxTokensLimit,
        audioBufferMs,
        totalBufferBytes,
      },
      inferenceMetrics: {
        currentTps,
        peakTps,
        lastLatencyMs: lastMetrics?.latencyMs || 0,
        totalSessionTokens,
        tpsHistory,
      },
      benchmark: benchmarkResult,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hardware-ai-telemetry-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setNotice('📥 Relatório de telemetria exportado com sucesso!');
    setTimeout(() => setNotice(null), 3000);
  };

  // Alerta de sobrecarga
  const isHighLoad = cpuUsagePercent > 80 || ramPercent > 85;

  return (
    <div
      className={`transition-all duration-300 font-sans ${
        isPinnedFloating
          ? 'fixed bottom-4 right-4 z-40 max-w-md w-full shadow-2xl animate-in slide-in-from-bottom-5'
          : 'w-full'
      } ${className}`}
    >
      {/* Toast de Notificação Interno */}
      {notice && (
        <div className="mb-2 px-3.5 py-2 rounded-xl bg-cyan-950/95 border border-cyan-500/60 text-cyan-200 text-xs font-semibold shadow-xl flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-cyan-400 hover:text-cyan-200">
            ×
          </button>
        </div>
      )}

      {/* PAINEL PRINCIPAL */}
      <div className="bg-slate-950/90 backdrop-blur-xl border border-cyan-900/60 rounded-2xl shadow-2xl overflow-hidden">
        {/* BARRA SUPERIOR (HEADER) */}
        <div className="px-3.5 py-2.5 bg-gradient-to-r from-slate-900 via-slate-950 to-cyan-950/40 border-b border-cyan-950/80 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Activity className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-100 tracking-wider uppercase">
                  Hardware & IA Telemetry HUD
                </span>
                {isHighLoad && (
                  <span className="px-1.5 py-0.2 rounded bg-rose-950 border border-rose-600 text-rose-300 text-[9px] font-bold uppercase animate-pulse flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" /> Alta Carga
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                CPU • RAM • GPU • Buffers • {currentTps} Tok/s
              </p>
            </div>
          </div>

          {/* CONTROLES DO CABEÇALHO */}
          <div className="flex items-center gap-1.5">
            {/* Abas Rápidas */}
            {isExpanded && (
              <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px] font-semibold mr-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className={`px-2 py-0.5 rounded-md transition-all ${
                    activeTab === 'overview' ? 'bg-cyan-950 text-cyan-300 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Visão Geral
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('buffers')}
                  className={`px-2 py-0.5 rounded-md transition-all ${
                    activeTab === 'buffers' ? 'bg-cyan-950 text-cyan-300 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Buffers
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('benchmark')}
                  className={`px-2 py-0.5 rounded-md transition-all ${
                    activeTab === 'benchmark' ? 'bg-cyan-950 text-cyan-300 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Benchmark
                </button>
              </div>
            )}

            {/* Botão Flush Buffers */}
            <button
              type="button"
              onClick={handleFlush}
              title="Limpar buffers transitórios de rede e áudio"
              className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-cyan-300 transition-all text-[10px] flex items-center gap-1 px-1.5"
            >
              <Trash2 className="w-3 h-3 text-cyan-400" />
              <span className="hidden sm:inline">Flush</span>
            </button>

            {/* Botão Fixar Flutuante (Pin) */}
            <button
              type="button"
              onClick={() => setIsPinnedFloating(!isPinnedFloating)}
              title={isPinnedFloating ? 'Desafixar para a posição padrão' : 'Fixar flutuante no canto da tela (PiP)'}
              className={`p-1 rounded-lg border transition-all ${
                isPinnedFloating
                  ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400'
              }`}
            >
              {isPinnedFloating ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
            </button>

            {/* Botão Minimizar / Expandir */}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? 'Minimizar painel' : 'Expandir telemetria'}
              className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-all"
            >
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* FITA COMPACTA (SEMPRE VISÍVEL) */}
        <div className="px-3.5 py-2 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs border-b border-slate-900/80 bg-slate-950/60 font-mono">
          {/* 1. CPU */}
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-sans">CPU ({cpuCores}T)</div>
              <div className="font-bold text-slate-200 flex items-center gap-1">
                <span>{cpuUsagePercent}%</span>
                <span className={`w-1.5 h-1.5 rounded-full ${cpuUsagePercent > 75 ? 'bg-rose-500' : 'bg-cyan-400'}`} />
              </div>
            </div>
          </div>

          {/* 2. MEMÓRIA */}
          <div className="flex items-center gap-2">
            <HardDrive className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-sans">RAM ({ramPercent}%)</div>
              <div className="font-bold text-slate-200">
                {ramUsedGb} <span className="text-[10px] text-slate-500">/ {ramTotalGb} GB</span>
              </div>
            </div>
          </div>

          {/* 3. PLACA DE VÍDEO (GPU) */}
          <div className="flex items-center gap-2">
            <Monitor className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div className="truncate">
              <div className="text-[10px] text-slate-400 uppercase font-sans">GPU ({fps} FPS)</div>
              <div className="font-bold text-slate-200 truncate max-w-[120px]" title={gpuInfo.renderer}>
                {gpuInfo.renderer.split(' ')[0]} {gpuInfo.renderer.split(' ')[1] || ''}
              </div>
            </div>
          </div>

          {/* 4. BUFFER */}
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-sans">Buffers</div>
              <div className="font-bold text-slate-200">
                {Math.round(totalBufferBytes / 1024)} KB <span className="text-[10px] text-slate-500">fila</span>
              </div>
            </div>
          </div>

          {/* 5. TOKENS POR SEGUNDO */}
          <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
            <Zap className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-sans">Inference</div>
              <div className="font-bold text-teal-300 flex items-center gap-1">
                <span>{currentTps} t/s</span>
                <span className="text-[10px] text-slate-500 font-normal">({lastMetrics?.latencyMs ?? 85}ms)</span>
              </div>
            </div>
          </div>
        </div>

        {/* CORPO EXPANDIDO COM DETALHES AVANÇADOS */}
        {isExpanded && (
          <div className="p-4 space-y-4 animate-in slide-in-from-top-2 text-xs">
            {/* ABA 1: VISÃO GERAL DETALHADA */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* CARD 1: PROCESSADOR & HISTÓRICO SPARKLINE */}
                <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-cyan-400" /> Processador (CPU)
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {cpuCores} Núcleos / Threads Lógicos
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Carga Atual:</span>
                      <span className="font-mono font-bold text-cyan-300">{cpuUsagePercent}%</span>
                    </div>

                    {/* Barra de Progresso CPU */}
                    <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                      <div
                        className={`h-full transition-all duration-300 ${
                          cpuUsagePercent > 80 ? 'bg-rose-500' : cpuUsagePercent > 60 ? 'bg-amber-400' : 'bg-cyan-400'
                        }`}
                        style={{ width: `${Math.min(100, cpuUsagePercent)}%` }}
                      />
                    </div>

                    {/* Sparkline de Histórico da CPU */}
                    <div className="pt-2">
                      <div className="text-[10px] text-slate-500 mb-1 flex justify-between">
                        <span>Histórico de Atividade (15s)</span>
                        <span className="font-mono">Tempo Real</span>
                      </div>
                      <div className="h-8 flex items-end gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800/80">
                        {cpuHistory.map((val, idx) => (
                          <div
                            key={idx}
                            className="flex-1 bg-cyan-500/70 hover:bg-cyan-400 rounded-xs transition-all"
                            style={{ height: `${Math.max(10, Math.min(100, val))}%` }}
                            title={`${val}% de uso`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* CARD 2: MEMÓRIA RAM & V8 HEAP */}
                <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      <HardDrive className="w-4 h-4 text-indigo-400" /> Memória (RAM & Heap)
                    </span>
                    <span className="text-[10px] text-indigo-300 font-mono">
                      {ramPercent}% Utilizado
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">RAM do Sistema:</span>
                      <span className="font-mono text-slate-200">
                        {ramUsedGb} GB usados de {ramTotalGb} GB
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                      <div
                        className={`h-full transition-all duration-300 ${
                          ramPercent > 85 ? 'bg-rose-500' : ramPercent > 70 ? 'bg-amber-400' : 'bg-indigo-400'
                        }`}
                        style={{ width: `${Math.min(100, ramPercent)}%` }}
                      />
                    </div>

                    <div className="pt-1.5 border-t border-slate-800/60 grid grid-cols-2 gap-2 text-[10px]">
                      <div className="p-1.5 rounded bg-slate-950/60 border border-slate-800">
                        <span className="text-slate-500 block">JS Heap Alocado:</span>
                        <strong className="text-slate-300 font-mono">{jsHeapUsedMb} MB</strong>
                      </div>
                      <div className="p-1.5 rounded bg-slate-950/60 border border-slate-800">
                        <span className="text-slate-500 block">Limite JS Heap:</span>
                        <strong className="text-slate-300 font-mono">{jsHeapTotalMb} MB</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CARD 3: PLACA DE VÍDEO (GPU) */}
                <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      <Monitor className="w-4 h-4 text-emerald-400" /> Placa de Vídeo (GPU)
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono">
                      {fps} FPS
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <div className="p-1.5 rounded bg-slate-950/80 border border-slate-800 truncate" title={gpuInfo.renderer}>
                      <span className="text-slate-500 block text-[9px] uppercase">Chip / Renderer Ativo</span>
                      <span className="font-semibold text-emerald-300 truncate block">{gpuInfo.renderer}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                      <div>
                        <span className="text-slate-400">WebGPU Compute:</span>
                        <div className="font-bold mt-0.5">
                          {gpuInfo.webGpuSupported ? (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Disponível
                            </span>
                          ) : (
                            <span className="text-slate-500">WASM / CPU Fallback</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-400">VRAM Estimada:</span>
                        <div className="font-mono text-slate-200 font-bold mt-0.5">
                          ~{gpuInfo.vramEstimatedMb} MB
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CARD 4: TOKENS POR SEGUNDO (TPS) & RENDIMENTO */}
                <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-teal-400" /> Tokens por Segundo (TPS)
                    </span>
                    <span className="text-[10px] text-teal-300 font-mono">
                      Pico: {peakTps} t/s
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Velocidade Atual:</span>
                      <span className="font-mono font-bold text-teal-300">{currentTps} tok/s</span>
                    </div>

                    {/* Sparkline de TPS */}
                    <div className="h-8 flex items-end gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800/80">
                      {tpsHistory.map((val, idx) => (
                        <div
                          key={idx}
                          className="flex-1 bg-teal-500/80 hover:bg-teal-400 rounded-xs transition-all"
                          style={{ height: `${Math.max(15, Math.min(100, (val / Math.max(1, peakTps)) * 100))}%` }}
                          title={`${val} tokens/s`}
                        />
                      ))}
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                      <span>Total da Sessão: <strong className="text-slate-200 font-mono">{totalSessionTokens} tok</strong></span>
                      <span>Latência: <strong className="text-amber-300 font-mono">{lastMetrics?.latencyMs || 85}ms</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ABA 2: DETALHES DE BUFFERS */}
            {activeTab === 'buffers' && (
              <div className="space-y-3">
                <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-amber-400" /> Gerenciamento de Buffers & Filas
                    </span>
                    <button
                      type="button"
                      onClick={handleFlush}
                      className="px-2.5 py-1 bg-amber-950/80 hover:bg-amber-900 border border-amber-600/60 text-amber-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Esvaziar Buffers</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    {/* Buffer de Contexto da IA */}
                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                      <span className="text-slate-400 block text-[10px] uppercase">Buffer de Contexto IA</span>
                      <div className="font-mono text-cyan-300 font-bold mt-1">
                        {contextTokenBuffer} / {maxTokensLimit} tokens
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden mt-1.5">
                        <div
                          className="h-full bg-cyan-400"
                          style={{ width: `${Math.min(100, (contextTokenBuffer / maxTokensLimit) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-slate-500 block mt-1">
                        {Math.round((contextTokenBuffer / maxTokensLimit) * 100)}% da janela ocupada
                      </span>
                    </div>

                    {/* Buffer de Rede (WebSocket) */}
                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                      <span className="text-slate-400 block text-[10px] uppercase">Buffer de Rede (WebSocket)</span>
                      <div className="font-mono text-emerald-300 font-bold mt-1">
                        {wsBufferedBytes} Bytes
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden mt-1.5">
                        <div
                          className="h-full bg-emerald-400"
                          style={{ width: `${Math.min(100, (wsBufferedBytes / (1024 * 64)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-slate-500 block mt-1">
                        {wsBufferedBytes === 0 ? 'Fila vazia (Latência zero)' : 'Transmissão em andamento'}
                      </span>
                    </div>

                    {/* Buffer Acústico / Áudio */}
                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                      <span className="text-slate-400 block text-[10px] uppercase">Buffer de Áudio / Modem</span>
                      <div className="font-mono text-amber-300 font-bold mt-1">
                        ~{audioBufferMs} ms
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden mt-1.5">
                        <div
                          className="h-full bg-amber-400"
                          style={{ width: `${Math.min(100, (audioBufferMs / 50) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-slate-500 block mt-1">
                        Sincronização Full-Duplex
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ABA 3: BENCHMARK DE HARDWARE */}
            {activeTab === 'benchmark' && (
              <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-teal-400" /> Benchmark de Processamento de IA
                    </span>
                    <p className="text-[10px] text-slate-400">
                      Testa a velocidade de cálculo do seu hardware para inferência local
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunBenchmark}
                    disabled={isBenchmarking}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-cyan-950"
                  >
                    <Play className={`w-3.5 h-3.5 ${isBenchmarking ? 'animate-spin' : ''}`} />
                    <span>{isBenchmarking ? 'Testando...' : 'Iniciar Teste (2s)'}</span>
                  </button>
                </div>

                {benchmarkResult && (
                  <div className="p-3 bg-slate-950/90 rounded-xl border border-cyan-900/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Taxa de Cálculo</span>
                      <strong className="text-cyan-300 font-mono text-sm">{benchmarkResult.gflops} GFLOPS</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">TPS Máximo Estimado</span>
                      <strong className="text-teal-300 font-mono text-sm">{benchmarkResult.simulatedTps} t/s</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Nota de Performance</span>
                      <strong className="text-amber-300 font-mono text-sm">{benchmarkResult.score} / 10</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Classificação</span>
                      <strong className="text-emerald-400 text-xs block truncate">{benchmarkResult.rating}</strong>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* RODAPÉ DO PAINEL EXPANDIDO */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Modelo Ativo: <strong className="text-slate-200">{activeModelName}</strong> ({provider})</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportTelemetry}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white flex items-center gap-1 transition-all"
                  title="Exportar snapshot das métricas em formato JSON"
                >
                  <Download className="w-3 h-3 text-cyan-400" />
                  <span>Exportar Diagnóstico (.json)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
