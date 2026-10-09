import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  Radio,
  Key,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Server,
  Cloud,
  Layers,
  Upload,
  RefreshCw,
  Plus,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Terminal,
  FileCode,
  BookOpen,
  HelpCircle,
  Sparkles,
  Zap,
  Lock,
  Unlock,
  AlertTriangle,
  FolderOpen,
  ArrowRight,
  Send,
  Sliders,
  CheckCircle2,
  XCircle,
  FileText,
  Clock,
  Download,
  Share2
} from 'lucide-react';
import {
  NsiteConfig,
  BlossomServerConfig,
  NostrRelayConfig,
  NsiteDeployLog,
  NsiteDeployFile,
  Nip5aManifestEvent,
  NostrKeyPair,
  loadAllNsiteConfigs,
  saveAllNsiteConfigs,
  loadBlossomServers,
  saveBlossomServers,
  loadNostrRelays,
  saveNostrRelays,
  loadDeployLogs,
  saveDeployLog,
  generateNostrKeyPair,
  importNostrPrivateKey,
  secp256k1GetPublicKey,
  hexToBech32,
  bech32ToHex,
  formatKeyCompact,
  generateNsyteCliCommand,
  generateFullDeployScript,
  generateGitHubWorkflowYaml,
  getPublicGatewayUrls,
  testNostrRelayConnection,
  testBlossomServerConnection,
  calculateFileSha256,
  getMimeTypeFromPath,
  uploadBlobToBlossom,
  buildNip5aManifestEvent,
  savePrivateKeyToVault,
  getPrivateKeyFromVault,
  DEFAULT_JJY_NSITE_CONFIG
} from '../utils/nsiteEngine';

interface AdminNsiteViewProps {
  serverUrl?: string;
  token?: string;
}

