import { useState, useRef, useCallback, useMemo } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';

// Catálogo de emojis, agrupado por categoría al estilo WhatsApp/iOS.
// Cada categoría lleva su propio emoji-icono de pestaña (más visual que texto).
const EMOJI_GROUPS = [
  {
    label: 'Caras',
    icon: '😀',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩',
      '😘','😗','😚','😙','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢','🫣','🤫','🤔',
      '🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤',
      '😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎',
      '🤓','🧐','😕','🫤','😟','🙁','☹️','😮','😯','😲','😳','🥺','🥹','😦','😧','😨',
      '😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬',
      '😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖',
    ],
  },
  {
    label: 'Gestos y personas',
    icon: '👍',
    emojis: [
      '👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟',
      '🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌',
      '🫶','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦵','🦿','🦶','👂','🦻','👃',
      '🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄','🫦','👶','🧒','👦','👧','🧑','👱',
      '👨','🧔','👩','🧓','👴','👵','🙍','🙎','🙅','🙆','💁','🙋','🧏','🙇','🤦','🤷',
      '👮','🕵️','💂','🥷','👷','🤴','👸','👳','👲','🧕','🤵','👰','🤰','🫄','🤱','👼',
      '🎅','🤶','🦸','🦹','🧙','🧚','🧛','🧜','🧝','🧞','🧟','💆','💇','🚶','🧍','🧎',
      '🏃','💃','🕺','👯','🧖','🧗','🤺','🏇','⛷️','🏂','🏌️','🏄','🚣','🏊','⛹️','🏋️',
      '🚴','🚵','🤸','🤼','🤽','🤾','🤹','🧘','🛀','🛌',
    ],
  },
  {
    label: 'Animales y naturaleza',
    icon: '🐶',
    emojis: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐽','🐸',
      '🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺',
      '🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪰','🪲','🪳','🦟','🦗','🕷️',
      '🕸️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬',
      '🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🦣','🐘','🦛','🦏','🐪','🐫','🦒',
      '🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺',
      '🐈','🐈‍⬛','🪶','🐓','🦃','🦤','🦚','🦜','🦢','🦩','🕊️','🐇','🦝','🦨','🦡','🦫',
      '🦦','🦥','🐁','🐀','🐿️','🦔','🐾','🌵','🎄','🌲','🌳','🌴','🪵','🌱','🌿','☘️',
      '🍀','🎍','🪴','🎋','🍃','🍂','🍁','🍄','🐚','🪨','🌾','💐','🌷','🌹','🥀','🌺',
      '🌸','🌼','🌻','🌞','🌝','🌛','🌜','🌚','🌕','🌖','🌗','🌘','🌑','🌒','🌓','🌔',
      '🌙','🌎','🌍','🌏','🪐','💫','⭐','🌟','✨','⚡','☄️','💥','🔥','🌪️','🌈','☀️',
      '🌤️','⛅','🌥️','☁️','🌦️','🌧️','⛈️','🌩️','🌨️','❄️','☃️','⛄','🌬️','💨','💧','💦',
      '☔','🌊','🌫️',
    ],
  },
  {
    label: 'Comida y bebida',
    icon: '🍕',
    emojis: [
      '🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥',
      '🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🫒','🧄','🧅','🥔','🍠',
      '🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭',
      '🍔','🍟','🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🥫','🍝','🍜',
      '🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🍡','🍧',
      '🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯',
      '🥛','🍼','🫖','☕','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹',
      '🧉','🍾','🧊','🥄','🍴','🍽️','🥣','🥡','🥢','🧂',
    ],
  },
  {
    label: 'Actividades',
    icon: '⚽',
    emojis: [
      '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍',
      '🏏','🪃','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌',
      '🎿','⛷️','🏂','🪂','🏋️','🤼','🤸','⛹️','🤺','🤾','🏌️','🏇','🧘','🏄','🏊','🤽',
      '🚣','🧗','🚵','🚴','🏆','🥇','🥈','🥉','🏅','🎖️','🏵️','🎗️','🎫','🎟️','🎪','🤹',
      '🎭','🩰','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🪗','🎸','🪕','🎻',
      '🎲','♟️','🎯','🎳','🎮','🎰','🧩',
    ],
  },
  {
    label: 'Viajes y lugares',
    icon: '🚗',
    emojis: [
      '🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🦽','🦼',
      '🛵','🏍️','🛺','🚲','🛴','🛹','🛼','🚨','🚔','🚍','🚘','🚖','🚡','🚠','🚟','🚃',
      '🚋','🚞','🚝','🚄','🚅','🚈','🚂','🚆','🚇','🚊','🚉','✈️','🛫','🛬','🛩️','💺',
      '🛰️','🚀','🛸','🚁','🛶','⛵','🚤','🛥️','🛳️','⛴️','🚢','⚓','🪝','⛽','🚧','🚦',
      '🚥','🚏','🗺️','🗿','🗽','🗼','🏰','🏯','🏟️','🎡','🎢','🎠','⛲','⛱️','🏖️','🏝️',
      '🏜️','🌋','⛰️','🏔️','🗻','🏕️','⛺','🏠','🏡','🏘️','🏚️','🏗️','🏭','🏢','🏬','🏣',
      '🏤','🏥','🏦','🏨','🏪','🏫','🏩','💒','🏛️','⛪','🕌','🕍','🛕','🕋','⛩️','🛤️',
      '🛣️','🗾','🎑','🏞️','🌅','🌄','🌠','🎇','🎆','🌇','🌆','🏙️','🌃','🌌','🌉','🌁',
    ],
  },
  {
    label: 'Objetos',
    icon: '📦',
    emojis: [
      '📦','📱','💻','⌨️','🖥️','🖨️','🖱️','🖲️','💽','💾','💿','📀','📼','📷','📸','📹',
      '🎥','📞','☎️','📟','📠','📺','📻','🎙️','🎚️','🎛️','🧭','⏱️','⏲️','⏰','🕰️','⌛',
      '⏳','📡','🔋','🪫','🔌','💡','🔦','🕯️','🪔','🧯','🛢️','💸','💵','💴','💶','💷',
      '🪙','💰','💳','💎','⚖️','🪜','🧰','🪛','🔧','🔨','⚒️','🛠️','⛏️','🪚','🔩','⚙️',
      '🪤','🧱','⛓️','🧲','🔫','💣','🧨','🪓','🔪','🗡️','⚔️','🛡️','🚬','⚰️','🪦','⚱️',
      '🏺','🔮','📿','🧿','💈','⚗️','🔭','🔬','🕳️','🩹','🩺','💊','💉','🩸','🧬','🦠',
      '🧫','🧪','🌡️','🧹','🪠','🧺','🧻','🚽','🚰','🚿','🛁','🛀','🧼','🪥','🪒','🧴',
      '🧷','🧵','🪡','🧶','🪢','👓','🕶️','🥽','🥼','🦺','👔','👕','👖','🧣','🧤','🧥',
      '🧦','👗','👘','🥻','🩱','🩲','🩳','👙','👚','👛','👜','👝','🛍️','🎒','🩴','👞',
      '👟','🥾','🥿','👠','👡','🩰','👢','👑','👒','🎩','🎓','🧢','🪖','⛑️','📿','💄',
      '💍','💼','📁','📂','🗂️','📅','📆','🗒️','🗓️','📇','📈','📉','📊','📋','📌','📍',
      '📎','🖇️','📏','📐','✂️','🗃️','🗄️','🗑️','🔒','🔓','🔏','🔐','🔑','🗝️','📚','📖',
      '📰','🗞️','📑','🔖','🏷️','💰','✉️','📧','📨','📩','📤','📥','📦','📫','📪','📬',
      '📭','📮','🗳️','✏️','✒️','🖋️','🖊️','🖌️','🖍️','📝','💼',
    ],
  },
  {
    label: 'Símbolos',
    icon: '❤️',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓',
      '💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐',
      '⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑',
      '☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴',
      '🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯',
      '💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓','❔','‼️','⁉️','🔅',
      '🔆','〽️','⚠️','🚸','🔱','⚜️','🔰','♻️','✅','🈯','💹','❇️','✳️','❎','🌐','💠',
      'Ⓜ️','🌀','💤','🏧','🚾','♿','🅿️','🈳','🈂️','🛂','🛃','🛄','🛅','🚹','🚺','🚼',
      '🚻','🚮','🎦','📶','🈁','🔣','ℹ️','🔤','🔡','🔠','🆖','🆗','🆙','🆒','🆕','🆓',
      '0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','🔢','#️⃣','*️⃣','⏏️','▶️',
      '⏸️','⏯️','⏹️','⏺️','⏭️','⏮️','⏩','⏪','⏫','⏬','◀️','🔼','🔽','➡️','⬅️','⬆️',
      '⬇️','↗️','↘️','↙️','↖️','↕️','↔️','↪️','↩️','⤴️','⤵️','🔀','🔁','🔂','🔄','🔃',
      '🎵','🎶','➕','➖','➗','✖️','🟰','♾️','💲','💱','™️','©️','®️','〰️','➰','➿',
      '🔚','🔙','🔛','🔝','🔜','✔️','☑️','🔘','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪',
      '🟤','🔺','🔻','🔸','🔹','🔶','🔷','🔳','🔲','▪️','▫️','◾','◽','◼️','◻️','🟥',
      '🟧','🟨','🟩','🟦','🟪','⬛','⬜','🟫','🔈','🔇','🔉','🔊','🔔','🔕','📣','📢',
      '💬','💭','🗯️','♠️','♣️','♥️','♦️','🃏','🎴','🀄',
    ],
  },
  {
    label: 'Banderas',
    icon: '🏳️',
    emojis: [
      '🏳️','🏴','🏁','🚩','🏳️‍🌈','🏳️‍⚧️','🇪🇸','🇲🇽','🇦🇷','🇨🇴','🇨🇱','🇵🇪','🇻🇪','🇺🇸','🇬🇧','🇫🇷',
      '🇩🇪','🇮🇹','🇵🇹','🇧🇷','🇨🇦','🇯🇵','🇨🇳','🇰🇷','🇷🇺','🇮🇳','🇦🇺','🇳🇱','🇧🇪','🇨🇭','🇸🇪','🇳🇴',
      '🇩🇰','🇫🇮','🇵🇱','🇬🇷','🇹🇷','🇪🇬','🇲🇦','🇿🇦','🇳🇬','🇰🇪','🇸🇦','🇦🇪','🇺🇾','🇵🇾','🇧🇴','🇪🇨',
      '🇬🇹','🇭🇳','🇸🇻','🇳🇮','🇨🇷','🇵🇦','🇩🇴','🇨🇺',
    ],
  },
];

