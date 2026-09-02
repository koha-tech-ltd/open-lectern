import type { LessonDocument, LessonGap, LessonMode, QuizItem, SectionMedia } from '@/types/lesson';

const viteSiteUrl = (import.meta as ImportMeta & { env?: { VITE_SITE_URL?: string } }).env
  ?.VITE_SITE_URL;

export const SITE_URL = viteSiteUrl?.replace(/\/$/, '') || 'https://lectern.click';

export const STORAGE_KEY = 'lectern.lesson.v1';
export const LIBRARY_INDEX_KEY = 'lectern.library.v1';
const LESSON_STORAGE_VERSION = 2;
const IDB_NAME = 'lectern';
const IDB_STORE = 'drafts';
const IDB_LIBRARY = 'library';
const IDB_KEY = 'teacher-lesson';
const IDB_VERSION = 2;

type StoredLessonRecord = {
  version: typeof LESSON_STORAGE_VERSION;
  savedAt: string;
  lesson: LessonDocument;
};

function parseStoredRecord(raw: string): StoredLessonRecord | null {
  try {
    const parsed = JSON.parse(raw) as LessonDocument | StoredLessonRecord;
    if ('lesson' in parsed && parsed.lesson?.meta && Array.isArray(parsed.lesson.sections)) {
      return parsed as StoredLessonRecord;
    }
    const legacy = parsed as LessonDocument;
    if (legacy?.meta && Array.isArray(legacy.sections)) {
      return {
        version: LESSON_STORAGE_VERSION,
        savedAt: legacy.updatedAt ?? new Date().toISOString(),
        lesson: legacy,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function openLessonDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB unavailable.'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
      if (!db.objectStoreNames.contains(IDB_LIBRARY)) {
        db.createObjectStore(IDB_LIBRARY);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function saveStoredLessonIdb(record: StoredLessonRecord): Promise<void> {
  const db = await openLessonDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('IndexedDB write failed.'));
    };
    tx.objectStore(IDB_STORE).put(record, IDB_KEY);
  });
}

async function loadStoredLessonIdb(): Promise<StoredLessonRecord | null> {
  try {
    const db = await openLessonDb();
    return await new Promise<StoredLessonRecord | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      tx.oncomplete = () => db.close();
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('IndexedDB read failed.'));
      };
      const request = tx.objectStore(IDB_STORE).get(IDB_KEY);
      request.onsuccess = () => {
        const value = request.result as StoredLessonRecord | undefined;
        resolve(value?.lesson?.meta ? value : null);
      };
      request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed.'));
    });
  } catch {
    return null;
  }
}

function pickNewerRecord(a: StoredLessonRecord | null, b: StoredLessonRecord | null): StoredLessonRecord | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a.savedAt) >= Date.parse(b.savedAt) ? a : b;
}

export function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function createEmptyLesson(): LessonDocument {
  const stamp = nowIso();
  return {
    id: createId('lesson'),
    version: 1,
    published: false,
    meta: {
      title: 'Untitled lesson',
      audience: '',
      subject: '',
      objectives: [],
    },
    sections: [],
    quiz: [],
    annotations: [],
    updatedAt: stamp,
  };
}

export function createDemoLesson(): LessonDocument {
  return createPhotosynthesisDemoLesson();
}

