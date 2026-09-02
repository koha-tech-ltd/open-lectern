import { useEffect, useState } from 'react';
import type { SectionMedia } from '@/types/lesson';
import { useI18n } from '@/i18n/I18nProvider';

function isAiVisual(item: SectionMedia): boolean {
  return /(?:^|[-_])ai(?:[._-]|$)/i.test(item.src) || /ai[- ]?generated/i.test(item.name ?? '');
}

export function MediaLightbox({
  media,
  activeId,
  articleTitle,
  onChangeActive,
  onClose,
}: {
  media: SectionMedia[];
  activeId: string | null;
  articleTitle: string;
  onChangeActive: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const activeIndex = Math.max(0, media.findIndex((item) => item.id === activeId));
  const activeItem = activeId ? media[activeIndex] ?? null : null;

  useEffect(() => {
    if (!activeItem) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const rtl = document.documentElement.dir === 'rtl';
      const goPrev = event.key === 'ArrowLeft' ? !rtl : rtl;
      const nextIndex = goPrev
        ? (activeIndex - 1 + media.length) % media.length
        : (activeIndex + 1) % media.length;
      onChangeActive(media[nextIndex].id);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, activeItem, media, onChangeActive, onClose]);

  if (!activeItem) return null;

  const previous = () => onChangeActive(media[(activeIndex - 1 + media.length) % media.length].id);
  const next = () => onChangeActive(media[(activeIndex + 1) % media.length].id);

  return (
    <div className="media-lightbox" role="dialog" aria-modal="true" aria-label={t('gallery.aria', { title: articleTitle })}>
      <button type="button" className="media-lightbox-backdrop" aria-label={t('gallery.closeAria')} onClick={onClose} />
      <div className="media-lightbox-panel">
        <div className="media-lightbox-toolbar">
          <p>{t('gallery.of', { title: articleTitle, current: activeIndex + 1, total: media.length })}</p>
          <button type="button" onClick={onClose}>{t('gallery.close')}</button>
        </div>
        <div className="media-lightbox-content">
          {activeItem.kind === 'video' ? (
            <video src={activeItem.src} controls autoPlay playsInline>
              <track kind="captions" />
            </video>
          ) : (
            <img src={activeItem.src} alt={activeItem.alt} />
          )}
        </div>
        <div className="media-lightbox-footer">
          <div>
            <p className="font-medium">{activeItem.alt}</p>
            {activeItem.caption ? <p>{activeItem.caption}</p> : null}
            {isAiVisual(activeItem) ? <p className="media-lightbox-ai">{t('gallery.aiNotice')}</p> : null}
          </div>
          {media.length > 1 ? (
            <div className="media-lightbox-nav">
              <button type="button" onClick={previous} aria-label={t('gallery.previousAria')}>{t('gallery.previous')}</button>
              <button type="button" onClick={next} aria-label={t('gallery.nextAria')}>{t('gallery.next')}</button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function SectionMediaGallery({
  items,
  galleryItems,
  articleTitle = 'Lesson media',
  editable = false,
  onCaption,
  onRemove,
}: {
  items: SectionMedia[];
  /** All visual material in the lesson. A selected section item opens this full gallery. */
  galleryItems?: SectionMedia[];
  articleTitle?: string;
  editable?: boolean;
  onCaption?: (id: string, caption: string) => void;
  onRemove?: (id: string) => void;
}) {
  const { t } = useI18n();
  const media = galleryItems?.length ? galleryItems : items;
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);

  const openGallery = (id: string) => setActiveMediaId(id);

  if (!items.length) return null;

  return (
    <>
      <div className="section-media-gallery">
      {items.map((item) => (
        <figure key={item.id} className="section-media-card">
          {item.kind === 'video' ? (
            <>
              <video className="section-media-frame" src={item.src} controls playsInline preload="metadata">
                <track kind="captions" />
              </video>
              <button type="button" className="section-media-gallery-open" onClick={() => openGallery(item.id)}>
                {t('gallery.open')}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="section-media-launch"
              onClick={() => openGallery(item.id)}
              aria-label={t('gallery.openAria', { alt: item.alt })}
            >
              <img className="section-media-frame" src={item.src} alt={item.alt} loading="lazy" />
              <span>{t('gallery.view')}</span>
            </button>
          )}
          {editable ? (
            <div className="section-media-edit">
              <input
                className="section-media-caption-input"
                value={item.caption ?? ''}
                placeholder={t('gallery.caption')}
                onChange={(e) => onCaption?.(item.id, e.target.value)}
              />
              <button type="button" className="section-media-remove" onClick={() => onRemove?.(item.id)}>
                {t('gallery.remove')}
              </button>
            </div>
          ) : item.caption ? (
            <figcaption className="section-media-caption">{item.caption}</figcaption>
          ) : null}
          {isAiVisual(item) ? (
            <p className="mt-2 text-xs leading-relaxed text-walnut/70" role="note">
              {t('gallery.aiNotice')}
            </p>
          ) : null}
        </figure>
      ))}
      </div>

      <MediaLightbox
        media={media}
        activeId={activeMediaId}
        articleTitle={articleTitle}
        onChangeActive={setActiveMediaId}
        onClose={() => setActiveMediaId(null)}
      />
    </>
  );
}
