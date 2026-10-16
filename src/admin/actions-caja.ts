import type { Result } from "./actions";
import { countTotal, DENOMINATIONS, expectedForDay, round2, today } from "./logic";
import type { AppState, CashCount } from "./types";

const VALID = new Set(DENOMINATIONS.map(String));

export function registerCount(
  s: AppState, input: { denominations: Record<string, number>; nonCash: number; by: string },
): Result & { count?: CashCount } {
  const bad = Object.entries(input.denominations).find(([k, v]) => !VALID.has(k) || !Number.isInteger(v) || v < 0);
  if (bad) return { ok: false, error: `Denominación o cantidad inválida: ${bad[0]}` };
  if (!(input.nonCash >= 0)) return { ok: false, error: "El total no efectivo no puede ser negativo" };
  const day = today();
  const expected = expectedForDay(s, day);
  const count: CashCount = {
    id: `K-${Date.now().toString(36)}`,
    day,
    at: new Date().toISOString(),
    by: input.by,
    denominations: Object.fromEntries(Object.entries(input.denominations).filter(([, v]) => v > 0)),
    counted: countTotal(input.denominations),
    nonCash: round2(input.nonCash),
    float: s.settings.cashFloat,
    expectedCash: expected.cash,
    expectedNonCash: expected.nonCash,
  };
  return { ok: true, state: { ...s, counts: [...s.counts, count] }, count };
}

export function setCashFloat(s: AppState, amount: number): Result {
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: "El fondo debe ser $0 o más" };
  return { ok: true, state: { ...s, settings: { ...s.settings, cashFloat: round2(amount) } } };
}