/** Photosynthesis teaching demo (biology). */
export function createPhotosynthesisDemoLesson(): LessonDocument {
  const stamp = nowIso();
  const s1 = createId('sec');
  const s2 = createId('sec');
  const s3 = createId('sec');
  const s4 = createId('sec');
  const s5 = createId('sec');
  const s6 = createId('sec');

  return {
    id: createId('lesson'),
    version: 1,
    published: true,
    meta: {
      title: 'Photosynthesis: factories of light',
      audience: 'Grade 8–9 biology · one sitting (~35 min)',
      subject: 'Biology',
      objectives: [
        'Name the inputs and outputs of photosynthesis and locate them in a leaf.',
        'Read the light-response curve $r(I)=r_{\\max}\\frac{I}{I+K}$ in words: linear rise, then saturation.',
        'Explain why “more light” is not always better once $I \\gg K$.',
        'Spot a common misconception and answer a short check for understanding.',
      ],
    },
    sections: [
      {
        id: s1,
        kind: 'material',
        title: 'The leaf as a factory floor',
        body:
          'Imagine a quiet factory that never clocks out. Its raw materials arrive as gas and liquid; its power comes from sunlight; its product is sugar; its exhaust is the oxygen you are breathing right now.\n\n' +
          'That factory is a **leaf**. Photosynthesis converts light energy into chemical energy stored in sugars. In words:\n\n' +
          '> **Definition.** Photosynthesis is the process by which plants (and some other organisms) use light to build sugars from carbon dioxide and water, releasing oxygen.\n\n' +
          'A compact word equation is enough for today:\n\n' +
          '$$\n\\text{carbon dioxide} + \\text{water} \\xrightarrow{\\text{light,\\ chlorophyll}} \\text{sugar} + \\text{oxygen}\n$$\n\n' +
          'Or, with chemical formulas students will meet again in chemistry:\n\n' +
          '$$\n6\\,\\mathrm{CO_2} + 6\\,\\mathrm{H_2O} \\xrightarrow{\\text{light}} \\mathrm{C_6H_{12}O_6} + 6\\,\\mathrm{O_2}\n$$\n\n' +
          'Three leaf parts do the logistics:\n\n' +
          '- **Stomata** — tiny mouth-like openings that take in $\\mathrm{CO_2}$.\n' +
          '- **Veins** — water highways from the roots.\n' +
          '- **Chloroplasts** — green organelles where chlorophyll catches photons and the reaction runs.\n\n' +
          '> **Notation.** We will write light intensity as $I$, a half-saturation constant as $K$, and a maximum rate as $r_{\\max}$.',
        order: 0,
        media: [
          {
            id: createId('media'),
            kind: 'image',
            src: '/media/demo/leaf-factory.png',
            alt: 'Leaf cross-section with stomata, veins, and chloroplasts',
            caption: 'Figure 1 · Leaf logistics: stomata, veins, chloroplasts',
          },
          {
            id: createId('media'),
            kind: 'image',
            src: '/media/demo/equation-visual.png',
            alt: 'Visual of carbon dioxide and water becoming sugar and oxygen',
            caption: 'Figure 2 · Word picture of the photosynthesis equation',
          },
        ],
      },
      {
        id: s2,
        kind: 'material',
        title: 'Why rate matters (not just “it happens”)',
        body:
          'Saying “plants photosynthesize” is like saying “cars move.” True, but not useful for prediction. Biologists ask: **how fast**, and **what limits the speed**?\n\n' +
          'On a dim morning, light is scarce — turn up the lamps (or the sun) and the rate of sugar-making climbs. Past a point, adding still more light barely helps: the plant is already using CO₂ or enzymes as fast as it can.\n\n' +
          '> **Key idea.** Every reaction has a bottleneck. For photosynthesis, light intensity $I$ is often the early bottleneck; later, $\\mathrm{CO_2}$ supply or enzyme capacity takes over.\n\n' +
          'That switch from “light hungry” to “light saturated” is what the next section’s formula captures.',
        order: 1,
        media: [
          {
            id: createId('media'),
            kind: 'image',
            src: '/media/demo/rate-motion.svg',
            alt: 'Animated sketch of rate rising then flattening',
            caption: 'Motion plate · rate climbs with light, then saturates',
          },
          {
            id: createId('media'),
            kind: 'image',
            src: '/media/demo/photosynthesis-reel.gif',
            alt: 'Animated reel of photosynthesis figures',
            caption: 'Reel · leaf, equation, curve, greenhouse (looping)',
          },
        ],
      },
      {
        id: s3,
        kind: 'example',
        title: 'A rate sketch you can read without a calculator',
        body:
          'Here is a simple saturating model used to teach the shape of a light-response curve (not a full biochemical simulation):\n\n' +
          '$$\nr(I) = r_{\\max}\\,\\frac{I}{I + K}\n$$\n\n' +
          'Read it piece by piece:\n\n' +
          '- $r(I)$ — photosynthetic rate at light intensity $I$.\n' +
          '- $r_{\\max}$ — the ceiling rate when light is abundant.\n' +
          '- $K$ — the intensity where the rate is half of $r_{\\max}$ (because $\\frac{K}{K+K}=\\tfrac12$).\n\n' +
          '### Two limiting stories\n\n' +
          '**Dim light** ($I \\ll K$). Then $I+K \\approx K$, so\n\n' +
          '$$\nr(I) \\approx r_{\\max}\\,\\frac{I}{K}\n$$\n\n' +
          'Rate grows **almost linearly** with light — double $I$, nearly double $r$.\n\n' +
          '**Bright light** ($I \\gg K$). Then $I+K \\approx I$, so\n\n' +
          '$$\nr(I) \\approx r_{\\max}\n$$\n\n' +
          'The plant is **light-saturated**. Extra photons do little; CO₂ or enzymes are now the bottleneck.\n\n' +
          '> **Example.** Suppose $r_{\\max}=10$ (arbitrary units) and $K=40$. At $I=10$: $r=10\\cdot\\frac{10}{50}=2$. At $I=200$: $r=10\\cdot\\frac{200}{240}\\approx 8.3$ — already near the ceiling.',
        order: 2,
        media: [
          {
            id: createId('media'),
            kind: 'image',
            src: '/media/demo/light-curve.png',
            alt: 'Graph of saturating light-response curve',
            caption: 'Figure 3 · Light-response curve with K and r_max',
          },
        ],
      },
      {
        id: s4,
        kind: 'example',
        title: 'Worked intuition: greenhouse vs cloudy day',
        body:
          'A grower can raise lamp intensity, but past saturation they waste electricity and risk heat stress.\n\n' +
          '| Situation | Relative $I$ | What the model says |\n' +
          '| --- | --- | --- |\n' +
          '| Heavy cloud cover | $I \\ll K$ | Raising light helps a lot |\n' +
          '| Midday clear sky | $I \\approx$ few $\\times K$ | Gains shrink |\n' +
          '| Overdriven grow lights | $I \\gg K$ | Near $r_{\\max}$; fix CO₂ or cooling instead |\n\n' +
          '> **Misconception.** “Brighter always means more photosynthesis.” False once $I \\gg K$ — the curve flattens.\n\n' +
          '> **Note.** Real leaves also care about temperature, water stress, and CO₂. Today’s model isolates **one** axis — light — so you can see saturation cleanly.',
        order: 3,
        media: [
          {
            id: createId('media'),
            kind: 'image',
            src: '/media/demo/greenhouse.png',
            alt: 'Greenhouse split between dim and saturated light',
            caption: 'Figure 4 · Dim cloud cover vs saturated grow lights',
          },
        ],
      },
      {
        id: s5,
        kind: 'material',
        title: 'Where this sits in the bigger story',
        body:
          'Photosynthesis feeds nearly every food web: sugars become biomass; oxygen renews the atmosphere. Cellular respiration is the reverse direction in spirit — organisms release the chemical energy stored in sugars.\n\n' +
          'You do not need the full Calvin cycle today. You need three durable habits:\n\n' +
          '1. **Name inputs and outputs** without mixing them up.\n' +
          '2. **Point to leaf structures** that move gas, water, and light-capture.\n' +
          '3. **Read a saturating curve** — linear rise, then plateau — and say what that means for a plant (or a greenhouse).\n\n' +
          '> **Definition.** *Light saturation* means further increases in $I$ produce little or no increase in $r(I)$ because another factor limits the rate.',
        order: 4,
      },
      {
        id: s6,
        kind: 'summary',
        title: 'Take home before the quiz',
        body:
          '> **Takeaway.** Materials: vocabulary, the word / chemical equation, leaf logistics, and the rate sketch $r(I)=r_{\\max}\\frac{I}{I+K}$.\n\n' +
          '> **Takeaway.** Tests: the checks below. Knowledge: you can explain *what* happens, *where* in the leaf, and *why* brighter is not always better.\n\n' +
          '- Inputs: $\\mathrm{CO_2}$, $\\mathrm{H_2O}$, light (via chlorophyll).\n' +
          '- Outputs: sugar, $\\mathrm{O_2}$.\n' +
          '- Dim: $r$ climbs with $I$. Bright: $r \\to r_{\\max}$.\n' +
          '- If stuck, ask the co-pilot to explain a section id — then leave a margin mark where the idea still feels fuzzy.',
        order: 5,
        media: [
          {
            id: createId('media'),
            kind: 'image',
            src: '/media/demo/takeaway-cycle.svg',
            alt: 'Cycle diagram of light, water, CO2, sugar, and oxygen',
            caption: 'Figure 5 · Take-home cycle at a glance',
          },
          {
            id: createId('media'),
            kind: 'image',
            src: '/media/demo/cycle-anim.svg',
            alt: 'Animated photosynthesis cycle loop',
            caption: 'Motion · light, CO2, and sugar orbit the leaf',
          },
        ],
      },
    ],
    quiz: [
      {
        id: createId('q'),
        prompt: 'Which pair are the **main inputs** of photosynthesis?',
        choices: [
          'Sugar and oxygen',
          'Carbon dioxide and water',
          'Nitrogen and soil minerals',
          'Heat and chlorophyll alone',
        ],
        answerIndex: 1,
        explanation:
          'CO₂ and H₂O are the reactants. Sugar and O₂ are **products**. Chlorophyll helps capture light; it is not an “input molecule” in the word equation.',
        order: 0,
        sectionId: s1,
      },
      {
        id: createId('q'),
        prompt: 'Stomata primarily help photosynthesis by…',
        choices: [
          'Storing sugar in the roots',
          'Letting CO₂ enter the leaf',
          'Reflecting green light away',
          'Creating the value of $K$ in the formula',
        ],
        answerIndex: 1,
        explanation:
          'Stomata are gas pores. They admit CO₂ (and also allow water vapor to leave — a trade-off plants manage).',
        order: 1,
        sectionId: s1,
      },
      {
        id: createId('q'),
        prompt:
          'In $r(I) = r_{\\max}\\frac{I}{I+K}$, what happens as $I \\to \\infty$?',
        choices: [
          'Rate goes to $0$',
          'Rate grows without bound',
          'Rate approaches $r_{\\max}$',
          'Rate equals $K$',
        ],
        answerIndex: 2,
        explanation:
          'Divide numerator and denominator by $I$: $\\frac{I}{I+K}=\\frac{1}{1+K/I}\\to 1$ as $I\\to\\infty$. So $r\\to r_{\\max}$ (light saturation).',
        order: 0,
        sectionId: s3,
      },
      {
        id: createId('q'),
        prompt: 'When $I \\ll K$, the model says the rate is approximately…',
        choices: [
          '$r_{\\max}$ (already saturated)',
          'linear in $I$: roughly $r_{\\max}\\,I/K$',
          'zero, because there is no light',
          'equal to $K$',
        ],
        answerIndex: 1,
        explanation:
          'If $I$ is much smaller than $K$, then $I+K\\approx K$, so $r(I)\\approx r_{\\max} I/K$ — nearly proportional to light.',
        order: 1,
        sectionId: s3,
      },
      {
        id: createId('q'),
        prompt: 'A greenhouse is already past light saturation. The *best* next lever is usually…',
        choices: [
          'Double lamp intensity again',
          'Improve CO₂, water, or cooling / enzyme conditions instead of more light',
          'Remove all chlorophyll',
          'Block stomata to save water only',
        ],
        answerIndex: 1,
        explanation:
          'Past saturation, $r$ is near $r_{\\max}$. Extra light wastes energy; other limiting factors (CO₂, water, temperature) matter more.',
        order: 0,
      },
    ],
    annotations: [],
    updatedAt: stamp,
  };
}

