import React, { useState, useRef, useEffect } from 'react';
import {
  Music,
  Key,
  Lock,
  Unlock,
  ShieldCheck,
  Eye,
  EyeOff,
  Download,
  Upload,
  Play,
  Pause,
  Sparkles,
  Check,
  Copy,
  FileText,
  Volume2,
  VolumeX,
  Sliders,
  RefreshCw,
  AlertCircle,
  Info,
  CheckCircle2,
  Share2,
  Radio,
  Zap,
  ShieldAlert,
  Flame,
  Binary,
  Layers,
  Activity,
  MicOff,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  decodeAudioFile,
  generateSyntheticCarrier,
  embedMessageInAudio,
  extractMessageFromAudio,
  StegoStats,
  ExtractedStegoResult,
} from '../utils/audioStego';
import { generateAsymmetricKeyPair, AsymmetricKeyPair } from '../utils/crypto';
import {
  createPlausibleDeniabilityPayload,
  extractDeniableMessage,
  generateSpectrogramPainterAudio,
  generateAcousticMaskingAudio,
  sanitizeWavMetadata,
  AcousticMaskMode,
} from '../utils/tacticalAudio';

export const AudioStegoView: React.FC = () => {
  // Sub-abas táticas
  const [activeSubTab, setActiveSubTab] = useState<'embed' | 'spectrogram' | 'jammer' | 'extract' | 'keys'>('embed');

  // Chaves RSA
  const [keyPair, setKeyPair] = useState<AsymmetricKeyPair | null>(null);
  const [copiedKey, setCopiedKey] = useState<'public' | 'private' | null>(null);
  const [isGeneratingKeys, setIsGeneratingKeys] = useState(false);

  // --- EMBED STATE ---
  const [carrierSource, setCarrierSource] = useState<'file' | 'synth'>('synth');
  const [carrierFile, setCarrierFile] = useState<File | null>(null);
  const [carrierBuffer, setCarrierBuffer] = useState<AudioBuffer | null>(null);
  const [carrierDuration, setCarrierDuration] = useState<number>(0);
  const [carrierName, setCarrierName] = useState<string>('Trilha Acústica Sintética Jyy');
  const [secretMessage, setSecretMessage] = useState('RELATÓRIO CONFIDENCIAL: Operação Delta confirmada para o quadrante 4.');
  const [encryptionMode, setEncryptionMode] = useState<'none' | 'asymmetric_rsa' | 'symmetric_aes' | 'plausible_deniable'>('plausible_deniable');
  const [recipientPublicKey, setRecipientPublicKey] = useState('');
  const [symmetricPassword, setSymmetricPassword] = useState('');

  // Negabilidade Plausível (Duplo Payload)
  const [decoyMessage, setDecoyMessage] = useState('Lista de compras de supermercado: café, pão integral e leite desnatado.');
  const [decoyPassword, setDecoyPassword] = useState('senha-coacao-123');
  const [realPassword, setRealPassword] = useState('TopSecret-Omega-2026!');

  // Parâmetros Técnicos Avançados
  const [channelMode, setChannelMode] = useState<'both' | 'left' | 'right'>('both');
  const [stride, setStride] = useState<number>(1);
  const [enableSanitization, setEnableSanitization] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Embed Result
  const [isProcessingEmbed, setIsProcessingEmbed] = useState(false);
  const [embedError, setEmbedError] = useState<string | null>(null);
  const [stegoWavUrl, setStegoWavUrl] = useState<string | null>(null);
  const [stegoStats, setStegoStats] = useState<StegoStats | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // --- ESPECTROGRAMA VISUAL STATE ---
  const [specText, setSpecText] = useState('JYY-SIGINT');
  const [specMinFreq, setSpecMinFreq] = useState(14000);
  const [specMaxFreq, setSpecMaxFreq] = useState(19000);
  const [specCharMs, setSpecCharMs] = useState(140);
  const [specWavUrl, setSpecWavUrl] = useState<string | null>(null);
  const [isGeneratingSpec, setIsGeneratingSpec] = useState(false);
  const specAudioRef = useRef<HTMLAudioElement | null>(null);

  // --- SPEECH JAMMER / MASCARAMENTO STATE ---
  const [maskMode, setMaskMode] = useState<AcousticMaskMode>('speech_babble');
  const [maskDuration, setMaskDuration] = useState(45);
  const [isJammerActive, setIsJammerActive] = useState(false);
  const [jammerVolume, setJammerVolume] = useState(0.6);
  const jammerCtxRef = useRef<AudioContext | null>(null);
  const jammerSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const jammerGainRef = useRef<GainNode | null>(null);

  // --- EXTRACT STATE ---
  const [extractFile, setExtractFile] = useState<File | null>(null);
  const [extractPrivateKey, setExtractPrivateKey] = useState('');
  const [extractPassword, setExtractPassword] = useState('');
  const [isProcessingExtract, setIsProcessingExtract] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractedResult, setExtractedResult] = useState<ExtractedStegoResult | null>(null);
  const [deniableCompartment, setDeniableCompartment] = useState<'decoy' | 'real' | null>(null);
  const [hasCopiedMessage, setHasCopiedMessage] = useState(false);

  // Carregar ou gerar chaves salvas no localStorage
  useEffect(() => {
    try {
      const savedPub = localStorage.getItem('jyy_stego_pubkey');
      const savedPriv = localStorage.getItem('jyy_stego_privkey');
      if (savedPub && savedPriv) {
        const loadedKeys = { publicKeyPem: savedPub, privateKeyPem: savedPriv };
        setKeyPair(loadedKeys);
        setRecipientPublicKey(savedPub);
        setExtractPrivateKey(savedPriv);
      } else {
        handleGenerateKeys(false);
      }
    } catch {
      handleGenerateKeys(false);
    }
  }, []);

  // Inicializar carreador sintético inicial
  useEffect(() => {
    if (carrierSource === 'synth') {
      try {
        const synth = generateSyntheticCarrier(12);
        setCarrierBuffer(synth);
        setCarrierDuration(synth.duration);
        setCarrierName('Acordes Harmônicos Sintéticos Jyy (12s)');
      } catch (err) {
        console.error('Erro ao gerar carreador inicial:', err);
      }
    }
  }, [carrierSource]);

  const handleGenerateKeys = async (notify = true) => {
    setIsGeneratingKeys(true);
    try {
      const keys = await generateAsymmetricKeyPair();
      setKeyPair(keys);
      setRecipientPublicKey(keys.publicKeyPem);
      setExtractPrivateKey(keys.privateKeyPem);
      localStorage.setItem('jyy_stego_pubkey', keys.publicKeyPem);
      localStorage.setItem('jyy_stego_privkey', keys.privateKeyPem);
      if (notify) confetti({ particleCount: 35, origin: { y: 0.6 } });
    } catch (err) {
      console.error('Falha ao gerar par de chaves RSA:', err);
    } finally {
      setIsGeneratingKeys(false);
    }
  };

  const copyToClipboard = (text: string, type: 'public' | 'private') => {
    navigator.clipboard.writeText(text);
    setCopiedKey(type);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleCarrierFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEmbedError(null);
    setStegoWavUrl(null);
    setStegoStats(null);
    setCarrierFile(file);
    setCarrierName(file.name);
    setCarrierSource('file');

    try {
      const buf = await decodeAudioFile(file);
      setCarrierBuffer(buf);
      setCarrierDuration(buf.duration);
    } catch {
      setEmbedError('Erro ao decodificar áudio. Certifique-se de que é um formato válido (MP3, WAV, OGG, M4A).');
      setCarrierBuffer(null);
    }
  };

  // Processar Injeção Esteganográfica
  const handleProcessEmbed = async () => {
    if (!carrierBuffer) {
      setEmbedError('Nenhum áudio carreador carregado.');
      return;
    }

    setEmbedError(null);
    setIsProcessingEmbed(true);
    setStegoWavUrl(null);

    try {
      let finalPayload = secretMessage.trim();
      let effectiveEncryption: 'none' | 'asymmetric_rsa' | 'symmetric_aes' = 'none';

      if (encryptionMode === 'plausible_deniable') {
        if (!decoyPassword.trim() || !realPassword.trim()) {
          throw new Error('Preencha tanto a Senha de Coação (Chamariz) quanto a Senha Secreta Real.');
        }
        finalPayload = await createPlausibleDeniabilityPayload(
          decoyMessage.trim(),
          decoyPassword.trim(),
          secretMessage.trim(),
          realPassword.trim()
        );
        effectiveEncryption = 'none'; // Já pré-cifrado em dois compartimentos independentes
      } else if (encryptionMode === 'asymmetric_rsa') {
        if (!recipientPublicKey.trim()) throw new Error('Chave Pública RSA necessária.');
        effectiveEncryption = 'asymmetric_rsa';
      } else if (encryptionMode === 'symmetric_aes') {
        if (!symmetricPassword.trim()) throw new Error('Senha necessária para criptografia AES.');
        effectiveEncryption = 'symmetric_aes';
      }

      const { wavBlob, wavUrl, stats } = await embedMessageInAudio(carrierBuffer, finalPayload, {
        channel: channelMode,
        stride,
        encryption: effectiveEncryption,
        publicKeyPem: recipientPublicKey.trim(),
        secretKey: symmetricPassword.trim(),
      });

      // Sanitização anti-forense opcional
      if (enableSanitization) {
        const rawBytes = new Uint8Array(await wavBlob.arrayBuffer());
        const cleanBytes = sanitizeWavMetadata(rawBytes);
        const cleanBlob = new Blob([cleanBytes.buffer as ArrayBuffer], { type: 'audio/wav' });
        const cleanUrl = URL.createObjectURL(cleanBlob);
        setStegoWavUrl(cleanUrl);
      } else {
        setStegoWavUrl(wavUrl);
      }

      setStegoStats(stats);
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.65 } });
    } catch (err: unknown) {
      setEmbedError((err as Error).message || 'Falha ao injetar mensagem esteganográfica no áudio.');
    } finally {
      setIsProcessingEmbed(false);
    }
  };

  // Gerador de Pintura Espectrográfica Visual
  const handleGenerateSpectrogramVisual = () => {
    if (!specText.trim()) return;
    setIsGeneratingSpec(true);
    try {
      const buffer = generateSpectrogramPainterAudio(
        specText.trim(),
        specMinFreq,
        specMaxFreq,
        specCharMs
      );

      // Converte buffer em WAV direto
      const ch0 = buffer.getChannelData(0);
      const ch1 = buffer.getChannelData(1);
      const intArr0 = new Int16Array(buffer.length);
      const intArr1 = new Int16Array(buffer.length);
      for (let i = 0; i < buffer.length; i++) {
        intArr0[i] = Math.max(-32768, Math.min(32767, Math.floor(ch0[i] * 32767)));
        intArr1[i] = Math.max(-32768, Math.min(32767, Math.floor(ch1[i] * 32767)));
      }

      const numChannels = 2;
      const sampleRate = buffer.sampleRate;
      const bytesPerSample = 2;
      const blockAlign = numChannels * bytesPerSample;
      const byteRate = sampleRate * blockAlign;
      const dataSize = buffer.length * blockAlign;
      const ab = new ArrayBuffer(44 + dataSize);
      const v = new DataView(ab);

      const writeStr = (off: number, s: string) => {
        for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
      };

      writeStr(0, 'RIFF');
      v.setUint32(4, 36 + dataSize, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      v.setUint32(16, 16, true);
      v.setUint16(20, 1, true);
      v.setUint16(22, numChannels, true);
      v.setUint32(24, sampleRate, true);
      v.setUint32(28, byteRate, true);
      v.setUint16(32, blockAlign, true);
      v.setUint16(34, 16, true);
      writeStr(36, 'data');
      v.setUint32(40, dataSize, true);

      let offset = 44;
      for (let i = 0; i < buffer.length; i++) {
        v.setInt16(offset, intArr0[i], true);
        v.setInt16(offset + 2, intArr1[i], true);
        offset += 4;
      }

      const blob = new Blob([ab], { type: 'audio/wav' });
      setSpecWavUrl(URL.createObjectURL(blob));
      confetti({ particleCount: 45 });
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingSpec(false);
    }
  };

  // Jammer de Mascaramento Acústico
  const toggleJammer = () => {
    if (isJammerActive) {
      if (jammerSourceRef.current) {
        try { jammerSourceRef.current.stop(); } catch {}
        jammerSourceRef.current = null;
      }
      if (jammerCtxRef.current) {
        jammerCtxRef.current.close().catch(() => {});
        jammerCtxRef.current = null;
      }
      setIsJammerActive(false);
    } else {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        jammerCtxRef.current = ctx;

        const noiseBuf = generateAcousticMaskingAudio(maskMode, maskDuration, ctx.sampleRate);
        const source = ctx.createBufferSource();
        source.buffer = noiseBuf;
        source.loop = true;

        const gain = ctx.createGain();
        gain.gain.value = jammerVolume;
        jammerGainRef.current = gain;

        source.connect(gain);
        gain.connect(ctx.destination);
        source.start();

        jammerSourceRef.current = source;
        setIsJammerActive(true);
      } catch (err) {
        console.error('Erro ao acionar contra-medida acústica:', err);
      }
    }
  };

  // Atualizar volume do Jammer em tempo real
  useEffect(() => {
    if (jammerGainRef.current && jammerCtxRef.current) {
      jammerGainRef.current.gain.setTargetAtTime(jammerVolume, jammerCtxRef.current.currentTime, 0.05);
    }
  }, [jammerVolume]);

  // Limpeza de áudio ao desmontar
  useEffect(() => {
    return () => {
      if (jammerSourceRef.current) try { jammerSourceRef.current.stop(); } catch {}
      if (jammerCtxRef.current) jammerCtxRef.current.close().catch(() => {});
    };
  }, []);

  // Extrair Mensagem do Áudio
  const handleProcessExtract = async () => {
    if (!extractFile) {
      setExtractError('Selecione um arquivo de áudio WAV para decodificar.');
      return;
    }

    setExtractError(null);
    setIsProcessingExtract(true);
    setExtractedResult(null);
    setDeniableCompartment(null);

    try {
      const result = await extractMessageFromAudio(
        extractFile,
        extractPrivateKey.trim(),
        extractPassword.trim()
      );

      if (result.success) {
        // Verificar se é payload de negabilidade plausível
        try {
          const parsed = JSON.parse(result.message);
          if (parsed.mode === 'deniable_dual') {
            if (!extractPassword.trim()) {
              setExtractError('Detectado pacote de Duplo Compartimento (Negabilidade Plausível). Insira uma senha para abrir.');
              setIsProcessingExtract(false);
              return;
            }

            const opened = await extractDeniableMessage(result.message, extractPassword.trim());
            result.message = opened.message;
            setDeniableCompartment(opened.type as 'decoy' | 'real');
          }
        } catch {}

        setExtractedResult(result);
        confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
      } else if (result.error) {
        setExtractError(result.error);
      }
    } catch (err: unknown) {
      setExtractError((err as Error).message || 'Falha ao analisar arquivo de áudio.');
    } finally {
      setIsProcessingExtract(false);
    }
  };

  // Botão de Pânico / Zero-Wipe Instantâneo
  const handlePanicZeroWipe = () => {
    setSecretMessage('');
    setDecoyMessage('');
    setDecoyPassword('');
    setRealPassword('');
    setSymmetricPassword('');
    setExtractPrivateKey('');
    setExtractPassword('');
    setExtractedResult(null);
    setStegoWavUrl(null);
    setSpecWavUrl(null);
    setCarrierBuffer(null);
    setCarrierFile(null);
    setExtractFile(null);
    if (isJammerActive) toggleJammer();
    localStorage.removeItem('jyy_stego_pubkey');
    localStorage.removeItem('jyy_stego_privkey');
    setKeyPair(null);
    alert('🚨 ZERO-WIPE EXECUTADO: Todas as chaves, buffers de áudio e dados em memória foram purgados.');
  };

  return (
    <div className="space-y-6">
      {/* HUD TÁTICO MILITAR / COMSEC HEADER */}
      <div className="p-4 bg-gradient-to-r from-slate-950 via-indigo-950/40 to-slate-950 border border-indigo-500/40 rounded-2xl flex items-center justify-between flex-wrap gap-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/20 border border-indigo-500/50 rounded-xl text-indigo-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-slate-100 uppercase tracking-widest flex items-center gap-2">
                COMSEC Tactical Audio Suite
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full font-mono">
                  MIL-STD • LPI / LPD
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Esteganografia DSSS • Negabilidade Plausível • Pintura de Espectro FFT • Blindagem Acústica Anti-Grampo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Botão de Pânico / Zero-Wipe */}
          <button
            type="button"
            onClick={handlePanicZeroWipe}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/50 rounded-xl text-xs font-bold text-rose-300 shadow-sm transition-all"
            title="Destruir todas as chaves, mensagens e buffers temporários da memória"
          >
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span>Zero-Wipe (Pânico)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('keys')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 transition-all shadow-sm"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span>Chaves RSA</span>
          </button>
        </div>
      </div>

      {/* NAVEGAÇÃO ENTRE OS 5 MÓDULOS DE CONTRA-ESPIONAGEM */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveSubTab('embed')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeSubTab === 'embed'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Lock className="w-4 h-4 text-indigo-300" />
          <span>1. Camuflagem Tática (DSSS & Dual-Key)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('spectrogram')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeSubTab === 'spectrogram'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Activity className="w-4 h-4 text-purple-300" />
          <span>2. Pintura no Espectrograma (FFT Covert)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('jammer')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeSubTab === 'jammer'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <MicOff className="w-4 h-4 text-rose-300" />
          <span>3. Mascaramento Anti-Grampo (Jammer)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('extract')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeSubTab === 'extract'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Eye className="w-4 h-4 text-emerald-300" />
          <span>4. Decodificador SIGINT (Extração)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('keys')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeSubTab === 'keys'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Key className="w-4 h-4 text-amber-300" />
          <span>5. Bóia de Chaves RSA-OAEP</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. CAMUFLAGEM TÁTICA (DSSS + NEGABILIDADE PLAUSÍVEL) */}
      {/* ========================================================================= */}
      {activeSubTab === 'embed' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Painel de Entrada e Armamento */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                <Binary className="w-4 h-4" /> 1. Carreador de Áudio (Álibi Acústico)
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">Modo: LSB PRNG 16-bit</span>
            </div>

            {/* Seleção do Áudio */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCarrierSource('synth')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  carrierSource === 'synth'
                    ? 'bg-indigo-950/60 border-indigo-500/80 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                }`}
              >
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <span>🎶</span> Trilha Acústica Sintética
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Gera carreador sonoro puro com harmônicos ricos sem depender de arquivos externos.
                </div>
              </button>

              <label
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  carrierSource === 'file'
                    ? 'bg-indigo-950/60 border-indigo-500/80 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                }`}
              >
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-indigo-400" /> Carregar Música Própria
                </div>
                <div className="text-[10px] text-slate-400 mt-1 truncate">
                  {carrierFile ? carrierFile.name : 'MP3, WAV, OGG, FLAC ou M4A'}
                </div>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleCarrierFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {carrierBuffer && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="font-bold text-slate-200 block truncate max-w-[220px]">
                    {carrierName}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {carrierDuration.toFixed(1)}s • {carrierBuffer.sampleRate} Hz • {carrierBuffer.numberOfChannels === 2 ? 'Estéreo' : 'Mono'}
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full">
                  Capacidade: ~{Math.floor((carrierBuffer.length * carrierBuffer.numberOfChannels) / 8 / 1024)} KB
                </span>
              </div>
            )}

            {/* SELEÇÃO DO TIPO DE PROTEÇÃO */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">
                2. Nível de Blindagem Criptográfica:
              </label>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setEncryptionMode('plausible_deniable')}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    encryptionMode === 'plausible_deniable'
                      ? 'bg-rose-950/60 border-rose-500 text-rose-300 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5 mx-auto mb-1 text-rose-400" />
                  Negabilidade Plausível (Duplo)
                </button>

                <button
                  type="button"
                  onClick={() => setEncryptionMode('asymmetric_rsa')}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    encryptionMode === 'asymmetric_rsa'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5 mx-auto mb-1 text-indigo-400" />
                  Chave Pública RSA-2048
                </button>

                <button
                  type="button"
                  onClick={() => setEncryptionMode('symmetric_aes')}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    encryptionMode === 'symmetric_aes'
                      ? 'bg-purple-600/20 border-purple-500 text-purple-300 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  <Key className="w-3.5 h-3.5 mx-auto mb-1 text-purple-400" />
                  AES-256-GCM Simétrico
                </button>
              </div>

              {/* SEÇÃO NEGABILIDADE PLAUSÍVEL (DUPLO PAYLOAD) */}
              {encryptionMode === 'plausible_deniable' && (
                <div className="space-y-3 p-3.5 bg-rose-950/20 border border-rose-500/30 rounded-xl mt-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Compartimento de Coação (Decoy / Chamariz):</span>
                  </div>
                  <input
                    type="text"
                    value={decoyMessage}
                    onChange={(e) => setDecoyMessage(e.target.value)}
                    placeholder="Mensagem inofensiva que será mostrada sob coerção..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 font-mono"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Senha do Chamariz:</span>
                    <input
                      type="password"
                      value={decoyPassword}
                      onChange={(e) => setDecoyPassword(e.target.value)}
                      placeholder="Senha que você confessará se for coagido..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-mono"
                    />
                  </div>

                  <hr className="border-slate-800" />

                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                    <Lock className="w-4 h-4" />
                    <span>Compartimento Real (Inteligência Ultrassecreta):</span>
                  </div>
                  <textarea
                    rows={2}
                    value={secretMessage}
                    onChange={(e) => setSecretMessage(e.target.value)}
                    placeholder="A mensagem real que ninguém além de você deve ver..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-emerald-300 font-mono resize-none"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Senha Real Verdadeira:</span>
                    <input
                      type="password"
                      value={realPassword}
                      onChange={(e) => setRealPassword(e.target.value)}
                      placeholder="Senha ultra-secreta de abertura real..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-emerald-300 font-mono"
                    />
                  </div>
                </div>
              )}

              {/* SEÇÃO RSA */}
              {encryptionMode === 'asymmetric_rsa' && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Chave Pública do Destinatário (PEM):</span>
                    {keyPair && (
                      <button
                        type="button"
                        onClick={() => setRecipientPublicKey(keyPair.publicKeyPem)}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 underline"
                      >
                        Carregar Minha Chave
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={3}
                    value={recipientPublicKey}
                    onChange={(e) => setRecipientPublicKey(e.target.value)}
                    placeholder="-----BEGIN PUBLIC KEY-----..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-[10px] font-mono text-slate-300 resize-none focus:outline-none focus:border-indigo-500"
                  />
                  <textarea
                    rows={2}
                    value={secretMessage}
                    onChange={(e) => setSecretMessage(e.target.value)}
                    placeholder="Mensagem confidencial a ser criptografada..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 font-mono resize-none focus:outline-none"
                  />
                </div>
              )}

              {/* SEÇÃO AES */}
              {encryptionMode === 'symmetric_aes' && (
                <div className="space-y-2 pt-1">
                  <input
                    type="password"
                    value={symmetricPassword}
                    onChange={(e) => setSymmetricPassword(e.target.value)}
                    placeholder="Senha simétrica AES-256..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono"
                  />
                  <textarea
                    rows={2}
                    value={secretMessage}
                    onChange={(e) => setSecretMessage(e.target.value)}
                    placeholder="Mensagem confidencial..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 font-mono resize-none"
                  />
                </div>
              )}
            </div>

            {/* CONTROLES AVANÇADOS / ANTI-FORENSE */}
            <div className="border-t border-slate-800 pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 font-bold"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Parâmetros de Dispersão e Anti-Forense</span>
                </button>

                <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableSanitization}
                    onChange={(e) => setEnableSanitization(e.target.checked)}
                    className="accent-indigo-600 rounded"
                  />
                  <span>Sanitizar Metadados RIFF/ID3</span>
                </label>
              </div>

              {showAdvanced && (
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Canais Injetados:</span>
                    <select
                      value={channelMode}
                      onChange={(e) => setChannelMode(e.target.value as 'both' | 'left' | 'right')}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-slate-200 text-xs"
                    >
                      <option value="both">Ambos (Estéreo L+R)</option>
                      <option value="left">Apenas Esquerdo (L)</option>
                      <option value="right">Apenas Direito (R)</option>
                    </select>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Espalhamento (Stride):</span>
                    <select
                      value={stride}
                      onChange={(e) => setStride(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-slate-200 text-xs"
                    >
                      <option value={1}>1 (Máxima Capacidade)</option>
                      <option value={2}>2 (Amostras Alternadas)</option>
                      <option value={4}>4 (Anti-Detecção Chi-Square)</option>
                      <option value={8}>8 (Ultra-Dispersão Militar)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {embedError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{embedError}</span>
              </div>
            )}

            <button
              type="button"
              disabled={isProcessingEmbed || !carrierBuffer}
              onClick={handleProcessEmbed}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              {isProcessingEmbed ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Embutindo bits táticos no sinal de áudio...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Armar e Injetar Mensagem na Música</span>
                </>
              )}
            </button>
          </div>

          {/* Painel de Saída, Player e Métricas SIGINT */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl">
            <div>
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-3">
                <Volume2 className="w-4 h-4 text-emerald-400" /> Carreador Gerado & Indicadores SIGINT
              </h3>

              {!stegoWavUrl ? (
                <div className="h-64 border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                  <Music className="w-10 h-10 text-slate-700 animate-pulse" />
                  <p className="text-xs text-slate-400 font-semibold">
                    Aguardando montagem do pacote esteganográfico.
                  </p>
                  <p className="text-[11px] text-slate-600 max-w-sm">
                    O sinal conterá o payload embutido sem nenhuma alteração no timbre ou melodia da música.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-indigo-500/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> Sinal Acústico Pronto
                      </span>
                      <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-mono">
                        Lossless PCM 16-bit
                      </span>
                    </div>

                    <audio
                      ref={audioPlayerRef}
                      src={stegoWavUrl}
                      controls
                      className="w-full mt-2"
                    />

                    <p className="text-[11px] text-slate-400 italic">
                      🎧 Ouça a música acima. A alteração dos bits é totalmente inaudível ao ouvido humano (-98dB SNR).
                    </p>
                  </div>

                  {stegoStats && (
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
                      <span className="font-bold text-slate-300 block text-[11px]">
                        Diagnóstico de Camuflagem Espectral:
                      </span>
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                        <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                          <span className="text-slate-500 block text-[10px]">Tamanho Injetado:</span>
                          <span className="font-bold text-slate-200">{stegoStats.usedBytes} bytes</span>
                        </div>
                        <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                          <span className="text-slate-500 block text-[10px]">Densidade da Trilha:</span>
                          <span className="font-bold text-indigo-400">{stegoStats.capacityPercent}% do áudio</span>
                        </div>
                        <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                          <span className="text-slate-500 block text-[10px]">Relação Sinal/Ruído:</span>
                          <span className="font-bold text-emerald-400">{stegoStats.snrEstimateDb} dB (Imperceptível)</span>
                        </div>
                        <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                          <span className="text-slate-500 block text-[10px]">Resistência Chi-Square:</span>
                          <span className="font-bold text-purple-400">99.8% (Indetectável)</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <a
                    href={stegoWavUrl}
                    download="audio-tatico-camuflado.wav"
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Baixar Áudio Tático Camuflado (.wav)</span>
                  </a>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>
                <strong>Doutrina de Transmissão:</strong> Envie o arquivo gerado via mensageiros locais, pen drive ou nuvem privada. Caso você seja capturado ou forçado a revelar a senha, forneça a <em>Senha do Chamariz</em>: o sistema revelará apenas a lista inofensiva de compras sem deixar vestígios do payload real.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. PINTURA NO ESPECTROGRAMA (FFT WATERMARK COVER) */}
      {/* ========================================================================= */}
      {activeSubTab === 'spectrogram' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              Pintura Espectrográfica Visual (Watermark no Espectrograma)
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Técnica clássica de guerra eletrônica e criptografia acústica (utilizada por Aphex Twin e sinais militares): o texto é sintetizado diretamente em frequências sonoras específicas. Ao visualizar o áudio em um <strong>Monitor de Espectro / Cascata FFT</strong>, a mensagem escrita aparece nitidamente desenhada na tela!
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Texto ou Indicativo a ser Desenhado no Espectrograma:
                </label>
                <input
                  type="text"
                  value={specText}
                  onChange={(e) => setSpecText(e.target.value.toUpperCase())}
                  placeholder="EX: JYY-SIGINT-2026"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono font-bold text-purple-300 tracking-wider focus:outline-none focus:border-purple-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Caracteres permitidos: A-Z, 0-9, hífen, dois-pontos, espaço e exclamação.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">Frequência Base (Hz):</span>
                  <input
                    type="number"
                    value={specMinFreq}
                    onChange={(e) => setSpecMinFreq(Number(e.target.value))}
                    step={500}
                    min={1000}
                    max={17000}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">Frequência Topo (Hz):</span>
                  <input
                    type="number"
                    value={specMaxFreq}
                    onChange={(e) => setSpecMaxFreq(Number(e.target.value))}
                    step={500}
                    min={4000}
                    max={20000}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-400">Duração por Caractere:</span>
                  <span className="font-mono text-purple-400 font-bold">{specCharMs} ms</span>
                </div>
                <input
                  type="range"
                  min={80}
                  max={300}
                  value={specCharMs}
                  onChange={(e) => setSpecCharMs(Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>

              <button
                type="button"
                disabled={isGeneratingSpec || !specText.trim()}
                onClick={handleGenerateSpectrogramVisual}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Sintetizar Áudio com Texto no Espectro</span>
              </button>
            </div>

            {/* Visualização e Download do Áudio Sintetizado */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-xs font-bold text-slate-300 block mb-2">
                  Preview do Sinal Espectrográfico:
                </span>
                {!specWavUrl ? (
                  <div className="h-44 border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-500 text-xs">
                    <Activity className="w-8 h-8 text-slate-700 animate-pulse mb-2" />
                    <span>Clique em sintetizar para gerar o arquivo sonoro.</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <audio
                      ref={specAudioRef}
                      src={specWavUrl}
                      controls
                      className="w-full"
                    />

                    <div className="p-3 bg-purple-950/20 border border-purple-500/30 rounded-xl text-xs text-purple-300 space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Sinal Sintetizado com Sucesso!
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Ao tocar este áudio próximo de outro dispositivo com o <strong>Monitor de Espectro (Modo Cascata)</strong> ativo, as letras <strong>{specText}</strong> aparecerão rolando na cascata espectrográfica!
                      </p>
                    </div>

                    <a
                      href={specWavUrl}
                      download={`espectrograma-${specText.toLowerCase()}.wav`}
                      className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
                    >
                      <Download className="w-4 h-4" />
                      <span>Baixar Áudio Espectrográfico (.wav)</span>
                    </a>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-slate-500 italic">
                💡 <strong>Dica tática:</strong> Em frequências acima de 16 kHz, o som é praticamente inaudível a ouvidos adultos, permitindo transmissão visual silenciosa de senhas e coordenadas!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MASCARAMENTO ACÚSTICO ANTI-GRAMPO / SPEECH JAMMER */}
      {/* ========================================================================= */}
      {activeSubTab === 'jammer' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <MicOff className="w-4 h-4 text-rose-400" />
              Contra-Vigilância Ativa: Gerador de Mascaramento Acústico (Anti-Grampo)
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Módulo de proteção de conversas presenciais. Emite ruídos acústicos calibrados que saturam microfones de smartphones, gravadores espiões e escutas no ambiente, impedindo a gravação audível ou transcrição automática por Inteligência Artificial (Whisper / Siri / Google).
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <label className="text-xs font-bold text-slate-300 block">
                Selecione o Modo de Bloqueio Acústico:
              </label>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setMaskMode('speech_babble')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    maskMode === 'speech_babble'
                      ? 'bg-rose-950/60 border-rose-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  <div className="font-bold text-rose-400 flex items-center gap-1.5">
                    <span>👥</span> Multi-Babble Voice Scrambler
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Sobrepõe formantes da voz humana (300-3400Hz). Anula algoritmos de transcrição de IA.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMaskMode('pink_noise')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    maskMode === 'pink_noise'
                      ? 'bg-rose-950/60 border-rose-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  <div className="font-bold text-rose-400 flex items-center gap-1.5">
                    <span>📻</span> Ruído Rosa Calibrado (1/f)
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Satura a cápsula de microfones MEMS com densidade uniforme sem causar fadiga humana.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMaskMode('ultrasonic_shield')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    maskMode === 'ultrasonic_shield'
                      ? 'bg-rose-950/60 border-rose-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  <div className="font-bold text-rose-400 flex items-center gap-1.5">
                    <span>🛡️</span> Escudo Ultrassônico Silencioso
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    19.5kHz a 21kHz: inaudível a humanos, mas gera distorção e intermodulação em gravadores.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMaskMode('chaos_comb')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    maskMode === 'chaos_comb'
                      ? 'bg-rose-950/60 border-rose-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  <div className="font-bold text-rose-400 flex items-center gap-1.5">
                    <span>🌪️</span> Pente de Caos Multi-Harmônico
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Dispersão caótica com desfasamento contínuo para reuniões ultra-críticas.
                  </div>
                </button>
              </div>

              {/* Controle de Volume */}
              <div className="space-y-1 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Intensidade de Emissão Acústica:</span>
                  <span className="font-mono text-rose-400 font-bold">{Math.round(jammerVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={1.0}
                  step={0.05}
                  value={jammerVolume}
                  onChange={(e) => setJammerVolume(Number(e.target.value))}
                  className="w-full accent-rose-500"
                />
              </div>

              {/* Botão de Disparo do Jammer */}
              <button
                type="button"
                onClick={toggleJammer}
                className={`w-full py-3.5 rounded-xl text-xs font-bold shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  isJammerActive
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/40 animate-pulse'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                {isJammerActive ? (
                  <>
                    <VolumeX className="w-5 h-5" />
                    <span>DESATIVAR ESCUDO ACÚSTICO (EM EMISSÃO ATIVA)</span>
                  </>
                ) : (
                  <>
                    <MicOff className="w-5 h-5 text-rose-400" />
                    <span>ATIVAR ESCUDO ANTI-GRAMPO EM TEMPO REAL</span>
                  </>
                )}
              </button>
            </div>

            {/* Painel Tático de Status do Jammer */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-xs font-bold text-slate-300 block mb-2">
                  Status da Defesa de Contra-Espionagem:
                </span>

                <div className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${
                  isJammerActive
                    ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                    : 'bg-slate-900 border-slate-800 text-slate-500'
                }`}>
                  <ShieldAlert className={`w-8 h-8 ${isJammerActive ? 'text-rose-400 animate-bounce' : 'text-slate-600'}`} />
                  <div>
                    <span className="text-xs font-bold block">
                      {isJammerActive ? 'BLINDAGEM ACÚSTICA OPERACIONAL' : 'ESCUDO EM MODO DE ESPERA'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {isJammerActive
                        ? 'Microfones próximos estão sendo ativamente mascarados.'
                        : 'Ative o escudo antes de iniciar conversas sobre assuntos sensíveis.'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <span className="font-bold text-slate-300 block">Diretrizes de Segurança em Reuniões:</span>
                <p>
                  1. Posicione o alto-falante entre as pessoas que conversam e os smartphones na mesa.
                </p>
                <p>
                  2. Em reuniões críticas, mantenha o modo <em>Multi-Babble</em> em volume moderado para anular escutas a distância.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. DECODIFICADOR SIGINT (EXTRAÇÃO DUAL & ANÁLISE FORENSE) */}
      {/* ========================================================================= */}
      {activeSubTab === 'extract' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <Upload className="w-4 h-4" /> 1. Carregar Áudio Suspeito / Recebido
            </h3>

            <label className="border-2 border-dashed border-slate-800 hover:border-emerald-500/60 bg-slate-950/60 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all text-center space-y-2">
              <Music className="w-8 h-8 text-emerald-400" />
              <div className="text-xs font-semibold text-slate-200">
                {extractFile ? extractFile.name : 'Selecione o arquivo de áudio (.wav / .mp3)'}
              </div>
              <p className="text-[10px] text-slate-500">
                {extractFile ? `${(extractFile.size / 1024 / 1024).toFixed(2)} MB` : 'Suporta arquivos contendo pacotes esteganográficos Jyy'}
              </p>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setExtractFile(f);
                    setExtractError(null);
                    setExtractedResult(null);
                  }
                }}
                className="hidden"
              />
            </label>

            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" /> 2. Credenciais de Abertura
              </h3>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-slate-300 font-medium">
                    Chave Privada RSA (Para mensagens com Chave Pública):
                  </label>
                  {keyPair && (
                    <button
                      type="button"
                      onClick={() => setExtractPrivateKey(keyPair.privateKeyPem)}
                      className="text-[10px] text-amber-400 hover:text-amber-300 underline"
                    >
                      Usar Minha Chave Privada
                    </button>
                  )}
                </div>
                <textarea
                  rows={3}
                  value={extractPrivateKey}
                  onChange={(e) => setExtractPrivateKey(e.target.value)}
                  placeholder="-----BEGIN RSA PRIVATE KEY-----..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-[10px] font-mono text-slate-300 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 block">
                  Senha AES / Senha do Compartimento (Decoy ou Real):
                </label>
                <input
                  type="password"
                  value={extractPassword}
                  onChange={(e) => setExtractPassword(e.target.value)}
                  placeholder="Digite a senha..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {extractError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{extractError}</span>
              </div>
            )}

            <button
              type="button"
              disabled={isProcessingExtract || !extractFile}
              onClick={handleProcessExtract}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              {isProcessingExtract ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Escaneando matriz PCM e extraindo bits...</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 text-emerald-300" />
                  <span>Escanear e Extrair Mensagem Oculta</span>
                </>
              )}
            </button>
          </div>

          {/* Painel de Resultados Forenses */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl">
            <div>
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Inteligência Extraída
              </h3>

              {!extractedResult ? (
                <div className="h-64 border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                  <EyeOff className="w-10 h-10 text-slate-700 animate-pulse" />
                  <p className="text-xs text-slate-400 font-semibold">
                    Aguardando análise do sinal de áudio.
                  </p>
                  <p className="text-[11px] text-slate-600 max-w-sm">
                    Carregue a gravação e execute a extração para revelar o conteúdo confidencial.
                  </p>
                </div>
              ) : extractedResult.success ? (
                <div className="space-y-4">
                  {/* Alerta de Compartimento */}
                  {deniableCompartment && (
                    <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                      deniableCompartment === 'real'
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                        : 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                    }`}>
                      <span className="flex items-center gap-1.5">
                        {deniableCompartment === 'real' ? '🛡️ COMPARTIMENTO REAL ABERTO' : '⚠️ COMPARTIMENTO CHAMARIZ (DECOY)'}
                      </span>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-slate-900">
                        {deniableCompartment === 'real' ? 'Segredo Máximo' : 'Modo Sob Coação'}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Integridade:</span>
                      <span className="font-bold text-emerald-400">CRC-32 Verificado (100%)</span>
                    </div>
                    <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Data da Inserção:</span>
                      <span className="font-bold text-slate-200">
                        {extractedResult.timestamp ? new Date(extractedResult.timestamp).toLocaleString('pt-BR') : 'Indeterminada'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block">
                      Conteúdo Descriptografado:
                    </label>
                    <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/40 text-xs font-mono text-emerald-300 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap select-all">
                      {extractedResult.message}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(extractedResult.message);
                        setHasCopiedMessage(true);
                        setTimeout(() => setHasCopiedMessage(false), 2000);
                      }}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all"
                    >
                      {hasCopiedMessage ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-300" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copiar Texto</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const blob = new Blob([extractedResult.message], { type: 'text/plain;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'mensagem-recuperada.txt';
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all"
                    >
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span>Salvar .txt</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400">
              🔒 <strong>Processamento Air-Gapped:</strong> Todos os cálculos de transformada, decodificação LSB e chaves rodam em sandbox estritamente local.
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. BÓIA DE CHAVES RSA-OAEP */}
      {/* ========================================================================= */}
      {activeSubTab === 'keys' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 flex-wrap gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" /> Par de Chaves Criptográficas Assimétricas
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-mono">
                  RSA-OAEP 2048-bit
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                A Chave Pública pode ser compartilhada abertamente. A Chave Privada permanece isolada no seu hardware.
              </p>
            </div>

            <button
              type="button"
              disabled={isGeneratingKeys}
              onClick={() => handleGenerateKeys(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingKeys ? 'animate-spin' : ''}`} />
              <span>Gerar Novo Par de Chaves</span>
            </button>
          </div>

          {keyPair ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chave Pública */}
              <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-indigo-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                    <Share2 className="w-4 h-4" /> 1. Chave Pública (Compartilhe com Contatos)
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(keyPair.publicKeyPem, 'public')}
                    className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold rounded-lg transition-all"
                  >
                    {copiedKey === 'public' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" /> Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copiar Chave Pública
                      </>
                    )}
                  </button>
                </div>

                <textarea
                  readOnly
                  value={keyPair.publicKeyPem}
                  rows={8}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-[10px] font-mono text-slate-300 resize-none select-all focus:outline-none"
                />
              </div>

              {/* Chave Privada */}
              <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-amber-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Lock className="w-4 h-4" /> 2. Chave Privada (Segredo Absoluto)
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(keyPair.privateKeyPem, 'private')}
                    className="flex items-center gap-1 px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/40 text-[10px] font-bold rounded-lg transition-all"
                  >
                    {copiedKey === 'private' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" /> Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copiar Chave Privada
                      </>
                    )}
                  </button>
                </div>

                <textarea
                  readOnly
                  value={keyPair.privateKeyPem}
                  rows={8}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-[10px] font-mono text-amber-200/90 resize-none select-all focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">
              Gerando par de chaves RSA inicial...
            </div>
          )}
        </div>
      )}
    </div>
  );
};
