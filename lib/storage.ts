import type { Apartment, CachePayload, SyncConfig } from "./schema";
import { CACHE_STORAGE_KEY } from "./schema";

export function readCache(): CachePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachePayload;
  } catch {
    return null;
  }
}

export function writeCache(payload: CachePayload): void {
  localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(payload));
}

export async function fetchMeta(): Promise<{
  version: string;
  syncConfig: SyncConfig;
  apartmentCount: number;
}> {
  const res = await fetch("/api/meta", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch meta");
  return res.json();
}

export async function fetchApartments(): Promise<{
  version: string;
  syncConfig: SyncConfig;
  apartments: Apartment[];
  fetchedAt: string;
}> {
  const res = await fetch("/api/apartments", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch apartments");
  return res.json();
}

export async function loadApartmentsWithCache(): Promise<{
  apartments: Apartment[];
  syncConfig: SyncConfig;
  fromCache: boolean;
  refreshed: boolean;
}> {
  const cached = readCache();
  const meta = await fetchMeta();

  if (cached && cached.version === meta.version) {
    return {
      apartments: cached.apartments,
      syncConfig: cached.syncConfig,
      fromCache: true,
      refreshed: false,
    };
  }

  const fresh = await fetchApartments();
  writeCache({
    version: fresh.version,
    syncConfig: fresh.syncConfig,
    apartments: fresh.apartments,
    fetchedAt: fresh.fetchedAt,
  });

  return {
    apartments: fresh.apartments,
    syncConfig: fresh.syncConfig,
    fromCache: false,
    refreshed: true,
  };
}
