import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  analyzeGaps,
  createDemoById,
  createEmptyLesson,
  createId,
  decodeLessonFromShare,
  DEMO_LESSON_IDS,
  demoIdFromLessonId,
  hydrateStoredLesson,
  isDemoLessonId,
  isSparseLesson,
  listLibraryItems,
  loadLibraryLesson,
  loadStoredLesson,
  nowIso,
  parseDemoQueryParam,
  quizItemsForSection,
  removeLibraryLesson,
  saveStoredLesson,
  SITE_URL,
  upsertLibraryLesson,
  type LecternDemoId,
  type LibraryListItem,
} from '@/lib/lesson';
import { ALLOW_PDF_RESTORE_AUTHORING } from '@/lib/product-flags';
import { hydrateLessonCas } from '@/lib/amdp-lectern';
import { recordUserActivity, setActivityLesson, setActivitySnapshotSource, discardActivityFuture } from '@/lib/agent-activity';
import { decodeRestoreInput } from '@/lib/restore-codec';
import { trackDemoLoaded } from '@/lib/product-events';
import type {
  Annotation,
  LessonDocument,
  LessonMode,
  LessonSection,
  QuizItem,
  SectionKind,
  SectionMedia,
} from '@/types/lesson';

function readModeFromUrl(): LessonMode {
  const params = new URLSearchParams(window.location.search);
  return params.get('mode') === 'student' ? 'student' : 'teacher';
}

function readLessonFromUrl(): LessonDocument | null {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('l');
  if (!token) return null;
  return decodeLessonFromShare(token);
}

function readDemoIdFromUrl(): LecternDemoId | null {
  const params = new URLSearchParams(window.location.search);
  return parseDemoQueryParam(params.get('demo'));
}

function bump(lesson: LessonDocument): LessonDocument {
  return { ...lesson, version: lesson.version + 1, updatedAt: nowIso() };
}

function initialLessonDocument(): LessonDocument {
  const fromUrl = readLessonFromUrl();
  if (fromUrl) return fromUrl;
  const demoId = readDemoIdFromUrl();
  if (demoId) return createDemoById(demoId);
  return loadStoredLesson() ?? createEmptyLesson();
}

function studioUrl(): string {
  return `${SITE_URL}/studio`;
}

const AUTHORING_SESSION_KEY = 'lectern.authoring.v1';

