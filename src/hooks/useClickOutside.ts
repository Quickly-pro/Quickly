import { useEffect, RefObject } from 'react';

/**
 * Hook to close a popup/modal/dropdown when clicking outside of its element.
 * Also closes when pressing the Escape key.
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onClose: () => void,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return;

    const handleClick = (event: MouseEvent) => {
      const el = ref.current;
      if (el && !el.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // Use capture to catch clicks before they reach inner elements
    document.addEventListener('mousedown', handleClick, true);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClick, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [ref, onClose, enabled]);
}