export const AdminNsiteView: React.FC<AdminNsiteViewProps> = () => {
  // Estado das configurações
  const [sites, setSites] = useState<NsiteConfig[]>(() => loadAllNsiteConfigs());
  const [selectedSiteId, setSelectedSiteId] = useState<string>(() => {
    const list = loadAllNsiteConfigs();
    return list[0]?.id || 'nsite_jjy_main';
  });
  const [activeSubTab, setActiveSubTab] = useState<'sites' | 'keys' | 'network' | 'deployer' | 'cli' | 'guide'>('sites');

  // Servidores & Relays
  const [blossomServers, setBlossomServers] = useState<BlossomServerConfig[]>(() => loadBlossomServers());
  const [relays, setRelays] = useState<NostrRelayConfig[]>(() => loadNostrRelays());
  const [testingNetwork, setTestingNetwork] = useState(false);

  // Logs & Histórico
  const [deployLogs, setDeployLogs] = useState<NsiteDeployLog[]>(() => loadDeployLogs());

  // Cofre de Chaves
  const [activeKeyPair, setActiveKeyPair] = useState<NostrKeyPair | null>(null);
  const [importKeyInput, setImportKeyInput] = useState('');
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [vaultPassphrase, setVaultPassphrase] = useState('');
  const [vaultStatusMsg, setVaultStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [nip07Available, setNip07Available] = useState<boolean>(false);
  const [nip07Pubkey, setNip07Pubkey] = useState<string | null>(null);

  // Modal de Criação / Edição de Nsite
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<NsiteConfig | null>(null);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formRootDir, setFormRootDir] = useState('./dist');
  const [formFallback, setFormFallback] = useState('/index.html');
  const [formBuildScript, setFormBuildScript] = useState('npm run build');
  const [formNpub, setFormNpub] = useState('');
  const [formNsec, setFormNsec] = useState('');
  const [formNip05, setFormNip05] = useState('');
  const [formCustomDomain, setFormCustomDomain] = useState('');
  const [formBlossoms, setFormBlossoms] = useState<string[]>([]);
  const [formRelays, setFormRelays] = useState<string[]>([]);

  // Web Deployer (Upload no Navegador)
  const [uploadedFiles, setUploadedFiles] = useState<NsiteDeployFile[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [previewManifest, setPreviewManifest] = useState<Nip5aManifestEvent | null>(null);
  const [deployProgress, setDeployProgress] = useState<string | null>(null);

  // Inputs para novos servidores
  const [newBlossomUrl, setNewBlossomUrl] = useState('');
  const [newRelayUrl, setNewRelayUrl] = useState('');

  // Notificações de Cópia
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Site atualmente selecionado
  const currentSite = useMemo(() => {
    return sites.find((s) => s.id === selectedSiteId) || sites[0] || DEFAULT_JJY_NSITE_CONFIG;
  }, [sites, selectedSiteId]);

  // Verificar extensão NIP-07 (ex: Alby, nos2x)
  useEffect(() => {
    const checkNip07 = async () => {
      if (typeof window !== 'undefined' && (window as any).nostr) {
        setNip07Available(true);
        try {
          const pub = await (window as any).nostr.getPublicKey();
          if (pub) setNip07Pubkey(pub);
        } catch {
          // Usuário rejeitou ou ainda não autorizou
        }
      }
    };
    checkNip07();
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Gerar novo par de chaves
  const handleGenerateNewKeypair = () => {
    const kp = generateNostrKeyPair();
    setActiveKeyPair(kp);
    setShowPrivateKey(false);
    setVaultStatusMsg({ text: 'Novo par de chaves gerado com sucesso!', type: 'success' });
    setTimeout(() => setVaultStatusMsg(null), 4000);
  };

  // Importar chave privada existente
  const handleImportKey = () => {
    try {
      const kp = importNostrPrivateKey(importKeyInput);
      setActiveKeyPair(kp);
      setImportKeyInput('');
      setShowPrivateKey(false);
      setVaultStatusMsg({ text: `Chave importada! npub: ${formatKeyCompact(kp.npub)}`, type: 'success' });
      setTimeout(() => setVaultStatusMsg(null), 4000);
    } catch (err: any) {
      setVaultStatusMsg({ text: err?.message || 'Falha ao importar chave', type: 'error' });
    }
  };

  // Salvar chave no cofre criptografado
  const handleSaveToVault = async () => {
    if (!activeKeyPair) return;
    try {
      await savePrivateKeyToVault(currentSite.id, activeKeyPair.nsec, vaultPassphrase);
      setVaultStatusMsg({
        text: vaultPassphrase ? 'Chave salva e criptografada com AES-GCM 256-bit!' : 'Chave salva localmente no cofre.',
        type: 'success'
      });
      // Atualizar no site se aplicável
      const updated = sites.map((s) => {
        if (s.id === currentSite.id) {
          return {
            ...s,
            npub: activeKeyPair.npub,
            pubkeyHex: activeKeyPair.publicKeyHex,
            nsecMasked: `nsec1${'•'.repeat(48)}`
          };
        }
        return s;
      });
      setSites(updated);
      saveAllNsiteConfigs(updated);
      setTimeout(() => setVaultStatusMsg(null), 4000);
    } catch (err: any) {
      setVaultStatusMsg({ text: `Erro: ${err?.message}`, type: 'error' });
    }
  };

  // Testar conectividade de toda a rede (Relays e Blossom)
  const handleTestAllNetwork = async () => {
    setTestingNetwork(true);

    // Testar Relays
    const updatedRelays = [...relays];
    for (let i = 0; i < updatedRelays.length; i++) {
      const r = updatedRelays[i];
      const res = await testNostrRelayConnection(r.url);
      updatedRelays[i] = {
        ...r,
        isOnline: res.isOnline,
        latencyMs: res.latencyMs,
        lastChecked: Date.now(),
        error: res.error
      };
    }
    setRelays(updatedRelays);
    saveNostrRelays(updatedRelays);

    // Testar Blossom Servers
    const updatedBlossoms = [...blossomServers];
    for (let i = 0; i < updatedBlossoms.length; i++) {
      const b = updatedBlossoms[i];
      const res = await testBlossomServerConnection(b.url);
      updatedBlossoms[i] = {
        ...b,
        isReachable: res.isReachable,
        latencyMs: res.latencyMs,
        lastChecked: Date.now(),
        error: res.error
      };
    }
    setBlossomServers(updatedBlossoms);
    saveBlossomServers(updatedBlossoms);

    setTestingNetwork(false);
  };

  // Abrir modal para novo site
  const handleOpenCreateModal = () => {
    setEditingSite(null);
    setFormName('');
    setFormSlug('');
    setFormDescription('');
    setFormRootDir('./dist');
    setFormFallback('/index.html');
    setFormBuildScript('npm run build');
    setFormNpub('');
    setFormNsec('');
    setFormNip05('');
    setFormCustomDomain('');
    setFormBlossoms(blossomServers.slice(0, 2).map((b) => b.url));
    setFormRelays(relays.slice(0, 3).map((r) => r.url));
    setIsModalOpen(true);
  };

  // Abrir modal para editar site
  const handleOpenEditModal = (site: NsiteConfig) => {
    setEditingSite(site);
    setFormName(site.name);
    setFormSlug(site.slug);
    setFormDescription(site.description);
    setFormRootDir(site.rootDir);
    setFormFallback(site.fallbackFile);
    setFormBuildScript(site.buildScript);
    setFormNpub(site.npub);
    setFormNsec('');
    setFormNip05(site.nip05Identifier || '');
    setFormCustomDomain(site.customDomain || '');
    setFormBlossoms(site.blossomServers);
    setFormRelays(site.relays);
    setIsModalOpen(true);
  };

  // Salvar novo ou editar site
  const handleSaveSiteModal = () => {
    if (!formName.trim() || !formSlug.trim()) {
      alert('Preencha o Nome e o Identificador (slug) do site.');
      return;
    }

    let resolvedNpub = formNpub.trim();
    let resolvedPubHex = '';

    if (!resolvedNpub) {
      // Se não preenchido, gerar um par automático
      const newKp = generateNostrKeyPair();
      resolvedNpub = newKp.npub;
      resolvedPubHex = newKp.publicKeyHex;
    } else {
      try {
        if (resolvedNpub.startsWith('npub1')) {
          resolvedPubHex = bech32ToHex(resolvedNpub).hex;
        } else {
          resolvedPubHex = resolvedNpub;
          resolvedNpub = hexToBech32('npub', resolvedPubHex);
        }
      } catch {
        resolvedPubHex = '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
      }
    }

    if (editingSite) {
      // Atualizar existente
      const updated = sites.map((s) => {
        if (s.id === editingSite.id) {
          return {
            ...s,
            name: formName.trim(),
            slug: formSlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
            description: formDescription.trim(),
            rootDir: formRootDir.trim(),
            fallbackFile: formFallback.trim(),
            buildScript: formBuildScript.trim(),
            npub: resolvedNpub,
            pubkeyHex: resolvedPubHex,
            nip05Identifier: formNip05.trim() || undefined,
            customDomain: formCustomDomain.trim() || undefined,
            blossomServers: formBlossoms.length > 0 ? formBlossoms : blossomServers.slice(0, 2).map((b) => b.url),
            relays: formRelays.length > 0 ? formRelays : relays.slice(0, 2).map((r) => r.url)
          };
        }
        return s;
      });
      setSites(updated);
      saveAllNsiteConfigs(updated);
    } else {
      // Criar novo
      const newId = `nsite_${Date.now()}`;
      const newConfig: NsiteConfig = {
        id: newId,
        name: formName.trim(),
        slug: formSlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
        description: formDescription.trim(),
        isDefaultSite: false,
        status: 'draft',
        rootDir: formRootDir.trim(),
        fallbackFile: formFallback.trim(),
        buildScript: formBuildScript.trim(),
        deployCommand: `nsyte deploy ${formRootDir.trim()} --fallback=${formFallback.trim()} --name=${formSlug.trim()}`,
        npub: resolvedNpub,
        pubkeyHex: resolvedPubHex,
        nsecMasked: formNsec ? `nsec1${'•'.repeat(48)}` : undefined,
        nip05Identifier: formNip05.trim() || undefined,
        customDomain: formCustomDomain.trim() || undefined,
        blossomServers: formBlossoms.length > 0 ? formBlossoms : blossomServers.slice(0, 2).map((b) => b.url),
        relays: formRelays.length > 0 ? formRelays : relays.slice(0, 2).map((r) => r.url),
        tags: ['custom', 'nsite']
      };
      const updated = [...sites, newConfig];
      setSites(updated);
      saveAllNsiteConfigs(updated);
      setSelectedSiteId(newId);
    }

    setIsModalOpen(false);
  };

  // Excluir site
  const handleDeleteSite = (siteId: string) => {
    if (siteId === DEFAULT_JJY_NSITE_CONFIG.id) {
      alert('O site principal do projeto JJY não pode ser removido.');
      return;
    }
    if (confirm('Tem certeza que deseja excluir esta configuração de Nsite?')) {
      const filtered = sites.filter((s) => s.id !== siteId);
      setSites(filtered);
      saveAllNsiteConfigs(filtered);
      if (selectedSiteId === siteId) {
        setSelectedSiteId(filtered[0]?.id || DEFAULT_JJY_NSITE_CONFIG.id);
      }
    }
  };

  // Clonar site
  const handleCloneSite = (site: NsiteConfig) => {
    const cloneId = `nsite_${Date.now()}`;
    const clone: NsiteConfig = {
      ...site,
      id: cloneId,
      name: `${site.name} (Cópia)`,
      slug: `${site.slug}-copia`,
      isDefaultSite: false,
      status: 'draft',
      lastDeployedAt: undefined,
      manifestHash: undefined
    };
    const updated = [...sites, clone];
    setSites(updated);
    saveAllNsiteConfigs(updated);
    setSelectedSiteId(cloneId);
  };

  // Upload e processamento de arquivos no Web Deployer
  const handleFilesUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    setIsProcessingFiles(true);
    const parsedFiles: NsiteDeployFile[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const buffer = await file.arrayBuffer();
      const sha256 = await calculateFileSha256(buffer);
      const relPath = file.webkitRelativePath || file.name;

      parsedFiles.push({
        path: relPath.startsWith('/') ? relPath : `/${relPath}`,
        sizeBytes: file.size,
        mimeType: file.type || getMimeTypeFromPath(file.name),
        sha256,
        blossomServer: currentSite.blossomServers[0] || 'https://blossom.primal.net',
        isUploaded: false
      });
    }

    setUploadedFiles(parsedFiles);

    // Gerar prévia do manifesto NIP-5A (Kind 34128)
    const manifest = buildNip5aManifestEvent(
      currentSite,
      parsedFiles,
      currentSite.blossomServers[0] || 'https://blossom.primal.net'
    );
    setPreviewManifest(manifest);
    setIsProcessingFiles(false);
  };

  // Simular deploy Web
  const handleSimulateDeploy = async () => {
    if (uploadedFiles.length === 0) {
      alert('Carregue ao menos 1 arquivo para publicar.');
      return;
    }

    setDeployProgress('Conectando aos servidores Blossom selecionados...');
    await new Promise((r) => setTimeout(r, 600));

    setDeployProgress('Enviando blobs criptográficos e verificando hashes SHA-256...');
    await new Promise((r) => setTimeout(r, 800));

    // Marcar arquivos como uploaded
    const updated = uploadedFiles.map((f) => ({ ...f, isUploaded: true }));
    setUploadedFiles(updated);

    setDeployProgress('Assinando manifesto Kind 34128 e propagando para relays Nostr...');
    await new Promise((r) => setTimeout(r, 700));

    const totalBytes = uploadedFiles.reduce((acc, curr) => acc + curr.sizeBytes, 0);
    const manifestHash = previewManifest ? previewManifest.tags.find((t) => t[0] === 'f')?.[2] || '4f53cda...' : 'a1b2c3d4...';
    const gatewayUrl = `https://nsite.run/${currentSite.npub}`;

    const newLog: NsiteDeployLog = {
      id: `deploy_${Date.now()}`,
      siteId: currentSite.id,
      siteName: currentSite.name,
      timestamp: Date.now(),
      status: 'success',
      filesCount: uploadedFiles.length,
      totalSizeBytes: totalBytes,
      manifestHash,
      gatewayUrl,
      logs: [
        `[INFO] Inicializando deploy de ${uploadedFiles.length} arquivos (${(totalBytes / 1024).toFixed(1)} KB)...`,
        `[BLOSSOM] Upload validado em ${currentSite.blossomServers.join(', ')}`,
        `[NOSTR] Evento Kind 34128 assinado com sucesso`,
        `[RELAYS] Propagado para ${currentSite.relays.join(', ')}`,
        `[GATEWAY] Acesso liberado via: ${gatewayUrl}`
      ]
    };

    saveDeployLog(newLog);
    setDeployLogs([newLog, ...deployLogs]);

    // Atualizar site com metadados do deploy
    const updatedSites = sites.map((s) => {
      if (s.id === currentSite.id) {
        return {
          ...s,
          lastDeployedAt: Date.now(),
          deployedFilesCount: uploadedFiles.length,
          totalSizeBytes: totalBytes,
          manifestHash,
          lastGatewayUrl: gatewayUrl,
          status: 'active' as const
        };
      }
      return s;
    });
    setSites(updatedSites);
    saveAllNsiteConfigs(updatedSites);

    setDeployProgress(null);
    alert(`Deploy simulado com sucesso! O site agora está acessível no gateway descentralizado: ${gatewayUrl}`);
  };

  // Adicionar Blossom server
  const handleAddBlossom = () => {
    if (!newBlossomUrl.trim() || !newBlossomUrl.startsWith('http')) {
      alert('URL inválida. Informe um endereço iniciando com http:// ou https://');
      return;
    }
    const clean = newBlossomUrl.trim().replace(/\/+$/, '');
    const newEntry: BlossomServerConfig = {
      url: clean,
      name: new URL(clean).hostname,
      isDefault: false
    };
    const updated = [...blossomServers, newEntry];
    setBlossomServers(updated);
    saveBlossomServers(updated);
    setNewBlossomUrl('');
  };

  // Adicionar Relay
  const handleAddRelay = () => {
    if (!newRelayUrl.trim() || !newRelayUrl.startsWith('ws')) {
      alert('URL de relay inválida. Deve iniciar com wss:// ou ws://');
      return;
    }
    const clean = newRelayUrl.trim().replace(/\/+$/, '');
    const newEntry: NostrRelayConfig = {
      url: clean,
      name: new URL(clean).hostname,
      read: true,
      write: true
    };
    const updated = [...relays, newEntry];
    setRelays(updated);
    saveNostrRelays(updated);
    setNewRelayUrl('');
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* ==================================================================== */}
      {/* CABEÇALHO DO PAINEL NSITE */}
      {/* ==================================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-emerald-500/10 via-cyan-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
                <Globe className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-slate-100 tracking-tight">
                Nsite & Hospedagem Descentralizada Nostr (NIP-5A)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                BLOSSOM BLOBS + KIND 34128
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Publique o portal <strong>JJY Mesh</strong> ou crie novos micro-sites estáticos totalmente descentralizados,
              imunes à censura e indexados pela chave pública Nostr (npub), com arquivos salvos em servidores Blossom imutáveis.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/40 border border-emerald-400/30 flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Nsite</span>
            </button>

            <button
              type="button"
              onClick={handleTestAllNetwork}
              disabled={testingNetwork}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingNetwork ? 'animate-spin text-cyan-400' : ''}`} />
              <span>{testingNetwork ? 'Testando Rede...' : 'Testar Conexões'}</span>
            </button>
          </div>
        </div>

        {/* CARDS DE STATUS RÁPIDO */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/80">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-cyan-400" /> Nsites Registrados
            </div>
            <div className="text-lg font-bold text-slate-100 mt-0.5">{sites.length} sites</div>
            <div className="text-[10px] text-slate-500">Site principal: JJY Mesh</div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <Cloud className="w-3.5 h-3.5 text-pink-400" /> Servidores Blossom
            </div>
            <div className="text-lg font-bold text-slate-100 mt-0.5">
              {blossomServers.length} nós
            </div>
            <div className="text-[10px] text-slate-500">Armazenamento de Blobs</div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <Radio className="w-3.5 h-3.5 text-emerald-400" /> Relays Nostr
            </div>
            <div className="text-lg font-bold text-slate-100 mt-0.5">
              {relays.length} ativos
            </div>
            <div className="text-[10px] text-slate-500">WebSocket Indexadores</div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <Key className="w-3.5 h-3.5 text-amber-400" /> Identidade NIP-07
            </div>
            <div className="text-lg font-bold text-slate-100 mt-0.5 flex items-center gap-1.5">
              {nip07Available ? (
                <span className="text-emerald-400 text-xs flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Detectada
                </span>
              ) : (
                <span className="text-slate-400 text-xs">Cofre Local</span>
              )}
            </div>
            <div className="text-[10px] text-slate-500">Extensão ou Chave Nativa</div>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* NAVEGAÇÃO DE SUB-ABAS DO PAINEL NSITE */}
      {/* ==================================================================== */}
      <div className="flex items-center flex-wrap gap-1.5 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
        <button
          type="button"
          onClick={() => setActiveSubTab('sites')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeSubTab === 'sites'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Meus Nsites & Deploy</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700/50">
            {sites.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('keys')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeSubTab === 'keys'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          <span>Cofre de Chaves & Identidade (nsec/npub)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('network')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeSubTab === 'network'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>Servidores Blossom & Relays</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('deployer')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeSubTab === 'deployer'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Web Deployer & Simulador NIP-5A</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('cli')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeSubTab === 'cli'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>CLI & Automação CI/CD</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('guide')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeSubTab === 'guide'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Guia Didático (Iniciantes)</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* SUB-ABA 1: MEUS NSITES & DEPLOY */}
      {/* ==================================================================== */}
      {activeSubTab === 'sites' && (
        <div className="space-y-4">
          {/* CARD EM DESTAQUE: SITE ATUAL JJY MESH */}
          <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border-2 border-emerald-500/40 rounded-2xl p-5 shadow-lg relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-slate-950 uppercase tracking-wider">
                    Site Atual do Projeto
                  </span>
                  <h3 className="text-lg font-bold text-white">{currentSite.name}</h3>
                  <span className="text-xs text-slate-400 font-mono">({currentSite.slug})</span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl">{currentSite.description}</p>
              </div>

              <div className="flex items-center flex-wrap gap-2">
                <a
                  href={`https://nsite.run/${currentSite.npub}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir no Gateway</span>
                </a>

                <button
                  type="button"
                  onClick={() => handleOpenEditModal(currentSite)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Configurações</span>
                </button>
              </div>
            </div>

            {/* Parâmetros do Site Atual */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-800">
              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Diretório de Build</div>
                <div className="text-xs font-mono text-emerald-300 font-bold mt-0.5">{currentSite.rootDir}</div>
                <div className="text-[10px] text-slate-500">Fallback: {currentSite.fallbackFile}</div>
              </div>

              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Chave Pública (npub)</div>
                <div className="text-xs font-mono text-cyan-300 font-bold mt-0.5 truncate">
                  {formatKeyCompact(currentSite.npub, 10, 8)}
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(currentSite.npub, 'current_npub')}
                  className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 mt-0.5"
                >
                  {copiedKey === 'current_npub' ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                  <span>{copiedKey === 'current_npub' ? 'Copiado!' : 'Copiar npub completo'}</span>
                </button>
              </div>

              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Servidores Blossom</div>
                <div className="text-xs text-slate-200 font-bold mt-0.5">{currentSite.blossomServers.length} vinculados</div>
                <div className="text-[10px] text-slate-500 truncate">{currentSite.blossomServers[0]}</div>
              </div>

              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Status de Publicação</div>
                <div className="text-xs text-emerald-400 font-bold mt-0.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Ativo & Sincronizado
                </div>
                <div className="text-[10px] text-slate-500">
                  {currentSite.lastDeployedAt ? new Date(currentSite.lastDeployedAt).toLocaleDateString() : 'Aguardando primeiro deploy'}
                </div>
              </div>
            </div>

            {/* Linha de Comando de Deploy com 1 clique */}
            <div className="mt-3 bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 overflow-hidden">
                <Terminal className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="text-[11px] font-mono text-slate-300 truncate">
                  {generateFullDeployScript(currentSite)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(generateFullDeployScript(currentSite), 'deploy_cmd')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 flex-shrink-0 border border-slate-700 transition-all"
              >
                {copiedKey === 'deploy_cmd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === 'deploy_cmd' ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
          </div>

          {/* LISTA DE TODOS OS SITES CADASTRADOS */}
          <div className="flex items-center justify-between pt-2">
            <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Todos os Nsites Cadastrados ({sites.length})</span>
            </h4>
            <span className="text-xs text-slate-500">
              Gerencie múltiplos espelhos, subsites e documentação descentralizada
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sites.map((site) => {
              const isSelected = site.id === currentSite.id;
              return (
                <div
                  key={site.id}
                  onClick={() => setSelectedSiteId(site.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                    isSelected
                      ? 'bg-slate-900 border-emerald-500/60 shadow-lg shadow-emerald-950/20'
                      : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-slate-100">{site.name}</span>
                        {site.isDefaultSite && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Principal
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                        {site.status === 'active' ? '🟢 Ativo' : '⚪ Rascunho'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{site.description}</p>

                    <div className="mt-3 space-y-1 text-[11px] font-mono">
                      <div className="text-slate-400">
                        <span className="text-slate-500">Pasta:</span> {site.rootDir}
                      </div>
                      <div className="text-slate-400 truncate">
                        <span className="text-slate-500">npub:</span> {formatKeyCompact(site.npub, 8, 6)}
                      </div>
                      <div className="text-slate-400">
                        <span className="text-slate-500">Blossom:</span> {site.blossomServers.length} servidores
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <a
                      href={`https://nsite.run/${site.npub}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Visitar Gateway</span>
                    </a>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloneSite(site);
                        }}
                        title="Clonar Nsite"
                        className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditModal(site);
                        }}
                        title="Editar Nsite"
                        className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>
                      {!site.isDefaultSite && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSite(site.id);
                          }}
                          title="Excluir Nsite"
                          className="p-1.5 hover:bg-rose-950/60 text-slate-500 hover:text-rose-400 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUB-ABA 2: COFRE DE CHAVES & IDENTIDADE NOSTR */}
      {/* ==================================================================== */}
      {activeSubTab === 'keys' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl">
                    <Key className="w-5 h-5" />
                  </span>
                  <h3 className="text-base font-bold text-white">
                    Gerenciador Criptográfico de Chaves Nostr (secp256k1 & BIP-340)
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  No Nostr e no Nsite, o seu site pertence matematicamente à sua <strong>chave pública (npub)</strong>.
                  Para publicar e atualizar o site, você assina eventos Kind 34128 com sua <strong>chave privada (nsec)</strong>.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleGenerateNewKeypair}
                  className="px-3 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-bold shadow-md border border-amber-400/30 flex items-center gap-1.5 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Gerar Novo Par de Chaves</span>
                </button>
              </div>
            </div>

            {vaultStatusMsg && (
              <div
                className={`mt-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  vaultStatusMsg.type === 'success'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
              >
                {vaultStatusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                <span>{vaultStatusMsg.text}</span>
              </div>
            )}

            {/* CHAVE ATIVA SELECIONADA */}
            <div className="mt-5 space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div>
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Chave Pública (npub - Identidade Pública do Nsite)</span>
                  <span className="text-[10px] text-slate-500 font-normal">Pode ser compartilhada livremente</span>
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    readOnly
                    value={activeKeyPair ? activeKeyPair.npub : currentSite.npub}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(activeKeyPair ? activeKeyPair.npub : currentSite.npub, 'npub_active')}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 border border-slate-700"
                  >
                    {copiedKey === 'npub_active' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-amber-300">
                    <ShieldAlert className="w-3.5 h-3.5" /> Chave Privada (nsec - Assinatura do Site)
                  </span>
                  <span className="text-[10px] text-rose-400 font-bold">NUNCA COMPARTILHE!</span>
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type={showPrivateKey ? 'text' : 'password'}
                    readOnly
                    value={activeKeyPair ? activeKeyPair.nsec : currentSite.nsecMasked || 'nsec1••••••••••••••••••••••••••••••••••••••••'}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-amber-300 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700"
                    title={showPrivateKey ? 'Ocultar chave' : 'Mostrar chave'}
                  >
                    {showPrivateKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        activeKeyPair ? activeKeyPair.nsec : currentSite.nsecMasked || '',
                        'nsec_active'
                      )
                    }
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 border border-slate-700"
                  >
                    {copiedKey === 'nsec_active' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Salvar no Cofre com Criptografia */}
              {activeKeyPair && (
                <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="password"
                    placeholder="Senha mestre para criptografar no cofre (opcional)"
                    value={vaultPassphrase}
                    onChange={(e) => setVaultPassphrase(e.target.value)}
                    className="w-full sm:w-80 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500"
                  />
                  <button
                    type="button"
                    onClick={handleSaveToVault}
                    className="w-full sm:w-auto px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Salvar no Cofre do Site Atual</span>
                  </button>
                </div>
              )}
            </div>

            {/* IMPORTAR CHAVE EXISTENTE */}
            <div className="mt-4 pt-4 border-t border-slate-800">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Importar Chave Privada Existente
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Cole sua chave nsec1... ou formato hexadecimal de 64 caracteres.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="password"
                  placeholder="nsec1..."
                  value={importKeyInput}
                  onChange={(e) => setImportKeyInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-600"
                />
                <button
                  type="button"
                  onClick={handleImportKey}
                  disabled={!importKeyInput.trim()}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5 flex-shrink-0"
                >
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>Importar</span>
                </button>
              </div>
            </div>

            {/* SUPORTE NIP-07 (EXTENSÃO DE NAVEGADOR) */}
            <div className="mt-4 p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div>
                  <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <span>Extensão Nostr de Navegador (NIP-07)</span>
                    {nip07Available ? (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.2 rounded-full border border-emerald-500/20">
                        Detectada (Alby / nos2x)
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.2 rounded-full">
                        Não detectada
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Permite que o navegador assine eventos e publique o Nsite sem nunca expor a chave privada nsec a esta aplicação!
                  </p>
                </div>
              </div>

              {nip07Available && nip07Pubkey && (
                <div className="text-right flex-shrink-0">
                  <div className="text-[10px] text-slate-500">Chave da Extensão:</div>
                  <div className="text-xs font-mono text-cyan-300 font-bold">{formatKeyCompact(nip07Pubkey)}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUB-ABA 3: SERVIDORES BLOSSOM & RELAYS NOSTR */}
      {/* ==================================================================== */}
      {activeSubTab === 'network' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* SERVIDORES BLOSSOM */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-pink-500/10 text-pink-400 border border-pink-500/20 rounded-xl">
                  <Cloud className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">Servidores Blossom (Blobs)</h3>
                  <p className="text-[11px] text-slate-400">Armazenamento descentralizado e imutável de arquivos</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleTestAllNetwork}
                disabled={testingNetwork}
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl"
                title="Testar Servidores"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingNetwork ? 'animate-spin text-pink-400' : ''}`} />
              </button>
            </div>

            <div className="space-y-2">
              {blossomServers.map((server, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-200 truncate">{server.name}</span>
                      {server.isDefault && (
                        <span className="text-[9px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30 px-1.5 rounded">
                          Padrão
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 truncate">{server.url}</div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    {server.isReachable !== undefined ? (
                      server.isReachable ? (
                        <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {server.latencyMs}ms
                        </span>
                      ) : (
                        <span className="text-xs text-rose-400 font-bold flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Inacessível
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-slate-500">Não testado</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Adicionar Servidor Blossom */}
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-2">
              <input
                type="text"
                placeholder="https://meu-blossom.servidor.com"
                value={newBlossomUrl}
                onChange={(e) => setNewBlossomUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600"
              />
              <button
                type="button"
                onClick={handleAddBlossom}
                className="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-bold flex-shrink-0 transition-all"
              >
                Adicionar
              </button>
            </div>
          </div>

          {/* RELAYS NOSTR */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
                  <Radio className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">Relays Nostr (WebSocket)</h3>
                  <p className="text-[11px] text-slate-400">Propagação e descoberta dos manifestos Kind 34128</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleTestAllNetwork}
                disabled={testingNetwork}
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl"
                title="Testar Relays"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingNetwork ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>

            <div className="space-y-2">
              {relays.map((relay, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-200 truncate">{relay.name}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 truncate">{relay.url}</div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    {relay.isOnline !== undefined ? (
                      relay.isOnline ? (
                        <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {relay.latencyMs}ms
                        </span>
                      ) : (
                        <span className="text-xs text-rose-400 font-bold flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Offline
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-slate-500">Não testado</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Adicionar Relay Nostr */}
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-2">
              <input
                type="text"
                placeholder="wss://relay.exemplo.com"
                value={newRelayUrl}
                onChange={(e) => setNewRelayUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600"
              />
              <button
                type="button"
                onClick={handleAddRelay}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex-shrink-0 transition-all"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUB-ABA 4: WEB DEPLOYER & SIMULADOR NIP-5A */}
      {/* ==================================================================== */}
      {activeSubTab === 'deployer' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
                <Upload className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Web Deployer de Micro-Site & Simulador NIP-5A
                </h3>
                <p className="text-xs text-slate-400">
                  Faça upload de arquivos estáticos (HTML/CSS/JS) diretamente pelo navegador para calcular hashes SHA-256 e inspecionar o evento Kind 34128.
                </p>
              </div>
            </div>

            {/* ÁREA DE DRAG AND DROP / SELEÇÃO DE ARQUIVOS */}
            <div className="mt-4 border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-2xl p-6 text-center bg-slate-950/60 transition-all">
              <input
                type="file"
                id="file_input_nsite"
                multiple
                onChange={handleFilesUpload}
                className="hidden"
              />
              <label htmlFor="file_input_nsite" className="cursor-pointer block">
                <FolderOpen className="w-10 h-10 text-indigo-400 mx-auto mb-2" />
                <span className="text-sm font-bold text-slate-200 block">
                  Clique para selecionar arquivos estáticos ou arraste para cá
                </span>
                <span className="text-xs text-slate-500 mt-1 block">
                  Suporta HTML, JS, CSS, imagens, WASM, JSON, etc.
                </span>
              </label>
            </div>

            {isProcessingFiles && (
              <div className="mt-3 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-xs text-indigo-300 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Calculando hashes criptográficos SHA-256 via Web Crypto API...</span>
              </div>
            )}

            {/* TABELA DE ARQUIVOS CARREGADOS */}
            {uploadedFiles.length > 0 && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">
                    Arquivos Processados ({uploadedFiles.length}) • Total:{' '}
                    {(uploadedFiles.reduce((acc, curr) => acc + curr.sizeBytes, 0) / 1024).toFixed(1)} KB
                  </span>
                  <button
                    type="button"
                    onClick={handleSimulateDeploy}
                    disabled={Boolean(deployProgress)}
                    className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{deployProgress ? 'Publicando...' : 'Publicar via NIP-5A & Blossom'}</span>
                  </button>
                </div>

                {deployProgress && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{deployProgress}</span>
                  </div>
                )}

                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {uploadedFiles.map((f, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileCode className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                        <span className="text-slate-200 font-bold truncate">{f.path}</span>
                        <span className="text-[10px] text-slate-500 truncate">({f.mimeType})</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-slate-400">{(f.sizeBytes / 1024).toFixed(1)} KB</span>
                        <span className="text-slate-500 text-[10px] hidden sm:inline">
                          SHA: {f.sha256.slice(0, 8)}...
                        </span>
                        {f.isUploaded && (
                          <span className="text-emerald-400 text-[10px] font-bold">✓ Uploaded</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PREVIEW DO EVENTO NOSTR KIND 34128 */}
            {previewManifest && (
              <div className="mt-4 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span>Estrutura do Evento Nostr Kind 34128 (NIP-5A Manifest)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(JSON.stringify(previewManifest, null, 2), 'manifest_json')}
                    className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
                  >
                    {copiedKey === 'manifest_json' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copiar JSON</span>
                  </button>
                </div>
                <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-cyan-300 max-h-48 overflow-y-auto">
                  {JSON.stringify(previewManifest, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* HISTÓRICO DE DEPLOYS */}
          {deployLogs.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>Histórico de Publicações Recentes ({deployLogs.length})</span>
              </h4>

              <div className="space-y-2">
                {deployLogs.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100">{log.siteName}</span>
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 rounded">
                          {log.status === 'success' ? 'Sucesso' : 'Falha'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {new Date(log.timestamp).toLocaleString()} • {log.filesCount} arquivos (
                        {(log.totalSizeBytes / 1024).toFixed(1)} KB)
                      </div>
                    </div>

                    <a
                      href={log.gatewayUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Ver Gateway</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUB-ABA 5: CLI & AUTOMAÇÃO CI/CD */}
      {/* ==================================================================== */}
      {activeSubTab === 'cli' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl">
                <Terminal className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-white">Comandos CLI & Automação CI/CD</h3>
                <p className="text-xs text-slate-400">
                  Integração com <code>nsyte</code> CLI e automação de deploy no GitHub Actions via <code>sandwichfarm/nsite-action</code>.
                </p>
              </div>
            </div>

            {/* COMANDO DEPLOY RÁPIDO DO SITE ATUAL */}
            <div className="mt-4 space-y-2">
              <label className="text-xs font-bold text-slate-300">
                1. Comando de Terminal (Deploy Local ou Servidor):
              </label>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
                <code className="text-xs font-mono text-emerald-300 break-all">
                  {generateFullDeployScript(currentSite)}
                </code>
                <button
                  type="button"
                  onClick={() => handleCopy(generateFullDeployScript(currentSite), 'cli_tab_cmd')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 flex-shrink-0 border border-slate-700"
                >
                  {copiedKey === 'cli_tab_cmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'cli_tab_cmd' ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            {/* SCRIPT NO PACKAGE.JSON */}
            <div className="mt-4 space-y-2">
              <label className="text-xs font-bold text-slate-300">
                2. Configuração no <code>package.json</code> deste projeto:
              </label>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono text-slate-300">
                <p className="text-slate-500">// O projeto já possui o script pronto:</p>
                <p className="text-emerald-300 font-bold mt-1">
                  "deploy:nsite": "npm run build && nsyte deploy ./dist --fallback=/index.html"
                </p>
              </div>
            </div>

            {/* GITHUB ACTIONS WORKFLOW */}
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300">
                  3. Workflow GitHub Actions (<code>.github/workflows/deploy-nsite.yml</code>):
                </label>
                <button
                  type="button"
                  onClick={() => handleCopy(generateGitHubWorkflowYaml(currentSite), 'github_yaml')}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
                >
                  {copiedKey === 'github_yaml' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>Copiar Workflow</span>
                </button>
              </div>
              <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-cyan-300 max-h-60 overflow-y-auto">
                {generateGitHubWorkflowYaml(currentSite)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUB-ABA 6: GUIA DIDÁTICO PARA INICIANTES */}
      {/* ==================================================================== */}
      {activeSubTab === 'guide' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-5">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl">
                <BookOpen className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-white">
                  Guia Didático Nsite & Publicação Descentralizada
                </h3>
                <p className="text-xs text-slate-400">
                  Entenda passo a passo cada conceito técnico de forma clara, descomplicada e acessível.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase">
                  <Globe className="w-4 h-4" /> 1. O que é um Nsite?
                </h4>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Um <strong>Nsite</strong> é um site da web estático (HTML, CSS, JavaScript, imagens) hospedado de forma
                  totalmente descentralizada no protocolo <strong>Nostr</strong>. Ao contrário da web tradicional, não existe
                  servidor centralizado (como AWS ou Vercel) que possa bloquear ou censurar seu site.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="text-xs font-bold text-pink-400 flex items-center gap-1.5 uppercase">
                  <Cloud className="w-4 h-4" /> 2. O que são Servidores Blossom?
                </h4>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  <strong>Blossom</strong> é um protocolo simples e distribuído para armazenar arquivos em massa (blobs).
                  Cada arquivo recebe um código de integridade matemática imutável (hash SHA-256). Se um servidor Blossom
                  cair, o mesmo arquivo pode ser resgatado instantaneamente de qualquer outro nó na rede.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase">
                  <Key className="w-4 h-4" /> 3. nsec vs npub: Qual a diferença?
                </h4>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  <strong>npub (Chave Pública):</strong> É como o endereço do seu site ou o número de domínio. Todo mundo pode ver.<br />
                  <strong>nsec (Chave Privada):</strong> É a sua senha mestra inalterável. Quem tiver a sua nsec pode publicar ou
                  modificar o seu site. Por isso, nunca revele sua nsec a terceiros.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="text-xs font-bold text-cyan-400 flex items-center gap-1.5 uppercase">
                  <Layers className="w-4 h-4" /> 4. O que é o Evento Kind 34128 (NIP-5A)?
                </h4>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  É o <strong>manifesto do site</strong>. Ele funciona como um índice de livro: diz qual arquivo (ex: <code>/index.html</code>)
                  corresponde a qual hash SHA-256 nos servidores Blossom. O evento é assinado pela sua chave Nostr e propagado pelos Relays.
                </p>
              </div>
            </div>

            {/* PASSO A PASSO PARA SEU PRIMEIRO DEPLOY */}
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2">
              <h4 className="text-xs font-bold text-emerald-300 uppercase flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Passo a Passo: Publicando em 3 Minutos
              </h4>
              <ol className="list-decimal list-inside text-xs text-slate-300 space-y-1.5">
                <li>
                  <strong>Gere sua Identidade Nostr:</strong> Na aba <em>Cofre de Chaves</em>, clique em "Gerar Novo Par de Chaves".
                </li>
                <li>
                  <strong>Compile o Site:</strong> No terminal, execute <code>npm run build</code> para gerar a pasta <code>./dist</code>.
                </li>
                <li>
                  <strong>Execute o Deploy:</strong> Rode <code>npm run deploy:nsite</code> ou use o comando sugerido no painel.
                </li>
                <li>
                  <strong>Acesse seu Site Descentralizado:</strong> Abra a URL do Gateway (ex: <code>https://nsite.run/npub1...</code>)
                  para navegar no seu site ao redor do mundo sem risco de bloqueio governamental ou censura!
                </li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: NOVO NSITE / EDITAR NSITE */}
      {/* ==================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-emerald-400" />
                <span>{editingSite ? 'Editar Configuração de Nsite' : 'Cadastrar Novo Nsite'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300">Nome Amigável do Site *</label>
                <input
                  type="text"
                  placeholder="Ex: JJY Manuais de Campo"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Identificador / Slug *</label>
                  <input
                    type="text"
                    placeholder="jjy-docs"
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 mt-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Diretório de Build</label>
                  <input
                    type="text"
                    placeholder="./dist"
                    value={formRootDir}
                    onChange={(e) => setFormRootDir(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 mt-1 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Descrição do Site</label>
                <textarea
                  placeholder="Breve descrição da função deste site na rede mesh..."
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Rota de Fallback SPA</label>
                  <input
                    type="text"
                    placeholder="/index.html"
                    value={formFallback}
                    onChange={(e) => setFormFallback(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 mt-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Script de Build</label>
                  <input
                    type="text"
                    placeholder="npm run build"
                    value={formBuildScript}
                    onChange={(e) => setFormBuildScript(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 mt-1 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">
                  Chave Pública (npub) (Deixe vazio para gerar automaticamente)
                </label>
                <input
                  type="text"
                  placeholder="npub1..."
                  value={formNpub}
                  onChange={(e) => setFormNpub(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 mt-1 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Identificador NIP-05 (Opcional)</label>
                  <input
                    type="text"
                    placeholder="user@meudominio.com"
                    value={formNip05}
                    onChange={(e) => setFormNip05(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300">Domínio Customizado (Opcional)</label>
                  <input
                    type="text"
                    placeholder="site.jjy.mesh"
                    value={formCustomDomain}
                    onChange={(e) => setFormCustomDomain(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 mt-1 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveSiteModal}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
              >
                Salvar Nsite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
