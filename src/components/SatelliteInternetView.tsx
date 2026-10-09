import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Satellite,
  Radio,
  Wifi,
  Activity,
  Sliders,
  Play,
  Square,
  RefreshCw,
  Compass,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Layers,
  Sparkles,
  Zap,
  Download,
  Upload,
  Lock,
  Unlock,
  Terminal,
  Shield,
  HelpCircle,
  ExternalLink,
  Cpu,
  Monitor,
  Camera,
  Smartphone,
  Copy,
  Check,
  RotateCcw,
  Video,
  Eye,
} from 'lucide-react';
import {
  SATELLITE_CATALOG,
  SatelliteDefinition,
  DEFAULT_SDR_CONFIG,
  SdrRfConfig,
  SatelliteLinkMetrics,
  SatelliteIpGatewayStatus,
  calculateSimulatedDoppler,
  generateSyntheticSdrSpectrum,
  requestWebUsbSdrDevice,
  requestWebSerialTncDevice,
  ObserverLocation,
  DishLookAngles,
  ServoRotatorAngles,
  DEFAULT_OBSERVER_LOCATION,
  calculateGeostationaryLookAngles,
  calculateSatelliteLookAngles,
  convertLookAnglesToServoCommands,
  ARDUINO_ROTOR_SKETCH_SAMPLE,
  requestWebSerialRotorDevice,
} from '../utils/satelliteSdr';

type SatelliteTab = 'tracking' | 'dish3d' | 'arcamera' | 'rotorservos' | 'spectrum' | 'gateway' | 'hardware' | 'parameters';

