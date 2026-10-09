import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Globe,
  Eye,
  EyeOff,
  Shield,
  ShieldCheck,
  MessageSquare,
  Radio,
  MapPin,
  Send,
  Navigation,
  Compass,
  Users,
  Search,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  Activity,
  Maximize2,
  Minimize2,
  RotateCw,
  Sliders,
  X,
  Satellite,
  Layers,
  Sun,
  Moon,
  Route,
  Play,
  Pause,
  ChevronRight,
  Filter,
  ArrowRightLeft,
  Radar,
  Info,
} from 'lucide-react';
import {
  GlobeUserNode,
  GlobeCamera,
  apply10kmFuzzyObfuscation,
  calculateHaversineDistance,
  INITIAL_GLOBE_PEERS,
  WORLD_CONTINENT_POLYGONS,
  GLOBAL_MEGACITIES,
  GlobalCityLight,
  ORBITING_SATELLITES,
  OrbitingSatellite,
  getSubsolarPoint,
  getSolarIllumination,
  getSatelliteCoordinates,
  SatelliteCurrentState,
  calculateGreatCirclePath,
  calculatePtPLinkAnalysis,
  PtPLinkAnalysis,
} from '../utils/earth3dEngine';
import { captureGpsLocation } from '../utils/geo';

interface Star {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  color: string;
  twinkleSpeed: number;
}

