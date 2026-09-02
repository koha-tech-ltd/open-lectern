# Native WebMCP run result (Chrome)

**Date:** 2026-08-27  
**URL:** http://localhost:5180  
**Client:** Google Chrome with `chrome://flags/#enable-webmcp-testing` enabled  
**API:** `document.modelContext` + `navigator.modelContextTesting.executeTool(name, jsonString)`

## Outcome: PASS

| Step | Tool | Result |
| --- | --- | --- |
| List gaps | `lectern_list_gaps` | `readyToPublish: true` |
| Harden meta | `lectern_set_meta` | `ok` — title *Photosynthesis: materials, tests, knowledge* |
| Harden section | `lectern_upsert_section` | body includes *Hardened by native WebMCP agent.* |
| Add test | `lectern_upsert_quiz_item` | chloroplast question added (3 quiz items total) |
| Publish | `lectern_publish_lesson` | gap gate ok; returns studio URL + PDF / `.lectern` export hints (no student share token) |
| Switch mode | `lectern_set_mode` | `student` — tools re-registered **10 → 6** |
| Grounded read | `lectern_get_section` | returned hardened section |
| Annotate | `lectern_add_annotation` | note saved |
| List marks | `lectern_list_annotations` | **1** annotation |

### Student tools after mode switch

- `lectern_get_lesson`
- `lectern_list_gaps`
- `lectern_get_section`
- `lectern_set_mode`
- `lectern_add_annotation`
- `lectern_list_annotations`

### Screenshot

![Student mode after WebMCP workflow](./screenshots/webmcp-student-result.png)

Banner shows: **Registered 6 native WebMCP tools for student mode.**  
Marks panel shows the agent-added note on *What the plant is doing*.

## Fix applied during run

Chained tool calls were racing React `setState`. `useLessonStore` now keeps synchronous refs so `publish` / `get_lesson` see prior tool mutations immediately.
