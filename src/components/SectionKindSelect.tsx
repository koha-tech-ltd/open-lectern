import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/en';
import {
  BUILTIN_SECTION_KINDS,
  isBuiltinSectionKind,
  normalizeSectionKind,
  type BuiltinSectionKind,
} from '@/lib/section-kind';
import type { SectionKind } from '@/types/lesson';

const BUILTIN_LABEL: Record<BuiltinSectionKind, MessageKey> = {
  material: 'manuscript.kind.material',
  example: 'manuscript.kind.example',
  summary: 'manuscript.kind.summary',
};

export function SectionKindSelect({
  value,
  extraKinds = [],
  onChange,
}: {
  value: SectionKind;
  extraKinds?: readonly string[];
  onChange: (kind: SectionKind) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const labelFor = (kind: string) =>
    isBuiltinSectionKind(kind) ? t(BUILTIN_LABEL[kind]) : kind;

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

  const openCustomModal = () => {
    setOpen(false);
    setCustomError(null);
    setCustomName(isBuiltinSectionKind(value) ? '' : value);
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commitCustom = () => {
    const next = normalizeSectionKind(customName);
    if (!next) {
      setCustomError(t('editor.kind.customEmpty'));
      return;
    }
    const match = extraKinds.find((kind) => kind.toLowerCase() === next.toLowerCase());
    onChange(match ?? next);
    dialogRef.current?.close();
  };

  return (
    <div className={`kind-select ${open ? 'is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="kind-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{labelFor(value)}</span>
        <svg className="kind-select-chevron" viewBox="0 0 12 12" aria-hidden>
          <path d="M2.2 4.2 6 8l3.8-3.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>

      {open ? (
        <div className="kind-select-menu" id={listId} role="listbox" aria-label={t('editor.kind.pickerAria')}>
          {BUILTIN_SECTION_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              role="option"
              aria-selected={value === kind}
              className={`kind-select-option ${value === kind ? 'is-current' : ''}`}
              onClick={() => {
                onChange(kind);
                setOpen(false);
              }}
            >
              {t(BUILTIN_LABEL[kind])}
            </button>
          ))}
          {extraKinds.length > 0 ? (
            <div className="kind-select-group">
              {extraKinds.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  role="option"
                  aria-selected={value === kind}
                  className={`kind-select-option ${value === kind ? 'is-current' : ''}`}
                  onClick={() => {
                    onChange(kind);
                    setOpen(false);
                  }}
                >
                  {kind}
                </button>
              ))}
            </div>
          ) : null}
          <button type="button" className="kind-select-custom" onClick={openCustomModal}>
            <span aria-hidden>+</span>
            {t('editor.kind.custom')}
          </button>
        </div>
      ) : null}

      <dialog
        ref={dialogRef}
        className="kind-select-dialog"
        onClose={() => {
          setCustomName('');
          setCustomError(null);
        }}
      >
        <form
          className="kind-select-dialog-inner"
          onSubmit={(event) => {
            event.preventDefault();
            commitCustom();
          }}
        >
          <h2>{t('editor.kind.customTitle')}</h2>
          <p>{t('editor.kind.customLede')}</p>
          <label className="kind-select-dialog-field">
            <span className="sr-only">{t('editor.kind.customTitle')}</span>
            <input
              ref={inputRef}
              value={customName}
              maxLength={40}
              placeholder={t('editor.kind.customPlaceholder')}
              onChange={(event) => {
                setCustomName(event.target.value);
                setCustomError(null);
              }}
            />
          </label>
          {customError ? <p className="kind-select-dialog-error">{customError}</p> : null}
          <div className="kind-select-dialog-actions">
            <button type="button" className="kind-select-dialog-ghost" onClick={() => dialogRef.current?.close()}>
              {t('editor.kind.customCancel')}
            </button>
            <button type="submit" className="kind-select-dialog-add">
              {t('editor.kind.customAdd')}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
