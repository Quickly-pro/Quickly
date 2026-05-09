import { useState, useRef, useEffect, useCallback } from 'react';
import { getDisplayValue, isFormula } from '../lib/formulaEngine';

interface CellMeta {
  value: string;
  color_index: number;
  is_bold?: boolean;
  text_align?: string;
  number_format?: string;
}

interface SpreadsheetCellProps {
  row: number;
  col: number;
  meta: CellMeta;
  color: string;
  isHeader: boolean;
  isSelected: boolean;
  isInRange: boolean;
  isEditing: boolean;
  allCells: Record<string, CellMeta>;
  onSelect: (row: number, col: number) => void;
  onRangeSelect: (row: number, col: number) => void;
  onStartEdit: (row: number, col: number) => void;
  onFinishEdit: (row: number, col: number, value: string) => void;
  onColorToggle: (row: number, col: number) => void;
}

export default function SpreadsheetCell({
  row,
  col,
  meta,
  color,
  isHeader,
  isSelected,
  isInRange,
  isEditing,
  allCells,
  onSelect,
  onRangeSelect,
  onStartEdit,
  onFinishEdit,
  onColorToggle,
}: SpreadsheetCellProps) {
  const [editValue, setEditValue] = useState(meta.value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(meta.value);
  }, [meta.value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = useCallback(() => {
    if (isHeader) return;
    onStartEdit(row, col);
  }, [isHeader, row, col, onStartEdit]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (e.shiftKey) {
      onRangeSelect(row, col);
    } else {
      onSelect(row, col);
    }
  }, [row, col, onSelect, onRangeSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onFinishEdit(row, col, editValue);
    } else if (e.key === 'Escape') {
      setEditValue(meta.value);
      onFinishEdit(row, col, meta.value);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      onFinishEdit(row, col, editValue);
    }
  }, [row, col, editValue, meta.value, onFinishEdit]);

  const handleBlur = useCallback(() => {
    onFinishEdit(row, col, editValue);
  }, [row, col, editValue, onFinishEdit]);

  const displayValue = getDisplayValue(meta.value, allCells, meta.number_format || 'text');
  const isFormulaCell = isFormula(meta.value);
  const align = meta.text_align || (isHeader ? 'center' : 'left');

  const alignClass =
    align === 'center' ? 'text-center' :
    align === 'right' ? 'text-right' :
    'text-left';

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={`w-32 h-8 border-r border-gray-100 flex items-center px-1.5 text-xs flex-shrink-0 cursor-pointer select-none truncate
        ${isHeader ? 'font-semibold text-gray-700' : meta.is_bold ? 'font-bold text-gray-800' : 'text-gray-600'}
        ${isSelected ? 'ring-2 ring-orange-400 ring-inset z-10' : ''}
        ${isInRange ? 'bg-orange-50/50' : ''}
        ${isFormulaCell && !isHeader ? 'text-emerald-700' : ''}`}
      style={{ backgroundColor: isInRange ? undefined : color }}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="w-full h-full bg-transparent outline-none text-xs text-gray-700"
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span className={`truncate w-full ${alignClass}`} title={meta.value}>
          {displayValue}
        </span>
      )}
    </div>
  );
}