import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CopyAgentPromptButton } from '@/components/CopyAgentPromptButton';
import { DocumentHead } from '@/components/DocumentHead';
import { LanguageSelector } from '@/components/LanguageSelector';
import { LecternMascot } from '@/components/LecternMascot';
import { SiteFooter } from '@/components/SiteFooter';
import { site } from '@/content/site';
import { useLandingMascotMood } from '@/hooks/useCopilotMascotMood';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/en';
import { markEnteredFromLanding, studioPathFromLanding } from '@/lib/analytics-consent';
import { LECTERN_MEDIA } from '@/lib/media';
import { conversionCloudInquiry } from '@/lib/product-events';

const STUDIO_FROM_HOME = studioPathFromLanding(site.studioPath);

const TOOL_TICKER = [
  'lectern_list_gaps',
  'lectern_upsert_section',
  'lectern_upsert_quiz_item',
  'lectern_publish_lesson',
  'lectern_get_section',
  'lectern_add_annotation',
  'lectern_set_mode',
  'lectern_get_lesson',
];

const TOOL_CARDS: ReadonlyArray<{ name: string; hint: MessageKey }> = [
  { name: 'lectern_list_gaps', hint: 'landing.tool.gaps' },
  { name: 'lectern_upsert_section', hint: 'landing.tool.section' },
  { name: 'lectern_upsert_quiz_item', hint: 'landing.tool.quiz' },
  { name: 'lectern_publish_lesson', hint: 'landing.tool.publish' },
  { name: 'lectern_get_section', hint: 'landing.tool.get' },
  { name: 'lectern_add_annotation', hint: 'landing.tool.note' },
] as const;

/**
 * Google Flow clip at /public/media/landing/hero-loop.mp4
 * Dual-layer crossfade (same pattern as koha-tech KineticHero).
 * Poster/fallback is the first decoded frame of that clip (WebP).
 */
const HERO_LOOP_SRC = '/media/landing/hero-loop.mp4';
const HERO_POSTER_SRC = '/media/landing/hero-poster.webp';
const HERO_FADE_LEAD_S = 1.4;

function prepareInlineVideo(video: HTMLVideoElement): void {
  video.muted = true;
  video.defaultMuted = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
}

function LandingHeroStage() {
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const activeRef = useRef<'a' | 'b'>('a');
  const fadingRef = useRef(false);
  const [activeIsA, setActiveIsA] = useState(true);
  const [videoOk, setVideoOk] = useState(true);
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    if (reduceMotion || !videoOk) return;

    const videoA = videoARef.current;
    const videoB = videoBRef.current;
    if (!videoA || !videoB) return;

    let cancelled = false;
    prepareInlineVideo(videoA);
    prepareInlineVideo(videoB);

    const activeVideo = () => (activeRef.current === 'a' ? videoA : videoB);
    const nextVideo = () => (activeRef.current === 'a' ? videoB : videoA);

    const startNext = (source: HTMLVideoElement) => {
      if (source !== activeVideo() || fadingRef.current) return;

      fadingRef.current = true;
      const next = nextVideo();
      next.currentTime = 0;
      void next.play().catch(() => undefined);

      activeRef.current = activeRef.current === 'a' ? 'b' : 'a';
      setActiveIsA(activeRef.current === 'a');

      window.setTimeout(() => {
        source.pause();
        fadingRef.current = false;
      }, HERO_FADE_LEAD_S * 1000);
    };

    const maybeCrossfade = (source: HTMLVideoElement) => {
      if (!Number.isFinite(source.duration) || source.duration <= HERO_FADE_LEAD_S) return;
      const remaining = source.duration - source.currentTime;
      if (remaining > HERO_FADE_LEAD_S) return;
      startNext(source);
    };

    const onA = () => maybeCrossfade(videoA);
    const onB = () => maybeCrossfade(videoB);
    const endedA = () => startNext(videoA);
    const endedB = () => startNext(videoB);

    const tryPlay = () => {
      if (cancelled) return;
      if (videoA.ended || (Number.isFinite(videoA.duration) && videoA.duration > 0 && videoA.currentTime >= videoA.duration - 0.05)) {
        videoA.currentTime = 0;
      }
      void videoA.play().catch(() => undefined);
    };

    videoA.addEventListener('timeupdate', onA);
    videoB.addEventListener('timeupdate', onB);
    videoA.addEventListener('ended', endedA);
    videoB.addEventListener('ended', endedB);
    videoA.addEventListener('canplay', tryPlay);
    videoA.addEventListener('loadeddata', tryPlay);
    tryPlay();

    return () => {
      cancelled = true;
      videoA.removeEventListener('timeupdate', onA);
      videoB.removeEventListener('timeupdate', onB);
      videoA.removeEventListener('ended', endedA);
      videoB.removeEventListener('ended', endedB);
      videoA.removeEventListener('canplay', tryPlay);
      videoA.removeEventListener('loadeddata', tryPlay);
    };
  }, [reduceMotion, videoOk]);

  const fadeMs = Math.round(HERO_FADE_LEAD_S * 1000);
  const showVideo = videoOk && !reduceMotion;

  return (
    <div className="landing-stage" aria-hidden>
      <img className="landing-stage-still" src={HERO_POSTER_SRC} alt="" />
      {showVideo ? (
        <>
          <video
            ref={videoARef}
            className="landing-stage-video"
            style={{
              opacity: activeIsA ? 1 : 0,
              transition: `opacity ${fadeMs}ms ease-in-out`,
            }}
            src={HERO_LOOP_SRC}
            muted
            autoPlay
            playsInline
            preload="auto"
            poster={HERO_POSTER_SRC}
            onError={() => setVideoOk(false)}
          />
          <video
            ref={videoBRef}
            className="landing-stage-video"
            style={{
              opacity: activeIsA ? 0 : 1,
              transition: `opacity ${fadeMs}ms ease-in-out`,
            }}
            src={HERO_LOOP_SRC}
            muted
            playsInline
            preload="auto"
            poster={HERO_POSTER_SRC}
          />
        </>
      ) : null}
      <div className="landing-stage-wash" />
      <div className="landing-stage-grain" />
    </div>
  );
}

