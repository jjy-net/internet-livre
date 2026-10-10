/**
 * REGISTRO CENTRAL DE MÓDULOS DO JJY
 * ---------------------------------------------------------------------------
 * Todo o menu (barra lateral, gaveta do celular, barra inferior, busca Ctrl+K
 * e roteamento por #hash) é gerado a partir deste arquivo.
 *
 * PARA ADICIONAR UMA NOVA FUNÇÃO:
 *   1. Crie o componente em src/components/MinhaFuncaoView.tsx
 *   2. Declare o lazy import abaixo
 *   3. Acrescente UMA entrada em MODULES (id, label, icon, group, render)
 * Nada mais precisa ser alterado. Para um novo grupo, acrescente em GROUPS.
 */
import React, { lazy } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Globe, Unlock, BookOpen, MessageSquare, QrCode, Layers, Volume2, Lightbulb,
  Shield, Image as ImageIcon, Radio, Cpu, Share2, Satellite, RadioTower, Waves,
  Smartphone, Wifi, Flame, Camera, Server, Activity, Network,
} from 'lucide-react';

const Earth3dMapView = lazy(() => import('../components/Earth3dMapView').then((m) => ({ default: m.Earth3dMapView })));
const FreeInternetManifestoView = lazy(() => import('../components/FreeInternetManifestoView').then((m) => ({ default: m.FreeInternetManifestoView })));
const DocumentationProjectView = lazy(() => import('../components/DocumentationProjectView').then((m) => ({ default: m.DocumentationProjectView })));
const ChatLAN = lazy(() => import('../components/ChatLAN').then((m) => ({ default: m.ChatLAN })));
const QRStudio = lazy(() => import('../components/QRStudio').then((m) => ({ default: m.QRStudio })));
const FileTransfer = lazy(() => import('../components/FileTransfer').then((m) => ({ default: m.FileTransfer })));
const AudioModemView = lazy(() => import('../components/AudioModemView').then((m) => ({ default: m.AudioModemView })));
const LightModemView = lazy(() => import('../components/LightModemView').then((m) => ({ default: m.LightModemView })));
const CryptoToolsView = lazy(() => import('../components/CryptoToolsView').then((m) => ({ default: m.CryptoToolsView })));
const StegoToolsView = lazy(() => import('../components/StegoToolsView').then((m) => ({ default: m.StegoToolsView })));
const NetworkHubView = lazy(() => import('../components/NetworkHubView').then((m) => ({ default: m.NetworkHubView })));
const JjyMeshProtocolView = lazy(() => import('../components/JjyMeshProtocolView').then((m) => ({ default: m.JjyMeshProtocolView })));
const ProtocolHubView = lazy(() => import('../components/ProtocolHubView').then((m) => ({ default: m.ProtocolHubView })));
const SatelliteInternetView = lazy(() => import('../components/SatelliteInternetView').then((m) => ({ default: m.SatelliteInternetView })));
const TacticalRadioView = lazy(() => import('../components/TacticalRadioView').then((m) => ({ default: m.TacticalRadioView })));
const UnderwaterInternetView = lazy(() => import('../components/UnderwaterInternetView').then((m) => ({ default: m.UnderwaterInternetView })));
const LoraMeshView = lazy(() => import('../components/LoraMeshView').then((m) => ({ default: m.LoraMeshView })));
const CellularGatewayView = lazy(() => import('../components/CellularGatewayView').then((m) => ({ default: m.CellularGatewayView })));
const WifiRadarView = lazy(() => import('../components/WifiRadarView').then((m) => ({ default: m.WifiRadarView })));
const DisasterInternetView = lazy(() => import('../components/DisasterInternetView').then((m) => ({ default: m.DisasterInternetView })));
const RemoteMonitorView = lazy(() => import('../components/RemoteMonitorView').then((m) => ({ default: m.RemoteMonitorView })));
const MeshMonitorView = lazy(() => import('../components/MeshMonitorView').then((m) => ({ default: m.MeshMonitorView })));
const ReticulumNetworkView = lazy(() => import('../components/ReticulumNetworkView').then((m) => ({ default: m.ReticulumNetworkView })));

export interface ModuleGroup {
  id: string;
  label: string;
}

export interface AppModule {
  /** Também é o #hash da URL (ex.: #mesh) */
  id: string;
  label: string;
  /** Rótulo curto para a barra inferior do celular */
  short: string;
  icon: LucideIcon;
  group: string;
  badge?: string;
  /** Palavras extras para a busca (Ctrl+K) */
  keywords?: string;
  render: (go: (id: string) => void) => React.ReactNode;
}

export const GROUPS: ModuleGroup[] = [
  { id: 'inicio', label: 'Início' },
  { id: 'comunicacao', label: 'Comunicação' },
  { id: 'seguranca', label: 'Segurança' },
  { id: 'redes', label: 'Redes & Rádio' },
  { id: 'campo', label: 'Campo & Sensores' },
];

