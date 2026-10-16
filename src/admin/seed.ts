import menu from "../content/menu.json";
import menuLista from "../content/menu-lista.json";
import tienda from "../content/tienda.json";
import { dayKey, lanesOf, quote, round2, TIME_ZONE } from "./logic";
import type {
  AppState, BalanceMovement, Category, Coupon, Customer, Insumo, Order, OrderLine, Product, Promotion, RecipeLine, User,
} from "./types";

export const STATE_VERSION = 3;

const STOCKED: Partial<Record<Category, number>> = { panaderia: 24, grano: 12 };

function product(id: string, name: string, category: Category, price: number, large?: number): Product {
  const stock = STOCKED[category] ?? null;
  return {
    id, name, category,
    sizes: [{ id: "chico", price, active: true }, ...(large ? [{ id: "grande" as const, price: large, active: true }] : [])],
    stockInit: stock, stock,
    promo: category !== "grano" && id !== "leche-vegetal",
    active: true,
    recipe: RECIPES[id] ?? [],
  };
}

const r = (insumoId: string, qty: number, unit: RecipeLine["unit"]): RecipeLine => ({ insumoId, qty, unit });
const espresso = [r("cafe", 18, "g"), r("vaso12", 1, "pza"), r("tapa", 1, "pza")];
const latte = [...espresso, r("leche", 220, "ml")];
const RECIPES: Record<string, RecipeLine[]> = {
  espresso: [r("cafe", 18, "g")],
  cortado: [r("cafe", 18, "g"), r("leche", 60, "ml")],
  americano: espresso,
  capuchino: latte,
  "capuchino-canela": [...latte, r("canela", 2, "g")],
  latte,
  "flat-white": latte,
  "latte-cajeta": [...latte, r("cajeta", 30, "g")],
  "latte-vainilla": [...latte, r("vainilla", 10, "ml")],
  "cafe-olla": [r("cafe", 15, "g"), r("piloncillo", 20, "g"), r("canela", 2, "g"), r("vaso12", 1, "pza")],
  mocha: [...latte, r("chocolate", 25, "g")],
  chocolate: [r("chocolate", 35, "g"), r("leche", 240, "ml"), r("vaso12", 1, "pza")],
  matcha: [r("matcha", 4, "g"), r("leche", 220, "ml"), r("vaso12", 1, "pza")],
  "cold-brew": [r("cafe", 25, "g"), r("vaso16", 1, "pza"), r("tapa", 1, "pza")],
  "latte-helado": [...latte.filter((x) => x.insumoId !== "vaso12"), r("vaso16", 1, "pza")],
  concha: [r("harina", 60, "g"), r("mantequilla", 15, "g"), r("azucar", 15, "g")],
  "rol-canela": [r("harina", 70, "g"), r("mantequilla", 20, "g"), r("azucar", 20, "g"), r("canela", 3, "g")],
  cuernito: [r("harina", 50, "g"), r("mantequilla", 25, "g")],
};

function buildProducts(): Product[] {
  const fromMenu = menu.map((m) => product(m.id, m.name, m.tab as Category, m.price));
  const fromLista = menuLista.map((m) => product(m.id, m.name, m.tab as Category, m.price, "large" in m ? (m.large as number) : undefined));
  const fromShop = tienda
    .filter((t) => t.source === "propio")
    .map((t) => product(t.id, t.name!, t.category === "cafe" ? "frios" : "grano", t.price!));
  const shared = fromShop.find((p) => p.id === "combo-compartir");
  return [...fromMenu, ...fromLista, ...fromShop.map((p) => (p === shared ? { ...p, promo: false } : p))];
}

