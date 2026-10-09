import React, { useState, useRef } from 'react';
import {
  MapPin,
  ExternalLink,
  Copy,
  Check,
  Compass,
  Navigation,
  Satellite,
  Radio,
  Globe,
} from 'lucide-react';
import { GeoLocationData, getGoogleMapsUrl, getOpenStreetMapUrl } from '../utils/geo';

interface GpsHoverBadgeProps {
  location?: GeoLocationData | null;
  stationName?: string;
  className?: string;
  buttonLabel?: string;
  showCoordinates?: boolean;
  compact?: boolean;
  placement?: 'top' | 'bottom';
}

export const GpsHoverBadge: React.FC<GpsHoverBadgeProps> = ({
  location,
  stationName,
  className = '',
  buttonLabel = 'Mapa',
  showCoordinates = true,
  compact = false,
  placement = 'top',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loc: GeoLocationData = location || {
    latitude: -23.5505,
    longitude: -46.6333,
    country: 'Brasil',
    countryCode: 'BR',
    flag: '🇧🇷',
    city: 'São Paulo',
    source: 'network',
    accuracy: 15,
    timestamp: Date.now(),
  };

  const isGps = loc.source === 'gps';
  const googleMapsUrl = getGoogleMapsUrl(loc.latitude, loc.longitude);
  const osmUrl = getOpenStreetMapUrl(loc.latitude, loc.longitude);
  const coordText = `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`;

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 250);
  };

  const handleCopyCoordinates = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(coordText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Botão / Badge Gatilho do Hover */}
      <div
        className={`cursor-pointer inline-flex items-center gap-1.5 transition-all select-none ${className}`}
      >
        <span className="text-xs">{loc.flag || '🇧🇷'}</span>
        <span className="font-bold text-white text-[11px]">{loc.country || 'Brasil'}</span>
        {showCoordinates && (
          <span className="text-slate-300 font-mono text-[10px]">
            {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
          </span>
        )}
        <span className="text-indigo-400 hover:text-indigo-300 underline font-bold inline-flex items-center gap-0.5 ml-0.5 text-[10px]">
          <MapPin className="w-3 h-3 text-indigo-400 animate-pulse" />
          <span>{buttonLabel}</span>
        </span>
      </div>

      {/* POPUP / QUADRO COM LOCALIZAÇÃO VIA GPS AO PASSAR O MOUSE */}
      {isOpen && (
        <div
          className={`absolute ${
            placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          } left-0 sm:left-auto sm:-translate-x-1/4 z-[100] w-80 max-w-[90vw] p-3.5 bg-slate-950/95 backdrop-blur-xl rounded-2xl border border-slate-700/90 shadow-2xl shadow-black/80 space-y-3 animate-in fade-in zoom-in-95 duration-150 pointer-events-auto`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header do Quadro de Localização */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-2xl" role="img" aria-label={loc.country || 'País'}>
                {loc.flag || '🇧🇷'}
              </span>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="font-bold text-xs text-white">
                    {loc.country || 'Brasil'}
                  </h4>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-bold border border-slate-700">
                    {loc.countryCode || 'BR'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate max-w-[160px]">
                  {stationName ? `Estação: ${stationName}` : loc.city || 'Dispositivo Conectado'}
                </p>
              </div>
            </div>

            <span
              className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 shrink-0 ${
                isGps
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
              }`}
            >
              {isGps ? (
                <>
                  <Satellite className="w-3 h-3 text-emerald-400 animate-pulse" />
                  <span>GPS ATIVO</span>
                </>
              ) : (
                <>
                  <Radio className="w-3 h-3 text-indigo-400" />
                  <span>REDE LAN</span>
                </>
              )}
            </span>
          </div>

          {/* Mini Radar Visual de Localização */}
          <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-900/90 border border-slate-800 flex items-center justify-center">
            {/* Linhas de Grade Tática do Radar */}
            <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:12px_12px] opacity-40" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 rounded-full border border-indigo-500/20" />
              <div className="w-16 h-16 rounded-full border border-indigo-500/30" />
              <div className="w-8 h-8 rounded-full border border-indigo-500/40" />
              <div className="absolute w-full h-[1px] bg-indigo-500/20" />
              <div className="absolute h-full w-[1px] bg-indigo-500/20" />
            </div>

            {/* Ponto de Fixação GPS Pulsando */}
            <div className="relative flex items-center justify-center z-10">
              <span className="absolute w-7 h-7 rounded-full bg-emerald-400/20 animate-ping" />
              <span className="absolute w-4 h-4 rounded-full bg-emerald-500/40 animate-pulse" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />
            </div>

            {/* Rótulo de Coordenadas no Mini Radar */}
            <div className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded text-[9px] font-mono text-emerald-300 border border-slate-800 flex items-center gap-1">
              <Navigation className="w-2.5 h-2.5 text-emerald-400 animate-spin" style={{ animationDuration: '6s' }} />
              <span>FIX: {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}</span>
            </div>

            {/* Precisão do Raio */}
            <div className="absolute bottom-2 right-2 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded text-[9px] font-mono text-slate-300 border border-slate-800">
              Precisão: ±{loc.accuracy || 15}m
            </div>
          </div>

          {/* Dados Técnicos de Posicionamento */}
          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800/80">
              <span className="text-slate-400 block text-[9px]">LATITUDE</span>
              <span className="text-slate-100 font-bold">{loc.latitude.toFixed(6)}°</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800/80">
              <span className="text-slate-400 block text-[9px]">LONGITUDE</span>
              <span className="text-slate-100 font-bold">{loc.longitude.toFixed(6)}°</span>
            </div>
          </div>

          {/* Botões de Ação Direta */}
          <div className="flex items-center gap-1.5 pt-1">
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-1.5 px-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 shadow-md transition-all active:scale-95"
              title="Abrir no Google Maps em nova aba"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Google Maps</span>
            </a>

            <a
              href={osmUrl}
              target="_blank"
              rel="noreferrer"
              className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 border border-slate-700 transition-all"
              title="Abrir no OpenStreetMap"
            >
              <Globe className="w-3 h-3 text-cyan-400" />
              <span>OSM</span>
            </a>

            <button
              type="button"
              onClick={handleCopyCoordinates}
              className={`p-1.5 rounded-xl border transition-all flex items-center justify-center ${
                copied
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
              title="Copiar coordenadas latitude e longitude"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
