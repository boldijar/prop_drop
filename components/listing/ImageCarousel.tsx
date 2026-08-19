"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import styles from "./ImageCarousel.module.css";

type ImageCarouselProps = {
  images: string[];
};

const LOAD_TIMEOUT_MS = 12_000;

function CarouselSlide({
  src,
  onError,
}: {
  src: string;
  onError: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setProgress(0);
    setLoaded(false);
    setErrored(false);

    let settled = false;
    const finish = (failed: boolean) => {
      if (settled) return;
      settled = true;
      if (failed) {
        setErrored(true);
        onError();
      }
    };

    const timer = window.setInterval(() => {
      setProgress((current) => Math.min(current + 6, 92));
    }, 100);

    const timeout = window.setTimeout(() => finish(true), LOAD_TIMEOUT_MS);

    return () => {
      window.clearInterval(timer);
      window.clearTimeout(timeout);
    };
  }, [src, onError]);

  if (errored) {
    return (
      <div className={styles.error}>
        <Icon name="image" size={28} />
        <span>Nu s-a putut încărca imaginea</span>
      </div>
    );
  }

  return (
    <>
      {!loaded ? (
        <div className={styles.loader}>
          <div className={styles.loaderIcon}>
            <Icon name="image" size={28} />
          </div>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressBar}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}

      <img
        src={src}
        alt=""
        className={styles.image}
        style={{ opacity: loaded ? 1 : 0 }}
        onLoad={() => {
          setProgress(100);
          setLoaded(true);
        }}
        onError={() => {
          setErrored(true);
          onError();
        }}
        decoding="async"
      />
    </>
  );
}

export function ImageCarousel({ images }: ImageCarouselProps) {
  const [validImages, setValidImages] = useState(images);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setValidImages(images);
    setIndex(0);
  }, [images]);

  useEffect(() => {
    if (index >= validImages.length) {
      setIndex(Math.max(validImages.length - 1, 0));
    }
  }, [index, validImages.length]);

  const handleImageError = useCallback((failedUrl: string) => {
    setValidImages((currentImages) =>
      currentImages.filter((url) => url !== failedUrl),
    );
  }, []);

  if (!images.length || !validImages.length) {
    return null;
  }

  const safeIndex = Math.min(index, validImages.length - 1);
  const current = validImages[safeIndex];
  const prev = () =>
    setIndex((i) => (i === 0 ? validImages.length - 1 : i - 1));
  const next = () =>
    setIndex((i) => (i === validImages.length - 1 ? 0 : i + 1));

  return (
    <div className={styles.carousel}>
      <div className={styles.frame}>
        <CarouselSlide
          key={current}
          src={current}
          onError={() => handleImageError(current)}
        />

        {validImages.length > 1 ? (
          <>
            <button
              type="button"
              className={`${styles.nav} ${styles.navLeft}`}
              onClick={prev}
              aria-label="Imaginea anterioară"
            >
              <Icon name="chevron-left" size={20} />
            </button>
            <button
              type="button"
              className={`${styles.nav} ${styles.navRight}`}
              onClick={next}
              aria-label="Imaginea următoare"
            >
              <Icon name="chevron-right" size={20} />
            </button>
          </>
        ) : null}
      </div>

      <div className={styles.footer}>
        <div className={styles.counter}>
          {safeIndex + 1} / {validImages.length}
        </div>
        {validImages.length > 1 ? (
          <div className={styles.dots}>
            {validImages.map((url, i) => (
              <button
                key={url}
                type="button"
                className={`${styles.dot} ${i === safeIndex ? styles.dotActive : ""}`}
                onClick={() => setIndex(i)}
                aria-label={`Imaginea ${i + 1}`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
