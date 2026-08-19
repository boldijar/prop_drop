"use client";

import styles from "./BottomSheet.module.css";

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.sheet}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className={styles.handle} />
        {title ? <h2 className={styles.title}>{title}</h2> : null}
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
