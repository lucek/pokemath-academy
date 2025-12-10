import pokeballSprite from '@/assets/icons/pokeball.png?url';

interface ProgressBarProps {
  currentStep: 1 | 2 | 3;
}

export function ProgressBar({ currentStep }: ProgressBarProps) {
  const steps = [1, 2, 3] as const;

  return (
    <div className="mt-6 mb-6 w-full px-4 sm:px-8">
      <div className="flex w-full items-center gap-3" aria-label="Progress" role="status">
        {steps.map((step, index) => {
          const active = step === currentStep;
          const complete = step < currentStep;
          return (
            <div key={step} className="flex flex-1 items-center gap-3">
              <img
                src={pokeballSprite}
                alt={`Step ${step}`}
                width={36}
                height={36}
                className={`h-8 w-8 object-contain transition-opacity sm:h-10 sm:w-10 ${
                  active
                    ? 'opacity-100 drop-shadow-[0_0_10px_rgba(59,130,246,0.7)]'
                    : complete
                      ? 'opacity-80'
                      : 'opacity-40'
                }`}
                aria-current={active ? 'step' : undefined}
              />
              {index < steps.length - 1 && (
                <div
                  className={`h-[3px] flex-1 rounded-full ${
                    complete ? 'bg-gradient-to-r from-emerald-400 to-cyan-400' : 'bg-white/15'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
