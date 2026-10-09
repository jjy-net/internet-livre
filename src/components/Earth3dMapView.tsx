import React, { useState, useEffect, useRef } from 'react';
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
  RotateCw,
  Sliders,
  X,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  GlobeUserNode,
  GlobeCamera,
  apply10kmFuzzyObfuscation,
  calculateHaversineDistance,
  INITIAL_GLOBE_PEERS,
  WORLD_CONTINENT_POLYGONS,
} from '../utils/earth3dEngine';
import { captureGpsLocation } from '../utils/geo';

export const Earth3dMapView: React.FC = () => {
  // Estado de visibilidade no mapa (requerido pelo usuário)
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
  const [searchFilter, setSearchFilter] = useState('');
  const [distanceFilter, setDistanceFilter] = useState<'all' | 'near' | 'country'>('all');
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [showProfileEditor, setShowProfileEditor] = useState(false);

  // Chat direto P2P
  const [chatPeer, setChatPeer] = useState<GlobeUserNode | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<Record<string, { sender: 'me' | 'peer'; text: string; time: string }[]>>({});

  // Câmera 3D
  const cameraRef = useRef<GlobeCamera>({
    rotX: 0.35, // Inclinação leve
    rotY: 1.15, // Rotação inicial voltada para a América do Sul
    scale: 1.0,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const animFrameIdRef = useRef<number | null>(null);

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
      // Quando ativar, focar a câmera no usuário
      focusOnCoordinates(userProfile.fuzzyLat, userProfile.fuzzyLon);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('jjy_globe_user_profile', JSON.stringify(userProfile));
    setShowProfileEditor(false);
    alert('Perfil público atualizado! Sua localização permanece protegida com 10 km de erro proposital.');
  };

  // Focar a câmera 3D em uma coordenada geográfica
  const focusOnCoordinates = (lat: number, lon: number) => {
    setIsAutoRotating(false);
    const targetRotY = -((lon * Math.PI) / 180) + Math.PI / 2;
    const targetRotX = (lat * Math.PI) / 180;

    cameraRef.current.rotX = Math.max(-1.2, Math.min(1.2, targetRotX));
    cameraRef.current.rotY = targetRotY;
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
  // RENDERIZADOR DO GLOBO 3D DA TERRA NO CANVAS
  // ==========================================================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;

    // Redimensionamento de alta densidade (retina)
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

      // Auto rotação suave
      if (isAutoRotating) {
        cameraRef.current.rotY += 0.003;
      }

      const cx = width / 2;
      const cy = height / 2;
      const baseRadius = Math.min(width, height) * 0.42 * cameraRef.current.scale;

      const rotX = cameraRef.current.rotX;
      const rotY = cameraRef.current.rotY;

      // 1. Fundo do Espaço com Estrelas Estáticas
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, width, height);

      // 2. Brilho Atmosférico Neon em Volta do Planeta
      const atmoGrad = ctx.createRadialGradient(cx, cy, baseRadius * 0.95, cx, cy, baseRadius * 1.15);
      atmoGrad.addColorStop(0, 'rgba(6, 182, 212, 0.4)');
      atmoGrad.addColorStop(0.5, 'rgba(59, 130, 246, 0.2)');
      atmoGrad.addColorStop(1, 'rgba(2, 6, 23, 0)');
      ctx.fillStyle = atmoGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius * 1.15, 0, Math.PI * 2);
      ctx.fill();

      // 3. Esfera do Oceano Terrestre (Planeta Azul Escuro)
      const oceanGrad = ctx.createRadialGradient(
        cx - baseRadius * 0.35,
        cy - baseRadius * 0.35,
        baseRadius * 0.1,
        cx,
        cy,
        baseRadius
      );
      oceanGrad.addColorStop(0, '#0c2240');
      oceanGrad.addColorStop(0.7, '#07162c');
      oceanGrad.addColorStop(1, '#030a14');

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
      ctx.clip(); // Limita todo desenho à superfície da esfera

      ctx.fillStyle = oceanGrad;
      ctx.fillRect(0, 0, width, height);

      // Função de Projeção Esférica 3D -> 2D
      const project3D = (lat: number, lon: number): { x: number; y: number; z: number; visible: boolean } => {
        const latRad = (lat * Math.PI) / 180;
        const lonRad = (lon * Math.PI) / 180;

        // Coordenadas na esfera unitária
        const px = Math.cos(latRad) * Math.sin(lonRad - rotY);
        const py = Math.sin(latRad);
        const pz = Math.cos(latRad) * Math.cos(lonRad - rotY);

        // Rotação em torno do eixo X (Tilt)
        const rotY_val = py * Math.cos(rotX) - pz * Math.sin(rotX);
        const rotZ_val = py * Math.sin(rotX) + pz * Math.cos(rotX);

        const screenX = cx + px * baseRadius;
        const screenY = cy - rotY_val * baseRadius;

        return {
          x: screenX,
          y: screenY,
          z: rotZ_val,
          visible: rotZ_val > 0, // Visível apenas no hemisfério voltado para a câmera
        };
      };

      // 4. Grade de Meridianos e Paralelos (Graticule)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.lineWidth = 1;

      // Paralelos (Latitudes de -60 a +60 em passos de 30)
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        let first = true;
        for (let lon = -180; lon <= 180; lon += 5) {
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

      // Meridianos (Longitudes de -180 a +180 em passos de 30)
      for (let lon = -180; lon <= 180; lon += 30) {
        ctx.beginPath();
        let first = true;
        for (let lat = -80; lat <= 80; lat += 5) {
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

      // Linha do Equador Destacada
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)';
      ctx.lineWidth = 1.5;
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

      // 5. Continentes Terrestres (Polígonos 3D Vetoriais)
      ctx.fillStyle = 'rgba(16, 185, 129, 0.16)';
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)';
      ctx.lineWidth = 1.2;

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
          ctx.fill();
          ctx.stroke();
        }
      });

      // 6. Arcos de Comunicação Ativos entre Pares Conectados
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

      // Desenhar alguns arcos de dados conectando nós
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;

      for (let i = 0; i < Math.min(activePeers.length, 4); i++) {
        const p1 = activePeers[i];
        const p2 = activePeers[(i + 1) % activePeers.length];
        const pt1 = project3D(p1.fuzzyLat, p1.fuzzyLon);
        const pt2 = project3D(p2.fuzzyLat, p2.fuzzyLon);

        if (pt1.visible && pt2.visible) {
          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          // Curva arqueada no espaço
          const midX = (pt1.x + pt2.x) / 2;
          const midY = (pt1.y + pt2.y) / 2 - 15;
          ctx.quadraticCurveTo(midX, midY, pt2.x, pt2.y);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);

      // 7. Pinos e Círculos de Raio de Privacidade de 10 km
      activePeers.forEach((node) => {
        const pt = project3D(node.fuzzyLat, node.fuzzyLon);
        if (!pt.visible) return;

        const isMe = node.isLocalUser;
        const isSelected = selectedPeer?.id === node.id;

        // Raio de 10 km projetado na tela (escala proporcional ao zoom)
        const radius10kmPixels = Math.max(14, 22 * cameraRef.current.scale);

        // Círculo Translúcido da Zona de Privacidade de 10 km
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius10kmPixels, 0, Math.PI * 2);
        ctx.fillStyle = isMe
          ? 'rgba(234, 179, 8, 0.15)'
          : isSelected
          ? 'rgba(6, 182, 212, 0.25)'
          : 'rgba(59, 130, 246, 0.12)';
        ctx.fill();
        ctx.strokeStyle = isMe
          ? 'rgba(234, 179, 8, 0.6)'
          : isSelected
          ? 'rgba(6, 182, 212, 0.8)'
          : 'rgba(59, 130, 246, 0.4)';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();

        // Ponto Central do Nó
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, isMe ? 5 : 4, 0, Math.PI * 2);
        ctx.fillStyle = isMe ? '#eab308' : isSelected ? '#06b6d4' : '#10b981';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Rótulo do Apelido / Callsign
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

      ctx.restore(); // Fecha o clip da esfera

      // 8. Borda Limítrofe com Brilho do Limbo Terrestre
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
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
  }, [isAutoRotating, isVisibleOnMap, peers, selectedPeer, userProfile]);

  // Manipulação de Mouse e Toque para Rotação 3D
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    setIsAutoRotating(false);
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;

    cameraRef.current.rotY += dx * 0.006;
    cameraRef.current.rotX = Math.max(-1.3, Math.min(1.3, cameraRef.current.rotX + dy * 0.006));

    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    cameraRef.current.scale = Math.max(0.6, Math.min(2.5, cameraRef.current.scale * zoomFactor));
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
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* ==================================================================== */}
      {/* BANNER SUPREMO DE CONSENTIMENTO E DESCOBERTA SOCIAL                   */}
      {/* ==================================================================== */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border border-indigo-500/40 p-5 shadow-2xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div className="space-y-1.5 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                <Globe className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '20s' }} />
                GLOBO 3D PLANETÁRIO JJY
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                ERRO PROPOSITAL DE 10 KM ATIVO
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
      {/* PALCO CENTRAL DO GLOBO 3D + PAINEL DE CONTATOS P2P                  */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visualizador 3D do Globo */}
        <div className="lg:col-span-2 relative bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[560px] md:h-[620px]">
          {/* Barra de Controles Superiores sobre o Canvas */}
          <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-2 pointer-events-auto bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 shadow-lg">
              <Compass className="w-4 h-4 text-cyan-400" />
              <span>Gire com o mouse ou toque | Scroll para zoom</span>
            </div>

            <div className="flex items-center gap-1.5 pointer-events-auto">
              <button
                onClick={() => focusOnCoordinates(userProfile.fuzzyLat, userProfile.fuzzyLon)}
                className="px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 text-cyan-300 border border-slate-700 backdrop-blur-md rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-lg"
                title="Centralizar na minha localização ofuscada"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Minha Posição</span>
              </button>

              <button
                onClick={() => setIsAutoRotating(!isAutoRotating)}
                className={`p-2 rounded-xl border backdrop-blur-md transition-all shadow-lg ${
                  isAutoRotating
                    ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50'
                    : 'bg-slate-900/80 text-slate-400 border-slate-700 hover:text-white'
                }`}
                title="Ativar/Desativar Auto-Rotação do Planeta"
              >
                <RotateCw className={`w-4 h-4 ${isAutoRotating ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
              </button>
            </div>
          </div>

          {/* Canvas Interativo do Globo 3D */}
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            className="w-full h-full cursor-grab active:cursor-grabbing select-none"
          />

          {/* Legenda Flutuante de Cores */}
          <div className="absolute bottom-3 left-3 z-10 pointer-events-auto bg-slate-900/80 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 flex flex-wrap items-center gap-3 shadow-lg">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <span>Você (Seu Nó)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span>Operadores Online</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full border border-cyan-400 bg-cyan-400/20" />
              <span>Zona de 10 km de Fuzzing</span>
            </div>
          </div>
        </div>

        {/* Lista Lateral de Usuários e Operadores Descobertos */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xl space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Operadores no Mapa ({peers.length + (isVisibleOnMap ? 1 : 0)})
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                P2P Mesh
              </span>
            </div>

            {/* Campo de Busca de Contatos */}
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

            {/* Filtros de Distância */}
            <div className="flex gap-1">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'near', label: 'Próximos (<500km)' },
                { id: 'country', label: 'Mesmo País' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setDistanceFilter(f.id as any)}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    distanceFilter === f.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  {f.label}
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
                  <span className="text-yellow-400">Erro: ±10 km</span>
                </div>
              </div>
            )}

            {/* Lista com Rolagem dos Outros Nós */}
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
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
                );
              })}
            </div>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Seu Status Atual:</span>
              <span className={isVisibleOnMap ? 'text-emerald-400 font-bold' : 'text-slate-400 font-bold'}>
                {isVisibleOnMap ? '● VISÍVEL NO MAPA' : '○ INVISÍVEL'}
              </span>
            </div>
            <div className="text-[10px] text-slate-500">
              Coordenadas protegidas por Differential Privacy Gaussiana.
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