export type LecternDemoId = 'photosynthesis' | 'webmcp' | 'cossacks';

export const DEMO_LESSON_IDS: Record<LecternDemoId, string> = {
  photosynthesis: 'demo-photosynthesis',
  webmcp: 'demo-webmcp',
  cossacks: 'demo-cossacks',
};

export const LECTERN_DEMO_IDS: readonly LecternDemoId[] = [
  'photosynthesis',
  'webmcp',
  'cossacks',
];

export function isDemoLessonId(id: string): boolean {
  return (Object.values(DEMO_LESSON_IDS) as string[]).includes(id);
}

export function parseDemoQueryParam(value: string | null | undefined): LecternDemoId | null {
  if (!value) return null;
  return (LECTERN_DEMO_IDS as readonly string[]).includes(value) ? (value as LecternDemoId) : null;
}

export function demoIdFromLessonId(lessonId: string): LecternDemoId | null {
  for (const id of LECTERN_DEMO_IDS) {
    if (DEMO_LESSON_IDS[id] === lessonId) return id;
  }
  return null;
}

/** Canonical student study URL for a built-in demo (short, shareable). */
export function demoShareUrl(id: LecternDemoId, mode: LessonMode = 'student'): string {
  return `${SITE_URL}/studio?demo=${encodeURIComponent(id)}&mode=${mode}`;
}

