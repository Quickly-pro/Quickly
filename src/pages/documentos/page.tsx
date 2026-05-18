import { useState, useRef } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useRole } from '@/hooks/useRole';
import Modal from '@/components/base/Modal';

interface DocumentSpace {
  id: string;
  name: string;
  icon: string;
  count: number;
}

interface StoredDoc {
  id: number;
  name: string;
  type: string;
  date: string;
  size: string;
  url?: string;
  receivedAt: number; // unix ms — used for 30-day expiry
}

interface DocEntry {
  id: number;
  name: string;
  type: string;
  date: string;
  size: string;
  url?: string;
  cuadranteData?: any;
  receivedAt?: number;
}

const LS_MIS_DOCS   = 'docs-mis-v1';
const LS_CUADRANTES = 'cuadrante-sent';
const EXPIRY_MS     = 30 * 24 * 60 * 60 * 1000; // 30 días en ms

const DEFAULT_DOCS: Omit<StoredDoc, 'receivedAt'>[] = [
  { id: 1, name: 'Contrato individual.pdf', type: 'pdf',  date: '15/03/2026', size: '1.2 MB', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' },
  { id: 2, name: 'Nómina marzo.pdf',        type: 'pdf',  date: '31/03/2026', size: '0.8 MB', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' },
  { id: 3, name: 'Informe horas.xlsx',      type: 'xlsx', date: '28/03/2026', size: '45 KB'  },
];

const allSpaces: DocumentSpace[] = [
  { id: 'mis',      name: 'Mis documentos',                  icon: 'ri-folder-user-line',   count: 12 },
  { id: 'publicos', name: 'Documentos de empresa pública',   icon: 'ri-folder-shared-line', count: 8  },
  { id: 'internos', name: 'Documentos internos de la empresa', icon: 'ri-folder-shield-line', count: 24 },
];

const shiftColors: Record<string, string> = {
  morning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  evening: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400',
  night:   'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
  free:    'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400',
  '':      'text-gray-300 dark:text-slate-600',
};

/** Parses dd/mm/yyyy → Date */
function parseDMY(s: string): Date | null {
  const [d, m, y] = s.split('/').map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

/** Days remaining until expiry (negative = already expired) */
function daysLeft(receivedAt: number): number {
  return Math.ceil((receivedAt + EXPIRY_MS - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function Documentos() {
  const { isEmpresa } = useRole();
  const spaces = isEmpresa ? allSpaces : allSpaces.filter(s => s.id === 'mis');

  const [selectedSpace, setSelectedSpace]   = useState<string | null>(null);
  const [previewDoc,    setPreviewDoc]       = useState<{ name: string; type: string; url: string } | null>(null);
  const [viewCuadrante, setViewCuadrante]   = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete]   = useState<DocEntry | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  useClickOutside(previewRef, () => setPreviewDoc(null), !!previewDoc);

  // ── Mis documentos (localStorage, 30-day expiry) ─────────────────────────
  const [misDocs, setMisDocs] = useState<StoredDoc[]>(() => {
    try {
      const raw = localStorage.getItem(LS_MIS_DOCS);
      const now = Date.now();
      if (raw) {
        const parsed: StoredDoc[] = JSON.parse(raw);
        const valid = parsed.filter(d => now - d.receivedAt < EXPIRY_MS);
        if (valid.length !== parsed.length) {
          localStorage.setItem(LS_MIS_DOCS, JSON.stringify(valid));
        }
        return valid;
      }
    } catch { /* ignore */ }
    // Primera carga: inicializar con receivedAt = ahora
    const defaults: StoredDoc[] = DEFAULT_DOCS.map(d => ({ ...d, receivedAt: Date.now() }));
    localStorage.setItem(LS_MIS_DOCS, JSON.stringify(defaults));
    return defaults;
  });

  // ── Cuadrantes recibidos (localStorage, 30-day expiry) ───────────────────
  const [sentCuadrantes, setSentCuadrantes] = useState<any[]>(() => {
    try {
      const stored: any[] = JSON.parse(localStorage.getItem(LS_CUADRANTES) || '[]');
      const now = Date.now();
      // c.id es Date.now() en el momento del envío → usarlo como receivedAt
      const valid = stored.filter(c => now - c.id < EXPIRY_MS);
      if (valid.length !== stored.length) {
        localStorage.setItem(LS_CUADRANTES, JSON.stringify(valid));
      }
      return valid;
    } catch {
      return [];
    }
  });

  // ── Eliminar doc de "Mis documentos" ─────────────────────────────────────
  const handleDeleteMisDoc = (id: number) => {
    setMisDocs(prev => {
      const updated = prev.filter(d => d.id !== id);
      localStorage.setItem(LS_MIS_DOCS, JSON.stringify(updated));
      return updated;
    });
    setConfirmDelete(null);
  };

  const handleDeleteCuadrante = (cuadranteId: number) => {
    setSentCuadrantes(prev => {
      const updated = prev.filter(c => c.id !== cuadranteId);
      localStorage.setItem(LS_CUADRANTES, JSON.stringify(updated));
      return updated;
    });
    setConfirmDelete(null);
  };

  const handleDeleteDoc = (doc: DocEntry) => {
    if (doc.type === 'cuadrante' && doc.cuadranteData) {
      handleDeleteCuadrante(doc.cuadranteData.id);
    } else {
      handleDeleteMisDoc(doc.id);
    }
  };

  // ── Combinar en lista final para "mis" ───────────────────────────────────
  const misDocsAll: DocEntry[] = [
    ...misDocs,
    ...sentCuadrantes.map((c: any, i: number) => ({
      id: 1000 + i,
      name: `Mi cuadrante · ${c.weekLabel}`,
      type: 'cuadrante',
      date: c.sentAt,
      size: `${c.employees?.length || 0} empleado${(c.employees?.length || 0) !== 1 ? 's' : ''}`,
      cuadranteData: c,
      receivedAt: c.id, // c.id = Date.now() del envío
    })),
  ];

  const docsBySpace: Record<string, DocEntry[]> = {
    mis: misDocsAll,
    publicos: [
      { id: 4, name: 'Catálogo productos 2026.pdf', type: 'pdf', date: '01/01/2026', size: '4.5 MB', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' },
      { id: 5, name: 'Tarifas públicas.pdf',        type: 'pdf', date: '01/01/2026', size: '1.1 MB', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' },
    ],
    internos: [
      { id: 6, name: 'Protocolo almacén.pdf',     type: 'pdf', date: '10/02/2026', size: '2.3 MB', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' },
      { id: 7, name: 'Normas de seguridad.pdf',   type: 'pdf', date: '05/01/2026', size: '3.1 MB', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' },
    ],
  };

  // ── Helpers visuales ─────────────────────────────────────────────────────
  const getDocIcon = (type: string) => {
    if (type === 'pdf')       return 'ri-file-pdf-line';
    if (type === 'xlsx')      return 'ri-file-excel-line';
    if (type === 'cuadrante') return 'ri-calendar-check-line';
    return 'ri-file-line';
  };

  const getDocIconBg = (type: string) => {
    if (type === 'pdf')       return 'bg-red-50 dark:bg-red-900/20';
    if (type === 'xlsx')      return 'bg-green-50 dark:bg-green-900/20';
    if (type === 'cuadrante') return 'bg-blue-50 dark:bg-blue-900/20';
    return 'bg-gray-50 dark:bg-slate-800';
  };

  const getDocIconColor = (type: string) => {
    if (type === 'pdf')       return 'text-red-500';
    if (type === 'xlsx')      return 'text-green-500';
    if (type === 'cuadrante') return 'text-blue-500 dark:text-blue-400';
    return 'text-gray-500';
  };

  const handleDownload = (doc: DocEntry) => {
    if (doc.url) {
      const a = document.createElement('a');
      a.href = doc.url;
      a.download = doc.name;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
    }
  };

  const handleView = (doc: DocEntry) => {
    if (doc.type === 'cuadrante' && doc.cuadranteData) {
      setViewCuadrante(doc.cuadranteData);
      return;
    }
    if (doc.url) {
      setPreviewDoc({ name: doc.name, type: 'pdf', url: doc.url });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Documentos</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Gestión de documentos de la empresa</p>
      </div>

      {/* Document Spaces */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Espacios para documentos</p>
        <div className="space-y-2 max-w-2xl">
          {spaces.map((space) => (
            <button
              key={space.id}
              onClick={() => setSelectedSpace(selectedSpace === space.id ? null : space.id)}
              className={`w-full flex items-center justify-between px-5 py-4 rounded-xl border transition-all text-left
                ${selectedSpace === space.id
                  ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800'
                  : 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center
                  ${selectedSpace === space.id ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-gray-100 dark:bg-slate-800'}`}>
                  <i className={`${space.icon} ${selectedSpace === space.id ? 'text-orange-600' : 'text-gray-500 dark:text-slate-400'}`} />
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-800 dark:text-slate-100">{space.name}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    {space.id === 'mis' ? `${misDocsAll.length} documentos` : `${space.count} documentos`}
                  </p>
                </div>
              </div>
              <i className={`ri-arrow-right-s-line text-gray-400 text-lg transition-transform ${selectedSpace === space.id ? 'rotate-90' : ''}`} />
            </button>
          ))}
        </div>
      </div>

      {/* Documents list */}
      {selectedSpace && (
        <div className="max-w-2xl">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <p className="font-medium text-sm text-gray-800 dark:text-slate-100">
                {spaces.find(s => s.id === selectedSpace)?.name}
              </p>
              {selectedSpace === 'mis' && (
                <p className="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1">
                  <i className="ri-time-line text-xs" />
                  Los documentos se eliminan automáticamente a los 30 días
                </p>
              )}
            </div>
            <div className="divide-y divide-gray-50 dark:divide-slate-800">
              {(docsBySpace[selectedSpace] || []).map((doc) => {
                const left = doc.receivedAt !== undefined ? daysLeft(doc.receivedAt) : null;
                const expiringSoon = left !== null && left <= 7 && left > 0;
                return (
                  <div key={doc.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-all">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-9 h-9 rounded-lg ${getDocIconBg(doc.type)} flex items-center justify-center flex-shrink-0`}>
                        <i className={`${getDocIcon(doc.type)} ${getDocIconColor(doc.type)}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">{doc.name}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs text-gray-400 dark:text-slate-500">{doc.date} · {doc.size}</p>
                          {expiringSoon && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-md whitespace-nowrap">
                              Expira en {left} día{left !== 1 ? 's' : ''}
                            </span>
                          )}
                          {left !== null && left > 7 && (
                            <span className="text-[10px] text-gray-300 dark:text-slate-600 whitespace-nowrap">
                              · {left} días restantes
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                      <button
                        onClick={() => handleDownload(doc)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors group"
                        title="Descargar"
                      >
                        <i className="ri-download-line text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" />
                      </button>

                      {/* Trash button — only for "mis" space */}
                      {selectedSpace === 'mis' && (
                        <button
                          onClick={() => setConfirmDelete(doc)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group"
                          title="Eliminar documento"
                        >
                          <i className="ri-delete-bin-line text-gray-400 dark:text-slate-500 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors" />
                        </button>
                      )}

                      <button
                        onClick={() => handleView(doc)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors group"
                        title="Ver"
                      >
                        <i className="ri-eye-line text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {(docsBySpace[selectedSpace] || []).length === 0 && (
                <div className="px-5 py-10 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                    <i className="ri-folder-open-line text-xl text-gray-400 dark:text-slate-500" />
                  </div>
                  <p className="text-sm text-gray-400 dark:text-slate-500">No hay documentos en este espacio</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 shadow-2xl p-5 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <i className="ri-delete-bin-line text-red-500 text-lg" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">Eliminar documento</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-300 mb-5 px-1">
              ¿Seguro que quieres eliminar{' '}
              <span className="font-semibold text-gray-800 dark:text-slate-100">"{confirmDelete.name}"</span>?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleDeleteDoc(confirmDelete)}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Sí, eliminar
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      <Modal
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.name || ''}
        size="full"
        className="max-w-4xl"
      >
        <div className="flex items-center justify-end gap-2 mb-2">
          {previewDoc?.url && (
            <button
              onClick={() => previewDoc && handleDownload({ ...previewDoc, id: 0, date: '', size: '' })}
              className="px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg text-xs font-medium hover:bg-purple-100 dark:hover:bg-purple-900/30 flex items-center gap-1.5"
            >
              <i className="ri-download-line" />
              Descargar
            </button>
          )}
        </div>
        {previewDoc?.type === 'pdf' && previewDoc?.url && (
          <iframe
            src={previewDoc.url}
            className="w-full h-[70vh] border-0 rounded-lg"
            title={previewDoc.name}
          />
        )}
      </Modal>

      {/* Cuadrante Viewer Modal */}
      <Modal
        isOpen={!!viewCuadrante}
        onClose={() => setViewCuadrante(null)}
        title={`Mi cuadrante · ${viewCuadrante?.weekLabel || ''}`}
        size="full"
        className="max-w-4xl"
      >
        {viewCuadrante && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
                <i className="ri-calendar-check-line text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">{viewCuadrante.weekLabel}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Enviado el {viewCuadrante.sentAt} · {viewCuadrante.employees?.length} empleado{viewCuadrante.employees?.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">Empleado</th>
                    {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
                      <th key={d} className="px-3 py-3 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide text-center whitespace-nowrap">{d}</th>
                    ))}
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide text-center">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                  {viewCuadrante.employees?.map((emp: any) => (
                    <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {(emp.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 whitespace-nowrap">{emp.name}</p>
                            <p className="text-[10px] text-gray-400 dark:text-slate-500">{emp.role}</p>
                          </div>
                        </div>
                      </td>
                      {emp.days?.map((d: any, i: number) => (
                        <td key={i} className="px-1.5 py-2 text-center">
                          <span className={`inline-flex items-center justify-center w-10 h-7 rounded-lg text-xs font-semibold ${shiftColors[d.shift] || shiftColors['']}`}>
                            {d.label || '—'}
                          </span>
                        </td>
                      ))}
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-bold ${emp.totalHours > 40 ? 'text-red-500' : 'text-gray-700 dark:text-slate-200'}`}>
                          {emp.totalHours}h
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              {[
                { color: 'bg-amber-100 dark:bg-amber-900/30', label: 'Mañana (M)' },
                { color: 'bg-sky-100 dark:bg-sky-900/30',    label: 'Tarde (T)'  },
                { color: 'bg-rose-100 dark:bg-rose-900/30',  label: 'Noche (N)'  },
                { color: 'bg-gray-100 dark:bg-slate-700',    label: 'Día libre'  },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <span className={`w-4 h-4 rounded ${item.color}`} />
                  <span className="text-xs text-gray-500 dark:text-slate-400">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
