import type {
  AppliedCombo, AppState, BalanceMovement, Category, ComboGroup, Coupon, Customer,
  Insumo, ModuleId, Order, OrderLine, OrderStatus, Product, Promotion, Unit, User,
} from "./types";

export const TIME_ZONE = "America/Merida";

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false });

export const dayKey = (iso: string | Date): string => dayFmt.format(new Date(iso));
export const hourKey = (iso: string | Date): string => hourFmt.format(new Date(iso));
export const today = (): string => dayKey(new Date());

export const canRead = (user: User | null, mod: ModuleId): boolean => !!user && (user.isAdmin || mod in user.permissions);
export const canWrite = (user: User | null, mod: ModuleId): boolean => !!user && (user.isAdmin || user.permissions[mod] === "write");

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits === "0") return "0";
  if (digits.length === 13 && digits.startsWith("521")) return digits.slice(3);
  if (digits.length === 12 && digits.startsWith("52")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

export const isValidPhone = (phone: string): boolean => phone === "0" || /^\d{10}$/.test(phone);

export const balanceOf = (movements: BalanceMovement[], phone: string): number =>
  round2(movements.filter((m) => m.phone === phone).reduce((sum, m) => sum + m.amount, 0));

export function stockProblem(products: Product[], lines: OrderLine[]): string | null {
  const wanted = new Map<string, number>();
  lines.forEach((l) => wanted.set(l.productId, (wanted.get(l.productId) ?? 0) + l.qty));
  for (const [id, qty] of wanted) {
    const p = products.find((x) => x.id === id);
    if (!p) return `Producto inexistente: ${id}`;
    if (p.stock !== null && qty > p.stock) return `Solo quedan ${p.stock} de ${p.name}`;
  }
  return null;
}

export const stockLabel = (stock: number | null): string | null =>
  stock === null ? null : stock <= 0 ? "Agotado" : stock === 1 ? "Último" : `Quedan ${stock}`;

const GROUP: Record<Category, ComboGroup | null> = {
  calientes: "bebida", frios: "bebida", panaderia: "pan", desayunos: "plato", comida: "plato", grano: null,
};
export const groupOf = (c: Category): ComboGroup | null => GROUP[c];

interface Unit1 { productId: string; name: string; price: number; group: ComboGroup }

function comboUnits(lines: OrderLine[], products: Product[]): Unit1[] {
  return lines.flatMap((l) => {
    const p = products.find((x) => x.id === l.productId);
    const group = p && groupOf(p.category);
    if (!p || !group || !p.promo || l.size !== "chico") return [];
    return Array.from({ length: l.qty }, () => ({ productId: p.id, name: p.name, price: l.price, group }));
  });
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((x, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [x, ...rest]));
}

function greedy(units: Unit1[], order: Promotion[]): { combos: AppliedCombo[]; absorbed: number } {
  let pool = [...units].sort((a, b) => b.price - a.price);
  const combos: AppliedCombo[] = [];
  let absorbed = 0;
  for (const promo of order) {
    for (;;) {
      const picked: Unit1[] = [];
      let rest = pool;
      for (const slot of promo.slots) {
        const i = rest.findIndex((u) => u.group === slot);
        if (i < 0) break;
        picked.push(rest[i]);
        rest = [...rest.slice(0, i), ...rest.slice(i + 1)];
      }
      const sum = picked.reduce((s, u) => s + u.price, 0);
      if (picked.length !== promo.slots.length || promo.price >= sum) break;
      pool = rest;
      absorbed += sum;
      combos.push({ promoId: promo.id, name: promo.name, price: promo.price, items: picked.map(({ productId, name, price }) => ({ productId, name, price })) });
    }
  }
  return { combos, absorbed };
}

export function comboChecker(
  lines: OrderLine[], products: Product[], promos: Promotion[], payFor: (p: Promotion) => number = (p) => p.price,
): { combos: AppliedCombo[]; total: number } {
  const lineTotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const active = promos.filter((p) => p.active).slice(0, 6);
  const units = comboUnits(lines, products);
  let best = { combos: [] as AppliedCombo[], total: lineTotal, pays: lineTotal };
  if (!units.length || !active.length) return best;
  for (const order of permutations(active)) {
    const { combos, absorbed } = greedy(units, order);
    const total = lineTotal - absorbed + combos.reduce((s, c) => s + c.price, 0);
    const pays = lineTotal - absorbed + combos.reduce((s, c) => s + payFor(active.find((p) => p.id === c.promoId)!), 0);
    if (pays < best.pays || (pays === best.pays && total < best.total)) best = { combos, total, pays };
  }
  return { combos: best.combos, total: best.total };
}

export function looseLines(o: Pick<Order, "lines" | "combos">): OrderLine[] {
  const absorbed = new Map<string, number>();
  o.combos.forEach((c) => c.items.forEach((i) => absorbed.set(i.productId, (absorbed.get(i.productId) ?? 0) + 1)));
  return o.lines.flatMap((l) => {
    const taken = l.size === "chico" ? Math.min(l.qty, absorbed.get(l.productId) ?? 0) : 0;
    if (taken) absorbed.set(l.productId, (absorbed.get(l.productId) ?? 0) - taken);
    return l.qty - taken > 0 ? [{ ...l, qty: l.qty - taken }] : [];
  });
}

export function employeeBenefit(
  combos: AppliedCombo[], promos: Promotion[], customer: Customer | null, usedToday: number,
): { discount: number; count: number } {
  if (!customer || customer.benefit === "ninguno") return { discount: 0, count: 0 };
  const allowed = customer.benefitDailyLimit === null ? Infinity : Math.max(0, customer.benefitDailyLimit - usedToday);
  const savings = combos
    .map((c) => promos.find((p) => p.id === c.promoId))
    .filter((p): p is Promotion => !!p?.employeeBenefit)
    .map((p) => p.price - (customer.benefit === "cortesia" ? 0 : Math.min(p.employeePrice, p.price)))
    .sort((a, b) => b - a)
    .slice(0, allowed);
  return { discount: savings.reduce((s, x) => s + x, 0), count: savings.length };
}

export function benefitUsedToday(orders: Order[], phone: string, day = today()): number {
  return orders
    .filter((o) => o.phone === phone && o.status < 4 && dayKey(o.createdAt) === day)
    .reduce((s, o) => s + o.benefitCombos, 0);
}

export function couponProblem(coupon: Coupon | undefined, phone: string, now = new Date()): string | null {
  if (!coupon) return "Cupón inexistente";
  if (coupon.phone !== phone) return "El cupón pertenece a otro cliente";
  if (coupon.status !== "active") return "El cupón ya no está activo";
  if (coupon.expiresAt && new Date(coupon.expiresAt) < now) return "El cupón venció";
  return null;
}

export const couponValue = (coupon: Coupon, preCoupon: number): number =>
  round2(Math.min(preCoupon, coupon.kind === "percent" ? (preCoupon * coupon.value) / 100 : coupon.value));

export const couponDisplayStatus = (c: Coupon, now = new Date()): string =>
  c.status === "active" && c.expiresAt && new Date(c.expiresAt) < now
    ? "Vencido"
    : ({ active: "Activo", used: "Canjeado", cancelled: "Cancelado" } as const)[c.status];

export interface Quote {
  subtotal: number;
  base: number;
  combos: AppliedCombo[];
  discountPct: number;
  discountAmount: number;
  employeeDiscount: number;
  benefitCombos: number;
  couponDiscount: number;
  couponSkipped: boolean;
  total: number;
}

export function quote(args: {
  lines: OrderLine[];
  state: Pick<AppState, "products" | "promotions" | "orders">;
  customer: Customer | null;
  coupon?: Coupon;
  channel: "caja" | "telefono" | "web";
}): Quote {
  const { lines, state, customer, coupon, channel } = args;
  const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const used = customer ? benefitUsedToday(state.orders, customer.phone) : 0;
  const hasBenefit = !!customer && customer.benefit !== "ninguno" && (customer.benefitDailyLimit === null || used < customer.benefitDailyLimit);
  const payFor = (p: Promotion) => (hasBenefit && p.employeeBenefit ? (customer!.benefit === "cortesia" ? 0 : Math.min(p.employeePrice, p.price)) : p.price);
  const { combos, total: base } = comboChecker(lines, state.products, state.promotions, payFor);
  const discountPct = customer?.discountPct ?? 0;
  const discountAmount = Math.round((base * discountPct) / 100);
  const benefit = employeeBenefit(combos, state.promotions, customer, used);
  const preCoupon = Math.max(0, base - discountAmount - benefit.discount);
  const couponSkipped = !!coupon && channel === "web" && benefit.discount > 0;
  const couponDiscount = coupon && !couponSkipped ? couponValue(coupon, preCoupon) : 0;
  return {
    subtotal, base, combos, discountPct, discountAmount,
    employeeDiscount: benefit.discount, benefitCombos: benefit.count,
    couponDiscount, couponSkipped, total: round2(preCoupon - couponDiscount),
  };
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  0: "Pendiente", 1: "Preparando", 2: "Lista", 3: "Entregada", 4: "No pasó", 5: "Cancelada",
};

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean => from < 4 && from !== to;

export const isLocked = (o: Order): boolean => o.status >= 3;

export const pendingAmount = (o: Order): number =>
  o.payment ? 0 : round2(o.total - o.credit - (o.deposit?.amount ?? 0) - o.balanceUsed);

export function paymentLabel(o: Order): string {
  if (o.credit > 0) return `Crédito ${money(o.credit)}`;
  if (o.payment) return o.payment.method === "Mixto"
    ? `Mixto (Efvo ${money(o.payment.cash)} / ${o.payment.otherMethod} ${money(o.payment.other)})`
    : o.payment.method;
  if (o.deposit) return `Anticipo ${money(o.deposit.amount)} · resta ${money(pendingAmount(o))}`;
  return "Por cobrar";
}

export interface Lane { method: string; amount: number; at: string }

export function lanesOf(o: Order): Lane[] {
  if (o.status >= 4) return [];
  const lanes: Lane[] = [];
  if (o.credit > 0) lanes.push({ method: "Crédito", amount: o.credit, at: o.createdAt });
  if (o.deposit) lanes.push({ method: o.deposit.method, amount: o.deposit.amount, at: o.deposit.at });
  if (o.balanceUsed > 0) lanes.push({ method: "Saldo a favor", amount: o.balanceUsed, at: o.createdAt });
  const rest = round2(o.total - o.credit - (o.deposit?.amount ?? 0) - o.balanceUsed);
  if (rest <= 0) return lanes;
  const at = o.paidAt ?? o.createdAt;
  if (!o.payment) lanes.push({ method: "Por cobrar", amount: rest, at });
  else if (o.payment.method === "Mixto") {
    lanes.push({ method: "Efectivo", amount: o.payment.cash, at });
    lanes.push({ method: o.payment.otherMethod, amount: o.payment.other, at });
  } else lanes.push({ method: o.payment.method, amount: rest, at });
  return lanes;
}

const NOT_VERIFIABLE = new Set(["Crédito", "Saldo a favor", "Por cobrar", "Mixto"]);

export function expectedForDay(state: Pick<AppState, "orders" | "movements" | "settings">, day: string): { cash: number; nonCash: number } {
  const lanes = [
    ...state.orders.flatMap(lanesOf),
    ...state.movements.filter((m) => m.type === "abono").map((m) => ({ method: m.method, amount: m.amount, at: m.at })),
  ].filter((l) => dayKey(l.at) === day && !NOT_VERIFIABLE.has(l.method));
  const cash = lanes.filter((l) => l.method === "Efectivo").reduce((s, l) => s + l.amount, 0);
  const nonCash = lanes.filter((l) => l.method !== "Efectivo").reduce((s, l) => s + l.amount, 0);
  return { cash: round2(state.settings.cashFloat + cash), nonCash: round2(nonCash) };
}

export const DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5] as const;

