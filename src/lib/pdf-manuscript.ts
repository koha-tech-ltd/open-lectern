/**
 * Parse lesson Markdown into PDF drawing blocks so export can match the on-site
 * preview: Definition / Notation / Key idea callouts, lists, tables, display math.
 */

export type PdfCalloutKind = 'definition' | 'notation' | 'takeaway' | 'example' | 'warn' | 'note';

export type PdfBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: number; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'callout'; kind: PdfCalloutKind; text: string }
  | { type: 'quote'; text: string }
  | { type: 'math'; latex: string };

const CALLOUT_HEAD =
  /^(definition|notation|takeaway|key idea|key\s*idea|note|warning|example|misconception)\b/i;

function classifyCallout(label: string): PdfCalloutKind {
  const key = label.toLowerCase().replace(/\s+/g, ' ').trim();
  if (key.startsWith('notation')) return 'notation';
  if (key.startsWith('definition')) return 'definition';
  if (key.startsWith('takeaway') || key.startsWith('key')) return 'takeaway';
  if (key.startsWith('warning') || key.startsWith('misconception')) return 'warn';
  if (key.startsWith('example')) return 'example';
  return 'note';
}

export function calloutKindFromText(text: string): PdfCalloutKind | null {
  const stripped = text.replace(/^\*+\s*/, '').trim();
  const match = stripped.match(CALLOUT_HEAD);
  return match ? classifyCallout(match[1]) : null;
}

function isFenceLine(line: string): boolean {
  return line.trim() === '$$' || /^\$\$/.test(line.trim());
}

function splitTableRow(line: string): string[] {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|')) row = row.slice(0, -1);
  return row.split('|').map((cell) => cell.trim());
}

/** GFM alignment row: `---`, `:---`, `---:`, `:---:` per cell. */
export function isTableSeparator(line: string): boolean {
  if (!line.includes('-')) return false;
  const cells = splitTableRow(line);
  if (cells.length === 0) return false;
  let dashCells = 0;
  for (const cell of cells) {
    const compact = cell.replace(/\s/g, '');
    if (!compact) continue;
    if (!/^:?-{1,}:?$/.test(compact)) return false;
    dashCells += 1;
  }
  return dashCells >= 1;
}

export function normalizePdfTable(
  headers: string[],
  rows: string[][],
): { headers: string[]; rows: string[][] } {
  const cols = Math.max(headers.length, 1);
  const pad = (cells: string[]) => Array.from({ length: cols }, (_, i) => cells[i] ?? '');
  return { headers: pad(headers), rows: rows.map(pad) };
}

function isUnorderedItem(line: string): boolean {
  return /^\s*[-*]\s+\S/.test(line);
}

function isOrderedItem(line: string): boolean {
  return /^\s*\d+\.\s+\S/.test(line);
}

function listItemText(line: string): string {
  return line.replace(/^\s*(?:[-*]|\d+\.)\s+/, '');
}

function stripQuotePrefix(line: string): string {
  return line.replace(/^>\s?/, '');
}

function looksLikeBlockStart(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (isFenceLine(trimmed)) return true;
  if (/^#{1,6}\s+\S/.test(trimmed)) return true;
  if (line.startsWith('>')) return true;
  if (isUnorderedItem(line) || isOrderedItem(line)) return true;
  if (trimmed.includes('|') && trimmed.split('|').length >= 3) return true;
  return false;
}

/** Common TeX in lesson tables/callouts → readable PDF glyphs. */
export function softenPdfMath(text: string): string {
  return text
    .replace(/\\mathrm\{([^}]+)\}/g, '$1')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\xrightarrow\{([^}]*)\}/g, ' → ')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\ll/g, '≪')
    .replace(/\\gg/g, '≫')
    .replace(/\\approx/g, '≈')
    .replace(/\\neq/g, '≠')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\max/g, 'max')
    .replace(/\\min/g, 'min')
    .replace(/\\,/g, ' ')
    .replace(/\\ /g, ' ')
    .replace(/~/g, ' ');
}

