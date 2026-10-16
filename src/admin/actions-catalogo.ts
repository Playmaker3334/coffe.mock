import type { Result } from "./actions";
import { convert } from "./logic";
import type { AppState, Insumo, Product, Promotion, RecipeLine } from "./types";

const fail = (error: string): Result => ({ ok: false, error });
const MAX_ACTIVE_PROMOS = 6;

export const slugify = (name: string): string =>
  name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function saveProduct(s: AppState, p: Product, isNew: boolean): Result {
  if (!p.name.trim()) return fail("Escribe el nombre del producto");
  if (!p.id) return fail("El producto necesita un identificador");
  if (isNew && s.products.some((x) => x.id === p.id)) return fail(`Ya existe un producto con id "${p.id}"`);
  const active = p.sizes.filter((z) => z.active);
  if (!active.length) return fail("Activa al menos un tamaño");
  if (active.some((z) => !(z.price > 0))) return fail("Cada tamaño activo necesita precio mayor a $0");
  if (p.stockInit !== null && (!Number.isInteger(p.stockInit) || p.stockInit < 0)) return fail("Las existencias deben ser un entero ≥ 0 o quedar vacías");
  const stock = p.stockInit === null ? null : isNew ? p.stockInit : (s.products.find((x) => x.id === p.id)?.stock ?? p.stockInit);
  const next: Product = { ...p, name: p.name.trim().slice(0, 80), stock };
  return {
    ok: true,
    state: { ...s, products: isNew ? [...s.products, next] : s.products.map((x) => (x.id === p.id ? next : x)) },
  };
}

export function adjustStock(s: AppState, id: string, delta: number): Result {
  const p = s.products.find((x) => x.id === id);
  if (!p) return fail("Producto no encontrado");
  if (p.stock === null) return fail("Este producto no lleva control de existencias");
  if (p.stock + delta < 0) return fail("Las existencias no pueden quedar negativas");
  return { ok: true, state: { ...s, products: s.products.map((x) => (x.id === id ? { ...x, stock: p.stock! + delta } : x)) } };
}

export function saveInsumo(s: AppState, i: Insumo, isNew: boolean): Result {
  if (!i.name.trim()) return fail("Escribe el nombre del insumo");
  if (isNew && s.insumos.some((x) => x.id === i.id)) return fail("Ya existe un insumo con ese nombre");
  if (convert(1, i.packUnit, i.unit) === null) return fail(`No se puede convertir ${i.packUnit} a ${i.unit}: son de familias distintas (masa, volumen o piezas)`);
  if (!(i.packQty > 0)) return fail("La cantidad de la presentación debe ser mayor a 0");
  if (i.packPrice < 0) return fail("El precio de compra no puede ser negativo");
  if (i.current < 0 || i.min < 0 || i.max < 0) return fail("Existencias, mínimo y máximo deben ser ≥ 0");
  if (i.max && i.min > i.max) return fail("El mínimo no puede ser mayor al máximo");
  const next = { ...i, name: i.name.trim(), supplier: i.supplier.trim() };
  return { ok: true, state: { ...s, insumos: isNew ? [...s.insumos, next] : s.insumos.map((x) => (x.id === i.id ? next : x)) } };
}

export function saveRecipe(s: AppState, productId: string, recipe: RecipeLine[]): Result {
  if (!s.products.some((p) => p.id === productId)) return fail("Producto no encontrado");
  for (const r of recipe) {
    const ins = s.insumos.find((i) => i.id === r.insumoId);
    if (!ins) return fail("Elige un insumo en cada renglón");
    if (!(r.qty > 0)) return fail(`La cantidad de ${ins.name} debe ser mayor a 0`);
    if (convert(1, r.unit, ins.unit) === null) return fail(`${ins.name} se mide en ${ins.unit}; no se puede usar ${r.unit}`);
  }
  return { ok: true, state: { ...s, products: s.products.map((p) => (p.id === productId ? { ...p, recipe } : p)) } };
}

export function savePromotion(s: AppState, p: Promotion, isNew: boolean): Result {
  if (!p.name.trim()) return fail("Escribe el nombre del combo");
  if (!(p.price > 0)) return fail("El precio del combo debe ser mayor a $0");
  if (p.slots.length < 2) return fail("Un combo necesita al menos 2 piezas");
  if (p.employeeBenefit && (p.employeePrice < 0 || p.employeePrice > p.price)) return fail("El precio de empleado va de $0 al precio del combo");
  const others = s.promotions.filter((x) => x.id !== p.id && x.active).length;
  if (p.active && others >= MAX_ACTIVE_PROMOS) return fail(`Máximo ${MAX_ACTIVE_PROMOS} combos activos; desactiva otro primero`);
  if (isNew && s.promotions.some((x) => x.id === p.id)) return fail("Ya existe un combo con ese nombre");
  const next = { ...p, name: p.name.trim().slice(0, 60) };
  return { ok: true, state: { ...s, promotions: isNew ? [...s.promotions, next] : s.promotions.map((x) => (x.id === p.id ? next : x)) } };
}
