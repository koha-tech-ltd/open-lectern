import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@/i18n/I18nProvider';
import type { InlineTextTarget, RelRect } from '@/lib/inline-text-hit';

export function InlineEditChip({
  sectionId,
  target,
  onEdit,
  onDismiss,
}: {
  sectionId: string;
  target: InlineTextTarget;
  onEdit: () => void;
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [absRects, setAbsRects] = useState<RelRect[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const labelId = useId();

  useEffect(() => {
    function sync() {
      const originEl = document.querySelector(`[data-inline-hit="${CSS.escape(sectionId)}"]`);
      if (!(originEl instanceof HTMLElement)) {
        onDismiss();
        return;
      }
      const origin = originEl.getBoundingClientRect();
      setAbsRects(
        target.relRects.map((r) => ({
          top: origin.top + r.top,
          left: origin.left + r.left,
          width: r.width,
          height: r.height,
        })),
      );
    }

    sync();
    window.addEventListener('scroll', sync, true);
    window.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('scroll', sync, true);
      window.removeEventListener('resize', sync);
    };
  }, [sectionId, target, onDismiss]);

  useLayoutEffect(() => {
    const el = rootRef.current;
    const first = absRects[0];
    if (!el || !first) return;
    const box = el.getBoundingClientRect();
    const rtl = document.documentElement.dir === 'rtl';
    let top = first.top - box.height - 8;
    if (top < 8) top = first.top + first.height + 8;
    let left = rtl ? first.left + first.width - box.width : first.left;
    left = Math.min(Math.max(8, left), Math.max(8, window.innerWidth - box.width - 8));
    top = Math.min(Math.max(8, top), Math.max(8, window.innerHeight - box.height - 8));
    setPos({ top, left });
  }, [absRects]);

  useEffect(() => {
    if (!pos) return;
    ctaRef.current?.focus();
  }, [pos]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) onDismiss();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDismiss();
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onDismiss]);

  const quote = target.snippet.length > 42 ? `${target.snippet.slice(0, 41)}…` : target.snippet;

  return createPortal(
    <>
      {absRects.map((r, i) => (
        <div
          key={i}
          className="inline-text-mark"
          style={{ top: r.top, left: r.left, width: r.width, height: r.height }}
          aria-hidden
        />
      ))}
      <div
        ref={rootRef}
        className="inline-edit-chip"
        style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' }}
        role="dialog"
        aria-labelledby={labelId}
      >
        <div className="approve-chips" role="group" aria-label={t('editor.inlineEditCta')}>
          <span id={labelId} className="approve-chips-ask">
            {quote}
          </span>
          <button
            ref={ctaRef}
            type="button"
            className="approve-chip approve-chip-confirm"
            onClick={onEdit}
          >
            {t('editor.inlineEditCta')}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
