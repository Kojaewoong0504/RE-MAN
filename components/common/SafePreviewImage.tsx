"use client";

import { useEffect, useState } from "react";

type SafePreviewImageProps = {
  alt: string;
  className?: string;
  fallbackSrc: string;
  src: string;
};

export function SafePreviewImage({
  alt,
  className,
  fallbackSrc,
  src
}: SafePreviewImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src);

  useEffect(() => {
    setCurrentSrc(src);
  }, [src]);

  return (
    <img
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => {
        if (currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        }
      }}
      src={currentSrc}
    />
  );
}
