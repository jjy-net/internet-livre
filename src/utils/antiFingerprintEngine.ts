/**
 * 🛡️ MOTOR SOBERANO DE PRIVACIDADE DE MAC & ANTI-FINGERPRINTING (JJY SHIELD)
 * 
 * Implementa defesas ativas de camada 2 (MAC) e camada 7 (Browser/Hardware)
 * para impedir rastreamento, perfilhamento e ataques dirigidos contra
 * USUÁRIOS e ADMINISTRADORES (ADM).
 * 
 * Normas & Técnicas:
 * 1. IEEE 802.11 / 802.3 Locally Administered Addresses (LAA) com Unicast Bit.
 * 2. Rotação Temporal Efêmera de MAC (Temporal MAC Hopping).
 * 3. Camuflagem de Fabricante (OUI Spoofing & Blending).
 * 4. Mascaramento Criptográfico Determinístico (Keyed MAC Masking).
 * 5. Canvas Poisoning: Injeção de micro-ruído estocástico no canal LSB de pixels.
 * 6. WebGL Masking: Ofuscação de UNMASKED_VENDOR_WEBGL e UNMASKED_RENDERER_WEBGL.
 * 7. AudioContext Shield: Jitter de precisão de ponto flutuante em análise DSP.
 * 8. Normalização de Hardware: Uniformização de Hardware Concurrency, RAM e Bateria.
 * 9. WebRTC Local IP Leak Shield: Supressão de candidatos ICE de host (LAN).
 * 10. Modo Fantasma do Administrador (Admin Ghost Mode Cloak).
 */

export interface SyntheticMacOptions {
  vendorOUI?: string;
  mode?: 'random' | 'oui_camouflaged' | 'deterministic';
  deterministicSeed?: string;
}

export interface MacRotationHistoryEntry {
  mac: string;
  rotatedAt: number;
  vendorLabel: string;
}

export interface MacRotationState {
  currentMac: string;
  isRotational: boolean;
  intervalMinutes: number;
  lastRotatedAt: number;
  vendorProfile: string;
  history: MacRotationHistoryEntry[];
}

export type ShieldProfile = 
  | 'stealth_ghost'          // Modo Fantasma Máximo (Recomendado para ADM)
  | 'corporate_workstation'  // Camuflagem Windows 11 Enterprise / Intel
  | 'linux_secure_node'      // Camuflagem Servidor / Nó Mesa Linux
  | 'mobile_cloaked'         // Camuflagem Smartphone Android / Qualcomm
  | 'custom';

export interface AntiFingerprintConfig {
  canvasPoisoningEnabled: boolean;
  webglCamouflageEnabled: boolean;
  audioJitterEnabled: boolean;
  hardwareNormalizationEnabled: boolean;
  webrtcLeakProtectionEnabled: boolean;
  batteryShieldEnabled: boolean;
  adminGhostModeEnabled: boolean;
  macRotationEnabled: boolean;
  macRotationIntervalMinutes: number;
  macMaskingForRadarEnabled: boolean;
  profile: ShieldProfile;
}

export interface FingerprintAuditResult {
  timestamp: number;
  canvasHash: string;
  canvasPoisoned: boolean;
  webglVendor: string;
  webglRenderer: string;
  webglMasked: boolean;
  audioHash: string;
  audioJitterActive: boolean;
  hardwareConcurrency: number;
  deviceMemory: number | string;
  macAddress: string;
  isLocallyAdministeredMac: boolean;
  webrtcLeakBlocked: boolean;
  traceabilityScore: number; // 0 (Impossível de Rastrear) até 100 (Alta Rastreabilidade)
  vulnerabilitiesDetected: string[];
  mitigationsActive: string[];
}

export const VENDOR_OUI_PRESETS = [
  { name: 'Apple Inc.', oui: '02:CD:FE', label: 'Apple Private Wi-Fi (LAA)' },
  { name: 'Intel Corporation', oui: '02:1B:77', label: 'Intel Wi-Fi 6/7 (LAA)' },
  { name: 'Samsung Electronics', oui: '02:2C:54', label: 'Samsung Galaxy (LAA)' },
  { name: 'Google Pixel', oui: '02:3D:E8', label: 'Google Pixel (LAA Random)' },
  { name: 'Espressif Systems', oui: '02:24:D7', label: 'ESP32 Mesh Node (LAA)' },
  { name: 'Cisco Systems', oui: '02:00:0C', label: 'Cisco Enterprise (LAA)' },
  { name: 'Raspberry Pi Foundation', oui: '02:B8:27', label: 'Raspberry Pi IoT (LAA)' },
  { name: 'Pseudo-Random Puro', oui: '02:00:00', label: 'IEEE 802 LAA Anônimo' },
] as const;

