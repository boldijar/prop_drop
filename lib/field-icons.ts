export type IconName =
  | "home"
  | "image"
  | "price"
  | "location"
  | "rooms"
  | "area"
  | "metro"
  | "parking"
  | "phone"
  | "user"
  | "floor"
  | "calendar"
  | "check"
  | "star"
  | "search"
  | "filter"
  | "chevron-left"
  | "chevron-right"
  | "link"
  | "eye-off"
  | "eye"
  | "balcony"
  | "heat"
  | "hammer"
  | "building";

export const fieldIconMap: Record<string, IconName> = {
  pretEuro: "price",
  comision: "price",
  zona: "location",
  inApropiere: "location",
  metrouInApropiere: "metro",
  numarCamere: "rooms",
  suprafata: "area",
  suprafataUtila: "area",
  suprafataBalcon: "balcony",
  areBalcon: "balcony",
  etaj: "floor",
  anulConstructiei: "calendar",
  tipVanzator: "user",
  locDeParcare: "parking",
  numarTelefon: "phone",
  incalzire: "heat",
  incalzireInPardoseala: "heat",
  trebuieRenovat: "hammer",
  inConstructie: "building",
  esteAnuntReal: "check",
  esteFerentariSauRahova: "location",
  postUrl: "link",
  postedAt: "calendar",
  processedAt: "calendar",
};

export function getFieldIcon(key: string): IconName {
  return fieldIconMap[key] ?? "home";
}
