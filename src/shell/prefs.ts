import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_FAVORITES, isModuleId } from './modules';

export type Skin = 'cyber' | 'matrix' | 'sec';

export const SKINS: { id: Skin; label: string; hint: string }[] = [
  { id: 'cyber', label: 'Neon', hint: 'Ciberpunk ciano e magenta' },
  { id: 'matrix', label: 'Matrix', hint: 'Verde fósforo com chuva de código' },
  { id: 'sec', label: 'Security', hint: 'Sóbrio, sem efeitos' },
];

const KEY = 'jjy_shell_prefs_v1';

export interface ShellPrefs {
  skin: Skin;
  fx: boolean;
  collapsed: boolean;
  favorites: string[];
  closedGroups: string[];
}

const DEFAULTS: ShellPrefs = {
  skin: 'cyber',
  fx: true,
  collapsed: false,
  favorites: DEFAULT_FAVORITES,
  closedGroups: [],
};

function load(): ShellPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<ShellPrefs>) };
    if (!SKINS.some((s) => s.id === p.skin)) p.skin = DEFAULTS.skin;
    p.favorites = (Array.isArray(p.favorites) ? p.favorites : DEFAULTS.favorites).filter(isModuleId);
    if (!Array.isArray(p.closedGroups)) p.closedGroups = [];
    return p;
  } catch {
    return DEFAULTS;
  }
}

export function useShellPrefs() {
  const [prefs, setPrefs] = useState<ShellPrefs>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* armazenamento indisponível (modo privado): segue só em memória */
    }
    document.documentElement.setAttribute('data-skin', prefs.skin);
  }, [prefs]);

  const update = useCallback((patch: Partial<ShellPrefs>) => setPrefs((p) => ({ ...p, ...patch })), []);

  const toggleFavorite = useCallback(
    (id: string) =>
      setPrefs((p) => {
        if (p.favorites.includes(id)) {
          return { ...p, favorites: p.favorites.filter((f) => f !== id) };
        }
        // Limita a 5 favoritos (a barra inferior mostra no máximo 4 + botão Menu)
        if (p.favorites.length >= 5) return p;
        return { ...p, favorites: [...p.favorites, id] };
      }),
    []
  );

  const toggleGroup = useCallback(
    (id: string) =>
      setPrefs((p) => ({
        ...p,
        closedGroups: p.closedGroups.includes(id) ? p.closedGroups.filter((g) => g !== id) : [...p.closedGroups, id],
      })),
    []
  );

  return { prefs, update, toggleFavorite, toggleGroup };
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
