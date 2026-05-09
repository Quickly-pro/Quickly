import { useState } from 'react';

interface ImageWithFallbackProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  fallbackText?: string;
}

export default function ImageWithFallback({
  src,
  alt,
  className = '',
  fallbackClassName = '',
  fallbackText,
}: ImageWithFallbackProps) {
  const [error, setError] = useState(false);

  const initial = fallbackText || alt?.charAt(0)?.toUpperCase() || '?';

  if (error || !src) {
    return (
      <div
        className={`flex items-center justify-center bg-orange-100 text-orange-600 font-bold select-none ${fallbackClassName || className}`}
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