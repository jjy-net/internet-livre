import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Waves,
  Anchor,
  Radio,
  Satellite,
  Activity,
  Volume2,
  VolumeX,
  Lightbulb,
  Zap,
  Shield,
  Layers,
  Compass,
  ArrowRight,
  RefreshCw,
  Send,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Info,
  ExternalLink,
  BookOpen,
  Wifi,
  FileText,
  Play,
  Pause,
  Eye,
  Crosshair,
  Server,
  Share2,
} from 'lucide-react';
import {
  OCEAN_PHYSICS,
  calculateMackenzieSoundSpeed,
  calculateThorpAttenuation,
  calculateAcousticTransmissionLoss,
  calculateElectromagneticSkinDepth,
  JERLOV_WATER_TYPES,
  JerlovWaterType,
  calculateOpticalLinkPerformance,
  JANUS_SPEC,
  buildJanusPacket,
  PHYSICAL_CHANNELS_CATALOG,
  PhysicalChannelProfile,
  SubseaPhysicalChannel,
  SubseaNetworkNode,
  INITIAL_SUBSEA_NODES,
  CrossMediumMessage,
  playSubseaAcousticBurst,
  playJanusTransmissionSequence,
  SCIENTIFIC_SUBSEA_PAPERS,
  ScientificUnderwaterPaper,
} from '../utils/underwaterCommEngine';