export const SatelliteInternetView: React.FC = () => {
  // Aba Ativa
  const [activeTab, setActiveTab] = useState<SatelliteTab>('dish3d');

  // Satélite Selecionado
  const [selectedSatellite, setSelectedSatellite] = useState<SatelliteDefinition>(SATELLITE_CATALOG[0]);

  // Localização do Observador (GPS)
  const [observerLocation, setObserverLocation] = useState<ObserverLocation>(DEFAULT_OBSERVER_LOCATION);
  const [isDetectingGps, setIsDetectingGps] = useState<boolean>(false);

  // Ângulos de Apontamento Calculados
  const [calculatedAngles, setCalculatedAngles] = useState<DishLookAngles>({
    azimuthDeg: 62.8,
    elevationDeg: 54.2,
    polarizationSkewDeg: 12.4,
    distanceKm: 38200,
    isVisible: true,
  });

  // Antena Virtual 3D States
  const [isAutoTrackingDish, setIsAutoTrackingDish] = useState<boolean>(true);
  const [manualDishAzimuth, setManualDishAzimuth] = useState<number>(62.8);
  const [manualDishElevation, setManualDishElevation] = useState<number>(54.2);
  const dishCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Câmera de Realidade Aumentada (AR Finder) States
  const [isArCameraActive, setIsArCameraActive] = useState<boolean>(false);
  const [deviceOrientation, setDeviceOrientation] = useState<{ alpha: number; beta: number; gamma: number }>({
    alpha: 0,
    beta: 45,
    gamma: 0,
  });
  const [hasOrientationSensor, setHasOrientationSensor] = useState<boolean>(false);
  const [isAlignedWithSatellite, setIsAlignedWithSatellite] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const arCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);

  // Servomotores & Rotor Serial States
  const [rotorProtocol, setRotorProtocol] = useState<'arduino' | 'gs232' | 'easycomm'>('arduino');
  const [servoMinPulseUs, setServoMinPulseUs] = useState<number>(500);
  const [servoMaxPulseUs, setServoMaxPulseUs] = useState<number>(2500);
  const [isRotorSerialConnected, setIsRotorSerialConnected] = useState<boolean>(false);
  const [connectedRotorPort, setConnectedRotorPort] = useState<unknown>(null);
  const [lastSentRotorCommand, setLastSentRotorCommand] = useState<string>('');
  const [isCopiedArduinoCode, setIsCopiedArduinoCode] = useState<boolean>(false);

  // Configurações RF & Parâmetros Avançados
  const [sdrConfig, setSdrConfig] = useState<SdrRfConfig>({
    ...DEFAULT_SDR_CONFIG,
    centerFrequencyHz: SATELLITE_CATALOG[0].downlinkFreqHz,
    modulation: SATELLITE_CATALOG[0].modulation,
    symbolRateBaud: SATELLITE_CATALOG[0].baudRate,
  });

  // Estado da Conexão SDR
  const [sdrDeviceMode, setSdrDeviceMode] = useState<'simulated' | 'webusb' | 'webserial' | 'rtl_tcp'>('simulated');
  const [connectedDeviceName, setConnectedDeviceName] = useState<string>('SDR Virtual / Laboratório Tático');
  const [isSdrActive, setIsSdrActive] = useState<boolean>(true);
  const [rtlTcpUrl, setRtlTcpUrl] = useState<string>('ws://127.0.0.1:1234');

  // Gateway de Internet
  const [gatewayStatus, setGatewayStatus] = useState<SatelliteIpGatewayStatus>({
    isEnabled: false,
    gatewayMode: 'uplink_host',
    tunInterfaceName: 'sat0',
    assignedVirtualIp: '10.88.0.1/24',
    routedPacketsCount: 1420,
    compressedBytesRatio: 0.58,
    activeSockets: 3,
    dnsProxyActive: true,
    firewallRulesActive: true,
    averageLatencyMs: 640,
  });

  // Métricas do Link de Satélite
  const [metrics, setMetrics] = useState<SatelliteLinkMetrics>({
    snrDb: 14.5,
    rssiDbm: -72,
    carrierFrequencyErrorHz: 42,
    dopplerShiftHz: 0,
    bitErrorRatePercent: 0.02,
    packetsReceived: 840,
    packetsSent: 320,
    bytesReceived: 1024 * 380,
    bytesSent: 1024 * 140,
    throughputKbps: 64.2,
    isCarrierLocked: true,
    isFrameSynced: true,
    azimuthDeg: 62.8,
    elevationDeg: 54.2,
    isSatelliteVisible: true,
  });

  // Testador de Ping & Tráfego Web
  const [pingTarget, setPingTarget] = useState<string>('1.1.1.1 (Cloudflare DNS)');
  const [pingResults, setPingResults] = useState<{ seq: number; rttMs: number; status: 'ok' | 'timeout' }[]>([
    { seq: 1, rttMs: 620, status: 'ok' },
    { seq: 2, rttMs: 595, status: 'ok' },
    { seq: 3, rttMs: 640, status: 'ok' },
  ]);
  const [isPinging, setIsPinging] = useState<boolean>(false);

  // Notificações
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Refs de Canvas Espectral
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const waterfallCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const constellationCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Contador de Tempo da Passagem Orbital
  const [elapsedSec, setElapsedSec] = useState<number>(120);

  // Atualizar frequência central e ângulos ao trocar satélite
  const handleSelectSatellite = (sat: SatelliteDefinition) => {
    setSelectedSatellite(sat);
    setSdrConfig((prev) => ({
      ...prev,
      centerFrequencyHz: sat.downlinkFreqHz,
      modulation: sat.modulation,
      symbolRateBaud: sat.baudRate,
    }));

    const angles = calculateSatelliteLookAngles(sat, observerLocation, elapsedSec);
    setCalculatedAngles(angles);
    if (isAutoTrackingDish) {
      setManualDishAzimuth(angles.azimuthDeg);
      setManualDishElevation(angles.elevationDeg);
    }

    setActionNotice(`🛰️ Satélite selecionado: ${sat.name} (${(sat.downlinkFreqHz / 1e6).toFixed(3)} MHz)`);
    setTimeout(() => setActionNotice(null), 3000);
  };

  // Capturar GPS Real do Usuário (Georreferenciamento de Alta Precisão)
  const handleDetectUserGps = () => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setActionNotice('⚠️ Geolocation API não suportada neste navegador.');
      return;
    }

    setIsDetectingGps(true);
    setActionNotice('📍 Buscando coordenadas GPS do seu dispositivo...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Math.round(pos.coords.latitude * 10000) / 10000;
        const lon = Math.round(pos.coords.longitude * 10000) / 10000;
        const alt = Math.round(pos.coords.altitude || 750);

        const newLoc: ObserverLocation = {
          latitude: lat,
          longitude: lon,
          altitudeMeters: alt,
          locationName: `GPS Atual (${lat}°, ${lon}° - Precisão: ${Math.round(pos.coords.accuracy || 10)}m)`,
        };

        setObserverLocation(newLoc);
        setIsDetectingGps(false);

        // Recalcular apontamento com a nova posição
        const angles = calculateSatelliteLookAngles(selectedSatellite, newLoc, elapsedSec);
        setCalculatedAngles(angles);
        if (isAutoTrackingDish) {
          setManualDishAzimuth(angles.azimuthDeg);
          setManualDishElevation(angles.elevationDeg);
        }

        setActionNotice(`✅ GPS Localizado: Lat ${lat}°, Lon ${lon}°! Ângulos recalculados com precisão.`);
        setTimeout(() => setActionNotice(null), 4000);
      },
      (err) => {
        setIsDetectingGps(false);
        setActionNotice(`⚠️ Falha ao obter GPS: ${err.message}. Mantendo localização manual.`);
        setTimeout(() => setActionNotice(null), 3500);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Monitorar Bússola e Giroscópio do Dispositivo (Sensor de Orientação)
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha !== null && e.beta !== null) {
        setHasOrientationSensor(true);
        // Alpha = Bússola (0 a 360°), Beta = Inclinação frontal/traseira (-180 a 180°)
        setDeviceOrientation({
          alpha: Math.round(e.alpha),
          beta: Math.round(e.beta),
          gamma: Math.round(e.gamma || 0),
        });
      }
    };

    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleOrientation);
    }

    return () => {
      if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
        window.removeEventListener('deviceorientation', handleOrientation);
      }
    };
  }, []);

  // Ligar/Desligar Câmera de Realidade Aumentada (AR Satellite Finder)
  const handleToggleArCamera = async () => {
    if (isArCameraActive) {
      // Desligar Câmera
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach((track) => track.stop());
        videoStreamRef.current = null;
      }
      setIsArCameraActive(false);
      setActionNotice('📷 Câmera AR desativada.');
      setTimeout(() => setActionNotice(null), 2000);
    } else {
      // Ligar Câmera Traseira (environment)
      try {
        setActionNotice('🎥 Iniciando Câmera e Calibrando Sensores de Realidade Aumentada...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });

        videoStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsArCameraActive(true);
        setActionNotice('✅ Câmera AR Ativa! Aponte o celular para o céu para localizar o satélite.');
        setTimeout(() => setActionNotice(null), 3500);
      } catch (err: unknown) {
        setActionNotice(`❌ Falha ao acessar câmera: ${(err as Error).message}`);
        setTimeout(() => setActionNotice(null), 3500);
      }
    }
  };

  // Conectar à porta serial do Arduino / Rotor físico via WebSerial
  const handleConnectRotorSerial = async () => {
    const res = await requestWebSerialRotorDevice();
    if (res.success && res.port) {
      setIsRotorSerialConnected(true);
      setConnectedRotorPort(res.port);
      setActionNotice('🔌 Rotor de Antena / Arduino conectado com sucesso na porta serial a 115200 bps!');
    } else {
      setActionNotice(`⚠️ ${res.error || 'Nenhum rotor serial selecionado'}`);
    }
    setTimeout(() => setActionNotice(null), 3500);
  };

  // Loop contínuo de Doppler, cálculo orbital e envio serial de servomotores
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSec((prev) => prev + 1);

      // Recalcular ângulos de apontamento em tempo real
      const angles = calculateSatelliteLookAngles(selectedSatellite, observerLocation, elapsedSec);
      setCalculatedAngles(angles);

      if (isAutoTrackingDish) {
        setManualDishAzimuth(angles.azimuthDeg);
        setManualDishElevation(angles.elevationDeg);
      }

      // Doppler e métricas de sinal
      const doppler = calculateSimulatedDoppler(
        selectedSatellite.downlinkFreqHz,
        selectedSatellite.orbitType,
        selectedSatellite.maxDopplerShiftHz,
        elapsedSec
      );

      const jitterSnr = selectedSatellite.typicalSnrDb + (Math.random() - 0.5) * 1.5;
      const isVisible = angles.isVisible;

      setMetrics((prev) => ({
        ...prev,
        dopplerShiftHz: doppler.dopplerShiftHz,
        elevationDeg: angles.elevationDeg,
        azimuthDeg: angles.azimuthDeg,
        isSatelliteVisible: isVisible,
        snrDb: isVisible ? Math.max(2, Math.round(jitterSnr * 10) / 10) : 0,
        rssiDbm: isVisible ? Math.round(-95 + jitterSnr * 1.8) : -110,
        isCarrierLocked: isVisible && isSdrActive,
        isFrameSynced: isVisible && isSdrActive && jitterSnr > 6,
        throughputKbps: isVisible ? Math.round((selectedSatellite.baudRate / 1000) * 0.8 * 10) / 10 : 0,
        packetsReceived: prev.packetsReceived + (isVisible ? 1 : 0),
        bytesReceived: prev.bytesReceived + (isVisible ? 256 : 0),
      }));

      // Se rotor serial conectado, enviar comando formatado
      const servoCmds = convertLookAnglesToServoCommands(angles, servoMinPulseUs, servoMaxPulseUs);
      const activeCmd =
        rotorProtocol === 'gs232'
          ? servoCmds.gs232Command
          : rotorProtocol === 'easycomm'
          ? servoCmds.easycommCommand
          : servoCmds.arduinoCustomCommand;

      setLastSentRotorCommand(activeCmd.trim());

      if (isRotorSerialConnected && connectedRotorPort) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const writer = (connectedRotorPort as any).writable?.getWriter();
          if (writer) {
            const encoder = new TextEncoder();
            writer.write(encoder.encode(activeCmd));
            writer.releaseLock();
          }
        } catch {}
      }

      // Gateway de internet roteando pacotes
      if (gatewayStatus.isEnabled && isVisible) {
        setGatewayStatus((gw) => ({
          ...gw,
          routedPacketsCount: gw.routedPacketsCount + 2,
        }));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [
    selectedSatellite,
    observerLocation,
    elapsedSec,
    isAutoTrackingDish,
    isSdrActive,
    rotorProtocol,
    servoMinPulseUs,
    servoMaxPulseUs,
    isRotorSerialConnected,
    connectedRotorPort,
    gatewayStatus.isEnabled,
  ]);

  // RENDERIZAÇÃO DA ANTENA PARABÓLICA VIRTUAL 3D (CANVAS 3D ISOMÉTRICO)
  useEffect(() => {
    const canvas = dishCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const renderDish = () => {
      const w = canvas.width;
      const h = canvas.height;

      // Fundo escuro aeroespacial com grid
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, w, h);

      // Grade isométrica de solo
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const activeAz = isAutoTrackingDish ? calculatedAngles.azimuthDeg : manualDishAzimuth;
      const activeEl = isAutoTrackingDish ? calculatedAngles.elevationDeg : manualDishElevation;

      const centerX = w / 2;
      const baseY = h - 70;
      const pivotY = baseY - 80;

      // 1. BASE ROTATIVA DO ROTOR (Disco com graus de azimute)
      ctx.save();
      ctx.translate(centerX, baseY);

      // Anel da base em perspectiva (elipse)
      ctx.beginPath();
      ctx.ellipse(0, 0, 90, 35, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Graus cardeais na base (N, L, S, O)
      ctx.font = '9px monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('N (0°)', -14, -38);
      ctx.fillText('L (90°)', 95, 4);
      ctx.fillText('S (180°)', -18, 45);
      ctx.fillText('O (270°)', -125, 4);

      // Indicador de rotação do rotor de azimute
      const azRad = (activeAz * Math.PI) / 180;
      const pointerX = Math.sin(azRad) * 75;
      const pointerY = -Math.cos(azRad) * 28;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(pointerX, pointerY);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();

      // 2. COLUNA E ARTICULAÇÃO DE ELEVAÇÃO (Mastro Central)
      ctx.beginPath();
      ctx.rect(centerX - 10, pivotY, 20, baseY - pivotY);
      const mastGrad = ctx.createLinearGradient(centerX - 10, 0, centerX + 10, 0);
      mastGrad.addColorStop(0, '#1e293b');
      mastGrad.addColorStop(0.5, '#475569');
      mastGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = mastGrad;
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.stroke();

      // Pivô central articulado (círculo)
      ctx.beginPath();
      ctx.arc(centerX, pivotY, 14, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 3. PRATO PARABÓLICO 3D (Inclinação e Rotação)
      ctx.save();
      ctx.translate(centerX, pivotY);

      // Rotação visual baseada na elevação e projeção do azimute
      const azOffset = Math.sin(azRad) * 0.4;
      const elRad = ((90 - activeEl) * Math.PI) / 180;

      ctx.rotate(-Math.PI / 2 + elRad + azOffset * 0.3);

      // Refletor parabólico curvado
      const dishRadius = 75;
      ctx.beginPath();
      ctx.ellipse(0, 0, dishRadius, 24, 0, 0, Math.PI * 2);
      const dishGrad = ctx.createLinearGradient(-dishRadius, -24, dishRadius, 24);
      dishGrad.addColorStop(0, '#0369a1');
      dishGrad.addColorStop(0.5, '#38bdf8');
      dishGrad.addColorStop(1, '#0284c7');
      ctx.fillStyle = dishGrad;
      ctx.fill();
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Malha interna concêntrica
      ctx.beginPath();
      ctx.ellipse(0, 0, dishRadius * 0.65, 16, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.stroke();

      // 4. ALIMENTADOR FRONTAL & LNB (Haste focal)
      const focalLength = 65;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -focalLength);
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Feed horn / LNB na ponta
      ctx.beginPath();
      ctx.arc(0, -focalLength, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
      ctx.strokeStyle = '#d97706';
      ctx.stroke();

      // 5. FEIXE DE RADIAÇÃO RF (Cone de Transmissão Holográfico)
      if (calculatedAngles.isVisible) {
        ctx.beginPath();
        ctx.moveTo(0, -focalLength);
        ctx.lineTo(-45, -focalLength - 140);
        ctx.lineTo(45, -focalLength - 140);
        ctx.closePath();
        const beamGrad = ctx.createLinearGradient(0, -focalLength, 0, -focalLength - 140);
        beamGrad.addColorStop(0, 'rgba(56, 189, 248, 0.6)');
        beamGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
        ctx.fillStyle = beamGrad;
        ctx.fill();
      }

      ctx.restore();

      // 6. SATÉLITE VIRTUAL DESENHADO NO CÉU
      if (calculatedAngles.isVisible) {
        const satSkyX = centerX + Math.sin(azRad) * (w * 0.38);
        const satSkyY = pivotY - Math.sin((activeEl * Math.PI) / 180) * 150;

        // Corpo do satélite
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(satSkyX - 6, satSkyY - 5, 12, 10);
        ctx.strokeStyle = '#d97706';
        ctx.strokeRect(satSkyX - 6, satSkyY - 5, 12, 10);

        // Painéis solares azuis
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(satSkyX - 22, satSkyY - 3, 14, 6);
        ctx.fillRect(satSkyX + 8, satSkyY - 3, 14, 6);

        // Rótulo do satélite
        ctx.fillStyle = '#38bdf8';
        ctx.font = '10px monospace';
        ctx.fillText(`🛰️ ${selectedSatellite.name.split(' ')[0]}`, satSkyX - 35, satSkyY - 10);
      }

      // 7. HUD DE TELEMETRIA SOBREPOSTO NO TOPO DO CANVAS
      ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
      ctx.fillRect(10, 10, 240, 75);
      ctx.strokeStyle = '#0369a1';
      ctx.lineWidth = 1;
      ctx.strokeRect(10, 10, 240, 75);

      ctx.font = '11px monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`AZIMUTE:   ${activeAz.toFixed(1)}°`, 18, 28);
      ctx.fillStyle = '#34d399';
      ctx.fillText(`ELEVAÇÃO:  ${activeEl.toFixed(1)}°`, 18, 44);
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(`LNB SKEW:  ${calculatedAngles.polarizationSkewDeg.toFixed(1)}°`, 18, 60);
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`DISTÂNCIA: ${calculatedAngles.distanceKm.toLocaleString()} km`, 18, 76);

      animId = requestAnimationFrame(renderDish);
    };

    animId = requestAnimationFrame(renderDish);
    return () => cancelAnimationFrame(animId);
  }, [calculatedAngles, manualDishAzimuth, manualDishElevation, isAutoTrackingDish, selectedSatellite]);

  // RENDERIZAÇÃO DO HUD EM REALIDADE AUMENTADA SOBRE A CÂMERA (AR CANVAS)
  useEffect(() => {
    if (!isArCameraActive) return;

    const canvas = arCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const renderArHud = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const targetAz = calculatedAngles.azimuthDeg;
      const targetEl = calculatedAngles.elevationDeg;

      // Calcular diferença angular com base nos sensores do celular
      const currentAz = deviceOrientation.alpha;
      const currentEl = Math.max(0, deviceOrientation.beta);

      // Normalizar diferença angular (-180 a +180 graus)
      let azDiff = (targetAz - currentAz + 540) % 360 - 180;
      let elDiff = targetEl - currentEl;

      const isAligned = Math.abs(azDiff) < 6 && Math.abs(elDiff) < 6;
      setIsAlignedWithSatellite(isAligned);

      const centerX = w / 2;
      const centerY = h / 2;

      // 1. RETÍCULO TÁTICO HOLOGRÁFICO
      ctx.strokeStyle = isAligned ? '#10b981' : '#38bdf8';
      ctx.lineWidth = isAligned ? 3 : 2;

      // Círculo central da mira
      ctx.beginPath();
      ctx.arc(centerX, centerY, 45, 0, Math.PI * 2);
      ctx.stroke();

      // Cruz central
      ctx.beginPath();
      ctx.moveTo(centerX - 60, centerY);
      ctx.lineTo(centerX - 15, centerY);
      ctx.moveTo(centerX + 15, centerY);
      ctx.lineTo(centerX + 60, centerY);
      ctx.moveTo(centerX, centerY - 60);
      ctx.lineTo(centerX, centerY - 15);
      ctx.moveTo(centerX, centerY + 15);
      ctx.lineTo(centerX, centerY + 60);
      ctx.stroke();

      // 2. INDICADORES DIRECIONAIS SE DESALINHADO
      if (!isAligned) {
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 12px sans-serif';

        // Instruções na tela
        let guideText = '';
        if (Math.abs(azDiff) >= 6) {
          guideText += azDiff > 0 ? `Vire ${Math.round(azDiff)}° à DIREITA ` : `Vire ${Math.round(Math.abs(azDiff))}° à ESQUERDA `;
        }
        if (Math.abs(elDiff) >= 6) {
          guideText += elDiff > 0 ? `| Suba ${Math.round(elDiff)}° ELEVAÇÃO` : `| Desça ${Math.round(Math.abs(elDiff))}° ELEVAÇÃO`;
        }

        ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
        ctx.fillRect(centerX - 170, centerY + 70, 340, 32);
        ctx.strokeStyle = '#f59e0b';
        ctx.strokeRect(centerX - 170, centerY + 70, 340, 32);

        ctx.fillStyle = '#fbbf24';
        ctx.textAlign = 'center';
        ctx.fillText(guideText, centerX, centerY + 91);
        ctx.textAlign = 'start';
      } else {
        // 3. SATÉLITE ENCONTRADO! HOLOGRÁFICO CENTRAL
        ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
        ctx.fillRect(centerX - 160, centerY + 70, 320, 36);
        ctx.strokeStyle = '#10b981';
        ctx.strokeRect(centerX - 160, centerY + 70, 320, 36);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🎯 SATÉLITE ENCONTRADO! ALINHAMENTO ÓTIMO', centerX, centerY + 92);
        ctx.textAlign = 'start';

        // Desenhar satélite virtual na mira
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(centerX - 8, centerY - 6, 16, 12);
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(centerX - 24, centerY - 4, 14, 8);
        ctx.fillRect(centerX + 10, centerY - 4, 14, 8);
      }

      // 4. BÚSSOLA E SENSORES NO TOPO DO AR
      ctx.fillStyle = 'rgba(2, 6, 23, 0.8)';
      ctx.fillRect(10, 10, 260, 60);
      ctx.strokeStyle = '#38bdf8';
      ctx.strokeRect(10, 10, 260, 60);

      ctx.font = '10px monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`ALVO:  Az ${targetAz.toFixed(1)}° | El ${targetEl.toFixed(1)}°`, 18, 28);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(`ATUAL: Az ${currentAz.toFixed(1)}° | El ${currentEl.toFixed(1)}°`, 18, 44);
      ctx.fillStyle = isAligned ? '#10b981' : '#f59e0b';
      ctx.fillText(`ERRO:  ΔAz ${Math.abs(azDiff).toFixed(1)}° | ΔEl ${Math.abs(elDiff).toFixed(1)}°`, 18, 60);

      animId = requestAnimationFrame(renderArHud);
    };

    animId = requestAnimationFrame(renderArHud);
    return () => cancelAnimationFrame(animId);
  }, [isArCameraActive, calculatedAngles, deviceOrientation]);

  // Copiar código de firmware do Arduino
  const handleCopyArduinoCode = () => {
    navigator.clipboard.writeText(ARDUINO_ROTOR_SKETCH_SAMPLE);
    setIsCopiedArduinoCode(true);
    setActionNotice('📋 Código do Arduino copiado para a área de transferência!');
    setTimeout(() => {
      setIsCopiedArduinoCode(false);
      setActionNotice(null);
    }, 3000);
  };

  // Alternar Gateway de Internet
  const handleToggleGateway = () => {
    const newState = !gatewayStatus.isEnabled;
    setGatewayStatus((prev) => ({ ...prev, isEnabled: newState }));
    setActionNotice(newState ? '🌐 Gateway de Internet por Satélite ATIVADO!' : '🛑 Gateway desativado.');
    setTimeout(() => setActionNotice(null), 3000);
  };

  return (
    <div className="space-y-4 font-sans animate-in fade-in pb-12">
      {/* Notificação Flutuante */}
      {actionNotice && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-2xl bg-sky-950/95 text-sky-200 border border-sky-600/60 backdrop-blur-md shadow-2xl flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-top">
          <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* HEADER PRINCIPAL - ESTAÇÃO TERRENA DE SATÉLITE & SDR */}
      <div className="bg-gradient-to-r from-slate-900 via-sky-950/50 to-slate-900 p-5 rounded-3xl border border-sky-900/50 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 via-cyan-500 to-indigo-600 p-0.5 shadow-lg shadow-sky-950 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-sky-400">
                <Satellite className="w-6 h-6 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black text-slate-100 tracking-wide flex items-center gap-2">
                  <span>Internet por Satélite & SDR Gateway</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-700/50 uppercase">
                    Orbital Mesh IP
                  </span>
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 ${
                  metrics.isCarrierLocked ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60' : 'bg-amber-950 text-amber-300 border border-amber-700/60'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${metrics.isCarrierLocked ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
                  {metrics.isCarrierLocked ? 'Portadora Sincronizada' : 'Buscando Portadora'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Rádio Definido por Software • Antena 3D com Rastreamento • Câmera AR com Bússola • Automação de Servos
              </p>
            </div>
          </div>

          {/* SELETOR RÁPIDO DE SATÉLITE & STATUS */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedSatellite.id}
              onChange={(e) => {
                const found = SATELLITE_CATALOG.find((s) => s.id === e.target.value);
                if (found) handleSelectSatellite(found);
              }}
              className="bg-slate-950 border border-sky-700/60 text-sky-300 text-xs rounded-xl px-3 py-1.5 font-mono focus:outline-none focus:border-sky-500 cursor-pointer shadow-inner"
            >
              <optgroup label="🛰️ Comunicação & Internet IP">
                <option value="iridium-next-sbd">Iridium NEXT (1621.25 MHz L-Band LEO)</option>
                <option value="qo100-eshail2-wb">QO-100 / Es'hail-2 (10.489 GHz Ku-Band GEO)</option>
                <option value="inmarsat-4f1-std-c">Inmarsat-4 F1 (1541.45 MHz L-Band GEO)</option>
                <option value="swarm-space-iot">Swarm Space (137.5 MHz VHF LoRa LEO)</option>
              </optgroup>
              <optgroup label="📡 Amador, Espaço & Telemetria">
                <option value="iss-aprs-mesh">ISS / Estação Espacial (145.825 MHz AX.25)</option>
                <option value="noaa-19-weather-data">NOAA-19 (137.100 MHz APT Weather)</option>
              </optgroup>
            </select>

            <button
              type="button"
              onClick={handleToggleGateway}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border flex items-center gap-1.5 transition-all shadow-md ${
                gatewayStatus.isEnabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-emerald-950'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{gatewayStatus.isEnabled ? 'Gateway Ativo' : 'Ativar Internet'}</span>
            </button>
          </div>
        </div>

        {/* FITA DE TELEMETRIA DO APONTAMENTO ASTRONÔMICO */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs font-mono">
          <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-sans">Azimute Alvo</span>
            <strong className="text-sky-300">{calculatedAngles.azimuthDeg.toFixed(1)}°</strong>
          </div>

          <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-sans">Elevação Alvo</span>
            <strong className="text-emerald-300">{calculatedAngles.elevationDeg.toFixed(1)}°</strong>
          </div>

          <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-sans">LNB Skew</span>
            <strong className="text-amber-300">{calculatedAngles.polarizationSkewDeg.toFixed(1)}°</strong>
          </div>

          <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-sans">Distância Slant</span>
            <strong className="text-indigo-300">{calculatedAngles.distanceKm.toLocaleString()} km</strong>
          </div>

          <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-sans">Sinal SNR</span>
            <strong className="text-teal-300">{metrics.snrDb} dB</strong>
          </div>

          <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-sans">Status Visada</span>
            <strong className={calculatedAngles.isVisible ? 'text-emerald-400' : 'text-rose-400'}>
              {calculatedAngles.isVisible ? '🟢 Visível' : '🔴 Oculto'}
            </strong>
          </div>
        </div>
      </div>

      {/* ABAS DE NAVEGAÇÃO DA PÁGINA */}
      <div className="flex bg-slate-900/80 p-1 rounded-2xl border border-slate-800 text-xs font-semibold overflow-x-auto gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('dish3d')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'dish3d'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-950'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Antena Virtual 3D & Apontamento</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('arcamera')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'arcamera'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-950'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Câmera AR & Bússola Visual</span>
          {isAlignedWithSatellite && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rotorservos')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'rotorservos'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-950'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>Automação & Servomotores</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tracking')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'tracking'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-950'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>Radar & Enlace Orbital</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('spectrum')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'spectrum'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-950'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Espectro & Cascata (FFT)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('gateway')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'gateway'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-950'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Gateway de Internet (IP Bridge)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('hardware')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'hardware'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-950'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Hardware SDR Externo</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('parameters')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'parameters'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-950'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Parâmetros de RF</span>
        </button>
      </div>

      {/* CONTEÚDO DAS ABAS */}

      {/* 1. ABA DA ANTENA VIRTUAL 3D (DESENHO DINÂMICO & CÁLCULOS) */}
      {activeTab === 'dish3d' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Canvas da Antena 3D (2 colunas) */}
          <div className="lg:col-span-2 space-y-3">
            <div className="p-4 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Radio className="w-4 h-4 text-sky-400" /> Antena Parabólica Virtual 3D em Movimento
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAutoTrackingDish(!isAutoTrackingDish)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                      isAutoTrackingDish
                        ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isAutoTrackingDish ? 'animate-spin' : ''}`} />
                    <span>{isAutoTrackingDish ? 'Rastreamento Automático Ativo' : 'Modo Manual'}</span>
                  </button>
                </div>
              </div>

              {/* Canvas 3D */}
              <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950 shadow-inner">
                <canvas
                  ref={dishCanvasRef}
                  width={640}
                  height={360}
                  className="w-full h-[360px] block"
                />
              </div>

              {/* Controles Manuais se Auto-Tracking desligado */}
              {!isAutoTrackingDish && (
                <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">
                      Ajuste Manual Azimute: {manualDishAzimuth.toFixed(1)}°
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="0.5"
                      value={manualDishAzimuth}
                      onChange={(e) => setManualDishAzimuth(parseFloat(e.target.value))}
                      className="w-full accent-sky-400 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">
                      Ajuste Manual Elevação: {manualDishElevation.toFixed(1)}°
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="90"
                      step="0.5"
                      value={manualDishElevation}
                      onChange={(e) => setManualDishElevation(parseFloat(e.target.value))}
                      className="w-full accent-emerald-400 cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Coluna Direita: Georreferenciamento GPS & Cálculos de Apontamento */}
          <div className="space-y-4">
            <div className="p-4 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Compass className="w-4 h-4 text-emerald-400" /> Georreferenciamento & GPS
                </h4>
                <button
                  type="button"
                  onClick={handleDetectUserGps}
                  disabled={isDetectingGps}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-950 flex items-center gap-1.5"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>{isDetectingGps ? 'Buscando GPS...' : 'Obter GPS'}</span>
                </button>
              </div>

              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Local:</span>
                  <span className="text-slate-200 truncate max-w-[150px]" title={observerLocation.locationName}>
                    {observerLocation.locationName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Latitude:</span>
                  <strong className="text-sky-300">{observerLocation.latitude}°</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Longitude:</span>
                  <strong className="text-sky-300">{observerLocation.longitude}°</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Altitude:</span>
                  <strong className="text-slate-200">{observerLocation.altitudeMeters} m</strong>
                </div>
              </div>

              {/* Presets Rápidos de Localização */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 uppercase font-mono block">Cidades de Referência Rápida</label>
                <div className="grid grid-cols-2 gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setObserverLocation({ latitude: -23.5505, longitude: -46.6333, altitudeMeters: 760, locationName: 'São Paulo (SP)' })}
                    className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 text-left truncate"
                  >
                    São Paulo (SP)
                  </button>
                  <button
                    type="button"
                    onClick={() => setObserverLocation({ latitude: -15.7975, longitude: -47.8919, altitudeMeters: 1172, locationName: 'Brasília (DF)' })}
                    className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 text-left truncate"
                  >
                    Brasília (DF)
                  </button>
                  <button
                    type="button"
                    onClick={() => setObserverLocation({ latitude: -22.9068, longitude: -43.1729, altitudeMeters: 10, locationName: 'Rio de Janeiro (RJ)' })}
                    className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 text-left truncate"
                  >
                    Rio de Janeiro (RJ)
                  </button>
                  <button
                    type="button"
                    onClick={() => setObserverLocation({ latitude: -3.1190, longitude: -60.0217, altitudeMeters: 92, locationName: 'Manaus (AM)' })}
                    className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 text-left truncate"
                  >
                    Manaus (AM)
                  </button>
                </div>
              </div>
            </div>

            {/* Painel de Apontamento Matemático Exato */}
            <div className="p-4 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-2.5 text-xs font-mono">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-sans flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" /> Solução Angular Ótima
              </h4>

              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Azimute Verdadeiro:</span>
                  <strong className="text-sky-300 text-sm">{calculatedAngles.azimuthDeg.toFixed(1)}°</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Elevação da Parábola:</span>
                  <strong className="text-emerald-300 text-sm">{calculatedAngles.elevationDeg.toFixed(1)}°</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Inclinação Skew LNB:</span>
                  <strong className="text-amber-300 text-sm">{calculatedAngles.polarizationSkewDeg.toFixed(1)}°</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. ABA DO LOCALIZADOR CÂMERA EM REALIDADE AUMENTADA (AR FINDER) */}
      {activeTab === 'arcamera' && (
        <div className="space-y-4">
          <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-sky-400" /> Localizador Visual por Câmera em Realidade Aumentada (AR Finder)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Aponte a câmera do seu celular para o céu: o sistema lê a bússola e desenha o satélite na posição angular exata.
                </p>
              </div>

              <button
                type="button"
                onClick={handleToggleArCamera}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  isArCameraActive
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950'
                    : 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-950'
                }`}
              >
                <Video className="w-4 h-4" />
                <span>{isArCameraActive ? 'Desativar Câmera AR' : 'Ativar Câmera AR & Bússola'}</span>
              </button>
            </div>

            {/* Visualizador de Câmera com Sobreposição Holográfica AR */}
            <div className="relative w-full max-w-3xl mx-auto h-[480px] rounded-3xl overflow-hidden bg-slate-950 border-2 border-sky-900/80 shadow-2xl flex items-center justify-center">
              {/* Elemento de Vídeo Real da Câmera */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`absolute inset-0 w-full h-full object-cover ${!isArCameraActive ? 'hidden' : ''}`}
              />

              {/* Se a câmera estiver desligada, exibir tela de demonstração */}
              {!isArCameraActive && (
                <div className="text-center space-y-3 p-6 z-10 max-w-md">
                  <div className="w-16 h-16 rounded-3xl bg-sky-950/80 border border-sky-500/50 flex items-center justify-center mx-auto text-sky-400">
                    <Smartphone className="w-8 h-8 animate-pulse" />
                  </div>
                  <h4 className="font-bold text-slate-200 text-sm">Visualizador de Realidade Aumentada Desligado</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Clique no botão acima para permitir o uso da câmera traseira e da bússola do aparelho. O aplicativo criará uma mira holográfica para encontrar o satélite no céu.
                  </p>
                  <button
                    type="button"
                    onClick={handleToggleArCamera}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-sky-950 transition-all"
                  >
                    Iniciar Câmera Agora
                  </button>
                </div>
              )}

              {/* Canvas da Mira AR (Sobreposto no Vídeo) */}
              {isArCameraActive && (
                <canvas
                  ref={arCanvasRef}
                  width={720}
                  height={480}
                  className="absolute inset-0 w-full h-full pointer-events-none z-20"
                />
              )}
            </div>

            {/* Painel de Sensores do Celular */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
                <span className="text-slate-400 block font-sans text-[10px]">Bússola Magnética (Azimute do Celular)</span>
                <strong className="text-sky-300 text-base">{deviceOrientation.alpha}°</strong>
              </div>
              <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
                <span className="text-slate-400 block font-sans text-[10px]">Inclinação Tilt (Elevação do Celular)</span>
                <strong className="text-emerald-300 text-base">{deviceOrientation.beta}°</strong>
              </div>
              <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
                <span className="text-slate-400 block font-sans text-[10px]">Status do Alinhamento</span>
                <strong className={isAlignedWithSatellite ? 'text-emerald-400 text-base' : 'text-amber-400 text-base'}>
                  {isAlignedWithSatellite ? '🎯 ALINHADO (99%)' : '🟡 BUSCANDO SATÉLITE'}
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. ABA DE AUTOMAÇÃO PARA SERVOMOTORES & ROTORES (ROTOR CONTROL) */}
      {activeTab === 'rotorservos' && (
        <div className="space-y-4">
          <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400" /> Automação de Servomotores & Rotores (Pan/Tilt Rotor Control)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Gere pulsos PWM em microssegundos e envie comandos industriais (Yaesu GS-232, Easycomm ou Arduino) diretamente via porta serial USB.
                </p>
              </div>

              <button
                type="button"
                onClick={handleConnectRotorSerial}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  isRotorSerialConnected
                    ? 'bg-emerald-600 text-white border border-emerald-400 shadow-emerald-950'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-950'
                }`}
              >
                <Terminal className="w-4 h-4" />
                <span>{isRotorSerialConnected ? 'Rotor Serial Conectado' : 'Conectar Rotor Serial (WebSerial)'}</span>
              </button>
            </div>

            {/* Painel de Conversão de Pulsos PWM para Servomotores */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-slate-400 block font-sans uppercase text-[10px]">Servo 1: Azimute (Pan 0-360°)</span>
                <div className="text-lg font-bold text-sky-300">{calculatedAngles.azimuthDeg.toFixed(1)}°</div>
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400">
                  Pulso PWM: <strong>{convertLookAnglesToServoCommands(calculatedAngles, servoMinPulseUs, servoMaxPulseUs).azimuthPulseUs} µs</strong>
                </div>
              </div>

              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-slate-400 block font-sans uppercase text-[10px]">Servo 2: Elevação (Tilt 0-90°)</span>
                <div className="text-lg font-bold text-emerald-300">{calculatedAngles.elevationDeg.toFixed(1)}°</div>
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400">
                  Pulso PWM: <strong>{convertLookAnglesToServoCommands(calculatedAngles, servoMinPulseUs, servoMaxPulseUs).elevationPulseUs} µs</strong>
                </div>
              </div>

              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-slate-400 block font-sans uppercase text-[10px]">Último Comando Transmitido</span>
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-amber-300 truncate font-mono" title={lastSentRotorCommand}>
                  {lastSentRotorCommand || 'Aguardando envio...'}
                </div>
                <div className="text-[10px] text-slate-500 font-sans">
                  Protocolo: <strong className="text-slate-300">{rotorProtocol.toUpperCase()}</strong> (Atualizado a cada 1s)
                </div>
              </div>
            </div>

            {/* Código C++ Completo para Arduino / ESP32 */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" /> Firmware para Arduino / ESP32 (Pronto para Gravar)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Copie este código para a IDE do Arduino para controlar seus servos SG90 / MG996R conectados nos pinos D9 e D10.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCopyArduinoCode}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  {isCopiedArduinoCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-sky-400" />}
                  <span>{isCopiedArduinoCode ? 'Copiado!' : 'Copiar Código Arduino'}</span>
                </button>
              </div>

              <pre className="p-3 bg-slate-900/90 rounded-xl border border-slate-800/80 font-mono text-[11px] text-emerald-300 max-h-56 overflow-y-auto select-all">
                {ARDUINO_ROTOR_SKETCH_SAMPLE}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* 4. ABA DE RASTREAMENTO & LINK */}
      {activeTab === 'tracking' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="p-4 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Satellite className="w-4 h-4 text-sky-400" /> {selectedSatellite.name}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px]">
                  Órbita: {selectedSatellite.orbitType} ({selectedSatellite.altitudeKm.toLocaleString()} km)
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {selectedSatellite.description}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs font-mono">
                <div className="p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block font-sans">Modulação</span>
                  <strong className="text-sky-300">{selectedSatellite.modulation}</strong>
                </div>
                <div className="p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block font-sans">Baud Rate</span>
                  <strong className="text-emerald-300">{selectedSatellite.baudRate.toLocaleString()} bps</strong>
                </div>
                <div className="p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block font-sans">Polarização</span>
                  <strong className="text-amber-300">{selectedSatellite.polarization}</strong>
                </div>
                <div className="p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block font-sans">Suporte a IP</span>
                  <strong className={selectedSatellite.ipSupport ? 'text-teal-300' : 'text-slate-400'}>
                    {selectedSatellite.ipSupport ? 'Sim (Full IP)' : 'Apenas Telemetria'}
                  </strong>
                </div>
              </div>

              {selectedSatellite.tleLine1 && (
                <div className="mt-3 p-3 rounded-2xl bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-slate-400 space-y-1">
                  <div className="text-[10px] text-slate-500 uppercase font-sans">Dados Orbitais TLE (Two-Line Elements)</div>
                  <div className="text-cyan-400 select-all truncate">{selectedSatellite.tleLine1}</div>
                  <div className="text-cyan-400 select-all truncate">{selectedSatellite.tleLine2}</div>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 bg-slate-900/70 rounded-3xl border border-slate-800 flex flex-col items-center justify-between space-y-4">
            <div className="w-full flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-sky-400" /> Apontamento de Antena
              </span>
              <span className="text-[10px] font-mono text-sky-300 px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800">
                Az: {metrics.azimuthDeg}° | El: {metrics.elevationDeg}°
              </span>
            </div>

            <div className="relative w-48 h-48 rounded-full border-2 border-slate-800 bg-slate-950 flex items-center justify-center shadow-inner">
              <div className="absolute w-36 h-36 rounded-full border border-slate-800/80" />
              <div className="absolute w-24 h-24 rounded-full border border-slate-800/80" />
              <div className="absolute w-12 h-12 rounded-full border border-slate-800/80" />
              <div className="absolute w-full h-[1px] bg-slate-800" />
              <div className="absolute h-full w-[1px] bg-slate-800" />

              <span className="absolute top-1 text-[9px] font-mono text-slate-500 font-bold">N (0°)</span>
              <span className="absolute right-1 text-[9px] font-mono text-slate-500 font-bold">L (90°)</span>
              <span className="absolute bottom-1 text-[9px] font-mono text-slate-500 font-bold">S (180°)</span>
              <span className="absolute left-1 text-[9px] font-mono text-slate-500 font-bold">O (270°)</span>

              <div
                className="absolute w-4 h-4 rounded-full bg-sky-500/30 border border-sky-400 flex items-center justify-center shadow-lg shadow-sky-500/50 transition-all duration-700"
                style={{
                  transform: `rotate(${metrics.azimuthDeg}deg) translate(${Math.max(0, 80 - (metrics.elevationDeg / 90) * 80)}px)`,
                }}
              >
                <div className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. ABA DE ESPECTRO & CASCATA */}
      {activeTab === 'spectrum' && (
        <div className="p-4 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" /> Analisador de Espectro FFT & Cascata Térmica
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-3 space-y-2">
              <div className="rounded-2xl border border-slate-800 overflow-hidden shadow-inner bg-slate-950">
                <canvas ref={spectrumCanvasRef} width={720} height={160} className="w-full h-[160px] block" />
              </div>
              <div className="rounded-2xl border border-slate-800 overflow-hidden shadow-inner bg-slate-950">
                <canvas ref={waterfallCanvasRef} width={720} height={140} className="w-full h-[140px] block" />
              </div>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 flex flex-col items-center justify-between">
              <span className="text-[10px] text-slate-400 uppercase font-mono mb-1">Constelação I/Q</span>
              <div className="rounded-xl border border-slate-800 overflow-hidden">
                <canvas ref={constellationCanvasRef} width={180} height={180} className="w-[180px] h-[180px] block" />
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-2 text-center">
                <div className="text-emerald-400">Trava de Fase OK</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. ABA DE GATEWAY DE INTERNET */}
      {activeTab === 'gateway' && (
        <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Globe className="w-4 h-4 text-sky-400" /> Ponte de Internet via Satélite (Satellite IP Bridge)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Compartilhe a conexão do computador ou receba tráfego de internet através da portadora de satélite.
              </p>
            </div>

            <button
              type="button"
              onClick={handleToggleGateway}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                gatewayStatus.isEnabled ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>{gatewayStatus.isEnabled ? 'Desativar Gateway' : 'Iniciar Gateway IP'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 7. ABA DE HARDWARE SDR */}
      {activeTab === 'hardware' && (
        <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Radio className="w-4 h-4 text-sky-400" /> Interface com Hardware SDR (WebUSB & Serial)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="font-bold text-slate-200 text-xs flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400" /> WebUSB (RTL-SDR & HackRF)
              </div>
              <button
                type="button"
                onClick={async () => {
                  const res = await requestWebUsbSdrDevice();
                  if (res.success && res.deviceName) {
                    setConnectedDeviceName(res.deviceName);
                    setSdrDeviceMode('webusb');
                    setActionNotice(`✅ Conectado: ${res.deviceName}`);
                  }
                }}
                className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition-all"
              >
                Conectar Dongle USB
              </button>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="font-bold text-slate-200 text-xs flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" /> WebSerial (KISS TNC / LoRa)
              </div>
              <button
                type="button"
                onClick={async () => {
                  const res = await requestWebSerialTncDevice();
                  if (res.success && res.portInfo) {
                    setConnectedDeviceName(res.portInfo);
                    setSdrDeviceMode('webserial');
                    setActionNotice(`✅ Conectado: ${res.portInfo}`);
                  }
                }}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all"
              >
                Conectar Porta Serial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. ABA DE PARÂMETROS RF */}
      {activeTab === 'parameters' && (
        <div className="p-5 bg-slate-900/70 rounded-3xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-sky-400" /> Configuração Avançada de Rádio Frequência
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                Frequência Central: {(sdrConfig.centerFrequencyHz / 1e6).toFixed(4)} MHz
              </label>
              <input
                type="range"
                min="100000000"
                max="12000000000"
                step="50000"
                value={sdrConfig.centerFrequencyHz}
                onChange={(e) => setSdrConfig({ ...sdrConfig, centerFrequencyHz: parseInt(e.target.value, 10) })}
                className="w-full accent-sky-400 cursor-pointer"
              />
            </div>
            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                Ganho LNA: {sdrConfig.gainDb} dB
              </label>
              <input
                type="range"
                min="0"
                max="49.6"
                step="0.8"
                value={sdrConfig.gainDb}
                onChange={(e) => setSdrConfig({ ...sdrConfig, gainDb: parseFloat(e.target.value) })}
                className="w-full accent-emerald-400 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
