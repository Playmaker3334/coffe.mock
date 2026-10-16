import { menuTabs } from "../../config/menu";
import { resetStock } from "../actions";
import { adjustStock, saveProduct, slugify } from "../actions-catalogo";
import { canWrite, stockLabel } from "../logic";
import { session, store } from "../store";
import type { Category, Product } from "../types";
import { $, cls, confirmDialog, html, money, onAction, openDialog, raw, render, toast } from "../ui";

export const CATEGORY_LABEL: Record<Category, string> = {
  ...(Object.fromEntries(menuTabs.map((t) => [t.id, t.label])) as Record<Exclude<Category, "grano">, string>),
  grano: "Café en grano",
};
const CATS = Object.keys(CATEGORY_LABEL) as Category[];

export function mountProductos(): void {
  const user = session.user();
  if (!user) return;
  const writable = canWrite(user, "productos");
  const root = $("[data-view]");
  let cat: Category | "todos" = "todos";
  let search = "";

  function row(p: Product) {
    const chico = p.sizes.find((z) => z.id === "chico");
    const noChico = p.promo && !chico?.active;
    return html`
      <tr class="border-t-2 border-ink/15 ${p.active ? "" : "opacity-60"}">
        <td class="py-3 pr-3">
          <p class="font-bold">${p.name}</p>
          <p class="text-sm text-ink/75">${CATEGORY_LABEL[p.category]}${p.active ? "" : " · Inactivo"}</p>
          ${noChico ? html`<p class="mt-1 text-sm font-bold text-chili">Sin chico activo: nunca entra en combos</p>` : ""}
        </td>
        <td class="py-3 pr-3 tabular-nums">
          ${p.sizes.map((z) => html`<span class="mr-2 inline-block ${z.active ? "" : "line-through text-ink/50"}">${z.id === "chico" ? "Chico" : "Grande"} ${money(z.price)}</span>`)}
        </td>
        <td class="py-3 pr-3">
          ${p.stock === null ? html`<span class="text-ink/70">Sin control</span>` : html`
            <div class="flex items-center gap-2">
              ${writable ? html`<button type="button" data-action="stock" data-id="${p.id}" data-d="-1" class="grid size-11 cursor-pointer place-items-center border-2 border-ink text-xl font-bold hover:bg-sand" aria-label="Restar una pieza de ${p.name}">−</button>` : ""}
              <span class="min-w-16 text-center font-bold tabular-nums ${p.stock <= 3 ? "text-chili" : ""}">${p.stock} / ${p.stockInit}</span>
              ${writable ? html`<button type="button" data-action="stock" data-id="${p.id}" data-d="1" class="grid size-11 cursor-pointer place-items-center border-2 border-ink text-xl font-bold hover:bg-sand" aria-label="Sumar una pieza de ${p.name}">+</button>` : ""}
            </div>
            <p class="text-[0.78rem] font-bold uppercase tracking-wider text-caramel">${stockLabel(p.stock)}</p>`}
        </td>
        <td class="py-3 pr-3">${p.promo ? html`<span class="bg-leaf px-2 py-0.5 text-sm font-bold text-cream">Sí</span>` : html`<span class="text-ink/70">No</span>`}</td>
        <td class="py-3 text-right">${writable ? html`<button type="button" data-action="edit" data-id="${p.id}" class="${cls.btn.ghost}">Editar</button>` : ""}</td>
      </tr>`;
  }

  function paint() {
    const s = store.get();
    const q = search.trim().toLowerCase();
    const shown = s.products.filter((p) => (cat === "todos" || p.category === cat) && (!q || p.name.toLowerCase().includes(q)));
    render(root, html`
      <div class="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Categorías">
        ${[["todos", "Todos"] as const, ...CATS.map((c) => [c, CATEGORY_LABEL[c]] as const)].map(([id, label]) =>
          html`<button type="button" role="tab" data-action="cat" data-cat="${id}" aria-selected="${cat === id}" class="${cls.tab} bg-paper">${label}</button>`)}
      </div>
      <div class="mb-5 flex flex-wrap items-end gap-3">
        <label class="min-w-0 flex-1 basis-60"><span class="${cls.label}">Buscar producto</span>
          <input type="search" data-search value="${search}" placeholder="Nombre del producto" class="${cls.input}"></label>
        ${writable ? html`
          <button type="button" data-action="reset" class="${cls.btn.ghost}">Reiniciar existencias del día</button>
          <button type="button" data-action="new" class="${cls.btn.sun}">Nuevo producto</button>` : ""}
      </div>
      <div class="${cls.card} overflow-x-auto p-4">
        ${shown.length ? html`
          <table class="w-full min-w-[44rem] text-left">
            <thead><tr class="${cls.th}">
              <th scope="col" class="pb-2">Producto</th><th scope="col" class="pb-2">Tamaños</th>
              <th scope="col" class="pb-2">Existencias hoy</th><th scope="col" class="pb-2">En combos</th><th scope="col"><span class="sr-only">Acciones</span></th>
            </tr></thead>
            <tbody>${shown.map(row)}</tbody>
          </table>` : html`<p class="p-2 text-lg">No hay productos con ese filtro.</p>`}
      </div>
      ${writable ? "" : html`<p class="mt-3 text-sm font-bold text-chili">Tu usuario solo puede consultar el catálogo.</p>`}`);
  }

  function edit(p: Product | null) {
    const isNew = !p;
    const base: Product = p ?? {
      id: "", name: "", category: "calientes", sizes: [{ id: "chico", price: 0, active: true }, { id: "grande", price: 0, active: false }],
      stockInit: null, stock: null, promo: true, active: true, recipe: [],
    };
    const size = (id: "chico" | "grande") => base.sizes.find((z) => z.id === id) ?? { id, price: 0, active: false };
    const sizeFields = (id: "chico" | "grande", label: string) => {
      const z = size(id);
      return html`
        <fieldset class="border-2 border-ink/30 p-3">
          <legend class="${cls.label} px-1">${label}</legend>
          <label class="flex min-h-11 items-center gap-2"><input type="checkbox" name="${id}Active" class="size-5 accent-[var(--color-ink)]" ${z.active ? raw("checked") : ""}> Activo</label>
          <label class="mt-1 block"><span class="${cls.label}">Precio</span>
            <input name="${id}Price" type="number" inputmode="decimal" min="0" step="0.5" value="${z.price || ""}" class="${cls.input} tabular-nums"></label>
        </fieldset>`;
    };
    openDialog({
      title: isNew ? "Nuevo producto" : `Editar · ${base.name}`,
      submit: isNew ? "Crear producto" : "Guardar",
      wide: true,
      body: html`
        <div class="grid gap-3 sm:grid-cols-2">
          <label><span class="${cls.label}">Nombre *</span><input name="name" required maxlength="80" value="${base.name}" class="${cls.input}"></label>
          <label><span class="${cls.label}">Categoría</span>
            <select name="category" class="${cls.input}">${CATS.map((c) => html`<option value="${c}" ${c === base.category ? raw("selected") : ""}>${CATEGORY_LABEL[c]}</option>`)}</select></label>
          ${sizeFields("chico", "Chico (entra en combos)")}
          ${sizeFields("grande", "Grande")}
          <label><span class="${cls.label}">Existencias iniciales del día</span>
            <input name="stockInit" type="number" inputmode="numeric" min="0" step="1" value="${base.stockInit ?? ""}" placeholder="Vacío = sin control" class="${cls.input} tabular-nums">
            <span class="mt-1 block text-sm text-ink/75">Para pan y producto empacado. Las bebidas preparadas van vacías.</span></label>
          <div class="flex flex-col justify-center gap-1">
            <label class="flex min-h-11 items-center gap-2"><input type="checkbox" name="promo" class="size-5 accent-[var(--color-leaf)]" ${base.promo ? raw("checked") : ""}> Entra en combos</label>
            <label class="flex min-h-11 items-center gap-2"><input type="checkbox" name="active" class="size-5 accent-[var(--color-ink)]" ${base.active ? raw("checked") : ""}> Visible en caja</label>
          </div>
        </div>
        <p data-warning class="mt-3 bg-sun-soft p-2 text-sm font-bold" hidden>Sin tamaño chico activo, este producto nunca entra en combos.</p>`,
      onInput: (form) => {
        const f = new FormData(form);
        form.querySelector<HTMLElement>("[data-warning]")!.hidden = !(f.get("promo") === "on" && f.get("chicoActive") !== "on");
      },
      onSubmit: (f) => {
        const name = String(f.get("name") ?? "");
        const stockRaw = String(f.get("stockInit") ?? "").trim();
        const next: Product = {
          ...base,
          id: isNew ? slugify(name) : base.id,
          name,
          category: String(f.get("category")) as Category,
          sizes: (["chico", "grande"] as const)
            .map((id) => ({ id, price: Number(f.get(`${id}Price`) || 0), active: f.get(`${id}Active`) === "on" }))
            .filter((z) => z.id === "chico" || z.active || z.price > 0),
          stockInit: stockRaw === "" ? null : Number(stockRaw),
          promo: f.get("promo") === "on",
          active: f.get("active") === "on",
        };
        const res = saveProduct(store.get(), next, isNew);
        if (!res.ok) return res.error;
        store.set(res.state);
        toast(isNew ? `${next.name} agregado` : "Producto guardado");
      },
    });
  }

  onAction(root, {
    cat: (el) => {
      cat = el.dataset.cat as typeof cat;
      paint();
    },
    stock: (el) => {
      const res = adjustStock(store.get(), el.dataset.id!, Number(el.dataset.d));
      if (!res.ok) return toast(res.error, "error");
      store.set(res.state);
    },
    edit: (el) => edit(store.get().products.find((p) => p.id === el.dataset.id) ?? null),
    new: () => edit(null),
    reset: () =>
      confirmDialog("Reiniciar existencias", "Todas las existencias del día vuelven a su valor inicial. Úsalo al abrir el turno.", "Reiniciar", () => {
        store.set(resetStock(store.get()));
        toast("Existencias reiniciadas");
      }),
  });
  root.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    if (!t.matches("[data-search]")) return;
    search = t.value;
    paint();
    const again = root.querySelector<HTMLInputElement>("[data-search]")!;
    again.focus();
    again.setSelectionRange(search.length, search.length);
  });

  store.subscribe(paint);
  paint();
}
