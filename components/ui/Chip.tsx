"use client";

import styles from "./Chip.module.css";

type ChipProps = {
  label: string;
  active?: boolean;
  onClick?: () => void;
};

export function Chip({ label, active, onClick }: ChipProps) {
  return (
    <button
      type="button"
      className={`${styles.chip} ${active ? styles.active : ""}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
