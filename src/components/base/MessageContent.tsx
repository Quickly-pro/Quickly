/**
 * Renderiza el contenido de un mensaje de chat.
 * Soporta texto normal y adjuntos (imágenes, archivos, notas de voz).
 *
 * Formato de adjuntos (almacenado en el campo `text` de chat_messages):
 *   [[ATTACH]]{"type":"image","data":"data:image/...","name":"foto.jpg"}
 *   [[ATTACH]]{"type":"audio","data":"data:audio/..."}
 *   [[ATTACH]]{"type":"file","data":"data:application/...","name":"doc.pdf","size":1234}
 */

export const ATTACH_PREFIX = '[[ATTACH]]';

export interface Attachment {
  type: 'image' | 'audio' | 'file';
  data: string;
  name?: string;
  size?: number;
}

export function parseAttachment(text: string): Attachment | null {
  if (!text.startsWith(ATTACH_PREFIX)) return null;
  try {
    return JSON.parse(text.slice(ATTACH_PREFIX.length)) as Attachment;
  } catch {
    return null;
  }
}

export function encodeAttachment(att: Attachment): string {
  return ATTACH_PREFIX + JSON.stringify(att);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  text: string;
  mine: boolean;
}

export default function MessageContent({ text, mine }: Props) {
  const att = parseAttachment(text);

  if (!att) {
    return <p className="break-words leading-relaxed whitespace-pre-wrap">{text}</p>;
  }

  if (att.type === 'image') {
    return (
      <div className="overflow-hidden rounded-xl">
        <img
          src={att.data}
          alt={att.name || 'Imagen'}
          className="max-w-full max-h-56 rounded-xl object-cover cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => window.open(att.data, '_blank')}
          title="Clic para abrir en tamaño completo"
        />
        {att.name && (
          <p className={`text-[10px] mt-1 ${mine ? 'text-orange-100' : 'text-gray-400 dark:text-slate-500'}`}>
            {att.name}
          </p>
        )}
      </div>
    );
  }

  if (att.type === 'audio') {
    return (
      <div className={`flex flex-col gap-1 min-w-[200px]`}>
        <div className="flex items-center gap-2">
          <i className={`ri-mic-line text-sm ${mine ? 'text-orange-100' : 'text-orange-500'}`} />
          <span className={`text-xs ${mine ? 'text-orange-100' : 'text-gray-500 dark:text-slate-400'}`}>Nota de voz</span>
        </div>
        <audio
          controls
          src={att.data}
          className="w-full max-w-[240px]"
          style={{ height: '36px' }}
        />
      </div>
    );
  }

  if (att.type === 'file') {
    return (
      <a
        href={att.data}
        download={att.name || 'archivo'}
        className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all
          ${mine
            ? 'bg-orange-400/30 border-orange-300/30 hover:bg-orange-400/40 text-white'
            : 'bg-gray-50 dark:bg-slate-700 border-gray-100 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200'}`}
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
          ${mine ? 'bg-orange-300/30' : 'bg-orange-50 dark:bg-orange-900/20'}`}>
          <i className={`ri-file-line text-lg ${mine ? 'text-orange-100' : 'text-orange-500'}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium truncate">{att.name || 'Archivo'}</p>
          {att.size && (
            <p className={`text-[10px] ${mine ? 'text-orange-100/70' : 'text-gray-400 dark:text-slate-500'}`}>
              {formatBytes(att.size)}
            </p>
          )}
        </div>
        <i className={`ri-download-line text-sm flex-shrink-0 ${mine ? 'text-orange-100' : 'text-gray-400'}`} />
      </a>
    );
  }

  return <p className="break-words leading-relaxed">{text}</p>;
}
