import type { ReactNode, Ref } from 'react';
import { LessonProse } from '@/components/LessonProse';
import { useI18n } from '@/i18n/I18nProvider';
import { isBuiltinSectionKind, sectionKindClassName } from '@/lib/section-kind';
import type { SectionKind } from '@/types/lesson';

const KIND_KEY = {
  material: 'manuscript.kind.material',
  example: 'manuscript.kind.example',
  summary: 'manuscript.kind.summary',
} as const;

export function ManuscriptPage({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`manuscript-page relative ${className}`}>
      <div className="manuscript-rule" aria-hidden />
      {children}
    </div>
  );
}

export function ManuscriptTitle({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="manuscript-title">
      <p className="manuscript-eyebrow">{eyebrow}</p>
      <div className="manuscript-title-main">{title}</div>
      {subtitle ? <div className="manuscript-subtitle">{subtitle}</div> : null}
      {children}
    </header>
  );
}

export function ManuscriptObjectives({ items }: { items: string[] }) {
  const { t } = useI18n();
  if (items.length === 0) return null;
  return (
    <div className="manuscript-objectives">
      <h2 className="manuscript-aside-label">{t('manuscript.learningGoals')}</h2>
      <ol>
        {items.map((item) => (
          <li key={item}>
            <LessonProse source={item} inline />
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ManuscriptSection({
  kind,
  index,
  title,
  children,
  footer,
  actions,
  besideKind,
  kindControl,
  readRootRef,
  reading = false,
}: {
  kind: SectionKind;
  index: number;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  actions?: ReactNode;
  besideKind?: ReactNode;
  kindControl?: ReactNode;
  readRootRef?: Ref<HTMLDivElement>;
  reading?: boolean;
}) {
  const { t } = useI18n();
  const kindLabel = isBuiltinSectionKind(kind) ? t(KIND_KEY[kind]) : kind;
  return (
    <article
      className={`manuscript-section ${sectionKindClassName(kind)}${reading ? ' is-reading-aloud' : ''}`}
    >
      <div className="manuscript-section-meta">
        <span className="manuscript-section-num">{String(index + 1).padStart(2, '0')}</span>
        {kindControl ? (
          <div className="manuscript-section-kind-control">{kindControl}</div>
        ) : (
          <span className="manuscript-section-kind">{kindLabel}</span>
        )}
        {besideKind ? <div className="manuscript-section-beside-kind">{besideKind}</div> : null}
        {actions ? <div className="manuscript-section-actions">{actions}</div> : null}
      </div>
      <div className="manuscript-section-read-root" ref={readRootRef}>
        <h2 className="manuscript-section-title">{title}</h2>
        <div className="manuscript-section-body">{children}</div>
      </div>
      {footer ? <div className="manuscript-section-footer">{footer}</div> : null}
    </article>
  );
}

export function ManuscriptQuizFrame({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  const { t } = useI18n();
  return (
    <section className="manuscript-quiz">
      <h2 className="manuscript-section-title">{title ?? t('manuscript.quizTitle')}</h2>
      <p className="manuscript-quiz-lede">{t('manuscript.quizLede')}</p>
      {children}
    </section>
  );
}

/** Compact nested check after a section — short label, no end-quiz lede. */
export function ManuscriptSectionCheck({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="manuscript-section-check">
      <h3 className="manuscript-section-check-title">{t('manuscript.sectionCheckTitle')}</h3>
      {children}
    </div>
  );
}
