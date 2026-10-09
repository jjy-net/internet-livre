import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Wifi,
  Radio,
  Eye,
  Shield,
  ShieldAlert,
  Activity,
  Sliders,
  Layers,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  RefreshCw,
  Cpu,
  Compass,
  Maximize2,
  Volume2,
  VolumeX,
  Target,
  Crosshair,
  Lock,
  Unlock,
  BookOpen,
  ArrowRight,
  Info,
  ExternalLink,
  Copy,
  Check,
  Terminal,
  Server,
  Usb,
  Smartphone,
  Laptop,
  HardDrive,
  Network,
  Signal,
  Power,
  Shuffle,
  Plus,
  ChevronRight,
  X,
  Filter,
  BarChart3,
  WifiOff,
  Settings,
  Search,
  Users,
  Database,
  Home,
  Globe,
  CheckCircle,
  SlidersHorizontal,
  Sparkles,
  Heart,
  Stethoscope,
  AlertOctagon,
  LifeBuoy,
  Flame,
  Brain,
  Binary,
  GitBranch,
} from 'lucide-react';
import {
  WIFI_STANDARDS_CATALOG,
  WALL_MATERIALS,
  DetectedRadarTarget,
  IntruderAlarmEvent,
  calculateDopplerShiftHz,
  generateCsiSubcarrierProfile,
  generateDensePoseSkeleton,
  DensePoseSkeleton,
  DENSEPOSE_SMPL_PARTS,
  INITIAL_BETTERCAP_APS,
  BettercapWifiAp,
  BettercapEventStreamItem,
  RUVIEW_ESP32_CSI_SKETCH,
  WifiNetwork,
  INITIAL_WIFI_NETWORKS,
  WifiDiscoveredDevice,
  INITIAL_DISCOVERED_DEVICES,
  calculateFresnelRadius,
  calculateEuclideanDistance,
  calculatePathLossDb,
  estimateDistanceMeters,
  calculateLineDisturbance,
  UserRouterProfile,
  COMMON_ROUTER_GATEWAYS,
  deriveGatewayFromLocalIp,
  VitalSignsReading,
  generateVitalSignsReading,
  MultistaticMeshLink,
  CoherenceGateState,
  generateMultistaticLinks,
  ExoticSensingTier,
  RUVIEW_EXOTIC_TIERS,
  DisasterSurvivorTarget,
  INITIAL_DISASTER_SURVIVORS,
  generateEnvironmentFingerprint128,
  RUVIEW_ESP32_TDM_MESH_SKETCH,
} from '../utils/wifiRadarEngine';

