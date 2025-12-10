import { Modal } from '@/components/ui/modal';
import type { PokemonTypeDto } from '@/types';
import type { ReactNode } from 'react';
import { TypeWaveBackground } from '@/components/encounter/TypeWaveBackground';
import { cn } from '@/lib/utils';

interface ModalScaffoldProps {
  readonly isOpen: boolean;
  readonly onRequestClose: () => void;
  readonly hero?: ReactNode;
  readonly children: ReactNode;
  readonly types?: PokemonTypeDto[];
  readonly overlay?: ReactNode;
  readonly floatingContent?: ReactNode;
  readonly label?: string;
  readonly contentTextureSrc?: string;
  readonly contentWaveClassName?: string;
  readonly contentClassName?: string;
  readonly contentInnerClassName?: string;
  readonly backdropClassName?: string;
}

export function ModalScaffold({
  isOpen,
  onRequestClose,
  hero,
  children,
  types = [],
  overlay,
  floatingContent,
  label = 'Pokémon modal',
  contentTextureSrc,
  contentWaveClassName,
  contentClassName,
  contentInnerClassName,
  backdropClassName,
}: ModalScaffoldProps) {
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      label={label}
      overlayClassName={backdropClassName}
    >
      <div className="relative flex h-full flex-col sm:h-auto">
        {overlay ? <div className="absolute inset-0 z-20">{overlay}</div> : null}
        <div className="relative z-10 flex h-full flex-1 flex-col sm:grid sm:h-[80vh] sm:max-h-[860px] sm:min-h-[720px] sm:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
          {hero ? (
            <div className="relative -mx-4 -mt-3 flex h-full min-h-0 sm:-mx-8 sm:-mt-4">
              {floatingContent ? (
                <div className="pointer-events-none absolute right-0 bottom-0 left-0 z-20 flex translate-y-1/2 justify-center">
                  {floatingContent}
                </div>
              ) : null}
              <div className="flex-1 overflow-hidden rounded-t-[32px] sm:rounded-t-[40px]">
                {hero}
              </div>
            </div>
          ) : null}
          <div className="-mx-4 -mt-3 -mb-3 flex h-full min-h-0 sm:-mx-8 sm:-mt-4 sm:-mb-4">
            <div
              className={cn(
                'relative h-[105%] flex-1 overflow-hidden rounded-b-[32px] px-4 pt-6 pb-6 sm:rounded-b-[40px] sm:px-8 sm:pb-8',
                contentClassName,
              )}
            >
              {contentTextureSrc ? (
                <div
                  className="absolute inset-0 opacity-15"
                  style={{
                    backgroundImage: `url('${contentTextureSrc}')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                  aria-hidden
                />
              ) : null}
              {types.length > 0 ? (
                <TypeWaveBackground
                  types={types}
                  variant="modal"
                  className={cn('absolute inset-0 opacity-70', contentWaveClassName)}
                />
              ) : null}
              <div
                className="absolute inset-0 bg-gradient-to-b from-[#05060f]/65 via-[#05060f]/25 to-transparent"
                aria-hidden
              />
              <div className={cn('relative flex h-full flex-col gap-6', contentInnerClassName)}>
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
