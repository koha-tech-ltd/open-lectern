import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';

export function ExportOptionsMenu({
  disabled,
  onLandscape,
}: {
  disabled?: boolean;
  onLandscape: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className={`lectern-export-more${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="lectern-export-more-btn"
        aria-label={t('editor.exportMore')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 20 20" aria-hidden>
          <circle cx="10" cy="4.5" r="1.55" fill="currentColor" />
          <circle cx="10" cy="10" r="1.55" fill="currentColor" />
          <circle cx="10" cy="15.5" r="1.55" fill="currentColor" />
        </svg>
      </button>
      {open ? (
        <div className="lectern-export-more-menu" id={menuId} role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLandscape();
            }}
          >
            {t('editor.exportPdfLandscape')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
