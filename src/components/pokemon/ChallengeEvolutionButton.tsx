import { useCallback, useState } from 'react';

import type { EncounterEvolutionRequestDto, EncounterResponseDto, ErrorResponseDto } from '@/types';
import { Button } from '@/components/ui/button';
import { useNetworkStatus } from '@/components/hooks/useNetworkStatus';
import { useToast } from '@/components/toast/store';

interface ChallengeEvolutionButtonProps {
  readonly baseId: number;
  readonly evolutionId: number;
  readonly isBaseCaught: boolean;
  readonly onOpenEncounter: (response: EncounterResponseDto) => void;
  readonly label?: string;
}

async function requestEvolutionEncounter(
  payload: EncounterEvolutionRequestDto,
): Promise<EncounterResponseDto> {
  const response = await fetch('/api/encounters/evolution', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => null)) as ErrorResponseDto | null;
    const message =
      errorData?.error?.message ?? `Failed to start evolution encounter (HTTP ${response.status})`;
    throw new Error(message);
  }

  return (await response.json()) as EncounterResponseDto;
}

interface UseEvolutionChallengeActionArgs {
  readonly baseId: number;
  readonly evolutionId: number;
  readonly isBaseCaught: boolean;
  readonly onOpenEncounter: (response: EncounterResponseDto) => void;
}

interface EvolutionChallengeAction {
  readonly startChallenge: () => Promise<void>;
  readonly isSubmitting: boolean;
  readonly isDisabled: boolean;
  readonly disabledReason?: string;
}

export function useEvolutionChallengeAction({
  baseId,
  evolutionId,
  isBaseCaught,
  onOpenEncounter,
}: UseEvolutionChallengeActionArgs): EvolutionChallengeAction {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isOnline = useNetworkStatus();
  const { showToast } = useToast();

  const isDisabled = !isOnline || !isBaseCaught || isSubmitting;
  const disabledReason = !isOnline
    ? 'Offline – reconnect to challenge'
    : !isBaseCaught
      ? 'Catch the base form first'
      : undefined;

  const startChallenge = useCallback(async () => {
    if (isDisabled) return;
    setIsSubmitting(true);
    try {
      const encounter = await requestEvolutionEncounter({ baseId, evolutionId });
      onOpenEncounter(encounter);
    } catch (error) {
      showToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to start evolution challenge',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [baseId, evolutionId, isDisabled, onOpenEncounter, showToast]);

  return {
    startChallenge,
    isSubmitting,
    isDisabled,
    disabledReason,
  };
}

export function ChallengeEvolutionButton({
  baseId,
  evolutionId,
  isBaseCaught,
  onOpenEncounter,
  label = 'Challenge evolution',
}: ChallengeEvolutionButtonProps) {
  const { startChallenge, isDisabled, isSubmitting, disabledReason } = useEvolutionChallengeAction({
    baseId,
    evolutionId,
    isBaseCaught,
    onOpenEncounter,
  });

  return (
    <Button
      onClick={startChallenge}
      disabled={isDisabled}
      variant="outline"
      className="w-full justify-center border-cyan-400/50 bg-cyan-400/10 text-cyan-100 transition hover:-translate-y-0.5 hover:bg-cyan-400/20 hover:text-white disabled:cursor-not-allowed disabled:border-white/20 disabled:bg-white/5 disabled:text-white/50"
      aria-disabled={isDisabled}
      title={disabledReason}
    >
      {isSubmitting ? 'Starting challenge...' : label}
    </Button>
  );
}
