import prodropConfig from "@prodrop/config";

export type FieldType =
  | "integer"
  | "number"
  | "boolean"
  | "string"
  | "text"
  | "enum"
  | "datetime";

export type EnumOption = { value: string; label: string };

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  unit?: string;
  inPrompt?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  showInCard?: boolean;
  detailOnly?: boolean;
  highlight?: boolean;
  options?: EnumOption[];
};

export type ProdropConfig = {
  entity: { id: string; label: string };
  storage: {
    sourceKey: string;
    targetKey: string;
    syncConfigKey: string;
  };
  fields: FieldDef[];
  telegram: { priceField: string; areaField: string };
};

export const config = prodropConfig as ProdropConfig;

export type Apartment = Record<string, unknown> & {
  postId?: string;
  images?: unknown[];
};

export type SyncConfig = {
  groups?: Record<string, string>;
};

export type CachePayload = {
  version: string;
  syncConfig: SyncConfig;
  apartments: Apartment[];
  fetchedAt: string;
};

export const CACHE_STORAGE_KEY = "prodrop:web-cache";
export const FAVORITES_STORAGE_KEY = "prodrop:favorites";
export const FILTERS_STORAGE_KEY = "prodrop:filters";

export function getSortableFields(): FieldDef[] {
  const priority = ["postedAt", "processedAt"];
  const fields = config.fields.filter(
    (field) =>
      field.sortable &&
      (field.type === "integer" ||
        field.type === "number" ||
        field.type === "datetime"),
  );

  return [...fields].sort((a, b) => {
    const ai = priority.indexOf(a.key);
    const bi = priority.indexOf(b.key);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return 0;
  });
}

export function getFilterableFields(): FieldDef[] {
  return config.fields.filter((field) => field.filterable);
}

export function getCardFields(): FieldDef[] {
  return config.fields.filter((field) => field.showInCard);
}

export function getDetailFields(): FieldDef[] {
  return config.fields.filter(
    (field) => field.detailOnly || field.showInCard || field.filterable,
  );
}

export function getField(key: string): FieldDef | undefined {
  return config.fields.find((field) => field.key === key);
}

export function formatFieldValue(
  field: FieldDef,
  value: unknown,
  options?: { compact?: boolean },
): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (field.type === "boolean") {
    return value === true ? "Da" : value === false ? "Nu" : null;
  }

  if (field.type === "enum" && field.options) {
    const match = field.options.find((opt) => opt.value === value);
    return match?.label ?? String(value);
  }

  if (field.type === "datetime") {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return String(value);
    if (options?.compact) {
      return date.toLocaleString("ro-RO", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return date.toLocaleString("ro-RO");
  }

  const text = String(value);
  return field.unit ? `${text} ${field.unit}` : text;
}

export function isNumericField(field: FieldDef): boolean {
  return field.type === "integer" || field.type === "number";
}
