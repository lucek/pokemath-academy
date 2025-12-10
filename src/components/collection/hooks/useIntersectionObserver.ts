import { useEffect, useRef } from 'react';

interface UseIntersectionObserverOptions {
  active: boolean;
  onIntersect: () => void;
  root?: Element | null;
  rootMargin?: string;
  threshold?: number | number[];
}

export function useIntersectionObserver({
  active,
  onIntersect,
  root = null,
  rootMargin = '0px',
  threshold = 0.1,
}: UseIntersectionObserverOptions) {
  const targetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = targetRef.current;
    if (!node || !active) {
      return;
    }

    let isCancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!isCancelled && entry.isIntersecting) {
            onIntersect();
          }
        });
      },
      { root, rootMargin, threshold },
    );

    observer.observe(node);

    return () => {
      isCancelled = true;
      observer.disconnect();
    };
  }, [active, onIntersect, root, rootMargin, threshold]);

  return targetRef;
}
