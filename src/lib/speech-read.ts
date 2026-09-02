import type { LocaleCode } from '@/i18n/locales';

export type SpeechReadSnapshot = {
  blockId: string | null;
  status: 'idle' | 'speaking';
  doubleSpeed: boolean;
};

type WordMark = {
  start: number;
  end: number;
  node: Text;
  localStart: number;
  localEnd: number;
};

type Session = {
  blockId: string;
  root: HTMLElement;
  locale: string;
  fullText: string;
  wordCount: number;
  utterance: SpeechSynthesisUtterance;
  keepAlive: number | null;
  fallback: number | null;
  charIndex: number;
  charLength: number;
  textOffset: number;
  doubleSpeed: boolean;
  speakToken: number;
  onViewport: (() => void) | null;
};

const NORMAL_RATE = 0.94;
const DOUBLE_RATE = 2;

const SKIP_CLOSEST =
  '[data-read-aloud-skip], button, .katex, .katex-display, .katex-html, script, style, svg, .read-aloud-cta, .read-aloud-speed, .read-aloud-controls, .section-media-gallery, .manuscript-section-footer';

const BLOCK_CLOSEST = 'p, h1, h2, h3, h4, li, td, th, blockquote, aside, pre, figcaption';

const SPEECH_LANG: Record<LocaleCode, string> = {
  en: 'en-US',
  es: 'es-ES',
  'pt-BR': 'pt-BR',
  'zh-Hans': 'zh-CN',
  hi: 'hi-IN',
  ar: 'ar-SA',
  ja: 'ja-JP',
  ko: 'ko-KR',
  fr: 'fr-FR',
  de: 'de-DE',
  uk: 'uk-UA',
  tr: 'tr-TR',
  vi: 'vi-VN',
  id: 'id-ID',
  th: 'th-TH',
  it: 'it-IT',
  pl: 'pl-PL',
};

let snapshot: SpeechReadSnapshot = { blockId: null, status: 'idle', doubleSpeed: false };
const listeners = new Set<() => void>();
let session: Session | null = null;
let startGeneration = 0;
let overlay: HTMLDivElement | null = null;

function emit(next: SpeechReadSnapshot): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

export function subscribeSpeechRead(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSpeechReadSnapshot(): SpeechReadSnapshot {
  return snapshot;
}

export function getServerSpeechReadSnapshot(): SpeechReadSnapshot {
  return { blockId: null, status: 'idle', doubleSpeed: false };
}

export function isSpeechReadSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function';
}

export function speechLangFor(locale: LocaleCode): string {
  return SPEECH_LANG[locale] ?? 'en-US';
}

function notifyVoices(): Promise<SpeechSynthesisVoice[]> {
  const existing = window.speechSynthesis.getVoices();
  if (existing.length > 0) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const done = () => resolve(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    window.setTimeout(done, 400);
  });
}

function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined {
  const lower = lang.toLowerCase();
  const prefix = lower.split('-')[0] ?? lower;
  const scored = voices
    .map((voice) => {
      const vLang = voice.lang.toLowerCase();
      let score = 0;
      if (vLang === lower) score += 40;
      else if (vLang.startsWith(prefix)) score += 24;
      if (voice.localService) score += 8;
      if (voice.default) score += 2;
      if (/natural|neural|premium|enhanced/i.test(voice.name)) score += 6;
      return { voice, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.score ? scored[0].voice : voices.find((v) => v.default) ?? voices[0];
}

function segmentText(text: string, locale: string): Array<{ segment: string; isWordLike: boolean }> {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    return [...new Intl.Segmenter(locale, { granularity: 'word' }).segment(text)].map((part) => ({
      segment: part.segment,
      isWordLike: Boolean(part.isWordLike),
    }));
  }
  const parts: Array<{ segment: string; isWordLike: boolean }> = [];
  const re = /(\s+|[^\s]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    parts.push({ segment: match[0], isWordLike: /\S/.test(match[0]) });
  }
  return parts;
}

function collectTextNodes(root: HTMLElement): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest(SKIP_CLOSEST)) return NodeFilter.FILTER_REJECT;
      if (!node.textContent) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  return nodes;
}