/**
 * Inline tidy for a single PDF run: NFC, strip $ delimiters, unwrap links/code.
 * Emphasis markers stay so the drawer can apply bold/italic faces.
 * Pipes are kept — GFM tables are parsed as blocks, not rewritten as box-drawing.
 */
export function preparePdfInline(text: string): string {
  return softenPdfMath(
    text
      .normalize('NFC')
      .replace(/\r\n/g, '\n')
      .replace(/\$\$([\s\S]+?)\$\$/g, (_, math: string) => math.trim())
      .replace(/\$([^$\n]+)\$/g, (_, math: string) => math.trim())
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  );
}

export function parsePdfManuscript(source: string): PdfBlock[] {
  const text = source.replace(/\r\n/g, '\n').normalize('NFC');
  if (!text.trim()) return [];
  const lines = text.split('\n');
  const blocks: PdfBlock[] = [];
  let i = 0;

  const pushParagraph = (raw: string) => {
    const body = raw.replace(/\n{3,}/g, '\n\n').trim();
    if (body) blocks.push({ type: 'paragraph', text: body });
  };

  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (!line.trim()) {
      i += 1;
      continue;
    }

    const trimmed = line.trim();

    if (isFenceLine(trimmed)) {
      const first = trimmed === '$$' ? '' : trimmed.replace(/^\$\$/, '').replace(/\$\$$/, '');
      const mathLines: string[] = first ? [first] : [];
      i += 1;
      if (!trimmed.endsWith('$$') || trimmed === '$$') {
        while (i < lines.length) {
          const row = lines[i] ?? '';
          i += 1;
          if (row.trim() === '$$' || row.trim().endsWith('$$')) {
            const inner = row.trim() === '$$' ? '' : row.trim().replace(/\$\$$/, '');
            if (inner) mathLines.push(inner);
            break;
          }
          mathLines.push(row);
        }
      }
      const latex = mathLines.join('\n').trim();
      if (latex) blocks.push({ type: 'math', latex });
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].trim() });
      i += 1;
      continue;
    }

    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length) {
        const row = lines[i] ?? '';
        if (row.startsWith('>')) {
          quoteLines.push(stripQuotePrefix(row));
          i += 1;
          continue;
        }
        break;
      }
      const body = quoteLines.join('\n').trim();
      if (!body) continue;
      const kind = calloutKindFromText(body);
      if (kind) blocks.push({ type: 'callout', kind, text: body });
      else blocks.push({ type: 'quote', text: body });
      continue;
    }

    if (trimmed.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1] ?? '')) {
      const rawHeaders = splitTableRow(line);
      i += 2;
      const rawRows: string[][] = [];
      while (i < lines.length) {
        const row = lines[i] ?? '';
        if (!row.trim() || !row.includes('|') || isTableSeparator(row)) break;
        rawRows.push(splitTableRow(row));
        i += 1;
      }
      const { headers, rows } = normalizePdfTable(rawHeaders, rawRows);
      if (headers.some((cell) => cell.length > 0)) {
        blocks.push({ type: 'table', headers, rows });
      }
      continue;
    }

    if (isUnorderedItem(line) || isOrderedItem(line)) {
      const ordered = isOrderedItem(line);
      const items: string[] = [];
      while (i < lines.length) {
        const row = lines[i] ?? '';
        if (ordered ? isOrderedItem(row) : isUnorderedItem(row)) {
          items.push(listItemText(row));
          i += 1;
          continue;
        }
        break;
      }
      if (items.length > 0) blocks.push({ type: 'list', ordered, items });
      continue;
    }

    const para: string[] = [line];
    i += 1;
    while (i < lines.length) {
      const row = lines[i] ?? '';
      if (!row.trim() || looksLikeBlockStart(row)) break;
      para.push(row);
      i += 1;
    }
    pushParagraph(para.join('\n'));
  }

  return blocks;
}