function readAuthoringSession(): boolean {
  try {
    return sessionStorage.getItem(AUTHORING_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function writeAuthoringSession(value: boolean) {
  try {
    sessionStorage.setItem(AUTHORING_SESSION_KEY, value ? '1' : '0');
  } catch {
    /* private mode */
  }
}

function publishShareHints() {
  return {
    studioUrl: studioUrl(),
    student: 'Export a Lectern PDF from the Export panel. Students upload it in Save & load to study.',
    teacher: 'Download a .lectern file to keep writing. Teacher mode reopens from a Lectern file, not from the PDF.',
  };
}

export function useLessonStore() {
  const [mode, setModeState] = useState<LessonMode>(() => readModeFromUrl());
  const [lesson, setLesson] = useState<LessonDocument>(() => initialLessonDocument());
  const [libraryItems, setLibraryItems] = useState<LibraryListItem[]>(() => listLibraryItems());
  const [authoring, setAuthoringState] = useState(() => readAuthoringSession());

  // Synchronous mirrors so chained WebMCP tool calls see prior mutations immediately.
  const modeRef = useRef(mode);
  const lessonRef = useRef(lesson);
  /** PDF / LCT1 (or URL token) student session kept apart from the teacher draft when the flag is off. */
  const studentSessionRef = useRef<LessonDocument | null>(null);
  const studentSessionBooted = useRef(false);
  if (!studentSessionBooted.current) {
    studentSessionBooted.current = true;
    if (
      !ALLOW_PDF_RESTORE_AUTHORING &&
      mode === 'student' &&
      (readLessonFromUrl() !== null || readDemoIdFromUrl() !== null)
    ) {
      studentSessionRef.current = lesson;
    }
  }
  /** Blocks teacher persist while hydrating the authoring tab after leaving a PDF session. */
  const suppressTeacherPersistRef = useRef(false);
  const applyingHistoryRef = useRef(false);

  useEffect(() => {
    setActivitySnapshotSource(() => lessonRef.current);
    return () => setActivitySnapshotSource(() => null);
  }, []);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    lessonRef.current = lesson;
  }, [lesson]);

  useEffect(() => {
    setActivityLesson(lesson.id);
  }, [lesson.id]);

  useEffect(() => {
    if (readLessonFromUrl() || readDemoIdFromUrl()) return;
    if (studentSessionRef.current) return;
    void hydrateStoredLesson().then(async (stored) => {
      if (!stored) return;
      if (modeRef.current === 'student' && studentSessionRef.current) return;
      lessonRef.current = stored;
      setLesson(stored);
      void hydrateLessonCas(stored);
      await upsertLibraryLesson(stored);
      setLibraryItems(listLibraryItems());
    });
  }, []);

  useEffect(() => {
    if (mode !== 'teacher') return;
    if (suppressTeacherPersistRef.current) return;
    void saveStoredLesson(lesson).then(() => upsertLibraryLesson(lesson)).then(() => {
      setLibraryItems(listLibraryItems());
    });
  }, [lesson, mode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('mode', mode);
    if (mode === 'teacher') {
      params.delete('l');
    }
    const demoId = demoIdFromLessonId(lesson.id);
    if (demoId && !params.get('l')) {
      params.set('demo', demoId);
    } else if (!demoId) {
      params.delete('demo');
    }
    const next = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', next);
  }, [mode, lesson.id]);

  const gaps = useMemo(() => analyzeGaps(lesson), [lesson]);
  const readOnly = mode === 'student';

  const mutate = useCallback((updater: (prev: LessonDocument) => LessonDocument) => {
    if (!applyingHistoryRef.current) {
      discardActivityFuture();
    }
    const next = bump(updater(lessonRef.current));
    lessonRef.current = next;
    if (modeRef.current === 'student' && studentSessionRef.current) {
      studentSessionRef.current = next;
    }
    if (modeRef.current === 'teacher') {
      suppressTeacherPersistRef.current = false;
    }
    setLesson(next);
    return next;
  }, []);

  const setMode = useCallback((next: LessonMode) => {
    if (next === modeRef.current) return;

    if (!ALLOW_PDF_RESTORE_AUTHORING && next === 'teacher' && studentSessionRef.current) {
      studentSessionRef.current = lessonRef.current;
      suppressTeacherPersistRef.current = true;
      const stored = loadStoredLesson();
      const teacherLesson = stored ?? createEmptyLesson();
      lessonRef.current = teacherLesson;
      setLesson(teacherLesson);
      modeRef.current = 'teacher';
      setModeState('teacher');
      void hydrateStoredLesson().then((hydrated) => {
        if (modeRef.current !== 'teacher') return;
        if (hydrated) {
          lessonRef.current = hydrated;
          setLesson(hydrated);
          void hydrateLessonCas(hydrated);
        }
        suppressTeacherPersistRef.current = false;
      });
      return;
    }

    if (!ALLOW_PDF_RESTORE_AUTHORING && next === 'student' && studentSessionRef.current) {
      lessonRef.current = studentSessionRef.current;
      setLesson(studentSessionRef.current);
      modeRef.current = 'student';
      setModeState('student');
      return;
    }

    modeRef.current = next;
    setModeState(next);
  }, []);

  const applyLesson = useCallback((next: LessonDocument) => {
    studentSessionRef.current = null;
    suppressTeacherPersistRef.current = false;
    lessonRef.current = next;
    modeRef.current = 'teacher';
    setActivityLesson(next.id);
    recordUserActivity({
      action: 'project.open',
      summary: next.meta.title.trim() || next.id,
      targets: ['meta'],
      lesson: next,
    });
    setLesson(next);
    setModeState('teacher');
    void hydrateLessonCas(next);
  }, []);

  const applyHistoryLesson = useCallback((next: LessonDocument) => {
    applyingHistoryRef.current = true;
    studentSessionRef.current = null;
    suppressTeacherPersistRef.current = false;
    lessonRef.current = next;
    setLesson(next);
    void hydrateLessonCas(next);
    applyingHistoryRef.current = false;
  }, []);

  const enterAuthoring = useCallback(() => {
    writeAuthoringSession(true);
    setAuthoringState(true);
  }, []);

  useEffect(() => {
    if (!isSparseLesson(lesson)) enterAuthoring();
  }, [lesson, enterAuthoring]);

  const persistCurrent = useCallback(async (discardSparse = false) => {
    const current = lessonRef.current;
    if (discardSparse && isSparseLesson(current)) {
      await removeLibraryLesson(current.id);
      setLibraryItems(listLibraryItems());
      return;
    }
    await saveStoredLesson(current);
    await upsertLibraryLesson(current);
    setLibraryItems(listLibraryItems());
  }, []);

  const loadDemo = useCallback(async (id: LecternDemoId = 'photosynthesis') => {
    if (lessonRef.current.id === DEMO_LESSON_IDS[id]) return;
    await persistCurrent(true);
    applyLesson(createDemoById(id));
    trackDemoLoaded(id);
  }, [applyLesson, persistCurrent]);

  const resetDemo = useCallback(() => {
    void loadDemo('photosynthesis');
  }, [loadDemo]);

  const newLesson = useCallback(async () => {
    enterAuthoring();
    if (isSparseLesson(lessonRef.current)) {
      const current = lessonRef.current;
      return {
        ok: true as const,
        alreadyBlank: true,
        lessonId: current.id,
        title: current.meta.title.trim() || 'Untitled lesson',
      };
    }
    await persistCurrent(false);
    applyLesson(createEmptyLesson());
    const next = lessonRef.current;
    return {
      ok: true as const,
      alreadyBlank: false,
      lessonId: next.id,
      title: next.meta.title.trim() || 'Untitled lesson',
    };
  }, [applyLesson, enterAuthoring, persistCurrent]);

  const openLibraryLesson = useCallback(
    async (id: string) => {
      enterAuthoring();
      if (id === lessonRef.current.id) {
        return {
          ok: true as const,
          alreadyOpen: true,
          lessonId: id,
          title: lessonRef.current.meta.title.trim() || 'Untitled lesson',
        };
      }
      await persistCurrent(true);
      const loaded = await loadLibraryLesson(id);
      if (!loaded) return { ok: false as const, error: 'Lesson not found on this device.' };
      applyLesson(loaded);
      return {
        ok: true as const,
        alreadyOpen: false,
        lessonId: loaded.id,
        title: loaded.meta.title.trim() || 'Untitled lesson',
      };
    },
    [applyLesson, enterAuthoring, persistCurrent],
  );

  const switchLesson = useCallback(
    async (id: string) => {
      const trimmed = id.trim();
      if (!trimmed) return { ok: false as const, error: 'id is required' };
      const demo = parseDemoQueryParam(trimmed) ?? demoIdFromLessonId(trimmed);
      if (demo) {
        const alreadyOpen = lessonRef.current.id === DEMO_LESSON_IDS[demo];
        if (!alreadyOpen) await loadDemo(demo);
        const next = lessonRef.current;
        return {
          ok: true as const,
          alreadyOpen,
          source: 'demo' as const,
          demo,
          lessonId: next.id,
          title: next.meta.title.trim() || 'Untitled lesson',
        };
      }
      const opened = await openLibraryLesson(trimmed);
      if (!opened.ok) return opened;
      return {
        ok: true as const,
        alreadyOpen: opened.alreadyOpen,
        source: 'library' as const,
        lessonId: opened.lessonId,
        title: opened.title,
      };
    },
    [loadDemo, openLibraryLesson],
  );

  const saveToLibrary = useCallback(async () => {
    await persistCurrent(false);
    const current = lessonRef.current;
    return {
      ok: true as const,
      lessonId: current.id,
      title: current.meta.title.trim() || 'Untitled lesson',
      sparse: isSparseLesson(current),
    };
  }, [persistCurrent]);

  const deleteLibraryLesson = useCallback(
    async (id: string) => {
      const currentId = lessonRef.current.id;
      await removeLibraryLesson(id);
      if (id === currentId) {
        const remaining = listLibraryItems().find(
          (item) => item.id !== id && !isDemoLessonId(item.id) && !item.sparse,
        );
        if (remaining) {
          const loaded = await loadLibraryLesson(remaining.id);
          applyLesson(loaded ?? createEmptyLesson());
        } else {
          applyLesson(createEmptyLesson());
        }
      }
      setLibraryItems(listLibraryItems());
    },
    [applyLesson],
  );

  const setMeta = useCallback(
    (patch: Partial<LessonDocument['meta']>) => {
      if (modeRef.current === 'student') {
        return { ok: false as const, error: 'Student mode is read-only for lesson content.' };
      }
      mutate((prev) => ({ ...prev, meta: { ...prev.meta, ...patch } }));
      return { ok: true as const };
    },
    [mutate],
  );

  const upsertSection = useCallback(
    (input: {
      id?: string;
      title: string;
      body: string;
      kind?: SectionKind;
      order?: number;
      media?: SectionMedia[];
    }) => {
      if (modeRef.current === 'student') {
        return { ok: false as const, error: 'Student mode cannot edit sections.' };
      }
      let sectionId = input.id;
      mutate((prev) => {
        const sections = [...prev.sections];
        const idx = input.id ? sections.findIndex((s) => s.id === input.id) : -1;
        if (idx >= 0) {
          sections[idx] = {
            ...sections[idx],
            title: input.title,
            body: input.body,
            kind: input.kind ?? sections[idx].kind,
            order: input.order ?? sections[idx].order,
            media: input.media ?? sections[idx].media,
          };
          sectionId = sections[idx].id;
        } else {
          const created: LessonSection = {
            id: createId('sec'),
            title: input.title,
            body: input.body,
            kind: input.kind ?? 'material',
            order: input.order ?? sections.length,
            media: input.media ?? [],
          };
          sectionId = created.id;
          sections.push(created);
        }
        return { ...prev, sections: sections.sort((a, b) => a.order - b.order) };
      });
      if (!input.id) {
        recordUserActivity({
          action: 'section.add',
          summary: input.title.trim() || sectionId || '',
          targets: sectionId ? [`section:${sectionId}`, 'materials'] : ['materials'],
        });
      }
      return { ok: true as const, sectionId };
    },
    [mutate],
  );

  const addSectionMedia = useCallback(
    (sectionId: string, media: SectionMedia) => {
      if (modeRef.current === 'student') {
        return { ok: false as const, error: 'Student mode cannot attach media.' };
      }
      const section = lessonRef.current.sections.find((s) => s.id === sectionId);
      if (!section) return { ok: false as const, error: 'Unknown section.' };
      const nextMedia = [...(section.media ?? []), media];
      mutate((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId ? { ...s, media: nextMedia } : s,
        ),
      }));
      recordUserActivity({
        action: 'media.add',
        summary: media.alt || media.name || media.id,
        targets: [`media:${media.id}`, `section:${sectionId}`, 'materials'],
      });
      return { ok: true as const, mediaId: media.id };
    },
    [mutate],
  );

  const updateSectionMedia = useCallback(
    (sectionId: string, mediaId: string, patch: Partial<Pick<SectionMedia, 'caption' | 'alt'>>) => {
      if (modeRef.current === 'student') {
        return { ok: false as const, error: 'Student mode cannot edit media.' };
      }
      mutate((prev) => ({
        ...prev,
        sections: prev.sections.map((s) => {
          if (s.id !== sectionId) return s;
          return {
            ...s,
            media: (s.media ?? []).map((m) => (m.id === mediaId ? { ...m, ...patch } : m)),
          };
        }),
      }));
      recordUserActivity({
        action: 'media.caption',
        summary: patch.caption?.trim() || patch.alt?.trim() || mediaId,
        targets: [`media:${mediaId}`, `section:${sectionId}`, 'materials'],
      });
      return { ok: true as const };
    },
    [mutate],
  );

  const removeSectionMedia = useCallback(
    (sectionId: string, mediaId: string) => {
      if (modeRef.current === 'student') {
        return { ok: false as const, error: 'Student mode cannot remove media.' };
      }
      mutate((prev) => ({
        ...prev,
        sections: prev.sections.map((s) => {
          if (s.id !== sectionId) return s;
          return { ...s, media: (s.media ?? []).filter((m) => m.id !== mediaId) };
        }),
      }));
      recordUserActivity({
        action: 'media.remove',
        summary: mediaId,
        targets: [`media:${mediaId}`, `section:${sectionId}`, 'materials'],
      });
      return { ok: true as const };
    },
    [mutate],
  );

  const removeSection = useCallback(
    (id: string) => {
      if (modeRef.current === 'student') {
        return { ok: false as const, error: 'Student mode cannot delete sections.' };
      }
      const section = lessonRef.current.sections.find((s) => s.id === id);
      mutate((prev) => ({
        ...prev,
        sections: prev.sections.filter((s) => s.id !== id),
        annotations: prev.annotations.filter((a) => a.sectionId !== id),
        quiz: prev.quiz.filter((q) => q.sectionId !== id),
      }));
      recordUserActivity({
        action: 'section.remove',
        summary: section?.title.trim() || id,
        targets: ['materials'],
      });
      return { ok: true as const };
    },
    [mutate],
  );

  const upsertQuizItem = useCallback(
    (input: {
      id?: string;
      prompt: string;
      choices: string[];
      choiceMedia?: Array<SectionMedia | null>;
      answerIndex: number;
      explanation?: string;
      order?: number;
      /**
       * Omit to leave placement unchanged on update (or create end-of-lesson).
       * Pass null or '' to move to end-of-lesson. Pass a known section id to nest.
       */
      sectionId?: string | null;
    }) => {
      if (modeRef.current === 'student') {
        return { ok: false as const, error: 'Student mode cannot edit quiz items.' };
      }
      if (input.choices.length < 2) {
        return { ok: false as const, error: 'Provide at least two choices.' };
      }
      if (input.answerIndex < 0 || input.answerIndex >= input.choices.length) {
        return { ok: false as const, error: 'answerIndex must point at a choice.' };
      }
      const sectionIdProvided = Object.prototype.hasOwnProperty.call(input, 'sectionId');
      let nextSectionId: string | undefined;
      if (sectionIdProvided) {
        const raw =
          input.sectionId === null || input.sectionId === undefined
            ? ''
            : String(input.sectionId).trim();
        if (raw) {
          const exists = lessonRef.current.sections.some((s) => s.id === raw);
          if (!exists) {
            return {
              ok: false as const,
              error: `sectionId "${raw}" does not match a section. Use a real section id or omit sectionId for the end-of-lesson quiz.`,
            };
          }
          nextSectionId = raw;
        } else {
          nextSectionId = undefined;
        }
      }
      let quizId = input.id;
      mutate((prev) => {
        const quiz = [...prev.quiz];
        const idx = input.id ? quiz.findIndex((q) => q.id === input.id) : -1;
        if (idx >= 0) {
          const updated: QuizItem = {
            ...quiz[idx],
            prompt: input.prompt,
            choices: input.choices,
            choiceMedia: input.choiceMedia ?? quiz[idx].choiceMedia,
            answerIndex: input.answerIndex,
            explanation: input.explanation ?? quiz[idx].explanation,
            order: input.order ?? quiz[idx].order,
          };
          if (sectionIdProvided) {
            if (nextSectionId) {
              updated.sectionId = nextSectionId;
            } else {
              delete updated.sectionId;
            }
          }
          quiz[idx] = updated;
          quizId = quiz[idx].id;
        } else {
          const created: QuizItem = {
            id: createId('q'),
            prompt: input.prompt,
            choices: input.choices,
            choiceMedia: input.choiceMedia,
            answerIndex: input.answerIndex,
            explanation: input.explanation ?? '',
            order: input.order ?? quiz.length,
            ...(sectionIdProvided && nextSectionId ? { sectionId: nextSectionId } : {}),
          };
          quizId = created.id;
          quiz.push(created);
        }
        return { ...prev, quiz: quiz.sort((a, b) => a.order - b.order) };
      });
      if (!input.id) {
        recordUserActivity({
          action: 'quiz.add',
          summary: input.prompt.trim() || quizId || '',
          targets: quizId ? [`quiz:${quizId}`, 'quiz'] : ['quiz'],
        });
      }
      return { ok: true as const, quizId };
    },
    [mutate],
  );

  const removeQuizItem = useCallback(
    (id: string) => {
      if (modeRef.current === 'student') {
        return { ok: false as const, error: 'Student mode cannot delete quiz items.' };
      }
      const quiz = lessonRef.current.quiz.find((q) => q.id === id);
      mutate((prev) => ({ ...prev, quiz: prev.quiz.filter((q) => q.id !== id) }));
      recordUserActivity({
        action: 'quiz.remove',
        summary: quiz?.prompt.trim() || id,
        targets: ['quiz'],
      });
      return { ok: true as const };
    },
    [mutate],
  );

  const addAnnotation = useCallback(
    (sectionId: string, note: string, kind: 'learned' | 'note' = 'note') => {
      if (modeRef.current !== 'student') {
        return { ok: false as const, error: 'Annotations are for student mode.' };
      }
      if (!lessonRef.current.sections.some((s) => s.id === sectionId)) {
        return { ok: false as const, error: 'Unknown sectionId.' };
      }
      const trimmed = note.trim();
      const resolvedNote = kind === 'learned' ? (trimmed || 'Learned') : trimmed;
      if (!resolvedNote) {
        return { ok: false as const, error: 'Annotation note cannot be empty.' };
      }
      const annotation: Annotation = {
        id: createId('note'),
        sectionId,
        note: resolvedNote,
        kind,
        createdAt: nowIso(),
      };
      mutate((prev) => ({ ...prev, annotations: [...prev.annotations, annotation] }));
      recordUserActivity({
        action: 'annotation',
        summary: resolvedNote.slice(0, 80),
        targets: [`section:${sectionId}`, 'annotations'],
      });
      return { ok: true as const, annotation };
    },
    [mutate],
  );

  const publish = useCallback(() => {
    if (modeRef.current === 'student') {
      return { ok: false as const, error: 'Already in student mode.' };
    }
    const current = lessonRef.current;
    const currentGaps = analyzeGaps(current);
    const blockers = currentGaps.filter((g) => g.severity === 'blocker');
    if (blockers.length > 0) {
      return {
        ok: false as const,
        error: 'Fix blocker gaps before publishing.',
        gaps: currentGaps,
      };
    }
    mutate((prev) => ({ ...prev, published: true }));
    recordUserActivity({
      action: 'publish',
      summary: current.meta.title.trim() || current.id,
      targets: ['publish', 'gaps'],
    });
    return { ok: true as const, ...publishShareHints(), gaps: currentGaps };
  }, [mutate]);

  const importLesson = useCallback((next: LessonDocument, asStudent = true) => {
    const cleaned: LessonDocument = {
      ...next,
      published: true,
      annotations: Array.isArray(next.annotations) ? next.annotations : [],
      updatedAt: nowIso(),
    };
    if (cleaned.id === lessonRef.current.id) discardActivityFuture();
    lessonRef.current = cleaned;
    setActivityLesson(cleaned.id);
    recordUserActivity({
      action: 'import',
      summary: cleaned.meta.title.trim() || cleaned.id,
      targets: ['import', 'meta', 'materials'],
      lesson: cleaned,
    });
    setLesson(cleaned);
    void hydrateLessonCas(cleaned);
    if (asStudent) {
      if (!ALLOW_PDF_RESTORE_AUTHORING) {
        studentSessionRef.current = cleaned;
      }
      modeRef.current = 'student';
      setModeState('student');
    }
    return {
      ok: true as const,
      title: cleaned.meta.title,
      sections: cleaned.sections.length,
      quiz: cleaned.quiz.length,
    };
  }, []);

  const importRestorePayload = useCallback(
    (raw: string) => {
      const decoded = decodeRestoreInput(raw);
      if (!decoded.ok) {
        return {
          ok: false as const,
          error: decoded.error,
          progress: decoded.progress,
        };
      }
      if (decoded.source === 'lectern-file') {
        const cleaned: LessonDocument = {
          ...decoded.lesson,
          annotations: Array.isArray(decoded.lesson.annotations) ? decoded.lesson.annotations : [],
          updatedAt: nowIso(),
        };
        if (cleaned.id === lessonRef.current.id) discardActivityFuture();
        studentSessionRef.current = null;
        suppressTeacherPersistRef.current = false;
        lessonRef.current = cleaned;
        setActivityLesson(cleaned.id);
        recordUserActivity({
          action: 'import',
          summary: cleaned.meta.title.trim() || cleaned.id,
          targets: ['import', 'meta', 'materials'],
          lesson: cleaned,
        });
        setLesson(cleaned);
        void hydrateLessonCas(cleaned);
        modeRef.current = 'teacher';
        setModeState('teacher');
        return {
          ok: true as const,
          title: cleaned.meta.title,
          sections: cleaned.sections.length,
          quiz: cleaned.quiz.length,
          source: decoded.source,
        };
      }
      const loaded = importLesson(decoded.lesson, true);
      return { ...loaded, source: decoded.source };
    },
    [importLesson],
  );

  const getSection = useCallback((sectionId: string) => {
    const section = lessonRef.current.sections.find((s) => s.id === sectionId);
    if (!section) return { ok: false as const, error: 'Section not found.' };
    const quiz = quizItemsForSection(lessonRef.current, sectionId);
    return { ok: true as const, section, quiz };
  }, []);

  return {
    mode,
    setMode,
    lesson,
    libraryItems,
    authoring,
    enterAuthoring,
    gaps,
    readOnly,
    // Live snapshots for WebMCP proxy (avoids stale React closures mid tool-chain).
    getLiveMode: () => modeRef.current,
    getLiveLesson: () => lessonRef.current,
    getLiveGaps: () => analyzeGaps(lessonRef.current),
    resetDemo,
    loadDemo,
    newLesson,
    openLibraryLesson,
    switchLesson,
    saveToLibrary,
    deleteLibraryLesson,
    getLiveLibraryItems: () => listLibraryItems(),
    setMeta,
    upsertSection,
    addSectionMedia,
    updateSectionMedia,
    removeSectionMedia,
    removeSection,
    upsertQuizItem,
    removeQuizItem,
    addAnnotation,
    publish,
    importLesson,
    importRestorePayload,
    applyHistoryLesson,
    getSection,
  };
}

export type LessonStore = ReturnType<typeof useLessonStore>;
