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

const allSpaces: DocumentSpace[] = [
  { id: 'mis', name: 'Mis documentos', icon: 'ri-folder-user-line', count: 12 },
  { id: 'publicos', name: 'Documentos de empresa pública', icon: 'ri-folder-shared-line', count: 8 },
  { id: 'internos', name: 'Documentos internos de la empresa', icon: 'ri-folder-shield-line', count: 24 },
];

export default function Documentos() {
  const { isEmpresa } = useRole();
  const spaces = isEmpresa ? allSpaces : allSpaces.filter(s => s.id === 'mis');
  const [selectedSpace, setSelectedSpace] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ name: string; type: string; url: string } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  useClickOutside(previewRef, () => setPreviewDoc(null), !!previewDoc);

  const docsBySpace: Record<string, { id: number; name: string; type: string; date: string; size: string; url?: string }[]> = {
    mis: [
      { id: 1, name: 'Contrato individual.pdf', type: 'pdf', date: '15/03/2026', size: '1.2 MB', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' },
      { id: 2, name: 'Nómina marzo.pdf', type: 'pdf', date: '31/03/2026', size: '0.8 MB', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' },
      { id: 3, name: 'Informe horas.xlsx', type: 'xlsx', date: '28/03/2026', size: '45 KB' },
    ],
    publicos: [
      { id: 4, name: 'Catálogo productos 2026.pdf', type: 'pdf', date: '01/01/2026', size: '4.5 MB', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' },
      { id: 5, name: 'Tarifas públicas.pdf', type: 'pdf', date: '01/01/2026', size: '1.1 MB', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' },
    ],
    internos: [
      { id: 6, name: 'Protocolo almacén.pdf', type: 'pdf', date: '10/02/2026', size: '2.3 MB', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' },
      { id: 7, name: 'Normas de seguridad.pdf', type: 'pdf', date: '05/01/2026', size: '3.1 MB', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' },
    ],
  };

  const getDocIcon = (type: string) => {
    if (type === 'pdf') return 'ri-file-pdf-line';
    if (type === 'xlsx') return 'ri-file-excel-line';
    return 'ri-file-line';
  };

  const getDocIconBg = (type: string) => {
    if (type === 'pdf') return 'bg-red-50';
    if (type === 'xlsx') return 'bg-green-50';
    return 'bg-gray-50';
  };

  const getDocIconColor = (type: string) => {
    if (type === 'pdf') return 'text-red-500';
    if (type === 'xlsx') return 'text-green-500';
    return 'text-gray-500';
  };

  const handleDownload = (doc: { name: string; url?: string }) => {
    if (doc.url) {
      const a = document.createElement('a');
      a.href = doc.url;
      a.download = doc.name;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
    }
  };

  const handleView = (doc: { name: string; url?: string }) => {
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
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className={`${space.icon} ${selectedSpace === space.id ? 'text-orange-600' : 'text-gray-500 dark:text-slate-400'}`} />
                  </div>
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-800 dark:text-slate-100">{space.name}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{space.count} documentos</p>
                </div>
              </div>
              <div className="w-6 h-6 flex items-center justify-center">
                <i className={`ri-arrow-right-s-line text-gray-400 transition-transform ${selectedSpace === space.id ? 'rotate-90' : ''}`} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Documents list */}
      {selectedSpace && (
        <div className="max-w-2xl">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-700">
              <p className="font-medium text-sm text-gray-800 dark:text-slate-100">
                {spaces.find(s => s.id === selectedSpace)?.name}
              </p>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-slate-800">
              {(docsBySpace[selectedSpace] || []).map((doc) => (
                <div key={doc.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-all">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-9 h-9 rounded-lg ${getDocIconBg(doc.type)} flex items-center justify-center flex-shrink-0`}>
                      <div className="w-5 h-5 flex items-center justify-center">
                        <i className={`${getDocIcon(doc.type)} ${getDocIconColor(doc.type)}`} />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-slate-100 truncate">{doc.name}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">{doc.date} · {doc.size}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                    <button
                      onClick={() => handleDownload(doc)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors group"
                      title="Descargar"
                    >
                      <div className="w-5 h-5 flex items-center justify-center">
                        <i className="ri-download-line text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" />
                      </div>
                    </button>
                    <button
                      onClick={() => handleView(doc)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors group"
                      title="Ver"
                    >
                      <div className="w-5 h-5 flex items-center justify-center">
                        <i className="ri-eye-line text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" />
                      </div>
                    </button>
                  </div>
                </div>
              ))}
              {docsBySpace[selectedSpace]?.length === 0 && (
                <div className="px-5 py-8 text-center text-gray-400 dark:text-slate-500 text-sm">
                  No hay documentos en este espacio
                </div>
              )}
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
              onClick={() => previewDoc && handleDownload(previewDoc)}
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
    </div>
  );
}
