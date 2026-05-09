import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Remove animation class to reset
    el.classList.remove('page-enter-animation');
    // Force reflow
    void el.offsetWidth;
    // Add animation class
    el.classList.add('page-enter-animation');
  }, [location.pathname]);

  return (
    <div ref={containerRef} className="page-enter-animation">
      {children}
    </div>
  );
}