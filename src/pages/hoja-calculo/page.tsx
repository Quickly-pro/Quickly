import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import SpreadsheetCell from './components/SpreadsheetCell';
import CellPropertiesPanel from './components/CellPropertiesPanel';
import CSVImporter from './components/CSVImporter';
import SpreadsheetChart from './components/SpreadsheetChart';
import ChartConfigModal from './components/ChartConfigModal';
import PremiumGate from '@/components/feature/PremiumGate';
import { getDisplayValue, isFormula } from './lib/formulaEngine';

const ROWS = 50;
const COLS = 12;
const colLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

interface Palette {
  id?: number;
  name: string;
  colors: string[];
  is_active?: boolean;
  is_default?: boolean;
}

interface CellMeta {
  value: string;
  color_index: number;
  is_bold?: boolean;
  text_align?: string;
  number_format?: string;
}

interface ChartDef {
  id: string;
  title: string;
  type: 'bar' | 'pie' | 'line';
  color: string;
  startRow: number;
  endRow: number;
  labelCol: number;
  valueCol: number;
}

const DEFAULT_PALETTES: Palette[] = [
  { name: 'Clásico', colors: ['#ffffff', '#ffebee', '#e8f5e9', '#e3f2fd', '#fff3e0', '#f3e5f5', '#e0f7fa', '#fce4ec', '#f1f8e9', '#ede7f6'] },
  { name: 'Pastel', colors: ['#ffffff', '#ffe0b2', '#c8e6c9', '#bbdefb', '#ffccbc', '#e1bee7', '#b2dfdb', '#f8bbd0', '#dcedc8', '#d1c4e9'] },
  { name: 'Vivo', colors: ['#ffffff', '#ff5722', '#4caf50', '#2196f3', '#ff9800', '#9c27b0', '#00bcd4', '#e91e63', '#8bc34a', '#673ab7'] },
];

const SAMPLE_DATA: Record<string, string> = {
  '0-0': 'Envío', '0-1': 'Cliente', '0-2': 'Tipo', '0-3': 'Peso (kg)', '0-4': 'Precio (€)', '0-5': 'Fecha',
  '1-0': 'EXP-10234', '1-1': 'Ferretería El Martillo', '1-2': 'Paquete 5kg', '1-3': '4.2', '1-4': '4.50', '1-5': '04/05/26',
  '2-0': 'EXP-10235', '2-1': 'Muebles Casa Nova', '2-2': 'Sofá 3 plazas', '2-3': '85.0', '2-4': '85.00', '2-5': '04/05/26',
  '3-0': 'EXP-10236', '3-1': 'ElectroMart S.A.', '3-2': 'Nevera americana', '3-3': '120.0', '3-4': '120.00', '3-5': '03/05/26',
  '4-0': 'EXP-10237', '4-1': 'AutoTaller Ruiz', '4-2': 'Transporte coche', '4-3': '1,200', '4-4': '350.00', '4-5': '03/05/26',
  '5-0': 'EXP-10238', '5-1': 'Construcciones López', '5-2': 'Palets cemento', '5-3': '1,000', '5-4': '180.00', '5-5': '02/05/26',
};

function getCellKey(row: number, col: number) {
  return `${row}-${col}`;
}

function buildInitialData(): Record<string, CellMeta> {
  const data: Record<string, CellMeta> = {};
  Object.entries(SAMPLE_DATA).forEach(([key, value]) => {
    const [row, col] = key.split('-').map(Number);
    data[key] = {
      value, color_index: 0, is_bold: false, text_align: 'left', number_format: 'text',
    };
  });
  return data;
}

