"use client";

import { Chip } from "@/components/ui/Chip";
import type { FieldDef } from "@/lib/schema";
import type { FilterState } from "@/lib/filters";
import styles from "./FilterPanel.module.css";

type FilterPanelProps = {
  fields: FieldDef[];
  filters: FilterState;
  onChange: (next: FilterState) => void;
};

export function FilterPanel({ fields, filters, onChange }: FilterPanelProps) {
  return (
    <div className={styles.panel}>
      {fields.map((field) => {
        if (field.type === "boolean") {
          const current = filters[field.key];
          const value =
            current?.kind === "boolean" ? current.value : null;
          return (
            <div key={field.key} className={styles.group}>
              <div className={styles.label}>{field.label}</div>
              <div className={styles.chips}>
                {[
                  { label: "Toate", val: null },
                  { label: "Da", val: true },
                  { label: "Nu", val: false },
                ].map((opt) => (
                  <Chip
                    key={`${field.key}-${String(opt.val)}`}
                    label={opt.label}
                    active={value === opt.val}
                    onClick={() =>
                      onChange({
                        ...filters,
                        [field.key]: { kind: "boolean", value: opt.val },
                      })
                    }
                  />
                ))}
              </div>
            </div>
          );
        }

        if (field.type === "enum" && field.options) {
          const current = filters[field.key];
          const selected =
            current?.kind === "enum" ? current.values : [];
          return (
            <div key={field.key} className={styles.group}>
              <div className={styles.label}>{field.label}</div>
              <div className={styles.chips}>
                {field.options.map((opt) => {
                  const active = selected.includes(opt.value);
                  return (
                    <Chip
                      key={opt.value}
                      label={opt.label}
                      active={active}
                      onClick={() => {
                        const nextValues = active
                          ? selected.filter((v) => v !== opt.value)
                          : [...selected, opt.value];
                        onChange({
                          ...filters,
                          [field.key]: {
                            kind: "enum",
                            values: nextValues,
                          },
                        });
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        }

        if (field.type === "integer" || field.type === "number") {
          const current = filters[field.key];
          const min =
            current?.kind === "range" ? current.min ?? "" : "";
          const max =
            current?.kind === "range" ? current.max ?? "" : "";
          return (
            <div key={field.key} className={styles.group}>
              <div className={styles.label}>{field.label}</div>
              <div className={styles.range}>
                <input
                  type="number"
                  placeholder="Min"
                  value={min}
                  onChange={(e) =>
                    onChange({
                      ...filters,
                      [field.key]: {
                        kind: "range",
                        min: e.target.value ? Number(e.target.value) : undefined,
                        max:
                          current?.kind === "range" ? current.max : undefined,
                      },
                    })
                  }
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={max}
                  onChange={(e) =>
                    onChange({
                      ...filters,
                      [field.key]: {
                        kind: "range",
                        min:
                          current?.kind === "range" ? current.min : undefined,
                        max: e.target.value ? Number(e.target.value) : undefined,
                      },
                    })
                  }
                />
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