export function createWebMcpDemoLesson(): LessonDocument {
  const stamp = nowIso();
  const s1 = createId('sec');
  const s2 = createId('sec');
  const s3 = createId('sec');
  const s4 = createId('sec');
  const s5 = createId('sec');
  const s6 = createId('sec');
  const figure = (src: string, alt: string, caption: string): SectionMedia => ({
    id: createId('media'),
    kind: 'image',
    src,
    name: src.split('/').pop(),
    alt,
    caption,
  });

  return {
    id: createId('lesson'),
    version: 1,
    published: true,
    meta: {
      title: 'WebMCP explained: agents that act on the page',
      audience: 'Teachers, builders, and curious students · ~30 min',
      subject: 'WebMCP · AI + the browser',
      objectives: [
        'Define WebMCP in one sentence: a page registers tools; an AI agent can call them.',
        'Contrast “chat about a page” with “agent changes this Lectern lesson.”',
        'Name the teacher loop: draft → list gaps → expand → review → publish.',
        'Describe what students can do with WebMCP (read, mark, ask) without editing materials.',
      ],
    },
    sections: [
      {
        id: s1,
        kind: 'material',
        title: 'What WebMCP is (and is not)',
        body:
          'Most AI chats can *talk* about a website. **WebMCP** goes further: the website itself exposes a small set of **tools** to the agent, so the agent can *do work on the live page* — with your permission and review.\n\n' +
          '> **Definition.** WebMCP (Web Model Context Protocol) lets a browser page register named tools on `document.modelContext`. A compatible agent (for example ChatGPT in an in-app browser, or Chrome with WebMCP testing enabled) can discover and call those tools.\n\n' +
          'On Lectern, those tools are things like “get the lesson,” “list gaps,” “upsert a section,” “add a quiz item,” “publish a student link,” or (for students) “leave a mark.”\n\n' +
          '> **Misconception.** WebMCP is not “paste the HTML into the chat.” The agent calls **structured tools**; Lectern updates the manuscript you see.\n\n' +
          '> **Note.** You still own the lesson. The co-pilot panel shows what the agent touched so you can accept, edit, or undo by rewriting.',
        order: 0,
        media: [
          figure(
            '/media/demo/webmcp-bridge.svg',
            'Diagram of an AI agent connected to Lectern page tools',
            'Figure 1 · Agent ↔ page bridge via registered tools',
          ),
        ],
      },
      {
        id: s2,
        kind: 'material',
        title: 'Why teachers care',
        body:
          'A good lesson is **materials** and **tests** — and at the end, it brings **knowledge**. Drafting all of that alone is slow. WebMCP lets you keep authorship while an agent helps fill thin sections, sources, and checks.\n\n' +
          '### The efficient path\n\n' +
          '1. **You** sketch the title, audience, and a rough opening.\n' +
          '2. **You** ask the agent (in ChatGPT / WebMCP browser) to `lectern_list_gaps` and expand weak sections.\n' +
          '3. **You** watch the co-pilot log and the highlighted section on the page.\n' +
          '4. **You** publish when the checklist is clear — or export a PDF with a text restore pack on system pages.\n\n' +
          '> **Key idea.** WebMCP shortens the distance between “I know what I want to teach” and “students have a complete page to study.”',
        order: 1,
        media: [
          figure(
            '/media/demo/webmcp-loop.svg',
            'Draft to co-pilot to publish loop',
            'Figure 2 · Human stays in the loop',
          ),
          figure(
            '/media/demo/webmcp-copilot.svg',
            'Manuscript attention highlight next to the co-pilot event stream',
            'Figure 3 · Same page: highlight plus tool log',
          ),
        ],
      },
      {
        id: s3,
        kind: 'example',
        title: 'Worked demo: fill a thin lesson with tools',
        body:
          'Suppose you only typed a title and one short paragraph. Ask the agent something like:\n\n' +
          '> “Open Lectern tools. Call `lectern_list_gaps`, then `lectern_upsert_section` to expand the opening into textbook prose with a **Definition** callout and one display equation if useful. Add two quiz items with `lectern_upsert_quiz_item`.”\n\n' +
          '### What should happen on the page\n\n' +
          '| Step | Tool | What you see |\n' +
          '| --- | --- | --- |\n' +
          '| 1 | `lectern_get_lesson` | Agent understands current meta / sections |\n' +
          '| 2 | `lectern_list_gaps` | Co-pilot checklist updates |\n' +
          '| 3 | `lectern_upsert_section` | Manuscript prose appears; attention highlights the section |\n' +
          '| 4 | `lectern_generate_section_media` | Schematic or animated figure from a catalog template |\n' +
          '| 5 | `lectern_upsert_quiz_item` | Tests appear under Check for understanding |\n' +
          '| 6 | `lectern_publish_lesson` | Student link is ready |\n\n' +
          '> **Example.** If a section is still thin, copy its **Copy reference** button (or ask: “Use `lectern_get_section` on that id”), then rewrite it with sources and a **Takeaway**.\n\n' +
          '> **Notation.** Tool names are stable strings. Prefer exact names from the Registered WebMCP tools list in the OpenAI WebMCP Challenge footer.',
        order: 2,
        media: [
          figure(
            '/media/demo/webmcp-tools.svg',
            'Map of Lectern WebMCP tools',
            'Figure 4 · Core Lectern tools at a glance',
          ),
        ],
      },
      {
        id: s4,
        kind: 'material',
        title: 'Teacher tools vs student tools',
        body:
          'Lectern switches the tool set when you change **Teacher / Student** mode.\n\n' +
          '### Teacher (author)\n\n' +
          '- Shape meta: `lectern_set_meta`\n' +
          '- Write materials: `lectern_upsert_section` (`kind` is material, example, summary, or a custom short label when those do not fit), attach figures: `lectern_attach_section_media`, AMDP `lectern_offer_media` / `lectern_bind_media`, or chunked `lectern_begin_media_upload` / `lectern_append_media_chunk` / `lectern_commit_media_upload` (data URL on the lesson for PDF draw + LCT1 restore)\n' +
          '- Generate schematics: `lectern_list_media_templates` then `lectern_generate_section_media` (30 presets + custom SVG)\n' +
          '- Build tests: `lectern_upsert_quiz_item`\n' +
          '- Ship: `lectern_publish_lesson`, or grab restore data: `lectern_get_restore_payload`\n' +
          '- Save & load: `lectern_list_library`, switch with `lectern_switch_lesson`, save `.lectern` with `lectern_save_lesson`\n\n' +
          '### Student (learn)\n\n' +
          '- Materials are **read-only**\n' +
          '- Leave marks: `lectern_add_annotation`\n' +
          '- Ask the agent to explain a section after `lectern_get_section` (paste a **Copy reference** from that material)\n' +
          '- Import a PDF pack: `lectern_import_restore`\n\n' +
          '> **Warning.** Students should not get editing tools. If the agent tries to upsert sections in student mode, Lectern refuses — that is intentional.',
        order: 3,
        media: [
          figure(
            '/media/demo/webmcp-modes.svg',
            'Teacher catalog versus student catalog',
            'Figure 5 · Mode change re-registers the tool list',
          ),
        ],
      },
      {
        id: s5,
        kind: 'example',
        title: 'How to run this lesson live',
        body:
          'Use this page itself as the lab:\n\n' +
          '1. Enable WebMCP (ChatGPT in-app browser, or Chrome flag `chrome://flags/#enable-webmcp-testing`).\n' +
          '2. Keep Lectern open so tools stay registered.\n' +
          '3. Ask: “List Lectern gaps and summarize what is missing.”\n' +
          '4. Ask: “Explain section … for a new teacher who has never heard of MCP.”\n' +
          '5. Switch to **Student**, leave a mark, and ask the agent to respond to your confusion.\n\n' +
          '> **Takeaway.** The wow moment is watching the co-pilot panel light up while the manuscript changes — proof the agent is on *this* page, not a generic essay.\n\n' +
          'Optional share path: **Export PDF + restore pack**, then **upload the PDF** (or import .lectern) on another device to study offline→online.\n\n' +
          'Or open the canonical student copy: `/studio?demo=webmcp&mode=student`.',
        order: 4,
        media: [
          figure(
            '/media/demo/webmcp-lab.svg',
            'Four steps to run the WebMCP lesson live',
            'Figure 6 · Enable, keep open, list gaps, switch Student',
          ),
        ],
      },
      {
        id: s6,
        kind: 'summary',
        title: 'Take home',
        body:
          '> **Takeaway.** WebMCP = page-registered tools + agent calls + live UI update.\n\n' +
          '> **Takeaway.** Lectern’s pitch: teachers share knowledge more efficiently with web-MCP AI — draft, co-pilot, publish; students read, mark, ask.\n\n' +
          '- Bridge: agent ↔ `document.modelContext` ↔ Lectern store\n' +
          '- Teacher: gaps → sections → quiz → publish / PDF restore\n' +
          '- Student: read-only + annotations + explain\n' +
          '- You always review before it becomes “the lesson”',
        order: 5,
        media: [
          figure(
            '/media/demo/webmcp-takeaway.svg',
            'Bridge, teacher loop, and student loop as three panels',
            'Figure 7 · Bridge · Teacher · Student',
          ),
        ],
      },
    ],
    quiz: [
      {
        id: createId('q'),
        prompt: 'Which picture shows **WebMCP**?',
        choices: [
          'A chat about a screenshot of the page',
          'The agent calling tools registered on this page',
          'A robot replacing the teacher',
          'The agent editing the operating system',
        ],
        choiceMedia: [
          figure('/media/demo/webmcp-quiz/chat-screenshot.svg', 'Chat panel next to a frozen page screenshot', 'Not WebMCP.'),
          figure('/media/demo/webmcp-quiz/live-tools.svg', 'Agent connected to Lectern document.modelContext tools', 'WebMCP.'),
          figure('/media/demo/webmcp-quiz/replace-teacher.svg', 'Teacher crossed out and replaced by an agent', 'Not WebMCP.'),
          figure('/media/demo/webmcp-quiz/os-control.svg', 'Operating system settings, not a lesson document', 'Not WebMCP.'),
        ],
        answerIndex: 1,
        explanation:
          'WebMCP exposes page tools on `document.modelContext`. The agent invokes them; this Lectern page updates. It is not a screenshot chat, not a teacher replacement, and not OS control.',
        order: 0,
        sectionId: s1,
      },
      {
        id: createId('q'),
        prompt: 'On Lectern, which tool is the best first call when a teacher says “what is missing?”',
        choices: [
          '`lectern_publish_lesson`',
          '`lectern_list_gaps`',
          '`lectern_add_annotation`',
          '`lectern_remove_section`',
        ],
        answerIndex: 1,
        explanation:
          '`lectern_list_gaps` analyzes title, objectives, materials, and quiz shape. Publish comes after blockers are clear; annotations are for students.',
        order: 0,
        sectionId: s2,
      },
      {
        id: createId('q'),
        prompt: 'Which picture is **Student** mode?',
        choices: [
          'Rewriting the lesson with `lectern_upsert_section`',
          'Read-only page: mark and ask',
          'Deleting the quiz',
          'Turning WebMCP off',
        ],
        choiceMedia: [
          figure('/media/demo/webmcp-quiz/teacher-upsert.svg', 'Teacher rewriting a manuscript section', 'Teacher only.'),
          figure('/media/demo/webmcp-quiz/student-mark.svg', 'Read-only manuscript with annotation tools', 'Student mode.'),
          figure('/media/demo/webmcp-quiz/delete-quiz.svg', 'Quiz items marked for deletion', 'Teacher only.'),
          figure('/media/demo/webmcp-quiz/webmcp-off.svg', 'Registered tools crossed out as unavailable', 'Not the student loop.'),
        ],
        answerIndex: 1,
        explanation:
          'Student mode is read-only for materials. Explain with `lectern_get_section` and leave marks with `lectern_add_annotation`. Upserts and quiz deletes stay on the teacher catalog.',
        order: 0,
        sectionId: s4,
      },
      {
        id: createId('q'),
        prompt: 'The co-pilot panel exists so that…',
        choices: [
          'Students can hide the lesson',
          'You can see which tools ran and which parts of the page the agent touched',
          'WebMCP becomes optional forever',
          'Math formulas render',
        ],
        answerIndex: 1,
        explanation:
          'Attention + activity log make agent actions visible — essential for teacher trust and debugging.',
        order: 0,
      },
      {
        id: createId('q'),
        prompt: 'PDF restore data at the end of an export is for…',
        choices: [
          'Decorating the printout only',
          'Encoding the lesson so Lectern can rebuild it (upload PDF / paste LCT1) for Student + WebMCP study',
          'Replacing WebMCP entirely',
          'Storing browser passwords',
        ],
        answerIndex: 1,
        explanation:
          'LECTERN_PDF / LCT1 payloads rebuild the lesson document in Lectern so teaching can start on paper and continue with the agent.',
        order: 1,
      },
    ],
    annotations: [],
    updatedAt: stamp,
  };
}

