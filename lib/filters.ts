import type { Apartment, FieldDef } from "./schema";
import {
  FAVORITES_STORAGE_KEY,
  FILTERS_STORAGE_KEY,
  HIDDEN_STORAGE_KEY,
  getField,
} from "./schema";

export const DEFAULT_SORT: NonNullable<SortState> = {
  field: "postedAt",
  direction: "desc",
};

export function readFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function writeFavorites(ids: string[]): void {
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(ids));
}

export function toggleFavorite(postId: string): string[] {
  const current = readFavorites();
  const next = current.includes(postId)
    ? current.filter((id) => id !== postId)
    : [...current, postId];
  writeFavorites(next);
  return next;
}

export function readHidden(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HIDDEN_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function writeHidden(ids: string[]): void {
  localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(ids));
}

export function hideApartment(postId: string): string[] {
  const current = readHidden();
  if (current.includes(postId)) return current;
  const next = [...current, postId];
  writeHidden(next);
  return next;
}

export function unhideApartment(postId: string): string[] {
  const current = readHidden();
  const next = current.filter((id) => id !== postId);
  writeHidden(next);
  return next;
}

export type SortDirection = "asc" | "desc";

export type SortState = {
  field: string;
  direction: SortDirection;
} | null;

export type FilterState = Record<
  string,
  | { kind: "range"; min?: number; max?: number }
  | { kind: "enum"; values: string[] }
  | { kind: "boolean"; value: boolean | null }
>;

export const DEFAULT_FILTERS: FilterState = {};

const FILTERS_PREFS_VERSION = 3;

function isActiveFilter(
  rule: FilterState[string],
): rule is NonNullable<FilterState[string]> {
  if (rule.kind === "boolean") return rule.value !== null;
  if (rule.kind === "enum") return rule.values.length > 0;
  return rule.min !== undefined || rule.max !== undefined;
}

export function normalizeFilters(filters: FilterState): FilterState {
  const normalized: FilterState = {};

  for (const [key, rule] of Object.entries(filters)) {
    if (isActiveFilter(rule)) {
      normalized[key] = rule;
    }
  }

  return normalized;
}

export function getNumericValue(value: unknown): number | null {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

export function matchesSearch(apartment: Apartment, query: string): boolean {
  if (!query.trim()) return true;
  const haystack = JSON.stringify(apartment).toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}

export function matchesFilters(
  apartment: Apartment,
  filters: FilterState,
  fields: FieldDef[],
): boolean {
  for (const field of fields) {
    const rule = filters[field.key];
    if (!rule) continue;
    const value = apartment[field.key];

    if (rule.kind === "boolean") {
      if (rule.value === null) continue;
      if (value !== rule.value) return false;
      continue;
    }

    if (rule.kind === "enum") {
      if (!rule.values.length) continue;
      if (!rule.values.includes(String(value ?? ""))) return false;
      continue;
    }

    if (rule.kind === "range") {
      if (rule.min === undefined && rule.max === undefined) continue;
      const numeric = getNumericValue(value);
      if (numeric === null) return false;
      if (rule.min !== undefined && numeric < rule.min) return false;
      if (rule.max !== undefined && numeric > rule.max) return false;
    }
  }

  return true;
}

export function getSortValue(
  apartment: Apartment,
  fieldKey: string,
): number | null {
  const field = getField(fieldKey);
  const value = apartment[fieldKey];

  if (field?.type === "datetime") {
    const time = new Date(String(value)).getTime();
    return Number.isNaN(time) ? null : time;
  }

  return getNumericValue(value);
}

export function sortApartments(
  apartments: Apartment[],
  sort: SortState,
): Apartment[] {
  const activeSort = sort ?? DEFAULT_SORT;
  const sorted = [...apartments];
  sorted.sort((a, b) => {
    const av = getSortValue(a, activeSort.field);
    const bv = getSortValue(b, activeSort.field);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return activeSort.direction === "asc" ? av - bv : bv - av;
  });
  return sorted;
}

export function getApartmentId(apartment: Apartment): string {
  return String(apartment.postId ?? apartment.postUrl ?? JSON.stringify(apartment));
}

export function readFilters(): FilterState {
  if (typeof window === "undefined") return { ...DEFAULT_FILTERS };
  try {
    const versionKey = `${FILTERS_STORAGE_KEY}:v`;
    const storedVersion = Number(localStorage.getItem(versionKey) ?? 0);
    if (storedVersion < FILTERS_PREFS_VERSION) {
      const defaults = { ...DEFAULT_FILTERS };
      localStorage.setItem(versionKey, String(FILTERS_PREFS_VERSION));
      writeFilters(defaults);
      return defaults;
    }

    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FILTERS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_FILTERS };
    return normalizeFilters(parsed as FilterState);
  } catch {
    return { ...DEFAULT_FILTERS };
  }
}

export function writeFilters(filters: FilterState): void {
  localStorage.setItem(
    FILTERS_STORAGE_KEY,
    JSON.stringify(normalizeFilters(filters)),
  );
}

export function readSort(): SortState {
  if (typeof window === "undefined") return DEFAULT_SORT;
  try {
    const raw = localStorage.getItem(`${FILTERS_STORAGE_KEY}:sort`);
    if (!raw) return DEFAULT_SORT;
    const parsed = JSON.parse(raw) as SortState;
    if (!parsed?.field || !parsed.direction) return DEFAULT_SORT;
    return parsed;
  } catch {
    return DEFAULT_SORT;
  }
}

export function writeSort(sort: SortState): void {
  if (sort) {
    localStorage.setItem(`${FILTERS_STORAGE_KEY}:sort`, JSON.stringify(sort));
  } else {
    localStorage.removeItem(`${FILTERS_STORAGE_KEY}:sort`);
  }
}
