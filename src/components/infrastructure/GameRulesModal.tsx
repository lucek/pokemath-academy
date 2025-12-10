import { CircleHelp, Sparkles, Target, TrendingUp, X } from 'lucide-react';

import { Modal } from '@/components/ui/modal';
import type { PokemonTypeDto } from '@/types';
import type { ReactNode } from 'react';
import { TypeWaveBackground } from '@/components/encounter/TypeWaveBackground';

const GUIDE_TYPES: PokemonTypeDto[] = [
  { id: 25, name: 'electric', slot: 1 },
  { id: 35, name: 'fairy', slot: 2 },
];

interface Section {
  readonly title: string;
  readonly icon: ReactNode;
  readonly points: string[];
}

const SECTIONS: Section[] = [
  {
    title: 'Catch Pokémon',
    icon: <Target className="size-5" aria-hidden />,
    points: [
      'Answer 3 quick math questions; get 2 right to catch the Pokémon.',
      'Missed it? You can try again up to 3 times before a new Pokémon appears.',
      'Shiny Pokémon are extra special — watch for the sparkles!',
    ],
  },
  {
    title: 'Evolve Pokémon',
    icon: <TrendingUp className="size-5" aria-hidden />,
    points: [
      'Catch the first form to unlock its evolution.',
      'Same rules, slightly harder math: 3 questions, get 2 right to win.',
      'Win the challenge to help your Pokémon evolve!',
    ],
  },
  {
    title: 'Your Collection',
    icon: <Sparkles className="size-5" aria-hidden />,
    points: [
      'See every Pokémon you’ve caught in one place.',
      'Tap a Pokémon to view its details and plan your next adventure.',
      'Check which ones can evolve and decide who to train next.',
    ],
  },
];

interface GameRulesModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function GameRulesModal({ isOpen, onClose }: GameRulesModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      label="How to Play PokéMath"
      className="sm:w-[720px]"
      overlayClassName="backdrop-blur-md"
    >
      <div className="relative flex h-full flex-col gap-5 p-6 sm:p-8">
        <TypeWaveBackground types={GUIDE_TYPES} variant="modal" className="opacity-60" />

        <div className="relative flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8ad6ff] via-[#c5b6ff] to-[#ffc8a5] text-[#0b1330] shadow-[0_14px_38px_rgba(0,0,0,0.4)]">
              <CircleHelp className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-semibold tracking-[0.12em] text-white/55 uppercase">
                Quick guide
              </p>
              <h2 className="text-2xl leading-tight font-semibold text-white sm:text-3xl">
                How to Play PokéMath
              </h2>
            </div>
          </div>

          <div className="grid gap-3">
            {SECTIONS.map((section) => (
              <article
                key={section.title}
                className="rounded-2xl border border-white/12 bg-black/30 p-4 text-white/85 shadow-[0_16px_50px_rgba(0,0,0,0.45)] backdrop-blur-md"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-flex size-9 items-center justify-center rounded-xl bg-white/10 text-white">
                    {section.icon}
                  </span>
                  <h3 className="text-sm font-semibold text-white">{section.title}</h3>
                </div>
                <ul className="space-y-2 text-sm leading-relaxed">
                  {section.points.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span className="mt-1 inline-flex size-4 items-center justify-center rounded-full bg-white/15 text-[10px] font-semibold text-white/70">
                        •
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close rules dialog"
          className="absolute top-4 right-4 inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 p-2 text-white/90 transition hover:-translate-y-[1px] hover:border-white/60 hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none sm:top-5 sm:right-5"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
    </Modal>
  );
}