/** English Grade 7-8 history demo. All media uses public paths that deploy with the app. */
export function createCossacksDemoLesson(): LessonDocument {
  const stamp = nowIso();
  const s1 = createId('sec');
  const s2 = createId('sec');
  const s3 = createId('sec');
  const s4 = createId('sec');
  const s5 = createId('sec');
  const media = (src: string, alt: string, caption: string) => ({
    id: createId('media'),
    kind: 'image' as const,
    src,
    name: src.split('/').pop(),
    alt,
    caption,
  });
  return {
    id: createId('lesson'),
    version: 1,
    published: true,
    meta: {
      title: 'Ukrainian Cossacks: Freedom, the Sich, and Craft',
      audience: 'Grades 7-8 history · one lesson (45 min)',
      subject: 'History of Ukraine',
      objectives: [
        'Explain why Cossack communities emerged on Ukraine’s frontier.',
        'Describe the Zaporizhian Sich as a fortified community with self-government.',
        'Place key people and events of the Cossack era in context.',
        'Explain why blacksmithing and everyday tools mattered to a community.',
      ],
    },
    sections: [
      {
        id: s1,
        kind: 'material',
        order: 0,
        title: 'Who were the Cossacks?',
        body:
          'In the fifteenth and sixteenth centuries, people lived and travelled through the dangerous southern borderlands of Ukraine. They looked for work, trade, hunting and fishing, but they also needed protection. Groups of free people gradually formed Cossack communities.\n\n> **Definition.** The word *Cossack* comes from a Turkic word often understood as “free person” or “adventurer.” A Cossack was not only a rider with a sabre: Cossacks worked, travelled, defended their communities and valued mutual responsibility.\n\nFreedom mattered because life on the frontier was uncertain. Cooperation made it safer to farm, fish, build boats and protect one another.',
        media: [],
      },
      {
        id: s2,
        kind: 'material',
        order: 1,
        title: 'The Zaporizhian Sich: fortress and community',
        body:
          'Beyond the Dnipro rapids, Cossacks created fortified centres called *Sichs*. The best known was the Zaporizhian Sich. It was a military and political community where people lived, held councils, elected leaders and prepared expeditions.\n\n> **Key idea.** At a Cossack council, members discussed important matters and chose officers. This was one form of self-government.\n\nSymbols of authority were called *kleinods*: the mace, banner, seal and ceremonial drum. They represented responsibility to the whole community.',
        media: [
          media(
            '/media/ukrainian-cossacks/sich-scene-ai.png',
            'AI-generated view of the Zaporizhian Sich on the Dnipro',
            'The Zaporizhian Sich on the Dnipro. Image created with AI.',
          ),
        ],
      },
      {
        id: s3,
        kind: 'example',
        order: 2,
        title: 'Travel, leadership and historical evidence',
        body:
          'Cossack life included farming, fishing, beekeeping, trade and skilled crafts. On rivers and the Black Sea, Cossacks used light boats called *chaikas*. Their success depended on teamwork, knowledge of waterways and careful preparation.\n\nDmytro Vyshnevetskyi is associated with an early fortification on Mala Khortytsia; Petro Konashevych-Sahaidachnyi led sea campaigns; Bohdan Khmelnytskyi led the mid-seventeenth-century uprising that created the Cossack Hetmanate; Pylyp Orlyk wrote a famous constitutional document in 1710.\n\n> **Note.** Paintings and stories can capture the mood of an era, but historians compare them with documents, objects, maps and archaeology.',
        media: [
          media(
            '/media/ukrainian-cossacks/chaika-scene-ai.png',
            'AI-generated Cossack chaika boat',
            'A Cossack chaika boat. Image created with AI.',
          ),
          media(
            '/media/ukrainian-cossacks/cossack-council-ai.png',
            'AI-generated seventeenth-century Cossack council',
            'A Cossack council at the Sich. Image created with AI.',
          ),
        ],
      },
      {
        id: s4,
        kind: 'material',
        order: 3,
        title: 'Tools and the blacksmith’s workshop',
        body:
          'A Cossack community needed skilled makers as well as fighters. Axes, knives, sickles, scythes, nails, locks, horseshoes and fittings for wagons and boats all had to be made or repaired.\n\nIn a forge, a blacksmith heated iron in a hearth using bellows. Hot metal was held with **tongs**, shaped on an **anvil** with a hammer, and finished with chisels and files.\n\n> **Safety note.** This lesson explains history, not practical forging. Real work with fire and hot metal requires training and protective equipment.',
        media: [
          media(
            '/media/ukrainian-cossacks/cossack-forge-ai.png',
            'AI-generated Ukrainian blacksmith workshop',
            'A blacksmith’s workshop. Image created with AI.',
          ),
          media(
            '/media/ukrainian-cossacks/blacksmith-tools-article-ai.png',
            'AI-generated labeled still-life of forge, tongs, anvil, hammer and iron fitting',
            'How forge tools work together. Image created with AI.',
          ),
        ],
      },
      {
        id: s5,
        kind: 'summary',
        order: 4,
        title: 'What the Cossack legacy means',
        body:
          'Ukrainian Cossacks grew from frontier communities that needed freedom, cooperation and protection. The Zaporizhian Sich became a symbol of military organisation and self-government. Its legacy includes famous leaders, state-building experience, crafts, songs and historical memory.\n\n> **Takeaway.** Remember three words: **freedom, community, responsibility**.',
        media: [],
      },
    ],
    quiz: [
      {
        id: createId('q'),
        prompt: 'The word *Cossack* is often understood as…',
        choices: ['A kind of monastery', 'A free person or adventurer', 'A type of crop', 'A royal title only'],
        answerIndex: 1,
        explanation:
          'The word comes from a Turkic root often read as “free person” or “adventurer,” matching frontier communities that valued freedom and mutual responsibility.',
        order: 0,
        sectionId: s1,
      },
      {
        id: createId('q'),
        prompt: 'Which description best fits the Zaporizhian Sich?',
        choices: [
          'A market only',
          'A fortified Cossack military-political community',
          'A kind of boat',
          'A monastery',
        ],
        answerIndex: 1,
        explanation:
          'The Sich was a fortified centre of Cossack community life, defence and self-government.',
        order: 0,
        sectionId: s2,
      },
      {
        id: createId('q'),
        prompt: 'What was a *chaika*?',
        choices: ['A light Cossack boat', 'A ceremonial drum', 'A blacksmith’s tool', 'A title'],
        answerIndex: 0,
        explanation: 'Chaikas were light boats used for river and sea travel.',
        order: 0,
        sectionId: s3,
      },
      {
        id: createId('q'),
        prompt: 'Which tool lets a blacksmith hold hot metal at a safer distance?',
        choices: ['Tongs', 'Quill pen', 'Paintbrush', 'Drawing compass'],
        answerIndex: 0,
        explanation:
          'Tongs grip hot metal so the blacksmith can move and shape it safely.',
        order: 0,
        sectionId: s4,
        choiceMedia: [
          media('/media/quiz-tools/blacksmith-tongs-ai.png', 'AI-generated blacksmith tongs', 'Image created with AI.'),
          media('/media/quiz-tools/quill-pen-ai.png', 'AI-generated quill pen', 'Image created with AI.'),
          media('/media/quiz-tools/paintbrush-ai.png', 'AI-generated paintbrush', 'Image created with AI.'),
          media('/media/quiz-tools/drawing-compass-ai.png', 'AI-generated drawing compass', 'Image created with AI.'),
        ],
      },
      {
        id: createId('q'),
        prompt: 'Why were blacksmiths important to Cossack communities?',
        choices: [
          'They made only jewellery',
          'They repaired useful tools, transport and equipment',
          'They replaced the council',
          'They ended the need for trade',
        ],
        answerIndex: 1,
        explanation:
          'Blacksmiths made and repaired the practical metal objects needed for daily life and travel.',
        order: 0,
      },
    ],
    annotations: [],
    updatedAt: stamp,
  };
}

