import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { Lock, Fingerprint, Shuffle, Check, Copy, X } from 'lucide-react';
import { getPrivacyShieldManager } from './utils/antiFingerprintEngine';
import { EmergencyAlertModal } from './components/EmergencyAlertModal';
import { UserAiChatPopup } from './components/UserAiChatPopup';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TabLoadingSpinner } from './components/TabLoadingSpinner';
import { AppShell } from './shell/AppShell';
import { DEFAULT_MODULE, findModule, isModuleId } from './shell/modules';

// Os módulos de usuário (e seus lazy imports) vivem em src/shell/modules.tsx.
// Para adicionar uma função nova ao menu, edite apenas aquele arquivo.
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));

type ActiveTab = string;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>(DEFAULT_MODULE);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [currentSyntheticMac, setCurrentSyntheticMac] = useState(
    getPrivacyShieldManager().getMacState().currentMac
  );
  const [copiedMac, setCopiedMac] = useState(false);

  // Estado e sincronização da sessão administrativa
  const [isAdminSession, setIsAdminSession] = useState(() => {
    return !!sessionStorage.getItem('datalink_admin_token');
  });

  useEffect(() => {
    const handleAuthChanged = () => {
      setIsAdminSession(!!sessionStorage.getItem('datalink_admin_token'));
    };
    window.addEventListener('jjy_admin_auth_changed', handleAuthChanged);
    window.addEventListener('storage', handleAuthChanged);
    return () => {
      window.removeEventListener('jjy_admin_auth_changed', handleAuthChanged);
      window.removeEventListener('storage', handleAuthChanged);
    };
  }, []);

  // Roteamento isolado via hash de URL (#admin, #globe, #mesh, etc.) e query parameters
  useEffect(() => {
    const syncFromHash = () => {
      const rawHash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
      const cleanHash = rawHash.split(/[\/?#]/)[0];
      const searchParams = new URLSearchParams(window.location.search);
      const tabParam = searchParams.get('tab')?.toLowerCase();

      if (rawHash === 'admin' || window.location.search.includes('admin=1') || tabParam === 'admin') {
        setActiveTab('admin');
        return;
      }

      // Suporte direto para Protocolo JJY Sovereign Mesh e sub-aba Meshtastic
      if (
        cleanHash === 'mesh' ||
        cleanHash === 'meshtastic' ||
        rawHash.includes('meshtastic') ||
        tabParam === 'mesh' ||
        tabParam === 'meshtastic'
      ) {
        setActiveTab('mesh');
        if (
          cleanHash === 'meshtastic' ||
          rawHash.includes('meshtastic') ||
          tabParam === 'meshtastic' ||
          searchParams.get('subtab') === 'meshtastic'
        ) {
          try {
            sessionStorage.setItem('jjy_mesh_subtab', 'meshtastic');
            localStorage.setItem('jjy_mesh_subtab', 'meshtastic');
            window.dispatchEvent(new CustomEvent('jjy_mesh_subtab_change', { detail: 'meshtastic' }));
          } catch {}
        }
        return;
      }

      if (isModuleId(cleanHash)) {
        setActiveTab(cleanHash);
      } else if (tabParam && isModuleId(tabParam)) {
        setActiveTab(tabParam);
      } else if (!rawHash) {
        // Botão "voltar" do navegador/celular até a URL sem hash: retorna ao início
        setActiveTab(DEFAULT_MODULE);
      }
    };

    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  const switchTab = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === 'admin') {
      window.location.hash = 'admin';
    } else if (tab === DEFAULT_MODULE) {
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    } else {
      window.location.hash = tab;
    }
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const unsub = getPrivacyShieldManager().subscribe(({ macState }) => {
      setCurrentSyntheticMac(macState.currentMac);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstallable(false);
      setIsInstalled(true);
    };

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      setShowInstallGuide(true);
      return;
    }
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstallable(false);
      setIsInstalled(true);
    }
  };

  const openAi = useCallback(() => window.dispatchEvent(new CustomEvent('jjy_open_ai_chat')), []);
  const openShield = useCallback(() => setShowPrivacyModal(true), []);
  const openAdmin = useCallback(() => switchTab('admin'), [switchTab]);
  const install = useMemo(
    () => ({
      state: isInstalled ? ('installed' as const) : isInstallable ? ('ready' as const) : ('guide' as const),
      run: handleInstallClick,
    }),
    // handleInstallClick depende apenas de deferredPrompt
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isInstalled, isInstallable, deferredPrompt]
  );
  const activeModule = findModule(activeTab);

  return (
    <AppShell
      active={activeTab}
      onNavigate={switchTab}
      adminMode={activeTab === 'admin'}
      isAdminSession={isAdminSession}
      shieldLabel={currentSyntheticMac.slice(0, 8) + '…'}
      onShield={openShield}
      onAi={openAi}
      onAdmin={openAdmin}
      install={install}
    >
      {/* Conteúdo Principal Isolado com Resiliência & Lazy Loading */}
      <ErrorBoundary fallbackTitle="Falha temporária ao renderizar aba" onReset={() => switchTab(DEFAULT_MODULE)}>
        <Suspense fallback={<TabLoadingSpinner />}>
          <main key={activeTab} className="jx-view max-w-7xl mx-auto px-4 py-5 sm:py-6 flex-1 w-full">
            {activeTab === 'admin'
              ? <AdminDashboard onExit={() => switchTab(DEFAULT_MODULE)} />
              : activeModule?.render(switchTab)}
          </main>
        </Suspense>
      </ErrorBoundary>

      {/* Modal de Instalação PWA / Desktop */}
      {showInstallGuide && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowInstallGuide(false)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <span>💻</span> Instalação como Aplicativo Desktop
              </h3>
              <button
                type="button"
                onClick={() => setShowInstallGuide(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              O Jjy pode ser executado e instalado de três maneiras fáceis:
            </p>

            <div className="space-y-2.5">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-xs font-bold text-indigo-400 block mb-0.5">1. PWA no Navegador (Chrome / Edge)</span>
                <span className="text-[11px] text-slate-400">
                  Clique no ícone de instalar na barra de endereços (⊕) ou no botão &quot;Instalar App&quot;.
                </span>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-xs font-bold text-emerald-400 block mb-0.5">2. Executável Portable (.EXE)</span>
                <span className="text-[11px] text-slate-400">
                  Execute o script <code>criar-executavel.bat</code> na pasta para gerar o executável standalone do Windows na pasta <code>release/</code>.
                </span>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-xs font-bold text-purple-400 block mb-0.5">3. Servidor de Rede Local</span>
                <span className="text-[11px] text-slate-400">
                  Dê duplo clique em <code>iniciar-servidor.bat</code> para permitir que qualquer celular ou PC na mesma rede acesse via Wi-Fi.
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowInstallGuide(false)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all"
            >
              Entendido!
            </button>
          </div>
        </div>
      )}

      {/* Modal de Blindagem de Identidade & Anti-Fingerprint */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-cyan-800/60 rounded-3xl max-w-md w-full p-6 shadow-2xl shadow-cyan-950/60 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5 text-cyan-400">
                <div className="p-2.5 rounded-2xl bg-cyan-950 border border-cyan-600/50">
                  <Fingerprint className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-100 tracking-wide">
                    Blindagem de MAC & Impressão Digital
                  </h3>
                  <span className="text-[11px] text-cyan-400 font-semibold">IEEE 802 LAA / Anti-Fingerprint Ativo</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Sua estação está navegando com identidade ofuscada. Rastreadores, operadores de rede maliciosos e scripts de fingerprinting recebem dados sintéticos efêmeros.
            </p>

            <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Endereço MAC Efêmero:</span>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950 px-1.5 py-0.2 rounded border border-emerald-800">
                  LAA Ativo
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-base font-bold text-cyan-300">{currentSyntheticMac}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(currentSyntheticMac);
                    setCopiedMac(true);
                    setTimeout(() => setCopiedMac(false), 2000);
                  }}
                  className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 text-xs flex items-center gap-1"
                >
                  {copiedMac ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80">
                <span className="text-slate-500 block text-[10px] font-bold">CANVAS POISONING</span>
                <span className="text-emerald-400 font-semibold">Ativo (Ruído LSB)</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80">
                <span className="text-slate-500 block text-[10px] font-bold">GPU WEBGL</span>
                <span className="text-emerald-400 font-semibold">Camuflada (Intel UHD)</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80">
                <span className="text-slate-500 block text-[10px] font-bold">AUDIOCONTEXT</span>
                <span className="text-emerald-400 font-semibold">Jitter DSP Ativo</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80">
                <span className="text-slate-500 block text-[10px] font-bold">WEBRTC LAN SHIELD</span>
                <span className="text-emerald-400 font-semibold">Host IP Bloqueado</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const newMac = getPrivacyShieldManager().rotateMacNow();
                  setCurrentSyntheticMac(newMac);
                }}
                className="flex-1 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Rotacionar MAC Agora</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowPrivacyModal(false);
                  switchTab('admin');
                }}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-all"
              >
                Painel SOC
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up de Emergência e Alertas do Administrador (Ativo globalmente com sirene e confirmação) */}
      <EmergencyAlertModal isAdmin={activeTab === 'admin'} />

      {/* Pop-up do Assistente de IA de Conexões para Todo o Site (Para Usuários) */}
      <UserAiChatPopup
        onNavigate={switchTab}
        currentTab={activeTab}
      />

      <footer className="jx-footer">
        <p>🔒 100% Offline • Criptografia nativa Web Crypto • Seus dados nunca saem do seu computador ou rede local.</p>
        <a
          href="/admin.html"
          onClick={(e) => {
            e.preventDefault();
            switchTab('admin');
          }}
          title="Portal Restrito do Administrador (Requer Senha Mestra)"
        >
          <Lock className="w-3 h-3" />
          <span>Acesso Administrativo (Restrito)</span>
        </a>
      </footer>
    </AppShell>
  );
};

export default App;