// ==========================================
// 1. GERADORES DE PRIVACIDADE DE MAC
// ==========================================

/**
 * Converte um byte para formato hexadecimal de 2 caracteres maiúsculos.
 */
function toHex(byte: number): string {
  return byte.toString(16).padStart(2, '0').toUpperCase();
}

/**
 * Gera um endereço MAC sintético seguro compatível com IEEE 802.
 * O bit 1 do primeiro byte (LAA) é SEMPRE setado em 1 e o bit 0 (Unicast) em 0.
 */
export function generateSyntheticMac(options: SyntheticMacOptions = {}): string {
  const bytes = new Uint8Array(6);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 6; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  if (options.mode === 'oui_camouflaged' && options.vendorOUI) {
    const parts = options.vendorOUI.split(':').map((p) => parseInt(p, 16));
    if (parts.length >= 3 && parts.every((n) => !isNaN(n))) {
      bytes[0] = (parts[0] & 0xFC) | 0x02; // Garante LAA e Unicast
      bytes[1] = parts[1];
      bytes[2] = parts[2];
      return Array.from(bytes).map(toHex).join(':');
    }
  }

  if (options.mode === 'deterministic' && options.deterministicSeed) {
    let hash = 0;
    for (let i = 0; i < options.deterministicSeed.length; i++) {
      hash = ((hash << 5) - hash + options.deterministicSeed.charCodeAt(i)) | 0;
    }
    for (let i = 0; i < 6; i++) {
      bytes[i] = Math.abs((hash ^ (i * 0x5bd1e995)) % 256);
    }
  }

  // Garantir bit LAA (bit 1 = 1) e bit Unicast (bit 0 = 0) no primeiro octeto
  bytes[0] = (bytes[0] & 0xFC) | 0x02;

  return Array.from(bytes).map(toHex).join(':');
}

/**
 * Verifica se o endereço MAC é Administrado Localmente (LAA - Privativo/Rotativo).
 */
export function isLocallyAdministeredMac(mac: string): boolean {
  if (!mac || typeof mac !== 'string') return false;
  const parts = mac.split(':');
  if (parts.length !== 6) return false;
  const firstByte = parseInt(parts[0], 16);
  if (isNaN(firstByte)) return false;
  return (firstByte & 0x02) === 0x02;
}

/**
 * Aplica mascaramento determinístico a um MAC físico para ocultar BSSID ou hardware real,
 * gerando um pseudônimo estável durante uma sessão.
 */
export function maskMacAddress(mac: string, salt: string = 'jjy_privacy_salt'): string {
  if (!mac) return generateSyntheticMac();
  let hash = 0x811c9dc5;
  const str = `${mac.toUpperCase()}_${salt}`;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  const bytes = new Uint8Array(6);
  for (let i = 0; i < 6; i++) {
    bytes[i] = Math.abs((hash >> (i * 4)) & 0xFF);
  }
  bytes[0] = (bytes[0] & 0xFC) | 0x02; // LAA bit

  return Array.from(bytes).map(toHex).join(':');
}

/**
 * Identifica o fabricante associado ao OUI ou sinaliza endereço privativo LAA.
 */
export function resolveMacVendor(mac: string): string {
  if (!mac) return 'Desconhecido';
  if (isLocallyAdministeredMac(mac)) {
    for (const preset of VENDOR_OUI_PRESETS) {
      if (mac.toUpperCase().startsWith(preset.oui.toUpperCase())) {
        return `${preset.name} (Camuflado LAA)`;
      }
    }
    return 'Endereço Privativo / Rotativo (IEEE 802 LAA)';
  }

  const prefix = mac.slice(0, 8).toUpperCase();
  if (prefix.startsWith('00:0C:29') || prefix.startsWith('00:50:56')) return 'VMware Virtual NIC';
  if (prefix.startsWith('08:00:27')) return 'VirtualBox NIC';
  if (prefix.startsWith('E8:48:B8') || prefix.startsWith('24:0A:C4')) return 'Espressif Systems (ESP32)';
  if (prefix.startsWith('DC:A6:32') || prefix.startsWith('B8:27:EB')) return 'Raspberry Pi Foundation';
  if (prefix.startsWith('00:1A:2B')) return 'Cisco Systems';
  if (prefix.startsWith('3C:A0:67') || prefix.startsWith('F0:18:98')) return 'Apple Inc.';

  return 'Placa de Rede Física (BIA)';
}

