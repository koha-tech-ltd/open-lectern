# Lectern — Feature Flows (Mermaid)

Companion diagrams for [C4-MODEL.md](./C4-MODEL.md), [webmcp.md](./webmcp.md), and [amdp.md](./amdp.md).

All diagrams use portable Mermaid syntax (`flowchart`, `sequenceDiagram`, `erDiagram`) for GitHub and common Markdown previews.

---

## End-to-end product flow

```mermaid
flowchart TB
  subgraph Author[Teacher path]
    D[Draft in UI]
    G[web-MCP fills gaps sources and tests]
    R[Teacher reviews]
    P[Export PDF and lectern]
  end

  subgraph Learn[Student path]
    RO[Upload PDF read-only lesson]
    AN[Annotate]
    ASK[Ask AI via web-MCP]
    RES[Export results PDF]
  end

  D --> G
  G --> R
  R --> P
  P --> RO
  RO --> AN
  AN --> ASK
  AN --> RES
```

---

## Data model

Optional `sectionId` on a quiz item places a check after that section; omit it for the end-of-lesson block. Full rules: [section-checks.md](./section-checks.md).

```mermaid
erDiagram
  LESSON ||--o{ SECTION : contains
  LESSON ||--o{ QUIZ_ITEM : contains
  SECTION ||--o{ QUIZ_ITEM : checks
  LESSON ||--o{ ANNOTATION : has
  LESSON {
    string id
    int version
    bool published
    string title
    string audience
    string subject
  }
  SECTION {
    string id
    string kind
    string title
    string body
    int order
  }
  QUIZ_ITEM {
    string id
    string prompt
    int answerIndex
    string explanation
    string sectionId
  }
  ANNOTATION {
    string id
    string sectionId
    string note
    string createdAt
  }
```

---

## Manuscript reading order

Soft pause only — later sections stay readable. Student path is still read → annotate → quiz (no lock).

```mermaid
flowchart TB
  subgraph ReadOrder[Manuscript reading order]
    S1[Section 1]
    C1[Nested check if sectionId matches]
    S2[Section 2]
    C2[Nested check if any]
    Sum[Summary section]
    EndQ[End-of-lesson quiz items with no sectionId]
  end
  S1 --> C1 --> S2 --> C2 --> Sum --> EndQ
```

---

## PDF page stack

Prompt-only checks in the body; inverted striped answer key before the restore system page.

```mermaid
flowchart TB
  Cover[Cover]
  Body[Sections with nested prompt-only checks]
  EndQ[End-of-lesson prompts]
  Key[Answer key page]
  Rest[LECTERN restore system page]
  Cover --> Body --> EndQ --> Key --> Rest
```

---

## Student results PDF

Printable handoff for the teacher (no restore payload). Full rules: [student-results-pdf.md](./student-results-pdf.md).

```mermaid
flowchart TB
  Sum[Cover and cheerful score]
  Miss[Missed and skipped checks]
  Notes[Student notes by section]
  Sum --> Miss --> Notes
```

---

## Publish and share

Lesson data does not travel in a student URL. The studio URL stays `https://lectern.click/studio` (plus optional `?mode=` / `?demo=`). Teachers hand out a **PDF** for students and keep a **`.lectern`** file to reopen authoring.

Product flag: `ALLOW_PDF_RESTORE_AUTHORING` in `src/lib/product-flags.ts` (default **false**). When false, PDF / LCT1 restore opens student mode only; switching to Teacher shows this device’s draft or an empty page — never the PDF lesson. Flip the flag to restore legacy “PDF can reopen authoring.”

```mermaid
sequenceDiagram
  participant T as Teacher
  participant Store as LessonStore
  participant Gap as analyzeGaps
  participant Exp as ExportPDF_lectern
  participant S as StudentBrowser

  T->>Store: publish gap gate
  Store->>Gap: check blockers
  alt has blockers
    Gap-->>T: reject with gaps
  else ready
    Gap-->>Store: ok
    Store-->>T: studioUrl plus export hints
    T->>Exp: Export PDF and download .lectern
    S->>Store: upload PDF restore
    Store-->>S: student session locked copy
  end
```

