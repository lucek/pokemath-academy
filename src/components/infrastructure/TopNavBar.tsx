import { AvatarDropdown } from './AvatarDropdown';
import { GameRulesModal } from './GameRulesModal';
import type { NavItemVM, PrivateShellUser } from './types';
import pikachuLogo from '@/assets/icons/pikachu.png?url';
import pokeballIconSrc from '@/assets/icons/pokeball_icon.png?url';
import pokedexIcon from '@/assets/icons/pokedex.png?url';
import { cn } from '@/lib/utils';
import { TYPE_COLOR_MAP, type TypeColorSet } from '@/lib/type-colors';
import { CircleHelp } from 'lucide-react';
import { useMemo, useState } from 'react';

type NavId = 'dashboard' | 'collection';

const DashboardIcon = createImageIcon(pokeballIconSrc, 'DashboardIcon');
const CollectionIcon = createImageIcon(pokedexIcon, 'CollectionIcon', 'scale-[1.05]');

const BASE_NAV_ITEMS: (Omit<NavItemVM, 'isActive'> & { id: NavId })[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: DashboardIcon },
  { id: 'collection', label: 'Pokédex', href: '/collection', icon: CollectionIcon },
];

const NAV_THEMES: Record<NavId, TypeColorSet> = {
  dashboard: TYPE_COLOR_MAP.water,
  collection: TYPE_COLOR_MAP.electric,
};

const SHELL_PANEL_GRADIENT = `linear-gradient(135deg, ${TYPE_COLOR_MAP.fairy.base}1A, ${TYPE_COLOR_MAP.poison.base}1A)`;
const SHELL_BORDER_COLOR = `${TYPE_COLOR_MAP.fairy.light}33`;
const ACTIVE_NAV_GRADIENT = `linear-gradient(135deg, ${TYPE_COLOR_MAP.water.light} 0%, ${TYPE_COLOR_MAP.water.base} 55%, ${TYPE_COLOR_MAP.water.dark} 100%)`;
const ACTIVE_NAV_SOLID = TYPE_COLOR_MAP.water.base;
const INACTIVE_ICON_BORDER = 'rgba(255,255,255,0.25)';

const NAV_DESCRIPTIONS: Record<NavId, string> = {
  dashboard: 'Start encounters',
  collection: 'View collection, evolve Pokémon',
};

type EnhancedNavItem = Omit<NavItemVM, 'id'> & { id: NavId; description: string };

export interface TopNavBarProps {
  readonly currentPath: string;
  readonly user?: PrivateShellUser;
}

