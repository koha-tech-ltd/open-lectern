import type { ReactNode } from 'react';
import { LECTERN_MEDIA, type LecternMediaId } from '@/lib/media';

export function LessonStartBanner({
  mediaId,
  eyebrow,
  title,
  body,
  children,
  articleTarget,
  copyTarget,
  extraTargets,
}: {
  mediaId: LecternMediaId;
  eyebrow: string;
  title: string;
  body: string;
  children?: ReactNode;
  articleTarget?: string;
  copyTarget?: string;
  extraTargets?: readonly string[];
}) {
  const media = LECTERN_MEDIA[mediaId];

  return (
    <article className="lesson-start-banner" data-lectern-target={articleTarget}>
      <div className="lesson-start-banner-hero">
        <img className="lesson-start-banner-art" src={media.src} alt="" />
        <div className="lesson-start-banner-wash" aria-hidden />
        <div className="lesson-start-banner-brand">
          <img className="lesson-start-banner-mark" src="/logo.png" alt="" />
          <span className="lesson-start-banner-name">Lectern</span>
        </div>
      </div>
      <div className="lesson-start-banner-copy" data-lectern-target={copyTarget}>
        <p className="lesson-start-banner-eyebrow">{eyebrow}</p>
        <h2 className="lesson-start-banner-title">{title}</h2>
        <p className="lesson-start-banner-lede">{body}</p>
        {children}
      </div>
      {extraTargets && extraTargets.length > 0 ? (
        <div className="sr-only" aria-hidden>
          {extraTargets.map((target) => (
            <div key={target} data-lectern-target={target} />
          ))}
        </div>
      ) : null}
    </article>
  );
}