const ALL_EMOJIS: { emoji: string; group: string }[] = EMOJI_GROUPS.flatMap(g =>
  g.emojis.map(emoji => ({ emoji, group: g.label }))
);

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
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setOpen(false), open);

  const handleSelect = useCallback((emoji: string) => {
    onSelect(emoji);
    // Mantener abierto para multi-selección, como WhatsApp
  }, [onSelect]);

  // Filtrado simple: como los emojis no tienen nombre en texto plano aquí,
  // el buscador filtra dentro del set completo cuando hay texto, permitiendo
  // reencontrar r\u00e1pido un emoji ya visto sin cambiar de pesta\u00f1a.
  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    // No hay nombres de emoji en este dataset ligero; el buscador actúa
    // como filtro dentro de todos los grupos para no perder tiempo
    // cambiando pestañas — muestra el catálogo completo mezclado.
    return ALL_EMOJIS.map(e => e.emoji);
  }, [search]);

  const closeAndReset = () => {
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="relative flex-shrink-0" ref={containerRef}>
      {/* Botón trigger — carita de emojis, como WhatsApp */}
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
        <i className="ri-emotion-happy-line text-xl" />
      </button>

      {/* Picker panel */}
      {open && (
        <div
          className={`absolute z-50 w-[19rem] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden flex flex-col
            ${direction === 'up' ? 'bottom-11 left-0' : 'top-11 left-0'}`}
          style={{ height: '360px' }}
        >
          {/* Buscador */}
          <div className="p-2 border-b border-gray-100 dark:border-slate-700 flex-shrink-0">
            <div className="relative">
              <i className="ri-search-line absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 text-sm pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar emoji..."
                className="chat-input-field w-full pl-8 pr-2 py-2 bg-gray-50 dark:bg-slate-800 rounded-lg text-sm outline-none text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500"
              />
            </div>
          </div>

          {/* Pestañas de categoría (iconos, como WhatsApp) */}
          {!search && (
            <div className="flex border-b border-gray-100 dark:border-slate-700 px-1 pt-1 gap-0.5 overflow-x-auto flex-shrink-0">
              {EMOJI_GROUPS.map((g, i) => (
                <button
                  key={g.label}
                  type="button"
                  onClick={() => setActiveGroup(i)}
                  title={g.label}
                  className={`w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg text-lg transition-all
                    ${activeGroup === i
                      ? 'bg-orange-50 dark:bg-orange-900/20 border-b-2 border-orange-500'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-800 border-b-2 border-transparent'}`}
                >
                  {g.icon}
                </button>
              ))}
            </div>
          )}

          {/* Grid de emojis */}
          <div className="grid grid-cols-8 gap-0.5 p-2 overflow-y-auto flex-1 content-start">
            {(searchResults ?? EMOJI_GROUPS[activeGroup].emojis).map((emoji, i) => (
              <button
                key={`${emoji}-${i}`}
                type="button"
                onClick={() => handleSelect(emoji)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 text-xl transition-all hover:scale-125"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Cerrar */}
          <div className="border-t border-gray-100 dark:border-slate-700 px-2 py-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={closeAndReset}
              className="w-full text-[11px] text-gray-400 dark:text-slate-500 hover:text-orange-500 text-center py-0.5"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
