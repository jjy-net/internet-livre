import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Search, Star, ChevronsLeft, ChevronsRight, ChevronDown, Menu, X, Bot, MessageSquare,
  Flame, Fingerprint, Download, Lock, ShieldAlert, Palette, WifiOff, ArrowLeft,
} from 'lucide-react';
import { DEFAULT_MODULE, GROUPS, MODULES, findModule } from './modules';
import type { AppModule } from './modules';
import { SKINS, useOnline, useShellPrefs } from './prefs';
import type { ShellPrefs, Skin } from './prefs';

/* ------------------------------------------------------------------------ */
/* Tipos                                                                    */
/* ------------------------------------------------------------------------ */

export interface ShellAction {
  id: string;
  label: string;
  icon: LucideIcon;
  hint?: string;
  href?: string;
  run?: () => void;
  tone?: 'accent' | 'hot';
}

interface AppShellProps {
  active: string;
  onNavigate: (id: string) => void;
  adminMode: boolean;
  isAdminSession: boolean;
  shieldLabel: string;
  onShield: () => void;
  onAi: () => void;
  onAdmin: () => void;
  install: { state: 'installed' | 'ready' | 'guide'; run: () => void };
  children: React.ReactNode;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');

/* ------------------------------------------------------------------------ */
/* Fundo "chuva de código" (apenas tema Matrix, respeita reduzir movimento) */
/* ------------------------------------------------------------------------ */

const CodeRain: React.FC = () => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const glyphs = 'アカサタナハマヤラ0123456789ABCDEF<>/{}#$';
    const size = 16;
    let drops: number[] = [];
    let raf = 0;
    let last = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      drops = Array.from({ length: Math.ceil(canvas.width / size) }, () => Math.random() * -50);
    };

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden || t - last < 70) return;
      last = t;
      ctx.fillStyle = 'rgba(3, 8, 5, 0.14)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${size - 2}px monospace`;
      ctx.fillStyle = '#22e06b';
      for (let i = 0; i < drops.length; i++) {
        ctx.fillText(glyphs[(Math.random() * glyphs.length) | 0], i * size, drops[i] * size);
        if (drops[i] * size > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 1;
      }
    };

    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className="jx-rain" aria-hidden="true" />;
};

/* ------------------------------------------------------------------------ */
/* Controles reutilizáveis                                                  */
/* ------------------------------------------------------------------------ */

const ThemeControl: React.FC<{ prefs: ShellPrefs; update: (p: Partial<ShellPrefs>) => void }> = ({ prefs, update }) => (
  <div className="jx-theme">
    <div className="jx-seg" role="radiogroup" aria-label="Tema visual">
      {SKINS.map((s) => (
        <button
          key={s.id}
          type="button"
          role="radio"
          aria-checked={prefs.skin === s.id}
          title={s.hint}
          className="jx-seg-btn"
          data-skin-dot={s.id}
          onClick={() => update({ skin: s.id })}
        >
          <span className="jx-dot" />
          {s.label}
        </button>
      ))}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={prefs.fx}
      className="jx-switch"
      onClick={() => update({ fx: !prefs.fx })}
    >
      <span className="jx-switch-track"><span className="jx-switch-thumb" /></span>
      <span>Efeitos de fundo</span>
    </button>
  </div>
);

interface NavListProps {
  active: string;
  prefs: ShellPrefs;
  actions: ShellAction[];
  onPick: (id: string) => void;
  toggleFavorite: (id: string) => void;
  toggleGroup: (id: string) => void;
  compact?: boolean;
}

