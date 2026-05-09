import { useState, useRef, useCallback } from 'react';

interface CSVImporterProps {
  onImport: (rows: string[][], startRow?: number, startCol?: number) => void;
  onCancel: () => void;
}

export default function CSVImporter({ onImport, onCancel }: CSVImporterProps) {
  const [preview, setPreview] = useState<string[][] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startRow, setStartRow] = useState(1);
  const [startCol, setStartCol] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseCSV = useCallback((text: string): string[][] => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentValue = '';
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (insideQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            currentValue += '"';
            i++;
          } else {
            insideQuotes = false;
          }
        } else {
          currentValue += char;
        }
      } else {
        if (char === '"') {
          insideQuotes = true;
        } else if (char === ',') {
          currentRow.push(currentValue.trim());
          currentValue = '';
        } else if (char === '\n' || char === '\r') {
          if (currentValue || currentRow.length > 0) {
            currentRow.push(currentValue.trim());
            if (currentRow.some(c => c)) rows.push(currentRow);
            currentRow = [];
            currentValue = '';
          }
        } else {
          currentValue += char;
        }
      }
    }

    if (currentValue || currentRow.length > 0) {
      currentRow.push(currentValue.trim());
      if (currentRow.some(c => c)) rows.push(currentRow);
    }

    return rows;
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setError('No se pudo leer el archivo');
        return;
      }
      const rows = parseCSV(text);
      if (rows.length === 0) {
        setError('El archivo CSV está vacío o no tiene formato válido');
        return;
      }
      setPreview(rows.slice(0, 20));
    };
    reader.onerror = () => setError('Error al leer el archivo');
    reader.readAsText(file);
  }, [parseCSV]);

  const handleImport = useCallback(() => {
    if (!preview) return;
    onImport(preview, startRow, startCol);
  }, [preview, onImport, startRow, startCol]);

  const colLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">Importar CSV</h3>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <i className="ri-close-line" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-4">
          {/* File input */}
          {!preview && (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-orange-300 transition-colors">
              <div className="w-12 h-12 mx-auto mb-3 bg-orange-50 rounded-full flex items-center justify-center">
                <i className="ri-upload-cloud-2-line text-xl text-orange-500" />
              </div>
              <p className="text-sm text-gray-600 mb-2">Arrastra un archivo CSV o haz clic para seleccionar</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-all"
              >
                Seleccionar archivo
              </button>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center gap-2">
              <i className="ri-error-warning-line" />
              {error}
            </div>
          )}

          {/* Preview */}
          {preview && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Vista previa de <span className="font-medium text-gray-800">{preview.length}</span> filas
                </p>
                <button
                  onClick={() => { setPreview(null); setError(null); }}
                  className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                >
                  Cambiar archivo
                </button>
              </div>

              {/* Position settings */}
              <div className="flex items-center gap-4 bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Fila inicio:</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={startRow}
                    onChange={e => setStartRow(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                    className="w-14 px-2 py-1 border border-gray-200 rounded text-sm text-center"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Columna inicio:</label>
                  <select
                    value={startCol}
                    onChange={e => setStartCol(parseInt(e.target.value))}
                    className="px-2 py-1 border border-gray-200 rounded text-sm"
                  >
                    {colLabels.map((l, i) => (
                      <option key={i} value={i}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Table preview */}
              <div className="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1.5 text-gray-400 font-normal w-8">#</th>
                      {preview[0]?.map((_, ci) => (
                        <th key={ci} className="px-2 py-1.5 text-gray-500 font-medium text-left min-w-[80px]">
                          {colLabels[startCol + ci] || `Col ${ci + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="px-2 py-1.5 text-gray-400">{ri + 1}</td>
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-2 py-1.5 text-gray-700 truncate max-w-[150px]">
                            {cell || <span className="text-gray-300">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
          >
            Cancelar
          </button>
          {preview && (
            <button
              onClick={handleImport}
              className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-all"
            >
              Importar {preview.length} filas desde {colLabels[startCol]}{startRow}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}