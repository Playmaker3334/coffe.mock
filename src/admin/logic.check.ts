import assert from "node:assert/strict";
import { comboChecker, convert, countTotal, employeeBenefit, normalizePhone, quote, stockProblem } from "./logic.ts";
import type { Customer, OrderLine, Product, Promotion } from "./types.ts";

const p = (id: string, category: Product["category"], price: number, stock: number | null = null): Product => ({
  id, name: id, category, sizes: [{ id: "chico", price, active: true }, { id: "grande", price: price + 10, active: true }],
  stockInit: stock, stock, promo: true, active: true, recipe: [],
});
const products = [p("latte", "calientes", 55), p("rol", "panaderia", 38, 2), p("chilaquiles", "desayunos", 95)];
const promos: Promotion[] = [
  { id: "cafe-pan", name: "Café y pan", price: 65, slots: ["bebida", "pan"], employeeBenefit: true, employeePrice: 45, active: true },
  { id: "completo", name: "Completo", price: 145, slots: ["plato", "bebida", "pan"], employeeBenefit: false, employeePrice: 0, active: true },
];
const line = (productId: string, qty: number, price: number, size: "chico" | "grande" = "chico"): OrderLine => ({ productId, size, qty, price, name: productId });

assert.equal(comboChecker([line("latte", 1, 55), line("rol", 1, 38)], products, promos).total, 65);
assert.equal(comboChecker([line("latte", 1, 65, "grande"), line("rol", 1, 38)], products, promos).total, 103);
assert.equal(comboChecker([line("latte", 1, 55), line("rol", 1, 38), line("chilaquiles", 1, 95)], products, promos).total, 145);

const emp: Customer = { phone: "9990000000", name: "E", type: "empleado", discountPct: 0, company: "X", benefit: "cortesia", benefitDailyLimit: 1, notes: "" };
const combos = comboChecker([line("latte", 2, 55), line("rol", 2, 38)], products, promos).combos;
assert.deepEqual(employeeBenefit(combos, promos, emp, 0), { discount: 65, count: 1 });
assert.deepEqual(employeeBenefit(combos, promos, emp, 1), { discount: 0, count: 0 });

const promos2 = [...promos, { id: "desayuno", name: "Desayuno con café", price: 125, slots: ["plato", "bebida"] as Promotion["slots"], employeeBenefit: true, employeePrice: 95, active: true }];
const qe = quote({ lines: [line("latte", 1, 55), line("rol", 1, 38), line("chilaquiles", 1, 95)], state: { products, promotions: promos2, orders: [] }, customer: emp, channel: "caja" });
assert.equal(qe.total, 38);

const vip = { ...emp, type: "frecuente" as const, benefit: "ninguno" as const, discountPct: 10 };
const coupon = { id: "c", phone: vip.phone, kind: "percent" as const, value: 50, concept: "x", status: "active" as const, expiresAt: null, createdBy: "a", createdAt: "", usedAt: null, usedSaleId: null, discountApplied: 0 };
const q = quote({ lines: [line("latte", 1, 55), line("rol", 1, 38)], state: { products, promotions: promos, orders: [] }, customer: vip, coupon, channel: "caja" });
assert.equal(q.discountAmount, 7);
assert.equal(q.couponDiscount, 29);
assert.equal(q.total, 29);

assert.equal(stockProblem(products, [line("rol", 1, 38), line("rol", 2, 48, "grande")]), "Solo quedan 2 de rol");

assert.equal(normalizePhone("+52 999 111 2233"), "9991112233");
assert.equal(normalizePhone("521 999 111 2233"), "9991112233");
assert.equal(convert(1, "kg", "g"), 1000);
assert.equal(convert(1, "kg", "ml"), null);
assert.equal(countTotal({ "500": 1, "20": 2, "0.5": 3 }), 541.5);

console.log("logic.check: OK");
