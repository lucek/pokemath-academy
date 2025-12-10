import type { ComponentType } from 'react';

export interface PrivateShellUser {
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface NavItemVM {
  id: 'dashboard' | 'collection' | 'profile';
  label: string;
  href: '/dashboard' | '/collection' | '/profile';
  icon: ComponentType<{ className?: string }>;
  isActive: boolean;
}

export interface AvatarMenuItemVM {
  id: 'profile' | 'signout';
  label: string;
  href?: string;
  action?: () => Promise<void> | void;
  danger?: boolean;
}

export interface OfflineStatusVM {
  isOnline: boolean;
  lastChangedAt?: number;
}