function shouldOpenStudio(search: string): boolean {
  const params = new URLSearchParams(search);
  return Boolean(params.get('mode') || params.get('l') || params.get('from') || params.get('demo'));
}

function isNativeWebMcp(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.__lecternWebMcpDemo?.isPolyfill) return false;
  return Boolean(document.modelContext || navigator.modelContext);
}

function LandingNav() {
  const { t } = useI18n();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`landing-nav ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="landing-nav-inner">
        <div className="landing-brand-cluster">
          <a href="#top" className="landing-brand">
            <img className="landing-brand-mark" src="/logo.png" alt="Lectern" />
            <span className="landing-brand-name">Lectern</span>
          </a>
          <a
            className="landing-brand-github"
            href={site.githubUrl}
            target="_blank"
            rel="noreferrer"
          >
            {t('landing.ctaGithub')}
          </a>
        </div>
        <nav className="landing-nav-links" aria-label="Landing">
          <a href="#product">{t('landing.nav.product')}</a>
          <a href="#how">{t('landing.nav.how')}</a>
          <a href="#open">{t('landing.nav.open')}</a>
        </nav>
        <div className="flex items-center gap-3">
          <LanguageSelector />
          <Link className="landing-nav-cta" to={STUDIO_FROM_HOME}>
            {t('landing.nav.studio')}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function LandingPage() {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const ticker = [...TOOL_TICKER, ...TOOL_TICKER];
  const mascot = useLandingMascotMood();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('stay') === '1') {
      markEnteredFromLanding();
      return;
    }
    if (shouldOpenStudio(location.search) || isNativeWebMcp()) {
      navigate(`${site.studioPath}${location.search}`, { replace: true });
      return;
    }
    markEnteredFromLanding();
  }, [location.search, navigate]);

  return (
    <div className="landing grain min-h-screen" id="top">
      <DocumentHead page="home" />
      <LandingNav />

      <section className="landing-hero">
        <LandingHeroStage />
        <div className="landing-hero-copy">
          <p className="landing-eyebrow">{t('landing.eyebrow')}</p>
          <h1 className="landing-headline">
            {t('landing.headlineLead')} <em>{t('landing.headlineAccent')}</em>
          </h1>
          <p className="landing-lede">{t('landing.lede')}</p>
          <div className="landing-actions">
            <Link className="landing-btn landing-btn-primary" to={STUDIO_FROM_HOME}>
              {t('landing.ctaStudio')}
            </Link>
            <CopyAgentPromptButton />
            <a
              className="landing-btn landing-btn-star"
              href={site.githubUrl}
              target="_blank"
              rel="noreferrer"
            >
              {t('landing.ctaStar')}
            </a>
          </div>
          <p className="landing-copy-hint">{t('landing.ctaCopyPromptHint')}</p>
          <ul className="landing-proof">
            <li>{t('landing.proofOss')}</li>
            <li>{t('landing.proofAccount')}</li>
            <li>{t('landing.proofWebmcp')}</li>
          </ul>
        </div>
        <div className="landing-hero-shelf">
          <article className="landing-hero-card">
            <img src={LECTERN_MEDIA.draft.src} alt={t('media.draft.alt')} />
            <p>
              {t('media.draft.title')} — {t('media.draft.blurb')}
            </p>
          </article>
          <article className="landing-hero-card">
            <img src={LECTERN_MEDIA.copilot.src} alt={t('media.copilot.alt')} />
            <p>
              {t('media.copilot.title')} — {t('media.copilot.blurb')}
            </p>
          </article>
          <article className="landing-hero-card">
            <img src={LECTERN_MEDIA.publish.src} alt={t('media.publish.alt')} />
            <p>
              {t('media.publish.title')} — {t('media.publish.blurb')}
            </p>
          </article>
        </div>
      </section>

      <div className="landing-marquee" aria-hidden>
        <div className="landing-marquee-track">
          {ticker.map((name, i) => (
            <span key={`${name}-${i}`}>{name}</span>
          ))}
        </div>
      </div>

      <blockquote className="landing-quote">{t('landing.quote')}</blockquote>

      <section className="landing-section" id="how">
        <p className="landing-kicker">{t('landing.howEyebrow')}</p>
        <h2 className="landing-h2">{t('landing.howTitle')}</h2>
        <div className="landing-mascot-row">
          <button
            type="button"
            className="lectern-mascot-hit landing-mascot-hit"
            onClick={() => mascot.nudge()}
            aria-label={t('landing.mascot.hi')}
          >
            <LecternMascot
              state={mascot.mood}
              size="showcase"
              alt={t('copilot.mascotAlt')}
              onEnded={mascot.clearOneShot}
            />
          </button>
          <div className="landing-mascot-copy">
            <p className="landing-mascot-pull">{t('landing.mascot.pull')}</p>
            <p>{t('landing.mascot.body')}</p>
            <div className="landing-actions">
              <Link className="landing-btn landing-btn-primary" to={STUDIO_FROM_HOME}>
                {t('landing.ctaStudio')}
              </Link>
              <CopyAgentPromptButton />
            </div>
          </div>
        </div>
        <div className="landing-steps">
          <article className="landing-step">
            <div className="landing-step-num">01</div>
            <h3>{t('landing.how1Title')}</h3>
            <p>{t('landing.how1Body')}</p>
          </article>
          <article className="landing-step">
            <div className="landing-step-num">02</div>
            <h3>{t('landing.how2Title')}</h3>
            <p>{t('landing.how2Body')}</p>
          </article>
          <article className="landing-step">
            <div className="landing-step-num">03</div>
            <h3>{t('landing.how3Title')}</h3>
            <p>{t('landing.how3Body')}</p>
          </article>
        </div>
      </section>

      <section className="landing-section pt-0" id="product">
        <p className="landing-kicker">{t('landing.splitEyebrow')}</p>
        <h2 className="landing-h2 mb-10">{t('landing.splitTitle')}</h2>
        <div className="landing-split">
          <article className="landing-panel">
            <img src={LECTERN_MEDIA.draft.src} alt={t('media.draft.alt')} />
            <div className="landing-panel-body">
              <p className="landing-kicker">{t('landing.teacherKicker')}</p>
              <h3>{t('landing.teacherTitle')}</h3>
              <p>{t('landing.teacherBody')}</p>
            </div>
          </article>
          <article className="landing-panel">
            <img src={LECTERN_MEDIA.student.src} alt={t('media.student.alt')} />
            <div className="landing-panel-body">
              <p className="landing-kicker">{t('landing.studentKicker')}</p>
              <h3>{t('landing.studentTitle')}</h3>
              <p>{t('landing.studentBody')}</p>
            </div>
          </article>
        </div>
      </section>

      <section className="landing-band">
        <div className="landing-section">
          <p className="landing-kicker">{t('landing.toolsEyebrow')}</p>
          <h2 className="landing-h2">{t('landing.toolsTitle')}</h2>
          <p className="landing-band-lede">{t('landing.toolsLede')}</p>
          <div className="landing-tools">
            {TOOL_CARDS.map((tool) => (
              <div className="landing-tool" key={tool.name}>
                <code>{tool.name}</code>
                <span>{t(tool.hint)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section" id="open">
        <p className="landing-kicker">{t('landing.ossEyebrow')}</p>
        <div className="landing-license">
          <div>
            <h2 className="landing-h2">{t('landing.ossTitle')}</h2>
            <p className="mt-4 max-w-xl text-[1.05rem] leading-relaxed text-walnut">
              {t('landing.ossBody')}
            </p>
            <div className="landing-actions">
              <a
                className="landing-btn landing-btn-star"
                href={site.githubUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t('landing.ctaStar')}
              </a>
              <Link className="landing-btn landing-btn-ghost !border-forest/20 !text-forest" to="/license">
                {t('footer.readLicense')}
              </Link>
            </div>
          </div>
          <aside className="landing-license-cloud">
            <div>
              <h3>{t('landing.cloudTitle')}</h3>
              <p>{t('landing.cloudBody')}</p>
            </div>
            <a
              className="landing-btn landing-btn-primary self-start"
              href={site.cloudMailto}
              onClick={() => conversionCloudInquiry('landing')}
            >
              {t('landing.cloudCta')}
            </a>
          </aside>
        </div>
      </section>

      <section className="landing-final landing-section">
        <h2 className="landing-h2">{t('landing.finalTitle')}</h2>
        <p>{t('landing.finalLede')}</p>
        <div className="landing-actions">
          <Link className="landing-btn landing-btn-primary" to={STUDIO_FROM_HOME}>
            {t('landing.ctaStudio')}
          </Link>
          <CopyAgentPromptButton />
          <a
            className="landing-btn landing-btn-star"
            href={site.githubUrl}
            target="_blank"
            rel="noreferrer"
          >
            {t('landing.ctaStar')}
          </a>
        </div>
        <p className="landing-ai">{t('landing.aiNotice')}</p>
      </section>

      <SiteFooter />
    </div>
  );
}
