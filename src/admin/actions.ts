import {
  balanceOf, canTransition, couponProblem, isLocked, normalizePhone, quote, round2, stockProblem,
} from "./logic";
import type { AppState, Channel, Coupon, Customer, Order, OrderLine, OrderStatus, OrderType, Payment } from "./types";

export type Result = { ok: true; state: AppState; order?: Order } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

const now = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const withOrder = (s: AppState, o: Order): AppState => ({ ...s, orders: s.orders.map((x) => (x.id === o.id ? o : x)) });

function moveStock(s: AppState, lines: OrderLine[], sign: 1 | -1): AppState {
  return {
    ...s,
    products: s.products.map((p) => {
      if (p.stock === null) return p;
      const qty = lines.filter((l) => l.productId === p.id).reduce((sum, l) => sum + l.qty, 0);
      return qty ? { ...p, stock: p.stock + sign * qty } : p;
    }),
  };
}

function releaseCoupon(s: AppState, o: Order): AppState {
  if (!o.couponId) return s;
  return {
    ...s,
    coupons: s.coupons.map((c) => {
      if (c.id !== o.couponId) return c;
      const isCourtesy = c.createdAt === c.usedAt && c.usedSaleId === o.id;
      return { ...c, status: isCourtesy ? "cancelled" : "active", usedAt: null, usedSaleId: null, discountApplied: 0 };
    }),
  };
}

export function upsertCustomer(s: AppState, c: Customer): Result {
  const phone = normalizePhone(c.phone);
  if (!/^\d{10}$/.test(phone)) return fail("El teléfono debe tener 10 dígitos");
  if (!c.name.trim()) return fail("Escribe el nombre del cliente");
  if (c.discountPct < 0 || c.discountPct > 100) return fail("El descuento va de 0 a 100 %");
  const next = { ...c, phone, name: c.name.trim().slice(0, 120) };
  const exists = s.customers.some((x) => x.phone === phone);
  return { ok: true, state: { ...s, customers: exists ? s.customers.map((x) => (x.phone === phone ? next : x)) : [...s.customers, next] } };
}

export function addBalance(s: AppState, phone: string, amount: number, method: string, by: string, at = now()): Result {
  if (phone === "0") return fail("Cliente General no maneja saldo");
  if (!(amount > 0)) return fail("El abono debe ser mayor a $0");
  if (!method) return fail("Elige cómo pagó el abono");
  const t = new Date(at).getTime();
  if (t > Date.now() + 60_000) return fail("La fecha no puede ser futura");
  if (t < Date.now() - 31 * 86_400_000) return fail("Solo se aceptan abonos de hasta 31 días atrás");
  const mov = { id: uid("M"), phone, type: "abono" as const, amount: round2(amount), method, saleId: null, at, by };
  return { ok: true, state: { ...s, movements: [...s.movements, mov] } };
}

export interface NewOrder {
  channel: Channel;
  type: OrderType;
  phone: string;
  guestName: string;
  address: string;
  slot: string;
  lines: OrderLine[];
  couponId: string | null;
  note: string;
  by: string;
  method: string | null;
  received: number;
  useBalance: boolean;
  deposit: { amount: number; method: string } | null;
  creditPaid: number | null;
}