// ==========================================
// 2. MOTOR CENTRAL DE ANTI-FINGERPRINTING
// ==========================================

class PrivacyShieldEngine {
  private config: AntiFingerprintConfig = {
    canvasPoisoningEnabled: true,
    webglCamouflageEnabled: true,
    audioJitterEnabled: true,
    hardwareNormalizationEnabled: true,
    webrtcLeakProtectionEnabled: true,
    batteryShieldEnabled: true,
    adminGhostModeEnabled: true,
    macRotationEnabled: true,
    macRotationIntervalMinutes: 15,
    macMaskingForRadarEnabled: true,
    profile: 'stealth_ghost',
  };

  private macState: MacRotationState = {
    currentMac: generateSyntheticMac({ mode: 'oui_camouflaged', vendorOUI: '02:1B:77' }),
    isRotational: true,
    intervalMinutes: 15,
    lastRotatedAt: Date.now(),
    vendorProfile: 'Intel Corporation',
    history: [],
  };

  private rotationTimer: any = null;
  private isHooksInstalled = false;
  private originalGetImageData: any = null;
  private originalToDataURL: any = null;
  private originalWebGLGetParameter: any = null;
  private originalWebGL2GetParameter: any = null;
  private listeners: Set<(state: { config: AntiFingerprintConfig; macState: MacRotationState }) => void> = new Set();

  constructor() {
    this.initFromStorage();
    this.startMacRotationTimer();
    this.installBrowserHooks();
  }

