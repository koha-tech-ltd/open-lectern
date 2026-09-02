# Lectern WebMCP evals

Lectern follows Chrome’s [Evals for WebMCP](https://developer.chrome.com/docs/ai/webmcp/evals) guidance. Agents are probabilistic: one prompt can produce many tool traces. We still ship **classic deterministic tests** for anything that does not talk to a model, and **eval fixtures** (`expectedCall`) for the LLM touchpoints.

| Chrome layer | What it proves | Lectern path |
| --- | --- | --- |
| Tool list for a state | The model sees every tool that is actually registered | `evals/schema/teacher.json`, `evals/schema/student.json` from `src/lib/webmcp-catalog.ts` |
| Isolation / call accuracy | Right tool + arguments for a single user turn | `evals/cases/isolation-*.json` (includes pasted `LECTERN_SECTION` references) |
| Deterministic tool logic | Mutations, publish gate, error shape | `npm run test:evals` |
| Probabilistic evals | Direct *and* open-ended prompts | `isolation-*.json` (`direct` vs `open`) + `npx webmcp-evals` |
| End-to-end journeys | Ordered / unordered multi-step traces | `evals/cases/journeys-*.json` |
| Mid-chain failures | Isolate a failing tool after forcing prior calls | `evals/cases/mid-chain.json` + publish-gate tests |

Chrome’s experimental CLI: [GoogleChromeLabs/webmcp-tools evals-cli](https://github.com/GoogleChromeLabs/webmcp-tools/tree/main/evals-cli).

```bash
npm run test:evals          # deterministic pipeline (CI)
npm run eval:schema         # regenerate schema JSON from the catalog
npm run eval:local          # LLM evals against teacher+student schemas (needs API key)
npm run eval:browser        # LLM evals against a live page (Puppeteer)
```

## Failure modes we test

Mapped from Chrome’s tables onto Lectern tools:

| Failure | Lectern example | Where it is covered |
| --- | --- | --- |
| Wrong tool | Skip `lectern_list_gaps` and call `lectern_publish_lesson` on an empty draft | Isolation + mid-chain fixtures; publish-gate deterministic test |
| Wrong order | `lectern_publish_lesson` before `lectern_upsert_section` | `journeys.json` ordered prefix |
| Wrong arguments | `lectern_set_mode` with `"mode": "reader"` | Isolation expected arguments + enum on the schema |
| Wrong / thin output | `lectern_list_gaps` must return blocker codes, not a vibe | Deterministic `analyzeGaps` / `isPublishable` |
| Runtime failure | Publish with blocker gaps; annotate in teacher mode | Mid-chain isolation of `lectern_publish_lesson` |

## Application state

Chrome: include **all tools for the state under test**, not a single-tool stub. Teacher mode and student mode register different catalogs (`src/hooks/useWebMcpTools.ts`). Local evals therefore pass the matching schema file.

`expectedCall` is the same shape Chrome documents:

```json
{
  "messages": [{ "role": "user", "content": "Call lectern_list_gaps and fix every blocker." }],
  "expectedCall": [{ "functionName": "lectern_list_gaps" }]
}
```

Argument matchers (`$contains`, `$type`, `$any`, `$gte`) match the evals-cli operators.

## Deterministic vs probabilistic

- **Deterministic (CI):** tool logic in `src/lib/lesson.ts` (`analyzeGaps`, `isPublishable`, share encoding), catalog ↔ hook name sync, fixture names ⊂ schema.
- **Probabilistic (opt-in):** `webmcp-evals local` or `browser` with a Gemini / OpenAI / Anthropic key. Datasets include direct prompts (“list the gaps”) and open-ended ones (“this isn’t ready for Monday — what’s missing?”).

Do not substitute LLM evals for the CI layer. Chrome: keep classic tests for every interaction that does not communicate with the model.