function blockKey(node: Text): Element | null {
  return node.parentElement?.closest(BLOCK_CLOSEST) ?? node.parentElement;
}

function indexWords(root: HTMLElement, locale: string): { text: string; words: WordMark[] } {
  const words: WordMark[] = [];
  let text = '';
  let prev: Text | null = null;

  for (const node of collectTextNodes(root)) {
    if (prev && blockKey(prev) !== blockKey(node) && !/\s$/.test(text)) {
      text += ' ';
    }
    const raw = node.textContent ?? '';
    let local = 0;
    for (const part of segmentText(raw, locale)) {
      if (part.isWordLike) {
        words.push({
          start: text.length,
          end: text.length + part.segment.length,
          node,
          localStart: local,
          localEnd: local + part.segment.length,
        });
      }
      text += part.segment;
      local += part.segment.length;
    }
    prev = node;
  }

  return { text, words };
}

function wordAt(words: WordMark[], charIndex: number, charLength: number): WordMark | null {
  if (words.length === 0) return null;
  const rangeEnd = charLength > 0 ? charIndex + charLength : charIndex + 1;
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    const nextStart = words[i + 1]?.start ?? Number.POSITIVE_INFINITY;
    const overlaps = word.start < rangeEnd && word.end > charIndex;
    const ownsGap = charLength === 0 && charIndex >= word.start && charIndex < nextStart;
    if (overlaps || ownsGap) return word;
  }
  return words[words.length - 1] ?? null;
}

function ensureOverlay(): HTMLDivElement {
  if (overlay?.isConnected) return overlay;
  overlay = document.createElement('div');
  overlay.className = 'tts-highlight-layer';
  overlay.setAttribute('aria-hidden', 'true');
  document.body.appendChild(overlay);
  return overlay;
}

function clearOverlay(): void {
  overlay?.replaceChildren();
}

function removeOverlay(): void {
  overlay?.remove();
  overlay = null;
}

function rangeForWord(word: WordMark): Range | null {
  if (!word.node.isConnected) return null;
  const length = word.node.data.length;
  const start = Math.max(0, Math.min(word.localStart, length));
  const end = Math.max(start, Math.min(word.localEnd, length));
  const range = document.createRange();
  range.setStart(word.node, start);
  range.setEnd(word.node, end);
  return range;
}

const TRAIL_WORDS = 5;

function paintTrailWord(layer: HTMLDivElement, word: WordMark, step: number): void {
  const range = rangeForWord(word);
  if (!range) return;
  for (const rect of range.getClientRects()) {
    if (rect.width < 1 || rect.height < 1) continue;
    const box = document.createElement('div');
    box.className = `tts-highlight is-trail is-trail-${step}`;
    box.style.left = `${rect.left - 2}px`;
    box.style.top = `${rect.top - 1}px`;
    box.style.width = `${rect.width + 4}px`;
    box.style.height = `${rect.height + 2}px`;
    layer.appendChild(box);
  }
}

