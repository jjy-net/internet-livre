import React, { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import {
  FileText,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  Layers,
  CheckCircle,
  Hash,
  RefreshCw
} from 'lucide-react';
import { computeHash } from '../utils/crypto';

interface FileChunkMeta {
  fileName: string;
  fileSize: number;
  totalChunks: number;
  chunkIndex: number;
  data: string; // base64
  hash: string;
}

export const FileTransfer: React.FC = () => {
  // Transmissor
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileHash, setFileHash] = useState<string>('');
  const [chunks, setChunks] = useState<string[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(3);
  const [chunkSize, setChunkSize] = useState(180); // chars por QR

  // Receptor
  const [rawChunkInput, setRawChunkInput] = useState('');
  const [receivedChunks, setReceivedChunks] = useState<Map<number, FileChunkMeta>>(new Map());
  const [reconstructedFile, setReconstructedFile] = useState<{ name: string; url: string; size: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playIntervalRef = useRef<number | null>(null);

  // Dividir arquivo em chunks
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setIsPlaying(false);
    setCurrentChunkIndex(0);

    const buffer = await file.arrayBuffer();
    const hash = await computeHash(buffer);
    setFileHash(hash);

    // Converte para base64
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    // Divide em pedaços
    const total = Math.ceil(base64.length / chunkSize);
    const chunkArray: string[] = [];

    for (let i = 0; i < total; i++) {
      const part = base64.slice(i * chunkSize, (i + 1) * chunkSize);
      // Payload JSON compacto
      const chunkPayload = JSON.stringify({
        fn: file.name,
        sz: file.size,
        tc: total,
        ci: i,
        d: part,
        h: hash.slice(0, 8),
      });
      chunkArray.push(chunkPayload);
    }

    setChunks(chunkArray);
  };

  // Renderizar QR Code do chunk atual
  useEffect(() => {
    if (chunks.length === 0 || !canvasRef.current) return;
    const currentPayload = chunks[currentChunkIndex];
    if (!currentPayload) return;

    QRCode.toCanvas(canvasRef.current, currentPayload, {
      width: 340,
      margin: 3,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    }).catch(console.error);
  }, [chunks, currentChunkIndex]);

  // Loop de animação dos chunks (Looping Slideshow)
  useEffect(() => {
    if (!isPlaying || chunks.length === 0) {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
      return;
    }

    const interval = Math.max(100, Math.floor(1000 / fps));
    playIntervalRef.current = window.setInterval(() => {
      setCurrentChunkIndex((prev) => (prev + 1) % chunks.length);
    }, interval);

    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying, fps, chunks.length]);

  // Receptor: Processar chunk inserido
  const addChunkToReceptor = (inputString: string) => {
    try {
      const parsed = JSON.parse(inputString.trim());
      if (parsed.fn && parsed.tc !== undefined && parsed.ci !== undefined && parsed.d) {
        const meta: FileChunkMeta = {
          fileName: parsed.fn,
          fileSize: parsed.sz || 0,
          totalChunks: parsed.tc,
          chunkIndex: parsed.ci,
          data: parsed.d,
          hash: parsed.h || '',
        };

        setReceivedChunks((prev) => {
          const next = new Map(prev);
          next.set(meta.chunkIndex, meta);
          return next;
        });

        setRawChunkInput('');

        // Se coletou todos os chunks, reconstrói automaticamente!
        setReceivedChunks((curr) => {
          if (curr.size === parsed.tc) {
            reconstructCompleteFile(curr);
          }
          return curr;
        });
      }
    } catch {
      alert('Formato de chunk inválido.');
    }
  };

  const reconstructCompleteFile = (chunksMap: Map<number, FileChunkMeta>) => {
    try {
      const first = Array.from(chunksMap.values())[0];
      if (!first) return;

      let fullBase64 = '';
      for (let i = 0; i < first.totalChunks; i++) {
        const c = chunksMap.get(i);
        if (!c) {
          alert(`Chunk #${i + 1} faltando!`);
          return;
        }
        fullBase64 += c.data;
      }

      const byteChars = atob(fullBase64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray]);
      const url = URL.createObjectURL(blob);

      setReconstructedFile({
        name: first.fileName,
        url,
        size: byteArray.byteLength,
      });

      confetti({ particleCount: 70, spread: 80 });
    } catch (err) {
      console.error('Erro na reconstrução:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Painel Esquerdo: Transmissor Arquivo -> Chunks QR */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-100 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              <span>Transmissor de Arquivo (Chunking)</span>
            </h3>
            {chunks.length > 0 && (
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                {chunks.length} QR Codes
              </span>
            )}
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium block mb-2">
              Selecione um Arquivo para Transmitir
            </label>
            <input
              type="file"
              onChange={handleFileSelect}
              className="block w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 file:cursor-pointer bg-slate-950 p-2 rounded-xl border border-slate-800"
            />
          </div>

          {selectedFile && chunks.length > 0 && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs font-mono space-y-1 text-slate-300">
                <div>Arquivo: <span className="text-indigo-300">{selectedFile.name}</span></div>
                <div>Tamanho: <span className="text-slate-400">{(selectedFile.size / 1024).toFixed(1)} KB</span></div>
                <div className="truncate">SHA-256: <span className="text-emerald-400">{fileHash}</span></div>
              </div>

              {/* QR Code Canvas */}
              <div className="flex flex-col items-center">
                <div className="p-3 bg-white rounded-2xl shadow-xl">
                  <canvas ref={canvasRef} className="block rounded-lg" />
                </div>
                <div className="mt-3 text-xs font-mono font-semibold text-slate-200">
                  QR #{currentChunkIndex + 1} de {chunks.length}
                </div>
              </div>

              {/* Controles de Reprodução */}
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentChunkIndex((prev) => (prev - 1 + chunks.length) % chunks.length)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700"
                  title="Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold shadow-md transition-all ${
                    isPlaying
                      ? 'bg-amber-600 hover:bg-amber-500 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{isPlaying ? 'Pausar' : 'Transmitir em Loop'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentChunkIndex((prev) => (prev + 1) % chunks.length)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700"
                  title="Próximo"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Ajuste de Velocidade (FPS) */}
              <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
                <span>Velocidade de Transmissão: {fps} FPS</span>
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={1}
                  value={fps}
                  onChange={(e) => setFps(Number(e.target.value))}
                  className="w-36 accent-indigo-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Painel Direito: Receptor & Reconstrutor */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-100 flex items-center gap-2">
              <Download className="w-5 h-5 text-emerald-400" />
              <span>Receptor & Montador de Arquivo</span>
            </h3>
            <button
              type="button"
              onClick={() => {
                setReceivedChunks(new Map());
                setReconstructedFile(null);
              }}
              className="text-xs text-slate-500 hover:text-rose-400 transition-colors"
            >
              Reiniciar
            </button>
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium block mb-2">
              Inserir Dados do QR Escaneado
            </label>
            <div className="flex gap-2">
              <textarea
                value={rawChunkInput}
                onChange={(e) => setRawChunkInput(e.target.value)}
                placeholder='Cole o texto do QR Code escaneado aqui (começa com {"fn":...})...'
                rows={3}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs font-mono text-slate-100 resize-none"
              />
            </div>
            <button
              type="button"
              onClick={() => addChunkToReceptor(rawChunkInput)}
              disabled={!rawChunkInput.trim()}
              className="mt-2 w-full py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all"
            >
              Adicionar Chunk
            </button>
          </div>

          {/* Progresso de Chunks Recebidos */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Chunks Recebidos</span>
              <span className="font-mono font-semibold text-indigo-400">{receivedChunks.size} partes</span>
            </div>

            {receivedChunks.size > 0 && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 max-h-40 overflow-y-auto space-y-1">
                {Array.from(receivedChunks.values()).map((c) => (
                  <div key={c.chunkIndex} className="flex items-center justify-between text-xs font-mono text-slate-300">
                    <span>Parte #{c.chunkIndex + 1} de {c.totalChunks}</span>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Arquivo Montado Pronto para Download */}
          {reconstructedFile && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <CheckCircle className="w-5 h-5" />
                <span>Arquivo Reconstruído com Sucesso!</span>
              </div>
              <div className="text-xs font-mono text-slate-300">
                Nome: <span className="text-white font-semibold">{reconstructedFile.name}</span> ({(reconstructedFile.size / 1024).toFixed(1)} KB)
              </div>
              <a
                href={reconstructedFile.url}
                download={reconstructedFile.name}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-600/25 transition-all"
              >
                <Download className="w-4 h-4" /> Baixar Arquivo Reconstruído
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
