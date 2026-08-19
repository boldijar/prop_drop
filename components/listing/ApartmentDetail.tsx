"use client";

import { FieldRow } from "@/components/listing/FieldRow";
import { ImageCarousel } from "@/components/listing/ImageCarousel";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { getApartmentImageUrls } from "@/lib/images";
import { getDetailFields } from "@/lib/schema";
import type { Apartment } from "@/lib/schema";
import styles from "./ApartmentDetail.module.css";

type ApartmentDetailProps = {
  apartment: Apartment;
  hidden?: boolean;
  onHide?: () => void;
  onUnhide?: () => void;
};

export function ApartmentDetail({
  apartment,
  hidden,
  onHide,
  onUnhide,
}: ApartmentDetailProps) {
  const images = getApartmentImageUrls(apartment);
  const fields = getDetailFields();

  return (
    <div className={styles.detail}>
      {images.length > 0 ? <ImageCarousel images={images} /> : null}

      <div className={styles.actions}>
        {hidden && onUnhide ? (
          <Button variant="ghost" onClick={onUnhide}>
            <Icon name="eye" size={16} />
            Afișează din nou
          </Button>
        ) : onHide ? (
          <Button variant="ghost" onClick={onHide}>
            <Icon name="eye-off" size={16} />
            Ascunde listarea
          </Button>
        ) : null}
      </div>

      <div className={styles.grid}>
        {fields.map((field) => (
          <FieldRow
            key={field.key}
            field={field}
            value={apartment[field.key]}
            variant="detail"
          />
        ))}
      </div>

      {typeof apartment.postText === "string" && apartment.postText ? (
        <div className={styles.textBlock}>
          <div className={styles.textLabel}>
            <Icon name="home" size={16} />
            <span>Text anunț</span>
          </div>
          <p className={styles.text}>{apartment.postText}</p>
        </div>
      ) : null}

      {typeof apartment.postUrl === "string" && apartment.postUrl ? (
        <a
          href={apartment.postUrl}
          target="_blank"
          rel="noreferrer"
          className={styles.link}
        >
          <Icon name="link" size={16} />
          <span>Deschide pe Facebook</span>
        </a>
      ) : null}
    </div>
  );
}