export function createDemoById(id: LecternDemoId): LessonDocument {
  const lesson =
    id === 'webmcp'
      ? createWebMcpDemoLesson()
      : id === 'cossacks'
        ? createCossacksDemoLesson()
        : createPhotosynthesisDemoLesson();
  return { ...lesson, id: DEMO_LESSON_IDS[id] };
}

function sortQuizItems(items: QuizItem[]): QuizItem[] {
  return [...items].sort((a, b) => a.order - b.order);
}

/** Nested checks attached to a known section id. */
export function quizItemsForSection(lesson: LessonDocument, sectionId: string): QuizItem[] {
  return sortQuizItems(lesson.quiz.filter((item) => item.sectionId === sectionId));
}

/**
 * End-of-lesson quiz: missing/empty sectionId, or sectionId that does not match
 * any section (orphan → treat as lesson-level; never drop).
 */
export function lessonLevelQuiz(lesson: LessonDocument): QuizItem[] {
  const sectionIds = new Set(lesson.sections.map((s) => s.id));
  return sortQuizItems(
    lesson.quiz.filter((item) => {
      const sid = item.sectionId?.trim();
      if (!sid) return true;
      return !sectionIds.has(sid);
    }),
  );
}

/**
 * Manuscript / PDF reading order: nested items after each section (by section order),
 * then lesson-level items. Each group keeps local Q numbering via callers.
 */