`.lectern` upload opens Teacher. PDF restore leaves the authoring tab.

---

## WebMCP registration lifecycle

```mermaid
sequenceDiagram
  participant App as ReactApp
  participant Hook as useWebMcpTools
  participant Lib as webmcpLib
  participant MC as modelContext
  participant Agent as AIAgent

  App->>Hook: mode teacher or student
  Hook->>Lib: isWebMcpAvailable
  alt missing
    Lib-->>Hook: status missing
  else available
    Hook->>Lib: unregisterTools previous
    Hook->>Lib: registerTools for mode
    Lib->>MC: registerTool lectern tools
    MC-->>Hook: ready
    Agent->>MC: execute lectern_get_lesson
    MC->>Hook: execute handler
    Hook-->>Agent: toolText structuredContent
  end
```

---

## Dual UI vs dual tools

```mermaid
flowchart LR
  subgraph UI[Human UI]
    TE[LessonEditor]
    TR[LessonReader]
  end

  subgraph Tools[WebMCP tools]
    TT[Teacher tool set]
    ST[Student tool set]
  end

  Store[(LessonDocument)]

  TE --> Store
  TR --> Store
  TT --> Store
  ST --> Store
```

One document, two affordances — that is the WebMCP leverage for Lectern.

---

## Copy reference → grounded tool call

Each material has **Copy reference** (same `⎘` control as Copy the agent prompt). The clipboard holds a `LECTERN_SECTION` pointer, not the section body.

```mermaid
sequenceDiagram
  actor H as Teacher or student
  participant UI as Manuscript
  actor A as WebMCP agent
  participant MC as modelContext

  H->>UI: Copy reference on a section or Q1
  UI-->>H: LECTERN_SECTION or LECTERN_QUIZ
  H->>A: Paste plus their ask
  A->>MC: lectern_get_section or lectern_get_lesson
  MC-->>A: Title body kind media nested checks
  alt Teacher
    A->>MC: upsert / figures / nested check using that id
  else Student
    A-->>H: Explain from that text only
  end
```

See [webmcp.md](./webmcp.md#copy-section-reference).

---

## AMDP cite → intake → bind

Photographs and video do not ride in the model’s JSON. The agent cites a SHA-256; the tab fills CAS; bind writes a data URL onto the lesson (PDF draw + LCT1). Full protocol: [amdp.md](./amdp.md), spec [AMDP/1](./AMDP-PROTOCOL.md).

```mermaid
sequenceDiagram
  participant A as Agent
  participant O as lectern_offer_media
  participant P as lectern_put_media_slice
  participant B as lectern_bind_media
  participant C as CAS
  participant L as Lesson

  A->>O: sha256 size mime merkleLeaves
  alt already in tab
    O-->>A: have cas-hit
  else merkle intake
    O-->>A: intake missingLeaves
    loop each missing slice
      A->>P: index plus raw slice base64
      P->>C: verify leaf then store slice
    end
    P->>C: concat and verify file hash
  end
  A->>B: purpose alt sectionId or quizId
  B->>C: lookup sha256
  B->>L: persist data URL
  L-->>A: ok
```

json-chunk (`begin` / `append` / `commit`) is rank 4 — the same bind surface when earlier ranks failed or Merkle leaves are absent. Try cas-hit → plane-put → merkle-slice → json-chunk until CAS present, then STOP.

Chrome MCP plane-put (rank 2, when the agent already has a file on disk): stage in OS temp (`%TEMP%` / `$TMPDIR`), create a temporary `<input type="file">` on the page, append it to `document.body`, and leave it there (Lectern hides it visually). Upload that temp file. The page plane-puts on `change`; then status/re-offer until `have`, then bind. Optional: in-page `arrayBuffer()` → `window.__lecternAmdp.put`. Do not use a section Attach-media picker. Do not upload from the workspace path. Do not pass base64 as `evaluate_script.args`. If `DOM.setFileInputFiles` is denied or files stay empty, go to merkle-slice, then json-chunk, until present — then STOP. Mechanism: [Generated staging input](./amdp.md#generated-staging-input-plane-put).
