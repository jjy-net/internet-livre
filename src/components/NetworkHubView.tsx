import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Server, Wifi, QrCode, ExternalLink, Terminal, Copy, Check, Radio } from 'lucide-react';

export const NetworkHubView: React.FC = () => {
  const [hostUrl, setHostUrl] = useState(() => {
    return window.location.origin.includes('http') ? window.location.origin : 'http://localhost:4870';
  });
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Detecta automaticamente o endereço IP da rede local para facilitar a leitura no smartphone
    const detectLanIp = async () => {
      try {
        const origin = window.location.origin.includes('http') ? window.location.origin : 'http://localhost:4870';
        const res = await fetch(`${origin}/api/info`);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.ips) && data.ips.length > 0) {
            const lanIp = data.ips.find((ip: string) => !ip.startsWith('127.') && !ip.includes(':')) || data.ips[0];
            const isHttps = window.location.protocol === 'https:';
            const port = isHttps && data.httpsPort ? data.httpsPort : (data.port || 4870);
            const proto = isHttps ? 'https:' : 'http:';
            setHostUrl(`${proto}//${lanIp}:${port}`);
          }
        }
      } catch {
        // Mantém hostUrl padrão
      }
    };
    detectLanIp();
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, hostUrl, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    }).catch(console.error);
  }, [hostUrl]);

  const copyUrl = () => {
    navigator.clipboard.writeText(hostUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const standaloneApps = [
    {
      title: 'Jjy Anônimo',
      file: 'Jjy.html',
      desc: 'Caixa de perguntas e respostas anônimas estilo NGL com link compartilhável.',
    },
    {
      title: 'Jjy Pro (Standalone)',
      file: 'DataLink-Pro.html',
      desc: 'Versão em arquivo HTML único com todos os canais de dados e criptografia.',
    },
    {
      title: 'Jjy Chat (Simples)',
      file: 'DataLink-Chat.html',
      desc: 'Interface de chat leve com suporte a figurinhas e banners editáveis.',
    },
    {
      title: 'Jjy Mesh Network',
      file: 'DataLink-Mesh.html',
      desc: 'Comunicação em malha descentralizada e topologia de nós P2P.',
    },
    {
      title: 'Jjy Completo',
      file: 'DataLink-COMPLETO.html',
      desc: 'Suite clássica completa para navegadores móveis e desktop.',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conectar Celular / Dispositivos Móveis via QR Code */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4 flex flex-col items-center text-center">
          <div className="flex items-center gap-2 self-start">
            <Radio className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-slate-100 text-left">Conectar Dispositivos na Mesma Rede</h3>
          </div>
          <p className="text-xs text-slate-400 self-start text-left">
            Aponte a câmera do seu smartphone ou tablet para o QR Code abaixo para abrir o Jjy instantaneamente no navegador do celular!
          </p>

          <div className="p-3 bg-white rounded-2xl shadow-xl my-2">
            <canvas ref={canvasRef} className="block rounded-lg" />
          </div>

          <div className="w-full flex items-center gap-2">
            <input
              type="text"
              value={hostUrl}
              onChange={(e) => setHostUrl(e.target.value)}
              placeholder="http://192.168.x.x:4870"
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-100"
            />
            <button
              type="button"
              onClick={copyUrl}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>

        {/* Informações do Servidor & Instruções */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-slate-100">Servidor Local Jjy</h3>
          </div>

          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Terminal className="w-4 h-4 text-indigo-400" />
              <span>Como iniciar o servidor de rede no computador:</span>
            </div>
            <div className="p-2.5 bg-slate-900 rounded-lg text-xs font-mono text-emerald-400 select-all border border-slate-800">
              npm run server
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Ou dê duplo clique no arquivo <code>iniciar-servidor.bat</code> na pasta do projeto. O servidor irá expor a interface web e o relay WebSocket na porta <code>4870</code> para todos os aparelhos conectados ao mesmo Wi-Fi.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Aplicações Standalone (HTML Puros)
            </h4>
            <div className="space-y-2">
              {standaloneApps.map((app) => (
                <div
                  key={app.file}
                  className="p-3 bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800/80 rounded-xl transition-all flex items-center justify-between"
                >
                  <div className="pr-3">
                    <span className="text-xs font-semibold text-slate-200 block">{app.title}</span>
                    <span className="text-[10px] text-slate-400">{app.desc}</span>
                  </div>
                  <a
                    href={`./${app.file}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg transition-all shrink-0"
                    title="Abrir arquivo HTML"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
