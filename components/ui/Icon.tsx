import type { ReactNode } from "react";
import type { IconName } from "@/lib/field-icons";
import styles from "./Icon.module.css";

type IconProps = {
  name: IconName;
  size?: number;
  className?: string;
};

export function Icon({ name, size = 18, className = "" }: IconProps) {
  return (
    <svg
      className={`${styles.icon} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {icons[name]}
    </svg>
  );
}

const icons: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </>
  ),
  image: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m4 17 5-5 4 4 3-3 4 4" />
    </>
  ),
  price: (
    <>
      <path d="M12 3v18" />
      <path d="M15.5 7.5A3.5 3.5 0 1 0 8.5 7.5" />
      <path d="M8.5 16.5A3.5 3.5 0 1 0 15.5 16.5" />
    </>
  ),
  location: (
    <>
      <path d="M12 21s6-5.1 6-10a6 6 0 1 0-12 0c0 4.9 6 10 6 10Z" />
      <circle cx="12" cy="11" r="2.2" />
    </>
  ),
  rooms: (
    <>
      <path d="M4 8V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2" />
      <path d="M4 20V10h16v10" />
      <path d="M10 14h4" />
    </>
  ),
  area: (
    <>
      <path d="M5 5h14v14H5z" />
      <path d="M9 5v14M5 9h14M5 15h14M15 5v14" />
    </>
  ),
  metro: (
    <>
      <rect x="5" y="4" width="14" height="14" rx="2" />
      <path d="M8 17V9l3 4 3-4v8" />
    </>
  ),
  parking: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M10 8h2.5A2 2 0 0 1 14 10a2 2 0 0 1-2 2H10V8Z" />
    </>
  ),
  phone: (
    <>
      <path d="M8.5 4.5 6 7c1.7 4.2 6.8 9.3 11 11l2.5-2.5c.5-.5 1.2-.6 1.8-.3l2.7 1.2a1.5 1.5 0 0 1 .9 1.4V19a2 2 0 0 1-2 2C10.6 21 3 13.4 3 4a2 2 0 0 1 2-2h2.1c.7 0 1.3.4 1.5 1l1.2 2.7c.2.6.1 1.3-.3 1.8Z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M6 20c1.2-3 3.4-4.5 6-4.5s4.8 1.5 6 4.5" />
    </>
  ),
  floor: (
    <>
      <path d="M4 20h16" />
      <path d="M7 16V8M12 16V5M17 16v-6" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="6" width="16" height="14" rx="2" />
      <path d="M8 4v4M16 4v4M4 10h16" />
    </>
  ),
  check: (
    <>
      <path d="M5 12.5 9.5 17 19 7" />
    </>
  ),
  star: (
    <path d="m12 3.5 2.4 5.3 5.8.8-4.2 4 1 5.7L12 16.8 7 19.3l1-5.7-4.2-4 5.8-.8z" />
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m18 18 3 3" />
    </>
  ),
  filter: (
    <>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </>
  ),
  "chevron-left": <path d="m14 7-5 5 5 5" />,
  "chevron-right": <path d="m10 7 5 5-5 5" />,
  link: (
    <>
      <path d="M10 14a4 4 0 0 1 0-5.7l1.3-1.3a4 4 0 0 1 5.7 5.7l-1 1" />
      <path d="M14 10a4 4 0 0 1 0 5.7l-1.3 1.3a4 4 0 0 1-5.7-5.7l1-1" />
    </>
  ),
  "eye-off": (
    <>
      <path d="M10 11a2 2 0 0 0 2.8 2.8" />
      <path d="M6.7 6.7C4.6 8.3 3.2 10.4 2 12c1.7 3.1 5.1 5.5 10 5.5 1.8 0 3.4-.4 4.8-1" />
      <path d="M9.9 5.1A10.8 10.8 0 0 1 12 4.5c4.9 0 8.3 2.4 10 5.5-.6 1.1-1.5 2.2-2.6 3.1" />
      <path d="m3 3 18 18" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  balcony: (
    <>
      <path d="M4 10h16v8H4z" />
      <path d="M8 10V6h8v4" />
    </>
  ),
  heat: (
    <>
      <path d="M12 3c2 4 4 6 4 9a4 4 0 1 1-8 0c0-3 2-5 4-9Z" />
    </>
  ),
  hammer: (
    <>
      <path d="m14 5 5 5-6 6-5-5z" />
      <path d="M5 19l3-3" />
    </>
  ),
  building: (
    <>
      <path d="M6 4h12v16H6z" />
      <path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2" />
    </>
  ),
};
