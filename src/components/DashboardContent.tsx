import QueryProvider from './QueryProvider';
import DashboardStats, { useDashboardStats } from './DashboardStats';
import RecentCaptures from './RecentCaptures';
import { EncounterModal } from '@/components/encounter/EncounterModal';
import { useEncounterStore } from '@/components/encounter/state/useEncounterStore';
import { PokemonDetailModalProvider } from '@/components/pokemon/PokemonDetailModalProvider';

export default function DashboardContent() {
  const isOpen = useEncounterStore((s) => s.isOpen);
  const closeModal = useEncounterStore((s) => s.actions.closeModal);

  return (
    <QueryProvider>
      <PokemonDetailModalProvider>
        <div className="opacity-90">
          <DashboardSections />
          <EncounterModal isOpen={isOpen} onRequestClose={closeModal} />
        </div>
      </PokemonDetailModalProvider>
    </QueryProvider>
  );
}

function DashboardSections() {
  const statsQuery = useDashboardStats();

  return (
    <>
      <div className="mb-8">
        <DashboardStats statsQuery={statsQuery} />
      </div>
      <div className="mb-8">
        <RecentCaptures />
      </div>
    </>
  );
}