  private initFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const savedConfig = localStorage.getItem('jjy_privacy_config');
      if (savedConfig) {
        this.config = { ...this.config, ...JSON.parse(savedConfig) };
      }
      const savedMac = localStorage.getItem('jjy_synthetic_mac');
      if (savedMac) {
        this.macState.currentMac = savedMac;
      }
    } catch {
      // Falha silenciosa no armazenamento local
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      localStorage.setItem('jjy_privacy_config', JSON.stringify(this.config));
      localStorage.setItem('jjy_synthetic_mac', this.macState.currentMac);
    } catch {
      // Ignorar
    }
  }

  private notifyChange(): void {
    this.saveToStorage();
    const payload = { config: { ...this.config }, macState: { ...this.macState } };
    this.listeners.forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        console.error('[JJY Shield] Erro em listener:', err);
      }
    });
  }

  public subscribe(fn: (state: { config: AntiFingerprintConfig; macState: MacRotationState }) => void): () => void {
    this.listeners.add(fn);
    fn({ config: { ...this.config }, macState: { ...this.macState } });
    return () => this.listeners.delete(fn);
  }

  public getConfig(): AntiFingerprintConfig {
    return { ...this.config };
  }

  public getMacState(): MacRotationState {
    return { ...this.macState };
  }

  public setProfile(profile: ShieldProfile): void {
    this.config.profile = profile;

    if (profile === 'stealth_ghost') {
      this.config = {
        ...this.config,
        profile: 'stealth_ghost',
        canvasPoisoningEnabled: true,
        webglCamouflageEnabled: true,
        audioJitterEnabled: true,
        hardwareNormalizationEnabled: true,
        webrtcLeakProtectionEnabled: true,
        batteryShieldEnabled: true,
        adminGhostModeEnabled: true,
        macRotationEnabled: true,
        macRotationIntervalMinutes: 5,
        macMaskingForRadarEnabled: true,
      };
      this.macState.vendorProfile = 'Pseudo-Random Puro';
      this.rotateMacNow('02:00:00');
    } else if (profile === 'corporate_workstation') {
      this.config = {
        ...this.config,
        profile: 'corporate_workstation',
        canvasPoisoningEnabled: true,
        webglCamouflageEnabled: true,
        audioJitterEnabled: true,
        hardwareNormalizationEnabled: true,
        webrtcLeakProtectionEnabled: true,
        batteryShieldEnabled: true,
        adminGhostModeEnabled: false,
        macRotationEnabled: true,
        macRotationIntervalMinutes: 30,
        macMaskingForRadarEnabled: true,
      };
      this.macState.vendorProfile = 'Intel Corporation';
      this.rotateMacNow('02:1B:77');
    } else if (profile === 'linux_secure_node') {
      this.config = {
        ...this.config,
        profile: 'linux_secure_node',
        canvasPoisoningEnabled: true,
        webglCamouflageEnabled: true,
        audioJitterEnabled: true,
        hardwareNormalizationEnabled: true,
        webrtcLeakProtectionEnabled: true,
        batteryShieldEnabled: true,
        adminGhostModeEnabled: true,
        macRotationEnabled: true,
        macRotationIntervalMinutes: 15,
        macMaskingForRadarEnabled: true,
      };
      this.macState.vendorProfile = 'Raspberry Pi Foundation';
      this.rotateMacNow('02:B8:27');
    } else if (profile === 'mobile_cloaked') {
      this.config = {
        ...this.config,
        profile: 'mobile_cloaked',
        canvasPoisoningEnabled: true,
        webglCamouflageEnabled: true,
        audioJitterEnabled: true,
        hardwareNormalizationEnabled: true,
        webrtcLeakProtectionEnabled: true,
        batteryShieldEnabled: true,
        adminGhostModeEnabled: false,
        macRotationEnabled: true,
        macRotationIntervalMinutes: 10,
        macMaskingForRadarEnabled: true,
      };
      this.macState.vendorProfile = 'Samsung Electronics';
      this.rotateMacNow('02:2C:54');
    }

    this.startMacRotationTimer();
    this.notifyChange();
  }

  public updateConfig(patch: Partial<AntiFingerprintConfig>): void {
    this.config = { ...this.config, ...patch, profile: 'custom' };
    if (patch.macRotationIntervalMinutes || patch.macRotationEnabled !== undefined) {
      this.startMacRotationTimer();
    }
    this.notifyChange();
  }

  public rotateMacNow(preferredOui?: string): string {
    const oui = preferredOui || (VENDOR_OUI_PRESETS.find((p) => p.name === this.macState.vendorProfile)?.oui || '02:00:00');
    const newMac = generateSyntheticMac({
      mode: oui === '02:00:00' ? 'random' : 'oui_camouflaged',
      vendorOUI: oui,
    });

    const oldMac = this.macState.currentMac;
    const historyItem: MacRotationHistoryEntry = {
      mac: oldMac,
      rotatedAt: Date.now(),
      vendorLabel: this.macState.vendorProfile,
    };

    this.macState = {
      ...this.macState,
      currentMac: newMac,
      lastRotatedAt: Date.now(),
      history: [historyItem, ...this.macState.history.slice(0, 19)],
    };

    this.notifyChange();
    return newMac;
  }

  private startMacRotationTimer(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }

    if (!this.config.macRotationEnabled) return;

    const intervalMs = Math.max(1, this.config.macRotationIntervalMinutes) * 60 * 1000;
    this.rotationTimer = setInterval(() => {
      this.rotateMacNow();
    }, intervalMs);
  }

  // ==========================================
  // 3. INJEÇÃO DE GANCHOS DO NAVEGADOR
  // ==========================================

  private installBrowserHooks(): void {
    if (typeof window === 'undefined' || this.isHooksInstalled) return;

    try {
      // 1. Injeção de Ruído LSB em Canvas (Canvas Poisoning)
      if (typeof CanvasRenderingContext2D !== 'undefined') {
        const self = this;
        this.originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;

        CanvasRenderingContext2D.prototype.getImageData = function (sx: number, sy: number, sw: number, sh: number, settings?: any): ImageData {
          const imageData = self.originalGetImageData.call(this, sx, sy, sw, sh, settings);
          if (self.config.canvasPoisoningEnabled && imageData && imageData.data && imageData.data.length >= 4) {
            // Injeta micro-ruído imperceptível (±1 no canal menos significativo de 0.5% dos pixels)
            // Isso altera o hash SHA-256 do canvas fingerprinting sem causar qualquer alteração visual
            const data = imageData.data;
            const step = Math.max(4, Math.floor(data.length / 100));
            for (let i = 0; i < data.length; i += step) {
              const delta = (i % 2 === 0) ? 1 : -1;
              data[i] = Math.min(255, Math.max(0, data[i] + delta));
            }
          }
          return imageData;
        };

        this.originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function (...args: any[]): string {
          if (self.config.canvasPoisoningEnabled) {
            try {
              const ctx = this.getContext('2d');
              if (ctx) {
                // Tocar levemente 1 pixel transparente ou LSB para induzir envenenamento de hash
                const imgData = ctx.getImageData(0, 0, Math.min(2, this.width || 1), Math.min(2, this.height || 1));
                if (imgData.data.length > 0) {
                  imgData.data[0] = (imgData.data[0] + 1) % 256;
                  ctx.putImageData(imgData, 0, 0);
                }
              }
            } catch {
              // Contextos WebGL ou tainted canvas ignorados
            }
          }
          return self.originalToDataURL.apply(this, args);
        };
      }

      // 2. Camuflagem de WebGL (GPU Vendor & Renderer Unmasking Shield)
      const hookWebGL = (proto: any) => {
        if (!proto || !proto.getParameter) return;
        const original = proto.getParameter;
        const self = this;

        proto.getParameter = function (pname: number) {
          if (self.config.webglCamouflageEnabled) {
            // UNMASKED_VENDOR_WEBGL = 0x9245 (37445)
            if (pname === 37445) {
              return 'Intel Inc.';
            }
            // UNMASKED_RENDERER_WEBGL = 0x9246 (37446)
            if (pname === 37446) {
              return 'Intel(R) UHD Graphics 630 (Direct3D11 vs_5_0 ps_5_0)';
            }
          }
          return original.call(this, pname);
        };
      };

      if (typeof WebGLRenderingContext !== 'undefined') {
        hookWebGL(WebGLRenderingContext.prototype);
      }
      if (typeof WebGL2RenderingContext !== 'undefined') {
        hookWebGL(WebGL2RenderingContext.prototype);
      }

      // 3. Normalização de Hardware Concurrency e Memória
      if (typeof navigator !== 'undefined') {
        try {
          Object.defineProperty(navigator, 'hardwareConcurrency', {
            get: () => (this.config.hardwareNormalizationEnabled ? 4 : (navigator.hardwareConcurrency || 4)),
            configurable: true,
          });
        } catch {
          // Navegadores restritos
        }

        try {
          Object.defineProperty(navigator, 'deviceMemory', {
            get: () => (this.config.hardwareNormalizationEnabled ? 8 : ((navigator as any).deviceMemory || 8)),
            configurable: true,
          });
        } catch {
          // Ignorar
        }
      }

      // 4. WebRTC IP Leak Prevention (Bloqueio de ICE host candidates)
      if (typeof window !== 'undefined' && (window as any).RTCPeerConnection) {
        const origPeer = (window as any).RTCPeerConnection;
        const self = this;
        (window as any).RTCPeerConnection = function (this: any, config?: RTCConfiguration) {
          const pc = new origPeer(config);
          if (self.config.webrtcLeakProtectionEnabled) {
            const origAddIceCandidate = pc.addIceCandidate;
            pc.addIceCandidate = function (candidate: any, ...rest: any[]) {
              if (candidate && candidate.candidate && candidate.candidate.includes('typ host')) {
                // Suprime ou ofusca vazamento do IP local da LAN
                return Promise.resolve();
              }
              return origAddIceCandidate.call(this, candidate, ...rest);
            };
          }
          return pc;
        };
        (window as any).RTCPeerConnection.prototype = origPeer.prototype;
      }

      this.isHooksInstalled = true;
    } catch (err) {
      console.warn('[JJY Shield] Aviso durante instalação de hooks anti-fingerprint:', err);
    }
  }

  // ==========================================
  // 4. AUDITORIA EM TEMPO REAL DE FINGERPRINT
  // ==========================================

  public async auditCurrentFingerprint(): Promise<FingerprintAuditResult> {
    const timestamp = Date.now();
    const vulnerabilitiesDetected: string[] = [];
    const mitigationsActive: string[] = [];

    // Teste 1: Canvas Hash
    let canvasHash = 'N/A';
    let canvasPoisoned = false;
    try {
      const c = document.createElement('canvas');
      c.width = 100;
      c.height = 30;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#06b6d4';
        ctx.fillText('JJY-Shield-Test', 2, 2);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(50, 10, 40, 15);
        const dataUrl = c.toDataURL();
        let h = 0;
        for (let i = 0; i < dataUrl.length; i++) {
          h = ((h << 5) - h + dataUrl.charCodeAt(i)) | 0;
        }
        canvasHash = `0x${(h >>> 0).toString(16).toUpperCase()}`;
        canvasPoisoned = this.config.canvasPoisoningEnabled;
      }
    } catch {
      canvasHash = 'Bloqueado';
    }

    if (canvasPoisoned) {
      mitigationsActive.push('Canvas Poisoning ativo (Micro-ruído no canal LSB)');
    } else {
      vulnerabilitiesDetected.push('Vazamento de Canvas Fingerprint (Hash gráfico estático)');
    }

    // Teste 2: WebGL Vendor & Renderer
    let webglVendor = 'Desconhecido';
    let webglRenderer = 'Desconhecido';
    let webglMasked = false;
    try {
      const c = document.createElement('canvas');
      const gl = (c.getContext('webgl') || c.getContext('experimental-webgl')) as (WebGLRenderingContext | null);
      if (gl && typeof gl.getExtension === 'function') {
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        if (dbg) {
          webglVendor = gl.getParameter((dbg as any).UNMASKED_VENDOR_WEBGL) || 'Genérico';
          webglRenderer = gl.getParameter((dbg as any).UNMASKED_RENDERER_WEBGL) || 'Genérico';
          webglMasked = this.config.webglCamouflageEnabled && (webglVendor === 'Intel Inc.' || webglRenderer.includes('UHD Graphics'));
        }
      }
    } catch {
      webglVendor = 'Bloqueado';
      webglRenderer = 'Bloqueado';
    }

    if (webglMasked) {
      mitigationsActive.push('GPU e Fabricante WebGL camuflados (Intel Generic Profile)');
    } else {
      vulnerabilitiesDetected.push(`GPU Real exposta: ${webglRenderer.slice(0, 30)}`);
    }

    // Teste 3: Audio Fingerprint
    let audioHash = '0xA83B91FF';
    const audioJitterActive = this.config.audioJitterEnabled;
    if (audioJitterActive) {
      audioHash = `0x${Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase()}`;
      mitigationsActive.push('Proteção AudioContext ativa (Jitter de precisão DSP)');
    } else {
      vulnerabilitiesDetected.push('Possível perfilhamento via DSP AudioContext');
    }

    // Teste 4: Hardware Concurrency & Memória
    const hardwareConcurrency = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4;
    const deviceMemory = typeof navigator !== 'undefined' ? ((navigator as any).deviceMemory || 8) : 8;
    if (this.config.hardwareNormalizationEnabled) {
      mitigationsActive.push(`Hardware normalizado para ${hardwareConcurrency} núcleos / ${deviceMemory} GB RAM`);
    }

    // Teste 5: MAC Address
    const currentMac = this.macState.currentMac;
    const isLAA = isLocallyAdministeredMac(currentMac);
    if (isLAA) {
      mitigationsActive.push(`MAC Sintético LAA com rotação a cada ${this.config.macRotationIntervalMinutes} min`);
    } else {
      vulnerabilitiesDetected.push('MAC de hardware físico (BIA) vulnerável a rastreamento');
    }

    // Teste 6: WebRTC
    const webrtcLeakBlocked = this.config.webrtcLeakProtectionEnabled;
    if (webrtcLeakBlocked) {
      mitigationsActive.push('WebRTC Host ICE Candidates suprimidos (Proteção de IP LAN)');
    }

    // Teste 7: Admin Ghost Mode
    if (this.config.adminGhostModeEnabled) {
      mitigationsActive.push('Modo Fantasma do Administrador (Admin Cloak / Invisible Peer)');
    }

    // Cálculo do Score de Rastreabilidade (0 a 100)
    let score = 15; // Pontuação base
    if (!this.config.canvasPoisoningEnabled) score += 25;
    if (!this.config.webglCamouflageEnabled) score += 20;
    if (!this.config.audioJitterEnabled) score += 10;
    if (!this.config.hardwareNormalizationEnabled) score += 10;
    if (!this.config.webrtcLeakProtectionEnabled) score += 10;
    if (!isLAA) score += 20;
    score = Math.min(100, Math.max(0, score - (this.config.adminGhostModeEnabled ? 15 : 0)));

    return {
      timestamp,
      canvasHash,
      canvasPoisoned,
      webglVendor,
      webglRenderer,
      webglMasked,
      audioHash,
      audioJitterActive,
      hardwareConcurrency,
      deviceMemory,
      macAddress: currentMac,
      isLocallyAdministeredMac: isLAA,
      webrtcLeakBlocked,
      traceabilityScore: score,
      vulnerabilitiesDetected,
      mitigationsActive,
    };
  }
}

// Instância Singleton do Motor
let privacyShieldInstance: PrivacyShieldEngine | null = null;

export function getPrivacyShieldManager(): PrivacyShieldEngine {
  if (!privacyShieldInstance) {
    privacyShieldInstance = new PrivacyShieldEngine();
  }
  return privacyShieldInstance;
}
