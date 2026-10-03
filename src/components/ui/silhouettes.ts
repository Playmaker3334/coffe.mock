interface Layer {
  d: string;
  kind: "fill" | "cut" | "cutStroke";
  width?: number;
}

interface SilhouetteDef {
  viewBox: string;
  layers: Layer[];
}

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 1 ${r * 2} 0a${r} ${r} 0 1 1 ${-r * 2} 0Z`;

const defs = {
  tostador: {
    viewBox: "-90 -80 180 160",
    layers: [
      {
        kind: "fill",
        d: [
          "M-12 -40L-22 -66H22L12 -40Z",
          circle(0, -6, 38),
          "M34 -14H60V-2H34Z",
          "M54 -14H62V16H54Z",
          "M-70 52C-56 38 -14 38 0 52C-14 64 -56 64 -70 52Z",
          "M-25.9 25.2L-18.1 26.8L-25.2 60.1L-33 58.4Z",
          "M16.1 26.8L23.9 25.2L31 58.4L23.2 60.1Z",
        ].join(""),
      },
      { kind: "cut", d: circle(0, -6, 22) },
      { kind: "fill", d: circle(0, -6, 10) },
      { kind: "cutStroke", d: "M-50 50h24M-46 56h18", width: 3 },
    ],
  },
  charla: {
    viewBox: "-80 -70 160 140",
    layers: [
      {
        kind: "fill",
        d: [
          "M-60 -50h70a12 12 0 0 1 12 12v34a12 12 0 0 1-12 12h-40l-18 16v-16h-12a12 12 0 0 1-12-12v-34a12 12 0 0 1 12-12z",
          "M-4 0h62a12 12 0 0 1 12 12v28a12 12 0 0 1-12 12h-6v16l-18-16h-38a12 12 0 0 1-12-12v-28a12 12 0 0 1 12-12z",
        ].join(""),
      },
      { kind: "cut", d: [circle(-40, -21, 5), circle(-25, -21, 5), circle(-10, -21, 5)].join("") },
      { kind: "cutStroke", d: "M8 18h44M8 32h30", width: 6 },
    ],
  },
} satisfies Record<string, SilhouetteDef>;

export type SilhouetteName = keyof typeof defs;
export const silhouettes: Record<SilhouetteName, SilhouetteDef> = defs;
