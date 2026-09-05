import { useState } from 'react';

interface ImageWithFallbackProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  fallbackText?: string;
  // Tamaño del texto/inicial mostrado cuando no hay imagen (o falla la carga).
  // El tamaño del recuadro en sí lo sigue controlando className/fallbackClassName.
  fallbackSize?: 'sm' | 'md' | 'lg';
}

const FALLBACK_TEXT_SIZE: Record<NonNullable<ImageWithFallbackProps['fallbackSize']>, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-lg',
};

export default function ImageWithFallback({
  src,
  alt,
  className = '',
  fallbackClassName = '',
  fallbackText,
  fallbackSize,
}: ImageWithFallbackProps) {
  const [error, setError] = useState(false);

  const initial = fallbackText || alt?.charAt(0)?.toUpperCase() || '?';

  if (error || !src) {
    return (
      <div
        className={`flex items-center justify-center bg-orange-100 text-orange-600 font-bold select-none ${fallbackClassName || className} ${fallbackSize ? FALLBACK_TEXT_SIZE[fallbackSize] : ''}`}
        title={alt}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setError(true)}
    />
  );
}