export const countTotal = (d: Record<string, number>): number =>
  round2(DENOMINATIONS.reduce((s, v) => s + v * (d[String(v)] ?? 0), 0));

const BASE: Record<Unit, { family: string; factor: number }> = {
  g: { family: "masa", factor: 1 }, kg: { family: "masa", factor: 1000 },
  ml: { family: "volumen", factor: 1 }, l: { family: "volumen", factor: 1000 },
  pza: { family: "conteo", factor: 1 },
};

export function convert(qty: number, from: Unit, to: Unit): number | null {
  if (BASE[from].family !== BASE[to].family) return null;
  return (qty * BASE[from].factor) / BASE[to].factor;
}

export function unitCost(i: Insumo): number {
  const qty = convert(i.packQty, i.packUnit, i.unit);
  return qty ? i.packPrice / qty : 0;
}

export function recipeCost(p: Product, insumos: Insumo[]): number {
  return round2(p.recipe.reduce((sum, r) => {
    const ins = insumos.find((i) => i.id === r.insumoId);
    const qty = ins && convert(r.qty, r.unit, ins.unit);
    return ins && qty !== null && qty !== undefined ? sum + qty * unitCost(ins) : sum;
  }, 0));
}

export const insumoLevel = (i: Insumo): "bajo" | "ok" | "exceso" =>
  i.current < i.min ? "bajo" : i.current > i.max ? "exceso" : "ok";

export const round2 = (n: number): number => Math.round(n * 100) / 100;

const mxn0 = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const mxn2 = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = (n: number): string => (Number.isInteger(round2(n)) ? mxn0 : mxn2).format(n);
