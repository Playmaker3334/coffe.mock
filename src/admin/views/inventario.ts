import { saveInsumo, saveRecipe, slugify } from "../actions-catalogo";
import { canWrite, insumoLevel, recipeCost, unitCost } from "../logic";
import { session, store } from "../store";
import type { Insumo, Product, RecipeLine, Unit } from "../types";
import { $, cls, html, money, onAction, openDialog, raw, render, toast } from "../ui";

type Tab = "insumos" | "recetas";
const UNITS: Unit[] = ["g", "kg", "ml", "l", "pza"];
const LEVEL = {
  bajo: { label: "Bajo mínimo", tone: "bg-chili text-cream" },
  ok: { label: "En rango", tone: "bg-leaf text-cream" },
  exceso: { label: "Sobre máximo", tone: "bg-orange text-ink" },
} as const;
const MAX_RECIPE_LINES = 8;

const fmtQty = (n: number) => new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(n);
const pct = (n: number) => `${Math.round(n * 100)} %`;

export function mountInventario(): void {
  const user = session.user();
  if (!user) return;
  const writable = canWrite(user, "inventario");
  const root = $("[data-view]");
  let tab: Tab = "insumos";
  let onlyLow = false;

  const unitOptions = (selected: Unit) => UNITS.map((u) => html`<option value="${u}" ${u === selected ? raw("selected") : ""}>${u}</option>`);

  function insumosView() {
    const s = store.get();
    const low = s.insumos.filter((i) => insumoLevel(i) === "bajo").length;
    const shown = onlyLow ? s.insumos.filter((i) => insumoLevel(i) === "bajo") : s.insumos;
    return html`
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <button type="button" data-action="low" aria-pressed="${onlyLow}" class="${cls.tab} bg-paper">Solo bajos (${low})</button>
        ${writable ? html`<button type="button" data-action="new-insumo" class="${cls.btn.sun} ml-auto">Nuevo insumo</button>` : ""}
      </div>
      <div class="${cls.card} overflow-x-auto p-4">
        ${shown.length ? html`
          <table class="w-full min-w-[48rem] text-left">
            <thead><tr class="${cls.th}">
              <th scope="col" class="pb-2">Insumo</th><th scope="col" class="pb-2">Nivel</th><th scope="col" class="pb-2">Actual</th>
              <th scope="col" class="pb-2">Mín / Máx</th><th scope="col" class="pb-2">Costo unitario</th><th scope="col"><span class="sr-only">Acciones</span></th>
            </tr></thead>
            <tbody>
              ${shown.map((i) => {
                const lv = LEVEL[insumoLevel(i)];
                return html`
                  <tr class="border-t-2 border-ink/15">
                    <td class="py-3 pr-3"><p class="font-bold">${i.name}</p><p class="text-sm text-ink/75">${i.supplier || "Sin proveedor"} · ${fmtQty(i.packQty)} ${i.packUnit} a ${money(i.packPrice)}</p></td>
                    <td class="py-3 pr-3"><span class="${lv.tone} px-2 py-0.5 text-sm font-bold">${lv.label}</span></td>
                    <td class="py-3 pr-3 font-bold tabular-nums">${fmtQty(i.current)} ${i.unit}</td>
                    <td class="py-3 pr-3 tabular-nums">${fmtQty(i.min)} / ${fmtQty(i.max)} ${i.unit}</td>
                    <td class="py-3 pr-3 tabular-nums">${money(unitCost(i))} / ${i.unit}</td>
                    <td class="py-3 text-right">${writable ? html`<button type="button" data-action="edit-insumo" data-id="${i.id}" class="${cls.btn.ghost}">Editar</button>` : ""}</td>
                  </tr>`;
              })}
            </tbody>
          </table>` : html`<p class="p-2 text-lg">Ningún insumo está bajo su mínimo.</p>`}
      </div>`;
  }

  function recetasView() {
    const s = store.get();
    const products = s.products.filter((p) => p.category !== "grano");
    const withRecipe = products.filter((p) => p.recipe.length);
    const without = products.filter((p) => !p.recipe.length);
    const row = (p: Product) => {
      const price = p.sizes.find((z) => z.id === "chico")?.price ?? 0;
      const cost = recipeCost(p, s.insumos);
      const margin = price - cost;
      return html`
        <tr class="border-t-2 border-ink/15 align-top">
          <td class="py-3 pr-3">
            <p class="font-bold">${p.name}</p>
            <ul class="mt-1 text-sm text-ink/80">
              ${p.recipe.map((r) => html`<li>${fmtQty(r.qty)} ${r.unit} · ${s.insumos.find((i) => i.id === r.insumoId)?.name ?? "Insumo eliminado"}</li>`)}
            </ul>
          </td>
          <td class="py-3 pr-3 tabular-nums">${money(cost)}</td>
          <td class="py-3 pr-3 tabular-nums">${money(price)}</td>
          <td class="py-3 pr-3 font-bold tabular-nums ${margin / (price || 1) < 0.6 ? "text-chili" : "text-henequen"}">${money(margin)} · ${pct(price ? margin / price : 0)}</td>
          <td class="py-3 text-right">${writable ? html`<button type="button" data-action="recipe" data-id="${p.id}" class="${cls.btn.ghost}">Editar receta</button>` : ""}</td>
        </tr>`;
    };
    return html`
      <p class="mb-4 border-l-4 border-sun bg-paper p-3 font-bold">Las recetas calculan costo y margen; no descuentan inventario al vender.</p>
      <div class="${cls.card} overflow-x-auto p-4">
        <table class="w-full min-w-[44rem] text-left">
          <thead><tr class="${cls.th}">
            <th scope="col" class="pb-2">Producto y receta (tamaño chico)</th><th scope="col" class="pb-2">Costo</th>
            <th scope="col" class="pb-2">Precio</th><th scope="col" class="pb-2">Margen</th><th scope="col"><span class="sr-only">Acciones</span></th>
          </tr></thead>
          <tbody>${withRecipe.map(row)}</tbody>
        </table>
      </div>
      ${without.length && writable ? html`
        <div class="mt-5 flex flex-wrap items-end gap-3">
          <label class="min-w-0 basis-72"><span class="${cls.label}">Agregar receta a</span>
            <select data-new-recipe class="${cls.input}">${without.map((p) => html`<option value="${p.id}">${p.name}</option>`)}</select></label>
          <button type="button" data-action="recipe-new" class="${cls.btn.ink}">Crear receta</button>
        </div>` : ""}`;
  }

  function paint() {
    const tabs: [Tab, string][] = [["insumos", "Insumos"], ["recetas", "Recetas y margen"]];
    render(root, html`
      <div class="mb-5 flex flex-wrap gap-2" role="tablist">
        ${tabs.map(([id, label]) => html`<button type="button" role="tab" data-action="tab" data-tab="${id}" aria-selected="${tab === id}" class="${cls.tab} bg-paper">${label}</button>`)}
      </div>
      ${tab === "insumos" ? insumosView() : recetasView()}
      ${writable ? "" : html`<p class="mt-3 text-sm font-bold text-chili">Tu usuario solo puede consultar el inventario.</p>`}`);
  }

  function editInsumo(i: Insumo | null) {
    const isNew = !i;
    const base: Insumo = i ?? { id: "", name: "", unit: "g", packQty: 1, packUnit: "kg", packPrice: 0, current: 0, min: 0, max: 0, supplier: "" };
    const num = (name: string, label: string, value: number, step = "any") =>
      html`<label><span class="${cls.label}">${label}</span><input name="${name}" type="number" inputmode="decimal" min="0" step="${step}" value="${value}" class="${cls.input} tabular-nums"></label>`;
    openDialog({
      title: isNew ? "Nuevo insumo" : `Editar · ${base.name}`,
      submit: isNew ? "Crear insumo" : "Guardar",
      wide: true,
      body: html`
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="sm:col-span-2"><span class="${cls.label}">Nombre *</span><input name="name" required maxlength="80" value="${base.name}" class="${cls.input}"></label>
          <fieldset class="grid grid-cols-3 gap-2 border-2 border-ink/30 p-3 sm:col-span-2">
            <legend class="${cls.label} px-1">Presentación de compra</legend>
            ${num("packQty", "Cantidad", base.packQty)}
            <label><span class="${cls.label}">Unidad</span><select name="packUnit" class="${cls.input}">${unitOptions(base.packUnit)}</select></label>
            ${num("packPrice", "Precio $", base.packPrice)}
          </fieldset>
          <label><span class="${cls.label}">Unidad de control</span><select name="unit" class="${cls.input}">${unitOptions(base.unit)}</select></label>
          ${num("current", "Existencia actual", base.current)}
          ${num("min", "Mínimo", base.min)}
          ${num("max", "Máximo", base.max)}
          <label class="sm:col-span-2"><span class="${cls.label}">Proveedor</span><input name="supplier" maxlength="80" value="${base.supplier}" class="${cls.input}"></label>
        </div>
        <p class="mt-3 text-sm text-ink/80">Costo unitario = precio de compra ÷ presentación convertida a la unidad de control. Las unidades deben ser de la misma familia (g/kg, ml/l o pza).</p>`,
      onSubmit: (f) => {
        const name = String(f.get("name") ?? "");
        const next: Insumo = {
          ...base,
          id: isNew ? slugify(name) : base.id,
          name,
          unit: String(f.get("unit")) as Unit,
          packQty: Number(f.get("packQty")),
          packUnit: String(f.get("packUnit")) as Unit,
          packPrice: Number(f.get("packPrice")),
          current: Number(f.get("current")),
          min: Number(f.get("min")),
          max: Number(f.get("max")),
          supplier: String(f.get("supplier") ?? ""),
        };
        const res = saveInsumo(store.get(), next, isNew);
        if (!res.ok) return res.error;
        store.set(res.state);
        toast("Insumo guardado");
      },
    });
  }

  function editRecipe(p: Product) {
    const s = store.get();
    const rows = [...p.recipe, null, null, null].slice(0, Math.max(MAX_RECIPE_LINES, p.recipe.length));
    const line = (r: RecipeLine | null, i: number) => html`
      <div class="grid grid-cols-[1fr_6rem_5rem] gap-2">
        <label><span class="sr-only">Insumo ${i + 1}</span>
          <select name="insumo${i}" class="${cls.input}">
            <option value="">— Sin insumo —</option>
            ${s.insumos.map((ins) => html`<option value="${ins.id}" ${r?.insumoId === ins.id ? raw("selected") : ""}>${ins.name} (${ins.unit})</option>`)}
          </select></label>
        <label><span class="sr-only">Cantidad ${i + 1}</span><input name="qty${i}" type="number" inputmode="decimal" min="0" step="any" value="${r?.qty ?? ""}" placeholder="Cant." class="${cls.input} tabular-nums"></label>
        <label><span class="sr-only">Unidad ${i + 1}</span><select name="unit${i}" class="${cls.input}">${unitOptions(r?.unit ?? "g")}</select></label>
      </div>`;
    openDialog({
      title: `Receta · ${p.name}`,
      submit: "Guardar receta",
      wide: true,
      body: html`
        <p class="mb-3">Cantidades para un <b>chico</b>. Al guardar se reemplaza la receta completa; deja en blanco los renglones que no uses.</p>
        <div class="flex flex-col gap-2">${rows.map(line)}</div>
        <p class="mt-3 text-lg">Costo estimado: <b data-cost class="tabular-nums">${money(recipeCost(p, s.insumos))}</b></p>`,
      onInput: (form) => {
        const recipe = read(new FormData(form), rows.length);
        form.querySelector("[data-cost]")!.textContent = money(recipeCost({ ...p, recipe }, store.get().insumos));
      },
      onSubmit: (f) => {
        const res = saveRecipe(store.get(), p.id, read(f, rows.length));
        if (!res.ok) return res.error;
        store.set(res.state);
        toast("Receta guardada");
      },
    });
  }

  const read = (f: FormData, n: number): RecipeLine[] =>
    Array.from({ length: n }, (_, i) => ({
      insumoId: String(f.get(`insumo${i}`) ?? ""),
      qty: Number(f.get(`qty${i}`) || 0),
      unit: String(f.get(`unit${i}`)) as Unit,
    })).filter((r) => r.insumoId);

  onAction(root, {
    tab: (el) => {
      tab = el.dataset.tab as Tab;
      paint();
    },
    low: () => {
      onlyLow = !onlyLow;
      paint();
    },
    "new-insumo": () => editInsumo(null),
    "edit-insumo": (el) => editInsumo(store.get().insumos.find((i) => i.id === el.dataset.id) ?? null),
    recipe: (el) => editRecipe(store.get().products.find((p) => p.id === el.dataset.id)!),
    "recipe-new": () => {
      const id = root.querySelector<HTMLSelectElement>("[data-new-recipe]")?.value;
      const p = store.get().products.find((x) => x.id === id);
      if (p) editRecipe(p);
    },
  });

  store.subscribe(paint);
  paint();
}
