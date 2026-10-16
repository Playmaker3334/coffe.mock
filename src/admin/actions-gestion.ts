import type { Result } from "./actions";
import type { AppState, Settings, User } from "./types";

const fail = (error: string): Result => ({ ok: false, error });
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function cancelCoupon(s: AppState, id: string): Result {
  const c = s.coupons.find((x) => x.id === id);
  if (!c) return fail("Cupón inexistente");
  if (c.status !== "active") return fail("Solo se cancelan cupones activos");
  return { ok: true, state: { ...s, coupons: s.coupons.map((x) => (x.id === id ? { ...x, status: "cancelled" as const } : x)) } };
}

export function saveSettings(s: AppState, next: Settings): Result {
  if (!TIME.test(next.orderStart) || !TIME.test(next.orderEnd)) return fail("Escribe las horas como HH:MM");
  if (next.orderStart >= next.orderEnd) return fail("La hora de inicio debe ser antes del cierre");
  if (!(next.cashFloat >= 0)) return fail("El fondo de caja no puede ser negativo");
  const seen = new Set<string>();
  for (const sl of next.slots) {
    if (!TIME.test(sl.time)) return fail(`Horario inválido: ${sl.time || "(vacío)"}`);
    if (seen.has(sl.time)) return fail(`Horario duplicado: ${sl.time}`);
    seen.add(sl.time);
    if (sl.deliveryLimit < 0 || sl.pickupLimit < 0) return fail(`Cupo negativo en ${sl.time}`);
    if (sl.deliveryLimit === 0 && sl.pickupLimit === 0) return fail(`El horario ${sl.time} no tiene cupo`);
  }
  const slots = [...next.slots].sort((a, b) => a.time.localeCompare(b.time));
  return { ok: true, state: { ...s, settings: { ...next, slots } } };
}

export function generateSlots(from: string, to: string, every: number, deliveryLimit: number, pickupLimit: number): Settings["slots"] | string {
  if (!TIME.test(from) || !TIME.test(to)) return "Escribe las horas como HH:MM";
  if (from >= to) return "«Desde» debe ser antes de «hasta»";
  if (!(every >= 5)) return "El intervalo mínimo es de 5 minutos";
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const out: Settings["slots"] = [];
  for (let m = toMin(from); m <= toMin(to); m += every) out.push({ time: fmt(m), deliveryLimit, pickupLimit });
  return out;
}

export function upsertUser(s: AppState, u: User): Result {
  if (!u.name.trim()) return fail("Escribe el nombre");
  if (!u.isAdmin && !u.role.trim()) return fail("Escribe el puesto");
  const next = { ...u, name: u.name.trim().slice(0, 60), role: u.role.trim().slice(0, 60) };
  const exists = s.users.some((x) => x.id === u.id);
  const users = exists ? s.users.map((x) => (x.id === u.id ? next : x)) : [...s.users, next];
  if (!users.some((x) => x.isAdmin && x.active)) return fail("Debe quedar al menos un administrador activo");
  return { ok: true, state: { ...s, users } };
}
