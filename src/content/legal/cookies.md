# Cookie Policy

**Last updated:** 9/2/2026

**Operator:** **KOHA-TECH Sp. z o.o.** (trade name **Lectern**), Nowy Świat 33/13, 00-029 Warszawa, Poland

Lectern is a **browser-only** lesson studio and an open-source R&D product. Essential storage keeps your draft on this device. Lectern does **not** load a third-party analytics or session-replay script.

## 1. What we mean by cookies

Cookies are small files a site can store on your device. Similar technologies include `localStorage`, `sessionStorage`, and URL parameters. This policy covers all of those as they apply to lectern.click.

## 2. What Lectern stores on your device

| Name / area | Type | Purpose | Duration |
| --- | --- | --- | --- |
| `lectern.lesson.v1` | Essential local storage | Teacher draft (materials, tests, media) | Until you clear site data or replace the draft |
| `lectern.onboarding.teacher.v1` / `lectern.onboarding.student.v1` | Essential local storage | Remembers that you finished “How this works” | Until you clear site data or reopen the tour |
| `lectern.agent-activity.v1` | Essential local storage | Co-pilot tool-call history on this device | Until you clear history in the panel or clear site data |
| PDF continuation events | Essential session storage | Short-lived restore hints after opening a Lectern PDF | Until the tab session ends |
| `lectern.entry.fromLanding.v1` | Essential session storage | Remembers that this tab opened from the home page (so the studio can drop `?via=home` from the address bar) | Until the tab session ends |
| Student share URL (`?mode=student&l=…` or `?demo=webmcp&mode=student`) | Essential (in the address bar, not a cookie) | Opens a published lesson or a built-in demo without an account | As long as the link is kept |

Draft storage is required for Lectern to function as described. There is no in-app toggle to “reject” draft storage; without it, a refresh would wipe the lesson. You can delete everything via your browser’s site-data controls for lectern.click.

## 3. What we do not use

- Third-party product analytics or session-replay scripts
- Advertising cookies
- Cross-site tracking for ads

## 4. Hosting

The static host / CDN that serves lectern.click may set its own strictly necessary cookies (for example load-balancing or security). Those are controlled by the host, not by Lectern lesson code.

## 5. Your choices

- Clear site data in the browser to remove drafts, onboarding flags, and co-pilot history.
- Do not distribute a student share URL if the encoded lesson should stay private.
- Blocking **all** storage may prevent Lectern from saving a draft.

## 6. Open-source code

Storage keys are visible in the [source](https://github.com/koha-tech-ltd/open-lectern). Lesson text is not posted to a Lectern API. Software licensing is described in the [License](/license).

## 7. Contact

Questions: [privacy@koha-tech.com](mailto:privacy@koha-tech.com)  
See also the [Privacy Policy](/privacy).
