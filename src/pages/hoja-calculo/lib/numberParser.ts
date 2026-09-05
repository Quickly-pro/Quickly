/**
 * Convierte un texto de celda a número, detectando automáticamente si usa
 * formato europeo (1.234,56) o anglosajón (1,234.56) — mirando cuántos
 * dígitos hay después del último separador: 3 dígitos casi siempre es
 * separador de miles, 1-2 dígitos casi siempre es el decimal.
 */
export function parseNumericValue(raw: string): number {
  if (!raw) return NaN;
  const s = raw.trim().replace(/[€$\s]/g, '');
  if (!s) return NaN;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  const lastSep = Math.max(lastComma, lastDot);

  if (lastSep === -1) return parseFloat(s);

  const fracLen = s.length - lastSep - 1;
  if (fracLen === 3 && /^\d{3}$/.test(s.slice(lastSep + 1))) {
    // Parece separador de miles (ej. "1,200" o "1.200") — se quitan todos
    return parseFloat(s.replace(/[.,]/g, ''));
  }

  // El último separador es el decimal — el resto (si hay) son de miles
  const intPart = s.slice(0, lastSep).replace(/[.,]/g, '');
  const fracPart = s.slice(lastSep + 1).replace(/\D/g, '');
  const sign = intPart.startsWith('-') ? '-' : '';
  return parseFloat(`${sign}${intPart.replace('-', '') || '0'}.${fracPart || '0'}`);
}

/**
 * Analiza todas las columnas de un rango de filas y sugiere cuál usar
 * como etiqueta (la que tiene más texto no numérico) y cuál como valor
 * (la que tiene más números válidos) — para que el gráfico funcione bien
 * desde el primer intento, sin que el usuario tenga que adivinar.
 */
export function detectBestColumns(previewValues: string[][], colCount: number): { labelCol: number; valueCol: number } {
  const stats = Array.from({ length: colCount }, (_, ci) => {
    let numCount = 0;
    let textCount = 0;
    previewValues.forEach(row => {
      const raw = row[ci] || '';
      if (!raw) return;
      const isNum = !Number.isNaN(parseNumericValue(raw));
      if (isNum) numCount++;
      else textCount++;
    });
    return { ci, numCount, textCount };
  });

  const bestValue = stats.reduce((best, c) => (c.numCount > best.numCount ? c : best), stats[0]);
  const bestLabel = stats.reduce((best, c) => (c.textCount > best.textCount ? c : best), stats[0]);

  // Si por lo que sea coinciden, se busca la segunda mejor opción de texto
  if (bestLabel.ci === bestValue.ci) {
    const alt = stats
      .filter(c => c.ci !== bestValue.ci)
      .reduce((best, c) => (!best || c.textCount > best.textCount ? c : best), null as typeof stats[0] | null);
    if (alt && alt.textCount > 0) return { labelCol: alt.ci, valueCol: bestValue.ci };
  }

  return { labelCol: bestLabel.ci, valueCol: bestValue.ci };
}
