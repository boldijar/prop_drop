"use client";

import { FieldRow } from "@/components/listing/FieldRow";
import { ImageCarousel } from "@/components/listing/ImageCarousel";
import { Icon } from "@/components/ui/Icon";
import { getApartmentImageUrls } from "@/lib/images";
import { getDetailFields } from "@/lib/schema";
import type { Apartment } from "@/lib/schema";
import styles from "./ApartmentDetail.module.css";

type ApartmentDetailProps = {
  apartment: Apartment;
};

export function ApartmentDetail({ apartment }: ApartmentDetailProps) {
  const images = getApartmentImageUrls(apartment);
  const fields = getDetailFields();

  return (
    <div className={styles.detail}>
      <ImageCarousel images={images} />

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
        <a href={apartment.postUrl} target="_blank" rel="noreferrer" className={styles.link}>
          <Icon name="link" size={16} />
          <span>Deschide pe Facebook</span>
        </a>
      ) : null}
    </div>
  );
}