const INSUMOS: Insumo[] = [
  { id: "cafe", name: "Café en grano (tueste casa)", unit: "g", packQty: 1, packUnit: "kg", packPrice: 380, current: 4200, min: 3000, max: 10000, supplier: "Finca Los Altos" },
  { id: "leche", name: "Leche entera", unit: "ml", packQty: 1, packUnit: "l", packPrice: 28, current: 9000, min: 12000, max: 40000, supplier: "Lácteos del Sureste" },
  { id: "cajeta", name: "Cajeta", unit: "g", packQty: 660, packUnit: "g", packPrice: 85, current: 1800, min: 600, max: 4000, supplier: "Dulcería Celaya" },
  { id: "vainilla", name: "Extracto de vainilla", unit: "ml", packQty: 250, packUnit: "ml", packPrice: 140, current: 400, min: 200, max: 1000, supplier: "Vainillas Papantla" },
  { id: "canela", name: "Canela en raja", unit: "g", packQty: 250, packUnit: "g", packPrice: 95, current: 700, min: 200, max: 1500, supplier: "Especias Lucas" },
  { id: "piloncillo", name: "Piloncillo", unit: "g", packQty: 1, packUnit: "kg", packPrice: 45, current: 2500, min: 1000, max: 5000, supplier: "Especias Lucas" },
  { id: "chocolate", name: "Chocolate de mesa", unit: "g", packQty: 500, packUnit: "g", packPrice: 110, current: 1500, min: 800, max: 4000, supplier: "Chocolatería Maya" },
  { id: "matcha", name: "Matcha ceremonial", unit: "g", packQty: 100, packUnit: "g", packPrice: 320, current: 90, min: 100, max: 500, supplier: "Té Oriente" },
  { id: "harina", name: "Harina de trigo", unit: "g", packQty: 20, packUnit: "kg", packPrice: 520, current: 14000, min: 8000, max: 40000, supplier: "Molinos del Golfo" },
  { id: "mantequilla", name: "Mantequilla", unit: "g", packQty: 1, packUnit: "kg", packPrice: 210, current: 3500, min: 2000, max: 8000, supplier: "Lácteos del Sureste" },
  { id: "azucar", name: "Azúcar estándar", unit: "g", packQty: 2, packUnit: "kg", packPrice: 58, current: 6000, min: 3000, max: 15000, supplier: "Abarrotes Centro" },
  { id: "vaso12", name: "Vaso 12 oz", unit: "pza", packQty: 50, packUnit: "pza", packPrice: 115, current: 320, min: 200, max: 1000, supplier: "Empaques Yuc" },
  { id: "vaso16", name: "Vaso 16 oz", unit: "pza", packQty: 50, packUnit: "pza", packPrice: 135, current: 140, min: 150, max: 800, supplier: "Empaques Yuc" },
  { id: "tapa", name: "Tapa para vaso", unit: "pza", packQty: 100, packUnit: "pza", packPrice: 90, current: 700, min: 300, max: 2000, supplier: "Empaques Yuc" },
];

const PROMOTIONS: Promotion[] = [
  { id: "cafe-pan", name: "Café y pan", price: 65, slots: ["bebida", "pan"], employeeBenefit: true, employeePrice: 45, active: true },
  { id: "desayuno-cafe", name: "Desayuno con café", price: 125, slots: ["plato", "bebida"], employeeBenefit: true, employeePrice: 95, active: true },
  { id: "desayuno-completo", name: "Desayuno completo", price: 145, slots: ["plato", "bebida", "pan"], employeeBenefit: false, employeePrice: 0, active: true },
];

const customer = (phone: string, name: string, type: Customer["type"], extra: Partial<Customer> = {}): Customer => ({
  phone, name, type, discountPct: 0, company: "", benefit: "ninguno", benefitDailyLimit: 1, notes: "", ...extra,
});

const CUSTOMERS: Customer[] = [
  customer("0", "Cliente General", "general"),
  customer("9991112233", "Mariana Pech", "frecuente", { discountPct: 5, notes: "Latte deslactosado" }),
  customer("9992223344", "Luis Canché", "empleado", { company: "Despacho Ortiz", benefit: "descuento" }),
  customer("9993334455", "Sofía May", "empleado", { company: "Despacho Ortiz", benefit: "cortesia" }),
  customer("9994445566", "Jorge Euán", "empleado", { company: "Clínica Itzimná", benefit: "descuento" }),
  customer("9995556677", "Oficinas Montejo", "empresa", { discountPct: 10, company: "Oficinas Montejo" }),
  customer("9996667788", "Paola Chi", "general"),
  customer("9997778899", "Andrés Cauich", "frecuente", { discountPct: 5 }),
];

