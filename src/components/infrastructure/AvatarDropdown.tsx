import { ChevronDown, LoaderCircle, LogOut, UserRound } from 'lucide-react';
import { TYPE_COLOR_MAP, buildWavePalette, rgbaFromHex } from '@/lib/type-colors';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AvatarMenuItemVM } from './types';
import { Button } from '@/components/ui/button';
import type { Database } from '@/db/database.types';
import { Modal } from '@/components/ui/modal';
import type { PokemonTypeDto } from '@/types';
import { TypeWaveBackground } from '@/components/encounter/TypeWaveBackground';
import { cn } from '@/lib/utils';
import { createBrowserClient } from '@supabase/ssr';
import { useToast } from '@/components/toast/store';

interface AvatarDropdownProps {
  readonly displayName?: string | null;
  readonly avatarUrl?: string | null;
  readonly onSignedOut?: () => void;
  readonly onMenuToggle?: (isOpen: boolean) => void;
  readonly activeColor?: string;
}

const MENU_ITEMS: AvatarMenuItemVM[] = [{ id: 'signout', label: 'Sign out', danger: true }];

const AVATAR_MENU_MIN_WIDTH = 208;
const AVATAR_MENU_BACKGROUND = 'rgba(9, 12, 28, 0.9)';
const AVATAR_MENU_BORDER_COLOR = `${TYPE_COLOR_MAP.fairy.light}66`;

const SIGN_OUT_TYPES: PokemonTypeDto[] = [
  { id: -1, name: 'dark', slot: 1 },
  { id: -2, name: 'ghost', slot: 2 },
];

const SIGN_OUT_PALETTE = buildWavePalette(SIGN_OUT_TYPES);
const SIGN_OUT_ACCENT_BORDER = rgbaFromHex(SIGN_OUT_PALETTE.accent, 0.45);
const SIGN_OUT_PRIMARY_BUTTON_STYLE = {
  borderColor: SIGN_OUT_ACCENT_BORDER,
  backgroundColor: 'rgba(255,255,255,0.08)',
  boxShadow: '0 15px 30px rgba(0,0,0,0.35)',
};
const SIGN_OUT_OUTLINE_BUTTON_STYLE = {
  borderColor: SIGN_OUT_ACCENT_BORDER,
  boxShadow: '0 10px 24px rgba(0,0,0,0.3)',
};
const SIGN_OUT_BUTTON_CLASSES =
  'h-11 min-w-[170px] rounded-2xl px-5 text-[0.65rem] font-semibold uppercase tracking-[0.3em] shadow transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-white/30';

