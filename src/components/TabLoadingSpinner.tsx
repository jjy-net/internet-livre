import React from 'react';
import { Bot, Cpu } from 'lucide-react';

interface TabLoadingSpinnerProps {
  label?: string;
}

export const TabLoadingSpinner: React.FC<TabLoadingSpinnerProps> = ({ label = 'Carregando...' }) => {
  return (
    <div className="w-full min-h-[50vh] flex flex-col items-center justify-center p-8 space-y-4 animate-in fade-in duration-200">
      <div className="relative">
        <div className="w-16 h-16 rounded-3xl bg-indigo-600/10 border-2 border-indigo-500/30 flex items-center justify-center text-indigo-400">
          <Cpu className="w-8 h-8 animate-pulse text-indigo-400" />
        </div>
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-400" />
        </span>
      </div>

      <div className="text-center space-y-1">
        <h4 className="text-sm font-bold text-slate-200 tracking-wide">{label}</h4>
        <p className="text-[11px] text-slate-500 font-mono">Preparando recursos locais</p>
      </div>

      <div className="w-48 h-1 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
        <div className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-500 rounded-full animate-[pulse_1.5s_ease-in-out_infinite]" />
      </div>
    </div>
  );
};