function paintCurrentWord(layer: HTMLDivElement, word: WordMark): DOMRect | null {
  const range = rangeForWord(word);
  if (!range) return null;
  const rects = [...range.getClientRects()].filter((rect) => rect.width >= 1 && rect.height >= 1);
  if (rects.length === 0) return null;

  const parent = word.node.parentElement;
  const cs = parent ? getComputedStyle(parent) : null;
  const token = word.node.data.slice(word.localStart, word.localEnd);

  rects.forEach((rect, index) => {
    const padX = 6;
    const padY = 3;
    const chip = document.createElement('div');
    chip.className = 'tts-word-now';
    chip.style.left = `${rect.left - padX}px`;
    chip.style.top = `${rect.top - padY}px`;
    chip.style.width = `${rect.width + padX * 2}px`;
    chip.style.height = `${rect.height + padY * 2}px`;

    const pill = document.createElement('div');
    pill.className = 'tts-highlight is-current';
    chip.appendChild(pill);

    if (index === 0) {
      const glyph = document.createElement('div');
      glyph.className = 'tts-highlight-glyph';
      glyph.textContent = token;
      glyph.style.lineHeight = `${rect.height}px`;
      if (cs) {
        glyph.style.fontFamily = cs.fontFamily;
        glyph.style.fontSize = cs.fontSize;
        glyph.style.fontStyle = cs.fontStyle;
        glyph.style.letterSpacing = cs.letterSpacing;
        const weight = Number.parseInt(cs.fontWeight, 10);
        glyph.style.fontWeight = Number.isFinite(weight) && weight >= 600 ? String(weight) : '600';
      }
      chip.appendChild(glyph);
    }
    layer.appendChild(chip);
  });

  return rects[0];
}

function paintSession(target: Session): void {
  const layer = ensureOverlay();
  layer.replaceChildren();
  if (!target.root.isConnected) return;

  const { words } = indexWords(target.root, target.locale);
  const current = wordAt(words, target.charIndex, target.charLength);
  if (!current) return;

  const currentIndex = words.findIndex(
    (word) => word.node === current.node && word.localStart === current.localStart,
  );
  if (currentIndex < 0) return;

  for (let step = TRAIL_WORDS; step >= 1; step -= 1) {
    const trail = words[currentIndex - step];
    if (!trail) continue;
    paintTrailWord(layer, trail, step);
  }

  paintCurrentWord(layer, current);
}

function clearKeepAlive(target: Session | null): void {
  if (!target) return;
  if (target.keepAlive != null) {
    window.clearInterval(target.keepAlive);
    target.keepAlive = null;
  }
  if (target.fallback != null) {
    window.clearInterval(target.fallback);
    target.fallback = null;
  }
  if (target.onViewport) {
    window.removeEventListener('scroll', target.onViewport, true);
    window.removeEventListener('resize', target.onViewport);
    target.onViewport = null;
  }
}

function finishSession(target: Session | null): void {
  if (!target) return;
  clearKeepAlive(target);
  if (session === target) session = null;
  clearOverlay();
  removeOverlay();
  if (snapshot.blockId === target.blockId) {
    emit({ blockId: null, status: 'idle', doubleSpeed: false });
  }
}

