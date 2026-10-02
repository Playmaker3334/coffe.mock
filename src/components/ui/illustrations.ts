interface IllustrationDef {
  blob: string;
  lines: string[];
}

const defs = {
  latte: {
    blob: "M-62 -18C-50 -48 30 -60 58 -30C78 -8 62 52 18 60C-30 68 -78 30 -62 -18Z",
    lines: [
      "M-48 -14C-47 18 -40 44 -8 47C22 49 34 30 37 -13",
      "M-50 -15C-30 -9 20 -9 39 -15",
      "M-49 -16C-30 -22 18 -23 38 -16",
      "M37 -2C56 -6 60 22 33 25",
      "M-64 50C-30 60 30 60 62 49",
      "M-18 -16C-12 -12 -4 -12 2 -17C6 -12 12 -11 16 -15",
      "M-20 -40C-26 -48 -14 -54 -20 -64",
      "M2 -42C-4 -50 8 -56 2 -66",
    ],
  },
  panDulce: {
    blob: "M-70 10C-66 -36 -10 -54 34 -40C74 -26 76 22 40 40C2 58 -72 52 -70 10Z",
    lines: [
      "M-66 22C-60 -4 -38 -30 0 -32C38 -33 60 -6 66 20",
      "M-66 22C-40 30 40 31 66 20",
      "M-34 -18C-30 -2 -28 14 -26 27",
      "M-6 -30C-4 -10 -3 10 -2 30",
      "M24 -24C22 -6 22 12 22 29",
      "M-54 6C-52 12 -50 18 -48 25",
      "M46 -8C46 4 46 14 47 25",
    ],
  },
  pay: {
    blob: "M-64 -4C-56 -42 20 -56 54 -26C80 -2 66 44 22 52C-24 60 -72 34 -64 -4Z",
    lines: [
      "M-58 30L52 30C54 18 54 6 52 -6L-56 -2",
      "M-56 -2C-30 -24 10 -40 52 -6",
      "M-58 30C-58 18 -57 8 -56 -2",
      "M-50 8C-20 10 20 9 50 4",
      "M-40 -14C-30 -18 -20 -20 -12 -19",
      "M22 -30C24 -38 32 -40 34 -32C36 -26 28 -24 22 -30Z",
    ],
  },
} satisfies Record<string, IllustrationDef>;

export type IllustrationName = keyof typeof defs;
export const illustrations: Record<IllustrationName, IllustrationDef> = defs;
export const illustrationNames = Object.keys(defs) as [IllustrationName, ...IllustrationName[]];
