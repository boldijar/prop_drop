"use client";

import { Icon } from "@/components/ui/Icon";
import { getFieldIcon } from "@/lib/field-icons";
import { formatFieldValue, getCardFields, getField } from "@/lib/schema";
import type { Apartment } from "@/lib/schema";
import styles from "./ApartmentCard.module.css";

type ApartmentCardProps = {
  apartment: Apartment;
  favorite?: boolean;
  hiddenTab?: boolean;
  onOpen: () => void;
  onToggleFavorite: () => void;
  onHide?: () => void;
  onUnhide?: () => void;
};

const CHIP_FIELDS = [
  "numarCamere",
  "suprafata",
  "etaj",
  "areBalcon",
  "locDeParcare",
  "tipVanzator",
  "metrouInApropiere",
] as const;

function getValue(
  apartment: Apartment,
  key: string,
  compact = false,
): string | null {
  const field = getField(key);
  if (!field) return null;
  return formatFieldValue(field, apartment[key], { compact });
}

export function ApartmentCard({
  apartment,
  favorite,
  hiddenTab,
  onOpen,
  onToggleFavorite,
  onHide,
  onUnhide,
}: ApartmentCardProps) {
  const cardFields = getCardFields();
  const priceField = cardFields.find((f) => f.highlight);
  const price = priceField
    ? formatFieldValue(priceField, apartment[priceField.key])
    : null;
  const postedAt = getValue(apartment, "postedAt", true);
  const zona = getValue(apartment, "zona");

  const chips = CHIP_FIELDS.map((key) => {
    const field = getField(key);
    const value = getValue(apartment, key, true);
    if (!field || !value) return null;
    return { key, icon: getFieldIcon(key), value };
  }).filter(Boolean) as Array<{
    key: string;
    icon: ReturnType<typeof getFieldIcon>;
    value: string;
  }>;

  return (
    <article className={styles.card} onClick={onOpen}>
      <div className={styles.top}>
        <div className={styles.headline}>
          {price ? <div className={styles.price}>{price}</div> : null}
          {postedAt ? (
            <div className={styles.date}>
              <Icon name="calendar" size={13} />
              <span>{postedAt}</span>
            </div>
          ) : null}
        </div>

        <div className={styles.actions}>
          {hiddenTab && onUnhide ? (
            <button
              type="button"
              className={styles.action}
              onClick={(e) => {
                e.stopPropagation();
                onUnhide();
              }}
              aria-label="Afișează din nou"
            >
              <Icon name="eye" size={16} />
            </button>
          ) : onHide ? (
            <button
              type="button"
              className={styles.action}
              onClick={(e) => {
                e.stopPropagation();
                onHide();
              }}
              aria-label="Ascunde listarea"
            >
              <Icon name="eye-off" size={16} />
            </button>
          ) : null}

          <button
            type="button"
            className={`${styles.action} ${favorite ? styles.favActive : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            aria-label="Favorite"
          >
            <Icon name="star" size={16} />
          </button>
        </div>
      </div>

      {zona ? (
        <div className={styles.location}>
          <Icon name="location" size={15} />
          <span>{zona}</span>
        </div>
      ) : null}

      {chips.length > 0 ? (
        <div className={styles.chips}>
          {chips.map((chip) => (
            <span key={chip.key} className={styles.chip}>
              <Icon name={chip.icon} size={13} />
              <span>{chip.value}</span>
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}