export function createOrder(s: AppState, input: NewOrder): Result {
  if (!input.lines.length) return fail("El pedido está vacío");
  if (input.type === "domicilio" && !input.address.trim()) return fail("Falta la dirección de entrega");
  const customer = s.customers.find((c) => c.phone === input.phone) ?? null;
  if (!customer) return fail("Verifica el cliente antes de cobrar");

  const stock = stockProblem(s.products, input.lines);
  if (stock) return fail(stock);

  const coupon = input.couponId ? s.coupons.find((c) => c.id === input.couponId) : undefined;
  if (input.couponId) {
    const problem = couponProblem(coupon, input.phone);
    if (problem) return fail(problem);
  }

  const q = quote({ lines: input.lines, state: s, customer, coupon, channel: input.channel });

  let credit = 0;
  if (input.creditPaid !== null) {
    if (customer.type !== "empleado" || !customer.company) return fail("El crédito es solo para empleados con empresa");
    credit = round2(q.total - input.creditPaid);
    if (credit <= 0) credit = 0;
    else if (credit > q.total) return fail("El crédito no puede ser mayor al total");
  }

  let balanceUsed = 0;
  if (input.useBalance) {
    if (credit || input.deposit) return fail("El saldo a favor no se combina con crédito ni anticipo");
    balanceUsed = Math.min(balanceOf(s.movements, input.phone), q.total);
  }

  let deposit: Order["deposit"] = null;
  let payment: Payment | null = null;
  const rest = round2(q.total - credit - balanceUsed);
  if (input.deposit) {
    const amount = round2(input.deposit.amount);
    if (!(amount > 0)) return fail("El anticipo debe ser mayor a $0");
    if (amount >= q.total) payment = { method: input.deposit.method, cash: 0, other: 0, otherMethod: "", received: amount };
    else deposit = { amount, method: input.deposit.method, at: now() };
  } else if (rest <= 0) {
    payment = { method: balanceUsed > 0 ? "Saldo" : credit > 0 ? "Crédito" : "Cortesía", cash: 0, other: 0, otherMethod: "", received: 0 };
  } else if (input.method) {
    if (input.method === "Efectivo" && input.received < rest) return fail(`Recibido insuficiente: faltan ${round2(rest - input.received)}`);
    payment = { method: input.method, cash: input.method === "Efectivo" ? rest : 0, other: 0, otherMethod: "", received: input.received };
  }

  const at = now();
  const order: Order = {
    id: s.nextOrderId, createdAt: at, channel: input.channel, type: input.type,
    phone: input.phone, guestName: input.phone === "0" ? input.guestName.trim().slice(0, 120) : "",
    address: input.type === "domicilio" ? input.address.trim() : "", slot: input.slot,
    lines: input.lines, combos: q.combos, subtotal: q.subtotal, base: q.base,
    discountPct: q.discountPct, discountAmount: q.discountAmount,
    employeeDiscount: q.employeeDiscount, benefitCombos: q.benefitCombos,
    couponId: coupon && !q.couponSkipped && q.couponDiscount > 0 ? coupon.id : null, couponDiscount: q.couponDiscount,
    total: q.total, credit, deposit, balanceUsed, payment,
    paidAt: payment ? at : null, status: 0, statusAt: at,
    notes: input.note.trim() ? [{ at, by: input.by, text: input.note.trim().slice(0, 500) }] : [],
    createdBy: input.by,
  };

  let next = moveStock(s, input.lines, -1);
  if (balanceUsed > 0) {
    next = { ...next, movements: [...next.movements, { id: uid("M"), phone: input.phone, type: "consumo", amount: -balanceUsed, method: "", saleId: order.id, at, by: input.by }] };
  }
  if (order.couponId) {
    next = { ...next, coupons: next.coupons.map((c) => (c.id === order.couponId ? { ...c, status: "used", usedAt: at, usedSaleId: order.id, discountApplied: q.couponDiscount } : c)) };
  }
  next = { ...next, orders: [...next.orders, order], nextOrderId: order.id + 1 };
  return { ok: true, state: next, order };
}

export function setStatus(s: AppState, id: number, to: OrderStatus, by: string): Result {
  const o = s.orders.find((x) => x.id === id);
  if (!o) return fail("Pedido no encontrado");
  if (!canTransition(o.status, to)) return fail("Un pedido cancelado ya no puede cambiar de estado");
  if (to === 3 && !o.payment && o.credit < o.total) return fail("Registra el cobro antes de entregar");
  let next = withOrder(s, { ...o, status: to, statusAt: now() });
  if (to >= 4) {
    next = releaseCoupon(moveStock(next, o.lines, 1), o);
    if (o.balanceUsed > 0) {
      next = { ...next, movements: [...next.movements, { id: uid("M"), phone: o.phone, type: "devolucion", amount: o.balanceUsed, method: "", saleId: o.id, at: now(), by }] };
    }
  }
  return { ok: true, state: next };
}

