import {
  PokemonModalHeader,
  usePokemonModalHeaderConfig,
} from '@/components/pokemon/PokemonModalHeader';

import { ModalScaffold } from '@/components/pokemon/ModalScaffold';
import { PokemonModalDivider } from '@/components/pokemon/PokemonModalDivider';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface BasePokemonModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly bottomContent: ReactNode;
}

export function BasePokemonModal({ isOpen, onClose, bottomContent }: BasePokemonModalProps) {
  const headerConfig = usePokemonModalHeaderConfig();

  const floatingContent = headerConfig.divider ? (
    <PokemonModalDivider
      accentColor={headerConfig.divider.accentColor}
      variant={headerConfig.divider.variant}
    />
  ) : null;
  const contentInnerClassName =
    headerConfig.contentInnerClassName ??
    'flex h-full flex-col gap-6 overflow-y-auto px-4 pb-4 pt-6 sm:px-8';

  const heroNode = (
    <div className="relative h-full w-full">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close dialog"
        className="absolute top-5 right-8 z-30 inline-flex size-11 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white transition hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none sm:top-6 sm:right-10"
      >
        <X className="size-5" aria-hidden />
      </button>
      <PokemonModalHeader />
    </div>
  );

  return (
    <ModalScaffold
      isOpen={isOpen}
      onRequestClose={onClose}
      hero={heroNode}
      label={headerConfig.label}
      types={headerConfig.types}
      floatingContent={floatingContent}
      overlay={headerConfig.overlay}
      contentWaveClassName={headerConfig.contentWaveClassName}
      contentClassName={headerConfig.contentClassName}
      contentInnerClassName={contentInnerClassName}
      contentTextureSrc={headerConfig.contentTextureSrc}
      backdropClassName={headerConfig.backdropClassName}
    >
      {bottomContent}
    </ModalScaffold>
  );
}
