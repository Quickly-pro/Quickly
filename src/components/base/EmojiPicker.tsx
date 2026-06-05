import { useState, useRef, useCallback } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';

// Emojis agrupados por categoría
const EMOJI_GROUPS = [
  {
    label: 'Caras',
    emojis: ['😀','😃','😄','😁','😂','🤣','😊','😍','🥰','😘','😋','😜','🤔','😅','😭','😤','😡','🥺','😬','🤩','😎','🤗','🙃','😇','🥳'],
  },
  {
    label: 'Gestos',
    emojis: ['👍','👎','👋','🙌','👏','🤝','✌️','👌','🤌','💪','🙏','🤦','🤷','👀','💅','🫶'],
  },
  {
    label: 'Símbolos',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🔥','⭐','💫','✨','💯','✅','❌','⚠️','🔔','💬','📝','🎉','🎊','🏆','🎯','💡','🔑'],
  },
  {
    label: 'Trabajo',
    emojis: ['📦','🚚','🚛','🏭','📍','🗺️','📋','💰','📱','📅','🔧','⚙️','🔩','📊','📈','📉','💼','🗂️','📁','🖨️','💻','🖥️'],
  },
];

const ALL_EMOJIS = EMOJI_GROUPS.flatMap(g => g.emojis);

interface Props {
  /** Inserta el emoji en el input. Recibe el emoji seleccionado. */
  onSelect: (emoji: string) => void;
  /** Posición del picker: 'up' (abre hacia arriba, default) o 'down' */
  direction?: 'up' | 'down';
  /** Clases extra para el botón */
  btnClassName?: string;
}

export default function EmojiPicker({ onSelect, direction = 'up', btnClassName = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setOpen(false), open);

  const handleSelect = useCallback((emoji: string) => {
    onSelect(emoji);
    // Mantener abierto para multi-selección
  }, [onSelect]);

  return (
    <div className="relative flex-shrink-0" ref={containerRef}>
      {/* Botón trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Emojis"
        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all
          ${open
            ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-500'
            : 'text-gray-400 dark:text-slate-500 hover:text-orange-500 hover:bg-gray-100 dark:hover:bg-slate-800'
          } ${btnClassName}`}
      >
        <i className="ri-emotion-line text-lg" />
      </button>

      {/* Picker panel */}
      {open && (
        <div
          className={`absolute z-50 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden
            ${direction === 'up' ? 'bottom-11 left-0' : 'top-11 left-0'}`}
          style={{ maxHeight: '280px' }}
        >
          {/* Pestañas de categoría */}
          <div className="flex border-b border-gray-100 dark:border-slate-700 px-2 pt-2 gap-1">
            {EMOJI_GROUPS.map((g, i) => (
              <button
                key={g.label}
                type="button"
                onClick={() => setActiveGroup(i)}
                className={`px-2 py-1.5 rounded-t-lg text-xs font-medium transition-all
                  ${activeGroup === i
                    ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-b-2 border-orange-500'
                    : 'text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
              >
                {ALL_EMOJIS[EMOJI_GROUPS.slice(0, i).reduce((acc, g) => acc + g.emojis.length, 0)]} {g.label}
              </button>
            ))}
          </div>

          {/* Grid de emojis */}
          <div className="grid grid-cols-8 gap-0.5 p-2 overflow-y-auto" style={{ maxHeight: '200px' }}>
            {EMOJI_GROUPS[activeGroup].emojis.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleSelect(emoji)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 text-xl transition-all hover:scale-125"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Buscador rápido de todos */}
          <div className="border-t border-gray-100 dark:border-slate-700 px-2 py-1.5">
            <p className="text-[10px] text-gray-400 dark:text-slate-500 text-center">
              Haz clic en cualquier emoji para insertarlo
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
