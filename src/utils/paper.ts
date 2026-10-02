type Point = [number, number];

interface EdgeOptions {
  step: number;
  amp: number;
  jag: number;
  jagChance: number;
}

function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roughRect(x0: number, y0: number, x1: number, y1: number, rand: () => number, o: EdgeOptions) {
  const points: Point[] = [];
  const side = (ax: number, ay: number, bx: number, by: number, nx: number, ny: number) => {
    const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / o.step));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      let d = (rand() * 2 - 1) * o.amp;
      if (rand() < o.jagChance) d += (rand() * 2 - 1) * o.jag;
      points.push([ax + (bx - ax) * t + nx * d, ay + (by - ay) * t + ny * d]);
    }
  };
  side(x0, y0, x1, y0, 0, -1);
  side(x1, y0, x1, y1, 1, 0);
  side(x1, y1, x0, y1, 0, 1);
  side(x0, y1, x0, y0, -1, 0);
  return `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}Z`;
}

export function paperFrame(width: number, height: number, thickness: number, seed = 1) {
  const rand = seeded(seed);
  const outer = roughRect(3, 3, width - 3, height - 3, rand, { step: 10, amp: 0.8, jag: 1.6, jagChance: 0.3 });
  const inner = roughRect(thickness, thickness, width - thickness, height - thickness, rand, {
    step: 40,
    amp: 0.7,
    jag: 0,
    jagChance: 0,
  });
  return `${outer} ${inner}`;
}
