# Math & formulas

Lectern typesets math with **[KaTeX](https://katex.org/)** (not MathJax). Syntax is LaTeX-like and works in **objectives**, **section source**, and **quiz prompts**.

## Inline vs display

**Inline** — inside a sentence, wrapped in single dollar signs:

```
The area of a circle is $A = \pi r^2$.
```

Rendered: The area of a circle is $A = \pi r^2$.

**Display** — centered on its own line, wrapped in double dollar signs:

```
$$
E = mc^2
$$
```

$$
E = mc^2
$$

Put display math on **its own lines** in section bodies (blank line before and after helps).

## Common commands

| You write | You get |
| --- | --- |
| `$x^2$` | $x^2$ |
| `$x_i$` | $x_i$ |
| `$\frac{a}{b}$` | $\frac{a}{b}$ |
| `$\sqrt{x}$` | $\sqrt{x}$ |
| `$\sum_{i=1}^{n} i$` | $\sum_{i=1}^{n} i$ |
| `$\alpha, \beta, \pi$` | $\alpha, \beta, \pi$ |

## Fractions

Lectern upgrades `\frac` to display-style `\dfrac` so fractions read clearly in lesson text:

```
$\frac{1}{2}$ vs $\dfrac{1}{2}$ (both render with a full-size fraction bar)
```

$\frac{1}{2}$ in context.

## Units and text

Use `\text{}` for units and words inside math:

```
$9.8\,\text{m/s}^2$  \quad  $F_{\text{net}}$
```

$9.8\,\text{m/s}^2$ and $F_{\text{net}}$.

## Greek letters and operators

```
$\Delta x$, $\mu$, $\leq$, $\geq$, $\approx$, $\times$, $\cdot$
```

$\Delta x$, $\mu$, $\leq$, $\geq$, $\approx$, $\times$, $\cdot$

## Subscripts and superscripts

```
$v_0$, $a^2 + b^2 = c^2$, $x_{n+1}$
```

$v_0$, $a^2 + b^2 = c^2$, $x_{n+1}$

## Matrices (simple)

```
$$
\begin{pmatrix} a & b \\ c & d \end{pmatrix}
$$
```

$$
\begin{pmatrix} a & b \\ c & d \end{pmatrix}
$$

## Objectives example

One objective per line; math is fine inline:

```
State Newton's second law as $F = ma$.
Relate weight $W = mg$ to gravitational field strength $g$.
```

## Limits and unsupported syntax

KaTeX covers most school and undergraduate notation. It does **not** support every LaTeX package. If something fails to render, simplify or split the expression.

Full command list: [KaTeX supported functions](https://katex.org/docs/supported.html).

For Markdown outside formulas, see the [Markdown guide](/markdown).