export function AvatarDropdown({
  displayName,
  avatarUrl,
  onSignedOut,
  onMenuToggle,
  activeColor,
}: AvatarDropdownProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [menuWidth, setMenuWidth] = useState<number>();
  const [triggerHeight, setTriggerHeight] = useState<number>();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const { showToast } = useToast();
  const initials = useMemo(() => buildInitials(displayName), [displayName]);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
    onMenuToggle?.(false);
  }, [onMenuToggle]);

  useEffect(() => {
    if (!isMenuOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (containerRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      closeMenu();
    }

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeMenu();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [isMenuOpen, closeMenu]);

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    try {
      const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL ?? import.meta.env.SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_KEY ?? import.meta.env.SUPABASE_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase configuration is missing.');
      }

      const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }

      showToast({ type: 'success', message: 'You have been signed out.' });
      onSignedOut?.();
      redirectTo('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign out failed. Please try again.';
      showToast({ type: 'error', message });
    } finally {
      setIsSigningOut(false);
      setIsConfirmOpen(false);
      closeMenu();
    }
  }, [onSignedOut, showToast, closeMenu]);

  const handleMenuAction = (item: AvatarMenuItemVM) => {
    if (item.href) {
      closeMenu();
      redirectTo(item.href);
      return;
    }
    if (item.id === 'signout') {
      closeMenu();
      setIsConfirmOpen(true);
    }
  };

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }
    const buttonEl = buttonRef.current;
    if (!buttonEl) {
      return;
    }

    const updateDimensions = () => {
      setMenuWidth(Math.max(AVATAR_MENU_MIN_WIDTH, buttonEl.offsetWidth));
      setTriggerHeight(buttonEl.offsetHeight);
    };

    updateDimensions();

    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(updateDimensions);
      observer.observe(buttonEl);
      return () => observer.disconnect();
    }

    const handleResize = () => updateDimensions();
    globalThis.addEventListener?.('resize', handleResize);
    return () => {
      globalThis.removeEventListener?.('resize', handleResize);
    };
  }, [isMenuOpen]);

  const triggerBaseClasses =
    'group flex items-center gap-3 rounded-[28px] border px-3 py-2 text-sm font-semibold text-white/90 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60';

  return (
    <>
      <div ref={containerRef} className="relative inline-flex">
        <button
          type="button"
          ref={buttonRef}
          data-test-id="user-avatar"
          onClick={() =>
            setIsMenuOpen((prev) => {
              const next = !prev;
              onMenuToggle?.(next);
              return next;
            })
          }
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          tabIndex={isMenuOpen ? -1 : 0}
          className={cn(
            triggerBaseClasses,
            'border-white/15 bg-white/5 hover:border-white/40 hover:bg-white/10',
            isMenuOpen && 'pointer-events-none border-transparent bg-transparent opacity-0',
          )}
          aria-hidden={isMenuOpen}
        >
          <span className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-500 text-base font-semibold text-white uppercase shadow-[0_6px_14px_rgba(7,6,15,0.35)]">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile avatar"
                className="size-full rounded-2xl object-cover"
                loading="lazy"
              />
            ) : (
              initials
            )}
          </span>
          <span className="hidden min-w-0 flex-1 truncate text-sm font-semibold text-white md:inline">
            {displayName ?? 'Trainer'}
          </span>
          <ChevronDown
            className={cn('ml-auto size-4 text-white/70 transition group-hover:text-white', {
              'rotate-180': isMenuOpen,
            })}
            aria-hidden="true"
          />
        </button>

        {isMenuOpen && (
          <div
            className="absolute top-0 right-0 z-[60] origin-top text-white/90"
            style={{ minWidth: AVATAR_MENU_MIN_WIDTH, width: menuWidth }}
          >
            <div
              className="flex flex-col overflow-hidden rounded-[32px] border shadow-[0_28px_80px_rgba(3,6,20,0.7)] backdrop-blur-2xl"
              style={{
                backgroundColor: activeColor ?? AVATAR_MENU_BACKGROUND,
                borderColor: AVATAR_MENU_BORDER_COLOR,
              }}
            >
              <button
                type="button"
                onClick={closeMenu}
                aria-haspopup="menu"
                aria-expanded="true"
                className={cn(
                  triggerBaseClasses,
                  'w-full border-white/25 bg-white/10 text-left text-white',
                )}
                style={{ minHeight: triggerHeight }}
              >
                <span className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-500 text-base font-semibold text-white uppercase shadow-[0_6px_14px_rgba(7,6,15,0.35)]">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile avatar"
                      className="size-full rounded-2xl object-cover"
                      loading="lazy"
                    />
                  ) : (
                    initials
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                  {displayName ?? 'Trainer'}
                </span>
                <ChevronDown className="ml-auto size-4 rotate-180 text-white" aria-hidden="true" />
              </button>

              <div role="menu" aria-label="Account menu" className="space-y-2 px-2.5 py-3">
                {MENU_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    className={cn(
                      'flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-left font-semibold tracking-wide transition focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-offset-transparent focus-visible:outline-none',
                      item.danger
                        ? 'border-[#ff6b6b]/60 bg-[#ff3b4d] text-white shadow-[0_12px_32px_rgba(255,59,77,0.4)] hover:bg-[#ff253d] focus-visible:ring-[#ff9c8c]/60'
                        : 'border-white/15 bg-white/[0.08] text-white hover:border-white/35 hover:bg-white/[0.14] focus-visible:ring-cyan-300/60',
                    )}
                    onClick={() => handleMenuAction(item)}
                  >
                    {item.id === 'profile' ? (
                      <UserRound className="size-4 text-white/80" aria-hidden="true" />
                    ) : (
                      <LogOut className="size-4 text-white" aria-hidden="true" />
                    )}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={isConfirmOpen}
        onRequestClose={() => {
          if (isSigningOut) return;
          setIsConfirmOpen(false);
        }}
        label="Sign out confirmation"
      >
        <div className="relative flex h-full flex-col overflow-hidden">
          <TypeWaveBackground types={SIGN_OUT_TYPES} variant="modal" className="opacity-70" />

          <div className="relative z-10 flex h-full flex-col gap-8 p-6 sm:p-10">
            <div className="space-y-4 text-white">
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold tracking-[0.4em] text-white/60 uppercase">
                  Confirm action
                </p>
                <h3 className="text-3xl font-bold text-white">Sign out of PokéMath?</h3>
              </div>
              <p className="text-sm text-white/80">
                You will need to reconnect to continue your adventure. Any in-progress encounters
                will be lost.
              </p>
            </div>

            <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsConfirmOpen(false)}
                disabled={isSigningOut}
                className={cn(
                  SIGN_OUT_BUTTON_CLASSES,
                  'border border-white/25 text-white hover:bg-white/10',
                )}
                style={SIGN_OUT_OUTLINE_BUTTON_STYLE}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className={cn(
                  SIGN_OUT_BUTTON_CLASSES,
                  'inline-flex items-center justify-center gap-2 border border-white/10 text-white',
                )}
                style={SIGN_OUT_PRIMARY_BUTTON_STYLE}
              >
                {isSigningOut ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <LogOut className="size-4" aria-hidden="true" />
                )}
                <span>{isSigningOut ? 'Signing out...' : 'Sign out'}</span>
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

function buildInitials(name?: string | null): string {
  if (!name) {
    return 'A';
  }
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function redirectTo(href: string) {
  const location = globalThis.location;
  if (typeof location?.assign === 'function') {
    location.assign(href);
  }
}