export function registerPayment(s: AppState, id: number, payment: Payment): Result {
  const o = s.orders.find((x) => x.id === id);
  if (!o) return fail("Pedido no encontrado");
  if (o.status >= 4) return fail("El pedido está cancelado");
  const due = round2(o.total - o.credit - (o.deposit?.amount ?? 0) - o.balanceUsed);
  if (payment.method === "Mixto" && round2(payment.cash + payment.other) !== due) return fail(`El efectivo más ${payment.otherMethod} debe sumar ${due}`);
  if (payment.method === "Efectivo" && payment.received < due) return fail("Recibido insuficiente");
  const at = now();
  return { ok: true, state: withOrder(s, { ...o, payment: { ...payment, cash: payment.method === "Efectivo" ? due : payment.cash }, paidAt: at }) };
}

export function registerDeposit(s: AppState, id: number, amount: number, method: string): Result {
  const o = s.orders.find((x) => x.id === id);
  if (!o) return fail("Pedido no encontrado");
  if (isLocked(o)) return fail("El pedido ya se entregó o canceló");
  if (o.payment || o.deposit || o.balanceUsed || o.credit) return fail("Este pedido ya tiene un pago registrado");
  if (!(amount > 0 && amount < o.total)) return fail("El anticipo debe ser mayor a $0 y menor al total");
  return { ok: true, state: withOrder(s, { ...o, deposit: { amount: round2(amount), method, at: now() } }) };
}

export function addNote(s: AppState, id: number, text: string, by: string): Result {
  const o = s.orders.find((x) => x.id === id);
  if (!o) return fail("Pedido no encontrado");
  if (!text.trim()) return fail("Escribe la nota");
  return { ok: true, state: withOrder(s, { ...o, notes: [...o.notes, { at: now(), by, text: text.trim().slice(0, 500) }] }) };
}

export function courtesy(s: AppState, id: number, amount: number, concept: string, by: string): Result {
  const o = s.orders.find((x) => x.id === id);
  if (!o) return fail("Pedido no encontrado");
  if (isLocked(o)) return fail("El pedido ya se entregó o canceló");
  if (o.payment) return fail("El pedido ya está cobrado");
  if (!(amount > 0)) return fail("El monto debe ser mayor a $0");
  if (!concept.trim()) return fail("Escribe el motivo de la cortesía");
  const at = now();
  const preCoupon = round2(o.total + o.couponDiscount);
  const covered = o.credit + (o.deposit?.amount ?? 0) + o.balanceUsed;
  const applied = round2(Math.min(amount, Math.max(0, preCoupon - covered)));
  if (applied <= 0) return fail("El pedido ya está cubierto por crédito, anticipo o saldo");
  const coupon: Coupon = {
    id: uid("C"), phone: o.phone, kind: "fixed", value: amount, concept: concept.trim(), status: "used",
    expiresAt: null, createdBy: by, createdAt: at, usedAt: at, usedSaleId: o.id, discountApplied: applied,
  };
  const released = releaseCoupon(s, o);
  const order = { ...o, couponId: coupon.id, couponDiscount: applied, total: round2(preCoupon - applied) };
  return { ok: true, state: withOrder({ ...released, coupons: [...released.coupons, coupon] }, order) };
}

export function issueCoupon(s: AppState, c: Omit<Coupon, "id" | "status" | "createdAt" | "usedAt" | "usedSaleId" | "discountApplied">): Result {
  if (!s.customers.some((x) => x.phone === c.phone) || c.phone === "0") return fail("El cupón debe ser de un cliente registrado");
  if (!(c.value > 0) || (c.kind === "percent" && c.value > 100)) return fail("Valor de cupón inválido");
  if (!c.concept.trim()) return fail("Escribe el motivo del cupón");
  const coupon: Coupon = { ...c, id: uid("C"), status: "active", createdAt: now(), usedAt: null, usedSaleId: null, discountApplied: 0 };
  return { ok: true, state: { ...s, coupons: [...s.coupons, coupon] } };
}

export const resetStock = (s: AppState): AppState => ({ ...s, products: s.products.map((p) => ({ ...p, stock: p.stockInit })) });
