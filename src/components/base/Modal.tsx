import { useEffect, useState, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  className?: string;
  noPadding?: boolean;
  hideCloseButton?: boolean;
  maxHeight?: string;
}

const sizeClasses: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-full',
};

/**
 * Reusable Modal component with smooth enter/exit animations.
 *
 * - Uses position:fixed covering the current viewport, so it always opens
 *   exactly where the user is looking — regardless of how far they've
 *   scrolled down the page. No scroll-position math needed.
 * - Backdrop fades in/out with scale
 * - Content scales from 0.95 -> 1 and fades 0 -> 1
 * - Auto-handles click-outside and Escape key
 * - Delays unmount until exit animation completes
 */
export default function Modal({
  isOpen,
  onClose,
  children,
  title,
  size = 'md',
  className = '',
  noPadding = false,
  hideCloseButton = false,
  maxHeight,
}: ModalProps) {
  const [isVisible, setIsVisible] = useState(isOpen);
  const [isExiting, setIsExiting] = useState(false);

  // Handle mount/unmount with exit animation delay
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsExiting(false);
    } else {
      setIsExiting(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 220);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Prevent the page behind the modal from scrolling while it's open
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  // Escape key closes the modal
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Click en el fondo cierra la ventana (pero NO en el contenido).
  // Exigimos que el "mousedown" Y el "click" caigan ambos en el fondo
  // — evita cierres fantasma cuando vuelve la cámara del móvil (el
  // navegador a veces genera un clic sintético que cae fuera del
  // contenido si este cambió de tamaño, p.ej. al aparecer una foto).
  const mouseDownOnBackdropRef = useRef(false);

  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    mouseDownOnBackdropRef.current = e.target === e.currentTarget;
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    const wasRealClick = e.target === e.currentTarget && mouseDownOnBackdropRef.current;
    mouseDownOnBackdropRef.current = false;
    if (wasRealClick) {
      onClose();
    }
  };

  if (!isVisible) return null;

  const contentClass = `bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full ${sizeClasses[size]} ${
    maxHeight ? `max-h-[${maxHeight}]` : 'max-h-[85vh]'
  } overflow-y-auto relative transition-all duration-200 ease-out ${
    isExiting ? 'opacity-0 scale-95 translate-y-2' : 'opacity-100 scale-100 translate-y-0'
  } ${noPadding ? '' : ''} ${className}`;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 transition-all duration-200 ease-out ${
        isExiting ? 'bg-black/0' : 'bg-black/40'
      }`}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
      aria-modal="true"
      role="dialog"
    >
      <div className={contentClass}>
        {title && !hideCloseButton && (
          <div className="flex items-center justify-between px-6 pt-6 pb-2 sticky top-0 bg-white dark:bg-slate-900 rounded-t-2xl z-10">
            {typeof title === 'string' ? (
              <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100">{title}</h2>
            ) : (
              <div>{title}</div>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors ml-2 flex-shrink-0"
              aria-label="Cerrar"
            >
              <i className="ri-close-line text-gray-500 dark:text-slate-400" />
            </button>
          </div>
        )}
        {title && hideCloseButton && (
          <div className="px-6 pt-6 pb-2">
            {typeof title === 'string' ? (
              <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100">{title}</h2>
            ) : (
              <div>{title}</div>
            )}
          </div>
        )}
        <div className={noPadding ? '' : 'p-6 pt-2'}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
