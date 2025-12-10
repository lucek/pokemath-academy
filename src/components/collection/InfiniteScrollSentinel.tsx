import { useIntersectionObserver } from './hooks/useIntersectionObserver';

interface InfiniteScrollSentinelProps {
  readonly active: boolean;
  readonly onIntersect: () => void;
  readonly rootMargin?: string;
}

export function InfiniteScrollSentinel({
  active,
  onIntersect,
  rootMargin = '200px 0px 200px 0px',
}: InfiniteScrollSentinelProps) {
  const targetRef = useIntersectionObserver({
    active,
    onIntersect,
    rootMargin,
    threshold: 0.25,
  });

  return <div ref={targetRef} aria-hidden="true" className="h-6 w-full" />;
}
