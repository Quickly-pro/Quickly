import { useState, useRef, useEffect, useCallback } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/lib/supabase';
import Modal from '@/components/base/Modal';

interface DocumentSpace {
  id: 'mis' | 'publicos' | 'internos';
  name: string;
  icon: string;
}

interface DocEntry {
  id: string;
  name: string;
  type: string;
  date: string;
  size: string;
  url?: string;
  isSchedule?: boolean;
  scheduleData?: any;
}

const allSpaces: DocumentSpace[] = [
  { id: 'mis',      name: 'Mis documentos',                    icon: 'ri-folder-user-line' },
  { id: 'publicos', name: 'Documentos de empresa pública',      icon: 'ri-folder-shared-line' },
  { id: 'internos', name: 'Documentos internos de la empresa',  icon: 'ri-folder-shield-line' },
];

const shiftColors: Record<string, string> = {
  morning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  evening: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400',
  night:   'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
  free:    'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400',
  '':      'text-gray-300 dark:text-slate-600',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function typeFromFilename(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'pdf';
  if (['xlsx', 'xls', 'csv'].includes(ext)) return 'xlsx';
  return 'file';
}

export default function Documentos() {
  const { isEmpresa } = useRole();
  const spaces = isEmpresa ? allSpaces : allSpaces.filter(s => s.id === 'mis');

  const [selectedSpace, setSelectedSpace] = useState<'mis' | 'publicos' | 'internos' | null>(null);
  const [docs, setDocs] = useState<Record<string, DocEntry[]>>({ mis: [], publicos: [], internos: [] });
  const [loading, setLoading] = useState(true);
  const [previewDoc, setPreviewDoc] = useState<{ name: string; type: string; url: string } | null>(null);
  const [viewSchedule, setViewSchedule] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DocEntry | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  useClickOutside(previewRef, () => setPreviewDoc(null), !!previewDoc);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: docRows, error: docsError }, { data: schedules, error: schedulesError }] = await Promise.all([
      supabase.from('documents').select('*').order('created_at', { ascending: false }),
      supabase.from('sent_schedules').select('*').order('created_at', { ascending: false }),
    ]);
    if (docsError) console.error('Error al cargar los documentos', docsError);
    if (schedulesError) console.error('Error al cargar los cuadrantes enviados', schedulesError);

    const bySpace: Record<string, DocEntry[]> = { mis: [], publicos: [], internos: [] };
    (docRows || []).forEach((d: any) => {
      const entry: DocEntry = {
        id: `doc-${d.id}`,
        name: d.name,
        type: d.type,
        date: new Date(d.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        size: d.size_label || '',
        url: d.file_url,
      };
      if (bySpace[d.space]) bySpace[d.space].push(entry);
    });

    (schedules || []).forEach((s: any) => {
      bySpace.mis.push({
        id: `sched-${s.id}`,
        name: `Mi cuadrante · ${s.week_label}`,
        type: 'cuadrante',
        date: s.sent_at,
        size: `${s.employees?.length || 0} empleado${(s.employees?.length || 0) !== 1 ? 's' : ''}`,
        isSchedule: true,
        scheduleData: s,
      });
    });

    setDocs(bySpace);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const sub = supabase
      .channel(`documentos_${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sent_schedules' }, fetchAll)
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [fetchAll]);

  const handleUpload = async () => {
    if (!uploadFile || !selectedSpace) return;
    if (uploadFile.size > 15 * 1024 * 1024) { setUploadError('El archivo no puede superar los 15MB'); return; }
    setUploading(true);
    setUploadError('');
    const ext = uploadFile.name.split('.').pop() || 'bin';
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('documentos').upload(path, uploadFile);
    if (upErr) {
      setUploading(false);
      setUploadError(upErr.message || 'Error al subir el archivo');
      return;
    }
    const { data: pub } = supabase.storage.from('documentos').getPublicUrl(path);
    const { error: insErr } = await supabase.from('documents').insert({
      space: selectedSpace,
      name: uploadFile.name,
      type: typeFromFilename(uploadFile.name),
      size_label: formatBytes(uploadFile.size),
      file_url: pub.publicUrl,
    });
    setUploading(false);
    if (insErr) { setUploadError(insErr.message || 'Error al guardar'); return; }
    setShowUpload(false);
    setUploadFile(null);
    fetchAll();
  };

  const handleDeleteDoc = async (doc: DocEntry) => {
    if (doc.isSchedule && doc.scheduleData) {
      const { error } = await supabase.from('sent_schedules').delete().eq('id', doc.scheduleData.id);
      if (error) console.error('Error al eliminar el cuadrante', error);
    } else {
      const id = doc.id.replace('doc-', '');
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) console.error('Error al eliminar el documento', error);
    }
    setConfirmDelete(null);
    fetchAll();
  };

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
    if (!doc.url) return;
    const a = document.createElement('a');
    a.href = doc.url;
    a.download = doc.name;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  const handleView = (doc: DocEntry) => {
    if (doc.isSchedule && doc.scheduleData) { setViewSchedule(doc.scheduleData); return; }
    if (doc.url) setPreviewDoc({ name: doc.name, type: doc.type, url: doc.url });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Documentos</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Gestión de documentos de la empresa{loading && ' (cargando...)'}</p>
        </div>
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
                  <p className="text-xs text-gray-400 dark:text-slate-500">{(docs[space.id] || []).length} documentos</p>
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
              {isEmpresa && (
                <button
                  onClick={() => { setShowUpload(true); setUploadFile(null); setUploadError(''); }}
                  className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 flex items-center gap-1.5"
                >
                  <i className="ri-upload-2-line" /> Subir archivo
                </button>
              )}
            </div>
            <div className="divide-y divide-gray-50 dark:divide-slate-800">
              {(docs[selectedSpace] || []).map((doc) => (
                <div key={doc.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-all">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-9 h-9 rounded-lg ${getDocIconBg(doc.type)} flex items-center justify-center flex-shrink-0`}>
                      <i className={`${getDocIcon(doc.type)} ${getDocIconColor(doc.type)}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">{doc.name}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">{doc.date} · {doc.size}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                    {doc.url && (
                      <button onClick={() => handleDownload(doc)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors group" title="Descargar">
                        <i className="ri-download-line text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" />
                      </button>
                    )}
                    {isEmpresa && (
                      <button onClick={() => setConfirmDelete(doc)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group" title="Eliminar documento">
                        <i className="ri-delete-bin-line text-gray-400 dark:text-slate-500 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors" />
                      </button>
                    )}
                    <button onClick={() => handleView(doc)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors group" title="Ver">
                      <i className="ri-eye-line text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" />
                    </button>
                  </div>
                </div>
              ))}
              {!loading && (docs[selectedSpace] || []).length === 0 && (
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

      {/* Upload modal */}
      <Modal isOpen={showUpload} onClose={() => setShowUpload(false)} title="Subir documento" size="sm">
        <div className="space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl p-6 text-center cursor-pointer hover:border-orange-300 transition-colors"
          >
            {uploadFile ? (
              <>
                <i className="ri-file-line text-2xl text-orange-500 mb-2 block" />
                <p className="text-sm text-gray-700 dark:text-slate-200 font-medium">{uploadFile.name}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{formatBytes(uploadFile.size)}</p>
              </>
            ) : (
              <>
                <i className="ri-upload-cloud-2-line text-2xl text-gray-400 mb-2 block" />
                <p className="text-sm text-gray-500 dark:text-slate-400">Haz clic para elegir un archivo</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">PDF, Excel, imágenes... hasta 15MB</p>
              </>
            )}
            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
          </div>
          {uploadError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg text-sm text-red-600 dark:text-red-400">{uploadError}</div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowUpload(false)} className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-lg text-sm font-medium">Cancelar</button>
            <button onClick={handleUpload} disabled={!uploadFile || uploading} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2">
              {uploading && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {uploading ? 'Subiendo...' : 'Subir'}
            </button>
          </div>
        </div>
      </Modal>

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
              <button onClick={() => handleDeleteDoc(confirmDelete)} className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors">Sí, eliminar</button>
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      <Modal isOpen={!!previewDoc} onClose={() => setPreviewDoc(null)} title={previewDoc?.name || ''} size="full" className="max-w-4xl">
        <div className="flex items-center justify-end gap-2 mb-2">
          {previewDoc?.url && (
            <button onClick={() => previewDoc && handleDownload({ id: '', name: previewDoc.name, type: previewDoc.type, date: '', size: '', url: previewDoc.url })}
              className="px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg text-xs font-medium hover:bg-purple-100 dark:hover:bg-purple-900/30 flex items-center gap-1.5">
              <i className="ri-download-line" /> Descargar
            </button>
          )}
        </div>
        {previewDoc?.url && (previewDoc.type === 'pdf' ? (
          <iframe src={previewDoc.url} className="w-full h-[70vh] border-0 rounded-lg" title={previewDoc.name} />
        ) : (
          <div className="text-center py-12 text-gray-500 dark:text-slate-400">
            <i className="ri-file-line text-3xl mb-2 block" />
            <p className="text-sm">Vista previa no disponible para este tipo de archivo.</p>
            <button onClick={() => previewDoc && handleDownload({ id: '', name: previewDoc.name, type: previewDoc.type, date: '', size: '', url: previewDoc.url })} className="mt-3 text-orange-600 text-sm hover:underline">Descargar para ver</button>
          </div>
        ))}
      </Modal>

      {/* Cuadrante Viewer Modal */}
      <Modal isOpen={!!viewSchedule} onClose={() => setViewSchedule(null)} title={`Mi cuadrante · ${viewSchedule?.week_label || ''}`} size="full" className="max-w-4xl">
        {viewSchedule && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
                <i className="ri-calendar-check-line text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">{viewSchedule.week_label}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Enviado el {viewSchedule.sent_at} · {viewSchedule.employees?.length} empleado{viewSchedule.employees?.length !== 1 ? 's' : ''}
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
                  {viewSchedule.employees?.map((emp: any) => (
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
