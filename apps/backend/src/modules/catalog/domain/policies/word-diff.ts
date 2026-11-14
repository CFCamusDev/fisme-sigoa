export type WordDiffSegmentType = 'EQUAL' | 'ADDED' | 'REMOVED';

export interface WordDiffSegment {
  readonly type: WordDiffSegmentType;
  readonly text: string;
}

/**
 * Tope de celdas de la tabla LCS (tokens de A por tokens de B). Un enunciado de 2000 caracteres
 * da como mucho ~1000 palabras, es decir ~1 M de celdas; por encima del tope se devuelve el
 * reemplazo completo en lugar de calcular (D2 del plan de la HU-017).
 */
const MAX_LCS_CELLS = 4_000_000;

/** Cada token es una palabra con sus espacios alrededor; así los segmentos conservan el texto. */
function tokenize(text: string): string[] {
  return text.match(/\s*\S+\s*/g) ?? [];
}

function keyOf(token: string): string {
  return token.trim();
}

function mergeSegments(segments: readonly WordDiffSegment[]): WordDiffSegment[] {
  const merged: WordDiffSegment[] = [];
  for (const segment of segments) {
    if (segment.text === '') {
      continue;
    }
    const last = merged[merged.length - 1];
    if (last && last.type === segment.type) {
      merged[merged.length - 1] = { type: last.type, text: last.text + segment.text };
    } else {
      merged.push(segment);
    }
  }
  return merged;
}

/** Orden estable dentro de un bloque cambiado: primero lo quitado y luego lo agregado. */
function orderChangedBlocks(segments: readonly WordDiffSegment[]): WordDiffSegment[] {
  const ordered: WordDiffSegment[] = [];
  let removed: WordDiffSegment[] = [];
  let added: WordDiffSegment[] = [];
  const flush = (): void => {
    ordered.push(...removed, ...added);
    removed = [];
    added = [];
  };
  for (const segment of segments) {
    if (segment.type === 'EQUAL') {
      flush();
      ordered.push(segment);
    } else if (segment.type === 'REMOVED') {
      removed.push(segment);
    } else {
      added.push(segment);
    }
  }
  flush();
  return ordered;
}

function diffMiddle(a: readonly string[], b: readonly string[]): WordDiffSegment[] {
  const n = a.length;
  const m = b.length;
  if (n === 0 && m === 0) {
    return [];
  }
  if (n === 0) {
    return [{ type: 'ADDED', text: b.join('') }];
  }
  if (m === 0) {
    return [{ type: 'REMOVED', text: a.join('') }];
  }
  if ((n + 1) * (m + 1) > MAX_LCS_CELLS) {
    return [
      { type: 'REMOVED', text: a.join('') },
      { type: 'ADDED', text: b.join('') },
    ];
  }

  const width = m + 1;
  const table = new Uint16Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        keyOf(a[i] as string) === keyOf(b[j] as string)
          ? (table[(i + 1) * width + j + 1] as number) + 1
          : Math.max(table[(i + 1) * width + j] as number, table[i * width + j + 1] as number);
    }
  }

  const segments: WordDiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (keyOf(a[i] as string) === keyOf(b[j] as string)) {
      segments.push({ type: 'EQUAL', text: b[j] as string });
      i += 1;
      j += 1;
    } else if ((table[(i + 1) * width + j] as number) >= (table[i * width + j + 1] as number)) {
      segments.push({ type: 'REMOVED', text: a[i] as string });
      i += 1;
    } else {
      segments.push({ type: 'ADDED', text: b[j] as string });
      j += 1;
    }
  }
  while (i < n) {
    segments.push({ type: 'REMOVED', text: a[i] as string });
    i += 1;
  }
  while (j < m) {
    segments.push({ type: 'ADDED', text: b[j] as string });
    j += 1;
  }
  return segments;
}

/**
 * Diferencia por palabras entre dos textos (LCS). Los segmentos `EQUAL` y `ADDED` unidos
 * reconstruyen exactamente `after`; los `EQUAL` y `REMOVED` reconstruyen `before` salvo por los
 * espacios que rodean a cada palabra, que no cuentan como cambio. Segmentos contiguos del mismo
 * tipo se funden. Es una función pura y síncrona de costo acotado por el límite del enunciado.
 */
export function diffWords(before: string, after: string): WordDiffSegment[] {
  if (before === after) {
    return before === '' ? [] : [{ type: 'EQUAL', text: after }];
  }

  const a = tokenize(before);
  const b = tokenize(after);

  let start = 0;
  while (
    start < a.length &&
    start < b.length &&
    keyOf(a[start] as string) === keyOf(b[start] as string)
  ) {
    start += 1;
  }
  let endA = a.length;
  let endB = b.length;
  while (
    endA > start &&
    endB > start &&
    keyOf(a[endA - 1] as string) === keyOf(b[endB - 1] as string)
  ) {
    endA -= 1;
    endB -= 1;
  }

  const head = b.slice(0, start).map((text): WordDiffSegment => ({ type: 'EQUAL', text }));
  const tail = b.slice(endB).map((text): WordDiffSegment => ({ type: 'EQUAL', text }));
  const middle = diffMiddle(a.slice(start, endA), b.slice(start, endB));

  return mergeSegments(orderChangedBlocks([...head, ...middle, ...tail]));
}