export const MODULES: AppModule[] = [
  { id: 'globe', label: 'Globo 3D', short: 'Globo', icon: Globe, group: 'inicio', badge: 'Início', keywords: 'mapa terra principal home', render: () => <Earth3dMapView /> },
  { id: 'free_internet', label: 'Nossa Internet Livre', short: 'Livre', icon: Unlock, group: 'inicio', keywords: 'manifesto soberana', render: (go) => <FreeInternetManifestoView onNavigateToGlobe={() => go('globe')} onNavigateToProtocols={() => go('protocols')} /> },
  { id: 'docs', label: 'Documentação', short: 'Docs', icon: BookOpen, group: 'inicio', keywords: 'ajuda manual projeto guia', render: (go) => <DocumentationProjectView onNavigateToGlobe={() => go('globe')} onNavigateToFreeInternet={() => go('free_internet')} onNavigateToProtocols={() => go('protocols')} onNavigateToWifi={() => go('wifi')} /> },

  { id: 'chat', label: 'Chat LAN', short: 'Chat', icon: MessageSquare, group: 'comunicacao', badge: 'P2P', keywords: 'mensagem conversa rede local', render: () => <ChatLAN /> },
  { id: 'qr', label: 'QR Studio', short: 'QR', icon: QrCode, group: 'comunicacao', keywords: 'qrcode gerar ler camera', render: () => <QRStudio /> },
  { id: 'files', label: 'Arquivos em Chunks', short: 'Arquivos', icon: Layers, group: 'comunicacao', keywords: 'transferir enviar arquivo', render: () => <FileTransfer /> },
  { id: 'sound', label: 'Modem de Som', short: 'Som', icon: Volume2, group: 'comunicacao', keywords: 'audio acustico', render: () => <AudioModemView /> },
  { id: 'light', label: 'Modem de Luz', short: 'Luz', icon: Lightbulb, group: 'comunicacao', keywords: 'flash optico lifi', render: () => <LightModemView /> },

  { id: 'crypto', label: 'Criptografia', short: 'Cripto', icon: Shield, group: 'seguranca', keywords: 'cifrar senha aes chave', render: () => <CryptoToolsView /> },
  { id: 'stego', label: 'Esteganografia', short: 'Stego', icon: ImageIcon, group: 'seguranca', keywords: 'ocultar imagem esconder', render: () => <StegoToolsView /> },

  { id: 'network', label: 'Rede & Servidor', short: 'Rede', icon: Server, group: 'redes', keywords: 'lan ip servidor', render: () => <NetworkHubView /> },
  { id: 'mesh', label: 'Protocolo JJY Mesh', short: 'Mesh', icon: Cpu, group: 'redes', badge: 'Core', keywords: 'malha meshtastic soberano', render: () => <JjyMeshProtocolView /> },
  { id: 'protocols', label: 'Protocolos & Plugins', short: 'Plugins', icon: Share2, group: 'redes', keywords: 'omni hub', render: () => <ProtocolHubView /> },
  { id: 'satellite', label: 'Satélite & SDR', short: 'Satélite', icon: Satellite, group: 'redes', keywords: 'orbital internet', render: () => <SatelliteInternetView /> },
  { id: 'radio', label: 'Rádio UHF/VHF & HF', short: 'Rádio', icon: RadioTower, group: 'redes', badge: 'RF', keywords: 'tatico frequencia', render: () => <TacticalRadioView /> },
  { id: 'underwater', label: 'Internet Subaquática', short: 'Subsea', icon: Waves, group: 'redes', keywords: 'sonar agua', render: () => <UnderwaterInternetView /> },
  { id: 'lora', label: 'LoRa & Meshtastic', short: 'LoRa', icon: Radio, group: 'redes', keywords: 'radio longo alcance', render: () => <LoraMeshView /> },
  { id: 'meshmonitor', label: 'MeshMonitor', short: 'Monitor', icon: Activity, group: 'redes', badge: 'Meshtastic', keywords: 'meshmonitor meshtastic monitoramento telemetria sniffer traceroute lora nós', render: (go) => <MeshMonitorView onNavigateToMesh={() => go('mesh')} onNavigateToLora={() => go('lora')} /> },
  { id: 'reticulum', label: 'Reticulum Network', short: 'Reticulum', icon: Network, group: 'redes', badge: 'RNS', keywords: 'reticulum rns markqvist lxmf nomadnet rnode criptografia p2p', render: (go) => <ReticulumNetworkView onNavigateToMesh={() => go('mesh')} onNavigateToLora={() => go('lora')} onNavigateToMonitor={() => go('meshmonitor')} /> },
  { id: 'cellular', label: 'Celular 4G/5G & GL.iNet', short: '5G', icon: Smartphone, group: 'redes', keywords: 'modem gateway chip', render: () => <CellularGatewayView /> },
  { id: 'wifi', label: 'Wi-Fi Radar & Visão RF', short: 'Wi-Fi', icon: Wifi, group: 'redes', keywords: 'wireless scanner', render: () => <WifiRadarView /> },

  { id: 'disaster', label: 'Guerra & Desastres', short: 'Desastre', icon: Flame, group: 'campo', badge: 'Tático', keywords: 'emergencia internet', render: () => <DisasterInternetView /> },
  { id: 'remote', label: 'Câmera & Transmissor', short: 'Câmera', icon: Camera, group: 'campo', keywords: 'sensor monitor video', render: () => <RemoteMonitorView /> },
];

export const DEFAULT_MODULE = 'globe';
export const DEFAULT_FAVORITES = ['globe', 'chat', 'qr', 'mesh', 'meshmonitor'];

export const findModule = (id: string): AppModule | undefined => MODULES.find((m) => m.id === id);
export const isModuleId = (id: string): boolean => MODULES.some((m) => m.id === id);