const NavList: React.FC<NavListProps> = ({ active, prefs, actions, onPick, toggleFavorite, toggleGroup, compact }) => {
  const item = (m: AppModule) => {
    const Icon = m.icon;
    const fav = prefs.favorites.includes(m.id);
    return (
      <li key={m.id} className="jx-item-row">
        <button
          type="button"
          className="jx-item"
          aria-current={active === m.id ? 'page' : undefined}
          title={compact ? m.label : undefined}
          onClick={() => onPick(m.id)}
        >
          <Icon className="jx-ico" aria-hidden="true" />
          <span className="jx-label">{m.label}</span>
          {m.badge && <span className="jx-badge">{m.badge}</span>}
        </button>
        <button
          type="button"
          className="jx-star"
          aria-pressed={fav}
          aria-label={fav ? `Remover ${m.label} dos favoritos` : `Fixar ${m.label} nos favoritos`}
          title={fav ? 'Remover dos favoritos' : 'Fixar na barra de favoritos'}
          onClick={() => toggleFavorite(m.id)}
        >
          <Star className="jx-ico-sm" aria-hidden="true" />
        </button>
      </li>
    );
  };

  return (
    <nav className="jx-nav" aria-label="Módulos">
      {GROUPS.map((g) => {
        const mods = MODULES.filter((m) => m.group === g.id);
        if (!mods.length) return null;
        const closed = !compact && prefs.closedGroups.includes(g.id);
        return (
          <section key={g.id} className="jx-group">
            <button
              type="button"
              className="jx-group-head"
              aria-expanded={!closed}
              onClick={() => toggleGroup(g.id)}
            >
              <span>{g.label}</span>
              <span className="jx-count">{mods.length}</span>
              <ChevronDown className="jx-chev" aria-hidden="true" />
            </button>
            {!closed && <ul className="jx-list">{mods.map(item)}</ul>}
          </section>
        );
      })}

      <section className="jx-group">
        <div className="jx-group-head jx-static"><span>Atalhos</span></div>
        <ul className="jx-list">
          {actions.map((a) => {
            const Icon = a.icon;
            const inner = (
              <>
                <Icon className="jx-ico" aria-hidden="true" />
                <span className="jx-label">{a.label}</span>
              </>
            );
            return (
              <li key={a.id} className="jx-item-row">
                {a.href ? (
                  <a className="jx-item" data-tone={a.tone} href={a.href} target="_blank" rel="noopener noreferrer" title={a.hint ?? a.label}>
                    {inner}
                  </a>
                ) : (
                  <button type="button" className="jx-item" data-tone={a.tone} title={a.hint ?? a.label} onClick={a.run}>
                    {inner}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </nav>
  );
};

/* ------------------------------------------------------------------------ */
/* Paleta de comandos (Ctrl/⌘ + K)                                          */
/* ------------------------------------------------------------------------ */

interface PaletteEntry {
  key: string;
  label: string;
  sub: string;
  icon: LucideIcon;
  hay: string;
  run: () => void;
}

const CommandPalette: React.FC<{ entries: PaletteEntry[]; onClose: () => void }> = ({ entries, onClose }) => {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    if (!terms.length) return entries;
    // Quem casa pelo nome vem antes de quem casa só por grupo/palavra-chave
    const byName = (e: PaletteEntry) => (terms.every((t) => norm(e.label).includes(t)) ? 0 : 1);
    return entries.filter((e) => terms.every((t) => e.hay.includes(t))).sort((a, b) => byName(a) - byName(b));
  }, [q, entries]);

  useEffect(() => setIdx(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  const choose = (e: PaletteEntry | undefined) => {
    if (!e) return;
    onClose();
    e.run();
  };

  const onKey = (ev: React.KeyboardEvent) => {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      setIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      setIdx((i) => Math.max(i - 1, 0));
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      choose(results[idx]);
    }
  };

  return (
    <div className="jx-overlay jx-overlay-top" onMouseDown={onClose}>
      <div className="jx-palette" role="dialog" aria-modal="true" aria-label="Buscar módulos e ações" onMouseDown={(e) => e.stopPropagation()}>
        <div className="jx-palette-head">
          <Search className="jx-ico" aria-hidden="true" />
          <input
            autoFocus
            className="jx-palette-input"
            placeholder="Buscar módulo ou ação…"
            aria-label="Buscar módulo ou ação"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="jx-icon-btn" aria-label="Fechar busca" onClick={onClose}>
            <X className="jx-ico" aria-hidden="true" />
          </button>
        </div>
        <ul className="jx-palette-list" role="listbox" ref={listRef}>
          {results.map((e, i) => {
            const Icon = e.icon;
            return (
              <li key={e.key} role="option" aria-selected={i === idx}>
                <button type="button" className="jx-palette-row" tabIndex={-1} onMouseMove={() => setIdx(i)} onClick={() => choose(e)}>
                  <Icon className="jx-ico" aria-hidden="true" />
                  <span className="jx-label">{e.label}</span>
                  <span className="jx-sub">{e.sub}</span>
                </button>
              </li>
            );
          })}
          {!results.length && <li className="jx-empty">Nada encontrado para “{q}”. Tente outro termo.</li>}
        </ul>
        <div className="jx-palette-foot" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
          <span><kbd>Enter</kbd> abrir</span>
          <span><kbd>Esc</kbd> fechar</span>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------------ */
/* Shell                                                                    */
/* ------------------------------------------------------------------------ */

export const AppShell: React.FC<AppShellProps> = ({
  active, onNavigate, adminMode, isAdminSession, shieldLabel, onShield, onAi, onAdmin, install, children,
}) => {
  const { prefs, update, toggleFavorite, toggleGroup } = useShellPrefs();
  const online = useOnline();
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);

  const current = findModule(active);
  const groupLabel = adminMode ? 'Restrito' : GROUPS.find((g) => g.id === current?.group)?.label ?? '';
  const title = adminMode ? 'Portal Administrativo' : current?.label ?? 'JJY';

  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  const actions = useMemo<ShellAction[]>(() => {
    const list: ShellAction[] = [
      { id: 'ai', label: 'Assistente IA de Conexões', icon: Bot, run: onAi, tone: 'accent', hint: 'LoRa, Bluetooth, Wi-Fi' },
      { id: 'chat-soberano', label: 'Chat Soberano', icon: MessageSquare, href: '/chat.html', hint: 'Abre o JJY Chat Soberano em nova aba' },
      { id: 'anonimo', label: 'Jjy Anônimo', icon: Flame, href: '/Jjy.html', tone: 'hot', hint: 'Perguntas e mensagens anônimas' },
      { id: 'shield', label: 'Blindagem de Identidade', icon: Fingerprint, run: onShield, hint: 'MAC efêmero e anti-fingerprint' },
    ];
    if (install.state !== 'installed') {
      list.push({ id: 'install', label: install.state === 'ready' ? 'Instalar App' : 'Como Instalar', icon: Download, run: install.run });
    }
    return list;
  }, [onAi, onShield, install.state, install.run]);

  const go = useCallback(
    (id: string) => {
      setDrawer(false);
      setPalette(false);
      onNavigate(id);
    },
    [onNavigate]
  );

  const cycleSkin = useCallback(() => {
    const i = SKINS.findIndex((s) => s.id === prefs.skin);
    update({ skin: SKINS[(i + 1) % SKINS.length].id as Skin });
  }, [prefs.skin, update]);

  const entries = useMemo<PaletteEntry[]>(() => {
    const mods: PaletteEntry[] = MODULES.map((m) => {
      const g = GROUPS.find((x) => x.id === m.group)?.label ?? '';
      return { key: `m:${m.id}`, label: m.label, sub: g, icon: m.icon, hay: norm(`${m.label} ${m.short} ${g} ${m.badge ?? ''} ${m.keywords ?? ''} ${m.id}`), run: () => onNavigate(m.id) };
    });
    const acts: PaletteEntry[] = actions.map((a) => ({
      key: `a:${a.id}`, label: a.label, sub: 'Ação', icon: a.icon, hay: norm(`${a.label} ${a.hint ?? ''}`),
      run: () => (a.href ? window.open(a.href, '_blank', 'noopener') : a.run?.()),
    }));
    acts.push(
      { key: 'a:skin', label: 'Trocar tema visual', sub: 'Ação', icon: Palette, hay: norm('trocar tema visual skin cor matrix neon security aparencia'), run: cycleSkin },
      { key: 'a:admin', label: 'Acesso Administrativo', sub: 'Restrito', icon: Lock, hay: norm('acesso administrativo admin painel soc restrito'), run: onAdmin }
    );
    return [...mods, ...acts];
  }, [actions, onNavigate, cycleSkin, onAdmin]);

  /* Atalhos de teclado globais */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setDrawer(false);
        setPalette((p) => !p);
      } else if (e.key === 'Escape') {
        setPalette(false);
        setDrawer(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* Trava a rolagem do fundo quando há gaveta/busca aberta */
  useEffect(() => {
    if (!drawer && !palette) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawer, palette]);

  const favorites = prefs.favorites.map(findModule).filter((m): m is AppModule => !!m).slice(0, 4);
  const showNav = !adminMode;

  return (
    <div className="jx-app text-slate-100" data-collapsed={prefs.collapsed || undefined} data-admin={adminMode || undefined}>
      {prefs.fx && <div className="jx-fx" aria-hidden="true" />}
      {prefs.fx && prefs.skin === 'matrix' && !reducedMotion && <CodeRain />}

      <a className="jx-skip" href="#jx-main">Pular para o conteúdo</a>

      {/* Barra lateral (desktop) */}
      {showNav && (
        <aside className="jx-side" aria-label="Menu principal">
          <div className="jx-brand">
            <span className="jx-mark" aria-hidden="true"><Lock className="jx-ico" /></span>
            <span className="jx-brand-text">
              <strong>JJY</strong>
              <small>v2.0.0 · offline</small>
            </span>
            <button
              type="button"
              className="jx-icon-btn jx-collapse"
              aria-label={prefs.collapsed ? 'Expandir menu' : 'Recolher menu'}
              title={prefs.collapsed ? 'Expandir menu' : 'Recolher menu'}
              onClick={() => update({ collapsed: !prefs.collapsed })}
            >
              {prefs.collapsed ? <ChevronsRight className="jx-ico" aria-hidden="true" /> : <ChevronsLeft className="jx-ico" aria-hidden="true" />}
            </button>
          </div>

          <button type="button" className="jx-search" onClick={() => setPalette(true)} title="Buscar módulo ou ação">
            <Search className="jx-ico" aria-hidden="true" />
            <span className="jx-label">Buscar…</span>
            <kbd className="jx-label">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
          </button>

          <div className="jx-side-scroll">
            <NavList
              active={active}
              prefs={prefs}
              actions={actions}
              onPick={go}
              toggleFavorite={toggleFavorite}
              toggleGroup={toggleGroup}
              compact={prefs.collapsed}
            />
          </div>

          <div className="jx-side-foot">
            {prefs.collapsed ? (
              <button type="button" className="jx-icon-btn" aria-label="Trocar tema visual" title="Trocar tema visual" onClick={cycleSkin}>
                <Palette className="jx-ico" aria-hidden="true" />
              </button>
            ) : (
              <ThemeControl prefs={prefs} update={update} />
            )}
          </div>
        </aside>
      )}

      <div className="jx-col">
        {/* Barra superior */}
        <header className="jx-top">
          {adminMode ? (
            <button type="button" className="jx-btn" onClick={() => onNavigate(DEFAULT_MODULE)} title="Retornar para as ferramentas comuns de usuário" aria-label="Voltar ao Modo Usuário">
              <ArrowLeft className="jx-ico" aria-hidden="true" />
              <span className="jx-hide-sm">Modo Usuário</span>
            </button>
          ) : (
            <span className="jx-mark jx-only-mobile" aria-hidden="true"><Lock className="jx-ico" /></span>
          )}

          <div className="jx-title">
            <small>{groupLabel}</small>
            <h1>{title}</h1>
          </div>

          <div className="jx-top-actions">
            <span className="jx-chip" data-state={online ? 'ok' : 'warn'} title={online ? 'Tudo roda localmente, com ou sem internet' : 'Sem rede: o app segue funcionando com os dados locais'}>
              {online ? <span className="jx-pulse" aria-hidden="true" /> : <WifiOff className="jx-ico-sm" aria-hidden="true" />}
              <span className="jx-hide-xs">{online ? '100% Local' : 'Sem rede · ativo'}</span>
            </span>

            <button type="button" className="jx-chip jx-chip-btn" onClick={onShield} title="Blindagem de Identidade: MAC & Anti-Fingerprint ativos" aria-label="Blindagem de identidade">
              <Fingerprint className="jx-ico-sm" aria-hidden="true" />
              <span className="jx-mono jx-hide-sm">{shieldLabel}</span>
            </button>

            {isAdminSession && !adminMode && (
              <button type="button" className="jx-chip jx-chip-btn" data-state="bad" onClick={onAdmin} title="Sessão de Administrador ativa: abrir painel">
                <ShieldAlert className="jx-ico-sm" aria-hidden="true" />
                <span className="jx-hide-sm">Admin ativo</span>
              </button>
            )}

            {showNav && (
              <>
                <button type="button" className="jx-icon-btn jx-only-mobile" aria-label="Buscar módulo ou ação" onClick={() => setPalette(true)}>
                  <Search className="jx-ico" aria-hidden="true" />
                </button>
                <button type="button" className="jx-btn jx-btn-primary jx-only-desktop" onClick={onAi} title="Abrir Assistente IA de Conexões">
                  <Bot className="jx-ico" aria-hidden="true" />
                  <span>IA Conexões</span>
                </button>
              </>
            )}
          </div>
        </header>

        {adminMode && (
          <div className="jx-admin-banner" role="status">
            <ShieldAlert className="jx-ico" aria-hidden="true" />
            <strong>Área restrita: Portal Administrativo &amp; Blue Team</strong>
            <span className="jx-mono">{isAdminSession ? 'Sessão ativa' : 'Requer autenticação mestra'}</span>
          </div>
        )}

        <div id="jx-main" className="jx-main">{children}</div>
      </div>

      {/* Barra inferior (celular) */}
      {showNav && (
        <nav className="jx-bar" aria-label="Favoritos">
          {favorites.map((m) => {
            const Icon = m.icon;
            return (
              <button key={m.id} type="button" className="jx-bar-btn" aria-current={active === m.id ? 'page' : undefined} onClick={() => go(m.id)}>
                <Icon className="jx-ico" aria-hidden="true" />
                <span>{m.short}</span>
              </button>
            );
          })}
          <button type="button" className="jx-bar-btn" aria-haspopup="dialog" aria-expanded={drawer} onClick={() => setDrawer(true)}>
            <Menu className="jx-ico" aria-hidden="true" />
            <span>Menu</span>
          </button>
        </nav>
      )}

      {/* Gaveta completa (celular) */}
      {drawer && (
        <div className="jx-overlay jx-overlay-bottom" onMouseDown={() => setDrawer(false)}>
          <div className="jx-sheet" role="dialog" aria-modal="true" aria-label="Menu completo" onMouseDown={(e) => e.stopPropagation()}>
            <div className="jx-sheet-head">
              <span className="jx-grip" aria-hidden="true" />
              <strong>Menu</strong>
              <button type="button" className="jx-icon-btn" aria-label="Fechar menu" onClick={() => setDrawer(false)}>
                <X className="jx-ico" aria-hidden="true" />
              </button>
            </div>
            <button type="button" className="jx-search" onClick={() => { setDrawer(false); setPalette(true); }}>
              <Search className="jx-ico" aria-hidden="true" />
              <span className="jx-label">Buscar módulo ou ação…</span>
            </button>
            <div className="jx-sheet-scroll">
              <p className="jx-tip"><Star className="jx-ico-sm" aria-hidden="true" /> Toque na estrela para fixar até 4 módulos na barra inferior.</p>
              <NavList active={active} prefs={prefs} actions={actions} onPick={go} toggleFavorite={toggleFavorite} toggleGroup={toggleGroup} />
              <ThemeControl prefs={prefs} update={update} />
              <button type="button" className="jx-item jx-admin-link" onClick={() => { setDrawer(false); onAdmin(); }}>
                <Lock className="jx-ico" aria-hidden="true" />
                <span className="jx-label">Acesso Administrativo (restrito)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {palette && <CommandPalette entries={entries} onClose={() => setPalette(false)} />}
    </div>
  );
};
