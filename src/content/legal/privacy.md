# Privacy Policy

**Last updated:** 9/2/2026

**Controller:** **KOHA-TECH Sp. z o.o.** (Koha-Tech spółka z ograniczoną odpowiedzialnością), Nowy Świat 33/13, 00-029 Warszawa, Poland (KRS: 0001183713, NIP: 5253054129, REGON: 542256381, share capital: PLN 5,000)

This Privacy Policy explains how **KOHA-TECH Sp. z o.o.** (operating the trade name **"Lectern"**, **"we"**, **"us"**) handles information when you use [lectern.click](https://lectern.click).

Lectern is built so that **lesson work happens in your browser**. There is no Lectern account, no Lectern lesson database, and no Lectern backend that stores what you write. You can inspect that claim in the [open-source code](https://github.com/koha-tech-ltd/open-lectern). Software use is governed by the [License](/license) (MIT). Lectern Cloud is a separate paid product.

## 1. Who we are

**Controller:** **KOHA-TECH Sp. z o.o.**  
Nowy Świat 33/13  
00-029 Warszawa, Poland

**KRS:** 0001183713 · **NIP:** 5253054129 · **REGON:** 542256381 · **Share capital:** PLN 5,000

**Privacy:** [privacy@koha-tech.com](mailto:privacy@koha-tech.com)  
**General:** [contact@koha-tech.com](mailto:contact@koha-tech.com)

## 2. What this policy covers

This policy covers the Lectern web application at lectern.click: teacher authoring, student reading, in-page WebMCP tools, PDF import/export, and related browser storage.

It does **not** cover third-party AI agents you choose to attach (for example ChatGPT’s in-app browser, or another WebMCP client). Those services have their own privacy notices. Lectern only registers tools in the page; it does not send your lesson to an AI provider unless **you** connect an agent that then reads the document.

## 3. Browser-first processing (the product)

Lectern is a static web app. Lesson content is processed **on your device**:

| Where it lives | What | Leaves this browser? |
| --- | --- | --- |
| `localStorage` | Teacher draft, onboarding flags, co-pilot activity history | No, unless you copy it out |
| Address bar / share link | Published student copy (`?mode=student&l=…`) or a built-in demo (`?demo=webmcp&mode=student`) | Yes — anyone with the link can open the lesson |
| `sessionStorage` | Short-lived PDF continuation events | No, unless you copy it out |
| Downloads | `.lectern` files and PDFs you export | Only if you share the file |
| In-page WebMCP tools | Same mutations as the UI, running in this document | Only if an attached agent reads tool results |

We do **not** operate a Lectern server that receives lesson text, quiz items, annotations, or student marks.

**Legal basis:** Art. 6(1)(b) GDPR (providing the tool you asked to use) and Art. 6(1)(f) GDPR (keeping the app working on your device). Most of this data never reaches KOHA-TECH.

## 4. Information that may reach us or processors

Because Lectern is hosted as a public website, **hosting and delivery** may process limited technical data:

- IP address, user-agent, request URL, and timestamps in CDN / static-host logs
- Basic error and availability telemetry the host collects to serve the site

We do not use this to build lesson profiles. Logs are typically retained by the host for a limited operational period (often up to 30–90 days, depending on the provider).

**Share links:** a published student URL contains the lesson payload. Do not put secrets, student names, grades, or special-category data into a lesson you share. Referrer headers and browser history can expose a URL you visit.

**Legal basis:** Art. 6(1)(f) GDPR (security, abuse prevention, keeping lectern.click available) and Art. 6(1)(c) where logs are required for legal claims or incident response.

## 5. Accounts and cookies

Lectern does **not** create user accounts and does **not** use advertising cookies.

**Essential** browser storage (drafts, onboarding, co-pilot history) is required for the tool to work on your device. See the [Cookie Policy](/cookies).

Lectern does **not** load a third-party product-analytics or session-replay script. There is no in-app advertising tracker.

**Legal basis:** Art. 6(1)(b) and 6(1)(f) GDPR for essential storage and hosting logs.

## 6. WebMCP and AI agents

Lectern registers typed tools on `document.modelContext` (with `navigator.modelContext` fallback) so a compatible agent can author or tutor **inside this page**. That is the Lectern entry for the [OpenAI WebMCP Challenge](https://openai.com/webmcp-challenge/): people and agents share one live document instead of the agent guessing through the UI.

When you attach an agent:

- tool calls run in your browser against the open lesson
- the agent’s provider may process prompts, tool arguments, and tool results under **that provider’s** policy
- Lectern does not proxy those calls through a KOHA-TECH AI backend

You can use Lectern without an agent. The human UI remains complete.

## 7. Open-source code

Lectern source is published so you can review how storage, share URLs, and WebMCP tools work rather than taking this notice on trust. Source: [github.com/koha-tech-ltd/open-lectern](https://github.com/koha-tech-ltd/open-lectern). Use of that software is governed by the [License](/license).

## 8. How we use information we do receive

Where technical logs reach us or our host, we use them only to:

- operate, secure, and debug lectern.click
- prevent abuse of the public site
- comply with legal obligations

We do **not** sell personal data. We do **not** use lesson content for advertising or for training KOHA-TECH models.

Image notice: visuals on this site are partly generated or edited with AI. Marked accordingly in line with EU AI Act transparency rules (Art. 50). This is a content-transparency disclosure and does not involve processing additional personal data beyond what this policy already describes.

## 9. Sharing and international transfers

We may use infrastructure providers (for example static hosting / CDN) to deliver the website. Those providers process technical data under contract. Where GDPR Chapter V applies, they rely on appropriate safeguards such as Standard Contractual Clauses.

We may disclose information if required by law or to protect users, the site, or our rights.

## 10. Retention

| Data | Retention |
| --- | --- |
| Lesson drafts and marks | Until you clear site data, publish over them, or start a new lesson. KOHA-TECH cannot delete what we never received. |
| Share URLs | Persist as long as someone keeps the link. We cannot revoke a URL we do not store. |
| Hosting logs | Limited operational period set by the host, unless a longer period is required for security or law. |

## 11. Your rights (GDPR)

You may have rights of access, rectification, deletion, restriction, objection, and portability, and the right to lodge a complaint with the Polish supervisory authority ([UODO](https://uodo.gov.pl)).

For **lesson data on your device**, use browser controls: clear site data for lectern.click, or stop sharing the student URL.

For **hosting logs or this policy**, contact [privacy@koha-tech.com](mailto:privacy@koha-tech.com). We may need to verify a request; we cannot retrieve a lesson that exists only in your browser.

## 12. Children

Lectern is a teaching tool. Teachers should not encode children’s names, contact details, or other identifying student data into share URLs. KOHA-TECH does not knowingly collect children’s data through a Lectern account, because Lectern has no accounts.

## 13. Changes

We may update this policy. The date at the top will change when we do. Material changes may also be noted on lectern.click.

## 14. Contact

**KOHA-TECH Sp. z o.o.** (trade name **Lectern**)  
Nowy Świat 33/13, 00-029 Warszawa, Poland  
KRS: 0001183713 · NIP: 5253054129 · REGON: 542256381 · Share capital: PLN 5,000

Privacy: [privacy@koha-tech.com](mailto:privacy@koha-tech.com)  
Legal: [legal@koha-tech.com](mailto:legal@koha-tech.com)  
General: [contact@koha-tech.com](mailto:contact@koha-tech.com)
