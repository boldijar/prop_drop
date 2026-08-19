import { Icon } from "@/components/ui/Icon";
import { getFieldIcon } from "@/lib/field-icons";
import { formatFieldValue, type FieldDef } from "@/lib/schema";
import styles from "./FieldRow.module.css";

type FieldRowProps = {
  field: FieldDef;
  value: unknown;
  variant?: "card" | "detail";
  highlight?: boolean;
};

export function FieldRow({
  field,
  value,
  variant = "card",
  highlight,
}: FieldRowProps) {
  const formatted = formatFieldValue(field, value, {
    compact: variant === "card",
  });
  if (!formatted) return null;

  const isHighlight = highlight ?? field.highlight;

  return (
    <div className={`${styles.row} ${styles[variant]} ${isHighlight ? styles.highlight : ""}`}>
      <span className={styles.label}>
        <Icon name={getFieldIcon(field.key)} size={15} />
        <span>{field.label}</span>
      </span>
      <span className={`${styles.value} ${isHighlight ? "num" : ""}`}>{formatted}</span>
    </div>
  );
}