export function stopSpeechRead(): void {
  startGeneration += 1;
  const current = session;
  if (current) {
    clearKeepAlive(current);
    session = null;
  }
  clearOverlay();
  removeOverlay();
  emit({ blockId: null, status: 'idle', doubleSpeed: false });
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

function speechRate(doubleSpeed: boolean): number {
  return doubleSpeed ? DOUBLE_RATE : NORMAL_RATE;
}

function bindUtterance(target: Session, utterance: SpeechSynthesisUtterance, token: number): void {
  let gotBoundary = false;
  const paint = () => {
    if (session === target) paintSession(target);
  };

  utterance.onboundary = (event) => {
    if (session !== target || target.speakToken !== token) return;
    if (event.name && event.name !== 'word') return;
    gotBoundary = true;
    if (target.fallback != null) {
      window.clearInterval(target.fallback);
      target.fallback = null;
    }
    target.charIndex = target.textOffset + event.charIndex;
    target.charLength = event.charLength ?? 0;
    paint();
  };

  utterance.onend = () => {
    if (session !== target || target.speakToken !== token || target.utterance !== utterance) return;
    finishSession(target);
  };

  utterance.onerror = () => {
    if (session !== target || target.speakToken !== token || target.utterance !== utterance) return;
    finishSession(target);
  };

  if (target.keepAlive != null) {
    window.clearInterval(target.keepAlive);
  }
  target.keepAlive = window.setInterval(() => {
    if (session !== target || target.speakToken !== token || !window.speechSynthesis.speaking) return;
    window.speechSynthesis.pause();
    window.speechSynthesis.resume();
  }, 12000);

  if (target.fallback != null) {
    window.clearInterval(target.fallback);
    target.fallback = null;
  }
  const remaining = Math.max(1, target.fullText.length - target.textOffset);
  const step = Math.max(
    3,
    Math.round((remaining / Math.max(8, target.wordCount * 6)) * (target.doubleSpeed ? 2 : 1)),
  );
  target.fallback = window.setInterval(() => {
    if (session !== target || target.speakToken !== token || gotBoundary || !window.speechSynthesis.speaking) {
      return;
    }
    target.charIndex = Math.min(target.fullText.length, target.charIndex + step);
    paint();
  }, 90);
}

function speakNow(target: Session, generation: number, token: number): void {
  window.speechSynthesis.cancel();
  window.setTimeout(() => {
    if (generation !== startGeneration || session !== target || target.speakToken !== token) return;
    window.speechSynthesis.speak(target.utterance);
  }, 40);
}

export function setSpeechDoubleSpeed(on: boolean): void {
  if (snapshot.doubleSpeed === on) return;
  emit({ ...snapshot, doubleSpeed: on });

  const current = session;
  if (!current || snapshot.status !== 'speaking') return;

  current.doubleSpeed = on;
  const remaining = current.fullText.slice(current.charIndex);
  if (!remaining.trim()) return;

  current.speakToken += 1;
  const token = current.speakToken;
  current.textOffset = current.charIndex;

  const utterance = new SpeechSynthesisUtterance(remaining);
  utterance.lang = current.utterance.lang;
  utterance.rate = speechRate(on);
  utterance.pitch = current.utterance.pitch;
  utterance.volume = current.utterance.volume;
  if (current.utterance.voice) utterance.voice = current.utterance.voice;

  current.utterance = utterance;
  bindUtterance(current, utterance, token);
  speakNow(current, startGeneration, token);
}

export async function startSpeechRead(options: {
  blockId: string;
  root: HTMLElement;
  locale: LocaleCode;
}): Promise<void> {
  if (!isSpeechReadSupported()) return;

  stopSpeechRead();
  const generation = startGeneration;

  const lang = speechLangFor(options.locale);
  const voices = await notifyVoices();
  if (generation !== startGeneration) return;
  if (!options.root.isConnected) return;

  const indexed = indexWords(options.root, lang);
  if (!indexed.text.replace(/\s+/g, ' ').trim()) return;

  const utterance = new SpeechSynthesisUtterance(indexed.text);
  utterance.lang = lang;
  utterance.rate = NORMAL_RATE;
  utterance.pitch = 1;
  utterance.volume = 1;
  const voice = pickVoice(voices, lang);
  if (voice) utterance.voice = voice;

  const next: Session = {
    blockId: options.blockId,
    root: options.root,
    locale: lang,
    fullText: indexed.text,
    wordCount: indexed.words.length,
    utterance,
    keepAlive: null,
    fallback: null,
    charIndex: indexed.words[0]?.start ?? 0,
    charLength: 0,
    textOffset: 0,
    doubleSpeed: false,
    speakToken: 1,
    onViewport: null,
  };
  session = next;
  emit({ blockId: options.blockId, status: 'speaking', doubleSpeed: false });

  const paint = () => {
    if (session === next) paintSession(next);
  };
  next.onViewport = paint;
  window.addEventListener('scroll', paint, true);
  window.addEventListener('resize', paint);
  window.requestAnimationFrame(paint);

  bindUtterance(next, utterance, next.speakToken);
  speakNow(next, generation, next.speakToken);
}

export async function toggleSpeechRead(options: {
  blockId: string;
  root: HTMLElement;
  locale: LocaleCode;
}): Promise<void> {
  if (snapshot.status === 'speaking' && snapshot.blockId === options.blockId) {
    stopSpeechRead();
    return;
  }
  await startSpeechRead(options);
}