export const WifiRadarView: React.FC = () => {
  type RadarTab =
    | 'rf_camera'
    | 'vital_signs'
    | 'multistatic_mesh'
    | 'persistent_field'
    | 'disaster_triage'
    | 'self_learning'
    | 'devices_matrix'
    | 'densepose_view'
    | 'bettercap_recon'
    | 'intruder_radar'
    | 'multichannel'
    | 'ruview_firmware'
    | 'standards_ieee';

  const [activeTab, setActiveTab] = useState<RadarTab>('rf_camera');

  // ==========================================
  // CONFIGURAÇÃO DO MEU ROTEADOR PESSOAL
  // ==========================================
  const [userRouter, setUserRouter] = useState<UserRouterProfile>({
    id: 'dev_user_router',
    name: 'Meu Roteador Wi-Fi (Gateway Local)',
    ssid: 'Minha-Rede-Wi-Fi',
    gatewayIp: '192.168.1.1',
    mac: 'E8:48:B8:31:AA:01',
    vendor: 'Meu Roteador Pessoal (TP-Link / Asus / Vivo / Claro)',
    band: '5 GHz',
    channel: 36,
    txPowerDbm: 23,
    csiSupported: true,
    xMeters: 1.2,
    yMeters: 1.0,
    zMeters: 1.5,
    isAutoDetected: false,
  });
  const [isConfigureUserRouterModalOpen, setIsConfigureUserRouterModalOpen] = useState<boolean>(false);
  const [routerDetectMessage, setRouterDetectMessage] = useState<string | null>(null);

  // ==========================================
  // ESTADO DE REDE WI-FI E CONEXÃO
  // ==========================================
  const [wifiNetworks, setWifiNetworks] = useState<WifiNetwork[]>(INITIAL_WIFI_NETWORKS);
  const [activeNetwork, setActiveNetwork] = useState<WifiNetwork>(INITIAL_WIFI_NETWORKS[0]);
  const [isWifiConnected, setIsWifiConnected] = useState<boolean>(true);
  const [isScanningWifi, setIsScanningWifi] = useState<boolean>(false);
  const [isWifiModalOpen, setIsWifiModalOpen] = useState<boolean>(false);
  const [customSsidInput, setCustomSsidInput] = useState<string>('');
  const [customGatewayInput, setCustomGatewayInput] = useState<string>('192.168.1.1');

  // ==========================================
  // ESTADO DE DISPOSITIVOS DESCOBERTOS NA REDE
  // ==========================================
  const [discoveredDevices, setDiscoveredDevices] = useState<WifiDiscoveredDevice[]>(INITIAL_DISCOVERED_DEVICES);
  const [selectedTxId, setSelectedTxId] = useState<string>('dev_user_router');
  const [selectedRxId, setSelectedRxId] = useState<string>('dev_esp32_rx1');
  const [trackedTargetId, setTrackedTargetId] = useState<string>('dev_target_intruder');
  const [isScanningDevices, setIsScanningDevices] = useState<boolean>(false);
  const [deviceFilter, setDeviceFilter] = useState<'all' | 'csi_only' | 'sensors' | 'mobile' | 'routers'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // ==========================================
  // RUVIEW MULTISTATIC MESH (ADR-029)
  // ==========================================
  const [multistaticNodeIds, setMultistaticNodeIds] = useState<string[]>([
    'dev_user_router',
    'dev_esp32_rx1',
    'dev_esp32_rx2',
    'dev_laptop_jyy',
  ]);
  const [isMultistaticMeshActive, setIsMultistaticMeshActive] = useState<boolean>(true);

  // ==========================================
  // RUVIEW VITAL SIGNS (BREATHING & CARDIAC)
  // ==========================================
  const [vitalPerson1, setVitalPerson1] = useState<VitalSignsReading>(
    generateVitalSignsReading(0, 'p1', 'Pessoa 1 (Intruso Monitorado)', 18, 82)
  );
  const [vitalPerson2, setVitalPerson2] = useState<VitalSignsReading>(
    generateVitalSignsReading(0, 'p2', 'Pessoa 2 (Operador / Estação)', 14, 68)
  );

  // ==========================================
  // RUVIEW PERSISTENT FIELD (ADR-030) & 7 TIERS
  // ==========================================
  const [exoticTiers] = useState<ExoticSensingTier[]>(RUVIEW_EXOTIC_TIERS);
  const [selectedTier, setSelectedTier] = useState<number>(1);

  // ==========================================
  // RUVIEW WIFI-MAT DISASTER TRIAGE (ADR-001)
  // ==========================================
  const [disasterSurvivors, setDisasterSurvivors] = useState<DisasterSurvivorTarget[]>(INITIAL_DISASTER_SURVIVORS);

  // ==========================================
  // RUVIEW SELF-LEARNING FINGERPRINT 128D (ADR-024)
  // ==========================================
  const [environmentVector, setEnvironmentVector] = useState<number[]>(
    generateEnvironmentFingerprint128(78)
  );

  // Modais de inspeção e adição
  const [inspectedDevice, setInspectedDevice] = useState<WifiDiscoveredDevice | null>(null);
  const [isAddDeviceModalOpen, setIsAddDeviceModalOpen] = useState<boolean>(false);
  const [newDeviceForm, setNewDeviceForm] = useState({
    name: '',
    ip: '192.168.1.',
    mac: '',
    vendor: 'Espressif Systems',
    deviceType: 'esp32_sensor' as WifiDiscoveredDevice['deviceType'],
    csiCapable: true,
    xMeters: 4.0,
    yMeters: 2.0,
  });

  // ==========================================
  // ESTADO DO ALARME, PAREDE E RADAR
  // ==========================================
  const [isAlarmArmed, setIsAlarmArmed] = useState<boolean>(true);
  const [alarmSensitivity, setAlarmSensitivity] = useState<number>(65);
  const [detectionMode, setDetectionMode] = useState<'walking' | 'breathing' | 'tripwire'>('walking');
  const [selectedWallId, setSelectedWallId] = useState<string>('drywall');

  // Alvo detectado e esqueleto DensePose
  const [target, setTarget] = useState<DetectedRadarTarget>({
    id: 'target_01',
    label: 'Intruso Não Autorizado',
    xMeters: 4.5,
    yMeters: 3.8,
    isBehindWall: true,
    velocityMps: 1.15,
    dopplerShiftHz: 38.3,
    csiVariancePercent: 78,
    classification: 'HUMAN_WALKING',
    confidencePercent: 96.4,
    breathingRateBpm: 18,
    lastDetectedMsAgo: 10,
  });

  const [densePose, setDensePose] = useState<DensePoseSkeleton>(
    generateDensePoseSkeleton(380, 240, 0, true, 0.5)
  );

  // Bettercap APs e Event Stream
  const [bettercapAps] = useState<BettercapWifiAp[]>(INITIAL_BETTERCAP_APS);
  const [bettercapEvents, setBettercapEvents] = useState<BettercapEventStreamItem[]>([
    {
      id: 'ev_01',
      timestamp: '14:38:02',
      tag: 'wifi.ap.new',
      level: 'info',
      message: 'AP Ativo: Meu Roteador Wi-Fi (192.168.1.1) em CH 36 [CSI Habilitado]',
    },
    {
      id: 'ev_02',
      timestamp: '14:38:15',
      tag: 'csi.disturbance',
      level: 'warning',
      message: 'RuView Multistatic: 12 Enlaces TDM ativos. Perturbação detectada no feixe Roteador -> ESP32-S3 Alpha (+42%)',
    },
    {
      id: 'ev_03',
      timestamp: '14:38:18',
      tag: 'densepose.locked',
      level: 'critical',
      message: 'DensePose: Esqueleto humano travado atrás da parede com 17 pontos COCO (Confiança 96.4%)',
    },
  ]);

  // Histórico de Alarmes
  const [alarms] = useState<IntruderAlarmEvent[]>([
    {
      id: 'alarm_01',
      timestamp: '14:35:12',
      severity: 'CRITICAL',
      message: 'Intruso detectado em movimento atrás da parede divisória (Distúrbio CSI 78%)',
      targetCoords: { x: 4.5, y: 3.8 },
      dopplerShiftHz: 38.3,
      csiPerturbation: 78,
      classification: 'HUMAN_WALKING',
    },
  ]);

  // Modos de Visualização da Câmera RF
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rfViewMode, setRfViewMode] = useState<'densepose' | 'thermal' | 'fresnel'>('densepose');
  const [showRfBeam, setShowRfBeam] = useState<boolean>(true);
  const [showOtherNodes, setShowOtherNodes] = useState<boolean>(true);
  const [isSimulatingWalk, setIsSimulatingWalk] = useState<boolean>(true);
  const [activeFirmwareCode, setActiveFirmwareCode] = useState<'tdm_mesh' | 'classic_harvester'>('tdm_mesh');
  const [isCopiedFirmware, setIsCopiedFirmware] = useState<boolean>(false);

  // Perfil CSI
  const [csiProfile, setCsiProfile] = useState<{ subcarriers: number[]; phasesRad: number[] }>(
    generateCsiSubcarrierProfile(target.csiVariancePercent / 100)
  );

  const currentWall = WALL_MATERIALS.find((w) => w.id === selectedWallId) || WALL_MATERIALS[0];

  // Auto-Detecção do Gateway Local
  const handleDetectLocalGateway = async () => {
    try {
      const origin = window.location.origin.includes('http') ? window.location.origin : 'http://127.0.0.1:4870';
      const res = await fetch(`${origin}/api/info`);
      if (res.ok) {
        const data = await res.json();
        if (data.ips && data.ips.length > 0) {
          const primaryIp = data.ips[0];
          const detectedGateway = deriveGatewayFromLocalIp(primaryIp);

          setUserRouter((prev) => ({
            ...prev,
            gatewayIp: detectedGateway,
            isAutoDetected: true,
            name: `Meu Roteador Wi-Fi (${detectedGateway})`,
          }));

          setDiscoveredDevices((prev) =>
            prev.map((d) =>
              d.id === 'dev_user_router'
                ? { ...d, ip: detectedGateway, name: `Meu Roteador Wi-Fi (${detectedGateway})` }
                : d
            )
          );

          setRouterDetectMessage(`Gateway do seu roteador detectado na rede: ${detectedGateway}`);
          setTimeout(() => setRouterDetectMessage(null), 5000);
          return;
        }
      }
    } catch {
      // Fallback gracioso
    }
    setRouterDetectMessage(`Gateway local mantido em ${userRouter.gatewayIp} (Padrão universal)`);
    setTimeout(() => setRouterDetectMessage(null), 4000);
  };

  useEffect(() => {
    handleDetectLocalGateway();
  }, []);

  // Dispositivos TX e RX selecionados
  const txDevice = useMemo(
    () => discoveredDevices.find((d) => d.id === selectedTxId) || discoveredDevices[0],
    [discoveredDevices, selectedTxId]
  );

  const rxDevice = useMemo(
    () => discoveredDevices.find((d) => d.id === selectedRxId) || discoveredDevices[1] || discoveredDevices[0],
    [discoveredDevices, selectedRxId]
  );

  // Nós selecionados para a malha multistática
  const multistaticNodes = useMemo(() => {
    return discoveredDevices.filter((d) => multistaticNodeIds.includes(d.id));
  }, [discoveredDevices, multistaticNodeIds]);

  // Links da malha multistática (ADR-029)
  const multistaticMesh = useMemo(() => {
    return generateMultistaticLinks(multistaticNodes, { x: target.xMeters, y: target.yMeters });
  }, [multistaticNodes, target.xMeters, target.yMeters]);

  // Métricas do Par Ativo TX / RX
  const activePairMetrics = useMemo(() => {
    if (!txDevice || !rxDevice) {
      return {
        distanceM: 5.0,
        fresnelRadiusM: 0.35,
        pathLossDb: 45.0,
        perturbationScore: 35,
        isIntersecting: false,
      };
    }
    const dist = calculateEuclideanDistance(
      { x: txDevice.xMeters, y: txDevice.yMeters },
      { x: rxDevice.xMeters, y: rxDevice.yMeters }
    );
    const fresnelR = calculateFresnelRadius(dist / 2, dist / 2, dist, 5.0);
    const pathLoss = calculatePathLossDb(dist, 5.0, currentWall.attenuationDb5Ghz);
    const disturbance = calculateLineDisturbance(
      { x: txDevice.xMeters, y: txDevice.yMeters },
      { x: rxDevice.xMeters, y: rxDevice.yMeters },
      { x: target.xMeters, y: target.yMeters },
      fresnelR
    );

    return {
      distanceM: dist,
      fresnelRadiusM: fresnelR,
      pathLossDb: pathLoss,
      perturbationScore: disturbance.perturbationScore,
      isIntersecting: disturbance.isIntersectingFresnel,
    };
  }, [txDevice, rxDevice, target.xMeters, target.yMeters, currentWall.attenuationDb5Ghz]);

  // Alternar nó na malha multistática
  const handleToggleMultistaticNode = (nodeId: string) => {
    if (multistaticNodeIds.includes(nodeId)) {
      if (multistaticNodeIds.length <= 2) return; // Mínimo de 2 nós para malha
      setMultistaticNodeIds(multistaticNodeIds.filter((id) => id !== nodeId));
    } else {
      if (multistaticNodeIds.length >= 6) return; // Máximo de 6 nós para evitar sobrecarga TDM
      setMultistaticNodeIds([...multistaticNodeIds, nodeId]);
    }
  };

  // Loop de simulação física do alvo, sinais vitais e esqueleto
  useEffect(() => {
    let animAngle = 0;
    let timeElapsedSec = 0;

    const interval = setInterval(() => {
      if (!isSimulatingWalk) return;
      animAngle += 0.04;
      timeElapsedSec += 0.1;

      const x = 4.2 + Math.cos(animAngle * 1.5) * 1.6;
      const y = 3.6 + Math.sin(animAngle) * 1.2;
      const vx = Math.abs(Math.sin(animAngle * 1.5)) * 1.2 + 0.2;
      const doppler = calculateDopplerShiftHz(vx, 5.0);

      // Calcular perturbação real com o par TX/RX selecionado
      const distInfo = calculateLineDisturbance(
        { x: txDevice.xMeters, y: txDevice.yMeters },
        { x: rxDevice.xMeters, y: rxDevice.yMeters },
        { x, y },
        activePairMetrics.fresnelRadiusM
      );
      const disturbance = distInfo.perturbationScore;
      const breathing = Math.sin(animAngle * 3) * 0.5 + 0.5;

      // Atualizar sinais vitais RuView (Pessoa 1 e Pessoa 2)
      setVitalPerson1(generateVitalSignsReading(timeElapsedSec, 'p1', 'Intruso / Alvo Monitorado', 18 + Math.sin(animAngle) * 3, 84 + Math.sin(animAngle * 2) * 8));
      setVitalPerson2(generateVitalSignsReading(timeElapsedSec, 'p2', 'Operador Local (Jyy Station)', 14, 68));

      // Atualizar vetor 128D
      setEnvironmentVector(generateEnvironmentFingerprint128(disturbance));

      setTarget((prev) => ({
        ...prev,
        xMeters: Math.round(x * 100) / 100,
        yMeters: Math.round(y * 100) / 100,
        velocityMps: Math.round(vx * 100) / 100,
        dopplerShiftHz: doppler,
        csiVariancePercent: disturbance,
        isBehindWall: y > 2.5,
        classification: vx > 0.3 ? 'HUMAN_WALKING' : 'HUMAN_BREATHING',
        confidencePercent: Math.round((88 + Math.random() * 11) * 10) / 10,
        breathingRateBpm: Math.round(16 + Math.sin(animAngle * 2) * 3),
      }));

      // Atualizar Esqueleto DensePose baseado no Canvas (escala 8m x 6m)
      const screenX = (x / 8) * 960;
      const screenY = (y / 6) * 480;
      setDensePose(generateDensePoseSkeleton(screenX, screenY, animAngle, vx > 0.3, breathing));

      // Atualizar Subportadoras CSI com ruído dinâmico
      setCsiProfile(generateCsiSubcarrierProfile(disturbance / 100));
    }, 100);

    return () => clearInterval(interval);
  }, [isSimulatingWalk, txDevice, rxDevice, activePairMetrics.fresnelRadiusM]);

  // ==========================================
  // RENDERIZAÇÃO DO CANVAS HOLOGRÁFICO
  // ==========================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let wavePulse = 0;

    const render = () => {
      wavePulse += 0.05;
      const w = canvas.width;
      const h = canvas.height;

      // Fundo escuro cibernético
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, w, h);

      // Grade tática com escala em metros
      ctx.save();
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.lineWidth = 1;
      const gridStepX = w / 8;
      const gridStepY = h / 6;

      for (let x = 0; x <= w; x += gridStepX) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += gridStepY) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Marcadores métricos nos eixos
      ctx.fillStyle = 'rgba(100, 116, 139, 0.5)';
      ctx.font = '9px monospace';
      for (let i = 0; i <= 8; i++) {
        ctx.fillText(`${i}m`, i * gridStepX + 4, 12);
      }
      for (let j = 1; j <= 6; j++) {
        ctx.fillText(`${j}m`, 4, j * gridStepY - 4);
      }

      const scaleX = w / 8;
      const scaleY = h / 6;

      // PAREDE DIVISÓRIA (Y = 2.5m)
      const wallY = 2.5 * scaleY;
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(0, wallY);
      ctx.lineTo(2.0 * scaleX, wallY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(3.4 * scaleX, wallY);
      ctx.lineTo(w, wallY);
      ctx.stroke();

      // Porta / Fresta de Rádio entre 2.0m e 3.4m
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(2.0 * scaleX, wallY);
      ctx.lineTo(3.4 * scaleX, wallY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText(
        `PAREDE: ${currentWall.name.split(' ')[0]} (-${currentWall.attenuationDb5Ghz} dB)`,
        3.6 * scaleX,
        wallY - 10
      );

      // DESENHAR MALHA MULTISTÁTICA COMPLETA SE ATIVA (ADR-029)
      if (isMultistaticMeshActive && multistaticMesh.links.length > 0) {
        ctx.save();
        multistaticMesh.links.forEach((link) => {
          const fromDev = discoveredDevices.find((d) => d.id === link.txDeviceId);
          const toDev = discoveredDevices.find((d) => d.id === link.rxDeviceId);
          if (!fromDev || !toDev) return;

          const p1 = { x: fromDev.xMeters * scaleX, y: fromDev.yMeters * scaleY };
          const p2 = { x: toDev.xMeters * scaleX, y: toDev.yMeters * scaleY };

          ctx.strokeStyle = link.isIntersected
            ? 'rgba(244, 63, 94, 0.7)'
            : 'rgba(6, 182, 212, 0.25)';
          ctx.lineWidth = link.isIntersected ? 2.5 : 1;
          ctx.setLineDash(link.isIntersected ? [] : [2, 4]);

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        });
        ctx.setLineDash([]);
        ctx.restore();
      }

      // POSIÇÕES EM TELA DOS NÓS SELECIONADOS TX E RX
      const txScreen = { x: txDevice.xMeters * scaleX, y: txDevice.yMeters * scaleY };
      const rxScreen = { x: rxDevice.xMeters * scaleX, y: rxDevice.yMeters * scaleY };

      // OUTROS NÓS DA REDE (SE HABILITADO)
      if (showOtherNodes) {
        discoveredDevices.forEach((dev) => {
          if (dev.id === txDevice.id || dev.id === rxDevice.id) return;
          const devX = dev.xMeters * scaleX;
          const devY = dev.yMeters * scaleY;
          const inMesh = multistaticNodeIds.includes(dev.id);

          ctx.fillStyle = inMesh ? 'rgba(16, 185, 129, 0.7)' : 'rgba(71, 85, 105, 0.4)';
          ctx.beginPath();
          ctx.arc(devX, devY, inMesh ? 6 : 5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = inMesh ? '#10b981' : 'rgba(148, 163, 184, 0.6)';
          ctx.font = '8px monospace';
          ctx.fillText(dev.name.split(' ')[0] + (inMesh ? ' [MESH]' : ''), devX + 8, devY + 3);
        });
      }

      // FEIXE DE MICROONDAS ENTRE TX E RX SELECIONADOS
      if (showRfBeam) {
        ctx.save();

        // 1. Linha do Feixe Central
        const isInterrupted = activePairMetrics.isIntersecting;
        const beamColor = isInterrupted ? 'rgba(244, 63, 94, 0.85)' : 'rgba(6, 182, 212, 0.7)';
        ctx.strokeStyle = beamColor;
        ctx.lineWidth = isInterrupted ? 3 : 2;
        ctx.shadowColor = beamColor;
        ctx.shadowBlur = isInterrupted ? 14 : 8;

        ctx.beginPath();
        ctx.moveTo(txScreen.x, txScreen.y);
        ctx.lineTo(rxScreen.x, rxScreen.y);
        ctx.stroke();

        // 2. Ondas senoidais viajando ao longo do feixe
        const dx = rxScreen.x - txScreen.x;
        const dy = rxScreen.y - txScreen.y;
        const beamLen = Math.sqrt(dx * dx + dy * dy);
        const normalX = -dy / beamLen;
        const normalY = dx / beamLen;

        ctx.beginPath();
        ctx.strokeStyle = isInterrupted ? 'rgba(251, 146, 60, 0.7)' : 'rgba(16, 185, 129, 0.6)';
        ctx.lineWidth = 1.5;
        const segments = 40;
        for (let i = 0; i <= segments; i++) {
          const t = i / segments;
          const px = txScreen.x + dx * t;
          const py = txScreen.y + dy * t;
          const sineAmp = (isInterrupted ? 12 : 6) * Math.sin(t * Math.PI * 8 - wavePulse * 4);
          const waveX = px + normalX * sineAmp;
          const waveY = py + normalY * sineAmp;
          if (i === 0) ctx.moveTo(waveX, waveY);
          else ctx.lineTo(waveX, waveY);
        }
        ctx.stroke();

        // 3. Elipse da 1ª Zona de Fresnel calculada geometricamente
        if (rfViewMode === 'fresnel') {
          ctx.save();
          const midX = (txScreen.x + rxScreen.x) / 2;
          const midY = (txScreen.y + rxScreen.y) / 2;
          const angle = Math.atan2(dy, dx);
          const fresnelRadiusPx = activePairMetrics.fresnelRadiusM * scaleX;

          ctx.translate(midX, midY);
          ctx.rotate(angle);
          ctx.strokeStyle = isInterrupted ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.35)';
          ctx.fillStyle = isInterrupted ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.04)';
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(0, 0, beamLen / 2, fresnelRadiusPx * 2.2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        ctx.restore();
      }

      // NÓ TX (EMISSOR) - ANÉIS EXPANSIVOS DE MICROONDAS
      ctx.save();
      const txWaveR = (wavePulse * 28) % 120;
      ctx.strokeStyle = `rgba(6, 182, 212, ${Math.max(0, 0.5 - txWaveR / 150)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(txScreen.x, txScreen.y, txWaveR, 0, Math.PI * 2);
      ctx.stroke();

      // Ícone do TX
      const isUserRouterTx = txDevice.id === 'dev_user_router';
      ctx.fillStyle = isUserRouterTx ? '#10b981' : '#06b6d4';
      ctx.shadowColor = isUserRouterTx ? '#10b981' : '#06b6d4';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(txScreen.x, txScreen.y, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.shadowBlur = 0;
      ctx.fillText(
        isUserRouterTx ? `TX: MEU ROTEADOR` : `TX: ${txDevice.name.split(' ')[0]}`,
        txScreen.x - 30,
        txScreen.y - 14
      );
      ctx.fillStyle = isUserRouterTx ? 'rgba(16, 185, 129, 0.9)' : 'rgba(6, 182, 212, 0.9)';
      ctx.fillText(`(${txDevice.ip})`, txScreen.x - 30, txScreen.y - 4);
      ctx.restore();

      // NÓ RX (RECEPTOR) - MIRA DE CAPTURA CSI
      ctx.save();
      ctx.strokeStyle = '#10b981';
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 10;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(rxScreen.x, rxScreen.y, 9, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(rxScreen.x, rxScreen.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#10b981';
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.shadowBlur = 0;
      ctx.fillText(`RX: ${rxDevice.name.split(' ')[0]}`, rxScreen.x - 30, rxScreen.y + 20);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
      ctx.fillText(`(${rxDevice.ip})`, rxScreen.x - 30, rxScreen.y + 30);
      ctx.restore();

      // ALVO / INTRUSO NO PERÍMETRO
      const targetScreenX = target.xMeters * scaleX;
      const targetScreenY = target.yMeters * scaleY;

      // MODO TÉRMICO RF
      if (rfViewMode === 'thermal') {
        const heatGrad = ctx.createRadialGradient(
          targetScreenX,
          targetScreenY,
          2,
          targetScreenX,
          targetScreenY,
          50
        );
        heatGrad.addColorStop(0, 'rgba(239, 68, 68, 0.8)');
        heatGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.4)');
        heatGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = heatGrad;
        ctx.beginPath();
        ctx.arc(targetScreenX, targetScreenY, 50, 0, Math.PI * 2);
        ctx.fill();
      }

      // MODO DENSEPOSE & ESQUELETO 3D
      if (rfViewMode === 'densepose' || rfViewMode === 'thermal') {
        ctx.save();
        const joints = densePose.joints;
        const findJoint = (name: string) => joints.find((j) => j.name === name);

        // Segmentos ósseos com cor reativa (vermelho se interceptando o feixe)
        const isInter = activePairMetrics.isIntersecting;
        ctx.strokeStyle = isInter ? '#f43f5e' : target.isBehindWall ? '#06b6d4' : '#10b981';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = isInter ? '#f43f5e' : target.isBehindWall ? '#06b6d4' : '#10b981';
        ctx.shadowBlur = 10;

        const bones: [string, string][] = [
          ['Left_Ear', 'Left_Eye'],
          ['Right_Ear', 'Right_Eye'],
          ['Left_Eye', 'Nose'],
          ['Right_Eye', 'Nose'],
          ['Left_Shoulder', 'Right_Shoulder'],
          ['Left_Shoulder', 'Left_Elbow'],
          ['Left_Elbow', 'Left_Wrist'],
          ['Right_Shoulder', 'Right_Elbow'],
          ['Right_Elbow', 'Right_Wrist'],
          ['Left_Shoulder', 'Left_Hip'],
          ['Right_Shoulder', 'Right_Hip'],
          ['Left_Hip', 'Right_Hip'],
          ['Left_Hip', 'Left_Knee'],
          ['Left_Knee', 'Left_Ankle'],
          ['Right_Hip', 'Right_Knee'],
          ['Right_Knee', 'Right_Ankle'],
        ];

        bones.forEach(([j1, j2]) => {
          const p1 = findJoint(j1);
          const p2 = findJoint(j2);
          if (p1 && p2) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        });

        // Articulações individuais brilhantes
        joints.forEach((joint) => {
          ctx.fillStyle = isInter ? '#fb7185' : '#a7f3d0';
          ctx.beginPath();
          ctx.arc(joint.x, joint.y, 3, 0, Math.PI * 2);
          ctx.fill();
        });

        // Caixa delimitadora 3D holográfica (Bounding Box)
        ctx.strokeStyle = isInter ? 'rgba(244, 63, 94, 0.6)' : 'rgba(6, 182, 212, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        const boxW = 60;
        const boxH = 110;
        ctx.strokeRect(targetScreenX - boxW / 2, targetScreenY - boxH / 2, boxW, boxH);
        ctx.setLineDash([]);

        // Rótulos holográficos flutuantes com sinais vitais
        ctx.fillStyle = isInter ? '#f43f5e' : '#38bdf8';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(
          `${target.label.toUpperCase()} [${target.xMeters}m, ${target.yMeters}m]`,
          targetScreenX - boxW / 2,
          targetScreenY - boxH / 2 - 8
        );
        ctx.fillStyle = '#94a3b8';
        ctx.font = '8px monospace';
        ctx.fillText(
          `Respiração: ${vitalPerson1.breathingRateBpm} BPM | Cardíaco: ${vitalPerson1.heartRateBpm} BPM`,
          targetScreenX - boxW / 2,
          targetScreenY + boxH / 2 + 12
        );

        ctx.restore();
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [
    rfViewMode,
    showRfBeam,
    showOtherNodes,
    isMultistaticMeshActive,
    multistaticMesh,
    multistaticNodeIds,
    densePose,
    target,
    txDevice,
    rxDevice,
    discoveredDevices,
    activePairMetrics,
    currentWall,
    vitalPerson1,
  ]);

  // Manipulador de troca de par TX <-> RX
  const handleSwapPair = () => {
    const temp = selectedTxId;
    setSelectedTxId(selectedRxId);
    setSelectedRxId(temp);
  };

  // Manipulador de Conexão Wi-Fi
  const handleConnectWifi = (net: WifiNetwork) => {
    setIsWifiConnected(true);
    setActiveNetwork(net);
    setIsWifiModalOpen(false);
    setBettercapEvents((prev) => [
      {
        id: `ev_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        tag: 'wifi.ap.new',
        level: 'info',
        message: `Conectado à rede Wi-Fi: ${net.ssid} (${net.bssid}) em ${net.frequencyGhz}`,
      },
      ...prev,
    ]);
  };

  // Manipulador de Desconexão Wi-Fi
  const handleDisconnectWifi = () => {
    setIsWifiConnected(false);
    setBettercapEvents((prev) => [
      {
        id: `ev_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        tag: 'wifi.ap.new',
        level: 'warning',
        message: 'Interface Wi-Fi desconectada da rede local.',
      },
      ...prev,
    ]);
  };

  // Escanear redes Wi-Fi
  const handleScanWifi = () => {
    setIsScanningWifi(true);
    setTimeout(() => {
      setIsScanningWifi(false);
    }, 1200);
  };

  // Escanear dispositivos clientes na rede
  const handleScanDevices = () => {
    setIsScanningDevices(true);
    setTimeout(() => {
      setIsScanningDevices(false);
    }, 1500);
  };

  // Copiar Firmware
  const handleCopyFirmware = () => {
    const code = activeFirmwareCode === 'tdm_mesh' ? RUVIEW_ESP32_TDM_MESH_SKETCH : RUVIEW_ESP32_CSI_SKETCH;
    navigator.clipboard.writeText(code);
    setIsCopiedFirmware(true);
    setTimeout(() => setIsCopiedFirmware(false), 2000);
  };

  // Adicionar Dispositivo Manualmente
  const handleAddDeviceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceForm.name || !newDeviceForm.ip) return;

    const newDev: WifiDiscoveredDevice = {
      id: `dev_custom_${Date.now()}`,
      name: newDeviceForm.name,
      ip: newDeviceForm.ip,
      mac: newDeviceForm.mac || 'AA:BB:CC:DD:EE:FF',
      vendor: newDeviceForm.vendor,
      deviceType: newDeviceForm.deviceType,
      rssiDbm: -52,
      channel: 36,
      band: '5 GHz',
      csiCapable: newDeviceForm.csiCapable,
      role: 'IDLE',
      distanceMeters: 4.0,
      linkSpeedMbps: 150,
      txPowerDbm: 18,
      csiPacketRateHz: newDeviceForm.csiCapable ? 300 : 0,
      isOnline: true,
      xMeters: Number(newDeviceForm.xMeters),
      yMeters: Number(newDeviceForm.yMeters),
      zMeters: 1.2,
      lastSeenSecAgo: 0,
      statusNote: 'Nó cadastrado manualmente para o cluster de radar.',
    };

    setDiscoveredDevices((prev) => [...prev, newDev]);
    setIsAddDeviceModalOpen(false);
    setNewDeviceForm({
      name: '',
      ip: '192.168.1.',
      mac: '',
      vendor: 'Espressif Systems',
      deviceType: 'esp32_sensor',
      csiCapable: true,
      xMeters: 4.0,
      yMeters: 2.0,
    });
  };

  // Atualizar / Salvar Configuração do Meu Roteador
  const handleSaveUserRouter = (e: React.FormEvent) => {
    e.preventDefault();
    setDiscoveredDevices((prev) =>
      prev.map((dev) =>
        dev.id === 'dev_user_router'
          ? {
              ...dev,
              name: userRouter.name,
              ip: userRouter.gatewayIp,
              vendor: userRouter.vendor,
              band: userRouter.band,
              channel: userRouter.channel,
              txPowerDbm: userRouter.txPowerDbm,
              xMeters: userRouter.xMeters,
              yMeters: userRouter.yMeters,
              statusNote: `Seu roteador físico (${userRouter.vendor}) configurado no gateway ${userRouter.gatewayIp}.`,
            }
          : dev
      )
    );

    setWifiNetworks((prev) =>
      prev.map((net) =>
        net.id === 'net_user_own'
          ? {
              ...net,
              ssid: userRouter.ssid,
              gatewayIp: userRouter.gatewayIp,
            }
          : net
      )
    );

    setSelectedTxId('dev_user_router');
    setIsConfigureUserRouterModalOpen(false);

    setBettercapEvents((prev) => [
      {
        id: `ev_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        tag: 'wifi.ap.new',
        level: 'info',
        message: `Roteador Pessoal ativado como TX: ${userRouter.name} [Gateway: ${userRouter.gatewayIp}]`,
      },
      ...prev,
    ]);
  };

  // Dispositivos filtrados
  const filteredDevices = useMemo(() => {
    return discoveredDevices.filter((d) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = d.name.toLowerCase().includes(q);
        const matchesIp = d.ip.toLowerCase().includes(q);
        const matchesMac = d.mac.toLowerCase().includes(q);
        const matchesVendor = d.vendor.toLowerCase().includes(q);
        if (!matchesName && !matchesIp && !matchesMac && !matchesVendor) return false;
      }
      if (deviceFilter === 'csi_only') return d.csiCapable;
      if (deviceFilter === 'sensors') return d.deviceType === 'esp32_sensor';
      if (deviceFilter === 'mobile') return d.deviceType === 'smartphone' || d.deviceType === 'laptop';
      if (deviceFilter === 'routers') return d.deviceType === 'router';
      return true;
    });
  }, [discoveredDevices, searchQuery, deviceFilter]);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* ======================================================== */}
      {/* 1. CABEÇALHO CYBER-SOC COM STATUS DA REDE WI-FI         */}
      {/* ======================================================== */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-6 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono uppercase tracking-wider flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-cyan-400" /> π RuView: WiFi DensePose (v1.85+)
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono flex items-center gap-1">
                <Heart className="w-3 h-3" /> Sinais Vitais (Respiração + Cardíaco)
              </span>
              <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-[10px] font-mono">
                Multistatic Mesh (ADR-029)
              </span>
              <span className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-mono">
                WiFi-Mat Triage (ADR-001)
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Radar Wi-Fi & Visão Holográfica por Rádio (π RuView)</span>
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Enxergue pessoas através de paredes, monitore respiração e batimentos cardíacos sem câmeras ou wearables.
              Conecte-se ao <strong>seu roteador Wi-Fi</strong> ou selecione dispositivos da rede para formar a malha de radiofrequência CSI.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsWifiModalOpen(true)}
              className="px-3.5 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-cyan-300 transition-all flex items-center gap-2 shadow-md"
            >
              <Network className="w-4 h-4 text-cyan-400" />
              <span>Gerenciar Wi-Fi</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAlarmArmed(!isAlarmArmed)}
              className={`px-4 py-2.5 rounded-2xl font-bold text-xs transition-all flex items-center gap-2 shadow-lg ${
                isAlarmArmed
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {isAlarmArmed ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              <span>{isAlarmArmed ? 'Radar Armado' : 'Radar Desarmado'}</span>
            </button>
          </div>
        </div>

        {/* BARRA INFORMATIVA DE REDE CONECTADA */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isWifiConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-slate-400">STATUS:</span>
              <span className={isWifiConnected ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                {isWifiConnected ? `CONECTADO: ${activeNetwork.ssid}` : 'DESCONECTADO'}
              </span>
            </div>
            {isWifiConnected && (
              <>
                <span className="text-slate-600">|</span>
                <span className="text-cyan-400">{activeNetwork.frequencyGhz}</span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-300">Gateway: {activeNetwork.gatewayIp}</span>
                <span className="text-slate-600">|</span>
                <span className="text-purple-400">{activeNetwork.phyMode}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleScanDevices}
              disabled={isScanningDevices}
              className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isScanningDevices ? 'animate-spin' : ''}`} />
              <span>{isScanningDevices ? 'Escaneando Clientes...' : 'Escanear Dispositivos'}</span>
            </button>
            <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400 text-[11px]">
              {discoveredDevices.length} Nós Detectados
            </span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. CARD EXCLUSIVO: MEU ROTEADOR WI-FI PESSOAL (TX)       */}
      {/* ======================================================== */}
      <div className="p-5 rounded-3xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/25 via-slate-900 to-cyan-950/25 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">Meu Roteador Wi-Fi Físico (Gateway da sua Rede)</h3>
                {selectedTxId === 'dev_user_router' ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 text-[10px] font-mono font-bold flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> ATIVO COMO TRANSMISSOR (TX)
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-mono">
                    Standby
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 leading-tight">
                Emite ondas de rádio contínuas na sua casa ou escritório para que os sensores RX analisem a reflexão nas paredes.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedTxId('dev_user_router')}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold font-mono transition-all flex items-center gap-1.5 shadow-md ${
                selectedTxId === 'dev_user_router'
                  ? 'bg-emerald-500 text-slate-950 cursor-default'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>{selectedTxId === 'dev_user_router' ? 'Meu Roteador é o TX Atual' : 'Usar Meu Roteador como TX'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsConfigureUserRouterModalOpen(true)}
              className="px-3.5 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
              <span>Configurar Meu Roteador</span>
            </button>

            <button
              type="button"
              onClick={handleDetectLocalGateway}
              className="px-3 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-mono transition-all flex items-center gap-1.5"
              title="Detectar automaticamente o IP do gateway do seu roteador"
            >
              <Search className="w-3.5 h-3.5 text-emerald-400" />
              <span>Auto-Detectar IP</span>
            </button>

            <a
              href={`http://${userRouter.gatewayIp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs font-mono transition-all flex items-center gap-1"
              title="Abrir página de configuração interna do roteador"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>http://{userRouter.gatewayIp}</span>
            </a>
          </div>
        </div>

        {/* Notificação de Auto-Detecção */}
        {routerDetectMessage && (
          <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{routerDetectMessage}</span>
          </div>
        )}

        {/* Mini-Badges Informativas do Roteador */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-800/80 text-xs font-mono">
          <div className="p-2 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <span className="text-slate-500 block text-[10px]">Gateway IP:</span>
            <strong className="text-emerald-400">{userRouter.gatewayIp}</strong>
          </div>
          <div className="p-2 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <span className="text-slate-500 block text-[10px]">Nome / Modelo:</span>
            <span className="text-slate-200 truncate block">{userRouter.name}</span>
          </div>
          <div className="p-2 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <span className="text-slate-500 block text-[10px]">Frequência:</span>
            <span className="text-cyan-400">{userRouter.band} (CH {userRouter.channel})</span>
          </div>
          <div className="p-2 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <span className="text-slate-500 block text-[10px]">Potência TX:</span>
            <span className="text-amber-400">{userRouter.txPowerDbm} dBm (200 mW)</span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. CARD DO PAR CSI ATIVO: ESCOLHA DE DISPOSITIVOS TX & RX */}
      {/* ======================================================== */}
      <div className="p-5 bg-slate-900/80 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-sm text-slate-100">
              Par de Sensoriamento de Rádio CSI (TX & RX Ativos)
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Selecione quais dispositivos formam o enlace de microondas para a visão holográfica
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Card TX (Emissor) */}
          <div className="md:col-span-4 p-4 rounded-2xl bg-slate-950 border border-cyan-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold flex items-center gap-1">
                <Zap className="w-3 h-3 text-cyan-400" /> NÓ EMISSOR (TX)
              </span>
              <span className="text-[10px] font-mono text-slate-400">{txDevice.band}</span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="tx-select" className="text-[11px] text-slate-400 block font-mono">Dispositivo Transmissor:</label>
                {selectedTxId !== 'dev_user_router' && (
                  <button
                    type="button"
                    onClick={() => setSelectedTxId('dev_user_router')}
                    className="text-[10px] text-emerald-400 hover:underline font-mono flex items-center gap-1"
                  >
                    <Home className="w-3 h-3" /> Usar Meu Roteador
                  </button>
                )}
              </div>
              <select
                id="tx-select"
                aria-label="Dispositivo Transmissor"
                value={selectedTxId}
                onChange={(e) => setSelectedTxId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-cyan-300 px-3 py-1.5 rounded-xl text-xs font-semibold focus:outline-none focus:border-cyan-500"
              >
                <option value="dev_user_router">
                  ⭐ [MEU ROTEADOR] {userRouter.name} ({userRouter.gatewayIp})
                </option>
                {discoveredDevices
                  .filter((dev) => dev.id !== 'dev_user_router')
                  .map((dev) => (
                    <option key={dev.id} value={dev.id} disabled={dev.id === selectedRxId}>
                      {dev.name} ({dev.ip})
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-900">
              <span>MAC: {txDevice.mac}</span>
              <span className="text-cyan-400">Potência: {txDevice.txPowerDbm} dBm</span>
            </div>
          </div>

          {/* Vetor Central de Enlace & Métricas de Feixe */}
          <div className="md:col-span-4 p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleSwapPair}
                title="Inverter papéis TX e RX"
                className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-all flex items-center gap-1 text-[11px] font-mono"
              >
                <Shuffle className="w-3.5 h-3.5 text-cyan-400" />
                <span>Inverter TX / RX</span>
              </button>
            </div>

            <div className="space-y-1 text-xs font-mono">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Distância do Enlace:</span>
                <strong className="text-white">{activePairMetrics.distanceM} m</strong>
              </div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>1ª Zona de Fresnel:</span>
                <strong className="text-emerald-400">Raio {activePairMetrics.fresnelRadiusM} m</strong>
              </div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Atenuação de Trajeto:</span>
                <strong className="text-amber-400">{activePairMetrics.pathLossDb} dB</strong>
              </div>
            </div>

            <div className={`p-2 rounded-xl text-[11px] font-mono border ${
              activePairMetrics.isIntersecting
                ? 'bg-rose-950/40 border-rose-500/50 text-rose-300 animate-pulse'
                : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
            }`}>
              {activePairMetrics.isIntersecting
                ? 'ALERTA: Alvo Interrompendo Feixe TX->RX!'
                : 'FEIXE LIMPO: Baseline Estável'}
            </div>
          </div>

          {/* Card RX (Receptor) */}
          <div className="md:col-span-4 p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold flex items-center gap-1">
                <Target className="w-3 h-3 text-emerald-400" /> NÓ RECEPTOR (RX)
              </span>
              <span className="text-[10px] font-mono text-emerald-400">CSI 64-Ch</span>
            </div>

            <div className="space-y-1">
              <label htmlFor="rx-select" className="text-[11px] text-slate-400 block font-mono">Dispositivo Receptor:</label>
              <select
                id="rx-select"
                aria-label="Dispositivo Receptor"
                value={selectedRxId}
                onChange={(e) => setSelectedRxId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-500"
              >
                {discoveredDevices.map((dev) => (
                  <option key={dev.id} value={dev.id} disabled={dev.id === selectedTxId}>
                    {dev.name} ({dev.ip})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-900">
              <span>MAC: {rxDevice.mac}</span>
              <span className="text-emerald-400">Taxa: {rxDevice.csiPacketRateHz} frames/s</span>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. NAVEGAÇÃO ENTRE ABAS DO SISTEMA                      */}
      {/* ======================================================== */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-800/80 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('rf_camera')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'rf_camera'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Eye className="w-4 h-4 text-cyan-300" />
          <span>Câmera & Tomografia RF</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('vital_signs')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'vital_signs'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Heart className="w-4 h-4 text-rose-400" />
          <span>Sinais Vitais (RuView)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('multistatic_mesh')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'multistatic_mesh'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <GitBranch className="w-4 h-4 text-purple-300" />
          <span>Malha Multistática (ADR-029)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('persistent_field')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'persistent_field'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Compass className="w-4 h-4 text-amber-300" />
          <span>Modelo de Campo & 7 Tiers</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('disaster_triage')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'disaster_triage'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <LifeBuoy className="w-4 h-4 text-emerald-300" />
          <span>Resgate & Triagem START</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('self_learning')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'self_learning'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Brain className="w-4 h-4 text-sky-300" />
          <span>IA Auto-Aprendizagem (128D)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('devices_matrix')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'devices_matrix'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Network className="w-4 h-4 text-emerald-300" />
          <span>Dispositivos & Enlaces</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('densepose_view')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'densepose_view'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Cpu className="w-4 h-4 text-emerald-300" />
          <span>DensePose (24 Partes)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ruview_firmware')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'ruview_firmware'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Terminal className="w-4 h-4 text-sky-300" />
          <span>Firmware RuView (ESP32)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('standards_ieee')}
          className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'standards_ieee'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <BookOpen className="w-4 h-4 text-indigo-300" />
          <span>Papers & Doutrina</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* ABA 1: CÂMERA DE ONDAS DE RÁDIO COM DENSEPOSE            */}
      {/* ======================================================== */}
      {activeTab === 'rf_camera' && (
        <div className="space-y-6">
          <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
            {/* HUD Superior sobre o Canvas */}
            <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-slate-700/60 text-xs font-mono shadow-lg">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-cyan-400 font-bold">HOLOGRAFIA RF RUVIEW</span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-300">
                TX: {txDevice.id === 'dev_user_router' ? 'MEU ROTEADOR' : txDevice.name.split(' ')[0]}
              </span>
              <span className="text-cyan-400">&rarr;</span>
              <span className="text-emerald-400">RX: {rxDevice.name.split(' ')[0]}</span>
              <span className="text-slate-500">|</span>
              <span className="text-rose-400">Distúrbio: {target.csiVariancePercent}%</span>
              <span className="text-slate-500">|</span>
              <span className="text-emerald-400">DensePose Lock: {target.confidencePercent}%</span>
            </div>

            {/* Canvas Principal */}
            <canvas
              ref={canvasRef}
              width={960}
              height={480}
              className="w-full h-[420px] md:h-[500px] object-cover"
            />

            {/* HUD Inferior de Controles */}
            <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 bg-slate-950/90 backdrop-blur-md p-3.5 rounded-2xl border border-slate-800 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRfViewMode('densepose')}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                    rfViewMode === 'densepose'
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  Modo DensePose (Esqueleto UV)
                </button>

                <button
                  type="button"
                  onClick={() => setRfViewMode('thermal')}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                    rfViewMode === 'thermal'
                      ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  Modo Térmico RF
                </button>

                <button
                  type="button"
                  onClick={() => setRfViewMode('fresnel')}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                    rfViewMode === 'fresnel'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  Zonas de Fresnel
                </button>

                <button
                  type="button"
                  onClick={() => setIsMultistaticMeshActive(!isMultistaticMeshActive)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                    isMultistaticMeshActive
                      ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  Malha 360° ({multistaticMesh.links.length} Enlaces)
                </button>

                <button
                  type="button"
                  onClick={() => setIsSimulatingWalk(!isSimulatingWalk)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 transition-all"
                >
                  {isSimulatingWalk ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isSimulatingWalk ? 'Pausar Alvo' : 'Mover Alvo'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-slate-400">Material da Parede:</span>
                <select
                  value={selectedWallId}
                  onChange={(e) => setSelectedWallId(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-cyan-300 px-2.5 py-1 rounded-xl text-xs"
                >
                  {WALL_MATERIALS.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.radarTransparency})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 2: SINAIS VITAIS (BREATHING & HEART RATE)            */}
      {/* ======================================================== */}
      {activeTab === 'vital_signs' && (
        <div className="space-y-6">
          <div className="p-5 bg-slate-900/80 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <Heart className="w-5 h-5 text-rose-500 animate-pulse" /> Monitoramento de Sinais Vitais por Rádio Wi-Fi
                </h3>
                <p className="text-xs text-slate-300">
                  Filtros de banda passa-faixa (0.1-0.5 Hz para respiração e 0.8-2.0 Hz para batimentos cardíacos) captando micro-movimentos torácicos através de paredes sem nenhum dispositivo no corpo.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
                SNR Respiratório: &gt; 14 dB (Sensibilidade de 30mm RMS)
              </span>
            </div>

            {/* Cards de Sinais Vitais por Pessoa */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Pessoa 1 (Intruso Monitorado) */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-rose-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-white flex items-center gap-2">
                      <Target className="w-4 h-4 text-rose-400" /> {vitalPerson1.label}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">Atrás da Parede divisória | Enlace Wi-Fi CSI</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono text-[10px]">
                    Status: {vitalPerson1.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400 text-[10px] block font-mono">Taxa Respiratória</span>
                    <strong className="text-2xl text-cyan-400 font-black font-mono">
                      {vitalPerson1.breathingRateBpm}
                    </strong>
                    <span className="text-[10px] text-slate-500 block">Respirações / Min (BPM)</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400 text-[10px] block font-mono">Frequência Cardíaca</span>
                    <strong className="text-2xl text-rose-400 font-black font-mono">
                      {vitalPerson1.heartRateBpm}
                    </strong>
                    <span className="text-[10px] text-slate-500 block">Batimentos / Min (BPM)</span>
                  </div>
                </div>

                {/* Gráfico do Pneumograma (Respiração) */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span>Pneumograma (Filtro 0.1 - 0.5 Hz):</span>
                    <span className="text-cyan-400">6-30 BPM normal</span>
                  </div>
                  <div className="h-16 bg-slate-900 rounded-xl border border-slate-800 flex items-center gap-0.5 p-2">
                    {vitalPerson1.breathingWaveform.map((val, idx) => (
                      <div
                        key={idx}
                        className="flex-1 bg-cyan-400 rounded-full transition-all duration-75"
                        style={{ height: `${Math.min(100, Math.max(10, Math.abs(val) * 1.5))}%` }}
                      />
                    ))}
                  </div>
                </div>

                {/* Gráfico do Balistocardiograma (Coração) */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span>Balistocardiograma Micro-Doppler (0.8 - 2.0 Hz):</span>
                    <span className="text-rose-400">40-120 BPM</span>
                  </div>
                  <div className="h-16 bg-slate-900 rounded-xl border border-slate-800 flex items-center gap-0.5 p-2">
                    {vitalPerson1.cardiacWaveform.map((val, idx) => (
                      <div
                        key={idx}
                        className="flex-1 bg-rose-500 rounded-full transition-all duration-75"
                        style={{ height: `${Math.min(100, Math.max(10, Math.abs(val) * 1.8))}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Pessoa 2 (Operador) */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-white flex items-center gap-2">
                      <Stethoscope className="w-4 h-4 text-emerald-400" /> {vitalPerson2.label}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">Área frontal limpa | Padrão Basal Estável</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
                    Status: {vitalPerson2.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400 text-[10px] block font-mono">Taxa Respiratória</span>
                    <strong className="text-2xl text-emerald-400 font-black font-mono">
                      {vitalPerson2.breathingRateBpm}
                    </strong>
                    <span className="text-[10px] text-slate-500 block">Respirações / Min (BPM)</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400 text-[10px] block font-mono">Frequência Cardíaca</span>
                    <strong className="text-2xl text-amber-400 font-black font-mono">
                      {vitalPerson2.heartRateBpm}
                    </strong>
                    <span className="text-[10px] text-slate-500 block">Batimentos / Min (BPM)</span>
                  </div>
                </div>

                {/* Gráfico de Respiração */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span>Pneumograma Normal (Operador):</span>
                    <span className="text-emerald-400">Ritmo Sinusal</span>
                  </div>
                  <div className="h-16 bg-slate-900 rounded-xl border border-slate-800 flex items-center gap-0.5 p-2">
                    {vitalPerson2.breathingWaveform.map((val, idx) => (
                      <div
                        key={idx}
                        className="flex-1 bg-emerald-400 rounded-full transition-all duration-75"
                        style={{ height: `${Math.min(100, Math.max(10, Math.abs(val) * 1.5))}%` }}
                      />
                    ))}
                  </div>
                </div>

                {/* Gráfico Cardíaco */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span>Pulso Cardíaco Micro-Doppler:</span>
                    <span className="text-amber-400">Regular</span>
                  </div>
                  <div className="h-16 bg-slate-900 rounded-xl border border-slate-800 flex items-center gap-0.5 p-2">
                    {vitalPerson2.cardiacWaveform.map((val, idx) => (
                      <div
                        key={idx}
                        className="flex-1 bg-amber-400 rounded-full transition-all duration-75"
                        style={{ height: `${Math.min(100, Math.max(10, Math.abs(val) * 1.8))}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 3: MALHA MULTISTÁTICA RuvSense (ADR-029)             */}
      {/* ======================================================== */}
      {activeTab === 'multistatic_mesh' && (
        <div className="space-y-6">
          <div className="p-5 bg-slate-900/80 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-purple-400" /> Malha Multistática Wi-Fi 360° (Projeto RuvSense)
                </h3>
                <p className="text-xs text-slate-300">
                  Coordena múltiplos nós ESP32 e roteadores em Time-Division Multiplexing (TDM). Cada nó transmite em rodízio enquanto todos os outros escutam, gerando N×(N-1) enlaces cruzados para eliminar pontos cegos e sombras corporais.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-xl bg-purple-500/20 text-purple-300 font-mono text-xs border border-purple-500/40">
                  Coherence Gate: {multistaticMesh.coherenceGate}
                </span>
                <span className="px-3 py-1 rounded-xl bg-cyan-500/20 text-cyan-300 font-mono text-xs border border-cyan-500/40">
                  {multistaticMesh.totalVirtualSubcarriers} Subportadoras Virtuais (1/6/11)
                </span>
              </div>
            </div>

            {/* Seletor de Nós Participantes da Malha */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-xs font-mono text-slate-400 block font-bold">
                Selecione quais dispositivos conectados participam da Malha Multistática (2 a 6 nós):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                {discoveredDevices.map((dev) => {
                  const isChecked = multistaticNodeIds.includes(dev.id);
                  return (
                    <button
                      key={dev.id}
                      type="button"
                      onClick={() => handleToggleMultistaticNode(dev.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                        isChecked
                          ? 'bg-purple-950/30 border-purple-500 text-white shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="truncate mr-2">
                        <strong className="text-xs block truncate">{dev.name}</strong>
                        <span className="text-[10px] text-slate-400 font-mono">{dev.ip}</span>
                      </div>
                      <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${
                        isChecked ? 'bg-purple-500 text-slate-950' : 'border border-slate-700'
                      }`}>
                        {isChecked ? '✓' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Matriz dos Enlaces Ativos */}
            <div className="space-y-2">
              <span className="text-xs font-mono text-slate-400 block font-bold">
                Matriz de Enlaces Cruzados em Tempo Real ({multistaticMesh.links.length} Links):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {multistaticMesh.links.map((link) => (
                  <div
                    key={link.id}
                    className={`p-3 rounded-xl border text-xs font-mono space-y-1 transition-all ${
                      link.isIntersected
                        ? 'bg-rose-950/30 border-rose-500 text-rose-300'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-bold truncate max-w-[180px]">
                        {link.txDeviceName.split(' ')[0]} &rarr; {link.rxDeviceName.split(' ')[0]}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                        link.isIntersected ? 'bg-rose-500 text-white font-bold' : 'bg-slate-900 text-cyan-400'
                      }`}>
                        {link.isIntersected ? 'INTERROMPIDO' : 'LIMPO'}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>CH {link.channel} (50ms dwell)</span>
                      <span>Coerência: {Math.round(link.phaseCoherence * 100)}%</span>
                      <span>{link.attenuationDb} dB</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 4: MODELO DE CAMPO PERSISTENTE (7 TIERS ADR-030)     */}
      {/* ======================================================== */}
      {activeTab === 'persistent_field' && (
        <div className="space-y-6">
          <div className="p-5 bg-slate-900/80 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <Compass className="w-5 h-5 text-amber-400" /> Modelo de Campo Persistente & 7 Camadas Exóticas
                </h3>
                <p className="text-xs text-slate-300">
                  O ambiente eletromagnético da sala é decomposto por SVD (Singular Value Decomposition). O corpo humano é modelado pela equação: <em>Observação - Ambiente</em>, permitindo previsões antecipadas de intenção motora e tomografia volumétrica.
                </p>
              </div>
            </div>

            {/* Grid dos 7 Tiers */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {exoticTiers.map((tier) => (
                <div
                  key={tier.tierNumber}
                  className={`p-4 rounded-2xl border transition-all space-y-2 ${
                    selectedTier === tier.tierNumber
                      ? 'bg-amber-950/20 border-amber-500 shadow-md shadow-amber-950/30'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                  onClick={() => setSelectedTier(tier.tierNumber)}
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
                      TIER {tier.tierNumber}: {tier.codename}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">{tier.status}</span>
                  </div>

                  <h4 className="font-bold text-xs text-white">{tier.name}</h4>
                  <p className="text-[11px] text-slate-300 leading-snug">{tier.description}</p>

                  <div className="pt-2 border-t border-slate-900 flex justify-between items-center text-[10px] font-mono">
                    <span className="text-slate-500">{tier.metric}:</span>
                    <strong className="text-cyan-400">{tier.activeValue}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 5: RESGATE EM DESASTRES & TRIAGEM START (WIFI-MAT)   */}
      {/* ======================================================== */}
      {activeTab === 'disaster_triage' && (
        <div className="space-y-6">
          <div className="p-5 bg-slate-900/80 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <LifeBuoy className="w-5 h-5 text-emerald-400" /> Módulo de Desastres e Triagem START (WiFi-Mat)
                </h3>
                <p className="text-xs text-slate-300">
                  Capacidade de penetração em até 30 cm de concreto armado e escombros de terremoto/desabamento. Detecta sobreviventes soterrados pela assinatura respiratória micro-Doppler e classifica automaticamente por gravidade START Triage.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-mono">
                  🔴 Imediato (Vermelho)
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-mono">
                  🟡 Adiado (Amarelo)
                </span>
              </div>
            </div>

            {/* Vítimas Detectadas sob Escombros */}
            <div className="space-y-3">
              {disasterSurvivors.map((survivor) => {
                const isRed = survivor.triageCategory === 'IMMEDIATE_RED';

                return (
                  <div
                    key={survivor.id}
                    className={`p-4 rounded-2xl border space-y-2 ${
                      isRed
                        ? 'bg-rose-950/30 border-rose-500'
                        : 'bg-amber-950/30 border-amber-500'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AlertOctagon className={`w-5 h-5 ${isRed ? 'text-rose-500 animate-pulse' : 'text-amber-500'}`} />
                        <h4 className="font-bold text-sm text-white">{survivor.name}</h4>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          isRed ? 'bg-rose-500 text-white' : 'bg-amber-500 text-slate-950'
                        }`}>
                          {isRed ? 'PRIORIDADE 1 - IMEDIATO' : 'PRIORIDADE 2 - ADIADO'}
                        </span>
                      </div>

                      <span className="text-xs font-mono text-slate-300">
                        Profundidade: {survivor.rubbleDepthMeters}m sob escombros
                      </span>
                    </div>

                    <p className="text-xs text-slate-200">{survivor.triageReason}</p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-900 text-xs font-mono">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Respiração:</span>
                        <strong className="text-cyan-300">{survivor.breathingBpm} BPM</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Batimentos Cardíacos:</span>
                        <strong className="text-rose-400">{survivor.heartRateBpm} BPM</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Coordenadas X, Y:</span>
                        <span className="text-purple-300">X: {survivor.xMeters}m | Y: {survivor.yMeters}m</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Movimentação:</span>
                        <span className={survivor.movementDetected ? 'text-emerald-400' : 'text-slate-400'}>
                          {survivor.movementDetected ? 'Detectada' : 'Imóvel (Apenas Vitals)'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 6: IA AUTO-APRENDIZAGEM & FINGERPRINTS 128D (ADR-024)*/}
      {/* ======================================================== */}
      {activeTab === 'self_learning' && (
        <div className="space-y-6">
          <div className="p-5 bg-slate-900/80 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <Brain className="w-5 h-5 text-sky-400" /> IA Auto-Aprendizagem & Fingerprints 128D (ADR-024 / MERIDIAN)
                </h3>
                <p className="text-xs text-slate-300">
                  A IA aprende sem necessidade de câmeras ou supervisão humana. Converte os sinais de rádio em um vetor de 128 dimensões único para cada cômodo. Com os adaptadores MicroLoRA (1.8K parâmetros), o modelo generaliza para qualquer sala em minutos.
                </p>
              </div>

              <span className="px-3 py-1 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/40 text-xs font-mono">
                Memória no ESP32: 55 KB (de 520 KB)
              </span>
            </div>

            {/* Visualizador do Vetor de 128 Dimensões */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-mono text-slate-400">
                <span>Vetor Eletromagnético da Sala (128 Números de Ponto Flutuante):</span>
                <span className="text-cyan-400">Normalizado N(0, 1)</span>
              </div>
              <div className="h-28 bg-slate-950 rounded-2xl border border-slate-800 p-2 flex items-end gap-0.5 overflow-x-auto">
                {environmentVector.map((val, idx) => (
                  <div
                    key={idx}
                    title={`Dimensão ${idx}: ${val}`}
                    style={{ height: `${Math.min(100, Math.max(10, (val + 1) * 50))}%` }}
                    className={`flex-1 min-w-[5px] rounded-t-sm transition-all duration-100 ${
                      val > 0.5 ? 'bg-sky-400' : val < -0.3 ? 'bg-purple-500' : 'bg-emerald-500'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* 4 Tipos de Índices de Fingerprint */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono pt-2">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <strong className="text-sky-300 block">1. env_fingerprint</strong>
                <span className="text-slate-400 text-[11px]">Identificação da Sala</span>
                <span className="text-emerald-400 block mt-1">SALA_ESTUDO (99.2%)</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <strong className="text-emerald-300 block">2. activity_pattern</strong>
                <span className="text-slate-400 text-[11px]">Classificação de Ação</span>
                <span className="text-cyan-400 block mt-1">CAMINHANDO_DEVAGAR</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <strong className="text-purple-300 block">3. temporal_baseline</strong>
                <span className="text-slate-400 text-[11px]">Linha de Base Normal</span>
                <span className="text-purple-400 block mt-1">Estável (Drift &lt; 1%)</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <strong className="text-amber-300 block">4. person_track</strong>
                <span className="text-slate-400 text-[11px]">Assinatura Pessoal</span>
                <span className="text-amber-400 block mt-1">AETHER_ID_01</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 7: DISPOSITIVOS WI-FI & ENLACES CSI                  */}
      {/* ======================================================== */}
      {activeTab === 'devices_matrix' && (
        <div className="space-y-6">
          <div className="p-5 bg-slate-900/80 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                  <Network className="w-5 h-5 text-emerald-400" /> Dispositivos Conectados na Rede Wi-Fi
                </h3>
                <p className="text-xs text-slate-300">
                  Gerencie todos os clientes da sub-rede. Selecione o seu roteador pessoal ou qualquer nó como Emissor TX, Receptor RX ou Alvo Rastreado.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsConfigureUserRouterModalOpen(true)}
                  className="px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md"
                >
                  <Home className="w-4 h-4" />
                  <span>Configurar Meu Roteador</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddDeviceModalOpen(true)}
                  className="px-3.5 py-2 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar Nó Manual</span>
                </button>

                <button
                  type="button"
                  onClick={handleScanDevices}
                  disabled={isScanningDevices}
                  className="px-3.5 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-4 h-4 text-emerald-400 ${isScanningDevices ? 'animate-spin' : ''}`} />
                  <span>{isScanningDevices ? 'Varrendo...' : 'Varredura ARP/CSI'}</span>
                </button>
              </div>
            </div>

            {/* Filtros e Busca de Dispositivos */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setDeviceFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    deviceFilter === 'all'
                      ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-white bg-slate-950'
                  }`}
                >
                  Todos ({discoveredDevices.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceFilter('csi_only')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    deviceFilter === 'csi_only'
                      ? 'bg-slate-800 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-white bg-slate-950'
                  }`}
                >
                  CSI Habilitados ({discoveredDevices.filter((d) => d.csiCapable).length})
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceFilter('sensors')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    deviceFilter === 'sensors'
                      ? 'bg-slate-800 text-purple-300 border border-purple-500/40'
                      : 'text-slate-400 hover:text-white bg-slate-950'
                  }`}
                >
                  Sensores ESP32 ({discoveredDevices.filter((d) => d.deviceType === 'esp32_sensor').length})
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceFilter('mobile')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    deviceFilter === 'mobile'
                      ? 'bg-slate-800 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:text-white bg-slate-950'
                  }`}
                >
                  Celulares / Laptops ({discoveredDevices.filter((d) => d.deviceType === 'smartphone' || d.deviceType === 'laptop').length})
                </button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar IP, MAC, Nome..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Grade de Cards de Dispositivos */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {filteredDevices.map((dev) => {
                const isCurrentTx = dev.id === selectedTxId;
                const isCurrentRx = dev.id === selectedRxId;
                const isTracked = dev.id === trackedTargetId;
                const isUserOwnRouter = dev.id === 'dev_user_router';
                const isInMesh = multistaticNodeIds.includes(dev.id);

                return (
                  <div
                    key={dev.id}
                    className={`p-4 rounded-2xl border transition-all space-y-3 ${
                      isUserOwnRouter
                        ? 'border-emerald-500 bg-gradient-to-br from-emerald-950/30 to-slate-950 shadow-md shadow-emerald-950/30'
                        : isCurrentTx
                        ? 'bg-cyan-950/20 border-cyan-500 shadow-md shadow-cyan-950/40'
                        : isCurrentRx
                        ? 'bg-emerald-950/20 border-emerald-500 shadow-md shadow-emerald-950/40'
                        : isTracked
                        ? 'bg-rose-950/20 border-rose-500'
                        : 'bg-slate-950 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl ${
                          isUserOwnRouter
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : dev.deviceType === 'router'
                            ? 'bg-cyan-500/10 text-cyan-400'
                            : dev.deviceType === 'esp32_sensor'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : dev.deviceType === 'smartphone'
                            ? 'bg-purple-500/10 text-purple-400'
                            : dev.deviceType === 'laptop'
                            ? 'bg-sky-500/10 text-sky-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {isUserOwnRouter ? (
                            <Home className="w-5 h-5" />
                          ) : dev.deviceType === 'router' ? (
                            <Server className="w-5 h-5" />
                          ) : dev.deviceType === 'esp32_sensor' ? (
                            <Cpu className="w-5 h-5" />
                          ) : dev.deviceType === 'smartphone' ? (
                            <Smartphone className="w-5 h-5" />
                          ) : dev.deviceType === 'laptop' ? (
                            <Laptop className="w-5 h-5" />
                          ) : (
                            <HardDrive className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-white leading-tight">{dev.name}</h4>
                          <span className="text-[10px] text-slate-400 font-mono">{dev.vendor}</span>
                        </div>
                      </div>

                      {/* Badges de Papel */}
                      <div className="flex flex-col items-end gap-1">
                        {isUserOwnRouter && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold">
                            SEU ROTEADOR
                          </span>
                        )}
                        {isCurrentTx && (
                          <span className="px-2 py-0.5 rounded bg-cyan-500 text-slate-950 text-[10px] font-mono font-bold">
                            NÓ TX ATIVO
                          </span>
                        )}
                        {isCurrentRx && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 text-[10px] font-mono font-bold">
                            NÓ RX ATIVO
                          </span>
                        )}
                        {isInMesh && (
                          <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[9px] font-mono">
                            NA MALHA TDM
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Dados de Rede */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 border-t border-slate-900 text-slate-400">
                      <div>
                        <span className="text-slate-500 block text-[9px]">IP / MAC:</span>
                        <span className="text-slate-200">{dev.ip}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px]">Sinal RSSI:</span>
                        <span className="text-amber-400">{dev.rssiDbm} dBm ({dev.distanceMeters}m)</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span className="text-sky-400">Link: {dev.linkSpeedMbps} Mbps</span>
                      {dev.csiCapable ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> CSI Habilitado
                        </span>
                      ) : (
                        <span className="text-slate-500">Sem Suporte CSI</span>
                      )}
                    </div>

                    {/* Botões de Ação para Escolher o Dispositivo */}
                    <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-900">
                      <button
                        type="button"
                        onClick={() => setSelectedTxId(dev.id)}
                        className={`py-1.5 px-2 rounded-xl text-[10px] font-mono font-bold transition-all text-center ${
                          isCurrentTx
                            ? 'bg-cyan-500 text-slate-950'
                            : 'bg-slate-900 text-cyan-300 hover:bg-slate-800 border border-cyan-500/30'
                        }`}
                      >
                        {isCurrentTx ? 'Ativo TX' : 'Definir TX'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedRxId(dev.id)}
                        className={`py-1.5 px-2 rounded-xl text-[10px] font-mono font-bold transition-all text-center ${
                          isCurrentRx
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-900 text-emerald-300 hover:bg-slate-800 border border-emerald-500/30'
                        }`}
                      >
                        {isCurrentRx ? 'Ativo RX' : 'Definir RX'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (isUserOwnRouter) {
                            setIsConfigureUserRouterModalOpen(true);
                          } else {
                            setInspectedDevice(dev);
                          }
                        }}
                        className="py-1.5 px-2 rounded-xl text-[10px] font-mono text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 text-center transition-all"
                      >
                        {isUserOwnRouter ? 'Configurar' : 'Inspecionar'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 8: DENSEPOSE (MALHA UV 24 PARTES SMPL VIA WI-FI)     */}
      {/* ======================================================== */}
      {activeTab === 'densepose_view' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 space-y-4">
              <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-emerald-400" /> Reconstrução UV DensePose (FAIR / CMU)
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    arXiv:1802.00434
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  O algoritmo <strong>DensePose From WiFi</strong> mapeia as distorções de amplitude e fase de cada subportadora OFDM para as 24 regiões de superfície do modelo paramétrico <strong>SMPL</strong>, estimando a postura humana através de paredes sem usar sensores corporais ou câmeras.
                </p>

                {/* Tabela de 12 Partes Anatômicas Ativas */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  {DENSEPOSE_SMPL_PARTS.map((part) => (
                    <div
                      key={part.id}
                      className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: part.color }} />
                        <span className="text-slate-300 text-[11px]">{part.name}</span>
                      </div>
                      <span className="text-[10px] text-emerald-400">98% Lock</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-4">
              <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
                <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" /> Coordenadas das 17 Articulações COCO
                </h3>

                <div className="max-h-[340px] overflow-y-auto space-y-1.5 pr-1 font-mono text-xs">
                  {densePose.joints.map((joint) => (
                    <div
                      key={joint.name}
                      className="p-2 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between"
                    >
                      <span className="text-cyan-300 text-[11px]">{joint.name}</span>
                      <div className="flex items-center gap-4 text-[10px] text-slate-400">
                        <span>X: {Math.round(joint.x)}px</span>
                        <span>Y: {Math.round(joint.y)}px</span>
                        <span className="text-emerald-400">{(joint.confidence * 100).toFixed(1)}%</span>
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
      {/* ABA 9: FIRMWARES RUVIEW (ESP32-S3 TDM MESH & HARVESTER)  */}
      {/* ======================================================== */}
      {activeTab === 'ruview_firmware' && (
        <div className="space-y-5">
          <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" /> Firmwares RuView para ESP32-S3 (Commit 407b46b)
                </h3>
                <p className="text-xs text-slate-300">
                  Código C++ para ESP-IDF / PlatformIO com suporte a Channel Hopping nos canais 1, 6 e 11, TDM Dwell (50ms) e CSI Harvester.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex rounded-xl bg-slate-950 border border-slate-800 p-1 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setActiveFirmwareCode('tdm_mesh')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      activeFirmwareCode === 'tdm_mesh' ? 'bg-purple-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    TDM Multistatic Mesh (Novo)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFirmwareCode('classic_harvester')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      activeFirmwareCode === 'classic_harvester' ? 'bg-cyan-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    CSI Harvester Serial
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCopyFirmware}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2"
                >
                  {isCopiedFirmware ? <Check className="w-4 h-4 text-yellow-300" /> : <Copy className="w-4 h-4" />}
                  <span>{isCopiedFirmware ? 'Copiado!' : 'Copiar Código'}</span>
                </button>
              </div>
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
              <pre className="p-4 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-[460px] leading-relaxed">
                {activeFirmwareCode === 'tdm_mesh' ? RUVIEW_ESP32_TDM_MESH_SKETCH : RUVIEW_ESP32_CSI_SKETCH}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 10: PAPERS CIENTÍFICOS & REPOSITÓRIOS                */}
      {/* ======================================================== */}
      {activeTab === 'standards_ieee' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-3">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                Open Source Repository
              </span>
              <h4 className="font-bold text-sm text-slate-100">RuView (ruvnet/RuView)</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Framework de sensoriamento de rádio Wi-Fi através de paredes em Rust com suporte a hardware ESP32-S3 de baixo custo, TDM multistático e sinais vitais.
              </p>
              <a
                href="https://github.com/ruvnet/RuView/tree/407b46b206757e6c2e7c71cbac3e3f1e7b88b843"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5"
              >
                <span>Acessar ruvnet/RuView (Commit 407b46b)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-3">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                arXiv:1802.00434 / FAIR
              </span>
              <h4 className="font-bold text-sm text-slate-100">DensePose (Detectron2 / CMU)</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Mapeamento denso de pose humana 3D para o modelo SMPL de 24 partes corporais, adaptado pela Carnegie Mellon University para sinais Wi-Fi CSI.
              </p>
              <a
                href="https://arxiv.org/abs/1802.00434"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5"
              >
                <span>Acessar Paper arXiv:1802.00434</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: GERENCIADOR DE CONEXÃO WI-FI                   */}
      {/* ======================================================== */}
      {isWifiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-xl bg-slate-900 rounded-3xl border border-slate-800 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-2xl">
                  <Wifi className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Conexão Wi-Fi do Radar</h3>
                  <p className="text-xs text-slate-400">Conecte-se à rede do seu roteador ou a outras redes</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWifiModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* CARD DESTACADO: MEU ROTEADOR PESSOAL */}
            <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Home className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-xs text-white">Rede do Seu Roteador ({userRouter.ssid})</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400">Gateway: {userRouter.gatewayIp}</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Conectar diretamente à rede transmitida pelo seu roteador físico de casa ou escritório.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const myNet = wifiNetworks.find((n) => n.id === 'net_user_own') || {
                      id: 'net_user_own',
                      ssid: userRouter.ssid,
                      bssid: userRouter.mac,
                      rssiDbm: -36,
                      channel: userRouter.channel,
                      frequencyGhz: '5 GHz (UNII-1)',
                      security: 'WPA3-Personal' as const,
                      qualityPercent: 99,
                      isConnected: true,
                      ipSubnet: `${userRouter.gatewayIp.substring(0, userRouter.gatewayIp.lastIndexOf('.'))}.0/24`,
                      gatewayIp: userRouter.gatewayIp,
                      generation: 'wifi6_ax' as const,
                      phyMode: '802.11ax',
                    };
                    handleConnectWifi(myNet);
                    setSelectedTxId('dev_user_router');
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Conectar ao Meu Roteador</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsWifiModalOpen(false);
                    setIsConfigureUserRouterModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-mono"
                >
                  Editar IP / SSID
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-mono text-slate-400">Redes Detectadas ao Redor:</span>
              <button
                type="button"
                onClick={handleScanWifi}
                disabled={isScanningWifi}
                className="px-2.5 py-1 rounded-xl bg-slate-800 text-cyan-300 text-xs font-mono flex items-center gap-1.5 hover:bg-slate-700 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanningWifi ? 'animate-spin' : ''}`} />
                <span>{isScanningWifi ? 'Varrendo Espectro...' : 'Atualizar Varredura'}</span>
              </button>
            </div>

            {/* Lista de SSIDs */}
            <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
              {wifiNetworks.map((net) => {
                const isSelected = activeNetwork.id === net.id && isWifiConnected;

                return (
                  <div
                    key={net.id}
                    className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-emerald-950/20 border-emerald-500'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white">{net.ssid}</span>
                        {isSelected && (
                          <span className="px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono">
                            Conectado
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
                        <span>{net.frequencyGhz}</span>
                        <span>CH {net.channel}</span>
                        <span className="text-amber-400">{net.rssiDbm} dBm</span>
                        <span>{net.security}</span>
                      </div>
                    </div>

                    <div>
                      {isSelected ? (
                        <button
                          type="button"
                          onClick={handleDisconnectWifi}
                          className="px-3 py-1.5 rounded-xl bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-semibold"
                        >
                          Desconectar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleConnectWifi(net)}
                          className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-all shadow-md"
                        >
                          Conectar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Conectar a Outro Roteador por SSID Personalizado */}
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <span className="text-slate-400 block font-mono text-[11px]">
                Conectar a Rede Oculta ou Roteador Específico:
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Nome do Wi-Fi (SSID)"
                  value={customSsidInput}
                  onChange={(e) => setCustomSsidInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-500"
                />
                <input
                  type="text"
                  placeholder="IP Gateway (ex: 192.168.1.1)"
                  value={customGatewayInput}
                  onChange={(e) => setCustomGatewayInput(e.target.value)}
                  className="w-36 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!customSsidInput) return;
                    const customNet: WifiNetwork = {
                      id: `net_custom_${Date.now()}`,
                      ssid: customSsidInput,
                      bssid: '00:11:22:33:44:55',
                      rssiDbm: -40,
                      channel: 36,
                      frequencyGhz: '5 GHz',
                      security: 'WPA2-PSK',
                      qualityPercent: 95,
                      isConnected: true,
                      ipSubnet: '192.168.1.0/24',
                      gatewayIp: customGatewayInput || '192.168.1.1',
                      generation: 'wifi6_ax',
                      phyMode: '802.11ax',
                    };
                    setWifiNetworks((prev) => [customNet, ...prev]);
                    handleConnectWifi(customNet);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs whitespace-nowrap"
                >
                  Conectar
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsWifiModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CONFIGURAR MEU ROTEADOR WI-FI PESSOAL            */}
      {/* ======================================================== */}
      {isConfigureUserRouterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <form
            onSubmit={handleSaveUserRouter}
            className="w-full max-w-lg bg-slate-900 rounded-3xl border border-slate-800 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-2xl">
                  <Home className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Configurar Meu Roteador Wi-Fi</h3>
                  <p className="text-xs text-slate-400">Defina o IP do seu roteador físico para usá-lo como o emissor TX do radar</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigureUserRouterModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Nome do Roteador */}
              <div>
                <label className="text-slate-400 block mb-1 font-mono">Nome / Identificação do Seu Roteador:</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Meu Roteador TP-Link / Vivo Fibra / Asus"
                  value={userRouter.name}
                  onChange={(e) => setUserRouter({ ...userRouter, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* IP do Gateway com Seletores Rápidos */}
              <div>
                <label className="text-slate-400 block mb-1 font-mono">
                  Endereço IP do Gateway (Roteador):
                </label>
                <input
                  type="text"
                  required
                  placeholder="192.168.1.1"
                  value={userRouter.gatewayIp}
                  onChange={(e) => setUserRouter({ ...userRouter, gatewayIp: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-emerald-300 font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
                {/* Atalhos de 1 clique para gateways comuns */}
                <div className="mt-2 space-y-1">
                  <span className="text-[10px] text-slate-500 block font-mono">Selecione o IP do seu roteador com 1 clique:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {COMMON_ROUTER_GATEWAYS.slice(0, 4).map((gw) => (
                      <button
                        type="button"
                        key={gw.ip}
                        onClick={() => setUserRouter({ ...userRouter, gatewayIp: gw.ip })}
                        className={`p-1.5 rounded-lg border text-[11px] font-mono text-center transition-all ${
                          userRouter.gatewayIp === gw.ip
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {gw.ip}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                    {COMMON_ROUTER_GATEWAYS.slice(4, 8).map((gw) => (
                      <button
                        type="button"
                        key={gw.ip}
                        onClick={() => setUserRouter({ ...userRouter, gatewayIp: gw.ip })}
                        className={`p-1.5 rounded-lg border text-[11px] font-mono text-center transition-all ${
                          userRouter.gatewayIp === gw.ip
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {gw.ip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* SSID e Fabricante */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1 font-mono">Nome da Rede (SSID):</label>
                  <input
                    type="text"
                    value={userRouter.ssid}
                    onChange={(e) => setUserRouter({ ...userRouter, ssid: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-mono">Fabricante / Marca:</label>
                  <input
                    type="text"
                    placeholder="TP-Link / Asus / Claro / Vivo"
                    value={userRouter.vendor}
                    onChange={(e) => setUserRouter({ ...userRouter, vendor: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Frequência, Canal e Potência */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1 font-mono">Banda:</label>
                  <select
                    value={userRouter.band}
                    onChange={(e) => setUserRouter({ ...userRouter, band: e.target.value as any })}
                    className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-cyan-300 text-xs focus:outline-none"
                  >
                    <option value="5 GHz">5 GHz (Recomendado)</option>
                    <option value="2.4 GHz">2.4 GHz (Longo Alcance)</option>
                    <option value="6 GHz">6 GHz (Wi-Fi 6E/7)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-mono">Canal Wi-Fi:</label>
                  <input
                    type="number"
                    value={userRouter.channel}
                    onChange={(e) => setUserRouter({ ...userRouter, channel: parseInt(e.target.value) || 36 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-mono">Potência (dBm):</label>
                  <input
                    type="number"
                    value={userRouter.txPowerDbm}
                    onChange={(e) => setUserRouter({ ...userRouter, txPowerDbm: parseInt(e.target.value) || 20 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-amber-400 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Coordenadas X, Y */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1 font-mono">Posição X na Sala (metros):</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="8"
                    value={userRouter.xMeters}
                    onChange={(e) => setUserRouter({ ...userRouter, xMeters: parseFloat(e.target.value) || 1.2 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-mono">Posição Y na Sala (metros):</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="6"
                    value={userRouter.yMeters}
                    onChange={(e) => setUserRouter({ ...userRouter, yMeters: parseFloat(e.target.value) || 1.0 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsConfigureUserRouterModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Salvar e Usar Meu Roteador como TX</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: INSPEÇÃO DETALHADA DO DISPOSITIVO               */}
      {/* ======================================================== */}
      {inspectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-slate-900 rounded-3xl border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-base text-white">{inspectedDevice.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectedDevice(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono text-slate-300">
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Endereço IP:</span>
                  <span className="text-cyan-300">{inspectedDevice.ip}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Endereço MAC:</span>
                  <span className="text-slate-200">{inspectedDevice.mac}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Fabricante:</span>
                  <span className="text-slate-200">{inspectedDevice.vendor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Sinal RSSI:</span>
                  <span className="text-amber-400">{inspectedDevice.rssiDbm} dBm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Distância Estimada:</span>
                  <span className="text-emerald-400">{inspectedDevice.distanceMeters} metros</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Velocidade de Link:</span>
                  <span className="text-sky-400">{inspectedDevice.linkSpeedMbps} Mbps</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Coordenadas no Radar:</span>
                  <span className="text-purple-400">X: {inspectedDevice.xMeters}m | Y: {inspectedDevice.yMeters}m</span>
                </div>
              </div>

              <p className="text-xs text-slate-400 p-2 leading-relaxed">
                {inspectedDevice.statusNote}
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTxId(inspectedDevice.id);
                    setInspectedDevice(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold font-mono"
                >
                  Definir TX
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRxId(inspectedDevice.id);
                    setInspectedDevice(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono"
                >
                  Definir RX
                </button>
              </div>

              <button
                type="button"
                onClick={() => setInspectedDevice(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: ADICIONAR DISPOSITIVO MANUALMENTE              */}
      {/* ======================================================== */}
      {isAddDeviceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <form
            onSubmit={handleAddDeviceSubmit}
            className="w-full max-w-md bg-slate-900 rounded-3xl border border-slate-800 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-base text-white">Adicionar Dispositivo Manual</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddDeviceModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-mono">Nome do Dispositivo:</label>
                <input
                  type="text"
                  required
                  placeholder="ex: ESP32-S3 Sensor Nó Gamma"
                  value={newDeviceForm.name}
                  onChange={(e) => setNewDeviceForm({ ...newDeviceForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1 font-mono">Endereço IP:</label>
                  <input
                    type="text"
                    required
                    value={newDeviceForm.ip}
                    onChange={(e) => setNewDeviceForm({ ...newDeviceForm, ip: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-mono">Endereço MAC:</label>
                  <input
                    type="text"
                    placeholder="XX:XX:XX:XX:XX:XX"
                    value={newDeviceForm.mac}
                    onChange={(e) => setNewDeviceForm({ ...newDeviceForm, mac: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1 font-mono">Tipo:</label>
                  <select
                    value={newDeviceForm.deviceType}
                    onChange={(e) =>
                      setNewDeviceForm({
                        ...newDeviceForm,
                        deviceType: e.target.value as WifiDiscoveredDevice['deviceType'],
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-cyan-300 text-xs focus:outline-none"
                  >
                    <option value="esp32_sensor">ESP32 Sensor</option>
                    <option value="smartphone">Smartphone</option>
                    <option value="laptop">Laptop / Host</option>
                    <option value="router">Roteador / AP</option>
                    <option value="iot">Dispositivo IoT</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-mono">Suporte a CSI:</label>
                  <select
                    value={newDeviceForm.csiCapable ? 'true' : 'false'}
                    onChange={(e) =>
                      setNewDeviceForm({
                        ...newDeviceForm,
                        csiCapable: e.target.value === 'true',
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-emerald-300 text-xs focus:outline-none"
                  >
                    <option value="true">Sim (CSI 802.11bf)</option>
                    <option value="false">Não</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1 font-mono">Posição X (metros):</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="8"
                    value={newDeviceForm.xMeters}
                    onChange={(e) => setNewDeviceForm({ ...newDeviceForm, xMeters: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-mono">Posição Y (metros):</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="6"
                    value={newDeviceForm.yMeters}
                    onChange={(e) => setNewDeviceForm({ ...newDeviceForm, yMeters: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddDeviceModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-md"
              >
                Salvar Dispositivo
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
