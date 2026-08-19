const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|avif|bmp)(\?|$)/i;

export function isDirectImageUrl(url: string): boolean {
  if (!url.startsWith("http")) return false;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host.includes("fbcdn.net") || host.includes("fbcdn.com")) {
      return true;
    }

    if (host.includes("facebook.com")) {
      return false;
    }

    if (IMAGE_EXTENSIONS.test(parsed.pathname)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export function upgradeFacebookImageUrl(url: string): string {
  if (!url.includes("fbcdn.net") && !url.includes("fbcdn.com")) {
    return url;
  }

  return url.replace(/ctp=s\d+x\d+/gi, "ctp=s960x960");
}

export function extractImageUrl(item: unknown): string | null {
  if (typeof item === "string") {
    return isDirectImageUrl(item) ? upgradeFacebookImageUrl(item) : null;
  }

  if (!item || typeof item !== "object") return null;
  const obj = item as Record<string, unknown>;

  const candidates = [
    (obj.image as Record<string, unknown> | undefined)?.uri,
    obj.thumbnail,
    (obj.thumbnailImage as Record<string, unknown> | undefined)?.uri,
    (obj.photo_image as Record<string, unknown> | undefined)?.uri,
    obj.uri,
    obj.src,
    obj.url,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && isDirectImageUrl(candidate)) {
      return upgradeFacebookImageUrl(candidate);
    }
  }

  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      for (const child of value) {
        const nested = extractImageUrl(child);
        if (nested) return nested;
      }
    } else if (value && typeof value === "object") {
      const nested = extractImageUrl(value);
      if (nested) return nested;
    }
  }

  return null;
}

export function getApartmentImageUrl(
  apartment: Record<string, unknown>,
): string | null {
  const urls = getApartmentImageUrls(apartment);
  return urls[0] ?? null;
}

export function getApartmentImageUrls(
  apartment: Record<string, unknown>,
): string[] {
  const images = apartment.images;
  if (!Array.isArray(images)) return [];

  const urls: string[] = [];
  for (const item of images) {
    const url = extractImageUrl(item);
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls;
}
