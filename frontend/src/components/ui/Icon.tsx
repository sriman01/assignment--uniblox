import type { SVGProps } from "react";

const paths = {
  heart: "M12 20.5s-7.5-4.6-9.6-9.3C.9 7.8 3 4.5 6.4 4.5c2.1 0 3.5 1.1 4.3 2.4h2.6c.8-1.3 2.2-2.4 4.3-2.4 3.4 0 5.5 3.3 4 6.7-2.1 4.7-9.6 9.3-9.6 9.3Z",
  cart: "M3 4h2.2l2.1 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.5L21 8H6.1M10 20.5h.01M17 20.5h.01",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7.5 8.5c.8-3.6 3.9-6 7.5-6s6.7 2.4 7.5 6",
  search: "m20 20-4.2-4.2M10.8 17.5a6.7 6.7 0 1 0 0-13.4 6.7 6.7 0 0 0 0 13.4Z",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  trash: "M4 7h16M9 7V4.5h6V7m-8.5 0 .9 12.1a2 2 0 0 0 2 1.9h5.2a2 2 0 0 0 2-1.9L17.5 7",
  check: "m5 12.5 4.2 4.2L19 7",
  chevronRight: "m9 6 6 6-6 6",
  chevronDown: "m6 9 6 6 6-6",
  arrowRight: "M5 12h14m-5-6 6 6-6 6",
  truck: "M3 6h11v10H3zM14 9h4l3 3.5V16h-7M7 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  gift: "M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7S10.5 3.5 8 3.5 5.5 7 8 7h4Zm0 0s1.5-3.5 4-3.5S18.5 7 16 7h-4Z",
  shield: "M12 3 5 6v5.5c0 4.4 3 8 7 9.5 4-1.5 7-5.1 7-9.5V6l-7-3Zm-3 9 2.2 2.2L15.5 10",
  refresh: "M20 11a8 8 0 0 0-14.6-4.5L4 8m0-4v4h4m-4 5a8 8 0 0 0 14.6 4.5L20 16m0 4v-4h-4",
  box: "M12 3 4 7v10l8 4 8-4V7l-8-4Zm0 0v18M4 7l8 4 8-4",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H3",
  tag: "M3.5 12.5 11 5h8v8l-7.5 7.5a1.5 1.5 0 0 1-2.1 0l-5.9-5.9a1.5 1.5 0 0 1 0-2.1ZM15.5 8.5h.01",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6m-6 4h3",
  logout: "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4m-4 4h10",
  store: "M4 9.5 5.5 4h13L20 9.5M4 9.5V20h16V9.5M4 9.5c0 1.4 1.1 2.5 2.7 2.5s2.6-1.1 2.6-2.5c0 1.4 1.1 2.5 2.7 2.5s2.7-1.1 2.7-2.5c0 1.4 1 2.5 2.6 2.5S20 10.9 20 9.5M10 20v-5h4v5",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  phone: "M5 4h3.5l1.5 4-2 1.2a11 11 0 0 0 6.8 6.8L16 14l4 1.5V19a1 1 0 0 1-1 1A15 15 0 0 1 4 5a1 1 0 0 1 1-1Z",
  pin: "M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 1 1 13 0c0 5.4-6.5 11-6.5 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  home: "M4 10.5 12 4l8 6.5V20h-5.5v-6h-5v6H4z",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  warehouse: "M3 9.5 12 4l9 5.5V20H3zM7 20v-7h10v7M7 16h10",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z",
  sparkle: "M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M18 6l-2.5 2.5m-7 7L6 18",
} as const;

export type IconName = keyof typeof paths;

type IconProps = SVGProps<SVGSVGElement> & { name: IconName; size?: number; filled?: boolean };

export function Icon({ name, size = 20, filled = false, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
