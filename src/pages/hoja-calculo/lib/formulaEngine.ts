// Formula engine for spreadsheet: SUM, AVERAGE, COUNT

const COL_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

function colLabelToIndex(label: string): number {
  return COL_LABELS.indexOf(label.toUpperCase());
}

export function cellRefToCoords(ref: string): { row: number; col: number } | null {
  // Matches A1, B12, AA1 etc. (we only support single letters)
  const match = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;
  const col = colLabelToIndex(match[1]);
  const row = parseInt(match[2], 10) - 1;
  if (col === -1 || row < 0) return null;
  return { row, col };
}

export function parseRange(range: string): { startRow: number; startCol: number; endRow: number; endCol: number } | null {
  const parts = range.split(':');
  if (parts.length !== 2) return null;
  const start = cellRefToCoords(parts[0]);
  const end = cellRefToCoords(parts[1]);
  if (!start || !end) return null;
  return {
    startRow: Math.min(start.row, end.row),
    startCol: Math.min(start.col, end.col),
    endRow: Math.max(start.row, end.row),
    endCol: Math.max(start.col, end.col),
  };
}

export function getCellValueNumeric(row: number, col: number, cells: Record<string, { value?: string }>): number {
  const key = `${row}-${col}`;
  const val = cells[key]?.value || '';
  // Try to parse number (handle comma as decimal separator for Spanish numbers)
  const cleaned = val.replace(/\./g, '').replace(/,/g, '.');
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? 0 : num;
}

export function getCellValueRaw(row: number, col: number, cells: Record<string, { value?: string }>): string {
  const key = `${row}-${col}`;
  return cells[key]?.value || '';
}

export function evaluateFormula(
  formula: string,
  cells: Record<string, { value?: string }>
): { result: string; error?: string } {
  const trimmed = formula.trim();
  if (!trimmed.startsWith('=')) {
    return { result: trimmed };
  }

  const expr = trimmed.slice(1).trim().toUpperCase();

  // SUM(range)
  const sumMatch = expr.match(/^SUM\((.+)\)$/);
  if (sumMatch) {
    const range = parseRange(sumMatch[1]);
    if (!range) return { result: '', error: '#RANGO!' };
    let total = 0;
    for (let r = range.startRow; r <= range.endRow; r++) {
      for (let c = range.startCol; c <= range.endCol; c++) {
        total += getCellValueNumeric(r, c, cells);
      }
    }
    return { result: total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) };
  }

  // AVERAGE(range)
  const avgMatch = expr.match(/^AVERAGE\((.+)\)$/);
  if (avgMatch) {
    const range = parseRange(avgMatch[1]);
    if (!range) return { result: '', error: '#RANGO!' };
    let total = 0;
    let count = 0;
    for (let r = range.startRow; r <= range.endRow; r++) {
      for (let c = range.startCol; c <= range.endCol; c++) {
        const val = getCellValueNumeric(r, c, cells);
        total += val;
        if (getCellValueRaw(r, c, cells).trim()) count++;
      }
    }
    if (count === 0) return { result: '', error: '#DIV/0!' };
    const avg = total / count;
    return { result: avg.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) };
  }

  // COUNT(range)
  const countMatch = expr.match(/^COUNT\((.+)\)$/);
  if (countMatch) {
    const range = parseRange(countMatch[1]);
    if (!range) return { result: '', error: '#RANGO!' };
    let count = 0;
    for (let r = range.startRow; r <= range.endRow; r++) {
      for (let c = range.startCol; c <= range.endCol; c++) {
        if (getCellValueRaw(r, c, cells).trim()) count++;
      }
    }
    return { result: String(count) };
  }

  // COUNTA(range) — counts non-empty
  const countaMatch = expr.match(/^COUNTA\((.+)\)$/);
  if (countaMatch) {
    const range = parseRange(countaMatch[1]);
    if (!range) return { result: '', error: '#RANGO!' };
    let count = 0;
    for (let r = range.startRow; r <= range.endRow; r++) {
      for (let c = range.startCol; c <= range.endCol; c++) {
        if (getCellValueRaw(r, c, cells).trim()) count++;
      }
    }
    return { result: String(count) };
  }

  // MIN(range)
  const minMatch = expr.match(/^MIN\((.+)\)$/);
  if (minMatch) {
    const range = parseRange(minMatch[1]);
    if (!range) return { result: '', error: '#RANGO!' };
    let min: number | null = null;
    for (let r = range.startRow; r <= range.endRow; r++) {
      for (let c = range.startCol; c <= range.endCol; c++) {
        const val = getCellValueNumeric(r, c, cells);
        const raw = getCellValueRaw(r, c, cells).trim();
        if (raw && (min === null || val < min)) min = val;
      }
    }
    if (min === null) return { result: '', error: '#VACÍO!' };
    return { result: min.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) };
  }

  // MAX(range)
  const maxMatch = expr.match(/^MAX\((.+)\)$/);
  if (maxMatch) {
    const range = parseRange(maxMatch[1]);
    if (!range) return { result: '', error: '#RANGO!' };
    let max: number | null = null;
    for (let r = range.startRow; r <= range.endRow; r++) {
      for (let c = range.startCol; c <= range.endCol; c++) {
        const val = getCellValueNumeric(r, c, cells);
        const raw = getCellValueRaw(r, c, cells).trim();
        if (raw && (max === null || val > max)) max = val;
      }
    }
    if (max === null) return { result: '', error: '#VACÍO!' };
    return { result: max.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) };
  }

  return { result: '', error: '#FÓRMULA!' };
}

export function isFormula(value: string): boolean {
  return value.trim().startsWith('=');
}

export function getDisplayValue(
  value: string,
  cells: Record<string, { value?: string }>,
  numberFormat: string
): string {
  if (!isFormula(value)) {
    // Format non-formula based on number_format
    if (numberFormat === 'currency') {
      const num = parseFloat(value.replace(/\./g, '').replace(/,/g, '.'));
      if (!Number.isNaN(num)) {
        return num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
      }
    }
    if (numberFormat === 'percentage') {
      const num = parseFloat(value);
      if (!Number.isNaN(num)) {
        return (num * 100).toFixed(1) + '%';
      }
    }
    if (numberFormat === 'number') {
      const num = parseFloat(value.replace(/\./g, '').replace(/,/g, '.'));
      if (!Number.isNaN(num)) {
        return num.toLocaleString('es-ES');
      }
    }
    return value;
  }

  const { result, error } = evaluateFormula(value, cells);
  if (error) return error;
  return result;
}