export const Earth3dMapView: React.FC = () => {
  // Estado de visibilidade no mapa
  const [isVisibleOnMap, setIsVisibleOnMap] = useState<boolean>(false);

  // Perfil público do usuário
  const [userProfile, setUserProfile] = useState<{
    callsign: string;
    fullName: string;
    bio: string;
    status: 'online' | 'busy' | 'away';
    transports: string[];
    city: string;
    country: string;
    flag: string;
    realLat: number;
    realLon: number;
    fuzzyLat: number;
    fuzzyLon: number;
  }>({
    callsign: 'OPERADOR-LOCAL',
    fullName: 'Você (Nó Jjy)',
    bio: 'Disponível na rede para conversar e trocar pacotes via rádio e Wi-Fi.',
    status: 'online',
    transports: ['LoRa Meshtastic', 'Wi-Fi Radar', 'Celular 5G'],
    city: 'São Paulo, SP',
    country: 'Brasil',
    flag: '🇧🇷',
    realLat: -23.5505,
    realLon: -46.6333,
    fuzzyLat: -23.5912,
    fuzzyLon: -46.6854,
  });

  const [peers, setPeers] = useState<GlobeUserNode[]>(INITIAL_GLOBE_PEERS);
  const [selectedPeer, setSelectedPeer] = useState<GlobeUserNode | null>(null);
  const [selectedSatellite, setSelectedSatellite] = useState<OrbitingSatellite | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [transportFilter, setTransportFilter] = useState<string>('all');
  const [distanceFilter, setDistanceFilter] = useState<'all' | 'near' | 'country'>('all');
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [rotationSpeed, setRotationSpeed] = useState<number>(1.0);
  const [rotationDirection, setRotationDirection] = useState<1 | -1>(1);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Modos Visuais do Globo
  const [visualMode, setVisualMode] = useState<'cyberpunk' | 'solar' | 'tactical'>('cyberpunk');

  // Camadas Ativas no Globo
  const [layers, setLayers] = useState({
    peers: true,
    satellites: true,
    meshArcs: true,
    nightLights: true,
    graticule: true,
    privacyHalos: true,
  });
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // Aba lateral ativa: 'peers' | 'satellites' | 'ptp'
  const [activeTab, setActiveTab] = useState<'peers' | 'satellites' | 'ptp'>('peers');

  // Ferramenta de Enlace Ponto a Ponto (PtP) & Traceroute
  const [ptpSourceId, setPtpSourceId] = useState<string>('me_local');
  const [ptpTargetId, setPtpTargetId] = useState<string>('peer_sp_01');
  const [isTracerouteRunning, setIsTracerouteRunning] = useState(false);
  const [tracerouteLogs, setTracerouteLogs] = useState<string[]>([]);
  const [activePtPAnalysis, setActivePtPAnalysis] = useState<PtPLinkAnalysis | null>(null);

  // Chat direto P2P
  const [chatPeer, setChatPeer] = useState<GlobeUserNode | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<Record<string, { sender: 'me' | 'peer'; text: string; time: string }[]>>({});

  // Câmera 3D
  const cameraRef = useRef<GlobeCamera>({
    rotX: 0.35,
    rotY: 1.15,
    scale: 1.0,
  });
  const targetCameraRef = useRef<GlobeCamera>({
    rotX: 0.35,
    rotY: 1.15,
    scale: 1.0,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const mouseDownPosRef = useRef({ x: 0, y: 0 });
  const animFrameIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // Geração de Estrelas Estáticas com Twinkle
  const stars = useMemo<Star[]>(() => {
    const list: Star[] = [];
    const colors = ['#ffffff', '#38bdf8', '#818cf8', '#fef08a', '#a7f3d0', '#e0e7ff'];
    for (let i = 0; i < 180; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 0.08 + Math.random() * 0.92;
      list.push({
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        radius: 0.6 + Math.random() * 1.6,
        baseAlpha: 0.35 + Math.random() * 0.65,
        color: colors[Math.floor(Math.random() * colors.length)],
        twinkleSpeed: 0.8 + Math.random() * 2.5,
      });
    }
    return list;
  }, []);

  // Carregar preferências salvas do localStorage
  useEffect(() => {
    try {
      const savedVisible = localStorage.getItem('jjy_globe_is_visible');
      if (savedVisible !== null) {
        setIsVisibleOnMap(savedVisible === 'true');
      }

      const savedProfile = localStorage.getItem('jjy_globe_user_profile');
      if (savedProfile) {
        setUserProfile(JSON.parse(savedProfile));
      }
    } catch {}

    // Obter GPS e aplicar ofuscação de 10 km
    captureGpsLocation().then((loc) => {
      if (loc) {
        const fuzz = apply10kmFuzzyObfuscation(loc.latitude, loc.longitude, 'my_local_node');
        setUserProfile((prev) => ({
          ...prev,
          realLat: loc.latitude,
          realLon: loc.longitude,
          fuzzyLat: fuzz.fuzzyLat,
          fuzzyLon: fuzz.fuzzyLon,
          country: loc.country || prev.country,
          flag: loc.flag || prev.flag,
        }));
      }
    });
  }, []);

  const handleToggleVisibility = (newValue: boolean) => {
    setIsVisibleOnMap(newValue);
    localStorage.setItem('jjy_globe_is_visible', String(newValue));
    if (newValue) {
      focusOnCoordinates(userProfile.fuzzyLat, userProfile.fuzzyLon);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('jjy_globe_user_profile', JSON.stringify(userProfile));
    setShowProfileEditor(false);
    alert('Perfil público atualizado! Sua localização permanece protegida com 10 km de erro proposital.');
  };

  // Focar suavemente a câmera 3D em uma coordenada geográfica
  const focusOnCoordinates = (lat: number, lon: number, zoomScale: number = 1.15) => {
    setIsAutoRotating(false);
    const targetRotY = -((lon * Math.PI) / 180) + Math.PI / 2;
    const targetRotX = (lat * Math.PI) / 180;

    targetCameraRef.current.rotX = Math.max(-1.3, Math.min(1.3, targetRotX));
    targetCameraRef.current.rotY = targetRotY;
    targetCameraRef.current.scale = zoomScale;
  };

  // Presets de Câmera Rápida
  const handleApplyPreset = (preset: 'brasil' | 'eua' | 'europa' | 'asia' | 'me') => {
    if (preset === 'brasil') {
      focusOnCoordinates(-14.235, -51.9253, 1.1);
    } else if (preset === 'eua') {
      focusOnCoordinates(37.0902, -95.7129, 1.1);
    } else if (preset === 'europa') {
      focusOnCoordinates(48.8566, 12.3522, 1.15);
    } else if (preset === 'asia') {
      focusOnCoordinates(34.0479, 110.063, 1.05);
    } else if (preset === 'me') {
      focusOnCoordinates(userProfile.fuzzyLat, userProfile.fuzzyLon, 1.35);
    }
  };

  // Recalcular Enlace PtP quando origem ou destino mudam
  useEffect(() => {
    const getNodeCoords = (id: string): { lat: number; lon: number } | null => {
      if (id === 'me_local') {
        return { lat: userProfile.fuzzyLat, lon: userProfile.fuzzyLon };
      }
      const foundPeer = peers.find((p) => p.id === id);
      if (foundPeer) return { lat: foundPeer.fuzzyLat, lon: foundPeer.fuzzyLon };
      return null;
    };

    const c1 = getNodeCoords(ptpSourceId);
    const c2 = getNodeCoords(ptpTargetId);

    if (c1 && c2) {
      const analysis = calculatePtPLinkAnalysis(c1.lat, c1.lon, c2.lat, c2.lon, 915);
      setActivePtPAnalysis(analysis);
    } else {
      setActivePtPAnalysis(null);
    }
  }, [ptpSourceId, ptpTargetId, peers, userProfile]);

  // Executar Simulação de Traceroute 3D
  const runTracerouteSimulation = () => {
    if (isTracerouteRunning || !activePtPAnalysis) return;

    setIsTracerouteRunning(true);
    setTracerouteLogs([]);

    const steps = [
      `[INICIANDO TRACEROUTE] Destino: ${ptpTargetId === 'me_local' ? 'Você' : ptpTargetId}`,
      `TTL=1: Nó Origem [Local] -> Gateway Mesh RF (0.8 ms, RSSI: -54 dBm)`,
      `TTL=2: Repetidor Tático JJY Intermediário (4.2 ms, SNR: +11.2 dB)`,
      `TTL=3: Roteador Mesh Backbone P2P (11.5 ms, 0% perda de pacotes)`,
      `TTL=4: Alvo alcançado com sucesso! RTT Total: ${activePtPAnalysis.propagationDelayMs + 14} ms | Enlace Estável.`,
    ];

    steps.forEach((step, idx) => {
      setTimeout(() => {
        setTracerouteLogs((prev) => [...prev, step]);
        if (idx === steps.length - 1) {
          setIsTracerouteRunning(false);
        }
      }, (idx + 1) * 700);
    });
  };

  // Alternar tela cheia
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Enviar mensagem no chat P2P
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatPeer || !chatMessage.trim()) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msg = chatMessage.trim();

    setChatMessages((prev) => {
      const currentList = prev[chatPeer.id] || [];
      return {
        ...prev,
        [chatPeer.id]: [...currentList, { sender: 'me', text: msg, time: timeStr }],
      };
    });

    setChatMessage('');

    // Resposta P2P automatizada simulada do operador
    setTimeout(() => {
      setChatMessages((prev) => {
        const currentList = prev[chatPeer.id] || [];
        const responses = [
          `Olá! Sinal recebido com sucesso via ${chatPeer.transports[0]}. Tudo bem por aí?`,
          `Positivo! Estou operando aqui em ${chatPeer.city}. Enlace verificado em ${chatPeer.rttMs} ms.`,
          `Mensagem lida com sucesso! Bom te ver no mapa 3D da rede Jjy.`,
        ];
        const randomResp = responses[Math.floor(Math.random() * responses.length)];
        return {
          ...prev,
          [chatPeer.id]: [
            ...currentList,
            { sender: 'peer', text: randomResp, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
          ],
        };
      });
    }, 1200);
  };

  // ==========================================================================
  // RENDERIZADOR SUPREMO DO GLOBO 3D DA TERRA NO CANVAS
  // ==========================================================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const render = () => {
      if (!isRunning) return;

      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      ctx.clearRect(0, 0, width, height);

      const elapsedSec = (Date.now() - startTimeRef.current) / 1000;

      // Interpolação suave de Câmera (Damping / Slerp suave)
      if (!isDraggingRef.current) {
        cameraRef.current.rotX += (targetCameraRef.current.rotX - cameraRef.current.rotX) * 0.08;

        let diffY = targetCameraRef.current.rotY - cameraRef.current.rotY;
        while (diffY > Math.PI) diffY -= 2 * Math.PI;
        while (diffY < -Math.PI) diffY += 2 * Math.PI;
        cameraRef.current.rotY += diffY * 0.08;

        cameraRef.current.scale += (targetCameraRef.current.scale - cameraRef.current.scale) * 0.08;
      }

      // Auto rotação contínua
      if (isAutoRotating && !isDraggingRef.current) {
        const speedDelta = 0.0028 * rotationSpeed * rotationDirection;
        cameraRef.current.rotY += speedDelta;
        targetCameraRef.current.rotY += speedDelta;
      }

      const cx = width / 2;
      const cy = height / 2;
      const baseRadius = Math.min(width, height) * 0.40 * cameraRef.current.scale;

      const rotX = cameraRef.current.rotX;
      const rotY = cameraRef.current.rotY;

      // Ponto subsolar para simulação de dia/noite em tempo real
      const subsolar = getSubsolarPoint(new Date());

      // ----------------------------------------------------------------------
      // 1. ESPAÇO SIDERAL PROFUNDO & NEBULOSA
      // ----------------------------------------------------------------------
      const spaceBg =
        visualMode === 'tactical'
          ? '#021008'
          : visualMode === 'solar'
          ? '#020617'
          : '#03071e';
      ctx.fillStyle = spaceBg;
      ctx.fillRect(0, 0, width, height);

      // Faint Cosmic Nebula glow
      if (visualMode !== 'tactical') {
        const nebulaGrad = ctx.createRadialGradient(
          cx + baseRadius * 0.6,
          cy - baseRadius * 0.5,
          10,
          cx + baseRadius * 0.6,
          cy - baseRadius * 0.5,
          Math.max(width, height) * 0.8
        );
        nebulaGrad.addColorStop(0, 'rgba(56, 189, 248, 0.07)');
        nebulaGrad.addColorStop(0.4, 'rgba(99, 102, 241, 0.04)');
        nebulaGrad.addColorStop(1, 'rgba(2, 6, 23, 0)');
        ctx.fillStyle = nebulaGrad;
        ctx.fillRect(0, 0, width, height);
      }

      // Estrelas cintilantes no cosmos
      stars.forEach((star, idx) => {
        const sx = cx + star.x * Math.max(width, height) * 0.72;
        const sy = cy + star.y * Math.max(width, height) * 0.72;
        if (sx >= 0 && sx <= width && sy >= 0 && sy <= height) {
          const twinkle = 0.65 + 0.35 * Math.sin(elapsedSec * star.twinkleSpeed + idx);
          ctx.fillStyle = visualMode === 'tactical' ? '#4ade80' : star.color;
          ctx.globalAlpha = star.baseAlpha * twinkle * (visualMode === 'tactical' ? 0.4 : 0.85);
          ctx.beginPath();
          ctx.arc(sx, sy, star.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1.0;

      // ----------------------------------------------------------------------
      // 2. CORONA ATMOSFÉRICA & GLOW MULTICAMADA
      // ----------------------------------------------------------------------
      const atmoRadius = baseRadius * 1.18;
      const atmoGrad = ctx.createRadialGradient(cx, cy, baseRadius * 0.94, cx, cy, atmoRadius);

      if (visualMode === 'tactical') {
        atmoGrad.addColorStop(0, 'rgba(34, 197, 94, 0.35)');
        atmoGrad.addColorStop(0.4, 'rgba(16, 185, 129, 0.15)');
        atmoGrad.addColorStop(1, 'rgba(2, 16, 8, 0)');
      } else if (visualMode === 'solar') {
        atmoGrad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
        atmoGrad.addColorStop(0.5, 'rgba(99, 102, 241, 0.18)');
        atmoGrad.addColorStop(1, 'rgba(2, 6, 23, 0)');
      } else {
        // Cyberpunk Neon
        atmoGrad.addColorStop(0, 'rgba(6, 182, 212, 0.55)');
        atmoGrad.addColorStop(0.4, 'rgba(129, 140, 248, 0.25)');
        atmoGrad.addColorStop(0.8, 'rgba(236, 72, 153, 0.08)');
        atmoGrad.addColorStop(1, 'rgba(3, 7, 30, 0)');
      }

      ctx.fillStyle = atmoGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, atmoRadius, 0, Math.PI * 2);
      ctx.fill();

      // ----------------------------------------------------------------------
      // 3. ESFERA OCEÂNICA TERRESTRE
      // ----------------------------------------------------------------------
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
      ctx.clip(); // Limita todo o desenho do planeta à sua superfície

      // Gradiente do Oceano Terrestre
      const oceanGrad = ctx.createRadialGradient(
        cx - baseRadius * 0.35,
        cy - baseRadius * 0.35,
        baseRadius * 0.1,
        cx,
        cy,
        baseRadius
      );

      if (visualMode === 'tactical') {
        oceanGrad.addColorStop(0, '#062817');
        oceanGrad.addColorStop(0.7, '#03170d');
        oceanGrad.addColorStop(1, '#010a05');
      } else if (visualMode === 'solar') {
        oceanGrad.addColorStop(0, '#10396b');
        oceanGrad.addColorStop(0.65, '#071e3d');
        oceanGrad.addColorStop(1, '#020b18');
      } else {
        // Cyberpunk
        oceanGrad.addColorStop(0, '#0f274a');
        oceanGrad.addColorStop(0.65, '#07162e');
        oceanGrad.addColorStop(1, '#020914');
      }

      ctx.fillStyle = oceanGrad;
      ctx.fillRect(0, 0, width, height);

      // Função de Projeção Esférica Tridimensional (com suporte a Altitude)
      const project3D = (lat: number, lon: number, altFactor: number = 1.0) => {
        const latRad = (lat * Math.PI) / 180;
        const lonRad = (lon * Math.PI) / 180;
        const r = baseRadius * altFactor;

        const px = Math.cos(latRad) * Math.sin(lonRad - rotY);
        const py = Math.sin(latRad);
        const pz = Math.cos(latRad) * Math.cos(lonRad - rotY);

        const rotY_val = py * Math.cos(rotX) - pz * Math.sin(rotX);
        const rotZ_val = py * Math.sin(rotX) + pz * Math.cos(rotX);

        const screenX = cx + px * r;
        const screenY = cy - rotY_val * r;

        return {
          x: screenX,
          y: screenY,
          z: rotZ_val,
          visible: rotZ_val > (altFactor > 1.0 ? -0.25 : 0),
        };
      };

      // ----------------------------------------------------------------------
      // 4. GRADE GEODÉSICA DE MERIDIANOS E PARALELOS (GRATICULE)
      // ----------------------------------------------------------------------
      if (layers.graticule) {
        ctx.strokeStyle =
          visualMode === 'tactical'
            ? 'rgba(74, 222, 128, 0.15)'
            : 'rgba(56, 189, 248, 0.12)';
        ctx.lineWidth = 1;

        // Paralelos (Latitudes de -75° a +75°)
        for (let lat = -75; lat <= 75; lat += 25) {
          ctx.beginPath();
          let first = true;
          for (let lon = -180; lon <= 180; lon += 4) {
            const pt = project3D(lat, lon);
            if (pt.visible) {
              if (first) {
                ctx.moveTo(pt.x, pt.y);
                first = false;
              } else {
                ctx.lineTo(pt.x, pt.y);
              }
            } else {
              first = true;
            }
          }
          ctx.stroke();
        }

        // Meridianos (Longitudes de -180° a +180°)
        for (let lon = -180; lon <= 180; lon += 30) {
          ctx.beginPath();
          let first = true;
          for (let lat = -80; lat <= 80; lat += 4) {
            const pt = project3D(lat, lon);
            if (pt.visible) {
              if (first) {
                ctx.moveTo(pt.x, pt.y);
                first = false;
              } else {
                ctx.lineTo(pt.x, pt.y);
              }
            } else {
              first = true;
            }
          }
          ctx.stroke();
        }

        // Linha do Equador em Destaque
        ctx.strokeStyle =
          visualMode === 'tactical'
            ? 'rgba(34, 197, 94, 0.4)'
            : 'rgba(6, 182, 212, 0.35)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        let eqFirst = true;
        for (let lon = -180; lon <= 180; lon += 3) {
          const pt = project3D(0, lon);
          if (pt.visible) {
            if (eqFirst) {
              ctx.moveTo(pt.x, pt.y);
              eqFirst = false;
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          } else {
            eqFirst = true;
          }
        }
        ctx.stroke();
      }

      // ----------------------------------------------------------------------
      // 5. CONTINENTES TERRESTRES (POLÍGONOS VETORIAIS COM SHADING)
      // ----------------------------------------------------------------------
      WORLD_CONTINENT_POLYGONS.forEach((poly) => {
        ctx.beginPath();
        let isStarted = false;

        poly.points.forEach(([pLat, pLon]) => {
          const pt = project3D(pLat, pLon);
          if (pt.visible) {
            if (!isStarted) {
              ctx.moveTo(pt.x, pt.y);
              isStarted = true;
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          }
        });

        if (isStarted) {
          ctx.closePath();

          if (visualMode === 'tactical') {
            ctx.fillStyle = 'rgba(34, 197, 94, 0.18)';
            ctx.strokeStyle = 'rgba(74, 222, 128, 0.55)';
            ctx.lineWidth = 1.3;
          } else if (visualMode === 'solar') {
            // No modo solar, shading leve por iluminação
            ctx.fillStyle = 'rgba(16, 185, 129, 0.22)';
            ctx.strokeStyle = 'rgba(52, 211, 153, 0.5)';
            ctx.lineWidth = 1.2;
          } else {
            // Cyberpunk Neon
            ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
            ctx.strokeStyle = 'rgba(52, 211, 153, 0.6)';
            ctx.lineWidth = 1.4;
          }

          ctx.fill();
          ctx.stroke();
        }
      });

      // ----------------------------------------------------------------------
      // 6. TERMINADOR SOLAR (SOMBRA DA NOITE EM TEMPO REAL)
      // ----------------------------------------------------------------------
      if (visualMode === 'solar') {
        // Overlay de Escuridão Noturna realista
        const sunPt = project3D(subsolar.lat, subsolar.lon);
        // Anti-sol
        const antiSunPt = project3D(-subsolar.lat, (subsolar.lon + 180) % 360);

        const nightGrad = ctx.createRadialGradient(
          antiSunPt.x,
          antiSunPt.y,
          baseRadius * 0.15,
          antiSunPt.x,
          antiSunPt.y,
          baseRadius * 1.6
        );
        nightGrad.addColorStop(0, 'rgba(1, 4, 12, 0.88)');
        nightGrad.addColorStop(0.5, 'rgba(2, 6, 18, 0.72)');
        nightGrad.addColorStop(0.85, 'rgba(4, 12, 32, 0.25)');
        nightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = nightGrad;
        ctx.fillRect(0, 0, width, height);
      }

      // ----------------------------------------------------------------------
      // 7. LUZES DE MEGACIDADES NOTURNAS (TWINKLING CITY LIGHTS)
      // ----------------------------------------------------------------------
      if (layers.nightLights) {
        GLOBAL_MEGACITIES.forEach((city, idx) => {
          const illum = getSolarIllumination(city.lat, city.lon, subsolar);
          // Apenas visíveis quando estiver de noite ou modo cyberpunk
          if (visualMode === 'solar' && illum > 0.4) return;

          const pt = project3D(city.lat, city.lon);
          if (pt.visible) {
            const twinkle = 0.6 + 0.4 * Math.sin(elapsedSec * 3 + idx * 2);
            const cityAlpha = (visualMode === 'solar' ? (1.0 - illum) : 0.7) * twinkle;

            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 1.8 * city.brightness, 0, Math.PI * 2);
            ctx.fillStyle =
              visualMode === 'tactical'
                ? `rgba(74, 222, 128, ${cityAlpha})`
                : `rgba(251, 191, 36, ${cityAlpha})`;
            ctx.fill();

            // Glow sutil ao redor da metrópole
            if (city.brightness > 0.85) {
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, 3.8, 0, Math.PI * 2);
              ctx.fillStyle =
                visualMode === 'tactical'
                  ? `rgba(34, 197, 94, ${cityAlpha * 0.3})`
                  : `rgba(245, 158, 11, ${cityAlpha * 0.35})`;
              ctx.fill();
            }
          }
        });
      }

      // ----------------------------------------------------------------------
      // 8. ARCOS DE COMUNICAÇÃO MESH 3D (SLERP CURVADOS NO ESPAÇO)
      // ----------------------------------------------------------------------
      const activePeers = [...peers];
      if (isVisibleOnMap) {
        activePeers.push({
          id: 'me_local',
          callsign: userProfile.callsign,
          fullName: userProfile.fullName,
          fuzzyLat: userProfile.fuzzyLat,
          fuzzyLon: userProfile.fuzzyLon,
          fuzzRadiusKm: 10,
          country: userProfile.country,
          flag: userProfile.flag,
          city: userProfile.city,
          status: userProfile.status,
          bio: userProfile.bio,
          transports: userProfile.transports,
          isLocalUser: true,
          isVisibleOnMap: true,
          lastSeen: 'Agora',
          avatarBg: 'from-amber-500 to-emerald-500',
          signalStrengthDbm: -45,
          rttMs: 1,
        });
      }

      if (layers.meshArcs) {
        for (let i = 0; i < Math.min(activePeers.length, 6); i++) {
          const p1 = activePeers[i];
          const p2 = activePeers[(i + 1) % activePeers.length];
          const arcPoints = calculateGreatCirclePath(p1.fuzzyLat, p1.fuzzyLon, p2.fuzzyLat, p2.fuzzyLon, 24);

          ctx.beginPath();
          let isArcStarted = false;

          arcPoints.forEach((step) => {
            const pt = project3D(step.lat, step.lon, 1.0 + step.heightOffset);
            if (pt.visible) {
              if (!isArcStarted) {
                ctx.moveTo(pt.x, pt.y);
                isArcStarted = true;
              } else {
                ctx.lineTo(pt.x, pt.y);
              }
            } else {
              isArcStarted = false;
            }
          });

          ctx.strokeStyle =
            visualMode === 'tactical'
              ? 'rgba(34, 197, 94, 0.45)'
              : 'rgba(6, 182, 212, 0.4)';
          ctx.lineWidth = 1.4;
          ctx.setLineDash([3, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Fótons de Pacotes Pulsantes viajando ao longo do arco
          const photonProg = ((elapsedSec * 0.35 + i * 0.22) % 1.0);
          const photonIdx = Math.floor(photonProg * (arcPoints.length - 1));
          const stepTarget = arcPoints[photonIdx];
          if (stepTarget) {
            const photonPt = project3D(stepTarget.lat, stepTarget.lon, 1.0 + stepTarget.heightOffset);
            if (photonPt.visible) {
              ctx.beginPath();
              ctx.arc(photonPt.x, photonPt.y, 2.5, 0, Math.PI * 2);
              ctx.fillStyle = '#ffffff';
              ctx.fill();
              ctx.beginPath();
              ctx.arc(photonPt.x, photonPt.y, 5, 0, Math.PI * 2);
              ctx.fillStyle =
                visualMode === 'tactical' ? 'rgba(74, 222, 128, 0.5)' : 'rgba(56, 189, 248, 0.6)';
              ctx.fill();
            }
          }
        }
      }

      // Enlace PTP em Destaque Especial (se ativo)
      if (activePtPAnalysis) {
        const getNodeCoords = (id: string) => {
          if (id === 'me_local') return { lat: userProfile.fuzzyLat, lon: userProfile.fuzzyLon };
          const p = peers.find((item) => item.id === id);
          return p ? { lat: p.fuzzyLat, lon: p.fuzzyLon } : null;
        };

        const c1 = getNodeCoords(ptpSourceId);
        const c2 = getNodeCoords(ptpTargetId);

        if (c1 && c2) {
          const ptpPath = calculateGreatCirclePath(c1.lat, c1.lon, c2.lat, c2.lon, 28);
          ctx.beginPath();
          let started = false;
          ptpPath.forEach((step) => {
            const pt = project3D(step.lat, step.lon, 1.0 + step.heightOffset * 1.3);
            if (pt.visible) {
              if (!started) {
                ctx.moveTo(pt.x, pt.y);
                started = true;
              } else {
                ctx.lineTo(pt.x, pt.y);
              }
            } else {
              started = false;
            }
          });

          // Feixe laser pulsante
          ctx.strokeStyle = isTracerouteRunning
            ? 'rgba(239, 68, 68, 0.9)'
            : 'rgba(234, 179, 8, 0.85)';
          ctx.lineWidth = 2.4;
          ctx.stroke();

          // Partícula Traceroute animada em trânsito
          if (isTracerouteRunning) {
            const traceT = ((elapsedSec * 1.2) % 1.0);
            const traceIdx = Math.floor(traceT * (ptpPath.length - 1));
            const stepT = ptpPath[traceIdx];
            if (stepT) {
              const tracePt = project3D(stepT.lat, stepT.lon, 1.0 + stepT.heightOffset * 1.3);
              if (tracePt.visible) {
                ctx.beginPath();
                ctx.arc(tracePt.x, tracePt.y, 4.5, 0, Math.PI * 2);
                ctx.fillStyle = '#ef4444';
                ctx.fill();
                ctx.beginPath();
                ctx.arc(tracePt.x, tracePt.y, 9, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
                ctx.fill();
              }
            }
          }
        }
      }

      // ----------------------------------------------------------------------
      // 9. SATÉLITES ORBITAIS 3D & CONES DE COBERTURA
      // ----------------------------------------------------------------------
      if (layers.satellites) {
        ORBITING_SATELLITES.forEach((sat) => {
          const state = getSatelliteCoordinates(sat, elapsedSec);

          // Desenhar Anel da Órbita no Espaço Tridimensional
          ctx.beginPath();
          let orbStarted = false;
          const incRad = (sat.inclinationDeg * Math.PI) / 180;
          const earthRotDeriv = (elapsedSec / 86400) * 360;

          for (let step = 0; step <= 360; step += 8) {
            const phase = (step * Math.PI) / 180;
            const latR = Math.asin(Math.sin(incRad) * Math.sin(phase));
            const latD = (latR * 180) / Math.PI;
            const nodeL = Math.atan2(Math.cos(incRad) * Math.sin(phase), Math.cos(phase));
            let lonD = (nodeL * 180) / Math.PI - earthRotDeriv;
            lonD = ((((lonD + 180) % 360) + 360) % 360) - 180;

            const orbPt = project3D(latD, lonD, state.altFactor);
            if (orbPt.visible) {
              if (!orbStarted) {
                ctx.moveTo(orbPt.x, orbPt.y);
                orbStarted = true;
              } else {
                ctx.lineTo(orbPt.x, orbPt.y);
              }
            } else {
              orbStarted = false;
            }
          }

          ctx.strokeStyle = sat.color;
          ctx.globalAlpha = 0.28;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 5]);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1.0;

          // Posição Atual do Satélite no Espaço
          const satPt = project3D(state.lat, state.lon, state.altFactor);
          const groundPt = project3D(state.lat, state.lon, 1.0);

          if (satPt.visible) {
            // Linha de Tethering (amarração visual ao ponto do solo)
            if (groundPt.visible) {
              ctx.beginPath();
              ctx.moveTo(groundPt.x, groundPt.y);
              ctx.lineTo(satPt.x, satPt.y);
              ctx.strokeStyle = sat.color;
              ctx.globalAlpha = 0.35;
              ctx.lineWidth = 0.8;
              ctx.stroke();
              ctx.globalAlpha = 1.0;

              // Ponto do solo (Nadir)
              ctx.beginPath();
              ctx.arc(groundPt.x, groundPt.y, 2, 0, Math.PI * 2);
              ctx.fillStyle = sat.color;
              ctx.fill();
            }

            const isSatSelected = selectedSatellite?.id === sat.id;

            // Corpo do Satélite e Asas Solares
            ctx.save();
            ctx.translate(satPt.x, satPt.y);

            // Asas solares fotovoltaicas
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(-7, -1.2, 4.5, 2.4);
            ctx.fillRect(2.5, -1.2, 4.5, 2.4);

            // Núcleo do corpo do satélite
            ctx.fillStyle = isSatSelected ? '#ffffff' : sat.color;
            ctx.fillRect(-2.5, -2.5, 5, 5);

            // Baliza intermitente
            if (Math.sin(elapsedSec * 5) > 0) {
              ctx.beginPath();
              ctx.arc(0, 0, isSatSelected ? 5 : 3.5, 0, Math.PI * 2);
              ctx.fillStyle = sat.color;
              ctx.globalAlpha = 0.6;
              ctx.fill();
              ctx.globalAlpha = 1.0;
            }

            ctx.restore();

            // Rótulo do Satélite
            ctx.fillStyle = '#e2e8f0';
            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(sat.name, satPt.x, satPt.y - 8);
          }
        });
      }

      // ----------------------------------------------------------------------
      // 10. NÓS DE OPERADORES & RAIO DE PRIVACIDADE DE 10 KM COM RADAR SONAR
      // ----------------------------------------------------------------------
      if (layers.peers) {
        activePeers.forEach((node) => {
          const pt = project3D(node.fuzzyLat, node.fuzzyLon);
          if (!pt.visible) return;

          const isMe = node.isLocalUser;
          const isSelected = selectedPeer?.id === node.id;
          const radius10kmPixels = Math.max(14, 22 * cameraRef.current.scale);

          // Efeito Sonar Radar Expandindo (Differential Privacy Pulse)
          if (layers.privacyHalos) {
            const sonarT = ((elapsedSec * 0.8 + (isMe ? 0 : 0.5)) % 1.0);
            const sonarRadius = radius10kmPixels * (0.8 + sonarT * 0.7);
            const sonarAlpha = Math.max(0, 0.45 * (1.0 - sonarT));

            ctx.beginPath();
            ctx.arc(pt.x, pt.y, sonarRadius, 0, Math.PI * 2);
            ctx.strokeStyle = isMe
              ? `rgba(234, 179, 8, ${sonarAlpha})`
              : `rgba(6, 182, 212, ${sonarAlpha})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // Círculo base da zona de 10 km
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, radius10kmPixels, 0, Math.PI * 2);
            ctx.fillStyle = isMe
              ? 'rgba(234, 179, 8, 0.16)'
              : isSelected
              ? 'rgba(6, 182, 212, 0.28)'
              : 'rgba(59, 130, 246, 0.12)';
            ctx.fill();
            ctx.strokeStyle = isMe
              ? 'rgba(234, 179, 8, 0.7)'
              : isSelected
              ? 'rgba(6, 182, 212, 0.9)'
              : 'rgba(59, 130, 246, 0.4)';
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.stroke();
          }

          // Ponto Central do Nó
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, isMe ? 5 : 4, 0, Math.PI * 2);
          ctx.fillStyle = isMe ? '#eab308' : isSelected ? '#06b6d4' : '#10b981';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Rótulo do Callsign
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(node.callsign, pt.x, pt.y - radius10kmPixels - 4);

          if (isMe) {
            ctx.fillStyle = '#fde047';
            ctx.font = 'bold 8px sans-serif';
            ctx.fillText('VOCÊ (±10km)', pt.x, pt.y + radius10kmPixels + 11);
          }
        });
      }

      ctx.restore(); // Fecha o clip da esfera

      // ----------------------------------------------------------------------
      // 11. BORDA LIMÍTROFE DO PLANETA & ANEL DE HORIZONTE
      // ----------------------------------------------------------------------
      ctx.strokeStyle =
        visualMode === 'tactical'
          ? 'rgba(74, 222, 128, 0.6)'
          : visualMode === 'solar'
          ? 'rgba(56, 189, 248, 0.5)'
          : 'rgba(6, 182, 212, 0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
      ctx.stroke();

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [
    isAutoRotating,
    rotationSpeed,
    rotationDirection,
    visualMode,
    layers,
    isVisibleOnMap,
    peers,
    selectedPeer,
    selectedSatellite,
    userProfile,
    stars,
    activePtPAnalysis,
    ptpSourceId,
    ptpTargetId,
    isTracerouteRunning,
  ]);

  // Manipulação de Mouse e Toque para Rotação e Cliques 3D
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    setIsAutoRotating(false);
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;

    cameraRef.current.rotY += dx * 0.006;
    targetCameraRef.current.rotY = cameraRef.current.rotY;

    cameraRef.current.rotX = Math.max(-1.3, Math.min(1.3, cameraRef.current.rotX + dy * 0.006));
    targetCameraRef.current.rotX = cameraRef.current.rotX;

    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const dragDistance = Math.hypot(
      e.clientX - mouseDownPosRef.current.x,
      e.clientY - mouseDownPosRef.current.y
    );

    // Se foi um clique direto sem arrastar (< 5px)
    if (dragDistance < 5) {
      handleCanvasClick(e);
    }

    isDraggingRef.current = false;
  };

  // Detecção de clique em Nós e Satélites no Canvas (Raycasting 2D)
  const handleCanvasClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const width = rect.width;
    const height = rect.height;
    const cx = width / 2;
    const cy = height / 2;
    const baseRadius = Math.min(width, height) * 0.40 * cameraRef.current.scale;
    const rotX = cameraRef.current.rotX;
    const rotY = cameraRef.current.rotY;

    const project = (lat: number, lon: number, altFactor: number = 1.0) => {
      const latRad = (lat * Math.PI) / 180;
      const lonRad = (lon * Math.PI) / 180;
      const r = baseRadius * altFactor;

      const px = Math.cos(latRad) * Math.sin(lonRad - rotY);
      const py = Math.sin(latRad);
      const pz = Math.cos(latRad) * Math.cos(lonRad - rotY);

      const rotY_val = py * Math.cos(rotX) - pz * Math.sin(rotX);
      const rotZ_val = py * Math.sin(rotX) + pz * Math.cos(rotX);

      return {
        x: cx + px * r,
        y: cy - rotY_val * r,
        visible: rotZ_val > (altFactor > 1.0 ? -0.25 : 0),
      };
    };

    // 1. Checar clique em Satélites
    if (layers.satellites) {
      const elapsedSec = (Date.now() - startTimeRef.current) / 1000;
      for (const sat of ORBITING_SATELLITES) {
        const state = getSatelliteCoordinates(sat, elapsedSec);
        const pt = project(state.lat, state.lon, state.altFactor);
        if (pt.visible && Math.hypot(clickX - pt.x, clickY - pt.y) < 16) {
          setSelectedSatellite(sat);
          setSelectedPeer(null);
          setActiveTab('satellites');
          return;
        }
      }
    }

    // 2. Checar clique em Pares / Nós
    if (layers.peers) {
      const allNodes = [...peers];
      if (isVisibleOnMap) {
        allNodes.push({
          id: 'me_local',
          callsign: userProfile.callsign,
          fullName: userProfile.fullName,
          fuzzyLat: userProfile.fuzzyLat,
          fuzzyLon: userProfile.fuzzyLon,
          fuzzRadiusKm: 10,
          country: userProfile.country,
          flag: userProfile.flag,
          city: userProfile.city,
          status: userProfile.status,
          bio: userProfile.bio,
          transports: userProfile.transports,
          isLocalUser: true,
          isVisibleOnMap: true,
          lastSeen: 'Agora',
          avatarBg: 'from-amber-500 to-emerald-500',
          signalStrengthDbm: -45,
          rttMs: 1,
        });
      }

      for (const node of allNodes) {
        const pt = project(node.fuzzyLat, node.fuzzyLon, 1.0);
        if (pt.visible && Math.hypot(clickX - pt.x, clickY - pt.y) < 20) {
          setSelectedPeer(node);
          setSelectedSatellite(null);
          setActiveTab('peers');
          return;
        }
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const nextScale = Math.max(0.6, Math.min(2.8, cameraRef.current.scale * zoomFactor));
    cameraRef.current.scale = nextScale;
    targetCameraRef.current.scale = nextScale;
  };

  const filteredPeers = peers.filter((p) => {
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const match =
        p.callsign.toLowerCase().includes(q) ||
        p.fullName.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.country.toLowerCase().includes(q);
      if (!match) return false;
    }

    if (transportFilter !== 'all') {
      const hasTransport = p.transports.some((t) =>
        t.toLowerCase().includes(transportFilter.toLowerCase())
      );
      if (!hasTransport) return false;
    }

    if (distanceFilter === 'near') {
      const dist = calculateHaversineDistance(
        userProfile.fuzzyLat,
        userProfile.fuzzyLon,
        p.fuzzyLat,
        p.fuzzyLon
      );
      if (dist > 500) return false;
    }

    if (distanceFilter === 'country') {
      if (p.country !== userProfile.country) return false;
    }

    return true;
  });

  return (
    <div
      ref={containerRef}
      className={`space-y-6 animate-fadeIn pb-12 ${
        isFullscreen ? 'fixed inset-0 z-50 bg-slate-950 p-4 overflow-y-auto' : ''
      }`}
    >
      {/* ==================================================================== */}
      {/* BANNER SUPREMO DE CONSENTIMENTO E DESCOBERTA SOCIAL                   */}
      {/* ==================================================================== */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border border-indigo-500/40 p-5 shadow-2xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div className="space-y-1.5 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                <Globe className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '20s' }} />
                GLOBO 3D PLANETÁRIO JJY v2.5
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                ERRO PROPOSITAL DE 10 KM ATIVO
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Satellite className="w-3.5 h-3.5 text-indigo-400" />
                {ORBITING_SATELLITES.length} SATÉLITES EM ÓRBITA 3D
              </span>
            </div>

            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
              Quer ser visto por quem usa essa rede no mapa para conversar com novas pessoas?
            </h2>

            <p className="text-xs text-slate-300 leading-relaxed max-w-4xl">
              Quando você ativa a visibilidade, seu nó é projetado no mapa 3D com um <strong>raio de privacidade de 10 km</strong>.
              Ninguém tem acesso ao seu endereço físico exato, mas outros operadores de rádio e Wi-Fi podem descobrir sua presença,
              trocar ideias e iniciar conversas diretas P2P.
            </p>
          </div>

          {/* Controle Deslizante de Visibilidade */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            <button
              onClick={() => handleToggleVisibility(!isVisibleOnMap)}
              className={`w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2.5 shadow-xl ${
                isVisibleOnMap
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-600/30 border border-emerald-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 shadow-slate-900/50'
              }`}
            >
              {isVisibleOnMap ? (
                <>
                  <Eye className="w-4 h-4 text-emerald-200 animate-pulse" />
                  <span>VOCÊ ESTÁ VISÍVEL NO MAPA</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4 text-slate-400" />
                  <span>MODO INVISÍVEL (CLIQUE PARA SER VISTO)</span>
                </>
              )}
            </button>

            <button
              onClick={() => setShowProfileEditor(true)}
              className="px-3.5 py-3 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap"
            >
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>Editar Meu Perfil</span>
            </button>
          </div>
        </div>

        {/* Status de Privacidade Ativa */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>Sua Localização no Mapa:</span>
            <span className="text-cyan-300 font-bold">
              {userProfile.city} ({userProfile.fuzzyLat}, {userProfile.fuzzyLon}) ± 10 km
            </span>
          </div>

          <div className="text-emerald-400 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            <span>Anti-Triangulação & Proteção de Domicílio Ativa</span>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* PALCO CENTRAL DO GLOBO 3D + PAINEL MULTIFUNCIONAL                   */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visualizador 3D do Globo */}
        <div className="lg:col-span-2 relative bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[580px] md:h-[660px]">
          {/* ================================================================ */}
          {/* BARRA SUPERIOR DE CONTROLES FLUTUANTES SOBRE O CANVAS             */}
          {/* ================================================================ */}
          <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
            {/* Seletor de Modo Visual */}
            <div className="flex items-center gap-1 pointer-events-auto bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-800 shadow-xl">
              <button
                onClick={() => setVisualMode('cyberpunk')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono transition-all flex items-center gap-1 ${
                  visualMode === 'cyberpunk'
                    ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/50'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Estilo Cyberpunk Neon de alto contraste"
              >
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>Cyberpunk</span>
              </button>

              <button
                onClick={() => setVisualMode('solar')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono transition-all flex items-center gap-1 ${
                  visualMode === 'solar'
                    ? 'bg-amber-500/30 text-amber-300 border border-amber-400/50'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Modo Dia & Noite astronômico em tempo real"
              >
                <Sun className="w-3 h-3 text-amber-400" />
                <span>Solar UTC</span>
              </button>

              <button
                onClick={() => setVisualMode('tactical')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono transition-all flex items-center gap-1 ${
                  visualMode === 'tactical'
                    ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/50'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Modo Tático Militar MGRS / Radar"
              >
                <Radar className="w-3 h-3 text-emerald-400" />
                <span>Tático FLIR</span>
              </button>
            </div>

            {/* Menu de Camadas e Presets */}
            <div className="flex items-center gap-1.5 pointer-events-auto">
              {/* Drawer de Camadas */}
              <div className="relative">
                <button
                  onClick={() => setShowLayerMenu(!showLayerMenu)}
                  className="px-2.5 py-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700 backdrop-blur-md rounded-xl text-[11px] font-semibold transition-all flex items-center gap-1.5 shadow-lg"
                  title="Ativar/desativar camadas"
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Camadas</span>
                </button>

                {showLayerMenu && (
                  <div className="absolute top-10 right-0 w-52 bg-slate-900/95 border border-slate-700 backdrop-blur-md rounded-xl p-2.5 shadow-2xl z-30 space-y-1.5 text-xs">
                    <div className="text-[10px] font-mono font-bold text-slate-400 border-b border-slate-800 pb-1">
                      CAMADAS VISUAIS
                    </div>
                    {[
                      { key: 'peers', label: 'Operadores & Nós' },
                      { key: 'satellites', label: 'Satélites Orbitais' },
                      { key: 'meshArcs', label: 'Arcos de Mesh 3D' },
                      { key: 'nightLights', label: 'Luzes de Cidades' },
                      { key: 'graticule', label: 'Grade Geodésica' },
                      { key: 'privacyHalos', label: 'Halos de 10 km' },
                    ].map((item) => (
                      <label
                        key={item.key}
                        className="flex items-center justify-between text-slate-300 hover:text-white cursor-pointer select-none py-0.5"
                      >
                        <span className="text-[11px]">{item.label}</span>
                        <input
                          type="checkbox"
                          checked={(layers as any)[item.key]}
                          onChange={(e) =>
                            setLayers({ ...layers, [item.key]: e.target.checked })
                          }
                          className="rounded border-slate-700 text-indigo-500 focus:ring-0"
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Botão de Localização do Usuário */}
              <button
                onClick={() => handleApplyPreset('me')}
                className="px-2.5 py-1.5 bg-slate-900/90 hover:bg-slate-800 text-cyan-300 border border-slate-700 backdrop-blur-md rounded-xl text-[11px] font-semibold transition-all flex items-center gap-1.5 shadow-lg"
                title="Centralizar na minha localização ofuscada"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Minha Posição</span>
              </button>

              {/* Controle de Auto-Rotação */}
              <button
                onClick={() => setIsAutoRotating(!isAutoRotating)}
                className={`p-1.5 rounded-xl border backdrop-blur-md transition-all shadow-lg ${
                  isAutoRotating
                    ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50'
                    : 'bg-slate-900/90 text-slate-400 border-slate-700 hover:text-white'
                }`}
                title="Ativar/Desativar Auto-Rotação do Planeta"
              >
                {isAutoRotating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>

              {/* Tela Cheia */}
              <button
                onClick={toggleFullscreen}
                className="p-1.5 rounded-xl border border-slate-700 bg-slate-900/90 text-slate-300 hover:text-white backdrop-blur-md shadow-lg"
                title={isFullscreen ? 'Sair da Tela Cheia' : 'Expandir Tela Cheia'}
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* ================================================================ */}
          {/* CANVAS INTERATIVO 3D DA TERRA                                     */}
          {/* ================================================================ */}
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              isDraggingRef.current = false;
            }}
            onWheel={handleWheel}
            className="w-full h-full cursor-grab active:cursor-grabbing select-none"
          />

          {/* ================================================================ */}
          {/* BARRA INFERIOR DE LEGENDA E TELEMETRIA SOLAR                     */}
          {/* ================================================================ */}
          <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
            {/* Legenda de Elementos */}
            <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 flex flex-wrap items-center gap-3 shadow-xl">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                <span>Você</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span>Operadores</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                <span>Satélites</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full border border-yellow-400/70 bg-yellow-400/20" />
                <span>Raio de 10 km</span>
              </div>
            </div>

            {/* Presets Rápidos de Continente */}
            <div className="pointer-events-auto hidden sm:flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-800 text-[10px] font-mono shadow-xl">
              <span className="text-slate-500 px-1.5">Focar:</span>
              <button
                onClick={() => handleApplyPreset('brasil')}
                className="px-2 py-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
              >
                🇧🇷 Brasil
              </button>
              <button
                onClick={() => handleApplyPreset('eua')}
                className="px-2 py-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
              >
                🇺🇸 EUA
              </button>
              <button
                onClick={() => handleApplyPreset('europa')}
                className="px-2 py-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
              >
                🇪🇺 Europa
              </button>
              <button
                onClick={() => handleApplyPreset('asia')}
                className="px-2 py-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
              >
                🇯🇵 Ásia
              </button>
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* PAINEL LATERAL MULTIFUNCIONAL (OPERADORES / SATÉLITES / PTP LINK)    */}
        {/* ==================================================================== */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xl space-y-4">
          <div className="space-y-3">
            {/* Abas Superiores do Painel Lateral */}
            <div className="flex items-center gap-1 border-b border-slate-800 pb-2.5">
              <button
                onClick={() => setActiveTab('peers')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'peers'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Operadores ({peers.length + (isVisibleOnMap ? 1 : 0)})</span>
              </button>

              <button
                onClick={() => setActiveTab('satellites')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'satellites'
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                    : 'bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                <Satellite className="w-3.5 h-3.5" />
                <span>Satélites ({ORBITING_SATELLITES.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('ptp')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'ptp'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                    : 'bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                <Route className="w-3.5 h-3.5" />
                <span>Enlace PtP</span>
              </button>
            </div>

            {/* -------------------------------------------------------------- */}
            {/* ABA 1: OPERADORES NO MAPA                                       */}
            {/* -------------------------------------------------------------- */}
            {activeTab === 'peers' && (
              <div className="space-y-3 animate-fadeIn">
                {/* Campo de Busca */}
                <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por apelido, cidade ou país..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-full font-mono"
                  />
                </div>

                {/* Filtro por Transporte */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px] font-mono scrollbar-none">
                  {[
                    { id: 'all', label: 'Todos' },
                    { id: 'lora', label: 'LoRa' },
                    { id: 'wi-fi', label: 'Wi-Fi' },
                    { id: 'celular', label: '5G/Cel' },
                    { id: 'satélite', label: 'Satélite' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTransportFilter(t.id)}
                      className={`px-2 py-0.5 rounded-lg whitespace-nowrap transition-all ${
                        transportFilter === t.id
                          ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/50'
                          : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Card do Usuário Local se Visível */}
                {isVisibleOnMap && (
                  <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
                        <span className="text-xs font-bold text-yellow-300">{userProfile.callsign}</span>
                        <span className="text-[10px] text-slate-400">(Você)</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400">VISÍVEL</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-tight truncate">{userProfile.bio}</p>
                    <div className="text-[10px] font-mono text-slate-400 flex justify-between pt-1">
                      <span>{userProfile.city}</span>
                      <span className="text-yellow-400 font-bold">±10 km Fuzzed</span>
                    </div>
                  </div>
                )}

                {/* Lista com Rolagem dos Outros Nós */}
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {filteredPeers.map((peer) => {
                    const distKm = calculateHaversineDistance(
                      userProfile.fuzzyLat,
                      userProfile.fuzzyLon,
                      peer.fuzzyLat,
                      peer.fuzzyLon
                    );
                    const isSelected = selectedPeer?.id === peer.id;

                    return (
                      <div
                        key={peer.id}
                        onClick={() => {
                          setSelectedPeer(peer);
                          focusOnCoordinates(peer.fuzzyLat, peer.fuzzyLon);
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                          isSelected
                            ? 'bg-slate-800/90 border-cyan-500 shadow-lg'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-lg bg-gradient-to-tr ${peer.avatarBg} flex items-center justify-center text-xs font-bold text-white shadow-sm`}>
                              {peer.flag}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-white flex items-center gap-1">
                                <span>{peer.callsign}</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              </h4>
                              <span className="text-[10px] text-slate-400">{peer.fullName}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-xs font-bold font-mono text-cyan-400 block">
                              {distKm} km
                            </span>
                            <span className="text-[9px] font-mono text-slate-500">aprox. (±10km)</span>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                          {peer.bio}
                        </p>

                        <div className="flex flex-wrap gap-1 pt-1">
                          {peer.transports.map((t, idx) => (
                            <span
                              key={idx}
                              className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-indigo-300 border border-slate-800"
                            >
                              {t}
                            </span>
                          ))}
                        </div>

                        <div className="pt-2 flex items-center justify-between border-t border-slate-800/80">
                          <span className="text-[10px] font-mono text-slate-500">
                            {peer.city}
                          </span>
                          <div className="flex gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPtpTargetId(peer.id);
                                setActiveTab('ptp');
                              }}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors"
                              title="Medir enlace PTP com este nó"
                            >
                              <Route className="w-3 h-3" />
                              <span>Enlace</span>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setChatPeer(peer);
                              }}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors"
                            >
                              <MessageSquare className="w-3 h-3" />
                              <span>Conversar</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* -------------------------------------------------------------- */}
            {/* ABA 2: SATÉLITES ORBITAIS 3D                                    */}
            {/* -------------------------------------------------------------- */}
            {activeTab === 'satellites' && (
              <div className="space-y-3 animate-fadeIn">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-300 flex items-center gap-2">
                  <Satellite className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Rastreamento em tempo real de repetidores orbitais e constelações LEO/GEO.</span>
                </div>

                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {ORBITING_SATELLITES.map((sat) => {
                    const isSelected = selectedSatellite?.id === sat.id;
                    return (
                      <div
                        key={sat.id}
                        onClick={() => setSelectedSatellite(sat)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                          isSelected
                            ? 'bg-slate-800/90 border-cyan-400 shadow-lg'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: sat.color }}
                            />
                            <div>
                              <h4 className="text-xs font-bold text-white">{sat.name}</h4>
                              <span className="text-[10px] font-mono text-slate-400">
                                {sat.catalogCode} • {sat.type}
                              </span>
                            </div>
                          </div>

                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-cyan-300 border border-slate-800">
                            {sat.altitudeKm} km
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          {sat.description}
                        </p>

                        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                          <div>
                            <span className="text-slate-500 block">Downlink:</span>
                            <span className="text-emerald-300 font-bold">{sat.freqDownlink}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Modulação:</span>
                            <span className="text-indigo-300">{sat.modulation}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Velocidade:</span>
                            <span className="text-slate-300">{sat.speedKmh.toLocaleString()} km/h</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Cobertura:</span>
                            <span className="text-cyan-300">~{sat.footprintRadiusKm} km</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* -------------------------------------------------------------- */}
            {/* ABA 3: ENLACE PONTO A PONTO & TRACEROUTE                        */}
            {/* -------------------------------------------------------------- */}
            {activeTab === 'ptp' && (
              <div className="space-y-3 animate-fadeIn text-xs">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center gap-2">
                  <Route className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Cálculo geodésico de enlace RF, Zona de Fresnel e teste de Traceroute.</span>
                </div>

                {/* Seletores de Origem e Destino */}
                <div className="space-y-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-yellow-400" />
                      <span>Nó de Origem:</span>
                    </label>
                    <select
                      value={ptpSourceId}
                      onChange={(e) => setPtpSourceId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono text-xs focus:outline-none"
                    >
                      <option value="me_local">Você (Nó Jjy Local - ±10km)</option>
                      {peers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.callsign} - {p.city}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex justify-center">
                    <ArrowRightLeft className="w-4 h-4 text-slate-500" />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      <span>Nó de Destino:</span>
                    </label>
                    <select
                      value={ptpTargetId}
                      onChange={(e) => setPtpTargetId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono text-xs focus:outline-none"
                    >
                      {peers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.callsign} - {p.city} ({p.country})
                        </option>
                      ))}
                      <option value="me_local">Você (Nó Jjy Local - ±10km)</option>
                    </select>
                  </div>
                </div>

                {/* Métricas Calculadas do Enlace */}
                {activePtPAnalysis && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                      <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block">Distância Geodésica:</span>
                        <span className="text-cyan-300 font-bold text-xs">
                          {activePtPAnalysis.distanceKm} km
                        </span>
                      </div>
                      <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block">Atraso de Propagação:</span>
                        <span className="text-emerald-300 font-bold text-xs">
                          {activePtPAnalysis.propagationDelayMs} ms
                        </span>
                      </div>
                      <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block">Atenuação (FSPL 915M):</span>
                        <span className="text-amber-300 font-bold text-xs">
                          {activePtPAnalysis.fsplDb} dB
                        </span>
                      </div>
                      <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block">1ª Zona de Fresnel:</span>
                        <span className="text-indigo-300 font-bold text-xs">
                          {activePtPAnalysis.fresnelRadiusMeters} m
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-mono">
                      <span className="text-slate-400">Classificação do Enlace:</span>
                      <span
                        className={`font-bold px-2 py-0.5 rounded ${
                          activePtPAnalysis.linkFeasibility === 'direct'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : activePtPAnalysis.linkFeasibility === 'mesh_relayed'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                        }`}
                      >
                        {activePtPAnalysis.linkFeasibility === 'direct'
                          ? 'Enlace Direto PTP'
                          : activePtPAnalysis.linkFeasibility === 'mesh_relayed'
                          ? `Repetidores Mesh (~${activePtPAnalysis.estimatedHops} hops)`
                          : 'Roteamento via Satélite'}
                      </span>
                    </div>

                    <button
                      onClick={runTracerouteSimulation}
                      disabled={isTracerouteRunning}
                      className="w-full py-2 bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-amber-600/30"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>{isTracerouteRunning ? 'Executando Traceroute...' : 'Simular Traceroute 3D'}</span>
                    </button>

                    {/* Terminal de Traceroute ao vivo */}
                    {tracerouteLogs.length > 0 && (
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[10px] font-mono space-y-1 text-slate-300 max-h-36 overflow-y-auto">
                        {tracerouteLogs.map((log, i) => (
                          <div key={i} className="flex items-start gap-1">
                            <span className="text-emerald-400">›</span>
                            <span>{log}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rodapé do Painel */}
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Seu Status Atual:</span>
              <span className={isVisibleOnMap ? 'text-emerald-400 font-bold' : 'text-slate-400 font-bold'}>
                {isVisibleOnMap ? '● VISÍVEL NO MAPA' : '○ INVISÍVEL'}
              </span>
            </div>
            <div className="text-[10px] text-slate-500">
              Coordenadas protegidas por Differential Privacy Gaussiana (10 km).
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* MODAL DE CHAT P2P COM O USUÁRIO SELECIONADO                          */}
      {/* ==================================================================== */}
      {chatPeer && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${chatPeer.avatarBg} flex items-center justify-center text-sm font-bold text-white shadow-md`}>
                  {chatPeer.flag}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                    <span>{chatPeer.callsign}</span>
                    <span className="text-[10px] font-mono text-emerald-400">● Online</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {chatPeer.city} • Distância: ~{calculateHaversineDistance(userProfile.fuzzyLat, userProfile.fuzzyLon, chatPeer.fuzzyLat, chatPeer.fuzzyLon)} km (±10km)
                  </p>
                </div>
              </div>

              <button
                onClick={() => setChatPeer(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Histórico da Mensagem */}
            <div className="h-64 overflow-y-auto space-y-2.5 p-2 bg-slate-950 rounded-xl border border-slate-800 text-xs">
              <div className="text-center py-2 text-[10px] font-mono text-slate-500">
                🔒 Enlace Criptografado P2P estabelecido via {chatPeer.transports[0]}
              </div>

              {(chatMessages[chatPeer.id] || []).map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-2.5 rounded-xl ${
                      msg.sender === 'me'
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                    }`}
                  >
                    <p className="text-xs leading-relaxed">{msg.text}</p>
                    <span className="text-[9px] font-mono text-slate-300 block text-right mt-1 opacity-70">
                      {msg.time}
                    </span>
                  </div>
                </div>
              ))}

              {(!chatMessages[chatPeer.id] || chatMessages[chatPeer.id].length === 0) && (
                <div className="text-center py-12 text-slate-500 text-xs">
                  Diga olá para {chatPeer.fullName}! Envie uma mensagem pelo barramento da rede.
                </div>
              )}
            </div>

            {/* Input de Envio de Mensagem */}
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                required
                placeholder={`Conversar com ${chatPeer.callsign}...`}
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 text-white text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/30"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL DE EDIÇÃO DO PERFIL PÚBLICO DO USUÁRIO                         */}
      {/* ==================================================================== */}
      {showProfileEditor && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-400" />
                Configurar Meu Perfil Público
              </h3>
              <button
                onClick={() => setShowProfileEditor(false)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">Apelido / Callsign Público:</label>
                <input
                  type="text"
                  required
                  value={userProfile.callsign}
                  onChange={(e) => setUserProfile({ ...userProfile, callsign: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono uppercase focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">Nome ou Pseudônimo:</label>
                <input
                  type="text"
                  required
                  value={userProfile.fullName}
                  onChange={(e) => setUserProfile({ ...userProfile, fullName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">Cidade / Região:</label>
                <input
                  type="text"
                  required
                  value={userProfile.city}
                  onChange={(e) => setUserProfile({ ...userProfile, city: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">Biografia / Mensagem para os outros:</label>
                <textarea
                  rows={2}
                  required
                  value={userProfile.bio}
                  onChange={(e) => setUserProfile({ ...userProfile, bio: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-[11px] text-indigo-300 font-mono space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-indigo-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Garantia de Privacidade Física (10 km)
                </div>
                <p className="text-[10px] text-slate-400">
                  Suas coordenadas mostradas no mapa serão deslocadas propositalmente em até 10 km da sua localização real para proteger sua casa ou ponto de operação.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowProfileEditor(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-md shadow-indigo-600/30"
                >
                  Salvar Perfil
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