export function quizItemsInReadingOrder(lesson: LessonDocument): Array<{
  item: QuizItem;
  placement: 'section' | 'lesson';
  sectionId?: string;
  localIndex: number;
}> {
  const out: Array<{
    item: QuizItem;
    placement: 'section' | 'lesson';
    sectionId?: string;
    localIndex: number;
  }> = [];
  const sortedSections = [...lesson.sections].sort((a, b) => a.order - b.order);
  for (const section of sortedSections) {
    const nested = quizItemsForSection(lesson, section.id);
    nested.forEach((item, index) => {
      out.push({ item, placement: 'section', sectionId: section.id, localIndex: index });
    });
  }
  lessonLevelQuiz(lesson).forEach((item, index) => {
    out.push({ item, placement: 'lesson', localIndex: index });
  });
  return out;
}

/** Stripe payload for the inverted PDF answer key (no choice media). */
export function quizAnswerKeyStripes(lesson: LessonDocument): Array<{
  localNumber: number;
  letter: string;
  choiceText: string;
  explanation: string;
  placement: 'section' | 'lesson';
  sectionTitle?: string;
}> {
  return quizItemsInReadingOrder(lesson).map(({ item, placement, sectionId, localIndex }) => {
    const choice = item.choices[item.answerIndex] ?? '';
    const sectionTitle =
      placement === 'section' && sectionId
        ? lesson.sections.find((s) => s.id === sectionId)?.title
        : undefined;
    return {
      localNumber: localIndex + 1,
      letter: String.fromCharCode(65 + item.answerIndex),
      choiceText: choice,
      explanation: item.explanation,
      placement,
      sectionTitle,
    };
  });
}

export function analyzeGaps(lesson: LessonDocument): LessonGap[] {
  const gaps: LessonGap[] = [];
  if (!lesson.meta.title.trim() || lesson.meta.title === 'Untitled lesson') {
    gaps.push({ code: 'title', severity: 'blocker', message: 'Set a clear lesson title.' });
  }
  if (lesson.meta.objectives.filter((o) => o.trim()).length === 0) {
    gaps.push({ code: 'objectives', severity: 'blocker', message: 'Add at least one learning objective.' });
  }
  if (lesson.sections.length === 0) {
    gaps.push({ code: 'sections', severity: 'blocker', message: 'Add material sections students can read.' });
  }
  const thin = lesson.sections.filter((s) => s.body.trim().length < 40);
  if (thin.length > 0) {
    gaps.push({
      code: 'thin_sections',
      severity: 'warning',
      count: thin.length,
      message: `${thin.length} section(s) look too short for a complete lesson.`,
    });
  }
  if (lesson.quiz.length === 0) {
    gaps.push({
      code: 'quiz',
      severity: 'warning',
      message: 'Add quiz items so the lesson includes tests, not only materials.',
    });
  }
  const badQuiz = lesson.quiz.filter(
    (q) => q.choices.length < 2 || q.answerIndex < 0 || q.answerIndex >= q.choices.length,
  );
  if (badQuiz.length > 0) {
    gaps.push({
      code: 'quiz_shape',
      severity: 'blocker',
      count: badQuiz.length,
      message: `${badQuiz.length} quiz item(s) need valid choices and an answer index.`,
    });
  }
  return gaps;
}

/** Publish gate used by `lectern_publish_lesson` and WebMCP evals. */
export function isPublishable(lesson: LessonDocument): boolean {
  return analyzeGaps(lesson).every((gap) => gap.severity !== 'blocker');
}

