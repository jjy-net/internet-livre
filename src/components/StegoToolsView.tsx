import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Eye, EyeOff, Download, Upload, Check, Info, Music, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { encodeStego, decodeStego } from '../utils/stego';
import { AudioStegoView } from './AudioStegoView';

export const StegoToolsView: React.FC = () => {
  // Modo de Mídia: Áudio ou Imagem
  const [mediaType, setMediaType] = useState<'audio' | 'image'>('audio');

  // Ocultar Imagem
  const [encodeImage, setEncodeImage] = useState<string | null>(null);
  const [secretMessage, setSecretMessage] = useState('Mensagem Secreta Top-Secret');
  const [encodedResultUrl, setEncodedResultUrl] = useState<string | null>(null);
  const [encodeError, setEncodeError] = useState<string | null>(null);

  // Revelar
  const [decodeImage, setDecodeImage] = useState<string | null>(null);
  const [extractedMessage, setExtractedMessage] = useState<string | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);

  const encodeCanvasRef = useRef<HTMLCanvasElement>(null);
  const decodeCanvasRef = useRef<HTMLCanvasElement>(null);

  const handleEncodeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEncodeError(null);
    setEncodedResultUrl(null);

    const reader = new FileReader();
    reader.onload = () => {
      setEncodeImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const processEncode = () => {
    if (!encodeImage || !secretMessage.trim()) return;
    setEncodeError(null);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = encodeCanvasRef.current;
      if (!canvas) return;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);

      try {
        encodeStego(canvas, secretMessage.trim());
        const dataUrl = canvas.toDataURL('image/png');
        setEncodedResultUrl(dataUrl);
        confetti({ particleCount: 50 });
      } catch (err: unknown) {
        setEncodeError((err as Error).message);
      }
    };
    img.src = encodeImage;
  };

  const handleDecodeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDecodeError(null);
    setExtractedMessage(null);

    const reader = new FileReader();
    reader.onload = () => {
      setDecodeImage(reader.result as string);
      const img = new Image();
      img.onload = () => {
        const canvas = decodeCanvasRef.current;
        if (!canvas) return;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);

        try {
          const text = decodeStego(canvas);
          setExtractedMessage(text);
          confetti({ particleCount: 50 });
        } catch (err: unknown) {
          setDecodeError((err as Error).message);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      {/* Seletor de Tipo de Esteganografia */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => setMediaType('audio')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            mediaType === 'audio'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Music className="w-4 h-4 text-indigo-300" />
          <span>Áudio & Músicas (WAV / MP3 + RSA)</span>
          <span className="text-[9px] bg-white/20 text-white px-1.5 py-0.2 rounded-full font-bold">
            Novo
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMediaType('image')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            mediaType === 'image'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <ImageIcon className="w-4 h-4 text-purple-300" />
          <span>Imagens (PNG LSB)</span>
        </button>
      </div>

      {/* Renderização Condicional */}
      {mediaType === 'audio' ? (
        <AudioStegoView />
      ) : (
        <div className="space-y-6">
          <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-2xl flex items-start gap-3">
            <Info className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div className="text-xs text-purple-300">
              <strong>Esteganografia em Imagens (LSB):</strong> Permite esconder textos invisíveis dentro dos pixels de imagens PNG. O olho humano não nota nenhuma alteração na imagem, mas qualquer pessoa com o Jyy pode extrair a mensagem oculta.
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Esconder Mensagem */}
            <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <EyeOff className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-slate-100">Ocultar Mensagem em Imagem</h3>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1.5">
                  1. Selecionar Imagem Base
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleEncodeFile}
                  className="block w-full text-xs text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-slate-800 file:text-slate-200"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1.5">
                  2. Mensagem Secreta para Esconder
                </label>
                <textarea
                  value={secretMessage}
                  onChange={(e) => setSecretMessage(e.target.value)}
                  placeholder="Digite a mensagem secreta..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 font-mono resize-none"
                />
              </div>

              <button
                type="button"
                onClick={processEncode}
                disabled={!encodeImage || !secretMessage.trim()}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-purple-600/25 transition-all"
              >
                Esconder Mensagem na Imagem
              </button>

              {encodeError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl">
                  {encodeError}
                </div>
              )}

              <canvas ref={encodeCanvasRef} className="hidden" />

              {encodedResultUrl && (
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                    <Check className="w-4 h-4" /> Mensagem embutida com sucesso!
                  </div>
                  <img
                    src={encodedResultUrl}
                    alt="Resultado Esteganográfico"
                    className="max-h-48 rounded-lg mx-auto object-contain border border-slate-800"
                  />
                  <a
                    href={encodedResultUrl}
                    download="stego-jyy.png"
                    className="flex items-center justify-center gap-2 w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all"
                  >
                    <Download className="w-4 h-4 text-purple-400" /> Baixar Imagem (PNG Sem Perdas)
                  </a>
                </div>
              )}
            </div>

            {/* Revelar Mensagem */}
            <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-slate-100">Revelar Mensagem Oculta</h3>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1.5">
                  Selecione a Imagem Codificada
                </label>
                <input
                  type="file"
                  accept="image/png,image/*"
                  onChange={handleDecodeFile}
                  className="block w-full text-xs text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-slate-800 file:text-slate-200"
                />
              </div>

              <canvas ref={decodeCanvasRef} className="hidden" />

              {decodeError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl">
                  {decodeError}
                </div>
              )}

              {extractedMessage && (
                <div className="p-4 bg-slate-950 rounded-xl border border-emerald-500/40 space-y-2">
                  <span className="text-[10px] text-emerald-400 uppercase font-semibold">
                    Mensagem Oculta Extraída:
                  </span>
                  <p className="text-xs font-mono text-slate-100 select-all break-all whitespace-pre-wrap">
                    {extractedMessage}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
