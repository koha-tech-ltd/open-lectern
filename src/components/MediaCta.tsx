import { LECTERN_MEDIA, type LecternMediaId } from '@/lib/media';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/en';

const MEDIA_COPY: Record<LecternMediaId, { alt: MessageKey; title: MessageKey; blurb: MessageKey }> = {
  draft: { alt: 'media.draft.alt', title: 'media.draft.title', blurb: 'media.draft.blurb' },
  copilot: { alt: 'media.copilot.alt', title: 'media.copilot.title', blurb: 'media.copilot.blurb' },
  publish: { alt: 'media.publish.alt', title: 'media.publish.title', blurb: 'media.publish.blurb' },
  student: { alt: 'media.student.alt', title: 'media.student.title', blurb: 'media.student.blurb' },
  mark: { alt: 'media.mark.alt', title: 'media.mark.title', blurb: 'media.mark.blurb' },
};

export function MediaCta({
  id,
  actionLabel,
  onAction,
  compact = false,
  blurb,
}: {
  id: LecternMediaId;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
  blurb?: string;
}) {
  const { t } = useI18n();
  const media = LECTERN_MEDIA[id];
  const copy = MEDIA_COPY[id];

  return (
    <article
      className={`overflow-hidden rounded-2xl border border-walnut/10 bg-ivory shadow-lectern ${
        compact ? '' : 'flex flex-col'
      }`}
    >
      <div className={`relative overflow-hidden bg-cream ${compact ? 'aspect-[4/3]' : 'aspect-[16/10]'}`}>
        <img
          src={media.src}
          alt={t(copy.alt)}
          className={`h-full w-full object-cover ${media.imageClass ?? ''}`}
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className={compact ? 'p-3' : 'flex flex-1 flex-col p-4 sm:p-5'}>
        <h3 className="font-display text-lg text-forest sm:text-xl">{t(copy.title)}</h3>
        <p className="mt-1 text-sm text-walnut">{blurb ?? t(copy.blurb)}</p>
        {actionLabel && onAction ? (
          <button
            type="button"
            className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-forest px-3 py-2.5 text-sm font-semibold text-cream transition hover:bg-moss sm:mt-4"
            onClick={onAction}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </article>
  );
}
