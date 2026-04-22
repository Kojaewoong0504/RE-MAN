"use client";

import Image from "next/image";
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
    <Image
      alt={alt}
      className={className}
      onError={() => {
        if (currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        }
      }}
      height={1200}
      loading="lazy"
      src={currentSrc}
      unoptimized
      width={960}
    />
  );
}