export const UnderwaterInternetView: React.FC = () => {
  // Abas de navegação
  type SubseaTab = 'bathy3d' | 'janus_acoustic' | 'optical_uwoc' | 'em_vlf' | 'gateway_relay' | 'chat_tactical' | 'papers';
  const [activeTab, setActiveTab] = useState<SubseaTab>('bathy3d');

  // Parâmetros oceanográficos da água
  const [waterTempC, setWaterTempC] = useState<number>(OCEAN_PHYSICS.DEFAULT_WATER_TEMP_C);
  const [salinityPpt, setSalinityPpt] = useState<number>(OCEAN_PHYSICS.DEFAULT_SALINITY_PPT);
  const [depthMeters, setDepthMeters] = useState<number>(OCEAN_PHYSICS.DEFAULT_DEPTH_METERS);
  const [acousticFreqKhz, setAcousticFreqKhz] = useState<number>(11.52); // JANUS central
  const [soundSpeed, setSoundSpeed] = useState<number>(1500);

  // Áudio real do navegador
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);

  // Nós da rede submarina
  const [nodes, setNodes] = useState<SubseaNetworkNode[]>(INITIAL_SUBSEA_NODES);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('sub_01');

  // Parâmetros Ópticos UWOC
  const [selectedJerlovId, setSelectedJerlovId] = useState<string>('jerlov_i');
  const [opticalRangeMeters, setOpticalRangeMeters] = useState<number>(25);
  const [opticalTxPowerMw, setOpticalTxPowerMw] = useState<number>(500);

  // Parâmetros VLF/ELF
  const [vlfFreqHz, setVlfFreqHz] = useState<number>(24000); // 24 kHz VLF

  // Gateway de Superfície e Relé Cross-Medium
  const [autoRelaySatellite, setAutoRelaySatellite] = useState<boolean>(true);
  const [autoRelayRadio, setAutoRelayRadio] = useState<boolean>(true);
  const [autoInjectMesh, setAutoInjectMesh] = useState<boolean>(true);

  // Mensagens e Chat Tático
  const [messages, setMessages] = useState<CrossMediumMessage[]>([
    {
      id: 'msg_01',
      sourceNodeId: 'sub_01',
      sourceNodeName: 'Submarino SSN-01 (Prof: 280m)',
      targetNodeId: 'buoy_alpha',
      targetNodeName: 'Bóia Gateway Superfície',
      content: 'NATO JANUS 4748: SUB-SURFACE PATROL NORMAL. DEPTH 280M.',
      channelUsed: 'acoustic_janus',
      timestamp: '14:20:12',
      hopsCount: 1,
      routedViaGateway: true,
      status: 'subsea_transmitted',
      metrics: { latencyMs: 240, estimatedThroughput: '80 bps', acousticFreqKhz: 11.52, depthMeters: 280, crcValid: true },
    },
    {
      id: 'msg_02',
      sourceNodeId: 'buoy_alpha',
      sourceNodeName: 'Bóia Gateway Superfície',
      targetNodeId: 'coast_soc',
      targetNodeName: 'Centro de Operações Naval (SOC)',
      content: '[RELAY CROSS-MEDIUM] Retransmitido via Satélite Iridium: SUB-SURFACE PATROL NORMAL.',
      channelUsed: 'satellite_rf',
      timestamp: '14:20:14',
      hopsCount: 2,
      routedViaGateway: true,
      status: 'delivered_to_mesh',
      metrics: { latencyMs: 850, estimatedThroughput: '2.4 kbps', depthMeters: 0, crcValid: true },
    },
    {
      id: 'msg_03',
      sourceNodeId: 'sensor_bottom',
      sourceNodeName: 'Estação DART Fundo Mar (850m)',
      targetNodeId: 'buoy_alpha',
      targetNodeName: 'Bóia Gateway Superfície',
      content: 'SEISMIC STATUS OK. PRESSURE: 85.4 BAR. NO TSUNAMI WAVE ANOMALY.',
      channelUsed: 'acoustic_whoi',
      timestamp: '14:22:05',
      hopsCount: 1,
      routedViaGateway: true,
      status: 'subsea_transmitted',
      metrics: { latencyMs: 580, estimatedThroughput: '1.2 kbps', acousticFreqKhz: 25.0, depthMeters: 850, crcValid: true },
    },
  ]);

  const [inputMessage, setInputMessage] = useState<string>('');
  const [selectedSendChannel, setSelectedSendChannel] = useState<SubseaPhysicalChannel>('acoustic_janus');

  // Canvas de Batimetria e Sonar
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isSonarPinging, setIsSonarPinging] = useState<boolean>(false);
  const pingRingsRef = useRef<{ x: number; y: number; r: number; maxR: number; opacity: number; color: string }[]>([]);

  // Recalcular velocidade do som sempre que os parâmetros oceanográficos mudarem
  useEffect(() => {
    const c = calculateMackenzieSoundSpeed(waterTempC, salinityPpt, depthMeters);
    setSoundSpeed(c);
  }, [waterTempC, salinityPpt, depthMeters]);

  // Loop de renderização do Canvas Batimétrico Oceânico
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let waveOffset = 0;

    const render = () => {
      waveOffset += 0.03;
      const w = canvas.width;
      const h = canvas.height;

      // Limpar tela com gradiente de profundidade oceânica (do ar/superfície ao fundo abissal)
      const seaGrad = ctx.createLinearGradient(0, 0, 0, h);
      seaGrad.addColorStop(0, '#041325'); // Céu escuro / Linha de ar
      seaGrad.addColorStop(0.12, '#03254c'); // Superfície do mar
      seaGrad.addColorStop(0.35, '#011c38'); // Epipelágica (Sol até 100m)
      seaGrad.addColorStop(0.65, '#010e1f'); // Termoclina / Mesopelágica (Camada SOFAR)
      seaGrad.addColorStop(1.0, '#00040a'); // Zona Batipelágica Abissal (Escuridão total)
      ctx.fillStyle = seaGrad;
      ctx.fillRect(0, 0, w, h);

      // Desenhar linha de água da superfície com ondas animadas
      const surfaceY = h * 0.14;
      ctx.beginPath();
      ctx.moveTo(0, surfaceY);
      for (let x = 0; x <= w; x += 10) {
        const y = surfaceY + Math.sin(x * 0.02 + waveOffset) * 4 + Math.cos(x * 0.01 - waveOffset * 0.5) * 2;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = 'rgba(2, 44, 85, 0.25)';
      ctx.fill();

      // Linha brilhante da superfície
      ctx.beginPath();
      for (let x = 0; x <= w; x += 10) {
        const y = surfaceY + Math.sin(x * 0.02 + waveOffset) * 4;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Faixa da Termoclina (Canal SOFAR: Sound Fixing and Ranging Channel)
      const sofarTop = h * 0.45;
      const sofarHeight = h * 0.16;
      ctx.fillStyle = 'rgba(16, 185, 129, 0.05)';
      ctx.fillRect(0, sofarTop, w, sofarHeight);

      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
      ctx.beginPath();
      ctx.moveTo(0, sofarTop + sofarHeight / 2);
      ctx.lineTo(w, sofarTop + sofarHeight / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(16, 185, 129, 0.7)';
      ctx.font = '10px monospace';
      ctx.fillText('CAMADA TERMOCLINA & GUIA DE ONDA SOFAR (Velocidade Sonora Mínima)', 16, sofarTop + sofarHeight / 2 - 6);

      // Relevo topográfico do leito submarino (fundo do mar)
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, h * 0.90);
      ctx.quadraticCurveTo(w * 0.25, h * 0.86, w * 0.5, h * 0.92);
      ctx.quadraticCurveTo(w * 0.75, h * 0.98, w, h * 0.88);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = '#050c14';
      ctx.fill();
      ctx.strokeStyle = '#0f2942';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Posições no canvas para cada nó:
      // Bóia de Superfície (x: 48%, y: surfaceY)
      const buoyX = w * 0.48;
      const buoyY = surfaceY;

      // Submarino Tático (x: 22%, y: h * 0.58)
      const subX = w * 0.22;
      const subY = h * 0.58;

      // AUV Scout (x: 68%, y: h * 0.42)
      const auvX = w * 0.68;
      const auvY = h * 0.42;

      // Sensor de Fundo DART (x: 82%, y: h * 0.89)
      const dartX = w * 0.82;
      const dartY = h * 0.89;

      // Satélite LEO (x: 35%, y: h * 0.04)
      const satX = w * 0.35;
      const satY = h * 0.05;

      // Estação Naval SOC (x: 88%, y: h * 0.08)
      const socX = w * 0.88;
      const socY = h * 0.08;

      // ==========================================
      // LINKS DE COMUNICAÇÃO ANIMADOS ENTRE NÓS
      // ==========================================

      // 1. Link Acústico Submarino -> Bóia (Ondas curvas / linha tracejada)
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(subX, subY);
      ctx.lineTo(buoyX, buoyY + 24); // cabo do hidrofone da bóia
      ctx.stroke();
      ctx.restore();

      // 2. Link Óptico Blue-Green (AUV -> Bóia ou Submarino): feixe de laser pulsante
      ctx.save();
      const laserPulse = Math.abs(Math.sin(waveOffset * 3));
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.4 + laserPulse * 0.4})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(auvX, auvY);
      ctx.lineTo(buoyX, buoyY + 20);
      ctx.stroke();
      ctx.restore();

      // 3. Link Cross-Medium: Bóia -> Satélite no ar
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)'; // Roxo / Satélite
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(buoyX, buoyY - 14);
      ctx.lineTo(satX, satY);
      ctx.stroke();
      ctx.restore();

      // 4. Link Rádio Satélite -> SOC Naval de Terra
      ctx.save();
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(satX, satY);
      ctx.lineTo(socX, socY);
      ctx.stroke();
      ctx.restore();

      // Anéis de Pulso Sonar / Acústico
      for (let i = pingRingsRef.current.length - 1; i >= 0; i--) {
        const ring = pingRingsRef.current[i];
        ring.r += 2.0;
        ring.opacity = Math.max(0, 1 - ring.r / ring.maxR);

        ctx.save();
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
        ctx.strokeStyle = ring.color.replace('OPACITY', ring.opacity.toString());
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.restore();

        if (ring.r >= ring.maxR) {
          pingRingsRef.current.splice(i, 1);
        }
      }

      // ==========================================
      // DESENHAR OS NÓS GRÁFICOS NO CANVAS
      // ==========================================

      // 1. Satélite LEO
      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.arc(satX, satY, 5, 0, Math.PI * 2);
      ctx.fill();
      // Painéis solares
      ctx.strokeStyle = '#e9d5ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(satX - 12, satY - 2, 24, 4);
      ctx.fillStyle = '#e9d5ff';
      ctx.font = '9px monospace';
      ctx.fillText('📡 Satélite LEO (550km)', satX + 16, satY + 3);

      // 2. Estação Naval SOC
      ctx.fillStyle = '#10b981';
      ctx.fillRect(socX - 6, socY - 6, 12, 12);
      ctx.fillStyle = '#a7f3d0';
      ctx.font = '9px monospace';
      ctx.fillText('🏛️ SOC Naval (Terra)', socX - 60, socY - 10);

      // 3. Bóia de Superfície (Gateway Relé)
      // Corpo da bóia
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(buoyX, buoyY - 4, 8, 0, Math.PI * 2);
      ctx.fill();
      // Mastro com antena
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(buoyX, buoyY - 4);
      ctx.lineTo(buoyX, buoyY - 18);
      ctx.stroke();
      // Antena no topo
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(buoyX, buoyY - 18, 2.5, 0, Math.PI * 2);
      ctx.fill();
      // Cabo do hidrofone descendo na água
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(buoyX, buoyY);
      ctx.lineTo(buoyX, buoyY + 28);
      ctx.stroke();
      // Transdutor / Hidrofone na ponta
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(buoyX - 4, buoyY + 28, 8, 8);

      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('BÓIA GATEWAY RELÉ', buoyX + 14, buoyY - 8);
      ctx.font = '9px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Cross-Medium Buoy', buoyX + 14, buoyY + 4);

      // 4. Submarino Tático (SSN-01)
      ctx.save();
      ctx.translate(subX, subY);
      // Casco do submarino
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 32, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Vela / Torre do submarino
      ctx.fillRect(-6, -14, 12, 6);
      ctx.strokeRect(-6, -14, 12, 6);
      // Periscópio / Antena VLF estendida
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(0, -20);
      ctx.stroke();
      // Cauda / Hélice
      ctx.beginPath();
      ctx.moveTo(-32, 0);
      ctx.lineTo(-38, -6);
      ctx.lineTo(-38, 6);
      ctx.closePath();
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('SUBMARINO SSN-01', 40, -4);
      ctx.font = '9px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Profundidade: 280m • JANUS Ativo', 40, 8);
      ctx.restore();

      // 5. AUV Autônomo Scout
      ctx.save();
      ctx.translate(auvX, auvY);
      ctx.fillStyle = '#0284c7';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Emissor óptico BlueComm na proa
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(16, 0, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#7dd3fc';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('AUV SCOUT-X4 (UWOC Óptico)', 24, -2);
      ctx.font = '8px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('140m • BlueComm 470nm', 24, 9);
      ctx.restore();

      // 6. Sensor de Fundo DART
      ctx.save();
      ctx.translate(dartX, dartY);
      ctx.fillStyle = '#475569';
      ctx.fillRect(-10, -10, 20, 10);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.strokeRect(-10, -10, 20, 10);
      // Pote transdutor
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(0, -12, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('ESTAÇÃO DART (850m)', -100, -8);
      ctx.font = '8px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Acomms WHOI 25kHz', -100, 4);
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Disparar pulso de Sonar / Acústico animado
  const triggerSonarPing = async () => {
    if (isSonarPinging) return;
    setIsSonarPinging(true);

    const canvas = canvasRef.current;
    if (canvas) {
      const w = canvas.width;
      const h = canvas.height;
      const subX = w * 0.22;
      const subY = h * 0.58;

      // Adicionar anel acústico concêntrico propagando a partir do submarino
      pingRingsRef.current.push({
        x: subX,
        y: subY,
        r: 10,
        maxR: w * 0.85,
        opacity: 1,
        color: 'rgba(0, 240, 255, OPACITY)',
      });
    }

    if (!isAudioMuted) {
      setIsPlayingAudio(true);
      try {
        await playSubseaAcousticBurst(acousticFreqKhz, 0.7, true);
      } catch (err) {
        console.warn('Erro ao emitir áudio acústico:', err);
      } finally {
        setIsPlayingAudio(false);
      }
    }

    setTimeout(() => {
      setIsSonarPinging(false);
    }, 1500);
  };

  // Transmitir pacote JANUS com áudio real e injetar na fila de mensagens
  const handleSendJanusPacket = async () => {
    if (!inputMessage.trim() || isPlayingAudio) return;

    const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];
    const janusData = buildJanusPacket(1, 10, 255, selectedNode.depthMeters, inputMessage);

    // Emissão do áudio real
    if (!isAudioMuted) {
      setIsPlayingAudio(true);
      try {
        await playJanusTransmissionSequence();
      } catch (err) {
        console.warn('Áudio WebAudio:', err);
      } finally {
        setIsPlayingAudio(false);
      }
    }

    // Criar mensagem submarina de origem
    const newSubseaMsg: CrossMediumMessage = {
      id: `msg_${Date.now()}`,
      sourceNodeId: selectedNode.id,
      sourceNodeName: `${selectedNode.name} (${selectedNode.depthMeters}m)`,
      targetNodeId: 'buoy_alpha',
      targetNodeName: 'Bóia Gateway Superfície',
      content: inputMessage,
      channelUsed: selectedSendChannel,
      timestamp: new Date().toLocaleTimeString(),
      hopsCount: 1,
      routedViaGateway: true,
      status: 'subsea_transmitted',
      metrics: {
        latencyMs: Math.round(200 + Math.random() * 150),
        estimatedThroughput: selectedSendChannel === 'optical_bluecomm' ? '15 Mbps' : '80 bps',
        acousticFreqKhz,
        depthMeters: selectedNode.depthMeters,
        crcValid: true,
      },
    };

    setMessages((prev) => [newSubseaMsg, ...prev]);

    // Simulação do Gateway de Superfície (Relé Cross-Medium) retransmitindo para Satélite/Rádio/Jyy Mesh
    setTimeout(() => {
      if (autoRelaySatellite || autoRelayRadio) {
        const relayMsg: CrossMediumMessage = {
          id: `relay_${Date.now()}`,
          sourceNodeId: 'buoy_alpha',
          sourceNodeName: 'Bóia Gateway Superfície',
          targetNodeId: 'coast_soc',
          targetNodeName: 'Centro de Operações Naval (SOC)',
          content: `[RETRANSMISSÃO BÓIA] ${inputMessage} (Encapsulado de ${selectedNode.name})`,
          channelUsed: autoRelaySatellite ? 'satellite_rf' : 'radio_rf',
          timestamp: new Date().toLocaleTimeString(),
          hopsCount: 2,
          routedViaGateway: true,
          status: 'delivered_to_mesh',
          metrics: {
            latencyMs: 780,
            estimatedThroughput: autoRelaySatellite ? '4.8 kbps (Iridium)' : '19.2 kbps (VHF Naval)',
            depthMeters: 0,
            crcValid: true,
          },
        };
        setMessages((prev) => [relayMsg, ...prev]);
      }
    }, 1200);

    setInputMessage('');
  };

  // Cálculo da atenuação óptica UWOC
  const currentJerlov = JERLOV_WATER_TYPES.find((j) => j.id === selectedJerlovId) || JERLOV_WATER_TYPES[0];
  const opticalPerf = calculateOpticalLinkPerformance(opticalRangeMeters, opticalTxPowerMw, currentJerlov);

  // Cálculo da penetração eletromagnética VLF
  const skinDepthMeters = calculateElectromagneticSkinDepth(vlfFreqHz, OCEAN_PHYSICS.WATER_SEAWATER_CONDUCTIVITY);

  // Cálculo de perda acústica (Transmission Loss)
  const acousticLoss1Km = calculateAcousticTransmissionLoss(1000, acousticFreqKhz);
  const acousticLoss5Km = calculateAcousticTransmissionLoss(5000, acousticFreqKhz);
  const thorpAlpha = calculateThorpAttenuation(acousticFreqKhz);

  return (
    <div className="space-y-6">
      {/* Top Header Banner Cyber-Subsea */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 border border-sky-800/40 p-6 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono uppercase tracking-wider flex items-center gap-1.5">
                <Waves className="w-3.5 h-3.5 text-cyan-400" /> Rede Submarina & Gateway Cross-Medium
              </span>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-mono">
                NATO STANAG 4748 (JANUS)
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono">
                Multi-Physical Channels
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Internet Subaquática & Roteamento Heterogêneo</span>
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Comunicação submersa através de <strong>Acústica / Ultrassom (JANUS)</strong>, <strong>Luz Azul-Verde (UWOC)</strong>,{' '}
              <strong>Ondas Eletromagnéticas VLF/ELF</strong> e <strong>Magneto-Indução (MI)</strong> com Bóia Gateway de Superfície para retransmissão orbital e rádio em terra.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsAudioMuted(!isAudioMuted)}
              className={`p-2.5 rounded-2xl border transition-all flex items-center gap-2 text-xs font-semibold ${
                isAudioMuted
                  ? 'bg-slate-800/80 border-slate-700 text-slate-400'
                  : 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-lg shadow-cyan-950'
              }`}
              title={isAudioMuted ? 'Áudio desativado' : 'Áudio acústico ativado'}
            >
              {isAudioMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
              <span>{isAudioMuted ? 'Mudo' : 'Som Subsea ON'}</span>
            </button>

            <button
              type="button"
              onClick={triggerSonarPing}
              disabled={isSonarPinging || isPlayingAudio}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white font-bold text-xs transition-all shadow-lg shadow-sky-950 flex items-center gap-2 disabled:opacity-50"
            >
              <Zap className={`w-4 h-4 ${isSonarPinging ? 'animate-spin text-yellow-300' : 'text-cyan-200'}`} />
              <span>{isSonarPinging ? 'Emitindo Ping...' : 'Disparar Ping Sonar'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navegação entre Abas */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-800/80 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('bathy3d')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'bathy3d'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Waves className="w-4 h-4 text-cyan-300" />
          <span>Batimetria & Simulação 2D</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('janus_acoustic')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'janus_acoustic'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Volume2 className="w-4 h-4 text-emerald-300" />
          <span>Acústica & STANAG 4748</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('optical_uwoc')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'optical_uwoc'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Lightbulb className="w-4 h-4 text-yellow-300" />
          <span>Óptico UWOC (Blue-Green)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('em_vlf')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'em_vlf'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Radio className="w-4 h-4 text-purple-300" />
          <span>VLF/ELF & Magneto-Indução</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('gateway_relay')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'gateway_relay'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Satellite className="w-4 h-4 text-amber-300" />
          <span>Bóia Gateway & Relé</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('chat_tactical')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'chat_tactical'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Send className="w-4 h-4 text-rose-300" />
          <span>Terminal Tático & Chat</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('papers')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'papers'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <BookOpen className="w-4 h-4 text-indigo-300" />
          <span>Papers & Padrões Militares</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* ABA 1: BATIMETRIA & SIMULAÇÃO 2D DO CANAL OCEÂNICO      */}
      {/* ======================================================== */}
      {activeTab === 'bathy3d' && (
        <div className="space-y-6">
          <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-700/60 text-xs font-mono">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-emerald-400 font-bold">CANAL OCEÂNICO DINÂMICO</span>
              <span className="text-slate-400">|</span>
              <span className="text-sky-300">Mackenzie: {soundSpeed} m/s</span>
            </div>

            <canvas
              ref={canvasRef}
              width={960}
              height={440}
              className="w-full h-[400px] md:h-[460px] object-cover cursor-crosshair"
              onClick={triggerSonarPing}
              title="Clique no oceano para emitir um pulso acústico"
            />

            <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 backdrop-blur-md p-3 rounded-2xl border border-slate-800 text-xs">
              <div className="flex items-center gap-4 text-slate-300">
                <span className="flex items-center gap-1.5 font-mono">
                  <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" /> Bóia Superfície (Gateway)
                </span>
                <span className="flex items-center gap-1.5 font-mono">
                  <span className="w-3 h-3 rounded-full bg-cyan-400 inline-block" /> Submarino SSN-01 (280m)
                </span>
                <span className="flex items-center gap-1.5 font-mono">
                  <span className="w-3 h-3 rounded-full bg-sky-500 inline-block" /> AUV Scout (Óptico)
                </span>
                <span className="flex items-center gap-1.5 font-mono">
                  <span className="w-3 h-3 rounded-full bg-purple-400 inline-block" /> Satélite LEO
                </span>
              </div>

              <span className="text-[11px] text-slate-400 font-mono">
                💡 Clique em qualquer ponto da água para propagar pulso sonoro
              </span>
            </div>
          </div>

          {/* Cards Rápidos de Telemetria Oceanográfica */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-[11px] text-slate-400 font-mono block">Velocidade do Som (Mackenzie)</span>
              <div className="text-xl font-bold font-mono text-cyan-300 flex items-baseline gap-1">
                <span>{soundSpeed}</span>
                <span className="text-xs text-slate-400">m/s (~{Math.round(soundSpeed * 1.94384)} nós)</span>
              </div>
              <span className="text-[10px] text-slate-500">Água salgada 35 ppt @ {depthMeters}m</span>
            </div>

            <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-[11px] text-slate-400 font-mono block">Atenuação de Thorp (11.5 kHz)</span>
              <div className="text-xl font-bold font-mono text-emerald-400 flex items-baseline gap-1">
                <span>{thorpAlpha}</span>
                <span className="text-xs text-slate-400">dB/km</span>
              </div>
              <span className="text-[10px] text-slate-500">Absorção química de Ácido Bórico</span>
            </div>

            <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-[11px] text-slate-400 font-mono block">Perda Acústica (TL @ 5km)</span>
              <div className="text-xl font-bold font-mono text-amber-400 flex items-baseline gap-1">
                <span>{acousticLoss5Km}</span>
                <span className="text-xs text-slate-400">dB</span>
              </div>
              <span className="text-[10px] text-slate-500">Espalhamento esférico + absorção</span>
            </div>

            <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-[11px] text-slate-400 font-mono block">Skin Depth VLF (24 kHz)</span>
              <div className="text-xl font-bold font-mono text-purple-400 flex items-baseline gap-1">
                <span>{skinDepthMeters}</span>
                <span className="text-xs text-slate-400">metros</span>
              </div>
              <span className="text-[10px] text-slate-500">Penetração máxima em água salgada</span>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 2: ACÚSTICA & NATO STANAG 4748 (JANUS ULTRASSOM)    */}
      {/* ======================================================== */}
      {activeTab === 'janus_acoustic' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Coluna Esquerda: Calculadora e Parâmetros */}
          <div className="lg:col-span-5 space-y-5">
            <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" /> Propriedades do Meio Aquático
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  CTD Profiler
                </span>
              </div>

              {/* Slider Temperatura */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Temperatura da Água:</span>
                  <strong className="text-sky-300">{waterTempC.toFixed(1)} °C</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="32"
                  step="0.5"
                  value={waterTempC}
                  onChange={(e) => setWaterTempC(parseFloat(e.target.value))}
                  className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider Salinidade */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Salinidade (PSU / ppt):</span>
                  <strong className="text-sky-300">{salinityPpt.toFixed(1)} ppt</strong>
                </div>
                <input
                  type="range"
                  min="15"
                  max="42"
                  step="0.5"
                  value={salinityPpt}
                  onChange={(e) => setSalinityPpt(parseFloat(e.target.value))}
                  className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Água Doce (0-5)</span>
                  <span>Oceano Global (~35)</span>
                  <span>Mar Vermelho (~40)</span>
                </div>
              </div>

              {/* Slider Profundidade */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Profundidade do Transdutor:</span>
                  <strong className="text-sky-300">{depthMeters} m</strong>
                </div>
                <input
                  type="range"
                  min="5"
                  max="3000"
                  step="10"
                  value={depthMeters}
                  onChange={(e) => setDepthMeters(parseInt(e.target.value))}
                  className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Resultado Mackenzie */}
              <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-mono block">Velocidade Sonora Resultante:</span>
                  <strong className="text-lg font-bold font-mono text-cyan-300">{soundSpeed} m/s</strong>
                </div>
                <div className="text-right text-[10px] text-slate-400 font-mono">
                  <span>Equação Mackenzie (1981)</span>
                  <span className="block text-emerald-400">Precisão &lt; 0.07 m/s</span>
                </div>
              </div>
            </div>

            {/* Frequência e Modulação */}
            <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-emerald-400" /> Transceptor Acústico JANUS
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Frequência Central:</span>
                  <strong className="font-mono text-emerald-300">11.52 kHz (Banda 9.44 - 13.6 kHz)</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Esquema de Modulação:</span>
                  <strong className="font-mono text-slate-200">13 sub-bandas FHSS (Salto em Freq)</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Taxa Nominal de Dados:</span>
                  <strong className="font-mono text-amber-300">80 bps (Ultra-robusto a multipercurso)</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Comprimento do Preâmbulo:</span>
                  <strong className="font-mono text-slate-200">32 símbolos sincronizados</strong>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => playJanusTransmissionSequence()}
                  disabled={isPlayingAudio}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-950 flex items-center justify-center gap-2"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Transmitir Sequência JANUS</span>
                </button>
              </div>
            </div>
          </div>

          {/* Coluna Direita: Detalhes do Padrão e Canal SOFAR */}
          <div className="lg:col-span-7 space-y-5">
            <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-sky-400" /> Especificação NATO STANAG 4748
                </h3>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Padrão Militar Interoperável
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Adotado oficialmente pela OTAN e centros oceanográficos mundiais (CMRE), o protocolo <strong>JANUS</strong> resolveu o histórico problema da Torre de Babel subaquática. Diferentes fabricantes de submarinos, drones submarinos (AUVs) e bóias usavam modems acústicos proprietários incompatíveis.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80 space-y-1">
                  <span className="font-bold text-sky-400 block">Universal Calling Channel</span>
                  <p className="text-slate-400 text-[11px]">
                    Canal público de broadcast para descoberta mútua, pedidos de socorro (Sub-Escape) e coordenadas de encontro.
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80 space-y-1">
                  <span className="font-bold text-purple-400 block">Handshake Dinâmico</span>
                  <p className="text-slate-400 text-[11px]">
                    Após a sincronização inicial em 80 bps, os nós negociam a migração para modulações de alta taxa (PSK/OFDM ou Óptico).
                  </p>
                </div>
              </div>

              {/* Estrutura do Pacote JANUS Baseline */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 font-mono text-xs">
                <div className="flex justify-between items-center text-slate-400 border-b border-slate-800 pb-2">
                  <span>Estrutura do Frame Baseline (64 bits)</span>
                  <span className="text-emerald-400 text-[10px]">CRC-16 Ativo</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-[10px] pt-1">
                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-700">
                    <span className="text-slate-400 block">Versão / Classe</span>
                    <strong className="text-cyan-300">8 bits</strong>
                  </div>
                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-700">
                    <span className="text-slate-400 block">ID Origem / Dest</span>
                    <strong className="text-cyan-300">16 bits</strong>
                  </div>
                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-700">
                    <span className="text-slate-400 block">Posição / Profund</span>
                    <strong className="text-cyan-300">24 bits</strong>
                  </div>
                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-700">
                    <span className="text-slate-400 block">Checksum CRC</span>
                    <strong className="text-emerald-400">16 bits</strong>
                  </div>
                </div>
              </div>

              {/* O Fenômeno do Canal SOFAR */}
              <div className="p-4 bg-gradient-to-r from-sky-950/40 to-slate-950 rounded-2xl border border-sky-900/40 space-y-2 text-xs">
                <span className="font-bold text-sky-300 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-cyan-400" /> Canal SOFAR (Sound Fixing and Ranging Channel)
                </span>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Em profundidades entre 600m e 1200m, a combinação da diminuição da temperatura e o aumento da pressão hidrostática gera uma zona onde a velocidade do som é mínima. Qualquer onda sonora gerada nessa camada sofre refração constante para dentro do próprio canal, agindo como uma <strong>fibra óptica oceânica</strong> que permite a sinais sonoros viajarem milhares de quilômetros ao redor do globo!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 3: COMUNICAÇÃO ÓPTICA SUBAQUÁTICA (UWOC)            */}
      {/* ======================================================== */}
      {activeTab === 'optical_uwoc' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-5">
            <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-yellow-400" /> Parâmetros do Feixe Óptico Laser/LED
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  UWOC Blue-Green
                </span>
              </div>

              {/* Seletor Jerlov */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-400">Qualidade da Água (Classificação de Jerlov):</label>
                <div className="grid grid-cols-1 gap-2">
                  {JERLOV_WATER_TYPES.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setSelectedJerlovId(type.id)}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        selectedJerlovId === type.id
                          ? 'bg-sky-600/20 border-sky-500 text-white shadow-md shadow-sky-950'
                          : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs font-bold mb-1">
                        <span className="text-sky-300">{type.name}</span>
                        <span className="font-mono text-[10px] text-emerald-400">c = {type.extinctionCoeff} m⁻¹</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">{type.description}</p>
                      <div className="flex gap-4 mt-2 text-[10px] font-mono text-slate-500">
                        <span>Alcance típico: ~{type.typicalMaxRangeMeters}m</span>
                        <span>Comprimento de onda ideal: {type.optimalWavelengthNm} nm</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Distância Óptica */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Distância entre Emissor e Receptor:</span>
                  <strong className="text-sky-300">{opticalRangeMeters} metros</strong>
                </div>
                <input
                  type="range"
                  min="2"
                  max="100"
                  step="1"
                  value={opticalRangeMeters}
                  onChange={(e) => setOpticalRangeMeters(parseInt(e.target.value))}
                  className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Potência do Emissor */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Potência Óptica do Transmissor:</span>
                  <strong className="text-yellow-300">{opticalTxPowerMw} mW</strong>
                </div>
                <input
                  type="range"
                  min="50"
                  max="5000"
                  step="50"
                  value={opticalTxPowerMw}
                  onChange={(e) => setOpticalTxPowerMw(parseInt(e.target.value))}
                  className="w-full accent-yellow-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-5">
            <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" /> Desempenho e Throughput do Link UWOC
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 font-mono block">Taxa de Transferência:</span>
                  <div className="text-2xl font-bold font-mono text-emerald-300 flex items-baseline gap-1">
                    <span>{opticalPerf.dataRateMbps}</span>
                    <span className="text-xs text-slate-400">Mbps</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Capaz de transmitir vídeo subaquático 4K</span>
                </div>

                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 font-mono block">Atenuação Total do Canal:</span>
                  <div className="text-2xl font-bold font-mono text-rose-300 flex items-baseline gap-1">
                    <span>{opticalPerf.attenuationDb}</span>
                    <span className="text-xs text-slate-400">dB</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Absorção + Espalhamento Mie/Rayleigh</span>
                </div>
              </div>

              {/* Status do Enlace */}
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between ${
                  opticalPerf.isLinked
                    ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                    : 'bg-rose-950/30 border-rose-800/60 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {opticalPerf.isLinked ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-400" />
                  )}
                  <div>
                    <strong className="text-xs block">
                      {opticalPerf.isLinked ? 'LINK ÓPTICO ESTABELECIDO' : 'EXTINÇÃO DO FEIXE (SEM SINAL)'}
                    </strong>
                    <span className="text-[10px] opacity-80">
                      Potência no Fotomultiplicador (SiPM): {opticalPerf.rxPowerMw.toFixed(5)} mW
                    </span>
                  </div>
                </div>
              </div>

              {/* Fundamentação Científica da Janela Óptica */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 text-xs">
                <span className="font-bold text-cyan-300 block">Por que Azul e Verde (450nm - 530nm)?</span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  A água do mar atua como um filtro natural extremo. A luz infravermelha e o vermelho são absorvidos nos primeiros centímetros. Porém, existe uma <strong>janela de transmissão óptica</strong> no espectro azul (em oceano límpido) e verde (em águas costeiras com clorofila) onde a absorção da água atinge seu mínimo absoluto mundial (coeficiente de absorção tão baixo quanto 0.01 m⁻¹).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 4: VLF/ELF & MAGNETO-INDUÇÃO (MI)                    */}
      {/* ======================================================== */}
      {activeTab === 'em_vlf' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-5">
            <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-purple-400" /> Ondas de Rádio Naval VLF / ELF
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30">
                  Submarine Strategic Comm
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Frequência Eletromagnética:</span>
                  <strong className="text-purple-300">
                    {vlfFreqHz < 1000 ? `${vlfFreqHz} Hz (ELF)` : `${vlfFreqHz / 1000} kHz (VLF)`}
                  </strong>
                </div>
                <input
                  type="range"
                  min="30"
                  max="30000"
                  step="50"
                  value={vlfFreqHz}
                  onChange={(e) => setVlfFreqHz(parseInt(e.target.value))}
                  className="w-full accent-purple-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>ELF Militar (30-300 Hz)</span>
                  <span>VLF Naval (10-30 kHz)</span>
                </div>
              </div>

              {/* Resultado Skin Depth */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-[10px] text-slate-400 font-mono block">Profundidade Pelicular (Skin Depth δ):</span>
                <div className="text-2xl font-bold font-mono text-purple-300 flex items-baseline gap-2">
                  <span>{skinDepthMeters}</span>
                  <span className="text-xs text-slate-400">metros de penetração</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Em água do mar (condutividade σ = 4 S/m), a energia eletromagnética atenua a 1/e (37%) a cada {skinDepthMeters}m de profundidade.
                </p>
              </div>

              {/* Tabela Comparativa de Penetração */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 text-xs">
                <span className="font-bold text-slate-300 block">Comparativo de Penetração na Água do Mar:</span>
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-400">ELF (76 Hz - Projeto Sanguine):</span>
                    <strong className="text-emerald-400">~29 metros de profundidade</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-400">VLF (24 kHz - NAA Cutler Maine):</span>
                    <strong className="text-sky-400">~1.6 metros (Antena rebocada)</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-400">HF Rádio (1 MHz):</span>
                    <strong className="text-amber-400">~0.25 metros (25 cm)</strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Wi-Fi / Micro-ondas (2.4 GHz):</span>
                    <strong className="text-rose-400">&lt; 0.5 cm (Extinção total)</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-5">
            <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" /> Magneto-Indução (MI - Near-Field Magnetic)
              </h3>

              <p className="text-xs text-slate-300 leading-relaxed">
                A <strong>Comunicação por Magneto-Indução (MI)</strong> utiliza bobinas ressonantes que geram campos magnéticos quase estáticos de campo próximo (frequências de 100 kHz a 1 MHz).
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80 space-y-1">
                  <span className="font-bold text-cyan-300 block">Sem Efeito Interface Ar-Água</span>
                  <p className="text-slate-400 text-[11px]">
                    Ao contrário do som que reflete 99.9% na superfície da água, as linhas de campo magnético cruzam a interface ar-água sem sofrer reflexão.
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80 space-y-1">
                  <span className="font-bold text-emerald-300 block">Penetração em Lodo e Cascos</span>
                  <p className="text-slate-400 text-[11px]">
                    Ideal para sensores enterrados no leito do oceano, comunicação através de anteparas de submarinos ou docas submersas.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 font-mono text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Equação de Campo Próximo MI:</span>
                  <span className="text-cyan-400">H(R) ∝ 1 / R³</span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                  A intensidade do campo magnético decai com o cubo da distância (1/R³), o que limita o alcance a 15-35 metros, mas garante altíssima segurança contra interceptação por terceiros (LPI / LPD).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 5: BÓIA GATEWAY & RETRANSMISSÃO MULTI-CANAIS FÍSICOS */}
      {/* ======================================================== */}
      {activeTab === 'gateway_relay' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-5">
            <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <Satellite className="w-4 h-4 text-amber-400" /> Bóia Relé Cross-Medium
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  Gateway Ativo
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                A Bóia de Superfície é o <strong>nó híbrido</strong> que quebra a barreira entre o mundo subaquático e o mundo aéreo/terrestre.
              </p>

              <div className="space-y-3 pt-1">
                <label className="flex items-center justify-between p-3 bg-slate-950 rounded-2xl border border-slate-800 cursor-pointer">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-200 block">Retransmissão via Satélite</span>
                    <span className="text-[10px] text-slate-400">Iridium SBD / Starlink / Inmarsat</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoRelaySatellite}
                    onChange={(e) => setAutoRelaySatellite(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-slate-950 rounded-2xl border border-slate-800 cursor-pointer">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-200 block">Retransmissão via Rádio RF Tático</span>
                    <span className="text-[10px] text-slate-400">VHF Marítimo Ch 16 / LoRa 915MHz / UHF</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoRelayRadio}
                    onChange={(e) => setAutoRelayRadio(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-slate-950 rounded-2xl border border-slate-800 cursor-pointer">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-200 block">Injeção Direta na Rede Jyy Mesh</span>
                    <span className="text-[10px] text-slate-400">Roteamento P2P local e descentralizado</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoInjectMesh}
                    onChange={(e) => setAutoInjectMesh(e.target.checked)}
                    className="w-4 h-4 accent-cyan-500 rounded"
                  />
                </label>
              </div>
            </div>

            {/* Arquitetura da Bóia */}
            <div className="p-4 bg-slate-900/70 rounded-2xl border border-slate-800 space-y-2 text-xs font-mono">
              <span className="text-slate-400 block font-bold">Arquitetura de Hardware da Bóia:</span>
              <ul className="space-y-1.5 text-[11px] text-slate-300">
                <li className="flex items-center gap-1.5">
                  <span className="text-cyan-400">✓</span> Transdutor Piezoelétrico ITC-1032 (Submerso 15m)
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-cyan-400">✓</span> Modem JANUS DSP com FPGA / STM32
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-amber-400">✓</span> Módulo Satelital Iridium 9603 SBD
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-emerald-400">✓</span> Transceptor RF Semtech SX1262 LoRa 1W
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="text-yellow-400">✓</span> Bateria LiFePO4 com Painel Solar 40W
                </li>
              </ul>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-5">
            <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" /> Roteamento de Pacotes Cross-Layer em Tempo Real
                </h3>
                <span className="text-[10px] font-mono text-slate-400">Fila Multi-Canal Ativa</span>
              </div>

              {/* Diagrama de Fluxo Multi-Canais */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3 text-xs">
                <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                  <span>1. Submarino / AUV</span>
                  <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                  <span>2. Bóia Relé</span>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                  <span>3. Satélite / RF</span>
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
                  <span>4. Rede Jyy / Terra</span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-mono">
                  <div className="p-2 bg-slate-900 rounded-xl border border-cyan-800/40 text-cyan-300">
                    Acústica 11.5 kHz
                  </div>
                  <div className="p-2 bg-slate-900 rounded-xl border border-amber-800/40 text-amber-300">
                    Conversão Cross-Layer
                  </div>
                  <div className="p-2 bg-slate-900 rounded-xl border border-purple-800/40 text-purple-300">
                    Uplink Orbital / VHF
                  </div>
                  <div className="p-2 bg-slate-900 rounded-xl border border-emerald-800/40 text-emerald-300">
                    Entrega SOC / Mesh
                  </div>
                </div>
              </div>

              {/* Tabela de Mensagens Retransmitidas */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 block">Histórico de Encaminhamento Cross-Medium:</span>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className="p-3 bg-slate-950 rounded-2xl border border-slate-800/80 space-y-1.5 text-xs font-mono"
                    >
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-cyan-400 font-bold">{m.sourceNodeName}</span>
                        <span className="text-slate-500">{m.timestamp}</span>
                      </div>
                      <p className="text-slate-200 font-sans">{m.content}</p>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 pt-1 border-t border-slate-900">
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 text-sky-300 border border-slate-800">
                          Canal: {m.channelUsed}
                        </span>
                        <span>Saltos: {m.hopsCount}</span>
                        <span>Latência: {m.metrics.latencyMs} ms</span>
                        <span className="text-emerald-400">CRC: {m.metrics.crcValid ? 'OK' : 'ERRO'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 6: TERMINAL TÁTICO & CHAT SUBAQUÁTICO                */}
      {/* ======================================================== */}
      {activeTab === 'chat_tactical' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-4">
            <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 flex flex-col h-[520px]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-cyan-400" />
                  <h3 className="font-bold text-sm text-slate-100">Terminal Tático Subsea</h3>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-slate-400">Transmissor:</span>
                  <select
                    value={selectedSendChannel}
                    onChange={(e) => setSelectedSendChannel(e.target.value as SubseaPhysicalChannel)}
                    className="bg-slate-950 border border-slate-700 text-cyan-300 px-2.5 py-1 rounded-xl text-xs"
                  >
                    <option value="acoustic_janus">Acústico JANUS (11.5 kHz)</option>
                    <option value="acoustic_whoi">Acústico WHOI (25 kHz)</option>
                    <option value="optical_bluecomm">Óptico BlueComm (470nm)</option>
                    <option value="em_vlf_elf">VLF Estratégico (24 kHz)</option>
                    <option value="magneto_inductive">Magneto-Indução MI</option>
                  </select>
                </div>
              </div>

              {/* Log de Mensagens do Chat */}
              <div className="flex-1 overflow-y-auto space-y-3 py-4 pr-1">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3.5 rounded-2xl border text-xs space-y-1.5 transition-all ${
                      msg.routedViaGateway
                        ? 'bg-slate-950/90 border-sky-900/50 text-slate-100'
                        : 'bg-slate-900/90 border-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-center text-[11px] font-mono">
                      <span className="font-bold text-cyan-400 flex items-center gap-1.5">
                        <Anchor className="w-3.5 h-3.5" /> {msg.sourceNodeName} ➔ {msg.targetNodeName}
                      </span>
                      <span className="text-slate-500">{msg.timestamp}</span>
                    </div>
                    <p className="text-slate-100 leading-relaxed font-sans">{msg.content}</p>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 pt-1">
                      <span className="text-emerald-400">Canal: {msg.channelUsed}</span>
                      <span>Taxa: {msg.metrics.estimatedThroughput}</span>
                      <span>Latência: {msg.metrics.latencyMs} ms</span>
                      <span className="text-sky-300">Prof: {msg.metrics.depthMeters}m</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Campo de Envio de Mensagem */}
              <div className="pt-3 border-t border-slate-800 flex gap-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendJanusPacket()}
                  placeholder="Digite mensagem tática para transmissão subaquática..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={handleSendJanusPacket}
                  disabled={!inputMessage.trim() || isPlayingAudio}
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 disabled:opacity-50 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-sky-950 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{isPlayingAudio ? 'Emitindo Som...' : 'Enviar'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Presets Rápidos e Botões Táticos */}
          <div className="lg:col-span-4 space-y-4">
            <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-3">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" /> Presets Táticos Militares
              </h3>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setInputMessage('MAYDAY SUB-ESCAPE: SSN-01 DISTRESS AT COORD LAT -23.12 LON -44.23')}
                  className="w-full text-left p-2.5 bg-slate-950 hover:bg-slate-800 border border-rose-900/50 rounded-xl text-xs text-rose-300 font-mono transition-all"
                >
                  🚨 [JANUS SOS] Emergência Submarina
                </button>

                <button
                  type="button"
                  onClick={() => setInputMessage('SITREP ALMIRANTE: PATRULHA PROFUNDA 280M. SILÊNCIO ACÚSTICO NORMAL.')}
                  className="w-full text-left p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs text-sky-300 font-mono transition-all"
                >
                  ⚓ [SITREP] Posição Submarino 280m
                </button>

                <button
                  type="button"
                  onClick={() => setInputMessage('AUV SCOUT TELEMETRY: BATTERY 82%, DEPTH 140M, SONAR SCAN COMPLETE.')}
                  className="w-full text-left p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs text-emerald-300 font-mono transition-all"
                >
                  🤖 [AUV TELEMETRY] Dados de Inspeção
                </button>

                <button
                  type="button"
                  onClick={() => setInputMessage('DART SENSOR: BOTTOM PRESSURE STABLE 85.4 BAR. NO TSUNAMI DETECTED.')}
                  className="w-full text-left p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs text-amber-300 font-mono transition-all"
                >
                  🌊 [DART SEISMIC] Alerta de Tsunami
                </button>

                <button
                  type="button"
                  onClick={() => setInputMessage('BLUECOMM UWOC: INITIATING 4K UHD VIDEO STREAM 25 MBPS TO BUOY.')}
                  className="w-full text-left p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs text-purple-300 font-mono transition-all"
                >
                  💡 [BLUECOMM UWOC] Transmissão Vídeo
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-900/70 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <span className="font-bold text-slate-300 block">Nó Selecionado:</span>
              <select
                value={selectedNodeId}
                onChange={(e) => setSelectedNodeId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2 text-xs font-mono"
              >
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} (Prof: {n.depthMeters}m)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 7: PAPERS CIENTÍFICOS & PADRÕES MILITARES            */}
      {/* ======================================================== */}
      {activeTab === 'papers' && (
        <div className="space-y-6">
          <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-2">
            <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-400" /> Biblioteca de Pesquisas & Padrões Científicos
            </h3>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Literatura técnica fundamental utilizada como base para os algoritmos de propagação acústica, óptica e eletromagnética integrados no sistema Jyy.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SCIENTIFIC_SUBSEA_PAPERS.map((paper) => (
              <div
                key={paper.id}
                className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-3 hover:border-slate-700 transition-all shadow-lg flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                      {paper.standardOrType}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">{paper.year}</span>
                  </div>

                  <h4 className="font-bold text-sm text-slate-100 leading-snug">{paper.title}</h4>

                  <div className="text-[11px] font-mono text-slate-400">
                    <span>{paper.authors}</span>
                    <span className="block text-sky-400 font-sans text-xs">{paper.organization}</span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed pt-1">{paper.summary}</p>

                  <div className="space-y-1.5 pt-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Contribuições Principais:
                    </span>
                    <ul className="space-y-1 text-[11px] text-slate-300">
                      {paper.keyContributions.map((cont, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-emerald-400 mt-0.5">▪</span>
                          <span>{cont}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <a
                    href={paper.doiOrUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 transition-colors"
                  >
                    <span>Acessar Publicação / Documentação</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
