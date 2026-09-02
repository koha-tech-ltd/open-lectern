import { useEffect, useRef, type ReactNode } from 'react';
import { attachNestedScrollChain } from '@/lib/scroll-chain';

export function StudioRailScroll({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return attachNestedScrollChain(el);
  }, []);

  return (
    <div ref={ref} className="studio-rail-scroll space-y-4">
      {children}
    </div>
  );
}