export function TopNavBar({ currentPath, user }: TopNavBarProps) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

  const navItems = useMemo(
    () =>
      BASE_NAV_ITEMS.map<EnhancedNavItem>((item) => ({
        ...item,
        isActive: isPathActive(currentPath, item.href),
        description: NAV_DESCRIPTIONS[item.id],
      })),
    [currentPath],
  );

  return (
    <>
      <nav role="navigation" aria-label="Private shell" className="sticky top-0 z-50 px-4 pt-4">
        <div
          className="relative mx-auto flex w-full max-w-7xl items-center gap-4 rounded-[32px] border px-4 py-3 text-[#fef7f0] shadow-[0_18px_60px_rgba(10,0,30,0.45)] backdrop-blur-xl"
          style={{ borderColor: SHELL_BORDER_COLOR, backgroundImage: SHELL_PANEL_GRADIENT }}
        >
          <a
            href="/dashboard"
            className="flex flex-shrink-0 items-center gap-3 rounded-2xl px-2 py-1 focus-visible:ring-2 focus-visible:ring-[#ffc89d]/70 focus-visible:outline-none"
          >
            <div className="flex size-11 overflow-hidden rounded-2xl bg-[#ffe1c0] shadow-[0_8px_18px_rgba(255,173,133,0.35)]">
              <img
                src={pikachuLogo}
                alt="PokéMath"
                className="size-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm leading-tight font-semibold text-white">PokéMath</p>
              <p className="text-xs font-medium text-white/70">Train faster every day</p>
            </div>
          </a>

          <div className="ml-auto flex w-full flex-1 items-center justify-between gap-2 sm:gap-3">
            <div className="flex min-w-0 flex-1 items-center justify-center sm:justify-end">
              <div className="flex w-full max-w-[360px] flex-nowrap items-stretch justify-center gap-2 sm:grid sm:max-w-xl sm:grid-cols-2 sm:gap-2">
                {navItems.map((item) => (
                  <NavLink key={item.id} item={item} forceInactive={isProfileMenuOpen} />
                ))}
              </div>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setIsRulesModalOpen(true)}
                aria-label="Open game rules"
                aria-haspopup="dialog"
                aria-expanded={isRulesModalOpen}
                className="group inline-flex h-[58px] w-[58px] items-center justify-center rounded-2xl border border-white/20 bg-white/[0.06] text-white/90 shadow-[0_12px_36px_rgba(0,0,0,0.4)] transition hover:-translate-y-[1px] hover:border-white/45 hover:bg-white/[0.12] focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
              >
                <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#9ed8ff] via-[#c6b5ff] to-[#f7d6ff] text-[#0b1330] shadow-[0_10px_24px_rgba(0,0,0,0.35)] transition group-hover:-translate-y-[1px] group-hover:shadow-[0_14px_34px_rgba(0,0,0,0.45)]">
                  <CircleHelp className="size-5" aria-hidden />
                </span>
              </button>
              <AvatarDropdown
                displayName={user?.displayName}
                avatarUrl={user?.avatarUrl}
                onMenuToggle={setIsProfileMenuOpen}
                activeColor={ACTIVE_NAV_SOLID}
              />
            </div>
          </div>
        </div>
      </nav>
      <GameRulesModal isOpen={isRulesModalOpen} onClose={() => setIsRulesModalOpen(false)} />
    </>
  );
}

interface NavLinkProps {
  readonly item: EnhancedNavItem;
  readonly forceInactive?: boolean;
}

function NavLink({ item, forceInactive }: NavLinkProps) {
  const Icon = item.icon;
  const isActive = forceInactive ? false : item.isActive;
  const theme = NAV_THEMES[item.id];

  return (
    <a
      href={item.href}
      aria-current={isActive ? 'page' : undefined}
      aria-label={`${item.label} — ${item.description}`}
      className={cn(
        'group relative flex items-center justify-center gap-2 rounded-2xl border px-2.5 py-2.5 text-center text-white/85 transition outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:justify-start sm:gap-3 sm:px-3 sm:py-2 sm:text-left',
        isActive
          ? 'border-white/60 shadow-[0_12px_30px_rgba(0,0,0,0.35)]'
          : 'border-white/10 bg-white/[0.04] hover:border-white/25 hover:bg-white/[0.08]',
      )}
      style={isActive ? { backgroundImage: ACTIVE_NAV_GRADIENT } : undefined}
    >
      <span
        className="flex size-10 overflow-hidden rounded-2xl"
        aria-hidden="true"
        style={{
          boxShadow: `inset 0 0 0 1px ${isActive ? theme.light : INACTIVE_ICON_BORDER}, 0 6px 14px rgba(7,6,15,0.35)`,
        }}
      >
        <Icon className="size-full" />
      </span>
      <div className="hidden flex-col sm:flex">
        <span className={cn('text-sm font-semibold', isActive ? 'text-[#0b1330]' : 'text-white')}>
          {item.label}
        </span>
        <span className={cn('text-xs text-white/70', isActive && 'text-[#1b2755]')}>
          {item.description}
        </span>
      </div>
    </a>
  );
}

function isPathActive(currentPath: string, href: NavItemVM['href']): boolean {
  if (currentPath === href) {
    return true;
  }
  if (href === '/dashboard') {
    return currentPath === '/' ? true : currentPath.startsWith('/dashboard');
  }
  return currentPath.startsWith(`${href}/`) || currentPath === href;
}

function createImageIcon(src: string, displayName: string, extraClass?: string) {
  const ImageIcon = ({ className }: { className?: string }) => (
    <img
      src={src}
      alt=""
      className={cn('size-full object-cover', extraClass, className)}
      loading="lazy"
    />
  );
  ImageIcon.displayName = displayName;
  return ImageIcon;
}
