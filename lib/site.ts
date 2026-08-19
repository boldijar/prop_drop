export const siteConfig = {
  name: "Prop Drop",
  title: "Prop Drop — Apartamente din București",
  description:
    "Listări actualizate din grupuri Facebook pentru apartamente de vânzare în București. Filtrează după preț, zonă și camere, sortează după dată și salvează favorite.",
  tagline: "Apartamente de vânzare din grupuri Facebook · București",
  locale: "ro_RO",
  keywords: [
    "apartamente București",
    "apartamente de vânzare",
    "imobiliare București",
    "anunțuri Facebook",
    "grupuri Facebook apartamente",
    "prop drop",
  ],
};

export function getSiteUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return new URL(raw.endsWith("/") ? raw.slice(0, -1) : raw);
}
