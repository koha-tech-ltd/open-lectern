import { useEffect } from 'react';

/** Applies pulse highlight class to elements matching active co-pilot targets. */
export function AttentionHighlight({ targets }: { targets: string[] }) {
  useEffect(() => {
    if (targets.length === 0) return;

    const nodes: Element[] = [];
    for (const target of targets) {
      document.querySelectorAll(`[data-lectern-target="${CSS.escape(target)}"]`).forEach((node) => {
        node.classList.add('lectern-attention');
        nodes.push(node);
      });
    }

    return () => {
      for (const node of nodes) {
        node.classList.remove('lectern-attention');
      }
    };
  }, [targets]);

  return null;
}
