import React, { useState } from 'react';
import { Shield, Key, Hash, Lock, Unlock, Copy, Check, RefreshCw, FileCheck } from 'lucide-react';
import { computeHash, encryptAESGCM, decryptAESGCM, generateRandomKey } from '../utils/crypto';

export const CryptoToolsView: React.FC = () => {
  // Hash
  const [hashInput, setHashInput] = useState('Jjy 2026');
  const [hashAlgorithm, setHashAlgorithm] = useState<'SHA-256' | 'SHA-512'>('SHA-256');
  const [computedHash, setComputedHash] = useState('');
  const [verifyHashInput, setVerifyHashInput] = useState('');
  const [fileHashResult, setFileHashResult] = useState<string | null>(null);

  // AES-256
  const [aesInput, setAesInput] = useState('');
  const [aesPassphrase, setAesPassphrase] = useState('minha-chave-secreta-2026');
  const [aesOutput, setAesOutput] = useState('');
  const [aesError, setAesError] = useState<string | null>(null);

  // Gerador de Chaves
  const [keyLength, setKeyLength] = useState(32);
  const [generatedKey, setGeneratedKey] = useState(() => generateRandomKey(32));
  const [copiedKey, setCopiedKey] = useState(false);

  // Calcular Hash
  const handleComputeHash = async () => {
    if (!hashInput) return;
    const h = await computeHash(hashInput, hashAlgorithm);
    setComputedHash(h);
  };

  const handleFileUploadHash = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const h = await computeHash(buffer, hashAlgorithm);
    setFileHashResult(`${file.name}: ${h}`);
  };

  const handleEncryptAES = async () => {
    setAesError(null);
    try {
      if (!aesInput.trim() || !aesPassphrase.trim()) return;
      const res = await encryptAESGCM(aesInput.trim(), aesPassphrase.trim());
      setAesOutput(res);
    } catch (err: unknown) {
      setAesError((err as Error).message);
    }
  };

  const handleDecryptAES = async () => {
    setAesError(null);
    try {
      if (!aesInput.trim() || !aesPassphrase.trim()) return;
      const res = await decryptAESGCM(aesInput.trim(), aesPassphrase.trim());
      setAesOutput(res);
    } catch (err: unknown) {
      setAesError((err as Error).message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hashes SHA-256 / SHA-512 */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hash className="w-5 h-5 text-indigo-400" />
              <h3 className="font-semibold text-slate-100">Hashes Criptográficos (SHA)</h3>
            </div>
            <div className="flex gap-1.5">
              {(['SHA-256', 'SHA-512'] as const).map((algo) => (
                <button
                  key={algo}
                  type="button"
                  onClick={() => setHashAlgorithm(algo)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
                    hashAlgorithm === algo
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {algo}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Texto de Entrada</label>
            <textarea
              value={hashInput}
              onChange={(e) => setHashInput(e.target.value)}
              rows={3}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-100 resize-none"
            />
          </div>

          <button
            type="button"
            onClick={handleComputeHash}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all"
          >
            Calcular Hash
          </button>

          {computedHash && (
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Resultado {hashAlgorithm}:</span>
              <p className="text-xs font-mono text-emerald-400 break-all select-all">{computedHash}</p>
            </div>
          )}

          {/* Validador de Integridade */}
          <div className="pt-2 border-t border-slate-800">
            <label className="text-xs text-slate-400 font-medium block mb-1">
              Comparar / Verificar Hash
            </label>
            <input
              type="text"
              value={verifyHashInput}
              onChange={(e) => setVerifyHashInput(e.target.value.trim().toLowerCase())}
              placeholder="Cole o hash esperado para comparar..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-100"
            />
            {verifyHashInput && computedHash && (
              <div
                className={`mt-2 p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                  verifyHashInput === computedHash.toLowerCase()
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                }`}
              >
                {verifyHashInput === computedHash.toLowerCase()
                  ? '✓ Hashes idênticos! Integridade confirmada.'
                  : '✕ Hashes diferentes! Dados foram alterados.'}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1">Calcular Hash de Arquivo</label>
            <input
              type="file"
              onChange={handleFileUploadHash}
              className="block w-full text-xs text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-slate-800 file:text-slate-200"
            />
            {fileHashResult && (
              <p className="mt-2 text-[11px] font-mono text-indigo-300 break-all bg-slate-950 p-2 rounded-lg border border-slate-800">
                {fileHashResult}
              </p>
            )}
          </div>
        </div>

        {/* Criptografia AES-256-GCM */}
        <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-slate-100">Criptografia AES-256-GCM</h3>
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">
              Chave / Senha Secreta
            </label>
            <input
              type="text"
              value={aesPassphrase}
              onChange={(e) => setAesPassphrase(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-emerald-300"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">
              Mensagem ou Texto Cifrado
            </label>
            <textarea
              value={aesInput}
              onChange={(e) => setAesInput(e.target.value)}
              placeholder="Digite o texto para criptografar OU cole o código cifrado para descriptografar..."
              rows={4}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-100 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleEncryptAES}
              className="flex items-center justify-center gap-1.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all"
            >
              <Lock className="w-4 h-4" /> Criptografar
            </button>
            <button
              type="button"
              onClick={handleDecryptAES}
              className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all"
            >
              <Unlock className="w-4 h-4 text-emerald-400" /> Descriptografar
            </button>
          </div>

          {aesError && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl">
              Erro: {aesError}
            </div>
          )}

          {aesOutput && (
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Saída:</span>
              <p className="text-xs font-mono text-slate-200 break-all select-all max-h-36 overflow-y-auto">
                {aesOutput}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Gerador de Chaves Aleatórias Fortes */}
      <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold text-slate-100">Gerador Criptográfico de Chaves & Senhas</h3>
          </div>
          <span className="text-xs text-emerald-400 font-semibold font-mono">256-bit Alta Entropia</span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-mono text-amber-300 select-all truncate">
            {generatedKey}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setGeneratedKey(generateRandomKey(keyLength))}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Gerar Nova
            </button>
            <button
              type="button"
              onClick={() => copyToClipboard(generatedKey)}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all"
            >
              {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedKey ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
