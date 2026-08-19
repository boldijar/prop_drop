import { createHash } from "crypto";
import prodropConfig from "@prodrop/config";
import type { Apartment, SyncConfig } from "@/lib/schema";

const config = prodropConfig as {
  storage: {
    targetKey: string;
    syncConfigKey: string;
  };
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing env: ${name}`);
  return value.replace(/^["']|["']$/g, "");
}

async function upstashCommand(command: (string | number)[]): Promise<unknown> {
  const url = requireEnv("UPSTASH_REDIS_REST_URL").replace(/\/$/, "");
  const token = requireEnv("UPSTASH_REDIS_REST_TOKEN");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Upstash error: ${res.status}`);
  }
  const data = await res.json();
  return data.result;
}

async function upstashGet(key: string): Promise<string | null> {
  const encoded = encodeURIComponent(key);
  const url = `${requireEnv("UPSTASH_REDIS_REST_URL").replace(/\/$/, "")}/get/${encoded}`;
  const token = requireEnv("UPSTASH_REDIS_REST_TOKEN");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash get failed: ${res.status}`);
  const data = await res.json();
  return data.result ?? null;
}

export async function loadSyncConfig(): Promise<SyncConfig> {
  const raw = await upstashGet(config.storage.syncConfigKey);
  if (!raw) return { groups: {} };
  return JSON.parse(raw) as SyncConfig;
}

export async function loadApartments(): Promise<Apartment[]> {
  const raw = await upstashGet(config.storage.targetKey);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? (parsed as Apartment[]) : [];
}

export function buildVersion(
  syncConfig: SyncConfig,
  apartments: Apartment[],
): string {
  const latest = apartments
    .map((item) => String(item.processedAt ?? ""))
    .sort()
    .at(-1);
  const payload = JSON.stringify({
    syncConfig,
    count: apartments.length,
    latest,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}