export default function HojaCalculo() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [palettes, setPalettes] = useState<Palette[]>(DEFAULT_PALETTES);
  const [activePaletteIndex, setActivePaletteIndex] = useState(0);
  const [cellData, setCellData] = useState<Record<string, CellMeta>>(buildInitialData);
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [showChartConfig, setShowChartConfig] = useState(false);
  const [charts, setCharts] = useState<ChartDef[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedRef = useRef(false);
  const [formulaBar, setFormulaBar] = useState('');

  const activePalette = palettes[activePaletteIndex] || DEFAULT_PALETTES[0];

  // Load charts from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('spreadsheet_charts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setCharts(parsed);
      } catch { /* ignore */ }
    }
  }, []);

  // Save charts to localStorage
  useEffect(() => {
    localStorage.setItem('spreadsheet_charts', JSON.stringify(charts));
  }, [charts]);

  // Range selection helpers
  const selectedRange = useMemo(() => {
    if (!selectedCell) return null;
    const [sr, sc] = selectedCell.split('-').map(Number);
    if (!rangeEnd) return { startRow: sr, startCol: sc, endRow: sr, endCol: sc };
    const [er, ec] = rangeEnd.split('-').map(Number);
    return {
      startRow: Math.min(sr, er),
      startCol: Math.min(sc, ec),
      endRow: Math.max(sr, er),
      endCol: Math.max(sc, ec),
    };
  }, [selectedCell, rangeEnd]);

  const isCellInRange = useCallback((row: number, col: number) => {
    if (!selectedRange) return false;
    const key = getCellKey(row, col);
    if (key === selectedCell || key === rangeEnd) return true;
    return row >= selectedRange.startRow && row <= selectedRange.endRow &&
           col >= selectedRange.startCol && col <= selectedRange.endCol;
  }, [selectedRange, selectedCell, rangeEnd]);

  // Load palettes from Supabase
  const loadPalettes = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('spreadsheet_palettes')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order');

    if (error || !data || data.length === 0) {
      return;
    }

    const loaded: Palette[] = data.map(p => ({
      id: p.id,
      name: p.name,
      colors: Array.isArray(p.colors) ? p.colors : JSON.parse(p.colors || '[]'),
      is_active: p.is_active,
      is_default: p.is_default,
    }));

    setPalettes(loaded);
    const activeIdx = loaded.findIndex(p => p.is_active);
    if (activeIdx >= 0) setActivePaletteIndex(activeIdx);
  }, [user?.id]);

  // Load cell data from Supabase
  const loadCellData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('spreadsheet_cells')
      .select('row_index, col_index, value, color_index, is_bold, text_align, number_format')
      .eq('user_id', user.id)
      .limit(2000);

    if (error) {
      console.error('Error loading spreadsheet data:', error);
      setLoading(false);
      return;
    }

    const loaded: Record<string, CellMeta> = {};
    Object.entries(SAMPLE_DATA).forEach(([key, value]) => {
      const [row, col] = key.split('-').map(Number);
      loaded[key] = {
        value, color_index: 0, is_bold: false, text_align: 'left', number_format: 'text',
      };
    });

    (data || []).forEach((cell: any) => {
      const key = getCellKey(cell.row_index, cell.col_index);
      loaded[key] = {
        value: cell.value || '',
        color_index: cell.color_index ?? 0,
        is_bold: cell.is_bold ?? false,
        text_align: cell.text_align || 'left',
        number_format: cell.number_format || 'text',
      };
    });

    setCellData(loaded);
    setLoading(false);
    hasLoadedRef.current = true;
  }, [user?.id]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadPalettes(), loadCellData()]);
  }, [loadPalettes, loadCellData]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('spreadsheet-cells-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'spreadsheet_cells', filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const cell = payload.new as any;
            const key = getCellKey(cell.row_index, cell.col_index);
            setCellData(prev => ({
              ...prev,
              [key]: {
                value: cell.value || '',
                color_index: cell.color_index ?? 0,
                is_bold: cell.is_bold ?? false,
                text_align: cell.text_align || 'left',
                number_format: cell.number_format || 'text',
              },
            }));
          } else if (payload.eventType === 'DELETE') {
            const cell = payload.old as any;
            const key = getCellKey(cell.row_index, cell.col_index);
            setCellData(prev => {
              const next = { ...prev };
              delete next[key];
              return next;
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Save cell to Supabase
  const saveCellToSupabase = useCallback(async (
    row: number, col: number, meta: CellMeta
  ) => {
    if (!user?.id) return;
    try {
      const { error } = await supabase.from('spreadsheet_cells').upsert({
        user_id: user.id,
        row_index: row,
        col_index: col,
        value: meta.value || null,
        color_index: meta.color_index,
        is_bold: meta.is_bold ?? false,
        text_align: meta.text_align || 'left',
        number_format: meta.number_format || 'text',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,row_index,col_index' });

      if (error) {
        console.error('Error saving cell:', error);
      } else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 1500);
      }
    } catch (e) {
      console.error('Save error:', e);
    }
  }, [user?.id]);

  const savePaletteSelection = useCallback(async (paletteId: number) => {
    if (!user?.id) return;
    await supabase.from('spreadsheet_palettes').update({ is_active: false }).eq('user_id', user.id);
    await supabase.from('spreadsheet_palettes').update({ is_active: true }).eq('id', paletteId).eq('user_id', user.id);
  }, [user?.id]);

  const getCellMeta = useCallback((row: number, col: number): CellMeta => {
    const key = getCellKey(row, col);
    return cellData[key] || {
      value: '', color_index: 0, is_bold: false, text_align: 'left', number_format: 'text',
    };
  }, [cellData]);

  const getCellColor = useCallback((row: number, col: number) => {
    const meta = getCellMeta(row, col);
    return activePalette.colors[meta.color_index % activePalette.colors.length];
  }, [getCellMeta, activePalette]);

  const handleSelectCell = useCallback((row: number, col: number) => {
    const key = getCellKey(row, col);
    setSelectedCell(key);
    setRangeEnd(null);
    setEditingCell(null);
    setFormulaBar(cellData[key]?.value || '');
  }, [cellData]);

  const handleRangeSelect = useCallback((row: number, col: number) => {
    const key = getCellKey(row, col);
    setRangeEnd(key);
    setEditingCell(null);
  }, []);

  // Chart creation
  const handleCreateChart = useCallback((config: {
    title: string;
    type: 'bar' | 'pie' | 'line';
    labelCol: number;
    valueCol: number;
    color: string;
    startRow: number;
    endRow: number;
  }) => {
    const newChart: ChartDef = {
      id: `chart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: config.title,
      type: config.type,
      color: config.color,
      startRow: config.startRow,
      endRow: config.endRow,
      labelCol: config.labelCol,
      valueCol: config.valueCol,
    };
    setCharts(prev => [...prev, newChart]);
    setShowChartConfig(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  }, []);

  const handleRemoveChart = useCallback((id: string) => {
    setCharts(prev => prev.filter(c => c.id !== id));
  }, []);

  // Extract chart data from cellData
  const getChartData = useCallback((chart: ChartDef) => {
    const rows: { label: string; value: number }[] = [];
    for (let r = chart.startRow; r <= chart.endRow; r++) {
      const labelMeta = cellData[getCellKey(r, chart.labelCol)];
      const valueMeta = cellData[getCellKey(r, chart.valueCol)];
      const label = labelMeta?.value || '';
      const rawVal = valueMeta?.value || '';
      const cleaned = rawVal.replace(/\./g, '').replace(/,/g, '.');
      const num = parseFloat(cleaned);
      if (label && !Number.isNaN(num)) {
        rows.push({ label, value: num });
      }
    }
    return rows;
  }, [cellData]);

  // Get preview values for chart config
  const getChartPreviewValues = useCallback(() => {
    if (!selectedRange) return [];
    const rows: string[][] = [];
    for (let r = selectedRange.startRow; r <= selectedRange.endRow; r++) {
      const row: string[] = [];
      for (let c = 0; c < COLS; c++) {
        row.push(cellData[getCellKey(r, c)]?.value || '');
      }
      rows.push(row);
    }
    return rows;
  }, [selectedRange, cellData]);

  const handleStartEdit = useCallback((row: number, col: number) => {
    if (row === 0) return;
    const key = getCellKey(row, col);
    setSelectedCell(key);
    setEditingCell(key);
  }, []);

  const handleFinishEdit = useCallback((row: number, col: number, value: string) => {
    const key = getCellKey(row, col);
    setEditingCell(null);
    setFormulaBar(value);

    const prev = cellData[key];
    if (prev?.value === value) return;

    const nextMeta: CellMeta = {
      value,
      color_index: prev?.color_index ?? 0,
      is_bold: prev?.is_bold ?? false,
      text_align: prev?.text_align ?? 'left',
      number_format: prev?.number_format ?? 'text',
    };

    setCellData(prevData => ({ ...prevData, [key]: nextMeta }));
    setIsDirty(true);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveCellToSupabase(row, col, nextMeta);
    }, 500);
  }, [cellData, saveCellToSupabase]);

  const handleToggleColor = useCallback((row: number, col: number) => {
    const key = getCellKey(row, col);
    setCellData(prev => {
      const current = prev[key] || { value: '', color_index: 0, is_bold: false, text_align: 'left', number_format: 'text' };
      const nextColorIndex = (current.color_index + 1) % activePalette.colors.length;
      const next = { ...prev, [key]: { ...current, color_index: nextColorIndex } };

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveCellToSupabase(row, col, next[key]);
      }, 300);

      return next;
    });
  }, [activePalette, saveCellToSupabase]);

  const handleBoldChange = useCallback((bold: boolean) => {
    if (!selectedCell) return;
    const [row, col] = selectedCell.split('-').map(Number);
    if (row === 0) return;
    const key = selectedCell;

    setCellData(prev => {
      const current = prev[key] || { value: '', color_index: 0, is_bold: false, text_align: 'left', number_format: 'text' };
      const next = { ...prev, [key]: { ...current, is_bold: bold } };

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveCellToSupabase(row, col, next[key]);
      }, 300);

      return next;
    });
  }, [selectedCell, saveCellToSupabase]);

  const handleAlignChange = useCallback((align: string) => {
    if (!selectedCell) return;
    const [row, col] = selectedCell.split('-').map(Number);
    const key = selectedCell;

    setCellData(prev => {
      const current = prev[key] || { value: '', color_index: 0, is_bold: false, text_align: 'left', number_format: 'text' };
      const next = { ...prev, [key]: { ...current, text_align: align } };

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveCellToSupabase(row, col, next[key]);
      }, 300);

      return next;
    });
  }, [selectedCell, saveCellToSupabase]);

  const handleFormatChange = useCallback((format: string) => {
    if (!selectedCell) return;
    const [row, col] = selectedCell.split('-').map(Number);
    const key = selectedCell;

    setCellData(prev => {
      const current = prev[key] || { value: '', color_index: 0, is_bold: false, text_align: 'left', number_format: 'text' };
      const next = { ...prev, [key]: { ...current, number_format: format } };

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveCellToSupabase(row, col, next[key]);
      }, 300);

      return next;
    });
  }, [selectedCell, saveCellToSupabase]);

  const handleChangePalette = useCallback((index: number) => {
    setActivePaletteIndex(index);
    const p = palettes[index];
    if (p?.id && user?.id) {
      savePaletteSelection(p.id);
    }
  }, [palettes, user?.id, savePaletteSelection]);

  // Formula bar edit
  const handleFormulaBarChange = useCallback((newValue: string) => {
    if (!selectedCell || editingCell) return;
    const [row, col] = selectedCell.split('-').map(Number);
    if (row === 0) return;

    handleFinishEdit(row, col, newValue);
  }, [selectedCell, editingCell, handleFinishEdit]);

  // Export CSV
  const exportCSV = useCallback(() => {
    const rows: string[][] = [];
    for (let r = 0; r < ROWS; r++) {
      const rowData: string[] = [];
      let hasData = false;
      for (let c = 0; c < COLS; c++) {
        const meta = getCellMeta(r, c);
        const val = meta.value;
        if (val) hasData = true;
        rowData.push(`"${(val || '').replace(/"/g, '""')}"`);
      }
      if (hasData) rows.push(rowData);
    }

    const headerRow = colLabels.map(l => `"${l}"`);
    const csv = [headerRow.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hoja-calculo-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  }, [getCellMeta]);

  // Import CSV
  const handleImportCSV = useCallback((rows: string[][], startRow?: number, startCol?: number) => {
    const baseRow = startRow ?? 1;
    const baseCol = startCol ?? 0;

    const updates: Record<string, CellMeta> = {};
    rows.forEach((row, ri) => {
      row.forEach((cell, ci) => {
        const r = baseRow - 1 + ri;
        const c = baseCol + ci;
        if (r < ROWS && c < COLS) {
          const key = getCellKey(r, c);
          updates[key] = {
            value: cell,
            color_index: 0,
            is_bold: false,
            text_align: 'left',
            number_format: 'text',
          };
        }
      });
    });

    setCellData(prev => ({ ...prev, ...updates }));
    setIsDirty(true);
    setShowImporter(false);

    // Bulk save
    if (!user?.id) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      const payload = Object.entries(updates).map(([key, meta]) => {
        const [r, c] = key.split('-').map(Number);
        return {
          user_id: user.id,
          row_index: r,
          col_index: c,
          value: meta.value || null,
          color_index: meta.color_index,
          is_bold: meta.is_bold,
          text_align: meta.text_align,
          number_format: meta.number_format,
          updated_at: new Date().toISOString(),
        };
      });
      await supabase.from('spreadsheet_cells').upsert(payload, { onConflict: 'user_id,row_index,col_index' });
    }, 1000);
  }, [user?.id]);

  // Save all
  const saveAllToSupabase = useCallback(async () => {
    if (!user?.id) return;
    setSaving(true);

    const cells = Object.entries(cellData).filter(([, meta]) => meta.value || meta.color_index > 0 || meta.is_bold);
    if (cells.length === 0) {
      setSaving(false);
      return;
    }

    const payload = cells.map(([key, meta]) => {
      const [r, c] = key.split('-').map(Number);
      return {
        user_id: user.id,
        row_index: r,
        col_index: c,
        value: meta.value || null,
        color_index: meta.color_index,
        is_bold: meta.is_bold ?? false,
        text_align: meta.text_align || 'left',
        number_format: meta.number_format || 'text',
        updated_at: new Date().toISOString(),
      };
    });

    const { error } = await supabase.from('spreadsheet_cells').upsert(payload, {
      onConflict: 'user_id,row_index,col_index',
    });

    setSaving(false);
    if (error) {
      console.error('Batch save error:', error);
    } else {
      setIsDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  }, [cellData, user?.id]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedCell) return;
      const [row, col] = selectedCell.split('-').map(Number);

      // Ctrl+B = bold
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        if (row > 0) handleBoldChange(!(cellData[selectedCell]?.is_bold ?? false));
        return;
      }

      if (editingCell) {
        if (e.key === 'Escape') {
          setEditingCell(null);
          return;
        }
        return;
      }

      // Clear range selection on Escape
      if (e.key === 'Escape') {
        setRangeEnd(null);
        return;
      }

      let newRow = row;
      let newCol = col;

      switch (e.key) {
        case 'ArrowUp':
          newRow = Math.max(0, row - 1);
          break;
        case 'ArrowDown':
          newRow = Math.min(ROWS - 1, row + 1);
          break;
        case 'ArrowLeft':
          newCol = Math.max(0, col - 1);
          break;
        case 'ArrowRight':
          newCol = Math.min(COLS - 1, col + 1);
          break;
        case 'Enter':
          if (row > 0) handleStartEdit(row, col);
          return;
        case ' ':
          e.preventDefault();
          handleToggleColor(row, col);
          return;
        default:
          return;
      }

      e.preventDefault();
      const newKey = getCellKey(newRow, newCol);
      setSelectedCell(newKey);
      setFormulaBar(cellData[newKey]?.value || '');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, editingCell, handleStartEdit, handleToggleColor, handleBoldChange, cellData]);

  // Stats
  const filledCells = useMemo(() => Object.values(cellData).filter(c => c.value).length, [cellData]);
  const coloredCells = useMemo(() => Object.values(cellData).filter(c => c.color_index > 0).length, [cellData]);
  const formulaCells = useMemo(() => Object.values(cellData).filter(c => isFormula(c.value)).length, [cellData]);

  const selectedMeta = selectedCell ? cellData[selectedCell] || null : null;
  const selectedColor = selectedCell ? getCellColor(...selectedCell.split('-').map(Number)) : '#ffffff';

  return (
    <PremiumGate>
      <div className="flex flex-col h-[calc(100vh-64px)]">
        {/* Top bar with formula bar */}
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900">
          {/* Name box */}
          <div className="flex-shrink-0 w-14 sm:w-20 px-1.5 sm:px-2 py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded text-xs font-medium text-gray-600 dark:text-slate-300 text-center">
            {selectedCell ? `${colLabels[parseInt(selectedCell.split('-')[1])]}${parseInt(selectedCell.split('-')[0]) + 1}` : '—'}
          </div>
          {/* Formula bar */}
          <div className="flex-1 flex items-center gap-1.5 sm:gap-2">
            <div className="hidden sm:flex w-6 h-6 items-center justify-center text-gray-400 dark:text-slate-500 flex-shrink-0">
              <i className="ri-function-line" />
            </div>
            <input
              type="text"
              value={formulaBar}
              onChange={e => setFormulaBar(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && selectedCell) {
                  handleFormulaBarChange(formulaBar);
                }
              }}
              onBlur={() => {
                if (selectedCell) handleFormulaBarChange(formulaBar);
              }}
              placeholder="=SUM(A1:A5) o valor..."
              className="flex-1 px-2 sm:px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-orange-400 dark:placeholder:text-slate-500"
            />
          </div>
          {/* Quick actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setShowPanel(!showPanel)}
              className={`p-1.5 rounded-lg transition-all ${showPanel ? 'bg-orange-100 text-orange-600' : 'text-gray-400 hover:bg-gray-100'}`}
              title="Panel de propiedades"
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-side-bar-line" />
              </div>
            </button>
          </div>
        </div>

        {/* Toolbar — single scrollable row on mobile, title on desktop */}
        <div className="flex items-center border-b border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900">
          {/* Desktop title */}
          <div className="hidden lg:flex flex-col justify-center px-4 py-2 flex-shrink-0 border-r border-gray-100 dark:border-slate-700 min-w-[180px]">
            <h1 className="text-sm font-bold text-gray-800 dark:text-slate-100 whitespace-nowrap">Hoja de Cálculo</h1>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 whitespace-nowrap">
              {filledCells} celdas · {coloredCells} col. · {formulaCells} fórmulas
            </p>
          </div>
          {/* Scrollable buttons */}
          <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto flex-1 scrollbar-hide">
            {/* Create chart */}
            <button
              onClick={() => {
                if (selectedRange && selectedRange.endRow > selectedRange.startRow) {
                  setShowChartConfig(true);
                }
              }}
              className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                selectedRange && selectedRange.endRow > selectedRange.startRow
                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-600 cursor-not-allowed'
              }`}
              title="Selecciona un rango para crear gráfico"
            >
              <i className="ri-bar-chart-grouped-line" />
              <span className="hidden sm:inline">Gráfico</span>
            </button>

            {/* Import CSV */}
            <button
              onClick={() => setShowImporter(true)}
              className="flex-shrink-0 px-2.5 py-1.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-gray-200 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5 whitespace-nowrap"
            >
              <i className="ri-file-upload-line" />
              <span className="hidden sm:inline">Importar</span>
            </button>

            {/* Export CSV */}
            <button
              onClick={exportCSV}
              className="flex-shrink-0 px-2.5 py-1.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-gray-200 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5 whitespace-nowrap"
            >
              <i className="ri-file-download-line" />
              <span>Exportar</span>
            </button>

            {/* Save all */}
            {user?.id && (
              <button
                onClick={saveAllToSupabase}
                disabled={saving}
                className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap
                  ${isDirty ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'}`}
              >
                {saving ? (
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <i className="ri-save-line" />
                )}
                <span>{saving ? 'Guardando...' : 'Guardar'}</span>
              </button>
            )}

            {/* Separator */}
            <div className="flex-shrink-0 w-px h-5 bg-gray-200 dark:bg-slate-700 mx-1" />

            {/* Palettes */}
            {palettes.map((p, idx) => (
              <button
                key={p.name + idx}
                onClick={() => handleChangePalette(idx)}
                className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap
                  ${activePaletteIndex === idx ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Charts area */}
        {charts.length > 0 && (
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <div className="w-4 h-4 flex items-center justify-center text-orange-500">
                  <i className="ri-bar-chart-box-line" />
                </div>
                Gráficos ({charts.length})
              </h2>
              <button
                onClick={() => setCharts([])}
                className="text-xs text-red-500 hover:text-red-600 font-medium"
              >
                Limpiar todos
              </button>
            </div>
            <div className="space-y-3">
              {charts.map(chart => (
                <SpreadsheetChart
                  key={chart.id}
                  data={getChartData(chart)}
                  type={chart.type}
                  title={chart.title}
                  color={chart.color}
                  onRemove={() => handleRemoveChart(chart.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Main content: grid + panel */}
        <div className="flex flex-1 overflow-hidden">
          {/* Grid */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-gray-500">Cargando datos...</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-auto bg-white dark:bg-slate-950">
                <div className="inline-block min-w-full">
                  {/* Header row */}
                  <div className="flex border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10">
                    <div className="w-10 h-8 bg-gray-50 dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex-shrink-0 sticky left-0 z-20" />
                    {colLabels.map((label) => (
                      <div key={label} className="w-20 sm:w-32 h-8 bg-gray-50 dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex items-center justify-center text-xs font-medium text-gray-500 dark:text-slate-400 flex-shrink-0">
                        {label}
                      </div>
                    ))}
                  </div>

                  {/* Data rows */}
                  {Array.from({ length: ROWS }).map((_, rowIdx) => (
                    <div key={rowIdx} className="flex border-b border-gray-100 dark:border-slate-800">
                      <div className="w-10 h-8 bg-gray-50 dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex items-center justify-center text-xs text-gray-400 dark:text-slate-500 flex-shrink-0 sticky left-0">
                        {rowIdx + 1}
                      </div>
                      {Array.from({ length: COLS }).map((_, colIdx) => {
                        const key = getCellKey(rowIdx, colIdx);
                        const meta = getCellMeta(rowIdx, colIdx);
                        const color = getCellColor(rowIdx, colIdx);
                        const isHeader = rowIdx === 0;
                        return (
                          <SpreadsheetCell
                            key={key}
                            row={rowIdx}
                            col={colIdx}
                            meta={meta}
                            color={color}
                            isHeader={isHeader}
                            isSelected={selectedCell === key}
                            isInRange={isCellInRange(rowIdx, colIdx)}
                            isEditing={editingCell === key}
                            allCells={cellData}
                            onSelect={handleSelectCell}
                            onRangeSelect={handleRangeSelect}
                            onStartEdit={handleStartEdit}
                            onFinishEdit={handleFinishEdit}
                            onColorToggle={handleToggleColor}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info bar */}
            <div className="flex items-center justify-between flex-wrap gap-2 px-3 sm:px-4 py-2 text-xs text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-700">
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-information-line" />
                </div>
                <span>Doble clic para editar · Clic para seleccionar · Shift+clic para rango · Ctrl+B negrita · Flechas para navegar · Enter para editar · Espacio para color</span>
              </div>
              <div className="flex sm:hidden items-center gap-1.5 text-gray-400 dark:text-slate-500">
                <i className="ri-information-line" />
                <span>Toca para seleccionar · Doble toque para editar</span>
              </div>
              {!user?.id && (
                <span className="text-orange-600 font-medium">Datos guardados localmente. Inicia sesión para persistirlos.</span>
              )}
            </div>
          </div>

          {/* Properties panel — overlay on mobile, sidebar on desktop */}
          {showPanel && (
            <>
              {/* Mobile backdrop */}
              <div
                className="fixed inset-0 bg-black/30 z-40 sm:hidden"
                onClick={() => setShowPanel(false)}
              />
              <div className="fixed bottom-0 left-0 right-0 z-50 sm:static sm:z-auto">
                <CellPropertiesPanel
                  selectedCell={selectedCell}
                  cellMeta={selectedMeta}
                  onBoldChange={handleBoldChange}
                  onAlignChange={handleAlignChange}
                  onFormatChange={handleFormatChange}
                  onColorToggle={() => {
                    if (!selectedCell) return;
                    const [r, c] = selectedCell.split('-').map(Number);
                    handleToggleColor(r, c);
                  }}
                  activePaletteColors={activePalette.colors}
                  cellColor={selectedColor}
                  onClose={() => setShowPanel(false)}
                />
              </div>
            </>
          )}
        </div>

        {/* CSV Importer modal */}
        {showImporter && (
          <CSVImporter
            onImport={(rows) => handleImportCSV(rows, 1, 0)}
            onCancel={() => setShowImporter(false)}
          />
        )}

        {/* Chart config modal */}
        {showChartConfig && selectedRange && (
          <ChartConfigModal
            range={selectedRange}
            colLabels={colLabels}
            previewValues={getChartPreviewValues()}
            onCreate={handleCreateChart}
            onCancel={() => setShowChartConfig(false)}
          />
        )}

        {/* Save success toast */}
        {saveSuccess && (
          <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg animate-bounce flex items-center gap-2">
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-checkbox-circle-line" />
            </div>
            Guardado correctamente
          </div>
        )}
      </div>
    </PremiumGate>
  );
}