const USERS: User[] = [
  { id: "admin", name: "Isa", role: "Administración", isAdmin: true, active: true, permissions: {} },
  {
    id: "gerente", name: "Mónica", role: "Gerente", isAdmin: false, active: true,
    permissions: { caja: "write", barra: "write", productos: "write", inventario: "write", promociones: "read", clientes: "write", credito: "read", cupones: "write", corte: "write", cierre: "read", ventas: "read" },
  },
  { id: "cajero", name: "Caro", role: "Caja", isAdmin: false, active: true, permissions: { caja: "write", barra: "write", corte: "write", clientes: "read" } },
  { id: "barista", name: "Beto", role: "Barra", isAdmin: false, active: true, permissions: { barra: "write", productos: "read" } },
];

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function meridaDate(day: string, hour: number, minute: number): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour + 6, minute));
}

function shiftDay(day: string, delta: number): string {
  return dayKey(new Date(meridaDate(day, 12, 0).getTime() + delta * 86_400_000));
}

const SLOTS = ["08:00", "08:30", "09:00", "09:30", "10:00", "13:00", "13:30", "14:00", "17:00", "18:00"];
const METHODS = ["Efectivo", "Efectivo", "Efectivo", "Tarjeta", "Tarjeta", "Transferencia"];

export function createSeed(now = new Date()): AppState {
  const rand = mulberry32(20261012);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
  const products = buildProducts();
  const sellable = products.filter((p) => p.category !== "grano" && p.id !== "leche-vegetal");
  const base: AppState = {
    version: STATE_VERSION, nextOrderId: 1001, products, insumos: INSUMOS, promotions: PROMOTIONS,
    customers: CUSTOMERS, movements: [], coupons: [], orders: [], users: USERS, counts: [],
    settings: {
      orderStart: "07:00", orderEnd: "20:30", deliveryEnabled: true, cashFloat: 1000,
      slots: SLOTS.map((time) => ({ time, deliveryLimit: 4, pickupLimit: 999 })),
    },
  };

  const todayKey = dayKey(now);
  const nowHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hour12: false }).format(now));
  const orders: Order[] = [];
  const movements: BalanceMovement[] = [];
  const coupons: Coupon[] = [];
  let id = 1001;

  for (let back = 13; back >= 0; back--) {
    const day = shiftDay(todayKey, -back);
    const isToday = back === 0;
    const lastHour = isToday ? Math.min(20, Math.max(7, nowHour)) : 20;
    const count = isToday ? Math.max(6, Math.round((lastHour - 7) * 2.2)) : 22 + Math.floor(rand() * 14);

    for (let n = 0; n < count; n++) {
      const hour = 7 + Math.floor(rand() * (lastHour - 7 + 1));
      const created = isToday && n >= count - 5 ? new Date(now.getTime() - (count - n) * 7 * 60_000) : meridaDate(day, hour, Math.floor(rand() * 60));
      if (created > now) continue;
      const pool = isToday ? CUSTOMERS.slice(1).filter((c) => c.type !== "empleado") : CUSTOMERS.slice(1);
      const cust = rand() < 0.55 ? CUSTOMERS[0] : pick(pool);
      const lines: OrderLine[] = [];
      const items = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < items; k++) {
        const p = pick(sellable);
        const size = p.sizes.length > 1 && rand() < 0.3 ? p.sizes[1] : p.sizes[0];
        const existing = lines.find((l) => l.productId === p.id && l.size === size.id);
        if (existing) continue;
        lines.push({ productId: p.id, size: size.id, qty: rand() < 0.15 ? 2 : 1, price: size.price, name: p.name });
      }
      const q = quote({ lines, state: { ...base, orders }, customer: cust, channel: "caja" });
      const channel = rand() < 0.2 ? "web" : rand() < 0.15 ? "telefono" : "caja";
      const type = channel === "caja" ? "mostrador" : rand() < 0.5 ? "domicilio" : "recoger";
      const isEmployee = cust.type === "empleado";
      const credit = isEmployee && rand() < 0.7 ? q.total : 0;
      const recent = isToday && created.getTime() > now.getTime() - 50 * 60_000;
      const status = recent ? (pick([0, 0, 1, 2] as const)) : rand() < 0.04 ? 5 : 3;
      const paid = !recent || channel === "caja";
      const method = credit > 0 ? "Crédito" : pick(METHODS);
      orders.push({
        id: id++, createdAt: created.toISOString(), channel, type,
        phone: cust.phone, guestName: cust.phone === "0" && rand() < 0.4 ? pick(["Ana", "Toño", "Lupita", "Ramiro"]) : "",
        address: type === "domicilio" ? pick(["Calle 47 #512, Centro", "Calle 20 #88, Itzimná", "Av. Pérez Ponce #210"]) : "",
        slot: channel === "caja" ? "" : pick(SLOTS),
        lines, combos: q.combos, subtotal: q.subtotal, base: q.base,
        discountPct: q.discountPct, discountAmount: q.discountAmount,
        employeeDiscount: q.employeeDiscount, benefitCombos: q.benefitCombos,
        couponId: null, couponDiscount: 0, total: q.total, credit,
        deposit: null, balanceUsed: 0,
        payment: paid && credit === 0 ? { method, cash: method === "Efectivo" ? q.total : 0, other: 0, otherMethod: "", received: q.total } : null,
        paidAt: paid ? created.toISOString() : null,
        status, statusAt: created.toISOString(),
        notes: rand() < 0.1 ? [{ at: created.toISOString(), by: "Caro", text: pick(["Sin azúcar", "Leche de almendra", "Extra caliente", "Para llevar"]) }] : [],
        createdBy: channel === "web" ? "Tienda en línea" : pick(["Caro", "Mónica"]),
      });
    }
  }

  [["9991112233", "Mónica", "Cumpleaños", 50, 9], ["9997778899", "Caro", "Café frío por error", 72, 4], ["9996667788", "Isa", "Bienvenida", 10, 2]].forEach(([phone, by, concept, value, back], i) => {
    const at = meridaDate(shiftDay(todayKey, -(back as number)), 10, 15).toISOString();
    coupons.push({
      id: `C-${100 + i}`, phone: phone as string, kind: concept === "Bienvenida" ? "percent" : "fixed", value: value as number,
      concept: concept as string, status: i === 2 ? "active" : "used", expiresAt: null, createdBy: by as string, createdAt: at,
      usedAt: i === 2 ? null : at, usedSaleId: null, discountApplied: i === 2 ? 0 : (value as number),
    });
  });

  [["9991112233", 300, "Transferencia", 6], ["9997778899", 200, "Efectivo", 3]].forEach(([phone, amount, method, back], i) => {
    movements.push({ id: `M-${i + 1}`, phone: phone as string, type: "abono", amount: amount as number, method: method as string, saleId: null, at: meridaDate(shiftDay(todayKey, -(back as number)), 9, 0).toISOString(), by: "Caro" });
  });
  movements.push({ id: "M-3", phone: "9991112233", type: "consumo", amount: -75, method: "", saleId: null, at: meridaDate(shiftDay(todayKey, -2), 9, 20).toISOString(), by: "Caro" });

  const soldToday = new Map<string, number>();
  orders.filter((o) => dayKey(o.createdAt) === todayKey && o.status < 4).forEach((o) => o.lines.forEach((l) => soldToday.set(l.productId, (soldToday.get(l.productId) ?? 0) + l.qty)));
  const stocked = products.map((p) => (p.stock === null ? p : { ...p, stock: Math.max(0, p.stock - (soldToday.get(p.id) ?? 0)) }));

  const counts = [1, 2, 3].map((back) => {
    const day = shiftDay(todayKey, -back);
    const dayLanes = orders.flatMap(lanesOf).filter((l) => dayKey(l.at) === day);
    const cash = round2(1000 + dayLanes.filter((l) => l.method === "Efectivo").reduce((s, l) => s + l.amount, 0));
    const nonCash = round2(dayLanes.filter((l) => ["Tarjeta", "Transferencia", "Terminal"].includes(l.method)).reduce((s, l) => s + l.amount, 0));
    const counted = cash - (back === 2 ? 40 : back === 3 ? -20 : 0);
    return { id: `K-${back}`, day, at: meridaDate(day, 21, 5).toISOString(), by: "Caro", denominations: {}, counted, nonCash, float: 1000, expectedCash: cash, expectedNonCash: nonCash };
  });

  return { ...base, products: stocked, orders, movements, coupons, counts, nextOrderId: id };
}
