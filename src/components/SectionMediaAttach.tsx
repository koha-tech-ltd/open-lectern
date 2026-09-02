import { useRef, useState, type DragEvent } from 'react';
import { SectionMediaTemplates } from '@/components/SectionMediaTemplates';
import { fileToSectionMedia, urlToPersistedSectionMedia } from '@/lib/section-media';
import type { SectionMedia, SectionMediaKind } from '@/types/lesson';
import { useI18n } from '@/i18n/I18nProvider';

export function SectionMediaAttach({
  onAdd,
  imageOnly = false,
  showTemplates = true,
}: {
  onAdd: (media: SectionMedia) => void;
  imageOnly?: boolean;
  showTemplates?: boolean;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [urlKind, setUrlKind] = useState<SectionMediaKind>('image');
  const [busy, setBusy] = useState(false);
  const [figureOpen, setFigureOpen] = useState(false);

  const ingestFiles = async (files: FileList | File[]) => {
    setError(null);
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const result = await fileToSectionMedia(file);
        if (!result.ok) {
          setError(result.error);
          break;
        }
        if (imageOnly && result.media.kind !== 'image') {
          setError(t('attach.visualCardsImages'));
          break;
        }
        onAdd(result.media);
      }
    } finally {
      setBusy(false);
    }
  };

  const dropProps = {
    onDragEnter: (e: DragEvent) => {
      e.preventDefault();
      setDragOver(true);
    },
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      setDragOver(true);
    },
    onDragLeave: () => setDragOver(false),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files?.length) void ingestFiles(e.dataTransfer.files);
    },
  };

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept={imageOnly ? 'image/*' : 'image/*,video/*,.svg,.mp4,.webm'}
      multiple
      className="hidden"
      onChange={(e) => {
        if (e.target.files?.length) void ingestFiles(e.target.files);
        e.target.value = '';
      }}
    />
  );

  const urlRow = (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {imageOnly ? null : (
        <select
          className="rounded-md border border-walnut/15 bg-cream px-2 py-1 text-xs"
          value={urlKind}
          onChange={(e) => setUrlKind(e.target.value as SectionMediaKind)}
        >
          <option value="image">{t('attach.imageUrl')}</option>
          <option value="video">{t('attach.videoUrl')}</option>
        </select>
      )}
      <input
        className="min-w-[12rem] flex-1 rounded-md border border-walnut/15 bg-cream px-2 py-1 text-xs outline-none focus:border-brass"
        placeholder={t('attach.urlPlaceholder')}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <button
        type="button"
        className="rounded-md border border-forest/20 bg-forest px-2 py-1 text-xs font-medium text-cream"
        disabled={busy}
        onClick={() => {
          void (async () => {
            setBusy(true);
            setError(null);
            try {
              const result = await urlToPersistedSectionMedia(url, imageOnly ? 'image' : urlKind);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              if (imageOnly && result.media.kind !== 'image') {
                setError(t('attach.visualCardsImages'));
                return;
              }
              onAdd(result.media);
              setUrl('');
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        {t('attach.addUrl')}
      </button>
    </div>
  );

  const dropHint = busy ? t('attach.attaching') : imageOnly ? t('attach.dropImage') : t('attach.dropFile');

  if (!showTemplates) {
    return (
      <div className="section-media-attach">
        <div className={`section-media-drop ${dragOver ? 'is-over' : ''}`} {...dropProps}>
          <p className="text-sm text-walnut">{dropHint}</p>
          <button
            type="button"
            className="mt-2 rounded-md border border-walnut/20 bg-ivory px-3 py-1.5 text-xs font-medium text-forest"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {t('attach.media')}
          </button>
          {fileInput}
        </div>
        {urlRow}
        {error ? <p className="mt-1 text-xs text-walnut">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="section-media-attach">
      <div className={`section-media-drop section-media-tools ${dragOver ? 'is-over' : ''}`} {...dropProps}>
        <div className="section-media-tool-row">
          <button
            type="button"
            className="section-media-tool"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            <AttachIcon />
            <span>{t('attach.media')}</span>
          </button>
          <button
            type="button"
            className={`section-media-tool ${figureOpen ? 'is-active' : ''}`}
            onClick={() => setFigureOpen((value) => !value)}
          >
            <FigureIcon />
            <span>{figureOpen ? t('templates.hide') : t('templates.create')}</span>
          </button>
        </div>
        <p className="section-media-tool-hint">{dropHint}</p>
        {fileInput}
      </div>

      {figureOpen ? (
        <SectionMediaTemplates onAdd={onAdd} onClose={() => setFigureOpen(false)} />
      ) : null}

      {urlRow}
      {error ? <p className="mt-1 text-xs text-walnut">{error}</p> : null}
    </div>
  );
}

function AttachIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="3.5" y="5" width="17" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M3.5 16.2 8.2 11.8l3.2 3.1 3.1-3.4 6 4.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="16.4" cy="9.2" r="1.35" fill="currentColor" />
    </svg>
  );
}

function FigureIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="9.2" cy="13.2" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12.2 5.2 19.6 18.2H4.8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
