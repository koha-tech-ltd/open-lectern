# Markdown in Lectern

Lectern renders lesson text with **GitHub Flavored Markdown (GFM)** plus a few textbook-style callouts. You can use this syntax in **objectives**, **section source**, and **quiz prompts**.

## Basics

**Bold** with `**double asterisks**`. *Italic* with `*single asterisks*`.

Links: `[visible text](https://example.com)` or internal paths like `[Math guide](/math)`.

## Headings

```markdown
## Section heading
### Subheading
```

Use headings sparingly inside objectives (one line per goal). They work well in section bodies.

## Lists

Unordered:

- First item
- Second item

Ordered:

1. Step one
2. Step two

## Paragraphs

Separate paragraphs with a **blank line**. In section bodies, write full manuscript prose this way. Objectives are usually one short line each.

## Blockquotes and callouts

A plain quote:

> This is a general blockquote.

Lectern recognizes **labeled callouts** when the blockquote starts with one of these labels (case-insensitive):

> **Definition.** A term is a precise name for an idea students must recognize.

> **Takeaway.** One sentence students should remember after this section.

> **Notation.** We write $F = ma$ for force, mass, and acceleration.

> **Note.** Optional detail that clarifies without changing the main argument.

> **Misconception.** Students often think heavier objects fall faster — they do not, in vacuum.

> **Example.** A 2 kg book on a desk experiences normal force $N \approx 19.6\,\text{N}$ near Earth's surface.

Supported labels: **Definition**, **Takeaway**, **Notation**, **Note**, **Warning**, **Example**, **Key idea**, **Misconception**.

## Tables

| Quantity | Symbol | Unit |
| --- | --- | --- |
| Force | $F$ | N |
| Mass | $m$ | kg |

## Code (inline and fenced)

Inline code: `` `H_2O` `` → `H_2O`

Fenced block:

```
photosynthesis: 6 CO2 + 6 H2O → C6H12O6 + 6 O2
```

## Math in Markdown

Inline math uses `$...$`. Display equations use `$$...$$` on their own lines. See the [Math & formulas](/math) guide for KaTeX details.

Example objective line:

```
Explain why **velocity** is a vector and write $v = \Delta x / \Delta t$.
```

## Where this applies

| Field | Markdown | Math |
| --- | --- | --- |
| Objectives | Yes (one per line) | Yes |
| Section source | Yes | Yes |
| Quiz prompts | Yes | Yes |

When you edit **Source**, use the live preview below the textarea to check rendering before publishing.
