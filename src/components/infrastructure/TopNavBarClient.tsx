import { ErrorBoundary } from './ErrorBoundary';
import { TopNavBar, type TopNavBarProps } from './TopNavBar';

export function TopNavBarClient(props: TopNavBarProps) {
  return (
    <ErrorBoundary>
      <TopNavBar {...props} />
    </ErrorBoundary>
  );
}
