interface IconDef {
  viewBox: string;
  mode: "fill" | "stroke";
  strokeWidth?: number;
  body: string;
}

const defs = {
  user: {
    viewBox: "0 0 24 24",
    mode: "fill",
    body: '<circle cx="12" cy="7" r="4.5"/><path d="M3 22c0-5 4-8.5 9-8.5s9 3.5 9 8.5z"/>',
  },
  search: {
    viewBox: "0 0 24 24",
    mode: "stroke",
    strokeWidth: 3,
    body: '<circle cx="10.5" cy="10.5" r="7"/><path d="M16 16l6 6"/>',
  },
  cart: {
    viewBox: "0 0 24 24",
    mode: "stroke",
    strokeWidth: 2.5,
    body: '<path d="M1.5 3h3l2.7 12h12l2.3-8.5H6"/><circle cx="9.5" cy="20" r="1.6" fill="currentColor"/><circle cx="18" cy="20" r="1.6" fill="currentColor"/>',
  },
  menu: {
    viewBox: "0 0 24 24",
    mode: "stroke",
    strokeWidth: 2.8,
    body: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  },
  close: {
    viewBox: "0 0 24 24",
    mode: "stroke",
    strokeWidth: 3.5,
    body: '<path d="M5 5l14 14M19 5L5 19"/>',
  },
  cup: {
    viewBox: "0 0 64 64",
    mode: "stroke",
    strokeWidth: 2.5,
    body: '<path d="M12 26h32v14a12 12 0 0 1-12 12h-8a12 12 0 0 1-12-12z"/><path d="M44 30h4a6 6 0 0 1 0 12h-4"/><path d="M22 10c-2 3 2 5 0 8M30 10c-2 3 2 5 0 8M38 10c-2 3 2 5 0 8"/>',
  },
  plate: {
    viewBox: "0 0 64 64",
    mode: "stroke",
    strokeWidth: 2.5,
    body: '<circle cx="38" cy="34" r="16"/><circle cx="38" cy="34" r="9"/><path d="M10 12v12a4 4 0 0 0 8 0V12M14 12v40"/>',
  },
  cake: {
    viewBox: "0 0 64 64",
    mode: "stroke",
    strokeWidth: 2.5,
    body: '<path d="M12 52h40V34a4 4 0 0 0-4-4H16a4 4 0 0 0-4 4z"/><path d="M12 41c4 3 8 3 10 0s8-3 10 0 8 3 10 0 8-3 10 0"/><path d="M32 30v-8"/><path d="M32 12c-2.5 2.5-2.5 6 0 7.5 2.5-1.5 2.5-5 0-7.5z"/>',
  },
  music: {
    viewBox: "0 0 64 64",
    mode: "stroke",
    strokeWidth: 2.5,
    body: '<path d="M24 46V16l26-6v30"/><circle cx="18" cy="46" r="6"/><circle cx="44" cy="40" r="6"/>',
  },
  instagram: {
    viewBox: "0 0 24 24",
    mode: "stroke",
    strokeWidth: 2,
    body: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none"/>',
  },
  facebook: {
    viewBox: "0 0 24 24",
    mode: "fill",
    body: '<path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.6 1.6-1.6h1.7V4.4c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.2v2.3H7.4V14h2.8v8z"/>',
  },
  tiktok: {
    viewBox: "0 0 24 24",
    mode: "fill",
    body: '<path d="M16.6 2.5c.4 2.4 1.9 4 4.4 4.2v3.4c-1.6 0-3.1-.5-4.4-1.3v6.6a6.3 6.3 0 1 1-6.3-6.3c.3 0 .6 0 .9.1v3.5a2.9 2.9 0 1 0 2 2.7V2.5z"/>',
  },
} satisfies Record<string, IconDef>;

export type IconName = keyof typeof defs;
export const icons: Record<IconName, IconDef> = defs;
export const iconNames = Object.keys(defs) as [IconName, ...IconName[]];