export function encodeLessonForShare(lesson: LessonDocument): string {
  const payload = JSON.stringify(lesson);
  const bytes = new TextEncoder().encode(payload);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function decodeLessonFromShare(token: string): LessonDocument | null {
  try {
    const padded = token.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    const binary = atob(padded + pad);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as LessonDocument;
    if (!parsed?.meta || !Array.isArray(parsed.sections)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function studentShareUrl(lesson: LessonDocument): string {
  const demoId = demoIdFromLessonId(lesson.id);
  if (demoId) return demoShareUrl(demoId, 'student');
  const token = encodeLessonForShare({ ...lesson, published: true, annotations: [] });
  return `${SITE_URL}/studio?mode=student&l=${token}`;
}

export function loadStoredLesson(): LessonDocument | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseStoredRecord(raw)?.lesson ?? null;
  } catch {
    return null;
  }
}

/** Prefer the newest draft from localStorage or IndexedDB (for large embedded media). */
export async function hydrateStoredLesson(): Promise<LessonDocument | null> {
  let local: StoredLessonRecord | null = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) local = parseStoredRecord(raw);
  } catch {
    local = null;
  }
  const idb = await loadStoredLessonIdb();
  const record = pickNewerRecord(local, idb);
  return record?.lesson ?? null;
}

export async function saveStoredLesson(lesson: LessonDocument): Promise<boolean> {
  const record: StoredLessonRecord = {
    version: LESSON_STORAGE_VERSION,
    savedAt: new Date().toISOString(),
    lesson,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    return true;
  } catch {
    try {
      await saveStoredLessonIdb(record);
      return true;
    } catch {
      return false;
    }
  }
}

export function isSparseLesson(lesson: LessonDocument): boolean {
  const untitled = !lesson.meta.title.trim() || lesson.meta.title === 'Untitled lesson';
  return (
    untitled &&
    !lesson.meta.audience.trim() &&
    !lesson.meta.subject.trim() &&
    lesson.meta.objectives.every((item) => !item.trim()) &&
    lesson.sections.length === 0 &&
    lesson.quiz.length === 0
  );
}

export type LibraryListItem = {
  id: string;
  title: string;
  updatedAt: string;
  sparse: boolean;
};

type LibraryIndex = {
  version: 1;
  currentId: string;
  items: LibraryListItem[];
};

function emptyLibraryIndex(): LibraryIndex {
  return { version: 1, currentId: '', items: [] };
}

function readLibraryIndex(): LibraryIndex {
  try {
    const raw = localStorage.getItem(LIBRARY_INDEX_KEY);
    if (!raw) return emptyLibraryIndex();
    const parsed = JSON.parse(raw) as Partial<LibraryIndex>;
    if (!Array.isArray(parsed.items)) return emptyLibraryIndex();
    return {
      version: 1,
      currentId: typeof parsed.currentId === 'string' ? parsed.currentId : '',
      items: parsed.items.flatMap((item) => {
        if (!item || typeof item.id !== 'string' || typeof item.title !== 'string') return [];
        return [
          {
            id: item.id,
            title: item.title,
            updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : '',
            sparse: Boolean(item.sparse),
          },
        ];
      }),
    };
  } catch {
    return emptyLibraryIndex();
  }
}

function writeLibraryIndex(index: LibraryIndex): void {
  localStorage.setItem(LIBRARY_INDEX_KEY, JSON.stringify(index));
}

function toLibraryItem(lesson: LessonDocument): LibraryListItem {
  return {
    id: lesson.id,
    title: lesson.meta.title.trim() || 'Untitled lesson',
    updatedAt: lesson.updatedAt,
    sparse: isSparseLesson(lesson),
  };
}

async function saveLibraryLessonIdb(lesson: LessonDocument): Promise<void> {
  const db = await openLessonDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_LIBRARY, 'readwrite');
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('IndexedDB library write failed.'));
    };
    tx.objectStore(IDB_LIBRARY).put(lesson, lesson.id);
  });
}

async function loadLibraryLessonIdb(id: string): Promise<LessonDocument | null> {
  try {
    const db = await openLessonDb();
    return await new Promise<LessonDocument | null>((resolve, reject) => {
      const tx = db.transaction(IDB_LIBRARY, 'readonly');
      tx.oncomplete = () => db.close();
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('IndexedDB library read failed.'));
      };
      const request = tx.objectStore(IDB_LIBRARY).get(id);
      request.onsuccess = () => {
        const value = request.result as LessonDocument | undefined;
        resolve(value?.meta && Array.isArray(value.sections) ? value : null);
      };
      request.onerror = () => reject(request.error ?? new Error('IndexedDB library read failed.'));
    });
  } catch {
    return null;
  }
}

async function deleteLibraryLessonIdb(id: string): Promise<void> {
  try {
    const db = await openLessonDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_LIBRARY, 'readwrite');
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('IndexedDB library delete failed.'));
      };
      tx.objectStore(IDB_LIBRARY).delete(id);
    });
  } catch {
    /* ignore */
  }
}

export function listLibraryItems(): LibraryListItem[] {
  return [...readLibraryIndex().items].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
}

export function libraryCurrentId(): string {
  return readLibraryIndex().currentId;
}

export async function upsertLibraryLesson(lesson: LessonDocument): Promise<void> {
  const index = readLibraryIndex();
  const item = toLibraryItem(lesson);
  const items = [item, ...index.items.filter((entry) => entry.id !== lesson.id)];
  writeLibraryIndex({ version: 1, currentId: lesson.id, items });
  try {
    await saveLibraryLessonIdb(lesson);
  } catch {
    /* current draft still lives in lectern.lesson.v1 */
  }
}

export async function loadLibraryLesson(id: string): Promise<LessonDocument | null> {
  const fromIdb = await loadLibraryLessonIdb(id);
  if (fromIdb) return fromIdb;
  const current = loadStoredLesson();
  return current?.id === id ? current : null;
}

export async function removeLibraryLesson(id: string): Promise<void> {
  const index = readLibraryIndex();
  writeLibraryIndex({
    version: 1,
    currentId: index.currentId === id ? '' : index.currentId,
    items: index.items.filter((item) => item.id !== id),
  });
  await deleteLibraryLessonIdb(id);
}
